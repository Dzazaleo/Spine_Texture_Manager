# Phase 29: Per-region dedup + override-region semantics + atlas-preview pack-page accuracy — Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 13 (4 new, 9 modified)
**Analogs found:** 13 / 13

CONTEXT.md is the single source of truth for the file list (research was skipped this run). Every file below is mined from §canonical_refs `### Phase Loci — *` blocks and §code_context `### Integration Points`.

---

## File Classification

| File (M = modified, N = new) | Role | Data Flow | Closest Analog | Match Quality |
|------------------------------|------|-----------|----------------|---------------|
| **M** `src/shared/types.ts` (+`RegionRow`, +`Summary.regions`, re-key `AtlasPreviewInput` + `PackedRegion`) | data-shape (IPC contract) | structuredClone payload | existing `DisplayRow` (54-150) + `ExportRow.attachmentNames[]` (240) | exact |
| **M** `src/core/analyzer.ts` (+`dedupByRegionName` + region-fold) | analyzer-fold (pure-TS, Layer-3) | Map → DisplayRow[] sibling fold | `pickHigherPeak` (160-174) + `dedupByAttachmentName` (183-190) + `analyze` (203-235) | exact |
| **M** `src/main/summary.ts` (gain `regions: RegionRow[]` field) | IPC envelope | `buildSummary` projection | existing `peaks` projection through `analyze()` | exact |
| **M** `src/core/atlas-preview.ts` (`deriveInputs` collapses 191-207 nested loop) | analyzer-fold | one-tile-per-region | self — same function, different fold key (D-03) | exact (in-place re-key) |
| **M** `src/renderer/src/lib/atlas-preview-view.ts` (renderer mirror lines 184-205) | analyzer-fold (renderer mirror) | one-tile-per-region | `src/core/atlas-preview.ts:191-207` (lockstep mirror) | exact |
| **M** `src/main/project-io.ts` (override migration at 526, 802, 999) | migration-seam (IPC load) | record-key translation pre-renderer | D-150 stale-key intersect at the same three lines | exact (extends pattern) |
| **M** `src/renderer/src/components/AppShell.tsx` (override Map re-key + migration banner extension at 1713-1740) | UI-state-machine + migration banner | `Map<string, number>` keyed by regionName | existing `staleOverrideNotice` banner block + `overrides` Map init at 331 | exact |
| **M** `src/renderer/src/modals/AtlasPreviewModal.tsx` (`hoveredRegionName` + `onJumpToRegion` + HoverTooltip third line) | UI-state-machine | hover hit-test → tooltip + dblclick jump | self — `hoveredAttachmentName` state + HoverTooltip subcomponent at 100/281/555/613/656-684 | exact (rename in place) |
| **M** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (consumer flips `summary.peaks` → `summary.regions`) | UI consumer | RegionRow[] table | existing peaks consumer at 760-772 | role-match (same surface; different shape) |
| **M** `src/main/doc-export.ts:274` (region-keyed lookup) | IPC consumer | per-attachment count → per-region count | `summary.peaks.length` → `summary.regions.length` (line 274) | exact |
| **M** `scripts/cli.ts` (golden-output preservation; SIMPLE_PROJECT byte-locked) | CLI consumer | `analyze(peaks)` → table | unchanged — non-path-indirected fixtures byte-equal | n/a (no edit) |
| **N** `fixtures/Chicken-Min/` (stripped <1MB regression fixture) | fixture | analyzer + atlas-preview + export integration test | `fixtures/SIMPLE_PROJECT/` (`SIMPLE_TEST.json` + `.atlas` + `.png` + `images/`) | exact (structural) |
| **N** path-indirection vitest (`tests/regression/region-dedup.spec.ts` or similar) | test | analyzer-fold + atlas-preview + export, end-to-end | existing analyzer + atlas-preview tests on SIMPLE_PROJECT | role-match |

---

## Pattern Assignments

### `src/shared/types.ts` — `RegionRow` interface + `Summary.regions` field + `AtlasPreviewInput`/`PackedRegion` re-key

**Analog 1:** `DisplayRow` shape (lines 54-149) — drives `RegionRow` field set.
**Analog 2:** `ExportRow.attachmentNames[]` precedent (line 240) — drives the `attachmentNames[]` array field in `AtlasPreviewInput` + `PackedRegion`, AND the `contributingAttachments[]` array on `RegionRow`.

