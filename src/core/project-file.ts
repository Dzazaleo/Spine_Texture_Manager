/**
 * Phase 8 — Pure-TS schema + hand-rolled validator + forward-only migration
 * ladder for the .stmproj project file (D-145..D-156).
 *
 * Pure, stateless, zero-I/O. No fs, no electron, no DOM, no sharp.
 * `node:path` is permitted (no I/O — see tests/arch.spec.ts:116-134
 * forbidden-import grep which lists `sharp` + `node:fs` + `fs/promises`,
 * NOT `node:path`). The Phase 8 arch.spec block (Plan 01 Task 4 Part B)
 * additionally bans `electron` imports from this exact file.
 *
 * Callers (one in main, none in renderer):
 *   - src/main/project-io.ts (Plan 03): invokes serializeProjectFile +
 *     JSON.stringify before atomic write; invokes JSON.parse →
 *     validateProjectFile → migrate → materializeProjectFile on Load.
 *   - tests/core/project-file.spec.ts: round-trip + hygiene + validator cases.
 *
 * The renderer NEVER imports this module directly — it goes through preload
 * via window.api.saveProject / openProject. (Layer 3 boundary.)
 *
 * Pitfall references:
 *   - Pitfall 3: overrides Map ↔ Record<string,number> conversion happens at
 *     this module's boundary; AppSessionState passes Record in, Record out.
 *     The renderer flattens its in-memory Map BEFORE calling saveProject so
 *     this module never sees a Map at runtime — JSON.stringify of a Map is
 *     `{}` and would silently destroy override data.
 *   - Pitfall 4: relativizePath falls back to absolute when basedir + target
 *     have different roots (Windows different drive, POSIX different mount).
 *     `path.relative` returns `'../../Other/foo'` across roots on POSIX
 *     (silent traversal that breaks the moment the project file is moved);
 *     this module's heuristic detects that case via path.parse(...).root
 *     comparison and stores the absolute path verbatim instead.
 *
 * Mirrors:
 *   - src/core/overrides.ts (module shape, header docblock pattern, zero-import discipline)
 *   - src/main/ipc.ts:92-112 validateExportPlan (hand-rolled validator idiom)
 */

import * as path from 'node:path';
import type {
  ProjectFile,
  ProjectFileV1,
  AppSessionState,
  SkeletonSummary,
} from '../shared/types.js';
import {
  validateDocumentation,
  DEFAULT_DOCUMENTATION,
  type Documentation,
} from './documentation.js';

/**
 * Discriminated envelope for validateProjectFile.
 *
 *   - 'invalid-shape': missing/wrong-type field — surface as ProjectFileParseError
 *     when the caller is project-io.ts (file content is malformed).
 *   - 'unknown-version': version is a number but not in [1, V_LATEST]; treat as
 *     future-version-incompat in Phase 8 (only v1 exists).
 *   - 'newer-version': version > 1 — surface as ProjectFileVersionTooNewError
 *     with no recovery affordance (D-151).
 */
export type ValidateResult =
  | { ok: true; project: ProjectFile }
  | {
      ok: false;
      error: {
        kind: 'invalid-shape' | 'unknown-version' | 'newer-version';
        message: string;
      };
    };

/**
 * The latest schema version this build understands. Bump when introducing
 * a new schema variant AND adding a `case` to `migrate` AND extending the
 * shape-guard branches in `validateProjectFile`.
 */
const V_LATEST = 1 as const;

/**
 * Hand-rolled type guard for unknown JSON parsed off disk or arriving via IPC.
 *
 * Mirrors `validateExportPlan` (src/main/ipc.ts:92-112) — per-field shape
 * checks, no schema library, no codegen. Gates the 'newer-version' rejection
 * BEFORE any field interpretation per D-151 (don't try to read fields whose
 * meaning may have changed in a future version).
 *
 * CONTRACT: returns the discriminated envelope above. Callers must check
 * `result.ok` before accessing `result.project` or `result.error`.
 */
