---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
verified: 2026-05-07T20:55:52Z
status: gaps_found
score: 6/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "REGION-04 — overrides bind to region and reach the export pipeline through region binding"
    status: partial
    reason: >
      Closed at the export math layer (src/core/export.ts:187 reads
      overrides.get(row.regionName ?? row.attachmentName) and the regression
      test at tests/regression/path-indirection.spec.ts:99 passes). HOWEVER
      the batch-apply UI handoff between GlobalMaxRenderPanel and AppShell
      is broken: the panel expands selected regions into the union of
      contributing attachmentNames (selectedAttachmentNames memo at
      GlobalMaxRenderPanel.tsx:825-833) and passes that Set as
      `selectedKeys` to AppShell's onOpenOverrideDialog. AppShell at
      AppShell.tsx:511-585 has been re-keyed for Phase 29 D-04 and
      computes `rowKey = row.regionName`, then checks
      `selectedKeys.has(rowKey)` — a Set of attachmentNames against a
      regionName. The override Map (regionName-keyed post-29-03) is then
      mutated via `for (const name of scope) next.set(name, clamped)`
      where `scope = [...selectedKeys]` (attachmentNames). This poisons
      the Map with contributor-name keys (which buildExportPlan does NOT
      pick up — they are not regionNames; only the legitimate '5/7'
      key matches). For path-indirected projects, batch overrides
      either (a) silently degrade to single-row scope (when the
      regionName never appears as a contributor's attachmentName, e.g.
      'images/5/7' regionName with contributors '5/5/5/7/7' '5/5/7/7'
      '5/7' — the regionName is NOT in the expanded contributor Set so
      `inSelection=false`); or (b) write contributor-name keys into
      the regionName-keyed Map (Chicken `5/7` case, regionName equals
      one of its contributors so `inSelection=true` and `scope`
      becomes the contributor list, only one of which is a real
      regionName). The visible defect: user shift-selects N regions in
      the Global panel and double-clicks one → expects all N to be
      overridden → only 1 region (or none, depending on case A/B
      above) actually receives the override at export time.
      The regression spec at tests/regression/path-indirection.spec.ts
      bypasses the UI flow entirely (constructs `new Map([['5/7',
      percent]])` directly at line 99) so this defect is uncaught by
      tests. The 29-REVIEW.md CR-01 finding describes the exact
      mechanism. REGION-04's contract — "Setting an override on a
      Global Max Render row sizes the underlying source PNG file at
      export time; the override applies to all attachments resolving
      to that region" — only holds for the single-row override path,
      not for the batch-select path.
    artifacts:
      - path: "src/renderer/src/panels/GlobalMaxRenderPanel.tsx"
        issue: "Lines 825-833 build selectedAttachmentNames by expanding regions into contributor attachmentNames; this Set is passed as selectedKeys at lines 1116 + 1240. The Set's elements are attachmentNames; AppShell now keys by regionName."
      - path: "src/renderer/src/components/AppShell.tsx"
        issue: "Lines 511-585: rowKey=row.regionName, selectedKeys.has(rowKey) — checks regionName membership in an attachmentName Set; scope=[...selectedKeys] writes attachmentNames into the regionName-keyed override Map at line 583."
    missing:
      - "Replace selectedAttachmentNames memo at GlobalMaxRenderPanel.tsx:825-833 with the regionName-keyed `selected` Set already maintained at line 706 + write sites; pass `selected` directly as selectedKeys at lines 1116 + 1240."
      - "Drop the now-unused `selectedAttachmentNames` memo and update the JSDoc at GlobalMaxRenderPanel.tsx:38-44 + 818-824 which still references the obsolete attachmentName handoff."
      - "Add a regression test that shift-selects multiple regions in the panel, batch-applies an override, and asserts both the resulting `overrides` Map keys (must be regionNames only — no contributor names) AND the export-plan output dims for every selected region."

  - truth: "RegionRow.contributingAttachments[] count is accurate (used by N attachments indicator)"
    status: partial
    reason: >
      analyzeRegions at src/core/analyzer.ts:341-358 (dedupByRegionName)
      and toRegionRow operate on the FULL globalPeaks Map without
      attachmentName-deduping the bucket. When one attachmentName binds
      to multiple slots (Chicken-Min: attachmentName='5/7' on slots 7
      and 8 + slots VOLUME_7 and VOLUME_8), the result has duplicate
      contributor entries. The visible UX defect: GlobalMaxRenderPanel's
      `(used by N attachments)` indicator at row label and the
      AtlasPreviewModal's `used by N attachments` tooltip both report
      inflated counts. The regression test at
      tests/regression/path-indirection.spec.ts:60-69 doesn't catch this
      because the assertion is `>= 2` and `toContain('5/7')`, both of
      which still pass with the duplicate. This is WR-01 in 29-REVIEW.md.
      Not a hard correctness blocker for export math, but the
      `(used by N attachments)` UI surface — the visible REGION-01 and
      REGION-02 contract for distinguishing path-indirected from non-
      indirected rows — shows wrong numbers on rigs where any
      attachmentName binds to multiple slots.
    artifacts:
      - path: "src/core/analyzer.ts"
        issue: "Lines 341-358 (dedupByRegionName) and 277-328 (toRegionRow) do not dedup the bucket by attachmentName before mapping into contributingAttachments[]."
    missing:
      - "Dedup contributors by attachmentName inside toRegionRow before mapping into the array (Set-based filter; pick first occurrence after sort)."
      - "Add a unit test in tests/core/analyzer.spec.ts asserting contributingAttachments.length === 1 when two PeakRecords share attachmentName + regionName but differ in slotName."
