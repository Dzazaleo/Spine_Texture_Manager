# Phase 46: Slider Constraint Validation + 4.3 Performance Budget - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two independent soundness proofs for the 4.3 runtime port — no new product capability:

1. **SLIDER-01/02** — Prove the 4.3-only `SliderConstraint` propagates correctly through the **unchanged** `updateWorldTransform(Physics.update)` path, with **zero slider-specific sampler code**, via an independently-derived **closed-form** oracle (a `peak == analytical-value` assertion, not a self-referential "it runs").
2. **PERF-01** — Record a **measured** 4.3-specific wall-time regression budget on a complex 4.3 rig, compared against the historical N2.2 / 4.2 606 ms contract. Parity with 4.2 is explicitly **not assumed** (4.3's three-pose model is heavier per tick).

In scope: the SLIDER-02 closed-form test, a `SLIDER_4_3/NOTES.txt` (editor-observed peak), one owner-exported complex 4.3 perf rig, and the PERF-01 budget gate.

Out of scope: any slider-specific sampler/runtime code (the proof is that none is needed); exposing the slider as a user UI control; the spine-player viewer bump (Phase 47); 4.3→4.2 schema translation.

</domain>

<decisions>
## Implementation Decisions

### Slider Oracle Basis (SLIDER-01)
- **D-01:** Keep the **committed `fixtures/SLIDER_4_3/SLIDER-01.{json,atlas,png}` (spine `4.3.02`) as-is** — it is a real, valid 4.3 slider rig that genuinely exercises the constraint through the unchanged path. Do **not** force a re-export to the `42-OWNER-EXPORT-SPEC.md` §3 idealized shape.
- **D-02:** The `42-OWNER-EXPORT-SPEC.md` §3 recorded ground truth (`peak local X = 200`, `x(t)=200·t`, "1:2 linear sliderValue→X" map) is **declared STALE**. The committed fixture's actual mechanism differs materially: the slider `drive` constraint references the **`scale` animation**, driven by `slider_bone.x` (`local: true`) × `scale: 0.005`; the rig also has a `slide` animation (translate X 0→200) and a `scale` animation (scale 1→4×). The real closed form is whatever the documented Spine 4.3 `SliderConstraint` time-mapping semantics yield for *this* rig — the researcher derives it from the actual JSON, not from §3.
- **D-03:** The owner adds `fixtures/SLIDER_4_3/NOTES.txt` recording the **Spine 4.3 editor-observed peak** at the peak frame (the value Esoteric's own reference runtime displays — bone local X and/or world scale, whichever the closed form targets). This executes §3's own never-run fallback clause ("document the actual numbers you used in a `NOTES.txt` beside the export").

### SLIDER-02 Independence Rigor
- **D-04:** The **test's asserted constant is a hand-derived literal** computed from the SLIDER-01.json keyframes + the documented Spine 4.3 `SliderConstraint` formula, with the **full derivation written in a comment** (matches this codebase's golden/closed-form convention; self-contained, CI-runnable without re-reading the editor).
- **D-05:** Independence is **triangulated, not circular**: the hand-derived literal MUST equal the owner's editor-observed `NOTES.txt` value MUST equal the sampled peak from the unchanged path. Three sources, three implementations (hand-math, Esoteric editor, our runtime-43) — agreement is the proof.
- **D-06:** **Escape hatch (not the default path):** only if the researcher finds the committed fixture's closed form is genuinely ambiguous / not hand-derivable from documented 4.3 slider semantics does the phase escalate to an owner re-export of a §3-style minimal rig. Default is D-01..D-05.

### PERF-01 Complex Rig & Budget
- **D-07:** PERF-01's measurement subject is an **owner-authored, redistributable, in-repo complex 4.3 rig** (user-selected). It must be original (no licensed third-party assets like `fixtures/Girl/`) so it can be committed and the budget gate can run on **CI** — strictly stronger than the existing Girl gate's `it.skipIf(process.env.CI)` local-only pattern.
- **D-08:** "Complex" = **computationally** complex, not artistically complex. The owner-export §-spec (written by researcher/planner) must define a concrete complexity target — attachment count × animation count × constraint mix — calibrated so the sampler wall-time is a meaningful, N2.2-comparable number against the 4.2 606 ms reference.
- **D-09:** The budget is an **absolute-ms ceiling in a vitest perf test** (user-selected), structurally mirroring `tests/main/sampler-worker-girl.spec.ts` (1 discarded warm-up run + 1 timed `runSamplerJob`, `console.log` diagnostic, ceiling = measured × margin). Because the rig is redistributable (D-07), the test is **CI-enabled** (no `skipIf(CI)`). The measured 4.3 wall-time and its ratio to 606 ms are also recorded narratively in PROJECT.md at phase close.

### Owner-Export Pipeline
- **D-10:** Phase 46 has **one bundled owner-export pass** delivering both (a) the complex 4.3 perf rig (D-07/08) and (b) `fixtures/SLIDER_4_3/NOTES.txt` (D-03). This reuses the established Phase-44 bundled-owner-export pattern that the ROADMAP blesses ("the slider fixture rides the same owner-export pipeline as the oracle/4.3 fixtures"). The researcher/planner authors the precise owner-export §-spec (as `42-OWNER-EXPORT-SPEC.md` did for Phase 44).

### Claude's Discretion
- User explicitly delegated the slider-oracle-basis and SLIDER-02-independence decisions ("what do you recommend?"). Recommendations above (D-01..D-06) are locked under that delegation per the standing "delegate pure-implementation choices to Claude" signal. The researcher/planner has latitude on: exact test file layout/names, the precise margin multiplier for D-09 (justify from measured variance), and the owner-export §-spec wording — provided D-01..D-10 invariants hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 46: Slider Constraint Validation + 4.3 Performance Budget" (lines ~165–173) — goal, 3 success criteria, dependency on Phase 44.
- `.planning/REQUIREMENTS.md` §"Slider Constraint Validation (SLIDER)" + SLIDER-01/02 + PERF-01 (lines ~56–82) — the locked requirement text; note SLIDER is "PORT-03 reshaped: fixture-only, no sampler code".

### Slider oracle (SLIDER-01/02)
- `fixtures/SLIDER_4_3/SLIDER-01.json` + `SLIDER-01.atlas` + `SLIDER-01.png` — the **authoritative** committed 4.3 slider rig (D-01). The closed form is derived from THIS file, not from §3.
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-OWNER-EXPORT-SPEC.md` §3 — the original SLIDER-01 owner spec. **Read for the never-run NOTES.txt fallback clause and historical intent ONLY; its recorded "peak=200" ground truth is STALE per D-02.**
- `tests/runtime43/slider43-smoke.spec.ts` — Phase 44's deliberate load-no-throw-only smoke (scope-fenced out of peak math). The SLIDER-02 test is the closed-form layer that smoke deliberately omitted; reuse its rig-resolution / `pickRuntime('4.3')` pattern.
- `.planning/phases/44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring/44-CONTEXT.md` §D-02 + Deferred Ideas — records that the closed-form analytical slider validation was explicitly deferred to Phase 46 (no Phase-46 work was pulled into Phase 44).

### Performance budget (PERF-01)
- `tests/main/sampler-worker-girl.spec.ts` — the **structural analog** for the PERF-01 test (warm-up + timed `runSamplerJob`, ms ceiling, `[N2.2]` diagnostic log). Phase 46's gate copies this structure but CI-enabled (D-07/D-09).
- `src/main/sampler-worker.ts` (`runSamplerJob` export) — the wall-time measurement entrypoint used by the analog test.
- `.planning/milestones/v1.0-REQUIREMENTS.md` N2.2 — the lineage: original contract "Complex rig samples in < 10 s on the main thread"; Phase 9 measured **606 ms** on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (~17× under). This 606 ms is the comparison reference, not a hard ceiling.
- `.planning/PROJECT.md` (lines ~13, ~113, ~165) — current v1.6 dual-runtime state, the 606 ms / N2.2 lineage, and the `2d0246c` Phase-44 runtime-43 mesh-UV page-space fix that makes the 4.3 sampler math trustworthy (memory: [[project_runtime43_mesh_uv_pagespace]]).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/main/sampler-worker-girl.spec.ts` — copy this file's shape for the PERF-01 gate: 1 discarded warm-up `runSamplerJob`, 1 timed run, `expect(elapsed).toBeLessThan(BUDGET)`, `console.log('[PERF-43] …')`. Difference: NO `it.skipIf(process.env.CI)` (D-07 rig is redistributable, unlike gitignored Girl).
- `tests/runtime43/slider43-smoke.spec.ts` — reuse its `RIG_DIR` scan + ENOENT loud-or-skip pattern + `pickRuntime('4.3')` resolution for the SLIDER-02 test setup; then extend past load into a full sample + peak assertion.
- `src/main/sampler-worker.ts` `runSamplerJob({ skeletonPath, samplingHz: 120, onProgress, isCancelled })` — same entrypoint both tests use to drive the unchanged sampler path.

### Established Patterns
- The loader is a version dispatcher (Phase 44): `SLIDER-01.json` (`spine: "4.3.02"`) auto-routes to `runtime-43` via `resolveRuntimeTag`; the SLIDER-02 test does NOT need to force a runtime — feeding the JSON through the normal loader IS the proof that dispatch + the unchanged path carries the slider.
- Closed-form / golden tests in this codebase assert against a hand-derived literal with the derivation in a comment (e.g. `tests/core/overrides.spec.ts` arithmetic comments). D-04 follows this convention.
- 120 Hz default sampler rate (CLAUDE.md fact 6) — both the closed-form derivation and the perf measurement run at 120 Hz unless a decision says otherwise.

### Integration Points
- SLIDER-02 connects at the loader→sampler boundary: load `SLIDER_4_3/` → sample → read `globalPeaks` → assert `== closed-form literal`. No `core/` source change is in scope (the absence of slider-specific code IS the deliverable).
- PERF-01 connects at `runSamplerJob` on the new owner-exported complex 4.3 rig (a new in-repo fixture dir).
- The N2.2 "no slider-specific sampler code" invariant is enforced implicitly: if the test passes with zero `core/` diff touching slider logic, SLIDER-02 SC#2 holds.

</code_context>

<specifics>
## Specific Ideas

- The committed slider rig's real mechanism (for the researcher's closed-form derivation): `constraints[0]` = `{ type: "slider", name: "drive", animation: "scale", bone: "slider_bone", property: "x", scale: 0.005, local: true }`; `animations.slide` translates `slider_bone.x` 0→200 over 0→1 s; `animations.scale` scales `slider_bone` 1→4× over 0→1 s; region is a 10×10 `square` on a slot bound to `slider_bone`. The closed form must account for slider-drives-animation-*time* semantics (source bone property × `scale` → playback time into the referenced animation), NOT a direct sliderValue→bone-X map.
- The triangulation target (D-05): hand-derived literal ≡ editor `NOTES.txt` value ≡ sampled `globalPeaks` peak, all within the codebase's standard closed-form tolerance.
- PERF-01 deliverable framing: the budget test is the artifact; the narrative "4.3 = N ms = K× the 4.2 606 ms" goes in the PROJECT.md phase-close footer.

</specifics>

<deferred>
## Deferred Ideas

- **Re-exporting SLIDER-01 to the §3-exact idealized shape** — only triggered by D-06's escape hatch (researcher finds the closed form non-derivable). Not the default; not its own phase.
- **Exposing the slider as a user-facing animator control** — explicitly out of scope per `.planning/REQUIREMENTS.md` ("Slider is sampled for peak-scale only, not exposed as an animator control"). Not a Phase 46 concern.
- **A general 4.3 perf regression harness across all 4.3 fixtures** — Phase 46 needs ONE complex rig + ONE budget gate. A broader perf matrix is a future-milestone idea, not in v1.6 scope.

None of the above were scope-creep redirects from the user — they are boundary clarifications captured so they aren't relitigated.

</deferred>

---

*Phase: 46-slider-constraint-validation-4-3-performance-budget*
*Context gathered: 2026-05-18*
