# Phase 8: Save/Load project state — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `08-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 08-save-load-project-state
**Areas discussed:** Save UX & entry points, State scope, Stale-data handling, File location/format/versioning

---

## Save UX & entry points

### Q1 — Where should Save / Load live in the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar buttons + Cmd/Ctrl+S+O | Two new buttons next to filename chip / Optimize Assets / Atlas Preview, matching established Phase 6/7 toolbar pattern. Cmd/Ctrl+S = Save, Cmd/Ctrl+O = Open. Most discoverable; Cmd+S is muscle memory. Load via button OR drag-drop the .json project file onto the window (reuses Phase 1 DropZone). | ✓ |
| Toolbar buttons only, no shortcuts | Just buttons. Skip keyboard shortcuts entirely — Phase 9 polish concern. Simpler to ship but Cmd+S is so universal that not having it feels broken. | |
| Shortcuts only, no toolbar buttons | Cmd/Ctrl+S + Cmd/Ctrl+O without toolbar buttons. Discoverability suffers; toolbar already crowded; rejected unless minimal chrome desired. | |
| App menu (File → Save / Open) | Native macOS/Windows menu bar via Electron's Menu API. App currently uses `autoHideMenuBar: true` (Phase 1) so no menu bar exists. Adding it expands chrome. Most native-feeling but biggest delta from current scaffold. | |

**User's choice:** Toolbar buttons + Cmd/Ctrl+S+O (Recommended)
**Notes:** Locked into D-140.

### Q2 — Save behavior — explicit, automatic, or hybrid?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Save / Save As only | User triggers Save deliberately. First Save → showSaveDialog picks file location; subsequent Save writes to same path. Save As always re-prompts. Dirty marker (•) on filename chip when there are unsaved changes. Matches Photoshop / After Effects / Spine itself. Predictable, no surprise writes. | ✓ |
| Auto-save on every change | Every override edit / setting change writes immediately. No 'unsaved changes' state. Requires deciding the file location upfront or auto-pick a path. Risk: silent overwrites confuse users; can't experiment without committing. | |
| Hybrid: explicit save, but auto-save as scratch | Explicit Save is the user-facing model, BUT app also writes a .scratch session in app data dir periodically so a crash doesn't lose work. Recoverable on next launch. Adds significant complexity; punt to Phase 9. | |

**User's choice:** Explicit Save / Save As only (Recommended)
**Notes:** Locked into D-141. Hybrid scratch-save deferred to Phase 9.

### Q3 — How does the user load a saved project?

| Option | Description | Selected |
|--------|-------------|----------|
| Open button + drag-drop the project file | Cmd/Ctrl+O or Open button → showOpenDialog filtered to project file extension. ALSO accept drag-drop of the project file onto the existing DropZone (DropZone branches: skeleton .json vs project file). Two natural entry points. | ✓ |
| Open button only | No drag-drop integration. Simpler DropZone (skeleton-only). Slightly less convenient but no risk of misclassifying a file. | |
| Drag-drop only (no Open button) | DropZone handles both skeleton and project files. No explicit Open. Inconsistent with Save having a button. | |

**User's choice:** Open button + drag-drop (Recommended)
**Notes:** Locked into D-142.

### Q4 — When does the app prompt to save unsaved changes?

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt on app close + on new-skeleton-drop | Cmd+Q / window close with unsaved changes → native confirm dialog (Save / Discard / Cancel). Dropping a NEW skeleton onto a dirty session → same prompt. Standard desktop-app contract. | ✓ |
| Prompt on app close only | Close confirm yes; new-drop silently replaces. Simpler but the 'oops I dropped over my work' case stings. | |
| No prompts — trust the user | No dirty guard. Lose work if you forget to save. | |

**User's choice:** Prompt on app close + on new-skeleton-drop (Recommended)
**Notes:** Locked into D-143. Also covers new-project-drop (D-143 extended scope).

