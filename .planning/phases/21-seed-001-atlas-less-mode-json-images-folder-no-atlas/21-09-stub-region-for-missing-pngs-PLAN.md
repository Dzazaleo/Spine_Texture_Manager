---
phase: 21
plan: 09
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/synthetic-atlas.ts
  - src/core/types.ts
  - src/core/loader.ts
  - tests/core/synthetic-atlas.spec.ts
  - tests/core/loader-atlas-less.spec.ts
autonomous: true
requirements: [LOAD-01]
gap_closure: true
gap_closure_for: [G-01]
tags: [synthetic-atlas, stub-region, silent-skip, gap-closure]

must_haves:
  truths:
    - "synthesizeAtlasText emits a 1x1 stub region in atlas text for every walked region path whose PNG is missing — never silently drops the region from the atlas (D-09 silent-skip is preserved at the user-surface level via LoadResult.skippedAttachments instead of via spine-core skin omission)"
    - "Catastrophic case is now ONLY 'imagesDir absent': MissingImagesDirError throws ONLY when fs.statSync(imagesDir) fails or returns a non-directory. An imagesDir that exists but is empty/has all PNGs missing now produces a successful synthesis with all regions stubbed. (See ISSUE-006 note in <objective>: this is a deliberate refinement of D-10 driven by the G-01 stub-region fix; documented explicitly so future maintainers don't read it as a silent re-definition.)"
    - "SynthResult gains `missingPngs: string[]` — every region whose PNG read failed, threaded out for downstream surfacing"
    - "LoadResult gains OPTIONAL `skippedAttachments?: { name: string; expectedPngPath: string }[]` — populated from synthSourcePaths + missingPngs in atlas-less mode; absent (or empty array) in canonical mode. Optional to match the existing `unusedAttachments?:` precedent and avoid TS2741 cascades on every existing LoadResult test/mock site (per ISSUE-007)."
    - "Loading TOPSCREEN_ANIMATION_JOKER.json with images/JOKER_FULL_BODY/BODY.png deleted does NOT crash with `Cannot read properties of null (reading 'bones')` — the load completes successfully, the BODY mesh attachment exists in the loaded skeleton (with a 1x1 stub region), and BODY appears in LoadResult.skippedAttachments. (Verified via the new fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ regression fixture introduced by Task 3.)"
    - "Pre-existing tests/core/synthetic-atlas.spec.ts catastrophic-case empty-dir test (line 159) is updated: an empty images/ dir is no longer catastrophic; the test moves to the silent-skip describe block and asserts all regions are stubbed + missingPngs is populated"
  artifacts:
    - path: "src/core/synthetic-atlas.ts"
      provides: "synthesizeAtlasText emits stub region for missing PNG; SynthResult.missingPngs"
      contains: "missingPngs"
      min_lines: 230
    - path: "src/core/types.ts"
      provides: "LoadResult.skippedAttachments OPTIONAL field"
      contains: "skippedAttachments"
    - path: "src/core/loader.ts"
      provides: "Loader threads SynthResult.missingPngs → LoadResult.skippedAttachments in atlas-less branches"
      contains: "skippedAttachments"
    - path: "fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json"
      provides: "Minimal mesh-attachment fixture for G-01 falsifying regression test (one mesh + one animation that touches it; pre-fix this file's 'load with PNG missing' path crashes; post-fix it succeeds)"
      contains: "mesh"
    - path: "tests/core/loader-atlas-less.spec.ts"
      provides: "G-01 falsifying regression test using fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ (asserts no throw + skippedAttachments contains the missing entry + skeleton has the mesh attachment)"
      contains: "G-01"
  key_links:
    - from: "src/core/synthetic-atlas.ts stub-region emission"
      to: "spine-core animation/skin parser reading attachment.bones"
      via: "Stub region in atlas → newMeshAttachment succeeds → mesh attachment exists in skin → spine-core's parser reads attachment.bones successfully (no null deref). Exact crash site varies and was NOT verified — see <objective> ISSUE-004 note."
      pattern: "size: 1,1"
    - from: "src/core/loader.ts"
      to: "src/core/types.ts LoadResult"
      via: "loadSkeleton populates skippedAttachments from SynthResult.missingPngs in atlas-less branches; canonical branch leaves it absent (optional field)"
      pattern: "skippedAttachments"
---

<objective>
Fix G-01 — the mesh-attachment crash on missing PNG. The HUMAN-UAT-confirmed reproducer is dropping `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json` with `images/JOKER_FULL_BODY/BODY.png` deleted: load crashes with `Cannot read properties of null (reading 'bones')`.

The fix changes the silent-skip strategy: instead of dropping regions from the synthesized atlas (which causes spine-core to drop the attachment from the skin entirely, downstream consumers then crash on `attachment.bones`), the synthesizer **stamps a 1x1 stub region** for every walked region path whose PNG is missing. The stub region satisfies spine-core's atlas/attachment/animation chain end-to-end. The user-facing silent-skip semantic (D-09) is preserved by threading the missing-PNG list through `LoadResult.skippedAttachments` for the renderer to surface (G-02 closes that surface in Plan 21-10).

**ISSUE-004 root-cause honesty note:** The original draft of this plan claimed the crash site was `SkeletonJson.js:929-940` (deform timeline parser). That claim is **NOT verified** — the empirically-confirmed reproducer (JOKER) has zero animations with deform timelines, so the deform-timeline parser cannot be the crash site. The actual spine-core path that reads `attachment.bones` without null-check is somewhere else — likely weighted-mesh bone resolution during slot/skin setup, OR a different parser path. The fix works regardless: stub-region machinery makes `skin.getAttachment(...)` return a real (stubbed) MeshAttachment instead of null, so any downstream code that reads `attachment.bones` succeeds. We ship the fix without making unverified claims about the exact crash site; future maintainers reading the docblocks will see honest "exact site not pinpointed" language instead of a wrong line number.

**ISSUE-006 D-10 narrowing note:** D-10 in CONTEXT.md originally treated the catastrophic case as "(folder absent OR folder empty AND ≥1 region ref)". This plan **deliberately reclassifies** the "empty folder" sub-case as silent-skip-via-stub (surfaced via skippedAttachments). Folder-absent remains catastrophic. Rationale: with stub-region machinery in place, an empty dir is just "all PNGs missing" — same surfacing path as "one PNG missing", so a separate catastrophic branch adds no value. Plan 21-10's MissingAttachmentsPanel makes this surface visible and actionable.

**Why "stub region" is the cleanest fix:**
Filtering animation timelines server-side requires editing spine-core's parser or post-processing the JSON, both invasive. Synthesizing a 1x1 region is a 5-line change in `synthesizeAtlasText` that keeps the ENTIRE downstream pipeline (attachment loader, animation parser, sampler, analyzer) untouched. The stub attachment computes degenerate AABBs in the sampler, but the renderer filters these out via `skippedAttachments` (Plan 21-10).

