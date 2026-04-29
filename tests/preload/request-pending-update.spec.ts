/**
 * Phase 14 Plan 02 — Preload bridge contract test for `requestPendingUpdate`.
 *
 * The preload script runs in Electron's sandbox-isolated context; we cannot
 * mount it inside a vitest jsdom worker the way we mount renderer specs.
 * Instead, we apply the source-grep-as-test pattern established by
 * `tests/arch.spec.ts` (architecture invariants) — read the preload source
 * file from disk and assert the bridge shape statically.
 *
 * This is sufficient for the contract guarantees Plan 02 must lock:
 *   1. `requestPendingUpdate` is exposed as a function on the bridged surface.
 *   2. It is wired to `ipcRenderer.invoke('update:request-pending')` exactly
 *      once with no extra args.
 *   3. It returns the resolved value of that invoke (single-line wrapper).
 *   4. The 4 existing one-shot bridges remain byte-for-byte (preserved keys).
 *   5. The 5 existing subscription bridges remain byte-for-byte (preserved keys).
 *
 * Plan 03 + Plan 04 will add functional renderer-mount coverage that exercises
 * the bridge end-to-end via `window.api.requestPendingUpdate()`. This static
 * spec is the contract gate that lives independently of any consumer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PRELOAD_PATH = 'src/preload/index.ts';

function preloadSource(): string {
  return readFileSync(PRELOAD_PATH, 'utf8');
}

describe('Phase 14 Plan 02 — preload bridge: requestPendingUpdate', () => {
  it('(1) `requestPendingUpdate` is declared as a method on the api object exactly once', () => {
    const src = preloadSource();
    const matches = src.match(/requestPendingUpdate\s*:/g) ?? [];
    expect(matches.length, 'requestPendingUpdate: must appear exactly once').toBe(1);
  });

  it('(2) calls `ipcRenderer.invoke(\'update:request-pending\')` exactly once', () => {
    const src = preloadSource();
    const invokeMatches =
      src.match(/ipcRenderer\.invoke\(\s*['"]update:request-pending['"]\s*\)/g) ?? [];
    expect(
      invokeMatches.length,
      "ipcRenderer.invoke('update:request-pending') must appear exactly once",
    ).toBe(1);
  });

  it('(3) the bridge is a one-shot invoke wrapper (no subscription listener scaffold)', () => {
    const src = preloadSource();
    // Locate the requestPendingUpdate block: from its declaration up to the
    // next top-level `,` followed by a newline and a JSDoc or method line.
    const block = src.match(
      /requestPendingUpdate\s*:\s*\([^)]*\)\s*:\s*Promise<[^>]*\{[^}]*\}\s*\|\s*null>\s*=>\s*ipcRenderer\.invoke\(\s*['"]update:request-pending['"]\s*\)/,
    );
    expect(
      block,
      'requestPendingUpdate must be a single-line arrow returning ipcRenderer.invoke directly',
    ).not.toBeNull();
  });

  it('(3b) the bridge does NOT wrap `ipcRenderer.on(\'update:request-pending\', ...)` (one-shot only)', () => {
    const src = preloadSource();
    const subscription =
      src.match(/ipcRenderer\.on\(\s*['"]update:request-pending['"]/g) ?? [];
    expect(
      subscription.length,
      'requestPendingUpdate is one-shot invoke; must not appear as a subscription channel',
    ).toBe(0);
  });

  it('(4) all 4 existing one-shot bridges remain present (byte-key preserved)', () => {
    const src = preloadSource();
    expect(src.match(/checkForUpdates\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/downloadUpdate\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/dismissUpdate\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/quitAndInstallUpdate\s*:/g)?.length ?? 0).toBe(1);
  });

  it('(5) all 5 existing subscription bridges remain present (byte-key preserved)', () => {
    const src = preloadSource();
    expect(src.match(/onUpdateAvailable\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/onUpdateDownloaded\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/onUpdateNone\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/onUpdateError\s*:/g)?.length ?? 0).toBe(1);
    expect(src.match(/onMenuCheckForUpdates\s*:/g)?.length ?? 0).toBe(1);
  });

  it('(5b) channel-name string `update:request-pending` matches main-process handler convention', () => {
    const src = preloadSource();
    // The main-process `update:*` namespace pattern (see existing
    // `update:check-now`, `update:download`, `update:dismiss`,
    // `update:quit-and-install`). Plan 01 adds `update:request-pending`.
    expect(src.includes("'update:request-pending'") || src.includes('"update:request-pending"')).toBe(
      true,
    );
  });
});
