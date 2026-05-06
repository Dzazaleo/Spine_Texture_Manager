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
import { DEFAULT_DOCUMENTATION } from '../../src/core/documentation.js';

// Phase 8.2 Plan 03 — extended electron mock to satisfy `src/main/recent.ts`'s
// module-load `app.getPath('userData')` call. Plan 03 wires addRecent into
// project-io.ts's Save As / Open success arms; recent.ts is therefore now
// transitively imported by this test file.
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    // Phase 21 Plan 21-12 G-04 — handleProjectResample calls
    // BrowserWindow.getAllWindows()[0]?.webContents at project-io.ts:937.
    // The G-04 IPC test invokes handleProjectResample directly; without
    // this mock field the call throws TypeError. Empty array → optional
    // chaining → null webContents (no-op for the bridge mock below).
    getAllWindows: vi.fn(() => []),
  },
  app: {
    whenReady: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp/userData'),
  },
}));

// Phase 21 Plan 21-12 G-04 — mock runSamplerInWorker so the IPC handler tests
// don't spawn a real worker thread. The mock returns a synthesized
// SamplerOutputShape with empty Maps; buildSummary still runs in-process
// against the real LoadResult (so summary.skippedAttachments reflects the
// loader's D-08 synthesis output). Module path verified via:
//   grep -n runSamplerInWorker src/main/project-io.ts
//   → import { runSamplerInWorker } from './sampler-worker-bridge.js'  (line 60)
vi.mock('../../src/main/sampler-worker-bridge.js', () => ({
  runSamplerInWorker: vi.fn().mockResolvedValue({
    type: 'complete',
    output: {
      globalPeaks: new Map(),
      perAnimation: new Map(),
      setupPosePeaks: new Map(),
    },
  }),
}));

// Phase 8.2 Plan 03 — recent.ts is transitively imported via project-io's new
// addRecent calls. Mock its public surface so success arms don't actually
// touch the filesystem (writeFile/rename are already mocked above, but that
// sidesteps the visibility — clearer to mock the module level so test
// failures point at the recent.ts contract, not raw fs calls).
vi.mock('../../src/main/recent.js', () => ({
  loadRecent: vi.fn().mockResolvedValue([]),
  addRecent: vi.fn().mockResolvedValue([]),
  clearRecent: vi.fn().mockResolvedValue(undefined),
}));

