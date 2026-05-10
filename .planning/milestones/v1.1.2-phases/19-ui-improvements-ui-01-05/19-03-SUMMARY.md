---
phase: 19
plan: 03
subsystem: renderer-shell-sticky-header
tags: [sticky-header, state-lift, cross-nav-wiring, wave-3-hub]
status: complete
requires:
  - "Plan 19-01 — foundation tokens + helper + bytesOnDisk?: number (independent of this plan)"
  - "Plan 19-02 — main-side bytesOnDisk writer (independent of this plan)"
  - "Existing AppShell.tsx <header> at line 1090 + atlasPreviewOpen modal-lifecycle slot at line 158 + onClickOptimize callback at line 459"
  - "Existing SearchBar component at src/renderer/src/components/SearchBar.tsx (reused verbatim per D-04)"
  - "Existing OptimizeDialog + AtlasPreviewModal mount sites in AppShell"
provides:
  - "Sticky <header> with position: sticky, top-0 z-20 (D-20) — single sticky surface; banner rows below remain non-sticky and scroll with content"
  - "Load-summary card with verbatim UI-01 wording + literal 1 cadence — `1 skeletons | 1 atlases | {effectiveSummary.attachments.count} regions` (D-01 + orchestrator's revision-pass lock)"
  - "Documentation placeholder button — disabled, aria-disabled='true', title='Available in v1.2 Phase 20' (D-03)"
  - "Filled-primary Optimize Assets CTA (D-17) — only filled-primary in the sticky header per accent reservation policy"
  - "6-button right cluster in D-19 order with items-center vertical alignment for SearchBar"
  - "Lifted query state slot in AppShell (D-04) — single source of truth feeding the sticky-bar SearchBar + threaded as query/onQueryChange props to both panels"
  - "Interim OPTIONAL panel-prop posture (query?: string + onQueryChange?: (q: string) => void on both GlobalMaxRenderPanelProps + AnimationBreakdownPanelProps) — Wave 3 TypeScript-clean baseline"
  - "Cross-nav handler wiring at modal mount sites (D-11 prerequisite): onOpenAtlasPreview={() => setAtlasPreviewOpen(true)} on OptimizeDialog mount; onOpenOptimizeDialog={onClickOptimize} on AtlasPreviewModal mount (function-reference passing — re-runs full async output-picker + plan-builder flow on cross-nav)"
  - "Pre-emptive interim OPTIONAL cross-nav prop types on both modal interfaces (option (b) per plan): onOpenAtlasPreview?: () => void on OptimizeDialogProps; onOpenOptimizeDialog?: () => void on AtlasPreviewModalProps"
affects:
  - "Plan 19-04 (GlobalMaxRenderPanel card-layout + row coloring + MB-savings callout) — will tighten the panel's query?: string → query: string + remove the panel-internal useState('') slot + remove the panel-internal <SearchBar> element"
  - "Plan 19-05 (AnimationBreakdownPanel card-layout + row coloring) — same tightening as 19-04 on the panel side"
  - "Plan 19-06 (OptimizeDialog summary tiles + cross-nav button) — will consume the locked prop name onOpenAtlasPreview verbatim and tighten its type to REQUIRED"
  - "Plan 19-07 (AtlasPreviewModal summary tiles + cross-nav button) — will consume the locked prop name onOpenOptimizeDialog verbatim and tighten its type to REQUIRED"
tech-stack:
  added: []
  patterns:
    - "position: sticky on flex-sibling <header> outside the <main className='flex-1 overflow-auto'> scroll container (D-20 containment proof from UI-SPEC §1)"
    - "Verbatim filled-primary CTA class string reused from OptimizeDialog.tsx:323 + UI-SPEC §10 amendment (transition-colors + disabled:cursor-not-allowed) — D-17"
    - "Verbatim outlined-secondary class string from AppShell.tsx:1165 — D-18 (Documentation button reuses with disabled state)"
    - "State-lift / prop-drill pattern (analog: AppShell.tsx:158 atlasPreviewOpen lifecycle) — query state mirrored next to the sibling lifecycle slot"
    - "Function-reference cross-nav binding (no extra arrow wrap) for AtlasPreviewModal.onOpenOptimizeDialog — reuses AppShell's existing onClickOptimize useCallback at line 459 verbatim"
    - "Interim OPTIONAL prop posture pattern — keeps TypeScript clean at every wave boundary; downstream plans tighten to REQUIRED when removing legacy code paths"
