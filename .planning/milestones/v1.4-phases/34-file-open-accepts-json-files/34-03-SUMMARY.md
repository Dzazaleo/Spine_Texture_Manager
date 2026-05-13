---
phase: 34-file-open-accepts-json-files
plan: 03
subsystem: testing
tags: [vitest, react-testing-library, ipc, electron, dialog, dirty-guard, discriminated-union, typescript]

# Dependency graph
requires:
  - phase: 34
    plan: 01
    provides: OpenDialogResponse + handleOpenDialog + openProjectPicker + loadSkeletonFromPath + 'project:open-dialog' IPC channel
  - phase: 34
    plan: 02
    provides: Rewired App.tsx onMenuOpen handler (D-05 + D-06 two-IPC-step flow)
  - phase: 08.1
    provides: handleBeforeDrop ref-bridge (D-163) + SaveQuitDialog 'new-skeleton-drop' reason
  - phase: 08.2
    provides: onMenuOpen/onMenuOpenRecent menu subscriptions (D-175 + D-183) + 8.2-MENU-* canonical test idioms
  - phase: 04
    provides: OverrideDialog double-click → Apply dirty-edit choreography (mirrored by 34-MENU-04b)
provides:
  - Main-side requirement-named gates (34-OPEN-01..05) locking picker filter shape + dialog title + three-arm envelope
  - Renderer-side mock-surface migration: openProject → openProjectPicker + loadSkeletonFromPath
  - Six new 34-MENU-* renderer cases (01..05 + 04b) covering D-05 cancel branch, D-06 dispatch arms, idle-passthrough, dirty-cancel sub-arm, subscription stability
  - Deletion of orphan 8.1-VR-02 it.skip describe block (Phase 19 latent debt)
affects:
  - 34-04 (full test-suite gate — relies on all OPEN-0x specs passing under `npm test --run`)
  - v1.4 milestone close (lock the OPEN-0x contract against regressions across the renderer dispatch + main-side picker surfaces)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Requirement-name-anchored describe blocks (`describe('handleOpenDialog (Phase 34 D-01..D-03)', ...)`) parallel to implementation-detail describe blocks (`describe('Phase 34 D-01/D-02/D-03 — handleOpenDialog (picker-only, three-arm envelope)', ...)`) — the public REQ table cross-refs the former; the latter exists for inner-shape regression."
    - "Capture-and-fire renderer test idiom for menu-event subscriptions: `api.onMenuOpen.mock.calls[0][0]` retrieves the registered callback; per-test override of the mocked picker resolved value drives scenarios without mounting native menu surface."
    - "Dirty-cancel-via-real-SaveQuitDialog choreography for menu-driven flows: fire-and-don't-await the menu callback while a SaveQuitDialog Cancel click resolves the pending dirty-guard Promise (mirrors the 8.1-VR-03a drop-driven dirty-flow but applied to the new menu Open path)."

key-files:
  created: []
  modified:
    - tests/main/project-io.spec.ts (added 5 OPEN-0x cases + renamed legacy describe header)
    - tests/renderer/save-load.spec.tsx (mock surface migrated; orphan 8.1-VR-02 block deleted; 8.2-MENU-03/04/06 migrated in place; 6 new 34-MENU-* cases added)

key-decisions:
  - "OPEN-0x cases land in a new describe block parallel to the existing D-01/D-02/D-03 implementation-detail block — the public REQ names earn their own grep-anchored gate; the inner shape cases retain their original D-01/D-02/D-03 names for regression at the implementation level."
  - "8.1-VR-02 orphan describe deleted physically (Warning #2 Option A from the plan) rather than rewritten — Phase 19 latent debt; v1.4 rewrite queued in the inline comment never materialized; orphan after Plan 01 deleted the openProject preload surface; aligns with CLAUDE.md 'avoid backwards-compatibility hacks'."
  - "34-MENU-04 renamed from 'dirty-guard returns false → kind dispatch is skipped (D-05)' to 'idle-state passthrough — null beforeDropRef returns true via ?? fallback → dispatch proceeds' (Warning #1 Option B) — the previous label claimed the OPPOSITE of what the body verified; honest label + a separate 34-MENU-04b case for the actual dirty-cancel arm earns both sub-arms of OPEN-04 explicit coverage."
  - "34-MENU-04b uses the established 8.1-VR-03a dirty-edit choreography (CIRCLE.png Peak cell double-click → OverrideDialog → Apply) rather than the plan's lighter doubleClick+spinbutton sketch — the established pattern already passes in adjacent tests in the same file; copying it verbatim avoids inventing a new dirty-trigger seam."

