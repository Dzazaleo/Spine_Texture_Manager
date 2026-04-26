# Roadmap: Spine Texture Manager

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 (shipped 2026-04-26) — full archive at [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–9, plus 08.1 + 08.2 inserted) — SHIPPED 2026-04-26</summary>

- [x] Phase 0: Core-math spike — derisk pure-TS sampler against `fixtures/SIMPLE_PROJECT` (7/7 plans) — completed 2026-04-23
- [x] Phase 1: Electron + React scaffold with JSON drop-load (5/5 plans) — completed 2026-04-23
- [x] Phase 2: Global Max Render Source panel (3/3 plans) — completed 2026-04-23
- [x] Phase 3: Animation Breakdown panel (3/3 plans) — completed 2026-04-23
- [x] Phase 4: Scale overrides (3/3 plans, D-91 source-fraction semantics) — completed 2026-04-24
- [x] Phase 5: Unused attachment detection (4/4 plans) — completed 2026-04-24
- [x] Phase 6: Optimize Assets — sharp Lanczos3 image export (7/7 plans) — completed 2026-04-25
- [x] Phase 7: Atlas Preview modal — maxrects-packer + canvas (6/6 plans) — completed 2026-04-25
- [x] Phase 8: Save/Load project state — `.stmproj` v1 schema (5/5 plans) — completed 2026-04-26
- [x] Phase 08.1: Close Phase 8 verification gaps — locate-skeleton recovery + dirty-guard wiring (6/6 plans, INSERTED) — completed 2026-04-26
- [x] Phase 08.2: File menu + Cmd+O accelerator gating fix (5/5 plans, INSERTED) — completed 2026-04-26
- [x] Phase 9: Complex-rig hardening + polish — `worker_threads` sampler, TanStack Virtual at N≥100, Settings + Help dialogs (8/8 plans, N2.2 wall-time 606 ms on `fixtures/Girl/`) — completed 2026-04-26

</details>

### 🚧 v1.1 (To be planned)

Use `/gsd-new-milestone` to define the next milestone scope. See `.planning/PROJECT.md` → "Next Milestone Goals" for likely candidates (distribution / atlas-less mode / Spine 4.3+ adapters / scale-overshoot RC fix).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Core-math spike | v1.0 | 7/7 | Complete | 2026-04-23 |
| 1. Electron + React scaffold | v1.0 | 5/5 | Complete | 2026-04-23 |
| 2. Global Max Render Source panel | v1.0 | 3/3 | Complete | 2026-04-23 |
| 3. Animation Breakdown panel | v1.0 | 3/3 | Complete | 2026-04-23 |
| 4. Scale overrides | v1.0 | 3/3 | Complete | 2026-04-24 |
| 5. Unused attachment detection | v1.0 | 4/4 | Complete | 2026-04-24 |
| 6. Optimize Assets (image export) | v1.0 | 7/7 | Complete | 2026-04-25 |
| 7. Atlas Preview modal | v1.0 | 6/6 | Complete | 2026-04-25 |
| 8. Save/Load project state | v1.0 | 5/5 | Complete | 2026-04-26 |
| 08.1. Phase 8 verification gaps | v1.0 | 6/6 | Complete (INSERTED) | 2026-04-26 |
| 08.2. File menu + Cmd+O fix | v1.0 | 5/5 | Complete (INSERTED) | 2026-04-26 |
| 9. Complex-rig hardening + polish | v1.0 | 8/8 | Complete | 2026-04-26 |

## Deferred (post-MVP)

- Adaptive bisection refinement around candidate peaks (for pathological easing curves).
- `.skel` binary loader support.
- Spine 5+ loader adapter.
- Aspect-ratio anomaly flag (when `scaleX != scaleY` at peak).
- In-app atlas re-packing (writing a new `.atlas` file).
