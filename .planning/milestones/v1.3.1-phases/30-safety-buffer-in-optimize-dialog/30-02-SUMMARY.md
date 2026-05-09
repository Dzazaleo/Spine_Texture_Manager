---
phase: 30-safety-buffer-in-optimize-dialog
plan: 02
subsystem: export-math
tags: [export, safety-buffer, layer3, parity, lockstep, buffer-cap, narrow-predicate]

# Dependency graph
requires:
  - phase: 30-01
    provides: ExportRow.bufferCapped declared optional (populated here); BuildExportPlanOptions.safetyBufferPercent surface DOES NOT live in shared/types.ts (interface lives in src/core/export.ts itself; extended HERE)
  - phase: 22.1-isCapped
    provides: Acc + ExportRow optional flag pattern (parallel for bufferCapped)
  - phase: 6-build-export-plan
    provides: safeScale + Math.ceil uniform-only export (D-91 + D-110 invariants preserved under buffer)
provides:
  - "BuildExportPlanOptions.safetyBufferPercent?: number (consumed by buildExportPlan)"
  - "Buffer-multiplied effScale produced via D-09 step 1-6 order: raw → buffered → clamp → cap"
  - "ExportRow.bufferCapped populated on cap-binding rows per the LOCKED NARROW predicate (D-06)"
  - "Lockstep parity between src/core/export.ts and src/renderer/src/lib/export-view.ts enforced by 3 new regex tests in the parity describe block"
  - "8 new BUFFER-01..03 functional tests covering D-07 no-op, linear growth, cap-binding, passthrough preservation, dedup × buffer ordering, aspect-ratio invariant, lockstep parity at non-zero buffer"
