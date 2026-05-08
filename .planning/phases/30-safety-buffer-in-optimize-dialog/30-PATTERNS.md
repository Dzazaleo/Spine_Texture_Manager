# Phase 30: Safety buffer in Optimize dialog — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 9 (8 modified + 1 new test file)
**Analogs found:** 9 / 9 (every layer has a Phase-28 `sharpenOnExport` precedent — exact mirror)

## Executive Summary

Phase 30 is mechanically a **byte-for-byte mirror of Phase 28 `sharpenOnExport` plumbing** with one type swap (`boolean` → `number` 0–25 integer) plus one math insert in `buildExportPlan` (lines 192–202 of `src/core/export.ts` and its renderer twin) plus one new `bufferCapped: boolean` flag on `ExportRow` (parallel to existing `isCapped` from Phase 22.1). Every file in scope has an existing analog **in the same file** — Phase 28 already touched all 7 plumbing layers; the planner replays each touch with the new field name and the integer-range validator.

**No file in this phase has a "no analog" outcome.** Every edit copies a verified, in-file precedent.

## File Classification

| File | New / Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|----------------|------|-----------|----------------|---------------|
| `src/shared/types.ts` | modified | type definitions | request-response (IPC shape) | Phase 28 `sharpenOnExport` declarations in **same file** at lines 918, 943, 996, 1056 | exact (in-file) |
| `src/core/export.ts` | modified | core service (pure-TS math) | transform | Phase 22.1 `isCapped` flag at lines 228, 236, 243, 321 + `BuildExportPlanOptions` at line 72 + math insert point at line 192 | exact (in-file) |
| `src/renderer/src/lib/export-view.ts` | modified | core service mirror (renderer twin) | transform | Same file — lockstep parity with `src/core/export.ts`; tests at `tests/core/export.spec.ts:657-740` enforce structural sameness | exact (lockstep) |
| `src/core/project-file.ts` | modified | persistence (validator + serializer + materializer) | file-I/O / transform | Phase 28 `sharpenOnExport` three-touch in **same file** at lines 188-200 (validator), 316 (serializer), 380 (PartialMaterialized), 449 (materializer) | exact (in-file) |
| `src/main/project-io.ts` | modified | IPC envelope (main process) | request-response | Phase 28 `sharpenOnExport` three-site IPC threading in **same file** at line 566 (Open), 700-701 + 832 (recovery), 1044-1045 (resample) | exact (in-file) |
| `src/renderer/src/components/AppShell.tsx` | modified | renderer state controller (project lifecycle) | event-driven (state machine) | Phase 28 `sharpenOnExportLocal` in **same file** at line 318 (state slot), 355-367 (lastSaved shape), 872-876 (isDirty memo), 1132-1167 (mountOpenResponse hydration), 798-810 (buildSessionState), 1965-1966 (OptimizeDialog mount), 836-846 (savingsPctMemo) | exact (in-file) |
| `src/renderer/src/modals/OptimizeDialog.tsx` | modified | renderer UI component (modal) | event-driven (controlled input) | Phase 28 sharpen toggle in **same file** at lines 104-110 (props), 421-434 (UI) | exact (in-file) |
| `tests/core/project-file.spec.ts` | modified (new describe block) | test (persistence round-trip) | request-response | Phase 28 `describe('Phase 28 — sharpenOnExport (D-06)')` block in **same file** at lines 381-466 | exact (in-file) |
| `tests/core/export.spec.ts` | modified (new describe block + parity regex extension) | test (math + parity) | transform | Phase 22.1 `isCapped` golden tests + parity describe block at lines 657-740 in **same file** | exact (in-file) |
| `tests/renderer/optimize-dialog-buffer.spec.tsx` | NEW FILE | test (UI interaction) | event-driven | `tests/renderer/optimize-dialog-passthrough.spec.tsx` (full file) — same modal, same `vi.stubGlobal('api', ...)` harness, same `makeRow` / `makePlan` factories | role + flow match |

## Pattern Assignments

### `src/shared/types.ts` (type definitions, IPC shape)