---

# Phase 29: per-region-dedup-override-region-semantics-atlas-preview-pac Verification Report

**Phase Goal:** Closes the path-indirection correctness bug surfaced post-v1.3 ship — overrides keyed by attachmentName never reach the export pipeline keyed by region. Lands per-region dedup in the analyzer/summary, re-keys override storage by regionName with a one-shot .stmproj migration, makes Atlas Preview emit one tile per source PNG (one-to-one with regions, not per-attachment), and ships a Chicken-Min regression fixture that locks the 4-surface invariant.

**Verified:** 2026-05-07T20:55:52Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | REGION-01 — One row per unique source PNG in the Global Max Render panel; collapses path-indirected attachments into a single row whose displayed peak equals the maximum peak across contributors | VERIFIED | `summary.regions: RegionRow[]` populated by `analyzeRegions` (analyzer.ts); GlobalMaxRenderPanel consumes `summary.regions` (line 803); regression test passes — `summary.regions.length < summary.peaks.length` on Chicken-Min |
| 2  | REGION-02 — One tile per unique source PNG in the Atlas Preview modal in both Original and Optimized modes; click hit-tests on a tile attribute to all contributing attachments | VERIFIED | `src/core/atlas-preview.ts` deriveInputs collapses to one input per region (verified by tests/core/atlas-preview.spec.ts); AtlasPreviewModal hover/click uses regionName + attachmentNames[]; tests/renderer/atlas-preview-modal.spec.tsx passes |
| 3  | REGION-03 — Each Global panel row displays its identifier as `{regionName}.png` (images/ prefix stripped) | VERIFIED | GlobalMaxRenderPanel.tsx renders `row.regionName.replace(/^images\//, '') + '.png'`; tests/renderer/global-max-render-panel.spec.tsx asserts the format |
| 4  | REGION-04 — Setting an override on a Global Max Render row sizes the underlying source PNG file at export time; the override applies to all attachments resolving to that region | FAILED | Single-row override path is closed (export.ts:187 reads `overrides.get(row.regionName ?? row.attachmentName)`; tests/regression/path-indirection.spec.ts REGION-04 passes asserting outW=4). BATCH-APPLY UI HANDOFF IS BROKEN: GlobalMaxRenderPanel.tsx:825-833 expands selected regions into contributor attachmentNames and passes them as `selectedKeys`; AppShell.tsx:511-585 reads `rowKey=row.regionName` and checks `selectedKeys.has(rowKey)` against an attachmentName Set, then writes `[...selectedKeys]` (attachmentNames) into the regionName-keyed override Map. See 29-REVIEW.md CR-01. The defect is undetected by tests because the regression spec at line 99 constructs the override Map directly. |
| 5  | REGION-05 — Source Animation column and Frame column attribute their values to the winning contributing attachment (lex-smallest attachmentName tiebreak) | VERIFIED | `pickRegionWinner` in analyzer.ts implements the lex tiebreak; tests/regression/path-indirection.spec.ts REGION-05 passes; tests/core/analyzer.spec.ts has explicit lex-tiebreak tests |
| 6  | REGION-06 — Drill-down (Animation Breakdown panel) preserves per-attachment detail; region-level dedup does not erase per-attachment information | VERIFIED | `git diff --stat 5e5e365..HEAD -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns empty (zero-touch across all 4 plans); tests/regression/path-indirection.spec.ts REGION-06 asserts distinct rows for path-indirected attachmentNames in the 5/PRIZE animation card |
| 7  | REGION-07 — Regression fixture (Chicken-derived subset, <1MB) exercises path-indirection and locks the per-region dedup contract | VERIFIED | fixtures/Chicken-Min/ exists with 3 files (Chicken-Min.json 22189B + Chicken-Min.atlas 95B + Chicken-Min.png 79B; 22363B total, ~22KB); tests/regression/path-indirection.spec.ts REGION-07 sentinel passes (`<1024*1024`); fixtures/Chicken/ is gitignored |
| 8  | PREVIEW-01 — For path-indirected projects, Atlas Preview's projected page count matches the actual atlas page count | VERIFIED | tests/regression/path-indirection.spec.ts PREVIEW-01 (a) on Chicken-Min asserts pages.length === 1; (b) synthetic multi-page strict-monotone delta asserts postPages < prePages; both pass |

**Score:** 7/8 truths fully verified; 1 truth partially closed (REGION-04 batch-apply UI defect). Counted strictly: **6/8** if batch-apply is required for REGION-04 closure; **7/8** if the export-math layer is sufficient.

The contributingAttachments dedup defect (WR-01 in 29-REVIEW.md) is a partial defect on REGION-01/REGION-02 visible UX (count display in `(used by N attachments)`), but the underlying region-grouping math is correct. Captured as a secondary gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | RegionRow interface + Summary.regions field + AtlasPreviewInput/PackedRegion re-key | VERIFIED | `export interface RegionRow` present (1); `regions: RegionRow[]` on SkeletonSummary; AtlasPreviewInput + PackedRegion both expose `regionName` + `attachmentNames[]` |
| `src/core/analyzer.ts` | analyzeRegions + dedupByRegionName + pickRegionWinner | VERIFIED | All four exports present (`analyze`, `analyzeRegions`, `pickRegionWinner`, `dedupByRegionName`, `toRegionRow`); Layer 3 invariant preserved |
| `src/main/summary.ts` | buildSummary populates summary.regions | VERIFIED | `regions: regionsArray` field present; `analyzeRegions(...)` call mirrors `analyze(...)`; stub-region synthesis loop preserves Phase 25 PANEL-03 contract |
| `src/main/doc-export.ts` | Chip strip counts regions | VERIFIED | `payload.summary.regions.length` (1 hit); `payload.summary.peaks.length` (0 hits) |
| `src/core/atlas-preview.ts` | deriveInputs collapses to one input per region | VERIFIED | `regionName: regionRow.regionName` + `attachmentNames: filteredNames` patterns present; original mode walks `summary.regions`; Layer 3 clean |
| `src/renderer/src/lib/atlas-preview-view.ts` | Renderer mirror lockstep | VERIFIED | byte-identical mirror of core change (parity test in tests/core/atlas-preview.spec.ts) |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | hoveredRegionName + onJumpToRegion + 3-line tooltip | VERIFIED | All renames in place; `H_ESTIMATE = 80`; tooltip with `${region.regionName}.png` + conditional `used by N attachments` line |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Consumes summary.regions; row label `{regionName}.png` with images/ stripped; (used by N) indicator | VERIFIED with caveat | Data source flipped to `summary.regions`; label format correct; indicator gated on `contributingAttachments.length > 1`; selectedAttachmentNames memo at 825-833 is the locus of CR-01 (gap above) |
| `src/main/override-migration.ts` | migrateOverrides 3-pass helper | VERIFIED | `export function migrateOverrides` present; iteration-order-independent two-pass with lex-smallest tiebreak; tests/main/override-migration.spec.ts (10 tests) all pass |
| `src/main/project-io.ts` | 3-seam migration calls | VERIFIED | `migratedKeyCount` 7 hits; helper called from mountOpenResponse + mainOpen + locate-skeleton-recovery |
| `src/renderer/src/components/AppShell.tsx` | Map<regionName, number> + OverrideDialog flip + migration banner | VERIFIED with caveat | overrides Map regionName-keyed; OverrideDialog peak read flipped; banner copy `Updated N override(s) to per-region keys.` at line 1822; auto-clear at 5 sites. Caveat: batch-apply scope handling at lines 511-585 is the AppShell side of CR-01 (gap above) |
| `src/core/export.ts` | overrides.get keyed by regionName | VERIFIED | `const overrideKey = row.regionName ?? row.attachmentName` at line 187; Layer 3 clean |
| `src/renderer/src/lib/export-view.ts` | Renderer mirror lockstep | VERIFIED | byte-identical mirror |
| `fixtures/Chicken-Min/Chicken-Min.json` | Spine 4.2 JSON skeleton with path-indirection | VERIFIED | 22189 bytes; 4 contributing attachment names resolve to 2 regions |
| `fixtures/Chicken-Min/Chicken-Min.atlas` | TextureAtlas with path-indirected regions | VERIFIED | 95 bytes; 5/7 + 5/BLOOD_DROP regions |
| `fixtures/Chicken-Min/Chicken-Min.png` | Stub atlas page PNG | VERIFIED | 79 bytes; 16×16 stub |
| `tests/regression/path-indirection.spec.ts` | End-to-end regression test | VERIFIED with caveat | 8 it() blocks all pass; covers REGION-01/04/05/06/07 + PREVIEW-01 (a)+(b). Caveat: does NOT exercise the batch-apply UI path that CR-01 falsifies |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main/summary.ts` | `src/core/analyzer.ts` | `analyzeRegions(sampled.globalPeaks, ...)` | WIRED | Function called; result assigned to `regionsArray`; field threaded into SkeletonSummary literal |
| `src/main/summary.ts` | `src/shared/types.ts` | `Summary.regions: RegionRow[]` | WIRED | Type exists; field non-optional |
| `src/renderer/src/modals/AtlasPreviewModal.tsx` | `src/renderer/src/components/AppShell.tsx` | onJumpToRegion callback prop | WIRED | Prop renamed throughout; AppShell focusRegionName state slot wired |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | `src/shared/types.ts` | `summary.regions: RegionRow[]` | WIRED | Panel consumes regions instead of peaks |
| `src/main/project-io.ts` | `src/renderer/src/components/AppShell.tsx` | `MaterializedProject.restoredOverrides` (regionName-keyed) + `migratedKeyCount` | WIRED | Field added to MaterializedProject; AppShell reads it on mount |
| `src/renderer/src/components/AppShell.tsx` | `src/main/export pipeline` | `overrides.get(row.regionName)` flows into `buildExportPlan` | WIRED for single-row, BROKEN for batch | Single-row: panel→AppShell→Map→export all key on regionName. Batch: panel passes attachmentName Set to AppShell; AppShell writes attachmentNames into the regionName-keyed Map; buildExportPlan only finds the legitimate `[rowKey]` entry, not the contributor entries (CR-01). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GlobalMaxRenderPanel` rows | `summary.regions` (post-enrich) | analyzeRegions in main process | Yes — Chicken-Min produces 2 RegionRows from 4 PeakRecords | FLOWING |
| `AtlasPreviewModal` tiles | `buildAtlasPreview(summary, overrides)` | summary.regions + ExportPlan | Yes — verified 1 page on Chicken-Min, multi-page synthetic strict-monotone | FLOWING |
| `OverrideDialog` peak prefill | row scalars (peakScale/canonicalW/H) | RegionRow direct read | Yes — RegionRow exposes the same scalars as DisplayRow | FLOWING |
| `buildExportPlan` override read | `overrides.get(row.regionName ?? row.attachmentName)` | regionName-keyed Map | Yes for single-row; HOLLOW_PROP for batch (Map polluted by attachmentName scope writes) | HOLLOW_PROP |
| Migration banner count | `initialProject.migratedKeyCount` | main migrateOverrides helper | Yes — value flows; 10 unit tests cover the helper | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 29 regression suite passes | `npx vitest run tests/regression/path-indirection.spec.ts` | 8/8 pass; 181ms | PASS |
| Migration helper unit tests pass | `npx vitest run tests/main/override-migration.spec.ts` | included in 79/79 pass | PASS |
| Export plan unit tests pass | `npx vitest run tests/core/export.spec.ts` | included in 79/79 pass | PASS |
| Override Map polluted by batch-apply on path-indirected fixture | (no automated test exists; CR-01 describes the mechanism) | not tested | SKIP — needs UI integration test or human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REGION-01 | 29-01, 29-02 | One row per unique source PNG in Global Max Render panel | SATISFIED | summary.regions populated; panel consumes it; regression test passes |
| REGION-02 | 29-02 | One tile per unique source PNG in Atlas Preview modal; click attribution | SATISFIED | atlas-preview.ts collapses; modal hover/click hit-tests by regionName + attachmentNames[] |
| REGION-03 | 29-02 | Row identifier is `{regionName}.png` (images/ prefix stripped) | SATISFIED | label formatter present; tests assert format |
| REGION-04 | 29-03 | Override binds to region; reaches export through region binding | BLOCKED | Closed at export-math layer (single-row path verified); UI batch-apply handoff is broken (CR-01). Listed as gap. |
| REGION-05 | 29-01, 29-04 | Source Animation/Frame attributed to winning contributing attachment (lex tiebreak) | SATISFIED | pickRegionWinner implements lex tiebreak; regression + analyzer tests pass |
| REGION-06 | 29-02, 29-04 | Drill-down preserves per-attachment detail | SATISFIED | AnimationBreakdownPanel zero-touch; regression test asserts distinct rows |
| REGION-07 | 29-04 | Regression fixture <1MB exercising path-indirection | SATISFIED | fixtures/Chicken-Min/ ~22KB; sentinel test passes |
| PREVIEW-01 | 29-02, 29-04 | Atlas Preview projected page count matches actual atlas page count | SATISFIED | (a) Chicken-Min single-page; (b) synthetic multi-page strict-monotone delta both pass |

ORPHANED requirements: none — REQUIREMENTS.md maps exactly REGION-01..07 + PREVIEW-01 to phase 29; all 8 IDs are claimed across plans 29-01..29-04.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 825-833 | Identity-mismatched Set passed across handoff (attachmentNames into a regionName-keyed sink) | Blocker | CR-01 root cause — batch overrides corrupt the override Map on path-indirected projects |
| `src/core/analyzer.ts` | 277-358 | Bucket not deduped by attachmentName before mapping into contributingAttachments[] | Warning | WR-01 — `(used by N attachments)` UI shows inflated counts when one attachmentName binds multiple slots |
| `src/main/summary.ts` | 95-98, 115-118, 317-321 | Spread sets `isMissing: undefined` explicitly | Info | IN-01 — minor IPC payload size waste; not a correctness bug |
| `src/main/override-migration.ts` | 115-116, 130-131 | isValid validator runs twice across the two-pass loop | Info | IN-03 — minor performance only |
| `src/core/atlas-preview.ts` | 194-216 | O(N) `summary.regions.find(...)` per ExportRow (lockstep mirror duplicates the cost) | Warning | WR-04 — modal toggle responsiveness on Chicken-scale rigs |

### Human Verification Required

(None — the BLOCKER is verifiable by code inspection + the existing 29-REVIEW.md trace. The defect mechanism is mechanical and does not require user testing to confirm.)

### Gaps Summary

The phase ships its math contract correctly: `analyzeRegions` produces RegionRow[]; the override Map is regionName-keyed end-to-end on disk and in memory; `buildExportPlan` reads `overrides.get(row.regionName ?? row.attachmentName)`; the regression suite locks the single-row override path on Chicken-Min producing `outW === 4`. The atlas-preview projection collapse is correct; the Animation Breakdown panel is preserved zero-touch.

The phase MISSES on the batch-apply UI surface: when a user shift-selects multiple regions in the Global Max Render panel and double-clicks one to open the OverrideDialog, the panel hands AppShell a Set of contributor attachmentNames (left over from the pre-29-03 era when the override Map was attachmentName-keyed) — but AppShell now reads `selectedKeys.has(row.regionName)` and writes `[...selectedKeys]` into the regionName-keyed Map. The result on path-indirected fixtures is either a silent batch-degradation-to-single-row (when regionName != contributor attachmentName) or a Map poisoned with contributor-name keys that buildExportPlan does not pick up. This is the exact inverse of the bug Phase 29 closed for the single-row path. The regression spec doesn't exercise this code path (it constructs the Map directly), so the defect ships uncaught.

Resolution requires:
1. Replace `selectedAttachmentNames` memo (GlobalMaxRenderPanel.tsx:825-833) with the existing regionName-keyed `selected` Set.
2. Update the JSDoc references at lines 38-44 + 818-824 (still mention the obsolete attachmentName handoff).
3. Add a regression test that exercises the batch-apply UI path end-to-end (panel → AppShell → Map → export).

Secondary (warning, not blocker): WR-01 — dedup contributors by attachmentName in `toRegionRow` to fix the `(used by N attachments)` count display. This is a UX defect, not an export-correctness defect.

---

_Verified: 2026-05-07T20:55:52Z_
_Verifier: Claude (gsd-verifier)_
