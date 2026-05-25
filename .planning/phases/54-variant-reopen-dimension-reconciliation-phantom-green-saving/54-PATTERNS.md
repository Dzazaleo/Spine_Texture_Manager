# Phase 54: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 6 (4 modified, 2 created)
**Analogs found:** 6 / 6

> Read-only mapping. The only file written by this agent is this PATTERNS.md.
> Layer-3 purity gate (`tests/arch.spec.ts`): every change here is renderer-side
> (`src/renderer/...` + `tests/`); `src/core/` MUST stay untouched. The export
> path (`buildExportPlan` in both copies, `outW/outH`, the `≤ 1.0` clamp) is
> FROZEN — this phase only adds a parallel DISPLAY value.

## File Classification

| File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|------|---------|------|-----------|----------------|---------------|
| `src/renderer/src/lib/export-view.ts` | modified | utility (pure lib) | transform (read-model) | self (edit in place) | self |
| `src/renderer/src/lib/enrich-overrides.ts` | modified | utility (pure lib) | transform (read-model) | self (edit in place) | self |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | modified | component (panel) | request-response (render) | self (edit in place) | self |
| `src/renderer/src/components/AppShell.tsx` | modified | component (container) | transform (memo) | self (edit in place) | self |
| `src/renderer/src/lib/row-state.ts` | **created** | utility (pure lib) | transform | `enrich-overrides.ts` module shape + `export-view.ts safeScale`/`RowState` body in panel `:195-203` | exact (extract-in-place) |
| `tests/regression/variant-phantom-green.spec.ts` | **created** | test (vitest unit) | transform (synthetic-row) | `tests/regression/path-indirection.spec.ts` + `tests/core/export.spec.ts` | exact (RESEARCH-named) |

---

## Pattern Assignments

### `src/renderer/src/lib/export-view.ts` (utility, transform) — MODIFIED

**Analog:** the file itself. Edit in place — do NOT rewrite. RESEARCH RQ2 locks
seam (a): add the render-demand pair INSIDE `computeExportDims`.

**Current return type to extend** (`:208`):
```ts
): { effScale: number; outW: number; outH: number; displayScale: number; peakDisplayW: number; peakDisplayH: number } {
```
Add two fields → `peakDemandW: number; peakDemandH: number` (RESEARCH RQ2 `:85-88`).

**Existing `safeScale` to REUSE (do NOT inline a new one)** (`:153-155`):
```ts
export function safeScale(s: number): number {
  return Math.ceil(s * 1000) / 1000;
}
```

**The export-clamped `peakDisplayW/H` block this NEW code parallels** (`:265-272`).
`rawPeakEff` already exists at `:266`; the new demand block reuses it verbatim:
```ts
const overrideFrac = override !== undefined ? clampOverride(override) / 100 : 1;
const rawPeakEff = peakScale * overrideFrac;                              // :266 — REUSE
const peakDisplayEff = Math.min(safeScale(rawPeakEff), 1, sourceRatio);   // :270 — the buggy ≤1 clamp (LEAVE for export-dim Peak; superseded by peakDemand for display)
const peakDisplayW = Math.ceil(canonW * peakDisplayEff);                  // :271
const peakDisplayH = Math.ceil(canonH * peakDisplayEff);                  // :272
```

**Core pattern to ADD** after `:272` (RESEARCH RQ2 `:93-104`, fuzz-locked):
```ts
// Phase 54 D-01 — TRUE render demand for DISPLAY (NOT export).
// Removes ONLY the min(…, 1) canonical clamp; caps at actualSource.
// safeScale(rawPeakEff) is MANDATORY (Pitfall 1 — dropping it diverges
// ~45% of peakScale≤1 rows; keeping it = 0 divergence in realistic regime).
const actualSrcW = actualSourceW ?? canonW;
const actualSrcH = actualSourceH ?? canonH;
const peakDemandW = Math.min(Math.ceil(canonW * safeScale(rawPeakEff)), actualSrcW);
const peakDemandH = Math.min(Math.ceil(canonH * safeScale(rawPeakEff)), actualSrcH);
```
Return both in the object literal at `:274`.

