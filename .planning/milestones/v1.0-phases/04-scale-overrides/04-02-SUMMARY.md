---
phase: 04-scale-overrides
plan: 02
subsystem: renderer-shell-modal
tags: [override, dialog, modal, appshell, layer-3, useState, useCallback, aria, hand-rolled]

requires:
  - phase: 04-scale-overrides
    plan: 01
    provides: src/renderer/src/lib/overrides-view.ts — renderer-side clampOverride (Layer 3 inline-duplicate — AppShell imports from this path, never from src/core/*)
  - phase: 03-animation-breakdown-panel
    provides: AnimationBreakdownPanel.tsx with AnimationBreakdownPanelProps + BreakdownRow type import — extension target for optional override props
  - phase: 02-global-max-render-source-panel
    provides: GlobalMaxRenderPanel.tsx with GlobalMaxRenderPanelProps + DisplayRow type import — extension target for optional override props
  - phase: 01-electron-react-scaffold
    provides: tests/arch.spec.ts Layer 3 grep gate that auto-scans src/renderer/**/*.{ts,tsx} for any from '...core/...' import. The new AppShell/OverrideDialog files comply.

provides:
  - src/renderer/src/modals/OverrideDialog.tsx — hand-rolled ARIA modal (role=dialog, aria-modal=true, aria-labelledby). Controlled integer input; auto-focus+select on open; ESC/Enter/overlay-click handlers; conditional Reset button (anyOverridden gate); title branches on scope.length per D-88
  - AppShell override state container + three useCallback handlers + conditional OverrideDialog render. overrides Map<string, number>; dialogState | null; onOpenOverrideDialog applies D-86/D-87 batch-vs-row resolution; onApplyOverride applies D-79 silent clamp via renderer-side clampOverride + D-88 batch write; onClearOverride applies D-76 delete + D-88 batch clear
  - GlobalMaxRenderPanelProps + AnimationBreakdownPanelProps each gain two optional members (overrides?: ReadonlyMap<string, number>, onOpenOverrideDialog) — Plan 04-03 consumes; panel bodies unchanged in this plan

affects:
  - 04-03 (final wave — wires Scale + Peak W×H cells in both panels to read overrides, compute effective dims via applyOverride from lib/overrides-view, attach onDoubleClick, unlock AnimationBreakdown Override button per D-69)
  - Phase 6 export pipeline (future) — consumes the same AppShell overrides Map directly from main process via its pure src/core/overrides.ts (Layer 2/Layer 3 does not apply in main process)

tech-stack:
  added: []
  patterns:
    - "Hand-rolled ARIA modal (role=dialog + aria-modal=true + aria-labelledby) with overlay-click-closes + ESC-closes + Enter-applies + auto-focus+select on open — first modal in the project. Sub-140-line implementation; well under the 60-line threshold that would justify pulling in a modal lib."
    - "useCallback + functional setState pattern for setOverrides((prev) => new Map(prev)...) — Phase 4 precedent for Map mutations through useState. Empty dep arrays on onApplyOverride + onClearOverride (only setState calls); [overrides] dep on onOpenOverrideDialog (reads current map for currentPercent + anyOverridden)."
    - "Optional-props extension strategy for cross-wave plans: Plan 04-02 adds overrides + onOpenOverrideDialog as OPTIONAL to both panel Props interfaces so AppShell typechecks without forcing the panel bodies to consume them in the same commit. Plan 04-03 then makes the consumption land. Avoids a typecheck break-point between plans within the same phase."

key-files:
  created:
    - src/renderer/src/modals/OverrideDialog.tsx (137 lines, hand-rolled ARIA modal, 1 exported interface + 1 exported function, 1 React type-import)
  modified:
    - src/renderer/src/components/AppShell.tsx (128 → 212 lines; +84 lines; new state + 3 callbacks + dialog JSX slot + docblock extension + 3 new imports: DisplayRow/BreakdownRow, OverrideDialog, clampOverride)
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (+ 10 lines; two optional Props members + JSDoc)
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx (+ 7 lines; two optional Props members + JSDoc)

key-decisions:
  - "AppShell imports clampOverride from '../lib/overrides-view.js' — the renderer-side byte-identical copy created in 04-01 — NOT from '../../../core/overrides.js'. The Layer 3 arch grep in tests/arch.spec.ts (lines 19-34) rejects any renderer→core imports by regex; the renderer-side copy IS the canonical renderer-reachable clamp source."
  - "Optional Props strategy: overrides?: ReadonlyMap + onOpenOverrideDialog? are OPTIONAL on both panel interfaces. Rationale: Plan 04-02 ships the AppShell wiring; Plan 04-03 ships the panel-body consumption. Required props in 04-02 would force 04-02 to also ship the panel bodies, violating wave isolation. The Plan 04-02 <action> block explicitly calls this out."
  - "Dialog keyDown handler lives on the inner panel div (not on the input). PATTERNS.md §2 anti-pattern note: stopPropagation inside the input's onKeyDown would break Tab focus-trap cycling. The outer overlay closes on backdrop-click; the inner panel stopPropagates click and owns the Enter/Escape handlers."
  - "Title ID 'override-title' is hard-coded literal string (not generated via useId). Rationale: only one instance of OverrideDialog can be rendered at a time (AppShell conditionally mounts it), and the seeded dialog sketch in 04-CONTEXT.md lines 283-287 uses the literal ID. Matches the plan's acceptance criterion 'grep -q aria-labelledby'."

patterns-established:
  - "First ARIA modal in the project. Future modals (Phase 6 OptimizeDialog, Phase 7 AtlasPreviewModal) follow the same shape: fixed inset-0 z-50 overlay + inner panel + overlay-click-closes + role=dialog + aria-modal=true + aria-labelledby + auto-focus-on-open."
  - "Optional-prop wave bridge: when Plan N+1 will consume panel-level props that Plan N wires at AppShell level, declare the props optional in Plan N's Props-interface extensions. Makes the typecheck green between plans without carrying a forced panel-body consumption."

requirements-completed: []

duration: 3m 53s
completed: 2026-04-24
---

# Phase 4 Plan 02: AppShell override state + hand-rolled OverrideDialog modal Summary

**AppShell now owns the Phase 4 overrides state (Map<string, number> + dialog lifecycle) plus three useCallback handlers (open / apply / clear); OverrideDialog.tsx is the project's first hand-rolled ARIA modal (role=dialog + aria-modal=true + aria-labelledby, overlay-click-closes, ESC/Enter shortcuts, auto-focus+select on open, conditional Reset button); both panel Props interfaces gained optional overrides + onOpenOverrideDialog members so Plan 04-03 can consume the wiring without reopening AppShell. Layer 3 invariant intact — AppShell imports clampOverride from the renderer-side lib/overrides-view copy created in 04-01, never from src/core/*.**

## Performance

- **Duration:** 3m 53s
- **Started:** 2026-04-24T10:22:50Z
- **Completed:** 2026-04-24T10:26:43Z
- **Tasks:** 2
- **Files created:** 1 (OverrideDialog.tsx)
- **Files modified:** 3 (AppShell.tsx + two panel Props interfaces)

## Accomplishments

- `src/renderer/src/modals/OverrideDialog.tsx` ships a 137-line hand-rolled modal with role=dialog + aria-modal=true + aria-labelledby="override-title"; controlled `<input type="number" min={1} max={100} step={1}>` with internal useState (typed 200 stays visible until Apply); auto-focus + `.select()` on open via useEffect + useRef; ESC closes, Enter applies, overlay click closes; Reset-to-100% button renders only when `props.anyOverridden === true` per D-80; title branches on `scope.length === 1` vs `> 1` per D-88; `autoFocus` on Apply only when `!props.anyOverridden` per the seeded sketch D-81; every className is a literal string (Tailwind v4 Pitfall 8 safe); two-weight typography contract honored (font-normal implicit on body/input/helper, font-semibold only on primary Apply button).
- `AppShell.tsx` now owns two new state slots: `overrides: Map<string, number>` (D-74, plain useState, empty on every mount — remount-on-new-drop is the reset mechanism per D-50 parity) and `dialogState: {scope, currentPercent, anyOverridden} | null` (D-77 lifecycle). Three useCallback handlers are added alongside the existing onJumpToAnimation/onFocusConsumed: `onOpenOverrideDialog(row, selectedKeys?)` applies D-86 batch-when-in-selection-and-size-gt-1 + D-87 clicked-row-not-in-selection-is-per-row + D-80 anyOverridden computation; `onApplyOverride(scope, percent)` applies D-79 silent clamp via the renderer-side `clampOverride` + D-88 batch write; `onClearOverride(scope)` applies D-76 delete + D-88 batch clear. All three close dialogState after firing.
- `<OverrideDialog>` is rendered conditionally below `<main>` inside AppShell, with the dialog state destructured to props and three closure callbacks (`onApply={(percent) => onApplyOverride(dialogState.scope, percent)}`, `onClear={() => onClearOverride(dialogState.scope)}`, `onCancel={() => setDialogState(null)}`).
- Both panels receive `overrides={overrides}` and `onOpenOverrideDialog={onOpenOverrideDialog}` through the existing prop channels — no indirection layer added.
- `GlobalMaxRenderPanelProps` gained `overrides?: ReadonlyMap<string, number>` and `onOpenOverrideDialog?: (row: DisplayRow, selectedKeys?: ReadonlySet<string>) => void`; `AnimationBreakdownPanelProps` gained `overrides?: ReadonlyMap<string, number>` and `onOpenOverrideDialog?: (row: BreakdownRow) => void` (no selectedKeys — D-90 no batch on this panel). Both are OPTIONAL per the plan's cross-wave strategy — Plan 04-03 consumes them in the panel bodies.
- Layer 3 arch gate 6/6 green. No renderer file imports from `src/core/*`. AppShell's `clampOverride` import points at `../lib/overrides-view.js`, the renderer-side inline-duplicate copy created in Plan 04-01.
- Test suite holds at 113 passed + 1 skipped (no new tests in 04-02 — the dialog's correctness is covered by arch.spec auto-scan + grep acceptance criteria on Layer 3 compliance + overrides.spec's 25 parity/behavior specs from 04-01). Plan 04-03 will add panel-interaction tests.
- `npx electron-vite build` green end-to-end: main 23.96 kB CJS + preload 0.68 kB CJS + renderer 592.20 kB JS + 20.12 kB CSS (grew from 17 kB with new modal utility classes emitted: `bg-black/40`, `z-50`, `justify-center`, `min-w-[360px]`, etc.).
- `scripts/cli.ts` byte-identical: `git diff --quiet HEAD -- scripts/cli.ts` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/renderer/src/modals/OverrideDialog.tsx — hand-rolled percentage-input modal** — `bb97d72` (feat)
2. **Task 2: Extend AppShell.tsx + both panel Props interfaces — overrides state, three callbacks, dialog render slot** — `ddd7d05` (feat)

**Plan metadata commit:** (final commit below this summary, includes SUMMARY.md + STATE.md + ROADMAP.md updates).

## Files Created/Modified

- `src/renderer/src/modals/OverrideDialog.tsx` (CREATED, 137 lines) — hand-rolled ARIA modal. Header docblock mirrors SearchBar.tsx convention (one-liner phase/plan + UX-refinement bullets + Layer 3 note). Imports only `useEffect, useRef, useState, type KeyboardEvent` from 'react'. Zero core imports. Zero forbidden `font-medium` / weight-500 anywhere.
- `src/renderer/src/components/AppShell.tsx` (MODIFIED, 128 → 212 lines, +84 insertions) — header docblock extended with Phase 4 Plan 02 paragraph citing D-74 + D-77 + the Layer 3 renderer-copy rationale. Three new imports: DisplayRow/BreakdownRow from shared types, OverrideDialog, clampOverride from '../lib/overrides-view.js'. Two new useState slots + three new useCallback handlers inserted after the existing focusAnimationName state and before the existing onJumpToAnimation callback. Both panel JSX elements extended with two new props each. New conditional `<OverrideDialog>` JSX block rendered after `</main>`.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MODIFIED, +10 insertions) — `GlobalMaxRenderPanelProps` interface gained two optional members with JSDoc citing Phase 4 Plan 02 + the Plan 04-03 consumption-lands-there note. Panel body unchanged.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (MODIFIED, +7 insertions) — `AnimationBreakdownPanelProps` interface gained two optional members (no `selectedKeys` on the callback — D-90). Panel body unchanged.

