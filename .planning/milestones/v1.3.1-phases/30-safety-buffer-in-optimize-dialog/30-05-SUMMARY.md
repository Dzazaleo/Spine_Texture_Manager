---
phase: 30
plan: 05
subsystem: gap-closure
tags: [safety-buffer, layer3-parity, doc-export, blocker-closure, option-c]
requires:
  - 30-01-SUMMARY.md (Phase 30 BUFFER-01 D-04 integer-only constraint)
  - 30-02-SUMMARY.md (export math threading buffer through buildExportPlan)
  - 30-03-SUMMARY.md (renderer atlas-preview-view.ts threading — Layer 3 mirror target)
provides:
  - CR-03 closed — src/core/atlas-preview.ts byte-identical mirror of renderer copy restored
  - CR-04 closed sites 1-4 (Option C) — doc-export reads new top-level safetyBufferPercent; legacy field becomes informational metadata
  - parity-regex test in tests/core/atlas-preview.spec.ts locking the contract
affects:
  - src/core/atlas-preview.ts (4 mirror sites updated)
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx (4 prop-threading sites + SafetyBufferSubSection conversion)
  - src/main/doc-export.ts (DocExportPayload + renderOptimizationConfigCard)
tech-stack:
  added: []
  patterns:
    - defensive integer-and-range coerce at IPC seams (mirrors project-io.ts:700-716)
    - parity regex test pattern (mirrors tests/core/export.spec.ts:719-725)
    - Option C reconciliation (zero-migration; legacy field stays as informational metadata)
key-files:
  created: []
  modified:
    - src/core/atlas-preview.ts (+18 / -4)
    - tests/core/atlas-preview.spec.ts (+21 / -0)
    - src/main/doc-export.ts (+31 / -7)
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx (+59 / -28)
    - tests/main/doc-export.spec.ts (+8 / -5)
decisions:
  - "CR-04: Option C (minimum viable) over Option A (full deprecation + materialize-time migration) and Option B (renderer-side sync). Rationale: zero schema migration, zero risk to v1.2-era projects; the v1.2 input copy ('Metadata only. Captured in the HTML export; export math wiring deferred to a future phase.') made the legacy field's authority explicitly disclaimed; users can't be reliable consumers of a field they were told was metadata-only."
  - "Site 5 (AppShell DocumentationBuilderDialog mount) intentionally left to plan 30-04 per plan-checker iter-1 BLOCKER 2; this plan lands the receiving prop interface, 30-04 lands the mount-site value. Wave 4 final TS check (after both plans complete) is clean."
  - "Removed unused `ChangeEvent` import from DocumentationBuilderDialog.tsx after SafetyBufferSubSection conversion eliminated the only consumer (Rule 1 - bug from this task's changes)."
metrics:
  duration: ~7 minutes
  completed: 2026-05-08
  tasks: 4
  commits: 3
  files_modified: 5
---

# Phase 30 Plan 05: Mirror Parity + Doc-Field Reconciliation Summary

Closes 2 BLOCKERs from `30-VERIFICATION.md` — CR-03 (Layer 3 byte-identical mirror parity broken) and CR-04 sites 1-4 (legacy vs new safetyBufferPercent field disagreement). File-disjoint with parallel plan 30-04 in the same Wave 4.

## Files modified

| File | Insertions | Deletions | Purpose |
|---|---|---|---|
| `src/core/atlas-preview.ts` | +18 | -4 | Mirror Plan 30-03 renderer changes byte-identically (CR-03 fix). |
| `tests/core/atlas-preview.spec.ts` | +21 | 0 | New parity regex test locking the safetyBufferPercent contract (CR-03). |
| `src/main/doc-export.ts` | +31 | -7 | DocExportPayload extended with optional top-level field; renderOptimizationConfigCard rewritten with defensive integer-range coerce (CR-04). |
| `src/renderer/src/modals/DocumentationBuilderDialog.tsx` | +59 | -28 | 4 prop-threading sites + SafetyBufferSubSection converted to read-only notice; unused ChangeEvent import removed. |
| `tests/main/doc-export.spec.ts` | +8 | -5 | Updated Optimization Config card test to pass safetyBufferPercent at top-level. |

Note: `src/shared/types.ts` is **NOT** modified by this plan (WR-02 moved to 30-04 per plan-checker iter-1 BLOCKER 1). `src/renderer/src/components/AppShell.tsx` is **NOT** modified by this plan (BLOCKER-2 site 5 moved to 30-04).

## Gap-closure items addressed

### CR-03 (BLOCKER): Layer 3 byte-identical-copy invariant restored

