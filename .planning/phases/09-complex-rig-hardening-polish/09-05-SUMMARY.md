---
phase: 09-complex-rig-hardening-polish
plan: 05
subsystem: menu-surface
tags: [phase-9, wave-3, menu, ipc, preload, settings-menu, help-menu, shell-open-external, allow-list, security]
requirements: [N2.2]
dependency_graph:
  requires:
    - "Phase 8.2 D-188 menu surface (buildAppMenu in src/main/index.ts:169-236)"
    - "Phase 8.2 D-181 menu:notify-state IPC pattern (src/main/ipc.ts:587-607)"
    - "Phase 8.2 onMenu* preload listener-identity pattern (src/preload/index.ts:269-306)"
    - "Phase 6 D-122 shell:open-folder handler pattern (src/main/ipc.ts:539-551)"
  provides:
    - "Edit→Preferences… menu item with CommandOrControl+, accelerator firing menu:settings-clicked"
    - "Help→Documentation menu item firing menu:help-clicked (08.2 placeholder filled)"
    - "shell:open-external IPC handler with closed allow-list (T-09-05-OPEN-EXTERNAL)"
    - "window.api.onMenuSettings + onMenuHelp + openExternalUrl contextBridge methods"
    - "Api interface in src/shared/types.ts extended with 3 new methods"
  affects:
    - "src/main/index.ts (custom Edit submenu replaces role:editMenu; Help submenu populated)"
    - "src/main/ipc.ts (SHELL_OPEN_EXTERNAL_ALLOWED + shell:open-external handler)"
    - "src/preload/index.ts (3 new bridges)"
    - "src/shared/types.ts (Api interface — 3 new methods)"
    - "tests/main/menu.spec.ts (modified case d + 4 new cases)"
    - "tests/main/ipc.spec.ts (4 new cases)"
tech_stack:
  added:
    - "shell.openExternal allow-list pattern (defense in depth against Electron sandbox-escape vector)"
  patterns:
    - "Custom Edit submenu listing standard roles + Preferences (RESEARCH §Q6 cross-platform)"
    - "Closed allow-list (ReadonlySet exact-string match) for renderer→shell URL handoff"
    - "Pitfall 9 listener-identity preservation byte-mirrored from 08.2 onMenu* methods"
key_files:
  created:
    - ".planning/phases/09-complex-rig-hardening-polish/09-05-SUMMARY.md"
  modified:
    - "src/main/index.ts (replace { role: 'editMenu' } with custom Edit submenu containing Preferences…; populate role:'help' submenu with Documentation)"
    - "src/main/ipc.ts (SHELL_OPEN_EXTERNAL_ALLOWED constant + shell:open-external ipcMain.on handler)"
    - "src/preload/index.ts (onMenuSettings + onMenuHelp + openExternalUrl on the api literal)"
    - "src/shared/types.ts (Api interface — 3 new method signatures)"
    - "tests/main/menu.spec.ts (modified case d + 4 new cases h1/h2/i1/i2)"
    - "tests/main/ipc.spec.ts (extend electron mock with shell.openExternal vi.fn(); 4 new cases for shell:open-external allow-list)"
key_decisions:
  - "Cross-platform accelerator CommandOrControl+, (no platform branching) — matches RESEARCH §Q6 recommendation; mirrors VSCode/modern editor convention on Win/Linux while honoring macOS HIG Cmd+,"
  - "Preferences placed under Edit (not File→Settings on Win/Linux) — single-template cross-platform simplification per RESEARCH §Q6; user gets the same accelerator regardless of OS"
  - "Custom Edit submenu lists 9 standard roles (undo/redo/cut/copy/paste/pasteAndMatchStyle/delete/selectAll) explicitly — Electron auto-hides pasteAndMatchStyle on Win/Linux so no platform branch needed"
  - "role:'help' preserved when filling the placeholder (Pitfall 8) — Electron's MenuItemConstructorOptions validation requires role:'help' to have a non-empty submenu; filling, not removing, is the only correct path"
  - "Allow-list is exact-string match via ReadonlySet — no prefix matching, no scheme-only checks, no trailing-slash leniency. Tradeoff: HelpDialog authors MUST update SHELL_OPEN_EXTERNAL_ALLOWED verbatim for any new external link, but this catches the most subtle URL-injection variants (https → http downgrade, host-suffix injection, path-walk)"
  - "Initial allow-list: 3 Spine documentation URLs (spine-runtimes, spine-api-reference, spine-json-format) per CONTEXT.md §Documentation button. Plan 07 (HelpDialog) extends this set if more links are needed."
  - "Preferences and Documentation are unconditionally enabled (T-09-05-MENU-01 + 02) — mirrors File→Open's D-187 unconditional enable from 08.2; user can always inspect samplingHz / view help regardless of AppState"
