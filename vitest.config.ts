import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Phase 7 Plan 04 — vitest uses esbuild to transform .tsx; without
  // jsx: 'automatic' it emits classic-runtime React.createElement calls
  // that throw `ReferenceError: React is not defined` because the spec
  // imports nothing named `React`. The renderer's own tsconfig.web.json
  // sets `"jsx": "react-jsx"` (automatic); aligning vitest's transformer
  // here matches that contract for renderer specs.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    // Phase 43 (43-03) Option A — test-infra-only ESM adapter resolver.
    // package.json is "type":"module", so under vitest the ambient `require`
    // that pickRuntime's production CJS-worker path uses is undefined. This
    // setupFile statically imports the REAL runtime-42/runtime-43 adapters and
    // binds pickRuntime's injectable resolver (resolution-only; NOT a mock —
    // SAFE-02 exercises the real runtime-42.111 path). It is NEVER imported by
    // src/ / the electron-vite worker bundle, so the worker keeps its
    // ambient-require lazy single-copy guarantee (ARCHITECTURE §4) unchanged.
    setupFiles: ['tests/setup/esm-adapter-resolver.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    // tests/_trace_tmp/ is a gitignored scratch dir for ad-hoc investigation
    // specs (see .gitignore); exclude it so CI/local runs don't trip on
    // throwaway probes left behind by debug sessions.
    exclude: ['node_modules/**', 'dist/**', 'tests/_trace_tmp/**'],
    globals: false,
    testTimeout: 10_000,
    passWithNoTests: true,
  },
});
