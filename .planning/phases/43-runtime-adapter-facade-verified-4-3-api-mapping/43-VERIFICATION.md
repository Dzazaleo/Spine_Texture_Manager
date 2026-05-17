---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
verified: 2026-05-17
status: passed
score: D-04 hard close gate SATISFIED — 32/32 SAFE-02 byte-equal (12 redistributable + 20 heavy/proprietary), 0 failed
requirements: [RT-02, SAFE-02, SAFE-03, PORT-01, PORT-02, PORT-03]
draft_origin: 43-05 Task 2 (D-04 template + A1 resolution); D-04 table filled by 43-05 Task 3
---

# Phase 43: Runtime Adapter Facade — Verified 4.3 API Mapping — Verification Report

**Phase Goal:** Stand up the dual-runtime adapter facade (`runtime-42` byte-faithful relocation + `runtime-43` verified 4.3 Pose-API port) behind `pickRuntime`, rewire the three core consumers through `load.runtime.*`, and prove the 4.3 path empirically — without disturbing the frozen SAFE-01 4.2 golden corpus.

> **This document is the D-04 hard phase-close gate record.** It is drafted by plan 43-05 Task 2 with the automated evidence already gathered and the A1 resolution; the **D-04 Heavy-Rig SAFE-02 Close Gate** table below is intentionally `PENDING` and is filled by the maintainer in 43-05 Task 3 (the blocking `checkpoint:human-verify`). CI-subset-green is necessary but NOT sufficient — the documented local heavy-rig pass closes the phase.

---

## A1 Rotated-Region Resolution

**A1 FALSIFIED → Approach B applied + re-validated.**

A1 was the single highest-risk assumption (Assumptions Log A1 / T-43-14): the PORT-03 hypothesis that 4.3's native `Sequence.update → computeUVs` already produces correct `rotate:90` region offsets, making `runtime-43.applyRotatedRegionFix` a safe no-op (Approach A, the Plan-04 candidate).

43-05 Task 1 validated this **empirically, not by assumption**: the `rotate:90` regions (`TRIANGLE`, `rect`) in `skeleton2.atlas` were sampled through `runtime-43` and their setup-pose world-quad AABBs compared against the same-session, same-hash (`mFDzgNETPHo`) 4.2-sibling known-good (`skeleton2_42.json` via the byte-trusted `runtime-42` path) within a `1e-4` ground-truth tolerance.

- **Outcome: Approach A FALSIFIED.** The 4.3 native offsets for the rotated regions diverged from the 4.2-sibling known-good well beyond `1e-4` — the Phase-33-class rotated-region undersize bug is **not** fixed natively in 4.3 for this packed-dim layout.
- **Fallback applied: Approach B** (RESEARCH §PORT-03 (B)). `runtime-43.applyRotatedRegionFix` now calls `updateSequence()` to allocate `sequence.offsets[i]`, then overwrites each rotated region's 8 floats with the **SWAP-form corrected-offset math verbatim from `runtime-42`** (`loader.ts:552-613`) — only the write target changes (`sequence.offsets[i]` instead of `attachment.offset[]`); the formula is byte-identical. The 4.2 path is unchanged (SAFE-02 byte-gates it).
- **Re-validated:** with Approach B applied, the A1 test (`tests/runtime43/runtime43-baseline.spec.ts` → "A1: 4.3 rotated-region world geometry matches the 4.2-sibling known-good") **RUNS and PASSES** within `1e-4`. The runtime-43 change is surfaced here and at the Task 3 checkpoint for human review before phase close (the reason 43-05 is `autonomous: false`).

### Task-1 deviations (documented; surfaced for checkpoint review — commit `bd3f4d0`)

