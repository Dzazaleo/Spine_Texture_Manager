---
name: Phase 8 — Save/Load project state Context
description: Locked decisions for Phase 8 — explicit Save / Save As to a `.stmproj` file (JSON), persists skeleton path + atlas/images root + overrides + samplingHz + last-used outDir + sort state + reserved `documentation: {}` slot. Toolbar buttons + Cmd/Ctrl+S+O. Drag-drop project file via existing DropZone. Dirty guard on close + new-skeleton-drop. Hand-rolled validation. Forward-only schema migration ladder. Relative paths. Locate-skeleton picker on missing rig. Stale overrides dropped with one-time notice. samplingHz field reserved (Phase 9 ships the Settings UI that mutates it).
phase: 8
---

# Phase 8: Save/Load project state — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 8` interactive session

<domain>
## Phase Boundary

Phase 8 introduces **session persistence** (F9) — the user can save the working state of a loaded skeleton to a project file (`.stmproj`, JSON), close the app, reopen the file, and resume with overrides + settings restored. F9.1 requires the file to carry skeleton path, atlas/images root, overrides, and settings (samplingRate). F9.2 requires Load to restore overrides + settings and re-run the sampler. The ROADMAP exit criterion is the round-trip: set overrides → Save → close app → Load → overrides restored.

Ships `src/core/project-file.ts` (pure-TS schema definition, hand-rolled `validateProjectFile` + `serializeProjectFile`, version field + forward-only migration ladder, path-relativization helpers; no `fs`, no Electron, no DOM), `src/main/project-io.ts` (main-process `dialog.showSaveDialog` + `showOpenDialog` + `fs.readFile/writeFile` wiring, atomic write via `<path>.tmp` + rename, atlas auto-rediscovery on missing path), four new IPC channels (`project:save`, `project:save-as`, `project:open`, `project:open-from-path`) wired into [src/main/ipc.ts](src/main/ipc.ts), preload `Api` extensions, `Save` + `Open` toolbar buttons in [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) next to `Optimize Assets` + `Atlas Preview`, Cmd/Ctrl+S + Cmd/Ctrl+O global shortcuts, dirty-state tracking + filename-chip dirty marker, dirty-guard confirm dialog wired to Electron's `before-quit` and the DropZone's pre-load hook, DropZone branching to detect `.stmproj` vs `.json`, and a "Locate skeleton" inline recovery flow when the saved path is missing.

Phases 0–7 are LOCKED. Sampler stays untouched. CLI stays byte-for-byte (Phase 5 D-102). Layer 3 (`core/` DOM/fs-free) preserved — `src/core/project-file.ts` does pure schema math; only `src/main/project-io.ts` touches `fs` and `dialog`. Hand-rolled discipline (Phase 2 D-28, Phase 4 D-81) extends to validation: no `zod`, no schema library.

**In scope:**

- `src/core/project-file.ts` — **new pure-TS module**. Exports:
  - `type ProjectFileV1` — top-level shape (see `<decisions>` §Schema for fields).
  - `type ProjectFile = ProjectFileV1` (single-version alias today; the union grows as new versions land).
  - `validateProjectFile(unknown): { ok: true; project: ProjectFile } | { ok: false; error: { kind: 'invalid-shape' | 'unknown-version' | 'newer-version'; message: string } }` — hand-rolled type guard mirroring [src/main/ipc.ts](src/main/ipc.ts):97 `validateExportPlan` discipline. Validates schema version FIRST, then routes to per-version field guards.
  - `migrate(project: ProjectFile): ProjectFileV1` — forward-only migration ladder. Phase 8 ships v1 only, so this is a passthrough; the ladder skeleton is in place for v2.
  - `serializeProjectFile(state: AppSessionState, projectFilePath: string): ProjectFileV1` — folds AppShell state + skeleton/atlas paths into the v1 shape, relativizing paths against `projectFilePath` directory.
  - `materializeProjectFile(file: ProjectFileV1, projectFilePath: string): MaterializedProject` — the inverse; resolves relative paths back to absolute against `projectFilePath` directory.
  - Plus pure helpers: `relativizePath(absolutePath, basedir)`, `absolutizePath(relativePath, basedir)`. Both handle the cross-volume case (Windows different drive letter, macOS different mount) by falling back to absolute storage.
  - No `fs`, no `path` from node (pure string math via `node:path/posix`-style joins is fine — `node:path` is platform-aware but contains no I/O so Layer 3 grep tolerates it; planner verifies against `tests/arch.spec.ts` patterns).
- `src/shared/types.ts` — **extension target**. Add:
  - `ProjectFileV1` shape (also exported from `src/core/project-file.ts`; types live in shared so renderer + main agree without crossing Layer 3).
  - `SaveResponse = { ok: true; path: string } | { ok: false; error: SerializableError }`.
  - `OpenResponse = { ok: true; project: MaterializedProject } | { ok: false; error: SerializableError }`.
  - Extend `SerializableError` `kind` with `'ProjectFileNotFoundError' | 'ProjectFileParseError' | 'ProjectFileVersionTooNewError' | 'SkeletonNotFoundOnLoadError'`.
  - `MaterializedProject` — the in-memory shape (absolute paths, AppSessionState fields ready to mount).
