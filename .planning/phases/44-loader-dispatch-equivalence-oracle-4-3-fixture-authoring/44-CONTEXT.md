# Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Repurpose the loader from a 4.3-**rejecter** into a version **dispatcher**, acquire
the owner-blocked in-repo 4.3 fixtures, and stand up the layered cross-runtime
equivalence oracle that gates every 4.3-feature claim **before** the user-facing
flip (Phase 45). Delivers:

1. **DISP-01/02/03** — the loader detects skeleton version and routes 4.2 JSON →
   4.2 runtime / 4.3 JSON → 4.3 runtime *before* runtime load; the existing
   `checkSpine43Schema` predicate is repurposed from an unconditional rejecter
   into a routing/contradiction signal; `<4.2` reject preserved + a NEW `≥4.4`
   reject arm added; a 4.2 JSON is never silently loaded by the 4.3 runtime.
2. **ORCL-01/02/03** — the owner-exported SIMPLE_TEST-equivalent rig (committed
   in-repo as both "Version 4.3" and "Version 4.2") + a same-rig cross-runtime
   equivalence test (4.3-runtime vs 4.2-runtime, all three `SamplerOutput` maps
   within 1e-4). ORCL-03's #891 human-verify is a **v1.6 no-op by design**
   (Phase 42 D-03 — ORCL-01 is non-IK; confirmed `ik:false` in both JSONs).
3. **XTRA-01/02** — a 4.3 transform-constraint multi-map fixture and a 4.3 IK
   `scaleYMode` (Uniform + Volume) fixture, each owner-exported, own-baselined,
   and structurally asserted to genuinely exercise the feature.

**NOT in scope (Phase 45/46/47 — do not pull in):** the user-facing copy/docs/
drop-zone sweep (UX-01/UX-02 — Phase 45); the closed-form *analytical* slider
peak assertion (SLIDER-02 — Phase 46); the 4.3 perf budget (PERF-01 — Phase 46);
the spine-player 4.3 bump (PLAYER — Phase 47). Phase 44 only needs `SLIDER_4_3/`
to **exist** (D-02). No ROADMAP/REQUIREMENTS re-map — phase stays fully scoped
(owner exports all 3 missing rigs first, D-01).

</domain>

<decisions>
## Implementation Decisions

### Owner-fixture status & sequencing

- **D-01:** The owner exports + commits all 3 missing rigs (`fixtures/SLIDER_4_3/`,
  `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`) per `42-OWNER-EXPORT-SPEC.md`
  §3–§5 **before Phase 44 executes**. Phase 44 stays **fully scoped**
  (DISP-01/02/03 + ORCL-01/02/03 + XTRA-01/02); **no roadmap / REQUIREMENTS
  re-map**. The Phase-42 fixture guard
  (`tests/safe01/phase44-fixture-guard.spec.ts`) goes green naturally when
  `CURRENT_PHASE` bumps to 44 (`tests/safe01/phase-gate.ts`) because
  `SIMPLE_PROJECT_43/` already exists and `SLIDER_4_3/` will exist.
- **D-02:** `SLIDER_4_3/` in Phase 44 = **existence-only** (satisfies the
  Phase-42 hard guard) + an OPTIONAL smoke-load-no-throw through the 4.3 runtime.
  The closed-form **analytical** slider-peak assertion stays **Phase 46**
  (SLIDER-01/02). No Phase-46 work is pulled into Phase 44.
- **D-03:** XTRA-01 / XTRA-02 **pass-bar** = (a) samples without throw through
  the 4.3 adapter, **AND** (b) byte-stable against its **own freshly-captured
  4.3 baseline** (the Phase-43 D-01 own-baseline pattern — stored separate from
  SAFE-01, NOT golden-shared with 4.2), **AND** (c) a **STRUCTURAL assertion**
  that the rig genuinely exercises the feature: XTRA-01's JSON has a transform
  constraint with **≥2 differently-typed target properties**, at least one
  **local** + one **world**, with a **non-1.0 mix**; XTRA-02 has an IK
  constraint exercising **`scaleYMode` Uniform AND Volume**. This stops a
  weak/mis-authored rig green-washing — mirrors the D-03 structural-defense
  philosophy the user most emphasized in Phase 43.
