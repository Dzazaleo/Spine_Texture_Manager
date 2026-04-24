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
- [ ] 04-02-PLAN.md — AppShell extension (overrides Map + dialogState + three callbacks) + new src/renderer/src/modals/OverrideDialog.tsx (hand-rolled ARIA modal with integer input, silent clamp on Apply, Reset/Cancel/Apply buttons, ESC + overlay + focus management) + panel Props-interface extensions (optional overrides + onOpenOverrideDialog). Wave 2, autonomous, depends on 04-01.
- [ ] 04-03-PLAN.md — Panel wiring: Scale + Peak W×H override badges on both GlobalMaxRenderPanel (with batch mode via selection + effective-scale sort comparator) and AnimationBreakdownPanel (per-row only, unlocked D-69 Override Scale button, kept chip styling). Closes pattern-mapper flags 2 (event propagation) + 3 (sort comparator) + 4 (types.ts discretion option A). Includes primary Phase 4 STRIDE threat model. Wave 3, has human-verify checkpoint, depends on 04-01 + 04-02.


---

## Phase 5: Unused attachment detection

**Depends on:** Phase 4 green.

**Deliverables:**
- Analyzer flag: for each attachment, was it ever active in any slot in any animation? Default setup-pose visibility counts as "used."
- UI: dedicated section on the Global panel listing unused attachments with a visual warning.

**Exit criteria:**
- Add a throwaway attachment to a test skin never referenced by any animation → app flags it.

**Requirement coverage:** F6.

---

## Phase 6: Optimize Assets (image export)

**Depends on:** Phase 5 green.

**Deliverables:**
- `src/core/export.ts` — build export plan from peaks + overrides.
- `src/main/image-worker.ts` — sharp Lanczos3 resize per asset.
- `src/renderer/modals/OptimizeDialog.tsx` — folder picker + progress UI.
- IPC wiring for progress events.

**Exit criteria:**
- Exported `<out>/images/CIRCLE.png` matches target dims exactly.
- Visual spot-check vs manual Photoshop Lanczos shows no perceptible difference.
- Original files untouched.

**Requirement coverage:** F8, N3.

---

## Phase 7: Atlas Preview modal

**Depends on:** Phase 6 green.

**Deliverables:**
- `src/renderer/modals/AtlasPreviewModal.tsx` — before/after atlas using `maxrects-packer`.
- Dimension + estimated size readout.

**Exit criteria:**
- Preview shows meaningful reduction on the simple rig.
- Projected packed atlas dims roughly match sum of peak+override dims plus packer padding.

**Requirement coverage:** F7.

---

## Phase 8: Save/Load project state

**Depends on:** Phase 7 green.

**Deliverables:**
- Session JSON schema.
- Main-process file dialog for save/load.
- Restore overrides and settings; re-run sampler.

**Exit criteria:**
- Round-trip: set overrides → Save → close app → Load → overrides restored.

**Requirement coverage:** F9.

---

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