- `src/main/project-io.ts` — **new**. Exports:
  - `handleProjectSave(state: AppSessionState, currentPath: string | null): Promise<SaveResponse>` — if `currentPath` set, write directly; else trigger save-as flow.
  - `handleProjectSaveAs(state: AppSessionState, defaultDir: string, defaultBasename: string): Promise<SaveResponse>` — invokes `dialog.showSaveDialog({ defaultPath: <skeletonDir>/<basename>.stmproj, filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }] })`, then writes via atomic `<path>.tmp` + `fs.rename` pattern (matches Phase 6 image-worker pattern).
  - `handleProjectOpen(): Promise<OpenResponse>` — `dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }] })` → reads file → JSON.parse → `validateProjectFile` → `migrate` → `materializeProjectFile` → `loadSkeleton` (re-uses existing Phase 1 loader, with atlas auto-rediscovery if saved atlas path missing) → return.
  - `handleProjectOpenFromPath(absolutePath: string): Promise<OpenResponse>` — same as above but skips the dialog (used by drag-drop entry point).
  - `handleLocateSkeleton(originalPath: string): Promise<{ ok: true; newPath: string } | { ok: false }>` — when load surfaces `SkeletonNotFoundOnLoadError`, renderer invokes this to open a file picker filtered to `.json` so the user can re-point.
- `src/main/ipc.ts` — **touched**. Register `'project:save'`, `'project:save-as'`, `'project:open'`, `'project:open-from-path'`, `'project:locate-skeleton'`. All wrap typed-error envelopes per D-10. Imports from `./project-io.js`.
- `src/preload/index.ts` — **touched**. Extend the contextBridge `Api` interface with:
  - `saveProject: (state, currentPath) => Promise<SaveResponse>`
  - `saveProjectAs: (state, defaultDir, defaultBasename) => Promise<SaveResponse>`
  - `openProject: () => Promise<OpenResponse>`
  - `openProjectFromPath: (absolutePath) => Promise<OpenResponse>`
  - `locateSkeleton: (originalPath) => Promise<{ ok: true; newPath: string } | { ok: false }>`
- `src/renderer/src/components/AppShell.tsx` — **major touch**:
  - Two new toolbar buttons: `Save` (disabled when no skeleton loaded; shows dirty marker via filename-chip when applicable) + `Open`. Positioned next to `Optimize Assets` / `Atlas Preview` in the existing top chrome.
  - `currentProjectPath: string | null` state — null means "new untitled session" → next Save triggers Save As.
  - `isDirty: boolean` derived state — true when `overrides`, `samplingHz`, `lastOutDir`, `sortColumn`, or `sortDir` differ from the last-saved snapshot. Clears to false after successful Save / Open. Title chip renders `<basename>` with a leading `•` when dirty (e.g., `• MyRig.stmproj`).
  - Cmd/Ctrl+S + Cmd/Ctrl+O global keyboard listener (window-level `keydown`, default-prevented when modifiers match). Cmd+S routes to Save (or Save As when path null). Cmd+O routes to Open.
  - Save / Open click handlers wire to `window.api.saveProject` / `window.api.openProject` and update state on success.
  - Dirty-guard on new-skeleton-drop: DropZone's pre-load hook checks `isDirty`; if true, opens the same confirm dialog Save-before-quit uses.
  - Stale-override notice: post-load, computes `intersection(savedOverrides.keys, summary.peaks.attachmentNames)`. Dropped keys surface in a dismissible inline banner above the panels: `"N saved overrides skipped — attachments no longer in skeleton: GHOST, OLD_HAT"`.
- `src/renderer/src/components/DropZone.tsx` — **touched**. Branch on dropped file extension:
  - `.json` → existing `loadSkeletonFromFile` flow (with dirty-guard pre-check).
  - `.stmproj` → new `openProjectFromPath` flow (with dirty-guard pre-check).
  - Other → existing rejection.