- **D-04 (locked, not asked — direct extension of Phase-43 D-05):** ALL
  4.3-only fixtures (the `SIMPLE_PROJECT_43/` 4.3 file, `SLIDER_4_3/`,
  `XTRA01_4_3/`, `XTRA02_4_3/`) **and** the postdates-freeze 4.2 sibling
  `skeleton2_42.*` are **EXCLUDED** from the SAFE-01 4.2 byte-equal frozen set
  **and** the Phase-42 D-08 auto-discovery/enumeration assertion
  (`tests/safe01/discover-fixtures.ts`). They have no pre-v1.6 baseline to
  byte-compare against; auto-including them would falsely trip the frozen-set
  enumeration / SAFE-02 gate. The exclusion **mechanism** is Claude/planner
  discretion (path-prefix denylist vs per-fixture marker vs extending the
  discover predicate); the exclusion itself is locked.
- **D-05:** Fixture commits — the already-on-disk **uncommitted** 4.2 sibling
  `fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas,png}` **plus** the 3 new
  owner rigs — are **folded into Phase 44 execution**: the executor stages +
  commits them as part of the fixture-authoring plan with **plain-English git
  narration**; the user does **not** run git ([[user_git_experience]] /
  [[feedback_explain_git]]). Each fixture lands in the same phase as the test
  that consumes it.

### Dispatch precedence (DISP-01/02/03)

- **D-06:** Loader routing = **TOKEN PRIMARY + reject-on-contradiction**. Parse
  the leading `major.minor` from `skeleton.spine`; route 4.2.x → 4.2 runtime,
  4.3.x → 4.3 runtime. Schema-shape is a **cross-check**, not the primary
  signal. The dispatch decision is made **before** runtime load (DISP-03), at
  the existing hard-pick site (`src/core/loader.ts:243–250`, currently
  `pickRuntime('4.2')`).
- **D-07:** Version-token parse = **leading `major.minor`, SUFFIX-TOLERANT**.
  `4.2-from-4.3.01`→4.2, `4.3.01`→4.3, `4.3.73-beta`→4.3, `4.2.111`→4.2. Only a
  token with **no parseable leading `major.minor` at all** is "malformed" →
  existing typed reject (unchanged). **Load-bearing:** this is what makes the
  ORCL-01 4.2 sibling (`spine:"4.2-from-4.3.01"`) route to runtime-42 so the
  oracle's 4.2 leg can load. Strict-semver-only is rejected (would break the
  oracle).
- **D-08:** Contradiction surface (throws the typed reject instead of routing)
  = **ASYMMETRIC, positive-shape only**:
  - `token=4.2` BUT top-level `constraints[]` array present → **reject**
    (4.3-shape mis-stamped as 4.2 — preserves today's `checkSpine43Schema`
    reject for exactly this case).
  - `token=4.3` BUT legacy top-level `ik`/`transform`/`path` arrays present →
    **reject**.
  - `token=4.3` with NO top-level `constraints[]` AND NO legacy arrays → **NOT
    a contradiction** → route 4.3 by token (a constraint-less 4.3 rig is valid;
    absence of `constraints[]` is NOT evidence of 4.2).
  Fail-loud over silent mis-route. `checkSpine43Schema`'s top-level-`constraints[]`
  sniff is **repurposed** from an unconditional rejecter into the 4.3
  routing/contradiction signal.
- **D-09 (DISP-02 version band):** Accept + route the **ENTIRE `major=4,
  minor=3` band INCLUDING betas** (`4.3.0`, `4.3.01`, `4.3.73-beta` → 4.3
  runtime, best-effort — we cannot ship a runtime per beta; the D-08
  contradiction check + the 4.3 own-baseline catch beta-shape drift). Reject
  `<4.2` (preserved — Phase 12 F3 contract) and a **NEW `≥4.4` arm**
  (`major=4 ∧ minor≥4`, OR `major≥5`).
