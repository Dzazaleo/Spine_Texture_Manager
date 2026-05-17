# Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
**Areas discussed:** Owner-fixture status & sequencing, Dispatch precedence (token vs schema), ≥4.4 reject arm + error copy, Equivalence-oracle strictness & failure

---

## Owner-fixture status & sequencing

### Q1 — The 3 missing owner rigs: what's realistic?

| Option | Description | Selected |
|--------|-------------|----------|
| I'll export all 3 now | Owner authors+commits SLIDER_4_3 + XTRA01_4_3 + XTRA02_4_3 before Phase 44 executes; fully scoped, no roadmap change | ✓ |
| Scaffold now, I'll backfill | Presence-guarded harnesses; code lands unblocked; fixtures backfilled later | |
| Descope XTRA-01/02 | Move XTRA out to a later owner-blocked sub-phase; ROADMAP+REQUIREMENTS re-map | |
| Mixed: export SLIDER now | SLIDER_4_3 now (unblock guard); XTRA scaffold-now-backfill-later | |

**User's choice:** I'll export all 3 now
**Notes:** Keeps Phase 44 fully scoped (DISP + ORCL + XTRA-01/02); no roadmap/requirements re-map; Phase-42 fixture guard goes green naturally.

### Q2 — SLIDER_4_3 treatment given closed-form validation is Phase 46

| Option | Description | Selected |
|--------|-------------|----------|
| Existence-only in Phase 44 | Dir exists (satisfies Phase-42 hard guard) + optional smoke-load-no-throw; closed-form peak stays Phase 46 | ✓ |
| Smoke + parse-shape check | + assert JSON contains a slider constraint | |
| Pull full slider validation in | Full SLIDER-01/02 closed-form in Phase 44 (ROADMAP scope change) | |

**User's choice:** Existence-only in Phase 44
**Notes:** Prevents Phase-46 work bleeding into Phase 44.

### Q3 — Pass-bar for XTRA-01 / XTRA-02 "samples correctly"

| Option | Description | Selected |
|--------|-------------|----------|
| Own-baseline + structural assert | samples-no-throw + own 4.3 baseline byte-stable + structural assertion the rig genuinely exercises the feature | ✓ |
| Own-baseline + appliedPose canary | + post-constraint appliedPose non-trivial-delta probe (no shape assertion) | |
| Smoke only | samples-no-throw only | |
| Independent expected-value oracle | hand-derived analytical expected peak (infeasible for multi-map/scaleYMode) | |

**User's choice:** Own-baseline + structural assert
**Notes:** Mirrors the D-03 structural-defense philosophy emphasized in Phase 43; stops a weak/mis-authored rig green-washing.

### Q4 — Fixture commit flow

| Option | Description | Selected |
|--------|-------------|----------|
| Folded into Phase 44 execution | Executor stages+commits as part of the fixture-authoring plan with plain-English git narration; user doesn't run git | ✓ |
| I commit them myself first | User git-adds+commits manually before planning | |
| Commit sibling now, rest in-phase | Commit skeleton2_42.* now; 3 new rigs folded into Phase 44 | |

**User's choice:** Folded into Phase 44 execution
**Notes:** Each fixture lands in the same phase/commit as the test that consumes it; respects beginner-git context.

---

## Dispatch precedence (token vs schema)

### Q1 — Routing driver + behavior on token/schema disagreement

| Option | Description | Selected |
|--------|-------------|----------|
| Token primary + reject-on-contradiction | Parse leading major.minor → route; schema cross-check; contradiction throws typed error (no guess) | ✓ |
| Schema-shape primary | Structure decides; token only a tiebreak | |
| Token only | Route by token alone; ignore schema | |
| Schema primary + token reject-on-contradiction | Schema decides; token contradiction throws | |

**User's choice:** Token primary + reject-on-contradiction
**Notes:** Fail-loud beats silent mis-route; consistent with v1.6 silent-undersize-is-existential stance.

### Q2 — Version-token parse tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| Leading major.minor, suffix-tolerant | `4.2-from-4.3.01`→4.2, `4.3.73-beta`→4.3; only no-leading-major.minor is malformed→reject | ✓ |
| Strict semver only | `4.2-from-4.3.01` malformed→reject (breaks the oracle 4.2 leg) | |
| Leading + known-suffix allowlist | Parse leading major.minor but only fixed suffix shapes accepted | |

**User's choice:** Leading major.minor, suffix-tolerant
**Notes:** Load-bearing — this is what makes the ORCL-01 4.2 sibling route to runtime-42.

### Q3 — Contradiction surface definition

| Option | Description | Selected |
|--------|-------------|----------|
| Asymmetric: positive-shape only | token=4.2+constraints[] → reject; token=4.3+legacy ik/transform/path → reject; token=4.3+no-constraints+no-legacy → NOT contradiction (constraint-less 4.3 valid) | ✓ |
| Strict: any shape mismatch | token=4.3 must have constraints[]; constraint-less 4.3 rejected | |
| Token-only, schema advisory | Never reject on mismatch; log only (re-opens silent mis-route) | |

**User's choice:** Asymmetric: positive-shape only
**Notes:** Precise; doesn't reject valid constraint-less 4.3 rigs.

---

## ≥4.4 reject arm + error copy

### Q1 — Exact accepted-vs-rejected version band

