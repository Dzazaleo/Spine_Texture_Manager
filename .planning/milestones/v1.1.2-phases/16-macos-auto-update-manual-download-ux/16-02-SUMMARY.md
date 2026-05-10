---
phase: 16-macos-auto-update-manual-download-ux
plan: 02
subsystem: docs
tags: [install-md, auto-update, manual-download, macos, windows, linux, copy]
requires: []
provides:
  - "Tester-facing INSTALL.md copy that accurately reflects the Phase 16 platform routing (Linux in-process; macOS+Windows manual-download)"
affects:
  - INSTALL.md
tech_stack_added: []
tech_stack_patterns: []
key_files_created: []
key_files_modified:
  - INSTALL.md
decisions:
  - "Verbatim adoption of CONTEXT.md D-03 target prose (the 'planner can polish wording' note was taken as a no-op — the locked target shape was already a good fit, no further polish needed)"
  - "Old `in the app menu` qualifier on `Help → Check for Updates` dropped — D-03 target prose omits it; matches the more concise 'You can also check manually via Help → Check for Updates' shape"
  - "Old `auto-update-capable` conditional phrasing dropped completely — Phase 16 makes Windows unconditionally manual-download, so the conditional no longer maps to shipped behavior"
metrics:
  duration_seconds: 41
  completed_date: "2026-04-30"
  tasks_completed: 1
  files_modified: 1
  commits: 1
---

# Phase 16 Plan 02: INSTALL.md auto-update section rewrite Summary

INSTALL.md `## After installation: auto-update` section rewritten per CONTEXT.md D-03 to match the Phase 16 platform routing: Linux owns the in-process auto-update sentence, macOS+Windows share the manual-download paragraph (open Releases page → download installer manually → re-trigger Gatekeeper/SmartScreen).

## Outcome

INSTALL.md tester-facing copy now matches the shipped Phase 16 behavior (once Plan 16-03 lands the variant routing flip). The docs no longer claim that macOS uses an in-process auto-update — that claim has been latent since v1.0.0 and was empirically falsified during Phase 15 v1.1.3 Test 7-Retry round 3 (D-15-LIVE-2 ad-hoc code-signature swap failure). The new prose groups macOS+Windows under one manual-download paragraph and lifts Linux out as the only in-process platform.

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `INSTALL.md` | Rewrote the two-paragraph body of `## After installation: auto-update` | 139, 141 (2 insertions, 2 deletions) |

## Exact Lines Replaced

Replaced the body of `## After installation: auto-update` at INSTALL.md lines 139 and 141 (the section heading at line 137, the trailing `---` at line 143, and all surrounding sections were preserved verbatim).

### Before (lines 139, 141)

```markdown
Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates** in the app menu.

On macOS and Linux, accepting an update downloads the new version and prompts you to restart. On Windows, the same flow runs if your install is auto-update-capable; if not, the app shows a non-blocking notice with a button to open the Releases page where you can download the new installer manually.
```

### After (lines 139, 141)

```markdown
Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates**.

On Linux, accepting an update downloads the new version and prompts you to restart. On macOS and Windows, the app shows a non-blocking notice with a button to open the Releases page — download the new installer manually and run it (re-triggering the first-launch Gatekeeper / SmartScreen step).
```

## Verification — grep counts

All acceptance criteria from the plan's `<acceptance_criteria>` block pass:

| Pattern | Required | Actual | Status |
|---------|----------|--------|--------|
| `On macOS and Linux` (old phrasing) | `=0` | `0` | PASS |
| `On Linux,` (new phrasing leads with Linux) | `>=1` | `1` | PASS |
| `On macOS and Windows` (new manual-download grouping) | `>=1` | `1` | PASS |
| `Releases page` (user-facing button affordance) | `>=1` | `4` | PASS |
| `Gatekeeper` (re-trigger note) | `>=1` | `5` | PASS |
| `auto-update-capable` (old Windows-conditional phrasing) | `=0` | `0` | PASS |
| `## After installation: auto-update` (heading preserved) | `=1` | `1` | PASS |
| `windows-fallback` (defense-in-depth — no leaked old terminology) | `=0` | `0` | PASS |

`Releases page` count = 4 (instead of 1) because the existing `### Steps` blocks for macOS / Windows / Linux already mention "Download ... from the Releases page" — those references are pre-existing and in scope of pre-installation download flow, not the post-install auto-update section. They were not touched by this plan.

`Gatekeeper` count = 5 (instead of 1) because the macOS install section already mentions Gatekeeper several times (warning dialog, bypass flow, "## Older macOS versions" section, troubleshooting). Pre-existing references; not touched.

## git diff scope check

