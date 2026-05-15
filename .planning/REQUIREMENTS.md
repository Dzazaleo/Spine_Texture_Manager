# Requirements: Spine Texture Manager v1.5.1 — Spine Animation Viewer

**Defined:** 2026-05-15
**Core Value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

**Milestone goal:** Close the optimize → pack → validate loop by adding an in-app Spine animation viewer so animators can confirm their exported `.atlas` + page PNG(s) render correctly without round-tripping through the Spine editor.

**Source seed:** [.planning/seeds/SEED-009-spine-animation-viewer.md](seeds/SEED-009-spine-animation-viewer.md)

---

## v1.5.1 Requirements

Active scope for this milestone. Each maps to exactly one phase.

### Viewer Integration

- [x] **VIEWER-01**: spine-player runtime is installed and importable from the renderer (npm dependency vs vendored copy resolved at `/gsd-discuss-phase` per SEED-009 D-01).
- [x] **VIEWER-02**: A React component wraps `spine-player` and mounts/unmounts cleanly inside an Electron renderer window, surviving HMR in dev and project-change in production.
- [x] **VIEWER-03**: The viewer consumes the currently-open project's skeleton JSON, atlas, and page PNG(s) (asset feed routing — source dir vs post-export output dir vs user-selectable — resolved at `/gsd-discuss-phase` per SEED-009 D-04).

### Viewer UX

- [x] **VIEWER-04**: The viewer is reachable from the main UI (toolbar button vs tab vs both resolved at `/gsd-discuss-phase` per SEED-009 D-03). Opening it shows the user's character animated and playing back.
- [x] **VIEWER-05**: User can switch animations from the available list and switch skins from the available list while the viewer is open; the playback updates immediately on selection.
- [x] **VIEWER-06**: User can play, pause, and scrub the active animation. Default behavior on open: play first animation, loop on.

### Viewer Lifecycle

- [x] **VIEWER-08**: The viewer disposes its GL context and frees memory on close; re-opening after closing works without leaking; switching to a different project closes the prior viewer instance.
- [x] **VIEWER-09**: When the project is malformed, the atlas is missing, or page PNGs are missing/unreadable, the viewer surfaces a clear in-modal error state (verbatim copy resolved during phase planning) instead of a blank canvas, browser console error, or hard crash.

**Atlas-less mode note:** v1.5.1 viewer must work in BOTH `atlas-source` and `atlas-less` loaderModes (per `project_strict_loadermode_separation`). The atlas-less synthetic-atlas path from Phase 21 already produces the data spine-player needs; VIEWER-03 covers wiring both feeds.

---

## Future Requirements

Tracked but not in v1.5.1 roadmap. May ship in v1.5.2 / v1.6 / later.

### Viewer Comparison Mode

- **VIEWER-07**: User can view source skeleton and exported (post-Optimize / post-Repack) skeleton side-by-side in the viewer for visual diff. Conditional on SEED-009 D-02 resolving to option B (split-pane) or option C (third tab); if D-02 picks option A (standalone modal), this requirement remains deferred indefinitely.

### Carry-Forward From Prior Milestones

These items were explicitly deferred during v1.5 close and remain queued for v1.5.2 / v1.6+:

- **POLISH-WR-03**: `SkeletonNotFoundOnLoadError` envelope drops 4 atlas fields on locate-skeleton-twice recovery (`src/shared/types.ts:880-917` + `src/main/project-io.ts:936-961`)
- **POLISH-WR-04**: AppShell does not thread atlas fields into `ResampleArgs` payload — main-side coerce is dead code on happy path (`src/renderer/src/components/AppShell.tsx:1295-1322` + `:1760-1794`)
- **POLISH-WR-05**: `writtenPaths` rollback lacks defense-in-depth outDir-containment check (`src/main/ipc.ts:974-976`)
- **POLISH-WR-07**: `regionBuffers.get(r.regionName)!` non-null assertion in composite layers (`src/main/repack-worker.ts:347-351`)
- **POLISH-IN-01**: Duplicate `pageFilename` helper in `atlas-paths.ts` AND `atlas-writer.ts` (drift risk)
- **POLISH-IN-02**: `regionBuffers` Map never `.clear()`'d after page composite (memory pressure on 100+ MB atlases)
- **POLISH-IN-03**: `deriveProjectName` generic error message when basename contains `:` (UX nit)
- **POLISH-IN-04**: Duplicate-outPath warning emits `status:'success'` progress event (masks D-108 regression upstream)
- **PORT-01..04**: Full Spine 4.3 runtime port (gated on `@esotericsoftware/spine-core@4.3.x` npm publish per SEED-006)

