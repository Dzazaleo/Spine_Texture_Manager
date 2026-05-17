# Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring - Research

**Researched:** 2026-05-17
**Domain:** Version-routed dual-runtime loader dispatch + cross-runtime equivalence oracle + owner-fixture authoring (pure-TS `core/`/test phase, no UI)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All D-01..D-15 are LOCKED. Research is HOW to implement them, not WHETHER. Verbatim:

- **D-01:** Owner exports + commits all 3 missing rigs (`fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`) per `42-OWNER-EXPORT-SPEC.md` §3–§5 **before Phase 44 executes**. Phase 44 stays fully scoped (DISP-01/02/03 + ORCL-01/02/03 + XTRA-01/02); no roadmap/REQUIREMENTS re-map. The Phase-42 fixture guard (`tests/safe01/phase44-fixture-guard.spec.ts`) goes green naturally when `CURRENT_PHASE` bumps to 44.
- **D-02:** `SLIDER_4_3/` in Phase 44 = **existence-only** (satisfies the Phase-42 hard guard) + an OPTIONAL smoke-load-no-throw through the 4.3 runtime. The closed-form analytical slider-peak assertion stays Phase 46.
- **D-03:** XTRA-01/XTRA-02 pass-bar = (a) samples without throw through the 4.3 adapter, AND (b) byte-stable against its own freshly-captured 4.3 baseline (Phase-43 D-01 own-baseline pattern — stored separate from SAFE-01, NOT golden-shared with 4.2), AND (c) a STRUCTURAL assertion that the rig genuinely exercises the feature: XTRA-01's JSON has a transform constraint with ≥2 differently-typed target properties, ≥1 local + ≥1 world, non-1.0 mix; XTRA-02 has an IK constraint exercising `scaleYMode` Uniform AND Volume.
- **D-04 (locked, not asked):** ALL 4.3-only fixtures (`SIMPLE_PROJECT_43/` 4.3 file, `SLIDER_4_3/`, `XTRA01_4_3/`, `XTRA02_4_3/`) AND the postdates-freeze 4.2 sibling `skeleton2_42.*` are EXCLUDED from the SAFE-01 4.2 byte-equal frozen set AND the Phase-42 D-08 auto-discovery/enumeration assertion (`tests/safe01/discover-fixtures.ts`). Exclusion mechanism is Claude/planner discretion; the exclusion itself is locked.
- **D-05:** Fixture commits — the uncommitted 4.2 sibling `fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas,png}` PLUS the 3 new owner rigs — folded into Phase 44 execution: executor stages + commits them with plain-English git narration; the user does NOT run git.
- **D-06:** Loader routing = TOKEN PRIMARY + reject-on-contradiction. Parse leading `major.minor` from `skeleton.spine`; route 4.2.x → 4.2 runtime, 4.3.x → 4.3 runtime. Schema-shape is a cross-check, not the primary signal. Dispatch decision made BEFORE runtime load (DISP-03), at the existing hard-pick site.
- **D-07:** Version-token parse = leading `major.minor`, SUFFIX-TOLERANT. `4.2-from-4.3.01`→4.2, `4.3.01`→4.3, `4.3.73-beta`→4.3, `4.2.111`→4.2. Only a token with no parseable leading `major.minor` at all is malformed → existing typed reject (unchanged). Strict-semver-only is rejected.
- **D-08:** Contradiction surface = ASYMMETRIC, positive-shape only: `token=4.2` BUT top-level `constraints[]` present → reject; `token=4.3` BUT legacy top-level `ik`/`transform`/`path` arrays present → reject; `token=4.3` with NO `constraints[]` AND NO legacy arrays → NOT a contradiction → route 4.3 by token. Fail-loud over silent mis-route. `checkSpine43Schema`'s top-level-`constraints[]` sniff is repurposed from unconditional rejecter into the 4.3 routing/contradiction signal.
- **D-09 (DISP-02 version band):** Accept + route the ENTIRE `major=4, minor=3` band INCLUDING betas (`4.3.0`, `4.3.01`, `4.3.73-beta` → 4.3 runtime, best-effort). Reject `<4.2` (preserved) and a NEW `≥4.4` arm (`major=4 ∧ minor≥4`, OR `major≥5`).
- **D-10 (`≥4.4` error envelope):** Rework `SpineVersionUnsupportedError`: split the current `isSpine43OrLater` branch so (i) 4.3.x NEVER hits a reject branch (it routes), (ii) a NEW distinct 3rd branch handles `≥4.4` with correct FINAL wording — e.g. *"This file is from Spine {detectedVersion}. This app supports Spine 4.2 and 4.3. Re-export as Version 4.3 (or 4.2) and try again."*, (iii) `<4.2`/`unknown`/malformed keeps the existing *"requires Spine 4.2 or later"* message. The `'4.3-schema'` sentinel path is reworked consistently; the `token=4.2 + constraints[]` contradiction-reject message wording is planner's discretion — the `≥4.4` and `<4.2` branch wordings ARE locked.
- **D-11 (test ownership across 44/45):** Phase 44 updates ONLY the test assertions for behavior IT changes — 4.3 inputs now assert ROUTING (dispatch target / no throw) — keeping CI green at Phase 44 exit. The `<4.2` and `≥4.4` throw-cases stay explicitly asserted (a passing test still asserting the OLD 4.3-reject is a false-green). Phase 45 retains the user-facing copy/docs/drop-zone sweep + final reject-test inversion. ROADMAP Phase-45 SC#3 split EXPLICITLY (documented), not silently descoped. Affected files (enumerate exhaustively): `tests/core/loader-43-schema-guard-predicate.spec.ts`, `tests/core/loader-version-guard-predicate.spec.ts`, `tests/core/loader-version-guard.spec.ts`, `tests/core/errors-version.spec.ts`, `tests/core/loader.spec.ts`, `tests/runtime/d13-43-load-smoke.spec.ts`, `tests/core/ipc.spec.ts`, `tests/main/ipc.spec.ts`, `tests/main/viewer-asset-feed-ipc.spec.ts`, `tests/safe01/discover-fixtures.ts`.
- **D-12:** ORCL-02 compares ALL THREE `SamplerOutput` maps (`globalPeaks` + `perAnimation` + `setupPosePeaks`), each within 1e-4 — NOT `globalPeaks` alone. This deliberately STRENGTHENS ROADMAP SC#4's literal "globalPeaks within 1e-4". Downstream MUST NOT narrow it back.
- **D-13:** Tolerance form = HYBRID abs-OR-rel (numpy `isclose` style): values agree iff `|a−b| ≤ atol` OR `|a−b|/max(|a|,|b|) ≤ rtol`, with `atol = rtol = 1e-4`. Absolute-only is rejected.
- **D-14:** Failure semantics = HARD Phase-44 exit-gate (SAFE-02-style; the phase CANNOT close on a trip). A trip fires the `TransformConstraint`-on-`SQUARE` wrong-pose-undersize canary. A documented diagnosis protocol distinguishes the 4 causes but the gate does NOT soften. Tolerance is NOT a sanctioned escape hatch.
- **D-15 (new-format-atlas-through-runtime-42 contingency):** MUST-CONFIRM research flag — source-check `spine-core@4.2.111`'s `TextureAtlas.parse` against the new libgdx atlas format before the oracle's 4.2 leg is built. **VERDICT: see `## D-15 Verdict` below — HARD PASS, no normalization step needed.**

### Claude's Discretion

- The SAFE-01 exclusion mechanism for the new 4.3 fixtures (D-04) — denylist vs marker vs discover-predicate extension. Exclusion itself is locked. **Research recommendation: path-prefix denylist — see `## Architecture Patterns` Pattern 4.**
- The `resolveRuntimeTag`/dispatch function exact shape, location, signature, and the leading-`major.minor` parse regex; where the D-08 contradiction check sits relative to `checkSpineVersion`/`checkSpine43Schema` in `loader.ts`.
- The exact wording for the `token=4.2`-but-`constraints[]` contradiction reject message (the `≥4.4` and `<4.2` branch wordings ARE locked in D-10).
- The XTRA-01/XTRA-02 own-baseline canonical-JSON form + the structural-assertion test mechanics (the D-03 invariants are locked; the test shape is delegated).
- The optional `SLIDER_4_3` smoke-load-no-throw test mechanics (D-02).
- Owner-rig internal filenames — only the directory names `fixtures/SIMPLE_PROJECT_43/`, `fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/` are LOCKED.

### Deferred Ideas (OUT OF SCOPE)