```
$ git diff INSTALL.md
@@ -136,9 +136,9 @@ If the right-click path doesn't show an "Open Anyway" option, fall back to the S
 
 ## After installation: auto-update
 
-Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates** in the app menu.
+Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates**.
 
-On macOS and Linux, accepting an update downloads the new version and prompts you to restart. On Windows, the same flow runs if your install is auto-update-capable; if not, the app shows a non-blocking notice with a button to open the Releases page where you can download the new installer manually.
+On Linux, accepting an update downloads the new version and prompts you to restart. On macOS and Windows, the app shows a non-blocking notice with a button to open the Releases page — download the new installer manually and run it (re-triggering the first-launch Gatekeeper / SmartScreen step).
 
 ---
```

Only the two body lines of `## After installation: auto-update` (139 and 141) changed. The heading line, blank lines, and trailing `---` separator were preserved untouched. No other section of INSTALL.md was modified — the macOS install steps, Windows install steps, Linux install steps, all three Troubleshooting blocks, and the Reporting issues section remain byte-identical to pre-edit.

## Independence verification

This plan touches ONLY `INSTALL.md`. It has zero code dependency on Plan 16-01 (Wave 1 type-rename / variant gate flip) and zero test impact:

- No `src/main/auto-update.ts` references.
- No `src/main/ipc.ts` references.
- No `src/preload/index.ts` references.
- No `src/shared/types.ts` references.
- No `src/renderer/src/**` references.
- No `tests/**` references.
- No build-config or package-config changes.

The plan was authored under `wave: 1` with `depends_on: []`, and executes correctly in parallel with Plan 16-01 — both touch disjoint file sets.

## Decisions Made

1. **Verbatim adoption of D-03 target prose.** CONTEXT.md D-03 left wording polish at planner discretion ("planner can polish wording but the structure is locked"). On review, the locked target prose reads cleanly, hits all the substantive points (platform split, Releases page button affordance, Gatekeeper/SmartScreen re-trigger note), and matches the rest of INSTALL.md's tone. No polish was applied — the target prose was adopted verbatim.

2. **Dropped the trailing "in the app menu" qualifier** on `**Help → Check for Updates**`. The pre-edit copy had `**Help → Check for Updates** in the app menu`; D-03's target prose has just `**Help → Check for Updates**`. Adopting the shorter form matches D-03 and is consistent with the rest of INSTALL.md's menu-reference style (e.g., `**Help → Documentation**` is referenced elsewhere without "in the app menu" qualifier).

3. **Dropped `auto-update-capable` Windows-conditional phrasing.** The old paragraph said "the same flow runs if your install is auto-update-capable; if not, the app shows a non-blocking notice." Phase 16 makes Windows unconditionally manual-download (per CONTEXT.md `<domain>` and Phase 14 D-13), so the conditional no longer maps to shipped behavior. Rewriting it as an unconditional "On macOS and Windows, the app shows a non-blocking notice" both matches reality and removes a clause that would confuse testers.

## Deviations from Plan

None — plan executed exactly as written. No bugs found, no missing critical functionality, no blocking issues, no architectural changes needed. Single docs-only task; the `<verify>` automated grep chain passed first try.

## Auth Gates

None — docs-only plan, no auth required.

## Threat Flags

None — INSTALL.md is markdown documentation only; no new attack surface introduced.

## CLAUDE.md Compliance

- No code changes; CLAUDE.md `## Critical non-obvious facts` (sampler lifecycle, Spine math handling, PNG decode boundary, Layer 3 invariant) are not in scope for this plan.
- CLAUDE.md `## Release tag conventions` (`v1.2.0-rc.1` vs `v1.2.0-rc1`) is not in scope — this plan does not author any release tag.
- GSD workflow respected — single atomic commit per task with `docs(16-02):` prefix.

## Commit

| # | Hash | Type | Message |
|---|------|------|---------|
| 1 | `f4e8c2e` | docs | docs(16-02): rewrite INSTALL.md auto-update section per CONTEXT.md D-03 |

## Self-Check: PASSED

- INSTALL.md exists and contains the new prose at lines 139 and 141 (verified via Read tool post-edit)
- Commit `f4e8c2e` exists in git log with the expected message and 1-file 2-insertion 2-deletion shape
- All 8 grep acceptance checks pass
- `git diff` shows zero changes outside the auto-update section body
- No deletions of tracked files (verified via `git diff --diff-filter=D`)
- No untracked files left over (`git status --short` shows clean tree post-commit)

## REQ Closed

- **UPDFIX-05** — partial: this plan closes the INSTALL.md copy slice. The variant rename + gate flip + test refresh slices remain for Plan 16-01 (Wave 1) and any follow-up plans in Phase 16.
