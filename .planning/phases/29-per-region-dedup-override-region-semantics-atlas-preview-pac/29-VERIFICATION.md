---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
verified: 2026-05-07T21:57:44Z
status: gaps_found
score: 7/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "REGION-04 batch-apply UI handoff (original CR-01) — closed by Plan 29-05: GlobalMaxRenderPanel.tsx no longer fans regionNames into contributor attachmentNames; both Row prop sites now pass `selectedKeys={selected}` verbatim. arch.spec.ts polarity inverted to anti-guard the regression. New batch-apply regression test added at tests/regression/path-indirection.spec.ts."
    - "RegionRow.contributingAttachments[] dedup (WR-01) — closed by Plan 29-06: toRegionRow now Set-based-dedups the bucket by attachmentName before emitting contributors. tests/core/analyzer.spec.ts gains 2 new it() blocks; tests/regression/path-indirection.spec.ts:60-83 tightened from `>=2` to exact `===3` + lex-sorted name array equality."
  gaps_remaining: []
  regressions: []
  new_gaps_found_during_re_verification:
    - "CR-01 (29-REVIEW.md, NEW) — panel read-side override lookup at GlobalMaxRenderPanel.tsx:262 still keys by `row.attachmentName` while AppShell's override Map is regionName-keyed (Plans 29-03 + 29-05). On path-indirected fixtures where the REGION-05 lex-winner's attachmentName != regionName (e.g. Chicken-Min region '5/7' has lex-winner '5/5/5/7/7'), enrichWithEffective sees `override === undefined` and the panel UI silently fails to reflect any applied override (orange Peak cell, PencilIcon, 'override' search keyword, DimsBadge cap-binding wording all silently mis-render). Export pipeline still applies the override correctly (export.ts:188 reads regionName-keyed). Net effect: user sets override → export is correct on disk → panel UI does not visually confirm the override on path-indirected rigs → screen-vs-disk divergence with no diagnostic surface."
gaps:
  - truth: "REGION-04 — Override binds to region; reaches export through region binding; UI surfaces the applied override accurately"
    status: partial
    reason: >
      Closed at the export math layer (src/core/export.ts:188 reads
      overrides.get(row.regionName ?? row.attachmentName)) AND closed at the
      batch-apply WRITE path (Plan 29-05 fixed the panel→AppShell handoff and
      added a regression test). The remaining defect is on the panel READ
      path: src/renderer/src/panels/GlobalMaxRenderPanel.tsx:262 (enrichWithEffective)
      reads `overrides.get(row.attachmentName)` instead of
      `overrides.get(row.regionName ?? row.attachmentName)`. AppShell's
      overrides Map is regionName-keyed (Plan 29-03 + 29-05); the panel READ
      side was never updated in that wave. On path-indirected regions where
      the lex-tiebreak winner's attachmentName differs from the regionName
      (Chicken-Min region '5/7' has winner.attachmentName='5/5/5/7/7'), the
      Map miss cascades through EnrichedRow.override → Peak-cell text-accent
      class (Row line 632) → PencilIcon (line 655) → displayScale +
      peakDisplayW/H (computeExportDims defaults to peakScale-only) → state
      tinting (lines 1090, 1214) → 'override' filter keyword (lines 304-306)
      → DimsBadge.effectiveScale prop (lines 600-606). The user sees a
      full-size rendering in the panel even though the on-disk export is
      correctly downscaled. Three stale comments (lines 152, 248-252,
      259-261) still claim Plan 29-03 is pending (it shipped 6 commits ago)
      and rationalize the bug. 29-REVIEW.md flagged this as the
      gap-closure-pass-surviving BLOCKER.
    artifacts:
      - path: "src/renderer/src/panels/GlobalMaxRenderPanel.tsx"
        issue: "Line 262: `const override = overrides.get(row.attachmentName);` — should be `overrides.get(row.regionName ?? row.attachmentName)`. Stale comments at lines 152 + 248-252 + 259-261 still reference Plan 29-03 as pending."
    missing:
      - "Update src/renderer/src/panels/GlobalMaxRenderPanel.tsx:262 from `overrides.get(row.attachmentName)` to `overrides.get(row.regionName ?? row.attachmentName)`."
      - "Rewrite the stale Plan 29-03-pending comments at lines 152 (prop docblock), 248-252 (function docblock), 259-261 (inline) to describe the post-29-05 reality (regionName-keyed Map, fallback to attachmentName for synthetic fixtures + no-indirection case)."
      - "Add a panel-level test that builds a path-indirected synthetic summary where row.regionName != row.attachmentName, builds an overrides Map keyed by regionName, calls enrichWithEffective(rows, overrides), and asserts enriched[0].override === <expected percent>. The existing CR-01 batch-apply test in tests/regression/path-indirection.spec.ts asserts the WRITE side via buildExportPlan but never the READ side via enrichWithEffective."
