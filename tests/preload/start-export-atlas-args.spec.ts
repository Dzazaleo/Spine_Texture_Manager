/**
 * Phase 40 Plan 07 — Preload bridge contract test for the widened `startExport`
 * signature (D-04 adds `outputMode` + `atlasOpts` as 5th + 6th positional args).
 *
 * Same source-grep-as-test pattern as
 * `tests/preload/request-pending-update.spec.ts`: the preload runs in a
 * sandboxed Electron context that we cannot mount inside jsdom, so we assert
 * the bridge shape statically from disk.
 *
 * Locks:
 *   1. `startExport` arrow accepts 6 named positional parameters (renderer-side
 *      perspective: plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts).
 *   2. `ipcRenderer.invoke('export:start', ...)` forwards all 6 args plus the
 *      channel name (`evt` is added by Electron at index 0 on the main side).
 *   3. The `Api.startExport` type declaration in shared/types.ts widened to
 *      include the new 5th + 6th positional args.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PRELOAD_PATH = 'src/preload/index.ts';
const SHARED_TYPES_PATH = 'src/shared/types.ts';

function preloadSource(): string {
  return readFileSync(PRELOAD_PATH, 'utf8');
}

function sharedTypesSource(): string {
  return readFileSync(SHARED_TYPES_PATH, 'utf8');
}

describe('Phase 40 Plan 07 — preload bridge: widened startExport signature', () => {
  it('(1) preload `startExport` arrow accepts 6 positional args (plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts)', () => {
    const src = preloadSource();
    // The arrow declaration on the preload side. Argument list must contain
    // outputMode + atlasOpts after sharpenEnabled.
    const arrowRe =
      /startExport\s*:\s*\(\s*plan\s*,\s*outDir\s*,\s*overwrite\s*,\s*sharpenEnabled\s*,\s*outputMode\s*,\s*atlasOpts\s*\)/;
    expect(
      arrowRe.test(src),
      "preload startExport must list 6 params: (plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts)",
    ).toBe(true);
  });

  it('(2) `ipcRenderer.invoke(\'export:start\', ...)` forwards outputMode + atlasOpts', () => {
    const src = preloadSource();
    // Match the invoke call inside startExport bridge — must reference both
    // outputMode and atlasOpts as forwarded args.
    expect(/ipcRenderer\.invoke\(\s*['"]export:start['"][\s\S]*?outputMode[\s\S]*?atlasOpts/.test(src)).toBe(true);
  });

  it('(3a) `outputMode` symbol appears at least twice in preload (arg + forwarded)', () => {
    const src = preloadSource();
    const matches = src.match(/\boutputMode\b/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('(3b) `atlasOpts` symbol appears at least twice in preload (arg + forwarded)', () => {
    const src = preloadSource();
    const matches = src.match(/\batlasOpts\b/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('(4) Api.startExport type declaration includes outputMode field with literal union "loose" | "atlas" | "both"', () => {
    const src = sharedTypesSource();
    // The Api.startExport block declares the new positional arg type.
    expect(/outputMode\s*:\s*'loose'\s*\|\s*'atlas'\s*\|\s*'both'/.test(src)).toBe(true);
  });

  it('(5) Api.startExport type declaration includes atlasOpts: { maxPageSize; allowRotation; padding }', () => {
    const src = sharedTypesSource();
    expect(/atlasOpts\s*:\s*\{[\s\S]*?maxPageSize[\s\S]*?allowRotation[\s\S]*?padding/.test(src)).toBe(true);
  });
});
