# Phase 47: spine-player 4.3.0 Bump + Viewer Regression - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

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
- **D-09 (PLAYER-02 SC#1 render pair):** "Both a 4.2 and a 4.3 fixture render
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

### Fixtures (PLAYER-02 SC#1 render pair — D-09)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (+ `.atlas`, `.png`) — the 4.2
  GL-alpha canary.
- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`spine:"4.3.01"`) — the 4.3
  ORCL-01 SIMPLE_TEST-equivalent sibling.

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

*Phase: 47-spine-player-4-3-0-bump-viewer-regression*
*Context gathered: 2026-05-18*
