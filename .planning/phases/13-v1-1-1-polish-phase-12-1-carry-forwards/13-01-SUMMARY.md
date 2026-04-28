---
phase: 13-v1-1-1-polish-phase-12-1-carry-forwards
plan: 01
subsystem: electron-main
tags:
  - electron
  - windows
  - cosmetic
  - regression-test
  - phase-12.1-carry-forward
dependency_graph:
  requires:
    - "Phase 12.1 closed with 2 cosmetic Windows carry-forwards (Anti-Patterns #3 + #4 in 12.1-VERIFICATION.md)"
  provides:
    - "src/main/index.ts: autoHideMenuBar=false at BrowserWindow constructor (line 339)"
    - "src/main/index.ts: app.setAboutPanelOptions(...) as first statement of app.whenReady()"
    - "tests/main/index-options.spec.ts: 2 source-grep regression tests locking both flips"
    - "Both windows-cosmetic todos moved pending → resolved with `## Resolved` sections"
  affects:
    - ".planning/todos/pending/ count reduced by 2 (now: 1 carry-forward remaining + 1 unrelated UI todo)"
tech-stack:
  added: []
  patterns:
    - "F2 source-grep regression pattern (comment-stripping + toMatch + not.toMatch)"
    - "git mv 88%-style rename for todo lifecycle moves (12.1-07 precedent)"
    - "Single atomic commit for code + test + 2 renames + appends (12.1-07 precedent)"
key-files:
  created:
    - "tests/main/index-options.spec.ts"
  modified:
    - "src/main/index.ts (line 339 boolean flip + insert 14-line block at start of app.whenReady())"
  renamed:
    - ".planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md → .planning/todos/resolved/ (with ## Resolved appended; 82% similarity)"
    - ".planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md → .planning/todos/resolved/ (with ## Resolved appended; 85% similarity)"
decisions:
  - "D-06 honored: both fixes land unconditionally — no process.platform branch (macOS no-ops the flag, Electron no-ops unsupported setAboutPanelOptions fields)"
  - "D-07 Claude's Discretion adopted: source-grep regression test added (~30 LoC cost; locks tester-impacting boolean flip + call-presence against future careless refactor)"
  - "Single atomic commit covering all 4 file changes (1 spec greenfield + 1 source edit + 2 renames-with-append) per D-06 cohesive code surface policy"
  - "Live verification on packaged v1.1.1 Windows install deferred to Phase 13.1 (no automated test surface for BrowserWindow constructor options in this codebase)"
metrics:
  duration: "~5 minutes (single atomic commit; greenfield spec + 2 surgical edits + 2 git mv)"
  completed: 2026-04-28
  tasks: 2
  files_changed: 4
  vitest_delta: "+2 (453 → 455; 452 passed | 1 skipped | 2 todo)"
  loc_delta: "+75 / -1 (per `git show --stat 202c506`)"
---

# Phase 13 Plan 01: Windows cosmetic fixes (autoHideMenuBar + setAboutPanelOptions) Summary

Single atomic commit closes 2 of 3 v1.1.1 polish carry-forwards from Phase 12.1: Windows menu bar now visible by default (autoHideMenuBar: false) and Windows About panel will read SemVer (`1.1.1`) instead of win32 FileVersion 4-component padding (`1.1.1.0`) via app.setAboutPanelOptions. Source-grep regression test (D-07 adopted) locks both flips against future careless refactors.

## Commit

| SHA       | Subject                                                                  | Files                              |
| --------- | ------------------------------------------------------------------------ | ---------------------------------- |
| `202c506` | fix(13-01): flip autoHideMenuBar to false + set Windows About-panel SemVer | 4 (1 M, 1 A, 2 R)                  |

## Edit sites in src/main/index.ts

| Edit site | Final line(s) | Description                                                                                                                                                                  |
| --------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | 339           | `autoHideMenuBar: false,` (was `true`). BrowserWindow constructor block. Surrounding comment block (lines 340-352, the `webPreferences` rationale) preserved byte-for-byte. |
| 2         | 408-419       | New `app.setAboutPanelOptions({ applicationName, applicationVersion: app.getVersion() })` block as the FIRST statement inside `app.whenReady()`, with 8-line docblock above documenting the Phase 13 rationale. Sits BEFORE the existing `protocol.handle('app-image', ...)` registration (now at line 421+). |

No platform-conditional branches added (D-06). No new imports needed (`app` already imported at line 26). No edits outside these two surgical sites.

## Test surface

`tests/main/index-options.spec.ts` greenfield (47 lines, 2 tests):

