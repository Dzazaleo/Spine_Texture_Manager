# Phase 24: Panel semantics — Unused Assets rewrite + atlas-savings metric - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 7
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/usage.ts` | utility | transform | `src/core/usage.ts` (existing file, function replaced) | exact |
| `src/core/errors.ts` | utility | N/A | `src/core/errors.ts` (existing file, message string edit) | exact |
| `src/main/summary.ts` | service | file-I/O + transform | `src/main/summary.ts` (existing file, rewrite orphan block) | exact |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | component | request-response | `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (existing, remove + add) | exact |
| `src/renderer/src/panels/UnusedAssetsPanel.tsx` | component | request-response | `src/renderer/src/panels/MissingAttachmentsPanel.tsx` | role-match |
| `src/renderer/src/components/AppShell.tsx` | component | request-response | `src/renderer/src/components/AppShell.tsx` (existing, thread prop + insert panel) | exact |
| `src/shared/types.ts` | model | N/A | `src/shared/types.ts` (existing file, type rename) | exact |

---

## Pattern Assignments

### `src/core/usage.ts` (utility, transform)

**Analog:** `src/core/usage.ts` — the entire `findUnusedAttachments` function (lines 76–183) is deleted and replaced by a new `findOrphanedFiles` pure helper. The file header, import surface, and `CLAUDE.md #5` constraint (pure TS, zero I/O, zero DOM) are preserved verbatim.

**Existing imports block** (lines 59–61) — update the `UnusedAttachment` import to `OrphanedFile`:
```typescript
// BEFORE (lines 59-61):
import type { LoadResult } from './types.js';
import type { SamplerOutput } from './sampler.js';
import type { UnusedAttachment } from '../shared/types.js';

// AFTER — SamplerOutput import is dropped (new function doesn't need it);
// LoadResult is also dropped (pure helper takes pre-built params only):
import type { OrphanedFile } from '../shared/types.js';
```

**New function signature** (replaces lines 76–183 entirely):
```typescript
/**
 * Phase 24 PANEL-01 — Pure orphaned-file detection (D-01, D-02, D-05).
 *
 * Takes pre-collected inputs; performs zero I/O (CLAUDE.md #5).
 * I/O (fs.readdirSync, fs.statSync) lives exclusively in src/main/summary.ts.
 *
 * Algorithm (D-02 step 3): orphaned = imagesFolderFiles NOT IN inUseNames.
 */
export function findOrphanedFiles(
  imagesFolderFiles: string[],  // PNG basenames without extension
  inUseNames: Set<string>,
): string[] {
  return imagesFolderFiles.filter((name) => !inUseNames.has(name));
}
```

**Non-textured filter proxy** — in the caller (`src/main/summary.ts`), atlas-less mode uses `load.sourceDims.get(name) !== undefined` as the textured-attachment proxy (same technique as old `usage.ts:117`). This stays in summary.ts, not in the pure helper.

---

### `src/core/errors.ts` (utility, N/A — message string edit only)

**Analog:** `src/core/errors.ts:27–51` — `AtlasNotFoundError` constructor.

**Edit target** (lines 44–47 — the `super(...)` call body):
```typescript
// BEFORE (lines 44-47):
super(
  `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
    `Re-export from the Spine editor with the atlas included.\n` +
    `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
);

// AFTER — add third sentence mentioning the toggle:
super(
  `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
    `Re-export from the Spine editor with the atlas included, or enable the "Use Images Folder as Source" toggle to load without an atlas.\n` +
    `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
);
```

**Invariant:** class name (`AtlasNotFoundError`), `.name = 'AtlasNotFoundError'` assignment, constructor field names (`searchedPath`, `skeletonPath`) — all unchanged. Existing tests that assert on class name and typed fields continue to pass.

---

### `src/main/summary.ts` (service, file-I/O + transform)

**Analog:** `src/main/summary.ts:121–158` — the existing `findUnusedAttachments` call + `bytesOnDisk` augmentation block.

**Import change** (line 24): replace `findUnusedAttachments` with `findOrphanedFiles`:
```typescript
// BEFORE:
import { findUnusedAttachments } from '../core/usage.js';

// AFTER:
import { findOrphanedFiles } from '../core/usage.js';
```

