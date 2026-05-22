# Phase 49: Single-Scale Variant Export - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 13 (5 new src + 3 modified src + 5 new test)
**Analogs found:** 13 / 13 (every file has a concrete in-repo analog)

This phase is **pure wiring on proven infrastructure**. There is no new algorithm — every new file copies a shape that already ships and is hardened by prior UAT. The excerpts below show the planner the EXACT function/structure each new file must model, with file:line.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/variant-export.ts` (NEW) | service / orchestrator | request-response + file-I/O | `handleStartExport` `src/main/ipc.ts:736-995` | exact (dispatch matrix + shared `written` Set + source-collision guard) |
| `src/main/skeleton-json-writer.ts` (NEW) | utility | file-I/O (atomic write) | `writeProjectFileAtomic` `src/main/project-io.ts:233-281` + written-set variant `src/main/image-worker.ts:285-360` | exact |
| `src/core/scaleSummaryPeaks` helper (NEW, likely `src/core/`) | utility (pure transform) | transform | clone-first discipline `src/core/scale-bake.ts:44,88-91` + `SkeletonSummary` shape `src/shared/types.ts:756-878` | role-match (pure clone-and-scale) |
| `VariantScaleError` (NEW, `src/core/errors.ts` OR `src/main/`) | model (typed error) | — | `ScaleBakeError` `src/core/scale-bake.ts:36-41` + `SpineLoaderError` family `src/core/errors.ts:13-18` | exact |
| `src/renderer/src/modals/VariantDialog.tsx` (NEW) | component (modal) | request-response (IPC invoke) | `OptimizeDialog.tsx` props `:55-141`, `onStart` invoke `:258-359` | exact (single-pane reuse) |
| `src/main/ipc.ts` (MOD) | route (IPC channel) | request-response | `export:start` registration `src/main/ipc.ts:1030-1047` | exact |
| `src/preload/index.ts` (MOD) | route (preload bridge) | request-response | `startExport` binding `src/preload/index.ts:108-117` | exact |
| `src/renderer/src/components/AppShell.tsx` (MOD) | component (toolbar + handler) | request-response | "Optimize Assets" button `:2174-2181`, `onClickOptimize` `:783-792`, `activeOverrides` `:409-412`, `pickOutputDir` `:774-779` | exact |
| `tests/core/variant-sizing.spec.ts` (NEW) | test (unit, core) | transform | `tests/core/export.spec.ts` + sizing math `src/core/export.ts:254-304` | role-match |
| `tests/main/variant-source-immutable.spec.ts` (NEW) | test (integration, main) | file-I/O | `tests/main/image-worker.integration.spec.ts:21-67` (sha256 idiom `createHash` `:25`) | exact (tmpdir + byte-hash) |
| `tests/main/variant-package-layout.spec.ts` (NEW) | test (integration, main) | file-I/O | `tests/main/image-worker.integration.spec.ts` + `tests/main/repack-worker.spec.ts` | exact |
| `tests/main/variant-dropin-faithful.spec.ts` (NEW) | test (oracle, dual-runtime) | transform + parse | `tests/scale-bake.spec.ts:1-75` (dual-runtime `parseAt` harness) | exact (reuse the harness) |
| `tests/main/variant-scale-guard.spec.ts` (NEW) | test (unit, main) | request-response | `tests/main/ipc-export.spec.ts` (envelope assertions) | role-match |

---

## Pattern Assignments

### `src/main/variant-export.ts` (service/orchestrator, request-response + file-I/O)

**Analog:** `handleStartExport` (`src/main/ipc.ts:736-995`) — copy the shared `written` Set, the output-mode dispatch matrix, and the rollback `catch` sweep.

**The shared `written` rollback Set + dispatch matrix** (`src/main/ipc.ts:900-933`):
```typescript
const written = new Set<string>();
const sendProgress = (e: Parameters<typeof evt.sender.send>[1]) => {
  try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ }
};
try {
  let looseSummary: ExportSummary | undefined;
  let repackSummary: ExportSummary | undefined;
  if (outputMode === 'loose' || outputMode === 'both') {
    looseSummary = await runExport(
      validPlan, outDir, sendProgress, () => exportCancelFlag,
      overwrite, sharpenEnabled, written,    // 7-arg: written is the shared rollback accumulator
    );
  }
  if (outputMode === 'atlas' || outputMode === 'both') {
    const repackResult = await runRepack(
      validPlan as ExportPlan, outDir, sendProgress, () => exportCancelFlag,
      overwrite, sharpenEnabled, atlasOpts, written,   // 8-arg
    );
    repackSummary = repackResult.summary;
  }
  // ... merge summaries (ipc.ts:948-972 'both'-mode merge contract)
```

**The rollback `catch` sweep — JSON joins the SAME set** (`src/main/ipc.ts:974-984`):
```typescript
} catch (innerErr) {
  // fs.rm with { force: true } swallows ENOENT — safe even if some paths never landed.
  for (const p of written) {
    await fsRm(p, { force: true }).catch(() => { /* defense-in-depth */ });
  }
  throw innerErr;
}
```

**The source-collision guard** (reuse verbatim — `src/main/ipc.ts:809-827`): rejects when `path.resolve(outDir) === path.resolve(sourceImagesDir)` (the last `/images/` segment of `rows[0].sourcePath`). The variant `outDir` is a NEW `{NAME}@{s}x/` subfolder, so this fires only on a pathological parent pick — but inheriting it is free defense.

**`runExport` signature** (`src/main/image-worker.ts:89`) and **`runRepack` signature** (`src/main/repack-worker.ts:257-266`):
```typescript
export async function runRepack(
  plan: ExportPlan, outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  allowOverwrite: boolean, sharpenEnabled: boolean,
  atlasOpts: AtlasOpts, writtenPaths: Set<string>,
): Promise<RepackResultPaths>
```
Both are exported and take the `written` set as their last arg — **call them UNCHANGED** (Don't Hand-Roll the dispatch).

**The `s`-scaled plan build** (the only NEW pre-step before the matrix) — `buildExportPlan` called UNCHANGED on an `s`-scaled summary clone:
```typescript
// model: src/renderer/src/components/AppShell.tsx:787-790 (onClickOptimize plan-build)
const plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {
  skeletonPath: summary.skeletonPath,   // basename = {NAME}; drives deriveProjectName (Pattern 3)
  safetyBufferPercent,
});
```

**`{NAME}`-keyed basename derivation** (`src/main/atlas-paths.ts:69-90`) — already keys page/atlas off `plan.skeletonPath` basename, so passing `summary.skeletonPath` yields clean `{NAME}.png` / `{NAME}.atlas` with ZERO atlas-writer changes:
```typescript
const fromSkeleton = plan.skeletonPath;
if (fromSkeleton) {
  const name = basename(fromSkeleton).replace(/\.json$/i, '');  // 'DEMON' for DEMON.json
  if (name && !name.includes(':')) return name;
}
```

---

### `src/main/skeleton-json-writer.ts` (utility, file-I/O atomic write)

**Analog:** `writeProjectFileAtomic` (`src/main/project-io.ts:233-281`) for the `.tmp`+`rename` idiom; `src/main/image-worker.ts:285-360` for the `written`-set registration variant (register tmp + final BEFORE the write).

**The atomic `.tmp`+`rename` idiom** (`src/main/project-io.ts:253-280`):
```typescript
const tmpPath = finalPath + '.tmp';
await writeFile(tmpPath, json, 'utf8');
await rename(tmpPath, finalPath);   // atomic on POSIX; best-effort on Windows (acceptable)
```

**The `written`-set registration discipline** (`src/main/image-worker.ts:285-292`) — register BOTH paths BEFORE the write so the rollback sweep is complete even if the write half-lands:
```typescript
const tmpPath = resolvedOut + '.tmp';
// register both paths for atomic rollback (tmp may orphan if rename throws;
// final may exist if write succeeded; sweeping both with { force: true } is safe).
writtenPaths.add(tmpPath);
writtenPaths.add(resolvedOut);
```

**Composed shape for the new writer** (combine the two above — the recommended signature, RESEARCH §Flag 4):
```typescript
export async function writeSkeletonJsonAtomic(
  finalPath: string, baked: Record<string, unknown>, written: Set<string>,
): Promise<void> {
  const tmpPath = finalPath + '.tmp';
  written.add(tmpPath); written.add(finalPath);          // rollback completeness FIRST
  await mkdir(dirname(finalPath), { recursive: true });  // create {NAME}@{s}x/
  await writeFile(tmpPath, JSON.stringify(baked), 'utf8');
  await rename(tmpPath, finalPath);
}
```
**Call it FIRST inside the same `try`** that wraps `runExport`/`runRepack` (so a later texture throw rolls the JSON back via the shared sweep). `JSON.stringify(baked)` (no indent) is the safe drop-in — the spine parser is whitespace-insensitive (RESEARCH A3).

> **DIVERGENCE FLAG (minor):** `writeProjectFileAtomic` returns a `{ ok, error }` / `{ ok, path }` envelope and uses `JSON.stringify(file, null, 2)` (indent-2) because `.stmproj` is human-inspectable. The skeleton writer should instead **throw** (so the shared `catch` sweep covers it) and use **no indent** (drop-in faithfulness, not human inspection). Copy the `.tmp`+rename mechanics, NOT the envelope-return or the indentation.

---

### `src/core/` `scaleSummaryPeaks(summary, s)` helper (utility, pure transform)

**Analog:** clone-first discipline in `src/core/scale-bake.ts:44,88-91`; the `SkeletonSummary` shape in `src/shared/types.ts:756-878`.

**Clone-first discipline** (`src/core/scale-bake.ts:44,91`) — NEVER mutate the input; `structuredClone`/JSON-clone first (the live `summary` drives the panels + the master Optimize flow):
```typescript
const clone = (o: SkeletonJsonRaw): SkeletonJsonRaw => JSON.parse(JSON.stringify(o));
// ...
const j = clone(json); // L-05: clone FIRST; source never mutated
```

**The fields to scale** — `peakScale` lives on BOTH `summary.regions` (`RegionRow`, `src/shared/types.ts:227-229`) AND `summary.peaks` (`DisplayRow`, `src/shared/types.ts:62-64`):
```typescript
// RegionRow (types.ts:227-229) and DisplayRow (types.ts:62-64) both carry:
peakScale: number;  peakScaleX: number;  peakScaleY: number;
```
`buildExportPlan` iterates `summary.regions` (`src/core/export.ts:219`) and reads `region.peakScale` (`:256-257`), so scaling `regions[*].peakScale*` is what actually drives sizing. Scale `peaks[*]` too for display/parity consistency.

**Recommended shape** (RESEARCH Code Examples — the **peak-only interpretation A1**, leave `canonicalW/H`, `sourceW/H`, `actualSourceW/H` at master size):
```typescript
function scaleSummaryPeaks(summary: SkeletonSummary, s: number): SkeletonSummary {
  const c = structuredClone(summary);
  for (const r of c.regions) { r.peakScale *= s; r.peakScaleX *= s; r.peakScaleY *= s; }
  for (const p of c.peaks)   { p.peakScale *= s; p.peakScaleX *= s; p.peakScaleY *= s; }
  return c;
}
```

> **PLANNER LOCK REQUIRED (RESEARCH A1 / Open Question 1):** peak-only vs scale-everything diverge ONLY at the clamp/cap edges (which "for s<1 essentially never bind"). The planner MUST pick ONE interpretation, cite D-07 in `must_haves.truths`, and write the EXPORT-02 arithmetic assertion for it. Recommended: **peak-only** (literal reading of D-07 "variant row effectiveScale = s × master effectiveScale" + "the existing ≤1.0 clamp applies").
>
> **DIVERGENCE FLAG (layer placement):** RESEARCH says this helper "can live in core OR be done in main on the summary copy" (`src/core/scale-bake.ts` comment region + Flag 1). A pure `src/core/` helper is unit-testable and Layer-3-safe (no fs/sharp). If placed in `core/`, it is subject to the `tests/arch.spec.ts:148-177` purity scan (must import no `node:fs`/`sharp`) — trivially satisfied by a pure transform.

---

### `VariantScaleError` (model, typed error — D-08)

**Analog:** `ScaleBakeError` (`src/core/scale-bake.ts:36-41`) for the minimal shape; the `SpineLoaderError` family (`src/core/errors.ts:13-18`) for the typed-field + `.name`-routing culture.

**Minimal typed-error shape** (`src/core/scale-bake.ts:36-41`) — extend `Error`, set `.name`, message discriminates:
```typescript
export class ScaleBakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaleBakeError';
  }
}
```

**Typed-field + `.name`-routing culture** (`src/core/errors.ts:13-18` root; `:117-178` subclass with a readonly typed field):
```typescript
export class SpineLoaderError extends Error {
  constructor(message: string) { super(message); this.name = 'SpineLoaderError'; }
}
// subclasses carry a readonly typed field + a human message, and set .name so the
// IPC envelope can route by err.name against KNOWN_KINDS (errors.ts:106-108 note).
```

**Recommended shape** (RESEARCH Flag 6 — carries the offending `scale` as a typed field):
```typescript
export class VariantScaleError extends Error {
  constructor(public readonly scale: number) {
    super(`Variants are scaled-down only (0 < scale < 1). Got ${scale}. ` +
          `Use Optimize Assets to export at full size.`);
    this.name = 'VariantScaleError';
  }
}
// in the handler, FIRST (D-08 guard at the export EDGE, NOT in core bake):
if (!Number.isFinite(s) || s <= 0 || s >= 1) {
  return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };
}
```

> **DIVERGENCE FLAG (scope):** the file_scope and RESEARCH §Flag 6 both note `VariantScaleError` could live in `src/core/errors.ts` OR `src/main/`. The guard is an **export-edge** concern (D-08: core `bake()` stays direction-agnostic, Phase-48 D-09 preserved — `src/core/scale-bake.ts:90` keeps `s <= 0` only). So the *guard call* must be main-side; the *class* may live in either. If you want a distinct renderer-visible `kind`, add `'VariantScaleError'` to the IPC `KNOWN_KINDS` union; otherwise surface under `kind:'Unknown'` with the typed `.message` (the renderer displays `.message`). Either is acceptable — the message is the user-facing artifact.

---

### `src/renderer/src/modals/VariantDialog.tsx` (component/modal, request-response)

**Analog:** `OptimizeDialog.tsx` — the config prop surface (`:55-141`) and the `onStart` IPC-invoke (`:258-359`).

**Config prop surface to reuse** (`src/renderer/src/modals/OptimizeDialog.tsx:55-141`) — copy the controlled-prop pattern (parent owns state, dialog renders controls):
```typescript
export interface OptimizeDialogProps {
  open: boolean;
  plan: ExportPlan;
  outDir: string | null;
  onClose: () => void;
  onConfirmStart?: () => Promise<{ proceed: boolean; overwrite?: boolean; outDir?: string | null }>;
  sharpenOnExport: boolean;            onSharpenChange: (v: boolean) => void;
  safetyBufferPercent: number;         onSafetyBufferChange: (n: number) => void;
  outputMode: 'loose' | 'atlas' | 'both';
  onOutputModeChange: (mode: 'loose' | 'atlas' | 'both') => void;
  atlasOpts: { maxPageSize: 1024|2048|4096|8192; allowRotation: boolean; padding: number };
  onAtlasOptsChange: (opts: OptimizeDialogProps['atlasOpts']) => void;
}
```
The VariantDialog **adds ONE field**: a basic numeric `scale` (D-05) + `onScaleChange`. Reuse the output-mode radio + atlas knobs + sharpen + buffer controls (their render blocks live further down OptimizeDialog: output mode ~L512-552, atlas opts ~L554-638, buffer ~L652-677, sharpen ~L684-697).

**The probe-then-confirm `onStart` invoke** (`src/renderer/src/modals/OptimizeDialog.tsx:281-333`) — the model for VariantDialog's confirm/invoke (swap `startExport` → `exportVariant`):
```typescript
let overwrite = false;
let resolvedOutDir: string | null = props.outDir;
if (props.onConfirmStart) {
  const decision = await props.onConfirmStart();   // parent runs picker + probe + ConflictDialog
  if (!decision.proceed) return;                   // user cancelled → stay in pre-flight
  overwrite = decision.overwrite === true;
  if (decision.outDir !== undefined) resolvedOutDir = decision.outDir;
}
// ... null-guard resolvedOutDir (OptimizeDialog:303-320) ...
setState('in-progress');
const response: ExportResponse = await window.api.startExport(   // ← VariantDialog: window.api.exportVariant(...)
  props.plan, resolvedOutDir, overwrite,
  props.sharpenOnExport, props.outputMode, props.atlasOpts,
);
```
The 3-state machine (`'pre-flight' | 'in-progress' | 'complete'`, `:52`) and the `useFocusTrap` (`:50`) carry over verbatim.

> **DIVERGENCE FLAG (D-06 tabs — NOT this phase):** the file_scope/CONTEXT D-06 reference to the `TabButton` idiom at `DocumentationBuilderDialog.tsx:140-150` is for **Phase 50/51 only**. Phase 49 is a clean SINGLE PANE, structured tab-ready — do NOT add tabs or import `TabButton`. The "tab-ready" requirement is satisfied by keeping the dialog body in a structured layout, not by mounting a tablist.

---

### `src/main/ipc.ts` (route — MODIFIED, register `variant:export`)

**Analog:** the `export:start` registration (`src/main/ipc.ts:1030-1047`) — the channel-registration + arg-coercion-ladder pattern.

**Channel registration with arg coercion** (`src/main/ipc.ts:1030-1046`):
```typescript
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts) =>
  handleStartExport(
    evt, plan, outDir,
    overwrite === true,
    sharpenEnabled === true,
    (outputMode === 'loose' || outputMode === 'atlas' || outputMode === 'both') ? outputMode : 'loose',
    (atlasOpts && typeof atlasOpts === 'object') ? (atlasOpts as AtlasOpts)
      : { maxPageSize: 4096, allowRotation: false, padding: 2 },
  ),
);
```
**For the variant:** register a NEW `ipcMain.handle('variant:export', ...)` that coerces the same opts ladder PLUS the new `s` (number) + `parentDir` (string), and delegates to `handleExportVariant` (the new orchestrator). RESEARCH §Flag 5 recommends a NEW channel (cleaner than overloading the already-6-arg `export:start`; honors D-04 "shipped Optimize flow untouched"). Registration happens inside `registerIpcHandlers()` (`src/main/ipc.ts:997`) alongside the other `ipcMain.handle` calls.

---

### `src/preload/index.ts` (route — MODIFIED, expose `window.api.exportVariant`)

**Analog:** the `startExport` binding (`src/preload/index.ts:108-117`).

**The preload bridge shape** (`src/preload/index.ts:108-117`):
```typescript
startExport: (plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts) =>
  ipcRenderer.invoke(
    'export:start',
    plan, outDir,
    overwrite === true,
    sharpenEnabled === true,
    outputMode, atlasOpts,
  ),
