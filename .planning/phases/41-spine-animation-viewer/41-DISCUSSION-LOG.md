# Phase 41: Spine Animation Viewer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 41-spine-animation-viewer
**Areas discussed:** D-02 Viewer UI shape, D-03 Mount location, D-04 Asset feed routing
**Areas delegated to Claude:** D-01 Dependency mode

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| D-01 Dependency mode | npm install @esotericsoftware/spine-player vs. vendor spine-player.js into src/renderer/src/vendor/ | |
| D-02 Viewer UI shape | Standalone modal vs. split-pane comparison vs. third tab | ✓ |
| D-03 Mount location | Toolbar button vs. tab vs. both | ✓ |
| D-04 Asset feed routing | Source vs. post-export vs. user-selectable | ✓ |

**Notes:** User skipped D-01 — delegated to Claude per [[feedback_delegate_implementation_choices]]. Claude defaulted D-01 to npm install per PROJECT.md / SEED-009 Notes ("npm is the natural default for an Electron renderer"); vendoring rationale only applied to the Python+WebView sandbox which doesn't exist here.

---

## D-02 Viewer UI shape

### Q1: Which UI shape for the viewer in v1.5.1?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone modal | AnimationPlayerModal.tsx, sibling to AtlasPreviewModal. Reuses locked 5-modal ARIA scaffold. Matches REQUIREMENTS.md baseline. VIEWER-07 stays Future. | ✓ |
| Split-pane comparison | Two side-by-side player canvases (source + exported). Unlocks VIEWER-07 implicitly — contradicts viewer-only milestone scope. | |
| Third tab in sub-toolbar | Replaces 2-tab variant-A pattern (Phase 26.2 sketch-001 locked); inline panel contradicts standalone-modal framing. | |

**User's choice:** Standalone modal (Recommended)
**Notes:** Locks VIEWER-07 (split-pane source-vs-exported) as Future. Aligns with REQUIREMENTS.md baseline and v1.5.1 viewer-only scope.

### Q2: Modal sizing

| Option | Description | Selected |
|--------|-------------|----------|
| Large near-fullscreen | Mirrors AtlasPreviewModal sizing. Canvas room for complex rigs (Girl, Jokerman). Matches existing visual-surface precedent. | ✓ |
| Compact fixed | OverrideDialog-style (e.g., 800×600). Complex rig wouldn't fit at 1:1. | |
| Responsive percentage | Sized as % of viewport. Adds DPR-handling complexity for the WebGL canvas. | |

**User's choice:** Large near-fullscreen (Recommended)
**Notes:** Final viewport-% / fixed-px lock is planner discretion; visual reference is AtlasPreviewModal.

### Q3: Animation + skin selector layout

| Option | Description | Selected |
|--------|-------------|----------|
| Top control bar | Animation dropdown + Skin dropdown + transport in a single horizontal bar above canvas. Matches Python reference at spine-skin-swap/viewer.js. | ✓ |
| Sidebar list | Left sidebar with animation list + skin list (clickable rows), canvas on the right. Takes ~20% width from the canvas. | |
| Bottom overlay strip | Auto-hides after mouse-idle (video-player style). Maximizes canvas real estate; auto-hide may surprise animators. | |

**User's choice:** Top control bar (Recommended)
**Notes:** Locks left-to-right order `[Animation ▾] [Skin ▾] [⏵ ⏸] [scrub]`. Final iconography in UI-phase.

### Q4: Canvas background

| Option | Description | Selected |
|--------|-------------|----------|
| App panel surface | `#232732` token, matches AtlasPreviewModal canvas bg. Consistent with the rest of the app. | ✓ |
| Checkerboard transparency | Photoshop-style checker pattern. Helps spot edge-bleed / fringing. Adds a checker draw call. | |
| User toggle solid + checker | Segmented toggle in the top control bar. Adds one extra control. | |

**User's choice:** App panel surface (Recommended)
**Notes:** No bg toggle in v1.5.1. Future polish phase could add a checker toggle if an edge-bleed validation use case emerges.

---

## D-03 Mount location

### Q1: Mount surface

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar button | Right-aligned cluster at AppShell.tsx:2087-2090. Mirrors AtlasPreviewModal invocation. | ✓ |
| Third tab in sub-toolbar | Conflicts with locked 2-tab variant-A pattern; tab implies inline panel contradicting D-02. | |
| Both — button + tab | Doubles integration surface; out of v1.5.1 viewer-only scope. | |

**User's choice:** Toolbar button (Recommended)

### Q2: Cluster position