export function validateProjectFile(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'project file is not an object' },
    };
  }
  const obj = input as Record<string, unknown>;

  // Version FIRST — gate the newer-version rejection per D-151. We do NOT
  // try to read other fields when version mismatches, because their meaning
  // may have changed in a future schema.
  if (typeof obj.version !== 'number') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'version is not a number' },
    };
  }
  if (obj.version > V_LATEST) {
    return {
      ok: false,
      error: {
        kind: 'newer-version',
        message:
          'This project was saved by a newer version of Spine Texture Manager — please update.',
      },
    };
  }
  if (obj.version !== V_LATEST) {
    return {
      ok: false,
      error: {
        kind: 'unknown-version',
        message: `Unknown project file version: ${obj.version}`,
      },
    };
  }

  // v1 field-shape guard. Required: skeletonPath, overrides, documentation.
  if (typeof obj.skeletonPath !== 'string' || obj.skeletonPath.length === 0) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'skeletonPath is missing or empty' },
    };
  }
  if (!obj.overrides || typeof obj.overrides !== 'object' || Array.isArray(obj.overrides)) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'overrides is not an object' },
    };
  }
  // Phase 20 D-148 forward-compat — Phase 8-era .stmproj files have either no
  // `documentation` key OR `documentation: {}` (D-148 reserved slot). Pre-massage
  // so the strict per-field validator below sees a known-shape default. Without
  // this pre-massage the validator REJECTS Phase 8-era files at the entry point
  // and the materializer back-fill never runs.
  if (
    obj.documentation == null ||
    (typeof obj.documentation === 'object' &&
      !Array.isArray(obj.documentation) &&
      Object.keys(obj.documentation as object).length === 0)
  ) {
    obj.documentation = { ...DEFAULT_DOCUMENTATION };
  }

  // Per-Phase-8 invariant retained: documentation must still be an object after
  // the pre-massage (rejects null, primitives, arrays).
  if (
    !obj.documentation ||
    typeof obj.documentation !== 'object' ||
    Array.isArray(obj.documentation)
  ) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'documentation is not an object' },
    };
  }

  // Phase 20 D-04 — per-field validation of the documentation slot.
  // Reuses 'invalid-shape' kind (no 9th SerializableError).
  const docResult = validateDocumentation(obj.documentation);
  if (!docResult.ok) {
    return { ok: false, error: docResult.error };
  }

  // Optional/nullable fields — null OR matching type both permitted.
  if (obj.atlasPath !== null && typeof obj.atlasPath !== 'string') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'atlasPath is not string|null' },
    };
  }
  if (obj.imagesDir !== null && typeof obj.imagesDir !== 'string') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'imagesDir is not string|null' },
    };
  }
  if (obj.samplingHz !== null && typeof obj.samplingHz !== 'number') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'samplingHz is not number|null' },
    };
  }
  if (obj.lastOutDir !== null && typeof obj.lastOutDir !== 'string') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'lastOutDir is not string|null' },
    };
  }
  if (obj.sortColumn !== null && typeof obj.sortColumn !== 'string') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'sortColumn is not string|null' },
    };
  }
  if (obj.sortDir !== null && obj.sortDir !== 'asc' && obj.sortDir !== 'desc') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'sortDir is not asc|desc|null' },
    };
  }

  // overrides Record<string, number> — every value MUST be a finite number.
  // Defensive: NaN / Infinity / -Infinity are not stringifiable to JSON
  // (JSON.stringify emits `null` for them), and they have no meaning as a
  // texture scale percentage. Reject at the boundary.
  for (const [k, v] of Object.entries(obj.overrides as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `overrides.${k} is not a finite number`,
        },
      };
    }
  }

  // Reaching here, the shape matches ProjectFileV1.
  return { ok: true, project: obj as unknown as ProjectFileV1 };
}

/**
 * Forward-only migration ladder. Phase 8 ships v1 only — passthrough.
 *
 * v2 (future) will land as `case 2:` returning a ProjectFileV1 by mapping
 * and/or dropping fields. Always returns the V_LATEST shape — callers can
 * treat the result as ProjectFileV1 unconditionally.
 *
 * CONTRACT: must be called AFTER validateProjectFile returns ok:true. The
 * validator is the gate for 'newer-version' rejection (D-151) and for
 * 'invalid-shape' rejection. `migrate` is allowed to assume a well-formed
 * input matching one of the historical version shapes.
 */
