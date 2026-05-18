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
 * Phase 32 (COMPAT-01) extension — added the 4.3-rejection describe block and
 * the SPINE_4_3_TEST fixture-existence sentinels.
 *
 * Phase 44 (DISP-01/03, D-11) RECONCILIATION — the dual-runtime dispatch flip
 * (loader.ts resolveRuntimeTag, Plan 02 + the 44-03 single-gate fix) turns the
 * loader from a 4.3-REJECTER into a 4.3-ROUTER. The Phase-32 COMPAT-01
 * describe block below is therefore FLIPPED: every `loadSkeleton(FIXTURE_43)`
 * arm now asserts ROUTING (no throw; a populated LoadResult routed to the 4.3
 * runtime), NOT the OLD 4.3-reject. This is the D-11 false-green-guard rule:
 * a passing test still asserting the OLD 4.3-reject would be a false-green.
 *
 * The `<4.2` reject-cases are EXPLICITLY PRESERVED (NOT deleted): the
 * `F3: Spine version guard rejects pre-4.2 fixtures` describe block below
 * keeps every `loadSkeleton(FIXTURE_38)` (spine 3.8.99 — a <4.2 reject)
 * `toThrow(SpineVersionUnsupportedError)` assertion verbatim. Deleting those
 * would be a silent descope (memory
 * `feedback_replan_can_silently_descope_roadmap_contract`).
 *
 * SCOPE SPLIT (documented, NOT silently descoped — ROADMAP Phase-45 SC#3):
 * Phase 44 owns ONLY the 4.3-input-now-asserts-routing reconciliation +
 * preserving the `<4.2`/`≥4.4` throw-cases. The user-facing copy / docs /
 * drop-zone sweep + the final reject-test inversion stay Phase 45 (UX-01/02).
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  SpineLoaderError,
  SpineVersionUnsupportedError,
} from '../../src/core/errors.js';
import { handleRuntime } from '../../src/core/runtime/types.js';

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

describe('Phase 44 DISP-01/03 (D-11): loadSkeleton ROUTES the Spine 4.3.91-beta fixture to the 4.3 runtime (dispatch, not reject)', () => {
  // Phase-44 RECONCILIATION of the old Phase-32 COMPAT-01 reject block. The
  // dual-runtime dispatch flip (loader.ts resolveRuntimeTag) means a 4.3 input
  // now ROUTES; FIXTURE_43 (spine "4.3.91-beta", top-level constraints[]) is
  // excluded from SAFE-01 discovery by the D-04 denylist, so loading it
  // directly here IS the routing proof. Every arm below asserts ROUTING — a
  // passing test still asserting the OLD 4.3-reject would be a false-green
  // (D-11 false-green-guard rule).

  it('routes Spine 4.3.91-beta fixture to the 4.3 runtime (D-11: dispatch, not reject)', () => {
    expect(() => loadSkeleton(FIXTURE_43)).not.toThrow();
    const load = loadSkeleton(FIXTURE_43);
    expect(load).toBeTruthy();
    // The LoadResult carries the threaded runtime identity on its opaque
    // skeletonData handle (__rt, read via handleRuntime). A 4.3-routed load
    // MUST be branded by the 4.3 runtime — this is the dispatch-target proof
    // (not merely "did not throw").
    expect(handleRuntime(load.skeletonData)).toBe('4.3');
  });

  it('the routed LoadResult is fully populated (parsed via the 4.3 runtime, not rejected)', () => {
    const load = loadSkeleton(FIXTURE_43);
    expect(load.skeletonData).toBeTruthy();
    expect(load.atlas).toBeTruthy();
    expect(load.runtime).toBeTruthy();
    // Structural proof it parsed (route + parse, not reject): the 4.3
    // SkeletonData has non-empty bones[] / skins[].
    const sd = load.skeletonData as unknown as {
      bones?: unknown[];
      skins?: unknown[];
    };
    expect(Array.isArray(sd.bones)).toBe(true);
    expect((sd.bones ?? []).length).toBeGreaterThan(0);
    expect(Array.isArray(sd.skins)).toBe(true);
    expect((sd.skins ?? []).length).toBeGreaterThan(0);
  });

  it('routing does NOT raise SpineVersionUnsupportedError (the OLD 4.3-reject is gone — D-11)', () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    // Post-flip there is NO throw at all for a 4.3 input; defensively assert
    // that if anything DID throw it is NOT the version reject (a residual
    // 4.3-reject would be the false-green this D-11 reconciliation closes).
    expect(caught).toBeUndefined();
    expect(caught).not.toBeInstanceOf(SpineVersionUnsupportedError);
    expect(caught).not.toBeInstanceOf(SpineLoaderError);
  });

  it('REGRESSION: Spine 4.2.x fixture (SIMPLE_PROJECT) still loads successfully and routes to the 4.2 runtime', () => {
    // The 4.2 happy path stays green AND is routed to runtime-42 (the
    // dispatch flip must not collaterally mis-route the 4.2 golden).
    expect(() => loadSkeleton(FIXTURE_42)).not.toThrow();
    const load = loadSkeleton(FIXTURE_42);
    expect(handleRuntime(load.skeletonData)).toBe('4.2');
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
