---
phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
verified: 2026-05-18T13:05:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring Verification Report

**Phase Goal:** Repurpose the loader from rejecter to version dispatcher, acquire the owner-blocked in-repo 4.3 fixtures (scheduled early, off the critical path), and stand up the layered equivalence oracle that gates every 4.3-feature claim before any user-facing flip.
**Verified:** 2026-05-18T13:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Loader detects skeleton version and routes 4.2→4.2 runtime, 4.3→4.3 runtime; checkSpine43Schema repurposed rejecter→routing-signal; routing decided BEFORE runtime load (DISP-01, DISP-03) | ✓ VERIFIED | `src/core/loader.ts:237-308` exports `resolveRuntimeTag`; the `:395` call site is `pickRuntime(resolveRuntimeTag(spineFieldForDispatch, parsedJson, skeletonPath))` with NO unconditional `checkSpineVersion`/`checkSpine43Schema` pre-call (the 44-03 Rule-3 single-gate fix removed them — confirmed by reading the file: only `resolveRuntimeTag` gates). `parsedJson`+`spineFieldForDispatch` extracted at `:373-389`, BEFORE atlas-resolve (`:542`) + `rt.parseSkeleton` (`:658`) → DISP-03 structurally satisfied. `checkSpine43Schema`'s top-level-`constraints[]` sniff is repurposed verbatim into the D-08 contradiction cross-check (`loader.ts:278-282`). Runtime proof: `loader-version-guard.spec.ts:127-134` asserts `loadSkeleton(FIXTURE_43)` `not.toThrow` + `handleRuntime(load.skeletonData) === '4.3'`; `:173-174` asserts `handleRuntime === '4.2'` for the 4.2 golden. `npx vitest run tests/core/loader-version-guard.spec.ts` GREEN. |
| 2 | Genuinely unsupported versions still reject with the typed-error envelope: <4.2 guard preserved AND a NEW ≥4.4 guard arm added (DISP-02) | ✓ VERIFIED | `loader.ts:259-261` preserves `major<4 \|\| (4&&minor<2)` throw (Phase 12 F3); `loader.ts:263-269` is the NEW SPLIT-OUT `(major===4&&minor>=4)\|\|major>=5` reject arm (not folded — 4.3 is NOT left unguarded). `errors.ts:100-145` is the 3-branch `SpineVersionUnsupportedError`: `ge44` LOCKED wording (`This file is from Spine ... This app supports Spine 4.2 and 4.3...`), `contradiction` discretion wording, `unsupported` PRESERVED-verbatim <4.2 wording; old "re-export as 4.2 (supported downgrade)" string REMOVED; `.name='SpineVersionUnsupportedError'` byte-identical at `:143` (IPC routes by it). Predicate tests: `loader-version-guard-predicate.spec.ts:164-211` — `resolveRuntimeTag('4.4.0',...)` THROWS, `'5.0.0'` THROWS, `'4.1.99'`/`'3.8.99'`/`null`/`'not-a-version'` THROW. All GREEN. |
| 3 | Owner-exported SIMPLE_TEST-equivalent rig committed in-repo + redistributable as BOTH "Version 4.3" and "Version 4.2"; spine-editor#891 dispositioned (ORCL-03 = v1.6 NO-OP; ik absent in both JSONs) (ORCL-01, ORCL-03) | ✓ VERIFIED | `git ls-files` confirms `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg, spine `4.3.01`) + `skeleton2_42.{json,atlas,png}` (4.2 sibling, spine `4.2-from-4.3.01`) + the 3 owner rigs `SLIDER_4_3/SLIDER-01.*`, `XTRA01_4_3/XTRA-01.*`, `XTRA02_4_3/XTRA-02.*` (+ `XTRA02_4_3/NOTES.md`) all git-tracked, non-ignored. ORCL-03 disposition VERIFIED SOUND: `python3` JSON parse shows `ik` absent in BOTH `skeleton2.json` AND `skeleton2_42.json` (constraint types = `transform`/`path` only; substring `"ik"` does not appear in either file) → spine-editor#891 (4.3→4.2 IK-scramble) is structurally impossible → ORCL-03 v1.6 NO-OP is correct, no human gate needed. |
| 4 | Same-rig cross-runtime equivalence test asserts 4.3 vs 4.2 runtime agree within 1e-4 on the ORCL-01 rig; ORCL-02 HARD gate strict/not-waived; CORE-FIX (2d0246c) closed the ~2.251× mesh-undersize defect; re-capture moved ONLY CIRCLE mesh records (ORCL-02) | ✓ VERIFIED | `tests/runtime43/orcl02-equivalence.spec.ts` (read in full): D-12 compares ALL THREE maps (`globalPeaks`+`perAnimation`+`setupPosePeaks`, `MAP_NAMES` line 68); D-13 HYBRID abs-OR-rel comparator with rel arm `diff/Math.max(abs(a),abs(b))<=1e-4` (lines 47-51); D-14 HARD gate — NO `it.skipIf`, only `built43/built42==null` fixture-absence skip (lines 169-175), value divergence is `expect(divergences.length).toBe(0)` (line 202-228), embedded 4-cause diagnosis protocol, "do NOT widen tolerance" stated; key-set divergence = hard fail (lines 91-104); defense-in-depth non-empty assertion (lines 234-239). CORE-FIX: `runtime-43.ts:557-615` routes mesh through `MeshAttachment.computeUVs(region, regionUVs, out)` (page-space). `tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts` GREEN with logged `CIRCLE mesh scale 4.2 = 0.500003311400526 / 4.3 = 0.500003311400526 / rel-divergence = 0` (exact). Re-capture scope (44-04-SUMMARY): 23 records, 17 unchanged, 6 moved — all 6 are `default/.../CIRCLE/CIRCLE` at exactly 2.251056×; 0 non-CIRCLE moved. `npx vitest run tests/runtime43/` GREEN. |
| 5 | 4.3 transform-constraint multi-map fixture (XTRA-01) and 4.3 IK scaleYMode fixture (XTRA-02, Uniform+Volume, default None 4.2-equiv) both sample correctly through the adapter (XTRA-01, XTRA-02) | ✓ VERIFIED | `fixtures/XTRA01_4_3/XTRA-01.json` (spine 4.3.02): 1 transform constraint with `properties.x.to = {x:{max:100}, rotate:{max:360,scale:3.6}}` (one source → TWO differently-typed targets — the multi-map feature), `localTarget:true` + `localSource` absent (local↔world), `clamp:true`, `mixRotate:0.9054`≠1.0. `xtra01-structural.spec.ts` asserts all D-03-c invariants (≥2 toKinds, ≥1 local + ≥1 world, mix≠1.0) — passes against the real fixture. `fixtures/XTRA02_4_3/XTRA-02.json` (spine 4.3.01): 2 IK constraints `scaleY:"uniform"` + `scaleY:"volume"`; `xtra02-structural.spec.ts` normalizes via the pinned 4.3.0 `Utils.enumValue` rule (first-letter-uppercase) and asserts BOTH `Uniform` AND `Volume` present. `xtra01-baseline.spec.ts`+`xtra02-baseline.spec.ts` (own-baseline store, committed light sentinels) + the no-throw sample = D-03 a+b+c. SLIDER smoke (D-02 existence + no-throw, no Phase-46 closed-form). `npx vitest run tests/runtime43/` = 15 files / 74 tests GREEN. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/loader.ts` | exported `resolveRuntimeTag()`; :250 hard-pick flipped to a dispatch call | ✓ VERIFIED | `resolveRuntimeTag` at :237-308 (token-primary D-06/07 + D-08 contradiction + split-out ≥4.4 D-09); `pickRuntime(resolveRuntimeTag(...))` at :395; NO unconditional pre-call (44-03 single-gate fix); spine-core-import-free (grep clean — RT-02) |
| `src/core/errors.ts` | `SpineVersionUnsupportedError` 2→3 branch; `.name` byte-identical | ✓ VERIFIED | `kind: 'ge44'\|'contradiction'\|'unsupported'` at :110-141; LOCKED ≥4.4 + PRESERVED <4.2 wordings; old "re-export as 4.2 (supported downgrade)" removed; `this.name='SpineVersionUnsupportedError'` at :143 |
| `src/core/runtime/runtime-43.ts` | mesh `attachmentUVs` page-space (CORE-FIX) | ✓ VERIFIED | `:557-615` MeshAttachment branch routes via `sequence.regions[idx]` + `MeshAttachment.computeUVs(region,regionUVs,out)` → page-space UVs; RegionAttachment branch byte-untouched |
| `tests/runtime43/orcl02-equivalence.spec.ts` | ORCL-02 all-3-maps HARD gate | ✓ VERIFIED | D-12/13/14 all present; reuses `buildLoad43`+`buildLoadSibling42`; GREEN |
| `tests/runtime43/baseline-driver.ts` | `buildLoadXtra01`+`buildLoadXtra02` | ✓ VERIFIED | both exported (44-01); consumed by xtra baseline specs; runtime43 suite GREEN |
| `tests/runtime43/xtra01-structural.spec.ts` / `xtra02-structural.spec.ts` | D-03-c anti-green-wash assertions | ✓ VERIFIED | XTRA-01: ≥2 toKinds + local/world + mix≠1.0 (passes real fixture); XTRA-02: scaleY Uniform AND Volume via pinned enumValue rule |
| `tests/safe01/discover-fixtures.ts` | 6-dir D-04 denylist | ✓ VERIFIED | `SAFE01_EXCLUDED_PREFIXES` = 6 dirs (4 named + 2 beta canaries); `SPINE_3_8_TEST/` correctly NOT denylisted; `.filter(...startsWith(p))` applied |
| `tests/safe01/phase-gate.ts` | `CURRENT_PHASE = 44` | ✓ VERIFIED | armed (44-01); `phase44-fixture-guard.spec.ts` passes not-skipped (safe01 suite GREEN) |
| Fixtures: `skeleton2_42.*`, `SLIDER_4_3/`, `XTRA01_4_3/`, `XTRA02_4_3/`, baselines | git-tracked + redistributable | ✓ VERIFIED | `git ls-files` lists all 17 artifacts; non-ignored |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `loader.ts resolveRuntimeTag` | `runtime.ts pickRuntime` | `pickRuntime(resolveRuntimeTag(...))` at :395 | ✓ WIRED | grep confirms; no `pickRuntime('4.2')` literal remains |
| `orcl02-equivalence.spec.ts` | `baseline-driver.ts buildLoad43+buildLoadSibling42` | `sample(buildLoad43().load)` vs `sample(buildLoadSibling42().load)` all 3 maps | ✓ WIRED | spec imports + calls both; GREEN |
| `xtra0{1,2}-baseline.spec.ts` | `buildLoadXtra0{1,2}` + `baselines/XTRA0{1,2}_4_3.json` | first-capture-then-strict `toEqual` | ✓ WIRED | baselines git-tracked; specs GREEN |
| `loader.ts dispatch` | built `out/main` CJS worker + `npm run cli` (tsx/ESM) | 3-entrypoint matrix | ✓ WIRED | 44-03-SUMMARY records all 3 entrypoints GREEN (vitest + built worker spawn on skeleton2.json + CLI exit 0 with table); GAP-43-CLI/PROD-SEAM signatures verified absent |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Dispatch + oracle + 4.2 byte-gate green | `npx vitest run tests/runtime43/ tests/core/loader-version-guard.spec.ts tests/safe01/` | 15 files / 74 tests passed | ✓ PASS |
| DISP predicate + error + smoke + core-fix | `npx vitest run tests/core/loader-version-guard*.spec.ts tests/core/errors-version.spec.ts tests/runtime/d13-43-load-smoke.spec.ts tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts` | 6 files / 78 tests passed; CIRCLE rel-divergence = 0 | ✓ PASS |
| Full suite (regression / known-noise confirm) | `npx vitest run` | 1273 passed / 1 skipped / 2 todo; 0 actual test failures (11 failed FILES = pre-existing tests/renderer/* MixBlend import noise, Phase-47-owned) | ✓ PASS |
| ORCL-03 disposition: ik absent in both JSONs | `python3` JSON parse of skeleton2.json + skeleton2_42.json | `ik` absent both; constraints = transform/path only; substring `"ik"` absent | ✓ PASS |
| XTRA fixtures genuinely exercise the feature | `python3` JSON parse of XTRA-01/02.json | XTRA-01: 1 source→2 typed targets+clamp+localTarget; XTRA-02: scaleY uniform+volume | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DISP-01 | 44-02, 44-03 | Loader detects version, routes 4.2→4.2 / 4.3→4.3; checkSpine43Schema repurposed to routing signal | ✓ SATISFIED | resolveRuntimeTag dispatch + D-08 sniff repurpose; routing-target proven via handleRuntime |
| DISP-02 | 44-02 | <4.2 guard preserved + NEW ≥4.4 guard arm; typed-error envelope | ✓ SATISFIED | loader.ts:259-269 split arms; errors.ts 3-branch; predicate tests green |
| DISP-03 | 44-02, 44-03 | Routing decided BEFORE runtime load (4.2 never silently loaded by 4.3) | ✓ SATISFIED | dispatch computed at :395 from parsedJson/spineField extracted :373-389, before atlas-resolve+parseSkeleton |
| ORCL-01 | 44-01 | Owner rig as BOTH 4.3 + 4.2, in-repo redistributable | ✓ SATISFIED | git-tracked skeleton2.json + skeleton2_42.* + 3 owner rigs; non-ignored |
| ORCL-02 | 44-04 | Cross-runtime equivalence within 1e-4 (HARD gate) | ✓ SATISFIED | orcl02-equivalence.spec.ts D-12/13/14 strict; GREEN post core-fix (rel-div=0 CIRCLE) |
| ORCL-03 | 44-03, 44-04 | spine-editor#891 dispositioned | ✓ SATISFIED | v1.6 NO-OP; ik absent in BOTH JSONs verified by parse → #891-immune; no human gate |
| XTRA-01 | 44-04 | 4.3 transform-constraint multi-map samples correctly | ✓ SATISFIED | XTRA-01.json 1 src→2 typed targets+clamp+local; baseline+structural specs green |
| XTRA-02 | 44-04 | 4.3 IK scaleYMode Uniform+Volume; default None 4.2-equiv | ✓ SATISFIED | XTRA-02.json scaleY uniform+volume; structural spec asserts both via pinned enumValue |

All 8 phase requirement IDs accounted for and SATISFIED. No orphaned requirements (REQUIREMENTS.md Phase-44 row maps exactly DISP-01/02/03, ORCL-01/02/03, XTRA-01/02 — all covered).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/runtime43/orcl02-equivalence.spec.ts` | 152 | string/key-field diff loop iterates only `Object.keys(r43)` (union not used) | ℹ️ Info | WR-02 from 44-REVIEW. Numeric fields (the existential wrong-pose canary) use a FIXED `NUMERIC_FIELDS` list — fully symmetric & safe. Only string/key fields have the asymmetry; not a goal blocker (a numeric undersize cannot hide here). Robustness gap, not a defect. |
| `tests/runtime43/xtra01-baseline.spec.ts` / `xtra02-baseline.spec.ts` | capture path | first-capture writes-then-asserts same run (tautological on capture) | ℹ️ Info | WR-04 from 44-REVIEW. Baselines ARE committed (git ls-files non-empty) so the next-run sentinel has teeth; the live risk is contained. No empty-map sanity floor on the XTRA capture path (ORCL-02 has one). Robustness suggestion, not a goal blocker. |
| `tests/runtime43/baseline-driver.ts` | 66-118 | hand-rolled libgdx atlas parser (`buildSourceDims`) brittle on `:` in region/page names | ℹ️ Info | WR-03 from 44-REVIEW. Current in-repo rigs have no colons → correct output; not a live failure. Pre-existing pattern (Phase 43), not introduced this phase. |

