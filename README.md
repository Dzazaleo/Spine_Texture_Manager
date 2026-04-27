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

## Reporting issues

Open an issue at [github.com/Dzazaleo/Spine_Texture_Manager/issues](https://github.com/Dzazaleo/Spine_Texture_Manager/issues). For installation problems, see [INSTALL.md](INSTALL.md) Troubleshooting sections first.
