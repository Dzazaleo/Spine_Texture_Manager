/**
 * v1.6 milestone phase marker. Bumped by the roadmapper/owner as the milestone
 * advances (42 -> 43 -> 44 ...). The Phase-44 owner-fixture-absence guard
 * (D-13, tests/safe01/phase44-fixture-guard.spec.ts) reads this constant:
 * while CURRENT_PHASE < 44 the guard is skip-with-reason (the owner exports
 * the ORCL-01 / SLIDER-01 4.3 fixtures in parallel, off the critical path);
 * at CURRENT_PHASE >= 44 it HARD-FAILS if those owner fixtures are still
 * absent -- so the owner blocker cannot silently slip past its scheduled
 * Phase-44 boundary.
 *
 * Q2 RESOLVED (42-RESEARCH.md Open Questions Q2 / Assumptions A4;
 * 42-REPLAN-NOTE.md v2): a COMMITTED CONSTANT, deliberately NOT a parse of
 * the milestone-state tracking file's "Phase: N" line. The committed-constant
 * mechanism is robust + explicit and carries zero tracking-file format-drift
 * risk (feedback_explicit_identity_over_inference in spirit: thread the phase
 * explicitly, never infer it from a brittle parse).
 *
 * Pure TS constant, no imports -- in tsconfig.node.json include
 * (tests glob) so it is type-checked by `npm run typecheck:node`.
 * ASCII-only by design (tsc 6.x parser desyncs on multibyte comment glyphs --
 * see 42-03 Deviation 1).
 */
export const CURRENT_PHASE = 42 as const;