**Add `path` import** (new, needed for `path.dirname` + `path.join` for `imagesDir`):
```typescript
import * as path from 'node:path';
```

**Rewrite the orphan detection block** (lines 121–158 — entirely replaced):

```typescript
// Phase 24 PANEL-01 — orphaned file detection (D-01, D-02, D-05).
// I/O layer: this is the ONLY place that touches fs.readdirSync / fs.statSync
// for orphan detection. The pure helper src/core/usage.ts:findOrphanedFiles
// receives pre-collected arrays and performs zero I/O (CLAUDE.md #5).
const skeletonDir = path.dirname(load.skeletonPath);
const imagesDir = path.join(skeletonDir, 'images');

// Step 1 (D-02): read images/ folder → collect PNG basenames (no extension).
let imagesFolderFiles: string[] = [];
try {
  const entries = fs.readdirSync(imagesDir);
  imagesFolderFiles = entries
    .filter((e) => e.toLowerCase().endsWith('.png'))
    .map((e) => e.slice(0, -4)); // strip ".png"
} catch {
  // images/ does not exist → no orphaned files → panel hidden (D-03).
  imagesFolderFiles = [];
}

// Step 2 (D-02): build in-use name set — depends on mode (D-03).
const inUseNames = new Set<string>();
if (load.atlasPath !== null) {
  // Atlas-mode: in-use = union of atlas region names (the manifest authority).
  for (const region of load.atlas.regions) {
    inUseNames.add(region.name);
  }
} else {
  // Atlas-less mode: in-use = textured attachment names from skins.
  // Non-textured filter proxy: load.sourceDims.get(name) !== undefined
  // (same proxy as old findUnusedAttachments:117 — BoundingBox/Path/Clipping/Point
  // have no sourceDims entry and are excluded; D-02 step 2 spec).
  for (const skin of load.skeletonData.skins) {
    for (const perSlot of skin.attachments) {
      if (perSlot === undefined || perSlot === null) continue;
      for (const attachmentName of Object.keys(perSlot)) {
        if (load.sourceDims.get(attachmentName) !== undefined) {
          inUseNames.add(attachmentName);
        }
      }
    }
  }
}

// Step 3 (D-02): orphaned = PNG filenames NOT in inUseNames.
const orphanedBasenames = findOrphanedFiles(imagesFolderFiles, inUseNames);

// Augment with on-disk byte size via fs.statSync (same pattern as the old
// bytesOnDisk augmentation at lines 144-157 — summary.ts is the sole writer).
const orphanedFiles = orphanedBasenames.map((filename) => {
  const pngPath = path.join(imagesDir, filename + '.png');
  let bytesOnDisk = 0;
  try {
    bytesOnDisk = fs.statSync(pngPath).size;
  } catch {
    // ENOENT / EACCES — treat as 0 (same silent pattern as old block line 154).
    bytesOnDisk = 0;
  }
  return { filename, bytesOnDisk };
});
```

**Return object** (line 186): replace `unusedAttachments` field with `orphanedFiles`:
```typescript
// BEFORE:
unusedAttachments,

// AFTER:
orphanedFiles,
```

**`fs.statSync` pattern** (copy from existing lines 148–155):
```typescript
// Established pattern — used verbatim in the old bytesOnDisk augmentation:
try {
  bytesOnDisk = fs.statSync(path).size;
} catch {
  bytesOnDisk = 0;
}
```

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (component, request-response)

**Analog:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — targeted removals and additions.

#### Removals (lines to delete)

**Memos to remove** (lines 648–687):
```typescript
// DELETE the following 4 memo/variable blocks:
const unusedAttachments = summary.unusedAttachments ?? [];   // line 660
const unusedNameSet = useMemo(...)                            // lines 664-667
const aggregateBytes = unusedAttachments.reduce(...)          // lines 674-677
const filteredUnused = useMemo(...)                           // lines 678-687
```

**Unused section JSX to remove** (lines 856–907):
```tsx
// DELETE the entire block:
{unusedAttachments.length > 0 && (
  <section ...>
    ...
  </section>
)}
```

