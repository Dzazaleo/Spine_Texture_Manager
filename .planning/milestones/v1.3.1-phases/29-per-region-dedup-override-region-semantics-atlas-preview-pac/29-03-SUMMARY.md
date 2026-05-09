---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
plan: 03
subsystem: override-storage-migration-export-read
tags: [refactor, ipc, persistence, migration, override-semantics, layer-3]

requires:
  - phase: 29-01
    provides: RegionRow + summary.regions field (consumed via OverrideDialog peak read; available for future region-typed callers)
  - phase: 29-02
    provides: GlobalMaxRenderPanel passes regionName-keyed scope through onOpenOverrideDialog (regionName scope set at panel layer; consumed by AppShell here)
  - phase: 8 (D-146 + D-150)
    provides: ".stmproj v1 schema lock (additive-only) + stale-key drop pattern at the three project-io.ts seams (extended by D-06)"
provides:
  - "src/main/override-migration.ts — pure-TS migrateOverrides helper centralizing D-06 logic; 3-pass deterministic (Case A region-key wins, Case B contributor-key with lex-smallest tiebreak, Case C orphans → stale[])"
  - "MaterializedProject.migratedKeyCount: number — in-process IPC field, NOT persisted (Phase 8 D-146 schema-version 1 lock preserved)"
  - "AppShell migration banner UI (sibling to staleOverrideNotice; auto-clears on Save) + state slot overrideMigrationNotice"
  - "OverrideDialog peak prefill flips to row-direct scalar read with `'regionName' in row` narrowing (RegionRow callers get regionName-keyed scope; DisplayRow|BreakdownRow callers preserve attachmentName-keyed scope per D-09)"
  - "src/core/export.ts + src/renderer/src/lib/export-view.ts lockstep flip: overrides.get(row.regionName ?? row.attachmentName) inside buildExportPlan — closes the falsified bug"
affects:
  - "Plan 29-04 (regression fixture + integration regression): synthetic Test 5 falsifying-bug closure already locked at unit level; integration-level Chicken-Min fixture in 29-04 Task 2 should reproduce the same outW=4 result via loadSkeleton + sampleSkeleton + buildExportPlan end-to-end"

tech-stack:
  added: []
  patterns:
    - "Extracted pure-TS migration helper (src/main/override-migration.ts) — replaces the per-seam D-150 stale-key intersect with a 3-pass region-aware migration that runs identically at all three project-io.ts seams (mountOpenResponse / locate-skeleton-recovery / resample). Helper is unit-testable in isolation; the integration-level call sites are dataflow-equivalent across seams."
    - "Iteration-order-independent two-pass migration: Pass 1 writes Case A region-key entries authoritatively; Pass 2 buckets Case B contributor entries by target region with lex-smallest-saved-key wins; Pass 3 collects Case C orphans. Falsifying-regression gate Test 6 confirms a Case A region-key value MUST NOT be silently overwritten by a Case B contributor when iteration order would have visited Case B first."
    - "Row-type-agnostic OverrideDialog peak prefill: `'regionName' in row` narrowing reads scalars off the row directly. RegionRow (Global panel) and DisplayRow|BreakdownRow (AnimationBreakdownPanel drill-down per D-09) both expose the same scalar field set (peakScale / canonicalW / canonicalH / actualSourceW / actualSourceH / dimsMismatch), so the prefill math is row-shape-agnostic."
    - "Defensive `row.regionName ?? row.attachmentName` lookup in buildExportPlan: regionName is optional on DisplayRow per Plan 29-01 Strategy (a). Synthetic test fixtures that build PeakRecords without regionName set fall back to attachmentName naturally — preserves the SIMPLE_PROJECT byte-lock D-102 contract since regionName === attachmentName for non-indirected rigs."