```
**For the variant:** add `exportVariant: (summary, s, parentDir, overwrite, sharpenEnabled, outputMode, atlasOpts) => ipcRenderer.invoke('variant:export', summary, s, parentDir, overwrite === true, sharpenEnabled === true, outputMode, atlasOpts)`. Reuse `pickOutputDirectory` (`:87-88`) for the parent-folder pick — no new picker channel needed.

---

### `src/renderer/src/components/AppShell.tsx` (component — MODIFIED toolbar + handler)

**Analog:** the "Optimize Assets" button mount (`:2174-2181`), `onClickOptimize` (`:783-792`), `activeOverrides` selector (`:409-412`), `pickOutputDir` helper (`:774-779`).

**Toolbar button mount** (`src/renderer/src/components/AppShell.tsx:2174-2181`) — add an "Export Variant…" sibling beside it:
```typescript
<button
  type="button"
  onClick={onClickOptimize}
  disabled={effectiveSummary.peaks.length === 0 || exportInFlight}
  className="bg-accent text-panel rounded-md px-3 h-8 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
>
  Optimize Assets
</button>
```
(The "Documentation" button at `:2167-2173` shows the secondary/outlined class string variant if a less-prominent treatment is wanted for the new action.)

**Plan-build handler** (`src/renderer/src/components/AppShell.tsx:783-792`) — the model for `onClickExportVariant`; the variant version reads the SAME `activeOverrides` + `safetyBufferPercentLocal`, and additionally threads `s`:
```typescript
const onClickOptimize = useCallback(async () => {
  const plan = buildExportPlan(summary, activeOverrides, {
    skeletonPath: summary.skeletonPath,
    safetyBufferPercent: safetyBufferPercentLocal,
  });
  setExportDialogState({ plan, outDir: lastOutDir });
}, [summary, activeOverrides, lastOutDir, safetyBufferPercentLocal]);
```
> Per RESEARCH A2/Flag 5, **main builds the `s`-scaled plan** (recommended) — so the renderer can pass `summary` + `s` over IPC and skip a renderer parity copy of `scaleSummaryPeaks`. If instead the renderer builds it (mirroring `onClickOptimize`), it would need a renderer-side `scaleSummaryPeaks` (the `export-view.ts` parity contract). The planner decides (discretion).

**Mode-aware override bucket** (`src/renderer/src/components/AppShell.tsx:409-412`) — reuse VERBATIM; the variant inherits the active loaderMode bucket, no new routing (D-07):
```typescript
const activeOverrides = useMemo(
  () => (loaderMode === 'atlas-less' ? overridesAtlasLess : overrides),
  [loaderMode, overrides, overridesAtlasLess],
);
```

**Folder picker helper** (`src/renderer/src/components/AppShell.tsx:774-779`) — reuse for the PARENT-folder pick in the variant's `onConfirmStart`:
```typescript
const pickOutputDir = useCallback(
  async (startPath: string): Promise<string | null> => {
    return window.api.pickOutputDirectory(startPath);
  }, [],
);
```
The variant picks a PARENT; the `{NAME}@{s}x/` subfolder is appended main-side (D-01). The probe-then-confirm `onConfirmStart` (`:814-873`) can be modeled if D-03 conflict reuse is wanted, but note the probe currently enumerates loose/atlas targets, not the `{NAME}.json` (RESEARCH Open Question 2 — widen the probe or add a JSON existence check; planner picks one).

---

### `tests/core/variant-sizing.spec.ts` (test — unit, core; EXPORT-02)

**Analog:** `tests/core/export.spec.ts` + the sizing math at `src/core/export.ts:254-304`.

**Assertion idiom:** build the master plan via `buildExportPlan(summary, ovr, opts)`, build the variant plan via `buildExportPlan(scaleSummaryPeaks(summary, s), ovr, opts)`, and assert per-row `variant.outW === ceil(canonicalW × variant.effScale)` AND `variant.effScale` reflects the locked interpretation (`(pct/100) × s × peak`). The override-%-of-peak linearity is the key invariant — `applyOverride` is a linear multiply (`src/core/overrides.ts:132`: `(safe / 100) * peakScale`), so with overrides set, assert the variant reflects `(pct/100) × s × peak` not `s × clamp((pct/100)×peak)` where they differ. **NO `sampleSkeleton` anywhere in the path** (L-02). Drive from `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (has overrides-eligible regions + a TransformConstraint).

