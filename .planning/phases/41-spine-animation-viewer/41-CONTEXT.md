# Phase 41: Spine Animation Viewer - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 41 adds a read-only, in-app Spine animation viewer that wraps Esoteric's official `@esotericsoftware/spine-player` library and plays back the currently-open project's skeleton against its on-disk source assets (atlas-source: `.json` + `.atlas` + page PNG(s); atlas-less: `.json` + `images/` folder via the Phase 21 synthetic-atlas path). It is invoked from a single new toolbar button on the AppShell right-cluster, opens as a near-fullscreen standalone modal sibling to AtlasPreviewModal, supports live animation + skin switching and play/pause/scrub transport, disposes its GL context cleanly on close, and surfaces a terminal in-modal error state on malformed JSON / missing atlas / unreadable PNGs.

Scope is the viewer surface itself — the validation lens that closes the optimize → pack → validate loop without round-tripping through the Spine editor. Comparison of source-vs-exported playback (VIEWER-07) is locked Future and remains out of scope per the v1.5.1 viewer-only milestone framing.

</domain>

<decisions>
## Implementation Decisions

### D-01 Dependency mode (delegated to Claude)

- **D-01:** Install `@esotericsoftware/spine-player` as a regular npm dependency (`npm install @esotericsoftware/spine-player`). Pin range follows the existing `@esotericsoftware/spine-core@^4.2.0` pattern. *Rationale:* User skipped D-01 from gray-area selection, delegating to Claude per [[feedback_delegate_implementation_choices]]. SEED-009 Notes explicitly state "npm is the natural default for an Electron renderer" — the vendoring rationale from the Python reference only applied to the WebView's sandboxed JS world (we don't have that constraint). Vendor option discarded.
- **D-01a (planner discretion):** Whether to add `spine-player` to `renderer` or `shared` deps in `package.json`. Default lean: `dependencies` (renderer-side) since the player only runs in the renderer process; spine-core's existing classification is the precedent.

### D-02 Viewer UI shape

- **D-02:** Standalone `AnimationPlayerModal.tsx` (sibling to `AtlasPreviewModal.tsx`, `OptimizeDialog.tsx`, `DocumentationBuilderDialog.tsx`, etc.). Reuses the locked 5-modal ARIA scaffold from Phase 6 Round 6: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + outer overlay `onClick={onClose}` + inner `stopPropagation` + `useFocusTrap` hook (Tab cycle + document-level Escape). VIEWER-07 (split-pane source-vs-exported) is locked Future per this choice — the v1.5.1 viewer plays a single feed only.
- **D-02a:** Modal sizing mirrors `AtlasPreviewModal` — near-fullscreen with a small inset border, not a compact fixed dialog. Complex rigs (e.g., `fixtures/Girl/`, `fixtures/SKINS/JOKERMAN_SPINE.json`) need canvas room; matches the visual-surface precedent already in the app.
- **D-02b:** Animation + skin selectors + playback transport (play / pause / scrub) all mount in a single horizontal **top control bar** above the canvas. Matches the Python reference at `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/viewer.js`; keeps the canvas a single uninterrupted rectangle below the controls.
- **D-02c:** Canvas background uses the existing `#232732` app panel-surface token (same as `AtlasPreviewModal` canvas bg). No checkerboard / no user toggle — defer transparency-validation tooling to a future phase if a real use case emerges.

### D-03 Mount location

