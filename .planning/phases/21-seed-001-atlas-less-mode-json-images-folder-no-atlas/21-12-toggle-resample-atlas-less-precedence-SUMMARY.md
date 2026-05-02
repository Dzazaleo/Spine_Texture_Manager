---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 12
subsystem: project-io + sampler-worker
tags: [project-io, sampler-worker, loader-options, precedence, gap-closure, G-04, atlas-less, toggle-resample, caller-side-fix]

# Dependency graph
requires:
  - phase: 21
    plan: 09
    provides: synth.missingPngs / LoadResult.skippedAttachments wiring (the field that the toggle-resample path was failing to populate)
  - phase: 21
    plan: 10
    provides: MissingAttachmentsPanel + skippedAttachments IPC cascade (the UI surface that becomes correct when the toggle-resample path actually populates skippedAttachments)
  - phase: 21
    plan: 06
    provides: Loader's documented 4-way branch order (D-05/D-06/D-07/D-08) — preserved verbatim by this plan
provides:
  - Caller-side precedence pattern at all 4 LoaderOptions construction sites — when loaderMode === 'atlas-less', omit atlasPath so the loader's D-08 synthesis branch runs
  - Path-symmetric atlas-less behavior — cold-load atlas-less + toggle-resample atlas-less now produce the same summary.skippedAttachments shape for the same fixture-with-missing-PNG state
  - 4 G-04 regression tests (2 loader-contract + 1 IPC integration + 1 worker-boundary) locking the caller contract for future maintainers
affects:
  - HUMAN-UAT Test 4b Path 2 (canonical project + delete one PNG + toggle "Use Images Folder as Source" ON) — now produces MissingAttachmentsPanel surfacing the missing entry; was silently empty pre-fix
  - HUMAN-UAT Test 4c (region-attachment + missing PNG via toggle path) — same root cause, closed automatically by this fix

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Caller-side precedence: when both loaderMode and atlasPath are available at the IPC/worker boundary, the caller decides which branch to invoke by SHAPING the LoaderOptions object — pass loaderMode WITHOUT atlasPath to force D-08 synthesis; pass atlasPath alone to force D-06 explicit-atlas. The loader's documented branch order (D-06 first when atlasPath is set) is the contract; the caller's job is to produce the correct LoaderOptions shape for the user-facing intent."
    - "Falsifying-gate test design via atlas synthesis: when a falsifying test pairs a fixture JSON (referencing region X) with a real .atlas that doesn't contain X, the stock AtlasAttachmentLoader throws Region-not-found before the test's load-bearing assertion is reached. Tests that need D-06 to SUCCEED so the assertion shape is reachable must SYNTHESIZE an inline tmp .atlas containing the referenced region (libgdx 4.2 stub-region grammar: `<page>.png\\nsize: 1,1\\nfilter: Linear,Linear\\n<region>\\nbounds: 0,0,1,1`). This makes the load-bearing falsifying property something other than `result.ok === true`."

