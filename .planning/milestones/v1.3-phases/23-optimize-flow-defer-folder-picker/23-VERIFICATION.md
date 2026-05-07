---
phase: 23-optimize-flow-defer-folder-picker
verified: 2026-05-03T23:17:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Click 'Optimize Assets' toolbar button with no saved project"
    expected: "OptimizeDialog opens immediately — OS folder picker does NOT appear before the modal"
    why_human: "jsdom cannot drive Electron's native folder-picker IPC; requires live Electron session"
  - test: "With dialog open (outDir null), click Start — OS folder picker opens pre-filled at skeleton directory"
    expected: "Folder picker launches; cancelling returns user to pre-flight without closing the dialog"
    why_human: "Native picker interaction and dialog-stay-open behaviour require a running Electron session"
  - test: "Open a saved .stmproj that has a non-null lastOutDir, click Optimize Assets, then click Start"
    expected: "Folder picker pre-fills at the saved lastOutDir path"
    why_human: "Round-trip persistence (initialProject seed → state slot → picker startPath) requires a live app session"
  - test: "Complete an export, then reopen the project and verify .stmproj contains the used output folder"
    expected: "lastOutDir is written to .stmproj automatically after export (silent saveProject fire-and-forget)"
    why_human: "File system write and silent-save verification require a running Electron session with a real .stmproj"
---

# Phase 23: Optimize Flow — Defer Folder Picker Verification Report

**Phase Goal:** Rewire the Optimize Assets toolbar flow so OptimizeDialog opens immediately on click (OPT-01) and the OS folder picker is deferred to the Start button inside the dialog (OPT-02).
**Verified:** 2026-05-03T23:17:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Clicking Optimize Assets opens OptimizeDialog immediately — no OS folder-picker before modal | ✓ VERIFIED | `onClickOptimize` (AppShell.tsx:510) calls only `buildExportPlan` then `setExportDialogState({ plan, outDir: lastOutDir })` — zero `pickOutputDirectory` call in this function |
| 2 | Clicking Start inside OptimizeDialog opens the OS folder picker (picker never skipped) | ✓ VERIFIED | `onConfirmStart` (AppShell.tsx:535) calls `pickOutputDir(startPath)` before `probeExportConflicts`; confirmed by source-grep test OPT-02 gate passing |
| 3 | Picker is pre-filled with lastOutDir when saved; otherwise pre-fills at skeletonDir | ✓ VERIFIED | `startPath = lastOutDir ?? (summary.skeletonPath.replace(…) \|\| '.')` at AppShell.tsx:544–545 |
| 4 | Cancelling the picker from Start leaves dialog in pre-flight (dialog does not close) | ✓ VERIFIED | `if (pickedDir === null) return { proceed: false }` at AppShell.tsx:547–550; returning `proceed: false` keeps OptimizeDialog in pre-flight |
| 5 | After successful export, lastOutDir is silently persisted to .stmproj (if currentProjectPath != null) | ✓ VERIFIED | `onRunEnd` at AppShell.tsx:1581–1588: `void window.api.saveProject(buildSessionState(), currentProjectPath)` guarded by `currentProjectPath !== null`; source-grep test D-07 passes |
| 6 | Pre-flight header shows "Optimize Assets — N images" when outDir is null (D-01) | ✓ VERIFIED | OptimizeDialog.tsx:318–320: ternary branch `props.outDir !== null ? … : \`Optimize Assets — ${total} images\``; render test D-01 passes |
| 7 | Pre-flight header shows "Optimize Assets — N images → /path" when outDir is set (D-02) | ✓ VERIFIED | OptimizeDialog.tsx:319: `\`Optimize Assets — ${total} images → ${props.outDir}\``; render test D-02 passes |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/components/AppShell.tsx` | Restructured optimize flow — lastOutDir state, revised onClickOptimize, revised onConfirmStart, revised onRunEnd, revised buildSessionState | ✓ VERIFIED | All five edit sites confirmed: (A) outDir: string\|null at line 369, (B) lastOutDir state slot at line 280 seeded from initialProject, (C) onConfirmStart runs picker at line 546, (D) buildSessionState reads lastOutDir at line 651 + dep array at line 674, (E) onRunEnd silent-save at lines 1581–1588 |
| `src/renderer/src/modals/OptimizeDialog.tsx` | Widened outDir prop + conditional headerTitle + null-guarded openOutputFolder | ✓ VERIFIED | outDir: string\|null at line 58; null guard at lines 256–260; conditional headerTitle at lines 313–320 |
| `tests/renderer/appshell-optimize-flow.spec.tsx` | Regression test suite — 8 tests covering OPT-01/OPT-02/D-01/D-02/D-07 | ✓ VERIFIED | File exists; 8/8 tests pass; no jest-dom imports; jsdom environment set at line 1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| AppShell.tsx:onClickOptimize | setExportDialogState | builds plan immediately, no picker call | ✓ WIRED | `buildExportPlan` then `setExportDialogState({ plan, outDir: lastOutDir })` at lines 511–512; no `pickOutputDirectory` call in this function |
| AppShell.tsx:onConfirmStart | pickOutputDir | picker runs before probeExportConflicts | ✓ WIRED | `pickOutputDir(startPath)` at line 546; `probeExportConflicts` at line 557; picker index < probe index verified by test |
| AppShell.tsx:onRunEnd | window.api.saveProject | silent fire-and-forget if currentProjectPath !== null | ✓ WIRED | `void window.api.saveProject(buildSessionState(), currentProjectPath)` at line 1586 behind `currentProjectPath !== null` guard |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| AppShell.tsx | lastOutDir | `useState<string|null>(() => initialProject?.lastOutDir ?? null)` at line 280–282 | Yes — seeded from project file; updated by picker result in onConfirmStart | ✓ FLOWING |
| OptimizeDialog.tsx | headerTitle | `props.outDir` from exportDialogState.outDir (AppShell parent) | Yes — conditional on runtime outDir value | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 8 Phase 23 regression tests pass | `npm run test -- tests/renderer/appshell-optimize-flow.spec.tsx` | 8/8 passed | ✓ PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| No Phase-23-caused test regressions | `npm run test` | 737 pass, 2 fail (pre-existing: atlas-preview-modal dblclick + build-scripts version) | ✓ PASS |
| onClickOptimize has no pickOutputDirectory call | source-grep test OPT-01 gate | passes (match[0] does not contain pickOutputDirectory) | ✓ PASS |
| onConfirmStart calls picker before probe | source-grep test OPT-02 gate | passes (pickerIdx < probeIdx) | ✓ PASS |
| buildSessionState uses lastOutDir state slot | source-grep test D-07 gate | passes (no `lastOutDir: null, // Phase 9 polish` found) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| OPT-01 | 23-01, 23-02 | OptimizeDialog opens immediately on toolbar click — no folder picker before modal | ✓ SATISFIED | onClickOptimize sets dialog state with no picker call; test gate passes |
| OPT-02 | 23-01, 23-02 | Output-folder picker presented only on Start; pre-filled if previously saved | ✓ SATISFIED | onConfirmStart runs picker first; startPath seeded from lastOutDir or skeletonDir; test gate passes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| AppShell.tsx | 1106 | `lastOutDir: null` | ℹ Info | Inside `resampleProject` call arguments (ResampleArgs type) — NOT in buildSessionState. Unrelated to Phase 23 fix; separate feature path. No impact on phase goal. |

