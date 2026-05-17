---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
verified: 2026-05-17T20:40:00Z
status: passed
score: 5/5 ROADMAP success criteria verified (6/6 requirement IDs satisfied)
requirements: [RT-02, SAFE-02, SAFE-03, PORT-01, PORT-02, PORT-03]
overrides_applied: 1
overrides:
  - must_have: "runtime-43.cjs externalizes @esotericsoftware/spine-core and does NOT bundle spine-core-42 (43-06 Task-1 AC#8 / checkpoint check #2 strict-zero form)"
    reason: "MAINTAINER-ADJUDICATED §4 BOUNDED EXCEPTION (Option ii, 2026-05-17, recorded verbatim in 43-06-SUMMARY.md § '§4 Bounded-Exception Adjudication'). out/main/runtime-43.cjs emits ONE bare require(\"spine-core-42\") via the PRE-EXISTING 43-04 edge runtime-43.ts:56 → synthetic-atlas.ts:57-63 (SilentSkipAttachmentLoader extends the 4.2 AtlasAttachmentLoader, committed f2cf770, LOCKED, untouched by 43-06). §4 lazy-single-copy is scoped to the spine-core RUNTIME/ANIMATION graph (cleanly split + verified: runtime-42.cjs strictly clean, 4.2 path single-copy); the lone parse-time AtlasAttachmentLoader edge on the 4.3 path is an accepted, documented, bounded pre-existing exception, NOT a §4 regression. Task-1 AC#8 / checkpoint check #2 strict-zero forms for runtime-43.cjs are SUPERSEDED by this disposition; all other AC pass unchanged. Decouple is a tracked NON-BLOCKING follow-up."
    accepted_by: "maintainer (Leo)"
    accepted_at: "2026-05-17T00:00:00Z"
re_verification:
  previous_status: gap_closed_pending_phase_reverification
  previous_score: "D-04 close gate SATISFIED; GAP-43-PROD-SEAM RESOLVED by 43-06; awaiting phase-level re-verification"
  gaps_closed:
    - "GAP-43-PROD-SEAM — production sampler-worker could not resolve the Option-A ESM seam adapters (Cannot find module ./runtime-42.js). CLOSED by 43-06 (b3b975b electron.vite.config.ts runtime-4x.cjs input entries + ../runtime-4x.cjs literal correction; 60b4fac build-required RED→GREEN spawn-smoke falsifier). Independently re-confirmed GREEN this run: tests/main/sampler-worker.spec.ts 7/7 PASS incl. the Cannot-find-module negative falsifier; out/main/runtime-42.cjs + out/main/runtime-43.cjs emitted on disk; chunk require literal = ../runtime-42.cjs."
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 43: Runtime Adapter Facade — Verified 4.3 API Mapping — Verification Report

**Phase Goal:** Introduce the `SpineRuntime` adapter facade with the 4.2 path proven behavior-neutral (byte-green — the hard phase-exit gate), then implement the 4.3 adapter against the research-verified stable Pose API so the ~750-line sampler/bounds algorithm is never forked.

**Verified:** 2026-05-17T20:40:00Z
**Status:** PASSED
**Re-verification:** Yes — after GAP-43-PROD-SEAM closure (43-06). This document is the authoritative phase-level verdict reflecting GAP-43-PROD-SEAM CLOSED. The prior content (GAP-43-PROD-SEAM gap entry + D-04 close-gate record) is historical context, superseded by this verdict.

## Goal Achievement

### ROADMAP Success Criteria (the non-negotiable contract)

