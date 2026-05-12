---
phase: 35-region-keyed-export-plan
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/core/export.ts
  - src/renderer/src/lib/export-view.ts
  - tests/core/export.spec.ts
  - tests/core/export-rotation-dims.spec.ts
  - tests/core/loader-atlas-less.spec.ts
  - tests/core/loader-dims-mismatch.spec.ts
  - tests/core/sequence-attachment-fanout.spec.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 35 migrates `buildExportPlan` in both `src/core/export.ts` and the renderer mirror `src/renderer/src/lib/export-view.ts` from iterating `summary.peaks` (DisplayRow[], attachment-name-deduped) to iterating `summary.regions` (RegionRow[]). The math chain (override resolution, safety buffer, ceil-thousandth, clamp, cap) is unchanged; only the iteration source and the attachmentNames accumulator change. The parity contract between the canonical core file and the renderer view file is preserved verbatim — both files now contain the identical `for (const region of summary.regions)` loop and pull contributors via `region.contributingAttachments.map(c => c.attachmentName)`.

The core migration is correct and the parity is faithful. However, the review surfaced one BLOCKER caused by a drive-by addition to `tests/core/loader-atlas-less.spec.ts` that references a fixture which was never committed (matches a known previous regression — see `feedback_gitignore_fixtures_check_test_refs` memory). Several WARNINGs arise from divergences between the test-only `synthRegionsFromPeaks` helper and the production `analyzeRegions` semantics (winner tiebreak, contributor dedup), and from latent correctness gaps that the Phase 35 migration newly exposes (attachmentNames duplication on the initial-insert path, `excluded.has` keyed by `attachmentName` rather than `regionName`, untyped contributors merge in the rare two-regions-share-one-sourcePath case).

## Critical Issues

### CR-01: New test in `loader-atlas-less.spec.ts` depends on uncommitted fixture — will fail CI

**File:** `tests/core/loader-atlas-less.spec.ts:333-381`
**Issue:** Commit `e6426f2 feat(35-01)` added a new describe block ("atlas-less + Spine 4.2 non-essential-disabled mesh (DIMS-01 R5 + PNG-header fallback)") that hard-references `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json`. The fixture directory is present on the working tree but is **untracked** in git (verified via `git log --oneline -- fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/` returning empty; `git check-ignore` returns no match, so it is also not gitignored — simply not added).

Unlike Test 4 / Test 5 in `tests/core/export.spec.ts` (which guard with `if (!existsSync(jsonPath)) { console.warn(...); return; }`), the new describe block calls `loadSkeleton(FIXTURE)` unconditionally. On a fresh clone, or in CI, the call throws and the suite fails.

This is the exact failure mode locked by the user-level memory `feedback_gitignore_fixtures_check_test_refs.md` ("Verify test refs before gitignoring fixture dirs — v1.3.1 cleanup gitignored a 40K in-repo regression fixture and broke CI"). The mitigation is identical: either commit the fixture or add an `existsSync`-based skip guard.

This describe block is also out of scope for Phase 35 — Phase 35's stated purpose is the buildExportPlan iteration migration, not non-essential-data PNG-header recovery (DIMS-01 R5). The test should not have ridden along on the Phase 35 commit.

**Fix:** Choose one:

Option A — commit the fixture (preferred; matches Test purpose):
```bash
git add fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/
git commit -m "test(35): commit non-essential mesh fixture used by loader-atlas-less"
```

Option B — add a defensive skip guard (matches the export.spec.ts:2811-2815 pattern):
```typescript
it('mesh attachment without JSON width/height recovers canonical dims from PNG IHDR', () => {
  if (!fs.existsSync(FIXTURE)) {
    console.warn(`Skipping: fixture missing at ${FIXTURE}`);
    return;
  }
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // ...
});
```

Option C — revert the drive-by describe block out of the Phase 35 commit and land it as its own phase/PR alongside the fixture.

## Warnings

### WR-01: Initial-insert path does NOT dedup `attachmentNames` within one region's contributingAttachments