key-files:
  created:
    - "src/main/override-migration.ts (157 lines pure-TS — Phase 29 D-06 helper; 1 export, 3 passes, 1 result interface)"
    - "tests/main/override-migration.spec.ts (10 tests covering all 9 plan-locked behaviors + iteration-order independence sentinel runner)"
    - "tests/renderer/override-migration-banner.spec.tsx (7 tests covering banner copy plural/singular + Dismiss + missing-field backward-compat + coexistence with staleOverrideNotice + auto-clear via appShellMenuRef Save)"
  modified:
    - "src/main/project-io.ts (3 seam call sites flipped to migrateOverrides helper; old D-150 per-seam loops removed; 1 import added)"
    - "src/shared/types.ts (MaterializedProject gains migratedKeyCount: number — non-optional; in-process IPC only, NOT persisted)"
    - "src/renderer/src/components/AppShell.tsx (overrideMigrationNotice state slot + sibling banner JSX + auto-clear at 5 sites: onClickSave, onClickSaveAs, mountOpenResponse, runReload, samplingHz-resample-useEffect; OverrideDialog peak read flipped to row-direct scalar read with 'regionName' in row narrowing)"
    - "src/core/export.ts (buildExportPlan: overrides.get(row.regionName ?? row.attachmentName) inside bySourcePath fold — closes the falsified bug from .planning/debug/path-indirected-duplicate-rows.md)"
    - "src/renderer/src/lib/export-view.ts (byte-equal mirror of core change per lockstep duplication invariant)"
    - "tests/core/export.spec.ts (3 new regression tests: Test 5 falsified-bug closure with synthetic path-indirected fixture; Test 5b negative case proving unmigrated v1.3-era contributor key does NOT bind; Test 6 SIMPLE_PROJECT backward-compat verifying CIRCLE 25% override produces unchanged output)"

key-decisions:
  - "Helper extraction location — chose src/main/override-migration.ts (new file) over inlining a function inside project-io.ts. Reasoning: pure-TS, no Layer 3 violation (no fs/electron/sharp), unit-testable in isolation, single-responsibility module. The plan offered both options ('a new src/main/override-migration.ts if executor prefers separation — both are main-side code, no Layer 3 boundary involved'); separation chosen for testability."
  - "Export-read pattern picked — `row.regionName ?? row.attachmentName` (defensive ?? fallback) chosen over a hard `row.regionName` read. Reasoning: regionName is optional on DisplayRow per Plan 29-01 Strategy (a); existing 60+ tests in tests/core/export.spec.ts use synthetic fixtures that build PeakRecords without regionName populated, and the ?? fallback preserves their SIMPLE_PROJECT byte-equal output (regionName === attachmentName for non-indirected rigs). Plan §interfaces explicitly listed this as the safe pattern; locked."
  - "OverrideDialog peak prefill refactor — replaced `summary.peaks.find(p => p.attachmentName === row.attachmentName)` with row-direct scalar reads via `'regionName' in row` narrowing. The peak source is the row itself (RegionRow.peakScale / canonicalW / etc. mirror DisplayRow.peakScale / canonicalW / etc. for the REGION-05 winning contributor). Cleaner than a per-row-type if/else and removes the dependency on summary.peaks (which would need a regionName-keyed sibling lookup post-flip). The plan suggested this pattern (`row` IS the row directly — RegionRow has all the same scalar fields as DisplayRow)."
  - "Auto-clear of migration banner on every re-mount path — wired at 5 sites (onClickSave, onClickSaveAs, mountOpenResponse, runReload, samplingHz-resample-useEffect). Reasoning: the migration helper runs at every project-io.ts load seam; the banner must surface (and auto-clear on next save) regardless of which path the user took to load the project. Single setOverrideMigrationNotice setter at every seam keeps the contract uniform."

requirements-completed: [REGION-04]

duration: ~15 min
completed: 2026-05-07
---

# Phase 29 Plan 03: per-region override storage + .stmproj migration Summary

**Override storage Map<regionName, number> end-to-end (in-memory + on-disk via silent migration); the user's `5/7 → 4×4` override now reaches the export pipeline (REGION-04 closed); migration banner auto-surfaces v1.3-era → v1.3.1 transition; AnimationBreakdownPanel UNCHANGED preserving REGION-06 + D-09 drill-down contract; .stmproj schema-version unchanged (D-146 lock preserved).**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 / 2 complete
- **Files modified:** 6 production files (1 new pure-TS helper + 5 modified) + 3 test files (2 new + 1 extended)
- **Tests added:** 20 new (10 migration unit + 7 banner integration + 3 export regression)
- **Tests pass:** 860 / 874 (with 11 skipped + 2 todo + 2 pre-existing fixture-missing failures inherited from prior phases)

## Accomplishments