## Decisions Made

- **AppShell clampOverride source: `../lib/overrides-view.js` (renderer copy), not `../../../core/overrides.js` (canonical).** The Layer 3 arch grep at `tests/arch.spec.ts` lines 19-34 explicitly rejects the latter. Plan 04-01's inline-duplicate option 1 resolution made the renderer copy available; Plan 04-02's AppShell is the first consumer.
- **Optional Props for panel extensions.** Rather than forcing the panel bodies to consume `overrides` and `onOpenOverrideDialog` in the same commit as the AppShell wiring, both props were declared OPTIONAL in this plan. Plan 04-03 makes them required (or keeps them optional but adds the body consumption). This keeps the typecheck green mid-phase without a forced body rewrite.
- **keyDown handler on the inner panel div, not the input.** Per 04-PATTERNS.md §2 anti-pattern note: `stopPropagation` inside the input's `onKeyDown` breaks Tab focus-trap cycling. The outer overlay handles `onClick={props.onCancel}`; the inner panel stopPropagates click and owns the Enter/Escape keyboard logic. This matches the 04-CONTEXT.md seed sketch exactly.
- **Literal `"override-title"` for `aria-labelledby` + `id`.** No `useId` — only one instance of OverrideDialog can be mounted at a time (AppShell conditionally renders based on `dialogState !== null`). Hard-coded ID matches the seed sketch and the plan's acceptance grep.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's `<action>` block was specific enough that every adjustment noted in Task 1 (keyDown on inner div, explicit KeyboardEvent type, hard-coded `"override-title"` ID, literal button className strings, `onClick={(e) => e.stopPropagation()}` on inner panel body, `Number(inputValue)` raw forward to onApply) was followed verbatim. All Task 2 imports, state declarations, callbacks, JSX changes, and Props interface extensions matched the plan's seeded sketches byte-for-structure.