**Imports / file-top D-21 lock** (lines 1-17):
```typescript
/**
 * Shared IPC types for the Phase 1 Electron shell.
 * Only plain primitives, arrays, and nested plain objects live here — every
 * value is structuredClone-safe (no Map, no Float32Array, no class instances).
 * D-21 locks SkeletonSummary; D-22/D-35 lock the flat row shape exposed via
 * IPC as DisplayRow ...
 */
```
RegionRow + contributingAttachments[] MUST satisfy this lock — primitives + arrays of primitives + plain objects only.

**Field-set analog — DisplayRow** (lines 54-72, raw fields):
```typescript
export interface DisplayRow {
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  animationName: string;
  time: number;
  frame: number;
  peakScaleX: number;
  peakScaleY: number;
  peakScale: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  isSetupPosePeak: boolean;
  // ... preformatted labels follow
}
```

**Array-field precedent — ExportRow** (lines 232-263):
```typescript
export interface ExportRow {
  sourcePath: string;
  outPath: string;
  sourceW: number;
  sourceH: number;
  outW: number;
  outH: number;
  effectiveScale: number;
  attachmentNames: string[];   // <-- D-03 precedent for AtlasPreviewInput.attachmentNames[] + PackedRegion.attachmentNames[]
  // optional fields below: atlasSource?, actualSourceW/H?, isCapped?
}
```