**Notes / guardrails:**
- `canonW`/`canonH` already exist (`:225-226`); `actualSourceW`/`actualSourceH` are params (`:196-197`); no new inputs.
- Do NOT touch `effScale`/`outW`/`outH`/`displayScale` (`:231-249`) — export-dim contract, byte-frozen.
- Update the stale docblock at `:251-264` per RESEARCH State-of-the-Art `:388` ("Peak W×H shows render demand capped at source; outW/outH remain the export dims").
- `clampOverride`/`applyOverride` are already imported from `./overrides-view.js` (`:51`) — no new import.

---

### `src/renderer/src/lib/enrich-overrides.ts` (utility, transform) — MODIFIED

**Analog:** the file itself. Two additive edits.

**`EnrichedRow` type to extend** (`:15-23`):
```ts
export type EnrichedRow = RegionRow & {
  effectiveScale: number;
  effExportW: number;
  effExportH: number;
  displayScale: number;
  peakDisplayW: number;
  peakDisplayH: number;
  override: number | undefined;
};
```
Add `peakDemandW: number; peakDemandH: number;`.

**Destructure + spread to extend** (`:45-65`):
```ts
const { effScale, outW, outH, displayScale, peakDisplayW, peakDisplayH } = computeExportDims(
  row.sourceW, row.sourceH, row.peakScale, override,
  row.actualSourceW, row.actualSourceH, row.dimsMismatch,
  row.canonicalW, row.canonicalH,
);                                                // args UNCHANGED — additive return only
return {
  ...row,
  effectiveScale: effScale, effExportW: outW, effExportH: outH,
  displayScale, peakDisplayW, peakDisplayH, override,
};
```
Add `peakDemandW, peakDemandH` to both the destructure and the return spread (RESEARCH `:114-117`).

**Notes:** stale docblock at `:26-30` ("shows EXPORT dims") becomes inaccurate once
the Peak cell reads `peakDemand` — update wording. Module is node-included
(`tsconfig.node.json:10`) — this is the seam that lets the new `.spec.ts` import it.

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (component, render) — MODIFIED

**Analog:** the file itself. Four edits: re-import `rowState`, switch Peak cell +
both call sites to `peakDemand`, update ExtrapolationIcon copy.

**`RowState` type + `rowState` body — to be EXTRACTED to `row-state.ts`** (`:195-203`):
```ts
type RowState = 'under' | 'atLimit' | 'unused' | 'neutral' | 'missing';

function rowState(peakDisplayW: number, sourceW: number, isUnused: boolean, isMissing?: boolean): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakDisplayW < sourceW) return 'under';     // GREEN — strictly smaller integer
  if (peakDisplayW === sourceW) return 'atLimit'; // YELLOW — equal integers
  return 'neutral';
}
```
After extraction the panel imports both from `../lib/row-state.js`. Body is a
PURE integer compare — keep as-is (no epsilon; D-03 + Deferred). RESEARCH `:148-156`.

**Both call sites — switch the Peak arg to `peakDemandW`** (`:1013` and `:1137`, identical text):
```ts
const state = rowState(row.peakDisplayW, row.actualSourceW ?? row.sourceW, false, row.isMissing);
```
→ `rowState(row.peakDemandW, row.actualSourceW ?? row.sourceW, false, row.isMissing)` (RESEARCH `:146`).
The Source arg `row.actualSourceW ?? row.sourceW` stays — it is the exact numeric
form of `originalSizeLabel` (the Source cell, `:509-510`), per `analyzer.ts:132`.

**Peak cell render — switch to `peakDemand`** (`:565`):
```tsx
<span>{`${row.peakDisplayW}×${row.peakDisplayH}`}</span>
```
→ `<span>{`${row.peakDemandW}×${row.peakDemandH}`}</span>` (RESEARCH `:123`).

**Source cell (Source integers — UNCHANGED, reference)** (`:509-510`):
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">
  {row.originalSizeLabel}