Output: `src/core/synthetic-atlas.ts` (~5 LoC change in the missing-PNG branch + new `missingPngs` field on SynthResult), `src/core/types.ts` (`LoadResult.skippedAttachments?` OPTIONAL field), `src/core/loader.ts` (~10 LoC threading), updated `tests/core/synthetic-atlas.spec.ts` (one existing test moves describe block + asserts new shape), new minimal fixture `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/` with one mesh + one animation, new G-01 falsifying regression test in `tests/core/loader-atlas-less.spec.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-CONTEXT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-RESEARCH.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-HUMAN-UAT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-04-synthetic-atlas-SUMMARY.md
@CLAUDE.md

<interfaces>
<!-- Layer 3 invariant: src/core/ may import only node:fs + node:path + @esotericsoftware/spine-core + sibling .ts files. -->

Current SynthResult shape (src/core/synthetic-atlas.ts:58-65):
```typescript
export interface SynthResult {
  atlasText: string;
  pngPathsByRegionName: Map<string, string>;
  dimsByRegionName: Map<string, { w: number; h: number }>;
}
```

NEW shape this plan introduces:
```typescript
export interface SynthResult {
  atlasText: string;
  pngPathsByRegionName: Map<string, string>;
  dimsByRegionName: Map<string, { w: number; h: number }>;
  /** Phase 21 G-01 fix — region paths whose PNG read failed; stub regions
   *  were emitted in the atlas text so spine-core's animation/skin parser
   *  can resolve them without null-deref crashes. The names here also flow
   *  into LoadResult.skippedAttachments for renderer surfacing (G-02 in
   *  Plan 21-10).
   */
  missingPngs: string[];
}
```

Current LoadResult shape (src/core/types.ts:55-133): has skeletonPath, atlasPath, skeletonData, atlas, sourceDims, sourcePaths, atlasSources, editorFps. Phase 21 D-03 made atlasPath nullable. Note: the existing `unusedAttachments?:` field on SkeletonSummary is the precedent for the optional-field pattern this plan follows.

NEW field this plan adds (OPTIONAL — matches `unusedAttachments?:` precedent per ISSUE-007):
```typescript
export interface LoadResult {
  // ... existing fields unchanged ...
  /**
   * Phase 21 G-01 — attachments whose PNG was missing in atlas-less mode.
   * OPTIONAL: absent (or empty array) in canonical-atlas mode and in
   * atlas-less mode where every PNG resolved. Each entry: { name, expectedPngPath }.
   * Renderer (Plan 21-10 MissingAttachmentsPanel) surfaces this list above
   * the Global Max Render Source panel when length > 0. Optional shape
   * follows the existing unusedAttachments?: precedent on SkeletonSummary
   * to avoid TS2741 cascades on every existing LoadResult test/mock site.
   */
  skippedAttachments?: { name: string; expectedPngPath: string }[];
}
```

Atlas text grammar (libgdx 4.2 dialect; verified against TextureAtlas.js:113-130):
```
<region.name>.png       ← page name
size: W,H               ← page size
filter: Linear,Linear   ← page filter
<region.name>           ← region name (first non-`:` line ends page-fields loop)
bounds: 0,0,W,H         ← region bounds
                        ← blank line BETWEEN pages
```

For the missing-PNG stub: same grammar, `size: 1,1` and `bounds: 0,0,1,1`. spine-core's TextureAtlas parser auto-fills u/v/u2/v2 (TextureAtlas.js:162-171) and originalWidth/Height (TextureAtlas.js:152-155) from these.

Current synthesizeAtlasText behavior (src/core/synthetic-atlas.ts:79-146) — the loop at lines 109-134:
```typescript
for (const regionName of regionPaths) {
  const pngPath = path.resolve(path.join(imagesDir, regionName + '.png'));
  let dims;
  try {
    dims = readPngDims(pngPath);
  } catch {
    // D-09: silent skip per-region missing PNG.   ← THIS PATH IS THE BUG
    missingPngs.push(regionName + '.png');
    continue;                                       ← drop region from atlas
  }
  // ... emit page header + region ...
}

