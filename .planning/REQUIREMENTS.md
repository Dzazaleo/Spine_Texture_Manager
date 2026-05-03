# Requirements: Spine Texture Manager v1.3

## Milestone

**v1.3 — Polish & UX**

Close v1.2 correctness/semantic gaps, improve the optimize workflow UX, and do a thorough UI polish pass.

---

## Active Requirements

### PANEL — Panel Semantics & Display

- [ ] **PANEL-01**: User loads a `json + images folder` project and the Unused Assets section reports PNG files present in the `images/` folder that the rig does NOT reference (orphaned files), not atlas-vs-JSON region delta.
- [ ] **PANEL-02**: Unused Assets section is its own collapsible panel, extracted from `GlobalMaxRenderPanel` and rendered as a sibling to Global Max Render Source + Animation Breakdown; collapsed by default when empty, expanded by default when N > 0.
- [ ] **PANEL-03**: Rows whose attachment PNG was missing at load time (skipped attachments from atlas-less mode) remain visible in Global Max Render Source + Animation Breakdown panels, marked with a red left-border accent and a danger-triangle (⚠) icon beside the attachment name — not filtered out.
- [ ] **PANEL-04**: When a user loads a `.json` file with no `.atlas` file and no `images/` folder, the `AtlasNotFoundError` user-facing message mentions "Use Images Folder as Source" toggle as an alternative path, in addition to re-exporting with an atlas.

### OPT — Optimize Flow

- [ ] **OPT-01**: Clicking the "Optimize Assets" toolbar button opens `OptimizeDialog` immediately — no folder-picker dialog is shown before the modal opens.
- [ ] **OPT-02**: The output-folder picker is presented only when the user clicks Start/Export inside `OptimizeDialog`; if an output folder was previously saved in the project file, it is pre-filled and the user can change it at that point.
- [ ] **OPT-03**: The MB unused-attachment callout in the Global Max Render Source panel is replaced or redefined with a metric that reflects genuine optimization opportunity (e.g. post-generation atlas pixel-area savings % or a correct pre-flight estimate — to be scoped during plan-phase).

### UI — Polish (continues v1.2 UI-01..05)

- [ ] **UI-06**: All elements in the sticky toolbar (project-name chip, load-summary card, search box, button cluster) share a single height token; the Global panel `N selected / N total` counter cell has a fixed minimum width so the panel does not shift horizontally when the count changes.
- [ ] **UI-07**: Row backgrounds in Global Max Render Source and Animation Breakdown panels alternate between two distinct tones (zebra striping) to improve row-tracking readability.
- [ ] **UI-08**: Icon audit: existing icons updated to a consistent style; icons added where the UI currently shows text-only labels that would benefit from a visual affordance (e.g. panel section headers, toolbar actions, modal tabs).
- [ ] **UI-09**: Every hand-rolled modal (OverrideDialog, OptimizeDialog, AtlasPreviewModal, SaveQuitDialog, SettingsDialog, HelpDialog, UpdateDialog, DocumentationBuilderDialog) can be dragged and repositioned by clicking and dragging its title bar.
- [ ] **UI-10**: Toolbar action buttons (Atlas Preview, Documentation, Optimize Assets, Save, Load) share a unified height; no button is taller or shorter than its neighbors.

### QA — Code Quality (Phase 4 carry-forwards)

- [ ] **QA-01**: `handleToggleRow` and `handleRangeToggle` in `GlobalMaxRenderPanel.tsx` use the functional `setSelected(prev => ...)` updater form rather than capturing `selected` via closure, eliminating a potential stale-state race on fast keyboard events.
- [ ] **QA-02**: `OverrideDialog` validates empty input: Apply button is disabled (or an inline validation message is shown) when the input field is empty, preventing silent `Number('') = 0` floor.
- [ ] **QA-03**: Sort comparators that call `localeCompare` use `{ sensitivity: 'base', numeric: true }` so attachment names like `CHAIN_10` sort after `CHAIN_9` rather than between `CHAIN_1` and `CHAIN_2`.
- [ ] **QA-04**: The unreachable `if (!props.open) return null` early-return guard and its associated `open` prop are removed from `OverrideDialog`, which is conditionally mounted by `AppShell` (dead code elimination).

---

## Future Requirements

- Phase 13.1 UAT: Linux AppImage runbook + macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle (host-blocked; carry to v1.4+).
- Phase 20 Windows/Linux DnD cross-platform UAT (host-blocked; carry to v1.4+).
- Apple Developer ID code-signing + notarization ($99/yr; declined for v1.3).
- Crash + error reporting (Sentry or equivalent; declined for v1.3).
- Spine 4.3+ versioned loader adapters; `.skel` binary loader.
- Adaptive bisection refinement (pathological easing curves).
- In-app atlas re-packing (writes new `.atlas` file).
- Phase-0 scale-overshoot debug session (v1.0-era tech debt; no regression observed).

---

## Out of Scope (v1.3)

- Auto-update changes of any kind (distribution surface is stable post-v1.2).
- Linux testing / AppImage UAT.
- New Spine math or sampler changes.
- `.stmproj` schema-version bump.
- Per-combined-skin compositing.
- Code-signing posture changes.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PANEL-01 | TBD | Pending |
| PANEL-02 | TBD | Pending |
| PANEL-03 | TBD | Pending |
| PANEL-04 | TBD | Pending |
| OPT-01 | TBD | Pending |
| OPT-02 | TBD | Pending |
| OPT-03 | TBD | Pending |
| UI-06 | TBD | Pending |
| UI-07 | TBD | Pending |
| UI-08 | TBD | Pending |
| UI-09 | TBD | Pending |
| UI-10 | TBD | Pending |
| QA-01 | TBD | Pending |
| QA-02 | TBD | Pending |
| QA-03 | TBD | Pending |
| QA-04 | TBD | Pending |
