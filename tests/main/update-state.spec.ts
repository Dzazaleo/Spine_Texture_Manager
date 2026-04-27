/**
 * Phase 12 Plan 01 Task 1 — RED specs for update-state.ts (D-08 persistence).
 *
 * Mirrors tests/main/recent.spec.ts byte-for-byte for the test scaffold:
 *   - vi.mock('electron') stubs app.getPath('userData') to a temp dir.
 *   - vi.mock('node:fs/promises') stubs readFile/writeFile/rename so each test
 *     can drive load/atomic-write paths deterministically.
 *
 * Coverage (per 12-01-PLAN.md Task 1 Behavior 1-9):
 *   - load happy path / missing file / malformed JSON / wrong version /
 *     missing-field / null-field-valid (silent-swallow gates).
 *   - setDismissedVersion atomic write (.tmp + rename) + read round-trip.
 *   - validateUpdateStateFile typed gate (good/bad inputs).
 *
 * RED expectation: imports of `loadUpdateState`, `setDismissedVersion`,
 * `validateUpdateStateFile`, and the `UpdateStateV1` type FAIL because
 * src/main/update-state.ts does not exist yet. GREEN at Task 1 implementation.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
// NB: src/main/update-state.ts does not exist until Task 1 Action.
import {
  loadUpdateState,
  setDismissedVersion,
  validateUpdateStateFile,
  type UpdateStateV1,
} from '../../src/main/update-state.js';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/tmp/userData' : '/tmp')),
  },
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const fsPromises = await import('node:fs/promises');
  vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
  vi.mocked(fsPromises.rename).mockResolvedValue(undefined);
});

describe('loadUpdateState (D-08 silent-swallow)', () => {
  it('(1) returns persisted state on valid v1 file', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        version: 1,
        dismissedUpdateVersion: '1.2.3',
        spikeOutcome: 'unknown',
      }) as unknown as string,
    );
    const state = await loadUpdateState();
    expect(state.version).toBe(1);
    expect(state.dismissedUpdateVersion).toBe('1.2.3');
  });

  it('(2) returns default on missing file (ENOENT swallowed)', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const state = await loadUpdateState();
    expect(state.version).toBe(1);
    expect(state.dismissedUpdateVersion).toBeNull();
    expect(state.spikeOutcome).toBe('unknown');
  });

  it('(3) returns default on malformed JSON (silent-swallow)', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue('{ broken' as unknown as string);
    const state = await loadUpdateState();
    expect(state.dismissedUpdateVersion).toBeNull();
  });

  it('(4) returns default on wrong version (version-FIRST gating, Pattern B)', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        version: 2,
        dismissedUpdateVersion: '1.2.3',
        spikeOutcome: 'pass',
      }) as unknown as string,
    );
    const state = await loadUpdateState();
    expect(state.dismissedUpdateVersion).toBeNull();
    expect(state.spikeOutcome).toBe('unknown');
  });

  it('(5) returns default on missing dismissedUpdateVersion field', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: 1 }) as unknown as string,
    );
    const state = await loadUpdateState();
    expect(state.dismissedUpdateVersion).toBeNull();
  });

  it('(6) accepts null dismissedUpdateVersion as valid input', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        version: 1,
        dismissedUpdateVersion: null,
        spikeOutcome: 'unknown',
      }) as unknown as string,
    );
    const state = await loadUpdateState();
    expect(state.version).toBe(1);
    expect(state.dismissedUpdateVersion).toBeNull();
  });
});

describe('setDismissedVersion (D-08 atomic write)', () => {
  it('(7) writes via .tmp + rename (atomic-write idiom)', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    await setDismissedVersion('1.2.3');
    const writeArg = vi.mocked(fs.writeFile).mock.calls[0][0] as string;
    expect(writeArg).toMatch(/update-state\.json\.tmp$/);
    const renameArgs = vi.mocked(fs.rename).mock.calls[0];
    expect(renameArgs[0]).toMatch(/update-state\.json\.tmp$/);
    expect(renameArgs[1]).toMatch(/update-state\.json$/);
  });

  it('(8) round-trip: setDismissedVersion then loadUpdateState returns the version', async () => {
    const fs = await import('node:fs/promises');
    // First call: load returns default (file missing).
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'));
    await setDismissedVersion('1.2.3');
    // Capture the JSON written and feed it back to loadUpdateState.
    const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    vi.mocked(fs.readFile).mockResolvedValueOnce(written);
    const state = await loadUpdateState();
    expect(state.dismissedUpdateVersion).toBe('1.2.3');
    expect(state.version).toBe(1);
  });
});

describe('validateUpdateStateFile (typed-guard envelope)', () => {
  it('(9) accepts valid v1, rejects bad shapes', () => {
    // Good: dismissedUpdateVersion can be string OR null.
    expect(
      validateUpdateStateFile({
        version: 1,
        dismissedUpdateVersion: '1.0.0',
        spikeOutcome: 'unknown',
      }).ok,
    ).toBe(true);
    expect(
      validateUpdateStateFile({
        version: 1,
        dismissedUpdateVersion: null,
        spikeOutcome: 'pass',
      }).ok,
    ).toBe(true);

    // Bad: missing version, wrong version, wrong field type.
    expect(validateUpdateStateFile({}).ok).toBe(false);
    expect(validateUpdateStateFile({ version: 'one', dismissedUpdateVersion: null }).ok).toBe(false);
    expect(validateUpdateStateFile({ version: 2, dismissedUpdateVersion: null }).ok).toBe(false);
    expect(validateUpdateStateFile({ version: 1, dismissedUpdateVersion: 42 }).ok).toBe(false);
    // Bad spikeOutcome value
    expect(
      validateUpdateStateFile({
        version: 1,
        dismissedUpdateVersion: null,
        spikeOutcome: 'maybe',
      }).ok,
    ).toBe(false);
  });
});

describe('hygiene', () => {
  it('(10) UpdateStateV1 type carries spikeOutcome union field', () => {
    // Compile-time check: the type must allow the three documented variants.
    const a: UpdateStateV1 = { version: 1, dismissedUpdateVersion: null, spikeOutcome: 'unknown' };
    const b: UpdateStateV1 = { version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'pass' };
    const c: UpdateStateV1 = { version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'fail' };
    expect(a.version).toBe(1);
    expect(b.spikeOutcome).toBe('pass');
    expect(c.spikeOutcome).toBe('fail');
  });
});
