---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 04
subsystem: renderer-mirror + main-process-export
tags: [typescript, parity-mirror, copyfile, passthrough, byte-copy, atomic-write, image-worker, dims-03, dims-04]

# Dependency graph
requires:
  - phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
    provides: "Plan 22-01 — DisplayRow.actualSourceW/H/canonicalW/H/dimsMismatch fields; ExportRow.actualSourceW?/actualSourceH? optional fields; ExportPlan.passthroughCopies: ExportRow[] field; placeholder body in export-view.ts (passthroughCopies: [])"
  - phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
    provides: "Plan 22-03 — canonical cap formula + passthrough partition + CHECKER FIX actualSource propagation in src/core/export.ts (the byte-identical mirror source)"
provides:
  - "src/renderer/src/lib/export-view.ts buildExportPlan body byte-identical to src/core/export.ts (Phase 6 D-110 parity contract): cap step (sourceRatio + cappedEffScale), Acc.isPassthrough propagation, D-04 REVISED predicate (isCapped || peakAlreadyAtOrBelowSource), emit-rows partition into rows[]+passthroughCopies[], CHECKER FIX actualSource conditional spread, totals.count = both arrays summed."
  - "computeExportDims signature extended with optional Phase-22 args: actualSourceW?, actualSourceH?, dimsMismatch? — back-compat for pre-22 4-arg call sites (sourceRatio = Infinity → cap inert). Panel callers (GlobalMaxRenderPanel + AnimationBreakdownPanel sibling-symmetric per Phase 19 D-06) now thread row.actualSourceW/H/dimsMismatch through, so Peak W×H column reflects cap math when drift is detected."
  - "src/main/image-worker.ts fs.promises.copyFile branch for plan.passthroughCopies rows: passthrough loop fires FIRST (absolute event index 0..N-1), resize loop fires next (index N..total-1) per RESEARCH Item #2 Option B single index space. Per-row pipeline: cancel check → access(R_OK) pre-flight → path-traversal defense → mkdir-recursive parent (R8 subfolder support) → copyFile to tmpPath → rename atomic (Phase 6 D-121 + R4 macOS delayed-allocation safety). Skips sharp resize pipeline entirely (D-03 byte-copy contract)."
  - "Layer 3 invariant preserved: fs.copyFile lives in src/main/image-worker.ts ONLY; zero hits in src/core/ for copyFile."
  - "8 new parity assertions in tests/core/export.spec.ts (3 regex + 2 behavioral fixtures + 3 computeExportDims cap-math tests). 7 new real-bytes tests in tests/main/image-worker.passthrough.spec.ts (byte-identical via Buffer.compare, R4 atomic-write, R8 subfolder, mixed-plan ordering, cooperative cancel, missing-source error propagation)."
