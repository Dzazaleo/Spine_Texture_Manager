/**
 * Phase 1 Plan 02 — IPC handler for `'skeleton:load'`.
 * Phase 6 Plan 05 — Extended with export channels (dialog:pick-output-dir,
 *   export:start, export:cancel, shell:open-folder) + module-level
 *   re-entrancy / cancel state. handleSkeletonLoad is preserved untouched.
 *
 * Two original exports (Phase 1):
 *   - `handleSkeletonLoad(jsonPath)` — pure async function wrapping
 *     `loadSkeleton` + `sampleSkeleton` + `buildSummary`; testable in vitest
 *     without spinning up Electron.
 *   - `registerIpcHandlers()` — wires `handleSkeletonLoad` into
 *     `ipcMain.handle('skeleton:load', ...)`. Called once in
 *     `app.whenReady()` from `src/main/index.ts`.
 *
 * Phase 6 additions:
 *   - `handlePickOutputDirectory(defaultPath?)` — F8.1 + D-122 folder picker.
 *   - `handleStartExport(evt, plan, outDir)` — D-115 / D-122 / F8.4 export
 *     start, with re-entrancy guard, outDir validation, cooperative cancel
 *     callback, and one-way 'export:progress' emission via evt.sender.send.
 *   - Module-level `exportInFlight` + `exportCancelFlag` flags.
 *   - registerIpcHandlers wires 4 new channels (2 invoke + 2 send).
 *
 * Typed-error envelope (D-10): `SpineLoaderError` subclasses are caught and
 * translated to `{ok: false, error: {kind, message}}` discriminated union.
 * Unknown errors fall through to `kind: 'Unknown'` with the error message —
 * we deliberately surface only name + message; stack-trace fields are never
 * included (T-01-02-02 information-disclosure mitigation). The same pattern
 * applies to ExportResponse (Phase 6 D-10 inheritance).
 *
 * Input validation (T-01-02-01): jsonPath / outDir / plan shape validated at
 * the trust boundary. Renderer-origin arguments cross a trust boundary — the
 * checks are cheap and prevent pathological inputs from reaching `fs` / sharp.
 *
 * Imports from `../core/*.js` are allowed only because this file lives in
 * `src/main/` — the renderer is structurally prevented from reaching here
 * by the tsconfig.web.json / electron.vite.config.ts / tests/arch.spec.ts
 * three-layer defense (CLAUDE.md Fact #5).
 */
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { access, constants as fsConstants } from 'node:fs/promises';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';
import { SpineLoaderError } from '../core/errors.js';
import { buildSummary } from './summary.js';
import { runExport } from './image-worker.js';
import type {
  ExportPlan,
  ExportResponse,
  LoadResponse,
  ProbeConflictsResponse,
  SerializableError,
} from '../shared/types.js';

type KnownErrorKind = SerializableError['kind'];

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);

// ---------------------------------------------------------------------------
// Phase 6 Plan 05 — module-level state for re-entrancy guard + cancel flag.
// D-115: only one export in flight at a time. D-116 cancel-cooperative.
// Both flags reset to false on every successful entry to handleStartExport
// (the cancel flag is per-export-run; never sticky across runs). The cancel
// flag is also cleared in finally so a follow-up call after a thrown error
// is not silently pre-cancelled.
// ---------------------------------------------------------------------------
let exportInFlight = false;
let exportCancelFlag = false;

/**
 * Path-prefix check for D-122 / F8.4 — outDir must NOT be the source
 * images directory itself or a child of it. Cross-platform via path.relative
 * + path.resolve. Empty `rel` means equal; '..' prefix means outside.
 *
 * Not exported — internal helper.
 *
 * Gap-Fix Round 3 (2026-04-25): no longer called from handleStartExport.
 * The folder-position-only rejection from Round 2 was over-cautious — the
 * new contract rejects ONLY when outDir IS the source-images dir itself
 * (handled inline as a path.resolve equality check) OR when an actual
 * file would be overwritten (probeExportConflicts). The helper is kept
 * here for potential future use (e.g. if a follow-up phase adds a more
 * structural folder-policy check) but is intentionally unreferenced today.
 *
 * The `eslint-disable-next-line` style comments below are unnecessary —
 * this project has no ESLint and TypeScript's noUnusedLocals is set
 * file-wide; the explicit `void`-call below keeps the symbol live for
 * the typechecker without affecting runtime behaviour.
 */
