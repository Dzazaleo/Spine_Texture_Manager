---
phase: 25-missing-attachments-in-context-display
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/shared/types.ts
  - src/main/summary.ts
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - tests/core/summary.spec.ts
  - tests/renderer/global-max-missing-row.spec.tsx
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 25 adds `isMissing: true` marking on DisplayRow/BreakdownRow entries whose source PNG was absent at load time, and synthesizes stub rows for attachments the sampler never recorded. The renderer panels gain a 'missing' RowState variant that renders a red left-border accent and a warning icon. The implementation is structurally sound and the IPC contract is well-guarded. However, four issues were identified that affect correctness or test reliability.

---

## Warnings

### WR-01: Stub rows appended to `peaksArray` break the D-16 sort contract

**File:** `src/main/summary.ts:171`

**Issue:** `peaksArray` is built from `peaksArrayRaw`, which is already sorted by `(skinName, slotName, attachmentName)` per the `byCliContract` comparator in `analyzer.ts`. The Phase 25 stub-injection loop (lines 110–174) calls `peaksArray.push(stubRow)` after the sort has already been applied. Stubs are appended to the end in `skippedAttachments` insertion order, not sorted into the correct position. This breaks the `D-16` invariant that `peaks[]` is sorted by `(skinName, slotName, attachmentName)`. The existing `summary.spec.ts` D-16 sort test at line 63 will silently pass only if the fixture happens to produce no skipped attachments (the SIMPLE_PROJECT atlas-mode fixture has all PNGs present, so no stubs are injected and the sort test never exercises the affected path).

**Fix:** Sort `peaksArray` after the stub-injection block using the same comparator:

```typescript
// After the if (skippedNames.size > 0) { … } block:
peaksArray.sort((a, b) => {
  if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
  if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
  return a.attachmentName.localeCompare(b.attachmentName);
});
```

---

### WR-02: The marking-contract test in `summary.spec.ts` replicates `buildSummary`'s internal logic instead of calling it

**File:** `tests/core/summary.spec.ts:232-295`

**Issue:** The "Phase 25 PANEL-03 — buildSummary marking contract" test (lines 232–295) constructs `mockPeaks` and `mockSkipped` arrays, then manually replicates the `skippedNames.has(p.attachmentName) ? true : undefined` map-and-mark logic from `summary.ts`. It never calls `buildSummary`. This means the test does not catch bugs in `buildSummary`'s actual code path — it only verifies that `Set.has()` works. The integration test at line 333 covers `skippedAttachments` population but never asserts `isMissing: true` on any row in `summary.peaks` or `summary.animationBreakdown`. The gap-fix code path (stub-row synthesis for attachments not in `globalPeaks`) has zero integration coverage: no test verifies that a stub row appears in `summary.peaks` with `isMissing: true` after calling `buildSummary`.

**Fix:** Add an integration test that calls `buildSummary` with the `SIMPLE_PROJECT_NO_ATLAS_MESH` fixture (missing PNG case) and asserts:

```typescript
// After the INTEGRATION test at line 333:
it('Phase 25: stub rows appear in summary.peaks with isMissing:true (integration)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-phase25-'));
  // ... copy fixture, omit MESH_REGION.png ...
  const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
  const sampled = sampleSkeleton(load);
  const summary = buildSummary(load, sampled, 0);
  const missingRow = summary.peaks.find((p) => p.attachmentName === 'MESH_REGION');
  expect(missingRow).toBeDefined();
  expect(missingRow!.isMissing).toBe(true);
  // D-16 sort still holds after stub injection:
  const re_sorted = [...summary.peaks].sort((a, b) => {
    if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
    if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
    return a.attachmentName.localeCompare(b.attachmentName);
  });
  expect(summary.peaks).toEqual(re_sorted);
});
```

---

### WR-03: `DimsBadge` ariaLabel interpolates `undefined` when `actualSourceW/H` are undefined

**File:** `src/renderer/src/components/DimsBadge.tsx:47`

**Issue:** `DimsBadge` early-returns `null` when `!row.dimsMismatch` (line 40). A row can theoretically have `dimsMismatch: true` while `actualSourceW` or `actualSourceH` is `undefined` — the type signature (`number | undefined`) permits this combination even though the `buildSummary` semantics document that `dimsMismatch` is only `true` when `actualSourceW/H` are both present. If this combination occurs, the `ariaLabel` string becomes `"Source dims differ from canonical: source undefined×undefined, canonical N×N"`, which is a confusing accessible label surfaced to screen readers.

