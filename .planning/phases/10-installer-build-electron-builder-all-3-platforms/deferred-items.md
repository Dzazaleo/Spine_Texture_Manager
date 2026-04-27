# Phase 10 Deferred Items

Items discovered during Phase 10 execution but out of scope. Logged for the verifier; not addressed in this phase.


## 10-02 — Pre-existing test failure (out of scope)

- **Test:** `tests/main/sampler-worker-girl.spec.ts` — "fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms"
- **Failure:** warm-up worker run returns `type: 'error'` instead of `'complete'`. AssertionError at line 38.
- **Confirmed pre-existing:** Verified by running `npm run test` on the base commit `9948959` — same 1/333 failure observed without any Plan 10-02 changes.
- **Why deferred:** Plan 10-02 only modifies `electron-builder.yml`. The failing test exercises Phase 9 worker_threads sampler logic on `fixtures/Girl/`. Out of scope per executor SCOPE BOUNDARY rule.
- **Owner:** Phase-9 maintenance / pre-existing-issue triage.