key-files:
  created: []
  modified:
    - "src/renderer/src/components/AppShell.tsx (sticky header, load-summary card, Documentation button, filled-primary CTA, SearchBar import, query state lift, cross-nav prop wiring on both modal mounts)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (interim optional query?: string + onQueryChange?: prop type only — body wiring deferred to Plan 19-04)"
    - "src/renderer/src/panels/AnimationBreakdownPanel.tsx (interim optional query?: string + onQueryChange?: prop type only — body wiring deferred to Plan 19-05)"
    - "src/renderer/src/modals/OptimizeDialog.tsx (interim optional onOpenAtlasPreview?: () => void prop type only — modal-side button rendering deferred to Plan 19-06)"
    - "src/renderer/src/modals/AtlasPreviewModal.tsx (interim optional onOpenOptimizeDialog?: () => void prop type only — modal-side button rendering deferred to Plan 19-07)"
decisions:
  - "Use effectiveSummary.attachments.count (not summary.attachments.count) for the load-summary card's regions slot — matches the rig-info tooltip's existing identifier pattern at AppShell.tsx:1126-1128"
  - "Skeletons literal 1 + atlases literal 1 — orchestrator's revision-pass lock; STM is single-skeleton-per-project + single-atlas-per-skeleton; UI-01 wording is plural even when N=1 (locked surface wording)"
  - "Pre-emptive option (b) on Task 3 — added optional prop type definitions to both modal interfaces inside this plan so npx tsc --noEmit stays green throughout Wave 3 baseline; Plans 19-06/19-07 tighten to REQUIRED"
  - "Tasks 1-3 committed atomically with explicit task scope boundaries (Task 1's commit excludes the query state slot — that's Task 2's scope; transient TS errors after Task 1 are accepted per plan)"
  - "AtlasPreviewModal cross-nav binding is a function-reference (onOpenOptimizeDialog={onClickOptimize}) NOT a wrapped arrow — preserves single-source-of-truth for the async output-picker + plan-builder flow at AppShell.tsx:459; user re-picks output dir on cross-nav (acceptable phase-scope behaviour per orchestrator's lock)"
metrics:
  duration_minutes: 8
  tasks_completed: 3
  tasks_pending_user_action: 1
  completed_date: "in-progress (Task 4 checkpoint awaiting user dev-mode smoke verification)"
---

# Phase 19 Plan 03: Wave 3 Hub — Sticky Header + State Lift + Cross-Nav Wiring (IN PROGRESS — Task 4 checkpoint)

Wave 3 hub plan converting the existing AppShell.tsx `<header>` into the new sticky bar with load-summary card + Documentation placeholder + reordered button cluster + filled-primary Optimize CTA + lifted SearchBar query state + cross-nav handler wiring on both modal mounts. **Tasks 1-3 are committed atomically; Task 4 is a `checkpoint:human-verify` gate awaiting user dev-mode smoke verification.**

## Tasks Completed (1-3)

| Task | Name                                                                                                                       | Commit  | Files                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Sticky header chrome + load-summary card + Documentation placeholder + filled-primary Optimize CTA                          | de492d0 | src/renderer/src/components/AppShell.tsx                                                                                                                                                    |
| 2    | Lift query state to AppShell + thread to both panels with interim optional props                                            | e6d4b63 | src/renderer/src/components/AppShell.tsx, src/renderer/src/panels/GlobalMaxRenderPanel.tsx, src/renderer/src/panels/AnimationBreakdownPanel.tsx                                              |
| 3    | Wire cross-nav handlers + interim optional prop types on both modals                                                        | cecc058 | src/renderer/src/components/AppShell.tsx, src/renderer/src/modals/OptimizeDialog.tsx, src/renderer/src/modals/AtlasPreviewModal.tsx                                                          |

## Tasks Pending (4)

| Task | Name                                                                                                | Type                       | Awaiting                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 4    | Dev-mode smoke check — sticky header + Documentation placeholder + Optimize CTA visual              | checkpoint:human-verify    | User runs `npm run dev`, opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, completes the 10-step verify protocol  |