**`unusedNameSet` references in row state** (lines 1006 and 1124):
```typescript
// DELETE both:
unusedNameSet.has(row.attachmentName),   // passed as isUnused arg to rowState()
```
Replace with `false` (orphaned files are no longer surfaced in this panel; no row can be "unused" in Phase 24 semantics — only "over"/"under"/"neutral").

#### Additions

**New prop** — add `savingsPct?: number | null` to `GlobalMaxRenderPanelProps` (lines 109–155):
```typescript
export interface GlobalMaxRenderPanelProps {
  // ... existing props ...
  /**
   * Phase 24 OPT-03 (D-09) — Pixel-area savings % chip in the section header.
   * Computed by AppShell.tsx:702-712 (savingsPctMemo). Null when the export plan
   * is empty (no attachments); chip is hidden when null (D-11 chip-hidden policy).
   */
  savingsPct?: number | null;
}
```

**Destructure the new prop** (line 578 function signature):
```typescript
export function GlobalMaxRenderPanel({
  // ... existing destructured props ...
  savingsPct,
}: GlobalMaxRenderPanelProps) {
```

**Savings chip in section header** (insert after `{selected.size} selected / {sorted.length} total` span, lines 852–855):
```tsx
{/* Phase 24 OPT-03 — pixel-area savings % chip (D-08, D-09, D-10).
    Hidden when savingsPct is null (empty plan / no attachments).
    toFixed(1) matches the OptimizeDialog tile at modals/OptimizeDialog.tsx:355. */}
{savingsPct !== null && savingsPct !== undefined && (
  <span className="font-mono text-xs text-fg-muted border border-border rounded px-1.5 py-0.5">
    {savingsPct.toFixed(1)}% pixel savings
  </span>
)}
```

**Chip visual reference** — `OptimizeDialog.tsx:355` renders `{savingsPct.toFixed(1)}%` inside a `text-base font-semibold text-fg` span. The GlobalMaxRenderPanel chip is smaller (`text-xs`) and pill-styled (`border border-border rounded px-1.5 py-0.5`) to fit inline in the section header without competing with the panel title.

---

### `src/renderer/src/panels/UnusedAssetsPanel.tsx` (NEW component, request-response)

**Analog:** `src/renderer/src/panels/MissingAttachmentsPanel.tsx` (full file, lines 1–92)

This is the closest structural analog: same collapsible-panel pattern, same `return null` when empty, same `border-danger` accent, same `role="alert"` ARIA landmark.

**File header pattern** — copy from `MissingAttachmentsPanel.tsx:1–32` (module docblock):
```typescript
/**
 * Phase 24 PANEL-02 — UnusedAssetsPanel.
 *
 * Surfaces SkeletonSummary.orphanedFiles — PNG files in images/ that the rig
 * does not reference. Hidden when orphanedFiles.length === 0 (D-06).
 * Expanded by default when N > 0 (D-06 "expanded when N > 0").
 *
 * Visual treatment mirrors MissingAttachmentsPanel (border-danger accent strip,
 * collapsible header, inline count + bytes in header per D-11).
 */
```

**Imports** — copy from `MissingAttachmentsPanel.tsx:33–34`:
```typescript
import { useState } from 'react';
import { formatBytes } from '../lib/format-bytes';
```

**Props interface** — modeled on `MissingAttachmentsPanelProps` (lines 35–37):
```typescript
import type { OrphanedFile } from '../../../shared/types.js';

export interface UnusedAssetsPanelProps {
  orphanedFiles: OrphanedFile[];
}
```

**Empty-state guard** — copy from `MissingAttachmentsPanel.tsx:48–50`:
```typescript
if (orphanedFiles.length === 0) {
  return null;
}
```

**useState for expand** — D-06 says expanded by default when N > 0. Copy `useState` from `MissingAttachmentsPanel.tsx:42` but initialize `true` instead of `false`:
```typescript
const [expanded, setExpanded] = useState(true); // D-06: expanded by default
```

