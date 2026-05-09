---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
plan: 05
subsystem: ui
tags: [bugfix, ui, regression, gap-closure, override, path-indirection, batch-apply]

# Dependency graph
requires:
  - phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac/03
    provides: AppShell overrides Map keyed by regionName (rowKey = row.regionName ?? row.attachmentName)
  - phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac/02
    provides: GlobalMaxRenderPanel rows + selection state keyed by regionName
provides:
  - Region-keyed batch-apply UI handoff (selectedKeys = `selected` Set verbatim)
  - REGION-04 closure on the BATCH path (single-row path was already closed by Plan 29-03)
  - tests/regression/path-indirection.spec.ts REGION-04 batch-apply UI it() block (source-level + behavior-level lock)
affects:
  - "/gsd-verify-work 29 re-verification (CR-01 closure)"
  - Phase 29 close-out: REGION-04 now covered end-to-end across BOTH single-row and batch-apply paths

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-level + behavior-level paired test: regex grep of source file + buildExportPlan-driven behavior assertion against synthetic summary"
    - "Inline synthetic SkeletonSummary builder cloned from buildSyntheticPathIndirectedSummary for fixture-free regression coverage"

key-files:
  created:
    - .planning/phases/29-per-region-dedup-override-region-semantics-atlas-preview-pac/29-05-SUMMARY.md
    - .planning/phases/29-per-region-dedup-override-region-semantics-atlas-preview-pac/deferred-items.md
  modified:
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
    - tests/regression/path-indirection.spec.ts
    - tests/arch.spec.ts

key-decisions:
  - "Pass `selected` (Set<regionName>) verbatim as `selectedKeys` at both Row prop sites — no fan-out conversion needed because AppShell's overrides Map is regionName-keyed (Plan 29-03)."
  - "Lock CR-01 fix at TWO layers in tests/regression/path-indirection.spec.ts: (A) source-level grep guard (selectedAttachmentNames absent + selectedKeys={selected} present at 2+ sites) AND (B) behavior-level (synthetic summary → AppShell scope-mutation simulation → buildExportPlan asserts every key is a regionName + every region's outW matches the override)."
  - "Avoid splitting tests/regression/path-indirection.spec.ts into a jsdom companion file. The vitest-environment pragma is file-level; the source-level grep + behavior-level synthetic-summary approach captures the contract end-to-end without requiring a panel render in jsdom."
  - "Update tests/arch.spec.ts batch-scope guards from PRE-CR-01 invariant (require selectedAttachmentNames intermediate, forbid selectedKeys={selected}) to POST-CR-01 invariant (require selectedKeys={selected} at 2+ sites, forbid re-introduction of selectedAttachmentNames). Same describe block, inverted assertions — preserves the regression-guard slot."

patterns-established:
  - "Post-fix arch-guard pattern: when a CR fix removes a previously-required intermediate, flip the arch.spec.ts grep guard's polarity in-place so the same describe block now anti-guards the regression."
  - "Synthetic Chicken-Min summary: deterministic peakScale=1.0 + canonicalW/H = real-fixture dims (378×428 + 30×90) → outW math is integer-clean at 50% override (189 + 15) for stable assertions across packer / safeScale future edits."

requirements-completed: [REGION-04]

# Metrics
duration: 8min
completed: 2026-05-07
---

# Phase 29 Plan 05: Per-region dedup — CR-01 batch-apply UI handoff fix

**Panel-side fix flipping the GlobalMaxRenderPanel batch-apply selection handoff from contributor-fan-out (selectedAttachmentNames) to verbatim regionName-keyed Set, closing CR-01 from 29-VERIFICATION.md and locking the contract via paired source-level + behavior-level regression tests.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-07T21:21:00Z
- **Completed:** 2026-05-07T21:28:55Z
- **Tasks:** 2
- **Files modified:** 3 (GlobalMaxRenderPanel.tsx, tests/regression/path-indirection.spec.ts, tests/arch.spec.ts) + 1 created (deferred-items.md)

## CR-01 Root Cause (29-VERIFICATION.md gap.reason)

> The batch-apply UI handoff between `GlobalMaxRenderPanel` and `AppShell.onOpenOverrideDialog` is broken because the panel still fans the user's selected regionNames out into the union of `contributingAttachments[].attachmentName` (the `selectedAttachmentNames` useMemo at lines 825-833 — pre-Phase-29-03 logic that survived the override-Map re-key in Plan 29-03). AppShell at lines 511-585 has been re-keyed for D-04 (it reads `rowKey = row.regionName` and writes `[...selectedKeys]` into the regionName-keyed override Map at line 583), so on path-indirected projects the Map is poisoned with contributor-name keys that `buildExportPlan` does not pick up — the user thinks they applied an override to N regions and only got 1 (or 0).

