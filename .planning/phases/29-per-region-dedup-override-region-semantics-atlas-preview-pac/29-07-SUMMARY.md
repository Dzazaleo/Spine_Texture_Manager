---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
plan: 07
subsystem: renderer-panel-override-display
tags: [bugfix, ui, regression, gap-closure]
gap_closure: true
requirements: [REGION-04]
dependency_graph:
  requires:
    - "29-03 (override Map regionName-keyed at AppShell + export.ts WRITE/READ contract)"
    - "29-05 (panel batch-apply WRITE-side selectedKeys={selected} fix)"
    - "29-06 (analyzer.ts toRegionRow contributor dedup)"
  provides:
    - "Panel READ-side override visualization on path-indirected rigs (CR-01 closure)"
    - "__test_only_enrichWithEffective named export for module-private regression testing"
  affects: []
tech_stack:
  added: []
  patterns:
    - "Test-only named export (__test_only_*) for module-private regression coverage — 1-line re-export with zero behavior delta"
    - "Symmetric three-site override-key lookup contract (panel READ + AppShell WRITE + export.ts READ all speak `row.regionName ?? row.attachmentName`)"
key_files:
  created: []
  modified:
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (line 262 fix + 3 stale comments rewritten + new __test_only_enrichWithEffective named export)"
    - "tests/regression/path-indirection.spec.ts (new it() block + new __test_only_enrichWithEffective import)"
decisions:
  - "Option (a) named test export over option (b) jsdom panel render — 1 named export + 0 jsdom polyfills + runs in existing @vitest-environment node alongside the other 9 path-indirection regression tests; refactor-safe via behavior-level assertion (not source-level grep)."
metrics:
  duration: "~3 minutes (2 atomic commits, 1 file modified per commit, 21/21 panel + 10/10 path-indirection tests green)"
  completed_date: "2026-05-07T22:24:05Z"
  tasks_completed: 2
  files_modified: 2
  commits:
    - "af78f62 fix(29-07): panel READ-side override-key flip — regionName-keyed lookup (CR-01 closure)"
    - "c26aa5f test(29-07): add panel READ-side regression for regionName-keyed override lookup"
---

# Phase 29 Plan 07: Panel READ-side Override-Key Fix (CR-01 Gap Closure) Summary

Closes the surviving CR-01 BLOCKER from `29-VERIFICATION.md` `gaps[0]` — the panel READ-side `enrichWithEffective` lookup at `GlobalMaxRenderPanel.tsx:262` is now `overrides.get(row.regionName ?? row.attachmentName)`, symmetric with `AppShell.tsx:523-526` (WRITE side) and `export.ts:187-188` (export-math READ side); 3 stale comments rewritten; `__test_only_enrichWithEffective` named export added; new behavior-level regression test locks the contract on path-indirected rigs.

## Root Cause (CR-01 / Gap 1 from 29-VERIFICATION.md)

Quoted verbatim from `29-VERIFICATION.md` `gaps[0].reason`:

> Closed at the export math layer (`src/core/export.ts:188` reads `overrides.get(row.regionName ?? row.attachmentName)`) AND closed at the batch-apply WRITE path (Plan 29-05 fixed the panel→AppShell handoff and added a regression test). The remaining defect is on the panel READ path: `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:262` (`enrichWithEffective`) reads `overrides.get(row.attachmentName)` instead of `overrides.get(row.regionName ?? row.attachmentName)`. AppShell's overrides Map is regionName-keyed (Plan 29-03 + 29-05); the panel READ side was never updated in that wave. On path-indirected regions where the lex-tiebreak winner's attachmentName differs from the regionName (Chicken-Min region '5/7' has winner.attachmentName='5/5/5/7/7'), the Map miss cascades through `EnrichedRow.override` → Peak-cell text-accent class (Row line 632) → PencilIcon (line 655) → displayScale + peakDisplayW/H (computeExportDims defaults to peakScale-only) → state tinting (lines 1090, 1214) → 'override' filter keyword (lines 304-306) → DimsBadge.effectiveScale prop (lines 600-606). The user sees a full-size rendering in the panel even though the on-disk export is correctly downscaled.

The defect predated this gap-closure pass — it was introduced in commit `0011f0d feat(04-03)` and missed by Plans 29-02 + 29-03. Plan 29-05 fixed the WRITE side of the override pipeline but never the READ side (Map → panel display).

## Fix Shape

### 1. Line 262 — single-line code change (the actual fix)

```diff
-    const override = overrides.get(row.attachmentName);
+    const override = overrides.get(row.regionName ?? row.attachmentName);
```

