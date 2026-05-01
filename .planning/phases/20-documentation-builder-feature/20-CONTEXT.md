# Phase 20: Documentation Builder feature - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-skeleton documentation surface filling the `.stmproj` v1 reserved `documentation: object` slot (D-148, reserved during v1.0 Phase 8 schema lock; untested until v2 ladder lands). Net-new feature: a `DocumentationBuilderDialog` modal with three tabbed panes (Animation Tracks, Sections, Export), HTML self-contained export, persistence round-trip via the existing `.stmproj` v1 schema.

**In scope (DOC-01..DOC-05):**
- New `DocumentationBuilderDialog.tsx` modal — 5-modal ARIA scaffold verbatim (Phase 19 invariant). Wires the existing disabled placeholder button at `AppShell.tsx:1189-1197` (Phase 19 D-03) by removing `disabled` + `aria-disabled` + `title` and adding `onClick`.
- New `src/core/documentation.ts` — pure-TS types + serialize/deserialize helpers (Layer 3 invariant: no DOM, no fs).
- Validator extension to `src/core/project-file.ts` — per-field hand-rolled guards for the new `documentation` sub-shape (mirrors lines 122-198 idiom).
- New `src/main/doc-export.ts` — HTML rendering + atomic write (Pattern-B from Phase 6 D-121 + Phase 8 D-149).
- Schema-version field stays at `1` (D-148 forward-compat slot honored).
- Round-trip identity contract (DOC-05): save → reload → bit-equal documentation content.

**Out of scope (NEW capabilities or other phases):**
- Atlas-less mode / synthetic atlas (Phase 21).
- Override-cap dims-badge (Phase 22).
- **Safety buffer global scale multiplier in export math** — Phase 20 ships the `safetyBufferPercent` field as documentation-slot metadata ONLY (UI + persistence + HTML snapshot); the actual `buildExportPlan` multiplier wiring is deferred to a future phase tracked as backlog 999.7.
- Cross-skeleton documentation (each `.stmproj` carries its own).
- Search/filter inside the doc surface (a future polish phase).
- HTML PDF export, multi-format export.
- Image embedding (atlas page thumbnails, region previews) — text + inline SVG icons only.
- Keyboard-only fallback for drag-from-list — DOC-02 verbatim says "drag", and the recommended HTML5 native DnD is the locked path; click-to-add fallback NOT shipped this phase.
- Math core changes (Layer 3 invariant: `src/core/` untouched except for the new pure-TS `documentation.ts` and the validator extension in `project-file.ts`; `tests/arch.spec.ts` gate auto-enforces).

</domain>

<decisions>
## Implementation Decisions

### Documentation Slot Schema (D-148 sub-shape)

- **D-01:** Top-level field naming inside `documentation: {}` is flat camelCase, mirroring the existing `src/shared/types.ts` discipline (`animationBreakdown`, `unusedAttachments`). Six top-level keys, every one always present (D-03):

  ```typescript
  documentation: {
    animationTracks: AnimationTrackEntry[];   // grouped by Spine mix-track index
    events: EventDescriptionEntry[];           // auto-discovered from skeletonData.events
    generalNotes: string;                       // freeform multi-line textarea
    controlBones: BoneDescriptionEntry[];       // user opts-in per bone
    skins: SkinDescriptionEntry[];              // auto-list every rig skin
    safetyBufferPercent: number;                // 0..100; metadata only this phase
  }
  ```

- **D-02:** Animation track entries identified by `id: string` produced via `crypto.randomUUID()` at entry-create time (renderer-side). Stable across save/reload + reorders. structuredClone-safe primitive (D-21 file-top docblock at `src/shared/types.ts:7-15`).

  ```typescript
  interface AnimationTrackEntry {
    id: string;            // crypto.randomUUID()
    trackIndex: number;    // 0, 1, 2, ... — Spine mix-track number (D-05)
    animationName: string; // must match a name in skeletonSummary.animations.names
    mixTime: number;        // seconds, default 0.25 per DOC-02 verbatim
    loop: boolean;         // per DOC-02 verbatim
    notes: string;         // freeform per-entry note
  }
  ```

- **D-03:** All six top-level keys ALWAYS present in the on-disk `documentation` object — empty defaults (`[]`, `''`, `0`) when unauthored. Missing key → validator returns `kind: 'invalid-shape'` and surfaces as `ProjectFileParseError` (no new error kind). Mirrors Phase 8 posture where `overrides: {}` is always written even when empty. Round-trip identity (DOC-05) compares the full literal shape.

