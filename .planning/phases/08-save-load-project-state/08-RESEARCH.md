---
name: Phase 8 — Save/Load project state Research
description: Authoritative research feeding the Phase 8 planner. Verifies the Electron `before-quit` async dance, `fs.rename` atomicity (incl. Windows EPERM + EXDEV cross-volume failure modes), `path.relative` cross-drive return shape, the existing project skill stack (Tailwind v4 tokens, useFocusTrap shared hook, hand-rolled validator pattern, atomic-write in Phase 6 image-worker), the renderer test framework (jsdom + @testing-library/react, vitest config widened in Phase 7), the samplingHz threading path (sampleSkeleton({ samplingHz }) is wired but no Phase 8 caller mutates it), the DropZone branch-on-extension hook (already extension-checks), and the existing arch.spec Layer-3 grep (auto-picks-up new src/core/ files; needs ZERO modification for project-file.ts). Catalogues the assumptions log so the planner / discuss-phase can verify before locking. Phase 8 ships F9.1 + F9.2; reserves doc-builder slot per D-148; ships v1 only of forward-only migration ladder per D-151.
phase: 8
---

# Phase 8: Save/Load project state — Research

**Researched:** 2026-04-25
**Domain:** Electron app session-state persistence (file dialogs, atomic writes, schema versioning, dirty-guard UX)
**Confidence:** HIGH (Electron + Node fs + project codebase grounded; LOW only on a few edge-case behaviors flagged in §Open Questions)

## Summary

Phase 8 is a **pure-extension** phase: every architectural primitive it needs is already shipped, tested, and proven by Phases 1–7. The Electron main process already has the `dialog` import live (`src/main/ipc.ts:39`), the typed-error envelope (D-10) is the lingua franca for new IPC channels, the atomic-write `<path>.tmp` + `fs.rename` idiom is battle-tested in `src/main/image-worker.ts:255–294`, the hand-rolled validator pattern (`validateExportPlan`) sits literally in the file Phase 8 will edit (`src/main/ipc.ts:92`), and the canonical hand-rolled ARIA modal scaffold + shared `useFocusTrap` hook (Phase 6 Round 6) is the proven template for the new `SaveQuitDialog`. Tailwind v4 tokens for every banner / button / chip Phase 8 needs are present; **no new tokens, no new dependencies**.

The two genuinely new pieces of architectural risk are (1) the `app.on('before-quit')` async dance — Electron has a documented bug in this area requiring `setTimeout` or `Promise.resolve().then(...)` to deliver the second `app.quit()` call, and (2) the cross-volume `path.relative` fallback rule — the heuristic the user-facing CONTEXT.md specifies (relative starts with `..` AND drive roots differ) is correct but needs an explicit code path because `path.relative` on Windows returns the absolute target path verbatim when no common ancestor exists, which would silently leak an absolute path into the "relative" slot of the schema if the planner doesn't branch.

**Primary recommendation:** Plan five strict-order waves: (W0) extend `src/shared/types.ts` + author RED test stubs + add Layer-3 grep additions, (W1) ship `src/core/project-file.ts` pure-TS schema + tests GREEN, (W2) ship `src/main/project-io.ts` main-process I/O + tests GREEN, (W3) ship `src/preload/index.ts` + IPC channel registrations, (W4) ship `src/renderer/src/components/AppShell.tsx` toolbar buttons + dirty-marker + Cmd/Ctrl+S+O listener + DropZone branching + new `SaveQuitDialog.tsx` + stale-override banner, (W5) close-out with human-verify checkpoint. Five renderer-driven UAT gates: round-trip, dirty-guard-on-quit, dirty-guard-on-drop, locate-skeleton recovery, stale-override drop notice.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Save UX & entry points (Area 1)**

- **D-140:** Toolbar `Save` + `Open` buttons + Cmd/Ctrl+S + Cmd/Ctrl+O global shortcuts. Two new buttons in the AppShell top chrome next to `Optimize Assets` / `Atlas Preview`. Cmd/Ctrl+S → Save (Save As if no current path); Cmd/Ctrl+O → Open. Window-level `keydown` listener with `event.preventDefault` + `event.stopPropagation` when modifiers match — kept renderer-side (no Electron menu wiring). Native menu wiring is a Phase 9 polish drop-in.
- **D-141:** Explicit Save / Save As — no auto-save. First Save (with `currentProjectPath === null`) opens `showSaveDialog` to pick a location; subsequent Saves write to the same path silently. Save As always re-prompts and updates `currentProjectPath`. Dirty marker (`•` prefix on the filename chip) signals unsaved changes.
- **D-142:** Open via toolbar button OR drag-drop `.stmproj` onto DropZone. DropZone branches on extension: `.json` → existing skeleton-load path; `.stmproj` → new `openProjectFromPath`; other → existing rejection. Both entry points run through the same dirty-guard (D-143).
- **D-143:** Dirty-guard on app close + new-skeleton-drop + new-project-drop. Cmd+Q / window close with `isDirty === true` → native-style confirm modal with `Save / Don't Save / Cancel`. Standard Electron `before-quit` + `e.preventDefault()` flow. Same dialog mounts when a new skeleton OR a new project is dropped onto the dirty session. Hand-rolled ARIA modal cloning OverrideDialog (Phase 4 D-81 hand-rolled discipline).
- **D-144:** Dirty marker = leading `•` (U+2022). `MyRig.stmproj` (clean) vs `• MyRig.stmproj` (dirty). When `currentProjectPath === null`, chip reads `Untitled` (clean) or `• Untitled` (dirty). Tooltip / hover title surfaces the absolute path when set.

**State scope (Area 2)**

- **D-145:** Project file persists exactly: `version: 1`, `skeletonPath`, `atlasPath` (nullable), `imagesDir` (nullable), `overrides: Record<string, number>`, `samplingHz` (nullable), `lastOutDir` (nullable, absolute), `sortColumn`, `sortDir`, `documentation: object`. Required: `version`, `skeletonPath`, `overrides`, `documentation`. All others optional/nullable.
- **D-146:** `samplingHz` field reserved (Phase 9 ships the Settings UI that mutates it). Default-on-absent: `samplingHz === null || undefined → 120`. Phase 8 always writes 120; Load reads it and threads into `sampleSkeleton({ samplingHz })`.
- **D-147:** Defer all ephemeral UI state to Phase 9 (active tab, collapsed cards, search query, scroll, focus, selection — none in project file).
- **D-148:** Reserve top-level `documentation: {}` empty slot in v1 schema. `validateProjectFile` accepts any object value (including non-empty); the field is opaque to Phase 8 logic. Doc-builder is its own future phase.

**Stale-data handling on Load (Area 3)**

- **D-149:** Missing skeleton on Load → inline error + "Locate skeleton…" file picker. New picked file path → re-resolve atlas/images siblings via existing F1.2 loader, re-sample, apply overrides (with stale-key handling per D-150). The new path goes into state and gets written back on next Save.
- **D-150:** Stale-override keys → drop + one-time dismissible notice. `staleKeys = Array.from(savedOverrides.keys()).filter(name => !summary.peaks.some(r => r.attachmentName === name))`. Banner: `"N saved overrides skipped — attachments no longer in skeleton: GHOST, OLD_HAT, …"` (cap names at 5 with `+ M more` if longer). Dropped overrides are NOT preserved.
- **D-151:** Schema version mismatch — older: migrate; newer: refuse. Forward-only `migrate(project): ProjectFileV1`. v1 only in Phase 8 (passthrough). `version > 1` → `'newer-version'` error → IPC envelope translates to `'ProjectFileVersionTooNewError'`.
- **D-152:** Missing atlas/images path on Load → re-run loader's existing F1.2 auto-discovery. Saved paths are HINTS, not requirements. Auto-discovery handles "I moved the rig folder". Saved paths get refreshed on next Save.

**File location, format, versioning (Area 4)**

- **D-153:** Default save location = skeleton's parent directory; user picks each Save. `dialog.showSaveDialog({ defaultPath: <skeletonDir>/<skeletonBasename>.stmproj, filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }] })`.
- **D-154:** File extension `.stmproj` (Spine Texture Manager Project), JSON content inside. Plain JSON inside — human-readable, diff-able.
- **D-155:** Paths inside file are relative to project file's directory; absolute fallback for cross-volume. `relativizePath(absolute, basedir)` returns `./SIMPLE.json` etc., falls back to absolute when on different volume / drive letter. `absolutizePath(stored, basedir)` is the inverse.
- **D-156:** Hand-rolled type guards, no runtime dependency. Single `validateProjectFile(unknown): { ok, project } | { ok: false, error }` function in `src/core/project-file.ts`, mirroring `validateExportPlan` discipline (Phase 2 D-28, Phase 4 D-81).

### Claude's Discretion

