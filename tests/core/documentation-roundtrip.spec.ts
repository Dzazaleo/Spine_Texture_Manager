// Phase 20 Plan 04 — DOC-05 round-trip identity test.
//
// Proves a representative Documentation survives the full
// serialize → JSON.stringify → JSON.parse → validate → materialize chain
// bit-equal. Backstop for the documentation slot's persistence contract;
// pairs with tests/core/documentation.spec.ts (validator + drift unit
// tests) and tests/core/project-file.spec.ts (project-file shape tests).
//
// Three cases:
//   1. DEFAULT_DOCUMENTATION — the canonical empty-state shape.
//   2. Non-empty Documentation with all six top-level fields populated.
//   3. Phase 8-era empty {} slot — the materializer back-fills
//      DEFAULT_DOCUMENTATION as defence in depth (the validator pre-massage
//      handles this case at validation time; this test exercises the
//      materializer in isolation).

import { describe, it, expect } from 'vitest';
import {
  serializeProjectFile,
  validateProjectFile,
  materializeProjectFile,
} from '../../src/core/project-file.js';
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../src/core/documentation.js';
import type { AppSessionState } from '../../src/shared/types.js';

function makeBaseState(overrides: Partial<AppSessionState> = {}): AppSessionState {
  return {
    skeletonPath: '/tmp/SIMPLE.json',
    atlasPath: '/tmp/SIMPLE.atlas',
    imagesDir: null,
    overrides: {},
    samplingHz: null,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: DEFAULT_DOCUMENTATION,
    ...overrides,
  } as AppSessionState;
}

describe('documentation round-trip identity (DOC-05)', () => {
  it('DEFAULT_DOCUMENTATION survives serialize → JSON.parse → validate → materialize bit-equal', () => {
    const state = makeBaseState();
    const file = serializeProjectFile(state, '/tmp/proj.stmproj');
    const json = JSON.stringify(file);
    const parsed: unknown = JSON.parse(json);
    const v = validateProjectFile(parsed);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/tmp/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });

  it('non-empty Documentation survives bit-equal', () => {
    const doc: Documentation = {
      animationTracks: [
        { id: 'uuid-1', trackIndex: 0, animationName: 'PATH', mixTime: 0.25, loop: true, notes: 'Primary loop' },
        { id: 'uuid-2', trackIndex: 1, animationName: 'PATH', mixTime: 0.5, loop: false, notes: '' },
        { id: 'uuid-3', trackIndex: 1, animationName: 'walk', mixTime: 0.1, loop: true, notes: 'Multi-line\nnotes' },
      ],
      events: [
        { name: 'shoot', description: 'Fires when ammo expended' },
        { name: 'land', description: '' },
      ],
      generalNotes: 'Multi-line\nnotes\nwith\ttabs.',
      controlBones: [{ name: 'CHAIN_2', description: 'Spine root' }],
      skins: [
        { name: 'default', description: 'The default skin' },
        { name: 'gold', description: '' },
      ],
      safetyBufferPercent: 5,
    };
    const state = makeBaseState({ documentation: doc });
    const file = serializeProjectFile(state, '/tmp/proj.stmproj');
    const json = JSON.stringify(file);
    const parsed: unknown = JSON.parse(json);
    const v = validateProjectFile(parsed);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/tmp/proj.stmproj');
    expect(mat.documentation).toEqual(doc);
  });

  it('Phase 8-era empty {} slot back-fills DEFAULT_DOCUMENTATION on materialize (defence in depth)', () => {
    // Simulate an old .stmproj with documentation:{} written by Phase 8.
    // Per Plan 01 Task 2 Step A, the validator pre-massages empty {} to
    // DEFAULT_DOCUMENTATION before per-field guards run, so Phase 8-era
    // files pass validation. This test exercises the materializer's
    // defence-in-depth back-fill in isolation; the full-pipeline test
    // (validate → materialize) lives in tests/core/project-file.spec.ts
    // (`Phase 8-era full pipeline accepts empty {} ...`).
    const oldFile = {
      version: 1,
      skeletonPath: '/tmp/SIMPLE.json',
      atlasPath: '/tmp/SIMPLE.atlas',
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
    };
    const mat = materializeProjectFile(oldFile as never, '/tmp/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });
});
