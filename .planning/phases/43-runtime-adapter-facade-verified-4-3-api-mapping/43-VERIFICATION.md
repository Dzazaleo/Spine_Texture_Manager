---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
verified: 2026-05-17
status: gap_closed_pending_phase_reverification
score: D-04 close gate SATISFIED (32/32 SAFE-02 byte-equal); the 1 blocking Phase-43 regression GAP-43-PROD-SEAM is RESOLVED by 43-06 (b3b975b/60b4fac; §4 bounded-exception adjudication, maintainer Option ii, 2026-05-17) — awaiting orchestrator phase-level re-verification/closure
requirements: [RT-02, SAFE-02, SAFE-03, PORT-01, PORT-02, PORT-03]
draft_origin: 43-05 Task 2 (D-04 template + A1 resolution); D-04 table filled by 43-05 Task 3; regression gap appended by execute-phase regression_gate 2026-05-17
gaps:
  - id: GAP-43-PROD-SEAM
    severity: blocking
    requirement: RT-02 / PORT (runtime adapter must work in the production worker, not only vitest)
    summary: "43-03 Option A ESM seam uses prod ambient require('./runtime-42.js'); electron-vite/rollup never emits runtime-42.js/runtime-43.js next to the bundled chunk → built sampler-worker errors 'Cannot find module ./runtime-42.js' on every sample"
    status: RESOLVED
    closed_by: "43-06 (b3b975b electron.vite.config.ts input entries + ../runtime-4x.cjs literal correction; 60b4fac build-required RED→GREEN falsifier)"
    closure: "Prod seam resolves on-disk (RED→GREEN falsifier GREEN); LOCKED Option-A constraints (a)-(d) preserved; SAFE-02 32/32 re-asserted GREEN, 0 baseline regen. The plan's probe-derived `<interfaces>` empirical claim ('runtime-43.cjs has 0 spine-core-42 require literals') was FALSIFIED by the real electron-vite build (pre-existing 43-04 runtime-43.ts → synthetic-atlas.ts AtlasAttachmentLoader edge → 1 bare require(\"spine-core-42\") in runtime-43.cjs). Maintainer adjudicated 2026-05-17 (Option ii — amend §4 doctrine, decouple rejected): §4 lazy-single-copy is scoped to the spine-core RUNTIME/ANIMATION graph (cleanly split + verified; runtime-42.cjs strictly clean, 4.2 path single-copy); the lone parse-time AtlasAttachmentLoader pulled via the shared synthetic-atlas helper onto the 4.3 path is an ACCEPTED, DOCUMENTED, BOUNDED pre-existing 43-04 exception, not a §4 regression. Task-1 AC#8 / checkpoint check #2 strict-zero forms for runtime-43.cjs are SUPERSEDED by this disposition; all other AC pass unchanged. Decouple deferred as a tracked NON-BLOCKING follow-up. See 43-06-SUMMARY.md § '§4 Bounded-Exception Adjudication'."
    route: "/gsd-plan-phase 43 --gaps"
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

**D-04 SATISFIED — but Phase 43 does NOT close: a separate blocking regression was found by the execute-phase regression gate (see below).** The D-04 byte-equality evidence above remains valid and need not be re-derived by gap closure.

---

## Gaps

### GAP-43-PROD-SEAM — Production sampler-worker cannot resolve the Option A ESM seam adapters — ✅ RESOLVED / CLOSED

**Status:** RESOLVED / CLOSED (43-06; maintainer-adjudicated 2026-05-17) · **Severity:** was blocking · **Requirement:** RT-02 / PORT-01..03 (the runtime adapter must function in the production worker, not only under vitest) · **Closed by:** 43-06 (`b3b975b`, `60b4fac`)

> **CLOSURE DISPOSITION (§4 bounded-exception adjudication — maintainer-decided 2026-05-17, Option ii: amend the §4 doctrine; decouple option (i) explicitly rejected):**
>
> The prod seam is fixed: `electron.vite.config.ts` emits `out/main/runtime-4x.cjs` as resolvable entry artifacts and `pickRuntime`'s prod literal is corrected to the on-disk-resolvable `../runtime-4x.cjs` (`b3b975b`); a build-required RED→GREEN-proven falsifier replaces the silent-skip blind-spot (`60b4fac`). The BUILT worker resolves the runtime adapter (no Cannot-find-module); the LOCKED Option-A constraints (a) lazy single-copy on the 4.2 path / (b) env-split byte-untouched / (c) synchronous / (d) loud-throw are all preserved; SAFE-02 is re-asserted 32/32 GREEN with zero baseline regen (D-09).
>
> **Falsified-assumption note:** the gap plan's `<interfaces>` empirical claim — derived from a now-deleted throwaway probe — that "runtime-43.cjs has 0 `require(\"spine-core-42\")` literals (the lone substring is a comment/string)" was **FALSIFIED by the real electron-vite build**: `out/main/runtime-43.cjs:8` emits exactly one bare side-effect `require("spine-core-42")` via the PRE-EXISTING 43-04 edge `runtime-43.ts:56 → synthetic-atlas.ts:57-63` (`SilentSkipAttachmentLoader extends the 4.2 AtlasAttachmentLoader`, committed `f2cf770`, LOCKED, untouched by 43-06 — 43-06 only made it observable by emitting runtime-43 as a standalone artifact). The maintainer adjudicated (Option ii) that ARCHITECTURE §4 "lazy single-copy" is scoped to the spine-core RUNTIME/ANIMATION graph — which IS cleanly split and verified (`runtime-42.cjs` strictly clean, the 4.2 path stays strictly single-copy) — and that the single parse-time `AtlasAttachmentLoader` pulled via the shared `synthetic-atlas` helper onto the 4.3 path is an **ACCEPTED, DOCUMENTED, BOUNDED** pre-existing 43-04 exception, NOT a §4 regression and not introduced by 43-06. Task-1 acceptance criterion #8's strict-zero form for `runtime-43.cjs` and checkpoint check #2's strict-zero form are SUPERSEDED by this adjudicated bounded-exception disposition; all other acceptance criteria passed unchanged. Decoupling `SilentSkipAttachmentLoader`/`synthetic-atlas` from `spine-core-42` for the 4.3 path is a tracked, NON-BLOCKING follow-up (deferred — does NOT block this closure or Phase 43). Full verbatim adjudication: `43-06-SUMMARY.md` § "§4 Bounded-Exception Adjudication".
>
> The original blocking-state analysis below is RETAINED for historical record; it is superseded by this closure.

