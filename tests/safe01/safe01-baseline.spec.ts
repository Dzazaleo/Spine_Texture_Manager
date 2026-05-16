/**
 * Phase 42 Plan 01 — SAFE-01 Task 2: the byte-equal 4.2 regression gate.
 *
 * COMMIT A. For every git-tracked fixture that samples through the UNCHANGED
 * spine-core 4.2.111 runtime, assert the live canonical `SamplerOutput` is
 * STRICTLY EQUAL to its committed per-fixture baseline JSON (D-06 full output:
 * globalPeaks + perAnimation + setupPosePeaks; D-07 full-JSON, NOT a digest —
 * a tripped gate must show in `git diff` EXACTLY which
 * `${skin}/${slot}/${attachment}` record drifted and by how much).
 *
 * CRITICAL — D-09 NO REGEN BRANCH: there is deliberately NO environment-gated
 * baseline-write path anywhere in this file (unlike the repack precedent's
 * env-gated refresh branch). The freeze-guard meta-test
 * (safe01-freeze-guard.spec.ts) greps THIS file's source for any such
 * environment-variable regen token and asserts it absent — so this docstring
 * itself must avoid those literal tokens (the guard checks source, not intent).
 * Regenerating SAFE-01 requires a deliberate, reviewed commit that deletes the
 * freeze guard — there is no environment-variable shortcut.
 *
 * `_meta` is provenance, NOT frozen data: `_meta.generatedCommit` /
 * `generatedAt` differ per run by design, so the comparison excludes `_meta`
 * and asserts structural equality of the three maps only.
 *
 * D-08-R two-tier: git-tracked fixtures are asserted unconditionally (committed
 * baselines, fresh-clone-green). Any discovered NON-git-tracked heavy rig is
 * presence-guarded — asserted only if a (gitignored, local) baseline file
 * exists (the it.skipIf precedent from sampler-worker-girl.spec.ts:23-28).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { discover, baselineFileName } from './discover-fixtures.js';
import { canonicalize } from './canonical-json.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASE_DIR = path.resolve(REPO_ROOT, 'tests/safe01/baselines');

/** Strip the volatile provenance block — only the three maps are frozen. */
function frozenPart(parsed: Record<string, unknown>) {
  return {
    globalPeaks: parsed.globalPeaks,
    perAnimation: parsed.perAnimation,
    setupPosePeaks: parsed.setupPosePeaks,
  };
}

const { included } = discover();
const gitTracked = included
  .filter((d) => d.gitTracked)
  .sort((a, b) => a.fixture.localeCompare(b.fixture));
const heavy = included.filter((d) => !d.gitTracked);

describe('SAFE-01 baseline: live 4.2.111 SamplerOutput is byte-equal to the committed golden (COMMIT A)', () => {
  it('discovered at least one git-tracked sampling fixture', () => {
    expect(gitTracked.length).toBeGreaterThan(0);
  });

  for (const d of gitTracked) {
    it(`git-tracked: ${d.fixture} matches its committed canonical baseline`, () => {
      const file = path.join(BASE_DIR, baselineFileName(d.fixture));
      if (!existsSync(file)) {
        throw new Error(
          `SAFE-01 baseline missing for ${d.fixture}. This baseline is frozen ` +
            `(D-09); a new sampling fixture's baseline is added by a ` +
            `deliberate, reviewed commit — NOT a regen env var.`,
        );
      }
      const committed = JSON.parse(readFileSync(file, 'utf8')) as Record<
        string,
        unknown
      >;
      const live = JSON.parse(
        canonicalize(d.output, { fixture: d.fixture }),
      ) as Record<string, unknown>;
      // Strict full-structure equality of the frozen maps (NOT a digest —
      // D-07 diagnosability; _meta excluded as volatile provenance).
      expect(frozenPart(live)).toEqual(frozenPart(committed));
    });
  }

  // Heavy/gitignored rigs: present-locally → strict-compare against the
  // (gitignored) local baseline; absent → skip-with-reason (D-08-R).
  for (const d of heavy) {
    const file = path.join(BASE_DIR, baselineFileName(d.fixture));
    it.skipIf(!existsSync(file))(
      `heavy/local-only: ${d.fixture} matches its local (gitignored) baseline`,
      () => {
        const committed = JSON.parse(readFileSync(file, 'utf8')) as Record<
          string,
          unknown
        >;
        const live = JSON.parse(
          canonicalize(d.output, { fixture: d.fixture }),
        ) as Record<string, unknown>;
        expect(frozenPart(live)).toEqual(frozenPart(committed));
      },
    );
  }
});