```

**Tint className driven by `state`** (UNCHANGED, reference) (`:544-556`): `state === 'under'`
→ `bg-success/10` (green), `state === 'atLimit'` → `bg-warning/10` (yellow).

**ExtrapolationIcon — copy-only update** (`:566-575`):
```tsx
{row.peakScale > 1 && (
  <ExtrapolationIcon
    className="w-3.5 h-3.5 inline-block text-white"
    title={`Spine rig peak: ${row.peakScale.toFixed(2)}× source — export capped at canonical`}
  />
)}
```
The "export capped at canonical" wording is now misleading (Peak cell shows the
source-capped demand). Update per Open-Question 1 (RESEARCH `:400-403`) e.g.
"already sized to render demand". Behavior unchanged — gated by `row.peakScale > 1`.

**Notes:** `safeScale` is also used inline in the DimsBadge block (`:525-527`) —
that is the export-dim badge path; leave it untouched. The Scale column
(`displayScale`, `:587-595`) stays export-based — do NOT rebase (Pitfall 2).

---

### `src/renderer/src/components/AppShell.tsx` (component, memo) — MODIFIED

**Analog:** the file itself. Rebase `savingsPctMemo` onto per-row render demand.

**Current memo to rebase** (`:1187-1203`):
```ts
const savingsPctMemo = useMemo<number | null>(() => {
  const plan = buildExportPlan(effectiveSummary, activeOverrides, {
    skeletonPath: effectiveSummary.skeletonPath,
    safetyBufferPercent: safetyBufferPercentLocal,
  });
  if (plan.rows.length === 0) return null;
  const sumSourcePixels = plan.rows.reduce((acc, r) => acc + r.sourceW * r.sourceH, 0);
  const sumOutPixels = plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0);
  if (sumSourcePixels <= 0) return null;
  return (1 - sumOutPixels / sumSourcePixels) * 100;
}, [effectiveSummary, activeOverrides, safetyBufferPercentLocal]);
```

**Replacement pattern** (RESEARCH RQ4 `:177-191`) — sum `peakDemand` over `enrichWithEffective`
(the SAME row set the panel tints) so chip ≡ Σ per-row state:
```ts
const savingsPctMemo = useMemo<number | null>(() => {
  const enriched = enrichWithEffective(effectiveSummary.regions, activeOverrides);
  if (enriched.length === 0) return null;
  let sumSource = 0, sumDemand = 0;
  for (const r of enriched) {
    const srcW = r.actualSourceW ?? r.sourceW;
    const srcH = r.actualSourceH ?? r.sourceH;
    sumSource += srcW * srcH;
    sumDemand += r.peakDemandW * r.peakDemandH;   // capped at source ⇒ ≤ srcW*srcH
  }
  if (sumSource <= 0) return null;
  return (1 - sumDemand / sumSource) * 100;
}, [effectiveSummary, activeOverrides]);
```

**Import to ADD** — AppShell does NOT yet import `enrichWithEffective`. Existing import
block (`:73-74`):
```ts
import { clampOverride } from '../lib/overrides-view.js';
import { buildExportPlan } from '../lib/export-view.js';
```
Add: `import { enrichWithEffective } from '../lib/enrich-overrides.js';`
(`buildExportPlan` stays — still used by the 3 export call sites at `:830`, `:1048`, `:1344`.
`safetyBufferPercentLocal` drops out of the memo dep array — it does not enter render demand.)

**Notes / decisions for planner:**
- This INTENTIONALLY diverges from OptimizeDialog's savings % (export-plan-based, locked) — document the split (RESEARCH `:199`).
- Verify the `doc-export.ts` Optimization Config card (consumes `savingsPctMemo`) accepts the read-model basis (Assumption A1, RESEARCH `:394`).

---

### `src/renderer/src/lib/row-state.ts` (utility, transform) — **CREATED**

**Analog:** `src/renderer/src/lib/enrich-overrides.ts` (module shape) + the
`RowState`/`rowState` body currently in the panel (`:195-203`, extracted verbatim).

**Why a new file:** test (iii) needs `rowState`, which is unexported and lives in
a `.tsx`. RESEARCH `:336` + Wave-0 gap `:345` mandate extracting it to a pure
`lib/*.ts` so the whole spec is a single `.spec.ts` in the node program (sidesteps
the TS6307 renderer-`.ts`-test landmine, memory `feedback_renderer_ts_helper_test_breaks_typecheck_node`).

**House-style export pattern to match** (`enrich-overrides.ts:1-23`): top docblock
citing the phase, type-only `RegionRow`-style imports if needed (here: NONE), a
single exported `type` + exported `function`. The body is already pure — zero
React/DOM, zero `core/` imports (Layer-3 clean; node-included via
`tsconfig.node.json:10` `src/renderer/src/lib/**/*.ts`).

**Concrete module to write** (extracted verbatim from panel `:195-203`):
```ts
/**
 * Phase 54 — pure RowState tint decision, extracted from
 * GlobalMaxRenderPanel.tsx so tests/regression/variant-phantom-green.spec.ts
 * can import it as a .spec.ts in the node program (avoids the TS6307
 * renderer-.ts-test landmine). Zero React/DOM/core imports (Layer-3 pure).
 *
 * D-03 contract: both args are the EXACT integers rendered in the two cells —
 * peakDisplayW := row.peakDemandW (Peak cell, panel :565); sourceW :=
 * row.actualSourceW ?? row.sourceW (the numeric form of originalSizeLabel,
 * Source cell panel :509, from core/analyzer.ts:132). Pure integer compare,
 * no epsilon (D-03 + Deferred).
 */
