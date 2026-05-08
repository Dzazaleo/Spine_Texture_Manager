// @vitest-environment node
/**
 * Phase 31 PLATFORM-01 — elevation probe specs (Sub-feature C).
 *
 * Tests C1..C5 from 31-03-PLAN.md <behavior>:
 *   - C1 (Layer 3 invariant) is enforced by tests/arch.spec.ts; this file
 *     covers the runtime contract C2..C5.
 *   - C2 — non-Windows short-circuit (no exec call; cached value stays false)
 *   - C3 — Windows + exec(null) → cached true
 *   - C4 — Windows + exec(error) → cached false (safe default per C-D-01)
 *   - C5 — getIsElevated() returns false BEFORE any probe runs (default).
 *
 * Mocks `node:child_process` with vi.mock so probeElevation() never spawns
 * a real process. process.platform is overridden per-test with
 * Object.defineProperty (configurable: true) and restored in afterEach to
 * the original captured value.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

import { exec } from 'node:child_process';
import {
  probeElevation,
  getIsElevated,
  __setIsElevatedForTesting,
} from '../../src/main/elevation.js';

const ORIGINAL_PLATFORM = process.platform;

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value,
    configurable: true,
  });
}

describe('Phase 31 PLATFORM-01 — elevation probe', () => {
  beforeEach(() => {
    __setIsElevatedForTesting(false);
    vi.mocked(exec).mockReset();
  });

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM);
  });

  it('C5: getIsElevated returns false before probeElevation runs', () => {
    expect(getIsElevated()).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('C2: short-circuits on non-Windows (no exec call)', async () => {
    setPlatform('darwin');
    await probeElevation();
    expect(getIsElevated()).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('C2b: short-circuits on linux (no exec call)', async () => {
    setPlatform('linux');
    await probeElevation();
    expect(getIsElevated()).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('C3: returns true when net session exits 0 on Windows', async () => {
    setPlatform('win32');
    vi.mocked(exec).mockImplementation(((_cmd: string, _opts: unknown, cb: unknown) => {
      // exec(cmd, opts, callback): callback(error, stdout, stderr).
      // Exit code 0 → null error.
      (cb as (err: unknown) => void)(null);
      return {} as never;
    }) as unknown as typeof exec);
    await probeElevation();
    expect(getIsElevated()).toBe(true);
  });

  it('C4: defaults to false on exec error on Windows', async () => {
    setPlatform('win32');
    vi.mocked(exec).mockImplementation(((_cmd: string, _opts: unknown, cb: unknown) => {
      (cb as (err: unknown) => void)(new Error('Access denied'));
      return {} as never;
    }) as unknown as typeof exec);
    await probeElevation();
    expect(getIsElevated()).toBe(false);
  });

  it('C4b: defaults to false on synchronous exec throw', async () => {
    setPlatform('win32');
    vi.mocked(exec).mockImplementation((() => {
      throw new Error('synchronous failure');
    }) as unknown as typeof exec);
    await probeElevation();
    expect(getIsElevated()).toBe(false);
  });
});