| Rule | File | Change | Why |
|------|------|--------|-----|
| [Rule 1 - Bug] | `src/core/runtime/runtime-43.ts` `applyRotatedRegionFix` | no-op → Approach B (SWAP-form into `sequence.offsets[i]`) | A1 empirically falsified — see above |
| [Rule 1 - Bug] | `src/core/runtime/runtime-43.ts` `sequenceRegions` | `regions.length === 0` → `<= 1` | 4.3's mandatory `HasSequence` gives every plain attachment a degenerate single-region holder; Plan-04's check made `fanOutSequencePeaks` wipe **every** 4.3 peak (0 vs the 4.2-sibling's 6). `<= 1` matches 4.2's "only genuine multi-frame sequences fan out" semantic by construction |
| [Rule 1 - Bug] | `src/core/runtime/runtime-43.ts` D-03 dev-assertion | threw on `appliedPose === pose` → asserts `appliedPose` is a usable `BonePose` | 4.3 `Posed.d.ts:33-35` contract: `appliedPose === pose` IS the normal state for unconstrained bones; Plan-04's assertion made the 4.3 sampler unrunnable. The real silent-undersize risk (a broken/absent render-pose accessor) is what the rewritten guard catches |

---

## Automated Evidence (CI-redistributable subset — necessary, NOT sufficient)

Captured by 43-05 Task 1 + Task 2; all green on this machine.

| Check | Command | Result |
|-------|---------|--------|
| 4.3 own-baseline sentinel (D-01, SEPARATE store) | `vitest run tests/runtime43/runtime43-baseline.spec.ts` | ✓ RUN + PASS (3/3; not skipped) |
| A1 rotated-region empirical proof (PORT-03) | same file → "A1 …" test | ✓ RUN + PASS within 1e-4 (Approach B) |
| D-03 SQUARE post-constraint canary (Pitfall 1) | `vitest run tests/runtime43/runtime43-d03.spec.ts` | ✓ RUN + PASS (4.3 SQUARE peak == byte-trusted 4.2-sibling within 1e-4) |
| SAFE-02 + RT-02 anchor (Plan 03) | `vitest run tests/safe01/safe01-baseline.spec.ts` (redistributable subset) | ✓ PASS |
| SAFE-01 enumeration (Q2 — 4.3 fixture lands in `excluded`) | `vitest run tests/safe01/safe01-enumeration.spec.ts` | ✓ PASS, `_manifest.json` unchanged |
| SAFE-01 freeze-guard (D-09) | `vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ✓ PASS |
| 4.3-only fixture commit scope (D-05/Q2) | `git ls-files fixtures/SIMPLE_PROJECT_43/` | ✓ exactly 3 (`skeleton2.json/.atlas/.png`), 0 `_42` (commit `d849726`) |
| SAFE-01 corpus untouched (D-09) | `git status --porcelain tests/safe01/` | ✓ empty |

> Out of 43-05's verification contract (vitest-only): `typecheck:node` currently reports errors that originate **entirely** in gitignored local debris (`scripts/probe-trim-sweep.ts`, `tests/_trace_tmp/trace.spec.ts`) — pre-existing, unrelated, not introduced by Phase 43. Every Phase-43 source/test file typechecks clean in isolation.

---

## D-04 Heavy-Rig SAFE-02 Close Gate

**HARD phase-close gate (Phase 42 D-08-R).** The heavy/proprietary rigs `fixtures/Girl/`, `fixtures/SKINS/`, `fixtures/CHJ/`, `fixtures/3Queens/`, `fixtures/Jokerman/` are gitignored (licensed/proprietary; present only on the maintainer machine — see 42-CONTEXT.md D-08-R two-tier discovery). Their `tests/safe01/baselines/*` files are themselves gitignored and the gate runs them only when present (`it.skipIf(!existsSync(file))` at `tests/safe01/safe01-baseline.spec.ts:83-98`). CI structurally cannot run them.

CI-subset-green is necessary but NOT sufficient; this documented local heavy-rig SAFE-02 byte-equal pass is the D-04 hard close gate (Phase 42 D-08 — subtle drift hides in complex rigs).

**Date of local run:** 2026-05-17
**Run command:** `npx vitest run tests/safe01/safe01-baseline.spec.ts`
**Result:** ✅ **PASS — 32/32 byte-equal (12 git-tracked redistributable + 20 heavy/proprietary), 0 failed, 1 intentionally-excluded skip.**

### Methodology — independent frozen reference (NOT a tautological self-capture)

The heavy-rig baselines were captured against an **independent pre-rewire reference**, not the post-rewire tip (which would be a meaningless self-comparison):

1. An isolated **detached git worktree** was created at frozen commit `c5ef3584459e6545ed659bd1c86fd93e0b0b58f7` — the exact `_meta.generatedCommit` recorded in every trusted git-tracked golden + `_manifest.json` (the original single `spine-core@4.2.111` install, pre-43-03 rewire). The milestone branch was never moved.
2. `npm ci` in the worktree reproduced the locked original `spine-core@4.2.111` (no alias).
3. The gitignored heavy fixtures were copied in; a throwaway capture spec (the 42-01 pattern — deleted, never committed; D-09 no-regen honored) sampled each heavy rig through the **frozen** `loadSkeleton`/`sampleSkeleton` + the same `canonicalize` that produced the trusted 12 goldens.
4. The 20 frozen heavy baselines were copied into `tests/safe01/baselines/` (gitignored — the `.gitignore` allowlist makes them physically uncommittable; D-08-R/D-09). The worktree was force-removed.
5. `npx vitest run tests/safe01/safe01-baseline.spec.ts` on the **rewired tip** then byte-compared rewired-tip 4.2 live output vs the frozen pre-rewire baseline. The `it.skipIf(!existsSync(file))` heavy arm RAN (not skipped).

| Heavy Rig | SAFE-02 byte-equal vs frozen `c5ef358` reference (through the rewired adapter) | Status |
|-----------|------------------------------------------------|--------|
| `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`    | rewired-tip == frozen 4.2.111 | byte-equal ✓ |
| `fixtures/SKINS/` (`JOKERMAN_SPINE`, `JOKERMAN_SPINE_ROT`, `atlases/JOKERMAN_SPINE`, `atlases/JOKERMAN_SPINE_ROT`, `test_repack/JOKERMAN_SPINE_ROT`)   | rewired-tip == frozen 4.2.111 | byte-equal ✓ (5/5) |
| `fixtures/CHJ/CHJWC_SYMBOLS.json`     | rewired-tip == frozen 4.2.111 | byte-equal ✓ |
| `fixtures/3Queens/` (`TQORW_SYMBOLS`, `TQORW_TITLES`) | rewired-tip == frozen 4.2.111 | byte-equal ✓ (2/2) |
| `fixtures/Jokerman/JOKERMAN_SPINE.json`| rewired-tip == frozen 4.2.111 | byte-equal ✓ |
| `fixtures/Chicken/SYMBOLS.json` | rewired-tip == frozen 4.2.111 | byte-equal ✓ |
| `fixtures/MON_FILES/EXPORT/**` (`TEST_00/JOKER_FULL_BODY`, `TEST_01`, `TEST_02`, `TEST_03`, `TEST_03/test_images_only`) | rewired-tip == frozen 4.2.111 | byte-equal ✓ (5/5) |
| `fixtures/Rotated/skeleton2.json` | rewired-tip == frozen 4.2.111 | byte-equal ✓ |
| `fixtures/SAMPLER_ALPHA_ZERO/` (`TOPSCREEN_ANIMATION_JOKER`, `test/TOPSCREEN_ANIMATION_JOKER`) | rewired-tip == frozen 4.2.111 | byte-equal ✓ (2/2) |
| `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json` | rewired-tip == frozen 4.2.111 | byte-equal ✓ |

**Total: 20/20 heavy/proprietary rigs byte-equal through the rewired adapter** (incl. all five D-04-named rigs Girl/SKINS/CHJ/3Queens/Jokerman) **+ 12/12 git-tracked redistributable byte-equal = 32/32, 0 drift.**

**Intentional skip (NOT a gap):** `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json` was deliberately NOT baselined — it is the Phase-44 ORCL-01-reserved 4.2 sibling, explicitly EXCLUDED from the SAFE-02 frozen set (D-05, postdates the Phase-42 baseline). Its `skipIf` skip is the correct, designed behavior.

> If ANY heavy rig had been byte-DIFFERENT: that would be the D-04 failure mode (a non-byte-faithful leaf in the Plan-03 rewire) — NEVER fixed by baseline regen or tolerance relaxation. **None drifted.**

---

## Phase Close Decision

- [x] A1 resolved (FALSIFIED → Approach B applied + re-validated within 1e-4)
- [x] CI-redistributable automated subset green (SAFE-01/SAFE-02/enumeration/freeze-guard/runtime43 baseline+A1+D-03)
- [x] Exactly the 4.3 triplet committed; 4.2 sibling untracked (D-05/Q2); SAFE-01 corpus untouched (D-09)
- [x] **D-04 hard close gate — heavy-rig SAFE-02 byte-equal pass recorded above: 20/20 heavy + 12/12 redistributable = 32/32 byte-equal vs the independent frozen `c5ef358` reference, 0 drift (2026-05-17)**

**D-04 SATISFIED — Phase 43 close gate cleared.** All five D-04-named proprietary rigs (Girl/SKINS/CHJ/3Queens/Jokerman) plus every other heavy rig are byte-identical through the rewired adapter against an independent pre-rewire frozen reference. The Phase-43 dual-runtime adapter rewire is byte-faithful for the 4.2 path even on constraint-heavy proprietary rigs.
