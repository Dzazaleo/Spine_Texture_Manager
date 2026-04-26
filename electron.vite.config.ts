/**
 * Phase 1 — electron-vite bundler config.
 *
 * Drives `npm run dev` (HMR renderer + Electron window) and `npm run build`
 * (bundled main/preload/renderer into `out/` for electron-builder to package).
 *
 * Architecture invariants:
 *   - D-06/D-07: main process owns `src/core/*` (node:fs); renderer never imports it.
 *   - CLAUDE.md Fact #5 Layer 2: renderer.resolve.alias intentionally omits any
 *     entry pointing at src/core — if downstream renderer code writes a bare
 *     aliased import into core, bundler resolution fails; the arch-test in
 *     `tests/arch.spec.ts` catches the relative-path escape hatch.
 *   - D-11: Tailwind v4 via `@tailwindcss/vite` plugin (no postcss.config, no
 *     tailwind.config.js).
 *
 * electron-vite v5 defaults `build.externalizeDeps: true` — the main/preload
 * bundles automatically externalize everything in `dependencies` (including
 * `@esotericsoftware/spine-core`), so we do NOT need the deprecated externalize-
 * deps plugin helper from v4.
 */
import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    // Emit CJS with `.cjs` extension. electron-vite v5 default `build.externalizeDeps: true`
    // handles externals for `@esotericsoftware/spine-core` and any future runtime deps,
    // but the main-bundle FORMAT still has to be CommonJS — Electron's main process under
    // Node 24 cannot destructure named imports (`import { app, BrowserWindow } from 'electron'`)
    // from the `electron` built-in, which exposes a CJS module.exports object. The ESM loader
    // throws `SyntaxError: Named export 'app' not found. The requested module 'electron' is a
    // CommonJS module ...` at runtime. Because package.json declares `"type": "module"`,
    // a plain `.js` output would be interpreted as ESM; the `.cjs` extension forces CJS
    // resolution regardless of the package type. Mirrors the preload CJS fix from Plan 01-05
    // (commit b5d6988). Reference: electron-vite v5 docs + Node 24 ESM loader behaviour.
    build: {
      rollupOptions: {
        // Phase 9 Plan 02 D-190 — emit the sampler worker as a separate
        // main-bundle entry so `new Worker(workerPath)` can spawn it at
        // runtime. The default single-entry shorthand picks up
        // src/main/index.ts only; we extend with explicit input objects
        // covering both index.ts AND sampler-worker.ts.
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'sampler-worker': resolve(__dirname, 'src/main/sampler-worker.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  preload: {
    // Emit CJS with `.cjs` extension. Electron's sandbox mode (D-06 pinned in
    // src/main/index.ts) requires a CommonJS preload — sandboxed renderers
    // cannot load ESM preloads. Because package.json declares `"type": "module"`,
    // a plain `.js` output would be interpreted as ESM by Node/Electron; the
    // `.cjs` extension forces CJS resolution regardless of the package type.
    // Reference: electron-vite v5 docs + Electron sandbox tutorial (Electron 20+).
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
