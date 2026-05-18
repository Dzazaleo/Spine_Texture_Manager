---
phase: 44
plan: CORE-FIX
subsystem: core/runtime (dual-runtime adapter facade)
tags: [bug-fix, tdd, runtime-43, mesh-uv, page-space, ORCL-02, silent-undersize]
type: orchestrator-directed-core-fix
requires:
  - runtime-43.ts attachmentUVs (RegionAttachment branch — page-space, untouched)
  - bounds.ts hullAreaRatio (page-space UV consumer — untouched)
  - "@esotericsoftware/spine-core@4.3.0 MeshAttachment.computeUVs (pinned API)"
provides:
  - runtime-43 mesh attachmentUVs now returns PAGE-space UVs (ORCL-02 equivalence)
  - tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts (cross-runtime regression lock)
affects:
  - Phase-44 ORCL-02 cross-runtime HARD gate (now passes for the CIRCLE mesh)
  - tests/runtime43/baselines/ (4.3 own-baseline now STALE — 44-04 hand-off)
tech-stack:
  added: []
  patterns:
    - "MeshAttachment.computeUVs(region, regionUVs, out) → region-space → page-space"
    - "sequence.regions[idx] single-region/setupIndex resolution (4.3 has no .region)"
key-files:
  created:
    - tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts
  modified:
    - src/core/runtime/runtime-43.ts
decisions:
  - "Use MeshAttachment.computeUVs (spine-core's own page-space mapping), not a hand-rolled formula — byte-faithful to Sequence.update and rotation-aware (90/180/270)"
  - "Resolve mesh region via sequence.regions[idx] reusing the exact idx logic attachmentRegionMeta + the RegionAttachment branch already use (consistency, 4.3 has no MeshAttachment.region)"
  - "RegionAttachment branch left byte-untouched (already page-space, CORRECT)"
metrics:
  duration: ~16 min
  completed: 2026-05-18
  tasks: 3
  files: 2
---

# Phase 44 Plan CORE-FIX: runtime-43 Mesh-UV Page-Space Defect (ORCL-02 Undersize) Summary

Fixed the ship-blocking ORCL-02 silent-undersize defect: every weighted/region
mesh sampled through runtime-43 was ~2.25× undersized because
`attachmentUVs` returned 4.3.0's region-space `MeshAttachment.regionUVs` raw
where `bounds.ts hullAreaRatio` requires page-space UVs. The fix routes the
mesh region through `sequence.regions[idx]` and returns
`MeshAttachment.computeUVs(region, regionUVs, out)` — the same page-space
mapping spine-core itself applies in `Sequence.update`. Cross-runtime CIRCLE
mesh scale is now **exactly** equal (4.2 `0.500003311400526` ==
4.3 `0.500003311400526`, rel-divergence `0`, was 55.58% / 2.251×).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | TDD RED — reproduce ~2.25× mesh undersize | `fb1c4cd` | tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts |
| 2 | GREEN — runtime-43 mesh attachmentUVs page-space | `2d0246c` | src/core/runtime/runtime-43.ts |
| 3 | SAFE-02 non-regression proof | (no file change — metadata commit) | this SUMMARY |

## Root Cause (verified against pinned spine-core@4.3.0)

- `node_modules/@esotericsoftware/spine-core/dist/attachments/MeshAttachment.d.ts:41`
  — `regionUVs` is **"normalized WITHIN the texture region"** (region-space
  [0,1] inside the sub-rect), confirmed by the `computeUVs` impl
  (`MeshAttachment.js:118`): `uvs[i] = region.u + regionUVs[i] *
  (region.originalWidth / page.width)` (+ rotation-aware 90/180/270 variants).
- `src/core/bounds.ts:223-226` (`hullAreaRatio`) does `sv[i] = uvs[i] * pageW`
  — it requires **page-space** UVs.
- runtime-42 satisfies this by returning spine-core-42's parse-time page-space
  `att.uvs` (`runtime-42.ts:433-437`). 4.3.0's `MeshAttachment` has **no
  `.uvs`** field and **no `.region`** member (it `implements HasSequence`, not
  `HasTextureRegion`).
- runtime-43's old branch returned raw `ma.regionUVs` → `hullAreaRatio`
  divided world-area by a sourceArea inflated by ~(page/region)² →
  peakScale collapsed by a constant ~1.5² = 2.25×.

## RED → GREEN Evidence