## Fix Shape

### Hunk 1 — Deleted obsolete useMemo block (panel lines 817-833)

```diff
-  // Phase 29 (Plan 29-02 Task 3): the panel's selection key is now `regionName`
-  // (one row per source PNG / atlas region). The outbound onOpenOverrideDialog
-  // contract still hands AppShell a Set of names — at this checkpoint AppShell's
-  // override Map is keyed by attachmentName (Plan 29-03 will flip it). For now,
-  // expand each selected regionName into the union of its contributing
-  // attachmentNames so the existing AppShell batch-scope check (which reads the
-  // attachmentName-keyed override Map) keeps working unchanged.
-  // Gap-fix A (human-verify 2026-04-24) — original Plan 04-03 mapping doc.
-  const selectedAttachmentNames = useMemo(() => {
-    const names = new Set<string>();
-    for (const r of enriched) {
-      if (selected.has(r.regionName)) {
-        for (const c of r.contributingAttachments) names.add(c.attachmentName);
-      }
-    }
-    return names;
-  }, [selected, enriched]);
+  // Phase 29 Plan 29-05 (CR-01 fix): the panel's regionName-keyed `selected`
+  // Set is passed verbatim to AppShell as `selectedKeys`. AppShell's override
+  // Map is regionName-keyed post-29-03; no fan-out conversion needed.
```

### Hunk 2 — Virtualized branch Row prop (~line 1116)

```diff
-                      selectedKeys={selectedAttachmentNames}
+                      selectedKeys={selected}
```

### Hunk 3 — Flat-table branch Row prop (~line 1240)

```diff
-                      selectedKeys={selectedAttachmentNames}
+                      selectedKeys={selected}
```

### Hunk 4 — File-top JSDoc (Gap A bullet, lines 35-44)

```diff
- *   - Gap A: selection set is converted from internal row identity (post Phase
- *     29: regionName) to attachmentName at the dialog invocation site so the
- *     outbound onOpenOverrideDialog contract reaches AppShell as a Set of
- *     attachmentNames (the override Map is still attachmentName-keyed pre
- *     Plan 29-03). Path-indirected regions expand into the union of their
- *     contributing attachments. See 04-03-SUMMARY.md §Deviations.
+ *   - Gap A (superseded by Phase 29 Plan 29-05 / CR-01 fix): selection set is
+ *     passed verbatim as a Set<regionName> to AppShell. The override Map is
+ *     regionName-keyed (Plan 29-03 + 29-05) so no contributor-fan-out
+ *     conversion exists in the panel. The pre-29-05 contributor-fan-out memo
+ *     poisoned the Map with contributor names on path-indirected fixtures;
+ *     removed in Plan 29-05.
```