| # | Success Criterion | Requirement | Status | Evidence |
|---|-------------------|-------------|--------|----------|
| 1 | `core/sampler.ts`/`core/bounds.ts` no longer import `@esotericsoftware/spine-core` directly; both call through `load.runtime.*`; `tests/arch.spec.ts` anchor enforces this. Two adapter impls (`runtime-42`, `runtime-43`) exist in `core/runtime/`. | RT-02 | ✓ VERIFIED | `grep` for spine-core imports in sampler.ts/bounds.ts/loader.ts → NONE (loader.ts line-23 match is a comment). sampler.ts 48× `rt.`/`load.runtime` calls; bounds.ts 10× `rt.` calls; loader.ts:250 `const rt = pickRuntime('4.2')`. `tests/arch.spec.ts:361` "Phase 43 RT-02" anchor scans the 3 named consumers + `:298` runtime/ purity anchor — both GREEN (arch.spec.ts in the 64-pass run). `src/core/runtime/{runtime-42.ts (457L), runtime-43.ts (610L), runtime.ts}` all present and substantive. |
| 2 | Every in-repo 4.2 fixture sampled through the new adapter is byte-identical (strict `toEqual` on canonicalized output) to the Phase-42 pre-v1.6 baseline — the phase-exit gate. | SAFE-02 | ✓ VERIFIED | `npx vitest run tests/safe01/safe01-baseline.spec.ts` → **32 passed, 1 skipped, 0 failed** (12 git-tracked redistributable + 20 heavy/proprietary byte-equal vs frozen `c5ef358` independent pre-rewire reference; the 1 skip is the documented D-05 ORCL-01 Phase-44-reserved 4.2-sibling exclusion). D-04 hard close gate SATISFIED (recorded in this file's historical section). |
| 3 | A regression test proves each loaded skeleton's attachments resolve `instanceof` (Region/Vertex/Mesh) against the same runtime instance that loaded it. | SAFE-03 | ✓ VERIFIED | `tests/runtime43/safe03-cross-runtime.spec.ts` → **2/2 PASS, real assertions fire** (`asserted > 0`). `tryLoad43()` is hardened (43-03 verification-integrity fix): PROPAGATES any pickRuntime/parse defect, only genuine fixture-ENOENT returns null; fixture `fixtures/SIMPLE_PROJECT_43/skeleton2.json` IS git-tracked → real 4.3 load through `pickRuntime('4.3')`. Test 1 iterates real skin entries asserting `handleRuntime(a)==='4.3'` (threaded identity) + valid `attachmentKind`; Test 2 proves cross-feed detection via the `brandHandle`/`handleRuntime` runtime backstop. NOT vacuous. |
| 4 | A 4.3 skeleton samples through the 4.3 adapter using the verified-stable Pose API (`setupPose`/`setupPoseSlots`/`setupPoseBones`, overloaded `setAnimation`, `slot.pose.attachment`, `slot.pose.color`, AnimationState `setTrack`/`getTrack`), reading post-constraint `appliedPose`. | PORT-01 | ✓ VERIFIED | `runtime-43.ts` imports ONLY `@esotericsoftware/spine-core` (arch carve-out); Pose API surface present and cited to installed `.d.ts:line`: `setupPose`/`setupPoseSlots`/`setupPoseBones`, overloaded `setAnimation`, `slot.pose.attachment` (SlotPose.d.ts:41), `slot.pose.color` (SlotPose.d.ts:36), `setTrack`/`getTrack`, `bone.appliedPose.getWorldScaleX/Y` (BonePose.d.ts:113-115). D-03 post-constraint canary `tests/runtime43/runtime43-d03.spec.ts` → PASS (SQUARE peak == byte-trusted 4.2-sibling within 1e-4); 4.3 own-baseline PASS. |
| 5 | `core/bounds.ts` (via adapter) computes world vertices for 4.3 `RegionAttachment`/`VertexAttachment`, reads `bone.appliedPose.getWorldScaleX/Y()`, and the v1.4 Phase-33 rotated-atlas offset mechanism is re-expressed for 4.3 with the 4.2 path unchanged + regression-locked. | PORT-02, PORT-03 | ✓ VERIFIED | bounds.ts threads `(rt, sk)` → `rt.regionWorldVertices`/`rt.vertexWorldVertices`/`rt.boneAxisScale`. runtime-43.ts: RegionAttachment `computeWorldVertices(slot, getOffsets(slot.pose), wv, 0, 2)` (RegionAttachment.d.ts:69), VertexAttachment `computeWorldVertices(skeleton, slot, …)` (Attachment.d.ts:77), `appliedPose.getWorldScaleX/Y`. PORT-03: `applyRotatedRegionFix` re-expressed for 4.3 via SWAP-form math byte-identical to runtime-42 written into `sequence.offsets[i]` (Approach B — A1 was empirically FALSIFIED, fallback applied + re-validated). A1 proof `tests/runtime43/runtime43-baseline.spec.ts` → PASS within 1e-4 vs 4.2-sibling known-good. 4.2 path unchanged + regression-locked by SAFE-02 32/32. |

**Score:** 5/5 ROADMAP success criteria verified · 6/6 requirement IDs satisfied (1 PASSED-via-override on the §4 bounded-exception sub-claim — see overrides; this does NOT subtract any roadmap SC).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/runtime/runtime.ts` | `SpineRuntime` facade + `pickRuntime` env-split (vitest globalThis resolver / prod sync require) | ✓ VERIFIED | `function pickRuntime` present; globalThis `__GSD_ESM_ADAPTER_RESOLVER__` resolver-first precedence; prod arm `require('../runtime-42.cjs')`/`require('../runtime-43.cjs')` (43-06 corrected literal); synchronous (no `await import()`). |
| `src/core/runtime/runtime-42.ts` | byte-faithful 4.2.111 relocation; `create()`; all interface methods incl. `attachmentTimelineNames`/`parseSkeleton`/`makeAtlas`/`applyRotatedRegionFix` | ✓ VERIFIED | 457 lines; ONLY sanctioned `from 'spine-core-42'` import; all methods present; SAFE-02 byte-gates it (32/32). |
| `src/core/runtime/runtime-43.ts` | verified 4.3.0 Pose-API adapter; `create()`; D-03 appliedPose-only structural defense | ✓ VERIFIED | 610 lines; ONLY sanctioned `from '@esotericsoftware/spine-core'`; D-03 guard asserts `appliedPose` usable BonePose; all interface methods present. |
| `src/core/sampler.ts` | spine-core-free; ~12 leaf calls via `load.runtime.*`; LOCKED tick order preserved | ✓ VERIFIED | 0 spine-core imports; 48× `rt.`/`load.runtime`. |
| `src/core/bounds.ts` | spine-core-free, instanceof-free; `(rt, sk)` threaded | ✓ VERIFIED | 0 spine-core imports; `rt.attachmentKind`/`regionWorldVertices`/`vertexWorldVertices`/`boneAxisScale`/`attachmentRegionMeta`/`attachmentUVs`. |
| `src/core/loader.ts` | spine-core-free; hard-pick `pickRuntime('4.2')` (D-02); parse seam delegated | ✓ VERIFIED | 0 spine-core imports; `pickRuntime` imported `:45`, `pickRuntime('4.2')` `:250`. |
| `tests/arch.spec.ts` | RT-02 named anchor (3 consumers) + runtime/ purity anchor | ✓ VERIFIED | `:361` Phase 43 RT-02 anchor; `:298` runtime/ purity. Both GREEN. |
| `electron.vite.config.ts` | `runtime-42`/`runtime-43` rollup input entries → emitted `out/main/runtime-4x.cjs` | ✓ VERIFIED | `out/main/runtime-42.cjs` (9178B) + `out/main/runtime-43.cjs` (10803B) emitted on disk. |
| `tests/runtime43/{safe03-cross-runtime,runtime43-baseline,runtime43-d03}.spec.ts` + `load43.ts` | SAFE-03 / 4.3 baseline / D-03 canary seams + hardened loader | ✓ VERIFIED | All present; all PASS with real assertions; `load43.ts` propagates defects (no silent swallow). |
| `tests/main/sampler-worker.spec.ts` | build-required spawn-smoke GAP-43-PROD-SEAM falsifier | ✓ VERIFIED | Hard-fails (never skips) on absent/stale bundle; explicit `/Cannot find module .*runtime-4/` negative assertion; 7/7 PASS. |
| `fixtures/SIMPLE_PROJECT_43/{skeleton2.json,.atlas,.png}` | exactly the 4.3 triplet committed; 4.2 sibling untracked (D-05/Q2) | ✓ VERIFIED | `git ls-files` → exactly 3 (no `_42`); `skeleton2_42.*` shows `??` (untracked) — correct. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `loader.ts` | `runtime.ts pickRuntime` | `const rt = pickRuntime('4.2')` unconditional hard-pick (D-02) | ✓ WIRED | loader.ts:250 |
| `sampler.ts`+`bounds.ts` | `load.runtime` (SpineRuntime) | all leaf calls via `rt.*` | ✓ WIRED | 48 + 10 call sites; 0 spine-core imports |
| `runtime-42.ts` | `spine-core-42` | the ONLY sanctioned 4.2 import | ✓ WIRED | `from 'spine-core-42'` line 42 |
| `runtime-43.ts` | `@esotericsoftware/spine-core` | the ONLY sanctioned 4.3 import | ✓ WIRED | `from '@esotericsoftware/spine-core'` line 42 |
| `runtime-43.ts boneAxisScale` | `bone.appliedPose` | post-constraint world-scale read + D-03 dev-assertion | ✓ WIRED | `appliedPose.getWorldScaleX/Y`; D-03 guard |
| `out/main/sampler-worker.cjs` | `out/main/runtime-42.cjs` | chunk → `pickRuntime` → `require('../runtime-42.cjs')` resolved from `out/main/chunks/` | ✓ WIRED | chunk `sampler-C9iw47Gq.cjs` emits `require("../runtime-42.cjs")`; artifact exists; spawn-smoke 7/7 GREEN |
| `electron.vite.config.ts` | `out/main/runtime-4x.cjs` | rollup input entries + `entryFileNames:'[name].cjs'` | ✓ WIRED | both artifacts emitted on disk after build |
| `tests/safe01/safe01-baseline.spec.ts` | frozen Phase-42 SAFE-01 baselines | strict `toEqual` through rewired path | ✓ WIRED | 32/32 byte-equal, 0 drift |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `sampler.ts`/`bounds.ts` | sampled world AABB / peak scale | `load.runtime.*` → `runtime-42.ts` (spine-core-42 `computeWorldVertices` after `updateWorldTransform`) | Yes — SAFE-02 proves byte-identical real sampler output for 32 fixtures incl. 20 heavy rigs | ✓ FLOWING |
| `runtime-43.ts` | 4.3 world geometry / SQUARE post-constraint peak | `@esotericsoftware/spine-core@4.3.0` Pose API; `appliedPose` reads | Yes — 4.3 own-baseline byte-stable; D-03 canary SQUARE peak == 4.2-sibling within 1e-4; A1 rotated-region within 1e-4 | ✓ FLOWING |
| `out/main/sampler-worker.cjs` | live worker sample of SIMPLE_PROJECT | spawned Worker → chunk → `require('../runtime-42.cjs')` → spine-core-42 | Yes — spawn-smoke delivers `complete` with progress, NO Cannot-find-module error | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RT-02 anchor + runtime43 + SAFE-01/02 enumeration/freeze regression surface | `npx vitest run tests/arch.spec.ts tests/runtime43/ tests/safe01/` | 8 files passed, 64 passed / 2 intentional skips / 0 failed | ✓ PASS |
| SAFE-02 hard phase-exit byte gate | `npx vitest run tests/safe01/safe01-baseline.spec.ts` | 32 passed / 1 intentional skip / 0 failed | ✓ PASS |
| SAFE-03 cross-runtime instanceof + cross-feed backstop | `npx vitest run tests/runtime43/safe03-cross-runtime.spec.ts` | 2/2 PASS, real assertions fire (`asserted > 0`) | ✓ PASS |
| PORT-01/03 A1 rotated-region + D-03 post-constraint canary + 4.3 own-baseline | `npx vitest run tests/runtime43/runtime43-baseline.spec.ts tests/runtime43/runtime43-d03.spec.ts` | 3/3 PASS within 1e-4 | ✓ PASS |
| GAP-43-PROD-SEAM falsifier — BUILT worker resolves runtime adapter | `npx vitest run tests/main/sampler-worker.spec.ts` | 7/7 PASS; NO `Cannot find module .*runtime-4` | ✓ PASS |
| Lazy single-copy split (built artifacts) | `grep require\\(spine-core\\) out/main/runtime-4{2,3}.cjs` | `runtime-42.cjs`: 1× `spine-core-42`, 0× 4.3 (strictly clean); `runtime-43.cjs`: 1× `@esotericsoftware/spine-core` + 1× `spine-core-42` (the adjudicated §4 bounded exception) | ✓ PASS (override-scoped) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| RT-02 | 43-01,02,03,04,06 | Adapter interface + 2 impls; sampler/bounds spine-core-free; arch anchor | ✓ SATISFIED | SC#1; arch.spec.ts:361/:298 GREEN; runtime-42/43 present |
| SAFE-02 | 43-02,03,05,06 | Every in-repo 4.2 fixture byte-identical to pre-v1.6 baseline | ✓ SATISFIED | SC#2; 32/32 byte-equal, 0 drift, D-09 baselines untouched |
| SAFE-03 | 43-01 | Cross-runtime instanceof regression test | ✓ SATISFIED | SC#3; safe03-cross-runtime.spec.ts 2/2 real-assertion PASS (REQUIREMENTS.md `[ ]`/`Pending` is stale tracking metadata — implementation verified present + exercised in the codebase) |
| PORT-01 | 43-04,05,06 | 4.3 sampling via verified-stable Pose API reading appliedPose | ✓ SATISFIED | SC#4; runtime-43.ts cited Pose API; D-03 canary PASS |
| PORT-02 | 43-04,06 | 4.3 RegionAttachment/VertexAttachment world vertices + appliedPose scale | ✓ SATISFIED | SC#5; bounds.ts via adapter; computeWorldVertices signatures verified |
| PORT-03 | 43-01,02,04,05,06 | Phase-33 rotated-atlas mechanism re-expressed for 4.3; 4.2 unchanged | ✓ SATISFIED | SC#5; Approach B (A1 falsified→fallback); A1 proof PASS within 1e-4; SAFE-02 locks 4.2 path |

All 6 requirement IDs declared across the 6 plan frontmatters are accounted for and SATISFIED. No orphaned requirements: REQUIREMENTS.md maps exactly `RT-02, SAFE-02, SAFE-03, PORT-01, PORT-02, PORT-03` to Phase 43 (line 161) — all claimed by plans and verified. SLIDER (line 56, "PORT-03 reshaped: fixture-only") is a separate downstream-phase concern, not a Phase-43 requirement ID.

> **Tracking-metadata note (not a gap):** REQUIREMENTS.md line 36 (`[ ] SAFE-03`) and line 130 (`SAFE-03 | Phase 43 | Pending`) are stale checkbox/status tracking, NOT a goal failure. Goal-backward verification confirms the SAFE-03 implementation exists, is wired, and is exercised by a non-vacuous passing test against a real git-tracked 4.3 fixture. The checkbox should be flipped to `[x]`/`Complete` as a docs-tracking follow-up; it does not block phase closure.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `runtime-43.ts` | 383-392 | `placeholder` keyword | ℹ️ Info | False positive — `placeholder` is the literal Spine 4.3 `SkinEntry` field name (verified `Skin.d.ts:38`), normalized to `.name`. Not a stub. |
| `runtime-42.ts`/`runtime-43.ts` | various | `return null` in region/uv/sequence resolution | ℹ️ Info | Legitimate guard clauses for absent region meta — the bounds caller handles `null`. Not unimplemented stubs. |
| `tests/main/sampler-worker.spec.ts` | 198-243 | 43-REVIEW WR-01..04 (worker-leak on error path; minor test robustness) | ⚠️ Info/Warning | Test-quality only; 43-REVIEW.md: 0 critical, "No blockers — production behavior is correct". Does NOT block the phase goal. |

No blocker anti-patterns. No production-code stubs.

### Documented Out-of-Scope (NOT regressions, NOT Phase-43 failures — Phase-47-owned by ROADMAP design)

- ~11 `tests/renderer/*.spec.tsx` MixBlend import failures (AnimationPlayerModal ESM mismatch) — pre-existing, memory-confirmed, not a regression.
- `npm run build` spine-player `Player.js` "MixBlend not exported" abort — fires AFTER main/worker chunks emit (the spawn-smoke runs `npx electron-vite build` and tolerates the downstream non-zero exit by asserting artifact freshness/existence). Phase-42→47 4.3-canonical-flip carry-forward.
- In a fresh worktree: 2 gitignored heavy-fixture-absent files. Not Phase-43 failures.

Per the verification directive, the phase is NOT failed on any of these.

### Human Verification Required

None. All success criteria are verifiable programmatically and were verified GREEN this run. The single blocking `checkpoint:human-verify` (43-06 Task 3) was already satisfied by the maintainer's Option-(ii) §4 bounded-exception adjudication recorded verbatim in 43-06-SUMMARY.md (2026-05-17) — that human decision is captured in the `overrides:` frontmatter and is not re-requested.

### Gaps Summary

No gaps. GAP-43-PROD-SEAM (the sole prior blocking regression — the production sampler-worker could not resolve the Option-A ESM seam) is CLOSED and independently re-confirmed GREEN this run:

- `b3b975b` emits `out/main/runtime-42.cjs` + `out/main/runtime-43.cjs` as resolvable rollup input entries and corrects the prod `pickRuntime` literal to the on-disk-resolvable `../runtime-4x.cjs`; both artifacts confirmed present on disk; the worker chunk emits `require("../runtime-42.cjs")` which resolves correctly from `out/main/chunks/`.
- `60b4fac` hardens the spawn-smoke into a true falsifier: build-required (hard-fails, never silent-skips, on stale/absent bundle), with an explicit `/Cannot find module .*runtime-4/` negative assertion. Re-run: 7/7 PASS.
- LOCKED Option-A constraints preserved: lazy single-copy on the 4.2 path (`runtime-42.cjs` strictly clean — 0× 4.3), env-split byte-untouched, synchronous require, loud-throw.
- SAFE-02 re-asserted 32/32 byte-equal with zero baseline regen (D-09).
- The `runtime-43.cjs` lone `require("spine-core-42")` (PRE-EXISTING 43-04 `SilentSkipAttachmentLoader extends AtlasAttachmentLoader` edge) is the maintainer-adjudicated, documented, bounded §4 exception (Option ii) — recorded as an override, scored as PASSED, decouple tracked as a NON-BLOCKING follow-up. It does NOT fail the phase.

The phase goal is achieved: the `SpineRuntime` adapter facade is in place, the 4.2 path is proven behavior-neutral (byte-green — the hard phase-exit gate, 32/32), the 4.3 adapter is implemented against the research-verified stable Pose API and empirically validated (A1/D-03/own-baseline), and the ~750-line sampler/bounds algorithm is NOT forked (single algorithm, two adapters, RT-02 anchored). Phase 43 is complete and ready to proceed to Phase 44.

### Post-completion addendum — GAP-43-CLI-SEAM (found 2026-05-17 by user run; CLOSED in 43-07)

**Status unchanged (`passed`).** After phase completion the user ran the CLAUDE.md-documented `npm run cli -- <skeleton>` command and it errored `pickRuntime('4.2'): no ESM adapter resolver is registered and ambient require is unavailable`. Root cause: the Phase-43 `pickRuntime` env-split has **three** runtimes — (1) vitest (globalThis resolver via `setupFiles`), (2) the built electron-vite CJS worker (ambient `require('../runtime-4x.cjs')`), and (3) Node-from-source via `tsx scripts/cli.ts`. The 43-05/43-06 verification surface exercised only (1) and (2); runtime (3) fell through to pickRuntime's loud-throw arm. This was a real Phase-43-introduced regression in a documented entrypoint that the 5/5 goal-verification did not catch **because no test exercised the `npm run cli` runtime** (the spawn-smoke proves the built worker; SAFE-02 proves vitest; neither is the tsx/ESM-source path).

**Closed by 43-07:** `scripts/register-esm-adapter-resolver.ts` (a `scripts/` entrypoint bootstrap, NOT `src/` — the Node analog of the sanctioned `tests/setup/esm-adapter-resolver.ts`) binds pickRuntime arm 1 for the CLI runtime; `scripts/cli.ts` side-effect-imports it first. LOCKED Option-A constraints preserved (prod ambient-require arm byte-unchanged, no `src/` static adapter import, resolution-only/real adapters, synchronous). Commits: `f7caa6a` (fix), `b933c77` (regression guard — spawns the real `npx tsx scripts/cli.ts` child process and asserts the specific no-resolver-loud-throw negative + a real peak table; RED pre-fix per the verbatim loud-throw observed this session, GREEN post-fix). `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` now exits 0 with the locked peak table.

**Lesson (carried to memory):** the env-split's runtime count (3) exceeded the verified runtime count (2). A facade/seam that resolves differently per runtime MUST have every documented entrypoint runtime in the verification surface, not only the test harness + the primary built artifact.

---

## Historical Record (superseded — retained for traceability)

The content below is the prior verification state (D-04 hard close-gate record + the GAP-43-PROD-SEAM gap entry). It is RETAINED for audit traceability and is SUPERSEDED by the PASSED verdict above. GAP-43-PROD-SEAM is CLOSED.

### A1 Rotated-Region Resolution (historical)

A1 FALSIFIED → Approach B applied + re-validated within 1e-4. The PORT-03 hypothesis that 4.3's native `Sequence.update → computeUVs` already produces correct `rotate:90` region offsets (Approach A no-op) was empirically FALSIFIED by sampling `skeleton2.atlas` `rotate:90` regions through `runtime-43` vs the same-hash 4.2-sibling known-good within 1e-4. Fallback Approach B: `runtime-43.applyRotatedRegionFix` calls `updateSequence()` then overwrites each rotated region's 8 floats with the SWAP-form corrected-offset math byte-identical to `runtime-42` (write target `sequence.offsets[i]` instead of `attachment.offset[]`). Re-validated PASS. The 4.2 path is unchanged (SAFE-02-gated).

Task-1 deviations (commit `bd3f4d0`): `applyRotatedRegionFix` no-op→Approach B; `sequenceRegions` `=== 0`→`<= 1` (4.3's mandatory `HasSequence` gives every plain attachment a degenerate single-region holder); D-03 dev-assertion rewritten to assert `appliedPose` is a usable `BonePose` (4.3 `Posed.d.ts:33-35`: `appliedPose === pose` IS normal for unconstrained bones — the real silent-undersize risk is a broken/absent render-pose accessor).

### D-04 Heavy-Rig SAFE-02 Close Gate (historical — SATISFIED)

HARD phase-close gate (Phase 42 D-08-R). Heavy/proprietary rigs (`fixtures/Girl/`, `SKINS/`, `CHJ/`, `3Queens/`, `Jokerman/` + others) are gitignored; their baselines run only when present (`it.skipIf(!existsSync(file))`). Captured against an independent frozen pre-rewire reference (detached worktree at `c5ef3584459e6545ed659bd1c86fd93e0b0b58f7` — the `_meta.generatedCommit` of every trusted golden, original single `spine-core@4.2.111` install, no alias). **Result: 20/20 heavy/proprietary + 12/12 git-tracked redistributable = 32/32 byte-equal vs the independent frozen reference, 0 drift (2026-05-17).** Intentional skip: `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json` is the Phase-44 ORCL-01-reserved 4.2 sibling, explicitly EXCLUDED from the SAFE-02 frozen set (D-05). Independently re-confirmed GREEN this verification run (32 passed / 1 skip / 0 failed).

### GAP-43-PROD-SEAM (historical — RESOLVED / CLOSED)

**Status when filed:** open · blocking · RT-02/PORT-01..03 (the runtime adapter must function in the production worker, not only under vitest). **Symptom:** built `out/main/sampler-worker.cjs` threw `Cannot find module './runtime-42.js'` on every sample — 43-03's Option-A prod ambient `require('./runtime-42.js')` was never emitted beside the bundled chunk by electron-vite. **Root cause:** Assumptions Log A2 falsified — a relative intra-`src` `require('./runtime-42.js')` is neither bundled into the chunk nor copied beside it. Masked from 43-03's self-check because every 43-03 vitest test takes the globalThis test-only resolver (Generator self-eval blind spot). **CLOSED by 43-06** (`b3b975b` + `60b4fac`; §4 bounded-exception adjudication Option ii, maintainer-decided 2026-05-17). The prod seam resolves on-disk (RED→GREEN falsifier GREEN), LOCKED Option-A constraints preserved, SAFE-02 32/32 re-asserted, 0 baseline regen. The plan's probe-derived empirical claim that `runtime-43.cjs` has 0 `spine-core-42` literals was FALSIFIED by the real build (the pre-existing 43-04 `SilentSkipAttachmentLoader extends AtlasAttachmentLoader` edge → 1 bare `require("spine-core-42")`); maintainer adjudicated §4 lazy-single-copy is scoped to the spine-core RUNTIME/ANIMATION graph (cleanly split + verified) and the lone parse-time AtlasAttachmentLoader edge on the 4.3 path is an accepted, documented, bounded pre-existing exception. Decouple deferred as a tracked NON-BLOCKING follow-up.

---

_Verified: 2026-05-17T20:40:00Z_
_Verifier: Claude (gsd-verifier) — goal-backward re-verification after GAP-43-PROD-SEAM closure_