**Pattern for new `RegionRow`** (mirror DisplayRow's primitive scalars, swap `attachmentName` → `regionName`, fold per-attachment detail into `contributingAttachments[]` per D-02):
```typescript
export interface RegionRow {
  regionName: string;
  // Winning-attachment attribution (REGION-05 lex tiebreak):
  attachmentName: string;        // winning contributor (lex-smallest on tie)
  skinName: string;
  slotName: string;
  animationName: string;
  time: number;
  frame: number;
  peakScale: number;
  peakScaleX: number;
  peakScaleY: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  isSetupPosePeak: boolean;
  sourcePath: string;
  canonicalW: number;
  canonicalH: number;
  actualSourceW: number | undefined;
  actualSourceH: number | undefined;
  dimsMismatch: boolean;
  isMissing?: boolean;
  atlasSource?: {                // mirrors DisplayRow.atlasSource (lines 109-116)
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
  // Preformatted labels (mirror DisplayRow lines 70-74):
  originalSizeLabel: string;
  peakSizeLabel: string;
  scaleLabel: string;
  sourceLabel: string;
  frameLabel: string;
  // D-02 — per-attachment detail folded into the row (powers REGION-05 attribution + tooltip).
  contributingAttachments: Array<{
    attachmentName: string;
    skinName: string;
    slotName: string;
    peakScale: number;
    animationName: string;
    time: number;
    frame: number;
    isSetupPosePeak: boolean;
  }>;
}
```

**Re-key `AtlasPreviewInput` + `PackedRegion`** (existing lines 461-499; flip `attachmentName: string` → `regionName: string` + add `attachmentNames: string[]` per D-03):
```typescript
// Existing (461-480):
export interface AtlasPreviewInput {
  attachmentName: string;          // <-- becomes regionName: string
  // ...                           // <-- add attachmentNames: string[]
}
// Existing (482-499):
export interface PackedRegion {
  attachmentName: string;          // <-- becomes regionName: string
  // ...                           // <-- add attachmentNames: string[]
}
```

**Add `regions: RegionRow[]` to `SkeletonSummary`** (insert after line 556; before `animationBreakdown`):
```typescript
peaks: DisplayRow[];               // existing — unchanged for CLI + AnimationBreakdownPanel
regions: RegionRow[];              // <-- NEW (D-01)
animationBreakdown: AnimationBreakdown[];  // existing
```

---

### `src/core/analyzer.ts` — `dedupByRegionName` + region-fold

**Analog 1:** `pickHigherPeak<T>` (lines 160-174) — direct template for the region-row winner picker.
**Analog 2:** `dedupByAttachmentName<T>` (lines 183-190) — direct template for `dedupByRegionName`.
**Analog 3:** `analyze` (lines 203-235) — sibling function that returns DisplayRow[]; new fold returns RegionRow[].
**Analog 4:** Lookup-key precedent (line 220 + 349-350) — `lookupKey = p.regionName ?? p.attachmentName` shows regionName resolution is already a known idiom.

**Winner-pick analog** (lines 160-174):
```typescript
function pickHigherPeak<T extends DisplayRow>(a: T, b: T): T {
  if (b.peakScale > a.peakScale) return b;
  if (a.peakScale > b.peakScale) return a;
  // Equal peakScale: break ties deterministically on (skinName, slotName).
  if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName) <= 0 ? a : b;
  return a.slotName.localeCompare(b.slotName) <= 0 ? a : b;
}
```

**Fold-by-key analog** (lines 183-190):
```typescript
function dedupByAttachmentName<T extends DisplayRow>(rows: readonly T[]): T[] {
  const winners = new Map<string, T>();
  for (const r of rows) {
    const prev = winners.get(r.attachmentName);
    winners.set(r.attachmentName, prev === undefined ? r : pickHigherPeak<T>(prev, r));
  }
  return [...winners.values()];
}
```

**Pattern for `dedupByRegionName`** (same shape; different key; same tie-break logic mirroring REGION-05 lex tiebreak — `attachmentName` lex-order, NOT skin/slot):
```typescript
// Per CONTEXT.md Specifics §"Lex-tiebreak precedent":
// REGION-05 = ties break deterministically on attachmentName lex order.
function pickRegionWinner(a: DisplayRow, b: DisplayRow): DisplayRow {
  if (b.peakScale > a.peakScale) return b;
  if (a.peakScale > b.peakScale) return a;
  // REGION-05 lex tiebreak on attachmentName:
  return a.attachmentName.localeCompare(b.attachmentName) <= 0 ? a : b;
}
function dedupByRegionName(rows: readonly DisplayRow[]): RegionRow[] {
  const groups = new Map<string, DisplayRow[]>();
  for (const r of rows) {
    const key = r.regionName ?? r.attachmentName;  // lookup-key idiom from analyzer.ts:220
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [r]);
    else bucket.push(r);
  }
  const out: RegionRow[] = [];
  for (const [regionName, bucket] of groups) {
    let winner = bucket[0];
    for (let i = 1; i < bucket.length; i++) winner = pickRegionWinner(winner, bucket[i]);
    out.push(toRegionRow(regionName, winner, bucket));  // bucket → contributingAttachments[]
  }
  return out;
}
```

**Lookup-key idiom (already established)** (line 220 + 349-350):
```typescript
// analyzer.ts:220
const lookupKey = p.regionName ?? p.attachmentName;
// analyzer.ts:349-350 (analyzeBreakdown)
const lookupKey = (rec: PeakRecord): string =>
  rec.regionName ?? rec.attachmentName;
```
The new fold uses `regionName` directly (with the same `?? attachmentName` defensive fallback for synthetic test fixtures).

**Sibling-function pattern** (lines 203-235): `analyze()` already takes `peaks: Map<string, PeakRecord>` and returns `DisplayRow[]`. Add a sibling `analyzeRegions(peaks, sourcePaths?, atlasSources?, canonicalDims?, actualDims?): RegionRow[]` that:
1. Reuses `analyze()`'s existing per-attachment row construction (call it OR refactor to share `toDisplayRow` mapping).
2. Pipes the result through `dedupByRegionName()` instead of `dedupByAttachmentName()`.
3. Sorts by the same `byCliContract`-style comparator (or a region-keyed variant).

**`analyzeBreakdown` is OFF-LIMITS** (lines 329-433): D-09 explicitly says this function's per-card per-attachment dedup is unchanged. AnimationBreakdownPanel = drill-down for REGION-06.

---

### `src/main/summary.ts` — `buildSummary` gains `regions: RegionRow[]`

**Analog:** existing `peaks` field projection. The site already calls `analyze(peaks, sourcePaths, atlasSources, canonicalDims, actualDims)` and assigns the result to `summary.peaks`. Add a sibling call to `analyzeRegions(...)` (same args) and assign to `summary.regions`.

Field-order convention per CONTEXT.md §Integration Points: `regions` lands AFTER `peaks` and BEFORE `breakdown` in the SkeletonSummary literal.

---

### `src/core/atlas-preview.ts` — `deriveInputs` per-region fold (PREVIEW-01 fix)

**Analog:** the function itself at lines 166-231. The existing nested loop at 191-207 is the precise locus to collapse from "one tile per `attachmentNames[i]`" → "one tile per region (with `attachmentNames[]` for hit-test attribution)".

**Existing optimized-mode loop** (lines 188-208):
```typescript
const plan = buildExportPlan(summary, overrides);
const out: AtlasPreviewInput[] = [];
for (const row of [...plan.rows, ...plan.passthroughCopies]) {
  for (const attachmentName of row.attachmentNames) {       // <-- inner loop disappears
    if (excluded.has(attachmentName)) continue;
    const peak = summary.peaks.find((p) => p.attachmentName === attachmentName);
    if (!peak) continue;
    out.push({
      attachmentName,                                        // <-- becomes regionName
      sourceW: peak.sourceW,
      sourceH: peak.sourceH,
      outW: row.outW,
      outH: row.outH,
      packW: row.outW,
      packH: row.outH,
      sourcePath: row.sourcePath,
      ...(row.atlasSource ? { atlasSource: row.atlasSource } : {}),
    });
  }
}
```

**Pattern after collapse** (one push per row; `attachmentNames[]` carries the hit-test contributors):
```typescript
const plan = buildExportPlan(summary, overrides);
const out: AtlasPreviewInput[] = [];
for (const row of [...plan.rows, ...plan.passthroughCopies]) {
  // ExportRow is already region-keyed via sourcePath. row.attachmentNames[]
  // is the contributor list — emit ONE input per row, not one per attachment.
  // regionName resolves from the first contributing peak's regionName field
  // (loader-populated; fallback to attachmentName per analyzer.ts:220 idiom).
  const filteredNames = row.attachmentNames.filter((n) => !excluded.has(n));
  if (filteredNames.length === 0) continue;
  const firstPeak = summary.peaks.find((p) => p.attachmentName === filteredNames[0]);
  if (!firstPeak) continue;
  out.push({
    regionName: firstPeak.regionName ?? firstPeak.attachmentName,
    attachmentNames: filteredNames,
    sourceW: firstPeak.sourceW,
    sourceH: firstPeak.sourceH,
    outW: row.outW,
    outH: row.outH,
    packW: row.outW,
    packH: row.outH,
    sourcePath: row.sourcePath,
    ...(row.atlasSource ? { atlasSource: row.atlasSource } : {}),
  });
}
```

**Original-mode loop** (lines 213-230) similarly collapses: dedup `summary.peaks` by regionName before emitting, OR walk `summary.regions` (preferred — single source of truth post-D-01).

---

### `src/renderer/src/lib/atlas-preview-view.ts` — renderer mirror

**Analog:** the renderer mirror at lines 170-220. Identical edit to `src/core/atlas-preview.ts`; CONTEXT.md §canonical_refs explicitly calls out the lockstep requirement. Same code, different file — the project pattern is duplication, NOT a shared module (see types.ts atlasSource shape comment at line 459: *"DO NOT extract a named type (precedent is duplication)."*).

---

### `src/main/project-io.ts` — override migration at three load seams (D-06)

**Analog:** D-150 stale-override drop pattern at three sites. Below is the canonical loop at line 526-536 (`mountOpenResponse`); the same shape repeats at lines 802-813 (`mainOpen`) and 999-1010 (locate-skeleton recovery).

**Existing D-150 stale-key drop** (lines 526-536):
```typescript
// 9. Compute stale-override keys (D-150). The summary's peaks list every
//    attachment that produced a peak; intersect saved overrides with this
//    list. Dropped names travel as `staleOverrideKeys` for the renderer's
//    Cmd+S persist-write-back.
const presentNames = new Set(summary.peaks.map((r) => r.attachmentName));
const restored: Record<string, number> = {};
const stale: string[] = [];
for (const [name, percent] of Object.entries(materialized.overrides)) {
  if (presentNames.has(name)) restored[name] = percent;
  else stale.push(name);
}
```

**Pattern for D-06 migration** (extends the same loop with attachmentName → regionName translation + lex-smallest collision rule + `migratedKeyCount` tracker):
```typescript
// Build attachmentName → regionName lookup from peaks (regionName is already
// loader-populated per src/core/sampler.ts:262 + 435 + 459 + 492).
const attachmentToRegion = new Map<string, string>();
for (const p of summary.peaks) {
  attachmentToRegion.set(p.attachmentName, p.regionName ?? p.attachmentName);
}
// Build regionName → contributing-attachment-names index for collision tiebreak.
const regionContributors = new Map<string, string[]>();
for (const [att, region] of attachmentToRegion) {
  const list = regionContributors.get(region) ?? [];
  list.push(att);
  regionContributors.set(region, list);
}
// All present region names (for orphan detection):
const presentRegions = new Set(attachmentToRegion.values());

const restored: Record<string, number> = {};   // KEY = regionName
const stale: string[] = [];                     // attachment names with no region match
let migratedKeyCount = 0;
for (const [savedKey, percent] of Object.entries(materialized.overrides)) {
  // Case A: savedKey is already a regionName (v1.3.1+ files OR non-indirected v1.3 files).
  if (presentRegions.has(savedKey)) {
    // Collision rule: lex-smallest contributing attachment wins. Skip if a
    // prior winning key already wrote this region (lex iteration order via sort).
    if (!(savedKey in restored)) restored[savedKey] = percent;
    continue;
  }
  // Case B: savedKey is an attachmentName (v1.3-era file). Migrate.
  const regionName = attachmentToRegion.get(savedKey);
  if (regionName !== undefined) {
    // Collision check: if this region already has a restored value, the
    // lex-smallest contributor wins (D-05 + REGION-05 same-rule reuse).
    if (regionName in restored) {
      const contributors = (regionContributors.get(regionName) ?? []).slice().sort();
      // Lex-smallest contributor wins; if savedKey is smaller, overwrite.
      if (savedKey === contributors[0]) restored[regionName] = percent;
      // else: existing entry wins; this savedKey is silently dropped (not stale — it migrated, just lost).
    } else {
      restored[regionName] = percent;
    }
    migratedKeyCount++;
    continue;
  }
  // Case C: savedKey matches neither a region nor a known attachment → stale.
  stale.push(savedKey);
}

// Pass migratedKeyCount alongside staleOverrideKeys to the renderer (extend
// MaterializedProject shape per D-06).
```

**All three sites** (526, 802, 999) get the SAME migration block. The lookup-table build (`attachmentToRegion`, `regionContributors`, `presentRegions`) is the new prelude; the loop body is the migration logic.

---

### `src/renderer/src/components/AppShell.tsx` — `Map<regionName, number>` + migration banner extension

**Analog 1 (overrides Map init):** existing line 331:
```typescript
const [overrides, setOverrides] = useState<Map<string, number>>(
  () => new Map(initialProject ? Object.entries(initialProject.restoredOverrides) : []),
);
```
Shape unchanged; key meaning flips from `attachmentName` to `regionName`. The `Object.entries(initialProject.restoredOverrides)` already-migrated payload arrives from project-io.ts already keyed on regionName (D-06 work happens main-side).

**Analog 2 (peak lookup at 512 + 1037):** existing call site at line 512:
```typescript
const peak = summary.peaks.find((p) => p.attachmentName === row.attachmentName);
```
Pattern post-migration (use `summary.regions` directly; `row` is now a RegionRow):
```typescript
const region = summary.regions.find((r) => r.regionName === row.regionName);
// or, more idiomatically: const region = row;  (RegionRow IS the row)
const stored = overrides.get(row.regionName);   // line 515 was overrides.get(row.attachmentName)
```

**Analog 3 (effective-summary aggregation at 1037):** existing line 1037:
```typescript
for (const r of effectiveSummary.peaks) {
  // ...overrides.has(r.attachmentName)...
}
```
Pattern: keep `effectiveSummary.peaks` for the CSV/clipboard path (per-attachment is the existing CLI contract via `effectiveSummary.peaks`), OR migrate the iteration to `effectiveSummary.regions` per the panel's new shape — planner picks based on whether CSV is per-attachment or per-region (CONTEXT.md §Integration Points implies the Global panel surface flips to regions, but `clipboardCopy` may stay per-attachment for parity with the CLI's byte-locked golden).

