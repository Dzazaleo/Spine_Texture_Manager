# Phase 47: spine-player 4.3.0 Bump + Viewer Regression - Context

**Gathered:** 2026-05-18 (original) · **Gap re-discussion:** 2026-05-18
**Status:** Ready for planning — **AMENDED** by the *Gap Re-Discussion
Addendum (DV-1..DV-3)* in `<decisions>` below. Route: `/gsd-plan-phase 47 --gaps`.

> ⚠ **GAP RE-DISCUSSION IN EFFECT.** After 47-01 landed, owner UAT exposed two
> bugs (debug `reg-47-01-43-load-reading-r` — FIXED `53e480c`; debug
> `viewer-43-42-constraint-parse` — root-caused, design gap). The second
> **falsified D-09's premise** ("a 4.2 fixture renders through the 4.3 player"):
> spine-player@4.3.0's bundled spine-core@4.3.0 categorically cannot parse ANY
> 4.2 constraint-bearing JSON (4.3 unified `root.constraints[]` vs 4.2's
> separate `root.ik/transform/path/physics`) — even SIMPLE_TEST throws. The
> locked **D-01..D-09 still stand**; the addendum (DV-1..DV-3) amends only the
> falsified parts (D-09 render-pair + the single-4.3-player assumption). Read
> the addendum FIRST.

<domain>
## Phase Boundary

The final v1.6 phase. Bump `@esotericsoftware/spine-player` `4.2.111` → `4.3.0`
(the decoupled v1.5.1 Animation Viewer), migrate the removed
`MixBlend`/`MixDirection` apply-model imports in `AnimationPlayerModal.tsx`, and
prove the existing viewer still renders correctly through the 4.3 player. Closes
the only open v1.6 requirement pair — **PLAYER-01** (bump + import migration)
and **PLAYER-02** (4.2 + 4.3 render correctness, GL straight-alpha re-verify,
the 5 carried Phase 41 visual/host UATs re-run on the 4.3 player).

**In scope:** the `package.json` spine-player line bump; the 1:1 migration of
the lone `MixBlend`/`MixDirection` call site at `AnimationPlayerModal.tsx:255`
to the 4.3 `apply()` signature; a full audit of the modal's internal
spine-player/spine-webgl touchpoints vs the 4.3.0 `dist`/`.d.ts`; fixing the
~11 `tests/renderer/*` MixBlend IMPORT failures (Phase-47-owned); GL
straight-alpha re-verification on the GL path; an in-phase owner live-UAT
session executing all 5 Phase 41 UATs + GL-alpha on SIMPLE_TEST.

**Out of scope (do not pull in):** any `src/core/` runtime/loader/sampler/
bounds change (the dual-runtime port is Phases 42–46, complete); user-facing
copy / `errors.ts` strings (swept Phase 45); new viewer features/controls
(split-pane source-vs-export comparison is VIEWER-07, a deferred v1.7
candidate); broadening CSP/CORS beyond what 4.3 minimally requires;
4.3→4.2 schema translation.

</domain>

<decisions>
## Implementation Decisions

### ⚠ Gap Re-Discussion Addendum (2026-05-18) — DV-1..DV-3 — READ FIRST

Triggered by debug `viewer-43-42-constraint-parse` (proven Phase-47 design
gap). These amend the falsified parts of the locked decisions; everything in
D-01..D-09 NOT contradicted here still binds.

- **DV-1 (Viewer becomes DUAL-RUNTIME — the gap fix):** The Animation Viewer
  stops being single-runtime spine-player@4.3.0. It mirrors the **core's
  `pickRuntime` split**: **4.2 projects → the EXACT shipped v1.5.1 path**
  (spine-player **4.2.111** + the **pre-migration** modal code path),
  **alias-isolated** (a `spine-player-42`/`spine-webgl-42` alias whose whole
  transitive graph resolves `spine-core-42`, **never** canonical
  spine-core@4.3.0) so the 4.2 leg is a **byte-stable no-op = the
  owner-accepted v1.5.1 viewer**. **4.3 projects → the already-built migrated
  spine-player@4.3.0 path** (47-01's 8-touchpoint Pose-API migration, commit
  `6b3c57e`, **retained unchanged**). The other candidates were rejected:
  4.2→4.3 JSON upcast (fragile; the exact thing the core's dual-runtime split
  exists to avoid; also barred by the still-standing "no 4.x schema
  translation" boundary), core-data-feed (collapses into still needing a
  4.2-matched spine-webgl while discarding the Phase-41/47 player UI),
  4.3-only viewer (rejected — it is a capability regression vs v1.5.1, which
  rendered 4.2 fine).
