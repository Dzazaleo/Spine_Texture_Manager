# Phase 40: Atlas Repack Output — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 11 new / 7 modified = 18 total
**Analogs found:** 11 / 11 new files (100%)

## File Classification

### NEW files

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/core/repack.ts` | service (pure-TS pack planner) | transform | `src/core/atlas-preview.ts` | exact (same packer, same `core/` purity, similar shape) |
| `src/main/atlas-writer.ts` | service (text serializer) | transform | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (canonical output reference) + `src/core/synthetic-atlas.ts` (in-repo libgdx-format emitter pattern, RESEARCH §Landmines #4) | role-match (string-builder; no exact `.atlas` writer exists) |
| `src/main/repack-worker.ts` | worker (sharp orchestration) | batch + atomic-write | `src/main/image-worker.ts` (`runExport` + atomic-write idiom + cancellation) | exact |
| `tests/core/repack.spec.ts` | test (pack-math unit) | request-response | `tests/core/atlas-preview.spec.ts` | exact (same packer, same `core/` purity grep, same fixture base) |
| `tests/main/atlas-writer.spec.ts` | test (libgdx round-trip unit) | request-response | `tests/core/loader.spec.ts` (imports `@esotericsoftware/spine-core` `TextureAtlas`) | role-match |
| `tests/main/repack-worker.spec.ts` | test (sharp integration) | batch | `tests/main/image-worker.integration.spec.ts` | exact (sharp-in-vitest precedent at L25) |
| `tests/main/repack.loose-parity.spec.ts` | test (SHA256 baseline) | request-response | `tests/integration/emit-latest-yml.spec.ts` (SHA hashing precedent) | partial (no SHA256 in `tests/main/` today; use SHA512 idiom unchanged but switch algo) |
| `tests/main/repack.parity.spec.ts` | test (cross-loaderMode SHA256) | request-response | same as above + `tests/core/loader-atlas-less.spec.ts` (atlas-less load idiom) | role-match |
| `tests/fixtures/repack-baselines.json` | fixture (JSON sidecar) | data | (none — no equivalent sidecar in repo; pattern is greenfield) | no analog |
| `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` | fixture (committed expected text) | data | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (format reference) | exact (format match) |
| `scripts/repack-refresh-baselines.mjs` | script (manual refresh) | batch | `scripts/fixture-atlas-source-drift.mjs` (npm-script-driven fixture mutator) + `scripts/pma-probe.mjs` (sharp-in-script precedent) | role-match |

### MODIFIED files

| File | Lines | Splice Site | Pattern Driver |
|------|-------|-------------|----------------|
| `src/renderer/src/modals/OptimizeDialog.tsx` | 797 | Insert before L437; modify L274 (onStart) + L159-190 (progress) | Quality-card pattern + safetyBufferPercent + sharpenOnExport patterns |
| `src/main/image-worker.ts` | 679 | L89-110 (`applyResizeAndSharpen`); L295/353 (atomic write); L178/380 (cancellation) | Extract helper per D-03a |
| `src/main/ipc.ts` | 1006 | L286 (validateExportPlan); L661-673 (runExport call); L703-711 (channel registration) | Extend positional args + dispatch loose/atlas/both |
| `src/shared/types.ts` | 1663 | L1042-1060 (additive field precedent in `ProjectFileV1`); L1071-1089 (`AppSessionState` mirror); L531-538 (`ExportProgressEvent`) | Additive-field-no-schema-bump pattern (×3 precedent) |
| `src/core/project-file.ts` | 584 | L176-224 (3 precedent pre-massage blocks); apply same idiom ×4 | `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent |
| `tests/arch.spec.ts` | (~200) | L148-160 core-purity grep block | Extend exempt-list or assert `core/repack.ts` is clean |
| `tests/core/project-file.spec.ts` | (~600) | After existing additive-field tests | Add 4 new field assertions |

---

## Pattern Assignments — NEW files

### `src/core/repack.ts` (service, pure-TS, transform)

**Analog:** [`src/core/atlas-preview.ts`](src/core/atlas-preview.ts)

**Imports + Layer-3 hygiene** (atlas-preview.ts:30-52):
```typescript
/**
 * Layer 3 hygiene (CLAUDE.md rule #5): NO imports of node:fs, node:path,
 * sharp, electron, @esotericsoftware/spine-core (runtime), or DOM types.
 * Type-only imports from '../shared/types.js' and runtime imports of
 * './export.js' (for buildExportPlan reuse) + 'maxrects-packer' (verified
 * browser-safe by RESEARCH tarball audit) are the only allowed dependencies.
 * Enforced by tests/core/atlas-preview.spec.ts hygiene grep block +
 * tests/arch.spec.ts Layer 3 gate (auto-scans src/core/**).
 */
import type {
  AtlasPage,
  AtlasPreviewInput,
  AtlasPreviewProjection,
  PackedRegion,
  SkeletonSummary,
} from '../shared/types.js';
import { buildExportPlan } from './export.js';
import { MaxRectsPacker } from 'maxrects-packer';
```

**Deterministic input sort** (atlas-preview.ts:102-107):
```typescript
// 3. Determinism: sort by sourcePath then regionName so two runs over the
//    same summary produce byte-identical packer output (matches src/core/export.ts:223).
inputs.sort((a, b) => {
  const cmp = a.sourcePath.localeCompare(b.sourcePath);
  return cmp !== 0 ? cmp : a.regionName.localeCompare(b.regionName);
});
```
*Phase 40 variant per RESEARCH §Landmines #9*: sort by `regionName` ONLY (sourcePath diverges between loaderModes; regionName is loader-invariant — required for REPACK-08 cross-loaderMode parity).