The pre-existing `scripts/probe-per-anim.ts` TS2339 error is out-of-scope per Plan 04-01's `deferred-items.md` — it reproduces on an unmodified working tree and is not a Phase 4 regression. Both `npx tsc --noEmit -p tsconfig.web.json` and `npx tsc --noEmit -p tsconfig.node.json` (w.r.t. files touched by this plan) are clean.

## Issues Encountered

None. Both tasks passed their verify blocks on first run:
- Task 1: tsc web clean, all 11 grep acceptance checks pass, arch.spec 6/6 green.
- Task 2: tsc web + node clean (pre-existing probe-per-anim out-of-scope), all AppShell/panel grep counts match or exceed required thresholds, arch.spec 6/6, full test 113+1 no regression, electron-vite build green, cli.ts byte-identical.

## User Setup Required

None — no external service configuration needed. (Plan frontmatter `user_setup: []` confirmed.)

## Next Phase Readiness

**Plan 04-03 (Wave 3 — panel wiring + human-verify) unblocked.** The AppShell callback surface is now stable. Plan 04-03 consumes:
- `overrides` prop → read-side for Scale + Peak W×H cell rendering (orange-accent when `overrides.has(row.attachmentName)`).
- `onOpenOverrideDialog` prop → wire to `onDoubleClick` on Scale cells in both panels (Global passes its live `selected` set for D-86 batch detection; AnimationBreakdown passes no selectedKeys — D-90 per-row only).
- `onOpenOverrideDialog` on AnimationBreakdown → also wire to the D-69 reserved Override Scale button (unlock step: remove `disabled`, remove `title="Coming in Phase 4"`, remove `opacity-50 cursor-not-allowed`, add `onClick={() => onOpenOverrideDialog(row)}`).

