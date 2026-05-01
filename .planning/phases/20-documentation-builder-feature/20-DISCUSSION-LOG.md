# Phase 20: Documentation Builder feature - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 20-documentation-builder-feature
**Areas discussed:** documentation schema shape, Animation Tracks pane UX, Sections pane content model, HTML export template

---

## documentation schema shape

### Q1: Top-level field naming inside `documentation: {}` — which shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Flat keys, camelCase categories | `{ animationTracks: [...], events: [...], generalNotes: '', controlBones: [...], skins: [...] }` — 5 top-level keys mirroring the 5 success-criteria categories | ✓ |
| Nested under `sections` | `{ animationTracks: [...], sections: { events, generalNotes, controlBones, skins } }` — mirrors DOC-01 'three panes' | |
| Single `entries` array with `kind` discriminator | Fully discriminated; most extensible but flattens unrelated categories | |

**User's choice:** Flat keys, camelCase categories. Later extended with a 6th key `safetyBufferPercent: number` (per HTML export discussion D-22).

### Q2: id strategy for animation-track entries

| Option | Description | Selected |
|--------|-------------|----------|
| `id: string` via `crypto.randomUUID()` | Renderer-side at entry-create; stable across save/reload + reorders | ✓ |
| Index-based (no id field) | Identity is array position; reordering breaks future cross-references | |
| `animationName` as id | Use Spine animation name; blocks 'same animation on multiple tracks' | |

**User's choice:** `id: string` via `crypto.randomUUID()`.

### Q3: Required vs optional sub-fields on round-trip

| Option | Description | Selected |
|--------|-------------|----------|
| All keys always present, empty-default values | Missing key = `invalid-shape`; matches Phase 8 `overrides: {}` posture | ✓ |
| Optional keys, omit when empty | Smaller files when sparse; needs normalization for round-trip identity | |
| Backward-compat read accept `{}` write full shape | Asymmetric; matches forward-compat slot reality | |

**User's choice:** All 5 keys always present, empty-default values.

### Q4: Validator extension strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `validateProjectFile` with per-field hand-rolled guards | ~30-50 lines mirroring existing idiom; reuses `ProjectFileParseError` envelope | ✓ |
| New file `src/core/documentation.ts` + new error kind | Cleaner separation but adds 9th kind to discriminated-union | |
| Validate at modal-mount time only (renderer-side) | Silent-drop on malformed; violates DOC-05 round-trip safety | |

**User's choice:** Extend `validateProjectFile` with per-field hand-rolled guards. Note: implementation places type definitions + a `validateDocumentation` helper inside `src/core/documentation.ts` (called by `validateProjectFile`), so the validator function stays readable while honoring the single-validator boundary.

---

## Animation Tracks pane UX

### Q1: What does 'track' mean semantically?

| Option | Description | Selected |
|--------|-------------|----------|
| Spine mix-track index (0, 1, 2, ... auto-numbered) | Tracks correspond to Spine's runtime mix-track concept (base/overlay/additive) | ✓ |
| Arbitrary user-named tracks | User creates named tracks like 'Idle', 'Combat'; loses Spine runtime semantic | |
| Single flat list, no tracks | DOC-02's 'track container' is just one list; loses multi-track storytelling | |

**User's choice:** Spine mix-track index (0, 1, 2, ...).

### Q2: Drag-from-list mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| HTML5 native DnD | `draggable` + `onDragStart` + `dataTransfer`; first DnD pattern in repo | ✓ |
| Click-to-add | Animation in side-list is button; deviates from DOC-02 verbatim 'drag' | |
| Both — drag + click fallback | Native DnD + `+` button; satisfies a11y but more code surface | |

**User's choice:** HTML5 native DnD. Click-to-add fallback noted as deferred idea for a future a11y-polish phase.

### Q3: Reordering policy

| Option | Description | Selected |
|--------|-------------|----------|
| Within track via ↑/↓ buttons | Per-entry button pair swaps with neighbor; mouse + keyboard accessible | ✓ |
| Within and across tracks via drag | Entry itself draggable; doubles DnD surface area | |
| No reordering | Order = creation order; poor UX for non-trivial tracks | |

**User's choice:** Within a track only via ↑/↓ buttons.

### Q4: Same animation on multiple tracks / multiple times on same track

| Option | Description | Selected |
|--------|-------------|----------|
| Allowed everywhere, no warning | Each entry independent (own `id`); legitimate Spine pattern | ✓ |
| Allowed across tracks, blocked within a track | Blocks legitimate within-track sequencing | |
| Allowed with inline warning chip on duplicates | Adds UX surface for unclear-value warning | |

**User's choice:** Allowed everywhere, no warning.

---

## Sections pane content model

### Q1: Events sub-section content model

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-discovered from `skeletonData.events`, description per event | Names locked to skeleton; cleaner UX, no name-mismatch risk | ✓ |
| Freeform user-typed entries (name + description) | Allows orphaned entries / typos; invites drift | |
| Auto-discovered + freeform 'extra' entries | Two parallel data shapes; more flexible | |