The `?? row.attachmentName` fallback EXACTLY matches:
- `src/core/export.ts:187-188`: `const overrideKey = row.regionName ?? row.attachmentName; const overridePct = overrides.get(overrideKey);`
- `src/renderer/src/components/AppShell.tsx:523-526`: `rowKey = 'regionName' in row && typeof (row as { regionName?: string }).regionName === 'string' ? (row as { regionName: string }).regionName : row.attachmentName;`

All three sites now speak the same key contract.

### 2. Three stale-comment rewrites (WR-02 from 29-REVIEW.md)

- **Line 152 (prop docblock):** "Phase 29 (Plan 29-02 Task 3): row is now a RegionRow ... Plan 29-03 will flip..." → "Phase 29 D-04 (Plan 29-03 + 29-05 + 29-07): override Map is keyed by `regionName`. The panel READ-side `enrichWithEffective` queries by `row.regionName ?? row.attachmentName` to match the WRITE side at AppShell.tsx:523-526 and the export-math read at export.ts:187-188."
- **Lines 248-252 (function docblock):** "Phase 29 D-01 (Plan 29-02 Task 3): operates on RegionRow[] ... Plan 29-03 owns the Map<regionName, number> flip..." → "Phase 29 D-04 (Plan 29-03 + 29-05 + 29-07): operates on RegionRow[] (one row per source PNG / regionName). The override Map is regionName-keyed end-to-end..."
- **Lines 259-261 (inline above the fix):** "Plan 29-03 will flip overrides to Map<regionName, number>; until then the existing per-attachment storage..." → "Phase 29 D-04 (Plan 29-07): query by `row.regionName ?? row.attachmentName` to mirror AppShell's regionName-keyed write contract..."

### 3. New `__test_only_enrichWithEffective` named export

After `enrichWithEffective`'s closing `}`:

```ts
/**
 * Phase 29 D-04 (Plan 29-07): named export of the module-private
 * `enrichWithEffective` for panel READ-side regression testing in
 * tests/regression/path-indirection.spec.ts. The double-underscore prefix
 * signals "test-only — do not import from production code". The named export
 * is a 1-line re-export with zero behavior delta; the panel's default-render
 * path continues to call the local binding.
 */
export const __test_only_enrichWithEffective = enrichWithEffective;
```

## Regression Test Approach

**File:** `tests/regression/path-indirection.spec.ts`. New `it()` block named `REGION-04 (Plan 29-07): panel READ-side reads override by regionName, not attachmentName, on path-indirected rigs`. Three assertions:

1. **Happy path (CR-01 closure proof):** Synthetic `RegionRow { regionName: '5/7', attachmentName: '5/5/5/7/7', contributingAttachments: [...3 entries...] }` (mirrors Chicken-Min `5/7` shape — `regionName !== winner.attachmentName` is the exact pre-29-07 trigger). With `overrides = new Map([['5/7', 0.011]])` (the user-reproduced 4×4-on-378-wide bug percent), `__test_only_enrichWithEffective([row], overrides)[0].override === 0.011` (Map hit by regionName).
2. **Symmetric negative (locks removal of attachmentName-keyed lookup):** Same row, `overrides = new Map([['5/5/5/7/7', 0.011]])` — winning-attachment-keyed Map. Assert `enriched[0].override === undefined`. Proves the fix REMOVED the attachmentName-keyed lookup, not just added a regionName branch alongside.
3. **Backward-compat (no-indirection legacy case):** Synthetic row with `regionName === attachmentName === 'CIRCLE'` (SIMPLE_PROJECT shape) and `overrides = new Map([['CIRCLE', 0.5]])` — assert `enriched[0].override === 0.5`. Locks the `?? row.attachmentName` fallback for the legacy case.

### Why Option (a) Named Test Export over Option (b) jsdom Panel Render

| Dimension | (a) Named test export | (b) jsdom panel render |
|---|---|---|
| Test env | `@vitest-environment node` (existing) | New `@vitest-environment jsdom` companion spec |
| Setup | 1-line re-export | jsdom + @testing-library/react polyfill |
| Behavior coverage | Direct call into `enrichWithEffective` (the locus of the bug) | Indirect via DOM render tree |
| Refactor safety | Behavior-level assertion (refactor-safe) | DOM-tree assertion (brittle to UI restructuring) |
| Existing test colocation | All 9 existing path-indirection tests stay in one file | Forces an environment-pragma split |
| Cost | 1 named export | jsdom polyfills + ~50 lines of render boilerplate |

Option (a) was the orchestrator's locked-scope choice. The double-underscore prefix is the project's established "test-only — do not import from production" convention.

