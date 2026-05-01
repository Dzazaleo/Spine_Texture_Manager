---
phase: 19
plan: 06
subsystem: renderer-modal-optimize-tiles-cross-nav
tags: [optimize-dialog, summary-tiles, cross-nav, wave-5]
status: in-progress-at-task-3-checkpoint
requires:
  - "Plan 19-03 — interim OPTIONAL onOpenAtlasPreview?: () => void on OptimizeDialogProps + AppShell-side binding onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}"
  - "ExportPlan + ExportRow types in src/shared/types.ts (sourceW/sourceH/outW/outH)"
  - "Existing OptimizeDialog 5-modal ARIA scaffold + useFocusTrap hook (lines 269-281, 247)"
provides:
  - "OptimizeDialog with 3 summary tiles (Used Files / to Resize / Saving est. pixels) at top of body via flex gap-3 mb-4 row"
  - "D-09 verbatim formulas computed in-render from props.plan: totalUsedFiles = plan.rows.length; toResize = rows where outW < sourceW; savingsPct = (1 - sumOutPixels / sumSourcePixels) * 100 with sumSourcePixels > 0 zero-guard"
  - "Footer flipped to justify-between with cross-nav '→ Atlas Preview' button at LEFT (D-18 outlined-secondary class verbatim) + existing state-branched action cluster wrapped in <div className='flex gap-2'> at RIGHT"
  - "Tightened onOpenAtlasPreview from interim OPTIONAL → REQUIRED on OptimizeDialogProps (drops the ? modifier)"
  - "Cross-nav button onClick calls props.onClose() FIRST then props.onOpenAtlasPreview() per D-11 sequential mount; disabled predicate is props.plan.rows.length === 0 per orchestrator's revision-pass lock (no new `summary` prop added)"
affects:
  - "Plan 19-07 (AtlasPreviewModal mirror) — runs in parallel with this plan; touches AtlasPreviewModal.tsx; will tighten onOpenOptimizeDialog?: () => void → REQUIRED and add the inverse cross-nav button. Cross-modal round-trip smoke validates after both 19-06 + 19-07 land."
tech-stack:
  added: []
  patterns:
    - "In-render derived values from props.plan (computed after `if (!props.open) return null;` guard alongside the existing `total` derivation) — no new state, no new prop, no useMemo (cost is O(rows.length × 2 reduce passes); rows are typically <200 entries)"
    - "Tile shape: flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3 — bg-surface (--color-stone-950) intentionally darker than surrounding bg-panel (--color-stone-900) for recessed-card-on-card visual using existing tokens only (UI-SPEC §6 line 348 inverts CONTEXT.md 'lighter shade' Discretion)"
    - "Cross-nav button class: D-18 outlined-secondary verbatim (matches AppShell.tsx:1165 Documentation placeholder); arrow '→ ' wrapped in <span aria-hidden='true'> so screen readers announce 'Atlas Preview' only"
    - "D-11 sequential mount: onClose() FIRST → useFocusTrap unmount cleanup → AtlasPreviewModal mount installs its own trap; never co-existing"
    - "Tightening pattern: OPTIONAL prop in source plan → REQUIRED in consuming plan when the field becomes used unconditionally in render"
key-files:
  created: []
  modified:
    - "src/renderer/src/modals/OptimizeDialog.tsx (3 summary tiles + cross-nav button + props tightening; 5-modal ARIA scaffold + useFocusTrap preserved verbatim)"
decisions:
  - "Used `bg-surface` for tile backgrounds (darker than parent `bg-panel`) per UI-SPEC §6 line 348 — recessed visual using existing tokens, no new tokens added"
  - "Disabled predicate is `props.plan.rows.length === 0` per orchestrator's revision-pass lock (fixes checker WARNING 5) — keeps OptimizeDialogProps tight; no new `summary` prop introduced"
  - "Computed savingsPct in render (no useMemo) — rows count is bounded (< 200 in realistic projects); two reduce passes are O(n) and React's reconciler handles re-render budget; simpler than gating with useMemo deps"
  - "Cross-nav button placed at FIRST child of the new `justify-between` wrapper (LEFT anchor) so existing state-branched actions remain at RIGHT in their existing relative order — preserves user muscle memory from prior Phase 6 layout"
