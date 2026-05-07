---
phase: 28-optional-output-sharpening
plan: 01
subsystem: ui
tags: [optimize-dialog, stmproj-schema, ipc-plumbing, sharpen, react, typescript, electron]

# Dependency graph
requires:
  - phase: 8-stmproj-persistence
    provides: ".stmproj v1 schema, validateProjectFile + serializeProjectFile + materializeProjectFile three-touch pattern, AppSessionState round-trip plumbing"
  - phase: 9-sampling-rate-settings
    provides: "samplingHzLocal AppShell lifecycle precedent (state slot + lastSaved + buildSessionState dep + isDirty memo + setLastSaved persistence)"
  - phase: 21-loader-mode-toggle
    provides: "loaderMode .stmproj three-touch + main/project-io.ts MaterializedProject envelope threading + AppShell setLoaderMode restore"
  - phase: 6-optimize-assets
    provides: "OptimizeDialog modal scaffold + window.api.startExport IPC + handleStartExport main handler"
provides:
  - "sharpenOnExport: boolean field round-trips through .stmproj v1 schema (additive optional, default false)"
  - "OptimizeDialog hosts the 'Sharpen output on downscale' checkbox between the 3-tile summary and state-branched body"
  - "AppShell sharpenOnExportLocal state slot wired into dirty signal, save persistence, Open restore, and OptimizeDialog props"
  - "window.api.startExport(plan, outDir, overwrite, sharpenEnabled) — 4th arg threaded preload → ipc.ts handler → runExport call site (with @ts-expect-error placeholder for Plan 28-02)"
  - "Strict === true coerce defenses at preload boundary AND ipcMain.handle boundary (mirrors overwrite precedent)"
affects: [28-optional-output-sharpening, 28-02, 28-03, sharp-pipeline]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — sharp + react + electron already in use
  patterns:
    - "Additive-optional .stmproj field with default-on-missing (Phase 8 D-146 backward-compat-additive — schema version unchanged)"
    - "Inline 4th IPC arg (not envelope) — mirrors overwrite precedent at types.ts:921-925"
    - "Strict === true coerce at every IPC boundary (preload + ipcMain.handle) — defense in depth even if renderer sends 'true' (string)"
    - "@ts-expect-error placeholder at the runExport call site so Plan 28-01 lands green; Plan 28-02 Task 1 will delete it (TypeScript will warn 'Unused @ts-expect-error directive', structurally enforcing the cleanup)"

key-files:
  created:
    - ".planning/phases/28-optional-output-sharpening/28-01-SUMMARY.md"
    - ".planning/phases/28-optional-output-sharpening/deferred-items.md"
  modified:
    - "src/shared/types.ts (3 interfaces + Api.startExport signature)"
    - "src/core/project-file.ts (validator pre-massage + per-field type-check + serializer + PartialMaterialized + materializer fallback)"
    - "src/main/project-io.ts (Open-flow envelope + recovery lift + recovery-rebuild + resample-rebuild)"
    - "src/main/ipc.ts (handleStartExport 5th param + runExport 6th arg via @ts-expect-error + ipcMain.handle strict coerce)"
    - "src/preload/index.ts (startExport bridge accepts 4th arg + strict coerce)"
    - "src/renderer/src/components/AppShell.tsx (sharpenOnExportLocal slot + lastSaved shape + buildSessionState + isDirty + 3 setLastSaved literal sites + mountOpenResponse restore + OptimizeDialog wire-through)"
    - "src/renderer/src/modals/OptimizeDialog.tsx (props + checkbox render + 4th startExport arg)"

key-decisions:
  - "D-04 default-OFF (Photoshop neutral baseline)"
  - "Inline 4th IPC arg per RESEARCH Q1 Option A — mirrors overwrite precedent rather than introducing an OptimizeOptions envelope"
  - "@ts-expect-error placeholder over option (b) defer-the-call-site — keeps Plan 28-01 build green, structurally enforces Plan 28-02 cleanup"
  - "Resample-path MaterializedProject defensively coerces sharpenOnExport from IPC args (not in plan but required — type contract is non-optional after Task 1)"