| Option | Description | Selected |
|--------|-------------|----------|
| Between Atlas Preview and Documentation | `SearchBar \| Atlas Preview \| Animation Viewer \| Documentation \| Optimize Assets`. Groups the two visual-validation surfaces adjacent. | ✓ |
| Immediately left of Atlas Preview | Animation comes before static layout. | |
| Immediately left of Optimize Assets | Reads as final validation step before exporting. | |

**User's choice:** Between Atlas Preview and Documentation (Recommended)

### Q3: Button label

| Option | Description | Selected |
|--------|-------------|----------|
| Animation Viewer | Noun-phrase, parallel structure with sibling labels (Atlas Preview / Documentation / Optimize Assets). Matches SEED-009 wording. | ✓ |
| Play Animation | Verb-phrase. Implies playback toggle. | |
| Preview Animation | Parallel to "Atlas Preview" but seed and roadmap use "Viewer". | |

**User's choice:** Animation Viewer (Recommended)

### Q4: Disabled state

| Option | Description | Selected |
|--------|-------------|----------|
| When no project loaded | `effectiveSummary.peaks.length === 0`. Mirrors Atlas Preview disable rule. Stays enabled during sampling + export. | ✓ |
| When no project loaded OR sampling in flight | Defensive against any race; player owns its own skeleton instance so no shared mutation. | |
| When no project loaded OR export in flight | Conservative against GPU pressure during sharp resize. | |

**User's choice:** When no project loaded (Recommended)

---

## D-04 Asset feed routing

### Q1: Which assets

| Option | Description | Selected |
|--------|-------------|----------|
| Always source project | Currently-open .json + on-disk atlas + page PNGs (or synthetic-atlas + images/ for atlas-less). Cheapest to wire; always available. | ✓ |
| Always post-export output dir | Validates the actual exported artifact (Phase 40 atlas). Requires user to export first; needs last-export bookkeeping. | |
| User-selectable via radio | Source ↔ Exported toggle inside the viewer. Maximum flexibility but largest surface. | |

**User's choice:** Always source project (Recommended)
**Notes:** Deferred the "validate exported artifact" use case to VIEWER-07 (Future).

### Q2: Atlas-less mode handling

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse synthetic-atlas path | Phase 21 in-memory TextureAtlas feeds spine-player directly. No new code paths; respects strict-loaderMode-separation. | ✓ |
| Materialize temp .atlas on disk | Mirror atlas-source inside the player. Adds disk-write + cleanup + a second composite codepath. | |
| Disable viewer in atlas-less mode | Breaks project_atlas_less_primary_workflow and VIEWER-03 (both modes required). | |

**User's choice:** Reuse synthetic-atlas path (Recommended)

### Q3: Default state on open

| Option | Description | Selected |
|--------|-------------|----------|
| First animation, first skin | `skeleton.data.animations[0]` + first skin. Matches REQUIREMENTS.md VIEWER-06. No persistence. | ✓ |
| Remember last selection per project | Persist as additive optional .stmproj fields. Schema surface grows. | |
| Remember last selection in-session only | React state at AppShell level; survives close/reopen but resets on project change. | |

**User's choice:** First animation, first skin (Recommended)

### Q4: Error state behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Terminal error — Close button only | Verbatim error copy + Close. User fixes file on disk and re-opens. Simplest mental model. | ✓ |
| Error + Retry button | Useful for transient errors. Adds retry state-machine. | |
| Error + "Open project files folder" helper | Electron shell.openPath. Adds platform-specific IPC. | |

**User's choice:** Terminal error — close button only (Recommended)
**Notes:** Final verbatim error copy resolved during `/gsd-plan-phase 41`. CONTEXT only locks the behavior (terminal + Close-only).

---

## Claude's Discretion

Documented in CONTEXT.md `<decisions>` under "Claude's Discretion". Summary:

- D-01a: spine-player npm dep classification (`dependencies` vs `peerDependencies`).
- Asset URL construction (existing `app-image://` scheme vs bare `file://` vs preload blob).
- `spine-player` exact API surface (constructor / web-component / factory).
- WebGL context teardown ordering.
- HMR resilience pattern (VIEWER-02).
- Project-change cleanup integration point (VIEWER-08).
- Scrub control: native `<input type="range">` vs custom.
- Animation + skin `<select>` styling (native vs custom).
- Final verbatim error copy (VIEWER-09) — planner-finalized.

## Deferred Ideas

Documented in CONTEXT.md `<deferred>`. Summary:

- VIEWER-07 split-pane source-vs-exported (Future).
- Checkerboard / solid bg toggle.
- Animation + skin selection persistence.
- Retry button + "Open project files folder" helper on error state.
- Third tab in sub-toolbar mount.
- Post-export asset-feed routing.
- Project-level "preview last export" affordance (v1.5.2 / v1.6 candidate).

---

*Discussion logged 2026-05-15.*
