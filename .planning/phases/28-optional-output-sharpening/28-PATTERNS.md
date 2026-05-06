# Phase 28: Optional Output Sharpening — Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 11 (5 source modified, 1 source NEW-helper site, 2 test extended/new, 3 doc/state housekeeping)
**Analogs found:** 11 / 11 (every file has an exact same-locus precedent)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/image-worker.ts` | service (main-process worker) | file-I/O batch transform | self (existing resize pipeline at :430-462) | **exact (in-file refactor)** |
| `src/shared/types.ts` (ProjectFileV1 + AppSessionState) | model (IPC schema) | request-response | `loaderMode` field at :740, :779, :802 (Phase 21 D-08) | **exact** |
| `src/shared/types.ts` (Api.startExport) | model (IPC contract) | request-response | existing `overwrite?: boolean` 3rd arg at :921-925 | **exact** |
| `src/core/project-file.ts` | utility (pure-TS validator + serializer) | transform | `loaderMode` three-touch at :174-186, :281-302, :377-407 | **exact** |
| `src/renderer/src/modals/OptimizeDialog.tsx` | component (React modal) | request-response | self (existing in-modal state hygiene + 3-tile summary at :366-379, footer at :402-422) | **exact (in-file insertion)** |
| `src/renderer/src/components/AppShell.tsx` | controller (renderer host) | event-driven | `samplingHzLocal` precedent at :254, :715, :803, :827-830 (Phase 9 D-188) | **exact** |
| `src/main/project-io.ts` | controller (main-process IPC handler) | file-I/O round-trip | `loaderMode` site-1/site-2 at :402-417, :502, :551-553 (Phase 21 D-08) | **exact** |
| `src/main/ipc.ts` (handleStartExport) | middleware (IPC handler) | request-response | existing `overwrite: boolean = false` 4th param at :536, :654 + `ipcMain.handle('export:start', ...)` at :685-687 | **exact** |
| `src/preload/index.ts` (startExport) | bridge (IPC preload) | request-response | existing `startExport: (plan, outDir, overwrite) => …` at :98-99 | **exact** |
| `tests/main/image-worker.sharpen.spec.ts` (NEW) | test (integration real-bytes) | file-I/O assertion | `tests/main/image-worker.integration.spec.ts` (88 lines, full file) | **exact** |
| `tests/core/project-file.spec.ts` (extended) | test (unit round-trip) | transform assertion | existing `describe('Phase 21 — loaderMode (D-08)')` at :310-372 | **exact** |
| `.planning/REQUIREMENTS.md` | docs (traceability) | static | OPT / PANEL / QA section structure at :13-37 + traceability table at :67-84 | **exact** |
| `.planning/ROADMAP.md` | docs (milestone bullet + phase detail) | static | line 10 milestone bullet + line 80 phase bullet (already pivoted text-wise; only the missing `### Phase 28:` detail section is needed) | **partial** |
| `.planning/STATE.md` | docs (phase status) | static | self (lines 7, 20 already reflect pivot) | **partial — verify only** |

---

## Pattern Assignments

### `src/main/image-worker.ts` (service, file-I/O batch transform)

**Analog:** self — the unified try/catch at :430-462 holds both resize call sites in the same lexical scope. DRY-extract a private helper directly above this block.

**Imports pattern** (lines 56-64 — VERBATIM, no additions needed):
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

