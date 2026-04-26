---
phase: 09-complex-rig-hardening-polish
plan: 05
type: execute
wave: 3
depends_on: ["09-01"]
files_modified:
  - src/main/index.ts
  - src/main/ipc.ts
  - src/preload/index.ts
  - src/shared/types.ts
  - tests/main/menu.spec.ts
  - tests/main/ipc.spec.ts
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-3, menu, ipc, preload, settings-menu, help-menu, shell-open-external]

must_haves:
  truths:
    - "Edit menu contains a Preferences… item with accelerator CommandOrControl+, that fires `webContents.send('menu:settings-clicked')`"
    - "Help menu's existing role:'help' submenu contains a Documentation item that fires `webContents.send('menu:help-clicked')`"
    - "Renderer subscribes to both menu events via window.api.onMenuSettings + window.api.onMenuHelp (Pitfall 9 listener-identity preservation)"
    - "window.api.openExternalUrl(url) is exposed via contextBridge; main-process handler calls shell.openExternal(url) ONLY when url matches a hardcoded allow-list (T-09-05-OPEN-EXTERNAL — defense against arbitrary URL spoofing)"
    - "src/main/index.ts buildAppMenu signature is unchanged; new items slot into the existing template per 08.2 D-188 conventions"
  artifacts:
    - path: "src/main/index.ts"
      provides: "Preferences… (Edit menu) + Documentation (Help submenu) menu items"
      contains: "menu:settings-clicked"
    - path: "src/main/ipc.ts"
      provides: "shell:open-external IPC handler with allow-list validation"
      contains: "ipcMain.on('shell:open-external'"
    - path: "src/preload/index.ts"
      provides: "onMenuSettings, onMenuHelp, openExternalUrl bridges"
      contains: "onMenuSettings"
    - path: "src/shared/types.ts"
      provides: "Api interface extended with 3 new methods"
      contains: "onMenuSettings"
  key_links:
    - from: "src/main/index.ts Edit menu Preferences item"
      to: "renderer (via mainWindow.webContents.send('menu:settings-clicked'))"
      via: "click handler firing one-way IPC"
      pattern: "menu:settings-clicked"
    - from: "src/main/index.ts Help submenu Documentation item"
      to: "renderer (via webContents.send('menu:help-clicked'))"
      via: "click handler firing one-way IPC"
      pattern: "menu:help-clicked"
    - from: "src/preload/index.ts openExternalUrl"
      to: "src/main/ipc.ts shell:open-external handler"
      via: "ipcRenderer.send('shell:open-external', url)"
      pattern: "shell:open-external"
---

<objective>
Land the menu-surface scaffolding for Phase 9's Settings + Help deliverables. This plan owns the shared mutation surfaces — `src/main/index.ts` (menu builder), `src/main/ipc.ts` (IPC handlers), `src/preload/index.ts` (3 new bridges), `src/shared/types.ts` (Api interface). Plan 06 (Settings + tooltip) and Plan 07 (Help dialog) consume these scaffolds without further changes to these shared files.

Three additions:

1. **Edit menu Preferences…** with accelerator `CommandOrControl+,` — the cross-platform standard (RESEARCH §Q6 + §Recommendations). On macOS, App-menu Preferences is the HIG; on Win/Linux, Edit→Preferences (or File→Settings) is the convention. Per 08.2 D-188 and RESEARCH §Q6, use a custom Edit-menu submenu (replacing `role: 'editMenu'`) that contains the standard Edit roles PLUS a Preferences entry. The accelerator `CommandOrControl+,` works cross-platform without branching.