- **D-10 (`≥4.4` error envelope):** Phase 44 reworks
  `SpineVersionUnsupportedError` (`src/core/errors.ts:86`): split the current
  `isSpine43OrLater` branch so (i) **4.3.x NEVER hits a reject branch** (it
  routes), (ii) a **NEW distinct 3rd branch** handles `≥4.4` with correct
  **FINAL** wording — e.g. *"This file is from Spine {detectedVersion}. This
  app supports Spine 4.2 and 4.3. Re-export as Version 4.3 (or 4.2) and try
  again."* (correct-by-construction — the loader error is never wrong even in
  the 44→45 window), (iii) `<4.2`/`unknown`/malformed keeps the existing
  *"requires Spine 4.2 or later"* message. The `'4.3-schema'` sentinel path is
  reworked consistently (it is now a routing/contradiction signal; the
  `token=4.2 + constraints[]` contradiction-reject message wording is planner's
  discretion — the `≥4.4` and `<4.2` branch wordings ARE locked here).
- **D-11 (test ownership across the 44/45 boundary):** Phase 44 updates **ONLY
  the test assertions for behavior IT changes** — 4.3 inputs now assert
  **routing** (dispatch target / no throw) — keeping CI **green at Phase 44
  exit**. The `<4.2` and `≥4.4` throw-cases stay **explicitly asserted**
  (preserved, not deleted — a passing test still asserting the OLD 4.3-reject
  is a **false-green**). Phase 45 retains ownership of the user-facing
  copy/docs/drop-zone sweep (UX-01/UX-02) + final verification of the full
  reject-test inversion. The ROADMAP Phase-45 SC#3 contract is split
  **EXPLICITLY** (documented here), not silently descoped
  ([[feedback_replan_can_silently_descope_roadmap_contract]]). Affected files
  (planner to enumerate exhaustively): `tests/core/loader-43-schema-guard-predicate.spec.ts`,
  `tests/core/loader-version-guard-predicate.spec.ts`,
  `tests/core/loader-version-guard.spec.ts`, `tests/core/errors-version.spec.ts`,
  `tests/core/loader.spec.ts`, `tests/runtime/d13-43-load-smoke.spec.ts` (this
  one ALREADY wants the new behavior — Phase 44 makes it real),
  `tests/core/ipc.spec.ts`, `tests/main/ipc.spec.ts`,
  `tests/main/viewer-asset-feed-ipc.spec.ts`, `tests/safe01/discover-fixtures.ts`.

### Equivalence oracle (ORCL-02) strictness & failure

- **D-12:** ORCL-02 compares **ALL THREE `SamplerOutput` maps** (`globalPeaks`
  + `perAnimation` + `setupPosePeaks`), each within 1e-4 — NOT `globalPeaks`
  alone. Consistent with the Phase-42 D-06 rationale (per-animation/setup-pose
  drift can net out at the global peak yet still be wrong + user-visible in the
  Animation Breakdown panel). **This deliberately STRENGTHENS** ROADMAP SC#4's
  literal *"globalPeaks agree within 1e-4"* wording — broader scope, NOT a
  descope. Downstream MUST NOT narrow it back to `globalPeaks`-only
  ([[feedback_replan_can_silently_descope_roadmap_contract]] — this is an
  intentional strengthening, flagged so a re-plan doesn't "restore" the
  literal-but-weaker wording).
- **D-13:** Tolerance form = **HYBRID abs-OR-rel** (numpy `isclose` style):
  values agree iff `|a−b| ≤ atol` **OR** `|a−b|/max(|a|,|b|) ≤ rtol`, with
  `atol = rtol = 1e-4`. Robust across tiny values (abs saves) and large
  world-scale magnitudes (rel saves). Absolute-only is rejected (would
  false-trip on legitimate cross-engine float differences at large
  magnitudes).