No blockers. The `lastOutDir: null` at line 1106 is in a `resampleProject` IPC call's argument object (a separate type from AppSessionState), not in `buildSessionState`. The Phase 9 deferral hardcode (`lastOutDir: null, // Phase 9 polish`) in `buildSessionState` has been correctly replaced with the `lastOutDir` state slot at line 651.

### Human Verification Required

Four behaviors require a running Electron session to verify. Automated checks confirm the wiring is correct; human testing validates the end-to-end UX.

#### 1. Toolbar click opens dialog immediately (OPT-01 UX verification)

**Test:** Launch app, load a skeleton, click "Optimize Assets" toolbar button.
**Expected:** OptimizeDialog appears immediately — OS folder picker does NOT appear before the modal is visible.
**Why human:** Electron's native folder picker (showOpenDialog) cannot be driven by jsdom. The test suite verifies the code path does not call `pickOutputDirectory` in `onClickOptimize`, but the actual absence of a picker dialog requires live observation.

#### 2. Start button triggers picker; cancel stays in pre-flight (OPT-02 UX verification)

**Test:** With OptimizeDialog open, click Start. When the OS folder picker appears, cancel/dismiss it.
**Expected:** Dialog remains open in pre-flight state (does not close, does not advance to in-progress).
**Why human:** Native picker cancel/dismiss interaction is not reproducible in jsdom. Code returns `{ proceed: false }` on picker cancel, but the OptimizeDialog's rendering response to that value requires live verification.

#### 3. lastOutDir pre-fill from saved project (OPT-02 pre-fill verification)

**Test:** Open a .stmproj that has a non-null lastOutDir, open OptimizeDialog, click Start.
**Expected:** OS folder picker opens with the saved lastOutDir path as its initial directory.
**Why human:** Picker `startPath` (Electron `showOpenDialog defaultPath`) cannot be inspected from jsdom. Requires a live session with a .stmproj file containing a real lastOutDir.

#### 4. Silent auto-save after export (D-07 round-trip verification)

**Test:** Load a project with currentProjectPath set, complete an export to a new folder, close and reopen the project.
**Expected:** The .stmproj file's `lastOutDir` field contains the folder used for the export.
**Why human:** The `void saveProject(…)` fire-and-forget call at line 1586 writes to the filesystem. Verifying the persisted value requires reading the .stmproj file after export in a live Electron session.

### Gaps Summary

No gaps. All 7 observable truths are VERIFIED against the codebase. The 8-test regression suite passes, TypeScript compiles cleanly, and the two failing tests in the full suite are pre-existing failures unrelated to Phase 23 (confirmed in both SUMMARY files and reproduced on main branch before Phase 23).

Human verification is required for end-to-end UX behaviors that depend on the Electron native folder picker and filesystem writes — not because of implementation defects, but because jsdom cannot exercise native OS dialogs.

---

_Verified: 2026-05-03T23:17:00Z_
_Verifier: Claude (gsd-verifier)_