**Constant + helper insertion point** — top-level, BETWEEN imports (line 64) and `runExport` signature (line 66). Mirrors any module-level const-then-export pattern; this file currently has none, so the constant opens that section. Comment style mirrors existing block-comment headers (the file's own line 1-55 docblock).

```typescript
// Phase 28 SHARP-02 — fixed sigma for sharp.sharpen() unsharp mask. NOT a
// tunable, slider, or per-row override (D-05 LOCKED). Closely matches
// Photoshop's "Bicubic Sharper (reduction)" preset for typical Spine art at
// 50–75% downscale ratios.
const SHARPEN_SIGMA = 0.5;

/**
 * Phase 28 SHARP-02 — applies the resize chain (Lanczos3 fill) AND the
 * conditional sharpen pass to a sharp pipeline. Both image-worker resize
 * call sites (per-region + atlas-extract) collapse onto this helper so the
 * downscale-only gate + sigma constant live in ONE place (D-08).
 *
 * Sharpen runs only when sharpenEnabled === true AND effectiveScale < 1.0
 * (D-07). Identity (1.0×) and upscale rows skip sharpen entirely; passthrough
 * rows never enter this helper at all (they take the byte-copy fast path
 * earlier in runExport).
 *
 * Idempotency guaranteed by shape: the helper applies sharpen at most once
 * per call. Calling .sharpen() twice in a single sharp pipeline is NOT
 * idempotent (compounds the unsharp mask).
 */
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

**Signature extension pattern** (mirror of existing `allowOverwrite: boolean = false` at line 77):
```typescript
export async function runExport(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  allowOverwrite: boolean = false,
  // Phase 28 SHARP-02 — opt-in unsharp-mask post-resize. Default false
  // preserves the neutral baseline for direct test invocations and any
  // caller bypassing the IPC layer (mirrors allowOverwrite default).
  sharpenEnabled: boolean = false,
): Promise<ExportSummary> {
```

**Core pattern — both call sites collapse** (replaces lines 432-452):
```typescript
if (useAtlasExtract && row.atlasSource) {
  await applyResizeAndSharpen(
    sharp(row.atlasSource.pagePath).extract({
      left: row.atlasSource.x,
      top: row.atlasSource.y,
      width: row.atlasSource.w,
      height: row.atlasSource.h,
    }),
    row.outW, row.outH, row.effectiveScale, sharpenEnabled,
  ).toFile(tmpPath);
} else {
  await applyResizeAndSharpen(
    sharp(sourcePath),
    row.outW, row.outH, row.effectiveScale, sharpenEnabled,
  ).toFile(tmpPath);
}
```

**Error handling pattern** (UNCHANGED — lines 453-462; the existing catch block continues to classify any sharp/libvips throw as `'sharp-error'`):
```typescript
} catch (e) {
  const error: ExportError = {
    kind: 'sharp-error',
    path: useAtlasExtract && row.atlasSource ? row.atlasSource.pagePath : sourcePath,
    message: e instanceof Error ? e.message : String(e),
  };
  errors.push(error);
  onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
  continue;
}
```

**Pre-flight guards UNCHANGED** (lines 380-419) — the NaN/zero-dim guard at :393-405 already runs BEFORE the helper; the helper trusts inputs. Same for the path-traversal defense at :380-387 and the mkdir step at :407-419.

---

### `src/shared/types.ts` — ProjectFileV1 + AppSessionState (model, request-response)

**Analog:** `loaderMode` field added in Phase 21 D-08 — three identical sites at :740, :779, :802.

**Pattern at ProjectFileV1** (lines 754-780, add new field after line 779):
```typescript
export interface ProjectFileV1 {
  version: 1;
  skeletonPath: string;
  atlasPath: string | null;
  // … existing fields …
  loaderMode: 'auto' | 'atlas-less';
  /**
   * Phase 28 SHARP-01 — opt-in unsharp-mask post-resize on downscale.
   * v1.2-era .stmproj files have no `sharpenOnExport` field; the validator
   * pre-massages missing → false (mirrors loaderMode pre-massage in
   * src/core/project-file.ts:174-186).
   */
  sharpenOnExport: boolean;
}
```

**Pattern at AppSessionState** (lines 790-803, add new field after line 802):
```typescript
export interface AppSessionState {
  // … existing fields …
  loaderMode: 'auto' | 'atlas-less';
  /** Phase 28 SHARP-01 — round-trips through .stmproj per Plan 28-XX. */
  sharpenOnExport: boolean;
}
```

**Optional: PartialMaterialized in `src/core/project-file.ts:321-367`** — same shape mirror; see project-file.ts assignment below.

---

### `src/shared/types.ts` — Api.startExport (model, request-response)

**Analog:** existing `overwrite?: boolean` at :921-925 (Phase 6 Gap-Fix Round 3).

**Pattern — extend signature** (lines 921-925):
```typescript
startExport: (
  plan: ExportPlan,
  outDir: string,
  overwrite?: boolean,
  /**
   * Phase 28 SHARP-02 — opt-in unsharp-mask post-resize. AppShell threads
   * `sharpenOnExportLocal` into this arg at the export-start call site.
   * Defaults to false in main when omitted.
   */
  sharpenEnabled?: boolean,
) => Promise<ExportResponse>;
```

**Q1 (RESEARCH.md) — Inline 4th arg vs envelope:** RESEARCH recommends inline arg (Option A). Mirrors `overwrite` precedent. Envelope refactor (`OptimizeOptions`) deferred until a phase adds multiple flags simultaneously.

---

### `src/core/project-file.ts` (utility, transform — pure-TS no I/O)

**Analog:** Phase 21 D-08 `loaderMode` three-touch at :174-186 (validator pre-massage), :281-302 (serializer), :377-407 (materializer + PartialMaterialized at :321-367).

**Imports pattern** (lines 38-49 — UNCHANGED; both validator + serializer are already in scope):
```typescript
import * as path from 'node:path';
import type {
  ProjectFile,
  ProjectFileV1,
  AppSessionState,
  SkeletonSummary,
} from '../shared/types.js';
import {
  validateDocumentation,
  DEFAULT_DOCUMENTATION,
  type Documentation,
} from './documentation.js';
```

**Validator pre-massage pattern** (insert AFTER line 186 — verbatim mirror of the loaderMode block at :174-186):
```typescript
// Phase 28 SHARP-01 forward-compat — v1.2-era .stmproj files have no
// `sharpenOnExport` field; default to false so legacy projects load with
// the neutral baseline (matches D-04 default-OFF). Mirrors loaderMode
// pre-massage above (Phase 21 D-08).
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

**Serializer pattern** (extend `serializeProjectFile` at :281-302, add field after line 300):
```typescript
return {
  version: 1,
  skeletonPath: relativizePath(state.skeletonPath, basedir),
  // … existing fields …
  loaderMode: state.loaderMode,
  // Phase 28 SHARP-01 — round-trips through .stmproj per D-06.
  sharpenOnExport: state.sharpenOnExport,
};
```

**PartialMaterialized pattern** (extend interface at :321-367, add field after line 349):
```typescript
export interface PartialMaterialized {
  // … existing fields …
  loaderMode: 'auto' | 'atlas-less';
  /**
   * Phase 28 SHARP-01 — defence-in-depth fallback (validator pre-massage
   * already substitutes false, but defaults here too in case any future
   * code path bypasses the validator). Mirrors loaderMode field above.
   */
  sharpenOnExport: boolean;
  projectFilePath: string;
  summary?: SkeletonSummary;
}
```

**Materializer pattern** (extend `materializeProjectFile` at :377-407, add field after line 403):
```typescript
return {
  // … existing fields …
  loaderMode: file.loaderMode ?? 'auto',
  // Phase 28 SHARP-01 — defence-in-depth nullish-coalesce; validator
  // pre-massage already substitutes false. Mirrors loaderMode line above.
  sharpenOnExport: file.sharpenOnExport ?? false,
  projectFilePath,
};
```

---

### `src/renderer/src/modals/OptimizeDialog.tsx` (component, request-response)

**Analog:** self — existing 3-tile summary at :366-379 + footer cluster at :402-422. The new checkbox slots BELOW the 3 tiles, BEFORE the file list (per RESEARCH §"Where in the dialog the checkbox renders").

**Imports pattern** (UNCHANGED — `clsx` + react hooks already in scope at :36-49).

**Props extension pattern** (extend `OptimizeDialogProps` at :55+; mirror of existing `onOpenAtlasPreview: () => void` callback prop):
```typescript
export interface OptimizeDialogProps {
  open: boolean;
  plan: ExportPlan;
  outDir: string | null;
  onClose: () => void;
  // … existing props …
  /**
   * Phase 28 SHARP-01 — opt-in sharpen toggle. Hydrated from the project's
   * .stmproj per D-06; toggling marks the project dirty (AppShell wires the
   * setter into its isDirty memo, mirroring samplingHzLocal).
   */
  sharpenOnExport: boolean;
  onSharpenChange: (v: boolean) => void;
}
```

**Checkbox insertion pattern** — insert AFTER the 3-tile summary div at line 379 and BEFORE the state-branched body (line 381). Tailwind v4 literal-class discipline (Pitfall 8); disabled when `state === 'in-progress'` (mirrors Atlas Preview button disabled-predicate at :417):
```typescript
{/* Phase 28 SHARP-01 — opt-in sharpen toggle. Hydrated from the project's
    .stmproj on dialog mount (D-06). Disabled in-progress (mirrors Atlas
    Preview button disabled-predicate at line 417). Tailwind v4 literal-class
    discipline (Pitfall 8) — every className is a string literal. */}
<label className="flex items-center gap-2 mb-4 text-xs text-fg cursor-pointer">
  <input
    type="checkbox"
    checked={props.sharpenOnExport}
    onChange={(e) => props.onSharpenChange(e.target.checked)}
    disabled={state === 'in-progress'}
    className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
  />
  Sharpen output on downscale
</label>
```

**IPC threading pattern** (extend `window.api.startExport` call at :223-227 — currently passes 3 args):
```typescript
const response: ExportResponse = await window.api.startExport(
  props.plan,
  resolvedOutDir,
  overwrite,
  props.sharpenOnExport, // Phase 28 SHARP-02 — 4th arg per Q1 inline recommendation
);
```

**State machine UNCHANGED** — DialogState `'pre-flight' | 'in-progress' | 'complete'` at :52, focus-trap hook at :289-291, ESC/Enter handlers at :260-298 all preserved verbatim.

---

### `src/renderer/src/components/AppShell.tsx` (controller, event-driven)

**Analog:** Phase 9 D-188 `samplingHzLocal` precedent — five identical sites map onto the new `sharpenOnExportLocal` slot.

**Site 3a — local state slot** (insert after line 254, mirror of `samplingHzLocal`):
```typescript
// Phase 28 SHARP-01 — local sharpenOnExport state. Seeded from the project on
// mount; OptimizeDialog mutates this and the next Save persists it. Mirrors
// samplingHzLocal precedent (line 254) — same lifecycle, same dirty-flag
// integration. Default false matches D-04 (toggle OFF baseline).
const [sharpenOnExportLocal, setSharpenOnExportLocal] = useState<boolean>(
  () => initialProject?.sharpenOnExport ?? false,
);
```

**Site 3a — lastSaved shape extension** (extend at :343-353):
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

**Site 3b — buildSessionState** (extend at :705-743, add field after line 732 `loaderMode`):
```typescript
const buildSessionState = useCallback(
  (): AppSessionState => ({
    skeletonPath: summary.skeletonPath,
    // … existing fields …
    loaderMode,
    // Phase 28 SHARP-01 — round-trips through .stmproj per D-06.
    sharpenOnExport: sharpenOnExportLocal,
  }),
  [
    summary.skeletonPath,
    summary.atlasPath,
    overrides,
    samplingHzLocal,
    documentation,
    loaderMode,
    lastOutDir,
    sharpenOnExportLocal, // Phase 28 SHARP-01 — new dependency
  ],
);
```

**Site 3c — isDirty memo** (extend at :795-805, add comparison after line 803):
```typescript
const isDirty = useMemo(() => {
  if (lastSaved === null) {
    return overrides.size > 0;
  }
  if (overrides.size !== Object.keys(lastSaved.overrides).length) return true;
  for (const [k, v] of overrides) {
    if (lastSaved.overrides[k] !== v) return true;
  }
  if (samplingHzLocal !== lastSaved.samplingHz) return true;
  // Phase 28 SHARP-01 — toggle change marks project dirty. Mirrors
  // samplingHz line above (D-06 — toggle persists per-project).
  if (sharpenOnExportLocal !== lastSaved.sharpenOnExport) return true;
  return false;
}, [overrides, lastSaved, samplingHzLocal, sharpenOnExportLocal]);
```

**Site 3e — onClickSave persistence** (extend at :826-830, mirror at the Save As branch too):
```typescript
if (resp.ok) {
  setLastSaved({
    overrides: { ...state.overrides },
    samplingHz: state.samplingHz ?? 120,
    sharpenOnExport: state.sharpenOnExport, // Phase 28 SHARP-01
  });
  setStaleOverrideNotice(null);
}
```

**OptimizeDialog wire-through** — the existing `<OptimizeDialog … />` mount site (search for `OptimizeDialog open={…}` near line 569) gains:
```typescript
sharpenOnExport={sharpenOnExportLocal}
onSharpenChange={setSharpenOnExportLocal}
```

---

### `src/main/project-io.ts` (controller, file-I/O round-trip)

**Analog:** Phase 21 D-08 `loaderMode` site-1/site-2 at :402-417, :502, :551-553. The sharpen field round-trips through the SAME materialized → MaterializedProject envelope.

**Pattern — MaterializedProject construction** (extend the MaterializedProject build site near :538-553, add field after `loaderMode: materialized.loaderMode`):
```typescript
const project: MaterializedProject = {
  summary,
  restoredOverrides: filtered,
  staleOverrideKeys,
  samplingHz: materialized.samplingHz,
  // … existing fields …
  loaderMode: materialized.loaderMode,
  // Phase 28 SHARP-01 — thread sharpenOnExport so AppShell can seed its
  // sharpenOnExportLocal slot on Open. Mirrors loaderMode site immediately
  // above (Phase 21 D-08 Site 2).
  sharpenOnExport: materialized.sharpenOnExport,
};
```

**Pattern — recovery-path threading** (extend at :671-682 if MaterializedProject is rebuilt by the locate-skeleton recovery handler, mirroring the `samplingHz` + `loaderMode` lift there):
```typescript
const sharpenOnExport: boolean =
  typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false;
// … threaded into the rebuilt MaterializedProject envelope alongside
// samplingHz / loaderMode at the existing site.
```

**Note:** `MaterializedProject` is declared in `src/shared/types.ts:810-...` — it gains `sharpenOnExport: boolean` as part of the same Touch-1 (types.ts) edit. Mirror of how `loaderMode` was added to that interface in Phase 21.

---

### `src/main/ipc.ts` — handleStartExport (middleware, request-response)

**Analog:** existing `overwrite: boolean = false` 4th param at :536, forwarded to `runExport` at :654.

**Pattern — extend signature** (line 532-537):
```typescript
export async function handleStartExport(
  evt: Electron.IpcMainInvokeEvent | { sender: { send: (channel: string, ...args: unknown[]) => void } },
  plan: unknown,
  outDir: unknown,
  overwrite: boolean = false,
  // Phase 28 SHARP-02 — 5th arg, default false (mirrors overwrite default).
  sharpenEnabled: boolean = false,
): Promise<ExportResponse> {
```

**Pattern — forward into runExport** (extend the call at :644-655):
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
```

**Pattern — IPC handler registration** (extend at :685-687, mirror of strict `=== true` overwrite check):
```typescript
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite, sharpenEnabled) =>
  handleStartExport(
    evt,
    plan,
    outDir,
    overwrite === true,
    sharpenEnabled === true, // Phase 28 SHARP-02 — strict boolean coerce
  ),
);
```

---

### `src/preload/index.ts` — startExport bridge (bridge, request-response)

**Analog:** existing `startExport: (plan, outDir, overwrite) => ipcRenderer.invoke(...)` at :98-99.

**Pattern** (extend at :98-99):
```typescript
startExport: (plan, outDir, overwrite, sharpenEnabled) =>
  ipcRenderer.invoke(
    'export:start',
    plan,
    outDir,
    overwrite === true,
    sharpenEnabled === true, // Phase 28 SHARP-02
  ),