patterns-established:
  - "sharpenOnExport at .stmproj boundary, sharpenEnabled at IPC boundary (matches research recommendation — name reflects scope)"
  - "Three-touch + interface + materializer fallback verbatim mirror of Phase 21 D-08 loaderMode pattern"
  - "5-site AppShell lifecycle (state slot + lastSaved shape + buildSessionState + isDirty + setLastSaved persistence) verbatim mirror of Phase 9 D-188 samplingHzLocal pattern"

requirements-completed: [SHARP-01]

# Metrics
duration: 10min
completed: 2026-05-06
---

# Phase 28 Plan 01: Optional Output Sharpening — Toggle UI + .stmproj Persistence Summary

**End-to-end `sharpenOnExport` plumbing: types → validator/serializer/materializer → main IPC envelope → preload bridge → AppShell lifecycle → OptimizeDialog checkbox; toggle is functional from the user's perspective except no actual sharpening yet (Plan 28-02 wires the resize chain).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-06T22:22:00Z
- **Completed:** 2026-05-06T22:32:09Z
- **Tasks:** 7
- **Files modified:** 7 source + 1 doc

## Accomplishments

- SHARP-01 (UI toggle + .stmproj persistence + backward-compat) mechanically satisfied
- `sharpenOnExport: boolean` round-trips through .stmproj v1 (default false on missing, rejected with `invalid-shape` on non-boolean)
- OptimizeDialog renders the "Sharpen output on downscale" checkbox with literal copy, default OFF, disabled during in-progress export
- Toggling marks project dirty (buildSessionState + isDirty memo wired)
- AppShell hydrates from `initialProject.sharpenOnExport ?? false` and restores on Open / locate-skeleton recovery
- IPC threads the boolean as 4th arg through `window.api.startExport(plan, outDir, overwrite, sharpenEnabled)` with strict-`=== true` coerce at preload + ipcMain.handle boundaries
- runExport call site set up via `@ts-expect-error Phase 28-02` placeholder (Plan 28-02 Task 1 deletes it)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sharpenOnExport to type definitions** — `820ec7c` (feat)
2. **Task 2: Three-touch sharpenOnExport in project-file.ts** — `f77c76e` (feat)
3. **Task 3: Thread sharpenOnExport through project-io.ts** — `e72422e` (feat)
4. **Task 4: Thread sharpenEnabled through preload + ipc** — `041a1aa` (feat)
5. **Task 5: Wire sharpenOnExportLocal in AppShell** — `72635f1` (feat)
6. **Task 6: Add sharpen checkbox to OptimizeDialog** — `b0fe6b0` (feat)
7. **Task 7: Full-suite green-light pass + deferred-items.md** — `0dba0d1` (chore)

## Files Created/Modified

### Created

- `.planning/phases/28-optional-output-sharpening/28-01-SUMMARY.md` — this file
- `.planning/phases/28-optional-output-sharpening/deferred-items.md` — pre-existing baseline failure log (4 test files, 8 tsc errors, all verified pre-existing on commit `6f599063`)

### Modified