---

## Out of Scope

Explicitly excluded from v1.5.1 to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Hand-rolled Spine renderer (in place of spine-player) | SEED-009 design fact #1 — we are not in the business of writing a Spine runtime; the player is the reference implementation and free. |
| Replacing AtlasPreviewModal with the viewer | SEED-009 design fact #4 — AtlasPreviewModal shows static atlas layout; the viewer shows animation playback. Different jobs, both stay. |
| Edit operations from the viewer (override changes, skin authoring, etc.) | SEED-009 design fact #3 — viewer is read-only validation surface, not an authoring surface. |
| Animation editing / timeline scrubbing beyond play/pause/scrub | SEED-009 scope — Spine editor remains the source-of-truth authoring tool. |
| Cross-mode override copy/sync via the viewer | Rejected at SEED-007 capture per `project_strict_loadermode_separation` — atlas-source and atlas-less buckets are deliberately self-contained. |
| Linux build/UAT for the viewer | v1.3 dropped Linux from CI/release per `project_linux_deferred` memory. Viewer ships macOS + Windows only. |
| Pre-v1.5.1 polish items (POLISH-WR-03/04/05/07 + POLISH-IN-01..04) | User chose viewer-only framing at `/gsd-new-milestone v1.5.1`. Deferred to v1.5.2 / v1.6. |

---

## Open Decisions (resolved during `/gsd-discuss-phase`)

These influence the shape of VIEWER-01, 03, 04 but do not change the requirement count:

- **D-01:** npm dep (`npm install @esotericsoftware/spine-player`) vs vendored copy of `spine-player.js` (matches Python reference at `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/spine-player.js`).
- **D-02:** Standalone `AnimationPlayerModal.tsx` vs split-pane source-vs-exported comparison vs third tab. v1.5.1 baseline = standalone modal; B/C unlock VIEWER-07 (Future).
- **D-03:** Mount location — toolbar button next to "Atlas Preview" / "Optimize Assets" (right cluster `AppShell.tsx:2087-2090`), tab alongside Global / Animation Breakdown (`AppShell.tsx:5-9`), or both.
- **D-04:** Asset feed — always source project, always post-export output dir, or user-selectable via radio.

---

## Traceability

Populated by `gsd-roadmapper` during roadmap creation 2026-05-15.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIEWER-01 | Phase 41 | Complete |
| VIEWER-02 | Phase 41 | Complete |
| VIEWER-03 | Phase 41 | Complete |
| VIEWER-04 | Phase 41 | Complete |
| VIEWER-05 | Phase 41 | Complete |
| VIEWER-06 | Phase 41 | Complete |
| VIEWER-08 | Phase 41 | Complete |
| VIEWER-09 | Phase 41 | Complete |

**Coverage:**
- v1.5.1 requirements: 8 total (VIEWER-01..06, VIEWER-08, VIEWER-09 — VIEWER-07 is Future)
- Mapped to phases: 8 ✓
- Unmapped: 0 ✓

---

*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15 — v1.5.1 roadmap created (single phase: Phase 41 — Spine Animation Viewer; all 8 active VIEWER reqs mapped). VIEWER-07 + POLISH-* + PORT-* remain Future, unchanged.*
