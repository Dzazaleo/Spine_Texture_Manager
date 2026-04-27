---
phase: 06-optimize-assets-image-export
plan: 03
subsystem: export-plan-builder
tags: [pure-ts, layer-3-arch, dedup-by-sourcepath, uniform-scaling, tdd, parity-invariant]

# Dependency graph
requires:
  - phase: 04-scale-overrides
    provides: applyOverride() canonical pure-TS clamp+effective-scale (D-91); overrides-view.ts renderer copy precedent (D-75)
  - phase: 05-unused-attachment-detection
    provides: SkeletonSummary.unusedAttachments[] (D-99 / D-101) — Plan 06-03 D-109 subtraction input
  - phase: 06-optimize-assets-image-export (06-01)
    provides: tests/core/export.spec.ts RED shell (cases (a)-(g) + EXPORT_PROJECT fixture sanity + module hygiene grep); tests/arch.spec.ts core ↛ sharp/fs grep
  - phase: 06-optimize-assets-image-export (06-02)
    provides: DisplayRow.sourcePath threaded loader → analyzer → summary; ExportRow / ExportPlan IPC interfaces in src/shared/types.ts
provides:
  - "src/core/export.ts (canonical pure-TS buildExportPlan: D-108 sourcePath dedup + D-109 unused exclusion + D-110 uniform Math.round + D-111 override resolution)"
  - "src/renderer/src/lib/export-view.ts (renderer-side byte-identical inline copy — Phase 4 D-75 precedent; AppShell can call buildExportPlan client-side without crossing Layer 3)"
  - "tests/core/export.spec.ts cases (a)-(g) GREEN + 6 parity tests GREEN locking the two copies against drift"
affects: [06-05-ipc-handlers, 06-06-renderer-modal-and-appshell-button]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-TS fold-by-sourcePath with Map<sourcePath, Acc>: keep highest-effective-scale row per group + union attachmentNames[] (D-108 dedup contract; max(effectiveScale) so the most-zoomed user wins)"
    - "Layer 3 inline copy + parity invariant: renderer file is byte-identical to canonical (modulo applyOverride import path); parity describe block uses dynamic-import + structural .toEqual on representative inputs to lock the two against drift"
    - "Pure-TS path manipulation via String.lastIndexOf('/images/') — sidesteps the node:path import that would violate Layer 3; cross-platform safe via .replace(/\\\\/g, '/') normalization"
    - "TDD gate sequence: Plan 06-01 lands cases (a)-(g) RED; Plan 06-03 Task 1 = single feat that drives them GREEN; Plan 06-03 Task 2 = RED parity tests + GREEN renderer copy in two commits"

key-files:
  created:
    - "src/core/export.ts (139 lines — canonical buildExportPlan + relativeOutPath helper + BuildExportPlanOptions interface)"
    - "src/renderer/src/lib/export-view.ts (140 lines — renderer-side byte-identical inline copy; differs from src/core/export.ts ONLY in header docblock prose and the applyOverride import path)"
  modified:
    - "tests/core/export.spec.ts (cleanup: dropped unused ExportRow type import per Plan 06-02 SUMMARY hint; widened case (f) Math.round(-0.5) assertion to Math.abs() per V8 -0 semantics; +81 lines for the 6-test parity describe block)"