**Analog:** Phase 28 `sharpenOnExport` four-touch in the same file.

**Touch 1 — `ProjectFileV1` interface** (lines 912-918):
```typescript
/**
 * Phase 28 SHARP-01 — opt-in unsharp-mask post-resize on downscale.
 * v1.2-era .stmproj files have no `sharpenOnExport` field; the validator
 * pre-massages missing → false (mirrors loaderMode pre-massage in
 * src/core/project-file.ts:174-186). D-04 default-OFF, D-06 persists per project.
 */
sharpenOnExport: boolean;
```

**Touch 2 — `AppSessionState` interface** (line 942-943):
```typescript
/** Phase 28 SHARP-01 — round-trips through .stmproj per D-06. */
sharpenOnExport: boolean;
```

**Touch 3 — `MaterializedProject` interface** (lines 992-996):
```typescript
/**
 * Phase 28 SHARP-01 — threaded through main/project-io.ts so AppShell
 * seeds its sharpenOnExportLocal slot on Open / locate-skeleton recovery.
 */
sharpenOnExport: boolean;
```

**Touch 4 — `ResampleArgs` interface — OPTIONAL** (lines 1049-1056):
```typescript
/**
 * Phase 28 D-06 — per-project sharpen-on-export toggle. The resample
 * round-trip re-materialises the project; threading the renderer's
 * current `sharpenOnExportLocal` keeps `MaterializedProject.sharpenOnExport`
 * truthful at the resample seam. Optional for backward-compat
 * (undefined → false).
 */
sharpenOnExport?: boolean;
```

**Buffer-specific adaptations (per RESEARCH §"Pattern 2"):**
- `ProjectFileV1.safetyBufferPercent: number` (REQUIRED, integer 0–25).
- `AppSessionState.safetyBufferPercent: number` (REQUIRED).
- `MaterializedProject.safetyBufferPercent: number` (REQUIRED — mirrors sharpenOnExport).
- `ResampleArgs.safetyBufferPercent?: number` (OPTIONAL — mirrors line 1056 sharpenOnExport asymmetry).

**Additional touch — `ExportRow` interface** — search for `interface ExportRow` (currently has `isCapped?: boolean` from Phase 22.1):
```typescript
// Add (mirrors isCapped — optional, conditionally spread in export.ts):
/**
 * Phase 30 BUFFER-02 D-06 — true when buffer-induced effective scale
 * exceeds source dims and is silently clamped. Parallel to existing
 * isCapped from Phase 22.1; both flags are independent. Carried in IPC
 * payload but not rendered in v1.3.1 UI per D-05 silent-cap contract.
 */
bufferCapped?: boolean;
```

---

### `src/core/export.ts` (core service, pure-TS math transform)

**Analog 1 — `BuildExportPlanOptions` interface** (lines 72-75):
```typescript
export interface BuildExportPlanOptions {
  /** Default false (D-109). Future Settings toggle path. */
  includeUnused?: boolean;
}
```

**Analog 2 — `Acc` interface** (lines 157-162) currently carries `isCapped: boolean`. The buffer adds `bufferCapped: boolean` symmetrically.

**Analog 3 — math insertion point in dedup loop** (lines 187-202):
```typescript
const overrideKey = row.regionName ?? row.attachmentName;
const overridePct = overrides.get(overrideKey);
const rawEffScale =
  overridePct !== undefined
    ? applyOverride(overridePct, row.peakScale).effectiveScale
    : row.peakScale;
// Gap-Fix Round 5...
const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);
```

The buffer multiply slots **between** `rawEffScale` (line 192) and `downscaleClampedScale` (line 202). Per RESEARCH D-09 step order:
```typescript
// Phase 30 BUFFER-01 — multiplicative safety buffer. D-07 literal no-op
// when buffer === 0 guarantees byte-identical pre-Phase-30 behavior.
const bufferPct = _opts?.safetyBufferPercent ?? 0;
const bufferedScale =
  bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100);
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1);
```

**Analog 4 — `isCapped` flag computation** (line 228):
```typescript
const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);
const isCapped = downscaleClampedScale > sourceRatio;
```

