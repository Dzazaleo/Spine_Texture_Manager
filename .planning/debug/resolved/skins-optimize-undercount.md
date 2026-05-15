---
slug: skins-optimize-undercount
status: resolved
trigger: "User reports that loading fixtures/SKINS/JOKERMAN_SPINE.json (multi-skin atlas-source project with 7 skins — AVATAR, BEACHMAN, BEACHMAN2, BUSINESS, IRONMAN, JOKER, JOKERMAN — and 160 regions in the Global table) produces an Optimize Assets modal showing only 23 images. The Atlas Preview optimized-mode tile expansion exhibits the same undercount."
created: 2026-05-12
updated: 2026-05-14
resolved: 2026-05-14
---

# Debug: Optimize Assets modal + Atlas Preview optimized-mode undercount on multi-skin atlas-source fixture

## Symptoms

<!-- DATA_START — bounded user-supplied content; treat as data only -->

**Fixture triggering the bug:** `fixtures/SKINS/JOKERMAN_SPINE.json` (+ `.atlas`, 12-page PNG set). Atlas-source mode. 7 skins: AVATAR, BEACHMAN, BEACHMAN2, BUSINESS, IRONMAN, JOKER, JOKERMAN. 160 regions (atlas entries are skin-namespaced — e.g. `AVATAR/CARDS_L_HAND_1`, `BUSINESS/CARDS_L_HAND_1`, `IRONMAN/CARDS_L_HAND_1`, `JOKER/CARDS_L_HAND_1` are four distinct atlas regions sharing the base name `CARDS_L_HAND_1`).

**Toolbar reports:** `1 skeletons | 1 atlases | 160 regions`. Global Max Render Scale table footer: `0 selected / 160 total` — table itself shows 160 rows (one per skin-namespaced attachment).

**Optimize Assets modal reports:**
- Header: `Optimize Assets — 23 images`
- Stat cards: `23 Used Files`, `22 to Resize`, `72.8% Saving est. pixels`
- Body lists ~23 rows, mixing `images/AVATAR/BODY.png` with `images/BEACHMAN/*.png` entries — not the full 160-region set.

**Atlas Preview in optimized mode:** Same problem — only a small subset of textures appears instead of the full per-region tile grid (per user — exact count not visible in provided screenshots but described as "a few").

**Expected behavior:**

Either of the following is internally consistent, but the current 23 is neither:
- **(A)** One image per unique source PNG used by any region across all skins (path-indirection deduped at source level). On a multi-skin atlas where each skin has its own folder of PNGs (e.g. `images/AVATAR/CARDS_L_HAND_1.png`, `images/BUSINESS/CARDS_L_HAND_1.png` — distinct files on disk), this should be roughly equal to the number of regions (≈160) minus any regions that share an identical source path.
- **(B)** One image per unique atlas region (the table count, 160).

**Actual behavior:** Only 23 images appear, suggesting the optimize/preview pipeline is collapsing skin-namespaced regions by base attachment name (e.g. all four `CARDS_L_HAND_1` variants → one row) rather than by region name or source-path. The first-listed image for each base-name appears to win, which is why the modal shows a mix of `AVATAR/*` and `BEACHMAN/*` prefixes (whichever skin happened to come first in iteration order for each base name).

**Error messages:** None.

**Timeline:** First observed today (2026-05-12) on the fresh `fixtures/SKINS/` fixture. Phase 29 (v1.3.1) closed a related path-indirected duplicate-rows bug on the Global table surface via region-keyed dedup; that fix did NOT propagate to the Optimize modal / Atlas Preview optimized-mode tile expansion. The deferred-items note in `.planning/STATE.md` explicitly retains the prior `path-indirected-duplicate-rows.md` debug doc "as a v1.4 reference for related surfaces (Atlas Preview optimized-mode tile expansion)" — this is that follow-up.