| | runtime-42 (trusted) | runtime-43 (under test) | rel-divergence |
| --- | --- | --- | --- |
| RED (pre-fix) | `0.500003311400526` | `0.222119488030368` | 55.58% (≈ 2.251× undersize) |
| GREEN (post-fix) | `0.500003311400526` | `0.500003311400526` | `0` (exact, not just within 1e-4) |

The fix is exact (zero divergence), not merely tolerance-passing — strong
evidence it is the correct page-space transform, not a coincidental near-match.

## Non-Regression Proof (Task 3)

| Suite | Result | Meaning |
| --- | --- | --- |
| `tests/safe01/` (SAFE-01/SAFE-02 4.2 byte-equality gate) | **24 passed, 0 failed** | **Phase-43 exit gate NOT regressed** — the 4.2 path is byte-untouched |
| `tests/arch.spec.ts` (RT-02 import carve-out anchor) | 16 passed, 0 failed | No architecture-contract violation |
| `tests/core/sampler.spec.ts` (4.2 sampler path) | 38 passed, 1 skipped, 0 failed | No 4.2-path collateral |
| `tests/runtime/` (incl. new core-fix spec) | 8 passed, 0 failed | RED→GREEN confirmed; runtime adapter suites green |
| `tests/runtime43/` | 4 passed, **1 failed (expected — see below)** | runtime43-d03 + load-smoke green; baseline sentinel correctly tripped |

The SAFE-02 / 4.2 byte-equality gate (the Phase-43 exit gate, `tests/safe01/`)
is **0 failed** — the fix is isolated to the 4.3 branch and the 4.2 path is
byte-untouched (the fix is in `runtime-43.ts`; `runtime-42.ts` and the 4.2
path were never opened for write).

## Deviations from Plan

None — the three tasks executed exactly as directed. The root cause and the
recommended `MeshAttachment.computeUVs` fix form were both verified against the
pinned 4.3.0 source before implementing (as the objective required), and
confirmed accurate.

## Hand-off / Expected Out-of-Lane Consequence (NOT a regression I introduced)

`tests/runtime43/runtime43-baseline.spec.ts` (1 failed) is the Phase-43 4.3
**own-baseline regression SENTINEL** (44-PATTERNS.md:198,225 — explicitly *NOT*
the SAFE-02 hard gate; "only ORCL-02 is a hard gate"). It tripped because the
committed 4.3 baseline in `tests/runtime43/baselines/` was **frozen WITH the
ORCL-02 defect present** (captured during Phase 43, before Phase 44's ORCL-02
oracle caught the bug). The diff is **surgically scoped**: *every* moved record
is `attachmentKey: "default/CIRCLE/CIRCLE"` (the CIRCLE mesh only), moving by
exactly the documented ~2.251× ratio (e.g. `0.271084461468428` →
`0.610226187739596`). No SQUARE / region / constraint / rotated record moved —
matching the diagnosis ("SQUARE/region/constraint paths are byte-identical
cross-runtime; this is a precise mesh-only defect").

Per the parallel-execution lane constraints, `tests/runtime43/*` (including the
baselines) is **44-04's lane** and is explicitly off-limits to this agent. The
stale 4.3 own-baseline must be **regenerated by the orchestrator / plan 44-04**
after this fix lands (a deliberate, reviewed re-capture — the corrected
page-space 4.3 values now legitimately match the 4.2 leg). This is the
*intended* effect of the fix, not collateral damage.

## Known Stubs

None — no placeholder/empty-value code introduced; the fix wires real
page-space UVs through spine-core's own `computeUVs`.

## Threat Flags

None — no new network/auth/file-access/schema surface. The change is a
pure-math UV-normalization correction within the existing sanctioned
spine-core import carve-out (`runtime-43.ts`), arch-anchor-verified
(`tests/arch.spec.ts` 16/16 green).

## Self-Check: PASSED

- FOUND: `src/core/runtime/runtime-43.ts` (modified, typecheck:node clean)
- FOUND: `tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts` (new, 3/3 green)
- FOUND: commit `fb1c4cd` (RED), `2d0246c` (GREEN) on
  `worktree-agent-ac5706debfe6e6145`
- VERIFIED: SAFE-02 / 4.2 byte-equality gate `tests/safe01/` = 24 passed,
  0 failed (Phase-43 exit gate not regressed)
- VERIFIED: scope — only `src/core/runtime/runtime-43.ts`, one new core test,
  and this SUMMARY changed; STATE.md / ROADMAP.md untouched