`bufferCapped` follows the same shape — computed alongside `isCapped`. RESEARCH §"Code Examples" provides the exact predicate (with A1 broad-vs-narrow planner choice).

**Analog 5 — dedup keep-max propagation** (lines 232-244) — captures `isCapped`:
```typescript
if (prev === undefined) {
  bySourcePath.set(row.sourcePath, {
    row,
    effScale,
    isCapped,
    attachmentNames: [row.attachmentName],
  });
} else {
  if (effScale > prev.effScale) {
    prev.row = row;
    prev.effScale = effScale;
    prev.isCapped = isCapped;
  }
  // ...
}
```

`bufferCapped` MUST be added alongside `isCapped` at every site (R2 risk — symmetric edit).

**Analog 6 — conditional spread at emit loop** (line 320-321):
```typescript
// Phase 22.1 G-07 D-07 — cap-binding signal for OptimizeDialog row label.
...(acc.isCapped ? { isCapped: true } : {}),
```

`bufferCapped` follows the same conditional-spread pattern.

**Analog 7 — `_opts` parameter rename** (line 140) — currently `_opts` to satisfy `noUnusedParameters`; per RESEARCH R6, rename to `opts` when buffer becomes the first consumer. Apply identically in `export-view.ts:241`.

---

### `src/renderer/src/lib/export-view.ts` (core service mirror — lockstep parity)

**Analog:** Same file, byte-identical contract with `src/core/export.ts`. The `buildExportPlan` body lives at line 238 onward; the `_opts` parameter is at line 241.

**Pattern:** Every edit to `src/core/export.ts` is mirrored byte-for-byte here, in the same commit. RESEARCH §"Pitfall 2" + parity test at `tests/core/export.spec.ts:657-740` enforce this.

**Additional file-local pattern:** `computeExportDims(...)` helper at lines 139-236 — RESEARCH "Anti-Patterns to Avoid" #2 explicitly says **DO NOT** thread the buffer into this helper. Buffer is an export-time concern only; the panel "Peak W×H" column intentionally answers "what does the rig demand BEFORE buffer?". Leave `computeExportDims` untouched.

---

### `src/core/project-file.ts` (persistence — three-touch pattern)

**Analog:** Phase 28 `sharpenOnExport` three-touch in the same file.

**Touch 1 — VALIDATOR PRE-MASSAGE** (lines 188-200):
```typescript
// Phase 28 SHARP-01 forward-compat — v1.2-era .stmproj files have no
// `sharpenOnExport` field; default to false so legacy projects load with
// the neutral baseline (D-04 default-OFF). Mirrors loaderMode pre-massage
// above (Phase 21 D-08).
if (obj.sharpenOnExport === undefined) {
  obj.sharpenOnExport = false;
}
if (typeof obj.sharpenOnExport !== 'boolean') {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: 'sharpenOnExport is not boolean' },
  };
}
```

**Buffer adaptation** (per RESEARCH §"Pattern 1"): mirror immediately AFTER the sharpenOnExport block. Use the integer-range validator:
```typescript
if (obj.safetyBufferPercent === undefined) {
  obj.safetyBufferPercent = 0;
}
if (typeof obj.safetyBufferPercent !== 'number'
    || !Number.isInteger(obj.safetyBufferPercent)
    || obj.safetyBufferPercent < 0
    || obj.safetyBufferPercent > 25) {
  return {
    ok: false,
    error: {
      kind: 'invalid-shape',
      message: 'safetyBufferPercent is not an integer in [0, 25]',
    },
  };
}
```

**Touch 2 — SERIALIZER** (line 315-316):
```typescript
// Phase 28 SHARP-01 — round-trips through .stmproj per D-06.
sharpenOnExport: state.sharpenOnExport,
```

**Buffer adaptation:** add `safetyBufferPercent: state.safetyBufferPercent,` immediately after.

**Touch 3 — `PartialMaterialized` SHAPE** (lines 375-380):
```typescript
/**
 * Phase 28 SHARP-01 — defence-in-depth fallback (validator pre-massage
 * already substitutes false, but defaults here too in case any future
 * code path bypasses the validator). Mirrors loaderMode field above.
 */
sharpenOnExport: boolean;
```