- **DV-1a (Routing source — explicit, not inferred):** the modal selects the
  4.2 vs 4.3 player path off the **core's already-computed runtime tag**
  (`src/core/loader.ts` `resolveRuntimeTag`/`pickRuntime`) — a single source
  of truth. It does **not** independently re-detect the version. (Locks the
  `feedback_explicit_identity_over_inference` lesson; same bug-class as
  REG-47-01's cross-runtime handoff.)
- **DV-2 (PLAYER-02 SC#2 reworded; D-01 stays STRICT):** ROADMAP/REQUIREMENTS
  **PLAYER-02 SC#2** is reworded from "renders a 4.2 and a 4.3 fixture
  correctly **through the 4.3 player**" (now known-impossible) to: *"the
  viewer renders a 4.2 fixture correctly via the frozen spine-player@4.2.111
  path **AND** a 4.3 fixture via the migrated spine-player@4.3.0 path."*
  **D-01** (hold v1.6 close until BOTH legs green, **no revert**) and **D-02**
  (in-phase blocking owner UAT) remain fully binding — the rewording makes
  them *achievable*, it does not soften them. This is a **reworded
  PLAYER-02**, NOT a new requirement (keep traceability clean). The
  ROADMAP/REQUIREMENTS/traceability text edits are gap-plan work.
  **AMENDS the `<domain>` Phase Boundary:** the dual-runtime viewer arm
  (renderer-graph alias scaffolding + modal branching) is now **IN scope** for
  Phase 47; "broadening CSP/CORS beyond 4.3 minimum" and "4.x schema
  translation" remain **OUT** of scope (DV-1 routes per-version, it does not
  translate).
- **DV-3 (Acceptance/UAT fixture matrix — SUPERSEDES the D-09 render pair):**
  - **4.2 leg** (frozen v1.5.1 @4.2.111 path): `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`
    (the GL straight-alpha hard-floor canary — D-04 / 47-HUMAN-UAT Test 1,
    still required) **+** `fixtures/CHJ/CHJWC_SYMBOLS.json` (transform-only)
    **+** `fixtures/3Queens/TQORW_SYMBOLS.json` (ik + transform + events)
    **+** `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json`
    (ik + transform + **physics** — the most 4.2/4.3-divergent mix).
  - **4.3 leg** (migrated @4.3.0 path): `fixtures/SIMPLE_PROJECT_43/skeleton2.json`.
  - The UAT's real job is **not** re-proving the 4.2 renderer (the frozen
    4.2.111 path is byte-identical to accepted v1.5.1) — it is proving
    **(1)** routing sends each version to the right player off the core tag,
    **(2)** the **alias-isolated 4.2 player actually loads** (the DV-RISK-1
    split-brain — the single most likely failure), **(3)** the constraint-mix
    variety (incl. physics) that exposed the gap is covered. The D-08
    `47-HUMAN-UAT.md` / `41-HUMAN-UAT.md` mechanics still apply; the fixture
    set + the per-fixture expected-player assertion expand to this matrix.

- **DV-RISK-1 (mandatory researcher question — #1 gap-plan risk):** D-03
  established spine-player@4.2.111 + frozen-canonical spine-core@4.3.0 is a
  broken split-brain (bare-resolves the wrong spine-core). DV-1's "frozen
  v1.5.1 4.2 player" **depends on** being able to alias-isolate
  spine-player@4.2.111's **entire** transitive graph (spine-player-42 →
  spine-webgl-42 → spine-core-42) from canonical 4.3.0 — the **same mechanism
  Phase 42 used to alias spine-core**. The researcher MUST confirm this is
  mechanically achievable (npm-alias of spine-player + spine-webgl; no
  bare-specifier leakage to canonical 4.3.0; electron-builder packages both
  player stacks; Vite renderer + vitest both resolve it) BEFORE the gap plan
  commits to DV-1. If it is NOT achievable as-is, that is a discuss-phase
  escalation, not a planner improvisation.

