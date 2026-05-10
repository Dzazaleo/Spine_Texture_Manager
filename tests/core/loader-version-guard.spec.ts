/**
 * Phase 12 Plan 05 (D-21) — F3 Spine version guard.
 *
 * Task 3 RED → GREEN: fixture-driven loadSkeleton-rejection tests.
 *
 * Asserts that loading the new fixtures/SPINE_3_8_TEST/ rig (Spine 3.8.99
 * shape) throws SpineVersionUnsupportedError BEFORE atlas resolution fires
 * (Phase 12 / Plan 05 D-21 insertion site contract). Also asserts the 4.2
 * happy path is regression-free.
 *
 * Companion files:
 *   - tests/core/errors-version.spec.ts (Task 1) — class-shape unit tests.
 *   - tests/core/loader-version-guard-predicate.spec.ts (Task 2) — predicate
 *     unit tests across all seven decision cases.
 *   - This file (Task 3) — end-to-end fixture-driven assertions.
 *
 * On the 12-02 expanded CI matrix [ubuntu-latest, windows-2022, macos-14]
 * this locks down the cross-OS behavior of `JSON.parse` + `parseInt`
 * (trivially platform-stable but confirmed by matrix coverage).
 *
 * Phase 32 (COMPAT-01) extension — adds the 4.3-rejection describe block and
 * the SPINE_4_3_TEST fixture-existence sentinels. The 4.3 fixture exercises
 * BOTH detection signals (skeleton.spine semver >= 4.3 AND a top-level
 * `constraints` array) per CONTEXT D-06; the test asserts "rejection
 * happened" without disambiguating which predicate fired (predicate-isolation
 * is the job of tests/core/loader-version-guard-predicate.spec.ts +
 * tests/core/loader-43-schema-guard-predicate.spec.ts).
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  SpineLoaderError,
  SpineVersionUnsupportedError,
} from '../../src/core/errors.js';

const FIXTURE_38 = path.resolve('fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json');
const FIXTURE_42 = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_43 = path.resolve('fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json');

describe('F3: Spine version guard rejects pre-4.2 fixtures', () => {
  it('loadSkeleton rejects Spine 3.8.99 fixture with typed SpineVersionUnsupportedError', () => {
    expect(() => loadSkeleton(FIXTURE_38)).toThrow(SpineVersionUnsupportedError);
  });

  it("Rejection error carries detectedVersion === '3.8.99'", () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_38);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SpineVersionUnsupportedError);
    expect((caught as SpineVersionUnsupportedError).detectedVersion).toBe('3.8.99');
  });

  it("Rejection error message contains '3.8.99' AND 'Spine 4.2 or later' (CONTEXT D-21 wording)", () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_38);
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toContain('3.8.99');
    expect((caught as Error).message).toContain('Spine 4.2 or later');
    expect((caught as Error).message).toContain('Re-export');
  });

  it('Rejection error extends SpineLoaderError (catchable by the existing IPC forwarder)', () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_38);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SpineLoaderError);
    expect(caught).toBeInstanceOf(SpineVersionUnsupportedError);
  });

  it('Rejection error carries the skeletonPath argument the caller passed', () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_38);
    } catch (err) {
      caught = err;
    }
    expect((caught as SpineVersionUnsupportedError).skeletonPath).toBe(FIXTURE_38);
  });

  it("REGRESSION: Spine 4.2.x fixture (SIMPLE_PROJECT) still loads successfully", () => {
    // Belt-and-braces: the full 4.2 happy path is asserted in
    // tests/core/loader.spec.ts. This re-asserts that the version-guard
    // insert didn't break the 4.2 path — if it did, every other phase's
    // fixture-driven test would also fail, but the focused assertion
    // here makes the F3 regression explicit.
    expect(() => loadSkeleton(FIXTURE_42)).not.toThrow();
  });
});

describe('Phase 32 COMPAT-01: Spine version guard rejects 4.3 fixtures (semver + schema)', () => {
  it('loadSkeleton rejects Spine 4.3.91-beta fixture with typed SpineVersionUnsupportedError', () => {
    expect(() => loadSkeleton(FIXTURE_43)).toThrow(SpineVersionUnsupportedError);
  });

  it('Rejection error extends SpineLoaderError (catchable by the existing IPC forwarder)', () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SpineLoaderError);
    expect(caught).toBeInstanceOf(SpineVersionUnsupportedError);
  });

  it("Rejection error message contains the COMPAT-01-locked wording (REQUIREMENTS.md L13)", () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toContain('This app currently supports Spine v4.2');
    expect((caught as Error).message).toContain('Re-export from your 4.3 editor as Version 4.2');
    expect((caught as Error).message).toContain('supported downgrade');
    expect((caught as Error).message).toContain('try again');
  });

  it("Rejection error message does NOT contain the legacy pre-4.2 wording (the 4.3+ branch fired, not the pre-4.2 branch)", () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    // The pre-4.2 branch produces "Spine Texture Manager requires Spine 4.2 or later."
    // — must NOT leak into the 4.3+ branch.
    expect((caught as Error).message).not.toContain('Spine Texture Manager requires Spine 4.2 or later');
  });

  it('Rejection error carries the skeletonPath argument the caller passed', () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    expect((caught as SpineVersionUnsupportedError).skeletonPath).toBe(FIXTURE_43);
  });

  it('REGRESSION: Spine 4.2.x fixture (SIMPLE_PROJECT) still loads successfully (Plan 01 strict-cut + schema predicate are inert for 4.2)', () => {
    // Belt-and-braces: the 4.2 happy path is asserted at line 82-89 above for
    // the 3.8 describe-block. Re-asserting here ensures Plan 01's strict-cut at
    // 4.3+ + new schema predicate did NOT break the 4.2 path. The 4.2 fixture
    // has NO top-level `constraints` array, so checkSpine43Schema is inert.
    expect(() => loadSkeleton(FIXTURE_42)).not.toThrow();
  });
});

describe('F3: fixture file existence sentinels', () => {
  it('3.8 skeleton JSON fixture exists at the expected path', () => {
    expect(fs.existsSync(FIXTURE_38)).toBe(true);
  });

  it('3.8 atlas fixture exists alongside the JSON', () => {
    const atlas = path.resolve('fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.atlas');
    expect(fs.existsSync(atlas)).toBe(true);
  });

  it('At least one PNG file exists under fixtures/SPINE_3_8_TEST/', () => {
    // Assert SOMETHING resembling a packed atlas image is present so a
    // future atlas-resolution path (post-version-check) would have a
    // sentinel to pre-flight. The atlas-resolution path is unreachable
    // for this fixture today (version-guard fires first) but the
    // sentinels keep the fixture self-contained for future expansion.
    const dir = path.resolve('fixtures/SPINE_3_8_TEST');
    const entries = fs.readdirSync(dir, { recursive: true }) as string[];
    const hasPng = entries.some((e) => e.endsWith('.png'));
    expect(hasPng).toBe(true);
  });

  it("3.8 fixture's skeleton.spine field is the magic '3.8.99' string", () => {
    // Ensures future drift on the fixture (e.g. someone updates the file
    // to test a different version) is caught by this sentinel — the
    // fixture's purpose is locked to the F3 reproduction.
    const json = JSON.parse(fs.readFileSync(FIXTURE_38, 'utf8')) as {
      skeleton: { spine: string };
    };
    expect(json.skeleton.spine).toBe('3.8.99');
  });

  it('4.3 skeleton JSON fixture exists at the expected path', () => {
    expect(fs.existsSync(FIXTURE_43)).toBe(true);
  });

  it('4.3 atlas fixture exists alongside the JSON', () => {
    const atlas = path.resolve('fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas');
    expect(fs.existsSync(atlas)).toBe(true);
  });

  it('At least one PNG file exists under fixtures/SPINE_4_3_TEST/', () => {
    const dir = path.resolve('fixtures/SPINE_4_3_TEST');
    const entries = fs.readdirSync(dir, { recursive: true }) as string[];
    const hasPng = entries.some((e) => e.endsWith('.png'));
    expect(hasPng).toBe(true);
  });

  it("4.3 fixture's skeleton.spine field is the magic '4.3.91-beta' string", () => {
    const json = JSON.parse(fs.readFileSync(FIXTURE_43, 'utf8')) as {
      skeleton: { spine: string };
    };
    expect(json.skeleton.spine).toBe('4.3.91-beta');
  });

  it("4.3 fixture has a top-level `constraints` array (the breaking schema marker per SEED-003)", () => {
    const json = JSON.parse(fs.readFileSync(FIXTURE_43, 'utf8')) as {
      constraints: unknown;
    };
    expect(Array.isArray(json.constraints)).toBe(true);
  });
});
