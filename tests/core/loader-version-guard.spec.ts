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
 *
 * debug-fix spine-43-beta-appliedpose-null (2026-05-19) — D-11 STRENGTHENING
 * RECONCILIATION (owner-chosen Option A, NOT a descope). Root cause: the
 * Phase-44 D-11 "valid 4.3 routing" proof was anchored on
 * fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json — which is a `4.3.91-beta`
 * PRE-RELEASE export carrying a structurally-invalid root-targeting
 * parentless-IK rig that the SHIPPED stable spine-core@4.3.0 runtime
 * dereferences (`IkConstraint.apply1`: `bone.bone.parent.appliedPose`) and
 * crashes on at the sampler's first updateWorldTransform, swallowed into the
 * opaque `Unknown:` toast. The loader fix (src/core/loader.ts
 * isPrereleaseSpineToken + resolveRuntimeTag pre-release arm; src/core/errors.ts
 * `prerelease` classification) now rejects in-band pre-release exports with a
 * typed SpineVersionUnsupportedError. The D-11 routing INTENT (prove a 4.3
 * input routes + parses) is PRESERVED — but re-anchored on the GENUINE STABLE
 * `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`4.3.01`, 14 bones, 1 skin,
 * top-level constraints[], loads `{ ok: true }`). The beta fixture is RECAST
 * from "valid 4.3 route" to a PRE-RELEASE REJECT, mirroring the existing
 * `SPINE_3_8_TEST` `<4.2` reject block (same assertion shapes). This ADDS a
 * stronger pre-release-reject contract on top of preserved 4.3-routing
 * coverage — a strengthening, not a weakening. The recast pre-release-reject
 * describe block below IS the permanent regression test for this bug
 * (the throwaway headless `_dbg-` repro was deleted; never git-tracked).
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
// debug-fix spine-43-beta-appliedpose-null (2026-05-19) — the GENUINE STABLE
// 4.3 export that re-anchors the D-11 "valid 4.3 routing/parse" proof.
// `skeleton.spine == '4.3.01'` (stable, NO pre-release suffix), 14 bones,
// 1 skin, top-level constraints[]; verified `loadSkeleton(...) → { ok: true }`.
// FIXTURE_43 (SPINE_4_3_TEST, `4.3.91-beta`) is NO LONGER a valid-route proof
// — it is now a pre-release reject (see the recast describe block below).
const FIXTURE_43_STABLE = path.resolve(
  'fixtures/SIMPLE_PROJECT_43/skeleton2.json',
);

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

describe('Phase 44 DISP-01/03 (D-11): loadSkeleton ROUTES a STABLE Spine 4.3 fixture to the 4.3 runtime (dispatch, not reject)', () => {
  // Phase-44 RECONCILIATION of the old Phase-32 COMPAT-01 reject block. The
  // dual-runtime dispatch flip (loader.ts resolveRuntimeTag) means a STABLE
  // 4.3 input now ROUTES; every arm below asserts ROUTING — a passing test
  // still asserting the OLD 4.3-reject would be a false-green (D-11
  // false-green-guard rule).
  //
  // debug-fix spine-43-beta-appliedpose-null (2026-05-19) — D-11 INTENT
  // PRESERVED, proof RE-ANCHORED. The original anchor (FIXTURE_43,
  // SPINE_4_3_TEST `4.3.91-beta`) was a PRE-RELEASE export whose
  // structurally-invalid root-targeting parentless-IK rig crashes the stable
  // spine-core runtime — it was never a valid "stable 4.3 routes" proof, and
  // the loader fix now correctly REJECTS it (see the pre-release-reject
  // describe block below). The 4.3-routing proof is re-anchored on the
  // GENUINE STABLE `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`4.3.01`,
  // 14 bones, 1 skin, top-level constraints[]) — a real validated export.
  // This strengthens, not weakens, D-11: 4.3-routing coverage is preserved
  // on a trustworthy fixture AND a stronger pre-release-reject contract is
  // added below.

  it('routes a stable Spine 4.3.01 fixture to the 4.3 runtime (D-11: dispatch, not reject)', () => {
    expect(() => loadSkeleton(FIXTURE_43_STABLE)).not.toThrow();
    const load = loadSkeleton(FIXTURE_43_STABLE);
    expect(load).toBeTruthy();
    // The LoadResult carries the threaded runtime identity on its opaque
    // skeletonData handle (__rt, read via handleRuntime). A 4.3-routed load
    // MUST be branded by the 4.3 runtime — this is the dispatch-target proof
    // (not merely "did not throw").
    expect(handleRuntime(load.skeletonData)).toBe('4.3');
  });

  it('the routed LoadResult is fully populated (parsed via the 4.3 runtime, not rejected)', () => {
    const load = loadSkeleton(FIXTURE_43_STABLE);
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
      loadSkeleton(FIXTURE_43_STABLE);
    } catch (err) {
      caught = err;
    }
    // Post-flip there is NO throw at all for a STABLE 4.3 input; defensively
    // assert that if anything DID throw it is NOT the version reject (a
    // residual 4.3-reject would be the false-green this D-11 reconciliation
    // closes).
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

describe('debug-fix spine-43-beta-appliedpose-null (2026-05-19): loadSkeleton REJECTS the Spine 4.3.91-beta PRE-RELEASE fixture with a typed SpineVersionUnsupportedError', () => {
  // RECAST of FIXTURE_43 (SPINE_4_3_TEST, `skeleton.spine == "4.3.91-beta"`).
  // This fixture is a NON-STABLE (beta) Spine editor export whose
  // structurally-invalid root-targeting parentless-IK rig the SHIPPED stable
  // spine-core@4.3.0 runtime dereferences (`IkConstraint.apply1`:
  // `bone.bone.parent.appliedPose`) and crashes on at the sampler's first
  // updateWorldTransform — previously swallowed into the opaque
  // `Unknown: Cannot read properties of null (reading 'appliedPose')` toast.
  // The loader fix (src/core/loader.ts isPrereleaseSpineToken +
  // resolveRuntimeTag pre-release arm) now detects the in-band pre-release
  // token at the single dispatch gate and rejects with a typed
  // SpineVersionUnsupportedError carrying an actionable
  // re-export-from-stable message (src/core/errors.ts `prerelease` arm)
  // BEFORE the broken rig reaches the sampler.
  //
  // This block MIRRORS the existing `F3: Spine version guard rejects pre-4.2
  // fixtures` block above (same assertion shapes: toThrow / toBeInstanceOf /
  // skeletonPath / message-content) and IS the permanent regression test for
  // this bug (the owner-chosen Option-A D-11 strengthening — the throwaway
  // headless `_dbg-` repro was deleted; never git-tracked). Do NOT weaken or
  // delete — this is the contract that keeps the pre-release-reject behavior
  // from silently regressing.

  it('loadSkeleton rejects the Spine 4.3.91-beta pre-release fixture with typed SpineVersionUnsupportedError', () => {
    expect(() => loadSkeleton(FIXTURE_43)).toThrow(SpineVersionUnsupportedError);
  });

  it("Rejection error carries the 'prerelease:4.3.91-beta' detectedVersion sentinel", () => {
    // detectedVersion retains the `prerelease:<version>` sentinel form (the
    // renderer displays `.message`, not `.detectedVersion` — App.tsx:751 —
    // so the sentinel prefix is never user-visible; programmatic consumers
    // can strip the `prerelease:` prefix). See src/core/errors.ts.
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SpineVersionUnsupportedError);
    expect((caught as SpineVersionUnsupportedError).detectedVersion).toBe(
      'prerelease:4.3.91-beta',
    );
  });

  it("Rejection error message echoes the actual beta token AND directs a stable re-export (actionable wording)", () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    const msg = (caught as Error).message;
    // Exact phrases produced by the src/core/errors.ts `prerelease` branch.
    expect(msg).toContain('pre-release build (4.3.91-beta)');
    expect(msg).toContain(
      'Spine Texture Manager supports stable Spine 4.2 and 4.3 releases only.',
    );
    expect(msg).toContain(
      'Re-export this project from a stable Spine 4.3 (or 4.2) release and try again.',
    );
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

  it('Rejection error carries the skeletonPath argument the caller passed', () => {
    let caught: unknown;
    try {
      loadSkeleton(FIXTURE_43);
    } catch (err) {
      caught = err;
    }
    expect((caught as SpineVersionUnsupportedError).skeletonPath).toBe(FIXTURE_43);
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

  it("STABLE 4.3 routing fixture (SIMPLE_PROJECT_43/skeleton2.json) exists and is stamped '4.3.01' (no pre-release suffix)", () => {
    // debug-fix spine-43-beta-appliedpose-null (2026-05-19) — guards the
    // re-anchored D-11 routing proof: if this stable fixture drifts away
    // from a clean stable 4.3 token the routing proof above is no longer
    // trustworthy. Locks the fixture's purpose to the D-11 routing role.
    expect(fs.existsSync(FIXTURE_43_STABLE)).toBe(true);
    const json = JSON.parse(fs.readFileSync(FIXTURE_43_STABLE, 'utf8')) as {
      skeleton: { spine: string };
    };
    expect(json.skeleton.spine).toBe('4.3.01');
  });
});
