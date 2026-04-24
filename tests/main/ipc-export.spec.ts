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
