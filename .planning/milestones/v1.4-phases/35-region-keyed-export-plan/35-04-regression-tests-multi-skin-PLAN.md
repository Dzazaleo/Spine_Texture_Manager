---
phase: 35-region-keyed-export-plan
plan: 04
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - tests/core/export.spec.ts
autonomous: true
requirements: [DEDUP-04, DEDUP-05, DEDUP-06]
must_haves:
  truths:
    - "A unit test feeds a synthetic summary with N regions sharing K < N attachment names through buildExportPlan and asserts the result has N total entries (rows + passthroughCopies)"
    - "A fixture-driven test loads fixtures/SKINS/JOKERMAN_SPINE.json end-to-end (loader → sampler → analyze + analyzeRegions → synthetic summary → buildExportPlan) and asserts row count === summary.regions.length === 160"
    - "Backward-compat regression: SIMPLE_PROJECT-shaped synthetic (regionName === attachmentName, contributingAttachments.length === 1) produces the same ExportRow count and shape as pre-Phase-35"
    - "The override-per-region binding (Phase 29 D-04) is locked with explicit `effScale === 0.25` (50%-override row) and `effScale === 0.5` (non-overridden row) assertions — WARNING 3 fix"
    - "Atlas-less integration test exists in tests/core/export.spec.ts and asserts ExportRow count equals summary.regions.length on `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json` — BLOCKER 3 fix; codifies the loaderMode-agnostic invariant"
    - "The new tests fail when run against pre-Phase-35 code (they LOCK the fix, not just document it)"
    - "BLOCKER 2 fix: Test 4 (fixture-driven SKINS integration) uses the EXACT inline loader helper pattern from tests/core/atlas-preview.spec.ts:56-77 — NOT `buildSummary` from src/main/summary.ts (which imports node:fs and is a Layer 3 violation in core tests)"
  artifacts:
    - path: "tests/core/export.spec.ts"
      provides: "Phase 35 regression block — multi-skin region-keyed iteration coverage + atlas-less mode-agnostic coverage"
      contains: "Phase 35 — multi-skin"
  key_links:
    - from: "tests/core/export.spec.ts (Phase 35 describe block)"
      to: "fixtures/SKINS/JOKERMAN_SPINE.json"
      via: "loadSkeleton + sampleSkeleton + analyze + analyzeRegions (inline pattern from atlas-preview.spec.ts:56-77)"
      pattern: "fixtures/SKINS/JOKERMAN_SPINE"
    - from: "tests/core/export.spec.ts (Phase 35 describe block, Test 5)"
      to: "fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json"
      via: "same inline loader helper applied to an atlas-less fixture"
      pattern: "MeshOnly_TEST"
---

<objective>
Add regression tests that lock the Phase 35 fix in five layers:

1. **Synthetic unit test** — a fabricated SkeletonSummary with N=4 regions sharing K=2 attachment names. Feeds into buildExportPlan. Asserts plan.rows + plan.passthroughCopies totals 4 (not 2). This is the minimal-information test — runs in milliseconds, exercises the iteration source directly, no fixture dependency.

2. **Synthetic override-per-region test (WARNING 3 fix)** — same 4-region fixture as Test 1, with a 50% override on ONE region's regionName. Asserts the overridden row's `effScale === 0.25` (= 0.5 peakScale × 0.5 override percent) AND the non-overridden sibling row's `effScale === 0.5`. Locks the per-region override binding path via `applyOverride` AND the regionName-keyed override Map (Phase 29 D-04). The explicit numeric effScale checks (NOT just `outW`) make the per-region binding falsifiable at the math-chain level.

3. **Single-skin backward-compat synthetic test** — verifies SIMPLE_PROJECT-shaped synthetic input (regionName === attachmentName, single contributor per region) produces ExportRow counts identical to pre-Phase-35. Confirms the iteration source change is observationally equivalent on non-indirected inputs.

4. **Fixture-driven SKINS integration test (BLOCKER 2 fix)** — loads fixtures/SKINS/JOKERMAN_SPINE.json end-to-end via the EXACT inline loader helper pattern from `tests/core/atlas-preview.spec.ts:56-77` (NOT `buildSummary` from src/main/summary.ts, which imports node:fs and is a Layer 3 violation in core tests). Asserts `plan.rows.length + plan.passthroughCopies.length === summary.regions.length === 160`. Locks the real-world scenario the user reported.

5. **Atlas-less integration test (BLOCKER 3 fix)** — loads fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json via the same inline loader helper applied to the atlas-less mode. Asserts `plan.rows.length + plan.passthroughCopies.length === summary.regions.length` (proves mode-agnosticism: atlas-less also produces region-keyed plans). Locks the strict loaderMode-separation invariant (per memory `project_strict_loadermode_separation.md`).