export function migrate(project: ProjectFile): ProjectFileV1 {
  switch (project.version) {
    case 1:
      return project;
    default:
      throw new Error(
        `Unsupported project file version: ${(project as ProjectFile).version}`,
      );
  }
}

/**
 * Folds AppSessionState + the destination project-file path into a
 * ProjectFileV1 v1 shape. Path fields are RELATIVIZED against the project
 * file's directory unless cross-volume (Pitfall 4 — relativizePath returns
 * the absolute verbatim when roots differ).
 *
 * NB: state.overrides is already a Record<string, number> per the
 * AppSessionState type. Map → Record conversion happens in AppShell BEFORE
 * calling saveProject (renderer-side Pitfall 3 boundary). The shallow
 * `{...state.overrides}` clone here is safe because override values are
 * primitives — no structured nested clone needed.
 */
export function serializeProjectFile(
  state: AppSessionState,
  projectFilePath: string,
): ProjectFileV1 {
  const basedir = path.dirname(projectFilePath);
  return {
    version: 1,
    skeletonPath: relativizePath(state.skeletonPath, basedir),
    atlasPath: state.atlasPath !== null ? relativizePath(state.atlasPath, basedir) : null,
    imagesDir: state.imagesDir !== null ? relativizePath(state.imagesDir, basedir) : null,
    overrides: { ...state.overrides },
    samplingHz: state.samplingHz,
    lastOutDir: state.lastOutDir, // absolute per D-145 — not relativized
    sortColumn: state.sortColumn,
    sortDir: state.sortDir,
    // Phase 20 D-01 — was `documentation: {}` reserved slot in Phase 8 D-148.
    // Now writes the full 6-key shape from AppSessionState.documentation.
    documentation: state.documentation,
  };
}

/**
 * Partial materialization shape returned by `materializeProjectFile`.
 *
 * `MaterializedProject` (in shared/types) carries a `summary` and a
 * `staleOverrideKeys` list — both of which require I/O (loadSkeleton +
 * sampleSkeleton + buildSummary) to compute. This module is Layer-3 pure
 * (no fs), so it cannot fill those fields. `src/main/project-io.ts` (Plan 03)
 * runs the I/O step AFTER calling `materializeProjectFile` and merges the
 * partial shape with `summary` + `staleOverrideKeys` to produce the final
 * `MaterializedProject`.
 *
 * `summary` is declared as an OPTIONAL slot on the partial so the Plan 01
 * shape-lock test (`back.summary.skeletonPath ?? back.projectFilePath`)
 * typechecks — the partial leaves it `undefined` and the test's `??`
 * fall-through resolves to the always-present `projectFilePath`. Plan 03
 * fills `summary` after running the loader + sampler.
 */
export interface PartialMaterialized {
  /** Absolute path to the skeleton JSON (resolved from the stored relative). */
  skeletonPath: string;
  /** Absolute hint for the atlas path; null means "loader auto-rediscovers" (D-152). */
  atlasPath: string | null;
  /** Absolute hint for the images directory; null means "loader auto-rediscovers". */
  imagesDir: string | null;
  /** Restored overrides from disk (subject to Plan 03 staleness intersection). */
  overrides: Record<string, number>;
  /** Resolved sampling rate — D-146 default 120 when null on disk. */
  samplingHz: number;
  /** Absolute path of the last output directory the user picked, if any. */
  lastOutDir: string | null;
  /** Persisted sort-column key for the global panel. */
  sortColumn: string | null;
  /** Persisted sort direction. */
  sortDir: 'asc' | 'desc' | null;
  /**
   * Phase 20 D-01 — typed Documentation shape. Materializer back-fills
   * DEFAULT_DOCUMENTATION for Phase 8-era empty {} slots so consumers can
   * trust the full 6-key shape.
   */
  documentation: Documentation;
  /**
   * Absolute path of the .stmproj file the user opened — same value the
   * caller passed in. Mirrored onto the partial so AppShell can persist it
   * as `currentProjectPath` without re-threading the arg through the IPC
   * envelope. Always present.
   */
  projectFilePath: string;
  /**
   * Filled by Plan 03 (`src/main/project-io.ts`) AFTER it runs the loader
   * + sampler + buildSummary. Left undefined by this pure-TS module.
   *
   * Declared as optional on the PARTIAL so callers (Plan 03 and the Plan 01
   * shape-lock test in tests/core/project-file.spec.ts) can statically
   * access `.skeletonPath` on it — TypeScript widens to `string | undefined`,
   * which composes correctly with `??` fallbacks.
   */
  summary?: SkeletonSummary;
}

