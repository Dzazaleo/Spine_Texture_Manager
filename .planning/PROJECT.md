# Spine Texture Manager

## What This Is

A desktop app (Electron + React + TypeScript) that reads Spine 4.2+ skeleton JSON and computes the **peak world-space render scale for every individual attachment** across every animation and skin. When no timeline touches an attachment, the setup pose is used as the reference. The animator then exports a per-attachment-optimized `images/` folder via sharp Lanczos3, preserving image quality.

v1.0 ships seven coordinated surfaces: a headless math core, two analysis panels (Global Max Render Source + Animation Breakdown), per-attachment scale overrides (% of source dims), unused-attachment detection, sharp Lanczos3 image export, an atlas-preview modal with maxrects-packer projection, and crash-safe `.stmproj` save/load.

## Core Value

Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

## Current State (post v1.0)

**Shipped:** v1.0 MVP — 2026-04-26 (12 phases, 62 plans, ~13.3K LOC TS/TSX in `src/`, ~8.4K in `tests/`, 331 vitest passing). Tag: `v1.0`. See `.planning/MILESTONES.md` for full v1.0 record.

**Working:** Drop a Spine `.json` or `.stmproj` → Global + Animation Breakdown panels populate → set per-attachment overrides via dialog (% of source dims, capped at 100%) → preview the resulting atlas pack → export an optimized `images/` folder. `worker_threads` sampler offload + TanStack Virtual at N≥100 keep complex rigs (~80 attachments / 16 animations) interactive — `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` samples in 606 ms (~17× under the N2.2 contract).

**Tech stack (locked, validated through v1.0):**
- Electron 41 + electron-vite 5 + electron-builder 26
- TypeScript (strict) + React 19 + Tailwind v4 (`@theme inline`)
- `@esotericsoftware/spine-core` 4.2.111 — skeleton/animation/constraint/physics math
- `sharp` 0.34.5 — image resize (libvips Lanczos3)
- `maxrects-packer` — atlas pack projection
- `@tanstack/react-virtual` — Phase 9 row virtualization
- `vitest` 4 — testing

**Known deferred (carried into next milestone or post-MVP):**
- F1.5 Spine 4.3+ versioned loader adapters
- N4.1 signed `.dmg` / `.exe` distribution (electron-builder config landed; signing + notarization not yet)
- SEED-001 atlas-less mode (json + images folder, no `.atlas`)
- SEED-002 dims-badge + override-math cap (canonical vs source mismatch)
- Phase-0 scale-overshoot debug session (`investigating`; v1.0 ships current behavior)

## Current Milestone: v1.1 Distribution

**Goal:** Ship cross-platform installers (Windows / macOS / Linux) via GitHub Releases with auto-update, so the app can be distributed to testers without `git clone` / Node toolchain.

**Target features:**
- **Cross-platform installer build** — electron-builder targets: Windows `.exe` (NSIS), macOS `.dmg` (universal or arm64+x64), Linux `.AppImage`. User cannot test Linux locally — Linux build must be CI-only with reasonable defaults.
- **GitHub Actions CI build pipeline** — tag-triggered workflow (`v*.*.*`) that builds all 3 platforms in parallel and uploads artifacts to a draft GitHub Release.
- **GitHub Releases distribution channel** — releases published with installer assets attached, release-notes template, tester-facing install instructions for each OS (including Gatekeeper / SmartScreen workarounds).
- **Auto-update via electron-updater** — wired to GitHub Releases feed; check-on-startup + on-demand "Check for Updates" menu item; graceful UX when update unavailable / network offline.
- **Signing posture (Phase 1, no paid certs):** ad-hoc signing on macOS (testers right-click → Open the first time); unsigned Windows (SmartScreen "More info → Run anyway"); AppImage on Linux needs no signing. Document the bypass steps in release notes.
- **Tester-facing install docs** — short per-OS install guide bundled in the release description and a stable `INSTALL.md` in repo root.

