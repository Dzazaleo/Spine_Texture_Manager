---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 05
type: execute
wave: 4
depends_on: [04]
files_modified:
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - src/renderer/src/modals/OptimizeDialog.tsx
  - tests/renderer/global-max-virtualization.spec.tsx
  - tests/renderer/anim-breakdown-virtualization.spec.tsx
  - tests/renderer/optimize-dialog-passthrough.spec.tsx
  - tests/core/loader-dims-mismatch.spec.ts
autonomous: false
requirements: [DIMS-02, DIMS-04, DIMS-05]
must_haves:
  truths:
    - "Badge SVG icon + tooltip renders in GlobalMaxRenderPanel when row.dimsMismatch === true; absent when false"
    - "Badge SVG icon + tooltip renders in AnimationBreakdownPanel when row.dimsMismatch === true; absent when false"
    - "Tooltip wording matches ROADMAP DIMS-02 verbatim: 'Source PNG (W×H) is smaller than canonical region dims (W×H). Optimize will cap at source size.'"
    - "D-03: OptimizeDialog PreFlightBody renders passthrough rows with muted treatment + COPY indicator (parity with Phase 6 D-109 excludedUnused muted UX); the file IS written to outDir (not skipped) — passthrough is a third category, not exclusion"
    - "OptimizeDialog passthrough row label uses row.actualSourceW ?? row.sourceW (CHECKER FIX 2026-05-02 — concrete on-disk dims, NOT canonical dims)"
    - "OptimizeDialog InProgressBody renders progress for passthroughCopies first then rows (single absolute index space)"
    - "DIMS-05 round-trip: load drifted project (PNGs halved on disk) → buildExportPlan → passthroughCopies.length === fileCount AND rows.length === 0"
    - "DIMS-05 fixture: dynamic readdirSync count (R7 mitigation; never hardcoded)"
  artifacts:
    - path: src/renderer/src/panels/GlobalMaxRenderPanel.tsx
      contains: "dimsMismatch"
    - path: src/renderer/src/panels/AnimationBreakdownPanel.tsx
      contains: "dimsMismatch"
    - path: src/renderer/src/modals/OptimizeDialog.tsx
      contains: "passthroughCopies"
    - path: src/renderer/src/modals/OptimizeDialog.tsx
      contains: "actualSourceW ?? "
    - path: tests/renderer/optimize-dialog-passthrough.spec.tsx
      provides: "RTL component tests for COPY indicator + actualSource label rendering"
    - path: tests/core/loader-dims-mismatch.spec.ts
      provides: "DIMS-05 round-trip integration spec"
  key_links:
    - from: panel row render
      to: row.dimsMismatch
      via: "conditional render of inline-SVG badge with aria-label + title"
      pattern: "row\\.dimsMismatch && <span"
    - from: OptimizeDialog PreFlightBody
      to: plan.passthroughCopies
      via: "map over array with muted opacity-60 + COPY indicator chip"
      pattern: "passthroughCopies\\.map\\("
    - from: OptimizeDialog passthrough label
      to: ExportRow.actualSourceW (populated in Plan 22-03 Step 5)
      via: "row.actualSourceW ?? row.sourceW fallback ensures concrete on-disk dims show in 'already optimized' label"
      pattern: "actualSourceW\\s*\\?\\?\\s*"
    - from: DIMS-05 spec
      to: programmatic fixture mutation
      via: "beforeAll halves every PNG via sharp.resize() to tmpDir"
      pattern: "sharp\\(.*\\.resize"
---

<objective>
Final Phase 22 plan. Three surfaces:

1. **DIMS-02 badge UI** in `GlobalMaxRenderPanel.tsx` + `AnimationBreakdownPanel.tsx` — small inline SVG icon + tooltip rendered conditionally on `row.dimsMismatch === true`. Tooltip wording locked verbatim from ROADMAP DIMS-02. Sibling-symmetric across both panels per Phase 19 D-06.

2. **DIMS-04 OptimizeDialog COPY indicator + actualSource label** — extend `PreFlightBody` (lines 436-465) with a parallel `plan.passthroughCopies.map(...)` block AFTER the rows block; muted `opacity-60` + bordered "COPY" chip. **CHECKER FIX 2026-05-02:** Render the dim label as `{row.actualSourceW ?? row.sourceW}×{row.actualSourceH ?? row.sourceH}` (NOT plain `row.sourceW × row.sourceH`) — without the `?? row.sourceW` fallback the dialog would label muted "already optimized" rows with canonical dims (e.g. 1628×1908) instead of the actual on-disk dims (e.g. 811×962). The `??` fallback handles the (rare) defensive case where actualSourceW is undefined despite being a passthrough row. Extend `InProgressBody` (lines 467-553) to iterate `[...plan.passthroughCopies, ...plan.rows]` with absolute index space (matches image-worker emission order from Plan 22-04 Task 2).

3. **DIMS-05 round-trip integration** — new `tests/core/loader-dims-mismatch.spec.ts` programmatically halves every PNG in `fixtures/SIMPLE_PROJECT_NO_ATLAS/` via `sharp.resize()` to a tmpDir in `beforeAll`, then loads + builds an export plan + asserts `passthroughCopies.length === fileCount` AND `rows.length === 0`. Per RESEARCH §R7: read fixture file count dynamically via `fs.readdirSync(images/).length` (never hardcode 4).

**HUMAN-UAT checkpoint** — visual verification of:
- Badge icon renders cleanly at 100% zoom + dark mode in both panels
- Tooltip wording substitutes concrete dim values without clipping
- OptimizeDialog COPY indicator placement reads consistently with the existing `excludedUnused` muted-row treatment
- **OptimizeDialog passthrough rows show actual on-disk dims** (e.g. 811×962) NOT canonical dims (e.g. 1628×1908) in the "already optimized" label
- After running Optimize on a drifted project, output `images/` folder contains every PNG (passthrough copies present byte-for-byte; resized PNGs at expected dims)

