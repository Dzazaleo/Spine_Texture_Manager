/**
 * Phase 1 Plan 02 — Tests for `src/main/ipc.ts` (handleSkeletonLoad).
 *
 * Handler-invocation strategy: the IPC handler body is extracted as a
 * standalone async function `handleSkeletonLoad(jsonPath): Promise<LoadResponse>`
 * in `ipc.ts`; `registerIpcHandlers()` wires that function into
 * `ipcMain.handle('skeleton:load', ...)`. These tests invoke the function
 * directly — no Electron dependency in the test process.
 *
 * Behavior gates:
 *   - F1-integrated happy path (F1.1 + F1.2 + F1.3): fixture returns
 *     {ok: true, summary.bones.count === 12, summary.peaks.length === 3}
 *     (post gap-fix B: analyzer folds SIMPLE_TEST's two SQUARE sampler
 *     records — slots SQUARE + SQUARE2 — into one row by attachmentName).
 *   - D-10 / F1.4 typed-error envelope:
 *       * Bogus path → {ok: false, error.kind === 'SkeletonJsonNotFoundError'}
 *       * Missing atlas → {ok: false, error.kind === 'AtlasNotFoundError'}
 *   - T-01-02-02: error.message never contains stack-trace markers.
 */
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Phase 8.2 Plan 03 — Mock electron so the transitive load chain
// `ipc.ts → project-io.ts → recent.ts → app.getPath('userData')` resolves
// without spinning up Electron. handleSkeletonLoad itself does not touch
// electron at runtime; this mock is purely to satisfy the module-load
// side-effect introduced by Plan 03's recent.ts wiring.
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
  app: {
    whenReady: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp/userData'),
  },
  shell: { showItemInFolder: vi.fn() },
}));

import { handleSkeletonLoad } from '../../src/main/ipc.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

describe('handleSkeletonLoad (F1-integrated, D-10)', () => {
  it('F1-integrated: happy path returns {ok: true, summary: {..., animationBreakdown}}', async () => {
    const resp = await handleSkeletonLoad(FIXTURE);
    expect(resp.ok).toBe(true);
    if (resp.ok) {
      // Fixture ground truth: 12 bones (root, CTRL, CHAIN_2..8, SQUARE, CTRL_PATH, SQUARE2).
      expect(resp.summary.bones.count).toBe(12);
      // Post gap-fix B: SIMPLE_TEST's 4 sampler records fold to 3 DisplayRows
      // (the two attachments named `SQUARE` on slots SQUARE + SQUARE2 fold
      // to one row — one row per unique texture name).
      expect(resp.summary.peaks.length).toBe(3);
      expect(resp.summary.elapsedMs).toBeGreaterThanOrEqual(0);
      // Phase 3: animationBreakdown carries setup-pose + per-animation cards.
      expect(Array.isArray(resp.summary.animationBreakdown)).toBe(true);
      expect(resp.summary.animationBreakdown.length).toBeGreaterThanOrEqual(1);
      expect(resp.summary.animationBreakdown[0].cardId).toBe('setup-pose');
    }
  });

  it('D-10/F1.4: bogus path returns {ok: false, error.kind: SkeletonJsonNotFoundError}', async () => {
    const missing = path.join(os.tmpdir(), 'stm-ipc-does-not-exist-XYZ.json');
    const resp = await handleSkeletonLoad(missing);
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error.kind).toBe('SkeletonJsonNotFoundError');
      expect(resp.error.message).toContain('not found');
      // T-01-02-02: no stack trace leaked
      expect(resp.error.message).not.toContain('at ');
      expect(resp.error.message).not.toContain('.ts:');
    }
  });

  it('D-10/F1.4: missing atlas returns {ok: false, error.kind: AtlasNotFoundError}', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-ipc-'));
    const jsonPath = path.join(tmpDir, 'rig.json');
    // Phase 12 Plan 05 / D-21 — skeleton.spine must be >= 4.2 to reach
    // the atlas-resolution branch (loader's version-guard now fires
    // first and otherwise produces SpineVersionUnsupportedError).
    fs.writeFileSync(jsonPath, '{"skeleton":{"spine":"4.2.43"}}');
    try {
      const resp = await handleSkeletonLoad(jsonPath);
      expect(resp.ok).toBe(false);
      if (!resp.ok) {
        expect(resp.error.kind).toBe('AtlasNotFoundError');
        expect(resp.error.message).toContain('atlas');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
