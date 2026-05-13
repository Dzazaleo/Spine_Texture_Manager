# Phase 38 — Phase 4 Code-Review Polish Audit

**Audit date:** 2026-05-13
**Source review:** `.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md` (live path — the `phases/04-scale-overrides/` path in REQUIREMENTS.md POLISH-01 is stale; the directory was archived at the v1.0→v1.1 milestone cutover)
**Findings audited:** IN-01..IN-06 + WR-03 (7 total)
**Summary:** 1 applies (IN-02), 5 no-op (swept by Phase 6 Gap-Fix R6 / Phase 27 QA-01..04), 1 skip (IN-04, intentional duplication per Phase 2/3 pattern)
**Audited against:** current source under `src/renderer/src/` as of 2026-05-13

---

## IN-01 — OverrideDialog focus trap

**Verdict:** `no-op (swept by Phase 6 Gap-Fix Round 6 — commit 5551073)`

**Original finding (04-REVIEW.md:132-140):** Header comment claimed browsers provide default Tab-focus trapping inside `role="dialog"` modals. Browsers do not — Tab cycles through all focusable elements in document order, allowing focus to escape the modal.

**Current state — satisfied:**
- `src/renderer/src/modals/OverrideDialog.tsx:55` imports `useFocusTrap` from `'../hooks/useFocusTrap'`.
- `src/renderer/src/modals/OverrideDialog.tsx:80` calls `useFocusTrap(dialogRef, true, { onEscape: props.onCancel });`.
- `src/renderer/src/hooks/useFocusTrap.ts:100-189` implements first-tabbable auto-focus, Tab/Shift+Tab cycling between first and last tabbable, document-level Escape, and focus restoration on unmount.
- `OverrideDialog.tsx:18-25` docblock now correctly describes the Phase 6 Gap-Fix Round 6 behaviour — no misleading comment remains.

**Action in Phase 38:** None. The 15-line trap from the original fix recommendation was implemented (better) in Phase 6 via a shared hook (~190 lines). The misleading comment was simultaneously corrected. Both sub-options from the original review are satisfied.

---

## IN-02 — Overlay drag-to-cancel guard

**Verdict:** `applies` (the only still-active finding)

**Original finding (04-REVIEW.md:144-161):** Overlay `onClick` fires on any mouseup that lands on the overlay, including a mousedown that started inside the panel and was dragged out (e.g. user drag-selecting their typed percentage to retype it). Inner panel's `onClick={(e) => e.stopPropagation()}` only catches events originating inside the panel — a drag-out has the overlay as the event target.

**Current state — bug verified present:**
- `src/renderer/src/modals/OverrideDialog.tsx:122-129` — the overlay div uses `onClick={props.onCancel}` (line 128). Drag-out still cancels.
- `src/renderer/src/modals/OverrideDialog.tsx:130-134` — inner panel still uses `onClick={(e) => e.stopPropagation()}`. Defensive against in-panel originating events but does not defend against drag-out.

**Fix shape (lifted verbatim from 04-REVIEW.md:151-161):**

```tsx
<div
  ref={dialogRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="override-title"
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onMouseDown={(e) => {
    if (e.target === e.currentTarget) props.onCancel();
  }}
>
```

`onMouseDown` fires before the drag can complete; `e.target === e.currentTarget` ensures the press originated directly on the overlay.

**Action in Phase 38:** Apply the 3-line patch in plan 38-02 plus a new regression test at `tests/renderer/override-dialog-drag-to-cancel.spec.tsx`.

---

## IN-03 — Empty-input guard

**Verdict:** `no-op (swept by Phase 27 — QA-02, commit fb3fedc)`

**Original finding (04-REVIEW.md:166-177):** `apply = () => props.onApply(Number(inputValue))` with `Number("") === 0` → `clampOverride` silently floored to 1%.

**Current state — satisfied:**
- `src/renderer/src/modals/OverrideDialog.tsx:108` defines `const isValid = inputValue.trim() !== '' && Number.isFinite(Number(inputValue.trim()));`
- `OverrideDialog.tsx:179-190` — Apply button carries `disabled={!isValid}` plus class-toggled disabled style (opacity-50, cursor-not-allowed).
- `OverrideDialog.tsx:117-119` — Enter handler guards `if (e.key === 'Enter' && isValid) apply();`.

**Test coverage:** `tests/renderer/override-dialog-empty-input.spec.tsx` (5 cases — empty + whitespace disable Apply, valid re-enables, Apply preserves pre-fill, Enter on empty is a no-op).

**Action in Phase 38:** None. Documented here for traceability.

---

## IN-04 — `highlightMatch` DRY-candidate (intentional duplication)

**Verdict:** `skip (intentional per Phase 2 / Phase 3 self-contained-panel pattern)`

**Sourcing-of-truth correction:** Roadmap success criterion 3 and the Phase 38 task spec wording mention "`highlightMatch` duplication from `SearchBar.tsx`". This is a slip — the duplication is NOT `SearchBar.tsx` vs anything; `src/renderer/src/components/SearchBar.tsx` contains no `highlightMatch` function (verified: `grep -n highlightMatch src/renderer/src/components/SearchBar.tsx` → empty). The original review (`04-REVIEW.md:181-185`) and the pending todo (lines 42-45) both flag the duplication between the two PANELS, not `SearchBar.tsx`:

- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:283-298` — `highlightMatch` helper
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx:302-317` — `highlightMatch` helper (byte-identical body)