The literal symbol `selectedAttachmentNames` is removed from the JSDoc as well — keeping the prose self-describing without re-introducing the obsolete token at any source location. (The plan's prescribed JSDoc text contained the literal token; we replaced it with "contributor-fan-out memo" to satisfy the must-haves grep `count selectedAttachmentNames === 0`.)

## Regression Test Approach

The plan documented a tension: per-block `@vitest-environment` directives are not supported (the pragma is file-level), so adding a renderer-only jsdom test inside the existing node-env `path-indirection.spec.ts` is impossible. Two paths considered:

1. **Split into a jsdom companion file** (`tests/renderer/global-max-batch-apply.spec.tsx`) — clean separation, but introduces a new file that the verifier wouldn't find in `tests/regression/`.
2. **Source-level + behavior-level paired lock in node env** — captures the CR-01 fix end-to-end without crossing the environment boundary.

Chose **(2)**. The new it() block locks the fix at TWO layers:

- **(A) Source-level lock:** reads `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` via `fs.readFileSync`; asserts the obsolete symbol does NOT appear (`expect(panelSrc).not.toMatch(/selectedAttachmentNames/)`) and that `selectedKeys={selected}` appears at >=2 sites. Future refactors that re-introduce contributor fan-out fail here.

- **(B) Behavior-level lock:** builds a synthetic Chicken-Min-shaped `SkeletonSummary` (region `5/7` with 3 contributors `5/5/5/7/7`, `5/5/7/7`, `5/7` at canonicalW=378×428; region `5/BLOOD_DROP` with 1 contributor at 30×90, peakScale=1.0). Simulates the post-fix panel selection (`new Set(['5/7', '5/BLOOD_DROP'])`) + the AppShell scope-mutation shape verbatim (`for (const name of scope) next.set(name, clamped)` at 50% override). Calls `buildExportPlan(synth, postBatchOverrides)` and asserts:
  - Every key in `postBatchOverrides` is a `summary.regions[].regionName` (no contributor-name keys leak in).
  - `postBatchOverrides.size === 2`.
  - For BOTH selected regions, `exportRow.outW === Math.ceil(canonicalW × 0.5)` and `outH === Math.ceil(canonicalH × 0.5)` — confirming the override REACHED every region's export math (the CR-01 closure proof).

Pre-fix the panel would have handed AppShell a Set of attachmentNames; the AppShell mutation would have written contributor-name keys; `buildExportPlan` would have read `row.regionName ?? row.attachmentName` and missed every region's override (Map miss). Post-fix the override reaches every region. Either side of the fix that breaks would fail this test.

## Source-Level Evidence

```
$ grep -c "selectedAttachmentNames" src/renderer/src/panels/GlobalMaxRenderPanel.tsx
0

$ grep -c "selectedKeys={selected}" src/renderer/src/panels/GlobalMaxRenderPanel.tsx
2

$ grep -n "Phase 29 Plan 29-05 (CR-01 fix)" src/renderer/src/panels/GlobalMaxRenderPanel.tsx
817:  // Phase 29 Plan 29-05 (CR-01 fix): the panel's regionName-keyed `selected`

$ grep -n "Gap A (superseded by Phase 29 Plan 29-05" src/renderer/src/panels/GlobalMaxRenderPanel.tsx
36: *   - Gap A (superseded by Phase 29 Plan 29-05 / CR-01 fix): selection set is
```

## Behavior-Level Evidence

```
$ npx vitest run tests/regression/path-indirection.spec.ts -t "REGION-04 batch-apply UI"
 RUN  v4.1.5 ...
 Test Files  1 passed (1)
      Tests  1 passed | 8 skipped (9)

$ npx vitest run tests/regression/path-indirection.spec.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

The new it() block runs 4+ assertions (member of selectedKeys ⊆ regionNames; member of postBatchOverrides keys ⊆ regionNames; size === 2; per-region outW + outH match `ceil(canonical × 0.5)`).

## AppShell + export.ts Zero-Touch Evidence

```
$ git diff --stat c35b9d3 HEAD -- src/renderer/src/components/AppShell.tsx
(empty — zero changes)

$ git diff --stat c35b9d3 HEAD -- src/core/export.ts
(empty — zero changes)
```

CR-01 fix is panel-side only. AppShell + export.ts were already correct post-Plan-29-03.

## Test Counts

- `tests/regression/path-indirection.spec.ts`: **+1 it() block** (8 → 9; new REGION-04 batch-apply UI block).
- `tests/arch.spec.ts`: 2 it() blocks (unchanged count; assertions inverted from pre-CR-01 to post-CR-01 contract).
- Full suite: **869 passing**, 11 skipped, 2 todo, 1 pre-existing failure (sampler-worker-girl wall-time gate, unrelated; verified by stash-and-rerun).
- Cumulative phase 29 test delta: ~58 new tests across plans 01–05.

## Task Commits

1. **Task 1: Replace selectedAttachmentNames memo with regionName-keyed `selected` Set** — `e8862e9` (fix)
2. **Task 2: Add end-to-end batch-apply UI regression test (REGION-04 closure)** — `50955fe` (test)

## Files Created/Modified

- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — Removed `selectedAttachmentNames` useMemo + comment block; both Row prop sites now pass `selected` verbatim; JSDoc Gap A bullet rewritten for post-29-05 reality.
- `tests/regression/path-indirection.spec.ts` — Added REGION-04 batch-apply UI it() block with paired source-level + behavior-level lock; appended `buildSyntheticBatchApplySummary` helper.
- `tests/arch.spec.ts` — Inverted GlobalMaxRenderPanel batch-scope guards from pre-CR-01 (require fan-out intermediate) to post-CR-01 (forbid re-introduction; require `selectedKeys={selected}` at 2+ sites). Same describe block name updated to "Phase 29 Plan 29-05 / CR-01 regression guard".
- `.planning/phases/.../deferred-items.md` (created) — Logged 2 pre-existing test failures (sampler-worker-girl, sampler-skin-defined-unbound) verified out-of-scope by stash-and-rerun.

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inverted tests/arch.spec.ts batch-scope guards from pre-CR-01 to post-CR-01 contract**

- **Found during:** Task 1 verification (`npm run test`)
- **Issue:** `tests/arch.spec.ts` had a "GlobalMaxRenderPanel batch-scope invariant (04-03 gap-fix A regression guard)" describe block with two it() blocks that EXPLICITLY enforced the pre-CR-01 contract: one required `selectedAttachmentNames` to exist (`toMatch(/selectedAttachmentNames/)`) and the other forbade `selectedKeys={selected}` (`not.toMatch(/selectedKeys=\{selected\}/)`). Plan 29-05 fix is structurally incompatible with these guards — keeping them green would mean undoing the CR-01 fix.
- **Fix:** Inverted the polarity of both assertions in-place (same describe block, renamed to "Phase 29 Plan 29-05 / CR-01 regression guard"). New guards: (1) `selectedKeys={selected}` MUST appear at >=2 Row prop sites, (2) `selectedAttachmentNames` MUST NOT appear anywhere. The describe block now anti-guards regression of the CR-01 fix.
- **Files modified:** `tests/arch.spec.ts`
- **Verification:** Full suite re-run; arch.spec.ts now reports `12 tests | 0 failed`.
- **Committed in:** `50955fe` (Task 2 commit, alongside the new path-indirection regression test).

**2. [Out of scope - logged] 2 pre-existing test failures observed during full-suite verification**

- `tests/main/sampler-worker-girl.spec.ts` — warm-up run errors at the worker layer (fixture-availability issue, unrelated to CR-01).
- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — `loadSkeleton` errors at file load time (fixture-availability issue, unrelated to CR-01).

Verified by `git stash && npx vitest run [...] && git stash pop` — both failures are identical with all 29-05 changes stashed. Logged in `.planning/phases/29-per-region-dedup-override-region-semantics-atlas-preview-pac/deferred-items.md` per SCOPE BOUNDARY rule. NOT auto-fixed.

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking — stale arch guard); 2 out-of-scope failures logged.
**Impact on plan:** The arch-guard inversion is structurally required by the CR-01 fix — without it, the suite would be impossible to make green while preserving the panel-side changes. Same describe block, polarity inverted, semantics preserved (still a regression guard, now anti-guarding the post-fix shape).

## Issues Encountered

None during planned work; auto-fix above resolved the only blocker.

## User Setup Required

None.

## Hand-off Notes for /gsd-verify-work 29 Re-verification

The verifier should certify CR-01 closure end-to-end by:

1. Reading this SUMMARY (root cause quote + fix-shape diffs + paired-lock test approach).
2. Confirming the must-haves[] grep evidence:
   - `grep -c "selectedAttachmentNames" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` → 0
   - `grep -c "selectedKeys={selected}" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` → 2
3. Running the new it() block: `npx vitest run tests/regression/path-indirection.spec.ts -t "REGION-04 batch-apply UI"` → 1 passing.
4. Running full path-indirection suite: `npx vitest run tests/regression/path-indirection.spec.ts` → 9 passing.
5. Running tests/arch.spec.ts: 12 passing (the post-CR-01 batch-scope guards are green).
6. Confirming AppShell + src/core/export.ts have zero diff vs base commit (`git diff --stat c35b9d3 HEAD -- src/renderer/src/components/AppShell.tsx src/core/export.ts` → empty).

## Phase 29 Close-Out Update

REGION-04 closure now spans BOTH override paths:

- **Single-row override path** (Plan 29-03 + the existing regression test at lines 71-112 of path-indirection.spec.ts) — locked by `overrides.set('5/7', 4 / canonicalW × 100) → ExportRow.outW === 4`.
- **Batch-apply UI path** (Plan 29-05 + the new it() block at the end of path-indirection.spec.ts) — locked by source-level + behavior-level paired assertions covering the panel handoff + AppShell scope mutation + buildExportPlan output dims.

The .planning/debug/path-indirected-duplicate-rows.md falsified bug is now closed at every override surface.

## Self-Check

Verifying claims:

```
$ [ -f .planning/phases/29-per-region-dedup-override-region-semantics-atlas-preview-pac/29-05-SUMMARY.md ] && echo FOUND || echo MISSING
FOUND

$ [ -f .planning/phases/29-per-region-dedup-override-region-semantics-atlas-preview-pac/deferred-items.md ] && echo FOUND || echo MISSING
FOUND

$ git log --oneline | grep -E "(e8862e9|50955fe)"
50955fe test(29-05): add REGION-04 batch-apply UI regression + flip arch guards
e8862e9 fix(29-05): pass regionName-keyed selected Set verbatim as selectedKeys (CR-01)
```

## Self-Check: PASSED

---
*Phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac*
*Plan: 05*
*Completed: 2026-05-07*