- **migrateOverrides helper extracted** to `src/main/override-migration.ts` — pure-TS, 1 export, 3 passes (Case A region-keyed wins, Case B contributor-keyed with lex-smallest tiebreak, Case C orphans). Single source of truth for D-06 logic; called from all 3 project-io.ts seams (mountOpenResponse / locate-skeleton-recovery / resample).
- **Two-pass migration is iteration-order-independent**: Test 6 (`tests/main/override-migration.spec.ts`) is the falsifying-regression gate that catches the single-pass defect (a Case A region-key value being silently overwritten by a Case B contributor when iteration order would have visited Case B first).
- **MaterializedProject extended** with `migratedKeyCount: number` (non-optional in-process IPC field). Phase 8 D-146 schema-version 1 lock preserved — the .stmproj on-disk shape is unchanged; only override key meaning shifts (Phase 21/22/28 additive-only precedent).
- **AppShell migration banner UI lands**: sibling to staleOverrideNotice; visual idiom matches Phase 8 D-150 (border-b border-border bg-panel + accent left-bar + Dismiss button). Copy: `Updated N override{s} to per-region keys.` Tailwind v4 Pitfall 8: every className is a literal string. Auto-clears on Save (onClickSave + onClickSaveAs) and on every re-mount path (mountOpenResponse + runReload + samplingHz-resample-useEffect).
- **OverrideDialog peak prefill flipped** to row-direct scalar read with `'regionName' in row` narrowing. RegionRow callers (Global panel) get regionName-keyed scope; DisplayRow|BreakdownRow callers (AnimationBreakdownPanel drill-down per D-09) preserve attachmentName-keyed scope. Both row types expose the same scalar fields (peakScale / canonicalW / canonicalH / actualSourceW / actualSourceH / dimsMismatch); prefill math is row-agnostic.
- **src/core/export.ts override-read flip closes the falsified bug**: `buildExportPlan` reads `overrides.get(row.regionName ?? row.attachmentName)` inside the bySourcePath fold. Test 5 in `tests/core/export.spec.ts` proves the closure: synthetic path-indirected fixture with `overrides.set('5/7', 1.0)` produces an ExportRow with `outW === 4` (NOT 378 — pre-flip the per-region max from non-overridden siblings won). Test 5b proves an unmigrated v1.3-era contributor key (e.g. `overrides.set('5/5/7/7', 1)`) does NOT bind — the migration helper at the project-io.ts seam is the ONLY path that produces a valid export-binding override.
- **src/renderer/src/lib/export-view.ts byte-equal mirror updated** in lockstep (parity test in `tests/core/export.spec.ts` describes block validates).
- **AnimationBreakdownPanel: ZERO file-touch** — REGION-06 + D-09 contract preserved verbatim. Verified via `git diff --stat HEAD~2 HEAD -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns empty.
- **.stmproj schema-version 1 unchanged**: `grep -c 'version: 1' src/core/project-file.ts` returns 1; only override key meaning shifts.

## Task Commits

Each task was committed atomically:

1. **Task 1: migrateOverrides helper + 3-seam wiring + MaterializedProject.migratedKeyCount** — `07c0ef9` (feat)
2. **Task 2: regionName-keyed overrides end-to-end + migration banner UI + export-read flip** — `2bea027` (feat)

(No separate test commits — both tasks tagged `tdd="true"`; failing tests were added in the same commit as the implementation that resolves them, per Plan 29-01's established convention.)

## Files Created/Modified

### Created

- `src/main/override-migration.ts` — 157 lines pure-TS; `migrateOverrides(savedOverrides, summary): { restored, stale, migratedKeyCount }`. Layer 3-clean (no fs/electron/sharp/dom).
- `tests/main/override-migration.spec.ts` — 10 unit tests (Test 1 no-migration, Test 2 single-contributor, Test 3 path-indirected, Test 4 lex-smallest-wins, Test 4b 3-contributor scrambled-insertion, Test 5 orphan-stale, Test 6 single-pass-defect falsifying gate, Test 7 invalid-value validation, Test 7b mixed-validity, Test 8 combined-fixture). Plus an iteration-order-independence sentinel runner that re-runs every multi-entry test in reverse insertion order.
- `tests/renderer/override-migration-banner.spec.tsx` — 7 RTL tests (plural copy, singular copy, count===0 absent, missing-field backward-compat, Dismiss removes banner, coexistence with staleOverrideNotice, auto-clear via appShellMenuRef.current.onClickSave()).

### Modified

- `src/main/project-io.ts` — 1 import added (`migrateOverrides` from `./override-migration.js`); 3 seam call sites refactored from per-seam D-150 loops to single `migrateOverrides(savedOverrides, summary)` call destructuring `{ restored, stale, migratedKeyCount }` and threading all three into the `MaterializedProject` literal.
- `src/shared/types.ts` — `MaterializedProject.migratedKeyCount: number` field added (non-optional; in-process IPC only). Phase 8 D-146 lock preserved (no .stmproj on-disk shape change).
- `src/renderer/src/components/AppShell.tsx` — `overrideMigrationNotice` state slot + setter; sibling banner JSX immediately after staleOverrideNotice; auto-clear at 5 sites (onClickSave + onClickSaveAs + mountOpenResponse + runReload + samplingHz-resample useEffect); OverrideDialog peak prefill refactored to row-direct scalar read with `'regionName' in row` narrowing.
- `src/core/export.ts` — `buildExportPlan` override read flip: `overrides.get(row.regionName ?? row.attachmentName)` inside bySourcePath fold (1 line + extended docblock).
- `src/renderer/src/lib/export-view.ts` — byte-equal mirror of the core change (lockstep duplication invariant).
- `tests/core/export.spec.ts` — 3 new tests appended (Test 5 + Test 5b + Test 6 in the new "Phase 29 D-04 regionName-keyed override read" describe block).

## Decisions Made

- **Strategy: extract to new file vs. inline in project-io.ts.** The plan offered both options; chose the new file `src/main/override-migration.ts` for testability + single-responsibility separation. Helper is pure-TS (no Layer 3 violation), and the test surface is cleaner (10 unit tests in `tests/main/override-migration.spec.ts` drive the helper directly without IPC-mock overhead).
- **Export-read pattern: defensive `?? row.attachmentName` fallback** rather than a hard `row.regionName` read. Reasoning: DisplayRow.regionName is optional per Plan 29-01 Strategy (a); 60+ existing tests in tests/core/export.spec.ts use synthetic PeakRecords without regionName populated. The fallback preserves SIMPLE_PROJECT byte-equality (regionName === attachmentName for non-indirected fixtures) without requiring fixture migration in this plan.
- **OverrideDialog prefill: row-direct scalar read** rather than `summary.regions.find(...)` lookup. Reasoning: the row already carries every scalar the prefill needs (peakScale / canonicalW / canonicalH / actualSourceW / actualSourceH / dimsMismatch); a separate summary.regions lookup would be redundant. The `'regionName' in row` narrowing handles RegionRow vs DisplayRow|BreakdownRow callers row-shape-agnostically.
- **Auto-clear at 5 re-mount sites** (not just onClickSave). Reasoning: the migration helper runs at EVERY project-io.ts load seam (mountOpenResponse / locate-skeleton-recovery / resample); the banner must surface AND auto-clear uniformly regardless of which load path the user took. Centralizing the auto-clear at every re-mount keeps the contract symmetric.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test 5 initial calibration off-by-one (effScale rounding interaction)**
- **Found during:** Task 2, running `tests/core/export.spec.ts` after appending the new D-04 tests.
- **Issue:** The first attempt at Test 5's bug-closure assertion used `targetEffScale = 4 / canonicalW ≈ 0.01058`, then computed `overridePct = (Math.ceil(0.01058 * 1000) / 1000) * 100` (≈ 1.1%). But `applyOverride(1.1, 1.0).effectiveScale = 0.011`; then `safeScale(0.011) = 0.011`; then `outW = ceil(378 × 0.011) = ceil(4.158) = 5`. The Round 5 ceil-thousandth rounding meant the 1.058% target couldn't survive the rounding chain to land at exactly 4.
- **Fix:** Pinned `overridePct = 1.0` (exactly 1%). Math chain becomes: `applyOverride(1.0, 1.0) = 0.010` → `safeScale(0.010) = 0.010` → `outW = ceil(378 × 0.010) = ceil(3.78) = 4`. ✓ Documented the math chain in the test comment so future readers see why exactly 1.0% is the load-bearing input.
- **Files modified:** `tests/core/export.spec.ts` (Test 5 input pinned + comment block expanded)
- **Committed in:** `2bea027` (Task 2)

### Deferred Issues

None — both tasks executed exactly as planned plus the calibration fix above.

## Phase 29 D-04 Bug Closure Verification

Synthetic regression test (`tests/core/export.spec.ts` Test 5) reproduces the exact failure mode from `.planning/debug/path-indirected-duplicate-rows.md`:

```typescript
// Path-indirected fixture — region '5/7' has 3 contributing attachments,
// all with peakScale=1.0 (full-canonical demand at the peak frame).
const summary = {
  peaks: [
    { attachmentName: '5/5/5/7/7', regionName: '5/7', peakScale: 1.0, canonicalW: 378, canonicalH: 428, sourcePath: '/fake/images/5/7.png', /* ... */ },
    { attachmentName: '5/5/7/7',   regionName: '5/7', peakScale: 1.0, canonicalW: 378, canonicalH: 428, sourcePath: '/fake/images/5/7.png', /* ... */ },
    { attachmentName: '5/7',       regionName: '5/7', peakScale: 1.0, canonicalW: 378, canonicalH: 428, sourcePath: '/fake/images/5/7.png', /* ... */ },
  ],
  // ...
};