```

---

### `tests/main/image-worker.sharpen.spec.ts` (NEW, test integration real-bytes)

**Analog:** `tests/main/image-worker.integration.spec.ts` (88 lines, no mocks) — the entire file is the template.

**Imports + lifecycle pattern** (verbatim copy of analog :21-35):
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
```

**Synthetic edge fixture pattern** (NEW — synthetic 64×64 black/white edge generated inline; mirrors `scripts/pma-probe.mjs` synthetic-fixture style, NOT the on-disk fixture pattern):
```typescript
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
```

**Test-shape pattern** (mirror of analog :37-87 — single `describe` with `it()` per dimension):
```typescript
describe('runExport — sharpen (Phase 28 SHARP-02 + SHARP-03)', () => {
  it('SHARP-02: sharpenEnabled=true + effectiveScale<1.0 produces sharper output (variance > baseline)', async () => {
    // Build src; run runExport twice (baseline + sharpened); assert
    // computeEdgeVariance(sharpened) > computeEdgeVariance(baseline) * 1.5
    // (threshold tuned at plan-execution time per RESEARCH §A1).
  });

  it('SHARP-03: sharpenEnabled=true + effectiveScale=1.0 produces baseline output (gate enforced)', async () => {
    // outW=64, outH=64, effectiveScale=1.0 → byte-identical regardless of toggle.
    // expect(Buffer.compare(rawA, rawB)).toBe(0);
  });

  it('SHARP-03: sharpenEnabled=false + effectiveScale<1.0 produces baseline output (toggle enforced)', async () => {
    // effectiveScale=0.5, sharpenEnabled=false → byte-identical to no-sharpen.
    // expect(Buffer.compare(rawA, rawB)).toBe(0);
  });

  it('SHARP-02: atlas-extract branch ALSO sharpens (D-08 both call sites covered)', async () => {
    // Plan row populates atlasSource; same variance assertion as test 1
    // but exercising the atlas-extract branch at image-worker.ts:432-446.
  });
});
```

