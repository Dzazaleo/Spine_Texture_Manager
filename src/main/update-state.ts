/**
 * Phase 12 Plan 01 Task 1 — Auto-update persistence layer (D-08).
 *
 * A tiny, robust JSON store for the auto-update flow's "Later" decisions
 * and the Windows-spike outcome flag. The on-disk file lives at
 * `app.getPath('userData')/update-state.json` and follows the
 * `UpdateStateV1` schema:
 *
 *     { version: 1,
 *       dismissedUpdateVersion: string | null,    // CONTEXT.md D-08
 *       spikeOutcome: 'unknown' | 'pass' | 'fail' // CONTEXT.md D-01/D-02 (Task 6) }
 *
 * Per D-08 (CONTEXT line 49) the dismissed version is the user's "Later"
 * choice — when the available version is `<=` dismissedUpdateVersion the
 * UpdateDialog stays suppressed; when a NEWER version becomes available the
 * prompt re-fires. The strict semver comparison is performed by
 * src/main/auto-update.ts; this module only persists the value.
 *
 * Per D-06/D-08 silent-swallow contract (mirrors Phase 8.2 D-177 recent.ts
 * posture), `loadUpdateState` swallows every failure (missing file,
 * malformed JSON, unknown/newer version, wrong-type fields) and returns
 * the documented default. The diagnostic signal is "the prompt re-fires
 * for a previously-dismissed version" — a future polish phase could log
 * to console; out of scope here.
 *
 * Layer 3 invariant: this file lives in `src/main` (not `src/core`)
 * because it consumes `app.getPath('userData')`. The ONLY 'electron' import
 * is `app` — no `Menu`, `BrowserWindow`, `dialog`, or `ipcMain` is
 * permitted in this module. Plan 01 Task 2 (`auto-update.ts`) consumes
 * `loadUpdateState` and `setDismissedVersion` from here.
 *
 * Pattern lineage:
 *   - Atomic-write idiom (`<path>.tmp` + `fs.rename`) lifted from
 *     `src/main/recent.ts:88-96` (writeRecentFileAtomic). Pitfall 2
 *     same-directory tmp avoids EXDEV cross-device errors. POSIX atomic;
 *     Windows best-effort, acceptable for a settings file.
 *   - Hand-rolled type guard with discriminated `{ ok: true; ... } | { ok: false }`
 *     envelope mirrors `validateRecentFile` (`src/main/recent.ts:54-71`,
 *     D-156). Version FIRST gating (D-151 discipline) — unknown OR newer
 *     versions both load as the default per D-08.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app } from 'electron';

/** v1 on-disk schema. */
export type UpdateStateV1 = {
  version: 1;
  /** Last "Later"-clicked available version (D-08). null on first launch. */
  dismissedUpdateVersion: string | null;
  /**
   * Phase 12 Plan 01 Task 6 spike outcome (CONTEXT D-01/D-02). Set by
   * the user-supervised Windows spike runbook AFTER live verification.
   * Default `'unknown'` is treated as `'fail'` (manual-fallback variant)
   * by `src/main/auto-update.ts` Windows branching.
   */
  spikeOutcome: 'unknown' | 'pass' | 'fail';
};

/** Absolute path to the update-state.json file inside the per-user Electron data dir. */
const UPDATE_STATE_PATH = path.join(app.getPath('userData'), 'update-state.json');

/** Documented default — returned by loadUpdateState on any silent-swallow path. */
const DEFAULT_STATE: UpdateStateV1 = {
  version: 1,
  dismissedUpdateVersion: null,
  spikeOutcome: 'unknown',
};

/**
 * Hand-rolled type guard for unknown JSON parsed off disk.
 *
 * Discriminated envelope mirrors `validateRecentFile` (recent.ts:54-71).
 * Version FIRST gate (D-151 discipline carried forward) — unknown OR newer
 * versions both return `{ ok: false }`. The result envelope is intentionally
 * simpler than `validateProjectFile`'s (no error.kind/message) per D-08:
 * update-state failures are silent — the renderer never sees a typed error.
 *
 * `dismissedUpdateVersion` accepts `string | null` (null is the documented
 * "never dismissed" marker; reject `undefined`, numbers, objects, arrays).
 * `spikeOutcome` is restricted to the three documented union members.
 */
