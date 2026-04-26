---
name: Phase 6 — Optimize Assets (image export) Pattern Map
description: Per-file pattern assignments mapping every new + touched Phase 6 file to its closest existing analog in the codebase. Concrete excerpts with line numbers; planner cites these directly in PLAN.md <action> blocks.
phase: 6
---

# Phase 6: Optimize Assets (image export) — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 14 (7 new, 7 modified)
**Analogs found:** 13 / 14 (one new pattern: `tests/main/*` directory does not yet exist; one analog quality is "no exact match" for `image-worker.ts` because no main-process file currently uses `node:fs/promises` or `webContents.send`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/export.ts` (new) | service / pure-TS fold | transform | `src/core/usage.ts` + `src/core/analyzer.ts` | exact (Layer-3 fold-then-format pattern) |
| `src/main/image-worker.ts` (new) | worker / orchestrator | streaming + file-I/O + event-driven | `src/main/ipc.ts` (handler shape) + `src/core/loader.ts` (fs sync) | role-match only — no exact analog for `webContents.send` + `node:fs/promises` |
| `src/renderer/src/modals/OptimizeDialog.tsx` (new) | component / modal | event-driven + request-response | `src/renderer/src/modals/OverrideDialog.tsx` | exact (clone target — D-81 ARIA pattern) |
| `src/renderer/src/lib/export-view.ts` (new — IF renderer builds plan) | utility | transform | `src/renderer/src/lib/overrides-view.ts` | exact (Layer-3 inline-copy pattern, Phase 4 D-75) |
| `tests/core/export.spec.ts` (new) | test | request-response | `tests/core/usage.spec.ts` + `tests/core/analyzer.spec.ts` | exact (vitest pure-TS fixture-driven + hygiene grep) |
| `tests/main/image-worker.spec.ts` (new) | test | streaming + mocking | `tests/core/ipc.spec.ts` (extracted-handler test pattern) | partial — `tests/main/` directory does not yet exist |
| `fixtures/EXPORT_PROJECT/` (new) | fixture | file-I/O | `fixtures/SIMPLE_PROJECT/` | exact (mirror layout: .json + .atlas + images/<name>.png) |
| `src/shared/types.ts` (modified) | model / IPC contract | request-response | existing `UnusedAttachment` block (Phase 5 D-101) | exact (extend with primitive-only IPC types) |
| `src/main/ipc.ts` (modified) | controller / IPC | request-response + event-driven | existing `'skeleton:load'` handler | role-match — extend with new channels (one-way `send` is new pattern) |
| `src/main/summary.ts` (modified) | service | transform | existing `findUnusedAttachments` projection (Phase 5) | exact (single-call-site extension) |
| `src/core/analyzer.ts` (modified — IF needed) | service | transform | self (extend `toDisplayRow`) | exact |
| `src/core/loader.ts` (modified) | service | file-I/O + transform | self (extend `LoadResult` + `sourceDims` build) | exact |
| `src/preload/index.ts` (modified) | bridge / contextBridge | request-response + event-driven | existing `loadSkeletonFromFile` exposure | role-match — `ipcRenderer.on` + `removeListener` is new pattern |
| `src/renderer/src/components/AppShell.tsx` (modified) | component / shell | event-driven | self (existing `dialogState` + override callbacks pattern) | exact |
| `tests/arch.spec.ts` (modified) | test / arch gate | static analysis | existing renderer-→-core grep | exact (extend forbidden-import set) |
| `package.json` (modified) | config | n/a | existing dependencies block | exact |
| `electron-builder.yml` (modified) | config | n/a | existing `asarUnpack: [resources/**]` line | exact (extend the array) |

---

## Pattern Assignments

### `src/core/export.ts` (new — service / pure-TS fold)

**Analog:** `src/core/usage.ts` (Phase 5 — closest fold-by-name pattern) + `src/core/analyzer.ts` (Phase 2 — preformat-label discipline)

**Imports pattern** (from `src/core/usage.ts:59-61`):
```typescript
import type { LoadResult } from './types.js';
import type { SamplerOutput } from './sampler.js';
import type { UnusedAttachment } from '../shared/types.js';
```
Pattern for `export.ts`:
```typescript
import type { DisplayRow, SkeletonSummary, UnusedAttachment, ExportRow, ExportPlan } from '../shared/types.js';
import { applyOverride } from './overrides.js';
```
**Layer-3 hygiene contract:** these are the ONLY allowed imports. NO `node:fs`, NO `node:path`, NO `sharp`, NO `@esotericsoftware/spine-core` runtime values, NO React/DOM. Enforced by `tests/core/usage.spec.ts:278-296` style grep added in `tests/core/export.spec.ts`.

**Header docblock pattern** (from `src/core/usage.ts:1-58` — copy this prose discipline):
- Phase + plan tag in line 1 (e.g. `Phase 6 Plan 02 — Pure-TS export-plan builder (D-108..D-111).`)
- Algorithm section listing each step with the D-decision references
- Callers section
- Layer-3 hygiene paragraph naming the spec file that grep-asserts purity

**Core fold pattern** (from `src/core/usage.ts:76-182` — the `findUnusedAttachments` body shape):

The proven shape is:
1. Build a `Set<string>` of "exclude/used" names (single pass).
2. Walk source data into a `Map<key, accumulator>` (single pass, deterministic order).
3. Apply set-difference / aggregation to produce `Result[]`.
4. Sort with `localeCompare` for deterministic output.
5. Return plain primitive array.

Concrete excerpt to copy from `src/core/usage.ts:80-87` (used-set construction):
```typescript
// --- Used set (Finding #2) ---------------------------------------------
// Read PeakRecord.attachmentName directly. Do NOT split globalPeaks
// composite keys on '/' — attachment names can legally contain slashes
// (folder-prefixed atlas paths; see sampler.ts:304-309).
const usedNames = new Set<string>();
for (const peak of sampler.globalPeaks.values()) {
  usedNames.add(peak.attachmentName);
}
```
Phase 6 analog: build an `excludedUnused: Set<string>` from `summary.unusedAttachments` if `!opts?.includeUnused`.

Concrete excerpt to copy from `src/core/usage.ts:104-144` (Map accumulator with per-name aggregation):
```typescript
const defined = new Map<string, DefinedEntry>();
for (const skin of load.skeletonData.skins) {
  for (let slotIndex = 0; slotIndex < skin.attachments.length; slotIndex++) {
    const perSlot = skin.attachments[slotIndex];
    if (perSlot === undefined || perSlot === null) continue;
    for (const [attachmentName, attachment] of Object.entries(perSlot)) {
      // ... per-row work ...
      let entry = defined.get(attachmentName);
      if (entry === undefined) {
        entry = { definedIn: [], sourceDimsByVariant: new Map() };
        defined.set(attachmentName, entry);
      }
      // ... merge into entry ...
    }
  }
}
```
Phase 6 analog: iterate `summary.peaks` (a `DisplayRow[]`), key by `row.sourcePath` (D-108 source-PNG-path dedup), and update with `max(effectiveScale)` per group:
```typescript
const bySourcePath = new Map<string, { row: DisplayRow; effScale: number; attachmentNames: string[] }>();
for (const row of summary.peaks) {
  if (excludedUnused.has(row.attachmentName)) continue;
  const overridePct = overrides.get(row.attachmentName);
  const effScale = overridePct !== undefined
    ? applyOverride(overridePct).effectiveScale
    : row.peakScale;
  const prev = bySourcePath.get(row.sourcePath);
  if (prev === undefined) {
    bySourcePath.set(row.sourcePath, { row, effScale, attachmentNames: [row.attachmentName] });
  } else {
    if (effScale > prev.effScale) { prev.row = row; prev.effScale = effScale; }
    if (!prev.attachmentNames.includes(row.attachmentName)) prev.attachmentNames.push(row.attachmentName);
  }
}
```

**D-110 round + emit pattern** (analogous to `src/core/usage.ts:154-178`):
```typescript
const rows: ExportRow[] = [];
for (const { row, effScale, attachmentNames } of bySourcePath.values()) {
  // D-110: uniform scale on both axes; Math.round = round-half-away-from-zero.
  const outW = Math.round(row.sourceW * effScale);
  const outH = Math.round(row.sourceH * effScale);
  rows.push({
    sourcePath: row.sourcePath,
    outPath: /* planner: path.posix.join logic — but this file is pure-TS;
                use string concat with '/' separators, NOT node:path which is forbidden. */,
    sourceW: row.sourceW,
    sourceH: row.sourceH,
    outW,
    outH,
    effectiveScale: effScale,
    attachmentNames: attachmentNames.slice(), // defensive copy per usage.ts:172
  });
}
```

**Sort + return pattern** (from `src/core/usage.ts:181-182`):
```typescript
rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
return { rows, excludedUnused: [...excludedUnused].sort(), totals: { count: rows.length } };
```

**Test analog header** (from `tests/core/usage.spec.ts:1-36`):
- Behavior gates listed with D-decision references
- Hygiene gates section enumerating forbidden imports

---

### `src/main/image-worker.ts` (new — worker / orchestrator)

**Analog quality:** ROLE-MATCH ONLY — no existing main-process file streams progress via `webContents.send`, and no existing file uses `node:fs/promises`. The closest existing patterns are `src/main/ipc.ts` (handler-extraction discipline) and `src/core/loader.ts` (fs read with try/catch + typed-error envelope). Planner reconciles the two patterns.

**Imports pattern** (assemble from new + existing):
```typescript
import sharp from 'sharp';                                   // NEW — first sharp import in the codebase
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';  // NEW — promises form
import { dirname, resolve, relative, join } from 'node:path';
import type { ExportPlan, ExportProgressEvent, ExportSummary, ExportError } from '../shared/types.js';
```
**Critical Layer-3 invariant:** This is the ONLY file in `src/` allowed to `import sharp`. Enforced by extending `tests/arch.spec.ts` per the Phase 5 D-100 hygiene grep style.

**Function-extraction discipline** (from `src/main/ipc.ts:42-77`):
```typescript
export async function handleSkeletonLoad(jsonPath: unknown): Promise<LoadResponse> {
  // T-01-02-01: input validation at the trust boundary.
  if (typeof jsonPath !== 'string' || jsonPath.length === 0 || !jsonPath.endsWith('.json')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: `Invalid path argument: ...` },
    };
  }
  try {
    // ... happy path ...
    return { ok: true, summary };
  } catch (err) {
    if (err instanceof SpineLoaderError && KNOWN_KINDS.has(err.name as KnownErrorKind)) {
      return { ok: false, error: { kind: err.name as KnownErrorKind, message: err.message } };
    }
    return { ok: false, error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) } };
  }
}
```
Phase 6 analog: extract `runExport(plan, outDir, onProgress, isCancelled): Promise<ExportSummary>` so the body is testable in vitest WITHOUT spinning up Electron — `registerIpcHandlers()` then wraps it for the IPC channel. This mirrors the `handleSkeletonLoad` ↔ `registerIpcHandlers` split exactly.

**Per-row try/catch + typed-error envelope** (from `src/core/loader.ts:99-104` + `src/main/ipc.ts:62-77`):
```typescript
// loader.ts:99-104 pattern — catch fs read failure and translate to typed error
let jsonText: string;
try {
  jsonText = fs.readFileSync(skeletonPath, 'utf8');
} catch {
  throw new SkeletonJsonNotFoundError(skeletonPath);
}
```
Phase 6 analog (per ExportRow):
```typescript
// Pre-flight per D-112
try {
  await access(row.sourcePath, fsConstants.R_OK);
} catch {
  const err: ExportError = { kind: 'missing-source', path: row.sourcePath, message: `Source file not readable: ${row.sourcePath}` };
  onProgress({ index: i, total: plan.rows.length, path: row.sourcePath, outPath: row.outPath, status: 'error', error: err });
  errors.push(err);
  continue;
}

