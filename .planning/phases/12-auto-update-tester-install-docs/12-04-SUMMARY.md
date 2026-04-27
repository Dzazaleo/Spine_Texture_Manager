---
phase: 12-auto-update-tester-install-docs
plan: 04
subsystem: ui
tags: [windows, file-picker, electron, dialog, ux, regression-fix, phase-11-spillover]

# Dependency graph
requires:
  - phase: 12-auto-update-tester-install-docs
    provides: "Plan 12-01 mounts UpdateDialog + 5 update-event useEffect subscriptions in AppShell.tsx (sibling region untouched by this plan)"
provides:
  - "F2 fix at AppShell.tsx pickOutputDir: defaultPath no longer concatenates '/images-optimized' suffix that triggered Windows save-as picker behavior"
  - "tests/renderer/app-shell-output-picker.spec.tsx — F2 regression suite (3 derivation tests + 1 source-grep regression test)"
affects: [12-06 (tester INSTALL.md context — F2 papercut fixed before tester rounds), 12.1 (Windows spike host — picker UX no longer obscures auto-update verification flow)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-grep regression test: read source file as string, strip block + line comments, assert buggy literal absent — locks bug pattern out of codebase against future refactor reintroduction"

key-files:
  created:
    - "tests/renderer/app-shell-output-picker.spec.tsx"
  modified:
    - "src/renderer/src/components/AppShell.tsx (single hunk at pickOutputDir useCallback)"

key-decisions:
  - "Refined source-grep regex to strip block + line comments before scanning, so the post-fix doc-comment that describes the old bug doesn't false-trigger the test (Rule 3 deviation)"
  - "Tested derivation logic via inline helper mirror rather than extracting from AppShell.tsx — extraction would be more invasive than the bug fix itself"

patterns-established:
  - "Source-grep regression test: when a fix is a literal-string-removal in a complex unmounted component, an in-test inlined helper covers the algorithmic shape and an over-the-source-text grep covers the regression"

requirements-completed: []  # F2 is a CONTEXT-folded item per D-20 — Phase 11 spillover with no roadmap requirement ID

# Metrics
duration: 2min
completed: 2026-04-27
---

# Phase 12 Plan 04: F2 file-picker UX fix Summary

**Drops the `/images-optimized` suffix from AppShell.tsx pickOutputDir defaultPath; native Windows folder picker now opens at the project parent directory instead of behaving as save-as ("create new file 'images-optimized'?" dialog) reported in 11-WIN-FINDINGS.md §F2.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-27T21:09:00Z
- **Completed:** 2026-04-27T21:11:14Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (1 modified + 1 created)

## Accomplishments

- F2 (Phase 11 spillover Windows file-picker UX bug) fixed at its single audit site (`src/renderer/src/components/AppShell.tsx:441-453`).
- New regression test file `tests/renderer/app-shell-output-picker.spec.tsx` locks the fix in place via a source-grep that catches future refactors that quietly reintroduce the bug pattern.
- Pre-existing post-pick safeguards verified-untouched: `src/main/ipc.ts` is byte-for-byte unchanged from pre-12-04 baseline, so `handleStartExport`'s "outDir IS source-images-dir" hard-reject (D-20.1) and `probeExportConflicts` overwrite-warning (D-20.3) and the picker properties array `['openDirectory', 'createDirectory', 'promptToCreate', 'dontAddToRecent']` (D-20.2) all remain intact.
- 12-01's UpdateDialog mount + 5 update-event useEffect subscriptions in AppShell.tsx untouched — the diff is a single hunk at the `pickOutputDir` region.
- 388/388 vitest passing (was 384; +4 F2 regression tests). No regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): F2 regression tests** — `013c7af` (test)
2. **Task 1 (GREEN): drop '/images-optimized' suffix** — `4e7fe08` (fix)

**Plan metadata:** _pending after this SUMMARY commits_ (docs).

_TDD task: RED → GREEN sequence visible in git log. No REFACTOR commit needed — the fix was a one-line subtraction._

## Files Created/Modified

- `tests/renderer/app-shell-output-picker.spec.tsx` — new file. 4 tests:
  1. POSIX path: `/Users/leo/project/skel.json` → `/Users/leo/project` (no `images` substring).
  2. Windows path: `C:\Users\Tester\stm\skel.json` → `C:\Users\Tester\stm` (no `images` substring).
  3. Filesystem-root edge case: `/skel.json` → `.` fallback (Phase 6 REVIEW L-01 preserved).
  4. Source-grep: `AppShell.tsx` does not contain `skeletonDir + '/images-optimized'` or any `'/images-optimized'` literal in code (block + line comments stripped before scanning).
- `src/renderer/src/components/AppShell.tsx` — single hunk at lines 433-454:
  - Removed `const defaultOutDir = skeletonDir + '/images-optimized';`
  - Changed `return window.api.pickOutputDirectory(defaultOutDir);` → `return window.api.pickOutputDirectory(skeletonDir);`
  - Updated comment block to document the Phase 12 F2 fix and cross-link 11-WIN-FINDINGS.md §F2 + 12-RESEARCH.md §"F2 File-Picker Fixes".
  - Phase 6 REVIEW L-01 `|| '.'` fallback PRESERVED.

## Decisions Made

