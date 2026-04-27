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
import {
  handleProjectSave,
  handleProjectSaveAs,
  handleProjectOpen,
  handleProjectOpenFromPath,
  handleLocateSkeleton,
  handleProjectReloadWithSkeleton,
  handleProjectResample,
} from './project-io.js';
import { getSamplerWorkerHandle } from './sampler-worker-bridge.js';
// Phase 12 Plan 01 Task 4 — auto-update IPC bridge (UPD-01..UPD-06).
//
// auto-update.ts imports `getMainWindow` from `./index.js`, which means an
// eager `import { ... } from './auto-update.js'` here creates the same
// load-time cycle the Phase 8.2 menu-wiring already documents above
// (`ipc.ts → auto-update.ts → index.ts → recent.ts → app.getPath('userData')`).
// vitest specs that target handlers UNRELATED to auto-update (e.g.
// ipc-export.spec.ts) mock `electron` minimally and don't stub `protocol` /
// `app.getPath`, so eager evaluation aborts the spec before any test runs.
//
// We follow the established pattern: dynamic `await import('./auto-update.js')`
// inside the channel handlers below. The first call to any of the four
// auto-update channels triggers the module load on demand.
// Phase 8.2 D-181 — menu state surface lives in src/main/index.ts. We
// dereference applyMenu / setCurrentMenuState / getMainWindow via dynamic
// `await import('./index.js')` INSIDE the 'menu:notify-state' handler body
// rather than at module load time. Two reasons:
//   (a) `src/main/index.ts` imports `registerIpcHandlers` from this file —
//       eager `import { ... } from './index.js'` here creates a load-time
//       cycle. Node resolves it fine in production (the module graph
//       finishes before app.whenReady fires), but vitest's test files mock
//       `electron` minimally per-spec; test files that target
//       handlers UNRELATED to this menu wiring (e.g. ipc-export.spec.ts)
//       don't stub `app.getPath`, so the eager transitive load
//       `ipc.ts → index.ts → recent.ts → app.getPath('userData')` throws
//       at module-evaluation time and the spec aborts before any test runs.
//   (b) Dynamic `await import(...)` defers the index.ts module load until
//       the FIRST 'menu:notify-state' notify, so spec files that never
//       fire that channel can mock electron however they want without
//       paying the recent.ts module-load cost. ipc.spec.ts (this plan)
//       mocks recent.js + electron's app.getPath itself, so its tests
//       still see the import resolve cleanly.
import type {
  ExportPlan,
  ExportResponse,
  LoadResponse,
  ProbeConflictsResponse,
  SerializableError,
} from '../shared/types.js';

// Phase 8.1 D-158 — handleSkeletonLoad's SpineLoaderError forwarder produces
// only non-recovery error kinds. Excluding 'SkeletonNotFoundOnLoadError' here
// makes TypeScript verify the forwarder cannot accidentally produce the
// recovery-payload arm of the SerializableError union without populating its
// 7 threaded fields (see project-io.ts NonRecoveryKind for the parallel
// narrowing at the project-open rescue branches).
type KnownErrorKind = Exclude<SerializableError['kind'], 'SkeletonNotFoundOnLoadError'>;

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

// ---------------------------------------------------------------------------
// Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — closed allow-list of URLs that
// the 'shell:open-external' handler will pass to shell.openExternal.
//
// Defense in depth: the contextBridge surface (window.api.openExternalUrl)
// only exposes the channel to the trusted renderer; this allow-list catches
// (a) accidental mistakes — typo'd URLs in HelpDialog source, and
// (b) any future renderer compromise that tries to inject arbitrary URLs.
// shell.openExternal with arbitrary user-controlled input is a documented
// Electron sandbox-escape vector (https://www.electronjs.org/docs/latest/
// tutorial/security) — never call it without an allow-list when the URL
// crosses an IPC boundary.
//
// Comparison is exact-string equality via Set.has — no prefix matching, no
// scheme-only checks, no trailing-slash leniency. To add a new entry, the
// HelpDialog author MUST update this Set verbatim with the URL the dialog
// hands to window.api.openExternalUrl. Mismatches are silently dropped (the
// channel is one-way; nothing to return).
//
// NEVER allow user-controlled (e.g., skeletonPath, projectPath) URLs in this
// list. The list is hardcoded at compile time on purpose.
// ---------------------------------------------------------------------------
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  // Spine documentation references that HelpDialog (Plan 07) links to.
  // These are the canonical Spine 4.2 docs the project's help content
  // points to per CONTEXT.md §"Documentation button" (Claude's Discretion).
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
  // Phase 12 Plan 01 (D-09 + D-18 option (b)) — the Releases _index_ page is
  // the stable URL surface for the UpdateDialog "View full release notes" link
  // AND the Windows-fallback "Open Release Page" button. We intentionally do
  // NOT add per-tag URLs (which would require pattern support); the user
  // navigates one click further to the specific release. INSTALL.md URL is
  // added by Plan 12-06 — DO NOT add it here.
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
]);

