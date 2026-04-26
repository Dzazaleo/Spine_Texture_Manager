/**
 * Phase 8.2 — Open Recent persistence layer (D-177, D-178, D-180).
 *
 * A tiny, robust JSON store for the File → Open Recent submenu. The on-disk
 * file lives at `app.getPath('userData')/recent.json` and follows the
 * `RecentFileV1` schema: `{ version: 1, paths: string[] }`.
 *
 * Per D-177, recent.json is non-critical UX state and MUST NOT block app
 * launch on any malformed-state condition. `loadRecent` therefore swallows
 * every failure (missing file, malformed JSON, unknown/newer version,
 * non-array paths, non-string elements) and returns `[]`. The diagnostic
 * signal is "no recent items appear in the menu" — a future polish phase
 * could log to console; out of scope here.
 *
 * Layer 3 invariant: this file lives in `src/main` (not `src/core`) because
 * it consumes `app.getPath('userData')`. The ONLY 'electron' import is
 * `app` — no `Menu`, `BrowserWindow`, `dialog`, or `ipcMain` is permitted
 * in this module. Plan 02 (menu builder) and Plan 03 (IPC + project-io
 * wiring) consume `loadRecent` / `addRecent` / `clearRecent` from here.
 *
 * Pattern lineage:
 *   - Atomic-write idiom (`<path>.tmp` + `fs.rename`) lifted from
 *     `src/main/project-io.ts:172-221` (writeProjectFileAtomic). Pitfall 2
 *     same-directory tmp avoids EXDEV cross-device errors. POSIX atomic;
 *     Windows best-effort, acceptable for a settings file.
 *   - Hand-rolled type guard with discriminated `{ ok: true; ... } | { ok: false }`
 *     envelope mirrors `validateProjectFile` (`src/core/project-file.ts:84-203`,
 *     D-156). Version FIRST gating (D-151 discipline) — unknown OR newer
 *     versions both load as `[]` per D-177.
 */

import { readFile, writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app } from 'electron';

/** v1 on-disk schema. */
export type RecentFileV1 = { version: 1; paths: string[] };

/** Absolute path to the recent.json file inside the per-user Electron data dir. */
const RECENT_PATH = path.join(app.getPath('userData'), 'recent.json');

/** Cap (D-178) — front of the array is newest; oldest entries are dropped on overflow. */
const MAX_RECENT = 10;

/**
 * Hand-rolled type guard for unknown JSON parsed off disk.
 *
 * Discriminated envelope mirrors `validateProjectFile` (D-156). Version FIRST
 * gate (D-151 discipline carried forward) — unknown OR newer versions both
 * return `{ ok: false }`. The result envelope is intentionally simpler than
 * `validateProjectFile`'s (no error.kind/message) per D-177: recent.json
 * failures are silent — the renderer never sees a typed error.
 */
export function validateRecentFile(
  input: unknown,
): { ok: true; file: RecentFileV1 } | { ok: false } {
  if (!input || typeof input !== 'object') return { ok: false };
  const obj = input as Record<string, unknown>;

  // Version FIRST — gate before any other field interpretation (mirrors
  // validateProjectFile lines 96-120; D-151 / D-156 discipline carried
  // forward; per D-177 unknown OR newer versions both load as []).
  if (typeof obj.version !== 'number') return { ok: false };
  if (obj.version !== 1) return { ok: false };

  if (!Array.isArray(obj.paths)) return { ok: false };
  for (const p of obj.paths) {
    if (typeof p !== 'string' || p.length === 0) return { ok: false };
  }
  return { ok: true, file: { version: 1, paths: obj.paths as string[] } };
}

/**
 * Atomic-write helper (lift from `src/main/project-io.ts:172-221`).
 *
 *   1. JSON.stringify with 2-space indent (human-readable for debugging).
 *   2. writeFile to `<finalPath>.tmp` (same directory — Pitfall 2 avoids
 *      EXDEV cross-device errors).
 *   3. rename to final path (POSIX atomic; Windows best-effort, acceptable
 *      per D-177 — recent.json is non-critical UX state).
 *
 * Unlike `writeProjectFileAtomic`, this does NOT return a SaveResponse
 * envelope — failures propagate as exceptions and are swallowed by callers
 * (loadRecent's catch returns [], addRecent rethrows since the caller in
 * Plan 03 handles the failure as a no-op, and clearRecent leaves the surface
 * to the IPC layer).
 */
async function writeRecentFileAtomic(
  recent: RecentFileV1,
  finalPath: string,
): Promise<void> {
  const json = JSON.stringify(recent, null, 2);
  const tmpPath = finalPath + '.tmp';
  await writeFile(tmpPath, json, 'utf8');
  await rename(tmpPath, finalPath);
}

/**
 * D-177 — read `recent.json` and return the persisted paths array.
 *
 * Returns `[]` on any failure: missing file (ENOENT), malformed JSON,
 * unknown/newer schema version, non-array paths, non-string elements.
 * MUST NOT throw — recent persistence is non-critical UX state and a
 * malformed file MUST NOT block app launch.
 *
 * Front of the array is newest (push-to-front semantics in `addRecent`).
 */
export async function loadRecent(): Promise<string[]> {
  try {
    const text = await readFile(RECENT_PATH, 'utf8');
    const parsed: unknown = JSON.parse(text);
    const v = validateRecentFile(parsed);
    return v.ok ? v.file.paths : [];
  } catch {
    return [];
  }
}

/**
 * D-178, D-180 — push `absolutePath` to the front, dedupe any existing copy,
 * cap at 10 entries, and persist atomically. Returns the new paths array
 * (callers in Plan 03 use it to refresh the menu without a second read).
 *
 * The caller (Plan 03 project-io after successful Save As / Open) is
 * responsible for verifying that `absolutePath` is a `.stmproj` path — this
 * module is a dumb store. See `<threat_model>` T-08.2-01-06.
 */
export async function addRecent(absolutePath: string): Promise<string[]> {
  const current = await loadRecent();
  const filtered = current.filter((p) => p !== absolutePath);
  const next = [absolutePath, ...filtered].slice(0, MAX_RECENT);
  await writeRecentFileAtomic({ version: 1, paths: next }, RECENT_PATH);
  return next;
}

/**
 * D-177 — write `{ version: 1, paths: [] }` atomically.
 *
 * Wired to the File → Open Recent → Clear Menu item in Plan 02. Always emits
 * a v1 envelope (rather than deleting the file) so subsequent `loadRecent`
 * calls hit the validate-success fast path.
 */
export async function clearRecent(): Promise<void> {
  await writeRecentFileAtomic({ version: 1, paths: [] }, RECENT_PATH);
}
