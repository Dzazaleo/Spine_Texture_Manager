# Requirements: Spine Texture Manager v1.3.1

## Milestone

**v1.3.1 — Correctness & Refinements**

Close v1.3 post-ship correctness gaps (per-region dedup + override-region semantics, atlas-preview pack-page accuracy) and refine the Optimize/load workflow with one new feature (safety buffer) plus targeted UX polish (Animation Breakdown collapse defaults, Windows admin drag-drop fallback, source-toggle disabling).

---

## Active Requirements

### REGION — Per-Region Dedup & Override Semantics

- [ ] **REGION-01**: User sees one row per unique source PNG in the Global Max Render Source panel — attachments that share a source PNG via Spine `path` indirection collapse into a single row whose displayed peak equals the maximum peak across all contributing attachments.
- [ ] **REGION-02**: User sees one tile per unique source PNG in the Atlas Preview modal — both Original and Optimized modes; click hit-tests on a tile attribute to all contributing attachments via the row's contributing-attachments list.
- [ ] **REGION-03**: Each row in the Global Max Render Source panel displays its identifier as `{regionName}.png` (the `images/` prefix is stripped, since `images/` is the implicit project root for source PNGs).
- [ ] **REGION-04**: Setting an override on a Global Max Render row sizes the underlying source PNG file at export time; the override applies to all attachments resolving to that region (overrides bind to region, not to attachment-name).
- [ ] **REGION-05**: The Source Animation column and Frame column in the Global Max Render Source panel attribute their values to the winning contributing attachment — the attachment whose calculated peak equals the row's displayed peak. Ties are broken deterministically by attachment-name lexical order.
- [ ] **REGION-06**: When a user inspects a row's drill-down (Animation Breakdown panel or equivalent), the per-attachment detail (mesh shape, weight maps, slot bindings) is preserved and visible — region-level dedup does not erase per-attachment information from the analysis surface.
- [ ] **REGION-07**: A regression test fixture (stripped Chicken-derived subset, target <1MB committed under `fixtures/`) exercises path-indirection (multiple attachment names resolving to one region) and locks the per-region dedup contract across analyzer + atlas-preview + export.

### BUFFER — Safety Buffer in Optimize Dialog

- [ ] **BUFFER-01**: The Optimize Assets dialog exposes a user-configurable safety-buffer percentage control (e.g. integer percentage with small step) that, when set, multiplicatively increases each row's calculated effective scale (and any user-set overrides) before the export plan is computed.
- [ ] **BUFFER-02**: When the safety buffer would cause an exported texture to extrapolate beyond its source PNG dimensions, the export is hard-capped at source dimensions on both axes — preserving D-91 (no texture surpasses source dimensions). The cap applies uniformly so Spine UV sampling is preserved (D-79 / Phase 6 invariant).
- [ ] **BUFFER-03**: The safety-buffer setting persists per-project in the `.stmproj` v1 schema as an additive optional field (mirrors `sharpenOnExport` precedent — missing field defaults to 0% for backward-compat with v1.2/v1.3-era project files; no schema-version bump).

### PLATFORM — Windows Admin Drag-Drop Fallback

- [ ] **PLATFORM-01**: When the app runs as administrator on Windows, drag-drop targets (project window, drop zones) are disabled and a clear, user-visible message explains that drag-drop is unavailable under elevated privileges. The message routes the user to File → Open as the supported alternative or recommends relaunching unprivileged.

### LOAD — Loader Source Toggle UX

- [ ] **LOAD-05**: The "Use Atlas as Source" toggle is greyed-out (visually disabled, non-interactive) when the loaded project's folder contains no `.atlas` file.
- [ ] **LOAD-06**: The "Use Images Folder as Source" toggle is greyed-out (visually disabled, non-interactive) when the loaded project's folder contains no `images/` directory.
- [ ] **LOAD-07**: A disabled source toggle exposes a tooltip on hover explaining why it is unavailable (e.g. "No .atlas file found in this project's folder" / "No images/ folder found in this project's folder").

### PREVIEW — Atlas Preview Pack-Page Accuracy