/**
 * Inverse of `serializeProjectFile`. Resolves stored relative paths back to
 * absolute against the project file's directory. Stored absolute paths are
 * passed through unchanged (Pitfall 4 cross-volume).
 *
 * Returns a PARTIAL materialization — `summary` and `staleOverrideKeys` are
 * filled by `src/main/project-io.ts` after running the loader + sampler.
 */
export function materializeProjectFile(
  file: ProjectFileV1,
  projectFilePath: string,
): PartialMaterialized {
  const basedir = path.dirname(projectFilePath);
  return {
    skeletonPath: absolutizePath(file.skeletonPath, basedir),
    atlasPath: file.atlasPath !== null ? absolutizePath(file.atlasPath, basedir) : null,
    imagesDir: file.imagesDir !== null ? absolutizePath(file.imagesDir, basedir) : null,
    overrides: { ...file.overrides },
    samplingHz: file.samplingHz ?? 120, // D-146 default
    lastOutDir: file.lastOutDir,
    sortColumn: file.sortColumn,
    sortDir: file.sortDir,
    // Phase 20 — forward-compat default (defence in depth). Phase 8-era
    // .stmproj files have documentation:{}; back-fill missing keys so the
    // materialized AppSessionState is always the full 6-key shape the
    // renderer expects. The validator pre-massage already substitutes
    // DEFAULT_DOCUMENTATION for empty/missing slots, so this spread is
    // redundant for the standard Open path — but if any future code path
    // constructs a ProjectFileV1 literal that bypasses the validator, the
    // materializer back-fill keeps the renderer safe.
    documentation: { ...DEFAULT_DOCUMENTATION, ...file.documentation },
    projectFilePath,
    // summary intentionally omitted — Plan 03 fills it after loader+sampler.
  };
}

/**
 * D-155 + Pitfall 4. Returns a relative path when basedir is on the same
 * volume / drive root as absolutePath; falls back to the absolute path
 * verbatim when crossing volumes.
 *
 * Detection rules (mirror RESEARCH §Pitfall 4):
 *   - If `path.relative` returns an absolute path, the platform-specific
 *     relative is impossible (Windows cross-drive). Store absolute.
 *   - If `path.parse(...).root` of basedir vs absolutePath differ (POSIX
 *     cross-mount), `path.relative` happily returns a `'..'`-prefixed
 *     traversal across the root — but that traversal is brittle the moment
 *     the project file is moved to a different mount. Detect via root
 *     comparison and store absolute even when path.relative gave a relative.
 *
 * THROWS if `absolutePath` is not absolute — callers (serializeProjectFile)
 * always pass absolute paths from AppSessionState; a relative input here
 * indicates a programming error upstream.
 */
export function relativizePath(absolutePath: string, basedir: string): string {
  if (!path.isAbsolute(absolutePath)) {
    throw new Error(`relativizePath: expected absolute, got '${absolutePath}'`);
  }
  const rel = path.relative(basedir, absolutePath);
  if (path.isAbsolute(rel)) {
    return absolutePath;
  }
  const baseRoot = path.parse(path.resolve(basedir)).root;
  const targetRoot = path.parse(absolutePath).root;
  if (baseRoot !== targetRoot) {
    return absolutePath;
  }
  return rel;
}

/**
 * Inverse of `relativizePath`. Accepts an absolute path (returned verbatim,
 * supports the cross-volume fallback) OR a relative path (resolved against
 * `basedir` via `path.resolve`).
 *
 * D-152 callers (project-io.ts) treat null path fields as "loader
 * auto-rediscovers"; this function is invoked only on non-null strings.
 */
export function absolutizePath(stored: string, basedir: string): string {
  if (path.isAbsolute(stored)) return stored;
  return path.resolve(basedir, stored);
}
