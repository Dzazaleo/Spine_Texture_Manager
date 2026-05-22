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
 * The 4 D-04-NAMED dirs below were applied one plan early as a Plan-01
 * Rule-3 deviation (committing skeleton2_42.json — token 4.2, no
 * contradiction — made it git-tracked and it reached sampling, leaking into
 * the frozen SAFE-01 enumeration). Plan 02's dispatch flip
 * (loader.ts resolveRuntimeTag) now makes the loader ROUTE-AND-SAMPLE every
 * 4.3 JSON instead of rejecting it — which mechanically removes the implicit
 * reject-as-exclusion that, until the flip, hid TWO MORE 4.3-routing dirs
 * from auto-discovery (Open-Q1, RESEARCH Pattern 4 — the subtlest correctness
 * point in the phase). Those two are CO-REQUIRED additions to the denylist
 * AT THE SAME PLAN as the flip:
 *   - the SPINE_4_3_TEST rig : GIT-TRACKED Phase-32 canary, spine
 *     "4.3.91-beta" + top-level constraints[] → routes post-flip → would
 *     enter safe01-baseline's gitTracked arm with NO committed baseline →
 *     HARD throw (safe01-baseline.spec.ts:62-66) + a +1 in safe01-enumeration.
 *   - the test_4.3 rig : gitignored Phase-32 canary, spine "4.3.88-beta" +
 *     top-level constraints[] → discover() globs fixtures/**\/*.json
 *     regardless of gitignore, then iterates the non-tracked `heavy` arm
 *     (safe01-baseline.spec.ts:83) → leaks into safe01-enumeration. Must be
 *     removed from discover() ENTIRELY, not merely gitignored.
 * The SPINE_3_8_TEST rig is deliberately NOT denylisted — spine "3.8.99"
 * is a <4.2 reject that STAYS a natural exclusion post-flip (the loader still
 * throws on it); denylisting it would mask a real regression.
 *
 * Scope = EVERY 4.3-routing fixture dir NOT in the frozen
 * tests/safe01/baselines/_manifest.json (verified via git ls-files +
 * _manifest.json at plan time, Open-Q1). The verification canary is
 * safe01-enumeration + safe01-baseline staying GREEN AFTER the dispatch flip.
 */
const SAFE01_EXCLUDED_PREFIXES = [
  'fixtures/SIMPLE_PROJECT_43/', // D-04: 4.3 leg + postdates-freeze 4.2 sibling skeleton2_42.*
  'fixtures/SLIDER_4_3/', // D-04: owner 4.3 slider rig (Phase 44 existence; Phase 46 oracle)
  'fixtures/XTRA01_4_3/', // D-04: owner 4.3 multi-map TransformConstraint rig
  'fixtures/XTRA02_4_3/', // D-04: owner 4.3 IK scaleYMode rig
  'fixtures/SPINE_4_3_TEST/', // D-04 Plan-02 co-required: git-tracked 4.3.91-beta canary — routes post-flip; breaks safe01-baseline gitTracked arm
  'fixtures/test_4.3/', // D-04 Plan-02 co-required: gitignored 4.3.88-beta canary — globbed regardless; breaks safe01-baseline non-tracked `heavy` arm
  // D-04 Phase-46-02 extension (same locked doctrine: EVERY 4.3-routing
  // fixture dir NOT in the frozen _manifest.json). 46-02 commits the
  // redistributable PERF-01 rig fixtures/spineboy_4.3/spineboy-pro.{json,
  // atlas,png} (spine 4.3.01, 67/52/11/14, top-level constraints[] → routes
  // 4.3 post-dispatch-flip) so the CI-enabled PERF-01 gate is functional on
  // CI. Being git-tracked + 4.3-routing, it leaks into safe01-enumeration
  // (+1 vs frozen manifest) and safe01-baseline's gitTracked arm (HARD throw:
  // no committed SAFE-01 golden — by design; its perf budget lives in
  // tests/main/sampler-worker-spineboy43.spec.ts, NOT golden-shared with
  // SAFE-01). Verified at execute time NOT in _manifest.json. Identical
  // class to the SIMPLE_PROJECT_43/SLIDER_4_3 entries above; mechanism is the
  // same PATTERNS-recommended path-prefix denylist.
  'fixtures/spineboy_4.3/', // D-04 (46-02): redistributable PERF-01 4.3 rig — git-tracked + 4.3-routing; excluded from frozen SAFE-01 set/byte-gate
  // D-04 Phase-48 extension (same locked doctrine: a NEWLY git-tracked fixture
  // dir NOT in the frozen _manifest.json has no committed SAFE-01 golden to
  // byte-compare against — auto-including it FALSELY trips the frozen-set
  // enumeration (+N) AND the safe01-baseline gitTracked arm (HARD throw: no
  // golden by design). 48-02 commits the SCALE_BAKE oracle-input matrix
  // (TEST_01/TEST_03 4.2 deform rigs, the DEMON 4.3 rig, and the synthetic 4.3
  // PATH_FIXED rig) as redistributable json+atlas-only inputs for the Phase-48
  // scale-bake regression oracle. Their protection is the 48-04 bake oracle
  // (parse(bake(orig,s),1) ≡ parse(orig,SkeletonJson.scale=s)), NOT the frozen
  // 4.2.111 SAFE-01 byte-gate; verified NOT in _manifest.json. Identical class
  // to the SIMPLE_PROJECT_43/spineboy_4.3 entries above (the doctrine's "no
  // committed golden" root applies to 4.2-routing dirs too, line 84-89);
  // mechanism is the same PATTERNS-recommended path-prefix denylist.
  'fixtures/SCALE_BAKE_4_2/', // D-04 (48): scale-bake oracle 4.2 deform-rig inputs (TEST_01, TEST_03)
  'fixtures/SCALE_BAKE_4_3/', // D-04 (48): scale-bake oracle 4.3 rig input (DEMON SKINS_SPINE_V02)
  'fixtures/SCALE_BAKE_PATH_43/', // D-04 (48): synthetic 4.3 PathConstraint Fixed-mode oracle input (D-05)
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
