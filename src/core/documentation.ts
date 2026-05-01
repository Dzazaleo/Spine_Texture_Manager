/**
 * Phase 20 D-01..D-04 — typed shape for the .stmproj v1 reserved
 * `documentation: object` slot (D-148 forward-compat). Pure-TS Layer 3
 * module: NO DOM, NO fs, NO electron. Only primitives + arrays + plain
 * objects (structuredClone-safe per src/shared/types.ts:7-15 docblock).
 *
 * Surfaces:
 *   - `Documentation` interface (6 keys, all required, structuredClone-safe).
 *   - `AnimationTrackEntry` / `EventDescriptionEntry` /
 *     `BoneDescriptionEntry` / `SkinDescriptionEntry` entry interfaces.
 *   - `DEFAULT_DOCUMENTATION` constant — the canonical empty shape used
 *     by validateProjectFile pre-massage and materializeProjectFile
 *     forward-compat back-fill (Phase 8-era files have `documentation: {}`).
 *   - `validateDocumentation(input): DocumentationValidateResult` — per-field
 *     hand-rolled guards mirroring src/core/project-file.ts:84-202 idiom.
 *     Returns the existing `'invalid-shape'` discriminator (no 9th
 *     SerializableError kind added).
 *   - `intersectDocumentationWithSummary(doc, summary): Documentation` —
 *     drift policy used by AppShell on every materialize/load. Mirrors
 *     Phase 8 D-150 stale-overrides intersection.
 *
 * Layer 3 invariant: type-only import from `'../shared/types.js'` is the
 * only legal cross-module import. Enforced by tests/arch.spec.ts:116-150
 * (no node:fs, no sharp, no electron) and the named-anchor block at
 * tests/arch.spec.ts:154-172 (Phase 8 carve-out covers project-file.ts;
 * this module honors the same rules by construction).
 */

import type { SkeletonSummary } from '../shared/types.js';

export interface AnimationTrackEntry {
  /** crypto.randomUUID() at create-time (renderer-side). Stable across save/reload + reorders. */
  id: string;
  /** Spine mix-track index (0, 1, 2, ...) per D-05. */
  trackIndex: number;
  /** Must match a name in summary.animations.names. */
  animationName: string;
  /** Seconds. Default 0.25 per DOC-02. */
  mixTime: number;
  loop: boolean;
  notes: string;
}

export interface EventDescriptionEntry {
  name: string;
  description: string;
}

export interface BoneDescriptionEntry {
  name: string;
  description: string;
}

export interface SkinDescriptionEntry {
  name: string;
  description: string;
}

export interface Documentation {
  animationTracks: AnimationTrackEntry[];
  events: EventDescriptionEntry[];
  generalNotes: string;
  controlBones: BoneDescriptionEntry[];
  skins: SkinDescriptionEntry[];
  /** Range [0, 100]. Metadata only this phase per D-22. Backlog 999.7 wires the export-math multiplier. */
  safetyBufferPercent: number;
}

export const DEFAULT_DOCUMENTATION: Documentation = {
  animationTracks: [],
  events: [],
  generalNotes: '',
  controlBones: [],
  skins: [],
  safetyBufferPercent: 0,
};

export type DocumentationValidateResult =
  | { ok: true; doc: Documentation }
  | { ok: false; error: { kind: 'invalid-shape'; message: string } };

/**
 * Per-field hand-rolled type guard for the `documentation` slot. Mirrors
 * the validateProjectFile idiom at src/core/project-file.ts:84-202.
 *
 * Reuses the existing `'invalid-shape'` kind (surfaces as
 * `'ProjectFileParseError'` envelope per src/shared/types.ts:555). NO 9th
 * SerializableError kind introduced — D-04 explicit lock.
 */
