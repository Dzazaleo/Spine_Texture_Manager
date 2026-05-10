---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 06
subsystem: loader
tags: [loader, integration, branch-order, atlas-less, atlas-not-found-preservation, load-01]

# Dependency graph
requires:
  - phase: 21
    plan: 01
    provides: readPngDims (PNG IHDR byte parser)
  - phase: 21
    plan: 02
    provides: MissingImagesDirError typed error class + IPC kind routing
  - phase: 21
    plan: 04
    provides: synthesizeAtlasText + SilentSkipAttachmentLoader
  - phase: 21
    plan: 05
    provides: LoaderOptions.loaderMode + LoadResult.atlasPath nullable + SourceDims +'png-header'
provides:
  - "loadSkeleton 4-way branch (D-05/D-06/D-07/D-08) wired in src/core/loader.ts"
  - "Atlas-less mode user-visible — sibling .atlas absent + images/ folder present → synthesis fall-through; LoadResult.atlasPath: null"
  - "loaderMode='atlas-less' override path — bypass sibling .atlas even when present"
  - "ROADMAP success criterion #5 locked by 4 regression tests in tests/core/loader.spec.ts"
affects:
  - "Phase 21 Plan 07 (.stmproj loaderMode plumbing) — consumes the working LoadResult contract"
  - "Phase 21 Plan 08 (round-trip integration tests) — consumes the wired 4-way branch"
  - "Phase 22 SEED-002 (dims-badge override-cap) — consumes sourceDims with source='png-header' provenance"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-way branch with strict order — opts.atlasPath check FIRST (D-06 explicit-intent), loaderMode override SECOND (D-08 force-atlas-less), sibling-readable probe THIRD (D-07 atlas-by-default), fall-through with malformed-project-guard FOURTH (D-05)"
    - "Inline branch bodies (no closure-over-let) — TypeScript flow analysis cannot track let-assignments through arrow-function closures, so each branch assigns atlas/resolvedAtlasPath/isAtlasLess directly"
    - "Malformed-project guard at D-05 entry — sibling .atlas absent + images/ folder absent → throw AtlasNotFoundError verbatim (preserves ROADMAP success criterion #5; keeps pre-Phase-21 F1.4 tests green)"
    - "AttachmentLoader cast at SkeletonJson construction — SilentSkipAttachmentLoader's narrower-return-type override (Attachment | null vs stock RegionAttachment) requires `as unknown as AtlasAttachmentLoader` to satisfy SkeletonJson's typed signature (Plan 21-04 SUMMARY documents the @ts-expect-error directives on the override methods)"

key-files:
  created: []
  modified:
    - "src/core/loader.ts (4-way branch + atlas-less synthesis branch + downstream map handling for sourceDims/sourcePaths/atlasSources in atlas-less mode + LoadResult.atlasPath null return)"
    - "tests/core/loader.spec.ts (new Phase 21 describe block with 4 D-0X regression tests)"

key-decisions:
  - "Restructured from helper-closures (synthesizeNow + loadCanonical lambdas closing over outer let-variables) to inline-per-branch bodies. Closures broke TypeScript's flow analysis (variables-before-assigned + never-narrowed types). Inlining each branch makes assignment provability local to each path."
  - "Added malformed-project guard inside D-05 fall-through: if neither sibling .atlas NOR images/ folder exists, throw AtlasNotFoundError verbatim instead of letting synthesizeAtlasText return an empty atlas. Without this guard, pre-existing F1.4 tests fail (they construct minimal-JSON tmpdirs with no images/ folder; the loader silently succeeded with an empty synthesized atlas instead of throwing). Preserves ROADMAP success criterion #5."
  - "AttachmentLoader cast through `as unknown as AtlasAttachmentLoader` rather than widening the SilentSkipAttachmentLoader signature OR the SkeletonJson constructor. The cast localizes the variance to a single line in loader.ts; SkeletonJson handles null returns gracefully at runtime per spine-core source (SkeletonJson.js:371-372, 404-405)."

