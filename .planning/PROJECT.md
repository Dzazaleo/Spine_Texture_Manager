# Spine Texture Manager

## Purpose

A desktop app that reads **Spine 4.2+ skeleton JSON** and computes the **peak world-space render scale for every individual attachment** across every animation and skin. When no timeline touches an attachment, the setup pose is used as the reference. The animator then uses the app to export a per-attachment-optimized `images/` folder, preserving image quality via Lanczos3 resampling.

## Why it exists

Spine animators build rigs with 4K source assets. Shipping those high-res assets to runtime (e.g., online games) tanks performance. Spine's export dialog only applies a **single flat scale** to every texture, which either wastes VRAM on assets that never need full resolution or degrades assets that genuinely do. This tool computes the *correct* per-asset target resolution from the skeleton's math, not guesswork.

## Primary user

Spine animators exporting rigs for performance-sensitive runtimes (mobile games, web games, etc.). Assumes fluency in Spine concepts (bones, slots, attachments, skins, constraints) but not in runtime math.

## Outcome

Animators ship atlases that are as small as they mathematically can be without visible quality loss. Driven by the actual world-space transforms the runtime computes, so results match what the game will render.

## Tech stack (locked)

- **Shell:** Electron (cross-platform desktop; direct filesystem access for images/atlas I/O)
- **Language:** TypeScript (matches the official `spine-ts` runtime)
- **Core runtime:** `@esotericsoftware/spine-core` — authoritative skeleton/animation/constraint/physics math
- **UI:** React + Vite, styled with Tailwind CSS
- **Image resize:** `sharp` (libvips, Lanczos3 default) for high-quality PNG downsampling
- **Atlas parsing:** `spine-core`'s `TextureAtlas` class (don't reinvent)
- **Testing:** `vitest` (Node-native, fast, matches our toolchain)

## Key architectural decisions

1. **`core/` is pure TypeScript with zero DOM/Electron dependencies.** Testable headless in Node. The UI consumes it via React hooks. Every math function is deterministic and golden-tested.
2. **We do not decode PNGs during the math phase.** A stub `TextureLoader` populated from `.atlas` metadata is enough for `spine-core` to compute world vertices. PNGs are read only by `sharp` during "Optimize Assets."
3. **Sampling rate is a configurable analysis hyperparameter** (default 120 Hz), not a Spine constraint. Spine stores keyframes in seconds; the JSON `fps` field is editor metadata only.
4. **Phase 0 derisks the core math before any UI work.** A pure Node + TS spike with golden tests against the user's simple fixture must pass before we scaffold Electron.

## Project root

`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/`

## Key references

- Approved plan: `~/.claude/plans/i-need-to-create-zesty-eich.md`
- Simple test rig: `fixtures/SIMPLE_PROJECT/` (CIRCLE, SQUARE, TRIANGLE attachments + CHAIN_2..8 bone chain + TransformConstraint)
- Spine 4.2 API: <http://esotericsoftware.com/spine-api-reference>
- Spine JSON format spec: <https://en.esotericsoftware.com/spine-json-format>
- Sharp resize API: <https://sharp.pixelplumbing.com/api-resize/>