The `isMissing: true` stub rows set `dimsMismatch: false`, so they do not trigger this path. But future code changes that set `dimsMismatch: true` without populating `actualSourceW/H` would silently produce a broken label.

**Fix:** Guard the interpolation:

```typescript
const ariaLabel =
  `Source dims differ from canonical: source ${row.actualSourceW ?? '?'}×${row.actualSourceH ?? '?'}, ` +
  `canonical ${row.canonicalW}×${row.canonicalH}` +
  (isCapped ? ... : '');
```

Or add an explicit early-return guard before constructing `ariaLabel`:

```typescript
if (!row.dimsMismatch || row.actualSourceW === undefined || row.actualSourceH === undefined) {
  return null;
}
```

---

### WR-04: `AnimationBreakdownPanel` renders stub rows only in the `setup-pose` card — other cards show nothing for missing attachments

**File:** `src/main/summary.ts:209-210`

**Issue:** The breakdown stub injection is gated on `card.cardId === 'setup-pose'` (line 210). This means animation cards (e.g., `anim:WALK`) that reference a missing attachment will show zero rows for that attachment, while the setup-pose card shows the stub with the warning icon. The comment at line 201 says "stubs are injected into the setup-pose card only" as a deliberate design choice, but the implementation means a user who clicks an animation card (e.g., WALK) expecting to see a warning for MESH_REGION sees nothing — an empty-looking card or a reduced count — while the same attachment shows a danger indicator in the Global tab and the setup-pose card. There is no user-visible signal in per-animation cards that explains why a referenced attachment is absent.

This is the intended behavior per the comment but it creates a user-facing inconsistency: `uniqueAssetCount` for animation cards reflects only actually-sampled rows, while the setup-pose card count includes the stub. A user could misinterpret "3 unique assets referenced" in WALK as meaning all 3 are healthy.

**Fix (minimal):** Either inject stubs into ALL cards (not just setup-pose), or update the per-animation `countLabel` to include a parenthetical warning when the card has skipped attachments in its declared skin attachment set. At minimum, add a code comment documenting why this is intentional (beyond the existing comment) so a future maintainer does not accidentally close this gap without evaluating the UX tradeoff.

---

## Info

### IN-01: `onQueryChange` prop is required on `AnimationBreakdownPanel` but never called from within the panel

**File:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:120,316`

**Issue:** `onQueryChange` is listed as a REQUIRED prop in `AnimationBreakdownPanelProps` (line 120) and destructured at line 305, but it is never invoked anywhere inside the component (confirmed at line 316's own comment: "never invoked from this panel"). The prop exists purely to satisfy a props-symmetry contract with `GlobalMaxRenderPanel`. While the comment explains the intent, having a required prop that is deliberately dead is a maintenance hazard: it cannot be detected by linters and callers must provide a value for a parameter that does nothing.

**Fix:** Change `onQueryChange` to optional (`onQueryChange?: (q: string) => void`) in `AnimationBreakdownPanelProps`. This makes the dead-prop status explicit at the type level and removes the obligation on standalone callers (tests, future surfaces) to pass a no-op.

---

### IN-02: Duplicated skin/slot-walk logic in `buildSummary` for stub synthesis

**File:** `src/main/summary.ts:119-135` and `src/main/summary.ts:219-235`

**Issue:** The skin/slot-walk for resolving `skinName` and `slotName` from a `skippedAttachments` entry is copy-pasted verbatim between the `peaksArray` stub block (lines 119–135) and the `animationBreakdown` stub block (lines 219–235). Both blocks are 16 lines of identical logic. A future bug fix or schema change to `skin.attachments` indexing would need to be applied in two places.

**Fix:** Extract to a module-scoped helper before the `buildSummary` function:

```typescript
function findSkinAndSlot(
  skeletonData: SkeletonData,
  attachmentName: string,
): { skinName: string; slotName: string } {
  for (const skin of skeletonData.skins) {
    for (let slotIdx = 0; slotIdx < skin.attachments.length; slotIdx++) {
      const perSlot = skin.attachments[slotIdx];
      if (perSlot === undefined || perSlot === null) continue;
      if (Object.prototype.hasOwnProperty.call(perSlot, attachmentName)) {
        const slotName =
          slotIdx < skeletonData.slots.length
            ? skeletonData.slots[slotIdx].name
            : attachmentName;
        return { skinName: skin.name, slotName };
      }
    }
  }
  return { skinName: 'default', slotName: attachmentName };
}
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