Purpose: Without these tests, a future refactor could silently regress the fix. The tests are the durable artifact — they encode the behavioral contract in CI. The atlas-less test (BLOCKER 3 fix) specifically lifts atlas-less coverage from manual UAT (Plan 03 Task 2 step 12) into the CI tier, which is required because the strict loaderMode-separation invariant has historically been undertested in CI.

Output: A new `describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration', () => { ... })` block appended to tests/core/export.spec.ts containing all 5 `it()` cases above.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/debug/skins-optimize-undercount.md
@CLAUDE.md

# Post-plan-01+02 source — tests run against the migrated function
@src/core/export.ts
@src/renderer/src/lib/export-view.ts

# Existing test patterns to follow + the canonical loadSummary helper template (BLOCKER 2 fix source)
@tests/core/export.spec.ts
@tests/core/atlas-preview.spec.ts

# RegionRow shape (needed for synthetic fixture construction)
@src/shared/types.ts

# Analyzer exports used by the inline helper (analyze + analyzeRegions signatures)
@src/core/analyzer.ts

<interfaces>
<!-- Existing test infrastructure the new tests build on. -->

From tests/core/export.spec.ts head (the imports + helper patterns; read in full before writing new tests so the new block follows existing style):
- Imports: `import { describe, expect, it } from 'vitest';` + `import { readFileSync } from 'node:fs';` + `import path from 'node:path';`
- Existing describe-block naming convention: `describe('buildExportPlan — case (X) {short description} ({DECISION-IDs})', ...)` — follow this convention for the new Phase 35 block.
- Synthetic-summary fixture construction pattern (see lines 75-148 for case (b) — a 25% override on TRIANGLE peakScale ≈ 2.0): build a `summary` object with `peaks: [...]` containing the fields buildExportPlan reads. **POST-PLAN-01-TASK-0: ALSO populate `regions: [...]` with the equivalent RegionRow set** — the function iterates summary.regions, not summary.peaks. Plan 01 Task 0 already backfilled every existing literal; new tests in this plan MUST follow the same pattern from the start.

**BLOCKER 2 — canonical inline loader helper template (from tests/core/atlas-preview.spec.ts:56-77):**

```typescript
function loadSummary(jsonPath: string): SkeletonSummary {
  const load = loadSkeleton(jsonPath);
  const sampled = sampleSkeleton(load);
  const peaks = analyze(sampled.globalPeaks);
  const peaksWithPath = peaks.map((r) => ({
    ...r,
    sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
  }));
  const sourcePaths = new Map<string, string>();
  for (const p of sampled.globalPeaks.values()) {
    const regionName = p.regionName ?? p.attachmentName;
    sourcePaths.set(regionName, '/fake/' + regionName + '.png');
  }
  const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
  return { peaks: peaksWithPath, regions, orphanedFiles: [] } as unknown as SkeletonSummary;
}
```

This helper MUST be used for the SKINS integration test (Test 4) and the atlas-less integration test (Test 5).

**DO NOT use `buildSummary` from `src/main/summary.ts`** — that function imports `node:fs` and `node:path`, takes a 3-argument signature `(load: LoadResult, sampled: SamplerOutput, elapsedMs: number)`, and lives in the main process (Layer 3, not Layer 1). Importing it in a `tests/core/` test would violate the strict layering enforced by tests/arch.spec.ts and would also fail to compile because the function expects pre-processed `LoadResult` + `SamplerOutput` objects (not a raw skeleton path).

**Exports needed at the top of tests/core/export.spec.ts (some may already be imported):**
```typescript
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze, analyzeRegions } from '../../src/core/analyzer.js';
import { buildExportPlan } from '../../src/core/export.js';
import type { ExportPlan, RegionRow, SkeletonSummary } from '../../src/shared/types.js';
```
After Plan 01 Task 0's backfill, `analyzeRegions` is already imported. Verify via `grep -n "from '../../src/core/analyzer.js'" tests/core/export.spec.ts` and `grep -n "from '../../src/core/loader.js'" tests/core/export.spec.ts` — if either is missing, add it.

From src/shared/types.ts RegionRow shape (line 216): see the full interface. **Minimum fields buildExportPlan reads off a RegionRow:**
- regionName (string)
- attachmentName (string — winning contributor)
- peakScale (number)
- sourceW, sourceH (number)
- canonicalW, canonicalH (number)
- actualSourceW, actualSourceH (number | undefined)
- dimsMismatch (boolean)
- sourcePath (string)
- atlasSource (optional)
- contributingAttachments (Array<{ attachmentName: string; ... }> — used to populate ExportRow.attachmentNames)

