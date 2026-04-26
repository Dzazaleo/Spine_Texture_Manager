# Roadmap — Milestone 1 (MVP)

Goal: **ship a desktop app that reliably computes per-attachment peak render scale and exports a per-asset-optimized `images/` folder.** Derisk the core math first (Phase 0), then build the UI on top of proven primitives.

Each phase produces an atomic, testable increment. Do not proceed to the next phase until the current phase's exit criteria are green.

---

## Phase 0: Core-math spike (derisk)

**Depends on:** `fixtures/SIMPLE_PROJECT/` available.

**Deliverables:**
- `package.json`, `tsconfig.json`, `vitest.config.ts` at project root.
- `src/core/loader.ts`, `src/core/sampler.ts`, `src/core/bounds.ts` — pure TS, no DOM.
- `tests/core/*.spec.ts` with golden tests.
- `scripts/cli.ts` — minimal CLI printing a screenshot-1–style text table for any skeleton JSON.

**Exit criteria:**
- All golden tests pass against `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`:
  - N1.2 (leaf bone), N1.3 (bone chain on `CHAIN_2..8`), N1.4 (weighted mesh — add fixture if not present), N1.5 (TransformConstraint — fixture already includes one on `SQUARE`), N1.6 (Physics determinism — stretch).
- CLI prints a table listing CIRCLE, SQUARE, TRIANGLE peaks with plausible scale values.
- Sampler completes in <500 ms on the simple rig.

**Requirement coverage:** F1.1–F1.4, F2.1–F2.7 (core math subset), N1.1–N1.6, N2.1, N2.3.

**Plans:** 7 plans

Plans:
- [x] 00-01-PLAN.md — Bootstrap TypeScript + vitest scaffolding (git init, `.gitignore`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `npm install`). ✅ 2026-04-22 — commit `796480d`, SUMMARY at `.planning/phases/00-core-math-spike/00-01-SUMMARY.md`.
- [x] 00-02-PLAN.md — Headless Spine loader (`src/core/loader.ts` + types + typed errors) with stub TextureLoader. ✅ 2026-04-22 — commit `8c2a4a7`, SUMMARY at `.planning/phases/00-core-math-spike/00-02-SUMMARY.md`.
- [x] 00-03-PLAN.md — Per-attachment AABB + scale math (`src/core/bounds.ts`) — pure, zero I/O. ✅ 2026-04-22 — commit `b619347`, SUMMARY at `.planning/phases/00-core-math-spike/00-03-SUMMARY.md`.
- [x] 00-04-PLAN.md — Sampler with locked tick lifecycle (`src/core/sampler.ts`) — 120 Hz default, Physics.reset + Physics.update. ✅ 2026-04-22 — commit `60709d6`, SUMMARY at `.planning/phases/00-core-math-spike/00-04-SUMMARY.md`.
- [x] 00-05-PLAN.md — Vitest golden suite covering N1.1–N1.6 correctness, N2.1 <500 ms perf gate, N2.3 FS-free hot loop. ✅ 2026-04-22 — commits `244782f` + `11492d6` + `470391b`, SUMMARY at `.planning/phases/00-core-math-spike/00-05-SUMMARY.md`. 35/35 tests green + 1 documented skip (easing-curve stretch).
- [x] 00-06-PLAN.md — CLI entrypoint (`scripts/cli.ts`) — renders peak table + elapsed footer. ✅ 2026-04-22 — commit `8365ce2`, SUMMARY at `.planning/phases/00-core-math-spike/00-06-SUMMARY.md`. Fixture smoke: exit 0, 9.3 ms elapsed, CIRCLE/SQUARE/SQUARE2/TRIANGLE rows rendered; missing-path exits 3 with typed `SkeletonJsonNotFoundError` to stderr.
- [x] 00-07-PLAN.md — Exit-criteria sweep + human-verify checkpoint → advance STATE.md to Phase 0 COMPLETE. ✅ 2026-04-23 — shipping mesh formula is iter-4 hull_sqrt (commit `cce78c3`) after a 5-iteration user-verified loop documented in `.planning/phases/00-core-math-spike/GAP-FIX.md`. Validated on SIMPLE_TEST (golden fixture), skeleton2 (anisotropic-deformation test), Jokerman (licensed real rig, 23 attachments × 18 animations), and Girl (145 attachments × 15 animations). Iter-5 best-fit affine SVD archived on `feat/mesh-render-scale-anisotropic` branch. SUMMARY at `.planning/phases/00-core-math-spike/00-07-SUMMARY.md`.

---

## Phase 1: Electron + React scaffold with JSON drop-load

**Depends on:** Phase 0 green.

**Deliverables:**
- `electron.vite.config.ts`, `src/main/`, `src/preload/`, `src/renderer/` scaffolding.
- Drag-drop zone that accepts a `.json` file, reads atlas/images siblings, calls `core/loader.ts`, dumps the skeleton summary (bones, slots, attachments, skins, animations) to the console and to a debug panel.
- Tailwind CSS configured with the dark-neutral aesthetic matching the screenshots.

**Exit criteria:**
- Dragging `SIMPLE_TEST.json` into the window renders a debug dump matching the CLI's Phase 0 output.
- App builds into a `.dmg` on macOS.

**Requirement coverage:** F1.1, F1.2, F1.3, F1.4, N4.1, N4.2.