**Analog 4 (migration banner extension at 1713-1740):** existing `staleOverrideNotice` block:
```typescript
{staleOverrideNotice !== null && staleOverrideNotice.length > 0 && (
  <div
    role="status"
    className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
  >
    <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
    <span className="flex-1">
      {staleOverrideNotice.length} saved override
      {staleOverrideNotice.length === 1 ? '' : 's'} skipped — attachments
      no longer in skeleton:&nbsp;
      <span className="font-mono text-fg">
        {staleOverrideNotice.slice(0, 5).join(', ')}
      </span>
      {staleOverrideNotice.length > 5
        ? ` + ${staleOverrideNotice.length - 5} more`
        : ''}
    </span>
    <button
      type="button"
      onClick={() => setStaleOverrideNotice(null)}
      className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
    >
      Dismiss
    </button>
  </div>
)}
```

**Pattern for migration banner extension (D-06):** add a sibling state slot `migratedKeyCount: number | null` and either (a) extend the same banner with a second sentence, OR (b) render a sibling banner with the same visual idiom. Sibling-banner pattern is preferred (matches loaderModeHealedNotice which already lives below this block at line 1749). Class string is literal — Tailwind v4 Pitfall 8 (no template interpolation).

---

### `src/renderer/src/modals/AtlasPreviewModal.tsx` — `hoveredRegionName` + `onJumpToRegion` + tooltip third line

