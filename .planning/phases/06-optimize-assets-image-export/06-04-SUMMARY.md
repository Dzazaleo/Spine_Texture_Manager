---
phase: 06-optimize-assets-image-export
plan: 04
subsystem: main-process-image-worker
tags: [sharp, lanczos3, atomic-write, layer-3-arch-inverse, tdd, fs-promises]

# Dependency graph
requires:
  - phase: 01-electron-react-scaffold
    provides: D-10 LoadResponse-style typed-error envelope; handler-extraction discipline (handleSkeletonLoad pattern at src/main/ipc.ts:42-77)
  - phase: 06-optimize-assets-image-export (06-01)
    provides: sharp@^0.34.5 dep; tests/main/image-worker.spec.ts RED shell (6 cases); fixtures/EXPORT_PROJECT/images/CIRCLE.png; tests/arch.spec.ts core ↛ sharp/node:fs Layer 3 grep
  - phase: 06-optimize-assets-image-export (06-02)
    provides: ExportPlan / ExportRow / ExportProgressEvent / ExportError / ExportSummary types in src/shared/types.ts (lines 156-228)
provides:
  - "src/main/image-worker.ts: runExport(plan, outDir, onProgress, isCancelled): Promise<ExportSummary>"
  - "Layer 3 inverse: src/main/image-worker.ts is the ONLY file in src/ that imports sharp + node:fs/promises (verified by grep)"
  - "All 6 RED unit cases (a)-(f) GREEN against vi.mock'd sharp + node:fs/promises"
  - "1 real-bytes integration test in tests/main/image-worker.integration.spec.ts (no mocks; CIRCLE.png 699×699 → 350×350 round-trip)"