// D-10 second variant — folder exists but every PNG read failed.
if (regionPaths.size > 0 && pngPathsByRegionName.size === 0) {
  throw new MissingImagesDirError(imagesDir, skeletonPath, missingPngs);
}
```

NEW behavior: replace the `continue` with stub-region emission, and remove the second-variant throw (now the catastrophic case is purely "dir absent" — handled at the top guard which stays unchanged; see ISSUE-006 note in <objective>).

Loader integration (src/core/loader.ts:236-322):
- Branch 2 (`opts.loaderMode === 'atlas-less'`): line 246 already captures `synth.pngPathsByRegionName` + `synth.dimsByRegionName`. Add capture of `synth.missingPngs`.
- Branch 4 (D-05 fall-through): line 318-319 same pattern.
- Both branches end up in the shared `if (isAtlasLess && synthSourcePaths)` block where `atlasSources` is constructed; add `skippedAttachments` construction here from `synthMissingPngs` + `imagesDir` (only when array is non-empty — keeping the field absent on the happy path matches the optional-field semantics).
- Canonical mode: leave `skippedAttachments` absent (don't set it in the return literal).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update tests/core/synthetic-atlas.spec.ts (RED — assert new stub-region + missingPngs contract)</name>
  <files>tests/core/synthetic-atlas.spec.ts</files>
  <read_first>
    - tests/core/synthetic-atlas.spec.ts (current file — 8 tests; 1 needs to move and assert new behavior, 1 new test added)
    - src/core/synthetic-atlas.ts (current synthesizeAtlasText implementation — lines 109-138 show the silent-skip + catastrophic loops being changed)
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-HUMAN-UAT.md (G-01 reproduction)
  </read_first>
  <behavior>
    - **Update test at line 159** ("throws MissingImagesDirError with full missingPngs list when images/ dir is empty + JSON has region refs") — this test currently asserts MissingImagesDirError throws when imagesDir exists but is empty. Under the new contract this is no longer catastrophic (see ISSUE-006 note in <objective>). **Move the test** to the "silent-skip" describe block, **rename it** to "stubs all regions when images/ dir is empty + JSON has region refs", and assert: (a) NO throw; (b) `synth.atlasText` parses successfully via `new TextureAtlas(synth.atlasText)`; (c) `atlas.findRegion('CIRCLE')` is non-null and has `width === 1`, `height === 1` (stub dims); (d) `synth.missingPngs.length === 4` (still tracked); (e) `synth.dimsByRegionName.size === 0` (no real dims) AND `synth.pngPathsByRegionName.size === 0` (no real paths — these maps stay PNG-truthful).
    - **Update silent-skip test at line 80** ("drops regions whose PNG is missing; remaining regions still resolve") — now atlas.findRegion('TRIANGLE') should be NON-null (stub region). Update assertions: (a) all 3 regions resolve; (b) CIRCLE + SQUARE have real dims; (c) TRIANGLE has stub dims (width === 1, height === 1); (d) `synth.missingPngs` includes `'TRIANGLE.png'`; (e) `synth.pngPathsByRegionName.size === 2` (only PNGs that exist); (f) `synth.dimsByRegionName.size === 2`.
    - **Add new test** in the silent-skip describe block: "exposes missingPngs on SynthResult for downstream surfacing" — construct a tmpdir with 2 PNGs of 3 regions, assert `synth.missingPngs` is a string array of length 1 containing the missing region's `.png` filename.
    - **Keep** the test at line 129 ("throws MissingImagesDirError when images/ folder is absent + JSON has region refs") UNCHANGED — this is still catastrophic.
    - **Keep** the existing happy-path tests UNCHANGED (CIRCLE/SQUARE/TRIANGLE all have PNGs; no missing).
    - **Keep** the existing path-field test UNCHANGED.
    - **Keep** the existing SilentSkipAttachmentLoader tests UNCHANGED — the subclass behavior is unchanged; what changes is what gets passed to it.
  </behavior>
  <action>
**Step A — Edit tests/core/synthetic-atlas.spec.ts:**

1. **Update the silent-skip test (currently lines 79-126)** to assert stub-region behavior:

```typescript
describe('synthesizeAtlasText silent-skip per-region missing PNG (INV-5; D-09; G-01 stub-region fix)', () => {
  it('emits a 1x1 stub region for missing PNG so spine-core can resolve the attachment; remaining regions still resolve with real dims', () => {
    // Construct a tmpdir with JSON referencing 3 region names but only 2 PNGs
    // present. The walker produces 3 paths; readPngDims on the missing one
    // fails; under the G-01 stub-region fix the missing region is emitted as
    // a 1x1 stub so spine-core's animation/skin parser can resolve it without
    // null-deref crashes (exact crash site varies — see plan ISSUE-004 note).
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-stubregion-'));
    fs.mkdirSync(path.join(tmpDir, 'images'), { recursive: true });
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png'),
      path.join(tmpDir, 'images', 'CIRCLE.png'),
    );
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE.png'),
      path.join(tmpDir, 'images', 'SQUARE.png'),
    );
    // No TRIANGLE.png — should be stubbed (1x1).
    const fakeJson = {
      skeleton: { spine: '4.2.0' },
      skins: [
        {
          name: 'default',
          attachments: {
            slot1: {
              CIRCLE: { type: 'region' },
              SQUARE: { type: 'region' },
              TRIANGLE: { type: 'region' },
            },
          },
        },
      ],
    };
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(skelPath, JSON.stringify(fakeJson));
    try {
      const synth = synthesizeAtlasText(fakeJson, path.join(tmpDir, 'images'), skelPath);
      const atlas = new TextureAtlas(synth.atlasText);
      // All 3 regions resolve under the stub-region fix.
      const circle = atlas.findRegion('CIRCLE');
      const square = atlas.findRegion('SQUARE');
      const triangle = atlas.findRegion('TRIANGLE');
      expect(circle).not.toBeNull();
      expect(square).not.toBeNull();
      expect(triangle).not.toBeNull();
      // CIRCLE + SQUARE have REAL dims from their PNG IHDR.
      expect(circle!.width).toBeGreaterThan(1);
      expect(square!.width).toBeGreaterThan(1);
      // TRIANGLE has STUB dims — exactly 1x1 (G-01 stub-region grammar).
      expect(triangle!.width).toBe(1);
      expect(triangle!.height).toBe(1);
      // Maps mirror PNG truth: only the 2 real PNGs in pngPathsByRegionName + dimsByRegionName.
      expect(synth.pngPathsByRegionName.size).toBe(2);
      expect(synth.dimsByRegionName.size).toBe(2);
      // missingPngs records the missing one.
      expect(synth.missingPngs).toEqual(['TRIANGLE.png']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exposes missingPngs on SynthResult for downstream surfacing (G-02 plumbing precondition)', () => {
    // Light test verifying the missingPngs field is present + populated even
    // for the happy-path-with-one-missing case. Sister test of the above but
    // narrower scope (just the missingPngs field shape).
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-missingpngs-shape-'));
    fs.mkdirSync(path.join(tmpDir, 'images'), { recursive: true });
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png'),
      path.join(tmpDir, 'images', 'CIRCLE.png'),
    );
    const fakeJson = {
      skeleton: { spine: '4.2.0' },
      skins: [
        {
          name: 'default',
          attachments: {
            slot1: { CIRCLE: { type: 'region' } },
            slot2: { MISSING: { type: 'mesh' } },
          },
        },
      ],
    };
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(skelPath, JSON.stringify(fakeJson));
    try {
      const synth = synthesizeAtlasText(fakeJson, path.join(tmpDir, 'images'), skelPath);
      expect(Array.isArray(synth.missingPngs)).toBe(true);
      expect(synth.missingPngs).toEqual(['MISSING.png']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('stubs all regions when images/ dir is empty + JSON has region refs (no longer catastrophic under G-01 fix; see plan ISSUE-006 note)', () => {
    // Pre-G-01 contract: this case threw MissingImagesDirError. Post-G-01:
    // every region gets a stub, the load succeeds, all 4 region paths show
    // up in missingPngs for downstream surfacing.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-emptyimg-'));
    fs.mkdirSync(path.join(tmpDir, 'images'), { recursive: true });
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(
      skelPath,
      JSON.stringify({
        skeleton: { spine: '4.2.0' },
        skins: [
          {
            name: 'default',
            attachments: {
              s1: { CIRCLE: { type: 'region' } },
              s2: { SQUARE: { type: 'region' } },
              s3: { TRIANGLE: { type: 'region' } },
              s4: { STAR: { type: 'mesh' } },
            },
          },
        ],
      }),
    );
    try {
      const synth = synthesizeAtlasText(
        JSON.parse(fs.readFileSync(skelPath, 'utf8')),
        path.join(tmpDir, 'images'),
        skelPath,
      );
      const atlas = new TextureAtlas(synth.atlasText);
      // All 4 regions resolve as stubs.
      for (const name of ['CIRCLE', 'SQUARE', 'TRIANGLE', 'STAR']) {
        const region = atlas.findRegion(name);
        expect(region, `region ${name} should be a 1x1 stub`).not.toBeNull();
        expect(region!.width).toBe(1);
        expect(region!.height).toBe(1);
      }
      expect(synth.missingPngs.length).toBe(4);
      expect(synth.pngPathsByRegionName.size).toBe(0);
      expect(synth.dimsByRegionName.size).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

2. **Delete the old test at lines 159-200** (the "throws MissingImagesDirError with full missingPngs list when images/ dir is empty" test) — it's replaced by the "stubs all regions when images/ dir is empty" test above.

3. **Keep the test at lines 129-157** (catastrophic case — `images/` folder absent) UNCHANGED. Folder absent is still catastrophic.

4. **Update the existing happy-path tests at lines 37-77** to also assert `synth.missingPngs` is an empty array (new field):
   - At the end of each happy-path `it()` block, add: `expect(synth.missingPngs).toEqual([]);`

**Step B — Run vitest. Expect RED for the changed tests + new test:**

```bash
npx vitest run tests/core/synthetic-atlas.spec.ts -x
```

Expected failures:
- "emits a 1x1 stub region for missing PNG..." → FAILS (current code drops the region; `atlas.findRegion('TRIANGLE')` returns null instead of a 1x1 stub)
- "exposes missingPngs on SynthResult..." → FAILS (current SynthResult has no `missingPngs` field)
- "stubs all regions when images/ dir is empty..." → FAILS (current code throws MissingImagesDirError instead of stubbing)
- happy-path tests asserting `expect(synth.missingPngs).toEqual([])` → FAIL (no field)
- The deleted test ("throws MissingImagesDirError ... empty + JSON has region refs") is gone, so it doesn't count.

The catastrophic-case test ("images/ folder is absent") still PASSES — that path is unchanged.

7+ tests reshape; expect ~5-6 tests RED in this run; the unchanged tests remain GREEN.
  </action>
  <verify>
    <automated>npx vitest run tests/core/synthetic-atlas.spec.ts -x 2>&1 | grep -E "FAIL|missingPngs|stub" | head -10</automated>
  </verify>
  <acceptance_criteria>
    - File modified: `git diff --name-only HEAD tests/core/synthetic-atlas.spec.ts | wc -l` returns 1
    - New test "emits a 1x1 stub region for missing PNG" exists: `grep -q "emits a 1x1 stub region" tests/core/synthetic-atlas.spec.ts`
    - New test "stubs all regions when images/ dir is empty" exists: `grep -q "stubs all regions when images/ dir is empty" tests/core/synthetic-atlas.spec.ts`
    - New test "exposes missingPngs" exists: `grep -q "exposes missingPngs" tests/core/synthetic-atlas.spec.ts`
    - The OLD catastrophic-empty-dir test is GONE: `grep -c "throws MissingImagesDirError with full missingPngs list when images/ dir is empty" tests/core/synthetic-atlas.spec.ts` returns 0
    - The catastrophic absent-dir test is PRESERVED: `grep -q "throws MissingImagesDirError when images/ folder is absent" tests/core/synthetic-atlas.spec.ts`
    - Happy-path tests assert `missingPngs).toEqual(\[\])`: `grep -c "missingPngs).toEqual(\[\])" tests/core/synthetic-atlas.spec.ts` returns 2 or more
    - Stub-region tests assert `width).toBe(1)`: `grep -c "width).toBe(1)" tests/core/synthetic-atlas.spec.ts` returns 5 or more (4 regions in empty-dir test + 1 TRIANGLE stub in silent-skip test)
    - vitest reports tests RED for the new behaviors: `npx vitest run tests/core/synthetic-atlas.spec.ts -x 2>&1 | grep -qE "(FAIL|missingPngs)"`
  </acceptance_criteria>
  <done>tests/core/synthetic-atlas.spec.ts updated: 1 test repurposed (silent-skip → stub-region), 2 new tests added (missingPngs shape + empty-dir-stubs-all), 1 old catastrophic-empty-dir test deleted. RED on the 3 stub-region tests + happy-path missingPngs assertions; the catastrophic absent-dir test stays GREEN.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement stub-region in src/core/synthetic-atlas.ts (GREEN — synthetic-atlas tests pass)</name>
  <files>src/core/synthetic-atlas.ts</files>
  <read_first>
    - src/core/synthetic-atlas.ts (current; lines 79-146 are the change site)
    - tests/core/synthetic-atlas.spec.ts (post-Task-1 updated tests — the contract this implementation satisfies)
    - node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js (lines 113-130 — atlas text grammar; lines 152-171 — auto-fill of u/v + originalWidth/Height)
  </read_first>
  <behavior>
    - Replace the `continue` in the missing-PNG catch block (line 117) with **stub-region emission**: emit `<regionName>.png`, `size: 1,1`, `filter: Linear,Linear`, `<regionName>`, `bounds: 0,0,1,1` (preserving the established libgdx grammar). Do NOT add the region to `pngPathsByRegionName` or `dimsByRegionName` — those maps remain PNG-truthful (the loader uses them to build `sourceDims`/`sourcePaths` only for real-PNG regions).
    - Remove the second-variant catastrophic throw (line 137-139): `if (regionPaths.size > 0 && pngPathsByRegionName.size === 0) throw new MissingImagesDirError(...)`. Now a fully-empty images dir simply produces a synth result with all-stub regions and a populated missingPngs list. The user-surface signal moves from a thrown error to a UI panel (Plan 21-10). See ISSUE-006 note in <objective>.
    - Preserve the first-variant catastrophic throw (line 96-102): `if (!imagesDirExists && regionPaths.size > 0)`. Directory absent is still a hard error — the user has an obviously-broken project structure.
    - Add `missingPngs: string[]` to the SynthResult export interface (line 58-65). Populate it inside the loop and return it.
  </behavior>
  <action>
**Step A — Modify src/core/synthetic-atlas.ts:**

1. **Update SynthResult interface** (lines 58-65):

```typescript
export interface SynthResult {
  /** Generated libgdx atlas text — feed to `new TextureAtlas(text)`. */
  atlasText: string;
  /** Map from region.name → absolute PNG path on disk (D-16). REAL PNGs only — does not include stubbed missing-PNG regions. */
  pngPathsByRegionName: Map<string, string>;
  /** Map from region.name → PNG IHDR dims (D-15). REAL PNGs only — does not include stubbed missing-PNG regions. */
  dimsByRegionName: Map<string, { w: number; h: number }>;
  /**
   * Phase 21 G-01 fix — region paths whose PNG read failed; the synthesizer
   * emitted a 1x1 stub region in atlasText for each so spine-core's
   * animation/skin parser can resolve them without crashing on
   * `attachment.bones`. Note: the EXACT spine-core path that reads
   * `attachment.bones` without a null-check is not pinpointed (the
   * empirically-confirmed reproducer — JOKER mesh-attachment crash — has
   * zero deform timelines, so the historic "deform-timeline parser at
   * SkeletonJson.js:929-940" claim was incorrect; the crash likely lives
   * in weighted-mesh bone resolution or another parser path). The fix
   * works regardless because the stub region makes `skin.getAttachment(...)`
   * return a real (stubbed) MeshAttachment instead of null, satisfying
   * any downstream `attachment.bones` read.
   *
   * Each entry is `<regionName>.png` (matches the file the user would expect
   * on disk relative to imagesDir). The loader threads this list to
   * LoadResult.skippedAttachments for renderer surfacing (Plan 21-10
   * MissingAttachmentsPanel — G-02).
   */
  missingPngs: string[];
}
```

2. **Update synthesizeAtlasText** — change the catch block at lines 113-118 + the second-variant throw at lines 136-139:

```typescript
  for (const regionName of regionPaths) {
    const pngPath = path.resolve(path.join(imagesDir, regionName + '.png'));
    let dims;
    try {
      dims = readPngDims(pngPath);
    } catch {
      // G-01 stub-region fix (replaces the pre-G-01 silent-skip-via-drop):
      // emit a 1x1 stub region in the atlas text for the missing PNG so
      // spine-core's atlas parser sees a valid region for this name. The
      // SilentSkipAttachmentLoader will then return a real (stubbed) mesh
      // attachment from newMeshAttachment, which lets spine-core's animation
      // and skin parsers read `attachment.bones` without a null-deref crash.
      // (Exact spine-core crash site varies — see SynthResult.missingPngs
      // docblock for the honest "not pinpointed" note.)
      //
      // The 1x1 stub is intentionally degenerate: the sampler will compute
      // garbage AABBs against this stub, and the renderer filters those out
      // via the `skippedAttachments` cascade (loader.ts → summary.ts →
      // SkeletonSummary → MissingAttachmentsPanel).
      //
      // pngPathsByRegionName / dimsByRegionName intentionally NOT updated —
      // they stay PNG-truthful so downstream maps (sourceDims, sourcePaths,
      // atlasSources) only carry real-PNG entries.
      missingPngs.push(regionName + '.png');
      if (lines.length > 0) lines.push('');
      lines.push(regionName + '.png'); //                       page name
      lines.push('size: 1,1');
      lines.push('filter: Linear,Linear');
      lines.push(regionName); //                                region name (G-01 stub)
      lines.push('bounds: 0,0,1,1');
      continue;
    }
    // ... existing real-PNG branch unchanged ...
    if (lines.length > 0) lines.push('');
    lines.push(regionName + '.png');
    lines.push(`size: ${dims.width},${dims.height}`);
    lines.push('filter: Linear,Linear');
    lines.push(regionName);
    lines.push(`bounds: 0,0,${dims.width},${dims.height}`);
    pngPathsByRegionName.set(regionName, pngPath);
    dimsByRegionName.set(regionName, { w: dims.width, h: dims.height });
  }

  // G-01 fix: REMOVE the pre-existing second-variant catastrophic throw —
  // an images dir that exists but is fully empty is no longer catastrophic.
  // Each region got a stub above; the user sees them in skippedAttachments
  // (Plan 21-10 panel). The folder-absent case (line 96-102) is still
  // catastrophic and remains unchanged. (Plan 21-09 ISSUE-006 note.)

  return {
    atlasText: lines.join('\n'),
    pngPathsByRegionName,
    dimsByRegionName,
    missingPngs, //                                              G-01: surface for downstream
  };
}
```

3. **Update the docblock at the top of the file** to reflect the new contract:

```typescript
/**
 * Phase 21 Plan 04 (LOAD-03) — Synthetic atlas for atlas-less mode.
 *   Plan 21-09 (G-01 fix) — stub-region for missing PNG.
 *
 * When the loader detects no `.atlas` file beside the `.json` (D-05) or
 * the per-project `loaderMode === 'atlas-less'` override (D-08), this
 * module:
 *   1. Walks parsedJson.skins[*].attachments[slot][entry] to enumerate
 *      region/mesh/linkedmesh attachment paths (D-01, Pitfall 2: keys
 *      on att.path ?? entryName).
 *   2. For each unique path, resolves <imagesDir>/<path>.png and reads
 *      its IHDR dims via png-header.readPngDims (Plan 21-01). If the read
 *      fails (PNG missing), the region is emitted as a 1x1 stub so
 *      spine-core's animation/skin parser can resolve `attachment.bones`
 *      without crashing (G-01). Exact spine-core crash site is not
 *      pinpointed — see SynthResult.missingPngs docblock.
 *   3. Generates libgdx atlas text (one page per region) that spine-core's
 *      TextureAtlas parser consumes — yielding identical downstream
 *      behavior to a canonical .atlas-backed load. (D-13 text-based
 *      approach.)
 *   4. The SilentSkipAttachmentLoader subclass converts the stock
 *      AtlasAttachmentLoader's "Region not found" throw into a null
 *      return, for any region the synthesizer didn't emit at all (defensive
 *      guard — every walked path now gets a stub-or-real region, but
 *      downstream callers may still pass paths the synthesizer didn't see).
 *
 * Catastrophic case (D-10, refined per ISSUE-006): only when imagesDir
 * does not exist as a directory. An imagesDir that exists but is fully
 * empty is NO LONGER catastrophic — each region gets a 1x1 stub and the
 * missing PNGs surface via SynthResult.missingPngs / LoadResult.skippedAttachments
 * (G-02). This is a deliberate refinement of D-10's original
 * "(folder absent OR folder empty AND ≥1 region ref)" contract: with
 * stub-region machinery in place, an empty dir is just "all PNGs missing"
 * — same surfacing path as "one PNG missing".
 *
 * Layer 3 invariant: pure TS, only node:fs / node:path / spine-core /
 * ./png-header / ./errors imports.
 */
```

**Step B — Run vitest. The 3 changed/new tests in synthetic-atlas.spec.ts MUST flip GREEN:**

```bash
npx vitest run tests/core/synthetic-atlas.spec.ts -x
```

Expected outcome: ALL tests in synthetic-atlas.spec.ts pass.

**Step C — Run the full vitest suite:**

```bash
npm run test
```

Expected outcome: full suite green except for `tests/core/loader-atlas-less.spec.ts` (Tasks 3 + 4 will retest these). The pre-existing test in loader-atlas-less.spec.ts that asserts D-10 catastrophic via `loaderMode: 'atlas-less'` on a JSON-only tmpdir (no images/ folder) MUST still pass — that path is unchanged. Note: the `loaderMode: 'atlas-less'` test uses an absent images/ dir, so MissingImagesDirError throws as expected.

**Step D — Run typecheck:**

```bash
npm run typecheck
```

Expected: zero new TS errors. The SynthResult.missingPngs field addition is a structural extension; existing call sites compile unchanged. The only consumer of SynthResult — src/core/loader.ts — destructures the result and will simply not use the new field until Task 3 wires it.
  </action>
  <verify>
    <automated>npx vitest run tests/core/synthetic-atlas.spec.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - SynthResult interface has missingPngs: `grep -q "missingPngs: string\[\]" src/core/synthetic-atlas.ts`
    - Stub-region grammar present: `grep -q "size: 1,1" src/core/synthetic-atlas.ts`
    - Stub-region bounds present: `grep -q "bounds: 0,0,1,1" src/core/synthetic-atlas.ts`
    - Second-variant catastrophic throw is GONE: `grep -c "regionPaths.size > 0 && pngPathsByRegionName.size === 0" src/core/synthetic-atlas.ts` returns 0
    - First-variant catastrophic throw PRESERVED: `grep -q "!imagesDirExists && regionPaths.size > 0" src/core/synthetic-atlas.ts`
    - SynthResult return statement includes missingPngs: `awk '/return {/,/};/' src/core/synthetic-atlas.ts | grep -q "missingPngs"`
    - Honest root-cause language present (no specific line refs claiming certainty): `grep -c "SkeletonJson.js:929-940" src/core/synthetic-atlas.ts` returns 0
    - Layer 3 invariant preserved: `grep -E "from 'sharp'|libvips|node:zlib|document\\.|window\\." src/core/synthetic-atlas.ts` returns nothing
    - All synthetic-atlas tests pass: `npx vitest run tests/core/synthetic-atlas.spec.ts -x` exit 0
    - typecheck green: `npm run typecheck 2>&1 | grep "error TS" | grep -v "@ts-expect-error" | grep -v "scripts/probe-per-anim.ts" | wc -l` returns 0
  </acceptance_criteria>
  <done>src/core/synthetic-atlas.ts emits 1x1 stub regions for missing PNGs; SynthResult.missingPngs populated; second-variant catastrophic throw removed; folder-absent first-variant preserved. Honest root-cause language replaces unverified line-number claims. All synthetic-atlas vitest tests pass. typecheck green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Build G-01 fixture + thread skippedAttachments through LoadResult + loader.ts (RED → GREEN; falsifying loader integration test)</name>
  <files>src/core/types.ts, src/core/loader.ts, fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json, fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png, tests/core/loader-atlas-less.spec.ts</files>
  <read_first>
    - src/core/types.ts (lines 55-133 — LoadResult interface; note the existing `unusedAttachments?:` precedent on SkeletonSummary)
    - src/core/loader.ts (lines 236-322 — atlas-less branches; lines 410-460 — atlasSources construction site, where skippedAttachments will be built)
    - tests/core/loader-atlas-less.spec.ts (existing 5 tests; Task 3 adds Test 6 for G-01 falsifying regression)
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json (existing fixture — verify it has ZERO animations with deform/mesh-bone refs touching TRIANGLE so we know the SIMPLE-fixture-with-TRIANGLE-deleted path does NOT reproduce G-01; this is empirically true and motivates the new fixture)
    - fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (canonical SIMPLE fixture — used as the structural template for the new mesh fixture; copy the bone hierarchy + add ONE mesh attachment with vertices that crashes pre-fix)
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-04-synthetic-atlas-SUMMARY.md (synthesizeAtlasText return shape)
  </read_first>
  <behavior>
    - **Add field to LoadResult interface (src/core/types.ts):** OPTIONAL `skippedAttachments?: { name: string; expectedPngPath: string }[]`. Optional shape (matches existing `unusedAttachments?:` precedent on SkeletonSummary, per ISSUE-007). Absent in canonical mode and in atlas-less mode where every PNG resolved; present (and populated) in atlas-less mode when one or more PNGs were missing.
    - **Capture missingPngs in loader.ts atlas-less branches** (line 236-247 for D-08 override; line 308-322 for D-05 fall-through): bind `synthMissingPngs = synth.missingPngs` alongside the existing `synthSourcePaths`/`synthDims` captures.
    - **Build skippedAttachments before the return statement** (loader.ts:467-477): in atlas-less mode WHEN synthMissingPngs.length > 0, map each missingPng filename back to `{ name: <filename without .png>, expectedPngPath: path.resolve(imagesDir, <filename>) }`; in atlas-less mode with zero missing, leave the field absent. In canonical mode, leave the field absent.
    - **Build the G-01 reproducer fixture** at `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/`:
      - `MeshOnly_TEST.json` — minimal Spine 4.2 JSON with ONE bone (root), ONE slot, ONE mesh attachment named `MESH_REGION` with 4 vertices and bone weights, ONE animation with at least one timeline that touches the mesh (e.g., a slot color timeline OR a deform timeline OR an attachment timeline — whichever shape historically reproduces the crash). Goal: this JSON, loaded with `MESH_REGION.png` MISSING, MUST crash pre-fix with `Cannot read properties of null (reading 'bones')` (or whatever the exact null-deref site is). The executor builds the fixture iteratively: start by stripping JOKER's BODY mesh + one animation that touches it; verify pre-fix crash; trim further until <50 LoC of JSON.
      - `images/MESH_REGION.png` — a tiny real PNG (the executor copies an existing 1x1-or-similar fixture PNG, e.g., `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png` which is already 637 bytes).
      - The fixture's HAPPY PATH (with `MESH_REGION.png` present) must `loadSkeleton` successfully — pre-fix and post-fix.
      - The fixture's MISSING-PNG PATH (with `MESH_REGION.png` deleted via tmpdir copy) must crash pre-fix and succeed post-fix. THIS is the falsifying test.
    - **Add Test 6 to tests/core/loader-atlas-less.spec.ts** asserting G-01 regression: copy `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/` to a tmpdir, delete `MESH_REGION.png`, `loadSkeleton(tmpFixturePath)` does NOT throw, returns a LoadResult where (a) `skippedAttachments?.length === 1`, (b) `skippedAttachments![0].name === 'MESH_REGION'`, (c) `skippedAttachments![0].expectedPngPath` ends with `images/MESH_REGION.png`, (d) the loaded skeleton's MESH_REGION attachment exists in the default skin (verifiable via the skin walk).
    - **Update Test 1** in loader-atlas-less.spec.ts (the happy-path D-05 + INV-8 test) to assert `result.skippedAttachments` is undefined OR an empty array (no missing PNGs in the happy fixture).
  </behavior>
  <action>
**Step A — Modify src/core/types.ts (~line 130, just before the closing `}` of LoadResult):**

```typescript
  /**
   * Phase 21 G-01 fix — attachments whose PNG was missing in atlas-less mode.
   * OPTIONAL: absent in canonical-atlas mode and in atlas-less mode where
   * every referenced PNG resolved successfully. Optional shape follows the
   * existing `unusedAttachments?:` precedent on SkeletonSummary to avoid
   * TS2741 cascades on every existing LoadResult test/mock site (ISSUE-007).
   *
   * Each entry: `name` = region name (e.g. 'JOKER_FULL_BODY/BODY'),
   * `expectedPngPath` = absolute path the synthesizer tried to read.
   *
   * Renderer (Plan 21-10 MissingAttachmentsPanel) surfaces this list above
   * the Global Max Render Source panel when length > 0. The panel renders
   * conditionally: hidden when undefined or length === 0.
   */
  skippedAttachments?: { name: string; expectedPngPath: string }[];
```

**Step B — Modify src/core/loader.ts:**

1. **Add `synthMissingPngs` capture** alongside the existing `synthSourcePaths` / `synthDims` declarations (~line 211-212):

```typescript
  let synthSourcePaths: Map<string, string> | null = null;
  let synthDims: Map<string, { w: number; h: number }> | null = null;
  let synthMissingPngs: string[] | null = null;     // Phase 21 G-01
```

2. **Capture in D-08 override branch** (~line 245-246):

```typescript
    synthSourcePaths = synth.pngPathsByRegionName;
    synthDims = synth.dimsByRegionName;
    synthMissingPngs = synth.missingPngs;            // Phase 21 G-01
```

3. **Capture in D-05 fall-through branch** (~line 318-319):

```typescript
    synthSourcePaths = synth.pngPathsByRegionName;
    synthDims = synth.dimsByRegionName;
    synthMissingPngs = synth.missingPngs;            // Phase 21 G-01
```

4. **Build skippedAttachments before the return** (~line 460, after the atlasSources block):

```typescript
  // Phase 21 G-01 — surface attachments whose PNGs were missing in atlas-less
  // mode. Each missingPngs entry is `<regionName>.png`; map back to
  // { name: <regionName>, expectedPngPath: <imagesDir>/<filename> }.
  // Field is OPTIONAL (matches unusedAttachments?: precedent): we leave it
  // absent when there's nothing to surface (canonical mode, or atlas-less
  // mode with all PNGs present). The synthesizer emitted a 1x1 stub region
  // for each entry so spine-core's animation parser resolved them without
  // null-deref crashes; the renderer hides them from the main panels and
  // surfaces them in the MissingAttachmentsPanel (Plan 21-10).
  const skippedAttachments: { name: string; expectedPngPath: string }[] | undefined =
    isAtlasLess && synthMissingPngs !== null && synthMissingPngs.length > 0
      ? synthMissingPngs.map((filename) => ({
          name: filename.endsWith('.png') ? filename.slice(0, -4) : filename,
          expectedPngPath: path.resolve(path.join(imagesDir, filename)),
        }))
      : undefined;
```

(Note: the existing `imagesDir` variable at line 398 is in scope — `const imagesDir = path.join(path.dirname(skeletonPath), 'images');` — reuse it for the expectedPngPath construction. Both atlas-less branches use the same `path.dirname(skeletonPath) + '/images'` pattern; canonical mode never reaches this construction.)

5. **Update the return statement** (~line 468-478) to conditionally include skippedAttachments:

```typescript
  return {
    skeletonPath: path.resolve(skeletonPath),
    atlasPath: resolvedAtlasPath,
    skeletonData,
    atlas: atlas!,
    sourceDims,
    sourcePaths,
    atlasSources,
    editorFps,
    ...(skippedAttachments !== undefined ? { skippedAttachments } : {}), // Phase 21 G-01 (optional)
  };
```

**Step C — Build the G-01 fixture** at `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/`:

1. Create the directory: `mkdir -p fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images`

2. Copy a tiny real PNG as the mesh's region: `cp fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png`

3. Author `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` — minimal Spine 4.2 JSON with one root bone, one slot, one mesh attachment, one animation. The exact JSON shape must reproduce the G-01 crash when MESH_REGION.png is missing. The executor's process:

   a. Start from `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json` — copy ONLY the parts touching JOKER_FULL_BODY/BODY: bones (just root + the relevant chain), slot containing BODY, mesh attachment for BODY (with vertices + uvs + triangles + bones array), and ONE animation with a timeline that touches BODY.
   b. Strip everything else.
   c. Rename the mesh from `BODY` to `MESH_REGION`.
   d. Verify the JSON is well-formed (`jq . MeshOnly_TEST.json | head`).
   e. Test the crash repro pre-fix:
      ```bash
      # In a temporary tmpdir:
      cp -r fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH /tmp/g01-repro/
      rm /tmp/g01-repro/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png
      # Then in a node REPL or quick script: loadSkeleton('/tmp/g01-repro/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json')
      # MUST throw "Cannot read properties of null (reading 'bones')" pre-fix.
      ```
   f. If step (e) does NOT crash pre-fix, the fixture isn't reproducing G-01 — iterate: add another animation timeline shape (deform / attachment / slot.color), retest, until pre-fix crash is confirmed.
   g. Once pre-fix-crash is confirmed, this is the falsifying fixture. Commit the JSON.
   h. **Acceptance gate: the executor MUST verify pre-fix crash empirically before committing.** This is the difference between a falsifying test and a vacuous test (ISSUE-001).

4. Target JSON size: <50 LoC of JSON. If the minimal-mesh-with-crash isn't achievable in <50 LoC (e.g., a deform timeline needs vertex count + frame count overhead), the executor may go to ~150 LoC — but document why in the SUMMARY.

**Step D — Add Test 6 to tests/core/loader-atlas-less.spec.ts** (insert as a new `it()` inside the existing `describe('Phase 21 atlas-less round-trip ...')` block):

```typescript
  it('G-01: load atlas-less mesh-only project with missing PNG does NOT crash; skippedAttachments surfaces the entry (falsifying regression)', () => {
    // Reproduces the gap surfaced in 21-HUMAN-UAT.md G-01: deleting a single
    // mesh-attachment PNG used to crash with `Cannot read properties of null
    // (reading 'bones')` because spine-core's animation/skin parser reads
    // attachment.bones without null-check when the attachment was silently
    // dropped from the skin. Plan 21-09's stub-region fix synthesizes a 1x1
    // region for missing PNGs so the attachment exists in the skin and the
    // parser succeeds.
    //
    // FALSIFYING: this test uses the new fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/
    // fixture, which was empirically verified to crash pre-fix. The pre-existing
    // SIMPLE_PROJECT_NO_ATLAS fixture does NOT reproduce G-01 because its
    // SIMPLE_TEST.json has zero animations with timelines that read
    // attachment.bones — verified empirically (see Plan 21-09 ISSUE-001).
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-g01-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    // Intentionally do NOT copy MESH_REGION.png — that's the missing-PNG case.
    try {
      let caught: unknown = null;
      let result;
      try {
        result = loadSkeleton(tmpJson);
      } catch (e) {
        caught = e;
      }
      expect(caught, 'load should not throw — G-01 regression').toBeNull();
      expect(result).toBeDefined();
      // skippedAttachments contains exactly the one missing region.
      expect(result!.skippedAttachments).toBeDefined();
      expect(result!.skippedAttachments!.length).toBe(1);
      expect(result!.skippedAttachments![0].name).toBe('MESH_REGION');
      expect(
        result!.skippedAttachments![0].expectedPngPath.endsWith('images/MESH_REGION.png'),
      ).toBe(true);
      // The MESH_REGION attachment EXISTS in the loaded skeleton (with stub
      // dims) — proving spine-core's animation/skin parser succeeded against a
      // resolved-but-stubbed region. Walk the default skin to find it.
      const defaultSkin = result!.skeletonData.defaultSkin;
      expect(defaultSkin).toBeDefined();
      let meshAttachment: unknown = null;
      for (let slotIdx = 0; slotIdx < defaultSkin!.attachments.length; slotIdx++) {
        const dict = defaultSkin!.attachments[slotIdx];
        if (dict && dict['MESH_REGION']) {
          meshAttachment = dict['MESH_REGION'];
          break;
        }
      }
      expect(
        meshAttachment,
        'MESH_REGION attachment must exist in default skin (stub region)',
      ).not.toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
```

**Step E — Update Test 1** in loader-atlas-less.spec.ts (the happy-path test asserting LoadResult shape) to also assert `result.skippedAttachments` is empty or absent:

Find the existing assertion block in Test 1 (it asserts `result.atlasPath`, `result.sourceDims`, etc.) and append:

```typescript
    // Phase 21 G-01 — happy path has all PNGs present; skippedAttachments
    // is undefined or empty (optional field per ISSUE-007).
    expect(result.skippedAttachments ?? []).toEqual([]);
```

**Step F — Run the loader-atlas-less suite:**

```bash
npx vitest run tests/core/loader-atlas-less.spec.ts -x
```

ALL 6 tests (existing 5 + new Test 6) MUST pass. Test 6 specifically locks G-01 closure via the new falsifying fixture.

**Step G — Run the full suite:**

```bash
npm run test
```

Expected: full suite green. The new field is OPTIONAL — every existing `LoadResult` returner compiles without modification (ISSUE-007).

**Step H — Run typecheck:**

```bash
npm run typecheck
```

Expected: zero NEW TS errors. The pre-existing scripts/probe-per-anim.ts TS2339 error is documented in deferred-items.md and unrelated to this plan.
  </action>
  <verify>
    <automated>npx vitest run tests/core/loader-atlas-less.spec.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - Fixture exists: `test -f fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json`
    - Fixture PNG exists: `test -f fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png`
    - Fixture JSON is well-formed: `jq -e . fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json > /dev/null`
    - LoadResult interface has OPTIONAL skippedAttachments: `grep -q "skippedAttachments?:" src/core/types.ts`
    - skippedAttachments has correct shape (name + expectedPngPath): `awk '/skippedAttachments\\?:/,/}/' src/core/types.ts | grep -q "expectedPngPath"`
    - Loader captures synth.missingPngs: `grep -c "synthMissingPngs = synth.missingPngs" src/core/loader.ts` returns 2
    - Loader builds skippedAttachments construction conditionally: `grep -q "synthMissingPngs.length > 0" src/core/loader.ts`
    - Loader return statement includes skippedAttachments via spread: `awk '/return {/,/};/' src/core/loader.ts | grep -q "skippedAttachments"`
    - Test 6 G-01 regression test exists: `grep -q "G-01.*does NOT crash" tests/core/loader-atlas-less.spec.ts`
    - Test 6 references the new fixture: `grep -q "SIMPLE_PROJECT_NO_ATLAS_MESH" tests/core/loader-atlas-less.spec.ts`
    - Test 6 asserts skippedAttachments[0].name === 'MESH_REGION': `grep -q "skippedAttachments!\[0\].name).toBe.'MESH_REGION'" tests/core/loader-atlas-less.spec.ts`
    - Test 1 asserts empty skippedAttachments on happy path: `grep -q "skippedAttachments ?? \[\]" tests/core/loader-atlas-less.spec.ts`
    - All loader-atlas-less tests pass (6 total): `npx vitest run tests/core/loader-atlas-less.spec.ts -x` exit 0
    - Full vitest green: `npm run test 2>&1 | grep -E "Tests Failed|FAIL " | wc -l` returns 0
    - typecheck green (pre-existing probe-per-anim.ts excluded): `npm run typecheck 2>&1 | grep "error TS" | grep -v "scripts/probe-per-anim.ts" | wc -l` returns 0
  </acceptance_criteria>
  <done>fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ fixture exists with empirically-verified pre-fix-crash repro. LoadResult.skippedAttachments OPTIONAL field added (per ISSUE-007); loader.ts threads synth.missingPngs through both atlas-less branches; G-01 falsifying regression test in loader-atlas-less.spec.ts asserts no-throw + skippedAttachments[0].name === 'MESH_REGION' + MESH_REGION attachment exists in default skin (stub region). All 6 loader-atlas-less tests pass; full vitest + typecheck green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user-JSON→synthesizer | parsedJson region paths drive PNG file resolution; trusted-input by Phase 21 contract (same as the canonical loader at loader.ts:260) |
| filesystem→synthesizer | imagesDir is user-derived (skeletonPath dirname); the stub-region grammar is hard-coded `1,1` (no path-injection vector) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-09-01 | Tampering | Stub-region attachments invisible to user but consume sampler cycles | accept | Stub-region attachments compute degenerate AABBs in the sampler (peakScale near 0), but the renderer filters them out via skippedAttachments cascade. Performance impact: O(N missing) extra sampler iterations × ~120Hz × seconds — bounded; real fixtures have <50 attachments. |
| T-21-09-02 | Information Disclosure | skippedAttachments[*].expectedPngPath leaks absolute file path | accept | Same posture as the canonical sourcePaths map (already exposes absolute paths). The renderer is trusted in Electron's threat model. |
| T-21-09-03 | DoS | Pathological JSON with 100,000 attachments referencing missing PNGs | accept | Real Spine projects have at most ~200 attachments; bounded by the editor + JSON parse. The synthesizer's loop is linear in regions. |
| T-21-09-04 | Spoofing | Stub region's 1x1 dims could be misleading if stubbed-region attachments leak into export math | mitigate | The exporter (src/core/export.ts) reads from sourceDims, NOT from atlas regions. Plan 21-09 keeps sourceDims/sourcePaths/atlasSources PNG-truthful (stubs only emit in atlasText, never in those maps). Verified: loader.ts:368-385 builds sourceDims from synthDims (PNG-truthful); loader.ts:399-408 builds sourcePaths from synthSourcePaths (PNG-truthful); loader.ts:434-444 builds atlasSources from synthSourcePaths + synthDims (PNG-truthful). Stubbed-region attachments thus do NOT contribute to sourceDims/sourcePaths/atlasSources, and never reach the export plan. |
| T-21-09-05 | Tampering | Mutation of LoadResult.skippedAttachments downstream | mitigate | Field is a plain JS array of plain objects — structuredClone-safe across IPC. Renderer reads it; main builds it; no mutation contract violated. Same shape posture as the existing sourceDims map's value records. |
</threat_model>

<verification>
1. `npx vitest run tests/core/synthetic-atlas.spec.ts -x` — all tests pass (post-Task-2 GREEN), including new stub-region tests + missingPngs assertions.
2. `npx vitest run tests/core/loader-atlas-less.spec.ts -x` — all 6 tests pass (existing 5 + new Test 6 G-01 falsifying regression on the new SIMPLE_PROJECT_NO_ATLAS_MESH fixture).
3. `npm run test` — full suite green; the deferred-items.md pre-existing issues remain orthogonal.
4. `npm run typecheck` — zero NEW TS errors; pre-existing scripts/probe-per-anim.ts unrelated.
5. Layer 3 invariant: `grep -E "from 'sharp'|libvips|node:zlib|document\\.|window\\." src/core/synthetic-atlas.ts src/core/loader.ts src/core/types.ts` returns nothing.
6. Manual smoke (post-merge): drag-drop `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json` with `images/JOKER_FULL_BODY/BODY.png` deleted via tmpdir copy — load completes without `Cannot read properties of null (reading 'bones')`.
</verification>

<success_criteria>
- G-01 closed: deleting a single mesh-attachment PNG no longer crashes; the load completes successfully with skippedAttachments populated. Verified by a FALSIFYING regression test using the new fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ fixture (per ISSUE-001).
- SynthResult.missingPngs field added and populated in synthetic-atlas.ts.
- LoadResult.skippedAttachments OPTIONAL field added and populated in loader.ts (atlas-less mode); absent in canonical mode and on the happy path. Optional shape matches the existing unusedAttachments?: precedent (per ISSUE-007).
- 3 updated tests + 1 new G-01 regression test in synthetic-atlas.spec.ts; 1 new G-01 regression test in loader-atlas-less.spec.ts using the new fixture.
- Layer 3 invariant preserved (no new imports beyond node:fs, node:path, spine-core, sibling .ts).
- Full vitest + typecheck green.
- D-09 silent-skip semantic preserved at the user-surface level (panels filter out skippedAttachments, surfaced in Plan 21-10 MissingAttachmentsPanel) — only the spine-core boundary changes (stub region instead of dropped attachment).
- D-10 narrowed (per ISSUE-006): empty-images-dir is no longer catastrophic; folder-absent remains catastrophic. Documented explicitly in <objective> + module docblock.
- Root-cause language honest (per ISSUE-004): no specific spine-core line numbers claimed; all docblocks acknowledge the exact crash site is not pinpointed but the fix works regardless.
</success_criteria>

<output>
After completion, create `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md` recording: stub-region grammar emitted (size: 1,1), files modified (3 source + 2 test + 1 new fixture dir), test count delta, confirmation that the catastrophic-folder-absent case is preserved, confirmation that pngPathsByRegionName/dimsByRegionName remain PNG-truthful (no stub regions leak into sourceDims/sourcePaths/atlasSources), the mapping rule for skippedAttachments[*].name from missingPngs filenames (strip `.png` suffix), the new fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ fixture authoring process (which timeline shape ultimately reproduced the pre-fix crash), and explicit notes on ISSUE-001 (falsifying fixture), ISSUE-004 (honest root-cause language), ISSUE-006 (D-10 narrowing), and ISSUE-007 (optional field).
</output>