---

## State scope

### Q1 — F9.1 mandates skeleton path + atlas/images root + overrides + samplingRate. What else should the project file persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Last-used Optimize Assets outDir | Phase 6 noted this as deferred-to-Phase-8. Saves the user re-picking the export folder every session. Persists per-project, not globally. | ✓ |
| Active tab (Global vs Animation Breakdown) | Restores which panel was open. Tiny payload; smooth resume experience. | |
| Sort column / direction (Global panel) | Phase 4 D-91 locked default sort = (attachmentName, asc). Persisting user's chosen sort means reload feels like 'where I left off'. | ✓ |
| Window size / position | Restore the BrowserWindow geometry. Stored per-project file? Or globally in app data dir? Mixing window state into the project file is unusual — most apps store this app-globally. Probably belongs in Phase 9. | |
| **(Free text)** Documentation builder data | "We are going to have a documentation builder (tracklists, mix time, skins descriptions, etc). When we create this feature, I want all the info for the documentation to be stored in the file as well." | ✓ |

**User's choice:** Last-used outDir + sort column/direction + (free-text) doc-builder data
**Notes:** Doc-builder ask handled separately as a future-phase reservation (Q4 below). Active tab + window size deferred to Phase 9. Locked into D-145 + D-147.

### Q2 — Phase 9 owns the Settings modal UI. Should Phase 8 persist samplingHz now?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — persist as nullable field, default 120 if absent | F9.1 explicitly names settings (sampling rate). Project file has `samplingHz?: number`; load applies it to the next sampleSkeleton call. Phase 9's Settings modal then reads/writes the same field. Future-proof: schema slot exists from day one. | ✓ |
| No — omit until Phase 9 ships the Settings UI | Phase 8 persists only overrides + paths. Phase 9 adds samplingHz to the schema when there's actually a UI to set it. Smaller Phase 8 surface but means a schema bump in Phase 9. | |
| Persist hardcoded 120 always | Field is in the schema but always reads/writes 120. Useless until a setter exists. | |

**User's choice:** Yes — nullable field, default 120 if absent (Recommended)
**Notes:** Locked into D-146.

### Q3 — Where do collapsed-card / search-filter / scroll / focus state belong?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer all of it to Phase 9 polish | Collapse state, search query text, scroll position, focus animation, selected rows — keep all of it session-only. Phase 8 stays focused on F9.1 essentials. Smaller surface, less migration burden. | ✓ |
| Persist a 'view state' sub-object | Maximum 'pick up where you left off' fidelity. Bigger schema; more fields to migrate; more 'why did this restore?' surprises. | |
| Persist only the user-input bits (search query, collapse state) | Search text + collapsed cards travel; scroll/focus/selection don't. Middle ground. Still expands schema. | |

**User's choice:** Defer all to Phase 9 polish (Recommended)
**Notes:** Locked into D-147.

### Q4 — Doc-builder: how should Phase 8 prepare the schema?

| Option | Description | Selected |
|--------|-------------|----------|
| Reserve a top-level `documentation: {}` slot now, empty | Phase 8 writes `documentation: {}` into every project file. Doc-builder phase later fills it. Older Phase 8 files have an empty object — doc builder treats as 'no doc data'. Zero cost now, zero migration later. | ✓ |
| Don't reserve — just ensure unknown fields are preserved | Phase 8 schema has no `documentation` field. Doc-builder phase adds it via a schema version bump. Phase 8 reader must preserve unknown fields on round-trip. | |
| Both — reserve the slot AND preserve unknown fields | Belt and suspenders. Best forward-compat story; minor extra discipline in the load/save round-trip. | |

**User's choice:** Reserve a top-level `documentation: {}` slot now, empty (Recommended)
**Notes:** Locked into D-148.

