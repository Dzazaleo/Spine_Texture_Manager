/**
 * Phase 47 Plan 04 — T-C: the DV-RISK-1 4.2-alias parse standing guard.
 *
 * The proven Phase-47 design gap (debug `viewer-43-42-constraint-parse`):
 * spine-player@4.3.0's bundled spine-core@4.3.0 categorically CANNOT parse ANY
 * Spine 4.2 constraint-bearing JSON — 4.3 unified `root.constraints[]` vs 4.2's
 * separate `root.ik` / `root.transform` / `root.path` / `root.physics`. DV-1's
 * fix is the `spine-player-42` npm alias whose bare core resolves to 4.2.111
 * (which DOES understand the 4.2 split-array schema).
 *
 * This spec is the permanent DV-RISK-1 standing guard. For EACH of the 4 DV-3
 * 4.2-leg constraint-mix fixtures it asserts the categorical split:
 *
 *   - via `require('spine-player-42')`'s bare core (the alias-isolated 4.2.111
 *     SkeletonJson + a real sibling AtlasAttachmentLoader): parses CLEAN
 *     (constraints registered; no `<X> constraint not found` throw).
 *   - via canonical `@esotericsoftware/spine-core@4.3.0`: THROWS (the 4.2-vs-4.3
 *     schema gap is real → the alias is precisely what closes it).
 *
 * The 4 fixtures span the full constraint-mix variety that exposed the gap:
 *   SIMPLE_TEST     — path constraint (the GL straight-alpha canary)
 *   CHJWC_SYMBOLS   — transform-only
 *   TQORW_SYMBOLS   — ik + transform + events
 *   TEST_03         — ik + transform + PHYSICS (the most 4.2/4.3-divergent)
 *
 * Headless (node env — CLAUDE.md Fact #5): pure SkeletonJson parse, no
 * DOM/WebGL. Analog: tests/runtime43/runtime43-d03.spec.ts (parse-a-real-
 * fixture-through-a-specific-runtime) + tests/runtime/d13-43-load-smoke.spec.ts
 * (TextureAtlas + AtlasAttachmentLoader + SkeletonJson direct-parse idiom).
 * 47-RESEARCH §1d proved exactly this categorical split for SIMPLE_TEST; this
 * spec generalizes it to all 4 DV-3 fixtures as a permanent regression lock.
 *
 * BOTH-SPECIFIER CO-IMPORT IS ON PURPOSE (the sanctioned tests/ idiom — see
 * tests/runtime/runtime-distinctness.spec.ts header): this file imports BOTH
 * `spine-player-42` (the alias-isolated 4.2.111 player whose bare core is the
 * DV-1 4.2 leg) AND canonical `@esotericsoftware/spine-core` (the 4.3.0 leg) —
 * it is the DV-RISK-1 distinctness/parse probe, NOT a repoint target.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
// The alias-isolated 4.2.111 player; its bare `@esotericsoftware/spine-core`
// import resolves to the NESTED 4.2.111 core (DV-1; verified 47-RESEARCH §1).
import * as sp42 from 'spine-player-42';
// Canonical 4.3.0 core (the 4.3 leg — categorically cannot parse 4.2
// split-array constraint JSON; that is the proven gap).
import * as sc43 from '@esotericsoftware/spine-core';

const REPO_ROOT = resolve(__dirname, '..', '..');

interface Dv3Fixture {
  name: string;
  /** path WITHOUT extension — `.json` + `.atlas` siblings both read */
  base: string;
  constraintMix: string;
}

// The DV-3 4.2-leg matrix (CONTEXT DV-3). All `spine:"4.2.43"`, all in-repo,
// all owner-confirmed broken under the single-runtime 4.3-only viewer.
const DV3_FIXTURES: Dv3Fixture[] = [
  {
    name: 'SIMPLE_TEST',
    base: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST',
    constraintMix: 'path constraint (GL straight-alpha canary)',
  },
  {
    name: 'CHJWC_SYMBOLS',
    base: 'fixtures/CHJ/CHJWC_SYMBOLS',
    constraintMix: 'transform-only',
  },
  {
    name: 'TQORW_SYMBOLS',
    base: 'fixtures/3Queens/TQORW_SYMBOLS',
    constraintMix: 'ik + transform + events',
  },
  {
    name: 'TEST_03',
    base: 'fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03',
    constraintMix: 'ik + transform + physics (most 4.2/4.3-divergent)',
  },
];

function readFixture(base: string): { json: unknown; atlasText: string } {
  return {
    json: JSON.parse(readFileSync(resolve(REPO_ROOT, base + '.json'), 'utf8')),
    atlasText: readFileSync(resolve(REPO_ROOT, base + '.atlas'), 'utf8'),
  };
}