key-files:
  created:
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-SUMMARY.md (this file)
  modified:
    - src/main/project-io.ts (Sites 1, 3, 4 — Sites 1+4 behavior changes; Site 3 audit-comment cross-reference)
    - src/main/sampler-worker.ts (Site 5 behavior change)
    - tests/core/loader-atlas-less.spec.ts (+84 lines: G-04 Tests 7+8 — loader contract + caller-correct shape)
    - tests/main/project-io.spec.ts (+124/-36 lines: electron mock extended with getAllWindows; runSamplerInWorker mock at sampler-worker-bridge.js path; new G-04 IPC describe block + falsifying-regression test)
    - tests/main/sampler-worker.spec.ts (+80 lines: new G-04 (Site 5) describe block + worker-boundary falsifying test invoking runSamplerJob directly)
  unchanged-deliberately:
    - src/core/loader.ts — branch order preserved verbatim (D-06 still wins when both options set; ROADMAP success criterion #5 verbatim AtlasNotFoundError preserved)

key-decisions:
  - "Caller-side fix only — NOT a loader-side branch reorder. The loader's documented branch order at src/core/loader.ts:219-254 is the locked contract from Plan 21-06; reordering would invert criterion #5 (verbatim AtlasNotFoundError on explicit-atlasPath fail) and break every existing canonical-mode test. The bug is semantically caller-side: the IPC handler (and worker) knows the user just toggled the loaderMode override; the loader doesn't. The fix moves the precedence decision to where the user-intent signal lives."
  - "All 4 sites use the same precedence pattern — `if (loaderMode === 'atlas-less') { loaderOpts.loaderMode = 'atlas-less'; /* omit atlasPath */ } else if (atlasPath !== undefined) { loaderOpts.atlasPath = atlasPath; }`. Sites 1 + 4 (project-io.ts) + Site 5 (sampler-worker.ts) received the new precedence shape; Site 3 (project-io.ts handleProjectReloadWithSkeleton) was already shape-correct (atlasPath always omitted per F1.2 sibling-discovery semantic) and only received an audit comment cross-referencing the new convention."
  - "Test 7 atlas synthesis (Plan-revision Issue #1) — pairing fixture MeshOnly_TEST.json with the canonical fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas (which lacks MESH_REGION) would have triggered the stock AtlasAttachmentLoader's `Region not found in atlas` throw before reaching test assertions. Test 7 + Task 3's IPC test SYNTHESIZE an inline tmp .atlas containing MESH_REGION with stub-region bounds (0,0,1,1) so the D-06 read SUCCEEDS pre-fix. This makes the load-bearing falsifying property be `result.project.summary.skippedAttachments.length === 1`, NOT `result.ok === true` (both pre-fix and post-fix have ok:true)."
  - "Result-path correctness (Plan-revision Issue #2) — the IPC integration test asserts `result.project.summary.skippedAttachments`, NOT `result.summary.skippedAttachments`. The OpenResponse shape (src/shared/types.ts:790-792) is `{ ok: true; project: MaterializedProject }`, so the summary is nested at `.project.summary`. The earlier draft used `result.summary` which would compile but evaluate to `undefined`."
  - "Electron mock extension for Site 4 IPC test (Plan-revision Issue #4) — `handleProjectResample` reads `BrowserWindow.getAllWindows()[0]?.webContents` at project-io.ts:937. The pre-existing electron mock at tests/main/project-io.spec.ts:22-32 only provided `getFocusedWindow`; without `getAllWindows: vi.fn(() => [])` the call would throw TypeError before reaching test assertions. Added inline."
  - "runSamplerInWorker mock path correctness (Plan-revision Issue #5) — verified via grep: `import { runSamplerInWorker } from './sampler-worker-bridge.js'` at src/main/project-io.ts:60. Mock module path from tests/main/ is therefore `'../../src/main/sampler-worker-bridge.js'` (the test path explicitly used the verified literal, not a placeholder)."
  - "Site 5 standalone falsifier (Plan-revision Issue #6) — Task 3 mocks runSamplerInWorker at the bridge boundary, which means runSamplerJob (where Site 5 lives) is never invoked from the IPC test. Without Task 4, Site 5's fix would have no automated falsifier and would rely solely on parity with Sites 1 + 4. Task 4 directly invokes runSamplerJob with both atlasRoot + loaderMode='atlas-less' against an inline tmp .atlas containing OTHER_REGION (NOT MESH_REGION) — pre-fix the stock loader throws Region-not-found at D-06 → result.type === 'error'; post-fix D-08 synthesis runs → result.type === 'complete'. Falsifying property is `result.type === 'complete'`."

requirements-completed: []  # Plan is gap_closure for an empirically-pinned UAT defect; LOAD-01 was already marked closed by Plans 21-01..08; this plan strengthens its IPC-handler robustness without re-opening the requirement.

# Metrics
duration: ~25min
completed: 2026-05-02
---

# Phase 21 Plan 21-12: Toggle-Resample Atlas-Less Precedence Summary

**G-04 closed via caller-side LoaderOptions precedence fix at IPC + worker boundaries — toggle "Use Images Folder as Source" ON now correctly routes through D-08 synthesis even when canonical state coexists, surfacing missing PNGs through the existing skippedAttachments → MissingAttachmentsPanel cascade.**

## Performance

- **Duration:** ~25 min (4 atomic commits + 2 falsifying-gate scratch reverts + 1 Rule 1 recovery commit for an accidental working-tree revert during the Site-4 falsifying-gate verification)
- **Started:** 2026-05-02T20:30:00Z
- **Completed:** 2026-05-02T20:55:00Z
- **Tasks:** 4 (RED contract tests → GREEN fix at 4 sites → falsifying IPC test → falsifying worker-boundary test)
- **Commits:** 5 (179b1dd test → de99e84 fix → 0a31aee test → fee0070 fix-recovery → 9b70056 test)
- **Files created:** 1 (this SUMMARY)
- **Files modified:** 5 (project-io.ts, sampler-worker.ts, loader-atlas-less.spec.ts, project-io.spec.ts, sampler-worker.spec.ts)
- **Loader untouched:** `git diff --name-only HEAD~5 HEAD -- src/core/loader.ts | wc -l` → 0

## Bisect outcome (which sites needed the fix; Site 3 audit-only)

| Site | File | Lines (pre) | Pre-fix shape | Post-fix shape | Behavior change |
| ---- | ---- | ----------- | ------------- | -------------- | --------------- |
| 1 | src/main/project-io.ts (handleProjectOpenFromPath) | 405-410 | `if (atlasPath !== null) loaderOpts.atlasPath = ...; if (loaderMode === 'atlas-less') loaderOpts.loaderMode = ...` | `if (loaderMode === 'atlas-less') { ...; /* omit atlasPath */ } else if (atlasPath !== null) ...` | YES — pre-emptive (a `.stmproj` saved with both atlasPath set AND loaderMode='atlas-less' would hit the same trap on Open) |
| 3 | src/main/project-io.ts (handleProjectReloadWithSkeleton) | 683-688 | `loaderOpts.loaderMode = 'atlas-less'` (atlasPath always omitted per F1.2 sibling-discovery) | (unchanged) | NO — audit comment cross-referencing the new convention added inside the existing comment block |
| 4 | src/main/project-io.ts (handleProjectResample) | 874-877 | `if (atlasPath !== undefined) loaderOpts.atlasPath = ...; if (loaderMode === 'atlas-less') loaderOpts.loaderMode = ...` | `if (loaderMode === 'atlas-less') { ...; /* omit atlasPath */ } else if (atlasPath !== undefined) ...` | YES — empirically-pinned G-04 root cause (HUMAN-UAT Test 4b Path 2 reproducer) |
| 5 | src/main/sampler-worker.ts (runSamplerJob) | 107-109 | `if (params.atlasRoot) loaderOpts.atlasPath = ...; if (params.loaderMode) loaderOpts.loaderMode = ...` | `if (params.loaderMode === 'atlas-less') { ...; /* omit atlasPath */ } else if (params.atlasRoot) ...` | YES — worker-side mirror of Sites 1 + 4 |

(Site 2 in the original UAT analysis referred to the open-path's worker spawn at project-io.ts:486-494; the worker spawn just threads atlasRoot + loaderMode to runSamplerInWorker — the worker's INSIDE loadSkeleton call is Site 5. Site 2 itself doesn't need a separate change because the fix at Site 5 covers both spawn paths.)

## Tests added (4 net)

| Test | File | Type | Assertion |
| ---- | ---- | ---- | --------- |
| G-04 caller-contract (Test 7) | tests/core/loader-atlas-less.spec.ts | loader-API contract | When both opts.atlasPath and opts.loaderMode='atlas-less' are passed, `result.atlasPath !== null` (D-06 won) AND `result.skippedAttachments ?? [] === []` (D-06 didn't set the field). Synthesizes inline tmp .atlas containing MESH_REGION so D-06 read SUCCEEDS. |
| G-04 caller-correct (Test 8) | tests/core/loader-atlas-less.spec.ts | loader-API contract | When loaderMode='atlas-less' alone is passed (atlasPath OMITTED), `result.atlasPath === null` (D-08 took it) AND `result.skippedAttachments[0].name === 'MESH_REGION'` AND expectedPngPath ends with `images/MESH_REGION.png`. |
| G-04 IPC integration | tests/main/project-io.spec.ts (new G-04 describe) | IPC falsifying-regression | `handleProjectResample({ atlasPath: <synth-with-MESH_REGION>, loaderMode: 'atlas-less', ... })` against tmpdir with PNG missing → POST-FIX `result.project.summary.skippedAttachments.length === 1` (PRE-FIX would have been 0 because D-06 wins, synthesis never runs). Both states have `result.ok === true` (synthesized atlas makes D-06 succeed); load-bearing falsifying property is the `.length === 1` check. |
| G-04 worker-boundary (Site 5) | tests/main/sampler-worker.spec.ts (new G-04 describe) | worker falsifying-regression | `runSamplerJob({ atlasRoot: <synth-WITHOUT-MESH_REGION>, loaderMode: 'atlas-less', ... })` → POST-FIX `result.type === 'complete'` (D-08 synthesis runs, ignores canonical atlas). PRE-FIX is `'error'` because the stock AtlasAttachmentLoader at D-06 throws "Region not found in atlas: MESH_REGION". |

## Falsifying-gate proofs (two independent gates, one per fix site that has a downstream falsifier)

**Gate 1 — Site 4 (project-io.ts handleProjectResample):**

```
$ git checkout HEAD~1 -- src/main/project-io.ts   # revert Site 1 + Site 4 to pre-fix shape
$ npx vitest run tests/main/project-io.spec.ts -t "G-04"
  FAIL  Phase 21 G-04 — toggle-resample-into-atlas-less precedence
  AssertionError: expected +0 to be 1
    expect(result.project.summary.skippedAttachments.length).toBe(1)
                                                            ^
  Tests  1 failed
$ # restore fix
$ npx vitest run tests/main/project-io.spec.ts -t "G-04"
  Tests  1 passed
```

(NB: this scratch revert is what caused the accidental working-tree-revert situation on commit 0a31aee — `git checkout HEAD~1 -- ...` STAGES the revert. The subsequent `cp` restoration only updated the working tree; `git add tests/main/project-io.spec.ts` did NOT unstage the revert; the resulting commit captured both the new test AND the reverted source. Recovered by commit fee0070 which re-applied the Site 1 + Site 4 fix as a Rule 1 fix. The falsifying-gate property remains proven; the recovery commit's existence is part of this audit trail.)

**Gate 2 — Site 5 (sampler-worker.ts runSamplerJob):**

```
$ # in-place file edit reverting Site 5 to pre-fix shape (no git checkout — avoids the staging trap)
$ npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"
  FAIL  sampler-worker — Phase 21 G-04 (Site 5) loaderOpts precedence
  AssertionError: expected 'error' to be 'complete'
    expect(result.type).toBe('complete')
                        ^
  Tests  1 failed
$ # restore fix from /tmp backup
$ npx vitest run tests/main/sampler-worker.spec.ts -t "G-04"
  Tests  1 passed
```

(Site 1 is pre-emptive and is locked by Tasks 1 + 2 typecheck/regression posture only — no downstream IPC/worker test invokes handleProjectOpenFromPath against the dual-option payload shape directly. Site 3 is audit-only and cannot have a behavior-change falsifier by definition.)

## Vitest delta

- **Pre-plan baseline:** 626 passing (existing Phase 21 wave-4 + 21-09 + 21-10 + 21-11 fixtures)
- **After Task 1 (2 contract tests):** 628 passing
- **After Task 2 (no new tests; 4-site fix; refactor preserves all 624 prior tests):** 628 passing
- **After Task 3 (1 IPC test):** 629 passing
- **After Task 4 (1 worker-boundary test):** 630 passing
- **Net:** +4 (2 contract + 1 IPC + 1 worker-boundary)

`npm run test 2>&1 | tail -3` final state:

```
 Test Files  56 passed (56)
      Tests  630 passed | 1 skipped | 2 todo (633)
   Duration  3.28s
```

(The 1 skipped + 2 todo are pre-existing; the spawn-smoke test in sampler-worker.spec.ts skips when the electron-vite-built bundle is absent, and 2 todo tests are documented carry-forwards from earlier phases.)

`npm run typecheck`: zero new errors (only pre-existing TS6133 warnings on AnimationBreakdownPanel.tsx + GlobalMaxRenderPanel.tsx for `onQueryChange` props, documented in Plans 21-09/21-10 SUMMARYs as environmental).

## Threat model dispositions

| Threat ID | Category | Disposition | Notes |
| --------- | -------- | ----------- | ----- |
| T-21-12-01 | Tampering | accept | Renderer is trusted; the fix REMOVES the spoof surface (atlasPath ignored when loaderMode is atlas-less), strictly tightening behavior. |
| T-21-12-02 | Information disclosure | mitigate | The fix surfaces missing PNGs via skippedAttachments → MissingAttachmentsPanel — this IS the user-facing fix for G-04. |
| T-21-12-03 | DoS | accept | Synthesis path is identical to the cold-load atlas-less path that's been live since Plan 21-08; performance characteristics unchanged. |
| T-21-12-04 | Repudiation | accept | The fix only redirects when loaderMode === 'atlas-less' is EXPLICITLY set; canonical mode behavior preserved verbatim. |
| T-21-12-05 | Spoofing | accept | No new auth, no new IPC channels — pure caller-logic refactor. |
| T-21-12-06 | EoP | accept | No privilege boundaries crossed — pure caller-logic refactor. |

## HUMAN-UAT readiness signal

After this plan merges, the user can re-run UAT Test 4b Path 2 (canonical project + delete one PNG + toggle "Use Images Folder as Source" ON). The MissingAttachmentsPanel should now surface the missing entry — Path 1 + Path 2 are symmetric. UAT Test 4c (region-attachment + missing PNG via toggle path) becomes runnable; expected to pass per the same root cause.

## Path-symmetry assertion

Cold-load atlas-less (Plan 21-09 Test 6 G-01) AND toggle-resample atlas-less (Plan 21-12 G-04) now produce the same `summary.skippedAttachments` shape for the same fixture-with-missing-PNG state:

| Fixture state | Cold-load atlas-less (Plan 21-09 Test 6) | Toggle-resample atlas-less (Plan 21-12 G-04) |
| ------------- | ---------------------------------------- | -------------------------------------------- |
| `MeshOnly_TEST.json` + `images/` empty (no MESH_REGION.png) | `result.skippedAttachments[0].name === 'MESH_REGION'` | `result.project.summary.skippedAttachments[0].name === 'MESH_REGION'` |
| Same JSON + populated `images/MESH_REGION.png` | `result.skippedAttachments ?? [] === []` | `summary.skippedAttachments === []` |

Both paths route through the loader's D-08 synthesis branch post-fix; the IPC handler / worker callers correctly OMIT atlasPath when the user has the loaderMode override set.

## Self-Check: PASSED

- File `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-12-toggle-resample-atlas-less-precedence-SUMMARY.md` — FOUND (this file)
- Commit `179b1dd` — FOUND (Task 1: G-04 loader-contract tests)
- Commit `de99e84` — FOUND (Task 2: caller-side precedence fix at 4 sites)
- Commit `0a31aee` — FOUND (Task 3: G-04 IPC falsifying test)
- Commit `fee0070` — FOUND (Rule 1 recovery: restore Site 1 + Site 4 fix accidentally reverted in 0a31aee during the falsifying-gate scratch revert)
- Commit `9b70056` — FOUND (Task 4: G-04 worker-boundary falsifier)
- File `src/main/project-io.ts` Plan 21-12 G-04 references — 3 (Sites 1, 3, 4)
- File `src/main/sampler-worker.ts` "atlasPath intentionally OMITTED" instances — 1 (Site 5)
- File `src/core/loader.ts` diff vs HEAD~5 — 0 lines (loader untouched)