- **D-14:** Failure semantics = **HARD Phase-44 exit-gate** (SAFE-02-style; the
  phase **CANNOT close** on a trip). A trip fires the
  `TransformConstraint`-on-`SQUARE` wrong-pose-undersize **canary** — exactly
  the existential failure mode v1.6 exists to catch. A documented **diagnosis
  protocol** distinguishes the 4 causes — (a) 4.3 adapter bug, (b) 4.2-sibling
  load failure, (c) rigs not actually equivalent (editor-downgrade artifact),
  (d) cross-engine float noise > tolerance — but **the gate does NOT soften**:
  the cause is investigated, not waived. Tolerance is **NOT** a sanctioned
  escape hatch (the "tolerance tunable once" option was explicitly rejected).
- **D-15 (new-format-atlas-through-runtime-42 contingency):** **MUST-CONFIRM
  research flag** — the researcher source-checks `spine-core@4.2.111`'s
  `TextureAtlas.parse` against the new libgdx atlas format (`size:W,H` with NO
  `format:`/`pma:`/`repeat:` lines, `bounds:x,y,w,h`, `rotate:90` — **confirmed
  present** in `fixtures/SIMPLE_PROJECT_43/skeleton2_42.atlas`) **before** the
  oracle's 4.2 leg is built. If 4.2.111 parses new-format → no action. If
  **NOT** → a documented, reproducible fixture-prep step normalizes **ONLY the
  4.2-sibling `.atlas` text** to old-format (the skeleton JSON stays
  **byte-untouched** — JSON-invariant, source-confirmed since v1.0), recorded
  in a `NOTES` beside the fixture so it's auditable, and `42-OWNER-EXPORT-SPEC.md`
  is amended accordingly.

### Claude's Discretion

Delegated per [[feedback_delegate_implementation_choices]]:

- The **SAFE-01 exclusion mechanism** for the new 4.3 fixtures (D-04) — denylist
  vs marker vs discover-predicate extension. Exclusion itself is locked.
- The `resolveRuntimeTag` / dispatch function exact shape, location, signature,
  and the leading-`major.minor` parse regex; where the D-08 contradiction check
  sits relative to the existing `checkSpineVersion`/`checkSpine43Schema` in
  `loader.ts:203–250`.
- The exact wording for the `token=4.2`-but-`constraints[]` **contradiction**
  reject message (the `≥4.4` and `<4.2` branch wordings ARE locked in D-10).
- The XTRA-01/XTRA-02 own-baseline canonical-JSON form + the
  structural-assertion test mechanics (the D-03 invariants are locked; the test
  shape is delegated).
- The optional `SLIDER_4_3` smoke-load-no-throw test mechanics (D-02).
- Owner-rig **internal filenames** — only the directory names
  `fixtures/SIMPLE_PROJECT_43/`, `fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`,
  `fixtures/XTRA02_4_3/` are **LOCKED** (the Phase-42 CI guard char-checks
  `SIMPLE_PROJECT_43` + `SLIDER_4_3`).

### Carried forward from earlier phases (locked — do not relitigate)

- **ORCL-01 is non-IK by design** (TransformConstraint-only) →
  spine-editor#891-immune → **ORCL-03's #891 human-verify is a v1.6 NO-OP**
  (Phase 42 D-03; confirmed: `skeleton2.json` + `skeleton2_42.json` both have
  `ik:false`, `transform`-only). The non-IK rig is the **PRIMARY** design, not
  a contingency fallback. CONTEXT documents the disposition; no human gate.
- Loader **hard-picks 4.2** today via `pickRuntime('4.2')` at `loader.ts:250`
  (Phase 43 D-02); Phase 44 **replaces that exact hard-pick** with the D-06
  dispatch. The loader is already spine-core-import-free (Phase 43 RT-02).
- **Atlas-source-only** fixtures; math is loaderMode-invariant (Phase 42 D-04 /
  [[project_strict_loadermode_separation]]).