| Test                                                                                  | Assertions                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoHideMenuBar is false (Windows menu bar visible by default)`                      | After comment-stripping: `expect(codeOnly).toMatch(/autoHideMenuBar:\s*false/)` AND `expect(codeOnly).not.toMatch(/autoHideMenuBar:\s*true/)`                       |
| `app.setAboutPanelOptions is called with applicationVersion: app.getVersion()`        | Raw source: `expect(src).toMatch(/app\.setAboutPanelOptions\s*\(\s*\{/)` AND `expect(src).toMatch(/applicationVersion:\s*app\.getVersion\(\)/)`                     |

RED state was confirmed before the source edit (both tests failed because line 339 was `true` and no setAboutPanelOptions call existed). GREEN state confirmed after the edit (2/2 passing). Pattern verbatim from `tests/renderer/app-shell-output-picker.spec.tsx` lines 59-86 (the F2 source-grep precedent, commit `4e7fe08`).

## Todo lifecycle moves

Both via `git mv` (preserves blame; rename similarity above 50% threshold per `git diff --find-renames` default):

| Source (deleted)                                                                                               | Destination (added)                                                                                                | Similarity | Append                              |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------- |
| `.planning/todos/pending/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md`                         | `.planning/todos/resolved/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md`                            | 82%        | `## Resolved` section + 1-paragraph |
| `.planning/todos/pending/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md`                           | `.planning/todos/resolved/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md`                              | 85%        | `## Resolved` section + 1-paragraph |

The original Problem / Solution / Cross-references sections of both moved files preserved byte-for-byte; only an APPEND-only `## Resolved` block lands per the 12.1-07 PRESERVE-HISTORY discipline (analog: commit `ad6d9bf`).

## Verification

- `grep -n "autoHideMenuBar: false" src/main/index.ts` → 1 match (line 339).
- `grep -c "autoHideMenuBar: true" src/main/index.ts` → `0`.
- `grep -n "app.setAboutPanelOptions" src/main/index.ts` → 1 match in app.whenReady() body (line 416).
- `grep -n "applicationVersion: app.getVersion()" src/main/index.ts` → 1 match (line 418).
- `npm run test -- index-options` → `Tests 2 passed (2)`.
- `npm run test` → `Test Files 41 passed (41)` / `Tests 452 passed | 1 skipped | 2 todo (455)` (was 453; +2 new). No new failures.
- `npm run typecheck:web` → clean (no output, exit 0).
- `git status` → clean (only pre-existing unrelated entries: ROADMAP.md, STATE.md, untracked phase-13 plan files, untracked release.* artifacts from Phase 12.1).
- `git log --oneline -1` → `202c506 fix(13-01): flip autoHideMenuBar to false + set Windows About-panel SemVer`.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no unintended deletions; renames are not D operations).

## Forward references

- **Plan 13-04** will read commit `202c506` and cite it in `12.1-VERIFICATION.md` Anti-Pattern #3 + Anti-Pattern #4 in-place flip annotations (`**RESOLVED in Phase 13 — ... commit `202c506`...**`) per the PRESERVE-HISTORY pattern (analog: 12.1-08 commit `b4ed03f`).
- **Phase 13.1** (to be inserted after Phase 13 closes via `/gsd-insert-phase 13.1`) owns live verification on a packaged v1.1.1 Windows install: confirm menu bar visible by default + About panel reads `1.1.1` not `1.1.1.0`.

## Deviations from Plan

None. Plan executed exactly as written:

- Task 1 RED step observed 2 failing tests (autoHideMenuBar test failed on `true`; setAboutPanelOptions test failed on absence). No premature commit.
- Task 2 GREEN step landed both edits + git mv operations + appends + commit in a single atomic operation. No platform-branching introduced. No edits outside the two surgical sites in src/main/index.ts. No bundling of package.json/CLAUDE.md changes (those belong to Plans 02 + 03).
- Source-grep regression test (D-07 Claude's Discretion) adopted as the plan recommended.

## Self-Check: PASSED

- File `tests/main/index-options.spec.ts`: present (verified via the green test run; spec file location-resolves under `__dirname` → `<repo>/tests/main/`).
- File `src/main/index.ts`: contains `autoHideMenuBar: false` at line 339 and `app.setAboutPanelOptions(...)` block at lines 416-419 (verified via Read tool earlier this session AND via the regression spec's GREEN result).
- File `.planning/todos/resolved/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md`: present with `## Resolved` section appended (verified via `tail` output).
- File `.planning/todos/resolved/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md`: present with `## Resolved` section appended (verified via `tail` output).
- Pending paths for both todos: removed (verified by `git status` showing only `R` entries, no `D` for these files).
- Commit `202c506`: present (verified via `git log --oneline -1` and `git log --oneline -3`).
