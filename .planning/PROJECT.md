# Spine Texture Manager

## What This Is

A desktop app (Electron + React + TypeScript) that reads Spine 4.2+ skeleton JSON and computes the **peak world-space render scale for every individual attachment** across every animation and skin. When no timeline touches an attachment, the setup pose is used as the reference. The animator then exports a per-attachment-optimized `images/` folder via sharp Lanczos3, preserving image quality.

v1.0 ships seven coordinated surfaces: a headless math core, two analysis panels (Global Max Render Source + Animation Breakdown), per-attachment scale overrides (% of source dims), unused-attachment detection, sharp Lanczos3 image export, an atlas-preview modal with maxrects-packer projection, and crash-safe `.stmproj` save/load.

## Core Value

Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

## Current State (post v1.0)

**Shipped:** v1.0 MVP — 2026-04-26 (12 phases, 62 plans, ~13.3K LOC TS/TSX in `src/`, ~8.4K in `tests/`, 331 vitest passing). Tag: `v1.0`. See `.planning/MILESTONES.md` for full v1.0 record.

**Working:** Drop a Spine `.json` or `.stmproj` → Global + Animation Breakdown panels populate → set per-attachment overrides via dialog (% of source dims, capped at 100%) → preview the resulting atlas pack → export an optimized `images/` folder. `worker_threads` sampler offload + TanStack Virtual at N≥100 keep complex rigs (~80 attachments / 16 animations) interactive — `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` samples in 606 ms (~17× under the N2.2 contract).

**v1.1 progress:** Phase 10 + Phase 11 + Phase 12 complete (2026-04-27). Phase 10 landed the installer build pipeline (`npm run build:mac/win/linux` produces per-platform installers via electron-builder; macOS `.dmg` ad-hoc-signed, version `1.1.0-rc1` embedded throughout, `sharp` + libvips bundled in `app.asar.unpacked` — live-verified against SIMPLE_TEST + Girl fixtures). Phase 11 landed the CI release pipeline (`.github/workflows/release.yml` — tag-triggered, 5 jobs (test → 3 parallel builds → atomic publish), 5 SHA-pinned actions, atomicity-by-construction proven empirically across 4 GHA runs). Phase 12 landed the auto-update + tester install docs surface: `electron-updater@^6.8.3` orchestrator behind a single `src/main/auto-update.ts` module (UPD-01..06, ARIA UpdateDialog with Windows-fallback variant under one cohesive code surface per CONTEXT D-04, atomic JSON persistence for "Later" dismissals, 10s startup-check timeout, silent-swallow on offline); `electron-builder.yml` flipped to `publish: github` so `app-update.yml` bakes into resources at build time; CI test matrix expanded to 3 OSes (`ubuntu-latest` + `windows-2022` + `macos-14`) and feed files (`latest*.yml`) now upload alongside installers; three Phase 11 spillover Windows runtime bugs fixed at single audit sites (F1 atlas-image URL via `pathToFileURL` IPC bridge, F2 file-picker `defaultPath` suffix removal, F3 Spine < 4.2 hard-reject via `SpineVersionUnsupportedError`); INSTALL.md cookbook + 4 linking surfaces (release-template prune, README, Help menu, HelpDialog). Two items intentionally deferred to phase 12.1: the live Windows-unsigned auto-update spike (UPD-06 strict-bar three-step verification — manual-fallback ships LIVE on Windows by default; runbook attempted via 3 CI runs but blocked by electron-builder 26.x publish race) and INSTALL.md screenshots (1×1 placeholder PNGs ship today; binary-only swap when first real tester install on rc2 captures the bypass dialogs). 433/433 vitest passing.

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

## Previous Milestone: v1.1.2 Auto-update fixes — SHIPPED 2026-04-29

Hotfix milestone closing four auto-update defects observed live on v1.1.1. Phases 14 + 15 closed (5/5 + 6/6 plans); UPDFIX-01..04 validated. v1.1.2 published, then v1.1.3 same-day hotfix closed D-15-LIVE-1 (macOS feed-URL space-vs-dot mismatch) empirically via Test 7-Retry PARTIAL-PASS. 520 vitest passing. Three downstream defects discovered during live UAT (D-15-LIVE-2 ad-hoc code-sig swap; D-15-LIVE-3 menu gating; 999.1 macOS quit) routed to backlog and now promoted to v1.2 phases 16/17/18.

## Current Milestone: v1.2 expansion

**Goal:** Close out three macOS regressions + one host-blocked carry-forward from v1.1.x; refine the UI based on tester feedback; add the Documentation Builder feature (the `.stmproj` v1 reserved `documentation: object` slot from D-148); land the two long-dormant SEEDs (atlas-less mode + dims-badge override-cap).

**Target features (8 phases):**

