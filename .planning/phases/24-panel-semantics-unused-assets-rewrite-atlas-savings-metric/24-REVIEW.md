---
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/core/atlas-preview.ts
  - src/core/errors.ts
  - src/core/export.ts
  - src/core/usage.ts
  - src/main/summary.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/lib/atlas-preview-view.ts
  - src/renderer/src/lib/export-view.ts
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/UnusedAssetsPanel.tsx
  - src/shared/types.ts
  - tests/core/atlas-preview.spec.ts
  - tests/core/export.spec.ts
  - tests/core/loader-atlas-less.spec.ts
  - tests/core/loader-dims-mismatch.spec.ts
  - tests/core/summary.spec.ts
  - tests/core/usage.spec.ts
  - tests/renderer/unused-assets-panel.spec.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 24 restructures the "unused assets" concept from an attachment-visibility signal (sampler-driven) to a file-system orphan signal (images/ folder vs rig), introduces `OrphanedFile` and the `UnusedAssetsPanel`, and adds a pixel-savings-percentage chip to the Global Max Render panel header. The core logic (`findOrphanedFiles`, `buildSummary` I/O wiring, `UnusedAssetsPanel`) is clean, and the RTL test suite is thorough. However, two correctness defects are present that affect user-facing outputs.

---

## Critical Issues

### CR-01: `savingsPctMemo` excludes passthrough-copy rows, producing an overstated savings figure

**File:** `src/renderer/src/components/AppShell.tsx:703-713`

**Issue:** The savings-percentage memo only sums over `plan.rows` — the resize rows — while excluding `plan.passthroughCopies`. Passthrough-copy rows are source-size files that will be byte-copied without any pixel savings. By omitting their source pixels from `sumSourcePixels`, the denominator is understated, and `(1 − sumOutPixels / sumSourcePixels) * 100` inflates the savings percentage. For a project where two of three regions are passthrough (peakScale ≥ 1.0, already at source size), the chip could report savings near 100% when actual project-wide savings might be 30%.

```tsx
// CURRENT — denominator excludes passthrough rows:
const sumSourcePixels = plan.rows.reduce(
  (acc, r) => acc + r.sourceW * r.sourceH,
  0,
);
const sumOutPixels = plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0);

// FIX — include ALL rows in the baseline denominator:
const allRows = [...plan.rows, ...plan.passthroughCopies];
if (allRows.length === 0) return null;
const sumSourcePixels = allRows.reduce(
  (acc, r) => acc + r.sourceW * r.sourceH,
  0,
);
// Only resize rows produce pixel delta; passthrough rows contribute 0 net savings.
const sumOutPixels = [
  ...plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0),
  ...plan.passthroughCopies.reduce((acc, r) => acc + r.sourceW * r.sourceH, 0),
].reduce((a, b) => a + b, 0);
// Simpler equivalent:
const sumOutPixels2 =
  plan.rows.reduce((acc, r) => acc + r.outW * r.outH, 0) +
  plan.passthroughCopies.reduce((acc, r) => acc + r.sourceW * r.sourceH, 0);
if (sumSourcePixels <= 0) return null;
return (1 - sumOutPixels2 / sumSourcePixels) * 100;
```

The SIMPLE_TEST fixture has all three regions at peakScale ≥ 1.0, meaning with no overrides all rows end up in `passthroughCopies` — so `plan.rows.length === 0` short-circuits to `null` (which is correct for that case). But as soon as any region has a downscale override, the denominator omits all passthrough sibling sources, inflating the percentage. The same formula also feeds `exportPlanSavingsPct` in the Documentation Builder (AppShell.tsx:1646), propagating the overstatement into the exported HTML report.

---

### CR-02: `load.atlas!` non-null assertion in atlas-less mode is a latent crash risk

**File:** `src/main/summary.ts:145`

**Issue:** The orphaned-file detection uses `load.atlas!.regions` after checking `load.atlasPath !== null`. The `!` assertion suppresses TS's null-check. However, `LoadResult.atlas` is declared as `TextureAtlas` (not `TextureAtlas | null`) in `src/core/types.ts:72` — the loader always populates it, even in atlas-less mode (it synthesizes a `TextureAtlas` in-memory). So the assertion does not crash today. **But** the guard condition is logically inverted from what the comment implies: the code enters the `if (load.atlasPath !== null)` branch for atlas-mode and reads `load.atlas!.regions`, yet `load.atlas` is always non-null even when `atlasPath` is null. Any future refactor that makes `atlas` nullable to match `atlasPath` semantics would turn this into a runtime crash with zero TS warning — the `!` silences the type system's safety net.

```typescript
// CURRENT — brittle non-null assertion:
for (const region of load.atlas!.regions) {

// FIX — use the always-non-null field directly (drop the !):
for (const region of load.atlas.regions) {
```

