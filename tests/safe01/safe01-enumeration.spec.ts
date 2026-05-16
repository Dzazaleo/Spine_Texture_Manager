/**
 * Phase 42 Plan 01 — SAFE-01 Task 2: D-08 dropout-is-failure enumeration gate.
 *
 * Re-runs auto-discovery and asserts the sorted git-tracked included set
 * deep-equals the committed `_manifest.json` `fixtures` array (sorted).
 *
 *  - A previously-sampling fixture that STARTS THROWING (a silent regression!)
 *    drops out of `discovered` → the set diverges → THIS TEST FAILS LOUDLY.
 *  - A NEW sampling fixture appears in `discovered` but not the manifest →
 *    fails until its baseline + manifest entry are added by a deliberate,
 *    reviewed commit (the ONLY sanctioned baseline-addition path; pre-existing
 *    baselines stay frozen — D-08 + D-09).
 *
 * Covers ONLY the git-tracked redistributable subset (D-08-R Option A);
 * heavy/gitignored rigs are intentionally NOT in the committed manifest.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { discover } from './discover-fixtures.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.resolve(REPO_ROOT, 'tests/safe01/baselines/_manifest.json');

describe('SAFE-01 enumeration: discovered git-tracked set == committed manifest (dropout-is-failure, D-08)', () => {
  it('the sorted git-tracked sampling set deep-equals _manifest.json fixtures', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
      _meta: Record<string, unknown>;
      fixtures: string[];
    };
    const committed = [...manifest.fixtures].sort();

    const { included } = discover();
    const discovered = included
      .filter((d) => d.gitTracked)
      .map((d) => d.fixture)
      .sort();

    expect(
      discovered,
      'SAFE-01 enumeration drift: the set of git-tracked fixtures that sample ' +
        'through 4.2.111 no longer matches the committed manifest. A DROPOUT ' +
        '(a fixture that stopped sampling) is a SILENT-REGRESSION FAILURE. A ' +
        'NEW sampling fixture must be added via a deliberate reviewed commit ' +
        '(baseline + manifest entry) — pre-existing baselines stay frozen (D-08/D-09).',
    ).toEqual(committed);
  });

  it('the manifest carries a _meta provenance block (generatedCommit + generatedAt)', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
      _meta: Record<string, unknown>;
    };
    expect(manifest._meta).toBeDefined();
    expect(manifest._meta.generatedCommit).toBeTypeOf('string');
    expect(manifest._meta.generatedAt).toBeTypeOf('string');
    expect(manifest._meta.spineCoreVersion).toBe('4.2.111');
  });
});
