---
phase: 35-region-keyed-export-plan
plan: 03
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - src/renderer/src/lib/atlas-preview-view.ts
  - src/core/atlas-preview.ts
autonomous: false
requirements: [DEDUP-06]
must_haves:
  truths:
    - "Atlas Preview optimized-mode tile expansion emits one AtlasPreviewInput per region (one tile per ExportRow, count matches summary.regions.length)"
    - "Loading fixtures/SKINS/JOKERMAN_SPINE.json then opening Atlas Preview in optimized mode produces approximately 160 tiles (modulo passthroughCopies split which still contributes to total page count)"
    - "Original-mode atlas preview behavior is unchanged (already region-keyed since Phase 29 D-03)"
    - "Optimize Assets modal header reads `Optimize Assets — 160 images` when loading fixtures/SKINS/JOKERMAN_SPINE.json (success criterion #1 from ROADMAP)"
    - "Modal body lists each skin-namespaced region as a distinct row (AVATAR/CARDS_L_HAND_1, BUSINESS/CARDS_L_HAND_1, IRONMAN/CARDS_L_HAND_1, JOKER/CARDS_L_HAND_1 all visible)"
  artifacts:
    - path: "src/renderer/src/lib/atlas-preview-view.ts"
      provides: "Optimized-mode tile expansion using post-Phase-35 ExportRow set"
    - path: "src/core/atlas-preview.ts"
      provides: "Byte-identical parity copy of atlas-preview-view.ts deriveInputs"
  key_links:
    - from: "src/renderer/src/lib/atlas-preview-view.ts:deriveInputs (optimized branch)"
      to: "src/renderer/src/lib/export-view.ts:buildExportPlan"
      via: "buildExportPlan(summary, overrides, { safetyBufferPercent })"
      pattern: "buildExportPlan\\(summary"
---

<objective>
Audit and (if needed) update the Atlas Preview optimized-mode tile-expansion consumer + the OptimizeDialog header to confirm both surfaces emit the post-Phase-35 one-tile-per-region cardinality automatically. Cross-AI predicts a no-op for both surfaces (the existing code already emits one input per ExportRow, and the header text reads `plan.rows.length + plan.passthroughCopies.length`) — this plan converts that prediction into a checked invariant, with an explicit no-op verification step or a surgical fix if the prediction is wrong.

Purpose: Success criteria #1, #2, #3 from the ROADMAP are about user-visible surfaces (modal header text, modal body row list, Atlas Preview tile count). They are NOT in the buildExportPlan function — they are downstream consumers. This plan locks the wiring is correct after plan 01 + plan 02 land.

Output: Either a no-op audit summary documenting that both surfaces are already region-keyed correctly downstream of buildExportPlan, OR a surgical edit to atlas-preview-view.ts / OptimizeDialog.tsx if the audit finds a defect.
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

# Post-plan-01+02 source — confirm the migration is committed before auditing consumers.
@src/core/export.ts
@src/renderer/src/lib/export-view.ts

# Two-locus consumer audit
@src/renderer/src/lib/atlas-preview-view.ts
@src/core/atlas-preview.ts

# Modal header consumer
@src/renderer/src/modals/OptimizeDialog.tsx

# RegionRow shape (regionName join via sourcePath)
@src/shared/types.ts

<interfaces>
<!-- Consumer wiring — extracted from current codebase pre-Phase-35. -->

src/renderer/src/lib/atlas-preview-view.ts:177-222 (the `optimized` branch of `deriveInputs`):
```typescript
if (mode === 'optimized') {
  const plan = buildExportPlan(summary, overrides, { safetyBufferPercent });
  const out: AtlasPreviewInput[] = [];
  for (const row of [...plan.rows, ...plan.passthroughCopies]) {
    const filteredNames = row.attachmentNames.filter((n) => !excluded.has(n));
    if (filteredNames.length === 0) continue;
    // Lookup regionName from summary.regions via sourcePath join.
    const regionRow = summary.regions.find((r) => r.sourcePath === row.sourcePath);
    if (!regionRow) continue;
    out.push({
      regionName: regionRow.regionName,
      attachmentNames: filteredNames,
      sourceW: regionRow.sourceW,
      sourceH: regionRow.sourceH,
      outW: row.outW,
      outH: row.outH,
      packW: row.outW,
      packH: row.outH,
      sourcePath: row.sourcePath,
      ...(row.atlasSource ? { atlasSource: row.atlasSource } : {}),
    });
  }
  return out;
}
```

