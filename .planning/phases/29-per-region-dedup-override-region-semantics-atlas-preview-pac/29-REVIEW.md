---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
reviewed: 2026-05-07T20:49:30Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - src/core/analyzer.ts
  - src/core/atlas-preview.ts
  - src/core/export.ts
  - src/main/doc-export.ts
  - src/main/override-migration.ts
  - src/main/project-io.ts
  - src/main/summary.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/components/DimsBadge.tsx
  - src/renderer/src/lib/atlas-preview-view.ts
  - src/renderer/src/lib/export-view.ts
  - src/renderer/src/modals/AtlasPreviewModal.tsx
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/shared/types.ts
  - scripts/strip-chicken.mjs
  - tests/core/analyzer.spec.ts
  - tests/core/atlas-preview.spec.ts
  - tests/core/export.spec.ts
  - tests/core/summary.spec.ts
  - tests/main/doc-export.spec.ts
  - tests/main/override-migration.spec.ts
  - tests/regression/path-indirection.spec.ts
  - tests/renderer/app-quit-subscription.spec.tsx
  - tests/renderer/atlas-preview-modal.spec.tsx
  - tests/renderer/dims-badge-tooltip.spec.tsx
  - tests/renderer/global-max-functional-setselected.spec.tsx
  - tests/renderer/global-max-missing-row.spec.tsx
  - tests/renderer/global-max-render-panel.spec.tsx
  - tests/renderer/global-max-virtualization.spec.tsx
  - tests/renderer/locale-compare-numeric-sort.spec.tsx
  - tests/renderer/override-migration-banner.spec.tsx
  - tests/renderer/rig-info-tooltip.spec.tsx
  - tests/renderer/save-load.spec.tsx
  - tests/shared/types.spec.ts
findings:
  blocker: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-05-07T20:49:30Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

Phase 29 introduces a per-region dedup pipeline (`analyzeRegions`/`RegionRow`),
flips the override Map from attachmentName to regionName keys, adds a load-time
attachmentName→regionName migration helper, and reshapes the atlas-preview to
emit one tile per region. The plan is internally consistent and the
`migrateOverrides` helper (with two-pass iteration-order independence) is well
tested.

The main correctness defect is in the **batch-select handoff between
GlobalMaxRenderPanel and AppShell.onOpenOverrideDialog**: the panel still passes
a Set of *attachmentNames* (`selectedAttachmentNames`) while AppShell now keys
the override Map by *regionName* and looks up `selectedKeys.has(rowKey)` where
`rowKey` is a regionName. On any path-indirected fixture (e.g. Chicken-Min,
which the regression suite explicitly exercises), batch overrides apply to the
wrong keys and silently miss every region whose name is not also an attachment
name. This is the inverse of the bug Plan 29-03 was supposed to close
(`.planning/debug/path-indirected-duplicate-rows.md`).

Secondary correctness concerns: `RegionRow.contributingAttachments` does not
dedup the per-attachment fan-out, so multi-slot bindings to the same
attachmentName show inflated counts in the panel and tooltip; and
`resampleProject` callers in `AppShell.runReload` / the resample useEffect
forward the renderer's possibly-poisoned overrides Map without the regionName
discipline AppShell relies on.

## Critical Issues

### CR-01: Batch override scope passes attachmentNames into a regionName-keyed Map (BLOCKER)

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:825-833`, `src/renderer/src/components/AppShell.tsx:511-585`

**Issue:** The panel's `selectedAttachmentNames` memo expands every selected
region into the union of its `contributingAttachments[].attachmentName` values
and hands that Set to `onOpenOverrideDialog` as `selectedKeys`:

```tsx
// GlobalMaxRenderPanel.tsx:825-833
const selectedAttachmentNames = useMemo(() => {
  const names = new Set<string>();
  for (const r of enriched) {
    if (selected.has(r.regionName)) {
      for (const c of r.contributingAttachments) names.add(c.attachmentName);
    }
  }
  return names;
}, [selected, enriched]);
```

AppShell, however, has been re-keyed for Phase 29 D-04 and now reads everything
in regionName terms:

```tsx
// AppShell.tsx:523-531
const rowKey =
  'regionName' in row && typeof (row as { regionName?: string }).regionName === 'string'
    ? (row as { regionName: string }).regionName
    : row.attachmentName;
