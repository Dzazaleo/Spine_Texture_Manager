/**
 * Phase 1 Plan 02 — IPC handler for `'skeleton:load'`.
 *
 * Two exports:
 *   - `handleSkeletonLoad(jsonPath)` — pure async function wrapping
 *     `loadSkeleton` + `sampleSkeleton` + `buildSummary`; testable in vitest
 *     without spinning up Electron.
 *   - `registerIpcHandlers()` — wires `handleSkeletonLoad` into
 *     `ipcMain.handle('skeleton:load', ...)`. Called once in
 *     `app.whenReady()` from `src/main/index.ts`.
 *
 * Typed-error envelope (D-10): `SpineLoaderError` subclasses are caught and
 * translated to `{ok: false, error: {kind, message}}` discriminated union.
 * Unknown errors fall through to `kind: 'Unknown'` with the error message —
 * we deliberately surface only name + message; stack-trace fields are never
 * included (T-01-02-02 information-disclosure mitigation).
 *
 * Input validation (T-01-02-01): jsonPath must be a non-empty string ending
 * in `.json`. Renderer-origin arguments cross a trust boundary — the check
 * is cheap and prevents pathological inputs from reaching `fs.readFileSync`.
 *
 * Imports from `../core/*.js` are allowed only because this file lives in
 * `src/main/` — the renderer is structurally prevented from reaching here
 * by the tsconfig.web.json / electron.vite.config.ts / tests/arch.spec.ts
 * three-layer defense (CLAUDE.md Fact #5).
 */
import { ipcMain } from 'electron';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';
import { SpineLoaderError } from '../core/errors.js';
import { buildSummary } from './summary.js';
import type { LoadResponse, SerializableError } from '../shared/types.js';

type KnownErrorKind = SerializableError['kind'];

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);

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
    const peaks = sampleSkeleton(load);
    const elapsedMs = performance.now() - t0;
    const summary = buildSummary(load, peaks, elapsedMs);
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

export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
}