**Analog 1 (state machine, lines 100/281/555/613):**
```typescript
// Line 100:
const [hoveredAttachmentName, setHoveredAttachmentName] = useState<string | null>(null);
// Line 281 (passed into AtlasCanvas):
hoveredAttachmentName={hoveredAttachmentName}
setHoveredAttachmentName={setHoveredAttachmentName}
// Line 555 (canvas paint compares):
const isHovered = hoveredAttachmentName === region.attachmentName;
// Line 613 (lookup for tooltip):
const hoveredRegion = hoveredAttachmentName
  ? page.regions.find((r) => r.attachmentName === hoveredAttachmentName) ?? null
  : null;
```
**Pattern:** rename throughout to `hoveredRegionName`; the state-machine shape is unchanged (single string | null; setters wired through props). PackedRegion's `attachmentName` field flips to `regionName` so `region.regionName === hoveredRegionName` is the new comparison.

**Analog 2 (`onJumpToAttachment` prop at lines 70 + 286 + 606):**
```typescript
// Line 70:
onJumpToAttachment: (attachmentName: string) => void;
// Line 286:
onJumpToAttachment={props.onJumpToAttachment}
// Line 603-609:
const onDoubleClick = useCallback(
  (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(e);
    if (hit) onJumpToAttachment(hit.attachmentName);
  },
  [hitTest, onJumpToAttachment],
);
```
**Pattern:** clone the wiring to `onJumpToRegion: (regionName: string) => void`. CONTEXT.md "Claude's Discretion" leaves it open whether to deprecate `onJumpToAttachment` outright or run alongside; recommendation is full retarget (one prop, one wiring) since AppShell needs to lookup the region row anyway.

