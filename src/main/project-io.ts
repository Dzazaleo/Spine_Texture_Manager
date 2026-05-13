/**
 * Phase 8 — Save/Load IPC handlers (D-140..D-156).
 *
 * Six async exports wrap dialog + fs + the existing loader/sampler chain
 * with the D-10 typed-error envelope. Mirrors:
 *   - src/main/image-worker.ts:254-304 atomic-write idiom (`<path>.tmp` +
 *     `fs.rename`) for save (Pattern B, "same-directory tmp" — Pitfall 2).
 *   - src/main/ipc.ts:225-260 handleSkeletonLoad envelope shape for open.
 *   - src/main/ipc.ts:274-293 handlePickOutputDirectory dialog pattern.
 *
 * Layer 3: this file is the ONLY caller of fs/dialog in the Save/Load
 * surface. src/core/project-file.ts (Plan 02) is pure-TS and consumed via
 * `import` only — its validator + migration + relativize/absolutize
 * helpers run inside this module's handlers.
 *
 * Six exports:
 *   1. handleProjectSave           — write to a known path (dirty-save).
 *   2. handleProjectSaveAs         — picker → write.
 *   3. handleProjectOpen           — picker → handleProjectOpenFromPath.
 *   4. handleProjectOpenFromPath   — workhorse: read → parse → validate →
 *                                    migrate → materialize → loadSkeleton →
 *                                    sampleSkeleton → buildSummary →
 *                                    intersect overrides → respond.
 *   5. handleLocateSkeleton        — D-149 picker for replacement skeleton.
 *   6. handleProjectReloadWithSkeleton — D-149 recovery (Approach A): re-run
 *                                    loader+sampler+buildSummary against the
 *                                    user-picked replacement skeleton.
 *
 * Pitfall references:
 *   - Pitfall 1: before-quit recursion guard lives in src/main/index.ts.
 *   - Pitfall 2: fs.rename same-directory => atomic on POSIX, best-effort on
 *     Windows (acceptable for non-critical settings file).
 *   - Pitfall 9: JSON.parse SyntaxError caught and translated to
 *     'ProjectFileParseError' kind.
 *   - Pitfall 4 (codified inside core/project-file.ts): cross-volume paths
 *     fall back to absolute storage transparently.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { dialog, BrowserWindow } from 'electron';
import {
  validateProjectFile,
  migrate,
  serializeProjectFile,
  materializeProjectFile,
} from '../core/project-file.js';
import { DEFAULT_DOCUMENTATION } from '../core/documentation.js';
import { loadSkeleton } from '../core/loader.js';
import { buildSummary } from './summary.js';
import {
  SkeletonJsonNotFoundError,
  SpineLoaderError,
  SpineVersionUnsupportedError,
} from '../core/errors.js';
// Phase 9 Plan 02 D-190 + D-193 — sampling moved to a worker_threads Worker.
// project-io.ts no longer imports sampleSkeleton directly; it dispatches
// through runSamplerInWorker which spawns src/main/sampler-worker.ts and
// relays {type:'progress', percent} events to the renderer.
import { runSamplerInWorker } from './sampler-worker-bridge.js';
import type { SamplerOutput } from '../core/sampler.js';
// Phase 8.2 D-180 — Save As / Open success arms bump the new path to the
// front of recent.json and rebuild the application Menu so File → Open
// Recent reflects the latest state immediately. Plan 01 (recent.ts) provides
// addRecent; Plan 02 (index.ts) provides applyMenu / getCurrentMenuState /
// getMainWindow.
import { addRecent } from './recent.js';
// Phase 29 D-06 — load-time attachmentName → regionName migration helper.
// Replaces the per-seam D-150 stale-key intersect at three sites below
// (mountOpenResponse / locate-skeleton-recovery / resample). Helper is pure
// and unit-testable in isolation; main-side only (no IPC type implications).
import { migrateOverrides } from './override-migration.js';
import type {
  AppSessionState,
  SaveResponse,
  OpenResponse,
  LocateSkeletonResponse,
  OpenDialogResponse,
  SerializableError,
  MaterializedProject,
} from '../shared/types.js';

/**
 * Phase 8.1 D-158 — Non-recovery error kinds.
 *
 * The `SerializableError` discriminated union has two arms:
 *   1. `'SkeletonNotFoundOnLoadError'` carries the 7-field recovery payload
 *      (D-159) and is constructed by hand at the SkeletonJsonNotFoundError
 *      rescue branches in `handleProjectOpenFromPath` /
 *      `handleProjectReloadWithSkeleton` — those sites populate the threaded
 *      fields from the in-scope `materialized` object + `absolutePath`.
 *   2. The second arm — every other kind — keeps the flat `{kind, message}`
 *      shape. The SpineLoaderError forwarders cast `err.name` to this arm's
 *      kind union via `NonRecoveryKind`. This narrowing makes TypeScript
 *      verify the forwarders cannot accidentally produce the recovery-payload
 *      arm without populating its 7 fields (which would be a runtime bug —
 *      AppShell would read `undefined` instead of the cached payload).
 *
 * Same shape applied to `src/main/ipc.ts:handleSkeletonLoad` for the
 * `LoadResponse` envelope.
 */
// Phase 12 Plan 05 (D-21) — F3 Spine version guard. Also exclude
// 'SpineVersionUnsupportedError': its envelope arm carries an extra typed
// field beyond `message` (`detectedVersion`); the dedicated `instanceof
// SpineVersionUnsupportedError` branches in each catch clause below handle
// it BEFORE the generic `instanceof SpineLoaderError` branch fires.
// Excluding it here makes TypeScript verify the generic forwarders cannot
// accidentally produce the version-error arm without populating its
// `detectedVersion` field (which would be a runtime bug).
type NonRecoveryKind = Exclude<
  SerializableError['kind'],
  'SkeletonNotFoundOnLoadError' | 'SpineVersionUnsupportedError'
>;

// ---------------------------------------------------------------------------
// Save (F9.1, T-08-IO)
// ---------------------------------------------------------------------------

/**
 * F9.1 — write the renderer's session snapshot to a known .stmproj path.
 *
 * Renderer guarantees `currentPath` is non-null before calling this; the
 * defensive check here is belt-and-suspenders. First-save (no currentPath)
 * always goes through `handleProjectSaveAs`.
 */
export async function handleProjectSave(
  state: unknown,
  currentPath: unknown,
): Promise<SaveResponse> {
  if (!state || typeof state !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'state is missing or not an object' },
    };
  }
  if (
    typeof currentPath !== 'string' ||
    currentPath.length === 0 ||
    !currentPath.endsWith('.stmproj')
  ) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'currentPath must be a non-empty .stmproj path' },
    };
  }
  return writeProjectFileAtomic(state as AppSessionState, currentPath);
}

/**
 * F9.1 — open the OS save-file picker, then write atomically. Cancel returns
 * a `kind:'Unknown'` envelope with message 'Save cancelled' so the renderer
 * can no-op without surfacing an error UI.
 */
