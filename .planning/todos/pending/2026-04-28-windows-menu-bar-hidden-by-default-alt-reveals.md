---
created: 2026-04-28T17:15:00Z
title: Windows menu bar hidden by default — Alt key reveals it
area: ui
files:
  - src/main/index.ts
---

## Problem

On Windows the running app shows no visible menu bar (File / Edit / Help / etc.), even though the menu IS built and Help → Check for Updates / Installation Guide / About all exist. Discovered 2026-04-28 during Plan 12.1-05 Step 1 (rc2 install on Windows host).

Root cause: `src/main/index.ts:339` sets `autoHideMenuBar: true` on the `BrowserWindow`. On Windows + Linux, this Electron option hides the menu bar until the user presses Alt. On macOS the option is a no-op (macOS uses the system menu bar at the top of the screen), which is why the bug is Windows-only and was missed during Phase 12 manual smoke testing.

Workaround: pressing Alt reveals the menu; pressing Alt again or clicking elsewhere hides it.

UX impact: Spine animators on Windows are unlikely to discover the Alt-key reveal. This blocks discoverability of:
- Help → Check for Updates (the PRIMARY entry point for UPD-01..06 on Windows per CONTEXT D-04 — `windows-fallback` variant relies on the user actively checking)
- Help → Installation Guide (D-16 surface 3)
- File / Edit menus generally

This is NOT blocking Plan 12.1-05 testing (Alt works for the runbook), but should ship as v1.1.1 polish before any non-developer Windows tester rounds.

## Solution

Single-line fix: change `autoHideMenuBar: true` → `autoHideMenuBar: false` at `src/main/index.ts:339`. Verify on Windows (rc2 install) that the menu bar is visible by default, runs flush against the title bar, and doesn't introduce visual regressions on macOS (it's a no-op on macOS, but worth eyeballing).

Optional refinement: only flip it on `process.platform === 'win32'` to preserve any existing macOS behavior, but since macOS ignores the flag anyway, the platform-conditional branch is over-engineering.

Test surface: no automated test surface affected (BrowserWindow constructor options aren't covered by vitest in this codebase). Manual rc-install verification on Windows is the gate.

## Cross-references

- Discovered during Phase 12.1 Plan 12.1-05 Step 1 (rc2 install on Windows, 2026-04-28)
- Related: D-04 (windows-fallback variant — relies on Help → Check for Updates being reachable)
- Related: D-16 (Installation Guide menu surface)
