/**
 * Phase 42 Plan 04 -- D-13: the Phase-44 owner-fixture-absence guard.
 *
 * The owner must export 5 artifacts (4 rigs) from the Spine editor for the
 * Phase 44 dual-runtime oracle + the Phase 46 slider closed-form oracle
 * (see 42-OWNER-EXPORT-SPEC.md). That export is a HUMAN blocker. To keep it
 * OFF the critical path it runs in parallel the moment Phase 42 lands -- but
 * it MUST be done before the milestone reaches Phase 44, or Phase 44 has no
 * oracle ground truth. This guard makes that boundary machine-enforced:
 *
 *   - while CURRENT_PHASE < 44 (i.e. Phase 42 / 43): the test is
 *     it.skipIf-skipped WITH a recorded reason. The owner export is
 *     vacuously satisfied -- it is off the critical path by design (D-01).
 *   - once the roadmapper bumps CURRENT_PHASE to 44 in
 *     tests/safe01/phase-gate.ts: this test flips to a HARD FAILURE if
 *     the owner ORCL-01 / SLIDER-01 4.3 fixture directories are still
 *     absent -- the owner blocker can no longer silently slip past Phase 44.
 *
 * Q2 RESOLVED: the phase marker is the COMMITTED CURRENT_PHASE constant,
 * NOT a parse of the milestone-state tracking file (no tracking-file
 * format-drift risk -- the rejected brittle approach; 42-RESEARCH.md Q2/A4,
 * 42-REPLAN-NOTE.md v2).
 *
 * Owner-fixture directory names are LOCKED here (and mirrored verbatim in
 * 42-OWNER-EXPORT-SPEC.md so the owner exports into EXACTLY these dirs).
 * They MUST NOT collide with the existing Phase-32 4.3-reject canary
 * fixtures (the v1.4 version-reject fixtures -- reusing one as the oracle
 * rig would be wrong):
 *   - ORCL-01  -> fixtures/SIMPLE_PROJECT_43/  (SIMPLE_PROJECT-style sibling;
 *                  holds BOTH the 4.3 AND the 4.2 ORCL-01 export -- D-02/D-03;
 *                  distinct from the existing fixtures/SIMPLE_PROJECT/)
 *   - SLIDER-01 -> fixtures/SLIDER_4_3/        (the 4.3 slider rig -- D-13)
 *
 * ASCII-only by design (tsc 6.x parser desyncs on multibyte comment glyphs --
 * see 42-03 Deviation 1).
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_PHASE } from './phase-gate.js';

const REPO_ROOT = resolve(__dirname, '..', '..');

// LOCKED owner-fixture dirs (mirrored in 42-OWNER-EXPORT-SPEC.md). Non-
// colliding with the Phase-32 4.3-reject canary fixtures.
const ORCL_01_DIR = resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43');
const SLIDER_01_DIR = resolve(REPO_ROOT, 'fixtures/SLIDER_4_3');

describe('Phase 44 owner-fixture-absence guard (D-13 -- the owner blocker cannot silently slip past Phase 44)', () => {
  // While CURRENT_PHASE < 44 (Phase 42/43) this skips with the reason
  // recorded: the owner exports ORCL-01 + SLIDER-01 in parallel, off the
  // critical path (D-01). When the roadmapper bumps CURRENT_PHASE to 44 in
  // tests/safe01/phase-gate.ts it flips to a hard failure if the dirs are
  // still absent.
  it.skipIf(CURRENT_PHASE < 44)(
    'Phase 44+: owner ORCL-01 + SLIDER-01 4.3 fixtures MUST exist (D-13 -- owner blocker cannot slip past Phase 44)',
    () => {
      expect(
        existsSync(ORCL_01_DIR),
        'ORCL-01 4.3 oracle rig missing -- owner export overdue (fixtures/SIMPLE_PROJECT_43/; see 42-OWNER-EXPORT-SPEC.md)',
      ).toBe(true);
      expect(
        existsSync(SLIDER_01_DIR),
        'SLIDER-01 4.3 rig missing -- owner export overdue (fixtures/SLIDER_4_3/; see 42-OWNER-EXPORT-SPEC.md)',
      ).toBe(true);
    },
  );
});