patterns-established:
  - "4-way branch order in atlas resolution: explicit-atlasPath → forced-atlas-less → sibling-readable → fall-through-with-malformed-guard. Each branch assigns atlas/resolvedAtlasPath/isAtlasLess inline; downstream maps key off isAtlasLess to populate from atlas.regions OR synth maps."
  - "Malformed-project guard pattern at fall-through entry: probe images/ existence; if absent and would synthesize, throw legacy error (AtlasNotFoundError) verbatim. Maintains backward-compat for clients that depend on the historical error shape."

requirements-completed: [LOAD-01]

# Metrics
duration: ~5min
completed: 2026-05-01
---

# Phase 21 Plan 06: Loader Integration Summary

**4-way atlas-resolution branch wired into `src/core/loader.ts` per D-05/D-06/D-07/D-08 — atlas-less synthesis path is now user-visible; LOAD-01 closed; ROADMAP success criterion #5 (AtlasNotFoundError verbatim) locked by regression test.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-01T23:15:42Z (post worktree-base reset)
- **Completed:** 2026-05-01T23:20:58Z
- **Tasks:** 2 (RED test + GREEN implementation)
- **Files modified:** 2 (src/core/loader.ts +163/-64 net; tests/core/loader.spec.ts +122/-0)

## Accomplishments

- **4-way branch order wired into `loadSkeleton` per RESEARCH.md §Pitfall 9.** Branch sequence (load-bearing — verified by `awk` linenum check): (1) `opts.atlasPath !== undefined` → canonical (D-06; throw verbatim AtlasNotFoundError on read fail, NO fall-through); (2) `opts.loaderMode === 'atlas-less'` → synthesize (D-08; skip .atlas read entirely); (3) sibling `.atlas` readable → canonical (D-07; atlas-by-default); (4) sibling `.atlas` unreadable → synthesize fall-through (D-05) — gated by images/ folder existence to preserve the malformed-project AtlasNotFoundError contract.
- **Atlas-less synthesis branches call `synthesizeAtlasText` (Plan 21-04) + wrap AttachmentLoader in `SilentSkipAttachmentLoader`** for D-09 silent-skip. Downstream sourceDims map populates from `synth.dimsByRegionName` with `source: 'png-header'` (D-15); sourcePaths map populates from `synth.pngPathsByRegionName` directly (D-16); atlasSources map populates with `pagePath = per-region PNG`, `x=y=0`, `rotated=false` (D-17).
- **`LoadResult.atlasPath: null` in atlas-less mode (D-03).** Type contract was widened in Plan 21-05; this plan ratifies it at the runtime site.
- **ROADMAP success criterion #5 preserved by malformed-project guard.** When neither sibling `.atlas` NOR `images/` folder exists at fall-through entry, the loader throws `AtlasNotFoundError` verbatim — matching pre-Phase-21 behavior. Pre-existing `F1.4` tests in `tests/core/loader.spec.ts` (lines 75-150, four tests asserting AtlasNotFoundError on minimal-JSON tmpdirs without images/) remain green.
- **4 new regression tests appended** to `tests/core/loader.spec.ts` covering D-05/D-06/D-07/D-08:
  - D-06: explicit `opts.atlasPath` unreadable → `AtlasNotFoundError` verbatim message preserved (including "Spine projects require an .atlas file beside the .json" + "Re-export from the Spine editor with the atlas included" + typed `searchedPath`/`skeletonPath` fields).
  - D-05: sibling `.atlas` absent + valid images/ folder (using `fixtures/SIMPLE_PROJECT_NO_ATLAS/`) → `result.atlasPath === null`; `sourceDims` has ≥3 entries with `source === 'png-header'`.
  - D-07: canonical `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → `result.atlasPath !== null`; ends with `.atlas`; all `sourceDims.source` matches `/^atlas-(orig|bounds)$/`.
  - D-08: tmpdir with both sibling `.atlas` AND images/ folder, loaded with `loaderMode: 'atlas-less'` → `result.atlasPath === null`; ≥3 `sourceDims` entries with `source === 'png-header'` (proves synthesis path was taken even though .atlas existed).
- **Vitest suite delta:** 605 → 609 passing (+4 new D-0X tests; canonical-mode tests unchanged; no regressions). Even pre-existing-failing `tests/main/sampler-worker-girl.spec.ts` is now green in this worktree (the user's `fixtures/Girl copy/` directory is on disk).
- **Typecheck delta:** 0 new errors caused by this plan. Only pre-existing `scripts/probe-per-anim.ts(14,31)` TS2339 remains (verified pre-existing in Plans 21-04/21-05 SUMMARY).

## Branch Order Verification

Per the executor's `<parallel_execution>` block — D-05/D-06/D-08 branch order is load-bearing. Verified via grep + line-number check:

```
$ grep -c "D-0[5-8]" src/core/loader.ts
12