**Buffer adaptation:** add `safetyBufferPercent: number;` immediately after.

**Touch 4 — MATERIALIZER BACK-FILL** (lines 447-449):
```typescript
// Phase 28 SHARP-01 — defence-in-depth nullish-coalesce; validator
// pre-massage already substitutes false. Mirrors loaderMode line above.
sharpenOnExport: file.sharpenOnExport ?? false,
```

**Buffer adaptation:** add `safetyBufferPercent: file.safetyBufferPercent ?? 0,` immediately after.

---

### `src/main/project-io.ts` (IPC envelope — three-site pattern)

**Analog:** Phase 28 `sharpenOnExport` three-site IPC threading in same file.

**Site 1 — Open path** (lines 563-566):
```typescript
// Phase 28 SHARP-01 — thread sharpenOnExport so AppShell can seed its
// sharpenOnExportLocal slot on Open. Mirrors loaderMode site immediately
// above (Phase 21 D-08 Site 2).
sharpenOnExport: materialized.sharpenOnExport,
```

**Buffer adaptation:** add `safetyBufferPercent: materialized.safetyBufferPercent,` immediately after.

**Site 2 — Recovery path** (lines 696-701, then used in MaterializedProject construction near line 832):
```typescript
// Phase 28 SHARP-01 — recovery path threads sharpenOnExport from the
// renderer's last-known session payload (mirrors samplingHz/loaderMode
// lifts above). Type-coerce defensively (the recovery shape is loosely
// typed at this boundary).
const sharpenOnExport: boolean =
  typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false;
```

**Buffer adaptation** — defensive coerce with full integer-range validation (mirrors OptimizeDialog onChange clamp):
```typescript
const safetyBufferPercent: number =
  typeof a.safetyBufferPercent === 'number'
    && Number.isInteger(a.safetyBufferPercent)
    && a.safetyBufferPercent >= 0
    && a.safetyBufferPercent <= 25
    ? a.safetyBufferPercent
    : 0;
```

Then add to the MaterializedProject construction near line 832 alongside `sharpenOnExport,`.

**Site 3 — Resample path** (lines 1040-1045):
```typescript
// sharpenOnExportLocal slot is the source of truth and AppShell preserves
// it across resample. Default false here satisfies the type contract; if
// the renderer ever threads sharpenOnExport into ResampleArgs, this seam
// already coerces it defensively.
sharpenOnExport:
  typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false,
```

**Buffer adaptation:** mirror the integer-range coerce inline:
```typescript
safetyBufferPercent:
  typeof a.safetyBufferPercent === 'number'
    && Number.isInteger(a.safetyBufferPercent)
    && a.safetyBufferPercent >= 0
    && a.safetyBufferPercent <= 25
    ? a.safetyBufferPercent
    : 0,
```

---

### `src/renderer/src/components/AppShell.tsx` (state controller — five-touch lifecycle)

**Analog:** Phase 28 `sharpenOnExportLocal` in the same file.

**Touch 1 — STATE SLOT** (lines 318-320):
```typescript
const [sharpenOnExportLocal, setSharpenOnExportLocal] = useState<boolean>(
  () => initialProject?.sharpenOnExport ?? false,
);
```

**Buffer adaptation:** `safetyBufferPercentLocal` of type `number`, default `0`.

**Touch 2 — `lastSaved` SHAPE** (lines 355-367) — currently three explicit fields:
```typescript
const [lastSaved, setLastSaved] = useState<{
  overrides: Record<string, number>;
  samplingHz: number;
  sharpenOnExport: boolean; // Phase 28 SHARP-01
} | null>(
  initialProject
    ? {
        overrides: { ...initialProject.restoredOverrides },
        samplingHz: initialProject.samplingHz,
        sharpenOnExport: initialProject.sharpenOnExport ?? false,
      }
    : null,
);
```

**Buffer adaptation:** add `safetyBufferPercent: number;` to the shape AND to the seed object. **R5 risk:** every `setLastSaved({...})` call site in the file must add the new field. Planner MUST grep `setLastSaved` first.