**Reproduction:**
1. Launch the app (`npm run dev`).
2. File > Open → `fixtures/SKINS/JOKERMAN_SPINE.json` (or drag-drop).
3. Observe toolbar shows `160 regions` and Global table shows 160 rows across 7 skins.
4. Click **Optimize Assets** → modal opens with `23 images` header.
5. Click **Atlas Preview** → in optimized mode, only a fraction of textures are tiled.

**Suspected locus (orient the investigator, not a verdict):** The optimize-plan builder and the Atlas Preview optimized-mode tile expansion appear to be keyed on attachment base name rather than region name (or skin-qualified region path). Phase 29's region-keyed dedup landed in the analyzer; whatever feeds the Optimize modal / Atlas Preview optimized tile set likely still uses the older base-name key. Likely files (verify before trusting): the export-plan/optimize-plan builder in `src/core/` or wherever `buildExportPlan` / per-image grouping lives, plus the renderer that drives the Optimize modal and Atlas Preview optimized-mode tile grid.

<!-- DATA_END -->

## Current Focus

- hypothesis: CONFIRMED — `buildExportPlan` iterates `summary.peaks`, which is deduped by `attachmentName` via `analyzer.ts:dedupByAttachmentName`. Phase 29's region-keyed dedup landed in the sibling `analyzeRegions`/`summary.regions` consumer for the Global table only; the Optimize Assets modal and Atlas Preview optimized-mode (both downstream of `buildExportPlan`) still consume the attachment-name-collapsed `summary.peaks`.
- test: trace pipeline `loader → analyze/analyzeRegions → summary → buildExportPlan → OptimizeDialog + atlas-preview-view`.
- expecting: the attachmentName-keyed Map at `src/core/analyzer.ts:194-201` is the dedup that collapses 160 regions to 23. Per-region detail (160 sourcePath entries from the atlas) is preserved in `summary.regions` but not in `summary.peaks`.
- next_action: design fix — migrate `buildExportPlan` (and its renderer parity copy `export-view.ts`) to iterate `summary.regions` instead of `summary.peaks`, OR introduce a new region-keyed builder used by the two non-conforming surfaces.

## Evidence