metrics:
  duration_minutes: 6
  tasks_completed: 2
  tasks_pending_user_action: 1
  completed_date: "in-progress (Task 3 checkpoint awaiting user dev-mode smoke verification)"
---

# Phase 19 Plan 06: Wave 5 — OptimizeDialog Summary Tiles + Cross-Nav Button (IN PROGRESS — Task 3 checkpoint)

Wave 5 plan adding the modal-side surfaces for UI-03 on the Optimize side. **Tasks 1-2 are committed atomically; Task 3 is a `checkpoint:human-verify` gate awaiting user dev-mode smoke verification.** Plan 19-07 runs in parallel for the AtlasPreviewModal mirror.

## Tasks Completed (1-2)

| Task | Name                                                                                                                              | Commit  | Files                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------- |
| 1    | Add 3 summary tiles + tighten `onOpenAtlasPreview` from OPTIONAL → REQUIRED                                                       | 245d7db | src/renderer/src/modals/OptimizeDialog.tsx  |
| 2    | Flip footer to `justify-between` + cross-nav `→ Atlas Preview` button at LEFT (D-18 outlined-secondary; locked `disabled` predicate) | 77879b9 | src/renderer/src/modals/OptimizeDialog.tsx  |

## Tasks Pending (3)

| Task | Name                                                                          | Type                       | Awaiting                                                                                                                  |
| ---- | ----------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 3    | Dev-mode smoke check — OptimizeDialog tiles + cross-nav round-trip            | checkpoint:human-verify    | User runs `npm run dev`, opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, walks the 10-step verify protocol from plan §`<how-to-verify>` |

The Task 3 checkpoint payload is returned to the orchestrator. A continuation agent will land a docs-only commit acknowledging dev-mode smoke approval + finalize this SUMMARY.md once the user signs off.

## What Landed (Tasks 1-2)

### Task 1 — 3 summary tiles + props tightening (commit `245d7db`)

Three in-file edits inside `src/renderer/src/modals/OptimizeDialog.tsx`:

- **Edit A — Tighten `onOpenAtlasPreview` to REQUIRED.** Dropped the `?` modifier on `OptimizeDialogProps.onOpenAtlasPreview` (was `onOpenAtlasPreview?: () => void` per Plan 19-03's interim OPTIONAL posture; now `onOpenAtlasPreview: () => void`). JSDoc updated from "interim OPTIONAL" to "REQUIRED" with the rationale that the modal-side button rendered in Task 2 consumes it unconditionally. AppShell already wires the binding (`onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}` at AppShell.tsx:1364) so this tightening is TypeScript-clean at the consumer site without any AppShell change.
- **Edit B — Compute D-09 tile values in-render.** Added the verbatim formulas after `if (!props.open) return null;` (around line 271) alongside the existing `total` derive:
  ```typescript
  const totalUsedFiles = props.plan.rows.length;
  const toResize = props.plan.rows.filter((r) => r.outW < r.sourceW).length;
  const sumSourcePixels = props.plan.rows.reduce((acc, r) => acc + r.sourceW * r.sourceH, 0);
  const sumOutPixels = props.plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0);
  const savingsPct = sumSourcePixels > 0 ? (1 - sumOutPixels / sumSourcePixels) * 100 : 0;
  ```
  Zero-guard (`sumSourcePixels > 0 ? ... : 0`) covers the empty-plan edge case (`plan.rows.length === 0`).
- **Edit C — Insert 3-tile row.** Inserted between `<h2 id="optimize-title">` and the body branches (`{state === 'pre-flight' && ...}`). `<div className="flex gap-3 mb-4">` containing three flex-1 tiles with the verbatim shape from UI-SPEC §6: outer `flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3`, value span `text-base font-semibold text-fg`, label span `text-xs text-fg-muted text-center`. Verbatim labels per UI-SPEC §"Copywriting Contract" line 594:
  - Tile 1: `{totalUsedFiles}` / `Used Files`
  - Tile 2: `{toResize}` / `to Resize`
  - Tile 3: `{savingsPct.toFixed(1)}%` / `Saving est. pixels`

5-modal ARIA scaffold (`role="dialog"` + `aria-modal="true"` + outer overlay `onClick={onCloseSafely}` + inner `stopPropagation` + `useFocusTrap`) preserved verbatim. `<h2 id="optimize-title">` preserved verbatim. Body branches (`pre-flight`, `in-progress`, `complete`) untouched. The existing `total` computation untouched.

### Task 2 — Footer flip + cross-nav button (commit `77879b9`)

Three structural edits to the footer at lines 320-370:

- **Edit A — Flip wrapper className.** `<div className="flex gap-2 mt-6 justify-end">` → `<div className="flex gap-2 mt-6 justify-between">`.
- **Edit B — Add cross-nav button at footer LEFT.** New `<button>` as FIRST child of the flipped wrapper:
  ```tsx
  <button
    type="button"
    onClick={() => {
      props.onClose();
      props.onOpenAtlasPreview();
    }}
    disabled={props.plan.rows.length === 0}
    className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
  >
    <span aria-hidden="true">→ </span>Atlas Preview
  </button>
  ```
  D-18 outlined-secondary class string is byte-for-byte identical to AppShell.tsx:1165 (Documentation placeholder) and Plan 19-03's verified verbatim. Arrow `→ ` wrapped in `<span aria-hidden="true">` so screen readers announce "Atlas Preview" only; sighted users see the directional cue.
- **Edit C — Wrap existing children in inner `<div className="flex gap-2">`.** All three state branches (`pre-flight` Cancel/Start, `in-progress` Cancel, `complete` Open output folder/Close) preserved verbatim inside the new inner div. `startBtnRef` / `cancelBtnRef` / `closeBtnRef` refs preserved verbatim. State-branched onClick handlers, disabled predicates, and child text content all preserved verbatim.

D-11 sequential-mount contract: cross-nav onClick calls `props.onClose()` FIRST → OptimizeDialog's render returns `null` (the `if (!props.open) return null;` guard fires next render) → useFocusTrap unmount-cleanup destroys the document-level Escape listener and Tab cycle → THEN `props.onOpenAtlasPreview()` flips AppShell's `atlasPreviewOpen` state → AtlasPreviewModal mounts and installs its own trap. Two distinct trap lifecycles, never co-existing.

Disabled predicate: `props.plan.rows.length === 0` per orchestrator's revision-pass lock. This is structurally equivalent to a `summary.peaks.length === 0` check (an export plan with zero rows means there's nothing to atlas-preview from either) while keeping `OptimizeDialogProps` tight — no new `summary` prop introduced. Fixes checker WARNING 5.

## Verification (post-Task-2)

All plan-level acceptance gates green at end of Task 2:

| Gate                                                                                                                                                                                                                                          | Result                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `grep -F 'onOpenAtlasPreview: () => void' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                          | PASS                                  |
| `grep -F 'onOpenAtlasPreview?: () => void' src/renderer/src/modals/OptimizeDialog.tsx` returns nothing                                                                                                                                         | PASS (interim OPTIONAL tightened)     |
| `grep -F 'props.plan.rows.filter((r) => r.outW < r.sourceW).length' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                | PASS                                  |
| `grep -F 'sumSourcePixels > 0' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                     | PASS (zero-guard)                     |
| `grep -F 'flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                  | PASS (×3)                             |
| `grep -F 'Used Files' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                              | PASS                                  |
| `grep -F 'to Resize' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                               | PASS                                  |
| `grep -F 'Saving est. pixels' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                      | PASS                                  |
| `grep -F 'savingsPct.toFixed(1)' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                   | PASS                                  |
| `grep -F 'flex gap-2 mt-6 justify-between' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                         | PASS (footer flipped)                 |
| `grep -F 'flex gap-2 mt-6 justify-end' src/renderer/src/modals/OptimizeDialog.tsx` returns nothing                                                                                                                                             | PASS (old footer pattern removed)     |
| `grep -F 'props.onClose();' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                        | PASS                                  |
| `grep -F 'props.onOpenAtlasPreview()' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                              | PASS                                  |
| `grep -F '<span aria-hidden="true">→ </span>Atlas Preview' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                          | PASS                                  |
| `grep -F 'props.plan.rows.length === 0' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                            | PASS (locked predicate)               |
| `grep -F 'props.summary.peaks.length === 0' src/renderer/src/modals/OptimizeDialog.tsx` returns nothing                                                                                                                                        | PASS (no new `summary` prop added)    |
| `grep -F 'border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent' src/renderer/src/modals/OptimizeDialog.tsx` | PASS (D-18 outlined-secondary verbatim) |
| `grep -F 'role="dialog"' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                           | PASS (ARIA scaffold intact)           |
| `grep -F 'aria-modal="true"' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                       | PASS                                  |
| `grep -F 'useFocusTrap' src/renderer/src/modals/OptimizeDialog.tsx`                                                                                                                                                                            | PASS                                  |
| `grep -E "from ['\"].*src/core" src/renderer/src/modals/OptimizeDialog.tsx` returns nothing                                                                                                                                                    | PASS (Layer 3 invariant preserved)    |
| `npx tsc --noEmit`                                                                                                                                                                                                                             | PASS (exits 0)                        |
| `npm test -- tests/arch.spec.ts`                                                                                                                                                                                                               | PASS (12/12)                          |
| `npm test` (full suite)                                                                                                                                                                                                                        | 47 passed / 1 failed (pre-existing, see deviations) |
| Dev-mode smoke (Task 3)                                                                                                                                                                                                                        | PENDING — awaiting user verification  |

## Deviations from Plan

### Rule 3 — Pre-existing test failure outside plan scope (deferred; no code change)

**Found during:** Task 2 plan-level gate `npm test`.

**Issue:** `tests/main/sampler-worker-girl.spec.ts > sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl) > fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms` fails with `warm-up run must complete (not error/cancel): expected 'error' to be 'complete'`. Root cause: `fixtures/Girl/` does not exist in the repository (`ls -la fixtures/Girl/` → `No such file or directory`). The fixture is local-only (likely user-side; gitignored or never committed). Test was authored in commit `320ef4a` (Phase 9 Plan 02) and partially patched in `f00e232` (CI-skip applied).

**Verification this is pre-existing:** `git stash && git checkout 56ec4d1 -- src/renderer/src/modals/OptimizeDialog.tsx && npm test -- tests/main/sampler-worker-girl.spec.ts` reproduces the exact same failure on the base commit `56ec4d1f02ff3182608b256a02894863276a6f00`. The failure is independent of Plan 19-06's changes.

**Fix:** No code change. Failure is out of scope per executor SCOPE BOUNDARY (only auto-fix issues DIRECTLY caused by the current task's changes; pre-existing failures in unrelated files are deferred).

**Files modified:** None.

**Commit:** N/A.

**Note:** All 47 other test files pass (534 passed / 1 failed / 2 skipped / 2 todo). The arch.spec.ts grep gate (Layer 3 invariant) passes 12/12. TypeScript exits 0.

## Authentication Gates

None — Plan 19-06 is renderer-only modal work; no auth surface touched.

## Task 3 Checkpoint Status

**Type:** `checkpoint:human-verify`
**Reason:** Tile visibility, recessed `bg-surface` contrast against `bg-panel`, footer button positioning, cross-nav round-trip (Optimize → Atlas Preview → Optimize), and focus-trap continuity are visual/interaction claims with no automated test surface in this codebase. Dev-mode smoke is the test surface.

**What needs to happen:**
1. User runs `npm run dev` from project root.
2. Opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.
3. Clicks Optimize Assets in the sticky bar.
4. Walks the 10-step verify protocol from plan §`<how-to-verify>` (visual confirmation of tile values + recessed look + LEFT-anchor cross-nav + RIGHT cluster preservation + cross-nav round-trip + focus-trap + Esc).
5. Approves (or rejects with specific failure description).
6. Continuation agent lands a docs-only commit acknowledging dev-mode smoke approval + appends a final "## Dev-Mode Smoke Approval" section to this SUMMARY.md.

This SUMMARY.md is **not yet finalized** — the continuation agent will:
- Append a `## Dev-Mode Smoke Approval` section with date + sign-off.
- Update `status` frontmatter from `in-progress-at-task-3-checkpoint` to a complete value.
- Update `metrics.completed_date` from `in-progress (...)` to the actual completion date.
- Append a `## Self-Check: PASSED` section verifying both commits exist + the modified file exists.

