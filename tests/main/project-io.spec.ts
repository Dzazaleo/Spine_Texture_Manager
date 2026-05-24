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
  handleOpenDialog,
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
  // Phase 36 SEED-007 L-01 — atlas-less override bucket (sibling to overrides).
  overridesAtlasLess: {},
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
  // Phase 30 BUFFER-03 — safetyBufferPercent default 0 (off); Plan 30-02
  // wires the integer into the export pipeline.
  safetyBufferPercent: 0,
  // Phase 40 REPACK-07 — 4 additive atlas fields per CONTEXT D-01a..e.
  atlasOutputMode: 'loose',
  atlasMaxPageSize: 4096,
  atlasAllowRotation: false,
  atlasPadding: 2,
  // Phase 53 SCALEUI-03 — variant scale rows; default single 0.5 row.
  variantRows: [{ scale: 0.5 }],
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

  it('save writes variantRows (the scales) to disk (SC#1 save)', async () => {
    const fs = await import('node:fs/promises');
    const state: AppSessionState = {
      ...baseState,
      variantRows: [{ scale: 0.5 }, { scale: 0.36 }],
    };
    const result = await handleProjectSave(state, '/a/b/proj.stmproj');
    expect(result.ok).toBe(true);
    const writtenJson = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed.variantRows).toEqual([{ scale: 0.5 }, { scale: 0.36 }]);
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

describe('handleProjectOpenFromPath (F9.2)', () => {
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
        // Phase 36 D-12 — rename: mergedOverrides → mergedOverridesBuckets
        // carrying both atlas-source `overrides` and atlas-less `overridesAtlasLess`
        // sub-buckets. Legacy v1.4-shape fixture (no `overridesAtlasLess`)
        // pre-massages to `{}` via validator (project-file.ts:280).
        expect(result.error.mergedOverridesBuckets).toEqual({
          overrides: { CIRCLE: 50, TRIANGLE: 75 },
          overridesAtlasLess: {},
        });
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

// ---------------------------------------------------------------------------
// Phase 53 SCALEUI-03 — variantRows round-trip + SC#3 stale-dir + no-fs-check.
//
// These cases reach result.ok === true by pointing the loaded .stmproj at the
// REAL canonical fixture (fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json + .atlas),
// which the loader reads via the UNMOCKED node:fs (only node:fs/promises is
// mocked). The .stmproj JSON itself is fed through the mocked fs/promises
// readFile, mirroring the G-04 real-fixture pattern above.
// ---------------------------------------------------------------------------
describe('Phase 53 — variantRows + lastOutDir persistence (SCALEUI-03)', () => {
  it('load restores variantRows order-preserved (SC#1 load)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const skeletonPath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
    const atlasPath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas');
    const stmproj = JSON.stringify({
      version: 1,
      skeletonPath,
      atlasPath,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      variantRows: [{ scale: 0.5 }, { scale: 0.36 }],
    });
    vi.mocked(fs.readFile).mockResolvedValue(stmproj as unknown as string);
    const result = await handleProjectOpenFromPath(skeletonPath.replace(/\.json$/, '.stmproj'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.variantRows.map((r) => r.scale)).toEqual([0.5, 0.36]);
    }
  });

  it('old .stmproj with no variantRows opens clean with the default single 0.5 row (SC#2)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const skeletonPath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
    const atlasPath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas');
    const stmproj = JSON.stringify({
      version: 1,
      skeletonPath,
      atlasPath,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      // variantRows INTENTIONALLY ABSENT (pre-Phase-53 file)
    });
    vi.mocked(fs.readFile).mockResolvedValue(stmproj as unknown as string);
    const result = await handleProjectOpenFromPath(skeletonPath.replace(/\.json$/, '.stmproj'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.variantRows).toEqual([{ scale: 0.5 }]);
    }
  });

  it('a stale lastOutDir pointing nowhere never hard-fails the load; returned verbatim (SC#3)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const skeletonPath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
    const atlasPath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas');
    const staleDir = '/nope/does/not/exist';
    const stmproj = JSON.stringify({
      version: 1,
      skeletonPath,
      atlasPath,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: staleDir,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      variantRows: [{ scale: 0.5 }],
    });
    vi.mocked(fs.readFile).mockResolvedValue(stmproj as unknown as string);
    const result = await handleProjectOpenFromPath(skeletonPath.replace(/\.json$/, '.stmproj'));
    // SC#3: the load must succeed despite the stale output dir, and return it
    // verbatim (it is only a picker start hint; no fs check is performed on it).
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.lastOutDir).toBe(staleDir);
    }
  });

  it('no new fs existence check is keyed on lastOutDir / variantOutputDir (SC#3 / D-02 grep guard)', async () => {
    // NOTE: node:fs/promises is mocked module-wide; use the UNMOCKED node:fs
    // readFileSync to read the real source file as text. project-io.spec.ts is
    // a main-tier .ts test; reading the source is allowed (fs is permitted).
    // Strip comment lines so doc-comments mentioning these tokens don't
    // self-trip the guard.
    const fsRealSync = await import('node:fs');
    const path = await import('node:path');
    const src = fsRealSync.readFileSync(path.resolve('src/main/project-io.ts'), 'utf8');
    const codeLines = src
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
      })
      .join('\n');
    // Any existsSync/access/stat call on the same line as lastOutDir or
    // variantOutputDir would indicate a new fs existence check was added.
    const fsCheckOnOutDir = /(existsSync|\baccess\(|\bstat\()[^\n]*(lastOutDir|variantOutputDir)/;
    const outDirThenFsCheck = /(lastOutDir|variantOutputDir)[^\n]*(existsSync|\baccess\(|\bstat\()/;
    expect(fsCheckOnOutDir.test(codeLines)).toBe(false);
    expect(outDirThenFsCheck.test(codeLines)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 36 CR-01 — handleProjectResample bucket-routing regression test.
//
// FALSIFYING REGRESSION: pre-fix, handleProjectResample read the single
// `args.overrides` field as the atlas-source bucket unconditionally and
// dropped any `args.overridesAtlasLess` field on the floor. The renderer
// (which only sent the active bucket via `args.overrides`) would therefore
// get its atlas-less data routed into `restoredOverrides` and its
// `restoredOverridesAtlasLess` slot would always be empty — silently
// corrupting both buckets on every mode toggle.
//
// Post-fix: ResampleArgs carries BOTH buckets verbatim
// (`args.overrides` = atlas-source, `args.overridesAtlasLess` = atlas-less),
// and the handler runs per-bucket migration with bucket-name routing. The
// response's `restoredOverrides` carries the atlas-source bucket; the
// response's `restoredOverridesAtlasLess` carries the atlas-less bucket;
// `loaderMode` is NOT consulted for routing.
//
// The three test cases below cover both loaderMode values + the omitted-
// inactive-bucket back-compat shape. The pre-CR-01 handler would fail all
// three: it cross-pollinated the buckets on every call.
// ---------------------------------------------------------------------------

describe('Phase 36 CR-01 — handleProjectResample bucket routing (no cross-bucket leak)', () => {
  // Each test drives the REAL handleProjectResample handler (not the AppShell-
  // side stub from appshell-mode-switch-divergence.spec.tsx, which mirrors the
  // production contract but is decoupled from the actual main-process code).
  //
  // The test rig uses the same synthesized tmpdir fixture as the G-04 test
  // above so the loader/sampler chain succeeds — the falsifying assertion is
  // on the response buckets, not on summary contents.

  it('atlas-less mode: atlas-source bucket → restoredOverrides; atlas-less bucket → restoredOverridesAtlasLess (no leak)', async () => {
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_NO_ATLAS_MESH = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-resample-cr01-less-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_NO_ATLAS_MESH, 'MeshOnly_TEST.json'), tmpJson);
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\nsize: 1,1\nfilter: Linear,Linear\nMESH_REGION\nbounds: 0,0,1,1\n',
      'utf8',
    );
    try {
      const { handleProjectResample } = await import('../../src/main/project-io.js');
      const result = await handleProjectResample({
        skeletonPath: tmpJson,
        samplingHz: 120,
        // CR-01 fix — both buckets passed via the IPC payload. Atlas-source
        // bucket has SOURCE_KEY: 50; atlas-less bucket has LESS_KEY: 75.
        // Both names are "stale" relative to the fixture (no matching regions),
        // so both surface in staleOverrideKeys and BOTH restored buckets are
        // empty. The bucket-routing assertion is on the SHAPE of the response
        // fields, not on the restored values per se.
        overrides: { SOURCE_KEY: 50 },
        overridesAtlasLess: { LESS_KEY: 75 },
        loaderMode: 'atlas-less',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true');
      // Both buckets stale-dropped (no matching regions in fixture), so each
      // restored bucket is empty. The bucket-routing assertion is that neither
      // key crossed buckets in stale: SOURCE_KEY only appears once, LESS_KEY
      // only appears once, and they are not duplicated/swapped.
      expect(result.project.restoredOverrides).toEqual({});
      expect(result.project.restoredOverridesAtlasLess).toEqual({});
      // Pre-CR-01 the stale list would carry both keys but with bucket
      // contents cross-pollinated; post-fix both keys are in the union, but
      // each came from its own bucket-named field — not cross-routed.
      expect(result.project.staleOverrideKeys).toContain('SOURCE_KEY');
      expect(result.project.staleOverrideKeys).toContain('LESS_KEY');
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('auto/atlas-source mode: bucket routing is identical (loaderMode does NOT swap buckets)', async () => {
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_NO_ATLAS_MESH = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-resample-cr01-auto-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_NO_ATLAS_MESH, 'MeshOnly_TEST.json'), tmpJson);
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\nsize: 1,1\nfilter: Linear,Linear\nMESH_REGION\nbounds: 0,0,1,1\n',
      'utf8',
    );
    try {
      const { handleProjectResample } = await import('../../src/main/project-io.js');
      const result = await handleProjectResample({
        skeletonPath: tmpJson,
        atlasPath: tmpAtlas,
        samplingHz: 120,
        overrides: { SOURCE_KEY: 50 },
        overridesAtlasLess: { LESS_KEY: 75 },
        loaderMode: 'auto',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true');
      // Falsifying: the bucket-name → response-slot mapping does NOT depend
      // on loaderMode. The PRE-CR-01 handler would have produced different
      // shapes between 'atlas-less' and 'auto' modes because its routing was
      // loaderMode-driven.
      expect(result.project.restoredOverrides).toEqual({});
      expect(result.project.restoredOverridesAtlasLess).toEqual({});
      expect(result.project.staleOverrideKeys).toContain('SOURCE_KEY');
      expect(result.project.staleOverrideKeys).toContain('LESS_KEY');
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('back-compat: omitted overridesAtlasLess field defaults to {} (no crash, no leak)', async () => {
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_NO_ATLAS_MESH = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-resample-cr01-compat-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_NO_ATLAS_MESH, 'MeshOnly_TEST.json'), tmpJson);
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\nsize: 1,1\nfilter: Linear,Linear\nMESH_REGION\nbounds: 0,0,1,1\n',
      'utf8',
    );
    try {
      const { handleProjectResample } = await import('../../src/main/project-io.js');
      // Older renderer build: only sends `overrides`. Main must coerce missing
      // `overridesAtlasLess` to `{}` and produce an empty restored slot, not
      // throw.
      const result = await handleProjectResample({
        skeletonPath: tmpJson,
        atlasPath: tmpAtlas,
        samplingHz: 120,
        overrides: { SOURCE_KEY: 50 },
        loaderMode: 'auto',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true');
      expect(result.project.restoredOverrides).toEqual({});
      expect(result.project.restoredOverridesAtlasLess).toEqual({});
      expect(result.project.staleOverrideKeys).toContain('SOURCE_KEY');
      // No phantom LESS_KEY because the field was absent.
      expect(result.project.staleOverrideKeys).not.toContain('LESS_KEY');
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 34 Plan 01 Task 2 — handleOpenDialog (D-01 + D-02 + D-03).
// The unified picker accepts both .stmproj and .json; returns a 3-arm
// discriminated envelope. No load happens inside the handler.
// ---------------------------------------------------------------------------

describe('Phase 34 D-01/D-02/D-03 — handleOpenDialog (picker-only, three-arm envelope)', () => {
  it("opens picker with unified 'Spine Project or Skeleton' filter (stmproj + json)", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    await handleOpenDialog();
    const dialogArgs = vi.mocked(electron.dialog.showOpenDialog).mock.calls[0];
    const opts = dialogArgs[dialogArgs.length - 1] as Electron.OpenDialogOptions;
    expect(opts.title).toBe('Open Spine Project or Skeleton');
    expect(opts.filters?.[0]?.name).toBe('Spine Project or Skeleton');
    expect(opts.filters?.[0]?.extensions).toEqual(['stmproj', 'json']);
    // Phase 34 WR-03 — dontAddToRecent prevents Windows recent-docs pollution
    // (mirrors handlePickOutputDirectory at src/main/ipc.ts:497). macOS no-ops.
    expect(opts.properties).toEqual(['openFile', 'dontAddToRecent']);
  });

  it("cancel → { kind: 'cancelled' }", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it("empty filePaths → { kind: 'cancelled' } (defense-in-depth)", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it("picked .stmproj → { kind: 'project', path }", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/abs/path/to/MyRig.stmproj'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'project', path: '/abs/path/to/MyRig.stmproj' });
  });

  it("picked .json → { kind: 'skeleton', path }", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/abs/path/to/SKELETON.json'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'skeleton', path: '/abs/path/to/SKELETON.json' });
  });

  it("suffix match is case-insensitive (.STMPROJ → project; .JSON → skeleton)", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/abs/path/to/RIG.STMPROJ'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    let result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'project', path: '/abs/path/to/RIG.STMPROJ' });

    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/abs/path/to/SKEL.JSON'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'skeleton', path: '/abs/path/to/SKEL.JSON' });
  });

  it("unexpected suffix → { kind: 'project', path } (defense-in-depth fallthrough)", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/abs/path/to/weird.txt'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    // Defense-in-depth: defaults to 'project' so handleProjectOpenFromPath's
    // .stmproj validator surfaces the typed error envelope downstream.
    expect(result).toEqual({ kind: 'project', path: '/abs/path/to/weird.txt' });
  });
});

// ---------------------------------------------------------------------------
// Phase 34 Plan 03 Task 1 — handleOpenDialog OPEN-01..05 requirements coverage.
// These cases lock the OPEN-0x requirement names against the picker filter
// shape, dialog title, and three-arm envelope so the Phase 34 REQUIREMENTS
// table has grep-anchored regression evidence. Complements the Plan 01
// D-01/D-02/D-03 unit cases above (which assert the underlying implementation
// details) with the requirement-named gates.
// ---------------------------------------------------------------------------

describe('handleOpenDialog (Phase 34 D-01..D-03)', () => {
  it('34-OPEN-01: cancelled picker → { kind: "cancelled" }', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('34-OPEN-02: picked .stmproj → { kind: "project", path }', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a/b/MyRig.stmproj'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'project', path: '/a/b/MyRig.stmproj' });
  });

  it('34-OPEN-03: picked .json → { kind: "skeleton", path }', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a/b/SIMPLE_TEST.json'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'skeleton', path: '/a/b/SIMPLE_TEST.json' });
  });

  it('34-OPEN-04: defense-in-depth — unknown suffix routes to { kind: "project" } (downstream validator surfaces error)', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a/b/random.txt'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    // D-03 defense-in-depth: handleProjectOpenFromPath's endsWith('.stmproj')
    // validator surfaces the typed error envelope downstream. handleOpenDialog
    // itself is non-judgmental about the unexpected suffix (filter normally
    // prevents this; Windows file-name field paste is the residual vector).
    expect(result).toEqual({ kind: 'project', path: '/a/b/random.txt' });
  });

  it('34-OPEN-05: dialog filter is the unified [stmproj, json] entry + title is "Open Spine Project or Skeleton"', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    await handleOpenDialog();
    const dialogArgs = vi.mocked(electron.dialog.showOpenDialog).mock.calls[0];
    const opts = dialogArgs[dialogArgs.length - 1] as Electron.OpenDialogOptions;
    expect(opts.filters).toEqual([
      { name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] },
    ]);
    expect(opts.title).toBe('Open Spine Project or Skeleton');
  });
});

// ---------------------------------------------------------------------------
// Phase 34 CR-01 — case-insensitive suffix checks at the downstream load
// validators.
//
// Locks the picker contract end-to-end: handleOpenDialog routes uppercase
// `.STMPROJ` / `.JSON` correctly to { kind:'project'|'skeleton' }, but until
// CR-01 was fixed the downstream load handlers (handleProjectOpenFromPath /
// handleSkeletonLoad) rejected those same paths with the generic
// kind:'Unknown' envelope.
//
// macOS APFS / HFS+ case-insensitive volumes preserve the user's typed
// filename case verbatim, so a file named `MyRig.STMPROJ` opens normally
// from the OS picker. Windows file-name-field paste is the secondary
// residual vector (D-03 documents this as the rationale for the picker's
// defense-in-depth fallthrough). Both reach the validators.
//
// The fix is small: every `.endsWith('.stmproj')` / `.endsWith('.json')`
// check in src/main/project-io.ts + src/main/ipc.ts now lowercases first.
// ---------------------------------------------------------------------------

describe("Phase 34 CR-01 — case-insensitive suffix checks", () => {
  it("end-to-end: picker routes `MyRig.STMPROJ` to kind:'project' and handleProjectOpenFromPath does NOT reject at the validator", async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/abs/path/to/MyRig.STMPROJ'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);

    // Step 1: picker arm routes uppercase suffix to kind:'project'.
    const picker = await handleOpenDialog();
    expect(picker).toEqual({ kind: 'project', path: '/abs/path/to/MyRig.STMPROJ' });

    // Step 2: drive the picked path through handleProjectOpenFromPath. The
    // case-sensitive validator (pre-CR-01) would have produced
    // `{kind:'Unknown', message:'absolutePath must be a non-empty .stmproj path'}`.
    // Post-CR-01: the validator passes; the load progresses to file read.
    // The read fails (no fixture at that absolute path), surfacing a
    // ProjectFileNotFoundError envelope — NOT the validator's kind:'Unknown'
    // string.
    if (picker.kind !== 'project') throw new Error('Expected picker kind:project');
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
    );
    const result = await handleProjectOpenFromPath(picker.path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The load-bearing assertion. Pre-CR-01 the kind would be 'Unknown'
      // and the message would be the validator string; post-CR-01 the load
      // progresses past the validator and the read failure surfaces as
      // ProjectFileNotFoundError.
      expect(result.error.kind).toBe('ProjectFileNotFoundError');
      expect(result.error.message).not.toBe(
        'absolutePath must be a non-empty .stmproj path',
      );
    }
  });

  it("handleProjectOpenFromPath accepts uppercase `.STMPROJ` suffix at the validator (does NOT return the validator's kind:'Unknown' envelope)", async () => {
    // Direct unit assertion on the validator. Stub the file read to fail so
    // we don't run the loader/sampler chain. The check is whether the
    // validator path was bypassed.
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    const result = await handleProjectOpenFromPath('/abs/RIG.STMPROJ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Pre-CR-01: kind:'Unknown', message:'absolutePath must be a non-empty .stmproj path'
      // Post-CR-01: kind:'ProjectFileNotFoundError' (read failed).
      expect(result.error.kind).not.toBe('Unknown');
    }
  });

  it("handleProjectOpenFromPath rejects clearly bad input (empty string) — sanity check on the case-insensitive fix", async () => {
    // Negative: empty-string path still rejected. Confirms the fix did not
    // over-broaden the validator.
    const result = await handleProjectOpenFromPath('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toBe('absolutePath must be a non-empty .stmproj path');
    }
  });

  it("handleProjectOpenFromPath rejects non-.stmproj suffix (`/abs/wrong.txt`) — sanity check", async () => {
    const result = await handleProjectOpenFromPath('/abs/wrong.txt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Unknown');
      expect(result.error.message).toBe('absolutePath must be a non-empty .stmproj path');
    }
  });
});