- **Atomic write strategy detail.** Phase 6 image-worker uses `<path>.tmp` + `fs.rename`. Project save mirrors. Verify rename atomicity guarantee on Windows + macOS + Linux is acceptable for a non-critical settings file. (Resolved in §Common Pitfalls #2.)
- **Where the dirty-state derivation lives.** `useMemo` against a `lastSaved` snapshot in AppShell vs deep comparison vs reference-equality on individual fields. Recommendation: `useMemo` with explicit field-by-field comparison (the field set is small and fixed per D-145).
- **Stale-override banner styling and lifetime.** Recommend dismiss-button that auto-clears on next save.
- **Whether `currentProjectPath` resets on new-skeleton-drop.** Recommend: reset to null. Project file is rig-bound conceptually.
- **Filename-chip behavior when `currentProjectPath === null`.** Recommend `Untitled` literal (consistent with the rest of the app's text discipline).
- **Cmd+S binding scope.** Recommend window-level since modals can be open and Cmd+S should still work; verify modal-open-Cmd+S doesn't trigger an unexpected save while a dialog has focus (probably should suppress when any modal is open).
- **OS file-association registration.** Phase 9 polish drop-in. Planner can include the wiring scaffold (the `open-file` listener that calls `openProjectFromPath`) but the actual `electron-builder` config is out of scope.
- **Dirty-state granularity.** Active tab is NOT in the schema (per D-147), so changing it should NOT dirty. Verify dirty derivation is computed only against fields in D-145.
- **Default sort column key string.** Resolved by codebase grep — exact strings live in `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:66–73`. See §Code Examples.
- **Renderer test framework.** Resolved by codebase grep — jsdom + `@testing-library/react` already installed and proven in `tests/renderer/atlas-preview-modal.spec.tsx`. See §Standard Stack.

### Deferred Ideas (OUT OF SCOPE)

- **Documentation builder feature** (user-flagged 2026-04-25): authoring UI for tracklists, mix times, skin descriptions, rig-level metadata. Stored in the project file's reserved `documentation: {}` slot (D-148). Its own future phase — probably post-MVP.
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
- **"Inactive overrides" UI surface** — would be needed if D-150 had picked the preserve-stale-in-file option; deferred since we drop them.

## Phase Requirements

| ID | Description (verbatim from `.planning/REQUIREMENTS.md`) | Research Support |
|----|--------------------------------------------------------|------------------|
| **F9.1** | Session JSON contains: skeleton path, atlas/images root, overrides, settings (sampling rate). | D-145 names the exact 10 fields + `documentation: {}` reserved slot. `samplingHz` field reserved per D-146 (Phase 9 mutates). `overrides` field shape locked (Record<string, number>; Map↔Object boundary at IPC). `lastOutDir` + `sortColumn` + `sortDir` agreed extras (not strictly named in F9.1, but compatible — F9.1 says "settings", which is open-ended). |
| **F9.2** | Load restores overrides and settings; recomputes peaks. | D-149 (locate-skeleton recovery) + D-150 (stale-override drop) + D-152 (atlas auto-rediscovery) define the recompute semantics. `samplingHz` threads into `sampleSkeleton({ samplingHz })` per D-146. Re-sample IS the recompute. |

**No additional REQ-IDs** — F9 is the only deliverable surface. Other Phase 8 mechanics (dirty marker, schema migration ladder, file extension `.stmproj`) are implementation choices recorded as locked decisions D-141..D-156, not separate requirements.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema definition + validation + migration ladder | `src/core/` (pure-TS) | — | Layer 3 invariant: pure-TS schema math, zero `fs`/Electron/DOM. Hand-rolled validator mirrors `validateExportPlan` in `src/main/ipc.ts:97`. |
| File dialog (Save / Open) | `src/main/` (Electron `dialog`) | — | Electron `dialog.showSaveDialog` / `showOpenDialog` only callable from main process. |
| Atomic file write (`<path>.tmp` + `fs.rename`) | `src/main/` (Node `fs`) | — | Reuses the exact idiom from `src/main/image-worker.ts:255–294`. |
| File read + JSON.parse + validate | `src/main/` (Node `fs`) | `src/core/` (validation) | Main reads bytes, calls into core's pure validator. |
| IPC channels (5 new: project:save, project:save-as, project:open, project:open-from-path, project:locate-skeleton) | `src/main/ipc.ts` + `src/preload/index.ts` | — | Same envelope pattern as Phase 6 export channels. Renderer never touches `fs`/`dialog` directly. |
| Toolbar Save+Open buttons + filename chip + dirty marker | `src/renderer/` (AppShell) | — | UI state (`currentProjectPath`, `lastSavedSnapshot`, `staleOverridesNotice`) lives in AppShell (D-74 / D-77 precedent — plain `useState`, no Context). |
| Cmd/Ctrl+S+O global shortcut | `src/renderer/` (window-level `keydown`) | — | No Electron menu wiring per D-140. |
| `before-quit` dirty-guard interception | `src/main/index.ts` (event) ↔ `src/renderer/` (modal) | IPC roundtrip | Main intercepts → asks renderer via IPC → renderer mounts SaveQuitDialog → resolves promise → main re-issues `app.quit()`. |
| DropZone `.stmproj` branch | `src/renderer/` (DropZone) | preload (`openProjectFromPath`) | Drop handler already extension-checks `.json`; extends to dispatch on extension. |
| Stale-override drop notice banner | `src/renderer/` (AppShell) | — | Computed renderer-side after Load resolves; UI-only. |
| SaveQuitDialog (hand-rolled ARIA modal, 3 buttons) | `src/renderer/src/modals/` | — | Clones OverrideDialog/ConflictDialog scaffold + uses shared `useFocusTrap` hook (Phase 6 Round 6). |

## Standard Stack

### Core (already installed — verified via `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | `^41.3.0` | App framework, `dialog`, `ipcMain`, `app.on('before-quit')`, `webContents` | Already pinned project-wide; Phase 1 lock. `[VERIFIED: package.json:39]` |
| `react` | `^19.2.5` | Renderer | Already shipped. `[VERIFIED: package.json:23]` |
| `@esotericsoftware/spine-core` | `^4.2.0` | Skeleton re-sampling on Load (F9.2) | Existing loader/sampler reused verbatim. `[VERIFIED: package.json:21]` |
| `vitest` | `^4.0.0` | Test runner (unit + renderer specs) | Already running 240 tests. `[VERIFIED: package.json:46]` |
| `jsdom` | `^29.0.2` | Renderer test DOM env | Phase 7 added; renderer specs already use `// @vitest-environment jsdom`. `[VERIFIED: package.json:42]` |
| `@testing-library/react` | `^16.3.2` | Renderer-side UI tests | Phase 7 added; reference: `tests/renderer/atlas-preview-modal.spec.tsx`. `[VERIFIED: package.json:32]` |
| `@testing-library/user-event` | `^14.6.1` | Synthesized user gestures | Phase 7 added. `[VERIFIED: package.json:33]` |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers | Phase 7 added. `[VERIFIED: package.json:31]` |
| `clsx` | `^2.1.1` | Conditional className utility | Already used by every component (DropZone, AppShell, OverrideDialog). `[VERIFIED: package.json:38]` |
| `tailwindcss` | `^4.2.4` | Styling (v4 `@theme inline`) | Already configured; `[VERIFIED: package.json:43]` |

**No new dependencies required.** Phase 8 is pure-extension on top of an already-complete stack. `[VERIFIED: package.json full content]`

### Supporting (Node built-ins, no install)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `node:fs/promises` | `readFile`, `writeFile`, `rename`, `access` | All main-process I/O. Mirrors `src/main/image-worker.ts:57`. |
| `node:path` | `dirname`, `basename`, `extname`, `join`, `resolve`, `relative`, `isAbsolute` | Path computation in both `src/core/project-file.ts` (pure-TS — no I/O) AND `src/main/project-io.ts`. Layer 3 grep tolerates `node:path` in core because it has no I/O — verified inline in `tests/arch.spec.ts:128` (the Phase 6 grep blocks `node:fs`/`sharp`/`fs/promises`, NOT `node:path`). |

### Alternatives Considered (and rejected per locked decisions)

| Instead of | Could Use | Tradeoff (rejected per CONTEXT.md) |
|------------|-----------|----------|
| Hand-rolled `validateProjectFile` (D-156) | `zod` / `valibot` / `arktype` | Adds runtime dep, inconsistent with hand-rolled discipline (Phase 2 D-28, Phase 4 D-81). Schema is small enough (10 fields) that hand-rolling is mechanical. |
| `<path>.tmp` + `fs.rename` (Phase 6 reuse) | `write-file-atomic` (npm) | Same idiom; npm package adds a Windows-retry layer Phase 8 doesn't need for non-critical settings files. Phase 6 already proved the bare idiom works. (See §Common Pitfalls #2 for the Windows EPERM caveat.) |
| Window-level `keydown` for Cm d+S+O | Electron native menu (`Menu.buildFromTemplate`) | D-140 explicitly rejected the menu approach (would require flipping `autoHideMenuBar: false` and break the locked Phase 1 chrome). Native menu wiring is a Phase 9 polish drop-in. |
| Hand-rolled SaveQuitDialog | Native `dialog.showMessageBox` | Native modal would force the dialog look-and-feel away from the rest of the project's hand-rolled ARIA modals (OverrideDialog / OptimizeDialog / ConflictDialog / AtlasPreviewModal). D-143 + D-81 lock the hand-rolled scaffold. |
| Custom JSON-with-comments format (`.json5`, `.jsonc`) | Plain JSON | D-154 locks plain JSON. Loses inspectability of `.json5`-style comments; gains universal tool compatibility (`jq`, `git diff`, plain editor). |

**Installation:** None. (`[VERIFIED: package.json shows all dependencies present]`)

## Architecture Patterns

### System Architecture Diagram

```
                        SAVE FLOW
                        ─────────

   [User]
     │
     │ Cmd+S / clicks Save toolbar button / clicks Save in SaveQuitDialog
     ▼
   ┌─────────────────────────────┐
   │ Renderer (AppShell)         │
   │  - Cmd+S keydown listener   │
   │  - dirty-marker derive      │
   │  - Save click handler       │
   └──────────┬──────────────────┘
              │ window.api.saveProject(state, currentPath)
              │   OR
              │ window.api.saveProjectAs(state, defaultDir, defaultBasename)
              ▼
   ┌─────────────────────────────┐
   │ Preload (contextBridge)     │
   │  ipcRenderer.invoke         │
   └──────────┬──────────────────┘
              │ 'project:save' / 'project:save-as'
              ▼
   ┌─────────────────────────────┐    ┌──────────────────────────────┐
   │ Main: ipc.ts                │ ─→ │ Main: project-io.ts          │
   │  handleProjectSave          │    │  if (no currentPath):        │
   │  handleProjectSaveAs        │    │    dialog.showSaveDialog →   │
   └─────────────────────────────┘    │  serializeProjectFile(...) ←─┼──→ ┌────────────────────┐
                                      │  JSON.stringify              │    │ Core: project-file │
                                      │  fs.writeFile(<path>.tmp)    │    │  serializeProject  │
                                      │  fs.rename(<tmp>, <path>)    │    │  relativizePath    │
                                      └──────────┬───────────────────┘    │  validateProject   │
                                                 │                        │  (pure-TS, 0 I/O)  │
                                                 ▼                        └────────────────────┘
                                          { ok: true, path }
                                          OR { ok: false, error: SerializableError }


                        OPEN FLOW
                        ─────────

   [User]                          OR    [User drops .stmproj on DropZone]
     │ clicks Open / Cmd+O                │
     ▼                                    ▼
   ┌─────────────────────────────────────────────┐
   │ Renderer (AppShell + DropZone)              │
   │  if (isDirty): mount SaveQuitDialog first   │ ◀──── Dirty-guard pre-check
   │  else proceed                                │       (D-143)
   └──────────┬──────────────────────────────────┘
              │ window.api.openProject()  OR  openProjectFromPath(absolutePath)
              ▼
   ┌─────────────────────────────┐
   │ Main: project-io.ts         │
   │  dialog.showOpenDialog(...) │ (only on openProject — open-from-path skips picker)
   │  fs.readFile                │
   │  JSON.parse                 │
   │  validateProjectFile  ─────────────→ Core: project-file.ts
   │  if newer-version: reject   │       (validate, migrate)
   │  migrate(project)           │
   │  materializeProjectFile     │       (absolutize paths, ready in-memory shape)
   │  loadSkeleton(absoluteSkel) │ ─────→ Core: loader.ts (existing F1.2 atlas auto-discovery)
   │  if loader throws SkeletonJsonNotFoundError:
   │     → return SkeletonNotFoundOnLoadError
   │  sampleSkeleton({ samplingHz }) │ ─→ Core: sampler.ts
   │  buildSummary               │
   │  return { ok: true, project: { summary, restoredOverrides, ...settings } }
   └──────────┬──────────────────┘
              │ OpenResponse envelope
              ▼
   ┌─────────────────────────────────────────────┐
   │ Renderer (AppShell)                         │
   │  if SkeletonNotFoundOnLoadError:            │
   │     → render inline error + "Locate         │
   │       skeleton..." button (D-149)            │
   │  else:                                       │
   │     setOverrides(restoredOverrides ∩ peaks) │
   │     setStaleOverridesNotice(diff)           │ (D-150)
   │     setCurrentProjectPath(path)             │
   │     setLastSavedSnapshot(...)               │ (resets isDirty=false)
   └─────────────────────────────────────────────┘


                    DIRTY-GUARD ON QUIT FLOW
                    ────────────────────────

   [User] presses Cmd+Q / clicks window close
     │
     ▼
   ┌─────────────────────────────┐
   │ Main: index.ts              │
   │ app.on('before-quit', e =>  │
   │   if (!isQuitting) {        │ ◀── isQuitting flag is module-local; prevents recursion
   │     e.preventDefault();     │     (Pitfall 1)
   │     mainWindow.webContents.send(
   │       'project:check-dirty-before-quit')
   │   })                        │
   └──────────┬──────────────────┘
              │ one-way send
              ▼
   ┌─────────────────────────────┐
   │ Renderer (AppShell)         │
   │  ipcRenderer.on(            │
   │    'project:check-dirty-...')│
   │  if (!isDirty):             │
   │    api.confirmQuitProceed() │ ──── one-way IPC back
   │  else:                      │
   │    mount <SaveQuitDialog>   │
   │    user clicks one of:      │
   │      Save → save → proceed  │
   │      Don't Save → proceed   │
   │      Cancel → abort         │
   │  on proceed:                │
   │    api.confirmQuitProceed() │
   │  on abort:                  │
   │    do nothing — main stays  │
   │    paused, app keeps running│
   └──────────┬──────────────────┘
              │ 'project:confirm-quit-proceed'
              ▼
   ┌─────────────────────────────┐
   │ Main: index.ts              │
   │ ipcMain.on('project:        │
   │   confirm-quit-proceed', () │
   │   isQuitting = true;        │
   │   setTimeout(() => app.quit(), 0)
   │     ◀── setTimeout is LOAD-BEARING per Pitfall 1
   │   })                        │
   └─────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── core/
│   └── project-file.ts          # NEW — pure-TS schema + validator + migration ladder
├── main/
│   ├── index.ts                 # TOUCHED — adds before-quit listener + ipc.on(confirm-quit-proceed)
│   ├── ipc.ts                   # TOUCHED — registers 5 new channels
│   ├── project-io.ts            # NEW — main-process I/O (dialog + fs.readFile/writeFile + atomic rename)
│   ├── image-worker.ts          # UNCHANGED (atomic-write reference impl)
│   ├── summary.ts               # UNCHANGED
│   └── ...
├── preload/
│   └── index.ts                 # TOUCHED — adds 5 new contextBridge methods + 1 quit-check listener
├── renderer/
│   └── src/
│       ├── components/
│       │   ├── AppShell.tsx     # MAJOR TOUCH — Save/Open buttons, currentProjectPath state,
│       │   │                    #   isDirty derive, Cmd/Ctrl+S+O keydown listener,
│       │   │                    #   stale-override banner, dirty-guard pre-check on
│       │   │                    #   new-skeleton-drop, SaveQuitDialog mount points (×3 use cases:
│       │   │                    #   quit / new-skeleton-drop / new-project-drop),
│       │   │                    #   inline "skeleton not found" + "Locate skeleton..." button
│       │   ├── DropZone.tsx     # TOUCHED — branch on extension (.json | .stmproj | reject)
│       │   └── ...
│       ├── modals/
│       │   ├── SaveQuitDialog.tsx  # NEW — hand-rolled 3-button confirm modal
│       │   ├── OverrideDialog.tsx  # UNCHANGED (reference scaffold)
│       │   └── ...
│       └── hooks/
│           └── useFocusTrap.ts  # UNCHANGED (SaveQuitDialog reuses)
├── shared/
│   └── types.ts                 # TOUCHED — adds ProjectFileV1, MaterializedProject,
│                                #   AppSessionState, SaveResponse, OpenResponse,
│                                #   LocateSkeletonResponse; extends SerializableError kind union
│                                #   with 4 new kinds; extends Api interface with 5 new methods
└── ...

tests/
├── core/
│   └── project-file.spec.ts     # NEW — round-trip, relative/absolute, validator, migration, hygiene
├── main/
│   └── project-io.spec.ts       # NEW — mocked dialog + fs cases (8 cases per CONTEXT.md tests block)
├── renderer/
│   └── save-load.spec.tsx       # NEW (planner's call) — Save/Open click, dirty marker, SaveQuitDialog,
│                                #   Cmd/Ctrl+S+O fires, stale-override banner
└── arch.spec.ts                 # TOUCHED — IF Phase 8 wants to lock the new project-file.ts
                                 # explicitly. Existing Layer 3 grep auto-scans `src/core/**/*.ts`
                                 # (line 118), so it picks up project-file.ts with ZERO change.
                                 # (See §Pitfall #10.)
```

### Pattern 1: Hand-Rolled IPC Validator (canonical reference)

**What:** Cheap shape-validation function returning either a typed-success envelope or a typed-error envelope. Validates AT the trust boundary (renderer-origin args).
**When to use:** EVERY `ipcMain.handle` that consumes renderer-origin data.
**Example (existing Phase 6 reference):**

```typescript
// Source: src/main/ipc.ts:92–112 [VERIFIED: read inline]
function validateExportPlan(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  const p = plan as { rows?: unknown; excludedUnused?: unknown; totals?: unknown };
  if (!Array.isArray(p.rows)) return 'plan.rows is not an array';
  // ... per-field shape checks
  return null;
}
```

**Phase 8 application:** `validateProjectFile(unknown): { ok: true; project: ProjectFile } | { ok: false; error: { kind: 'invalid-shape' | 'unknown-version' | 'newer-version'; message: string } }` mirrors this exactly. Per-version dispatch on the `version` field; each version has its own field-shape guard.

### Pattern 2: Atomic Write via `<path>.tmp` + `fs.rename` (canonical reference)

**What:** Write to a sibling `.tmp` file first; on success, rename to the final path. If the process is killed mid-write, the original file is untouched.
**When to use:** Any user-data write where partial-write would corrupt the file.
**Example (existing Phase 6 reference):**

```typescript
// Source: src/main/image-worker.ts:255–294 [VERIFIED: read inline]
const tmpPath = resolvedOut + '.tmp';
try {
  await sharp(sourcePath)
    .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(tmpPath);
} catch (e) {
  // 'sharp-error' branch
}
try {
  await rename(tmpPath, resolvedOut);
} catch (e) {
  // 'write-error' branch
}
```

**Phase 8 application:** `serializeProjectFile(state, projectFilePath)` produces a `ProjectFileV1` JS object → `JSON.stringify(file, null, 2)` produces the JSON text → `fs.writeFile(<path>.tmp, jsonText)` → `fs.rename(<path>.tmp, <path>)`. Same try/catch around each step; surface `'write-error'` on either failure.

### Pattern 3: Hand-Rolled ARIA Modal + Shared `useFocusTrap` Hook

**What:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby` outer overlay div + inner panel div + `useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel })` for Tab cycle + document-level Escape.
**When to use:** Every new modal in this project (D-81 lock).
**Example (existing reference — OverrideDialog Phase 4):**

```typescript
// Source: src/renderer/src/modals/OverrideDialog.tsx:60–171 [VERIFIED: read inline]
export function OverrideDialog(props: OverrideDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });
  if (!props.open) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="override-title" className="text-sm text-fg mb-4">{title}</h2>
        {/* ... body ... */}
        <div className="flex gap-2 mt-6 justify-end">
          {/* buttons */}
        </div>
      </div>
    </div>
  );
}
```

**Phase 8 SaveQuitDialog application:**

```typescript
export interface SaveQuitDialogProps {
  open: boolean;
  reason: 'quit' | 'new-skeleton-drop' | 'new-project-drop';  // controls the body copy
  basename: string | null;  // 'MyRig.stmproj' or null for Untitled
  onSave: () => void;       // calls saveProject; on success, AppShell calls the proceed handler
  onDontSave: () => void;   // proceed without saving
  onCancel: () => void;     // abort the pending action; modal closes; nothing happens
}
```

Three buttons in the footer: `Save` (font-semibold, accent), `Don't Save` (border, muted), `Cancel` (border, default). Body copy varies by reason. `useFocusTrap` initial focus lands on Save (first tabbable). Esc → `onCancel`.

