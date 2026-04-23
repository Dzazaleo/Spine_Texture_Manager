/**
 * Phase 1 Plan 03 — Electron preload script.
 *
 * Exposes a single-method `window.api` surface via contextBridge (D-07):
 *
 *     window.api.loadSkeletonFromFile(file: File): Promise<LoadResponse>
 *
 * Mechanism (RESEARCH Finding #1 — corrects CONTEXT.md D-09):
 *   1. Renderer's DropZone passes the raw DragEvent File to preload.
 *   2. Preload calls webUtils.getPathForFile(file) to resolve the absolute
 *      path — the legacy File.path property was removed in Electron 32; we
 *      target Electron 41.
 *   3. Preload validates non-empty path (Pitfall 3: getPathForFile returns ""
 *      for Files not backed by a disk file — e.g. synthesized in JS).
 *   4. Preload invokes ipcRenderer.invoke('skeleton:load', jsonPath) and
 *      returns the typed LoadResponse envelope to the renderer.
 *
 * Surface minimalism (D-07 + Security Domain V4): ONE method exposed. The
 * raw ipcRenderer global is NEVER exposed to the renderer. If a future
 * phase needs more methods, add them to the Api interface in
 * src/shared/types.ts and extend the api object here — the contextBridge
 * exposes only what this file explicitly names.
 *
 * Sandbox discipline (Pitfall 5): sandbox: true in src/main/index.ts means
 * this preload can ONLY import 'electron' (always externalized) and type-only
 * from '../shared/types.js' (erased at compile time). Adding a runtime npm
 * dep would break the preload load with "module not found" at runtime.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, LoadResponse } from '../shared/types.js';

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