// Path-traversal defense per Threat-Model-Lite
const resolvedOut = resolve(outDir, row.outPath);
const rel = relative(resolve(outDir), resolvedOut);
if (rel.startsWith('..') || rel === '' || resolvedOut === resolve(outDir)) {
  const err: ExportError = { kind: 'write-error', path: row.outPath, message: `Output path escapes outDir: ${row.outPath}` };
  onProgress({ /* ... */ });
  errors.push(err);
  continue;
}

// Atomic write per D-121
try {
  await mkdir(dirname(resolvedOut), { recursive: true });
  await sharp(row.sourcePath)
    .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(resolvedOut + '.tmp');
  await rename(resolvedOut + '.tmp', resolvedOut);
  onProgress({ index: i, total: plan.rows.length, path: row.sourcePath, outPath: resolvedOut, status: 'success' });
  successes++;
} catch (e) {
  // Discriminate sharp-error vs write-error: sharp throws before .toFile lands;
  // fs.rename throws after. Test the in-flight phase to label correctly.
  const kind: ExportError['kind'] = /* planner: simplest is `'sharp-error'` for any throw inside the try */;
  const err: ExportError = { kind, path: row.outPath, message: e instanceof Error ? e.message : String(e) };
  onProgress({ /* ... */ });
  errors.push(err);
}
```

**Cancellation loop pattern** (no existing analog — new pattern; cite RESEARCH.md §"System Architecture Diagram" as the spec):
```typescript
for (let i = 0; i < plan.rows.length; i++) {
  if (isCancelled()) break; // D-115: stop new dispatch; in-flight has already completed.
  const row = plan.rows[i];
  // ... per-row work above ...
}
return { successes, errors, outputDir: outDir, durationMs: performance.now() - t0, cancelled: isCancelled() };
```
**`performance.now()` timing pattern** copied verbatim from `src/main/ipc.ts:55-58`:
```typescript
const t0 = performance.now();
// ... work ...
const elapsedMs = performance.now() - t0;
```

**Sharp call signature** (verbatim per F8.2 + RESEARCH.md §F8.2 verification):
```typescript
sharp(srcPath)
  .resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(outPath);
