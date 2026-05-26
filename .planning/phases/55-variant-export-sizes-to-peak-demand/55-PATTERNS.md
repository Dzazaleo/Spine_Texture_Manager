# Phase 55: Variant Export Sizes to Peak Demand - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 4 (2 source edits, 1 call-site edit, 1 test file update)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/export.ts` | utility (pure math) | transform | `src/renderer/src/lib/export-view.ts` (parity twin) | exact |
| `src/renderer/src/lib/export-view.ts` | utility (pure math) | transform | `src/core/export.ts` (parity twin) | exact |
| `src/main/variant-export.ts` | service (orchestrator) | request-response | self — existing call site at lines 191-202 | self-patch |
| `tests/core/variant-sizing.spec.ts` | test | CRUD | self — existing describe blocks + `tests/core/export.spec.ts` parity describe | self-patch + parity model |

---

## Pattern Assignments

### `src/core/export.ts` (pure-math utility, transform)

**Change scope:** Add `variantScale?: number` to `BuildExportPlanOptions`; extract `const vs` before the region loop; lift line 279 clamp.

**Analog:** `src/renderer/src/lib/export-view.ts` (byte-identical parity twin — any change to one MUST appear in both)

**`BuildExportPlanOptions` extension pattern** (`src/core/export.ts` lines 76-112 and `src/renderer/src/lib/export-view.ts` lines 53-84):

