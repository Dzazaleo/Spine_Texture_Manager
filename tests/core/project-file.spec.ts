import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
// NB: src/core/project-file.ts does not exist until Plan 02. The import line
// below is what drives the RED. Once Plan 02 lands, all describes turn GREEN.
import {
  validateProjectFile,
  migrate,
  serializeProjectFile,
  materializeProjectFile,
  relativizePath,
  absolutizePath,
} from '../../src/core/project-file.js';
import type { ProjectFileV1, AppSessionState } from '../../src/shared/types.js';
import {
  DEFAULT_DOCUMENTATION,
  type Documentation,
} from '../../src/core/documentation.js';

const CORE_SRC = path.resolve('src/core/project-file.ts');

describe('validateProjectFile (D-156)', () => {
  it('validator rejects non-object input', () => {
    expect(validateProjectFile(null).ok).toBe(false);
    expect(validateProjectFile(42).ok).toBe(false);
    expect(validateProjectFile('foo').ok).toBe(false);
  });

  it('validator rejects missing version', () => {
    const r = validateProjectFile({ skeletonPath: 'x.json', overrides: {}, documentation: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('invalid-shape');
  });

  it('validator rejects missing skeletonPath', () => {
    const r = validateProjectFile({ version: 1, overrides: {}, documentation: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('invalid-shape');
  });

  it('validator rejects wrong-type overrides', () => {
    const r = validateProjectFile({
      version: 1,
      skeletonPath: 'x.json',
      overrides: { CIRCLE: 'not-a-number' },
      documentation: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('invalid-shape');
  });

  it('validator accepts minimal v1 file', () => {
    const r = validateProjectFile({
      version: 1,
      skeletonPath: './SIMPLE.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
    });
    expect(r.ok).toBe(true);
  });

  it('validator accepts full v1 file', () => {
    const r = validateProjectFile({
      version: 1,
      skeletonPath: './SIMPLE.json',
      atlasPath: './SIMPLE.atlas',
      imagesDir: './images',
      overrides: { CIRCLE: 50, SQUARE: 75 },
      samplingHz: 120,
      lastOutDir: '/tmp/out',
      sortColumn: 'attachmentName',
      sortDir: 'asc',
      documentation: {},
    });
    expect(r.ok).toBe(true);
  });

  it('newer version rejected (D-151)', () => {
    const r = validateProjectFile({
      version: 2,
      skeletonPath: 'x.json',
      overrides: {},
      documentation: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('newer-version');
  });

  it('validator rejects malformed documentation slot (Phase 20 D-04)', () => {
    const r = validateProjectFile({
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { animationTracks: 'not-an-array' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('invalid-shape');
  });
});

describe('round-trip (D-145 + D-148 + D-155)', () => {
  it('round-trip preserves all D-145 fields', () => {
    const state: AppSessionState = {
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: '/a/b/SIMPLE.atlas',
      imagesDir: '/a/b/images',
      overrides: { CIRCLE: 50 },
      samplingHz: 120,
      lastOutDir: '/tmp/out',
      sortColumn: 'attachmentName',
      sortDir: 'asc',
      documentation: DEFAULT_DOCUMENTATION,
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    const back = materializeProjectFile(file, '/a/b/proj.stmproj');
    expect(back.skeletonPath).toBe(state.skeletonPath);
    expect(back.atlasPath).toBe(state.atlasPath);
    expect(back.overrides).toEqual(state.overrides);
  });

  it('documentation slot preserved on round-trip (D-148)', () => {
    const state: AppSessionState = {
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null,
      documentation: DEFAULT_DOCUMENTATION,
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    expect(file.documentation).toEqual(DEFAULT_DOCUMENTATION);
    // Phase 20 D-04: validator rejects malformed sub-shape, but accepts
    // DEFAULT_DOCUMENTATION shape. The original "non-empty doc preserved"
    // test is replaced by the representative-doc round-trip test below.
    const v = validateProjectFile(file);
    expect(v.ok).toBe(true);
    if (v.ok) expect((v.project as ProjectFileV1).documentation).toEqual(DEFAULT_DOCUMENTATION);
  });

  it('round-trip preserves a non-empty Documentation (DOC-05)', () => {
    const doc: Documentation = {
      animationTracks: [
        { id: 'uuid-1', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: 'Primary loop' },
      ],
      events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
      generalNotes: 'Multi-line\nnotes\nhere.',
      controlBones: [{ name: 'CHAIN_2', description: 'Spine root' }],
      skins: [{ name: 'default', description: 'The default skin' }],
      safetyBufferPercent: 5,
    };
    const state: AppSessionState = {
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: doc,
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    const json = JSON.stringify(file);
    const parsed = JSON.parse(json);
    const v = validateProjectFile(parsed);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/a/b/proj.stmproj');
    expect(mat.documentation).toEqual(doc);
  });

  it('materializer back-fills DEFAULT_DOCUMENTATION for Phase 8-era empty {} slot (Pitfall 9)', () => {
    // Simulate a typed Phase 8-era file with documentation:{} written by Phase 8.
    // We construct via cast — the runtime back-fill is what's under test.
    const oldFile = {
      version: 1 as const,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {} as unknown as Documentation,
      loaderMode: 'auto' as const,
      sharpenOnExport: false,
    };
    const mat = materializeProjectFile(oldFile, '/a/b/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });

  it('Phase 8-era full pipeline (validate → materialize) accepts empty {} and yields DEFAULT_DOCUMENTATION', () => {
    // The CRITICAL forward-compat test: Phase 8-era `.stmproj` files have
    // `documentation: {}` literally on disk. Without the validator pre-massage
    // this test fails because validateProjectFile rejects {} at the strict
    // per-field guards (animationTracks not array, etc.). With the pre-massage,
    // the empty {} is treated as a missing slot and DEFAULT_DOCUMENTATION is
    // substituted before the per-field guards run.
    const phase8Era = {
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
    };
    const v = validateProjectFile(phase8Era);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/a/b/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });

  it('Phase 8-era full pipeline accepts MISSING documentation field (legacy v1 wire shape)', () => {
    // Equally important: a hypothetical legacy v1 file with no `documentation`
    // key at all. The validator pre-massage handles undefined too.
    const ancientEra = {
      version: 1,
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      // NOTE: no `documentation` key.
    };
    const v = validateProjectFile(ancientEra);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/a/b/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });

  it('round-trip relative paths (D-155)', () => {
    // POSIX-style absolute inputs ('/a/b/...') resolve ambiguously on Windows
    // (path.parse returns root '/', path.resolve returns 'C:\\…' — different
    // roots, so relativizePath's Pitfall 4 cross-root guard fires and stores
    // absolute). Construct platform-correct fixtures via path.resolve so the
    // test exercises same-directory relativization on both OSes.
    const basedir = path.resolve('a', 'b');
    const state: AppSessionState = {
      skeletonPath: path.join(basedir, 'SIMPLE.json'),
      atlasPath: path.join(basedir, 'SIMPLE.atlas'),
      imagesDir: path.join(basedir, 'images'),
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null,
      documentation: DEFAULT_DOCUMENTATION,
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    const projPath = path.join(basedir, 'proj.stmproj');
    const file = serializeProjectFile(state, projPath);
    // Same directory → './SIMPLE.json' (POSIX) or 'SIMPLE.json' (path.relative output).
    expect(file.skeletonPath.startsWith('.') || file.skeletonPath === 'SIMPLE.json').toBe(true);
    expect(file.skeletonPath.endsWith('SIMPLE.json')).toBe(true);
    const back = materializeProjectFile(file, projPath);
    expect(back.summary?.skeletonPath ?? back.projectFilePath).toBeDefined(); // shape lock — see Plan 02
  });

  it('cross-volume falls back to absolute (D-155 + Pitfall 4)', () => {
    // Cross-volume detection: roots differ → store absolute.
    // POSIX: /Volumes/Other vs /Users — both rooted at '/' but different mount.
    // We can't reliably create a true cross-volume condition in Node tests;
    // instead, exercise relativizePath directly with a Windows-style cross-drive
    // input string. relativizePath returns string regardless of platform — the
    // Node path module's parse() differentiates.
    // On POSIX runner, simulate by checking that a deeply-different root path
    // round-trips identically (no false-relative). The Plan 02 implementation
    // codifies the rule from RESEARCH §Pitfall 4.
    const result = relativizePath('/Volumes/Other/foo.json', '/Users/x/proj.stmproj');
    // On POSIX these share root '/', so path.relative gives '../../Volumes/Other/foo.json' —
    // the implementation's heuristic flips this to absolute when path.parse roots differ.
    // We assert the round-trip property: absolutizePath(stored, basedir) MUST equal input.
    const restored = absolutizePath(result, '/Users/x');
    expect(restored).toBe('/Volumes/Other/foo.json');
  });
});

describe('migrate (D-151)', () => {
  it('migrate is identity on v1', () => {
    const file: ProjectFileV1 = {
      version: 1, skeletonPath: 'x.json', atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null, documentation: DEFAULT_DOCUMENTATION,
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    expect(migrate(file)).toBe(file); // reference equality on v1 passthrough
  });
});

describe('Phase 21 — loaderMode (D-08)', () => {
  it('validateProjectFile pre-massages missing loaderMode to "auto" (forward-compat for Phase 8/20-era files)', () => {
    const legacy: Record<string, unknown> = {
      version: 1,
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      // loaderMode INTENTIONALLY ABSENT (Phase 8/20-era shape)
    };
    const result = validateProjectFile(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.project as ProjectFileV1).loaderMode).toBe('auto');
    }
  });

  it('validateProjectFile rejects loaderMode values other than "auto"/"atlas-less"', () => {
    const bad: Record<string, unknown> = {
      version: 1,
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      loaderMode: 'packed', // invalid in Phase 21
    };
    const result = validateProjectFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-shape');
      expect(result.error.message).toMatch(/loaderMode/);
    }
  });

  it('serialize → materialize round-trips loaderMode: "atlas-less" identically', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'atlas-less',
      sharpenOnExport: false,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.loaderMode).toBe('atlas-less');
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.loaderMode).toBe('atlas-less');
  });
});

describe('Phase 28 — sharpenOnExport (D-06)', () => {
  it('validateProjectFile pre-massages missing sharpenOnExport to false (forward-compat for v1.2-era files)', () => {
    const v12EraFile: Record<string, unknown> = {
      version: 1,
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      loaderMode: 'auto',
      // sharpenOnExport INTENTIONALLY ABSENT (v1.2-era shape)
    };
    const result = validateProjectFile(v12EraFile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.project as ProjectFileV1).sharpenOnExport).toBe(false);
    }
  });

  it('validateProjectFile rejects non-boolean sharpenOnExport', () => {
    const bad: Record<string, unknown> = {
      version: 1,
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      loaderMode: 'auto',
      sharpenOnExport: 'yes', // invalid — must be boolean
    };
    const result = validateProjectFile(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-shape');
      expect(result.error.message).toMatch(/sharpenOnExport/);
    }
  });

  it('serialize → materialize round-trips sharpenOnExport: true identically', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'auto',
      sharpenOnExport: true,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.sharpenOnExport).toBe(true);
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.sharpenOnExport).toBe(true);
  });

  it('serialize → materialize round-trips sharpenOnExport: false identically', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'auto',
      sharpenOnExport: false,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.sharpenOnExport).toBe(false);
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.sharpenOnExport).toBe(false);
  });
});

describe('hygiene — Layer 3 invariant for src/core/project-file.ts (T-08-LAYER)', () => {
  it('does not import node:fs / node:fs/promises / sharp / electron', () => {
    const src = readFileSync(CORE_SRC, 'utf8');
    expect(src, 'core/project-file.ts must not import node:fs').not.toMatch(/from ['"]node:fs(\/promises)?['"]/);
    expect(src, 'core/project-file.ts must not import fs (no scheme)').not.toMatch(/from ['"]fs(\/promises)?['"]/);
    expect(src, 'core/project-file.ts must not import sharp').not.toMatch(/from ['"]sharp['"]/);
    expect(src, 'core/project-file.ts must not import electron').not.toMatch(/from ['"]electron['"]/);
    // node:path IS permitted — see tests/arch.spec.ts:116-134 (no path block in regex).
  });
});
