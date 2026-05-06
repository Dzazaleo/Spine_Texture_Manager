---
phase: 28-optional-output-sharpening
plan: 02
subsystem: main-process-export-pipeline
tags: [sharp, image-worker, sharpen, ipc, dry-helper, refactor, typescript]

# Dependency graph
requires:
  - phase: 6-optimize-assets
    provides: "runExport sharp().resize(lanczos3, fill).png(level 9) per-region + atlas-extract pipeline + handleStartExport IPC handler"
  - phase: 22-passthrough-byte-copies
    provides: "passthroughCopies[] byte-copy fast path that bypasses any resize/sharpen helper (D-07 invariant)"
  - phase: 28-01
    provides: ".stmproj sharpenOnExport plumbing + Api.startExport 4th arg + ipc handleStartExport 5th param + @ts-expect-error placeholder at runExport call site (this plan removes it)"
provides:
  - "Module-level `const SHARPEN_SIGMA = 0.5` (D-05 LOCKED) in src/main/image-worker.ts"
  - "Private `applyResizeAndSharpen(pipeline, outW, outH, effectiveScale, sharpenEnabled)` helper — single locus of the downscale-only gate (D-07) + sigma constant + sharpen call"
  - "Both resize call sites (per-region + atlas-extract) collapse onto the helper (D-08 enforced — `kernel: 'lanczos3'` literal count drops 2 → 1)"
  - "`runExport` 6th arg `sharpenEnabled: boolean = false` threaded from handleStartExport"
  - "Plan 28-01 Task 4 `@ts-expect-error Phase 28-02` placeholder removed (count goes 1 → 0)"
affects: [28-optional-output-sharpening, 28-03, sharp-pipeline]

# Tech tracking
tech-stack:
  added: []  # No new dependencies
  patterns:
    - "DRY-helper at file-top between imports and runExport — module-private named const + named function (matches Phase 6 file-internal scope conventions)"
    - "Default-false 6th arg with neutral baseline preserves existing test invocations (mirrors allowOverwrite default-false pattern at runExport line 77)"
    - "Idempotency-by-shape: `if (sharpenEnabled && effectiveScale < 1.0) { p = p.sharpen(...) }` cannot fire more than once per helper invocation (T-28-09 mitigated)"

key-files:
  created:
    - ".planning/phases/28-optional-output-sharpening/28-02-SUMMARY.md"
  modified:
    - "src/main/image-worker.ts"
    - "src/main/ipc.ts"

key-decisions:
  - "D-05 LOCKED — sigma=0.5 fixed, named module-level `const SHARPEN_SIGMA`, NOT a magic literal at the call site"
  - "D-07 — sharpen gate is `sharpenEnabled && effectiveScale < 1.0` (downscale-only; identity 1.0× and upscale rows skip sharpen)"
  - "D-08 — both resize call sites covered via DRY helper (single locus refactor)"
  - "Helper takes `pipeline: sharp.Sharp` first arg so each call site only differs in the upstream chain (sharp(...) for per-region, sharp(...).extract(...) for atlas-extract); helper applies the resize, conditional sharpen, and png() encode in fixed order"
  - "Helper returns the sharp pipeline (not a Promise) — call sites await `.toFile(tmpPath)` themselves so the existing try/catch error classification at lines 453-462 stays VERBATIM unchanged"

patterns-established:
  - "Pipeline-builder helper that accepts an upstream sharp.Sharp + the per-row knobs and returns a continued chain (rather than terminating with .toFile inside the helper). Keeps tmp-write + atomic rename + error classification at the call-site layer where they already live."
  - "Module-level fixed-tuning constants live in image-worker.ts (NOT in src/core/) per Layer 3 invariant — `SHARPEN_SIGMA` colocates with the sharp call site that uses it"
  - "Plan 28-01 → 28-02 placeholder handoff: `@ts-expect-error Phase 28-02 will accept the 6th argument` deliberately seeded so that Plan 28-01 builds green AND TypeScript will warn 'Unused @ts-expect-error directive' once Plan 28-02 widens runExport — structurally enforces the cleanup. Confirmed working: deletion was required by tsc."

requirements-completed: [SHARP-02]

# Metrics
duration: ~5min
completed: 2026-05-06
---

# Phase 28 Plan 02: Optional Output Sharpening — Image-Worker Pipeline Integration Summary

**`SHARPEN_SIGMA = 0.5` constant + private `applyResizeAndSharpen` helper added to `src/main/image-worker.ts`; both resize call sites (per-region + atlas-extract) now collapse onto the helper; `runExport` accepts `sharpenEnabled: boolean = false` 6th arg; ipc.ts placeholder from Plan 28-01 Task 4 removed.**

## Performance

- **Duration:** ~5 min (1 task)
- **Tasks:** 1
- **Files modified:** 2
- **Net diff:** +60 / −13 lines

## Accomplishments