**`computeEdgeVariance` helper** — 10-line helper computing pixel-value variance over the 14-18 column range (column boundary in the downscaled 32-wide image where the original 32-px-wide edge transition lands).

---

### `tests/core/project-file.spec.ts` (extend, test unit round-trip)

**Analog:** existing `describe('Phase 21 — loaderMode (D-08)')` block at :310-372 — three `it()` cases: pre-massage missing, reject invalid, round-trip identity. NEW Phase 28 block mirrors all three.

**Imports** (existing imports at top of file already cover `validateProjectFile` + `serializeProjectFile` + `materializeProjectFile` + `ProjectFileV1` + `AppSessionState` + `DEFAULT_DOCUMENTATION` — no new imports needed).

**Test pattern** (insert AFTER line 372, mirror of the loaderMode describe block verbatim, swapping field names + values):
```typescript
describe('Phase 28 — sharpenOnExport (D-06)', () => {
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

  it('validateProjectFile rejects non-boolean sharpenOnExport', () => {
    const bad: Record<string, unknown> = {
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
      sharpenOnExport: 'yes', // invalid — must be boolean
    };
    const result = validateProjectFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-shape');
      expect(result.error.message).toMatch(/sharpenOnExport/);
    }
  });

  it('serialize → materialize round-trips sharpenOnExport: true identically', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'auto',
      sharpenOnExport: true,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.sharpenOnExport).toBe(true);
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.sharpenOnExport).toBe(true);
  });

  it('serialize → materialize round-trips sharpenOnExport: false identically', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.sharpenOnExport).toBe(false);
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.sharpenOnExport).toBe(false);
  });
});
```

