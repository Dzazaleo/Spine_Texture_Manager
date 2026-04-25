/**
 * Phase 1 Plan 03 — Electron preload script.
 * Phase 6 Plan 05 — Extended with 5 export-pipeline bridges
 *   (pickOutputDirectory / startExport / cancelExport / onExportProgress /
 *   openOutputFolder). Replaces the Plan 06-02 NOT_YET_WIRED stubs with
 *   real ipcRenderer.invoke / .send / .on bridges.
 *
 * Exposes a multi-method `window.api` surface via contextBridge (D-07):
 *
 *     window.api.loadSkeletonFromFile(file: File): Promise<LoadResponse>
 *     window.api.pickOutputDirectory(defaultPath?): Promise<string | null>
 *     window.api.startExport(plan, outDir): Promise<ExportResponse>
 *     window.api.cancelExport(): void
 *     window.api.onExportProgress(handler): () => void  // returns unsubscribe
 *     window.api.openOutputFolder(dir): void
 *
 * Skeleton-load mechanism (RESEARCH Finding #1 — corrects CONTEXT.md D-09):
 *   1. Renderer's DropZone passes the raw DragEvent File to preload.
 *   2. Preload calls webUtils.getPathForFile(file) to resolve the absolute
 *      path — the legacy File.path property was removed in Electron 32; we
 *      target Electron 41.
 *   3. Preload validates non-empty path (Pitfall 3: getPathForFile returns ""
 *      for Files not backed by a disk file — e.g. synthesized in JS).
 *   4. Preload invokes ipcRenderer.invoke('skeleton:load', jsonPath) and
 *      returns the typed LoadResponse envelope to the renderer.
 *
 * Export-pipeline mechanism (Phase 6 Plan 05):
 *   - Request/response (invoke): pickOutputDirectory, startExport.
 *   - One-way send (no return): cancelExport, openOutputFolder.
 *   - Subscription (on + return unsubscribe): onExportProgress. The wrapped
 *     listener reference is captured in a local const BEFORE calling .on
 *     so the returned unsubscribe targets the SAME reference (RESEARCH
 *     §Pitfall 9 — listener identity preservation; without this, listeners
 *     accumulate and unsubscribe silently fails).
 *
 * Surface minimalism (D-07 + Security Domain V4): only the named api
 * methods are exposed. The raw ipcRenderer global is NEVER exposed to the
 * renderer. If a future phase needs more methods, add them to the Api
 * interface in src/shared/types.ts and extend the api object here — the
 * contextBridge exposes only what this file explicitly names.
 *
 * Sandbox discipline (Pitfall 5): sandbox: true in src/main/index.ts means
 * this preload can ONLY import 'electron' (always externalized) and type-only
 * from '../shared/types.js' (erased at compile time). Adding a runtime npm
 * dep would break the preload load with "module not found" at runtime.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, ExportProgressEvent, LoadResponse } from '../shared/types.js';

const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) {
      // Pitfall 3: file was synthesized (not backed by a disk file).
      // getPathForFile returns "" — surface a typed-error envelope inline,
      // do not round-trip to main.
      return {
        ok: false,
        error: {
          kind: 'Unknown',
          message: 'Dropped file has no filesystem path (not backed by a disk file).',
        },
      };
    }
    // Main-process handler validates string + .json extension + existence;
    // see src/main/ipc.ts handleSkeletonLoad.
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },

  // -------------------------------------------------------------------------
  // Phase 6 Plan 05 — export surface.
  // -------------------------------------------------------------------------

  /**
   * F8.1 + D-118: open OS folder picker. defaultPath honored cross-platform.
   * Returns the chosen absolute path or null if the user cancels.
   */
  pickOutputDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),

  /**
   * D-118 + D-119: start export. The plan is built renderer-side from
   * the local SkeletonSummary + overrides Map (Plan 06-06 AppShell).
   * Resolves with ExportResponse envelope when the export completes,
   * is cancelled, or is rejected (re-entrant / invalid-out-dir).
   * Per-file progress arrives on the separate onExportProgress channel.
   */
  startExport: (plan, outDir) =>
    ipcRenderer.invoke('export:start', plan, outDir),

  /**
   * D-115: one-way cancel signal. Fire-and-forget. The next progress
   * event the renderer receives will be the final one and startExport()
   * resolves with summary.cancelled === true.
   */
  cancelExport: (): void => {
    ipcRenderer.send('export:cancel');
  },

  /**
   * D-119 + RESEARCH §Pattern 3: subscribe to streaming export progress
   * events. Returns an unsubscribe function.
   *
   * Pitfall 9 (RESEARCH): the wrapped listener reference is captured in
   * a local const so removeListener targets the SAME reference, not a
   * new closure. Without this, listeners accumulate and unsubscribe
   * silently fails.
   */
  onExportProgress: (handler) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
    ipcRenderer.on('export:progress', wrapped);
    return () => {
      ipcRenderer.removeListener('export:progress', wrapped);
    };
  },

  /**
   * D-120 close-state action: open Finder/Explorer with the output
   * directory. One-way (shell.showItemInFolder has no useful return).
   */
  openOutputFolder: (dir: string): void => {
    ipcRenderer.send('shell:open-folder', dir);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    // contextBridge.exposeInMainWorld throws if called with an already-reserved
    // key or invalid shape — log to main-process stderr so we see it in dev.
    console.error('Failed to expose api via contextBridge:', error);
  }
} else {
  // D-06 pins contextIsolation: true — this branch never runs in our app.
  // Kept so the starter pattern's invariant is preserved; a future phase
  // flipping contextIsolation would still get a working window.api.
  // (Use globalThis rather than the DOM `window` global here so this file
  // typechecks under tsconfig.node.json's ES2022-only lib set — the node
  // project includes src/preload/index.ts but does not pull DOM types.)
  (globalThis as unknown as { api: Api }).api = api;
}
