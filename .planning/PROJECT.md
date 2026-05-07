# Spine Texture Manager

## What This Is

A desktop app (Electron + React + TypeScript) that reads Spine 4.2+ skeleton JSON and computes the **peak world-space render scale for every individual attachment** across every animation and skin. The animator exports a per-attachment-optimized `images/` folder via sharp Lanczos3. v1.2 added atlas-less mode (json + images folder, no .atlas), dims-badge round-trip safety (cap export at actual source PNG dims), per-skeleton Documentation Builder with HTML export, a full UI redesign, and two macOS UX regressions closed. v1.3 closes correctness/semantic gaps, refines the Optimize workflow UX, polishes the UI, and adds optional output sharpening on downscale.

## Core Value

Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

## Current State (post v1.3)

**Shipped:** v1.3.0 Polish & UX — 2026-05-07 (7 phases, ~22 plans, ~21,000+ LOC TS/TSX in `src/`). Tag: `v1.3.0`. Full record in `.planning/MILESTONES.md`. Prior: v1.2.0 (2026-05-03), v1.1.3 hotfix (2026-04-29), v1.1.1 (2026-04-29), v1.1.0 (2026-04-28), v1.0 (2026-04-26).

**v1.3 highlights:** Optimize workflow UX (defer folder picker; OptimizeDialog opens immediately) + Unused Assets semantics fixed (images-folder-vs-JSON orphaned PNGs; collapsible sibling panel) + missing-attachment in-context display (red left-border + danger triangle in Global + Animation Breakdown) + UI polish pass (`#232732` surface tokens, full-width panels, zebra rows, unified `h-8` toolbar buttons, danger-themed problem-zone headers, `WarningTriangleIcon` SVG component, 2-tab strip in dedicated sub-toolbar) + Phase 4 code-quality carry-forwards closed (functional `setSelected`, OverrideDialog input guard, dead prop removed) + optional output sharpening on downscale (`sharpen({ sigma: 0.5 })`, persisted in `.stmproj`). Linux AppImage build dropped from CI (untested target; re-enable when UAT lands).

**Working:** Drop Spine `.json` + `.atlas` (or `.json` + images folder, no atlas — atlas-less mode) or `.stmproj` → Global + Animation Breakdown panels populate (rows with missing source PNGs stay visible with red accent + danger triangle) → dims-badge surfaces when actual source PNG dims drift from canonical → set per-attachment overrides → preview the resulting atlas pack → click Optimize → OptimizeDialog opens immediately, folder picker fires on Start → export an optimized `images/` folder (cap prevents upscaling beyond actual source dims; optional sharpen-on-downscale; passthrough byte-copies for already-optimized rows). Documentation Builder accessible from sticky header. Atlas-savings metric replaces the older MB unused-attachment callout. `worker_threads` sampler offload + TanStack Virtual at N≥100 keep complex rigs interactive — `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` samples in 606 ms (~17× under N2.2 contract). macOS Cmd+Q + AppleScript quit work correctly. Update dialog routes macOS to manual-download (GitHub Releases page).

**Tech stack (locked, validated through v1.2):**
- Electron 41 + electron-vite 5 + electron-builder 26
- TypeScript (strict) + React 19 + Tailwind v4 (`@theme inline`)
- `@esotericsoftware/spine-core` 4.2.111 — skeleton/animation/constraint/physics math
- `sharp` 0.34.5 — image resize (libvips Lanczos3)
- `maxrects-packer` — atlas pack projection
- `@tanstack/react-virtual` — Phase 9 row virtualization
- `vitest` 4 — testing

**Known deferred (carried into v1.4):**
- Phase 13.1: Linux AppImage + macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle observation (host-blocked; Linux now out of release scope per v1.3 ship decision)
- Apple Developer ID code-signing + notarization ($99/yr; revisit at v1.4)
- Crash + error reporting (Sentry / equivalent; revisit at v1.4)
- SEED-003: Spine 4.3+ versioned loader adapters (planted 2026-05-07; primary v1.4 candidate)
- `.skel` binary loader (still deferred)
- Phase-0 scale-overshoot debug session (`investigating`; long-lived tech debt)
- 21 audit-acknowledged carry-forwards from v1.0–v1.3 (see STATE.md → Deferred Items)

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
| Optimize folder picker deferred to Start/Export click (Phase 23) | ✓ Good | Dialog opens immediately on toolbar click — user sees the export plan before the native folder picker stalls. Eliminates up-front modal-on-modal sequencing. |
| Missing-attachment rows synthesized post-sampler in `buildSummary` (Phase 25) | ✓ Good | Synthetic-atlas excludes stub regions from sampler output; `.map()+mark` had nothing to mark. Synthesizing stub `DisplayRow` entries from `skippedAttachments` is the only way to keep missing rows visible in panels. |
| `WarningTriangleIcon` shared component (Phase 26.2 D-06) | ✓ Good | Single source of truth for the 4 fill→stroke conversions. Replaces ad-hoc Unicode ⚠ glyphs that couldn't size precisely. |
| Tab strip in dedicated sub-toolbar row (Phase 26.2 sketch-001 variant A) | ✓ Good | Two prior reverts surfaced AP-01: tabs-in-main-toolbar caused vertical-space contention. Lifting to a separate row resolved AP-01 cleanly. The 3-tab restructure was DROPPED same milestone in favor of alert-bar layout. |
| Functional `setSelected((prev) => ...)` updater (Phase 27) | ✓ Good | Closes a latent stale-closure race in `handleToggleRow` + `handleRangeToggle`. Durable regression spec compares closure-form vs functional-form side-by-side. |
| Optional output sharpening on downscale, default OFF (Phase 28) | ✓ Good | `sharpen({ sigma: 0.5 })` mirrors Photoshop's "Bicubic Sharper (reduction)" preset. Downscale-only gate (`effectiveScale < 1.0`); passthrough rows + 1.0× rows unaffected. Persists per-project in `.stmproj` (additive optional `sharpenOnExport: boolean`). |
| PMA preservation falsified — sharp 0.34 + libvips 8.17 auto-handle PMA (Phase 28 pivot) | ✓ Good | Backlog 999.9 ("PMA preservation in Optimize Assets export") closed `falsified` 2026-05-06. `scripts/pma-probe.mjs` retained as regression sentinel. Phase 28 pivoted same day to optional sharpening — the actual user-visible quality lever. |
| Linux AppImage dropped from v1.3 release CI (untested target) | ✓ Good | Linux build path never verified live against a real Linux host. `electron-builder.yml linux:` block retained as no-op for re-enable after Linux UAT lands. |

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

*Last updated: 2026-05-07 after v1.3 milestone complete. v1.3.0 shipped — 7 phases (23, 24, 25, 26.1, 26.2, 27, 28) closed v1.2 correctness/semantic gaps + Optimize-flow UX + UI polish + optional output sharpening on downscale. Linux AppImage build dropped from CI as an untested target. SEED-003 (Spine 4.3 compatibility) planted for v1.4 pickup. Next: `/gsd-new-milestone` to start v1.4.*
