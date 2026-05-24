---
phase: 53-persist-variant-state-in-stmproj
plan: 01
subsystem: database
tags: [stmproj, persistence, project-file, additive-schema, validator, variant-export, scaleui]

# Dependency graph
requires:
  - phase: 51-batch-variant-export
    provides: "the multi-row VariantDialog whose { id, scale }[] rows this persists"
  - phase: 30-safety-buffer (precedent)
    provides: "the additive-optional .stmproj field pattern (safetyBufferPercent) copied verbatim"
provides:
  - "variantRows: { scale: number }[] declared on ProjectFileV1 / AppSessionState / MaterializedProject / PartialMaterialized"
  - "validator missing->[{ scale: 0.5 }] pre-massage + finite-scale shape rejection"
  - "serialize (scales only) + materialize back-fill in pure core"
  - "variantRows threaded into main's Open-response assembly"
  - "AppShell.buildSessionState save-half wiring (lifted { id, scale }[] -> persisted { scale }[])"
  - "core + main test contract (round-trip, back-compat, reject-bad, no-version-bump, SC#3 stale-dir + no-fs-check grep guard)"
affects: [53-02-renderer-wiring, variant-export, save-load]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4th instance of the locked additive-optional .stmproj field pattern (no version bump)"
    - "Array+finite-element validator pre-massage composing the scalar-default idiom with the overridesAtlasLess finite-number loop"

key-files:
  created:
    - .planning/phases/53-persist-variant-state-in-stmproj/deferred-items.md
  modified:
    - src/shared/types.ts
    - src/core/project-file.ts
    - src/main/project-io.ts
    - src/renderer/src/components/AppShell.tsx
    - tests/core/project-file.spec.ts
    - tests/main/project-io.spec.ts
    - tests/core/project-file-loader-mode-heal.spec.ts

key-decisions:
  - "Persisted element shape is { scale: number }[] (D-05 discretion — forward-extensible over bare number[])"
  - "V_LATEST stayed 1; migrate() untouched (D-05 additive-no-version-bump)"
  - "No fs existence check added on lastOutDir (D-02/SC#3 — saved dir is a picker hint only)"
  - "Recovery-envelope + ResampleArgs threading DEFERRED (Task 1 NOTE) — rows reset to default on the rare missing-skeleton-on-open recovery hop"

patterns-established:
  - "variantRows validator: reject non-array + any element whose scale is not Number.isFinite (mitigates T-53-01/T-53-02); accept empty []"
  - "serialize defensively projects to { scale } only via map + `?? []` (strips ephemeral id/activePx; tolerates partial-cast state)"

requirements-completed: [SCALEUI-03]

# Metrics
duration: ~35min
completed: 2026-05-24
---

# Phase 53 Plan 01: Persist variantRows in .stmproj (data tier) Summary

**`variantRows: { scale: number }[]` added end-to-end at the data tier — shared types + pure-core validator/serialize/materialize + main Open-response assembly — as the 4th additive-optional `.stmproj` field (no version bump), with the full core + main test contract and a defensive save-half AppShell wiring.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-05-24
- **Tasks:** 2
- **Files modified:** 7 (+1 created: deferred-items.md)