function isOutDirInsideSourceImages(outDir: string, sourceImagesDir: string): boolean {
  const resolvedOut = path.resolve(outDir);
  const resolvedSrc = path.resolve(sourceImagesDir);
  if (resolvedOut === resolvedSrc) return true;
  const rel = path.relative(resolvedSrc, resolvedOut);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
// Round 3: keep the helper symbol live for the typechecker (noUnusedLocals)
// without re-introducing the round-2 over-cautious behaviour. The reference
// is a no-op at runtime — the `void` operator discards the function value.
void isOutDirInsideSourceImages;

/**
 * Cheap shape validation for an ExportPlan crossing the trust boundary.
 * T-01-02-01 inheritance — renderer-origin args validated at the IPC
 * entry point. Returns null when valid, an error message string otherwise.
 *
 * Not exported — internal helper for handleStartExport.
 */
function validateExportPlan(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  const p = plan as { rows?: unknown; excludedUnused?: unknown; totals?: unknown };
  if (!Array.isArray(p.rows)) return 'plan.rows is not an array';
  if (!Array.isArray(p.excludedUnused)) return 'plan.excludedUnused is not an array';
  if (!p.totals || typeof p.totals !== 'object') return 'plan.totals is not an object';
  for (let i = 0; i < p.rows.length; i++) {
    const r = p.rows[i] as Record<string, unknown>;
    if (
      typeof r.sourcePath !== 'string' || r.sourcePath.length === 0 ||
      typeof r.outPath !== 'string' || r.outPath.length === 0 ||
      typeof r.sourceW !== 'number' || typeof r.sourceH !== 'number' ||
      typeof r.outW !== 'number' || typeof r.outH !== 'number' ||
      typeof r.effectiveScale !== 'number' ||
      !Array.isArray(r.attachmentNames)
    ) {
      return `plan.rows[${i}] has invalid shape`;
    }
  }
  return null;
}

/**
 * Phase 6 Gap-Fix Round 3 (2026-04-25) — Detects file collisions BEFORE
 * starting an export. Used by the new 'export:probe-conflicts' IPC channel
 * (renderer mounts ConflictDialog with the result) AND by handleStartExport
 * itself as a defense-in-depth check when called with overwrite=false.
 *
 * Returns the deduped, sorted list of absolute paths that would be
 * overwritten by this export. Three collision sources covered:
 *   1. resolved output equals row.sourcePath (per-region PNG case)
 *   2. resolved output equals row.atlasSource.pagePath (atlas-packed)
 *   3. resolved output exists on disk via fs.access(F_OK) (any
 *      pre-existing PNG, even if unrelated — we don't silently destroy
 *      user files just because they happen to live where we'd write)
 *
 * Existence probes run in parallel via Promise.all — total cost is one
 * stat-equivalent syscall per row, well below the sharp/libvips work
 * downstream. The resulting list is unique (a single path can collide
 * via both source-match and exists-on-disk; we deduplicate via Set) and
 * sorted (deterministic UI ordering, easier user comparison).
 *
 * Pure (no global state mutation). Safe to call concurrently.
 *
 * Not exported — internal helper for handleProbeExportConflicts and
 * handleStartExport.
 */
async function probeExportConflicts(
  plan: ExportPlan,
  outDir: string,
): Promise<string[]> {
  const conflictSet = new Set<string>();

  // Per-row checks. Source-match comparisons are synchronous; the
  // exists-on-disk probe is async but we kick all rows off in parallel.
  const existencePromises = plan.rows.map(async (row) => {
    const resolvedOut = path.resolve(outDir, row.outPath);
    if (path.resolve(row.sourcePath) === resolvedOut) {
      conflictSet.add(resolvedOut);
    }
    if (row.atlasSource && path.resolve(row.atlasSource.pagePath) === resolvedOut) {
      conflictSet.add(resolvedOut);
    }
    // F_OK existence check (NOT R_OK — we care that SOMETHING is there,
    // even an unreadable file we'd clobber). fs.access throws on miss;
    // catch + return false.
    const exists = await access(resolvedOut, fsConstants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      conflictSet.add(resolvedOut);
    }
  });

  await Promise.all(existencePromises);
  return Array.from(conflictSet).sort();
}

/**
 * Phase 6 Gap-Fix Round 3 (2026-04-25) — IPC entry point for the
 * 'export:probe-conflicts' channel. Wraps probeExportConflicts with
 * the same shape validation handleStartExport uses (cheap T-01-02-01
 * trust-boundary check) plus the 'outDir IS source-images-dir' hard
 * reject — that case is NEVER offered as a confirmation prompt
 * because every output would collide; the user has to pick a
 * different folder regardless.
 *
 * No exportInFlight mutation; safe to call repeatedly without
 * blocking subsequent startExport.
 */
export async function handleProbeExportConflicts(
  plan: unknown,
  outDir: unknown,
): Promise<ProbeConflictsResponse> {
  if (typeof outDir !== 'string' || outDir.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'outDir must be a non-empty string' } };
  }
  const planErr = validateExportPlan(plan);
  if (planErr !== null) {
    return { ok: false, error: { kind: 'Unknown', message: `Invalid plan: ${planErr}` } };
  }
  const validPlan = plan as ExportPlan;

  // Hard-reject: outDir IS the source-images dir itself. Every output
  // would collide; not a useful prompt — keep the friendlier message.
  // Mirrors the same check in handleStartExport (locked at both layers
  // so the renderer never has to special-case the response shape).
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.indexOf('/images/');
    if (idx >= 0) {
      const sourceImagesDir = normalised.slice(0, idx + '/images'.length);
      if (path.resolve(outDir) === path.resolve(sourceImagesDir)) {
        return {
          ok: false,
          error: {
            kind: 'invalid-out-dir',
            message:
              'Output directory IS the source images folder. ' +
              'Every output would overwrite a source — pick a different folder.',
          },
        };
      }
    }
  }

  const conflicts = await probeExportConflicts(validPlan, outDir);
  return { ok: true, conflicts };
}