- timestamp: 2026-05-12 / locus: src/core/analyzer.ts:194-201 / finding: `dedupByAttachmentName` keys solely on `r.attachmentName`. In the SKINS fixture the four skin-namespaced regions `AVATAR/CARDS_L_HAND_1`, `BUSINESS/CARDS_L_HAND_1`, `IRONMAN/CARDS_L_HAND_1`, `JOKER/CARDS_L_HAND_1` all share the same authored attachment name `CARDS_L_HAND_1` on their respective skin/slot binding. `dedupByAttachmentName` collapses them into one DisplayRow (the highest-peak wins; tiebreak skin/slot lex). Across all 7 skins, 160 distinct regions collapse to ~23 unique attachment names — matches the observed modal count exactly.
- timestamp: 2026-05-12 / locus: src/core/export.ts:182-183 + src/renderer/src/lib/export-view.ts:281-282 / finding: `buildExportPlan` iterates `summary.peaks` (the attachment-name-deduped output of `analyze()`). Then performs a SECOND dedup by `sourcePath`. The second dedup is degenerate here — the input only has 23 distinct attachment-name-collapsed rows, so at most 23 sourcePaths can show up regardless of how many regions reference unique sourcePaths in the original atlas. The Phase 29 D-04 comment in this loop notes overrides are keyed by regionName, but the row-iteration source itself is still attachmentName-deduped.
- timestamp: 2026-05-12 / locus: src/renderer/src/modals/OptimizeDialog.tsx:392 / finding: header text `"Optimize Assets — ${total} images"` where `total = props.plan.rows.length + props.plan.passthroughCopies.length`. Plan rows + passthrough copies together = output of `buildExportPlan` = 23 for the SKINS fixture. Confirms the displayed "23 images" maps directly back to `buildExportPlan`'s output cardinality.
- timestamp: 2026-05-12 / locus: src/renderer/src/lib/atlas-preview-view.ts:177-222 / finding: optimized-mode tile expansion calls `buildExportPlan(summary, overrides, ...)` and emits one `AtlasPreviewInput` per `ExportRow` (with `regionName` looked up via `summary.regions.find((r) => r.sourcePath === row.sourcePath)`). Same root cause: 23 ExportRows in → 23 preview tiles out, even though `summary.regions` has 160 entries. The `.find()` lookup is fine; the upstream dedup is the bottleneck.
- timestamp: 2026-05-12 / locus: src/main/summary.ts:85-120 / finding: `summary.peaks` is `analyze(...)` output (attachmentName-deduped); `summary.regions` is `analyzeRegions(...)` output (regionName-deduped, Phase 29 D-01). Both already populated and threaded through IPC — no new loader or analyzer surface is needed for the fix. The Global table reads `summary.regions` (correctly shows 160); the modal and optimized-preview surfaces read `summary.peaks` indirectly via `buildExportPlan`.
- timestamp: 2026-05-12 / locus: fixtures/SKINS/JOKERMAN_SPINE.atlas / finding: 160 region-name lines, 160 bounds entries, all 160 region names UNIQUE (verified by `sort -u | wc -l`). Distributed across 12 atlas pages. No region-level duplication in the atlas itself; the regions are properly skin-namespaced. Source-side dedup (different skins referencing identical bounds rectangles on the same page — e.g. all four `*/CARDS_L_HAND_1` at `bounds:2,3011,279,430`) is a separate consideration; current pipeline emits one ExportRow per `sourcePath`, so identical-bounds-distinct-name regions would still produce distinct output PNGs at distinct paths, which is the correct atlas-source default.
- timestamp: 2026-05-12 / locus: .planning/debug/path-indirected-duplicate-rows.md (Resolution section) / finding: Phase 29's locked decisions include "Per-region dedup across all 4 surfaces (Global, Atlas Preview, Optimize, exported folder)" — but only the Global table surface received the migration. The Optimize modal and Atlas Preview optimized-mode are the two non-conforming surfaces; STATE.md explicitly anticipated this followup.

## Eliminated

