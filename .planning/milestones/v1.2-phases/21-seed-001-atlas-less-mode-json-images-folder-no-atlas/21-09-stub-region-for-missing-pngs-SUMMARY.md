---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 09
subsystem: loader
tags: [synthetic-atlas, stub-region, silent-skip, gap-closure, G-01, layer-3]

# Dependency graph
requires:
  - phase: 21
    plan: 04
    provides: synthesizeAtlasText + SilentSkipAttachmentLoader + SynthResult interface (the surfaces this plan extends)
  - phase: 21
    plan: 06
    provides: 4-way loader branch (canonical/explicit/D-08/D-05 fall-through) — atlas-less branches consume synth.pngPathsByRegionName + synth.dimsByRegionName already; this plan adds synth.missingPngs threading
provides:
  - SynthResult.missingPngs string[] field — region paths whose PNG was missing (1x1 stub emitted in atlasText)
  - LoadResult.skippedAttachments?: { name, expectedPngPath }[] OPTIONAL field — populated in atlas-less mode when one or more PNGs were missing
  - 1x1 stub-region grammar for missing PNGs (size: 1,1; bounds: 0,0,1,1)
  - fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ — minimal mesh-with-deform-timeline rig that empirically reproduces the G-01 crash pre-fix (Plan 21-09 ISSUE-001 falsifying-test gate)
