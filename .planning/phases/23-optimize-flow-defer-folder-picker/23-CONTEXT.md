# Phase 23: Optimize flow — defer folder picker - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewire the "Optimize Assets" toolbar button so `OptimizeDialog` opens immediately — no OS folder picker appears before the modal. The pre-flight summary (file list, savings estimate, passthrough/resize breakdown) is accessible as soon as the user clicks the toolbar button.

The OS folder picker is deferred to the moment the user clicks **Start** inside the dialog. At that point, the picker opens pre-filled at the last-used output folder (`lastOutDir`) for this project, or at the skeleton's parent directory on first use. Cancelling the picker returns to pre-flight without closing the dialog.

`lastOutDir` is updated in AppShell state when the user confirms a folder on Start, and is silently auto-saved to the `.stmproj` file (if one exists) when an export completes, so it survives session restarts without requiring an explicit Cmd+S.

**In scope:**
- OPT-01: OptimizeDialog opens immediately on toolbar click (no picker before modal)
- OPT-02: Output-folder picker triggered only when user clicks Start; pre-filled with lastOutDir if saved
- `lastOutDir` lifecycle: populate from picker result, silently auto-save to `.stmproj` after export, skeletonDir as default on first use
- Pre-flight header title update to reflect whether a saved folder is known

**Out of scope:**
- OPT-03 (atlas-savings metric) — Phase 24
- Any changes to the conflict probe, ConflictDialog, or export pipeline
- Changes to the dirty-signal or explicit-Save flow for overrides/documentation

</domain>

<decisions>
## Implementation Decisions

### Pre-flight destination display (LOCKED 2026-05-03)
- **D-01:** **No saved path → clean title.** When `lastOutDir === null` (first use or new project), the pre-flight header reads `"Optimize Assets — N images"` — no destination shown. The user sees the pre-flight summary without being primed with a placeholder path.
- **D-02:** **Saved path → shown in title.** When `lastOutDir !== null`, the header reads `"Optimize Assets — N images → /saved/path"`. Same format as today (`${total} images → ${props.outDir}`), but populated from the saved path rather than the picker result. The user can see at a glance where the export will land before clicking Start.

### Start button behavior (LOCKED 2026-05-03)
- **D-03:** **Picker always opens on Start.** Regardless of whether `lastOutDir` is saved, clicking Start opens the OS folder picker. There is no "skip picker" path — every export is an explicit folder confirmation.
- **D-04:** **Picker pre-fills at lastOutDir when saved; at skeletonDir on first use.** `lastOutDir !== null` → `window.api.pickOutputDirectory(lastOutDir)`. `lastOutDir === null` → `window.api.pickOutputDirectory(skeletonDir)` (current behavior; skeletonDir = parent of the `.json` file). The existing skeletonDir derivation at `AppShell.tsx:510` is reused.
- **D-05:** **Cancel picker → stay in pre-flight.** If the user opens the picker from Start and then cancels, the dialog remains open in pre-flight state. The user can review the plan and click Start again. The dialog is NOT closed.

### lastOutDir lifecycle (LOCKED 2026-05-03)
- **D-06:** **Default = skeletonDir (where the .json lives).** On a new project or first optimize, the picker suggests the skeleton's parent directory. Per-project `lastOutDir` resets to this default; a new `.json` file → new default suggestion.
- **D-07:** **Set in AppShell state immediately after folder is confirmed; auto-save .stmproj silently on export complete.** After the user picks a folder on Start, AppShell sets `lastOutDir` in its session state. On export completion (`onRunEnd`), if `currentProjectPath !== null`, silently call `window.api.saveProject(state, currentProjectPath)` to persist `lastOutDir` to the `.stmproj` file. If no `.stmproj` exists yet (raw JSON session), `lastOutDir` lives in memory only until the user does Save As.
- **D-08:** **No dirty-signal change.** The auto-save of `lastOutDir` does not affect the unsaved-changes indicator. `lastOutDir` is session metadata (like `sortColumn`/`sortDir`), not a design decision. The dirty derivation at `AppShell.tsx:714-723` is left unchanged.

