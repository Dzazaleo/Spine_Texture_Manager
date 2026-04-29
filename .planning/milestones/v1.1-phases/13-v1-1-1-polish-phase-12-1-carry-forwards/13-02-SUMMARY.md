---
phase: 13-v1-1-1-polish-phase-12-1-carry-forwards
plan: 02
subsystem: docs
tags:
  - docs
  - release-engineering
  - electron-updater
  - semver
  - phase-12.1-carry-forward
dependency_graph:
  requires:
    - "Phase 12.1 closed with rc-channel-naming carry-forward (Anti-Pattern #1 in 12.1-VERIFICATION.md)"
    - "Plan 13-01 already landed (cosmetic Windows fixes; commits 202c506 + a139337)"
  provides:
    - "CLAUDE.md ## Release tag conventions section locking dot-separated prerelease format as project convention"
    - "rc-channel-mismatch todo moved pending → resolved with ## Resolved section appended"
  affects:
    - ".planning/todos/pending/ count reduced by 1 (now: 0 carry-forwards remaining + 1 unrelated UI todo from v1.0 phase 4)"
    - "CLAUDE.md heading count: 7 → 8 top-level ## sections"
tech-stack:
  added: []
  patterns:
    - "Docs-only insertion between existing sections (no append; surgical heading-anchor edit)"
    - "git mv 87%-similarity rename for todo lifecycle move (12.1-07 + 13-01 precedent; plan predicted 88%, actual 87%)"
    - "Single atomic commit for CLAUDE.md edit + 1 rename + 1 append (12.1-07 ad6d9bf precedent)"
    - "Cross-link target points at post-move resolved/ path (link valid at commit time, not before)"
key-files:
  created: []
  modified:
    - "CLAUDE.md (insert 11-line ## Release tag conventions block at line 23, between ## Critical non-obvious facts and ## Test fixture)"
    - ".planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md (append ## Resolved section after ## Sibling todos block; original Problem/Solution/Verification path/Cross-references/Sibling todos sections preserved byte-for-byte)"
  renamed:
    - ".planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md → .planning/todos/resolved/ (87% similarity; preserves git blame across the rename)"
decisions:
  - "D-05 honored: docs-only fix; no edit to .github/workflows/release.yml (workflow-level regex guard deferred to v1.2+)"
  - "Insertion position: BETWEEN ## Critical non-obvious facts and ## Test fixture (PATTERNS.md §CLAUDE.md preferred — new section is a non-obvious-fact constraint on a future op, fits with the other constraints)"
  - "Cross-link target: resolved/ (NOT pending/) — link is valid at commit time because git mv lands in the same atomic commit"
  - "Single atomic commit covering both file changes (CLAUDE.md edit + git mv with ## Resolved append) per CONTEXT D-05 / 12.1-07 ad6d9bf precedent"
  - "No edits to .github/workflows/release.yml, src/main/index.ts, package.json, or any verification doc (all out-of-scope for this plan)"
metrics:
  duration: "~3 minutes (single atomic commit; CLAUDE.md insert + git mv + ## Resolved append)"
  completed: 2026-04-28
  tasks: 1
  files_changed: 2
  vitest_delta: "0 (455 → 455; docs-only commit, no code surfaces touched)"
  loc_delta: "+17 / -0 (per `git show --stat 566ed8e`: 11 lines into CLAUDE.md + 6 lines append to resolved todo)"
---

# Phase 13 Plan 02: CLAUDE.md release-tag conventions Summary