**Observation:** The `for (const row of [...plan.rows, ...plan.passthroughCopies])` loop emits one AtlasPreviewInput per ExportRow. Post-Phase-35, plan.rows + plan.passthroughCopies contains 160 entries (one per region) for fixtures/SKINS/JOKERMAN_SPINE.json. The `summary.regions.find((r) => r.sourcePath === row.sourcePath)` join is the regionName-resolution step — it's already wired correctly (Phase 29 D-03 / PREVIEW-01).

**Question to verify in this plan:** If two regions resolve to the same sourcePath (unusual but possible), `summary.regions.find(...)` returns only the FIRST match — the second region would silently drop its regionName attribution. For the SKINS fixture (160 unique sourcePaths in atlas-source mode where each skin has its own per-region PNG on disk), this is a non-issue. But the SKINS fixture also has a 12-page atlas-page set; if any two regions share a sourcePath via the loader's atlas-extract fallback path, that's a defect surface. **Audit this as part of Task 1.**

src/renderer/src/modals/OptimizeDialog.tsx:386-393 (the header text computation):
```typescript
const headerTitle =
  state === 'complete'
    ? `Export complete — ${summary?.successes ?? 0} of ${total} succeeded`
    : state === 'in-progress'
      ? `Optimize Assets — ${progress.current} of ${total} → ${props.outDir}`
      : props.outDir !== null
        ? `Optimize Assets — ${total} images → ${props.outDir}`
        : `Optimize Assets — ${total} images`;
```
where `total = props.plan.rows.length + props.plan.passthroughCopies.length`.

**Observation:** The modal header reads directly from `plan.rows.length + plan.passthroughCopies.length`. Post-Phase-35, this equals 160 for the SKINS fixture (vs 23 today). Success criterion #1 is satisfied automatically with NO code change to OptimizeDialog.tsx. **Verify this empirically in Task 2.**

