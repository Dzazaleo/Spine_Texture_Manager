---
id: SEED-009
status: dormant
planted: 2026-05-15
planted_during: post-v1.5 close (v1.5.1 candidate)
trigger_when: v1.5.1 milestone scope (paired with Phase 40 polish carry-forwards) — unblocks in-app validation of exported atlases
scope: Medium
---

# SEED-009: Spine animation viewer (JSON player) — in-app exported-atlas validation

## Why This Matters

Phase 40 (atlas-repack-output, shipped v1.5) added `loose | atlas | both` export
modes — animators can ship packed atlases directly from optimized regions
without round-tripping through the Spine editor. But there's no in-app way to
**confirm the exported `.atlas` + page PNG(s) render correctly**. Users
currently have to:

1. Export from this app
2. Open the result in the Spine editor (or a separate runtime preview)
3. Visually compare against the source project
4. Come back to this app if something's wrong

That round-trip defeats the closed-loop promise of size-driven optimization.
Adding a viewer closes the validation loop natively: the user sees the
animated character playing back from the exported assets, side-by-side (or
toggleable) with the source, and trusts the export.

This also de-risks future export-mode work. Right now any rotation /
dedup / pack-layout bug in Phase 40 only surfaces via human eye in
external tools (we hit 3 UAT rounds before catching the rotation
direction was inverted). A viewer puts that feedback loop inside the app.

## When to Surface

**Trigger:** v1.5.1 milestone scope — paired with the 8 deferred Phase 40
polish items already logged in `STATE.md` under "v1.5 user-deferred":

- WR-03 (atlas fields dropped on locate-skeleton recovery)
- WR-04 (atlas fields not in ResampleArgs)
- WR-05 (writtenPaths rollback no outDir-containment check)
- WR-07 (regionBuffers non-null assertion)
- IN-01 (duplicate pageFilename helper)
- IN-02 (regionBuffers memory hygiene)
- IN-03 (deriveProjectName error message)
- IN-04 (duplicate-outPath warning emits success)

The viewer is the headline feature; the 8 polish items are the cleanup pass
the same milestone can fold in cheaply.

## Scope Estimate

**Medium** — one phase if shipped as a standalone modal, two phases if the
split-pane source-vs-optimized comparison is in scope. Most of the runtime is
provided by Esoteric's official `@esotericsoftware/spine-player` library; the
project work is the React integration, asset-feed wiring, and UX (mount
location, controls, lifecycle).

## Reference Implementation (external)

`/Users/leo/Documents/WORK/CODING/spine-skin-swap` did this for a Python +
PyQt + WebView stack:

- `src/spine_skin_swap/gui/viewer/assets/viewer.html` (≈60 lines) — shell
  page with loading state + canvas container
- `src/spine_skin_swap/gui/viewer/assets/viewer.js` (≈412 lines) — wraps
  `spine-player.js`, manages skin/animation selection
- `src/spine_skin_swap/gui/viewer/assets/spine-player.js` (≈15,232 lines)
  — vendored copy of Esoteric's official web player
- `src/spine_skin_swap/gui/viewer/web_view.py` — QWebEngineView host
- `src/spine_skin_swap/gui/viewer/bridge.py` — Python↔JS bridge for project
  loading via custom scheme handler

**Translation to this codebase is easier** because we're already Electron +
React + TypeScript:

- `@esotericsoftware/spine-core@^4.2.0` already in `package.json` deps
  (same family as spine-player; player builds on core)
- `@esotericsoftware/spine-player` is npm-installable (or vendor the same
  way the Python reference does — see decision point D-01 below)
- No WebView bridge required: a React component can wrap the player
  directly and use `file://` to load the user's `.json/.atlas/.png` from
  the source dir or the post-export output dir

## Locked Design Facts (do not relitigate during spec/discuss)

1. **Use Esoteric's official spine-player library**, not a hand-rolled
   renderer. We are NOT in the business of writing a Spine runtime; the
   player is the reference implementation and free.
2. **spine-player ≠ spine-core.** We already use spine-core (math /
   sampling). The player is a separate package that builds atop spine-core
   and adds the WebGL rendering, animation playback controls, and skin
   selection UI. They coexist; we add the player as a sibling.
3. **The viewer is read-only.** No edit operations. It's a validation
   surface, not an authoring surface.
4. **The viewer does not replace `AtlasPreviewModal`.** That modal shows
   the static atlas layout (regions, packing). The viewer shows the
   animation playing back. Different jobs.

## Open Decisions (defer to /gsd-discuss-phase)

**D-01: npm dep vs vendored copy**
- Option A: `npm install @esotericsoftware/spine-player` → version-tracked
  in package.json, auto-updates with Spine releases
