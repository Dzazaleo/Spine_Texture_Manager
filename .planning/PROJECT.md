# Spine Texture Manager

## What This Is

A desktop app (Electron + React + TypeScript) that reads Spine 4.2+ skeleton JSON and computes the **peak world-space render scale for every individual attachment** across every animation and skin. The animator exports a per-attachment-optimized `images/` folder via sharp Lanczos3 — and, as of v1.5, can additionally repack the optimized regions into a libgdx-format `.atlas` + composite page PNG(s), shipping packed atlases directly without round-tripping through the Spine editor. v1.2 added atlas-less mode (json + images folder, no .atlas), dims-badge round-trip safety, per-skeleton Documentation Builder with HTML export, a full UI redesign, and two macOS UX regressions closed. v1.3 closed correctness/semantic gaps, refined the Optimize workflow UX, polished the UI, and added optional output sharpening on downscale. v1.3.1 closed the per-region dedup correctness gap, added a user-configurable safety-buffer %, and refined small UX surfaces. v1.4 added Spine 4.3-beta detect-and-warn, rotated atlas region support, File→Open menu acceptance for `.json` skeletons, and a region-keyed export plan that fixes a multi-skin atlas-source undercount. v1.5 split overrides per loaderMode (atlas-source / atlas-less buckets), source-audited and fixture-locked the last two unverified Spine 4.2 timeline coverage gaps (RGBA2 + InheritTimeline), retired three long-lived tech-debt todos, and shipped the additive `loose | atlas | both` atlas-repack output mode.

## Core Value

Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

## Current State (post v1.5, v1.5.1 in progress)

**In progress:** v1.5.1 Spine Animation Viewer — Phase 41 complete (3 plans, all green; basic-render VIEWER-04 live-confirmed on SIMPLE_TEST + JOKERMAN_SPINE_ROT after 3 gap fixes landed during UAT: CSP `connect-src 'app-image:'`, CORS ACAO on protocol handler, straight-alpha SpinePlayer config). 5 HUMAN-UAT items remain pending (anim/skin switch + scrub synchrony, GL leak cycles, real-fs error UX, atlas-less parity, File menu suppression) and are tracked in `41-HUMAN-UAT.md`.

**Shipped:** v1.5 Override Routing + Coverage Hardening + Atlas Repack — 2026-05-15 (5 phases, 23 plans, 18 documented REQs + 10 REPACK REQs). Tag: `v1.5.0` (pending push). Full record in `.planning/MILESTONES.md`. Prior: v1.4 (2026-05-12), v1.3.1 (2026-05-09), v1.3.0 (2026-05-07), v1.2.0 (2026-05-03), v1.1.3 hotfix (2026-04-29), v1.1.1 (2026-04-29), v1.1.0 (2026-04-28), v1.0 (2026-04-26).