- Closed-form analytical slider validation (SLIDER-02) → Phase 46. Phase 44 only needs `SLIDER_4_3/` to exist + optional smoke (D-02).
- User-facing copy / docs / drop-zone sweep (UX-01/UX-02) → Phase 45. Phase 44 produces only the correct-by-construction `≥4.4` loader-error wording (D-10) and fixes its own 4.3-reject test breakage (D-11).
- 4.3 perf budget (PERF-01) → Phase 46.
- spine-player 4.3 bump (PLAYER-01/02) → Phase 47.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISP-01 | Loader detects skeleton version, routes 4.2→4.2 runtime / 4.3→4.3 runtime; `checkSpine43Schema` repurposed rejecter→routing signal | The single behavior flip is `loader.ts:250` `pickRuntime('4.2')` → `pickRuntime(resolveRuntimeTag(...))`. Detection primitives `checkSpineVersion` (loader.ts:112–133) + `checkSpine43Schema` (loader.ts:165–178) already exist and are unit-tested; D-06/D-08 repurpose them. Real-data validation: `skeleton2.json` (`spine:"4.3.01"`, top-level `constraints[]`) and `skeleton2_42.json` (`spine:"4.2-from-4.3.01"`, legacy `transform`/`path`) confirm the routing logic against the actual oracle fixtures. |
| DISP-02 | Unsupported versions reject with typed-error envelope: `<4.2` guard preserved + NEW `≥4.4` arm | `checkSpineVersion`'s existing `<4.2` throw (loader.ts:123–126) stays verbatim. D-09 splits the current `major>=5 \|\| (major===4 && minor>=3)` throw (loader.ts:127–131) so `4.3.x` no longer throws (routes) and a new `(major===4 && minor>=4) \|\| major>=5` arm throws. `SpineVersionUnsupportedError` (errors.ts:86–122) `isSpine43OrLater` 2-branch → 3-branch (D-10). |
| DISP-03 | 4.2 JSON never silently loaded by 4.3 runtime; routing decided BEFORE runtime load | Routing decision is the `resolveRuntimeTag` call placed at the existing hard-pick site (loader.ts:243–250), which is already BEFORE atlas resolution (loader.ts:230 comment confirms "version inspected before atlas resolution") and before `rt.parseSkeleton`. Architecturally guaranteed by the existing seam — no new ordering work. |
| ORCL-01 | Owner-exported SIMPLE_TEST-equivalent rig committed in-repo as BOTH "Version 4.3" and "Version 4.2", redistributable | `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg, committed) + `skeleton2_42.{json,atlas,png}` (4.2 sibling, on disk UNCOMMITTED — D-05 commits it). Both confirmed present, non-IK, hash `mFDzgNETPHo` identical. The 3 new owner rigs (SLIDER/XTRA01/XTRA02) arrive before execution (D-01). |
| ORCL-02 | Same-rig cross-runtime equivalence: 4.3-runtime vs 4.2-runtime, ALL THREE SamplerOutput maps within 1e-4 (D-12, hybrid tolerance D-13) | The Phase-43 harness at `tests/runtime43/` is ~90% complete: `buildLoad43()` + `buildLoadSibling42()` already drive both rigs through `sampleSkeleton`; `runtime43-d03.spec.ts` already compares SQUARE peakScale within 1e-4. ORCL-02 = generalize that single-peak comparison to all-three-maps with the D-13 abs-OR-rel comparator. Canonical-JSON serializer (`tests/safe01/canonical-json.ts`) reused for deterministic map comparison. |
| ORCL-03 | spine-editor#891 status human-verified before dual-version reference trusted (v1.6 NO-OP by design — ORCL-01 non-IK) | Confirmed at source: `skeleton2.json` constraint types = `['transform','path']`, `ik` absent; `skeleton2_42.json` legacy arrays = `['transform','path']`, `ik` ABSENT. ORCL-01 is TransformConstraint-only → #891-immune → ORCL-03 #891 human-verify is a documented v1.6 no-op (Phase 42 D-03). No human gate. CONTEXT documents the disposition. |
| XTRA-01 | 4.3 transform-constraint multi-map fixture samples correctly through the adapter; STRUCTURAL assertion | spine-core@4.3.0 `TransformConstraintData.d.ts` verified: `properties: Array<FromProperty>`, each `FromProperty.to: Array<ToProperty>`; `data.clamp`/`localSource`/`localTarget`/`additive` booleans. SkeletonJson.js:160–247 parses `constraintMap.properties` map `<from> → {offset, to:{<to>:{offset,max,scale}}}`. D-03 structural assertion = parse the rig JSON, assert ≥2 differently-typed `to` targets, ≥1 local + ≥1 world, non-1.0 mix. |
| XTRA-02 | 4.3 IK `scaleYMode` fixture (Uniform AND Volume) samples correctly; default `None` 4.2-equivalent | spine-core@4.3.0 `IkConstraintData.d.ts:46–48` verified: `_scaleYMode: ScaleYMode`; `ScaleYMode` enum `{None=0, Uniform=1, Volume=2}` (IkConstraintData.js:64–72). JSON key is `"scaleY"` (string enum value), parsed via `Utils.enumValue(ScaleYMode, scaleY)` at SkeletonJson.js:148–150; absent → default `None`. D-03 structural assertion = parse the rig JSON, assert ≥1 IK constraint with `scaleY` set to a non-`None` enum value across the rig's poses/variants. |
</phase_requirements>

## Summary

Phase 44 is a **surgical single-behavior flip plus a fixture/oracle harness assembly** — almost no greenfield code. The dispatch flip is one line: `loader.ts:250`'s `pickRuntime('4.2')` becomes `pickRuntime(resolveRuntimeTag(...))`, where `resolveRuntimeTag` is a small pure function composed from the *already-existing, already-unit-tested* `checkSpineVersion` and `checkSpine43Schema` primitives, repurposed per D-06/D-07/D-08/D-09 from rejecters into a token-primary router with asymmetric contradiction rejection. The loader is already spine-core-import-free (Phase 43 RT-02) and the version is already inspected before atlas resolution (loader.ts:230), so DISP-03's "decide before runtime load" is structurally satisfied by placing the call at the existing hard-pick seam — no new ordering work.

The equivalence oracle (ORCL-02) is **~90% pre-built**. The Phase-43 `tests/runtime43/` harness already contains `buildLoad43()` (4.3 rig through runtime-43 via the sampler), `buildLoadSibling42()` (4.2 sibling through runtime-42 via the sampler), `sample()`, the `canonicalize()` serializer reuse, the `frozenPart()` own-baseline sentinel pattern, and `runtime43-d03.spec.ts` which *already compares a cross-runtime SQUARE peakScale within 1e-4*. ORCL-02 is the generalization of that single-peak diff to all-three-`SamplerOutput`-maps (D-12) under a hybrid abs-OR-rel comparator (D-13), promoted to a HARD exit gate (D-14). The XTRA own-baselines (D-03) reuse the same `tests/runtime43/runtime43-baseline.spec.ts` first-capture-then-strict-toEqual pattern verbatim. The D-15 atlas-format contingency is **resolved to a HARD PASS** by source-reading the installed `spine-core@4.2.111` `TextureAtlas` constructor — no `.atlas` normalization step is needed.

The one non-obvious hazard the planner must internalize: **the D-06 dispatch flip mechanically activates the D-04 SAFE-01-exclusion requirement.** Today `discover-fixtures.ts` excludes every 4.3 fixture *naturally* because `loadSkeleton` throws `SpineVersionUnsupportedError` on them. After Phase 44, `loadSkeleton` routes-and-samples them instead of throwing — so without an explicit exclusion they would be auto-discovered, trip the `safe01-enumeration` manifest deep-equal, and false-trip SAFE-02 (no pre-v1.6 baseline exists for them). The exclusion is not optional polish; it is co-required by the very flip this phase lands.

**Primary recommendation:** Implement `resolveRuntimeTag` as a pure exported function in `loader.ts` composed from the existing predicates (token-primary D-06/D-07, asymmetric contradiction D-08, `≥4.4` arm D-09); flip `loader.ts:250` to call it; extend `errors.ts` `SpineVersionUnsupportedError` from 2-branch to 3-branch (D-10, extend not replace); add a path-prefix denylist to `discover-fixtures.ts` (D-04, co-required by the flip); generalize the existing `tests/runtime43/runtime43-d03.spec.ts` cross-runtime comparison into the all-three-maps ORCL-02 hard gate (D-12/D-13/D-14) reusing `buildLoad43`/`buildLoadSibling42`; clone the `runtime43-baseline.spec.ts` own-baseline pattern for XTRA-01/02 + add structural-assertion specs against the verified 4.3.0 constraint shapes; bump `tests/safe01/phase-gate.ts` `CURRENT_PHASE` 42→44; update the D-11 test files' 4.3 arms to assert routing while preserving `<4.2`/`≥4.4` throw-cases; commit all 5 fixture artifacts with plain-English git narration (D-05).

## Architectural Responsibility Map

This is a pure single-tier (`core/` Layer-3 + test) phase. No multi-tier capability assignment risk.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version detection + runtime routing (DISP-01/02/03) | `core/loader.ts` (Layer-3 pure TS) | — | Already the detection seam (`checkSpineVersion`/`checkSpine43Schema` live here, unit-tested); loader is already spine-core-import-free (Phase 43 RT-02). Pure string/object inspection — no DOM/fs/electron. |
| `≥4.4` typed-error envelope (DISP-02/D-10) | `core/errors.ts` (Layer-3 pure TS) | — | `SpineVersionUnsupportedError` discriminated-union member; IPC forwarder routes by `err.name` (unchanged). Message branching is pure string logic. |
| Cross-runtime equivalence oracle (ORCL-02) | `tests/runtime43/` (test harness) | `core/sampler.ts` + `core/runtime/*` (consumed read-only) | The oracle DRIVES the runtimes through the existing sampler; it adds no `core/` code. Comparison/tolerance logic is a test concern (mirrors `tests/safe01/` discipline — CLAUDE.md Fact #5). |
| XTRA own-baselines + structural assertions (D-03) | `tests/runtime43/` (test harness) | — | Own-baseline store is `tests/runtime43/baselines/` (already exists, separate from SAFE-01). Structural assertions parse fixture JSON directly (no runtime). |
| SAFE-01 exclusion of new 4.3 fixtures (D-04) | `tests/safe01/discover-fixtures.ts` (test discovery) | — | The exclusion is a discovery-predicate concern; it lives where auto-discovery walks `fixtures/**`. |
| Owner-fixture authoring + commit (D-01/D-05) | Owner (export) + executor (git) | — | Export is human/owner action (off critical path, D-01); the git stage/commit is executor with plain-English narration (D-05, user does not run git). |

## Standard Stack

No new dependencies. The phase is pure `core/`/test work against the already-installed dual-runtime.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-core` | 4.3.0 (canonical) | 4.3 runtime — the 4.3 leg of the oracle + XTRA fixtures | `[VERIFIED: node_modules/@esotericsoftware/spine-core/package.json → "version":"4.3.0"]`. RT-01 locked. |
| `spine-core-42` (= `npm:@esotericsoftware/spine-core@4.2.111`) | 4.2.111 | 4.2 runtime — the 4.2 leg of the oracle (ORCL-02 sibling) | `[VERIFIED: node_modules/spine-core-42/package.json → "name":"@esotericsoftware/spine-core","version":"4.2.111"]`. RT-01 locked. |
| `vitest` | (installed, v4) | Test runner for all DISP/ORCL/XTRA specs + the hard gate | Existing project test framework; `vitest.config.ts` auto-discovers `tests/**/*.spec.ts`. |

### Supporting (reused harness — NOT new code)
| Asset | Location | Purpose | Reuse For |
|-------|----------|---------|-----------|
| `pickRuntime(tag)` | `src/core/runtime/runtime.ts:174` | Lazy sync-require runtime factory; 3-runtime env-split intact | DISP: change WHICH tag is passed. Resolver itself UNCHANGED. |
| `checkSpineVersion` | `src/core/loader.ts:112–133` | `<4.2`/`≥4.3` throw predicate (exported, unit-tested) | Repurpose: split the `≥4.3` arm into 4.3-route + `≥4.4`-throw (D-06/D-09). |
| `checkSpine43Schema` | `src/core/loader.ts:165–178` | top-level `constraints[]` throw predicate (exported, unit-tested) | Repurpose: `constraints[]` presence becomes the D-08 4.3 routing/contradiction signal, not an unconditional throw. |
| `SpineVersionUnsupportedError` | `src/core/errors.ts:86–122` | discriminated-union typed error; `isSpine43OrLater` 2-branch | Extend to 3-branch (D-10) — `≥4.4` arm + 4.3-never-rejects. |
| `SamplerOutput` shape | `src/core/sampler.ts:117–121` | `{ globalPeaks, perAnimation, setupPosePeaks }` (3× `Map<string, PeakRecord>`) | D-12 compares ALL THREE; D-03 own-baselines canonicalize all three. |
| `canonicalize()` | `tests/safe01/canonical-json.ts:96` | deterministic recursive sorted-key JSON of the 3-map output (non-finite/signed-zero sentinels, 15-sig-digit clamp) | ORCL-02 deterministic compare + XTRA own-baseline serialization. |
| `buildLoad43()` | `tests/runtime43/baseline-driver.ts:128` | assembles a `LoadResult` so `sampleSkeleton` runs the 4.3 rig through runtime-43 | ORCL-02 4.3 leg (generalize from `runtime43-d03.spec.ts`). |
| `buildLoadSibling42()` | `tests/runtime43/baseline-driver.ts:192` | loads `skeleton2_42.json` through runtime-42 via the sampler | ORCL-02 4.2 leg — **this is the ORCL-02 4.2 reference, already wired.** |
| `tryLoad43()` / `load43.ts` | `tests/runtime43/load43.ts` | loud-or-skip 4.3 loader (ENOENT → Wave-0 skip; broken pickRuntime → PROPAGATE) | Presence-guard pattern for SLIDER/XTRA fixtures. |
| `runtime43-baseline.spec.ts` `frozenPart()` + first-capture pattern | `tests/runtime43/runtime43-baseline.spec.ts:38–93` | own-baseline sentinel: first run writes baseline, subsequent runs strict `toEqual` | Clone verbatim for XTRA-01/02 own-baselines (D-03 part b). |
| Phase-44 fixture guard | `tests/safe01/phase44-fixture-guard.spec.ts` + `tests/safe01/phase-gate.ts` | `CURRENT_PHASE`-gated hard guard for `SIMPLE_PROJECT_43/`+`SLIDER_4_3/` | Arms when `CURRENT_PHASE`→44 (one-line bump). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `resolveRuntimeTag` as a new pure fn composed from existing predicates | A single rewritten monolithic detect function | Rejected — discards the 4-way unit-test coverage of `checkSpineVersion`/`checkSpine43Schema`; D-08/D-09 are *deltas* to existing decision trees, not a rewrite. ARCHITECTURE §5 explicitly recommends "repurposed, not deleted". |
| Path-prefix denylist for D-04 | Per-fixture marker file / `discover()` predicate via `loadSkeleton` reject | Marker files add an on-disk convention nothing else uses. Reject-based exclusion is exactly what BREAKS post-flip (the flip stops the throw). Path-prefix denylist is the only mechanism that survives the dispatch flip and is a 1-line filter after `globSync` (see Pattern 4). |
| Generalize `runtime43-d03.spec.ts` for ORCL-02 | New from-scratch oracle spec | The d03 spec already does cross-runtime same-rig comparison within 1e-4 via the exact `buildLoad43`/`buildLoadSibling42` helpers; ORCL-02 is the all-3-maps generalization. Rebuilding duplicates the (correct) driver. |

**Installation:** None. `npm ci` already provides both runtimes (RT-01 lockfile-pinned).

**Version verification:**
```
[VERIFIED: node_modules/@esotericsoftware/spine-core/package.json] @esotericsoftware/spine-core → 4.3.0
[VERIFIED: node_modules/spine-core-42/package.json] spine-core-42 alias → @esotericsoftware/spine-core@4.2.111
[VERIFIED: package.json] "@esotericsoftware/spine-core":"4.3.0", "spine-core-42":"npm:@esotericsoftware/spine-core@4.2.111"
```

## D-15 Verdict (MUST-CONFIRM research flag — RESOLVED)

**VERDICT: HARD PASS. `spine-core@4.2.111`'s `TextureAtlas` constructor parses the new libgdx atlas format present in `fixtures/SIMPLE_PROJECT_43/skeleton2_42.atlas` correctly and without error. No `.atlas`-text normalization fixture-prep step is required. `42-OWNER-EXPORT-SPEC.md` does NOT need amending. The oracle's 4.2 leg can load `skeleton2_42.atlas` directly through runtime-42.**

### Exact source location and parse-path walkthrough

**Source file:** `node_modules/spine-core-42/dist/TextureAtlas.js` (the npm-aliased 4.2.111 runtime — `[VERIFIED: cat node_modules/spine-core-42/package.json → "version":"4.2.111"]`). The `TextureAtlas` constructor is at **lines 31–193**; the `TextureAtlasReader` at **lines 194–227**.

**The fixture under test** (`fixtures/SIMPLE_PROJECT_43/skeleton2_42.atlas`, `[VERIFIED: Read]`):
```
skeleton2_42.png
size:2466,1004
filter:Linear,Linear
CIRCLE
bounds:1765,303,699,699
SQUARE
bounds:2,2,1000,1000
TRIANGLE
bounds:1004,169,833,759
rotate:90
rect
bounds:1004,67,100,500
rotate:90
```
New-format markers confirmed present: `size:W,H` (no space after colon), **NO `format:` line**, **NO `pma:` line**, **NO `repeat:` line**, `bounds:x,y,w,h` (combined xy+size), `rotate:90` (numeric, not `true`/`false`).

**Walkthrough through `TextureAtlas.js:31–193`:**

1. **`pageFields` registry (lines 37–57):** `pageFields` is keyed `size`, `format`, `filter`, `repeat`, `pma`. The page-property loop (lines 122–128) does `const field = pageFields[entry[0]]; if (field) field(page);`. The `if (field)` guard is the load-bearing line: **a missing `format:`/`pma:`/`repeat:` line simply means those handlers are never invoked — there is no "required field" assertion, no throw, no NaN.** Defaults from the `TextureAtlasPage` class (lines 228–248) stand: `pma=false`, `uWrap/vWrap=ClampToEdge`, `minFilter/magFilter=Nearest` (then overwritten by the present `filter:Linear,Linear` line via `pageFields["filter"]`). `size:2466,1004` is parsed by `pageFields["size"]` → `page.width=2466, page.height=1004`.

2. **Header-vs-page boundary (lines 97–130):** the reader skips empty lines, runs the header loop (lines 102–108 — "Silently ignore all header fields"), then `!page` branch (line 120) constructs `TextureAtlasPage` from the first line (`skeleton2_42.png`) and consumes page properties until `readEntry` returns 0 (a blank line or EOF). For this fixture there is no blank line between the page block and the first region (`CIRCLE`) — but `CIRCLE` has no colon, so `readEntry` (lines 205–213: `colon == -1 → return 0`) returns 0, breaking the page-property loop cleanly. `CIRCLE` is then re-read as the first region name on the next outer-loop iteration.

3. **`regionFields` registry (lines 58–96):** keyed `xy`, `size`, `bounds`, `offset`, `orig`, `offsets`, `rotate`, `index`. `regionFields["bounds"]` (lines 67–72) parses `bounds:1765,303,699,699` → `region.x=1765, y=303, width=699, height=699`. `regionFields["rotate"]` (lines 87–93) parses `rotate:90`: `value="90"`, not `"true"`, not `"false"` → `region.degrees = parseInt("90") = 90`. The region-property loop (lines 133–151) uses the same `const field = regionFields[entry[0]]; if (field) field(region);` guard — unknown keys fall to the `names`/`values` custom-property collector, never throw.

4. **`orig`-absent handling (lines 152–155):** `if (region.originalWidth == 0 && region.originalHeight == 0) { region.originalWidth = region.width; region.originalHeight = region.height; }`. The fixture has no `orig:`/`offsets:` line, so `originalWidth/Height` stay 0 → this block sets them to the `bounds` width/height. **This is exactly the path the loader's `canonicalDimsByRegion` derivation (loader.ts comment "TextureAtlas.js lines 152–155 in the installed version") already depends on for `SIMPLE_TEST.atlas` today.**

5. **UV derivation with rotation (lines 162–171):** `region.u/v` from `x/page.width`; because `region.degrees == 90` (the `rotate:90` regions TRIANGLE+rect), `u2=(x+height)/page.width, v2=(y+width)/page.height` (the swapped-extent branch). Deterministic, no error.

**Decisive corroboration:** the *existing LOCKED golden* `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (`[VERIFIED: Read]`) uses the **identical new format**:
```
SIMPLE_TEST.png
size:1839,1464
filter:Linear,Linear
CIRCLE
bounds:1004,2,699,699
...
```
`SIMPLE_TEST.atlas` is parsed by this exact `spine-core@4.2.111` `TextureAtlas` constructor on **every test run today** and is the byte-frozen SAFE-01 golden the entire suite drives from. The new-format atlas is therefore not merely "parseable in theory" — it is the *de facto already-in-production format* the 4.2.111 runtime parses successfully. `skeleton2_42.atlas` differs from `SIMPLE_TEST.atlas` only in dimensions and the addition of `rotate:90` regions (which `regionFields["rotate"]` handles natively).

