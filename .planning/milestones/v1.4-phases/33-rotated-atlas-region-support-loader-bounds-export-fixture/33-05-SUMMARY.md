---
phase: 33
plan: 05
subsystem: image-worker+tests
tags: [wave-3, rotated-atlas, d-03, atlas-03, sharp-rotate]
status: complete
completed: 2026-05-10
type: execute
wave: 3
depends_on: [33-03, 33-04]
requires:
  - src/main/image-worker.ts (post-Plan-33-03 — typed-error block removed)
  - src/core/loader.ts (post-Plan-33-04 — atlasSources.rotated propagation already lived here)
  - tests/main/image-worker-rotation.spec.ts (Plan 33-02 Wave 1 RED scaffold to un-skip)
  - tests/core/export-rotation-dims.spec.ts (Plan 33-02 Wave 1 RED scaffold to un-skip)
  - fixtures/spine_rotated/EXPORT/skeleton.{json,atlas,png} (Plan 33-01)
provides:
  - src/main/image-worker.ts un-rotates rotated atlas regions to canonical orientation in BOTH atlas-extract paths (passthrough + resize)
  - tests/core/export-rotation-dims.spec.ts ACTIVE (2/2 PASS — ExportPlan emits canonical W×H)
  - tests/main/image-worker-rotation.spec.ts ACTIVE (3/3 PASS — runExport emits canonical-orientation PNGs)
  - scripts/probe-sharp-rotate.mjs (regression sentinel for the +90 direction lock)
affects:
  - npm test count (+5 active tests, -2 skipped files, -5 todos vs Plan 33-04 baseline)
  - npm test counts now 94 passed | 0 skipped (94 files); 1014 passed | 3 skipped | 2 todo (1019 tests)
  - ATLAS-03 acceptance: ExportPlan output dims reflect canonical W×H AND image-worker produces canonical-orientation PNG output
tech-stack:
  added: []
  patterns:
    - "Two-pipeline SW + rotation: materialize extract→rotate→extend to Buffer before resize, defeating libvips operation reordering (RESEARCH §Pitfall 4)"
    - "Post-rotation canonical-orientation derivation: sourceCanvasW = a.rotated ? a.packH : a.packW (analogous H), used in both passthrough and resize SW extend args"
    - "Empirical-probe-before-production: run scripts/probe-sharp-rotate.mjs to confirm +90 vs -90 direction (memory feedback_narrow_before_fixing)"
key-files:
  created:
    - scripts/probe-sharp-rotate.mjs
  modified:
    - src/main/image-worker.ts
    - tests/core/export-rotation-dims.spec.ts
    - tests/main/image-worker-rotation.spec.ts
decisions:
  - "Sharp rotation direction is +90 (NOT -90 as CONTEXT D-03 hypothesized). Direction empirically verified by Plan 05 probe re-run before any production code shipped; matches RESEARCH §Sharp Rotation Direction (Empirical) + libgdx CCW90 packing convention."
  - "SW + rotation uses the existing two-pipeline materialize-toBuffer pattern. Rotation slots into the pre-pipeline BEFORE .toBuffer(), preserving the libvips-reordering defense (RESEARCH §Pitfall 4). Single-pipeline rotation only used for non-SW rows."
  - "Test-fixture values are hand-coded as named constants (FIXTURE_REGION_NAME, CANONICAL_W, etc.) at the top of image-worker-rotation.spec.ts so future fixture-shape drift surfaces as a single-edit migration, not a scattered-string hunt."
metrics:
  duration_minutes: ~4
  completed_date: 2026-05-10
  task_count: 3
  file_count: 4
  commit_count: 3
requirements:
  - ATLAS-03
---

# Phase 33 Plan 05: Image-worker rotation + ATLAS-03 acceptance

## One-liner