### `tests/main/variant-source-immutable.spec.ts` (test — integration, main; EXPORT-02 source-never-modified)

**Analog:** `tests/main/image-worker.integration.spec.ts:21-67` — the tmpdir + sha256 idiom.

**Setup idiom** (`tests/main/image-worker.integration.spec.ts:30-36` + `:25`):
```typescript
import { createHash } from 'node:crypto';
let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
```
**Assertion:** hash the source `{skeleton}.json` bytes before; run `handleExportVariant`; hash after; assert byte-identical. (Structural guarantee: `bake` clones first, `src/core/scale-bake.ts:91`; and the path is only ever `readFile`'d, never written.)

### `tests/main/variant-package-layout.spec.ts` (test — integration, main; EXPORT-01/03 + rollback)

**Analog:** `tests/main/image-worker.integration.spec.ts` + `tests/main/repack-worker.spec.ts` (tmp outDir, `fs.existsSync` assertions).

**Assertion:** run `handleExportVariant` for `loose`/`atlas`/`both` into a tmp parent; assert `loose` → `{NAME}@{s}x/{NAME}.json` + `{NAME}@{s}x/images/<region>.png`×N; `atlas` → `{NAME}.json` + `{NAME}.atlas` + `{NAME}.png`; `both` → union. Assert the scaled JSON is present in ALL three modes (always-written, EXPORT-03). Assert NO `@`-suffix on inner basenames; folder name == `{NAME}@{s}x`. **Fold in the rollback test** (RESEARCH Validation): force a `runRepack` oversize (tiny `maxPageSize`) on `atlas` mode and assert the folder contains NO `{NAME}.json` afterward (Pitfall 2). Drive the pixel path from `fixtures/SIMPLE_PROJECT` (real PNG).

### `tests/main/variant-dropin-faithful.spec.ts` (test — oracle, dual-runtime; EXPORT-01 faithfulness)

**Analog:** `tests/scale-bake.spec.ts:1-75` — the dual-runtime parse harness (REUSE it, don't rebuild).

**The sanctioned dual-runtime co-import** (`tests/scale-bake.spec.ts:54-62`):
```typescript
import * as sc43 from '@esotericsoftware/spine-core';  // 4.3.0
import * as sc42 from 'spine-core-42';                  // 4.2.111 (npm alias)
import { bake } from '../src/core/scale-bake.js';
// MATRIX entries pin the runtime per rig's skeleton.spine major.minor (scale-bake.spec.ts:72-75)
```
**Three assertions** (RESEARCH Validation EXPORT-01): (a) geometry — reuse the Phase-48 oracle `parse(baked, scale=1)` field-equiv `parse(source, scale=s)`; (b) cross-resolve — load the written `{NAME}@{s}x/` package via `loadSkeleton` without error, region names in JSON `path:` all resolve; (c) `s×` world-AABB — sample the LOADED variant and assert each attachment's world-AABB == `s ×` master (the spike-003 bar — this is the ONLY place sampling is allowed, and it samples the *package* to PROVE faithfulness, distinct from sizing which never samples). **No-silent-skip guard** (`tests/scale-bake.spec.ts:38-42`): hard-fail with a clear message if a matrix fixture is absent.

> **DUAL-RUNTIME LANDMINE:** if this oracle routes through `loadSkeleton`/the runtime facade for the cross-resolve/sample legs, it is subject to [[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]]. The bake + write path itself is runtime-agnostic (RESEARCH §Flag 7 — no spine-core below the bake), so only this test leg carries the per-entrypoint concern; the Phase-48 harness already drives both runtimes.

### `tests/main/variant-scale-guard.spec.ts` (test — unit, main; EXPORT-01 D-08)

**Analog:** `tests/main/ipc-export.spec.ts` (envelope `{ ok, error }` assertions).

**Assertion:** `handleExportVariant(..., s=1.0)` and `s=2.0` return `ok:false` with the `VariantScaleError` message; `s=0.5` proceeds; AND assert core `bake(json, 1.0)` still SUCCEEDS (direction-agnostic, Phase-48 D-09 preserved — guard is edge-only, not in `src/core/scale-bake.ts:90`).

---

## Shared Patterns

### Shared `written: Set<string>` atomic-or-fail rollback
**Source:** `src/main/ipc.ts:900` (set created) + `:981-984` (sweep)
**Apply to:** `variant-export.ts` orchestration AND `skeleton-json-writer.ts` (the JSON joins the same set, registered FIRST/before textures).
```typescript
const written = new Set<string>();
try {
  await writeSkeletonJsonAtomic(jsonPath, baked, written);  // JSON first
  // runExport / runRepack(..., written)                    // textures share the set
} catch (e) {
  for (const p of written) await fsRm(p, { force: true }).catch(() => {});
  throw e;
}
```

### Atomic `.tmp`+`rename` write
**Source:** `src/main/project-io.ts:253-280` (mechanics) + `src/main/image-worker.ts:285-292` (register-before-write)
**Apply to:** `skeleton-json-writer.ts` (the only NEW write site this phase).

### `{NAME}`-keyed basename derivation
**Source:** `src/main/atlas-paths.ts:69-90` (`deriveProjectName` off `plan.skeletonPath` basename)
**Apply to:** `variant-export.ts` — pass `plan.skeletonPath = summary.skeletonPath` so atlas/page basenames are clean `{NAME}.*` for free, in BOTH loader modes, with zero atlas-writer change. Do NOT scale-suffix inner basenames (D-02 / Pitfall 4).

### Clone-before-transform
**Source:** `src/core/scale-bake.ts:44,91` (`JSON.parse(JSON.stringify(...))` / `structuredClone`)
**Apply to:** `scaleSummaryPeaks` (the live `summary` drives panels — never mutate in place, Pitfall 3).

### Typed-error with `.name` + human message
**Source:** `src/core/errors.ts:13-18` (root + `.name`-routing) / `src/core/scale-bake.ts:36-41` (minimal)
**Apply to:** `VariantScaleError` (D-08). The renderer displays `.message`; `.name` enables optional `KNOWN_KINDS` routing.

### Mode-aware override bucket (loaderMode separation)
**Source:** `src/renderer/src/components/AppShell.tsx:409-412` (`activeOverrides`)
**Apply to:** the variant plan-build — reuse the active bucket verbatim; no cross-bucket logic (L-05, [[project_strict_loadermode_separation]]).

### Controlled-prop dialog (parent owns state)
**Source:** `src/renderer/src/modals/OptimizeDialog.tsx:55-141` props + `:258-359` `onStart`
**Apply to:** `VariantDialog.tsx` — same config props + the probe-then-confirm `onConfirmStart` handshake; add ONE numeric `scale` field.

### tmpdir + sha256 / existsSync integration-test scaffold
**Source:** `tests/main/image-worker.integration.spec.ts:21-67`
**Apply to:** all three `tests/main/variant-*.spec.ts` integration specs.

### Dual-runtime co-import oracle harness
**Source:** `tests/scale-bake.spec.ts:54-75` (sanctioned both-specifier import + per-rig runtime matrix)
**Apply to:** `tests/main/variant-dropin-faithful.spec.ts` — REUSE the harness for the geometry leg.

---

## No Analog Found

None. Every Phase-49 file has a concrete in-repo analog. This is an integration phase on stable v1.6 export infrastructure (RESEARCH §State of the Art: "greenfield wiring on top of stable v1.6 export infrastructure").

The single genuinely-new *capability* — writing a skeleton JSON to disk (L-03) — still has a direct idiom analog (`writeProjectFileAtomic`); only the *artifact type* (skeleton vs `.stmproj`) is new, and the writer copies the mechanics, not the envelope.

---

## Co-Required Hygiene (NOT an analog — a landmine the planner MUST honor)

**SAFE-01 denylist co-extension** ([[feedback_new_committed_fixtures_need_safe01_denylist]]): IF any plan commits a NEW fixture dir (e.g. placeholder PNGs for 4.3-pixel coverage), it MUST add the path prefix to `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts:119-155` **as a co-required task in the SAME plan** (a newly git-tracked dir has no committed SAFE-01 golden → frozen-set +N AND baseline gitTracked-arm HARD throw). **Prefer reusing existing committed fixtures** (`fixtures/SIMPLE_PROJECT` has a real PNG; `SCALE_BAKE_4_2/4_3`, `SLIDER_4_3`, `XTRA01/02_4_3` are json+atlas-only and already denylisted) to avoid this entirely (RESEARCH A4 / Pitfall 5 — recommendation: option 1, no new dir).

> The denylist pattern itself is the established idiom — every prior phase that committed a 4.3 fixture added a prefix here (`discover-fixtures.ts:120-154`). The variant tests should ride the existing entries; no new prefix is expected if RESEARCH option-1 is followed.

---

## Metadata

**Analog search scope:** `src/main/` (ipc, project-io, image-worker, repack-worker, atlas-paths, atlas-writer), `src/core/` (scale-bake, export, overrides, errors), `src/renderer/src/` (AppShell, OptimizeDialog), `src/preload/`, `src/shared/types.ts`, `tests/` (scale-bake, image-worker.integration, arch, export, repack-worker), `tests/safe01/`.
**Files scanned:** 18 source/test files read at file:line this session.
**Pattern extraction date:** 2026-05-22

---

## PATTERN MAPPING COMPLETE