### Pattern 4: Window-Level Keyboard Shortcut + Modal Suppression

**What:** `useEffect` registers a `keydown` listener on `window` that checks `event.key + event.metaKey + event.ctrlKey`. Suppresses fire when any modal is open by reading a ref-tracked open-modal count.
**When to use:** Cmd/Ctrl+S+O global shortcuts (D-140) — currently no project precedent for this; SaveQuitDialog plus the existing 4 dialogs (Override / Optimize / Conflict / AtlasPreview) all have to be considered when deciding "is a modal open?".

```typescript
// PROPOSED PHASE 8 PATTERN — no existing reference; planner authors per these rules.
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    const isMetaOrCtrl = e.metaKey || e.ctrlKey;
    if (!isMetaOrCtrl) return;
    // Suppress when ANY modal is open. The simplest signal is "is there an
    // element with role='dialog' currently in the document?" — querySelector
    // is fine; modals are mounted at most a handful at a time.
    if (document.querySelector('[role="dialog"]')) return;
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      onClickSave();  // routes to Save (or Save As if currentProjectPath null)
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      e.stopPropagation();
      onClickOpen();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [onClickSave, onClickOpen]);
```

Alternative (rejected): scope the listener to AppShell. Drawback: when a modal opens and steals focus to its first tabbable, focus might land on a button INSIDE the modal but the AppShell `keydown` handler would no longer fire on bubble — `document.activeElement` would be inside the modal. The `window`-level listener with the `querySelector` suppression is more robust against future modal additions.

### Pattern 5: Forward-Only Migration Ladder

**What:** A single `migrate(project: ProjectFile): ProjectFileV1` function dispatches on `project.version` and walks rung-by-rung up to the latest. Phase 8 ships v1 only — the ladder is a passthrough — but the SHAPE is locked so v2 in a future phase is a one-line edit.
**When to use:** Any versioned schema where forward-compat is a goal.

```typescript
// PROPOSED PHASE 8 SHAPE — pure passthrough today, drop-in for v2 tomorrow.
import type { ProjectFile, ProjectFileV1 } from '../shared/types.js';

export function migrate(project: ProjectFile): ProjectFileV1 {
  switch (project.version) {
    case 1:
      return project;  // v1 is current
    // case 2:
    //   // future: read v2 fields, drop renamed/removed fields
    //   return { version: 1, ... };  // NB: ladder produces V_LATEST, not V1
    default:
      // Phase 8: TS exhaustiveness check + runtime guard (defense in depth).
      throw new Error(`Unsupported project file version: ${(project as ProjectFile).version}`);
  }
}
```

**CRITICAL:** `migrate` is called AFTER `validateProjectFile` succeeds. `validateProjectFile` is the gate for `'newer-version'` rejection (D-151) — `migrate` only ever sees a known version.

### Anti-Patterns to Avoid

