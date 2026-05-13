# Phase 34 — Discussion Log

**Gathered:** 2026-05-11
**Session:** `/gsd-discuss-phase 34`
**Output:** `34-CONTEXT.md` (canonical decisions record)

This file is the human-audit trail of the questions asked and answers given during the discussion. It is NOT consumed by downstream agents (researcher, planner, executor) — they read 34-CONTEXT.md only.

---

## Pre-discussion state

A seed CONTEXT.md already existed at `34-CONTEXT.md` with `Status: Not planned` and four explicit open questions:

1. Which loader entry function does drag-drop call? (`src/core/loader.ts` — exact symbol confirmed during planning)
2. Does the macOS open dialog filter need to be `*.{stmproj,json}` or two separate filters?
3. Behavior when user picks a `.json` that has no sibling `.atlas` AND no sibling `images/` folder — show which error?
4. REQ identifiers: new `OPEN-0x` namespace, or extend `LOAD-0x`?

The seed file was treated as a question-list. Session began with the "Update it" branch confirmed by the user.

---

## Codebase scout (pre-questions)

Findings used to ground gray-area identification:

- File → Open picker filter at [src/main/project-io.ts:296](src/main/project-io.ts#L296): `[{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }]` — `.json` not accepted.
- `handleProjectOpenFromPath` hard-rejects non-`.stmproj` at [src/main/project-io.ts:335](src/main/project-io.ts#L335).
- Drag-drop `.json` calls `window.api.loadSkeletonFromFile(file)` → `ipcRenderer.invoke('skeleton:load', jsonPath)` → `handleSkeletonLoad(jsonPath)` ([src/main/ipc.ts:423](src/main/ipc.ts#L423)) → `loadSkeleton(jsonPath)`.
- Drag-drop `.json` returns `LoadResponse`; renderer transitions to `status: 'loaded'` (skeleton-only, no `.stmproj` association) via `handleLoad` at [src/renderer/src/App.tsx:130-136](src/renderer/src/App.tsx#L130-L136).
- Drag-drop `.stmproj` returns `OpenResponse`; renderer transitions to `status: 'projectLoaded'` via `handleProjectLoad` at [src/renderer/src/App.tsx:144-163](src/renderer/src/App.tsx#L144-L163).
- Phase 08.2 `onMenuOpen` handler at [src/renderer/src/App.tsx:317-323](src/renderer/src/App.tsx#L317-L323): fires `handleBeforeDrop('', 'stmproj')` BEFORE picker, then `window.api.openProject()` → main picker → response → `handleProjectLoad`.
- Loader.ts D-05/D-07/D-08 sibling-cascade auto-detects atlas-source vs atlas-less ([src/core/loader.ts:359-470](src/core/loader.ts#L359-L470)) when called with no `opts`.
- PLATFORM-01 advisory at [src/renderer/src/App.tsx:617](src/renderer/src/App.tsx#L617): "Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges." — Currently misleading for `.json` workflows.

---

## Gray areas presented

Question: "Which areas do you want to discuss for Phase 34?"

Options presented:
- Dialog filter shape (Recommended)
- Renderer dispatch by extension
- Atlas-less detection trigger
- REQ namespacing + scope edges

**User selected:** Dialog filter shape, Renderer dispatch by extension, Atlas-less detection trigger.

Skipped (Claude's discretion applies): REQ namespacing + scope edges — handled in 34-CONTEXT.md `<decisions>` Claude's Discretion subsection (recommend OPEN-0x namespace; menu label unchanged; advisory text unchanged; Open Recent stays `.stmproj`-only).

---

## Area 1 — Picker filter shape

**Q:** How should the File → Open picker filter be shaped?

**Options:**
- One unified filter (Recommended) — `{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }`.
- Two filters, `.stmproj` default — separate filters with dropdown; default narrows to `.stmproj`.
- Two filters + 'All Spine files' default — three-filter cascade.

**User selected:** One unified filter.

**Claude's discretion follow-on:** Dialog title widens to "Open Spine Project or Skeleton" (was: "Open Spine Texture Manager Project") to match the new filter name. Locked in 34-CONTEXT.md D-01.

---

## Area 2 — Renderer dispatch by extension

**Q1:** Where should the `.stmproj` vs `.json` branch live?

**Options:**
- In main (Recommended) — `handleProjectOpen` (or replacement) branches by suffix, returns discriminated envelope `{ kind:'project', resp } | { kind:'skeleton', resp } | { kind:'cancelled' }`.
- In the renderer — main returns just `{ ok:true, path }`; renderer suffix-checks and calls existing path-based handlers.
- Hybrid — main returns path, renderer dispatches by suffix calling existing channels.

**User selected:** In main.

**Q2:** Envelope shape for cancel + unexpected-suffix cases?

**Options:**
- Distinct 'cancelled' kind (Recommended) — three-arm union; explicit `cancelled`; unexpected-suffix routes through `handleProjectOpenFromPath`'s existing validator.
- Reuse today's pattern — `{ ok:false, error:{ kind:'Unknown', message:'Open cancelled' } }` with renderer-side special-string suppression.

**User selected:** Distinct 'cancelled' kind. Locked in 34-CONTEXT.md D-03.

---

## Area 3 — Loader mode detection

**Q1:** Atlas-source vs atlas-less detection trigger for menu File → Open `.json` selection?

**Options:**
- Reuse drag-drop cascade verbatim (Recommended) — no opts threading; loader's D-05/D-07/D-08 sibling-cascade runs unchanged.
- Reuse cascade + main-side pre-flight probe — same cascade, but pre-check both sibling artifacts; tailored error if both missing.
- Explicit user choice via dialog override — second dialog ('atlas-source mode' / 'atlas-less mode') AFTER picking `.json`.

**User selected:** Reuse drag-drop cascade verbatim. Locked in 34-CONTEXT.md D-04.

**Q2:** When should the dirty-guard (SaveQuitDialog) fire for menu File → Open with a possibly-`.json` selection?

**Options:**
- After picker, with actual kind (Recommended) — guard fires AFTER picker resolves, with `kind: 'json' | 'stmproj'` derived from the picked file. Cancel-during-picker skips the guard entirely.
- Before picker, generic kind (status quo Phase 08.2 D-183) — guard fires before picker with `'stmproj'`-flavored body copy; cancel-after-guard friction preserved.
- Before picker, but `kind='json|stmproj'` union — new SaveQuitDialog reason/body-copy arm for the menu's open path.

**User selected:** After picker, with actual kind. Locked in 34-CONTEXT.md D-05 (this amends Phase 08.2 D-183's timing for the menu path).

---

## Architecture reconciliation (final question)

**Q:** Reconciling D-02 (main branches) + D-05 (guard before load) — the resulting flow is two IPC steps. Locking the architecture:

**Options:**
- Two IPC steps, kind decided in main (Recommended) — new `window.api.openProjectPicker()` returns `{ kind, path? }`; renderer fires guard; on proceed calls `window.api.openProjectFromPath(path)` OR new `window.api.loadSkeletonFromPath(path)`. Existing `openProject()` and `handleProjectOpen` deleted.
- Two IPC steps, but keep `window.api.openProject()` as a thin wrapper — preserves call-site shape at the cost of hiding the two-step nature.

**User selected:** Two IPC steps, kind decided in main. Locked in 34-CONTEXT.md D-06.

---

## Summary of locked decisions

- **D-01** — Single unified picker filter `{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }`; dialog title widens to match.
- **D-02** — Suffix-to-kind branch lives in main, not renderer.
- **D-03** — Three-arm discriminated envelope `{ kind: 'project' | 'skeleton', path: string } | { kind: 'cancelled' }`; renderer no-ops on `cancelled`.
- **D-04** — Reuse drag-drop loader cascade verbatim for menu `.json` opens (loader.ts D-05/D-07/D-08 sibling auto-detect; strict loaderMode separation preserved).
- **D-05** — Dirty-guard fires AFTER picker resolves, BEFORE load, with the actual `kind`. Amends Phase 08.2 D-183 timing for the menu Open path.
- **D-06** — Two-IPC-step architecture: `openProjectPicker()` (picker-only) → renderer fires guard → renderer calls `openProjectFromPath` OR new `loadSkeletonFromPath`. Existing `window.api.openProject()` + main `handleProjectOpen` deleted.

## Claude's discretion (not asked, applied as defaults)

- **REQ namespace:** `OPEN-01..05` for Phase 34 (seed file question 4).
- **Menu item label:** "Open…" stays.
- **PLATFORM-01 advisory text:** stays as-is; becomes truthful for `.json` by virtue of this phase.
- **Open Recent:** stays `.stmproj`-only (Phase 08.2 D-180 lifecycle preserved).
- **DropZone error copy:** stays as-is (already names both formats).
- **`handleProjectOpen` deletion:** clean removal (no dead-code shim).

## Deferred ideas captured

Listed in 34-CONTEXT.md `<deferred>` section. Notably: Open Recent extended to `.json`; tailored "no .atlas and no images/" error envelope; menu item label rewording; OS file-association registration.

---

*Discussion captured: 2026-05-11.*
