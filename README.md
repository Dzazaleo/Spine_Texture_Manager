# Spine Texture Manager

Desktop app (Electron + TypeScript + React) that reads Spine 4.2+ skeleton JSON and computes the peak world-space render scale for every attachment, across every animation and skin. Used by Spine animators to right-size textures per-asset before atlas export.

## Installing

For non-developer testers: see [INSTALL.md](INSTALL.md) for per-OS install + first-launch instructions (download links, Gatekeeper / SmartScreen / libfuse2 walkthroughs).

For developers (build from source): clone the repo, `npm install`, `npm run dev`. See `CLAUDE.md` for project conventions and the GSD phase-gated workflow used to develop this codebase.

## What it does

- Reads a Spine 4.2+ skeleton JSON + companion `.atlas` + `images/` folder.
- Samples every animation across every skin at 120 Hz (configurable in Settings) using the official Spine runtime math (`computeWorldVertices` after `updateWorldTransform(Physics.update)`).
- Computes the peak world-space render scale for every attachment (regions and meshes), accounting for IK, transform constraints, path constraints, physics constraints, and deform timelines.
- Surfaces the per-attachment peak so animators can resize source textures uniformly without losing render fidelity.
- Optionally re-encodes the atlas's PNG sources at the computed peak dimensions via `sharp` (Lanczos3 filter), preserving the originals.

## Requirements

- macOS 13+, Windows 10/11 64-bit, or Linux x86_64 (Ubuntu 22.04+ tested).
- Spine editor 4.2 or later for the input skeleton JSON. (3.x and earlier are hard-rejected at load time with a typed error.)

## Commands (developer)

- `npm run test` — vitest run
- `npm run test:watch` — vitest watch
- `npm run dev` — Electron dev server
- `npm run build` — production build
- `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — CLI table dump

## Building on Windows

`npm run build` packages installers via `electron-builder`, which downloads `winCodeSign-2.6.0.7z` to its cache. This archive contains macOS dylib symlinks; extracting them on Windows requires either Administrator privileges or **Developer Mode** enabled.

### One-time setup (recommended)

1. Open **Settings → Privacy & Security → For developers**.
2. Toggle **Developer Mode** ON. (Grants the current user permission to create symbolic links without elevation.)
3. Restart the terminal.

After this, `npm run build:win` runs as your normal user.

### Quick path: skip signing entirely

For unsigned local test builds (no installer, just a runnable directory):

```powershell
npx electron-builder --win --x64 --dir
```

This sidesteps the `winCodeSign` cache extraction. Output is at `release/win-unpacked/` — run `Spine Texture Manager.exe` directly.

### Alternative: run as Administrator

If Developer Mode is disabled by your IT policy, run the terminal as Administrator instead. `winCodeSign` extracts under elevated privileges and the build proceeds.

### What the error looks like

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client. :
  C:\Users\<you>\AppData\Local\electron-builder\Cache\winCodeSign\<id>\darwin\10.12\lib\libcrypto.dylib
```

`npm run dev` is unaffected — only packaged builds need this.

## Reporting issues

Open an issue at [github.com/Dzazaleo/Spine_Texture_Manager/issues](https://github.com/Dzazaleo/Spine_Texture_Manager/issues). For installation problems, see [INSTALL.md](INSTALL.md) Troubleshooting sections first.
