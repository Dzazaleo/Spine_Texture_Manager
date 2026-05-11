# Spine Texture Manager

## What This Is

A desktop app (Electron + React + TypeScript) that reads Spine 4.2+ skeleton JSON and computes the **peak world-space render scale for every individual attachment** across every animation and skin. The animator exports a per-attachment-optimized `images/` folder via sharp Lanczos3. v1.2 added atlas-less mode (json + images folder, no .atlas), dims-badge round-trip safety (cap export at actual source PNG dims), per-skeleton Documentation Builder with HTML export, a full UI redesign, and two macOS UX regressions closed. v1.3 closed correctness/semantic gaps, refined the Optimize workflow UX, polished the UI, and added optional output sharpening on downscale. v1.3.1 closes the per-region dedup correctness gap surfaced post-v1.3 ship, adds a user-configurable safety-buffer % in Optimize, and refines small UX surfaces (source-toggle disabling, Animation Breakdown collapse defaults, Windows admin DnD fallback).

## Core Value

Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

## Current State (post v1.3.1)

**Shipped:** v1.3.1 Correctness & Refinements — 2026-05-09 (3 phases, 16 plans, 20 REQs). Tag: `v1.3.1`. Full record in `.planning/MILESTONES.md`. Prior: v1.3.0 (2026-05-07), v1.2.0 (2026-05-03), v1.1.3 hotfix (2026-04-29), v1.1.1 (2026-04-29), v1.1.0 (2026-04-28), v1.0 (2026-04-26).

**v1.3.1 highlights:** Per-region dedup + override-region semantics (Phase 29 — analyzer.ts attachmentName→regionName key flip + new RegionRow IPC type + AtlasPreview re-key onto regionName + attachmentNames[]; Chicken path-indirection 13-vs-14 page-count drift fixed) + safety-buffer % in Optimize dialog (Phase 30 — multiplicative on effective scale + overrides; NARROW bufferCapped predicate per CONTEXT D-06; persisted as additive optional field in `.stmproj` v1 mirroring `sharpenOnExport` precedent — no schema-version bump) + small-fixes batch (Phase 31 — source-toggle disabling on missing artifacts; Animation Breakdown collapse defaults + bulk Expand/Collapse all; Windows admin DnD fallback advisory; ExtrapolationIcon tooltip primitive). Late tester-regression fixes pre-tag: 1b5414c Strip-Whitespace export pipeline + 834c975 auto-expand failed Optimize rows + d86e7b3 per-frame canonical dims for sequence attachments.

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
- SEED-004: Rotated atlas regions (planted 2026-05-08; A=error UX or B=full support)
- SEED-005: RGBA2 + InheritTimeline coverage gap (planted 2026-05-08; audit-only or full feature surface)
- `.skel` binary loader (still deferred)
- Phase-0 scale-overshoot debug session (`investigating`; long-lived tech debt)
- Path-indirected duplicate rows (`pending_phase_plan`; root cause closed by Phase 29 region-keyed dedup, doc retained as v1.4 reference for related Atlas Preview optimized-mode tile expansion surfaces)
- post-v1-3 tester regressions (`diagnosed` analyzer.ts atlas-region-name vs entry-name key bug; root-fixed by Phase 29; doc retained for v1.4 follow-up surface audits)
- v1.3.1 release-time UAT (Phase 30 visual UAT + Phase 31 Windows admin DnD live observation; recipe in `.planning/todos/pending/2026-05-08-phase-31-windows-admin-dnd-release-uat.md`)
- Audit-acknowledged carry-forwards from v1.0–v1.3 — see STATE.md → Deferred Items for the full table

## Current Milestone: v1.4 Spine 4.3 Forward-Compat + Rotated Atlases

**Goal:** Honor Esoteric's "upgrade to 4.3" recommendation pragmatically — make 4.2-only support honest and visible in the UI, replace today's cryptic 4.3-beta load failures with an actionable re-export message, AND remove the rotated-atlas hard-throw with full rotation support. Defers the full 4.3 runtime port until npm publishes 4.3.0 stable.

**Target features:**
- **Drop-zone Spine version disclosure** — restyle the initial advisory at `src/renderer/src/App.tsx:622` so the supported version is called out before users drop a file. Rendered as bold `text-danger` to match the project's existing problem-zone styling tokens.
- **4.3-beta detection + actionable error** — sniff `root.constraints` (or `skeleton.spine >= 4.3`) at parse time in `src/core/loader.ts`; throw `SpineVersionUnsupportedError` with a "this app currently supports Spine v4.2 — re-export from your 4.3 editor as Version 4.2 (supported downgrade)" message. Replaces today's misleading `IK Constraint not found: <name>` error from spine-core 4.2's reader. Pairs with the drop-zone copy.
- **Rotated atlas region support** — remove the hard-throw at `src/core/errors.ts:154`; AABB W↔H swap in `src/core/bounds.ts` when `region.rotate === true`; ExportPlan output dim swap; regression fixture coverage. Atlas-less mode unaffected (synthetic atlas never packs with rotation).
- **Plant SEED-006 (Full Spine 4.3 runtime port)** — queue the costed inventory (5 sampler renames + 2 bounds signature changes + slot.pose access + slider validate + vendoring strategy) for the next milestone window after 4.3.0 stable hits npm.