const inSelection =
  selectedKeys !== undefined &&
  selectedKeys.has(rowKey) &&
  selectedKeys.size > 1;
const scope = inSelection ? [...selectedKeys] : [rowKey];
// ...
const anyOverridden = scope.some((name) => overrides.has(name));
// ...later, in onApplyOverride/onClearOverride:
for (const name of scope) next.set(name, clamped);
```

The `overrides` Map is now regionName-keyed (verified by
`src/core/export.ts:187` reading `row.regionName ?? row.attachmentName` and
`src/renderer/src/lib/export-view.ts:279` mirroring it). Consequences for any
path-indirected project (Chicken `5/7`, with contributors `5/5/5/7/7`,
`5/5/7/7`, `5/7`):

1. **`selectedKeys.has(rowKey)` is false for the indirected row.** When the
   user selects the row whose `regionName === '5/7'` and double-clicks it,
   `rowKey === '5/7'` while `selectedKeys` only contains expanded contributor
   names (`'5/5/5/7/7'`, `'5/5/7/7'`, `'5/7'`). For non-overlapping names
   (e.g. selecting only the indirected region whose regionName never appears as
   an attachmentName) `inSelection` is false and the batch silently degrades to
   per-row scope. The user thinks they applied an override to N regions and
   only got 1.
2. **`scope = [...selectedKeys]` writes attachmentNames into a regionName Map.**
   When the regionName *does* coincide with one of its contributors (the `5/7`
   case), `inSelection` resolves true and `scope` becomes
   `['5/5/5/7/7', '5/5/7/7', '5/7']`. `onApplyOverride` then runs
   `overrides.set(name, clamped)` for each, poisoning the regionName-keyed Map
   with two contributor-name keys (`5/5/5/7/7`, `5/5/7/7`) that
   `buildExportPlan` will read by `row.regionName ?? row.attachmentName` —
   matching contributor rows pick them up but the *winning* contributor
   continues to read the legitimate `5/7` entry. The dedup-by-sourcePath
   `keep-max` then makes the result depend on which row wins, exactly the
   falsified-bug regression closed by REGION-04.
3. **The next Save persists the polluted Map to .stmproj**, and on reopen the
   load-time `migrateOverrides` helper will treat `5/5/5/7/7` and `5/5/7/7` as
   Case B contributor entries that need to be migrated; if a Case A `'5/7'` is
   already present (from the legitimate user override), Pass 1 wins and the
   contributor entries are silently dropped — the polluted state self-heals on
   reload, but the in-flight UX is incorrect and the dirty signal flips
   spuriously.

The regression suite at `tests/regression/path-indirection.spec.ts` only
exercises the *single-row* override path (line 99: `new Map([['5/7', percent]])`
constructed directly), so this defect is not caught.

**Fix:** Stop expanding region selections into attachment names. Have the panel
hand AppShell the *regionName* selection set verbatim:

```tsx
// GlobalMaxRenderPanel.tsx — replace selectedAttachmentNames with `selected` (the regionName Set):
<Row
  ...
  selectedKeys={selected}   // already a Set<regionName>
