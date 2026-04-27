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

describe('SpineVersionUnsupportedError (Phase 12 / Plan 05 / F3)', () => {
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
});