```

---

### `src/renderer/src/modals/OptimizeDialog.tsx` (new — component / modal)

**Analog:** `src/renderer/src/modals/OverrideDialog.tsx` (DIRECT CLONE TARGET — Phase 4 D-81 ARIA pattern)

**Imports pattern** (from `OverrideDialog.tsx:43`):
```typescript
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
```
Phase 6 additions: `import clsx from 'clsx';` for conditional status-icon class composition (already a project dep per `package.json:devDependencies`); `import type { ExportPlan, ExportProgressEvent, ExportSummary } from '../../../shared/types.js';`

**Header docblock pattern** (from `OverrideDialog.tsx:1-42`): copy verbatim, swap "Phase 4 Plan 02" → "Phase 6 Plan 04", swap "percentage-input modal" → "two-state export progress modal", keep the 5-numbered-points UX list with Phase 6 specifics:
1. Hand-rolled per D-81; no modal library.
2. Two states: pre-flight (file list + Start) and in-progress/complete (linear bar + per-file checklist).
3. ESC closes; overlay click closes; Enter on Start triggers export start.
4. Tailwind v4 literal-class discipline (Pitfall 8): every className is a string literal.
5. Two-weight typography (font-normal default, font-semibold for primary action).

**ARIA modal scaffold** (copy from `OverrideDialog.tsx:85-97` verbatim, swap title id):
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="optimize-title"
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onClick={props.onCancel}
>
  <div
    className="bg-panel border border-border rounded-md p-6 min-w-[640px] font-mono"
    onClick={(e) => e.stopPropagation()}
    onKeyDown={keyDown}
  >
    <h2 id="optimize-title" className="text-sm text-fg mb-4">
      {title}
    </h2>
    {/* state-conditional body */}
  </div>
</div>
```
Note: `min-w-[640px]` upgraded from OverrideDialog's `min-w-[360px]` for the wider file list. Other classes byte-identical.

**Keyboard handler** (from `OverrideDialog.tsx:80-83`):
```typescript
const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
  if (e.key === 'Enter') apply();           // Phase 6: trigger Start when in pre-flight
  if (e.key === 'Escape') props.onCancel();
};
```

**Auto-focus on open** (from `OverrideDialog.tsx:59-66`):
```typescript
useEffect(() => {
  if (props.open) {
    inputRef.current?.focus();
    inputRef.current?.select();
  }
}, [props.open]);
```
Phase 6 analog: focus the primary action button (`Start` in pre-flight, `Close` in complete state) so ESC + Enter wiring works without a manual click.

**Footer button class vocabulary** (from `OverrideDialog.tsx:115-151`):
```tsx
<div className="flex gap-2 mt-6 justify-end">
  {/* secondary */}
  <button type="button" onClick={...} className="border border-border rounded-md px-3 py-1 text-xs">
    Cancel
  </button>
  {/* primary */}
  <button type="button" onClick={...} className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold">
    Start
  </button>
</div>
```
Phase 6 swaps:
- Pre-flight: `Cancel` (secondary) + `Start` (primary, font-semibold)
- In-progress: `Cancel` (secondary only)
- Complete: `Open output folder` (secondary) + `Close` (primary)

**Subscribe to progress events** (NEW pattern — from RESEARCH.md §Pattern 3):
```typescript
useEffect(() => {
  const unsub = window.api.onExportProgress((event) => {
    setProgress((prev) => ({ ...prev, current: event.index, total: event.total, lastEvent: event }));
    setRowStatuses((prev) => new Map(prev).set(event.outPath, event.status));
    if (event.status === 'error' && event.error) {
      setRowErrors((prev) => new Map(prev).set(event.outPath, event.error));
    }
  });
  return unsub;
}, []);
```

**Error row color** (Phase 5 D-104 token): use class `text-[color:var(--color-danger)]` on the error icon and the inline-expanded error message. Token already declared in `src/renderer/src/index.css` per CONTEXT.md.

---

### `src/renderer/src/lib/export-view.ts` (new — IF renderer builds plan)

**Analog:** `src/renderer/src/lib/overrides-view.ts` (Layer-3 inline copy, Phase 4 D-75)

**Decision gate:** This file exists IFF the planner decides the renderer builds the ExportPlan client-side from local `summary` + `overrides`. Two options:
- **Option A (recommended per RESEARCH.md §Architectural Responsibility Map last row):** renderer imports `buildExportPlan` from a renderer-side inline copy at `src/renderer/src/lib/export-view.ts`. Mirrors Phase 4 D-75 exactly.
- **Option B:** Plan is built in main, returned via the `pickOutputDirectory` IPC round-trip. No renderer copy needed. Simpler arch-spec story but adds an IPC payload size tradeoff.

**If Option A is chosen, copy this file structure verbatim** (from `src/renderer/src/lib/overrides-view.ts:1-49`):
```typescript
/**
 * Phase 6 Plan ?? — renderer-side inline copy of the canonical
 * export-plan builder (D-108..D-111).
 *
 * Layer 3 resolution (inline duplicate — option 1 from 04-PATTERNS.md
 * §"Shared Patterns / Layer 3"). The tests/arch.spec.ts grep at lines
 * 19-34 forbids any renderer file from taking a dependency on the
 * pure-TS math tree. Because the AppShell builds the plan from local
 * summary + overrides before invoking startExport, the renderer gets
 * its own byte-identical copy here instead of crossing the boundary.
 *
 * Parity contract: the exported function body in this file is
 * byte-identical to the canonical source module. If you modify one,
 * modify the other in the same commit. A parity describe block in the
 * matching test module asserts sameness on N sampled inputs plus
 * signature greps against both file contents.
 */
```