Per RESEARCH §"DIMS-02 Implementation > Iconography": reuse the inline-SVG warning pattern from `GlobalMaxRenderPanel.tsx:818-823` (the unused-attachments triangle is the existing template). For dims-mismatch, recommend an info-circle icon (small w-4 h-4); the warning triangle stays reserved for unused-attachments.

Per RESEARCH §"OptimizeDialog COPY muted-row treatment (D-03)": Phase 6 D-109's `excludedUnused` muted-note treatment is the precedent. Reuse `text-fg-muted` color contract; add `opacity-60` + bordered uppercase `text-[10px]` chip for the per-row "COPY" indicator label.

Per CONTEXT D-04 REVISED: the round-trip test asserts the GENEROUS passthrough formula. With PNGs halved (canonical 1000 → actual 500), peakScale recomputed against canonical produces some scale; whether `isCapped` or `peakAlreadyAtOrBelowSource` branches, isPassthrough fires and the row lands in passthroughCopies.

Per CLAUDE.md fact #5 + R8: panel + modal changes are renderer-only; OptimizeDialog renders the array shape but doesn't reach for fs.copyFile (image-worker handles that — landed in Plan 22-04). Layer 3 invariant unaffected.

Purpose: This is the last plan; it makes Phase 22 user-visible. Without DIMS-02 the user has no signal that drift exists; without DIMS-04 OptimizeDialog the user can't tell which files will be byte-copied vs Lanczos'd; without the actualSource label fix users see misleading canonical dims on passthrough rows; without DIMS-05 round-trip integration we have no automated proof that re-running Optimize on already-optimized images produces zero exports.

Output: Phase 22 user-visible — badges + COPY chip + correct on-disk dims label + round-trip safety covered by tests + HUMAN-UAT visual confirmation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-CONTEXT.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-VALIDATION.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-04-renderer-mirror-and-image-worker-SUMMARY.md

<interfaces>
DisplayRow read fields used here (added in Plan 22-01):
- row.dimsMismatch: boolean
- row.actualSourceW: number | undefined
- row.actualSourceH: number | undefined
- row.canonicalW: number
- row.canonicalH: number

ExportRow read fields used here (added in Plan 22-01 Task 1 Step 3; populated in Plan 22-03 Task 1 Step 5):
- row.actualSourceW?: number    // populated only on passthrough rows
- row.actualSourceH?: number    // populated only on passthrough rows
- row.sourceW: number           // canonical dim (always populated)
- row.sourceH: number           // canonical dim (always populated)

ExportPlan read field (added in Plan 22-01):
- plan.passthroughCopies: ExportRow[]

Tooltip wording (LOCKED verbatim per ROADMAP DIMS-02):
"Source PNG ({actualW}×{actualH}) is smaller than canonical region dims ({canonicalW}×{canonicalH}). Optimize will cap at source size."

Inline-SVG warning template (REFERENCE — at GlobalMaxRenderPanel.tsx:818-823):
```tsx
<span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5">
  <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
    <path d="M10 3 L18 16 L2 16 Z" />
    <path d="M10 8 v4 M10 14.5 v0.01" />
  </svg>
</span>
```
For DIMS-02 badge: scale down to w-4 h-4; pick info-circle SVG (the warning triangle is reserved for unused-attachments).

Phase 6 D-109 muted-row precedent (REFERENCE — at OptimizeDialog.tsx:458-462):
```tsx
{plan.excludedUnused.length > 0 && (
  <p className="mt-3 text-xs text-fg-muted">
    {plan.excludedUnused.length} unused attachments excluded — see Global panel.
  </p>
)}
```
For passthroughCopies: per-row `<li>` with `opacity-60` + `text-fg-muted` + bordered "COPY" chip + actualSource-aware dim label.

