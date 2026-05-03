/**
 * Phase 22.1 Plan 01 Task 1 (TDD RED → GREEN) — RotatedRegionUnsupportedError class shape.
 *
 * G-01b D-03 load-time rotation rejection.
 *
 * Asserts:
 *   - constructor accepts (regionName, atlasPath) and surfaces them as `public readonly` fields,
 *   - `.name === 'RotatedRegionUnsupportedError'` (KNOWN_KINDS Set lookup contract),
 *   - `.message` includes 'Rotated atlas regions are not supported.' AND
 *     'Re-export from Spine with rotation disabled.',
 *   - inheritance chain: extends SpineLoaderError.
 *
 * The fixture-driven loadSkeleton-rejection test lives in
 * tests/core/loader-rotation-rejection.spec.ts (Task 2). This file isolates the
 * error-class shape so Task 1 can land RED → GREEN without depending on Task 2's
 * loader insertion or fixture mutation.
 */
import { describe, expect, it } from 'vitest';
import {
  SpineLoaderError,
  RotatedRegionUnsupportedError,
} from '../../src/core/errors.js';

describe('RotatedRegionUnsupportedError (Phase 22.1 G-01b D-03)', () => {
  it('exposes regionName + atlasPath as readonly fields', () => {
    const err = new RotatedRegionUnsupportedError('SQUARE', '/path/to/x.atlas');
    expect(err.regionName).toBe('SQUARE');
    expect(err.atlasPath).toBe('/path/to/x.atlas');
  });

  it("sets `.name === 'RotatedRegionUnsupportedError'` (KNOWN_KINDS lookup contract)", () => {
    const err = new RotatedRegionUnsupportedError('SQUARE', '/path/to/x.atlas');
    expect(err.name).toBe('RotatedRegionUnsupportedError');
  });

  it("`.message` includes 'Rotated atlas regions are not supported.'", () => {
    const err = new RotatedRegionUnsupportedError('SQUARE', '/path/to/x.atlas');
    expect(err.message).toContain('Rotated atlas regions are not supported.');
  });

  it("`.message` includes 'Re-export from Spine with rotation disabled.'", () => {
    const err = new RotatedRegionUnsupportedError('SQUARE', '/path/to/x.atlas');
    expect(err.message).toContain('Re-export from Spine with rotation disabled.');
  });

  it('`.message` includes regionName and atlasPath for actionable diagnostics', () => {
    const err = new RotatedRegionUnsupportedError('MY_REGION', '/path/to/my.atlas');
    expect(err.message).toContain('MY_REGION');
    expect(err.message).toContain('/path/to/my.atlas');
  });

  it('extends SpineLoaderError (so the existing IPC forwarder instanceof check fires)', () => {
    const err = new RotatedRegionUnsupportedError('SQUARE', '/path/to/x.atlas');
    expect(err).toBeInstanceOf(SpineLoaderError);
    expect(err).toBeInstanceOf(RotatedRegionUnsupportedError);
    expect(err).toBeInstanceOf(Error);
  });
});