// Post-flip: override is keyed by regionName.
const overrides = new Map<string, number>([['5/7', 1.0]]);  // 1% → 4×4 target
const plan = buildExportPlan(summary, overrides);
const allRows = [...plan.rows, ...plan.passthroughCopies];

expect(allRows.length).toBe(1);
expect(allRows[0].outW).toBe(4);  // ← was 378 pre-flip; now 4 ✓
expect(allRows[0].attachmentNames.sort()).toEqual(['5/5/5/7/7', '5/5/7/7', '5/7']);
```

Test 5b (the negative case) confirms the contract from the OPPOSITE direction: an unmigrated v1.3-era contributor key (e.g. `overrides.set('5/5/7/7', 1)`) does NOT bind under the post-flip read — `outW === sourceW` (passthrough). This matters because it means the migration step at the project-io.ts seam is the ONLY path that produces a valid export-binding regionName-keyed override; users who hand-edit a .stmproj cannot bypass migration without reaching the same outcome (the helper would handle their key on the next load).

Test 6 (SIMPLE_PROJECT backward-compat) confirms non-indirected fixtures produce unchanged output: `regionName === attachmentName === 'CIRCLE'` → `overrides.set('CIRCLE', 25)` produces `outW === ceil(699 × 0.2) === 140` exactly as it did pre-flip.

## .stmproj Schema-Version Lock Verification

```
$ grep -c 'version: 1' src/core/project-file.ts
1
```

`.stmproj` v1 schema unchanged — Phase 8 D-146 additive-only precedent preserved (Phase 21/22/28 also additive-only). The override field shape (`Record<string, number>`) is byte-identical; only the key semantics shift (attachmentName → regionName), which is invisible to validators / migrators / serializers.

## Layer 3 Invariant Spot-Checks

```
$ grep -rn "from 'sharp'\|from 'electron'\|from 'react'" src/core/export.ts
(no output — Layer 3 clean)