The Task 4 checkpoint payload is returned to the orchestrator. A continuation agent will land a docs commit acknowledging dev-mode smoke approval + finalize this SUMMARY.md once the user signs off.

## What Landed (Tasks 1-3)

### Task 1 — Sticky header chrome + load-summary card + Documentation placeholder + filled-primary CTA (commit `de492d0`)

Six in-file edits inside `src/renderer/src/components/AppShell.tsx`:

- **Edit A — SearchBar import.** Added `import { SearchBar } from './SearchBar';` to the top-of-file import block.
- **Edit B — Sticky-position the `<header>`.** Prefixed the existing `<header>` className at line 1090 with `sticky top-0 z-20`. D-20 containment per UI-SPEC §1: `position: sticky` works because `<header>` is a flex sibling of `<main className="flex-1 overflow-auto">` (the scroll container at line 1279), NOT nested inside it. Banner rows at 1204 / 1222 / 1253 stay non-sticky per D-02 (single sticky surface). `bg-panel` solid; no `backdrop-blur`.
- **Edit C — Load-summary card.** Inserted a new `<div aria-label="Load summary">` with the verbatim UI-01 wording (literal `1` for skeletons + atlases per D-01 + orchestrator's revision-pass lock; `effectiveSummary.attachments.count` for regions). Sits between the rig-info filename chip block (closes at line 1135) and the tab strip (`<nav role="tablist">`). One-line code comment `STM is single-skeleton-per-project; literal 1 matches the atlases cadence` is present per orchestrator's revision-pass fix.
- **Edit D — Right cluster + items-center.** Changed `<div className="ml-auto flex gap-2">` to `<div className="ml-auto flex items-center gap-2">` for SearchBar vertical alignment with the buttons.
- **Edit E — SearchBar in cluster.** Inserted `<SearchBar value={query} onChange={setQuery} />` as the first child of the right cluster. (Note: the `query`/`setQuery` state slot is added in Task 2 per plan's task boundary; Task 1 produces transient TS errors that resolve after Task 2 — accepted per plan.)
- **Edit F — Documentation placeholder button.** Inserted disabled outlined-secondary button between Atlas Preview and Optimize Assets, with `aria-disabled="true"` + `title="Available in v1.2 Phase 20"` (D-03 + UI-SPEC §10). Class string is byte-for-byte identical to D-18 outlined-secondary (including the `disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent` triplet that neutralizes hover/active feedback when disabled).
- **Edit G — Optimize Assets filled-primary.** Replaced the Optimize Assets button's className with the D-17 filled-primary string `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`. Preserved verbatim: button's `type`, `onClick`, `disabled` props, and child text content. This is the only filled-primary in the sticky header (10% accent surface budget per UI-SPEC §"Accent reservation policy").

Final right cluster order matches D-19: `Search | Atlas Preview | Documentation | Optimize Assets | Save | Open`.

CLAUDE.md fact #1 wording at AppShell.tsx:1131 (`skeleton.fps: ${editorFps} (editor metadata — does not affect sampling)`) preserved byte-for-byte.

### Task 2 — Lifted query state + panel prop threading + interim optional posture (commit `e6d4b63`)

Three edits across three files:

- **Edit A — Lifted `query` state slot in AppShell.** Added `const [query, setQuery] = useState('');` immediately after the existing `atlasPreviewOpen` modal-lifecycle slot at line 158. Comment cadence mirrors the Phase 7 D-134 sibling slot (`Phase 19 UI-01 + D-04 — NEW: panel filter query lifted up...`).
- **Edit B — Thread `query` + `onQueryChange` props down to both panels.** Added `query={query}` + `onQueryChange={setQuery}` to both `<GlobalMaxRenderPanel ... />` and `<AnimationBreakdownPanel ... />` render sites. All other existing props preserved verbatim.
- **Edit C — Interim OPTIONAL panel-prop posture.** Added `query?: string` + `onQueryChange?: (q: string) => void` to both `GlobalMaxRenderPanelProps` and `AnimationBreakdownPanelProps`. The fields are OPTIONAL (with `?`) at this wave — Plans 19-04 + 19-05 will tighten to REQUIRED when removing the panel-internal `useState('')` slots and panel-internal `<SearchBar>` elements. JSDoc comments cite the planner-cadence rationale (`Phase 19 UI-01 + D-04`).

Result: `npx tsc --noEmit` exits 0 at the end of Task 2. Sticky-bar SearchBar drives both panel render sites from a single source of truth in AppShell.

### Task 3 — Cross-nav handler wiring + pre-emptive optional prop types on both modals (commit `cecc058`)

Three edits across three files:

- **Edit A — `onOpenAtlasPreview` cross-nav binding on OptimizeDialog mount.** Added `onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}` as the new last prop on the `<OptimizeDialog ... />` mount inside the `exportDialogState !== null && (...)` branch in AppShell. Verbatim per orchestrator's revision-pass lock. Per D-11 sequential mount: the modal-side button (added in Plan 19-06) will call `props.onClose()` FIRST, THEN `props.onOpenAtlasPreview()` — `useFocusTrap` cleanup runs on OptimizeDialog's unmount before AtlasPreviewModal's mount calls its own trap.
- **Edit B — `onOpenOptimizeDialog` cross-nav binding on AtlasPreviewModal mount.** Added `onOpenOptimizeDialog={onClickOptimize}` as the new last prop on the `<AtlasPreviewModal ... />` mount inside the `atlasPreviewOpen && (...)` branch in AppShell. Verbatim per orchestrator's revision-pass lock. **Function-reference passing** — the existing `onClickOptimize` callback at AppShell.tsx:459 is passed directly (NOT wrapped in an extra arrow function, NOT called eagerly). Re-invokes the full async output-picker + plan-builder flow on cross-nav; the user re-picks the output directory (acceptable phase-scope behaviour per orchestrator's lock — fixes checker BLOCKER 1).
- **Edit C — Pre-emptive optional prop type definitions on both modal interfaces (option (b)).** Added `onOpenAtlasPreview?: () => void` to `OptimizeDialogProps` (after the existing `onConfirmStart?` field) and `onOpenOptimizeDialog?: () => void` to `AtlasPreviewModalProps` (after the existing `onClose` field). Both are OPTIONAL at this wave — Plans 19-06/19-07 will tighten to REQUIRED when adding the modal-side cross-nav buttons that consume `props.onOpenAtlasPreview()` / `props.onOpenOptimizeDialog()` respectively. JSDoc comments cite the D-11 sequential-mount rationale + the orchestrator's locked function-reference binding rationale.

Result: `npx tsc --noEmit` exits 0 at the end of Task 3. The Wave 3 baseline is TypeScript-clean throughout. Locked prop names (`onOpenAtlasPreview`, `onOpenOptimizeDialog`) are now visible in both `Props` interfaces — Plans 19-06/19-07 must consume these exact identifiers when adding the modal-side button rendering.

## Verification (post-Task-3)

All plan-level acceptance gates green at end of Task 3 except one gate-string anomaly (documented as deviation below):

| Gate                                                                                                                    | Result                                |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `grep -F 'sticky top-0 z-20' src/renderer/src/components/AppShell.tsx`                                                  | PASS                                  |
| `grep -F 'aria-label="Load summary"' src/renderer/src/components/AppShell.tsx`                                          | PASS                                  |
| `grep -F '<span className="text-fg font-semibold">1</span> skeletons' src/renderer/src/components/AppShell.tsx`         | PASS                                  |
| `grep -F '<span className="text-fg font-semibold">1</span> atlases' src/renderer/src/components/AppShell.tsx`           | PASS                                  |
| `grep -F '} regions</span>' src/renderer/src/components/AppShell.tsx`                                                   | DOES NOT MATCH (gate string anomaly — see deviation note) |
| `grep -F 'STM is single-skeleton-per-project' src/renderer/src/components/AppShell.tsx`                                 | PASS                                  |
| `grep -F 'Available in v1.2 Phase 20' src/renderer/src/components/AppShell.tsx`                                         | PASS                                  |
| `grep -F 'aria-disabled="true"' src/renderer/src/components/AppShell.tsx`                                               | PASS                                  |
| `grep -F 'bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed' src/renderer/src/components/AppShell.tsx` | PASS  |
| `grep -F 'ml-auto flex items-center gap-2' src/renderer/src/components/AppShell.tsx`                                    | PASS                                  |
| `grep -E "import \{ SearchBar \} from './SearchBar'" src/renderer/src/components/AppShell.tsx`                          | PASS                                  |
| `grep -F 'editor metadata — does not affect sampling' src/renderer/src/components/AppShell.tsx`                          | PASS                                  |
| `grep -E "from ['\"].*src/core" src/renderer/src/components/AppShell.tsx` returns nothing                                | PASS (Layer 3 invariant preserved)    |
| `grep -F "const [query, setQuery] = useState('');" src/renderer/src/components/AppShell.tsx`                            | PASS                                  |
| `grep -cE 'query=\{query\}' src/renderer/src/components/AppShell.tsx` returns 2                                          | PASS (≥2 threshold met)               |
| `grep -cE 'onQueryChange=\{setQuery\}' src/renderer/src/components/AppShell.tsx` returns 2                               | PASS (≥2 threshold met)               |
| `grep -F 'value={query}' src/renderer/src/components/AppShell.tsx`                                                       | PASS                                  |
| `grep -F 'atlasPreviewOpen, setAtlasPreviewOpen' src/renderer/src/components/AppShell.tsx`                               | PASS (existing slot preserved verbatim) |
| `grep -F 'query?: string' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                              | PASS                                  |
| `grep -F 'query?: string' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                           | PASS                                  |
| `grep -F 'onQueryChange?:' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                             | PASS                                  |
| `grep -F 'onQueryChange?:' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                          | PASS                                  |
| `grep -F 'onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}' src/renderer/src/components/AppShell.tsx`               | PASS                                  |
| `grep -F 'onOpenOptimizeDialog={onClickOptimize}' src/renderer/src/components/AppShell.tsx`                              | PASS                                  |
| `grep -F 'onOpenAtlasPreview?: () => void' src/renderer/src/modals/OptimizeDialog.tsx`                                   | PASS                                  |
| `grep -F 'onOpenOptimizeDialog?: () => void' src/renderer/src/modals/AtlasPreviewModal.tsx`                              | PASS                                  |
| `npx tsc --noEmit`                                                                                                       | PASS (exits 0)                        |
| `npm test -- tests/arch.spec.ts` (Layer 3 grep gate)                                                                     | PASS (12/12)                          |
| Dev-mode smoke (Task 4)                                                                                                  | PENDING — awaiting user verification  |

## Deviations from Plan

### Rule 3 — Plan acceptance gate string anomaly (informational; no code change)

**Found during:** Task 1 verification.

**Issue:** The plan's Task 1 acceptance criterion `grep -F '} regions</span>' src/renderer/src/components/AppShell.tsx` does not match the locked verbatim JSX from UI-SPEC §2 / plan Edit C. The JSX (verbatim from the plan) is:

```tsx
<span><span className="text-fg font-semibold">{effectiveSummary.attachments.count}</span> regions</span>
```

The character sequence after `count` is `}` then `</span>` then ` regions` then `</span>`. The substring `} regions</span>` (with `}` directly followed by ` regions`) never appears in this JSX shape because the inner closing `</span>` separates them. The same cadence applies to the skeletons + atlases lines (gates 3 and 4 both pass because the literal `1` is inside the inner span and ` skeletons` / ` atlases` follows the inner closing span). The regions gate would only pass for code like `{count} regions</span>` (no inner-span wrap) — which contradicts the locked JSX shape that wraps the count in `<span className="text-fg font-semibold">…</span>` for visual emphasis.

**Fix:** No code change. The JSX is byte-for-byte identical to UI-SPEC §2 + plan Edit C. The gate string is an authoring quirk in the plan (likely a typo where the inner `</span>` was omitted from the gate). Substituted with `grep -F 'count}</span> regions</span>'` for verification — passes.

**Files modified:** None.

**Commit:** N/A (gate-string deviation only).

### Rule 2 — Used `effectiveSummary` (not `summary`) for the load-summary card's regions count (intentional; matches established pattern)

**Found during:** Task 1 Edit C.

**Issue:** Plan Edit C body shows `{summary.attachments.count}` but notes "Verify the variable `summary` is in scope at the insertion point... If `summary` is named differently (e.g. `effectiveSummary`), substitute the correct identifier — pull it from the same scope used by the existing rig-info tooltip at AppShell.tsx:1099-1135 which already shows skin/attachment counts."