- `src/shared/types.ts` — `ProjectFileV1.sharpenOnExport`, `AppSessionState.sharpenOnExport`, `MaterializedProject.sharpenOnExport`, `Api.startExport` gains optional `sharpenEnabled?: boolean` 4th arg (3 interfaces + 1 method signature, lines ~779/802/827/921-933)
- `src/core/project-file.ts` — validator pre-massage (`obj.sharpenOnExport === undefined → false`), per-field type-check (rejects non-boolean), `serializeProjectFile` writes the field, `PartialMaterialized` interface gains the field, `materializeProjectFile` falls back to `false` (5 sites, 25 insertions, no `from 'sharp'` import)
- `src/main/project-io.ts` — Open-flow `MaterializedProject` envelope threads `materialized.sharpenOnExport`, recovery path lifts `a.sharpenOnExport` defensively + threads into rebuilt envelope, resample path defensively coerces from IPC args (3 sites, 20 insertions; loader call sites unchanged — sharpenOnExport is export-time, not load-time)
- `src/main/ipc.ts` — `handleStartExport` 5th param `sharpenEnabled: boolean = false`, `runExport` call gets 6th arg via `@ts-expect-error Phase 28-02 will accept the 6th argument`, `ipcMain.handle('export:start')` strict-coerces `sharpenEnabled === true`
- `src/preload/index.ts` — `startExport` bridge accepts 4th arg `sharpenEnabled` and forwards via `sharpenEnabled === true` strict coerce
- `src/renderer/src/components/AppShell.tsx` — 7 sites: `sharpenOnExportLocal` useState slot + `lastSaved` shape extension (3 literal sites — 829/862/1056) + `buildSessionState` value + dep + `isDirty` comparison + dep + `mountOpenResponse` restore + `<OptimizeDialog>` mount-site props
- `src/renderer/src/modals/OptimizeDialog.tsx` — `OptimizeDialogProps` gains `sharpenOnExport: boolean` + `onSharpenChange: (v: boolean) => void` (REQUIRED), checkbox rendered between 3-tile summary and state-branched body with literal copy "Sharpen output on downscale", `disabled={state === 'in-progress'}`, threaded as 4th arg into `window.api.startExport`

## Decisions Made

- **Inline 4th arg** (RESEARCH Q1 Option A) over `OptimizeOptions` envelope — mirrors `overwrite` precedent at types.ts:921-925; envelope refactor deferred until a phase adds multiple flags simultaneously
- **`@ts-expect-error Phase 28-02`** at `ipc.ts` `runExport` call site — keeps Plan 28-01 build green AND structurally enforces Plan 28-02 Task 1 cleanup (TypeScript warns "Unused @ts-expect-error directive" once `runExport` accepts the 6th arg)
- **D-04 default OFF** — toggle defaults to false on first load AND on legacy v1.2-era .stmproj files (validator pre-massage substitutes false for missing field)

## Mandatory `@ts-expect-error` placeholder landed in `src/main/ipc.ts`

Per the plan's UNCONDITIONAL acceptance criterion in Task 4:

```bash
grep -c "@ts-expect-error Phase 28-02" src/main/ipc.ts  # → 1 (exactly)
```

This single occurrence is at the `runExport` call site inside `handleStartExport`. **Plan 28-02 Task 1 will delete this line** once `runExport` accepts the 6th `sharpenEnabled` argument. TypeScript will then emit "Unused @ts-expect-error directive", structurally enforcing the cleanup.

## Layer 3 invariant preserved

```bash
grep -rn "from 'sharp'" src/core/  # → 0 hits
```

No `sharp` import added to `src/core/`. Plan 28-01 is plumbing-only; the actual `sharp.sharpen()` call lands in Plan 28-02 inside `src/main/image-worker.ts`.

## Schema version unchanged

```bash
grep -c "version: 1" src/core/project-file.ts  # → 1 hit (the V_LATEST const)
```

Per Phase 8 D-146 backward-compat-additive precedent — additive optional fields with safe defaults stay at `version: 1`. v1.2-era `.stmproj` files (no `sharpenOnExport` field) load successfully with the toggle OFF.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resample-path MaterializedProject required `sharpenOnExport` field**