Added `sharp.rotate(+90)` to both atlas-extract pipelines in `src/main/image-worker.ts` (passthrough + resize SW two-pipeline + resize non-SW = 3 call sites) so rotated atlas regions emit canonical-orientation PNGs at canonical W×H; un-skipped both ATLAS-03 spec scaffolds; direction empirically verified by a re-run of `scripts/probe-sharp-rotate.mjs` BEFORE any production change.

## Probe re-verification (run BEFORE production edit)

Per CONTEXT §"Sharp rotation argument naming and direction" and memory
`feedback_narrow_before_fixing`, the empirical probe documented in
33-RESEARCH.md §"Sharp Rotation Direction (Empirical)" was re-run on a freshly
authored `scripts/probe-sharp-rotate.mjs` BEFORE the production edits landed.

Output:

```
Canonical (8w × 4h): { TL: 'RED', TR: 'GREEN', BL: 'BLUE', BR: 'WHITE' }
Canonical (round-trip raw): { TL: 'RED', TR: 'GREEN', BL: 'BLUE', BR: 'WHITE' }
Synthesized PACKED (4w × 8h, CCW90 of canonical): { TL: 'GREEN', TR: 'WHITE', BL: 'RED', BR: 'BLUE' }
sharp.rotate(+90) on PACKED → 8w × 4h: { TL: 'RED', TR: 'GREEN', BL: 'BLUE', BR: 'WHITE' }
sharp.rotate(-90) on PACKED → 8w × 4h: { TL: 'WHITE', TR: 'BLUE', BL: 'GREEN', BR: 'RED' }

=== VERDICT ===
sharp.rotate(+90) restores canonical: true
sharp.rotate(-90) restores canonical: false
CONFIRMED: ship sharp.rotate(+90) — cancels libgdx CCW packing.
```

`sharp.rotate(-90)` gives **literally 180° wrong corners** — top-left becomes bottom-right and vice versa. Shipping `-90` would have produced visibly-broken rotated-region exports for every user with a `rotate:true` atlas.

The probe is committed at `scripts/probe-sharp-rotate.mjs` and serves as the regression sentinel for the +90 direction lock (pattern mirrors `scripts/pma-probe.mjs`).

## What landed

### Task 1: sharp.rotate(+90) in image-worker passthrough path (commit `8db04e3`)

`src/main/image-worker.ts` lines 274-310 — inserted `pipeline.rotate(90)` after `extract()` and before `extend()`. Derived locals `sourceCanvasW`/`sourceCanvasH` swap `packW ↔ packH` for rotated rows so SW extend args use post-rotation canonical orientation. Non-rotated rows are mathematically equivalent to the pre-edit code.

Also updated the file-top docblock (lines 25-29) — the previous text incorrectly documented `sharp.rotate(-90)` (the CONTEXT D-03 hypothesis); it now reflects the empirically-verified `+90` direction and cross-references RESEARCH + the probe.

### Task 2: sharp.rotate(+90) in image-worker resize path (commit `742e4d6`)

`src/main/image-worker.ts` lines 510-573 — restructured the SW two-pipeline branch from a single chained `sharp(pagePath).extract().extend().png().toBuffer()` into an explicit `let pre = sharp(pagePath).extract(); if (rotated) pre = pre.rotate(90); const orig = await pre.extend().png().toBuffer()`. The two-pipeline materialize-toBuffer pattern is preserved (defeats libvips operation reordering per RESEARCH §Pitfall 4); rotation slots into the pre-pipeline so the materialized buffer is canonical-orientation when `applyResizeAndSharpen` receives it. The non-SW branch gets a simpler post-extract `pipeline = pipeline.rotate(90)` insert.

3 .rotate(90) call sites total:

| Line | Site | Branch |
|------|------|--------|
| 293 | passthrough | `pipeline = pipeline.rotate(90)` after extract |
| 540 | resize SW | `pre = pre.rotate(90)` in pre-pipeline before toBuffer |
| 563 | resize non-SW | `pipeline = pipeline.rotate(90)` after extract |

