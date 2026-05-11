# Spine Texture Manager

Desktop app (Electron + TypeScript + React) that reads Spine 4.2+ skeleton JSON and computes the peak world-space render scale for every attachment, across every animation and skin. Used by Spine animators to right-size source textures per-asset, then export an optimized `images/` folder ready to re-pack or ship as loose images (atlas-less).

Latest release: [v1.3.6](https://github.com/Dzazaleo/Spine_Texture_Manager/releases/latest) — see [INSTALL.md](INSTALL.md) for download + first-launch instructions.

## Installing

For non-developer testers: see [INSTALL.md](INSTALL.md) for per-OS install + first-launch instructions (download links, Gatekeeper / SmartScreen / libfuse2 walkthroughs).

For developers (build from source): clone the repo, `npm install`, `npm run dev`. See `CLAUDE.md` for project conventions and the GSD phase-gated workflow used to develop this codebase.

## What it does

- Reads a Spine 4.2+ skeleton JSON in either supported delivery shape:
  - **Atlas-source mode** — `.json` + companion `.atlas` + atlas page PNGs. The atlas must be exported from Spine with **Rotation** unchecked; rotated regions are not yet supported (planned for v1.4) and load with a clear error.
  - **Atlas-less mode** — `.json` + a loose `images/` folder (no `.atlas`). This is the workflow Esoteric officially recommends; the app synthesizes a virtual atlas from the loose images.
- Samples every animation across every skin at 120 Hz (configurable in Settings) using the official Spine runtime math (`computeWorldVertices` after `updateWorldTransform(Physics.update)`).
- Computes the peak world-space render scale for every attachment (regions and meshes), accounting for IK, transform constraints, path constraints, physics constraints, and deform timelines.
- Surfaces the per-attachment peak in Global + Animation Breakdown views, with a dims-badge that warns when actual source-PNG dimensions drift from the canonical dims declared in the atlas.
- Lets you set **per-attachment overrides** when you want to ship a region larger or smaller than the computed peak, and preview the resulting atlas pack before exporting.
- Exports an optimized `images/` folder via `sharp` (Lanczos3 + optional sharpen-on-downscale + configurable safety-buffer %); originals are never overwritten. Already-optimized rows passthrough as byte copies.
- Saves your project + overrides + export settings to a `.stmproj` file you can reopen later.
- Builds an HTML **Documentation report** for a skeleton — per-attachment dims, peaks, overrides, animations, and skin coverage — ready to hand to the rest of the team.

## Requirements

- macOS 13+ or Windows 10/11 64-bit. (Linux is build-capable from source but not shipped — no UAT yet.)
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