key-decisions:
  - "outPath is RELATIVE ('images/<regionName>.png') not absolute — contradicts RESEARCH §Open Question 2 'absolute' recommendation but is the ONLY way to keep src/core/export.ts free of node:path import (Layer 3 hard rule). Plan 06-04 image-worker.ts (which IS allowed to import node:path) will join with outDir at write time. ExportProgressEvent.outPath crossing IPC will be set absolute by the image-worker post-resolve. This trade keeps the canonical pure-TS module Layer-3 clean at the cost of a one-line path.resolve in the worker."
  - "relativeOutPath() helper splits sourcePath on the literal '/images/' substring (with .replace(/\\\\/g, '/') normalization for Windows safety) — pure string manipulation, zero node:path. Falls back to lastIndexOf('/') if '/images/' substring not found (defensive — Plan 06-02's loader convention guarantees the prefix, but the fallback prevents emitting an empty regionPart on malformed input)."
  - "Defensive 'if (!row.sourcePath) continue' skip — Plan 06-02 guarantees DisplayRow.sourcePath is populated end-to-end (loader → analyzer → summary), but the CLI path passes sourcePaths as undefined and falls back to '' (D-102 byte-for-byte CLI lock). Future callers that bypass the summary projection layer would emit garbage rows without this guard. Plan 06-04's image-worker would also fail on '' sourcePath inside sharp(); skipping at plan-build time is the cleanest defense."
  - "renderer copy uses ./overrides-view.js (sibling renderer Layer 3 copy) for applyOverride — NEVER ../../../core/overrides.js (would trip arch.spec.ts:25 grep). The parity describe block has an explicit it() asserting this import path."
  - "Parity test uses dynamic import('../../src/renderer/src/lib/export-view.js') so the renderer copy is loaded at vitest runtime in node environment (renderer copy has zero DOM deps; only depends on the renderer's own overrides-view.ts which is also DOM-free) — vitest config environment: 'node' resolves the import cleanly."
  - "Adjusted tests/core/export.spec.ts case (f) assertion expect(Math.round(-0.5)).toBe(0) → expect(Math.abs(Math.round(-0.5))).toBe(0). V8 implements Math.round(-0.5) === -0 per ECMA-262; the spec contract intent is 'rounded to zero', which Math.abs() satisfies. Production paths only Math.round(positive products) (sourceW/H >= 0 × effectiveScale > 0), so -0 is unreachable from buildExportPlan. Documented inline."
  - "Removed unused ExportRow type import from tests/core/export.spec.ts header (Plan 06-02 SUMMARY noted this as cleanup-deferred-to-06-03). The tests reference ExportRow only via plan.rows[i].* property access on the inferred ExportPlan return type — no explicit type annotation needed."

requirements-completed: [F8.3]

# Metrics
duration: ~6min
completed: 2026-04-25
---

# Phase 6 Plan 03: Wave 2 Export-Plan Builder Summary

