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

## Current Milestone: v1.1.2 Auto-update fixes

**Goal:** Fix four auto-update defects observed live on shipped v1.1.1 so testers receive future updates end-to-end on **both** macOS and Windows, without manual reinstall. Hotfix milestone — no new feature surface.

**Progress (2026-04-29):** Phase 14 (renderer + state machine fixes) **CLOSED 5/5 plans**. UPDFIX-02 + UPDFIX-03 + UPDFIX-04 wired in code with +38 regression specs (493/493 test suite). Phase 14.1 (gap closure for WR-01 sticky-slot cleanup) and Phase 15 (build/feed-shape fix + v1.1.2 release for UPDFIX-01) remaining.

**Target features (each = one observed defect):**

- ✅ **Windows update notification reliably surfaces a Download button** *(Phase 14, code complete; live OS UAT carries to Phase 15)* — D-04 variant selection deterministic via `SPIKE_PASSED` policy; D-05 asymmetric dismissal rule lets manual `Help → Check for Updates` re-present after a "Later" dismissal while preserving Phase 12 D-08 startup-suppression contract. UPDFIX-02.
- ✅ **Auto-check on startup actually fires on every cold start** *(Phase 14, code complete; live OS UAT carries to Phase 15)* — Renderer subscriptions lifted from `AppShell.tsx` (mounted only on `loaded`/`projectLoaded`) up to `App.tsx` (mounts unconditionally) so the startup `setTimeout(checkUpdate, 3500ms)` event has a subscriber on every cold start. UPDFIX-03.
- ✅ **Manual "Check for Updates" gives feedback before any project is loaded** *(Phase 14, code complete; live OS UAT carries to Phase 15)* — Same renderer-lift fix as UPDFIX-03 closes the manual-check pre-project-load silence root cause. Late-mount race recovery via `window.api.requestPendingUpdate()` one-shot call against the new D-03 sticky `pendingUpdateInfo` slot. UPDFIX-04.
- ⏳ **Cross-platform download → install succeeds** *(Phase 15)* — Reconcile electron-updater 6.8.3 platform requirements with electron-builder output + `scripts/emit-latest-yml.mjs` (12.1-D-10 synthesizer): mac requires `.dmg` + `.zip` + `latest-mac.yml`, win NSIS `.exe` + `.blockmap` + `latest.yml`, linux `.AppImage` + `latest-linux.yml`. Bump 1.1.1 → 1.1.2, tag, CI, publish. UPDFIX-01.

**Key context / constraints:**

- All four defects hit users in the wild on v1.1.1 — this is a hotfix release, not a new-feature milestone.
- Phase 14's renderer-mount lift fix supersedes the original "(3) and (4) may share root cause" hypothesis — both UPDFIX-03 and UPDFIX-04 had the same root cause (renderer not subscribed when events fire) and both close together via the App.tsx lift.
- Phase 15 still owns UPDFIX-01 (download→install cross-platform) — feed-shape research-first to avoid double-fixing the mac `.zip` artifact gap.
- v1.1.1 final → final auto-update via electron-updater 6.x's `currentChannel === null` code branch — no rc-channel mismatch involved.
- Existing v1.1 distribution surface (installer build, CI pipeline, INSTALL.md) is locked; do not regress.
- Phase 13.1 (live UAT carry-forwards from v1.1.1: Linux runbook, v1.1.0 → v1.1.1 lifecycle observation) is **separate** from v1.1.2 — those tasks pre-date this milestone and remain pending host availability. v1.1.2 fixes the broken update flow itself.

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

*Last updated: 2026-04-29 — Milestone v1.1.2 (Auto-update fixes) started. v1.1.0 + v1.1.1 shipped under v1.1 Distribution; four post-release auto-update defects (mac ZIP, win Download button + dismissal, startup check, manual-check pre-load silence) drive this hotfix milestone.*