**User's choice:** Auto-discovered with description per event. SkeletonSummary extended to expose `events: { count, names }` (mirrors bones/skins/animations).

### Q2: Control bones sub-section content model

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-list ALL bones, user opts-in per bone | Checkbox + description; only documented bones saved; needs filter input | ✓ |
| Freeform name+desc entries | Drift risk; loses auto-list affordance | |
| Auto-list ONLY IK / transform / path-constraint targets | Heuristic could miss user-considered control bones | |

**User's choice:** Auto-list ALL bones, user opts-in per bone with description. Filter input required for usability.

### Q3: Skins sub-section content model

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-list ALL skins, description per skin | Names locked to rig; all skins always saved | ✓ |
| Auto-list, omit empty descriptions on save | Smaller files; round-trip identity test fragile | |
| Freeform name+desc | Drift risk; skins are rig-defined, freeform makes no sense | |

**User's choice:** Auto-list ALL skins with description per skin.

### Q4: 3-pane modal composition

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs — one pane visible at a time | Reuses Phase 19 sticky-header tab-strip pattern | ✓ |
| Split columns — always visible side-by-side | Needs ~1280px wide minimum; compresses Sections pane | |
| Wizard steps — Next/Back through 3 steps | Forces linear flow on non-linear authoring | |

**User's choice:** Tabs — one pane visible at a time.

---

## HTML export template

### Q1: What does 'safety buffer' mean in DOC-04 snapshot?

User clarified (free-text response): "In my experiences with the old 3.8 version i discovered that sometimes textures exported at their max render scale displayed with less sharpness than others. And adding, for example, 3% more to the max render scale solved the problem. Its like a scale override applied globally to all textures, on top of what scale of what is already determined."

Three scope-honest paths were surfaced:

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 20 ships UI + persistence + snapshot ONLY (no export-math wiring) | `safetyBufferPercent: number` field; backlog 999.7 captures future export-math wiring | ✓ |
| Phase 20 ships full feature including export-math wiring | Scope creep into Phase 22 neighborhood; needs DOC-04 amendment | |
| Defer entirely; remove from DOC-04 snapshot | Needs REQUIREMENTS.md amendment to drop 'safety buffer' wording | |

**User's choice:** Option 1 — UI + persistence + snapshot only. Backlog 999.7 captures the future export-math wiring.

### Q2: HTML export styling

| Option | Description | Selected |
|--------|-------------|----------|
| Warm-stone theme match, dark surface | Matches app aesthetic; recommended | ✓ |
| Print-friendly black-on-white minimal | Optimized for paper; visually disconnected | |
| Both — dark for screen + `@media print` | Most flexible; more CSS surface | |

**User's choice:** Warm-stone theme match. User supplied a screenshot of CHJWC_SYMBOLS doc as the locked visual reference (2026-05-01).

### Q3: Image embedding policy

User's response (free-text): "Text and css icons. let me show you a screenshot."

User then provided the CHJWC_SYMBOLS screenshot. Resolved interpretation: zero `<img>` tags, zero base64. Icons via inline SVG using the Phase 19 D-08 pattern (`viewBox` + `stroke="currentColor"`).

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only, no images | Smallest file; self-contained by construction | ✓ (refined to text + inline SVG icons) |
| Embed atlas page thumbnails as base64 | Adds sharp dep + bytes per page | |
| Embed nothing, leave 'Future: thumbnails' placeholder | Same end-state with explicit deferred ask | |

### Q4: Filename + output dialog flow

User's response (free-text): "it has to be the same name as the json (e.g., JOKER_CHARACTER.json ----> JOKER_CHARACTER.html)."

Resolved: filename derived from skeleton JSON basename, suffix swapped. OS save dialog pre-fills the name (user can re-locate). Default directory: `lastOutDir` from session state, falling back to OS Documents.

---

## Claude's Discretion

- Drag-image visual when dragging an animation: browser-default (no custom `setDragImage`).
- Number-input UX for mixTime + safetyBufferPercent: standard `<input type="number">` with `step=0.05` / `step=0.5`.
- Filter input for control-bones list: debounced 100ms substring match (case-insensitive).
- Track-add/-remove UX: "+ Add Track" button + per-track ✕ button with `window.confirm` if entries exist.
- HTML chip-strip date format: `DD/MM/YYYY` (matches user's screenshot `14/04/2026`).
- LOOP pill rendering: small inline pill with blue tint for `loop=true`, blank dash for `loop=false`.
- Modal close behavior with unsaved changes: leverage existing Phase 8 dirty-guard at AppShell level — no doc-modal-local dirty guard.

## Deferred Ideas

- **999.7 — Safety buffer global multiplier in export math.** Future phase wires `effectiveScale × (1 + safetyBufferPercent/100)` into buildExportPlan + export-view.ts (≤1.0 clamp still binding).
- **Click-to-add fallback for HTML5 native DnD** — a11y-polish future phase.
- **Atlas page thumbnails embedded in HTML export** — future polish phase.
- **Markdown in generalNotes textarea** — future polish phase.
- **Search/filter inside the doc surface** — future polish phase.
- **PDF / multi-format export** — future phase.