**Why this scope, why now:**
- npm `@esotericsoftware/spine-core@latest` = `4.2.114` (2026-04-30) — no 4.3 publish; latest 4.3 is `4.3.91-beta` "Unreleased" as of today.
- 4.3 schema is **not frozen** — the `uniform: bool` → `scaleY: number` rename at `4.3.73-beta` is precedent that mid-beta breaking changes still happen. Porting against a moving target wastes work.
- User's team already has 4.3-beta exports failing today (`fixtures/test_4.3/jokerman`, `fixtures/test_4.3/girl` — gitignored, see SEED-003). The detect-and-warn path unblocks them via the supported re-export-as-4.2 workflow.
- SEED-004 surfaced two similar Esoteric-side decisions (rotated regions) in close succession — bundling both keeps the "support what we can today, signal what we can't" theme coherent.

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

- Spine 4.2 only (4.3-beta detected and rejected with re-export advisory in v1.4; full 4.3 port deferred until 4.3.0 stable hits npm — see SEED-006).
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

*Last updated: 2026-05-11 — milestone v1.4 in progress (Spine 4.3 Forward-Compat + Rotated Atlases + File→Open .json acceptance). **Phase 34 complete** (File→Open menu accepts Spine skeleton .json files — Wave 1 picker-only `handleOpenDialog` with three-arm discriminated `OpenDialogResponse` envelope + new `'project:open-dialog'` IPC channel + `openProjectPicker`/`loadSkeletonFromPath` preload bridges + old `window.api.openProject`/`'project:open'` channel/`handleProjectOpen` physically deleted; Wave 2 renderer rewire of `App.tsx onMenuOpen` to two-IPC-step flow with D-05 dirty-guard-after-picker + D-06 dispatch-by-kind; Wave 3 vitest coverage for OPEN-01..05 + renderer mock-surface migration + orphan 8.1-VR-02 skip block deleted; Wave 4 REQUIREMENTS.md OPEN-0x namespace + v1.4 coverage 6→11 + ROADMAP Phase 34 Requirements field locked. 16/16 must-haves verified programmatically; 6 HUMAN-UAT items persisted (macOS/Windows picker rendering + atlas-source/atlas-less fixture parity + Cmd+O/Ctrl+O accelerator + CR-01 uppercase-suffix triage). 1049 tests pass (no regressions). Code review surfaced CR-01 (load validators case-sensitive while picker is case-insensitive — uppercase `RIG.STMPROJ`/`SKEL.JSON` route then reject; reachable on macOS APFS) + 4 warnings — not OPEN-0x blockers; deferred for triage. Previous: **Phase 33 complete** (Rotated atlas region support — loader D-01 attachment-walk for canonical-corner offset override + atomic lockstep removal of `RotatedRegionUnsupportedError` + `sharp.rotate(+90)` in image-worker + real-Spine-packer fixture at `fixtures/spine_rotated/EXPORT/`; ATLAS-01..04 met; HUMAN-UAT signed off 2026-05-11; code-review BLOCKERs CR-01/CR-02 + WR-03 fixed in-phase). UAT surfaced the libgdx atlas convention nuance: `bounds:x,y,W,H` stores W/H in canonical (pre-rotation) orientation; page-pixel rect for rotated regions is `(H × W)` per spine-core TextureAtlas.js:164-167 — loader.ts now sets `packW/packH = page-pixel` and `w/h = canonical`. Previous: **Phase 32 complete** (Spine 4.3-beta detect-and-warn + drop-zone v4.2 disclosure + SEED-006 plant) — `checkSpine43Schema` predicate landed in `src/core/loader.ts` BEFORE atlas resolution; `SpineVersionUnsupportedError` constructor branched with COMPAT-01 wording for the 4.3-detected path; idle drop-zone copy at `App.tsx:622` surfaces `v4.2` in `font-bold text-danger`; SEED-006 (full 4.3 runtime port) planted under `.planning/seeds/`. Pre-4.2 contract from Phase 12 F3 byte-stable. Verifier: 16/16 must-haves passed. Next up: Phase 33 (rotated-atlas-region support — loader + bounds + export + fixture). Phase numbering continues from v1.3.1's last phase (31). Investigation pre-locked: npm `@esotericsoftware/spine-core@latest`=4.2.114 (2026-04-30); latest 4.3 is `4.3.91-beta` "Unreleased"; mid-beta breaking changes precedent (`uniform`→`scaleY` at 4.3.73-beta) makes porting now premature. Prior milestone shipped: v1.3.1 (2026-05-09) — Phase 29/30/31 (per-region dedup + safety buffer + loader & UX small-fixes batch).*