- SHARP-02 (image-worker pipeline integration with DRY helper) mechanically satisfied
- Flipping the toggle in OptimizeDialog (wired in Plan 28-01) now actually produces a sharpened resize output for downscaled rows
- Sharpen gate locus is structurally unique — the conditional `sharpenEnabled && effectiveScale < 1.0` appears in exactly ONE place in the file (the helper)
- `kernel: 'lanczos3'` literal count went 2 → 1 (verified pre/post-edit grep), proving both call sites collapsed onto the helper
- `applyResizeAndSharpen(` count went 0 → 3 (1 declaration + 2 call sites), proving D-08 coverage
- Passthrough rows continue to bypass the helper entirely (Phase 22 byte-identity preserved — they take the byte-copy fast path at lines 127-263)
- Pre-flight guards (path-traversal :377-387, NaN/zero-dim :393-405, mkdir :407-419) and the catch-block error classification (:453-462) all preserved VERBATIM — no behavior change on the error paths

## Helper signature and call sites (with line numbers)

**Constant + helper declaration** (src/main/image-worker.ts, lines 67-95):

```typescript
const SHARPEN_SIGMA = 0.5;

function applyResizeAndSharpen(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): sharp.Sharp {
  let p = pipeline.resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' });
  if (sharpenEnabled && effectiveScale < 1.0) {
    p = p.sharpen({ sigma: SHARPEN_SIGMA });
  }
  return p.png({ compressionLevel: 9 });
}
```

**Call site 1 — atlas-extract branch** (src/main/image-worker.ts, ~lines 463-472):

```typescript
await applyResizeAndSharpen(
  sharp(row.atlasSource.pagePath).extract({
    left: row.atlasSource.x,
    top: row.atlasSource.y,
    width: row.atlasSource.w,
    height: row.atlasSource.h,
  }),
  row.outW,
  row.outH,
  row.effectiveScale,
  sharpenEnabled,
).toFile(tmpPath);
```

**Call site 2 — per-region branch** (src/main/image-worker.ts, ~lines 474-481):

```typescript
await applyResizeAndSharpen(
  sharp(sourcePath),
  row.outW,
  row.outH,
  row.effectiveScale,
  sharpenEnabled,
).toFile(tmpPath);
```

**runExport extended signature** (src/main/image-worker.ts, lines 96-112):

```typescript
export async function runExport(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  allowOverwrite: boolean = false,
  sharpenEnabled: boolean = false, // Phase 28 SHARP-02 — 6th arg, default false
): Promise<ExportSummary> {
```

## Acceptance criteria — all 9 grep checks PASS

| # | Check | Expected | Actual |
|---|-------|----------|--------|
| 1 | `grep -c "const SHARPEN_SIGMA = 0.5" src/main/image-worker.ts` | 1 | **1** |
| 2 | `grep -c "function applyResizeAndSharpen(" src/main/image-worker.ts` | 1 | **1** |
| 3 | `grep -c "sharpenEnabled && effectiveScale < 1.0" src/main/image-worker.ts` | 1 | **1** |
| 4 | `grep -c "p.sharpen({ sigma: SHARPEN_SIGMA })" src/main/image-worker.ts` | 1 | **1** |
| 5 | `grep -c "kernel: 'lanczos3'" src/main/image-worker.ts` | 1 (was 2 pre-edit) | **1** |
| 6 | `grep -c "applyResizeAndSharpen(" src/main/image-worker.ts` | ≥ 3 | **3** |
| 7 | `grep -c "sharpenEnabled: boolean = false" src/main/image-worker.ts` | 1 | **1** |
| 8 | `grep -c "@ts-expect-error Phase 28-02" src/main/ipc.ts` | 0 (was 1 pre-edit) | **0** |
| 9 | `grep -v '^#' src/main/image-worker.ts \| grep -c "sharpen({ sigma: 0.5 })"` (no magic-literal sigma) | 0 | **0** |

The pre-edit baseline of 2 for `kernel: 'lanczos3'` (one per branch) collapsing to 1 (only the helper holds the literal) is the structural proof of D-08 coverage.

## Threat model — mitigations honored

| Threat | Mitigation status |
|--------|-------------------|
| T-28-06 (T): SHARPEN_SIGMA tampering | `const` at module scope; no code path mutates it; Plan 28-03 regression test will pin the value |
| T-28-07 (I): Sharpen output metadata leak | `.sharpen()` operates on the L channel; `.png({ compressionLevel: 9 })` emits identical-shape output as before; no new metadata fields |
| T-28-08 (T): runExport 6th arg tampering | Default `false` preserves neutral baseline for any caller bypassing IPC; ipcMain.handle strict-coerces `=== true` upstream (defense in depth) |
| T-28-09 (D): Repeated `.sharpen()` compounding | Helper structure guarantees AT MOST ONE `.sharpen()` call per `applyResizeAndSharpen` invocation; idempotency by shape |

## Verification

**Automated:**

- `npx tsc --noEmit -p tsconfig.json` exits 0 (zero TypeScript errors on the main tsconfig)
- `npm run test` exits 0; full vitest suite runs:
  - **Test Files:** 4 failed | 68 passed (72)
  - **Tests:** 4 failed | 788 passed | 9 skipped | 2 todo (803)
