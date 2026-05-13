---
created: 2026-05-08
phase: 31
resolves_phase: 39
source: 31-HUMAN-UAT.md item 1
host_blocked: windows-admin-session
priority: pre-release-of-v1.3.1
---

# Phase 31 — Windows admin DnD UAT (release-time)

Plan 31-03 (PLATFORM-01) ships a Windows-elevation probe + DnD suppression + verbatim two-sentence advisory copy on the DropZone empty-state. Programmatic verification covered the IPC chain, handler guards, advisory render, and arch carve-out (5/5 must-haves PASS). Live behavior on an elevated Windows session was not exercised at phase close — host was available but admin session was not.

## What to test (at release time, before tagging v1.3.1)

1. Install the v1.3.1 binary on a Windows machine.
2. Right-click the launcher / installed binary → **Run as administrator**. Confirm the UAC prompt.
3. With the app idle (no project loaded), the DropZone empty-state should show the verbatim two-sentence advisory:
   > Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges.
4. Drag a `.json` file over the window — the drag-over ring (`ring-2 ring-accent bg-accent/5`) should NOT appear and dropping should NOT load anything. File → Open should still work.
5. Quit. Relaunch normally (no admin). DnD should work as before — drag-over ring appears, dropping a `.json` loads the project.
6. Sanity check on macOS + Linux (if available): elevation probe short-circuits to `false`, no advisory renders, DnD remains functional.

## Why deferred

User had a Windows machine to pull-and-test the dev build (items 2/3/4 PASS) but no installable binary + admin session at phase-close time. The mitigation is structural — `src/main/elevation.ts` is layer-3 carve-out only run on `process.platform === 'win32'`; macOS/Linux short-circuit means lower-risk on non-Windows hosts.

## Owner

Surface during `/gsd-ship` v1.3.1 or final release verification. If the advisory does not appear or DnD still toggles when elevated, file a defect against PLATFORM-01 and re-open Phase 31 as 31.1 gap closure.

## Cross-references

- `.planning/phases/31-loader-ux-small-fixes-batch/31-HUMAN-UAT.md` (item 1)
- `.planning/phases/31-loader-ux-small-fixes-batch/31-03-SUMMARY.md`
- `.planning/phases/31-loader-ux-small-fixes-batch/31-VERIFICATION.md` (human_verification[0])