**Analog 3 (HoverTooltip subcomponent at lines 656-686):**
```typescript
function HoverTooltip({
  cursorPos,
  region,
}: {
  cursorPos: { x: number; y: number };
  region: PackedRegion;
}) {
  // ... position-flip logic (lines 663-669) ...
  return (
    <div
      role="tooltip"
      className="fixed z-[60] pointer-events-none px-3 py-2 rounded-md border border-border bg-modal text-fg text-sm font-mono shadow-xl max-w-[320px]"
      style={{ /* flip math */ }}
    >
      <div className="font-semibold break-all">{region.attachmentName}</div>
      <div className="text-xs text-fg-muted mt-0.5">
        {`${Math.round(region.w)} × ${Math.round(region.h)}`}
      </div>
    </div>
  );
}
```
**Pattern (D-07):** swap line 1 to `{region.regionName}.png`; line 2 unchanged (dims); add a conditional line 3:
```typescript
<div className="font-semibold break-all">{`${region.regionName}.png`}</div>
<div className="text-xs text-fg-muted mt-0.5">{`${Math.round(region.w)} × ${Math.round(region.h)}`}</div>
{region.attachmentNames.length > 1 && (
  <div className="text-xs text-fg-muted mt-0.5">
    {`used by ${region.attachmentNames.length} attachments`}
  </div>
)}
```
Position-flip math is unchanged; the H_ESTIMATE constant (line 665, currently `64`) may want a small bump to ~80 to accommodate the third line — flagged for layout-review per memory `feedback_layout_bugs_request_screenshots_early.md`.

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — consume `summary.regions`