**v1.5 highlights:** Split overrides per loaderMode (Phase 36 — `overridesAtlasLess` field added additively to `ProjectFileV1` / `AppSessionState` / `MaterializedProject`; legacy v1.3.x/v1.4.x `.stmproj` routes by saved `loaderMode` at the Open seam per Decision 2-A, gated on on-disk key presence; per-bucket `migrateOverrides` at all 3 IPC seams with summed `migratedKeyCount` + unioned stale keys; AppShell `activeOverrides` memo flows to all 4 `buildExportPlan` sites, `OverrideDialog` writes target the active bucket only, `Save` serializes both buckets, dirty-detection covers both; one-shot mode-toggle toast with verbatim D-04 copy + localStorage suppression; CR-01 resample-handler routing bug + WR-01 drag-drop recovery field-loss bug fixed in code-review-fix cycle; SEED-007 closed) + Spine 4.2 timeline coverage hardened (Phase 37 — RGBA2Timeline + InheritTimeline source-audited with citations to `Animation.js:755` + `Bone.js:144`; `fixtures/INHERIT_TIMELINE/` JSON+atlas+PNG; TIMELINE-03 strict `peak(detached) > peak(baseline)` per TRIGGERED escalation clause — observed 2.5× ratio; TIMELINE-04 byte-equal RGBA2 invariance via synthetic injection; SEED-005 closed) + Phase 4 polish swept (Phase 38 — `38-POLISH-AUDIT.md` enumerates IN-01..IN-06 + WR-03 with verdicts: 1 applies (IN-02 drag-to-cancel `onMouseDown` + `e.target === e.currentTarget` guard in `OverrideDialog.tsx`), 5 no-op swept by intervening phases, 1 skip; v1.0-era todo retired) + Windows host-blocked UATs cleared (Phase 39 — `host_available: yes`; both Phase 20 DocBuilder DnD + Phase 31 admin DnD UATs executed live and flipped `passed`; both pending todos retired to `resolved/`) + Atlas Repack Output (Phase 40 — additive `loose | atlas | both` output mode in OptimizeDialog emits libgdx `.atlas` + composite page PNG(s) via `maxrects-packer` + `sharp` per-region trim/rotate/composition; `core/repack.ts` pure-TS pack planner; `main/atlas-writer.ts` libgdx text serializer; `main/repack-worker.ts` sharp orchestration with REPACK-10 atomic-or-fail rollback via shared writtenPaths Set; both atlas-source + atlas-less input loaderModes produce SHA256-identical output; 4 additive `.stmproj` fields with no schema bump; rotation default off (`sharp.rotate(-90)` for WRITE direction inverse of v1.4 +90 READ direction); 3 rounds of human UAT against `JOKERMAN_SPINE.json` caught + fixed 8 bugs; SEED-008 closed). Adjacent regression caught + fixed during Phase 36 UAT: window X-button / Cmd+W path skipped the dirty-save prompt (pre-existing since Phase 8/18) — fixed in `ef38cd3 fix(36-followup)` by mirroring the `before-quit` IPC dirty-check on `mainWindow.on('close')`.