---

### `.planning/REQUIREMENTS.md` (docs, traceability)

**Analog:** existing `### OPT — Optimize Flow` section at :20-24, `### PANEL —` at :13-18, `### QA —` at :33-37. Traceability table at :67-84.

**Pattern — new section AFTER `### QA` (after line 38)**:
```markdown
### SHARP — Output Quality

- [ ] **SHARP-01**: User opt-in checkbox in OptimizeDialog ("Sharpen output on downscale" or final copy) controls whether sharp.sharpen({ sigma: 0.5 }) is applied to downscaled rows; toggle persists per-project in .stmproj v1 schema (additive optional `sharpenOnExport: boolean`; missing field defaults to false for backward-compat with v1.2-era files).
- [ ] **SHARP-02**: When toggle is ON, image-worker applies sharp.sharpen({ sigma: 0.5 }) AFTER the Lanczos3 resize on rows where effectiveScale < 1.0. Both resize call sites (per-region path at src/main/image-worker.ts:447-451 and atlas-extract path at src/main/image-worker.ts:437-446) receive the conditional sharpen.
- [ ] **SHARP-03**: Regression test locks SHARPEN_SIGMA constant value (0.5) and the downscale-only gate (effectiveScale < 1.0); test asserts that toggle OFF + downscale produces baseline output (no sharpen) and toggle ON + identity scale (1.0) produces baseline output (gate enforced).
```