| Option | Description | Selected |
|--------|-------------|----------|
| 4.3.x incl. betas → route | Whole major=4,minor=3 band incl. betas → 4.3 runtime; reject <4.2 and ≥4.4 | ✓ |
| 4.3 stable only | 4.3.NN-beta → typed reject | |
| 4.3.x + future 4.3 minor | (functionally same accepted set; confirms minor-level reject boundary) | |

**User's choice:** 4.3.x incl. betas → route
**Notes:** Can't ship a runtime per beta; the contradiction check + own-baseline catch beta-shape drift.

### Q2 — ≥4.4 reject message content (full sweep is Phase 45)

| Option | Description | Selected |
|--------|-------------|----------|
| Correct, final wording now | Distinct 3rd branch with correct final ≥4.4 message; correct-by-construction in the 44→45 window | ✓ |
| Correct but minimal, polish in P45 | Neutral-correct message; tone polished in Phase 45 sweep | |
| Passthrough + Phase 45 owns wording | Guard arm + placeholder; wrong/placeholder error ships in 44→45 window | |

**User's choice:** Correct, final wording now
**Notes:** Loader error never wrong even before Phase 45's drop-zone/docs sweep; <4.2 keeps existing message; 4.3 no longer hits any reject branch.

### Q3 — Who owns updating the 4.3-reject test assertions across 44/45

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 44 fixes its own breakage | P44 updates only assertions for behavior it changes (4.3→routing); <4.2/≥4.4 throw-cases preserved; P45 owns the user-facing copy/docs sweep + final inversion verification | ✓ |
| Phase 45 owns all of it; P44 red expected | P44 leaves 4.3-reject tests red until P45 (self-introduced red) | |
| Dispatch behind a flag until Phase 45 | Default-OFF dispatch (contradicts ORCL/XTRA needing dispatch ON) | |

**User's choice:** Phase 44 fixes its own breakage
**Notes:** No self-introduced red; the ROADMAP Phase-45 SC#3 contract is split explicitly, not silently descoped.

---

## Equivalence-oracle strictness & failure

### Q1 — What the oracle compares

| Option | Description | Selected |
|--------|-------------|----------|
| globalPeaks only | Literal ROADMAP SC#4; cross-runtime per-anim noise concern | |
| All 3 maps within 1e-4 | globalPeaks + perAnimation + setupPosePeaks; matches Phase-42 D-06 rationale | ✓ |
| globalPeaks strict + per-anim advisory | globalPeaks hard-gate; per-anim logged advisory | |

**User's choice:** All 3 maps within 1e-4
**Notes:** Per-animation drift can net out at the global peak yet be wrong + visible in the Animation Breakdown panel; deliberately strengthens the ROADMAP literal.

### Q2 — Tolerance form

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid abs-or-rel (atol+rtol) | numpy isclose style; robust across tiny + large magnitudes | ✓ |
| Relative only (1e-4) | scale-invariant but over-strict near zero | |
| Absolute only (1e-4) | literal reading; false-trips on large cross-engine values | |

**User's choice:** Hybrid abs-or-rel (atol+rtol)
**Notes:** atol = rtol = 1e-4.

### Q3 — Failure semantics on a trip

| Option | Description | Selected |
|--------|-------------|----------|
| HARD phase-stop + diagnosis protocol | Hard exit-gate; protocol distinguishes 4 causes; gate does NOT soften | ✓ |
| Documented-investigate (soft) | Finding requiring review, not an auto hard-stop | |
| Hard-stop, tolerance tunable once | Hard-stop but a sanctioned one-time tolerance loosening | |

**User's choice:** HARD phase-stop + diagnosis protocol
**Notes:** A trip fires the TransformConstraint-on-SQUARE wrong-pose-undersize canary — the existential failure mode v1.6 exists to catch; cause investigated, not waived. Tolerance is explicitly NOT an escape hatch.

### Q4 — New-format-atlas-through-runtime-42 risk handling

| Option | Description | Selected |
|--------|-------------|----------|
| Research-confirm; normalize if needed | MUST-CONFIRM research flag; if 4.2.111 can't parse new-format → documented reproducible normalize of ONLY the 4.2-sibling .atlas text (JSON byte-untouched) | ✓ |
| Pre-emptively normalize the sibling atlas | Always emit old-format copy regardless | |
| Owner re-exports 4.2 sibling old-format | Depends on a 4.3-editor capability that may not exist | |

**User's choice:** Research-confirm; normalize if needed
**Notes:** Skeleton JSON stays byte-untouched (JSON-invariant); fallback recorded in NOTES + amends 42-OWNER-EXPORT-SPEC.md.

---

## Claude's Discretion

- SAFE-01 exclusion mechanism for the new 4.3 fixtures (exclusion locked; mechanism delegated).
- `resolveRuntimeTag` / dispatch function shape, location, signature, parse regex; contradiction-check placement in loader.ts.
- Wording for the `token=4.2`-but-`constraints[]` contradiction reject message (≥4.4 and <4.2 branch wordings locked).
- XTRA-01/02 own-baseline canonical-JSON form + structural-assertion test mechanics.
- Optional SLIDER_4_3 smoke-load-no-throw test mechanics.
- Owner-rig internal filenames (only directory names are locked).

## Deferred Ideas

- SLIDER-02 closed-form analytical validation → Phase 46.
- UX-01/UX-02 user-facing copy/docs/drop-zone sweep → Phase 45.
- PERF-01 4.3 perf budget → Phase 46.
- PLAYER-01/02 spine-player 4.3 bump → Phase 47.

(All ROADMAP-assigned to later phases — fenced out, not scope creep.)
