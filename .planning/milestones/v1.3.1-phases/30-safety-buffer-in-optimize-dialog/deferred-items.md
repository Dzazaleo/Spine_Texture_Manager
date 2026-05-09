# Phase 30 deferred items

## Pre-existing tsc errors (out of scope, not caused by this phase)

The following tsc errors under `tsconfig.node.json` predate this phase's work and are NOT caused by Phase 30 type additions:

1. `tests/core/analyzer.spec.ts:647,654` — `pageName` property mismatch on `atlasSources` Map type. Last touched in commit a5b5ee9 (Phase 29-06). Test fixture vs. type drift.
2. `tests/core/documentation.spec.ts:233` — `SkeletonSummary` cast missing `regions` property. Phase 29 added `regions` to summary; this older cast was not updated.
3. `tests/core/project-file-loader-mode-heal.spec.ts:16` — `ProjectFileV1` declared locally but not exported. Phase 21 era; never re-exported from `project-file.ts` itself.

These should be addressed in a future hygiene/cleanup phase (or as sub-fixes when those subsystems are next touched). Phase 30 only touched test fixture sites that became invalid after the new required `safetyBufferPercent` field on `AppSessionState` / `ProjectFileV1`.

## Pre-existing test failures (out of scope)

These vitest failures predate Phase 30 — confirmed by stashing this phase's edits and re-running against the base commit (31801d8):

1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — `SkeletonJsonNotFoundError: fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` missing on disk. 7 tests skipped/failed at suite-load.
2. `tests/main/sampler-worker-girl.spec.ts` — wall-time gate failure ("warm-up run must complete (not error/cancel)"); the fixtures/Girl rig produces a worker error, not a timeout. Pre-existing fixture/worker issue.

Neither failure is caused by Phase 30 type/persistence changes. Same `1 failed | 878 passed` ratio observed at HEAD~4 (pre-Phase-30) and at HEAD (post-Phase-30).

## Pre-existing OptimizeDialog null-vs-undefined gap (out of scope; surfaced by Plan 30-04 IPC test)

`src/renderer/src/modals/OptimizeDialog.tsx:776` checks `props.summary !== null` before reading `props.summary.successes`. The check does NOT catch `undefined`, so when `startExport` resolves with `{ ok: true }` and no `summary` field, `props.summary` is `undefined` and the InProgressBody render crashes with `Cannot read properties of undefined (reading 'successes')`.

Plan 30-04 IPC test (`reactive plan rebuild — Phase 30 CR-01 closure → post-mount buffer change → startExport receives plan with rebuilt outW`) exposed this when triggering Start with a partial mock. The test's mock now returns a complete ExportSummary shape (`{ successes: 1, errors: [], durationMs: 100, cancelled: false }`) to avoid the crash. The underlying production gap (use `!=` not `!==` in the null check, OR ensure `startExport` IPC contract always carries `summary`) is OUT OF SCOPE for Plan 30-04 per the executor SCOPE BOUNDARY rule. Recommend a small Rule-1 fix in a future hygiene phase or whenever OptimizeDialog is next touched.
