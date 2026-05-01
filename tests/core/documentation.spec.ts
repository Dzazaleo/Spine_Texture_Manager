/**
 * Phase 20 Plan 01 Task 1 — Validator + drift-policy unit tests for the
 * Documentation slot (D-01..D-04, D-09..D-11).
 *
 * Mirrors the per-field validator-rejection idiom of
 * tests/core/project-file.spec.ts:18-89 — every rejection asserts
 * `r.ok === false && r.error.kind === 'invalid-shape'` plus a field-path
 * substring match on `r.error.message`.
 *
 * Layer 3 invariant: imports only from src/core/documentation.ts (pure-TS)
 * and a type-only import of SkeletonSummary from src/shared/types.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  validateDocumentation,
  DEFAULT_DOCUMENTATION,
  intersectDocumentationWithSummary,
  type Documentation,
} from '../../src/core/documentation.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

describe('validateDocumentation (D-04)', () => {
  it('rejects non-object input (null / number / string / array)', () => {
    for (const input of [null, 42, 'foo', []]) {
      const r = validateDocumentation(input);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe('invalid-shape');
        expect(r.error.message).toContain('documentation');
      }
    }
  });

  it('rejects when animationTracks is not an array', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      animationTracks: 'not-an-array',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.animationTracks');
    }
  });

  it('rejects animationTracks entry with empty id', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: '', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: '' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.animationTracks[0].id');
    }
  });

  it('rejects animationTracks entry with non-finite mixTime', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'uuid-1', trackIndex: 0, animationName: 'walk', mixTime: Infinity, loop: true, notes: '' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.animationTracks[0].mixTime');
    }
  });

  it('rejects animationTracks entry with non-boolean loop', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'uuid-1', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: 'true', notes: '' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.animationTracks[0].loop');
    }
  });

  it('rejects animationTracks entry with non-string notes', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'uuid-1', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: 42 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.animationTracks[0].notes');
    }
  });

  it('rejects animationTracks entry with negative trackIndex', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'uuid-1', trackIndex: -1, animationName: 'walk', mixTime: 0.25, loop: true, notes: '' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.animationTracks[0].trackIndex');
    }
  });

  it('rejects events entry with empty name', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      events: [{ name: '', description: 'x' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.events[0].name');
    }
  });

  it('rejects controlBones entry with non-string description', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      controlBones: [{ name: 'CHAIN_2', description: 42 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.controlBones[0].description');
    }
  });

  it('rejects skins entry with empty name', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      skins: [{ name: '', description: 'x' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.skins[0].name');
    }
  });

  it('rejects safetyBufferPercent outside [0, 100]', () => {
    for (const v of [-1, 101, NaN, Infinity]) {
      const r = validateDocumentation({
        ...DEFAULT_DOCUMENTATION,
        safetyBufferPercent: v,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe('invalid-shape');
        expect(r.error.message).toContain('documentation.safetyBufferPercent');
      }
    }
  });

  it('rejects non-string generalNotes', () => {
    const r = validateDocumentation({
      ...DEFAULT_DOCUMENTATION,
      generalNotes: 42,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-shape');
      expect(r.error.message).toContain('documentation.generalNotes');
    }
  });

  it('accepts DEFAULT_DOCUMENTATION', () => {
    const r = validateDocumentation(DEFAULT_DOCUMENTATION);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc).toEqual(DEFAULT_DOCUMENTATION);
    }
  });

  it('accepts a representative non-empty Documentation', () => {
    const doc: Documentation = {
      animationTracks: [
        {
          id: 'uuid-1',
          trackIndex: 0,
          animationName: 'walk',
          mixTime: 0.25,
          loop: true,
          notes: 'Primary loop',
        },
      ],
      events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
      generalNotes: 'Hello\nworld',
      controlBones: [{ name: 'CHAIN_2', description: 'Spine root' }],
      skins: [{ name: 'default', description: 'Default skin' }],
      safetyBufferPercent: 5,
    };
    const r = validateDocumentation(doc);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc).toEqual(doc);
    }
  });
});

describe('DEFAULT_DOCUMENTATION shape', () => {
  it('has the canonical empty 6-key shape', () => {
    expect(DEFAULT_DOCUMENTATION).toEqual({
      animationTracks: [],
      events: [],
      generalNotes: '',
      controlBones: [],
      skins: [],
      safetyBufferPercent: 0,
    });
  });
});

// Helper for drift tests — minimal SkeletonSummary stub that supplies the
// four name-bearing fields intersectDocumentationWithSummary reads.
function makeSummary(
  bones: string[],
  skins: string[],
  animations: string[],
  events: string[],
): SkeletonSummary {
  return {
    skeletonPath: '/tmp/x.json',
    atlasPath: '/tmp/x.atlas',
    bones: { count: bones.length, names: bones },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: skins.length, names: skins },
    animations: { count: animations.length, names: animations },
    events: { count: events.length, names: events },
    peaks: [],
    animationBreakdown: [],
    elapsedMs: 0,
    editorFps: 30,
  } as SkeletonSummary;
}

describe('intersectDocumentationWithSummary (drift policy — D-09/D-10/D-11)', () => {
  it('drops controlBones whose name is not in summary.bones.names', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      controlBones: [
        { name: 'CHAIN_2', description: 'still here' },
        { name: 'GHOST', description: 'orphan' },
      ],
    };
    const summary = makeSummary(['CHAIN_2', 'CHAIN_3'], [], [], []);
    const result = intersectDocumentationWithSummary(doc, summary);
    expect(result.controlBones).toEqual([{ name: 'CHAIN_2', description: 'still here' }]);
  });

  it('drops animationTracks entries whose animationName is not in summary.animations.names', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'a', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: '' },
        { id: 'b', trackIndex: 1, animationName: 'GHOST', mixTime: 0.5, loop: false, notes: '' },
      ],
    };
    const summary = makeSummary([], [], ['walk'], []);
    const result = intersectDocumentationWithSummary(doc, summary);
    expect(result.animationTracks).toHaveLength(1);
    expect(result.animationTracks[0].animationName).toBe('walk');
  });

  it('produces events array of length summary.events.count, preserving descriptions for matched names and using empty for new ones (order = summary.events.names)', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      events: [
        { name: 'shoot', description: 'Fires when ammo expended' },
        { name: 'OBSOLETE', description: 'should be dropped' },
      ],
    };
    const summary = makeSummary([], [], [], ['land', 'shoot']);
    const result = intersectDocumentationWithSummary(doc, summary);
    expect(result.events).toEqual([
      { name: 'land', description: '' },
      { name: 'shoot', description: 'Fires when ammo expended' },
    ]);
  });

  it('produces skins array of length summary.skins.count, preserving descriptions for matched names and using empty for new ones', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      skins: [
        { name: 'default', description: 'Default skin' },
        { name: 'OBSOLETE', description: 'should be dropped' },
      ],
    };
    const summary = makeSummary([], ['default', 'fancy'], [], []);
    const result = intersectDocumentationWithSummary(doc, summary);
    expect(result.skins).toEqual([
      { name: 'default', description: 'Default skin' },
      { name: 'fancy', description: '' },
    ]);
  });

  it('passes generalNotes and safetyBufferPercent through unchanged', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      generalNotes: 'Multi-line\nnotes',
      safetyBufferPercent: 7,
    };
    const summary = makeSummary([], [], [], []);
    const result = intersectDocumentationWithSummary(doc, summary);
    expect(result.generalNotes).toBe('Multi-line\nnotes');
    expect(result.safetyBufferPercent).toBe(7);
  });

  it('preserves descriptions on rebind: when an event was previously described and the skeleton still contains it, the description survives', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      events: [{ name: 'shoot', description: 'Pre-existing description' }],
    };
    const summary = makeSummary([], [], [], ['shoot']);
    const result = intersectDocumentationWithSummary(doc, summary);
    expect(result.events).toEqual([{ name: 'shoot', description: 'Pre-existing description' }]);
  });
});
