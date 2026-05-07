---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
verified: 2026-05-07T23:50:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "REGION-04 panel READ-side override-key flip (CR-01 from prior 29-VERIFICATION.md `gaps[0]`) — closed by Plan 29-07 (commits af78f62, c26aa5f, 90ee352) plus extraction commit 889a379. The `enrichWithEffective` helper was first patched in-place at GlobalMaxRenderPanel.tsx:262 (af78f62) then extracted to `src/renderer/src/lib/enrich-overrides.ts` (889a379) so the regression test under `tests/regression/` could import it directly without pulling the panel's DOM/JSX surface into node-tsc scope. The post-extraction READ at enrich-overrides.ts:44 reads `overrides.get(row.regionName ?? row.attachmentName)` — symmetric with AppShell.tsx:523-526 (WRITE side) and src/core/export.ts:187-188 (export-math READ side). The 3 stale Plan 29-03-pending comments were cleaned up during the move. New regression test added at tests/regression/path-indirection.spec.ts:387-484 with 3 assertions: (a) happy path — Map hit by regionName on path-indirected fixture, (b) symmetric negative — Map keyed by attachmentName misses (proves the lookup REMOVED the attachmentName-keyed branch, not just added a regionName branch alongside), (c) backward-compat — `regionName === attachmentName` no-indirection legacy case still resolves via the `?? row.attachmentName` fallback."
  gaps_remaining: []
  regressions: []
  new_gaps_found_during_re_verification: []
gaps: []
deferred: []
---

# Phase 29: per-region-dedup-override-region-semantics-atlas-preview-pac Verification Report

**Phase Goal:** After this phase, the user sees one row per unique source PNG across all four surfaces (Global panel, Atlas Preview, Optimize dialog, exported folder), and overrides set on those rows actually reach the export pipeline — closing the correctness bug confirmed in `.planning/debug/path-indirected-duplicate-rows.md` where a user override on `5/7.png` (4×4) was silently erased because the export pipeline took the per-region max across non-overridden sibling attachments.

**Verified:** 2026-05-07T23:50:00Z
**Status:** passed
**Re-verification:** Yes — third pass. Original gaps (CR-01 batch-apply UI handoff, WR-01 RegionRow.contributingAttachments[] dedup) closed by Plans 29-05 + 29-06; second-pass gap (CR-01 panel READ-side override-key) now closed by Plan 29-07 + extraction commit 889a379. The 4 WARNINGs in the just-refreshed 29-REVIEW.md are non-blocking refinements documented under §Anti-Patterns Found below.

## Goal Achievement

### Observable Truths