- **DV-NOTE (recovering the v1.5.1 modal path — planner guidance, delegated):**
  47-01 already migrated `AnimationPlayerModal.tsx` to 4.3 in `main`
  (`6b3c57e`). DV-1's 4.2 leg needs the **pre-migration** modal code. Per
  `feedback_delegate_implementation_choices` the planner/researcher owns
  HOW (recover the v1.5.1-tagged source as a frozen sibling component vs.
  reconstruct from git history), but the **principle is locked**: the 4.2
  modal path must be the *literal v1.5.1-shipped source*, not a
  reconstruction — zero behavioral drift is the whole point of DV-1. Also
  owed: a permanent REG-47-01 cross-runtime-handoff regression test (still
  outstanding from debug `reg-47-01-43-load-reading-r`) + a dual-runtime
  routing regression test — gap-plan test scope.

### Regression Fallback / Milestone-Close Posture

- **D-01 (posture — STRICT, overrides roadmap framing):** If the 4.3-player
  viewer cannot be made fully green within Phase 47, **v1.6 milestone close is
  HELD until the viewer is fully green on the 4.3 player.** The user
  deliberately rejected both the "land bump+migration, carry residual visual
  UATs to v1.7" option and the roadmap/PITFALLS "revert spine-player to
  4.2.111, ship without the bump" fallback. **This consciously overrides the
  ROADMAP/research "decoupled + revertible — a player regression must not gate
  the core port" design intent.** Do NOT relitigate back to a softer posture or
  re-introduce the revert fallback as the plan's default.
- **D-02 (verification mechanism — in-phase owner checkpoint):** "Fully green"
  is verified by an **explicit in-phase `checkpoint:human-action`** (Phase
  46-style). After the bump + import migration land and the build is runnable,
  the owner runs the real Electron app and executes **all 5 carried Phase 41
  UATs + the GL straight-alpha SIMPLE_TEST visual check** live. The phase does
  not complete and v1.6 does not close until the owner signs every one of them
  off. The 4 visual/host-blocked UATs are not jsdom-passable — owner live
  execution is the only valid evidence.
- **D-03 (revert-feasibility note — researcher must resolve, not the plan's
  fallback):** Because spine-core@4.3.0 is **frozen-canonical** from Phase 42
  and spine-player bare-resolves it, the `MixBlend`/`MixDirection` import
  migration is broken **right now** independent of the package bump — so
  PLAYER-01's migration is effectively **mandatory and non-revertible**, and
  spine-player@4.2.111 + canonical 4.3.0 is likely a broken split-brain (per
  SUMMARY). The researcher MUST explicitly confirm whether the spine-player
  package bump is even mechanically revertible given frozen-canonical 4.3.0
  (it informs blast-radius understanding) — but per D-01 the revert is NOT the
  plan's fallback regardless of the answer.

### sampleAnimationBounds Migration

- **D-04 (keep the custom resilient path):** Preserve our custom
  `sampleAnimationBounds` and migrate **only** the line-255
  `anim.apply(probe, t, t, false, [], 1, MixBlend.setup, MixDirection.mixIn)`
  call **1:1** to the 4.3 signature. The researcher derives the exact new
  `apply()` argument shape from the 4.3.0 `.d.ts` (SUMMARY notes the new
  `apply()` shape `(fromSetup, add, out, appliedPose)` — confirm against the
  actual tarball). **The Phase 41 content-less-STOP-animation graceful
  degradation (return `null` instead of the fatal `showError` that kills the
  whole player) MUST NOT regress.** Adopting spine-player 4.3's native
  `calculateAnimationViewport` was explicitly rejected — it reintroduces the
  exact crash the custom path was written to fix.
- **D-05 (full internal-touchpoint audit before the live UAT):** Enumerate and
  audit **every** spine-player/spine-webgl internal the modal depends on
  against the 4.3.0 `dist`/`.d.ts`, documenting each as stable-in-4.3.0 or
  changed, BEFORE the owner live UAT — surface drift up front, don't discover
  it during the host-blocked session. Known touchpoints: `apply()` (line 255),
  `makeProbe`, `p.sceneRenderer`/`camera`, `skeleton.getBounds`, the cited
  "vendored line 5862" parent-dir atlas resolution, and the
  `premultipliedAlpha:false`/`alpha:false` straight-alpha shader path
  (`Player.js:13167` `srcFunc` selection referenced in the modal comment).
- **D-06 (same-framing visual parity is the bar):** The migrated
  `sampleAnimationBounds` + camera-freeze/Fit math must frame rigs **the same
  way v1.5.1 did** — a 4.2 fixture must look identical through the 4.3 player.
  Auto-fit / zoom / position drift counts as a regression the owner UAT must
  catch, not an acceptable cross-major shift.