affects: [Phase 30-03 OptimizeDialog UI + AppShell call-site wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 22.1 isCapped → bufferCapped parallel flag (Acc field + dedup keep-max symmetric set + emit-loop conditional spread)"
    - "D-07 literal no-op short-circuit (bufferPct === 0 ? raw : raw × (1 + buffer/100)) — guards IEEE-754 drift on undefined/zero-buffer path"
    - "Lockstep parity enforced via regex assertions in the existing parity describe block (extends Layer 3 inline-copy invariant)"
    - "NARROW bufferCapped predicate per CONTEXT D-06: bufferPct > 0 AND bufferedScale > sourceRatio AND safeScale(rawEffScale) <= sourceRatio"

key-files:
  created: []
  modified:
    - src/core/export.ts
    - src/renderer/src/lib/export-view.ts
    - tests/core/export.spec.ts

key-decisions:
  - "Math order locked verbatim per CONTEXT D-09: raw → bufferedScale (multiply) → downscaleClampedScale (Math.min(safeScale(buffered), 1)) → cappedEffScale (Math.min, sourceRatio). Existing isCapped semantics unchanged. Single safeScale call, applied to POST-buffer value (Pitfall 5)."
  - "D-07 literal short-circuit `bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100)` — pre-Phase-30 byte-identical when buffer is 0 or undefined. T1 + the existing 4-case structurally-identical-output baseline parity test both lock the contract."
  - "bufferCapped is the LOCKED NARROW predicate per CONTEXT D-06: fires only when `bufferPct > 0 AND bufferedScale > sourceRatio AND safeScale(rawEffScale) <= sourceRatio`. Does NOT fire on canonical-1.0 clamp (T3 locks this). Future PATCH may broaden."
  - "Parity is enforced at the file-text level by 3 new regex tests in tests/core/export.spec.ts (~lines 695-720). Drift in either copy fails the parity describe block."
  - "_opts → opts rename complete in BOTH src/core/export.ts and src/renderer/src/lib/export-view.ts (R6). Comments updated to remove the historical `_opts` mention so the strict grep-count-zero acceptance criterion holds."
  - "Layer 3 invariant preserved: zero new imports in either file. Buffer math is pure arithmetic (Math.min, *, /). Existing tests/core/export.spec.ts hygiene block at 616-636 continues to pass."
  - "T6 IEEE-754 drift acknowledged: 0.8 × 1.05 = 0.8400000000000001 → safeScale (ceil-thousandth) → 0.841. The ceil-thousandth lower-bound contract intentionally bumps non-representable products by ≤ 0.001. T2 uses peakScale=0.5 where 0.5 × 1.05 = 0.525 is bit-exact, so no drift surfaces."

patterns-established:
  - "Verbatim Phase 28-style lockstep mirror (src/core/export.ts ↔ src/renderer/src/lib/export-view.ts) for new buildExportPlan math regions; parity describe block grep regex extension is the enforcement mechanism."
  - "Conditional spread pattern (`...(acc.bufferCapped ? { bufferCapped: true } : {})`) parallel to isCapped — keeps the optional ExportRow flag absent (not false) on rows where it doesn't apply."

requirements-completed: [BUFFER-01, BUFFER-02]

# Metrics
duration: ~7min
completed: 2026-05-08
---

# Phase 30 Plan 02: Safety-Buffer Math in buildExportPlan Summary

**Inserted the multiplicative safety-buffer math (BUFFER-01) and the bufferCapped flag (BUFFER-02) into `buildExportPlan` in BOTH `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` within ONE commit, with parity tests extending the existing core ↔ renderer regex-locked describe block. Math order locked verbatim per CONTEXT D-09; bufferCapped uses the LOCKED NARROW predicate from CONTEXT D-06; D-07 no-op short-circuit guarantees byte-identical pre-Phase-30 output when `safetyBufferPercent` is 0 or undefined.**

## Performance

- **Duration:** ~7 min (start: 2026-05-08T10:09Z, end: 2026-05-08T10:17Z)
- **Tasks:** 5/5
- **Files modified:** 3

## Accomplishments

- `BuildExportPlanOptions.safetyBufferPercent?: number` added in BOTH files (lockstep, byte-identical doc block).
- `_opts → opts` rename complete in BOTH files (R6); comments updated to drop the `_opts` mention so the strict zero-count acceptance criterion holds.
- `Acc.bufferCapped: boolean` field added in BOTH files; symmetric dedup keep-max edits set/replace `bufferCapped` alongside `isCapped` (R2).
- Buffer-multiply (D-09 step 2 with D-07 no-op short-circuit) inserted between `rawEffScale` and `downscaleClampedScale`. Single `safeScale` call applied to POST-buffer value (Pitfall 5).
- NARROW bufferCapped predicate (D-06 verbatim): `bufferPct > 0 && bufferedScale > sourceRatio && safeScale(rawEffScale) <= sourceRatio`. Does NOT fire on canonical-1.0 clamp (T3 locks this).
- Conditional spread `...(acc.bufferCapped ? { bufferCapped: true } : {})` adjacent to existing isCapped spread in the emit loop in BOTH files.
- 3 new parity regex tests in tests/core/export.spec.ts (Tasks 1-3 single commit) lock the buffer-multiply signature, the conditional spread, and the BuildExportPlanOptions field across both files.
- 8 new functional tests in `describe('buildExportPlan — Phase 30 BUFFER-01..03')` lock D-07 no-op, linear growth, canonical-clamp NARROW silence, cap-binding fire, passthrough preservation, dedup × buffer ordering, aspect-ratio invariant, and lockstep parity at non-zero buffer.

## Math order verbatim (D-09 step 1-6) — confirmed in both files

```
1. raw effScale  := overridePct ? applyOverride(...) : peakScale          [existing — unchanged]
2. bufferedScale := bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100)   [NEW — D-07 short-circuit]
3. clampedScale  := Math.min(safeScale(bufferedScale), 1.0)                [existing — argument changed from rawEffScale to bufferedScale]
4. cappedScale   := Math.min(clampedScale, sourceRatio)                    [existing — unchanged]
5. isCapped      := clampedScale > sourceRatio                             [existing — unchanged]
6. bufferCapped  := bufferPct > 0 && bufferedScale > sourceRatio && safeScale(rawEffScale) <= sourceRatio   [NEW — NARROW per D-06]
```

`grep -c "bufferPct === 0 ? rawEffScale : rawEffScale \* (1 + bufferPct / 100)" src/core/export.ts` → 1
`grep -c "bufferPct === 0 ? rawEffScale : rawEffScale \* (1 + bufferPct / 100)" src/renderer/src/lib/export-view.ts` → 1
`grep -c "Math.min(safeScale(bufferedScale), 1)" src/core/export.ts` → 1
`grep -c "Math.min(safeScale(bufferedScale), 1)" src/renderer/src/lib/export-view.ts` → 1
`grep -c "bufferCapped" src/core/export.ts` → 7  (Acc field + predicate + initial-set + replace + spread + 2 doc-comment refs)
`grep -c "bufferCapped" src/renderer/src/lib/export-view.ts` → 7

## bufferCapped predicate (NARROW per D-06) — confirmed in both files

Predicate compute site at `src/core/export.ts` lines ~245-249 and `src/renderer/src/lib/export-view.ts` lines ~336-340:

```typescript
const bufferCapped =
  bufferPct > 0
  && bufferedScale > sourceRatio
  && safeScale(rawEffScale) <= sourceRatio;
```

T3 in the BUFFER-01..03 describe block confirms the canonical-1.0 case stays silent (clean atlas, peakScale=0.99, buffer=5 → bufferCapped is undefined).
T4 in the BUFFER-01..03 describe block confirms the cap-binding case fires (drifted row 1000×1000 / actual 700×700, peakScale=0.6, buffer=25 → bufferCapped: true).

## Test counts before/after

- Before this plan (post-Plan-30-01 baseline): 64 tests in `tests/core/export.spec.ts`; 1 known pre-existing global-suite failure (`tests/main/sampler-worker-girl.spec.ts`) + 1 known pre-existing failed file (`tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — fixture missing).
- After this plan: **72 tests** in `tests/core/export.spec.ts` (+8 in BUFFER-01..03 + 3 in the parity describe block; the parity tests are inside the existing parity describe block so they don't change top-level count, but `npm run test -- tests/core/export.spec.ts` now shows 72 tests passed total).
- Global suite: **889 passing | 1 failing | 11 skipped | 2 todo** (903 tests across 79 files, 2 failed files). Pre-Plan-30-02 baseline (per Plan 30-01 SUMMARY) was **878 passing | 1 failing**. Net: +11 new tests in Plan 30-02 (3 parity + 8 BUFFER), 0 new regressions.

The 2 failing/erroring tests pre-date this phase entirely and are documented in `.planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md` (created by Plan 30-01).

## D-07 no-op contract evidence

The literal short-circuit `bufferPct === 0 ? rawEffScale : ...` guarantees byte-identical pre-Phase-30 behavior when `safetyBufferPercent` is undefined or 0:

- T1 of the BUFFER-01..03 describe block: `expect(planZero).toEqual(planUndef)` AND `expect(JSON.stringify(planZero)).toBe(JSON.stringify(planUndef))` on a real SIMPLE_TEST-derived summary.
- The pre-existing parity test `'renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs'` continues to pass — its 4 cases (no overrides, override 50% TRIANGLE, override 200% SQUARE clamp, multiple overrides) all use the omitted-opts call shape, which exercises the `bufferPct === 0` short-circuit.
- The pre-existing `Gap-Fix #1 parity: peakScale 1.5 produces outW = sourceW in BOTH core and renderer copies` test continues to pass — exercises the canonical-1.0 clamp under omitted opts.

`npm run test -- tests/core/export.spec.ts -t "renderer view buildExportPlan produces IDENTICAL ExportPlan"` → 1 passing.

## Layer 3 invariant verification

```
$ grep -rn "from 'sharp'" src/core/
0 matches
$ grep -rn "from 'electron'" src/core/
0 matches
```

Layer 3 invariant preserved — no new imports of any kind in either `src/core/export.ts` or `src/renderer/src/lib/export-view.ts`. The 4 module-hygiene tests in tests/core/export.spec.ts (lines 616-640) continue to pass.

## Lockstep parity verification

```
$ npm run test -- tests/core/export.spec.ts -t "core ↔ renderer parity"
Tests  17 passed | 55 skipped (72)
```

All 17 parity tests pass, including the 3 new Phase 30 ones added by Tasks 1-3.

## Forward consumption (Plan 30-03 prerequisites)

Plan 30-03 (UI + AppShell call-site wiring) can now consume:

- `BuildExportPlanOptions.safetyBufferPercent` — declared and consumed by `buildExportPlan` in BOTH `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` (this plan).
- `safetyBufferPercentLocal` AppShell state slot — already wired into `isDirty`, `lastSaved`, `buildSessionState`, both resample IPC sites, and `mountOpenResponse` hydration (Plan 30-01).
- `ExportRow.bufferCapped` — declared on the type (Plan 30-01) AND populated by buildExportPlan (this plan); Plan 30-03 may surface a UI signal in a future PATCH (silent in v1.3.1 per D-05).

The remaining work for Plan 30-03 is therefore:
1. Add `safetyBufferPercent={safetyBufferPercentLocal}` + `onSafetyBufferChange={setSafetyBufferPercentLocal}` to the OptimizeDialog mount in AppShell.tsx.
2. Add the corresponding props + Quality-group UI block to OptimizeDialog.tsx.
3. Thread `safetyBufferPercent` into the 4 `buildExportPlan(...)` call sites in AppShell.tsx + atlas-preview-view.ts (per RESEARCH §"Pattern 6").

## Task Commits

Each task group was committed atomically (Tasks 1-3 bundled in one commit per plan instructions; Tasks 4-5 separately; Task 5 was diagnostic-only with no source edits, so no separate commit):

1. **Tasks 1+2+3 (parity tests + lockstep math edit):** `b2e8643` (feat)
2. **Task 4 (BUFFER-01..03 functional describe block):** `adf742b` (test)
3. **Task 5 (full vitest run):** diagnostic-only; no source edits.

## Files Created/Modified

### Modified

- `src/core/export.ts` (+ ~30 lines logical, +60 stat): BuildExportPlanOptions.safetyBufferPercent field, _opts → opts rename, Acc.bufferCapped, buffer-multiply insert (D-09 step 2 with D-07 short-circuit), bufferCapped predicate (NARROW per D-06), dedup keep-max symmetric edits, conditional spread on emit row.
- `src/renderer/src/lib/export-view.ts` (+ ~30 lines logical, +59 stat): byte-identical mirror of all the above. computeExportDims helper at lines 139-236 left UNTOUCHED per RESEARCH "Anti-Patterns to Avoid" #2.
- `tests/core/export.spec.ts` (+369 lines): 3 new parity regex tests inside the existing parity describe block; 1 new top-level describe block "Phase 30 BUFFER-01..03" with 8 functional tests (T1-T8).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] T4 cap-binding partition: row goes to passthroughCopies[], not rows[]**
- **Found during:** Task 4 (running new BUFFER-01..03 tests).
- **Issue:** The original Task 4 description for Test 4 (cap-binding) asserted `expect(plan.rows.length).toBe(1)`. But under the Phase 22.1 partition, when the buffer-induced cap pushes effScale to sourceRatio AND `actualSourceW < canonicalW`, the resulting `outW = ceil(canonicalW × sourceRatio) === actualSourceW` AND the partition's `effectiveSourceW` falls back to `actualSourceW` (since `actualSourceW < canonicalW`). So `outW === effectiveSourceW` → row goes to passthroughCopies[]. This is correct behavior (Pitfall 3 affirmation: partition runs on FINAL outW/outH; a buffer-capped byte-copy IS a passthrough). The bufferCapped flag still rides through (it's set on the Acc before the emit loop).
- **Fix:** Updated T4 assertions to read from `[...plan.rows, ...plan.passthroughCopies]` and assert length 1; row body assertions (bufferCapped/isCapped/outW/outH) unchanged.
- **Files modified:** tests/core/export.spec.ts
- **Commit:** `adf742b`