Phase 21 fixture (REFERENCE — for DIMS-05 round-trip):
fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json + fixtures/SIMPLE_PROJECT_NO_ATLAS/images/*.png
The test halves every PNG in tmpDir (NOT in-place — fixture stays clean).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: DIMS-02 badge UI in both panels + RTL conditional-render tests</name>
  <read_first>
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (entire file — focus: line 65 imports; lines 186-206 enrichWithEffective; line 424 Source W×H td; lines 818-823 unused-attachments inline-SVG template; line 460 conditional-render override-percent pattern)
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx (lines 651-653 Source W×H td — sibling patch site)
    - tests/renderer/global-max-virtualization.spec.tsx (lines 43-78 jsdom polyfill block; lines 89-114 makeRow helper; lines 163-183 existing describe pattern)
    - tests/renderer/anim-breakdown-virtualization.spec.tsx (sibling makeRow + tests)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-02 Implementation > Badge UI integration; § DIMS-02 > Iconography; § DIMS-02 > Why no React component test for the tooltip itself)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/renderer/src/panels/GlobalMaxRenderPanel.tsx — inline-SVG, conditional-render, tooltip-via-title patterns; § src/renderer/src/panels/AnimationBreakdownPanel.tsx)
  </read_first>
  <behavior>
    - Test 1 (GlobalMaxRenderPanel — badge present): render panel with one row where dimsMismatch=true, actualSourceW=811, actualSourceH=962, canonicalW=1628, canonicalH=1908. screen.getByLabelText(/source png dims differ/i) returns the badge element. Tooltip text via getAttribute('title') matches verbatim ROADMAP DIMS-02 wording with substituted values.
    - Test 2 (GlobalMaxRenderPanel — badge absent): render panel with default makeRow (dimsMismatch=false). screen.queryByLabelText(/source png dims differ/i) returns null.
    - Test 3 (AnimationBreakdownPanel — badge present): same shape via the sibling spec file's BreakdownRow + makeDriftedRow helper.
    - Test 4 (AnimationBreakdownPanel — badge absent): same.
  </behavior>
  <action>
    Step 1: Edit src/renderer/src/panels/GlobalMaxRenderPanel.tsx. Find Source W×H `<td>` (line 424). Wrap the existing `{row.originalSizeLabel}` with a conditional badge insertion:

    ```tsx
    <td className="py-2 px-3 font-mono text-sm text-fg text-right">
      {row.originalSizeLabel}
      {row.dimsMismatch && row.actualSourceW !== undefined && row.actualSourceH !== undefined && (
        <span
          aria-label={`Source PNG dims differ from canonical: source ${row.actualSourceW}×${row.actualSourceH}, canonical ${row.canonicalW}×${row.canonicalH}`}
          title={`Source PNG (${row.actualSourceW}×${row.actualSourceH}) is smaller than canonical region dims (${row.canonicalW}×${row.canonicalH}). Optimize will cap at source size.`}
          className="inline-flex items-center justify-center w-4 h-4 ml-1 align-middle text-warning"
        >
          {/* Phase 22 DIMS-02 badge — info-circle iconography (warning-triangle is reserved for unused-attachments per GlobalMaxRenderPanel.tsx:818-823). */}
          <svg viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none" className="w-4 h-4">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5 v4 M8 11.5 v0.01" />
          </svg>
        </span>
      )}
    </td>
    ```

    Both `aria-label` and `title` carry the FULL tooltip text (a11y + mouse-hover both supported). The verbatim ROADMAP DIMS-02 wording is preserved in `title` for the user-facing tooltip; `aria-label` is paraphrased for screen readers.

    Step 2: Mirror identical badge in src/renderer/src/panels/AnimationBreakdownPanel.tsx. Find Source W×H `<td>` (lines 651-653). Apply the same JSX block verbatim — Phase 19 D-06 visual unification contract demands sibling-identical treatment.

    Step 3: Extend tests/renderer/global-max-virtualization.spec.tsx. First, update the existing makeRow helper (lines 89-114) to include the new fields with default values:
    ```typescript
    function makeRow(i: number): DisplayRow {
      const name = `attachment-${String(i).padStart(4, '0')}`;
      return {
        // ... existing 19 fields ...
        sourcePath: `/fake/${name}.png`,
        canonicalW: 64,
        canonicalH: 64,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      };
    }
    ```
    (Plan 22-01 already touched these tests as part of the type cascade audit; this Task may need to revisit if the field defaults differ.)

    Add a new makeDriftedRow helper:
    ```typescript
    function makeDriftedRow(i: number): DisplayRow {
      return {
        ...makeRow(i),
        canonicalW: 1628,
        canonicalH: 1908,
        actualSourceW: 811,
        actualSourceH: 962,
        dimsMismatch: true,
      };
    }
    ```

    Add a new describe block:
    ```typescript
    describe('GlobalMaxRenderPanel — DIMS-02 dims-mismatch badge (Phase 22)', () => {
      it('renders dims-mismatch badge when row.dimsMismatch === true', () => {
        const rows = [makeDriftedRow(0)];
        render(<PanelTestHarness rows={rows} />);  // adapt to existing harness shape
        const badge = screen.getByLabelText(/source png dims differ/i);
        expect(badge).toBeInTheDocument();
        // Title attribute carries the verbatim ROADMAP DIMS-02 wording
        expect(badge.getAttribute('title')).toContain('Source PNG (811×962) is smaller than canonical region dims (1628×1908)');
        expect(badge.getAttribute('title')).toContain('Optimize will cap at source size');
      });

      it('does NOT render badge when row.dimsMismatch === false', () => {
        const rows = [makeRow(0)];
        render(<PanelTestHarness rows={rows} />);
        expect(screen.queryByLabelText(/source png dims differ/i)).toBeNull();
      });

      it('badge is absent when actualSource is undefined (atlas-extract path)', () => {
        const rows = [{ ...makeRow(0), dimsMismatch: false }];  // no actualSource → predicate guard
        render(<PanelTestHarness rows={rows} />);
        expect(screen.queryByLabelText(/source png dims differ/i)).toBeNull();
      });
    });
    ```

    Adapt `<PanelTestHarness>` to whatever the existing virtualization-spec uses (it likely renders the panel with a fixed rowCount; you may need a variant accepting explicit rows[] for these tests).

    Step 4: Mirror in tests/renderer/anim-breakdown-virtualization.spec.tsx. Adapt the makeDriftedRow helper to the BreakdownRow shape (extends DisplayRow with bonePath + bonePathLabel). Same describe block + assertions.

    Step 5: Run `npx vitest run tests/renderer/global-max-virtualization.spec.tsx tests/renderer/anim-breakdown-virtualization.spec.tsx -t "DIMS-02"` to confirm new tests pass.
  </action>
  <verify>
    <automated>npx vitest run tests/renderer/global-max-virtualization.spec.tsx tests/renderer/anim-breakdown-virtualization.spec.tsx -t "DIMS-02"</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "dimsMismatch" src/renderer/src/panels/GlobalMaxRenderPanel.tsx returns greater than or equal 1
    - grep -c "dimsMismatch" src/renderer/src/panels/AnimationBreakdownPanel.tsx returns greater than or equal 1
    - Both panels carry the verbatim ROADMAP DIMS-02 tooltip wording: grep -c "Optimize will cap at source size" src/renderer/src/panels/*.tsx returns 2 (one per panel)
    - DIMS-02 describe block in global-max-virtualization.spec.tsx: ≥ 3 new tests passing (badge present, badge absent, atlas-extract no-badge)
    - DIMS-02 describe block in anim-breakdown-virtualization.spec.tsx: ≥ 3 new tests passing
    - Tooltip carries concrete dim values: title attribute substitutes 811×962 / 1628×1908 with no template literals leaking
    - Existing virtualization tests still pass (no regression on row rendering)
  </acceptance_criteria>
  <done>Both panels render dims-mismatch badge with locked tooltip wording when row.dimsMismatch===true; absent otherwise; ≥ 6 new RTL tests across both spec files green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: OptimizeDialog COPY muted-row treatment + actualSource-aware dim label + DIMS-05 round-trip integration spec (programmatic fixture mutation)</name>
  <read_first>
    - src/renderer/src/modals/OptimizeDialog.tsx (entire file — focus: lines 4-15 imports; lines 99-108 rowStatuses Map; lines 436-465 PreFlightBody; lines 467-553 InProgressBody; lines 458-462 excludedUnused muted-note Phase 6 D-109 precedent)
    - src/shared/types.ts (ExportRow + ExportPlan post-Plan-22-01; confirm actualSourceW? + actualSourceH? optional fields present on ExportRow)
    - tests/renderer/global-max-virtualization.spec.tsx (lines 43-78 jsdom polyfill — REUSE for new optimize-dialog-passthrough.spec.tsx)
    - tests/core/loader-atlas-less.spec.ts (lines 1-130 round-trip pattern — analog template)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-04 Implementation > OptimizeDialog COPY muted-row treatment; § DIMS-05 Implementation > Round-trip fixture strategy; § R3 OptimizeDialog state-shape change ripples; § R7 Phase 21 fixture coupling)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/renderer/src/modals/OptimizeDialog.tsx; § tests/renderer/optimize-dialog-passthrough.spec.tsx; § tests/core/loader-dims-mismatch.spec.ts)
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/ (verify directory contents; count PNGs in images/)
  </read_first>
  <behavior>
    - Test 1 (PreFlightBody COPY indicator present): render OptimizeDialog with plan.passthroughCopies = [{outPath:'images/CIRCLE.png', sourceW:699, sourceH:699, outW:699, outH:699, actualSourceW:350, actualSourceH:350, ...}], plan.rows = []. screen.getByText('COPY') exists; the parent <li> has opacity-60 className.
    - Test 2 (PreFlightBody COPY indicator absent for plan.rows): render with rows=[{...}], passthroughCopies=[]. screen.queryByText('COPY') returns null.
    - Test 3 (CHECKER FIX 2026-05-02 — actualSource label): render OptimizeDialog with passthroughCopies = [{sourceW:1628, sourceH:1908, actualSourceW:811, actualSourceH:962, ...}]. Assert dim text contains "811×962" (NOT "1628×1908"). The `??` fallback must prefer actualSource over canonical sourceW.
    - Test 4 (CHECKER FIX 2026-05-02 — defensive fallback): render with passthroughCopies = [{sourceW:1000, sourceH:1000, actualSourceW:undefined, actualSourceH:undefined, ...}] (defensive case). Assert dim text falls back to "1000×1000".
    - Test 5 (InProgressBody iterates passthroughCopies first): rowStatuses Map keyed by absolute index; index 0 corresponds to first passthrough row (matches image-worker emission order from Plan 22-04 Task 2).
    - Test 6 (DIMS-05 round-trip): programmatically halve every PNG in fixtures/SIMPLE_PROJECT_NO_ATLAS/images/ to tmpDir via sharp.resize() in beforeAll. loadSkeleton(tmpDir/SIMPLE_TEST.json, {loaderMode:'atlas-less'}) → sampleSkeleton → buildSummary → buildExportPlan. Assert plan.passthroughCopies.length === fs.readdirSync(tmpDir/images).length AND plan.rows.length === 0. (R7: dynamic count.)
    - Test 7 (DIMS-05 cap output): plan.passthroughCopies[0].outW === actualSourceW (halved value); effectiveScale ≈ sourceRatio (0.5 for halved PNGs).
  </behavior>
  <action>
    Step 1: Edit src/renderer/src/modals/OptimizeDialog.tsx. In PreFlightBody (lines 436-465), AFTER the existing `plan.rows.map(...)` block but BEFORE the existing `excludedUnused` muted-note (lines 458-462), insert the passthroughCopies render block. **CHECKER FIX 2026-05-02 — render dim label using `row.actualSourceW ?? row.sourceW`:**

    ```tsx
    {/* Phase 22 DIMS-04 — passthrough byte-copies (D-03). Muted treatment
        mirrors Phase 6 D-109 excludedUnused UX. "COPY" indicator label
        identifies these as byte-copies (no Lanczos). Files DO get written
        to outDir — image-worker uses fs.promises.copyFile per Plan 22-04.

        CHECKER FIX 2026-05-02 — render the dim label with `row.actualSourceW ??
        row.sourceW`. Without the `??` fallback the dialog would label muted
        "already optimized" rows with canonical dims (e.g. 1628×1908) instead
        of the actual on-disk dims (e.g. 811×962). The math-output bytes are
        already correct (Plan 22-03 Step 5 caps cappedEffScale to sourceRatio,
        producing outW===actualSourceW); only the dialog label needed the fix.
        The `??` fallback handles the (defensive) case where actualSourceW is
        undefined despite being a passthrough row — falls back to canonical
        sourceW which matches the legacy pre-Phase-22 rendering. */}
    {plan.passthroughCopies.map((row) => (
      <li key={row.outPath} className="py-1 border-b border-border last:border-0 opacity-60">
        <span className="text-fg-muted">{row.outPath}</span>
        <span className="ml-2">{row.actualSourceW ?? row.sourceW}×{row.actualSourceH ?? row.sourceH} (already optimized)</span>
        <span className="ml-2 inline-block border border-border rounded-sm px-1 text-[10px] uppercase">COPY</span>
      </li>
    ))}
    ```

    The opacity-60 + text-fg-muted treatment matches Phase 6 D-109 muted color contract; the `border border-border rounded-sm px-1 text-[10px] uppercase` chip is the per-row "COPY" indicator (visually distinct from the summary-line excludedUnused note below). The `??` fallback is the CHECKER FIX from 2026-05-02.

    Step 2: Update InProgressBody (lines 467-553). The rowStatuses Map is keyed by absolute index from image-worker's progress events. After Plan 22-04 Task 2, index 0..passthroughCopies.length-1 land on passthrough rows; passthroughCopies.length..total-1 land on resize rows. Iterate `[...plan.passthroughCopies, ...plan.rows]` instead of just `plan.rows`. **For passthrough rows, render the dim label using the same `??` fallback:**

    ```tsx
    {[...plan.passthroughCopies, ...plan.rows].map((row, absIndex) => {
      const isPassthrough = absIndex < plan.passthroughCopies.length;
      const status = (props.rowStatuses.get(absIndex) ?? 'idle') as RowStatus;
      // existing status icon + outPath + sourceW × sourceH → outW × outH render
      // For passthrough rows, render dim label with actualSource fallback + COPY chip:
      const sourceLabel = isPassthrough
        ? `${row.actualSourceW ?? row.sourceW}×${row.actualSourceH ?? row.sourceH}`  // CHECKER FIX 2026-05-02
        : `${row.sourceW}×${row.sourceH}`;
      return (
        <li key={row.outPath} className={isPassthrough ? "py-1 border-b border-border opacity-60" : "py-1 border-b border-border"}>
          {/* ... existing status icon (✓/⚠/·/○) + outPath + sourceLabel + dim-arrow text + outW × outH ... */}
          {isPassthrough && (
            <span className="ml-2 inline-block border border-border rounded-sm px-1 text-[10px] uppercase">COPY</span>
          )}
        </li>
      );
    })}
    ```

    Note: for passthrough rows, sourceLabel === outW × outH by construction (the cap formula in Plan 22-03 Step 5 produces outW===actualSourceW). The "→" arrow can be omitted for passthrough rows since input and output dims are identical, OR rendered with both halves the same (visual choice — match whichever pattern reads cleanest in the existing dialog).

    Step 3: Create tests/renderer/optimize-dialog-passthrough.spec.tsx. Adapt the jsdom polyfill block from tests/renderer/global-max-virtualization.spec.tsx (lines 43-78) if needed; OptimizeDialog uses no virtualization, so polyfills may be unnecessary (verify before importing).

    ```typescript
    import { describe, expect, it } from 'vitest';
    import { render, screen } from '@testing-library/react';
    import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
    import type { ExportPlan } from '../../src/shared/types';

    function makePlan(opts: {
      rows?: ExportPlan['rows'];
      passthroughCopies?: ExportPlan['passthroughCopies'];
    }): ExportPlan {
      return {
        rows: opts.rows ?? [],
        excludedUnused: [],
        passthroughCopies: opts.passthroughCopies ?? [],
        totals: { count: (opts.rows?.length ?? 0) + (opts.passthroughCopies?.length ?? 0) },
      };
    }

    describe('OptimizeDialog — DIMS-04 passthrough COPY indicator (Phase 22)', () => {
      it('renders COPY chip for plan.passthroughCopies entries', () => {
        const plan = makePlan({
          passthroughCopies: [{
            sourcePath: '/fake/CIRCLE.png',
            outPath: 'images/CIRCLE.png',
            sourceW: 699, sourceH: 699,
            outW: 699, outH: 699,
            effectiveScale: 1.0,
            attachmentNames: ['CIRCLE'],
            actualSourceW: 699,
            actualSourceH: 699,
          }],
        });
        render(<OptimizeDialog plan={plan} {/* adapt to existing prop shape */} />);
        const copyChip = screen.getByText('COPY');
        expect(copyChip).toBeInTheDocument();
        // Parent <li> carries opacity-60 muted treatment
        const li = copyChip.closest('li');
        expect(li?.className).toMatch(/opacity-60/);
      });

      it('does NOT render COPY chip for plan.rows entries', () => {
        const plan = makePlan({
          rows: [{
            sourcePath: '/fake/CIRCLE.png',
            outPath: 'images/CIRCLE.png',
            sourceW: 699, sourceH: 699,
            outW: 350, outH: 350,
            effectiveScale: 0.5,
            attachmentNames: ['CIRCLE'],
          }],
        });
        render(<OptimizeDialog plan={plan} {/* ... */} />);
        expect(screen.queryByText('COPY')).toBeNull();
      });

      it('renders BOTH normal rows AND COPY chip in mixed plan', () => {
        const plan = makePlan({
          rows: [{
            sourcePath: '/fake/RESIZED.png', outPath: 'images/RESIZED.png',
            sourceW: 699, sourceH: 699, outW: 350, outH: 350,
            effectiveScale: 0.5, attachmentNames: ['RESIZED'],
          }],
          passthroughCopies: [{
            sourcePath: '/fake/PASSTHROUGH.png', outPath: 'images/PASSTHROUGH.png',
            sourceW: 699, sourceH: 699, outW: 699, outH: 699,
            effectiveScale: 1.0, attachmentNames: ['PASSTHROUGH'],
            actualSourceW: 699, actualSourceH: 699,
          }],
        });
        render(<OptimizeDialog plan={plan} {/* ... */} />);
        expect(screen.getByText('COPY')).toBeInTheDocument();
        // Both rows present (one with COPY, one without)
        expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
      });

      it('PreFlightBody passthrough rows render with text-fg-muted color', () => {
        const plan = makePlan({
          passthroughCopies: [{
            sourcePath: '/fake/CIRCLE.png', outPath: 'images/CIRCLE.png',
            sourceW: 699, sourceH: 699, outW: 699, outH: 699,
            effectiveScale: 1.0, attachmentNames: ['CIRCLE'],
            actualSourceW: 699, actualSourceH: 699,
          }],
        });
        const { container } = render(<OptimizeDialog plan={plan} {/* ... */} />);
        const muted = container.querySelector('.text-fg-muted');
        expect(muted).not.toBeNull();
      });

      it('CHECKER FIX 2026-05-02 — passthrough row label shows actualSource dims (NOT canonical sourceW/H)', () => {
        // Drifted row: canonical 1628×1908, actual on-disk 811×962. Dialog must
        // render "811×962 (already optimized)" — NOT "1628×1908 (already optimized)".
        const plan = makePlan({
          passthroughCopies: [{
            sourcePath: '/fake/DRIFTED.png', outPath: 'images/DRIFTED.png',
            sourceW: 1628, sourceH: 1908,    // canonical
            outW: 811, outH: 962,             // capped to actualSource
            effectiveScale: 0.498,
            attachmentNames: ['DRIFTED'],
            actualSourceW: 811,               // populated by Plan 22-03 Step 5
            actualSourceH: 962,
          }],
        });
        render(<OptimizeDialog plan={plan} {/* ... */} />);
        // Dim label uses actualSource (811×962), NOT canonical sourceW/H (1628×1908)
        expect(screen.getByText(/811×962/)).toBeInTheDocument();
        expect(screen.queryByText(/1628×1908/)).toBeNull();
      });

      it('CHECKER FIX 2026-05-02 — defensive fallback when actualSourceW undefined', () => {
        // Defensive case: passthrough row without actualSource (rare; e.g. edge case
        // where dimsMismatch is true but actualSource fields didn't propagate). The
        // `??` fallback uses sourceW/H so the dialog still renders something sensible.
        const plan = makePlan({
          passthroughCopies: [{
            sourcePath: '/fake/EDGE.png', outPath: 'images/EDGE.png',
            sourceW: 1000, sourceH: 1000,
            outW: 1000, outH: 1000,
            effectiveScale: 1.0,
            attachmentNames: ['EDGE'],
            // actualSourceW + actualSourceH intentionally omitted (undefined)
          }],
        });
        render(<OptimizeDialog plan={plan} {/* ... */} />);
        // Falls back to canonical sourceW/H (1000×1000)
        expect(screen.getByText(/1000×1000/)).toBeInTheDocument();
      });
    });
    ```

    Adapt OptimizeDialog props to the actual component signature (it likely takes more than just `plan` — open / onClose / state machine props). Use minimum-viable props for these tests.

    Step 4: Create tests/core/loader-dims-mismatch.spec.ts for DIMS-05 round-trip. Use the analog from tests/core/loader-atlas-less.spec.ts:

    ```typescript
    import { afterAll, beforeAll, describe, expect, it } from 'vitest';
    import * as fs from 'node:fs';
    import * as path from 'node:path';
    import * as os from 'node:os';
    import sharp from 'sharp';
    import { loadSkeleton } from '../../src/core/loader.js';
    import { sampleSkeleton } from '../../src/core/sampler.js';  // adapt to existing API
    import { buildSummary } from '../../src/main/summary.js';
    import { buildExportPlan } from '../../src/core/export.js';

    const FIXTURE_SRC = path.resolve(__dirname, '../../fixtures/SIMPLE_PROJECT_NO_ATLAS');
    let tmpDir: string;

    beforeAll(async () => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-drifted-'));
      // Copy JSON unchanged
      fs.copyFileSync(
        path.join(FIXTURE_SRC, 'SIMPLE_TEST.json'),
        path.join(tmpDir, 'SIMPLE_TEST.json'),
      );
      fs.mkdirSync(path.join(tmpDir, 'images'));
      // Halve every PNG in images/
      const srcImages = path.join(FIXTURE_SRC, 'images');
      for (const file of fs.readdirSync(srcImages)) {
        if (!file.endsWith('.png')) continue;
        const meta = await sharp(path.join(srcImages, file)).metadata();
        await sharp(path.join(srcImages, file))
          .resize(Math.ceil(meta.width! / 2), Math.ceil(meta.height! / 2), { kernel: 'lanczos3' })
          .png()
          .toFile(path.join(tmpDir, 'images', file));
      }
    });

    afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    describe('Phase 22 DIMS-05 round-trip — already-optimized images (Phase 22)', () => {
      it('DIMS-05: every drifted row lands in passthroughCopies; rows[] is empty', () => {
        const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'), { loaderMode: 'atlas-less' });
        const sampled = sampleSkeleton(load);  // adapt to existing API
        const summary = buildSummary(load, sampled, /* whatever existing signature */);
        const plan = buildExportPlan(summary, new Map());

        // Phase 22 R7 mitigation — read fixture file count dynamically; never hardcode
        const fileCount = fs.readdirSync(path.join(tmpDir, 'images')).filter((f) => f.endsWith('.png')).length;
        expect(plan.passthroughCopies.length).toBe(fileCount);
        expect(plan.rows.length).toBe(0);
      });

      it('DIMS-05: passthrough rows have effectiveScale ≈ 0.5 (halved PNGs) and outW === actualSourceW', () => {
        const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'), { loaderMode: 'atlas-less' });
        const sampled = sampleSkeleton(load);
        const summary = buildSummary(load, sampled);
        const plan = buildExportPlan(summary, new Map());
        // Pick the first passthrough row with a definite actualSource
        const row = plan.passthroughCopies[0];
        expect(row.effectiveScale).toBeLessThanOrEqual(0.51);  // ≤ 0.5 + tiny ceil-thousandth wobble
        // outW = ceil(canonicalW × effScale) ≈ actualSourceW (halved)
        // canonical was 1000 → actual halved to 500; outW ≈ 500
        // adapt assertion to whichever row this test inspects
        expect(row.outW).toBeLessThanOrEqual(row.sourceW * 0.51);
      });

      it('DIMS-05: re-running runExport on a passthrough plan produces byte-identical PNGs (no double Lanczos)', async () => {
        // Optional integration: run the plan through runExport; assert output PNGs are
        // byte-identical to the halved tmpDir fixtures (Buffer.compare === 0)
        // This requires importing src/main/image-worker runExport — adapt as needed.
        // SKIPPED if test infra cost too high; tests/main/image-worker.passthrough.spec.ts
        // already covers byte-identical for a single row.
      });
    });
    ```

    Adapt API surface to existing imports: `sampleSkeleton` may be in `src/main/sampler-runner.ts` / `src/core/sampler.ts`; `buildSummary` signature varies. Look at tests/core/loader-atlas-less.spec.ts for the canonical chain shape.

    Step 5: Run all new tests:
    ```bash
    npx vitest run tests/renderer/optimize-dialog-passthrough.spec.tsx tests/core/loader-dims-mismatch.spec.ts
    ```
    Iterate until green.

    Step 6: Full suite:
    ```bash
    npm run test
    ```
    Verify zero regressions; total count goes up by ~14-17 (DIMS-02 panel tests + OptimizeDialog tests + CHECKER FIX label tests + DIMS-05 round-trip).
  </action>
  <verify>
    <automated>npx vitest run tests/renderer/optimize-dialog-passthrough.spec.tsx tests/core/loader-dims-mismatch.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "passthroughCopies" src/renderer/src/modals/OptimizeDialog.tsx returns greater than or equal 2 (PreFlightBody + InProgressBody iterations)
    - grep -c "COPY" src/renderer/src/modals/OptimizeDialog.tsx returns greater than or equal 1 (chip rendering)
    - grep -c "opacity-60" src/renderer/src/modals/OptimizeDialog.tsx returns greater than or equal 1 (muted treatment)
    - grep -E "actualSourceW\\s*\\?\\?\\s*" src/renderer/src/modals/OptimizeDialog.tsx returns greater than or equal 1 (CHECKER FIX — actualSource fallback in PreFlightBody)
    - grep -E "actualSourceH\\s*\\?\\?\\s*" src/renderer/src/modals/OptimizeDialog.tsx returns greater than or equal 1 (CHECKER FIX — actualSource fallback in PreFlightBody)
    - tests/renderer/optimize-dialog-passthrough.spec.tsx: ≥ 6 tests passing (COPY present in passthrough, absent in rows, mixed plan, text-fg-muted, CHECKER FIX actualSource label, CHECKER FIX defensive fallback)
    - tests/core/loader-dims-mismatch.spec.ts: ≥ 2 tests passing (round-trip count + effective-scale check)
    - DIMS-05 round-trip uses dynamic fs.readdirSync().length (R7); grep -c "fs.readdirSync" tests/core/loader-dims-mismatch.spec.ts returns greater than or equal 1
    - DIMS-05 round-trip does NOT hardcode the count (e.g., grep "passthroughCopies\\.length).toBe(4)" returns 0 hits)
    - Programmatic fixture mutation present: grep -c "sharp" tests/core/loader-dims-mismatch.spec.ts returns greater than or equal 1
    - Full suite green: npm run test passes at baseline + all new tests
  </acceptance_criteria>
  <done>OptimizeDialog renders muted COPY chip for passthrough rows with actualSource-aware dim label (`row.actualSourceW ?? row.sourceW`); ≥ 6 RTL tests in tests/renderer/optimize-dialog-passthrough.spec.tsx green (including 2 CHECKER FIX label tests); DIMS-05 round-trip integration spec green with dynamic readdirSync count + sharp programmatic mutation.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: HUMAN-UAT — Visual confirmation of DIMS-02 badge + DIMS-04 COPY indicator + actualSource label + DIMS-05 round-trip behavior</name>
  <what-built>
    Phase 22 user-facing surfaces:
    - DIMS-02 badge icon + tooltip in GlobalMaxRenderPanel + AnimationBreakdownPanel (Task 1)
    - DIMS-04 muted COPY chip in OptimizeDialog PreFlightBody + InProgressBody (Task 2)
    - CHECKER FIX 2026-05-02 — passthrough row label shows actual on-disk dims (e.g. 811×962) NOT canonical dims (e.g. 1628×1908) in the "already optimized" label (Task 2)
    - DIMS-05 round-trip behavior: re-running Optimize on already-optimized images produces zero Lanczos resamples (passthrough byte-copies instead) — covered by automated tests/core/loader-dims-mismatch.spec.ts (Task 2)
  </what-built>
  <how-to-verify>
    1. **Setup a drifted project for visual UAT:**
       ```bash
       # Create a tmpdir copy of fixtures/SIMPLE_PROJECT_NO_ATLAS/ with halved PNGs
       cp -r fixtures/SIMPLE_PROJECT_NO_ATLAS /tmp/uat-drifted
       # Halve every PNG via sharp (or equivalent — the test suite proves the logic)
       node -e "const sharp = require('sharp'); const fs = require('fs'); const path = require('path'); const dir = '/tmp/uat-drifted/images'; for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.png'))) { sharp(path.join(dir, f)).metadata().then(m => sharp(path.join(dir, f)).resize(Math.ceil(m.width/2), Math.ceil(m.height/2)).png().toFile(path.join(dir, f) + '.tmp').then(() => fs.renameSync(path.join(dir, f) + '.tmp', path.join(dir, f)))); }"
       ```

    2. **Launch dev mode:**
       ```bash
       npm run dev
       ```
       Wait for Electron window to appear.

    3. **Load /tmp/uat-drifted/SIMPLE_TEST.json** (drag-drop or File→Open). Loader should detect atlas-less mode automatically (Phase 21 behavior).

    4. **DIMS-02 badge verification (Global Max Render Source panel):**
       - Locate the panel (top of main view).
       - Every row whose source PNG was halved should display a small info-circle badge after the Source W×H column.
       - Hover over the badge: tooltip appears with text matching `Source PNG (XXX×YYY) is smaller than canonical region dims (XXXX×YYYY). Optimize will cap at source size.`
       - Verify dim numbers are concrete (no template-literal leakage like `${row.actualSourceW}`).
       - Verify badge does NOT appear on rows where dimsMismatch is false.
       - Visual check: badge size + color reads as consistent with the existing unused-attachments warning triangle (similar weight, same color tokens).

    5. **DIMS-02 badge verification (Animation Breakdown panel):**
       - Switch to Animation Breakdown panel.
       - Same badge present on dimsMismatch rows; absent otherwise.
       - Phase 19 D-06 invariant: badge JSX should be byte-identical between the two panels (visual confirmation: same position relative to the Source W×H column).

    6. **DIMS-04 COPY indicator + actualSource label verification (OptimizeDialog):**
       - Click "Optimize Assets" button.
       - PreFlightBody renders the file list:
         - Rows that will get Lanczos'd: normal styling.
         - Rows that will be byte-copied (passthrough): muted opacity (~60%) + small bordered "COPY" chip after the dim text.
       - **CHECKER FIX 2026-05-02 verification:** The dim label on passthrough rows should read the **actual on-disk dims** (e.g. "350×350 (already optimized)" if the halved PNG is 350×350). It should NOT show the canonical dims (e.g. "699×699"). If you see "699×699" instead of "350×350" on a halved-PNG row, the actualSource propagation is broken — file a defect.
       - Verify the COPY chip placement reads consistently with the excludedUnused muted-row treatment elsewhere in the dialog.
       - Hit "Optimize" to start export. InProgressBody:
         - Progress events for passthrough rows fire FIRST (lower indices).
         - Resize events fire AFTER (higher indices).
         - COPY chip persists during in-progress rendering.
         - Passthrough row dim labels still show actualSource dims (not canonical).

    7. **DIMS-05 round-trip verification (manual):**
       - Pick an output directory; run Optimize Assets to completion.
       - Inspect the output `images/` folder:
         - Every input PNG has a corresponding output PNG.
         - Output PNGs that came via passthrough should be byte-identical to the inputs (verify via `cmp -s /tmp/uat-drifted/images/CIRCLE.png /path/to/output/images/CIRCLE.png` — should report no difference).
         - If you halve again and re-run Optimize, the output is again byte-identical (no quality degradation across repeated runs — DIMS-05 round-trip safety).

    8. **Layout sanity check (Phase 19 invariant):**
       - With the badge visible on Global panel rows, verify the toolbar / sticky-header layout does NOT shift horizontally.
       - Verify the AppShell root still uses min-h-screen (memory invariant `project_layout_fragility_root_min_h_screen.md`); per-row badge addition should not affect document height.

    9. **Dark mode + zoom check:**
       - Toggle dark mode (if app supports); badge should remain visible + tooltip readable.
       - Browser zoom 100% / 125% / 150%: badge dims scale appropriately (w-4 h-4 base; no clipping).
  </how-to-verify>
  <resume-signal>Type "approved" if all 9 checks pass, OR describe issues per category (badge visual / tooltip wording / COPY chip placement / actualSource label correctness / round-trip behavior / layout shift). Issues route to a follow-up plan or backlog per severity.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer panel render | row.dimsMismatch + row.canonicalW/H + row.actualSourceW/H flow into JSX template literals; user-visible string |
| OptimizeDialog state shape | rowStatuses Map keyed by absolute index; image-worker emits absolute index across both arrays |
| OptimizeDialog dim label | row.actualSourceW + row.actualSourceH (passthrough-only optional fields) flow into dim label JSX; must use ?? sourceW/H fallback to avoid misleading canonical-dim display |
| programmatic test fixture | tmpdir cleanup must run on test failure (afterAll); sharp.resize() runs in test-process Node (not Electron renderer) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-22-20 | Information disclosure | Tooltip leaks template literals (e.g. ${row.actualSourceW}) instead of substituted values | mitigate | Test 1 in Task 1 asserts substituted values in title attribute (e.g. "(811×962)"); HUMAN-UAT step 4 visually confirms |
| T-22-21 | Tampering | OptimizeDialog rowStatuses Map collides between passthrough and resize arrays | mitigate | Plan 22-04 Task 2 establishes single absolute-index space; Task 2 here iterates [...passthroughCopies, ...rows] in the same order; integration confirmed via T-04 mixed-plan test |
| T-22-22 | Denial of service | DIMS-05 round-trip leaves stale tmpdir on test failure | mitigate | afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true })) in beforeAll/afterAll lifecycle; runs even if test throws |
| T-22-23 | Information disclosure | Badge tooltip in screen readers verbose enough for accessibility users | accept | aria-label + title both carry full sentence; explicit a11y design decision (RESEARCH §DIMS-02 > A11y) |
| T-22-24 | Repudiation | DIMS-05 fixture count hardcoded → Phase 21 fixture evolution silently breaks | mitigate | Test uses fs.readdirSync(images/).length dynamically (R7) — adapts to fixture changes |
| T-22-25 | Information disclosure | Layout shift when badge added to row (per memory `project_layout_fragility_root_min_h_screen.md`) | mitigate | HUMAN-UAT step 8 explicit layout check; badge inline-flex w-4 h-4 ml-1 align-middle should not push row height; if shift observed, ask user for screenshot per memory `feedback_layout_bugs_request_screenshots_early.md` |
| T-22-26 | Information disclosure | OptimizeDialog passthrough rows show misleading canonical dims instead of actual on-disk dims | mitigate | CHECKER FIX 2026-05-02 — Step 1 + Step 2 use `row.actualSourceW ?? row.sourceW` fallback in dim label; Test 5 asserts "811×962" rendered (NOT "1628×1908"); Test 6 asserts defensive fallback when actualSourceW undefined; HUMAN-UAT step 6 visually confirms |
</threat_model>

<verification>
- DIMS-02 panel tests: ≥ 6 new RTL tests across both spec files passing (3 per panel).
- DIMS-04 OptimizeDialog tests: ≥ 6 new RTL tests passing (4 base + 2 CHECKER FIX label tests).
- DIMS-05 round-trip spec: ≥ 2 new tests passing; uses dynamic readdirSync count.
- Programmatic fixture mutation via sharp.resize() — no new committed binary fixtures.
- HUMAN-UAT 9 checks: badges visible + tooltip wording substituted + COPY chip placed + actualSource label correct + round-trip byte-identical + layout sanity.
- Full vitest suite green; total count up by ~14-17 from Wave 0 baseline.
</verification>

<success_criteria>
1. DIMS-02 badge renders in both panels conditional on row.dimsMismatch===true; tooltip wording matches ROADMAP DIMS-02 verbatim with substituted dim values.
2. DIMS-04 OptimizeDialog PreFlightBody + InProgressBody render muted COPY chip for passthroughCopies rows; rows[] entries unaffected.
3. CHECKER FIX 2026-05-02 — passthrough row dim label uses `row.actualSourceW ?? row.sourceW` (and same for H) so users see concrete on-disk dims (e.g. 811×962) instead of canonical dims (e.g. 1628×1908).
4. DIMS-05 round-trip integration: drifted-project load + buildExportPlan produces passthroughCopies.length === fileCount AND rows.length === 0.
5. Phase 21 fixture coupling neutralized: dynamic fs.readdirSync count (R7).
6. Programmatic fixture mutation via sharp.resize() in beforeAll (no new committed binary fixtures).
7. HUMAN-UAT visual confirmation across 9 check categories.
8. Layout invariant from memory `project_layout_fragility_root_min_h_screen.md` preserved (no horizontal toolbar shift on badge addition).
</success_criteria>

<output>
After completion, create `.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-05-panels-modal-and-roundtrip-SUMMARY.md`
</output>
