# Spine Texture Manager

## What This Is

A desktop app (Electron + React + TypeScript) that reads Spine 4.2+ skeleton JSON and computes the **peak world-space render scale for every individual attachment** across every animation and skin. The animator exports a per-attachment-optimized `images/` folder via sharp Lanczos3. v1.2 adds atlas-less mode (json + images folder, no .atlas), dims-badge round-trip safety (cap export at actual source PNG dims), per-skeleton Documentation Builder with HTML export, a full UI redesign, and two macOS UX regressions closed.

## Core Value

Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

## Current State (post v1.2)

**Shipped:** v1.2.0 Expansion — 2026-05-03 (8 phases executed, 40 plans, ~20,174 LOC TS/TSX in `src/`). Tag: `v1.2.0`. Full record in `.planning/MILESTONES.md`. Prior: v1.1.3 hotfix (2026-04-29), v1.1.1 (2026-04-29), v1.1.0 (2026-04-28), v1.0 (2026-04-26).

**Working:** Drop Spine `.json` + `.atlas` (or `.json` + images folder, no atlas — v1.2 atlas-less mode) or `.stmproj` → Global + Animation Breakdown panels populate → dims-badge surfaces when actual source PNG dims drift from canonical → set per-attachment overrides → preview the resulting atlas pack → export an optimized `images/` folder (cap prevents upscaling beyond actual source dims). Documentation Builder accessible from sticky header. `worker_threads` sampler offload + TanStack Virtual at N≥100 keep complex rigs interactive — `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` samples in 606 ms (~17× under N2.2 contract). macOS Cmd+Q + AppleScript quit work correctly (v1.2 fix). Update dialog routes macOS to manual-download (GitHub Releases page).

**Tech stack (locked, validated through v1.2):**
- Electron 41 + electron-vite 5 + electron-builder 26
- TypeScript (strict) + React 19 + Tailwind v4 (`@theme inline`)
- `@esotericsoftware/spine-core` 4.2.111 — skeleton/animation/constraint/physics math
- `sharp` 0.34.5 — image resize (libvips Lanczos3)
- `maxrects-packer` — atlas pack projection
- `@tanstack/react-virtual` — Phase 9 row virtualization
- `vitest` 4 — testing

**Known deferred (carried into v1.3):**
- Phase 13.1: Linux AppImage + macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle observation (host-blocked)
- Apple Developer ID code-signing + notarization ($99/yr; declined for v1.2)
- Crash + error reporting (Sentry / equivalent; declined for v1.2)
- F1.5 Spine 4.3+ versioned loader adapters; `.skel` binary loader
- Phase-0 scale-overshoot debug session (`investigating`; long-lived tech debt)

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
| `.stmproj` v1 forward-compat: reserved `documentation: object` slot (D-148) | ✓ Good | Documentation Builder (Phase 20) filled this slot without a schema-version bump — D-148 forward-compat design proved out. |
| macOS auto-update → manual-download UX (Phase 16) | ✓ Good | Squirrel.Mac code-sig strict-validation on ad-hoc builds made in-process swap impossible without Apple Developer ID. Manual-download is simpler, honest, and avoids $99/yr enrollment. |
| Atlas-less mode via synthetic atlas (Phase 21) | ✓ Good | IHDR byte-parsing (no decode) + synthetic TextureAtlas keeps Layer 3 invariant intact. AtlasNotFoundError preserved verbatim for malformed-project path. |
| Override-aware passthrough partition evaluated POST-override (Phase 22.1) | ✓ Good | Evaluating passthrough BEFORE override silently dropped animator overrides on capped rows (G-07 BLOCKER). POST-override re-partition was the only correct fix. |
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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

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

*Last updated: 2026-05-03 after v1.2 milestone. v1.2.0 shipped — 8 phases executed (16, 18, 19, 20, 21, 22, 22.1; 17 skipped; 13.1 deferred host-blocked). 23/26 v1.2 REQs closed. SEED-001 (atlas-less) + SEED-002 (dims-badge) both shipped. D-148 documentation slot filled. macOS quit + update UX regressions closed. ~20K LOC TS/TSX.*
