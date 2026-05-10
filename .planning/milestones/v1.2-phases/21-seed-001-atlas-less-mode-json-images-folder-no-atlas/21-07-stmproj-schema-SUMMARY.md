---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 07
subsystem: stmproj-schema
tags: [stmproj-schema, persistence, sampler-worker, validate, migrate, materialize, ipc-payload, atlas-less, layer-3]

# Dependency graph
requires:
  - phase: 21
    provides: "21-CONTEXT.md decisions D-04 (atlasPath nullable), D-08 (per-project loaderMode override)"
  - plan: 21-05
    provides: "LoaderOptions.loaderMode + LoadResult.atlasPath nullable + SourceDims.source 'png-header' (Plan 06's loader 4-way branch consumes these)"
  - plan: 21-06
    provides: "Loader 4-way detection branch — honors opts.loaderMode === 'atlas-less' to skip sibling .atlas read entirely; this plan persists the choice across reload"
provides:
  - "ProjectFileV1.loaderMode: 'auto' | 'atlas-less' (new mandatory field; pre-massage substitutes 'auto' for legacy files)"
  - "AppSessionState.loaderMode (mirror — drives loadSkeleton + sampler-worker invocations)"
  - "SamplerWorkerData.loaderMode? (postMessage boundary; structured-clone-safe string literal)"
  - "PartialMaterialized.loaderMode (defence-in-depth back-fill at materializer)"
  - "ResampleArgs.loaderMode? (resample IPC payload widening — D-08 round-trips through SettingsDialog Apply)"
  - "validateProjectFile pre-massage forward-compat (legacy stmproj loads as 'auto')"
  - "validateProjectFile per-field rejection ('packed' or any other literal → 'invalid-shape')"
  - "serializeProjectFile writes state.loaderMode (round-trip lock)"
  - "materializeProjectFile back-fill (file.loaderMode ?? 'auto')"
  - "5 project-io.ts site updates routing loaderMode into loadSkeleton + runSamplerInWorker (incl. recovery branch validating renderer-supplied a.loaderMode)"