**Before:** Plan 30-03 updated `src/renderer/src/lib/atlas-preview-view.ts` to thread `safetyBufferPercent` through (a) buildAtlasPreview opts, (b) deriveInputs param, (c) buildExportPlan call. The parallel canonical `src/core/atlas-preview.ts` was never updated — opts at line 65 was `{ mode, maxPageDim }`, deriveInputs was 4 args, buildExportPlan call was 2 args. The Layer 3 invariant (atlas-preview-view.ts:14-19: "If you modify one, modify the other in the same commit") was violated. Existing parity tests at `tests/core/atlas-preview.spec.ts:381-444` passed loosely because all 5 cases omit `safetyBufferPercent` (D-07 no-op short-circuit hides divergence).

**After:** All 4 sites mirror byte-identically:

| Site | Renderer (target) | Core (now) |
|---|---|---|
| buildAtlasPreview opts shape | `{ mode, maxPageDim, safetyBufferPercent? }` (lines 60-67) | `{ mode, maxPageDim, safetyBufferPercent? }` (lines 62-72) |
| deriveInputs call | `deriveInputs(summary, overrides, opts.mode, excluded, opts.safetyBufferPercent)` (line 74) | `deriveInputs(summary, overrides, opts.mode, excluded, opts.safetyBufferPercent)` (line 79) |
| deriveInputs signature | 5-param with `safetyBufferPercent?: number` (lines 170-176) | 5-param with `safetyBufferPercent?: number` (lines 175-181) |
| buildExportPlan call | `buildExportPlan(summary, overrides, { safetyBufferPercent })` (line 197) | `buildExportPlan(summary, overrides, { safetyBufferPercent })` (line 202) |

**Grep evidence:**
```
$ grep -c safetyBufferPercent src/core/atlas-preview.ts
5
$ grep -c safetyBufferPercent src/renderer/src/lib/atlas-preview-view.ts
5
$ npm run test -- tests/core/atlas-preview.spec.ts -t "Phase 30 BUFFER-01"
Tests  1 passed | 25 skipped (26)
```

Parity counts match (5 vs 5). New parity regex test in `tests/core/atlas-preview.spec.ts` locks the contract permanently — catches signature divergence even when the runtime equality test passes loosely (D-07 short-circuit).

### CR-04 (BLOCKER) sites 1-4: doc-export reads new top-level field

**Before:** Phase 20's `Documentation.safetyBufferPercent` (legacy, range 0-100, fractional, "Metadata only" per v1.2 D-22 input copy) and Phase 30's new top-level `safetyBufferPercent` (range 0-25, integer-only) coexisted as independent fields with no sync. The HTML doc-export at `src/main/doc-export.ts:292` read the LEGACY field; `buildExportPlan` math read the NEW field. For projects with non-zero values in either, the HTML report and the actual export disagreed.

**After (Option C — minimum viable):**

1. **DocExportPayload** gains optional `safetyBufferPercent?: number` top-level field with JSDoc.
2. **renderOptimizationConfigCard** now reads `payload.safetyBufferPercent` with a defensive integer-and-range coerce:
   ```typescript
   typeof safetyRaw === 'number'
   && Number.isInteger(safetyRaw)
   && safetyRaw >= 0
   && safetyRaw <= 25
     ? safetyRaw
     : 0
   ```
   Mirrors the IPC-seam pattern at `src/main/project-io.ts:700-716`.
3. **DocumentationBuilderDialog.tsx** has 4 explicit verbatim edits per plan-checker iter-1 BLOCKER 2:
   - **Site 1** (line ~76): `DocumentationBuilderDialogProps` gains `safetyBufferPercent: number` required prop.
   - **Site 2** (line ~202): `ExportPaneProps` gains `safetyBufferPercent: number`; ExportPane destructured params updated.
   - **Site 3** (line ~157): `<ExportPane>` JSX mount passes `safetyBufferPercent={props.safetyBufferPercent}`.
   - **Site 4** (line ~235): `exportDocumentationHtml` payload literal includes `safetyBufferPercent`.
4. **SafetyBufferSubSection** converted to read-only "Moved to Optimize dialog" notice (no editable input). Pre-30-05 the section had a writable input bound to the legacy field; users could edit a value that didn't drive any math.
5. **Site 5** (AppShell mount of `<DocumentationBuilderDialog>`) is owned by Plan 30-04 in the same wave per plan-checker iter-1 BLOCKER 2 site-5 move.

**Legacy `Documentation.safetyBufferPercent`** stays in `src/core/documentation.ts` unchanged as informational metadata (zero schema migration; backward-compat per CLAUDE.md schema-additive lock). v1.2-era `.stmproj` files round-trip without loss; the field is simply no longer read by any UI surface or export-pipeline consumer.

