---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/core/analyzer.ts
  - tests/regression/path-indirection.spec.ts
  - tests/core/analyzer.spec.ts
  - tests/arch.spec.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 29: Code Review Report (Gap-Closure 29-05 + 29-06)

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Scope: the gap-closure changes for Plans 29-05 (CR-01) and 29-06 (WR-01) at HEAD vs c35b9d3 — five files covering the panel selection-passthrough fix, the analyzer contributor dedup, and the three test files locking those contracts.

The advertised gap fixes are mechanically correct in isolation:
- `toRegionRow` correctly dedups `contributingAttachments[]` by `attachmentName` using a Set + lex-sorted filter; the lex-sort is preserved.
- `GlobalMaxRenderPanel.tsx` removes the contributor-fan-out memo; both Row prop sites now pass `selected` verbatim as `selectedKeys`.
- `selectedAttachmentNames` is fully expunged from in-tree source. The `.bak3` backup file is gitignored (`*.bak*`) and untracked, so it cannot taint the `arch.spec.ts` / regression-test source-grep guards (which read explicit paths anyway).

However, one BLOCKER survived this gap-closure pass — the panel's *read-side* override lookup (`enrichWithEffective` line 262) still keys by `row.attachmentName`, while AppShell's override Map is now `regionName`-keyed (Plan 29-03 + 29-05 contract). On path-indirected fixtures where the lex-smallest contributor's attachmentName differs from the regionName (e.g. Chicken-Min: lex winner `5/5/5/7/7` vs regionName `5/7`), the panel's display code can never see the override — the orange Peak cell, PencilIcon, "override" search keyword, and DimsBadge cap-binding wording all silently fail. The export pipeline still applies the override correctly (it reads `row.regionName ?? row.attachmentName`), so the user observes a screen-vs-disk divergence with no diagnostic surface.

The new tests close the WRITE side of the override contract (CR-01 batch-apply assertions in `path-indirection.spec.ts:282-384`, the WR-01 dedup assertions in `analyzer.spec.ts:937-1021`) but neither covers the READ side (`enrichWithEffective` → `EnrichedRow.override`). This is why the bug slipped through 29-05 verification.

Three secondary issues worth fixing: a non-deterministic-by-design contributor `peakScale` in cross-slot binding (analyzer dedup picks first lex-stable occurrence rather than highest peakScale per attachmentName), a stale code comment, and two slightly weak test assertions.

## Critical Issues