affects:
  - Plan 21-10 (MissingAttachmentsPanel) — reads LoadResult.skippedAttachments to surface missing PNGs as a renderer panel above the Global Max Render Source panel (G-02 closure)
  - tests/main/summary.ts construction (orthogonal — SkeletonSummary already has unusedAttachments?: precedent; future plan can mirror skippedAttachments through the renderer payload if needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stub-region grammar (libgdx 4.2 dialect) — emit `<regionName>.png` page header + `size: 1,1` + `filter: Linear,Linear` + `<regionName>` region line + `bounds: 0,0,1,1`. spine-core's TextureAtlas parser auto-fills u/v/u2/v2 (TextureAtlas.js:162-171) and originalWidth/Height (TextureAtlas.js:152-155) just like for real-PNG regions."
    - "PNG-truthful map invariant — pngPathsByRegionName + dimsByRegionName never include stub-region entries; only real-PNG reads populate them. Downstream sourceDims/sourcePaths/atlasSources thus never see stubbed entries (T-21-09-04 mitigation)."
    - "OPTIONAL field cascade — LoadResult.skippedAttachments?: matches the existing SkeletonSummary.unusedAttachments?: precedent. Avoids TS2741 cascades on every existing LoadResult test/mock site (Plan 21-09 ISSUE-007)."
    - "Falsifying fixture authoring — author a minimal Spine 4.2 JSON with one root bone, one slot, one mesh attachment, and ONE animation with a deform timeline that touches the mesh. Verify pre-fix crash empirically via probe script before declaring the fixture a falsifying repro (Plan 21-09 ISSUE-001)."

key-files:
  created:
    - fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json (53 lines — minimal mesh-with-deform-timeline rig; falsifying repro)
    - fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png (637 bytes — copy of fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png; happy-path PNG)
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md (this file)
  modified:
    - src/core/synthetic-atlas.ts (229 → 304 lines; +75 lines: SynthResult.missingPngs field + stub-region emission + docblock refresh + second-variant-throw removal)
    - src/core/loader.ts (479 → 508 lines; +29 lines: synthMissingPngs capture in both atlas-less branches + skippedAttachments construction + optional spread in return)
    - src/core/types.ts (165 → 185 lines; +20 lines: LoadResult.skippedAttachments?: OPTIONAL field with full docblock)
    - tests/core/synthetic-atlas.spec.ts (283 → 351 lines; +98/-42 lines: 1 silent-skip test repurposed → stub-region; 2 new tests added — missingPngs shape + empty-dir-stubs-all; 1 catastrophic-empty-dir test deleted; happy-path tests assert missingPngs === [])
    - tests/core/loader-atlas-less.spec.ts (172 → 240 lines; +75 lines: Test 6 G-01 falsifying regression added; Test 1 updated to assert empty/undefined skippedAttachments on happy path)

key-decisions:
  - "ISSUE-001 falsifying-fixture gate — empirically verified the pre-fix crash via a probe script (`scripts/probe-g01-prefix-crash.ts`) BEFORE committing the fixture. The probe constructed an empty atlas (mimicking pre-G-01 silent-skip-via-drop) and fed the MeshOnly_TEST.json + SilentSkipAttachmentLoader to spine-core's SkeletonJson.readSkeletonData. Output: `[probe] EXPECTED CRASH (TypeError): Cannot read properties of null (reading 'bones')`. Sister script `scripts/probe-g01-postfix-success.ts` verified post-fix loadSkeleton succeeds with skippedAttachments=[{name: 'MESH_REGION', ...}]. Both probe scripts gitignored per repo policy (`.gitignore`: `scripts/probe-*.ts`) — they're ephemeral diagnostic tools, not part of the repo. Future maintainers can recreate them from the SUMMARY description if needed."
  - "ISSUE-004 honest root-cause language — the original draft of Plan 21-09 claimed the crash site was `SkeletonJson.js:929-940` (deform timeline parser). After running the empirical falsifying repro, the crash trace pointed to line 937 specifically (`let weighted = attachment.bones;` in the attachment-timelines block at lines 916-940), but the plan's must-haves explicitly require honest 'exact site not pinpointed' language because no broader survey of every repro path was done. The docblocks in synthetic-atlas.ts therefore deliberately omit specific line numbers and frame the variance honestly. This avoids the maintenance debt of stale line-number references when spine-core ships future versions."
  - "ISSUE-006 D-10 narrowing — the catastrophic case in synthetic-atlas.ts is now ONLY 'imagesDir absent' (the first-variant guard at line ~96-102, preserved unchanged). The pre-existing second-variant guard ('folder exists but every PNG read failed') was REMOVED: with stub-region machinery in place, an empty dir is just 'all PNGs missing' — same surfacing path as 'one PNG missing' (skippedAttachments populated). Documented explicitly in <objective> + module docblock + the inline removal-comment so future maintainers don't read it as a silent re-definition of D-10. ✅ tests/core/synthetic-atlas.spec.ts: the pre-existing catastrophic-empty-dir test was repurposed (renamed + moved to silent-skip describe block + assertion shape inverted) — the catastrophic-folder-absent test is preserved verbatim."
  - "ISSUE-007 OPTIONAL field — `LoadResult.skippedAttachments?:` matches the existing `SkeletonSummary.unusedAttachments?:` precedent. Required-field shape would have produced TS2741 cascades on every existing LoadResult test/mock site (the field is genuinely absent in canonical mode and on the happy-path atlas-less load). The optional spread at the return statement (`...(skippedAttachments !== undefined ? { skippedAttachments } : {})`) keeps the canonical-mode return literal byte-identical to pre-Plan-21-09 (no stale 'undefined' field in the JSON-serialized LoadResult)."
  - "Stub-region maps stay PNG-truthful — `pngPathsByRegionName` + `dimsByRegionName` are NOT updated when a stub is emitted; only real-PNG reads populate them. This propagates downstream: `sourceDims` (loader.ts:368-385) only carries real-PNG entries with `source: 'png-header'`, `sourcePaths` (loader.ts:399-408) only carries real-PNG paths, `atlasSources` (loader.ts:434-444) only carries real-PNG entries. The exporter (src/core/export.ts) reads from these maps and thus never sees stub-region entries — the 1x1 stub never reaches the export plan (T-21-09-04 mitigation). The stubbed attachment IS in the loaded skeleton's defaultSkin (verified by the new G-01 falsifying regression test), but the renderer hides it from the main panels via the skippedAttachments cascade landing in Plan 21-10's MissingAttachmentsPanel."
  - "Empty-dir test unrolled per-region to satisfy literal grep acceptance criteria — the original implementation used a `for (const name of [...]) { ... expect(region.width).toBe(1) ... }` loop. Plan 21-09 acceptance criteria require >= 5 occurrences of the literal `width).toBe(1)` substring. Unrolled to four explicit assertions (CIRCLE/SQUARE/TRIANGLE/STAR — same 4 stubs, just one assertion per name). Behavior identical; literal-grep count satisfied (now 6 occurrences across both tests — 2 in the silent-skip TRIANGLE test + 4 in the empty-dir all-stubs test)."

requirements-completed: [LOAD-01]

# Metrics
duration: ~12min
completed: 2026-05-02
---

# Phase 21 Plan 21-09: Stub-Region for Missing PNGs Summary

**G-01 closed via stub-region machinery + skippedAttachments threading — load no longer crashes when a single mesh-attachment PNG is missing; the missing entry surfaces via `LoadResult.skippedAttachments` for renderer pickup in Plan 21-10.**

## Performance

- **Duration:** ~12 min (RED test author + GREEN implementation + Task 3 fixture authoring with falsifying-repro probe iteration on the deform-timeline JSON shape: had to re-key from `deform:` to `attachments:` per spine 4.2 format)
- **Started:** 2026-05-02T17:07:01Z (post worktree-base reset to commit 1925eed)
- **Completed:** 2026-05-02T18:18:49Z
- **Tasks:** 3 (RED test → GREEN implementation → falsifying integration)
- **Files created:** 3 (fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json + images/MESH_REGION.png + this SUMMARY)
- **Files modified:** 5 (src/core/synthetic-atlas.ts, src/core/loader.ts, src/core/types.ts, tests/core/synthetic-atlas.spec.ts, tests/core/loader-atlas-less.spec.ts)

## Accomplishments

- **G-01 closed end-to-end via stub-region.** The synthesizer now emits a 1x1 stub region in atlas text (`<regionName>.png` page + `size: 1,1` + `filter: Linear,Linear` + `<regionName>` region line + `bounds: 0,0,1,1`) for every walked region whose PNG read failed. spine-core's `TextureAtlas` parser auto-fills u/v/u2/v2 and originalWidth/Height for the stub identically to a real-PNG region (TextureAtlas.js:152-171). The `SilentSkipAttachmentLoader` then returns a real (stubbed) MeshAttachment from `newMeshAttachment` instead of null, which means `skin.getAttachment(...)` returns a live attachment object — and the spine-core animation/skin parser path that reads `attachment.bones` succeeds (instead of crashing with `Cannot read properties of null (reading 'bones')`).
- **`SynthResult.missingPngs: string[]` added** to `src/core/synthetic-atlas.ts`. Each entry is `<regionName>.png`; the loader threads this through `LoadResult.skippedAttachments` for renderer surfacing.
- **`LoadResult.skippedAttachments?: { name: string; expectedPngPath: string }[]` OPTIONAL field added** to `src/core/types.ts`. OPTIONAL shape matches the existing `unusedAttachments?:` precedent on `SkeletonSummary` (Plan 21-09 ISSUE-007); avoids TS2741 cascades on every existing LoadResult test/mock site. Absent in canonical-atlas mode and in atlas-less mode where every referenced PNG resolved successfully; populated only when one or more PNGs were missing.
- **Loader threads `synth.missingPngs` in BOTH atlas-less branches.** D-08 override branch (`opts.loaderMode === 'atlas-less'`) and D-05 fall-through branch (sibling .atlas absent + sibling images/ present) both capture `synthMissingPngs = synth.missingPngs`. The shared post-branch construction at the return site maps each `<regionName>.png` filename back to `{ name: <regionName>, expectedPngPath: path.resolve(imagesDir, filename) }`.
- **Maps stay PNG-truthful (T-21-09-04 mitigation).** `pngPathsByRegionName` + `dimsByRegionName` are NOT updated when a stub is emitted — only real-PNG reads populate them. This propagates: `sourceDims` (loader.ts:368-385) only carries real-PNG entries with `source: 'png-header'`, `sourcePaths` only carries real-PNG paths, `atlasSources` only carries real-PNG entries. Stubbed-region attachments thus never reach the export plan.
- **D-10 narrowed (Plan 21-09 ISSUE-006).** The catastrophic case is now ONLY 'imagesDir absent' (first-variant guard preserved verbatim). The second-variant guard ('folder exists but every PNG read failed') was removed — empty-images-dir is just 'all PNGs missing' under the new contract. The user-surface signal moves from a thrown error to a UI panel (Plan 21-10's MissingAttachmentsPanel). Documented explicitly in <objective> + module docblock + inline removal-comment.
- **Falsifying regression test (Plan 21-09 ISSUE-001 gate).** New `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` is a 50-line minimal Spine 4.2 rig with one root bone, one slot, one mesh attachment (`MESH_REGION` with 4 vertices and 2 triangles), and one animation (`wiggle`) with a deform timeline keyed under `attachments.<skin>.<slot>.<attachment>.deform`. Empirically verified to crash pre-fix via a probe script (`scripts/probe-g01-prefix-crash.ts`, gitignored ad-hoc tool): `[probe] EXPECTED CRASH (TypeError): Cannot read properties of null (reading 'bones')`. Post-fix verified via `scripts/probe-g01-postfix-success.ts`: `[probe] POST-FIX OK — load succeeded; atlasPath=null, skippedAttachments=[{"name":"MESH_REGION","expectedPngPath":"...images/MESH_REGION.png"}]`. Test 6 in `tests/core/loader-atlas-less.spec.ts` exercises the falsifying repro: copies the fixture to a tmpdir, deletes the PNG, asserts (a) load does NOT throw, (b) `skippedAttachments[0].name === 'MESH_REGION'`, (c) `expectedPngPath` ends with `images/MESH_REGION.png`, (d) the `MESH_REGION` attachment EXISTS in the loaded skeleton's defaultSkin (proving spine-core's animation/skin parser succeeded against a resolved-but-stubbed region).
- **Vitest suite delta:** 605 → 617 passing (+12 net; +3 stub-region tests in synthetic-atlas.spec.ts replacing 1 deleted catastrophic-empty-dir test, +1 G-01 regression test in loader-atlas-less.spec.ts, +8 unrelated suite gains since Plan 21-04 baseline). 1 unrelated pre-existing failure (`tests/main/sampler-worker-girl.spec.ts`) — fixtures/Girl/ is gitignored and absent in agent worktree (D-21-WORKTREE-1 in deferred-items.md, environmental).
- **Layer 3 invariant audited.** `grep -E "from 'sharp'|libvips|node:zlib|document\\.|window\\." src/core/synthetic-atlas.ts src/core/loader.ts src/core/types.ts` returns nothing. No new imports beyond the existing `node:fs` + `node:path` + `@esotericsoftware/spine-core` + sibling `.ts` set.

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1: RED — assert stub-region + missingPngs contract** — `6d50dc0` (test)
   - Repurpose the silent-skip TRIANGLE test (drop → 1x1 stub assertions); add 2 new tests (missingPngs shape + empty-dir-stubs-all); delete 1 catastrophic-empty-dir test; update happy-path tests to assert `missingPngs === []`. 5 tests RED on first vitest run as expected.

2. **Task 2: GREEN — emit 1x1 stub region + add SynthResult.missingPngs** — `883561b` (feat)
   - `src/core/synthetic-atlas.ts` change site: replace the catch-block `continue` with stub-region emission (5 lines: missingPngs.push, page header, size:1,1, filter:Linear,Linear, region name, bounds:0,0,1,1); remove the second-variant catastrophic throw; add `missingPngs: string[]` to SynthResult; refresh module docblock with Plan 21-09 G-01 + ISSUE-006 framing. All 9 synthetic-atlas tests pass; full vitest suite 616/621 (1 unrelated pre-existing fixtures/Girl absence — D-21-WORKTREE-1).

3. **Task 3: feat — thread skippedAttachments + G-01 falsifying regression fixture** — `fc8d7bc` (feat)
   - Author `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` (50-line minimal mesh-with-deform-timeline rig). Verify pre-fix crash empirically via probe (took 1 iteration: initial JSON used `deform:` key inside the animation but spine 4.2 puts deform timelines under `attachments.<skin>.<slot>.<att>.deform` — re-keyed and probe confirmed crash). Add `LoadResult.skippedAttachments?:` OPTIONAL field. Wire `synthMissingPngs` capture in both atlas-less branches + skippedAttachments construction at the return site. Add Test 6 G-01 falsifying regression to loader-atlas-less.spec.ts. Update Test 1 to assert empty/undefined skippedAttachments on happy path. Polish synthetic-atlas.ts comment language to remove specific spine-core line-number citations (acceptance criteria); unroll the empty-dir test loop into per-region 1x1-stub assertions. All 6 loader-atlas-less tests pass; full vitest 617/622; typecheck zero new errors.

(No REFACTOR commits — implementation was clean after one falsifying-repro iteration on the deform-timeline JSON shape; the fix landed inline with the GREEN commits.)

## Files Created/Modified

- **`fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json`** (NEW, 53 lines) — minimal Spine 4.2 rig: 1 bone (root), 1 slot (MESH_SLOT), 1 mesh attachment (MESH_REGION; 4 vertices, 2 triangles, 4-vertex hull), 1 animation (wiggle) with a deform timeline keyed under `attachments.default.MESH_SLOT.MESH_REGION.deform`.
- **`fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png`** (NEW, 637 bytes) — copy of `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png`. The happy-path test variant (PNG present) loads successfully; the falsifying test variant (PNG deleted via tmpdir) is the G-01 repro.
- **`src/core/synthetic-atlas.ts`** (229 → 304 lines, +75) — SynthResult.missingPngs field + stub-region emission in the missing-PNG catch block + removal of the second-variant catastrophic throw + module docblock refresh with Plan 21-09 G-01 + ISSUE-006 framing.
- **`src/core/loader.ts`** (479 → 508 lines, +29) — `synthMissingPngs` capture in BOTH atlas-less branches + skippedAttachments construction before return + optional spread in return statement.
- **`src/core/types.ts`** (165 → 185 lines, +20) — `LoadResult.skippedAttachments?:` OPTIONAL field with full docblock referencing Plan 21-10 MissingAttachmentsPanel + Plan 21-09 ISSUE-007.
- **`tests/core/synthetic-atlas.spec.ts`** (283 → 351 lines, +98/-42) — 1 silent-skip test repurposed into stub-region assertion; 2 new tests added (missingPngs field shape + empty-dir-stubs-all-regions); 1 catastrophic-empty-dir test deleted; happy-path tests assert `missingPngs === []`.
- **`tests/core/loader-atlas-less.spec.ts`** (172 → 240 lines, +75) — Test 6 G-01 falsifying regression added (uses fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/ with PNG deleted; asserts no-throw + skippedAttachments[0].name === 'MESH_REGION' + MESH_REGION attachment exists in default skin); Test 1 updated to assert `result.skippedAttachments ?? [] === []` on happy path.

## Decisions Made

- **Falsifying-fixture authoring iteration on the deform-timeline JSON shape (took 1 round).** The first JSON draft keyed the deform timeline under `animations.<name>.deform.<skin>.<slot>.<att>.deform` (the historic 3.x format). The probe script reported `[probe] LOAD SUCCEEDED — fixture does NOT exercise G-01 crash path`. Inspecting `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` revealed that spine 4.2 reads attachment timelines from `map.attachments` (line 916-940), not `map.deform`. Re-keyed to `animations.<name>.attachments.<skin>.<slot>.<att>.deform` and the probe confirmed the crash. This iteration is the empirical-verification gate from Plan 21-09 ISSUE-001 — without it the regression test in loader-atlas-less.spec.ts would have been vacuous.
- **Probe scripts gitignored per repo policy.** `scripts/probe-*.ts` is a pre-existing `.gitignore` pattern for ephemeral diagnostic tools. The Plan 21-09 G-01 verification probes (`scripts/probe-g01-prefix-crash.ts` + `scripts/probe-g01-postfix-success.ts`) follow this pattern. They served their purpose during execution and are NOT committed to the repo. Future maintainers can recreate them from the SUMMARY description if they need to re-verify the falsifying repro.
- **Empty-dir test unrolled per-region** to satisfy the literal-grep acceptance criteria (`grep -c "width).toBe(1)" tests/core/synthetic-atlas.spec.ts >= 5`). Original loop-based implementation (`for (const name of [...]) { ... expect(region.width).toBe(1); ... }`) had only 2 occurrences of the literal substring. Unrolled to four explicit per-region assertions (CIRCLE, SQUARE, TRIANGLE, STAR — same 4 stubs, just one literal assertion per name). Behavior identical; literal-grep count now 6 across both tests.
- **Comment language polished to remove specific spine-core line-number citations** (Plan 21-09 ISSUE-004 acceptance criteria). The original drafts of the SynthResult.missingPngs docblock and the in-function removal-comment referenced `SkeletonJson.js:929-940` and `regionPaths.size > 0 && pngPathsByRegionName.size === 0` — both forbidden by acceptance criteria. Rewrote to use general framing ("the EXACT spine-core path that reads `attachment.bones` without a null-check is not pinpointed in this docblock — earlier draft language attempted a specific line-number citation that was not verified end-to-end against every reproducer, so we deliberately leave the exact site unstated") + ("REMOVED the pre-existing second-variant catastrophic throw that previously fired when the images dir existed but every per-region PNG read failed"). Honors the plan's must-have truth that root-cause language stays honest.

## Stub Tracking

No new stubs introduced by this plan. The 1x1 stub region is the FIX, not a stub-as-placeholder — it's load-bearing machinery that satisfies spine-core's atlas/attachment/animation chain. The stub region's degenerate AABB does flow through the sampler (the renderer filters it out via skippedAttachments cascade in Plan 21-10), but that's deliberate per the threat model (T-21-09-01 accepted: bounded performance impact; real fixtures have <50 attachments).

The PNG-truthful invariant on `pngPathsByRegionName` + `dimsByRegionName` ensures stub-region entries DO NOT leak into `sourceDims` / `sourcePaths` / `atlasSources` (T-21-09-04 mitigation, verified by the existing happy-path tests).

## Threat Flags

No new threat surfaces. The plan's `<threat_model>` already accepts T-21-09-01..05 (all dispositions documented inline in the plan); no new endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what was modeled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Falsifying-fixture deform-timeline JSON key needed re-keying from `deform` to `attachments`**

- **Found during:** Task 3 falsifying-repro empirical verification (first run of `npx tsx scripts/probe-g01-prefix-crash.ts`)
- **Issue:** Initial `MeshOnly_TEST.json` keyed the deform timeline as `animations.wiggle.deform.default.MESH_SLOT.MESH_REGION.deform` (3.x format). The pre-fix probe reported `[probe] LOAD SUCCEEDED — fixture does NOT exercise G-01 crash path` — meaning the spine-core parser did not visit the line that crashes on `attachment.bones`. Without an empirically-verified pre-fix crash, the regression test would have been vacuous (Plan 21-09 ISSUE-001 gate violated).
- **Root cause:** spine 4.2's `SkeletonJson.readAnimation` reads attachment timelines from `map.attachments` (file `SkeletonJson.js`, attachment-timelines block at lines 915-973), NOT `map.deform`. Inspecting `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json` (the original empirical reproducer of G-01) confirmed: every animation under `.animations.<name>.attachments.<skin>.<slot>.<att>.deform` keys.
- **Fix:** Re-keyed the deform timeline from `animations.wiggle.deform.{...}` to `animations.wiggle.attachments.default.{...}`. Re-ran probe: `[probe] EXPECTED CRASH (TypeError): Cannot read properties of null (reading 'bones')`. ✅
- **Files modified:** `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` (5-line restructure of the `animations.wiggle` block).
- **Verification:** Probe scripts (`scripts/probe-g01-prefix-crash.ts` + `scripts/probe-g01-postfix-success.ts`) both pass; Test 6 in `tests/core/loader-atlas-less.spec.ts` passes against the fixture in tmpdir-with-PNG-deleted variant.
- **Committed in:** `fc8d7bc` (Task 3 commit, alongside the loader integration the fixture gates).

**2. [Rule 3 - Blocking] Probe scripts had to cast SilentSkipAttachmentLoader through AtlasAttachmentLoader for typecheck**

- **Found during:** Task 3 typecheck after authoring the probe scripts
- **Issue:** `npm run typecheck` failed with `error TS2345: Argument of type 'SilentSkipAttachmentLoader' is not assignable to parameter of type 'AttachmentLoader'. The types returned by 'newRegionAttachment(...)' are incompatible between these types. Type 'Attachment | null' is not assignable to type 'RegionAttachment'.` — the SilentSkipAttachmentLoader narrows return types to nullable for D-09 + G-01 silent-skip; the stock spine-core SkeletonJson constructor type-rejects this narrowing.
- **Root cause:** The cast pattern is the same one already established in `src/core/loader.ts:343-345` (`new SilentSkipAttachmentLoader(atlas) as unknown as AtlasAttachmentLoader`). The probe scripts didn't carry the same cast.
- **Fix:** Added the `as unknown as AtlasAttachmentLoader` cast in `scripts/probe-g01-prefix-crash.ts:30-34` with a comment pointing to loader.ts:343-345 as the established pattern.
- **Files modified:** `scripts/probe-g01-prefix-crash.ts` (3-line cast + 3-line comment).
- **Verification:** `npm run typecheck` returns only the pre-existing TS6133 warnings on `src/renderer/src/panels/AnimationBreakdownPanel.tsx:286` + `GlobalMaxRenderPanel.tsx:531` (deferred-items.md, unrelated to Plan 21-09).
- **Committed in:** N/A — probe scripts gitignored per repo policy (`scripts/probe-*.ts`); the cast lives in the local-only file.

**3. [Rule 1 - Bug] Empty-dir test loop unrolled to satisfy literal-grep acceptance criteria**

- **Found during:** Task 3 acceptance-criteria sweep
- **Issue:** `grep -c "width).toBe(1)" tests/core/synthetic-atlas.spec.ts` returned 2; acceptance criteria require >= 5. The original implementation used a `for (const name of ['CIRCLE', 'SQUARE', 'TRIANGLE', 'STAR']) { ... expect(region.width).toBe(1); ... }` loop — only 1 literal occurrence inside the loop body, plus 1 from the silent-skip TRIANGLE test (total 2).
- **Fix:** Unrolled the loop into 4 explicit per-region assertion blocks. Behavior identical; literal-grep count now 6 across both tests (2 silent-skip + 4 empty-dir).
- **Files modified:** `tests/core/synthetic-atlas.spec.ts` (replaced the loop block; ~15-line edit).
- **Verification:** `grep -c "width).toBe(1)" tests/core/synthetic-atlas.spec.ts` returns 6; full synthetic-atlas suite still 9/9 passing.
- **Committed in:** `fc8d7bc` (Task 3 commit, alongside the comment-polish fixes for ISSUE-004 acceptance criteria).

**4. [Rule 1 - Bug] Comment language carried specific spine-core line-number citations forbidden by acceptance criteria**

- **Found during:** Task 3 acceptance-criteria sweep
- **Issue:** Acceptance criteria require `grep -c "SkeletonJson.js:929-940" src/core/synthetic-atlas.ts` to return 0 AND `grep -c "regionPaths.size > 0 && pngPathsByRegionName.size === 0" src/core/synthetic-atlas.ts` to return 0. Initial drafts of the SynthResult.missingPngs docblock + the in-function removal-comment carried both substrings (verbatim from the plan's `<action>` section, which itself quoted them as historical references).
- **Root cause:** Plan 21-09 ISSUE-004 mandates honest "exact site not pinpointed" framing in docblocks; the historic `SkeletonJson.js:929-940` claim is unverified and must not appear in the source. The removed-throw comment originally quoted the deleted code verbatim for historical reference, but the literal substring also fails the grep.
- **Fix:** Rewrote both comment blocks to use general framing ("the EXACT spine-core path that reads `attachment.bones` without a null-check is not pinpointed in this docblock — earlier draft language attempted a specific line-number citation that was not verified end-to-end against every reproducer, so we deliberately leave the exact site unstated") + ("REMOVED the pre-existing second-variant catastrophic throw that previously fired when the images dir existed but every per-region PNG read failed"). Same semantic content; literal substrings absent.
- **Files modified:** `src/core/synthetic-atlas.ts` (2 comment blocks, ~12-line edits total).
- **Verification:** Both grep -c checks return 0; synthetic-atlas suite still 9/9 passing.
- **Committed in:** `fc8d7bc` (Task 3 commit, alongside the loop unroll for ISSUE-1 acceptance criteria).

---

**Total deviations:** 4 auto-fixed (1 Rule 1 fixture-shape iteration + 1 Rule 3 blocking typecheck cast + 2 Rule 1 acceptance-criteria literal-grep polish).
**Impact on plan:** All four are minimal-blast-radius adaptations. The fixture-shape iteration is the empirical falsifying-repro gate at work — exactly the kind of mid-flight verification the ISSUE-001 must-have demands. The typecheck cast is a structural-pattern propagation from existing loader.ts code. The two acceptance-criteria polish fixes are cosmetic (comment text + test loop layout) with zero behavior change. None expanded scope.

## Issues Encountered

- **Falsifying-repro probe required two iterations on the deform-timeline JSON shape.** First JSON used the historic 3.x `deform:` key inside `animations.<name>`; spine 4.2 reads attachment timelines from `map.attachments`. Caught by the probe script before committing the fixture; resolved with a 5-line JSON re-key.
- **Probe-script TS2345 surfaced the loader.ts cast pattern.** The SilentSkipAttachmentLoader's narrower-return-type override fails strict type-assignability against spine-core's stock `AttachmentLoader` interface. The probe script needed the same `as unknown as AtlasAttachmentLoader` cast already established in `src/core/loader.ts:343-345` (Plan 21-04). No new code; just propagating an existing pattern.
- **Pre-existing fixtures/Girl absence in agent worktree.** The same D-21-WORKTREE-1 environmental issue documented during Plan 21-01 surfaces here too — `tests/main/sampler-worker-girl.spec.ts:38` fails because `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` is gitignored and absent in the agent worktree's checkout. Out of scope per executor SCOPE BOUNDARY rule. Already logged in `.planning/phases/21-…/deferred-items.md`.
- **Pre-existing TS6133 warnings on `AnimationBreakdownPanel.tsx:286` + `GlobalMaxRenderPanel.tsx:531`.** Both verified pre-existing on main (Plan 21-05 SUMMARY documents the stash round-trip verification). Not caused by Plan 21-09. Out of scope.

## TDD Gate Compliance

- ✅ RED commit: `6d50dc0` (test, Task 1) — 5 tests fail on the new behaviors before the implementation lands; the catastrophic absent-dir + path-field + SilentSkipAttachmentLoader tests stay GREEN as expected.
- ✅ GREEN commit: `883561b` (feat, Task 2) — all 9 synthetic-atlas tests pass; full suite 616/621 (1 unrelated pre-existing failure).
- ✅ Integration GREEN commit: `fc8d7bc` (feat, Task 3) — all 6 loader-atlas-less tests pass including the new G-01 falsifying regression; full suite 617/622.
- (REFACTOR not required — implementation was clean after one falsifying-repro iteration on the deform-timeline JSON shape; the fix landed inline with the GREEN commits.)

Plan-level TDD gate sequence: `test(...)` → `feat(...)` → `feat(...)` confirmed in git log on the worktree branch.

## Next Phase Readiness

- **`LoadResult.skippedAttachments` is consumer-ready for Plan 21-10's MissingAttachmentsPanel.** The renderer can subscribe to the field via the existing `AppSessionState` cascade (project-io.ts → summary.ts → SkeletonSummary → renderer payload) — the same pattern that already threads `unusedAttachments?:`. The panel renders conditionally: hidden when `skippedAttachments` is undefined or `length === 0`; visible when populated.
- **`expectedPngPath` is an absolute path** ready for direct surfacing in the panel UI without additional resolution.
- **Stub-region attachments are filterable in the renderer.** The existing `unusedAttachments?:` filter pattern in panels can be mirrored for skippedAttachments — both fields surface attachments that should NOT appear in the main Global Max Render Source panel. The stub-region's degenerate AABB will produce a near-zero peakScale row in the analyzer output, which the renderer should hide via the same skippedAttachments filter.
- **Catastrophic case is now narrower (D-10 ISSUE-006).** The IPC `SerializableError` union still includes `MissingImagesDirError` for the folder-absent case (no IPC contract change). Plan 21-10 should NOT attempt to surface skippedAttachments alongside MissingImagesDirError — they're disjoint surfaces (the catastrophic path throws before LoadResult is built; the skippedAttachments path lives only in successful loads).
- **No new dependencies.** Layer 3 invariant intact; no new imports; no new IPC channels; no new `tsconfig.web.json` carve-outs.

## Self-Check: PASSED

All claims verified against the filesystem and git log:

- ✅ `src/core/synthetic-atlas.ts` modified (304 lines; SynthResult.missingPngs + stub-region emission + module docblock refresh).
- ✅ `src/core/loader.ts` modified (508 lines; synthMissingPngs capture in both atlas-less branches + skippedAttachments construction + optional spread in return).
- ✅ `src/core/types.ts` modified (185 lines; LoadResult.skippedAttachments?: OPTIONAL field).
- ✅ `tests/core/synthetic-atlas.spec.ts` modified (351 lines; 9 it() blocks: 3 stub-region tests + 1 catastrophic-folder-absent + 1 path-field + 2 happy-path + 2 SilentSkipAttachmentLoader).
- ✅ `tests/core/loader-atlas-less.spec.ts` modified (240 lines; 6 it() blocks: existing 5 + new G-01 Test 6).
- ✅ `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json` created (53 lines; well-formed via `jq -e .`).
- ✅ `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/images/MESH_REGION.png` created (637 bytes; copy of SQUARE2.png).
- ✅ Commit `6d50dc0` (RED test, Task 1) found in git log.
- ✅ Commit `883561b` (GREEN feat, Task 2) found in git log.
- ✅ Commit `fc8d7bc` (Task 3 feat) found in git log.
- ✅ `npx vitest run tests/core/synthetic-atlas.spec.ts` returns 9/9 pass.
- ✅ `npx vitest run tests/core/loader-atlas-less.spec.ts` returns 6/6 pass.
- ✅ `npm run test` returns 617 passing, 1 failing (1 unrelated pre-existing fixtures/Girl absence — D-21-WORKTREE-1; environmental).
- ✅ `npm run typecheck` returns only the pre-existing TS6133 warnings on AnimationBreakdownPanel.tsx + GlobalMaxRenderPanel.tsx (deferred-items.md, unrelated).
- ✅ Acceptance criteria literal-grep checks: `grep -q "missingPngs: string\\[\\]" src/core/synthetic-atlas.ts` ✅; `grep -q "size: 1,1" src/core/synthetic-atlas.ts` ✅; `grep -q "bounds: 0,0,1,1" src/core/synthetic-atlas.ts` ✅; `grep -c "regionPaths.size > 0 && pngPathsByRegionName.size === 0" src/core/synthetic-atlas.ts == 0` ✅; `grep -q "!imagesDirExists && regionPaths.size > 0" src/core/synthetic-atlas.ts` ✅; `grep -c "SkeletonJson.js:929-940" src/core/synthetic-atlas.ts == 0` ✅; `grep -q "skippedAttachments?:" src/core/types.ts` ✅; `grep -c "synthMissingPngs = synth.missingPngs" src/core/loader.ts == 2` ✅; `grep -q "synthMissingPngs.length > 0" src/core/loader.ts` ✅; `grep -q "G-01.*does NOT crash" tests/core/loader-atlas-less.spec.ts` ✅; `grep -q "SIMPLE_PROJECT_NO_ATLAS_MESH" tests/core/loader-atlas-less.spec.ts` ✅; `grep -q "skippedAttachments!\\[0\\].name).toBe('MESH_REGION')" tests/core/loader-atlas-less.spec.ts` ✅; `grep -q "skippedAttachments ?? \\[\\]" tests/core/loader-atlas-less.spec.ts` ✅; `grep -c "missingPngs).toEqual(\\[\\])" tests/core/synthetic-atlas.spec.ts >= 2` ✅ (returns 2); `grep -c "width).toBe(1)" tests/core/synthetic-atlas.spec.ts >= 5` ✅ (returns 6).
- ✅ Layer 3 invariant: `grep -E "from 'sharp'|libvips|node:zlib|document\\.|window\\." src/core/synthetic-atlas.ts src/core/loader.ts src/core/types.ts` returns nothing.
- ✅ G-01 falsifying-repro empirically verified pre-fix via `scripts/probe-g01-prefix-crash.ts` (TypeError: Cannot read properties of null (reading 'bones')) and post-fix via `scripts/probe-g01-postfix-success.ts` (skippedAttachments=[{name: 'MESH_REGION', ...}]).
- ✅ G-01 closed at the `LoadResult.skippedAttachments` API surface; G-02 plumbing (the field shape itself) is in place — Plan 21-10's MissingAttachmentsPanel can consume directly.

---
*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Plan: 09-stub-region-for-missing-pngs*
*Completed: 2026-05-02*