### Next-Step Routing & Verification Artifacts

- **D-07 (`--skip-ui`):** Next step is **`/gsd-plan-phase 47 --skip-ui`**.
  Phase 47 designs **zero new UI** — it is a pure dependency bump + 1:1 import
  migration + regression verification of the *existing* viewer. No
  `/gsd-ui-phase` design contract. This consciously **corrects the speculative
  `project_gsd_ui_gate_false_positive_core_phases` memory note** ("only Phase 47
  truly needs /gsd-ui-phase"), which was written at Phase-43 planning time
  before the actual scope was scouted. The visual acceptance contract is the 5
  UATs + GL-alpha owner checkpoint (D-02), not a UI-SPEC.
- **D-08 (verification artifacts):** Create a new
  `47-HUMAN-UAT.md` capturing all 5 Phase 41 UATs + the GL-alpha SIMPLE_TEST
  check re-run on the 4.3 player (owner-signed), AND flip the 5 pending items
  in `.planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md` in place to
  resolved with a pointer to the Phase 47 re-run. Preserves the Phase 41 audit
  trail and creates the Phase 47 record for milestone close.
- **D-09 (PLAYER-02 SC#1 render pair):** **⚠ SUPERSEDED by DV-3** (its
  "through the 4.3 player" premise was falsified — see the Gap Re-Discussion
  Addendum). Original text retained for provenance:
  "Both a 4.2 and a 4.3 fixture render
  correctly through the 4.3 player" =
  **`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2 — the established GL-alpha
  canary; Phase 41 G-03 was reproduced on it)** +
  **`fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 — the ORCL-01
  SIMPLE_TEST-equivalent sibling)**. Minimal, directly comparable, both already
  in-repo. The internal-touchpoint audit (D-05) may add a rig to the live-UAT
  set if it flags one as alpha/render-risky, but the baseline pair is fixed.

### Claude's Discretion

Delegated per `feedback_delegate_implementation_choices` (within the locked
D-01..D-09 invariants):
- The exact 4.3 `apply()` argument shape (researcher derives from the 4.3.0
  `.d.ts`/`dist` — D-04).
- The precise enumeration + format of the D-05 internal-touchpoint audit.
- How same-framing parity (D-06) is measured/recorded (e.g. screenshot diff vs
  documented camera zoom/position values).
- `47-HUMAN-UAT.md` exact layout (must cover all 5 + GL-alpha, owner-signed).
- The `checkpoint:human-action` task placement/wording in the plan (must gate
  phase completion per D-02).
- The minimal CSP/CORS posture for the 4.3 player (keep origin-scoped; do NOT
  broaden `connect-src`/ACAO beyond what 4.3 actually needs — PITFALLS
  guardrail; not a user decision).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 47: spine-player 4.3.0 Bump + Viewer
  Regression" (lines ~177–185) — goal, 2 success criteria, "Depends on Phase 42
  only", "UI hint: yes" (superseded by D-07 → `--skip-ui`).
- `.planning/REQUIREMENTS.md` §"spine-player Viewer Bump (PLAYER)" — PLAYER-01,
  PLAYER-02 (lines 72–74); Traceability rows 146–147 (the only two Pending
  rows; all 24 others Complete).

### Research (HIGH confidence — the binding 4.3 facts)
- `.planning/research/SUMMARY.md` — line 27 (`MixBlend`/`MixDirection`
  **REMOVED entirely** in 4.3.0; `apply()` new shape
  `(fromSetup, add, out, appliedPose)`; the v1.5.1 viewer imports both →
  breaks); lines 51–53 (spine-player has **no direct spine-core dep** → bare
  resolves canonical 4.3.0 → this is *why* 4.3.0 must be canonical;
  `SpinePlayerConfig` surface API-stable; the break is the removed imports);
  line 142–145 (Phase 47 delivery/rationale/avoids).
- `.planning/research/PITFALLS.md` §"Pitfall 7: spine-player 4.3.0 bump
  regresses the just-shipped v1.5.1 viewer" (lines ~171–189) — the mitigation
  set; the `SpinePlayerConfig`-survived-to-4.3.0 confirmation; **the
  straight-alpha "highest risk, NEVER skip, the PMA memory does NOT transfer to
  spine-webgl GL" rule**; the minimal-CSP/CORS guardrail (lines ~294); the
  modal-isolation/revert risk-register row (line ~325 — note D-01 overrides the
  revert posture).
