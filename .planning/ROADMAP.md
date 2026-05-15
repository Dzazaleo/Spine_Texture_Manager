# Roadmap: Spine Texture Manager

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 + 08.1 + 08.2 (shipped 2026-04-26) — archive at [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1.x Distribution & Hardening** — Phases 10–15 (shipped 2026-04-29)
- ✅ **v1.2 Expansion** — Phases 16–22.1 (shipped 2026-05-03) — archive at [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Polish & UX** — Phases 23–28 (shipped 2026-05-07) — archive at [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ✅ **v1.3.1 Correctness & Refinements** — Phases 29–31 (shipped 2026-05-09) — archive at [milestones/v1.3.1-ROADMAP.md](milestones/v1.3.1-ROADMAP.md)
- ✅ **v1.4 Spine 4.3 Forward-Compat + Rotated Atlases** — Phases 32–35 (shipped 2026-05-12) — archive at [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)
- ✅ **v1.5 Override Routing + Coverage Hardening + Atlas Repack** — Phases 36–40 (shipped 2026-05-15) — archive at [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)
- 🟢 **v1.5.1 Spine Animation Viewer** — Phase 41 (in progress, started 2026-05-15)
- 📋 **v1.6 (TBD)** — define with `/gsd-new-milestone`

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–9 + 08.1 + 08.2) — SHIPPED 2026-04-26</summary>

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.1.x Distribution & Hardening (Phases 10–15) — SHIPPED 2026-04-29</summary>

Phases 10–15. See `.planning/MILESTONES.md` for v1.1 / v1.1.1 / v1.1.2 / v1.1.3 entries.

</details>

<details>
<summary>✅ v1.2 Expansion (Phases 16–22.1) — SHIPPED 2026-05-03</summary>

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.3 Polish & UX (Phases 23–28) — SHIPPED 2026-05-07</summary>

See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.3.1 Correctness & Refinements (Phases 29–31) — SHIPPED 2026-05-09</summary>

See [milestones/v1.3.1-ROADMAP.md](milestones/v1.3.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.4 Spine 4.3 Forward-Compat + Rotated Atlases (Phases 32–35) — SHIPPED 2026-05-12</summary>

See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.5 Override Routing + Coverage Hardening + Atlas Repack (Phases 36–40) — SHIPPED 2026-05-15</summary>

- [x] Phase 36: Split Overrides Per Loader Mode (5/5 plans) — completed 2026-05-13
- [x] Phase 37: Spine 4.2 Timeline Coverage Hardening (3/3 plans) — completed 2026-05-13
- [x] Phase 38: Phase 4 Code-Review Polish Pass (3/3 plans) — completed 2026-05-13
- [x] Phase 39: Windows Host-Blocked UAT Burndown (3/3 plans) — completed 2026-05-13
- [x] Phase 40: Atlas Repack Output (9/9 plans) — completed 2026-05-15

See [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) for full phase details.

</details>

### 🟢 v1.5.1 Spine Animation Viewer (Phase 41)

- [ ] **Phase 41: Spine Animation Viewer** — In-app read-only Spine animation player wrapping Esoteric's `spine-player`, validates exported atlases without round-tripping through the Spine editor

## Phase Details

### Phase 41: Spine Animation Viewer

**Goal**: Animators can open an in-app viewer and watch their character animated from the currently-open project's assets, switch animations and skins live, control playback (play / pause / scrub), and trust the viewer to behave cleanly across project changes and asset-error conditions — closing the optimize → pack → validate loop without round-tripping through the Spine editor.

**Depends on**: v1.5 milestone shipped (atlas-repack-output landed in Phase 40; viewer is the validation surface for that artifact). No intra-milestone phase dependency — v1.5.1 contains a single phase.

**Requirements**: VIEWER-01, VIEWER-02, VIEWER-03, VIEWER-04, VIEWER-05, VIEWER-06, VIEWER-08, VIEWER-09 (8 active reqs; VIEWER-07 is Future, gated on SEED-009 D-02 picking option B or C)

**Success Criteria** (what must be TRUE when this phase completes):

1. **The user can open the viewer from the main UI and immediately see their character animated.** From the currently-open project, the user invokes the viewer (mount point per SEED-009 D-03 — toolbar button / tab / both — resolved during `/gsd-discuss-phase`). The viewer mounts cleanly inside the Electron renderer, loads the project's skeleton JSON + atlas + page PNG(s), and plays back the first animation with loop on by default. *(VIEWER-01, VIEWER-02, VIEWER-03, VIEWER-04, VIEWER-06)*
2. **The user can switch animations and skins live from within the viewer, and playback updates on selection.** Available animations and skins are populated from the loaded skeleton; selecting a different animation or skin updates the active playback without requiring a close/reopen cycle. *(VIEWER-05)*
3. **The user can control playback with play, pause, and scrub.** A scrub control allows seeking within the active animation; play/pause toggles the timeline; default behavior on open is play + loop on. *(VIEWER-06)*
4. **The viewer works in both atlas-source and atlas-less loaderModes.** A project loaded with `.json + .atlas + page PNG(s)` and a project loaded with `.json + images/ folder` (synthetic-atlas path from Phase 21) both feed the viewer correctly, with no cross-mode bleed and no second mode-specific code path the user has to think about. *(VIEWER-03 — loaderMode-agnostic asset feed; respects `project_strict_loadermode_separation`.)*
5. **The viewer disposes cleanly on close, survives re-open and project-change without leaking, and surfaces clear in-modal error states for malformed or missing assets.** Closing the viewer releases its GL context and frees memory; reopening works without residual state; switching to a different project closes any prior viewer instance. When the project is malformed, the atlas is missing, or page PNGs are unreadable, the viewer renders a verbatim in-modal error state (final copy resolved during phase planning) instead of a blank canvas, an unhandled DevTools error, or a hard crash. *(VIEWER-08, VIEWER-09)*

**Plans**: 3 plans (2 waves)

- [ ] `41-01-PLAN.md` — Foundation: install spine-player@4.2.111 dep + viewer:get-asset-feed IPC for atlas-less branch (Wave 1, autonomous)
- [ ] `41-02-PLAN.md` — AnimationPlayerModal component: mount/dispose, asset feed, animation+skin switching, play/pause/scrub transport, terminal error overlay (Wave 2, depends on 41-01, autonomous)
- [ ] `41-03-PLAN.md` — AppShell wiring: toolbar button, state slot, JSX mount, modalOpen derivation, project-change cleanup (Wave 2, depends on 41-01, autonomous, parallel with 41-02)
**UI hint**: yes

**Open decisions deferred to `/gsd-discuss-phase 41`** (do not relitigate during roadmap):

- D-01 — npm dep (`npm install @esotericsoftware/spine-player`) vs vendored copy of `spine-player.js`
- D-02 — standalone modal vs split-pane comparison vs third tab (v1.5.1 baseline = standalone modal; B/C unlock VIEWER-07 which is Future)
- D-03 — mount location (toolbar button next to "Atlas Preview" / "Optimize Assets", or tab alongside Global / Animation Breakdown, or both)
- D-04 — asset feed (always source project, always post-export output dir, or user-selectable via radio)

**Locked design facts (from SEED-009 — do not relitigate):**

1. Use Esoteric's official `@esotericsoftware/spine-player` library — no hand-rolled renderer.
2. `spine-player` is a sibling package to the already-installed `spine-core`; both coexist.
3. The viewer is read-only — validation surface, not authoring.
4. The viewer does NOT replace `AtlasPreviewModal` (static atlas layout vs animation playback — different jobs, both stay).

## Progress

| Phase | Milestone | Plans Complete | Status      | Completed  |
| ----- | --------- | -------------- | ----------- | ---------- |
| 36    | v1.5      | 5/5            | Complete    | 2026-05-13 |
| 37    | v1.5      | 3/3            | Complete    | 2026-05-13 |
| 38    | v1.5      | 3/3            | Complete    | 2026-05-13 |
| 39    | v1.5      | 3/3            | Complete    | 2026-05-13 |
| 40    | v1.5      | 9/9            | Complete    | 2026-05-15 |
| 41    | v1.5.1    | 1/3 | In Progress|  |

(Phases 0–35 are collapsed under their respective milestones above. Per-phase details live in each milestone's archive.)

---

*ROADMAP.md is authored fresh at each milestone start. v1.5 ROADMAP archived at [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md). v1.0–v1.5 phase directories preserved at `.planning/phases/36-..40-*/` per user choice at v1.5 close. v1.5.1 continues numbering from Phase 41 (no `--reset-phase-numbers`).*
