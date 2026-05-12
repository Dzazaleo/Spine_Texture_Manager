---
phase: 35-region-keyed-export-plan
verified: 2026-05-12T13:42:43Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 35: Region-keyed Export Plan Verification Report

**Phase Goal:** Migrate `buildExportPlan` to iterate `summary.regions` (RegionRow[], one row per atlas region) instead of `summary.peaks` (DisplayRow[], attachment-name-deduped). On `fixtures/SKINS/JOKERMAN_SPINE.json` (7 skins, 160 regions), Optimize Assets modal reads `Optimize Assets — 160 images` and Atlas Preview optimized mode emits one preview tile per region.
**Verified:** 2026-05-12T13:42:43Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP success criteria + plan must_haves)

| #   | Truth                                                                                                                          | Status     | Evidence                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `buildExportPlan` in `src/core/export.ts` iterates `summary.regions` (verifiable by grep)                                      | ✓ VERIFIED | `src/core/export.ts:190` `for (const region of summary.regions) {` ; no `for (... of summary.peaks)` remains                                                                                                                                                                                                                      |
| 2   | `buildExportPlan` in `src/renderer/src/lib/export-view.ts` mirrors the change byte-identically                                 | ✓ VERIFIED | `src/renderer/src/lib/export-view.ts:285` `for (const region of summary.regions) {` ; structural diff of the two `buildExportPlan` bodies shows only comment-layer + blank-line deltas (filtered diff returns zero lines)                                                                                                         |
| 3   | Override resolution per region keyed by `regionName` (Phase 29 D-04 preserved)                                                 | ✓ VERIFIED | Both files line `212` (core) / `301` (renderer): `const overrideKey = region.regionName ?? region.attachmentName;` — identical shape; Test 2 of Phase 35 describe block locks behavior with `effScale === 0.25` on overridden region vs `0.5` on sibling                                                                          |
| 4   | Loading `fixtures/SKINS/JOKERMAN_SPINE.json` → buildExportPlan returns 160 ExportRows (success criterion #1)                   | ✓ VERIFIED | Test 4 in `tests/core/export.spec.ts:2807-2867` loads the real fixture end-to-end, asserts `summary.regions.length === 160` AND `plan.rows.length + plan.passthroughCopies.length === 160`. Test passes locally in 2.6s.                                                                                                          |
| 5   | Modal body lists each skin-namespaced region as a distinct row (success criterion #2)                                          | ✓ VERIFIED | `OptimizeDialog.tsx:360-361`: `const total = props.plan.passthroughCopies.length + props.plan.rows.length;` — body rows derive from same `plan.rows`/`passthroughCopies` (line 386-393 header); plan-03 audit + UAT user-approved per 35-03-SUMMARY. Test 4 spot-check: `cardsLHand1Paths.length >= 4` passes.                    |
| 6   | Atlas Preview optimized-mode tile expansion emits one `AtlasPreviewInput` per region (success criterion #3)                    | ✓ VERIFIED | `atlas-preview-view.ts:199` + `atlas-preview.ts:208`: `for (const row of [...plan.rows, ...plan.passthroughCopies])` — one input per ExportRow, no source edit needed post-Phase-35; atlas-preview parity diff clean (audit per 35-03)                                                                                            |
| 7   | Existing fixtures (SIMPLE_PROJECT, Rotated, atlas-less) continue to produce identical export plans (success criterion #5)      | ✓ VERIFIED | Test 3 (single-skin synth) + Test 5 (atlas-less MeshOnly_TEST.json) pass; full `npm test` shows 1061 passed / 0 failed across 95 files — Rotated + SIMPLE_PROJECT-driven tests in `export-rotation-dims.spec.ts` + `loader-dims-mismatch.spec.ts` + `loader-atlas-less.spec.ts` all green                                          |
| 8   | A regression test exercises the multi-skin path: N regions sharing K<N attachments → N rows (not K) (success criterion #8)     | ✓ VERIFIED | Test 1 in Phase 35 describe block: 4 regions sharing 2 unique attachment names → `expect(totalRows).toBe(4)` (NOT 2). Also Test 4 with real SKINS fixture (160 regions sharing 23 attachment names → 160 rows). Both pass locally.                                                                                                |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact                                          | Expected                                              | Status     | Details                                                                                                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/export.ts`                              | buildExportPlan iterating summary.regions             | ✓ VERIFIED | 190: `for (const region of summary.regions)`; 212: overrideKey preserved; 294: `region.contributingAttachments.map(...)`; 309: merge-branch contributor union; Layer 3 hygiene: no node:fs/sharp/electron/spine-core imports     |
| `src/renderer/src/lib/export-view.ts`             | Renderer-side mirror iterating summary.regions        | ✓ VERIFIED | 285: `for (const region of summary.regions)`; 301: overrideKey preserved; 384: insert-branch; 399: merge-branch; imports `applyOverride` from `./overrides-view.js` (sibling); zero `from '...core/...'` imports — Layer 3 clean |
| `src/core/atlas-preview.ts`                       | Region-keyed tile expansion (no source change needed) | ✓ VERIFIED | 208: `for (const row of [...plan.rows, ...plan.passthroughCopies])` — automatically inherits per-region cardinality                                                                                                              |
| `src/renderer/src/lib/atlas-preview-view.ts`      | Region-keyed tile expansion (no source change needed) | ✓ VERIFIED | 199: same pattern as core; 207: sourcePath→regionName join via `summary.regions.find(...)` — sound for SKINS (sourcePath uniqueness empirically confirmed per 35-03 audit)                                                       |
| `src/renderer/src/modals/OptimizeDialog.tsx`      | Header reads plan.rows.length + plan.passthroughCopies | ✓ VERIFIED | 360-361: `total = props.plan.passthroughCopies.length + props.plan.rows.length`; 386-393 header text uses `${total} images`                                                                                                      |
| `tests/core/export.spec.ts`                       | Phase 35 describe block with 5 regression tests       | ✓ VERIFIED | 2478: `describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration (DEDUP-04/05)', ...)` — 5 it() cases (Tests 1-5); parity regex at line 838 updated to `region.peakScale`; all pass                                  |

### Key Link Verification

| From                                                | To                              | Via                                                            | Status   | Details                                                                                                                       |
| --------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/core/export.ts:buildExportPlan`                | `summary.regions (RegionRow[])` | for-of loop                                                    | ✓ WIRED  | 1 hit grep: `for (const region of summary.regions)` at line 190                                                               |
| `src/renderer/src/lib/export-view.ts:buildExportPlan` | `summary.regions (RegionRow[])` | for-of loop                                                    | ✓ WIRED  | 1 hit grep at line 285                                                                                                        |
| `src/core/export.ts:buildExportPlan`                | overrides Map                   | `overrides.get(overrideKey)` where `overrideKey = region.regionName ?? region.attachmentName` | ✓ WIRED  | Override semantics preserved verbatim per Phase 29 D-04                                                                       |
| `tests/core/export.spec.ts:overrideSig`             | both buildExportPlan copies     | regex literal `region.peakScale` matches both files post-migration | ✓ WIRED | Line 838 — parity describe block passes in `npm test`                                                                         |
| `atlas-preview-view.ts:deriveInputs` (optimized)    | `export-view.ts:buildExportPlan` | `buildExportPlan(summary, overrides, { safetyBufferPercent })` | ✓ WIRED  | Line 197; loop at line 199 iterates ExportRows                                                                                |
| Renderer `export-view.ts`                           | Layer 3 invariant               | No `from '...core/...'` imports                                | ✓ WIRED  | `grep -E "from ['\"][^'\"]*\/core\/"` returns 0 matches; arch.spec.ts (12 tests) passes                                       |

### Data-Flow Trace (Level 4)

| Artifact                                            | Data Variable             | Source                                          | Produces Real Data | Status      |
| --------------------------------------------------- | ------------------------- | ----------------------------------------------- | ------------------ | ----------- |
| `OptimizeDialog.tsx` header `${total} images`       | `total` (number)          | `props.plan.passthroughCopies.length + props.plan.rows.length`; `plan` from `buildExportPlan(summary, overrides, ...)` in AppShell; summary.regions populated by `analyzeRegions` in main process                              | Yes — 160 for SKINS fixture (verified by Test 4 + UAT) | ✓ FLOWING   |
| `atlas-preview-view.ts:deriveInputs` output         | `out: AtlasPreviewInput[]` | `for (const row of [...plan.rows, ...plan.passthroughCopies])` — plan via `buildExportPlan(summary, overrides, ...)`                                                                                                            | Yes — one entry per region (verified by 35-03 audit + UAT)        | ✓ FLOWING   |
| ExportRow.attachmentNames                            | `string[]`                | `region.contributingAttachments.map((c) => c.attachmentName)` (insert) + merge-branch contributor union                                                                                                                         | Yes — Test 1/2/3 lock per-row attachmentNames composition          | ✓ FLOWING   |

### Behavioral Spot-Checks

| Behavior                                                                                  | Command                                                              | Result                                                                                | Status   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| Phase 35 describe block: 5 tests pass                                                     | `npx vitest run tests/core/export.spec.ts`                           | `Test Files 1 passed; Tests 77 passed` (incl. all 5 Phase 35 tests, Test 4 = 2.6s real fixture load) | ✓ PASS   |
| Atlas-preview parity tests pass post-Phase-35                                             | `npx vitest run tests/core/atlas-preview.spec.ts`                    | `Test Files 1 passed; Tests 25 passed, 1 todo`                                        | ✓ PASS   |
| Layer 3 arch invariants preserved                                                          | `npx vitest run tests/arch.spec.ts`                                  | `Test Files 1 passed; Tests 12 passed`                                                | ✓ PASS   |
| Full suite green                                                                          | `npx vitest run`                                                     | `Test Files 95 passed; Tests 1061 passed, 2 skipped, 2 todo`                          | ✓ PASS   |
| Structural parity diff between core+renderer buildExportPlan bodies                       | `diff ... | grep -vE 'Mirrors...|blank|comment'`                     | Zero non-comment lines (29 diff lines all whitespace/comments)                        | ✓ PASS   |
| SKINS + atlas-less integration fixtures present                                            | `ls fixtures/SKINS/JOKERMAN_SPINE.json fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json` | Both files exist                       | ✓ PASS   |

### Requirements Coverage

| Requirement | Source Plan(s)    | Description                                                                                                                                                                                              | Status      | Evidence                                                                                                                                                  |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEDUP-04    | 35-01, 35-04      | `buildExportPlan` iterates `summary.regions`; Phase 29 D-04 override-by-regionName preserved; attachmentNames sourced from `region.contributingAttachments[]`                                            | ✓ SATISFIED | `src/core/export.ts:190` iteration; `:212` overrideKey; `:294/309` contributor accumulator; Tests 1-3 lock synthetic cases; Test 4 locks SKINS integration |
| DEDUP-05    | 35-02, 35-04      | Renderer `export-view.ts` mirrors byte-identically; Layer 3 invariant (no `src/core/*` import); parity describe block passes                                                                             | ✓ SATISFIED | `src/renderer/src/lib/export-view.ts:285`; structural diff clean; parity regex updated to `region.peakScale`; `applyOverride` from `./overrides-view.js` |
| DEDUP-06    | 35-03 (audit+UAT) | Atlas Preview optimized-mode emits one tile per region; Optimize modal header reads N === `summary.regions.length`; `src/core/atlas-preview.ts` ↔ `src/renderer/src/lib/atlas-preview-view.ts` parity     | ✓ SATISFIED | atlas-preview parity preserved (no edits needed); UAT user-approved per 35-03-SUMMARY (Optimize header = "160 images"; AVATAR/BUSINESS/IRONMAN/JOKER rows distinct; optimized tile grid full per-region) |

**Note (administrative):** `.planning/REQUIREMENTS.md` § Region-Keyed Export Plan still labels DEDUP-04/05/06 as "Pending" in the table (last line: `*Last updated: 2026-05-12 — Phase 35 planning: DEDUP-04/05/06 added*`). This is documentation lag, not a goal-achievement failure — the implementation is fully verified. ROADMAP.md shows Phase 35 as "Complete" (4/4 plans). Suggest a follow-up doc update to mark these requirements "Complete" in REQUIREMENTS.md.

### Anti-Patterns Found

| File                                  | Line       | Pattern                                                                                                                                                                          | Severity      | Impact                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/export.ts`                  | 289-295    | Initial-insert path does NOT dedup `attachmentNames` within one region's `contributingAttachments` — asymmetric with merge branch which DOES dedup                                | ℹ️ Info       | Documented in 35-REVIEW.md as WR-01. Latent only — current `toRegionRow` in analyzer.ts already dedupes contributors, so no live test failure. Tripwire if future analyzer change loosens that invariant. Not blocking Phase 35.                                                                                                                                                       |
| `src/core/export.ts`                  | 191        | `excluded.has(region.attachmentName)` keys by winning attachmentName, not regionName — narrow translation kept per plan 35-01 step 3                                              | ℹ️ Info       | Documented as a known design decision in plan 35-01 step 3 ("DO NOT widen to check `region.contributingAttachments[].attachmentName`"). `excluded` is empty today (Phase 24 removed unusedAttachments). Phase 24 Plan 02 is the future exclusion-surface wiring — out of scope for Phase 35.                                                                                            |
| `tests/core/loader-atlas-less.spec.ts` | 333-381    | Working-tree-only WIP describe block referencing `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json` WITHOUT an `existsSync` skip guard                       | ℹ️ Info       | **NOT in HEAD.** `git show HEAD:tests/core/loader-atlas-less.spec.ts | grep non-essential-disabled` returns empty. The block exists only in the working tree as `M tests/core/loader-atlas-less.spec.ts`. 35-REVIEW.md CR-01 was authored when this WIP was staged; it is pre-existing user WIP, not part of any Phase 35 commit (`e6426f2 35-01` only added 9 lines: the INV-9 backfill).   |

All anti-patterns found are non-blocking. CR-01 from `35-REVIEW.md` is confirmed pre-existing user WIP that is not part of the Phase 35 commit set — it does not affect Phase 35 goal achievement.

### Human Verification Required

None outstanding. **Plan 35-03 Task 2 was a human-verify checkpoint that the user already approved** (per 35-03-SUMMARY: "UAT approved against the SKINS fixture. Modal header reads 160 images, modal body lists distinct skin-namespaced rows (e.g. AVATAR/BUSINESS/IRONMAN/JOKER `CARDS_L_HAND_1`), optimized-mode tile grid shows full per-region tile set. SIMPLE_PROJECT + atlas-less regression checks show no behavior change.").

All ROADMAP success criteria #1, #2, #3 (the user-visible ones requiring human eyes) are confirmed by that approval. Success criteria #4-#8 are statically verifiable and pass above.

### Gaps Summary

**No gaps.** All 8 ROADMAP success criteria are verified, all 3 phase requirements (DEDUP-04, DEDUP-05, DEDUP-06) are satisfied with implementation evidence, all 4 plans landed with self-checks passing, full test suite is green (1061 passed / 0 failed), parity contract is preserved, Layer 3 hygiene holds, and the user-visible UAT was already approved.

The migration is **observationally equivalent** on single-skin/non-indirected inputs (Test 3 + Rotated + atlas-less coverage confirms regression #5 from ROADMAP) and **structurally corrective** on multi-skin atlas-source inputs (Test 1 + Test 4: 4-region/2-attachment synth and 160-region SKINS fixture both produce N=regionCount rows, not K=attachmentCount).

### Out-of-Scope Note: 35-REVIEW.md Findings

The `35-REVIEW.md` code review surfaces 1 CRITICAL + 6 WARNING + 4 INFO findings. Of these:

- **CR-01 (untracked fixture in `loader-atlas-less.spec.ts:333-381`):** CONFIRMED pre-existing user WIP that is NOT in any Phase 35 commit. `git show HEAD:tests/core/loader-atlas-less.spec.ts` does not contain the describe block; it only appears in working-tree modifications (`M tests/core/loader-atlas-less.spec.ts`). Not a Phase 35 gap. **Recommendation for the user:** either commit the fixture (preferred) or add an `existsSync` skip guard before staging, since the WIP block is unrelated to Phase 35 scope (atlas-less + Spine 4.2 non-essential mesh recovery — DIMS-01 R5).
- **WR-01..WR-06 + INFO 1..4:** All are latent code-quality observations on patterns the Phase 35 migration newly exposes but does not introduce as regressions. Documented in 35-REVIEW.md for the planner to triage as follow-up work; none block Phase 35 goal achievement.

---

_Verified: 2026-05-12T13:42:43Z_
_Verifier: Claude (gsd-verifier)_
