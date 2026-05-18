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
/**
 * D-04 (Phase 44, LOCKED — direct extension of Phase-43 D-05): the v1.6 4.3
 * fixtures + the postdates-pre-v1.6-freeze 4.2 sibling `skeleton2_42.*` have NO
 * pre-v1.6 SAFE-01 baseline to byte-compare against. They are EXCLUDED from
 * BOTH the frozen-set enumeration (D-08) and the SAFE-02 byte-equal gate (D-09)
 * — auto-including them would FALSELY trip the frozen-set enumeration /
 * SAFE-02 gate (they sample fine through 4.2/4.3 but have no committed golden
 * by design; the 4.3 own-baseline lives SEPARATELY in tests/runtime43/baselines/,
 * NOT golden-shared with SAFE-01). The exclusion is locked; the MECHANISM
 * (path-prefix denylist) is Claude's-Discretion (the PATTERNS-recommended one).
 *
 * Pre-Plan-02 the loader still hard-picks 4.2 + checkSpine43Schema rejects
 * top-level constraints[], so the 4.3-leg / SLIDER / XTRA rigs are currently
 * NATURALLY excluded by the existing rejecter; only skeleton2_42.json (token
 * 4.2, no contradiction) actually reaches sampling and would break the gate.
 * The denylist is the durable fix and is CO-REQUIRED before the Plan-02
 * dispatch flip (which makes the 4.3 rigs route-and-sample → they would then
 * also leak into enumeration without this).
 */
const SAFE01_EXCLUDED_PREFIXES = [
  'fixtures/SIMPLE_PROJECT_43/', // D-04: 4.3 leg + postdates-freeze 4.2 sibling skeleton2_42.*
  'fixtures/SLIDER_4_3/', // D-04: owner 4.3 slider rig (Phase 44 existence; Phase 46 oracle)
  'fixtures/XTRA01_4_3/', // D-04: owner 4.3 multi-map TransformConstraint rig
  'fixtures/XTRA02_4_3/', // D-04: owner 4.3 IK scaleYMode rig
] as const;

export function discover(): DiscoveryResult {
  const files = globSync('fixtures/**/*.json')
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => !SAFE01_EXCLUDED_PREFIXES.some((p) => f.startsWith(p)))
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