**Parity-test pattern** (from `tests/core/overrides.spec.ts:155-194`):
```typescript
describe('core ↔ renderer parity (Layer 3 option-1 invariant)', () => {
  const coreText = readFileSync(CORE_SRC, 'utf8');
  const viewText = readFileSync(VIEW_SRC, 'utf8');

  it('renderer view reports the same buildExportPlan result across N sampled inputs', () => {
    // pick representative summary + overrides combos
    const cases = [/* ... */];
    for (const c of cases) {
      expect(buildExportPlanView(c.summary, c.overrides)).toEqual(buildExportPlan(c.summary, c.overrides));
    }
  });

  it('both files share the same fold-key signature', () => {
    const sig = /const\s+bySourcePath\s*=\s*new\s+Map/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });
});
```

---

### `tests/core/export.spec.ts` (new — vitest pure-TS test)

**Analog:** `tests/core/usage.spec.ts` (cases-by-D-decision style + hygiene grep block) + `tests/core/analyzer.spec.ts:23-87` (fixture-driven case structure)

**Imports pattern** (from `tests/core/usage.spec.ts:37-49`):
```typescript
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildExportPlan } from '../../src/core/export.js';
```

**Fixture path constant pattern** (from `tests/core/usage.spec.ts:51-53`):
```typescript
const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const EXPORT_SRC = path.resolve('src/core/export.ts');
```
Phase 6 additions: `const FIXTURE_EXPORT = path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json');` if a dedicated fixture is needed; otherwise reuse SIMPLE_TEST.

**Behavior-gate header pattern** (from `tests/core/usage.spec.ts:1-36`): copy the prose block listing each case (a)-(g) with D-decision references. Concretely the cases per CONTEXT.md:
- (a) SIMPLE_TEST → 4 ExportRows; effective scale = peakScale; dims = `Math.round(sourceW × peakScale)`
- (b) override 50% on TRIANGLE → out dims = `Math.round(sourceW × 0.5)`
- (c) override 200% on SQUARE → applyOverride clamps → out dims = `sourceW × 1.0`
- (d) two attachments share atlas region with different peaks → ExportRow.outW = `Math.round(sourceW × max(peaks))`
- (e) ghost fixture → ExportPlan.rows excludes GHOST; ExportPlan.excludedUnused includes 'GHOST'
- (f) `Math.round(127.5)` half-rounding behavior locked
- (g) hygiene grep — no fs/sharp/spine-core imports

**Hygiene grep pattern** (from `tests/core/usage.spec.ts:277-297` — copy verbatim, swap module name):
```typescript
describe('export — module hygiene (N2.3, D-100)', () => {
  it('N2.3: src/core/export.ts has no node:fs / node:path / node:child_process / node:net / node:http / sharp imports', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });

  it('export: src/core/export.ts exports buildExportPlan by name', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).toMatch(/export\s+function\s+buildExportPlan/);
  });

  it('CLAUDE.md #5: src/core/export.ts has no DOM references', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
});
```

**Synthetic builder pattern** (from `tests/core/usage.spec.ts:85-180` — `buildSynthetic` helper):
For cases (c) and (d) where SIMPLE_TEST doesn't naturally produce the configuration, copy the in-memory `SkeletonData` builder pattern. Lines 95-180 of `tests/core/usage.spec.ts` are the most reusable testbed in the codebase — it bypasses sampler internals and lets the test specify peak records directly.

---

### `tests/main/image-worker.spec.ts` (new — first test in `tests/main/`)

**Analog quality:** PARTIAL — `tests/main/` directory does NOT yet exist. Closest existing pattern is `tests/core/ipc.spec.ts` (extracted-handler test pattern — same strategy, different layer).

**Directory creation:** Plan creates `tests/main/.gitkeep` first or just lands the spec file. Vitest auto-discovers per its default glob.

**Strategy pattern** (from `tests/core/ipc.spec.ts:1-19` header):
> Handler-invocation strategy: the IPC handler body is extracted as a standalone async function `handleSkeletonLoad(jsonPath): Promise<LoadResponse>` in `ipc.ts`; `registerIpcHandlers()` wires that function into `ipcMain.handle('skeleton:load', ...)`. These tests invoke the function directly — no Electron dependency in the test process.

Phase 6 analog: invoke `runExport(plan, outDir, onProgress, isCancelled)` directly. No Electron import; no `webContents.send` (the wiring is tested via the `onProgress` callback which is the SAME shape the IPC handler will pass).

**Mocking strategy:**
- **sharp:** use `vi.mock('sharp', () => ({ default: vi.fn(() => ({ resize: vi.fn().mockReturnThis(), png: vi.fn().mockReturnThis(), toFile: vi.fn().mockResolvedValue(undefined) })) }))` — the chain is `sharp(...).resize(...).png(...).toFile(...)` so `mockReturnThis` covers the fluent calls.
- **node:fs/promises:** use `vi.mock('node:fs/promises', () => ({ access: vi.fn(), mkdir: vi.fn().mockResolvedValue(undefined), rename: vi.fn().mockResolvedValue(undefined) }))` — toggle `access` to throw for missing-source cases.

**Test cases per CONTEXT.md:**
- (a) all-success → emits N events all `'success'`, summary has 0 errors
- (b) one missing source → emits `'missing-source'` for that path + continues, others succeed
- (c) sharp throws on file 3 of 5 → emits `'sharp-error'`, files 4-5 still process
- (d) cancel flag set after file 2 → file 2 in-flight finishes, file 3 not started
- (e) atomic write — assert `<outPath>.tmp` was the toFile target, then `rename(<outPath>.tmp, <outPath>)` was called
- (f) re-entrant `export:start` rejected (`'already-running'` typed error)

**Tmpdir pattern** (from `tests/core/ipc.spec.ts:60-74`):
```typescript
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-'));
// ... test work ...
try {
  // ...
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

---

### `fixtures/EXPORT_PROJECT/` (new — dedicated fixture)

**Analog:** `fixtures/SIMPLE_PROJECT/`

**Layout** (from `ls fixtures/SIMPLE_PROJECT/`):
```
SIMPLE_TEST.json
SIMPLE_TEST.atlas
SIMPLE_TEST.png         # the actual atlas page PNG
SIMPLE_TEST_GHOST.json  # variant with GHOST attachment
SIMPLE_TEST_GHOST.atlas
```
Phase 6 needs source PNGs PER ATLAS REGION (not the packed atlas page) so the export pipeline has bytes to resize. Recommended layout per CONTEXT.md "fixtures/EXPORT_PROJECT/" line:
```
EXPORT.json
EXPORT.atlas
EXPORT.png                # packed atlas page (existing pattern)
images/
  CIRCLE.png              # source pre-pack PNG, dim matching atlas region originalWidth/originalHeight
  SQUARE.png
  SQUARE2.png
  TRIANGLE.png