**Cross-check 4.2.111 vs 4.3.0 parser equivalence:** `[VERIFIED: diff of grep-extracted parse logic, node_modules/spine-core-42 vs node_modules/@esotericsoftware/spine-core]` — the two `TextureAtlas.js` files are byte-equivalent in parse semantics; the only diffs are minifier cosmetics (`pageFields["size"]` vs `pageFields.size`, `let` vs `const`, `==` vs `===` on the same operands). No behavioral divergence for this input.

**Consequence for the plan:** D-15's contingency branch (the `.atlas`-text-only normalization fixture-prep + `42-OWNER-EXPORT-SPEC.md` amendment) is **NOT triggered**. The ORCL-02 4.2 leg loads `skeleton2_42.atlas` as-is. The skeleton JSON was never in question (JSON-invariant since v1.0, source-confirmed; `skeleton2_42.json` is `[VERIFIED]` to have `spine:"4.2-from-4.3.01"` + legacy `transform`/`path` arrays — exactly what D-07/D-08 route to runtime-42 with no contradiction).

## Architecture Patterns

### System Architecture Diagram

```
                       fixtures/SIMPLE_PROJECT_43/skeleton2.json   (spine:"4.3.01", constraints[])
                       fixtures/SIMPLE_PROJECT_43/skeleton2_42.json (spine:"4.2-from-4.3.01", legacy transform/path)
                                            │
                                            ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  core/loader.ts  loadSkeleton(path)                                          │
   │   1. JSON.parse(jsonText)  ──────────────────────────────────────┐          │
   │   2. checkSpineVersion(spine, path)   [REPURPOSED — D-06/D-09]    │          │
   │        <4.2 / unknown / malformed ──────────► throw  (UNCHANGED)  │          │
   │        ≥4.4 (major4∧minor≥4 OR major≥5) ────► throw  (NEW arm)    │          │
   │        4.2.x ───────────────────────────────► tag '4.2'          │          │
   │        4.3.x (incl. -beta, suffix-tolerant) ─► tag '4.3'          │          │
   │   3. D-08 asymmetric contradiction cross-check (positive-shape):  │          │
   │        token=4.2 ∧ top-level constraints[] present ──► throw      │          │
   │        token=4.3 ∧ legacy ik/transform/path present ─► throw      │          │
   │        else ─────────────────────────────────────────► keep tag  │          │
   │   ── resolveRuntimeTag() returns '4.2' | '4.3'  ◄── (was const '4.2', :250)  │
   │            │  [DISP-03: decided BEFORE atlas resolve + parse]                │
   │            ▼                                                                 │
   │   rt = pickRuntime(tag)   [runtime.ts:174 — UNCHANGED resolver, 3-env split] │
   │            │                                                                 │
   │   rt.makeAtlas() → rt.parseSkeleton() → rt.applyRotatedRegionFix()           │
   │            │                                                                 │
   │            ▼  LoadResult { …, runtime: rt }   (runtime-agnostic downstream)   │
   └────────────────────────────────────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┴───────────────────────────────────┐
        ▼                                                                        ▼
  PRODUCTION: sampler-worker → sampleSkeleton                  TEST ORACLE (tests/runtime43/):
   (4.3 file now ROUTES, no longer rejects)                     buildLoad43()  →  out43 = sample()
                                                                buildLoadSibling42() → out42 = sample()
                                                                       │
                                                          ┌────────────┴────────────┐
                                                          ▼                          ▼
                                              ORCL-02 (D-12/D-13/D-14):    XTRA own-baseline (D-03):
                                              ∀ (globalPeaks,              first run → write baseline
                                                 perAnimation,             subsequent → strict toEqual
                                                 setupPosePeaks):          + structural assertion on
                                                 abs|Δ|≤1e-4 OR            fixture JSON (verified 4.3.0
                                                 rel ≤1e-4                  TransformConstraint/IK shapes)
                                                 → HARD phase-exit gate
```

### Recommended Project Structure (delta only — no new directories in `src/`)

```
src/core/
├── loader.ts          # MODIFIED — add exported resolveRuntimeTag(); flip :250 const→call;
│                       #            repurpose checkSpineVersion (≥4.3 arm split) +
│                       #            checkSpine43Schema (throw→D-08 routing signal)
├── errors.ts          # MODIFIED — SpineVersionUnsupportedError isSpine43OrLater 2→3 branch (D-10)
└── runtime/runtime.ts # UNCHANGED — pickRuntime resolver is byte-untouched (only the arg flips)

tests/
├── safe01/
│   ├── phase-gate.ts            # MODIFIED — CURRENT_PHASE 42 → 44 (one-line const)
│   └── discover-fixtures.ts     # MODIFIED — add path-prefix denylist (D-04, CO-REQUIRED by the flip)
├── runtime43/
│   ├── orcl02-equivalence.spec.ts  # NEW — all-3-maps cross-runtime HARD gate (D-12/13/14);
│   │                                #       reuses buildLoad43 + buildLoadSibling42 + canonicalize
│   ├── xtra01-baseline.spec.ts     # NEW — XTRA-01 own-baseline (clone runtime43-baseline pattern)
│   ├── xtra01-structural.spec.ts   # NEW — D-03 structural assertion (parse XTRA01 JSON)
│   ├── xtra02-baseline.spec.ts     # NEW — XTRA-02 own-baseline
│   ├── xtra02-structural.spec.ts   # NEW — D-03 structural assertion (parse XTRA02 JSON)
│   ├── slider43-smoke.spec.ts      # NEW (OPTIONAL — D-02) — SLIDER_4_3 load-no-throw via runtime-43
│   └── baselines/                  # EXISTING own-baseline store; gains xtra01/xtra02 baseline files
└── core/ (+ tests/main/)           # MODIFIED — D-11 4.3-arm assertions flip reject→route;
                                     #            <4.2 + ≥4.4 throw-cases PRESERVED as explicit asserts

fixtures/
├── SIMPLE_PROJECT_43/  # skeleton2.{json,atlas,png} committed; skeleton2_42.{json,atlas,png} → COMMIT (D-05)
├── SLIDER_4_3/         # owner-exported pre-execution (D-01) → COMMIT (D-05)
├── XTRA01_4_3/         # owner-exported pre-execution (D-01) → COMMIT (D-05)
└── XTRA02_4_3/         # owner-exported pre-execution (D-01) → COMMIT (D-05)
```