The deeper issue is that `LoadResult` declares `atlas: TextureAtlas` (non-nullable) while `atlasPath: string | null`, creating a type-level inconsistency. A follow-up should widen `atlas` to `TextureAtlas | null` in `src/core/types.ts` to make the contract explicit, then update all call sites to be null-defensive — or document the invariant that atlas-less mode still produces a valid (synthesized) `TextureAtlas`.

---

## Warnings

### WR-01: `excludedUnused` is always an empty array — stale docblocks and API contract mismatch

**File:** `src/core/export.ts:142-147`, `src/renderer/src/lib/export-view.ts:207-210`

**Issue:** Phase 24 Plan 01 made `excluded` always an empty `Set<string>`. As a result, `ExportPlan.excludedUnused` is always `[]`. The `ExportPlan` interface docblock (shared/types.ts:289-291) still says "lists attachment names dropped by D-109 default (unused-by-sampler attachments are not exported)", and `BuildExportPlanOptions.includeUnused` is still declared and accepted as a parameter (export.ts:73-75 and export-view.ts:53-56). Callers passing `opts.includeUnused = true` will see zero behavioral difference — the option is a dead parameter.

Additionally, tests/core/export.spec.ts case (e) comment block header still says "ExportPlan.excludedUnused includes 'GHOST'" (line 16), which is now false — the test body was updated but the describe-block comment was not.

The fix is either: (a) remove `includeUnused` and `excludedUnused` from the public API if Phase 24 Plan 02 truly won't use them, or (b) document that they are temporarily vestigial pending Plan 02. Leaving them creates a dead-code API surface that callers may rely on in good faith.

```typescript
// FIX option A: remove the dead parameter from both copies
export function buildExportPlan(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  // Remove opts parameter entirely until Plan 02 re-introduces exclusion
): ExportPlan {
```

---

### WR-02: `UnusedAssetsPanel` uses `role="alert"` for a static informational panel

**File:** `src/renderer/src/panels/UnusedAssetsPanel.tsx:51`

**Issue:** `role="alert"` implies live-region semantics — screen readers announce it immediately when the content changes (equivalent to `aria-live="assertive"`). A panel showing orphaned PNG files is **not** an urgent, time-sensitive alert. The correct ARIA role for a panel surfacing non-critical informational content is `role="region"` with an `aria-label`, or simply a landmark element. Using `role="alert"` causes screen readers to interrupt whatever the user is doing and announce the panel when it mounts, which is disruptive and confusing.

```tsx
// CURRENT:
<div
  role="alert"
  aria-label="Orphaned image files"

// FIX — use a non-live-region role:
<div
  role="region"
  aria-label="Orphaned image files"
```

Note: `MissingAttachmentsPanel` presumably uses the same pattern (mirroring was mentioned in the panel docblock). If it does, it may warrant the same fix — though missing PNGs that break the rig could arguably be "alert"-level. The orphaned-files case is clearly non-urgent.

---

### WR-03: `deriveInputs` in `atlas-preview.ts` — `summary.peaks.find()` is O(N) inside an O(M) loop

**File:** `src/core/atlas-preview.ts:187`, `src/renderer/src/lib/atlas-preview-view.ts:178`

**Issue:** In the `'optimized'` branch of `deriveInputs`, for each `attachmentName` in every `row.attachmentNames`, the code calls `summary.peaks.find((p) => p.attachmentName === attachmentName)`. This is O(N) per lookup inside a loop that iterates across all attachment names — O(M×N) overall. For production rigs with hundreds of attachments across many bones, this degrades the atlas preview build time quadratically. This is classified as a **WARNING** rather than a performance issue (which is out of v1 scope) because the O(M×N) pattern is an indicator of a structural logic issue: the lookup duplicates work that should be done once.

```typescript
// FIX — build a Map before the loop for O(1) lookups:
const peakByName = new Map(summary.peaks.map((p) => [p.attachmentName, p]));
for (const row of plan.rows) {
  for (const attachmentName of row.attachmentNames) {
    if (excluded.has(attachmentName)) continue;
    const peak = peakByName.get(attachmentName);
    if (!peak) continue;
    // ... rest unchanged
  }
}
```

This fix must be applied identically to both `src/core/atlas-preview.ts` and `src/renderer/src/lib/atlas-preview-view.ts` to preserve the parity contract.

---

### WR-04: `attachmentNames.includes()` linear scan in dedup accumulator loop

**File:** `src/core/export.ts:230`, `src/renderer/src/lib/export-view.ts:293`

