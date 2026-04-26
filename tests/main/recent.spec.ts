import { describe, expect, it, vi, beforeEach } from 'vitest';
// NB: src/main/recent.ts does not exist until Task 2 of Plan 08.2-01.
// This RED scaffold imports the planned public surface — `vitest run` is
// expected to fail with "Cannot find module '../../src/main/recent.js'"
// until Task 2 implements it.
import {
  loadRecent,
  addRecent,
  clearRecent,
  validateRecentFile,
} from '../../src/main/recent.js';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/tmp/userData' : '/tmp')),
  },
  // No dialog/Menu/BrowserWindow needed — recent.ts must not import them.
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

describe('loadRecent (D-177)', () => {
  it('(a) returns [] on missing file', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    expect(await loadRecent()).toEqual([]);
  });

  it('(b) returns [] on malformed JSON', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue('{ broken' as unknown as string);
    expect(await loadRecent()).toEqual([]);
  });

  it('(c) returns paths on valid v1 file', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: 1, paths: ['/a.stmproj', '/b.stmproj'] }) as unknown as string,
    );
    expect(await loadRecent()).toEqual(['/a.stmproj', '/b.stmproj']);
  });
});

describe('addRecent (D-178, D-180)', () => {
  it('(d) pushes to front + dedupes existing path', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: 1, paths: ['/a.stmproj', '/b.stmproj'] }) as unknown as string,
    );
    const result = await addRecent('/b.stmproj');
    expect(result).toEqual(['/b.stmproj', '/a.stmproj']); // b moved to front
  });

  it('(e) caps at 10 — oldest evicted', async () => {
    const fs = await import('node:fs/promises');
    const ten = Array.from({ length: 10 }, (_, i) => `/p${i}.stmproj`);
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: 1, paths: ten }) as unknown as string,
    );
    const result = await addRecent('/new.stmproj');
    expect(result.length).toBe(10);
    expect(result[0]).toBe('/new.stmproj');
    expect(result).not.toContain('/p9.stmproj'); // oldest dropped
  });

  it('(f) writes atomically — .tmp then rename', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    await addRecent('/x.stmproj');
    const writeArg = vi.mocked(fs.writeFile).mock.calls[0][0] as string;
    expect(writeArg).toMatch(/recent\.json\.tmp$/);
    const renameArgs = vi.mocked(fs.rename).mock.calls[0];
    expect(renameArgs[0]).toMatch(/recent\.json\.tmp$/);
    expect(renameArgs[1]).toMatch(/recent\.json$/);
  });
});

describe('clearRecent', () => {
  it('(g) writes { version: 1, paths: [] }', async () => {
    const fs = await import('node:fs/promises');
    await clearRecent();
    const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
    expect(written).toEqual({ version: 1, paths: [] });
  });
});

describe('validateRecentFile', () => {
  it('(h) rejects missing version / unknown version / non-array paths', () => {
    expect(validateRecentFile({}).ok).toBe(false); // missing version
    expect(validateRecentFile({ version: 2, paths: [] }).ok).toBe(false); // unknown
    expect(validateRecentFile({ version: 1, paths: 'oops' }).ok).toBe(false); // non-array
    expect(validateRecentFile({ version: 1, paths: [42] }).ok).toBe(false); // non-string el
    expect(validateRecentFile({ version: 1, paths: ['/a'] }).ok).toBe(true); // good
  });
});

describe('hygiene', () => {
  it('(i) no electron import in src/main/recent.ts body except `app`', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const text = require('node:fs').readFileSync('src/main/recent.ts', 'utf8');
    // Allow `import { app } from 'electron';` — reject any other named import.
    const electronImports = text.match(/import\s+\{([^}]+)\}\s+from\s+['"]electron['"]/);
    if (electronImports) {
      const names = electronImports[1].split(',').map((s: string) => s.trim());
      expect(names).toEqual(['app']);
    }
  });
});
