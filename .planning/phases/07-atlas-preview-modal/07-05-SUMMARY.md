---
phase: 07-atlas-preview-modal
plan: 05
subsystem: renderer-appshell-panel-wiring
tags: [phase-07, wave-4, renderer, appshell, panel, jump-target, wiring, human-verify]

# Dependency graph
requires:
  - phase: 07-atlas-preview-modal
    plan: 04
    provides: AtlasPreviewModal exported from src/renderer/src/modals/AtlasPreviewModal.tsx with summary + overrides + onJumpToAttachment + onClose + open props
  - phase: 03-animation-breakdown-panel
    provides: D-72 cross-panel jump-target system (focusAnimationName + onFocusConsumed in AnimationBreakdownPanel:299-325) — cloned 1:1 into GlobalMaxRenderPanel as focusAttachmentName + onFocusConsumed
  - phase: 06-optimize-assets-image-export
    provides: D-117 persistent toolbar button entry-point pattern (Optimize Assets in AppShell.tsx top chrome) — Atlas Preview button sits adjacent
provides:
  - src/renderer/src/components/AppShell.tsx — Atlas Preview toolbar button + 2 new state slots (focusAttachmentName, atlasPreviewOpen) + 3 new callbacks (onJumpToAttachment, onFocusAttachmentConsumed, onClickAtlasPreview) + AtlasPreviewModal mount + GlobalMaxRenderPanel prop forwarding
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx — focusAttachmentName + onFocusConsumed optional props; rowRefs Map keyed by row.attachmentName; isFlashing state; jump-target useEffect synchronously consuming focus + scrolling row to center + flashing 900ms
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-panel jump-target consumer pattern: rowRefs = useRef(new Map<string, HTMLElement>()) + registerRowRef(name, el) + useState<string | null> isFlashing + useEffect([focusAttachmentName, onFocusConsumed]) — cloned 1:1 from AnimationBreakdownPanel.tsx:299-325 with attachmentName-keyed adaptations and 'center' scroll block (table rows are shorter than animation cards)."
    - "Synchronous onFocusConsumed?.() inside the same effect tick (RESEARCH §Pitfall 5 — Phase 3 D-66 carry-over): re-opening Atlas Preview with the same attachmentName re-fires the flash because parent's prop transitions null → name → null on the same tick, so the next set fires the dependency change."
    - "Optional jump-target props (focusAttachmentName?: string | null, onFocusConsumed?: () => void) — keeps standalone GlobalMaxRenderPanel tests typechecking without needing to provide jump-target props they don't exercise. Same pattern as Phase 4's overrides + onOpenOverrideDialog optional pair."
    - "Toolbar button cluster: ml-auto flex gap-2 wrapper around Atlas Preview + Optimize Assets buttons. Class string is byte-identical between the two buttons so Tailwind v4 scanner picks up both via literal-class discipline (Pitfall 3)."
    - "Atlas Preview modal lifecycle: plain boolean atlasPreviewOpen + conditional <AtlasPreviewModal /> mount (matches OverrideDialog/OptimizeDialog/ConflictDialog shape — not always-mounted with `open` prop). D-131 snapshot-at-open semantics handled internally by the modal's useMemo on summary + overrides."

key-files:
  created:
    - ".planning/phases/07-atlas-preview-modal/07-05-SUMMARY.md (this file)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (446 → 506 lines, +60)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (717 → 778 lines, +61)"

key-decisions:
  - "block: 'center' for scrollIntoView — table rows are shorter than animation cards; 'start' would clip cells with overflowing content (override percentage badge in the Scale cell, long bone-path tooltip on the Peak W×H cell). The plan explicitly mandated this discipline; the executor honored verbatim."
  - "Per-row ref Map keyed by row.attachmentName, NOT row.attachmentKey. The modal canvas's region.attachmentName is the lookup identity (since AtlasPreviewModal calls onJumpToAttachment with the attachmentName passed verbatim from PackedRegion). This mirrors the Phase 4 Gap-fix A learning that attachmentKey is INTERNAL-SELECTION scope and attachmentName is PANEL-SCOPE identity."
  - "Optional jump-target props on GlobalMaxRenderPanel — focusAttachmentName?: string | null, onFocusConsumed?: () => void. AppShell always passes both, but the optional declaration keeps standalone-render call sites (current test suites, future surfaces) typechecking without tripping the panel's interface."
  - "useCallback deps narrowed to [] for onJumpToAttachment + onFocusAttachmentConsumed + onClickAtlasPreview. React guarantees setState identity is stable; broader deps risk useFocusTrap re-mount cascades inside the modal (RESEARCH Pitfall 8). The existing onJumpToAnimation/onFocusConsumed callbacks already follow this discipline."
  - "Atlas Preview modal mounts conditionally on atlasPreviewOpen (not always-mounted with `open={atlasPreviewOpen}`). Matches OverrideDialog/OptimizeDialog/ConflictDialog shape. The internal useFocusTrap hook accepts the `open` prop and short-circuits when false; combined with conditional mount, the focus-trap re-mount risk is fully avoided (Pitfall 8)."

