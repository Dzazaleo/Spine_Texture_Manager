/**
 * Phase 6 Plan 05 — RED specs for IPC export handlers.
 *
 * Tests handleStartExport + handlePickOutputDirectory directly (not via
 * ipcMain.handle); mirrors tests/core/ipc.spec.ts handler-extraction
 * discipline (extracted standalone async fns testable WITHOUT spinning up
 * Electron — vi.mock electron + image-worker for the unit cases below).
 *
 * Cases per .planning/phases/06-optimize-assets-image-export/06-CONTEXT.md
 * "Implementation Decisions" + RESEARCH "Phase Requirements → Test Map":
 *   - F8.1 picker opens + returns chosen path; cancel returns null.
 *   - D-119 re-entrant 'export:start' returns 'already-running' error.
 *   - D-122 picker defaultPath = <skeleton_dir>/images-optimized/.
 *   - F8.4 / D-122 outDir == source/images is rejected with typed error.
 *   - F8.4 / D-122 outDir is CHILD of source/images is rejected.
 *
 * Wave 0 status: RED — handlers do not yet exist (Plan 06-05).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
// RED imports — Plan 06-05 introduces these in src/main/ipc.ts.
import {
  handleStartExport,
  handlePickOutputDirectory,
} from '../../src/main/ipc.js';
import type { ExportPlan } from '../../src/shared/types.js';

vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
  app: { whenReady: vi.fn(), quit: vi.fn(), on: vi.fn() },
}));

vi.mock('../../src/main/image-worker.js', () => ({
  runExport: vi.fn().mockResolvedValue({
    successes: 0,
    errors: [],
    outputDir: '/tmp/out',
    durationMs: 1,
    cancelled: false,
  }),
}));

function buildEmptyPlan(): ExportPlan {
  return { rows: [], excludedUnused: [], totals: { count: 0 } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handlePickOutputDirectory — F8.1 + D-122', () => {
  it('returns null when user cancels picker', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as unknown as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handlePickOutputDirectory('/some/default');
    expect(result).toBeNull();
  });

  it('returns absolute path when user picks a directory', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/picked/output'],
    } as unknown as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handlePickOutputDirectory('/some/default');
    expect(result).toBe('/picked/output');
  });

  it('passes defaultPath to dialog.showOpenDialog', async () => {
    const electron = await import('electron');
    const dlgMock = vi.mocked(electron.dialog.showOpenDialog);
    dlgMock.mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as unknown as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    await handlePickOutputDirectory('/skeleton/dir/images-optimized');
    expect(dlgMock).toHaveBeenCalled();
    const callArgs = dlgMock.mock.calls[0][0] as { defaultPath?: string };
    expect(callArgs.defaultPath).toBe('/skeleton/dir/images-optimized');
  });

  it('uses properties: ["openDirectory","createDirectory","promptToCreate"] for cross-platform', async () => {
    const electron = await import('electron');
    const dlgMock = vi.mocked(electron.dialog.showOpenDialog);
    dlgMock.mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as unknown as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    await handlePickOutputDirectory();
    const callArgs = dlgMock.mock.calls[0][0] as { properties?: string[] };
    expect(callArgs.properties).toContain('openDirectory');
    expect(callArgs.properties).toContain('createDirectory');
    expect(callArgs.properties).toContain('promptToCreate');
  });
});

describe('handleStartExport — D-115 / D-119 / D-122 / F8.4', () => {
  it('rejects re-entrant call with { ok:false, error:{ kind:"already-running" } }', async () => {
    // Kick off the first call but DO NOT await — leaves the in-flight flag set.
    const electron = await import('electron');
    const fakeEvt = {
      sender: { send: vi.fn() },
    } as unknown as Electron.IpcMainInvokeEvent;
    void fakeEvt;
    void electron;
    const plan = buildEmptyPlan();
    const first = handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/tmp/out',
    );
    const second = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/tmp/out',
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.kind).toBe('already-running');
    }
    await first; // let the first one settle for cleanup
  });

  it('rejects when outDir equals source images dir (F8.4)', async () => {
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/skel/images/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['CIRCLE'],
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel/images',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-out-dir');
    }
  });

  it('rejects when outDir is a child of source images dir (F8.4)', async () => {
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/skel/images/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['CIRCLE'],
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel/images/sub',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-out-dir');
    }
  });

  it('returns { ok:true, summary } on happy path', async () => {
    const plan = buildEmptyPlan();
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/tmp/out',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.successes).toBe('number');
    }
  });

  it('clears exportInFlight flag after error so a follow-up call can proceed', async () => {
    // Force an error on the first call (invalid out dir), then verify the
    // follow-up happy-path call is NOT rejected as 'already-running'.
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/skel/images/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['CIRCLE'],
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const failed = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel/images',
    );
    expect(failed.ok).toBe(false);
    // Follow-up call with a valid outDir must not be 'already-running'.
    const followup = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
    );
    if (!followup.ok) {
      expect(followup.error.kind).not.toBe('already-running');
    }
  });
});

/**
 * Gap-Fix Round 2 (2026-04-25) — Bug #4 regression-lock.
 *
 * Reproduction (user-confirmed): user picked the SKELETON folder as outDir
 * (not the images folder) — source PNGs lived in `<skeletonDir>/images/`, so
 * each row's resolved write `<outDir>/images/<region>.png` landed ON its
 * source PNG. The OLD `isOutDirInsideSourceImages` guard saw outDir as
 * OUTSIDE source-images and approved; the worker overwrote source files in
 * place. The new pre-flight per-row collision check rejects with
 * 'overwrite-source' BEFORE setting exportInFlight.
 */
