---
phase: 06-optimize-assets-image-export
plan: 02
subsystem: types-and-data-plumbing
tags: [ipc-types, sourcePath, structuredClone-safe, layer-3-arch, tdd]

# Dependency graph
requires:
  - phase: 00-headless-core
    provides: LoadResult.sourceDims pattern (sibling Map populated from atlas regions)
  - phase: 01-electron-react-scaffold
    provides: D-21 SkeletonSummary structuredClone-safe IPC contract; D-10 LoadResponse envelope; D-07 Api contextBridge surface
  - phase: 02-global-max-render-source-panel
    provides: dedup-by-attachmentName analyzer + DisplayRow fold
  - phase: 03-animation-breakdown-panel
    provides: BreakdownRow extends DisplayRow; analyzeBreakdown call site
  - phase: 06-optimize-assets-image-export (06-01)
    provides: 3 RED test files importing the new IPC types — Plan 06-02 satisfies their type imports
provides:
  - "LoadResult.sourcePaths: Map<atlasRegionName, absolutePngPath>"
  - "DisplayRow.sourcePath: string (BreakdownRow inherits via extends)"
  - "src/main/summary.ts wires load.sourcePaths → DisplayRow.sourcePath end-to-end"
  - "src/shared/types.ts: 6 new IPC contracts (ExportRow / ExportPlan / ExportError / ExportProgressEvent / ExportSummary / ExportResponse) — all structuredClone-safe"
  - "src/shared/types.ts Api ext: pickOutputDirectory + startExport + cancelExport + onExportProgress + openOutputFolder"
  - "src/preload/index.ts NOT_YET_WIRED stubs for 5 new Api methods (preserves Plan 06-05 wiring boundary while keeping preload bundle compiling)"