### Q5 — Doc-builder scope confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — doc-builder is a future phase, captured as Deferred | Phase 8 only ships F9.1 essentials + last-used outDir + sort state + samplingHz + reserved schema slot. Doc-builder feature is its own phase. | ✓ |
| No — Phase 8 should also implement basic doc-builder fields | Expand Phase 8 scope. Significantly bigger phase; would block the F9 round-trip exit criterion on doc-builder design choices. | |

**User's choice:** Yes — future phase, captured as Deferred (Recommended)
**Notes:** Captured in `<deferred>` section of CONTEXT.md.

---

## Stale-data handling on Load

### Q1 — Skeleton JSON path no longer exists on disk

| Option | Description | Selected |
|--------|-------------|----------|
| Show error + 'Locate skeleton' file picker | Inline error banner. Button: 'Locate skeleton…' → file picker filtered to .json. App substitutes the new path, re-resolves siblings, re-samples, applies overrides. New path written on next Save. | ✓ |
| Hard error, refuse to load | No recovery. User must restore the file at the saved path. | |
| Silently load just the overrides, no skeleton | Phantom state with overrides in memory but no rig. Rejected. | |

**User's choice:** Show error + 'Locate skeleton' file picker (Recommended)
**Notes:** Locked into D-149.

### Q2 — Saved overrides reference attachments that no longer exist

| Option | Description | Selected |
|--------|-------------|----------|
| Drop stale overrides, surface a one-time notice | Drop unmatched overrides silently from the active map but show a dismissible banner: 'N saved overrides skipped — attachments no longer in skeleton: GHOST, OLD_HAT'. NOT written back on next Save. | ✓ |
| Drop stale overrides silently, no notice | Just drop them. User may not realize their override is gone. | |
| Preserve stale overrides in the file (don't apply, don't drop) | Map keeps the entries even if the current skeleton doesn't have them. Reactivate if user re-loads the original rig. File accumulates dead entries. | |
| Refuse to load, ask user to choose | Modal: 'Skeleton has changed since save. Drop stale overrides? / Cancel.' Extra friction. | |

**User's choice:** Drop stale overrides, surface a one-time notice (Recommended)
**Notes:** Locked into D-150.

### Q3 — Schema version mismatch

| Option | Description | Selected |
|--------|-------------|----------|
| Older file: load with migration; newer file: refuse with clear message | App owns a forward-only migration ladder. A file written by a NEWER app version is refused with: 'This project was saved by Spine Texture Manager vX.Y — please update.' Phase 8 ships v1; ladder is empty until v2 lands. | ✓ |
| Best-effort load regardless, warn on unknown fields | Fragile when newer schemas have semantic changes. | |
| Strict version match, refuse anything else | Maximum safety, terrible UX every time the schema evolves. | |

**User's choice:** Older file: migrate; newer file: refuse (Recommended)
**Notes:** Locked into D-151.

### Q4 — Saved atlas/images path no longer exists

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run loader's auto-discovery from skeleton path | Discard the saved atlas/images root and let `core/loader.ts` re-detect siblings. If auto-detection fails, surface the loader's existing `AtlasNotFoundError` banner. Path refreshed on next Save. Treats the saved path as a hint, not a hard requirement. | ✓ |
| Use saved path verbatim; error if missing | Trust the saved path. Predictable but rigid. | |
| Try saved path first, fall back to auto-discovery | Two-step. Most flexible but masks 'something changed' from the user. | |

**User's choice:** Re-run loader's auto-discovery (Recommended)
**Notes:** Locked into D-152.

---

## File location, format, versioning

### Q1 — Default save location

| Option | Description | Selected |
|--------|-------------|----------|
| User picks each time; default folder = skeleton's parent dir | First Save → showSaveDialog opens at the skeleton JSON's parent folder, default filename `<skeletonBasename>.stmproj`. Project files travel WITH the rig folder. Matches how Spine itself stores .spine files near assets. | ✓ |
| User picks each time; default folder = OS Documents | Default location is `~/Documents`. Decouples project from rig location. | |
| Auto-save in OS app data dir, indexed by skeleton path hash | App writes silently to `app.getPath('userData')/projects/<hash>.json`. Removes file-management entirely; conflicts with the explicit Save / Save As model. | |