export function validateUpdateStateFile(
  input: unknown,
): { ok: true; state: UpdateStateV1 } | { ok: false } {
  if (!input || typeof input !== 'object') return { ok: false };
  const obj = input as Record<string, unknown>;

  // Version FIRST — gate before any other field interpretation (mirrors
  // validateRecentFile.recent.ts:62-64; D-151 / D-156 discipline carried
  // forward; per D-08 unknown OR newer versions both load as default).
  if (typeof obj.version !== 'number') return { ok: false };
  if (obj.version !== 1) return { ok: false };

  // dismissedUpdateVersion: string | null. Reject undefined / number / object.
  if (
    obj.dismissedUpdateVersion !== null &&
    typeof obj.dismissedUpdateVersion !== 'string'
  ) {
    return { ok: false };
  }

  // spikeOutcome: closed enum. Reject any other string OR non-string.
  if (
    obj.spikeOutcome !== 'unknown' &&
    obj.spikeOutcome !== 'pass' &&
    obj.spikeOutcome !== 'fail'
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    state: {
      version: 1,
      dismissedUpdateVersion: obj.dismissedUpdateVersion as string | null,
      spikeOutcome: obj.spikeOutcome,
    },
  };
}

/**
 * Atomic-write helper (lift from `src/main/recent.ts:88-96`).
 *
 *   1. JSON.stringify with 2-space indent (human-readable for debugging).
 *   2. writeFile to `<finalPath>.tmp` (same directory — Pitfall 2 avoids
 *      EXDEV cross-device errors).
 *   3. rename to final path (POSIX atomic; Windows best-effort, acceptable
 *      per D-08 — update-state.json is non-critical UX state).
 *
 * Failures propagate as exceptions and are swallowed by callers
 * (loadUpdateState's catch returns DEFAULT_STATE; setDismissedVersion lets
 * the exception bubble — the caller in auto-update.ts wraps the call site
 * with its own try/catch IPC pattern).
 */
async function writeUpdateStateFileAtomic(
  state: UpdateStateV1,
  finalPath: string,
): Promise<void> {
  const json = JSON.stringify(state, null, 2);
  const tmpPath = finalPath + '.tmp';
  await writeFile(tmpPath, json, 'utf8');
  await rename(tmpPath, finalPath);
}

/**
 * D-08 — read `update-state.json` and return the persisted state.
 *
 * Returns DEFAULT_STATE on any failure: missing file (ENOENT), malformed
 * JSON, unknown/newer schema version, wrong-type fields. MUST NOT throw —
 * update-state persistence is non-critical UX state and a malformed file
 * MUST NOT block app launch or auto-update polling.
 */
export async function loadUpdateState(): Promise<UpdateStateV1> {
  try {
    const text = await readFile(UPDATE_STATE_PATH, 'utf8');
    const parsed: unknown = JSON.parse(text);
    const v = validateUpdateStateFile(parsed);
    return v.ok ? v.state : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * D-08 — persist `version` as the user's last "Later" choice.
 *
 * Loads the current state, overwrites `dismissedUpdateVersion`, preserves
 * `spikeOutcome`, and writes atomically via `<path>.tmp` + rename. The
 * caller (auto-update.ts dismissUpdate handler) is responsible for the
 * trust-boundary `typeof version === 'string'` guard — this module is a
 * dumb store.
 */
export async function setDismissedVersion(version: string): Promise<void> {
  const current = await loadUpdateState();
  const next: UpdateStateV1 = { ...current, dismissedUpdateVersion: version };
  await writeUpdateStateFileAtomic(next, UPDATE_STATE_PATH);
}