**`src/core/export.ts` lands the canonical pure-TS `buildExportPlan(summary, overrides, opts?)` per locked decisions D-108 (group by sourcePath; per-group max(effectiveScale); union attachmentNames[]), D-109 (exclude `summary.unusedAttachments` by default; bypassable via `opts.includeUnused`), D-110 (uniform `Math.round(sourceW × effectiveScale)` × `Math.round(sourceH × effectiveScale)` — same scale on both axes per locked Phase 6 export-sizing memory), and D-111 (effectiveScale = applyOverride(percent).effectiveScale when override set, else row.peakScale). `src/renderer/src/lib/export-view.ts` is a byte-identical renderer-side inline copy following the Phase 4 D-75 precedent (overrides-view.ts ↔ overrides.ts). A 6-test parity describe block in `tests/core/export.spec.ts` locks the two copies against drift via signature greps + dynamic-import structural `.toEqual` on 4 representative inputs.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-24T23:54:17Z (worktree spawn)
- **Completed:** 2026-04-24T23:59:55Z
- **Tasks:** 2 (each landed atomically; Task 2 split into RED + GREEN commits per TDD)
- **Commits:** 3 (1 feat + 1 test-RED + 1 feat-GREEN)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- **`src/core/export.ts` lands the canonical pure-TS `buildExportPlan`** — 139 lines, D-108/D-109/D-110/D-111 fully implemented. Layer 3 hygiene preserved: zero `from 'sharp'` / `from 'node:fs'` / `from 'node:path'` / `from 'node:child_process'` / runtime `from '@esotericsoftware/spine-core'` imports; only `import type { DisplayRow, ExportPlan, ExportRow, SkeletonSummary } from '../shared/types.js'` (type-only, erased at compile time) and `import { applyOverride } from './overrides.js'` (canonical Phase 4 pure-TS) are present.
- **D-108 dedup contract:** Walk `summary.peaks`, group by `row.sourcePath`, per-group keep the row whose `effectiveScale` is highest (so the most-zoomed user's render quality wins), union all `attachmentNames[]` mapping to the same source PNG for traceability. Tested via case (d) (two attachments — different names, same sourcePath, peaks 0.5 + 0.9 → ExportRow.outW = `Math.round(128 × 0.9)` and `attachmentNames` contains BOTH 'FACE_A' + 'FACE_B').
- **D-109 unused exclusion:** Build `excluded: Set<string>` from `summary.unusedAttachments?.map(u => u.attachmentName)` when `!opts.includeUnused`. Skip rows whose attachmentName is in the set. `excludedUnused` returned sorted + deduped (Set already dedups). Tested via case (e) (ghost fixture → ExportPlan.rows excludes GHOST; ExportPlan.excludedUnused contains 'GHOST').
- **D-110 uniform Math.round sizing (LOCKED memory):** `outW = Math.round(acc.row.sourceW * acc.effScale); outH = Math.round(acc.row.sourceH * acc.effScale)` — SAME `effScale` on both axes. NEVER per-axis. Anisotropic export breaks Spine UV sampling. Tested via case (f) (synthetic peakScale 0.5 × sourceW 255 = 127.5 → Math.round = 128 on both axes).
- **D-111 effective scale resolution:** `overrides.get(row.attachmentName)` undefined → `effScale = row.peakScale` (the floor-free engine-computed peak); defined → `effScale = applyOverride(percent).effectiveScale` (Phase 4 silent-clamp at 100%). Tested via cases (b) [50% override → 0.5 effective] and (c) [200% override clamps to 100% → 1.0 effective → out dims = source dims].
- **Pure-TS path derivation via `relativeOutPath()` helper** — splits `sourcePath` on the literal `'/images/'` substring (after `.replace(/\\/g, '/')` for Windows path safety) and returns `'images/' + regionPart`. NO `node:path` import (Layer 3 hard rule). Plan 06-04's `src/main/image-worker.ts` joins with `outDir` at write time — the worker IS allowed to import `node:path`.
- **Sort + return for deterministic output:** `rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))` ensures byte-identical ExportPlan output across runs and platforms — important for parity-test stability and for users who diff exports between runs.
- **`src/renderer/src/lib/export-view.ts` is a byte-identical renderer-side inline copy** — 140 lines (1 line longer than core because the renderer copy's docblock prose is slightly different). The exported `buildExportPlan` and helper `relativeOutPath` function bodies are BYTE-FOR-BYTE identical to `src/core/export.ts` (verified: `diff <(awk '/^export function buildExportPlan/,/^}/' src/core/export.ts) <(awk '/^export function buildExportPlan/,/^}/' src/renderer/src/lib/export-view.ts) | wc -l → 0`; same for `relativeOutPath` → 0). Differs ONLY in:
  - Header docblock prose (renderer-specific Layer 3 + Plan 06-06 caller notes)
  - `import type` path: `'../../../shared/types.js'` (renderer relative path) vs `'../shared/types.js'` (core relative path)
  - `import { applyOverride } from './overrides-view.js'` (renderer Layer 3 sibling copy) vs `from './overrides.js'` (core canonical)