- `core/` stays **pure-TS Layer-3** (no DOM/Electron/sharp; `tests/arch.spec.ts`
  enforced). **Phase 44 is a PURE `core/`/test phase → NO `/gsd-ui-phase`**
  ([[project_gsd_ui_gate_false_positive_core_phases]] — the plan-phase grep
  false-positives on "rUntIme"/"interFACE"; treat `--skip-ui`).
- 4.3 own-baseline pattern follows **Phase-43 D-01** (separate from SAFE-01, NOT
  golden-shared with 4.2; a regression sentinel — EXCEPT ORCL-02, which IS a
  hard gate per D-14).
- The ~11 `tests/renderer/*` MixBlend failures are **pre-existing,
  Phase-47-owned**, NOT a Phase-44 regression
  ([[project_renderer_mixblend_preexisting_failure]]) — trust the targeted
  gates, not the raw suite count.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The verified spec (load first — supersedes SEED-006's falsified beta inventory)
- `.planning/research/SUMMARY.md` — consolidated correction; Phase-44 entry;
  the owner-fixture blocker; the equivalence-oracle + dispatch shape. **This is
  the spec, not SEED-006.**
- `.planning/research/ARCHITECTURE.md` — §"Beta-vs-Stable Drift"; §2 (4.3 NOT
  golden-shared with 4.2 — own-baseline + cross-runtime sentinel); §4 (worker
  stays runtime-blind; lazy single-copy); §5 (loader parse-seam / dispatch
  insertion shape).
- `.planning/research/PITFALLS.md` — Pitfall 1 (beta drift — D-09), **2
  (wrong-pose undersize — the ORCL-02 canary, D-14)**, 4 (dual type-universe),
  5 (4.2 regression / SAFE-01 order — D-04), 6 (cross-runtime `instanceof`).
- `.planning/research/FEATURES.md` — the verified 4.3 API surface; the 4.3
  `TransformConstraint` multi-map (XTRA-01) + IK `scaleYMode` (XTRA-02) shapes.
- `.planning/research/STACK.md` — alias mechanics; dual-type isolation (the
  oracle runs both runtimes in one process).

### Requirements / roadmap / prior phase
- `.planning/REQUIREMENTS.md` — Phase 44 owns **DISP-01/02/03, ORCL-01/02/03,
  XTRA-01/02**; SLIDER-01/02 are **Phase 46**; UX-01/02 are **Phase 45**; the
  SEED-006-superseded banner.
- `.planning/ROADMAP.md` — Phase 44 entry (5 success criteria); the 43→44
  dependency; **note SC#4 says "globalPeaks within 1e-4" — D-12 deliberately
  strengthens this to all three maps; do NOT narrow back**.
- `.planning/phases/43-runtime-adapter-facade-verified-4-3-api-mapping/43-CONTEXT.md`
  — D-01 (4.3 owner rig in-repo + own-baseline pattern), **D-05 (the
  `SIMPLE_PROJECT_43` pair: 4.3 Phase-43-sampled, 4.2 sibling Phase-44-reserved
  — SAFE-01 exclusion, governs D-04)**, the `getOffsets`/`instanceof`/atlas-format
  research flags (the atlas-format flag is D-15 here).
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-CONTEXT.md`
  — D-03 (ORCL-01 non-IK / #891 no-op — governs ORCL-03), D-04 (atlas-source
  only), D-06 (full `SamplerOutput` freeze rationale — governs D-12), D-08-R
  (two-tier discovery — governs D-04), D-13 (the Phase-44 fixture-absence
  guard).
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-OWNER-EXPORT-SPEC.md`
  — the owner-export contract (§3 SLIDER-01, §4 XTRA-01, §5 XTRA-02, §6
  atlas-source-only, §7 redistributable, §8 locked dir table). **Amended by
  D-15** if the new-format-atlas normalization fallback fires.

### Code anchors (read on the way into planning)
- `src/core/loader.ts:112–177` — `checkSpineVersion` (`<4.2`/`>=4.3` throw) +
  `checkSpine43Schema` (top-level `constraints[]` throw) — the rejecters
  repurposed by D-06/D-08/D-09.
- `src/core/loader.ts:203–250` — version inspected **before** atlas resolution;
  the `pickRuntime('4.2')` hard-pick site D-06 replaces (DISP-03).
- `src/core/errors.ts:86` — `SpineVersionUnsupportedError`; the `isSpine43OrLater`
  branch + `'4.3-schema'` sentinel reworked by D-10.
- `src/core/runtime/runtime.ts` — `pickRuntime(tag)` (sync `require` env-split:
  vitest/globalThis + built CJS worker + tsx/ESM CLI — all 3 must keep
  resolving, see [[project_phase43_pickruntime_esm_split]]); `RuntimeTag`.
- `src/core/sampler.ts:119–123` — `SamplerOutput = { globalPeaks, perAnimation,
  setupPosePeaks }` — the exact shape ORCL-02 (D-12) + the XTRA own-baselines
  (D-03) compare.
- `tests/safe01/phase44-fixture-guard.spec.ts` + `tests/safe01/phase-gate.ts`
  — the D-13 owner-fixture-absence hard guard; flips to FAIL when
  `CURRENT_PHASE`→44 if `SIMPLE_PROJECT_43/` or `SLIDER_4_3/` absent (D-01).
- `tests/safe01/discover-fixtures.ts` — SAFE-01 auto-discovery/enumeration; the
  D-04 exclusion lives here (mechanism = discretion).
- `tests/runtime/d13-43-load-smoke.spec.ts` — already asserts a 4.3 JSON loads
  through the 4.3 runtime without reject; Phase 44 (D-11) makes it real.

### Fixtures
- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (+ `.atlas` + `.png`) — 4.3 leg,
  committed, Phase-43-sampled (`spine:"4.3.01"`, top-level `constraints[]`).
- `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json` (+ `_42.atlas` + `_42.png`) —
  4.2 sibling, **on disk, UNCOMMITTED** (`spine:"4.2-from-4.3.01"`, NO top-level
  `constraints[]`, has legacy `transform`/`path`; **new-format atlas** — D-15).
  Committed in Phase 44 (D-05); the ORCL-02 4.2 leg.
- `fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/` — **DO
  NOT EXIST**; owner-exported before Phase 44 executes (D-01). Dir names LOCKED.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — the design template (non-IK
  `TransformConstraint`-on-`SQUARE` appliedPose canary).

### External
- `https://github.com/EsotericSoftware/spine-editor/issues/891` — 4.3→4.2
  downgrade IK-scramble; ORCL-01 non-IK ⇒ immune ⇒ ORCL-03 no-op (context only).

### Memory (durable project facts in play)
- [[feedback_replan_can_silently_descope_roadmap_contract]] — D-11 (44/45 test
  split) + D-12 (ORCL-02 strengthening): guard against a re-plan silently
  dropping/narrowing either.
- [[project_gsd_ui_gate_false_positive_core_phases]] — Phase 44 is pure core/ →
  `--skip-ui`.
- [[project_phase43_pickruntime_esm_split]] — pickRuntime resolves across 3
  runtimes; dispatch must keep all 3 green.
- [[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]] — verify the
  dispatch via every entrypoint (npm test + CLI + built worker), not just one.
- [[project_spine_4_3_editor_atlas_format_editor_driven]] — the
  `4.2-from-4.3.01` token + new-format atlas are editor-driven (D-07, D-15).
- [[project_strict_loadermode_separation]] — atlas-source-only fixtures (D-04
  carry-forward).
- [[feedback_gitignore_fixtures_check_test_refs]] — the presence-guard pattern
  underpinning D-01/D-04.
- [[feedback_delegate_implementation_choices]] — Claude's-Discretion items.
- [[user_git_experience]] / [[feedback_explain_git]] — narrate the fixture
  commits in plain English (D-05).
- [[project_renderer_mixblend_preexisting_failure]] — ignore the ~11 renderer
  MixBlend failures; trust targeted gates.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase-43 `SpineRuntime` facade + `pickRuntime`** — fully built; Phase 44
  only changes WHICH tag `pickRuntime` receives (the D-06 dispatch replaces the
  hard-coded `'4.2'`). No adapter-body work.
- **`checkSpineVersion` / `checkSpine43Schema`** (`loader.ts:112–177`) — the
  detection primitives; repurposed (not rewritten from scratch) per D-06/D-08.
- **Phase-42/43 own-baseline harness** (canonical-JSON serializer +
  presence-guarded `it.skipIf`) — reused for the XTRA own-baselines (D-03) and
  the ORCL-02 comparison (D-12); the SAFE-01 exclusion (D-04) extends
  `discover-fixtures.ts`.
- **`SpineVersionUnsupportedError` discriminated-union envelope** (D-158/D-171)
  — extend with the 3rd `≥4.4` branch (D-10), don't replace the pattern.

### Established Patterns
- **`SamplerOutput` = three `Map<string, PeakRecord>`** — keys
  `${skin}/${slot}/${attachment}` (+ `${animation}/...`); D-12/D-03 canonicalize
  + compare all three.
- **Version inspected before atlas resolution** (`loader.ts:203`) — the
  dispatch decision (D-06, DISP-03) sits here, before `pickRuntime`.
- **Typed-error envelope, fail-loud** — D-08/D-09/D-10/D-14 all prefer a typed
  throw over a silent guess (the v1.6 silent-undersize-is-existential posture).

### Integration Points
- **`loader.ts:250` `pickRuntime('4.2')`** → D-06 dispatch (the single behavior
  flip; everything downstream of the loader is already runtime-blind via
  Phase 43).
- **`tests/safe01/phase-gate.ts` `CURRENT_PHASE`** → bumping to 44 arms the D-13
  guard; D-01 ensures the guarded dirs exist first.
- **The new owner fixtures** → consumed by ORCL-02 (D-12, hard gate),
  XTRA-01/02 (D-03, own-baseline + structural), SLIDER existence (D-02).

</code_context>

<specifics>
## Specific Ideas

- **Fail-loud is the through-line.** Every dispatch/oracle decision the user
  made chose the louder, stricter option: reject-on-contradiction (D-06/D-08),
  hard-stop oracle with no waiver (D-14), all-3-maps (D-12), structural XTRA
  assertions (D-03). The dominant milestone failure mode is *silent* undersize;
  Phase 44's job is to make it *loud*.
- **The `TransformConstraint`-on-`SQUARE` is THE canary** — ORCL-02 tripping
  there is the existential failure mode firing, not test noise (D-14).
- **D-12 deliberately exceeds the ROADMAP literal** — a downstream agent
  "correcting" it back to `globalPeaks`-only would be a silent descope; the
  strengthening is intentional and locked.
- **The `4.2-from-4.3.01` token is editor-reality, not a bug** — the parser
  MUST be suffix-tolerant (D-07) or the entire oracle 4.2 leg is dead.

</specifics>

<deferred>
## Deferred Ideas

- **Closed-form analytical slider validation (SLIDER-02)** → Phase 46. Phase 44
  only needs `SLIDER_4_3/` to exist + optional smoke (D-02).
- **User-facing copy / docs / drop-zone sweep (UX-01/UX-02)** → Phase 45. Phase
  44 produces only the correct-by-construction `≥4.4` loader-error wording
  (D-10) and fixes its own 4.3-reject test breakage (D-11).
- **4.3 perf budget (PERF-01)** → Phase 46.
- **spine-player 4.3 bump (PLAYER-01/02)** → Phase 47.
- None of the above are scope creep — all are ROADMAP-assigned to later phases
  and explicitly fenced out here.

</deferred>

---

*Phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring*
*Context gathered: 2026-05-17*