```
Resolution rule (per RESEARCH.md §Pattern 2): atlas region name `FOO/BAR` → `<skeletonDir>/images/FOO/BAR.png`. Subfolders supported.

**Decision gate:** Planner picks whether the four `images/*.png` files are:
- Real PNGs (e.g. solid-colored 256×256 squares generated via sharp at fixture-build time — adds a dev dep on running sharp during test setup, OR commit byte-identical pre-built PNGs).
- Synthesized via a one-time `scripts/build-export-fixture.ts` that the planner adds + runs once, committing the output.

The simplest path: hand-craft 4 small PNGs with a paint tool, commit verbatim. SIMPLE_TEST.png in the existing fixture is already committed bytes (no script).

---

### `src/shared/types.ts` (modified — IPC contract extension)

**Analog:** existing `UnusedAttachment` interface at lines 95-129 (Phase 5 D-101 single-call-site extension)

**Extension pattern** (from `src/shared/types.ts:95-129` for prose discipline + lines 130-163 for IPC integration):
- Each new interface gets a docblock referencing the D-decision number.
- All fields primitive / arrays of primitives — structuredClone-safe (line 8 invariant).
- Add new interfaces ABOVE `SkeletonSummary` so the summary type can reference them.
- For new IPC channels: extend `Api` interface at lines 197-199 inline.

**Concrete new interfaces** (planner places these in `src/shared/types.ts` between line 129 and 130):
```typescript
/**
 * Phase 6 Plan 01 — One row of the export plan, deduped per atlas region
 * source PNG path (D-108). attachmentNames carries every attachment that
 * resolved to this region for traceability — does not affect the resize
 * itself (one ExportRow → one resize → one output PNG per D-108).
 *
 * All fields primitive — structuredClone-safe per the file-top docblock
 * D-21 lock.
 */
export interface ExportRow {
  /** Absolute path to the source PNG on disk (resolved at load time). */
  sourcePath: string;
  /** Output relative path under outDir, preserves images/ layout per F8.3. */
  outPath: string;
  sourceW: number;
  sourceH: number;
  outW: number;
  outH: number;
  effectiveScale: number;
  attachmentNames: string[];
}

export interface ExportPlan {
  rows: ExportRow[];
  excludedUnused: string[];
  totals: { count: number };
}

export interface ExportError {
  kind: 'missing-source' | 'sharp-error' | 'write-error';
  path: string;
  message: string;
}

export interface ExportProgressEvent {
  index: number;
  total: number;
  path: string;
  outPath: string;
  status: 'success' | 'error';
  error?: ExportError;
}

export interface ExportSummary {
  successes: number;
  errors: ExportError[];
  outputDir: string;
  durationMs: number;
  cancelled: boolean;
}

/** Discriminated-union result returned from `'export:start'` IPC handler — mirrors LoadResponse pattern (D-10). */
export type ExportResponse =
  | { ok: true; summary: ExportSummary }
  | { ok: false; error: { kind: 'already-running' | 'invalid-out-dir' | 'Unknown'; message: string } };
```

**`Api` interface extension** (extend `src/shared/types.ts:197-199`):
```typescript
export interface Api {
  loadSkeletonFromFile: (file: File) => Promise<LoadResponse>;
  // Phase 6 additions per D-118 / D-119 / D-120
  pickOutputDirectory: (defaultPath?: string) => Promise<string | null>;
  startExport: (plan: ExportPlan, outDir: string) => Promise<ExportResponse>;
  cancelExport: () => void;
  onExportProgress: (handler: (e: ExportProgressEvent) => void) => () => void;
  openOutputFolder: (dir: string) => void;
}
```

**Critical: `DisplayRow` extension required** (per RESEARCH.md §Planning Blockers #3). Add `sourcePath: string` to `DisplayRow` at line 30. This is the SINGLE biggest data-plumbing change in Phase 6 and must be threaded through `src/core/loader.ts` → `src/main/summary.ts` → `src/core/analyzer.ts`. Pattern for the field addition is the Phase 5 D-101 single-call-site extension (lines 95-129 surface, lines 70-94 integration).

---

### `src/main/ipc.ts` (modified — extend with new channels)

**Analog:** self — extend the existing `'skeleton:load'` handler.

**Existing handler shape** (from `src/main/ipc.ts:79-81`):
```typescript
export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
}
```

**Phase 6 extension pattern:**
```typescript
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { runExport } from './image-worker.js';
// ...

// Module-private state for cancel flag + re-entrancy guard (D-115 + D-116).
// Per CONTEXT.md: "Reject re-entrant export:start while one is running".
let exportInFlight = false;
let exportCancelFlag = false;

