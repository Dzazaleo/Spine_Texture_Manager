# Phase 46: Slider Constraint Validation + 4.3 Performance Budget - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 46-slider-constraint-validation-4-3-performance-budget
**Areas discussed:** Slider oracle basis, SLIDER-02 independence, PERF-01 complex rig, Regression budget shape

---

## Slider oracle basis (SLIDER-01)

Scout finding surfaced first: the committed `fixtures/SLIDER_4_3/SLIDER-01.json` deviates materially from `42-OWNER-EXPORT-SPEC.md` §3 (slider `drive` references the `scale` animation via `slider_bone.x`×0.005 + `local:true`, not a direct sliderValue→X=200 linear map), and no `NOTES.txt` exists.

| Option | Description | Selected |
|--------|-------------|----------|
| Committed fixture as-is | Derive real closed-form from in-repo JSON + 4.3 slider semantics; §3 "200" declared stale; no new owner export | ✓ (Claude-recommended under delegation) |
| Owner supplies editor numbers | Keep fixture, owner adds NOTES.txt with editor-displayed peak | ✓ (folded into the recommendation — D-03) |
| Owner re-exports to match §3 | Owner re-exports a clean §3-exact rig (peak X=200 verbatim) | (escape hatch only — D-06) |

**User's choice:** "what do you recommend?" → delegated. Claude locked: keep committed fixture as-is (D-01/02) + owner NOTES.txt with editor-observed peak (D-03), with a re-export escape hatch (D-06) only if the closed form proves non-hand-derivable.
**Notes:** Q3's "owner exports a complex rig" answer meant an owner-export pass was already on the phase critical path, making the NOTES.txt ask nearly free (bundled — D-10). §3 itself prescribed the never-run NOTES.txt fallback.

---

## SLIDER-02 independence rigor

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-derived literal + commented derivation | Closed-form computed by hand from JSON + 4.3 formula, hardcoded with derivation comment; CI-runnable | ✓ (Claude-recommended under delegation — D-04) |
| Cross-checked against the Spine editor | Owner reads peak off editor; test asserts that number | ✓ (folded as the independence anchor — D-05) |
| Standalone reference recomputation | Separate script recomputes the chain independent of core/ | |

**User's choice:** "what do you recommend?" → delegated. Claude locked a **triangulated** oracle (D-04/05): test asserts a hand-derived literal (derivation in comment); that literal must equal the owner's editor-observed NOTES.txt value must equal the sampled peak — three independent implementations agreeing.
**Notes:** The editor is Esoteric's reference runtime — the strongest independence anchor — but the asserted constant stays a hand-derived literal so the test is self-contained and CI-runnable.

---

## PERF-01 complex 4.3 rig

| Option | Description | Selected |
|--------|-------------|----------|
| Force-route Girl-4.2 JSON through runtime-43 | Apples-to-apples isolate-the-runtime; risk: degenerate output under wrong runtime | |
| Owner exports a complex 4.3 rig | Owner authors/exports a Girl-class 4.3 rig | ✓ |
| Synthetically amplify a 4.3 fixture | Programmatically multiply attachments/animations at test time | |
| Largest available 4.3 rig + caveat | Measure SIMPLE_PROJECT_43 (~22 KB) + documented "lighter than Girl" caveat | |

**User's choice:** Owner exports a complex 4.3 rig.
**Notes:** Claude added the locked constraint that the rig must be owner-authored-original / redistributable (no licensed assets like Girl) so the budget gate is CI-enforceable (D-07), and "complex" = computationally complex with a researcher/planner-defined attachment×animation×constraint target (D-08).

---

## Regression budget shape & enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Absolute ms ceiling in a vitest perf test | Mirror sampler-worker-girl.spec.ts; ceiling = measured × margin | ✓ |
| Ratio budget vs measured 4.3 baseline | Gate on ≤ K× the measured baseline | |
| Documented number, advisory only | Record in PROJECT.md/PERF note, no enforcing test | |

**User's choice:** Absolute ms ceiling in a vitest perf test.
**Notes:** Because the D-07 rig is redistributable, the test is CI-enabled (no `it.skipIf(process.env.CI)` — strictly stronger than the Girl gate). Measured wall-time + ratio-to-606ms also recorded narratively at phase close (D-09).

---

## Claude's Discretion

- Slider-oracle-basis and SLIDER-02-independence decisions were explicitly delegated by the user ("what do you recommend?") and locked under the standing "delegate pure-implementation choices to Claude" project signal.
- Latitude retained for researcher/planner: test file layout/names, the precise D-09 margin multiplier (justified from measured variance), and the owner-export §-spec wording — provided the D-01..D-10 invariants hold.

## Deferred Ideas

- Re-exporting SLIDER-01 to the §3-exact idealized shape — D-06 escape hatch only, not the default.
- Exposing the slider as a user-facing animator control — explicitly out of scope per REQUIREMENTS.md.
- A general 4.3 perf regression harness across all 4.3 fixtures — future-milestone idea, not v1.6 scope.