export function validateDocumentation(input: unknown): DocumentationValidateResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'documentation is not an object' },
    };
  }
  const obj = input as Record<string, unknown>;

  // animationTracks: array of plain objects with strict per-field shape.
  if (!Array.isArray(obj.animationTracks)) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'documentation.animationTracks is not an array' },
    };
  }
  for (let i = 0; i < obj.animationTracks.length; i++) {
    const e = obj.animationTracks[i] as Record<string, unknown>;
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}] is not an object`,
        },
      };
    }
    if (typeof e.id !== 'string' || e.id.length === 0) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}].id is not a non-empty string`,
        },
      };
    }
    if (typeof e.trackIndex !== 'number' || !Number.isFinite(e.trackIndex) || e.trackIndex < 0) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}].trackIndex is not a non-negative finite number`,
        },
      };
    }
    if (typeof e.animationName !== 'string') {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}].animationName is not a string`,
        },
      };
    }
    if (typeof e.mixTime !== 'number' || !Number.isFinite(e.mixTime) || e.mixTime < 0) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}].mixTime is not a non-negative finite number`,
        },
      };
    }
    if (typeof e.loop !== 'boolean') {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}].loop is not a boolean`,
        },
      };
    }
    if (typeof e.notes !== 'string') {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `documentation.animationTracks[${i}].notes is not a string`,
        },
      };
    }
  }

  // events / controlBones / skins: arrays of { name: non-empty string, description: string }.
  for (const key of ['events', 'controlBones', 'skins'] as const) {
    if (!Array.isArray(obj[key])) {
      return {
        ok: false,
        error: { kind: 'invalid-shape', message: `documentation.${key} is not an array` },
      };
    }
    const arr = obj[key] as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i] as Record<string, unknown>;
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        return {
          ok: false,
          error: {
            kind: 'invalid-shape',
            message: `documentation.${key}[${i}] is not an object`,
          },
        };
      }
      if (typeof e.name !== 'string' || e.name.length === 0) {
        return {
          ok: false,
          error: {
            kind: 'invalid-shape',
            message: `documentation.${key}[${i}].name is not a non-empty string`,
          },
        };
      }
      if (typeof e.description !== 'string') {
        return {
          ok: false,
          error: {
            kind: 'invalid-shape',
            message: `documentation.${key}[${i}].description is not a string`,
          },
        };
      }
    }
  }

  if (typeof obj.generalNotes !== 'string') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'documentation.generalNotes is not a string' },
    };
  }

  if (
    typeof obj.safetyBufferPercent !== 'number' ||
    !Number.isFinite(obj.safetyBufferPercent) ||
    obj.safetyBufferPercent < 0 ||
    obj.safetyBufferPercent > 100
  ) {
    return {
      ok: false,
      error: {
        kind: 'invalid-shape',
        message: 'documentation.safetyBufferPercent is not a finite number in [0, 100]',
      },
    };
  }

  return { ok: true, doc: obj as unknown as Documentation };
}

/**
 * Phase 20 D-09/D-10/D-11 — drift policy. Pure function called from AppShell
 * on every materialize/load. Mirrors Phase 8 D-150 stale-overrides intersection.
 *
 * Semantics:
 *   events       — produced from summary.events.names; existing descriptions
 *                  preserved by name-match; missing entries get description=''.
 *   controlBones — filtered to names present in summary.bones.names; opt-in
 *                  shape (only documented bones survive D-10).
 *   skins        — produced from summary.skins.names; existing descriptions
 *                  preserved by name-match; missing entries get description=''.
 *   animationTracks — filtered to entries whose animationName is in
 *                     summary.animations.names; orphans dropped.
 *   generalNotes / safetyBufferPercent — flow through unchanged (no drift).
 *
 * Layer 3 invariant: type-only import from shared/types.ts, no DOM/electron/fs.
 */
export function intersectDocumentationWithSummary(
  doc: Documentation,
  summary: SkeletonSummary,
): Documentation {
  // Events: produce from summary.events.names; preserve existing descriptions.
  const eventDescByName = new Map<string, string>();
  for (const e of doc.events) eventDescByName.set(e.name, e.description);
  const events: EventDescriptionEntry[] = summary.events.names.map((n) => ({
    name: n,
    description: eventDescByName.get(n) ?? '',
  }));

  // Skins: produce from summary.skins.names; preserve existing descriptions.
  const skinDescByName = new Map<string, string>();
  for (const s of doc.skins) skinDescByName.set(s.name, s.description);
  const skins: SkinDescriptionEntry[] = summary.skins.names.map((n) => ({
    name: n,
    description: skinDescByName.get(n) ?? '',
  }));

  // Control bones: filter to names still in skeleton (opt-in semantics; D-10
  // saves only documented bones, so filtering is the entire drift policy).
  const skeletonBones = new Set(summary.bones.names);
  const controlBones: BoneDescriptionEntry[] = doc.controlBones.filter((b) =>
    skeletonBones.has(b.name),
  );

  // Animation tracks: filter to entries whose animationName is still present.
  const skeletonAnimations = new Set(summary.animations.names);
  const animationTracks: AnimationTrackEntry[] = doc.animationTracks.filter((t) =>
    skeletonAnimations.has(t.animationName),
  );

  return {
    animationTracks,
    events,
    generalNotes: doc.generalNotes,
    controlBones,
    skins,
    safetyBufferPercent: doc.safetyBufferPercent,
  };
}