- `.planning/research/STACK.md` — the two-`package.json`-line stack delta
  (`@esotericsoftware/spine-player": "4.3.0"`); no new build tooling/submodule/
  fork; exact-pin convention.

### Viewer code (the surface this phase modifies)
- `src/renderer/src/modals/AnimationPlayerModal.tsx` — the ONLY file with
  `MixBlend`/`MixDirection` (imports lines 45–53; sole call site **line 255**
  inside `sampleAnimationBounds`, lines 234–275); the resilient-path docstring
  lines 226–232; the straight-alpha config block lines 457–473
  (`premultipliedAlpha:false`, `alpha:false`, the `Player.js:13167` comment);
  internal touchpoints (`makeProbe`, `sceneRenderer`/`camera`, `getBounds`,
  the "vendored line 5862" atlas-parent-dir resolution) for the D-05 audit.
- `package.json` lines 26–27, 35 — `@esotericsoftware/spine-core": "4.3.0"`
  (canonical, frozen Phase 42), `@esotericsoftware/spine-player": "4.2.111"`
  (the line this phase bumps to `4.3.0`), `spine-core-42` alias.

### Phase 41 viewer + the carried UATs (the PLAYER-02 gate)
- `.planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md` — the **5
  pending UATs** (test 2 anim/skin switch + scrub synchrony; test 3 GL leak
  ×10 cycles; test 4 real-fs malformed/missing-asset terminal error UI; test 5
  atlas-less visual parity; test 6 File-menu auto-suppression contract) +
  resolved G-01/G-02/G-03 (CSP `connect-src 'app-image:'`, CORS ACAO,
  straight-alpha) that the 4.3 bump must not regress. D-08 flips these in place.

### Fixtures (PLAYER-02 SC#1 render pair — D-09 → see DV-3 for the live matrix)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (+ `.atlas`, `.png`) — the 4.2
  GL-alpha canary (now the 4.2-leg canary via the frozen 4.2.111 path — DV-3).
- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`spine:"4.3.01"`) — the 4.3
  ORCL-01 SIMPLE_TEST-equivalent sibling (the DV-3 4.3-leg fixture).
- `fixtures/CHJ/CHJWC_SYMBOLS.json`, `fixtures/3Queens/TQORW_SYMBOLS.json`,
  `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` — the DV-3 4.2-leg
  constraint-mix matrix (transform-only / ik+transform+events /
  ik+transform+physics); all `spine:"4.2.43"`, all owner-confirmed broken
  under the 4.3-only viewer.

### Gap Re-Discussion sources (DV-1..DV-3 — MUST read for the gap plan)
- `.planning/debug/viewer-43-42-constraint-parse.md` — the proven root cause
  (4.3 unified `root.constraints[]` vs 4.2 separate
  `root.ik/transform/path/physics`; SkeletonJson.js:129 guard; the falsified
  "SIMPLE_TEST works" control), classification (design gap), and the three
  weighed fix directions DV-1 selects among.
- `.planning/debug/reg-47-01-43-load-reading-r.md` — the sibling cross-runtime
  bug FIXED in `53e480c` (the load-path precedent + the still-owed permanent
  regression test noted in DV-NOTE).
