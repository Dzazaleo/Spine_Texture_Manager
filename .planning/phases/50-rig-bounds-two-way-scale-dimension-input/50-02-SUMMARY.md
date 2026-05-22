---
phase: 50-rig-bounds-two-way-scale-dimension-input
plan: 02
subsystem: ui
tags: [renderer, variant-dialog, two-way-binding, scale, react, layer-3, jsdom]

# Dependency graph
requires:
  - phase: 50-01
    provides: "SkeletonSummary.bbox: {w,h}|null — the precomputed setup-pose AABB the px reference axes read"
  - phase: 49-02
    provides: "VariantDialog single-pane modal + the basic numeric scale field (the field this plan enriches in place) + scaleInvalid pre-check + Export disabled gate"
provides:
  - "variant-scale-derive.ts: renderer-local pure helpers pxFromScale / scaleFromPx / displayFactor (Layer-3-safe, no core/ or formatScaleToken import)"
  - "Enriched VariantDialog Scale card: setup-pose bbox W×H reference line + three coupled aspect-locked inputs (factor / target-W px / target-H px), uniform-only"
  - "V8 pure-helper unit tests + V9-V12 jsdom component tests (two-way / no-drift / over-range / no-geometry)"
affects: [phase-51-scale-output-batch-tabs, variant-export, scaleui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-way coupled numeric inputs: a single canonical value (s) is the source of truth; sibling fields are derived views; the focused field renders its raw typed string to avoid round-trip drift"
    - "Layer-3 renderer-local copy of a Node-only normalization (Number(s.toFixed(4))) instead of importing the Node helper — honors the renderer-↛-core/main boundary (arch.spec.ts:20)"
    - "Degenerate-input normalization at the consumption seam: a missing/null/non-finite bbox collapses to a single `null` sentinel so all downstream checks test one shape"

key-files:
  created:
    - "src/renderer/src/modals/variant-scale-derive.ts"
    - "tests/renderer/variant-twoway.spec.ts"
    - "tests/renderer/variant-twoway.spec.tsx"
  modified:
    - "src/renderer/src/modals/VariantDialog.tsx"
    - "tests/renderer/variant-dialog.spec.tsx"

key-decisions:
  - "Normalize a missing/null/non-finite bbox to a single `null` sentinel at the seam (covers a pre-50-01-shaped or degenerate summary uniformly) — Rule 1 robustness for threat T-50-FIN"
  - "Track an active-px-field + raw-string state so the focused px field renders the user's literal text (no re-round drift, D-02)"
  - "Rename the in-place field label 'Scale:' → 'Factor:' as the px targets joined it; field identity (id=variant-scale-input, controlled by props.scale) preserved; updated the one Phase-49 label assertion to match"

patterns-established:
  - "Pattern 1: single-source-of-truth coupled inputs — derived views + raw-text-while-focused for the edited field"
  - "Pattern 2: renderer-local inline copy of a Node normalization helper to keep the Layer-3 boundary clean"

requirements-completed: [SCALEUI-01]

# Metrics
duration: ~6min
completed: 2026-05-22
---

# Phase 50 Plan 02: Two-Way Scale↔Dimension Input Summary

**Replaced the VariantDialog basic scale field in place (D-09, no tabs) with a setup-pose bbox W×H reference line + three coupled aspect-locked inputs (factor / target-W px / target-H px) backed by renderer-local pure helpers; typed px targets are honored exactly (s = px ÷ axis, no snap), the factor `s` stays the single export source of truth, the edited axis never round-trip-drifts, over-range is allowed-but-Export-disabled, and a degenerate rig degrades gracefully.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-22T23:38:24Z
- **Completed:** 2026-05-22T23:42:02Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `variant-scale-derive.ts` — three pure, unit-tested helpers (`pxFromScale`, `scaleFromPx`, `displayFactor`); `scaleFromPx` is the EXACT `px / axis` quotient (D-03, no snapping); `displayFactor` mirrors `Number(s.toFixed(4))` (== `formatScaleToken`) but copied inline to honor Layer-3.
- Enriched VariantDialog Scale card IN PLACE (D-09 — no tabs, no structural refactor): bbox reference line + factor / target-W / target-H inputs, all views of the single canonical `s` written through the existing `onScaleChange` prop. Reads `props.summary.bbox` — zero new IPC/props.
- No round-trip drift on the edited axis: the focused px field renders the user's raw typed string (`activePxField` / `activePxRaw` state); the sibling fields re-derive from `s` on the next render (uniform aspect-lock).
- Over-range (`s ≥ 1`) is allowed (entry fires `onScaleChange`); the existing `scaleInvalid` pre-check disables Export + shows the inline hint as defense-in-depth; the authoritative reject stays the main-side `VariantScaleError` (D-04).
- Degenerate rig (bbox null / missing / non-finite axis) collapses to a single `null` sentinel: the px fields disable + blank, the reference line shows "Setup-pose size: unavailable (no textured geometry)", the factor field stays fully usable (T-50-FIN).
- Layer-3 invariant preserved — `tests/arch.spec.ts` (renderer ↛ core) green; no `core/` or `formatScaleToken` import in either renderer file.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Pure derivation helpers + Wave-0 tests (V8 helpers GREEN, V9-V12 shells RED)** — `32deb78` (test)
2. **Task 2: Enrich the VariantDialog Scale card in place (GREEN for V9-V12)** — `c492dfe` (feat)

_TDD gate sequence: `test(...)` (RED, V9-V12 failing) then `feat(...)` (GREEN, V9-V12 passing). No refactor commit needed — code landed clean._

## Files Created/Modified

- `src/renderer/src/modals/variant-scale-derive.ts` (created) — renderer-local pure helpers `pxFromScale` / `scaleFromPx` / `displayFactor`; Layer-3-safe; `scaleFromPx` exact (no snap), `s` never rounded (only the display is).
- `src/renderer/src/modals/VariantDialog.tsx` (modified) — replaced the basic scale field block (`:299-331`) with the enriched Scale card; added the `bbox` normalization + `activePxField`/`activePxRaw` state; imports the three helpers.
- `tests/renderer/variant-twoway.spec.ts` (created) — V8 pure-helper unit tests (3 tests).
- `tests/renderer/variant-twoway.spec.tsx` (created) — V9-V12 jsdom component tests (two-way / no-drift / over-range / no-geometry; 4 tests).
- `tests/renderer/variant-dialog.spec.tsx` (modified) — updated the one Phase-49 "basic scale field" label assertion for the in-place `Scale:` → `Factor:` rename (field identity preserved).

## Decisions Made

- **bbox normalization to a single `null` sentinel.** The plan's interface contract is `bbox: {w,h}|null`, but a pre-50-01-shaped summary (or a non-finite/zero axis) can also arrive. Rather than scatter `undefined`/`null`/finite checks, I normalize once at the seam (`const bbox = rawBbox != null && finite && >0 ? rawBbox : null`). All downstream branches test `=== null` / `!== null` against this one shape. This satisfies threat T-50-FIN (no Infinity/NaN can reach `scaleFromPx`).
- **Raw-text-while-focused for the edited px field.** Tracking `activePxField`/`activePxRaw` is what guarantees D-02's no-drift property: the edited axis shows exactly what the user typed; only the *other* (re-derived) field rounds.
- **Label rename `Scale:` → `Factor:`.** As the px target fields joined the factor field, "Scale:" became ambiguous. The input's identity (`id`, controlled value, parse-guard) is unchanged — only the visible label. The one Phase-49 test that asserted the old label was updated; its behavioral coverage (controlled value + number type) is intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Treat a missing/non-finite bbox as degenerate (not just literal `null`)**
- **Found during:** Task 2 (running the existing `variant-dialog.spec.tsx` after the enrichment)
- **Issue:** The Phase-49 `makeSummary()` test builder predates 50-01 and has NO `bbox` field, so `props.summary.bbox` is `undefined` (not `null`). My initial `bbox !== null` checks treated `undefined` as a present bbox and dereferenced `bbox.w` during render → crash; all 7 Phase-49 dialog tests went RED. A real degenerate rig with a zero/non-finite axis would have hit the same divide-by-zero hazard (T-50-FIN).
- **Fix:** Normalize at the declaration: a falsy/non-finite/zero-axis bbox collapses to `null`. The degenerate-rig UI path (disabled px fields, graceful reference line, usable factor) now covers all of `undefined` / `null` / non-finite uniformly, and the divide guard (`bbox != null && axis > 0`) is doubly enforced.
- **Files modified:** src/renderer/src/modals/VariantDialog.tsx
- **Verification:** All three variant suites + `arch.spec.ts` green (34/34); typecheck:web RC=0.
- **Committed in:** `c492dfe` (Task 2 commit)

**2. [Rule 3 - Blocking] Update the Phase-49 label assertion for the in-place field rename**
- **Found during:** Task 2 (the same `variant-dialog.spec.tsx` regression run)
- **Issue:** The Phase-49 test queried `getByLabelText(/Scale:/i)` for the basic field. D-09 enriches the SAME control in place; the field's visible label changed `Scale:` → `Factor:` (the px targets needed a distinct label), so the query no longer resolved.
- **Fix:** Updated that one assertion to `getByLabelText(/Factor:/i)`; the field's identity (id, `type=number`, controlled value `0.5`) is preserved and still asserted, so the Phase-49 behavioral coverage is intact.
- **Files modified:** tests/renderer/variant-dialog.spec.tsx
- **Verification:** variant-dialog.spec.tsx 7/7 green post-change.
- **Committed in:** `c492dfe` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule-1 bug, 1 Rule-3 blocking)
**Impact on plan:** Both auto-fixes were necessary to land the in-place enrichment without regressing the Phase-49 dialog tests. The Rule-1 fix also hardens the documented threat (T-50-FIN). No scope creep — no new props, no new IPC, no tabs.