### CR-01: panel `enrichWithEffective` reads overrides by `row.attachmentName`, but Map is now `regionName`-keyed — silent display divergence on path-indirected rigs

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:262`

**Issue:**
The `enrichWithEffective` helper still queries the override Map by `row.attachmentName`:
```ts
const override = overrides.get(row.attachmentName);
```
The accompanying comment at lines 259-261 / 250-252 acknowledges the migration-in-progress state: *"Plan 29-03 will flip overrides to Map<regionName, number>; until then..."*. Plan 29-03 has shipped (commit `2bea027 feat(29-03): regionName-keyed overrides end-to-end + migration banner UI + export-read flip`), and Plan 29-05's CR-01 fix completes the WRITE side: `AppShell.tsx:523-526` derives `rowKey = row.regionName ?? row.attachmentName` and `AppShell.tsx:583` writes `next.set(name, clamped)` keyed by regionName.

The panel READ side was never updated. For path-indirected regions where the REGION-05 lex-tiebreak winner's `attachmentName` differs from the `regionName` (Chicken-Min's region `5/7` has `winner.attachmentName === '5/5/5/7/7'`), `overrides.get('5/5/5/7/7')` returns `undefined`. Cascade:

1. `EnrichedRow.override` is `undefined` even when an override is set.
2. `Row` cell at line 632 omits the `text-accent` class — Peak cell stays the wrong colour.
3. `PencilIcon` (line 655) is not rendered — no visual signal of the override.
4. `displayScale` and `peakDisplayW/H` are computed without the override percent (computeExportDims with `override=undefined` falls back to peakScale).
5. `state` (line 1090, 1214) is computed from a wrong `peakDisplayW`, so the green/yellow tint and left-accent bar are wrong.
6. `filterByName` "override" keyword (line 304-306) cannot find overridden rows whose contributor names diverge from regionName.
7. `DimsBadge.effectiveScale` prop (line 600-606) reads `row.override` directly → cap-binding-aware tooltip wording is wrong.

The export pipeline (`src/core/export.ts:187-188`) reads `overrideKey = row.regionName ?? row.attachmentName`, so the on-disk export DOES apply the override correctly. Net effect: user sees full-size rendering in the panel, exports a 50%-scaled PNG, with no diagnostic.

This bug predates the current gap-closure pass (introduced in `0011f0d feat(04-03)`, missed by 29-02 and 29-03), but the CR-01 closure attempt at this same data path means the gap is in scope for this review. The CR-01 batch-apply test in `path-indirection.spec.ts:282-384` asserts the WRITE side (`buildExportPlan` outW) but never the READ side (panel `EnrichedRow.override` for the same region).

**Fix:**
Update line 262 to query by regionName, with the standard fallback idiom used throughout the codebase:
```ts
// AppShell stores overrides keyed by regionName post-Plan-29-03 + 29-05.
// Fallback to attachmentName preserves the no-indirection case (regionName
// === attachmentName) and synthetic test fixtures that omit regionName.
const override = overrides.get(row.regionName ?? row.attachmentName);
```
Also remove the now-stale comment at lines 250-252 / 259-261 and update the prop docblock at line 152 ("AppShell still treats `row.attachmentName`..."). Add a panel-level test (jsdom or behavior-level) that:
1. Builds a path-indirected synthetic summary where `row.regionName !== row.attachmentName`.
2. Builds an `overrides` Map keyed by `regionName`.
3. Calls `enrichWithEffective(rows, overrides)` and asserts `enriched[0].override === <expected percent>`.

## Warnings

### WR-01: contributor dedup discards higher-peakScale slot binding when one attachmentName binds to multiple slots

**File:** `src/core/analyzer.ts:290-297`

**Issue:**
The Plan 29-06 dedup keeps the FIRST occurrence in `[...bucket].sort((a,b) => a.attachmentName.localeCompare(b.attachmentName))`. When two `DisplayRow` records share an `attachmentName` but differ in `slotName` and `peakScale` (e.g. attachment `X` bound to slots A + B with peakScales 0.3 and 0.9 respectively, both resolving to the same `regionName`), the `localeCompare` is 0 for the duplicate pair, so post-sort order falls back to stable-sort iteration of the input bucket — i.e. Map insertion order from `dedupByRegionName`. The kept contributor entry's `peakScale` is therefore the FIRST inserted slot's value (0.3), not the maximum (0.9).

The row-level `winner` from `pickRegionWinner` correctly captures peakScale 0.9 (across all slots), so the row's top-level scalars (`row.peakScale`, `row.skinName`, `row.slotName`, etc.) are correct. But the per-contributor entry exposed via `RegionRow.contributingAttachments[]` carries the lower number, leading to internal inconsistency: the row says peak=0.9 while the lone contributor entry for that name says peak=0.3.

The tests that lock this contract (`analyzer.spec.ts:937-985`, `path-indirection.spec.ts:60-82`) all use EQUAL peakScales across slots (0.7/0.7), so they cannot expose the ambiguity. The Phase 29 D-09 contract reserves per-attachment detail for `AnimationBreakdownPanel`, but the renderer in `atlas-preview-view.ts:217-219` reads `region.contributingAttachments` for excluded-attachment filtering — if a future surface reads `contributor.peakScale` for any user-visible purpose, this becomes a bug. Today it's a data-quality / consistency warning.

**Fix:**
Pick the per-attachmentName highest-peakScale record before lex-stripping duplicates, so the kept contributor matches the per-attachment maximum. Two-step approach preserves determinism:
```ts
// Group by attachmentName first so the dedup picks the per-name peak, not
// an arbitrary slot binding. Equal-peakScale ties on (skinName, slotName)
// for stability.
const perName = new Map<string, DisplayRow>();
for (const r of bucket) {
  const prev = perName.get(r.attachmentName);
  if (prev === undefined) perName.set(r.attachmentName, r);
  else perName.set(r.attachmentName, pickHigherPeak(prev, r));
}
const sortedBucket = [...perName.values()].sort((a, b) =>
  a.attachmentName.localeCompare(b.attachmentName),
);
```
Add a test in `analyzer.spec.ts` that pins this: two slot bindings of attachmentName `X` (regionName `R`) with peakScales 0.3 + 0.9; assert the contributor entry's `peakScale === 0.9`.

### WR-02: stale code comment claims Plan 29-03 is pending

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:152, 248-252, 259-262`

**Issue:**
Three separate comments still reference Plan 29-03 as future work:
- Line 152 (prop docblock): *"Phase 29 (Plan 29-02 Task 3): row is now a RegionRow (one row per source PNG). AppShell still treats `row.attachmentName` (RegionRow's REGION-05 winning contributor) as the override key — Plan 29-03 will flip the override Map to `Map<regionName, number>`."*
- Line 248-252 (function docblock): *"The override Map is still keyed on the attachmentName at this checkpoint — Plan 29-03 owns the Map<regionName, number> flip."*
- Line 259-261 (inline): *"Plan 29-03 will flip overrides to Map<regionName, number>; until then..."*

Plan 29-03 shipped 6 commits ago (`2bea027`). These comments mislead anyone tracing the override pipeline and rationalize the bug at line 262 (CR-01 above). They must be updated as part of the CR-01 fix — leaving them in place after the read-side flip would create new contradictions.

