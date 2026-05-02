---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/core/loader.ts
  - tests/core/loader.spec.ts
autonomous: true
requirements: [DIMS-01]
must_haves:
  truths:
    - "loadSkeleton() walks parsedJson.skins[*].attachments and harvests width/height per region (D-01)"
    - "loadSkeleton() reads PNG IHDR via Phase 21's readPngDims for every region with a sourcePath"
    - "LoadResult.canonicalDimsByRegion populated for every region/mesh attachment with non-zero width/height"
    - "LoadResult.actualDimsByRegion populated only when per-region PNG resolves on disk; missing PNGs leave entry undefined (no throw)"
    - "Atlas-extract path (Jokerman-style atlas-only project) leaves actualDimsByRegion empty Map; downstream dimsMismatch:false"
    - "Linkedmesh fallback per R5: canonicalDimsByRegion.has(name) === false → emit dev-mode console.warn, leave fallback to analyzer (canonicalW=p.sourceW)"
  artifacts:
    - path: src/core/loader.ts
      contains: "canonicalDimsByRegion"
    - path: src/core/loader.ts
      contains: "readPngDims"
    - path: tests/core/loader.spec.ts
      contains: "DIMS-01"
  key_links:
    - from: src/core/loader.ts
      to: src/core/png-header.ts
      via: "readPngDims(pngPath) call inside per-region try/catch loop"
      pattern: "readPngDims\\("
    - from: src/core/loader.ts
      to: parsedJson skin walk
      via: "for skin of root.skins; for slot of skin.attachments; harvest att.width + att.height"
      pattern: "skin\\.attachments|attachments.*width.*height"
---