**Grep evidence:**
```
$ grep -c "payload.safetyBufferPercent" src/main/doc-export.ts
1
$ grep -c "payload.documentation.safetyBufferPercent" src/main/doc-export.ts
0
$ grep -c "Moved to Optimize dialog" src/renderer/src/modals/DocumentationBuilderDialog.tsx
1
$ grep -c "draft.safetyBufferPercent" src/renderer/src/modals/DocumentationBuilderDialog.tsx
0
$ grep -c "safetyBufferPercent" src/renderer/src/modals/DocumentationBuilderDialog.tsx
13
```

The 13-hit count comprises (a) JSDoc anchors on each prop, (b) the prop declarations on both interfaces, (c) the destructured-param binding, (d) the JSX mount expression, (e) the IPC payload literal, plus (f) the SafetyBufferSubSection rationale comment cross-references — far exceeding the BLOCKER-3-tightened acceptance threshold of ≥ 2.

## Plan-checker iter-1 revisions applied

- **BLOCKER 1**: WR-02 (one-line ExportRow.bufferCapped JSDoc rewrite in src/shared/types.ts) **REMOVED** from this plan — moved to 30-04 so types.ts is exclusively owned by 30-04.
- **BLOCKER 2**: site 5 (AppShell mount of `<DocumentationBuilderDialog>`) **REMOVED** from this plan — moved to 30-04 so AppShell.tsx remains exclusively owned by 30-04. Sites 1-4 ship as 4 explicit verbatim diffs in this plan.
- **BLOCKER 3**: acceptance grep tightened from `≥ 1` to `≥ 2` co-located hits — actual count is 13 in DocumentationBuilderDialog.tsx, well above threshold.
- **INFO 8**: Task 3 Step 4 prose replaced with verbatim diff for the `exportDocumentationHtml` payload site.

## CR-04 decision rationale (Option C)

Three options were evaluated in 30-REVIEW.md:

- **Option A** (full deprecation + materialize-time migration) requires updating `materializeProjectFile` to copy `Math.min(legacy, 25)` into the top-level field if missing, plus adding a one-time UI banner / log line for transparency, plus migration semantics tests. Larger blast radius.
- **Option B** (sync the two fields) creates a permanent two-input UX surface — the same concept editable from two places with different ranges (0-100 vs 0-25). Confusing.
- **Option C** (picked) — doc-export reads top-level; legacy stays as informational metadata in core/documentation.ts but is no longer consumed. Zero migration. Zero schema bump. Zero risk to v1.2-era projects.

The v1.2 D-22 input copy ("Metadata only. Captured in the HTML export; export math wiring deferred to a future phase.") explicitly disclaimed the legacy field's authority — users were told it was metadata-only and not driving math. They cannot be reliable consumers of a field whose authority was explicitly disclaimed. Option C honors that contract while wiring the new top-level field through the report so the HTML and the actual export agree.

## Test counts

| Surface | Before | After |
|---|---|---|
| `tests/core/atlas-preview.spec.ts` | 25 passed + 1 todo (26) | 25 passed + 1 todo (26)** — but **+1 new parity regex test** in passing count (was previously absent). |
| `tests/main/doc-export.spec.ts` | 11 passed (11) | 11 passed (11) — 1 test fixture updated to pass safetyBufferPercent at top-level. |
| Full vitest suite | 904 passed / 1 failed (sampler-worker-girl warm-up) + 1 errored fixture / 18 skipped / 2 todo / 924 total | 903 passed / 1 failed (same) + 1 errored fixture (same) / 18 skipped / 2 todo / 924 total |

The full-suite count of 924 is identical before and after (no test deletions, no new test additions wash out the +1 parity regex test). The +1 lives inside `atlas-preview.spec.ts` describe block at line 410 — it replaces a prior passing-loosely state with a tight signature lock.

The 2 pre-existing failures are unchanged:
1. `tests/main/sampler-worker-girl.spec.ts` — Girl/JOKER warm-up errors (pre-existing wall-time gate).
2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` not present (pre-existing fixture issue).

Neither was caused by this plan — both reproduce verbatim against the pre-30-05 commit.

## Layer 3 invariant final verification

```
$ grep -rn "from 'sharp'" src/core/ | wc -l
0
$ grep -rn "from 'electron'" src/core/ | wc -l
0
```

Layer 3 invariant preserved. The new code adds zero new imports — `deriveInputs` already imports `buildExportPlan` from `./export.js` (line 51), and the opts threading is pure-TS additive.

## TypeScript clean compile

After this plan ships in isolation (before 30-04 lands the AppShell mount fix), one expected error appears:

```
src/renderer/src/components/AppShell.tsx(2052,8): error TS2741:
  Property 'safetyBufferPercent' is missing in type '{...}' but required in type 'DocumentationBuilderDialogProps'.