**Packer construction** (atlas-preview.ts:109-119) — Phase 40 must extend `allowRotation` from hardcoded `false` to user-driven:
```typescript
// 4. D-132 hardcoded packer params + RESEARCH Recommendation A (pot:false, square:false).
const packer = new MaxRectsPacker(opts.maxPageDim, opts.maxPageDim, 2, {
  smart: true,
  allowRotation: false,    // ← Phase 40: thread atlasAllowRotation here
  pot: false,        // tight-fit bin sizing (RESEARCH Pitfall 7)
  square: false,     // tight-fit bin sizing (RESEARCH Pitfall 7)
  border: 0,
});
for (const inp of inputs) {
  packer.add(inp.packW, inp.packH, inp);
}
```

**Pre-flight oversize collection** (atlas-preview.ts:91-100) — direct template for REPACK-10:
```typescript
const oversize: string[] = [];
const inputs: AtlasPreviewInput[] = [];
for (const inp of allInputs) {
  if (inp.packW > opts.maxPageDim || inp.packH > opts.maxPageDim) {
    oversize.push(inp.regionName);
  } else {
    inputs.push(inp);
  }
}
oversize.sort();
```
*Phase 40 variant*: oversize check happens BEFORE adding to packer (REPACK-10 requires pre-flight abort), and the worker reads `result.oversize[0]` to throw the locked error string with `{W}×{H}` filled in.

**Bins → output fold** (atlas-preview.ts:121-148) — same shape; rename projection fields per Phase 40 API:
```typescript
const pages: AtlasPage[] = packer.bins.map((bin, pageIndex) => {
  const regions: PackedRegion[] = bin.rects.map((r) => {
    const inp = (r as unknown as { data: AtlasPreviewInput }).data;
    return {
      regionName: inp.regionName,
      x: r.x,
      y: r.y,
      w: r.width,   // ← already post-rotation per .d.ts:97-98 (RESEARCH §Landmines #3)
      h: r.height,
      // Phase 40 adds: rotated: r.rot, pageIndex
    };
  });
  return { pageIndex, width: bin.width, height: bin.height, regions, /*...*/ };
});
```

---

### `src/main/atlas-writer.ts` (service, transform, pure)

**Analog (format reference):** [`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`](fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas) — the in-repo authoritative libgdx format:
```text
SIMPLE_TEST.png
size:1839,1464
filter:Linear,Linear
CIRCLE
bounds:1004,2,699,699
SQUARE
bounds:2,462,1000,1000
TRIANGLE
bounds:1004,703,833,759
```

Whitespace style locked: `key:value` with **no space after colon**, LF line endings, no trailing newline. Trailing newline on the fixture is incidental — RESEARCH §"Whitespace style" recommends omitting for byte-for-byte git-diff friendliness.

