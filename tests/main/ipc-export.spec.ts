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
  handleProbeExportConflicts,
} from '../../src/main/ipc.js';
import type { ExportPlan } from '../../src/shared/types.js';

// Phase 8.2 Plan 03 — extended electron mock to satisfy `src/main/recent.ts`'s
// module-load `app.getPath('userData')` call. ipc.ts imports project-io.ts,
// which imports addRecent eagerly from recent.ts (Plan 03 D-180 wiring), so
// recent.ts is transitively loaded by this test file.
vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
  app: {
    whenReady: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp/userData'),
  },
}));

// Phase 8.2 Plan 03 — recent.ts is transitively imported via ipc.ts →
// project-io.ts → recent.ts. None of the export tests below traverse the
// recent code path, but the module must be safe to load.
vi.mock('../../src/main/recent.js', () => ({
  loadRecent: vi.fn().mockResolvedValue([]),
  addRecent: vi.fn().mockResolvedValue([]),
  clearRecent: vi.fn().mockResolvedValue(undefined),
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

// Phase 40 D-04a — mock repack-worker so dispatch tests can assert which
// worker the handler called, and simulate the REPACK-10 throw without
// touching real sharp/libvips. Default impl resolves with empty paths so
// happy-path 'atlas' / 'both' dispatch returns ok=true.
// UAT bug 3 (2026-05-15): runRepack must return a real ExportSummary so
// the IPC handler doesn't fabricate successes=0 for atlas mode. Default
// impl resolves with successes=3 + empty errors so atlas/both dispatch
// tests can assert merge semantics without rigging individual cases.
vi.mock('../../src/main/repack-worker.js', () => ({
  runRepack: vi.fn().mockResolvedValue({
    pageFiles: [],
    atlasFile: '/tmp/out/SIMPLE_TEST.atlas',
    summary: {
      successes: 3,
      errors: [],
      outputDir: '/tmp/out',
      durationMs: 5,
      cancelled: false,
    },
  }),
}));

// Gap-Fix Round 3 (2026-04-25) — mock node:fs/promises.access so the
// Round 3 defense-in-depth probe doesn't hit the real filesystem from
// these unit tests. Default: every probed path is "missing" (rejects)
// so by default no pre-existing-file conflicts surface; tests that need
// an existence-collision opt in by overriding the mock.
//
// Phase 40 D-04a — `rm` is the rollback sweep primitive. Default impl
// resolves (file removed) so the sweep in handleStartExport's inner
// catch is a no-op when no conflicts/rollbacks occur. REPACK-10 tests
// override with a spy to assert the per-path sweep call list.
vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  rm: vi.fn().mockResolvedValue(undefined),
  // UAT Round 3 (2026-05-15) — readdir is used by the atlas-mode probe to
  // discover {projectName}_<N>.png pages (N >= 2). Default: empty
  // directory (no multi-page entries). Tests that need multi-page
  // conflicts override with vi.mocked(fsPromises.readdir).mockResolvedValueOnce.
  readdir: vi.fn().mockResolvedValue([]),
  constants: { F_OK: 0, R_OK: 4 },
}));