describe('handleStartExport — Bug #4 source-vs-output collision (Gap-Fix Round 2)', () => {
  it('rejects with overwrite-source when outDir is parent-of-source-images (the user-confirmed repro case)', async () => {
    // Source PNGs at /skel/images/CIRCLE.png; outDir is the parent /skel.
    // Row's outPath is `images/CIRCLE.png` (loader sets outPath relative
    // so a parent-of-images outDir resolves directly onto the source).
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/skel/images/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['CIRCLE'],
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Critical: must be 'overwrite-source', NOT 'invalid-out-dir' —
      // 'invalid-out-dir' fires only when outDir is INSIDE source-images;
      // this is the inverse case (outDir is the PARENT of source-images).
      expect(result.error.kind).toBe('overwrite-source');
      expect(result.error.message).toMatch(/overwrite source PNG/);
    }
  });

  it('rejects with overwrite-source when ANY row would collide (catches sibling-folder collision case)', async () => {
    // Multiple rows; one is safe, one collides. The first collision wins.
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/images/SAFE.png',
          outPath: 'other/SAFE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['SAFE'],
        },
        {
          sourcePath: '/proj/images/BAD.png',
          outPath: 'images/BAD.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['BAD'],
        },
      ],
      excludedUnused: [],
      totals: { count: 2 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/proj',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('overwrite-source');
      expect(result.error.message).toContain('BAD.png');
    }
  });

  it('rejects with overwrite-source when atlas page would be overwritten', async () => {
    // Atlas-packed project: per-region PNG path is missing on disk; the
    // row carries atlasSource pointing at the atlas page PNG instead.
    // outDir + outPath collides with the atlas page → reject.
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/images/AVATAR/L_EYE.png',
          outPath: 'JOKERMAN_SPINE.png',
          sourceW: 171,
          sourceH: 171,
          outW: 100,
          outH: 100,
          effectiveScale: 0.58,
          attachmentNames: ['AVATAR/L_EYE'],
          atlasSource: {
            pagePath: '/proj/JOKERMAN_SPINE.png',
            x: 1032,
            y: 3235,
            w: 171,
            h: 171,
            rotated: false,
          },
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/proj',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('overwrite-source');
      expect(result.error.message).toMatch(/atlas page/);
    }
  });

  it('does NOT false-reject a genuinely safe outDir (happy path stays GREEN)', async () => {
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/images/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 64,
          sourceH: 64,
          outW: 32,
          outH: 32,
          effectiveScale: 0.5,
          attachmentNames: ['CIRCLE'],
        },
      ],
      excludedUnused: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/tmp/foo',
    );
    expect(result.ok).toBe(true);
  });
});