**v1.4 highlights:** Spine 4.3-beta detect-and-warn (Phase 32 — `checkSpine43Schema` predicate sniffs `root.constraints` OR `skeleton.spine ≥ 4.3` before atlas resolution; structured `SpineVersionUnsupportedError` with "re-export as Version 4.2" wording replaces today's misleading `IK Constraint not found: <name>` symptom from spine-core 4.2; drop-zone copy at `App.tsx:622` surfaces `v4.2` in `font-bold text-danger`; SEED-006 planted for the full 4.3 runtime port queued for post-`spine-core@4.3-stable` npm publish) + rotated atlas region support (Phase 33 — `RotatedRegionUnsupportedError` removed atomically alongside loader D-01 attachment-walk for canonical-corner offset override + AABB W↔H swap in `bounds.ts` + `sharp.rotate(+90)` materialization in image-worker; libgdx atlas convention nuance documented: `bounds:x,y,W,H` is canonical, page-pixel rect is `(H × W)` for rotated regions) + File → Open accepts `.json` skeletons (Phase 34 — two-IPC-step `'project:open-dialog'` + `openProjectPicker`/`loadSkeletonFromPath` with three-arm discriminated `OpenDialogResponse` envelope; D-05 dirty-guard-after-picker amends Phase 08.2 D-183 for the menu path; old `'project:open'` channel physically deleted) + region-keyed export plan (Phase 35 — `buildExportPlan` migrated from `summary.peaks` to `summary.regions` in both `src/core/export.ts` and renderer parity `src/renderer/src/lib/export-view.ts`; closes the multi-skin atlas-source undercount where 160 atlas regions collapsed to 23 ExportRows on `fixtures/SKINS/JOKERMAN_SPINE.json`).

**v1.3.1 highlights:** Per-region dedup + override-region semantics (Phase 29 — analyzer.ts attachmentName→regionName key flip + new RegionRow IPC type + AtlasPreview re-key onto regionName + attachmentNames[]; Chicken path-indirection 13-vs-14 page-count drift fixed) + safety-buffer % in Optimize dialog (Phase 30 — multiplicative on effective scale + overrides; NARROW bufferCapped predicate per CONTEXT D-06; persisted as additive optional field in `.stmproj` v1 mirroring `sharpenOnExport` precedent — no schema-version bump) + small-fixes batch (Phase 31 — source-toggle disabling on missing artifacts; Animation Breakdown collapse defaults + bulk Expand/Collapse all; Windows admin DnD fallback advisory; ExtrapolationIcon tooltip primitive). Late tester-regression fixes pre-tag: 1b5414c Strip-Whitespace export pipeline + 834c975 auto-expand failed Optimize rows + d86e7b3 per-frame canonical dims for sequence attachments.

**v1.3 highlights:** Optimize workflow UX (defer folder picker; OptimizeDialog opens immediately) + Unused Assets semantics fixed (images-folder-vs-JSON orphaned PNGs; collapsible sibling panel) + missing-attachment in-context display (red left-border + danger triangle in Global + Animation Breakdown) + UI polish pass (`#232732` surface tokens, full-width panels, zebra rows, unified `h-8` toolbar buttons, danger-themed problem-zone headers, `WarningTriangleIcon` SVG component, 2-tab strip in dedicated sub-toolbar) + Phase 4 code-quality carry-forwards closed (functional `setSelected`, OverrideDialog input guard, dead prop removed) + optional output sharpening on downscale (`sharpen({ sigma: 0.5 })`, persisted in `.stmproj`). Linux AppImage build dropped from CI (untested target; re-enable when UAT lands).

**Working:** Drop Spine `.json` + `.atlas` (or `.json` + images folder, no atlas — atlas-less mode) or `.stmproj` → Global + Animation Breakdown panels populate (rows with missing source PNGs stay visible with red accent + danger triangle) → dims-badge surfaces when actual source PNG dims drift from canonical → set per-attachment overrides (now bucketed per loaderMode — atlas-source and atlas-less buckets are independent and round-trip losslessly) → preview the resulting atlas pack → click Optimize → OptimizeDialog opens immediately, folder picker fires on Start → choose output mode `loose | atlas | both` → export. Loose mode emits the optimized `images/` folder (cap prevents upscaling beyond actual source dims; optional sharpen-on-downscale; passthrough byte-copies for already-optimized rows). Atlas mode emits a libgdx `.atlas` + composite page PNG(s) packed via `maxrects-packer`; both mode runs both pipelines with a shared rollback set so a mid-write failure rolls back EVERY artifact. Documentation Builder accessible from sticky header. Atlas-savings metric replaces the older MB unused-attachment callout. `worker_threads` sampler offload + TanStack Virtual at N≥100 keep complex rigs interactive — `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` samples in 606 ms (~17× under N2.2 contract). macOS Cmd+Q + AppleScript quit + window X-button / Cmd+W all guard the dirty-save prompt correctly. Update dialog routes macOS to manual-download (GitHub Releases page).

**Tech stack (locked, validated through v1.5):**
- Electron 41 + electron-vite 5 + electron-builder 26
- TypeScript (strict) + React 19 + Tailwind v4 (`@theme inline`)
- `@esotericsoftware/spine-core` 4.2.111 — skeleton/animation/constraint/physics math
- `sharp` 0.34.5 — image resize (libvips Lanczos3) + atlas page composition (Phase 40)
- `maxrects-packer` 2.7.3 — atlas pack projection (preview) + atlas pack output (Phase 40)
- `@tanstack/react-virtual` — Phase 9 row virtualization
- `vitest` 4 — testing

**Known deferred (carried into v1.6+):**
- Phase 34 HUMAN-UAT 1 open scenario (host-blocked: macOS/Windows picker rendering parity verification)
- Phase 34 VERIFICATION human_needed (same root as the above)
- Phase 13.1: macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle observation (host-blocked)
- Apple Developer ID code-signing + notarization ($99/yr; revisit when business case lands)
- Crash + error reporting (Sentry / equivalent; revisit when business case lands)
- SEED-006: Full Spine 4.3 runtime port (planted 2026-05-10 at Phase 32 close; trigger condition: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x OR a paying user reports they cannot re-export their rig as Version 4.2)
- Phase 40 user-deferred polish: 4 WARNs (WR-03 envelope drops atlas fields on locate-skeleton-twice recovery; WR-04 atlas fields not threaded into ResampleArgs payload — main-side coerce is dead code on happy path; WR-05 writtenPaths rollback lacks outDir-containment defense-in-depth; WR-07 `regionBuffers.get()!` non-null assertion in composite layers) + 4 INFOs (IN-01 duplicate `pageFilename` helper; IN-02 `regionBuffers` Map never `.clear()`'d — memory pressure on large atlases; IN-03 generic error message for `:` in projectName; IN-04 dedup branch emits `status:'success'` for dropped row). All explicitly deferred per user decision in `40-REVIEW.md`. Backlog candidates for v1.6+.
- `.skel` binary loader (still deferred)
- Phase-0 scale-overshoot debug session (`investigating`; long-lived tech debt — no regression observed across 8 milestones)
- Audit-acknowledged carry-forwards from v1.0–v1.4 — see STATE.md → Deferred Items for the full table

**v1.5 closures (resolved this milestone):**
- ✓ SEED-005 (RGBA2 + InheritTimeline coverage gap) — closed Phase 37 (TIMELINE-01..05)
- ✓ SEED-007 (Split overrides per loaderMode) — closed Phase 36 (OVR-01..07)
- ✓ SEED-008 (Atlas Repack Output) — closed Phase 40 (REPACK-01..10)
- ✓ Phase 4 code-review follow-up todo (v1.0-era) — closed Phase 38
- ✓ Phase 20 Windows/Linux DnD UAT todo — closed Phase 39 (Linux scope dropped)
- ✓ Phase 31 Windows admin DnD release UAT todo — closed Phase 39
- ✓ Window X-button / Cmd+W dirty-save guard — closed `ef38cd3` during Phase 36 UAT (pre-existing since Phase 8/18, surfaced + fixed in same cycle)

## Current Milestone: v1.5.1 Spine Animation Viewer

**Goal:** Close the optimize → pack → validate loop by adding an in-app Spine animation viewer so animators can confirm their exported `.atlas` + page PNG(s) render correctly without round-tripping through the Spine editor.

**Target features:**
- Read-only Spine animation viewer wrapping Esoteric's official `spine-player` library
- Animation + skin selection controls; standard playback controls (play / pause / scrub)
- Mounted as a sibling visual modal to AtlasPreviewModal / OptimizeDialog (final mount point and asset-feed routing deferred to `/gsd-discuss-phase`)
- Standalone-modal scope (Medium per SEED-009); split-pane source-vs-exported comparison (VIEWER-07) is Future, conditional on D-02 outcome

**Locked design facts (from SEED-009, do not relitigate):**
1. Use Esoteric's official `@esotericsoftware/spine-player` library — no hand-rolled renderer.
2. `spine-player` is a sibling package to the already-installed `spine-core`; both coexist.
3. The viewer is read-only — validation surface, not authoring.
4. The viewer does NOT replace `AtlasPreviewModal` (that shows static atlas layout; this shows animation playback).

**Open decisions (deferred to `/gsd-discuss-phase`):** D-01 npm-dep vs vendored copy of `spine-player.js`; D-02 standalone-modal vs split-pane comparison; D-03 mount location (toolbar button / tab / both); D-04 asset feed (source / exported / user-selectable).

**Scope explicitly excluded from v1.5.1 (deferred to v1.5.2 / v1.6):**
- Phase 40 polish carry-forwards (WR-03, WR-04, WR-05, WR-07, IN-01, IN-02, IN-03, IN-04) — remain in the "Known deferred" list above; user chose viewer-only framing.
- VIEWER-07 (split-pane source-vs-exported comparison) — Future, gated on D-02 picking option B or C.

**Phase numbering:** Continues from v1.5. Starts at **Phase 41** (no `--reset-phase-numbers`). v1.5 phase directories `.planning/phases/36-..40-*/` remain in place per user choice at v1.5 close.

## Next Milestone: v1.6 (TBD)

**Status:** unscoped. Likely scope draws from the v1.5 deferred / backlog list above — Phase 40 polish carry-forward (8 items: WR-03/04/05/07 + IN-01..04 from `40-REVIEW.md`), SEED-006 readiness check (`npm view @esotericsoftware/spine-core@latest` — full Spine 4.3 runtime port), atlas-repack maturity pass on real-user rigs, documentation refresh. Re-validate at `/gsd-new-milestone` time.

**Out of scope (continued exclusions):**
- Linux build/UAT (dropped at v1.3 ship; per `project_linux_deferred` memory)
- `.skel` binary loader (carried since v1.0)
- Cross-mode override copy/sync (deliberately rejected at SEED-007 capture per `project_strict_loadermode_separation`)

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
| Split overrides per loaderMode (atlas-source / atlas-less buckets, SEED-007 D-1/D-2-A/D-3-A, Phase 36) | ✓ Good | Math is mode-invariant by construction (verified at SEED-007 capture); bug was UX intent-routing only. Schema-additive `overridesAtlasLess` field follows `loaderMode`/`sharpenOnExport`/`safetyBufferPercent` precedent — no version bump. Legacy file routing keyed on saved `loaderMode` at the Open seam (Decision 2-A); mode-switch leaves inactive bucket untouched (Decision 3-A); aligns with `project_strict_loadermode_separation`. CR-01 resample-handler bucket-routing bug surfaced + fixed in code-review-fix cycle. |
| TIMELINE-02 conditional escalation TRIGGERED — InheritTimeline mutates `Bone.inherit` read by `updateWorldTransform` (Phase 37) | ✓ Good | Source audit at `Animation.js:755` (writer) + `Bone.js:144` (reader) proved world-transform effect; TIMELINE-03 became load-bearing rather than precautionary. Strict `peak(detached) > peak(baseline)` test asserts the contract — observed 2.5× ratio (BASELINE=0.4 vs INHERIT_DETACH=1.0). RGBA2Timeline confirmed geometry-invariant (writes only `slot.color` / `slot.darkColor`). |
| Atlas Repack output mode is additive (default `loose`); JSON invariant under repack (SEED-008, Phase 40) | ✓ Good | Default `loose` preserves byte-equivalent pre-Phase-40 behavior (SHA256-baseline gate). `atlas` and `both` modes emit libgdx `.atlas` + composite page PNG(s); skeleton JSON is NOT modified (source-confirmed against spine-ts 4.2.111 — runtime reads region dims from `.atlas`, references are by name). 4 additive `.stmproj` fields with no schema bump. `core/` purity preserved (pack math); `sharp` + `.atlas` writing live in `main/`. |
| Sharp-emits-truth: packer reads back actual emitted dims via `metadata()` (Phase 40) | ✓ Good | Plan-target dims (`outW/outH` from `buildExportPlan`) and sharp-emitted dims can drift on edge cases (1px rounding); the packer must consume sharp's reality not the plan's intent. `repack-worker.ts:292-294` reads `meta.width/height` post-resize and feeds the packer. Eliminates pack-vs-emit dimension mismatches that would surface as visual cropping. |
| Shared `writtenPaths: Set<string>` rollback across `runExport` + `runRepack` (Phase 40, REPACK-10 D-04a) | ✓ Good | `both` mode dispatches loose+atlas pipelines sequentially under one shared rollback set so a mid-write failure rolls back EVERY artifact (loose PNGs AND `.atlas` + page PNGs). Inner-catch `fs.rm` sweep at `ipc.ts:974-976`. WR-05 noted as defense-in-depth opportunity (no outDir-containment check) — deferred per user. |
| Window X-button / Cmd+W dirty-save guard (close-path) — `mainWindow.on('close')` mirrors `before-quit` (`ef38cd3` during Phase 36 UAT) | ✓ Good | Pre-existing gap since Phase 8/18 — only `app.on('before-quit')` had the IPC dirty-check; window-close path skipped it entirely, silently discarding unsaved work on X / Cmd+W. Surfaced during Phase 36 Test 8; fix mirrors the `before-quit` pattern (re-entry guard + `event.preventDefault()` + IPC roundtrip). All 4 close-path scenarios (X-dirty, Cmd+W-dirty, X-clean, Cmd+W-clean) human-re-verified. |

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

*Last updated: 2026-05-15 — Phase 41 COMPLETE (Spine Animation Viewer; 3 plans landed; basic-render UAT confirmed live after 3 follow-up fixes for CSP/CORS/PMA). 5 HUMAN-UAT items remain partial. Prior footer: 2026-05-15 — v1.5.1 milestone STARTED (Spine Animation Viewer; viewer-only scope per user, polish items deferred). Continues phase numbering at Phase 41. Research skipped (scope locked by SEED-009 design facts 1–4). v1.5 phase directories 36–40 retained in `.planning/phases/`. Prior footer: 2026-05-15 — v1.5 SHIPPED (Override Routing + Coverage Hardening + Atlas Repack). 5 phases (36, 37, 38, 39, 40), 23 plans, 18 documented REQs (OVR-01..07, TIMELINE-01..05, POLISH-01..03, WINUAT-01..03) + 10 REPACK REQs (archived). Tag `v1.5.0` pending push. Test suite at close: 1181 passed / 2 skipped / 2 todo / 0 failures (108 files); `tsc --noEmit` clean. SEED-005 + SEED-007 + SEED-008 closed. 8 Phase 40 polish items (4 WARN + 4 INFO) explicitly deferred per user — backlog for v1.5.2 / v1.6. Milestone audit at `milestones/v1.5-MILESTONE-AUDIT.md` (passed; 18/18 + 10/10).*

<details>
<summary>Prior phase footer (v1.4 + v1.5 mid-flight detail)</summary>

*2026-05-13 — Phase 39 (Windows-Host-Blocked UAT Burndown, WINUAT-01..03) COMPLETE. 3 plans, 17/17 must-haves verified. Host-availability decision `host_available: yes` recorded in `.planning/phases/39-windows-host-blocked-uat-burndown/39-CONTRACT.md` — user confirmed Windows host + v1.3.1+ installer available, both UATs executed LIVE. WINUAT-01 (Phase 20 DocBuilder DnD on Windows) `passed` (all 4 observations: drag image rendered, mixTime=0.25, loop=false, console clean); pending Phase 20 cross-platform DnD todo retired to `.planning/todos/resolved/` with `## Resolved` close-out. WINUAT-02 (Phase 31 admin DnD release UAT) `passed` (all 4 observations: verbatim advisory copy, drag-over ring suppressed, File→Open functional, normal-relaunch DnD restored); `.planning/milestones/v1.3.1-phases/31-loader-ux-small-fixes-batch/31-HUMAN-UAT.md` item 1 flipped `deferred` → `passed (2026-05-13)`, Summary `passed: 3→4` + `pending: 1→0`, frontmatter `status: partial→passed`; pending Phase 31 admin DnD todo retired to `resolved/`. WINUAT-03 satisfied — both long-lived UAT todos (2026-05-01 Phase 20 + 2026-05-08 Phase 31) cleaned from `pending/`. Zero `src/` or `tests/` files touched (purely procedural UAT close-out + audit-trail). Full vitest suite 1081 passing post-completion. Code review: `skipped` (no source files in scope). Two path inaccuracies corrected in 39-CONTRACT.md §3 (Phase 20 `20-HUMAN-UAT.md` was deleted in commit `0787fe1` so the surviving anchor is the todo; Phase 31 `31-HUMAN-UAT.md` lives at the archived v1.3.1-phases path, not the ROADMAP-referenced path). Prior phase: Phase 38 (Phase 4 Code-Review Polish Pass, POLISH-01..03) COMPLETE. 3 plans, 4/4 must-haves verified. POLISH-AUDIT enumerated 7 deferred Phase 4 findings (IN-01..IN-06 + WR-03) against current source — 1 applies (IN-02 drag-to-cancel overlay guard: `onMouseDown` + `e.target === e.currentTarget` replaces `onClick={props.onCancel}` in `src/renderer/src/modals/OverrideDialog.tsx`, regression spec at `tests/renderer/override-dialog-drag-to-cancel.spec.tsx`, two atomic commits per Phase 27 TDD precedent), 5 no-ops (IN-01 swept by Phase 6 Gap-Fix R6 commit `5551073`; IN-03 by Phase 27 QA-02 `fb3fedc`; IN-05 by Phase 27 QA-03 `01468e4`; IN-06 by Phase 27 QA-04 `cf098e0`; WR-03 by Phase 27 QA-01 `f7668c4`), 1 skip (IN-04 `highlightMatch` duplication between `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx` intentional per Phase 2/3 self-contained-panel pattern; roadmap "SearchBar.tsx" wording was a slip, corrected in audit). v1.0-era `2026-04-24-phase-4-code-review-follow-up.md` retired from `pending/` to `resolved/` with audit-trail-intact close-out. Full vitest suite 1081 passing post-merge. Prior phase: Phase 36 (Split Overrides Per Loader Mode, OVR-01..07) COMPLETE. 5 plans, 14/14 must-haves verified. Two-bucket override model: `overridesAtlasLess` field added to `ProjectFileV1` + `AppSessionState` (schema-additive, no version bump). Open seam routes legacy single-bucket overrides by saved `loaderMode` (Decision 2-A, gated on on-disk key presence per WR-03 fix). `migrateOverrides` invoked per-bucket at all three seams (Open, recovery, resample) with summed `migratedKeyCount` + unioned `staleOverrideKeys`. AppShell exposes `activeOverrides` memo for reads, OverrideDialog writes target active bucket only, mode-switch leaves inactive bucket untouched (Decision 3-A). Mode-toggle toast (D-01..D-04) with `stm.overrideModeToast.suppressed` localStorage flag. Code review surfaced CR-01: `handleProjectResample` originally ignored `loaderMode` for bucket routing — fixed by extending `ResampleArgs` with `overridesAtlasLess?` and routing by bucket-name in both renderer (send both buckets) and main (route by name). 3 new main-side regression tests in `tests/main/project-io.spec.ts`. SEED-007 closed.

Milestone v1.5 (Override Routing + Coverage Hardening) STARTED 2026-05-13. Scope: SEED-007 (split overrides per loaderMode — decisions 1, 2-A, 3-A locked), SEED-005 Level B (RGBA2 + InheritTimeline coverage hardening via audit + fixture), 3 long-lived pending todos (Phase 4 code review + Phase 20 Win DnD UAT + Phase 31 Win admin DnD UAT). SEED-006 (full 4.3 runtime port) explicitly deferred — gated on `@esotericsoftware/spine-core@4.3.x` npm publish. Continues phase numbering from v1.4 → Phase 36+. Prior milestone: v1.4 (Spine 4.3 Forward-Compat + Rotated Atlases) SHIPPED 2026-05-12. 4 phases, 18 plans, 14 REQs (COMPAT-01..02 + ATLAS-01..04 + OPEN-01..05 + DEDUP-04..06). Phase 35 (Region-keyed export plan, DEDUP-04..06) closes the multi-skin atlas-source undercount on `fixtures/SKINS/JOKERMAN_SPINE.json`: `buildExportPlan` in both core (`src/core/export.ts`) and renderer parity (`src/renderer/src/lib/export-view.ts`) iterates `summary.regions` (RegionRow[]) instead of attachment-name-deduped peaks, so 160 atlas regions now produce 160 ExportRows. Phase 34 (File→Open accepts `.json`, OPEN-01..05) — two-IPC-step `'project:open-dialog'` flow with dirty-guard-after-picker (amends Phase 08.2 D-183 for the menu path); HUMAN-UAT 1 scenario host-blocked. Phase 33 (rotated atlas region support, ATLAS-01..04) — `RotatedRegionUnsupportedError` removed atomically; loader D-01 attachment-walk for canonical-corner offset override + AABB W↔H swap in `bounds.ts` + `sharp.rotate(+90)` materialization; libgdx atlas convention nuance documented (bounds W/H is canonical, page-pixel rect is `(H × W)`). Phase 32 (4.3-beta detect-and-warn + drop-zone v4.2 disclosure + SEED-006 plant, COMPAT-01/02) — `checkSpine43Schema` sniffs `root.constraints` OR `skeleton.spine ≥ 4.3` before atlas resolution; structured `SpineVersionUnsupportedError` replaces the misleading `IK Constraint not found: <name>` symptom; SEED-006 planted for full 4.3 runtime port. Prior milestone shipped: v1.3.1 (2026-05-09) — Phase 29/30/31. Tag `v1.4.0` pending push.*

</details>