function buildEmptyPlan(): ExportPlan {
  return { rows: [], excludedUnused: [], passthroughCopies: [], totals: { count: 0 } };
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Gap-Fix Round 3 (2026-04-25): re-establish the default fs.access
  // ENOENT behaviour after vi.clearAllMocks() — clearAllMocks wipes
  // call history but vi.mocked.foo.mockResolvedValueOnce(...) impls
  // from prior tests would otherwise leak (one-off impls live until
  // consumed; if a prior test's impl was NOT consumed, the next test
  // would see it). mockReset wipes both call history AND impls so the
  // default factory impl from the vi.mock() block above is what runs.
  const fsPromises = await import('node:fs/promises');
  vi.mocked(fsPromises.access).mockReset().mockRejectedValue(new Error('ENOENT'));
  // Phase 40 D-04a — reset rm + runRepack + runExport impls so REPACK-10
  // throw-rigging in one test does not leak into a subsequent test.
  vi.mocked(fsPromises.rm).mockReset().mockResolvedValue(undefined);
  // UAT Round 3 (2026-05-15) — reset readdir to empty-directory default
  // so multi-page atlas tests do not bleed into adjacent tests.
  vi.mocked(fsPromises.readdir).mockReset().mockResolvedValue([]);
  const imageWorker = await import('../../src/main/image-worker.js');
  vi.mocked(imageWorker.runExport).mockReset().mockResolvedValue({
    successes: 0,
    errors: [],
    outputDir: '/tmp/out',
    durationMs: 1,
    cancelled: false,
  });
  const repackWorker = await import('../../src/main/repack-worker.js');
  vi.mocked(repackWorker.runRepack).mockReset().mockResolvedValue({
    pageFiles: [],
    atlasFile: '/tmp/out/SIMPLE_TEST.atlas',
    summary: {
      successes: 3,
      errors: [],
      outputDir: '/tmp/out',
      durationMs: 5,
      cancelled: false,
    },
  });
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
      passthroughCopies: [],
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

  // Gap-Fix Round 3 (2026-04-25) — UPDATED contract: outDir as a child of
  // source-images-dir is no longer rejected on folder-position alone; only
  // an actual file collision triggers a rejection. With outDir =
  // /skel/images/sub and outPath = images/CIRCLE.png, the resolved write
  // /skel/images/sub/images/CIRCLE.png does NOT collide with the source
  // /skel/images/CIRCLE.png — and our mocked fs.access defaults to ENOENT
  // for the existence probe — so the export is permitted.
  it('Round 3: child-of-source-images-dir is now ALLOWED (folder-position-only guard relaxed)', async () => {
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      {
        sender: { send: vi.fn() },
      } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel/images/sub',
    );
    // Round 3: should NOT reject for folder-position alone.
    expect(result.ok).toBe(true);
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
      passthroughCopies: [],
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
 * place.
 *
 * Round 2 introduced a per-row collision check that rejected with
 * 'overwrite-source' UNCONDITIONALLY.
 *
 * Round 3 (2026-04-25) — the per-row check is now GATED on the renderer-
 * driven `overwrite` flag. Without overwrite, the result is still
 * 'overwrite-source' (now carrying a `conflicts: string[]` payload from
 * the new probe pipeline). With overwrite=true (renderer "Overwrite all"),
 * the check is bypassed and the export proceeds. The message format
 * changed from per-row ("Output would overwrite source PNG: ...") to
 * aggregate ("N file(s) would be overwritten. Probe before starting.");
 * conflicts list contains the per-file paths.
 */
describe('handleStartExport — Bug #4 source-vs-output collision (Gap-Fix Round 2 → Round 3)', () => {
  it('rejects with overwrite-source when outDir is parent-of-source-images (the user-confirmed repro case)', async () => {
    // Source PNGs at /skel/images/CIRCLE.png; outDir is the parent /skel.
    // Row's outPath is `images/CIRCLE.png` (loader sets outPath relative
    // so a parent-of-images outDir resolves directly onto the source).
    //
    // Round 4 (2026-04-25): collisions are now F_OK-gated, not string-match.
    // Pretend the resolved output path exists on disk so the probe surfaces
    // the conflict (the previous string-match check is gone).
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockResolvedValue(undefined as unknown as void);

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
      passthroughCopies: [],
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
      // 'invalid-out-dir' fires only when outDir IS source-images;
      // this is the inverse case (outDir is the PARENT of source-images).
      expect(result.error.kind).toBe('overwrite-source');
      // Round 3: the conflicts list is the precise payload.
      if (result.error.kind === 'overwrite-source') {
        expect(result.error.conflicts).toBeDefined();
        expect(result.error.conflicts!.length).toBeGreaterThan(0);
        expect(result.error.conflicts![0]).toContain('CIRCLE.png');
      }
    }
  });

  it('rejects with overwrite-source when ANY row would collide (catches sibling-folder collision case)', async () => {
    // Multiple rows; one is safe (no file at resolved out), one collides
    // (file exists at resolved out). Round 4 (2026-04-25): only the BAD
    // row's resolved output (/proj/images/BAD.png) is on disk; the SAFE
    // row's resolved output (/proj/other/SAFE.png) is not.
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockImplementation(async (p) => {
      if (typeof p === 'string' && p.endsWith('BAD.png')) {
        return undefined as unknown as void;
      }
      throw new Error('ENOENT');
    });

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
      passthroughCopies: [],
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
      if (result.error.kind === 'overwrite-source') {
        expect(result.error.conflicts).toBeDefined();
        // The conflicts list must include the colliding BAD.png path.
        expect(result.error.conflicts!.some((p) => p.endsWith('BAD.png'))).toBe(true);
      }
    }
  });

  it('rejects with overwrite-source when atlas page would be overwritten', async () => {
    // Atlas-packed project: per-region PNG path is missing on disk; the
    // row carries atlasSource pointing at the atlas page PNG instead.
    // outDir + outPath resolves to /proj/JOKERMAN_SPINE.png — which is
    // the atlas page itself.
    //
    // Round 4 (2026-04-25): collisions are now F_OK-gated, not string-match.
    // Pretend the resolved output (the atlas page on disk) exists so the
    // probe surfaces the conflict.
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockResolvedValue(undefined as unknown as void);

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
            packW: 171,
            packH: 171,
            offsetX: 0,
            offsetY: 0,
            w: 171,
            h: 171,
            rotated: false,
          },
        },
      ],
      excludedUnused: [],
      passthroughCopies: [],
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
      if (result.error.kind === 'overwrite-source') {
        expect(result.error.conflicts).toBeDefined();
        // The conflicts list must include the resolved output path
        // (which happens to BE the atlas page in this test setup).
        expect(result.error.conflicts!.some((p) => p.endsWith('JOKERMAN_SPINE.png'))).toBe(true);
      }
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
      passthroughCopies: [],
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

/**
 * Gap-Fix Round 3 (2026-04-25) — probe-then-confirm contract.
 *
 * - probeExportConflicts pure detection (no side effects, no in-flight
 *   mutation, no Electron dependency in the call path).
 * - handleStartExport(overwrite=true) bypasses the per-row collision check
 *   AND the defense-in-depth probe — but the hard-reject case
 *   (outDir IS source-images-dir) cannot be rescued by overwrite=true.
 * - handleStartExport(overwrite=false) re-runs the probe and rejects
 *   with the precise `conflicts` payload (defense-in-depth for any
 *   caller that bypasses the renderer flow).
 */
describe('handleProbeExportConflicts + handleStartExport overwrite flag (Gap-Fix Round 3)', () => {
  it('probeExportConflicts returns the list of conflicting paths without side effects', async () => {
    // Round 4 (2026-04-25): conflicts are F_OK-gated. Pretend the resolved
    // output path exists on disk so the probe returns it as a conflict.
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockResolvedValue(undefined as unknown as void);

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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleProbeExportConflicts(plan, '/skel');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0]).toContain('CIRCLE.png');
    }

    // Side-effect check: a follow-up startExport must not be 'already-running'
    // (probe must not have set the in-flight flag).
    const followup = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
    );
    if (!followup.ok) {
      expect(followup.error.kind).not.toBe('already-running');
    }
  });

  it('probeExportConflicts returns empty list when no conflicts exist', async () => {
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    // outDir = /tmp/foo: source is at /proj/images/CIRCLE.png, resolved
    // out is /tmp/foo/images/CIRCLE.png — no source-match. Mocked
    // fs.access defaults to ENOENT for the existence probe → empty list.
    const result = await handleProbeExportConflicts(plan, '/tmp/foo');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conflicts).toEqual([]);
    }
  });

  it('probeExportConflicts surfaces a pre-existing PNG at the resolved output (any-collision)', async () => {
    // Even when source-vs-output does NOT collide, an existing file at
    // the resolved output path is still a collision the user must
    // confirm — the renderer should not silently destroy unrelated
    // files. Mocked fs.access resolves (file exists) for THIS test.
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockResolvedValueOnce(undefined as unknown as void);

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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleProbeExportConflicts(plan, '/tmp/foo');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0]).toContain('CIRCLE.png');
    }
  });

  it('handleStartExport with overwrite=false AND conflicts → rejects with overwrite-source (defense-in-depth)', async () => {
    // Round 4 (2026-04-25): conflicts are F_OK-gated. Pretend the resolved
    // output exists on disk so the defense-in-depth probe surfaces it.
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockResolvedValue(undefined as unknown as void);

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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel',
      false,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('overwrite-source');
      if (result.error.kind === 'overwrite-source') {
        expect(result.error.conflicts).toBeDefined();
        expect(result.error.conflicts!.length).toBeGreaterThan(0);
      }
    }
  });

  it('handleStartExport with overwrite=true AND conflicts → proceeds (per-row check bypassed)', async () => {
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel',
      true,
    );
    // overwrite=true bypasses the per-row collision check; runExport is
    // mocked to resolve with an empty summary so the result is OK.
    expect(result.ok).toBe(true);
  });

  it('handleStartExport rejects when outDir IS source-images-dir even with overwrite=true (hard-reject)', async () => {
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/skel/images',
      true,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-out-dir');
    }
  });

  it('Round 3: parent-of-images outDir with NO existing /images/ subfolder is ALLOWED (no false-reject)', async () => {
    // Setup: outDir = /tmp/parent. No source/output collision (the row's
    // source is at /elsewhere/CIRCLE.png; the resolved output is
    // /tmp/parent/images/CIRCLE.png). Mocked fs.access defaults to
    // ENOENT for the existence probe (the /tmp/parent/images/ subfolder
    // does not yet exist). Round-2 would have rejected for folder-position
    // alone; Round 3 must permit this case.
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/elsewhere/images/CIRCLE.png',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/tmp/parent',
    );
    expect(result.ok).toBe(true);
  });

  it('handleProbeExportConflicts hard-rejects when outDir IS source-images-dir', async () => {
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleProbeExportConflicts(plan, '/skel/images');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-out-dir');
    }
  });

  /**
   * Phase 6 REVIEW M-01 (2026-04-25) regression-lock — `lastIndexOf('/images/')`
   * parity with src/core/export.ts:117 + src/renderer/src/lib/export-view.ts:98.
   *
   * User-confirmed edge: skeleton lives under a directory itself named
   * `images`, e.g. `~/work/images/joker_project/skel.json`. The loader
   * builds sourcePath as `~/work/images/joker_project/images/CIRCLE.png`.
   *
   * Pre-fix (`indexOf`) wrongly derived sourceImagesDir as `~/work/images`
   * — so picking `~/work/images/joker_project/images` as outDir (the
   * actual source-images folder) DID NOT trigger the invalid-out-dir
   * hard-reject (the comparison `~/work/images/joker_project/images` !=
   * `~/work/images` passed). Worse, picking `~/work/images` itself
   * false-positived as "outDir IS source-images-dir".
   *
   * Post-fix (`lastIndexOf`) the derivation lands on the inner `/images/`
   * — the actual source-images folder — and the hard-reject fires when
   * the user genuinely points outDir at it.
   */
  it('M-01: lastIndexOf parity — parent dir named "images" no longer false-positives the hard-reject', async () => {
    const plan: ExportPlan = {
      rows: [
        {
          // Parent layout: /Users/me/work/images/proj/images/CIRCLE.png.
          // The OUTER /images/ is part of the user's working layout; the
          // INNER /images/ is the source-images folder we care about.
          sourcePath: '/Users/me/work/images/proj/images/CIRCLE.png',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };

    // Picking the OUTER /Users/me/work/images as outDir must NOT trigger
    // the invalid-out-dir hard-reject — that folder is NOT the
    // source-images dir under the lastIndexOf parsing. (Existence probe
    // mocked to ENOENT by default, so the export proceeds.)
    const outerResult = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/Users/me/work/images',
    );
    expect(outerResult.ok).toBe(true);

    // Picking the INNER /Users/me/work/images/proj/images as outDir IS
    // the genuine source-images folder — the hard-reject MUST fire.
    const innerResult = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      plan,
      '/Users/me/work/images/proj/images',
    );
    expect(innerResult.ok).toBe(false);
    if (!innerResult.ok) {
      expect(innerResult.error.kind).toBe('invalid-out-dir');
    }

    // Same parity check via handleProbeExportConflicts — both call sites
    // were patched together in M-01 to keep the probe + start branches
    // consistent.
    const probeOuter = await handleProbeExportConflicts(plan, '/Users/me/work/images');
    expect(probeOuter.ok).toBe(true);

    const probeInner = await handleProbeExportConflicts(plan, '/Users/me/work/images/proj/images');
    expect(probeInner.ok).toBe(false);
    if (!probeInner.ok) {
      expect(probeInner.error.kind).toBe('invalid-out-dir');
    }
  });

  it('Round 4: conflicts are F_OK-gated, not string-match (parent-of-images outDir is OK when images/ subfolder is empty)', async () => {
    // Regression-lock for the Girl atlas-only project bug: even when
    // row.sourcePath strings match resolved outputs verbatim, no actual
    // file existing on disk means no collision. Pre-Round-4 the
    // synchronous string-match check would have rejected here; post-Round-4
    // the F_OK probe finds nothing (mock rejects with ENOENT), so
    // probeExportConflicts returns an empty list.
    const fsPromises = await import('node:fs/promises');
    vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

    const plan: ExportPlan = {
      rows: [
        {
          // sourcePath string would match resolvedOut (/skel/images/CIRCLE.png)
          // under the OLD round-3 contract — we rely on F_OK-only now.
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    // outDir = /skel = parent of source-images. PRE-Round-4 the string
    // match would have rejected this; POST-Round-4 the F_OK probe finds
    // nothing on disk, so probeExportConflicts returns empty.
    const probe = await handleProbeExportConflicts(plan, '/skel');
    expect(probe.ok).toBe(true);
    if (probe.ok) {
      expect(probe.conflicts).toEqual([]);
    }
  });

  /**
   * UAT Round 3 (2026-05-15) — atlas-mode probe targets `{projectName}.png`
   * + `{projectName}_<N>.png` + `{projectName}.atlas` at outDir root.
   * Pre-Round-3 the probe was loose-only blind: re-running an atlas export
   * against an outDir already containing those files skipped the
   * ConflictDialog and tripped runRepack's existence check at write time.
   *
   * projectName is derived from the JSON / first-row sourcePath basename
   * (per `src/main/atlas-paths.ts:deriveProjectName`, precedence
   * inverted 2026-05-15 — see debug session `atlas-repack-output-bugs`).
   * These tests use sourcePath=`/proj/test_repack.json` so the derived
   * projectName is `test_repack`, matching the canonical sentinels
   * /tmp/test_repack/test_repack.png + .atlas at outDir root.
   * Additional pages (2, 3, ...) are discovered via readdir.
   */
  it('UAT Round 3 (atlas mode): surfaces {projectName}.png + .atlas at outDir root', async () => {
    const fsPromises = await import('node:fs/promises');
    // Atlas mode: only the outDir-root atlas targets exist on disk; the
    // per-row loose paths are NOT probed in atlas-only mode, so they
    // never need to be mocked.
    //
    // The probe checks 3 paths (page 0 PNG + atlas text + per-row loose,
    // but per-row is skipped in atlas mode). Use a default impl that
    // resolves for atlas sentinels and rejects for anything else.
    vi.mocked(fsPromises.access).mockImplementation(async (p: unknown) => {
      const pathStr = typeof p === 'string' ? p : String(p);
      if (
        pathStr.endsWith('test_repack/test_repack.png') ||
        pathStr.endsWith('test_repack/test_repack.atlas')
      ) {
        return undefined as unknown as void;
      }
      throw new Error('ENOENT');
    });

    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/test_repack.json',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const result = await handleProbeExportConflicts(
      plan,
      '/tmp/test_repack',
      'atlas',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Both atlas-mode sentinels appear in the conflicts list.
      expect(result.conflicts).toEqual(
        expect.arrayContaining([
          expect.stringContaining('test_repack.png'),
          expect.stringContaining('test_repack.atlas'),
        ]),
      );
      // Loose-mode per-row paths must NOT appear (atlas-only mode).
      expect(
        result.conflicts.some((c) => c.endsWith('images/CIRCLE.png')),
      ).toBe(false);
    }
  });

  it('UAT Round 3 (atlas mode): discovers multi-page {projectName}_<N>.png via readdir', async () => {
    const fsPromises = await import('node:fs/promises');
    // Atlas page 0 sentinel + 2 multi-page entries on disk.
    vi.mocked(fsPromises.access).mockImplementation(async (p: unknown) => {
      const pathStr = typeof p === 'string' ? p : String(p);
      if (pathStr.endsWith('test_repack.png')) {
        return undefined as unknown as void;
      }
      // .atlas not present in this test — exercise the partial-collision case.
      throw new Error('ENOENT');
    });
    // readdir returns page 2 + page 3 entries, plus an unrelated file
    // (skipped — does not match the {projectName}_<N>.png pattern).
    vi.mocked(fsPromises.readdir).mockResolvedValueOnce([
      'test_repack.png',
      'test_repack_2.png',
      'test_repack_3.png',
      'README.txt',
      'other_project_5.png',
    ] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);

    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/test_repack.json',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const result = await handleProbeExportConflicts(
      plan,
      '/tmp/test_repack',
      'atlas',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // page 0 + page 2 + page 3 surfaced; unrelated files filtered out.
      expect(result.conflicts.some((c) => c.endsWith('test_repack.png'))).toBe(true);
      expect(result.conflicts.some((c) => c.endsWith('test_repack_2.png'))).toBe(true);
      expect(result.conflicts.some((c) => c.endsWith('test_repack_3.png'))).toBe(true);
      // Unrelated multi-page file under a different basename MUST NOT match.
      expect(result.conflicts.some((c) => c.endsWith('other_project_5.png'))).toBe(false);
      // Non-PNG file MUST NOT match.
      expect(result.conflicts.some((c) => c.endsWith('README.txt'))).toBe(false);
    }
  });

  it('UAT Round 3 (loose mode): atlas-root sentinels NOT surfaced when outputMode=loose', async () => {
    const fsPromises = await import('node:fs/promises');
    // Pretend BOTH the atlas sentinels exist on disk, but outputMode=loose.
    // The probe must skip atlas-mode derivation entirely; loose-mode per-row
    // paths under outDir/images/ are the only thing checked.
    vi.mocked(fsPromises.access).mockImplementation(async (p: unknown) => {
      const pathStr = typeof p === 'string' ? p : String(p);
      if (
        pathStr.endsWith('test_repack/test_repack.png') ||
        pathStr.endsWith('test_repack/test_repack.atlas')
      ) {
        return undefined as unknown as void;
      }
      // Per-row loose path does not exist → no conflict.
      throw new Error('ENOENT');
    });
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/test_repack.json',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const result = await handleProbeExportConflicts(
      plan,
      '/tmp/test_repack',
      'loose',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Atlas sentinels MUST NOT appear in loose-mode probe.
      expect(
        result.conflicts.some(
          (c) => c.endsWith('test_repack.png') || c.endsWith('test_repack.atlas'),
        ),
      ).toBe(false);
      expect(result.conflicts).toEqual([]);
    }
  });

  it('UAT Round 3 (both mode): surfaces atlas sentinels AND loose per-row collisions', async () => {
    const fsPromises = await import('node:fs/promises');
    // BOTH the atlas sentinels AND the loose per-row path exist on disk.
    vi.mocked(fsPromises.access).mockImplementation(async (p: unknown) => {
      const pathStr = typeof p === 'string' ? p : String(p);
      if (
        pathStr.endsWith('test_repack/test_repack.png') ||
        pathStr.endsWith('test_repack/test_repack.atlas') ||
        pathStr.endsWith('test_repack/images/CIRCLE.png')
      ) {
        return undefined as unknown as void;
      }
      throw new Error('ENOENT');
    });
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/test_repack.json',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const result = await handleProbeExportConflicts(
      plan,
      '/tmp/test_repack',
      'both',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // All three present.
      expect(result.conflicts.some((c) => c.endsWith('test_repack.png'))).toBe(true);
      expect(result.conflicts.some((c) => c.endsWith('test_repack.atlas'))).toBe(true);
      expect(result.conflicts.some((c) => c.endsWith('images/CIRCLE.png'))).toBe(
        true,
      );
    }
  });

  it('UAT Round 3 (atlas mode): empty outDir → empty conflicts (no false positives)', async () => {
    // Default access mock rejects with ENOENT; default readdir resolves
    // to []. No conflicts should surface.
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: '/proj/test_repack.json',
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
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const result = await handleProbeExportConflicts(
      plan,
      '/tmp/test_repack',
      'atlas',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conflicts).toEqual([]);
    }
  });
});