**Fix:**
After the CR-01 fix lands (line 262 → `overrides.get(row.regionName ?? row.attachmentName)`), rewrite all three comments to describe the post-29-05 state plainly:
```ts
// AppShell's overrides Map is regionName-keyed (Plan 29-03 + 29-05).
// Fallback to attachmentName for synthetic test fixtures and the
// no-indirection case where the loader stored maps under entryName.
const override = overrides.get(row.regionName ?? row.attachmentName);
```

### WR-03: regression-test source-grep guards over-anchor on string-literal panel JSX

**File:** `tests/arch.spec.ts:128`, `tests/regression/path-indirection.spec.ts:320`

**Issue:**
Both test files lock the post-CR-01 contract via `panelSrc.match(/selectedKeys=\{selected\}/g)` — an exact JSX-literal match. This catches the immediate regression class (re-introducing a `selectedAttachmentNames` intermediate) but breaks under innocent refactors that preserve the contract:
- Renaming `selected` to `selectedRegionKeys` for clarity.
- Lifting both Row blocks into a shared sub-component that destructures props.
- Switching from JSX prop-attribute to spread (`{...rowProps}` where `rowProps.selectedKeys = selected`).

In any of those cases the test fails CI even though the contract is intact.

The negative-match guard `expect(panelSrc).not.toMatch(/selectedAttachmentNames/)` is a stronger anti-regression anchor on its own. The positive `selectedKeys=\{selected\}` count is redundant once the symbol-removal guard is in place.

**Fix:**
Either drop the positive `selectedKeysHits >= 2` assertion (keep only the negative `selectedAttachmentNames` guard, which catches the actual regression class), or rewrite as a behavior-level assertion:
1. Render the panel in jsdom with mock summary.regions including a path-indirected region.
2. Open the override dialog via simulated double-click + simulated shift-select.
3. Assert the `onOpenOverrideDialog` mock receives a `selectedKeys` set containing only regionNames (not contributor attachmentNames).

This is what the prompt's CR-01 closure asked for ("regression test that shift-selects multiple regions in the panel, batch-applies an override") — the current node-env source-grep is a proxy, not the test.

## Info

### IN-01: WR-01 test does not lock the contributor-pick rule when peakScales differ across slots

**File:** `tests/core/analyzer.spec.ts:937-985`, `tests/regression/path-indirection.spec.ts:60-82`

**Issue:**
The new tests asserting the Plan 29-06 dedup contract use equal peakScales across slot bindings (`peakScale: 0.7` on both VOLUME_7 and VOLUME_8 in `analyzer.spec.ts:951-963`; the Chicken-Min fixture coincidentally has identical scales). This makes the kept-entry assertion at line 982-984 (`expect(['VOLUME_7', 'VOLUME_8']).toContain(...)`) permissive enough to pass under any tiebreak rule, including ones that vary per Map insertion order or per JS engine sort stability.

If WR-01 above is addressed (peak-aware contributor dedup), this test must be tightened to assert the WINNER slot. If WR-01 is rejected as not-a-bug, the test should at least document the "first-after-lex-sort" rule explicitly with synthetic peakScales differing across slots, so a future engine sort-stability change becomes a CI failure rather than a silent semantic shift.

**Fix:**
Add an assertion that locks the chosen rule explicitly. Either:
- (if WR-01 fixed) `expect(row.contributingAttachments[0].peakScale).toBe(0.9)` with a 0.3/0.9 slot pair.
- (if WR-01 deferred) Document and assert the first-insertion rule with differing peakScales, and add a comment naming the JS spec-mandated stable sort property as the load-bearing invariant.

### IN-02: synthetic-summary helper omits `winner.peakScale` consistency check

**File:** `tests/regression/path-indirection.spec.ts:541-694` (`buildSyntheticBatchApplySummary`)

**Issue:**
The helper hand-builds `RegionRow` scalars (peakScale, sourceW, etc.) and `contributingAttachments[]` entries independently, with no assertion that the winner's scalars match the lex-smallest contributor's scalars at peak ties. The `5/7` region at lines 591-619 sets `peakScale: 1.0` on the row scalar AND on every contributor — consistent today, but a copy-paste edit could decouple them silently.

Not a current bug; future-proofing concern. Synthetic summaries that diverge from the analyzer's invariants would mask real bugs in downstream consumers (`buildExportPlan`, `buildAtlasPreview`).

**Fix:**
Add a sanity assertion at the top of the test block, immediately after `buildSyntheticBatchApplySummary()`:
```ts
// Sanity: synthetic summary must satisfy the toRegionRow invariant
// (winner.peakScale === max contributor peakScale).
for (const region of synth.regions) {
  const maxPeak = Math.max(...region.contributingAttachments.map((c) => c.peakScale));
  expect(region.peakScale).toBe(maxPeak);
}
```

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