**User's choice:** Default folder = skeleton's parent dir (Recommended)
**Notes:** Locked into D-153.

### Q2 — File extension and format

| Option | Description | Selected |
|--------|-------------|----------|
| Custom extension `.stmproj` | `.stmproj` (Spine Texture Manager project) reads as a project file in Finder/Explorer. JSON content underneath. Future: register handler so double-click opens in app. Plain JSON inside — human-readable. | ✓ |
| Custom extension `.spxm` (shorter) | Same as above but shorter token. Less self-explanatory. | |
| Plain `.json` | No custom extension. DropZone has to peek inside (look for a sentinel field) to disambiguate from skeletons. Workable but error-prone. | |
| Custom extension + binary format (e.g. MessagePack) | Smaller/faster but loses human-readability. Premature optimization. | |

**User's choice:** Custom extension `.stmproj` (Recommended)
**Notes:** Locked into D-154.

### Q3 — Paths inside the file

| Option | Description | Selected |
|--------|-------------|----------|
| Relative to project file location | skeleton path stored as e.g. `./SIMPLE_TEST.json`. Absolute fallback only if the rig is on a different volume. Buys portability — rename or move the parent folder, the project still loads. Standard pattern (Premiere, Resolve, Spine itself). | ✓ |
| Absolute paths only | Always store the full path. Simplest to reason about, breaks the moment the user moves the rig folder. | |
| Both — store both relative and absolute, prefer relative on load | Belt and suspenders. Slightly bigger file; more robust across edge cases. | |

**User's choice:** Relative to project file location (Recommended)
**Notes:** Locked into D-155.

### Q4 — Schema validation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled type guards, no runtime dep | Pattern from existing IPC trust-boundary checks (`validateExportPlan` in ipc.ts:97). One `validateProjectFile(unknown): { ok, project } | { ok:false, error }` function. Consistent with the project's hand-rolled-over-deps discipline (Phase 2 D-28, Phase 4 D-81). | ✓ |
| Adopt `zod` for the project file schema | Declarative schema, automatic TypeScript types, friendly error messages. Adds a dependency. Inconsistent with hand-rolled discipline. | |
| Trust the shape, no validation | Just JSON.parse. Crashes on malformed files surface as Unknown errors. Risks confusing failures for users editing the file by hand. | |

**User's choice:** Hand-rolled type guards, no runtime dep (Recommended)
**Notes:** Locked into D-156.

---

## Claude's Discretion

Captured under `<decisions>` §"Claude's Discretion" in `08-CONTEXT.md`. Items the user explicitly left to the planner:

- Atomic write strategy detail (mirror Phase 6 image-worker `<path>.tmp` + `fs.rename`)
- Where dirty-state derivation lives (recommend `useMemo` against a `lastSaved` snapshot)
- Stale-override banner styling and lifetime (recommend dismiss button + auto-clear on save)
- Whether `currentProjectPath` resets on new-skeleton-drop (recommend reset to null)
- Filename-chip behavior when no project path (recommend `Untitled` literal)
- Cmd+S binding scope (recommend window-level with modal-open suppression)
- OS file-association registration (Phase 9 polish; can include `open-file` listener scaffold)
- Dirty-state granularity (verify only D-145 fields contribute)
- Default sort column key string (planner picks consistent key)
- Renderer test framework (inherits Phase 4/6/7 decision)

---

## Deferred Ideas

Captured under `<deferred>` in `08-CONTEXT.md`. Notable user-introduced item:

- **Documentation builder feature** (user-flagged): tracklists, mix times, skin descriptions, authoring UI. Stored in the project file's reserved `documentation: {}` slot (D-148). Its own future phase.
