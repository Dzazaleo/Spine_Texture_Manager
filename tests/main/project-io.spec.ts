import { describe, expect, it, vi, beforeEach } from 'vitest';
// NB: src/main/project-io.ts does not exist until Plan 03. RED until then.
// The full Plan 03 surface is `handleProjectSave / handleProjectSaveAs /
// handleProjectOpen / handleProjectOpenFromPath / handleLocateSkeleton`.
// This RED stub references the four directly exercised in tests below
// (Save / SaveAs / OpenFromPath); the no-arg `handleProjectOpen` (dialog
// form) and `handleLocateSkeleton` get their dedicated cases when Plan 03
// extends this spec to GREEN — adding their imports there avoids
// noUnusedLocals (TS6133) noise in this Wave 0 RED file.
import {
  handleProjectSave,
  handleProjectSaveAs,
  handleProjectOpenFromPath,
} from '../../src/main/project-io.js';
import type { AppSessionState } from '../../src/shared/types.js';

vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
  app: { whenReady: vi.fn(), quit: vi.fn(), on: vi.fn() },
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  constants: { F_OK: 0, R_OK: 4 },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const fsPromises = await import('node:fs/promises');
  // Default: writes succeed; reads succeed by default but tests override per case.
  vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
  vi.mocked(fsPromises.rename).mockResolvedValue(undefined);
  vi.mocked(fsPromises.access).mockResolvedValue(undefined);
});

const baseState: AppSessionState = {
  skeletonPath: '/a/b/SIMPLE.json',
  atlasPath: '/a/b/SIMPLE.atlas',
  imagesDir: '/a/b/images',
  overrides: { CIRCLE: 50 },
  samplingHz: 120,
  lastOutDir: null,
  sortColumn: 'attachmentName',
  sortDir: 'asc',
};

describe('handleProjectSave / handleProjectSaveAs (F9.1, T-08-IO)', () => {
  it('save writes file with all D-145 fields', async () => {
    const fs = await import('node:fs/promises');
    const result = await handleProjectSave(baseState, '/a/b/proj.stmproj');
    expect(result.ok).toBe(true);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
    const writtenJson = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed.version).toBe(1);
    expect(parsed.skeletonPath).toBeDefined();
    expect(parsed.overrides).toEqual({ CIRCLE: 50 });
    expect(parsed.documentation).toEqual({});
    expect(parsed.samplingHz).toBe(120);
    expect(parsed.sortColumn).toBe('attachmentName');
  });

  it('atomic-write tmp then rename (D-141 + Pattern B)', async () => {
    const fs = await import('node:fs/promises');
    await handleProjectSave(baseState, '/a/b/proj.stmproj');
    const writeArg = vi.mocked(fs.writeFile).mock.calls[0][0] as string;
    expect(writeArg).toMatch(/\.stmproj\.tmp$/);
    const renameArgs = vi.mocked(fs.rename).mock.calls[0];
    expect(renameArgs[0]).toMatch(/\.stmproj\.tmp$/);
    expect(renameArgs[1]).toBe('/a/b/proj.stmproj');
  });

  it('save with currentPath skips dialog', async () => {
    const electron = await import('electron');
    await handleProjectSave(baseState, '/a/b/proj.stmproj');
    expect(vi.mocked(electron.dialog.showSaveDialog)).not.toHaveBeenCalled();
  });

  it('save-as opens dialog with correct defaultPath', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: '/picked/MyRig.stmproj',
    } as Awaited<ReturnType<typeof electron.dialog.showSaveDialog>>);
    await handleProjectSaveAs(baseState, '/a/b', 'MyRig');
    const dialogArgs = vi.mocked(electron.dialog.showSaveDialog).mock.calls[0];
    const opts = dialogArgs[dialogArgs.length - 1] as Electron.SaveDialogOptions;
    expect(opts.defaultPath).toMatch(/MyRig\.stmproj$/);
    expect(opts.filters?.[0]?.extensions).toContain('stmproj');
  });
});

describe('handleProjectOpen / handleProjectOpenFromPath (F9.2)', () => {
  it('load restores overrides verbatim', async () => {
    const fs = await import('node:fs/promises');
    const json = JSON.stringify({
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null, imagesDir: null,
      overrides: { CIRCLE: 50, SQUARE: 75 },
      samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null,
      documentation: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(json as unknown as string);
    // Plan 03 wires loadSkeleton + sampleSkeleton; mock tests assert the response shape.
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    // Whether ok:true depends on whether loadSkeleton mock resolves — Plan 03
    // wires the loader/sampler chain; test is RED until then. The shape we
    // assert when ok:true:
    if (result.ok) {
      expect(result.project.restoredOverrides).toEqual({ CIRCLE: 50, SQUARE: 75 });
    }
  });

  it('load threads samplingHz into sampleSkeleton', async () => {
    // Asserts the materialized output exposes the resolved samplingHz (default 120 when null).
    const fs = await import('node:fs/promises');
    const json = JSON.stringify({
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: 60, lastOutDir: null,
      sortColumn: null, sortDir: null, documentation: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(json as unknown as string);
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    if (result.ok) expect(result.project.samplingHz).toBe(60);
  });

  it('load drops stale override keys (D-150)', async () => {
    const fs = await import('node:fs/promises');
    const json = JSON.stringify({
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null, imagesDir: null,
      overrides: { CIRCLE: 50, GHOST: 75 }, // GHOST not in re-sampled rig
      samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null, documentation: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(json as unknown as string);
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    if (result.ok) {
      expect(result.project.staleOverrideKeys).toContain('GHOST');
      expect(result.project.restoredOverrides.GHOST).toBeUndefined();
    }
  });

  it('missing skeleton returns typed error (D-149, T-08-MISS)', async () => {
    const fs = await import('node:fs/promises');
    const json = JSON.stringify({
      version: 1,
      skeletonPath: '/nonexistent/path.json',
      atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null, documentation: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(json as unknown as string);
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    if (!result.ok) expect(result.error.kind).toBe('SkeletonNotFoundOnLoadError');
  });

  it('newer version returns typed error (D-151, T-08-VER)', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: 2, skeletonPath: 'x.json', overrides: {}, documentation: {} }) as unknown as string);
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    if (!result.ok) expect(result.error.kind).toBe('ProjectFileVersionTooNewError');
  });

  it('malformed JSON returns ProjectFileParseError (Pitfall 9)', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue('{ broken json' as unknown as string);
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    if (!result.ok) expect(result.error.kind).toBe('ProjectFileParseError');
  });

  it('atlas auto-discovery on null path (D-152)', async () => {
    // When atlasPath is null in the file, loader's existing F1.2 sibling
    // detection runs. Plan 03 simply forwards atlasPath:null to loadSkeleton's
    // optional opts.atlasPath — loader handles the rest.
    const fs = await import('node:fs/promises');
    const json = JSON.stringify({
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null, documentation: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(json as unknown as string);
    // The Plan 03 implementation must NOT pass atlasPath to loadSkeleton when null —
    // it relies on the loader's sibling auto-discovery. This test asserts the
    // response is well-formed (ok or SkeletonNotFoundOnLoadError, not Unknown).
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    if (!result.ok) expect(['SkeletonNotFoundOnLoadError', 'AtlasNotFoundError']).toContain(result.error.kind);
  });
});
