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
    };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    expect(file.documentation).toEqual({});
    // And a non-empty doc must survive validate→materialize unchanged:
    const withDoc: ProjectFileV1 = { ...file, documentation: { nonEmpty: 'value' } };
    const v = validateProjectFile(withDoc);
    expect(v.ok).toBe(true);
    if (v.ok) expect((v.project as ProjectFileV1).documentation).toEqual({ nonEmpty: 'value' });
  });

  it('round-trip relative paths (D-155)', () => {
    const state: AppSessionState = {
      skeletonPath: '/a/b/SIMPLE.json',
      atlasPath: '/a/b/SIMPLE.atlas',
      imagesDir: '/a/b/images',
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null,
    };
    const file = serializeProjectFile(state, '/a/b/proj.stmproj');
    // Same directory → './SIMPLE.json'
    expect(file.skeletonPath.startsWith('.') || file.skeletonPath === 'SIMPLE.json').toBe(true);
    expect(file.skeletonPath.endsWith('SIMPLE.json')).toBe(true);
    const back = materializeProjectFile(file, '/a/b/proj.stmproj');
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
      sortColumn: null, sortDir: null, documentation: {},
    };
    expect(migrate(file)).toBe(file); // reference equality on v1 passthrough
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
