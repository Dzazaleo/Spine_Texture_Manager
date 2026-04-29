# Phase 14 Deferred Items

Issues discovered during execution that are out of scope.

## 14-01 — sampler-worker-girl.spec.ts pre-existing failure

- **Discovered during:** Plan 14-01 GREEN verification (running full `tests/main/`).
- **File:** `tests/main/sampler-worker-girl.spec.ts`
- **Symptom:** "warm-up run must complete (not error/cancel)" — warm-up resolves with `type='error'` instead of `'complete'` on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`.
- **Why deferred:** This spec exercises the sampler worker on a Girl fixture, an entirely separate subsystem from auto-update. Verified pre-existing by stashing 14-01 changes and re-running the spec — fails identically. Plan 14-01 only modifies `src/main/auto-update.ts` and (next task) `src/main/ipc.ts`, neither of which is reachable from this test.
- **Owner:** Sampler subsystem maintainer; out of scope for Phase 14 (which is auto-update reliability only).