export async function handleProjectSaveAs(
  state: unknown,
  defaultDir: unknown,
  defaultBasename: unknown,
): Promise<SaveResponse> {
  if (!state || typeof state !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'state is missing or not an object' },
    };
  }
  if (typeof defaultDir !== 'string' || typeof defaultBasename !== 'string') {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: 'defaultDir and defaultBasename must be strings',
      },
    };
  }

  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.SaveDialogOptions = {
    title: 'Save Spine Texture Manager Project',
    defaultPath: path.join(defaultDir, `${defaultBasename}.stmproj`),
    filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
  };
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { ok: false, error: { kind: 'Unknown', message: 'Save cancelled' } };
  }
  // Phase 8.2 D-180 — Save As bumps the new path to the front of recent.json
  // and forces a menu rebuild so File → Open Recent reflects the latest
  // state immediately. Save (overwrite at existing path; handleProjectSave
  // above) does NOT bump — the path is already at the front from the
  // original Open.
  //
  // Both side-effects swallow errors: recent.json is non-critical UX state
  // (D-177) and the user's Save As already succeeded — a missing menu
  // rebuild or recent-list entry is not worth surfacing as an error
  // envelope. The dynamic `await import('./index.js')` defers the
  // index.ts ↔ ipc.ts ↔ project-io.ts cycle resolution until the first
  // success arm fires (by which time index.ts is fully loaded as the entry
  // point).
  const resp = await writeProjectFileAtomic(state as AppSessionState, result.filePath);
  if (resp.ok) {
    try {
      await addRecent(resp.path);
    } catch {
      // recent.json non-critical UX state (D-177) — silent.
    }
    try {
      const { applyMenu, getCurrentMenuState, getMainWindow } = await import('./index.js');
      void applyMenu(getCurrentMenuState(), getMainWindow());
    } catch {
      // Menu rebuild also non-critical — silent.
    }
  }
  return resp;
}

/**
 * Atomic write idiom (Pattern B, mirrors src/main/image-worker.ts:254-304).
 *
 *   1. serialize state → ProjectFileV1 (relativize paths via project-file.ts).
 *   2. JSON.stringify with 2-space indent (human-readable settings file).
 *   3. writeFile to `<finalPath>.tmp` (same directory — Pitfall 2 avoids
 *      EXDEV cross-device errors on rename).
 *   4. rename to final path. On POSIX this is atomic; on Windows it is
 *      best-effort but acceptable per RESEARCH §Pitfall 2 (settings file,
 *      not a database).
 *
 * On any failure the original .stmproj (if any) is intact. A tmp orphan
 * may be left on disk after a writeFile-success + rename-failure window —
 * acceptable trade-off for code simplicity.
 */