- `src/core/loader.ts` — `resolveRuntimeTag` / `pickRuntime` (the runtime-tag
  source DV-1a reuses; the dual-runtime split DV-1 mirrors).
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/`
  — the npm-alias scaffolding precedent (`spine-core` ↔ `spine-core-42`) that
  DV-1's `spine-player-42`/`spine-webgl-42` alias must replicate; the
  DV-RISK-1 split-brain proof lives against this prior art.
- Memory: `project_phase47_viewer_single_runtime_design_gap`,
  `project_reg4701_buildsummary_cross_runtime_fixed`,
  `feedback_uat_opened_is_not_rendered`,
  `feedback_isolated_clean_is_not_pipeline_clean`,
  `feedback_explicit_identity_over_inference` (DV-1a),
  `project_phase43_pickruntime_esm_split` (the dual-runtime rationale).

### Memory (durable project facts in play)
- `project_renderer_mixblend_preexisting_failure` — the ~11 `tests/renderer/*`
  MixBlend IMPORT failures are **Phase-47-owned**; fixing them is in scope here
  (no longer "ignore as pre-existing").
- `project_gsd_ui_gate_false_positive_core_phases` — **D-07 corrects this**:
  Phase 47 is `--skip-ui` (zero new UI), NOT a `/gsd-ui-phase` candidate. (To
  be updated post-discussion.)
- `project_phase43_pickruntime_esm_split` / `project_v131_shipped` — context:
  spine-player is decoupled from the core dual-runtime (own embedded spine-core
  via spine-webgl); Phase 47 changes no `src/core/` behavior.
- `feedback_delegate_implementation_choices` — the Claude's-Discretion items.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 41 viewer (`AnimationPlayerModal.tsx`)** — fully built and modal-
  isolated; Phase 47 modifies it surgically (imports + line 255), not a
  rewrite. The custom `sampleAnimationBounds`/`sampleSetupBounds` resilience
  scaffolding is kept verbatim (D-04).
- **`41-HUMAN-UAT.md`** — the 5 pending tests are pre-written and now do
  double duty as the 4.3-player regression gate (PITFALLS line ~183). D-08
  reuses them; no new UAT authoring beyond porting them into `47-HUMAN-UAT.md`.
- **In-repo fixtures** — SIMPLE_TEST (4.2) + SIMPLE_PROJECT_43 (4.3) already
  committed; no fixture authoring needed (D-09).

### Established Patterns
- **Exact-pin spine deps** — `spine-core@4.3.0` and `spine-core-42` alias are
  exact-pinned; bump `spine-player` to exact `4.3.0` (sibling-aligned to the
  canonical spine-core), no caret/range. Codebase convention, not a question.
- **Owner `checkpoint:human-action`** — Phase 46 just used this pattern (owner
  editor read → committed NOTES.txt). D-02's live-UAT checkpoint mirrors it;
  worktree isolation is incompatible with an owner-action checkpoint (Phase 46
  ran sequential on the main tree for exactly this reason — relevant to the
  plan's wave/isolation shape).
- **Renderer copy/imports inline in TSX** — no i18n/indirection layer; the
  migration is a direct import-list + call-site edit.

### Integration Points
- `package.json` `@esotericsoftware/spine-player` line — the single dependency
  edit; pulls `@esotericsoftware/spine-webgl@4.3.0` transitively.
- `AnimationPlayerModal.tsx` imports (45–53) + line 255 — the only source
  edits; everything else in the modal stays byte-stable unless the D-05 audit
  flags a changed internal.
- `tests/renderer/*` (~11 suites) — currently RED at IMPORT because
  spine-player@4.2.111 bare-resolves canonical spine-core@4.3.0 (MixBlend
  gone); go GREEN as a side effect of the PLAYER-01 migration. This is the
  machine-checkable half of the phase (the visual half is the owner UAT).
- CSP / `app-image://` protocol handler — Phase 41 G-01/G-02 fixes; the D-05
  audit must confirm the 4.3 player needs no broader surface (PITFALLS
  guardrail), keep it origin-scoped.

</code_context>

<specifics>
## Specific Ideas

- **The hard floor is GL straight-alpha on SIMPLE_TEST.** PITFALLS marks this
  "highest risk, NEVER skip" and explicitly warns the `sharp`/`libvips`
  `project_pma_no_op_in_current_stack` reasoning does NOT transfer to the
  spine-webgl GL path. The current config (`premultipliedAlpha:false`,
  `alpha:false`) was a hard-won Phase 41 G-03 fix — re-verify it empirically on
  the 4.3 player (render SIMPLE_TEST, confirm no dark-fringe / double-multiply
  halo around mesh attachments); only change the config if a halo actually
  appears AND the D-05 shader-path audit explains why.
- **Two-track completion:** (1) machine — renderer test suite GREEN (the ~11
  MixBlend import failures fixed) + typecheck; (2) human — the D-02 owner live
  UAT (all 5 + GL-alpha) signed off. v1.6 closes only when BOTH are true
  (D-01).
- **`apply()` shape is research-derived, not guessed** — SUMMARY says the new
  shape is `(fromSetup, add, out, appliedPose)`; the planner/researcher
  confirms the exact argument list against the actual 4.3.0 `Animation`/
  `Timeline` `.d.ts` before writing the migrated line (this is the one true
  API break in the phase).

</specifics>

<deferred>
## Deferred Ideas

- **VIEWER-07 — split-pane source-vs-exported comparison in the viewer.**
  A real feature (deferred at v1.5.1, conditional on SEED-009 D-02; tracked in
  REQUIREMENTS.md Future). NOT Phase 47 scope (Phase 47 ships no new viewer
  capability — bump + regression only). v1.7 candidate.
- **External-surface copy sweep (GitHub repo description / Releases notes)** —
  owner ship-time follow-up carried from Phase 45 D-07; out-of-repo, not a
  Phase 47 concern. Surfaces at v1.6 ship.
- **Broader 4.3 viewer fixture matrix (SLIDER_4_3 / XTRA / spineboy_4.3 visual
  co-render)** — considered and scoped down to the SIMPLE_TEST + SIMPLE_PROJECT_43
  pair (D-09). A wider visual co-render matrix is a future-confidence idea, not
  v1.6 scope; the D-05 audit may pull in one extra rig only if it flags an
  alpha/render risk.

None of the above were scope-creep redirects from the user — they are boundary
clarifications captured so they aren't relitigated.

</deferred>

---

## Amendment 2026-05-19 — GA-1 falsified (47-03 owner decision)

*Appended by the 47-03 executor (continuation) — does NOT rewrite the
locked DV-1..DV-3 / DV-NOTE above; it re-scopes DV-NOTE per an owner
AskUserQuestion decision. Downstream 47-04/47-05 MUST consume this amended
DV-NOTE wording — no relitigation.*

**GA-1 (47-RESEARCH §6 / the 47-03 plan's `<interfaces>` claim "the frozen
sibling compiles unchanged against 4.2.111 types") was EMPIRICALLY
FALSIFIED** and the falsification was orchestrator-confirmed against the
genuine installed `@esotericsoftware/spine-player@4.2.111` `.d.ts`:

- The source-ref `9f967d2:src/renderer/src/modals/AnimationPlayerModal.tsx`
  **is correct** — git proved `9f967d2` never touched the modal, so that
  blob is the literal byte-identical shipped-green v1.5.1 modal. Do NOT
  look for a different ref; the materialization recipe is sound.
- BUT v1.5.1 shipped green on **tests + runtime, never strict
  `typecheck:web`** (that gate is a 47-01-era contract). The literal
  v1.5.1 modal carries **11 strict-TS errors INTRINSIC to its own genuine
  4.2.111 surface — NOT 4.3 type-bleed**. Alias isolation is verified
  perfect: `typecheck:web` produced exactly 11 errors, ALL inside
  `AnimationPlayerModal42.tsx`, ZERO elsewhere. The 11:
  `preserveDrawingBuffer` required-but-missing (×1); `p.skeleton` /
  `entry.animation` possibly-null unguarded (×8); `p.playTime`
  private-access (×2).

**OWNER DECISION (AskUserQuestion, 2026-05-19): option "@ts-nocheck
sentinel".** Resolution = add ONE deterministic leading `// @ts-nocheck`
documenting-header block to `AnimationPlayerModal42.tsx` as a sanctioned
**3rd transform**. Body stays byte-verbatim; NO logic edits; NO project
tsconfig change.

**DV-NOTE is hereby re-scoped:** from *"byte-verbatim + ONLY 2 seds"* →
**"byte-verbatim body + 2 seds + 1 sanctioned `@ts-nocheck` sentinel"**.
The frozen modal's visual correctness remains gated by the **47-05 owner
UAT (D-02)**, not tsc — that is the binding visual contract; the
`@ts-nocheck` only acknowledges that strict `typecheck:web` is the wrong
oracle for a frozen owner-accepted v1.5.1 artifact.

The amended Task-2 acceptance oracle: `diff <(redirect|sed) modal42`
equals EXACTLY the prepended sentinel block (`0a1,12`) and nothing else
(the ~1000-line body byte-identical) — verified in 47-03.

*(The T-D spec — same class of frozen-by-redirect v1.5.1 artifact under
the identical rationale — did NOT need the parallel sentinel: test files
are vitest-typed, not in `tsconfig.web.json`'s build graph, so it never
hit the strict-`typecheck:web` wall; it materialized clean via pure
redirect+seds and passes GREEN 22/22.)*

---

*Phase: 47-spine-player-4-3-0-bump-viewer-regression*
*Context gathered: 2026-05-18*
*Amended: 2026-05-19 (47-03 GA-1 owner decision)*