**Pattern — traceability rows** (append to table at line 84):
```markdown
| SHARP-01 | Phase 28 | Pending |
| SHARP-02 | Phase 28 | Pending |
| SHARP-03 | Phase 28 | Pending |
```

---

### `.planning/ROADMAP.md` (docs, milestone bullet + phase detail)

**Status check:** Line 10 milestone bullet ALREADY references SHARP-01..03 (verified). Line 80 phase 28 bullet ALREADY contains the pivoted text (verified). Both LGTM as-is.

**Gap:** No `### Phase 28:` detail section exists in the `## Phases` block (present for Phases 10, 12, 13, etc.). Add detail section AFTER the existing Phase 27 detail (search for `### Phase 27:` end-of-block), mirroring the structure used for Phase 22, Phase 23, Phase 24, Phase 26.1, Phase 26.2, Phase 27:

**Pattern** (mirror of Phase 27 detail block structure):
```markdown
### Phase 28: Optional Output Sharpening on Downscale

**Goal**: Add an opt-in `OptimizeDialog` checkbox ("Sharpen output on downscale") that, when enabled, applies `sharp.sharpen({ sigma: 0.5 })` AFTER the Lanczos3 resize on rows with `effectiveScale < 1.0`. Mirrors Photoshop's "Bicubic Sharper (reduction)" preset; default OFF preserves the neutral baseline.

**Depends on**: Phase 6 (Optimize Assets) + Phase 8 (.stmproj v1 schema) + Phase 22 (passthroughCopies — passthrough rows are unaffected per D-07).

**Requirements**: SHARP-01, SHARP-02, SHARP-03

**Success Criteria** (what must be TRUE):
  1. User toggles the checkbox in OptimizeDialog; toggle state persists per-project in `.stmproj` (additive optional field, missing → false for v1.2-era files).
  2. Toggle ON + downscale row → output PNG is measurably sharper than the toggle-OFF baseline (variance assertion in regression test).
  3. Toggle ON + identity (1.0×) row → byte-identical to toggle-OFF baseline (downscale-only gate enforced).
  4. Toggle ON applied to BOTH resize call sites (per-region + atlas-extract) — both branches collapse onto the DRY `applyResizeAndSharpen` helper.
  5. Backlog 999.9 (PMA preservation) closed `falsified`. `scripts/pma-probe.mjs` retained as regression sentinel.

**Plans**: TBD by `/gsd-plan-phase 28`.
```