- **Synchronous `fs.readFileSync` / `fs.writeFileSync` in IPC handlers:** every existing handler is `async`. Phase 6 image-worker uses `fs/promises`. Phase 8 follows.
- **Storing the overrides Map directly in JSON:** `JSON.stringify(new Map(...))` produces `{}`. Convert at the IPC boundary: `Object.fromEntries(map)` on save, `new Map(Object.entries(obj))` on load.
- **Passing `currentProjectPath` to `dialog.showSaveDialog` defaultPath when null:** must fall back to `<skeletonDir>/<basename>.stmproj` (D-153). Empty defaultPath gives the OS "wherever you were last" which violates the locked decision.
- **Computing `isDirty` against `JSON.stringify(state) !== JSON.stringify(snapshot)`:** legal but wasteful and fragile (order-dependent on `Map` iteration). Field-by-field equality on the 5 D-145 fields (overrides, samplingHz, lastOutDir, sortColumn, sortDir) is cheaper and explicit.
- **Listening to `keydown` on AppShell instead of `window`:** when focus drifts to a modal, AppShell-scoped listener no longer receives the event. Window-level listener + modal-open suppression is the robust pattern (Pattern 4).
- **Re-issuing `app.quit()` synchronously inside `before-quit` handler:** DOES NOT WORK — Electron has documented bug (issue #33643). Wrap in `setTimeout(() => app.quit(), 0)` or `Promise.resolve().then(() => app.quit())`. See §Pitfall #1.
- **Letting `path.relative` produce a `..`-prefixed path that crosses drives without detecting:** on Windows, `path.relative('C:\\proj', 'D:\\skel')` returns `'D:\\skel'` (the absolute target). On Unix, `path.relative('/a/b', '/Volumes/Other/c')` returns `'../../Volumes/Other/c'`. Both ARE absolute escapes; only the second LOOKS relative. Phase 8 needs an explicit cross-volume detection rule. See §Pitfall #4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File save dialog | Custom OS-shaped picker | `dialog.showSaveDialog` (Electron) | Native UX, native filters, native conflict prompt. `[CITED: electronjs.org/docs/latest/api/dialog]` |
| File open dialog | Custom file browser | `dialog.showOpenDialog` (Electron) | Same. `[CITED: electronjs.org/docs/latest/api/dialog]` |
| Atomic file write | Custom flock + write + unlock | `<path>.tmp` + `fs.rename` (Phase 6 idiom) | Simpler, cross-platform, proven. See Pitfall #2 for caveats. |
| Focus trap + Tab cycle in modal | Custom focus management per dialog | `src/renderer/src/hooks/useFocusTrap.ts` (Phase 6 Round 6) | Already handles Tab/Shift+Tab/Escape with rescue and restore-on-close. Reused by 4 modals already. |
| Skeleton sibling auto-discovery | Re-implement | `src/core/loader.ts` (existing F1.2 logic) | D-152 explicitly says: re-run existing loader, atlas/images siblings auto-detect. Phase 8 reuses verbatim. |
| Re-sample on Load | Re-implement | `src/core/sampler.ts` `sampleSkeleton({ samplingHz })` | F9.2 says "recomputes peaks". Existing sampler does this exactly. |
| AnimationBreakdown / GlobalMaxRender / OverrideDialog rendering | Re-render | They re-render naturally because `summary` prop changes when `loadResponse` resolves and AppShell remounts the panels. | No new code. |

**Key insight:** Phase 8 is **glue**, not new architecture. Every primitive Phase 8 needs is shipped by Phases 1–7. The risk surface is in the GLUE: `before-quit` async dance, cross-volume `path.relative`, the dirty-marker derive, the SaveQuitDialog 3-button promise, and the new arch.spec coverage of `src/core/project-file.ts`.

## Runtime State Inventory

> Phase 8 introduces persistent files but does NOT rename / refactor / migrate any existing identifier. The Runtime State Inventory below is therefore mostly inverse: "what do new project files contain that future state must keep in sync with?"

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New: `.stmproj` files written by Phase 8 will outlive the app version that wrote them; future schema changes (v2) MUST be readable by the v1-aware migration ladder. | None for Phase 8 itself — the ladder skeleton is the action. v2 phase will add a `case 2:` branch. |
| Live service config | None — Phase 8 has no external services. | None. |
| OS-registered state | Phase 9 will register `.stmproj` as a file association via `electron-builder` config + macOS `app.on('open-file')` + Windows registry. Phase 8 ships the file-handling code (`openProjectFromPath` IPC) so the registration drop-in is config-only. | None for Phase 8 — verified explicit "Phase 9 polish" callout in CONTEXT.md "Out of scope". |
| Secrets / env vars | None. Project file contains paths and overrides only — no secrets, no API keys, no tokens (D-145 + Out-of-Scope explicit). | None. |
| Build artifacts / installed packages | None new. Phase 8 adds NO npm dependencies. | None — verified `package.json` shows no install line in CONTEXT.md. |

**Nothing found in category:** Verified for all 5 by direct inspection of CONTEXT.md `<deferred>` block + `package.json`.

## Common Pitfalls

### Pitfall 1: Electron `before-quit` recursive `app.quit()` does not actually quit

**What goes wrong:** You call `e.preventDefault()` inside `app.on('before-quit', ...)` to render a dialog; the user clicks "Don't Save"; you call `app.quit()` again — but the app does NOT quit on the second call.
**Why it happens:** Documented Electron bug (#33643 on Windows 10, Electron 18+, but the pattern is replicated in Electron 41). Calling `app.quit()` synchronously inside the same `before-quit` event tick re-fires `before-quit` recursively, which sees the same not-yet-cleared state and bails. `[CITED: github.com/electron/electron/issues/33643]`
**How to avoid:**
1. Maintain a module-level `isQuitting: boolean` flag. On the first `before-quit` fire, set NOTHING; on subsequent (post-confirmation) `app.quit()`, set `isQuitting = true` BEFORE the `app.quit()` call so the `before-quit` listener can early-return.
2. Wrap the second `app.quit()` in `setTimeout(() => app.quit(), 0)` OR `Promise.resolve().then(() => app.quit())`. This breaks the synchronous re-entry.
3. **Recommended (Phase 8):** Combine both. The flag handles the obvious case; the deferral guards against double-fires.

```typescript
// PROPOSED Phase 8 src/main/index.ts pattern.
let isQuitting = false;

app.on('before-quit', (event) => {
  if (isQuitting) return;  // re-entry guard — already confirmed; let it through
  event.preventDefault();
  // Ask the renderer (one-way send; renderer responds via separate IPC channel)
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) {
    // No window to ask; let the quit through
    isQuitting = true;
    setTimeout(() => app.quit(), 0);
    return;
  }
  win.webContents.send('project:check-dirty-before-quit');
});

ipcMain.on('project:confirm-quit-proceed', () => {
  isQuitting = true;
  setTimeout(() => app.quit(), 0);  // load-bearing setTimeout — see Pitfall 1
});
```

**Warning signs:** First `Cmd+Q` shows the dialog, user clicks "Don't Save", dialog disappears, app stays running. Second `Cmd+Q` repeats. (Without the `setTimeout`.)

### Pitfall 2: `fs.rename` cross-platform atomicity is real BUT has Windows EPERM hazard

**What goes wrong:** On Windows, `fs.rename(<path>.tmp, <path>)` can fail with `EPERM` / `EACCES` / `EBUSY` when Windows Defender, Windows Search indexer, or another process holds a transient file lock on the destination.
**Why it happens:** Windows file-locking is opportunistic; `rename` over an existing path requires that NO other process has a handle on the destination. `[CITED: github.com/nodejs/node/issues/29481, github.com/npm/write-file-atomic/issues/227]`
**Atomicity status (verified):**
- POSIX (macOS, Linux): `fs.rename` is atomic on the same filesystem when the destination exists. `[CITED: man rename(2)]`
- Windows: `MoveFileEx(MOVEFILE_REPLACE_EXISTING)` is atomic but subject to file-lock failures. `[CITED: web search results, May 2025]`
- Cross-filesystem (any OS): `fs.rename` returns `EXDEV`. Node does NOT fall back to copy+unlink. `[CITED: github.com/nodejs/node/issues/19077]`

**How to avoid:**
1. **Don't cross volumes.** Phase 8 writes the `.tmp` file in the SAME directory as the final `.stmproj` (the user-picked save location). Same dir → same FS → no `EXDEV`. (Identical strategy to Phase 6.)
2. **Accept the rare Windows EPERM as a transient `'write-error'` for Phase 8.** The project file is non-critical (user can retry; previous file is intact via the `.tmp` failure). DO NOT pull in `graceful-fs` or `write-file-atomic` for Phase 8 — it's a single-write-per-user-action surface.
3. **Document the Windows-specific behavior in the error envelope:** if the surface ever becomes a recurring complaint (Phase 9+), add a 200ms × 3 retry loop on `EPERM | EACCES | EBUSY` in `project-io.ts`. Phase 8 ships without retry.

**Warning signs:** "Save failed" toast on Windows during `fs.rename` step; tmp file orphaned in the save directory.

### Pitfall 3: JSON Map ↔ Object boundary

**What goes wrong:** `JSON.stringify(new Map([['CIRCLE', 50]]))` returns `"{}"` — Maps don't serialize.
**Why it happens:** JSON has no Map; `JSON.stringify` doesn't iterate non-enumerable properties, and Map's entries are stored on internal slots, not enumerable own properties.
**How to avoid:** Convert at the seam.

```typescript
// SAVE: src/core/project-file.ts serializeProjectFile
const overridesJson = Object.fromEntries(state.overrides);  // Map → plain {}

// LOAD: src/core/project-file.ts materializeProjectFile
const overridesMap = new Map(Object.entries(file.overrides));  // {} → Map
```

Both directions are pure functions; both live in `src/core/project-file.ts`. The IPC boundary itself does NOT see Maps — `IPC payloads are structuredClone-locked per src/shared/types.ts top-of-file` `[VERIFIED: src/shared/types.ts:14]`. ProjectFileV1's `overrides` field MUST be `Record<string, number>`, not `Map`.

**Warning signs:** Save produces `"overrides": {}` even when user has overrides set. (Will surface immediately in the round-trip golden test.)

### Pitfall 4: `path.relative` cross-volume returns absolute path silently

**What goes wrong:** When the project file's directory and the skeleton path are on different volumes (Windows different drive letter, macOS different mount), `path.relative` does NOT throw — it returns the absolute path of the target verbatim. If you store that as the "relative" field, a future load tries to absolutize it against the project dir and gets a wrong path.
**Why it happens:** Designed behavior — relative paths between drives don't exist on Windows. `[CITED: nodejs.org/api/path.html — path.win32.relative('Z:\\tmp\\', 'C:\\Users\\Jane\\') returns 'C:\\Users\\Jane']`. On POSIX, paths can theoretically cross mounts but `path.relative` will produce a `'..' × N` chain that escapes to root — also unreliable for the "is it portable?" question.
**How to avoid:** Implement explicit cross-volume detection. The locked CONTEXT.md says: "if `relative` starts with `..` AND the absolute drive letters / mount roots differ, store absolute". Codify:

```typescript
// PROPOSED PHASE 8 src/core/project-file.ts pattern.
import * as path from 'node:path';

export function relativizePath(absolutePath: string, basedir: string): string {
  if (!path.isAbsolute(absolutePath)) {
    // Defensive: caller should always pass absolute paths to this fn.
    throw new Error(`relativizePath: expected absolute, got '${absolutePath}'`);
  }
  const rel = path.relative(basedir, absolutePath);
  // Windows: path.relative across drives returns the absolute target (e.g.
  // 'C:\\foo' or 'C:/foo' depending on path.win32 vs path.posix). Detect by
  // checking if the result is itself absolute.
  if (path.isAbsolute(rel)) {
    return absolutePath;  // store absolute
  }
  // POSIX: cross-volume produces '../../../Volumes/Other/file'. Detect by
  // checking if root segments differ. parse() returns { root, dir, base, name, ext }.
  const baseRoot = path.parse(path.resolve(basedir)).root;
  const targetRoot = path.parse(absolutePath).root;
  if (baseRoot !== targetRoot) {
    return absolutePath;  // store absolute
  }
  return rel;  // safe relative
}

export function absolutizePath(stored: string, basedir: string): string {
  if (path.isAbsolute(stored)) return stored;
  return path.resolve(basedir, stored);
}
```

**Warning signs:** Load fails with "Skeleton not found" right after a Save where the skeleton was on a different drive than the project file. Or: opening the `.stmproj` file in a text editor reveals an absolute path in the `skeletonPath` field on a save where the user explicitly chose to save in the rig folder.

### Pitfall 5: `webUtils.getPathForFile` returns `''` for synthesized File objects

**What goes wrong:** Drag-drop a `.stmproj` file onto the DropZone. The preload calls `webUtils.getPathForFile(file)`; for a synthesized File (e.g. a test harness creates `new File([blob], 'foo.stmproj')`), this returns `''`.
**Why it happens:** Documented behavior of `webUtils.getPathForFile`. `[CITED: src/preload/index.ts:53–63 inline pitfall acknowledgment]`
**How to avoid:** Reuse the exact pattern Phase 1 already uses for `loadSkeletonFromFile` — guard at preload, return typed-error envelope.

```typescript
// PROPOSED PHASE 8 src/preload/index.ts pattern (mirrors loadSkeletonFromFile):
openProjectFromFile: async (file: File): Promise<OpenResponse> => {
  const path = webUtils.getPathForFile(file);
  if (!path) {
    return { ok: false, error: { kind: 'Unknown', message: 'Dropped file has no filesystem path.' } };
  }
  return ipcRenderer.invoke('project:open-from-path', path);
}
```

**Warning signs:** Renderer-side test using `new File([])` returns "no filesystem path" error in the load. (Real dragged file from OS is always backed.)

### Pitfall 6: Cmd+S inside an open modal

**What goes wrong:** User opens OverrideDialog, types in the percent input, presses Cmd+S. Without suppression, AppShell-level `keydown` listener fires Save while the dialog is mid-edit — confusing.
**Why it happens:** Window-level listener fires on every keydown regardless of focus.
**How to avoid:** Suppress when ANY modal is open. Cheapest signal: `document.querySelector('[role="dialog"]')` is non-null.

```typescript
const onKeyDown = (e: KeyboardEvent) => {
  if (!(e.metaKey || e.ctrlKey)) return;
  if (document.querySelector('[role="dialog"]')) return;  // modal open → suppress
  // ... rest of handler
};
```

This is robust against future modal additions because every project modal uses `role="dialog"` (verified across OverrideDialog, OptimizeDialog, ConflictDialog, AtlasPreviewModal). The hand-rolled discipline (D-81) means new modals MUST follow the pattern. SaveQuitDialog itself uses `role="dialog"` — but Cmd+S inside SaveQuitDialog is a user clicking Save anyway, which is correctly the `Save` button click; Cmd+S firing the AppShell handler in parallel would create confusion. The suppression handles this.

**Warning signs:** User is editing an override percent, presses Cmd+S, and a Save As dialog opens (or worse, a silent overwrite).

### Pitfall 7: Race between `before-quit` and `webContents.send` arrival timing

**What goes wrong:** Main calls `webContents.send('project:check-dirty-before-quit')`, then... nothing. Main is paused on `event.preventDefault()`; renderer never gets the message.
**Why it happens:** `webContents.send` is one-way and async; if `app.quit()` were re-issued before the send completed, the message could be dropped. The pattern in Pitfall #1 sidesteps this — main is paused at `event.preventDefault()` waiting for the renderer's reply via `ipcMain.on('project:confirm-quit-proceed')`.
**How to avoid:** Confirm the wiring is one-way send + one-way receive (not a single `invoke` that would deadlock):

| Direction | Channel | Type |
|-----------|---------|------|
| Main → Renderer | `'project:check-dirty-before-quit'` | `webContents.send` (one-way) |
| Renderer → Main | `'project:confirm-quit-proceed'` | `ipcRenderer.send` (one-way) |
| Renderer → Main | (none — Cancel = no message; main stays paused, app keeps running until user retries quit) | — |

This is a dual-one-way pattern, not a request/response. Reason: `ipcRenderer.invoke` would create a promise that the renderer side resolves on user action — which is fine in principle, BUT main's `before-quit` handler can't `await` the invoke (the listener is sync in event semantics). The dual-send pattern keeps it dirt-simple.

**Warning signs:** App quits without showing the dialog (renderer didn't receive the send, or received it after main re-issued quit).

### Pitfall 8: Stale-override notice survives across new loads

**What goes wrong:** User opens project A, sees the stale-override banner ("3 overrides skipped"), opens project B, banner still says "3 overrides skipped" even though B has no stale overrides.
**Why it happens:** The banner state is renderer-side (`useState` in AppShell); on new load, parent transitions through idle/loading and AppShell remounts — but if the banner state lives at App.tsx level (above AppShell), or if AppShell is keyed without a remount-on-load mechanism, the state persists.
**How to avoid:** Verify that the banner state lives INSIDE AppShell (not above it). AppShell remounts on every drop because App.tsx transitions through `idle`/`loading` `[VERIFIED: src/renderer/src/components/AppShell.tsx:13–14 docstring "State resets on every new skeleton drop by virtue of the parent's status machine unmounting this component during the idle / loading transition"]`. Banner state goes in AppShell's `useState` — it remounts to clean automatically.

```typescript
// AppShell.tsx — banner state lives here, alongside currentProjectPath
const [staleOverridesNotice, setStaleOverridesNotice] = useState<{
  count: number;
  names: string[];
} | null>(null);

// Set when Open resolves with a non-empty stale list:
useEffect(() => {
  // Compute on summary change (Open's response replaces summary prop)
  if (restoredOverrides) {
    const present = new Set(summary.peaks.map(r => r.attachmentName));
    const stale = Array.from(restoredOverrides.keys()).filter(name => !present.has(name));
    if (stale.length > 0) setStaleOverridesNotice({ count: stale.length, names: stale });
    // Drop stale entries from the live overrides Map
    const live = new Map([...restoredOverrides].filter(([k]) => present.has(k)));
    setOverrides(live);
  }
}, [summary]);
```

**Warning signs:** Banner persists when it shouldn't. Banner text shows wrong count.

### Pitfall 9: `JSON.parse` on user-supplied bytes throws SyntaxError, not a typed error

**What goes wrong:** User edits a `.stmproj` file by hand, introduces a syntax error, drops it on the app — `JSON.parse` throws `SyntaxError: Unexpected token`, and if you don't catch it, the `ipcMain.handle` rejects with an opaque message.
**How to avoid:** Wrap `JSON.parse` in try/catch and surface as `'ProjectFileParseError'`:

```typescript
// PROPOSED PHASE 8 src/main/project-io.ts pattern.
try {
  const text = await readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(text);  // may throw SyntaxError
  const result = validateProjectFile(parsed);
  // ...
} catch (err) {
  if (err instanceof SyntaxError) {
    return {
      ok: false,
      error: { kind: 'ProjectFileParseError', message: `Invalid JSON: ${err.message}` },
    };
  }
  // ENOENT, EACCES, etc.
  return {
    ok: false,
    error: { kind: 'ProjectFileNotFoundError', message: err instanceof Error ? err.message : String(err) },
  };
}
```

**Warning signs:** Test "drop malformed JSON" produces an Unknown error envelope instead of a typed `ProjectFileParseError`.

### Pitfall 10: Layer 3 grep already auto-scans `src/core/**/*.ts`

**What goes wrong:** Plan author thinks they need to extend `tests/arch.spec.ts` to add `src/core/project-file.ts` to a list of "files to check".
**Why it happens:** Easy to misread the existing arch tests.
**How to avoid:** Verified — the existing Phase 1+6 grep at `tests/arch.spec.ts:118` uses `globSync('src/core/**/*.ts')`, which AUTOMATICALLY picks up any new file under `src/core/`. The grep tests for `from 'sharp'` and `from 'node:fs'`. **Phase 8's `src/core/project-file.ts` will be auto-scanned with ZERO modification to arch.spec.ts.** `[VERIFIED: tests/arch.spec.ts:117–134 read inline]`

That said, IF Phase 8 wants to LOCK additional Layer-3 invariants (e.g. "`src/core/project-file.ts` must not import from `electron`"), an additional grep block CAN be added — but it's discretionary. The minimum-viable path is no edit.

**Warning signs:** Plan task list has "extend tests/arch.spec.ts" — verify whether the existing globSync coverage suffices first.

## Code Examples

### Verified existing pattern: hand-rolled validator (mirror for `validateProjectFile`)

```typescript
// Source: src/main/ipc.ts:92–112 [VERIFIED: read inline]
function validateExportPlan(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  const p = plan as { rows?: unknown; excludedUnused?: unknown; totals?: unknown };
  if (!Array.isArray(p.rows)) return 'plan.rows is not an array';
  if (!Array.isArray(p.excludedUnused)) return 'plan.excludedUnused is not an array';
  if (!p.totals || typeof p.totals !== 'object') return 'plan.totals is not an object';
  for (let i = 0; i < p.rows.length; i++) {
    const r = p.rows[i] as Record<string, unknown>;
    if (
      typeof r.sourcePath !== 'string' || r.sourcePath.length === 0 ||
      // ... etc
    ) {
      return `plan.rows[${i}] has invalid shape`;
    }
  }
  return null;
}
```

### Verified existing pattern: atomic-write (mirror for project save)

```typescript
// Source: src/main/image-worker.ts:255–294 [VERIFIED: read inline]
const tmpPath = resolvedOut + '.tmp';
try {
  await sharp(sourcePath)
    .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(tmpPath);
} catch (e) {
  // ...
}
try {
  await rename(tmpPath, resolvedOut);
} catch (e) {
  // ...
}
```

### Verified existing pattern: contextBridge surface extension (mirror for 5 new methods)

```typescript
// Source: src/preload/index.ts:50–141 [VERIFIED: read inline]
const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) return { ok: false, error: { kind: 'Unknown', message: '...' } };
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },
  pickOutputDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),
  startExport: (plan, outDir, overwrite) =>
    ipcRenderer.invoke('export:start', plan, outDir, overwrite === true),
  // ... etc
};
```

Phase 8 extends `Api` and adds 5 lines of `ipcRenderer.invoke` glue.

### Verified existing pattern: renderer test setup (mirror for save-load.spec.tsx)

```typescript
// Source: tests/renderer/atlas-preview-modal.spec.tsx:1–22 [VERIFIED: read inline]
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AtlasPreviewModal } from '../../src/renderer/src/modals/AtlasPreviewModal';
import type { SkeletonSummary, DisplayRow } from '../../src/shared/types';

afterEach(cleanup);
```

The Phase 8 `tests/renderer/save-load.spec.tsx` follows this exact prelude.

### Proposed Phase 8 pattern: project file shape (TypeScript)

```typescript
// PROPOSED — to be added to src/shared/types.ts
export interface ProjectFileV1 {
  version: 1;
  skeletonPath: string;          // relative to project file dir, OR absolute on cross-volume
  atlasPath: string | null;      // hint only; loader auto-rediscovers
  imagesDir: string | null;      // hint only; loader auto-rediscovers
  overrides: Record<string, number>;  // attachmentName → percent (1..100)
  samplingHz: number | null;     // null → 120 default (D-146)
  lastOutDir: string | null;     // absolute (D-145 — output dirs are user-picked, no relativization)
  sortColumn: string | null;     // 'attachmentName' | 'skinName' | 'sourceW' | 'worldW' | 'peakScale' | 'animationName' | 'frame'
  sortDir: 'asc' | 'desc' | null;
  documentation: object;         // reserved for doc-builder phase (D-148)
}

export type ProjectFile = ProjectFileV1;  // Single-version alias today; union grows in v2

export interface MaterializedProject {
  // The in-memory shape after materializeProjectFile resolves paths.
  summary: SkeletonSummary;             // re-sampled, ready to mount
  restoredOverrides: Record<string, number>;  // pre-stale-filter
  staleOverrideKeys: string[];          // computed renderer-side OR main-side; D-150 recommends renderer
  samplingHz: number;                   // resolved (null → 120)
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  currentProjectPath: string;           // absolute
}

export type SaveResponse =
  | { ok: true; path: string }          // absolute path written
  | { ok: false; error: SerializableError };

export type OpenResponse =
  | { ok: true; project: MaterializedProject }
  | { ok: false; error: SerializableError };

export type LocateSkeletonResponse =
  | { ok: true; newPath: string }       // absolute path the user picked
  | { ok: false };                      // user cancelled the picker

// EXTEND existing kind union (currently in src/shared/types.ts:491)
// Add: 'ProjectFileNotFoundError' | 'ProjectFileParseError' | 'ProjectFileVersionTooNewError' | 'SkeletonNotFoundOnLoadError'
```

### Proposed Phase 8 pattern: AppSessionState (the renderer-internal shape that Save serializes)

```typescript
// PROPOSED — to be added to src/shared/types.ts (or kept renderer-local; either works).
//
// AppSessionState is the SHAPE serializeProjectFile consumes. Field-for-field
// what AppShell owns that gets persisted.
export interface AppSessionState {
  skeletonPath: string;                   // absolute (resolved from summary.skeletonPath)
  atlasPath: string | null;               // absolute or null (from summary.atlasPath at save time)
  imagesDir: string | null;               // absolute or null (derived from skeletonPath sibling)
  overrides: Map<string, number>;         // canonical AppShell map
  samplingHz: number;                     // currently always 120 (Phase 9 lets user mutate)
  lastOutDir: string | null;              // last-used Optimize Assets out dir
  sortColumn: string | null;              // GlobalMaxRenderPanel current sort
  sortDir: 'asc' | 'desc' | null;
}
```

This shape does NOT exist anywhere in `src/shared/types.ts` today `[VERIFIED: grep returned no match]`. Phase 8 introduces it.

### Proposed Phase 8 pattern: Default sort column key strings (verified from codebase)

```typescript
// VERIFIED Phase 4 source: src/renderer/src/panels/GlobalMaxRenderPanel.tsx:66–74
type SortCol =
  | 'attachmentName'   // default per Phase 4 D-91 + Plan 04-03 Gap C
  | 'skinName'
  | 'sourceW'
  | 'worldW'
  | 'peakScale'
  | 'animationName'
  | 'frame';
type SortDir = 'asc' | 'desc';

// Default at AppShell mount: sortCol='attachmentName', sortDir='asc'
// (src/renderer/src/panels/GlobalMaxRenderPanel.tsx:468–469)
```

Phase 8's `sortColumn` field stores these literal strings. The planner can either:
- (a) Lift `SortCol` type into `src/shared/types.ts` so the project file's field is type-safe (recommended).
- (b) Keep it as plain `string | null` in the schema and document the allowed values in a JSDoc.

Recommendation: (a) — typed unions catch typos at compile time; the cost is one moved type definition.

### Proposed Phase 8 pattern: `samplingHz` threading on Load

```typescript
// PROPOSED Phase 8 src/main/project-io.ts pattern.
// On Load, after validate + migrate:
const resolvedSamplingHz = file.samplingHz ?? 120;  // D-146 default-on-absent

const load = loadSkeleton(materialized.skeletonPath);
const sampled = sampleSkeleton(load, { samplingHz: resolvedSamplingHz });
const summary = buildSummary(load, sampled, performance.now() - t0);
return { ok: true, project: { summary, samplingHz: resolvedSamplingHz, ... } };
```

The existing `sampleSkeleton({ samplingHz })` plumbing is already in place `[VERIFIED: src/core/sampler.ts:84–141]`. The current `handleSkeletonLoad` calls `sampleSkeleton(load)` (no opts) `[VERIFIED: src/main/ipc.ts:240]` — that's fine for the regular drop path; Phase 8's project-Load path threads the override.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `event.preventDefault()` + immediate `app.quit()` recursion | `event.preventDefault()` + flag + `setTimeout(() => app.quit(), 0)` | Electron 18+ documented bug 2022; still unfixed in Electron 41 (April 2026) | Phase 8 MUST follow the deferred pattern. |
| `file.path` on dropped Files | `webUtils.getPathForFile(file)` | Electron 32 (2024 deprecation, 32+ removal) | Phase 1 already migrated; Phase 8 inherits. |
| `ipcRenderer.send` + reply via separate channel for everything | `ipcRenderer.invoke` for request/response, `send` only for one-way | Electron 7+ (2019) but project canon since Phase 1 | Phase 8 uses `invoke` for save/open; `send` for the dirty-guard handshake. |
| `tailwind.config.js` v3 with utility opt-ins | Tailwind v4 `@theme inline` CSS-first | Tailwind v4 GA late 2024 | Already adopted in Phase 1 D-12/D-14. |
| Custom focus-trap per modal | Shared `useFocusTrap(ref, enabled, { onEscape })` hook | Phase 6 Round 6 (2026-04-25) | Phase 8 SaveQuitDialog reuses verbatim. |

**Deprecated/outdated:**
- **`file.path` direct property:** removed Electron 32; use `webUtils.getPathForFile`.
- **`remote` module:** removed Electron 14; use `ipcMain` + `contextBridge`.
- **`enableRemoteModule`:** never enabled in this project (sandbox: true since Phase 1).

## Assumptions Log

> Claims tagged `[ASSUMED]` in this research. Each is something the planner should verify before locking it into a plan.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Window-level `document.querySelector('[role="dialog"]')` is a sufficient signal for "any modal is open" suppression of Cmd+S+O. | Pattern 4 / Pitfall 6 | If a future modal omits `role="dialog"` (e.g. a non-modal popover that uses a different ARIA role), Cmd+S would fire while the popover is interactive. Mitigation: arch.spec grep guards every modal in `src/renderer/src/modals/` to require `role="dialog"`. Not currently enforced; Phase 8 could add. |
| A2 | `setTimeout(() => app.quit(), 0)` reliably breaks the `before-quit` re-entry on Electron 41. | Pitfall 1 | If the bug is fixed in 41 (we couldn't verify against 41-specific changelog), the setTimeout is harmless overhead. If the bug exists differently in 41, we'd need a different escape. Mitigation: human-verify the dirty-guard quit flow on macOS + Windows. |
| A3 | The `before-quit` IPC roundtrip works under sandbox (`sandbox: true`, `contextIsolation: true`) which Phase 1 D-06 locks. | §System Architecture / Pitfall 7 | Sandbox rejects some preload patterns. The existing preload already uses `ipcRenderer.on` for `'export:progress'` (Phase 6 D-119) verified against sandbox `[VERIFIED: src/preload/index.ts:128]`, so the inverse direction (renderer → main `ipcRenderer.send`) and the new `ipcRenderer.on('project:check-dirty-before-quit')` are very likely fine. But human-verify is the gate. |
| A4 | The `useFocusTrap` hook's auto-focus-on-mount lands on the SaveQuitDialog's first tabbable button (Save, with `font-semibold`), not on Cancel. | Pattern 3 | Reading the hook source: it focuses the first matching `TABBABLE_SELECTOR`. Whichever button comes first in the JSX is the default focus. Plan SaveQuitDialog with Save FIRST in the JSX so initial focus + Enter = "Save and quit" (the safe-by-default action). Risk: if planner orders buttons Cancel/Don'tSave/Save left-to-right (which is stylistically common), Tab order matches DOM order, so Cancel would auto-focus. Recommend explicit `autoFocus`-style override on Save OR planner stages Save first in DOM order with CSS `order:` to control visual placement. |
| A5 | Stale-override drop notice's "+M more" cap at 5 names is not specified by CONTEXT.md but is implied by D-150's example "GHOST, OLD_HAT, …". | D-150 / Pitfall 8 | If the user actually wants the FULL list visible (debugging a renamed-many-attachments rig), the cap hides info. Mitigation: hover/tooltip surfaces the full list; or keep the cap and show the rest on click-to-expand. Planner picks. |
| A6 | The reserved `documentation: {}` slot will be `{}` byte-for-byte after a round-trip even when validateProjectFile runs (i.e. the field's content is preserved verbatim, not normalized). | D-148 / D-156 | If validateProjectFile does any normalization (e.g. strips unknown sub-keys), the doc-builder phase couldn't fill in arbitrary content without a schema bump. Mitigation: validateProjectFile must accept ANY object value for `documentation` and pass it through unchanged. Test (D-148 round-trip): write `documentation: { nested: { tracklist: [1,2,3] } }`, save, load — verify identical. Lock in `tests/core/project-file.spec.ts`. |
| A7 | The Phase 9 Settings modal will land in the same MAJOR version (v1) of the schema, not require a v2 bump. | D-146 | If Phase 9 adds e.g. a `worker` boolean for the worker-thread sampler, that's still v1 (additive optional fields). If Phase 9 changes existing field semantics (e.g. samplingHz becomes a string preset), it MUST bump to v2. Verify scope at `/gsd-plan-phase 9` time. |
| A8 | `path.parse(absolutePath).root` reliably returns the volume root identifier on both Windows (`'C:\\'`, `'D:\\'`) and macOS (`'/'`, `'/Volumes/Other/'` is NOT a root — it's `'/'`). | Pitfall 4 | On macOS, mounted external volumes still share `'/'` as `path.parse(...).root`. The cross-volume detection rule "roots differ" UNDERDETECTS macOS-mount-cross — `/Users/x/proj` and `/Volumes/Other/skel` both have root `/`. **However**, `path.relative('/Users/x', '/Volumes/Other/skel')` returns `'../../Volumes/Other/skel'`, which is "valid" relative and would resolve correctly via `path.resolve` — so the relative IS portable IF the mount stays mounted at the same point. The risk is "Other.dmg unmounts then remounts elsewhere" — which is the same risk as moving any folder, handled by D-149's locate-skeleton recovery. **Conclusion:** the macOS cross-volume case is not a special hazard for the relative form; only Windows different drive letters need explicit detection. The proposed `relativizePath` already handles it via `path.isAbsolute(rel)` check. |
| A9 | Renderer-side `JSON.stringify(file, null, 2)` produces deterministic, diff-able output (key order stable). | D-154 | V8's `JSON.stringify` preserves insertion order of own enumerable string-keyed properties. As long as `serializeProjectFile` builds the object in a stable field order (e.g. version FIRST, then skeletonPath, then ...), the output is stable across runs. Lock the field order explicitly in `serializeProjectFile`. |
| A10 | The `before-quit` event fires on Cmd+W (close window) AND Cmd+Q (quit app), giving the dirty-guard coverage on both. | D-143 | Per Electron docs, `before-quit` fires on Cmd+Q AND `app.quit()` AND user closes the LAST window (which triggers `window-all-closed → app.quit()`). Closing a NON-last window does NOT fire `before-quit` — but Phase 1 D-23 single-window means there's only one window, so any window close IS quit. ✓ Confirmed. |

**If this table is empty:** N/A — there are 10 assumptions. The discuss-phase already locked the architectural decisions; what remains is verification of edge-case behaviors via human-verify and golden tests. None of A1–A10 contradicts a locked decision; each is an implementation detail that warrants a test or a UAT gate.

## Open Questions (RESOLVED)

> All six questions resolved 2026-04-26 during the planner-revision pass against
> Plans 01-05. Each question's recommendation has been locked into the plan set;
> any planner re-read of this file should treat the **RESOLVED** lines as the
> binding answer. Original wording preserved for traceability.

1. **Should the renderer or main process compute the stale-override key list?**
   - What we know: D-150 says "After re-sampling, compute `staleKeys = ...`. Drop them from the active map." Doesn't specify which process.
   - What's unclear: If main computes, the OpenResponse envelope carries `staleOverrideKeys: string[]`. If renderer computes, the OpenResponse carries the full `restoredOverrides` and the renderer diff'd against `summary.peaks`.
   - Recommendation: **Renderer** computes. It already has `summary.peaks` and the restored map; the diff is a one-liner. Main stays minimal-glue. Lock in MaterializedProject shape: `restoredOverrides: Record<string, number>` (no separate staleKeys field).
   - **RESOLVED: main-side.** Plan 03 owns the diff (`handleProjectOpenFromPath` step 9 — `presentNames = new Set(summary.peaks.map(...))`, intersect, drop). The IPC envelope carries `MaterializedProject.staleOverrideKeys: string[]` so the renderer can render the banner WITHOUT re-walking the override map. Reverses the original recommendation in favor of less renderer work + a smaller IPC contract surface (renderer only reads + displays, never recomputes). Plan 02 `MaterializedProject` type carries `staleOverrideKeys: string[]`; Plan 03 fills it; Plan 04 reads it.

2. **Should `currentProjectPath` reset to null on a NEW SKELETON drop, or persist?**
   - What we know: CONTEXT.md "Claude's Discretion" says "Recommend: reset to null. The project file is rig-bound conceptually; loading a different rig produces a different project." But left to planner discretion.
   - What's unclear: User's mental model — does Save-As "fork" the project under the new rig, or is the project tied to the rig?
   - Recommendation: Reset to null. Save under the new rig produces a new untitled project. (The user can save with the old name and `<skeletonDir>` from the new rig if they want, via Save As.)
   - **RESOLVED: yes, reset `currentProjectPath` to null on new-skeleton-drop.** Matches the recommendation. Project files are rig-bound conceptually; dropping a different `.json` produces a new untitled session. AppShell remounts on every drop (Phase 1 reset-on-drop discipline) so this falls out naturally — Plan 04's AppShell mounts with `currentProjectPath = null` by default; only `.stmproj` drops or `Open` invocations populate it via `initialProject` props.

3. **Should the SaveQuitDialog's Save button block on the saveProject promise, or close immediately and rely on a synchronous "save-in-flight" indicator?**
   - What we know: D-143 says "`Save` (calls saveProject then proceeds)". Implies promise-await.
   - What's unclear: If saveProject takes >100ms (slow disk), the dialog is "stuck" with no indicator.
   - Recommendation: Disable the Save button + show "Saving…" text while the promise resolves. saveProject is small (<100KB JSON write); on a healthy machine it's <50ms. Acceptable.
   - **RESOLVED: block on the saveProject promise + show "Saving…" state on the Save button.** Encoded in Plan 04 Task 1 (`SaveQuitDialog.tsx`) via the `saving?: boolean` prop — when true, all 3 buttons are disabled and the Save button label flips to "Saving…". Plan 04 Task 2a sets `saveInFlight = true` for the duration of the `saveProject` promise; passes `saving={saveInFlight}` into the modal mount.

4. **What's the exact CSS class string for the new-skeleton-drop dirty-guard banner — accent or danger?**
   - What we know: The banner is the SaveQuitDialog (modal, not banner). The "stale-override skipped" notice IS a banner — and CONTEXT.md says "above the panels", "dismissible", "N saved overrides skipped".
   - What's unclear: Does the banner use `--color-danger` (terracotta — Phase 5 D-104) or `--color-accent-muted` (orange-300, Phase 1)?
   - Recommendation: `--color-fg-muted` text on `--color-panel` background with a `border-l-2 border-accent` bar (informational, not alarming). Stale-override drop is not an error; it's a "FYI". `--color-danger` would over-alarm.
   - **RESOLVED: muted-fg text on panel background with an accent left-border bar.** Encoded literally in Plan 04 Task 2b stale-override banner block: `bg-panel`, `text-fg-muted`, with a 4px-tall `bg-accent` left-bar (`<span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />`). Informational, not alarming. `--color-danger` reserved for actual error paths (e.g., the SkeletonNotFoundOnLoadError inline error block keeps the existing error-banner styling).

5. **Does Phase 8 need a UAT for "Save → close app via Cmd+Q without ever quitting via the dialog → re-open same file"?**
   - What we know: ROADMAP exit criterion is the round-trip "set overrides → Save → close app → Load → overrides restored".
   - What's unclear: Whether "close app" is `before-quit`-with-dirty-guard or just `Cmd+Q` (and the test ensures dirty-state is false because Save already cleared it).
   - Recommendation: After Save, isDirty is false → `before-quit` skips the dialog → app quits cleanly → re-open works. UAT covers both: (a) Save then quit (no dialog appears, app exits), (b) make changes then quit (dialog appears, click Save and Quit, file gets the changes).
   - **RESOLVED: yes, included in Plan 05 manual UAT.** Plan 05 Gate 1 covers the clean-Save→Cmd+Q→re-open path (full ROADMAP exit criterion, steps 6-13). Plan 05 Gate 4 covers the dirty-Cmd+Q + 3-button-dialog path (Sub-gates 4a/4b/4c). Both are blocking gates — phase cannot close without both passing.

6. **Should the planner add a Layer-3-extension grep for `src/core/project-file.ts` not importing `electron`?**
   - What we know: existing `tests/arch.spec.ts:128` blocks `node:fs` and `sharp` for all `src/core/**/*.ts`. Does NOT block `electron`.
   - What's unclear: Phase 8 wants `src/core/project-file.ts` to be Electron-free (so the validator could theoretically run in Node-only contexts like a future CLI inspector). The CONTEXT.md says "no `fs`, no Electron, no DOM". The existing grep covers fs but not electron.
   - Recommendation: ADD a one-line grep block — `expect(/from ['"]electron['"]/.test(text)).toBe(false)` for all `src/core/**/*.ts`. Cheap, catches a real concern, fits the existing arch.spec.ts pattern.
   - **RESOLVED: yes, added in Plan 01 Task 4 Part B.** A standalone describe block at the bottom of `tests/arch.spec.ts` explicitly targets `src/core/project-file.ts` by name with electron + fs + sharp grep guards. Uses graceful-skip pattern (try/catch on readFileSync) so the block stays green during Wave 1 before Plan 02 lands the file. T-08-LAYER threat reference embedded in the describe block.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner, electron-vite, vitest | ✓ | (Node 24 per package.json `engines`) | — |
| npm | Package install (none new in P8) | ✓ | bundled with Node | — |
| Electron | Runtime + dialog API | ✓ | 41.3.0 | — (locked Phase 1) |
| `@esotericsoftware/spine-core` | Skeleton re-sample on Load | ✓ | 4.2.x | — |
| `vitest` | Test framework | ✓ | 4.0.x | — |
| `jsdom` + `@testing-library/react` | Renderer specs | ✓ | 29.0.2 / 16.3.2 | — (Phase 7 added) |
| `sharp` | NOT REQUIRED — Phase 8 doesn't touch images | ✓ (still in deps for Phase 6) | 0.34.5 | — |
| Existing `src/main/image-worker.ts` (atomic-write reference) | Pattern reference, not import | ✓ | shipped Phase 6 | — |
| Existing `src/core/loader.ts` (F1.2 auto-discovery) | Reused on Open | ✓ | shipped Phase 1 / Phase 6 | — |
| Existing `src/core/sampler.ts` (with `samplingHz` opt) | Reused on Open | ✓ | shipped Phase 0 | — |
| Existing `src/renderer/src/hooks/useFocusTrap.ts` | Reused by SaveQuitDialog | ✓ | shipped Phase 6 Round 6 | — |
| Existing Tailwind v4 tokens (`--color-panel`, `--color-border`, `--color-fg`, `--color-fg-muted`, `--color-accent`, `--color-accent-muted`, `--color-danger`, `--color-surface`) | All UI surfaces | ✓ | shipped Phase 1 + Phase 5 | — `[VERIFIED: src/renderer/src/index.css:49–65]` |

**Missing dependencies with no fallback:** None. Phase 8 adds zero new external deps.

**Missing dependencies with fallback:** None.

## Validation Architecture

> Phase 8 inherits Nyquist enabled (no `workflow.nyquist_validation: false` in `.planning/config.json` `[VERIFIED]`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.x |
| Config file | `vitest.config.ts` (jsx: 'automatic'; node env default; jsdom opted-in per file via `// @vitest-environment jsdom`; include scans `tests/**/*.spec.ts` and `tests/**/*.spec.tsx`) `[VERIFIED]` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` (single command runs all 240+ tests in <10s) |
| Renderer test setup | `// @vitest-environment jsdom` directive line 1; `import { cleanup, render, screen, fireEvent } from '@testing-library/react';` (mirrors `tests/renderer/atlas-preview-modal.spec.tsx`) |

### Phase 8 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **F9.1** | Save writes a `.stmproj` file containing skeleton path, atlas/images root, overrides, samplingHz | unit | `npx vitest run tests/main/project-io.spec.ts -t "save writes file with all D-145 fields"` | ❌ Wave 0 |
| **F9.1** | `documentation: {}` reserved slot is preserved on round-trip | unit | `npx vitest run tests/core/project-file.spec.ts -t "documentation slot preserved"` | ❌ Wave 0 |
| **F9.2** | Load restores overrides | unit | `npx vitest run tests/main/project-io.spec.ts -t "load restores overrides verbatim"` | ❌ Wave 0 |
| **F9.2** | Load re-runs sampler with restored samplingHz | unit | `npx vitest run tests/main/project-io.spec.ts -t "load threads samplingHz into sampleSkeleton"` | ❌ Wave 0 |
| **F9.2** | Load with stale-override keys drops them + surfaces in response | unit | `npx vitest run tests/main/project-io.spec.ts -t "load drops stale override keys"` | ❌ Wave 0 |
| **D-149** | Load with missing skeleton returns `'SkeletonNotFoundOnLoadError'` | unit | `npx vitest run tests/main/project-io.spec.ts -t "missing skeleton returns typed error"` | ❌ Wave 0 |
| **D-151** | Load with `version > 1` returns `'ProjectFileVersionTooNewError'` | unit | `npx vitest run tests/core/project-file.spec.ts -t "newer version rejected"` | ❌ Wave 0 |
| **D-152** | Load re-runs F1.2 atlas auto-discovery when atlasPath is null | unit | `npx vitest run tests/main/project-io.spec.ts -t "atlas auto-discovery on null path"` | ❌ Wave 0 |
| **D-155** | Relative paths resolve back to absolute on load (round-trip) | unit | `npx vitest run tests/core/project-file.spec.ts -t "round-trip relative paths"` | ❌ Wave 0 |
| **D-155** | Cross-volume paths fall back to absolute storage | unit | `npx vitest run tests/core/project-file.spec.ts -t "cross-volume falls back to absolute"` | ❌ Wave 0 |
| **D-156** | `validateProjectFile` rejects: missing version, unknown version, malformed JSON, missing required field | unit | `npx vitest run tests/core/project-file.spec.ts -t "validator rejects"` | ❌ Wave 0 |
| **D-156** | `validateProjectFile` accepts: minimal v1, full v1 with all optional fields | unit | `npx vitest run tests/core/project-file.spec.ts -t "validator accepts"` | ❌ Wave 0 |
| **D-141** | Save click with currentProjectPath !== null writes to existing path (no dialog) | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Save reuses currentProjectPath"` | ❌ Wave 0 |
| **D-140** | Cmd+S on window fires Save handler | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Cmd+S triggers Save"` | ❌ Wave 0 |
| **D-140** | Cmd+S while OverrideDialog open does NOT fire Save | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Cmd+S suppressed when modal open"` | ❌ Wave 0 |
| **D-143** | New-skeleton-drop on dirty session opens SaveQuitDialog | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dirty + drop opens guard"` | ❌ Wave 0 |
| **D-144** | Filename chip renders `• MyRig.stmproj` when isDirty | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dirty marker bullet"` | ❌ Wave 0 |
| **D-150** | Stale-override banner renders count + name list | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "stale override banner"` | ❌ Wave 0 |
| **D-142** | DropZone branches on extension | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dropzone branch on stmproj"` | ❌ Wave 0 |
| **Layer 3** | `src/core/project-file.ts` imports no fs/sharp/electron | hygiene | `npx vitest run tests/arch.spec.ts -t "Architecture boundary"` (auto-scans new file via globSync) + optional new electron-block | ✅ existing covers fs/sharp; ❌ Wave 0 for electron |
| **N4 atomicity** | Save mid-write kill leaves original `.stmproj` intact | manual UAT | `kill -9 $(pgrep electron)` mid-Save in dev mode | manual gate |
| **N4 round-trip** | Set overrides → Save → close app → Load → overrides restored (ROADMAP exit criterion) | manual UAT | dev mode + drop SIMPLE_TEST.json + override TRIANGLE 50% + Cmd+S + Cmd+Q + relaunch + drop the .stmproj | manual gate |

### Sampling Rate

- **Per task commit:** `npm run test` (full suite — repo is small, runs in <10s; per-task narrowing is not necessary)
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + `npx electron-vite build` green + `npm run typecheck` green + manual UAT signed off, before `/gsd-verify-work 8`.

### Wave 0 Gaps

- [ ] `tests/core/project-file.spec.ts` — covers D-148 round-trip, D-151 newer-version reject, D-155 relative path roundtrip + cross-volume fallback, D-156 validator behaviors. (NEW FILE.)
- [ ] `tests/main/project-io.spec.ts` — covers F9.1 (writes all fields), F9.2 (restores + re-samples), D-149 missing skeleton, D-150 stale drops, D-152 atlas auto-rediscovery, atomic-write trace. (NEW FILE.)
- [ ] `tests/renderer/save-load.spec.tsx` — renderer specs for AppShell Save/Open buttons, dirty marker, SaveQuitDialog 3-button promise, Cmd+S+O keydown, stale-override banner, DropZone extension branching. (NEW FILE; uses `@vitest-environment jsdom` prelude pattern from `tests/renderer/atlas-preview-modal.spec.tsx`.)
- [ ] `tests/arch.spec.ts` — OPTIONAL new grep block for `src/core/project-file.ts` not importing `electron` (per §Open Question 6 recommendation). The existing fs/sharp grep auto-scans the new file; no edit required for the minimum-viable path.
- [ ] Framework install: NONE — every test framework already installed.

## Project Constraints (from CLAUDE.md)

> Verbatim actionable directives from `./CLAUDE.md` that the planner MUST honor. Lift each into a regression-guard test or UAT gate.

| Constraint | Source | Phase 8 Honors By |
|------------|--------|-------------------|
| **Sampler lifecycle MUST stay locked**: `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` | CLAUDE.md Fact #3 | Phase 8 calls `sampleSkeleton(load, { samplingHz })` UNCHANGED — does not touch `src/core/sampler.ts`. arch.spec already locks the lifecycle order in `tests/core/sampler.spec.ts`. |
| **`core/` is pure TypeScript, no DOM** | CLAUDE.md Fact #5 | `src/core/project-file.ts` imports only `node:path` (allowed — no I/O). NO `electron`, `node:fs`, `react`, DOM types. arch.spec auto-scans (line 117). |
| **Default sampler rate: 120 Hz. Configurable in Settings.** | CLAUDE.md Fact #6 | D-146 reserves `samplingHz: number | null` field; null → 120 default. Phase 8 always writes 120; Phase 9 Settings UI mutates. |
| **The math phase does not decode PNGs. Stub `TextureLoader`.** | CLAUDE.md Fact #4 | Phase 8's Load path calls existing `loadSkeleton` which already uses the stub texture loader — unchanged. |
| **Spine animations are stored in seconds, not frames** | CLAUDE.md Fact #1 | Phase 8 doesn't touch animation timing. samplingHz remains the only sample-rate knob. |
| **`scripts/cli.ts` stays byte-for-byte (Phase 5 D-102)** | CLAUDE.md project notes + Phase 5 lock | Phase 8 does not touch `scripts/cli.ts`. arch.spec (P5+P6) already grep-locks it. Add a `git diff` check to the Phase 8 close-out gate. |
| **Phases execute strictly in order — do not skip ahead.** | CLAUDE.md GSD workflow | Phase 8 depends on Phase 7 green. Verified by STATE.md (Phase 7 COMPLETE 2026-04-25). |
| **Tests live in `tests/` (mirror src/ tree)** | CLAUDE.md test fixture + project skills | Phase 8 spec files: `tests/core/project-file.spec.ts`, `tests/main/project-io.spec.ts`, `tests/renderer/save-load.spec.tsx`. |

## Sources

### Primary (HIGH confidence — verified inline against source files)

- **`src/main/ipc.ts:39, 92–112, 240, 274–293, 326–460, 462–500`** — Existing IPC handler patterns, hand-rolled validator, dialog usage, registerIpcHandlers structure.
- **`src/main/image-worker.ts:57, 255–294`** — Atomic-write `<path>.tmp` + `fs.rename` reference idiom.
- **`src/main/index.ts:26–124`** — `app.whenReady`, BrowserWindow creation, sandbox webPreferences, `window-all-closed` handler.
- **`src/core/loader.ts:1–242`** — F1.2 atlas/images sibling auto-discovery; reused for D-152 atlas auto-rediscovery on Load.
- **`src/core/sampler.ts:1–160`** — `sampleSkeleton(load, { samplingHz })` API; `DEFAULT_SAMPLING_HZ = 120`.
- **`src/shared/types.ts:1–571`** — Existing `SerializableError`, `Api`, `LoadResponse`, `SkeletonSummary`, `ExportPlan` types and the structuredClone-safety lock.
- **`src/preload/index.ts:1–160`** — `contextBridge` extension pattern; one-way `send` and subscription `on` patterns.
- **`src/renderer/src/components/AppShell.tsx:1–507`** — Toolbar layout (Optimize Assets + Atlas Preview), state ownership, modal mount points, callback pattern.
- **`src/renderer/src/components/DropZone.tsx:69–101`** — Drop handler that already extension-checks `.json`; extension point for `.stmproj` branching.
- **`src/renderer/src/modals/OverrideDialog.tsx:1–171`** — Hand-rolled ARIA modal scaffold + `useFocusTrap` integration; SaveQuitDialog clones.
- **`src/renderer/src/hooks/useFocusTrap.ts:1–191`** — Shared focus-trap hook used by 4 modals; Phase 8 SaveQuitDialog uses identical signature.
- **`src/renderer/src/index.css:1–78`** — Tailwind v4 `@theme inline` token block; verifies `--color-panel`, `--color-border`, `--color-fg`, `--color-fg-muted`, `--color-accent`, `--color-accent-muted`, `--color-danger`, `--color-surface` all present.
- **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx:66–74, 468–469`** — `SortCol` type union + default sort = `('attachmentName', 'asc')`.
- **`tests/arch.spec.ts:1–135`** — Layer-3 grep + portability + sandbox-CJS guards. Confirms `globSync('src/core/**/*.ts')` auto-scans new files.
- **`tests/renderer/atlas-preview-modal.spec.tsx:1–22`** — Renderer test prelude pattern (`@vitest-environment jsdom` + `@testing-library/react`).
- **`vitest.config.ts:1–20`** — Test config: jsx: 'automatic', node env default with jsdom opt-in, scans `tests/**/*.spec.tsx`.
- **`package.json:1–51`** — All deps + scripts; verifies no install needed for Phase 8.

### Secondary (MEDIUM-HIGH confidence — official docs)

- [Electron `app.on('before-quit')`](https://www.electronjs.org/docs/latest/api/app#event-before-quit) — Event signature, `event.preventDefault` semantics, Cmd+Q vs window-all-closed distinction. **Note:** docs do NOT address async handlers; pattern from §Pitfall 1 is community-derived.
- [Electron `dialog.showSaveDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogbrowserwindow-options) — Returned object `{ canceled, filePath }`, `filters` extensions array (no dots, no wildcards), `defaultPath` cross-platform behavior.
- [Electron `dialog.showOpenDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options) — Returned object `{ canceled, filePaths }`, properties array (`openFile`, `createDirectory`, `dontAddToRecent`).
- [Node.js `path.relative` cross-drive Windows behavior](https://nodejs.org/api/path.html) — Confirmed: `path.win32.relative('Z:\\', 'C:\\')` returns `'C:\\Users\\Jane'` (the absolute target).

### Tertiary (MEDIUM confidence — verified via web search but not single-source)

- [Electron issue #33643](https://github.com/electron/electron/issues/33643) — `before-quit` recursive `app.quit()` bug; setTimeout / `Promise.resolve().then` workarounds. (Reported on Electron 18 / Win10; pattern persists in current stable.)
- [Node.js issue #29481](https://github.com/nodejs/node/issues/29481) — Windows `EPERM` on `fs.rename` due to transient locks (Defender, Search indexer).
- [Node.js issue #19077](https://github.com/nodejs/node/issues/19077) — `fs.rename` returns `EXDEV` cross-filesystem; no copy-fallback.
- [`write-file-atomic` issue #227](https://github.com/npm/write-file-atomic/issues/227) — Confirms `fs.rename` Windows transient errors; documents the retry pattern (Phase 8 explicitly does NOT pull in this dep).
- [techoverflow.net `fs.rename` EXDEV](https://techoverflow.net/2023/03/14/how-to-fix-nodejs-error-exdev-cross-device-link-not-permitted-rename/) — Workaround = copyFile + unlink.
- [`matthiassommer.it` Electron close-event two-ways](https://www.matthiassommer.it/programming/frontend/two-ways-to-react-on-the-electron-close-event/) — Renderer-aware close-event pattern; Phase 8's IPC roundtrip is a refinement.

### LOW confidence (claims without authoritative verification)

- A2: `setTimeout(() => app.quit(), 0)` reliably breaks `before-quit` re-entry on **Electron 41** specifically. (Documented for 18+; likely unchanged in 41 but not directly verified.)
- A8 macOS mounted-volume `path.parse(...).root === '/'` underdetection. (Reasoned from docs; not tested with a real external volume.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified against package.json + read inline.
- Architecture: HIGH — every pattern grounded in existing Phase 1–7 source code reads, not inferred.
- Pitfalls: HIGH for #2 (existing image-worker reference), #3 (Map↔JSON well-known), #5 (existing preload reference), #6 (querySelector reasoning), #8 (AppShell remount mechanism verified inline), #9 (try/catch pattern); MEDIUM for #1 (Electron docs silent on async; community pattern), #4 (cross-volume detection — verified Windows behavior, reasoned macOS), #7 (sandbox handshake — exists in Phase 6 already), #10 (verified arch.spec.ts inline).
- Validation Architecture: HIGH — vitest config + jsdom + Testing Library all verified inline.
- Code Examples: HIGH — every `[VERIFIED: source-path]` claim was read inline from a specific source file before this RESEARCH.md was written.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days; stable codebase, frozen Electron 41 + Node 24, no upcoming dep bumps planned for Phase 8).
