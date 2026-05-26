# Phase 55: Variant Export Sizes to Peak Demand (Up to No-Upscale Ceiling) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 55-variant-export-sizes-to-peak-demand
**Areas discussed:** D-A Clamp universality, D-D Backward compatibility, D-F ExtrapolationIcon tooltip, UI scope

**Pre-discussion context (carried in from invocation):**
- Surfaced during Phase 54 close-out UAT (2026-05-26). User observed that reopened variants of masters with `peakScale > 1` fire ExtrapolationIcon on every such row — non-actionable noise at the variant level.
- Proposal: lift the variant export `effScale` clamp from `min(safeScale(peak × (1+buffer)), 1, sourceRatio)` to `min(safeScale(peak × (1+buffer)), 1/s, sourceRatio)`.
- Master export at `s = 1` is byte-identical by construction (`1/s = 1`).
- Phase 55 revisits Option A from Phase 54's discuss, scoped to the export's effScale formula only (NOT the bake). Phase 54 D-01 / D-02 / D-03 and `src/core/` Layer-3 purity stay locked.

---

## D-A Clamp Universality

| Option | Description | Selected |
|--------|-------------|----------|
| Universal `1/s` (Recommended) | Replace the literal `1` with `1/s` in `buildExportPlan` unconditionally. For masters `s = 1` → `1/s = 1`, so the formula is mathematically equivalent — master export stays byte-identical by construction (no branch, no `if variant`). Cleanest fit with Phase 54 L-02 "no variant detection". One code change, one math contract. | ✓ |
| Gated: keep `1` for masters, use `1/s` only when s ≠ 1 | Add an explicit branch in `buildExportPlan` or upstream. Reads as "we only do this for variants", but mathematically identical to the universal form. Introduces a soft variant-vs-master conditional — borderline on L-02; if added, must derive purely from `s` (no caller-supplied `isVariant` flag). | |

**User's choice:** Universal `1/s` (Recommended)

**Notes:** Honors Phase 54 D-02 (no variant detection) cleanly. The math is one formula, one contract; masters get the same answer they always got because `1/s = 1` when `s = 1`. Implementation seam: add `BuildExportPlanOptions.variantScale?: number` (default 1.0). The master path omits the option; variant-export passes `s`.

---

## D-D Backward Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Accept the churn — re-export to fix (Recommended) | No migration path. Already-exported variants keep their old (smaller) PNGs and still show the icon on reopen; users can re-run Export Variant to get the new sizing. Phase 55 fixes the math going forward; the icon's correctness on those legacy folders is acceptable (it still tells the truth about their state). Smallest scope; honors "no silent file mutations". | ✓ |
| Add a one-shot reconciliation tool (`/gsd-reoptimize-variant` or similar) | Ship a separate command/menu action that walks a variant folder and re-resizes its PNGs to the new ceiling without re-running the bake. Bigger scope (new IPC surface, new UI affordance, new test matrix), revisits "don't re-optimize variants" from Phase 54. Better UX for users with many existing variant folders. | |
| Defer the reconciliation tool to a future phase | Same outcome as "accept the churn" today, but explicitly note the tool as a deferred idea for v1.8+ if user demand surfaces. Captures the option without committing scope to Phase 55. | |

**User's choice:** Accept the churn — re-export to fix (Recommended)

**Notes:** No migration tool in Phase 55. The reconciliation idea IS captured as a deferred idea (see CONTEXT.md → Deferred Ideas) so future phases can revisit it if user demand surfaces — this is the de-facto union of "accept the churn" + "defer the tool".

---

## D-F ExtrapolationIcon Tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Phase 54 tooltip wording unchanged (Recommended) | `extrapolationTooltip()` in `src/renderer/src/lib/row-state.ts` stays as-is. Phase 55 reduces how often the icon fires on variants but the "capped at source dims" branch remains useful for the rare master-with-pre-optimized-source case (where `actualSource < canonical × peakScale`). The tooltip already reads correctly in both cases; no UI work needed. | ✓ |
| Sweep the tooltip wording as part of Phase 55 | Treat the tooltip as part of the Phase-55 surface. Add a task to re-audit the wording given the variant-noise drop and tighten copy if needed. Adds UI/copy work to a phase that's otherwise export-math + tests. | |
| Defer any tooltip changes to a separate copy-sweep phase | Note as a deferred idea; revisit after Phase 55 lands and the user observes the live UAT behavior. | |

