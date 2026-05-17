// scripts/register-esm-adapter-resolver.ts — Phase 43 (43-07, GAP-43-CLI-SEAM).
//
// CLI / Node-ENTRYPOINT-ONLY. Side-effect import: `scripts/cli.ts` imports this
// FIRST so the resolver is bound before any `pickRuntime` call. This is the
// Node-source-via-tsx analog of `tests/setup/esm-adapter-resolver.ts` (the
// vitest seam). It lives in `scripts/`, NOT `src/` — it is an entrypoint
// bootstrap, never bundled into the electron-vite production worker, so the
// LOCKED Option-A constraints (`project_phase43_pickruntime_esm_split`) hold:
//   (a) lazy single-copy is a PRODUCTION-WORKER property; the §4-adjudicated
//       doctrine scopes it to that bundle. The CLI is a dev/headless tool, not
//       the prod worker — statically importing both adapters here is exactly
//       what the sanctioned test setupFile does and does not touch the worker.
//   (b) the prod ambient-`require` arm of pickRuntime is UNCHANGED — this only
//       binds arm (1) (the globalThis resolver), identical to vitest.
//   (c) RESOLUTION-ONLY: it returns the REAL runtime-42 / runtime-43
//       `create()` adapters — it mocks/stubs nothing.
//   (d) the ESM resolver is NOT moved into `src/`; it stays an out-of-core
//       seam (test infra + this CLI bootstrap), so `src/` never static-imports
//       an adapter.
//
// Why this exists: `package.json` is `"type":"module"`. Under `tsx scripts/cli.ts`
// the runtime is pure ESM-from-source — it is NEITHER vitest (no setupFiles
// resolver) NOR the built electron-vite CJS worker (no ambient `require` /
// emitted `../runtime-4x.cjs`). Before this file, `pickRuntime` fell through to
// its loud-throw arm and every `npm run cli` errored
// (`no ESM adapter resolver is registered and ambient require is unavailable`)
// — GAP-43-CLI-SEAM, the third runtime the 43-05/43-06 verification surface
// (vitest + built worker only) never exercised.
import { __setEsmAdapterResolver } from '../src/core/runtime/runtime.js';
import type { SpineRuntime } from '../src/core/runtime/runtime.js';
import type { RuntimeTag } from '../src/core/runtime/types.js';
import * as runtime42 from '../src/core/runtime/runtime-42.js';
import * as runtime43 from '../src/core/runtime/runtime-43.js';

// Bind the real adapters' resolver on globalThis (pickRuntime's arm 1). The
// adapter instance cache lives in runtime.ts (pickRuntime memoizes), so this
// only does module resolution + `create()` — observably identical to the
// production worker's `require('../runtime-4x.cjs').create()`.
__setEsmAdapterResolver((tag: RuntimeTag): SpineRuntime => {
  const mod = tag === '4.2' ? runtime42 : runtime43;
  return (mod as { create: () => SpineRuntime }).create();
});