patterns-established:
  - "Cross-panel jump-target consumer pattern is now PRESENT in BOTH user-facing panels (AnimationBreakdownPanel for animations, GlobalMaxRenderPanel for attachments). The two implementations share: (a) the optional-prop interface, (b) per-id ref Map + register callback, (c) synchronous-consume effect, (d) 900ms flash via setTimeout cleared by clearTimeout, (e) ring-2 ring-accent ring-offset-2 ring-offset-surface flash class. They differ only on: (i) the id basis (cardId vs attachmentName), (ii) the scroll block ('start' for cards, 'center' for table rows). Future panels needing a jump-target consumer can pick from either as a template based on their layout (cards vs table rows)."

requirements-completed: [F7.1, F7.2]

# Metrics
duration: ~14min (Tasks 1-2; Task 3 human-verify pending)
completed: 2026-04-25T19:58:00Z (Tasks 1-2; Task 3 awaits human-verify checkpoint)
---

# Phase 7 Plan 05: AppShell + GlobalMaxRenderPanel jump-target wiring Summary

**Wires Plan 04's AtlasPreviewModal into AppShell with a toolbar button + 2 new state slots + 3 new callbacks + a conditional modal mount + GlobalMaxRenderPanel prop forwarding; ports the Phase 3 D-72 jump-target consumer pattern from AnimationBreakdownPanel.tsx:299-325 verbatim into GlobalMaxRenderPanel with attachmentName keying + 'center' scroll block + synchronous onFocusConsumed?.() + 900ms ring-flash class. Together these enable the canonical "20% glow override" workflow: open Atlas Preview → dblclick a region rect → modal closes → row flashes in Global panel → user double-clicks peak → OverrideDialog opens (existing Phase 4 path).**

## Performance

- **Duration (Tasks 1-2):** ~14 min
- **Started:** 2026-04-25T19:55:00Z (approx — first read of plan)
- **Tasks 1-2 completed:** 2026-04-25T19:58:00Z
- **Task 3 (checkpoint:human-verify):** PENDING — awaits user signoff on 10 visual + workflow gates
- **Files modified:** 2 (src/renderer/src/components/AppShell.tsx, src/renderer/src/panels/GlobalMaxRenderPanel.tsx)
- **Files created:** 1 (this SUMMARY)

## Accomplishments

### Task 1: Port jump-target consumer pattern to GlobalMaxRenderPanel.tsx

Five surgical edits to `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` cloning `AnimationBreakdownPanel.tsx:299-325`:

1. **Edit 1 — Extend `GlobalMaxRenderPanelProps`.** Added two new optional fields at the end of the interface:
   ```ts
   focusAttachmentName?: string | null;
   onFocusConsumed?: () => void;
   ```

2. **Edit 2 — Add per-row ref Map + isFlashing state + jump-target effect.** Inside the component body, between `suppressNextChangeRef` and the `enriched` useMemo:
   - `rowRefs = useRef(new Map<string, HTMLElement>())` keyed by `row.attachmentName`
   - `registerRowRef(name, el)` callback (delete on null, set otherwise)
   - `isFlashing = useState<string | null>(null)`
   - `useEffect([focusAttachmentName, onFocusConsumed])` body:
     - Early-return if `!focusAttachmentName`
     - `setIsFlashing(focusAttachmentName)`
     - Lookup ref, `scrollIntoView({ behavior: 'smooth', block: 'center' })`
     - `onFocusConsumed?.()` SYNCHRONOUSLY (Pitfall 5)
     - `setTimeout(() => setIsFlashing(null), 900)` with `clearTimeout` cleanup