**Key context / constraints:**
- User cannot test Linux locally — reliance on CI build success + AppImage's portability.
- Apple Developer ID and Windows EV cert are explicitly out of scope for v1.1 (cost / time). Will revisit after tester feedback.
- App-Store / Microsoft Store distribution is out of scope.
- electron-updater on Windows historically required code-signed builds; need to verify whether unsigned + GitHub Releases path works (research / spike during plan-phase).
- Existing v1.0 capabilities must remain shippable — no scope creep into UI improvements or Documentation Builder (deferred to v1.2+).

## Primary user

Spine animators exporting rigs for performance-sensitive runtimes (mobile games, web games). Assumes fluency in Spine concepts (bones, slots, attachments, skins, constraints) but not in runtime math.

## Key Decisions (v1.0 outcomes)

| Decision | Outcome | Notes |
|----------|---------|-------|
| `core/` is pure TS, zero DOM/Electron deps | ✓ Good | Layer 3 arch.spec invariant held across all 12 phases — no `src/core/*` import of `sharp`, `node:fs`, or DOM. Made every math change unit-testable headless. |
| No PNG decoding during the math phase (stub `TextureLoader`) | ✓ Good | Sampler hot loop is pure CPU + spine-core. Held through Phase 9 worker offload. |
| 120 Hz default sampling rate (configurable) | ✓ Good | Above 60 Hz catches sub-frame easing peaks. Phase 9 made it configurable per-project via `samplingHz` slot. |
| Phase 0 derisks core math before any UI | ✓ Good | Saved 2-3 days of rework — UI phases shipped on a stable contract. |
| Override semantics: 100% = source dimensions, never surpassed (D-91) | ✓ Good | Supersedes original D-78/D-79 percent-of-peak semantics. Caught in Phase 4 human-verify; clearer mental model for animators. |
| Phase 6 export sizing: uniform-only on both axes | ✓ Good | Anisotropic export breaks Spine UV sampling. Locked in memory. |
| F7.2 reinterpreted: dims + page count + per-page efficiency, no bytes (D-127) | ✓ Good | File-size delta would require encoding every region — contradicts the Lanczos quality preservation contract. |
| `.stmproj` v1 forward-compat: reserved `documentation: object` slot (D-148) | — Pending | Untested until v2 ladder lands. |
| `worker_threads` Worker with path-based protocol + terminate-cancel (D-190/D-193/D-194) | ✓ Good | Greenfield in Phase 9. 606 ms wall-time on complex rig. |
| Discriminated-union typed-error envelope (D-158/D-171) | ✓ Good | 8 kinds including 7-field `SkeletonNotFoundOnLoadError` recovery payload. Caught misuse at compile time during Phase 8.1. |
| Atomic Pattern-B write (`.tmp` + `fs.rename`) | ✓ Good | Reused across Phase 6 (sharp export) and Phase 8 (.stmproj save) — load-bearing across two subsystems. |
| Hand-rolled ARIA modals (no library) | ✓ Good | OverrideDialog scaffold cloned by OptimizeDialog → AtlasPreviewModal → SaveQuitDialog → SettingsDialog → HelpDialog. Five dialogs, one pattern. |

## Constraints (still valid)

- Spine 4.2 only (4.3+ deferred to next milestone via versioned adapters).
- JSON skeletons only (`.skel` binary deferred to next milestone).
- Per-individual-skin sampling (combined-skin compositing out of scope).
- `core/` cannot import DOM, Electron, or `sharp` (Layer 3 invariant — locked by `tests/arch.spec.ts`).
- CLI byte-for-byte unchanged across phases (D-102; CLAUDE.md fact #3 / #5).

## Project root

`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/`

## Key references

- Approved plan: `~/.claude/plans/i-need-to-create-zesty-eich.md`
- Simple test rig: `fixtures/SIMPLE_PROJECT/` (CIRCLE, SQUARE, TRIANGLE + CHAIN_2..8 + TransformConstraint)
- Complex test rig: `fixtures/Girl/` (used for Phase 9 N2.2 wall-time gate)
- Spine 4.2 API: <http://esotericsoftware.com/spine-api-reference>
- Spine JSON format spec: <https://en.esotericsoftware.com/spine-json-format>
- Sharp resize API: <https://sharp.pixelplumbing.com/api-resize/>

---

*Last updated: 2026-04-27 — v1.1 Distribution milestone started*