No BLOCKER or WARNING anti-patterns. The 44-REVIEW found 0 critical, 5 warnings (all correctness-adjacent robustness gaps on oracle/sentinel tests, none of which falsify a phase truth — verified independently here), 6 info. The `console.log` in `runtime-43-mesh-uv-pagespace.spec.ts` is an eslint-disabled intentional RED→GREEN diagnostic.

### Human Verification Required

None. ORCL-03's only candidate human gate (spine-editor#891 status) is dispositioned as a v1.6 NO-OP, and that disposition was independently verified sound in this report: `ik` is provably absent in BOTH `skeleton2.json` and `skeleton2_42.json` (parsed-JSON evidence), making the 4.3→4.2 IK-scramble bug structurally unable to affect the ORCL-01 reference rig. The ROADMAP SC#3 "human-verified" clause is satisfied by the documented fallback path (the non-IK `appliedPose`-canary rig — exactly what ORCL-01 is). All other truths are programmatically verified via the test suites (1273 passed, 0 actual failures) and source/fixture inspection.

### Gaps Summary

No gaps. All 5 ROADMAP Success Criteria are verified TRUE against the actual codebase, not merely SUMMARY claims:

1. The loader is a genuine version dispatcher — `resolveRuntimeTag` is the SOLE gate (the 44-03 Rule-3 fix removed the dead-code-ing unconditional pre-calls that the 44-02 SUMMARY did not catch; this verification confirmed the fix is actually in `loader.ts:395` with no parallel pre-call). Routing proven via the threaded `handleRuntime` identity, not merely "did not throw."
2. <4.2 preserved + NEW ≥4.4 arm split out (not folded); 3-branch typed error with byte-identical `.name`.
3. Owner rigs committed + redistributable; ORCL-03 NO-OP disposition independently re-verified sound (ik genuinely absent in both JSONs).
4. ORCL-02 is a strict HARD gate (all 3 maps, hybrid comparator, no value-mismatch skip, tolerance not widened); the orchestrator-directed CORE-FIX (2d0246c) genuinely closed the ~2.251× mesh-undersize defect (CIRCLE now exactly equal cross-runtime, rel-divergence 0); re-capture moved ONLY the 6 CIRCLE mesh records.
5. XTRA-01 (genuine 1-source→2-typed-target multi-map + clamp + local↔world) and XTRA-02 (scaleY Uniform+Volume) fixtures genuinely exercise their features and sample correctly through the adapter; structural anti-green-wash specs pass against the real fixtures.

The known pre-existing out-of-scope items (tests/renderer/* MixBlend import failures + the `npm run build` spine-player renderer abort) are correctly Phase-47-owned (deferred-items.md paper trail) and explicitly NOT counted as Phase-44 gaps per the verification scope; the full suite shows 1273 passed / 0 actual test failures.

---

_Verified: 2026-05-18T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