**Analog:** existing peaks consumer at lines 760-772:
```typescript
const enriched = useMemo(
  () => enrichWithEffective(summary.peaks, overridesMap),
  [summary.peaks, overridesMap],
);
const filtered = useMemo(() => filterByName(enriched, query), [enriched, query]);
const sorted   = useMemo(() => sortRows(filtered, sortCol, sortDir), [filtered, sortCol, sortDir]);
const visibleKeys = useMemo(() => sorted.map((r) => r.attachmentKey), [sorted]);
```

**Pattern:** flip `summary.peaks` → `summary.regions`; `enrichWithEffective` swaps to a region-keyed equivalent (or accepts both via overload); `attachmentKey` selection key swaps to `regionName` (regionName IS unique per row, so `regionName` is the new selection key).

**Row label format (REGION-03):** `{regionName}.png` with `images/` prefix stripped:
```typescript
const label = row.regionName.replace(/^images\//, '') + '.png';
```

**`(used by N attachments)` indicator (D-08):** rendered next to the row label only when `row.contributingAttachments.length > 1`. Copy is Claude's discretion — Phase 19 quantified-callout style is the visual reference.

---

### `src/main/doc-export.ts:274` — region-keyed lookup

**Existing line 274:**
```typescript
const optimizedAssets = payload.summary.peaks.length;
```
**Pattern:** flip to `payload.summary.regions.length` — the doc chip strip ("Optimized Assets") should now reflect per-region count, matching the user-named surfaces (Global panel, Atlas Preview, Optimize, exported folder).

---

### `fixtures/Chicken-Min/` — stripped regression fixture (REGION-07)

**Analog:** `fixtures/SIMPLE_PROJECT/` directory structure:
```
fixtures/SIMPLE_PROJECT/
├── SIMPLE_TEST.atlas       (144 bytes — 3 regions: CIRCLE, SQUARE, TRIANGLE)
├── SIMPLE_TEST.json        (19200 bytes — skeleton + skins + animations)
├── SIMPLE_TEST.png         (42007 bytes — atlas page)
├── SIMPLE_TEST.stmproj     (290 bytes — saved overrides)
└── images/                 (per-region PNGs for atlas-less mode)
    ├── CIRCLE.png
    ├── SQUARE.png
    └── TRIANGLE.png
```