**Analog (in-repo string-builder):** [`src/core/synthetic-atlas.ts:188-208`](src/core/synthetic-atlas.ts) — in-repo precedent for emitting libgdx-format text (RESEARCH §Landmines #4 cites this as "the in-repo reference"). Use this as the structural template for the page-header + region-block emission loop, including the **blank-line-only-between-pages** rule.

**Format invariants from RESEARCH §libgdx .atlas Format Reference (TextureAtlas.js source-verified):**
- First line of each page block is page filename (no colon)
- `size:W,H` / `filter:Linear,Linear` / `format:RGBA8888` / `repeat:none` page headers
- Region block: name on its own line (no colon), then `bounds:X,Y,W,H` (modern format; matches SIMPLE_TEST.atlas)
- `rotate:true` ONLY when `region.rotated === true`
- Blank line ONLY between pages (RESEARCH §Landmines #4 — blank inside page corrupts parse)
- Omit `orig`/`offsets` when no trimming (Phase 40 atlas-output never trims)
- Assert `projectName` is `:`-free at entry (RESEARCH §Landmines #5)

**Page naming** (REPACK-05 locked): `{projectName}.png` for page 0; `{projectName}_{N+1}.png` for page N≥1 (so user-facing "page 2 of 3" → `_2.png`).

**Pure function signature** — no `fs.writeFile` inside; returns string for the worker to atomic-write:
```typescript
export function buildAtlasText(input: AtlasWriterInput): string;
```

---

### `src/main/repack-worker.ts` (worker, batch + atomic-write)

**Analog:** [`src/main/image-worker.ts`](src/main/image-worker.ts) (`runExport` at L112-678)

**Imports** (image-worker.ts:58-66):
```typescript
import sharp from 'sharp';
import { access, copyFile, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
import { dirname, resolve as pathResolve, relative as pathRelative, isAbsolute } from 'node:path';
import type {
  ExportError,
  ExportPlan,
  ExportProgressEvent,
  ExportSummary,
} from '../shared/types.js';
```
*Phase 40 adds*: import `computeRepack` from `../core/repack.js` and `buildAtlasText` from `./atlas-writer.js`.

**Shared resize helper (D-03a extraction target)** (image-worker.ts:74-110):
```typescript
const SHARPEN_SIGMA = 0.5;

function applyResizeAndSharpen(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): sharp.Sharp {
  let p = pipeline.resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' });
  if (
    sharpenEnabled &&
    Number.isFinite(effectiveScale) &&
    effectiveScale < 1.0
  ) {
    p = p.sharpen({ sigma: SHARPEN_SIGMA });
  }
  return p.png({ compressionLevel: 9 });
}
```
*Phase 40 extraction (RESEARCH §"Per-region resize" Path B recommended)*: split the `.png(...).toFile(...)` tail off. Provide two helpers:
- `resizeToTmpFile(...)` — loose path; keeps `.png(...).toFile(tmpPath)` byte-identical (REPACK-01 acceptance).
- `resizeToBuffer(...)` — atlas path; returns `.raw().toBuffer()` or PNG-encoded buffer for downstream composite.

**Atomic-write idiom — primary template** (image-worker.ts:295-353):
```typescript
// 4. Write to tmpPath, then rename — atomic write per Phase 6 D-121
//    + R4 macOS delayed-allocation safety. The output path only appears
//    when fully written.
const tmpPath = resolvedOut + '.tmp';
try {
  await pipeline.toFile(tmpPath);
} catch (e) {
  const error: ExportError = { kind: 'sharp-error', /* ... */ };
  errors.push(error);
  onProgress({ /* ... status: 'error' ... */ });
  continue;
}
try {
  await rename(tmpPath, resolvedOut);
} catch (e) {
  /* ... */
}
```

**Atomic rollback shape — per RESEARCH §Landmines #7**: register BOTH `tmpPath` AND final `pagePath` in `written: Set<string>` BEFORE the `toFile` call; cleanup loop sweeps both:
```typescript
const tmpPath = pagePath + '.tmp';
written.add(tmpPath);
written.add(pagePath);
await sharp(/*...*/).composite(layers).png({ compressionLevel: 9 }).toFile(tmpPath);
await rename(tmpPath, pagePath);
```

**Cancellation cooperation** (image-worker.ts:178-181 + L380-383):
```typescript
for (let pi = 0; pi < plan.passthroughCopies.length; pi++) {
  if (isCancelled()) {
    bailedOnCancel = true;
    break;
  }
  // ... per-row work
}
```
*Phase 40 cadence*: check `isCancelled()` between resize iterations AND between page composites. Mid-libvips ops are not abortable (RESEARCH §"Cooperative cancel between files").

**Sharp composite — page builder** (RESEARCH §Sharp Composite Pipeline):
```typescript
const pageBuffer = await sharp({
  create: {
    width: pageW,
    height: pageH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(layers)  // layers = Array<{ input, top, left }>
  .png({ compressionLevel: 9 })
  .toFile(tmpPath);
```

**Materialize-then-reload for rotation (RESEARCH §"Pipeline fusion landmine")** — image-worker.ts:583-606 is the in-repo reference:
```typescript
// Two-pipeline (rotated path): materialize, then re-open. Libvips fuses
// extract().rotate(90).resize() in unexpected order. Materialize buffer
// to break fusion.
const rotated = await sharp(sourcePath)
  .resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })
  .rotate(90)               // ← VERIFIED EMPIRICALLY at scripts/probe-sharp-rotate.mjs
  .png()
  .toBuffer();
// then feed `rotated` as the composite layer input
```

**Sharp-emits-truth readback** (RESEARCH §"Reading back sharp-emitted truth"):
```typescript
const buf = await sharp(/*...*/).png().toBuffer();
const meta = await sharp(buf).metadata();
const packW = meta.width!;   // ← MUST pass these to packer, not buildExportPlan's outW/outH
const packH = meta.height!;
```

---

### `tests/core/repack.spec.ts` (test, unit, request-response)

**Analog:** [`tests/core/atlas-preview.spec.ts`](tests/core/atlas-preview.spec.ts)

**Imports + fixture loader helper** (atlas-preview.spec.ts:29-77):
```typescript
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze, analyzeRegions } from '../../src/core/analyzer.js';
import { buildAtlasPreview } from '../../src/core/atlas-preview.js';
import { buildExportPlan } from '../../src/core/export.js';
import type { SkeletonSummary, RegionRow, DisplayRow } from '../../src/shared/types.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');

function loadSummary(jsonPath: string): SkeletonSummary {
  const load = loadSkeleton(jsonPath);
  const sampled = sampleSkeleton(load);
  const peaks = analyze(sampled.globalPeaks);
  // ... (full helper at atlas-preview.spec.ts:56-77)
}
```

**Hygiene grep block** (REPACK-02 acceptance — `core/` purity guard). Pattern from `tests/arch.spec.ts:148-169` is the canonical one; *also* extend the inline file-level hygiene assertion seen at atlas-preview.spec.ts (search `ATLAS_PREVIEW_SRC` usage) for `core/repack.ts`.

**Test cases (REPACK-02 acceptance)**:
- determinism — `computeRepack(inputs, opts)` twice → identical result
- preserves count — `result.regions.length === inputs.length` (modulo `result.oversize`)
- within bounds — every region's `x+w ≤ page.width && y+h ≤ page.height`
- oversize pre-flight — region with `packW > maxPageSize` populates `result.oversize` with that regionName

---

### `tests/main/atlas-writer.spec.ts` (test, unit)

**Analog (round-trip pattern):** [`tests/core/loader.spec.ts`](tests/core/loader.spec.ts) (search for `TextureAtlas` imports from `@esotericsoftware/spine-core`). RESEARCH cites this at L104 as a verified precedent. Pattern (RESEARCH §Validation):
```typescript
import { TextureAtlas } from '@esotericsoftware/spine-core';
// ...
const text = buildAtlasText({ projectName: 'SIMPLE_TEST', pages, regions });
const parsed = new TextureAtlas(text);
expect(parsed.regions.length).toBe(regions.length);
// Spot-check region names + dims (NOT format/repeat — TextureAtlas.js:42-44
// silently discards format; RESEARCH §Landmines #6)
```

**Test cases (REPACK-04 + REPACK-06 + REPACK-09)**:
- `round-trip` — built text parses cleanly via `new TextureAtlas(text)` with all region names + dims preserved
- `field parity` — region count matches; `bounds:` values match input
- `no rotate when off` — with `allowRotation=false`, no entry has `rotate:true`
- `rotated round-trip` — with `allowRotation=true`, rotated entries swap W/H per RESEARCH §"Rotation dim convention"
- `buffer dim scaling` — varying `safetyBufferPercent` changes `bounds:` dims as expected

---

### `tests/main/repack-worker.spec.ts` (test, integration, batch)

**Analog:** [`tests/main/image-worker.integration.spec.ts`](tests/main/image-worker.integration.spec.ts) — RESEARCH cites L25 as the sharp-in-vitest precedent.

**Imports + tmp-dir lifecycle** (image-worker.integration.spec.ts:21-35):
```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-int-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```
*Phase 40 prefix*: rename `'stm-export-int-'` → `'stm-repack-int-'`.

**Plan-driven invocation idiom** (image-worker.integration.spec.ts:42-59):
```typescript
const plan: ExportPlan = {
  rows: [{
    sourcePath,
    outPath: 'images/CIRCLE.png',
    sourceW: 699, sourceH: 699,
    outW: 350, outH: 350,
    effectiveScale: 0.5,
    attachmentNames: ['CIRCLE'],
  }],
  excludedUnused: [],
  passthroughCopies: [],
  totals: { count: 1 },
};

const events: ExportProgressEvent[] = [];
const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
```

**Output validation with sharp.metadata()** (image-worker.integration.spec.ts:78-80):
```typescript
const meta = await sharp(outPath).metadata();
expect(meta.format).toBe('png');
expect(meta.width).toBe(350);
```

**Test cases (REPACK-01 atlas/both modes, REPACK-03, REPACK-05, REPACK-10)**:
- `atlas mode` writes ≥1 `.atlas` + ≥1 page PNG
- `both mode` writes loose + `.atlas` + page PNGs
- `emits truth` — packer receives `meta.width/height`, not `buildExportPlan` `outW/outH`
- `pixel preserved` — composite pixel at `(x,y)` matches loose-mode source pixel
- `page count` / `page bounds` — `pages.length === expected`; each page ≤ `atlasMaxPageSize`
- `oversize abort` — locked error string; NO files on disk after throw
- `atomic rollback` — simulated sharp throw on page 2 of 3; NO `.atlas` or page PNG on disk

---

### `tests/main/repack.loose-parity.spec.ts` (test, integration, SHA256 baseline)

**Analog (SHA hashing precedent):** [`tests/integration/emit-latest-yml.spec.ts:32+58`](tests/integration/emit-latest-yml.spec.ts) — closest in-repo `node:crypto` precedent (uses SHA512; Phase 40 swaps to SHA256 per D-06):
```typescript
import { randomBytes, createHash } from 'node:crypto';
// ...
fixtureInstallerSha512 = createHash('sha512').update(fixtureBuf).digest('base64');
```
*Phase 40 variant*: `createHash('sha256').update(buf).digest('hex')` per RESEARCH §"Supporting libraries" line 110.

**Baseline-or-fail pattern (REPACK-01 strictest gate, RESEARCH §Landmines #10)**:
- Load `tests/fixtures/repack-baselines.json`
- Run `runExport` (loose mode) on SIMPLE_TEST.json into tmp dir
- For each output PNG: `createHash('sha256').update(readFileSync(path)).digest('hex')` → compare against baseline
- On mismatch: fail loud with a clear "rerun `npm run repack:refresh-baselines`" hint (D-07 — CI stays loud)

**Refresh-by-env gate** (D-07):
```typescript
const SHOULD_UPDATE = process.env.UPDATE_FIXTURES === '1';
if (SHOULD_UPDATE) {
  // write computed hash into baseline file; do NOT assert
} else {
  expect(computedSha).toBe(expectedSha);
}
```

---

### `tests/main/repack.parity.spec.ts` (test, integration, cross-loaderMode SHA256)

**Analog (cross-loaderMode loading):** [`tests/core/loader-atlas-less.spec.ts`](tests/core/loader-atlas-less.spec.ts) — atlas-less load pattern. The parity test loads the same `SIMPLE_TEST.json` twice (once `loaderMode='auto'`, once `loaderMode='atlas-less'`), runs atlas-mode export under each, and asserts:
```typescript
const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

// run 1: auto-mode
const auto = await runRepackForFixture('auto');
// run 2: atlas-less mode (identical override set)
const atlasLess = await runRepackForFixture('atlas-less');

expect(sha(readFileSync(auto.atlasPath))).toBe(sha(readFileSync(atlasLess.atlasPath)));
expect(sha(readFileSync(auto.pagePaths[0]))).toBe(sha(readFileSync(atlasLess.pagePaths[0])));
```

**Sharpen-invariant case (REPACK-09)**: toggle `sharpenOnExport` between two runs; assert `SHA256(.atlas)` is invariant (pack layout unchanged) while page PNG SHAs may differ (pixel content changes).

---

### `tests/fixtures/repack-baselines.json` (fixture, JSON sidecar)

**No close analog** — pattern is greenfield. Shape per D-06:
```json
{
  "SIMPLE_TEST": {
    "loose": {
      "images/CIRCLE.png": "sha256-hex...",
      "images/SQUARE.png": "sha256-hex...",
      "images/TRIANGLE.png": "sha256-hex..."
    },
    "atlas": {
      "SIMPLE_TEST.atlas": "sha256-hex...",
      "SIMPLE_TEST.png": "sha256-hex..."
    }
  }
}
```

---

### `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` (fixture, committed expected text)

**Analog:** [`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`](fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas) — the input fixture is the format reference. The expected file will differ because pack layout is different (post-quality-knob dims), but the syntax/whitespace style must match exactly (no-space-after-colon, LF, no trailing newline).

---

### `scripts/repack-refresh-baselines.mjs` (script, manual refresh)

**Analog 1 (npm-script idiom):** [`scripts/fixture-atlas-source-drift.mjs`](scripts/fixture-atlas-source-drift.mjs) — npm-script entry point pattern (line 5: "Usage: `npm run fixture:atlas-source-drift`"):
```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
```

**Analog 2 (sharp-in-script + hashing):** [`scripts/pma-probe.mjs`](scripts/pma-probe.mjs) — sharp-from-mjs precedent (line 14: `import sharp from 'sharp';`) and [`scripts/emit-latest-yml.mjs:57`](scripts/emit-latest-yml.mjs) — `createHash` import in script.

**Phase 40 algorithm**: run repack on each committed fixture → compute SHA256 of each output → write to `tests/fixtures/repack-baselines.json` + write `.atlas` text to `tests/fixtures/repack-expected/{name}.atlas`. Document `UPDATE_FIXTURES=1` env flag in the script header for the in-test refresh path.

**package.json scripts entry** (sibling to `fixture:atlas-source-drift` at line 15):
```json
"repack:refresh-baselines": "node scripts/repack-refresh-baselines.mjs"
```

---

## Pattern Assignments — MODIFIED files (splice sites)

### `src/renderer/src/modals/OptimizeDialog.tsx`

**Splice site 1: Output card insertion (D-01)** — insert immediately BEFORE the Quality card at L437.

Pattern to mirror (L437-490) — the **bordered card** structure that the new Output card copies:
```tsx
{/* Phase 30 BUFFER-01 — Quality group containing safety buffer input
    and the (relocated) sharpen toggle. UI-SPEC locks DOM structure;
    Tailwind v4 literal-class discipline (Pitfall 8) — every className
    is a single string literal. */}
<div className="border border-border rounded-md bg-surface p-3 mb-4">
  <span className="text-xs text-fg-muted mb-2 block">Quality</span>
  {/* ... safety buffer + sharpen children ... */}
</div>
```
*Phase 40 Output card outer*: same `className="border border-border rounded-md bg-surface p-3 mb-4"` and label-span class `"text-xs text-fg-muted mb-2 block"` with text `"Output"`.

**Splice site 2: textbox+suffix pattern (D-01e for `atlasPadding`)** — copy L439-469 verbatim with rename:
```tsx
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
      const clamped = Math.max(0, Math.min(25, parsed));
      props.onSafetyBufferChange(clamped);
    }}
    disabled={state === 'in-progress'}
    title="Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate."
    className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
  />
  <span className="text-fg-muted">%</span>
</label>
```
*Phase 40 atlasPadding variant*: label="Padding:", `min={0} max={16} step={1}`, default 2, suffix `"px"`, `title="Inter-region gap on the packed atlas page."` (or similar).

**Splice site 3: checkbox+label pattern (D-01d for `atlasAllowRotation`)** — copy L476-489 verbatim with rename:
```tsx
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
```
*Phase 40 atlasAllowRotation variant*: id=`atlas-allow-rotation-toggle`, label text=`Allow rotation`, `title="Packer may rotate regions 90° for tighter packing."` (RESEARCH §Landmines #11 — `title=` is the in-repo tooltip primitive; matches the safety-buffer pattern at L465).

**Splice site 4: conditional render mechanism (D-01b)** — plain conditional render (RESEARCH §Landmines #12: no animation library in repo). Existing precedent at L492-511:
```tsx
{state === 'pre-flight' && <PreFlightBody plan={props.plan} />}
{state !== 'pre-flight' && (
  <InProgressBody /* ... */ />
)}
```
*Phase 40 variant*: `{outputMode !== 'loose' && <AtlasKnobs ... />}` inside the Output card.

**Splice site 5: `onStart` → IPC threading (D-04)** at L274-279:
```tsx
const response: ExportResponse = await window.api.startExport(
  props.plan,
  resolvedOutDir,
  overwrite,
  props.sharpenOnExport, // Phase 28 SHARP-02 — 4th arg per Q1 inline recommendation
);
```
*Phase 40 extension*: add positional args `props.outputMode` (5th) and `props.atlasOpts` (6th):
```tsx
await window.api.startExport(
  props.plan, resolvedOutDir, overwrite,
  props.sharpenOnExport,
  props.outputMode,           // ← Phase 40 D-04
  props.atlasOpts,            // ← Phase 40 D-04
);
```

**Splice site 6: progress event consumer (D-05)** at L159-190:
```tsx
const unsubscribe = window.api.onExportProgress((event: ExportProgressEvent) => {
  setRowStatuses((prev) => { /* ... */ });
  setProgress({ current: event.index + 1, lastPath: event.path });
  // ...
});
```
*Phase 40 extension*: branch on `event.phase` (additive — RESEARCH open Q6). Two phases share one combined counter that prefixes the row label, OR two separate counters. Planner picks.

---

### `src/main/image-worker.ts`

**Splice site 1: extract `applyResizeAndSharpen` (D-03a)** at L89-110 — see full block in the repack-worker analog section above.

Two paths per RESEARCH §"Per-region resize":
- **Path A**: export the helper from `image-worker.ts`; new module imports it.
- **Path B (RESEARCH-recommended)**: new `src/main/sharp-resize.ts` with two functions (`resizeToFile`, `resizeToBuffer`). Path B keeps loose-mode bytes provably unchanged.

**Splice site 2: atomic-write idiom** at L295/353 — already shown above. *No modification needed*; the repack-worker REUSES this idiom independently.

**Splice site 3: cancellation pattern** at L178/380 — already shown above. *No modification needed*; repack-worker mirrors it.

**Splice site 4: signature widening for shared rollback list (RESEARCH §"Open Question 3")** at L112-128:
```typescript
export async function runExport(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  allowOverwrite: boolean = false,
  sharpenEnabled: boolean = false,
  // Phase 40 D-04a: optional shared rollback accumulator (default new Set())
  writtenPaths: Set<string> = new Set(),
): Promise<ExportSummary>
```

---

### `src/main/ipc.ts`

**Splice site 1: trust-boundary validator** at L286-310:
```typescript
function validateExportPlan(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  const p = plan as { rows?: unknown; /* ... */ };
  if (!Array.isArray(p.rows)) return 'plan.rows is not an array';
  // ... (full validator at L286-310)
  return null;
}
```
*Phase 40 addition*: write a sibling `validateExportOpts(outputMode, atlasOpts)` that validates the 2 new positional args against the literal-union types and integer ranges. Same shape: `string | null`, called next to `validateExportPlan` in `handleStartExport`.

**Splice site 2: `runExport` invocation** at L661-673:
```typescript
const summary = await runExport(
  validPlan,
  outDir,
  (e) => {
    try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ }
  },
  () => exportCancelFlag,
  overwrite,
  sharpenEnabled, // Phase 28 SHARP-02
);
return { ok: true, summary };
```
*Phase 40 dispatch (D-04a)*: wrap in `try/finally` with `written: Set<string>` accumulator; dispatch on `outputMode`:
```typescript
const written = new Set<string>();
try {
  if (outputMode === 'loose' || outputMode === 'both') {
    await runExport(validPlan, outDir, /*...*/, sharpenEnabled, written);
  }
  if (outputMode === 'atlas' || outputMode === 'both') {
    await runRepack(validPlan, outDir, /*...*/, sharpenEnabled, atlasOpts, written);
  }
  return { ok: true, summary };
} catch (err) {
  // Rollback every written path (RESEARCH §Landmines #7+#8)
  for (const p of written) {
    await fs.rm(p, { force: true }).catch(() => {});
  }
  throw err;
}
```

**Splice site 3: channel registration** at L703-711:
```typescript
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite, sharpenEnabled) =>
  handleStartExport(
    evt,
    plan,
    outDir,
    overwrite === true,
    sharpenEnabled === true,
  ),
);
```
*Phase 40 extension*: 2 new positional args (`outputMode`, `atlasOpts`) with safe defaults `'loose'` and `{maxPageSize:4096, allowRotation:false, padding:2}`.

---

### `src/shared/types.ts`

**Splice site 1: `ProjectFileV1` additive fields** at L1042-1060 (3-precedent template):
```typescript
loaderMode: 'auto' | 'atlas-less';
/**
 * Phase 28 SHARP-01 — opt-in unsharp-mask post-resize on downscale.
 * v1.2-era .stmproj files have no `sharpenOnExport` field; the validator
 * pre-massages missing → false (mirrors loaderMode pre-massage in
 * src/core/project-file.ts:174-186). D-04 default-OFF, D-06 persists per project.
 */
sharpenOnExport: boolean;
/**
 * Phase 30 BUFFER-03 — multiplicative safety buffer (integer percent,
 * range [0, 25]). v1.2/v1.3-era .stmproj files have no `safetyBufferPercent`
 * field; the validator pre-massages missing → 0 (mirrors sharpenOnExport
 * pre-massage in src/core/project-file.ts:189-199). D-03 default 0%,
 * D-04 strictly integer, D-14 same name across all surfaces.
 */
safetyBufferPercent: number;
```
*Phase 40 addition*: 4 fields per RESEARCH §"File-by-File: src/shared/types.ts" — `atlasOutputMode`, `atlasMaxPageSize`, `atlasAllowRotation`, `atlasPadding`. Mirror exact comment style (phase-tag + memory cross-reference + default note).

**Splice site 2: `AppSessionState` mirror** at L1071-1089:
```typescript
export interface AppSessionState {
  skeletonPath: string;
  // ...
  loaderMode: 'auto' | 'atlas-less';
  /** Phase 28 SHARP-01 — round-trips through .stmproj per D-06. */
  sharpenOnExport: boolean;
  /** Phase 30 BUFFER-03 — round-trips through .stmproj per D-14. Integer 0-25. */
  safetyBufferPercent: number;
}
```
*Phase 40 addition*: mirror the 4 new `ProjectFileV1` fields here too.

**Splice site 3: `ExportProgressEvent` additive `phase` field (D-05)** at L531-538:
```typescript
export interface ExportProgressEvent {
  index: number;
  total: number;
  path: string;
  outPath: string;
  status: 'success' | 'error';
  error?: ExportError;
}
```
*Phase 40 addition (optional field, additive, existing consumers ignore)*:
```typescript
/** Phase 40 D-05 — 'resize' fires per-region; 'composite' fires per-page.
 *  Existing single-stream consumers can ignore. */
phase?: 'resize' | 'composite';
```

---

### `src/core/project-file.ts`

**Splice site: pre-massage block for each additive field** at L176-224. Pattern for ONE field (loaderMode at L176-188):
```typescript
// Phase 21 D-08 forward-compat — Phase 8/20-era .stmproj files have no
// `loaderMode` field; default to 'auto' so legacy projects load through
// the canonical (atlas-by-default) path unchanged. Mirrors the Phase 20
// documentation pre-massage immediately above (RESEARCH.md §Pitfall 6).
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

Pattern for an INTEGER-range field (safetyBufferPercent at L204-224):
```typescript
if (obj.safetyBufferPercent === undefined) {
  obj.safetyBufferPercent = 0;
}
if (
  typeof obj.safetyBufferPercent !== 'number'
  || !Number.isInteger(obj.safetyBufferPercent)
  || obj.safetyBufferPercent < 0
  || obj.safetyBufferPercent > 25
) {
  return {
    ok: false,
    error: {
      kind: 'invalid-shape',
      message: 'safetyBufferPercent is not an integer in [0, 25]',
    },
  };
}
```

*Phase 40 application*:
- `atlasOutputMode` — literal-union pattern (mirror loaderMode at L180-188); accept `'loose' | 'atlas' | 'both'`; default `'loose'`.
- `atlasMaxPageSize` — literal-int-union; accept `1024 | 2048 | 4096 | 8192`; default `4096`.
- `atlasAllowRotation` — boolean pattern (mirror sharpenOnExport at L190-202); default `false`.
- `atlasPadding` — integer-range pattern (mirror safetyBufferPercent at L204-224); range `0..16`; default `2`.

Also add same defaults in `serializeProjectFile` and `materializeProjectFile` (defense-in-depth `?? defaultValue`) — RESEARCH §"File-by-File: src/core/project-file.ts" calls this out explicitly.

---

### `tests/arch.spec.ts`

**Splice site: core-purity grep block** at L148-169:
```typescript
describe('Architecture boundary: src/core must not import sharp / node:fs / node:fs/promises (CLAUDE.md Fact #5 + Phase 6 Layer 3 lock)', () => {
  it('no core file imports sharp or node:fs (sync or promises) — loader.ts + png-header.ts + synthetic-atlas.ts exempt as load-time carve-outs', () => {
    const files = globSync('src/core/**/*.ts');
    const FS_LOAD_TIME_CARVE_OUTS = new Set<string>([
      'src/core/loader.ts',
      'src/core/png-header.ts',
      'src/core/synthetic-atlas.ts',
    ]);
    const offenders: string[] = [];
    for (const file of files) {
      // ...
    }
  });
});
```
*Phase 40 action*: NO modification needed if `src/core/repack.ts` is clean (per RESEARCH §"Layer 3 hygiene" — the file MUST be clean of `sharp`, `node:fs`, `electron`). The grep already auto-scans `src/core/**/*.ts` — `repack.ts` will be covered automatically. The carve-out list does NOT need to include `repack.ts`. Verify by running the test post-implementation; if it fails, the new file accidentally imported a forbidden module.

---

### `tests/core/project-file.spec.ts`

**Splice site**: extend after the existing `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` round-trip tests. Pattern from L52-80 (`accepts minimal v1 file`):
```typescript
it('validator accepts minimal v1 file', () => {
  const r = validateProjectFile({
    version: 1,
    skeletonPath: './SIMPLE.json',
    atlasPath: null,
    imagesDir: null,
    overrides: {},
    samplingHz: null,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: {},
  });
  expect(r.ok).toBe(true);
});
```
*Phase 40 cases (REPACK-07 acceptance)*:
- `atlas defaults` — minimal v1 file (no atlas fields) → validator returns ok=true with all 4 fields pre-massaged
- `atlas round-trip` — full v1.5-era file with all 4 fields → losslessly round-trips through `serialize → validate → materialize`
- `version unchanged` — `project_format_version` is the same value before and after Phase 40 in saved fixtures

---

## Shared Patterns

### Atomic-write (tmp + rename)
**Source:** [`src/main/image-worker.ts`](src/main/image-worker.ts) L295-353
**Apply to:** `src/main/repack-worker.ts` for every `.atlas` write AND every page PNG write
**Critical complement (RESEARCH §Landmines #7):** Register BOTH `tmpPath` AND final `finalPath` in `writtenPaths: Set<string>` BEFORE the `toFile` call. The finally-block sweep deletes both regardless of which one exists; `fs.rm` with `{ force: true }` swallows ENOENT.

### Cancellation cooperation
**Source:** [`src/main/image-worker.ts`](src/main/image-worker.ts) L178-181 + L380-383
**Apply to:** `src/main/repack-worker.ts` — check `isCancelled()` between resize iterations AND between page composites
**Constraint:** Mid-libvips operations cannot be aborted (CLAUDE.md Fact #4 + Phase 6 D-115)

### `core/` purity (Layer 3 hygiene)
**Source:** [`tests/arch.spec.ts`](tests/arch.spec.ts) L148-169 (auto-scan) + inline file-level grep in `tests/core/atlas-preview.spec.ts`
**Apply to:** `src/core/repack.ts` — MUST NOT import `sharp`, `node:fs`, `node:fs/promises`, `electron`, DOM types
**Allowed:** type-only imports from `../shared/types.js`; runtime import of `maxrects-packer` (browser-safe per atlas-preview.ts:36); `node:path` (project-file.ts precedent — load-time only, no I/O)

### Additive `.stmproj` field pre-massage (no schema bump)
**Source:** [`src/core/project-file.ts`](src/core/project-file.ts) L176-224 (3-precedent block)
**Apply to:** 4 new atlas fields in `validateProjectFile`, `serializeProjectFile`, `materializeProjectFile`
**Constraint:** `project_format_version` MUST remain unchanged (REPACK-07 acceptance)

### Bordered card UI pattern
**Source:** [`src/renderer/src/modals/OptimizeDialog.tsx`](src/renderer/src/modals/OptimizeDialog.tsx) L437-490 (Quality card)
**Apply to:** new Output card (D-01) — `className="border border-border rounded-md bg-surface p-3 mb-4"` with label-span `"text-xs text-fg-muted mb-2 block"`

### Sharp-emits-truth invariant
**Source:** RESEARCH §"Reading back sharp-emitted truth" (no in-repo precedent — Phase 40 introduces)
**Apply to:** `src/main/repack-worker.ts` — read `sharp(buf).metadata().width/height` BEFORE calling `computeRepack`; pass actual dims, never `buildExportPlan`'s targets

### Materialize-then-reload for fused libvips pipelines
**Source:** [`src/main/image-worker.ts`](src/main/image-worker.ts) L583-606 (Phase 33 SW + rotation reference)
**Apply to:** `src/main/repack-worker.ts` per-region pipeline whenever rotation is on (RESEARCH §"Pipeline fusion landmine"). Pattern: `.resize().png().toBuffer()` then re-open `sharp(buf).rotate(90).png().toBuffer()`.

### SHA256 baseline + UPDATE_FIXTURES env flag (D-06 / D-07)
**Source (hashing precedent):** [`tests/integration/emit-latest-yml.spec.ts`](tests/integration/emit-latest-yml.spec.ts) L32+58 — uses SHA512; Phase 40 swaps to SHA256
**Apply to:** `tests/main/repack.loose-parity.spec.ts`, `tests/main/repack.parity.spec.ts`, `scripts/repack-refresh-baselines.mjs`
**CI invariant:** Neither `npm run repack:refresh-baselines` nor `UPDATE_FIXTURES=1` runs in CI; CI stays loud on mismatch.

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `tests/fixtures/repack-baselines.json` | JSON sidecar | No equivalent SHA-baseline sidecar exists in repo today; pattern is greenfield. Shape is planner-defined. |

The `.atlas` text writer (`src/main/atlas-writer.ts`) has **no exact analog** in the sense of "another `.atlas` text writer in main/" — it is the first. The closest structural precedent is [`src/core/synthetic-atlas.ts:188-208`](src/core/synthetic-atlas.ts) (in-repo libgdx-format emitter for in-memory synthesis, cited by RESEARCH §Landmines #4 as "the in-repo reference"). Format reference comes from the input fixture [`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`](fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas) + the spine-core 4.2 TextureAtlas.js parser source (RESEARCH §libgdx .atlas Format Reference exhaustively documents the grammar).

---

## Metadata

**Analog search scope:** `src/core/`, `src/main/`, `src/renderer/src/modals/`, `src/shared/`, `tests/core/`, `tests/main/`, `tests/integration/`, `scripts/`, `fixtures/SIMPLE_PROJECT/`
**Files read (one Read each, non-overlapping ranges):**
- `40-CONTEXT.md` (full), `40-SPEC.md` (full), `40-RESEARCH.md` (lines 1-400, 400-800)
- `src/core/atlas-preview.ts` (full, 260 lines)
- `src/main/image-worker.ts` (L1-130, L160-230, L510-680)
- `src/renderer/src/modals/OptimizeDialog.tsx` (L155-285, L425-535)
- `src/main/ipc.ts` (L280-330, L550-600, L595-660, L655-745)
- `src/shared/types.ts` (L525-560, L1035-1135)
- `src/core/project-file.ts` (L170-270)
- `tests/arch.spec.ts` (L140-170)
- `tests/main/image-worker.integration.spec.ts` (L1-80)
- `tests/core/atlas-preview.spec.ts` (L1-80)
- `tests/core/project-file.spec.ts` (L1-80)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (full, 10 lines)
- `scripts/pma-probe.mjs` (L1-80), `scripts/fixture-atlas-source-drift.mjs` (L1-40), `scripts/probe-sharp-rotate.mjs` (L1-50)

**Pattern extraction date:** 2026-05-14