## Issues Encountered

- **AC grep literal false-positives (non-blocking).** Two Task-2 acceptance-criteria greps return nonzero because the matched tokens live in COMMENTS, not code:
  - `grep -c "formatScaleToken"` → 3 (two pre-existing Phase-49 comments at `:279`/`:285`, plus my new doc-comment at `:336` that explicitly says "NO core/ or formatScaleToken import"). There is NO actual import — `grep -nE "import .*formatScaleToken|from .*variant-export"` finds none. The Layer-3 / T-50-LAYER contract is satisfied.
  - `grep -cE "...<Tab"` → 1 (matches "NOT a tablist" inside the pre-existing Phase-49 comment at `:16`). No tab elements/components exist. The D-09 no-tabs contract is satisfied.
  - The authoritative machine check for the Layer-3 boundary — `tests/arch.spec.ts` (renderer ↛ core) — passes, confirming the real invariant holds.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SCALEUI-01 delivered; the enriched Scale card is the in-place foundation Phase 51 will wrap into Scale / Output / Batch tabs (D-09 deferral).
- The single screenshot UAT (`50-VALIDATION §Manual-Only` — open a 4.2 + a 4.3 project, watch the px fields follow the factor and vice-versa, confirm no drift on the typed axis, confirm over-range disables Export) remains owed; record in `50-HUMAN-UAT.md`. Code-level V8-V12 are all green.
- No blockers. The factor `s` contract the Phase-49 export path consumes is unchanged.

## Self-Check: PASSED

- All created files present: `variant-scale-derive.ts`, `variant-twoway.spec.ts`, `variant-twoway.spec.tsx`, `50-02-SUMMARY.md`.
- All modified files present: `VariantDialog.tsx`, `variant-dialog.spec.tsx`.
- Both task commits present in git: `32deb78` (test), `c492dfe` (feat).
- Verification: V8 (3) + V9-V12 (4) + Phase-49 variant-dialog (7) + arch.spec.ts = 34/34 green; `npm run typecheck:web` RC=0.

---
*Phase: 50-rig-bounds-two-way-scale-dimension-input*
*Completed: 2026-05-22*