The Phase 30 `safetyBufferPercent` field is the direct structural precedent. New field follows the identical shape: optional, JSDoc-documented, no defensive coercion inside the function (validation is the caller's contract).

```typescript
// EXISTING (Phase 30 precedent — copy this shape for variantScale):
//   src/core/export.ts lines 97-111
//   src/renderer/src/lib/export-view.ts lines 70-83
  /**
   * Phase 30 BUFFER-01 — multiplicative safety buffer (integer percent,
   * range [0, 25]). When 0 or undefined: literal no-op per D-07 (byte-
   * identical pre-Phase-30 behavior). When > 0: each row's rawEffScale is
   * multiplied by (1 + safetyBufferPercent/100) BEFORE the canonical 1.0
   * clamp and the Phase 22.1 sourceRatio cap. The cap pipeline preserves
   * D-91 (no texture surpasses source dims) regardless of buffer value.
   *
   * Validation: caller is responsible for clamping to [0, 25] and ensuring
   * integer values; OptimizeDialog onChange handler does this (UI-SPEC).
   * Out-of-range values are NOT defensively coerced here — the math
   * accepts any non-negative number, but ergonomically the caller's
   * contract is integer 0-25.
   */
  safetyBufferPercent?: number;
```

**New field to add (immediately after `safetyBufferPercent?`):**

```typescript
  /**
   * Phase 55 — variant scale factor (range (0, 1]; default 1.0 for master
   * exports). Used to lift the `effScale` ceiling from `1` to `1/s` so a
   * variant at scale `s` can size outputs up to the master-source ceiling
   * while still honoring the "no upscale relative to master source PNG"
   * contract. For masters: omit (defaults to 1.0 → 1/s = 1 → byte-identical
   * behavior by construction). Validation: caller (src/main/variant-export.ts)
   * already guards 0 < s < 1 via VariantScaleError before threading this in.
   */
  variantScale?: number;
```

**`bufferPct` extraction pattern (pre-loop, line 263 in core / line 402 in renderer) — `vs` follows the same placement:**

```typescript
// EXISTING — src/core/export.ts line 263 (inside the for-loop body):
const bufferPct = opts.safetyBufferPercent ?? 0;

// NOTE: bufferPct is currently inside the `for (const region of summary.regions)` loop.
// The research (Pitfall 3) recommends extracting `const vs` BEFORE the loop alongside
// bufferPct. The planner may either:
//   (a) hoist BOTH bufferPct and vs before the loop (cleaner), or
//   (b) add `const vs = opts.variantScale ?? 1.0;` immediately before line 279
//       if keeping bufferPct inside the loop is preferred for symmetry.
// Either placement is correct; (a) is preferred.
```

**Lift site — the one-line change** (`src/core/export.ts` line 279, `src/renderer/src/lib/export-view.ts` line 418):

```typescript
// BEFORE (both files, current):
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1);

// AFTER (both files, Phase 55):
const vs = opts.variantScale ?? 1.0;
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1 / vs);
```

**Pipeline context** (lines 259-305 in `src/core/export.ts` — the unchanged surrounding pipeline the planner must not disturb):

```typescript
// Phase 30 BUFFER-01 — Math order locked by CONTEXT D-09: raw → bufferedScale → clamp → cap.
const bufferPct = opts.safetyBufferPercent ?? 0;
const bufferedScale =
  bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100);

// [LIFT SITE — line 279 — only this line changes]
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1);  // → 1/vs

// [UNCHANGED — lines 299-305]
const { actualSourceW, actualSourceH, canonicalW, canonicalH } = region;
const sourceRatio =
  region.dimsMismatch && actualSourceW !== undefined && actualSourceH !== undefined
    ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
    : Infinity;
const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);
const isCapped = downscaleClampedScale > sourceRatio;
```

**Anti-patterns (from RESEARCH.md):**
- Do NOT apply `safeScale` to `1 / vs` — only `bufferedScale` goes through `safeScale`.
- Do NOT add `if (variantScale !== 1)` branch — universal form required (D-A / L-02).
- Do NOT change `computeExportDims` in `export-view.ts` — that is the Phase 54 display read-model, separate from `buildExportPlan`.

---

### `src/renderer/src/lib/export-view.ts` (pure-math utility, transform)

**Change scope:** Byte-identical to `src/core/export.ts` changes above. Must be edited in the same commit.

**Analog:** `src/core/export.ts` (source of truth)

The renderer's `buildExportPlan` function body is a byte-identical mirror of the core's. The two lift sites are:

- `src/renderer/src/lib/export-view.ts` line 83: add `variantScale?: number` to its own `BuildExportPlanOptions` interface (same JSDoc shape as `safetyBufferPercent` at line 70-83).
- `src/renderer/src/lib/export-view.ts` line 418: apply the identical `Math.min(safeScale(bufferedScale), 1 / vs)` lift.

The `computeExportDims` function (lines 178-329 in this file) is NOT touched. Its `Math.min(safeScale(rawEffScale), 1)` at line 234 stays as-is — it is the Phase 54 display read-model, deliberately separate.

**Parity test pattern** (from `tests/core/export.spec.ts` lines 832-911 — the parity describe block that enforces structural identity):

```typescript
// Pattern for the new parity test the planner should add (hygiene, optional per RESEARCH):
it('Phase 55 — both files declare variantScale on BuildExportPlanOptions', () => {
  const coreText = readFileSync(EXPORT_SRC, 'utf8');
  const viewText = readFileSync(VIEW_SRC, 'utf8');
  const sig = /variantScale\?\s*:\s*number/;
  expect(coreText).toMatch(sig);
  expect(viewText).toMatch(sig);
});
```

The existing parity tests (BUFFER-01, fold-key, Math.ceil, safeScale) already verify surrounding structure. The new field test mirrors the `safetyBufferPercent?` parity test at export.spec.ts line 897-903.

---

### `src/main/variant-export.ts` (orchestrator, request-response)

**Change scope:** One-line addition to the `buildExportPlan` call at lines 191-202. Add `variantScale: s` to the opts object.

**Analog:** `safetyBufferPercent: safeBuffer` at line 195 (the exact call site being extended)

**Current call site** (lines 191-202):

```typescript
// EXISTING — src/main/variant-export.ts lines 191-202
let plan: ReturnType<typeof buildExportPlan>;
try {
  plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {
    skeletonPath: summary.skeletonPath,
    safetyBufferPercent: safeBuffer, // WR-06: clamped at the trust boundary above
  });
} catch (err) {
  return {
    ok: false,
    error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
  };
}
```

**After Phase 55** (add one line to opts):

```typescript
  plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {
    skeletonPath: summary.skeletonPath,
    safetyBufferPercent: safeBuffer, // WR-06: clamped at the trust boundary above
    variantScale: s,                 // Phase 55 D-A — lifts effScale ceiling to 1/s
  });
```

**Trust boundary pattern** (`src/main/variant-export.ts` lines 96 and 135-137 — already validates `s` before this call site, so no defensive coercion needed inside `buildExportPlan`):

```typescript
// D-08 guard — rejects NaN / <=0 / >=1 (line 96):
if (!Number.isFinite(s) || s <= 0 || s >= 1) {
  return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };
}

// safeBuffer coercion (lines 135-137):
const safeBuffer = Number.isFinite(safetyBufferPercent)
  ? Math.max(0, Math.min(25, Math.trunc(safetyBufferPercent)))
  : 0;
```

`s` is already validated at line 96 (`0 < s < 1`). The master path in `src/main/ipc.ts` never calls `buildExportPlan` with `variantScale` — it omits the option entirely, which defaults to `1.0`.

---

### `tests/core/variant-sizing.spec.ts` (test, transform)

**Change scope:** Update 2 existing assertions + add 1 new `describe` block.

**Analog:** Self (existing test file) + parity describe pattern from `tests/core/export.spec.ts` lines 897-903.

**Synthetic fixture pattern** (lines 36-76 — reuse as-is for the new describe block, no new fixture files):

```typescript
// EXISTING — tests/core/variant-sizing.spec.ts lines 36-64
function region(regionName: string, peakScale: number, dim = 1000): RegionRow {
  return {
    regionName,
    attachmentName: regionName,
    skinName: 'default',
    slotName: regionName + '_SLOT',
    animationName: 'idle',
    time: 0, frame: 0,
    peakScale,
    peakScaleX: peakScale, peakScaleY: peakScale,
    worldW: dim * peakScale, worldH: dim * peakScale,
    sourceW: dim, sourceH: dim,
    isSetupPosePeak: false,
    canonicalW: dim, canonicalH: dim,
    dimsMismatch: false,
    sourcePath: '/fake/' + regionName + '.png',
    contributingAttachments: [{ attachmentName: regionName } as any],
  } as any as RegionRow;
}
```

**Update 1 — no-overrides test formula** (line 99): the comment changes; the expected VALUE is coincidentally unchanged for the BIG/0.5 case (safeScale(1.0) = 1.0 < 2.0 so clamp doesn't bind):

```typescript
// BEFORE (line 99):
const expectedEff = Math.min(safeScale(s * master.peakScale), 1);

// AFTER:
const expectedEff = Math.min(safeScale(s * master.peakScale), 1 / s);
// Comment: 'buildExportPlan's <=1/s clamp acts on the SCALED demand'
// (was '<=1.0 clamp')
```

**Update 2 — override test** (lines 134-135): this assertion CHANGES value (1.0 → 1.5):

```typescript
// BEFORE (lines 134-135):
const linearDemand = (overridePct / 100) * s * masterPeak; // 1.5
const expectedEff = Math.min(safeScale(linearDemand), 1); // 1.0

// AFTER:
const linearDemand = (overridePct / 100) * s * masterPeak; // 1.5
const expectedEff = Math.min(safeScale(linearDemand), 1 / s); // min(1.5, 2.0) = 1.5
```

The `outW` assertion at line 137 (`Math.ceil(vRow.sourceW * vRow.effectiveScale)`) stays structurally correct but will compute to 1500 (not 1000). The negative proof (line 141-143) stays valid: `wrong = s * min(safeScale(3.0), 1) = 0.5 * 1.0 = 0.5`, and `0.5 ≠ 1.5`.

Also update the call sites in this test to pass `variantScale: s` to `buildExportPlan` (the opts object needs it so the clamp formula uses the right ceiling):

```typescript
// BEFORE:
const variantPlan: ExportPlan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
  skeletonPath: SKELETON_PATH,
});

// AFTER:
const variantPlan: ExportPlan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
  skeletonPath: SKELETON_PATH,
  variantScale: s,
});
```

**New describe block pattern** (to add after the existing describe — follows the existing file's synthetic-double structure):

```typescript
describe('Phase 55 — 1/s ceiling (variantScale option)', () => {
  // T1: s × master_peakScale < 1/s → clamp does NOT bind; output = ceil(canonicalW × s × peak)
  it('T1: clean-atlas, master peak 2.5, s=0.5 → effScale = 1.25 (not clamped at 1)', () => {
    const s = 0.5;
    const summary = { regions: [region('HIGH', 2.5)], peaks: [], orphanedFiles: [] } as any;
    const plan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
      skeletonPath: SKELETON_PATH,
      variantScale: s,
    });
    const rows = [...plan.rows, ...plan.passthroughCopies];
    const row = rows.find(r => r.attachmentNames.includes('HIGH'))!;
    expect(row.effectiveScale).toBeCloseTo(safeScale(s * 2.5), 5); // 1.25, not 1.0
    expect(row.outW).toBe(Math.ceil(1000 * safeScale(s * 2.5)));   // 1250
  });

  // T2: s × master_peakScale > 1/s → clamp binds at 1/s (master-source ceiling)
  it('T2: clean-atlas, master peak 5.0, s=0.5 → effScale clamped to 1/s = 2.0 (master-source ceiling)', () => {
    const s = 0.5;
    const summary = { regions: [region('HUGE', 5.0)], peaks: [], orphanedFiles: [] } as any;
    const plan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
      skeletonPath: SKELETON_PATH,
      variantScale: s,
    });
    const rows = [...plan.rows, ...plan.passthroughCopies];
    const row = rows.find(r => r.attachmentNames.includes('HUGE'))!;
    // bufferedScale = 2.5 > 1/s = 2.0 → clamp at 2.0; outW = ceil(1000 × 2.0) = 2000
    expect(row.effectiveScale).toBeCloseTo(1 / s, 5);
    expect(row.outW).toBe(Math.ceil(1000 * (1 / s))); // 2000 = 2 × canonicalW
  });

  // T3: drifted-atlas (actualSource < canonical) — sourceRatio is the tighter ceiling
  it('T3: drifted-atlas, master peak 2.0, s=0.5 → sourceRatio (0.8) binds before 1/s (2.0)', () => {
    const s = 0.5;
    const canonical = 1000;
    const actualSource = 800;
    const r = {
      ...region('DRIFTED', 2.0, canonical),
      actualSourceW: actualSource,
      actualSourceH: actualSource,
      dimsMismatch: true,
    } as any as RegionRow;
    const summary = { regions: [r], peaks: [], orphanedFiles: [] } as any;
    const plan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
      skeletonPath: SKELETON_PATH,
      variantScale: s,
    });
    const rows = [...plan.rows, ...plan.passthroughCopies];
    const row = rows.find(rw => rw.attachmentNames.includes('DRIFTED'))!;
    // scaled peak = 1.0; downscaleClampedScale = min(1.0, 2.0) = 1.0
    // sourceRatio = 800/1000 = 0.8; cappedEffScale = min(1.0, 0.8) = 0.8
    expect(row.effectiveScale).toBeCloseTo(0.8, 5);
    expect(row.outW).toBe(Math.ceil(canonical * 0.8)); // 800 = actualSourceW
    expect(row.isCapped).toBe(true);
  });
});
```

---

## Shared Patterns

### Option Threading (`BuildExportPlanOptions`)

**Source:** `src/core/export.ts` lines 97-111 (`safetyBufferPercent` field — Phase 30 precedent)
**Apply to:** Both `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` (must be edited in the same commit)

The established pattern for adding a pure-math knob:
1. Add optional field with JSDoc to `BuildExportPlanOptions` (both files).
2. Extract with `??` default before use (e.g., `const bufferPct = opts.safetyBufferPercent ?? 0`).
3. Validation stays at the trust boundary (caller); `buildExportPlan` does not defensively coerce.
4. Add a parity regex test in the existing parity `describe` block in `tests/core/export.spec.ts`.

### Parity Enforce Pattern

**Source:** `tests/core/export.spec.ts` lines 897-903
**Apply to:** Any new structural field added to `BuildExportPlanOptions`

```typescript
it('Phase 55 — both files declare variantScale on BuildExportPlanOptions', () => {
  const coreText = readFileSync(EXPORT_SRC, 'utf8');
  const viewText = readFileSync(VIEW_SRC, 'utf8');
  const sig = /variantScale\?\s*:\s*number/;
  expect(coreText).toMatch(sig);
  expect(viewText).toMatch(sig);
});
```

### Synthetic Test Double Pattern (no fixture commit)

**Source:** `tests/core/variant-sizing.spec.ts` lines 36-76
**Apply to:** All new test cases in Phase 55

Build `RegionRow` test doubles using the `region(name, peakScale, dim)` helper already defined in the file. Avoids committing a new fixture directory (no `SAFE01_EXCLUDED_PREFIXES` churn). The `dimsMismatch` / `actualSourceW` / `actualSourceH` fields can be overlaid via object spread for T3.

### Trust Boundary Validation (main-layer only)

**Source:** `src/main/variant-export.ts` lines 96 and 135-137
**Apply to:** No new validation needed in Phase 55 — `s` is already validated before reaching the `buildExportPlan` call site

The `VariantScaleError` guard at line 96 (`!Number.isFinite(s) || s <= 0 || s >= 1`) ensures `s ∈ (0, 1)` exclusive. Division-by-zero (`vs = 0`) and `Infinity`/`NaN` cannot reach `buildExportPlan`.

---

## No Analog Found

None. All files have strong analogs within the codebase.

---

## Key Invariants the Planner Must Not Break

1. **`computeExportDims` in `src/renderer/src/lib/export-view.ts` is NOT touched.** It uses `Math.min(safeScale(rawEffScale), 1)` at line 234 — this is the Phase 54 display read-model and its `≤ 1` clamp is intentional (it pre-dates Phase 55; Phase 55 only changes `buildExportPlan`).

2. **`bufferPct` extraction inside vs. outside the loop.** Currently `const bufferPct = opts.safetyBufferPercent ?? 0` is INSIDE the `for (const region of summary.regions)` loop in both files (confirmed: `src/core/export.ts` line 263, `src/renderer/src/lib/export-view.ts` line 402). The planner should add `const vs = opts.variantScale ?? 1.0` at the same location (inside the loop alongside `bufferPct`), OR hoist both before the loop. Either is correct; keeping `vs` adjacent to `bufferPct` minimizes diff noise.

3. **Master path in `src/main/ipc.ts` is NOT touched.** `handleStartExport` never calls `buildExportPlan` with `variantScale` — the option is simply absent, defaults to `1.0`, and the behavior is byte-identical by construction.

4. **`scaleSummaryPeaks` is NOT touched.** It remains the upstream that scales `peakScale * s`; Phase 55 only changes how `buildExportPlan` clamps that scaled value.

---

## Metadata

**Analog search scope:** `src/core/`, `src/renderer/src/lib/`, `src/main/`, `tests/core/`
**Files scanned (read directly):** 6 (`src/core/export.ts`, `src/renderer/src/lib/export-view.ts`, `src/main/variant-export.ts`, `tests/core/variant-sizing.spec.ts`, `tests/core/export.spec.ts` targeted sections)
**Pattern extraction date:** 2026-05-26
