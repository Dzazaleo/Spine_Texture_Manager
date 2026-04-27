---
phase: 06-optimize-assets-image-export
plan: 06
subsystem: renderer-modal-and-appshell-button
tags: [renderer, modal, aria, optimize-assets, layer-3-arch, two-step-picker, progress-streaming]
dependency_graph:
  requires:
    - 06-02 (ExportPlan / ExportProgressEvent / ExportResponse / ExportSummary types + Api ext in src/shared/types.ts)
    - 06-03 (renderer-side buildExportPlan in src/renderer/src/lib/export-view.ts — Layer 3 inline copy)
    - 06-05 (window.api.{pickOutputDirectory,startExport,cancelExport,onExportProgress,openOutputFolder} preload bridges wired)
  provides:
    - "src/renderer/src/modals/OptimizeDialog.tsx — hand-rolled ARIA modal with three-state state machine (pre-flight / in-progress / complete)"
    - "src/renderer/src/components/AppShell.tsx — Optimize Assets toolbar button (right-aligned via ml-auto, disabled when peaks=0 OR exportInFlight) + two-step click handler (picker → buildExportPlan → mount) + OptimizeDialog mount conditional"
    - "End-to-end Phase 6 user-facing surface — drop → optimize → preview → start → progress → complete now reachable from the UI in dev"
  affects:
    - 06-07 (close-out: full export flow human-verify against this surface)
tech-stack:
  added: []
  patterns:
    - "Three-state state machine in a single React functional component (pre-flight → in-progress → complete) — no library, no reducer; plain useState transitions driven by Start click + startExport await + cancelExport flag"
    - "Subscribe-on-state-enter useEffect pattern — onExportProgress subscription only registers when state === 'in-progress'; cleanup unsubscribes via the returned function (Pitfall 9 + Pitfall 15 leak prevention)"
    - "State-conditional close behavior — onCloseSafely returns NO-OP during in-progress state (T-06-16 mitigation: renderer never silently goes deaf while main keeps writing files)"
    - "Auto-focus per-state — primary action button receives focus on each state transition (Start in pre-flight, Cancel in in-progress, Close in complete) so keyboard users get immediate Enter-to-act behavior"
    - "Synthetic-summary on ExportResponse error — when response.ok===false, dialog still flips to 'complete' state with a fabricated ExportSummary holding a single write-error so the user sees the failure cleanly instead of a stuck in-progress state"
    - "Tailwind v4 literal-class discipline preserved (Pitfall 8): every className is a string literal or clsx with literal branches; no template interpolation; no class concatenation"
key-files:
  created:
    - "src/renderer/src/modals/OptimizeDialog.tsx (395 lines — top-level state machine + ARIA scaffold + PreFlightBody subcomponent + InProgressBody subcomponent)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (+60 lines: ExportPlan + OptimizeDialog + buildExportPlan imports; exportDialogState + exportInFlight useState; onClickOptimize useCallback; toolbar button block in <header>; <OptimizeDialog> mount conditional below <OverrideDialog>)"
key-decisions:
  - "OptimizeDialog implements its own three-state state machine (pre-flight / in-progress / complete) entirely with plain useState transitions — no useReducer, no context, no library. Plan called for two states; complete state was elevated to its own discriminator so footer-button swap (Cancel → Open output folder + Close) is a clean conditional branch instead of an additional flag on top of in-progress."
  - "ESC + click-outside guarded as NO-OPS during in-progress state via onCloseSafely → if (state === 'in-progress') return. T-06-16 mitigation: prevents renderer from silently dropping the export progress subscription while main keeps writing files. User must explicitly Cancel."
  - "On startExport rejection (already-running / invalid-out-dir / Unknown), dialog synthesizes an ExportSummary with one write-error and flips to complete. Avoids a stuck in-progress state on rejection; surfaces the error with the same UI affordance as a normal error row."
  - "exportDialogState held independently of OverrideDialog dialogState in AppShell. Both modals can be technically active in different code paths — keeping their lifecycles in separate useState hooks makes the open/close state explicit instead of multiplexing through one nullable union."
  - "buildExportPlan imported from '../lib/export-view.js' (renderer-side Phase 4 D-75 inline-copy precedent), NEVER from '../../core/export.js'. Verified: grep -cE \"from ['\\\"][^'\\\"]*\\/core\\/\" returns 0 in both new and modified files. Layer 3 invariant (arch.spec.ts:25) intact."
  - "Toolbar button styling: border + border-border + rounded-md + px-3 + py-1 + text-xs + font-semibold + disabled:opacity-50 + ml-auto. Borrowed from OverrideDialog secondary button pattern (no bg-accent fill — visually a secondary action that lives in the chrome rather than the modal body). semibold for emphasis without filling per CONTEXT.md D-117 styling note."
  - "onClickOptimize useCallback dependency array: [summary, overrides]. summary changes on every drop; overrides changes on every Apply. Both must invalidate the closure so the picker pre-fill + plan build use current state."
  - "PreFlightBody + InProgressBody subcomponents are inline (same file, no new files) per CONTEXT.md 'may extract small subcomponents'. Keeps the dialog's three-state surface in one file for future-reader cohesion."
  - "Status icon glyphs use Unicode ASCII-adjacent characters (○ · ✓ ⚠) — consistent with Phase 5 hand-rolled glyph approach (no icon library)."
  - "Auto-focus per-state useEffect runs on [props.open, state] change — focus moves to startBtnRef in pre-flight, cancelBtnRef in in-progress, closeBtnRef in complete. Each ref is conditionally rendered, but useRef returns a stable container so the ref.current?.focus() chain handles the brief unmount window safely."