/**
 * Phase 40 REPACK-01 + REPACK-10 — IPC dispatch + atomic rollback.
 *
 * These tests gate the `outputMode` + `atlasOpts` extension to
 * `export:start` (Plan 06):
 *   - validateExportOpts rejects all 4 malformed input shapes.
 *   - handleStartExport dispatches to runExport / runRepack / both based
 *     on outputMode, and the shared writtenPaths Set drives a finally-
 *     block fs.rm sweep on ANY throw.
 *   - The locked REPACK-10 error string ("...exceeds the page-size cap...")
 *     is propagated through the IPC envelope and the rollback sweep
 *     removes every recorded artifact path (atomic-or-fail acceptance b).
 *
 * Test mocking strategy: runExport + runRepack are mocked at the top of
 * the file (factory defaults: both resolve with empty success shapes).
 * Individual tests override with mockImplementationOnce / mockRejectedValueOnce
 * to drive dispatch and throw scenarios; the runRepack mock can also
 * mutate the writtenPaths Set argument before throwing so the rollback
 * sweep assertion has paths to find. All assertions are against the IPC
 * envelope shape + the mock spy call lists — NO real disk I/O.
 */
describe('handleStartExport — Phase 40 REPACK-01 outputMode dispatch + validator rejection', () => {
  it('REPACK-01 validator: rejects malformed outputMode with kind=Unknown + "outputMode is not" message', async () => {
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'rgba' as unknown as 'loose',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toMatch(/outputMode is not/);
    }
  });

  it('REPACK-01 validator: rejects malformed atlasOpts.maxPageSize (e.g. 3000) with kind=Unknown', async () => {
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      { maxPageSize: 3000 as unknown as 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toMatch(/atlasOpts\.maxPageSize/);
    }
  });

  it('REPACK-01 validator: rejects non-boolean atlasOpts.allowRotation', async () => {
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      { maxPageSize: 4096, allowRotation: 'yes' as unknown as boolean, padding: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toMatch(/atlasOpts\.allowRotation/);
    }
  });

  it('REPACK-01 validator: rejects atlasOpts.padding out of [0, 16] range (e.g. 99)', async () => {
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      { maxPageSize: 4096, allowRotation: false, padding: 99 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toMatch(/atlasOpts\.padding/);
    }
  });

  it('REPACK-01 loose mode (default): calls runExport only; runRepack is NOT invoked', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    const repackWorker = await import('../../src/main/repack-worker.js');
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'loose',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    expect(vi.mocked(imageWorker.runExport)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repackWorker.runRepack)).not.toHaveBeenCalled();
  });

  it('REPACK-01 loose mode passes the shared writtenPaths Set as 7th arg to runExport', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'loose',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    // 7th positional arg (index 6) is the shared writtenPaths accumulator.
    const callArgs = vi.mocked(imageWorker.runExport).mock.calls[0];
    expect(callArgs.length).toBeGreaterThanOrEqual(7);
    expect(callArgs[6]).toBeInstanceOf(Set);
  });

  it('REPACK-01 atlas mode: calls runRepack only; runExport is NOT invoked', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    const repackWorker = await import('../../src/main/repack-worker.js');
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    expect(vi.mocked(repackWorker.runRepack)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(imageWorker.runExport)).not.toHaveBeenCalled();
  });

  it('REPACK-01 atlas mode forwards atlasOpts to runRepack as 7th positional arg', async () => {
    const repackWorker = await import('../../src/main/repack-worker.js');
    const opts = { maxPageSize: 2048 as const, allowRotation: true, padding: 4 };
    await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      opts,
    );
    const callArgs = vi.mocked(repackWorker.runRepack).mock.calls[0];
    // runRepack signature: (plan, outDir, onProgress, isCancelled, allowOverwrite, sharpenEnabled, atlasOpts, writtenPaths)
    expect(callArgs[6]).toEqual(opts);
    expect(callArgs[7]).toBeInstanceOf(Set);
  });

  it('REPACK-01 both mode: calls runExport THEN runRepack (sharing one writtenPaths Set)', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    const repackWorker = await import('../../src/main/repack-worker.js');
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'both',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    expect(vi.mocked(imageWorker.runExport)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repackWorker.runRepack)).toHaveBeenCalledTimes(1);
    // The shared rollback Set is the LAST positional arg of runExport (index 6)
    // and the LAST positional arg of runRepack (index 7). Both must be the
    // SAME object reference (`===`) so a runRepack throw can sweep paths
    // registered by runExport.
    const exportSet = vi.mocked(imageWorker.runExport).mock.calls[0][6];
    const repackSet = vi.mocked(repackWorker.runRepack).mock.calls[0][7];
    expect(exportSet).toBe(repackSet);
    expect(exportSet).toBeInstanceOf(Set);
  });

  it('REPACK-10 atomic rollback: runRepack throws the locked "exceeds the page-size cap" error → fs.rm sweep called for every registered path', async () => {
    const repackWorker = await import('../../src/main/repack-worker.js');
    const fsPromises = await import('node:fs/promises');

    // Rig runRepack to register some paths in writtenPaths and then throw
    // the locked REPACK-10 error string. Simulates the mid-pipeline failure
    // covered by repack-worker.spec.ts "oversize abort: throws locked error
    // string and writes no files" — but at the IPC seam.
    const LOCKED_ERROR =
      'Region HUGE is 1500×1500 px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override.';
    vi.mocked(repackWorker.runRepack).mockImplementationOnce(
      async (_plan, _out, _onP, _isC, _aOw, _sharp, _aOpts, writtenPaths) => {
        writtenPaths.add('/tmp/out/SIMPLE_TEST.png.tmp');
        writtenPaths.add('/tmp/out/SIMPLE_TEST.png');
        writtenPaths.add('/tmp/out/SIMPLE_TEST.atlas.tmp');
        writtenPaths.add('/tmp/out/SIMPLE_TEST.atlas');
        throw new Error(LOCKED_ERROR);
      },
    );

    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      { maxPageSize: 1024, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The outer catch wraps with kind='Unknown'; the message carries the
      // locked REPACK-10 error string verbatim.
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toContain('exceeds the page-size cap');
    }
    // The rollback sweep must have called fs.rm with { force: true } for
    // EVERY path the worker registered (atomic-or-fail acceptance b).
    const rmCalls = vi.mocked(fsPromises.rm).mock.calls;
    const rmPaths = rmCalls.map((c) => c[0]);
    expect(rmPaths).toContain('/tmp/out/SIMPLE_TEST.png.tmp');
    expect(rmPaths).toContain('/tmp/out/SIMPLE_TEST.png');
    expect(rmPaths).toContain('/tmp/out/SIMPLE_TEST.atlas.tmp');
    expect(rmPaths).toContain('/tmp/out/SIMPLE_TEST.atlas');
    // Every rm call must pass { force: true } so ENOENT is swallowed
    // (paths whose tmp landed but final never did, and vice-versa).
    for (const c of rmCalls) {
      expect(c[1]).toEqual({ force: true });
    }
  });

  it('REPACK-10 both mode rollback: runExport-registered loose paths AND runRepack-registered atlas paths swept together', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    const repackWorker = await import('../../src/main/repack-worker.js');
    const fsPromises = await import('node:fs/promises');

    // Rig runExport to register a loose-mode path then succeed; rig
    // runRepack to register atlas paths and throw. The inner catch must
    // sweep ALL paths — loose AND atlas — because they share one Set.
    vi.mocked(imageWorker.runExport).mockImplementationOnce(
      async (_plan, _out, _onP, _isC, _aOw, _sharp, writtenPaths) => {
        if (writtenPaths) {
          writtenPaths.add('/tmp/out/images/OK.png.tmp');
          writtenPaths.add('/tmp/out/images/OK.png');
        }
        return {
          successes: 1,
          errors: [],
          outputDir: '/tmp/out',
          durationMs: 1,
          cancelled: false,
        };
      },
    );
    vi.mocked(repackWorker.runRepack).mockImplementationOnce(
      async (_plan, _out, _onP, _isC, _aOw, _sharp, _aOpts, writtenPaths) => {
        writtenPaths.add('/tmp/out/SIMPLE_TEST.png.tmp');
        writtenPaths.add('/tmp/out/SIMPLE_TEST.png');
        throw new Error(
          'Region HUGE is 1500×1500 px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override.',
        );
      },
    );

    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'both',
      { maxPageSize: 1024, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(false);
    // Sweep must include BOTH the loose path (registered by runExport) AND
    // the atlas page path (registered by runRepack) — proves the shared
    // Set drives a unified rollback (REPACK-10 acceptance b end-to-end).
    const rmPaths = vi.mocked(fsPromises.rm).mock.calls.map((c) => c[0]);
    expect(rmPaths).toContain('/tmp/out/images/OK.png.tmp');
    expect(rmPaths).toContain('/tmp/out/images/OK.png');
    expect(rmPaths).toContain('/tmp/out/SIMPLE_TEST.png.tmp');
    expect(rmPaths).toContain('/tmp/out/SIMPLE_TEST.png');
  });
});