export async function handleSkeletonLoad(jsonPath: unknown): Promise<LoadResponse> {
  // T-01-02-01: input validation at the trust boundary.
  if (typeof jsonPath !== 'string' || jsonPath.length === 0 || !jsonPath.endsWith('.json')) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `Invalid path argument: expected a non-empty string ending in .json`,
      },
    };
  }

  try {
    const t0 = performance.now();
    const load = loadSkeleton(jsonPath);
    const sampled = sampleSkeleton(load);
    const elapsedMs = performance.now() - t0;
    const summary = buildSummary(load, sampled, elapsedMs);
    return { ok: true, summary };
  } catch (err) {
    if (err instanceof SpineLoaderError && KNOWN_KINDS.has(err.name as KnownErrorKind)) {
      // T-01-02-02: surface only the error name + message; never any trace.
      return {
        ok: false,
        error: { kind: err.name as KnownErrorKind, message: err.message },
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
}

/**
 * Phase 6 Plan 05 — F8.1 + D-118 folder picker.
 *
 * Opens the native OS folder picker. Properties array includes BOTH
 * platform-specific create-folder hints (createDirectory = macOS,
 * promptToCreate = Windows) per RESEARCH §Common Pitfalls #3.
 * defaultPath is honored on both platforms.
 *
 * Returns the chosen absolute path or null if the user cancels.
 * The renderer's AppShell click handler treats null as "user changed
 * their mind — do not mount OptimizeDialog".
 */
export async function handlePickOutputDirectory(defaultPath?: string): Promise<string | null> {
  // Use the focused window if available so the picker is modal to it.
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: 'Choose output folder for optimized images',
    defaultPath,
    buttonLabel: 'Export Here',
    properties: [
      'openDirectory',
      'createDirectory',   // macOS — allow creating new folder in picker
      'promptToCreate',    // Windows — prompt if entered path doesn't exist
      'dontAddToRecent',   // Windows — don't pollute recent docs
    ],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

/**
 * Phase 6 Plan 05 — D-115 + D-122 + F8.4 export start.
 *
 * Wraps src/main/image-worker.ts runExport with:
 *   - re-entrancy guard via exportInFlight flag (rejects 'already-running').
 *   - outDir validation (the hard-reject case: outDir IS source-images-dir).
 *   - shape validation of plan (T-01-02-01 trust-boundary input check).
 *   - one-way progress emission via evt.sender.send('export:progress', ...).
 *   - cancel-flag closure for the runExport isCancelled callback.
 *
 * Returns ExportResponse envelope (mirrors LoadResponse — D-10).
 *
 * Validation order matters:
 *   1. Re-entrancy first (cheapest; protects everything below).
 *   2. outDir / plan shape validation BEFORE setting exportInFlight (so
 *      validation rejections do not poison the flag for follow-up calls).
 *   3. outDir-IS-source-images-dir hard-reject BEFORE setting exportInFlight.
 *   4. Defense-in-depth probe (skipped when overwrite=true).
 *   5. Only after all input validation passes do we claim the slot.
 *
 * Gap-Fix Round 3 (2026-04-25): the round-2 folder-position-only rejection
 * was over-cautious — picking the SKELETON folder (parent of images/) is
 * a common organizational pattern and is fine when no `images/` subfolder
 * yet exists. The new contract: hard-reject ONLY when outDir IS the
 * source-images dir itself; otherwise rely on the renderer's
 * probe-then-confirm flow (api.probeExportConflicts → ConflictDialog →
 * startExport(overwrite=true)). The probe is also re-run here as
 * defense-in-depth when overwrite=false, so any caller bypassing the
 * renderer flow still gets the precise conflict list rather than silent
 * source-file destruction.
 */
export async function handleStartExport(
  evt: Electron.IpcMainInvokeEvent | { sender: { send: (channel: string, ...args: unknown[]) => void } },
  plan: unknown,
  outDir: unknown,
  overwrite: boolean = false,
): Promise<ExportResponse> {
  // D-115: re-entrancy guard — checked FIRST so a second invocation while
  // a first is pending sees the flag set and bails immediately.
  if (exportInFlight) {
    return { ok: false, error: { kind: 'already-running', message: 'An export is already in progress.' } };
  }

  // T-01-02-01: validate types at the boundary.
  if (typeof outDir !== 'string' || outDir.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'outDir must be a non-empty string' } };
  }
  const planErr = validateExportPlan(plan);
  if (planErr !== null) {
    return { ok: false, error: { kind: 'Unknown', message: `Invalid plan: ${planErr}` } };
  }
  const validPlan = plan as ExportPlan;

  // Gap-Fix Round 3 (2026-04-25) — hard-reject ONLY when outDir IS the
  // source-images dir itself. Every other folder-position case is now
  // permitted; per-row file collisions are surfaced via
  // probeExportConflicts + the renderer's overwrite modal. This hard-reject
  // case CANNOT be rescued by overwrite=true (every output would collide;
  // not a useful confirmation prompt — the user must pick a different
  // folder regardless).
  //
  // Source images dir is derived from row[0].sourcePath via the
  // loader convention `<skeletonDir>/images/<regionName>.png`. For nested
  // regions (e.g. 'AVATAR/FACE'), use the FIRST '/images/' segment so
  // nested subfolders don't fool the prefix check.
  //
  // Empty plans skip this check (no source path to derive from).
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.indexOf('/images/');
    if (idx >= 0) {
      const sourceImagesDir = normalised.slice(0, idx + '/images'.length);
      if (path.resolve(outDir) === path.resolve(sourceImagesDir)) {
        return {
          ok: false,
          error: {
            kind: 'invalid-out-dir',
            message:
              'Output directory IS the source images folder. ' +
              'Every output would overwrite a source — pick a different folder.',
          },
        };
      }
    }
  }

  // D-115: claim the slot, reset cancel. This MUST happen synchronously
  // BEFORE any await so a re-entrant invocation that runs in the same
  // microtask queue (i.e. a second handleStartExport call kicked off
  // before the first one's promise resolves) sees the flag set and
  // bails with 'already-running'. The empty-plan path also goes through
  // here so re-entrancy is uniformly enforced regardless of plan size.
  //
  // Gap-Fix Round 3 (2026-04-25): the slot claim moved BEFORE the
  // defense-in-depth probe (which awaits Promise.all) — without this,
  // the first await yielded the event loop before the flag was set and
  // the re-entrancy guard test failed. Probe-rejection still clears the
  // flag via the finally block below, so a follow-up call after a probe
  // rejection is not silently pre-poisoned.
  exportInFlight = true;
  exportCancelFlag = false;
  try {
    // Gap-Fix Round 3 (2026-04-25) — defense-in-depth conflict probe.
    // When overwrite=false (the safe default), re-run the same probe the
    // renderer used pre-start; if any conflicts are present, reject with
    // 'overwrite-source' carrying the precise list. The renderer's
    // probe-then-confirm flow ensures we never reach this branch in normal
    // operation (the renderer would have shown ConflictDialog and either
    // cancelled or sent overwrite=true) — this is the safety net for any
    // caller that bypasses the renderer flow (e.g. future automation,
    // a misbehaving renderer, or any test invocation).
    //
    // When overwrite=true, the user has explicitly confirmed via
    // ConflictDialog "Overwrite all"; bypass the per-row collision check
    // entirely and trust the worker's allowOverwrite=true gate to skip
    // its own defense-in-depth check too.
    if (!overwrite) {
      const conflicts = await probeExportConflicts(validPlan, outDir);
      if (conflicts.length > 0) {
        return {
          ok: false,
          error: {
            kind: 'overwrite-source',
            message: `${conflicts.length} file(s) would be overwritten. Probe before starting.`,
            conflicts,
          },
        };
      }
    }

    const summary = await runExport(
      validPlan,
      outDir,
      (e) => {
        // webContents.send may throw if the renderer has gone away
        // mid-export (window closed). Swallow — the export still
        // completes and the summary is returned to whoever is left.
        try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ }
      },
      () => exportCancelFlag,
      overwrite,
    );
    return { ok: true, summary };
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
    };
  } finally {
    exportInFlight = false;
    exportCancelFlag = false;
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
  // Phase 6 Plan 05 — export channels.
  ipcMain.handle('dialog:pick-output-dir', async (_evt, defaultPath) =>
    handlePickOutputDirectory(typeof defaultPath === 'string' ? defaultPath : undefined),
  );
  // Gap-Fix Round 3 (2026-04-25) — 'export:probe-conflicts' channel: the
  // renderer probes BEFORE startExport so it can mount ConflictDialog with
  // the precise list of files that would be overwritten and offer
  // Cancel / Pick-different-folder / Overwrite-all. No exportInFlight
  // mutation; safe to call repeatedly.
  ipcMain.handle('export:probe-conflicts', async (_evt, plan, outDir) =>
    handleProbeExportConflicts(plan, outDir),
  );
  // Gap-Fix Round 3 (2026-04-25) — 'export:start' gains `overwrite` as a
  // 3rd argument. Strict `=== true` check: any non-true value (undefined,
  // null, 0, false) keeps the safe default and re-runs the probe.
  ipcMain.handle('export:start', async (evt, plan, outDir, overwrite) =>
    handleStartExport(evt, plan, outDir, overwrite === true),
  );
  ipcMain.on('export:cancel', () => {
    // D-115: cooperative cancel. Flag is read on every iteration of the
    // runExport loop between files. In-flight cannot be aborted mid-libvips.
    exportCancelFlag = true;
  });
  ipcMain.on('shell:open-folder', (_evt, dir) => {
    // T-06-14: typeof + length check. dir originates from the renderer's
    // outDir which already passed handleStartExport validation, so this
    // is a defense-in-depth check.
    if (typeof dir === 'string' && dir.length > 0) {
      try {
        shell.showItemInFolder(dir);
      } catch {
        // showItemInFolder may throw on some platforms for non-existent
        // paths — silent (one-way channel; nothing to return).
      }
    }
  });
}