export type RowState = 'under' | 'atLimit' | 'unused' | 'neutral' | 'missing';

export function rowState(
  peakDisplayW: number,
  sourceW: number,
  isUnused: boolean,
  isMissing?: boolean,
): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakDisplayW < sourceW) return 'under';
  if (peakDisplayW === sourceW) return 'atLimit';
  return 'neutral';
}
```

**Notes:** panel must then `import { rowState, type RowState } from '../lib/row-state.js'`
and delete its local copy (`:195-203`). Keep the `.js` extension on the import
specifier — house convention (see `enrich-overrides.ts:2` `./export-view.js`).

---

### `tests/regression/variant-phantom-green.spec.ts` (test, synthetic-row) — **CREATED**

**Analogs (RESEARCH-named):** `tests/regression/path-indirection.spec.ts` (node-env
spec that imports `enrichWithEffective` from `src/renderer/src/lib/`) and
`tests/core/export.spec.ts` (describe/it convention + import shape).

**Import + skeleton pattern from `path-indirection.spec.ts` (`:29-40`):**
```ts
// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
// …
import { enrichWithEffective } from '../../src/renderer/src/lib/enrich-overrides.js';
```

**describe/it convention from `export.spec.ts` (`:25-35`):**
```ts
import { describe, expect, it } from 'vitest';
import type { ExportPlan, RegionRow, SkeletonSummary } from '../../src/shared/types.js';
```

**Concrete imports the new spec needs** (all node-included `src/renderer/src/lib/**`
+ `src/shared` — TS6307-safe, no panel/`.tsx`, no `core/`):
```ts
import { describe, expect, it } from 'vitest';
import { computeExportDims } from '../../src/renderer/src/lib/export-view.js';
import { enrichWithEffective } from '../../src/renderer/src/lib/enrich-overrides.js';
import { rowState } from '../../src/renderer/src/lib/row-state.js';        // the NEW extracted helper
import type { RegionRow } from '../../src/shared/types.js';
```

**Test cases to write** (synthetic rows, no fixture — RESEARCH `:329-332` + `:233-242`):
- **(i) D-01 phantom-green killed** — GRAND `{canonicalW:208.5, canonicalH:63, actualSourceW:247, actualSourceH:75, peakScale:1.182, dimsMismatch:true, sourceW:247, sourceH:75}` → assert `peakDemandW === 247`, `rowState(247, 247) === 'atLimit'` (NOT `'under'`), row contributes 0 savings.
- **(ii) Master regression** — CROWN `{canonicalW:478.5, actualSourceW:211, peakScale:0.44, dimsMismatch:true}` → assert `peakDemandW === peakDisplayW` (call `computeExportDims`, compare both fields) and state preserved.
- **(iii) D-03 tint unit** — `rowState(N, N, false) === 'atLimit'` and `rowState(N-1, N, false) === 'under'` for representative integer N; assert no float path.
- Lock the §RQ5 regression table R1–R8 (`:233-242`) as additional cases.

**Notes / landmines:**
- Name it `.spec.ts` (NOT `.spec.tsx`) and import ONLY `src/renderer/src/lib/**` modules — both are in `tsconfig.node.json:10`. Importing the panel `.tsx` would trip TS6307 (Pitfall 4, RESEARCH `:271-275`).
- Synthetic-row approach commits NO fixture dir ⇒ **no `SAFE01_EXCLUDED_PREFIXES` change** (memory `feedback_new_committed_fixtures_need_safe01_denylist` does NOT apply here). RESEARCH `:326`, `:347`.
- `RegionRow` requires more fields than the synthetic snippets above show — construct a minimal valid `RegionRow` (check `src/shared/types.ts`) and cast/spread defaults; `export.spec.ts` synth helpers (`:42-55`) are the precedent for building rows from literals.

---

## Shared Patterns

### Layer-3 purity (applies to ALL files)
**Source:** `tests/arch.spec.ts:20-31` — globs `src/renderer/**/*.{ts,tsx}` and fails on
any `from '…/core/'` or `from '@core'`. **Apply to:** every modified/created renderer
file. The new `row-state.ts` and the spec import only `src/renderer/src/lib/**` +
`src/shared/**` — clean. `core/` is untouched this phase.

### `.js`-extension import specifiers (applies to all renderer lib imports)
**Source:** `enrich-overrides.ts:2` `import { computeExportDims } from './export-view.js';`
**Apply to:** the panel's new `import … from '../lib/row-state.js'`, the spec's
`from '../../src/renderer/src/lib/row-state.js'`, and AppShell's new
`from '../lib/enrich-overrides.js'`. Always `.js` even for `.ts` source (NodeNext/bundler ESM idiom).

### Pure-helper module shape (applies to `row-state.ts`)
**Source:** `enrich-overrides.ts:1-23` — phase-citing docblock, type-only imports,
single exported `type` + exported `function`, zero side effects. **Apply to:**
`row-state.ts` (no runtime imports needed at all).

### `safeScale` single-source rounding (applies to `export-view.ts`)
**Source:** `export-view.ts:153-155`. **Apply to:** the new `peakDemandW/H` math —
REUSE this exported `safeScale`; do NOT inline a copy. Dropping it = Pitfall 1
(~45% genuine-savings divergence).

### node-included test seam (applies to the new spec)
**Source:** `tsconfig.node.json:10` (`src/renderer/src/lib/**/*.ts`) +
`path-indirection.spec.ts:40` (imports `enrich-overrides` from a node `.spec.ts`).
**Apply to:** the new spec — import only `src/renderer/src/lib/**` so it typechecks
under `typecheck:node` without a `tsconfig.node.json` exclude entry.

---

## No Analog Found

None. Every file is either an in-place edit (analog = itself) or a pure
extraction/test with a strong RESEARCH-named precedent in `tests/regression/` +
`tests/core/` and `src/renderer/src/lib/`.

---

## Metadata

**Analog search scope:** `src/renderer/src/lib/`, `src/renderer/src/panels/`,
`src/renderer/src/components/`, `tests/regression/`, `tests/core/`, `tsconfig.node.json`,
`tests/arch.spec.ts`, `src/renderer/src/lib/overrides-view.ts`.
**Files scanned:** ~10 (all cited).
**Pattern extraction date:** 2026-05-25