async function writeProjectFileAtomic(
  state: AppSessionState,
  finalPath: string,
): Promise<SaveResponse> {
  let json: string;
  try {
    const file = serializeProjectFile(state, finalPath);
    json = JSON.stringify(file, null, 2);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `serializeProjectFile failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }

  const tmpPath = finalPath + '.tmp';
  try {
    await writeFile(tmpPath, json, 'utf8');
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `writeFile tmp failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }
  try {
    await rename(tmpPath, finalPath);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `rename tmp→final failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  }
  return { ok: true, path: finalPath };
}

// ---------------------------------------------------------------------------
// Open (F9.2 → Phase 34 unified picker)
// ---------------------------------------------------------------------------

/**
 * Phase 34 D-01 + D-02 + D-03 — picker-only handler for the unified
 * File → Open dialog. Opens the OS file picker with a single filter
 * accepting both `.stmproj` (project archives) and `.json` (skeleton
 * files). Returns a 3-arm discriminated envelope so the renderer can
 * dispatch the appropriate load IPC by `kind`. No load happens inside
 * this function — load is split into a second IPC step per D-06.
 *
 * Cancel (or empty filePaths) returns `{ kind: 'cancelled' }`. The
 * renderer treats `cancelled` as a true no-op: no toast, no state
 * change, no dirty-guard fire (D-05 improvement over the status-quo
 * pre-Phase-34 flow that fired the guard before the picker).
 *
 * Defense-in-depth: if the OS picker somehow yields a path with
 * neither `.stmproj` nor `.json` suffix (filter normally prevents
 * this; Windows file-name field can paste arbitrary paths), the
 * handler returns `{ kind: 'project', path }` and lets the
 * downstream `handleProjectOpenFromPath`'s extension validator
 * surface the typed error envelope. The trust-boundary check stays
 * at the load handler where it has always been — this handler does
 * not duplicate or pre-empt it.
 *
 * Replaces the pre-Phase-34 `handleProjectOpen` (single-shot project
 * loader; physically removed in Phase 34 Plan 01 Task 2). The two-IPC-
 * step architecture (D-06) is what lets the renderer apply the
 * dirty-guard between picker close and load start — a behavioral
 * improvement over D-183.
 */
export async function handleOpenDialog(): Promise<OpenDialogResponse> {
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: 'Open Spine Project or Skeleton',
    // Phase 34 WR-03 — `dontAddToRecent` matches handlePickOutputDirectory
    // at src/main/ipc.ts:497. Prevents File → Open from polluting the
    // Windows OS-level recent-docs list (separate from the app's own
    // recent.json); macOS no-ops the property.
    properties: ['openFile', 'dontAddToRecent'],
    filters: [{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { kind: 'cancelled' };
  }
  const picked = result.filePaths[0];
  const lower = picked.toLowerCase();
  if (lower.endsWith('.json')) {
    return { kind: 'skeleton', path: picked };
  }
  // Default + .stmproj arm. Defense-in-depth: an unexpected suffix
  // falls through here; handleProjectOpenFromPath's validator emits
  // a typed error envelope downstream.
  return { kind: 'project', path: picked };
}

/**
 * F9.2 workhorse — chain the I/O steps to produce a MaterializedProject.
 *
 * Steps:
 *   1. readFile (.stmproj) → text. ENOENT → ProjectFileNotFoundError.
 *   2. JSON.parse → unknown. SyntaxError → ProjectFileParseError (Pitfall 9).
 *   3. validateProjectFile → discriminated envelope. invalid-shape /
 *      unknown-version → ProjectFileParseError; newer-version →
 *      ProjectFileVersionTooNewError (D-151).
 *   4. migrate → ProjectFileV1 (passthrough on v1; ladder for future).
 *   5. materializeProjectFile → PartialMaterialized (absolutizes paths,
 *      defaults samplingHz to 120 — D-146).
 *   6. loadSkeleton (F1.2 atlas auto-discovery applies when atlasPath null).
 *      SkeletonJsonNotFoundError → SkeletonNotFoundOnLoadError envelope
 *      (D-149 — triggers locate-skeleton flow in renderer).
 *   7. sampleSkeleton (F9.2 "recomputes peaks"; samplingHz from materialized).
 *   8. buildSummary (Phase 1 projection).
 *   9. Compute stale-override keys (D-150): intersect saved overrides with
 *      summary.peaks attachment names; dropped keys travel as
 *      `staleOverrideKeys` for the renderer's Cmd+S persist-write-back.
 */
export async function handleProjectOpenFromPath(
  absolutePath: unknown,
): Promise<OpenResponse> {
  // Phase 34 CR-01 — suffix check is case-insensitive to match the picker
  // contract at handleOpenDialog (which lowercases the picked path before
  // routing). The case-sensitive endsWith was rejecting `MyRig.STMPROJ` on
  // macOS APFS / HFS+ case-insensitive volumes (UAT regression) and Windows
  // file-name-field paste paths with the kind:'Unknown' envelope.
  if (
    typeof absolutePath !== 'string' ||
    absolutePath.length === 0 ||
    !absolutePath.toLowerCase().endsWith('.stmproj')
  ) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: 'absolutePath must be a non-empty .stmproj path',
      },
    };
  }

  // 1. Read the file. ENOENT / EACCES / etc. → ProjectFileNotFoundError.
  let text: string;
  try {
    text = await readFile(absolutePath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'ProjectFileNotFoundError',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // 2. JSON.parse. SyntaxError → ProjectFileParseError (Pitfall 9).
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        ok: false,
        error: { kind: 'ProjectFileParseError', message: `Invalid JSON: ${err.message}` },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Phase 36 WR-03 — sense whether the file ON DISK carried an
  // `overridesAtlasLess` key (before validator pre-massage substitutes `{}`
  // for the missing-field case). Used below to gate the legacy single-map
  // routing heuristic: a file written by v1.5+ post-Phase-36 always serialises
  // the key explicitly (even when the atlas-less bucket is empty), so the
  // presence of the key reliably distinguishes "v1.5 file with empty atlas-
  // less bucket" (do NOT legacy-route) from "v1.3.x/v1.4.x file written
  // before the field existed" (legacy-route is appropriate). The validator's
  // pre-massage at project-file.ts:287-289 conflates both cases by the time
  // `materialized.overridesAtlasLess` is read, hence the raw-key check here.
  //
  // Cast is safe because parsed has already been narrowed below by validator;
  // we sample BEFORE validation but only read the key membership (which is
  // safe on any object). Falsy `parsed` (null) → `false`.
  const hadOverridesAtlasLessKey =
    typeof parsed === 'object'
    && parsed !== null
    && Object.prototype.hasOwnProperty.call(parsed, 'overridesAtlasLess');

  // 3. Validate. invalid-shape / unknown-version → ProjectFileParseError;
  //    newer-version → ProjectFileVersionTooNewError (D-151).
  const v = validateProjectFile(parsed);
  if (!v.ok) {
    if (v.error.kind === 'newer-version') {
      return {
        ok: false,
        error: {
          kind: 'ProjectFileVersionTooNewError',
          message: v.error.message,
        },
      };
    }
    return {
      ok: false,
      error: { kind: 'ProjectFileParseError', message: v.error.message },
    };
  }

  // 4. Migrate (v1 passthrough; ladder for future schemas).
  const v1 = migrate(v.project);

  // 5. Materialize (resolve relative paths to absolute; no I/O — pure-TS).
  const materialized = materializeProjectFile(v1, absolutePath);

  // 6. Load skeleton. F1.2 atlas auto-discovery applies when atlasPath null
  //    (D-152 — `opts.atlasPath` undefined triggers sibling rediscovery).
  // Phase 21 D-08 — Site 1: thread materialized.loaderMode into the loader
  // so atlas-less projects honor the per-project override even when a
  // sibling .atlas exists.
  //
  // Plan 21-12 G-04 — caller-side precedence: when loaderMode === 'atlas-less',
  // the loader's D-08 synthesis branch must run (produces synth.missingPngs →
  // LoadResult.skippedAttachments → MissingAttachmentsPanel). The loader's
  // branch order at src/core/loader.ts:219-254 picks D-06 (explicit atlasPath
  // wins) when both options are set, which never reaches synthesis. Callers
  // MUST clear atlasPath when forcing atlas-less mode.
  let load;
  try {
    const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
    if (materialized.loaderMode === 'atlas-less') {
      loaderOpts.loaderMode = 'atlas-less';
      // atlasPath intentionally OMITTED — D-08 synthesis must run.
    } else if (materialized.atlasPath !== null) {
      loaderOpts.atlasPath = materialized.atlasPath;
    }
    load = loadSkeleton(materialized.skeletonPath, loaderOpts);
  } catch (err) {
    if (err instanceof SkeletonJsonNotFoundError) {
      // D-149 — triggers locate-skeleton flow in the renderer (T-08-MISS).
      // Phase 8.1 D-158/D-159: thread the cached recovery payload from the
      // already-materialized project (line 323) + the function arg
      // `absolutePath`. handleProjectReloadWithSkeleton (lines 459-555)
      // consumes these values verbatim when the user picks a replacement
      // skeleton. Pre-Phase-8.1 these fields were absent from the envelope,
      // forcing the renderer to populate empty literals — VR-02 was the
      // resulting bug (rejection at handleLocateSkeleton with
      // "projectPath must be a .stmproj path").
      return {
        ok: false,
        error: {
          kind: 'SkeletonNotFoundOnLoadError',
          message: err.message,
          projectPath: absolutePath,
          originalSkeletonPath: materialized.skeletonPath,
          // Phase 36 D-12 — carry BOTH buckets across locate-skeleton
          // recovery. Active-bucket-only here would be silent data loss for
          // the inactive bucket; the renderer's mergedOverridesBuckets
          // payload is the source of truth on the reload-with-skeleton hop.
          mergedOverridesBuckets: {
            overrides: materialized.overrides,
            overridesAtlasLess: materialized.overridesAtlasLess,
          },
          samplingHz: materialized.samplingHz,
          lastOutDir: materialized.lastOutDir,
          sortColumn: materialized.sortColumn,
          sortDir: materialized.sortDir,
          // Phase 36 WR-01 — thread loaderMode / sharpenOnExport /
          // safetyBufferPercent into the recovery envelope so the App.tsx
          // drag-drop recovery arm (App.tsx:183-218) can forward them to
          // handleProjectReloadWithSkeleton verbatim. Pre-WR-01 these
          // three fields silently defaulted to 'auto' / false / 0 on the
          // drag-drop recovery path, losing the user's saved settings.
          // AppShell's onClickLocateSkeleton path already threaded them
          // through (post-Phase-30 closure); App.tsx is the missed sibling.
          loaderMode: materialized.loaderMode,
          sharpenOnExport: materialized.sharpenOnExport,
          safetyBufferPercent: materialized.safetyBufferPercent,
        },
      };
    }
    // Phase 12 / Plan 05 (D-21) — F3 Spine version guard. The
    // SpineVersionUnsupportedError envelope arm carries `detectedVersion`
    // beyond the generic `{kind, message}` shape; the NonRecoveryKind cast
    // below CANNOT produce it. Branch BEFORE the generic SpineLoaderError
    // forwarder so 3.x-rig project-open paths surface the typed envelope.
    if (err instanceof SpineVersionUnsupportedError) {
      return {
        ok: false,
        error: {
          kind: 'SpineVersionUnsupportedError',
          message: err.message,
          detectedVersion: err.detectedVersion,
        },
      };
    }
    if (err instanceof SpineLoaderError) {
      // AtlasNotFoundError, AtlasParseError → forward .name verbatim.
      // Phase 8.1 D-158: the SerializableError union's second arm excludes
      // 'SkeletonNotFoundOnLoadError' (handled above with its threaded
      // payload). Narrow the cast to NonRecoveryKind so TypeScript verifies
      // the SpineLoaderError forwarder cannot accidentally produce the
      // recovery-payload arm without populating its 7 fields.
      return {
        ok: false,
        error: {
          kind: err.name as NonRecoveryKind,
          message: err.message,
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // 7. Re-sample. F9.2 "recomputes peaks". samplingHz threads from
  //    materializeProjectFile (D-146 default 120 when null on disk).
  //
  // Phase 9 Plan 02 D-190 + D-193 — sampling offloaded to a worker_threads
  // Worker (path-based protocol; SkeletonData never crosses postMessage).
  // The `load` variable above is preserved for buildSummary's load-time
  // metadata (skeletonPath, atlasPath, editorFps); only sampleSkeleton is
  // moved to the worker. The small load duplication is the cost of D-193's
  // no-circular-refs protocol (RESEARCH §Q3: <2% overhead vs sampling cost).
  const t0 = performance.now();
  const samplerResult = await runSamplerInWorker(
    {
      skeletonPath: materialized.skeletonPath,
      atlasRoot: materialized.atlasPath !== null ? materialized.atlasPath : undefined,
      samplingHz: materialized.samplingHz,
      loaderMode: materialized.loaderMode, // Phase 21 D-08 — Site 2
    },
    BrowserWindow.getAllWindows()[0]?.webContents ?? null,
  );
  if (samplerResult.type !== 'complete') {
    return {
      ok: false,
      error:
        samplerResult.type === 'cancelled'
          ? { kind: 'Unknown', message: 'Sampling cancelled.' }
          : samplerResult.error,
    };
  }
  // SamplerOutputShape (the shared/types declaration) is structurally identical
  // to SamplerOutput from src/core/sampler.ts; cast at the boundary so
  // buildSummary receives the precise type. shared/types cannot import from
  // core (Layer 3 + tsconfig.web.json src/core/** exclude) but the bridge
  // and project-io can.
  const samplerOutput = samplerResult.output as unknown as SamplerOutput;
  const elapsedMs = Math.round(performance.now() - t0);

  // 8. Build summary (Phase 1 projection — same shape as skeleton:load).
  const summary = buildSummary(load, samplerOutput, elapsedMs);

  // 9. Compute stale-override keys + migrate v1.3-era attachmentName-keyed
  //    overrides to v1.3.1 regionName keys (Phase 29 D-06; supersedes the
  //    D-150 stale-key intersect with a richer 3-pass migration — Case A
  //    region-keyed wins, Case B contributor-keyed migrates with lex-
  //    smallest-wins, Case C orphans drop into the existing stale-override
  //    banner). Dropped names travel as `staleOverrideKeys`; migrated count
  //    travels as `migratedKeyCount` for the new sibling banner.
  //
  // Phase 36 SEED-007 L-02 — legacy single-map routing at the Open seam.
  // v1.3.x/v1.4.x files saved a single `overrides` map shared across modes;
  // the validator's pre-massage at src/core/project-file.ts substitutes {}
  // for missing `overridesAtlasLess`. When the legacy file's saved loaderMode
  // === 'atlas-less', the legacy single-map's intent was atlas-less; route
  // the entire map into the atlas-less bucket. Otherwise (`auto` / undefined)
  // the legacy map's intent was atlas-source; keep it in `overrides`.
  // The bucket NOT receiving the legacy map starts empty. Per SEED-007
  // Decision 2-A LOCKED 2026-05-12.
  //
  // Phase 36 WR-03 fix — legacy detection now requires that the on-disk file
  // DID NOT carry the `overridesAtlasLess` key at all. Pre-fix the heuristic
  // also fired for v1.5 files that happened to have an empty atlas-less bucket
  // (legitimate state: atlas-source-mode file with no atlas-less overrides
  // applied yet) — saving and reopening such a file would silently move the
  // atlas-source map into the atlas-less bucket on every cycle. `hadOverridesAtlasLessKey`
  // (sensed before validator pre-massage) reliably distinguishes the two cases.
  const legacyMapPresent =
    !hadOverridesAtlasLessKey
    && Object.keys(materialized.overrides).length > 0
    && Object.keys(materialized.overridesAtlasLess).length === 0;
  const routeToAtlasLess =
    legacyMapPresent && materialized.loaderMode === 'atlas-less';

  const atlasSourceBucketInput = routeToAtlasLess ? {} : materialized.overrides;
  const atlasLessBucketInput = routeToAtlasLess
    ? materialized.overrides
    : materialized.overridesAtlasLess;

  // Per-bucket migration against the shared mode-invariant summary.regions
  // (REGION-05 skin-manifest pass — JSON-only, identical for both modes).
  // OVR-04: migratedKeyCount sums; staleOverrideKeys union.
  const aSrc = migrateOverrides(atlasSourceBucketInput as Record<string, unknown>, summary);
  const aLess = migrateOverrides(atlasLessBucketInput as Record<string, unknown>, summary);
  const restoredAtlasSource = aSrc.restored;
  const restoredAtlasLess = aLess.restored;
  const stale = [...new Set([...aSrc.stale, ...aLess.stale])]; // D-06 union
  const migratedKeyCount = aSrc.migratedKeyCount + aLess.migratedKeyCount; // D-07 sum

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restoredAtlasSource,
    restoredOverridesAtlasLess: restoredAtlasLess,
    staleOverrideKeys: stale,
    migratedKeyCount,
    samplingHz: materialized.samplingHz,
    lastOutDir: materialized.lastOutDir,
    sortColumn: materialized.sortColumn,
    sortDir: materialized.sortDir,
    projectFilePath: absolutePath,
    // Phase 20 D-01 — thread the materialized documentation through to the
    // renderer. AppShell will intersect against the live summary (D-09/D-10/
    // D-11 drift policy) before seeding modal-local state.
    documentation: materialized.documentation,
    // Phase 21 D-08 — thread loaderMode so AppShell can seed its toggle UI
    // state on Open. Validator already defaulted legacy files to 'auto'.
    loaderMode: materialized.loaderMode,
    // L3 — propagate the heal flag so AppShell can render a notice. Spread
    // conditionally so healthy files don't carry the field across IPC.
    ...(materialized.loaderModeHealed === true ? { loaderModeHealed: true } : {}),
    // Phase 28 SHARP-01 — thread sharpenOnExport so AppShell can seed its
    // sharpenOnExportLocal slot on Open. Mirrors loaderMode site immediately
    // above (Phase 21 D-08 Site 2).
    sharpenOnExport: materialized.sharpenOnExport,
    // Phase 30 BUFFER-03 — thread safetyBufferPercent so AppShell can seed
    // its safetyBufferPercentLocal slot on Open. Mirrors sharpenOnExport
    // site immediately above (Phase 28 SHARP-01).
    safetyBufferPercent: materialized.safetyBufferPercent,
  };
  // Phase 8.2 D-180 — successful Open re-bumps the path to the front of
  // recent.json. Both drag-drop and toolbar Open and menu Open Recent
  // traverse this code path → all three keep the recent list correct.
  // CRITICAL: only fire on the ok:true return — NOT on the
  // SkeletonNotFoundOnLoadError rescue arm above, because that arm's recovery
  // flow may never produce a successful Open (and the user hasn't actually
  // landed on a working project yet).
  //
  // Both side-effects swallow errors per D-177 (recent.json is non-critical
  // UX state). Dynamic `await import('./index.js')` mirrors the rationale at
  // handleProjectSaveAs above (cycle deferral).
  try {
    await addRecent(absolutePath);
  } catch {
    // recent.json non-critical UX state (D-177) — silent.
  }
  try {
    const { applyMenu, getCurrentMenuState, getMainWindow } = await import('./index.js');
    void applyMenu(getCurrentMenuState(), getMainWindow());
  } catch {
    // Menu rebuild also non-critical — silent.
  }
  return { ok: true, project };
}

// ---------------------------------------------------------------------------
// Locate-skeleton recovery (D-149)
// ---------------------------------------------------------------------------

/**
 * D-149 picker — opens an OS file dialog asking the user to locate the
 * replacement skeleton JSON after a `SkeletonNotFoundOnLoadError`. Returns a
 * minimal envelope: `{ok:true, newPath}` or `{ok:false}` (no error message —
 * cancel is the dominant case, not a failure).
 *
 * The renderer chains this with `handleProjectReloadWithSkeleton` to reuse
 * the loader+sampler chain against the user-picked path (Approach A).
 */
export async function handleLocateSkeleton(
  originalPath: unknown,
): Promise<LocateSkeletonResponse> {
  if (typeof originalPath !== 'string') {
    return { ok: false };
  }
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: `Locate skeleton (was: ${path.basename(originalPath)})`,
    properties: ['openFile'],
    filters: [{ name: 'Skeleton JSON', extensions: ['json'] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false };
  }
  return { ok: true, newPath: result.filePaths[0] };
}

/**
 * D-149 recovery handler (Approach A — Phase 8 plan lock).
 *
 * Called by the renderer AFTER `handleLocateSkeleton` resolves with a
 * user-picked `newSkeletonPath`. Reuses the loader → sampler → buildSummary
 * chain from `handleProjectOpenFromPath` (steps 6-9) but skips the file
 * read + parse + validate phases — the renderer already has the project's
 * overrides + samplingHz + settings cached in memory from the failed Open.
 *
 * Args (the renderer must pass all three required fields):
 *   - projectPath: the original `.stmproj` path (so `MaterializedProject.projectFilePath`
 *     stays correct; this path's directory remains the relativization basedir
 *     for any subsequent Save).
 *   - newSkeletonPath: the user-picked replacement skeleton (.json), absolute.
 *   - mergedOverridesBuckets: the per-bucket overrides Record pair from the
 *     failed Open response (Phase 36 D-12 — renamed from `mergedOverrides`;
 *     carries BOTH atlas-source `overrides` and atlas-less `overridesAtlasLess`
 *     buckets). Forwarded verbatim — main re-intersects each bucket against
 *     the new sampler peaks (D-150 stale-key drop applies on every load,
 *     including recovery, because the new skeleton may not have all the
 *     attachments the old one had).
 *
 * Returns the same `OpenResponse` envelope shape as `handleProjectOpenFromPath`,
 * so the renderer can mount the result via the same code path it uses for Open.
 *
 * Why this handler exists (Approach A): it localises Phase 8 to AppShell + main
 * + preload. App.tsx is NOT touched. The renderer dispatches the locate-skeleton
 * flow without an App.tsx callback prop and mounts the result through the
 * same handler used for Open — no parallel state-machine branch.
 */
export async function handleProjectReloadWithSkeleton(
  args: unknown,
): Promise<OpenResponse> {
  if (!args || typeof args !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'reload args must be an object' },
    };
  }
  const a = args as Record<string, unknown>;
  // Phase 34 CR-01 — case-insensitive suffix checks (symmetric mirror of
  // handleProjectOpenFromPath above). The recovery flow re-passes paths that
  // originated from handleLocateSkeleton's picker (case-insensitive in OS
  // dialogs) and the projectPath echo from the failed Open envelope (which
  // may carry uppercase suffix verbatim on case-insensitive volumes).
  if (typeof a.projectPath !== 'string' || !a.projectPath.toLowerCase().endsWith('.stmproj')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'projectPath must be a .stmproj path' },
    };
  }
  if (typeof a.newSkeletonPath !== 'string' || !a.newSkeletonPath.toLowerCase().endsWith('.json')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'newSkeletonPath must be a .json path' },
    };
  }
  // Phase 36 D-12 — validate the renamed `mergedOverridesBuckets` payload
  // carries BOTH atlas-source and atlas-less buckets. Active-bucket-only
  // would be silent data loss for the inactive bucket on the
  // reload-with-skeleton hop; the renderer (Plan 36-03) always sends both
  // because lastSaved snapshots both per D-11.
  //
  // Phase 36 WR-02 — replace truthiness checks with strict object guards
  // (mirrors the validator precedent in project-file.ts:290-298). Pre-fix
  // a non-empty string / number / array / function-ref on either sub-bucket
  // slot passed the validator and got cast as Record<string, number>; the
  // downstream Object.entries walk produced garbage but didn't crash.
  // Defense-in-depth at the IPC trust boundary; the renderer never sends
  // bad shapes today, but the inner gate should be authoritative.
  const buckets = a.mergedOverridesBuckets as Record<string, unknown> | null | undefined;
  if (
    !buckets
    || typeof buckets !== 'object'
    || Array.isArray(buckets)
    || typeof buckets.overrides !== 'object'
    || buckets.overrides === null
    || Array.isArray(buckets.overrides)
    || typeof buckets.overridesAtlasLess !== 'object'
    || buckets.overridesAtlasLess === null
    || Array.isArray(buckets.overridesAtlasLess)
  ) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'mergedOverridesBuckets must carry both buckets as objects' },
    };
  }

  // Optional metadata — pass through with sensible defaults if absent.
  const samplingHz = typeof a.samplingHz === 'number' ? a.samplingHz : 120;
  const lastOutDir = typeof a.lastOutDir === 'string' ? a.lastOutDir : null;
  const sortColumn = typeof a.sortColumn === 'string' ? a.sortColumn : null;
  const sortDir =
    a.sortDir === 'asc' || a.sortDir === 'desc' ? a.sortDir : null;
  // Phase 21 D-08 — recovery path threads loaderMode from the renderer's
  // useState slot. Validate as a string-literal union; default 'auto' if
  // missing or invalid (forward-compat for renderer versions that don't
  // populate the field — pre-Plan-08 builds dispatching the recovery flow
  // see canonical-mode behavior, which is the safer default).
  const loaderMode: 'auto' | 'atlas-less' =
    a.loaderMode === 'atlas-less' ? 'atlas-less' : 'auto';
  // Phase 28 SHARP-01 — recovery path threads sharpenOnExport from the
  // renderer's last-known session payload (mirrors samplingHz/loaderMode
  // lifts above). Type-coerce defensively (the recovery shape is loosely
  // typed at this boundary).
  const sharpenOnExport: boolean =
    typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false;
  // Phase 30 BUFFER-03 — recovery path threads safetyBufferPercent from the
  // renderer's last-known session payload. Defensive integer-and-range
  // coerce at the loosely-typed boundary (mirrors OptimizeDialog onChange
  // clamp); out-of-range / non-integer / non-numeric falls back to 0.
  const safetyBufferPercent: number =
    typeof a.safetyBufferPercent === 'number'
    && Number.isInteger(a.safetyBufferPercent)
    && a.safetyBufferPercent >= 0
    && a.safetyBufferPercent <= 25
      ? a.safetyBufferPercent
      : 0;

  // Reuse the loader+sampler+buildSummary chain from handleProjectOpenFromPath
  // steps 6-9. atlasPath is intentionally undefined → loader's F1.2 sibling
  // auto-discovery runs against the NEW skeleton's directory (D-152).
  let load;
  try {
    // Phase 21 D-08 — Site 3 (recovery): thread loaderMode from the
    // renderer-supplied recovery payload (the renderer's useState slot is
    // the source of truth here; the main process discarded the original
    // materialized state when the prior Open failed, so threading via args
    // is the only option).
    //
    // Plan 21-12 G-04 — caller-side precedence (already shape-correct here):
    // atlasPath was always omitted at this site per the F1.2 sibling-discovery
    // semantic, so the loader's D-08 synthesis branch is reached when
    // loaderMode === 'atlas-less'. This site needs no behavior change; Sites
    // 1, 4, 5 received the matching fix in the same commit.
    const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
    if (loaderMode === 'atlas-less') loaderOpts.loaderMode = 'atlas-less';
    // atlasPath intentionally omitted: F1.2 sibling auto-discovery applies on
    // the new skeleton's directory (D-152). loaderMode='atlas-less' override
    // short-circuits sibling discovery in the loader (Plan 06).
    load = loadSkeleton(a.newSkeletonPath, loaderOpts);
  } catch (err) {
    if (err instanceof SkeletonJsonNotFoundError) {
      // Phase 8.1 D-158/D-159: the user-picked replacement skeleton was
      // ALSO missing (rare — file deleted between picker close and
      // loadSkeleton call). Re-thread the recovery payload so the renderer
      // can re-prompt the locate-skeleton picker without losing the cached
      // overrides/settings. `originalSkeletonPath` carries the just-picked
      // (now-missing) path so the picker can default-locate near it.
      // Phase 36 D-12 — re-thread the renamed `mergedOverridesBuckets`
      // payload verbatim. The validator at the top of this handler already
      // asserted both sub-buckets exist as objects; cast each sub-bucket
      // to the typed Record<string, number> contract.
      const buckets = a.mergedOverridesBuckets as {
        overrides: Record<string, number>;
        overridesAtlasLess: Record<string, number>;
      };
      return {
        ok: false,
        error: {
          kind: 'SkeletonNotFoundOnLoadError',
          message: err.message,
          projectPath: a.projectPath,
          originalSkeletonPath: a.newSkeletonPath,
          mergedOverridesBuckets: {
            overrides: buckets.overrides,
            overridesAtlasLess: buckets.overridesAtlasLess,
          },
          samplingHz,
          lastOutDir,
          sortColumn,
          sortDir,
          // Phase 36 WR-01 — thread loaderMode / sharpenOnExport /
          // safetyBufferPercent through the recovery-of-recovery envelope so
          // the App.tsx drag-drop arm preserves user settings when the
          // replacement skeleton ALSO fails to load. The local `loaderMode`
          // / `sharpenOnExport` / `safetyBufferPercent` here are already
          // validated/coerced from `a.*` at the top of this handler.
          loaderMode,
          sharpenOnExport,
          safetyBufferPercent,
        },
      };
    }
    // Phase 12 / Plan 05 (D-21) — F3 Spine version guard. Dedicated branch
    // for SpineVersionUnsupportedError populates the `detectedVersion` field
    // on the envelope arm; the NonRecoveryKind cast below cannot.
    if (err instanceof SpineVersionUnsupportedError) {
      return {
        ok: false,
        error: {
          kind: 'SpineVersionUnsupportedError',
          message: err.message,
          detectedVersion: err.detectedVersion,
        },
      };
    }
    if (err instanceof SpineLoaderError) {
      // Phase 8.1 D-158: narrow to NonRecoveryKind so TypeScript verifies the
      // SpineLoaderError forwarder cannot accidentally produce the
      // recovery-payload arm without populating its 7 fields.
      return {
        ok: false,
        error: {
          kind: err.name as NonRecoveryKind,
          message: err.message,
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Phase 9 Plan 02 D-190 + D-193 — sampling offloaded to worker_threads.
  // newSkeletonPath is the user-picked replacement; atlasRoot=undefined so
  // F1.2 sibling auto-discovery applies in the worker (D-152).
  const t0 = performance.now();
  const samplerResult = await runSamplerInWorker(
    {
      skeletonPath: a.newSkeletonPath,
      atlasRoot: undefined,
      samplingHz,
      loaderMode, // Phase 21 D-08 — Site 3 recovery path
    },
    BrowserWindow.getAllWindows()[0]?.webContents ?? null,
  );
  if (samplerResult.type !== 'complete') {
    return {
      ok: false,
      error:
        samplerResult.type === 'cancelled'
          ? { kind: 'Unknown', message: 'Sampling cancelled.' }
          : samplerResult.error,
    };
  }
  const samplerOutput = samplerResult.output as unknown as SamplerOutput;
  const elapsedMs = Math.round(performance.now() - t0);
  const summary = buildSummary(load, samplerOutput, elapsedMs);

  // D-150 stale-drop + Phase 29 D-06 migration apply on every load, including
  // recovery — the new skeleton may have different attachments than the old
  // one. The helper preserves the typeof+isFinite guard from the original
  // per-seam loop (silently skips bad serialized values).
  //
  // Phase 36 OVR-04 — per-bucket migration. Recovery seam receives buckets
  // that are ALREADY split from the renderer (D-11 lastSaved snapshot
  // carries both buckets; Plan 36-03 owns the renderer-side dispatch).
  // No legacy-routing logic here — that lives at the Open seam ONLY
  // (PATTERNS.md §3-A "Departure notes"). The validator at the top of
  // this handler asserted both buckets exist as objects.
  const recoveryBuckets = a.mergedOverridesBuckets as {
    overrides: Record<string, unknown>;
    overridesAtlasLess: Record<string, unknown>;
  };
  const aSrcRec = migrateOverrides(recoveryBuckets.overrides, summary);
  const aLessRec = migrateOverrides(recoveryBuckets.overridesAtlasLess, summary);
  const restored = aSrcRec.restored;
  const restoredAtlasLess = aLessRec.restored;
  const stale = [...new Set([...aSrcRec.stale, ...aLessRec.stale])]; // D-06 union
  const migratedKeyCount = aSrcRec.migratedKeyCount + aLessRec.migratedKeyCount; // D-07 sum

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restored,
    restoredOverridesAtlasLess: restoredAtlasLess,
    staleOverrideKeys: stale,
    migratedKeyCount,
    samplingHz,
    lastOutDir,
    sortColumn,
    sortDir,
    projectFilePath: a.projectPath,
    // Phase 21 D-08 — recovery path uses the loaderMode the renderer cached
    // before the failed Open (computed at line ~667 from `a.loaderMode`).
    loaderMode,
    // Phase 28 SHARP-01 — recovery path uses the sharpenOnExport the renderer
    // cached before the failed Open (computed above from `a.sharpenOnExport`).
    sharpenOnExport,
    // Phase 30 BUFFER-03 — recovery path uses the safetyBufferPercent the
    // renderer cached before the failed Open (computed above from
    // `a.safetyBufferPercent` with defensive coerce).
    safetyBufferPercent,
    // Phase 20 D-01 — locate-skeleton recovery does not re-read the .stmproj
    // file (it reuses the renderer's cached overrides/settings from the
    // failed Open). `documentation` is not part of the cached args today;
    // default to the empty 6-key shape so the renderer's drift policy
    // intersects against the new skeleton without crashing. A future polish
    // phase can thread documentation through the locate-skeleton args.
    documentation: { ...DEFAULT_DOCUMENTATION },
  };
  return { ok: true, project };
}

// ---------------------------------------------------------------------------
// Phase 9 Plan 06 — Re-sample on samplingHz change (RESEARCH §Pitfall 7).
// ---------------------------------------------------------------------------

/**
 * Handler for the `'project:resample'` IPC channel. Called by the renderer
 * after the user clicks Apply in SettingsDialog with a new samplingHz value.
 * Re-runs the loader → sampler-worker → buildSummary → stale-key intersect
 * chain and returns OpenResponse so AppShell can mount the result via
 * mountOpenResponse — same code path used for File→Open.
 *
 * The `load` step IS re-run (not cached): worker.terminate() across IPC may
 * outlive the JS-side `load` reference; making this stateless keeps the
 * handler simple and matches the Plan 02 worker bridge contract (path-based
 * protocol, D-193). The duplication cost is <2% of sampling time per
 * RESEARCH §Q3.
 *
 * Trust boundary (T-09-06-RESAMPLE-*): every renderer-origin field is
 * type-validated before reaching loadSkeleton or runSamplerInWorker. The
 * arms mirror handleProjectOpenFromPath's validators (lines 311-323) and
 * handleProjectReloadWithSkeleton's validators (lines 597-615).
 *
 * Returns ok:false on:
 *   - bad arg shape (kind:'Unknown')
 *   - loadSkeleton failure (forwards SpineLoaderError.name as the kind)
 *   - sampler 'cancelled' (kind:'Unknown', message:'Sampling cancelled.')
 *   - sampler 'error' (forwards error envelope verbatim)
 */
export async function handleProjectResample(
  args: unknown,
): Promise<OpenResponse> {
  if (!args || typeof args !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'resample args must be an object' },
    };
  }
  const a = args as Record<string, unknown>;
  // Phase 34 CR-01 — case-insensitive suffix check (symmetric mirror).
  // Resample threads skeletonPath from the renderer's currentSession slot,
  // which was seeded from a prior Open whose path may carry uppercase suffix
  // on case-insensitive volumes.
  if (typeof a.skeletonPath !== 'string' || !a.skeletonPath.toLowerCase().endsWith('.json')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'skeletonPath must be a .json path' },
    };
  }
  if (
    typeof a.samplingHz !== 'number' ||
    !Number.isInteger(a.samplingHz) ||
    a.samplingHz <= 0
  ) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'samplingHz must be a positive integer' },
    };
  }
  if (!a.overrides || typeof a.overrides !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'overrides must be a Record' },
    };
  }
  const atlasPath = typeof a.atlasPath === 'string' ? a.atlasPath : undefined;

  // Phase 21 D-08 — Site 4 (resample): thread loaderMode from the IPC
  // payload so atlas-less projects survive the SettingsDialog resample.
  //
  // Plan 21-12 G-04 — caller-side precedence fix. Empirically-pinned root
  // cause: when the user starts on a canonical project (.atlas present)
  // then toggles "Use Images Folder as Source" ON, the resample IPC
  // payload carries BOTH atlasPath (from prior canonical state) AND
  // loaderMode='atlas-less'. The loader's branch order picks D-06
  // (atlasPath wins), never reaches D-08 synthesis, never produces
  // synth.missingPngs. The MissingAttachmentsPanel then never surfaces the
  // missing PNG. Fix: when loaderMode='atlas-less', omit atlasPath so the
  // loader takes the D-08 branch.
  let load;
  try {
    const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
    if (a.loaderMode === 'atlas-less') {
      loaderOpts.loaderMode = 'atlas-less';
      // atlasPath intentionally OMITTED — D-08 synthesis must run.
    } else if (atlasPath !== undefined) {
      loaderOpts.atlasPath = atlasPath;
    }
    load = loadSkeleton(a.skeletonPath, loaderOpts);
  } catch (err) {
    if (err instanceof SkeletonJsonNotFoundError) {
      // Resample shouldn't normally hit this — the renderer holds the
      // skeletonPath from a successful prior Open. If the file vanished
      // in the meantime, surface as SkeletonJsonNotFoundError (a
      // NonRecoveryKind) rather than the recovery-payload arm — there's
      // no projectPath to thread through, and the user already had the
      // project loaded anyway.
      return {
        ok: false,
        error: { kind: 'SkeletonJsonNotFoundError', message: err.message },
      };
    }
    // Phase 12 / Plan 05 (D-21) — F3 Spine version guard. Dedicated branch
    // populates the `detectedVersion` envelope field; the NonRecoveryKind
    // cast below cannot. Re-sample paths can hit this if the source rig was
    // regenerated to a 3.x export between project Open and resample.
    if (err instanceof SpineVersionUnsupportedError) {
      return {
        ok: false,
        error: {
          kind: 'SpineVersionUnsupportedError',
          message: err.message,
          detectedVersion: err.detectedVersion,
        },
      };
    }
    if (err instanceof SpineLoaderError) {
      return {
        ok: false,
        error: { kind: err.name as NonRecoveryKind, message: err.message },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Phase 21 D-08 — Site 5 (resample worker): thread loaderMode from the
  // IPC payload. Validated as a string-literal union (the renderer is
  // trusted but defense-in-depth keeps the worker boundary clean).
  const resampleLoaderMode: 'auto' | 'atlas-less' | undefined =
    a.loaderMode === 'atlas-less'
      ? 'atlas-less'
      : a.loaderMode === 'auto'
        ? 'auto'
        : undefined;
  const t0 = performance.now();
  const samplerResult = await runSamplerInWorker(
    {
      skeletonPath: a.skeletonPath,
      atlasRoot: atlasPath,
      samplingHz: a.samplingHz,
      loaderMode: resampleLoaderMode, // Phase 21 D-08 — Site 5
    },
    BrowserWindow.getAllWindows()[0]?.webContents ?? null,
  );
  if (samplerResult.type !== 'complete') {
    return {
      ok: false,
      error:
        samplerResult.type === 'cancelled'
          ? { kind: 'Unknown', message: 'Sampling cancelled.' }
          : samplerResult.error,
    };
  }
  const samplerOutput = samplerResult.output as unknown as SamplerOutput;
  const elapsedMs = Math.round(performance.now() - t0);
  const summary = buildSummary(load, samplerOutput, elapsedMs);

  // D-150 stale-key intersect + Phase 29 D-06 migration (mirrors the two
  // earlier seams). Per-key value validation guards against bad serialization
  // across IPC; migration counts travel through to the renderer banner.
  //
  // Phase 36 CR-01 fix — per-bucket migration at the resample seam, with
  // BUCKET ROUTING BY loaderMode.
  //
  // Historical bug (fixed by this code): pre-fix, the renderer sent the
  // ACTIVE bucket only via `args.overrides` (active=atlas-less when
  // loaderMode==='atlas-less', else atlas-source). The handler unconditionally
  // routed `args.overrides` into the atlas-source bucket on the response.
  // Every mode toggle therefore had the side-effect of moving the active
  // bucket's data into the wrong response slot, destroying both buckets on
  // the renderer hydration that followed (CR-01 silent corruption).
  //
  // Post-fix: ResampleArgs (Plan 36-01 + CR-01) carries BOTH buckets
  // unconditionally:
  //   - `args.overrides`           = atlas-source bucket
  //   - `args.overridesAtlasLess`  = atlas-less bucket
  //
  // The renderer always sends both via Object.fromEntries on each Map. The
  // optional shape on `overridesAtlasLess` is back-compat for older renderer
  // builds (or a future caller that only re-materialises one bucket); when
  // absent we default to `{}` and the per-bucket migration call is a no-op
  // (migrateOverrides({}, summary) returns empty restored/stale, 0
  // migratedKeyCount).
  //
  // Per-bucket migration runs against the shared mode-invariant
  // summary.regions; the response carries both `restoredOverrides` (atlas-
  // source) and `restoredOverridesAtlasLess` (atlas-less) so AppShell can
  // re-hydrate BOTH buckets symmetrically.
  const incomingAtlasSource: Record<string, unknown> =
    a.overrides && typeof a.overrides === 'object'
      ? (a.overrides as Record<string, unknown>)
      : {};
  const incomingAtlasLess: Record<string, unknown> =
    a.overridesAtlasLess && typeof a.overridesAtlasLess === 'object'
      ? (a.overridesAtlasLess as Record<string, unknown>)
      : {};
  const aSrcRes = migrateOverrides(incomingAtlasSource, summary);
  const aLessRes = migrateOverrides(incomingAtlasLess, summary);
  const restored = aSrcRes.restored;
  const restoredAtlasLess = aLessRes.restored;
  const stale = [...new Set([...aSrcRes.stale, ...aLessRes.stale])]; // D-06 union
  const migratedKeyCount = aSrcRes.migratedKeyCount + aLessRes.migratedKeyCount; // D-07 sum

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restored,
    restoredOverridesAtlasLess: restoredAtlasLess,
    staleOverrideKeys: stale,
    migratedKeyCount,
    samplingHz: a.samplingHz,
    lastOutDir: typeof a.lastOutDir === 'string' ? a.lastOutDir : null,
    sortColumn: typeof a.sortColumn === 'string' ? a.sortColumn : null,
    sortDir: a.sortDir === 'asc' || a.sortDir === 'desc' ? a.sortDir : null,
    // The renderer carries currentProjectPath which may be null on a fresh
    // skeleton-only session (no .stmproj saved yet). Match that contract: an
    // empty string is NOT a valid path; null is the canonical "no project file".
    // MaterializedProject.projectFilePath is typed as `string` so we coerce
    // the null case to '' — AppShell.mountOpenResponse reads
    // project.projectFilePath into a `string | null` state slot via Plan 04
    // and treats empty-string as null in the UI seam.
    projectFilePath: typeof a.projectFilePath === 'string' ? a.projectFilePath : '',
    // Phase 20 D-01 — resample is a renderer-driven re-sample of an
    // already-loaded session; documentation lives in renderer state and the
    // renderer re-intersects against the new summary on its own. Default
    // here keeps the type contract; AppShell ignores this field on the
    // resample path (it preserves its own documentation state).
    documentation: { ...DEFAULT_DOCUMENTATION },
    // Phase 21 D-08 — thread the resample-time loaderMode back to the
    // renderer. resampleLoaderMode is intentionally `undefined` when the IPC
    // payload's loaderMode field was missing/invalid (worker-input safety);
    // the IPC response coerces undefined → 'auto' to satisfy the
    // MaterializedProject contract (non-undefined union).
    loaderMode: resampleLoaderMode ?? 'auto',
    // Phase 28 SHARP-01 — resample is renderer-driven; the renderer's
    // sharpenOnExportLocal slot is the source of truth and AppShell preserves
    // it across resample. Default false here satisfies the type contract; if
    // the renderer ever threads sharpenOnExport into ResampleArgs, this seam
    // already coerces it defensively.
    sharpenOnExport:
      typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false,
    // Phase 30 BUFFER-03 — resample seam preserves safetyBufferPercent
    // across re-materialise. AppShell threads safetyBufferPercentLocal
    // into ResampleArgs.safetyBufferPercent; defensive integer-and-range
    // coerce at the IPC boundary (mirrors sharpenOnExport line above).
    safetyBufferPercent:
      typeof a.safetyBufferPercent === 'number'
      && Number.isInteger(a.safetyBufferPercent)
      && a.safetyBufferPercent >= 0
      && a.safetyBufferPercent <= 25
        ? a.safetyBufferPercent
        : 0,
  };
  return { ok: true, project };
}