- **D-04:** Validator strategy = extend `validateProjectFile` in `src/core/project-file.ts` with per-field hand-rolled guards (mirrors the existing lines 122-198 idiom). Each sub-field gets its own `'invalid-shape'` rejection with a specific message. Reuses the existing `ProjectFileParseError` envelope; no 9th kind added to the discriminated-union (D-158/D-171 envelope unchanged). Pure-TS `src/core/documentation.ts` houses the type definitions + a `validateDocumentation(unknown): ValidateResult` helper that `validateProjectFile` calls; keeps the validator function readable while honoring the single-validator boundary.

### Animation Tracks Pane UX (DOC-02)

- **D-05:** "Track" semantics = Spine mix-track index (0, 1, 2, ...). Track index is the natural identity. Auto-numbered; no user-named tracks. Adding a track = clicking "Add track" (renders the next integer). Tracks render in ascending `trackIndex` order in the pane and in HTML export.

- **D-06:** Drag-from-list mechanics = HTML5 native DnD. Source: each animation in the side list has `draggable={true}` + `onDragStart` setting `e.dataTransfer.setData('application/x-stm-anim', animationName)`. Target: each track container has `onDragOver={e => e.preventDefault()}` (mandatory to enable drop) + `onDrop={e => readData + appendEntry}`. Zero deps, native browser API. **First DnD pattern in repo** — no existing analog. Researcher MUST verify cross-platform behavior (Electron Chromium has a known quirk where `dragstart` from the side list element MUST set `effectAllowed='copy'` to render the drag image consistently across macOS/Windows/Linux).

- **D-07:** Reordering = within a track only, via a small ↑/↓ button pair per entry. Clicking ↑ swaps with the previous entry in the same track; ↓ with the next. No cross-track move (delete + re-add). Mouse + keyboard accessible. Matches the typical playlist UX. Pitfall: button must be disabled at the track-edge positions (no-op clicks otherwise).

- **D-08:** Same animation can appear multiple times anywhere — multiple times on the same track, on multiple tracks. No warning. Each entry has its own `id` (D-02). Legitimate use cases: overlay animations on track 1+ (Spine pattern), and same-track sequencing with different mix-times/notes.

### Sections Pane Content Model (DOC-03)

- **D-09:** Events sub-section = auto-discovered from `skeletonData.events` (already exposed by spine-core 4.2 as `EventData[]`). Names locked to skeleton; user types a description per event. Stored as `{ events: [{ name: string, description: string }, ...] }`. **Round-trip drift policy:** on reload, intersect saved-doc event names with current skeleton event names. Events present in skeleton but missing from saved doc → auto-add with empty description. Events present in saved doc but no longer in skeleton → DROP silently (parallels Phase 8 D-150 stale-overrides intersection).

- **D-10:** Control bones sub-section = auto-list ALL bones from `skeletonSummary.bones.names`. User opts-in per bone via a checkbox-style affordance + description textarea. **Only documented bones (description.length > 0) are saved** — uncchecked bones never enter the slot. Stored as `{ controlBones: [{ name: string, description: string }, ...] }`. Filter input REQUIRED in the pane (rigs can have hundreds of bones — UX would be unusable without one). Order on save = skeleton bone-iteration order (matches `summary.bones.names` order). Same drift policy as events: on reload, drop entries whose `name` no longer exists in `summary.bones.names`.

- **D-11:** Skins sub-section = auto-list ALL skins from `skeletonSummary.skins.names`. User adds description per skin; descriptions can be empty. **All skins always written to the slot** (even with empty descriptions) — names are rig-locked, no drift handling needed beyond the standard reload (intersect saved with current; drop missing-from-skeleton; auto-add new-in-skeleton with empty description). Stored as `{ skins: [{ name: string, description: string }, ...] }` in skeleton skin-iteration order.

- **D-12:** General notes sub-section = single multi-line `<textarea>`. Stored as `generalNotes: string`. No structure, no Markdown, no max-length cap (sane editor limits — soft-wrap at panel width).

### Modal Composition (DOC-01)

- **D-13:** 3-pane composition = tabs (one pane visible at a time). Tab strip rendered at the top of the dialog body — `Animation Tracks | Sections | Export`. Click switches active pane. Reuses Phase 19 sticky-header tab-strip pattern (`AppShell.tsx:1136-1149`) verbatim — same class string, same `aria-selected` discipline, same `tabIndex` story. Tab state lives in modal-local `useState<'tracks' | 'sections' | 'export'>('tracks')`.

- **D-14:** Modal scaffold = the 5-modal ARIA pattern verbatim (`role="dialog"` + `aria-modal="true"` + outer overlay `onClick={onClose}` + inner `onClick={(e) => e.stopPropagation()}` + `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })`). NEVER touched. Researcher should pull the OptimizeDialog.tsx scaffold (lines 269-281) as the closest analog given the multi-state body.