- **D-03:** Single **toolbar button** in the right-aligned cluster at [`AppShell.tsx:2087-2090`](src/renderer/src/components/AppShell.tsx#L2087-L2090). No tab; no inline embed. Mirrors `Atlas Preview` button's invocation scaffolding exactly (boolean open state + setter + JSX prop mount). Modal overlays whichever tab (Global / Animation Breakdown) is active.
- **D-03a:** Position in cluster: `SearchBar | Atlas Preview | **Animation Viewer** | Documentation | Optimize Assets`. Groups the two visual-validation surfaces (static atlas layout ↔ animated playback) adjacent; downstream actions (Documentation, Optimize) come after.
- **D-03b:** Button label is `Animation Viewer` (capitalized, two-word noun-phrase, parallel structure with sibling labels). Avoids the verb-phrase `Play Animation` (implies a playback toggle, not a viewer opener) and `Preview Animation` (the seed + roadmap consistently use "Viewer" not "Preview" for the animated surface).
- **D-03c:** Disabled rule: button is disabled **only when no skeleton is loaded** (i.e., `effectiveSummary.peaks.length === 0`, mirroring `Atlas Preview`'s disable predicate at `AppShell.tsx:2095`). Stays enabled during sampler-in-flight and during export-in-flight — the viewer does not write files and owns its own spine-core skeleton instance (no shared-mutation surface with the sampler or exporter).

### D-04 Asset feed routing

- **D-04:** Viewer **always plays the source project** — the currently-open `.json` + on-disk atlas + page PNG(s) (atlas-source) or the in-memory synthetic-atlas + `images/` folder (atlas-less). No coupling to the Optimize Assets output dir; no post-export bookkeeping. The "validate the exported artifact" use case is deferred to VIEWER-07 (Future).
- **D-04a:** Atlas-less mode (`loaderMode === 'atlas-less'`) reuses the Phase 21 synthetic-atlas path. The viewer asks the same in-memory `TextureAtlas` instance that the sampler/preview pipeline already consumes; `spine-player` accepts a pre-constructed `TextureAtlas`, so no on-disk materialization step is needed. Respects [[project_strict_loadermode_separation]] — atlas-source and atlas-less remain self-contained on the input side; the viewer does not introduce a third mode.
- **D-04b:** Default open state is `skeleton.data.animations[0]` + `skeleton.data.skins[0]` (or the project's single loaded skin in atlas-less mode), play + loop on. No persistence — neither in-session React state nor `.stmproj` fields. Every open is predictable. Matches REQUIREMENTS.md VIEWER-06 verbatim.
- **D-04c:** Error UX is a **terminal in-modal error state with a single Close button**. On malformed JSON / missing atlas / unreadable PNG: the viewer renders the (planner-finalized verbatim) error copy inside the modal frame and disables all controls except Close. No retry button, no "open project files folder" helper. User must close the viewer, fix the underlying file on disk, and (if necessary) reload the project from the main UI before re-opening. Simplest mental model; closest mirror to `AtlasNotFoundError` handling at the project-load seam.

### Claude's Discretion

The following implementation details are left to the planner / executor:

- **Asset URL construction** — whether the viewer uses the existing Phase 12 `app-image://` custom scheme handler (used by `AtlasPreviewModal` for cross-platform Windows-drive-letter safety), bare `file://` URLs, or preload-injected blob URLs to feed page PNGs / atlas text into `spine-player`. Planner picks based on what `spine-player` accepts and what the existing scheme handler already supports.
- **`spine-player` API surface** — exact construction call (`new SpinePlayer(...)` vs. `<spine-player>` web-component vs. options-object factory) is the planner's call after reading the current `@esotericsoftware/spine-player` package surface during research. The seed reference (`spine-skin-swap/viewer.js`) shows the patterns but the npm package may have evolved.
- **WebGL context teardown** — `player.dispose()` invocation order vs. React unmount order vs. modal-close animation timing. Planner picks based on the player's documented lifecycle.
- **HMR resilience** (VIEWER-02 requirement) — exact `useEffect` cleanup pattern that survives Vite HMR in dev mode. Planner adapts the existing renderer HMR-cleanup idioms.
- **Project-change cleanup** (VIEWER-08 requirement) — exact integration point with AppShell's project-load lifecycle to dispose any prior viewer instance.
- **Scrub control implementation** — native `<input type="range">` vs. custom track. Planner picks per existing renderer patterns (no scrubber primitive exists yet in this codebase).
- **Animation + skin `<select>` styling** — native vs. custom dropdown. Default lean: native `<select>` matching the `atlasMaxPageSize` dropdown from Phase 40 [`OptimizeDialog.tsx`](src/renderer/src/modals/OptimizeDialog.tsx).
- **Final error copy** (VIEWER-09) — verbatim wording for "malformed JSON", "missing atlas", "unreadable PNG" cases. Resolved during `/gsd-plan-phase 41`; this CONTEXT only locks the *behavior* (terminal + Close-only).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Seed, requirements, roadmap (load first)
- `.planning/seeds/SEED-009-spine-animation-viewer.md` — Locked design facts (#1–4), open decisions D-01..D-04 (now resolved here), reference-implementation pointers, REQ-ID namespace (VIEWER-01..09).
- `.planning/REQUIREMENTS.md` (v1.5.1) — VIEWER-01..06 + VIEWER-08 + VIEWER-09 (8 active reqs); VIEWER-07 explicitly Future. Atlas-less mode note + locked baseline (standalone modal) + open D-* mapping.
- `.planning/ROADMAP.md` — Phase 41 entry (v1.5.1 single-phase milestone); 5 success criteria mapping to VIEWER-* reqs; locked design facts.
- `.planning/STATE.md` — Current position (planning), v1.5.1 locked design facts mirror, deferred items table.
- `.planning/PROJECT.md` — Tech stack pins (`@esotericsoftware/spine-core@4.2.111`, `sharp@0.34.5`, etc.), Constraints (`core/` purity, Spine 4.2 only).

### External reference implementation (mine for UX shape)
- `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/viewer.js` (~412 lines) — Wraps `spine-player.js`, manages skin/animation selection. **The pattern to translate** for D-02b top-control-bar layout.
- `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/viewer.html` (~60 lines) — Shell page with loading state + canvas container; informs canvas mount pattern.
- `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/spine-player.js` (~15,232 lines) — Vendored official player; **do not vendor in this repo** per D-01; reference only for behavior expectations.

### Memory references (durable project facts)
- `memory/project_strict_loadermode_separation.md` — Atlas-source and atlas-less buckets stay self-contained. D-04a viewer feed is the only consumer that bridges both modes (via synthetic-atlas, not by mode-conversion).
- `memory/project_atlas_less_primary_workflow.md` — Esoteric officially recommends atlas-less delivery; viewer must not bias toward atlas-source. D-04 + D-04a uphold this.
- `memory/project_spine_4_2_atlas_json_precedence.md` — JSON width/height is skeleton-space, invariant under repack; relevant if the viewer ever surfaces dim mismatch warnings (out of scope for v1.5.1).
- `memory/feedback_delegate_implementation_choices.md` — User skipping a gray area = explicit delegation. D-01 falls under this signal.
- `memory/feedback_layout_bugs_request_screenshots_early.md` — When viewer layout iteration begins during human UAT, request a screenshot before speculating.
- `memory/feedback_platform_divergent_check_stale_build.md` — If viewer renders differently on Windows vs macOS, wipe build artifacts before suspecting source.
- `memory/feedback_dont_push_release_tags.md` — Hard guard against `git push origin v1.5.1*` during this phase's lifecycle.

### Code anchors (read on the way into planning)
- [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) lines 2080-2120 — Toolbar right-cluster; insertion point for the new `Animation Viewer` button (D-03 / D-03a / D-03b / D-03c).
- [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) lines 200-220 + 376-400 + 568-590 — `atlasPreviewOpen` state pattern; mirror for `animationViewerOpen` state.
- [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) line 2417 — `onOpenAtlasPreview` prop-drilling precedent (for any panel-internal trigger).
- [src/renderer/src/modals/AtlasPreviewModal.tsx](src/renderer/src/modals/AtlasPreviewModal.tsx) (~31KB) — Primary pattern analog. ARIA scaffold + Esc-to-close + click-outside-to-close + focus trap + canvas mounting + `app-image://` URL handling + image cache via useRef. The closest sibling for `AnimationPlayerModal.tsx`.
- [src/renderer/src/modals/OptimizeDialog.tsx](src/renderer/src/modals/OptimizeDialog.tsx) — Bordered card layout + native `<select>` dropdown precedent (`atlasMaxPageSize`) for D-02b selector controls.
- [src/renderer/src/modals/OverrideDialog.tsx](src/renderer/src/modals/OverrideDialog.tsx) — Original 5-modal ARIA scaffold source (Phase 4 D-81).
- [src/renderer/src/hooks/useFocusTrap.ts](src/renderer/src/hooks/useFocusTrap.ts) — Tab cycle + document-level Escape; reused verbatim.
- [src/main/ipc.ts](src/main/ipc.ts) — `app-image://` scheme handler / `pathToImageUrl` bridge; the planner determines whether the viewer reuses this for spine-player's PNG fetches.
- [src/shared/types.ts](src/shared/types.ts) — `MaterializedProject` shape; viewer reads `materializedProject.skeletonJson` + atlas path / synthetic atlas instance.
- [package.json](package.json) — `@esotericsoftware/spine-core@^4.2.0` already present; spine-player sibling install lands here (D-01).
- Atlas-less / synthetic-atlas path — search `src/core/` and `src/main/` for the Phase 21 synthetic-atlas constructor (the in-memory `TextureAtlas` that's reused per D-04a).

### Spine runtime + library docs (external)
- Spine 4.2 API: <http://esotericsoftware.com/spine-api-reference>
- Spine player docs (consult during research; D-01 npm install will land the package): the package README at `node_modules/@esotericsoftware/spine-player/README.md` after install.
- Spine JSON format: <https://en.esotericsoftware.com/spine-json-format>

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`@esotericsoftware/spine-core@^4.2.0`** is already installed and exercised across `src/core/sampler.ts` and `src/core/atlas-preview.ts`. `spine-player` is a sibling package — same Esoteric author, same version family (4.2.x). No transitive-dep conflicts expected.
- **5-modal ARIA scaffold** — verbatim reuse from `OverrideDialog` → `OptimizeDialog` → `AtlasPreviewModal` → `SaveQuitDialog` → `SettingsDialog`. `AnimationPlayerModal` becomes the 6th member of the family. Includes `useFocusTrap`, `role="dialog"`, `aria-modal="true"`, outer-overlay click-outside-to-close, inner-content `stopPropagation`.
- **`app-image://` custom scheme handler** (Phase 12) — already cross-platform-safe for Windows drive-letter paths (Phase 12 D-19 fix). If `spine-player` accepts arbitrary URL strings for atlas page PNGs, this is the existing on-ramp; planner verifies during research.
- **`AtlasPreviewModal` open-state pattern** — `[atlasPreviewOpen, setAtlasPreviewOpen]` + `onClickAtlasPreview` callback + `AtlasPreviewModal` JSX prop mount. The exact triple to mirror for `animationViewerOpen`.
- **Synthetic-atlas path** (Phase 21) — Already produces an in-memory `TextureAtlas` from `images/` folder + IHDR-parsed PNG dims, used by sampler + preview. D-04a routes the viewer through this same path for atlas-less projects with zero new code.

### Established Patterns

- **`core/` purity invariant** — `src/core/*` cannot import DOM, Electron, or `sharp` (locked by `tests/arch.spec.ts:19-34`). The viewer is renderer-only; nothing in `core/` changes for Phase 41. Player wiring lives entirely in `src/renderer/`.
- **Hand-rolled ARIA modals (no library)** — 5 modals already follow this; the 6th continues the pattern. No `@radix-ui/react-dialog`-style dependency.
- **Tailwind v4 literal-class scanner discipline** — every `className` must be a literal string or `clsx` with literal branches (RESEARCH Pitfall 3 + 8). No dynamic class composition.
- **Open-state pattern at AppShell level** — boolean React state + setter + button onClick = `setOpen(true)` + JSX prop mount. Mirrors all 5 existing modals.
- **Disable-rule precedent** — `Atlas Preview` button disabled-when-no-peaks at `AppShell.tsx:2095`; `Animation Viewer` mirrors this exact predicate per D-03c.

### Integration Points

- **AppShell toolbar cluster** at [`AppShell.tsx:2087-2090`](src/renderer/src/components/AppShell.tsx#L2087-L2090) — new button inserts between `Atlas Preview` (line 2092-2099) and `Documentation` (line 2105-2111).
- **AppShell state slot** at `AppShell.tsx:200-220` (existing `atlasPreviewOpen` boolean state cluster) — add `animationViewerOpen` boolean alongside.
- **AppShell JSX mount** — `<AnimationPlayerModal>` JSX prop mount lives near the existing `<AtlasPreviewModal>` mount (`AppShell.tsx:2138-ish`) with `open={animationViewerOpen}` + `onClose={() => setAnimationViewerOpen(false)}`.
- **Project-change cleanup hook** — VIEWER-08 ("switching to a different project closes any prior viewer instance"). Planner identifies the existing AppShell project-load seam (likely the `useEffect` that resets `activeTab` per the D-50 / D-74 parity rule at `AppShell.tsx:28`) and folds in `setAnimationViewerOpen(false)`.
- **Materialized project consumer** — viewer needs `materializedProject.skeletonJson` (parsed JSON object) + atlas resolution (atlas-source: file path to `.atlas` + page PNGs; atlas-less: in-memory `TextureAtlas`). Existing seams in `src/shared/types.ts` (`MaterializedProject`) carry both shapes today.
- **No IPC changes for happy path** — viewer reads asset URLs the renderer already has (via existing `app-image://` or filesystem paths surfaced through `MaterializedProject`); no new main-side handler required unless the planner discovers `spine-player` needs raw bytes (then a `fs.readFile`-via-preload bridge would surface).

</code_context>

<specifics>
## Specific Ideas

- **Top control bar layout direction** mirrors the Python reference at `spine-skin-swap/viewer.js` — left-to-right: `[Animation ▾] [Skin ▾] [⏵ play] [⏸ pause] [───●───── scrub]`. Final iconography + spacing is planner / UI-phase territory but the order locks here.
- **`AnimationPlayerModal.tsx`** is the locked filename — matches the `AtlasPreviewModal.tsx` / `DocumentationBuilderDialog.tsx` naming convention.
- **Button position in cluster** is fixed: `SearchBar | Atlas Preview | Animation Viewer | Documentation | Optimize Assets` (D-03a). Insertion point at `AppShell.tsx:2099` (immediately after the `Atlas Preview` button's closing tag).
- **Button label** is fixed: `Animation Viewer` (D-03b). No alternative copy.
- **Modal size** is "large near-fullscreen, mirrors `AtlasPreviewModal`" (D-02a). Final viewport-% / fixed-px decision is planner discretion, but the visual reference is `AtlasPreviewModal`.
- **Canvas background color** is the existing `#232732` panel-surface Tailwind token (D-02c). No theming surface in v1.5.1.
- **No bg toggle / no checkerboard / no transparency UI** in v1.5.1. Deferred.
- **Default open state**: first animation, first skin, play, loop on (D-04b + VIEWER-06). No persistence.

</specifics>

<deferred>
## Deferred Ideas

- **VIEWER-07 — Source vs exported split-pane comparison** — Locked Future per D-02 = standalone modal. If a later milestone picks up VIEWER-07, it likely lives as a separate `AnimationComparePane.tsx` or as a split-pane variant of `AnimationPlayerModal`; out of v1.5.1 scope.
- **Checkerboard / solid bg toggle** in the viewer for transparency / edge-bleed validation — Considered during D-02 Q4 but rejected for v1.5.1 in favor of solid `#232732`. Future polish if a real use case emerges from animator UAT.
- **Animation + skin selection persistence** — Both `.stmproj`-additive-field persistence (D-04b Option B) and in-session React-state persistence (Option C) were considered. Rejected in favor of "first animation, first skin on every open" for predictability. Could revisit if iteration loops show animator friction.
- **Retry button on error state** + **"Open project files folder" helper** — Both considered in D-04c. Rejected for v1.5.1 in favor of terminal-Close-only. Could land as a future polish phase if error-recovery friction surfaces in UAT.
- **`Animation Viewer` as a third tab in the sub-toolbar** — Considered in D-03 Q1 but rejected; would conflict with the locked 2-tab variant-A pattern from Phase 26.2 sketch-001 and contradict the standalone-modal D-02 lock.
- **Post-export asset-feed routing** (Optimize-output-dir → viewer) — Considered in D-04 Q1 but rejected; the "validate the actual exported artifact" use case is what VIEWER-07 (Future) is for. v1.5.1 viewer plays source only.
- **Project-level animator-friendly "preview last export"** — Roadmap candidate for v1.5.2 / v1.6 if VIEWER-07 becomes a priority.

### Reviewed Todos (not folded)
None — `gsd-sdk query todo.match-phase 41` was not run (phase scope was fully bounded by SEED-009 + REQUIREMENTS.md; no orphan todos in `.planning/todos/pending/` carry viewer-related keywords).

</deferred>

---

*Phase: 41-spine-animation-viewer*
*Context gathered: 2026-05-15*