Synthetic RegionRow construction can OMIT the preformatted label fields (originalSizeLabel, peakSizeLabel, scaleLabel, sourceLabel, frameLabel) — buildExportPlan does not read them. Cast through `as unknown as SkeletonSummary` if TypeScript complains about partial RegionRow.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add synthetic-fixture regression tests (Tests 1, 2, 3) — N regions, K attachment names, N != K + WARNING 3 explicit-effScale override assertions</name>
  <files>tests/core/export.spec.ts</files>
  <read_first>
    - tests/core/export.spec.ts (read in full, focus on lines 42-310 for synthetic-summary construction patterns; the Phase 29 D-04 test block at lines 2078+ is also a strong precedent for region-keyed assertion structure; confirm Plan 01 Task 0 has backfilled `regions:` into existing literals before appending new tests)
    - src/core/export.ts (post-plan-01 state; the function this test exercises)
    - src/shared/types.ts lines 216-293 (RegionRow interface — needed for the synthetic fixture)
  </read_first>
  <action>
**Append a new describe block to tests/core/export.spec.ts. Place it AFTER the existing Phase 29 D-04 region-keyed-override-read describe block (around line 2078) and BEFORE any module-hygiene / parity describe blocks at the end of the file. Use search to locate the right insertion point (preserve existing structure).**

Add the describe block titled:
```typescript
describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration (DEDUP-04/05)', () => {
  // ...tests
});
```

Inside the describe, add these `it()` cases:



**Test 1 — Multi-skin synthetic: 4 regions, 2 unique attachment names, expect 4 ExportRows (rows + passthroughCopies combined).**

Construct a synthetic SkeletonSummary that simulates the SKINS-fixture undercount in miniature:
- 4 RegionRows in `summary.regions`, each with a distinct `regionName`:
  - `AVATAR/CARDS_L_HAND_1` (winning attachmentName: `CARDS_L_HAND_1`)
  - `BUSINESS/CARDS_L_HAND_1` (winning attachmentName: `CARDS_L_HAND_1`)
  - `AVATAR/BODY` (winning attachmentName: `BODY`)
  - `BUSINESS/BODY` (winning attachmentName: `BODY`)