### Task 3: ATLAS-03 spec bodies (commit `723602b`)

**`tests/core/export-rotation-dims.spec.ts`** — 2 active tests:

1. Synthetic SkeletonSummary peak with `canonicalW=500, canonicalH=100, packW=100, packH=500, rotated=true, peakScale=1.0` → asserts `row.outW === 500` (NOT packed 100) and `row.outH === 100` (NOT packed 500). Locks `src/core/export.ts:325-326` canonical-relative math against future regression.
2. `atlasSource.rotated=true` survives `buildExportPlan` without being stripped.

**`tests/main/image-worker-rotation.spec.ts`** — 3 active tests against `fixtures/spine_rotated/EXPORT/skeleton.png` region `rect`:

1. Passthrough: hand-built `ExportPlan.passthroughCopies` row with the fixture's exact shape → output PNG metadata `width === 500, height === 100`.
2. Resize 0.5×: same shape but in `ExportPlan.rows` with `effectiveScale=0.5` → output PNG metadata `width === 250, height === 50`.
3. Non-blank sanity: passthrough output has `totalAlpha > 0` (catches degenerate-buffer / fully-transparent failure modes; the dim-tied tests + the direction-lock comment carry the actual direction-correctness load).

All 5 tests passed on the FIRST run after the image-worker edits (Tasks 1+2) — empirical confirmation that the verbatim post-rotation canonical-orientation derivation from RESEARCH §Pitfall 3 is byte-correct in production.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Probe direction lock | `node scripts/probe-sharp-rotate.mjs` | EXIT=0, `sharp.rotate(+90) restores canonical: true` |
| TypeScript compiles | `npx tsc --noEmit` | EXIT=0 |
| ATLAS-03 export | `npm test -- tests/core/export-rotation-dims.spec.ts` | 2/2 PASS |
| ATLAS-03 image-worker | `npm test -- tests/main/image-worker-rotation.spec.ts` | 3/3 PASS |
| Regression: passthrough | `npm test -- tests/main/image-worker.passthrough.spec.ts` | 4/4 PASS |
| Regression: SW | `npm test -- tests/main/image-worker.strip-whitespace.spec.ts` | 5/5 PASS |
| Regression: atlas-extract | `npm test -- tests/main/image-worker.atlas-extract.spec.ts` | 2/2 PASS |
| Arch tests (Layer 3) | `npm test -- tests/arch.spec.ts` | 12/12 PASS — `core/` still has no DOM/sharp/electron imports |
| Full suite | `npm test` | `94 passed \| 0 skipped (94)` files ; `1014 passed \| 3 skipped \| 2 todo (1019)` tests |
| .rotate(90) call site count | `grep -c 'rotate(90)' src/main/image-worker.ts` | 3 |
| VERIFIED EMPIRICALLY comments | `grep -c 'VERIFIED EMPIRICALLY' src/main/image-worker.ts` | 4 (docblock + 3 inline) |
| Phase 33 D-03 header | `grep -c 'Phase 33 D-03' src/main/image-worker.ts` | 4 |
| Post-rot derived locals | `grep -c 'sourceCanvasW = a.rotated' src/main/image-worker.ts` | 2 (passthrough + resize) |
| describe.skip removed (export-dims) | `grep -c 'describe.skip' tests/core/export-rotation-dims.spec.ts` | 0 |
| describe.skip removed (image-worker-rotation) | `grep -c 'describe.skip' tests/main/image-worker-rotation.spec.ts` | 0 |

### Test-count delta vs Plan 33-04 baseline

| Metric | Plan 33-04 end | Plan 33-05 end | Δ |
|--------|----------------|-----------------|---|
| Files passed | 92 | 94 | +2 |
| Files skipped | 2 | 0 | −2 |
| Tests passed | 1009 | 1014 | +5 |
| Tests skipped | 3 | 3 | 0 |
| Tests todo | 7 | 2 | −5 |