- **Phase 13.1 — Live UAT carry-forwards** *(host-blocked from v1.1.1)* — Linux AppImage UAT runbook + libfuse2 PNG capture for INSTALL.md; macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation.
- **Phase 16 — macOS auto-update → manual-download UX** *(closes D-15-LIVE-2 / former 999.2)* — Flip the `SPIKE_PASSED = process.platform !== 'win32'` gate so macOS routes through the existing `windows-fallback` UpdateDialog variant (open GitHub Releases page in browser instead of Squirrel.Mac code-sig swap that fails on ad-hoc-signed builds). Likely renames `windows-fallback` → neutral `manual-download`. Plus dialog/INSTALL.md/Help copy + tests.
- **Phase 17 — Help → Check for Updates not gated on project** *(closes D-15-LIVE-3 / former 999.3)* — Remove project-loaded guard on the menu handler so `update:check` IPC fires regardless of AppState branch. Likely a 1-line fix in `src/main/menu.ts`.
- **Phase 18 — Cmd+Q + AppleScript quit broken on macOS** *(former 999.1)* — Wire missing `role: 'quit'` on the menu item, or fix `before-quit` handler swallowing the event. Observed in v1.1.1 packaged macOS build during Phase 15 UAT.
- **Phase 19 — UI improvements (UI-01..05)** *(new for v1.2; sourced from tester feedback + visual diff against an older non-related Spine 3.8 reference app)* — Persistent sticky header bar (drop-zone state + primary action buttons + search box never scroll offscreen); card-based section layout with color-coded category icons + semantic state colors (green = under 1.0× scale, yellow = over, red = unused/danger); modal redesign with summary tiles + secondary cross-nav in footer; quantified unused-assets callout (`X.XX MB potential savings`); inline search + clear primary/secondary action-button hierarchy.
- **Phase 20 — Documentation Builder feature** *(new for v1.2)* — Fills the `.stmproj` v1 reserved `documentation: object` slot (D-148). Per-skeleton documentation surface: animation tracks with mix times + loop flags + notes, control-bone descriptions, skin descriptions, general notes, optimization config snapshot, export-to-HTML.
- **Phase 21 — SEED-001 atlas-less mode** *(seed dormant since v1.0 Phase 6 close-out)* — Support `json + images folder, no .atlas` projects. New `src/core/png-header.ts` (IHDR-only byte parsing, no PNG decode — preserves CLAUDE.md fact #4) + `src/core/synthetic-atlas.ts` builds an in-memory `TextureAtlas` from per-region PNG headers when no `.atlas` file is present. Loader routes through synthesized atlas instead of failing with `AtlasNotFoundError`.
- **Phase 22 — SEED-002 dims-badge + override-cap** *(seed; depends on Phase 21)* — Round-trip safety after Optimize. Extend `DisplayRow` with `actualSourceW/H` + `dimsMismatch` flag; surface badge in Global + Animation Breakdown panels when actual source PNG dims differ from canonical region dims; cap export effective scale at `min(peakScale, sourceW/canonicalW, sourceH/canonicalH)` so re-running Optimize on already-optimized images produces zero exports.

**Out of scope (declined or deferred):**

- Apple Developer ID code-signing + notarization ($99/yr; declined 2026-04-29 — Phase 16's manual-download UX is the v1.2 answer instead). Revisit at v1.3+.
- Crash + error reporting (Sentry / equivalent) — descoped at v1.1; revisit at v1.3 once tester base + crash-trace volume justifies the SaaS dependency + consent UX overhead.
- Spine 4.3+ versioned loader adapters; `.skel` binary loader. Carried unchanged from v1.0.

**Key context / constraints:**

- Phase numbering continues from v1.1.2 (no `--reset-phase-numbers`); Phase 13.1 keeps its decimal name to preserve the "split off from Phase 13 so v1.1.1 could ship without being host-blocked" breadcrumb.
- Phase 22 depends on Phase 21 (shared PNG header reader infrastructure — sequenced 21 → 22 per SEED-001 / SEED-002 author's intent).
- Phase 16 supersedes the original "Apple Developer Program enrollment" path — manual-download UX is the locked answer; signing posture stays a v1.3 question.
- UI improvements (Phase 19) work against the *current* PNG-screenshot UI; visual reference from an older 3.8 app exists for inspiration but its codebase is out-of-scope.
- Existing v1.0 + v1.1 contracts (Layer 3 invariant, sampler lifecycle, override semantics, export uniform-only, `.stmproj` schema, sharp Lanczos3, atomic Pattern-B writes, ARIA modal pattern, distribution + CI surface) are locked; do not regress.

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

*Last updated: 2026-04-30 — Milestone v1.2 (expansion) started. 8 phases scoped: 13.1 (live UAT carry-forwards), 16 / 17 / 18 (macOS manual-download UX + menu gating + Cmd+Q quit fix; promoted from backlog 999.1/2/3 via /gsd-review-backlog 2026-04-29), 19 (UI improvements UI-01..05 from tester feedback), 20 (Documentation Builder filling D-148 .stmproj slot), 21 (SEED-001 atlas-less mode), 22 (SEED-002 dims-badge override-cap; depends on 21). Apple Developer ID signing + Sentry crash reporting declined for v1.2; revisit at v1.3.*