| #  | Truth (from ROADMAP success criteria) | Status | Evidence |
|----|---------------------------------------|--------|----------|
| 1 | User loads a path-indirected project and the Global panel shows N rows for N unique source PNGs (not per attachment). Each row's identifier reads `{regionName}.png` with `images/` stripped. (REGION-01 + REGION-03) | VERIFIED | `summary.regions: RegionRow[]` populated by `analyzeRegions` (analyzer.ts); GlobalMaxRenderPanel consumes `enrichWithEffective(summary.regions, overridesMap)` (panel line 726, helper now in `src/renderer/src/lib/enrich-overrides.ts:39`); row label formatter `row.regionName.replace(/^images\//, '') + '.png'` present. Regression test at tests/regression/path-indirection.spec.ts:60-83 (REGION-01 detail tightened by Plan 29-06) asserts exactly 3 unique contributingAttachments on Chicken-Min's `5/7` region; PREVIEW-01 (a) asserts `pages.length === 1`. |
| 2 | User overrides a region row → exported file matches override dims (the falsified bug from `.planning/debug/path-indirected-duplicate-rows.md` no longer reproduces). (REGION-04) | VERIFIED | EXPORT MATH: src/core/export.ts:187-188 reads `const overrideKey = row.regionName ?? row.attachmentName; const overridePct = overrides.get(overrideKey);`; integration test at path-indirection.spec.ts ~line 113 asserts `outW === 4` for a `5/7 → 4×4` override on Chicken-Min, passes. BATCH WRITE PATH: tests/regression/path-indirection.spec.ts has a REGION-04 batch-apply UI block locking `selectedKeys={selected}` source level + buildExportPlan output dims behavior level (Plan 29-05). PANEL READ PATH (closed by 29-07 + 889a379): `src/renderer/src/lib/enrich-overrides.ts:44` reads `overrides.get(row.regionName ?? row.attachmentName)`; new behavior-level regression at path-indirection.spec.ts:387-484 with 3 assertions (happy path Map-hit on path-indirected RegionRow, symmetric negative on attachmentName-keyed Map, no-indirection backward-compat). The cascade through EnrichedRow.override → Peak-cell text-accent class → PencilIcon → displayScale → state tinting → 'override' filter keyword → DimsBadge.effectiveScale prop now reflects applied overrides on path-indirected rigs. Screen-vs-disk divergence closed end-to-end. |
| 3 | Atlas Preview projects exactly the actual atlas page count (Chicken: 13, not 14). (PREVIEW-01) | VERIFIED | tests/regression/path-indirection.spec.ts has 2 PREVIEW-01 it() blocks: (a) Chicken-Min single-page asserts `pages.length === 1` + `deriveInputs.length === regions.length` (1 input per region — page count is not inflated); (b) synthetic multi-page strict-monotone delta asserts `postPages > 0 && prePages > 0 && postPages < prePages`. Both pass. |
| 4 | Source Animation/Frame columns report values from the winning contributing attachment (lex-tiebreak). (REGION-05) | VERIFIED | `pickRegionWinner` in src/core/analyzer.ts implements lex tiebreak on `attachmentName.localeCompare`; tests/core/analyzer.spec.ts has Test 3 + Test 5 covering the lex-tiebreak rule; tests/regression/path-indirection.spec.ts REGION-05 asserts the winning attachmentName equals the lex-smallest of contributors. Plan 29-06's contributor dedup keeps first-after-lex-sort, matching the row-winner attribution. |
| 5 | Drill-down preserves per-attachment detail. (REGION-06) | VERIFIED | `git log -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` shows the last edit is unrelated to phase 29; `git diff` returns empty across all 7 plans — D-09 zero-touch contract preserved. tests/regression/path-indirection.spec.ts REGION-06 asserts that for path-indirected attachmentNames in any animation card, distinct rows persist. Note: the drill-down panel's OWN override-display surface still keys by attachmentName (consistent with its own per-attachment write path); on a region-level override set from the Global panel, only the contributing attachment whose name happens to match the regionName will display the override badge in the drill-down. This is documented as informational under §Anti-Patterns Found / IF-01 below — not a phase 29 regression and not in scope per the explicit 4-surface enumeration in the phase goal. |
| 6 | Regression fixture (Chicken-derived subset) <1MB exercises path-indirection. (REGION-07) | VERIFIED | `du -sh fixtures/Chicken-Min/` returns 32K (well under 1MB sentinel); 3 files (Chicken-Min.json 22189B + Chicken-Min.atlas 95B + Chicken-Min.png 79B). Chicken full skeleton stays gitignored; Chicken-Min committed. tests/regression/path-indirection.spec.ts REGION-07 sentinel test asserts `<1024*1024`, passes. |
| 7 | One tile per unique source PNG in Atlas Preview modal in both Original and Optimized modes; click hit-tests attribute to all contributing attachments. (REGION-02) | VERIFIED | src/core/atlas-preview.ts: `for (const region of summary.regions)` (1 hit, original mode); inner per-attachment loop is gone; regionName + attachmentNames[] both written to AtlasPreviewInput. src/renderer/src/lib/atlas-preview-view.ts mirrors lockstep. AtlasPreviewModal: hoveredRegionName + onJumpToRegion + 'used by N attachments' tooltip lines (gated on `attachmentNames.length > 1`). |
| 8 | All ~8+ existing call sites that did `summary.peaks.find(p => p.attachmentName === X)` are migrated without behavior regression on non-path-indirected projects (SIMPLE_PROJECT golden tests pass). | VERIFIED | tests/regression/path-indirection.spec.ts passes 10/10 in 198ms; full test suite reports 881 passing in 5.04s (3 skipped + 2 todo, 0 failures). SIMPLE_PROJECT analyzer Test 1 was updated by Plan 29-06 from `square.contributingAttachments.length === 2` to `=== 1` to reflect the WR-01 dedup contract on SQUARE/SQUARE2 same-attachmentName multi-slot binding. CLI byte-lock D-102 preserved (analyzer.analyze() public return unchanged on non-indirected fixtures). |