**(historical — superseded by the closure above) Status when filed:** open · **Severity:** blocking · **Requirement:** RT-02 / PORT-01..03 (the runtime adapter must function in the production worker, not only under vitest) · **Route:** `/gsd-plan-phase 43 --gaps`

**Symptom (reproducible):**
```
npm run build            # electron-vite emits out/main/sampler-worker.cjs + out/main/chunks/sampler-*.cjs
                          # (build then aborts LATER on the pre-existing Phase-47 spine-player MixBlend
                          #  issue — unrelated to this gap; the main/worker chunks ARE emitted first)
npx vitest run tests/main/sampler-worker.spec.ts
  → "sampler-worker — Wave 1 spawn smoke … delivers progress then complete" FAILS
  → worker emits {type:'error', error:{kind:'Unknown',
      message:"Cannot find module './runtime-42.js'
               Require stack: out/main/chunks/sampler-*.cjs ← out/main/sampler-worker.cjs"}}
```

**Root cause:** 43-03's Option A ESM seam (`src/core/runtime/runtime.ts`) resolves the runtime adapters in production via an ambient `require('./runtime-42.js')` / `require('./runtime-43.js')` (the "Assumptions Log A2" branch — vitest uses a globalThis-bound test-only resolver instead). electron-vite v5 with `build.externalizeDeps:true` only externalizes `package.json` `dependencies`; a **relative intra-`src` `require('./runtime-42.js')`** is neither bundled into the chunk nor copied beside it, so at runtime the spawned worker resolves `./runtime-42.js` relative to `out/main/chunks/` where **no such file exists**. `find out -name "*runtime-4*"` → nothing. **Assumptions Log A2 ("ambient require resolves the CJS worker bundle") is falsified by the real electron-vite build.**

**Classification:** Phase-43-introduced (the seam was created by `0ea26c5 feat(43-03)`; the pre-43 worker imported `@esotericsoftware/spine-core` directly and bundled correctly), in-scope for Phase 43, **distinct** from the Phase-47-deferred spine-player/renderer MixBlend item. Masked from 43-03's self-check because every 43-03 vitest test takes the globalThis test-only resolver and never exercises the prod ambient-require-in-bundle path (the Generator self-evaluation blind spot the regression gate exists to catch). The spawn-smoke test additionally only runs against a pre-built bundle, which was stale (pre-rewire) until rebuilt during this gate.

**This touches the LOCKED `project_phase43_pickruntime_esm_split` decision — gap closure must revisit it deliberately, not patch around it.**

**Remediation directions for the gap plan (not prescriptive — the gap planner decides):**
- Make electron-vite/rollup emit `runtime-42`/`runtime-43` as resolvable artifacts next to the chunk (additional rollup input entries, a copy/emit step in `electron.vite.config.ts`, or `manualChunks`), OR
- Replace the prod ambient relative `require('./runtime-*.js')` with a bundler-static form (static import behind the env discriminator, or a `new URL(..., import.meta.url)`-style resolution rollup can trace) while preserving the Option A intent (lazy single-copy prod / globalThis test resolver) and the locked split semantics, OR
- Externalize the adapters as real resolvable modules.
- A falsifying regression test MUST exercise the BUILT bundle's spawn path (the existing `tests/main/sampler-worker.spec.ts` "Wave 1 spawn smoke" against a freshly-built `out/main/sampler-worker.cjs`) so the prod path is no longer self-eval-blind.

**Out of scope for this gap (correctly Phase-47-owned, pre-existing, do NOT fix here):** the 11 `tests/renderer/*.spec.tsx` MixBlend import failures and the `npm run build` abort at `spine-player/dist/Player.js` "MixBlend not exported" — these are the documented Phase-42→47 4.3-canonical-flip carry-forward, unrelated to GAP-43-PROD-SEAM.
