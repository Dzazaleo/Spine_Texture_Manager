---
phase: 48-core-scale-bake-module-regression-oracle
verified: 2026-05-22T13:45:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 48: Core Scale-Bake Module + Regression Oracle Verification Report

**Phase Goal:** Produce a Layer-3-pure `core/` JSON→JSON bake that mirrors spine-core `SkeletonJson.scale` field-for-field across both schemas (4.2 split transform/ik/path/physics[] AND 4.3 unified constraints[]), proven by the decisive sampling-free oracle wired into CI. This is the foundation every export phase depends on.
**Verified:** 2026-05-22T13:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | (BAKE-01) Bake output reparsed @scale=1 is field-identical (excl. parse-assigned id/hash) to orig parsed at SkeletonJson.scale=s — verified by round-trip oracle in CI | ✓ VERIFIED | `tests/scale-bake.spec.ts` runs `parse(bake(orig,s),1) ≡ parse(orig,scale=s)` over 8 fixtures × 3 scales = 24 field-identity assertions, all GREEN. Reference side is generated LIVE every run (no golden numbers). |
| 2 | (BAKE-02, BAKE-04) Oracle passes on dual-schema matrix INCLUDING a deform-heavy 4.2 rig + ≥1 all-constraint-types rig per runtime | ✓ VERIFIED | TEST_01 (4.2.43): 18 deform timelines + all four split types (transform:15, ik:8, path:14, physics:51). DEMON SKINS_SPINE_V02 (4.3.02): 178 unified constraints[]. Matrix has both schemas + extra tracked rigs (spineboy, SLIDER-01, skeleton2, SIMPLE_TEST). |
| 3 | (BAKE-03) Bake handles every constraint construct incl. timeline curve channels (IK softness cy / paired mix unscaled; PATH position/spacing length-mode) + scaled-default injections (physics.limit→5000×s, referenceScale→100×s; physics x/y NOT scaled) | ✓ VERIFIED | scale-bake.ts: IK curve idx 5/7 only (L193-196); PATH Fixed/Length-or-Fixed gating setup (L121-124) + timeline (L205-221); physics.limit injection L127, x/y untouched; referenceScale injection L94. Unit spec exercises every channel (tests/core/scale-bake.spec.ts L136-324). Oracle proves field-identity. |
| 4 | (BAKE-04) Module imports no DOM/Electron/sharp; green under tests/arch.spec.ts (Layer-3); source JSON never mutated | ✓ VERIFIED | scale-bake.ts has ZERO imports (pure raw-JSON). arch.spec.ts `src/core/**` scanner (L150) covers it w/ no carve-out + Phase-48 named anchor (L384-393) GREEN. Non-mutation: clone-first (L91); test asserts byte-identical source after bake (tests/core/scale-bake.spec.ts L22-31). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/scale-bake.ts` | Pure JSON→JSON similarity bake + ScaleBakeError + D-09/D-10 guards | ✓ VERIFIED | 224 lines; `export function bake` + `export class ScaleBakeError`; zero imports; clone-first; all branches present. |
| `fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.{json,atlas}` | 4.3 all-types DEMON copy | ✓ VERIFIED | spine=4.3.02, 178 unified constraints; tracked; no PNG. |
| `fixtures/SCALE_BAKE_4_2/TEST_01.{json,atlas}` | deform-heavy 4.2 all-four-types | ✓ VERIFIED | spine=4.2.43, 18 deform timelines + transform/ik/path/physics; tracked; no PNG. |
| `fixtures/SCALE_BAKE_4_2/TEST_03.{json,atlas}` | 4.2 IK-softness-curve | ✓ VERIFIED | spine=4.2.43, 3 deform + 2 IK 8-float curves; tracked; no PNG. |
| `fixtures/SCALE_BAKE_PATH_43/PATH_FIXED.{json,atlas}` | synthetic 4.3 path-Fixed timeline | ✓ VERIFIED | spine=4.3.0; positionMode+spacingMode=fixed; path timeline animates BOTH position+spacing, 2 keys, 1 curve; tracked; no PNG. |
| `tests/scale-bake.spec.ts` | Field-identity oracle + fixture-existence guard | ✓ VERIFIED | `fieldMismatches` deep-compare; 8-fixture × 3-scale matrix; hard-fail guard (no skip). |
| `tests/core/scale-bake.spec.ts` | Unit spec | ✓ VERIFIED | 36 tests covering setup-side, D-09, D-10, slider, path gating, IK curve, path timeline. |
| `tests/arch.spec.ts` | Layer-3 anchor for scale-bake.ts | ✓ VERIFIED | Phase-48 named block (L384-393), range-free; src/core/** glob scanner also covers it. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| tests/scale-bake.spec.ts | src/core/scale-bake.ts bake() | `import { bake }` + parse both sides | ✓ WIRED | L62 import; bake invoked L190; consumed by oracle. |
| tests/scale-bake.spec.ts reference side | spine-core SkeletonJson.scale | `sj.scale=s; sj.readSkeletonData()` | ✓ WIRED | L115-116 — live reference, no golden numbers. |
| scale-bake.ts | SkeletonJson.scale field rules | verbatim per-field ×s transcription | ✓ WIRED | referenceScale 100×s + physics.limit 5000×s present (L94,L127); independently field-verified against installed spine-core sources in 48-REVIEW.md. |
| fixtures/SCALE_BAKE_* | committed git tree (CI clone) | COPY into non-ignored dirs | ✓ WIRED | git ls-files lists all 8; git check-ignore prints nothing; git archive HEAD contains all 8 .json+.atlas. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Oracle + unit + arch suites pass | `vitest run tests/scale-bake.spec.ts tests/core/scale-bake.spec.ts tests/arch.spec.ts` | 3 files, 85 tests passed | ✓ PASS |
| Oracle full matrix runs | `vitest run tests/scale-bake.spec.ts --reporter=verbose` | 8 presence guards + 24 field-identity, all green | ✓ PASS |
| typecheck:node | `npm run typecheck:node` | exit 0 | ✓ PASS |
| typecheck:web | `npm run typecheck:web` | exit 0 | ✓ PASS |
| WR-01 materiality: symmetric+length-strict compare | injected hardened deep-compare over full matrix | After skipping `timelineIds` (derived StringSet embedding parse-assigned attachment.id), 24/24 clean | ✓ PASS |
| SC#4 non-mutation | `vitest -t "byte-identical"` | 1 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BAKE-01 | 48-01, 48-04 | Scaled JSON field-identical to SkeletonJson.scale=s, CI round-trip oracle | ✓ SATISFIED | Oracle 24 field-identity cells GREEN; field-identity holds under strictest symmetric check (Truth 1). |
| BAKE-02 | 48-01, 48-04 | Faithful output for both 4.2 split + 4.3 unified schemas | ✓ SATISFIED | TEST_01/TEST_03 (4.2 split) + DEMON/PATH_FIXED/SLIDER-01/spineboy/skeleton2 (4.3 unified) all pass oracle. |
| BAKE-03 | 48-03 | Every constraint construct incl. timeline curve channels + scaled-default injections | ✓ SATISFIED | All three channels implemented + unit-tested + oracle-proven; injections present and tested (Truth 3). |
| BAKE-04 | 48-02, 48-04 | Oracle in CI across deform-heavy + all-types matrix; module Layer-3 pure | ✓ SATISFIED | arch.spec scanner + named anchor GREEN; zero imports; deform-heavy TEST_01 in matrix; per-runtime all-types rigs present (Truth 2 + Truth 4). |

All four declared requirement IDs (BAKE-01..04) accounted for. No orphaned requirements — REQUIREMENTS.md maps exactly BAKE-01..04 to Phase 48, all claimed by plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME/stub/placeholder in scale-bake.ts, oracle, or unit spec | — | Clean |

The only `isFileAbsent` token in the oracle is inside a comment explaining why the green-wash skip idiom is FORBIDDEN — there is no actual skip; the fixture guard hard-fails (D-06a #3 honored).

### Decision Coverage (CONTEXT D-NN)

All 10 locked decisions cited literally in plan must_haves.truths: D-01,D-02,D-03 (48-02), D-04,D-05,D-06 (48-02), D-07 (48-03), D-08 (48-04), D-09,D-10 (48-01). All honored in code:
- D-04 (PNG exclusion): zero PNG bytes under any SCALE_BAKE_* dir.
- D-06a #3 (no silent skip): hard-fail fixture guard present.
- D-08 (two-sided equality): oracle covers over- AND under-scaling by construction (see WR-01 assessment below).
- D-09 (degenerate-s guard): L90 throws on s≤0/NaN/±Infinity.
- D-10 (assert-known): L100 + L144 throw on unknown constraint/attachment type.

### Orchestrator Post-Merge Fixes (assessed — both legitimate, gate NOT weakened)

1. **SAFE01 denylist extension** (`tests/safe01/discover-fixtures.ts` L143-154): adds the three SCALE_BAKE_* dirs to `SAFE01_EXCLUDED_PREFIXES`. This follows the identical locked D-04 path-prefix-denylist doctrine already applied to SIMPLE_PROJECT_43/SLIDER_4_3/spineboy_4.3 etc. It excludes NEWLY git-tracked fixtures from the FROZEN SAFE-01 enumeration/baseline gates so they don't leak in (+1 vs frozen manifest). Prefixes are trailing-slash-terminated (no over-match). Does NOT weaken the gate — the SCALE_BAKE fixtures were never part of the frozen SAFE-01 golden set.
2. **Localized `any` cast** (`tests/scale-bake.spec.ts` L112 `const S = Spine as any`): single-line cast at the construction site to sidestep the union-of-modules constructor-intersection typing hazard (sc42 & sc43 param types are mutually unsatisfiable). NOT a file-wide `@ts-nocheck`; the `parseAt` param type still guarantees only sc42/sc43 reach the call. typecheck:node + typecheck:web both exit 0 with it.

### WR-01 Assessment (code-review WARNING — materiality verified NON-blocking)

WR-01 flagged that `fieldMismatches` is one-directional (walks `baked` keys, `if (k in b)`) and array-length-clamped (`Math.min`), so the header's "two-sided" claim overstates what the code mechanically enforces — it is blind to ref-only fields and array-length divergence.

**Independent materiality test:** I injected the WR-01-suggested SYMMETRIC + length-strict hardening and ran it over the full 8×3 matrix. The ONLY divergence surfaced was `animations[].timelineIds` — a derived spine-core `StringSet` whose KEYS embed the parse-assigned `attachment.id` (DeformTimeline propertyId format `${Property.deform}|${slotIndex}|${attachment.id}` = `12|0|458` vs `12|0|460`, confirmed at `node_modules/@esotericsoftware/spine-core/dist/Animation.js:1124`). The `attachment.id` is an autoincrement counter SC#1 EXPLICITLY excludes ("excluding parse-assigned id/hash"). Once `timelineIds` is skipped (consistent with the existing `id`/`hash` SKIP entries), the strict symmetric compare is 24/24 clean.

**Conclusion:** The two SkeletonData trees ARE structurally isomorphic — the bake is purely multiplicative and never adds/removes keys or array elements — so SC#1's actual guarantee (field-identity excluding parse-assigned ids) holds under the strictest possible check. WR-01 is a documentation-scope nit (header overclaims), correctly classified as a non-blocking WARNING. The deferred risk it names ("a future bake change that DID alter structure could pass silently") is a hardening opportunity for a later phase, not a gap in the current goal.

### Human Verification Required

None. The phase delivers headless, fully-runnable Node/vitest code; every truth is programmatically verifiable and was verified (oracle execution, symmetric counter-check against live spine-core, typecheck, git-tracking proofs, fixture content probes). No visual, real-time, or external-service behavior is involved.

### Gaps Summary

No gaps. All four success criteria are achieved with codebase evidence:
- The bake module exists, is substantive (224 lines), pure (zero imports, Layer-3 green), non-mutating, and field-faithful to spine-core's SkeletonJson.scale.
- The oracle runs in CI across a dual-schema 8-fixture × 3-scale matrix that genuinely includes a deform-heavy 4.2 rig (TEST_01, 18 deform timelines + all four split constraint types) and per-runtime all-types rigs (TEST_01 4.2 + DEMON 4.3).
- Every constraint-timeline curve channel and scaled-default injection is implemented, unit-tested, and oracle-proven.
- All fixtures are git-tracked, PNG-free (D-04), and reachable in `git archive HEAD`.
- The single code-review WARNING (WR-01) was independently shown to be immaterial for SC#1 (the only strict-symmetric divergence is the SC#1-excluded parse-assigned id embedded in a derived StringSet).

The two deferred items (gitignored-fixture worktree-only test failures in unrelated sampler specs) are pre-existing and do not touch the scale-bake module; they are correctly scoped out.

---

_Verified: 2026-05-22T13:45:00Z_
_Verifier: Claude (gsd-verifier)_
