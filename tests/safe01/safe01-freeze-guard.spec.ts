/**
 * Phase 42 Plan 01 — SAFE-01 Task 3: the D-09 freeze guard.
 *
 * THIS is the machine-checked acceptance test for the whole phase:
 * "order is the acceptance test". It makes the baseline-predates-alias
 * invariant enforced by Git's own commit history, not reviewer memory.
 *
 * Part of COMMIT A. At commit time the npm alias does NOT exist yet (it is
 * introduced in Plan 02 / COMMIT B, a later wave), so:
 *   - Assertion 1 (git-ancestry): SKIPS-WITH-REASON — the pickaxe for
 *     `spine-core-42` in package.json returns empty → ancestry is VACUOUSLY
 *     satisfied (the arch.spec.ts:205-216 ENOENT-tolerant precedent applied to
 *     git history). It FLIPS to a hard ancestry assertion automatically, with
 *     NO edit, the instant Plan 02 introduces the `spine-core-42` literal.
 *   - Assertion 2 (no-regen meta-test): asserts HARD now — there is no
 *     environment-gated regen branch in safe01-baseline.spec.ts.
 *
 * Plain-English (project owner is a git beginner): this is the part of the
 * build that automatically checks the "before" photograph (the 4.2 baseline)
 * was taken BEFORE we started renovating (added the new 4.3 engine). It does
 * this by reading Git's own record of which commit came first — no human has
 * to remember the order.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_REL = 'tests/safe01/baselines/_manifest.json';

/** Run a git command, trimmed stdout. Throws on non-zero exit. */
const sh = (args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();

describe('SAFE-01 freeze guard (D-09 — "order is the acceptance test")', () => {
  it('the baseline commit is a git ancestor of the npm-alias commit', () => {
    // CR-01 presence guard: if the alias literal is gone, the gate cannot be
    // evaluated — fail LOUDLY (mirrors the ci.yml D-09 grep-presence guard)
    // rather than vacuously pass against a removed dependency.
    const pkgJsonText = readFileSync(
      path.resolve(REPO_ROOT, 'package.json'),
      'utf8',
    );
    if (!pkgJsonText.includes('spine-core-42')) {
      throw new Error(
        'D-09: spine-core-42 alias no longer present in package.json — the SAFE-01 ' +
          'ordering gate cannot be evaluated (a removed alias must fail loudly, not ' +
          'vacuously pass).',
      );
    }

    // OLDEST add (tail/.pop()) of the manifest — the original introduction,
    // robust against a later delete+re-add.
    const baselineCommit = sh([
      'log',
      '--diff-filter=A',
      '--format=%H',
      '--',
      MANIFEST_REL,
    ])
      .split('\n')
      .filter(Boolean)
      .pop();

    // The npm-alias-introducing commit: the commit that ADDED the literal
    // `spine-core-42` alias key to package.json. Pickaxe (-S) on the chosen
    // unique literal — robust to later edits; do NOT match package-lock.json
    // (lockfile churn is noisier).
    //
    // CR-01: the OLDEST pickaxe hit = the introducing commit, taken EXPLICITLY
    // via `--reverse` + first element ([0]) — NOT `.pop()` of an
    // unordered-intent `-S` set (`-S` lists every add/remove/re-add; `.pop()`
    // is the oldest only while the literal is added exactly once and never
    // churned — CR-01 forward-fragility).
    const aliasLog = sh([
      'log',
      '--reverse',
      '-S',
      'spine-core-42',
      '--format=%H',
      '--',
      'package.json',
    ]);
    const aliasCommit = aliasLog.split('\n').filter(Boolean)[0];

    if (!aliasCommit) {
      // The alias is introduced in Plan 02 / COMMIT B, AFTER this baseline
      // (COMMIT A). Until then the pickaxe returns empty → ancestry is
      // VACUOUSLY satisfied. Skip-with-reason (the arch.spec.ts ENOENT-tolerant
      // precedent applied to git history), NOT fail. Flips to a hard assert
      // automatically once RT-01 lands the alias — no edit to this file.
      return;
    }

    if (!baselineCommit) {
      throw new Error(
        'SAFE-01 manifest has no introducing commit — baseline not committed?',
      );
    }

    // execFileSync throws on non-zero exit → an ancestry violation throws →
    // this expectation fails. exit 0 = baselineCommit IS an ancestor of (i.e.
    // predates) aliasCommit. This is the exact topological primitive — NOT a
    // timestamp comparison (timestamps are non-monotonic across rebases).
    // `git merge-base --is-ancestor <baseline> <alias>` — kept on ONE line so
    // the D-09 acceptance grep (`merge-base.*--is-ancestor`) machine-verifies
    // this exact topological primitive is present.
    // prettier-ignore
    expect(() =>
      execFileSync('git', ['merge-base', '--is-ancestor', baselineCommit, aliasCommit]),
    ).not.toThrow();

    // Secondary tamper cross-check: the manifest's recorded
    // `_meta.generatedCommit` must equal OR be an ancestor of the
    // introducing commit. If someone regenerated the baseline CONTENT without
    // a fresh commit, the recorded SHA and the introducing-commit SHA diverge
    // in a way that is NOT an ancestor relationship — a tamper signal.
    const manifest = JSON.parse(
      readFileSync(path.resolve(REPO_ROOT, MANIFEST_REL), 'utf8'),
    ) as { _meta: { generatedCommit?: string } };
    const recorded = manifest._meta.generatedCommit;
    if (recorded && recorded !== baselineCommit) {
      // prettier-ignore
      expect(
        () => execFileSync('git', ['merge-base', '--is-ancestor', recorded, baselineCommit]),
        `SAFE-01 tamper signal: _manifest._meta.generatedCommit (${recorded}) ` +
          `is neither the introducing commit (${baselineCommit}) nor an ` +
          `ancestor of it — the baseline content may have been regenerated ` +
          `without a fresh commit.`,
      ).not.toThrow();
    }
  });

  it('there is NO env-gated regen branch in the baseline spec (D-09)', () => {
    const src = readFileSync(
      path.resolve(__dirname, 'safe01-baseline.spec.ts'),
      'utf8',
    );
    expect(
      src,
      'SAFE-01 baseline spec must not contain an env-gated regen path (D-09 — ' +
        'regenerating SAFE-01 requires deliberately deleting this freeze guard, ' +
        'which is loud and reviewable; there is no environment-variable shortcut).',
    ).not.toMatch(/UPDATE_FIXTURES|process\.env|SHOULD_UPDATE/);
  });
});