## Accomplishments
- `variantRows` declared on `ProjectFileV1`, `AppSessionState`, `MaterializedProject` (types.ts) + `PartialMaterialized` (project-file.ts).
- Pure-core validator pre-massages missing → `[{ scale: 0.5 }]` and rejects non-array / non-finite-scale / wrong-shape elements (SC#2 + tampering mitigations T-53-01/T-53-02); accepts empty `[]`.
- Serialize writes scales only; materialize back-fills the default; main threads `variantRows` into the Open response (SC#1 data tier).
- Full core test block (8 cases) + main test block (5 cases incl. SC#3 stale-dir + no-fs-check grep guard) — all green.
- `V_LATEST` stays `1`; no fs check added on `lastOutDir`; Layer-3 purity preserved.

## Task Commits

1. **Task 1: Declare + validate + serialize + materialize variantRows** - `78e84a2` (feat)
2. **Task 2: Core + main test contract for variantRows** - `169317e` (test)

_Note: this plan's tasks are a data-tier layered split (implementation, then the full test contract) per the plan's own task structure and `<done>` note._

## Files Created/Modified
- `src/shared/types.ts` - `variantRows: { scale: number }[]` on the 3 round-trip interfaces.
- `src/core/project-file.ts` - validator pre-massage + finite-scale shape check, serialize map (`?? []` defensive), `PartialMaterialized` member, materialize nullish-coalesce.
- `src/main/project-io.ts` - thread `variantRows` into the Open assembly (:697); default the single 0.5 row at the deferred locate-skeleton-recovery (:1090) and resample (:1383) re-materialize sites.
- `src/renderer/src/components/AppShell.tsx` - `buildSessionState` projects the lifted `{ id, scale }[]` rows to persisted `{ scale }[]` (save half) + dep-array entry.
- `tests/core/project-file.spec.ts` - `Phase 53 — variantRows (SCALEUI-03)` describe (8 cases) + literal sweep.
- `tests/main/project-io.spec.ts` - `Phase 53 — variantRows + lastOutDir persistence` describe (save/load/SC#2/SC#3/grep-guard) + baseState sweep.
- `tests/core/project-file-loader-mode-heal.spec.ts` - literal sweep (`variantRows` on the `ProjectFileV1` baseFile).
- `.planning/phases/53-.../deferred-items.md` - 2 out-of-scope fixture-absence sampler failures.

## Decisions Made
- **Persisted element shape = `{ scale: number }[]`** (D-05 discretion — chosen over bare `number[]` for forward-extensibility; ephemeral row `id`/`activePx` never serialized).
- **`V_LATEST` stayed `1`, `migrate()` untouched** (D-05 additive-no-version-bump precedent).
- **No fs existence check added on `lastOutDir`** (D-02/SC#3 — the always-open native picker makes the saved dir a harmless start hint; a grep-guard test enforces this).
- **Recovery-envelope / `ResampleArgs` threading DEFERRED** (Task 1 NOTE) — the locate-skeleton-recovery and resample re-materialize paths default `variantRows` to `[{ scale: 0.5 }]`. **Consequence:** on the rare missing-skeleton-on-open recovery hop, the dialog's rows reset to the single default row. This is not an SC and is acceptable; full threading would widen the blast radius (SerializableError envelope + App.tsx recovery arm + handleProjectReloadWithSkeleton + ResampleArgs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] serialize threw on a partial-cast AppSessionState (missing variantRows)**
- **Found during:** Task 2 (per-wave full `npm run test` run)
- **Issue:** `tests/core/documentation-roundtrip.spec.ts` builds an `AppSessionState` via a `Partial` + `as AppSessionState` cast that omits `variantRows`; my serialize did `state.variantRows.map(...)` which threw `TypeError` (the existing spread fields `{...state.overrides}` tolerate `undefined`, but `.map` does not).
- **Fix:** `serializeProjectFile` now uses `(state.variantRows ?? []).map(...)`, mirroring the spread-tolerates-undefined behaviour of the neighbouring `overrides`/`overridesAtlasLess` fields. Real callers always provide the field; the fallback is purely defensive for partial-cast states.
- **Files modified:** `src/core/project-file.ts`
- **Verification:** `documentation-roundtrip.spec.ts` 3/3 green; full suite +2 recovered (1509→1511 passed).
- **Committed in:** `169317e`

**2. [Rule 3 - Blocking] AppShell buildSessionState broke typecheck:web (variantRows now required)**
- **Found during:** Task 2 (per-wave `typecheck:web`)
- **Issue:** Making `variantRows` a required field on `AppSessionState` broke `src/renderer/src/components/AppShell.tsx:1061` (`buildSessionState` returns an `AppSessionState` literal without the field), failing the per-wave `typecheck:web` gate.
- **Fix:** `buildSessionState` now projects the already-lifted `variantRows` state (`{ id, scale }[]` at AppShell:565) to the persisted `{ scale }[]` shape, and `variantRows` was added to the `useCallback` dep array. This is the save half only; the full restore-on-load + dirty wiring (D-03) is plan 53-02's job.
- **Files modified:** `src/renderer/src/components/AppShell.tsx`
- **Verification:** `typecheck:web` and `typecheck:node` both exit 0.
- **Committed in:** `169317e`

**3. [Rule 3 - Blocking] two extra source MaterializedProject construction sites required the field**
- **Found during:** Task 1 (`typecheck:node`)
- **Issue:** Besides the Open assembly (:656), `src/main/project-io.ts` constructs `MaterializedProject` at the locate-skeleton-recovery (:1049) and resample (:1296) re-materialize paths — both failed to compile once the field became required.
- **Fix:** Both sites default `variantRows: [{ scale: 0.5 }]` (mirroring their existing `documentation: { ...DEFAULT_DOCUMENTATION }` default), per the plan's explicit recovery-envelope-deferral NOTE.
- **Files modified:** `src/main/project-io.ts`
- **Verification:** `typecheck:node` exits 0.
- **Committed in:** `78e84a2`

---

**Total deviations:** 3 auto-fixed (1 Rule-1 bug, 2 Rule-3 blocking). All necessary for the type contract / per-wave green gates. No scope creep — the AppShell change is the minimal save-half wiring required to keep typecheck:web green; the recovery/resample defaults are mandated by the plan's deferral NOTE.

## Issues Encountered
- **2 pre-existing fixture-absence test failures (out of scope, logged to deferred-items.md):** `tests/main/sampler-worker-girl.spec.ts` (needs absent `fixtures/Girl/`) and `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (needs gitignored proprietary `fixtures/SAMPLER_ALPHA_ZERO/`). Both use the loader against missing fixtures and error in setup; both SKIP cleanly under `CI=true` (verified), proving they are environment-only and unrelated to this data-tier change. No fix attempted (SCOPE BOUNDARY).

## Verification Confirmation
- `npm run typecheck:node` exits 0; `npm run typecheck:web` exits 0.
- `npx vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts` → 82 passed.
- `npx vitest run tests/core/project-file.spec.ts -t "variantRows"` → 8 passing (>= 6 required).
- `npx vitest run tests/core/project-file.spec.ts -t "missing variantRows"` → 1 passing (SC#2).
- `npx vitest run tests/main/project-io.spec.ts -t "lastOutDir"` → 4 passing (SC#3 stale-dir + grep guard).
- `tests/arch.spec.ts` → 20 passed (Layer-3 purity preserved; no new DOM/Electron/sharp/node:fs import in project-file.ts).
- `grep "V_LATEST = 1" src/core/project-file.ts` still matches (D-05 no version bump).
- No `existsSync`/`access`/`stat` keyed on `lastOutDir`/`variantOutputDir` in `src/main/project-io.ts` (D-02/SC#3).
- Full suite: 1511 passed / 24 skipped / 2 todo; only the 2 documented fixture-absence failures remain.

## Next Phase Readiness
- **Plan 53-02 (renderer wiring) is unblocked:** the data tier is complete. 53-02 must add (a) the restore-on-load path (re-seed AppShell's lifted `variantRows` with fresh `crypto.randomUUID()` ids from `MaterializedProject.variantRows` on Open / `mountOpenResponse`), and (b) the D-03 dirty derivation comparing the persisted *scale projection* (order-sensitive) against the last-saved snapshot — NOT the full `{ id, scale }` objects (ids regenerate on load). The save half (`buildSessionState`) is already wired here.
- **Deferred (not a blocker):** recovery-envelope + `ResampleArgs` threading of `variantRows` (rows reset to default on the rare missing-skeleton-on-open recovery hop).

## Self-Check: PASSED

- All created/modified files verified present on disk (SUMMARY, deferred-items, 7 source/test files).
- Both task commits verified in git log (`78e84a2`, `169317e`).

---
*Phase: 53-persist-variant-state-in-stmproj*
*Completed: 2026-05-24*