affects: [06-03-export-builder, 06-04-image-worker, 06-05-ipc-handlers, 06-06-renderer-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 5 D-101 single-call-site extension: extend the loader's existing sourceDims build with a sibling sourcePaths build, thread one new arg through analyzer, and add the IPC payload field via the existing summary projection"
    - "Optional-arg backward compat: analyze(peaks, sourcePaths?) and analyzeBreakdown(..., sourcePaths?) — empty-string default preserves the Phase 5 D-102 byte-for-byte CLI lock"
    - "ReadonlyMap parameter typing: ReadonlyMap<string, string> for the sourcePaths argument signals callers cannot mutate the map (defensive for future shared callers)"
    - "Type extension on Api forces preload-stub landing: extending the Api interface in src/shared/types.ts immediately requires src/preload/index.ts to satisfy the new shape; NOT_YET_WIRED throw stubs keep typecheck green while preserving the Plan 06-05 wiring boundary"

key-files:
  created: []
  modified:
    - "src/core/types.ts (LoadResult.sourcePaths field added after sourceDims)"
    - "src/core/loader.ts (sourcePaths Map built from atlas.regions; returned alongside sourceDims)"
    - "src/core/analyzer.ts (toDisplayRow + toBreakdownRow gain sourcePath arg defaulting to ''; analyze + analyzeBreakdown gain optional sourcePaths?: ReadonlyMap<string, string>)"
    - "src/shared/types.ts (DisplayRow.sourcePath added; 6 new exports + 5 Api methods added)"
    - "src/main/summary.ts (analyze and analyzeBreakdown call sites pass load.sourcePaths)"
    - "src/preload/index.ts (5 NOT_YET_WIRED stub methods added to satisfy extended Api interface)"
    - "tests/core/loader.spec.ts (+2 sourcePaths describe-block tests against SIMPLE_TEST + EXPORT_PROJECT)"
    - "tests/core/analyzer.spec.ts (+3 sourcePath threading tests on analyze + analyzeBreakdown)"
    - "tests/core/summary.spec.ts (+3 sourcePath IPC-payload tests on peaks + breakdown + structuredClone)"

key-decisions:
  - "Optional sourcePaths arg on analyze + analyzeBreakdown (NOT mandatory) — preserves the Phase 5 D-102 byte-for-byte CLI lock by letting scripts/cli.ts continue to call analyze(sampled.globalPeaks) with one arg; DisplayRow.sourcePath defaults to '' on that path. Mandatory arg would have required modifying scripts/cli.ts and breaking D-102."
  - "path.resolve(path.join(skeletonDir, 'images', regionName + '.png')) — the resolve wrapper makes Map values absolute regardless of whether skeletonPath was relative or absolute. Mirrors the existing path.resolve(skeletonPath) used for the returned skeletonPath field. Without this, a relative skeletonPath would yield relative sourcePath values that the renderer + image-worker could not reliably consume."
  - "NO fs.access on sourcePaths build — SIMPLE_PROJECT does not have an images/ folder (loader uses stub TextureLoader; CLAUDE.md fact #4); fs.access would force a fixture refactor. Plan 06-04 image-worker pre-flight surfaces missing files as 'missing-source' progress events per D-112; the load-time map is path-only."
  - "Region names with '/' (subfolder paths) preserved as subfolder source paths — `images/AVATAR/FACE.png` for region `AVATAR/FACE` — F8.3 directory-structure preservation depends on this. Tested implicitly via the EXPORT_PROJECT fixture (no '/' in current regions but path.join semantics make this work for free)."
  - "ExportResponse declared as a discriminated union with its OWN error.kind literal (NOT modifying the existing SerializableError union which serves the skeleton:load envelope) — keeps the two IPC envelopes type-isolated. ExportResponse.error.kind: 'already-running' | 'invalid-out-dir' | 'Unknown' is distinct from SerializableError.kind: 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown'. Mirrors LoadResponse pattern (D-10) without conflating the type spaces."
  - "Preload NOT_YET_WIRED stubs throw rather than return undefined or empty — so an accidental early consumer in the renderer fails LOUDLY with a clear 'Plan 06-05 wires these' error rather than mysterious 'undefined is not a function' surface."

requirements-completed: [F8.3]

# Metrics
duration: ~6min
completed: 2026-04-25
---

# Phase 6 Plan 02: Wave 1 Data Plumbing Summary

**Threaded `sourcePath` (the absolute path to the source PNG on disk for each atlas region) from `src/core/loader.ts` through `src/core/analyzer.ts` into every `DisplayRow` (and inherited by `BreakdownRow`), wired `src/main/summary.ts` to populate it on the IPC payload, and extended `src/shared/types.ts` with the 6 Phase 6 IPC interfaces (ExportRow / ExportPlan / ExportError / ExportProgressEvent / ExportSummary / ExportResponse) plus the 5 new `Api` methods (pickOutputDirectory / startExport / cancelExport / onExportProgress / openOutputFolder). Plan 06-01's 3 RED specs now have all type imports satisfied — they fail only on the missing implementation modules (Plan 06-03/04/05).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-25 (worktree spawn)
- **Tasks:** 2 (each TDD: RED → GREEN gate)
- **Commits:** 4 (2 RED + 2 GREEN, all atomic)
- **Files modified:** 9 (6 src/ + 3 tests/, no new files)

## Accomplishments

- **LoadResult carries sourcePaths Map** — populated at load time from `atlas.regions` via `path.resolve(path.join(skeletonDir, 'images', regionName + '.png'))`. Path-only build (no fs.access). 4 regions on EXPORT_PROJECT (CIRCLE / SQUARE / SQUARE2 / TRIANGLE) all resolve to existing files; 3 regions on SIMPLE_TEST (CIRCLE / SQUARE / TRIANGLE) resolve to expected paths under `<skeletonDir>/images/` even though that folder does not exist (intended).
- **DisplayRow + BreakdownRow have sourcePath end-to-end** — `analyze(peaks, sourcePaths?)` and `analyzeBreakdown(..., sourcePaths?)` both look up by attachmentName via `sourcePaths?.get(p.attachmentName) ?? ''`. CLI path (no second arg) keeps the old empty-string default → byte-for-byte CLI preserved (D-102).
- **src/main/summary.ts wires the field through** — `analyze(sampled.globalPeaks, load.sourcePaths)` + `analyzeBreakdown(..., load.sourcePaths)` produce SkeletonSummary.peaks[i].sourcePath = `<skeletonDir>/images/<attachmentName>.png` (absolute) on every row, AND every animationBreakdown[*].rows[*].sourcePath similarly populated.
- **src/shared/types.ts gains 6 new IPC contracts** at lines 156-227 — ExportRow (sourcePath / outPath / sourceW / sourceH / outW / outH / effectiveScale / attachmentNames[]), ExportPlan (rows / excludedUnused / totals.count), ExportError (kind discriminator + path + message), ExportProgressEvent (index / total / path / outPath / status / error?), ExportSummary (successes / errors / outputDir / durationMs / cancelled), ExportResponse (discriminated union envelope). All primitive — D-21 structuredClone-safe.
- **Api interface extended with 5 new methods** at lines 296+ — pickOutputDirectory / startExport / cancelExport / onExportProgress / openOutputFolder. Each carries a Plan-06-05-pointer docblock.
- **Preload NOT_YET_WIRED stubs** keep `src/preload/index.ts` typecheck-clean while the real bridge implementations are deferred to Plan 06-05. Stubs throw a clear error if accidentally invoked early from the renderer.

## Task Commits

Each task was committed atomically with a RED→GREEN TDD gate split:

1. **Task 1 RED — failing tests for sourcePaths Map + sourcePath threading** — `8a0fe7b` (test)
2. **Task 1 GREEN — thread sourcePath from loader through analyzer to DisplayRow** — `e06579d` (feat)
3. **Task 2 RED — failing tests for sourcePath on IPC payload** — `10bf8e1` (test)
4. **Task 2 GREEN — wire summary.ts sourcePaths + add 6 IPC interfaces + Api ext** — `13d395e` (feat)

## Files Modified

### Source (6)
- `src/core/types.ts` — `LoadResult.sourcePaths: Map<string, string>` field added immediately after `sourceDims`, with docblock referencing D-108 + RESEARCH §Pattern 2 + the path-only / no-fs.access decision + the F8.3 subfolder-preservation rule.
- `src/core/loader.ts` — `sourcePaths` Map built in a sibling block to the existing `sourceDims` block, then included in the return object after `sourceDims` and before `editorFps`.
- `src/core/analyzer.ts` — `toDisplayRow(p, sourcePath = '')` + `toBreakdownRow(p, slot, isSetup, sourcePath = '')` extended with optional sourcePath arg; `analyze(peaks, sourcePaths?: ReadonlyMap<string, string>)` + `analyzeBreakdown(perAnimation, setupPosePeaks, skeletonData, skeletonSlots, sourcePaths?)` extended with optional sourcePaths arg; both look up via `sourcePaths?.get(p.attachmentName) ?? ''`.
- `src/shared/types.ts` — `DisplayRow.sourcePath: string` added at end of interface; 6 new export blocks added immediately after `UnusedAttachment`; `Api` interface extended with 5 new method signatures + docblocks pointing to Plan 06-05.
- `src/main/summary.ts` — `analyze(sampled.globalPeaks, load.sourcePaths)` + `analyzeBreakdown(..., load.sourcePaths)` call sites updated; comment block references D-108.
- `src/preload/index.ts` — NOT_YET_WIRED throw helper + 5 stub method assignments added to keep `const api: Api = {...}` typecheck-clean. Plan 06-05 will replace these stubs with real preload bridges.

### Tests (3)
- `tests/core/loader.spec.ts` — +1 describe block "loader: sourcePaths map (Phase 6 Plan 02, F8.3, D-108)" with 2 it() tests: SIMPLE_TEST → 3 regions with absolute paths under `<skeletonDir>/images/`, EXPORT_PROJECT → 4 regions all backed by files that exist on disk.
- `tests/core/analyzer.spec.ts` — +1 describe block "analyzer: sourcePath threading (Phase 6 Plan 02, F8.3, D-108)" with 3 it() tests: analyze(peaks, sourcePaths) populates DisplayRow.sourcePath, analyze(peaks) without sourcePaths defaults to '' (CLI path lock), analyzeBreakdown threads sourcePath into every BreakdownRow on every card.
- `tests/core/summary.spec.ts` — +1 describe block "summary: sourcePath threading on DisplayRow + BreakdownRow (Phase 6 Plan 02, F8.3)" with 3 it() tests: every peaks[i].sourcePath ends in .png, every animationBreakdown[*].rows[*].sourcePath ends in .png, structuredClone round-trip preserves the new field.

## New IPC Interfaces Added (src/shared/types.ts)

| Name                | Lines    | Shape                                                                                                       |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| ExportRow           | 156-165  | sourcePath / outPath / sourceW / sourceH / outW / outH / effectiveScale / attachmentNames[]                 |
| ExportPlan          | 172-176  | rows: ExportRow[] / excludedUnused: string[] / totals: { count: number }                                    |
| ExportError         | 185-189  | kind: 'missing-source'\|'sharp-error'\|'write-error' / path / message                                       |
| ExportProgressEvent | 197-204  | index / total / path / outPath / status: 'success'\|'error' / error?: ExportError                           |
| ExportSummary       | 212-218  | successes / errors: ExportError[] / outputDir / durationMs / cancelled                                      |
| ExportResponse      | 226-228  | discriminated union: { ok:true; summary } \| { ok:false; error: { kind: 'already-running'\|'invalid-out-dir'\|'Unknown'; message } } |
| Api (extended)      | 296+     | + pickOutputDirectory / startExport / cancelExport / onExportProgress / openOutputFolder                    |

## Decisions Made

- **Optional sourcePaths arg on analyze + analyzeBreakdown** (not mandatory) — preserves the Phase 5 D-102 byte-for-byte CLI lock. `scripts/cli.ts` continues to call `analyze(sampled.globalPeaks)` with one arg; `DisplayRow.sourcePath` defaults to '' on that path. Mandatory would have required modifying scripts/cli.ts and breaking D-102.
- **path.resolve(path.join(...))** for sourcePaths values — makes the Map values absolute regardless of relative/absolute skeletonPath input. Mirrors the existing `path.resolve(skeletonPath)` for the returned skeletonPath field. Without this, a relative skeletonPath would yield relative sourcePath values that the renderer + image-worker could not reliably consume.
- **NO fs.access on sourcePaths build** — SIMPLE_PROJECT does not have an images/ folder (loader uses stub TextureLoader per CLAUDE.md fact #4); fs.access would force a fixture refactor. Plan 06-04's image-worker pre-flight surfaces missing files as 'missing-source' progress events per D-112; the load-time map is path-only by design.
- **ExportResponse declared as a discriminated union with its OWN error.kind literal** — NOT modifying the existing SerializableError union which serves the skeleton:load envelope. Keeps the two IPC envelopes type-isolated. Mirrors LoadResponse pattern (D-10) without conflating type spaces.
- **Preload NOT_YET_WIRED stubs throw** rather than return undefined or empty — accidental early consumer in the renderer fails loudly with a clear "Plan 06-05 wires these" error rather than mysterious "undefined is not a function" surface.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added NOT_YET_WIRED stubs to src/preload/index.ts**
- **Found during:** Task 2 GREEN (immediately after extending the Api interface)
- **Issue:** Extending `Api` in src/shared/types.ts with 5 new methods caused `src/preload/index.ts` to fail typecheck with `TS2739: Type '{ loadSkeletonFromFile: ... }' is missing the following properties from type 'Api': pickOutputDirectory, startExport, cancelExport, onExportProgress, openOutputFolder`. The plan explicitly mandates the Api extension lands in 06-02 (CONTEXT.md `<interfaces>` block lines 100-111 + plan acceptance criterion); the preload bridges land in Plan 06-05.
- **Fix:** Added a `NOT_YET_WIRED(method: string): never` helper that throws a clear "Plan 06-05 wires these" error, then wired 5 stub methods (pickOutputDirectory / startExport / cancelExport / onExportProgress / openOutputFolder) that delegate to it. Preserves the typecheck contract while keeping the wiring boundary at Plan 06-05.
- **Files modified:** src/preload/index.ts
- **Commit:** 13d395e (rolled into Task 2 GREEN since the stub is part of satisfying the same Api type extension)

**2. [Documentation alignment] Added BreakdownRow sourcePath threading test in Task 1 (originally only specified for analyzer)**
- **Issue:** Plan Task 1 `<behavior>` lists only DisplayRow assertions for analyzer; BreakdownRow inheritance is implicit. Added an explicit `analyzeBreakdown(..., sourcePaths)` test in analyzer.spec.ts to lock the BreakdownRow-side contract too — without this test, a future regression that drops the sourcePaths thread on the breakdown branch would slip past Task 1's verification.
- **Files modified:** tests/core/analyzer.spec.ts (added 1 it() to the new describe block)
- **Rationale:** Belt-and-suspenders — Task 2's summary.spec.ts test does cover the IPC payload for the breakdown rows, but a pure-analyzer test is the lowest-level lock and matches the file-locality boundary (analyzer-side test in analyzer.spec.ts).

## Issues Encountered

- **None substantive.** The Rule 3 preload-stub deviation was an immediately-evident typecheck blocker that the plan implicitly required (the Api extension cannot land without preload conforming); the stub solution preserves the Plan 06-05 boundary cleanly.

## Test Suite State

- **Before this plan:** 129 passed | 1 skipped | 9 failed (per Plan 06-01 SUMMARY)
- **After this plan:** **137 passed | 1 skipped | 9 failed** across 13 spec files. Test count delta: **+8 passing tests** (+2 loader.spec, +3 analyzer.spec, +3 summary.spec); failure count UNCHANGED — all 9 failures are the pre-existing Plan 06-01 RED specs (export.spec.ts + image-worker.spec.ts + ipc-export.spec.ts) that await Plan 06-03/04/05 implementations.
- **RED-spec advancement (success criterion gate):** Plan 06-01's 3 RED files now resolve their **type imports** cleanly. `tsc --noEmit` errors for these files are now ONLY:
  - `tests/core/export.spec.ts` — `Cannot find module '../../src/core/export.js'` + `'ExportRow' is declared but never used` (the latter is pre-existing — RED file imports the type for an inferred-position role; can be cleaned up in Plan 06-03 when buildExportPlan exists). NO LONGER fails on `Cannot find name 'ExportRow' / 'ExportPlan' / 'SkeletonSummary'`.
  - `tests/main/image-worker.spec.ts` — `Cannot find module '../../src/main/image-worker.js'`. NO LONGER fails on `Cannot find name 'ExportPlan' / 'ExportProgressEvent'`.
  - `tests/main/ipc-export.spec.ts` — `Module '"../../src/main/ipc.js"' has no exported member 'handleStartExport'/'handlePickOutputDirectory'`. NO LONGER fails on `Cannot find name 'ExportPlan'`.
- **Phase-gate sanity** (verified post-Task-2):
  - `git diff --exit-code scripts/cli.ts` → empty (Phase 5 D-102 byte-for-byte lock preserved — CLI never reads sourcePath)
  - `git diff --exit-code src/core/sampler.ts` → empty (CLAUDE.md fact #3 sampler lock preserved)
  - `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → 3 unchanged rows (CIRCLE / SQUARE / TRIANGLE), unchanged stdout
  - `npm run test -- tests/arch.spec.ts` → 9 pass (Layer 3 src/core ↛ sharp/node:fs grep + all other arch invariants still green)

## Confirmation: Pre-existing Pre-existing Typecheck Issues (Not Introduced by This Plan)

- `scripts/probe-per-anim.ts(14,31): Property 'values' does not exist on type 'SamplerOutput'` — present BEFORE this plan (verified by stash + typecheck). Out of scope per Rule scope-boundary; logged here for visibility only.

## TDD Gate Compliance

Plan 06-02 has `tdd="true"` on both tasks. The required RED → GREEN gate sequence is:
- Task 1: `8a0fe7b test(06-02): add RED tests` → `e06579d feat(06-02): thread sourcePath` ✓
- Task 2: `10bf8e1 test(06-02): add RED tests` → `13d395e feat(06-02): wire summary.ts` ✓

Both gates verified: a `test(...)` commit precedes each `feat(...)` commit; failing tests at the RED gate were confirmed (5 fails for Task 1 RED; 2 fails for Task 2 RED — the 3rd Task 2 test passed at RED because empty strings clone fine, which is the desired D-21 invariant); no REFACTOR commits were needed (the implementation diff was minimal and the code stayed clean).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 06-03 (src/core/export.ts → buildExportPlan):** ready. The Plan 06-01 RED spec `tests/core/export.spec.ts` now has all type imports satisfied (`ExportPlan`, `ExportRow`, `SkeletonSummary` resolve cleanly); only the runtime module is missing. The synthetic test rows in cases (a)-(g) already include `sourcePath: '/fake/<name>.png'` — the buildExportPlan implementation will read DisplayRow.sourcePath as the dedup key per D-108.
- **Plan 06-04 (src/main/image-worker.ts → runExport):** ready. The Plan 06-01 RED spec `tests/main/image-worker.spec.ts` has `ExportPlan` + `ExportProgressEvent` types resolved; only the runtime module is missing. The image-worker reads `ExportRow.sourcePath` (now flowing end-to-end from loader) for the sharp call source path.
- **Plan 06-05 (src/main/ipc.ts handlers + preload + AppShell):** ready. The Api interface is fully declared; the preload has NOT_YET_WIRED stubs that Plan 06-05 swaps for real `ipcRenderer.invoke('export:start', ...)` + `ipcRenderer.on('export:progress', ...)` bridges. The 5 method signatures are locked.
- **Plan 06-06+ (renderer modal + AppShell button):** ready. The renderer can import `ExportPlan / ExportSummary / ExportProgressEvent` from `src/shared/types.js` for typing AppShell + OptimizeDialog state.

## Self-Check: PASSED

Files modified (verified via `git diff --name-only HEAD~4 HEAD`):
- FOUND: src/core/types.ts (in e06579d)
- FOUND: src/core/loader.ts (in e06579d)
- FOUND: src/core/analyzer.ts (in e06579d)
- FOUND: src/shared/types.ts (in e06579d + 13d395e — DisplayRow.sourcePath in e06579d, ExportRow et al. in 13d395e)
- FOUND: src/main/summary.ts (in 13d395e)
- FOUND: src/preload/index.ts (in 13d395e)
- FOUND: tests/core/loader.spec.ts (in 8a0fe7b)
- FOUND: tests/core/analyzer.spec.ts (in 8a0fe7b)
- FOUND: tests/core/summary.spec.ts (in 10bf8e1)

Commits exist (verified via `git log --oneline`):
- FOUND: 8a0fe7b test(06-02): add RED tests for sourcePaths map + sourcePath threading
- FOUND: e06579d feat(06-02): thread sourcePath from loader through analyzer to DisplayRow
- FOUND: 10bf8e1 test(06-02): add RED tests for sourcePath in IPC payload (peaks + breakdown)
- FOUND: 13d395e feat(06-02): wire summary.ts sourcePaths + add 6 IPC interfaces + Api ext

Acceptance grep evidence:
- FOUND: `sourcePaths: Map` in src/core/types.ts → LoadResult field declared
- FOUND: `sourcePaths.set` in src/core/loader.ts → loader populates the Map
- FOUND: `sourcePaths,` in src/core/loader.ts return object → loader returns the Map
- FOUND: `sourcePath: string` in src/shared/types.ts DisplayRow block → field declared
- FOUND: `sourcePaths?: ReadonlyMap` in src/core/analyzer.ts → optional arg signature
- FOUND: `analyze(sampled.globalPeaks, load.sourcePaths)` in src/main/summary.ts → wired
- FOUND: 6× `^export interface Export(Row|Plan|Error|ProgressEvent|Summary)` + `^export type ExportResponse` in src/shared/types.ts → all 6 exports present
- FOUND: 5 new Api method signatures in src/shared/types.ts (pickOutputDirectory + startExport + cancelExport + onExportProgress + openOutputFolder)

---
*Phase: 06-optimize-assets-image-export*
*Completed: 2026-04-25*