**Fix:** Used `effectiveSummary.attachments.count` (matching the rig-info tooltip's identifier at AppShell.tsx:1126-1128). This is the override-aware effective summary that already drives every chrome surface in AppShell that displays attachment counts. Plan explicitly authorizes the substitution.

**Files modified:** src/renderer/src/components/AppShell.tsx (Task 1).

**Commit:** de492d0.

### Rule 3 — Pre-emptive option (b) on Task 3 (intentional; explicitly authorized by plan)

**Found during:** Task 3.

**Issue:** Cross-nav prop bindings reference prop names (`onOpenAtlasPreview`, `onOpenOptimizeDialog`) that don't yet exist on `OptimizeDialogProps` / `AtlasPreviewModalProps`. The plan explicitly authorizes either (a) accepting transient TS errors and running 19-06/19-07 immediately after, or (b) pre-emptively adding the prop types as OPTIONAL inside this plan. The planner's preference is (b) "to keep the Wave 3 baseline TypeScript-clean".

**Fix:** Selected option (b). Added `onOpenAtlasPreview?: () => void` to `OptimizeDialogProps` and `onOpenOptimizeDialog?: () => void` to `AtlasPreviewModalProps`. Plans 19-06/19-07 will tighten to REQUIRED.

**Files modified:** src/renderer/src/modals/OptimizeDialog.tsx, src/renderer/src/modals/AtlasPreviewModal.tsx (Task 3).

**Commit:** cecc058.

## Authentication Gates

None — Plan 19-03 is renderer-only chrome work; no auth surface touched.

## Task 4 Checkpoint Status

**Type:** `checkpoint:human-verify`
**Reason:** UI-01 sticky-scroll behavior, UI-05 button hierarchy contrast, and the Documentation placeholder tooltip are visual/interaction claims with no automated test surface in this codebase (CLAUDE.md notes no Electron headless harness). Dev-mode smoke is the test surface.

**What needs to happen:**
1. User runs `npm run dev` from project root.
2. Opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.
3. Walks the 10-step verify protocol from plan §`<how-to-verify>`.
4. Approves (or rejects with specific failure description).
5. Continuation agent lands a docs-only commit acknowledging dev-mode smoke approval + appends a final "## Dev-Mode Smoke Approval" section to this SUMMARY.md.

This SUMMARY.md is **not yet finalized** — the continuation agent will:
- Append a `## Dev-Mode Smoke Approval` section with date + sign-off.
- Update `status` frontmatter from `in-progress-at-task-4-checkpoint` to a complete value.
- Update `metrics.completed_date` from `in-progress (...)` to the actual completion date.
- Append a `## Self-Check: PASSED` section verifying all four commits exist + all five modified files exist.

## Hand-off Notes for Downstream Plans

- **Plans 19-04 + 19-05 (panel card-layout + row coloring + MB callout):**
  - Tighten the panel's `query?: string` → `query: string` and `onQueryChange?: (q: string) => void` → `onQueryChange: (q: string) => void` in the panel's Props interface when removing the panel-internal `useState('')` slot.
  - Remove the panel-internal `<SearchBar>` element (currently at GlobalMaxRenderPanel.tsx:708 and AnimationBreakdownPanel.tsx:343 per 19-PATTERNS.md analysis).
  - Replace internal `query` references with `props.query` and internal `setQuery` references with `props.onQueryChange`.
  - The lifted state in AppShell is the single source of truth — there is no longer any panel-internal `useState('')` slot to mirror.

- **Plan 19-06 (OptimizeDialog summary tiles + cross-nav button):**
  - Tighten `onOpenAtlasPreview?: () => void` → `onOpenAtlasPreview: () => void` on `OptimizeDialogProps`.
  - Render the cross-nav button at footer LEFT per UI-SPEC §9 (verbatim outlined-secondary class string from D-18). The button's onClick MUST call `props.onClose()` FIRST then `props.onOpenAtlasPreview()` (D-11 sequential mount).
  - Flip footer container className from `flex gap-2 mt-6 justify-end` to `flex gap-2 mt-6 justify-between`; wrap existing right-cluster actions in their own `<div className="flex gap-2">`.

- **Plan 19-07 (AtlasPreviewModal summary tiles + cross-nav button):**
  - Tighten `onOpenOptimizeDialog?: () => void` → `onOpenOptimizeDialog: () => void` on `AtlasPreviewModalProps`.
  - Render the cross-nav button at footer LEFT per UI-SPEC §9. The button's onClick MUST call `props.onClose()` FIRST then `props.onOpenOptimizeDialog()` (D-11 sequential mount; AppShell's `onClickOptimize` re-runs the full async output-picker + plan-builder flow).
  - Modify the existing footer disclaimer at AtlasPreviewModal.tsx:239-241 to a `flex justify-between items-center` row containing the cross-nav button on the left + the existing disclaimer on the right.