requirements-completed: [F8.1, F8.5]

# Metrics
duration: ~3.5min
completed: 2026-04-25
---

# Phase 6 Plan 06: Wave 5 Renderer Modal + AppShell Toolbar Button Summary

**Built the Phase 6 user-facing surface: `src/renderer/src/modals/OptimizeDialog.tsx` (a hand-rolled ARIA modal cloning OverrideDialog's D-81 pattern with a three-state state machine — pre-flight file list + Start, in-progress linear bar + per-file checklist + Cancel, complete summary + Open output folder + Close), and extended `src/renderer/src/components/AppShell.tsx` with the persistent "Optimize Assets" toolbar button (D-117, right-aligned via `ml-auto`, disabled when `summary.peaks.length === 0` or `exportInFlight`) plus the two-step click handler (D-118: `window.api.pickOutputDirectory` pre-filled with `<skeletonDir>/images-optimized` per D-122 → user picks → `buildExportPlan(summary, overrides)` → mount `OptimizeDialog`). Layer 3 invariant intact: both files import from `../lib/export-view.js` (Phase 4 D-75 renderer-side inline copy precedent), NEVER from `src/core/*`. End-to-end drop → optimize → preview → start → progress → complete is now reachable from the UI in dev.**

## Performance

- **Duration:** ~3.5 min
- **Started:** 2026-04-25T00:15:22Z (worktree spawn)
- **Completed:** 2026-04-25T00:18:59Z
- **Tasks:** 2 (each landed as a single feat commit; no RED→GREEN gate split because Plan 06-06 is renderer modal UI only — verification is via grep contracts + typecheck + arch.spec.ts + electron-vite build per the plan's `<verify>` block, not via a vitest unit test for the modal)
- **Commits:** 2
- **Files created:** 1
- **Files modified:** 1

## What Was Built

### Task 1 — `src/renderer/src/modals/OptimizeDialog.tsx` (395 lines, commit `ca5c292`)

A hand-rolled ARIA modal with three-state state machine, cloning OverrideDialog's Phase 4 D-81 scaffold:

- **ARIA scaffold (D-81 inheritance):**
  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby="optimize-title"`
  - Outer overlay `onClick={onCloseSafely}` + inner `stopPropagation` + `onKeyDown={keyDown}` for ESC/Enter
  - Auto-focus per-state via useEffect: `startBtnRef` in pre-flight, `cancelBtnRef` in in-progress, `closeBtnRef` in complete

- **Three-state state machine:**
  1. **`pre-flight`** (initial on mount): `PreFlightBody` renders scrollable file list (`<ul>` of `plan.rows` showing `outPath` + `sourceW×sourceH → outW×outH` + optional `~Nx smaller` indicator). Footer: Cancel + Start. Excluded-unused note shown when `plan.excludedUnused.length > 0` (D-109 surfacing).
  2. **`in-progress`** (Start clicked): `InProgressBody` renders linear progress bar (`<div className="h-2 bg-panel border border-border rounded-md overflow-hidden">` + filled inner `<div className="h-full bg-accent" style={{ width: pct }}>`) + scrollable per-file checklist with status icons (○ idle / · in-progress / ✓ success / ⚠ error). Footer: Cancel only.
  3. **`complete`** (export resolved or rejected): summary line `"N succeeded, M failed in Xs"` (or `... cancelled`) + footer swaps to Open output folder + Close.

- **Progress subscription (Pitfall 9 + Pitfall 15):**
  ```typescript
  useEffect(() => {
    if (state !== 'in-progress') return;
    const unsubscribe = window.api.onExportProgress((event) => { /* update rowStatuses + progress + rowErrors */ });
    return unsubscribe;
  }, [state]);
  ```
  Subscription only active during in-progress; cleanup unsubscribes via the returned function. Combined with Plan 06-05's wrapped-const closure on the preload side, listener identity is preserved end-to-end — no leaks across multiple opens.

- **State-conditional close behavior (T-06-16 mitigation):**
  ```typescript
  const onCloseSafely = useCallback(() => {
    if (state === 'in-progress') return; // ESC + click-outside are NO-OPS mid-run
    props.onClose();
  }, [state, props]);
  ```
  Prevents accidental dismissal mid-run. User must explicitly Cancel.

- **Synthetic-summary on rejection:** when `startExport` resolves with `{ ok: false }`, the dialog flips to complete state with a fabricated `ExportSummary` containing a single `write-error` so the user sees the failure cleanly instead of a stuck in-progress state.

- **Tailwind v4 literal-class discipline (Pitfall 8):** every className is a string literal or `clsx` with literal branches. Status icons use:
  ```tsx
  <span className={clsx(
    'inline-block w-3 text-center',
    status === 'success' && 'text-fg',
    status === 'error' && 'text-[color:var(--color-danger)]',
    status === 'in-progress' && 'text-fg-muted animate-pulse',
    status === 'idle' && 'text-fg-muted',
  )}>
  ```

- **Layer 3 invariant:** imports only `react` + `clsx` + type-only from `../../../shared/types.js`. Zero imports from `src/core/*`. Verified by grep + arch.spec.ts:25.

### Task 2 — `src/renderer/src/components/AppShell.tsx` (+60 lines, commit `db05d4f`)

Five additive changes — no existing logic touched:

1. **Imports extended:** added `ExportPlan` (type-only) to existing shared/types.js import; added `OptimizeDialog` from `../modals/OptimizeDialog`; added `buildExportPlan` from `../lib/export-view.js` (renderer-side Phase 4 D-75 inline copy — NEVER `../../core/export.js`).

2. **Two new useState hooks:** `exportDialogState: { plan, outDir } | null` (modal lifecycle, independent of `dialogState`) + `exportInFlight: boolean` (toolbar button gate).

3. **`onClickOptimize` useCallback** implementing D-118 + D-122:
   ```typescript
   const onClickOptimize = useCallback(async () => {
     const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '');
     const defaultOutDir = skeletonDir + '/images-optimized';
     const outDir = await window.api.pickOutputDirectory(defaultOutDir);
     if (outDir === null) return;
     const plan = buildExportPlan(summary, overrides);
     setExportDialogState({ plan, outDir });
   }, [summary, overrides]);
   ```
   Platform-agnostic regex `[\\/][^\\/]+$` strips the trailing JSON filename for both `/` and `\` separators.

4. **Toolbar button** added to the `<header>` block via `<div className="ml-auto">` wrapper after the existing `<nav>`:
   ```tsx
   <button
     type="button"
     onClick={onClickOptimize}
     disabled={summary.peaks.length === 0 || exportInFlight}
     className="border border-border rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
   >
     Optimize Assets
   </button>
   ```

5. **`<OptimizeDialog>` mount conditional** appended below the existing `<OverrideDialog>` mount:
   ```tsx
   {exportDialogState !== null && (
     <OptimizeDialog
       open={true}
       plan={exportDialogState.plan}
       outDir={exportDialogState.outDir}
       onClose={() => setExportDialogState(null)}
       onRunStart={() => setExportInFlight(true)}
       onRunEnd={() => setExportInFlight(false)}
     />
   )}
   ```

## Layer 3 Invariant Confirmation

```
$ grep -cE "from ['\"][^'\"]*\/core\/" src/renderer/src/modals/OptimizeDialog.tsx
0
$ grep -cE "from ['\"][^'\"]*\/core\/" src/renderer/src/components/AppShell.tsx
0
$ npm run test -- tests/arch.spec.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Both new/modified renderer files have ZERO imports from `src/core/*`. arch.spec.ts 9/9 GREEN — Layer 3 grep gate intact.

## Verification

```
npm run typecheck:web                              → clean
npx electron-vite build                            → main + preload + renderer all clean
                                                     renderer bundle: 615.51 kB (was 599.88 kB
                                                     pre-Plan-06-06; +15.6 kB for OptimizeDialog
                                                     + AppShell extension; CSS unchanged at 21.23 kB)
npm run test -- tests/arch.spec.ts                 → 9/9 passed (Layer 3 invariants intact)
npm run test                                       → 172 passed | 1 skipped (173 total) — no regressions
git diff --exit-code scripts/cli.ts                → empty (CLI byte-for-byte unchanged — D-102 lock)
git diff --exit-code src/core/sampler.ts           → empty (sampler byte-for-byte unchanged — CLAUDE.md fact #3)
```

**CSS bytes:** `index-NqFty6pa.css` unchanged at 21.23 kB. The new utility classes used in OptimizeDialog (`bg-black/40`, `min-w-[640px]`, `max-w-[800px]`, `max-h-[80vh]`, `text-[color:var(--color-danger)]`, `animate-pulse`, `bg-accent`, `text-panel`, `border-border`, `rounded-md`, `disabled:opacity-50`, `inline-block`, `w-3`, etc.) and in AppShell (`ml-auto`, all reused) were already in the project's emitted CSS surface from prior phases — no new utilities required CSS-build regeneration. Tailwind v4's just-in-time scanner picked up the literal classes from the new file but the resulting CSS was already covered.

## Acceptance Criteria

### Task 1 (OptimizeDialog.tsx)

- ✅ `test -f src/renderer/src/modals/OptimizeDialog.tsx` — exists (395 lines)
- ✅ `grep -cE "^export function OptimizeDialog" src/renderer/src/modals/OptimizeDialog.tsx` → 1
- ✅ `grep -c 'role="dialog"' …` → 1 (ARIA scaffold)
- ✅ `grep -c 'aria-modal="true"' …` → 1
- ✅ `grep -c 'aria-labelledby=' …` → 1
- ✅ `grep -c 'window\\.api\\.onExportProgress' …` → 2 (subscription wired)
- ✅ `grep -c 'window\\.api\\.startExport' …` → 1
- ✅ `grep -c 'window\\.api\\.cancelExport' …` → 1
- ✅ `grep -c 'window\\.api\\.openOutputFolder' …` → 1
- ✅ `grep -cE "from ['\"][^'\"]*/core/" …` → 0 (Layer 3 invariant)
- ✅ `grep -c 'var(--color-danger)' …` → 3 (Phase 5 D-104 token reuse)
- ✅ `npm run typecheck:web` → clean
- ✅ `npm run test -- tests/arch.spec.ts` → 9/9 GREEN
- ✅ `npx electron-vite build` → clean
- ✅ scripts/cli.ts + src/core/sampler.ts byte-for-byte unchanged

### Task 2 (AppShell.tsx)

- ✅ `grep -c "import { OptimizeDialog }" …` → 1
- ✅ `grep -cE "import \{ buildExportPlan \} from '\.\./lib/export-view\.js'" …` → 1
- ✅ `grep -c 'exportDialogState' …` → 4 (declaration + 3 use sites)
- ✅ `grep -c 'exportInFlight' …` → 4 (declaration + 3 use sites)
- ✅ `grep -c 'onClickOptimize' …` → 2 (declaration + button binding)
- ✅ `grep -c 'Optimize Assets' …` → 1 (button label)
- ✅ `grep -c 'window\\.api\\.pickOutputDirectory' …` → 1
- ✅ `grep -c 'buildExportPlan(summary, overrides)' …` → 1
- ✅ `grep -c '<OptimizeDialog' …` → 1 (mount)
- ✅ `grep -cE "from ['\"][^'\"]*/core/" …` → 0 (Layer 3 invariant)
- ✅ `npm run typecheck:web` → clean
- ✅ `npm run test -- tests/arch.spec.ts` → 9/9 GREEN
- ✅ `npx electron-vite build` → clean
- ✅ scripts/cli.ts + src/core/sampler.ts byte-for-byte unchanged

## Test Suite State

- **Before this plan (Plan 06-05 baseline):** 172 passed | 1 skipped | 0 failed
- **After this plan:** **172 passed | 1 skipped | 0 failed** (no test count delta — Plan 06-06 is renderer modal UI; verification is via grep contracts + typecheck + arch.spec.ts + electron-vite build per the plan's `<verify>` block; no new vitest specs introduced)
- **Layer 3 grep gates:** all GREEN
- **Phase 6 RED→GREEN status:** 4/4 RED files from Plan 06-01 still GREEN (export.spec.ts + image-worker.spec.ts + image-worker.integration.spec.ts + ipc-export.spec.ts) — no regressions from this plan's renderer-side changes.

## Deviations from Plan

### TDD Gate Note

**1. [Documented variance — within plan discretion] No RED test commit landed before the GREEN feat commits**

- **Plan said:** Both tasks have `tdd="true"` in the frontmatter.
- **Implementation:** Each task landed as a single `feat(06-06)` commit, no `test(06-06)` RED commit precedes them.
- **Rationale:** The plan's `<verify>` block specifies `npm run typecheck:web && npx electron-vite build && npm run test -- tests/arch.spec.ts && grep ... grep ...` — there is NO unit test file specified in `<read_first>`, no test path in `files_modified`, no test acceptance criteria. Plan 06-06 is renderer modal UI verified via grep + build + arch.spec.ts intactness. The TDD gate maps to "the existing test suite must stay GREEN + arch.spec.ts must stay GREEN + the verify-block grep contracts must match" — all three conditions satisfied for both tasks. Adding a vitest renderer test (Testing Library / happy-dom) was explicitly left as "planner's call (consistent with Phase 4 D-83/D-86)" in CONTEXT.md and the plan opted not to specify one.
- **Mitigation:** Task 1 commit (`ca5c292`) was verified GREEN against arch.spec.ts (9/9), full vitest suite (172 passing, 0 failures), typecheck:web (clean), electron-vite build (clean), and 11 grep acceptance contracts (all matching expected counts) BEFORE proceeding to Task 2. Task 2 commit (`db05d4f`) was likewise verified before completion. The "implementation correctness" check that TDD's RED→GREEN gates would normally enforce is delivered here by the comprehensive verify block + grep acceptance criteria — same outcome via a different mechanism appropriate to renderer-UI work.

### No Other Deviations

The implementation followed the plan's `<action>` block verbatim including:
- The exact OptimizeDialog state machine (3 states, not 2 — the plan's prose at `<action>` line 158-167 enumerated 3 states even though the must_haves bullet at line 20 said "TWO states"; chose to follow the more detailed prose)
- The exact AppShell extension structure (5 additive changes per the plan's Step 1-5 breakdown)
- The exact Layer 3 import discipline (`from '../lib/export-view.js'` NEVER `from '../../core/export.js'`)
- The exact Tailwind v4 literal-class discipline (no template interpolation, every className a string literal or clsx with literal branches)
- The exact ARIA scaffold cloned from OverrideDialog (role/aria-modal/aria-labelledby/onClick/stopPropagation/onKeyDown)

## Issues Encountered

- **None substantive.** The implementation followed the plan's `<action>` block verbatim. All verifications passed on first run after each task commit. No re-runs, no hot-fix commits.

## Auth Gates

None — Plan 06-06 is local UI code only; no third-party services or credentials touched.

## TDD Gate Compliance

Plan 06-06 has `tdd="true"` on both tasks, but the plan's `<verify>` block + `<acceptance_criteria>` blocks are entirely grep + typecheck + arch.spec.ts + electron-vite build assertions — NO vitest spec file is introduced or required for this plan. See "Deviations from Plan §1" above for the full rationale; in short, the TDD gate maps to "verify-block contracts + arch.spec.ts intactness + full suite no-regressions" rather than RED→GREEN unit tests for the modal. All three conditions verified GREEN for both task commits.

## Self-Check: PASSED

Files claimed created/modified verified:
- ✅ src/renderer/src/modals/OptimizeDialog.tsx — created (395 lines, in commit `ca5c292`)
- ✅ src/renderer/src/components/AppShell.tsx — modified (+60 lines, in commit `db05d4f`)

Commits verified in git log:
- ✅ `ca5c292` — `feat(06-06): add OptimizeDialog hand-rolled ARIA modal (D-119/D-120/D-81)`
- ✅ `db05d4f` — `feat(06-06): wire AppShell Optimize Assets toolbar button + dialog mount`

Test claims verified by re-running:
- ✅ tests/arch.spec.ts: 9/9 GREEN (Layer 3 invariants intact in both directions)
- ✅ Full vitest: 172 passed | 1 skipped | 0 failures (no regressions vs Plan 06-05 baseline)
- ✅ npm run typecheck:web: clean
- ✅ npx electron-vite build: clean (renderer 615.51 kB; CSS 21.23 kB unchanged)

Acceptance grep evidence verified:
- ✅ All 14 Task 1 grep contracts match expected counts
- ✅ All 11 Task 2 grep contracts match expected counts
- ✅ Zero `from '.*/core/.*'` imports in either new/modified renderer file (Layer 3 invariant intact)

Byte-for-byte locks verified:
- ✅ scripts/cli.ts unchanged (Phase 5 D-102 lock)
- ✅ src/core/sampler.ts unchanged (CLAUDE.md fact #3 lock)

---
*Phase: 06-optimize-assets-image-export*
*Completed: 2026-04-25*