- [ ] **PREVIEW-01**: For projects exhibiting path-indirection (multiple attachments sharing one source PNG), the Atlas Preview modal's projected page count matches the actual atlas page count. Repro: the Chicken fixture has 13 atlas PNG pages; the app's Atlas Preview must project 13 pages, not 14 — and the same accuracy invariant must hold across all rigs in the regression-fixture set.

### PANEL — Animation Breakdown Collapse Defaults & Bulk Actions

- [ ] **PANEL-08**: All Animation Breakdown panel cards — including the Setup Pose card — are collapsed by default when the panel first renders (i.e. on project load and on tab switch into Animation Breakdown).
- [ ] **PANEL-09**: When a user opens any individual card (Setup Pose or any animation), that card retains its open state for the duration of the current session (in-memory React state, no `.stmproj` persistence). Re-opening the project resets all cards to collapsed.
- [ ] **PANEL-10**: The Animation Breakdown panel header exposes two bulk-action buttons — "Expand all" and "Collapse all" — styled consistently with the v1.3 unified `h-8` toolbar button style. Activating them sets all cards to the corresponding state in one click.
- [ ] **PANEL-11**: Setup Pose remains the first card in the Animation Breakdown panel sort order (the canonical reference, sort-pinned to top) — only its default-expanded behavior changes.

---

## Future Requirements

- Phase 13.1 UAT: Linux AppImage runbook + macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle (host-blocked; carry to v1.4+).
- Phase 20 Windows/Linux DnD cross-platform UAT (host-blocked; carry to v1.4+).
- SEED-003: Spine 4.3+ versioned loader adapters (planted 2026-05-07; primary v1.4 candidate).
- `.skel` binary loader (still deferred).
- Apple Developer ID code-signing + notarization ($99/yr; declined for v1.3.x).
- Crash + error reporting (Sentry or equivalent; declined for v1.3.x).
- Phase-0 scale-overshoot debug session (v1.0-era tech debt; no regression observed).
- Adaptive bisection refinement (pathological easing curves).
- In-app atlas re-packing (writes new `.atlas` file).
- Per-combined-skin compositing.
- 21 audit-acknowledged carry-forwards from v1.0–v1.3 (see STATE.md → Deferred Items).

---

## Out of Scope (v1.3.1)

- New Spine math or sampler changes — sampler must continue to measure all skin-declared attachments verbatim (memory `project_sampler_visibility_invariant.md`); region-dedup happens strictly downstream in analyzer + atlas-preview + UI layers.
- `.stmproj` schema-version bump — safety-buffer field is additive optional only, mirroring `sharpenOnExport` (Phase 28) precedent.
- Auto-update changes of any kind — distribution surface is stable post-v1.2; Windows admin DnD fix does not touch updater paths.
- Linux testing / AppImage UAT — still host-blocked; v1.3 dropped Linux from CI.
- Code-signing posture changes — Apple Developer ID + notarization remain deferred.
- Spine 4.3+ adapter work — SEED-003 stays earmarked for v1.4.
- Cross-session persistence of Animation Breakdown collapse state (in-memory only, by user decision).
- UIPI message-filter workaround for Windows admin DnD (Microsoft-discouraged for security; deliberately not pursued — fallback message is the contract).

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| REGION-01 | TBD | Pending |
| REGION-02 | TBD | Pending |
| REGION-03 | TBD | Pending |
| REGION-04 | TBD | Pending |
| REGION-05 | TBD | Pending |
| REGION-06 | TBD | Pending |
| REGION-07 | TBD | Pending |
| BUFFER-01 | TBD | Pending |
| BUFFER-02 | TBD | Pending |
| BUFFER-03 | TBD | Pending |
| PLATFORM-01 | TBD | Pending |
| LOAD-05 | TBD | Pending |
| LOAD-06 | TBD | Pending |
| LOAD-07 | TBD | Pending |
| PREVIEW-01 | TBD | Pending |
| PANEL-08 | TBD | Pending |
| PANEL-09 | TBD | Pending |
| PANEL-10 | TBD | Pending |
| PANEL-11 | TBD | Pending |
