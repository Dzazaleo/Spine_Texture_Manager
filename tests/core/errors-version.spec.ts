/**
 * Phase 12 Plan 05 (D-21) — F3 Spine version guard.
 *
 * Task 1 RED → GREEN: SpineVersionUnsupportedError class shape tests.
 *
 * The class is exported from src/core/errors.ts (alongside the existing
 * SpineLoaderError base + SkeletonJsonNotFoundError / AtlasNotFoundError /
 * AtlasParseError siblings). Asserts:
 *   - constructor accepts (detectedVersion, skeletonPath) and surfaces them
 *     as `public readonly` fields,
 *   - `.name === 'SpineVersionUnsupportedError'` (KNOWN_KINDS Set lookup at
 *     `src/main/ipc.ts` routes by err.name; the literal MUST match),
 *   - `.message` echoes the detected version + remediation per CONTEXT D-21,
 *   - inheritance chain: extends SpineLoaderError (so the existing
 *     `err instanceof SpineLoaderError` guard at the IPC forwarder still fires).
 *
 * The fixture-driven loadSkeleton-rejection tests live in
 * tests/core/loader-version-guard.spec.ts (Task 3); this file isolates the
 * error-class shape so Task 1 can land RED → GREEN without depending on
 * Task 2's loader insertion or Task 3's fixture.
 */
import { describe, expect, it } from 'vitest';
import {
  SpineLoaderError,
  SpineVersionUnsupportedError,
} from '../../src/core/errors.js';