affects: [22-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer parity mirror via byte-identical function body — comments and identifier names match character-for-character so the parity describe block's regex greps + behavioral toEqual fixtures gate any drift between the two copies."
    - "Single index space across two parallel ExportPlan arrays (passthroughCopies[] + rows[]): worker iterates passthroughCopies FIRST with absolute index 0..N-1, then rows with index N..total-1 (passthroughOffset = N). Single onProgress contract for IPC consumers, no per-array event split."
    - "Optional helper params with sentinel-default cap behavior — computeExportDims extended with three optional Phase-22 args; when omitted, sourceRatio defaults to Infinity (cap is inert), preserving back-compat for any pre-Phase-22 caller."
    - "Per-row try/catch + continue (NOT throw) for D-116 continuation: missing source / mkdir / copyFile / rename failures push to errors[] and proceed to next row, mirroring the resize loop's existing error discipline."

key-files:
  created:
    - "tests/main/image-worker.passthrough.spec.ts (242 lines, 7 real-bytes tests against fixtures/EXPORT_PROJECT/images/CIRCLE.png)"
  modified:
    - "src/renderer/src/lib/export-view.ts (cap formula + Acc.isPassthrough + emit-rows partition + CHECKER FIX actualSource spread mirrored byte-identically from src/core/export.ts; computeExportDims signature extended with 3 optional Phase-22 args)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (enrichWithEffective passes row.actualSourceW/H/dimsMismatch through computeExportDims)"
    - "src/renderer/src/panels/AnimationBreakdownPanel.tsx (enrichCardsWithEffective passes the same — sibling-symmetric per Phase 19 D-06)"
    - "src/main/image-worker.ts (copyFile import added; total now sums both arrays; passthrough loop inserted BEFORE resize loop with absolute index 0..N-1; resize loop counter renamed i→ri with passthroughOffset offset for absolute event indexing)"
    - "tests/core/export.spec.ts (+8 assertions in existing parity describe block: 3 regex + 2 behavioral fixtures + 3 computeExportDims cap-math tests; +148 lines)"

key-decisions:
  - "Mirrored byte-identically — every comment, identifier, variable name, and block ordering in the export-view.ts cap step matches src/core/export.ts character-for-character. The parity describe block's regex greps would fail otherwise; the behavioral toEqual fixtures would also fail. Passing both is the contract that locks the mirror."
  - "Single-index-space (Option B) over per-array index spaces (Option A) for IPC progress events. Cleaner consumer API: one onProgress contract, total = N+M, indices 0..total-1 in ordering passthroughCopies-first-then-rows. Matches the user mental model (fast byte-copies complete first, then long resizes)."
  - "Passthrough loop has NO atlas-extract fallback — drift detection (actualSource read from PNG header in Plan 22-02) requires the per-region PNG to exist on disk; otherwise dimsMismatch wouldn't have been set in the first place. Missing source on a passthrough row indicates corruption or programmer error — surface as 'missing-source' error and continue (D-116)."
  - "Resize loop counter rename i→ri (with `const i = passthroughOffset + ri`) over `let i = 0; let progressIndex = 0; for(...){ ... progressIndex++ }` because `i` is used in 6+ onProgress event sites and renaming once at the loop head + introducing a single `const i =` derivation keeps the diff minimal and the per-row body unchanged."
  - "Test missing-source error kind matches existing `'missing-source'` discriminator (image-worker.ts:161,171) — NOT a new `'access-error'` kind. Plan's <action> Step 5 said `'access-error|write-error'`; the existing union has `'missing-source'` for pre-flight access throws. Test adapted to match the existing union per plan's adaptation note."

patterns-established:
  - "Pattern: Renderer parity mirror — when the planner refactors the cap into a helper in one file (src/core/export.ts), refactor identically in the other (src/renderer/src/lib/export-view.ts). Failure to mirror surfaces in the parity describe block at tests/core/export.spec.ts. Comments must match character-for-character because the regex greps inspect the function body literally."
  - "Pattern: Single-index-space dual-array iteration — when an IPC plan has two parallel arrays of work units (e.g. passthroughCopies + rows), the worker iterates them sequentially in a chosen order with one shared progress contract: total = both summed; index = absolute position 0..total-1; offset = first-array length when iterating the second."

requirements-completed: [DIMS-03, DIMS-04]

# Metrics
duration: 30min
completed: 2026-05-02
---

# Phase 22 Plan 04: Renderer Mirror + Image-Worker Copy Branch Summary

**Renderer cap mirror (Phase 6 D-110 byte-identical parity contract) + image-worker fs.copyFile passthrough branch (D-03 byte-copy contract). Phase 6's renderer parity surface is preserved; the user now gets a complete `images/` output folder with passthrough rows preserving byte-for-byte fidelity (no double Lanczos).**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-02T23:08:00Z (worktree spawn)
- **Completed:** 2026-05-02T23:37:00Z
- **Tasks:** 2 (both TDD-flagged: RED → GREEN cycles)
- **Files created:** 1 (tests/main/image-worker.passthrough.spec.ts)
- **Files modified:** 5 (export-view.ts, GlobalMaxRenderPanel.tsx, AnimationBreakdownPanel.tsx, image-worker.ts, tests/core/export.spec.ts)
- **Commits:** 4 atomic (test RED + feat GREEN per task) + 1 metadata (this SUMMARY)

## Accomplishments

- **Phase 6 D-110 byte-identical parity contract preserved.** The cap step + partition body in `src/renderer/src/lib/export-view.ts` is now character-for-character identical to `src/core/export.ts`. The parity describe block at `tests/core/export.spec.ts:595-852` gates any drift via 3 regex greps (cap formula, partition declaration+push, isPassthrough predicate) + 2 behavioral fixtures (drifted-row + peakAlreadyAtOrBelowSource branch produce IDENTICAL toEqual passthroughCopies/rows/totals across both files).
- **`computeExportDims` signature extended with 3 optional Phase-22 args** (`actualSourceW`, `actualSourceH`, `dimsMismatch`) — back-compat for pre-Phase-22 4-arg call sites preserved (sourceRatio defaults to Infinity → cap inert). Both panel callers (Global + Animation Breakdown) now thread `row.actualSourceW/H/dimsMismatch` through, so the Peak W×H column reflects cap math when drift is detected. Without this, the panel would lie to the user about what the export will actually produce when the cap binds.
- **`src/main/image-worker.ts` fs.promises.copyFile branch landed (D-03).** Passthrough loop fires BEFORE resize loop with absolute event index 0..N-1; resize loop uses `passthroughOffset = plan.passthroughCopies.length` to compute its absolute index N..total-1. Per-row pipeline mirrors the resize loop's pre-flight + atomic-write discipline: overwrite guard → access(R_OK) → path-traversal defense → mkdir-recursive parent → copyFile to tmpPath → rename atomic. Skips sharp pipeline entirely.
- **R4 macOS delayed-allocation safety + R8 subfolder support proven.** tmpPath does NOT exist after copy completes (tested via `fs.existsSync`); AVATAR/FACE.png copy creates AVATAR/ subdirectory under outDir (tested via `fs.statSync.isDirectory`).
- **Byte-identical output proven via `Buffer.compare === 0`** — no Lanczos pipeline ran. If sharp.resize had executed (re-encoding the PNG even at 1.0× scale), the IDAT chunks would differ. Buffer.compare verifies the file passes through verbatim.
- **D-116 continuation invariant preserved on the passthrough loop.** Missing source PNG yields `'missing-source'` error and continues to the next row; subsequent rows still process. Verified via dedicated test fixture.
- **Layer 3 invariant preserved.** `grep -rn "copyFile" src/core/` returns 0 hits — the byte-copy primitive lives in `src/main/image-worker.ts` ONLY. The renderer cap-formula MIRROR is allowed because it's a renderer-side reproduction of pure math (no I/O, no DOM).
- **15 new tests across 2 files, all green:** 8 in `tests/core/export.spec.ts` parity describe block (regex + behavioral + computeExportDims) + 7 in `tests/main/image-worker.passthrough.spec.ts` (real-bytes against fixtures/EXPORT_PROJECT/images/CIRCLE.png).

## Task Commits

Each task was committed atomically per the TDD gate sequence:

1. **Task 1 RED gate: 8 failing parity assertions for renderer mirror + computeExportDims** — `86e2c61` (test)
2. **Task 1 GREEN gate: mirror DIMS-03 cap + DIMS-04 partition into export-view.ts; extend computeExportDims; panel callers updated** — `985dc7e` (feat)
3. **Task 2 RED gate: 7 failing image-worker passthrough byte-copy specs** — `22c2e7b` (test)
4. **Task 2 GREEN gate: fs.promises.copyFile branch in image-worker.ts (D-03)** — `61b2124` (feat)

**Plan metadata:** committed via SUMMARY.md (this file) — orchestrator handles STATE.md/ROADMAP.md updates after wave merge.

_TDD-flagged plan honored: each task committed RED tests BEFORE implementation. Task 1 RED commit had 6 of 8 new tests failing (the 2 regex assertions for the partition declaration would coincidentally match because the `passthroughCopies: []` placeholder existed pre-mirror; the cap-formula regex + behavioral toEqual + computeExportDims cap-math tests all failed). Task 2 RED commit had 7/7 failing. GREEN commits flip both task fronts entirely._

## Files Created/Modified

**Created:**

- `tests/main/image-worker.passthrough.spec.ts` (242 lines) — 7 real-bytes tests under `describe('image-worker — DIMS-04 passthrough byte-copy (Phase 22)')`. Mirrors the analog pattern in `tests/main/image-worker.integration.spec.ts` (sister real-bytes file for the resize path).

**Modified:**

- `src/renderer/src/lib/export-view.ts` (~80 lines added/changed) — three cohesive changes:
  1. `Acc` interface gains `isPassthrough: boolean` (mirrors core).
  2. Cap step inserted between `Math.min(safeScale(rawEffScale), 1)` and the dedup keep-max comparison: `sourceRatio` (uniform from min over both axes), `cappedEffScale`, `peakAlreadyAtOrBelowSource`, `isPassthrough` predicate, accumulator now stores all three.
  3. Emit-rows loop partitions into `rows[]` + `passthroughCopies[]`; CHECKER FIX conditional spread mirrors actualSourceW/H onto passthrough ExportRow entries; totals.count = `rows.length + passthroughCopies.length`.
  4. `computeExportDims` signature gains 3 optional Phase-22 args; back-compat preserved.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (single hunk) — `enrichWithEffective` passes `row.actualSourceW`, `row.actualSourceH`, `row.dimsMismatch` through to `computeExportDims`.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (single hunk) — `enrichCardsWithEffective` passes the same 3 fields. Sibling-symmetric per Phase 19 D-06.
- `src/main/image-worker.ts` (~145 lines added) — three cohesive changes:
  1. Import `copyFile` from `node:fs/promises` alongside existing `access/mkdir/rename`.
  2. `total = plan.passthroughCopies.length + plan.rows.length` (was `plan.rows.length` only).
  3. Passthrough loop inserted BEFORE the resize loop with absolute event index 0..N-1; resize loop counter renamed `i → ri` with `passthroughOffset + ri` for absolute event indexing.
- `tests/core/export.spec.ts` (~148 lines added at the END of the parity describe block, before its closing `});`) — 3 regex assertions (cap formula, partition decl+push, isPassthrough predicate) + 2 behavioral fixtures (drifted row + peakAlreadyAtOrBelowSource branch) + 3 `computeExportDims` cap-math assertions (cap surfaces correct outW/outH for binding-X-axis case, uncapped legacy formula when dimsMismatch:false, back-compat for pre-Phase-22 4-arg call shape).

## Decisions Made

- **Byte-identical mirror via verbatim copy** — the cap step + partition body in `src/renderer/src/lib/export-view.ts` was constructed by reading `src/core/export.ts` and reproducing the exact whitespace, comment characters, identifier names. The parity describe block's regex greps + behavioral toEqual fixtures both verify sameness. Comments must match character-for-character because the parity test inspects function-body literals via grep.
- **`computeExportDims` back-compat preserved.** All three new Phase-22 args are optional (`?`); when omitted, `sourceRatio` defaults to `Infinity` → cap is inert. Existing 4-arg call sites continue to behave identically. This avoids a forced cascade-update across every call site if any caller hadn't been refactored to thread the new fields.
- **Single-index-space (Option B) over per-array indices.** Cleaner consumer API: one `onProgress` contract, `total = N+M`, indices `0..total-1` in ordering passthroughCopies-first-then-rows. Matches the user mental model (fast byte-copies complete first; long Lanczos resizes follow). The IPC consumer (renderer progress UI) doesn't need to know about the partition — it sees one stream of events with monotonically-increasing index.
- **Passthrough loop has NO atlas-extract fallback.** Drift detection (Plan 22-02 `readPngDims` walk) requires the per-region PNG to exist on disk; otherwise `dimsMismatch` wouldn't have been set in the first place. Missing source on a passthrough row indicates filesystem corruption or programmer error — surface as `'missing-source'` error and continue (D-116). Atlas-extract fallback would be semantically wrong here (atlas pages may have different dims than the per-region PNG that drift was computed against).
- **Resize loop counter rename idiom.** Renamed `i → ri` and introduced `const i = passthroughOffset + ri;` immediately at the loop head, rather than introducing a separate progress counter (`let progressIndex = 0; ... progressIndex++`) or threading explicit `event.index` arithmetic into every onProgress call site. The chosen idiom keeps the per-row body untouched at 6+ onProgress emission sites — the absolute-index variable `i` reads the same as before from the body's perspective; only the outer `for` declaration changed.
- **Test error-kind discriminator matches existing union.** Plan's `<action>` Step 5 sketched `kind: 'access-error'`, but the existing `ExportError.kind` union (src/shared/types.ts:356) has `'missing-source'` for pre-flight access throws (image-worker.ts:161, 171). Plan's adaptation note explicitly said "Adapt the test details to whatever the existing image-worker.integration.spec.ts patterns dictate" — the test now asserts `kind: 'missing-source'`. No new error kind added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test error-kind discriminator corrected to match existing ExportError.kind union**

- **Found during:** Task 2 RED authoring (writing the missing-source test fixture)
- **Issue:** Plan `<action>` Step 5 said `expect(summary.errors[0].kind).toMatch(/access-error|write-error/);`. The existing `ExportError.kind` union (src/shared/types.ts:356) does NOT have `'access-error'`; the established kind for pre-flight access throws is `'missing-source'` (image-worker.ts:161 + 171). Adding a new kind would cascade through all error consumers and isn't warranted by Plan 22-04's scope.
- **Fix:** Test asserts `expect(summary.errors[0].kind).toBe('missing-source');`. Existing semantics preserved; no new ExportError variant introduced.
- **Files modified:** `tests/main/image-worker.passthrough.spec.ts` (Test 7 only).
- **Verification:** RED test failed as expected (errors empty pre-implementation); GREEN test passes (correct error surfaces with `kind: 'missing-source'`).
- **Justified by:** Plan's explicit "Adapt the test details to whatever the existing image-worker.integration.spec.ts patterns dictate" guidance.

**2. [Rule 2 - Critical functionality] Defense-in-depth overwrite guard added to passthrough loop**

- **Found during:** Task 2 GREEN implementation review against the resize loop's step 0
- **Issue:** Plan `<action>` Step 3 listed Step 1 (access pre-flight), Step 2 (path-traversal), Step 4 (mkdir), Step 5 (copyFile + rename) — but NOT Step 0 (overwrite guard). The resize loop has a `!allowOverwrite` block at lines 109-137 of image-worker.ts that rejects pre-existing files when `allowOverwrite=false`. Without parity, a user who clicks "Don't overwrite" in the renderer ConflictDialog could STILL silently overwrite passthrough rows if the path collided — breaking the Round 4 round-trip safety contract for drifted rows.
- **Fix:** Added the same `!allowOverwrite` overwrite guard to the passthrough loop step 0 (verbatim mirror of the resize loop's lines 109-137). Pre-existing files are rejected with `kind: 'overwrite-source'` when allowOverwrite is false; defense-in-depth parity preserved.
- **Files modified:** `src/main/image-worker.ts` (passthrough loop step 0).
- **Verification:** All 7 passthrough tests pass (none assert on this — none of the test fixtures pre-create the output file). Existing image-worker.spec.ts overwrite tests for the resize loop still pass (no regression). The guard is dormant in the test suite but live in production user flows.
- **Severity:** Critical — without it, Round 4 user-confirmed overwrite gating would have a silent passthrough leak. Rule 2 (auto-add missing critical functionality).

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — test fix matching existing API; 1 Rule 2 — adding missing critical defense parity)
**Impact on plan:** Both deviations are corrections that strengthen the implementation. No scope creep; both fall within Plan 22-04's stated boundaries (D-03 byte-copy contract, defense-in-depth round-trip safety). The passthrough loop now has full parity with the resize loop's pre-flight discipline + the copyFile + rename atomic-write substituted for the sharp pipeline.

## Issues Encountered

- **Pre-existing failing test (out of scope per scope-boundary rule):** `tests/main/sampler-worker-girl.spec.ts` continues to fail (`8000ms wall-time gate` exceeded by Girl fixture sampler run). Documented in 22-01 + 22-02 + 22-03 SUMMARYs as out-of-scope environment/timing issue. Not auto-fixed; not introduced by Plan 22-04. Verified pre-existing on the merged-in baseline before any Plan 22-04 changes.

## TDD Gate Compliance

Plan-level TDD gate sequence verified in git log (Plan-22-04 commits only):

1. **Task 1 RED commit:** `86e2c61` — `test(22-04): add failing parity assertions for renderer cap mirror + computeExportDims` ✓ (6/8 fail at this commit; 2 regex coincidentally matched the placeholder declaration)
2. **Task 1 GREEN commit:** `985dc7e` — `feat(22-04): mirror DIMS-03 cap + DIMS-04 passthrough partition into renderer export-view` ✓ (8/8 green at this commit)
3. **Task 2 RED commit:** `22c2e7b` — `test(22-04): add failing image-worker passthrough byte-copy specs` ✓ (7/7 fail at this commit)
4. **Task 2 GREEN commit:** `61b2124` — `feat(22-04): add fs.promises.copyFile branch to image-worker for plan.passthroughCopies (D-03)` ✓ (7/7 green at this commit)

RED → GREEN sequence intact for both tasks. No REFACTOR commit — implementation landed cleanly with no follow-up cleanup warranted.

## Self-Check

**Files claimed in this SUMMARY exist and contain the claimed contracts:**

- `src/renderer/src/lib/export-view.ts` — `sourceRatio` ✓ FOUND (12 hits); `passthroughCopies` ✓ FOUND (6 hits — declaration + push + sort + return + 2 docblock); `peakAlreadyAtOrBelowSource` ✓ FOUND (4 hits); cap formula `Math.min([^)]*actualSourceW\s*/\s*canonicalW` ✓ FOUND (1 match); `isPassthrough` ✓ FOUND.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — `row.actualSourceW` ✓ FOUND; `row.dimsMismatch` ✓ FOUND.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — `row.actualSourceW` ✓ FOUND; `row.dimsMismatch` ✓ FOUND.
- `src/main/image-worker.ts` — `copyFile` ✓ FOUND (4 hits — import + call + 2 docblock); `passthroughCopies` ✓ FOUND (6 hits).
- `src/core/` — `copyFile` zero hits ✓ (Layer 3 invariant preserved; verified via `grep -rn "copyFile" src/core/ | wc -l`).
- `tests/core/export.spec.ts` — 8 new assertions in parity describe block under "Phase 22 DIMS-03..." / "Phase 22 DIMS-04..." / "Phase 22 D-04 REVISED..." / "Phase 22 behavioral parity..." / "Phase 22 DIMS-03 computeExportDims..." `it()` titles.
- `tests/main/image-worker.passthrough.spec.ts` — NEW file ✓; 7 `it()` blocks under `describe('image-worker — DIMS-04 passthrough byte-copy (Phase 22)')`.

**Commits exist on branch:**

- `86e2c61` ✓ FOUND in `git log --oneline`.
- `985dc7e` ✓ FOUND in `git log --oneline`.
- `22c2e7b` ✓ FOUND in `git log --oneline`.
- `61b2124` ✓ FOUND in `git log --oneline`.

**Acceptance criteria from PLAN.md:**

- `grep -c "sourceRatio" src/renderer/src/lib/export-view.ts` ≥ 2: ✓ (12)
- `grep -c "passthroughCopies" src/renderer/src/lib/export-view.ts` ≥ 3: ✓ (6)
- `grep -c "peakAlreadyAtOrBelowSource" src/renderer/src/lib/export-view.ts` ≥ 1: ✓ (4)
- `grep -E "Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW" src/renderer/src/lib/export-view.ts` ≥ 1: ✓ (1)
- Parity behavioral test "Phase 22 behavioral parity: drifted row produces IDENTICAL passthroughCopies in both files" passes — toEqual matches between core and view plans: ✓
- Parity behavioral test for peakAlreadyAtOrBelowSource branch passes: ✓
- Three new parity regex assertions all pass: ✓
- All existing parity describe block tests STILL pass (no regression on Phase 6 D-110 contract): ✓ (8 baseline + 8 new = 16 total in describe block)
- GlobalMaxRenderPanel.tsx + AnimationBreakdownPanel.tsx call computeExportDims with new params (grep confirms `row.actualSourceW` + `row.dimsMismatch`): ✓
- `grep -c "copyFile" src/main/image-worker.ts` ≥ 2: ✓ (4)
- `grep -rn "copyFile" src/core/` returns 0 hits: ✓ (0)
- `tests/main/image-worker.passthrough.spec.ts` has at least 7 tests; all pass: ✓ (7/7 green)
- byte-identical assertion: `Buffer.compare(sourceBuf, outBuf) === 0` — proves no Lanczos ran: ✓
- R4 atomic-write test passes: tmpPath does NOT exist after copy: ✓
- R8 subfolder test passes: AVATAR/FACE.png correctly creates AVATAR/ subdir: ✓
- mixed-plan ordering test passes: passthrough events fire at index 0; resize at index 1: ✓
- `tests/main/image-worker.integration.spec.ts` continues to pass (no regression on existing main-process tests): ✓
- `tests/main/image-worker.spec.ts` continues to pass (mocked-unit pattern unchanged): ✓
- `npx tsc --noEmit` clean: ✓
- Full suite: 671 passed | 1 failed (pre-existing sampler-worker-girl.spec.ts; documented out-of-scope)

## Self-Check: PASSED

## Next Plan Readiness

- **Plan 22-05 (panels + modal + roundtrip)** — ready to start. The renderer mirror is byte-identical to core; computeExportDims surfaces cap math; image-worker writes passthrough rows via atomic copyFile with subfolder support. Plan 22-05 OptimizeDialog will read `row.actualSourceW ?? row.sourceW` to render the "already optimized" label with concrete on-disk dims (e.g. 811×962) — the CHECKER FIX propagation in 22-03's core mirror is now also live in the renderer copy. Round-trip integration test (DIMS-05) can drive against the real fs.copyFile path now that the worker branch exists.

---
*Phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21*
*Completed: 2026-05-02*