- All 4 RegionRows share the SAME 2 base attachmentNames (`CARDS_L_HAND_1` and `BODY`) — this is the multi-skin collapse scenario.
- Each RegionRow has a UNIQUE sourcePath (e.g. `/fake/images/AVATAR/CARDS_L_HAND_1.png`, `/fake/images/BUSINESS/CARDS_L_HAND_1.png`, etc.) — mimics atlas-source per-skin folder layout.
- canonicalW/H = sourceW/H = some reasonable value (e.g. 100×100); peakScale = 0.5 (well below the ≤ 1.0 clamp so it's clearly a non-passthrough downscale row); dimsMismatch: false; actualSourceW/H: undefined.
- contributingAttachments: a single-entry array per region with the matching attachmentName, skinName, slotName, peakScale, animationName: 'TEST', time: 0, frame: 0, isSetupPosePeak: false.

For `summary.peaks` — populate with the equivalent 2-entry attachment-name-deduped array (matching what `analyze() + dedupByAttachmentName` would produce on this synthetic input: one DisplayRow for `CARDS_L_HAND_1`, one for `BODY`). **This is the explicit demonstration of the bug** — pre-Phase-35 buildExportPlan would iterate peaks and emit ≤ 2 ExportRows. Post-Phase-35 it iterates regions and emits 4.

Cast around missing SkeletonSummary fields: `summary as unknown as SkeletonSummary` is acceptable in test code; the function only reads `.regions` (post-Phase-35) and a few related fields. Look at how case (b) at line 75+ does this cast for an established pattern.

Call `buildExportPlan(synthSummary, new Map(), undefined)`. Assert:
- `plan.rows.length + plan.passthroughCopies.length === 4` (one per region, NOT one per attachment name).
- Each ExportRow.sourcePath is unique across the 4 entries.
- Sort by sourcePath then verify the 4 expected sourcePaths are present (compare against the synthetic input's sourcePath set).
- For each ExportRow: `row.attachmentNames` is a length-1 array containing the matching base attachmentName (`CARDS_L_HAND_1` or `BODY`). This confirms the new `region.contributingAttachments.map(c => c.attachmentName)` accumulator wired through correctly.



**Test 2 — Multi-skin synthetic with override on one region: override binds per-region (Phase 29 D-04 preserved) — WARNING 3 EXPLICIT effScale ASSERTIONS.**

Reuse the same 4-region fixture from Test 1. Set `overrides.set('AVATAR/CARDS_L_HAND_1', 50)` (50% override on the AVATAR variant only). Call `buildExportPlan(synthSummary, overrides, undefined)`. Assert:

- `plan.rows.length + plan.passthroughCopies.length === 4` (count unchanged — override doesn't change cardinality).
- **WARNING 3 — explicit effScale binding (NEW assertions added during plan revision):**
  - Find the AVATAR/CARDS_L_HAND_1 row (the 50%-override target):
    ```typescript
    const avatarCards = allRows.find((r) => r.sourcePath.endsWith('AVATAR/CARDS_L_HAND_1.png'));
    expect(avatarCards).toBeDefined();
    // 50% override × peakScale 0.5 = effScale 0.25 (raw applyOverride output, before safeScale ceil-thousandth).
    // safeScale(0.25) === 0.25 exactly (no rounding artifact — 0.25 is a clean multiple of 1/1000).
    expect(avatarCards!.effectiveScale).toBeCloseTo(0.25, 6);
    expect(avatarCards!.outW).toBe(25); // ceil(100 × 0.25) = 25
    ```
  - Find the BUSINESS/CARDS_L_HAND_1 row (the non-overridden sibling):
    ```typescript
    const businessCards = allRows.find((r) => r.sourcePath.endsWith('BUSINESS/CARDS_L_HAND_1.png'));
    expect(businessCards).toBeDefined();
    // No override on this region's regionName ('BUSINESS/CARDS_L_HAND_1' is NOT in the overrides Map).
    // applyOverride with empty override returns effScale === peakScale = 0.5.
    expect(businessCards!.effectiveScale).toBeCloseTo(0.5, 6);
    expect(businessCards!.outW).toBe(50); // ceil(100 × 0.5) = 50
    ```
  - The two effScale values being distinct (`0.25 !== 0.5`) is the falsifying property: if the override were keyed by attachmentName (`'CARDS_L_HAND_1'`) instead of regionName, BOTH rows would have effScale 0.25 (or both would have 0.5, depending on which contributor "won" the dedup), and the per-region binding would be broken.

This locks success criterion #6 from the ROADMAP: "Override resolution per region still keyed by `regionName` (Phase 29 D-04 preserved)" — at the math-chain level, not just at the outW level.



**Test 3 — Backward-compat: single-skin synthetic (regionName === attachmentName, contributingAttachments.length === 1) produces identical output before/after migration.**

Construct a synthetic SkeletonSummary with 3 RegionRows where `regionName === attachmentName` for each:
- `CIRCLE` (regionName: CIRCLE, attachmentName: CIRCLE, contributingAttachments: [{ attachmentName: 'CIRCLE', ... }])
- `SQUARE` (...same pattern)
- `TRIANGLE` (...same pattern)
Each with unique sourcePath, peakScale 0.7, canonicalW/H 200×200.

Populate `summary.peaks` with the equivalent 3-DisplayRow array (regionName === attachmentName === sourcePath-derived name).

Call `buildExportPlan(synthSummary, new Map(), undefined)`. Assert:
- `plan.rows.length + plan.passthroughCopies.length === 3` (matches both region count AND attachment count — they're equal in non-indirected fixtures).
- Each ExportRow.attachmentNames is `['CIRCLE']`, `['SQUARE']`, or `['TRIANGLE']` (length-1 array, matches the legacy `[row.attachmentName]` shape).
- The 3 outW values are `Math.ceil(200 × safeScale(0.7))` = `Math.ceil(200 × 0.7)` = 140 each.

This locks success criterion #5: "Existing fixtures (SIMPLE_PROJECT, Rotated, atlas-less) continue to produce identical export plans (regression coverage — no behavior change on single-skin or attachment-name-unique inputs)."



**General test-writing rules:**

- Follow existing case-(a)..(g) docblock style for each `it()` description — short, declarative, references the success criterion or DECISION-ID being locked.
- DO NOT use `expect.any(Number)` or other fuzzy matchers where exact values are computable. The math is deterministic; assert exact integers and use `toBeCloseTo(..., 6)` for floats.
- DO NOT add new describe-blocks at unrelated insertion points; keep all 3 tests in one Phase 35 describe block for findability.
- DO NOT modify any existing test in the file. Only append. (Plan 01 Task 0 already touched existing tests to add `regions:` — those edits are separate from this task.)
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      grep -c "Phase 35 multi-skin region-keyed iteration" tests/core/export.spec.ts &&
      grep -c "AVATAR/CARDS_L_HAND_1" tests/core/export.spec.ts &&
      grep -c "toBeCloseTo(0.25" tests/core/export.spec.ts &&
      grep -c "toBeCloseTo(0.5" tests/core/export.spec.ts &&
      npm test -- export.spec.ts 2>&1 | tail -40
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 35 multi-skin region-keyed iteration" tests/core/export.spec.ts` returns 1 (the new describe block was added)
    - `grep -c "AVATAR/CARDS_L_HAND_1" tests/core/export.spec.ts` returns at least 1 (the multi-skin synthetic fixture uses skin-namespaced regionNames matching the real SKINS fixture)
    - `grep -c "toBeCloseTo(0.25" tests/core/export.spec.ts` returns at least 1 (WARNING 3 — the explicit 50%-override effScale assertion is present)
    - `grep -c "toBeCloseTo(0.5" tests/core/export.spec.ts` returns at least 1 (WARNING 3 — the non-overridden sibling effScale assertion is present)
    - `npm test -- export.spec.ts` exits 0 — all 3 new tests pass post-plan-01+02
    - Tests fail when run against pre-Phase-35 code: this can be verified by temporarily reverting plan 01 (e.g. `git stash`) and re-running `npm test -- export.spec.ts`. The Phase 35 describe block should show 3 failures with the multi-skin test reporting `expected 4, got 2` (or similar). After confirming the failure mode, `git stash pop` to restore the fix. **Do NOT commit this verification step; it's a manual sanity check that the tests actually lock the fix.**
    - No existing test is modified (only the Phase 35 describe block is appended). Verify via `git diff tests/core/export.spec.ts | grep '^-' | grep -v '^---'` — output should be empty or limited to the Plan 01 Task 0 backfill landed in the previous commit (this task's diff should ONLY add new lines).
  </acceptance_criteria>
  <done>
    Three synthetic-fixture tests added to tests/core/export.spec.ts under a single Phase 35 describe block. All pass. Multi-skin scenario locked, override-per-region binding locked with explicit effScale assertions (WARNING 3 fix), single-skin backward-compat locked.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add fixture-driven integration tests (Tests 4 + 5) — SKINS atlas-source + atlas-less mode-agnostic regression (BLOCKER 2 + BLOCKER 3 fixes)</name>
  <files>tests/core/export.spec.ts</files>
  <read_first>
    - tests/core/atlas-preview.spec.ts lines 32-77 (the imports + `loadSummary` helper — THIS IS THE EXACT PATTERN TO COPY for both Test 4 and Test 5; BLOCKER 2 fix source)
    - tests/core/loader.spec.ts lines 206-242 (the existing JOKERMAN-fixture loader test — confirms the path resolution pattern for an in-tree fixture; ignore the fact that this references `fixtures/Jokerman/` (a different fixture) — use the same `path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json')` shape)
    - tests/core/export.spec.ts (current Phase 35 describe block from Task 1 — append the integration tests inside the same block for grouping)
    - .gitignore (confirm `fixtures/SKINS/` AND `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/` are NOT gitignored — required for the tests to find the fixtures in CI; per memory `feedback_gitignore_fixtures_check_test_refs.md`)
    - fixtures/SKINS/ (verify JOKERMAN_SPINE.json + .atlas + at least one .png file are present)
    - fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/ (verify MeshOnly_TEST.json + images/ subdirectory are present — atlas-less projects don't have a .atlas file by definition; per CLAUDE.md memory `project_strict_loadermode_separation.md`)
    - src/core/loader.ts:200 (loadSkeleton signature — confirm it returns the LoadResult shape the inline helper needs)
    - src/core/sampler.ts:135 (sampleSkeleton signature)
    - src/core/analyzer.ts:214 (analyze signature) and src/core/analyzer.ts:398 (analyzeRegions signature)
  </read_first>
  <action>
**Append two `it()` tests to the Phase 35 describe block (the one created in Task 1). Tests 4 and 5 BOTH use the EXACT inline loader helper pattern from tests/core/atlas-preview.spec.ts:56-77. DO NOT import `buildSummary` from `src/main/summary.ts` — that function imports node:fs/node:path (Layer 3 violation in core tests) AND has the wrong signature (BLOCKER 2 from plan-checker review).**



**Test 4 — Fixture-driven SKINS atlas-source: load fixtures/SKINS/JOKERMAN_SPINE.json end-to-end, assert plan row count === summary.regions.length === 160.**

Pattern (mirror tests/core/atlas-preview.spec.ts:56-77 EXACTLY):

```typescript
it('Test 4 — fixtures/SKINS/JOKERMAN_SPINE.json (7 skins, 160 regions) → buildExportPlan returns 160 total entries (success criterion #1 from ROADMAP)', () => {
  // Defensive skip: this fixture lives in-tree at fixtures/SKINS/. If it's
  // somehow missing (CI shallow-clone misconfiguration, future gitignore
  // edit), skip with a clear message rather than failing opaquely.
  const jsonPath = path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn(`Skipping: fixture missing at ${jsonPath}`);
    return;
  }

  // BLOCKER 2 — inline the EXACT helper from tests/core/atlas-preview.spec.ts:56-77.
  // DO NOT import `buildSummary` from src/main/summary.ts — that function:
  //   (a) imports node:fs and node:path (Layer 3 — main process only)
  //   (b) has the wrong signature: buildSummary(load, sampled, elapsedMs) — takes
  //       PRE-PROCESSED LoadResult + SamplerOutput, not a raw jsonPath.
  //   (c) is forbidden in tests/core/ by the strict layering convention.
  const load = loadSkeleton(jsonPath);
  const sampled = sampleSkeleton(load);
  const peaks = analyze(sampled.globalPeaks);
  const peaksWithPath = peaks.map((r) => ({
    ...r,
    sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
  }));
  const sourcePaths = new Map<string, string>();
  for (const p of sampled.globalPeaks.values()) {
    const regionName = p.regionName ?? p.attachmentName;
    sourcePaths.set(regionName, '/fake/' + regionName + '.png');
  }
  const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
  const summary = {
    peaks: peaksWithPath,
    regions,
    orphanedFiles: [],
  } as unknown as SkeletonSummary;

  // Lock the pre-Phase-35 baseline that's already covered by Phase 29:
  // summary.regions.length === 160 (one row per unique regionName in the atlas).
  expect(summary.regions.length).toBe(160);

  // The Phase 35 contract: buildExportPlan produces ONE ExportRow per region.
  // Locks ROADMAP success criterion #1 (modal header 160; downstream of
  // plan.rows.length + plan.passthroughCopies.length).
  const plan = buildExportPlan(summary, new Map(), undefined);
  const totalRows = plan.rows.length + plan.passthroughCopies.length;
  expect(totalRows).toBe(160);

  // Spot-check: the 4 skin-namespaced CARDS_L_HAND_1 regions all appear as
  // distinct ExportRows. This is success criterion #2 from the ROADMAP at the
  // ExportRow level (the OptimizeDialog body row list is downstream of this).
  const allSourcePaths = [...plan.rows, ...plan.passthroughCopies].map((r) => r.sourcePath);
  const cardsLHand1Paths = allSourcePaths.filter((p) => p.includes('CARDS_L_HAND_1'));
  // At minimum one per skin that declares this region. JOKERMAN_SPINE.atlas
  // has AVATAR/CARDS_L_HAND_1, BUSINESS/CARDS_L_HAND_1, IRONMAN/CARDS_L_HAND_1,
  // JOKER/CARDS_L_HAND_1 (4 skins declare it). Assert at least 4 ExportRows
  // mention CARDS_L_HAND_1 in their sourcePath.
  expect(cardsLHand1Paths.length).toBeGreaterThanOrEqual(4);
});
```



**Test 5 — Atlas-less mode-agnostic integration (BLOCKER 3 fix): load fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json via the same inline loader helper.**

Use the EXACT same inline pattern as Test 4 (the helper is mode-agnostic — loadSkeleton + sampleSkeleton + analyze + analyzeRegions don't care whether the fixture has a .atlas file; atlas-less projects produce a summary with the same shape, just with different upstream provenance):

```typescript
it('Test 5 — atlas-less fixture (BLOCKER 3 fix: loaderMode separation invariant) → buildExportPlan is mode-agnostic; row count === summary.regions.length', () => {
  // Atlas-less fixture per memory `project_strict_loadermode_separation.md`:
  // each region's image lives at a per-region disk path under images/, no .atlas
  // file. The buildExportPlan migration should be loaderMode-invariant — atlas-less
  // summaries also produce region-keyed plans now. This test codifies that
  // invariant in CI (previously only covered by manual UAT in Plan 03 Task 2 step 12).
  const jsonPath = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn(`Skipping: fixture missing at ${jsonPath}`);
    return;
  }

  // Inline loader helper (same as Test 4 — copy-paste, do NOT factor into a
  // shared helper this round; that's a future refactor and would expand this
  // plan's scope).
  const load = loadSkeleton(jsonPath);
  const sampled = sampleSkeleton(load);
  const peaks = analyze(sampled.globalPeaks);
  const peaksWithPath = peaks.map((r) => ({
    ...r,
    sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
  }));
  const sourcePaths = new Map<string, string>();
  for (const p of sampled.globalPeaks.values()) {
    const regionName = p.regionName ?? p.attachmentName;
    sourcePaths.set(regionName, '/fake/' + regionName + '.png');
  }
  const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
  const summary = {
    peaks: peaksWithPath,
    regions,
    orphanedFiles: [],
  } as unknown as SkeletonSummary;

  // The contract: buildExportPlan emits one ExportRow per region regardless of
  // loader mode. Atlas-less summaries have regions populated by analyzeRegions
  // identically to atlas-source — the iteration source in buildExportPlan
  // doesn't branch on mode.
  const plan = buildExportPlan(summary, new Map(), undefined);
  const totalRows = plan.rows.length + plan.passthroughCopies.length;
  expect(totalRows).toBe(summary.regions.length);

  // Atlas-less fixtures don't share regions across attachments (each attachment
  // has its own per-region file path, no skin-namespacing collapsing happens
  // because there's no .atlas region table to namespace from). Each ExportRow's
  // attachmentNames array should be length 1.
  for (const row of [...plan.rows, ...plan.passthroughCopies]) {
    expect(row.attachmentNames.length).toBe(1);
  }
});
```



**Important notes:**

1. **DO NOT use `buildSummary` from src/main/summary.ts.** That function is in Layer 3 (main process, imports node:fs/node:path) and has signature `buildSummary(load: LoadResult, sampled: SamplerOutput, elapsedMs: number)`. Using it would (a) violate the Layer 3 hygiene tests at tests/core/export.spec.ts:624+, (b) require pre-computing `LoadResult` + `SamplerOutput` separately (which is exactly what the inline helper does anyway, so there's no shortcut), and (c) introduce a tests/core/ → src/main/ import that arch.spec.ts would flag.

2. **Add necessary imports at the top of tests/core/export.spec.ts** if not already present:
   - `import * as fs from 'node:fs';` (for the existsSync skip guard) — likely already present via `readFileSync`; if so, `fs.existsSync` may need an explicit star-import or named import depending on existing style. Match existing style.
   - `import * as path from 'node:path';` — likely already present.
   - `import { loadSkeleton } from '../../src/core/loader.js';` — likely NOT present in export.spec.ts (it's in atlas-preview.spec.ts only); ADD it.
   - `import { sampleSkeleton } from '../../src/core/sampler.js';` — likely NOT present; ADD it.
   - `import { analyze, analyzeRegions } from '../../src/core/analyzer.js';` — `analyze` likely already imported; ADD `analyzeRegions` to the existing import list (Plan 01 Task 0 may have already done this for the Category A backfills — verify via `grep` first to avoid double-imports).
   - Verify Plan 01 Task 0's backfill landed before Task 2 runs (`git log --oneline -- tests/core/export.spec.ts` should show the Plan 01 commit). If the imports are missing despite Plan 01 Task 0 ostensibly running, that's a Plan 01 Task 0 defect — file a gap closure.

3. **DO NOT depend on the atlas .png files being readable** — the math phase does NOT decode PNGs (per CLAUDE.md critical non-obvious fact #4: "The math phase does not decode PNGs. A stub TextureLoader populated from .atlas metadata is sufficient"). Test 4 should run with just the .json + .atlas + (maybe) a stub TextureLoader. Test 5 should run with just the .json + the images/ directory listing (loader probes per-region image existence for atlas-less mode but does NOT decode the pixel data). Both tests follow the pattern that atlas-preview.spec.ts uses for SIMPLE_TEST — the same loader interface handles both modes transparently.

4. **If `loadSkeleton` requires the actual atlas .png dims at load time** (e.g. via the loader's `pageWidthMap` for atlas-source mode), the test will read those dims via node:fs (the loader does this internally — that's Layer 1's role). This is NOT a Layer 3 violation; the loader IS Layer 1 and is allowed to read fixtures. Only the test file itself must not import node:fs beyond `existsSync` for the skip guard.

5. **If buildSummary requires the actual .png dims** (e.g. via the loader's `pageWidthMap` or similar) and the test environment can't probe them, fall back to a synthetic-summary alternative: load just the atlas via `TextureAtlas.load(...)`, count regions, build a synthetic summary with `regions: Array(160).fill(...)`. **This is a fallback only — first try the real loader-driven path. The atlas-preview spec proves it works for SIMPLE_TEST.json; SKINS + atlas-less should work via the same path.**

6. **Document each assertion's tie to the corresponding ROADMAP success criterion or BLOCKER** with an inline comment so future readers understand which contract this test locks (already done in the test bodies above).
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      ls fixtures/SKINS/JOKERMAN_SPINE.json &&
      ls fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json &&
      grep -c "fixtures/SKINS/JOKERMAN_SPINE.json" tests/core/export.spec.ts &&
      grep -c "fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json" tests/core/export.spec.ts &&
      ! grep -E "from ['\"][^'\"]*/main/summary['\"]" tests/core/export.spec.ts &&
      npm test -- export.spec.ts 2>&1 | tail -40
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "fixtures/SKINS/JOKERMAN_SPINE.json" tests/core/export.spec.ts` returns at least 1 (Test 4 references the SKINS fixture)
    - `grep -c "fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json" tests/core/export.spec.ts` returns at least 1 (Test 5 references the atlas-less fixture — BLOCKER 3 fix)
    - `grep -c "expect(summary.regions.length).toBe(160)" tests/core/export.spec.ts` returns 1 (the SKINS region-count baseline is asserted)
    - `grep -c "expect(totalRows).toBe(160)" tests/core/export.spec.ts` returns 1 (the Phase 35 contract is asserted for SKINS)
    - `grep -c "expect(totalRows).toBe(summary.regions.length)" tests/core/export.spec.ts` returns at least 1 (atlas-less mode-agnostic invariant — BLOCKER 3 fix)
    - `grep -E "from ['\"][^'\"]*/main/summary['\"]" tests/core/export.spec.ts` returns 0 matches (BLOCKER 2 fix — `buildSummary` from src/main/summary.ts is NOT imported)
    - `grep -c "loadSkeleton" tests/core/export.spec.ts` returns at least 1 (the inline loader helper from tests/core/atlas-preview.spec.ts:56-77 is in use — BLOCKER 2 fix)
    - `grep -c "analyzeRegions" tests/core/export.spec.ts` returns at least 1 (the analyzer helper is in use)
    - `npm test -- export.spec.ts` exits 0 — both new integration tests pass
    - The tests skip gracefully (do NOT fail) if either fixture is absent from the clone — verified by reading the `if (!fs.existsSync(jsonPath))` guards
    - `git check-ignore fixtures/SKINS/JOKERMAN_SPINE.json` returns empty (or non-zero exit code; the SKINS fixture is NOT gitignored) — per memory `feedback_gitignore_fixtures_check_test_refs.md`
    - `git check-ignore fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json` returns empty (the atlas-less fixture is NOT gitignored)
    - Full test-suite: `npm test` exits 0 (no other tests regress)
    - Layer 3 hygiene check still passes: the existing test at tests/core/export.spec.ts:624-642 verifies src/core/export.ts has no Layer 3 imports. The new tests in this task only add Layer 1 imports (loader, sampler, analyzer) to the TEST file, not to the SOURCE file under test — hygiene remains intact.
  </acceptance_criteria>
  <done>
    Two fixture-driven integration tests added to tests/core/export.spec.ts under the Phase 35 describe block. Test 4 (SKINS atlas-source) locks ROADMAP success criterion #1 at the ExportRow level using the inline loader helper from atlas-preview.spec.ts:56-77 (BLOCKER 2 fix — no `buildSummary` import). Test 5 (atlas-less MeshOnly) locks the strict loaderMode-separation invariant in CI for the first time (BLOCKER 3 fix — previously only covered by manual UAT). Both tests skip gracefully if their fixtures are missing. Both fixtures verified NOT gitignored.
  </done>
</task>

</tasks>

<verification>
- All 5 new tests in the Phase 35 describe block pass (`npm test -- export.spec.ts`)
- Existing tests do not regress (`npm test`)
- Both fixtures (SKINS + atlas-less MeshOnly) are in-repo and not gitignored (per memory `feedback_gitignore_fixtures_check_test_refs.md`)
- BLOCKER 2 fix verified: no `from 'src/main/summary'` imports in tests/core/export.spec.ts
- BLOCKER 3 fix verified: atlas-less integration test exists and asserts the mode-agnostic invariant
- WARNING 3 fix verified: Test 2 carries explicit `effScale === 0.25` (overridden row) and `effScale === 0.5` (sibling) assertions
- Tests fail against pre-Phase-35 code (locally verified by stash-and-rerun; not committed)
</verification>

<success_criteria>
- Test 1 (synthetic multi-skin, 4-region/2-attachment): expects 4 ExportRows, passes
- Test 2 (synthetic with per-region override, WARNING 3 fix): asserts override binds to AVATAR variant only via explicit effScale numbers (0.25 vs 0.5), not just outW
- Test 3 (synthetic single-skin backward-compat): asserts 3 ExportRows with attachmentNames === regionName per row
- Test 4 (fixture-driven SKINS integration, BLOCKER 2 fix): asserts plan row count === summary.regions.length === 160; uses inline loader helper from atlas-preview.spec.ts:56-77; NO `buildSummary` from src/main/summary.ts
- Test 5 (fixture-driven atlas-less integration, BLOCKER 3 fix): asserts plan row count === summary.regions.length on MeshOnly_TEST.json; codifies mode-agnostic invariant in CI
- All 5 tests are inside a single `describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration (DEDUP-04/05)', ...)` block
- Layer 3 hygiene tests at tests/core/export.spec.ts:624+ continue to pass (no new node:fs / sharp / electron / DOM / spine-core imports in src/core/export.ts; the test file adds Layer 1 imports which are permitted)
</success_criteria>

<output>
After completion, create `.planning/phases/35-region-keyed-export-plan/35-04-SUMMARY.md`
</output>
</content>
