/**
 * Phase 41 Plan 01 (VIEWER-03) — Unit tests for the
 * `viewer:get-asset-feed` IPC handler in src/main/ipc.ts.
 *
 * Test surface mirrors the four-case behavior block of the plan:
 *   1. Non-string skeletonPath rejection (T-41-01 trust boundary).
 *   2. Non-.json extension rejection (T-41-01 defense-in-depth).
 *   3. Atlas-less success: synth atlas text + per-region path Record.
 *   4. Thrown error inside synthesizeAtlasText is caught and surfaced
 *      via the ok:false envelope (Electron IPC must not propagate
 *      exceptions across the boundary).
 *
 * Mock setup mirrors `tests/main/ipc.spec.ts` (hoisted Map-backed
 * `ipcMainHandleHandlers` captor + electron mock) so we can pull the
 * registered handler out and call it directly without round-tripping
 * through real Electron.
 *
 * synthesizeAtlasText is mocked via vi.hoisted + vi.mock so the test
 * doesn't need an on-disk atlas-less fixture; readFile is mocked so
 * the JSON parse step inside the handler resolves to whatever the
 * test wants without touching the filesystem.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Hoist-safe captors + mock impls. vi.mock() factories are hoisted ABOVE
// module-scope const/let, so any reference inside the factory must come
// from vi.hoisted (mirrors tests/main/ipc.spec.ts:22-37).
const {
  ipcMainHandleHandlers,
  ipcMainOnHandlers,
  synthesizeAtlasTextMock,
  readFileMock,
} = vi.hoisted(() => ({
  ipcMainHandleHandlers: new Map<
    string,
    (evt: unknown, ...args: unknown[]) => unknown
  >(),
  ipcMainOnHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => void>(),
  synthesizeAtlasTextMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock('electron', () => ({
  Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
  app: {
    getPath: vi.fn(() => '/tmp/userData'),
    isPackaged: false,
    on: vi.fn(),
    whenReady: vi.fn(() => ({ then: vi.fn() })),
    quit: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn(), openExternal: vi.fn() },
  ipcMain: {
    on: vi.fn((channel: string, handler: (evt: unknown, ...args: unknown[]) => void) => {
      ipcMainOnHandlers.set(channel, handler);
    }),
    handle: vi.fn((channel: string, handler: (evt: unknown, ...args: unknown[]) => unknown) => {
      ipcMainHandleHandlers.set(channel, handler);
    }),
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

// Mock the core synthesizer so tests don't need a real atlas-less fixture.
// Default behavior is a noop that returns a valid SynthResult shape; tests
// can override per-case via synthesizeAtlasTextMock.mockReturnValueOnce(...).
vi.mock('../../src/core/synthetic-atlas.js', () => ({
  synthesizeAtlasText: synthesizeAtlasTextMock,
}));

// node:fs/promises `readFile` is consumed inside the new handler. Mock so
// JSON.parse receives whatever the test feeds it (and so we never read disk).
// readFile is part of a destructured import block at src/main/ipc.ts:42-47;
// vi.mock on 'node:fs/promises' replaces the ENTIRE module surface, so the
// mock factory must re-export every name the rest of ipc.ts pulls in (access,
// constants, rm, readdir) to keep the rest of the module loading.
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  constants: {},
  rm: vi.fn(),
  readdir: vi.fn(),
  readFile: readFileMock,
}));

// Mock the noisy transitive imports from ipc.ts so registerIpcHandlers()
// is safe to call. We do not exercise these surfaces here.
vi.mock('../../src/main/recent.js', () => ({
  loadRecent: vi.fn().mockResolvedValue([]),
  addRecent: vi.fn(),
  clearRecent: vi.fn(),
}));
vi.mock('../../src/main/sampler-worker-bridge.js', () => ({
  getSamplerWorkerHandle: vi.fn(() => null),
  runSamplerInWorker: vi.fn(),
}));
vi.mock('../../src/core/loader.js', () => ({
  loadSkeleton: vi.fn(),
  createStubTextureLoader: vi.fn(),
  checkSpineVersion: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  ipcMainHandleHandlers.clear();
  ipcMainOnHandlers.clear();
  // Re-import ipc.js fresh so registerIpcHandlers re-runs against the cleared
  // captor maps. The await dynamic-import sidesteps Vitest's "module already
  // evaluated" caching that would otherwise skip the re-registration.
  const { registerIpcHandlers } = await import('../../src/main/ipc.js');
  registerIpcHandlers();
});

describe("Phase 41 — 'viewer:get-asset-feed' IPC handler", () => {
  it('rejects non-string skeletonPath with ok:false envelope (no throw, no fs read)', async () => {
    const handler = ipcMainHandleHandlers.get('viewer:get-asset-feed');
    expect(handler).toBeDefined();
    for (const bad of [null, undefined, 42, {}, [], true]) {
      const result = await handler!({}, bad);
      expect(result).toMatchObject({ ok: false });
      // Type-narrow for error inspection.
      if (typeof result === 'object' && result !== null && (result as { ok: boolean }).ok === false) {
        expect((result as { ok: false; error: { message: string } }).error.message).toBeTruthy();
      }
    }
    // No fs read happens before the type guard returns.
    expect(readFileMock).not.toHaveBeenCalled();
    expect(synthesizeAtlasTextMock).not.toHaveBeenCalled();
  });

  it('rejects non-.json paths with ok:false envelope (defense-in-depth)', async () => {
    const handler = ipcMainHandleHandlers.get('viewer:get-asset-feed');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/tmp/foo.txt');
    expect(result).toMatchObject({ ok: false });
    expect(
      (result as { ok: false; error: { message: string } }).error.message,
    ).toMatch(/\.json/);
    expect(readFileMock).not.toHaveBeenCalled();
    expect(synthesizeAtlasTextMock).not.toHaveBeenCalled();
  });

  it('atlas-less branch: returns base64-encoded synth atlas text + region paths Record', async () => {
    // Stub readFile to return a valid (minimal) skeleton JSON string.
    readFileMock.mockResolvedValueOnce(JSON.stringify({ skeleton: { spine: '4.2' } }));
    // Stub synthesizeAtlasText to return a deterministic SynthResult.
    synthesizeAtlasTextMock.mockReturnValueOnce({
      atlasText: 'foo\n',
      pngPathsByRegionName: new Map<string, string>([
        ['CIRCLE', '/fixtures/SIMPLE/images/CIRCLE.png'],
        ['SQUARE', '/fixtures/SIMPLE/images/SQUARE.png'],
      ]),
      dimsByRegionName: new Map(),
      missingPngs: [],
    });

    const handler = ipcMainHandleHandlers.get('viewer:get-asset-feed');
    expect(handler).toBeDefined();
    const result = await handler!({}, '/fixtures/SIMPLE/SIMPLE_TEST.json');

    expect(result).toMatchObject({ ok: true });
    if ((result as { ok: boolean }).ok === true) {
      const ok = result as {
        ok: true;
        atlasTextDataUri: string;
        regionPaths: Record<string, string>;
      };
      // Base64 of 'foo\n' is 'Zm9vCg=='.
      expect(ok.atlasTextDataUri).toBe('data:text/plain;base64,Zm9vCg==');
      // Plain object Record, NOT a Map (structuredClone-safe per Pitfall 3).
      expect(Object.prototype.toString.call(ok.regionPaths)).toBe('[object Object]');
      expect(ok.regionPaths['CIRCLE']).toBe('/fixtures/SIMPLE/images/CIRCLE.png');
      expect(ok.regionPaths['SQUARE']).toBe('/fixtures/SIMPLE/images/SQUARE.png');
    }

    // Synthesizer received the parsed JSON, imagesDir = <dirname>/images,
    // and the skeletonPath itself.
    expect(synthesizeAtlasTextMock).toHaveBeenCalledOnce();
    const [parsedJson, imagesDir, skeletonPath] =
      synthesizeAtlasTextMock.mock.calls[0]!;
    expect(parsedJson).toEqual({ skeleton: { spine: '4.2' } });
    // path.join normalizes separators; on POSIX this is `/fixtures/SIMPLE/images`.
    expect(imagesDir).toMatch(/[\\/]fixtures[\\/]SIMPLE[\\/]images$/);
    expect(skeletonPath).toBe('/fixtures/SIMPLE/SIMPLE_TEST.json');
  });

  it('catches thrown errors from synthesizeAtlasText and returns ok:false envelope (no IPC throw)', async () => {
    readFileMock.mockResolvedValueOnce('{}');
    synthesizeAtlasTextMock.mockImplementationOnce(() => {
      throw new Error('bang');
    });

    const handler = ipcMainHandleHandlers.get('viewer:get-asset-feed');
    expect(handler).toBeDefined();
    // Must NOT throw — the IPC boundary catches and wraps.
    const result = await handler!({}, '/fixtures/SIMPLE/SIMPLE_TEST.json');

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'Unknown', message: 'bang' },
    });
  });
});