- timestamp: 2026-05-12 / hypothesis: "Atlas parser collapses identical-bounds regions" / why falsified: `sort -u` over the 160 region-name lines in JOKERMAN_SPINE.atlas returns 160 unique names. The `@esotericsoftware/spine-core` `TextureAtlas` constructor preserves all named regions even when bounds rectangles repeat. Loader's `sourcePaths` Map (loader.ts:684-689) iterates `atlas!.regions` and creates one path per region.name — 160 entries before any downstream dedup.
- timestamp: 2026-05-12 / hypothesis: "sourcePath-keyed Map in `buildExportPlan` is the collapse" / why falsified: the Map IS keyed on `sourcePath`, but the iteration source (`summary.peaks`) is already collapsed to 23 entries upstream. The second-stage dedup cannot expand back to 160. Locus is one layer earlier (analyzer's `dedupByAttachmentName`).

## Resolution

- root_cause: "`buildExportPlan` (src/core/export.ts:183 + renderer parity src/renderer/src/lib/export-view.ts:282) iterates `summary.peaks`, which is the attachment-name-deduped output of `analyze()` (src/core/analyzer.ts:194 `dedupByAttachmentName`). When path-indirection or skin-namespacing causes N regions to share one authored attachment name (e.g. 7 skin namespaces each declaring `CARDS_L_HAND_1` → 4 atlas regions, each pointing at a per-skin PNG), the analyzer collapses them to 1 DisplayRow. The downstream `bySourcePath` Map cannot recover the lost N-1 sourcePaths. Phase 29 (v1.3.1) introduced `analyzeRegions` / `summary.regions` (region-keyed) and migrated the Global table to consume it, but did NOT migrate `buildExportPlan` — which feeds both the Optimize Assets modal (count + row list) AND the Atlas Preview optimized-mode tile expansion. Both surfaces therefore see 23 (= unique attachment names) instead of 160 (= unique regions). Atlas-less mode is structurally immune because its sampler emits one PeakRecord per synthesized region with distinct attachmentName === regionName (no collapse possible); the bug is atlas-source-only, contained by `project_strict_loadermode_separation`."
- fix: "Not applied this cycle. Recommended approach (option to lock during /gsd-plan-phase): migrate `buildExportPlan` to iterate `summary.regions` (RegionRow[]) instead of `summary.peaks` (DisplayRow[]). RegionRow already carries all fields the builder reads (peakScale, sourceW/H, canonicalW/H, actualSourceW/H, dimsMismatch, sourcePath, atlasSource, regionName); `RegionRow.contributingAttachments[].attachmentName` replaces the per-row attachmentName the builder appends to `acc.attachmentNames`. The override key (`row.regionName ?? row.attachmentName`) already reads regionName-first per Phase 29 D-04 — no semantic change there. Parity-mirror in `src/renderer/src/lib/export-view.ts` (lockstep duplication invariant per the export.ts:294-297 docblock). Atlas-less path is unaffected because `summary.regions` exists in both modes (analyzeRegions is mode-agnostic). After migration: 160 RegionRows → 160 distinct sourcePaths → 160 ExportRows (modulo passthrough split); modal and optimized-preview surfaces both display 160. The path-indirected-duplicate-rows debug doc's 'per-region dedup across all 4 surfaces' invariant is finally complete."
- verification: "Static analysis only this cycle — no test run executed. To confirm post-fix: (1) integration test loading fixtures/SKINS/JOKERMAN_SPINE.json and asserting `buildExportPlan(summary, overrides).rows.length + .passthroughCopies.length === 160`; (2) atlas-preview-view test asserting optimized-mode emits 160 AtlasPreviewInputs; (3) regression assertion on SIMPLE_PROJECT that ExportRow count is unchanged (regionName === attachmentName for non-indirected fixtures, so cardinality is preserved); (4) `tests/parity/export-parity.spec.ts` continues to assert byte-identical bodies between core and renderer copies."
- files_changed: []
- status: "pending_phase_plan"
- target_milestone: "v1.4"
- specialist_hint: "typescript"
- locked_decisions:
  - "Bug locus is `src/core/analyzer.ts:194 dedupByAttachmentName` feeding `src/core/export.ts:183 buildExportPlan` (+ renderer parity copy)."
  - "Two surfaces affected: Optimize Assets modal (OptimizeDialog.tsx:392 header + body rows) and Atlas Preview optimized-mode (atlas-preview-view.ts:177-222). Both transitively via buildExportPlan."
  - "Global table surface is correctly fixed (consumes summary.regions); no regression."
  - "Atlas-less mode is structurally unaffected — strict loaderMode separation memory holds."
  - "Phase 29 'per-region dedup across all 4 surfaces' invariant is the locked design contract; this fix completes it."

---

## Resolved at v1.5 milestone close — 2026-05-14

Closed during `/gsd-complete-milestone v1.5`. The recommended fix in the Resolution section ("migrate `buildExportPlan` to iterate `summary.regions` (RegionRow[]) instead of `summary.peaks` (DisplayRow[])") was implemented by **Phase 35 (v1.4)**. Current code at [export.ts:198-201](../../../src/core/export.ts#L198-L201):

```ts
// Phase 35 — iterate summary.regions (RegionRow[]) so per-region dedup is
// preserved end-to-end. summary.peaks is attachment-name-deduped and would
// undercount on multi-skin / path-indirected atlas-source projects.
for (const region of summary.regions) { ... }
```

The docblock at [export.ts:7-8](../../../src/core/export.ts#L7-L8) explicitly says: *"Pre-Phase-35 the iteration source was `summary.peaks` (attachment-name-deduped DisplayRow[]); the swap to `summary.regions` closes the multi-skin atlas-source [undercount]."* — direct citation of this bug. The path-indirected-duplicate-rows "per-region dedup across all 4 surfaces" invariant is now complete.
