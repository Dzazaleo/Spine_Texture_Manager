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
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';
import { SpineLoaderError } from '../core/errors.js';
import { buildSummary } from './summary.js';
import { runExport } from './image-worker.js';
import type {
  ExportPlan,
  ExportResponse,
  LoadResponse,
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
 * Not exported — internal helper for handleStartExport.
 */
function isOutDirInsideSourceImages(outDir: string, sourceImagesDir: string): boolean {
  const resolvedOut = path.resolve(outDir);
  const resolvedSrc = path.resolve(sourceImagesDir);
  if (resolvedOut === resolvedSrc) return true;
  const rel = path.relative(resolvedSrc, resolvedOut);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

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
 *   - outDir validation (rejects equal-to or child-of source/images).
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
 *   3. outDir-not-source-images check BEFORE setting exportInFlight too.
 *   4. Only after all input validation passes do we claim the slot.
 */
export async function handleStartExport(
  evt: Electron.IpcMainInvokeEvent | { sender: { send: (channel: string, ...args: unknown[]) => void } },
  plan: unknown,
  outDir: unknown,
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

  // D-122 + F8.4 (Layer A): outDir must not be source/images or a child of it.
  // Source images dir is derived from row[0].sourcePath which the loader
  // sets as <skeletonDir>/images/<regionName>.png — so a /images/ slice
  // yields the source images folder for the topmost region. For nested
  // regions (e.g. 'AVATAR/FACE'), use the FIRST '/images/' segment so
  // nested subfolders don't fool the prefix check.
  //
  // Empty plans skip this check (no source path to derive from); they
  // proceed straight to runExport which loops zero times and returns
  // an empty summary.
  //
  // Friendlier early-exit message for the "user picked the source images
  // folder itself" case. The per-row collision check below (Layer B)
  // would also catch this, but the message is less direct than naming
  // the source images folder explicitly.
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.indexOf('/images/');
    const sourceImagesDir = idx >= 0
      ? normalised.slice(0, idx + '/images'.length)
      : path.dirname(firstSrc);

    if (isOutDirInsideSourceImages(outDir, sourceImagesDir)) {
      return {
        ok: false,
        error: {
          kind: 'invalid-out-dir',
          message: 'Output directory must not be the source images folder or a child of it.',
        },
      };
    }
  }

  // Gap-Fix Round 2 (2026-04-25) — Layer B per-row collision detection.
  // The Layer A guard above only catches the case where outDir IS or is
  // INSIDE the source images folder. It structurally CANNOT catch the
  // inverse: outDir is the PARENT of `images/` (e.g. user picks the
  // skeleton folder), where each row's resolved write path
  // `<outDir>/images/<region>.png` lands ON the source PNG in
  // `<skeletonDir>/images/<region>.png` and silently destroys it.
  //
  // For each row we resolve outDir + outPath and compare to:
  //   (1) the row's source PNG path (per-region PNG case)
  //   (2) the row's atlas page path (atlas-packed projects case)
  // Either equality is fatal — fail-fast BEFORE setting exportInFlight
  // so a guard rejection does not poison the slot for follow-up calls.
  // This runs in O(rows) once at pre-flight; cost is negligible vs the
  // sharp/libvips work that follows.
  for (const row of validPlan.rows) {
    const resolvedOut = path.resolve(outDir, row.outPath);
    if (path.resolve(row.sourcePath) === resolvedOut) {
      return {
        ok: false,
        error: {
          kind: 'overwrite-source',
          message:
            `Output would overwrite source PNG: ${row.sourcePath}. ` +
            `Pick an output directory that does NOT contain the project's source images folder.`,
        },
      };
    }
    if (row.atlasSource && path.resolve(row.atlasSource.pagePath) === resolvedOut) {
      return {
        ok: false,
        error: {
          kind: 'overwrite-source',
          message:
            `Output would overwrite atlas page: ${row.atlasSource.pagePath}. ` +
            `Pick an output directory that does NOT contain the project's atlas pages.`,
        },
      };
    }
  }

  // D-115: claim the slot, reset cancel. This MUST happen synchronously
  // BEFORE any await so a re-entrant invocation that runs in the same
  // microtask queue (i.e. a second handleStartExport call kicked off
  // before the first one's promise resolves) sees the flag set and
  // bails with 'already-running'. The empty-plan path also goes through
  // here so re-entrancy is uniformly enforced regardless of plan size.
  exportInFlight = true;
  exportCancelFlag = false;
  try {
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
  ipcMain.handle('export:start', async (evt, plan, outDir) => handleStartExport(evt, plan, outDir));
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
