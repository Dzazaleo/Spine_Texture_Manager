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
import type {
  AppSessionState,
  SaveResponse,
  OpenResponse,
  LocateSkeletonResponse,
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
// Open (F9.2)
// ---------------------------------------------------------------------------

/**
 * F9.2 — open the OS file picker, then chain to `handleProjectOpenFromPath`.
 * Cancel returns a `kind:'Unknown'` envelope with message 'Open cancelled' so
 * the renderer can no-op.
 */
export async function handleProjectOpen(): Promise<OpenResponse> {
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: 'Open Spine Texture Manager Project',
    properties: ['openFile'],
    filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'Open cancelled' } };
  }
  return handleProjectOpenFromPath(result.filePaths[0]);
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
  if (
    typeof absolutePath !== 'string' ||
    absolutePath.length === 0 ||
    !absolutePath.endsWith('.stmproj')
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
  let load;
  try {
    load = loadSkeleton(
      materialized.skeletonPath,
      materialized.atlasPath !== null ? { atlasPath: materialized.atlasPath } : {},
    );
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
          mergedOverrides: materialized.overrides,
          samplingHz: materialized.samplingHz,
          lastOutDir: materialized.lastOutDir,
          sortColumn: materialized.sortColumn,
          sortDir: materialized.sortDir,
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

  // 9. Compute stale-override keys (D-150). The summary's peaks list every
  //    attachment that produced a peak; intersect saved overrides with this
  //    list. Dropped names travel as `staleOverrideKeys` for the renderer's
  //    Cmd+S persist-write-back.
  const presentNames = new Set(summary.peaks.map((r) => r.attachmentName));
  const restored: Record<string, number> = {};
  const stale: string[] = [];
  for (const [name, percent] of Object.entries(materialized.overrides)) {
    if (presentNames.has(name)) restored[name] = percent;
    else stale.push(name);
  }

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restored,
    staleOverrideKeys: stale,
    samplingHz: materialized.samplingHz,
    lastOutDir: materialized.lastOutDir,
    sortColumn: materialized.sortColumn,
    sortDir: materialized.sortDir,
    projectFilePath: absolutePath,
    // Phase 20 D-01 — thread the materialized documentation through to the
    // renderer. AppShell will intersect against the live summary (D-09/D-10/
    // D-11 drift policy) before seeding modal-local state.
    documentation: materialized.documentation,
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
 *   - mergedOverrides: the overrides Record from the failed Open response,
 *     forwarded verbatim — main re-intersects against the new sampler peaks
 *     (D-150 stale-key drop applies on every load, including recovery, because
 *     the new skeleton may not have all the attachments the old one had).
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
  if (typeof a.projectPath !== 'string' || !a.projectPath.endsWith('.stmproj')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'projectPath must be a .stmproj path' },
    };
  }
  if (typeof a.newSkeletonPath !== 'string' || !a.newSkeletonPath.endsWith('.json')) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'newSkeletonPath must be a .json path' },
    };
  }
  if (!a.mergedOverrides || typeof a.mergedOverrides !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'mergedOverrides must be a Record' },
    };
  }

  // Optional metadata — pass through with sensible defaults if absent.
  const samplingHz = typeof a.samplingHz === 'number' ? a.samplingHz : 120;
  const lastOutDir = typeof a.lastOutDir === 'string' ? a.lastOutDir : null;
  const sortColumn = typeof a.sortColumn === 'string' ? a.sortColumn : null;
  const sortDir =
    a.sortDir === 'asc' || a.sortDir === 'desc' ? a.sortDir : null;

  // Reuse the loader+sampler+buildSummary chain from handleProjectOpenFromPath
  // steps 6-9. atlasPath is intentionally undefined → loader's F1.2 sibling
  // auto-discovery runs against the NEW skeleton's directory (D-152).
  let load;
  try {
    load = loadSkeleton(a.newSkeletonPath, {});
  } catch (err) {
    if (err instanceof SkeletonJsonNotFoundError) {
      // Phase 8.1 D-158/D-159: the user-picked replacement skeleton was
      // ALSO missing (rare — file deleted between picker close and
      // loadSkeleton call). Re-thread the recovery payload so the renderer
      // can re-prompt the locate-skeleton picker without losing the cached
      // overrides/settings. `originalSkeletonPath` carries the just-picked
      // (now-missing) path so the picker can default-locate near it.
      return {
        ok: false,
        error: {
          kind: 'SkeletonNotFoundOnLoadError',
          message: err.message,
          projectPath: a.projectPath,
          originalSkeletonPath: a.newSkeletonPath,
          mergedOverrides: a.mergedOverrides as Record<string, number>,
          samplingHz,
          lastOutDir,
          sortColumn,
          sortDir,
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

  // D-150 stale-drop applies on every load, including recovery — the new
  // skeleton may have different attachments than the old one.
  const presentNames = new Set(summary.peaks.map((r) => r.attachmentName));
  const restored: Record<string, number> = {};
  const stale: string[] = [];
  for (const [name, percent] of Object.entries(
    a.mergedOverrides as Record<string, unknown>,
  )) {
    if (typeof percent !== 'number' || !Number.isFinite(percent)) continue;
    if (presentNames.has(name)) restored[name] = percent;
    else stale.push(name);
  }

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restored,
    staleOverrideKeys: stale,
    samplingHz,
    lastOutDir,
    sortColumn,
    sortDir,
    projectFilePath: a.projectPath,
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
  if (typeof a.skeletonPath !== 'string' || !a.skeletonPath.endsWith('.json')) {
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

  let load;
  try {
    load = loadSkeleton(a.skeletonPath, atlasPath !== undefined ? { atlasPath } : {});
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

  const t0 = performance.now();
  const samplerResult = await runSamplerInWorker(
    {
      skeletonPath: a.skeletonPath,
      atlasRoot: atlasPath,
      samplingHz: a.samplingHz,
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

  // D-150 stale-key intersect (mirrors lines 484-490 + 701-710). Per-key
  // value validation guards against bad serialization across IPC.
  const presentNames = new Set(summary.peaks.map((r) => r.attachmentName));
  const restored: Record<string, number> = {};
  const stale: string[] = [];
  for (const [name, percent] of Object.entries(
    a.overrides as Record<string, unknown>,
  )) {
    if (typeof percent !== 'number' || !Number.isFinite(percent)) continue;
    if (presentNames.has(name)) restored[name] = percent;
    else stale.push(name);
  }

  const project: MaterializedProject = {
    summary,
    restoredOverrides: restored,
    staleOverrideKeys: stale,
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
  };
  return { ok: true, project };
}