## Self-Check (Tasks 1-3 only — Task 4 self-check appended by continuation agent)

Verified files exist + were modified per task scope:
- FOUND: `src/renderer/src/components/AppShell.tsx` (modified in Tasks 1, 2, 3)
- FOUND: `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (modified in Task 2)
- FOUND: `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (modified in Task 2)
- FOUND: `src/renderer/src/modals/OptimizeDialog.tsx` (modified in Task 3)
- FOUND: `src/renderer/src/modals/AtlasPreviewModal.tsx` (modified in Task 3)

Verified commits exist on `worktree-agent-a365c82b50d8fc94c` branch:
- FOUND: `de492d0` — feat(19-03): sticky header chrome + load-summary card + Documentation placeholder + filled-primary Optimize CTA
- FOUND: `e6d4b63` — feat(19-03): lift query state to AppShell + thread to both panels with interim optional props
- FOUND: `cecc058` — feat(19-03): wire cross-nav handlers + interim optional prop types on both modals

Tasks 1-3 self-check: PASSED.

## Dev-Mode Smoke Approval

**Date:** 2026-05-01
**Result:** Approved with caveats deferred to Wave 4

User ran `npm run dev`, opened `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (149 regions, 75 attachments), and walked the 10-step verify protocol.

**Steps 1-9: PASS** — sticky header pinned during scroll; load-summary card shows `1 skeletons | 1 atlases | 149 regions`; rig-info tooltip wording preserved; right-cluster order correct (Filter | Atlas Preview | Documentation | Optimize Assets | Save | Open); Optimize Assets renders filled orange; other 4 buttons outlined; Documentation tooltip reads `Available in v1.2 Phase 20` and is unclickable.

**Step 10: FAIL — interim-state regression, expected to self-resolve in Wave 4.**

The sticky-bar SearchBar does not drive the panels because GlobalMaxRenderPanel and AnimationBreakdownPanel still own their internal `useState('')` query slot — the new `query={query}` prop reaches them but is ignored. This is the documented interim posture of Wave 3 (`query?: string` is optional; panels haven't been rewired yet).

Symptoms reported by user (all attributable to interim panel-internal state):
- Per-panel filter clears when switching tabs (each panel's local state resets on unmount).
- Sticky-bar SearchBar typing has no effect on either panel.
- Duplicate SearchBar visible in panel body.

**Disposition:** Approved as-is. Plans 19-04 (Wave 4) and 19-05 (Wave 4) tighten `query?: string` → `query: string`, remove the panel-internal `useState('')` slots, and remove the panel-internal `<SearchBar>` elements — closing all three symptoms by construction.

**New findings outside Plan 19-03 scope (deferred to a follow-up plan after Wave 5):**
- Sticky-bar element heights are not uniform — Untitled chip / load-summary card / SearchBar / button cluster render at slightly different heights. UI-SPEC §1 did not lock a height token. Defer height harmonization to a polish plan after Wave 5.
- Global panel layout shifts horizontally when typing into the panel-internal SearchBar — likely caused by `N selected / N total` cell width change without a stabilizing `min-w-[Xch]` or fixed grid. Defer to the same polish plan. (AnimationBreakdownPanel does not exhibit this — confirms it's a Global-panel-specific layout issue, not a sticky-bar issue.)

## Self-Check: PASSED

All four commits verified on main after worktree merge:
- de492d0 — feat(19-03): sticky header chrome + load-summary card + Documentation placeholder + filled-primary Optimize CTA
- e6d4b63 — feat(19-03): lift query state to AppShell + thread to both panels with interim optional props
- cecc058 — feat(19-03): wire cross-nav handlers + interim optional prop types on both modals
- 73667a3 — docs(19-03): in-progress summary at Task 4 checkpoint

Plan 19-03 complete. Continuing to Wave 4 (19-04 + 19-05).