export async function handlePickOutputDirectory(defaultPath?: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    defaultPath,
    // RESEARCH.md §Phase Requirements F8.1: include both for cross-platform.
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

export async function handleStartExport(
  evt: Electron.IpcMainInvokeEvent,
  plan: ExportPlan,
  outDir: string,
): Promise<ExportResponse> {
  if (exportInFlight) {
    return { ok: false, error: { kind: 'already-running', message: 'An export is already in progress.' } };
  }
  // D-122 + Threat-Model-Lite: validate outDir is not source images/ or a child.
  // ... validation ...
  exportInFlight = true;
  exportCancelFlag = false;
  const wc = evt.sender; // BrowserWindow webContents that initiated the call
  try {
    const summary = await runExport(
      plan,
      outDir,
      (e) => wc.send('export:progress', e),
      () => exportCancelFlag,
    );
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) } };
  } finally {
    exportInFlight = false;
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
  // Phase 6 channels
  ipcMain.handle('dialog:pick-output-dir', async (_evt, defaultPath) => handlePickOutputDirectory(defaultPath));
  ipcMain.handle('export:start', async (evt, plan, outDir) => handleStartExport(evt, plan, outDir));
  ipcMain.on('export:cancel', () => { exportCancelFlag = true; });  // one-way
  ipcMain.on('shell:open-folder', (_evt, dir) => shell.showItemInFolder(dir)); // one-way
}
```

**Input-validation discipline** (from `src/main/ipc.ts:42-52`): every handler that receives renderer-origin arguments validates them at the boundary. Phase 6 must do the same for `plan` (shape check) and `outDir` (path check).

**Information-disclosure discipline** (from `src/main/ipc.ts:62-77`): error responses surface only `name + message`, never stack traces. Apply identically to ExportError.

---

### `src/main/summary.ts` (modified — thread sourcePath into DisplayRow)

**Analog:** self — extend `buildSummary` per the Phase 5 D-101 single-call-site extension pattern (lines 70-74).

**Existing extension precedent** (from `src/main/summary.ts:70-74`):
```typescript
// Phase 5 Plan 02 — F6.1 unused-attachment detection. Pure projection per
// D-35 / D-101: the core module owns the algorithm; summary.ts just
// threads the result into the IPC payload.
const unusedAttachments = findUnusedAttachments(load, sampled);
```
Then added to the return object at line 94:
```typescript
return {
  // ... existing fields ...
  unusedAttachments,
  elapsedMs,
};
```

**Phase 6 analog:** if the planner determines `sourcePath` resolution belongs in the loader (per RESEARCH.md §Pattern 2), `loader.ts` populates `LoadResult.sourcePaths: Map<string, string>` (region name → absolute path). Then `analyzer.toDisplayRow` reads it and threads it into each row. Summary is unchanged in shape — just the DisplayRow gains a field.

Alternative (per RESEARCH.md): summary.ts itself does the resolution by computing `path.join(path.dirname(load.skeletonPath), 'images', regionName + '.png')` per row and merging into the analyzer output. Layer-3 stays clean because summary.ts is allowed to import `node:path` (it's main-process).

**Recommended path:** thread through `loader.ts` (single source of truth for path resolution; closest analog is the existing `sourceDims` map at `loader.ts:161-173`).

---

### `src/core/analyzer.ts` (modified — IF source path threaded via DisplayRow)

**Analog:** self — extend `toDisplayRow` at lines 65-90.

**Existing field-addition pattern** (from `src/core/analyzer.ts:65-90`):
```typescript
function toDisplayRow(p: PeakRecord): DisplayRow {
  return {
    // raw fields (sort + selection in the panel; CLI reads these directly)
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    // ... 14 more fields ...
    // preformatted labels (D-35, D-45, D-46) — single point of truth
    originalSizeLabel: `${p.sourceW}×${p.sourceH}`,
    // ... 4 more labels ...
  };
}
```

**Phase 6 addition:** `sourcePath` is a raw field, not a label. Analyzer can't compute it from PeakRecord alone — needs `LoadResult.sourcePaths` (or equivalent) injected. Two options:

- **A:** Extend `analyze(peaks, sourcePaths)` signature. CLI also calls analyze; planner verifies `scripts/cli.ts` doesn't break (Phase 5 D-102 byte-for-byte CLI lock).
- **B:** Sampler (Phase 0) carries `sourcePath` on PeakRecord. Sampler is LOCKED per CLAUDE.md fact #3 — DO NOT modify.

**Recommended:** Option A. Add a second optional parameter to `analyze` defaulted to `undefined`, threaded through `toDisplayRow`. CLI keeps calling `analyze(peaks)` without args; main-side summary calls `analyze(peaks, load.sourcePaths)`.

Hygiene-grep concern: this lets `src/core/analyzer.ts` accept a `Map<string, string>` for paths but does NOT introduce any Layer-3 violation. Pure data flow.

---

### `src/core/loader.ts` (modified — add sourcePaths resolution)

**Analog:** self — extend the existing `sourceDims` build at lines 161-173.

**Existing pattern** (from `src/core/loader.ts:161-173`):
```typescript
const sourceDims = new Map<string, SourceDims>();
for (const region of atlas.regions) {
  const packedW = region.width;
  // ... compute origW/origH/source ...
  sourceDims.set(region.name, { w: origW, h: origH, source: hasExplicitOrig ? 'atlas-orig' : 'atlas-bounds' });
}
```

**Phase 6 extension** (verbatim from RESEARCH.md §Pattern 2):
```typescript
const imagesDir = path.join(path.dirname(skeletonPath), 'images');
const sourcePaths = new Map<string, string>();
for (const region of atlas.regions) {
  // Spine convention: region.name maps to <imagesDir>/<region.name>.png.
  // Region names can contain '/' for subfolders.
  sourcePaths.set(region.name, path.join(imagesDir, region.name + '.png'));
}
```
**Where to add:** immediately after the `sourceDims` map build (loader.ts:173). NO `fs.access` check at load time — pre-flight in image-worker handles missing files per D-112.

**Return object extension** (from `loader.ts:182-189`):
```typescript
return {
  skeletonPath: path.resolve(skeletonPath),
  atlasPath: path.resolve(atlasPath),
  skeletonData,
  atlas,
  sourceDims,
  sourcePaths,    // NEW
  editorFps,
};
```

**Type extension in `src/core/types.ts:32-55`:** add `sourcePaths: Map<string, string>` to `LoadResult` immediately after `sourceDims` (line 46-47), with a comment mirroring the `sourceDims` docblock prose.

---

### `src/preload/index.ts` (modified — extend api object)

**Analog:** self — existing `api` object at lines 32-51

**Existing pattern** (from `src/preload/index.ts:29-51`):
```typescript
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, LoadResponse } from '../shared/types.js';

const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) {
      return { ok: false, error: { kind: 'Unknown', message: '...' } };
    }
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },
};
```

**Phase 6 extension** (one method per IPC channel):
```typescript
const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => { /* existing */ },

  // Phase 6 — request/response (use ipcRenderer.invoke)
  pickOutputDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),

  startExport: (plan, outDir) =>
    ipcRenderer.invoke('export:start', plan, outDir),

  // Phase 6 — one-way (use ipcRenderer.send)
  cancelExport: () => {
    ipcRenderer.send('export:cancel');
  },
  openOutputFolder: (dir: string) => {
    ipcRenderer.send('shell:open-folder', dir);
  },

  // Phase 6 — subscription (use ipcRenderer.on + return unsubscribe)
  // Pattern verbatim from RESEARCH.md §Pattern 3.
  onExportProgress: (handler) => {
    const wrapped = (_evt: unknown, event: ExportProgressEvent) => handler(event);
    ipcRenderer.on('export:progress', wrapped);
    return () => ipcRenderer.removeListener('export:progress', wrapped);
  },
};
```

**Sandbox-discipline reminder** (from `src/preload/index.ts:24-28`): preload runs under `sandbox: true`. Type-only imports from `../shared/types.js` are fine (erased at compile time). NO new runtime npm dep can be added to preload — sharp lives in main only.

**`Api` interface bridge** (no changes needed in `src/preload/index.d.ts:1-22` — it auto-picks up the extended Api from shared/types.ts).

---

### `src/renderer/src/components/AppShell.tsx` (modified — toolbar button + dialog mount)

**Analog:** self — existing `dialogState` lifecycle at lines 60-65 + dialog mount at lines 172-182.

**Existing dialog-state pattern** (from `AppShell.tsx:60-65`):
```typescript
// D-77 dialog lifecycle — null means dialog closed.
const [dialogState, setDialogState] = useState<{
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
} | null>(null);
```

**Phase 6 analog** (parallel state, NOT merged with `dialogState` per CONTEXT.md "exportDialogState (or merges into existing dialogState)" — recommendation: separate to keep the two modal lifecycles independent):
```typescript
const [exportDialogState, setExportDialogState] = useState<{
  plan: ExportPlan;
  outDir: string;
} | null>(null);
const [exportInFlight, setExportInFlight] = useState(false);
```

**Existing toolbar pattern** (from `AppShell.tsx:130-152` — the `<header>` block with filename chip + tab nav):
```tsx
<header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
  <span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg">
    {summary.skeletonPath}
  </span>
  <nav role="tablist" className="flex gap-1 items-center">
    {/* TabButton x2 */}
  </nav>