**Banner chrome** — copy from `MissingAttachmentsPanel.tsx:55–91` and adapt:
```tsx
return (
  <div
    role="alert"
    aria-label="Orphaned image files"
    className="border-b border-border bg-panel px-6 py-2 text-xs text-fg flex flex-wrap items-center gap-2"
  >
    <span
      className="inline-block w-1 h-4 bg-danger flex-shrink-0"
      aria-hidden="true"
    />
    <span className="flex-1 min-w-0">
      <span className="font-semibold text-danger">
        {count} orphaned file{plural}
      </span>{' '}
      {totalBytes > 0 && (
        <span className="text-fg-muted">({formatBytes(totalBytes)} on disk)</span>
      )}
    </span>
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      aria-expanded={expanded}
      className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer flex-shrink-0"
    >
      {expanded ? 'Hide details' : 'Show details'}
    </button>
    {expanded && (
      <table className="basis-full mt-2 w-full border-collapse">
        {/* search filter + table rows per D-Claude's-Discretion */}
      </table>
    )}
  </div>
);
```

**Table pattern** — copy column/row pattern from `GlobalMaxRenderPanel.tsx:884–906` (the now-removed unused section table), adapting columns to `filename` and `formatBytes(bytesOnDisk)`. No "Defined In" column (D-Claude's-Discretion: orphaned files have no rig attachment).

**Search filter** — substring match on `filename.toLowerCase().includes(q)`, same predicate used in `GlobalMaxRenderPanel.tsx:682–684`:
```typescript
const filteredOrphans = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (q === '') return orphanedFiles.slice();
  return orphanedFiles.filter((f) => f.filename.toLowerCase().includes(q));
}, [orphanedFiles, query]);
```

---

### `src/renderer/src/components/AppShell.tsx` (component, request-response)

**Analog:** `src/renderer/src/components/AppShell.tsx` — targeted additions only.

**Import addition** (line 59, after `MissingAttachmentsPanel` import):
```typescript
import { UnusedAssetsPanel } from '../panels/UnusedAssetsPanel';
```

**Thread `savingsPct` prop** to `<GlobalMaxRenderPanel>` (lines 1529–1541). Existing prop list for reference:
```tsx
<GlobalMaxRenderPanel
  summary={effectiveSummary}
  onJumpToAnimation={onJumpToAnimation}
  overrides={overrides}
  onOpenOverrideDialog={onOpenOverrideDialog}
  focusAttachmentName={focusAttachmentName}
  onFocusConsumed={onFocusAttachmentConsumed}
  query={query}
  onQueryChange={setQuery}
  loaderMode={loaderMode}
  savingsPct={savingsPctMemo}    {/* ADD — Phase 24 OPT-03 (D-09) */}
/>
```

**Insert `<UnusedAssetsPanel>`** between `<GlobalMaxRenderPanel>` and `<AnimationBreakdownPanel>` (after line 1541, before line 1543):
```tsx
{/* Phase 24 PANEL-02 — hidden when 0 orphaned files (D-06); expanded by default
    when N > 0. Position: Global Max Render → Unused Assets → Animation Breakdown
    (D-07). The panel self-hides via `return null` when empty — no conditional
    wrapper needed here. */}
<UnusedAssetsPanel
  orphanedFiles={effectiveSummary.orphanedFiles ?? []}
/>
```

**`savingsPctMemo` source** (already exists at lines 702–712 — no change needed):
```typescript
const savingsPctMemo = useMemo<number | null>(() => {
  const plan = buildExportPlan(effectiveSummary, overrides);
  if (plan.rows.length === 0) return null;
  const sumSourcePixels = plan.rows.reduce(
    (acc, r) => acc + r.sourceW * r.sourceH,
    0,
  );
  const sumOutPixels = plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0);
  if (sumSourcePixels <= 0) return null;
  return (1 - sumOutPixels / sumSourcePixels) * 100;
}, [effectiveSummary, overrides]);
```

---

### `src/shared/types.ts` (model, N/A — type rename)

**Analog:** `src/shared/types.ts:203–235` (`UnusedAttachment` interface) and `src/shared/types.ts:590` (`SkeletonSummary.unusedAttachments` field).

**Replace `UnusedAttachment` interface** (lines 203–235) with `OrphanedFile`:
```typescript
// BEFORE (lines 203-235):
export interface UnusedAttachment {
  attachmentName: string;
  sourceW: number;
  sourceH: number;
  definedIn: string[];
  dimVariantCount: number;
  sourceLabel: string;
  definedInLabel: string;
  bytesOnDisk?: number;
}

// AFTER — minimal type per Claude's Discretion (IPC type rename):
/**
 * Phase 24 PANEL-01 — A single physically orphaned PNG file: present in
 * images/ but not referenced by any rig attachment (D-01). Minimal shape —
 * only the two fields needed by UnusedAssetsPanel (filename + disk size).
 * structuredClone-safe: both fields are primitives.
 */
export interface OrphanedFile {
  /** PNG basename without the .png extension (e.g. "UNUSED_CIRCLE"). */
  filename: string;
  /** On-disk byte size from fs.statSync. 0 if stat fails (ENOENT / EACCES). */
  bytesOnDisk: number;
}
```

**Rename field in `SkeletonSummary`** (line 590):
```typescript
// BEFORE:
unusedAttachments?: UnusedAttachment[];

// AFTER:
orphanedFiles?: OrphanedFile[];
```

**Retain `?` optional modifier** — keeps IPC backward-compat until all consumers are updated in the same commit. `buildSummary` always writes the field, so `?? []` coalescing in the renderer is the only consumer pattern needed.

---

## Shared Patterns

### `fs.statSync` try/catch (silent failure)
**Source:** `src/main/summary.ts:146–157`
**Apply to:** `src/main/summary.ts` orphaned file augmentation block
```typescript
try {
  bytesOnDisk = fs.statSync(pngPath).size;
} catch {
  // ENOENT / EACCES — treat as 0; no surface to the user
  bytesOnDisk = 0;
}
```

### `formatBytes` import and usage
**Source:** `src/renderer/src/lib/format-bytes.ts` (zero-import pure function)
**Apply to:** `src/renderer/src/panels/UnusedAssetsPanel.tsx` header bytes display
```typescript
import { formatBytes } from '../lib/format-bytes';
// Usage:
<span className="text-fg-muted">({formatBytes(totalBytes)} on disk)</span>
```

### `return null` when empty
**Source:** `src/renderer/src/panels/MissingAttachmentsPanel.tsx:48–50`
**Apply to:** `src/renderer/src/panels/UnusedAssetsPanel.tsx`
```typescript
if (orphanedFiles.length === 0) {
  return null;
}
```

### `?? []` null-coalesce on optional IPC fields
**Source:** `src/renderer/src/components/AppShell.tsx:1526` (`skippedAttachments ?? []`)
**Apply to:** `AppShell.tsx` `<UnusedAssetsPanel orphanedFiles={effectiveSummary.orphanedFiles ?? []} />`

### `border-danger` accent strip
**Source:** `src/renderer/src/panels/MissingAttachmentsPanel.tsx:62–65`
**Apply to:** `src/renderer/src/panels/UnusedAssetsPanel.tsx`
```tsx
<span
  className="inline-block w-1 h-4 bg-danger flex-shrink-0"
  aria-hidden="true"
/>
```

### Collapsible toggle button
**Source:** `src/renderer/src/panels/MissingAttachmentsPanel.tsx:71–78`
**Apply to:** `src/renderer/src/panels/UnusedAssetsPanel.tsx`
```tsx
<button
  type="button"
  onClick={() => setExpanded((prev) => !prev)}
  aria-expanded={expanded}
  className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer flex-shrink-0"
>
  {expanded ? 'Hide details' : 'Show details'}
</button>
```

### `atlas.regions` enumeration (atlas-mode in-use set)
**Source:** `src/core/loader.ts:405` (`for (const region of atlas!.regions)`)
**Apply to:** `src/main/summary.ts` atlas-mode branch of inUseNames construction
```typescript
for (const region of load.atlas.regions) {
  inUseNames.add(region.name);
}
```

---

## No Analog Found

All 7 files have close analogs in the codebase. No entries in this section.

---

## Metadata

**Analog search scope:** `src/core/`, `src/main/`, `src/renderer/src/panels/`, `src/renderer/src/components/`, `src/renderer/src/lib/`, `src/shared/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-04