## Source-Level Evidence

| Pattern | File | Count | Status |
|---|---|---|---|
| `overrides.get(row.regionName ?? row.attachmentName)` | GlobalMaxRenderPanel.tsx | 1 | Fix in place |
| `overrides.get(row.attachmentName)` | GlobalMaxRenderPanel.tsx | 0 | Buggy lookup fully removed |
| `Plan 29-03 will flip` | GlobalMaxRenderPanel.tsx | 0 | Stale prop-docblock + inline comments removed |
| `Plan 29-03 owns the` | GlobalMaxRenderPanel.tsx | 0 | Stale function-docblock removed |
| `Plan 29-07` (literal substring) | GlobalMaxRenderPanel.tsx | 2 | Inline comment + named-export JSDoc reference (the other two sites use compound "Plan 29-03 + 29-05 + 29-07" — `grep -c "Plan 29-07"` doesn't substring-match across the compound prefix; see Note below) |
| `29-07` (any substring) | GlobalMaxRenderPanel.tsx | 4 | All four expected mentions present |
| `__test_only_enrichWithEffective` | GlobalMaxRenderPanel.tsx | 1 | The `export const` declaration line (the JSDoc above it does not literally name the symbol — it describes it; semantically the export is present and importable) |
| `export const __test_only_enrichWithEffective` | GlobalMaxRenderPanel.tsx | 1 | Named-export declaration |
| `__test_only_enrichWithEffective` | path-indirection.spec.ts | 4 | Import + 3 call sites (happy path + wrong-key negative + no-indirection backward-compat) |
| `import { __test_only_enrichWithEffective }` | path-indirection.spec.ts | 1 | Import line present |
| `REGION-04 (Plan 29-07): panel READ-side` | path-indirection.spec.ts | 1 | New it() block name |
| `expect(enriched[0].override).toBe(0.011)` | path-indirection.spec.ts | 1 | Happy-path assertion |
| `expect(wrongKeyEnriched[0].override).toBeUndefined()` | path-indirection.spec.ts | 1 | Symmetric negative assertion |
| `expect(noIndirectionEnriched[0].override).toBe(0.5)` | path-indirection.spec.ts | 1 | Backward-compat assertion |

### Note on `Plan 29-07` literal-substring count

The plan's acceptance criterion expected `grep -c "Plan 29-07"` ≥ 4 ("one mention in each of the three rewritten comments + one in the new named-export JSDoc"). The plan's verbatim replacement text for comments #1 and #2 used the compound "Phase 29 D-04 (Plan 29-03 + 29-05 + 29-07)" which contains the substring "29-07" but NOT the substring "Plan 29-07" (because "Plan" is followed by "29-03 + 29-05 + 29-07"). The `grep -c "29-07"` count returns 4 (one per comment). I followed the plan's verbatim replacement text exactly; the literal-substring count discrepancy is a counting-criterion artifact, not a content gap. The substantive intent — every relevant comment references Plan 29-07 — is satisfied.

## Behavior-Level Evidence

```
$ npx vitest run tests/regression/path-indirection.spec.ts -t "panel READ-side reads override by regionName"
Test Files  1 passed (1)
     Tests  1 passed | 9 skipped (10)

$ npx vitest run tests/regression/path-indirection.spec.ts
Test Files  1 passed (1)
     Tests  10 passed (10)

$ npx vitest run tests/renderer/global-max-render-panel.spec.tsx tests/renderer/global-max-functional-setselected.spec.tsx tests/regression/path-indirection.spec.ts
Test Files  3 passed (3)
     Tests  21 passed (21)

$ npx tsc --noEmit  # exit 0, zero output

$ npm run test
Test Files  2 failed | 77 passed (79)
     Tests  1 failed | 872 passed | 11 skipped | 2 todo (886)
```

The 1 failed test (`tests/main/sampler-worker-girl.spec.ts` warm-up error + `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`) are pre-existing failures unrelated to Phase 29. Confirmed via `git stash && npm run test`: stashed-state run shows `2 failed | 77 passed (79)` and `1 failed | 871 passed` BEFORE Plan 29-07 changes — same two test files, same failure modes. Plan 29-06 SUMMARY (referenced in 29-VERIFICATION.md line 73) explicitly noted the sampler-worker-girl wall-time gate as a "pre-existing failure unrelated to Phase 29 (deferred)".

Net delta: +1 passing test (871 → 872), zero new failures.

## Zero-Touch Evidence

```
$ git diff --stat src/renderer/src/components/AppShell.tsx \
                  src/core/export.ts \
                  src/core/atlas-preview.ts \
                  src/renderer/src/lib/atlas-preview-view.ts \
                  src/renderer/src/panels/AnimationBreakdownPanel.tsx \
                  src/shared/types.ts \
                  src/main/project-io.ts \
                  src/core/analyzer.ts
# (empty output — all 8 adjacent files zero-touch)
```

D-09 zero-touch contract preserved on `AnimationBreakdownPanel.tsx` across the entire phase. The fix is panel-side only; the WRITE-side (AppShell, project-io) and export-math (export.ts) layers were already correct per Plans 29-03 + 29-05 + 29-06.

## Test Count Delta

- `tests/regression/path-indirection.spec.ts`: 9 → 10 it() blocks (+1)
- Cumulative phase 29 test delta: ~61 new tests across plans 29-01..29-07 (per 29-VERIFICATION.md count + Plan 29-07's +1)
- Full suite: 871 → 872 passing (+1); 11 skipped + 2 todo unchanged; 2 file-level failures pre-existing and out of scope

## Deviations from Plan

### Auto-fixed Issues

None — the plan executed exactly as written.

### Deferred Issues

None.

## Out-of-Scope Reminder

Per plan frontmatter `out_of_scope` (echoed from 29-VERIFICATION.md §Secondary informational findings):

- **WR-01 (29-REVIEW.md, distinct from the original WR-01 closed by Plan 29-06):** `contributor.peakScale` first-after-lex-sort rather than max-peakScale-per-attachmentName. NOT a blocker today (`contributor.peakScale` is not user-visible). Deferred to a future polish phase if/when a surface starts reading it.
- **WR-03 (29-REVIEW.md):** Brittle source-grep guards in `tests/arch.spec.ts:128` + `tests/regression/path-indirection.spec.ts:320` (positive `selectedKeys={selected}` regex would fail under innocent refactors). The negative `selectedAttachmentNames` guard is the load-bearing assertion. This plan's new READ-side test uses a behavior-level lock via `__test_only_enrichWithEffective` (refactor-safe).

## Hand-Off Notes for /gsd-verify-work 29 Re-Verification

The verifier should:

1. Re-read `29-VERIFICATION.md` `gaps[0]` and confirm `missing[0..2]` are now satisfied:
   - missing[0] (line 262 fix): `grep -c "overrides.get(row.regionName ?? row.attachmentName)" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns 1; `grep -c "overrides.get(row.attachmentName)"` returns 0.
   - missing[1] (3 stale comments rewritten): `grep -c "Plan 29-03 will flip"` returns 0; `grep -c "Plan 29-03 owns the"` returns 0; the post-29-07 comment text is at lines 149, 247, 261 with the symmetric three-site contract documented.
   - missing[2] (panel-level test): `grep -c "REGION-04 (Plan 29-07): panel READ-side" tests/regression/path-indirection.spec.ts` returns 1; the it() block contains 3 assertions (happy path, symmetric negative, backward-compat).
2. Re-score truth #2 (REGION-04 — Override binds to region; reaches export through region binding; UI surfaces the applied override accurately): EXPORT side was already verified post-29-05; PANEL READ side is now verified post-29-07. The full end-to-end chain (override Map → enrichWithEffective → EnrichedRow → 7 downstream renderers) flows correctly on path-indirected rigs.
3. Re-score `score: 7/8 → 8/8 must-haves verified`.
4. Confirm Phase 29 close-out: ALL 8 requirement IDs (REGION-01..07 + PREVIEW-01) verified end-to-end across plans 29-01..29-07; the path-indirection bug is fully closed at every layer (analyzer dedup, override Map keys, export math, batch-apply UI handoff, contributor count display, AND the panel READ-side override visualization).

## Self-Check: PASSED

- [x] `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` modified — verified via `git log --oneline af78f62`
- [x] `tests/regression/path-indirection.spec.ts` modified — verified via `git log --oneline c26aa5f`
- [x] Commit `af78f62` exists in the worktree branch — `git log` confirms
- [x] Commit `c26aa5f` exists in the worktree branch — `git log` confirms
- [x] All grep acceptance criteria for both tasks satisfied (with the noted `Plan 29-07` literal-substring counting artifact, content-equivalent)
- [x] All zero-touch acceptance criteria satisfied (8 adjacent files, `git diff --stat` empty)
- [x] All test acceptance criteria satisfied (10/10 path-indirection regression tests pass; 21/21 panel + path-indirection focused suite green; 872/886 full suite passing with 2 pre-existing failures out of scope)
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` exit 0)