### Pattern 1: `resolveRuntimeTag` — token-primary composition over existing predicates (D-06/D-07/D-08/D-09)

**What:** A pure exported function `resolveRuntimeTag(version: string|null, parsedJson: unknown, skeletonPath: string): RuntimeTag` placed in `loader.ts`, composed from the *existing* `checkSpineVersion` decision tree (modified) + the *existing* `checkSpine43Schema` `constraints[]` sniff (repurposed).

**When to use:** At the existing hard-pick site `loader.ts:243–250`, replacing the literal `pickRuntime('4.2')` with `pickRuntime(resolveRuntimeTag(spineField, parsedJson, skeletonPath))`. The version is already extracted at loader.ts:216–228; reuse that `spineField`.

**Source-grounded decision tree (verified against the actual loader.ts:112–178 + the real fixtures):**
```
resolveRuntimeTag(version, parsedJson, path):
  // --- band classification (D-07 suffix-tolerant; D-09 bands) ---
  // version === null            → throw SpineVersionUnsupportedError('unknown', path)   [UNCHANGED loader.ts:113-116]
  // leading major.minor unparseable → throw SpineVersionUnsupportedError(version, path)  [UNCHANGED loader.ts:120-122]
  //   (D-07: parse ONLY the leading major.minor; ignore any -beta / -from-x.y suffix.
  //    `4.2-from-4.3.01`→[4,2], `4.3.73-beta`→[4,3], `4.3.01`→[4,3], `4.2.111`→[4,2].
  //    The existing parts[0]/parts[1] split + parseInt already does this — parseInt
  //    stops at the first non-digit, so parseInt('2-from-4') === 2. NO regex change
  //    strictly required; an explicit /^(\d+)\.(\d+)/ match is clearer and equivalent.)
  // major<4 OR (major===4 ∧ minor<2) → throw  [UNCHANGED loader.ts:123-126 — Phase 12 F3 contract]
  // (major===4 ∧ minor>=4) OR major>=5 → throw  [NEW D-09 ≥4.4 arm — was folded into the ≥4.3 throw]
  // major===4 ∧ minor===2 → tag = '4.2'
  // major===4 ∧ minor===3 → tag = '4.3'   [was a throw at loader.ts:127-131 — now routes]
  //
  // --- D-08 asymmetric contradiction cross-check (positive-shape ONLY) ---
  // hasTopLevelConstraintsArray  := checkSpine43Schema-style sniff: parsedJson is object
  //                                  ∧ 'constraints' in it ∧ Array.isArray(constraints)
  // hasLegacyArrays := parsedJson object ∧ any Array.isArray of root.ik / root.transform / root.path
  //   (NOTE: 4.3 also has root.skins[].ik etc.; D-08 is TOP-LEVEL root arrays only —
  //    matching checkSpine43Schema's existing top-level-only scope. skeleton2.json's
  //    SKIN-scoped constraints are irrelevant here; only root.constraints[] matters.)
  // if tag==='4.2' ∧ hasTopLevelConstraintsArray → throw (4.3-shape mis-stamped 4.2;
  //     PRESERVES today's checkSpine43Schema reject for exactly this case — message
  //     wording is planner's discretion per D-10)
  // if tag==='4.3' ∧ hasLegacyArrays → throw (legacy-shape mis-stamped 4.3)
  // if tag==='4.3' ∧ NOT hasTopLevelConstraintsArray ∧ NOT hasLegacyArrays → tag stays '4.3'
  //     (D-08: a constraint-less 4.3 rig is VALID; absence of constraints[] is NOT 4.2 evidence)
  // return tag
```

**Real-data validation (`[VERIFIED: python3 json inspection of the actual fixtures]`):**
| Fixture | `skeleton.spine` | top-level `constraints[]` | legacy `ik/transform/path` | D-06/07 token | D-08 | Route |
|---------|------------------|---------------------------|----------------------------|---------------|------|-------|
| `skeleton2.json` (4.3 leg) | `"4.3.01"` | present (len 2: transform,path) | absent | 4.3 | has constraints[], no legacy → OK | **4.3** ✓ |
| `skeleton2_42.json` (4.2 sibling) | `"4.2-from-4.3.01"` | absent | present (transform CHAIN_8, path) | 4.2 (suffix-tolerant) | token=4.2, no constraints[] → OK | **4.2** ✓ |
| `SIMPLE_TEST.json` (existing 4.2 golden) | `"4.2.43"` | absent | transform CHAIN_8, no ik | 4.2 | no constraints[] → OK | **4.2** ✓ (regression-safe) |
| `SPINE_4_3_TEST.json` (Phase-32 canary) | `"4.3.91-beta"` | present | — | 4.3 (suffix-tolerant -beta) | has constraints[] → OK | **4.3** (was reject; now routes — D-11 expected delta) |

The suffix-tolerant D-07 parse is **load-bearing for ORCL-02**: `skeleton2_42.json`'s `spine:"4.2-from-4.3.01"` MUST resolve to `4.2` or the oracle's 4.2 leg cannot load. The existing `parseInt(parts[1])` already yields `2` for `"2-from-4"` (parseInt stops at `-`), so the current primitive is *already* suffix-tolerant — an explicit `/^(\d+)\.(\d+)/` regex is a clarity improvement, not a correctness fix.

### Pattern 2: Extend (don't replace) `SpineVersionUnsupportedError` 2-branch → 3-branch (D-10)

**What:** `errors.ts:101–118` currently computes a boolean `isSpine43OrLater` and picks one of two messages. D-10 requires three outcomes.

**Current shape (`[VERIFIED: Read errors.ts:86–122]`):**
```
isSpine43OrLater = (detectedVersion === '4.3-schema')
                   OR (major>=5 OR (major===4 ∧ minor>=3))
message = isSpine43OrLater
            ? "...supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2..."   // NOW WRONG for 4.3
            : "...requires Spine 4.2 or later. Re-export from Spine 4.2 or later..."
```

**Target shape (D-10 — LOCKED wordings for the `≥4.4` and `<4.2` branches; the contradiction-reject wording is discretion):**
```
// detectedVersion === '4.3-schema'  → this sentinel is now a ROUTING signal, NOT a reject.
//   resolveRuntimeTag no longer constructs SpineVersionUnsupportedError('4.3-schema',…) for
//   a real 4.3 rig (it routes). The class must still handle the sentinel gracefully if it
//   ever reaches the constructor via the token=4.2+constraints[] CONTRADICTION path
//   (planner's-discretion message — a 4.2-stamped-but-4.3-shaped reject, NOT "re-export as 4.2").
// classify detectedVersion semver leading major.minor:
//   (major===4 ∧ minor>=4) OR major>=5  →  [LOCKED D-10 wording]
//       "This file is from Spine {detectedVersion}. This app supports Spine 4.2 and 4.3.
//        Re-export as Version 4.3 (or 4.2) and try again."
//   4.3.x  →  UNREACHABLE as a reject (it routes). Defensive: if it somehow reaches here,
//             it is a logic bug — do NOT emit the old "re-export as 4.2" string.
//   else (<4.2 / 'unknown' / malformed)  →  [LOCKED — existing wording PRESERVED verbatim]
//       "This file was exported from Spine {detectedVersion}. Spine Texture Manager
//        requires Spine 4.2 or later. Re-export from Spine 4.2 or later in the editor."
```
`.name = 'SpineVersionUnsupportedError'` and the `detectedVersion`/`skeletonPath` fields stay byte-identical — the IPC forwarder routes by `err.name` (`[CITED: errors.ts:84 comment "src/main/ipc.ts routes by err.name against KNOWN_KINDS"]`); changing the message is safe, changing the name/shape is not. **Extend the discriminated union member; do not introduce a new error class** (CONTEXT code_context: "extend with the 3rd ≥4.4 branch, don't replace the pattern").

### Pattern 3: ORCL-02 = generalize the existing `runtime43-d03.spec.ts` cross-runtime diff to all-3-maps + hard gate (D-12/D-13/D-14)

**What:** `tests/runtime43/runtime43-d03.spec.ts` (`[VERIFIED: Read]`) already does the ORCL-02 *shape*: it builds the 4.3 rig (`buildLoad43()`) and the 4.2 sibling (`buildLoadSibling42()`), runs both through `sample()`, and asserts `|sq43 - sq42| <= 1e-4` for the SQUARE peakScale. ORCL-02 generalizes this from one peak to **all three `SamplerOutput` maps, every entry** (D-12), under the **hybrid abs-OR-rel comparator** (D-13), promoted to a **HARD phase-exit gate** (D-14).

**The D-13 comparator (numpy `isclose` semantics, `atol=rtol=1e-4`):**
```
function close(a: number, b: number): boolean {
  // exact-equal short-circuit (covers a===b===0 → rel is 0/0; abs handles it anyway)
  const diff = Math.abs(a - b);
  if (diff <= 1e-4) return true;                       // atol arm — saves tiny magnitudes
  return diff / Math.max(Math.abs(a), Math.abs(b)) <= 1e-4;  // rtol arm — saves large world-scale magnitudes
}
```
Apply `close` field-by-field over the canonicalized `PeakRecord` numeric fields (`peakScale`, `peakScaleX`, `peakScaleY`, world dims) for every key in the union of both maps' keysets, for each of `globalPeaks` / `perAnimation` / `setupPosePeaks`. Key-set divergence (a key in one map's output but not the other) is itself a failure — a missing/extra `${skin}/${slot}/${attachment}` record is the silent-classify-as-skip class (Pitfall 2 / PITFALLS Pitfall 2). Reuse `canonicalize()` (`tests/safe01/canonical-json.ts`) so non-finite/signed-zero are sentinelized before the numeric compare (a NaN peak from a broken pose read must not slip through as "equal").

**D-14 hard-gate mechanics:** the spec is NOT `it.skipIf`-soft on a value mismatch. It IS presence-guarded on *fixture absence* only (Wave-0: if `buildLoad43()`/`buildLoadSibling42()` return null because the fixture genuinely is not on disk → skip with reason — but D-01 + the `phase44-fixture-guard` make absence impossible at Phase 44). A *value* divergence is a hard `expect(...).toBe(true)` failure with the D-14 diagnostic message embedded (the 4-cause protocol — see Pattern below). The phase CANNOT close on a trip; tolerance is NOT widened (the "tolerance tunable once" option was explicitly rejected in D-14).

