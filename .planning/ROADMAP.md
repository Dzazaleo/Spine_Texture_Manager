# Roadmap — Milestone 1 (MVP)

Goal: **ship a desktop app that reliably computes per-attachment peak render scale and exports a per-asset-optimized `images/` folder.** Derisk the core math first (Phase 0), then build the UI on top of proven primitives.

Each phase produces an atomic, testable increment. Do not proceed to the next phase until the current phase's exit criteria are green.

---

## Phase 0 — Core-math spike (derisk)

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
- [ ] 00-03-PLAN.md — Per-attachment AABB + scale math (`src/core/bounds.ts`) — pure, zero I/O.
- [ ] 00-04-PLAN.md — Sampler with locked tick lifecycle (`src/core/sampler.ts`) — 120 Hz default, Physics.reset + Physics.update.
- [ ] 00-05-PLAN.md — Vitest golden suite covering N1.1–N1.6 correctness, N2.1 <500 ms perf gate, N2.3 FS-free hot loop.
- [ ] 00-06-PLAN.md — CLI entrypoint (`scripts/cli.ts`) — renders peak table + elapsed footer.
- [ ] 00-07-PLAN.md — Exit-criteria sweep + human-verify checkpoint → advance STATE.md to Phase 0 COMPLETE.

---

## Phase 1 — Electron + React scaffold with JSON drop-load

**Depends on:** Phase 0 green.

**Deliverables:**
- `electron.vite.config.ts`, `src/main/`, `src/preload/`, `src/renderer/` scaffolding.
- Drag-drop zone that accepts a `.json` file, reads atlas/images siblings, calls `core/loader.ts`, dumps the skeleton summary (bones, slots, attachments, skins, animations) to the console and to a debug panel.
- Tailwind CSS configured with the dark-neutral aesthetic matching the screenshots.

**Exit criteria:**
- Dragging `SIMPLE_TEST.json` into the window renders a debug dump matching the CLI's Phase 0 output.
- App builds into a `.dmg` on macOS.

**Requirement coverage:** F1 (integrated), N4.

---

## Phase 2 — Global Max Render Source panel

**Depends on:** Phase 1 green.

**Deliverables:**
- `src/core/analyzer.ts` folds sampler output → `{ attachment, sourceSize, peakSize, peakScale, sourceAnimation, sourceFrame, sourceSkin }`.
- `src/renderer/panels/GlobalMaxRenderPanel.tsx` — sortable table per screenshot 1.
- `src/renderer/components/SearchBar.tsx` — filters by attachment name.

**Exit criteria:**
- Loading `SIMPLE_TEST.json` produces a table with correct source/peak/scale/source-animation for every attachment.
- Search filter correctly hides/shows rows.

**Requirement coverage:** F3.

---

## Phase 3 — Animation Breakdown panel

**Depends on:** Phase 2 green.

**Deliverables:**
- `src/renderer/panels/AnimationBreakdownPanel.tsx` per screenshot 3 — collapsible per-animation cards, Bone Path rendered, per-row override button.
- "Setup Pose (Default)" top card.
- "No assets referenced" state for animations with zero attachment activity.

**Exit criteria:**
- Every animation in `SIMPLE_TEST.json` renders its own card with correct asset list and scale math.
- Animations with no attachment activity render the empty state.

**Requirement coverage:** F4.

---

## Phase 4 — Scale overrides

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

---

## Phase 5 — Unused attachment detection

**Depends on:** Phase 4 green.

**Deliverables:**
- Analyzer flag: for each attachment, was it ever active in any slot in any animation? Default setup-pose visibility counts as "used."
- UI: dedicated section on the Global panel listing unused attachments with a visual warning.

**Exit criteria:**
- Add a throwaway attachment to a test skin never referenced by any animation → app flags it.

**Requirement coverage:** F6.

---

## Phase 6 — Optimize Assets (image export)

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

## Phase 7 — Atlas Preview modal

**Depends on:** Phase 6 green.

**Deliverables:**
- `src/renderer/modals/AtlasPreviewModal.tsx` — before/after atlas using `maxrects-packer`.
- Dimension + estimated size readout.

**Exit criteria:**
- Preview shows meaningful reduction on the simple rig.
- Projected packed atlas dims roughly match sum of peak+override dims plus packer padding.

**Requirement coverage:** F7.

---

## Phase 8 — Save/Load project state

**Depends on:** Phase 7 green.

**Deliverables:**
- Session JSON schema.
- Main-process file dialog for save/load.
- Restore overrides and settings; re-run sampler.

**Exit criteria:**
- Round-trip: set overrides → Save → close app → Load → overrides restored.

**Requirement coverage:** F9.

---

## Phase 9 — Complex-rig hardening + polish

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
