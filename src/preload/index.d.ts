/**
 * Phase 1 Plan 03 — Renderer-side type augmentation for window.api.
 *
 * Consumed by `tsconfig.web.json` `include` list; teaches the renderer
 * TypeScript project about the `window.api` global exposed by the preload
 * (`src/preload/index.ts`) via `contextBridge.exposeInMainWorld('api', ...)`.
 *
 * File must be `.d.ts` (not `.ts`) so tsconfig.web.json picks up ONLY the
 * declaration without bundling the runtime preload code into the renderer.
 *
 * The Api interface lives in `src/shared/types.ts` — this file only bridges
 * it into the renderer's `Window` type.
 */
import type { Api } from '../shared/types.js';

declare global {
  interface Window {
    api: Api;
  }
}

// `import type` makes this file a module automatically — no `export {}` needed.