3. **Edit 3 — Pass `isFlashing` + `registerRef` to each `<Row />`.** New props `isFlashing={isFlashing === row.attachmentName}` + `registerRef={(el) => registerRowRef(row.attachmentName, el)}`.

4. **Edit 4 — Extend `RowProps`.** Added `isFlashing: boolean` + `registerRef: (el: HTMLElement | null) => void`.

5. **Edit 5 — Wire ref + flash class onto `<tr>`.** `ref={(el) => registerRef(el)}` + clsx-conditional `isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface'` (verbatim class string from AnimationBreakdownPanel.tsx:407).

**Verification:** `npm run typecheck:web` exits 0. `npm run test` exits 0 (239 passed | 1 skipped | 1 todo). All acceptance greps pass:
- `focusAttachmentName?: string | null` present
- `onFocusConsumed?: () => void` present
- `rowRefs = useRef(new Map` present
- `registerRowRef` present
- `setIsFlashing` present
- `block: 'center'` present
- `onFocusConsumed?.()` present (synchronous-consume)
- `ring-2 ring-accent ring-offset-2 ring-offset-surface` present
- NO `setTimeout(.*onFocusConsumed` (defense — onFocusConsumed not wrapped in setTimeout)

**Commit:** `16b99b9` — `feat(07-05): port jump-target consumer pattern to GlobalMaxRenderPanel`

### Task 2: Wire AppShell toolbar button + state + modal mount + Global panel prop forwarding

Six surgical edits to `src/renderer/src/components/AppShell.tsx`:

1. **Edit 1 — Add the import.** `import { AtlasPreviewModal } from '../modals/AtlasPreviewModal';` added alongside existing modal imports (OverrideDialog, OptimizeDialog, ConflictDialog).

2. **Edit 2 — Two new state slots.** After existing `focusAnimationName`:
   ```ts
   const [focusAttachmentName, setFocusAttachmentName] = useState<string | null>(null);
   const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
   ```

3. **Edit 3 — Three new callbacks.** After existing `onFocusConsumed`:
   - `onJumpToAttachment(name)` — three-write sequence: `setActiveTab('global')` + `setFocusAttachmentName(name)` + `setAtlasPreviewOpen(false)`. `useCallback([])` because all three setters are stable.
   - `onFocusAttachmentConsumed()` — `setFocusAttachmentName(null)` (sync-consume pair). `useCallback([])`.
   - `onClickAtlasPreview()` — `setAtlasPreviewOpen(true)`. `useCallback([])`.

4. **Edit 4 — Toolbar button cluster.** Wrapped the existing `<div className="ml-auto">` around the Optimize Assets button into `<div className="ml-auto flex gap-2">` and inserted the Atlas Preview button immediately LEFT of it (D-134). Class string is byte-identical to Optimize Assets (Tailwind v4 literal-class scanner discipline).

5. **Edit 5 — Forward props to GlobalMaxRenderPanel.** Added `focusAttachmentName={focusAttachmentName}` + `onFocusConsumed={onFocusAttachmentConsumed}` to the existing `<GlobalMaxRenderPanel ... />` mount. All existing props preserved.

6. **Edit 6 — Mount the modal.** Conditional mount at the end of the modal cluster (after ConflictDialog):
   ```tsx
   {atlasPreviewOpen && (
     <AtlasPreviewModal
       open={true}
       summary={summary}
       overrides={overrides}
       onJumpToAttachment={onJumpToAttachment}
       onClose={() => setAtlasPreviewOpen(false)}
     />
   )}
   ```

**Verification:** `npm run typecheck:web` exits 0. `npm run test` exits 0 (239 passed). `npx electron-vite build` exits 0 (renderer bundle: 669.48 kB JS + 23.42 kB CSS). All acceptance greps pass:
- `import { AtlasPreviewModal } from '../modals/AtlasPreviewModal'` present
- 2 × `useState<string | null>(null)` (focusAnimationName preserved + new focusAttachmentName)
- `atlasPreviewOpen`, `setAtlasPreviewOpen`, `setFocusAttachmentName` all present
- `onJumpToAttachment`, `onClickAtlasPreview`, `onFocusAttachmentConsumed` all present
- Atlas Preview button label literal present (multi-line JSX form same as Optimize Assets — `>Atlas Preview<` not present in single-line form because both buttons follow the multi-line pattern; functional equivalence verified)
- `focusAttachmentName={focusAttachmentName}` panel prop forwarding present
- `<AtlasPreviewModal` mount present
- `summary.peaks.length === 0` disabled-when-no-peaks present (twice — both Atlas Preview and Optimize Assets buttons)
- `onJumpToAnimation` existing Phase 3 callback preserved