**Touch 3 — `isDirty` MEMO** (lines 871-876):
```typescript
if (samplingHzLocal !== lastSaved.samplingHz) return true;
// Phase 28 SHARP-01 — toggle change marks project dirty. Mirrors
// samplingHz line above (D-06 — toggle persists per-project).
if (sharpenOnExportLocal !== lastSaved.sharpenOnExport) return true;
return false;
}, [overrides, lastSaved, samplingHzLocal, sharpenOnExportLocal]);
```

**Buffer adaptation:** add `if (safetyBufferPercentLocal !== lastSaved.safetyBufferPercent) return true;` and add `safetyBufferPercentLocal` to the dep array.

**Touch 4 — Open HYDRATION (`mountOpenResponse`)** (lines 1134-1138 + 1163-1166):
```typescript
setLastSaved({
  overrides: { ...project.restoredOverrides },
  samplingHz: project.samplingHz,
  sharpenOnExport: project.sharpenOnExport ?? false, // Phase 28 SHARP-01
});
// ... (later in the same function)
// Phase 28 SHARP-01 — restore sharpenOnExport from materialized project.
setSharpenOnExportLocal(project.sharpenOnExport ?? false);
```

**Buffer adaptation:** add `safetyBufferPercent: project.safetyBufferPercent ?? 0,` to the lastSaved seed AND `setSafetyBufferPercentLocal(project.safetyBufferPercent ?? 0);` further down. **Pitfall 7 risk:** both lines must be edited or `isDirty` will read true on Open.

**Touch 5 — `buildSessionState` THREADING** (lines 798-810):
```typescript
// Phase 28 SHARP-01 — round-trips through .stmproj per D-06.
sharpenOnExport: sharpenOnExportLocal,
```

**Buffer adaptation:** add `safetyBufferPercent: safetyBufferPercentLocal,` immediately after.

**Touch 6 — OptimizeDialog PROP WIRING** (lines 1965-1966):
```typescript
sharpenOnExport={sharpenOnExportLocal}
onSharpenChange={setSharpenOnExportLocal}
```

**Buffer adaptation:** add `safetyBufferPercent={safetyBufferPercentLocal}` and `onSafetyBufferChange={setSafetyBufferPercentLocal}` adjacent.

**Touch 7 — `buildExportPlan` call sites** (lines 627, 745, 837 + `atlas-preview-view.ts:183`):

`savingsPctMemo` precedent (lines 836-846):
```typescript
const savingsPctMemo = useMemo<number | null>(() => {
  const plan = buildExportPlan(effectiveSummary, overrides);
  // ...
}, [effectiveSummary, overrides]);
```

**Buffer adaptation** (per RESEARCH §"Pattern 6"):
```typescript
const savingsPctMemo = useMemo<number | null>(() => {
  const plan = buildExportPlan(effectiveSummary, overrides, {
    safetyBufferPercent: safetyBufferPercentLocal,
  });
  // ...
}, [effectiveSummary, overrides, safetyBufferPercentLocal]);
```

Apply to all four call sites. RESEARCH A3 flags Option A (lift plan to memo at AppShell) vs Option B (OptimizeDialog owns the memo); planner picks.