The two un-skipped spec files added 5 active passing tests (2 ATLAS-03 buildExportPlan + 3 ATLAS-03 image-worker) and converted 5 `it.todo` placeholders to real assertions. The two remaining todos live in unrelated specs out of Phase 33's scope.

## Deviations from plan

None — Rules 1, 2, 3, 4 did not trigger during execution.

The only divergence from the plan **text** is a templating one: the plan's verbatim `<interfaces>` block uses a generic `canonicalW=100, canonicalH=500` synthetic example, but the actual on-disk fixture (per 33-01-SUMMARY.md "Fixture Shape" table) is `canonicalW=500, canonicalH=100` (because the packer chose CCW90 for tighter packing — see Plan 01 Deviation #3). The test files use the **fixture's actual values** (verbatim from 33-01-SUMMARY.md), not the plan's generic example values. The plan acceptance text in `must_haves.truths` explicitly cross-references "the fixture shape from 33-01-SUMMARY.md", and the plan's `<read_first>` directive on Task 3 pointed at that table.

## Auth gates encountered

None.

## Notes for downstream

- **Plan 33-06** is the final plan of Phase 33. With Plans 04+05 landed, all 4 ATLAS REQs are code-complete: ATLAS-01 (loader accepts rotated atlases), ATLAS-02 (bounds AABB matches unrotated reference), ATLAS-03 (export emits canonical W×H + canonical-orientation PNGs), ATLAS-04 (fixture committed). Plan 06's job is end-to-end verification + the `no-stale-rotation-error.spec.ts` grep guard.
- **The probe is now permanent infrastructure.** `scripts/probe-sharp-rotate.mjs` is the regression sentinel for the `sharp.rotate(+90)` direction lock (pattern mirrors `scripts/pma-probe.mjs` per memory `project_pma_no_op_in_current_stack`). If `sharp@<future>` ever changes its rotation sign convention, this probe fails first.
- **The fixture-shape constants in image-worker-rotation.spec.ts are intentionally hand-coded as named locals.** A future plan that extracts the fixture-shape into a shared helper CAN replace them — but until then, the verbatim copy from 33-01-SUMMARY.md ensures a fixture-shape drift surfaces as a single-edit migration, not a scattered-string hunt.
- **`src/core/export.ts` was NOT modified.** Per RESEARCH §Architectural Responsibility Map, `outW = ceil(canonicalW × effScale)` was already canonical-relative; the canonical math flows through unchanged for rotated rows because Plan 04 made `canonicalW`/`canonicalH` correct on the SkeletonSummary peaks.

## Self-Check: PASSED

- File `src/main/image-worker.ts` — modified (3 .rotate(90) sites; docblock updated)
- File `scripts/probe-sharp-rotate.mjs` — created (direction-lock probe)
- File `tests/core/export-rotation-dims.spec.ts` — modified (describe.skip removed, 2 active assertions)
- File `tests/main/image-worker-rotation.spec.ts` — modified (describe.skip removed, 3 active assertions)
- Commit `8db04e3` — FOUND in `git log` (`feat(33-05): add sharp.rotate(+90) to image-worker passthrough path`)
- Commit `742e4d6` — FOUND in `git log` (`feat(33-05): add sharp.rotate(+90) to image-worker resize path`)
- Commit `723602b` — FOUND in `git log` (`test(33-05): un-skip ATLAS-03 export+image-worker rotation specs`)
- `npx tsc --noEmit` exits 0
- `npm test` exits 0 (94 files pass, 0 skipped, 0 failures; 1014 tests pass, 3 skipped, 2 todo)
- `npm test -- tests/core/export-rotation-dims.spec.ts` exits 0 (2/2)
- `npm test -- tests/main/image-worker-rotation.spec.ts` exits 0 (3/3)
- `npm test -- tests/arch.spec.ts` exits 0 (12/12 — Layer 3 invariant preserved; sharp still confined to main/)