**The modal body row list (success criterion #2)** — also reads `props.plan.rows` and `props.plan.passthroughCopies` directly. With 160 ExportRows post-migration, all 160 skin-namespaced region rows render. Verify this empirically alongside Task 2.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Static audit of atlas-preview-view.ts + atlas-preview.ts optimized-mode tile expansion</name>
  <files>src/renderer/src/lib/atlas-preview-view.ts, src/core/atlas-preview.ts</files>
  <read_first>
    - src/renderer/src/lib/atlas-preview-view.ts (read in full — the `deriveInputs` function in particular, lines 170-251)
    - src/core/atlas-preview.ts (read in full — the byte-identical parity copy; confirm both files share the same optimized-branch logic)
    - src/core/export.ts (post-plan-01 state — the buildExportPlan that now produces 160 ExportRows for the SKINS fixture)
    - src/renderer/src/lib/export-view.ts (post-plan-02 state)
    - src/shared/types.ts (AtlasPreviewInput shape, RegionRow.sourcePath field)
    - tests/core/atlas-preview.spec.ts lines 476-490 (the existing per-region collapse test for Phase 29 D-03 — confirms the optimized branch already emits one input per ExportRow)
  </read_first>
  <action>
**Static audit. The audit is the deliverable. If the audit finds the consumer is correct, document the no-op and proceed to Task 2 (manual UAT). If the audit finds a defect, surgically fix it in BOTH parity files in lockstep.**

Audit checklist — perform each item, document the finding inline in the SUMMARY:

1. **Confirm the optimized-branch loop iterates ExportRows, not summary.peaks or any attachment-name-keyed list:**
   - Read `src/renderer/src/lib/atlas-preview-view.ts:deriveInputs` (mode === 'optimized' branch).
   - Verify: `for (const row of [...plan.rows, ...plan.passthroughCopies])` — one input per ExportRow.
   - Expected outcome: PASS (already region-keyed via plan.rows post-Phase-35).
   - Mirror-check: `src/core/atlas-preview.ts` MUST contain the byte-identical loop body. Compare with:
     ```
     diff <(sed -n '/function deriveInputs/,/^}$/p' src/core/atlas-preview.ts) <(sed -n '/function deriveInputs/,/^}$/p' src/renderer/src/lib/atlas-preview-view.ts)
     ```
     If divergence is found in the optimized branch, document it and propose a fix. (The atlas-preview parity test at tests/core/atlas-preview.spec.ts:381+ should already catch divergence.)

2. **Confirm the regionName-resolution join is sound:**
   - The optimized branch calls `summary.regions.find((r) => r.sourcePath === row.sourcePath)` to recover regionName from ExportRow.sourcePath.
   - Audit: walk the SKINS fixture mentally — does any pair of RegionRows in summary.regions share a sourcePath? If YES, the `.find()` returns the first match deterministically (analyzeRegions sorts by regionName ASC for IPC determinism per Phase 29 D-01), and the second region is silently aliased to the first.
   - For the SKINS atlas-source fixture (each per-region PNG lives at a distinct skin-namespaced disk path like `images/AVATAR/CARDS_L_HAND_1.png` vs `images/BUSINESS/CARDS_L_HAND_1.png`), sourcePaths are unique across regions. The audit should confirm this.
   - **If the audit finds shared sourcePaths in summary.regions** (e.g. atlas-extract fallback path where multiple regions back to the same atlas-page PNG via different bounds): the current code joins on sourcePath alone and would lose attribution. Surgical fix: change the join to key on regionName directly. **The ExportRow already carries regionName implicitly via its attachmentNames[] contributor list, but the `summary.regions.find` join wants a per-row regionName field.** If this defect is real, propose adding `regionName: string` to ExportRow (via the buildExportPlan emit loop, sourced from `region.regionName`) and updating the atlas-preview join to use `row.regionName` directly. **This is a contingency edit — only execute if the audit confirms shared-sourcePath regions exist in the SKINS fixture summary.**

3. **Confirm no other consumer of buildExportPlan exists** that iterates outputs in an attachment-name-keyed way:
   - `grep -rn "buildExportPlan\|buildExportPlanCore" src/ --include="*.ts" --include="*.tsx" | grep -v "\.spec\."`
   - Expected callers:
     - `src/renderer/src/components/AppShell.tsx` (toolbar Optimize button) — passes plan to OptimizeDialog as-is (no per-row iteration).
     - `src/renderer/src/lib/atlas-preview-view.ts:deriveInputs` (audited above).
     - `src/core/atlas-preview.ts:deriveInputs` (parity copy, audited above).
     - `src/renderer/src/modals/OptimizeDialog.tsx` may consume `plan.rows` to render the body list; verify it iterates `plan.rows` and `plan.passthroughCopies` (not `summary.peaks`).
   - If any caller reads `summary.peaks` after receiving the plan, flag as a defect and fix surgically. **Expected: none.**

4. **Confirm the existing atlas-preview tests do not regress:**
   - `npm test -- atlas-preview.spec.ts` exits 0.
   - The per-region collapse test at tests/core/atlas-preview.spec.ts:476+ expects `summary.regions.length === summary.peaks.length` on SIMPLE_PROJECT (single-skin) and equality of input count to region count in optimized mode. Post-Phase-35 this still holds because SIMPLE_PROJECT regions are 1:1 with peaks.

**If audit finds NO defect (expected outcome):**
- Document the audit findings in the plan's SUMMARY (35-03-SUMMARY.md) with each checklist item marked PASS.
- Note specifically: "No code change to src/renderer/src/lib/atlas-preview-view.ts or src/core/atlas-preview.ts required. Post-plan-01+02, the optimized-mode tile expansion automatically emits one AtlasPreviewInput per region because the upstream buildExportPlan now produces one ExportRow per region, and the existing `for (const row of [...plan.rows, ...plan.passthroughCopies])` loop is invariant to the cardinality."

**If audit finds a defect (contingency):**
- Make the surgical fix in BOTH `src/core/atlas-preview.ts` AND `src/renderer/src/lib/atlas-preview-view.ts` byte-identically (lockstep parity invariant per Phase 7 D-124..D-132 + the parity describe block at tests/core/atlas-preview.spec.ts:381+).
- If the fix requires adding `regionName: string` to ExportRow, update `src/shared/types.ts` ExportRow interface AND the buildExportPlan emit loop in BOTH src/core/export.ts AND src/renderer/src/lib/export-view.ts to populate it. This expands the diff but stays inside the locked parity contract.
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      diff <(sed -n '/function deriveInputs/,/^}$/p' src/core/atlas-preview.ts) <(sed -n '/function deriveInputs/,/^}$/p' src/renderer/src/lib/atlas-preview-view.ts) | grep -vE '^---|^[0-9]|^[<>] *$|^[<>] *//|verbatim|hygiene' &&
      npm test -- atlas-preview.spec.ts 2>&1 | tail -20
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "for (const row of \[\.\.\.plan\.rows, \.\.\.plan\.passthroughCopies\])" src/renderer/src/lib/atlas-preview-view.ts` returns at least 1 (optimized branch loop iterates ExportRows)
    - `grep -c "for (const row of \[\.\.\.plan\.rows, \.\.\.plan\.passthroughCopies\])" src/core/atlas-preview.ts` returns at least 1 (parity copy iterates the same way)
    - `grep -rn "summary\.peaks" src/renderer/src/lib/atlas-preview-view.ts src/core/atlas-preview.ts` returns 0 matches inside the `optimized` branch — the optimized branch must NOT read summary.peaks
    - `npm test -- atlas-preview.spec.ts` exits 0 (all existing atlas-preview tests pass, including the per-region collapse test for Phase 29 D-03 + the parity describe block at tests/core/atlas-preview.spec.ts:381+)
    - SUMMARY.md documents either (a) a no-op audit with each checklist item PASS, or (b) a surgical fix with files-changed + rationale
  </acceptance_criteria>
  <done>
    Atlas Preview optimized-mode tile expansion verified to emit one AtlasPreviewInput per region post-Phase-35 (or surgically fixed if not). Lockstep parity between src/core/atlas-preview.ts and src/renderer/src/lib/atlas-preview-view.ts preserved. atlas-preview.spec.ts passes.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual UAT — load fixtures/SKINS/JOKERMAN_SPINE.json and visually confirm success criteria 1, 2, 3</name>
  <files>(no files modified — human-verify checkpoint validates user-visible behavior of code shipped in plans 01, 02, and Task 1 of this plan)</files>
  <read_first>
    - .planning/ROADMAP.md (Phase 35 section, success criteria 1, 2, 3 verbatim)
    - .planning/debug/skins-optimize-undercount.md (Symptoms section — what the bug looked like; the UAT is checking these symptoms are GONE)
    - fixtures/SKINS/JOKERMAN_SPINE.json (confirm fixture is present at expected path)
  </read_first>
  <action>
The human runs the app and performs the verification steps documented in `<how-to-verify>` below. No code is written by the executor in this task — it is a checkpoint that gates phase completion on user-visible behavior matching the ROADMAP success criteria.

Plans 01 + 02 + Task 1 of Plan 03 are landed before this checkpoint:
- buildExportPlan in both src/core/export.ts AND src/renderer/src/lib/export-view.ts iterates summary.regions
- The atlas-preview optimized-mode tile expansion automatically inherits the per-region cardinality (verified statically in Task 1 above)
- The OptimizeDialog header reads `plan.rows.length + plan.passthroughCopies.length` directly — no code change needed there

The executor MUST pause and present the manual-UAT instructions to the user. The user runs them and types either `approved` or `fail: {description}` as the resume signal.
  </action>
  <how-to-verify>
    1. Run `npm run dev` from the project root. Electron launches.
    2. File > Open (or drag-drop) → select `fixtures/SKINS/JOKERMAN_SPINE.json`. The project loads.
    3. Verify the toolbar shows `1 skeletons | 1 atlases | 160 regions` (this is pre-existing Phase 29 behavior, unchanged by Phase 35).
    4. Verify the Global Max Render Scale table footer shows `0 selected / 160 total`. (Pre-existing Phase 29 behavior — confirms summary.regions.length === 160.)
    5. **SUCCESS CRITERION #1:** Click the **Optimize Assets** toolbar button. The OptimizeDialog opens. The header text reads **`Optimize Assets — 160 images`** (or `Optimize Assets — 160 images → {outDir}` if outDir was set in a prior session). Confirm it is NOT `Optimize Assets — 23 images` (the pre-Phase-35 bug count).
    6. **SUCCESS CRITERION #2:** Scroll the modal body. Confirm the row list contains all four `CARDS_L_HAND_1` variants as distinct rows:
       - `AVATAR/CARDS_L_HAND_1` (or `images/AVATAR/CARDS_L_HAND_1.png` depending on row label format)
       - `BUSINESS/CARDS_L_HAND_1`
       - `IRONMAN/CARDS_L_HAND_1`
       - `JOKER/CARDS_L_HAND_1`
       All four appear as separate entries — NOT collapsed to one row.
    7. Close the Optimize dialog. Click the **Atlas Preview** toolbar button. The Atlas Preview modal opens (default mode is likely 'original' — leave it briefly or skip this step).
    8. Toggle Atlas Preview to **optimized mode**. The view recomputes.
    9. **SUCCESS CRITERION #3:** Visually verify the optimized-mode tile grid shows the full per-region tile set (not a small subset of ~23 tiles). Exact tile count is not user-visible, but the visual density should match the 'original' mode tile density modulo per-region downscale (tiles in optimized mode are smaller because they're scaled to peakScale, but the COUNT of tiles is the same as 'original' mode).
    10. Toggle back to 'original' mode and back to 'optimized' mode once more. Confirm both renders are stable and deterministic (no flicker, no missing tiles, no console errors).
    11. **REGRESSION CHECK:** Close the SKINS project. Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (or the project's standard golden-test fixture). Verify the Optimize dialog header reads the SAME count it read pre-Phase-35 (`Optimize Assets — 3 images` or whatever the SIMPLE_PROJECT row count has been historically). Confirm no behavior change on single-skin fixtures.
    12. **ATLAS-LESS REGRESSION CHECK:** Load an atlas-less fixture (`fixtures/SIMPLE_PROJECT/skeleton.json` or any atlas-less project the user has tested previously). Verify the Optimize dialog header is unchanged from pre-Phase-35 behavior. (The fix is mode-agnostic per strict loaderMode separation — atlas-less paths use the same analyzeRegions and should be unaffected.)
  </how-to-verify>
  <verify>
    <automated>echo "MANUAL: human-verify checkpoint — no automated command. User runs `npm run dev` and performs the 12 verification steps in <how-to-verify>. Resume signal blocks until user types 'approved' or 'fail: ...'."</automated>
  </verify>
  <acceptance_criteria>
    - Step 5: Optimize Assets modal header reads exactly `Optimize Assets — 160 images` (or the with-outDir variant) — locks ROADMAP success criterion #1
    - Step 6: All four skin-namespaced CARDS_L_HAND_1 variants appear in the modal body as distinct rows — locks ROADMAP success criterion #2
    - Step 9: Atlas Preview optimized mode shows the full per-region tile grid (visual density matches 'original' mode tile count) — locks ROADMAP success criterion #3
    - Step 11: SIMPLE_PROJECT regression check passes (header text unchanged from pre-Phase-35 baseline) — locks ROADMAP success criterion #5 at the UAT level
    - Step 12: Atlas-less regression check passes (header text unchanged from pre-Phase-35 baseline) — locks the strict loaderMode separation invariant
    - User types `approved` as the resume signal (NOT `fail: {description}` — a fail resume routes into `/gsd-plan-phase 35 --gaps`)
  </acceptance_criteria>
  <resume-signal>
    Type "approved" if all three success criteria pass AND regression checks (SIMPLE_PROJECT + atlas-less) show no behavior change.

    Type "fail: {description}" with screenshots if any criterion fails — provide the exact header text observed, the row list contents (or screenshot), and the loaded fixture name. Failures will route into a gap-closure plan via `/gsd-plan-phase 35 --gaps`.
  </resume-signal>
  <done>
    User types `approved` after completing all 12 manual UAT steps. ROADMAP success criteria 1, 2, 3 are visually verified on the SKINS fixture; regression criteria 5 verified on SIMPLE_PROJECT and atlas-less fixtures.
  </done>
</task>

</tasks>

<verification>
- Atlas Preview optimized-mode tile expansion verified (static audit + manual UAT)
- OptimizeDialog header text verified (manual UAT; no code change needed — the header is plan-driven, the plan is now region-keyed)
- Regression on SIMPLE_PROJECT and atlas-less fixtures verified manually (no behavior change)
</verification>

<success_criteria>
- Success criterion #1 (modal header 160) passes manual UAT
- Success criterion #2 (per-skin rows visible) passes manual UAT
- Success criterion #3 (one preview tile per region) passes manual UAT
- atlas-preview.spec.ts passes (parity invariant preserved)
- SIMPLE_PROJECT + atlas-less fixtures show no regression in modal/preview counts
</success_criteria>

<output>
After completion, create `.planning/phases/35-region-keyed-export-plan/35-03-SUMMARY.md` documenting the audit findings (no-op or surgical fix) + manual UAT outcome.
</output>