affects: [21-08 renderer toggle UI (consumes ProjectFileV1.loaderMode + dispatches recovery payload with loaderMode populated from useState)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-massage forward-compat pattern (mirrors Phase 20 D-148 documentation slot at project-file.ts:140-152) — RESEARCH.md §Pitfall 6 the canonical template"
    - "Per-field string-literal-union validator (mirrors Phase 8 sortDir validator at project-file.ts:205-209) — `obj.x !== 'a' && obj.x !== 'b'` → invalid-shape"
    - "Recovery-branch args widening (lines 657-665) — string-literal coercion at IPC boundary; defaults to safer 'auto' for forward-compat with pre-Plan-08 renderer builds"
    - "loaderOpts builder pattern at every loadSkeleton call site (5 sites total across sampler-worker + project-io)"

key-files:
  created: []
  modified:
    - "src/shared/types.ts (ProjectFileV1.loaderMode + AppSessionState.loaderMode + SamplerWorkerData.loaderMode? + ResampleArgs.loaderMode?)"
    - "src/core/project-file.ts (validate pre-massage + per-field check + PartialMaterialized.loaderMode + serializeProjectFile + materializeProjectFile)"
    - "src/main/sampler-worker.ts (runSamplerJob params extended; loadSkeleton call uses loaderOpts builder; workerData consumption threads data.loaderMode)"
    - "src/main/project-io.ts (5 sites updated: handleProjectOpenFromPath ×2, handleProjectReloadWithSkeleton ×3 incl. new validator, handleProjectResample ×2)"
    - "tests/core/project-file.spec.ts (3 new tests for D-08 round-trip + 5 cascade fixes adding mandatory loaderMode to existing AppSessionState/ProjectFileV1 literals)"
    - "tests/main/project-io.spec.ts (1 cascade fix — baseState gains loaderMode: 'auto')"

key-decisions:
  - "RunSamplerJobParams remained an inline parameter object (no named interface in the existing module) — extended the inline type rather than introducing a new exported interface."
  - "Recovery-path validator defaults to 'auto' (canonical mode) when a.loaderMode is missing or invalid — pre-Plan-08 renderer builds dispatching the recovery flow see canonical-mode behavior, the safer fallback (won't accidentally re-canonicalize an atlas-less project; it just re-canonicalizes IF the user happened to be on an old build, which preserves data correctness over UX continuity)."
  - "ResampleArgs IPC payload widened with loaderMode? rather than forcing the renderer to pre-validate — main re-validates as defense in depth (T-09-06-RESAMPLE pattern preserved)."
  - "Cascade fix to tests/main/project-io.spec.ts (NOT in plan files_modified) handled as Rule 3 blocking-issue: Task 1's mandatory-field type widening on AppSessionState directly broke this test's baseState literal — a single-line `loaderMode: 'auto'` addition resolved the typecheck and let the suite stay green."
  - "AppShell.tsx error left for Plan 08 — explicitly Plan 08 territory per 21-07 plan's success criterion ('typecheck remaining errors only in AppShell.tsx'). Plan 08 will add loaderMode to buildSessionState alongside the renderer toggle UI."

requirements-completed: [LOAD-01]

# Metrics
duration: ~15min
completed: 2026-05-01
tasks: 4
files_modified: 6
new_tests: 3
total_vitest_passing: 612
typecheck_remaining: "1× AppShell.tsx loaderMode error (Plan 08 territory) + 3 pre-existing (probe-per-anim.ts:14 + 2× panel TS6133 — deferred-items.md confirms pre-existing on base commit f09c29b)"
---

# Phase 21 Plan 07: stmproj Schema (loaderMode persistence) Summary

**Per-project `loaderMode: 'auto' | 'atlas-less'` field added to `.stmproj` v1 schema with full validate-pre-massage / per-field-validator / serialize / materialize plumbing, plus threaded through `SamplerWorkerData` and 5 `project-io.ts` `loadSkeleton`/`runSamplerInWorker` invocation sites including the recovery-path validator that reads renderer-supplied `a.loaderMode`. Closes the persistence half of D-08 — the user's atlas-less choice now survives Save → Reopen.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 4 (all `type="auto"`)
- **Files modified:** 6
- **Commits:**
  - `4027411` — feat(21-07): add loaderMode field to ProjectFileV1, AppSessionState, SamplerWorkerData (Task 1)
  - `85d206a` — feat(21-07): wire loaderMode through project-file.ts validate/serialize/materialize (Task 2)
  - `5143d8a` — feat(21-07): thread loaderMode through sampler-worker.ts (Task 3)
  - `e8ced02` — feat(21-07): thread loaderMode through 5 project-io.ts sites + ResampleArgs IPC (Task 4)

## Tasks Completed

### Task 1: Extend shared/types.ts

`ProjectFileV1`, `AppSessionState`, and `SamplerWorkerData` extended with the new `loaderMode` field. ProjectFileV1 + AppSessionState are mandatory `'auto' | 'atlas-less'`; SamplerWorkerData is optional (backward-compat — undefined → atlas-by-default semantics).

Typecheck after Task 1 surfaced expected pinpoint errors at consumer sites: project-file.ts (serializer + materializer return shape), tests/core/project-file.spec.ts (5 literal sites), tests/main/project-io.spec.ts (1 baseState literal). All resolved by Tasks 2-4 + cascade fixes.

### Task 2: Wire loaderMode through project-file.ts

Five surface changes per the RESEARCH.md §Pitfall 6 template:
- **Pre-massage** (line ~155): `if (obj.loaderMode === undefined) obj.loaderMode = 'auto'` — forward-compat for Phase 8/20-era files.
- **Per-field check** (lines ~158-163): rejects values other than `'auto'`/`'atlas-less'` with `invalid-shape` envelope.
- **PartialMaterialized.loaderMode**: required `'auto' | 'atlas-less'`.
- **serializeProjectFile**: appends `loaderMode: state.loaderMode` to the v1 return object.
- **materializeProjectFile**: appends `loaderMode: file.loaderMode ?? 'auto'` (defence-in-depth).

Three new tests in `tests/core/project-file.spec.ts` under describe `'Phase 21 — loaderMode (D-08)'`:
1. `validateProjectFile pre-massages missing loaderMode to "auto"` (forward-compat for Phase 8/20-era files)
2. `validateProjectFile rejects loaderMode values other than "auto"/"atlas-less"` (e.g., `'packed'`)
3. `serialize → materialize round-trips loaderMode: "atlas-less" identically`

Cascade fixes (Rule 3 — direct cause: Task 1's mandatory-field type widening): added `loaderMode: 'auto'` to 5 existing AppSessionState/ProjectFileV1 literals in project-file.spec.ts and 1 in project-io.spec.ts (`baseState`).

vitest: `tests/core/project-file.spec.ts` 21/21 passing (+3 new tests).

### Task 3: Thread loaderMode through sampler-worker.ts

- `runSamplerJob` inline params type gains `loaderMode?: 'auto' | 'atlas-less'`.
- `loadSkeleton` call inside `runSamplerJob` switched to a `loaderOpts: { atlasPath?, loaderMode? }` builder — atlasRoot still threads as `atlasPath`, loaderMode threads only when present (preserves the original conditional-emptyness for backward-compat).
- `workerData` consumption at parentPort entry adds `loaderMode: data.loaderMode` to the `runSamplerJob` invocation.

typecheck: 0 errors in sampler-worker.ts. vitest: 612 passing (no regression).

### Task 4: Thread loaderMode through 5 project-io.ts sites

The five invocation sites that touch `loadSkeleton` or `runSamplerInWorker`:

| Site | Function | Line | Change |
|------|----------|------|--------|
| **1** | `handleProjectOpenFromPath` loadSkeleton | ~407-411 | `loaderOpts` builder; threads `materialized.loaderMode === 'atlas-less'` |
| **2** | `handleProjectOpenFromPath` runSamplerInWorker | ~492 | adds `loaderMode: materialized.loaderMode` to SamplerWorkerData payload |
| **3** | `handleProjectReloadWithSkeleton` (recovery) | ~666 + 681 + 740 | NEW string-literal validator at line 666 reading `a.loaderMode === 'atlas-less' ? 'atlas-less' : 'auto'`; loadSkeleton uses loaderOpts builder; runSamplerInWorker threads local `loaderMode` const |
| **4** | `handleProjectResample` loadSkeleton | ~870 | `loaderOpts` builder; threads `a.loaderMode === 'atlas-less'` |
| **5** | `handleProjectResample` runSamplerInWorker | ~915-927 | dedicated `resampleLoaderMode` string-literal coercion (`auto`/`atlas-less`/`undefined`) threaded into SamplerWorkerData |

`ResampleArgs` IPC payload (src/shared/types.ts) widened with `loaderMode?: 'auto' | 'atlas-less'` so resample preserves D-08 across the SettingsDialog Apply round-trip.

**Recovery-branch design note (D-08 preservation through recovery flow):** the recovery handler does NOT have access to a materialized project at the loadSkeleton call site — `project-io.ts:597-621` docblock explains: "the materialized state was constructed before the reload was triggered, then discarded." The renderer (Plan 08) holds `loaderMode` in its `useState` slot and dispatches it in the recovery args alongside `mergedOverrides`/`samplingHz`/etc. Plan 07's Site 3 validates + threads `a.loaderMode` so the recovery loadSkeleton call honors the user's per-project choice; pre-Plan-08 renderer builds default to `'auto'` (safer fallback — re-canonicalizes rather than corrupting atlas-less projects).

typecheck: 0 errors in project-io.ts. vitest: 612 passing.

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` (node) | 1 pre-existing error (`probe-per-anim.ts:14` — pre-existing per deferred-items.md D-21-WORKTREE-1 sibling) |
| `npm run typecheck:web` | 1 expected AppShell.tsx loaderMode error (Plan 08 territory per plan success criterion) + 2 pre-existing TS6133 panel warnings (deferred-items.md confirms pre-existing on base commit `f09c29b`) |
| `npx vitest run tests/core/project-file.spec.ts` | 21/21 passing (+3 new D-08 tests) |
| `npm run test` (full suite) | 612/612 passing, 1 skipped, 2 todo |
| All 4 files have loaderMode | ✓ shared/types.ts, core/project-file.ts, main/sampler-worker.ts, main/project-io.ts |
| Recovery path validates a.loaderMode | ✓ `a.loaderMode === 'atlas-less' ? 'atlas-less' : 'auto'` at line 666; threaded into both loadSkeleton (line 681) and runSamplerInWorker (line 740) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Cascade fix to tests/main/project-io.spec.ts**
- **Found during:** Task 2 typecheck after Task 1's mandatory-field widening
- **Issue:** `tests/main/project-io.spec.ts:74` `baseState: AppSessionState` literal missing the now-mandatory `loaderMode` field — typecheck error blocked the test suite.
- **Fix:** Added `loaderMode: 'auto'` to the literal (canonical-mode default; matches the cascade pattern in project-file.spec.ts).
- **Files modified:** `tests/main/project-io.spec.ts`
- **Commit:** `85d206a` (bundled with Task 2 since same root cause as project-file.spec.ts cascade fixes)
- **Why this isn't a deviation in spirit:** plan's `<files_modified>` listed `tests/core/project-file.spec.ts` because the plan's test work focuses there; `tests/main/project-io.spec.ts` was caught by typecheck as a Task-1-direct-blocker and fixed inline per Rule 3. The plan explicitly anticipated cascade fixes via the deviation rules.

**2. [Rule 3 — Naming] No `RunSamplerJobParams` interface in sampler-worker.ts**
- **Found during:** Task 3
- **Issue:** Plan instructed to "extend RunSamplerJobParams" but no such named interface exists in the module — `runSamplerJob` uses an inline parameter object type.
- **Fix:** Extended the inline type (`params: { skeletonPath: string; ...; loaderMode?: 'auto' | 'atlas-less' }`); semantically equivalent. Acceptance-criteria grep adapted accordingly (`grep loaderMode` inside the runSamplerJob params block, not `awk /interface RunSamplerJobParams/`).
- **Why kept:** The plan's `<acceptance_criteria>` was based on the assumption of a named interface. Verified the inline type is the canonical existing shape — no refactor warranted.

### Authentication Gates

None.

### Architectural Changes (Rule 4)

None — fully additive type extension + 6 surgical insertions across 4 files.

## Threat Flags

None — Plan stayed within the existing threat surface (T-21-07-01..06 from the plan's STRIDE register). No new endpoints, auth paths, file access patterns, or schema changes outside the documented `loaderMode` field.

## Self-Check

Files created/modified verification:
- `src/shared/types.ts` — FOUND, contains loaderMode (4 occurrences across ProjectFileV1, AppSessionState, SamplerWorkerData, ResampleArgs)
- `src/core/project-file.ts` — FOUND, contains loaderMode (5 occurrences: pre-massage, per-field check, PartialMaterialized, serialize, materialize back-fill)
- `src/main/sampler-worker.ts` — FOUND, contains loaderMode (3 occurrences: params type, loaderOpts builder, workerData threading)
- `src/main/project-io.ts` — FOUND, contains loaderMode (5 sites)
- `tests/core/project-file.spec.ts` — FOUND, contains 'Phase 21 — loaderMode (D-08)' describe block + 3 new tests
- `tests/main/project-io.spec.ts` — FOUND, baseState contains loaderMode

Commits verified in git log:
- `4027411` FOUND
- `85d206a` FOUND
- `5143d8a` FOUND
- `e8ced02` FOUND

## Self-Check: PASSED

## Notes for Plan 08 (next consumer)

- **AppShell.tsx loaderMode error** is the EXPECTED single typecheck error remaining after this plan. Plan 08 will:
  1. Add `loaderMode` to `buildSessionState()` at AppShell.tsx:610 (currently the only failing site).
  2. Add a useState slot for `loaderMode: 'auto' | 'atlas-less'` seeded from `MaterializedProject` (note: this plan does NOT thread loaderMode into `MaterializedProject` — that's a small Plan 08 follow-up; the materialized state in main HAS the field, but the IPC envelope `MaterializedProject` shape needs to add it. Alternative: Plan 08 reads it from `summary.atlasPath === null` heuristically, but explicit threading is cleaner).
  3. Populate `loaderMode` in the recovery dispatch payload (the `reloadProjectWithSkeleton` args) so the recovery branch's `a.loaderMode` validator (Site 3 in this plan) reads the user's actual choice rather than always defaulting to `'auto'`.
  4. Populate `loaderMode` in the resample dispatch payload (`ResampleArgs.loaderMode`) so the resample branch (Sites 4+5 in this plan) preserves D-08 across SettingsDialog Apply.
- **`MaterializedProject.loaderMode`** is NOT in this plan's surface. The renderer can derive it from the to-be-added field, or Plan 08 can extend `MaterializedProject` to mirror `AppSessionState`. Recommendation: extend `MaterializedProject` for symmetry with `documentation` (which is already mirrored).