- **D-15:** Modal width = `min-w-[960px] max-w-[1100px] max-h-[85vh]` flex-column. The 3-pane content (tracks pane needs side-list + track containers + per-entry table; sections pane needs 4 sub-categories) needs more horizontal real estate than the existing modals. Pitfall: must still fit comfortably on a 1280-px display (typical small-laptop width); 1100px max with `flex-shrink` on the side-list keeps it usable.

- **D-16:** No cross-nav button to other modals. The Documentation Builder is a destination, not a way-station — unlike the Optimize ↔ Atlas Preview cross-nav from Phase 19 D-11. Footer has `Cancel / Save changes` (saves into the local-modal-state copy of the documentation slot; commits to AppSessionState on Save → triggers session dirty-flag for the existing Phase 8 dirty-guard). Export → HTML lives in the Export tab body, not in the footer.

### HTML Export Template (DOC-04)

- **D-17:** Visual design = warm-stone theme match, dark surface, locked against user-supplied screenshot of `CHJWC_SYMBOLS` doc (2026-05-01). Inline `<style>` block (NO external CSS, NO external fonts, NO external images). Color palette:
  - Background: `#1c1917` (matches app's `--color-panel`)
  - Card surface: `#23201d` (slightly lighter than background; recessed-card tone)
  - Border: rgba lightened from background
  - Terracotta accent: `#e06b55` (matches app's `--color-danger` literal hex; titles + bone names + track-index dots)
  - Blue accent: `#5fa8d4` (skin names + LOOP pills + chip-strip glyphs)
  - Green accent: `#5fa866` (matches Phase 19 D-07 `--color-success` proposal; optimization shield + space-savings glyph)
  - Muted body: `#a8a29e` (matches app's `--color-fg-muted`)

- **D-18:** Layout sections, top to bottom:
  1. **Hero row** — section glyph + "Spine Documentation / `<SKELETON_NAME>`" (terracotta, large weight). `<SKELETON_NAME>` derived from skeleton JSON basename, uppercased.
  2. **Chip strip** — 5 chips: `Generated: <date>`, `<N> Images Utilized`, `<N> Animations Configured`, `<N> Optimized Assets`, `<N> Atlas Pages (<maxPagePx>px)`. Each chip = bordered rounded pill with a leading SVG glyph. Generated date = export-time wall-clock; Images Utilized = `summary.attachments.count` (regions actually used by sampler); Animations Configured = `documentation.animationTracks.length` (NOT `summary.animations.count` — this counts entries the user authored on tracks, matching the user's mental model of "configured for runtime"); Optimized Assets = `summary.peaks.length`; Atlas Pages = `atlasPreview.totalPages` and `maxPagePx` = max(page dim) across pages.
  3. **Optimization Config card + General Notes card** — side-by-side row, cards with rounded borders. Optimization Config shows: shield-glyph header, `<N>%` Safety Buffer (from `documentation.safetyBufferPercent`, integer rendered with `%`), `<X.X>%` Space Savings (from the existing OptimizeDialog `savingsPct` formula in Phase 19 D-09 — `(1 - sumOutPixels/sumSourcePixels) * 100`). General Notes shows speech-bubble glyph + `<documentation.generalNotes>` rendered as a `<pre>` element (whitespace + newlines preserved).
  4. **Animation Tracks card** — full-width. Header: clock-glyph + "Animation Tracks". Body: HTML `<table>` with columns ANIMATION NAME / MIX TIME / LOOP / NOTES. Track grouping rendered as accent-dotted divider rows: `● TRACK <N>` (terracotta dot + monospace label). Per-entry row: animation name, `<mixTime>s`, blue LOOP pill when `loop=true` (otherwise blank dash), notes text.
  5. **Control Bones card + Skins card** — side-by-side row. Control Bones uses bone-glyph header + per-entry: terracotta bone name (monospace) + muted description below. Skins uses layered-stack-glyph header + per-entry: blue skin name (monospace) + muted description below.
  6. **Events card** — sibling row to Control Bones + Skins, ONLY rendered when `skeletonData.events.length > 0`. Bell-glyph header + per-event: terracotta event name (monospace) + muted description below. (User's screenshot has no events, so the visual is intuited from the bones/skins precedent.)

- **D-19:** Icons = inline SVG glyphs ONLY. Zero `<img>` tags, zero base64 blobs. Pattern verbatim from Phase 19 D-08:
  ```html
  <svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5"
       stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">
    <!-- per-glyph paths -->
  </svg>
  ```
  Distinct glyph per section: clock for tracks, bone for control bones, layered-stack for skins, shield for optimization config, speech-bubble for general notes, bell for events; chip-strip glyphs: doc-icon (Generated), image-icon (Images Utilized), film-icon (Animations Configured), lightning (Optimized Assets), map-icon (Atlas Pages). All glyphs use `stroke="currentColor"` so the parent's text color drives the visual.

- **D-20:** Filename = `<skeletonBasename>.html` where `skeletonBasename` is the skeleton JSON filename without extension (e.g. `JOKER_CHARACTER.json` → `JOKER_CHARACTER.html`). OS save dialog (`dialog.showSaveDialog`) pre-fills `defaultPath` as `<lastOutDir>/<skeletonBasename>.html`. User can rename / re-locate. `lastOutDir` from session state (already persists per Phase 8 D-145); falls back to OS Documents when null. Atomic write via Pattern-B from `src/main/project-io.ts:248-254` and `src/main/image-worker.ts:289`: `writeFile(<finalPath>.tmp, html, 'utf8')` → `rename(<finalPath>.tmp, <finalPath>)`.

- **D-21:** HTML export module location = `src/main/doc-export.ts`. Pure-TS templating (template-literal-driven `renderDocumentationHtml(payload): string`); NO React in main process. Payload type defined in `src/core/documentation.ts` (Layer 3 — pure types) and assembled by main from `(documentation, summary, atlasPreview, exportPlan)` at export-click time. Test surface: `tests/main/doc-export.spec.ts` — golden-file output for the SIMPLE_TEST fixture documentation.

### Safety Buffer (Scope-Honest Decision)

- **D-22:** `safetyBufferPercent: number` field is part of the documentation slot (D-01). UI: a single number input (range 0–100, integer or one-decimal accepted) inside the Sections pane — user sets the value. Persistence: round-trips via the slot. HTML export: rendered in the Optimization Config card (D-18 sub-step 3) as `<N>% Safety Buffer`. **NO export-math wiring this phase** — `buildExportPlan` and `src/renderer/src/lib/export-view.ts` are NOT touched. Rationale: the wiring would couple Phase 20 to the locked memory `project_phase6_default_scaling.md` (uniform single-scale; the `× (1 + safetyBufferPercent/100)` multiplier must still respect the ≤1.0 clamp), and would creep into Phase 22's neighborhood. Backlog 999.7 (Deferred Ideas section) captures the future export-math wiring.

### Claude's Discretion

- Drag-image visual when dragging an animation from the side list (browser-default vs custom): use browser-default (set nothing on `dataTransfer.setDragImage`). Custom drag images need `effectAllowed='copy'` + an offscreen image — overkill for first DnD in repo.
- Number-input UX for mixTime + safetyBufferPercent: standard `<input type="number">` with `step` attribute (`0.05` for mixTime, `0.5` for safetyBufferPercent). No spinner customization.
- Filter input for control-bones list (D-10): debounced 100ms substring match on bone name (case-insensitive). Pure renderer-side filter; no IPC.
- Track-add UX: a button below the last track row labeled "+ Add Track". On click, append a new empty track container with the next integer index. Removing a track: a small ✕ button on the track header; if entries exist, confirm via plain `window.confirm` (no new dialog modal).
- HTML chip-strip date format: `DD/MM/YYYY` matching the user's screenshot (`14/04/2026`). Locale-aware fallback via `Intl.DateTimeFormat` if needed; explicit format wins for screenshot fidelity.
- LOOP pill class string: `inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-blue-500/15 text-blue-400` (rendered inline in the HTML — Tailwind classes are converted to literal CSS in the inline `<style>` block, NOT a Tailwind v4 build dependency).
- Modal close behavior with unsaved changes: leverage existing Phase 8 dirty-guard at the AppShell level — don't add a doc-modal-local dirty guard. The dirty flag flips when `Save changes` commits the modal-local doc copy into AppSessionState; the existing SaveQuitDialog/onClose paths handle the rest.

### Folded Todos

None — `gsd-sdk query todo.match-phase 20` returned `count: 0`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract

- `.planning/REQUIREMENTS.md` §DOC-01..DOC-05 (lines 47-51) — five locked acceptance criteria; verbatim wording is the test surface.
- `.planning/ROADMAP.md` §"Phase 20: Documentation Builder feature" (lines 363-388) — Goal, Depends on, Background, Scope, Severity, Success Criteria (5 numbered items at lines 380-384).
- `CLAUDE.md` — fact #4 (math phase does not decode PNGs — note: HTML export does NOT decode PNGs either, all data is from `summary` + `atlasPreview` projections); fact #5 (`core/` is pure TypeScript, no DOM); fact #6 (samplingHz default 120 Hz — relevant for the snapshot if snapshot ever shows samplingHz; current D-22 chose `safetyBufferPercent` as the primary "config" line so samplingHz is informational only).

### Schema + persistence (the D-148 slot — locked)

- `src/core/project-file.ts:84-202` — existing `validateProjectFile` per-field hand-rolled guards. D-04 extends this function inline; new `validateDocumentation` helper from `src/core/documentation.ts` is called at line 144 (after the existing documentation-is-object check passes).
- `src/core/project-file.ts:239-256` — `serializeProjectFile`. Currently writes `documentation: {}` (line 254). D-01 changes this to write the full 6-key shape sourced from `state.documentation` (which AppSessionState gains as a new field).
- `src/core/project-file.ts:321-339` — `materializeProjectFile`. Currently passes `file.documentation` through verbatim (line 335). D-01 keeps this passthrough; the typed shape comes from D-04's validator extension.
- `src/shared/types.ts:640-651` — `ProjectFileV1`. Field `documentation: object` (line 650) becomes `documentation: Documentation` where `Documentation` is the new typed import from `src/core/documentation.ts`.
- `src/shared/types.ts:660-669` — `AppSessionState`. Currently DOES NOT carry documentation (Phase 8 noted "stamped by serializeProjectFile"). Phase 20 ADDS `documentation: Documentation` to `AppSessionState` so the renderer can read/edit/persist; D-01 D-22 implications.
- `src/shared/types.ts:7-15` — D-21 file-top docblock locking structuredClone-safety. `Documentation` interface MUST contain only primitives, arrays, and nested plain objects; `crypto.randomUUID()` returns a string, fine.
- `src/shared/types.ts:535-571` — `SerializableError` 8-kind discriminated-union envelope (D-158/D-171). D-04 reuses `ProjectFileParseError` (line 555) for malformed documentation — NO new 9th kind.

### Renderer surface (existing code this phase modifies)

- `src/renderer/src/components/AppShell.tsx:1184-1196` — Documentation button placeholder (Phase 19 D-03). Phase 20 removes the `disabled` attribute, the `aria-disabled="true"`, and the `title="Available in v1.2 Phase 20"`, and adds `onClick={() => setDocumentationBuilderOpen(true)}`. Class string preserved verbatim (Phase 19 D-18 outlined-secondary).
- `src/renderer/src/components/AppShell.tsx:158` — `useState` modal lifecycle pattern. Phase 20 adds `const [documentationBuilderOpen, setDocumentationBuilderOpen] = useState(false);` parallel to `atlasPreviewOpen`.
- `src/renderer/src/components/AppShell.tsx:1136-1149` — sticky-header tab-strip pattern. D-13 reuses class string + ARIA discipline verbatim for the modal's 3-pane tab strip.
- `src/renderer/src/modals/OverrideDialog.tsx:60-150` — closest 5-modal ARIA scaffold analog for D-14 (multi-state body + footer actions; smaller footprint than OptimizeDialog).
- `src/renderer/src/modals/OptimizeDialog.tsx:269-281` — multi-state-body 5-modal ARIA scaffold analog for D-14 (closer match for D-13's tab-state-switching body).
- `src/renderer/src/hooks/useFocusTrap.ts` — focus-trap + Escape handler. Used verbatim in `DocumentationBuilderDialog`.
- `src/renderer/src/index.css:47-71` — `@theme inline` token block. NEW renderer-only colors NOT needed (every D-17 color is sourced from existing tokens or literal hex matching them).

### Main-side new surface

- `src/main/doc-export.ts` (NEW per D-21) — pure-TS HTML templating. Inputs: `(documentation: Documentation, summary: SkeletonSummary, atlasPreview: AtlasPreviewProjection, exportPlan: ExportPlan | null)`. Output: `string` (HTML). Tests: `tests/main/doc-export.spec.ts` golden-file.
- `src/main/project-io.ts:39, 248-254` — atomic write Pattern-B (`writeFile(<path>.tmp, ...) → rename`). D-20 reuses this pattern for HTML write — extract a small `atomicWriteUtf8(absPath, content): Promise<void>` helper if it cleans up the call-site, or inline the 4-line pattern (planner's call).
- `src/main/image-worker.ts:289` — Pattern-B prior art (D-121).
- `src/main/ipc.ts` — register a new IPC channel `'documentation:exportHtml'` mirroring the existing `'project:save'` shape (open save dialog, atomic write, return success/error envelope).

### Existing SkeletonSummary surface (auto-discovery sources)

- `src/shared/types.ts:466-506` — `SkeletonSummary`:
  - `bones: { count: number; names: string[] }` — D-10 source.
  - `skins: { count: number; names: string[] }` — D-11 source.
  - `animations: { count: number; names: string[] }` — D-05/D-06 source (drag-from-list side list).
  - `attachments.count` — D-18 chip "Images Utilized" (sub-step 3 chip strip).
  - `peaks: DisplayRow[]` — `peaks.length` is D-18 chip "Optimized Assets" (sub-step 3 chip strip).
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56` — `events: EventData[]`. D-09 source. NOTE: `SkeletonSummary` does NOT currently expose events. Phase 20 EXTENDS `SkeletonSummary` with `events: { count: number; names: string[] }` populated in `src/main/summary.ts` (mirror for `bones` / `skins` / `animations`); D-09 reads `summary.events.names`. Researcher: confirm `EventData.name` is the canonical identifier (it is in 4.2).
- `src/core/atlas-preview.ts:124-155` — `usedPixels` / `totalPixels` / `totalPages` for D-18 chip "Atlas Pages" + Optimization Config card "Space Savings" (sub-step 3).

### Locked invariants (do not violate)

- `tests/arch.spec.ts:19-34` (Layer 3 grep gate) — renderer NEVER imports `src/core/*` except for `'../shared/types.js'` (which the new `Documentation` type lives in via re-export through shared/types.ts — see researcher note: `Documentation` defined in `src/core/documentation.ts` and re-exported through `src/shared/types.ts` to keep renderer imports legal).
- `tests/arch.spec.ts:116-134` (forbidden-import grep on `src/core/*`) — `src/core/documentation.ts` MUST NOT import `node:fs`, `electron`, `sharp`, or DOM types. Pure-TS only.
- 5-modal ARIA scaffold (verbatim across the 9 existing modals — OverrideDialog, OptimizeDialog, AtlasPreviewModal, SaveQuitDialog, SettingsDialog, HelpDialog, UpdateDialog, ConflictDialog, plus DocumentationBuilderDialog as the 10th) — `role="dialog"` + `aria-modal="true"` + outer overlay `onClick=onClose` + inner `stopPropagation` + `useFocusTrap`. Preserve verbatim.
- Tailwind v4 literal-class discipline (Phase 19 RESEARCH Pitfall 3 + 8) — every renderer-side className is a string literal or `clsx` with literal branches. The HTML-export inline `<style>` block is NOT subject to this (it's a static string in main).
- structuredClone-safe IPC contract (D-21 file-top docblock at `src/shared/types.ts:7-15`) — every field added to `Documentation` and `AppSessionState` MUST be a primitive, array, or nested plain object. No Maps, no class instances. `crypto.randomUUID()` returns a string — fine.
- Locked memory `project_phase6_default_scaling.md` — uniform single-scale, never extrapolate. Phase 20 does NOT touch export math (D-22) so this is untouched.
- CLAUDE.md fact #5 — `core/` is pure TS, no DOM. New `src/core/documentation.ts` honors this.

### Reference implementations (reuse verbatim or near-verbatim)

- `src/renderer/src/modals/OverrideDialog.tsx:60-150` — 5-modal ARIA scaffold + useFocusTrap + simple state. Best small-footprint analog for `DocumentationBuilderDialog` skeleton.
- `src/renderer/src/modals/OptimizeDialog.tsx:269-281` — 5-modal ARIA scaffold for the multi-state body (D-13 tab-switching).
- `src/main/project-io.ts:218-260` — atomic write Pattern-B + `dialog.showSaveDialog` precedent for HTML export (D-20).
- `src/renderer/src/components/AppShell.tsx:1136-1149` — tab-strip pattern (D-13).
- `src/renderer/src/components/AppShell.tsx:158, 1184-1196` — modal lifecycle + button-wiring pattern (Phase 19 D-03 → Phase 20 enable).
- `.planning/phases/19-ui-improvements-ui-01-05/19-CONTEXT.md` (D-09/D-10 InfoCard tile pattern + D-17 filled-primary CTA + D-18 outlined-secondary).
- `.planning/phases/19-ui-improvements-ui-01-05/19-PATTERNS.md` (analog map + literal-class discipline + SVG glyph pattern at lines 232-258 — directly applicable to D-19 inline SVG icons).

### Background docs (read for full context)

- `.planning/milestones/v1.0-phases/08-save-load-project-state/08-CONTEXT.md` (D-148 reservation rationale at lines 119-126, 242, 251) — original "documentation: object" slot reasoning.
- `.planning/milestones/v1.0-phases/08-save-load-project-state/08-PATTERNS.md` — Phase 8 atomic-write + validator + structuredClone discipline.
- `.planning/seeds/SEED-001-atlas-less-mode.md` — Phase 21 context (does NOT block Phase 20; mentioned for adjacent-phase awareness).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- 5-modal ARIA scaffold pattern (`src/renderer/src/modals/OverrideDialog.tsx`, `OptimizeDialog.tsx`, `AtlasPreviewModal.tsx`, `SaveQuitDialog.tsx`, `SettingsDialog.tsx`, `HelpDialog.tsx`, `UpdateDialog.tsx`, `ConflictDialog.tsx`) — verbatim reuse for the 10th modal `DocumentationBuilderDialog.tsx`.
- `useFocusTrap` hook (`src/renderer/src/hooks/useFocusTrap.ts`) — focus + Escape; reused.
- Outlined-secondary button class string at `src/renderer/src/components/AppShell.tsx:1184` — already on the disabled placeholder; Phase 20 keeps the class string, removes `disabled` + `aria-disabled` + `title`.
- Phase 19 sticky-header tab-strip pattern at `AppShell.tsx:1136-1149` — verbatim reuse for the modal's 3-pane tab strip.
- Phase 19 `InfoCard` 3-tile pattern (`src/renderer/src/modals/OptimizeDialog.tsx`'s summary tiles + `AtlasPreviewModal.tsx:384-392`) — the modal MAY use a similar pattern for an internal summary row inside the Animation Tracks pane (Claude's Discretion); not required.
- Phase 19 SVG glyph pattern (`stroke="currentColor"`, viewBox=20 20, hand-rolled paths) — D-19 reuses this for both renderer-side icons in the modal AND HTML-export icons.
- Atomic write Pattern-B at `src/main/project-io.ts:248-254` and `src/main/image-worker.ts:289` — verbatim reuse for HTML export atomic write (D-20).
- `dialog.showSaveDialog` precedent at `src/main/project-io.ts:143-208` — verbatim reuse for HTML export save dialog (D-20).
- Hand-rolled validator pattern at `src/core/project-file.ts:84-202` (`validateProjectFile`) — D-04 extends with new sub-shape guards.
- Forward-only migration ladder pattern at `src/core/project-file.ts:216-225` (`migrate`) — Phase 20 does NOT bump to v2; the documentation slot was reserved for forward-compat (D-148).

### Established Patterns

- `crypto.randomUUID()` available in Electron renderer + Node 18+ main without polyfill — the chosen `id` strategy (D-02) requires this; researcher to confirm zero polyfill needed in the project's Electron build target.
- structuredClone-safe IPC discipline — D-21 docblock; the new `Documentation` interface obeys (primitives + arrays + plain objects only).
- Tab strip ARIA pattern from Phase 19 sticky-header — `role="tablist"` / `role="tab"` / `aria-selected` discipline. D-13 reuses verbatim inside the modal body.
- `useState` modal lifecycle in AppShell — D-13's `documentationBuilderOpen` parallels `atlasPreviewOpen` at `AppShell.tsx:158`.
- Inline SVG glyphs (Phase 19 D-08) — D-19 source pattern.
- `summary.bones.names` / `summary.skins.names` / `summary.animations.names` — auto-discovery sources for D-09/D-10/D-11 and the side list for D-06.
- `node:fs/promises` writeFile + rename atomic write idiom — D-20 reuses.
- `dialog.showSaveDialog` pattern with `defaultPath` pre-fill — D-20 reuses.

### Integration Points

- `AppShell.tsx:1189-1196` — Documentation placeholder button → Phase 20 wires `onClick={() => setDocumentationBuilderOpen(true)}`, removes `disabled`/`aria-disabled`/`title`. State at `AppShell.tsx:158` parallels `atlasPreviewOpen`.
- `AppSessionState` (`src/shared/types.ts:660-669`) → ADDS `documentation: Documentation` field. Triggers a one-line addition in every site that constructs `AppSessionState` (search: roughly 5-7 sites between AppShell load/save handlers).
- `serializeProjectFile` (`src/core/project-file.ts:239-256`) → line 254's `documentation: {}` literal becomes `documentation: state.documentation`.
- `validateProjectFile` (`src/core/project-file.ts:135-144`) → after the existing object-shape guard at line 144, INSERT `const docResult = validateDocumentation(obj.documentation); if (!docResult.ok) return { ok: false, error: docResult.error };`.
- `materializeProjectFile` (`src/core/project-file.ts:321-339`) → line 335's `documentation: file.documentation` stays the same (the validator is the gate; downstream code can trust the shape).
- `summary.ts` (`src/main/summary.ts`) → ADDS `events: { count, names }` to the SkeletonSummary IPC payload (mirrors existing bones/skins/animations construction).
- `src/main/ipc.ts` → REGISTERS new IPC channel `'documentation:exportHtml'` for D-20/D-21.
- `src/renderer/src/api.d.ts` (or wherever the `window.api` shape lives) → ADDS `exportDocumentationHtml(payload): Promise<{ ok: true; path: string } | { ok: false; error: ... }>`.

</code_context>

<specifics>
## Specific Ideas

- The user provided a screenshot of a Spine Documentation HTML export titled "CHJWC_SYMBOLS" on 2026-05-01. The screenshot is the locked visual reference for D-17 + D-18. Specifics observed:
  - Title row: doc-icon + "Spine Documentation /" (white) + "CHJWC_SYMBOLS" (terracotta `#e06b55`).
  - Chip strip: clock-glyph "Generated: 14/04/2026"; image-glyph "174 Images Utilized"; film-glyph "23 Animations Configured"; lightning-glyph "170 Optimized Assets"; map-glyph "4 Atlas Pages (2048px)".
  - Optimization Config card: shield-glyph green header; "1%" Safety Buffer (large white, monospace); "91.7%" Space Savings with "Estimated Reduction" sub-label.
  - General Notes card: speech-glyph teal header; freeform body "This version had texture improvements and animation clean-up."
  - Animation Tracks card: clock-glyph header; table with columns ANIMATION NAME / MIX TIME / LOOP / NOTES; track sections rendered as terracotta-dot dividers `● TRACK 0`, `● TRACK 1`, `● TRACK 2`; per-row example: "8/PRIZE  0.25s  [LOOP pill]  Keeps playing perpetually".
  - Control Bones card: bone-glyph terracotta header; entries like `CTRL_GOLDEN_SLOT` (terracotta monospace) + "This bone controls de position of the special Golden Slot symbol" (muted body text).
  - Skins card: layered-stack-glyph blue header; entries like `GRAND` (blue monospace) + "Skin for Grand Jackpot symbol" (muted).
  - Layout: dark stone background (`#1c1917`-ish), card surfaces slightly lighter (`#23201d`-ish), subtle rounded borders.
- Date format on the chip strip is `DD/MM/YYYY` (matches the screenshot's `14/04/2026`).
- The "Animations Configured" chip count (23) does NOT match the per-row table (which shows 6 tracked animations across 3 tracks). The user's intent: "Animations Configured" = `documentation.animationTracks.length` (count of tracked entries), even though the screenshot's number suggests it might actually be `summary.animations.count`. **Locking interpretation:** the chip counts USER-AUTHORED documentation entries, NOT the rig's total animation count. If the user meant the latter, the chip wording would be "Animations Available" or "Animations". Researcher: flag this as a narrow ambiguity for verification before implementation; if the user prefers `summary.animations.count`, swap one variable in `doc-export.ts`.
- Safety buffer rendering: the screenshot shows "1%" (integer with `%`). D-22's UI accepts integer or one-decimal; HTML rendering uses `%` suffix; one-decimal values render as e.g. "1.5%".
- The user named the safety buffer concept based on his old Spine 3.8 experience: certain textures rendered with less sharpness at peak scale; +3% solved it. Phase 20 ships the field as metadata only (D-22) and parks the export-math wiring as backlog 999.7.

</specifics>

<deferred>
## Deferred Ideas

- **999.7 — Safety buffer global multiplier in export math.** Phase 20 ships the `safetyBufferPercent` field in the documentation slot as metadata + UI + HTML snapshot only. A future phase wires `effectiveScale × (1 + safetyBufferPercent/100)` into `buildExportPlan` (`src/core/export.ts`) and the byte-identical renderer copy `src/renderer/src/lib/export-view.ts`. The ≤1.0 clamp from Phase 6 Gap-Fix Round 1 must still bind after the multiplier (locked memory `project_phase6_default_scaling.md` — uniform single-scale; never extrapolate). Once that phase lands, the field is already there in every saved `.stmproj` — zero migration.

- **Click-to-add fallback for HTML5 native DnD.** Phase 20 ships drag-only per DOC-02 verbatim. A future a11y-polish phase could add a `+` button next to each animation in the side list (appends to the active track) for keyboard / screen-reader users. NOT shipped this phase; logged here so the gap is explicit.

- **Atlas page thumbnails embedded in HTML export.** A future polish phase could render a small base64-encoded thumbnail per atlas page below the chip strip. Adds `sharp` dependency to the HTML export path (already used in Phase 6 Optimize) and ~50 KB per page. Decision postponed — text + SVG icons only this phase per D-19.

- **Markdown in generalNotes textarea.** Phase 20 ships plain-text `<pre>` rendering. A future polish phase could parse Markdown (CommonMark, no HTML allowed) and render rich text in the export. NOT shipped this phase.

- **Search/filter inside the doc surface.** Filter input is in the modal's bones list (D-10 Claude's Discretion) but no global doc-level filter. Future polish phase could add per-pane filters (filter tracks by animation name, filter events by description text, etc.).

- **PDF / multi-format export.** Phase 20 ships HTML only. PDF export would need a print-friendly stylesheet variant + a Chromium-print-to-PDF flow. NOT shipped this phase.

</deferred>

---

*Phase: 20-documentation-builder-feature*
*Context gathered: 2026-05-01*