- **Parity describe block in `tests/core/export.spec.ts`** with 6 it() blocks (mirrors `tests/core/overrides.spec.ts:155-194` Phase 4 D-75 precedent):
  1. renderer view exports `buildExportPlan` by name
  2. renderer copy has ZERO imports from `src/core/*` (Layer 3 invariant)
  3. renderer copy uses `./overrides-view.js` (NOT `../core/overrides.js`)
  4. both files share the `const bySourcePath = new Map` fold-key signature
  5. both files share the `Math.round(sourceW * ...)` uniform sizing pattern
  6. dynamic-import the renderer copy + run BOTH `buildExportPlan`s on the same SIMPLE_TEST-derived summary across 4 representative input combinations (no overrides; override 50% TRIANGLE; override 200% SQUARE clamps; multiple overrides CIRCLE+TRIANGLE) — `.toEqual` structural deep-compare locks them against drift

## Task Commits

Each task was committed atomically. Task 2 split into RED + GREEN per TDD:

1. **Task 1 — `src/core/export.ts` (single feat; RED was landed by Plan 06-01)** — `e8861e6` (feat)
   - Drives Plan 06-01 RED cases (a)-(g) GREEN: 13/13 in tests/core/export.spec.ts
   - Cleanup of unused `ExportRow` type import in tests/core/export.spec.ts (Plan 06-02 SUMMARY hint)
   - Adjusted case (f) Math.round(-0.5) assertion to use Math.abs() per V8 -0 semantics
2. **Task 2 RED — parity describe block** — `4eee062` (test) — 6 it() blocks fail with ENOENT / Cannot find module
3. **Task 2 GREEN — `src/renderer/src/lib/export-view.ts`** — `f2d84fb` (feat) — Drives parity tests GREEN: 19/19 in tests/core/export.spec.ts; arch.spec.ts still 9/9

## Files Created/Modified

### Created (2)
- `src/core/export.ts` (139 lines) — canonical pure-TS `buildExportPlan` per D-108..D-111. Layer 3 hygiene preserved.
- `src/renderer/src/lib/export-view.ts` (140 lines) — byte-identical renderer-side inline copy. Phase 4 D-75 precedent.

### Modified (1)
- `tests/core/export.spec.ts` — 3 changes:
  1. Dropped unused `ExportRow` from the type import (`import type { ExportPlan, SkeletonSummary }` only) per Plan 06-02 SUMMARY cleanup-deferred hint
  2. Widened case (f) assertion `expect(Math.round(-0.5)).toBe(0)` → `expect(Math.abs(Math.round(-0.5))).toBe(0)` (V8 returns -0 per ECMA-262; production paths Math.round positive products only)
  3. Appended 6-test parity describe block (`+81 lines`) at end of file

## Decisions Made