**Plans:** 5 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap electron 41 + electron-vite 5 + electron-builder 26 + react 19 + tailwindcss 4 toolchain; three-tsconfig split (references + node + web); electron.vite.config.ts scaffold; .gitignore adds out/ + release/. ✅ 2026-04-23 — commits `301a072` + `17a693a` + `8bc85a5`, SUMMARY at `.planning/phases/01-electron-react-scaffold/01-01-SUMMARY.md`. TypeScript 6.x retained (Open Question A1 resolved). 4 deviations auto-fixed (3 Rule 3 blocking/scope-adjacent for TS 6.x TS18003/TS5101/tsbuildinfo; 1 Rule 1 grep-acceptance compliance).
- [x] 01-02-PLAN.md — Shared IPC types (`src/shared/types.ts`) + main-process projection (`src/main/summary.ts`) + IPC handler with typed-error envelope (`src/main/ipc.ts`) + Electron app entry with pinned security webPreferences (`src/main/index.ts`) + Wave 0 tests (summary/ipc/arch). ✅ 2026-04-23 — commits `027869e` (test: RED Wave 0 shells + full IPC contract) + `c1ea9e9` (feat: summary.ts + ipc.ts GREEN) + `d27c143` (feat: main/index.ts pinned webPreferences + HMR + DevTools dev-only), SUMMARY at `.planning/phases/01-electron-react-scaffold/01-02-SUMMARY.md`. 4 deviations auto-fixed (2 Rule 1 bugs: StringMap iteration TS2488 + fixture bones 9→12; 2 Rule 1 grep-literal compliance). Three-layer core/↛renderer/ defense Layer 3 now LIVE. `npm run test` → 55 passed + 1 skip; Phase 0 invariants preserved.
- [x] 01-03-PLAN.md — Preload contextBridge surface with `webUtils.getPathForFile` (D-09 correction) + renderer bootstrap (index.html with CSP / main.tsx / App.tsx state machine / env.d.ts) + Tailwind v4 `@theme inline` stylesheet (D-12/D-14 correction) with warm-stone tokens + self-hosted JetBrains Mono. ✅ 2026-04-23 — commits `bd91356` (feat: preload contextBridge + webUtils.getPathForFile + globalThis fallback) + `0023eb7` (feat: renderer bootstrap — index.html CSP + main.tsx React 19 StrictMode + App.tsx AppState D-20 + env.d.ts) + `0cd2399` (feat: stylesheet @theme inline warm-stone + orange-accent tokens + self-hosted JetBrains Mono + src/main/index.ts preload path `.js`→`.mjs` correction), SUMMARY at `.planning/phases/01-electron-react-scaffold/01-03-SUMMARY.md`. 3 deviations auto-fixed (2 Rule 3 blocking: `window` unavailable in node-project ES2022 lib→`globalThis`; electron-vite emits preload `.mjs`→corrected `src/main/index.ts` target; plus 1 Rule 1: CSS `*/` comment trap→reworded prose). `npx electron-vite build` green: out/main/index.js + out/preload/index.mjs + out/renderer/index.html + assets. Layer 3 arch.spec.ts now actively scans real renderer files. `npm run test` → 55 passed + 1 skip; Phase 0 invariants preserved.
- [x] 01-04-PLAN.md — DropZone (full-window drag target; raw File → preload) + DebugPanel (header + `<pre>` table byte-for-byte port of `scripts/cli.ts renderTable`) + App.tsx wiring (all 4 AppState branches + D-17 console.log echo via useEffect). ✅ 2026-04-23 — commits `7f34ea1` (feat: DropZone with webUtils-safe File forwarding + literal Tailwind drag-over ring + clsx conditional + hand-rolled drag handlers) + `a6d5e05` (feat: DebugPanel header + <pre> CLI-style peak table, byte-for-byte port of scripts/cli.ts lines 77–126 minus sort step per D-16) + `c8feded` (feat: App.tsx wiring — AppState D-20 with all 4 render branches + DropZone + DebugPanel composition + D-17 console.log echo via useEffect gated on loaded status), SUMMARY at `.planning/phases/01-electron-react-scaffold/01-04-SUMMARY.md`. 1 deviation auto-fixed (Rule 1 grep-literal compliance: docstring citing `react-dropzone` reworded to generic prose — same pattern as 01-01 Dev #4, 01-02 Dev #3/#4, 01-03 Dev #3). `npx electron-vite build` green: out/renderer/assets/index-*.css grew 7.44 → 11.81 kB with new Tailwind utilities; Layer 3 arch.spec.ts auto-scanning new components (zero core offenders). `npm run test` → 55 passed + 1 skip; Phase 0 invariants preserved. F1.1 + F1.2 + F1.4 completed end-to-end via renderer path.
- [x] 01-05-PLAN.md — `electron-builder.yml` macOS-only `.dmg` target (D-24 additive-ready; no signing hooks per D-04) + full automated exit-criteria sweep (build:dry + real .dmg) + populate `01-VALIDATION.md` per-task map + `checkpoint:human-verify` for the drop-test and .dmg-open gates. ✅ 2026-04-23 — commits `c4a8994` (chore: electron-builder.yml macOS-only dmg target, no win block, no signing hooks, files whitelist) + `eb57386` (docs: 01-VALIDATION.md per-task map 15×✅ + frontmatter flips) + `d1e4211` (docs: STATE.md interim — Tasks 1-3 complete, Task 4 pending) + **`b5d6988` (fix: gap-fix caught at human-verify — CJS preload for sandbox mode; arch.spec regression guards added)** + final metadata commit. Produced `release/Spine Texture Manager-0.0.0-arm64.dmg` (111 MB, unsigned). Human-verify signed off 2026-04-23 after the CJS-preload gap fix: dev drop renders CIRCLE/SQUARE/SQUARE2/TRIANGLE table, DevTools D-17 echo fires, non-JSON drop + missing-atlas drop produce typed error envelopes, packaged `.dmg` launches after Gatekeeper bypass and drops identically. `npm run test` → 57 passed + 1 skip (Phase 0 47+1 + summary 3/3 + ipc 3/3 + arch **4/4** — now covering sandbox-preload-CJS regression). Phase 1 COMPLETE.

---

## Phase 2: Global Max Render Source panel

**Depends on:** Phase 1 green.

**Goal:** Replace Phase 1's CLI-style `<pre>` DebugPanel with a proper sortable, searchable, selectable per-attachment table (screenshot 1). Ship `src/core/analyzer.ts` (pure-TS fold + format), `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (hand-rolled table with sort + select), `src/renderer/src/components/SearchBar.tsx` (case-insensitive substring filter). Wire through `src/renderer/src/App.tsx` and `src/main/summary.ts`; `scripts/cli.ts` stays byte-for-byte identical.

**Deliverables:**
- `src/core/analyzer.ts` folds sampler output → `DisplayRow[]` (raw numbers + preformatted labels).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — sortable table per screenshot 1.
- `src/renderer/src/components/SearchBar.tsx` — filters by attachment name.

**Exit criteria:**
- Loading `SIMPLE_TEST.json` produces a table with correct source/peak/scale/source-animation for every attachment.
- Search filter correctly hides/shows rows.

**Requirement coverage:** F3.1, F3.2, F3.3.

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Core analyzer module + DisplayRow IPC type + byte-for-byte CLI refactor. Introduces `src/core/analyzer.ts` (pure-TS fold + sort + preformat), replaces `PeakRecordSerializable` with `DisplayRow` in `src/shared/types.ts`, delegates fold in `src/main/summary.ts` and `scripts/cli.ts`. Wave 1, autonomous.
- [x] 02-02-PLAN.md — Renderer components: `SearchBar` (controlled input with clear button + ESC handling) and `GlobalMaxRenderPanel` (hand-rolled sortable, searchable, multi-select `<table>` with match-highlight, tri-state select-all, shift-click range). Wave 2, autonomous, depends on 02-01.
- [x] 02-03-PLAN.md — Wire panel into `App.tsx`, delete prior debug component per Phase 1 D-16, human-verify end-to-end drop flow on SIMPLE_TEST.json. Wave 3, has checkpoint, depends on 02-01 + 02-02.

---

## Phase 3: Animation Breakdown panel

**Depends on:** Phase 2 green.

**Deliverables:**
- `src/renderer/panels/AnimationBreakdownPanel.tsx` per screenshot 3 — collapsible per-animation cards, Bone Path rendered, per-row override button.
- "Setup Pose (Default)" top card.
- "No assets referenced" state for animations with zero attachment activity.

**Exit criteria:**
- Every animation in `SIMPLE_TEST.json` renders its own card with correct asset list and scale math.
- Animations with no attachment activity render the empty state.

**Requirement coverage:** F4.1, F4.2, F4.3, F4.4.

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md — Phase 3 core data layer: extend sampler to emit per-animation + setup-pose peaks in a single lifecycle pass (D-53/D-54/D-55 + SCALE_DELTA_EPSILON), new pure-TS `src/core/bones.ts` for Bone Path traversal (D-68), augment `src/core/analyzer.ts` with `analyzeBreakdown` sibling export (D-56/D-58/D-59/D-60), extend `src/shared/types.ts` with `BreakdownRow` + `AnimationBreakdown` + `SkeletonSummary.animationBreakdown`, adapt `src/main/summary.ts` + `src/main/ipc.ts` + `scripts/cli.ts` to the new SamplerOutput shape (CLI byte-for-byte preserved). Wave 1, autonomous.
- [x] 03-02-PLAN.md — Phase 3 renderer artifacts: new `src/renderer/src/components/AppShell.tsx` (top-tab shell — D-49/D-50/D-51/D-52), new `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (collapsible cards + Bone Path mid-ellipsis + disabled Override button + cross-card search + jump-target flash — D-62..D-71), touch `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (Source Animation chip → jump-target button per D-72; filename chip hoisted into AppShell per D-49). Wave 2, autonomous, depends on 03-01.
- [x] 03-03-PLAN.md — Wire AppShell into `App.tsx` loaded branch (two-line diff), run full automated gates, `checkpoint:human-verify` end-to-end drop flow + tab switching + card UX + Source Animation jump-target behavior on SIMPLE_TEST.json. Phase-close admin: cleanup `.cli-golden.txt`, flip 03-VALIDATION.md frontmatter, update STATE.md. Wave 3, has checkpoint, depends on 03-01 + 03-02.

---

## Phase 4: Scale overrides

**Depends on:** Phase 3 green.

**Deliverables:**
- `src/core/overrides.ts` — override model, clamping to source max.
- `src/renderer/modals/OverrideDialog.tsx` — double-click peak → percentage input.
- Override badges across both panels.

**Exit criteria:**
- Setting 50% on TRIANGLE halves its target dims everywhere.
- Setting 200% clamps to 100% (source max).
- Overrides persist in component state for the session.

**Requirement coverage:** F5.

**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Core overrides module (src/core/overrides.ts pure-TS clamp + applyOverride math) + Layer 3 renderer-side inline copy (src/renderer/src/lib/overrides-view.ts) + tests/core/overrides.spec.ts (behavior + hygiene + core↔renderer parity). Resolves pattern-mapper flag 1 (Layer 3 core/↛renderer boundary) via option 1 (inline duplicate with grep-verified parity). Wave 1, autonomous. ✅ 2026-04-24 — commits `f872a41` (feat: src/core/overrides.ts) + `bd802c3` (feat: renderer overrides-view.ts inline copy) + `ee3e8ab` (test: overrides.spec.ts behavior + hygiene + parity; widen tsconfig.node include). 2 deviations auto-fixed (1 Rule 1 grep-literal compliance in renderer docstring — same class as 01-01 Dev #4 etc.; 1 Rule 3 blocking — tsconfig.node.json include needed src/renderer/src/lib/** for parity spec to typecheck). `npm run test` → 113 passed + 1 skip (was 88 + 1; +25 new specs: 9 clampOverride + 6 applyOverride + 5 hygiene + 5 parity). Layer 3 arch.spec 6/6 intact. F5.2 complete. SUMMARY at `.planning/phases/04-scale-overrides/04-01-SUMMARY.md`.
- [x] 04-02-PLAN.md — AppShell extension (overrides Map + dialogState + three callbacks) + new src/renderer/src/modals/OverrideDialog.tsx (hand-rolled ARIA modal with integer input, silent clamp on Apply, Reset/Cancel/Apply buttons, ESC + overlay + focus management) + panel Props-interface extensions (optional overrides + onOpenOverrideDialog). Wave 2, autonomous, depends on 04-01. ✅ 2026-04-24 — commits `bb97d72` (feat: OverrideDialog.tsx 137-line hand-rolled ARIA modal — role=dialog/aria-modal=true/aria-labelledby, controlled integer input, auto-focus+select on open, ESC/Enter/overlay-click handlers, conditional Reset-to-100% button, two-weight typography, Tailwind v4 literal-class discipline, Layer 3 clean) + `ddd7d05` (feat: AppShell.tsx extended 128→212 lines with overrides Map<string, number> + dialogState|null + three useCallback handlers + conditional `<OverrideDialog>` render + both panels receive overrides + onOpenOverrideDialog; Props interfaces gain optional members — Plan 04-03 consumes). **Zero deviations** — plan executed byte-for-byte. AppShell imports clampOverride from `../lib/overrides-view.js` (renderer copy), NEVER from core — Layer 3 arch gate 6/6 intact. **113 passed + 1 skipped** (no regression). Both typecheck projects clean w.r.t. files touched. `npx electron-vite build` green: renderer CSS 17 → 20.12 kB. SUMMARY at `.planning/phases/04-scale-overrides/04-02-SUMMARY.md`.
- [x] 04-03-PLAN.md — Panel wiring: Scale + Peak W×H override badges on both GlobalMaxRenderPanel (with batch mode via selection + effective-scale sort comparator) and AnimationBreakdownPanel (per-row only, unlocked D-69 Override Scale button, kept chip styling). Closes pattern-mapper flags 2 (event propagation) + 3 (sort comparator) + 4 (types.ts discretion option A). Includes primary Phase 4 STRIDE threat model. Wave 3, has human-verify checkpoint, depends on 04-01 + 04-02. ✅ 2026-04-24 — Task 1 `0011f0d` (feat: Global panel badges + dialog trigger + effective-scale sort) + Task 2 `bb9f526` (feat: Animation Breakdown panel badges + dialog trigger + D-69 button unlock) + human-verify Task 3 signed off with 4 deviations → atomic gap-fix commits `6a1a61d` (refactor G1: applyOverride single-arg supersedes D-78/D-79) + `0c5af2f` (feat G2: two-reset-button dialog) + `22626e9` (feat G3: AppShell prefill reads peakScale) + `0d964a5` (fix G4: Global panel batch-scope attachmentName conversion + default sort by name + effective-scale consumer update) + `b98d918` (fix G5: Animation Breakdown panel effective-scale consumer update + tooltip format) + `c5118b3` (test G6: arch.spec regression guard) + `e396021` (docs G7: supersede D-78/D-79 + new D-91 semantics). **4 deviations** (Rule 1 Gap A batch bug, Rule 4 Gap B+C user-approved architectural change-of-intent, 1 Gap D doc deferral). `npm run test` → **116 passed + 1 skipped**; arch **8/8** (6→8 with new regression guards); `npx electron-vite build` green; `scripts/cli.ts` byte-for-byte unchanged. F5.1 + F5.2 + F5.3 complete end-to-end. **Phase 4 COMPLETE — ready for `/gsd-verify-work 4`.** SUMMARY at `.planning/phases/04-scale-overrides/04-03-SUMMARY.md`.


---

## Phase 5: Unused attachment detection

**Depends on:** Phase 4 green.

**Goal:** Detect attachments registered in `skin.attachments` that never render (active slot with alpha > 0) across any animation × skin combination, including setup-pose passes. Ship `src/core/usage.ts` (pure-TS enumeration + defined∖used diff), extend `SkeletonSummary` with `unusedAttachments: UnusedAttachment[]` on the existing IPC surface, add a new `--color-danger` warm/terracotta `@theme` token, and render a conditional warning-tinted section ABOVE the peak table on `GlobalMaxRenderPanel`. Sampler stays LOCKED (D-100). CLI stays byte-for-byte unchanged (D-102). Animation Breakdown panel untouched.

**Deliverables:**
- `src/core/usage.ts` — pure-TS unused-attachment detector (F6.1).
- `src/shared/types.ts` — `UnusedAttachment` interface + `SkeletonSummary.unusedAttachments` extension (D-101).
- `src/main/summary.ts` — single call site wiring `findUnusedAttachments` into the IPC projection.
- `src/renderer/src/index.css` — new `--color-danger: #e06b55` `@theme` token (D-104, RESEARCH Finding #7).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — conditional `<section>` above the peak table, red-header-only treatment (D-105), inherits SearchBar filter (D-107).
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.{json,atlas}` — ghost-def test fixture for the primary F6 case (D-95).
- `tests/core/usage.spec.ts` + `tests/core/summary.spec.ts` extension — 8+ unit cases covering D-92/D-93/D-95/D-98/D-107.

**Exit criteria:**
- Drop `SIMPLE_TEST.json` → peak table renders as in Phase 4, no unused section (clean rig).
- Drop `SIMPLE_TEST_GHOST.json` → warm/terracotta-header section appears with one row (`GHOST · 64×64 · default`); peak table still renders below.
- SearchBar substring filter applies to both the peak table AND the unused section consistently (D-107).
- Red scope is header-only — row cells render in standard text colors (D-105).
- `npm run test` full suite green (>= 120 passed + 1 skipped).
- `git diff scripts/cli.ts` + `git diff src/core/sampler.ts` both empty (D-100 / D-102 locks).
- `npx electron-vite build` succeeds; emitted CSS carries the new danger token.

**Requirement coverage:** F6.1, F6.2.

**Plans:** 4 plans

Plans:
- [x] 05-01-PLAN.md — Wave 0 scaffolding: UnusedAttachment IPC contract in src/shared/types.ts + SIMPLE_TEST_GHOST fixture fork (json + atlas) + RED spec stubs in tests/core/usage.spec.ts + F6.2 assertion added to tests/core/summary.spec.ts. Wave 1, autonomous, depends_on [].
- [x] 05-02-PLAN.md — Core detector + wiring: new src/core/usage.ts (pure-TS findUnusedAttachments per F6.1 / D-100) + 3-line projection extension in src/main/summary.ts; drives Plan 01's RED specs to GREEN. Wave 2, autonomous, depends_on [05-01].
- [x] 05-03-PLAN.md — UI surface: new --color-danger #e06b55 @theme token in src/renderer/src/index.css (RESEARCH Finding #7) + conditional <section> markup above the peak table in src/renderer/src/panels/GlobalMaxRenderPanel.tsx (F6.2, D-103/D-105/D-107); inherits SearchBar filter; Layer 3 boundary + batch-scope regression guards preserved. Wave 3, autonomous, depends_on [05-01, 05-02].
- [x] 05-04-PLAN.md — Close-out: automated exit-criteria sweep (full suite, CLI byte-for-byte, locked-file audit, build) + populate 05-VALIDATION.md per-task map + flip signed-off frontmatter + checkpoint:human-verify on SIMPLE_TEST + SIMPLE_TEST_GHOST drops with red-scope + filter + CLI sanity checks. Wave 4, has checkpoint, depends_on [05-01, 05-02, 05-03].

---

## Phase 6: Optimize Assets (image export)

**Depends on:** Phase 5 green.

**Goal:** Per-attachment image export via sharp Lanczos3 (F8 + N3). Reads peaks + overrides + unused list already computed in Phases 0-5; resizes each source PNG via `sharp` Lanczos3 with PNG compression level 9 + alpha preserved; writes optimized images to a user-chosen output directory while preserving the source `images/` directory layout. Ships `src/core/export.ts` (pure-TS plan builder), `src/main/image-worker.ts` (sharp loop with atomic write + cooperative cancel + skip-on-error), `src/renderer/src/modals/OptimizeDialog.tsx` (hand-rolled ARIA modal cloning Phase 4 D-81), AppShell toolbar button entry, and one-way IPC progress channel. Adds `sharp` as the first native binary dependency. Sampler stays LOCKED. CLI stays byte-for-byte unchanged (D-102).

**Deliverables:**
- `src/core/export.ts` — pure-TS plan builder (D-108..D-111: per-sourcePath dedup, unused exclusion, Math.round uniform sizing, applyOverride or peakScale fallback).
- `src/renderer/src/lib/export-view.ts` — Layer 3 inline-copy of buildExportPlan (Phase 4 D-75 precedent; AppShell builds plan client-side).
- `src/main/image-worker.ts` — sequential sharp Lanczos3 resize per ExportRow (D-114) with pre-flight fs.access (D-112), path-traversal defense, atomic `<outPath>.tmp` → `fs.rename` write (D-121), cooperative cancel between files (D-115), skip-on-error per-file (D-116).
- `src/main/ipc.ts` — `'export:start'` (request/response), `'export:cancel'` (one-way), `'export:progress'` (one-way `webContents.send`), `'dialog:pick-output-dir'`, `'shell:open-folder'`. Re-entrancy guard + outDir validation (D-122 / F8.4).
- `src/preload/index.ts` — contextBridge api extended with pickOutputDirectory + startExport + cancelExport + onExportProgress + openOutputFolder; unsubscribe identity preserved (Pitfall 9).
- `src/renderer/src/modals/OptimizeDialog.tsx` — hand-rolled ARIA modal cloning OverrideDialog scaffold; pre-flight + in-progress + complete state machine; per-file checklist with --color-danger error rows (Phase 5 D-104 token reuse).
- `src/renderer/src/components/AppShell.tsx` — Optimize Assets toolbar button (D-117, right-aligned next to filename chip, disabled when no peaks or export in flight); two-step click handler (picker → buildExportPlan → mount dialog).
- `package.json` — sharp ^0.34.5 added to `dependencies` (NOT devDependencies); `electron-builder.yml` asarUnpack extended with BOTH `**/node_modules/sharp/**/*` AND `**/node_modules/@img/**/*` globs (D-123 / N4.2 / Pitfall 1).
- `fixtures/EXPORT_PROJECT/` — dedicated export fixture (atlas + JSON + 4 source PNGs) for image-worker integration tests.
- `tests/core/export.spec.ts` — 7 cases (a-g) including parity describe block; hygiene grep block for Layer 3.
- `tests/main/image-worker.spec.ts` — 6 cases (a-f) against mocked sharp + node:fs/promises.
- `tests/main/image-worker.integration.spec.ts` — 1 real-bytes end-to-end test against EXPORT_PROJECT fixture.
- `tests/main/ipc-export.spec.ts` — F8.1 picker behavior + D-115 re-entrancy + D-122 outDir validation tests.
- `tests/arch.spec.ts` — extended with Layer 3 src/core ↛ sharp/node:fs grep (loader.ts name-exempted).
- `src/core/loader.ts` + `src/core/types.ts` + `src/core/analyzer.ts` + `src/main/summary.ts` + `src/shared/types.ts` — `sourcePath` plumbing (D-108 dedup key threaded loader → DisplayRow); 6 new IPC interfaces (ExportRow, ExportPlan, ExportError, ExportProgressEvent, ExportSummary, ExportResponse) + Api extension.

**Exit criteria:**
- Exported `<out>/images/CIRCLE.png` matches target dims exactly.
- Visual spot-check vs manual Photoshop Lanczos shows no perceptible difference (N3.2 — human-verify gate).
- Original files untouched (F8.4 — verified by D-121 atomic write to outDir + D-122 outDir prefix check).
- Packaged `.dmg` loads sharp without `Cannot find module` errors at first export attempt (N4.2 + D-123 + Pitfall 1 — human-verify gate).
- `npm run test` full suite green (116 baseline + new export/image-worker/ipc-export tests all GREEN).
- `git diff scripts/cli.ts` + `git diff src/core/sampler.ts` both empty (D-102 + CLAUDE.md rule #3 locks).
- arch.spec.ts both Layer 3 invariants intact: renderer ↛ core AND core ↛ sharp/node:fs (loader.ts exempted).
- `npx electron-vite build` succeeds; `npm run build` produces .dmg in 140-200 MB range.

**Requirement coverage:** F8.1, F8.2, F8.3, F8.4, F8.5, N3.1, N3.2, N4.2.

**Plans:** 7 plans

Plans:
- [x] 06-01-PLAN.md — Wave 0 scaffolding: install sharp@^0.34.5 in dependencies; extend electron-builder.yml asarUnpack with BOTH `sharp/**/*` and `@img/**/*` globs (Pitfall 1); create fixtures/EXPORT_PROJECT/ with atlas + JSON + 4 real source PNGs (matching atlas-declared originalWidth/Height); author RED test shells for tests/core/export.spec.ts (cases a-g + hygiene), tests/main/image-worker.spec.ts (cases a-f), tests/main/ipc-export.spec.ts (F8.1 + D-115 + D-122); extend tests/arch.spec.ts with src/core ↛ sharp/node:fs Layer 3 grep (loader.ts name-exempted). Wave 1, autonomous, depends_on [].
- [x] 06-02-PLAN.md — Wave 1 data plumbing: extend LoadResult.sourcePaths in src/core/loader.ts (path.join(skeletonDir/images, regionName + '.png') per atlas region); add sourcePath: string field to DisplayRow in src/shared/types.ts (and BreakdownRow inheritance); thread sourcePaths through src/core/analyzer.ts analyze + analyzeBreakdown signatures; wire src/main/summary.ts to pass load.sourcePaths into both calls; add 6 new IPC interfaces (ExportRow, ExportPlan, ExportError, ExportProgressEvent, ExportSummary, ExportResponse) + Api extension with 5 new methods to src/shared/types.ts; lock sourcePath contract in tests/core/{loader,analyzer,summary}.spec.ts. Wave 2, autonomous, depends_on [06-01].
- [x] 06-03-PLAN.md — Wave 2 (parallel with 06-04): pure-TS buildExportPlan in src/core/export.ts (D-108 per-sourcePath dedup with max(effectiveScale), D-109 unused exclusion via summary.unusedAttachments, D-110 Math.round uniform on both axes, D-111 applyOverride-or-peakScale resolution); renderer-side byte-identical inline copy at src/renderer/src/lib/export-view.ts (Phase 4 D-75 precedent); drive tests/core/export.spec.ts cases (a)-(g) GREEN + add parity describe block locking the two copies against drift. Wave 3, autonomous, depends_on [06-01, 06-02].
- [x] 06-04-PLAN.md — Wave 2 (parallel with 06-03): src/main/image-worker.ts exporting runExport(plan, outDir, onProgress, isCancelled). 7-phase per-row pipeline: pre-flight fs.access (D-112) → path-traversal defense → NaN/zero-dim guard → fs.mkdir parent (recursive) → sharp(srcPath).resize(W, H, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 9 }).toFile(<outPath>.tmp) → fs.rename(<tmp>, <outPath>) → emit progress event with absolute outPath. Sequential (D-114), cooperative cancel between files (D-115), skip-on-error continuation (D-116). Drive tests/main/image-worker.spec.ts cases (a)-(f) GREEN against mocked sharp + node:fs/promises; add tests/main/image-worker.integration.spec.ts real-bytes case (CIRCLE.png 64×64 → 32×32). Wave 3, autonomous, depends_on [06-01, 06-02].
- [x] 06-05-PLAN.md — Wave 4 IPC + preload glue: src/main/ipc.ts gains handleStartExport + handlePickOutputDirectory extracted handlers (Phase 1 D-10 discipline) + module-level exportInFlight + exportCancelFlag flags + isOutDirInsideSourceImages helper + validateExportPlan trust-boundary input check. Re-entrancy guard returns kind:'already-running' (D-115); outDir-equals-or-child-of-source/images returns kind:'invalid-out-dir' (D-122 / F8.4). registerIpcHandlers wires 4 new channels: 'dialog:pick-output-dir' (invoke), 'export:start' (invoke), 'export:cancel' (one-way send), 'shell:open-folder' (one-way send). src/preload/index.ts extends contextBridge api with 5 new methods preserving sandbox discipline (only 'electron' import); onExportProgress unsubscribe pattern captures wrapped const for listener identity (Pitfall 9). Drives tests/main/ipc-export.spec.ts cases GREEN. Wave 4, autonomous, depends_on [06-02, 06-03, 06-04].
- [x] 06-06-PLAN.md — Wave 5 renderer UI: src/renderer/src/modals/OptimizeDialog.tsx hand-rolled ARIA modal cloning OverrideDialog scaffold (D-81 inheritance) with three-state machine: pre-flight (file list + Start/Cancel) → in-progress (linear bar + per-file checklist + Cancel) → complete (summary line + Open output folder + Close). ESC + click-outside close in pre-flight + complete states ONLY (NOT in-progress). Subscribe to api.onExportProgress in useEffect with cleanup via returned unsubscribe (Pitfall 9 + 15). Status icons via clsx with literal class branches (Tailwind v4 Pitfall 8); error rows render --color-danger (Phase 5 D-104 token). src/renderer/src/components/AppShell.tsx extended with persistent "Optimize Assets" toolbar button right-aligned (D-117, ml-auto), disabled when peaks=0 or export in flight; two-step click handler (D-118): pickOutputDirectory(<skeletonDir>/images-optimized/) → buildExportPlan(summary, overrides) from lib/export-view.js → mount OptimizeDialog. Layer 3 invariant: renderer NEVER imports core/* — uses lib/export-view.js (Phase 4 D-75 precedent). Wave 5, autonomous, depends_on [06-03, 06-05].
- [x] 06-07-PLAN.md — Wave 6 close-out: automated exit-criteria sweep (full vitest, typecheck, electron-vite build, locked-file diffs scripts/cli.ts + src/core/sampler.ts, npm audit on sharp HIGH+); produce packaged .dmg via npm run build; populate 06-VALIDATION.md per-task map (15 rows); flip frontmatter status:signed-off + nyquist_compliant + wave_0_complete; checkpoint:human-verify on 7 manual gates (Step 1 dev-mode end-to-end drop+optimize on EXPORT_PROJECT; Step 2 D-122 outDir validation rejection; Step 3 cancel UX during real export — large fixture; Step 4 ARIA keyboard sanity; Step 5 visual Lanczos3 N3.2 spot-check vs Photoshop on real fixture; Step 6 packaged .dmg sharp-load N4.2/D-123/Pitfall 1 — RELEASE BLOCKER if FAIL; Step 7 backward compat on SIMPLE_TEST + SIMPLE_TEST_GHOST). Advance STATE.md to Phase 6 COMPLETE; flip ROADMAP plan checkboxes; commit `docs(06): close Phase 6 after human-verify`. Wave 6, has checkpoint, depends_on [06-01, 06-02, 06-03, 06-04, 06-05, 06-06].

---

## Phase 7: Atlas Preview modal

**Depends on:** Phase 6 green.

**Goal:** Ship a hand-rolled ARIA modal that visualizes what the rig's atlas WOULD look like under two scenarios (Original / Optimized) at two resolution caps (2048 / 4096), using `maxrects-packer` for packing projection and 2D-canvas `drawImage` for actual region pixel rendering. F7.2's "estimated file-size delta" is REINTERPRETED per CONTEXT D-127 to dims + page count + per-page efficiency only — no bytes shown anywhere. Adds the canonical "20% glow override" UX gesture: dblclick a region rect → modal closes → app jumps to the matching row in Global Max Render Source panel + flashes (Phase 3 D-72 jump-target system extended to GlobalMaxRenderPanel for the first time). Sampler stays LOCKED. CLI stays byte-for-byte unchanged (Phase 5 D-102).

**Deliverables:**
- `src/core/atlas-preview.ts` — pure-TS pack projection (D-124..D-132) + Layer 3 grep guard.
- `src/renderer/src/lib/atlas-preview-view.ts` — byte-identical Layer 3 inline copy (Phase 4 D-75 / Phase 6 D-108 precedent).
- `src/renderer/src/modals/AtlasPreviewModal.tsx` — hand-rolled ARIA modal cloning OverrideDialog/OptimizeDialog scaffold (D-81); left-rail controls + main-view canvas with hover/dblclick.
- `src/renderer/src/components/AppShell.tsx` — toolbar button + state + modal mount + extension of jump-target dispatch to recognize Atlas Preview as a source.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — port of `focusAttachmentName` / `onFocusConsumed` consumer pattern from `AnimationBreakdownPanel.tsx:299-325` (RESEARCH §Pitfall 2 amendment to CONTEXT line 222).
- `src/main/index.ts` — `protocol.handle('app-image', ...)` registration (RESEARCH §Pitfall 1 amendment to CONTEXT D-133 — raw `file://` is blocked by current CSP).
- `src/renderer/index.html` — CSP `img-src` widened by exactly one scheme (`app-image:`).
- `src/shared/types.ts` — `AtlasPreviewInput`, `PackedRegion`, `AtlasPage`, `AtlasPreviewProjection` (structuredClone-safe per Phase 1 D-21).
- `package.json` — adds `maxrects-packer ^2.7.3` (runtime) + `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` (devDeps).
- `vitest.config.ts` — extend `include` to scan `tests/**/*.spec.tsx`.
- `tests/core/atlas-preview.spec.ts` — 8 case blocks (a..h) + hygiene grep + Layer 3 parity grep.
- `tests/renderer/atlas-preview-modal.spec.tsx` — first-of-its-kind renderer spec (jsdom env); covers default view, toggle re-render, pager bounds, dblclick, missing-source.

**Exit criteria:**
- Modal opens on AppShell button click; default view = Optimized @ 2048, page 1 (D-135).
- VIEW MODE + ATLAS RESOLUTION + ATLAS PAGE pager all re-compute the projection via useMemo.
- TOTAL ATLASES + EFFICIENCY (PAGE N) cards display dims + page count + per-page efficiency only — NO bytes anywhere (D-127 / F7.2 reinterpretation).
- Canvas renders actual region pixel content via `drawImage` 9-arg form (per-region PNG: full image; atlas-packed: srcRect crop from page atlas).
- Hover-reveal: warm-stone-accent low-opacity fill + label overlay; default outline-only (D-129).
- Dblclick on region rect → modal closes + activeTab='global' + matching row scrolls into view + flashes for 900ms (D-130 + canonical "20% glow override" workflow).
- Snapshot-at-open semantics: re-opening the modal after editing an override visibly shrinks the affected region's rect (D-131).
- Layer 3 grep at `tests/arch.spec.ts` auto-scans `src/core/atlas-preview.ts` and passes (no fs/sharp/electron/DOM imports).
- Inline-copy parity grep at `tests/core/atlas-preview.spec.ts` locks `src/core/atlas-preview.ts` ↔ `src/renderer/src/lib/atlas-preview-view.ts` byte-identity.
- Phase 6 export math is unchanged (no regression in `tests/core/export.spec.ts`).
- CLI byte-for-byte unchanged (D-102; `git diff scripts/cli.ts` empty).
- `npm run test` full suite green; `npx electron-vite build` green.

**Requirement coverage:** F7.1, F7.2 (REINTERPRETED per D-127).

**Plans:** 6 plans (5 original + 1 gap-fix from 2026-04-25 HUMAN-UAT)

Plans:
- [x] 07-01-PLAN.md — Wave 0 dependencies + types + RED stub specs (maxrects-packer + jsdom + @testing-library/react + @testing-library/jest-dom + @testing-library/user-event; vitest.config widening; src/shared/types.ts AtlasPreviewInput / PackedRegion / AtlasPage / AtlasPreviewProjection; tests/core/atlas-preview.spec.ts + tests/renderer/atlas-preview-modal.spec.tsx RED stubs). Wave 1, autonomous, depends_on [].
- [x] 07-02-PLAN.md — Layer-3 core projection + renderer inline copy + parity (src/core/atlas-preview.ts; src/renderer/src/lib/atlas-preview-view.ts; tests/core/atlas-preview.spec.ts case (a)..(h) + hygiene grep + parity grep blocks driven RED → GREEN). Wave 2, autonomous, depends_on [07-01].
- [x] 07-03-PLAN.md — Renderer protocol + CSP (src/main/index.ts protocol.handle('app-image', ...) + registerSchemesAsPrivileged; src/renderer/index.html CSP img-src widening to include app-image:). Wave 2, autonomous, depends_on [07-01].
- [x] 07-04-PLAN.md — Modal component + canvas + hover/dblclick + missing-source (src/renderer/src/modals/AtlasPreviewModal.tsx with LeftRail/AtlasCanvas/InfoCard sub-components inline; tests/renderer/atlas-preview-modal.spec.tsx jsdom specs driven RED → GREEN; optional --color-success token in src/renderer/src/index.css). Wave 3, autonomous, depends_on [07-01, 07-02, 07-03].
- [x] 07-05-PLAN.md — AppShell wiring + GlobalMaxRenderPanel jump-target consumer port + human-verify (src/renderer/src/components/AppShell.tsx toolbar button + 3 state slots + 3 callbacks + modal mount + Global panel prop forwarding; src/renderer/src/panels/GlobalMaxRenderPanel.tsx port of AnimationBreakdownPanel:299-325 jump-target effect; checkpoint:human-verify on 10 manual gates including the canonical "20% glow override" workflow). Wave 4, has checkpoint, depends_on [07-02, 07-03, 07-04].
- [x] 07-06-PLAN.md — Gap-closure plan from 2026-04-25 HUMAN-UAT (Gaps 1-4): diagnostic instrumentation + Gap 1 canvas pixel rendering fix + Gap 2/4 auto-fit canvas (D-139 amendment) + Gap 3 hover dimensions line + diagnostic cleanup + UAT re-run signoff. Wave 5, has checkpoint, depends_on [07-04, 07-05]. **COMPLETE 2026-04-25.**

---

## Phase 8: Save/Load project state

**Depends on:** Phase 7 green.

**Deliverables:**
- Session JSON schema.
- Main-process file dialog for save/load.
- Restore overrides and settings; re-run sampler.

**Exit criteria:**
- Round-trip: set overrides → Save → close app → Load → overrides restored.

**Requirement coverage:** F9, F9.1, F9.2.

**Plans:** 5 plans

Plans:
- [x] 08-01-PLAN.md — Wave 0 scaffolding: src/shared/types.ts extension (7 new types + 4 new SerializableError kinds + 8 new Api members) + 3 RED spec stubs (project-file.spec.ts, project-io.spec.ts, save-load.spec.tsx) + arch.spec.ts Phase 8 electron-import block. Wave 1, autonomous, depends_on [].
- [x] 08-02-PLAN.md — Pure-TS schema module (src/core/project-file.ts): validateProjectFile + migrate + serializeProjectFile + materializeProjectFile + relativizePath + absolutizePath. Drives tests/core/project-file.spec.ts GREEN. Layer 3 strict (only node:path import). Wave 2, autonomous, depends_on [01].
- [x] 08-03-PLAN.md — Main + preload glue: src/main/project-io.ts (5 async handlers, atomic-write idiom, loader/sampler chain, typed-error envelope) + src/main/ipc.ts (5 new IPC channels) + src/main/index.ts (before-quit dirty-guard with Pitfall-1 setTimeout deferral + macOS open-file scaffold) + src/preload/index.ts (7 new contextBridge methods). Drives tests/main/project-io.spec.ts GREEN. Wave 3, autonomous, depends_on [01, 02].
- [x] 08-04-PLAN.md — Renderer wiring: src/renderer/src/modals/SaveQuitDialog.tsx (hand-rolled ARIA 3-button modal cloning OverrideDialog) + src/renderer/src/components/AppShell.tsx (Save/Open toolbar buttons + state slots + dirty derive + Cmd/Ctrl+S+O listener + dirty-marker chip + SaveQuitDialog mount + locate-skeleton flow + stale-override banner) + src/renderer/src/components/DropZone.tsx (.json | .stmproj | reject extension branch). Drives tests/renderer/save-load.spec.tsx GREEN. Wave 4, autonomous, depends_on [01, 02, 03].
- [x] 08-05-PLAN.md — Close-out: automated exit-criteria sweep + populate 08-VALIDATION.md per-task map + 5 manual UAT gates (round-trip, .stmproj drag-drop, locate-skeleton, before-quit 3-button, atomic-write crash). Advance STATE.md + ROADMAP.md. Wave 5, has checkpoint, depends_on [01, 02, 03, 04]. ✅ 2026-04-26 — automated sweep `eb4883b` + close-out commit; manual UAT signed off 2026-04-26 (all 5 gates pass).

---

### Phase 08.1: Close Phase 8 verification gaps (locate-skeleton recovery reachability + new-skeleton dirty-guard) (INSERTED)

**Goal:** Close the 3 reachability gaps from Phase 8 verification (VR-01 .stmproj-drop recovery routing; VR-02 toolbar Open empty-recovery-state; VR-03 onBeforeDrop dirty-guard wiring) so /gsd-verify-work 8 passes cleanly. No feature growth; no Phase 9 scope creep.
**Requirements**: VR-01, VR-02, VR-03 (informal — back to F9.2 / D-143 / D-149 in 08-VERIFICATION.md)
**Depends on:** Phase 8
**Plans:** 6 plans

Plans:
- [x] 08.1-01-PLAN.md — Wave 0 scaffolding: SerializableError discriminated-union refactor in src/shared/types.ts (D-158, D-171) + RED test scaffolds (8.1-VR-01, 8.1-VR-02, 8.1-VR-03a, 8.1-VR-03b in tests/renderer/save-load.spec.tsx; 8.1-IPC-01 in tests/main/project-io.spec.ts). Wave 1, autonomous, depends_on []. ✅ 2026-04-26 — commits `765c2a4` (refactor: types union) + `a40fffc` (test: 8.1-IPC-01 RED) + `d756dd9` (test: 4 RED renderer specs); 1 deviation (Rule 1 grep-literal hygiene); 270 passed + 5 RED + 1 todo + 1 skipped (was 270/0/3/1); locked-file diffs clean. SUMMARY: `08.1-01-SUMMARY.md`.
- [ ] 08.1-02-PLAN.md — Main-side wire: handleProjectOpenFromPath threads 7 recovery fields at the SkeletonJsonNotFoundError rescue (D-159). Drives 8.1-IPC-01 GREEN. Wave 2, autonomous, depends_on [08.1-01].
- [ ] 08.1-03-PLAN.md — Renderer-side wire: AppShell.onClickOpen reads threaded fields from typed envelope (D-160); "best-effort" comment block deleted. Drives 8.1-VR-02 GREEN. Wave 3, autonomous, depends_on [08.1-01, 08.1-02].
- [ ] 08.1-04-PLAN.md — App.tsx projectLoadFailed AppState variant + recovery banner (D-161, D-162); handleLocateSkeleton + handleDismissProjectLoadFailed callbacks. Drives 8.1-VR-01 GREEN. Wave 3, autonomous, depends_on [08.1-01, 08.1-02].
- [ ] 08.1-05-PLAN.md — VR-03 fix: useRef callback bridge (App.tsx) + onBeforeDropRef prop + useEffect registration (AppShell.tsx) + cancelAction extension to saveQuitDialogState + SaveQuitDialog.onCancel invocation (D-163, D-164). DropZone.tsx and SaveQuitDialog.tsx untouched (D-165). Drives 8.1-VR-03a + 8.1-VR-03b GREEN. Wave 4, autonomous, depends_on [08.1-01, 08.1-04].
- [ ] 08.1-06-PLAN.md — Close-out: automated exit-criteria sweep + 08.1-VALIDATION.md per-plan map + 3-reproducer manual UAT + ROADMAP.md plan-checkbox flips + STATE.md advance. Wave 5, has checkpoint, depends_on [08.1-01..05].
## Phase 9: Complex-rig hardening + polish

**Depends on:** Phase 8 green and user-supplied complex rig.

**Deliverables:**
- UI virtualization for long tables.
- Sampler worker thread if profiling shows main-thread jank.
- Sampling-rate setting in a Settings modal.
- Rig-info tooltip showing the JSON's `skeleton.fps` (metadata-only, clearly labeled as non-authoritative).
- Documentation button wired to an in-app help view.

**Exit criteria:**
- Complex rig samples in <10 s.
- No dropped UI frames during sampling on the complex rig.

**Requirement coverage:** N2.2, usability polish.

---

## Deferred (post-MVP)

- Adaptive bisection refinement around candidate peaks (for pathological easing curves).
- `.skel` binary loader support.
- Spine 5+ loader adapter.
- Aspect-ratio anomaly flag (when `scaleX != scaleY` at peak).
- In-app atlas re-packing (writing a new `.atlas` file).