**File:** `src/core/export.ts:289-295` (and mirror `src/renderer/src/lib/export-view.ts:379-385`)
**Issue:** The merge branch (line 309-313) defensively dedupes:
```typescript
for (const c of region.contributingAttachments) {
  if (!prev.attachmentNames.includes(c.attachmentName)) {
    prev.attachmentNames.push(c.attachmentName);
  }
}
```
But the initial-insert branch does not:
```typescript
attachmentNames: region.contributingAttachments.map((c) => c.attachmentName),
```
Today this is safe because `toRegionRow` in `src/core/analyzer.ts:295-302` dedupes contributors via `seen.has(r.attachmentName)`. But if a future analyzer change loosens that invariant (e.g. WR-01 / Phase 29 Plan 29-06 reverted), duplicate `attachmentName` entries will silently propagate into ExportRow.attachmentNames and downstream UI surfaces, with no test catching it because every existing test fixture has unique attachmentNames per contributor.

The asymmetry is a tripwire. The Phase 35 migration is the first time export.ts reads `contributingAttachments` instead of fabricating `[row.attachmentName]`, which makes this asymmetry actionable for the first time.

**Fix:** Make the initial insert symmetric with the merge:
```typescript
const seen = new Set<string>();
const names: string[] = [];
for (const c of region.contributingAttachments) {
  if (!seen.has(c.attachmentName)) {
    seen.add(c.attachmentName);
    names.push(c.attachmentName);
  }
}
bySourcePath.set(region.sourcePath, {
  row: region,
  effScale,
  isCapped,
  bufferCapped,
  attachmentNames: names,
});
```
Apply byte-identically in `src/renderer/src/lib/export-view.ts` to preserve the parity contract.

### WR-02: `excluded.has(region.attachmentName)` should be `region.regionName` after the migration

**File:** `src/core/export.ts:191` (and mirror `src/renderer/src/lib/export-view.ts:286`)
**Issue:** The exclusion check
```typescript
if (excluded.has(region.attachmentName)) continue;
```
still keys off `region.attachmentName`, but the iteration source is now `summary.regions` (region-keyed) and Phase 29 D-04 locked overrides as `regionName`-keyed. If the Phase 24 Plan 02 exclusion surface is wired with regionName-keyed entries (consistent with Phase 29 D-04), this check will silently mismatch.

Today this is dormant because `excluded` is always empty (Phase 24 Plan 01 removed `unusedAttachments`; Plan 02 is still pending). But the Phase 35 migration is exactly the right moment to flip the key — leaving it on `attachmentName` is a latent inconsistency.

**Fix:**
```typescript
const excludeKey = region.regionName ?? region.attachmentName;
if (excluded.has(excludeKey)) continue;
```
Mirror in `export-view.ts`. Add a TODO referencing Plan 24-02 if the exclusion surface key shape is still TBD.

### WR-03: `synthRegionsFromPeaks` test helper diverges from production `toRegionRow` on tiebreak and contributor dedup

**File:** `tests/core/export.spec.ts:65-125`
**Issue:** The Phase 35 backfill helper synthesizes `RegionRow[]` from raw peaks literals but does not faithfully mirror production semantics:

1. **Winner tiebreak (line 78-80):** Uses strict-`>` so source-order wins on equal `peakScale`. Production `pickRegionWinner` (`src/core/analyzer.ts:268-273`) does lex-ASC tiebreak on `attachmentName`. The two coincide in every current test (because each test's peak literal order happens to also be lex-ASC), but a future test that reorders peaks could pass against this helper while failing in production.

2. **Contributor dedup (line 111-120):** No `Set` to dedupe by `attachmentName`. Production `toRegionRow` dedupes via `seen.has(r.attachmentName)` (analyzer.ts:295-302) to handle the case of one attachmentName bound to multiple slots. A synthetic peak list with that shape would emit duplicate `contributingAttachments` entries from this helper but unique entries from production.

3. **Field defaults (lines 87-89):** `slotName ?? 'TEST_SLOT'`, `animationName ?? 'PATH'` mask missing fields with literals that bear no relationship to production output — masks bugs where downstream consumers depend on real slot/animation names.

This divergence has not bitten any existing test, but it makes the helper a poor proxy for production output, weakening the validity of every Category B test that uses it (≈30 call sites).

**Fix:** Replace the helper body with a thin wrapper around `analyzeRegions`, or at minimum align the tiebreak and dedup with `pickRegionWinner` + `toRegionRow`:
```typescript
function synthRegionsFromPeaks(peaks: ReadonlyArray<any>): RegionRow[] {
  // Construct a temporary peaks Map matching analyzeRegions' input shape, then
  // delegate. Eliminates the divergence and uses the production tiebreak +
  // contributor dedup.
  const peaksMap = new Map<string, any>();
  const sourcePaths = new Map<string, string>();
  for (const p of peaks) {
    peaksMap.set(p.attachmentKey, p);
    const rn = p.regionName ?? p.attachmentName;
    if (p.sourcePath) sourcePaths.set(rn, p.sourcePath);
  }
  return analyzeRegions(peaksMap, sourcePaths);
}
```
If the existing wide-coverage tests need to keep working without a fixture rewrite, at minimum add a comment at the top of the helper documenting the divergences so a future author knows the helper is approximate, not faithful.

### WR-04: Tests 1, 2, 3 in the new Phase 35 describe block do not exercise the pre-migration bug surface

**File:** `tests/core/export.spec.ts:2592-2805` (Tests 1, 2, 3 in `describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration (DEDUP-04/05)')`)
**Issue:** Pre-Phase-35, `buildExportPlan` iterated `summary.peaks` and the multi-skin collapse to ≤K rows happened only because `analyze()` had already deduped peaks by attachmentName. The Phase 35 tests at line 2592-2805 construct raw peaks arrays that bypass `analyze()` — they pass `peaks: makePhase35MultiSkinPeaks()` directly into the summary. The raw 4-peak input therefore yields 4 rows under the OLD code path too (because the sourcePaths are distinct), and these tests would PASS against the pre-Phase-35 buildExportPlan as well.

The single test in this describe block that *does* exercise the pre-Phase-35 collapse is Test 4 (line 2807-2867, JOKERMAN_SPINE fixture), which calls `analyze(sampled.globalPeaks)` to get the attachment-name-deduped row stream. Tests 1, 2, 3 therefore over-state the suite's regression coverage.

This is a coverage problem, not a correctness bug — the production code is correct. But future engineers reading this describe block will believe the "160 → 23 collapse" failure mode is locked down by 5 tests; in reality only Test 4 (and the path-dependent Test 5 atlas-less invariant) actually drive that scenario, and Test 4 is wrapped in a defensive skip that quietly disables it when the fixture isn't present (it IS present, but the gating is fragile — see WR-05).

**Fix:** Either:
- Rewrite Tests 1-2 to feed peaks through `analyze()` first, so the pre-Phase-35 attachment-name dedup actually fires, then assert that buildExportPlan still emits 4 rows (post-migration) instead of the collapsed 2 (pre-migration).
- Document explicitly in each test header that Tests 1-3 are shape lock tests (one-row-per-region cardinality on raw peaks), not pre-/post-migration discriminators, and the discriminator is Test 4.

### WR-05: Phase 35 critical regression test silently skips when fixture is absent

**File:** `tests/core/export.spec.ts:2811-2815, 2876-2881`
**Issue:** Both Phase 35 Test 4 (`fixtures/SKINS/JOKERMAN_SPINE.json`) and Test 5 (`fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL`) use the pattern:
```typescript
if (!existsSync(jsonPath)) {
  console.warn(`Skipping: fixture missing at ${jsonPath}`);
  return;
}
```
`console.warn` does not register as a vitest skip — the test returns and is reported as PASSING. The fixture `fixtures/SKINS/` is currently untracked in git (no commits in `git log -- fixtures/SKINS/`). When CI runs on a fresh clone the JSON will be missing, the test silently passes, and the only signal is a buried console.warn line.

Test 4 is the single test in the Phase 35 describe block that actually exercises the "160 regions / 23 deduped attachments" failure mode. Silently skipping it means a future buildExportPlan regression that re-introduces attachment-name dedup will pass CI green.

**Fix:** Use `it.skipIf` or `describe.skip` so vitest reports the skip in the output:
```typescript
import { describe, expect, it } from 'vitest';
const FIXTURE_PRESENT = existsSync(path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json'));
const itIfFixture = FIXTURE_PRESENT ? it : it.skip;
// ...
itIfFixture('Test 4 — fixtures/SKINS/JOKERMAN_SPINE.json ...', () => { ... });
```
Or, preferably, commit `fixtures/SKINS/` so the test runs everywhere (mirrors the sequence-attachment-fanout.spec.ts:60-66 pattern, which at least uses `describe.skip` instead of silent return).

### WR-06: `relativeOutPath` is vulnerable to path-traversal via `..` in sourcePath

**File:** `src/core/export.ts:133-139` (and mirror `src/renderer/src/lib/export-view.ts:110-116`)
**Issue:** `relativeOutPath('/foo/images/../../../etc/passwd')` returns `'images/../../../etc/passwd'`. Phase 35 did not introduce this — it is pre-existing — but the migration's new iteration source means every `region.sourcePath` from the loader flows through this function, and the loader's atlas synthesis path (`src/core/synthetic-atlas.ts`) can in principle pass arbitrary region-name strings sourced from the .json file. A maliciously authored Spine .json with a region name containing `..` segments could thread through here.

The image-worker (out of scope for this review) joins `outPath` with `outDir`, which would let a malformed plan escape the user's chosen export directory.

**Fix:** Either reject `..` segments here defensively:
```typescript
const regionPart = idx >= 0
  ? normalized.slice(idx + '/images/'.length)
  : normalized.slice(normalized.lastIndexOf('/') + 1);
if (regionPart.split('/').some((seg) => seg === '..' || seg === '.')) {
  throw new Error(`Refusing to emit ExportRow with traversal segment: ${sourcePath}`);
}
return 'images/' + regionPart;
```
Or document the contract that the image-worker is responsible for path validation and add a corresponding assertion in image-worker (out of scope, but worth filing). The latter is acceptable if the image-worker already has the guard — but the docblock here doesn't reference one.

## Info

### IN-01: `synthRegionsFromPeaks` cast to `RegionRow` weakens type safety

**File:** `tests/core/export.spec.ts:65, 67, 83`
**Issue:** The helper signature is `function synthRegionsFromPeaks(peaks: ReadonlyArray<any>): RegionRow[]` and constructs the return value with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` plus a `const region: RegionRow = { ... }` assignment that relies on every required field being present. If `RegionRow` gains a required field in the future, this test helper will silently emit malformed rows that pass at the TypeScript layer (because the `any` input hides the missing field) but break behavior at runtime.

**Fix:** Replace the `any` parameter with a precise input type, or use `satisfies RegionRow` at the literal site to surface missing fields at compile time. Or delegate to `analyzeRegions` per WR-03.

### IN-02: Phase 22.1 G-04 commit block (lines 317-341) refers to "Phase 22.1 D-06" but the predicate is implemented in the emit loop

**File:** `src/core/export.ts:317-341` and `src/renderer/src/lib/export-view.ts:407-428`
**Issue:** The header comment for the emit loop is ~25 lines describing the four passthrough cases. The actual implementation is 4 lines (`outW` calc, `outH` calc, `effectiveSourceW` calc, `effectiveSourceH` calc, `isPassthrough` predicate). The comment block's narrative is stale relative to the rebased Phase 22.1 "post-restructure" predicate at line 364: cases (b), (c), (d) described in lines 329-339 no longer route through `passthroughCopies` because the cap-binding cases emit `outW = actualSourceW ≠ sourceW`. Tests at `tests/core/export.spec.ts:1586-1594, 1626-1638` confirm this routing change.

**Fix:** Update the cases (b), (c), (d) commentary to reflect that under the post-22.1 simple `outW === effectiveSourceW` predicate, drifted-cap-binding rows route to `rows[]` (resize), not `passthroughCopies`. Not load-bearing but reduces the cognitive cost for future readers.

### IN-03: Duplicate file path in `git status` Modified list (M flag) without corresponding planning entry

**File:** `tests/core/loader-atlas-less.spec.ts` (whole-file)
**Issue:** The file is reported as `M` in git status (committed to Phase 35 via `e6426f2`). Phase 35's stated scope is "buildExportPlan iteration migration." The Phase 35 changes to `loader-atlas-less.spec.ts` should be confined to:
- Adding `analyzeRegions` import
- Adding `regions: analyzeRegions(...)` to the summary literal at line 152-153

The new 50-line describe block at line 333-381 (non-essential data PNG-header fallback) is not in Phase 35's scope. See CR-01 for the BLOCKER consequence; this entry is the lower-severity hygiene flag for "phase commits should match phase plans."

**Fix:** Move the new describe block to a separate phase/PR with a fixture commit, per the GSD phase-gated workflow described in `CLAUDE.md` §"GSD workflow."

### IN-04: `Array.includes` for attachmentNames dedup is O(N) — acceptable for current scale but unbounded

**File:** `src/core/export.ts:310` (and mirror line 400)
**Issue:** The dedup `if (!prev.attachmentNames.includes(c.attachmentName))` is O(N) per probe; the inner loop is O(N²) on `region.contributingAttachments`. Today N is small (path-indirected regions have at most a dozen contributors in real Spine projects). Not a correctness issue; not in scope per project policy (performance out of v1).

**Fix (optional, future):** Use a `Set<string>` carried alongside `attachmentNames` to make dedup O(1) per probe. Not actionable now.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