</header>
```

**Phase 6 extension** (insert after the `<nav>` block, right-aligned per D-117):
```tsx
<header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
  <span className="...">{summary.skeletonPath}</span>
  <nav role="tablist" className="...">{/* tabs */}</nav>

  {/* D-117: persistent toolbar button right-aligned next to filename chip.
      Disabled while export running. Reuses warm-stone tokens from Phase 1 D-12/D-14. */}
  <div className="ml-auto">
    <button
      type="button"
      onClick={onClickOptimize}
      disabled={exportInFlight || summary.peaks.length === 0}
      className="border border-border rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
    >
      Optimize Assets
    </button>
  </div>
</header>
```
Class vocabulary borrowed from `OverrideDialog.tsx:144-150` (primary-button styling: `border-border rounded-md px-3 py-1 text-xs font-semibold`). NOTE: project uses bg-accent on primary action only when on solid panel — the toolbar button is visually a secondary action; planner picks `border` + `font-semibold` (semibold for emphasis without filling).

**Two-step click handler** (from D-118):
```typescript
const onClickOptimize = useCallback(async () => {
  // D-122: pre-fill with <skeletonDir>/images-optimized/
  const skeletonDir = summary.skeletonPath.replace(/\/[^/]+$/, '');
  const defaultPath = `${skeletonDir}/images-optimized`;
  const outDir = await window.api.pickOutputDirectory(defaultPath);
  if (outDir === null) return; // user cancelled picker
  // Build plan client-side (Option A from PATTERNS export-view.ts gate above).
  const plan = buildExportPlan(summary, overrides);
  setExportDialogState({ plan, outDir });
}, [summary, overrides]);
```

**Dialog mount** (from `AppShell.tsx:172-182`):
```tsx
{dialogState !== null && (
  <OverrideDialog
    open={true}
    scope={dialogState.scope}
    {/* ... */}
    onCancel={() => setDialogState(null)}
  />
)}
```
Phase 6 analog (insert after the OverrideDialog mount):
```tsx
{exportDialogState !== null && (
  <OptimizeDialog
    open={true}
    plan={exportDialogState.plan}
    outDir={exportDialogState.outDir}
    onClose={() => setExportDialogState(null)}
    onRunStart={() => setExportInFlight(true)}
    onRunEnd={() => setExportInFlight(false)}
  />
)}
```

**Layer-3 import discipline** (from `AppShell.tsx:43`):
```typescript
import { clampOverride } from '../lib/overrides-view.js';
```
Phase 6 IF Option A (renderer builds plan): `import { buildExportPlan } from '../lib/export-view.js';` — NEVER `from '../../core/export.js'` (would trip arch.spec.ts:25 grep).

---

### `tests/arch.spec.ts` (modified — extend Layer-3 grep)

**Analog:** self — existing renderer→core grep at lines 19-34.

**Existing pattern** (from `tests/arch.spec.ts:19-34`):
```typescript
describe('Architecture boundary: renderer must not import from src/core (CLAUDE.md Fact #5)', () => {
  it('no renderer file imports from src/core', () => {
    const files = globSync('src/renderer/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*\/core\/|from ['"]@core/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Renderer files importing core: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

**Phase 6 extension** — add a new describe block enforcing Layer-3 in the OPPOSITE direction (core must not import sharp/fs):
```typescript
describe('Architecture boundary: src/core must not import sharp / node:fs / node:fs/promises (CLAUDE.md Fact #5 + Phase 6 lock)', () => {
  it('no core file imports sharp or node:fs (sync or promises)', () => {
    const files = globSync('src/core/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      // loader.ts already imports node:fs sync — exempt as legacy Phase 0 carve-out (CLAUDE.md fact #5 inverse: load-time fs is allowed).
      // Planner decides: keep loader.ts exempt by name OR move loader fs reads to main-process. Simplest is name-exemption.
      if (file.endsWith('loader.ts')) continue;
      const text = readFileSync(file, 'utf8');
      if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Core files importing sharp/node:fs: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

NOTE: `loader.ts:30` already has `import * as fs from 'node:fs';` — this is Phase 0's Layer-3-allowed exception (load-time fs read for the JSON; CLAUDE.md fact #4 says math phase doesn't decode PNGs but loader is the file-load phase). Planner verifies whether to:
- **Option A:** add `loader.ts` to an exemption set in the new grep
- **Option B:** move loader's fs reads to main-process (large refactor, NOT in Phase 6 scope)

Recommended: Option A — name-based exemption keeps Phase 6 focused.

---

### `package.json` (modified — add sharp dependency)

**Analog:** existing `dependencies` block at lines 13-18.

**Existing pattern** (from `package.json:13-18`):
```json
"dependencies": {
  "@esotericsoftware/spine-core": "^4.2.0",
  "@fontsource/jetbrains-mono": "^5.2.8",
  "react": "^19.2.5",
  "react-dom": "^19.2.5"
}
```

**Phase 6 extension:**
```json
"dependencies": {
  "@esotericsoftware/spine-core": "^4.2.0",
  "@fontsource/jetbrains-mono": "^5.2.8",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "sharp": "^0.34.5"
}
```
Pin `^0.34.5` per RESEARCH.md §Standard Stack verification (latest stable 2026-04-24, ships @img/* prebuilt binaries for darwin-arm64/darwin-x64/win32-x64/linux-x64, Node-API v9 → Electron 41 N-API v10+ compatible).

Install command: `npm install sharp@^0.34.5`. Generates lockfile diff — planner commits both `package.json` + `package-lock.json` in the same commit per project convention.

---

### `electron-builder.yml` (modified — extend asarUnpack)

**Analog:** self — existing `asarUnpack` block at line 32.

**Existing pattern** (from `electron-builder.yml`):
```yaml
asarUnpack:
  - resources/**
```

**Phase 6 extension** (per RESEARCH.md §"Three non-trivial findings" #1 — sharp 0.34.5 restructured native bindings into @img/* scoped packages):
```yaml
asarUnpack:
  - resources/**
  - "**/node_modules/sharp/**/*"
  - "**/node_modules/@img/**/*"
```
**Critical:** BOTH globs are required. Sharp 0.34's `dlopen` resolves through `@img/sharp-{platform}-{arch}` packages; without unpacking those, packaged `.dmg` throws `dlopen` errors at first sharp import. Verify post-build by inspecting `.app` for `Resources/app.asar.unpacked/node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node`.

---

## Shared Patterns

### Layer-3 Inline Copy (Phase 4 D-75 inheritance)

**Source:** `src/renderer/src/lib/overrides-view.ts` (49 lines, byte-identical to `src/core/overrides.ts:49-101`)
**Apply to:** `src/renderer/src/lib/export-view.ts` IFF Option A (renderer builds plan)
**Parity-test source:** `tests/core/overrides.spec.ts:155-194`

The pattern:
1. Renderer file is a verbatim function-body copy of the canonical core module.
2. Zero imports in the renderer copy (same discipline as canonical).
3. A `describe('core ↔ renderer parity ...')` block in the spec file:
   - Asserts identical results across N representative inputs.
   - Asserts both files have zero imports via grep.
   - Asserts shared signature snippets (e.g., the same function declarations).

### IPC Typed-Error Envelope (Phase 1 D-10 inheritance)

**Source:** `src/main/ipc.ts:42-77` (`handleSkeletonLoad`) + `src/shared/types.ts:176-184` (`SerializableError` + `LoadResponse`)
**Apply to:** `'export:start'` handler — `ExportResponse` mirrors `LoadResponse` shape exactly:
```typescript
export type ExportResponse =
  | { ok: true; summary: ExportSummary }
  | { ok: false; error: { kind: 'already-running' | 'invalid-out-dir' | 'Unknown'; message: string } };
```

The envelope discipline:
- Renderer-origin args validated at the boundary (T-01-02-01).
- Errors surface only `name + message`, never stack traces (T-01-02-02).
- Discriminated union `{ ok: true, ... } | { ok: false, error }`.

### structuredClone-Safe IPC Payloads (Phase 1 D-21 inheritance)

**Source:** `src/shared/types.ts:1-17` (file-top docblock invariant)
**Apply to:** ExportRow, ExportPlan, ExportProgressEvent, ExportError, ExportSummary, ExportResponse — all primitives / arrays / nested plain objects. NO Map, NO Float32Array, NO class instances. The Map<string, number> overrides used in the renderer is renderer-side only and is iterated in `buildExportPlan` BEFORE crossing IPC.

### Hygiene Grep Block (Phase 2/4/5 inheritance)

**Source:** `tests/core/overrides.spec.ts:129-153` + `tests/core/usage.spec.ts:277-296`
**Apply to:** `tests/core/export.spec.ts` — copy the describe block verbatim, swap the constants:
```typescript
const EXPORT_SRC = path.resolve('src/core/export.ts');

describe('export — module hygiene (N2.3, Phase 6 Layer 3 lock)', () => {
  it('N2.3: no node:fs / node:path / node:child_process / node:net / node:http imports', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  });
  it('Phase 6: no sharp import', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
  it('CLAUDE.md #5: no DOM references', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
});
```

### Tailwind v4 Literal-Class Discipline

**Source:** `OverrideDialog.tsx` header docblock §4 (lines 22-27) + every className in lines 86-152
**Apply to:** `OptimizeDialog.tsx` (every className must be a string literal). Conditional rendering via early-return `null` when `!props.open` (lines 68) rather than class toggling. For status icons in the per-file checklist, use `clsx` with literal branches per the existing `AppShell.tsx:208-211` pattern:
```tsx
<span className={clsx(
  'inline-block w-3 text-center',
  status === 'success' && 'text-fg',
  status === 'error' && 'text-[color:var(--color-danger)]',
  status === 'in-progress' && 'text-fg-muted animate-pulse',
  status === 'idle' && 'text-fg-muted',
)} />
```

---

## No Analog Found

| File | Role | Data Flow | Reason | Mitigation |
|------|------|-----------|--------|------------|
| `src/main/image-worker.ts` (sharp + fs/promises + webContents.send) | worker / streaming | streaming + file-I/O + event-driven | No existing main-process file streams progress; no file uses `node:fs/promises`; sharp is a brand-new dep | Combine `src/main/ipc.ts` extracted-handler discipline + `src/core/loader.ts` fs try/catch + RESEARCH.md §Pattern 1/3 verbatim |
| `tests/main/image-worker.spec.ts` | test / first in `tests/main/` | streaming + mocking | `tests/main/` directory does not yet exist | Create `tests/main/` with `.gitkeep` style; reuse `tests/core/ipc.spec.ts:60-74` tmpdir pattern + new vi.mock for sharp + node:fs/promises |
| `src/renderer/src/lib/export-view.ts` (Option A only) | utility / Layer-3 inline copy | transform | Exact analog exists (`overrides-view.ts`); listed for visibility — planner picks A vs B | If Option A: clone overrides-view.ts file structure verbatim; if Option B: skip this file entirely |

---

## Metadata

**Analog search scope:**
- `src/core/**` (9 files)
- `src/main/**` (3 files)
- `src/preload/**` (2 files)
- `src/renderer/**` (10 files)
- `src/shared/**` (1 file)
- `tests/**` (10 files)
- `fixtures/**` (3 fixture dirs)
- `electron-builder.yml`, `package.json`, `tsconfig.*` configs

**Files scanned:** 38 source + test + config files
**Pattern extraction date:** 2026-04-24

**Phase Boundary Reminder:**
- Pure-TS: `src/core/export.ts` only (per CLAUDE.md fact #5).
- sharp + fs/promises: `src/main/image-worker.ts` only.
- Renderer: NEVER reaches main directly; only via preload contextBridge.
- Sampler (`src/core/sampler.ts`) LOCKED — Phase 6 makes ZERO sampler changes (CLAUDE.md fact #3).
- CLI (`scripts/cli.ts`) LOCKED — Phase 5 D-102 byte-for-byte (no `--export` flag).

*Pattern map for: 06-optimize-assets-image-export*
*Mapped 2026-04-24 via /gsd-plan-phase 6 → gsd-pattern-mapper*