describe('SpineVersionUnsupportedError (Phase 12 F3 + Phase 32 COMPAT-01)', () => {
  it('exposes detectedVersion + skeletonPath as readonly fields', () => {
    const err = new SpineVersionUnsupportedError('3.8.99', '/foo/skel.json');
    expect(err.detectedVersion).toBe('3.8.99');
    expect(err.skeletonPath).toBe('/foo/skel.json');
  });

  it("sets `.name === 'SpineVersionUnsupportedError'` (KNOWN_KINDS lookup contract)", () => {
    const err = new SpineVersionUnsupportedError('3.8.99', '/foo/skel.json');
    expect(err.name).toBe('SpineVersionUnsupportedError');
  });

  it("`.message` echoes detected version AND 'Spine 4.2 or later' remediation (CONTEXT D-21)", () => {
    const err = new SpineVersionUnsupportedError('3.8.99', '/foo/skel.json');
    expect(err.message).toContain('3.8.99');
    expect(err.message).toContain('Spine 4.2 or later');
    expect(err.message).toContain('Re-export');
  });

  it('extends SpineLoaderError (so the existing IPC forwarder instanceof check fires)', () => {
    const err = new SpineVersionUnsupportedError('3.8.99', '/foo/skel.json');
    expect(err).toBeInstanceOf(SpineLoaderError);
    expect(err).toBeInstanceOf(SpineVersionUnsupportedError);
    expect(err).toBeInstanceOf(Error);
  });

  it("'unknown' detectedVersion variant (pre-3.7 / null `skeleton.spine`) still produces a usable message", () => {
    const err = new SpineVersionUnsupportedError('unknown', '/foo/skel.json');
    expect(err.detectedVersion).toBe('unknown');
    expect(err.message).toContain('unknown');
    expect(err.message).toContain('Spine 4.2 or later');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Phase 44 (DISP-02, D-10) — 2-branch → 3-branch. The old WRONG-for-4.3
  // "re-export as 4.2 (supported downgrade)" string is REMOVED (4.3 now
  // routes; it no longer rejects via this class on the routing path). The
  // '4.3-schema' sentinel now reaches this constructor ONLY via the
  // resolveRuntimeTag token=4.2 + top-level constraints[] CONTRADICTION
  // path — it carries the discretion contradiction wording, NOT a
  // "re-export as 4.2" advisory. ≥4.4/≥5 gets the LOCKED D-10 wording.
  // <4.2/unknown/malformed keep the LOCKED <4.2 wording VERBATIM.
  // ───────────────────────────────────────────────────────────────────────

  it("≥4.4 branch: detectedVersion === '4.4.0' produces the LOCKED D-10 wording", () => {
    const err = new SpineVersionUnsupportedError('4.4.0', '/foo/skel.json');
    expect(err.message).toContain('This app supports Spine 4.2 and 4.3');
    expect(err.message).toContain('Re-export as Version 4.3 (or 4.2)');
    expect(err.detectedVersion).toBe('4.4.0');
    expect(err.skeletonPath).toBe('/foo/skel.json');
    expect(err.name).toBe('SpineVersionUnsupportedError');
    // The old WRONG-for-4.3 string MUST be gone.
    expect(err.message).not.toContain('supported downgrade');
  });

  it("≥4.4 branch: detectedVersion === '5.0.0' (any major >= 5) takes the SAME ≥4.4 branch", () => {
    const err = new SpineVersionUnsupportedError('5.0.0', '/foo/skel.json');
    expect(err.message).toContain('This app supports Spine 4.2 and 4.3');
    expect(err.detectedVersion).toBe('5.0.0');
    expect(err.name).toBe('SpineVersionUnsupportedError');
  });

  it("contradiction branch: detectedVersion === '4.3-schema' is a 4.2-stamped-but-4.3-shaped reject (NOT the old 're-export as 4.2' string)", () => {
    const err = new SpineVersionUnsupportedError('4.3-schema', '/foo/skel.json');
    // The old WRONG-for-4.3 string is fully removed.
    expect(err.message).not.toContain('Re-export from your 4.3 editor as Version 4.2');
    expect(err.message).not.toContain('supported downgrade');
    // It now carries a contradiction wording (discretion per D-10).
    expect(err.message).toContain('4.2');
    expect(err.message).toContain('4.3');
    expect(err.detectedVersion).toBe('4.3-schema');
    expect(err.skeletonPath).toBe('/foo/skel.json');
    expect(err.name).toBe('SpineVersionUnsupportedError');
  });

  it("4.3.x no longer takes the old 're-export as 4.2' branch (defensively — 4.3 routes, does not reject via this class on the routing path)", () => {
    const err = new SpineVersionUnsupportedError('4.3.91-beta', '/foo/skel.json');
    expect(err.message).not.toContain('Re-export from your 4.3 editor as Version 4.2');
    expect(err.message).not.toContain('supported downgrade');
    expect(err.name).toBe('SpineVersionUnsupportedError');
  });

  it("Pre-4.2 branch: detectedVersion === '4.1.99' preserves the LOCKED <4.2 message VERBATIM", () => {
    const err = new SpineVersionUnsupportedError('4.1.99', '/foo/skel.json');
    expect(err.message).toContain('4.1.99');
    expect(err.message).toContain('Spine Texture Manager requires Spine 4.2 or later');
    expect(err.message).toContain('Re-export from Spine 4.2 or later in the editor');
    // Neither the old 4.3-downgrade template NOR the new ≥4.4 template
    // may leak into the LOCKED <4.2 branch.
    expect(err.message).not.toContain('supported downgrade');
    expect(err.message).not.toContain('your 4.3 editor');
    expect(err.message).not.toContain('This app supports Spine 4.2 and 4.3');
    expect(err.name).toBe('SpineVersionUnsupportedError');
  });

  it("'unknown' detectedVersion takes the LOCKED <4.2 branch (PRESERVED)", () => {
    const err = new SpineVersionUnsupportedError('unknown', '/foo/skel.json');
    expect(err.message).toContain('Spine Texture Manager requires Spine 4.2 or later');
    expect(err.message).not.toContain('This app supports Spine 4.2 and 4.3');
    expect(err.message).not.toContain('supported downgrade');
    expect(err.detectedVersion).toBe('unknown');
    expect(err.name).toBe('SpineVersionUnsupportedError');
  });
});
