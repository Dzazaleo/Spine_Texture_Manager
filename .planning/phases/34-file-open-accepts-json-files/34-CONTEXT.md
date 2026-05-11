# Phase 34: File → Open menu accepts Spine skeleton JSON files — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 34` interactive session
**Diff base:** HEAD of `main` (post-Phase 33 close-out, commit `2c3bb4d`)

---

<domain>
## Phase Boundary

Phase 34 closes the asymmetry between the **drag-drop** surface and the **File → Open menu** (incl. its `Cmd+O` / `Ctrl+O` accelerator). Drag-drop has always accepted both `.stmproj` project archives AND raw Spine skeleton `.json` files. The menu currently accepts only `.stmproj` — the dialog filter at [src/main/project-io.ts:296](src/main/project-io.ts#L296) restricts to `extensions: ['stmproj']`, and `handleProjectOpenFromPath` hard-rejects any non-`.stmproj` path at [src/main/project-io.ts:335](src/main/project-io.ts#L335).

Post-Phase 34: the File → Open dialog accepts both `.stmproj` and `.json` via a single unified filter; on `.json` selection, the same loader entry that handles drag-drop (`handleSkeletonLoad` → `loadSkeleton(jsonPath)`) runs, preserving strict loaderMode separation — atlas-source vs atlas-less is detected from sibling artifacts in the JSON's folder per [src/core/loader.ts](src/core/loader.ts) D-05/D-07/D-08, identical to drag-drop. The Phase 08.1 dirty-guard remains in force; the Phase 08.2 menu wiring is extended, not paralleled.

This makes the Phase 31 PLATFORM-01 advisory ("Drag-and-drop is unavailable while running as administrator. Use File → Open instead…" at [src/renderer/src/App.tsx:617](src/renderer/src/App.tsx#L617)) truthful for `.json` files too — a Windows-admin user who works in atlas-less mode (the Esoteric-recommended primary workflow per memory `project_atlas_less_primary_workflow.md`) can now reach the loader via the menu instead of being routed back to relaunch unprivileged.

**LOCKED upstream invariants (carry, do NOT relitigate):**
- **Phase 08.1 D-161/D-162/D-163** — `projectLoadFailed` recovery banner + `beforeDropRef` ref-bridge for dirty-guard. The menu Open dirty-guard reuses this exactly (D-05 below). The recovery banner state is unaffected.
- **Phase 08.2 D-173/D-175/D-181/D-183** — native Electron application Menu via `Menu.buildFromTemplate`. Menu click fires `'menu:open-clicked'` IPC → App.tsx `onMenuOpen` handler. The existing wiring at [src/renderer/src/App.tsx:317-323](src/renderer/src/App.tsx#L317-L323) is the only callsite that needs surgery.
- **Phase 21 strict loaderMode separation** (memory `project_strict_loadermode_separation.md`, 2026-05-06) — atlas-source vs atlas-less is detected once, in `loader.ts`, from sibling artifacts. No new code path re-derives loaderMode from a different signal.
- **Phase 31 PLATFORM-01** — Windows-admin DnD fallback advisory at App.tsx:617. Phase 34 makes the advisory text *truthful* for skeleton JSON without rewording it (the existing copy already says "use File → Open instead" generically).
- **Layer 3 invariant** — `src/core/*` gets zero new code. The phase touches main + preload + renderer only.
- **Sampler / CLI byte-identical** — Phase 5 D-102; CLAUDE.md fact #3.
- **`.stmproj` v1 schema** — no schema changes. Loading a `.json` produces the existing `LoadResponse` shape and lands the renderer in `status: 'loaded'` (skeleton-only session, no `project` payload, no overrides) — identical to drag-drop `.json` today.

**In scope:**

- **`src/main/project-io.ts`** — major touch.
  - `handleProjectOpen` is **DELETED** (or repurposed) — replaced by the new picker-only `handleOpenDialog`. Today's combined picker-and-load shape becomes obsolete under D-06's two-IPC-step architecture.
  - New `handleOpenDialog(): Promise<OpenDialogResponse>` — opens the OS file dialog with the unified filter (D-01), branches on the picked path's suffix, returns a three-arm discriminated envelope `{ kind: 'project', path: string } | { kind: 'skeleton', path: string } | { kind: 'cancelled' }` (D-02 + D-03). No loading happens inside this function; it is picker-only.
  - `handleProjectOpenFromPath` — **unchanged**. Reused as-is for the `.stmproj` arm.
  - The existing `handleLocateSkeleton` (D-149 picker) and `handleProjectReloadWithSkeleton` are untouched.

- **`src/main/ipc.ts`** — touched.
  - New `ipcMain.handle('project:open-dialog', async (_evt) => handleOpenDialog())` registration.
  - Existing `'project:open'` channel is **DELETED** along with `handleProjectOpen` (renderer-side `window.api.openProject()` callers migrate to `openProjectPicker`).
  - Existing `'skeleton:load'` channel is **unchanged**; the new preload method `loadSkeletonFromPath` is a thin wrapper over it.

- **`src/preload/index.ts`** — touched.
  - New `openProjectPicker: () => Promise<OpenDialogResponse>` — calls `ipcRenderer.invoke('project:open-dialog')`. Replaces today's `openProject` (which is removed).
  - New `loadSkeletonFromPath: (absolutePath: string) => Promise<LoadResponse>` — symmetric companion to the existing `openProjectFromPath` (D-09 mechanism). Thin wrapper over `ipcRenderer.invoke('skeleton:load', absolutePath)` (the IPC channel already accepts a path; the preload surface just gains a path-based entry alongside the existing File-based `loadSkeletonFromFile`).
  - Existing `openProjectFromFile` (drag-drop `.stmproj`), `loadSkeletonFromFile` (drag-drop `.json`), `openProjectFromPath` (Phase 8 OS-association scaffold) — **all unchanged**.
  - Existing `openProject` — **deleted** (only callsite is App.tsx `onMenuOpen`).

- **`src/renderer/src/App.tsx`** — major touch.
  - `onMenuOpen` handler at [App.tsx:318-323](src/renderer/src/App.tsx#L318-L323) is **rewired** per D-05 + D-06:
    1. Call `window.api.openProjectPicker()`. Receive `{ kind, path? }`.
    2. If `kind === 'cancelled'`: return immediately (no toast, no state change, no dirty-guard).
    3. Compute `fileName = path.split(/[\\\\/]/).pop() ?? path` and `dropKind: 'json' | 'stmproj' = kind === 'project' ? 'stmproj' : 'json'`.
    4. Fire `await handleBeforeDrop(fileName, dropKind)`. On `false` (user picked Cancel in SaveQuitDialog): return.
    5. Dispatch by `kind`:
       - `kind === 'project'`: `const resp = await window.api.openProjectFromPath(path); handleProjectLoad(resp, fileName);`
       - `kind === 'skeleton'`: `const resp = await window.api.loadSkeletonFromPath(path); handleLoad(resp, fileName);`
  - `onMenuOpenRecent` at [App.tsx:325-330](src/renderer/src/App.tsx#L325-L330) is **unchanged** — Open Recent stays `.stmproj`-only per D-07 below.
  - No new `useState` slots, no new `useRef`, no new `useEffect`. The same `handleBeforeDrop` ref-bridge + `handleProjectLoad` + `handleLoad` are reused verbatim.

- **`src/renderer/src/components/DropZone.tsx`** — **unchanged**. Drag-drop already handles both extensions correctly (DropZone.tsx:140-194). The "Not a .json or .stmproj file: <name>" rejection envelope at [DropZone.tsx:184-194](src/renderer/src/components/DropZone.tsx#L184-L194) stays.

- **`src/renderer/src/components/AppShell.tsx`** — **unchanged**. The notify-menu-state push (Phase 08.2 D-181) is already correct; the menu surface itself doesn't need new menu items.

- **`src/main/index.ts`** — **unchanged**. The menu item at `buildAppMenu`'s File → Open entry continues to fire `'menu:open-clicked'`; the renderer-side handler is the only thing that grows.

- **Tests:**
  - `tests/main/project-io.spec.ts` — **extension**. New describe block: `handleOpenDialog`. Cases:
    - `34-OPEN-01`: cancel → returns `{ kind: 'cancelled' }`.
    - `34-OPEN-02`: picked `.stmproj` → returns `{ kind: 'project', path }`.
    - `34-OPEN-03`: picked `.json` → returns `{ kind: 'skeleton', path }`.
    - `34-OPEN-04`: picked path with neither suffix (defense-in-depth — filter normally prevents this) → returns `{ kind: 'project', path }` with an unknown-error envelope downstream, OR returns a typed `{ kind: 'cancelled' }` with a logged warning (planner picks; recommend the former — let `handleProjectOpenFromPath`'s existing validator surface the error message).
    - `34-OPEN-05`: dialog `filters` argument equals `[{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }]` (assert via `dialog.showOpenDialog` mock).
  - `tests/renderer/save-load.spec.tsx` (or a new `tests/renderer/menu-open.spec.tsx`) — **extension**. Cases:
    - `34-MENU-01`: `onMenuOpen` fires picker → `{ kind: 'cancelled' }` → no `handleBeforeDrop`, no load, no state change.
    - `34-MENU-02`: `onMenuOpen` picker resolves `{ kind: 'project', path }` → `handleBeforeDrop(basename, 'stmproj')` called → on `true`, `window.api.openProjectFromPath` called → `handleProjectLoad` invoked → state lands in `projectLoaded`.
    - `34-MENU-03`: `onMenuOpen` picker resolves `{ kind: 'skeleton', path }` → `handleBeforeDrop(basename, 'json')` called → on `true`, `window.api.loadSkeletonFromPath` called → `handleLoad` invoked → state lands in `loaded`.
    - `34-MENU-04`: `onMenuOpen` picker resolves `{ kind: 'skeleton', path }` → `handleBeforeDrop` returns `false` (user cancelled SaveQuitDialog) → no load call, no state change.
    - `34-MENU-05`: `onMenuOpen` cancel branch never fires `handleBeforeDrop` even when the session is dirty (D-05 explicit improvement over status-quo Phase 08.2 D-183 which fires the guard pre-picker).
  - `tests/integration/menu-open-json.spec.ts` (or extend an existing main+renderer integration spec) — **optional, planner's call**. End-to-end: a `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` loaded via the menu produces the same `summary` shape as a drag-drop of the same file. Asserts strict loaderMode-cascade parity.

**Out of scope (deferred or carried elsewhere):**

- **Menu item label change** ("Open…" → "Open Project or Skeleton…") — label stays "Open…". Generic enough; the OS picker's filter name carries the disambiguation.
- **Open Recent extended to `.json`** — Open Recent stays `.stmproj`-only per Phase 08.2 D-180 lifecycle. Rationale: Recent tracks *projects* (the `.stmproj` is the project concept; a loose `.json` open is a transient skeleton session with no overrides, no save path, no documentation slot). Adding `.json` paths would mix two semantically distinct entry types in one list. Captured as deferred idea if testers complain.
- **PLATFORM-01 advisory text rewrite** — no copy change. The existing two-sentence advisory ("Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges.") becomes truthful for skeleton JSON by virtue of this phase. If testers want explicit `.json` mention, a future polish phase can reword.
- **Tailored "no .atlas and no images/ folder" error envelope** — Phase 34 inherits whatever `loadSkeleton`/synthesizer surfaces today (D-04). If the existing error is judged unclear in human-UAT, a follow-up phase tunes the error UX; not in 34's scope.
- **Atlas auto-discovery toggle pre-load (atlas-source/atlas-less choice in a dialog)** — explicitly rejected (D-04 Option C). Diverges from drag-drop; breaks the "close the asymmetry" phase goal.
- **`.skel` binary loader** — still deferred (PROJECT.md constraints).
- **OS file-association registration (.stmproj / .json double-click in Finder/Explorer)** — still deferred (Phase 08.2 deferred list). Phase 34 ships zero changes to `app.on('open-file', …)`.
- **Multi-file open / "Open in new window"** — out of MVP (single-window assumption, Phase 1 D-23).
- **CLI changes** — `scripts/cli.ts` byte-identical.

</domain>

---

<decisions>
## Implementation Decisions

### Picker filter shape (Area 1)

- **D-01: Single unified picker filter `{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }`.** Replaces today's `{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }` at [src/main/project-io.ts:296](src/main/project-io.ts#L296). On macOS the picker shows both file types unfiltered in one view; on Windows the dropdown shows one label like "Spine Project or Skeleton (*.stmproj; *.json)". Matches drag-drop's behavior (drag-drop accepts both with no toggle). Dialog title widens to **"Open Spine Project or Skeleton"** (was: "Open Spine Texture Manager Project"). Rejected: two filters with `.stmproj` default (adds a dropdown the user must operate; menu users on a `.json` workflow get gratuitous friction); three-filter "All Spine files / Project only / Skeleton only" cascade (over-engineered for a two-extension surface).

### Suffix-to-kind dispatch (Area 2)

- **D-02: Suffix-to-kind branching lives in main, not renderer.** `handleOpenDialog` inspects `result.filePaths[0]`'s lowercase suffix and emits a discriminated `kind`. The renderer never sees the raw path-suffix decision — it routes by `kind` only. Centralizes filesystem-trust-boundary logic in main (Layer 3 + trust-boundary discipline, mirrors handleProjectOpenFromPath:332-344's input validation idiom). Rejected: renderer suffix-dispatch (DropZone.tsx:140-194 does this for drag-drop, but drag-drop has no main-side picker to consolidate against — for the menu flow, putting the branch in main avoids two parallel paths to the same decision); hybrid (more surface area for the same outcome).

- **D-03: Three-arm discriminated envelope from `handleOpenDialog`.** Shape:
  ```ts
  type OpenDialogResponse =
    | { kind: 'project'; path: string }     // suffix matched .stmproj (case-insensitive)
    | { kind: 'skeleton'; path: string }    // suffix matched .json (case-insensitive)
    | { kind: 'cancelled' };                // dialog cancelled OR filePaths empty
  ```
  Explicit `cancelled` kind. Renderer treats `cancelled` as a true no-op (no toast, no error UI, no state change, no dirty-guard fire). Defense-in-depth — if the OS picker somehow returns a path with neither suffix (filter normally prevents this; user pasting an arbitrary path into the Windows picker's File Name field can bypass it), `handleOpenDialog` returns `{ kind: 'project', path }` and `handleProjectOpenFromPath`'s existing extension validator surfaces a typed error envelope (the renderer's existing error branch shows the message). Rejected: today's pattern of `{ ok:false, error:{ kind:'Unknown', message:'Open cancelled' } }` (special-string-matching hackiness; the renderer's existing handleProjectLoad error branch would show an error toast for cancellation without explicit suppression).

- **D-06: Two-IPC-step architecture (canonical implementation of D-02 + D-05).** Single `window.api.openProject()` call is **deleted** along with main's `handleProjectOpen`. Replaced by:
  - **Step 1**: `window.api.openProjectPicker()` → `ipcRenderer.invoke('project:open-dialog')` → `handleOpenDialog()` (main). Returns `OpenDialogResponse`. **No loading happens in this step.**
  - **Step 2**: Renderer fires `handleBeforeDrop(fileName, kind)` with the actual kind. On `false`, return.
  - **Step 3**: Renderer dispatches by `kind`:
    - `kind === 'project'` → `window.api.openProjectFromPath(path)` (Phase 8 existing, unchanged).
    - `kind === 'skeleton'` → `window.api.loadSkeletonFromPath(path)` (NEW preload method, thin wrapper over the existing `'skeleton:load'` IPC channel).

  Rationale: cleanest way to satisfy both "main decides kind from suffix" (D-02) and "dirty-guard fires after picker, before load" (D-05). Existing load handlers (`handleProjectOpenFromPath` + `handleSkeletonLoad`) are reused unchanged — the picker is split from the load, not duplicated. The new `loadSkeletonFromPath` mirrors the existing `openProjectFromPath` (Phase 8.1 D-149 scaffold for OS file association), giving the preload surface a clean symmetric pair for path-based loads. Rejected: keep `window.api.openProject()` alive as a thin wrapper that calls picker + dispatches internally (option B in D-06's question — hides the two-step nature, makes `App.tsx onMenuOpen` denser and harder to read, blocks the dirty-guard-after-picker behavior unless the wrapper itself fires the guard, which leaks renderer-state knowledge into preload).

### Loader mode detection (Area 3)

- **D-04: Reuse drag-drop loader cascade verbatim for menu `.json` opens.** Menu `.json` path calls `window.api.loadSkeletonFromPath(path)` → `ipcRenderer.invoke('skeleton:load', path)` → `handleSkeletonLoad(path)` → `loadSkeleton(path)` with NO `opts`. The existing [src/core/loader.ts](src/core/loader.ts) D-05/D-07/D-08 cascade runs unchanged:
  1. `opts.atlasPath !== undefined` → canonical (N/A here — no opts).
  2. `opts.loaderMode === 'atlas-less'` → synthesize (N/A here — no opts).
  3. Sibling `.atlas` readable → canonical (D-07 atlas-by-default).
  4. Sibling `.atlas` unreadable → synthesize (D-05 atlas-less fall-through).

  Strict loaderMode separation (memory `project_strict_loadermode_separation.md`, locked 2026-05-06) preserved. Identical behavior to drag-drop today. No new code path, no user-mode toggle pre-load, no main-side pre-flight probe. If a user picks a `.json` with neither sibling `.atlas` nor a usable `images/` folder, whatever error envelope `loadSkeleton` / the synthesizer surfaces today (likely `AtlasNotFoundError` or a synthesizer-IHDR-byte-parse failure) is what surfaces tomorrow — the menu path inherits drag-drop's UX 1:1. If human-UAT flags the error message as unclear, a follow-up phase tunes it; that's not Phase 34's scope. Rejected: main-side pre-flight probe of `.atlas` + `images/` existence with a tailored "neither found" error (adds a new error kind for a fringe edge case; introduces parity drift between menu and drag-drop paths); explicit user-mode choice dialog (breaks the "close asymmetry" phase goal — drag-drop is silent, menu must be silent too).

### Dirty-guard timing (Area 3 / Phase 08.2 D-183 amendment)

- **D-05: Dirty-guard (`handleBeforeDrop`) fires AFTER the picker resolves, BEFORE the load, with the actual `kind: 'json' | 'stmproj'`.** Status-quo Phase 08.2 D-183 fires `handleBeforeDrop('', 'stmproj')` BEFORE the picker (App.tsx:319), then opens the picker. With Phase 34, the kind isn't known until the user picks. The new flow (locked by D-06's two-IPC-step architecture):
  1. Open picker (Step 1 IPC). No guard yet.
  2. Receive `{ kind, path? }`. On `cancelled`: return without firing the guard.
  3. Fire `handleBeforeDrop(basename(path), kind === 'project' ? 'stmproj' : 'json')`.
  4. On `false` (user picked Cancel in SaveQuitDialog): return.
  5. On `true`: dispatch the matching path-based load (Step 3 IPC).

  Improvement over status-quo: a user on a dirty session who cancels the picker never sees the SaveQuitDialog (avoided unnecessary friction). SaveQuitDialog body copy gets the correct `kind` (the existing `bodyCopyFor` in [src/renderer/src/modals/SaveQuitDialog.tsx:54-69](src/renderer/src/modals/SaveQuitDialog.tsx#L54-L69) already supports `'json'` and `'stmproj'` discriminations via `reason='new-project-drop'` — both kinds use the same `'new-project-drop'` reason today). Rejected: keep status-quo (extra friction on every cancel from a dirty session); add a new `'menu-open'` reason union (SaveQuitDialog grows for no behavioral win).

### Claude's Discretion (not locked)

- **REQ identifiers** — recommend new `OPEN-0x` namespace (the seed file suggested this). Tentative IDs:
  - `OPEN-01`: File → Open dialog filter accepts both `.stmproj` and `.json` on macOS + Windows (single unified filter; dialog title widens to "Open Spine Project or Skeleton").
  - `OPEN-02`: Picking `.json` routes through the same loader cascade as drag-drop (strict loaderMode separation preserved; no user-mode toggle).
  - `OPEN-03`: Picking `.stmproj` routes through `handleProjectOpenFromPath` unchanged (end-to-end parity with drag-drop `.stmproj`).
  - `OPEN-04`: Opening a JSON or .stmproj over an unsaved in-progress project triggers the Phase 08.1 dirty-guard confirmation; cancelling the picker never fires the guard.
  - `OPEN-05`: `Cmd+O` / `Ctrl+O` accelerator behaves identically to the menu item (inherited from Phase 08.2 D-173 — verification-only).
  - Planner may collapse / reshape these. Roadmap currently has "REQs TBD during /gsd-discuss-phase 34"; this CONTEXT.md is where the namespace gets seeded for REQUIREMENTS.md update.

- **PLATFORM-01 advisory wording at [src/renderer/src/App.tsx:617](src/renderer/src/App.tsx#L617)** — recommend leaving the text unchanged ("Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges.") The advisory becomes truthful for `.json` by virtue of this phase — no rewrite needed. Planner may add `(now accepts .stmproj or .json)` parenthetical if testers find the existing text ambiguous, but this is polish.

- **Menu item label** — recommend leaving "Open…" as-is. Specific enough; the OS picker's filter name carries the disambiguation. Renaming to "Open Project or Skeleton…" makes menus busier without UX win.

- **DropZone error message** — already says "Not a .json or .stmproj file: <name>" ([src/renderer/src/components/DropZone.tsx:189-190](src/renderer/src/components/DropZone.tsx#L189-L190)). Both formats already named; no change needed.

- **`handleProjectOpen` deletion vs keep-as-deadcode** — recommend deletion since the only callsite is `window.api.openProject()`, which is also being deleted. The existing `'project:open'` IPC channel registration in [src/main/ipc.ts:921](src/main/ipc.ts#L921) is removed in lockstep. Planner may leave a `// removed in Phase 34` comment briefly, but per project conventions (CLAUDE.md "avoid backwards-compatibility hacks"), clean removal is preferred.

- **Tests location** — `tests/main/project-io.spec.ts` for `handleOpenDialog` cases; `tests/renderer/save-load.spec.tsx` (extension) OR new `tests/renderer/menu-open.spec.tsx` for `onMenuOpen` cases. Planner picks based on file-size growth. The existing save-load spec is already busy with Phase 8 + 08.1 + 08.2 surfaces; a new file may be cleaner.

- **Integration test** — recommend one end-to-end spec asserting menu-open(`.json`) produces the same `summary` as drag-drop(`.json`) for `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. Strict loaderMode parity is the load-bearing invariant of this phase; one integration assertion is worth more than five mock-heavy unit tests. Planner's call.

- **macOS `.json` in Spotlight / Quick Look** — out of scope. The dialog filter widening does not affect OS-level file association or Quick Look; only what the user sees inside the in-app picker. Planner verifies no electron-builder config change is needed (none should be).

- **`handleSkeletonLoad` input validation amendment** — currently insists `jsonPath.endsWith('.json')` at [src/main/ipc.ts:425](src/main/ipc.ts#L425). The new `loadSkeletonFromPath` preload method preserves this contract (defense-in-depth at the trust boundary). Planner verifies the input-validation grep in `tests/arch.spec.ts` still passes for the new preload method.

</decisions>

---

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth (project-level)

- `.planning/PROJECT.md` §"Current Milestone: v1.4" + §"Key Decisions" — Layer 3 invariant; strict loaderMode separation lock; atlas-less primary workflow context.
- `.planning/REQUIREMENTS.md` — v1.4 REQs (currently 6 mapped; Phase 34 introduces `OPEN-0x` namespace per Claude's Discretion). Planner updates REQUIREMENTS.md traceability table.
- `.planning/ROADMAP.md` §"Phase 34" (lines 882-907) — Goal + Depends on Phase 08.1 + 08.2 + Reuses drag-drop loader entry. Success Criteria 1-5 explicit.
- `.planning/STATE.md` §"Roadmap Evolution" — 2026-05-11 Phase 34 added note (line 90).
- `CLAUDE.md` — Fact #3 (sampler lifecycle, locked, untouched by 34); Fact #5 (`core/` no DOM); folder conventions.

### Prior phase context (decisions Phase 34 inherits and extends)

- `.planning/milestones/v1.0-phases/08-save-load-project-state/08-CONTEXT.md` — D-140 (Cmd+S/O renderer keydown — superseded by 08.2 D-176, irrelevant to 34); D-142 (drag-drop extension dispatch — the prior art for the now-unified menu dispatch); D-143 dirty-guard contract.
- `.planning/milestones/v1.0-phases/08.1-close-phase-8-verification-gaps-locate-skeleton-recovery-rea/08.1-CONTEXT.md` — D-161/D-162/D-163 recovery banner + `beforeDropRef` ref-bridge (reused verbatim by Phase 34 D-05).
- `.planning/milestones/v1.0-phases/08.2-cmd-o-blocked-during-error-state-discovered-in-08-1-uat-add-/08.2-CONTEXT.md` — D-173 native Electron menu surface; D-175 menu → IPC → renderer dispatch idiom; D-181 `notifyMenuState` push; D-183 menu Open dirty-guard reuses `handleBeforeDrop` (Phase 34 D-05 AMENDS the timing per D-06 step ordering); D-184 modalOpen suppression rule.
- `.planning/milestones/v1.2-phases/21-seed-001-atlas-less-mode-json-images-no-atlas/` (if archived; otherwise look up in MILESTONES) — D-05 / D-07 / D-08 strict loaderMode separation; synthetic atlas synthesis. **The loader cascade Phase 34 D-04 reuses.**
- Memory `project_strict_loadermode_separation.md` (2026-05-06) — single-source-of-truth for the loaderMode contract.
- Memory `project_atlas_less_primary_workflow.md` — Esoteric's "loose images" recommendation; relevant context for why this phase matters (atlas-less is the *intended* primary workflow, and is reached via `.json` only).

### Source code touchpoints

- `src/main/project-io.ts:286-306` — `handleProjectOpen`. **REMOVED** in Phase 34; replaced by `handleOpenDialog`.
- `src/main/project-io.ts:293-297` — current picker `OpenDialogOptions`. Replaced per D-01: title widens, filter unifies.
- `src/main/project-io.ts:329-344` — `handleProjectOpenFromPath` input validator. **Unchanged**; reused for `kind === 'project'`.
- `src/main/ipc.ts:423-472` — `handleSkeletonLoad`. **Unchanged**; reused by the new `loadSkeletonFromPath` preload wrapper.
- `src/main/ipc.ts:678` — `'skeleton:load'` channel registration. **Unchanged**.
- `src/main/ipc.ts:921` — `'project:open'` channel registration. **REMOVED** in Phase 34 (replaced by `'project:open-dialog'`).
- `src/main/ipc.ts:923` — `'project:open-from-path'` channel registration. **Unchanged**.
- `src/preload/index.ts:55-72` — `loadSkeletonFromFile` (drag-drop `.json`). **Unchanged**.
- `src/preload/index.ts:168` — `openProject`. **REMOVED** in Phase 34.
- `src/preload/index.ts:179-191` — `openProjectFromFile` (drag-drop `.stmproj`). **Unchanged**.
- `src/preload/index.ts:194-195` — `openProjectFromPath`. **Unchanged**.
- `src/preload/index.ts:284-289` — `onMenuOpen` subscription. **Unchanged** at the preload surface; renderer-side handler reshapes.
- `src/renderer/src/App.tsx:130-136` — `handleLoad` (skeleton-only landing). **Unchanged**; reused for menu `.json` Open.
- `src/renderer/src/App.tsx:144-163` — `handleProjectLoad` (project landing). **Unchanged**; reused for menu `.stmproj` Open.
- `src/renderer/src/App.tsx:237-242` — `handleBeforeDrop`. **Unchanged**; reused for menu `.json` Open dirty-guard.
- `src/renderer/src/App.tsx:317-323` — `onMenuOpen` handler. **REWIRED** per D-05 + D-06.
- `src/renderer/src/App.tsx:325-330` — `onMenuOpenRecent`. **Unchanged** (Open Recent stays `.stmproj`-only per Claude's Discretion).
- `src/renderer/src/App.tsx:617` — PLATFORM-01 advisory text. **Unchanged copy**, becomes truthful for `.json`.
- `src/renderer/src/components/DropZone.tsx:140-194` — drag-drop extension dispatch. **Unchanged**; the prior art Phase 34 mirrors on the menu side.
- `src/renderer/src/modals/SaveQuitDialog.tsx:54-69` — `bodyCopyFor` `'json'` / `'stmproj'` discriminations. **Unchanged**; reused for menu Open dirty-guard.
- `src/core/loader.ts:359-470` — D-05/D-07/D-08 sibling-cascade. **Unchanged**; the load-bearing invariant Phase 34 reuses verbatim.
- `tests/arch.spec.ts` — Layer 3 grep block. New `handleOpenDialog` is main-side, auto-scanned. New `loadSkeletonFromPath` preload method is preload-side, auto-scanned.
- `tests/main/project-io.spec.ts` — extended per the test plan above.
- `tests/renderer/save-load.spec.tsx` (or new `tests/renderer/menu-open.spec.tsx`) — extended per the test plan above.

### Locked invariants

- `scripts/cli.ts` — Phase 5 D-102 + CLAUDE.md fact #3 — diff vs Phase 33 baseline must remain empty.
- `src/core/sampler.ts` — same lock.
- `src/core/loader.ts` — same lock for Phase 34 (cascade is reused, not modified).
- `src/core/project-file.ts` — `.stmproj` v1 schema unchanged (Phase 8 D-145).
- `src/main/recent.ts` — recent.json schema + lifecycle unchanged (Phase 08.2 D-180 — `.stmproj`-only).
- All other `src/core/*` files — Layer 3 untouched.

### Patterns to mirror

- **Discriminated envelope** (Phase 8 D-158 SerializableError pattern, Phase 6 D-10 typed-error envelope, Phase 8.1 D-171 LoadResponse): `OpenDialogResponse` is a new three-arm union following the existing project-wide kind:'X' shape convention.
- **Path-based preload wrapper** (Phase 8 `openProjectFromPath` mirrors `openProjectFromFile`): new `loadSkeletonFromPath` mirrors existing `loadSkeletonFromFile` symmetrically.
- **Picker-then-act split** (Phase 8.1 D-149 `handleLocateSkeleton` is picker-only; renderer then dispatches `handleProjectReloadWithSkeleton`): same architectural pattern Phase 34 D-06 adopts for the menu Open flow.
- **Trust-boundary input validation** (`handleProjectOpenFromPath:332-344`): `handleOpenDialog` rejects unexpected shapes at the boundary; defense-in-depth.
- **One-way IPC for menu events** (Phase 08.2 D-175): unchanged for `'menu:open-clicked'`. The new `'project:open-dialog'` is a request-response invoke (consistent with `'project:open-from-path'`'s shape).

### Electron API references

- [Electron `dialog.showOpenDialog`](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogbrowserwindow-options) — picker invocation. The `filters` array's behavior with multi-extension entries is documented; macOS shows all matching files unfiltered; Windows shows a dropdown label.
- [Electron `OpenDialogOptions.filters`](https://www.electronjs.org/docs/latest/api/structures/file-filter) — `FileFilter` shape.

### Project conventions

- `CLAUDE.md` — Fact #5 (`core/` is pure TypeScript); folder conventions; "avoid backwards-compatibility hacks" guidance for `handleProjectOpen` removal.
- `.planning/REQUIREMENTS.md` — `OPEN-0x` namespace introduction (planner threads into REQUIREMENTS.md traceability).
- `.planning/STATE.md` — current phase status pointer.

</canonical_refs>

---

<code_context>
## Existing Code Insights

### Reusable assets

- **`handleProjectOpenFromPath` (src/main/project-io.ts:329)** — the `.stmproj` load workhorse. Reused verbatim by the menu `.stmproj` arm. Already validates input + chains read → parse → validate → migrate → materialize → loadSkeleton → sampleSkeleton → buildSummary. Returns `OpenResponse` envelope.
- **`handleSkeletonLoad` (src/main/ipc.ts:423)** — the `.json` load workhorse. Reused verbatim by the menu `.json` arm. Already validates input + chains loadSkeleton → sampleSkeleton → buildSummary. Returns `LoadResponse` envelope.
- **`loadSkeleton` (src/core/loader.ts)** — the cascade owner (D-05/D-07/D-08 atlas-source vs atlas-less). Reused verbatim; no `opts` threading needed (default-cascade behavior).
- **`window.api.openProjectFromPath` (src/preload/index.ts:194)** — path-based `.stmproj` load entry (Phase 8 D-149 scaffold for OS file association). Reused verbatim by menu `.stmproj` arm. The new `loadSkeletonFromPath` mirrors this symmetrically.
- **`handleBeforeDrop` ref-bridge (src/renderer/src/App.tsx:237-242)** — Phase 8.1 D-163. Reused for menu Open dirty-guard. Already supports `'json' | 'stmproj'` kind discrimination.
- **`handleProjectLoad` + `handleLoad` (src/renderer/src/App.tsx:130-163)** — the two AppState transition handlers. Reused unchanged; menu Open just calls the appropriate one per `kind`.
- **`SaveQuitDialog` body copy `bodyCopyFor` (src/renderer/src/modals/SaveQuitDialog.tsx:54-69)** — already supports both `'json'` and `'stmproj'` kinds via `reason='new-project-drop'`. Reused for menu Open guard.
- **`DropZone` extension dispatch (src/renderer/src/components/DropZone.tsx:140-194)** — the prior-art renderer-side suffix-branch. Phase 34 mirrors it on the menu side, but with the branch lifted into main per D-02.
- **Atomic `.tmp` + `fs.rename` pattern** (Phase 6 + Phase 8) — N/A for Phase 34; no file writes in the new picker code path.

### Established patterns

- **Layer 3 boundary** — `src/core/*` no DOM/Electron/fs; `src/main/*` allowed Electron + fs; `src/renderer/*` no `src/core/*` direct imports. Phase 34 touches main + preload + renderer; **no `src/core/*` changes**. Verified by `tests/arch.spec.ts` automatically.
- **Hand-rolled discipline** (Phase 2 D-28, Phase 4 D-81, Phase 8 D-156) — no schema libraries. `OpenDialogResponse` is a hand-rolled discriminated union; no `zod`.
- **Trust-boundary input validation** (Phase 6 D-10 + Phase 8 D-156 + Phase 8.1 T-08.2-03-01) — `handleOpenDialog` validates `result.filePaths[0]` is a string before suffix-branching. The downstream load handlers re-validate at THEIR boundaries (`handleProjectOpenFromPath:332-344`, `handleSkeletonLoad:425-433`). Defense-in-depth.
- **Discriminated envelopes** (Phase 6 D-10, Phase 8 D-158, Phase 8.1 D-171) — `OpenDialogResponse` is a 3-arm union following the same `kind: 'X'` convention.
- **Path-based preload symmetry** (Phase 8 D-149 + Phase 21 atlas-less integration) — `openProjectFromPath` (existing) ↔ `loadSkeletonFromPath` (new). Same shape: take an absolute path, invoke the underlying IPC channel.
- **Picker-then-act split** (Phase 8.1 D-149 `handleLocateSkeleton` + Phase 8.1 D-162 `handleProjectReloadWithSkeleton`) — the same architectural shape Phase 34 D-06 adopts for menu Open (picker IPC → renderer dispatches → load IPC).

### Integration points

- **`src/main/project-io.ts`** — `handleOpenDialog` lives next to the existing `handleProjectOpen` (which it replaces). Same file, same imports (`dialog`, `BrowserWindow`, `path`).
- **`src/main/ipc.ts`** — one new `ipcMain.handle('project:open-dialog', …)` registration. One removed `ipcMain.handle('project:open', …)`. Existing `'skeleton:load'` and `'project:open-from-path'` untouched.
- **`src/preload/index.ts`** — one new `openProjectPicker` method (replaces removed `openProject`). One new `loadSkeletonFromPath` method (symmetric companion to `openProjectFromPath`).
- **`src/renderer/src/App.tsx`** — `onMenuOpen` handler at line 318-323 is rewired (5-step flow per D-06). No other renderer files touched.
- **Tests** — main-side extension to `project-io.spec.ts`; renderer-side extension to `save-load.spec.tsx` (or a new `menu-open.spec.tsx`); optional one E2E integration spec for loaderMode-cascade parity.

</code_context>

---

<specifics>
## Specific Ideas

- **Canonical menu `.json` reproducer:** With the app open and no project loaded, click File → Open. Picker shows `.stmproj` AND `.json`. Pick `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. App lands in `status: 'loaded'` (skeleton-only, no `.stmproj` association). Atlas-source mode auto-selected (sibling `SIMPLE_TEST.atlas` readable). Identical to drag-dropping the same file.
- **Atlas-less menu reproducer:** Same flow with a `.json` whose folder has no `.atlas` but does have a sibling `images/` folder (e.g., `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/`). App lands in `status: 'loaded'`, atlas-less mode auto-selected via synthesizer (D-05 fall-through). Identical to drag-drop.
- **Cancel-during-dirty reproducer (D-05 improvement):** Load a project, set an override (session is dirty). Click File → Open. Picker opens (no SaveQuitDialog yet). Press Escape / Cancel in the picker. App returns to the loaded state unchanged — no SaveQuitDialog ever appeared. Pre-Phase-34: SaveQuitDialog opens first; cancelling the picker AFTER cancelling the SaveQuitDialog is a two-cancel flow. Post-Phase-34: single cancel.
- **Pick-`.json`-while-dirty reproducer:** Load a project (dirty session). Click File → Open. Pick a `.json` file. SaveQuitDialog fires with `kind='json'` (body copy: "Loading a skeleton will discard your unsaved overrides" — exact text per existing `bodyCopyFor`). Save / Don't Save / Cancel branches all work as today.
- **Windows-admin reproducer (PLATFORM-01 truthfulness check):** Launch the app elevated on Windows. DropZone shows the admin advisory. Click File → Open. Pick a `.json`. App loads it. Post-Phase-34: the advisory's "Use File → Open instead" copy is truthful for `.json` workflows (today, it was misleading for atlas-less users).
- **Cmd+O accelerator parity:** With the app focused and no project loaded, press Cmd+O (macOS) / Ctrl+O (Win). Picker opens (Phase 08.2 D-173 menu accelerator). Same flow as clicking the menu item. No new renderer keydown listener; Phase 08.2's deletion of the AppShell keydown handler stays.

</specifics>

---

<deferred>
## Deferred Ideas

| Item | Source | Defer to |
|------|--------|----------|
| Open Recent extended to `.json` files | New | Future polish phase. Rationale: Recent tracks *projects* (`.stmproj` is the project concept with overrides + docs slot + save path); a loose `.json` is a transient session. Mixing both types in one list would confuse the semantic of "Recent". Revisit if testers report wanting recent skeleton-only sessions. |
| Tailored "no .atlas and no images/ folder" error envelope | Phase 34 D-04 follow-up | Future polish phase. Inherits whatever `loadSkeleton`/synthesizer surfaces today. If human-UAT flags the message as unclear, tune in a dedicated error-UX phase. |
| Menu item label "Open…" → "Open Project or Skeleton…" | New | Future polish if testers flag the label as ambiguous. Default: leave as "Open…" — OS picker filter name carries the disambiguation. |
| PLATFORM-01 advisory parenthetical "(now accepts .stmproj or .json)" | Phase 31 PLATFORM-01 follow-up | Future polish if testers find the advisory ambiguous. Default: leave existing copy unchanged — advisory becomes truthful by virtue of this phase. |
| `.skel` binary loader support | PROJECT.md constraints / v1.0 carry-forward | SEED-007 or later milestone after `.skel` parser landing. |
| OS file-association registration (.stmproj / .json double-click in Finder/Explorer) | Phase 08.2 deferred | Future polish phase via `electron-builder` config + existing `app.on('open-file')` scaffold at [src/main/index.ts:107-111](src/main/index.ts#L107-L111). |
| Multi-file open / "Open in new window" | Phase 1 D-23 single-window assumption | Out of MVP. |
| Drag-drop a folder (treat as atlas-less mode auto) | New | Out of scope for Phase 34 (drag-drop is a DropZone concern; menu phase). Future capture if user requests. |
| Picker preview pane (show rig name + bone count before load) | New | Out of MVP. |
| Recovered Open Recent paths that 404 → auto-prune | Phase 08.2 D-179 follow-up | Phase 08.2 D-179 explicitly chose click-and-recover over auto-prune. Not Phase 34's concern. |

</deferred>

---

*Phase: 34-file-open-accepts-json-files*
*Context gathered: 2026-05-11 from `/gsd-discuss-phase 34` interactive session*
