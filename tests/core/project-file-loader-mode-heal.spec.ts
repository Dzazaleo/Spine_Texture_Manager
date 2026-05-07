/**
 * L3 heal — materializeProjectFile snaps an inconsistent
 * (loaderMode='atlas-less', atlasPath != null) pair to 'auto' on Open and
 * flags the heal so the renderer can surface a notice.
 *
 * Reproducing case: fixtures/Chicken/SYMBOLS.stmproj saved on Windows with
 * loaderMode='atlas-less' + atlasPath='SYMBOLS.atlas' + imagesDir=null.
 * No images/ folder beside the .json. Pre-heal the loader threw
 * MissingImagesDirError because handleProjectOpenFromPath drops atlasPath
 * when loaderMode is atlas-less, forcing synth.
 */
import { describe, expect, it } from 'vitest';
import {
  materializeProjectFile,
  validateProjectFile,
  type ProjectFileV1,
} from '../../src/core/project-file.js';

describe('materializeProjectFile — L3 loaderMode heal', () => {
  const baseFile: ProjectFileV1 = {
    version: 1,
    skeletonPath: 'SYMBOLS.json',
    atlasPath: null,
    imagesDir: null,
    overrides: {},
    samplingHz: 120,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: {
      animationTracks: [],
      events: [],
      controlBones: [],
      skins: [],
      generalNotes: '',
      safetyBufferPercent: 0,
    },
    loaderMode: 'auto',
    sharpenOnExport: false,
  };

  it('heals (atlas-less + atlasPath set) → auto, flags loaderModeHealed=true', () => {
    const file: ProjectFileV1 = {
      ...baseFile,
      atlasPath: 'SYMBOLS.atlas',
      loaderMode: 'atlas-less',
    };
    const m = materializeProjectFile(file, '/proj/SYMBOLS.stmproj');
    expect(m.loaderMode).toBe('auto');
    expect(m.loaderModeHealed).toBe(true);
    // atlasPath preserved (resolved against project basedir) so loader can use it.
    expect(m.atlasPath).toBe('/proj/SYMBOLS.atlas');
  });

  it('does not heal genuine atlas-less projects (atlasPath null)', () => {
    const file: ProjectFileV1 = {
      ...baseFile,
      atlasPath: null,
      loaderMode: 'atlas-less',
    };
    const m = materializeProjectFile(file, '/proj/SYMBOLS.stmproj');
    expect(m.loaderMode).toBe('atlas-less');
    expect(m.loaderModeHealed).toBeUndefined();
  });

  it('does not heal healthy auto+atlasPath projects', () => {
    const file: ProjectFileV1 = {
      ...baseFile,
      atlasPath: 'SYMBOLS.atlas',
      loaderMode: 'auto',
    };
    const m = materializeProjectFile(file, '/proj/SYMBOLS.stmproj');
    expect(m.loaderMode).toBe('auto');
    expect(m.loaderModeHealed).toBeUndefined();
  });

  it('does not heal auto+null projects (legacy + Phase-21 cold-load auto-discovery)', () => {
    const file: ProjectFileV1 = {
      ...baseFile,
      atlasPath: null,
      loaderMode: 'auto',
    };
    const m = materializeProjectFile(file, '/proj/SYMBOLS.stmproj');
    expect(m.loaderMode).toBe('auto');
    expect(m.loaderModeHealed).toBeUndefined();
  });

  it('end-to-end heal: validates+materializes the Chicken-shape .stmproj fixture', () => {
    const raw = {
      version: 1,
      skeletonPath: 'SYMBOLS.json',
      atlasPath: 'SYMBOLS.atlas',
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: 'attachmentName',
      sortDir: 'asc',
      loaderMode: 'atlas-less',
      sharpenOnExport: false,
    };
    const v = validateProjectFile(raw);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const m = materializeProjectFile(v.project, '/x/Chicken/SYMBOLS.stmproj');
    expect(m.loaderMode).toBe('auto');
    expect(m.loaderModeHealed).toBe(true);
    expect(m.atlasPath).toBe('/x/Chicken/SYMBOLS.atlas');
  });
});