/**
 * Phase 6 REVIEW L-04 (2026-04-25) — the previous Round 2 helper
 * `isOutDirInsideSourceImages` (folder-position-only rejection) was
 * superseded by the Round 3+4 inline equality check + the F_OK probe in
 * `probeExportConflicts`. The dead helper + its `void`-call workaround
 * have been removed. If a future phase needs a structural folder-policy
 * check it can re-introduce the helper from git history; carrying it
 * live as `void`-suppressed dead code added maintenance burden and
 * risked confusing readers about the active contract.
 */

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
  // Gap-Fix Round 4 (2026-04-25) — collision == "would clobber a file that
  // currently exists". Existence on disk (F_OK) is the only correct gate.
  // The earlier round-3 synchronous string-match checks against row.sourcePath
  // and row.atlasSource.pagePath false-positived: the loader still constructs
  // sourcePath as <skeletonDir>/images/<regionName>.png even for atlas-only
  // projects (the atlas-extract fallback runs at write time), so any outDir
  // landing on the same string triggered the alarm even after the user had
  // manually deleted the images folder.
  const existencePromises = plan.rows.map(async (row) => {
    const resolvedOut = path.resolve(outDir, row.outPath);
    const exists = await access(resolvedOut, fsConstants.F_OK)
      .then(() => true)
      .catch(() => false);
    return exists ? resolvedOut : null;
  });
  const results = await Promise.all(existencePromises);
  const conflictSet = new Set<string>();
  for (const r of results) if (r !== null) conflictSet.add(r);
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
  //
  // Phase 6 REVIEW M-01 (2026-04-25) — use `lastIndexOf('/images/')` so
  // the derivation matches relativeOutPath in src/core/export.ts:117 and
  // src/renderer/src/lib/export-view.ts:98. The inner `/images/` is the
  // export folder; any earlier `/images/` (e.g. user's working layout
  // `~/work/images/joker_project/images/CIRCLE.png`) is part of the
  // user's directory hierarchy and must not be treated as the
  // source-images dir.
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.lastIndexOf('/images/');
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
  // regions (e.g. 'AVATAR/FACE'), use the LAST '/images/' segment so the
  // inner export folder is identified — `lastIndexOf` matches the parsing
  // in relativeOutPath (src/core/export.ts:117 +
  // src/renderer/src/lib/export-view.ts:98), so a user layout like
  // `~/work/images/joker_project/images/CIRCLE.png` correctly resolves
  // sourceImagesDir to `~/work/images/joker_project/images` rather than
  // `~/work/images`.
  //
  // Phase 6 REVIEW M-01 (2026-04-25) — switched indexOf → lastIndexOf
  // for parity with the relativeOutPath parsers in core/export.ts and
  // export-view.ts. The Round 4 F_OK probe still catches the actual
  // collision case as defense-in-depth, but the friendlier
  // 'invalid-out-dir' message is now correct for the parent-of-images
  // working-layout edge case.
  //
  // Empty plans skip this check (no source path to derive from).
  if (validPlan.rows.length > 0) {
    const firstSrc = validPlan.rows[0].sourcePath;
    const normalised = firstSrc.replace(/\\/g, '/');
    const idx = normalised.lastIndexOf('/images/');
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

  // Phase 9 Plan 02 D-194 — forceful sampler cancel via worker.terminate().
  // The byte-frozen sampler (D-102) has no inner-loop emit point so cooperative
  // flag-checking is impossible. terminate() halts JS execution as soon as
  // possible (typically <50 ms; ≤200 ms budget per D-194). Pitfall 6: terminate
  // does NOT run finally blocks — the Phase 9 worker has no resources to clean
  // up (pure compute job per N2.3) so this is safe.
  //
  // Trust boundary (T-09-02-IPC-01): renderer-origin one-way send with no
  // payload. Idempotent: if no worker is in flight, terminate() is a no-op.
  // We do NOT additionally validate evt.sender — the contextBridge surface
  // only exposes cancelSampler() to the trusted renderer.
  ipcMain.on('sampler:cancel', () => {
    const handle = getSamplerWorkerHandle();
    if (handle !== null) {
      void handle.terminate();
    }
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

  // Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — open an external URL in the
  // system browser. Allow-list-validated (SHELL_OPEN_EXTERNAL_ALLOWED) before
  // the shell.openExternal call. Silent rejection on:
  //   - non-string / empty payload (typeof / length guard)
  //   - URL not in the closed allow-list
  // The channel is one-way (renderer→main fire-and-forget); there is no
  // envelope to return on rejection. Plan 07 (HelpDialog) consumes this
  // bridge to open Spine documentation links from the in-app help view.
  ipcMain.on('shell:open-external', (_evt, url) => {
    if (typeof url !== 'string' || url.length === 0) return;
    if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
    try {
      void shell.openExternal(url);
    } catch {
      // shell.openExternal can throw on platforms where the default browser
      // is misconfigured. Silent — one-way channel; nothing to return.
    }
  });

  // Phase 12 Plan 01 — auto-update IPC surface (UPD-01..UPD-06).
  //
  // Four channels:
  //   - 'update:check-now' (invoke): Help → Check for Updates manual trigger.
  //     Forwards to checkUpdate(true); on rejection main bridges 'update:error'.
  //   - 'update:download' (invoke): UpdateDialog "Download + Restart" click.
  //     Opt-in download (UPD-03 — autoDownload=false in auto-update.ts).
  //   - 'update:dismiss' (one-way send): UpdateDialog "Later" click.
  //     Persists dismissedUpdateVersion via D-08 atomic-write to
  //     update-state.json. Trust-boundary typeof guard mirrors
  //     'shell:open-external' (line 612-613) — non-string / empty payload
  //     silently dropped.
  //   - 'update:quit-and-install' (one-way send): UpdateDialog "Restart"
  //     click after download. quitAndInstallUpdate uses Pattern H
  //     setTimeout(0) deferral so this IPC ack returns to the renderer
  //     BEFORE autoUpdater.quitAndInstall fires (synchronous quit).
  ipcMain.handle('update:check-now', async () => {
    const { checkUpdate } = await import('./auto-update.js');
    return checkUpdate(true);
  });
  ipcMain.handle('update:download', async () => {
    const { downloadUpdate } = await import('./auto-update.js');
    return downloadUpdate();
  });
  ipcMain.on('update:dismiss', (_evt, version) => {
    if (typeof version !== 'string' || version.length === 0) return;
    void (async () => {
      const { dismissUpdate } = await import('./auto-update.js');
      await dismissUpdate(version);
    })();
  });
  ipcMain.on('update:quit-and-install', () => {
    void (async () => {
      const { quitAndInstallUpdate } = await import('./auto-update.js');
      quitAndInstallUpdate();
    })();
  });

  // Phase 8 — project file IPC channels (D-140..D-156). Six invoke channels
  // routing to src/main/project-io.ts. Trust-boundary validation lives inside
  // each handler (typeof + extension checks; mirrors handleSkeletonLoad:227-235).
  ipcMain.handle('project:save', async (_evt, state, currentPath) =>
    handleProjectSave(state, currentPath),
  );
  ipcMain.handle('project:save-as', async (_evt, state, defaultDir, defaultBasename) =>
    handleProjectSaveAs(state, defaultDir, defaultBasename),
  );
  ipcMain.handle('project:open', async (_evt) => handleProjectOpen());
  ipcMain.handle('project:open-from-path', async (_evt, absolutePath) =>
    handleProjectOpenFromPath(absolutePath),
  );
  ipcMain.handle('project:locate-skeleton', async (_evt, originalPath) =>
    handleLocateSkeleton(originalPath),
  );
  // D-149 recovery (Approach A): dedicated path-based skeleton-reload channel.
  // Renderer calls this AFTER locate-skeleton resolves, with the user-picked
  // .json path + the overrides/settings cached from the failed Open. Returns
  // OpenResponse so the renderer mounts via the same path used for Open
  // (no new state-machine branch).
  ipcMain.handle('project:reload-with-skeleton', async (_evt, args) =>
    handleProjectReloadWithSkeleton(args),
  );
  // Phase 9 Plan 06 — re-sample on samplingHz change. The renderer dispatches
  // this from SettingsDialog.onApply when the user picks a new rate; main re-
  // runs loader + sampler-worker + buildSummary + stale-key intersect and
  // returns OpenResponse for the same mountOpenResponse seam used for Open.
  // Trust-boundary input checks live inside handleProjectResample
  // (T-09-06-RESAMPLE-INPUT / -HZ / -OVERRIDES). Cancellation works through
  // the existing 'sampler:cancel' handler above (worker.terminate()).
  ipcMain.handle('project:resample', async (_evt, args) =>
    handleProjectResample(args),
  );

  // Phase 8.2 D-181 — renderer pushes menu state on change. Main rebuilds
  // + reapplies the application Menu on every notify. One-way (ipcMain.on
  // / ipcRenderer.send) — no envelope returned. Silent rejection on bad
  // input (defense-in-depth; preload is the trusted surface).
  //
  // The dynamic `await import('./index.js')` is deliberate (see the comment
  // block at the top of this file): it defers the index.ts ↔ ipc.ts cycle
  // resolution until the first notify, so unrelated test specs that mock
  // `electron` minimally don't fail at module-load time.
  ipcMain.on('menu:notify-state', async (_evt, state: unknown) => {
    // T-08.2-03-01 trust-boundary input validation — same shape as
    // validateExportPlan (ipc.ts:106-126) and the inline checks in
    // handleProjectSave (project-io.ts:97-112).
    if (!state || typeof state !== 'object') return;
    const s = state as Record<string, unknown>;
    if (typeof s.canSave !== 'boolean') return;
    if (typeof s.canSaveAs !== 'boolean') return;
    if (typeof s.modalOpen !== 'boolean') return;

    const next = {
      canSave: s.canSave,
      canSaveAs: s.canSaveAs,
      modalOpen: s.modalOpen,
    };
    const { applyMenu, getMainWindow, setCurrentMenuState } = await import('./index.js');
    setCurrentMenuState(next);
    // Fire-and-forget — applyMenu awaits loadRecent() internally; we don't
    // block the IPC return on it (one-way channel; no response).
    void applyMenu(next, getMainWindow());
  });
}