**Commit:** `b1ace83` — `feat(07-05): wire Atlas Preview toolbar button + modal mount`

### Task 3: Human-verify — full Atlas Preview workflow on real fixtures

**STATUS:** PENDING. Returned as `checkpoint:human-verify` to the orchestrator. The user will run `npm run dev`, drop SIMPLE_TEST.json, and walk the 10 gates from the plan's `<how-to-verify>` block.

**Gates to verify:**
- Gate 1: Toolbar button visibility + disabled state (D-134) — PENDING
- Gate 2: Default view on open (D-135 + D-128) — PENDING
- Gate 3: Canvas renders actual region pixels (F7.1) — PENDING
- Gate 4: Hover-reveal of fill + label (D-129) — PENDING
- Gate 5: Mode + resolution toggles re-render projection (F7.1 / F7.2) — PENDING
- Gate 6: Pager bounds-disable (D-128) — PENDING
- Gate 7: Dblclick-jump UX, the canonical "20% glow override" workflow (D-130) — PENDING
- Gate 8: Snapshot-at-open semantics (D-131) — PENDING
- Gate 9: Missing-source UX (D-137) — PENDING
- Gate 10: Phase 0/3/4/5/6 regressions — PENDING

The continuation agent will record gate signoffs and any deviations from the human-verify session.

## Deviations from Plan

**None for Tasks 1-2.** Both tasks executed exactly as written: 5 surgical edits to GlobalMaxRenderPanel.tsx + 6 surgical edits to AppShell.tsx, all verbatim from the plan's `<action>` blocks. No bugs found, no missing critical functionality, no blocking issues. The full automated verification suite (typecheck:web + test + electron-vite build) is green.

## Verification

- `npm run typecheck:web` — PASS (exits 0)
- `npm run test` — PASS (239 passed | 1 skipped | 1 todo across 17 test files; full Phase 0-6 suite + Phase 7 core spec + Phase 7 modal spec all green)
- `npx electron-vite build` — PASS (main 41.55 kB + preload 3.68 kB + renderer 669.48 kB JS + 23.42 kB CSS, .dmg-ready artifacts)
- `git diff a34a3f4 -- scripts/cli.ts` — EMPTY (CLI byte-for-byte lock D-102 honored)
- `git diff a34a3f4 -- src/core/sampler.ts` — EMPTY (CLAUDE.md rule #3 — sampler tick lifecycle untouched)

## Threat Mitigations Applied

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-07-05-jump-target-leak | mitigate | DONE — `onFocusConsumed?.()` is called SYNCHRONOUSLY inside the same effect tick (no setTimeout/RAF wrapping). `setTimeout(setIsFlashing(null), 900)` is wrapped in `clearTimeout` cleanup. Acceptance grep `! grep -E "setTimeout(.*onFocusConsumed"` enforced. |
| T-07-05-prop-drift | mitigate | DONE — TypeScript optional props (`focusAttachmentName?: string | null` + `onFocusConsumed?: () => void`); typecheck:web confirms forwarding shape (`focusAttachmentName={focusAttachmentName}` + `onFocusConsumed={onFocusAttachmentConsumed}` on the GlobalMaxRenderPanel mount block matches the panel's interface). |
| T-07-05-modal-leakage | accept | NOOP — AppShell unmounts on every drop (idle → loading transition), resetting atlasPreviewOpen + focusAttachmentName implicitly. Same pattern as activeTab / overrides reset (existing). |
| T-07-05-flash-class-tampering | mitigate | DONE — clsx with literal branches: `isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface'`. Tailwind v4 literal-class discipline. Acceptance grep verified the exact class string is present. |

## Self-Check: PASSED

- File `.planning/phases/07-atlas-preview-modal/07-05-SUMMARY.md` written.
- Commit `16b99b9` (Task 1) verified: `git log --oneline | grep 16b99b9` → present.
- Commit `b1ace83` (Task 2) verified: `git log --oneline | grep b1ace83` → present.
- Task 3 returned as `checkpoint:human-verify` per plan's `autonomous: false` declaration.