**Phase 6 export pipeline (future).** The `overrides: Map<string, number>` lives in AppShell state today (renderer-only). Phase 6 export will need to either (a) serialize it over IPC before each export, or (b) move the map into the main process (likely Phase 8's job alongside F5.4 persistence). Plan 04 is out of scope for this decision.

**Downstream caveats:**
- If Plan 04-03 elects to pass `overrides` as a ReadonlyMap into memoized selectors, note that AppShell currently passes the raw Map reference by identity — each `setOverrides` call produces a new Map (via the functional form `setOverrides((prev) => new Map(prev))`), so identity changes correctly trigger re-renders. No WeakMap or stable-reference wrapping needed.
- The dialog's Apply button has `autoFocus={!props.anyOverridden}` — this means the input auto-focus from the useEffect competes with the button's autoFocus on first open for non-overridden rows. Browsers generally resolve this in favor of the later-rendered element (the button). If 04-03's human-verify checkpoint flags this as a UX issue, the fix is to drop the `autoFocus` prop on Apply and rely on the input auto-focus + Enter-to-apply path alone.

## Threat Flags

None. Plan 04-02 introduces no new network endpoints, filesystem access, auth paths, or IPC surfaces. The modal input accepts only a user-typed percent; AppShell's `clampOverride` snaps any non-finite / >100 / <1 input to [1, 100] before the value reaches state (T-04-02-01 mitigation — covered by overrides.spec's 25 specs from 04-01). Title rendering uses React text children (XSS-safe per React's auto-escaping) — T-04-02-02 mitigation confirmed by manual inspection (no `dangerouslySetInnerHTML` anywhere in OverrideDialog.tsx). Session isolation via AppShell unmount-on-new-drop is verified by the existing AppState machine in App.tsx (unchanged this plan) — T-04-02-03 mitigation holds.

## Self-Check: PASSED

Verified artifacts:
- `src/renderer/src/modals/OverrideDialog.tsx` — FOUND (137 lines).
- `src/renderer/src/components/AppShell.tsx` — MODIFIED (now 212 lines; +84 insertions over the 128-line baseline).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — MODIFIED (optional Props extension, panel body untouched).
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — MODIFIED (optional Props extension, panel body untouched).

Verified commits:
- `bb97d72` — FOUND in `git log --oneline`.
- `ddd7d05` — FOUND.

All Task 1 + Task 2 `<acceptance_criteria>` items pass:
- OverrideDialog ≥ 80 lines (actual 137) ✓
- `role="dialog"` count 1 ✓
- `aria-modal="true"` count 1 ✓
- `aria-labelledby` present ✓
- Helper text `Max = 100% (source dimensions)` present ✓
- `type="number"` / `min={1}` / `max={100}` present ✓
- `props.anyOverridden` reference present ✓
- No `core/` import in OverrideDialog ✓
- No `font-medium` ✓
- AppShell `useState<Map<string, number>>` count 1 ✓
- AppShell `dialogState` count 8 (≥5) ✓
- AppShell `onOpenOverrideDialog` count 4 (≥4) ✓
- AppShell `clampOverride(percent)` count 1 ✓
- AppShell `from '../lib/overrides-view` present ✓
- AppShell no core/overrides import ✓
- Both panel Props interfaces have `overrides?: ReadonlyMap` ✓
- `npx tsc --noEmit -p tsconfig.web.json` exits 0 ✓
- `npx tsc --noEmit -p tsconfig.node.json` exits 0 w.r.t. files this plan touched (pre-existing probe-per-anim.ts TS2339 out of scope per deferred-items.md) ✓
- `npm run test -- tests/arch.spec.ts` 6/6 ✓
- `npm run test` 113 passed + 1 skipped (no regression from 04-01 baseline) ✓
- `npx electron-vite build` exits 0 ✓
- `git diff --quiet HEAD -- scripts/cli.ts` exits 0 ✓
- `grep -rE "from ['\"][^'\"]*\/core\/" src/renderer/` empty ✓

---
*Phase: 04-scale-overrides*
*Completed: 2026-04-24*