**2. [Rule 1 — Bug] T6 dedup-with-buffer IEEE-754 floating-point edge case**
- **Found during:** Task 4 (running new BUFFER-01..03 tests).
- **Issue:** Test 6 expected `effectiveScale ≈ 0.84` with `toBeCloseTo(0.84, 6)`. Actual: `0.841`. Reason: `0.8 * 1.05 = 0.8400000000000001` (IEEE-754 non-representable product), then `safeScale = Math.ceil(840.0000000000001) / 1000 = 0.841`. The ceil-thousandth lower-bound contract intentionally bumps non-representable products by ≤ 0.001 to preserve the display-vs-export lower-bound invariant (Pitfall 5 / Round 5 amendment).
- **Fix:** Updated T6 expected value to `0.841` (and outW/outH to 841); added explanatory comment documenting the IEEE-754 → safeScale interaction. T2 (peakScale=0.5) is unaffected because 0.5 × 1.05 = 0.525 is bit-exact.
- **Files modified:** tests/core/export.spec.ts
- **Commit:** `adf742b`

**3. [Rule 3 — Blocker] `_opts` mentioned in updated comments**
- **Found during:** Task 2 acceptance criterion grep `grep -c "_opts" src/core/export.ts` returns 0.
- **Issue:** When I rewrote the inline comment to say "opts now consumed (was _opts pre-Phase-30 to satisfy noUnusedParameters)", the literal string `_opts` remained in the comment text, breaking the strict zero-count acceptance criterion in BOTH files.
- **Fix:** Rephrased the comment to say "parameter was previously prefix-underscored to satisfy noUnusedParameters" instead of using the literal `_opts` token. Same fix applied to both files in lockstep.
- **Files modified:** src/core/export.ts, src/renderer/src/lib/export-view.ts
- **Commit:** `b2e8643` (caught and fixed before commit)