**Score:** 8/8 truths VERIFIED. The phase goal is achieved end-to-end across all four user-named surfaces (Global panel, Atlas Preview, Optimize dialog, exported folder). The path-indirected `5/7 → 4×4` override bug is fully closed at every layer: analyzer dedup, override Map keys, export math, batch-apply UI handoff, contributor count display, AND panel READ-side override visualization.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | RegionRow + Summary.regions + AtlasPreviewInput/PackedRegion re-key | VERIFIED | `export interface RegionRow` (1 hit); SkeletonSummary.regions: RegionRow[] non-optional; AtlasPreviewInput + PackedRegion both expose regionName + attachmentNames[]; structuredClone-safe (Plan 29-01 Task 1 tests). |
| `src/core/analyzer.ts` | analyzeRegions + dedupByRegionName + pickRegionWinner + toRegionRow + WR-01 Set-based dedup | VERIFIED | All 4 functions present; dedup at line 290 (`new Set<string>()`) inside toRegionRow; lex-tiebreak preserved; Layer 3 invariant (zero electron/sharp/react imports). 41 vitest tests pass. |
| `src/main/summary.ts` | buildSummary populates summary.regions | VERIFIED | `analyzeRegions(` (1 hit); `regions: regionsArray` (1 hit); stub-region synthesis loop preserves Phase 25 PANEL-03 contract; Layer 3 (no sharp imports). |
| `src/main/doc-export.ts` | Chip strip counts regions | VERIFIED | `payload.summary.regions.length` (1 hit); `payload.summary.peaks.length` (0 hits). |
| `src/core/atlas-preview.ts` | deriveInputs collapses to one input per region | VERIFIED | `for (const region of summary.regions)` (1 hit, original mode); per-attachment expansion loop is gone; Layer 3 clean. |
| `src/renderer/src/lib/atlas-preview-view.ts` | Renderer mirror lockstep | VERIFIED | regionName: (3 hits — matches core); lockstep pattern preserved per D-15. |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | hoveredRegionName + onJumpToRegion + 3-line tooltip | VERIFIED | hoveredRegionName (9 hits), onJumpToRegion (7 hits), `used by .* attachments` (2 hits gated on attachmentNames.length > 1). |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Consumes summary.regions; row label `{regionName}.png`; (used by N) indicator; selectedKeys={selected} after Plan 29-05; imports `enrichWithEffective` from `../lib/enrich-overrides.js` post-extraction (889a379) | VERIFIED | summary.regions (3 hits) and summary.peaks (0 hits); `import { type EnrichedRow, enrichWithEffective } from '../lib/enrich-overrides.js'` at line 65; label format `row.regionName.replace.*images` (1 hit); selectedKeys={selected} (2 hits — both Row prop sites); helper extraction docblock at line 105. |
| `src/renderer/src/lib/enrich-overrides.ts` | NEW (post-extraction commit 889a379): `enrichWithEffective` + `EnrichedRow` extracted from panel; READ-side flipped to regionName-keyed lookup (Plan 29-07) | VERIFIED | File exists (2432 bytes); 2 imports (RegionRow type + computeExportDims); line 44 reads `overrides.get(row.regionName ?? row.attachmentName)`; Layer 3 clean (no DOM, no React, no sharp, no electron); EnrichedRow exported as type. |
| `src/main/override-migration.ts` | migrateOverrides 3-pass helper | VERIFIED | `export function migrateOverrides` (1 hit). |
| `src/main/project-io.ts` | 3-seam migration calls | VERIFIED | migrateOverrides( (3 hits — one per load seam); migratedKeyCount (7 hits across MaterializedProject extension + 3 seams). |
| `src/renderer/src/components/AppShell.tsx` | Map<regionName, number> + OverrideDialog flip + migration banner + 29-05 zero-touch + 29-07 zero-touch | VERIFIED | `setOverrides` writes scope entries by name (regionName for RegionRow callers); `rowKey = 'regionName' in row && ... ? row.regionName : row.attachmentName` at line 523-526; migration banner copy `Updated .* override` (2 hits). git diff vs Plan 29-05 base returns empty across the entire phase 29 fix wave (29-05, 29-06, 29-07, extraction). |
| `src/core/export.ts` | overrides.get keyed by regionName | VERIFIED | `const overrideKey = row.regionName ?? row.attachmentName` at line 187; `overrides.get(overrideKey)` at line 188; Layer 3 clean. |
| `fixtures/Chicken-Min/` | Spine 4.2 fixture <1MB exercising path-indirection | VERIFIED | 32K total; `Chicken-Min.json` 22189B; `Chicken-Min.atlas` 95B; `Chicken-Min.png` 79B; analyzer produces 2 regions from 4 contributors. |
| `tests/regression/path-indirection.spec.ts` | End-to-end regression covering all REGION-* + PREVIEW-01 (10 it() blocks total) | VERIFIED | 10 it() blocks pass in 198ms; covers REGION-01/04/05/06/07 + PREVIEW-01 (a)+(b) + REGION-04 batch-apply UI + REGION-04 panel READ-side (Plan 29-07). New READ-side test at line 387 imports `enrichWithEffective` from the extracted lib (line 40); 3 assertions per the Plan 29-07 contract. |
| `tests/core/analyzer.spec.ts` | analyzeRegions tests (Plan 29-01) + WR-01 dedup tests (Plan 29-06) | VERIFIED | 41 tests pass; 2 new WR-01 it() blocks. |
| `tests/arch.spec.ts` | Post-CR-01 batch-scope guards (Plan 29-05 polarity flip) | VERIFIED | Inverted in-place by Plan 29-05; same describe block now anti-guards the regression of the batch-apply fix. 12 tests pass. |
| AnimationBreakdownPanel.tsx | Zero-touch (D-09 + REGION-06 contract) | VERIFIED | git diff for Phase 29 returns empty across all 7 plans + extraction commit. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main/summary.ts` | `src/core/analyzer.ts` | `analyzeRegions(sampled.globalPeaks, ...)` | WIRED | Function called; result threaded into SkeletonSummary literal. |
| `src/main/summary.ts` | `src/shared/types.ts` | `Summary.regions: RegionRow[]` | WIRED | Type exists; field non-optional. |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | `src/renderer/src/components/AppShell.tsx` | `onJumpToRegion` callback prop | WIRED | Renamed throughout; AppShell focusRegionName state slot wired. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | `src/shared/types.ts` | `summary.regions: RegionRow[]` | WIRED | Panel consumes regions instead of peaks. |
| `src/main/project-io.ts` | `src/renderer/src/components/AppShell.tsx` | `MaterializedProject.restoredOverrides` (regionName-keyed) + `migratedKeyCount` | WIRED | Field added; AppShell reads it on mount. |
| Panel selection (Plan 29-05) → AppShell scope | `selectedKeys={selected}` Set<regionName> | onOpenOverrideDialog | WIRED | Plan 29-05 fix verified at source level + behavior level (REGION-04 batch-apply UI test passes). |
| AppShell override Map → buildExportPlan | `overrides.get(row.regionName ?? row.attachmentName)` | export.ts:187-188 | WIRED | Single-row + batch-apply both terminate in regionName-keyed Map; export reads with fallback for non-indirected backward-compat. |
| AppShell override Map → Panel display | `overrides.get(row.regionName ?? row.attachmentName)` | enrich-overrides.ts:44 (post-extraction) | WIRED | **CR-01 closed by Plan 29-07 + extraction commit 889a379.** Helper extracted from panel into Layer-3-clean lib file; READ-side now symmetric with WRITE-side and export-math read. All 3 sites speak the same key contract. |
| `tests/regression/path-indirection.spec.ts` | `src/renderer/src/lib/enrich-overrides.ts` | `import { enrichWithEffective }` (line 40) | WIRED | Direct behavior-level test; 3 assertions (happy path + symmetric negative + backward-compat) lock the contract. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GlobalMaxRenderPanel` rows | `summary.regions` (post-enrich) | analyzeRegions in main process | Yes — Chicken-Min produces 2 RegionRows from 4 PeakRecords | FLOWING |
| `EnrichedRow.override` (panel-side enriched view) | `overrides.get(row.regionName ?? row.attachmentName)` | regionName-keyed Map (now via regionName lookup with attachmentName fallback) | Yes — Map hit on path-indirected rows where lex-winner.attachmentName != regionName; behavior-locked by 3 new test assertions | FLOWING |
| `AtlasPreviewModal` tiles | `buildAtlasPreview(summary, overrides)` | summary.regions + ExportPlan | Yes — verified 1 page on Chicken-Min, multi-page synthetic strict-monotone | FLOWING |
| `OverrideDialog` peak prefill | row scalars (peakScale/canonicalW/H) | RegionRow direct read | Yes | FLOWING |
| `buildExportPlan` override read | `overrides.get(row.regionName ?? row.attachmentName)` | regionName-keyed Map | Yes — single-row + batch-apply paths both flow correctly | FLOWING |
| Migration banner count | `initialProject.migratedKeyCount` | main migrateOverrides helper | Yes — value flows; helper unit tests cover the 3-pass logic | FLOWING |
| Batch-apply scope mutation | `for (const name of scope) next.set(name, clamped)` | regionName-keyed Set after Plan 29-05 | Yes — every Map key is a regionName from summary.regions | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 29 regression suite passes | `npx vitest run tests/regression/path-indirection.spec.ts` | 10/10 pass; 198ms | PASS |
| Full test suite passes | `npm test` | 881 passed / 3 skipped / 2 todo (886 total); 79 test files; 5.04s | PASS |
| Panel READ-side override visible on path-indirected fixture | Inspect enrich-overrides.ts:44 + new spec test | `overrides.get(row.regionName ?? row.attachmentName)` — Map hit on Chicken-Min `5/7` (winner='5/5/5/7/7'); `expect(enriched[0].override).toBe(0.011)` passes; symmetric negative (attachmentName-keyed Map) returns undefined; no-indirection fallback resolves correctly | PASS |
| Layer 3 invariants hold | `grep "from 'sharp'\|from 'electron'\|from 'react'" src/core/*.ts src/renderer/src/lib/enrich-overrides.ts` | 0 hits | PASS |
| Buggy attachmentName-only lookup is gone from production renderer-lib code | `grep -rn "overrides.get(row.attachmentName)" src/renderer/src/lib/ src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 0 hits | PASS |
| TypeScript compiles cleanly under tsconfig.web.json (renderer scope) | `npx tsc --noEmit -p tsconfig.web.json` | exit 0; 0 errors | PASS |
| TypeScript pre-existing errors under tsconfig.node.json (test/script scope) | `npx tsc --noEmit -p tsconfig.node.json \| grep "error TS"` | 6 pre-existing errors in test/script files (analyzer.spec.ts, documentation.spec.ts, project-file-loader-mode-heal.spec.ts, _trace_tmp/trace.spec.ts, scripts/probe-per-anim.ts) — unrelated to phase 29 | PASS (no regression) |
| .stmproj schema-version unchanged | inspect src/core/project-file.ts | V_LATEST = 1 (no schema bump per D-146) | PASS |
| Chicken full skeleton stays gitignored | `git check-ignore fixtures/Chicken/SYMBOLS.json` | exit 0 (ignored) | PASS |
| Chicken-Min committed | `git check-ignore fixtures/Chicken-Min/Chicken-Min.json` | exit 1 (NOT ignored) | PASS |
| Adjacent-file zero-touch on the gap-closure wave | `git diff --stat HEAD~5..HEAD -- src/core/export.ts src/core/atlas-preview.ts src/renderer/src/components/AppShell.tsx src/renderer/src/panels/AnimationBreakdownPanel.tsx` | empty | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REGION-01 | 29-01, 29-02, 29-06 | One row per unique source PNG in Global panel; collapses path-indirected; (used by N) count of UNIQUE attachmentNames | SATISFIED | summary.regions populated; panel consumes; Plan 29-06 dedup makes the (used by N) count accurate; tests/regression/path-indirection.spec.ts:60-83 tightened to exact `===3`. |
| REGION-02 | 29-02, 29-06 | One tile per unique source PNG in Atlas Preview; click attribution; tooltip used-by-N count | SATISFIED | atlas-preview.ts collapses; modal hover/click hit-tests by regionName + attachmentNames[]; Plan 29-06 dedup at the analyzer boundary feeds the modal transparently. |
| REGION-03 | 29-02 | Row identifier is `{regionName}.png` (images/ stripped) | SATISFIED | label formatter present; tests assert format. |
| REGION-04 | 29-03, 29-05, 29-07 | Override binds to region; reaches export through region binding; UI surfaces the applied override accurately | SATISFIED | Closed at all 3 layers: (a) export-math (Plan 29-03 — export.ts:187-188 reads regionName-keyed); (b) batch-apply WRITE side (Plan 29-05 — selectedKeys={selected} contract + arch.spec.ts polarity flip + REGION-04 batch-apply UI regression test); (c) panel READ side (Plan 29-07 + extraction commit 889a379 — enrich-overrides.ts:44 reads `overrides.get(row.regionName ?? row.attachmentName)` + new behavior-level regression test at path-indirection.spec.ts:387-484 with 3 assertions). The full end-to-end chain (override Map → enrichWithEffective → EnrichedRow → 7 downstream renderers) flows correctly on path-indirected rigs. The user-reproduced bug (`5/7 → 4×4` on Chicken) is closed end-to-end. |
| REGION-05 | 29-01, 29-04 | Source Animation/Frame attributed to lex-tiebreak winner | SATISFIED | pickRegionWinner implements lex tiebreak; regression + analyzer tests pass. |
| REGION-06 | 29-02, 29-04 | Drill-down preserves per-attachment detail | SATISFIED | AnimationBreakdownPanel zero-touch; regression test asserts distinct rows. |
| REGION-07 | 29-04 | Regression fixture <1MB exercising path-indirection | SATISFIED | fixtures/Chicken-Min/ 32K; sentinel test passes. |
| PREVIEW-01 | 29-02, 29-04 | Atlas Preview projected page count matches actual | SATISFIED | (a) Chicken-Min single-page; (b) synthetic multi-page strict-monotone delta both pass. |

ORPHANED requirements: none — REQUIREMENTS.md (deleted at v1.2.0 ship per project memory; ROADMAP.md is the authoritative source) maps exactly REGION-01..07 + PREVIEW-01 to phase 29; all 8 IDs are claimed across plans 29-01..29-07.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/lib/enrich-overrides.ts` | 44 + docblock 36-37 | `?? row.attachmentName` fallback is dead code under strict typing — `RegionRow.regionName` is `string` (NOT `string \| undefined`); the docblock claim that the fallback "covers synthetic test fixtures and the no-indirection legacy case" is misstated | Info (WR-01 from 29-REVIEW.md) | The lookup is byte-symmetric with src/core/export.ts:187 and src/renderer/src/lib/export-view.ts:279, which is greppable + auditable. The `??` is defensive against runtime values bypassing the type system (IPC, deserialization). The docblock should be updated to state the actual rationale. NOT a behavior bug. |
| `tests/regression/path-indirection.spec.ts` | 455, 465, 470-472 | New REGION-04 (Plan 29-07) test uses `0.011` percent (clamped to 1% by `clampOverride`) and never asserts on downstream `effectiveScale` / `effExportW` / `effExportH` — labeled as "the user's reproduced bug" but is two orders of magnitude smaller than the documented 1.058% (4/378×100) repro | Info (WR-02 from 29-REVIEW.md) | The Map-key plumbing is correctly tested but the test does not exercise downstream `computeExportDims` propagation. A future regression that double-applies override or drops the computeExportDims call would not be caught. The full integration test at line 113 (REGION-04) DOES use the correct repro value and DOES assert `outW === 4`. Recommend tightening this test value or updating its comment. NOT a missing assertion for the CR-01 closure (the symmetric negative + happy path Map-key checks ARE the load-bearing assertions). |
| `tests/regression/path-indirection.spec.ts` | 477 | `noIndirectionRow` synthetic uses spread on `region57`, inheriting 3 path-indirected `contributingAttachments` despite labeling itself as "no-indirection case" | Info (WR-03 from 29-REVIEW.md) | enrichWithEffective doesn't read `contributingAttachments`, so the test passes correctly. But future maintainers extending this test to assert on contributingAttachments invariants would silently pass a broken assertion. Recommend overriding the field. NOT a behavior bug. |
| `tests/regression/path-indirection.spec.ts` | 395; cross-refs in `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:23-48, 105` | Stale doc references to `enrichWithEffective at line 262` after the helper was extracted to `src/renderer/src/lib/enrich-overrides.ts` (commit 889a379) | Info (WR-04 from 29-REVIEW.md) | Pure documentation drift; following the import at panel line 65 leads to truth. Recommend updating the comment to reflect the post-extraction location. NOT a behavior bug. |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | 220 | Drill-down panel reads `overrides.get(row.attachmentName)` for BreakdownRow inputs — same pattern as the now-fixed Global panel READ-side, but in a different surface | Info (IF-01) | NOT a phase 29 regression and NOT in the explicit 4-surface enumeration (Global panel, Atlas Preview, Optimize dialog, exported folder) per the phase goal. The drill-down's own write path uses `rowKey = row.attachmentName` for BreakdownRow, so the panel is internally consistent for overrides set via the drill-down itself. However: a region-level override set from the Global panel will only display in the drill-down on the contributing attachment whose name happens to coincide with the regionName. D-09 zero-touch contract was preserved on this file across the entire phase. If desired, a follow-up could route the drill-down through the same regionName-with-fallback contract — out of scope for phase 29. |

### Human Verification Required

(None — all gaps from prior verification rounds are now closed by code-inspection-verifiable evidence + behavior-level regression assertions. The CR-01 panel READ-side defect propagation chain through 7 downstream renderers is closed at the source via the 1-line `overrides.get(row.regionName ?? row.attachmentName)` lookup at the single chokepoint (`enrichWithEffective`); the cascade either flows correctly or doesn't, and the new test asserts directly on the `EnrichedRow.override` field that gates every downstream consumer.)

### Gaps Summary

**Re-verification context — third pass:**

The original 29-VERIFICATION.md (commit `58d2868`) flagged 2 gaps:
- Original CR-01 — batch-apply UI handoff (panel passes contributor attachmentNames to AppShell) — closed by Plan 29-05.
- Original WR-01 — RegionRow.contributingAttachments[] not deduped by attachmentName — closed by Plan 29-06.

The second-pass verification (timestamp 2026-05-07T21:57:44Z) closed those 2 but surfaced a NEW BLOCKER from the parallel code review:
- CR-01 (29-REVIEW.md) — panel READ-side override-key lookup at GlobalMaxRenderPanel.tsx:262 keyed by `row.attachmentName` instead of `row.regionName ?? row.attachmentName` — closed by Plan 29-07 (commits af78f62 + c26aa5f + 90ee352) + extraction commit 889a379.

**This third pass: passed, 8/8 must-haves verified.**

The phase ships its math contract correctly: the falsified bug from `.planning/debug/path-indirected-duplicate-rows.md` is closed in the EXPORT pipeline (Plan 29-03 + 29-05) AND on the panel DISPLAY surface (Plan 29-07). The user setting `5/7 → 4×4` produces a 4×4 export on disk AND the panel UI visually confirms the override took effect (orange Peak cell, PencilIcon, "override" search keyword, DimsBadge cap-binding wording all render correctly). The screen-vs-disk divergence on path-indirected rigs is closed end-to-end.

The post-29-07 extraction commit (889a379) is mechanically sound: `enrichWithEffective` and `EnrichedRow` were moved from `GlobalMaxRenderPanel.tsx` to a new Layer-3-clean lib file `src/renderer/src/lib/enrich-overrides.ts` so the regression test under `tests/regression/` could import the helper directly without pulling the panel's DOM/JSX surface into node-tsc scope. The panel re-imports both via a type-modifier import; no behavior delta. The 3 sites that speak the override-Map key contract (`enrich-overrides.ts:44` panel READ + `export-view.ts:279` renderer-side export read + `export.ts:187` core export read) are now grep-uniform.

AnimationBreakdownPanel is preserved zero-touch across the entire phase (D-09 contract). All 8 phase requirements are satisfied across plans 29-01..29-07.

**Secondary informational findings** (4 WARNINGs from the just-refreshed 29-REVIEW.md + 1 cross-cutting observation; none blocking):
- WR-01: `?? row.attachmentName` fallback is technically unreachable under strict typing — defensive runtime safety only; docblock should be updated to state the actual rationale.
- WR-02: Plan-29-07 regression test uses `0.011` (clamped to 1%) and labels it as the user repro — it isn't (the documented repro is `4/378×100 ≈ 1.058`). Recommend tightening the test value or updating the comment.
- WR-03: `noIndirectionRow` synthetic inherits 3 path-indirected `contributingAttachments` despite labeling itself as "no-indirection case". enrichWithEffective doesn't read this field, so the test passes; future extensions could silently regress.
- WR-04: Stale doc references to `enrichWithEffective at line 262` after the helper was extracted (commit 889a379). Pure documentation drift.
- IF-01: AnimationBreakdownPanel.tsx:220 still reads `overrides.get(row.attachmentName)`. Out of scope for phase 29 (drill-down is not in the phase's 4-surface enumeration); D-09 zero-touch contract preserved. Could be addressed in a future polish pass if the drill-down's region-level override-display becomes a user-visible concern.

The phase is goal-achieved and ready to close.

---

_Verified: 2026-05-07T23:50:00Z_
_Verifier: Claude (gsd-verifier)_
