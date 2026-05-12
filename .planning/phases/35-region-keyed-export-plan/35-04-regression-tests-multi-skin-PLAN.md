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
    - "A fixture-driven test loads fixtures/SKINS/JOKERMAN_SPINE.json end-to-end (loader → buildSummary → buildExportPlan) and asserts row count === summary.regions.length === 160"
    - "Backward-compat regression: SIMPLE_PROJECT (regionName === attachmentName, contributingAttachments.length === 1) produces the same ExportRow count and shape as pre-Phase-35"
    - "The new tests fail when run against pre-Phase-35 code (they LOCK the fix, not just document it)"
  artifacts:
    - path: "tests/core/export.spec.ts"
      provides: "Phase 35 regression block — multi-skin region-keyed iteration coverage"
      contains: "Phase 35 — multi-skin"
  key_links:
    - from: "tests/core/export.spec.ts"
      to: "fixtures/SKINS/JOKERMAN_SPINE.json"
      via: "loadSkeleton + buildSummary + buildExportPlan"
      pattern: "fixtures/SKINS/JOKERMAN_SPINE"
---

<objective>
Add regression tests that lock the Phase 35 fix in two layers:

1. **Synthetic unit test** — a fabricated SkeletonSummary with N=4 regions sharing K=2 attachment names. Feeds into buildExportPlan. Asserts plan.rows + plan.passthroughCopies totals 4 (not 2). This is the minimal-information test — runs in milliseconds, exercises the iteration source directly, no fixture dependency.

2. **Fixture-driven integration test** — loads fixtures/SKINS/JOKERMAN_SPINE.json end-to-end (loader → buildSummary → buildExportPlan) and asserts `plan.rows.length + plan.passthroughCopies.length === summary.regions.length === 160`. Locks the real-world scenario the user reported.

3. **Backward-compat assertion** — verifies SIMPLE_PROJECT-shaped synthetic input (regionName === attachmentName, single contributor per region) produces ExportRow counts identical to pre-Phase-35. Confirms the iteration source change is observationally equivalent on non-indirected inputs.

Purpose: Without these tests, a future refactor could silently regress the fix. The tests are the durable artifact — they encode the behavioral contract in CI.

Output: A new `describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration', () => { ... })` block appended to tests/core/export.spec.ts.
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

# Existing test patterns to follow
@tests/core/export.spec.ts

# RegionRow shape (needed for synthetic fixture construction)
@src/shared/types.ts

# Real-fixture integration test pattern — confirms loadSkeleton + buildSummary entry points
@tests/core/atlas-preview.spec.ts

<interfaces>
<!-- Existing test infrastructure the new tests build on. -->

From tests/core/export.spec.ts head (the imports + helper patterns; read in full before writing new tests so the new block follows existing style):
- Imports: `import { describe, expect, it } from 'vitest';` + `import { readFileSync } from 'node:fs';` + `import path from 'node:path';`
- Existing describe-block naming convention: `describe('buildExportPlan — case (X) {short description} ({DECISION-IDs})', ...)` — follow this convention for the new Phase 35 block.
- Synthetic-summary fixture construction pattern (see lines 75-148 for case (b) — a 25% override on TRIANGLE peakScale ≈ 2.0): build a `summary` object with `peaks: [...]` containing the fields buildExportPlan reads. **For Phase 35: ALSO populate `regions: [...]` with the equivalent RegionRow set, since post-Phase-35 the function iterates summary.regions, not summary.peaks.** Synthetic-summary builders pre-Phase-35 didn't need to populate `regions` because the function never read it — that changes here.
- Fixture-driven integration test pattern (see tests/core/atlas-preview.spec.ts:loadSummary helper): construct a real SkeletonSummary by calling `loadSkeleton(jsonPath)` + `buildSummary(loadedSkeleton)`. The atlas-preview spec uses this for FIXTURE_BASELINE === SIMPLE_TEST.json — Phase 35 will use the same pattern for JOKERMAN_SPINE.json.

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

The summary object that buildExportPlan receives needs:
- regions: RegionRow[]
- peaks: DisplayRow[] (legacy — buildExportPlan no longer reads this post-Phase-35, but other code paths might; populate with the same array shape as pre-Phase-35 for safety)
- ... other SkeletonSummary fields are unread by buildExportPlan and can be cast around
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add synthetic-fixture regression test — N regions, K attachment names, N != K</name>
  <files>tests/core/export.spec.ts</files>
  <read_first>
    - tests/core/export.spec.ts (read in full, focus on lines 42-310 for synthetic-summary construction patterns; the Phase 29 D-04 test block at lines 2078+ is also a strong precedent for region-keyed assertion structure)
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

**Test 2 — Multi-skin synthetic with override on one region: override binds per-region (Phase 29 D-04 preserved).**

