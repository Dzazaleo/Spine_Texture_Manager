---
name: Phase 1 — Electron + React scaffold Pattern Map
description: Concrete pattern assignments for every new/modified file in Phase 1 — closest in-repo analogs extracted as line-numbered code excerpts; files with no in-repo analog routed explicitly to the canonical starter paths cited in RESEARCH.md Finding #3.
phase: 1
---

# Phase 1: Electron + React scaffold — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 22 (19 new, 3 modified)
**Analogs found:** in-repo match for 6 / 22; the remaining 16 have **NO IN-REPO ANALOG** and must follow the canonical `@alex8088/quick-start/react-ts` starter layout verbatim (RESEARCH.md Finding #3 — verified by researcher).

**Key context:** This is the first UI phase. The working repo contains `src/core/*`, `scripts/cli.ts`, `tests/core/*`, `tsconfig.json`, `package.json`, `vitest.config.ts`, `.gitignore` — and nothing else. Electron, React, Vite, Tailwind, and electron-builder are all net-new surface area. Wherever a true in-repo analog exists (module layout, CLI-dump logic, typed-error branching, IPC projection shape, Wave-0 test format), the analog IS load-bearing and must be copied exactly. Wherever no analog exists, the canonical starter is the authoritative source; do NOT invent a new layout.

---

## File Classification

| File | New/Modified | Role | Data Flow | Analog Source | Match Quality |
|------|--------------|------|-----------|---------------|---------------|
| `electron.vite.config.ts` | new | config | build-time | Canonical starter `electron.vite.config.ts` | NO IN-REPO ANALOG |
| `electron-builder.yml` | new | config | build-time | Canonical starter `electron-builder.yml` | NO IN-REPO ANALOG |
| `tsconfig.json` | modified | config | build-time | `tsconfig.json` (current) + canonical starter references-only shape | partial (current is the target of the rewrite) |
| `tsconfig.node.json` | new | config | build-time | Canonical starter `tsconfig.node.json` | NO IN-REPO ANALOG |
| `tsconfig.web.json` | new | config | build-time | Canonical starter `tsconfig.web.json` | NO IN-REPO ANALOG |
| `src/main/index.ts` | new | main-process entry | app-lifecycle / event-driven | Canonical starter `src/main/index.ts` | NO IN-REPO ANALOG |
| `src/main/ipc.ts` | new | main-process handler | request-response (IPC) | `scripts/cli.ts` (typed-error branching, lifecycle: load→sample→project) + `src/core/errors.ts` (error hierarchy) | role-match + data-flow-match |
| `src/main/summary.ts` | new | service (pure projection) | transform | `scripts/cli.ts` `renderTable()` + `main()` (shapes sampler/loader output for presentation) | role-match (pure transform of the same inputs) |
| `src/preload/index.ts` | new | preload (contextBridge) | bridge | Canonical starter `src/preload/index.ts` (RESEARCH Pattern 1) | NO IN-REPO ANALOG |
| `src/preload/index.d.ts` | new | type declaration (global augmentation) | types-only | Canonical starter `src/preload/index.d.ts` | NO IN-REPO ANALOG |
| `src/shared/types.ts` | new | shared types | types-only | `src/core/types.ts` (module docstring style, named-export interface pattern, no-runtime-code rule) | role-match (pure type module, same repo convention) |
| `src/renderer/index.html` | new | HTML entry | static | Canonical starter `src/renderer/index.html` | NO IN-REPO ANALOG |
| `src/renderer/src/main.tsx` | new | React root | bootstrap | Canonical starter `src/renderer/src/main.tsx` | NO IN-REPO ANALOG |
| `src/renderer/src/App.tsx` | new | component (top-level state machine) | event-driven (`useState`) | Canonical starter `src/renderer/src/App.tsx` (structure) + RESEARCH Pattern 5 wiring | NO IN-REPO ANALOG |
| `src/renderer/src/index.css` | new | stylesheet (Tailwind v4 `@theme`) | static | RESEARCH Pattern 4 + canonical starter `src/renderer/src/assets/main.css` | NO IN-REPO ANALOG |
| `src/renderer/src/components/DropZone.tsx` | new | component | event-driven (DragEvent → IPC) | RESEARCH Pattern 5 | NO IN-REPO ANALOG |
| `src/renderer/src/components/DebugPanel.tsx` | new | component (CLI-style dump) | transform (summary → `<pre>`) | **`scripts/cli.ts` — `renderTable()` lines 77–126** (LOAD-BEARING, exact port) | **exact** |
| `tests/core/summary.spec.ts` | new | test (Wave 0) | unit | `tests/core/loader.spec.ts` (module docstring, `describe(..., req-id)` pattern, `expect().toBeInstanceOf` for typed-error checks) | exact (same vitest style) |
| `tests/core/ipc.spec.ts` | new | test (Wave 0) | unit (import-forcing / error-envelope) | `tests/core/loader.spec.ts` (typed-error assertions, fixture resolution pattern) | exact |
| `tests/arch.spec.ts` | new | test (Wave 0 — architectural grep) | unit (fs-grep) | `tests/core/loader.spec.ts` (vitest shape) + RESEARCH.md "Enforcing core/ ↛ renderer/" (canonical grep regex) | role-match + canonical ref |
| `package.json` | modified | config | build-time | `package.json` (current — we ADD to it) | partial (target of modification) |
| `.gitignore` | modified | config | build-time | `.gitignore` (current — we ADD to it) | partial (target of modification) |

**Legend:** *exact* = same role + data flow + in-repo; *role-match* = same role, compatible data flow; *partial* = the file itself is the analog (we're modifying it in place); *NO IN-REPO ANALOG* = greenfield, use the canonical starter path cited.

---

## Pattern Assignments

### `src/shared/types.ts` (shared types, types-only)

**Analog:** `src/core/types.ts` (in-repo, role-match — same "pure type module, compile-time erased" convention).

**Module-docstring pattern** (copy the "contract-for-downstream-consumers" framing):

`src/core/types.ts` lines 1–13:
```typescript
/**
 * Shared types for the Phase 0 headless core-math module.
 *
 * These shapes are the contracts consumed by plans 00-02..00-06:
 *   - `LoadResult` is the return shape of `loadSkeleton()` in `loader.ts`.
 *   - `SourceDims` is how per-region source (pre-pack) dimensions are exposed.
 *   - `SampleRecord` is the per-tick row the sampler writes into peak tables.
 *   - `AABB` is the world-space box type from `bounds.ts`.
 *   - `LoaderOptions` lets callers override the atlas discovery rule.
 *
 * These interfaces erase at compile time. They are pure type shapes — no runtime
 * code lives in this file.
 */
```

**Adapt for `src/shared/types.ts` as:** "Shared IPC types for the Phase 1 Electron shell. These shapes are the contracts crossing the main↔preload↔renderer boundary. Consumed by `src/main/*`, `src/preload/*`, `src/renderer/*`. These interfaces erase at compile time. They are pure type shapes — no runtime code lives in this file."

**Named-interface-export pattern** (no default exports, each interface annotated with a JSDoc line — NOT a paragraph):

`src/core/types.ts` lines 20–24:
```typescript
export interface LoaderOptions {
  /** Override the atlas path. Defaults to sibling `.atlas` next to the JSON. */
  atlasPath?: string;
}
```

**Apply to `SkeletonSummary`, `PeakRecordSerializable`, `LoadResponse`, `SerializableError`, `Api`:** each field gets a one-line `/** */` comment; no class definitions, no runtime guards, no enum values — pure interfaces and union types only.

**Discriminated-union return-type pattern** (from CONTEXT.md D-10 specifics and mirrored in `src/core/types.ts`'s literal string union):

`src/core/types.ts` lines 28–30 (the `source: 'atlas-orig' | 'atlas-bounds'` field) demonstrates the in-repo convention for string-literal discriminants:
```typescript
  /** Provenance: 'atlas-orig' when the region supplies an `orig` size; 'atlas-bounds' when we fell back to packed `bounds` W×H. */
  source: 'atlas-orig' | 'atlas-bounds';
```

**Apply to `SerializableError.kind`:**
```typescript
kind: 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown';
```

**Error-name-string-must-match-class-name invariant** (LOAD-BEARING): the string literals in `SerializableError.kind` MUST be byte-identical to the `name` property values in `src/core/errors.ts` — else IPC's `err.name` discriminator won't match:

`src/core/errors.ts` lines 20–45:
```typescript
export class SkeletonJsonNotFoundError extends SpineLoaderError {
  constructor(public readonly path: string) {
    super(`Spine skeleton JSON not found or not readable: ${path}`);
    this.name = 'SkeletonJsonNotFoundError';         // ← must match SerializableError.kind literal
  }
}

export class AtlasNotFoundError extends SpineLoaderError {
  // ...
  this.name = 'AtlasNotFoundError';                  // ← must match
}

export class AtlasParseError extends SpineLoaderError {
  // ...
  this.name = 'AtlasParseError';                     // ← must match
}
```

**PeakRecordSerializable flattening source:** the field set must match the in-repo `PeakRecord` in `src/core/sampler.ts` lines 87–90 (which extends `SampleRecord` in `src/core/types.ts` lines 64–86). Copy every primitive field verbatim; DO NOT include Map/Float32Array/class fields. The canonical field list is (from `src/core/types.ts` `SampleRecord` + `PeakRecord`):

`src/core/types.ts` lines 64–86 + `src/core/sampler.ts` lines 87–90:
```typescript
// SampleRecord fields (all primitives — safe to serialize):
attachmentKey: string;
skinName: string;
slotName: string;
attachmentName: string;
animationName: string;       // "Setup Pose (Default)" for setup pass
time: number;                 // seconds
frame: number;                // round(time * editorFps)
peakScaleX: number;
peakScaleY: number;
peakScale: number;
worldW: number;
worldH: number;
sourceW: number;
sourceH: number;
// + PeakRecord adds:
isSetupPosePeak: boolean;
```

**Import-style pattern** (from `src/core/types.ts` line 15–18 and `src/core/sampler.ts` line 53):
```typescript
import type { ... } from './foo.js';   // note the `.js` extension — required by "moduleResolution: bundler" + NodeNext ESM
```
The `.js` extension on relative imports is a load-bearing repo convention (all of `src/core/` uses it; breaks compilation if omitted). Apply to any cross-module relative import in `src/shared/`, `src/main/`, `src/preload/` — NOT to `@esotericsoftware/spine-core` bare specifiers.

---

### `src/main/summary.ts` (service, pure projection/transform)

**Analog:** `scripts/cli.ts` (in-repo, role-match — same "take `loadSkeleton` + `sampleSkeleton` outputs and project into a presentable shape" data flow).

**What `cli.ts` does that `buildSummary` must do:** traverse `peaks: Map<string, PeakRecord>`, sort deterministically, flatten to a plain array, derive extra metadata (counts, elapsed) from `load: LoadResult`. `cli.ts` renders to text; `buildSummary` renders to JSON. Same projection, different target.

**Core projection pattern** — how `cli.ts` pulls `Map<string, PeakRecord>` into a sorted array:

`scripts/cli.ts` lines 88–92:
```typescript
const sorted = [...peaks.values()].sort((a, b) => {
  if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
  if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
  return a.attachmentName.localeCompare(b.attachmentName);
});
```

**Apply to `buildSummary`:** the `peaks` array in `SkeletonSummary` SHOULD be sorted by the same `(skin, slot, attachment)` tuple so DebugPanel output matches CLI row order byte-for-byte (required by the manual smoke test in RESEARCH.md §Validation Architecture — "table matching CLI output exactly").

**Per-record flattening pattern** — `cli.ts` does this to strings; `buildSummary` does the same to JSON objects:

`scripts/cli.ts` lines 93–105 — shows the field order and per-record composition for the CLI table (ingested from `PeakRecord`):
```typescript
for (const rec of sorted) {
  const worldW = rec.worldW.toFixed(1);
  const worldH = rec.worldH.toFixed(1);
  rows.push([
    `${rec.slotName}/${rec.attachmentName}`,
    rec.skinName,
    `${rec.sourceW}×${rec.sourceH}`,
    `${worldW}×${worldH}`,
    rec.peakScale.toFixed(3),
    rec.animationName,
    String(rec.frame),
  ]);
}
```

**Apply to `buildSummary`:** map each `PeakRecord` to `PeakRecordSerializable` with the explicit field list above (PeakRecordSerializable flattening source). DO NOT spread `...rec` — that'd include class internals; enumerate fields explicitly. The shape is already shown in RESEARCH.md lines 510–526 and should be copied from there.

**Elapsed-ms measurement pattern** (from `scripts/cli.ts` lines 141–143):
```typescript
const t0 = performance.now();
const peaks = sampleSkeleton(load, { samplingHz: args.samplingHz });
const elapsed = performance.now() - t0;
```

**Apply to `buildSummary` caller chain in `src/main/ipc.ts`:** measure around `loadSkeleton + sampleSkeleton` (RESEARCH Pattern 2 shows this correctly); pass `elapsedMs` into `buildSummary(load, peaks, elapsedMs)` as the third argument. The elapsed number feeds the summary footer "Elapsed: 9.4 ms (120 Hz sampling)" referenced in CONTEXT.md `<specifics>` line 375.

**Counts-from-skeletonData pattern** (`buildSummary` pulls bones/slots/skins/animations counts from `skeletonData` — shown in RESEARCH lines 500–544):
- `skeletonData.bones`, `.slots`, `.skins`, `.animations` are arrays on the spine-core `SkeletonData` instance (imported as type from `src/core/types.ts`).
- Walk skins → `skin.attachments` (array of Maps per slot) → count attachments and bucket by `attachment.constructor.name` to build the `byType: Record<string, number>` field.

**File signature (lock this):**
```typescript
export function buildSummary(
  load: LoadResult,
  peaks: Map<string, PeakRecord>,
  elapsedMs: number,
): SkeletonSummary;
```

Pure function. No IO. No side effects. No console.log. Output must survive `structuredClone()` — this is the test gate in `tests/core/summary.spec.ts` (see below).

---

### `src/main/ipc.ts` (main-process IPC handler, request-response)

**Analog:** `scripts/cli.ts` (in-repo, exact-match on data flow — same "parse argv/IPC → `loadSkeleton` → `sampleSkeleton` → shape output → catch typed errors → exit/return") + `src/core/errors.ts` (the error hierarchy the handler catches).

**Typed-error branching pattern** (the load-bearing bit — this is how `cli.ts` decides exit codes, and IPC will do the same to decide the response envelope):

`scripts/cli.ts` lines 137–159:
```typescript
try {
  const load = loadSkeleton(args.skeletonPath, {
    atlasPath: args.atlasPath,
  });
  const t0 = performance.now();
  const peaks = sampleSkeleton(load, { samplingHz: args.samplingHz });
  const elapsed = performance.now() - t0;

  process.stdout.write(renderTable(peaks) + '\n');
  process.stdout.write(
    `\nSampled in ${elapsed.toFixed(1)} ms at ${args.samplingHz} Hz ` +
      `(${peaks.size} attachments across ${load.skeletonData.skins.length} skins, ` +
      `${load.skeletonData.animations.length} animations)\n`,
  );
  process.exit(0);
} catch (e) {
  if (e instanceof SpineLoaderError) {
    process.stderr.write(`${e.name}: ${e.message}\n`);      // ← e.name = 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError'
    process.exit(3);
  }
  process.stderr.write(`Unexpected error: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
}
```

**Apply to `ipcMain.handle('skeleton:load', ...)`:** the exit-code branching becomes envelope-kind branching.
- `e instanceof SpineLoaderError` + `e.name` ∈ known set → `{ ok: false, error: { kind: e.name, message: e.message } }`.
- else → `{ ok: false, error: { kind: 'Unknown', message: err.message } }`.
- success → `{ ok: true, summary: buildSummary(load, peaks, elapsedMs) }`.

The CLI's `process.exit(3)` is the direct equivalent of returning `{ ok: false, error: { kind: ... } }` — same branch point, different sink. RESEARCH Pattern 2 (lines 443–480) shows the exact IPC adaptation verbatim; copy that.

**Imports pattern** (copied from `scripts/cli.ts` lines 24–30):
```typescript
import { loadSkeleton } from '../src/core/loader.js';       // CLI uses '../src/...' because it lives in scripts/
import {
  sampleSkeleton,
  DEFAULT_SAMPLING_HZ,
  type PeakRecord,
} from '../src/core/sampler.js';
import { SpineLoaderError } from '../src/core/errors.js';
```

**Apply to `src/main/ipc.ts`:** paths become `../core/loader.js`, `../core/sampler.js`, `../core/errors.js` (one level up, not two). Same `.js` extension convention. Type-only imports (`import type { ... }`) for `PeakRecord`, `LoadResult`, `LoadResponse` — these erase at compile time and don't affect the bundle.

**Discriminated-error-kind guard** (RESEARCH Pattern 2 lines 454–459, reproduced for completeness since it's load-bearing for the envelope):
```typescript
type KnownErrorKind = SerializableError['kind'];
const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);
```
This guard is necessary because a future `SpineLoaderError` subclass with an unknown `.name` should fall through to `kind: 'Unknown'` rather than producing a kind the renderer can't discriminate.

**Handler-registration pattern** (from canonical starter + RESEARCH Pattern 2): export a single `registerIpcHandlers()` function; `src/main/index.ts` calls it once in `app.whenReady()`. Don't register at import time (order-dependency risk with `app` not-yet-ready).

---

### `src/renderer/src/components/DebugPanel.tsx` (component, transform)

**Analog:** **`scripts/cli.ts`** — EXACT MATCH. The DebugPanel's `<pre>` dump body is a direct port of `renderTable()`. CONTEXT.md D-16 locks this: "CLI-style peak-scale table — exact replica of `scripts/cli.ts` output, rendered as a `<pre>`."

**Core pattern to port — `renderTable` header + sort + body**:

`scripts/cli.ts` lines 77–126 (the ENTIRE function, load-bearing for Phase 1 DebugPanel output):
```typescript
function renderTable(peaks: Map<string, PeakRecord>): string {
  const rows: string[][] = [];
  rows.push([
    'Attachment',
    'Skin',
    'Source W×H',
    'Peak W×H',
    'Scale',
    'Source Animation',
    'Frame',
  ]);
  const sorted = [...peaks.values()].sort((a, b) => {
    if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
    if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
    return a.attachmentName.localeCompare(b.attachmentName);
  });
  for (const rec of sorted) {
    const worldW = rec.worldW.toFixed(1);
    const worldH = rec.worldH.toFixed(1);
    rows.push([
      `${rec.slotName}/${rec.attachmentName}`,
      rec.skinName,
      `${rec.sourceW}×${rec.sourceH}`,
      `${worldW}×${worldH}`,
      rec.peakScale.toFixed(3),
      rec.animationName,
      String(rec.frame),
    ]);
  }

  // Compute column widths.
  const cols = rows[0].length;
  const widths = new Array<number>(cols).fill(0);
  for (const r of rows) {
    for (let c = 0; c < cols; c++) {
      if (r[c].length > widths[c]) widths[c] = r[c].length;
    }
  }

  // Two-space column separator (no pipes) — keeps output diff-friendly for the
  // smoke checker in plan 07.
  const pad = (s: string, w: number) => s + ' '.repeat(w - s.length);
  const out: string[] = [];
  out.push(rows[0].map((s, i) => pad(s, widths[i])).join('  '));
  out.push(widths.map((w) => '-'.repeat(w)).join('  '));
  for (let i = 1; i < rows.length; i++) {
    out.push(rows[i].map((s, j) => pad(s, widths[j])).join('  '));
  }
  return out.join('\n');
}
```

**Port mechanics for `DebugPanel.tsx`:**
1. The input changes from `Map<string, PeakRecord>` to `PeakRecordSerializable[]` (already sorted in the array — `buildSummary` preserves sort order per the `summary.ts` pattern above). Remove the `[...peaks.values()].sort(...)` step — `buildSummary` did that.
2. The output changes from `string` (joined with `'\n'`) to a JSX `<pre className="font-mono">{tableText}</pre>` — where `tableText` is the same string built by the same algorithm.
3. Preserve the two-space column separator, the dash-underline row, and the exact header labels (`Attachment | Skin | Source W×H | Peak W×H | Scale | Source Animation | Frame`). These are locked by CONTEXT.md D-16 + CLI Contract (00-CONTEXT.md §"CLI Contract").
4. Use the Unicode `×` (U+00D7 MULTIPLICATION SIGN) for dimension strings — copy the literal from `cli.ts` line 99 (`${rec.sourceW}×${rec.sourceH}`).

**Header block** (the text above the table — CONTEXT.md `<specifics>` lines 362–366):
```
Skeleton: /path/to/SIMPLE_TEST.json
Atlas:    /path/to/SIMPLE_TEST.atlas
Bones:    9   Slots: 5   Attachments: 4 (region:3 mesh:1)
Skins:    default
Animations: 4 — idle, jump, physics, setup
```
This header has no exact in-repo analog (CLI doesn't print it — it only prints the table + footer). Compose it from `SkeletonSummary` fields directly. The `Attachments: 4 (region:3 mesh:1)` breakdown comes from `summary.attachments.byType` (a `Record<string, number>` keyed by `attachment.constructor.name` e.g. `'RegionAttachment'` → display as `region:N`).

**Console echo** (CONTEXT.md D-17): inside the same component (or the effect in `App.tsx`), call `console.log(tableText)` AND `console.log(summary)` after a successful load. Satisfies ROADMAP exit criterion "dumps the skeleton summary … to the console and to a debug panel."

**Monospace requirement** — the `<pre>` MUST use `font-mono` (Tailwind class), which resolves to `--font-mono: "JetBrains Mono", ui-monospace, ...` via the `@theme` block in `src/renderer/src/index.css` (CONTEXT.md `<specifics>` line 286).

---

### `tests/core/summary.spec.ts` (test, unit)

**Analog:** `tests/core/loader.spec.ts` (in-repo, exact-match on vitest style, module docstring, requirement-ID-in-describe, `expect().toBeInstanceOf` for typed-error branches).

**Module-docstring pattern** (copy the "requirement ID → test intent" mapping):

`tests/core/loader.spec.ts` lines 1–19:
```typescript
/**
 * Phase 0 Plan 05 — Tests for `src/core/loader.ts`.
 *
 * Behavior gates pulled from the plan's `<behavior>` block:
 *   - F1.1 + F1.2: Loading the fixture returns a LoadResult with sourceDims keys
 *     {CIRCLE, SQUARE, TRIANGLE} and the sibling .atlas auto-detected.
 *   - F2.7 (priority 1, atlas-bounds provenance): ...
 *   - F1.4 (typed errors):
 *       * Non-existent JSON path → SkeletonJsonNotFoundError.
 *       * JSON whose sibling .atlas is absent → AtlasNotFoundError;
 *         error.searchedPath ends with '.atlas'.
 *
 * The loader tests do not duplicate smoke coverage from bounds.spec.ts or
 * sampler.spec.ts — they lock the specific contract surface (sourceDims shape,
 * typed error hierarchy, atlas auto-detect) into CI independently of downstream
 * modules.
 */
```

**Apply for `summary.spec.ts`:** "Phase 1 Plan X — Tests for `src/main/summary.ts` (buildSummary projection). Behavior gates: D-21 (SkeletonSummary shape — bones.count/slots.count/attachments.byType/skins.names/animations.names all populated), D-22 (PeakRecordSerializable is structuredClone-safe — no Map/Float32Array/class instances). These tests lock the IPC serialization contract independently of the IPC handler in ipc.spec.ts."

**Imports pattern** (copied from `tests/core/loader.spec.ts` lines 20–28):
```typescript
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
// — new for summary.spec.ts: —
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
```

**Fixture-path pattern** (copied from `tests/core/loader.spec.ts` line 30):
```typescript
const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
```

**describe(...)-with-req-IDs pattern** (copied from `tests/core/loader.spec.ts` line 32):
```typescript
describe('loader (F1.1, F1.2, F1.4)', () => { ... });
// Apply as:
describe('buildSummary (D-21, D-22)', () => { ... });
```

**Core test pattern — deep equality + structuredClone round-trip** (NEW — no direct analog since Phase 0 didn't cross an IPC boundary; pattern is RESEARCH.md §Validation Architecture line 973 "structuredClone(summary) returns equal object"):
```typescript
it('D-22: buildSummary output survives structuredClone', () => {
  const load = loadSkeleton(FIXTURE);
  const peaks = sampleSkeleton(load);
  const summary = buildSummary(load, peaks, 0);
  const cloned = structuredClone(summary);
  expect(cloned).toEqual(summary);         // no class instances, no Map, no Float32Array
});
```

**Shape-assertion pattern** (adapt from `tests/core/loader.spec.ts` lines 41–65 which asserts `sourceDims` field-by-field):
```typescript
it('D-21: buildSummary populates bones/slots/attachments/skins/animations from SkeletonData', () => {
  const load = loadSkeleton(FIXTURE);
  const peaks = sampleSkeleton(load);
  const s = buildSummary(load, peaks, 0);

  expect(s.bones.count).toBe(9);                       // SIMPLE_TEST fixture — 9 bones
  expect(s.slots.count).toBe(5);
  expect(s.skins.names).toContain('default');
  expect(s.animations.names.length).toBeGreaterThan(0);
  expect(s.peaks.length).toBe(4);                      // CIRCLE/SQUARE/SQUARE2/TRIANGLE
});
```

Counts above come from the Phase 0 fixture (CLAUDE.md §Test fixture + CONTEXT.md `<specifics>` lines 367–377 debug dump example).

---

### `tests/core/ipc.spec.ts` (test, unit / IPC handler direct invocation)

**Analog:** `tests/core/loader.spec.ts` (in-repo, exact on structure + typed-error assertion style).

**Handler-invocation strategy** (from RESEARCH §Validation Architecture line 985 "spawns ipcMain.handle in a test harness OR directly imports the handler function and invokes it (simpler)" — go with the simpler option):

Don't actually instantiate Electron's `ipcMain`. Instead, the handler body should be extracted into a standalone async function (e.g. `handleSkeletonLoad(jsonPath: string): Promise<LoadResponse>`) and `registerIpcHandlers()` wires that function into `ipcMain.handle('skeleton:load', ...)`. Tests call `handleSkeletonLoad` directly — no Electron dependency in test process.

**Happy-path test pattern** (adapt from `tests/core/loader.spec.ts` lines 33–39):
```typescript
it('F1-integrated: happy path returns { ok: true, summary: {...} }', async () => {
  const resp = await handleSkeletonLoad(FIXTURE);
  expect(resp.ok).toBe(true);
  if (resp.ok) {
    expect(resp.summary.bones.count).toBe(9);
    expect(resp.summary.peaks.length).toBe(4);
  }
});
```

**Error-envelope test pattern** (adapt from `tests/core/loader.spec.ts` lines 67–70 — where Phase 0 asserts `toThrow(SkeletonJsonNotFoundError)`; Phase 1 asserts the envelope instead):
```typescript
it('D-10: bogus path returns { ok: false, error: { kind: "SkeletonJsonNotFoundError" } }', async () => {
  const resp = await handleSkeletonLoad('/tmp/does-not-exist-XYZ.json');
  expect(resp.ok).toBe(false);
  if (!resp.ok) {
    expect(resp.error.kind).toBe('SkeletonJsonNotFoundError');
    expect(resp.error.message).toContain('not found');
  }
});
```

**Missing-atlas test pattern** (copy verbatim from `tests/core/loader.spec.ts` lines 72–94 — the `fs.mkdtempSync` + `writeFileSync('{}')` setup — only change the assertion from `toThrow` to envelope inspection):
```typescript
it('D-10: missing atlas returns { ok: false, error: { kind: "AtlasNotFoundError" } }', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-ipc-'));
  const jsonPath = path.join(tmpDir, 'rig.json');
  fs.writeFileSync(jsonPath, '{}');
  try {
    const resp = await handleSkeletonLoad(jsonPath);
    expect(resp.ok).toBe(false);
    if (!resp.ok) expect(resp.error.kind).toBe('AtlasNotFoundError');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

**Import-forcing purpose** (from upstream prompt "IPC shape import forcing"): the test file SHOULD import from `src/main/ipc.ts` + `src/shared/types.ts` at the top so that any type drift (e.g. `LoadResponse.ok` renamed to `success`) fails the test compile. Same trick `tests/core/loader.spec.ts` uses by importing `AtlasNotFoundError` + `SkeletonJsonNotFoundError` — if those get renamed, the test file fails to typecheck and the CI gate catches it.

---

### `tests/arch.spec.ts` (test, unit — fs-grep / architectural guard)

**Analog:** `tests/core/loader.spec.ts` (vitest shape only) + RESEARCH.md §"Enforcing core/ ↛ renderer/ Boundary" lines 840–860 (the canonical grep regex).

**Core grep pattern** (copy the regex verbatim — it's the canonical one that correctly catches both `'../core/'` relative imports and `'@core/...'` aliased imports; RESEARCH lines 842–859):
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';    // Node 22+; if unavailable, add fast-glob

describe('Architecture boundary: renderer must not import from src/core', () => {
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

**Additional portability grep** (D-23 — same file, separate `it(...)` block; RESEARCH Validation Architecture line 970):
```typescript
it('portability: no process.platform / os.platform / macOS-only window chrome in src/', () => {
  const files = globSync('src/{main,preload,renderer}/**/*.{ts,tsx}');
  const forbidden = /process\.platform|os\.platform\(\)|titleBarStyle:\s*['"]hiddenInset['"]|trafficLightPosition|vibrancy:|visualEffectState/;
  const offenders: string[] = [];
  for (const file of files) {
    if (forbidden.test(readFileSync(file, 'utf8'))) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
```

**Describe-style pattern** — use a descriptive string naming the architectural invariant, not a requirement ID (because these are cross-cutting invariants, not requirements):
```typescript
describe('Architecture boundary: renderer must not import from src/core', ...);
describe('Portability: no platform-specific code in src/', ...);
```

---

### `src/preload/index.ts` (preload, contextBridge) — NO IN-REPO ANALOG

**Canonical starter source:** `@alex8088/quick-start/packages/create-electron/playground/react-ts/src/preload/index.ts` (RESEARCH Finding #3 line 213 confirms verbatim-fetched).

**Pattern (RESEARCH Pattern 1 lines 400–430 — verbatim-copyable):**
```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, LoadResponse } from '../shared/types';

const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) {
      return {
        ok: false,
        error: { kind: 'Unknown', message: 'Dropped file has no filesystem path (not backed by a disk file).' },
      };
    }
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Failed to expose api via contextBridge:', error);
  }
} else {
  (window as unknown as { api: Api }).api = api;
}
```

**Load-bearing detail:** `webUtils.getPathForFile(file)` is imported from `'electron'` — NOT from `'electron/webUtils'` or any submodule. This is the only API change vs CONTEXT.md D-09 (which pre-dates the Electron 32 removal of `file.path`; RESEARCH Finding #1 has full citation).

---

### `src/preload/index.d.ts` (type declaration, global augmentation) — NO IN-REPO ANALOG

**Canonical starter source:** `@alex8088/quick-start/.../react-ts/src/preload/index.d.ts` (RESEARCH Finding #3).

**Pattern (RESEARCH lines 432–441 — verbatim):**
```typescript
// src/preload/index.d.ts
import type { Api } from '../shared/types';

declare global {
  interface Window {
    api: Api;
  }
}
```

**Load-bearing details:**
- File must be `.d.ts` (NOT `.ts`) so `tsconfig.web.json` `include` can pick up only the declaration without bundling the runtime preload code into the renderer.
- No `export {}` statement needed since the `import type` already makes the file a module.
- This file is the ONLY thing that teaches the renderer about `window.api`; the renderer imports `LoadResponse` / `SkeletonSummary` etc. directly from `'../../../shared/types'`, NOT from the preload.

---

### `src/main/index.ts` (main-process entry, app lifecycle) — NO IN-REPO ANALOG

**Canonical starter source:** `@alex8088/quick-start/.../react-ts/src/main/index.ts` (RESEARCH Finding #3; structure referenced in RESEARCH Architecture Patterns table line 344).

**Required pieces** (from CONTEXT.md + RESEARCH § Pitfall 7):
1. `app.whenReady().then(() => { createWindow(); registerIpcHandlers(); })`
2. `createWindow()` uses `webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true }` — D-06 + RESEARCH §Anti-pattern lines 694–696 (sandbox: true NOT false; starter uses false because of `@electron-toolkit/preload` which we're skipping per RESEARCH Standard Stack "NOT using" table line 244).
3. HMR branch (RESEARCH Pitfall 7 line 782):
   ```typescript
   if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
     mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
   } else {
     mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
   }
   ```
4. Window size 1280×800 (CONTEXT.md Claude's Discretion line 123).
5. DevTools dev-only (RESEARCH Security Domain line 1064): `if (!app.isPackaged) mainWindow.webContents.openDevTools()`.
6. NO `titleBarStyle: 'hiddenInset'`, NO `trafficLightPosition`, NO `vibrancy` — D-27 + arch-spec grep gate.

---

### `src/renderer/index.html` (HTML entry) — NO IN-REPO ANALOG

**Canonical starter source:** `@alex8088/quick-start/.../react-ts/src/renderer/index.html`.

**Load-bearing piece:** CSP `<meta>` tag (RESEARCH Security Domain line 1075):
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self';">
```
`'unsafe-inline'` for styles is needed if Tailwind emits inline style tags; verify during Plan execution and drop if unnecessary.

---

### `src/renderer/src/main.tsx` (React root) — NO IN-REPO ANALOG

**Canonical starter source:** `@alex8088/quick-start/.../react-ts/src/renderer/src/main.tsx` — standard React 19 `createRoot` bootstrap with `<StrictMode>` wrapper.

**Required import:** `import './index.css'` — side-effect import triggers Tailwind + `@theme` + `@font-face` processing by the Vite plugin.

---

### `src/renderer/src/App.tsx` (top-level state machine) — NO IN-REPO ANALOG

**Structure source:** RESEARCH architectural diagram lines 285–330 + CONTEXT.md D-20 state shape.

**State shape (CONTEXT.md D-20 locked, line 89):**
```typescript
type AppState =
  | { status: 'idle' }
  | { status: 'loading', path: string }
  | { status: 'loaded', path: string, summary: SkeletonSummary }
  | { status: 'error', path: string, error: SerializableError };
```

**Pattern:** single `useState<AppState>`, passed into `<DropZone onLoad={...} />` and `<DebugPanel state={state} />`. Exhaustive switch/pattern-match on `state.status` for rendering — no multiple states, no `useEffect` for IPC (drop handler is the event source; the IPC call is async-awaited inside the drop callback).

---

### `src/renderer/src/index.css` (Tailwind v4 `@theme`) — NO IN-REPO ANALOG

**Pattern source:** RESEARCH Pattern 4 lines 585–625 — verbatim-copyable. Load-bearing details:
1. `@theme inline { ... }` for all `--color-*` tokens that reference Tailwind built-ins (RESEARCH Finding #2).
2. `@theme { ... }` (no `inline`) for `--font-sans` + `--font-mono` (non-reference string values).
3. `@font-face` for JetBrains Mono using Vite asset-URL resolution: `url("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2") format("woff2")` (RESEARCH Pattern 4 lines 590–598).
4. Base body: `@apply bg-surface text-fg font-sans antialiased; margin: 0;` — satisfies D-18 pre-drop chrome.

---

### `src/renderer/src/components/DropZone.tsx` — NO IN-REPO ANALOG

**Pattern source:** RESEARCH Pattern 5 lines 631–688 — verbatim-copyable. Load-bearing details:
1. Bare `<div>` with `onDragOver` / `onDragLeave` / `onDrop` — NOT `react-dropzone` (RESEARCH §"NOT using" table line 246, breaks `webUtils.getPathForFile`).
2. Pass `file` (the File object) to `window.api.loadSkeletonFromFile(file)`, NOT `file.path` (doesn't exist anymore) and NOT a string path (preload does the `getPathForFile` call).
3. Extension guard `file.name.toLowerCase().endsWith('.json')` returns an `{ ok: false, error: { kind: 'Unknown', message: ... }}` envelope inline without calling IPC — UX-only check, not a security boundary (RESEARCH Security Domain V5).
4. Drag-over ring: `ring-2 ring-accent bg-accent/5` (CONTEXT.md D-14 + RESEARCH Pattern 5 line 679). Literal class strings — no dynamic `${}` composition — so Tailwind's v4 scanner picks them up (RESEARCH Pitfall 8).

---

### `electron.vite.config.ts` — NO IN-REPO ANALOG

**Pattern source:** RESEARCH Pattern 3 lines 552–580 — verbatim-copyable. Load-bearing:
- `main: {}` + `preload: {}` empty bodies are correct (electron-vite v5 default `build.externalizeDeps: true` handles externalization).
- `renderer.plugins: [react(), tailwindcss()]` — Vite plugin order doesn't matter; both needed.
- `renderer.resolve.alias['@renderer']: resolve('src/renderer/src')` — internal alias only; NO `@core` alias (RESEARCH §"Enforcing core/ ↛ renderer/" Layer 2 line 831).

---

### `electron-builder.yml` — NO IN-REPO ANALOG

**Canonical starter source:** `@alex8088/quick-start/.../react-ts/electron-builder.yml` (RESEARCH Finding #3 + Pitfall 6 line 777).

**Load-bearing fields (from CONTEXT.md `<portability>` + RESEARCH Pitfall 6):**
```yaml
appId: com.spine-texture-manager.app
productName: Spine Texture Manager
directories:
  buildResources: build
  output: dist
files:
  - out/**
  - package.json
  - '!src/**'
  - '!tsconfig*.json'
  - '!fixtures/**'
  - '!temp/**'
  - '!tests/**'
  - '!scripts/**'
  - '!.planning/**'
mac:
  target: [dmg]
  category: public.app-category.developer-tools
```
NO `win` block in Phase 1 (D-24 — adding it is later a pure additive diff). NO `afterPack`, `publish`, signing hooks (D-04 — unsigned; D-24 — keep config target-agnostic).

---

### `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` — NO IN-REPO ANALOG (for the split)

**Canonical starter sources:** `@alex8088/quick-start/.../react-ts/tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` (RESEARCH Finding #3 line 213, Standard Stack line 236 confirms `@electron-toolkit/tsconfig` extension pattern).

**Root `tsconfig.json` becomes references-only:**
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```
**This is a destructive rewrite** of the current `tsconfig.json` (which has `include`, `compilerOptions`, etc.). The current content redistributes:
- `src/core/**`, `src/main/**`, `src/preload/**`, `src/shared/**`, `scripts/**`, `tests/**`, `electron.vite.config.ts`, `vitest.config.ts` → `tsconfig.node.json` (extends `@electron-toolkit/tsconfig/tsconfig.node.json`).
- `src/renderer/src/**` + `src/preload/*.d.ts` + `src/shared/**` → `tsconfig.web.json` (extends `@electron-toolkit/tsconfig/tsconfig.web.json`, adds `jsx: 'react-jsx'`, adds `paths: { '@renderer/*': ['src/renderer/src/*'] }`).

**Layer-1 boundary guard (RESEARCH §"Enforcing core/ ↛ renderer/" line 810):** `tsconfig.web.json` `include` MUST NOT list `src/core/**`. Asserting this is the job of `tests/arch.spec.ts` (see above).

**Open Question A1 (RESEARCH line 891):** `@electron-toolkit/tsconfig@^2.0.0` compat with TypeScript 6.x (current repo pin). Resolution strategy in Plan 1 Task 1: `npm install @electron-toolkit/tsconfig` + `tsc --noEmit`; if red, downgrade to TS 5.9.x per starter. **Planner should flag this as a Task 1 decision gate.**

---

### `package.json` — MODIFIED (current file IS the partial analog)

**Current content** (read for context): `name`, `version`, `private`, `type: module`, 4 scripts (`test`, `test:watch`, `typecheck`, `cli`), 1 runtime dep (`@esotericsoftware/spine-core`), 4 devDeps.

**Add (Phase 1 deps — RESEARCH §Standard Stack + Wave-0 line 992):**

Runtime (`dependencies`):
- `react@^19.2.5`
- `react-dom@^19.2.5`
- `@fontsource/jetbrains-mono@^5.2.8`

Dev (`devDependencies`):
- `electron@^41.3.0`
- `electron-vite@^5.0.0`
- `electron-builder@^26.8.1`
- `@vitejs/plugin-react@^5.1.2`
- `tailwindcss@^4.2.4`
- `@tailwindcss/vite@^4.2.4`
- `@electron-toolkit/tsconfig@^2.0.0`
- `@types/react@^19.2.7`
- `@types/react-dom@^19.2.3`
- Optional: `clsx@^2.1.1` (if DropZone uses it per RESEARCH Pattern 5 — small utility).

**Add scripts (CONTEXT.md D-03):**
```json
"dev": "electron-vite dev",
"build": "electron-vite build && electron-builder --mac dmg",
"build:dry": "electron-vite build && electron-builder --mac dmg --dir",
"preview": "electron-vite preview",
"typecheck": "npm run typecheck:node && npm run typecheck:web",
"typecheck:node": "tsc --noEmit -p tsconfig.node.json",
"typecheck:web": "tsc --noEmit -p tsconfig.web.json"
```

**Keep existing scripts** (`test`, `test:watch`, `cli` — Phase 0 invariants; CONTEXT.md D-03 line 52 "Existing `npm run cli`, `npm run test`, `npm run typecheck` stay intact").

**Add `main: './out/main/index.js'`** (electron-vite's standard output location).

**Add `build: {}` block OR defer to `electron-builder.yml`** — Open Question 2 (RESEARCH line 911). Recommendation: use `electron-builder.yml` (matches starter, cleaner) — so `package.json` does NOT get a `build` field.

---

### `.gitignore` — MODIFIED

**Current content:**
```
node_modules/
dist/
coverage/
temp/
fixtures/Jokerman/
fixtures/Girl/
.DS_Store
*.log
npm-debug.log*
```

**Add (RESEARCH Open Question 5 line 925 + Runtime State Inventory line 733):**
```
out/          # electron-vite bundle output
release/      # (reserved — electron-builder may emit here depending on config; add defensively)
```

`dist/` already present → electron-builder's default `dist/` output is covered.
`node_modules/` already present.
`coverage/` already present.

---

## Shared Patterns

### Typed-error branching (IPC envelope source of truth)

**Source:** `src/core/errors.ts` (the class hierarchy) + `scripts/cli.ts` lines 152–156 (the branching idiom).

**Apply to:** `src/main/ipc.ts` (runtime branching — `e instanceof SpineLoaderError` → `e.name` dispatch) AND `src/shared/types.ts` (`SerializableError.kind` literal union MUST match `name` values byte-for-byte).

**Concrete excerpt (name↔kind mapping, LOAD-BEARING invariant — any drift breaks renderer dispatch):**

From `src/core/errors.ts`:
| Class | `.name` string value (lines) |
|---|---|
| `SpineLoaderError` | `'SpineLoaderError'` (line 17) — base, not in kind union |
| `SkeletonJsonNotFoundError` | `'SkeletonJsonNotFoundError'` (line 24) |
| `AtlasNotFoundError` | `'AtlasNotFoundError'` (line 35) |
| `AtlasParseError` | `'AtlasParseError'` (line 44) |

`SerializableError.kind` must be:
```typescript
'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown'
```
(Three concrete subclasses + `'Unknown'` fallback. The base `SpineLoaderError` is never returned as a kind — it's only the `instanceof` gate in the handler.)

---

### `.js` extension on relative imports

**Source:** `src/core/*.ts` — every relative import uses `.js`, e.g. `src/core/sampler.ts` line 53:
```typescript
import type { LoadResult, SampleRecord, SourceDims } from './types.js';
import { attachmentWorldAABB, computeRenderScale } from './bounds.js';
```

**Apply to:** every new file in `src/main/`, `src/preload/`, `src/shared/`, `src/renderer/` — relative imports take the `.js` extension even though the source files are `.ts` / `.tsx`. This is required by `moduleResolution: "bundler"` + ESM. Bare specifiers (`'electron'`, `'react'`, `'@esotericsoftware/spine-core'`) do NOT take `.js`.

**Open nuance:** canonical starter `tsconfig.web.json` may set `moduleResolution: "node"` or rely on `@electron-toolkit/tsconfig` defaults — verify during Plan 1 Task 1. If starter uses no-extension imports for the renderer, follow starter in the renderer and keep `.js` in main/preload/shared.

---

### Module-docstring header (Phase 0 convention)

**Source:** `src/core/loader.ts` lines 1–28, `src/core/sampler.ts` lines 1–45, `src/core/errors.ts` lines 1–11, `src/core/types.ts` lines 1–13.

**Pattern:** every `src/` module starts with a `/** ... */` block that names the plan, the contract it implements, explicit constraints (rule #N, requirement F-X.Y), and load-bearing invariants. Example from `src/core/sampler.ts` lines 30–37:
```typescript
 * I/O rule (N2.3, threat T-00-04-03): this module imports nothing from
 * `node:fs`, `node:path`, `node:child_process`, `node:net`, `node:http`, or
 * the PNG-decode library — the hot loop is filesystem-free by construction.
 * Enforced by hygiene tests in `tests/core/sampler.spec.ts`.
```

**Apply to ALL new `src/` files:** each gets a docstring citing the plan number (e.g. "Phase 1 Plan X"), the CONTEXT.md decision it implements (e.g. "D-06: Main process owns filesystem"), and any load-bearing invariant (e.g. "Renderer MUST NOT import this file — CLAUDE.md Fact #5; enforced by `tests/arch.spec.ts`").

**Exception:** type-only files (`src/preload/index.d.ts`, `src/shared/types.ts`) get a shorter docstring — see `src/core/types.ts` lines 1–13 for the length template.

---

### Atomic-commit scope convention

**Source:** Phase 0 git log (`git log --oneline` shows `feat(00-core):`, `chore(00-core):`, `docs(00):` prefixes — CONTEXT.md code-context line 175).

**Apply to:** Phase 1 commits use `feat(01-ui):`, `chore(01-ui):`, `build(01-ui):`, `test(01-ui):`, `docs(01):` prefixes. Each plan produces one or more atomic commits; no mixed-concern commits (runtime + test + docs in one commit).

---

### vitest test-file convention

**Source:** `tests/core/loader.spec.ts`, `tests/core/sampler.spec.ts`, `tests/core/bounds.spec.ts`.

**Pattern per file:**
1. Docstring header (like module docstrings above) citing plan + requirement IDs covered.
2. `import { describe, expect, it } from 'vitest';` — explicit, not via globals (confirmed by `vitest.config.ts` line 7: `globals: false`).
3. `import * as path from 'node:path';` for fixture paths; `const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');` at module scope.
4. `describe('<module-name> (<reqIDs>)', () => { it('<reqID>: <behavior>', () => { ... }); });` — one `describe`, multiple `it`s keyed by requirement ID.
5. Use `expect().toBeInstanceOf(...)` for typed-error assertions (see `tests/core/loader.spec.ts` line 69). For IPC envelope tests, use `expect(resp.ok).toBe(false); if (!resp.ok) expect(resp.error.kind).toBe(...)` (no discriminated union unwrapping via `as` casts — narrow via control flow).

**Apply to:** `tests/core/summary.spec.ts`, `tests/core/ipc.spec.ts`, `tests/arch.spec.ts` — all three new Wave-0 tests.

**Location note:** upstream prompt places `summary.spec.ts` + `ipc.spec.ts` under `tests/core/` — this is correct because they exercise code that ultimately depends on `src/core/*`. The RESEARCH §Validation Architecture uses `tests/main/` for the IPC test — planner should pick one and be consistent. The simpler choice is `tests/core/` (matches upstream prompt + Phase 0 convention; no new test directory needed). `tests/arch.spec.ts` at the top level because it's cross-cutting (globs the whole `src/`).

---

## No Analog Found

Files with **no close in-repo match** — must follow the canonical `@alex8088/quick-start/packages/create-electron/playground/react-ts/` starter (RESEARCH Finding #3 confirms fetched verbatim; paths below are reachable via `raw.githubusercontent.com/alex8088/quick-start/main/packages/create-electron/playground/react-ts/<file>`):

| File | Starter path to follow | Reason no in-repo analog |
|------|-------------------------|--------------------------|
| `electron.vite.config.ts` | `electron.vite.config.ts` (root) | Repo has no bundler config (CLI uses `tsx` directly). |
| `electron-builder.yml` | `electron-builder.yml` (root) | Repo has never been packaged. |
| `tsconfig.node.json` | `tsconfig.node.json` (root) | Repo has single flat `tsconfig.json`. |
| `tsconfig.web.json` | `tsconfig.web.json` (root) | Repo has no renderer/browser context. |
| `src/main/index.ts` | `src/main/index.ts` | No Electron main process exists. |
| `src/preload/index.ts` | `src/preload/index.ts` | No preload surface exists. |
| `src/preload/index.d.ts` | `src/preload/index.d.ts` | No preload surface exists. |
| `src/renderer/index.html` | `src/renderer/index.html` | No web HTML anywhere. |
| `src/renderer/src/main.tsx` | `src/renderer/src/main.tsx` | No React code anywhere. |
| `src/renderer/src/App.tsx` | `src/renderer/src/App.tsx` (structure only — our logic is bespoke per D-20) | No React components. |
| `src/renderer/src/index.css` | `src/renderer/src/assets/main.css` (starter) + RESEARCH Pattern 4 (Tailwind v4 overlay) | Tailwind + `@theme` never used. |
| `src/renderer/src/components/DropZone.tsx` | RESEARCH Pattern 5 (no starter equivalent — starter doesn't do drag-drop) | Bespoke per CONTEXT.md D-09 + D-14. |

**The starter is NOT the pattern for:**
- `src/main/ipc.ts` — use `scripts/cli.ts` typed-error branching + RESEARCH Pattern 2 (starter doesn't have a domain-specific IPC handler).
- `src/main/summary.ts` — use `scripts/cli.ts` projection structure + RESEARCH buildSummary source (starter has no projection layer).
- `src/shared/types.ts` — use `src/core/types.ts` module style (starter doesn't have a shared-types module).
- `src/renderer/src/components/DebugPanel.tsx` — use `scripts/cli.ts` `renderTable()` verbatim (starter doesn't render tables).
- `tests/core/ipc.spec.ts`, `tests/core/summary.spec.ts`, `tests/arch.spec.ts` — use `tests/core/loader.spec.ts` vitest style + RESEARCH arch-grep regex.

---

## Metadata

**Analog search scope:** `src/core/*`, `scripts/*`, `tests/core/*`, `tsconfig.json`, `package.json`, `.gitignore`, `vitest.config.ts`.
**Files scanned:** 12 in-repo source/config files; 4 concrete in-repo files extracted as analog sources (`src/core/types.ts`, `src/core/errors.ts`, `scripts/cli.ts`, `tests/core/loader.spec.ts`) plus their extension patterns.
**Starter paths cited:** 12 (all under `@alex8088/quick-start/packages/create-electron/playground/react-ts/`; verified verbatim-fetched by researcher per RESEARCH Finding #3 line 213 and Sources line 1093).
**Critical invariants:**
1. `SerializableError.kind` literals MUST match `SpineLoaderError` subclass `name` values in `src/core/errors.ts` lines 24, 35, 44.
2. DebugPanel's `<pre>` body MUST be a line-for-line port of `scripts/cli.ts` `renderTable()` (lines 77–126) or the D-16 "exact replica" requirement fails.
3. `src/renderer/**` MUST NOT import from `src/core/**` — CLAUDE.md Fact #5; enforced by `tests/arch.spec.ts` + `tsconfig.web.json` include list + no `@core` alias in renderer vite config (three-layer defense per RESEARCH line 807).
4. Relative imports use `.js` extensions in all non-renderer TS files (repo convention, verified across every `src/core/*.ts`).
5. `webUtils.getPathForFile(file)` replaces `file.path` (RESEARCH Finding #1) — this is the ONE deviation from CONTEXT.md D-09; intent preserved, mechanism updated.

**Pattern extraction date:** 2026-04-23