- `src/renderer/src/components/SaveQuitDialog.tsx` (or fold into existing modal scaffolding) — **new**. Hand-rolled ARIA confirm dialog with three buttons: `Save` (calls saveProject then proceeds), `Don't Save` (proceeds with the pending action), `Cancel` (aborts the pending action). Used for both new-skeleton-drop and app-close flows. Returns a promise resolved by the button click. ARIA pattern: clones `OverrideDialog` per Phase 4 D-81.
- `src/main/index.ts` — **touched**. Wire Electron's `app.on('before-quit', e => …)` to ask the renderer (via IPC roundtrip `'project:check-dirty-before-quit'`) whether quit should proceed. Standard Electron pattern: `e.preventDefault()` on first call, render the dialog, `app.quit()` on user-confirmed proceed. Single-window assumption holds (Phase 1 D-23 cross-platform; only one BrowserWindow).
- `src/main/index.ts` — **also touched**. macOS only: register `app.on('open-file', …)` so double-clicking a `.stmproj` in Finder opens it (deferred to Phase 9 if planner decides; OS file-association registration via `electron-builder` config is also Phase 9 polish — see Out of Scope).
- Tests:
  - `tests/core/project-file.spec.ts` — **new**. Cases: (a) round-trip — `serializeProjectFile(state, '/a/b/c.stmproj')` → `materializeProjectFile(serialized, '/a/b/c.stmproj')` → equal state; (b) relative path: skeleton at `/a/b/SIMPLE.json`, project at `/a/b/SIMPLE.stmproj` → stored as `./SIMPLE.json`; (c) cross-volume fallback: skeleton at `/Volumes/Other/foo.json`, project at `/Users/x/proj.stmproj` → stored as absolute `/Volumes/Other/foo.json`; (d) `validateProjectFile` rejects: missing version field, unknown version, missing required field, wrong field type; (e) `validateProjectFile` accepts: minimal v1 file (only required fields), full v1 file (all optional fields); (f) `migrate` is identity on v1; (g) hygiene grep — no `fs`/`spine-core`/`sharp`/Electron imports in `src/core/project-file.ts`; (h) reserved `documentation: {}` slot is preserved on round-trip.
  - `tests/main/project-io.spec.ts` — **new**. Mocked dialog + fs cases: (a) save → tmp file appears, then renames to final path; (b) save with existing currentPath → no dialog; (c) save-as → dialog opens with correct defaultPath; (d) open valid file → `loadSkeleton` invoked with materialized path; (e) open file with missing skeleton → returns `'SkeletonNotFoundOnLoadError'`; (f) open file with newer schema version → returns `'ProjectFileVersionTooNewError'`; (g) open file with malformed JSON → returns `'ProjectFileParseError'`; (h) atlas auto-rediscovery: saved atlas path missing → loader's existing F1.2 sibling-detection runs.
  - `tests/arch.spec.ts` — Layer 3 auto-scans new files. Add `dialog`, `electron`, `fs`, `node:fs` to the forbidden-in-`src/core/*` list if not already present.
  - Renderer test (planner's call, consistent with prior phases): Save/Open button click → preload calls; dirty marker renders when state mutates; SaveQuitDialog three-branch flow; Cmd/Ctrl+S+O shortcut handlers fire; stale-override banner renders with correct count + names.
  - **End-to-end round-trip integration test** — required by ROADMAP exit criterion. Either as a vitest test that drives the IPC layer headless (preferred — matches Phase 6 testing style) OR as a deferred manual UAT script in the phase summary. Planner's call.

**Out of scope (deferred to later phases or explicit Out of Scope per REQUIREMENTS.md):**

- **Documentation builder feature** — tracklists, mix time, skin descriptions, authoring UI. Phase 8 only RESERVES the top-level `documentation: {}` slot in the schema so the doc-builder phase can fill it without a schema bump. The doc-builder is its own future phase (added to Deferred Ideas).
- **Active tab / collapse state / search query / scroll position / focus / selection persistence** — Phase 9 polish.
- **Window size / position persistence** — Phase 9. Window state is app-global, not per-project.
- **Recent projects menu / "reopen last project on launch"** — Phase 9. Phase 8 only handles user-driven open/save.
- **Multi-window / multi-project** — Phase 1 D-23 single-window assumption holds. Out of MVP.
- **Auto-save / scratch file for crash recovery** — Phase 9 if requested. Phase 8 explicit-only.
- **Settings modal UI** — Phase 9. Phase 8 reserves the `samplingHz` field; nothing in Phase 8 mutates it (defaults to 120 always).
- **OS file association registration (`.stmproj` double-click in Finder/Explorer opens the app)** — Phase 9 polish, requires `electron-builder` config + macOS `open-file` event handler + Windows registry entry. Phase 8 ships the file-handling code so the registration drop-in is a config-only diff.
- **Project-file diff / merge / version control integrations** — out of scope, not requested.
- **Backup of source PNGs / atlases as part of the project file** — out of scope; project file only stores paths and overrides, never copies asset bytes.
- **Encryption / signing of project files** — out of scope.
- **CLI save/load** — `scripts/cli.ts` stays byte-for-byte (Phase 5 D-102).
- **Animation Breakdown panel changes / Global panel column changes / OverrideDialog changes** — none.

</domain>

<decisions>
## Implementation Decisions

### Save UX & entry points (Area 1)

- **D-140: Toolbar `Save` + `Open` buttons + Cmd/Ctrl+S + Cmd/Ctrl+O global shortcuts.** Two new buttons in the AppShell top chrome next to the `Optimize Assets` / `Atlas Preview` buttons (Phase 6/7 toolbar pattern). Cmd/Ctrl+S → Save (Save As if no current path); Cmd/Ctrl+O → Open. Window-level `keydown` listener with `event.preventDefault` + `event.stopPropagation` when modifiers match — kept renderer-side (no Electron menu wiring). Rejected: app-menu (would force `autoHideMenuBar: false` from Phase 1 — bigger chrome delta); shortcuts-only (discoverability hit); buttons-only (Cmd+S muscle memory missing). Native menu wiring is a Phase 9 polish drop-in if requested.

- **D-141: Explicit Save / Save As — no auto-save.** First Save (with `currentProjectPath === null`) opens `showSaveDialog` to pick a location; subsequent Saves write to the same path silently. Save As always re-prompts and updates `currentProjectPath`. Dirty marker (`•` prefix on the filename chip) signals unsaved changes. Matches Photoshop / After Effects / Spine Editor itself. Rejected: auto-save-on-every-change (silent overwrites confuse, can't experiment without committing); hybrid scratch-file recovery (significant complexity for crash-recovery — defer to Phase 9). Implementation note: `currentProjectPath` lives in AppShell state alongside `overrides` (parallel to D-74).

- **D-142: Open via toolbar button OR drag-drop the `.stmproj` file onto DropZone.** DropZone branches on the dropped file's extension: `.json` → existing skeleton-load path; `.stmproj` → new `openProjectFromPath` path; other → existing rejection. Both entry points run through the same dirty-guard (D-143). Rejected: open-button-only (less convenient — drop pattern already exists for skeletons); drop-only (inconsistent with Save having a button).

- **D-143: Dirty-guard on app close + new-skeleton-drop + new-project-drop.** Cmd+Q / window close with `isDirty === true` → native-style confirm modal with `Save / Don't Save / Cancel`. Standard Electron `before-quit` + `e.preventDefault()` flow: main asks renderer via IPC roundtrip (`'project:check-dirty-before-quit'`), renderer either resolves immediately (clean) or mounts the dialog and resolves on user click. Same dialog mounts when a new skeleton OR a new project is dropped onto the dirty session. Rejected: prompt-on-close-only (dropped-over-work case stings); no prompts (too aggressive for explicit-save model). Implementation: hand-rolled ARIA modal cloning OverrideDialog (Phase 4 D-81 hand-rolled discipline).

- **D-144: Dirty marker rendering.** Filename chip in AppShell top chrome renders with a leading `•` (U+2022) when `isDirty === true`. Examples: `MyRig.stmproj` (clean) vs `• MyRig.stmproj` (dirty). When `currentProjectPath === null`, chip reads `Untitled` (clean) or `• Untitled` (dirty). Tooltip / hover title surfaces the absolute path when set. Rejected: separate dirty badge component (over-engineered for a single character).

### State scope (Area 2)

- **D-145: Project file persists exactly these fields.** F9.1 essentials + the agreed extras + reserved doc-builder slot. Schema fields:
  - `version: 1` — schema version (D-152).
  - `skeletonPath: string` — relative to project file directory; absolute fallback if cross-volume (D-151).
  - `atlasPath: string | null` — the resolved `.atlas` location at save time. `null` when the loader auto-discovered it from the skeleton's siblings (avoids stale absolute paths). On Load the loader re-runs auto-discovery (D-150) regardless; this field is a hint only.
  - `imagesDir: string | null` — same semantics as `atlasPath` for the images folder.
  - `overrides: Record<string, number>` — serialized form of the AppShell `Map<attachmentName, percent>` (Phase 4 D-73/D-74). JSON has no Map type; renderer/main convert to/from `Object.fromEntries`/`new Map(Object.entries(...))` at the IPC boundary.
  - `samplingHz: number | null` — D-146.
  - `lastOutDir: string | null` — last-used Optimize Assets output directory (Phase 6 deferred-to-Phase-8 item). Stored absolute (output dirs are user-picked and may legitimately live anywhere — relativization adds no value).
  - `sortColumn: string | null` — Global panel sort column key.
  - `sortDir: 'asc' | 'desc' | null` — Global panel sort direction. Phase 4 D-91 default is `(attachmentName, asc)`; persisting both fields means restoring exactly what the user left vs the default.
  - `documentation: object` — D-148. Reserved slot, always written as `{}` in v1.
  - All fields except `version`, `skeletonPath`, `overrides`, `documentation` are optional/nullable on read — missing or null reads as "use default". Required fields surface `'invalid-shape'` if missing.

- **D-146: `samplingHz` field reserved (Phase 9 ships the Settings UI that mutates it).** F9.1 explicitly names settings (sampling rate). Phase 8 schema includes `samplingHz: number | null`. Save writes the current value (always 120 in Phase 8 since no UI mutates it); Load reads it and threads into `sampleSkeleton({ samplingHz })`. Phase 9's Settings modal then writes the same field with no schema bump. Rejected: omit-until-Phase-9 (forces a schema version bump in Phase 9 — extra ladder rung for no benefit); persist-hardcoded-120-always (field-present-but-inert is awkward; nullable + default is cleaner). Default-on-absent: `samplingHz === null || undefined → 120`.

- **D-147: Defer all ephemeral UI state to Phase 9.** Active tab, collapsed cards, search query, scroll position, focus animation/attachment, selected rows — none of these go in the project file. They reset on load (consistent with the existing AppShell mount-on-drop reset model — D-50, D-64, D-74). Rationale: keeps Phase 8's surface focused on F9.1, smaller migration burden, fewer "why did this restore?" surprises. Phase 9 polish can revisit if user testing flags any of them as missed.

- **D-148: Reserve top-level `documentation: {}` empty slot in v1 schema.** The user identified a future "documentation builder" feature (tracklists, mix time, skin descriptions, authoring UI). Phase 8 writes `documentation: {}` into every v1 file so the doc-builder phase can fill the sub-shape without a schema version bump. Phase 8 reads/preserves the field on round-trip. Validation: `validateProjectFile` accepts any object value (including non-empty) for `documentation` — the field is opaque to Phase 8. Rejected: don't-reserve-only-preserve-unknown (more general but doesn't give the doc-builder phase a guaranteed slot); both-reserve-and-preserve-unknown (preserve-unknown across the entire top-level shape adds round-trip discipline that's overkill for a single planned extension point). Doc-builder is its own future phase, added to Deferred Ideas.

### Stale-data handling on Load (Area 3)

- **D-149: Missing skeleton on Load → inline error + "Locate skeleton…" file picker.** When `loadSkeleton` throws `SkeletonJsonNotFoundError` because the saved relative-resolved-to-absolute path is gone, the renderer surfaces an inline error banner: `Skeleton not found at <path>`. A `Locate skeleton…` button opens `dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Skeleton JSON', extensions: ['json'] }] })`. If the user picks a file, app substitutes the new path, re-resolves atlas/images siblings via the existing F1.2 loader path, re-samples, applies overrides (with stale-key handling per D-150). The new path goes into `currentProjectPath`-side state and the file gets written back on next Save (which the dirty marker now signals). Rejected: hard-error refuse-to-load (punishes the common move-folder case); silently load just the overrides (phantom state with no rendered rig — confusing).

- **D-150: Stale-override keys (saved overrides reference attachments no longer in the re-sampled skeleton) → drop + one-time dismissible notice.** After re-sampling, compute `staleKeys = Array.from(savedOverrides.keys()).filter(name => !summary.peaks.some(r => r.attachmentName === name))`. Drop them from the active map. Surface a dismissible inline banner above the panels: `N saved overrides skipped — attachments no longer in skeleton: GHOST, OLD_HAT, …`. (Cap names at 5 with `+ M more` if longer.) The dropped overrides are NOT written back on next Save — they're gone after the user clicks Save. Rejected: silent-drop-no-notice (loses diagnostic signal — user may not realize their TRIANGLE override on a renamed attachment is gone); preserve-stale-in-file (file accumulates dead entries, needs an "inactive overrides" UI surface to make them visible — premature UI); refuse-to-load-modal (extra friction on a common case).

- **D-151: Schema version mismatch — older file: migrate; newer file: refuse.** App owns a forward-only migration ladder in `src/core/project-file.ts` (`migrate(project): ProjectFileV1`). Phase 8 ships v1; the ladder is a passthrough until v2 lands. A file with `version > 1` returns `{ ok: false, error: { kind: 'newer-version', message: 'This project was saved by a newer version of Spine Texture Manager — please update.' } }` from `validateProjectFile`. The IPC envelope translates to `SerializableError` with `kind: 'ProjectFileVersionTooNewError'`. Renderer surfaces the message in the inline error banner with no recovery affordance. Rejected: best-effort-load-with-warnings (fragile when newer schemas change semantics); strict-version-match (terrible UX every time the schema evolves).

- **D-152: Missing atlas/images path on Load → re-run loader's existing auto-discovery (F1.2).** Treat the saved `atlasPath` / `imagesDir` as hints, not requirements. After resolving the skeleton path, always invoke the existing Phase 1 loader's sibling-detection logic (atlas + images folder next to the JSON). If auto-detection fails, surface the existing `AtlasNotFoundError` banner. Rationale: the saved atlas is almost always at the conventional sibling location anyway; auto-discovery handles the "I moved the rig folder" case without extra logic. Saved paths get refreshed on next Save. Rejected: use-saved-path-verbatim-error-if-missing (rigid); try-saved-then-auto-discover (masks "something changed" from the user — more brittle).

### File location, format, versioning (Area 4)

- **D-153: Default save location = skeleton's parent directory; user picks each Save.** First Save → `dialog.showSaveDialog({ defaultPath: <skeletonDir>/<skeletonBasename>.stmproj, filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }] })`. User accepts or relocates. Project files travel with the rig folder — zip the rig dir, the `.stmproj` comes along. Matches how Spine Editor itself stores `.spine` files near the assets. Rejected: default to `~/Documents` (decouples project from rig, less natural for asset-bound workflow); auto-save in `app.getPath('userData')` (conflicts with explicit Save / Save As model from D-141, hides the file from the user).

- **D-154: File extension `.stmproj` (Spine Texture Manager Project), JSON content inside.** Custom extension lets the OS recognize the file; future `electron-builder` config (Phase 9 polish) registers the file type so double-click opens in the app. Plain JSON inside — human-readable, diff-able, easy to back up. Project files are tiny (a few KB even on rigs with hundreds of overrides). Rejected: `.spxm` (cryptic); plain `.json` (DropZone has to peek at content to disambiguate from skeleton JSONs — error-prone); binary (MessagePack etc) (premature optimization, loses inspectability).

- **D-155: Paths inside the file are relative to the project file's directory; absolute fallback for cross-volume.** Standard pattern (Premiere, Resolve, Spine Editor). `relativizePath(absolute, basedir)` returns `./SIMPLE.json` when basedir contains the file, `./assets/foo.json` for nested, `../shared/bar.json` for sibling-of-parent, falls back to the absolute path when the rig is on a different volume / drive letter than the project file. `absolutizePath(stored, basedir)` is the inverse — handles both relative (`./...`, `../...`) and absolute (`/...` on POSIX, `C:\...` on Windows) inputs. Rejected: absolute-only (breaks the moment user moves the rig folder — locate-skeleton picker rescues this but bites every time); both-relative-and-absolute-stored (slightly bigger file, defensive belt-and-suspenders not justified for the simple path math).

- **D-156: Hand-rolled type guards, no runtime dependency.** Single `validateProjectFile(unknown): { ok, project } | { ok: false, error }` function in `src/core/project-file.ts`, mirroring [src/main/ipc.ts](src/main/ipc.ts):97 `validateExportPlan` discipline. Per-version dispatch on the `version` field; each version has its own field-shape guard. Migration ladder is a `switch` on the version. Consistent with the project's hand-rolled-over-deps discipline (Phase 2 D-28, Phase 4 D-81). Project file shape is small enough (10 fields, 1 nested map) that hand-rolling is mechanical. Rejected: `zod` (adds dependency, inconsistent with discipline, schema isn't large enough to justify); trust-the-shape-no-validation (confusing failures for users editing the file by hand or for files corrupted by partial-write).

### Claude's Discretion (not locked)

- **Atomic write strategy detail.** Phase 6 image-worker uses `<path>.tmp` + `fs.rename`. Project save should mirror this (any abrupt termination during write leaves the previous file intact). Planner verifies the rename atomicity guarantee on Windows + macOS + Linux is acceptable for a non-critical settings file (per node docs, `fs.rename` is atomic on the same filesystem on POSIX; Windows is best-effort).
- **Where the dirty-state derivation lives** — pure equality check via `useMemo` against a `lastSaved` snapshot in AppShell, vs deep comparison utility, vs reference-equality on individual fields. Planner picks; lean toward `useMemo` with explicit field-by-field comparison (the field set is small and fixed per D-145).
- **Stale-override banner styling and lifetime** — dismiss-button vs auto-clear-on-next-save vs auto-clear-on-tab-switch. Planner picks; recommend a dismiss button that also auto-clears on save.
- **Whether `currentProjectPath` resets on new-skeleton-drop** — when the user accepts the dirty-guard prompt and drops a different skeleton, does the app start a new untitled session (`currentProjectPath = null`) or keep the existing project bound to the new rig? Recommend: reset to null. The project file is rig-bound conceptually; loading a different rig produces a different project. Planner verifies this matches the user's mental model after the first manual UAT.
- **Filename-chip behavior when `currentProjectPath === null`** — render `Untitled` literal vs render the skeleton basename vs render nothing. Recommend `Untitled` (consistent with the rest of the app's text discipline).
- **Cmd+S binding scope** — global `keydown` on `window` vs scoped to AppShell. Recommend window-level since the OverrideDialog / OptimizeDialog / AtlasPreviewModal can be open and Cmd+S should still work; but planner verifies modal-open-Cmd+S doesn't trigger an unexpected save while a dialog has focus (probably should suppress when any modal is open).
- **OS file-association registration** — Phase 9 polish drop-in (electron-builder config + macOS `open-file` event handler + Windows `defaultProtocols`). Planner can include the wiring scaffold (the `open-file` listener that calls `openProjectFromPath`) but the actual electron-builder config is out of scope.
- **Dirty-state granularity** — does changing the active tab dirty the project? Per D-147, active tab is NOT in the schema, so changing it should NOT dirty. Planner verifies the dirty derivation is computed only against fields in D-145.
- **Default sort column key string** — Phase 4 D-91 names the default `(attachmentName, asc)`. Planner picks the exact string (`'attachmentName'` vs `'name'` vs whatever the panel currently uses) and matches it across Save / Load.
- **Renderer test framework** — Testing Library vs happy-dom plain DOM. Inherits Phase 4/6/7 decision (whatever the suite currently uses).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth

- `.planning/REQUIREMENTS.md` §F9 — Functional requirements F9.1 (session JSON contents) + F9.2 (Load restores overrides + settings, recomputes peaks).
- `.planning/ROADMAP.md` §"Phase 8: Save/Load project state" — Deliverables (session JSON schema, main-process file dialog, restore overrides + settings + re-run sampler) + exit criteria (round-trip).
- `.planning/PROJECT.md` §"Tech stack (locked)" + §"Key architectural decisions" — Layer 3 invariant (`core/` is pure TypeScript, no DOM); Electron + TypeScript + React; hand-rolled-over-deps discipline.
- `CLAUDE.md` §"Critical non-obvious facts" — Sampler lifecycle (#3); `core/` is pure TypeScript no DOM (#5); default sampler rate 120 Hz configurable in Settings (#6).

### Prior phase context (decisions Phase 8 inherits)

- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md` — D-09 webUtils.getPathForFile pattern for drag-drop file resolution; D-23 single-window cross-platform; D-43 DropZone full-window pattern; Tailwind v4 warm-stone tokens (D-12, D-14).
- `.planning/phases/04-scale-overrides/04-CONTEXT.md` — D-73 override key = `attachmentName`; D-74 overrides Map state lives in AppShell; D-75 `src/core/overrides.ts` pure-TS; D-81 hand-rolled ARIA dialog discipline; D-91 percent-as-fraction-of-source-dimensions semantics + dialog prefill rules + default sort `(attachmentName, asc)`.
- `.planning/phases/06-optimize-assets-image-export/06-CONTEXT.md` — D-10 IPC envelope discriminated union; D-117 Optimize Assets toolbar button entry pattern; D-122 dialog.showOpenDialog folder picker; deferred-to-Phase-8 last-used outDir (Out of Scope §"Save/Load of last-used outDir").
- `.planning/phases/07-atlas-preview-modal/07-CONTEXT.md` — D-134 toolbar button click → modal mount pattern; D-131 modal snapshots state at open.

### Source code touchpoints

- `src/main/ipc.ts` — Existing IPC handler patterns (`ipcMain.handle`, typed-error envelope, `validateExportPlan` hand-rolled type guard at line 97). New IPC handlers extend this file.
- `src/main/index.ts` — `app.whenReady`, BrowserWindow creation, `protocol.handle` for app-image. New `before-quit` listener wires here.
- `src/main/image-worker.ts` — Atomic write pattern (`<path>.tmp` + `fs.rename`) — project save reuses this idiom.
- `src/core/loader.ts` — F1.2 atlas/images sibling auto-discovery. Project file's atlas auto-rediscovery on missing path (D-152) reuses this entry point.
- `src/core/sampler.ts` — `samplingHz` option default 120 Hz (line 86, 139, 141). Project file's `samplingHz` field (D-146) threads into `sampleSkeleton({ samplingHz })`.
- `src/core/overrides.ts` — `clampOverride` + `applyOverride` pure functions. Project file's `overrides` field is keyed by `attachmentName` per Phase 4 D-73 (no transformation needed at save/load — JSON Object ↔ JS Map).
- `src/shared/types.ts` — `SerializableError` discriminated union (D-10), `Api` interface for preload contextBridge, `LoadResponse` envelope pattern. Phase 8 extends all three.
- `src/renderer/src/components/AppShell.tsx` — Top chrome (filename chip + toolbar buttons), `overrides` state (line 71), DropZone wrapping. Save/Open buttons + dirty marker + Cmd/Ctrl+S+O listener wire here.
- `src/renderer/src/components/DropZone.tsx` — Drop handler. Branches on `.json` vs `.stmproj` per D-142.
- `src/renderer/src/modals/OverrideDialog.tsx` — Reference ARIA modal pattern (focus-trap, ESC, click-outside, role=dialog, aria-modal=true) per Phase 4 D-81. SaveQuitDialog clones this pattern.
- `tests/arch.spec.ts` — Layer 3 boundary grep for forbidden imports in `src/core/*` and `src/renderer/*`. Add `dialog`/`electron`/`fs`/`node:fs` to forbidden-in-`src/core/*` if not present.

### Electron API references

- [Electron `dialog.showSaveDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogbrowserwindow-options) — file save picker.
- [Electron `dialog.showOpenDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options) — file open picker.
- [Electron `app.on('before-quit')`](https://www.electronjs.org/docs/latest/api/app#event-before-quit) — dirty-guard interception point.
- [Electron `app.on('open-file')`](https://www.electronjs.org/docs/latest/api/app#event-open-file-macos) — macOS file-association handler (Phase 9 drop-in).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **Hand-rolled IPC validator pattern** — `validateExportPlan(plan: unknown): string | null` in [src/main/ipc.ts](src/main/ipc.ts):97 establishes the shape-validation idiom Phase 8 mirrors for `validateProjectFile(unknown): { ok, project } | { ok: false, error }`.
- **Typed-error envelope (D-10)** — every IPC handler returns `{ok: true, ...} | {ok: false, error: SerializableError}`. Phase 8's four new handlers (`saveProject`, `saveProjectAs`, `openProject`, `openProjectFromPath`) extend this without inventing a new contract.
- **`dialog.showOpenDialog`** — [src/main/ipc.ts](src/main/ipc.ts):289 shows the existing `pickOutputDirectory` pattern. `dialog.showSaveDialog` for project file uses the same pattern with different filters.
- **Atomic write `.tmp` + `fs.rename`** — [src/main/image-worker.ts](src/main/image-worker.ts) export pipeline. Project save reuses the idiom for crash-safe writes.
- **`loadSkeleton` with sibling auto-discovery** — [src/core/loader.ts](src/core/loader.ts) F1.2 logic auto-detects `.atlas` and `images/` next to the JSON. Project Load reuses this entry point with no modification.
- **`OverrideDialog` ARIA pattern** — [src/renderer/src/modals/OverrideDialog.tsx](src/renderer/src/modals/OverrideDialog.tsx) hand-rolled focus-trap, ESC, click-outside, role=dialog, aria-modal=true (Phase 4 D-81). SaveQuitDialog and any new modals clone this.
- **AppShell toolbar button slot** — [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) hosts `Optimize Assets` (Phase 6) and `Atlas Preview` (Phase 7) buttons next to the filename chip. Save/Open join the same row.
- **DropZone drop handler** — [src/renderer/src/components/DropZone.tsx](src/renderer/src/components/DropZone.tsx) handles single `.json` drop today. Extends to branch on extension.
- **`Api` contextBridge interface** — [src/shared/types.ts](src/shared/types.ts) `Api` interface (lines ~310+) is the canonical preload surface. Phase 8 extends with five methods.

### Established patterns

- **Layer 3 boundary** — `src/core/*` no DOM, no Electron, no `fs`, no `sharp`; `src/renderer/*` no `src/core/*` direct imports (renderer-side mirror modules in `src/renderer/src/lib/*-view.ts`); `src/main/*` is the only place `electron`/`fs`/`sharp` are allowed. Project file: `src/core/project-file.ts` is pure-TS schema; `src/main/project-io.ts` does I/O; renderer talks via preload.
- **Hand-rolled discipline** (Phase 2 D-28, Phase 4 D-81) — no modal libs, no schema libs unless they save >60 lines of boilerplate. `validateProjectFile` is hand-rolled.
- **State scoping** — overrides Map in AppShell as plain `useState`, no Context, no Zustand (Phase 4 D-74). `currentProjectPath` and `lastSaved` snapshot follow the same pattern.
- **Reset-on-drop** — AppShell unmounts when AppState transitions through idle/loading (Phase 1), so all session-only state resets naturally on new skeleton load. Phase 8 adds the dirty-guard pre-check before allowing the unmount transition.
- **Tailwind v4 `@theme` tokens** — `--color-panel`, `--color-border`, `--color-fg`, `--color-fg-muted`, `--color-accent`, `--color-danger` (Phase 5). New buttons + banners use these tokens, no new colors.

### Integration points

- **`src/main/index.ts`** — Wire `app.on('before-quit')` for the dirty-guard. Wire `app.on('open-file', ...)` (macOS) as a Phase 9 drop-in slot.
- **`src/main/ipc.ts`** — Five new `ipcMain.handle` registrations.
- **`src/preload/index.ts`** — Five new `contextBridge` methods.
- **`src/shared/types.ts`** — New `ProjectFileV1` shape, new envelopes, extended `SerializableError` kinds, extended `Api` interface.
- **`src/renderer/src/components/AppShell.tsx`** — New buttons, new state (`currentProjectPath`, `lastSaved`, `staleOverrides` notice), new keyboard listener, new DropZone branching pre-check, new dirty-guard modal mount.
- **`src/renderer/src/components/DropZone.tsx`** — Extension-branching in the drop handler.

</code_context>

<specifics>
## Specific Ideas

- **Doc-builder forward-compat:** the user explicitly named a future "documentation builder" feature (tracklists, mix time, skin descriptions, etc.) and asked the project file to carry that data when it ships. Phase 8 reserves a top-level `documentation: {}` empty slot now so the doc-builder phase doesn't need a schema version bump (D-148).
- **Save UX feel reference:** "matches Photoshop / After Effects / Spine Editor itself" — explicit Save with dirty marker, no surprise auto-save, file lives near the assets it references. Project files travel with the rig folder.
- **Locate-skeleton recovery:** the inline error + file-picker flow (D-149) maps directly to the "I moved my project folder" workflow — assumed to be the most common stale-data scenario for an asset-bound desktop tool.

</specifics>

<deferred>
## Deferred Ideas

- **Documentation builder feature** (user-flagged 2026-04-25): authoring UI for tracklists, mix times, skin descriptions, and other rig-level metadata. Stored in the project file's reserved `documentation: {}` slot (D-148). Its own future phase — probably post-MVP given the current ROADMAP ends at Phase 9 (complex-rig hardening + polish). Should be added to the backlog when Milestone 1 closes.
- **Recent projects menu / "reopen last project on launch"** — Phase 9 polish.
- **Window size + position persistence** — Phase 9. Stored app-globally (not per-project file).
- **Active tab / collapsed cards / search query / scroll position / focus / selection persistence** — Phase 9 polish if user testing flags any as missed.
- **Auto-save / scratch-file crash recovery** — Phase 9 if requested.
- **OS file-association registration** (`.stmproj` double-click in Finder/Explorer opens the app) — Phase 9 polish via `electron-builder` config + macOS `app.on('open-file')` handler + Windows registry. Phase 8 ships the file-handling code so the registration drop-in is config-only.
- **Native app-menu wiring** (File → Save / Open / Recent Projects) — Phase 9 polish. Requires flipping `autoHideMenuBar` from Phase 1's locked default.
- **Multi-window / multi-project** — out of MVP. Phase 1 D-23 single-window assumption holds.
- **Project-file diff / merge / version control integrations** — out of scope.
- **Backup of source PNGs / atlases as part of the project file** — out of scope; project file only stores paths and overrides.
- **Encryption / signing of project files** — out of scope.
- **CLI save/load** — out of scope; CLI stays byte-for-byte (Phase 5 D-102).
- **"Inactive overrides" UI surface** (showing dropped-but-preserved stale overrides) — would be needed if D-150 had picked the preserve-stale-in-file option; deferred since we drop them.

</deferred>

---

*Phase: 08-save-load-project-state*
*Context gathered: 2026-04-25*