/**
 * UAT bug 3 (2026-05-15) — atlas-mode "0 of N succeeded" regression-lock.
 *
 * Pre-fix: handleStartExport synthesized `{ successes: 0, ... }` for
 * outputMode === 'atlas' because runRepack returned only file paths.
 * Renderer's progress card read literally "0 of 160 succeeded" despite
 * files being written.
 *
 * Post-fix: runRepack returns a real ExportSummary that the IPC handler
 * uses directly for atlas mode and MERGES with runExport's summary for
 * both mode (sum successes; concat errors; outputDir same; durationMs =
 * sum; cancelled = either).
 */
describe('handleStartExport — UAT bug 3: atlas-mode + both-mode return real summaries', () => {
  it('atlas mode: returned summary.successes equals runRepack mock successes (NOT 0)', async () => {
    const repackWorker = await import('../../src/main/repack-worker.js');
    vi.mocked(repackWorker.runRepack).mockResolvedValueOnce({
      pageFiles: ['/tmp/out/project.png'],
      atlasFile: '/tmp/out/project.atlas',
      summary: {
        successes: 42,
        errors: [],
        outputDir: '/tmp/out',
        durationMs: 1234,
        cancelled: false,
      },
    });
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'atlas',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // CRITICAL: must be > 0 (the regression: was 0 pre-fix).
      expect(result.summary.successes).toBe(42);
      expect(result.summary.errors).toEqual([]);
      expect(result.summary.durationMs).toBe(1234);
      expect(result.summary.cancelled).toBe(false);
    }
  });

  it('both mode: merges runExport + runRepack summaries (sum successes; concat errors)', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    const repackWorker = await import('../../src/main/repack-worker.js');
    vi.mocked(imageWorker.runExport).mockResolvedValueOnce({
      successes: 10,
      errors: [
        { kind: 'sharp-error', path: '/tmp/out/images/X.png', message: 'broken' },
      ],
      outputDir: '/tmp/out',
      durationMs: 100,
      cancelled: false,
    });
    vi.mocked(repackWorker.runRepack).mockResolvedValueOnce({
      pageFiles: ['/tmp/out/project.png'],
      atlasFile: '/tmp/out/project.atlas',
      summary: {
        successes: 7,
        errors: [],
        outputDir: '/tmp/out',
        durationMs: 50,
        cancelled: false,
      },
    });
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'both',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // successes summed across both stages.
      expect(result.summary.successes).toBe(17);
      // errors concatenated (loose stage's error makes it through).
      expect(result.summary.errors).toHaveLength(1);
      expect(result.summary.errors[0].path).toBe('/tmp/out/images/X.png');
      // durationMs = sum of both stages.
      expect(result.summary.durationMs).toBe(150);
      // cancelled = OR of both stages (neither cancelled => false).
      expect(result.summary.cancelled).toBe(false);
      // outputDir identical (single export).
      expect(result.summary.outputDir).toBe('/tmp/out');
    }
  });

  it('both mode: cancelled flag is OR of both summaries', async () => {
    const imageWorker = await import('../../src/main/image-worker.js');
    const repackWorker = await import('../../src/main/repack-worker.js');
    vi.mocked(imageWorker.runExport).mockResolvedValueOnce({
      successes: 5,
      errors: [],
      outputDir: '/tmp/out',
      durationMs: 10,
      cancelled: false,
    });
    vi.mocked(repackWorker.runRepack).mockResolvedValueOnce({
      pageFiles: [],
      atlasFile: '/tmp/out/project.atlas',
      summary: {
        successes: 2,
        errors: [],
        outputDir: '/tmp/out',
        durationMs: 5,
        cancelled: true,
      },
    });
    const result = await handleStartExport(
      { sender: { send: vi.fn() } } as unknown as Electron.IpcMainInvokeEvent,
      buildEmptyPlan(),
      '/tmp/out',
      true,
      false,
      'both',
      { maxPageSize: 4096, allowRotation: false, padding: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.cancelled).toBe(true);
    }
  });
});