**D-14 diagnosis protocol (embed in the failure message — investigated, never waived):**
| Symptom signature | Likely cause | First diagnostic |
|-------------------|--------------|------------------|
| Divergence concentrated on `SQUARE` (the TransformConstraint canary) / constrained slots; 4.3 systematically smaller | (a) 4.3 adapter bug — reading `bone.pose` not `bone.appliedPose` | Check `runtime-43.ts` `boneAxisScale` reads `appliedPose`; this is the PITFALLS Pitfall 2 existential mode. |
| 4.2 leg throws / returns 0 records | (b) 4.2-sibling load failure | Confirm `skeleton2_42.json` routes to runtime-42 (D-07 suffix-tolerant); confirm atlas parses (D-15 PASS — should not be the cause). |
| Broad divergence across many unconstrained attachments, no clear pattern | (c) rigs not actually equivalent (editor-downgrade artifact) | Spot-check non-IK; ORCL-01 is #891-immune (non-IK confirmed) so this is LOW-probability but check the 4.2/4.3 hashes match (`mFDzgNETPHo`). |
| Tiny uniform divergence just over 1e-4 at large magnitudes only | (d) cross-engine float noise > tolerance | The hybrid rel arm (D-13) is specifically designed to absorb this; if it still trips, it is NOT noise — investigate as (a)/(c). Do NOT widen tolerance. |

### Pattern 4 (RECOMMENDED for the D-04 discretion choice): Path-prefix denylist in `discover-fixtures.ts`

**What:** A single `const SAFE01_EXCLUDED_PREFIXES = [...]` filter applied immediately after the `globSync('fixtures/**/*.json')` in `discover-fixtures.ts:81–83`.

**Why this mechanism (vs marker file / reject-predicate) — the load-bearing reasoning:**

**The D-04 exclusion is CO-REQUIRED by the D-06 dispatch flip — it is not independent polish.** Current `discover-fixtures.ts` (`[VERIFIED: Read lines 80–101]`) walks `fixtures/**/*.json`, calls `loadSkeleton(fixture)` per file, and the `try/catch` (lines 89–97) records any thrower in `excluded` with its reason. Today **every 4.3 fixture and the `skeleton2_42` 4.2 sibling is excluded *naturally* because `loadSkeleton` throws `SpineVersionUnsupportedError`** on them (4.3 → the `≥4.3` reject; the sibling → routes to 4.2 today only because the loader hard-picks 4.2, but its companion 4.3 sibling `skeleton2.json` throws). **The instant Phase 44's D-06 flip lands, `loadSkeleton` no longer throws on a 4.3 JSON — it routes-and-samples it.** Those fixtures then become `included` by `discover()` → the `safe01-enumeration.spec.ts` deep-equal (`discovered.filter(gitTracked) === _manifest.json fixtures`, `[VERIFIED: Read]`) diverges (manifest does NOT list them — `[VERIFIED: grep _manifest.json → only "skeleton2" SAFE-01-context entry, no SIMPLE_PROJECT_43/SLIDER/XTRA]`) AND `safe01-baseline.spec.ts` attempts a byte-equal compare against a non-existent pre-v1.6 baseline → **false SAFE-02 trip on a phase that is supposed to be SAFE-02-green**.

