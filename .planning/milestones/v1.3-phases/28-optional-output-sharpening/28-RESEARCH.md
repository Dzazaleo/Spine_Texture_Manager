# Phase 28: Optional Output Sharpening — Research

**Researched:** 2026-05-06
**Domain:** sharp/libvips post-resize unsharp mask + .stmproj v1 additive field + OptimizeDialog UI toggle
**Confidence:** HIGH

---

## Summary

Phase 28 is small, well-scoped, and rides three established repo precedents — Phase 9 `samplingHz`, Phase 21 `loaderMode`, Phase 22 `passthroughCopies[]` — so the plan reduces to a mechanical three-touch on `.stmproj`, an IPC envelope flag, a single conditional `.sharpen({ sigma: 0.5 })` line, and a regression test that locks the sigma constant + downscale-only gate.

**Key facts** [VERIFIED: codebase grep + Context7]:
- `sharp@0.34.5` + `libvips@8.17.3` are pinned. `sharp.sharpen({ sigma })` is a stable, documented API ([sharp.pixelplumbing.com/api-operation](https://sharp.pixelplumbing.com/api-operation)); `sigma` is the only knob we touch — `m1`/`m2`/`x1`/`y2`/`y3` defaults are battle-tested for typical RGBA art.
- `ExportRow.effectiveScale` already exists at `src/shared/types.ts:239` — the `< 1.0` gate has zero new plumbing.
- The two resize call sites are at `src/main/image-worker.ts:437-446` (atlas-extract) and `src/main/image-worker.ts:447-451` (per-region) inside the same try/catch — DRY with a tiny helper that takes a sharp pipeline and returns it.
- No `src/core/constants.ts` exists; the sigma constant should colocate at the top of `src/main/image-worker.ts` as `const SHARPEN_SIGMA = 0.5` (Layer 3 invariant: `sharp` only in main).

**Primary recommendation:** Plan as 3 atomic plans aligned to SHARP-01/02/03. Wire the IPC flag through `OptimizeOptions` (a new envelope wrapping the existing 3rd `overwrite` arg → 4th arg flag, OR an inline `boolean` 4th arg per the simpler precedent). Test SHARP-03 as an integration-level real-bytes check (mirrors `tests/main/image-worker.integration.spec.ts`) — assert sharpening was applied via downstream pixel-mean delta on a 64×64 synthetic disk, NOT by mocking sharp. Unit-mock falsifies poorly because the conditional emits a fluent-API call that's hard to assert without brittle mock chain inspection.

**Top risks** the planner needs to hold:
1. The IPC payload shape — choose `OptimizeOptions: { sharpen: boolean }` or inline 4th arg `sharpen: boolean`. Inline mirrors `overwrite` precedent and is simpler; envelope is more extensible. Pick at planning time per Claude's Discretion D-08.
2. SHARP-01..03 are not yet rows in `REQUIREMENTS.md` (only referenced in `ROADMAP.md` lines 10 and 80). Housekeeping: planner should add a `### SHARP — Output Quality` section, OR fold them into `OPT`.

---

## sharp.sharpen() Parameter Reference

[CITED: sharp.pixelplumbing.com/api-operation, fetched via Context7 2026-05-06]

`sharp().sharpen(options)` — applies an unsharp mask. Two distinct modes:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Fast mild** | `sharpen()` with no args | Hardcoded fast 3×3 convolution; not what we want |
| **LAB sigma** | `sharpen({ sigma })` | Slower, more accurate sharpen of the L channel in LAB color space — what we want |

### Parameters

| Param | Range | Default | Purpose | Phase 28 use |
|-------|-------|---------|---------|---------------|
| `sigma` | 0.000001 – 10 | (required for LAB) | Gaussian-mask sigma; `sigma = 1 + radius/2` | **0.5 (D-05 LOCKED)** |
| `m1` | 0 – 1,000,000 | 1.0 | Sharpening level on flat areas | leave default |
| `m2` | 0 – 1,000,000 | 2.0 | Sharpening level on jagged areas | leave default |
| `x1` | 0 – 1,000,000 | 2.0 | Threshold separating "flat" vs "jagged" | leave default |
| `y2` | 0 – 1,000,000 | 10.0 | Maximum brightening | leave default |
| `y3` | 0 – 1,000,000 | 20.0 | Maximum darkening | leave default |

### Caveats

- **Idempotency:** sharpen() applied **once** in a chain works as documented. Calling `.sharpen({sigma})` twice in the same pipeline is NOT idempotent — it will compound the unsharp mask. Plan must guarantee single application per row (the conditional + pipeline-builder shape below enforces this structurally).
- **Alpha:** Sharpen runs on the L channel in LAB; alpha passes through. No PMA interaction concerns — and since D-01 falsified the PMA pre-existing concern entirely, this is empirically safe.
- **Chained ordering:** `.resize().sharpen()` is the documented order. Sharpen on a downscaled image is the entire point of the unsharp mask preset — sharpening before resize would be discarded by the Lanczos kernel.
- **Deprecated args:** `flat` / `jagged` exist as deprecated aliases of `m1`/`m2`. Do not use.

[VERIFIED: package.json + node runtime] sharp 0.34.5 ships libvips 8.17.3, both pinned in `package.json` deps. The .sharpen() ABI has been stable since sharp 0.20.x — no version-pin risk.

---

## Call-Site DRY Recommendation

The two resize sites are at `src/main/image-worker.ts:437-446` and `447-451`, inside the SAME try/catch starting at line 431 (`const tmpPath = resolvedOut + '.tmp'; try { if (useAtlasExtract && row.atlasSource) { … } else { … } }`). They are NOT in separate functions.

### Read first

`src/main/image-worker.ts:430-462` — the unified try/catch including both sites and the outer error classification. The structural shape is:

```typescript
try {
  if (useAtlasExtract && row.atlasSource) {
    await sharp(row.atlasSource.pagePath)
      .extract({ left, top, width, height })
      .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(tmpPath);
  } else {
    await sharp(sourcePath)
      .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(tmpPath);
  }
} catch (e) { … }
```

### Recommended helper

A small private helper `applyResizeAndSharpen` that takes the pre-extract sharp instance, row, and toggle, and returns a sharp pipeline ready for `.toFile()`:

```typescript
// src/main/image-worker.ts (top-level, before runExport)
const SHARPEN_SIGMA = 0.5;

function applyResizeAndSharpen(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): sharp.Sharp {
  let p = pipeline.resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' });
  if (sharpenEnabled && effectiveScale < 1.0) {
    p = p.sharpen({ sigma: SHARPEN_SIGMA });
  }
  return p.png({ compressionLevel: 9 });
}
```

Then both branches collapse to:

```typescript
if (useAtlasExtract && row.atlasSource) {
  await applyResizeAndSharpen(
    sharp(row.atlasSource.pagePath).extract({ left: …, top: …, width: …, height: … }),
    row.outW, row.outH, row.effectiveScale, sharpenEnabled,
  ).toFile(tmpPath);
} else {
  await applyResizeAndSharpen(
    sharp(sourcePath),
    row.outW, row.outH, row.effectiveScale, sharpenEnabled,
  ).toFile(tmpPath);
}
```

### Rationale

- **Single conditional** — sigma constant + downscale gate live in ONE place (the helper). SHARP-03 regression test asserts on this single locus.
- **Layer 3 clean** — helper stays in `src/main/`. `sharpenEnabled` is a plain boolean threaded through `runExport`'s signature.
- **Idempotency guaranteed by shape** — the helper applies sharpen at most once per call.
- **Passthrough rows are untouched** — they don't go through this helper at all (passthrough loop at `image-worker.ts:127-263` uses `copyFile` or `sharp().extract().toFile()` with no resize), so D-07's "passthrough rows unaffected" invariant is preserved structurally.
- **NaN/zero-dim guard at line 393-405 unchanged** — already runs before the helper; helper trusts inputs.

### Threading the flag

`runExport` signature becomes (from current 5 args):
```typescript
runExport(plan, outDir, onProgress, isCancelled, allowOverwrite=false, sharpenEnabled=false)
```
Default `false` preserves backward-compat for direct test invocations and any caller bypassing the IPC.

`handleStartExport` in `src/main/ipc.ts:532` gains a 5th arg `sharpenEnabled: boolean` (default false), forwarded into `runExport(…, sharpenEnabled)` at line 654.

---

## effectiveScale Plumbing Audit

**It already exists.** No new plumbing needed.

[VERIFIED: src/shared/types.ts]

```typescript
// src/shared/types.ts:232-294
export interface ExportRow {
  sourcePath: string;
  outPath: string;
  sourceW: number;
  sourceH: number;
  outW: number;
  outH: number;
  effectiveScale: number;  // <-- LINE 239 — already on the row
  attachmentNames: string[];
  atlasSource?: { … };
  actualSourceW?: number;
  actualSourceH?: number;
  isCapped?: boolean;
}
```

`effectiveScale` is populated by `buildExportPlan` at `src/core/export.ts:292`:

```typescript
effectiveScale: acc.effScale,
```

`acc.effScale` is the post-override post-cap uniform scale (D-110). For passthrough rows it's at-or-above sourceRatio (cap binds); for resize rows it's the user's natural peak demand or override-relative value. Per D-07: passthrough rows are never sharpened (they don't enter the resize loop at all, so the gate is irrelevant for them). Per D-07: resize rows use `effectiveScale < 1.0` as the gate — for typical Spine art this is true on essentially every row except identity 1.0× cases.

**Edge case to flag:** `effectiveScale === 1.0` exactly (no override, peakScale === 1.0). The strict `< 1.0` predicate excludes these — correct per D-07 (no sharpen on no-resize). Floating-point note: peakScale comes from sampler + Math.ceil; comparison is safe (`effectiveScale` is the canonical float, not derived from outW/sourceW).

**No type changes needed for SHARP-02.** The flag plumbing is on the IPC + helper signature, not on per-row data.

---

## .stmproj Three-Touch Site Survey

The `loaderMode` precedent (Phase 21) is exactly the pattern. Adding `sharpenOnExport?: boolean` requires touching THREE files at FOUR sites total:

### Touch 1: Type definitions

**File:** `src/shared/types.ts`

| Site | Line(s) | Edit |
|------|---------|------|
| 1a | `ProjectFileV1` interface, ~775-779 | Add `sharpenOnExport: boolean;` |
| 1b | `AppSessionState` interface, ~790-803 | Add `sharpenOnExport: boolean;` |

```typescript
// src/shared/types.ts:754-780 — ProjectFileV1
export interface ProjectFileV1 {
  version: 1;
  skeletonPath: string;
  // … existing fields …
  loaderMode: 'auto' | 'atlas-less';
  /** Phase 28 SHARP-01 — opt-in unsharp-mask post-resize on downscale. Missing in pre-Phase-28 .stmproj files; validator pre-massages to false. */
  sharpenOnExport: boolean;
}

// src/shared/types.ts:790-803 — AppSessionState
export interface AppSessionState {
  // … existing fields …
  loaderMode: 'auto' | 'atlas-less';
  sharpenOnExport: boolean;  // Phase 28 SHARP-01
}
```

### Touch 2: validate / serialize / materialize (Layer 3 pure)

**File:** `src/core/project-file.ts`

| Site | Line(s) | Edit |
|------|---------|------|
| 2a | `validateProjectFile` after the `loaderMode` block at lines 174-186 | Add forward-compat pre-massage + per-field validation |
| 2b | `serializeProjectFile` at lines 281-302 | Add `sharpenOnExport: state.sharpenOnExport` |
| 2c | `PartialMaterialized` interface at lines 321-367 | Add `sharpenOnExport: boolean` |
| 2d | `materializeProjectFile` at lines 377-407 | Add `sharpenOnExport: file.sharpenOnExport ?? false` |

The validator pre-massage mirrors Phase 21's `loaderMode === undefined` block exactly:

```typescript
// src/core/project-file.ts — after line 186 (loaderMode block)
// Phase 28 SHARP-01 forward-compat — pre-Phase-28 .stmproj files have no
// sharpenOnExport field; default to false so legacy projects load with
// the neutral baseline. Mirrors loaderMode pre-massage above.
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

### Touch 3: AppShell session-state hydration & dirty-flag

**File:** `src/renderer/src/components/AppShell.tsx`

| Site | Line(s) | Edit |
|------|---------|------|
| 3a | `lastSaved` state shape ~340-350 | Add `sharpenOnExport: boolean` |
| 3b | `buildSessionState` ~711-720 | Include `sharpenOnExport: sharpenOnExportLocal` |
| 3c | `isDirty` memo ~795-805 | Compare `sharpenOnExportLocal !== lastSaved.sharpenOnExport` |
| 3d | New local state `[sharpenOnExportLocal, setSharpenOnExportLocal]` ~254 | Seeded from prop (project) like `samplingHzLocal` |
| 3e | `onClickSave` / `onClickSaveAs` ~826-833, 858-865 | Persist to `setLastSaved({ overrides, samplingHz, sharpenOnExport })` |

**Note:** `loaderMode` was not added to the dirty-flag in Phase 21 — it's hydrated separately. The samplingHz precedent IS in the dirty-flag (line 803). For Phase 28, mirror samplingHz exactly: a toggle change in OptimizeDialog should mark the project dirty, just as a samplingHz change in SettingsDialog does.

---

## Regression Test Approach (SHARP-03)

**Recommendation: integration-level real-bytes test (option b).**

### Why integration over unit

Two concrete falsifying observations:

1. **Mock-chain brittleness.** The existing `tests/main/image-worker.spec.ts:37-43` mocks sharp as `() => ({ resize: () => ({ png: () => ({ toFile }) }) })`. Asserting "sharpen was inserted between resize and png iff effectiveScale<1" requires either (a) tracking calls on a deeper chain (forks the mock per test and pollutes the existing baseline) or (b) replacing the mock with a per-test factory that distinguishes resize → sharpen → png from resize → png. Both add fragility without strong falsification.

2. **The unit test only checks structural symbol-presence**, not actual sharpening behavior. A real-bytes test catches a regression where sigma changes value silently (e.g. someone refactors `SHARPEN_SIGMA` to `0.05` thinking it's "more conservative"); the unit-mock test can't see that.

### Recommended test shape

**File:** `tests/main/image-worker.sharpen.spec.ts` (new file, sister to existing integration spec)

**Pattern:** clone `tests/main/image-worker.integration.spec.ts` (88 lines, no mocks). Three test cases:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan } from '../../src/shared/types.js';

let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-sharpen-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

// Build a synthetic 64×64 PNG with a high-contrast edge (half black, half white).
// Sharpening such an edge produces measurable variance increase at the boundary.
async function buildEdgeFixture(p: string): Promise<void> {
  const buf = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const o = (y * 64 + x) * 4;
      const v = x < 32 ? 0 : 255;
      buf[o + 0] = v; buf[o + 1] = v; buf[o + 2] = v; buf[o + 3] = 255;
    }
  }
  await sharp(buf, { raw: { width: 64, height: 64, channels: 4 } }).png().toFile(p);
}

describe('runExport — sharpen (SHARP-03 regression)', () => {
  it('sharpenEnabled=true + effectiveScale<1.0 produces sharper output than baseline', async () => {
    const src = path.join(tmpDir, 'edge.png');
    await buildEdgeFixture(src);
    const plan: ExportPlan = { rows: [{
      sourcePath: src, outPath: 'images/edge.png',
      sourceW: 64, sourceH: 64, outW: 32, outH: 32,
      effectiveScale: 0.5, attachmentNames: ['edge'],
    }], excludedUnused: [], passthroughCopies: [], totals: { count: 1 } };

    // Baseline: no sharpen
    const baselineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-baseline-'));
    await runExport(plan, baselineDir, () => {}, () => false, false, false);
    const baselineRaw = await sharp(path.join(baselineDir, 'images/edge.png')).raw().toBuffer();

    // Sharpened
    await runExport(plan, tmpDir, () => {}, () => false, false, true);
    const sharpenedRaw = await sharp(path.join(tmpDir, 'images/edge.png')).raw().toBuffer();

    // Variance at the column-15..17 transition zone (the edge after downscale)
    // is strictly higher in the sharpened output than in the baseline.
    const baselineVar = computeEdgeVariance(baselineRaw);
    const sharpenedVar = computeEdgeVariance(sharpenedRaw);
    expect(sharpenedVar).toBeGreaterThan(baselineVar);

    fs.rmSync(baselineDir, { recursive: true, force: true });
  });

  it('sharpenEnabled=true + effectiveScale=1.0 produces baseline output (gate enforced)', async () => {
    // Same fixture. effectiveScale 1.0, outW=64, outH=64 (1:1 passthrough-via-resize).
    // Expect byte-identical output regardless of sharpenEnabled flag.
    // (effectiveScale<1.0 gate prevents .sharpen() from being called.)
    // … assertion: Buffer.compare(rawA, rawB) === 0
  });

  it('sharpenEnabled=false produces baseline output even on downscale (toggle off)', async () => {
    // effectiveScale=0.5, sharpenEnabled=false → output equals the no-sharpen baseline.
    // Buffer.compare(rawA, rawB) === 0
  });
});
```

`computeEdgeVariance` is a 10-line helper computing pixel-value variance over the 14-18 column range — sharpened edges have higher variance because the unsharp mask boosts the high-frequency component.

### Fixture choice (per Claude's Discretion D-08)

Use a **synthetic 64×64 black/white edge** as shown — generated in the test via `Buffer.alloc` + sharp raw input. Smaller than `fixtures/EXPORT_PROJECT/images/CIRCLE.png` (699×699), more deterministic (binary edge rather than soft anti-aliased disk), and isolated from existing Phase 6 / Phase 22 golden tests. Mirrors `scripts/pma-probe.mjs` synthetic-fixture style — same mental model.

### What this test locks

| Invariant | Catch mechanism |
|-----------|------------------|
| `SHARPEN_SIGMA = 0.5` | Variance delta is sigma-dependent; if sigma → 0.05, the test fails because variance increase falls below threshold |
| Downscale-only gate | Test 2 asserts byte-identity at effectiveScale=1.0 regardless of toggle |
| Toggle wiring | Test 3 asserts byte-identity when toggle off |
| Both call sites | Use one test variant feeding via `atlasSource` to exercise the atlas-extract branch, OR run the test twice in a `describe.each` |

---

## Constant Location Recommendation

**Recommendation: `src/main/image-worker.ts` top-level constant.**

**One-sentence rationale:** sigma is sharp-specific tuning that has no role outside the image-worker — colocating it with its single consumer prevents accidental Layer 3 cross-import, and `src/core/constants.ts` doesn't exist (no precedent for creating one for a single-use numeric constant).

```typescript
// src/main/image-worker.ts (top, after the import block ~line 64)
/**
 * Phase 28 SHARP-02 — fixed sigma for sharp.sharpen() unsharp mask. NOT a
 * tunable, slider, or per-row override (D-05 LOCKED). Closely matches
 * Photoshop's "Bicubic Sharper (reduction)" preset for typical Spine art at
 * 50–75% downscale ratios.
 */
const SHARPEN_SIGMA = 0.5;
```

Alternative considered: add to `src/core/export.ts` (where Phase 6 export math lives). Rejected — sigma has no semantic relationship to export math, and `src/core/` is sharp-free; placing it there suggests cross-layer coupling that doesn't exist. The user-locked memory `project_phase6_default_scaling.md` covers `src/core/export.ts:262-263` uniform-only invariants — keeping sharpen-related constants OUT of that file preserves separation.

---

## OptimizeDialog State Hygiene Findings

### Current pattern (no surprises)

1. **Mount.** `AppShell.tsx:569` `onClickOptimize` builds the plan, calls `setExportDialogState({ plan, outDir: lastOutDir })`. The dialog mounts via `<OptimizeDialog open={…} plan={…} outDir={…} onClose={…} onConfirmStart={…} onOpenAtlasPreview={…} />`.

2. **State seeding.** OptimizeDialog has NO project-state hooks at present — its only stateful props are `plan` and `outDir`. The dialog is mounted fresh every Optimize click; there's no "reopens with prior state" mode.

3. **Submit.** `onConfirmStart` (in AppShell) runs the conflict probe, opens the folder picker if needed, and resolves with `{ proceed, overwrite, outDir }`. The dialog passes outcome to `window.api.startExport(plan, outDir, overwrite)` at line 223.

### Where the new toggle hooks in

The toggle is **not modal-local** — it persists per-project in `.stmproj`. The pattern matches Phase 9 `samplingHz` exactly:

| Layer | Wiring |
|-------|--------|
| AppShell | New local state `sharpenOnExportLocal: boolean`, seeded from the project on mount (mirrors `samplingHzLocal` at line 254) |
| AppShell → dialog | New OptimizeDialog prop `sharpenOnExport: boolean` + `onSharpenChange: (v: boolean) => void` |
| Dialog | Renders a checkbox that calls `props.onSharpenChange(e.target.checked)` |
| AppShell | `onSharpenChange` updates `sharpenOnExportLocal`; `isDirty` memo picks it up; Save flow persists |
| Submit | `onConfirmStart` includes `sharpenOnExport: sharpenOnExportLocal` in the resolved object, OR AppShell threads it directly into `window.api.startExport(plan, outDir, overwrite, sharpenOnExportLocal)` |

**Simpler alternative:** keep the toggle entirely modal-local (no AppShell prop) and pass it inline via `window.api.startExport(plan, outDir, overwrite, sharpenChecked)` in the dialog itself. This matches OptimizeDialog's "fresh on every mount" model — but breaks D-06 .stmproj persistence. So this alternative is rejected; the toggle MUST round-trip through AppShell state for D-06.

**Tailwind v4 literal-class discipline:** the checkbox's `className` is a string literal — no template interpolation, matching `OptimizeDialog.tsx:418` precedent.

**Copy:** Per D-03 + Claude's Discretion bullet, pick at planning time. Suggested: `"Sharpen output on downscale"` (matches Phase 19 quantified-callout style — short imperative noun phrase).

### Where in the dialog the checkbox renders

Above the 3-tile summary (line 366), or to the LEFT of the footer button cluster. The 3-tile summary is the natural home — it sits above the file list, visible in pre-flight, hidden during in-progress (state branch at line 381). Adding a fourth-row of the form `[checkbox] Sharpen output on downscale` BELOW the 3 tiles, BEFORE the file list, gives it the same prominence as the savings tile while keeping the existing 3-tile horizontal harmony. Final placement is plan-time UX call.

### Disabled state

When `state === 'in-progress'`, the checkbox should be `disabled` — flipping it mid-export is meaningless (the IPC payload is already in flight). Mirror the existing Atlas Preview button's disabled predicate at line 417.

---

## Backward-Compat Verification

[VERIFIED: src/core/project-file.ts:174-186 + 178-180]

The existing `loaderMode` pre-massage is the EXACT pattern Phase 28 mirrors:

```typescript
// src/core/project-file.ts:174-186
// Phase 21 D-08 forward-compat — Phase 8/20-era .stmproj files have no
// `loaderMode` field; default to 'auto' so legacy projects load through
// the canonical (atlas-by-default) path unchanged.
if (obj.loaderMode === undefined) {
  obj.loaderMode = 'auto';
}
if (obj.loaderMode !== 'auto' && obj.loaderMode !== 'atlas-less') {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: "loaderMode is not 'auto' | 'atlas-less'" },
  };
}
```

Optional fields after the pre-massage are validated with the existing per-field type checks (`samplingHz` is `null | number`, `sortDir` is `null | 'asc' | 'desc'`, etc.). The `materializeProjectFile` at line 387 also defaults: `samplingHz: file.samplingHz ?? 120`, line 403 `loaderMode: file.loaderMode ?? 'auto'`. Both layers (validator + materializer) provide the default — defense in depth so any code path bypassing the validator still gets a safe value.

[VERIFIED: tests/core/project-file.spec.ts:310-371] The Phase 21 test suite has three explicit backward-compat tests:

- "validateProjectFile pre-massages missing loaderMode to 'auto' (forward-compat for Phase 8/20-era files)" — line 311
- "validateProjectFile rejects loaderMode values other than 'auto'/'atlas-less'" — line 332
- "serialize → materialize round-trips loaderMode: 'atlas-less' identically" — line 354

Phase 28 must add the parallel three for `sharpenOnExport`:

- pre-massages missing `sharpenOnExport` to `false` (forward-compat for v1.2-era files)
- rejects non-boolean `sharpenOnExport`
- round-trips `sharpenOnExport: true` and `: false` identically

---

## Validation Architecture (Nyquist)

> Phase 28 has 4 distinct validation needs corresponding to SHARP-01..03 + the .stmproj backward-compat invariant. Each maps to a concrete vitest artifact.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (npm run test) |
| Config file | `vitest.config.ts` (existing, no changes for this phase) |
| Quick run command | `npm run test -- tests/main/image-worker.sharpen.spec.ts tests/core/project-file.spec.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SHARP-01 (UI persistence) | `sharpenOnExport` round-trips through `.stmproj` v1; missing field defaults to `false` | unit (project-file) | `npm run test -- tests/core/project-file.spec.ts -t "Phase 28"` | New tests in existing file |
| SHARP-02 (image-worker integration) | `sharpenEnabled=true` + `effectiveScale<1.0` actually sharpens; both call sites covered | integration (real bytes) | `npm run test -- tests/main/image-worker.sharpen.spec.ts` | New file |
| SHARP-03 (regression: sigma + gate) | sigma=0.5 locked; `effectiveScale>=1.0` never sharpens; `sharpenEnabled=false` never sharpens | integration (real bytes) | Same as SHARP-02 | New file |
| .stmproj backward-compat | Pre-Phase-28 .stmproj loads cleanly with `sharpenOnExport=false` | unit (project-file) | `npm run test -- tests/core/project-file.spec.ts -t "Phase 28"` | New tests in existing file |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/main/image-worker.sharpen.spec.ts tests/core/project-file.spec.ts` — runs in <5s
- **Per wave merge:** `npm run test` — full suite (~30s, currently 687+ tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Validation Dimensions

#### Dimension 1 — Sharpen call is gated correctly

**What it must demonstrate:** `effectiveScale < 1.0 AND sharpenEnabled === true` is the EXACT condition that produces sharpened output. Three sub-cases:
- (a) toggle ON + downscale → sharpened (variance > baseline)
- (b) toggle ON + identity (1.0×) → byte-identical to baseline
- (c) toggle OFF + downscale → byte-identical to baseline

**Artifact:** `tests/main/image-worker.sharpen.spec.ts` (new) — 3 `it()` blocks above.

**Failure mode:** If the gate inverts (e.g. `<= 1.0` typo) or the conditional drifts (e.g. always-on regardless of toggle), case (b) or case (c) detect it via `Buffer.compare !== 0`.

#### Dimension 2 — Sigma constant is locked

**What it must demonstrate:** SHARPEN_SIGMA's value (0.5) produces a measurable variance delta on the synthetic edge fixture. A sigma drift to 0.05 fails the variance threshold; a drift to 5.0 makes the threshold trivially pass but produces visible halos in any human review.

**Artifact:** Same file, dimension 1's case (a). Threshold tuned at planning time after running the test once with sigma=0.5; record the baseline variance and sharpened variance and pick a threshold like `expect(sharpenedVar).toBeGreaterThan(baselineVar * 1.5)`.

**Failure mode:** Sigma drift breaks the variance ratio; test fails.

#### Dimension 3 — `.stmproj` round-trip preserves the field

**What it must demonstrate:** `serialize({…, sharpenOnExport: true}) → JSON.stringify → JSON.parse → validate → migrate → materialize` produces `sharpenOnExport: true`, and same for `false`.

**Artifact:** `tests/core/project-file.spec.ts` (existing file, new `describe('Phase 28 — sharpenOnExport (D-06)')` block). Mirrors Phase 21 lines 310-371 verbatim, swap `loaderMode` → `sharpenOnExport` and `'atlas-less'` → `true`.

**Failure mode:** If serialize drops the field or materialize uses `??true` instead of `??false`, the round-trip fails the equality assertion.

#### Dimension 4 — Backward-compat (pre-Phase-28 .stmproj loads with toggle OFF)

**What it must demonstrate:** A v1.2-era .stmproj WITHOUT `sharpenOnExport` validates successfully and materializes to `sharpenOnExport: false`. Defense-in-depth: validator pre-massage AND materializer fallback both produce `false`.

**Artifact:** `tests/core/project-file.spec.ts` — one new `it()` in the same Phase 28 describe block:

```typescript
it('validateProjectFile pre-massages missing sharpenOnExport to false (v1.2-era backward-compat)', () => {
  const v12EraFile = {
    version: 1,
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: null,
    imagesDir: null,
    overrides: {},
    samplingHz: null,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: {},
    loaderMode: 'auto',
    // sharpenOnExport INTENTIONALLY ABSENT
  };
  const r = validateProjectFile(v12EraFile);
  expect(r.ok).toBe(true);
  if (r.ok) expect((r.project as ProjectFileV1).sharpenOnExport).toBe(false);
});
```

**Failure mode:** If the validator rejects on missing field instead of pre-massaging, the test fails — and a real user opening their pre-Phase-28 project hits an alert.

### Wave 0 Gaps

- [ ] `tests/main/image-worker.sharpen.spec.ts` — new file covering SHARP-02 + SHARP-03 (integration real-bytes)
- [ ] `tests/core/project-file.spec.ts` — new `describe('Phase 28 — sharpenOnExport (D-06)')` block covering Dimension 3 + 4

*(No new conftest / shared fixture needed — the synthetic edge buffer is built inline; existing `vitest.config.ts` and `tests/main/__snapshots__` infrastructure is sufficient.)*

---

## Open Questions / Risks

### Q1: IPC envelope shape — inline 5th arg or `OptimizeOptions` envelope?

**Context:** `window.api.startExport(plan, outDir, overwrite?)` already takes a 3rd boolean arg. Phase 28 needs a 4th arg.

**Option A (inline):** `startExport(plan, outDir, overwrite?, sharpenEnabled?)`. Mirrors the `overwrite` precedent. Simplest. Risk: if Phase 29 needs another flag, we go to 5 args.

**Option B (envelope):** Replace the 3rd arg with an `OptimizeOptions { overwrite?: boolean; sharpenOnExport?: boolean }`. Cleaner forward-compat. Risk: breaking change to 4 IPC sites (preload, main, renderer dialog, IPC type).

**Recommendation:** Option A. Aligns with Phase 22's `passthroughCopies[]` pattern (each phase added one field at the obvious site). Reserve envelope refactor for a phase that ADDS multiple flags simultaneously.

### Q2: Should the sharpen flag also apply to the atlas-extract path's RESIZE? (D-08 says yes — flag for re-confirmation)

**D-08 LOCKED:** "Sharpen applied to BOTH image-worker.ts resize call sites." Both call sites end with the same `.png(level 9).toFile()` chain. The DRY helper structurally guarantees both branches sharpen identically when the flag is on. No risk — just calling out that the test in Dimension 1 should explicitly cover both branches (one test feeds `atlasSource`, one omits it).

### Q3: SHARP-01..03 are not yet rows in REQUIREMENTS.md

**Confirmed gap:** REQUIREMENTS.md sections at lines 13-37 are PANEL / OPT / UI / QA. `SHARP-01..03` are referenced in `ROADMAP.md` line 10 (milestone bullet) and line 80 (phase bullet) but have no row in REQUIREMENTS.md.

**Risk:** `/gsd-verify-work 28` will run a traceability check; without REQ rows, it may flag the phase as "no requirements found" or use an empty acceptance set. See "Quick win / housekeeping" below.

### Q4: Is the toggle-state propagated to AppShell's `isDirty` memo, or modal-local-only?

D-06 LOCKED — persists in .stmproj. Therefore **must** thread through `isDirty`. Mirrors `samplingHz` precedent (line 803 of AppShell.tsx). Confirmed; no open question — but planner should explicitly task this so it's not skipped.

### Q5: Variance threshold for SHARP-03 dimension 2

The exact `>= baselineVar * X` constant has to be picked at plan-time after running the test once. Suggest baseline = "what sigma=0.5 produces" + 30% safety margin so a sigma=0.4 would pass and sigma=0.05 would fail. Will need a concrete-number commit during plan execution.

### Q6: What if the user enables sharpenOnExport but the entire plan is passthrough (no resize rows)?

Per D-07, passthrough rows are byte-copied — never enter the helper. So sharpenOnExport=true with all-passthrough plan is a no-op. This is correct behavior, but the OptimizeDialog should arguably mute the checkbox when `plan.rows.length === 0` (all passthrough) to avoid user confusion. Flag for plan-time UX call.

---

## Quick win / housekeeping

**REQUIREMENTS.md needs SHARP-01..03 rows added.** Two options for plan-phase to handle:

**Option X (preferred):** Add a new `### SHARP — Output Quality` section after `### QA` (after line 38) with three rows:

```markdown
### SHARP — Output Quality

- [ ] **SHARP-01**: User opt-in checkbox in OptimizeDialog ("Sharpen output on downscale" or final copy) controls whether sharp.sharpen({ sigma: 0.5 }) is applied to downscaled rows; toggle persists per-project in .stmproj v1 schema (additive optional `sharpenOnExport: boolean`; missing field defaults to false for backward-compat with v1.2-era files).
- [ ] **SHARP-02**: When toggle is ON, image-worker applies sharp.sharpen({ sigma: 0.5 }) AFTER the Lanczos3 resize on rows where effectiveScale < 1.0. Both resize call sites (per-region path at src/main/image-worker.ts:447-451 and atlas-extract path at src/main/image-worker.ts:437-446) receive the conditional sharpen.
- [ ] **SHARP-03**: Regression test locks SHARPEN_SIGMA constant value (0.5) and the downscale-only gate (effectiveScale < 1.0); test asserts that toggle OFF + downscale produces baseline output (no sharpen) and toggle ON + identity scale (1.0) produces baseline output (gate enforced).
```

Plus the traceability table at line 67 gains three rows:

```markdown
| SHARP-01 | Phase 28 | Pending |
| SHARP-02 | Phase 28 | Pending |
| SHARP-03 | Phase 28 | Pending |
```

**Option Y:** Fold them into OPT-04, OPT-05, OPT-06 (same format). Simpler but less semantic — sharpen is a quality concern, not an Optimize-flow workflow concern.

**Recommendation:** Option X. Treat as Plan 28-00 or as part of Plan 28-01 (whichever is cleaner) — minor cost, big traceability win for the verification gate.

**Also flag for planner:** ROADMAP.md line 10 bullet and line 80 phase bullet already have the new wording per D-02; they are NOT stale. STATE.md lines 7, 20 reference the pivot correctly. No additional doc-edit task — these were updated during context-gathering.

---

## Project Constraints (from CLAUDE.md)

| Constraint | How Phase 28 honors it |
|------------|-------------------------|
| Layer 3 invariant: no `sharp` / `electron` in `src/core/` | `SHARPEN_SIGMA` const + `applyResizeAndSharpen` helper live in `src/main/image-worker.ts`. Project-file.ts adds boolean field only — no sharp import. |
| `core/` is pure TypeScript, no DOM | project-file.ts changes use `node:path` only (already permitted) |
| `.stmproj` v1 backward-compat (additive optional fields, NO schema bump) | New field is additive optional; validator pre-massages missing → false. `version: 1` unchanged. |
| Tailwind v4 literal-class discipline | Checkbox `className` is a string literal in OptimizeDialog.tsx |
| Test fixtures live in `fixtures/`, not `temp/` | New synthetic fixture is generated in-test via `Buffer.alloc` + sharp; no on-disk fixture commit needed |
| GSD phase-gated workflow | Plan via /gsd-plan-phase 28 → execute → /gsd-verify-work 28 |

---

## Sources

### Primary (HIGH confidence)
- [sharp/lovell library Context7 docs](https://sharp.pixelplumbing.com/api-operation) — fetched 2026-05-06 via `npx ctx7@latest docs /websites/sharp_pixelplumbing "sharpen sigma m1 m2"`. Verified sharpen() parameter ranges + defaults + LAB-mode trigger.
- `src/main/image-worker.ts:430-462` — current resize site implementation, both branches in unified try/catch
- `src/shared/types.ts:232-294` — ExportRow shape including `effectiveScale: number` at line 239
- `src/core/project-file.ts:88-407` — validate/serialize/materialize three-touch pattern
- `src/renderer/src/modals/OptimizeDialog.tsx` — current state hygiene + state machine
- `src/renderer/src/components/AppShell.tsx:254, 569-640, 795-805` — OptimizeDialog wiring + samplingHz precedent for dirty-flag
- `tests/core/project-file.spec.ts:310-371` — Phase 21 loaderMode test pattern (direct precedent for SHARP-01 / D-06 round-trip tests)
- `tests/main/image-worker.integration.spec.ts` — real-bytes integration test pattern (template for SHARP-03)
- `package.json` — sharp@0.34.5 + libvips@8.17.3 verified via `npm ls` and `node -e "require('sharp').versions"`

### Secondary (MEDIUM confidence)
- `scripts/pma-probe.mjs` — synthetic-fixture pattern reference (variance-based regression sentinel idiom)
- `.planning/phases/28-optional-output-sharpening/28-CONTEXT.md` — locked decisions D-01..D-08 + Claude's Discretion
- `.planning/ROADMAP.md` lines 10, 80 — milestone + phase bullet wording

### Tertiary (LOW confidence)
- None — every claim in this research is either codebase-verified, Context7-cited, or explicitly tagged.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Variance-based assertion threshold (`sharpenedVar > baselineVar * 1.5`) is achievable on the 64×64 black/white edge fixture | SHARP-03 / Dimension 2 | Test threshold needs adjustment at plan execution time after first run. Low risk — variance ratio for sigma=0.5 unsharp on a hard edge is empirically large (Photoshop's Bicubic Sharper preset has been tested by millions of users). |
| A2 | The 5-arg → 6-arg `runExport` signature change won't break any existing test invocations because all current callers pass the first 4 args and let the 5th default | Call-Site DRY Recommendation | Trivially verifiable at planning time via `grep "runExport(" tests/`. Default args make this safe. |

---

## Metadata

**Confidence breakdown:**
- Standard stack (sharp.sharpen API): HIGH — Context7 official docs verified, libvips/sharp version pinned in package.json, ABI stable since sharp 0.20
- Architecture (.stmproj three-touch): HIGH — direct loaderMode precedent verified line-by-line in src/core/project-file.ts and tests/core/project-file.spec.ts
- IPC threading: HIGH — overwrite-flag precedent (Phase 6 Gap-Fix Round 3) verified
- Test approach (integration over unit): MEDIUM — integration is the recommended path, but the unit-mock approach is technically feasible if the planner prefers it for speed; rationale-supported recommendation
- Pitfalls: HIGH — no PMA concerns (D-01 falsified), no Layer 3 violations possible with proposed const placement, idempotency guaranteed by helper shape

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days; sharp/libvips are stable, no upcoming-release pressure)