/>
```

`selected` is already a `Set<regionName>` (line 760 + the `setSelected`
write sites). AppShell's `rowKey === row.regionName` lookup then finds the row
in the Set, `scope` becomes the user-selected regionNames, and
`onApplyOverride` writes regionName→percent into the regionName-keyed Map —
restoring the contract and removing the contributor-fan-out that Plan 29-03
explicitly tried to retire.

Then drop the now-unused `selectedAttachmentNames` memo
(GlobalMaxRenderPanel.tsx:825-833) and update the JSDoc at lines 38-44 + 818-824
which still reference the obsolete "convert to attachmentName" handoff.

Add a regression test in `tests/regression/path-indirection.spec.ts` that
shift-selects multiple regions in the panel, batch-overrides them, and asserts
both the resulting `overrides` Map keys and the export-plan output dims.

## Warnings

### WR-01: contributingAttachments contains duplicates when one attachmentName binds to multiple slots/skins

**File:** `src/core/analyzer.ts:341-358` (`dedupByRegionName`), `src/core/analyzer.ts:277-328` (`toRegionRow`), `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:576-580`

**Issue:** `analyzeRegions` operates on the *full* `globalPeaks` Map (not the
attachmentName-deduped output of `analyze()`), so when one attachmentName like
`5/7` binds to two slots (`VOLUME_7`, `VOLUME_8`) you get two PeakRecords with
identical `attachmentName` and `regionName`. `toRegionRow` maps each bucket
member 1:1 into `contributingAttachments[]` with no dedup:

```ts
const sortedBucket = [...bucket].sort((a, b) =>
  a.attachmentName.localeCompare(b.attachmentName),
);
const contributingAttachments = sortedBucket.map((r) => ({...}));
```

Chicken-Min has 4 PeakRecords resolving to region `5/7` (slots 7, 8, VOLUME_7,
VOLUME_8) — the third and fourth share `attachmentName='5/7'`, so
`contributingAttachments.length === 4` even though only 3 unique attachment
names exist. Visible consequences:

- `GlobalMaxRenderPanel.tsx:578` renders `(used by 4 attachments)` instead of
  `3` — wrong number to the user.
- `AtlasPreviewModal.tsx:697-700` HoverTooltip shows `used by N attachments`
  using `region.attachmentNames.length` (which in 'original' mode is also
  un-deduped — see `atlas-preview-view.ts:217-219`/`atlas-preview.ts:226-228`).
- The `selectedAttachmentNames` Set in the panel is correct (Set dedups), so
  the *Apply* path is unaffected; this is purely a count-display defect.

The regression test `REGION-01 detail` at
`tests/regression/path-indirection.spec.ts:60-69` happens not to catch this
because Chicken-Min only has TWO slots referencing attachmentName `5/7`
(`VOLUME_7`, `VOLUME_8`) — but the assertion is
`length).toBeGreaterThanOrEqual(2)` and `toContain('5/7')`, both of which still
pass with the duplicate.

**Fix:** Dedup contributors by `attachmentName` inside `toRegionRow` before
mapping into the array (the winner-pick already prefers the higher peakScale,
so picking arbitrarily on the dup is acceptable, but a consistent rule —
"first occurrence after sort" — is trivial):

```ts
function toRegionRow(regionName: string, winner: DisplayRow, bucket: readonly DisplayRow[]): RegionRow {
  const seen = new Set<string>();
  const sortedBucket = [...bucket]
    .sort((a, b) => a.attachmentName.localeCompare(b.attachmentName))
    .filter((r) => {
      if (seen.has(r.attachmentName)) return false;
      seen.add(r.attachmentName);
      return true;
    });
  // ...rest unchanged
}
```

Mirror the dedup in `atlas-preview.ts` deriveInputs 'original' branch
(`region.contributingAttachments.map(...)` is already dedup-clean once
contributingAttachments is fixed; the optimized branch reads
`ExportRow.attachmentNames` which `buildExportPlan` already dedups via
`if (!prev.attachmentNames.includes(...))`).

Add a unit test in `tests/core/analyzer.spec.ts` that emits two PeakRecords
with identical `attachmentName` + `regionName` (different `slotName`) and
asserts `contributingAttachments.length === 1`.

### WR-02: resampleProject and runReload forward renderer overrides without regionName discipline

**File:** `src/renderer/src/components/AppShell.tsx:977-991`, `src/renderer/src/components/AppShell.tsx:1383-1408`, `src/main/project-io.ts:1005-1008`

**Issue:** Both the explicit Reload (`runReload`) and the samplingHz-change
useEffect ship the renderer's `overrides` Map across IPC via
`Object.fromEntries(overrides)` and rely on main's `migrateOverrides` helper to
sanitize. This is correct for the happy path, but it has two failure modes:

1. **Re-migrating an already-region-keyed Map can silently drop entries.** If
   a regionName entry happens to *also* be a Spine attachment name in the new
   sampler output (which is structurally possible — regionName `5/7` and a
   contributing attachment named `5/7` are exactly the Chicken case), then
   `presentRegions.has('5/7') === true` so Pass 1 keeps it correctly — fine.
   But consider the inverse: a regionName whose name is no longer present in
   the resampled skeleton (animation deleted, slot renamed in upstream Spine)
   AND coincidentally matches an existing attachment name → Pass 2 lex-wins
   path can promote the wrong key. The override-migration test suite does not
   exercise the "renderer state already region-keyed, but with a key that is
   simultaneously a contributor in the new summary" scenario.
2. **Combined with CR-01:** if the renderer's Map is already polluted with
   contributor-name keys from a batch-override (CR-01 path), the resample IPC
   re-runs `migrateOverrides` and silently re-drops them — masking the bug.
   Without the migration banner asserting `migratedKeyCount === 0` for healthy
   sessions, the user has no signal that their Map was ever polluted.

**Fix:** Two complementary defenses:

1. In AppShell, gate the resample-reflux of overrides on a renderer-side
   regionName-validation step before calling `Object.fromEntries`. Drop any
   entry whose key is not a known regionName in the current `summary.regions`
   (similar to the current main-side intersect, but renderer-side so the
   user's edit history can never silently leak across IPC).
2. In `tests/main/override-migration.spec.ts`, add a Test 9 case: pass
   region-keyed input where the regionName matches one of the new summary's
   attachment names; assert no migration is recorded (`migratedKeyCount === 0`)
   and the entry is preserved verbatim. This pins the iteration-order
   independence claim against the renaming-edge case.

### WR-03: handleProjectReloadWithSkeleton drops migratedKeyCount → 0 on Locate-Skeleton recovery

**File:** `src/main/project-io.ts:812-815`

**Issue:** The locate-skeleton recovery path runs `migrateOverrides` against
the cached `mergedOverrides` from the failed-Open recovery payload. If those
overrides were v1.3-era contributor keys, the migration runs at recovery time
just like the normal Open. AppShell's `mountOpenResponse` (line 1144) reads
`project.migratedKeyCount` and surfaces the banner.

But the cached `mergedOverrides` come from the prior failed-Open response's
`SkeletonNotFoundOnLoadError` payload (see lines 437-450 setting
`mergedOverrides: materialized.overrides`). At that point the file's overrides
were *unprocessed* (load failed before sampleSkeleton ran), so they remain in
their on-disk representation — i.e. they could still be contributor-keyed v1.3
entries. The recovery flow's `migrateOverrides(a.mergedOverrides, summary)`
will produce a non-zero `migratedKeyCount`, the banner will fire, and on next
Save the rewritten file is regionName-keyed. So this happens to work.

The defect is structural: the type of `MaterializedProject.migratedKeyCount`
is `number` (required), but `handleProjectReloadWithSkeleton` reads from a
freshly-built object — fine. However the original failed-Open envelope arm
(`SkeletonNotFoundOnLoadError`, `SerializableError` line 774-785) does NOT
carry `migratedKeyCount`, so AppShell's `skeletonNotFoundError` state slot
(line 418-427) would be unable to surface a migration that already happened
during the partial materialize before the loader failure. This is a UX gap
rather than a correctness bug — the user will see the migration banner only
after the locate-skeleton recovery succeeds, not during the error state.

**Fix:** Add `migratedKeyCount?: number` to the `SerializableError`
SkeletonNotFoundOnLoadError arm in `src/shared/types.ts:773-785`, populate it
from `materialized.overrides` at the rescue-branch in
`project-io.ts:438-451` (run `migrateOverrides` on the materialized state
even though the loader will fail), thread it into AppShell's
`skeletonNotFoundError` state slot, and surface the banner in the
ErrorPanel. Lower-impact alternative: leave the gap and document it
explicitly in the JSDoc on `MaterializedProject.migratedKeyCount`.

### WR-04: atlas-preview optimized-mode N² lookup over summary.regions

**File:** `src/core/atlas-preview.ts:194-216`, `src/renderer/src/lib/atlas-preview-view.ts:185-207`

**Issue:** Both byte-identical copies of `deriveInputs` 'optimized' branch do
this for every export row:

```ts
for (const row of [...plan.rows, ...plan.passthroughCopies]) {
  // ...
  const regionRow = summary.regions.find((r) => r.sourcePath === row.sourcePath);
  if (!regionRow) continue;
  // ...
}
```

`summary.regions.find` is O(N) per row. On the full Chicken (~533 regions),
`buildAtlasPreview` runs in ~280 000 string compares per call, and the modal
calls this on every mode toggle / pager change / overrides change. While
Phase 29 is functionally correct, the comment at line 199-203 admits it's
"defensive — should not happen post-29-01: every ExportRow.sourcePath has a
matching RegionRow.sourcePath" — yet the code still pays the N² cost on every
invocation. This degrades the modal toggle responsiveness on production rigs.

(Performance is technically out-of-scope for v1, but this is also a
correctness concern: silently skipping unmatched rows via
`if (!regionRow) continue;` will hide a future regression where an ExportRow's
sourcePath drifts away from its RegionRow's sourcePath — the test suite
verifies they match on Chicken-Min, but no assertion guards the contract long-
term.)

**Fix:** Build a `Map<sourcePath, RegionRow>` once at the top of
`deriveInputs`:

```ts
const regionsBySourcePath = new Map<string, RegionRow>();
for (const r of summary.regions) regionsBySourcePath.set(r.sourcePath, r);
```

Convert the `find` call to `regionsBySourcePath.get(row.sourcePath)`. If the
lookup misses, surface as a console.warn (or an explicit invariant violation
if the team prefers) rather than silently dropping the row — the silent skip
masks loader/analyzer drift bugs.

### WR-05: AppShell.runReload deps include samplingInFlight, causing closure churn

**File:** `src/renderer/src/components/AppShell.tsx:970-1024`

**Issue:** The `runReload` useCallback dep array (lines 1015-1024) includes
`samplingInFlight`. Every time the boolean toggles (which happens every
Sampler progress 0/100 event from `onSamplerProgress`), the callback identity
churns, which in turn invalidates `onClickReload` (line 1051 deps) and the
`appShellMenuRef.current` re-registration useEffect (line 1511-1532). The
result is hundreds of menu-ref re-bindings during a single sample because the
samplingInFlight boolean rapidly flips on/off; under heavy resample load this
also defeats the appShellMenuRef stale-closure protection (the `current` slot
holds an old impl until the next setState commit lands).

**Fix:** Read `samplingInFlight` from a ref (mirror the
`pendingConfirmResolve` ref pattern at line 470-477) so the callback can
observe the latest boolean without re-entering the dep array. Or guard with
a leading-edge check: write a `runReload` body that captures
`samplingInFlight` from a `useRef` updated by the same `setSamplingInFlight`
sites.

```tsx
const samplingInFlightRef = useRef(false);
const setSamplingInFlightAndRef = (v: boolean) => {
  samplingInFlightRef.current = v;
  setSamplingInFlight(v);
};
// in onSamplerProgress: if (percent === 0) setSamplingInFlightAndRef(true);
// in runReload: if (samplingInFlightRef.current) { ... }
```

Then drop `samplingInFlight` from `runReload`'s deps.

### WR-06: scripts/strip-chicken.mjs hardcodes a developer-specific absolute path

**File:** `scripts/strip-chicken.mjs:46-49`

**Issue:** The fallback source-path resolver hardcodes
`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/Chicken/SYMBOLS.json`,
which is the original developer's machine path. Any other contributor running
`node scripts/strip-chicken.mjs` from a different worktree (or any CI
environment that bind-mounts the repo at a different path) silently misses
the fallback and aborts — the script is documented as one-shot and idempotent,
but the hardcoded path is a contributor-experience trap.

**Fix:** Replace the hardcoded path with an environment variable lookup
(`process.env.CHICKEN_SOURCE_PATH`) plus a documented `npm run` shortcut, or
walk up the worktree tree to find a sibling `Spine_Texture_Manager` checkout
generically. At minimum, log the absolute path of `process.cwd()` before the
candidate scan so contributors can see why the lookup failed.

## Info

### IN-01: peaksArray spread sets isMissing: undefined explicitly, leaking into IPC payload

**File:** `src/main/summary.ts:95-98, 115-118, 317-321`

**Issue:** Three spreads create `{ ...row, isMissing: skippedNames.has(name) ? true : undefined }`.
Setting a property to `undefined` is a different shape from omitting the
property — `structuredClone` preserves the `undefined` value across the IPC
boundary, and consumers reading `row.isMissing` see `undefined` rather than
absent. The TS type is `isMissing?: boolean`, so the runtime shape is legal,
but the docblock at `src/shared/types.ts:144-147` says
"Optional/undefined is equivalent to false — backward-compatible with existing
IPC payloads"; explicitly threading `undefined` in every row inflates the
serialized payload by one key per row across all three arrays.

**Fix:** Use a conditional spread for the truthy case only:
`{ ...row, ...(skippedNames.has(p.attachmentName) ? { isMissing: true } : {}) }`.

### IN-02: AppShell overrideMigrationNotice initializer redundantly checks initialProject !== null

**File:** `src/renderer/src/components/AppShell.tsx:394-402`

**Issue:** The lazy initializer for `overrideMigrationNotice` checks
`initialProject !== null && initialProject !== undefined && ...`. Because the
prop type is `initialProject?: MaterializedProject` (= `MaterializedProject |
undefined`), it's never explicitly `null` — only `undefined`. The redundant
null check is dead code and adds noise to the read.

**Fix:** Drop the `!== null` clause:

```tsx
const [overrideMigrationNotice, setOverrideMigrationNotice] = useState<number | null>(
  () =>
    initialProject !== undefined &&
    typeof initialProject.migratedKeyCount === 'number' &&
    initialProject.migratedKeyCount > 0
      ? initialProject.migratedKeyCount
      : null,
);
```

### IN-03: migrateOverrides repeats the isValid validator across two passes

**File:** `src/main/override-migration.ts:115-116, 130-131`

**Issue:** Both Pass 1 (line 116) and Pass 2 (line 130) call `isValid(percent)`
on the same `entries` iteration. For a saved store with 100 entries, the
validator runs 200 times. Correctness is unaffected (the validator is pure)
but the repetition is unnecessary.

**Fix:** Pre-filter entries once at the top:

```ts
const validEntries = Object.entries(savedOverrides).filter(([, v]) => isValid(v)) as [string, number][];
// then iterate validEntries in both passes
```

### IN-04: Stub region synthesis duplicates skin-walk logic across summary.ts

**File:** `src/main/summary.ts:135-202, 209-288, 324-389`

**Issue:** Three near-identical for-loops walk `skeletonData.skins` looking
for the first slot binding of a missing attachmentName, with subtly different
output shapes (DisplayRow stub, RegionRow stub, BreakdownRow stub). The skin
walk is verbatim across all three, and any future change to the skin-traversal
contract has to be made in three places (slot.bone wiring, multi-skin priority,
nested attachment maps). This is the kind of duplication that becomes a defect
multiplier the next time the loader changes.

**Fix:** Extract a `findFirstBinding(skinList, attachmentName, slotList)`
helper that returns `{ skinName, slotName }`; have all three stub-synthesis
paths consume it. Same for the canonical-dim resolution + `SETUP_LABEL`
constant (currently shadowed three times).

---

_Reviewed: 2026-05-07T20:49:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