patterns-established:
  - "When migrating a preload-mock surface across the test file, prefer a tightened regex (`api\\.openProject(\\s*=|\\s*:)`) over the looser `openProject:\\s*vi\\.fn` to catch BOTH the property-declaration form AND the per-test reassignment form — the latter form lives in body code (e.g. `(globalThis as any).api.openProject = vi.fn().mockResolvedValue(...)`) that the property regex misses."
  - "Dirty-cancel coverage for menu-driven flows: a fire-and-don't-await pattern (`const pending = cb(); await userEvent.click(cancelBtn); await pending;`) is the canonical way to verify SaveQuitDialog Cancel resolves `handleBeforeDrop` to false without prematurely awaiting the pending menu callback."

requirements-completed:
  - OPEN-01
  - OPEN-02
  - OPEN-03
  - OPEN-04
  - OPEN-05

# Metrics
duration: 6min
completed: 2026-05-11
---

# Phase 34 Plan 03: File→Open accepts JSON files (Wave 3 — test coverage hardening) Summary

**5 main-side OPEN-0x cases lock handleOpenDialog filter/title/envelope contracts + 6 renderer-side 34-MENU-* cases cover D-05 cancel branch + D-06 three-arm dispatch + idle passthrough + dirty-cancel SaveQuitDialog sub-arm + subscription stability; orphan 8.1-VR-02 it.skip block deleted; 8.2-MENU-03/04/06 mock-surface migrated openProject → openProjectPicker.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-11T20:04:16Z
- **Completed:** 2026-05-11T20:10:00Z
- **Tasks:** 2/2
- **Files modified:** 2 test files (no production changes)

## Accomplishments