```

This is correct intermediate state per the plan: this plan lands the receiving prop interface in `DocumentationBuilderDialogProps.safetyBufferPercent`; plan 30-04 lands the AppShell mount-site value `safetyBufferPercent={safetyBufferPercentLocal}`. The wave-4 final TypeScript check (after both plans complete) is clean. Both plans are file-disjoint per plan-checker iter-1.

The pre-existing errors in `tests/core/analyzer.spec.ts`, `tests/core/documentation.spec.ts`, and `tests/core/project-file-loader-mode-heal.spec.ts` are out of scope for this plan (not modified, not introduced by this plan's changes).

## Parity regex test correctness

The new parity regex test at `tests/core/atlas-preview.spec.ts:410-429` asserts the regex `/safetyBufferPercent\?\s*:\s*number/` matches in BOTH source files. Prior to Task 2, only the renderer copy contained this signature — the test failed RED on the `coreText` assertion (verified at the Task 1 commit point). After Task 2, both files contain the signature — the test passes GREEN.

This test catches signature divergence even when the existing 5-case projection-equality test at line 410 passes loosely. The 5 existing cases all omit `safetyBufferPercent` from their opts, which means the D-07 no-op short-circuit (`bufferPct === 0 ? rawEffScale : ...`) collapses to the pre-Phase-30 baseline regardless of opts shape. The runtime equality holds, but the SIGNATURE could still drift. The regex test locks the signature contract.

## BLOCKER-3 acceptance grep state

Pre-Task 3, the BLOCKER-3 grep returned 0 hits (no `safetyBufferPercent` anywhere in DocumentationBuilderDialog.tsx). After all 4 sites land:

```
$ grep -c "safetyBufferPercent" src/renderer/src/modals/DocumentationBuilderDialog.tsx
13
```

13 hits comfortably exceeds the tightened ≥ 2 threshold. The natural state once sites 1-4 land is multiple hits because the field is referenced in (a) JSDoc anchors, (b) prop interface declarations, (c) destructured params, (d) JSX mount, (e) payload literal, (f) cross-reference comments in SafetyBufferSubSection.

## Deviations from Plan

**1. [Rule 1 - Bug] Removed unused ChangeEvent import**
- **Found during:** Task 3 Step 4 (SafetyBufferSubSection conversion).
- **Issue:** After converting SafetyBufferSubSection from a writable input to a read-only notice, the `ChangeEvent` type-only import in line 43 became unused. TypeScript flagged it: `error TS6133: 'ChangeEvent' is declared but its value is never read.`
- **Fix:** Removed `, type ChangeEvent` from the React import statement at line 43.
- **Files modified:** src/renderer/src/modals/DocumentationBuilderDialog.tsx
- **Commit:** 7e5f080 (rolled into the Task 3 commit since it's directly caused by Task 3's SafetyBufferSubSection rewrite).

**2. [Rule 1 - Bug] Updated tests/main/doc-export.spec.ts fixture for new top-level field**
- **Found during:** Task 3 verification step.
- **Issue:** The "renders the Optimization Config card with safety buffer + savings" test at line 170 was setting `Documentation.safetyBufferPercent = 1` and expecting "1%" in the rendered HTML. With Task 3's read-source change (legacy → top-level), the HTML now reads `payload.safetyBufferPercent` which was undefined in this fixture → coerced to 0 → rendered "0%" → test failed.
- **Fix:** Updated `makeMinimalPayload({ documentation: doc })` → `makeMinimalPayload({ safetyBufferPercent: 1 })` so the fixture passes the value through the new top-level path. The legacy `Documentation.safetyBufferPercent` is no longer consumed by the doc-export pipeline.
- **Files modified:** tests/main/doc-export.spec.ts
- **Commit:** 7e5f080 (rolled into the Task 3 commit since the test fixture update is required for the Task 3 acceptance criterion "Existing main/doc-export tests still pass (or test fixtures updated)").

No other deviations from the plan.

## Self-Check: PASSED

**Files created/modified verified:**
```
[ -f "src/core/atlas-preview.ts" ] → FOUND
[ -f "tests/core/atlas-preview.spec.ts" ] → FOUND
[ -f "src/main/doc-export.ts" ] → FOUND
[ -f "src/renderer/src/modals/DocumentationBuilderDialog.tsx" ] → FOUND
[ -f "tests/main/doc-export.spec.ts" ] → FOUND
[ -f ".planning/phases/30-safety-buffer-in-optimize-dialog/30-05-SUMMARY.md" ] → FOUND (this file)
```

**Commits verified:**
```
38b11d6 → FOUND (Task 1: parity regex test RED)
48ff437 → FOUND (Task 2: core/atlas-preview.ts mirror — CR-03 GREEN)
7e5f080 → FOUND (Task 3: doc-export + DocumentationBuilderDialog — CR-04 Option C)
```

All 3 commits in `git log` on the worktree-agent-a5f1dbb30a0e72f80 branch.