**Cross-modal round-trip note:** Plan 19-07 lands the inverse cross-nav (`AtlasPreviewModal → OptimizeDialog`) in the same wave. For full cross-modal round-trip testing, the user should run dev-mode smoke after BOTH 19-06 and 19-07 land. For now (19-06 only), the smoke check confirms `OptimizeDialog → AtlasPreviewModal` direction; AtlasPreviewModal can be closed via X to return to the panel since its inverse cross-nav button isn't rendered yet.

## Hand-off Notes for Downstream Plans

- **Plan 19-07 (AtlasPreviewModal mirror):**
  - Apply the same tile pattern at top of AtlasPreviewModal body (3 tiles via `flex gap-3 mb-4` row with `bg-surface` recessed look).
  - Tile formulas differ — they derive from the atlas summary, not ExportPlan rows. Consult UI-SPEC §6 / §7 for AtlasPreviewModal's specific D-09 formulas.
  - Tighten `onOpenOptimizeDialog?: () => void` → `onOpenOptimizeDialog: () => void` on `AtlasPreviewModalProps`.
  - Render the inverse cross-nav button at footer LEFT calling `props.onClose()` FIRST then `props.onOpenOptimizeDialog()` (D-11 sequential mount; AppShell's `onClickOptimize` re-runs the full async output-picker + plan-builder flow on cross-nav).
  - Use the same D-18 outlined-secondary class string verbatim. Arrow direction is direction-neutral (both modals are peers); use `→ Optimize Assets` per UI-SPEC §"Copywriting Contract".
  - Modify the existing footer disclaimer at AtlasPreviewModal.tsx:239-241 to a `flex justify-between items-center` row containing the cross-nav button on the left + the existing disclaimer on the right (per Plan 19-03 hand-off note).

- **Phase 19 verifier:**
  - Cross-modal round-trip smoke needs both 19-06 + 19-07 landed. After both plans complete, validate Optimize → Atlas Preview → Optimize chains correctly with focus trap continuity (Tab cycles work in each modal; Esc closes only the active modal).
  - Verify `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` does have ≥1 export rows so the cross-nav button is enabled (otherwise the disabled-when-empty branch would mask the round-trip path).

## Self-Check (Tasks 1-2 only — Task 3 self-check appended by continuation agent)

Verified files exist + were modified per task scope:
- FOUND: `src/renderer/src/modals/OptimizeDialog.tsx` (modified in Tasks 1, 2)

Verified commits exist on `worktree-agent-ad27b57fdcd37eebe` branch:
- FOUND: `245d7db` — feat(19-06): add 3 summary tiles to OptimizeDialog + tighten onOpenAtlasPreview to REQUIRED
- FOUND: `77879b9` — feat(19-06): flip OptimizeDialog footer to justify-between with cross-nav button at LEFT

Tasks 1-2 self-check: PASSED.