**User's choice:** Keep Phase 54 tooltip wording unchanged (Recommended)

**Notes:** The tooltip's `isCapped` branch in `extrapolationTooltip()` already handles both regimes correctly. After Phase 55, variants resample peakScale ≤ 1 → icon fires less; masters with pre-optimized source still trigger correctly. A future sweep is captured as a deferred idea if the wording feels misleading post-Phase-55 live.

---

## UI Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — `--skip-ui` (Recommended) | Pure `src/core/export.ts` seam change + test updates. No new dialog, no toolbar, no panel. Matches the roadmap entry's "Likely --skip-ui". | ✓ |
| No — open a UI sub-task | Reserve a sub-task for UI work. Only check this if D-D "Add reconciliation tool" or D-F "Sweep wording" is selected and would land a new surface. | |

**User's choice:** Yes — `--skip-ui` (Recommended)

**Notes:** D-D selected "Accept the churn" (no migration tool) and D-F selected "Keep tooltip unchanged" — both eliminate the UI sub-task triggers. Phase 55 is export-math + tests only.

---

## Claude's Discretion

Captured in CONTEXT.md → "Claude's Discretion" subsection. Summary:

- **Threading `s` into `buildExportPlan`:** add `BuildExportPlanOptions.variantScale?: number` (default 1.0), OR pass positionally, OR factor into a small pure helper. Researcher to recommend; planner to pick. Constraint: master path omits the option → byte-identical behavior.
- **Test fixture choice for the new variant-with-`peakScale>1` row coverage:** synthesize a `SkeletonSummary` test double in-suite (matches Phase 54 pattern) to avoid committing a new fixture dir and the `SAFE01_EXCLUDED_PREFIXES` denylist churn (memory `feedback_new_committed_fixtures_need_safe01_denylist`).
- **`computeExportDims` (renderer) parity:** the renderer display path stays on the Phase 54 read-model (true render demand, NOT export-clamped). Researcher to confirm no parity test breaks.

## Researcher / Planner Directives (codified — not user decisions)

The following carry forward as research/plan items, not user-facing decisions:

- **D-B (Buffer ordering):** buffer applies BEFORE the clamp (`raw → bufferedScale → safeScale → clamp`) — matches current code order. Only the clamp's value changes.
- **D-C (sourceRatio + 1/s interaction in master `dimsMismatch` case):** researcher MUST verify `min(safeScale(buffered), 1/s, sourceRatio)` stays correct when both `1/s` and `sourceRatio` could bind. Expected: `sourceRatio` is the tighter ceiling and binds; `1/s` is harmless headroom above. No regression to the NECK / `compute_export_dims_canonical_base` invariant.
- **D-E (Master byte-identity verification):** Phase 48 oracle `tests/scale-bake.spec.ts` + `tests/core/export.spec.ts` master rows MUST stay green unchanged. Planner must enumerate the tests that WILL need updating vs. the tests that stay byte-identical.

## Deferred Ideas

- One-shot variant reconciliation tool (`/gsd-reoptimize-variant` or similar) — touches the Phase 54 "do NOT re-optimize variants" stance; revisits a previously-rejected pattern. Revisit in a future phase only if user demand surfaces after Phase 55 lands.
- Sweep of the ExtrapolationIcon tooltip wording for variants — Phase 55 drops the icon's fire rate; a future copy-sweep can revisit if the suffix wording feels misleading once live.
- A "variant export ceiling" debug HUD / dev-toggle showing the binding clamp (canonical, `1/s`, or `sourceRatio`) per row — useful for QA on complex rigs; not user-facing; out of scope.
