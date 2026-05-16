/**
 * Phase 42 Plan 01 — SAFE-01 Task 2: fixture auto-discovery (D-08).
 *
 * Pure-Node TEST utility. Lives in `tests/safe01/`, NEVER `src/core/`. The
 * ONLY `src/core` imports are the PUBLIC entrypoints `loadSkeleton` /
 * `sampleSkeleton` (explicitly allowed by the plan — they ARE the "samples OK"
 * predicate). No `sharp`, no `electron`.
 *
 * D-08: baseline EVERY in-repo fixture that today produces a successful
 * `SamplerOutput` through the unchanged 4.2.111 runtime — AUTO-DISCOVERED, not
 * a hand-maintained list. Version-reject fixtures (SPINE_3_8_TEST,
 * SPINE_4_3_TEST) throw `SpineVersionUnsupportedError` at `loadSkeleton` →
 * NATURALLY excluded by the predicate (no hand-list — RESEARCH §Fixture
 * Auto-Discovery). Excluded fixtures record their reason (NOT silently dropped).
 *
 * D-08-R Option A (two-tier): a fixture is git-tracked iff `git ls-files
 * <fixture>` is non-empty. Only the git-tracked, redistributable subset is
 * committed + enumerated (fresh-clone CI is deterministic + green on exactly
 * this set). Gitignored heavy rigs are still discovered + baseled LOCALLY but
 * their baseline files are themselves gitignored (Task 2 capture / .gitignore).
 */
import { globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import type { SamplerOutput } from '../../src/core/sampler.js';

export interface DiscoveredFixture {
  /** POSIX-normalized fixture path, e.g. `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. */
  fixture: string;
  output: SamplerOutput;
  /** True iff `git ls-files <fixture>` is non-empty (redistributable subset). */
  gitTracked: boolean;
}

export interface ExcludedFixture {
  fixture: string;
  /** Human-reviewable reason — e.g. the SpineVersionUnsupportedError message. */
  reason: string;
}

export interface DiscoveryResult {
  included: DiscoveredFixture[];
  excluded: ExcludedFixture[];
}

/**
 * `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` →
 * `SIMPLE_PROJECT__SIMPLE_TEST.json` — the flat per-fixture baseline filename.
 * Strips the leading `fixtures/`, drops `.json`, joins path segments with `__`.
 */
export function baselineFileName(fixture: string): string {
  const noPrefix = fixture.replace(/^fixtures\//, '').replace(/\.json$/, '');
  return noPrefix.split('/').join('__') + '.json';
}

/** `git ls-files <fixture>` non-empty ⇒ the fixture is committed/redistributable. */
function isGitTracked(fixture: string): boolean {
  try {
    const out = execFileSync('git', ['ls-files', '--', fixture], {
      encoding: 'utf8',
    }).trim();
    return out.length > 0;
  } catch {
    // git unavailable / not a repo — be conservative: treat as NOT tracked so
    // the committed manifest never accidentally grows from an ambiguous probe.
    return false;
  }
}

/**
 * Walk `fixtures/**\/*.json`; run the "samples OK" predicate per file
 * (`loadSkeleton` then `sampleSkeleton` at the default 120 Hz). Success →
 * included (+ canonical-able SamplerOutput + git-tracked flag). Throw (e.g.
 * version-reject fixtures) → excluded with the reason string recorded.
 *
 * Deterministic ordering: results are sorted by fixture path so the manifest
 * + capture are stable run-to-run.
 */
export function discover(): DiscoveryResult {
  const files = globSync('fixtures/**/*.json')
    .map((f) => f.replace(/\\/g, '/'))
    .sort();

  const included: DiscoveredFixture[] = [];
  const excluded: ExcludedFixture[] = [];

  for (const fixture of files) {
    try {
      const load = loadSkeleton(fixture);
      const output = sampleSkeleton(load); // default 120 Hz (CLAUDE.md Fact #6)
      included.push({ fixture, output, gitTracked: isGitTracked(fixture) });
    } catch (err) {
      const reason =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      excluded.push({ fixture, reason });
    }
  }

  return { included, excluded };
}