**Atlas content reference** (SIMPLE_TEST.atlas):
```
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

**Pattern:** `fixtures/Chicken-Min/` mirrors the same shape:
```
fixtures/Chicken-Min/
├── Chicken-Min.atlas        (subset — must include path-indirected region names like 5/7, 5/5/7/7)
├── Chicken-Min.json         (skeleton subset preserving the path-indirected attachment.path references)
├── Chicken-Min.png          (atlas page; 16×16 stub or smallest-viable PNG slice)
└── images/                  (optional — for atlas-less mode coverage; 1×1 stubs per Phase 22 G-01 precedent)
```

**Stripping strategy** (CONTEXT.md "Claude's Discretion" item 3): planner picks 1×1 stub vs 16×16 stub vs JSON+atlas-only-no-PNGs. Target <1MB committed. Phase 22 G-01 stub-region precedent (1×1 stubs for missing PNGs) is the established pattern. The path-indirected attachment names + matching `path` field references must survive the strip (those are the keys that drive the dedup test).

---

### Path-indirection vitest spec (new test file)

**Analog:** existing analyzer + atlas-preview tests on SIMPLE_PROJECT (vitest run from repo root).

**Pattern:** end-to-end test that loads `fixtures/Chicken-Min/`, calls the analyzer + atlas-preview + buildExportPlan, and asserts:
1. `summary.regions.length < summary.peaks.length` (path-indirected fixture; multiple attachments collapse to fewer regions).
2. Atlas Preview projection page count equals the fixture's actual atlas page count (PREVIEW-01).
3. Setting `overrides.set('5/7', 4 / canonicalW)` produces an `ExportRow` for `5/7.png` with `outW === 4` (REGION-04 + the falsified bug from `.planning/debug/path-indirected-duplicate-rows.md`).
4. REGION-05 lex tiebreak: equal-peak contributors attribute to the lex-smallest `attachmentName`.

---

## Shared Patterns

### structuredClone-safe IPC types (D-21 lock)
**Source:** `src/shared/types.ts:1-17` (file-top docblock).
**Apply to:** `RegionRow`, `RegionRow.contributingAttachments[]`, `AtlasPreviewInput.attachmentNames[]`, `PackedRegion.attachmentNames[]`.
```typescript
// Only plain primitives, arrays, and nested plain objects live here — every
// value is structuredClone-safe (no Map, no Float32Array, no class instances).
```
Every new field MUST be primitive | array of primitives | plain object of those.

### Lookup-key idiom: `regionName ?? attachmentName`
**Source:** `src/core/analyzer.ts:220, 349-350` + `src/core/sampler.ts:248, 410, 435, 459, 492`.
**Apply to:** every new fold/migration site that resolves a peak's region.
```typescript
const lookupKey = p.regionName ?? p.attachmentName;
```
Defensive fallback: synthetic test fixtures may omit `regionName`; behavior collapses to attachmentName-keyed lookup, which is correct for the no-indirection case.

### Lex tiebreak on attachmentName (REGION-05 — three uses, one rule)
**Source:** CONTEXT.md §specifics.
**Apply to:** (a) winning attachment for Source Animation + Frame columns; (b) lex-smallest contributor wins on override migration collisions; (c) lex-smallest contributor wins on equal-peak attribution in the Global panel.
```typescript
// One rule, three call sites:
return a.attachmentName.localeCompare(b.attachmentName) <= 0 ? a : b;
```

### Tailwind v4 literal-class discipline (Pitfall 8)
**Source:** every existing `className=""` in AppShell.tsx and AtlasPreviewModal.tsx.
**Apply to:** the new Global row `(used by N attachments)` indicator + migration banner extension + tooltip third line.
**Rule:** every `className` is a string literal — no template interpolation, no dynamic class concatenation.

### Banner pattern (Phase 8 D-150 + Phase 24 alert-bar precedent)
**Source:** `src/renderer/src/components/AppShell.tsx:1713-1742` (`staleOverrideNotice`) + L3 healed-notice block at 1749.
**Apply to:** the new override-migration banner.
**Visual idiom:** `border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2` + accent left-bar (`w-1 h-4 bg-accent`) + Dismiss button. Auto-clears on next successful Save.

### atlasSource shape duplication (NOT a named type)
**Source:** `src/shared/types.ts:459` comment: *"DO NOT extract a named type (precedent is duplication)."*
**Apply to:** if the new `RegionRow` carries an `atlasSource?` field, duplicate the inline `{ pagePath; x; y; w; h; rotated }` shape — do not factor.

### Layer 3 invariant (`src/core/` is DOM/sharp/electron-free)
**Source:** every file under `src/core/` (no React/electron/sharp/fs imports).
**Apply to:** analyzer.ts changes (D-01, D-02), atlas-preview.ts changes (D-03). These remain pure-TS, headless-testable in vitest.

---

## No Analog Found

None — every file in this phase has a strong analog in the existing codebase. Phase 29 is a re-key + IPC-additive phase; it touches every layer at sites with established precedent (D-150 stale-key drop, D-21 structuredClone-safe types, ExportRow.attachmentNames[] for collapsed-row arrays, dedupByAttachmentName for the fold, hoveredAttachmentName for the modal state machine).

---

## Metadata

**Analog search scope:**
- `src/shared/types.ts` (DisplayRow, ExportRow, AtlasPreviewInput, PackedRegion, SkeletonSummary)
- `src/core/analyzer.ts` (pickHigherPeak, dedupByAttachmentName, analyze, analyzeBreakdown)
- `src/core/atlas-preview.ts` (deriveInputs)
- `src/renderer/src/lib/atlas-preview-view.ts` (renderer mirror)
- `src/main/project-io.ts` (D-150 sites at 526, 802, 999)
- `src/renderer/src/components/AppShell.tsx` (overrides Map + banner block)
- `src/renderer/src/modals/AtlasPreviewModal.tsx` (state machine + HoverTooltip)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (consumer)
- `src/main/doc-export.ts` (line 274)
- `src/core/sampler.ts` (regionName population, read-only verification)
- `fixtures/SIMPLE_PROJECT/` (fixture structure)

**Files scanned:** 11.
**Analogs read:** 11 (each at the targeted line ranges identified by CONTEXT.md §canonical_refs).
**Pattern extraction date:** 2026-05-07.