$ awk '/opts.atlasPath !== undefined/{a=NR} /opts.loaderMode === .atlas-less./{b=NR} END {print a, b}' src/core/loader.ts
214 236
```

`opts.atlasPath !== undefined` check (line 214) precedes `opts.loaderMode === 'atlas-less'` check (line 236) — branch order matches the mandate.

## AtlasNotFoundError Verbatim Message Survival

Per ROADMAP success criterion #5 — preserved verbatim across the change:

```
$ grep -q "Spine projects require an .atlas file beside the .json" src/core/errors.ts && echo OK
OK

$ grep -q "Spine projects require an .atlas file beside the .json" tests/core/loader.spec.ts && echo OK
OK
```

`tests/core/loader.spec.ts` D-06 test at line 252 explicitly asserts:
```typescript
expect(err.message).toContain('Spine projects require an .atlas file beside the .json');
expect(err.message).toContain('Re-export from the Spine editor with the atlas included');
```

Three `throw new AtlasNotFoundError(...)` sites in the loader:
1. D-06 explicit-atlasPath read fail.
2. D-07 sibling-readable race-fallback (probe succeeded but second read failed).
3. D-05 malformed-project guard (no atlas + no images/ folder).

All three preserve the verbatim message — the constructor in `src/core/errors.ts:44-47` is the single source of truth.

## Test Outcomes (4 New Tests + 11 Pre-existing)

| Test | Status | Branch Exercised |
|------|--------|------------------|
| D-06: explicit unreadable atlasPath → AtlasNotFoundError verbatim | PASS | (1) opts.atlasPath defined |
| D-05: no atlas + valid images/ → atlasPath: null + png-header dims | PASS | (4) fall-through synthesize |
| D-07: sibling .atlas readable → canonical (atlas-* dims) | PASS | (3) sibling-readable |
| D-08: loaderMode='atlas-less' override skips real .atlas | PASS | (2) forced-atlas-less |
| F1.1+F1.2 (canonical fixture loads) | PASS | (3) sibling-readable |
| F2.7 priority 1 (atlas-bounds provenance) | PASS | (3) sibling-readable |
| F1.4 (missing JSON → SkeletonJsonNotFoundError) | PASS | n/a (earlier branch) |
| F1.4 (no atlas + no images → AtlasNotFoundError) | PASS | (4) malformed-project guard |
| F1.4 (AtlasNotFoundError carries skeletonPath) | PASS | (4) malformed-project guard |
| Gap-Fix Round 2 Bug #5 (verbatim message) | PASS | (4) malformed-project guard |
| Plan 06-02 sourcePaths SIMPLE_TEST | PASS | (3) sibling-readable |
| EXPORT_PROJECT sourcePaths existence | PASS | (3) sibling-readable |
| Gap-Fix #2 atlasSources SIMPLE_TEST | PASS | (3) sibling-readable |
| Jokerman atlas-packed (skipped if absent) | PASS | (3) sibling-readable |
| atlasSources rotated flag (zero rotated regions) | PASS | (3) sibling-readable |

15/15 loader tests pass. Branches (1) explicit-atlasPath, (2) forced-atlas-less, (3) sibling-readable, and (4) fall-through (both synthesize and malformed-guard variants) are exercised by the test set.

## Task Commits

Each task committed atomically (`--no-verify` per parallel-executor protocol):

1. **Task 1: RED — D-05/D-06/D-07/D-08 regression tests** — `fa1a0e2` (test)
   - 4 new tests authored; D-05/D-08 RED before implementation; D-06/D-07 GREEN (existing canonical behavior already covered them).
2. **Task 2: GREEN — 4-way branch + atlas-less synthesis wiring** — `98b65b4` (feat)
   - Inlined branch bodies; AttachmentLoader cast for SilentSkipAttachmentLoader variance; malformed-project guard preserves AtlasNotFoundError verbatim. All 15 loader tests pass; full vitest suite 609 passing; typecheck clean except pre-existing.

(No REFACTOR commit — implementation was clean after the inline restructure resolved TypeScript flow-analysis issues; the restructure landed inline with the GREEN commit.)

## Files Created/Modified

- `src/core/loader.ts` (MODIFIED, +163/-64 net lines) — Imports widened to include `synthesizeAtlasText` + `SilentSkipAttachmentLoader`. The 1-way atlas read at lines 179-214 became a 4-way branch. Downstream sourceDims/sourcePaths/atlasSources map construction branches on `isAtlasLess`. Return statement uses `resolvedAtlasPath` (string | null per D-03).
- `tests/core/loader.spec.ts` (MODIFIED, +122 lines) — New `describe('Phase 21 — atlas-less mode (LOAD-01 + ROADMAP success criterion #5)')` block with 4 tests.

## Decisions Made

- **Restructured from helper-closures to inline-per-branch.** First implementation used `synthesizeNow()` + `loadCanonical(path)` arrow-function closures over outer `let` variables (`atlas`, `resolvedAtlasPath`, `isAtlasLess`). TypeScript's flow analysis cannot track let-assignments through closures, so the variables were flagged as `used before assigned` and `synthDims/synthSourcePaths` narrowed to `never` after the post-branch null check. Solution: inline each branch's body so each path's assignments are visible to flow analysis. Adds ~50 LOC of duplication (the canonical-load body + synthesize body each appear twice — once in their own branch, once in the sibling-readable / fall-through arms) but eliminates the type errors.
- **Malformed-project guard at D-05 fall-through entry.** Without this guard, the pre-existing F1.4 tests in `tests/core/loader.spec.ts` (lines 75-150) failed: they construct minimal-JSON tmpdirs with no images/ folder; the loader silently synthesized an empty atlas instead of throwing AtlasNotFoundError. The plan didn't mandate this guard, but ROADMAP success criterion #5 demands the legacy AtlasNotFoundError shape for malformed-project cases. Added a `fs.statSync` probe of images/ at fall-through entry; if absent, throw verbatim AtlasNotFoundError. This is a Rule 1 / Rule 2 deviation (auto-fix bug + missing critical functionality — the original implementation broke existing test contracts).
- **AttachmentLoader cast through `as unknown as AtlasAttachmentLoader`.** SilentSkipAttachmentLoader narrows the return type of `newRegionAttachment` / `newMeshAttachment` from non-nullable to nullable (Plan 21-04 documented `@ts-expect-error` on the overrides). When passed to `new SkeletonJson(...)`, TypeScript flagged the variance because `AttachmentLoader.newRegionAttachment` is declared non-nullable. Two options: (a) extend AttachmentLoader's type, (b) cast at the SkeletonJson site. Chose (b) — minimum-blast-radius; the runtime safety is proven by spine-core source (SkeletonJson.js:371-372, 404-405 handle null returns gracefully) and Plan 21-04's invariant tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 + Rule 2 — Malformed-project guard] Added images/ existence check at D-05 fall-through entry**

- **Found during:** Task 2 GREEN verification (first vitest run after the 4-way branch wired in)
- **Issue:** Pre-existing tests `F1.4: throws AtlasNotFoundError when sibling .atlas is absent` + 2 sibling tests (lines 75-150) failed with `expected undefined to be an instance of AtlasNotFoundError`. Root cause: those tests construct tmpdirs with a minimal JSON `{"skeleton":{"spine":"4.2.43"}}` (no skins, no images/ folder). With the new D-05 fall-through, the loader called `synthesizeAtlasText` → `regionPaths.size === 0` (no skins to walk) → returned an empty atlas text → `new TextureAtlas('')` succeeded → `LoadResult` returned without throwing.
- **Fix:** Added a probe for images/ folder existence at D-05 fall-through entry. If `siblingAtlasPath` is unreadable AND images/ folder is absent, throw `AtlasNotFoundError(siblingAtlasPath, skeletonPath)` verbatim. Preserves ROADMAP success criterion #5 (the legacy "no atlas, no images" malformed-project signal) and keeps F1.4 tests green.
- **Files modified:** `src/core/loader.ts` (added ~12 lines for the probe + throw, with explanatory comment).
- **Verification:** `npx vitest run tests/core/loader.spec.ts` 15/15 pass (4 new + 11 existing).
- **Committed in:** `98b65b4` (Task 2 commit, alongside the 4-way branch wiring).

**2. [Rule 3 — Blocking] Restructured branch bodies from closures to inline blocks**

- **Found during:** Task 2 GREEN typecheck (first `npm run typecheck` run after the 4-way branch wired in)
- **Issue:** Initial implementation used `const synthesizeNow = () => { ... }` and `const loadCanonical = (p) => { ... }` arrow closures that wrote to outer `let` variables (`atlas`, `resolvedAtlasPath`, `isAtlasLess`). TypeScript flagged 4 `error TS2454: Variable 'isAtlasLess' is used before being assigned` + `error TS2454: Variable 'resolvedAtlasPath' is used before being assigned` + `error TS2488: Type 'never' must have a '[Symbol.iterator]()'` for `synthDims`/`synthSourcePaths` (narrowed to `never` after the closure-write).
- **Fix:** Inlined each branch's body — `(opts.atlasPath !== undefined)` branch writes to atlas/resolvedAtlasPath/isAtlasLess directly; `(opts.loaderMode === 'atlas-less')` branch likewise; the sibling-readable arm of the fall-through branch likewise; the synthesize arm of the fall-through branch likewise. Adds ~50 LOC of code duplication (canonical-load body x2, synthesize body x2) but each branch's assignments are now provable by TypeScript flow analysis.
- **Files modified:** `src/core/loader.ts` (the closure-based draft was never committed).
- **Verification:** `npm run typecheck` reports only the pre-existing `scripts/probe-per-anim.ts` TS2339 error.
- **Committed in:** `98b65b4` (Task 2 commit — the inline structure is what landed).

**3. [Rule 3 — Blocking] AttachmentLoader cast for SilentSkipAttachmentLoader variance**

- **Found during:** Task 2 GREEN typecheck
- **Issue:** `new SkeletonJson(new SilentSkipAttachmentLoader(atlas))` flagged with `error TS2345: Argument of type 'SilentSkipAttachmentLoader | AtlasAttachmentLoader' is not assignable to parameter of type 'AttachmentLoader'. Type 'SilentSkipAttachmentLoader' is not assignable to type 'AttachmentLoader'. The types returned by 'newRegionAttachment(...)' are incompatible — Type 'Attachment | null' is not assignable to type 'RegionAttachment'`. This is the same variance Plan 21-04 documented with `@ts-expect-error` directives on the override signatures themselves; it surfaces again at the SkeletonJson construction site.
- **Fix:** Cast `new SilentSkipAttachmentLoader(atlas) as unknown as AtlasAttachmentLoader`. Localizes the variance to one line; runtime safety is proven by spine-core's `SkeletonJson.readAttachment` handling null returns gracefully (SkeletonJson.js:371-372, 404-405).
- **Files modified:** `src/core/loader.ts` (the cast was added inline with the inline-branch restructure).
- **Verification:** `npm run typecheck` clean.
- **Committed in:** `98b65b4` (Task 2 commit).

---

**Total deviations:** 3 auto-fixed (1 Rule 1/2 — malformed-project guard preserving ROADMAP success criterion #5; 2 Rule 3 — blocking TypeScript issues). All three are minimal-blast-radius adaptations.

**Impact on plan:** The plan's `must_haves.truths` block stated:

> loadSkeleton with explicit opts.atlasPath that's unreadable still throws AtlasNotFoundError verbatim (D-06; ROADMAP success criterion #5)

This is preserved exactly. The plan didn't explicitly call out the related malformed-project case (no atlas + no images), but ROADMAP success criterion #5 demands the legacy AtlasNotFoundError shape for it; the malformed-project guard preserves this contract and keeps pre-Phase-21 tests green. No scope creep.

## Issues Encountered

- **Pre-existing TS2339 in `scripts/probe-per-anim.ts:14`** — verified pre-existing in Plan 21-04 SUMMARY (line 148). Out of scope per executor SCOPE BOUNDARY rule. Logged previously to `.planning/phases/21-.../deferred-items.md`.
- **TypeScript flow analysis cannot track let-writes through arrow-function closures.** Cost ~5 minutes of restructure. Mentally noted for future loader/synthesizer extensions: prefer inline-per-branch over helper-closures when each branch must write to the same outer variables.

## TDD Gate Compliance

- ✅ RED commit: `fa1a0e2` (test, Task 1) — D-05 + D-08 verified failing before implementation; D-06 + D-07 already green (existing canonical behavior covers them).
- ✅ GREEN commit: `98b65b4` (feat, Task 2) — all 4 D-0X tests pass + 11 pre-existing loader tests pass + full vitest suite 609 passing + typecheck clean except pre-existing.
- (REFACTOR not required — clean after the inline restructure landed inline with the GREEN commit.)

Plan-level TDD gate sequence: `test(...)` → `feat(...)` confirmed in git log on the worktree branch.

## Next Phase Readiness

- **Plan 21-07 (.stmproj loaderMode plumbing) is unblocked.** The loader honors `opts.loaderMode === 'atlas-less'` per D-08; the project-file plumbing can now thread the field from the .stmproj through to `loadSkeleton(skelPath, { loaderMode })`.
- **Plan 21-08 (round-trip integration tests) is unblocked.** `fixtures/SIMPLE_PROJECT_NO_ATLAS/` works through the loader now; load → sample → exportPlan can be exercised end-to-end against atlas-less projects.
- **Phase 22 (SEED-002 dims-badge) is unblocked.** sourceDims rows in atlas-less mode carry `source: 'png-header'`, which the dims-badge UI can branch on for canonical-vs-source drift detection.
- **No new dependencies added.** Layer 3 invariant intact (loader.ts already had the FS_LOAD_TIME_CARVE_OUTS exemption from Phase 0; no new arch.spec.ts diff needed).

## Self-Check: PASSED

All claims verified against the filesystem and git log:

- ✅ `src/core/loader.ts` modified (478 lines after edit; 4-way branch present at lines ~214-310).
- ✅ `tests/core/loader.spec.ts` modified (368 lines after edit; new Phase 21 describe block at end).
- ✅ Commit `fa1a0e2` (RED test) found in git log.
- ✅ Commit `98b65b4` (GREEN feat) found in git log.
- ✅ `npx vitest run tests/core/loader.spec.ts` returns 15/15 pass.
- ✅ `npm run test` returns 609 passing, 0 failing (1 skipped, 2 todo unrelated).
- ✅ `npm run typecheck` returns only pre-existing `scripts/probe-per-anim.ts` TS2339 (unrelated; verified pre-existing in Plans 21-04/21-05 SUMMARY).
- ✅ Imports verified: `synthesizeAtlasText` + `SilentSkipAttachmentLoader` imported from `./synthetic-atlas.js`.
- ✅ 4-way branch markers present: `grep -c "D-0[5-8]" src/core/loader.ts` returns 12.
- ✅ Branch order verified: `opts.atlasPath !== undefined` (line 214) precedes `opts.loaderMode === 'atlas-less'` (line 236).
- ✅ AtlasNotFoundError verbatim preserved: `grep -c "throw new AtlasNotFoundError" src/core/loader.ts` returns 3 (D-06 explicit, D-07 race-fallback, D-05 malformed-project guard).
- ✅ `atlasPath: resolvedAtlasPath` present in return statement.
- ✅ `source: 'png-header'` present in atlas-less sourceDims branch.
- ✅ `new SilentSkipAttachmentLoader` instantiated for atlas-less attachmentLoader.
- ✅ ROADMAP success criterion #5 locked: D-06 test asserts verbatim message + searchedPath + skeletonPath fields.

---
*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Plan: 06-loader-integration*
*Completed: 2026-05-01*