---

### `.planning/STATE.md` (docs, phase status — verify-only)

**Analog:** lines 7 and 20 already reflect the Phase 28 pivot to "Optional output sharpening on downscale" (verified during context-gathering on 2026-05-06). No edit required at planning time UNLESS planner spots stale wording during verification.

**Pattern — if any update needed:** mirror existing two-line update style (one-line summary at `last_activity:` field; multi-line block at `## Current Position` Status field).

---

## Shared Patterns

### Phase 21 D-08 `loaderMode` Three-Touch Verbatim Mirror

**Source:** `src/core/project-file.ts:174-186` (validator) + `:281-302` (serializer) + `:321-367` (PartialMaterialized interface) + `:377-407` (materializer) + `tests/core/project-file.spec.ts:310-372` (3 round-trip tests).

**Apply to:** `sharpenOnExport` field plumbing across `src/shared/types.ts`, `src/core/project-file.ts`, `src/main/project-io.ts`, `tests/core/project-file.spec.ts`.

**Why this pattern:** `loaderMode` was the most recent (2026-05-02) additive optional `.stmproj` field; verbatim mirroring guarantees the validator pre-massage + materializer back-fill + round-trip test coverage match the established v1 schema convention. Phase 8 D-146 (samplingHz) is an older precedent but is `number | null` rather than `boolean` — `loaderMode` is the closer shape match (string-enum), and `sharpenOnExport` is the simplest case (plain boolean).

```typescript
// Validator pre-massage idiom (project-file.ts:174-186):
if (obj.FIELD === undefined) {
  obj.FIELD = DEFAULT_VALUE;
}
if (typeof obj.FIELD !== EXPECTED_TYPE) {
  return { ok: false, error: { kind: 'invalid-shape', message: 'FIELD is not …' } };
}

// Materializer back-fill idiom (project-file.ts:387, 403):
FIELD: file.FIELD ?? DEFAULT_VALUE,
```

### Phase 9 D-188 `samplingHzLocal` AppShell Wiring Mirror

**Source:** `src/renderer/src/components/AppShell.tsx` — local state at :254, lastSaved field at :345, buildSessionState dep at :715/738, isDirty comparison at :803, setLastSaved at :829.

**Apply to:** `sharpenOnExportLocal` lifecycle in `AppShell.tsx`. Five sites map 1:1 onto the new boolean slot. The ONLY behavioral difference: samplingHz changes trigger a re-sample IPC dispatch (Phase 9 D-188) — sharpenOnExport DOES NOT trigger re-sampling; toggling is a pure state update with no side-effects until export-start.

### Phase 6 Gap-Fix Round 3 Inline-Boolean IPC Threading

**Source:** `overwrite?: boolean` 3rd arg through 4 IPC layers — `src/shared/types.ts:921-925` (Api method) → `src/preload/index.ts:98-99` (preload bridge) → `src/main/ipc.ts:536, 654, 685-687` (handler + handle registration) → `src/main/image-worker.ts:77` (worker default arg).

**Apply to:** `sharpenEnabled?: boolean` 4th arg through the SAME four layers. Strict `=== true` boolean coerce at the IPC boundary (mirror of `overwrite === true` at :686).