Single atomic commit closes 1 of 3 v1.1.1 polish carry-forwards from Phase 12.1 (Anti-Pattern #1 in 12.1-VERIFICATION.md): CLAUDE.md gains a new `## Release tag conventions` section locking the dot-separated prerelease format (`v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌) as project convention, with a one-line rationale citing electron-updater@6.x channel-name comparison + semver prerelease parser semantics, and a cross-link back to the resolved root-cause walkthrough todo (which moved pending → resolved in the same commit).

## Commit

| SHA       | Subject                                                  | Files                                |
| --------- | -------------------------------------------------------- | ------------------------------------ |
| `566ed8e` | docs(13-02): document release tag conventions in CLAUDE.md | 2 (1 M CLAUDE.md, 1 R todo rename)   |

## CLAUDE.md edit site

| Pre-edit `## ` count | Post-edit `## ` count | New section position | New section line range |
| -------------------- | --------------------- | -------------------- | ---------------------- |
| 7                    | 8                     | Between `## Critical non-obvious facts` (L14) and `## Test fixture` (was L23, now L34) | L23–L33 (11 lines: heading + blank + 1 sentence + blank + 2 bullets + blank + 1-line rationale + blank + 1 cross-link + trailing blank) |

Final post-insertion section order (from `grep -n '^## ' CLAUDE.md`):

```
3:## What this project is
7:## Source of truth
14:## Critical non-obvious facts (do not relitigate)
23:## Release tag conventions      ← NEW
34:## Test fixture                  ← shifted from L23
38:## Folder conventions (do not misread)
43:## Commands
51:## GSD workflow
```

Section content (verbatim from PATTERNS.md §CLAUDE.md drafted block):

```markdown
## Release tag conventions

Prerelease tags MUST use **dot-separated** number suffixes:

- ✅ `v1.2.0-rc.1` — semver parses as `["rc", 1]`; electron-updater 6.x channel-match works.
- ❌ `v1.2.0-rc1`  — semver parses as `["rc1"]` (single opaque token); rc1 → rc2 auto-update silently fails.

Rationale: `electron-updater@6.x`'s GitHub provider compares prerelease tokens as channel names; `"rc1" === "rc2"` is `false`, so an installed `v1.2.0-rc1` cannot detect `v1.2.0-rc2`. Final → final and final → prerelease paths are unaffected.

See `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` for the full root cause walkthrough.
```

Tone matches existing `## Folder conventions (do not misread)` precedent: terse imperative-mood opener + bulleted list of factual statements + inline backticks for paths/values. No essay; 5-10 substantive lines per CONTEXT §specifics.

## Todo lifecycle move

Single `git mv` (preserves blame; 87% similarity per `git diff --find-renames` default — plan predicted 88%, actual 87%):

| Source (deleted)                                                                            | Destination (added)                                                                            | Similarity | Append                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- | ----------------------------------- |
| `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md`        | `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md`          | 87%        | `## Resolved` section + 1-paragraph |

The original Problem / Solution / Verification path / Cross-references / Sibling todos sections of the moved file preserved byte-for-byte; only an APPEND-only `## Resolved` block lands per the 12.1-07 PRESERVE-HISTORY discipline (analog: commit `ad6d9bf`; `## Resolved` shape verbatim from `.planning/todos/resolved/2026-04-28-windows-packaged-build-fails-on-wincodesign-symlink-extract.md` lines 45-49). The `## Resolved` section documents:

- The CLAUDE.md docs landing (location + section name + cross-link target)
- The deliberate workflow-guard deferral rationale (D-05: docs-only fix; workflow-level regex guard at `.github/workflows/release.yml:43-54` deferred to v1.2+ as overkill for a single-developer project)
- The migration cliff posture: existing rc-shaped tags (`v1.1.0-rc1` / `-rc2` / `-rc3`) stay as-is in release history; no rewrite, no force-push

## Verification

- `grep -n '^## Release tag conventions$' CLAUDE.md | wc -l` → 1 (exactly one match).
- `grep -c '^## ' CLAUDE.md` → 8 (was 7; +1 new section).
- `grep -q 'v1.2.0-rc.1' CLAUDE.md` → 0 exit (✅ dot-form example present).
- `grep -q 'v1.2.0-rc1' CLAUDE.md` → 0 exit (❌ no-dot example present).
- `grep -q 'electron-updater' CLAUDE.md` → 0 exit (rationale references upstream tooling).
- `grep -q 'todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch' CLAUDE.md` → 0 exit (cross-link points at resolved/, not pending/).
- `[ ! -f .planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md ]` → 0 exit (pending path gone).
- `[ -f .planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md ]` → 0 exit (resolved path present).
- `grep -q '^## Resolved$' .planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` → 0 exit.
- `grep -q 'Phase 13 Plan 02' .planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` → 0 exit.
- `git log --diff-filter=R --name-status -1 -- .planning/todos/` → `R087 ...pending/... ...resolved/...` (rename detected, NOT D+A).
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no unintended deletions).
- `npm run test` → `Test Files 41 passed (41)` / `Tests 452 passed | 1 skipped | 2 todo (455)` (unchanged from Plan 13-01 baseline; docs-only commit has no code-surface impact).
- No edits to `.github/workflows/release.yml`, `src/main/index.ts`, `package.json`, `package-lock.json`, or any verification doc (all out-of-scope per CONTEXT D-05 + plan §<acceptance_criteria>).
- `git log --oneline -1` → `566ed8e docs(13-02): document release tag conventions in CLAUDE.md`.