**Touch 8 — Resample threading** (RESEARCH cite line 1407 — `window.api.resample({...})` payload): add `safetyBufferPercent: safetyBufferPercentLocal,` to the IPC payload (mirrors Phase 28 `sharpenOnExport: sharpenOnExportLocal,` if present; if Phase 28 didn't thread it through resample, the planner may safely add the new field defensively to keep MaterializedProject truthful across resample).

---

### `src/renderer/src/modals/OptimizeDialog.tsx` (UI component — controlled input)

**Analog:** Phase 28 sharpen toggle in same file.

**Touch 1 — PROPS** (lines 104-110):
```typescript
/**
 * Phase 28 SHARP-01 — opt-in sharpen toggle. Hydrated from the project's
 * .stmproj per D-06; toggling marks the project dirty (AppShell wires the
 * setter into its isDirty memo, mirroring samplingHzLocal).
 */
sharpenOnExport: boolean;
onSharpenChange: (v: boolean) => void;
```

**Buffer adaptation:** add `safetyBufferPercent: number;` and `onSafetyBufferChange: (n: number) => void;` adjacent.

**Touch 2 — UI (visual precedent for buffer placement)** (lines 421-434):
```tsx
<label
  htmlFor="sharpen-on-export-toggle"
  className="flex items-center gap-2 mb-4 text-xs text-fg cursor-pointer"
>
  <input
    id="sharpen-on-export-toggle"
    type="checkbox"
    checked={props.sharpenOnExport}
    onChange={(e) => props.onSharpenChange(e.target.checked)}
    disabled={state === 'in-progress'}
    className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
  />
  Sharpen output on downscale
</label>
```

**Buffer adaptation** (UI-SPEC §"Layout & Interaction Contract" + RESEARCH "Code Examples"):

Wrap BOTH the new buffer input AND the existing sharpen toggle inside a single Quality group `<div>`. The sharpen toggle MOVES INTO the group (not removed; just relocated; visual treatment unchanged):

```tsx
<div className="border border-border rounded-md bg-surface p-3 mb-4">
  <span className="text-xs text-fg-muted mb-2 block">Quality</span>
  <label
    htmlFor="safety-buffer-input"
    className="flex items-center gap-2 mb-2 text-xs text-fg cursor-pointer"
  >
    Safety buffer:
    <input
      id="safety-buffer-input"
      type="number"
      min={0}
      max={25}
      step={1}
      value={props.safetyBufferPercent}
      onChange={(e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isFinite(parsed)) {
          props.onSafetyBufferChange(0);
          return;
        }
        const clamped = Math.max(0, Math.min(25, Math.floor(parsed)));
        props.onSafetyBufferChange(clamped);
      }}
      disabled={state === 'in-progress'}
      title="Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate."
      className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
    />
    <span className="text-fg-muted">%</span>
  </label>
  {/* MOVED — sharpen toggle relocated INTO Quality group; visual UNCHANGED */}
  <label
    htmlFor="sharpen-on-export-toggle"
    className="flex items-center gap-2 text-xs text-fg cursor-pointer"
  >
    <input
      id="sharpen-on-export-toggle"
      type="checkbox"
      checked={props.sharpenOnExport}
      onChange={(e) => props.onSharpenChange(e.target.checked)}
      disabled={state === 'in-progress'}
      className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    />
    Sharpen output on downscale
  </label>
</div>
```

**Validation locus** (UI-SPEC resolves "Claude's discretion #3"): clamp lives in `onChange` handler (above), NOT in AppShell setter. AppShell receives an already-clean integer.

---

### `tests/core/project-file.spec.ts` (persistence test — new describe block)

**Analog:** Phase 28 `describe('Phase 28 — sharpenOnExport (D-06)')` block in same file (lines 381-466).

**Touch 1 — Forward-compat test** (lines 382-402):
```typescript
it('validateProjectFile pre-massages missing sharpenOnExport to false (forward-compat for v1.2-era files)', () => {
  const v12EraFile: Record<string, unknown> = {
    version: 1,
    skeletonPath: '/abs/rig.json',
    atlasPath: null,
    imagesDir: null,
    overrides: {},
    samplingHz: 120,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: {},
    loaderMode: 'auto',
    // sharpenOnExport INTENTIONALLY ABSENT (v1.2-era shape)
  };
  const result = validateProjectFile(v12EraFile);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect((result.project as ProjectFileV1).sharpenOnExport).toBe(false);
  }
});
```

**Buffer adaptation:** mirror with `safetyBufferPercent` field intentionally absent; assert `result.project.safetyBufferPercent === 0`.

**Touch 2 — Reject-invalid test** (lines 404-425) — currently rejects `'yes'` (non-boolean). Buffer expands to test `-1`, `26`, `5.5`, `'5'`, `NaN` — five invalid-shape cases.

**Touch 3 — Round-trip identity tests** (lines 427-465) — currently `safetyBufferPercent: true` / `false`. Buffer mirrors with values `5` and `0` (one zero round-trip + one non-zero).

Add a new `describe('Phase 30 — safetyBufferPercent (BUFFER-03)')` block immediately after the Phase 28 block. Same shape, integer values.

---

### `tests/core/export.spec.ts` (math + parity tests)

**Analog 1 — Phase 22.1 `isCapped` golden tests** (search for `isCapped` in the file). The buffer test pattern mirrors:
- baseline (no buffer) → existing behavior
- 5% buffer → buffered effScale
- 25% buffer + cap binding → `bufferCapped: true`
- per-region dedup × buffer (Chicken-Min fixture)
- passthrough preservation (TRIANGLE peakScale=1.0 + buffer=5 → still passthrough)

**Analog 2 — parity describe block** (lines 657-740) — currently uses regex `/Math\.ceil\(\(acc\.row\.canonicalW \?\? acc\.row\.sourceW\)/` to assert structural sameness between core and renderer. Per RESEARCH R4: extend the parity block to also grep for `bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100)` (or stable signature) in BOTH files.

**Analog 3 — hygiene test** (RESEARCH cites lines 616-636) — already asserts `grep -rn "from 'sharp'"` returns zero hits in `src/core/`. No change needed; buffer adds no imports.

Add a new `describe('buildExportPlan — Phase 30 BUFFER-01..03')` block.

---

### `tests/renderer/optimize-dialog-buffer.spec.tsx` (NEW FILE — UI interaction test)

**Analog:** `tests/renderer/optimize-dialog-passthrough.spec.tsx` (full file).

**Imports + harness pattern** (lines 1-47):
```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportRow } from '../../src/shared/types';

beforeEach(() => {
  vi.stubGlobal('api', {
    onExportProgress: vi.fn(() => () => undefined),
    startExport: vi.fn(),
    cancelExport: vi.fn(),
    openOutputFolder: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});
```

**Test factories pattern** (lines 49-80):
```typescript
function makeRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    sourcePath: '/fake/CIRCLE.png',
    outPath: 'images/CIRCLE.png',
    sourceW: 699,
    sourceH: 699,
    outW: 350,
    outH: 350,
    effectiveScale: 0.5,
    attachmentNames: ['CIRCLE'],
    ...overrides,
  };
}

function makePlan(opts: {
  rows?: ExportRow[];
  passthroughCopies?: ExportRow[];
}): ExportPlan {
  return {
    rows: opts.rows ?? [],
    excludedUnused: [],
    passthroughCopies: opts.passthroughCopies ?? [],
    totals: { count: (opts.rows?.length ?? 0) + (opts.passthroughCopies?.length ?? 0) },
  };
}

const REQUIRED_PROPS = {
  open: true,
  outDir: '/tmp/out',
  onClose: vi.fn(),
  onOpenAtlasPreview: vi.fn(),
};
```

**Render assertion pattern** (lines 90-113):
```typescript
render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
const copyChip = screen.getByText('COPY');
expect(copyChip).not.toBeNull();
```

**Convention note** (lines 19-21): no `@testing-library/jest-dom` matchers — use `not.toBeNull()` / `toBeDefined()` instead.

**Buffer-specific tests to add:**
- Render with `safetyBufferPercent={0}` → input shows `0`.
- Render with `safetyBufferPercent={5}` → input shows `5`.
- Type `15` → `onSafetyBufferChange` fires with `15`.
- Type `-3` → handler clamps to `0`.
- Type `99` → handler clamps to `25`.
- Paste `abc` → handler fires with `0` (NaN fallback).
- `state === 'in-progress'` (simulate by clicking Start with stub api) → input is `disabled`.
- Tooltip via `title=` attribute is present and matches D-15 verbatim wording.

Required props will need `safetyBufferPercent` and `onSafetyBufferChange` added to `REQUIRED_PROPS` mock so all existing render calls compile; same pattern in existing `optimize-dialog-passthrough.spec.tsx` will need the same prop pair added (Wave 0 gap).

---

## Shared Patterns

### Layer 3 invariant (no `sharp` / DOM in `src/core/`)

**Source:** CLAUDE.md + `tests/core/project-file.spec.ts:468-478` hygiene block + analogous block in `tests/core/export.spec.ts:616-636`.

**Apply to:** `src/core/export.ts`, `src/core/project-file.ts`, all of `src/core/**`.

Buffer math is pure arithmetic (`Math.min`, `Math.ceil`, `Number.isInteger`, `parseInt`). Zero new imports required. The hygiene tests automatically catch any violation.

```typescript
// existing hygiene assertion pattern (project-file.spec.ts:468-478):
it('does not import node:fs / node:fs/promises / sharp / electron', () => {
  const src = readFileSync(CORE_SRC, 'utf8');
  expect(src).not.toMatch(/from\s+['"]sharp['"]/);
  expect(src).not.toMatch(/from\s+['"]electron['"]/);
  // ...
});
```

### `.stmproj` additive-only schema (Phase 8 D-148 lock; Phase 21 + Phase 28 reaffirm)

**Source:** `src/core/project-file.ts` validator pre-massage chain (lines 174-200).

**Apply to:** Validator, serializer, materializer touches in `src/core/project-file.ts` + `ProjectFileV1` field in `src/shared/types.ts`.

**Pattern:** Missing field → default value (validator pre-massage, BEFORE type-check). Wrong-type field → `{ ok: false, error: { kind: 'invalid-shape' } }`. Schema `version: 1` stays at `1` — never bumped for additive optional fields.

### Tailwind v4 literal-class discipline (Pitfall 8)

**Source:** Project-wide rule; example at `OptimizeDialog.tsx:417-434` sharpen toggle.

**Apply to:** `OptimizeDialog.tsx` (the only renderer file modified).

**Pattern:** Every `className` is a single string literal. NO template strings, NO conditional concatenation, NO dynamic class composition. Disabled state class is appended literally: `"... disabled:opacity-50 disabled:cursor-not-allowed"`.

### Conditional spread for optional `ExportRow` flags

**Source:** `src/core/export.ts:308-321` — three existing conditional spreads (`atlasSource`, `actualSourceW`/`H`, `isCapped`).

**Apply to:** `bufferCapped` field in `src/core/export.ts` AND `src/renderer/src/lib/export-view.ts` (lockstep).

**Pattern:**
```typescript
...(acc.isCapped ? { isCapped: true } : {}),
// new (mirrors above):
...(acc.bufferCapped ? { bufferCapped: true } : {}),
```

This keeps the field absent (not `false`) on rows where the flag doesn't apply — matches the existing `isCapped` shape.

### Phase 28 `sharpenOnExport` plumbing canonical mirror

**Source:** Phase 28 commit history + canonical_refs in CONTEXT.md.

**Apply to:** EVERY layer of Phase 30 except the math insert and the `bufferCapped` flag.

**Pattern:** for any plumbing question ("how does this layer expose the field?"), look up the same layer's `sharpenOnExport` site and copy the shape. The buffer differs only in:
- type (`number` integer 0–25 instead of `boolean`)
- default (`0` instead of `false`)
- validator (integer-and-range check instead of typeof-boolean)

Everywhere else the structure is byte-for-byte identical.

---

## No Analog Found

**None.** Every file in scope has a verified, in-file precedent (Phase 28 `sharpenOnExport` for plumbing layers; Phase 22.1 `isCapped` for the `bufferCapped` flag; Phase 22 `optimize-dialog-passthrough.spec.tsx` for the new UI test file).

---

## Metadata

**Analog search scope:** `src/core/`, `src/shared/`, `src/main/`, `src/renderer/src/`, `tests/core/`, `tests/renderer/`.

**Files scanned:** ~12 (every file referenced in CONTEXT canonical_refs + RESEARCH file paths was opened and the cited line ranges re-read).

**Pattern extraction date:** 2026-05-08.

**Confidence:** HIGH — every line excerpt above was verified against the live file contents (not from memory or RESEARCH transcription; re-read live in this session).

## PATTERN MAPPING COMPLETE