- All 4 failed test files match the pre-existing baseline documented in `.planning/phases/28-optional-output-sharpening/deferred-items.md` 1:1:
  1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (suite-setup loader fail) — pre-existing
  2. `tests/integration/build-scripts.spec.ts` (1 fail — package.json version 1.1.3 stale fixture) — pre-existing
  3. `tests/main/sampler-worker-girl.spec.ts` (1 fail — wall-time gate / warm-up) — pre-existing
  4. `tests/renderer/save-load.spec.tsx` (2 fails — toolbar Open button selector) — pre-existing

**Test count delta:** 0 new tests added by Plan 28-02 (Plan 28-03 owns the regression-test work per Phase 28 plan structure).

**Manual smoke (deferred to Plan 28-03 + UAT):** Visual A/B vs Photoshop Bicubic Sharper at downscale ratios in [0.5, 0.75] is owned by Plan 28-03's regression test plus a human-loop UAT pass after the test lands.

## Decisions Made

- **Helper accepts `pipeline: sharp.Sharp` and returns `sharp.Sharp`** — the call sites still own `.toFile(tmpPath)` and the surrounding try/catch. This keeps the error-classification block (lines 453-462) unchanged: it still distinguishes `useAtlasExtract && row.atlasSource ? row.atlasSource.pagePath : sourcePath` for path attribution. Returning a Promise from the helper would have moved that classification logic into the helper or duplicated it.
- **Constant lives in `src/main/image-worker.ts` (NOT `src/core/`)** — D-05 sigma is sharp-specific tuning; per Layer 3 invariant, sharp-coupled values colocate with the sharp call site. Plan 28-03 will assert on it from a test that imports image-worker (no `src/core/` import needed).
- **JSDoc summary at line 4 updated** to reflect the new 6th arg (`runExport(plan, outDir, onProgress, isCancelled, allowOverwrite=false, sharpenEnabled=false)`) — keeps the doc and signature in sync.

## Deviations from Plan

None — plan executed exactly as written. Each `<read_first>` reference checked, every `<acceptance_criteria>` greppable check passes, all `<preserve verbatim>` constraints honored.

## Issues Encountered

None during execution. The 4 pre-existing test failures (5 individual tests) are the same set documented in `deferred-items.md` from Plan 28-01 — verified the failure file list matches exactly.

## Layer 3 invariant preserved

```bash
grep -rn "from 'sharp'" src/core/  # → 0 hits (unchanged from Plan 28-01)
```

`SHARPEN_SIGMA` and `applyResizeAndSharpen` live in `src/main/image-worker.ts`. No `src/core/` change in this plan.

## Next Plan Readiness

- Plan 28-03 (regression test for SHARP-02 + SHARP-03) ready to start. The helper externally exposes the gate semantics through the `sharpenEnabled` 6th arg of `runExport`; the test asserts on observed pixel-variance + byte-identity per the patterns in `28-PATTERNS.md` §`tests/main/image-worker.sharpen.spec.ts`. Specifically:
  1. SHARP-02: `sharpenEnabled=true` + `effectiveScale<1.0` → variance > baseline (sharper output measurably)
  2. SHARP-03 gate-A: `sharpenEnabled=true` + `effectiveScale=1.0` → byte-identical to baseline (downscale-only gate)
  3. SHARP-03 gate-B: `sharpenEnabled=false` + `effectiveScale<1.0` → byte-identical to baseline (toggle-off gate)
  4. SHARP-02 atlas-extract: same variance assertion as #1 but exercising the atlas-extract branch (D-08 coverage proof)

## Task Commits

1. **Task 1: Add SHARPEN_SIGMA + applyResizeAndSharpen helper + extend runExport signature; remove ipc.ts @ts-expect-error placeholder** — `002549b` (feat)

## Self-Check: PASSED

Verified files exist:
- `[FOUND] .planning/phases/28-optional-output-sharpening/28-02-SUMMARY.md` (this file)

Verified commits exist (per `git log --oneline | grep`):
- `[FOUND] 002549b` — Task 1

Verified source-file structural invariants (post-commit):
- `[FOUND] const SHARPEN_SIGMA = 0.5` in src/main/image-worker.ts (1 occurrence)
- `[FOUND] function applyResizeAndSharpen(` in src/main/image-worker.ts (1 occurrence)
- `[FOUND] kernel: 'lanczos3'` collapsed from 2 to 1 in src/main/image-worker.ts
- `[FOUND] applyResizeAndSharpen(` 3 occurrences (1 decl + 2 call sites)
- `[FOUND] sharpenEnabled: boolean = false` runExport 6th arg
- `[NOT FOUND] @ts-expect-error Phase 28-02` in src/main/ipc.ts (0 occurrences — correctly removed)

---
*Phase: 28-optional-output-sharpening*
*Plan: 02 of 03*
*Completed: 2026-05-06*