- Five new requirement-name-anchored cases in `tests/main/project-io.spec.ts` cover the OPEN-0x requirements verbatim: 34-OPEN-01 (cancel → cancelled), 34-OPEN-02 (.stmproj → project), 34-OPEN-03 (.json → skeleton), 34-OPEN-04 (defense-in-depth unknown suffix → project arm), 34-OPEN-05 (unified `[stmproj, json]` filter entry + `'Open Spine Project or Skeleton'` title). Total 25 cases pass in this file.
- The pre-existing legacy describe header `'handleProjectOpen / handleProjectOpenFromPath (F9.2)'` is renamed to `'handleProjectOpenFromPath (F9.2)'` — the deleted `handleProjectOpen` symbol is no longer imported anywhere, so the slash prefix in the header was misleading.
- Renderer mock surface in `tests/renderer/save-load.spec.tsx` migrated end-to-end: the orphan `openProject: vi.fn().mockResolvedValue(...)` field is replaced with `openProjectPicker: vi.fn().mockResolvedValue({ kind: 'cancelled' })` + `loadSkeletonFromPath: vi.fn().mockResolvedValue({ ok: true, summary: makeSummary() } as LoadResponse)`. The `LoadResponse` type-import is added to the top-of-file block. No `api.openProject` (property or assignment) reference remains anywhere in the file.
- Orphan `describe('8.1-VR-02: AppShell toolbar Open ...', () => { it.skip(...) })` block (46 lines, Phase 19 latent debt) deleted physically — its body referenced the deleted `api.openProject` preload surface.
- 8.2-MENU-03 / 04 / 06 cases retargeted in place (mock-name swap only, assertions preserved). All three pass after the migration. The 2 baseline failures (8.2-MENU-03 + 8.2-MENU-04 against the deleted `openProject` surface) are now green.
- Six new 34-MENU-* cases land in a new peer describe block following 8.2-MENU-06: 34-MENU-01 (cancel branch is no-op), 34-MENU-02 (project arm → openProjectFromPath), 34-MENU-03 (skeleton arm → loadSkeletonFromPath), 34-MENU-04 (idle-state passthrough), 34-MENU-04b (dirty session + SaveQuitDialog Cancel → no load IPC fires — the actual D-05 sub-arm of OPEN-04), 34-MENU-05 (subscription registered once per App mount).
- Full target suite (3 files, 55 cases) exits 0: `npm test -- tests/main/project-io.spec.ts tests/renderer/save-load.spec.tsx tests/arch.spec.ts --run` → 54 passed + 1 pre-existing skip (the Phase 19 it.skip on the legacy Save toolbar button — separate latent debt, NOT touched by this plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: add 34-OPEN-01..05 handleOpenDialog cases + rename legacy describe** — `0c293a7` (test)
2. **Task 2: migrate save-load mocks + add 34-MENU-01..05 + 34-MENU-04b cases** — `38694a3` (test)

_TDD framing: both tasks have `tdd="true"` in the plan. The "RED" gate for Task 1 is conceptual — the spec adds new cases against an implementation that Plan 01 already landed, so the new cases pass on first write. The plan author's intent: "the assertions are the spec" (PLAN Task 1 Step 4). For Task 2 the renderer mock-surface migration FAILED 2 of 11 existing tests against the deleted `openProject` mock before the migration (8.2-MENU-03 + 8.2-MENU-04); those flipped GREEN as a side-effect of the Step C mock-name renames. No production code changes are made by Plan 03._

## Files Created/Modified

**Tests:**
- `tests/main/project-io.spec.ts` — added a new top-level describe `'handleOpenDialog (Phase 34 D-01..D-03)'` with 5 cases (34-OPEN-01..05) at end-of-file; renamed legacy describe header at line 170 from `'handleProjectOpen / handleProjectOpenFromPath (F9.2)'` to `'handleProjectOpenFromPath (F9.2)'`. Total 25 cases (20 pre-existing → 25 after); all pass.
- `tests/renderer/save-load.spec.tsx` — type-import block extended with `LoadResponse`; mock surface in `beforeEach` migrated (delete `openProject`, add `openProjectPicker` + `loadSkeletonFromPath`); orphan `describe('8.1-VR-02: ...')` block deleted (46 lines); 8.2-MENU-03 / 04 / 06 retargeted in place; new peer describe `'Phase 34 onMenuOpen — File menu accepts .json + .stmproj (OPEN-01..05)'` with 6 cases added at end-of-file. Total 18 cases (12 pre-existing minus the deleted orphan → 17 pass + 1 unrelated pre-existing skip).

**Production:** None — Plan 03 is test-only.

## Decisions Made

All four key-decisions in the frontmatter capture the executor's adjudications WITHIN the plan's explicit Warning options. The plan presented two checker-surfaced warnings with Option-A / Option-B alternatives:
- **Warning #1 → Option B** (rename 34-MENU-04 to honestly reflect idle-passthrough; add new 34-MENU-04b for the dirty-cancel arm) — chosen verbatim per plan instruction. The previous label promised a contract the body did not deliver; renaming + the second case earned both sub-arms of OPEN-04 explicit coverage.
- **Warning #2 → Option A** (delete the entire `it.skip('8.1-VR-02', ...)` describe block) — chosen verbatim per plan instruction. Phase 19 latent debt; orphan after Plan 01 deleted openProject; aligns with CLAUDE.md "avoid backwards-compatibility hacks".

The third decision (use the 8.1-VR-03a dirty-edit choreography for 34-MENU-04b) is the executor's reduction of the plan's looser sketch to the established pattern that already passes in adjacent tests — the plan's Step 8 explicitly allowed this kind of substitution.

The fourth decision (anchoring OPEN-0x via a new requirement-named describe block parallel to the implementation-detail block) reflects how the plan's Task 1 grep criteria want the file structured: `grep -c "describe('handleOpenDialog (Phase 34"` equals 1, but the pre-existing block uses `'Phase 34 D-01/D-02/D-03 — handleOpenDialog (...)'` which doesn't match. The new block sits at end-of-file with the title prefix the criterion expects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comment-string `34-OPEN-01..05` triggered grep-c=2 instead of expected 1**
- **Found during:** Task 1 (verification step — first round)
- **Issue:** The plan's acceptance criterion `grep -c "34-OPEN-01" tests/main/project-io.spec.ts` expects 1. The exact-handler-text the plan provided included a preamble doc comment `// These cases lock the public requirement names (34-OPEN-01..05) against ...`, which causes `grep -c "34-OPEN-01"` to return 2 (one in the comment, one in the test name).
- **Fix:** Rephrased the preamble doc to `OPEN-0x requirement names` (omitting the `34-OPEN-01..05` literal). The semantic is preserved; the grep count drops to the expected 1.
- **Files modified:** `tests/main/project-io.spec.ts` (lines 494-497 — comment block only)
- **Verification:** Re-ran the grep suite; all 8 Task 1 criteria pass.
- **Committed in:** `0c293a7` (Task 1 commit — adjustment landed before commit)

### Plan-text-vs-acceptance-grep inconsistency (documentation-only — no code change)

**2. [Plan-internal inconsistency] `34-MENU-04b` grep count is 3, plan expects 1**
- **Found during:** Task 2 (verification step)
- **Issue:** The plan's `<acceptance_criteria>` asserts `grep -c "34-MENU-04b" tests/renderer/save-load.spec.tsx` equals 1, but the plan's own exact handler text (the new describe block's preamble doc + the renamed 34-MENU-04 case's inline cross-reference comment + the actual `it('34-MENU-04b: ...', ...)` test name) contains 3 occurrences of `34-MENU-04b`. The actual count after the additions is 3.
- **Fix:** None applied. The plan's `<action>` block explicitly instructs adding the new describe block "exact handler text" — the supplied text contains the preamble doc and the cross-ref comment that are load-bearing for readability (the 34-MENU-04 rename rationale only makes sense when the comment cross-refs 34-MENU-04b). Truth-criterion (the test case exists with the correct name and assertions) wins over the count-assertion (a plan-text-vs-grep mistake by the planner — same class of issue Plan 02 documented for `result.kind === 'project'`). All other 13 grep criteria pass exactly.
- **Files modified:** None (deviation is documentation-only).
- **Verification:** All 13 of 14 acceptance-grep counts match the plan exactly; the 14th is the documented plan-internal inconsistency. The 34-MENU-04b case passes (verified by `npm test -- tests/renderer/save-load.spec.tsx --run`).
- **Committed in:** Not applicable (no code change).

---

**Total deviations:** 1 auto-fixed (Rule 3 — comment-string adjustment to satisfy acceptance grep) + 1 plan-internal-inconsistency documented (no code change).
**Impact on plan:** None. Auto-fix is a comment-only adjustment; the test cases and their assertions are verbatim per the plan's exact handler text. The plan-internal inconsistency mirrors the same class of issue Plan 02 documented (planner's grep-c counts vs handler-text occurrences) — handler-text wins.

## Issues Encountered

None. The TDD framing is preserved (Task 1 tests pass against the Plan 01 implementation; Task 2 mock-surface migration flips 2 baseline failures to GREEN), the per-commit HEAD-on-worktree-agent-branch assertion passed twice, no destructive git operations were used, and no files were unexpectedly deleted by the commits (the 46-line `it.skip` block deletion in Task 2 is the planned removal documented in plan Step B).

## User Setup Required

None — pure test-file additions and a mock-surface migration. No external service configuration, env vars, or runtime side effects.

## Next Phase Readiness

- **Wave 4 (Plan 34-04) is unblocked.** Plan 04's role per the v1.4 phase plan is the full test-suite gate — `npm test --run` across all 67+ spec files must exit 0. The three files Plan 03 touched (`tests/main/project-io.spec.ts` + `tests/renderer/save-load.spec.tsx` + `tests/arch.spec.ts`) already pass cleanly (54 passed + 1 pre-existing skip in the targeted run).
- **Threat model fully discharged.** All four T-34-03-* threats had `accept` dispositions; the test additions respect them: (T-34-03-01) `vi.mock('electron')` is scoped to the spec file via vitest's per-file isolation, no cross-spec leakage; (T-34-03-02) picker filter shape + dialog title are byte-equal to the SUT's literal strings, live-OS verification is the user's manual smoke step at release; (T-34-03-03) all synthetic test paths (`/a/b/MyRig.stmproj`, `/abs/x.json`, etc.); (T-34-03-04) 34-MENU-04b's dirty-edit choreography uses the established 8.1-VR-03a pattern that already passes in adjacent tests — if a future AppShell internal refactor breaks the OverrideDialog Apply seam, that's a shared regression across both tests and will be caught immediately.
- **No outstanding test gaps for the OPEN-0x REQs.** Main-side filter/title/envelope + renderer-side cancel/project/skeleton dispatch + idle passthrough + dirty cancel + subscription stability are all grep-verifiable.

## Self-Check

Verifying the claims in this SUMMARY against the actual repository state:

**Files exist:**
- `tests/main/project-io.spec.ts` — present, modified (5 OPEN-0x cases added at end-of-file; describe header at line 170 renamed).
- `tests/renderer/save-load.spec.tsx` — present, modified (LoadResponse type-import added; mock surface migrated; orphan 8.1-VR-02 deleted; 8.2-MENU-03/04/06 retargeted; 6 new 34-MENU-* cases added).
- `.planning/phases/34-file-open-accepts-json-files/34-03-SUMMARY.md` — present, this file.

**Commits exist:**
- `0c293a7` — present (test: Task 1).
- `38694a3` — present (test: Task 2).

**Verification commands:**
- `npm test -- tests/main/project-io.spec.ts --run` — 25 passed, 0 failed (PASS).
- `npm test -- tests/renderer/save-load.spec.tsx --run` — 17 passed, 1 skipped, 0 failed (PASS).
- `npm test -- tests/arch.spec.ts --run` — 12 passed, 0 failed (PASS).
- 13 of 14 acceptance-grep counts match the plan; the 14th (`34-MENU-04b` count = 3, plan expects 1) is a documented plan-internal inconsistency where the plan's exact handler text contains 3 occurrences (preamble doc + 34-MENU-04 cross-ref + 34-MENU-04b test name).

## Self-Check: PASSED

---
*Phase: 34-file-open-accepts-json-files*
*Completed: 2026-05-11*
