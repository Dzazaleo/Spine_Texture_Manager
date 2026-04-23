---
phase: 00-core-math-spike
plan: 07
subsystem: exit-criteria + human-verify
tags: [human-verify, exit-criteria, gap-fix, mesh-render-scale-iteration, hull-sqrt]

# Dependency graph
requires:
  - phase: 00-01..00-06
    provides: "Full Phase 0 pipeline — loader + bounds + sampler + CLI + tests"
provides:
  - "Human-verified Phase 0 exit: CLI output plausible across three real fixtures (SIMPLE_TEST, skeleton2, Jokerman, Girl)."
  - "Shipping mesh render-scale formula: iter-4 hull_sqrt — `sqrt(area(hull(worldVertices)) / area(hull(sourceVertices)))` with defensive page-dim resolution (`region.page ?? region.texture.page`)."
  - "Archived experimental branch `feat/mesh-render-scale-anisotropic` with iter-5 best-fit affine SVD for future per-axis work."
affects: [01-ui-shell-and-ingest]

# Tech tracking
tech-stack:
  added: []  # No new deps
  patterns:
    - "Iteration-gate: the plan paused at human-verify and spawned GAP-FIX.md iterations 1→5 until user ground truth matched across production-realistic rigs."
    - "Formula evolution documented in GAP-FIX.md with per-fixture numeric tables — future phases can reference the rejected variants' failure modes."

key-files:
  - path: "src/core/bounds.ts"
    rationale: "Holds the shipping mesh formula (hull_sqrt). Iter-5 variants were implemented on the anisotropic branch, not here."
  - path: ".planning/phases/00-core-math-spike/GAP-FIX.md"
    rationale: "Full iteration history + user ground truth + rejection rationale for each formula attempted."
---

# Plan 00-07 — Summary

## Scope

Exit-criteria sweep + human-verify checkpoint for Phase 0. Final gate
before advancing STATE.md to Phase 0 COMPLETE.

The plan's original shape was a single-session sweep: run npm test,
run the CLI, have the user eyeball the 4-row SIMPLE_TEST output and
approve. Approval was given at iter-4 hull_sqrt after a 5-iteration
loop through GAP-FIX.md.

## What was validated

Automated gates (each run in a clean shell on iter-4 hull_sqrt):
- `npm test` — 47 passed / 1 skipped / 0 failed.
- `npx tsc --noEmit` — clean, strict mode, zero errors.
- `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — exits 0
  with 4 attachment rows (CIRCLE, SQUARE, SQUARE2, TRIANGLE) and the
  elapsed-ms footer well under the 500 ms N2.1 gate.

Human-verify gates (user approved each after iteration):
- **SIMPLE_TEST**: CIRCLE 2.018, SQUARE 1.500, SQUARE2 0.460, TRIANGLE 2.000.
- **skeleton2.json** (anisotropic-deformation test fixture): CIRCLE
  0.610 isotropic at CAM f19 — accepted as a known limit flagged to the
  existing ROADMAP.md "Deferred" entry for aspect-ratio anomaly.
- **Jokerman** (licensed real-character rig, gitignored): 23 attachments
  across 18 animations. BODY 1.043 (user expected ~1.07), all regions
  at 1.060 (user approved "prior values seem correct 1.060").
- **Girl** (second real-character rig, 145 attachments, 15 animations):
  body meshes 0.356–0.524 (downscaled rig), MAGIC_EXPLOSION sprites
  1.619–1.654 (VFX scaled up). User confirmed plausible.

## Formula evolution (documented in GAP-FIX.md)

Phase 0's original mesh render-scale was weighted per-vertex bone-scale
sum (iter-1). User reviewing Jokerman flagged a false-positive on shared
bones (BODY reporting 1.199 via small R_ARM weighting). Five iterations
explored alternative formulas:

| Iter | Formula | Result |
|---|---|---|
| 1 | weighted-sum-of-bone-scales | Jokerman BODY 1.199 ✗ (shared-bone spillover) |
| 3 | per-triangle max-area-ratio | over-reports everywhere (LEGS 2.603, L_EYELID 3.108) |
| **4** | **hull_sqrt (shipping)** | **BODY 1.043 ✓, LEGS 1.092, CAM 0.610 isotropic** |
| 5a | min-area OBB on hull | LEGS 1.584 ✗ (outlier-sensitive) |
| 5b | best-fit affine SVD | CAM 0.713 ✓ but LEGS 1.665 and slight over-report everywhere |
| 5c | per-vertex Jacobian SVD | Jokerman all 1.060 ✓ but CAM 0.500 ✗ (blind to translation) |
| 5d | per-triangle area-weighted SVD | L_EYELID 1.693 ✗ |

User accepted iter-4 as "closest to reality" across all tested fixtures.
Iter-5 experimental work preserved on `feat/mesh-render-scale-anisotropic`
branch, pushed to remote for future reference.

## Deviations

None from the plan's execution template — the plan was 2 tasks (auto
sweep + human-verify checkpoint). Deviation from the ORIGINAL implementation
was the 5-iteration scale-formula exploration driven by user ground truth,
captured in GAP-FIX.md rather than in SUMMARY form (GAP-FIX is the canonical
iteration log for this phase).

## Metrics

- Sampler perf on SIMPLE_TEST: ~12 ms at 120 Hz (N2.1 gate: < 500 ms).
- Sampler perf on Jokerman (23 attachments × 18 animations): ~82 ms.
- Sampler perf on Girl (145 attachments × 15 animations): ~190 ms.
- Test suite: 47 passing, 1 intentionally skipped (easing-curve stretch
  test, un-skip recipe documented in sampler.spec.ts).

## Follow-ups to next milestone

- Phase 1 (UI shell): consume the shipping `PeakRecord` shape directly.
  No API changes from Phase 0 closeout.
- ROADMAP Deferred — "Aspect-ratio anomaly flag (when scaleX != scaleY at peak)"
  remains open; iter-5 affine SVD on the archive branch is a starting point.