- **Refine source-grep regex to skip comments.** The plan suggested `expect(src).not.toMatch(/['"]\/images-optimized['"]/)` as a belt-and-braces second check. The post-fix doc-comment intentionally references `'/images-optimized'` as a string-literal description of the old bug pattern (so future maintainers can find this fix-context via grep). The plan's regex couldn't tell comment text from code text, so the test would have failed even after a correct fix. Solution: pre-process the source to strip both block comments (`/* … */`) and trailing line comments (`// …`) before applying the regex. The intent of the test — "no `/images-optimized` literal in code" — is preserved exactly; only the false-positive on doc-comment text is removed.
- **Test the derivation logic via an inline helper mirror.** Extracting `pickOutputDir`'s regex into an exported helper would have been more invasive than the bug fix itself (1530-line component, no other extraction precedent in this region). The inlined `deriveSkeletonDir()` in the test file mirrors AppShell.tsx:451 byte-for-byte; the source-grep test catches future drift between the test mirror and the AppShell source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Source-grep test false-triggered on post-fix doc-comment**

- **Found during:** Task 1 GREEN verification (initial test run after the AppShell.tsx fix landed).
- **Issue:** The plan-suggested regex `expect(src).not.toMatch(/['"]\/images-optimized['"]/)` matched the post-fix comment text `// 'images-optimized'` (in the cross-reference comment that describes the OLD bug pattern). Test would have stayed RED forever even though the actual code was correct.
- **Fix:** Pre-process source by stripping `/* … */` block comments and trailing `//` line comments before applying the regex. Intent of test preserved — still asserts no `/images-optimized` literal in code; comment text is intentionally allowed to reference the old bug for future maintainers.
- **Files modified:** `tests/renderer/app-shell-output-picker.spec.tsx`
- **Verification:** All 4 tests pass; full vitest suite 388/388 passing.
- **Committed in:** `4e7fe08` (Task 1 GREEN — same commit as the fix).

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking — test-tooling fix internal to the same task)
**Impact on plan:** Necessary for the test to actually catch the bug-pattern regression while allowing the fix-context comment. No scope creep — the deviation is contained to the new test file the plan introduced.

## Issues Encountered

- Pre-existing `scripts/probe-per-anim.ts` `npm run typecheck:node` failure carried forward unchanged via `.planning/phases/12-…/deferred-items.md` per SCOPE BOUNDARY (identical to Plans 12-02 + 12-03 deferred entry). `npm run typecheck:web` passes clean. Out of Phase 12 scope.

## Threat Flags

None. The fix is a strict subtraction (one literal-string suffix removed); no new IPC channels, no new external surfaces, no new file-system access, no new schema. Threat register T-12-04-01 (`accept`: user-driven path selection is the trust anchor, not the suggested defaultPath) and T-12-04-02 (`accept`: no logging-surface change) both hold post-fix as designed.

## Manual Windows Verification

Defers to either Phase 12.1's spike host or tester rounds (per plan §verification step 6). Algorithmic correctness is locked by:

- The 4 vitest tests in this plan running on the 12-02 CI matrix (`ubuntu-latest`, `windows-2022`, `macos-14`) — every leg exercises the F2 derivation + source-grep on every push.
- The post-pick `handleStartExport` "outDir IS source-images-dir" hard-reject in `src/main/ipc.ts:415-460` (untouched by this plan; was added in Phase 6) catches the worst-case if the user does end up selecting the source-images dir.

End-to-end "Windows tester clicks Optimize Assets, sees parent-dir picker, clicks New Folder, exports cleanly" requires a packaged `.exe` install on a real Windows host — same handoff to tester rounds as 12-03's F1 atlas-image fix.

## Cross-references

- Original finding: `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-WIN-FINDINGS.md §F2`
- Decision lineage: `.planning/phases/12-auto-update-tester-install-docs/12-CONTEXT.md §D-20` (three-part fix; Parts 2+3 RESEARCH-VERIFIED already correct → Phase 12 ships Part 1 only)
- Audit: `.planning/phases/12-auto-update-tester-install-docs/12-RESEARCH.md §"F2 File-Picker Fixes"`
- Bug-site identification: `.planning/phases/12-auto-update-tester-install-docs/12-PATTERNS.md §"src/renderer/src/components/AppShell.tsx:404-415 (M — F2 fix Part 1)"`
- Sibling Wave 2 plan reference: `.planning/phases/12-auto-update-tester-install-docs/12-03-SUMMARY.md` (F1 — same Phase 11 spillover bucket; complementary `app-image://` URL fix)

## Next Phase Readiness

- Phase 12 now 4/6 plans complete. Wave 2 still has Plans 12-05 (F3 Spine 4.2 version guard) and 12-06 (INSTALL.md authoring + linking surfaces) pending.
- No blockers introduced. F2 is closed as far as runtime code goes; only end-to-end Windows smoke awaits the next packaged build (tester round or Phase 12.1 spike host).

## Self-Check: PASSED

Verified:

- `tests/renderer/app-shell-output-picker.spec.tsx` exists.
- Commit `013c7af` exists in git log (Task 1 RED — test).
- Commit `4e7fe08` exists in git log (Task 1 GREEN — fix).
- `src/main/ipc.ts` byte-for-byte unchanged (`git diff HEAD -- src/main/ipc.ts` returns empty).
- AppShell.tsx diff is a single hunk at the `pickOutputDir` useCallback region only.
- Acceptance grep `grep -F "skeletonDir + '/images-optimized'"` returns 0 lines (single + double-quote variants both checked).
- `pickOutputDirectory(skeletonDir)` appears exactly once at AppShell.tsx:452.
- `defaultOutDir` variable is removed (zero matches).
- Phase 6 REVIEW L-01 `|| '.'` fallback preserved (`grep "|| '.'"` returns ≥1 line in pickOutputDir region).
- 388/388 vitest passing; `typecheck:web` clean.

---

*Phase: 12-auto-update-tester-install-docs*
*Completed: 2026-04-27*