// Phase 8.2 Plan 03 — index.ts is dynamically imported from project-io's
// success arms (await import('./index.js') for applyMenu / getCurrentMenuState
// / getMainWindow). Mock the surface so test cases driving Save As / Open
// success don't trigger the real menu builder (which would also try to load
// recent.json + run electron.Menu.buildFromTemplate against the minimal mock).
vi.mock('../../src/main/index.js', () => ({
  applyMenu: vi.fn().mockResolvedValue(undefined),
  getCurrentMenuState: vi.fn(() => ({ canSave: false, canSaveAs: false, modalOpen: false })),
  getMainWindow: vi.fn(() => null),
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
  // Phase 20 D-01 — documentation slot now part of the editable session.
  documentation: DEFAULT_DOCUMENTATION,
  // Phase 21 D-08 — loaderMode default 'auto' (canonical mode); Task 4 wires
  // resampleProject + recovery paths to thread this field.
  loaderMode: 'auto',
  // Phase 28 D-06 — sharpenOnExport default false (off); Task 28-02 wires the
  // toggle into the export pipeline.
  sharpenOnExport: false,
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
    // Phase 20 D-01 — serializer now writes state.documentation (was empty {}).
    expect(parsed.documentation).toEqual(DEFAULT_DOCUMENTATION);
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

  it('8.1-IPC-01: missing skeleton threads recovery fields into envelope (D-158, D-159)', async () => {
    const fs = await import('node:fs/promises');
    const json = JSON.stringify({
      version: 1,
      skeletonPath: '/nonexistent/path.json',
      atlasPath: null, imagesDir: null,
      overrides: { CIRCLE: 50, TRIANGLE: 75 },
      samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null,
      documentation: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(json as unknown as string);
    const result = await handleProjectOpenFromPath('/a/b/proj.stmproj');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('SkeletonNotFoundOnLoadError');
      // The discriminated-union narrowing exposes the threaded fields.
      if (result.error.kind === 'SkeletonNotFoundOnLoadError') {
        expect(result.error.projectPath).toBe('/a/b/proj.stmproj');
        expect(result.error.originalSkeletonPath).toBe('/nonexistent/path.json');
        expect(result.error.mergedOverrides).toEqual({ CIRCLE: 50, TRIANGLE: 75 });
        expect(result.error.samplingHz).toBe(120); // D-146 default
        expect(result.error.lastOutDir).toBeNull();
        expect(result.error.sortColumn).toBeNull();
        expect(result.error.sortDir).toBeNull();
      }
    }
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

describe('Phase 21 G-04 — toggle-resample-into-atlas-less precedence (handleProjectResample)', () => {
  // Falsifying-regression gate for Plan 21-12 G-04. The HUMAN-UAT reproducer:
  // user starts on a canonical project (.atlas present), deletes a single PNG
  // from images/ folder, toggles "Use Images Folder as Source" ON. The resample
  // IPC payload carries BOTH atlasPath (from prior canonical state) AND
  // loaderMode='atlas-less'. PRE-FIX: the loader's branch order picks D-06
  // (canonical atlas wins), synthesis never runs, summary.skippedAttachments
  // is empty, MissingAttachmentsPanel doesn't surface the missing PNG.
  // POST-FIX: the new caller-side precedence rule at project-io.ts:874-876
  // omits atlasPath when loaderMode='atlas-less', the loader's D-08 synthesis
  // branch runs, summary.skippedAttachments is populated, the panel surfaces
  // the missing entry. This test asserts the POST-FIX shape; if a future
  // regression restores the pre-fix shape, this test fails immediately.
  //
  // ATLAS SYNTHESIS: the canonical .atlas at fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas
  // does NOT contain MESH_REGION (only CIRCLE/SQUARE/TRIANGLE). Pairing it with
  // the MeshOnly_TEST.json fixture would trigger the stock AtlasAttachmentLoader's
  // "Region not found in atlas: MESH_REGION" throw at the D-06 branch
  // (AtlasAttachmentLoader.js:62), causing result.ok === false and the test
  // would fail PRE-FIX for the WRONG reason (the throw, not the empty
  // skippedAttachments). To make the load-bearing assertion be the
  // skippedAttachments check, we synthesize an inline tmp .atlas containing
  // MESH_REGION with stub-region bounds (libgdx 4.2 grammar). This makes
  // D-06 SUCCEED both pre-fix and post-fix, so result.ok === true in both
  // states, and the FALSIFYING property reduces to skippedAttachments.length === 1.

  it('handleProjectResample with both atlasPath + loaderMode:"atlas-less" produces summary.skippedAttachments populated for missing PNG (G-04)', async () => {
    // Set up a tmpdir with a canonical-shape source: JSON + synthesized .atlas
    // (containing MESH_REGION) + images/ (with the PNG deliberately MISSING).
    // This mimics the user's filesystem state when they toggle "Use Images
    // Folder as Source" ON after deleting a PNG manually, BUT with a
    // synthesized atlas so D-06 doesn't throw.
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_NO_ATLAS_MESH = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-resample-g04-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_NO_ATLAS_MESH, 'MeshOnly_TEST.json'), tmpJson);
    // Synthesize a tmp .atlas containing MESH_REGION (libgdx 4.2 grammar).
    // This makes the D-06 read SUCCEED pre-fix (so result.ok === true and the
    // test's load-bearing assertion is on skippedAttachments.length, NOT on
    // result.ok).
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\n' +
      'size: 1,1\n' +
      'filter: Linear,Linear\n' +
      'MESH_REGION\n' +
      'bounds: 0,0,1,1\n',
      'utf8',
    );
    // Intentionally do NOT copy MESH_REGION.png — the missing-PNG case.

    try {
      // The mocks are set up via vi.mock at module-load time (see top of file
      // additions); per-test we just assert the result shape.
      const { handleProjectResample } = await import('../../src/main/project-io.js');
      const args = {
        skeletonPath: tmpJson,
        atlasPath: tmpAtlas,           // Pre-fix: this would WIN over loaderMode (D-06).
        samplingHz: 120,
        overrides: {},
        loaderMode: 'atlas-less',      // Post-fix: this WINS, atlasPath is omitted.
      };
      const result = await handleProjectResample(args);

      // Sanity: both pre-fix and post-fix have ok:true (synthesized atlas
      // makes D-06 succeed). The load-bearing falsifying property is the
      // skippedAttachments.length check below.
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true; got: ' + JSON.stringify(result.error));

      // FALSIFYING ASSERTION: pre-fix this is 0 (D-06 wins, synth never runs);
      // post-fix this is 1 (D-08 synthesis populates skippedAttachments).
      // OpenResponse shape (src/shared/types.ts:790-792) is
      // { ok: true; project: MaterializedProject }. MaterializedProject.summary
      // is the SkeletonSummary. Hence: result.project.summary.skippedAttachments
      // (NOT result.summary.skippedAttachments — that path doesn't exist on
      // the response shape).
      expect(result.project.summary.skippedAttachments.length).toBe(1);
      expect(result.project.summary.skippedAttachments[0].name).toBe('MESH_REGION');
      expect(
        result.project.summary.skippedAttachments[0].expectedPngPath.endsWith(
          path.join('images', 'MESH_REGION.png'),
        ),
      ).toBe(true);
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