**Issue:** In the `buildExportPlan` dedup loop, the guard `!prev.attachmentNames.includes(row.attachmentName)` performs a linear scan on the growing `attachmentNames` array for every peak row that maps to an already-seen `sourcePath`. In the common case where many attachments share one source path (e.g., multiple skins reference the same region PNG), this becomes O(K) per insertion where K is the running count of names already accumulated. For a skin-heavy rig with dozens of skins all referencing the same texture page, this is quadratic.

```typescript
// FIX — track accumulated names in a Set inside the Acc struct:
interface Acc {
  row: DisplayRow;
  effScale: number;
  isCapped: boolean;
  attachmentNames: string[];
  attachmentNamesSet: Set<string>;  // add this
}
// ... in bySourcePath.set():
bySourcePath.set(row.sourcePath, {
  row, effScale, isCapped,
  attachmentNames: [row.attachmentName],
  attachmentNamesSet: new Set([row.attachmentName]),
});
// ... in the else branch:
if (!prev.attachmentNamesSet.has(row.attachmentName)) {
  prev.attachmentNames.push(row.attachmentName);
  prev.attachmentNamesSet.add(row.attachmentName);
}
// Before emitting, call acc.attachmentNames.slice() as now (unchanged).
```

Must be applied identically to both `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` for parity.

---

## Info

### IN-01: Stale comment in `export.ts` / `export-view.ts` docblock references removed field

**File:** `src/core/export.ts:1-13`, `src/renderer/src/lib/export-view.ts` (header docblock)

**Issue:** The module-top docblock for `src/core/export.ts` (lines 5-7) and the matching renderer copy header still reference "Phase 5 unusedAttachments list" and "Build excluded set from summary.unusedAttachments (D-109)" in the algorithm description, even though Phase 24 Plan 01 removed `unusedAttachments` from `SkeletonSummary`. The algorithm comment on line 9 (`"1. Build excluded set from summary.unusedAttachments"`) now describes code that no longer does that — the excluded set is always empty. These stale comments will mislead future readers.

**Fix:** Update the algorithm docblock to reflect the Phase 24 reality: the excluded set is intentionally empty pending Plan 02, and `opts.includeUnused` is currently a no-op.

---

### IN-02: `SkeletonSummary.orphanedFiles` is typed `optional` (`?`) in the interface but always populated by `buildSummary`

**File:** `src/shared/types.ts:562`

**Issue:** The field is declared as `orphanedFiles?: OrphanedFile[]` (optional), but `buildSummary` in `src/main/summary.ts` always populates it (even as `[]`). The renderer reads it with `orphanedFiles={effectiveSummary.orphanedFiles ?? []}` (AppShell.tsx:1551) as a workaround for the optional typing. The type and the runtime contract are misaligned. If the field is always present, it should be declared required (`orphanedFiles: OrphanedFile[]`) so callers don't need the defensive `?? []` fallback.

The docblock comment on lines 557-562 acknowledges this is "for IPC backward-compat with older serialized summaries." If this backward-compat concern is real, the `?? []` fallback is correct — but the type should be documented more clearly with a version note, and there should be a TODO to tighten it after a migration window.

**Fix:** Either (a) change `orphanedFiles?: OrphanedFile[]` to `orphanedFiles: OrphanedFile[]` and verify `buildSummary` (always sets it) and all consumers compile, or (b) keep it optional and add a JSDoc comment `@since Phase 24 — will be required in a future version`.

---

### IN-03: `UnusedAssetsPanel` expanded-state does not reset when `orphanedFiles` prop changes

**File:** `src/renderer/src/panels/UnusedAssetsPanel.tsx:29`

**Issue:** `const [expanded, setExpanded] = useState(true)` initializes once on mount. If the parent re-renders with a different `orphanedFiles` array (e.g., after a resample that changes which files are orphaned), the `expanded` state persists from the previous render. The user may have collapsed the panel; after a resample, the panel count might change but the collapsed state remains. This is a UX inconsistency rather than a crash, but it means the D-06 specification ("expanded by default when N > 0") is only honored on first mount.

Per CLAUDE.md notes on AppShell behavior: the `effectiveSummary` is replaced atomically after each resample, so the `orphanedFiles` reference changes. A key-based reset would fix this without a `useEffect`:

```tsx
// In AppShell.tsx where UnusedAssetsPanel is rendered:
<UnusedAssetsPanel
  key={effectiveSummary.orphanedFiles?.length ?? 0}  // reset on count change
  orphanedFiles={effectiveSummary.orphanedFiles ?? []}
/>
// Or inside UnusedAssetsPanel, reset expanded if orphanedFiles changes:
// useEffect(() => { setExpanded(true); }, [orphanedFiles]);
// (but hooks-before-early-return constraint means the useEffect must
//  still fire even when count is 0 — which is the current structure)
```

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
