/**
 * Phase 31 PLATFORM-01 — Windows elevation probe.
 *
 * On Windows, an app running as administrator cannot receive DnD events
 * from non-elevated processes (Explorer) — UIPI message-filter blocks
 * the WM_DROPFILES path. Today the user drops a file on the window and
 * nothing happens (silent failure). This module probes elevation ONCE
 * at boot, caches the result in a module-level boolean, and exposes it
 * to the renderer via the `'platform:isElevated'` IPC channel so the
 * UI can render an explanatory advisory in place of the DropZone body.
 *
 * Why `net session`? It's a stock Windows command that requires admin
 * privileges to succeed. Exit code 0 → elevated; non-zero → not elevated.
 * No new npm dep; uses Node's `child_process` (already available in
 * Electron main).
 *
 * Layer 3 invariant: this file uses `process.platform` and is therefore
 * carved out of `tests/arch.spec.ts` PLATFORM_CARVE_OUTS Set (D-23
 * portability gate). Co-locates platform branching to a dedicated,
 * single-responsibility file (CONTEXT.md C-D-01 / Pattern S-05 option b).
 *
 * Why one-shot at boot (not on focus / restore)? Windows cannot change
 * a running process's token mid-life — once an Electron main is launched
 * elevated, it stays elevated for its entire lifetime. Re-probing is
 * unnecessary (CONTEXT.md `<deferred>` line 192).
 */
import { exec } from 'node:child_process';

let isElevatedCache = false;

/**
 * Probe Windows elevation via `net session` exec. Idempotent (writes to
 * a module-level cache). Resolves on completion regardless of outcome.
 * Safe default: `false` on any error (CONTEXT.md C-D-01).
 *
 * Non-Windows: short-circuits without exec'ing anything (CONTEXT.md C-D-05).
 */
export function probeElevation(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (process.platform !== 'win32') {
      isElevatedCache = false;
      resolve();
      return;
    }
    try {
      exec('net session', { windowsHide: true, timeout: 5000 }, (err) => {
        // Exit code 0 (err === null) → elevated. Non-zero or any error
        // (timeout, command not found, access denied) → not elevated.
        isElevatedCache = err === null;
        resolve();
      });
    } catch {
      // Defensive: in the (vanishingly unlikely) event exec itself throws
      // synchronously, default to false. Renderer gets working DnD.
      isElevatedCache = false;
      resolve();
    }
  });
}

/**
 * Read the cached elevation flag. Always synchronous; safe to call from
 * IPC handler at invoke time (no I/O).
 */
export function getIsElevated(): boolean {
  return isElevatedCache;
}

/**
 * Test-only seed: set the cache directly without exec'ing. Used by
 * vitest specs to inject elevation state without spawning processes.
 * NOT exported through any production code path.
 */
export function __setIsElevatedForTesting(value: boolean): void {
  isElevatedCache = value;
}