- **outPath is RELATIVE not absolute** (contradicts RESEARCH §Open Question 2). The ONLY way to keep `src/core/export.ts` free of `node:path` import is to do pure string manipulation. Plan 06-04 image-worker.ts will `path.resolve(outDir, row.outPath)` at write time. ExportProgressEvent.outPath crossing IPC will be set absolute by the image-worker post-resolve. Trade-off: one-line path.resolve in the worker vs. polluting the canonical module with node:path.
- **`relativeOutPath()` splits on literal `'/images/'`** with cross-platform `.replace(/\\/g, '/')` normalization. Fallback to `lastIndexOf('/')` if the prefix isn't found (defensive — Plan 06-02 loader convention guarantees the prefix, but the fallback prevents emitting an empty regionPart on malformed input).
- **Defensive `if (!row.sourcePath) continue` skip** — Plan 06-02 guarantees DisplayRow.sourcePath end-to-end, but CLI path defaults to '' (D-102 byte-for-byte lock). Future bypass-summary callers would emit garbage rows; Plan 06-04 image-worker would fail inside sharp() on '' sourcePath. Cleanest defense is to skip at plan-build time.
- **Renderer copy imports `./overrides-view.js`** (sibling Layer 3 copy) NEVER `../../../core/overrides.js`. Parity test it() block 3 explicitly asserts this import path.
- **Parity test uses dynamic `import('../../src/renderer/src/lib/export-view.js')`** so the renderer copy loads at vitest runtime in node environment. The renderer copy has zero DOM deps (only depends on the renderer's own overrides-view.ts which is also DOM-free) — works out of the box with `environment: 'node'`.
- **case (f) assertion adjusted to `Math.abs()`** since V8 implements `Math.round(-0.5) === -0` per ECMA-262. Production paths only Math.round positive products (sourceW/H >= 0 × effectiveScale > 0), so -0 is unreachable from buildExportPlan. Inline comment documents the rationale.

## Deviations from Plan

**1. [Rule 1 - Bug] Adjusted tests/core/export.spec.ts case (f) Math.round(-0.5) assertion to use Math.abs()**
- **Found during:** Task 1 GREEN verification (12/13 passed; case (f) `expect(Math.round(-0.5)).toBe(0)` failed with `expected -0 to be +0 // Object.is equality`)
- **Issue:** V8 / ECMA-262 spec defines `Math.round(-0.5)` as `-0`, not `+0`. Vitest's `.toBe(0)` uses `Object.is` strict equality which distinguishes `-0` from `+0`. The test as-written is incorrect about the JS spec contract — it's not a buildExportPlan bug.
- **Fix:** Changed assertion to `expect(Math.abs(Math.round(-0.5))).toBe(0)` so both `+0` and `-0` satisfy. Added inline comment documenting the rationale + noting that production paths only Math.round positive products, making -0 unreachable from buildExportPlan.
- **Files modified:** tests/core/export.spec.ts (line 214 region)
- **Commit:** e8861e6 (rolled into Task 1 since it's a one-line test-bug fix in the same RED→GREEN sequence)
- **Documentation:** plan's `<action>` block authorizes this exact case ("If a spec assertion is too strict... refine the assertion to match the actual algorithm — but document the refinement in the spec's docblock, do NOT loosen the contract behavior.")

**2. [Rule 1 - Cleanup] Dropped unused ExportRow type import in tests/core/export.spec.ts header**
- **Found during:** Task 1 GREEN typecheck (Plan 06-02 SUMMARY foreshadowed: "the latter is pre-existing — RED file imports the type for an inferred-position role; can be cleaned up in Plan 06-03 when buildExportPlan exists")
- **Issue:** `tests/core/export.spec.ts:35` imported `ExportRow` along with `ExportPlan` and `SkeletonSummary`, but the test bodies only use the inferred return type from `buildExportPlan(...)` and never explicitly annotate an ExportRow. Typecheck reported `TS6196: 'ExportRow' is declared but never used`.
- **Fix:** Changed `import type { ExportPlan, ExportRow, SkeletonSummary }` → `import type { ExportPlan, SkeletonSummary }`. Renamed the leading comment from "RED imports" to plain "Plan 06-02 introduces these types" since the RED-shell phase is over.
- **Files modified:** tests/core/export.spec.ts (line 34-35 region)
- **Commit:** e8861e6 (rolled into Task 1)

No other deviations. Both tasks executed exactly as the plan specified.

## Issues Encountered

- **None substantive.** The two minor deviations above were both authorized by the plan (case (f) assertion refinement) or foreshadowed by the predecessor plan's SUMMARY (ExportRow cleanup). The implementation followed the plan's `<action>` block verbatim including all documented Layer 3 hygiene rules.

## Test Suite State

- **Before this plan (Plan 06-02 baseline):** 137 passed | 1 skipped | 9 failed across 13 spec files
- **After this plan:** **156 passed | 1 skipped | 9 failed** across 13 spec files. Test count delta: **+19 passing tests** = 13 cases (a)-(g) + EXPORT_PROJECT fixture sanity + 5 hygiene grep tests in the existing `tests/core/export.spec.ts` (all RED before this plan; GREEN after Task 1) + 6 new parity tests appended in Task 2 RED (GREEN after Task 2 GREEN). Failure count UNCHANGED at 9 — all 9 are the pre-existing `tests/main/image-worker.spec.ts` (1 suite-level + body failures) + `tests/main/ipc-export.spec.ts` (8 it() blocks) RED specs awaiting Plan 06-04 + Plan 06-05 implementations (parallel wave per `<parallel_execution>` context — Plan 06-04 lives in a different worktree).
- **`npm run test -- tests/core/export.spec.ts`:** 19/19 GREEN (was suite-import RED before this plan).
- **`npm run test -- tests/arch.spec.ts`:** 9/9 GREEN — Layer 3 invariant intact in BOTH directions:
  - renderer ↛ core (existing grep at lines 19-34): the new `src/renderer/src/lib/export-view.ts` has ZERO `from .*/core/.*` imports. Verified via parity test it() block 2 + manual grep `grep -cE "from ['\"][^'\"]*\/core\/|from ['\"]@core" src/renderer/src/lib/export-view.ts → 0`.
  - core ↛ sharp/node:fs (Plan 06-01 grep at lines 116-134): the new `src/core/export.ts` has ZERO `from 'sharp'` / `from 'node:fs'` / `from 'fs'` imports. Verified via grep counts → 0.
- **`npm run typecheck`:** 4 pre-existing/expected-RED errors remaining, all OUT OF 06-03 SCOPE per the parallel_execution context:
  - `scripts/probe-per-anim.ts:14:31` (pre-existing per Plan 06-02 SUMMARY)
  - `tests/main/image-worker.spec.ts:31:27 Cannot find module '../../src/main/image-worker.js'` (Plan 06-04 territory — different worktree)
  - `tests/main/ipc-export.spec.ts:22:3 + :23:3 Module has no exported member 'handleStartExport'/'handlePickOutputDirectory'` (Plan 06-05 territory)
- **Phase-gate sanity** (verified post-Task-2):
  - `git diff --exit-code scripts/cli.ts` → empty (Phase 5 D-102 byte-for-byte CLI lock preserved)
  - `git diff --exit-code src/core/sampler.ts` → empty (CLAUDE.md fact #3 sampler lock preserved)
  - `test -f src/main/image-worker.ts` → file does not exist (Plan 06-04 territory — different worktree; this plan correctly stayed out of 06-04's lane per `<parallel_execution>` constraints)

## Byte-Identical Body Verification

```bash
$ diff <(awk '/^export function buildExportPlan/,/^}/' src/core/export.ts) \
       <(awk '/^export function buildExportPlan/,/^}/' src/renderer/src/lib/export-view.ts) | wc -l
0
$ diff <(awk '/^function relativeOutPath/,/^}/' src/core/export.ts) \
       <(awk '/^function relativeOutPath/,/^}/' src/renderer/src/lib/export-view.ts) | wc -l
0
```

Both function bodies are byte-identical. The only differences between the two files are:
1. Header docblock prose
2. `import type { ... } from '../shared/types.js'` (core) vs `from '../../../shared/types.js'` (renderer)
3. `import { applyOverride } from './overrides.js'` (core) vs `from './overrides-view.js'` (renderer)

The parity describe block in tests/core/export.spec.ts asserts behavioral equivalence on 4 representative inputs (no overrides; override 50% TRIANGLE; override 200% SQUARE clamps; multiple overrides CIRCLE+TRIANGLE) so that any future drift between the two files fails CI immediately. Mitigates threat T-06-10 (NEW) per the plan's `<threat_model>`.

## TDD Gate Compliance

Plan 06-03 has `tdd="true"` on both tasks. The required RED → GREEN gate sequence is:

- **Task 1:** RED was landed by Plan 06-01 (`tests/core/export.spec.ts` cases (a)-(g) failed at suite level with `Cannot find module '../../src/core/export.js'`). Plan 06-03 Task 1 = single `feat(06-03)` commit (`e8861e6`) drives all 13 tests GREEN. RED commit pre-exists in plan history → gate sequence: `39ab450 test(06-01): RED specs ...` → `e8861e6 feat(06-03): implement buildExportPlan`. ✓
- **Task 2:** RED commit landed in this plan: `4eee062 test(06-03): add RED parity describe block` (6 it() blocks failing with ENOENT / Cannot find module). GREEN commit follows: `f2d84fb feat(06-03): add renderer-side byte-identical buildExportPlan inline copy` (drives all 6 to GREEN; 19/19 in tests/core/export.spec.ts). ✓

Both gates verified: `test(...)` precedes each `feat(...)` commit; failing tests at the RED gate were confirmed (Task 1: suite-level import error at Plan 06-01; Task 2: 6 ENOENT failures); no REFACTOR commits were needed (the implementation diff was minimal and the code stayed clean).

## User Setup Required

None — no external service configuration required.

## Next Plan Readiness

- **Plan 06-05 (src/main/ipc.ts handlers + preload + AppShell wiring):** The ExportPlan + ExportResponse + Api interface contracts are fully declared (Plan 06-02). The renderer-side `buildExportPlan` exists at `src/renderer/src/lib/export-view.ts` and Plan 06-06's AppShell.tsx click handler can call it directly:
  ```typescript
  import { buildExportPlan } from '../lib/export-view.js';
  const plan = buildExportPlan(summary, overrides);
  await window.api.startExport(plan, outDir);
  ```
  No further core/renderer plumbing needed for Plan 06-06.
- **Plan 06-04 (src/main/image-worker.ts → runExport):** Independent of 06-03 per `<parallel_execution>` — runs in a different worktree on disjoint files. The image-worker reads `ExportRow.sourcePath` (already flowing end-to-end from Plan 06-02 loader) for the sharp call source, and `path.resolve(outDir, row.outPath)` to derive the absolute write path (since `row.outPath` is RELATIVE per this plan's outPath decision).

## Self-Check: PASSED

Files created (verified via `test -f`):
- FOUND: src/core/export.ts
- FOUND: src/renderer/src/lib/export-view.ts

Files modified (verified via `git log --name-only -3`):
- FOUND: tests/core/export.spec.ts (in e8861e6 + 4eee062)
- FOUND: src/core/export.ts (in e8861e6)
- FOUND: src/renderer/src/lib/export-view.ts (in f2d84fb)

Commits exist (verified via `git log --oneline -5`):
- FOUND: e8861e6 feat(06-03): implement buildExportPlan in src/core/export.ts (D-108..D-111)
- FOUND: 4eee062 test(06-03): add RED parity describe block for export.ts ↔ export-view.ts
- FOUND: f2d84fb feat(06-03): add renderer-side byte-identical buildExportPlan inline copy

Acceptance grep evidence:
- FOUND: `^export function buildExportPlan` in src/core/export.ts (Task 1 acc)
- FOUND: `^export function buildExportPlan` in src/renderer/src/lib/export-view.ts (Task 2 acc)
- ZERO: `from 'sharp'` / `from 'node:fs'` / `from 'node:path'` / runtime spine-core imports in src/core/export.ts (Layer 3 hygiene preserved)
- ZERO: `from .../core/...` / `from '@core...` imports in src/renderer/src/lib/export-view.ts (Layer 3 invariant preserved)
- FOUND: `from './overrides-view.js'` in src/renderer/src/lib/export-view.ts (sibling renderer copy, NOT core/)
- ZERO-LINE diff: `diff <(awk '/^export function buildExportPlan/,/^}/' src/core/export.ts) <(awk ... renderer copy)` → 0 (byte-identical body)
- ZERO-LINE diff: same for relativeOutPath helper → 0
- EMPTY: `git diff --exit-code scripts/cli.ts` (CLI byte-for-byte preserved)
- EMPTY: `git diff --exit-code src/core/sampler.ts` (sampler lock preserved)
- DOES NOT EXIST: src/main/image-worker.ts (Plan 06-04 territory — parallel worktree)

---
*Phase: 06-optimize-assets-image-export*
*Completed: 2026-04-25*