- Option B: vendor `spine-player.js` into `src/renderer/src/vendor/`
  → no surprise upstream changes; matches Python reference pattern;
  manual update step

**D-02: Standalone modal vs split-pane comparison**
- Option A: `AnimationPlayerModal.tsx` (sibling to AtlasPreviewModal /
  OptimizeDialog) → simpler, ships sooner
- Option B: split-pane "source vs exported" comparison view → richer
  validation UX; user sees the optimization's visual cost directly
- Option C: third tab alongside Global / Animation Breakdown → integrates
  into the main flow rather than being modal

**D-03: Mount location**
- Option A: top-bar button next to "Atlas Preview" / "Optimize Assets"
  (right-aligned cluster at `AppShell.tsx:2087-2090`)
- Option B: tab alongside Global / Animation Breakdown
  (`AppShell.tsx:5-9` header tab strip)
- Option C: both — button opens modal, tab embeds inline view

**D-04: Asset feed**
- Option A: always source project (the currently-open `.json` + its
  `images/` + atlas)
- Option B: always post-export output dir (validates the actual exported
  artifact)
- Option C: user-selectable via radio in the viewer (source / exported /
  both side-by-side)

## REQ-ID Namespace

**VIEWER-01..0N** (tentative; `/gsd-spec-phase` finalizes). Suggested split:

- VIEWER-01 — Vendor or npm-add spine-player (D-01 outcome)
- VIEWER-02 — React component wrapper around spine-player
- VIEWER-03 — Asset-feed plumbing (project → player input)
- VIEWER-04 — Mount point (modal / tab per D-03)
- VIEWER-05 — Animation + skin selection controls
- VIEWER-06 — Playback controls (play / pause / scrub)
- VIEWER-07 — Source vs exported comparison (if D-02 picks B/C)
- VIEWER-08 — Lifecycle (open / close / dispose / re-mount on project change)
- VIEWER-09 — Error states (missing atlas, missing PNGs, malformed JSON)

## Breadcrumbs

Code already in place that this phase will extend:

- [package.json](package.json) — `@esotericsoftware/spine-core@^4.2.0` already
  installed; spine-player would be the sibling add
- [src/renderer/src/modals/](src/renderer/src/modals/) — 9 existing modals;
  AtlasPreviewModal.tsx is the closest pattern analog for an Esc-to-close
  visual modal
- [src/renderer/src/modals/AtlasPreviewModal.tsx](src/renderer/src/modals/AtlasPreviewModal.tsx)
  — read-only visual modal precedent (Phase 7 D-130/D-134); the viewer's UX
  shape should mirror this (Esc-to-close, focus trap, click-outside-to-close)
- [src/renderer/src/components/AppShell.tsx:2087-2090](src/renderer/src/components/AppShell.tsx#L2087-L2090)
  — toolbar-button cluster where the persistent "Atlas Preview" /
  "Optimize Assets" buttons live (D-03 Option A mount point)
- [src/renderer/src/components/AppShell.tsx:5-9](src/renderer/src/components/AppShell.tsx#L5-L9)
  — tab-strip docblock (D-51 ordering); D-03 Option B mount point
- [src/core/atlas-preview.ts](src/core/atlas-preview.ts) +
  [src/renderer/src/lib/atlas-preview-view.ts](src/renderer/src/lib/atlas-preview-view.ts)
  — existing atlas-preview compositor; pattern for the renderer-side
  visual surface
- External reference:
  `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/`
  — Python+WebView implementation of this exact feature; mine for UX
  decisions (status overlay, loading state, skin/animation switcher)
- Related memories:
  [[project_strict_loadermode_separation]],
  [[project_atlas_less_primary_workflow]],
  [[project_spine_4_2_atlas_json_precedence]]

## Notes

- Phase 40 shipped through 3 rounds of human UAT specifically because the
  user could not see the exported atlas in-app. This seed is the "build the
  feedback loop" answer to that pain.
- The viewer is naturally Phase 40's spiritual sibling: 40 produces the
  artifact, this phase validates it. Together they close the optimize →
  pack → validate loop.
- Vendoring spine-player.js (D-01 Option B) is the Python reference's
  choice; the rationale was that the WebView's JS world is sandboxed from
  the host's npm tree. We don't have that constraint — npm is the natural
  default for an Electron renderer.
- v1.5.1 framing (vs v1.6 / v1.5-with-Phase-41 / new milestone) is the
  user's call at `/gsd-new-milestone` time. The viewer is meaty enough to
  justify a milestone of its own; pairing with the 8 deferred polish items
  makes v1.5.1 a coherent "Phase 40 follow-on" release.
- Next concrete step: `/gsd-new-milestone v1.5.1` to scope, then
  `/gsd-spec-phase` for the viewer phase.