// Fixture-presence partition. CHJWC_SYMBOLS / TQORW_SYMBOLS / TEST_03 are real
// client Spine projects deliberately gitignored — present on a maintainer's
// machine, ABSENT on a clean CI clone. SIMPLE_TEST is the committed in-repo
// golden and is always present, so the DV-RISK-1 split is STILL guarded on CI
// for that fixture; the client rigs run the guard locally and self-skip on CI
// (visible as skipped, not silently dropped). User-chosen 2026-05-19 over
// publishing client art to a public repo. See memory
// feedback_gitignore_fixtures_check_test_refs.
const fixturePresent = (base: string): boolean =>
  existsSync(resolve(REPO_ROOT, base + '.json')) &&
  existsSync(resolve(REPO_ROOT, base + '.atlas'));
const PRESENT_FIXTURES = DV3_FIXTURES.filter((f) => fixturePresent(f.base));
const ABSENT_FIXTURES = DV3_FIXTURES.filter((f) => !fixturePresent(f.base));

describe('Phase 47 T-C: DV-3 4.2 constraint-mix fixtures — clean via spine-player-42, throw via canonical 4.3 (DV-RISK-1 standing guard)', () => {
  it.each(PRESENT_FIXTURES)(
    '$name ($constraintMix): parses CLEAN through spine-player-42 bare core',
    ({ base }) => {
      const { json, atlasText } = readFixture(base);
      // The SkeletonJson reached via the ALIASED spine-player-42 (its bare
      // `@esotericsoftware/spine-core` import → nested 4.2.111 core).
      const atlas = new sp42.TextureAtlas(atlasText);
      const skeletonJson = new sp42.SkeletonJson(new sp42.AtlasAttachmentLoader(atlas));

      let skeletonData: { animations?: unknown[] } | undefined;
      expect(
        () => {
          skeletonData = skeletonJson.readSkeletonData(json) as { animations?: unknown[] };
        },
        'the alias-isolated 4.2.111 core MUST parse the 4.2 split-array ' +
          'constraint schema clean — a throw here means the DV-1 alias ' +
          'split-brain collapsed (DV-RISK-1 regression)',
      ).not.toThrow();

      expect(skeletonData, 'spine-player-42 produced a SkeletonData').toBeTruthy();
      expect(
        Array.isArray(skeletonData?.animations),
        'the 4.2 rig animations were consumed (constraints registered, ' +
          'not a degenerate empty parse)',
      ).toBe(true);
      expect(
        (skeletonData?.animations ?? []).length,
        'the constraint-bearing 4.2 rig has at least one animation',
      ).toBeGreaterThan(0);
    },
  );

  it.each(PRESENT_FIXTURES)(
    '$name ($constraintMix): THROWS through canonical @esotericsoftware/spine-core@4.3.0 (the gap is real)',
    ({ base }) => {
      const { json, atlasText } = readFixture(base);
      // The SAME fixture through the CANONICAL 4.3.0 core. The 4.3
      // SkeletonJson expects unified `root.constraints[]`; a 4.2 fixture's
      // separate `root.ik`/`root.transform`/`root.path`/`root.physics` arrays
      // leave the constraints unregistered → an `<X> constraint not found`
      // (or sibling schema) throw. This is the categorical gap DV-1 closes.
      const atlas = new sc43.TextureAtlas(atlasText);
      const skeletonJson = new sc43.SkeletonJson(new sc43.AtlasAttachmentLoader(atlas));

      expect(
        () => skeletonJson.readSkeletonData(json as Parameters<typeof skeletonJson.readSkeletonData>[0]),
        'canonical spine-core@4.3.0 MUST throw on a 4.2 split-array ' +
          'constraint fixture — if it ever parses clean the proven gap has ' +
          'changed and the DV-1 dual-runtime premise must be re-validated',
      ).toThrow();
    },
  );

  // Absent (gitignored client rig, not on CI) — emitted as explicit skips so
  // the report shows them rather than silently dropping coverage. Empty (no
  // registration) on a maintainer machine where all fixtures are present.
  it.skip.each(ABSENT_FIXTURES)(
    '$name ($constraintMix): SKIPPED — gitignored client fixture absent (runs locally only)',
    () => {
      /* fixture not in repo; guarded locally where present */
    },
  );

  it('the alias and canonical cores are genuinely distinct versions (4.2.111 vs 4.3.0)', () => {
    // Belt-and-suspenders: confirm the two SkeletonJson classes above came
    // from two distinct module instances (a hoist that deduped them would
    // make the clean/throw split meaningless).
    expect(sp42.SkeletonJson).toBeTypeOf('function');
    expect(sc43.SkeletonJson).toBeTypeOf('function');
    expect(sp42.SkeletonJson).not.toBe(sc43.SkeletonJson);
    // 4.3-only Slider/BonePose absent from the aliased 4.2.111 surface.
    expect((sp42 as unknown as Record<string, unknown>).Slider).toBeUndefined();
    expect(
      typeof (sc43 as unknown as Record<string, unknown>).Slider,
    ).not.toBe('undefined');
  });
});