metrics:
  duration: ~5 min
  completed_date: 2026-04-26
  tasks: 2
  commits: 4
  files_changed: 6
  tests_added_passing: 8
  tests_red_to_green: 8
---

# Phase 09 Plan 05: Menu Surface Scaffolding (Settings + Help) Summary

Lands the shared mutation surfaces — `src/main/index.ts` (menu builder), `src/main/ipc.ts` (IPC handlers), `src/preload/index.ts` (3 new bridges), `src/shared/types.ts` (Api interface) — for Phase 9's Settings (Plan 06) and Help (Plan 07) deliverables. Plans 06 and 07 consume these scaffolds without further changes to these shared files.

## Tasks Completed

| # | Name | Commits | Files |
|---|------|---------|-------|
| 1 | Add Preferences (Edit) + Documentation (Help) menu items + click handlers in `src/main/index.ts`; extend `tests/main/menu.spec.ts` | `6e75595` (RED) + `fbcd015` (GREEN) | `src/main/index.ts`, `tests/main/menu.spec.ts` |
| 2 | Add `shell:open-external` IPC handler with allow-list + extend preload + types + `tests/main/ipc.spec.ts` | `592cccc` (RED) + `97ab625` (GREEN) | `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`, `tests/main/ipc.spec.ts` |

## What Shipped

### Menu surface diff (Task 1 — `src/main/index.ts`)

**Edit menu — replaced `{ role: 'editMenu' }` with a custom submenu** containing:

- 9 standard Edit roles preserved so cross-platform accelerators (Cmd/Ctrl+Z/Y/X/C/V/A) keep working automatically: `undo`, `redo`, `cut`, `copy`, `paste`, `pasteAndMatchStyle`, `delete`, `selectAll` (Electron auto-hides `pasteAndMatchStyle` on Win/Linux — no platform branch needed).
- A separator + a `Preferences…` item with accelerator `CommandOrControl+,` whose click handler fires `mainWindow?.webContents.send('menu:settings-clicked')`.

**Help menu — filled the 08.2 D-188 `{ role: 'help', submenu: [] }` placeholder** with:

- A `Documentation` item whose click handler fires `mainWindow?.webContents.send('menu:help-clicked')`.
- `role: 'help'` preserved (Pitfall 8 — Electron's `MenuItemConstructorOptions` validation throws `Invalid template for MenuItem: must have submenu type with role help` without role+non-empty submenu). macOS Help-menu search integration comes free with `role: 'help'`.

Both items are unconditionally enabled (T-09-05-MENU-01 + T-09-05-MENU-02) — mirrors File→Open's D-187 unconditional enable. User can always inspect samplingHz default / view help regardless of AppState.

### IPC + preload + types diff (Task 2)

**`src/main/ipc.ts`:**

- Module-level `SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string>` with 3 initial entries (Spine documentation URLs):
  - `https://esotericsoftware.com/spine-runtimes`
  - `https://esotericsoftware.com/spine-api-reference`
  - `https://en.esotericsoftware.com/spine-json-format`
- `ipcMain.on('shell:open-external', ...)` handler with three guards:
  1. `typeof url === 'string' && url.length > 0` (typeof / length check)
  2. `SHELL_OPEN_EXTERNAL_ALLOWED.has(url)` (exact-string allow-list match)
  3. `try { void shell.openExternal(url); } catch { /* silent */ }` (platform-misconfig defense)

**`src/preload/index.ts`:**

- `onMenuSettings(cb)` — subscribe to `menu:settings-clicked`. Pitfall 9 listener-identity preservation: wrapped const captured BEFORE `ipcRenderer.on` so the unsubscribe closure references the SAME identity that `removeListener` compares by reference.
- `onMenuHelp(cb)` — subscribe to `menu:help-clicked`. Same pattern.
- `openExternalUrl(url)` — fire-and-forget `ipcRenderer.send('shell:open-external', url)`. Mirrors `openOutputFolder` shape verbatim.

**`src/shared/types.ts`:**

- Api interface declares the 3 new methods with full JSDoc cross-references to the allow-list, Pitfall 9, and downstream consumers (Plan 06 SettingsDialog, Plan 07 HelpDialog).

### Allow-list URLs (initial set)

| URL | Where it goes (Plan 07) |
|-----|-------------------------|
| `https://esotericsoftware.com/spine-runtimes` | Spine runtime overview / general docs |
| `https://esotericsoftware.com/spine-api-reference` | Spine 4.2 API reference |
| `https://en.esotericsoftware.com/spine-json-format` | The JSON format spec referenced by the loader |

If Plan 07 references additional links (e.g., the project repo URL), Plan 07 must update `SHELL_OPEN_EXTERNAL_ALLOWED` verbatim. Mismatches are silently dropped — the channel is one-way.

## Test Count Delta

| File | Before | After | Delta |
|------|-------:|------:|------:|
| `tests/main/menu.spec.ts` | 7 | 11 | **+4** (h1/h2 Preferences + i1/i2 Documentation; case d modified to assert custom-submenu shape) |
| `tests/main/ipc.spec.ts` | 4 | 8 | **+4** (handler-registered + allow-listed-call + non-allow-listed-reject + non-string-reject) |

All 19 cases across both files GREEN. The full Phase 9 RED-by-design Wave 0 scaffolds for Plans 06 and 07 (settings-dialog, rig-info-tooltip, help-dialog — 7 cases) remain RED as expected — they are out of Plan 05 scope and flip GREEN when Plans 06/07 land.

## Plan 06 + Plan 07 Unblocked

- **Plan 06 (Settings + tooltip):** can subscribe via `window.api.onMenuSettings(cb)` to mount `SettingsDialog`. The Edit→Preferences… menu item + the cross-platform `Cmd/Ctrl+,` accelerator are wired and validated. No further changes to `src/main/index.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, or `src/shared/types.ts` are needed for the menu→dialog mounting.
- **Plan 07 (Help dialog):** can subscribe via `window.api.onMenuHelp(cb)` to mount `HelpDialog`. External links from inside `HelpDialog` use `window.api.openExternalUrl(url)` — must pass a URL exactly matching `SHELL_OPEN_EXTERNAL_ALLOWED` (extending that Set is the only Plan 07 change required to `src/main/ipc.ts`, and is a one-line addition).

## Decisions Made

1. **Cross-platform accelerator `CommandOrControl+,` (no platform branching).** Matches RESEARCH §Q6 recommendation. Cmd+, on macOS honors the HIG; Ctrl+, on Win/Linux matches VSCode and modern editor convention. Single-string accelerator avoids platform-specific menu-template branching that would violate D-23 (zero-Windows-specific code).

2. **Preferences placed under Edit (not File→Settings on Win/Linux).** RESEARCH §Q6 simplification recommendation — using a single Edit→Preferences placement cross-platform avoids duplicating the menu template for Win/Linux. Modern apps (VSCode) place Preferences under File on Win/Linux and under the App menu on macOS, but the user-facing accelerator is the same; Electron does not provide an ergonomic way to fork the template by platform without violating cross-platform invariants. Edit→Preferences cross-platform is a documented and accepted simplification.

3. **Custom Edit submenu lists 9 standard roles explicitly.** `pasteAndMatchStyle` is a macOS-only role; Electron auto-hides it on Win/Linux so no platform branch needed. Listing the roles explicitly (rather than relying on `role: 'editMenu'`) is the only way to append `Preferences…` to the same submenu in a single template.

4. **`role: 'help'` preserved when filling the placeholder.** Pitfall 8: Electron's `MenuItemConstructorOptions` validation throws when `role: 'help'` is paired with an empty or missing submenu. Filling (not removing) is the only correct path — and macOS Help-menu search integration comes free with `role: 'help'`.

5. **Allow-list is exact-string match via `ReadonlySet`.** No prefix matching, no scheme-only checks, no trailing-slash leniency. Tradeoff: HelpDialog authors MUST update `SHELL_OPEN_EXTERNAL_ALLOWED` verbatim for any new external link, but this catches subtle URL-injection variants (https→http downgrade, host-suffix injection, path-walk drift). The (3) test case explicitly covers `'http://...'` (wrong scheme) and `'.../spine-runtimes/'` (trailing-slash drift) to lock this contract.

6. **Initial allow-list = 3 Spine documentation URLs.** Per CONTEXT.md §Documentation button (Claude's Discretion). Plan 07 (HelpDialog) extends this set if it references additional links (e.g., project repo).

7. **Preferences and Documentation are unconditionally enabled.** T-09-05-MENU-01 + T-09-05-MENU-02 mirror D-187: even in the empty/error AppState, the user can inspect samplingHz / view help. Settings doesn't depend on a loaded skeleton; Help is always relevant.

## Deviations from Plan

None — plan executed exactly as written. The action steps in the plan ("Step 1...", "Step 2...", "Step 3...", "Step 4...") were followed verbatim. Test scaffold helpers (e.g., `setMainWindowRefForTest`) referenced in the plan's pseudocode did not exist in the existing 08.2 menu.spec.ts harness — instead, the harness uses an echo-mock pattern (`buildFromTemplate.mockImplementation((template) => ({ template }))`) that gives tests direct access to the template buildAppMenu passed in. The new Preferences/Documentation cases adapted to this existing harness (passing a `fakeWindow` with a mocked `webContents.send` directly to `buildAppMenu`'s second argument) without needing the planner-suggested helpers.

## Threat Model Compliance

The plan's `<threat_model>` block enumerates 5 threats (T-09-05-OPEN-EXTERNAL, T-09-05-OPEN-EXTERNAL-2, T-09-05-MENU-IPC, T-09-05-MENU-DOS, T-09-05-LISTENER-LEAK). All `mitigate` dispositions are implemented:

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-09-05-OPEN-EXTERNAL | mitigate | **Mitigated.** `SHELL_OPEN_EXTERNAL_ALLOWED` ReadonlySet + exact-string `has()` check before `shell.openExternal`. Test case (3) covers wrong scheme + trailing-slash drift; test case (4) covers non-string / null / empty / object payloads. |
| T-09-05-OPEN-EXTERNAL-2 | accept | Accepted — allow-listed URLs go to public Spine docs; no PII / project content leaks. |
| T-09-05-MENU-IPC | accept | Accepted — main-origin one-way sends; renderer cannot spoof `menu:settings-clicked` / `menu:help-clicked` through the contextBridge (preload only exposes onMenu* listeners, not senders). |
| T-09-05-MENU-DOS | accept | Accepted — `webContents.send` is non-blocking IPC; click flood is rate-limited by OS event loop and user input rate. |
| T-09-05-LISTENER-LEAK | mitigate | **Mitigated.** Pitfall 9 listener-identity preservation in onMenuSettings + onMenuHelp: wrapped const captured BEFORE `ipcRenderer.on`; unsubscribe closure references the same const for `ipcRenderer.removeListener`. Mirrors 08.2 pattern verbatim. |

## Self-Check: PASSED

Verification of claimed artifacts:

- `[FOUND]` `src/main/index.ts` contains `Preferences…` with accelerator `CommandOrControl+,` (line 240).
- `[FOUND]` `src/main/index.ts` contains `Documentation` inside `role: 'help'` submenu (line 263).
- `[FOUND]` `src/main/index.ts` `webContents.send('menu:settings-clicked')` (line 241) and `webContents.send('menu:help-clicked')` (line 264).
- `[FOUND]` `src/main/index.ts` no longer contains the literal `{ role: 'editMenu' }` template entry (only present in a comment reference).
- `[FOUND]` `src/main/index.ts` still contains `role: 'help'` in the live template.
- `[FOUND]` `src/main/ipc.ts` contains exactly one `ipcMain.on('shell:open-external', ...)` registration.
- `[FOUND]` `src/main/ipc.ts` contains module-level `SHELL_OPEN_EXTERNAL_ALLOWED` ReadonlySet with 3 entries.
- `[FOUND]` `src/preload/index.ts` exposes `onMenuSettings`, `onMenuHelp`, `openExternalUrl`.
- `[FOUND]` `src/shared/types.ts` Api interface declares 3 new methods.
- `[FOUND]` `tests/main/menu.spec.ts` 11/11 GREEN (4 new cases + 1 modified).
- `[FOUND]` `tests/main/ipc.spec.ts` 8/8 GREEN (4 new cases).
- `[FOUND]` Commit `6e75595` (RED test for menu).
- `[FOUND]` Commit `fbcd015` (GREEN feat for menu).
- `[FOUND]` Commit `592cccc` (RED test for ipc).
- `[FOUND]` Commit `97ab625` (GREEN feat for ipc + preload + types).
- `[FOUND]` `npx electron-vite build` exits 0.
- `[FOUND]` `npx tsc --noEmit -p tsconfig.web.json` exits 0.
- `[FOUND]` `npx tsc --noEmit -p tsconfig.node.json` exits 0 modulo the pre-existing `scripts/probe-per-anim.ts:14` TS2339 documented in `deferred-items.md` (out of Phase 9 scope per SCOPE BOUNDARY rule).

All claims verified.