### Claude's Discretion
- **`outDir` prop type change in `OptimizeDialogProps`.** Currently `outDir: string` (required). For Phase 23, the dialog opens before a folder is chosen. Options: (a) make `outDir: string | null` and handle null in the header title + openOutputFolder button; (b) keep `outDir` as the already-picked path in `exportDialogState` — only non-null after Start picks a folder. Recommend (a): the dialog is mounted with `outDir = lastOutDir ?? null` from AppShell; `onConfirmStart` runs the picker and calls `setExportDialogState` with the new `outDir` before the conflict probe completes. The header title conditionally renders per D-01/D-02. The "Open output folder" button in complete state should remain disabled or hidden if `outDir === null` (not possible in practice since Start populates it, but defensive).
- **`onClickOptimize` restructure.** The current sequence (picker → plan → setExportDialogState) becomes (plan → setExportDialogState with `outDir: lastOutDir ?? null`). `pickOutputDir` moves into `onConfirmStart` (called when Start is clicked). `onConfirmStart` becomes: pick folder → if null return `{ proceed: false }` → update `exportDialogState.outDir` → run conflict probe → return proceed/overwrite.
- **Silent save IPC call.** `window.api.saveProject` is already available at the preload boundary. The silent save in `onRunEnd` reuses `buildSessionState()` with the updated `lastOutDir`. No new IPC channel needed.
- **`buildSessionState` change.** Add `lastOutDir` as a piece of explicit AppShell state (a `useState` initialized from `initialProject?.lastOutDir ?? null`). `buildSessionState` reads from this state slot instead of returning `null`. This also fixes the longstanding "D-145 Documented deferral" comment at `AppShell.tsx:636-638`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 Source Documents
- `.planning/ROADMAP.md` §"Phase 23" — official scope, 3 success criteria, dependency on Phase 22.1
- `.planning/REQUIREMENTS.md` OPT-01 (line ~49) + OPT-02 (line ~52) — normative requirement text

