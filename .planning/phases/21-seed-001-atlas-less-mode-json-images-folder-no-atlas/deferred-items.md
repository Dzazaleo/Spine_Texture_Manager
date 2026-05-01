# Phase 21 — Deferred items

Issues discovered during plan execution that are out-of-scope and tracked here for triage.

## 21-05 (types cascade)

- **Pre-existing TS6133 warnings** (verified by stashing this plan's diffs and re-running `npm run typecheck` against the base commit `f09c29b`):
  - `src/renderer/src/panels/AnimationBreakdownPanel.tsx:286` — `'onQueryChange' is declared but its value is never read.`
  - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:531` — `'onQueryChange' is declared but its value is never read.`
  - Out of scope for Plan 21-05 (pure type cascade for atlasPath/SourceDims/LoaderOptions); did NOT touch these panel files. Both warnings exist on the unmodified base — not caused by this plan.

- **Pre-existing vitest failure:** `tests/main/sampler-worker-girl.spec.ts` — "warm-up run must complete (not error/cancel)". Verified by stashing this plan's diffs and running the spec on the base commit `f09c29b` — same failure. Not caused by Plan 21-05's type widening (the test never touches `atlasPath`, `SourceDims.source`, or `LoaderOptions.loaderMode`). Likely caused by missing `fixtures/Girl` test fixture or environment-specific harness state.
