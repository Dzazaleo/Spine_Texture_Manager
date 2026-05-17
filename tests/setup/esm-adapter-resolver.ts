// tests/setup/esm-adapter-resolver.ts — Phase 43 (43-03), Option A.
//
// TEST-INFRASTRUCTURE ONLY. Registered via `setupFiles` in vitest.config.ts.
// This file is NEVER imported by `src/` and NEVER enters the electron-vite
// worker bundle, so the production worker keeps its ambient-`require` lazy
// single-copy guarantee (ARCHITECTURE §4) unchanged from Plan 02.
//
// Why this exists: `package.json` is `"type":"module"`, so under vitest the
// ambient `require` that `pickRuntime` uses in the production CJS worker is
// undefined. `pickRuntime`'s production path resolves runtime-42/runtime-43
// via lazy `require('./runtime-4x.js')`; under ESM we instead bind an injected
// resolver here. This is RESOLUTION-ONLY: it statically imports the REAL
// runtime-42 / runtime-43 modules and returns their real `create()` adapter —
// it does NOT mock or stub anything. SAFE-02 must exercise the real
// runtime-42.111 path; this seam only changes HOW the adapter module is
// located under ESM, not WHAT runs.
import { __setEsmAdapterResolver } from '../../src/core/runtime/runtime.js';
import type { SpineRuntime } from '../../src/core/runtime/runtime.js';
import type { RuntimeTag } from '../../src/core/runtime/types.js';
import * as runtime42 from '../../src/core/runtime/runtime-42.js';
import * as runtime43 from '../../src/core/runtime/runtime-43.js';

// Static-import the real adapters and bind the resolver. The adapter instance
// cache lives in runtime.ts (pickRuntime memoizes), so this only does module
// resolution + `create()`; identical observable behavior to the worker's
// `require('./runtime-4x.js').create()`.
__setEsmAdapterResolver((tag: RuntimeTag): SpineRuntime => {
  const mod = tag === '4.2' ? runtime42 : runtime43;
  return (mod as { create: () => SpineRuntime }).create();
});