**Why this pattern over an envelope:** RESEARCH Q1 — Phase 22 added `passthroughCopies[]` to `ExportPlan` envelope, NOT to `startExport` arg list, because that field is per-row data. `sharpenOnExport` is a single global flag for the export run — inline arg matches the `overwrite` precedent shape, simplest delta, no new envelope refactor.

### Tailwind v4 Literal-Class Discipline (Pitfall 8)

**Source:** every `className` in `OptimizeDialog.tsx` is a string literal — see :349, :353, :366-378 (3-tile summary), :411 (Atlas Preview button), :418 (disabled-state class string).

**Apply to:** the new sharpen checkbox `<label>` + `<input>` in OptimizeDialog. NO template interpolation in `className`. Disabled-state opacity uses the exact `disabled:opacity-50 disabled:cursor-not-allowed` literal seen at :418.

### Real-Bytes Integration Test Pattern (Phase 6 Plan 04 Task 2)

**Source:** `tests/main/image-worker.integration.spec.ts` (88 lines, no mocks) — uses `os.tmpdir()` + `fs.mkdtempSync` + `runExport` direct invocation + `sharp(outPath).metadata()` for output verification.

**Apply to:** `tests/main/image-worker.sharpen.spec.ts` — same scaffold (beforeEach mkdtempSync, afterEach rmSync, no mocks, direct `runExport` call). Replaces on-disk `fixtures/EXPORT_PROJECT/images/CIRCLE.png` with synthetic in-test `Buffer.alloc(64 * 64 * 4)` edge fixture per RESEARCH §"Fixture choice" — keeps the test isolated from existing Phase 6 / Phase 22 golden tests.

### Phase 8 D-146 Backward-Compat-Additive (NO schema bump)

**Source:** `version: 1 as const` in `src/core/project-file.ts:76` — never bumps for additive optional fields with safe defaults. `loaderMode` (Phase 21) and `documentation` (Phase 8 → Phase 20 reserved-slot promotion) both followed this pattern.

**Apply to:** `sharpenOnExport` — strictly additive optional with default-on-missing. `version: 1` UNCHANGED.

---

## No Analog Found

(none — every file in this phase has an exact same-locus precedent; the phase is mechanically derivative)

---

## Metadata

**Analog search scope:**
- `src/main/image-worker.ts` (self — :430-462 unified try/catch as both call-site analog AND DRY refactor target)
- `src/shared/types.ts` (Phase 21 loaderMode at :740/:779/:802; Phase 6 Gap-Fix overwrite at :921-925)
- `src/core/project-file.ts` (Phase 21 loaderMode three-touch at :174-186/:281-302/:321-367/:377-407)
- `src/renderer/src/modals/OptimizeDialog.tsx` (self — :366-379 + :402-422 layout precedent; existing :223-227 IPC call extension)
- `src/renderer/src/components/AppShell.tsx` (Phase 9 samplingHzLocal at :254/:345/:715/:803/:829)
- `src/main/project-io.ts` (Phase 21 loaderMode site-1/2 at :402-417/:502/:551-553)
- `src/main/ipc.ts` (Phase 6 overwrite handleStartExport at :532-665, ipcMain.handle registration at :685-687)
- `src/preload/index.ts` (Phase 6 startExport bridge at :98-99)
- `tests/main/image-worker.integration.spec.ts` (Phase 6 real-bytes integration template; full file)
- `tests/core/project-file.spec.ts` (Phase 21 loaderMode 3-test block at :310-372)
- `.planning/REQUIREMENTS.md` (OPT/PANEL/QA section structure at :13-37, traceability table at :67-84)
- `.planning/ROADMAP.md` (Phase 27 detail block as nearest detail-section template)

**Files scanned:** ~12 source/test, ~3 doc

**Pattern extraction date:** 2026-05-06

**Notes for the planner:**
- Every concrete excerpt in this map is sourced from a **single** Read of the analog file — no speculative patterns, no abstract advice. Line numbers are accurate at the 2026-05-06 commit on `main`.
- The DRY `applyResizeAndSharpen` helper is the single locus where SHARP-02 + SHARP-03 invariants live. The regression test in `tests/main/image-worker.sharpen.spec.ts` asserts on the helper's externally-observable behavior (variance + byte-identity), not on its internal structure — that's robust to future refactors of the helper as long as the contract holds.
- The `OptimizeOptions` envelope alternative (RESEARCH Q1 Option B) is REJECTED in this map per RESEARCH's recommendation — inline 4th arg to `startExport` is the lighter-touch precedent.