- **Found during:** Task 3 (Thread sharpenOnExport through project-io.ts)
- **Issue:** `MaterializedProject` is now a required field after Task 1's type extension. The plan only explicitly mentioned the Open flow + recovery path sites, but `handleProjectResample` also constructs a `MaterializedProject` literal — without setting `sharpenOnExport`, TypeScript would reject the literal.
- **Fix:** Added a defensive coerce at the resample-path envelope: `sharpenOnExport: typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false`. The renderer is the source of truth for sharpenOnExport on resample (AppShell preserves its own state), so defaulting to false here is contract-correct; if a future plan threads the field through `ResampleArgs`, this seam already coerces it.
- **Files modified:** `src/main/project-io.ts` (resample MaterializedProject literal at line ~1037)
- **Verification:** `npx tsc --noEmit -p tsconfig.json` passes 0 errors
- **Committed in:** `e72422e` (Task 3 commit)

**Note on Task 3 acceptance criteria:** The plan stated `grep -c "typeof a.sharpenOnExport === 'boolean'" src/main/project-io.ts` should return `1`; the actual count is `2` because of this Rule 3 fix. The exact-text spec was outdated; the structural intent (defensive coerce at every JSON-payload boundary) is satisfied.

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking — TypeScript type-completeness)
**Impact on plan:** No scope creep. The fix follows the same defensive-coerce pattern documented at the recovery-path site.

## Issues Encountered

None during planned work. All TypeScript and test surface that surfaced during execution was confirmed pre-existing on the base commit (`6f599063`) — see `deferred-items.md` for the full baseline log:

- 5 pre-existing tsc errors in renderer files (TS6133 unused declarations + TS2345/TS2322 string|null mismatches in OptimizeDialog.tsx — these existed BEFORE Plan 28-01 and are NOT introduced by sharpenOnExport plumbing)
- 5 pre-existing test failures across 4 files (sampler-skin-defined-unbound-attachment, build-scripts version stale fixture, save-load.spec.tsx Open-button selector, sampler-worker-girl wall-time gate)

## User Setup Required

None — no external service configuration required.

## Manual smoke (DEFERRED to Plan 28-02 / 28-03 UAT)

The plan's Task 7 manual smoke (load → toggle → save → close → reopen → verify persisted for both true and false) is deferred to the human-loop after Plan 28-02 + Plan 28-03 land. Plan 28-01's automated coverage:

- `npx tsc --noEmit -p tsconfig.json` exits 0 (main + core + shared)
- `npx tsc --noEmit -p tsconfig.web.json` only emits pre-existing errors (verified by base-commit re-check); no new errors introduced
- 46 sharpenOnExport references across src/, 0 sharp imports in src/core/, schema version unchanged

## Next Phase Readiness

- Plan 28-02 (image-worker integration) ready to start. The IPC arg is plumbed; Plan 28-02 Task 1 needs only:
  1. Extend `runExport` signature with 6th arg `sharpenEnabled: boolean = false`
  2. Delete the `@ts-expect-error Phase 28-02 will accept the 6th argument` line in `ipc.ts`
  3. Add the conditional `sharp.sharpen({ sigma: 0.5 })` to the resize chain (D-07 + D-08)
- Plan 28-03 (regression test) ready to start once 28-02 lands; SHARP-02 + SHARP-03 verification asserts variance + byte-identity across the toggle/scale matrix.

## Self-Check: PASSED

Verified files exist:
- `[FOUND] .planning/phases/28-optional-output-sharpening/28-01-SUMMARY.md` (this file)
- `[FOUND] .planning/phases/28-optional-output-sharpening/deferred-items.md`

Verified commits exist (per `git log --oneline | grep`):
- `[FOUND] 820ec7c` — Task 1
- `[FOUND] f77c76e` — Task 2
- `[FOUND] e72422e` — Task 3
- `[FOUND] 041a1aa` — Task 4
- `[FOUND] 72635f1` — Task 5
- `[FOUND] b0fe6b0` — Task 6
- `[FOUND] 0dba0d1` — Task 7 verification + deferred-items.md

---
*Phase: 28-optional-output-sharpening*
*Completed: 2026-05-06*