**Intent documentation (preserves the duplication on purpose):**
- `AnimationBreakdownPanel.tsx:295-300` docblock: *"Mirrors the prior phase's helper in the global panel (same 15-line helper; intentional duplication to keep this panel self-contained)."*
- `.planning/milestones/v1.0-phases/03-animation-breakdown-panel/03-02-SUMMARY.md:48`: *"Module-top highlightMatch helper duplicated verbatim from Phase 2 GlobalMaxRenderPanel.tsx (same 15 lines). Extracting it to a shared module would have touched Phase 2 files needlessly; intentional duplication keeps each panel self-contained and review-friendly."*

**Extraction threshold (from original review):** "If a third consumer appears in Phase 6+, consider extracting to `src/renderer/src/lib/highlight-match.tsx`." No third consumer exists in 2026-05-13 source (`grep -rn highlightMatch src/renderer/src/` returns exactly the two panels — ignoring `.bak*` snapshots). Threshold not met.

**Action in Phase 38:** None. Explicit skip documented here per Phase 38 success criterion 3.

---

## IN-05 — Sort comparator locale options

**Verdict:** `no-op (swept by Phase 27 — QA-03, commit 01468e4)`

**Original finding (04-REVIEW.md:191-201):** `compareRows` used `localeCompare(b.attachmentName)` with no options. Environment-dependent ordering; `CHAIN_10` lexicographically sorted between `CHAIN_1` and `CHAIN_2`.

**Current state — satisfied:**
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:247-273` — `compareRows` function. All four string branches now carry `(undefined, { sensitivity: 'base', numeric: true })`:
  - Line 253 (attachmentName / regionName)
  - Line 255 (skinName)
  - Line 257 (animationName)
- `GlobalMaxRenderPanel.tsx:236-246` — function-leading comment documents the QA-03 sweep AND the deliberate scope boundary: *"display sort only. compareRows feeds sortRows … Its output never crosses a determinism boundary"* — explains why `src/core/atlas-preview.ts` and `src/core/export.ts` were INTENTIONALLY left with bare `localeCompare`; touching those would break the preview ↔ export byte-identical invariant (D-125).

**Test coverage:** `tests/renderer/locale-compare-numeric-sort.spec.tsx` — `CHAIN_2` before `CHAIN_10`; mixed-arity natural sort `CHAIN_1, 2, 3, 10, 11`.

**Action in Phase 38:** None. The determinism scope boundary documented above is a tripwire — do NOT widen the comparator's reach during this phase.

---

## IN-06 — Dead `open` prop + early-return guard

**Verdict:** `no-op (swept by Phase 27 — QA-04, commit cf098e0)`

**Original finding (04-REVIEW.md:206-213):** AppShell mount-gated the dialog with `dialogState !== null && <OverrideDialog ... />` AND passed `open={true}` unconditionally. The dialog's `if (!props.open) return null` guard was dead code; `useEffect([props.open])` had a constant dependency.

**Current state — satisfied:**
- `src/renderer/src/modals/OverrideDialog.tsx:57-64` — `OverrideDialogProps` interface carries only `scope`, `currentPercent`, `anyOverridden`, `onApply`, `onClear`, `onCancel`. No `open` prop.
- No early-return guard anywhere in the file (verified by reading lines 66-95).
- `OverrideDialog.tsx:28-32` docblock explicitly notes the QA-04 removal: *"conditional rendering handled by AppShell's mount gate (`dialogState !== null && <OverrideDialog ... />`) rather than an internal `open` flag (QA-04, Phase 27 — dead-prop removal)."*
- AppShell call site already props-aligned (no `open` prop passed; mount-gate is the lifecycle).

**Action in Phase 38:** None.

---

## WR-03 — Functional `setSelected` updater

**Verdict:** `no-op (swept by Phase 27 — QA-01, commit f7668c4)`

**Original finding (04-REVIEW.md:103-126):** `handleToggleRow` + `handleRangeToggle` in `GlobalMaxRenderPanel` captured `selected` via closure → stale-closure race under rapid-fire toggles; `useCallback` deps listed `selected`.

**Current state — satisfied:**
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:815-874` — both handlers use the functional updater `setSelected((prev) => { … })` form. Each branch (toggle, range with anchor, range without anchor, range with off-screen anchor) reads `prev` inside the updater. `useCallback` deps no longer include `selected`.

**Test coverage:** `tests/renderer/global-max-functional-setselected.spec.tsx` — 463-line regression spec with closure-vs-functional handler harness proving the race and a real-panel control case.

**Action in Phase 38:** None.

---

## Closing summary

| Finding | Verdict | Sweeping phase / commit | Action in Phase 38 |
|---------|---------|--------------------------|---------------------|
| IN-01 focus trap | no-op | Phase 6 Gap-Fix R6 / `5551073` | Document; no code change |
| IN-02 drag-to-cancel | applies | — | 3-line patch + new test (plan 38-02) |
| IN-03 empty-input guard | no-op | Phase 27 QA-02 / `fb3fedc` | Document; no code change |
| IN-04 highlightMatch DRY | skip | Phase 2/3 intentional duplication | Document rationale; no code change |
| IN-05 sort locale options | no-op | Phase 27 QA-03 / `01468e4` | Document; no code change |
| IN-06 dead `open` prop | no-op | Phase 27 QA-04 / `cf098e0` | Document; no code change |
| WR-03 functional setSelected | no-op | Phase 27 QA-01 / `f7668c4` | Document; no code change |

**Net Phase 38 code work:** 1 finding (IN-02) → 1 ~3-line patch in `OverrideDialog.tsx` + 1 new test in `tests/renderer/`. 5 no-ops and 1 skip require no code change — this audit IS the verification artifact for those 6.