## Forward references

- **Plan 13-04** will read commit `566ed8e` and cite it in `12.1-VERIFICATION.md` Anti-Pattern #1 in-place flip annotation (`**RESOLVED in Phase 13 — see ...resolved/...electron-updater-prerelease-channel-mismatch.md and CLAUDE.md §Release tag conventions (commit 566ed8e).**`) per the PRESERVE-HISTORY pattern (analog: 12.1-08 commit `b4ed03f` flipping `12-VERIFICATION.md`).
- **Plan 13-04** will additionally update the `### Gaps Summary` polish-todos list in `12.1-VERIFICATION.md` to reflect that this carry-forward is now CLOSED (alongside Plan 13-01's 2 closures).
- **Future v1.2+ prerelease cycle** (if any) will adopt the dot-form naturally by reading the new CLAUDE.md `## Release tag conventions` section. No automation enforces this; the convention activates the next time a prerelease tag is pushed.

## Deviations from Plan

None. Plan executed exactly as written:

- Step 1 (CLAUDE.md insertion) landed the 11-line block at the PATTERNS-preferred position (between `## Critical non-obvious facts` and `## Test fixture`); section count went 7 → 8 as predicted; the new block sits at L23–L33 (the existing `## Test fixture` shifted from L23 to L34, exactly as predicted).
- Step 2 (`git mv`) produced an `R` rename in `git status --short` (NOT separate `D` + `A`), 87% similarity (plan predicted 88%; actual measured by git's default rename detection threshold).
- Step 3 (`## Resolved` append) preserved all prior content byte-for-byte; the moved file's section count went from 5 (Problem / Solution / Verification path / Cross-references / Sibling todos) to 6 (+ Resolved).
- Step 4 (single atomic commit) landed cleanly with hook-validated commit (no `--no-verify`); commit subject starts with `docs(13-02):` as required; Co-Authored-By footer present.
- No anti-pattern guard fired: no CONTRIBUTING.md introduced, no `.github/workflows/release.yml` edits, no modification of the original Problem/Solution/Cross-references sections of the moved file, no cross-link to `pending/`, no bundling of out-of-scope edits, no `git rm` outright, no CLAUDE.md tone change beyond the new section.
- vitest delta: 0 tests added/modified (docs-only commit; 455/455 unchanged from Plan 13-01 baseline). No automated test surface for project-notes file content (CLAUDE.md is project-instruction prose, not a code surface; the PATTERNS.md "OPTIONAL source-grep regression test" pattern from D-07 applied only to the `src/main/index.ts` flips landed by Plan 13-01).

## Self-Check: PASSED

- File `CLAUDE.md`: present at repo root with 8 `## ` top-level sections; new `## Release tag conventions` heading at L23 (verified via `grep -n '^## ' CLAUDE.md` showing the line number is between L14 and L34).
- File `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md`: present with `## Resolved` section appended at L77 (verified via `grep -n '^## Resolved$' ...` exit 0).
- File `.planning/todos/pending/2026-04-28-electron-updater-prerelease-channel-mismatch.md`: removed (verified via `[ ! -f ... ]` exit 0; `git status` shows only `R` entry, no separate `D`).
- Cross-link target: `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` (verified via `grep -q 'todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch' CLAUDE.md` exit 0; the link target file exists at commit time per the previous bullet).
- Commit `566ed8e`: present (verified via `git log --oneline -1` showing `566ed8e docs(13-02): document release tag conventions in CLAUDE.md` and `git log --diff-filter=R --name-status -1 -- .planning/todos/` showing `R087` rename score).
- vitest baseline preserved: 455/455 (verified via fresh `npm run test --silent` post-commit; identical to Plan 13-01's GREEN state).