- A **reject-based exclusion is precisely what the flip removes** — it cannot be the mechanism (the flip's whole point is to stop the reject).
- A **per-fixture marker file** introduces an on-disk convention nothing else in the repo uses; brittle and easy to forget when the owner adds a rig.
- A **path-prefix denylist** is a 1-line `.filter()` after `globSync`, survives the dispatch flip (it is independent of whether `loadSkeleton` throws), is self-documenting, and matches the D-04 fixture set exactly by directory: `fixtures/SIMPLE_PROJECT_43/`, `fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`. (Note: `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json` is the postdates-freeze 4.2 sibling — it is INSIDE the `SIMPLE_PROJECT_43/` prefix, so a single directory-prefix denylist covers both the 4.3 file and the 4.2 sibling per D-04's explicit "AND the postdates-freeze 4.2 sibling skeleton2_42.*".)

**Exact edit shape:**
```typescript
// discover-fixtures.ts — after globSync, before the per-fixture loop:
const SAFE01_EXCLUDED_PREFIXES = [
  'fixtures/SIMPLE_PROJECT_43/',  // D-04: postdates pre-v1.6 freeze (4.3 file + 4.2 sibling) — no SAFE-01 baseline
  'fixtures/SLIDER_4_3/',         // D-04
  'fixtures/XTRA01_4_3/',         // D-04
  'fixtures/XTRA02_4_3/',         // D-04
] as const;
const files = globSync('fixtures/**/*.json')
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => !SAFE01_EXCLUDED_PREFIXES.some((p) => f.startsWith(p)))
  .sort();
```
This keeps the existing reject-as-natural-exclusion for the *other* Phase-32 canaries (`SPINE_4_3_TEST/` etc.) untouched — those still throw post-flip? **NO** — `SPINE_4_3_TEST/SPINE_4_3_TEST.json` is `4.3.91-beta` and WILL route post-flip too. **Planner note:** verify whether `SPINE_4_3_TEST/` / `test_4.3/` are in `_manifest.json` (they are NOT — they were reject-excluded). They are gitignored canaries (`d13-43-load-smoke.spec.ts` drives them directly). After the flip they would also become discoverable. The cleanest scope for the denylist is therefore "all post-v1.6 / 4.3-schema fixture dirs that have no pre-v1.6 SAFE-01 baseline" — confirm the exact set against `_manifest.json` during planning and ensure the denylist covers every 4.3-routing fixture dir not in the frozen manifest, not only the 4 D-04-named ones. This is the single subtlest correctness point in the phase.

### Anti-Patterns to Avoid
- **Rewriting `checkSpineVersion`/`checkSpine43Schema` from scratch:** discards 4 unit-test files of coverage; D-08/D-09 are decision-tree deltas. Repurpose in place (ARCHITECTURE §5).
- **Narrowing ORCL-02 back to `globalPeaks`-only:** D-12 deliberately STRENGTHENS ROADMAP SC#4 to all-3-maps. A downstream "correction" to the literal SC#4 wording is a silent descope (memory: `feedback_replan_can_silently_descope_roadmap_contract`). The strengthening is intentional and locked.
- **Absolute-only or tolerance-tunable ORCL-02:** D-13 mandates hybrid abs-OR-rel; D-14 forbids tolerance as an escape hatch. A trip is investigated, not waived.
- **Sharing 4.2 SAFE-01 goldens as the XTRA/4.3 expected output:** D-03 own-baselines are a SEPARATE store (`tests/runtime43/baselines/`), NOT golden-shared (ARCHITECTURE Anti-Pattern 2). ORCL-02 is the ONLY hard cross-runtime gate; XTRA own-baselines are regression sentinels.
- **Verifying the dispatch via `npm test` only:** the seam resolves per-runtime across 3 entrypoints (vitest / built CJS worker / tsx-ESM CLI). Testing N−1 of N green-washes a gap (memory: `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam` — a 5/5-verified Phase 43 had a fully-broken CLI). See Validation Architecture §Multi-Runtime Entrypoint Matrix.
- **Letting the D-04 exclusion slip:** it is co-required by the flip (Pattern 4). Omitting it false-trips SAFE-02 on a phase that must be SAFE-02-green.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-runtime sampler driver (run a rig through a specific runtime via the real sampler) | A new LoadResult assembler | `tests/runtime43/baseline-driver.ts` `buildLoad43()` + `buildLoadSibling42()` | Already built, already correct, already used by the green `runtime43-d03.spec.ts`. Re-deriving the `sourceDims`/`LoadResult` shape risks a faithfulness drift the existing driver already solved (it replicates `loader.ts:529-565` derivation). |
| Deterministic 3-map comparison | A bespoke deep-equal with float handling | `canonicalize()` (`tests/safe01/canonical-json.ts`) | Recursive sorted-key + non-finite/signed-zero sentinels + 15-sig-digit clamp already solved the silent-corruption traps (NaN→null, -0→0). Hand-rolled compare reintroduces them. |
| Own-baseline sentinel (first-capture-then-strict) | A new write-or-assert harness | Clone `runtime43-baseline.spec.ts:56–93` `frozenPart()` + `existsSync(BASE)?assert:write` | Phase-43 D-01 pattern, proven, separate-store discipline baked in. |
| Loud-or-skip fixture presence guard | New try/catch ENOENT logic | `tests/runtime43/load43.ts` `tryLoad43()` idiom | Already distinguishes legit Wave-0 ENOENT skip from a broken-pickRuntime PROPAGATE (the verification-integrity fix from 43-03). Re-rolling risks silently swallowing a broken runtime as a "skip". |
| Version-string leading major.minor parse | A new semver lib / complex regex | The existing `parts = version.split('.'); parseInt(...)` (already suffix-tolerant) — optionally an explicit `/^(\d+)\.(\d+)/` for clarity | No dependency; `parseInt('2-from-4')===2` already satisfies D-07. A full semver parser would *reject* `4.2-from-4.3.01` (the opposite of D-07). |
| Phase-marker detection | A milestone-state file parser | `tests/safe01/phase-gate.ts` `CURRENT_PHASE` committed constant (bump 42→44) | Q2-RESOLVED decision: committed constant, deliberately NOT a brittle tracking-file parse (42-RESEARCH Q2/A4). |

**Key insight:** Phase 43 left behind a near-complete oracle test harness specifically so Phase 44 would be assembly, not construction. The single highest-leverage planning move is recognizing that `runtime43-d03.spec.ts` is ORCL-02's prototype and ORCL-02 is its all-3-maps generalization — not a from-scratch oracle.

## Runtime State Inventory

> This is a rename/refactor-adjacent phase only in that it FOLDS uncommitted fixtures into git (D-05) and flips a dispatch behavior. There is no string-rename. The relevant "runtime state" question is: *after the dispatch flips, what stored/discovered state changes behavior without a code edit?*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None as keys/IDs.** No datastore stores a spine version or fixture path as a key. The only "stored" artifacts are the own-baseline JSON files under `tests/runtime43/baselines/` (gitignored heavy + committed light) and `tests/safe01/baselines/` (SAFE-01 frozen) — these are test baselines, not runtime state. XTRA-01/02 will WRITE new baseline files into `tests/runtime43/baselines/` on first capture (D-03). | First-capture writes are expected (own-baseline pattern); commit the captured XTRA baselines. No data migration. |
| Live service config | **None.** No external service (n8n/Datadog/Tailscale/Cloudflare) is in scope; this is a headless `core/`/test phase. | None — verified by scope (no service surface in the phase). |
| OS-registered state | **None.** No Task Scheduler / pm2 / launchd / systemd registration references a spine version or fixture. | None — verified by scope. |
| Secrets/env vars | **None.** No secret/env var references a spine version or the renamed/added fixtures. The `__GSD_ESM_ADAPTER_RESOLVER__` globalThis slot (runtime.ts:147) is test-infra-only and version-agnostic — UNCHANGED by the dispatch flip (only the tag passed to `pickRuntime` changes; the resolver and its globalThis slot are byte-untouched). | None. |
| Build artifacts / discovered state | **TWO behavior-changing discovered-state items.** (1) `tests/safe01/discover-fixtures.ts` auto-discovers `fixtures/**/*.json` by *runtime behavior* (`loadSkeleton` throws ⇒ excluded). The D-06 flip changes that runtime behavior → the discovered set silently grows → `_manifest.json` enumeration + SAFE-01 byte-compare false-trip (this is the D-04 driver — see Pattern 4). (2) `out/main/runtime-4x.cjs` build emit (Phase 43 GAP-43-PROD-SEAM): Phase 44's dispatch flip changes WHICH adapter the *built* worker requires for a given input — the built-worker graph must be re-verified post-flip (CONTEXT memory `project_phase43_pickruntime_esm_split`: "Phase 44 must re-verify lazy-single-copy after the dispatch flip changes the worker's bundled graph"). | (1) Add the path-prefix denylist to `discover-fixtures.ts` (D-04, Pattern 4) — CO-REQUIRED, not optional. (2) Add a built-worker + CLI entrypoint verification task (Validation Architecture §Multi-Runtime Entrypoint Matrix); do NOT rely on `npm test` alone. |

**The canonical question, answered:** *After the dispatch flips, the only runtime systems whose behavior changes without a per-system code edit are (a) the fixture auto-discovery (which now sees 4.3 fixtures as samplable — fixed by the D-04 denylist) and (b) the built CJS worker's lazy-single-copy graph (which now picks runtime-43 for 4.3 inputs — must be re-verified across all 3 entrypoints, not just vitest).*

## Common Pitfalls

### Pitfall 1: The D-04 SAFE-01 exclusion is forgotten because "it's a separate concern"
**What goes wrong:** Planner treats D-04 as orthogonal cleanup, schedules it late or omits it. The D-06 flip lands; `discover-fixtures.ts` now samples the 4.3 fixtures; `safe01-enumeration` + `safe01-baseline` false-trip; the phase appears to have a SAFE-02 regression it does not have.
**Why it happens:** Today the exclusion is *implicit* (reject-as-natural-exclusion). It looks like nothing needs doing because the fixtures are already excluded — but the mechanism that excludes them is exactly what the flip removes.
**How to avoid:** Treat the D-04 denylist as part of the dispatch-flip task (or its immediate same-wave successor), with a verification step: after the flip, `discover()` MUST still return the same git-tracked set as `_manifest.json` (the `safe01-enumeration` spec is the canary). Pattern 4 has the exact edit.
**Warning signs:** `safe01-enumeration.spec.ts` or `safe01-baseline.spec.ts` red after the dispatch flip, with new `SIMPLE_PROJECT_43`/`SLIDER`/`XTRA` paths in the discovered set.

### Pitfall 2: `≥4.4` arm folded into the old `≥4.3` throw instead of split out
**What goes wrong:** Engineer changes `if (major>=5 || (major===4 && minor>=3)) throw` to only remove the `minor>=3`, leaving 4.3.x with no arm at all (falls through) or accidentally still throwing.
**Why it happens:** The existing condition (loader.ts:127–131) bundles `≥4.3` and `≥5` into ONE throw. D-09 needs THREE outcomes from it (4.3→route, ≥4.4→throw, ≥5→throw).
**How to avoid:** Explicitly enumerate: `major===4 && minor===3 → '4.3'`; `(major===4 && minor>=4) || major>=5 → throw`. The unit-test (`loader-version-guard-predicate.spec.ts`) must gain explicit `4.3.0→route`, `4.3.99→route`, `4.4.0→throw`, `5.0.0→throw`, `4.3.73-beta→route` cases (D-11).
**Warning signs:** A 4.3 fixture still throws `SpineVersionUnsupportedError`; or a hypothetical 4.4 input routes to runtime-43 (silent — the existential class).

### Pitfall 3: D-08 contradiction check uses symmetric or absence-based logic
**What goes wrong:** Engineer codes "token=4.3 but no constraints[] → it's really 4.2, reject/reroute". This is WRONG per D-08: a constraint-less 4.3 rig is valid; absence of `constraints[]` is NOT 4.2 evidence.
**Why it happens:** Symmetric "shape must match token both ways" feels safer but contradicts D-08's explicit asymmetric positive-shape-only rule.
**How to avoid:** Implement EXACTLY the two positive-shape throw conditions (token=4.2 ∧ constraints[] present; token=4.3 ∧ legacy arrays present) and nothing else. `token=4.3 ∧ no constraints[] ∧ no legacy → route 4.3`. The verified `skeleton2_42.json` (token 4.2, no constraints[], HAS legacy) and `skeleton2.json` (token 4.3, HAS constraints[], no legacy) both must pass with no contradiction.
**Warning signs:** A valid constraint-less 4.3 rig rejects; or `skeleton2_42.json` (the ORCL-02 4.2 leg) fails to route to 4.2.

### Pitfall 4: ORCL-02 compares only `globalPeaks` (silent descope of D-12)
**What goes wrong:** The oracle asserts `globalPeaks` agreement only (matching the ROADMAP SC#4 literal), missing per-animation/setup-pose drift that nets out at the global peak but is user-visible in the Animation Breakdown panel.
**Why it happens:** ROADMAP SC#4 literally says "globalPeaks within 1e-4"; a planner faithful to the literal narrows D-12 back.
**How to avoid:** D-12 is an INTENTIONAL strengthening, flagged precisely so a re-plan doesn't "restore" the weaker literal. Assert all three maps. The ROADMAP SC#4 wording is the floor, D-12 is the contract.
**Warning signs:** ORCL-02 spec only touches `out.globalPeaks`; `perAnimation`/`setupPosePeaks` unreferenced.

### Pitfall 5: Dispatch verified on vitest only; built worker / CLI silently broken
**What goes wrong:** `npm test` is green; the dispatch flip works under vitest's globalThis-resolver arm. But the built CJS worker (`out/main/runtime-4x.cjs` ambient-require arm) or the `npm run cli` tsx-ESM arm picks the wrong/no runtime for a 4.3 input → production/CLI is broken while CI is green.
**Why it happens:** `pickRuntime` resolves via THREE different mechanisms per entrypoint (runtime.ts:174–217). The dispatch flip changes which tag is passed; if a runtime-43 require path is subtly wrong it only surfaces on that entrypoint. Phase 43's GAP-43-CLI-SEAM was exactly this (a 5/5-verified phase had a fully-broken CLI — memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`).
**How to avoid:** Include an explicit verification task that spawns (a) `npm test` (vitest), (b) the built worker (`npm run build` then sample a 4.3 fixture through the built artifact), and (c) `npm run cli -- fixtures/SIMPLE_PROJECT_43/skeleton2.json` (tsx-ESM) — all must route 4.3 correctly. NOT just `npm test`.
**Warning signs:** Green `npm test` + a 4.3 file failing under `npm run cli` or the packaged app (the exact GAP-43-CLI-SEAM signature).

### Pitfall 6: XTRA structural assertion is too weak (green-washes a mis-authored rig)
**What goes wrong:** The owner exports an XTRA-01 rig with only ONE target property or a 1.0 mix; the own-baseline still passes (it baselines whatever it sampled) and the rig green-washes without actually exercising the multi-map feature.
**Why it happens:** Own-baseline (D-03 part b) only proves byte-stability against itself — a weak rig is stably weak. D-03 part c (the STRUCTURAL assertion) exists precisely to prevent this.
**How to avoid:** Implement D-03 part c against the *verified 4.3.0 JSON shapes*: XTRA-01 — parse the JSON, find the transform constraint, assert its `properties` map yields ≥2 `to` targets of different property KINDS (e.g. a `ToRotate` AND a `ToScaleX`), ≥1 with the constraint configured local + ≥1 world, and a `mix`≠1.0; XTRA-02 — parse the JSON, find the IK constraint(s), assert `scaleY` enum-value appears as BOTH `Uniform` AND `Volume` across the rig's constraints/poses (per `42-OWNER-EXPORT-SPEC.md` §5). The structural assertion fails LOUD if the owner's rig is too weak — surfacing it for re-export, not silently passing.
**Warning signs:** XTRA spec has only an own-baseline `toEqual` and no JSON-shape assertion; or the assertion only checks "a transform constraint exists" (too weak).

## Code Examples

Verified patterns from the actual codebase (re-use, do not re-derive):

### ORCL-02 driver reuse (the 4.2 + 4.3 legs are already wired)
```typescript
// Source: tests/runtime43/runtime43-d03.spec.ts (VERIFIED — the ORCL-02 prototype)
import { buildLoad43, buildLoadSibling42, sample } from './baseline-driver.js';
// ...
const built43 = buildLoad43();              // 4.3 rig through runtime-43 via sampleSkeleton
const built42 = buildLoadSibling42();       // skeleton2_42.json through runtime-42 via sampleSkeleton
if (built43 == null || built42 == null) { /* Wave-0 fixture-absent skip ONLY */ }
const out43 = sample(built43.load);         // SamplerOutput { globalPeaks, perAnimation, setupPosePeaks }
const out42 = sample(built42.load);
// ORCL-02 generalizes the d03 single-SQUARE compare to ALL THREE maps under the D-13 comparator.
```

### Own-baseline first-capture-then-strict pattern (clone verbatim for XTRA-01/02)
```typescript
// Source: tests/runtime43/runtime43-baseline.spec.ts:56-93 (VERIFIED — Phase-43 D-01 pattern)
function frozenPart(p: Record<string, unknown>) {
  return { globalPeaks: p.globalPeaks, perAnimation: p.perAnimation, setupPosePeaks: p.setupPosePeaks };
}
const json = canonicalize(output, { fixture: 'XTRA01_4_3/<file>.json' });   // tests/safe01/canonical-json.ts
const live = JSON.parse(json);
if (!existsSync(BASE)) { mkdirSync(BASE_DIR,{recursive:true}); writeFileSync(BASE, JSON.stringify(frozenPart(live),null,2)+'\n'); }
const committed = JSON.parse(readFileSync(BASE,'utf8'));
expect(frozenPart(live)).toEqual(frozenPart(committed));   // strict regression sentinel (NOT the SAFE-02 gate)
```

### The D-15-verified atlas-tolerant parse path (no normalization needed)
```javascript
// Source: node_modules/spine-core-42/dist/TextureAtlas.js:122-128 (VERIFIED)
// page-property loop — the `if (field)` guard is why missing format:/pma:/repeat: never throws:
while (true) {
    if (reader.readEntry(entry, line = reader.readLine()) == 0) break;
    let field = pageFields[entry[0]];
    if (field) field(page);          // ← missing fields → handler simply never called. No throw.
}
// regionFields["bounds"] (lines 67-72) + regionFields["rotate"] (lines 87-93) natively handle
// the new-format `bounds:x,y,w,h` + numeric `rotate:90` present in skeleton2_42.atlas.
```

### XTRA-02 structural-assertion target (verified 4.3.0 IK shape)
```javascript
// Source: node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:148-150 + IkConstraintData.js:64-72 (VERIFIED)
// JSON key is "scaleY" (string enum value); parsed via Utils.enumValue(ScaleYMode, scaleY); absent → None.
const scaleY = getValue(constraintMap, "scaleY", null);
if (scaleY != null) data.scaleYMode = Utils.enumValue(ScaleYMode, scaleY);
// ScaleYMode: { None=0, Uniform=1, Volume=2 }  → D-03 XTRA-02: assert "scaleY" ∈ {"Uniform","Volume"}
//   appears across the rig's IK constraints (both Uniform AND Volume exercised).
```

### XTRA-01 structural-assertion target (verified 4.3.0 TransformConstraint shape)
```typescript
// Source: node_modules/@esotericsoftware/spine-core/dist/TransformConstraintData.d.ts:51-92 (VERIFIED)
//   properties: Array<FromProperty>;  FromProperty.to: Array<ToProperty>;
//   data.clamp/localSource/localTarget/additive: boolean;
// SkeletonJson.js:160-247 parses constraintMap.properties as { <from>: { offset, to: { <to>: {offset,max,scale} } } }
// D-03 XTRA-01: parse the rig JSON's transform constraint .properties, assert ≥2 differently-typed
//   `to` target kinds, ≥1 local + ≥1 world config, mix ≠ 1.0.
```

## State of the Art

| Old Approach (pre-Phase-44) | Current Approach (Phase 44 target) | When Changed | Impact |
|-----------------------------|-------------------------------------|--------------|--------|
| `loader.ts:250` hard-picks `pickRuntime('4.2')` unconditionally (Phase 43 D-02) | `pickRuntime(resolveRuntimeTag(...))` — token-primary version dispatch | Phase 44 DISP-01 | 4.3 JSON routes to runtime-43 instead of being rejected |
| `checkSpine43Schema` throws on top-level `constraints[]` (Phase 32 rejecter) | `constraints[]` presence is the D-08 4.3 routing/contradiction signal | Phase 44 D-08 | Predicate repurposed; its unit tests flip reject→route (D-11) |
| `SpineVersionUnsupportedError` 2-branch (`<4.2` vs `≥4.3 incl. 4.3`) | 3-branch: `<4.2` / 4.3-never-rejects / NEW `≥4.4` | Phase 44 D-10 | 4.3 no longer hits a reject branch; future 4.4 hits a correct typed reject |
| 4.3 fixtures excluded from SAFE-01 *implicitly* (loadSkeleton throws) | 4.3 fixtures excluded *explicitly* (path-prefix denylist) | Phase 44 D-04 | The exclusion survives the flip that removed the implicit mechanism |
| 4.3 correctness = own-baseline sentinel only (Phase 43 D-01) | + cross-runtime equivalence HARD gate on all 3 maps (ORCL-02 D-12/14) | Phase 44 ORCL-02 | The 4.3 path now has a same-rig 4.2 oracle, not just self-consistency |

**Deprecated/outdated (do NOT carry forward):**
- The "re-export as Version 4.2" advisory for 4.3 inputs (errors.ts:115) is now WRONG for 4.3 — but Phase 44 only fixes the `≥4.4` wording (D-10) + its own test breakage (D-11). The user-facing copy/docs sweep is Phase 45 (UX-01/02), explicitly fenced out.
- SEED-006's beta inventory — superseded by `.planning/research/SUMMARY.md` (this research uses the verified-stable 4.3.0 facts). The 4.3.0 IK shape is `scaleYMode` enum (NOT beta `scaleY: number`) — `[VERIFIED: IkConstraintData.js:64-72]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 3 new owner rigs (SLIDER_4_3/XTRA01_4_3/XTRA02_4_3) WILL be on disk before Phase 44 executes (D-01 owner action, off critical path) | Phase Requirements / Structure | If absent at execution: `phase44-fixture-guard.spec.ts` hard-fails when `CURRENT_PHASE`→44 (this is the designed enforcement — it surfaces the blocker, does not silently pass). XTRA/SLIDER specs Wave-0-skip until present. Mitigated by the existing guard mechanism — not a research gap, an enforced precondition. |
| A2 | The owner's XTRA-01/XTRA-02 rigs will be structurally STRONG enough to satisfy D-03 part c (≥2 differently-typed targets / Uniform+Volume) | Pitfall 6 / XTRA structural | If the owner's rig is too weak, the D-03 structural assertion FAILS LOUD (by design) — surfacing it for re-export. Risk is a re-export round-trip, not a silent green-wash. The structural assertion is precisely the mitigation. |
| A3 | `out/main/runtime-4x.cjs` built-worker resolution still works after the dispatch flip changes which adapter is required for a 4.3 input (Phase-43 GAP-43-PROD-SEAM was closed for the 4.2 hard-pick; the 4.3 require arm `require('../runtime-43.cjs')` at runtime.ts:204 is exercised for the first time in production by this flip) | Pitfall 5 / Multi-Runtime Matrix | If the 4.3 arm's emitted-path/specifier is wrong (the runtime-43 analog of GAP-43-PROD-SEAM), the built worker breaks on 4.3 input while vitest is green. Mitigated by the mandated built-worker + CLI verification task (NOT npm-test-only). CONTEXT memory `project_phase43_pickruntime_esm_split` explicitly flags "Phase 44 must re-verify lazy-single-copy after the dispatch flip". |

**Note:** All A1–A3 are *enforced preconditions / mandated verification steps*, not unverified beliefs presented as fact. No compliance/retention/security claim is assumed. The D-15 verdict is `[VERIFIED: source-read]`, not assumed.

## Open Questions

1. **Exact denylist scope for D-04 — only the 4 D-04-named dirs, or every post-v1.6 4.3-routing fixture dir not in `_manifest.json`?**
   - What we know: D-04 explicitly names `SIMPLE_PROJECT_43/` (incl. `skeleton2_42.*`), `SLIDER_4_3/`, `XTRA01_4_3/`, `XTRA02_4_3/`. The pre-existing Phase-32 canaries `SPINE_4_3_TEST/` + `test_4.3/` are 4.3-schema, gitignored, NOT in `_manifest.json`, and currently reject-excluded.
   - What's unclear: after the D-06 flip, `SPINE_4_3_TEST/SPINE_4_3_TEST.json` (`4.3.91-beta`) also routes-and-samples → it would also become discoverable. Whether it lands in the *git-tracked* discovered set (the `safe01-enumeration` assertion filters `.gitTracked`) depends on whether it is git-tracked (it is gitignored per PITFALLS Pitfall 9: `.gitignore` excludes `fixtures/test_4.3/`; `SPINE_4_3_TEST/` status to confirm).
   - Recommendation: during planning, run `git ls-files fixtures/SPINE_4_3_TEST fixtures/test_4.3` and inspect `_manifest.json` exhaustively; size the denylist to cover EVERY 4.3-routing fixture directory that is (a) git-tracked AND (b) not in the frozen `_manifest.json`. If `SPINE_4_3_TEST/` is gitignored it won't affect the `.gitTracked`-filtered enumeration assertion but MAY affect `safe01-baseline.spec.ts` if that spec iterates non-tracked discovered fixtures — verify which SAFE-01 specs iterate the tracked-only vs the full discovered set. This is the single subtlest correctness point; it is a verification step, not a blocker (Pattern 4 has the mechanism; only the exact prefix list needs the planning-time `git ls-files` + `_manifest.json` check).

2. **Does any D-11 file beyond the loader-predicate trio actually assert a 4.3-reject that breaks post-flip?**
   - What we know (`[VERIFIED: grep counts]`): `loader-43-schema-guard-predicate.spec.ts` (31 refs), `loader-version-guard-predicate.spec.ts` (29), `loader-version-guard.spec.ts` (32), `errors-version.spec.ts` (22) are reject-assertion-heavy and WILL break. `loader.spec.ts` (2 refs), `ipc.spec.ts` core (1), `main/ipc.spec.ts` (1), `viewer-asset-feed-ipc.spec.ts` (0) are low-reference.
   - What's unclear: whether the low-reference files' 1–2 refs are 4.3-reject assertions (break post-flip) or `<4.2`-reject assertions (must be PRESERVED) or unrelated `SpineVersionUnsupportedError` usage.
   - Recommendation: planner greps each of the 10 D-11 files for the specific assertion and classifies each ref as (i) 4.3-reject → flip to assert routing, (ii) `<4.2`/`≥4.4`-reject → PRESERVE as explicit throw-case, (iii) unrelated → no change. `tests/runtime/d13-43-load-smoke.spec.ts` already wants the new behavior (it drives the 4.3 runtime directly today; post-flip it can ALSO go through the gated loader — D-11 says Phase 44 "makes it real"). This is an enumeration task with a clear rule, not an unknown.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-core@4.3.0` (canonical) | 4.3 leg of oracle, XTRA fixtures, DISP routing | ✓ | 4.3.0 `[VERIFIED]` | — |
| `spine-core-42` (`@esotericsoftware/spine-core@4.2.111` alias) | 4.2 leg of oracle (ORCL-02 sibling) | ✓ | 4.2.111 `[VERIFIED]` | — |
| `vitest` (v4) | all DISP/ORCL/XTRA specs + the hard gate | ✓ | installed | — |
| `node` + `npm run build` (electron-vite) | built-worker entrypoint verification (Pitfall 5 / A3) | ✓ | project-pinned | — |
| `npm run cli` (tsx/ESM) | CLI entrypoint verification (Pitfall 5 / A3) | ✓ | project-pinned | — |
| Owner Spine editor export (SLIDER/XTRA01/XTRA02 rigs) | D-01 — XTRA/SLIDER specs consume these | ⚠ owner-action (off critical path, D-01) | — | `phase44-fixture-guard` HARD-fails at `CURRENT_PHASE`→44 if absent (designed enforcement); XTRA/SLIDER specs Wave-0-skip until present. NOT an engineering fallback — an enforced precondition. |

**Missing dependencies with no fallback:** None — all runtime/build/test dependencies are present and verified.

**Owner-action precondition (not a missing dependency):** The 3 new owner rigs are a human export scheduled off the critical path (D-01). The `phase44-fixture-guard.spec.ts` + `CURRENT_PHASE` mechanism is the *designed* enforcement that the blocker cannot silently slip past Phase 44. Research assumes they will exist (A1) and flags the presence-guard (`tryLoad43()` / `it.skipIf` ENOENT) as the Wave-0 pattern for the specs that consume them.

## Validation Architecture

> `workflow.nyquist_validation: true` `[VERIFIED: .planning/config.json]` — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest v4 |
| Config file | `vitest.config.ts` (auto-discovers `tests/**/*.spec.ts`) |
| Quick run command | `npx vitest run tests/core/loader-version-guard-predicate.spec.ts tests/runtime43/` (targeted) |
| Full suite command | `npm run test` (vitest run) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISP-01 | 4.2 JSON → '4.2' tag; 4.3 JSON → '4.3' tag; `checkSpine43Schema` repurposed | unit | `npx vitest run tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-43-schema-guard-predicate.spec.ts` | ✅ exist (D-11 modifies 4.3 arms; ❌ Wave 0: add resolveRuntimeTag positive-routing cases) |
| DISP-01 | end-to-end: a 4.3 fixture loads + samples through `loadSkeleton` (no throw) | integration | `npx vitest run tests/runtime/d13-43-load-smoke.spec.ts` | ✅ exists (D-11: "makes it real" — add a gated-loader-routes arm) |
| DISP-02 | `<4.2` throws (preserved); `≥4.4`/`≥5` throws (NEW arm); `4.3.x`/`-beta` routes | unit | `npx vitest run tests/core/loader-version-guard-predicate.spec.ts tests/core/errors-version.spec.ts` | ✅ exist; ❌ Wave 0: add explicit `4.3.0→route`, `4.4.0→throw`, `5.0.0→throw`, `4.3.73-beta→route`, `4.2-from-4.3.01→4.2` cases |
| DISP-03 | routing decided before `pickRuntime`/`rt.parseSkeleton` | structural | covered by the loader call-order (resolveRuntimeTag at the pre-atlas seam) — assert via a loader-level test that a 4.2 JSON never reaches runtime-43 | ✅ `tests/core/loader.spec.ts` exists; ❌ Wave 0: add a "4.2 JSON resolves tag before parse" assertion if not implied |
| ORCL-01 | 4.3 + 4.2 sibling committed in-repo, non-IK | structural | `npx vitest run tests/safe01/phase44-fixture-guard.spec.ts` (+ git-tracked check) | ✅ exists (arms at `CURRENT_PHASE`→44); fixtures: skeleton2.* committed, skeleton2_42.* committed by D-05 |
| ORCL-02 | 4.3-runtime vs 4.2-runtime ALL 3 SamplerOutput maps within 1e-4 (hybrid abs-OR-rel), HARD gate | integration (HARD phase-exit gate) | `npx vitest run tests/runtime43/orcl02-equivalence.spec.ts` | ❌ Wave 0: NEW spec — generalize `runtime43-d03.spec.ts` (reuse `buildLoad43`/`buildLoadSibling42`/`canonicalize`) to all-3-maps + D-13 comparator + D-14 hard semantics |
| ORCL-03 | #891 status — v1.6 NO-OP (ORCL-01 non-IK, source-confirmed) | documentation | n/a (CONTEXT documents disposition; no human gate — Phase 42 D-03) | n/a — `ik` absent in both `skeleton2.json` + `skeleton2_42.json` `[VERIFIED]` |
| XTRA-01 | multi-map fixture samples no-throw + own-baseline byte-stable + STRUCTURAL (≥2 typed targets, local+world, mix≠1.0) | integration + structural | `npx vitest run tests/runtime43/xtra01-baseline.spec.ts tests/runtime43/xtra01-structural.spec.ts` | ❌ Wave 0: NEW specs — clone `runtime43-baseline.spec.ts` pattern + parse-JSON structural assertion vs verified 4.3.0 `TransformConstraintData` shape |
| XTRA-02 | scaleYMode fixture samples no-throw + own-baseline byte-stable + STRUCTURAL (Uniform AND Volume) | integration + structural | `npx vitest run tests/runtime43/xtra02-baseline.spec.ts tests/runtime43/xtra02-structural.spec.ts` | ❌ Wave 0: NEW specs — same pattern; structural assertion vs verified 4.3.0 `ScaleYMode` enum + `"scaleY"` JSON key |
| D-02 (SLIDER existence) | `SLIDER_4_3/` exists (+ OPTIONAL smoke-load-no-throw via runtime-43) | smoke (optional) | `npx vitest run tests/runtime43/slider43-smoke.spec.ts` (optional) | ❌ Wave 0 (OPTIONAL): NEW smoke spec using `pickRuntime('4.3')` + parse-no-throw |
| D-04 | 4.3 fixtures excluded from SAFE-01 discovery post-flip | regression | `npx vitest run tests/safe01/safe01-enumeration.spec.ts tests/safe01/safe01-baseline.spec.ts` (must stay green AFTER the dispatch flip) | ✅ exist; ❌ Wave 0: add the path-prefix denylist to `discover-fixtures.ts` so these stay green post-flip |
| D-11 | `<4.2`/`≥4.4` throw-cases preserved as explicit assertions; 4.3 arms assert routing | unit | `npm run test` (the 10 enumerated D-11 files all green at Phase 44 exit) | ✅ all 10 exist; modified (not new) |

### Multi-Runtime Entrypoint Matrix (load-bearing — memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`)

`pickRuntime` resolves via 3 distinct mechanisms (`[VERIFIED: runtime.ts:174-217]`). The dispatch flip changes the tag passed; **each entrypoint must be verified independently** — `npm test` alone green-washes a per-runtime seam gap (Phase 43's GAP-43-CLI-SEAM was a 5/5-verified phase with a fully-broken CLI).

| Entrypoint | Resolution arm | Verification command | Asserts |
|------------|----------------|----------------------|---------|
| vitest (ESM) | globalThis resolver (`__GSD_ESM_ADAPTER_RESOLVER__`) | `npm run test` | DISP/ORCL/XTRA specs green; 4.3 routes under the test resolver |
| built CJS worker | ambient `require('../runtime-4x.cjs')` (GAP-43-PROD-SEAM-fixed for 4.2; **4.3 arm exercised in production for the first time by this flip — A3**) | `npm run build` then sample a 4.3 fixture through the BUILT `out/main` worker (not `src/`) | the built worker routes a 4.3 input to runtime-43 (lazy-single-copy preserved — re-verify per CONTEXT memory) |
| CLI (tsx/ESM) | `scripts/register-esm-adapter-resolver.ts` (GAP-43-CLI-SEAM fix, 43-07) | `npm run cli -- fixtures/SIMPLE_PROJECT_43/skeleton2.json` | the CLI routes the 4.3 fixture (no `pickRuntime` loud-throw; produces a table, not a reject) |

**Sampling rate:**
- **Per task commit:** `npx vitest run` on the touched spec(s) + the loader-predicate trio + `tests/safe01/safe01-enumeration.spec.ts` (the D-04 canary).
- **Per wave merge:** `npm run test` (full vitest suite — note the ~11 `tests/renderer/*` MixBlend IMPORT failures are pre-existing/Phase-47-owned per memory `project_renderer_mixblend_preexisting_failure`; trust the targeted gates + the Tests line, not the raw count).
- **Phase gate:** full vitest suite green (modulo the documented pre-existing renderer MixBlend import-failures) + the ORCL-02 HARD gate green + all 3 entrypoints in the Multi-Runtime Matrix verified + the D-04 denylist keeps `safe01-enumeration`/`safe01-baseline` green, BEFORE `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/runtime43/orcl02-equivalence.spec.ts` — covers ORCL-02 (HARD gate, D-12/13/14; generalize `runtime43-d03.spec.ts`)
- [ ] `tests/runtime43/xtra01-baseline.spec.ts` + `xtra01-structural.spec.ts` — covers XTRA-01 (D-03 b+c)
- [ ] `tests/runtime43/xtra02-baseline.spec.ts` + `xtra02-structural.spec.ts` — covers XTRA-02 (D-03 b+c)
- [ ] `tests/runtime43/slider43-smoke.spec.ts` — covers D-02 SLIDER smoke (OPTIONAL)
- [ ] `discover-fixtures.ts` path-prefix denylist — covers D-04 (CO-REQUIRED by the flip; keeps `safe01-enumeration`/`safe01-baseline` green)
- [ ] New positive-routing cases in `loader-version-guard-predicate.spec.ts` / `loader-43-schema-guard-predicate.spec.ts` — covers DISP-01/02 (`4.3.x→route`, `4.4.0→throw`, `4.3.73-beta→route`, `4.2-from-4.3.01→4.2`, `token=4.3+legacy→throw`, `token=4.2+constraints[]→throw`)
- [ ] Built-worker + CLI entrypoint verification step — covers Pitfall 5 / A3 (NOT a vitest spec — a verification task: `npm run build` + sample-4.3-through-built-worker, and `npm run cli -- .../skeleton2.json`)
- [ ] No framework install needed (vitest present)

*(Existing infra reused, NOT rebuilt: `baseline-driver.ts`, `load43.ts`, `canonical-json.ts`, `runtime43-baseline.spec.ts` pattern, `phase44-fixture-guard.spec.ts`, `phase-gate.ts`.)*

## Security Domain

> No `security_enforcement` key in `.planning/config.json` `[VERIFIED]`. This is a pure `core/`/test phase with no auth/session/access-control/network/crypto surface. The only input-trust surface is the `skeleton.spine` version string parse — and that is the EXISTING, already-guarded surface (loader.ts:112–178) being repurposed, not a new attack surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (no auth in scope) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes (narrow) | The `skeleton.spine` token parse stays strictly bounded: D-07 parses ONLY a leading `major.minor` via `parseInt`/explicit `/^(\d+)\.(\d+)/`; an unparseable token → existing typed reject (UNCHANGED). A malformed/hostile version string CANNOT route to the wrong runtime or neither — it throws `SpineVersionUnsupportedError` (the existing fail-loud envelope). This is the PITFALLS "Security Mistakes" control: "dispatch only on a validated major.minor; unknown/future still throws — narrow the guard, don't remove it." D-08's contradiction check is defense-in-depth against a mis-stamped-shape input. |
| V6 Cryptography | no | n/a (no crypto; never hand-roll — not applicable) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hostile/malformed `skeleton.spine` string routing to the wrong runtime (silent mis-sample) | Tampering / Spoofing | D-07 bounded leading-`major.minor` parse + D-08 asymmetric contradiction reject + the preserved typed-error envelope (fail-loud, never silent-guess — the v1.6 silent-undersize-is-existential posture). The dispatch NEVER falls through to a default runtime on an unrecognized token. |
| A 4.2 JSON silently loaded by the 4.3 runtime (zero constraints, no error → undersized texture) | Tampering (data-integrity) | DISP-03 — routing decided by detected version BEFORE runtime load; D-08 token=4.2+constraints[] / token=4.3+legacy contradiction rejects catch mis-stamped shapes. This is the core integrity threat the phase exists to close. |

No new network, IPC-surface, or filesystem-trust boundary is introduced (the IPC error forwarder routes by the UNCHANGED `err.name`; no new error class).

## Sources

### Primary (HIGH confidence)
- `node_modules/spine-core-42/dist/TextureAtlas.js:31-227` (installed `@esotericsoftware/spine-core@4.2.111`) — the D-15 verdict source-read (parse-path walkthrough, `if(field)` tolerance guard, `bounds`/`rotate` region fields, lines 152-155 orig-fallback)
- `node_modules/@esotericsoftware/spine-core/dist/{TextureAtlas.js,IkConstraintData.{js,d.ts},TransformConstraintData.d.ts,SkeletonJson.js}` (installed 4.3.0) — verified XTRA-01/02 constraint shapes; 4.2-vs-4.3 atlas-parser equivalence diff
- `src/core/loader.ts:112-178,243-250` — `checkSpineVersion`/`checkSpine43Schema`/`pickRuntime('4.2')` hard-pick (verified line numbers; CONTEXT's :112-177/:203-250 references confirmed against the live file)
- `src/core/errors.ts:86-122` — `SpineVersionUnsupportedError` `isSpine43OrLater` 2-branch (the D-10 extension target)
- `src/core/runtime/runtime.ts:174-217` — `pickRuntime` 3-env-split resolver (vitest globalThis / built CJS ambient-require / CLI tsx) — verified UNCHANGED by the flip
- `src/core/sampler.ts:95-121` — `SamplerOutput`/`PeakRecord` shapes (D-12 compares all 3 maps)
- `tests/runtime43/{baseline-driver.ts,runtime43-d03.spec.ts,runtime43-baseline.spec.ts,load43.ts}` — the ~90%-built ORCL-02 harness + own-baseline pattern (the single highest-leverage reuse)
- `tests/safe01/{discover-fixtures.ts,canonical-json.ts,phase-gate.ts,phase44-fixture-guard.spec.ts,safe01-enumeration.spec.ts}` — the D-04 exclusion-mechanism analysis + CURRENT_PHASE gate
- `fixtures/SIMPLE_PROJECT_43/{skeleton2.json,skeleton2_42.json,skeleton2_42.atlas}` + `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` — real-data validation of D-06/D-07/D-08 routing + the D-15 decisive corroboration
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,FEATURES}.md` — the verified-stable 4.3.0 spec (supersedes SEED-006); §5 loader seam, §"Beta-vs-Stable Drift", Pitfall 2/3/5
- `.planning/phases/42-.../42-OWNER-EXPORT-SPEC.md`, `.planning/phases/43-.../43-CONTEXT.md` (D-01 own-baseline pattern), `.planning/ROADMAP.md` Phase 44 SC, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- CONTEXT.md `<canonical_refs>` memory references (`feedback_replan_can_silently_descope_roadmap_contract`, `project_phase43_pickruntime_esm_split`, `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`, `project_renderer_mixblend_preexisting_failure`) — applied as durable project constraints

### Tertiary (LOW confidence)
- None. The single historically-LOW item (spine-editor#891 stable status) is rendered MOOT for v1.6 by the source-confirmed non-IK ORCL-01 design (ORCL-03 = documented no-op, no human gate).

## Metadata

**Confidence breakdown:**
- D-15 atlas-parse verdict: HIGH — source-read of the installed 4.2.111 `TextureAtlas.js` + decisive corroboration that the identical new format is already the in-production LOCKED golden (`SIMPLE_TEST.atlas`)
- Dispatch design (DISP-01/02/03): HIGH — verified against the live loader.ts decision trees + validated against the actual oracle fixtures' JSON shapes
- Oracle harness reuse (ORCL-02): HIGH — the Phase-43 `tests/runtime43/` driver is read and confirmed to already do the cross-runtime same-rig comparison ORCL-02 generalizes
- XTRA structural shapes: HIGH — verified against the installed 4.3.0 `.d.ts` + compiled `SkeletonJson.js` parse logic
- D-04 exclusion mechanism: HIGH on the mechanism (path-prefix denylist) + the co-requirement reasoning; MEDIUM on the exact prefix set (one planning-time `git ls-files` + `_manifest.json` check resolves Open Question 1 — flagged, not a blocker)
- Architecture/pitfalls: HIGH — derived from actual code anchors + the verified research corpus + applied durable memory

**Research date:** 2026-05-17
**Valid until:** ~2026-06-16 for the 4.3.0/4.2.111 API facts (stable, exact-pinned — Esoteric's patch-shaped API churn is mitigated by RT-01's exact pins). The code-anchor line numbers are valid until `loader.ts`/`errors.ts`/`runtime.ts` are next edited (the planner edits them — re-confirm against the live file at plan time, as this research did vs CONTEXT.md's slightly-stale references).