affects: [06-05-ipc-handlers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler-extraction discipline (Phase 1 D-10): runExport is a standalone async fn testable in vitest WITHOUT spinning up Electron — mirrors handleSkeletonLoad ↔ registerIpcHandlers split"
    - "Per-row try/catch with classification by THROW SITE (RESEARCH §Pitfall 7) — pre-flight throw → 'missing-source'; sharp chain throw → 'sharp-error'; mkdir/rename throw OR path-traversal reject OR NaN-dim reject → 'write-error'"
    - "Atomic write per D-121: write to <outPath>.tmp same-dir → fs.rename swap. Same-filesystem so rename stays atomic (RESEARCH §Pitfall 6)"
    - "Cooperative cancellation per D-115: isCancelled() check at top of every iteration; in-flight finishes naturally; summary.cancelled set from final isCancelled() check"
    - "Mock-restoration helper for vi.mock test files: vi.clearAllMocks doesn't reset .mockImplementation/.mockResolvedValue, so cross-test impl pollution must be repaired explicitly via .mockReset().mockResolvedValue(...) in beforeEach"

key-files:
  created:
    - "src/main/image-worker.ts (187 lines — runExport with 7 per-row phases + cooperative cancel + classified errors)"
    - "tests/main/image-worker.integration.spec.ts (89 lines — real-bytes end-to-end CIRCLE.png 699×699 → 350×350)"
  modified:
    - "tests/main/image-worker.spec.ts (Plan 06-01 RED shell now GREEN — added restoreDefaultMocks helper for cross-test mock-impl isolation; updated docblock + import comment)"

key-decisions:
  - "Path-traversal defense uses path.relative + checks for '..' prefix, isAbsolute, AND empty string (rel === '' = outPath equals outDir itself). Three-fold check rejects every escape mode the planner enumerated."
  - "NaN/zero-dim guard runs BEFORE mkdir to fail fast. Defensive against future sampler regressions producing non-finite peakScale; emits 'write-error' (kind chosen because the failure is at the resolved-output-path layer)."
  - "summary.cancelled re-checks isCancelled() at end-of-loop instead of tracking a local flag, so the final state captures correctly even if the last iteration didn't reach the top-of-loop check."
  - "Integration test in SEPARATE file (tests/main/image-worker.integration.spec.ts) — vitest scopes vi.mock per-file; the plan recommended Option 1 over vi.doUnmock + dynamic re-import gymnastics. Cleaner separation: unit cases stay mock-heavy in image-worker.spec.ts, real-bytes proof lives in image-worker.integration.spec.ts."
  - "Integration test uses CIRCLE.png at its real 699×699 dims (the plan's example referenced 64×64 which doesn't match the Plan 06-01 fixture); resized to 350×350 (~half) at effectiveScale 0.5. Confirmed via sharp metadata pre-write."
  - "[Rule 3 - Blocking] Test pollution between cases: Plan 06-01's RED shell uses vi.clearAllMocks() in beforeEach which only clears call history — it does NOT reset .mockImplementation/.mockResolvedValue established by prior tests. So case (b)'s access-throws-on-img1 leaked into case (c) (causing case (c) to emit 'missing-source' on row 1 instead of 'sharp-error' on row 2), and case (c)'s sharp-throws-on-call-3 leaked into cases (d)+(e). Fix: added restoreDefaultMocks() helper that uses .mockReset().mockResolvedValue/mockImplementation per mock to fully restore the all-success baseline. Each case then sets its own targeted impl on top."

requirements-completed: [F8.2, F8.4, F8.5, N3.1]

# Metrics
duration: ~6min
completed: 2026-04-25
---

# Phase 6 Plan 04: Wave 3 Image-Worker Summary

**Implemented `src/main/image-worker.ts` exporting `runExport(plan, outDir, onProgress, isCancelled): Promise<ExportSummary>` — the only file in `src/` that imports `sharp` and `node:fs/promises` (Layer 3 inverse — CLAUDE.md rule #4 inverse: Phase 6 IS where PNGs decode). Per-row pipeline: `fs.access` pre-flight (D-112) → path-traversal defense → NaN/zero-dim guard → `fs.mkdir` → `sharp(src).resize(W,H,{kernel:'lanczos3',fit:'fill'}).png({compressionLevel:9}).toFile(<outPath>.tmp)` (F8.2 + N3.1) → `fs.rename(<outPath>.tmp, outPath)` atomic write (D-121) → emit `ExportProgressEvent` with absolute outPath (F8.5). Cooperative cancel between files (D-115); skip-on-error (D-116) classified by THROW SITE not error inspection (RESEARCH §Pitfall 7). Drove Plan 06-01's 6 RED unit cases (a)-(f) to GREEN via a `restoreDefaultMocks()` helper that repairs cross-test `vi.mock` impl pollution (Rule 3 blocking fix). Added one real-bytes integration test (`tests/main/image-worker.integration.spec.ts`) exercising the live sharp + node:fs/promises binding end-to-end against `fixtures/EXPORT_PROJECT/images/CIRCLE.png` resized 699×699 → 350×350. Test-suite delta: +7 passing tests; failure count unchanged (the remaining 9 fails are Plan 06-03/06-05 pre-existing RED specs).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-24T23:55:26Z (worktree spawn)
- **Tasks:** 2 (Task 1 implementation + Task 2 RED→GREEN test fix + integration test)
- **Commits:** 2 (1 feat + 1 test, both atomic)
- **Files modified:** 3 (2 created + 1 modified)

## Accomplishments

- **`src/main/image-worker.ts` (new, 187 lines)** — exports `runExport`. Implements all 7 per-row pipeline phases per CONTEXT.md D-110/D-111/D-112/D-113/D-114/D-115/D-116/D-121:
  1. `fs.access(R_OK)` pre-flight (D-112) → `'missing-source'` on throw without invoking sharp.
  2. Path-traversal defense via `path.resolve` + `path.relative` — rejects `..` prefix, `isAbsolute`, AND `rel === ''` (outDir-equals-outPath degenerate case) → `'write-error'`.
  3. NaN/zero-dim guard via `Number.isFinite` + `> 0` check — defensive against future sampler regressions producing non-finite peakScale → `'write-error'`.
  4. `fs.mkdir(parent, { recursive: true })` → `'write-error'` on throw.
  5. **F8.2 + N3.1 verbatim:** `sharp(src).resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 9 }).toFile(<outPath>.tmp)` → `'sharp-error'` on throw.
  6. **D-121 atomic write:** `fs.rename(<outPath>.tmp, outPath)` → `'write-error'` on throw. Same-filesystem so rename stays atomic (RESEARCH §Pitfall 6).
  7. Emit `ExportProgressEvent` with absolute outPath.
- **D-115 cooperative cancel:** `isCancelled()` check at top of every iteration; in-flight cannot abort mid-libvips. `summary.cancelled` re-checks `isCancelled()` at end-of-loop so the final state captures correctly even if the last iteration didn't reach the top-of-loop check.
- **D-116 skip-on-error:** every error path emits a progress event AND pushes into `errors[]` so the renderer's per-file checklist + the post-export summary surface match.
- **Performance.now timing:** copied verbatim from `src/main/ipc.ts:55-58` pattern; surfaces as `summary.durationMs`.
- **Layer 3 inverse intact:** verified by `grep -lE "from 'sharp'" src/ -r` → only `src/main/image-worker.ts`. Same for `node:fs/promises`. tests/arch.spec.ts (Plan 06-01) Layer 3 grep continues to show 9/9 PASS.
- **All 6 RED unit cases GREEN:** cases (a) all-success, (b) one missing source, (c) sharp throws on file 3 of 5, (d) cancel after file 2, (e) atomic write `<outPath>.tmp` → rename, (f) no internal re-entrancy guard.
- **1 real-bytes integration test GREEN:** CIRCLE.png 699×699 → 350×350; verified output is a valid PNG with correct dims + alpha preserved + no orphaned `.tmp` file.

## Task Commits

Each task was committed atomically with `--no-verify` per the parallel-execution contract:

1. **Task 1: Implement runExport sequential loop** — `29eb6fb` (feat). Creates `src/main/image-worker.ts` with the 7-phase per-row pipeline + cooperative cancel + classified errors. Note: 3 of 6 RED tests still failing at this commit due to pre-existing test pollution; Task 2 fixes them.
2. **Task 2: Drive image-worker.spec.ts RED→GREEN + add real-bytes integration** — `9d34d9d` (test). Adds `restoreDefaultMocks()` helper to repair cross-test `vi.mock` impl pollution (Rule 3 blocking fix); creates `tests/main/image-worker.integration.spec.ts` (real-bytes end-to-end via fixtures/EXPORT_PROJECT/images/CIRCLE.png).

## Files Created/Modified

### Created (2)
- `src/main/image-worker.ts` (187 lines) — `runExport` implementation. Imports: `sharp` (default), `access/mkdir/rename/constants` from `node:fs/promises`, `dirname/resolve/relative/isAbsolute` from `node:path`, type-only from `../shared/types.js`. Layer 3 inverse boundary: this is the ONLY file in `src/` that imports sharp + node:fs/promises.
- `tests/main/image-worker.integration.spec.ts` (89 lines) — real-bytes end-to-end test. No mocks. Sources `fixtures/EXPORT_PROJECT/images/CIRCLE.png` (699×699), resizes to 350×350 (~half) at `effectiveScale: 0.5`, writes to `mkdtempSync` outDir, verifies output PNG via `sharp(outPath).metadata()` (format, width, height, hasAlpha) + summary contract + progress event contract + D-121 no-orphan-tmp check.

### Modified (1)
- `tests/main/image-worker.spec.ts` — added `restoreDefaultMocks()` async helper called in `beforeEach` to defeat cross-test `vi.mock` impl pollution. Updated file-top docblock from "Wave 0 RED" to "Wave 3 GREEN" + the `runExport` import-line comment.

## Decisions Made

- **Path-traversal defense uses three-fold check** (`..` prefix OR `isAbsolute` OR empty-string rel) — covers escape via `..`, escape via absolute path embedded in outPath, AND the degenerate case where `outPath` resolves to `outDir` itself.
- **NaN/zero-dim guard runs BEFORE mkdir** to fail fast. Defensive against future sampler regressions producing non-finite peakScale; emits `'write-error'` (kind chosen because the failure is at the resolved-output-path layer, not at sharp/source level).
- **`summary.cancelled` re-checks `isCancelled()` at end-of-loop** instead of tracking a local flag, so the final state captures correctly even if the last iteration didn't reach the top-of-loop check.
- **Integration test in SEPARATE file** (`tests/main/image-worker.integration.spec.ts`) — vitest scopes `vi.mock` per-file; the plan recommended Option 1 over vi.doUnmock + dynamic re-import gymnastics. Cleaner separation: unit cases stay mock-heavy in `image-worker.spec.ts`, real-bytes proof lives in `image-worker.integration.spec.ts`.
- **Integration test uses CIRCLE.png at its real 699×699 dims** — the plan's example referenced 64×64 which doesn't match the Plan 06-01 fixture; verified actual dims via `sharp().metadata()` pre-write. Resized to 350×350 (~half) at `effectiveScale 0.5`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added `restoreDefaultMocks()` helper to repair `vi.mock` impl pollution between unit-case tests**
- **Found during:** Task 2 (running cases (a)-(f) after Task 1 GREEN)
- **Issue:** The Plan 06-01 RED shell uses `vi.clearAllMocks()` in `beforeEach` which only clears call history — it does NOT reset `.mockImplementation()` / `.mockResolvedValue()` established by prior tests. Confirmed via a 2-test reproducer: case (b) sets `accessMock.mockImplementation((p) => { if endsWith('img1.png') throw })` then case (c) starts with that impl still active, causing case (c) to emit `'missing-source'` on row 1 instead of `'sharp-error'` on row 2 (the test's intended scenario). Same root cause for case (d) (cancel test) where case (c)'s sharp-throws-on-call-3 impl was still in place, breaking the call-count math. All 3 cases (c)/(d)/(e) failed when the file ran end-to-end but PASSED in isolation (`-t "case \(c\)"`), confirming the cross-test pollution diagnosis.
- **Fix:** Added `restoreDefaultMocks()` async helper that uses `.mockReset().mockResolvedValue/mockImplementation` per mock to fully restore the all-success baseline. Called from `beforeEach` after `vi.clearAllMocks()`. Each case then sets its own targeted impl on top.
- **Files modified:** tests/main/image-worker.spec.ts (added helper + invoked it in beforeEach + small docblock updates)
- **Commit:** 9d34d9d (rolled into Task 2 since this is part of the RED→GREEN gate)
- **Why not a plan change:** The plan's `<action>` block for Task 2 includes "Write the bodies for cases (a)-(f) to match the behavior described" — the bodies WERE written in Plan 06-01 already; Plan 06-04 Task 2's actual job was to make them GREEN. The mock-restoration helper is the minimal surgical fix to achieve GREEN without rewriting all 6 case bodies.

**2. [Documentation alignment] Integration test uses CIRCLE.png at real 699×699 dims, not the plan's example 64×64**
- **Issue:** Plan 06-04 Task 2 `<action>` example uses `sourceW: 64, sourceH: 64, outW: 32, outH: 32` for the integration test, but the Plan 06-01 fixture (`fixtures/EXPORT_PROJECT/images/CIRCLE.png`) is 699×699 (verified via `sharp().metadata()`). The plan acknowledges this in its NOTE: "If those values differ from 64×64 in the actual fixture, adjust the test's source/out W×H accordingly."
- **Fix:** Used `sourceW: 699, sourceH: 699, outW: 350, outH: 350, effectiveScale: 0.5` — half-size resize that still proves sharp actually transformed the bytes.
- **Why:** The plan explicitly delegates this dim-correction to the implementer; this is a documentation alignment, not a behavioral deviation.

## Issues Encountered

- **None substantive** beyond the Rule 3 mock-pollution fix above (which the plan implicitly required to satisfy "drive cases (a)-(f) to GREEN").

## Test Suite State

- **Before this plan** (per Plan 06-02 SUMMARY): **137 passed | 1 skipped | 9 failed** across 13 spec files.
- **After this plan:** **144 passed | 1 skipped | 9 failed** across 14 spec files.
  - **+7 passing tests:** 6 unit cases + 1 integration test (all in tests/main/image-worker*.spec.ts).
  - **+1 spec file:** tests/main/image-worker.integration.spec.ts (new).
  - **Failure count UNCHANGED.** The 9 failures are pre-existing Plan 06-01 RED specs awaiting parallel-wave Plan 06-03 (`tests/core/export.spec.ts` — 1 failed suite import) and future-wave Plan 06-05 (`tests/main/ipc-export.spec.ts` — 8 failed it() blocks for `handleStartExport` + `handlePickOutputDirectory`). Neither is Plan 06-04's territory.
- **RED-spec advancement (success criterion gate):**
  - `tests/main/image-worker.spec.ts` cases (a)-(f) — **6/6 GREEN** (was: import-error RED in Plan 06-01; 3/6 leaking-mock RED at Task 1 commit; **6/6 GREEN at Task 2 commit**).
  - `tests/main/image-worker.integration.spec.ts` — **1/1 GREEN** (new).
- **Phase-gate sanity** (verified post-Task 2):
  - `npm run test -- tests/arch.spec.ts` → **9/9 PASS** (Layer 3 src/core ↛ sharp/node:fs grep + all other arch invariants intact)
  - `git diff --exit-code scripts/cli.ts` → empty (Phase 5 D-102 byte-for-byte CLI lock preserved)
  - `git diff --exit-code src/core/sampler.ts` → empty (CLAUDE.md fact #3 sampler lock preserved)
  - `grep -lE "from 'sharp'" src/ -r` → only `src/main/image-worker.ts`
  - `grep -lE "from 'node:fs/promises'" src/ -r` → only `src/main/image-worker.ts`

## TDD Gate Compliance

Plan 06-04 has `tdd="true"` on both tasks. The required RED → GREEN gate sequence:

- **Plan-level:** Plan 06-01 landed the RED shell tests (`tests/main/image-worker.spec.ts`) at commit `39ab450 test(06-01)`. That commit is the file-level RED gate. The Plan 06-04 GREEN gate is `29eb6fb feat(06-04): implement runExport ...` — verified via `git log --oneline d130cf8..HEAD` showing test commit precedes feat commit at the plan-level (06-01 → 06-04).
- **Task 1:** GREEN against the RED shell from Plan 06-01. The implementation commit (`29eb6fb feat(06-04)`) lands `src/main/image-worker.ts`; running tests at this point shows 3/6 cases GREEN against the leaking-mock test pollution, but the IMPLEMENTATION is correct (verified via the per-test-isolation runs — case (c) PASSES in isolation).
- **Task 2:** GREEN gate completion. The test commit (`9d34d9d test(06-04)`) repairs the test pollution (Rule 3) + adds the real-bytes integration test. After this commit, all 7 image-worker tests are GREEN.

No REFACTOR commits were needed (the implementation diff was minimal and stayed clean; no opportunities to dedup at this scale).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 06-05 (src/main/ipc.ts handlers + preload + AppShell):** ready. The `runExport(plan, outDir, onProgress, isCancelled)` signature is locked. `handleStartExport` (Plan 06-05) wraps it with the IPC envelope: validates `plan` shape + `outDir` (rejects when `outDir` equals source images dir per F8.4 + D-122), flips an internal `exportInFlight` re-entrancy flag (D-115 / RESEARCH §Pitfall 12), passes `(e) => evt.sender.send('export:progress', e)` as the onProgress callback, returns `{ ok: true, summary }` or `{ ok: false, error: { kind: 'already-running' | 'invalid-out-dir' | 'Unknown' } }` per the LoadResponse envelope mirror (D-10). The 8 RED `tests/main/ipc-export.spec.ts` cases drive all of this.
- **Plan 06-06 (renderer modal + AppShell button):** ready. The Api interface in `src/shared/types.ts` already declares `pickOutputDirectory / startExport / cancelExport / onExportProgress / openOutputFolder` (Plan 06-02), with NOT_YET_WIRED preload stubs that Plan 06-05 swaps for real bridges.

## Confirmation: Plan 06-04 Success Criteria

- [x] `src/main/image-worker.ts` exists, exports `runExport`, imports sharp + node:fs/promises + node:path (verified)
- [x] All 7 per-row pipeline phases present: pre-flight, path-traversal, NaN guard, mkdir, sharp resize, atomic rename, success emit (verified via grep + code review)
- [x] Per-file errors classified by THROW SITE into the 3 ExportError kinds (`'missing-source' | 'sharp-error' | 'write-error'` — all 3 grep-confirmed at 16 occurrences in image-worker.ts)
- [x] Cooperative cancel: `isCancelled()` check at top of each iteration; loop bails between files (verified via case (d) GREEN)
- [x] `tests/main/image-worker.spec.ts` cases (a)-(f) GREEN with mocked sharp + node:fs/promises (6/6 PASS)
- [x] `tests/main/image-worker.integration.spec.ts` GREEN — real CIRCLE.png 699×699 → 350×350 output is a valid PNG with correct dims (1/1 PASS)
- [x] `npm run test -- tests/arch.spec.ts` → 9/9 PASS (Layer 3 invariants both directions intact: renderer ↛ core AND core ↛ sharp/fs; main IS allowed)
- [x] `git diff --exit-code scripts/cli.ts` empty
- [x] `git diff --exit-code src/core/sampler.ts` empty
- [x] `from 'sharp'` appears ONLY in `src/main/image-worker.ts` across the whole src/ tree (grep-verified)
- [x] `from 'node:fs/promises'` appears ONLY in `src/main/image-worker.ts` (grep-verified)

## Self-Check: PASSED

Files exist (verified via `test -f`):
- FOUND: src/main/image-worker.ts
- FOUND: tests/main/image-worker.spec.ts (modified)
- FOUND: tests/main/image-worker.integration.spec.ts

Commits exist (verified via `git log --oneline d130cf8..HEAD`):
- FOUND: 29eb6fb feat(06-04): implement runExport sequential loop in src/main/image-worker.ts
- FOUND: 9d34d9d test(06-04): drive image-worker.spec.ts RED→GREEN + add real-bytes integration

Acceptance grep evidence:
- FOUND: `^export async function runExport` in src/main/image-worker.ts (1 occurrence)
- FOUND: `from 'sharp'` ONLY in src/main/image-worker.ts (sole occurrence in src/)
- FOUND: `from 'node:fs/promises'` ONLY in src/main/image-worker.ts (sole occurrence in src/)
- FOUND: `kernel: 'lanczos3'` (F8.2 verbatim) in src/main/image-worker.ts
- FOUND: `fit: 'fill'` (D-110 uniform-stretch) in src/main/image-worker.ts
- FOUND: `compressionLevel: 9` (N3.1) in src/main/image-worker.ts
- FOUND: `+ '.tmp'` (D-121 atomic-write tmp suffix) in src/main/image-worker.ts
- FOUND: all 3 error kinds (`'missing-source' | 'sharp-error' | 'write-error'`) in src/main/image-worker.ts
- FOUND: tests/main/image-worker.spec.ts → 6/6 GREEN
- FOUND: tests/main/image-worker.integration.spec.ts → 1/1 GREEN
- FOUND: tests/arch.spec.ts → 9/9 PASS

---
*Phase: 06-optimize-assets-image-export*
*Completed: 2026-04-25*