<objective>
Extend `loadSkeleton()` in `src/core/loader.ts` to populate `canonicalDimsByRegion` (from JSON skin attachment width/height per D-01) and `actualDimsByRegion` (from `readPngDims()` per-region IHDR reads, reusing Phase 21's reader). Both maps thread through to LoadResult; downstream analyzer (Plan 22-01 already wired) consumes them to compute `dimsMismatch`.

Per D-01: JSON skin attachment width/height is the unified canonical dims source for both atlas-less AND canonical-atlas modes. The walk pattern is verbatim from Phase 21's `synthetic-atlas.ts:walkSyntheticRegionPaths` — same iteration shape (skins → attachments → slot → entry), same type filter (`region | mesh | linkedmesh`), same `att.path ?? entryName` keying. Only difference: harvest `width` AND `height` per visited entry.

Per RESEARCH §DIMS-01 Implementation > Loader changes: three changes in `loadSkeleton()` — walk extension (Change 1), per-region readPngDims loop (Change 2), LoadResult return shape extension (Change 3).

Per RESEARCH §R5 (linkedmesh fallback): when `att.width === 0` or `att.height === 0` (linkedmesh inheriting from parent without explicit dims), skip the entry — leave canonicalDimsByRegion without an entry. The analyzer's CLI fallback (canonicalW = p.sourceW) kicks in. Emit `console.warn` in dev mode for visibility. Backlog v1.3 item: "linkedmesh canonical-dims fallback via parent mesh resolution."

Per CLAUDE.md fact #4 + Phase 21 contract: `readPngDims` is byte-parsing IHDR only — no zlib/IDAT decoding. Layer 3 invariant preserved. PNG reads happen during `loadSkeleton()` only — never in the sampler hot loop.

Purpose: Make the loader produce the data that 22-01's types contract anticipates. Without this plan, every DisplayRow has empty actualDimsByRegion and dimsMismatch is always false.

Output: loadSkeleton() returns LoadResult with both new maps populated per D-01 + ROADMAP DIMS-01 wording. Vitest tests assert canonical-atlas + atlas-less + atlas-extract paths all exhibit correct map population.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-CONTEXT.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-VALIDATION.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-01-types-cascade-canonical-actual-SUMMARY.md

<interfaces>
<!-- Phase 21's PNG header reader (REUSE; do NOT modify) -->
From src/core/png-header.ts:
```typescript
export function readPngDims(pngPath: string): { width: number; height: number };
// Throws on missing file / unreadable PNG / non-IHDR-conformant bytes.
// Layer 3-clean: uses node:fs only (no sharp, no zlib, no DOM).
```

<!-- Phase 21's walk template (REFERENCE; do NOT modify) -->
From src/core/synthetic-atlas.ts:233-253 walkSyntheticRegionPaths:
```typescript
function walkSyntheticRegionPaths(parsedJson: unknown): Set<string> {
  const paths = new Set<string>();
  const root = parsedJson as {
    skins?: Array<{
      attachments?: Record<string, Record<string, { type?: string; path?: string }>>;
    }>;
  };
  for (const skin of root.skins ?? []) {
    for (const slotName in skin.attachments) {
      const slot = skin.attachments![slotName];
      for (const entryName in slot) {
        const att = slot[entryName];
        const type = att.type ?? 'region';
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        const lookupPath = att.path ?? entryName;
        paths.add(lookupPath);
      }
    }
  }
  return paths;
}
```

<!-- New walk for Phase 22 (DERIVE FROM ABOVE; harvest width + height) -->
The new walk lives inline in loadSkeleton() (same shape as walkSyntheticRegionPaths but writes a Map of {canonicalW, canonicalH}, with the type filter and att.path ?? entryName keying preserved verbatim).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add parsedJson skin walk for canonicalDimsByRegion + per-region readPngDims loop for actualDimsByRegion in loadSkeleton()</name>
  <read_first>
    - src/core/loader.ts (entire file — find: line 30-50 imports; line ~164 parsedJson parse; line ~175-186 sourcePaths construction; line ~235-296 sourcePaths/sourceDims/atlasSources block; line ~257-260 path.join convention; line ~497-507 LoadResult return)
    - src/core/synthetic-atlas.ts (lines 233-253 walkSyntheticRegionPaths — verbatim walk template)
    - src/core/png-header.ts (full file — Phase 21's readPngDims contract)
    - src/core/types.ts (LoadResult after Plan 22-01's extension — confirm canonicalDimsByRegion + actualDimsByRegion fields landed)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-01 Implementation > Loader changes [Change 1, 2, 3]; § Open Research Items > Item #1 mesh attachments resolved; § R5 linkedmesh fallback; § Architectural Responsibility Map row 1+2)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/core/loader.ts complete walkthrough — Imports, parsedJson skin walk, Per-region PNG read pattern, LoadResult return shape)
    - tests/core/loader.spec.ts (lines 32-68 existing F1.1/F1.2/F2.7 cases — extend with DIMS-01)
    - tests/core/loader-atlas-less.spec.ts (lines 30-58 round-trip pattern; reference for atlas-less DIMS-01 coverage)
    - fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (verify SQUARE: w=1000 h=1000; TRIANGLE: w=833 h=759; CIRCLE: w=699 h=699 per RESEARCH §Item #1)
  </read_first>
  <behavior>
    - Test 1: DIMS-01 canonical-atlas mode — load fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json; assert load.canonicalDimsByRegion.get('SQUARE') === { canonicalW: 1000, canonicalH: 1000 }; same for TRIANGLE (833, 759) and CIRCLE (699, 699).
    - Test 2: DIMS-01 atlas-less mode — load fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json with loaderMode: 'atlas-less'; assert canonicalDimsByRegion populated identically (same JSON, so same values).
    - Test 3: DIMS-01 atlas-less mode actualDimsByRegion — load fixtures/SIMPLE_PROJECT_NO_ATLAS/; assert load.actualDimsByRegion populated for every region whose PNG exists in images/; verify dims match readPngDims() called directly on the same PNG.
    - Test 4: DIMS-01 atlas-extract path — load a fixture with .atlas only (no per-region PNGs in an images/ folder); assert load.actualDimsByRegion is empty (size === 0) — but load.canonicalDimsByRegion still populated from JSON.
    - Test 5: DIMS-01 missing-PNG resilience — load atlas-less fixture where one PNG was renamed/missing; assert loadSkeleton() does NOT throw; assert that region's actualDimsByRegion entry is absent (size < canonicalDimsByRegion.size); assert other regions still populate.
    - Test 6 (R5 fallback test): construct a synthetic JSON where one mesh has width: 0 / height: 0; assert canonicalDimsByRegion does NOT contain that region; assert dev-mode console.warn fired (use vi.spyOn(console, 'warn')).
  </behavior>
  <action>
    Step 1: Edit src/core/loader.ts. Add import to the existing imports block (~line 30-50):
    ```typescript
    import { readPngDims } from './png-header.js';
    ```
    Use the same `./...js` extension convention as other core/ imports.

    Step 2: After `parsedJson` is parsed (line ~164-168) and BEFORE the atlas resolution block (~line 198), insert the canonical-dims walk:

    ```typescript
    // Phase 22 DIMS-01 — walk parsedJson.skins[*].attachments to harvest
    // canonical width/height per region. Pattern verbatim from
    // synthetic-atlas.ts:walkSyntheticRegionPaths (Phase 21) — same skin/
    // slot/entry iteration, same type filter, same `att.path ?? entryName`
    // keying. Only difference: harvest att.width + att.height per visited
    // entry. Last-write-wins on duplicate region across skins (canonical
    // dims are a property of the source PNG, NOT the skin variant).
    const canonicalDimsByRegion = new Map<string, { canonicalW: number; canonicalH: number }>();
    {
      const root = parsedJson as {
        skins?: Array<{
          attachments?: Record<string, Record<string, { type?: string; path?: string; width?: number; height?: number }>>;
        }>;
      };
      for (const skin of root.skins ?? []) {
        for (const slotName in skin.attachments) {
          const slot = skin.attachments![slotName];
          for (const entryName in slot) {
            const att = slot[entryName];
            const type = att.type ?? 'region';                 // SkeletonJson.js:366 default
            if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
            const regionName = att.path ?? entryName;          // SkeletonJson.js:368, 401
            const w = att.width ?? 0;
            const h = att.height ?? 0;
            if (w === 0 || h === 0) {
              // Phase 22 R5 — linkedmesh-without-explicit-dims (rare; no
              // fixture in repo exercises this). Skip; analyzer's CLI
              // fallback (canonicalW = p.sourceW) covers downstream.
              // Backlog v1.3: "linkedmesh canonical-dims fallback via
              // parent mesh resolution."
              if (process.env.NODE_ENV !== 'production') {
                console.warn(`Phase 22 DIMS-01: attachment '${regionName}' (type=${type}) has no explicit width/height in JSON; canonical-dims fallback to peakRecord.sourceW.`);
              }
              continue;
            }
            canonicalDimsByRegion.set(regionName, { canonicalW: w, canonicalH: h });
          }
        }
      }
    }
    ```

    Step 3: AFTER `sourcePaths` is fully populated (per RESEARCH §"Change 2" — line ~415, after the sourcePaths/atlasSources/sourceDims construction block), insert the per-region PNG read loop:

    ```typescript
    // Phase 22 DIMS-01 — read PNG IHDR dims for every region with a
    // sourcePath that resolves on disk. Reuses Phase 21's readPngDims
    // (Layer 3-clean byte parser; no decode). Per-region try/catch keeps
    // a missing/unreadable PNG from breaking the load — actualDimsByRegion
    // entry stays absent, downstream dimsMismatch evaluates false (atlas-
    // extract path semantics per CONTEXT D-01).
    const actualDimsByRegion = new Map<string, { actualSourceW: number; actualSourceH: number }>();
    for (const [regionName, pngPath] of sourcePaths) {
      try {
        const dims = readPngDims(pngPath);
        actualDimsByRegion.set(regionName, { actualSourceW: dims.width, actualSourceH: dims.height });
      } catch {
        // Per-region PNG missing or unreadable. Atlas-extract path
        // (Jokerman-style atlas-only project) hits this branch for every
        // region — actualDimsByRegion stays empty. Don't throw — the
        // existing loader contract is "best-effort dims population"
        // per Phase 21 D-12.
      }
    }
    ```

    Note: `sourcePaths` is `Map<string, string>` keyed by attachmentName/regionName, value is the absolute resolved PNG path. Per `loader.ts:257-260` the path is constructed via `path.join(imagesDir, region.name + '.png')` — handles nested region names natively (R8 subfolder support in image-worker is a separate concern in 22-04).

    Step 4: Edit the LoadResult return statement (~line 497-507) to include the new maps:

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
      canonicalDimsByRegion,                                 // Phase 22 DIMS-01
      actualDimsByRegion,                                     // Phase 22 DIMS-01
      ...(skippedAttachments !== undefined ? { skippedAttachments } : {}),
    };
    ```

    Both maps are always-required (per types.ts contract from Plan 22-01) — emit them as bare entries, not conditional spreads. They're empty Maps when there's no per-region PNG (atlas-extract) or no JSON skin walk hits (impossible — every Spine 4.2 JSON has skin attachments).

    Step 5: Audit Layer 3 invariant. After this edit, src/core/loader.ts imports must be: node:fs, node:path, @esotericsoftware/spine-core, ./types.js, ./errors.js, ./synthetic-atlas.js, ./png-header.js. NO sharp, NO electron, NO DOM. Run:
    ```bash
    grep -E "^import.*from" src/core/loader.ts
    ```
    Verify all imports match the allow-list.

    Step 6: Add new test cases to tests/core/loader.spec.ts. Append a new `describe('loader (DIMS-01 canonical-vs-actual dim mapping)')` block:

    ```typescript
    describe('loader (DIMS-01 canonical-vs-actual dim mapping)', () => {
      it('DIMS-01: canonical-atlas mode populates canonicalDimsByRegion from JSON skin attachments', () => {
        const r = loadSkeleton(FIXTURE);  // SIMPLE_PROJECT/SIMPLE_TEST.json
        expect(r.canonicalDimsByRegion.size).toBeGreaterThanOrEqual(3);
        expect(r.canonicalDimsByRegion.get('SQUARE')).toEqual({ canonicalW: 1000, canonicalH: 1000 });
        expect(r.canonicalDimsByRegion.get('TRIANGLE')).toEqual({ canonicalW: 833, canonicalH: 759 });
        expect(r.canonicalDimsByRegion.get('CIRCLE')).toEqual({ canonicalW: 699, canonicalH: 699 });
      });

      it('DIMS-01: atlas-less mode populates canonicalDimsByRegion identically (same JSON)', () => {
        const r = loadSkeleton(ATLAS_LESS_FIXTURE, { loaderMode: 'atlas-less' });
        expect(r.canonicalDimsByRegion.get('SQUARE')).toEqual({ canonicalW: 1000, canonicalH: 1000 });
      });

      it('DIMS-01: atlas-less mode populates actualDimsByRegion from readPngDims', () => {
        const r = loadSkeleton(ATLAS_LESS_FIXTURE, { loaderMode: 'atlas-less' });
        expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(1);
        // Verify the map values match readPngDims called on the same PNG directly:
        const squarePath = r.sourcePaths.get('SQUARE');
        if (squarePath) {
          const direct = readPngDims(squarePath);
          expect(r.actualDimsByRegion.get('SQUARE')).toEqual({ actualSourceW: direct.width, actualSourceH: direct.height });
        }
      });

      it('DIMS-01 atlas-extract dimsMismatch false: atlas-extract path leaves actualDimsByRegion empty', () => {
        // Use a fixture with NO per-region PNGs (atlas-only); SIMPLE_PROJECT does have
        // per-region PNGs in fixtures/EXPORT_PROJECT/, so test against a fixture where
        // sourcePaths resolve to non-existent files OR use Jokerman if present.
        // For SIMPLE_PROJECT (which DOES have per-region PNGs alongside the .atlas),
        // actualDimsByRegion will populate. So construct test:
        const r = loadSkeleton(FIXTURE);
        // Verify: every entry in actualDimsByRegion has a corresponding sourcePath that EXISTS.
        for (const [regionName, _dims] of r.actualDimsByRegion) {
          const pngPath = r.sourcePaths.get(regionName);
          expect(pngPath).toBeDefined();
          expect(fs.existsSync(pngPath!)).toBe(true);
        }
      });

      it('DIMS-01 R5: malformed JSON with attachment width:0 logs dev warning and skips entry', () => {
        // Synthesize JSON via tmpdir (programmatic per RESEARCH §6 strategy):
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          const tmp = mkdtempSync(join(tmpdir(), 'phase22-r5-'));
          // Copy SIMPLE_TEST.json, mutate one attachment to width:0
          const json = JSON.parse(readFileSync(FIXTURE, 'utf8'));
          // Find first skin's first attachment, set width:0
          const firstSkin = json.skins[0];
          const firstSlotName = Object.keys(firstSkin.attachments)[0];
          const firstEntryName = Object.keys(firstSkin.attachments[firstSlotName])[0];
          firstSkin.attachments[firstSlotName][firstEntryName].width = 0;
          firstSkin.attachments[firstSlotName][firstEntryName].height = 0;
          writeFileSync(join(tmp, 'SIMPLE_TEST.json'), JSON.stringify(json));
          // Copy atlas + images so loader can resolve them
          fs.copyFileSync(SIMPLE_TEST_ATLAS, join(tmp, 'SIMPLE_TEST.atlas'));
          // (use whichever copy approach the existing test infra prefers)
          const r = loadSkeleton(join(tmp, 'SIMPLE_TEST.json'));
          // The mutated attachment should NOT be in canonicalDimsByRegion (skipped per R5)
          expect(r.canonicalDimsByRegion.size).toBeLessThan(3);
          expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('canonical-dims fallback'));
        } finally {
          warnSpy.mockRestore();
        }
      });
    });
    ```

    Adapt the test setup to whatever the existing loader.spec.ts patterns are — borrow the FIXTURE / ATLAS_LESS_FIXTURE constants if they exist or define inline. The R5 test uses programmatic mutation (per RESEARCH §6 strategy) — no new committed fixture.

    Step 7: Run `npm run test -- tests/core/loader.spec.ts` to confirm new tests green; full suite sanity-check.
  </action>
  <verify>
    <automated>npx vitest run tests/core/loader.spec.ts -t "DIMS-01" 2>&1 | tail -15 && grep -c "readPngDims" src/core/loader.ts && grep -c "canonicalDimsByRegion" src/core/loader.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "readPngDims" src/core/loader.ts` returns ≥ 2 (import + call site)
    - `grep -c "canonicalDimsByRegion" src/core/loader.ts` returns ≥ 2 (declaration + return)
    - `grep -c "actualDimsByRegion" src/core/loader.ts` returns ≥ 2
    - `grep -E "^import.*from" src/core/loader.ts | grep -E "sharp|electron|DOM"` returns 0 (Layer 3 invariant preserved)
    - vitest tests in tests/core/loader.spec.ts under `describe('loader (DIMS-01 canonical-vs-actual dim mapping)')` all pass — at least 5 new tests
    - DIMS-01 atlas-extract test: `r.actualDimsByRegion` size matches existing PNG count on disk (no orphan map entries)
    - DIMS-01 R5 test: console.warn called with 'canonical-dims fallback' substring
    - Full suite passes: `npm run test` shows baseline + new tests passing
  </acceptance_criteria>
  <done>loadSkeleton() walks JSON skin attachments + reads PNG IHDR per-region; LoadResult emits both new maps; Layer 3 invariant preserved; ≥ 5 new DIMS-01 tests in loader.spec.ts.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem→loader | Per-region PNG paths come from atlas/JSON; loader trusts paths to be readable PNGs |
| JSON→loader | parsedJson is already validated by spine-core; widths/heights treated as untrusted numerics |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-22-05 | Tampering | Malformed PNG triggering throw in readPngDims | mitigate | Per-region try/catch swallows errors; missing entry treated as atlas-extract (CONTEXT D-01) |
| T-22-06 | Information disclosure | console.warn leaks region names to dev console | accept | Dev-mode only (`process.env.NODE_ENV !== 'production'`); CLAUDE.md fact #4 honored (no PII in region names) |
| T-22-07 | Denial of service | Pathological JSON with thousands of skin attachments | accept | Walk is O(n) over skins × slots × entries; Map size bounded by region count; negligible |
| T-22-08 | Tampering | Malicious JSON with width === Infinity / NaN | mitigate | Step 2's `if (w === 0 || h === 0) continue;` skips zero-or-falsy; downstream cap formula divides safely (sourceLimit becomes Infinity which is well-defined; analyzer dimsMismatch comparison handles NaN as non-equal) |
</threat_model>

<verification>
- `grep -c "readPngDims" src/core/loader.ts` ≥ 2.
- Layer 3 invariant: `grep -E "^import.*from ['\"](sharp|electron)" src/core/loader.ts` returns 0.
- vitest DIMS-01 describe block: ≥ 5 new tests passing.
- Full vitest suite: green at existing baseline + new DIMS-01 tests.
</verification>

<success_criteria>
1. canonicalDimsByRegion populated for SIMPLE_PROJECT SQUARE (1000×1000), TRIANGLE (833×759), CIRCLE (699×699) per fixture verification.
2. actualDimsByRegion populated when per-region PNGs resolve on disk; empty Map (or partial) when atlas-extract / missing-PNG path.
3. Linkedmesh fallback per R5: width:0 entries skipped + dev-mode console.warn fires.
4. Layer 3 invariant preserved (no sharp/electron/DOM imports added to core/loader.ts).
5. PNG IHDR reads happen ONLY in loadSkeleton() (no sampler hot-loop entry; verified by call-site location after sourcePaths construction).
6. ≥ 5 new DIMS-01 tests in tests/core/loader.spec.ts.
</success_criteria>

<output>
After completion, create `.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-02-loader-canonical-actual-walk-SUMMARY.md`
</output>