### Existing Code (must read + audit)
- `src/renderer/src/components/AppShell.tsx:492-519` — `pickOutputDir` + `onClickOptimize`: the exact code being restructured. `pickOutputDir` moves from here into `onConfirmStart`.
- `src/renderer/src/components/AppShell.tsx:541-563` — `onConfirmStart`: gains the picker call before conflict probe. Shape changes from pure-probe to pick→probe.
- `src/renderer/src/components/AppShell.tsx:595-610` — "Pick different folder" re-pick path in ConflictDialog handler: still calls `pickOutputDir` (this path is unchanged by Phase 23; it's already inside the modal flow).
- `src/renderer/src/components/AppShell.tsx:625-653` — `buildSessionState`: `lastOutDir: null` hardcode (line 638) must be replaced with the new `lastOutDir` state slot.
- `src/renderer/src/components/AppShell.tsx:1566-1567` — `onRunStart` / `onRunEnd` callbacks on `<OptimizeDialog>`: `onRunEnd` gains the silent auto-save call per D-07.
- `src/renderer/src/modals/OptimizeDialog.tsx:55-93` — `OptimizeDialogProps`: `outDir: string` → `outDir: string | null`
- `src/renderer/src/modals/OptimizeDialog.tsx:311-316` — `headerTitle` derivation: pre-flight branch conditionally shows path per D-01/D-02 (`outDir !== null ? "N images → ${outDir}" : "N images"`).
- `src/renderer/src/modals/OptimizeDialog.tsx:257` — `openOutputFolder(props.outDir)`: guard against null (button should not appear or be disabled when outDir is null; in practice outDir is set by the time export completes, but type safety requires it).
- `src/shared/types.ts:773-799` — `ProjectFileV1`: `lastOutDir: string | null` already exists (line 780). No schema change needed.
- `src/shared/types.ts:809-822` — `AppSessionState`: `lastOutDir: string | null` already exists (line 815). No schema change needed.

### Locked Invariants
- **CLAUDE.md fact #5** (`core/` is pure TypeScript, no DOM) — all Phase 23 changes are in renderer + AppShell. `src/core/` is untouched.
- **Locked memory `project_layout_fragility_root_min_h_screen.md`** — AppShell `min-h-screen` invariant unchanged; no layout changes in Phase 23.
- **Phase 6 D-117 + D-118 + D-122** — picker-to-plan-to-mount sequence preserved, just deferred from toolbar click to Start click. The Phase 12 F2 fix (skeletonDir as picker start, not '/images-optimized') is preserved in the new `pickOutputDir` calls per D-04.
- **Gap-Fix Round 3 probe-then-confirm pipeline** — the `onConfirmStart` contract (returns `{ proceed, overwrite? }`) is preserved. Phase 23 extends it by adding the picker call BEFORE the probe, not replacing the probe.

### Test Surface
- `tests/renderer/appshell-optimize-flow.spec.tsx` (or equivalent) — must cover: (1) toolbar click opens dialog WITHOUT picker; (2) Start with no lastOutDir opens picker at skeletonDir; (3) Start with saved lastOutDir opens picker pre-filled; (4) cancel picker → stays in pre-flight; (5) successful export → lastOutDir updated in state; (6) header title variants per D-01/D-02.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pickOutputDir` at `AppShell.tsx:492-511` — moves from `onClickOptimize` into `onConfirmStart`; the skeletonDir derivation regex (`summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.'`) is reused verbatim.
- `buildSessionState` at `AppShell.tsx:625-653` — gains `lastOutDir` from new state slot; otherwise unchanged.
- `window.api.saveProject` at `AppShell.tsx:737` — reused for the silent auto-save in `onRunEnd`.
- `exportDialogState: { plan, outDir }` state shape at `AppShell.tsx:360-362` — `outDir` becomes `string | null` (was always a non-null string because picker ran before mount; now null until confirmed on Start).

### Established Patterns
- **OptimizeDialogProps optional→required evolution** — the `onConfirmStart?` optional prop (Gap-Fix Round 3) shows the precedent for adding nullable/optional behavior to the dialog.
- **`onRunEnd` callback** — already wired at `AppShell.tsx:1567`; adding the silent save there is consistent with the "export lifecycle" pattern.
- **Silent IPC calls** — `resampleProject` is called silently in a `useEffect`; the silent `saveProject` call in `onRunEnd` follows the same pattern (fire-and-forget, no UI indicator needed).

### Integration Points
- `AppShell.tsx:onClickOptimize` — loses the picker call; becomes: build plan → set exportDialogState with `outDir: lastOutDir ?? null`.
- `AppShell.tsx:onConfirmStart` — gains picker call at the top; updates `exportDialogState.outDir` before the conflict probe.
- `AppShell.tsx:onRunEnd` — gains silent auto-save call for `lastOutDir`.
- `OptimizeDialog.tsx:headerTitle` — conditional on `outDir !== null`.
- `OptimizeDialog.tsx:OptimizeDialogProps.outDir` — widened to `string | null`.

### Files Not Touched
- `src/core/` — no changes (pure TS invariant)
- `src/main/` — no changes (picker and save IPC channels already exist)
- `src/renderer/src/lib/export-view.ts` — no changes (buildExportPlan called earlier in the flow but identical)
- `src/renderer/src/modals/ConflictDialog.tsx` — no changes (re-pick flow already inside modal; unaffected by Phase 23)

</code_context>

<specifics>
## Specific Ideas

- **The user's mental model**: "By default, app suggests the folder where the JSON is. After picking a different folder once, that path is remembered for this project. New project → back to JSON location as default." This is exactly what D-06 + D-07 capture. The implementation already has skeletonDir as the picker start (Phase 12 F2 fix), and `lastOutDir` already exists in the schema. Phase 23 closes the gap where `lastOutDir` was always serialized as `null`.
- **No "skip picker" shortcut**: The user confirmed: picker always appears on Start. The pre-flight just gives them the pre-flight summary WITHOUT having committed to a folder yet — that's the value, not skipping the picker entirely.
- **Cancel picker stays in pre-flight**: This is a UX improvement over the current flow where the whole experience (no dialog) disappears on cancel. Now the user can open the pre-flight, review, cancel the picker, think, and try again without losing context.
- **The "Documented deferral" at AppShell.tsx:636-638 finally lands**: The comment says "Phase 9 hoists them to AppShell state" — but Phase 9 only got samplingHz. Phase 23 is where `lastOutDir` finally gets a real state slot and is actually populated.

</specifics>

<deferred>
## Deferred Ideas

- **"Change folder" affordance in pre-flight body** — the user didn't request an inline "Change folder" button in the pre-flight view (since the picker always opens on Start anyway). If it surfaces as UX feedback after Phase 23 ships, it's a small UI addition.
- **lastOutDir dirty-signal inclusion** — keeping lastOutDir out of the dirty signal is the right call for now. If a future phase hoists `sortColumn`/`sortDir` into AppShell state (the original Phase 9 deferral), that would be the natural time to revisit all three together.
- **OPT-03: atlas-savings metric** — mentioned in Phase 24 scope; depends on Phase 23's OptimizeDialog surface being stable.

### Reviewed Todos (not folded)
- `2026-04-24-phase-4-code-review-follow-up.md` — Phase 4 panel code quality carry-forwards; unrelated to optimize flow rewire. Deferred to Phase 27 (QA sweep).
- `2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — Phase 20 cross-platform DnD UAT; host-blocked; unrelated to Phase 23.

</deferred>

---

*Phase: 23-optimize-flow-defer-folder-picker*
*Context gathered: 2026-05-03*
