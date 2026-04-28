---
created: 2026-04-28T17:25:00Z
title: Windows About panel shows 1.1.0.0 instead of SemVer pre-release version
area: ui
files:
  - src/main/index.ts
---

## Problem

On Windows, clicking the menu item "Spine Texture Manager → About spine-texture-manager" opens Electron's default About dialog and shows version `1.1.0.0` — but the actual app version is `1.1.0-rc2`. Discovered 2026-04-28 during Plan 12.1-05 Step 1 (rc2 install on Windows host).

Root cause: we don't call `app.setAboutPanelOptions(...)` anywhere in `src/main/index.ts`. Without that call, Electron's default About panel on Windows reads the executable's win32 file metadata `FileVersion` field, which electron-builder pads from `1.1.0-rc2` to `1.1.0.0` because the win32 FileVersion field requires exactly 4 numeric components (no SemVer pre-release suffixes allowed).

The runtime `app.getVersion()` call (used by `src/main/auto-update.ts:129`) correctly returns `1.1.0-rc2` because it reads from `package.json` inside the bundled app resources, NOT from win32 file metadata. So **auto-update detection is unaffected** — the SemVer comparison `1.1.0-rc2 < 1.1.0-rc3` works correctly when rc3 is published.

UX impact: low. Spine animators on Windows seeing `1.1.0.0` won't realize they're on `rc2`. If multiple rc tags ship, all of them show as `1.1.0.0` in the About panel — testers can't tell rcs apart from the About dialog. The actual installed version is observable from win32 Programs and Features (also `1.1.0.0`) or from `app.getVersion()` via DevTools. Not a v1.1 blocker; a v1.1.1 polish item.

macOS is unaffected — macOS reads `Info.plist` `CFBundleShortVersionString` which preserves the full SemVer string `1.1.0-rc2` natively.

## Solution

Single-block fix: in `src/main/index.ts` (probably near `app.whenReady()` boot path or in the `ready` handler), add:

```ts
app.setAboutPanelOptions({
  applicationName: 'Spine Texture Manager',
  applicationVersion: app.getVersion(),  // forces SemVer string on all platforms
  copyright: '...',                       // optional
  // version: '...',                      // optional second-line version
});
```

This makes Electron's default About panel use the SemVer string consistently across all 3 OSes. Confirmed-fix path: package a v1.1.1 build, install on Windows, click "About …" — should show `1.1.1` (or `1.1.1-rc1` etc.) instead of `1.1.1.0`.

Test surface: no automated test surface affected (About-panel content isn't covered by vitest). Manual rc-install verification on Windows is the gate.

Optional refinement: if we ever want a richer About dialog (icon, description, copyright, "Built with Electron / TypeScript / React"), we can populate the full options object instead of leaving Electron defaults.

## Cross-references

- Discovered during Phase 12.1 Plan 12.1-05 Step 1 (rc2 install on Windows, 2026-04-28)
- Related: D-04 (Windows windows-fallback variant — testers need to know which rc they're on)
- Sibling: 2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md (same testing round, same v1.1.1 polish bucket)