Reuse the same 4-region fixture from Test 1. Set `overrides.set('AVATAR/CARDS_L_HAND_1', 50)` (50% override on the AVATAR variant only). Call `buildExportPlan(synthSummary, overrides, undefined)`. Assert:
- `plan.rows.length + plan.passthroughCopies.length === 4` (count unchanged — override doesn't change cardinality).
- The ExportRow whose sourcePath ends with `AVATAR/CARDS_L_HAND_1.png` has a different `outW` than the row ending with `BUSINESS/CARDS_L_HAND_1.png` (the 50% override applied to one, not the other).
- The 50%-override row has outW = `Math.ceil(canonicalW × safeScale(0.5 × peakScale))` = `Math.ceil(100 × safeScale(0.25))` = `Math.ceil(100 × 0.25)` = 25.
- The unaffected `BUSINESS/CARDS_L_HAND_1.png` row has outW = `Math.ceil(100 × safeScale(0.5))` = `Math.ceil(100 × 0.5)` = 50.

This locks success criterion #6 from the ROADMAP: "Override resolution per region still keyed by `regionName` (Phase 29 D-04 preserved)."

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
- DO NOT use `expect.any(Number)` or other fuzzy matchers where exact values are computable. The math is deterministic; assert exact integers.
- DO NOT add new describe-blocks at unrelated insertion points; keep all 3 tests in one Phase 35 describe block for findability.
- DO NOT modify any existing test in the file. Only append.
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      grep -c "Phase 35 multi-skin region-keyed iteration" tests/core/export.spec.ts &&
      npm test -- export.spec.ts 2>&1 | tail -40
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 35 multi-skin region-keyed iteration" tests/core/export.spec.ts` returns 1 (the new describe block was added)
    - `grep -c "AVATAR/CARDS_L_HAND_1" tests/core/export.spec.ts` returns at least 1 (the multi-skin synthetic fixture uses skin-namespaced regionNames matching the real SKINS fixture)
    - `npm test -- export.spec.ts` exits 0 — all 3 new tests pass post-plan-01+02
    - Tests fail when run against pre-Phase-35 code: this can be verified by temporarily reverting plan 01 (e.g. `git stash`) and re-running `npm test -- export.spec.ts`. The Phase 35 describe block should show 3 failures with the multi-skin test reporting `expected 4, got 2` (or similar). After confirming the failure mode, `git stash pop` to restore the fix. **Do NOT commit this verification step; it's a manual sanity check that the tests actually lock the fix.**
    - No existing test is modified (only the Phase 35 describe block is appended). Verify via `git diff tests/core/export.spec.ts | grep '^-' | grep -v '^---'` — output should be empty (no removed lines outside the diff header).
  </acceptance_criteria>
  <done>
    Three synthetic-fixture tests added to tests/core/export.spec.ts under a single Phase 35 describe block. All pass. Multi-skin scenario locked, override-per-region binding locked, single-skin backward-compat locked.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add fixture-driven integration test using fixtures/SKINS/JOKERMAN_SPINE.json</name>
  <files>tests/core/export.spec.ts</files>
  <read_first>
    - tests/core/atlas-preview.spec.ts (see how `loadSummary` / `loadSkeleton` + `buildSummary` are wired for SIMPLE_TEST.json; find the exact import paths and helper function names)
    - tests/core/loader.spec.ts lines 206-242 (the existing JOKERMAN-fixture loader test — confirms the path resolution pattern for an in-tree fixture; ignore the fact that this references `fixtures/Jokerman/` (a different fixture) — use the same `path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json')` shape)
    - tests/core/export.spec.ts (current Phase 35 describe block from Task 1 — append the integration test inside the same block for grouping)
    - .gitignore (confirm `fixtures/SKINS/` is NOT gitignored — required for the test to find the fixture in CI; per memory `feedback_gitignore_fixtures_check_test_refs.md`)
    - fixtures/SKINS/ (verify JOKERMAN_SPINE.json, .atlas, and at least one .png file are present — the test needs them)
  </read_first>
  <action>
**Append a fourth `it()` test to the Phase 35 describe block (the one created in Task 1) — a real-fixture integration test.**

Test 4 — Fixture-driven: load fixtures/SKINS/JOKERMAN_SPINE.json end-to-end, assert plan row count === summary.regions.length === 160.

Pattern (adapt from tests/core/atlas-preview.spec.ts's loadSummary helper):

```typescript
it('Test 4 — fixtures/SKINS/JOKERMAN_SPINE.json (7 skins, 160 regions) → buildExportPlan returns 160 total entries (success criterion #1 from ROADMAP)', () => {
  // Defensive skip: this fixture lives in-tree at fixtures/SKINS/. If it's
  // somehow missing (CI shallow-clone misconfiguration, future gitignore
  // edit), skip with a clear message rather than failing opaquely.
  // Pattern mirrors tests/main/image-worker.atlas-extract.spec.ts:47-51.
  const jsonPath = path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json');
  if (!fs.existsSync(jsonPath)) {
    console.warn(`Skipping: fixture missing at ${jsonPath}`);
    return;
  }

  // Use the same loader → buildSummary chain that atlas-preview.spec.ts uses.
  // The exact helper signatures depend on what's exported from src/core/loader.ts
  // and src/main/summary.ts — match the existing pattern from the atlas-preview
  // spec's loadSummary helper (or replicate inline).
  const skeleton = loadSkeleton(jsonPath);     // or whatever the existing helper is named
  const summary = buildSummary(skeleton);       // ditto

  // Lock the pre-Phase-35 baseline that's already covered by Phase 29:
  // summary.regions.length === 160 (one row per unique regionName in the atlas).
  expect(summary.regions.length).toBe(160);

  // The Phase 35 contract: buildExportPlan produces ONE ExportRow per region.
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

**Important notes:**

1. **Use the existing loader + buildSummary helpers, do NOT invent new ones.** Read tests/core/atlas-preview.spec.ts:50-78 (the loadSummary helper definition area) to find the exact function names and import paths. If those helpers live inside the atlas-preview spec as a private helper, replicate the same logic inline in the export.spec test (do NOT cross-import test files). If they live in a shared test-helpers module, reuse from there.

2. **Add necessary imports at the top of tests/core/export.spec.ts** if not already present:
   - `import fs from 'node:fs';` (for the existsSync skip guard)
   - `import path from 'node:path';` (likely already present)
   - The loader + buildSummary imports (paths to be confirmed by reading atlas-preview.spec.ts)

3. **DO NOT depend on the atlas .png files being readable** — the math phase does NOT decode PNGs (per CLAUDE.md critical non-obvious fact #4: "The math phase does not decode PNGs. A stub TextureLoader populated from .atlas metadata is sufficient"). The test should run with just the .json + .atlas + (maybe) a stub TextureLoader. Match the pattern used by the atlas-preview spec for the SIMPLE_TEST fixture.

4. **If buildSummary requires the actual .png dims** (e.g. via the loader's `pageWidthMap` or similar) and the test environment can't probe them, fall back to a synthetic-summary alternative: load just the atlas via `TextureAtlas.load(...)`, count regions, build a synthetic summary with `regions: Array(160).fill(...)`. **This is a fallback only — first try the real loader-driven path.**

5. **Document the assertion's tie to ROADMAP success criteria** with an inline comment so future readers understand which criterion this test locks:
   ```typescript
   // Locks ROADMAP success criterion #1 (modal header 160; downstream of
   // plan.rows.length + plan.passthroughCopies.length).
   ```
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      ls fixtures/SKINS/JOKERMAN_SPINE.json &&
      grep -c "fixtures/SKINS/JOKERMAN_SPINE.json" tests/core/export.spec.ts &&
      npm test -- export.spec.ts 2>&1 | tail -40
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "fixtures/SKINS/JOKERMAN_SPINE.json" tests/core/export.spec.ts` returns at least 1
    - `grep -c "expect(summary.regions.length).toBe(160)" tests/core/export.spec.ts` returns 1 (the region-count baseline is asserted)
    - `grep -c "expect(totalRows).toBe(160)" tests/core/export.spec.ts` returns 1 (the Phase 35 contract is asserted)
    - `npm test -- export.spec.ts` exits 0 — the new integration test passes
    - The test skips gracefully (does NOT fail) if `fixtures/SKINS/JOKERMAN_SPINE.json` is absent from the clone — verified by reading the `if (!fs.existsSync(jsonPath))` guard
    - `git check-ignore fixtures/SKINS/JOKERMAN_SPINE.json` returns empty (or non-zero exit code; the fixture is NOT gitignored) — per memory `feedback_gitignore_fixtures_check_test_refs.md`, this MUST be verified before committing
    - Full test-suite: `npm test` exits 0 (no other tests regress)
  </acceptance_criteria>
  <done>
    A fixture-driven integration test loads fixtures/SKINS/JOKERMAN_SPINE.json end-to-end and asserts `buildExportPlan` returns 160 total entries. Locks ROADMAP success criterion #1 (and indirectly #2 and #8) at the ExportRow level. Test skips gracefully if fixture is missing. Fixture is confirmed NOT gitignored.
  </done>
</task>

</tasks>

<verification>
- All 4 new tests in the Phase 35 describe block pass (`npm test -- export.spec.ts`)
- Existing tests do not regress (`npm test`)
- Fixture is in-repo and not gitignored (per memory `feedback_gitignore_fixtures_check_test_refs.md`)
- Tests fail against pre-Phase-35 code (locally verified by stash-and-rerun; not committed)
</verification>

<success_criteria>
- Test 1 (synthetic multi-skin, 4-region/2-attachment): expects 4 ExportRows, passes
- Test 2 (synthetic with per-region override): asserts override binds to AVATAR variant only, not BUSINESS variant
- Test 3 (synthetic single-skin backward-compat): asserts 3 ExportRows with attachmentNames === regionName per row
- Test 4 (fixture-driven SKINS integration): asserts plan row count === summary.regions.length === 160
- All tests are inside a single `describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration (DEDUP-04/05)', ...)` block
- Layer 3 hygiene tests at tests/core/export.spec.ts:624+ continue to pass (no new node:fs / sharp / electron / DOM / spine-core imports in src/core/export.ts)
</success_criteria>

<output>
After completion, create `.planning/phases/35-region-keyed-export-plan/35-04-SUMMARY.md`
</output>