2. **Help menu Documentation** — fills the 08.2 D-188 placeholder at `src/main/index.ts:228-232` (currently `{ role: 'help', submenu: [] }`). The placeholder MUST stay (Electron's MenuItemConstructorOptions validation throws if role:help has no submenu — Pitfall 8). Add a Documentation menu item INSIDE the existing submenu array.

3. **`shell:open-external` IPC handler + `openExternalUrl` preload bridge** — needed by Plan 07's HelpDialog to open external links (e.g. Spine docs) in the system browser. **Critical security control:** the main handler validates the URL against a hardcoded allow-list (T-09-05-OPEN-EXTERNAL — arbitrary `shell.openExternal(userControlledUrl)` is a known sandbox-escape vector).

Output:
- `src/main/index.ts` Edit menu replaced with a custom submenu containing standard Edit roles + Preferences; Help submenu contains the Documentation item
- `src/main/ipc.ts` `shell:open-external` handler with hardcoded allow-list (`https://esotericsoftware.com/*`, `https://github.com/leoocunha/Spine_Texture_Manager*`, or whatever the project's documented external links are; planner picks reasonable defaults)
- `src/preload/index.ts` exposes `onMenuSettings`, `onMenuHelp`, `openExternalUrl` (Pitfall 9 listener-identity for the two `onMenu*`)
- `src/shared/types.ts` `Api` interface extended with the 3 new methods
- `tests/main/menu.spec.ts` extended (or new describe block) verifying Preferences + Documentation menu items exist with correct labels + accelerators + click handlers
- `tests/main/ipc.spec.ts` extended (new describe block) verifying `shell:open-external` allow-list rejection of unknown URLs
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md
@CLAUDE.md
@src/main/index.ts
@src/main/ipc.ts
@src/preload/index.ts
@src/shared/types.ts
@tests/main/menu.spec.ts
@tests/main/ipc.spec.ts

<interfaces>
From src/main/index.ts current menu template (around lines 196-233):
```ts
const template: MenuItemConstructorOptions[] = [
  { role: 'appMenu' },
  { label: 'File', submenu: [...] },
  { role: 'editMenu' },         // ← REPLACE with custom submenu containing Preferences
  { role: 'viewMenu' },
  { role: 'windowMenu' },
  { role: 'help', submenu: [] }, // ← FILL the empty submenu with Documentation
];
```

The 08.2 menu builder buildAppMenu(state, mainWindow) signature is unchanged. The new menu items integrate via additional click handlers that call `mainWindow?.webContents.send('menu:settings-clicked')` / `'menu:help-clicked'`.

From src/main/ipc.ts:520-532 (shell:open-folder analog — pattern to mirror for shell:open-external):
```ts
ipcMain.on('shell:open-folder', (_evt, dir) => {
  if (typeof dir === 'string' && dir.length > 0) {
    try { shell.showItemInFolder(dir); } catch {}
  }
});
```

The Phase 9 shell:open-external handler differs in one critical way: an allow-list check before the shell.openExternal call.

From src/preload/index.ts:269-306 (existing onMenuOpen / onMenuOpenRecent / onMenuSave / onMenuSaveAs — Pitfall 9 listener-identity pattern):
```ts
onMenuOpen: (cb: () => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
  ipcRenderer.on('menu:open-clicked', wrapped);
  return () => { ipcRenderer.removeListener('menu:open-clicked', wrapped); };
},
```

The Phase 9 onMenuSettings + onMenuHelp byte-for-byte mirror this — channel name renames + payload type only.

From src/preload/index.ts:138-140 (existing openOutputFolder fire-and-forget pattern):
```ts
openOutputFolder: (dir: string): void => {
  ipcRenderer.send('shell:open-folder', dir);
},
```

The Phase 9 openExternalUrl mirrors this with the channel renamed.

From src/shared/types.ts (Api interface — extend with 3 new methods):
```ts
export interface Api {
  // ... existing methods ...
  onMenuSettings: (cb: () => void) => () => void;   // NEW
  onMenuHelp: (cb: () => void) => () => void;       // NEW
  openExternalUrl: (url: string) => void;            // NEW
}
```

From CLAUDE.md fact #6 + Phase 8 D-146: samplingHz is per-project; default 120 Hz; persists in .stmproj v1. The Settings menu item label is "Preferences…" on macOS (HIG) and either "Settings…" or "Preferences…" on Win/Linux (modern apps like VSCode use "Preferences…"). Use "Preferences…" cross-platform for consistency.
</interfaces>

<allow_list_security_note>
The shell.openExternal API is a documented sandbox-escape vector in Electron. Per Electron's security checklist [https://www.electronjs.org/docs/latest/tutorial/security], NEVER call `shell.openExternal` with renderer-controlled input without explicit allow-list validation.

The Phase 9 in-app help has a finite, statically-known set of external links. Hardcode them in `src/main/ipc.ts` and reject anything else. Suggested allow-list (planner picks reasonable defaults):

```ts
const SHELL_OPEN_EXTERNAL_ALLOWED = new Set<string>([
  'https://esotericsoftware.com/spine-runtimes',  // Spine docs reference
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
  // Add the project's repo URL if it goes in HelpDialog:
  // 'https://github.com/<owner>/Spine_Texture_Manager',
]);
```

The handler:
```ts
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) {
    // Silent rejection — defense in depth. The renderer authors the URLs;
    // the closed allow-list catches accidental mistakes and any future
    // compromise of the renderer that injects arbitrary URLs.
    return;
  }
  try {
    void shell.openExternal(url);
  } catch {
    /* silent — one-way channel; nothing to return */
  }
});
```

Test: feed a non-allow-listed URL (e.g., `https://evil.example.com/`) and confirm `shell.openExternal` is NOT called. Feed an allow-listed URL and confirm it IS called.
</allow_list_security_note>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add Preferences (Edit menu) + Documentation (Help menu) items + click handlers in src/main/index.ts; extend tests/main/menu.spec.ts</name>
  <files>src/main/index.ts, tests/main/menu.spec.ts</files>
  <read_first>
    - src/main/index.ts (full file — buildAppMenu function around lines 130-236; the existing template at :196-233; the existing role: 'help' empty-submenu placeholder at :228-232)
    - tests/main/menu.spec.ts (full file — existing 7 cases for the 08.2 enabled-state matrix; analog for the new Preferences + Documentation cases)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Q6 Settings modal accelerator on Win/Linux" — accelerator + menu placement guidance; §"Pitfall 8 Help-menu role:'help' requires non-empty submenu")
    - .planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md (§Claude's Discretion — Settings modal recommendation: Edit→Preferences on macOS, File→Settings on Win/Linux; we are unifying as Edit→Preferences cross-platform per RESEARCH §Q6 simplification recommendation)
  </read_first>
  <behavior>
    - Edit menu (replacing role:'editMenu') contains the standard Edit roles (undo, redo, cut, copy, paste, delete, selectAll) PLUS a separator + Preferences… item
    - Preferences… item: label "Preferences…", accelerator "CommandOrControl+,", click handler fires mainWindow?.webContents.send('menu:settings-clicked')
    - Help submenu (the existing role:'help' placeholder) contains a Documentation item: label "Documentation", click handler fires mainWindow?.webContents.send('menu:help-clicked')
    - Help submenu still has role:'help' (Pitfall 8 — Electron validation requires the role)
    - tests/main/menu.spec.ts gains 2 new cases (h, i): (h) Preferences menu item exists with correct label + accelerator + click sends menu:settings-clicked; (i) Documentation menu item exists in Help submenu with correct label + click sends menu:help-clicked
  </behavior>
  <action>
Step 1. Replace `{ role: 'editMenu' }` in the menu template with a custom Edit submenu containing the standard Edit roles + Preferences:

```ts
{
  label: 'Edit',
  submenu: [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'pasteAndMatchStyle' },  // macOS-only — Electron auto-hides on Win/Linux
    { role: 'delete' },
    { role: 'selectAll' },
    { type: 'separator' },
    {
      label: 'Preferences…',
      accelerator: 'CommandOrControl+,',
      // T-09-05-MENU-01: enabled state ties to the existing menu-state
      // matrix from 08.2 D-188. Preferences is always available — even
      // in the empty/error AppState (the user can still inspect the
      // current samplingHz default of 120). Mirrors File→Open which is
      // also unconditionally enabled per D-187 (the canonical 08.2 fix).
      click: () => mainWindowRef?.webContents.send('menu:settings-clicked'),
    },
  ],
},
```

Step 2. Replace `{ role: 'help', submenu: [] }` with the same role:'help' but a populated submenu:

```ts
{
  role: 'help',
  submenu: [
    {
      label: 'Documentation',
      // T-09-05-MENU-02: also unconditionally enabled. Help is always
      // available regardless of AppState.
      click: () => mainWindowRef?.webContents.send('menu:help-clicked'),
    },
    // 08.2 D-188 — macOS Help-menu search comes free with role:'help'.
    // No additional items needed for that.
  ],
},
```

Verify the existing buildAppMenu function reads `mainWindowRef` (not the argument `mainWindow`) — adapt the click handlers to whatever the existing `'menu:open-clicked'` handler at line ~205 uses.

Step 3. Run `npx electron-vite build` to confirm Electron's MenuItemConstructorOptions validation accepts the new template. If validation throws (e.g., "Invalid template for MenuItem"), the issue is likely role:'pasteAndMatchStyle' on Win/Linux — but Electron auto-hides this role on platforms where it doesn't apply, so it should validate fine. If a different role rejects, check the role list at https://www.electronjs.org/docs/latest/api/menu#standard-menus.

Step 4. Extend tests/main/menu.spec.ts with 2 new cases:

```ts
describe('Phase 9 Plan 05 — Edit menu Preferences (Claude Discretion + RESEARCH §Q6)', () => {
  it('Preferences… item exists in Edit menu with accelerator CommandOrControl+,', async () => {
    const menu = await buildAppMenu(/* default state */, /* mock window */);
    const editMenu = menu.items.find((m) => m.label === 'Edit');
    expect(editMenu).toBeDefined();
    const prefsItem = editMenu!.submenu!.items.find((i) => i.label === 'Preferences…');
    expect(prefsItem).toBeDefined();
    expect(prefsItem!.accelerator).toBe('CommandOrControl+,');
  });

  it('Preferences click fires menu:settings-clicked on the main window webContents', async () => {
    const send = vi.fn();
    const fakeWindow = { webContents: { send } } as unknown as BrowserWindow;
    // Manually set mainWindowRef via the existing test scaffold; if the
    // builder reads from a module-level ref (08.2 pattern), the test
    // mocks that ref. Adapt to the existing menu.spec.ts setup.
    setMainWindowRefForTest(fakeWindow);  // existing helper from 08.2 menu.spec.ts
    const menu = await buildAppMenu(/* default state */, fakeWindow);
    const editMenu = menu.items.find((m) => m.label === 'Edit')!;
    const prefsItem = editMenu.submenu!.items.find((i) => i.label === 'Preferences…')!;
    prefsItem.click(/* args ignored */);
    expect(send).toHaveBeenCalledWith('menu:settings-clicked');
  });
});

describe('Phase 9 Plan 05 — Help menu Documentation (Claude Discretion + 08.2 D-188 placeholder)', () => {
  it('Documentation item exists in Help submenu', async () => {
    const menu = await buildAppMenu(/* default state */, /* mock window */);
    const helpMenu = menu.items.find((m) => m.role === 'help');
    expect(helpMenu).toBeDefined();
    const docsItem = helpMenu!.submenu!.items.find((i) => i.label === 'Documentation');
    expect(docsItem).toBeDefined();
  });

  it('Documentation click fires menu:help-clicked on the main window webContents', async () => {
    const send = vi.fn();
    const fakeWindow = { webContents: { send } } as unknown as BrowserWindow;
    setMainWindowRefForTest(fakeWindow);
    const menu = await buildAppMenu(/* default state */, fakeWindow);
    const helpMenu = menu.items.find((m) => m.role === 'help')!;
    const docsItem = helpMenu.submenu!.items.find((i) => i.label === 'Documentation')!;
    docsItem.click(/* args ignored */);
    expect(send).toHaveBeenCalledWith('menu:help-clicked');
  });
});
```

Adapt the test setup helpers (like `setMainWindowRefForTest`) to whatever the existing 08.2 menu.spec.ts uses. Read the file and follow the established harness.
  </action>
  <verify>
    <automated>npm run test tests/main/menu.spec.ts &amp;&amp; grep -q "Preferences" src/main/index.ts &amp;&amp; grep -q "Documentation" src/main/index.ts &amp;&amp; grep -q "menu:settings-clicked" src/main/index.ts &amp;&amp; grep -q "menu:help-clicked" src/main/index.ts &amp;&amp; npx electron-vite build</automated>
  </verify>
  <acceptance_criteria>
    - src/main/index.ts contains label "Preferences…" with accelerator "CommandOrControl+,"
    - src/main/index.ts contains label "Documentation" inside the role:'help' submenu
    - src/main/index.ts contains exactly two new webContents.send calls: 'menu:settings-clicked' and 'menu:help-clicked'
    - src/main/index.ts NO LONGER contains `{ role: 'editMenu' }` (replaced by custom Edit submenu)
    - src/main/index.ts STILL contains `role: 'help'` (Pitfall 8 — Electron validation requires the role; placeholder is filled, not removed)
    - tests/main/menu.spec.ts contains at least 4 new test cases (2 for Preferences, 2 for Documentation) and all GREEN
    - npx electron-vite build exits 0 (Electron's MenuItemConstructorOptions validation accepts the new template)
    - 08.2 enabled-state matrix tests still GREEN — the new menu items don't break the existing enable/disable rules
  </acceptance_criteria>
  <done>The Edit menu surfaces Preferences with the cross-platform accelerator; the Help submenu surfaces Documentation. Click handlers fire one-way IPC events that Plans 06 and 07 subscribe to. Tests verify the menu shape.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add shell:open-external IPC handler with allow-list + extend preload + types + tests/main/ipc.spec.ts</name>
  <files>src/main/ipc.ts, src/preload/index.ts, src/shared/types.ts, tests/main/ipc.spec.ts</files>
  <read_first>
    - src/main/ipc.ts:520-532 (existing 'shell:open-folder' handler — pattern to mirror except for the allow-list check)
    - src/preload/index.ts:113-115 + :126-132 + :138-140 + :269-306 (existing fire-and-forget + onMenu* listener-identity patterns — analogs for the 3 new methods)
    - src/shared/types.ts (existing Api interface — extend with onMenuSettings + onMenuHelp + openExternalUrl)
    - tests/main/ipc.spec.ts (existing Map-backed ipcMainOnHandlers captor + describe block patterns)
    - .planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md (§"Open Q5 + cross-cutting trust-boundary input validation")
  </read_first>
  <behavior>
    - src/preload/index.ts exposes `onMenuSettings(cb)`, `onMenuHelp(cb)`, `openExternalUrl(url)` with Pitfall 9 listener-identity preservation for the two onMenu* methods
    - src/shared/types.ts Api interface declares the 3 new methods
    - src/main/ipc.ts has a `'shell:open-external'` handler registered via ipcMain.on
    - The handler validates: typeof url === 'string' AND url.length > 0 AND url is an exact match in a hardcoded `SHELL_OPEN_EXTERNAL_ALLOWED` Set
    - Non-allow-listed URLs result in silent rejection (no shell.openExternal call, no error response — one-way channel)
    - Allow-listed URLs invoke shell.openExternal(url); errors are caught silently
    - tests/main/ipc.spec.ts gains a new describe block: handler exists, allow-listed URL triggers shell.openExternal mock, non-allow-listed URL does NOT trigger shell.openExternal
  </behavior>
  <action>
Step 1. Extend src/shared/types.ts Api interface:

```ts
export interface Api {
  // ... existing methods ...
  // ... onMenuOpen / onMenuOpenRecent / onMenuSave / onMenuSaveAs from 08.2 ...

  /**
   * Phase 9 Plan 05 — subscribe to Edit→Preferences… menu click.
   * Pitfall 9 listener-identity preservation.
   */
  onMenuSettings: (cb: () => void) => () => void;

  /**
   * Phase 9 Plan 05 — subscribe to Help→Documentation menu click.
   * Pitfall 9 listener-identity preservation.
   */
  onMenuHelp: (cb: () => void) => () => void;

  /**
   * Phase 9 Plan 05 — open an external URL in the system browser.
   * One-way fire-and-forget. Main validates url against a hardcoded
   * allow-list (T-09-05-OPEN-EXTERNAL); non-allow-listed URLs are
   * silently rejected.
   *
   * Renderer-side callers (HelpDialog) should pass only static, hardcoded
   * URLs that match the allow-list. The handler exists as defense-in-
   * depth even though the contextBridge surface limits exposure.
   */
  openExternalUrl: (url: string) => void;
}
```

Step 2. Extend src/preload/index.ts. Add 3 new methods to the api literal (after the existing onMenu* methods around lines 269-306):

```ts
/**
 * Phase 9 Plan 05 — subscribe to menu Edit→Preferences… click.
 * Pitfall 9: wrapped const captured for listener-identity preservation.
 */
onMenuSettings: (cb: () => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
  ipcRenderer.on('menu:settings-clicked', wrapped);
  return () => {
    ipcRenderer.removeListener('menu:settings-clicked', wrapped);
  };
},

/**
 * Phase 9 Plan 05 — subscribe to menu Help→Documentation click.
 * Pitfall 9: wrapped const captured for listener-identity preservation.
 */
onMenuHelp: (cb: () => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
  ipcRenderer.on('menu:help-clicked', wrapped);
  return () => {
    ipcRenderer.removeListener('menu:help-clicked', wrapped);
  };
},

/**
 * Phase 9 Plan 05 — open an external URL in the system browser.
 * Main validates against a hardcoded allow-list. One-way fire-and-forget.
 */
openExternalUrl: (url: string): void => {
  ipcRenderer.send('shell:open-external', url);
},
```

Step 3. Extend src/main/ipc.ts. Define the allow-list at module level (near the other module-level constants around lines 88-105):

```ts
// Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — closed allow-list of URLs that
// shell.openExternal will honor. Defense in depth: the contextBridge
// surface only exposes openExternalUrl to the trusted renderer; this
// allow-list catches accidental mistakes (typo'd URLs in HelpDialog) and
// any future renderer compromise that tries to open arbitrary URLs.
//
// Add new entries here when HelpDialog references additional documentation.
// NEVER allow user-controlled (e.g., skeleton path, project path) URLs.
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
  // Future entries: project repo URL if/when HelpDialog references it.
]);
```

Add the import for `shell` at the top of ipc.ts (it's already imported per ipc.ts:39 — verify).

Append the new IPC handler inside `registerIpcHandlers()` (after the existing `'shell:open-folder'` handler around line 532):

```ts
// Phase 9 Plan 05 — open external URL in the system browser. Allow-list
// validated (T-09-05-OPEN-EXTERNAL). Silent rejection for typeof / empty /
// non-allow-listed (one-way channel — no envelope to return).
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
  try {
    void shell.openExternal(url);
  } catch {
    /* silent — one-way channel; nothing to return */
  }
});
```

Step 4. Extend tests/main/ipc.spec.ts. Add a new describe block:

```ts
describe('Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — shell:open-external allow-list', () => {
  it('shell:open-external handler is registered on ipcMain.on', async () => {
    registerIpcHandlers();
    expect(ipcMainOnHandlers.has('shell:open-external')).toBe(true);
  });

  it('allow-listed URL triggers shell.openExternal', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('shell:open-external')!;
    const openExternalMock = vi.mocked(shell.openExternal);
    openExternalMock.mockClear();
    handler({} as unknown, 'https://esotericsoftware.com/spine-runtimes');
    expect(openExternalMock).toHaveBeenCalledWith('https://esotericsoftware.com/spine-runtimes');
  });

  it('non-allow-listed URL is silently rejected (shell.openExternal NOT called)', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('shell:open-external')!;
    const openExternalMock = vi.mocked(shell.openExternal);
    openExternalMock.mockClear();
    handler({} as unknown, 'https://evil.example.com/');
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('non-string url is silently rejected', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('shell:open-external')!;
    const openExternalMock = vi.mocked(shell.openExternal);
    openExternalMock.mockClear();
    handler({} as unknown, 12345);
    handler({} as unknown, null);
    handler({} as unknown, undefined);
    handler({} as unknown, '');
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});
```

Update the existing electron mock in tests/main/ipc.spec.ts to include `shell.openExternal` as a vi.fn() (the existing mock probably mocks shell.showItemInFolder — extend it):

```ts
vi.mock('electron', () => ({
  // ... existing mocks ...
  shell: {
    showItemInFolder: vi.fn(),
    openExternal: vi.fn(),  // NEW
  },
}));
```
  </action>
  <verify>
    <automated>npm run test tests/main/ipc.spec.ts -- -t "shell:open-external|sampler" &amp;&amp; grep -q "shell:open-external" src/main/ipc.ts &amp;&amp; grep -q "openExternalUrl" src/preload/index.ts &amp;&amp; grep -q "onMenuSettings" src/preload/index.ts &amp;&amp; grep -q "onMenuHelp" src/preload/index.ts &amp;&amp; grep -q "SHELL_OPEN_EXTERNAL_ALLOWED" src/main/ipc.ts &amp;&amp; npx tsc --noEmit -p tsconfig.node.json &amp;&amp; npx tsc --noEmit -p tsconfig.web.json</automated>
  </verify>
  <acceptance_criteria>
    - src/shared/types.ts Api interface contains onMenuSettings, onMenuHelp, openExternalUrl method declarations
    - src/preload/index.ts api literal contains onMenuSettings + onMenuHelp methods with `wrapped const` captured BEFORE ipcRenderer.on (Pitfall 9 listener-identity)
    - src/preload/index.ts api literal contains openExternalUrl method calling ipcRenderer.send('shell:open-external', url)
    - src/main/ipc.ts contains exactly one ipcMain.on('shell:open-external', ...) registration
    - src/main/ipc.ts contains module-level SHELL_OPEN_EXTERNAL_ALLOWED Set with at least one entry
    - The handler validates typeof url === 'string' AND url.length > 0 AND SHELL_OPEN_EXTERNAL_ALLOWED.has(url) before calling shell.openExternal
    - npm run test tests/main/ipc.spec.ts -t "shell:open-external" GREEN — all 4 sub-cases (registered, allow-listed call, non-allow-listed reject, non-string reject)
    - npm run test tests/main/ipc.spec.ts overall GREEN (existing 'menu:notify-state' + 'sampler:cancel' from Plan 02 + new shell:open-external all pass)
    - npx tsc --noEmit -p tsconfig.node.json AND -p tsconfig.web.json both exit 0
  </acceptance_criteria>
  <done>The IPC layer + preload bridges + types are wired for Settings menu, Help menu, and external URL. Plan 06 (Settings/tooltip) and Plan 07 (Help dialog) consume these scaffolds without further shared-file changes. The allow-list pattern documents itself for future external-link additions.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → main: `'shell:open-external'` | Renderer-origin one-way send with a string URL payload. The contextBridge surface (openExternalUrl) only exposes this method to the trusted renderer; the main handler validates against a closed allow-list as defense in depth. |
| main → renderer: `'menu:settings-clicked'` + `'menu:help-clicked'` | Main-origin one-way sends; payload-less. Renderer subscribes via window.api.onMenuSettings + onMenuHelp. |
| menu click → shell.openExternal (transitive) | shell.openExternal(url) is the OS-mediated handoff to the user's default browser. URL is allow-list-validated before this call. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-05-OPEN-EXTERNAL | Tampering / Elevation of Privilege | shell.openExternal called with arbitrary URL | mitigate | Closed allow-list validation in src/main/ipc.ts handler (SHELL_OPEN_EXTERNAL_ALLOWED Set). Silent rejection for non-allow-listed URLs. Renderer-authored URLs in HelpDialog are static and hardcoded; an attacker who compromises the renderer cannot inject arbitrary URLs because the allow-list catches them. |
| T-09-05-OPEN-EXTERNAL-2 | Information Disclosure | URL leak via shell.openExternal | accept | Allow-listed URLs go to public Spine documentation pages. No PII or project content in the URL. |
| T-09-05-MENU-IPC | Spoofing / Tampering | menu:settings-clicked or menu:help-clicked | accept | Main-origin one-way sends — main authors the events. Renderer cannot spoof these channels through the contextBridge (preload only exposes onMenu* listeners, not senders). |
| T-09-05-MENU-DOS | Denial of Service | menu click flood | accept | Click handlers fire `webContents.send` once per click. webContents.send is a non-blocking IPC; flood is rate-limited by the OS event loop and the user's mouse/keyboard. |
| T-09-05-LISTENER-LEAK | Memory leak (DoS over time) | onMenuSettings / onMenuHelp listener identity | mitigate | Pitfall 9 listener-identity preservation: wrapped const captured BEFORE ipcRenderer.on; unsubscribe closure references the same const for ipcRenderer.removeListener (which compares by reference). Mirrors the established 08.2 pattern verbatim. |
</threat_model>

<verification>
After Task 2:
1. npm run test tests/main/menu.spec.ts — all 7 existing + 4 new (Preferences + Documentation) cases GREEN
2. npm run test tests/main/ipc.spec.ts — all existing + 4 new (shell:open-external) cases GREEN; sampler:cancel + menu:notify-state still GREEN
3. npx electron-vite build exits 0 (menu template validation passes)
4. grep -n "menu:settings-clicked\|menu:help-clicked\|shell:open-external" src/main/index.ts src/main/ipc.ts src/preload/index.ts — all three channels present in their respective files
5. npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json both exit 0
6. Manual smoke (NOT automated; deferred to Plan 08): npm run dev, click Edit→Preferences (renderer logs unhandled menu:settings-clicked), click Help→Documentation (renderer logs unhandled menu:help-clicked) — both events fire; Plan 06 + Plan 07 subscribe and mount dialogs
</verification>

<success_criteria>
- [ ] src/main/index.ts: custom Edit submenu replaces role:'editMenu', contains Preferences with CommandOrControl+, accelerator
- [ ] src/main/index.ts: role:'help' submenu populated with Documentation item
- [ ] src/main/ipc.ts: shell:open-external handler with hardcoded allow-list
- [ ] src/preload/index.ts: onMenuSettings + onMenuHelp + openExternalUrl exposed via contextBridge
- [ ] src/shared/types.ts: Api interface declares the 3 new methods
- [ ] tests/main/menu.spec.ts: 4+ new test cases for Preferences + Documentation menu items
- [ ] tests/main/ipc.spec.ts: 4+ new test cases for shell:open-external allow-list
- [ ] All Phase 9 tests so far (Plan 02 + Plan 03 + Plan 04 + Plan 05) GREEN
- [ ] Pre-existing tests GREEN (no regressions)
- [ ] `<threat_model>` block present (above) — covers shell.openExternal allow-list + IPC + listener leak
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-05-SUMMARY.md` summarizing:
- Menu surface diff: Preferences added under Edit; Documentation added under Help (role:'help' preserved)
- Allow-list URLs (initial set)
- Test count delta (4 new menu.spec.ts cases + 4 new ipc.spec.ts cases)
- Plan 06 + Plan 07 unblocked
</output>