$ grep -rn "from 'sharp'\|from 'electron'" src/main/override-migration.ts
(no output — pure-TS; only `import type { SkeletonSummary } from '../shared/types.js'`)
```

## Test Counts

- **Plan target:** 15 new tests (8 migration helper + 7 AppShell/export)
- **Actual:** 20 new tests (10 migration helper + 7 banner integration + 3 export regression)
- **Cumulative since 29-01:** 56 new tests across the phase (19 from 29-01 + 17 from 29-02 + 20 from 29-03)
- **Existing tests:** 840 → 860 passing post-Plan-29-03 (excluding 2 pre-existing fixture-missing failures inherited from prior phases: `tests/main/sampler-worker-girl.spec.ts` + `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`).

## Hand-Off Notes

### Plan 29-04 (Regression fixture + integration regression)

After this plan, the override pipeline speaks regionName end-to-end (UI surface from Plan 29-02 + storage from Plan 29-03 + migration from Plan 29-03). The synthetic Test 5 in `tests/core/export.spec.ts` proves the falsified bug closes at the unit level. Plan 29-04 should:

1. **Commit a stripped Chicken-Min fixture** under `fixtures/Chicken-Min/` (target <1MB committed). Per CONTEXT.md §specifics, Claude's Discretion picks the strip strategy (1×1 stubs vs 16×16 stubs vs JSON+atlas-only). The fixture must preserve the path-indirected attachment names (`5/5/5/7/7`, `5/5/7/7`, `5/7`, etc.) and matching `path` field references; PNG content does not.
2. **Add an integration-level regression test** at `tests/core/path-indirection-integration.spec.ts` (or similar) that runs `loadSkeleton + sampleSkeleton + analyze + buildSummary + buildExportPlan` end-to-end against the Chicken-Min fixture. Assert the same outW=4 result as Test 5 here.
3. **Reproduce the human-UAT scenario** at the unit level: an integration test that opens a v1.3-era saved .stmproj (with attachmentName-keyed overrides) against a path-indirected fixture, confirms the migration banner surfaces, the override migrates to regionName, and a subsequent buildExportPlan produces the user-intended dims.

### Atomicity gate

Per the Plan 29-02 hand-off: the intermediate state between Wave 2 (panel reads by regionName) and Wave 3 (Map keyed by regionName + migration helper) is transient. With this plan landed, the atomicity gate at `/gsd-verify-work 29` can release the milestone. **No release tag, no ship-to-tester build, and no end-user-facing artifact may be cut between the Plan 29-02 close-out commit and this Plan 29-03 close-out commit.** This plan's final metadata commit (with SUMMARY.md) is the close-out point.

### Pre-existing Issues (out of scope; out-of-scope-discovery)

- `tests/main/sampler-worker-girl.spec.ts` + `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — gitignored fixtures unavailable in worktree mode (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/`); pre-existing infrastructure-only failures (documented in 29-01 + 29-02 SUMMARYs).

## Self-Check: PASSED

- [x] `src/main/override-migration.ts` exists; contains `export function migrateOverrides` (1 occurrence) — VERIFIED via `grep -c`.
- [x] `src/main/project-io.ts` contains `migrateOverrides(` (3 occurrences — one per load seam) and 0 functional `presentNames = new Set` (the helper replaced all three loops) — VERIFIED.
- [x] `src/main/override-migration.ts` contains `attachmentToRegion` (4 hits) + `presentRegions` (3 hits) — VERIFIED.
- [x] `src/main/project-io.ts` contains `migratedKeyCount` (7 hits — helper destructure × 3 + literal field × 3 + comment) — VERIFIED.
- [x] `src/shared/types.ts` contains `migratedKeyCount: number` (1 occurrence on MaterializedProject) — VERIFIED.
- [x] `src/renderer/src/components/AppShell.tsx` contains `overrideMigrationNotice` (11 hits — state, setter, useState init, 5 setOverrideMigrationNotice call sites at re-mount paths, JSX gate, dismiss handler, banner copy) — VERIFIED.
- [x] `src/renderer/src/components/AppShell.tsx` contains 0 functional `overrides.get(row.attachmentName)` — VERIFIED via `grep -c` (0 hits).
- [x] `src/core/export.ts` contains `overrides.get(overrideKey)` (1 hit) where `overrideKey = row.regionName ?? row.attachmentName` (1 hit) — VERIFIED.
- [x] `src/core/export.ts` contains 0 `overrides.get(row.attachmentName)` and 0 `overrides.get(.attachmentName)` variants — VERIFIED.
- [x] `src/renderer/src/lib/export-view.ts` mirrors core change byte-identically (parity gate in tests/core/export.spec.ts) — VERIFIED.
- [x] Layer 3 invariant: `grep -rn "from 'sharp'\|from 'electron'\|from 'react'" src/core/export.ts` returns 0 hits — VERIFIED.
- [x] `.stmproj` schema-version 1 lock: `grep -c 'version: 1' src/core/project-file.ts` returns 1 — VERIFIED.
- [x] AnimationBreakdownPanel.tsx has ZERO file-touch in this plan's diff (`git diff --stat 2696697..HEAD -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns empty) — VERIFIED.
- [x] Commit `07c0ef9` (Task 1) exists in git log — VERIFIED.
- [x] Commit `2bea027` (Task 2) exists in git log — VERIFIED.
- [x] `tests/main/override-migration.spec.ts` exists with 10 tests, all passing — VERIFIED.
- [x] `tests/renderer/override-migration-banner.spec.tsx` exists with 7 tests, all passing — VERIFIED.
- [x] `tests/core/export.spec.ts` extended with 3 new D-04 tests, all passing — VERIFIED.
- [x] Full vitest run (excluding 2 pre-existing fixture-missing failures): 860/874 passing — VERIFIED.