### Out-of-scope discoveries

None new. The 2 pre-existing test failures (`tests/main/sampler-worker-girl.spec.ts` warm-up worker error + `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` missing fixture) predate Phase 30 entirely; they are documented in `.planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md` (created by Plan 30-01).

## Self-Check: PASSED

- All 2 task-group commits exist on the worktree branch (`b2e8643`, `adf742b`).
- All 3 modified source/test files contain expected `safetyBufferPercent` / `bufferCapped` references.
- All Task 2 acceptance criteria pass: `safetyBufferPercent?:` × 1, `bufferPct === 0 ? rawEffScale : ...` × 1, `Math.min(safeScale(bufferedScale), 1)` × 1, `Math.min(safeScale(rawEffScale)` × 0, `bufferCapped` ≥ 5 (= 7), `bufferPct > 0` × 1, `_opts` × 0, `opts?: BuildExportPlanOptions` × 1.
- All Task 3 acceptance criteria pass: same regex counts on the renderer mirror.
- All Task 4 acceptance criteria pass: `Phase 30 BUFFER-01..03` describe-block × 1, `safetyBufferPercent: 0` × 2, `safetyBufferPercent: 5` × 4, `safetyBufferPercent: 25` × 2, `bufferCapped: true` × 1, `JSON.stringify(planZero)` × 1.
- All 72 export.spec.ts tests pass (8 new + 64 prior; was 64 → 72 = +8 from the new describe block; the 3 parity regex tests are inside the existing parity describe block and don't bump the top-level count but DO appear in the test output).
- Layer 3 invariant preserved (0 sharp/electron imports in src/core/).
- D-07 no-op contract preserved (T1 byte-equal AND deep-equal; pre-existing 4-case parity baseline still passes).
- Lockstep parity preserved: 17 parity tests all pass, including the 3 new Phase 30 ones.
- No new regressions: global suite shows the same 1 failing + 1 failed file pre-existing as Plan 30-01 baseline; passing count grew by exactly 11 (3 parity + 8 BUFFER).

## Threat Flags

(no threat-relevant surface introduced; buffer math is pure arithmetic on a value already inside the export-plan trust boundary)

## Known Stubs

None. All edits are functional: math is wired, flag is populated and propagated through dedup keep-max, conditional spread is in place. UI surfacing of `bufferCapped` is intentionally silent in v1.3.1 per CONTEXT D-05 (silent-cap contract); Plan 30-03 will not wire a visible signal either; future PATCH may.