deferred: []
---

# Phase 29: per-region-dedup-override-region-semantics-atlas-preview-pac Verification Report

**Phase Goal:** After this phase, the user sees one row per unique source PNG across all four surfaces (Global panel, Atlas Preview, Optimize dialog, exported folder), and overrides set on those rows actually reach the export pipeline — closing the correctness bug confirmed in `.planning/debug/path-indirected-duplicate-rows.md` where a user override on `5/7.png` (4×4) was silently erased because the export pipeline took the per-region max across non-overridden sibling attachments.

**Verified:** 2026-05-07T21:57:44Z
**Status:** gaps_found
**Re-verification:** Yes — fresh assessment covering all 6 plans (29-01..29-06) after Plans 29-05 + 29-06 closed the original verification's gaps. New BLOCKER surfaced by 29-REVIEW.md.

## Goal Achievement

### Observable Truths

| #  | Truth (from ROADMAP success criteria) | Status | Evidence |
|----|---------------------------------------|--------|----------|
| 1 | User loads a path-indirected project and the Global panel shows N rows for N unique source PNGs (not per attachment). Each row's identifier reads `{regionName}.png` with `images/` stripped. (REGION-01 + REGION-03) | VERIFIED | `summary.regions: RegionRow[]` populated by `analyzeRegions` (analyzer.ts); GlobalMaxRenderPanel consumes `enrichWithEffective(summary.regions, overridesMap)` at line 803; row label formatter `row.regionName.replace(/^images\//, '') + '.png'` present (1 hit). Regression test at tests/regression/path-indirection.spec.ts:60-83 (REGION-01 detail tightened by Plan 29-06) asserts exactly 3 unique contributingAttachments on Chicken-Min's '5/7' region; PREVIEW-01 (a) asserts pages.length === 1. |
| 2 | User overrides a region row → exported file matches override dims (the falsified bug from `.planning/debug/path-indirected-duplicate-rows.md` no longer reproduces). (REGION-04) | FAILED | EXPORT MATH IS CORRECT: src/core/export.ts:188 reads `overrides.get(row.regionName ?? row.attachmentName)`; tests/regression/path-indirection.spec.ts REGION-04 asserts `outW === 4` for a `5/7 → 4×4` override on Chicken-Min, passes. BATCH WRITE PATH IS CORRECT (post Plan 29-05): tests/regression/path-indirection.spec.ts has a REGION-04 batch-apply UI block that locks `selectedKeys={selected}` source level + buildExportPlan output dims behavior level. PANEL READ PATH IS BROKEN (29-REVIEW.md CR-01): GlobalMaxRenderPanel.tsx:262 reads `overrides.get(row.attachmentName)` — this is the panel's display-side enrichment, not the export pipeline. On path-indirected fixtures where lex-winner.attachmentName != regionName (Chicken-Min '5/7' lex-winner='5/5/5/7/7'), the panel UI shows no visual confirmation of an applied override even though export is correct. From the user's perspective: "I set override → I cannot tell from the panel that it took effect → I have to rerun export to confirm". Counts as FAILED on truth #2 because the user-facing experience of "override produces 4×4 export" is incomplete: the export does, but the panel does not reflect it. |
| 3 | Atlas Preview projects exactly the actual atlas page count (Chicken: 13, not 14). (PREVIEW-01) | VERIFIED | tests/regression/path-indirection.spec.ts has 2 PREVIEW-01 it() blocks: (a) Chicken-Min single-page asserts pages.length === 1 + deriveInputs.length === regions.length (1 input per region — page count is not inflated); (b) synthetic multi-page strict-monotone delta asserts postPages > 0 && prePages > 0 && postPages < prePages (per-region collapse strictly reduces page count when path-indirection forces a cross-page boundary). Both pass. |
| 4 | Source Animation/Frame columns report values from the winning contributing attachment (lex-tiebreak). (REGION-05) | VERIFIED | `pickRegionWinner` in src/core/analyzer.ts implements lex tiebreak on attachmentName.localeCompare; tests/core/analyzer.spec.ts has Test 3 + Test 5 covering the lex-tiebreak rule; tests/regression/path-indirection.spec.ts REGION-05 asserts the winning attachmentName equals the lex-smallest of contributors. Plan 29-06's contributor dedup keeps first-after-lex-sort, matching the row-winner attribution. |
| 5 | Drill-down preserves per-attachment detail. (REGION-06) | VERIFIED | `git log -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` shows the last edit was 2eb57a2 (unrelated, pre-Phase-29). `git diff --stat <pre-Phase-29-base> HEAD -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns empty across all 6 plans — D-09 zero-touch contract preserved. tests/regression/path-indirection.spec.ts REGION-06 asserts that for path-indirected attachmentNames in any animation card, distinct rows persist (path-indirection drill-down drill-down is preserved). |
| 6 | Regression fixture (Chicken-derived subset) <1MB exercises path-indirection. (REGION-07) | VERIFIED | `du -sh fixtures/Chicken-Min/` returns 32K (well under 1MB sentinel); 3 files (Chicken-Min.json 22189B + Chicken-Min.atlas 95B + Chicken-Min.png 79B). `git check-ignore fixtures/Chicken/SYMBOLS.json` exits 0 (full Chicken gitignored); `git check-ignore fixtures/Chicken-Min/Chicken-Min.json` exits 1 (Chicken-Min committed). tests/regression/path-indirection.spec.ts REGION-07 sentinel test asserts `<1024*1024`, passes. |
| 7 | One tile per unique source PNG in Atlas Preview modal in both Original and Optimized modes; click hit-tests attribute to all contributing attachments. (REGION-02) | VERIFIED | src/core/atlas-preview.ts: `for (const region of summary.regions)` (1 hit, original mode); inner per-attachment loop is gone (`for (const attachmentName of row.attachmentNames)` returns 0); regionName + attachmentNames[] both written to AtlasPreviewInput. src/renderer/src/lib/atlas-preview-view.ts mirrors lockstep (3 regionName: hits — same as core). AtlasPreviewModal: 9 hoveredRegionName hits, 7 onJumpToRegion hits, 2 'used by N attachments' tooltip lines (gated on attachmentNames.length > 1). |
| 8 | All ~8+ existing call sites that did `summary.peaks.find(p => p.attachmentName === X)` are migrated without behavior regression on non-path-indirected projects (SIMPLE_PROJECT golden tests pass). | VERIFIED | tests/regression/path-indirection.spec.ts passes 9/9 in 181ms; full test suite reports 871 passing (per Plan 29-06 SUMMARY) with 1 pre-existing failure unrelated to Phase 29 (sampler-worker-girl wall-time gate, deferred). SIMPLE_PROJECT analyzer Test 1 was updated by Plan 29-06 from `square.contributingAttachments.length === 2` to `=== 1` to reflect the WR-01 dedup contract on SQUARE/SQUARE2 same-attachmentName multi-slot binding. CLI byte-lock D-102 preserved (analyzer.analyze() public return unchanged on non-indirected fixtures). |

**Score:** 7/8 truths VERIFIED, 1 truth FAILED. The phase ships correct EXPORT math (the falsified bug is closed in the export pipeline) but ships an incorrect PANEL READ path that mis-renders the visual override surface on path-indirected rigs.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | RegionRow + Summary.regions + AtlasPreviewInput/PackedRegion re-key | VERIFIED | `export interface RegionRow` (1 hit); SkeletonSummary.regions: RegionRow[] non-optional; AtlasPreviewInput + PackedRegion both expose regionName + attachmentNames[]; structuredClone-safe (Plan 29-01 Task 1 tests). |
| `src/core/analyzer.ts` | analyzeRegions + dedupByRegionName + pickRegionWinner + toRegionRow + WR-01 Set-based dedup | VERIFIED | All 4 functions present (each 1 hit); dedup at line 290 (`new Set<string>()`) inside toRegionRow; lex-tiebreak preserved; Layer 3 invariant (zero electron/sharp/react imports). 41 vitest tests pass. |
| `src/main/summary.ts` | buildSummary populates summary.regions | VERIFIED | `analyzeRegions(` (1 hit); `regions: regionsArray` (1 hit); stub-region synthesis loop preserves Phase 25 PANEL-03 contract; Layer 3 (no sharp imports). |
| `src/main/doc-export.ts` | Chip strip counts regions | VERIFIED | `payload.summary.regions.length` (1 hit); `payload.summary.peaks.length` (0 hits). |
| `src/core/atlas-preview.ts` | deriveInputs collapses to one input per region | VERIFIED | regionName: (3 hits); `for (const region of summary.regions)` (1 hit, original mode); per-attachment expansion loop is gone (0 hits for `for (const peak of summary.peaks)`); Layer 3 clean. |
| `src/renderer/src/lib/atlas-preview-view.ts` | Renderer mirror lockstep | VERIFIED | regionName: (3 hits — matches core); lockstep pattern preserved per D-15. |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | hoveredRegionName + onJumpToRegion + 3-line tooltip | VERIFIED | hoveredRegionName (9 hits), hoveredAttachmentName (2 hits — likely test references / fallback comments only; no setter calls), onJumpToRegion (7 hits), onJumpToAttachment (1 hit — likely a comment fragment), `used by .* attachments` (2 hits gated on attachmentNames.length > 1). H_ESTIMATE bumped to 80. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Consumes summary.regions; row label `{regionName}.png`; (used by N) indicator; selectedKeys={selected} after Plan 29-05 | VERIFIED with caveat | summary.regions (3 hits) and summary.peaks (0 hits); label format `row.regionName.replace.*images` (1 hit); contributingAttachments.length > 1 (3 hits, indicator gate); used by N attachments (2 hits); attachmentKey (0 hits — selection key flipped to regionName); focusRegionName (11 hits); selectedAttachmentNames (0 hits — Plan 29-05 expunged) and selectedKeys={selected} (2 hits — both Row prop sites). **CAVEAT:** the panel's READ-side override lookup at line 262 (`overrides.get(row.attachmentName)`) is NOT region-keyed — see Gap 1 below. |
| `src/main/override-migration.ts` | migrateOverrides 3-pass helper | VERIFIED | Extracted to a separate file (per executor's Step 1 option); `export function migrateOverrides` (1 hit). |
| `src/main/project-io.ts` | 3-seam migration calls | VERIFIED | migrateOverrides( (3 hits — one per load seam); migratedKeyCount (7 hits across MaterializedProject extension + 3 seams). |
| `src/renderer/src/components/AppShell.tsx` | Map<regionName, number> + OverrideDialog flip + migration banner + 29-05 zero-touch | VERIFIED | `setOverrides` writes scope entries by name (regionName for RegionRow callers); rowKey = row.regionName ?? row.attachmentName at line 519; overrideMigrationNotice (4 hits — state + setter + JSX + dismiss handler); migration banner copy `Updated .* override` (2 hits). git diff vs c35b9d3 (Plan 29-05 base) returns empty — Plan 29-05 fix is panel-side only as documented. |
| `src/core/export.ts` | overrides.get keyed by regionName | VERIFIED | `const overrideKey = row.regionName ?? row.attachmentName` at line 187; `overrides.get(overrideKey)` at line 188; Layer 3 clean. |
| `fixtures/Chicken-Min/Chicken-Min.json` | Spine 4.2 JSON skeleton with path-indirection | VERIFIED | 22189 bytes; analyzer produces 2 regions from 4 contributors. |
| `fixtures/Chicken-Min/Chicken-Min.atlas` | TextureAtlas with path-indirected regions | VERIFIED | 95 bytes; 5/7 + 5/BLOOD_DROP regions. |
| `fixtures/Chicken-Min/Chicken-Min.png` | Stub atlas page PNG | VERIFIED | 79 bytes; 16×16 stub. |
| `tests/regression/path-indirection.spec.ts` | End-to-end regression (8 it() blocks for original 4 plans + 1 from Plan 29-05 + 1 tightened from Plan 29-06) | VERIFIED with caveat | 9 it() blocks pass in 181ms; covers REGION-01/04/05/06/07 + PREVIEW-01 (a)+(b) + REGION-04 batch-apply UI. **CAVEAT:** the suite asserts the WRITE path (selectedKeys → AppShell scope mutation → buildExportPlan outW) but does NOT assert the READ path (overrides Map → enrichWithEffective → EnrichedRow.override). Gap 1 (CR-01) is uncaught. |
| `tests/core/analyzer.spec.ts` | analyzeRegions tests (Plan 29-01) + WR-01 dedup tests (Plan 29-06) | VERIFIED | 41 tests pass; 2 new WR-01 it() blocks (`grep -c "WR-01 / Phase 29 Plan 29-06"` returns 2). |
| `tests/arch.spec.ts` | Post-CR-01 batch-scope guards (Plan 29-05 polarity flip) | VERIFIED | Inverted in-place by Plan 29-05; same describe block now anti-guards the regression of the batch-apply fix (require `selectedKeys={selected}` >=2 sites; forbid `selectedAttachmentNames`). 12 tests pass. |
| AnimationBreakdownPanel.tsx | Zero-touch (D-09 + REGION-06 contract) | VERIFIED | Last commit on this file is 2eb57a2 (unrelated). git diff for Phase 29 returns empty across all 6 plans. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main/summary.ts` | `src/core/analyzer.ts` | `analyzeRegions(sampled.globalPeaks, ...)` | WIRED | Function called; result assigned to regionsArray; field threaded into SkeletonSummary literal. |
| `src/main/summary.ts` | `src/shared/types.ts` | `Summary.regions: RegionRow[]` | WIRED | Type exists; field non-optional. |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | `src/renderer/src/components/AppShell.tsx` | `onJumpToRegion` callback prop | WIRED | Renamed throughout; AppShell focusRegionName state slot wired. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | `src/shared/types.ts` | `summary.regions: RegionRow[]` | WIRED | Panel consumes regions instead of peaks. |
| `src/main/project-io.ts` | `src/renderer/src/components/AppShell.tsx` | `MaterializedProject.restoredOverrides` (regionName-keyed) + `migratedKeyCount` | WIRED | Field added; AppShell reads it on mount. |
| Panel selection (Plan 29-05) → AppShell scope | `selectedKeys={selected}` Set<regionName> | onOpenOverrideDialog | WIRED | Plan 29-05 fix verified at source level (selectedAttachmentNames count = 0; selectedKeys={selected} count = 2) and behavior level (REGION-04 batch-apply UI test passes). |
| AppShell override Map → buildExportPlan | `overrides.get(row.regionName ?? row.attachmentName)` | export.ts:188 | WIRED | Single-row + batch-apply both terminate in regionName-keyed Map; export reads with fallback for non-indirected backward-compat. |
| AppShell override Map → Panel display | `overrides.get(row.regionName ?? row.attachmentName)` (expected) | enrichWithEffective at GlobalMaxRenderPanel.tsx:262 | NOT_WIRED | **The actual code reads `overrides.get(row.attachmentName)` — the regionName fallback is missing on the READ side.** This is the surviving CR-01 BLOCKER from 29-REVIEW.md. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GlobalMaxRenderPanel` rows | `summary.regions` (post-enrich) | analyzeRegions in main process | Yes — Chicken-Min produces 2 RegionRows from 4 PeakRecords | FLOWING |
| `EnrichedRow.override` (panel-side enriched view) | `overrides.get(row.attachmentName)` | regionName-keyed Map (via attachmentName lookup) | NO — Map miss on path-indirected rows where lex-winner.attachmentName != regionName | DISCONNECTED (panel READ side; CR-01 from review) |
| `AtlasPreviewModal` tiles | `buildAtlasPreview(summary, overrides)` | summary.regions + ExportPlan | Yes — verified 1 page on Chicken-Min, multi-page synthetic strict-monotone | FLOWING |
| `OverrideDialog` peak prefill | row scalars (peakScale/canonicalW/H) | RegionRow direct read | Yes — RegionRow exposes the same scalars as DisplayRow | FLOWING |
| `buildExportPlan` override read | `overrides.get(row.regionName ?? row.attachmentName)` | regionName-keyed Map | Yes — single-row + batch-apply paths both flow correctly | FLOWING |
| Migration banner count | `initialProject.migratedKeyCount` | main migrateOverrides helper | Yes — value flows; helper unit tests cover the 3-pass logic | FLOWING |
| Batch-apply scope mutation | `for (const name of scope) next.set(name, clamped)` | regionName-keyed Set after Plan 29-05 | Yes — every Map key is a regionName from summary.regions | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 29 regression suite passes | `npx vitest run tests/regression/path-indirection.spec.ts` | 9/9 pass; 181ms | PASS |
| Analyzer WR-01 dedup tests pass | `grep -c "WR-01 / Phase 29 Plan 29-06" tests/core/analyzer.spec.ts` | 2 hits; runs in full analyzer suite (41 tests) | PASS |
| arch.spec.ts post-CR-01 guards green | (Plan 29-05 polarity-flipped) | 12 tests pass per Plan 29-05 SUMMARY | PASS |
| Panel READ-side override visible on path-indirected fixture | Manual inspection of GlobalMaxRenderPanel.tsx:262 | `overrides.get(row.attachmentName)` — Map miss on Chicken-Min `5/7` (winner='5/5/5/7/7') | FAIL — Gap 1 |
| Layer 3 invariants hold | `grep -rn "from 'sharp'\|from 'electron'\|from 'react'" src/core/analyzer.ts src/core/atlas-preview.ts src/core/export.ts` | 0 hits | PASS |
| .stmproj schema-version unchanged | inspect src/core/project-file.ts | V_LATEST = 1 (no schema bump per D-146) | PASS |
| Chicken full skeleton stays gitignored | `git check-ignore fixtures/Chicken/SYMBOLS.json` | exit 0 (ignored) | PASS |
| Chicken-Min committed | `git check-ignore fixtures/Chicken-Min/Chicken-Min.json` | exit 1 (NOT ignored) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REGION-01 | 29-01, 29-02, 29-06 | One row per unique source PNG in Global panel; collapses path-indirected; (used by N) count of UNIQUE attachmentNames | SATISFIED | summary.regions populated; panel consumes; Plan 29-06 dedup makes the (used by N) count accurate; tests/regression/path-indirection.spec.ts:60-83 tightened to exact `===3`. |
| REGION-02 | 29-02, 29-06 | One tile per unique source PNG in Atlas Preview; click attribution; tooltip used-by-N count | SATISFIED | atlas-preview.ts collapses; modal hover/click hit-tests by regionName + attachmentNames[]; Plan 29-06 dedup at the analyzer boundary feeds the modal transparently. |
| REGION-03 | 29-02 | Row identifier is `{regionName}.png` (images/ stripped) | SATISFIED | label formatter present; tests assert format. |
| REGION-04 | 29-03, 29-05 | Override binds to region; reaches export through region binding | BLOCKED | Closed at export-math layer (single-row + batch-apply paths both verified). PANEL READ-side display surface is broken (Gap 1 below) — the user sets an override → export is correct → panel UI does not visually confirm on path-indirected rigs. Visible UX defect bisects the success criterion. |
| REGION-05 | 29-01, 29-04 | Source Animation/Frame attributed to lex-tiebreak winner | SATISFIED | pickRegionWinner implements lex tiebreak; regression + analyzer tests pass. |
| REGION-06 | 29-02, 29-04 | Drill-down preserves per-attachment detail | SATISFIED | AnimationBreakdownPanel zero-touch; regression test asserts distinct rows. |
| REGION-07 | 29-04 | Regression fixture <1MB exercising path-indirection | SATISFIED | fixtures/Chicken-Min/ 32K; sentinel test passes. |
| PREVIEW-01 | 29-02, 29-04 | Atlas Preview projected page count matches actual | SATISFIED | (a) Chicken-Min single-page; (b) synthetic multi-page strict-monotone delta both pass. |

ORPHANED requirements: none — REQUIREMENTS.md maps exactly REGION-01..07 + PREVIEW-01 to phase 29; all 8 IDs are claimed across plans 29-01..29-06.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 262 | Asymmetric Map key: WRITE side is regionName-keyed (post 29-03+29-05), READ side is attachmentName-keyed | Blocker | Gap 1 — panel UI does not reflect applied overrides on path-indirected rigs (user sets override → export is correct → panel display is wrong → screen-vs-disk divergence with no diagnostic) |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 152, 248-252, 259-261 | Stale code comments claim Plan 29-03 is pending (it shipped 6 commits ago at `2bea027`) | Warning | WR-02 from 29-REVIEW.md — comments mislead anyone tracing the override pipeline; rationalize the bug at line 262 |
| `tests/arch.spec.ts:128`, `tests/regression/path-indirection.spec.ts:320` | regex `/selectedKeys=\{selected\}/g` | Source-level positive grep on JSX literal is brittle to harmless refactors | Warning | WR-03 from 29-REVIEW.md — would fail CI on a `selected → selectedRegionKeys` rename even if contract is preserved; the negative-grep on `selectedAttachmentNames` is the load-bearing guard |
| `src/core/analyzer.ts` | 290-297 | First-after-lex-sort dedup picks Map-iteration-order slot for kept contributor (not max-peakScale per attachmentName) | Warning | WR-01 from 29-REVIEW.md (separate from the Plan 29-06 closure) — when one attachmentName binds to slots with DIFFERING peakScales, the kept entry's peakScale may be lower than the row's peakScale (the row scalar is computed by pickRegionWinner across all bucket members; the contributor entry is first-after-lex-sort). Today the contributor.peakScale field is not user-displayed; future surface that reads it would inherit this inconsistency. The Plan 29-06 tests use equal peakScales so cannot expose the ambiguity. |

### Human Verification Required

(None — Gap 1 is mechanically verifiable by code inspection. The defect propagation chain is documented in 29-REVIEW.md CR-01 and confirmed by reading line 262 verbatim. No user-facing testing required to confirm; the next plan can target the fix surgically.)

### Gaps Summary

**Re-verification context:** The original 29-VERIFICATION.md (commit `58d2868`) flagged 2 gaps:
- Original CR-01 — batch-apply UI handoff (panel passes contributor attachmentNames to AppShell)
- Original WR-01 — RegionRow.contributingAttachments[] not deduped by attachmentName

Both were closed by Plans 29-05 + 29-06 in this session:
- Plan 29-05: `selectedAttachmentNames` memo deleted; both Row prop sites now `selectedKeys={selected}`; arch.spec.ts polarity inverted; regression test added at tests/regression/path-indirection.spec.ts.
- Plan 29-06: toRegionRow gains Set-based dedup on the lex-sorted bucket; 2 new analyzer it() blocks lock the dedup contract; tests/regression/path-indirection.spec.ts:60-83 tightened from `>=2` to exact `===3`.

**However**, the code review (29-REVIEW.md) ran in parallel and surfaced a **NEW** BLOCKER (the review labels it CR-01 in its own numbering, distinct from the original verification's CR-01) at GlobalMaxRenderPanel.tsx:262. This defect predates the current gap-closure pass — it was introduced in commit `0011f0d feat(04-03)` and missed by Plans 29-02 + 29-03. It survived 29-05 because Plan 29-05 fixed the WRITE side of the override pipeline (panel selection → AppShell scope mutation) but never the READ side (Map → panel display).

The phase ships its math contract correctly: the falsified bug from `.planning/debug/path-indirected-duplicate-rows.md` is closed in the EXPORT pipeline. The user setting `5/7 → 4×4` produces a 4×4 export on disk. The regression test asserts this end-to-end on the committed Chicken-Min fixture. AnimationBreakdownPanel is preserved zero-touch (D-09 contract). All 8 phase requirements are accounted for across plans 29-01..29-06.

The phase MISSES on the panel display surface: when a user opens the Global Max Render panel for a path-indirected rig, the panel's `enrichWithEffective` helper at line 262 reads the override Map by `row.attachmentName` instead of `row.regionName ?? row.attachmentName`. AppShell's Map is regionName-keyed (Plan 29-03 + 29-05 contract). For regions where the lex-tiebreak winner's attachmentName equals the regionName (the no-indirection common case AND any path-indirected case where the regionName itself appears as a contributor — e.g. Chicken-Min `5/7` has contributors `5/5/5/7/7`, `5/5/7/7`, `5/7`, but the LEX-WINNER is `5/5/5/7/7`, NOT the regionName), `overrides.get(row.attachmentName)` returns `undefined` and the panel shows no visual confirmation of an applied override.

The cascade through EnrichedRow.override → Peak-cell text-accent class → PencilIcon → displayScale → state tinting → 'override' filter keyword → DimsBadge means: the user sets an override, the panel keeps showing full-size rendering with no orange Peak cell + no pencil icon, then the export silently produces the correctly-downscaled file. This is a screen-vs-disk divergence with no diagnostic surface — exactly the failure mode the phase set out to close, just shifted from EXPORT to DISPLAY.

**Resolution requires a small, surgical fix:**
1. Update `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:262` from `overrides.get(row.attachmentName)` to `overrides.get(row.regionName ?? row.attachmentName)`.
2. Rewrite the 3 stale code comments at lines 152, 248-252, 259-261 to describe the post-29-05 reality (regionName-keyed Map, fallback for synthetic fixtures + no-indirection backward-compat).
3. Add a panel-level regression test that builds a path-indirected synthetic summary where `row.regionName != row.attachmentName`, builds an overrides Map keyed by regionName, and asserts `enriched[0].override === <expected percent>`.

This is a one-line code fix + comment cleanup + a small test. Estimated scope: a single gap-closure plan (Plan 29-07 if pursued).

**Secondary informational findings** (not blockers):
- WR-02 (29-REVIEW.md): stale code comments at lines 152, 248-252, 259-261 — should be cleaned up alongside the Gap 1 fix.
- WR-03 (29-REVIEW.md): brittle source-level grep guards in arch.spec.ts:128 + path-indirection.spec.ts:320. Either drop the positive `selectedKeys={selected}` grep (keep only the negative `selectedAttachmentNames` guard which catches the actual regression class), or rewrite as a behavior-level jsdom assertion.
- WR-01 (29-REVIEW.md, distinct from the original verification's WR-01 closed by Plan 29-06): contributor.peakScale dedup is not max-peakScale-per-attachmentName but first-after-lex-sort. Today not user-visible; future-proofing if any surface starts reading contributor.peakScale.

---

_Verified: 2026-05-07T21:57:44Z_
_Verifier: Claude (gsd-verifier)_
