/**
 * Phase 12 Plan 01 Task 2 — electron-updater orchestrator (UPD-01..UPD-06).
 *
 * Wires `electron-updater` 6.8.3 (installed by Plan 12-02) into the main
 * process. Owns the entire update lifecycle:
 *   - Init: bind events, configure autoDownload=false / autoInstallOnAppQuit=false /
 *     allowPrerelease=true, schedule the 3.5s startup check.
 *   - Check: invoke `autoUpdater.checkForUpdates()` wrapped in
 *     `Promise.race` with a 10s hard timeout (UPD-05).
 *   - Deliver: bridge `update-available` / `update-downloaded` /
 *     `update-not-available` / `error` events to the renderer via the
 *     existing `getMainWindow().webContents.send` pattern (mirrors
 *     `evt.sender.send('export:progress', ...)` at src/main/ipc.ts:511).
 *   - Suppression: when `dismissedUpdateVersion >= info.version` (D-08
 *     strict semver `>` semantics), drop the available event silently.
 *   - Variant routing: gate the IPC payload's `variant` field on
 *     `IN_PROCESS_AUTO_UPDATE_OK` so the renderer mounts the correct
 *     dialog shape (auto-update OR manual-download per Phase 12 D-04 +
 *     Phase 16 D-05).
 *
 * Layer 3 invariant: lives in `src/main/`, freely imports `electron` and
 * `electron-updater`. NEVER imports from `src/core/` or `src/renderer/`.
 *
 * Anti-patterns avoided (per RESEARCH §"Anti-Patterns to Avoid"):
 *   - NO `autoUpdater.checkForUpdatesAndNotify()` — bypasses our modal.
 *   - NO `autoUpdater.autoDownload = true` — UPD-03 requires opt-in.
 *   - NO synchronous `quitAndInstall` inside an IPC handler — Pattern H
 *     wraps with `setTimeout(..., 0)` so the IPC ack returns first.
 *   - NO renderer imports — main is the single source of truth.
 *   - NO unbridged rejection — startup-mode errors silent-swallowed
 *     (UPD-05); manual-mode errors bridged to `update:error`.
 *
 * Pattern lineage:
 *   - `getMainWindow()` + try/catch IPC: src/main/ipc.ts:506-512
 *     (handleStartExport's `evt.sender.send('export:progress', ...)`).
 *   - setTimeout(0) deferral: src/main/index.ts:131-137
 *     (`project:confirm-quit-proceed`).
 *   - Idempotency boolean guard: standard Electron lifecycle pattern.
 */

import { app } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { getMainWindow } from './index.js';
import { loadUpdateState, setDismissedVersion } from './update-state.js';

// Phase 14 D-03 — shared payload shape for `update:available` and the new
// `update:request-pending` sticky-slot read channel. Identical to what
// sendToWindow('update:available', ...) already pushes today; defined as an
// exported alias so the sticky slot, the new handler, and the renderer-side
// preload bridge all reference the same single source of truth.
export type UpdateAvailablePayload = {
  version: string;
  summary: string;
  variant: 'auto-update' | 'manual-download';
  fullReleaseUrl: string;
};

// --- Constants -------------------------------------------------------------

/**
 * Startup-check delay (D-06). 3.5s after `app.whenReady()` resolves so the
 * user sees the load screen / interacts before any network activity. Plan
 * 01 Task 5 wires `setTimeout(checkUpdate(false), STARTUP_CHECK_DELAY_MS)`
 * inside `initAutoUpdater` so `index.ts` only needs to call init().
 */
const STARTUP_CHECK_DELAY_MS = 3500;

/**
 * Hard timeout on `checkForUpdates` (UPD-05 + D-06). 10s. Reasoning:
 *   - GitHub's CDN responds in <1s under normal conditions.
 *   - On flaky / offline networks the inner request can hang for minutes.
 *   - 10s is well above the p99 success latency and short enough that a
 *     background-blocked startup check doesn't pile state-internal work.
 *   - On rejection/timeout in startup mode: silent-swallow (UPD-05).
 */
const CHECK_TIMEOUT_MS = 10_000;

/**
 * Stable URL surface for "View full release notes" (D-09 / D-18 option (b)).
 * The Releases _index_ page is the backward-compat allow-list entry in
 * `src/main/ipc.ts` `SHELL_OPEN_EXTERNAL_ALLOWED`. Phase 16 D-04 widens the
 * allow-list to also accept per-release `/releases/tag/v{semver}` URLs, but
 * keeps this index URL accepted so any caller that still ships the index
 * literal (UpdateDialog "View full release notes" link, Plan 14-05 URL-
 * consistency regression gate) continues to work.
 *
 * Exported so Plan 16-04's IPC allow-list helper can import the canonical
 * literal rather than re-stating the URL in two places.
 */
export const GITHUB_RELEASES_INDEX_URL =
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases';

/**
 * Phase 16 D-01 / D-02 — single positive gate for in-process auto-update.
 *
 * Reads as "this platform supports the in-process auto-update flow." Linux
 * is the only platform where Squirrel-equivalent in-process swap works
 * reliably without external code-signing constraints:
 *   - macOS: Squirrel.Mac strict-validates the Designated Requirement
 *     against the running app's code signature; ad-hoc-signed builds (no
 *     Apple Developer ID — declined for v1.2 per CONTEXT.md, deferred
 *     to v1.3+) generate fresh per-build hashes that cannot match
 *     v1.1.x's stored DR. Empirically observed during Phase 15 v1.1.3
 *     Test 7-Retry round 3 (2026-04-29 — D-15-LIVE-2). Routing to
 *     manual-download closes the bug.
 *   - Windows: NSIS auto-update spike has never run live (Phase 12 D-02
 *     strict-spike bar). Defaults to manual-download until a Windows
 *     host runs the spike. The `update-state.json` `spikeOutcome` field
 *     can promote Windows to in-process at runtime (Outcome A/promotion
 *     path — Phase 14 D-13).
 *   - Linux: AppImage in-process swap works (no code-signing constraint).
 *
 * D-02 — runtime override stays Windows-only. There is NO parallel
 * `macSignedOk` field. macOS structurally requires Apple Developer ID
 * code-signing for Squirrel.Mac to accept the swap; a runtime flag flip
 * cannot fix that. If Apple Developer ID enrollment ever lands (v1.3+
 * earliest), that's a separate code change with its own gate constant.
 *
 * Replaces the prior Phase 12 D-04 gate which evaluated true on macOS and
 * routed Squirrel.Mac into the code-signature-mismatch failure mode for
 * every macOS update since v1.0.0 (see git history for the prior name).
 */
const IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux';

// --- Module state ----------------------------------------------------------

let initialized = false;

// Phase 14 D-03 — sticky slot for the latest 'update-available' payload.
// Cleared on user dismiss/download trigger (renderer drives via the existing
// `update:dismiss` IPC + Phase 14 Plan 03 download-click handler that calls
// clearPendingUpdateInfo()); overwritten by every newer `update:available`
// event. Returned by `update:request-pending` for late-mounting renderers
// per D-Discretion-2 (in-memory only — rebuilt on every cold start).
let pendingUpdateInfo: UpdateAvailablePayload | null = null;

// Phase 14 D-08 (Option a — thread-trigger). The trigger context for the
// in-flight `autoUpdater.checkForUpdates()` call. Set at the top of
// `checkUpdate()` BEFORE `Promise.race` begins; consumed by
// `deliverUpdateAvailable` to gate the dismissedUpdateVersion suppression
// (manual = skip suppression per D-05 asymmetric rule; startup/null = apply
// Phase 12 D-08 strict-`>` suppression verbatim).
//
// Why a module-level let-binding instead of a parameter: `update-available`
// fires asynchronously inside `autoUpdater.on(...)` — the originating
// `checkForUpdates()` Promise has already resolved by then, so the event
// handler cannot be passed the trigger via call frame. The slot is the
// least-invasive way to thread context across the async boundary; same
// shape as `mainWindowRef` at src/main/index.ts:74 (lazy module-scope ref).
let lastCheckTrigger: 'manual' | 'startup' | null = null;

// --- Public API ------------------------------------------------------------

/**
 * Bind `autoUpdater` event listeners (one-shot, idempotent), configure flags,
 * and schedule the 3.5s startup check.
 *
 * Called from `src/main/index.ts` inside `app.whenReady().then(...)` AFTER
 * `applyMenu(...)`. Subsequent calls are no-ops (idempotency guard prevents
 * double-binding event listeners).
 */
export function initAutoUpdater(): void {
  if (initialized) return;
  initialized = true;

  console.info('[auto-update] initAutoUpdater: entry');

  // UPD-03 — opt-in download. We control the trigger via `downloadUpdate()`.
  autoUpdater.autoDownload = false;

  // UPD-04 — restart only on user click. We control the trigger via
  // `quitAndInstallUpdate()`.
  autoUpdater.autoInstallOnAppQuit = false;

  // RC tags (1.1.0-rc1, rc2…) need `allowPrerelease: true` so the spike's
  // rc1 install detects rc2 over the same feed.
  autoUpdater.allowPrerelease = true;

  // Bind lifecycle events.
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.info(
      `[auto-update] event: update-available, version=${info.version}`,
    );
    void deliverUpdateAvailable(info);
  });

  autoUpdater.on('update-not-available', () => {
    console.info(
      `[auto-update] event: update-not-available, currentVersion=${app.getVersion()}`,
    );
    sendToWindow('update:none', { currentVersion: app.getVersion() });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.info(
      `[auto-update] event: update-downloaded, version=${info.version}`,
    );
    sendToWindow('update:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    // DevTools console-only logging per CONTEXT D-06 (Phase 12 has no
    // telemetry; Phase 13 owns Sentry wiring).
    console.error('[auto-update]', err.message);
    // Note: this handler fires for ALL autoUpdater errors. The mode-aware
    // suppression (silent on startup, IPC on manual) lives in `checkUpdate`'s
    // own try/catch around the Promise.race — when checkForUpdates rejects
    // OR autoUpdater emits 'error' during the same checkUpdate call, the
    // rejection caught in checkUpdate routes correctly. This unconditional
    // bridge sends `update:error` for autoUpdater-internal errors that arrive
    // OUTSIDE a checkUpdate call (extremely rare); the renderer
    // `manualCheckPendingRef` filter in AppShell ignores it on startup.
    sendToWindow('update:error', { message: err.message });
  });

  // UPD-01 — schedule the 3.5s startup check. Standard fire-and-forget; the
  // checkUpdate body silent-swallows on rejection/timeout in startup mode.
  setTimeout(() => {
    console.info('[auto-update] startup-check: setTimeout fired');
    void checkUpdate(false);
  }, STARTUP_CHECK_DELAY_MS);
}

/**
 * Trigger a check. `triggeredManually=true` for Help → Check for Updates;
 * `false` for the 3.5s startup check.
 *
 * Manual mode: any rejection becomes `update:error` IPC. Startup mode:
 * silent-swallow per UPD-05 (no error dialog, no crash, no nag).
 *
 * Wraps `autoUpdater.checkForUpdates()` in `Promise.race` with a 10s
 * timeout to bound the network wait.
 */
export async function checkUpdate(triggeredManually: boolean): Promise<void> {
  // Phase 14 D-08 — record trigger context for `deliverUpdateAvailable` to
  // consume when the asynchronous `update-available` event fires. The slot
  // is sticky across the Promise.race boundary; it is NOT reset in finally
  // because `update-available` may arrive AFTER `checkForUpdates()` resolves
  // (electron-updater fires events as side effects of the resolved Promise).
  // The next checkUpdate() call overwrites it; that ordering is correct
  // because at most one check is in flight at a time (no internal concurrency).
  lastCheckTrigger = triggeredManually ? 'manual' : 'startup';
  console.info(
    `[auto-update] checkUpdate: trigger=${lastCheckTrigger}, version=${app.getVersion()}`,
  );

  try {
    await Promise.race([
      autoUpdater.checkForUpdates(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('check-timeout')), CHECK_TIMEOUT_MS),
      ),
    ]);
    console.info(
      `[auto-update] checkUpdate: race-resolved trigger=${lastCheckTrigger}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[auto-update] checkUpdate', message);
    if (triggeredManually) {
      sendToWindow('update:error', { message });
    }
    // Startup mode: silent (UPD-05). Per D-06 the diagnostic signal is the
    // DevTools console.error above; no IPC, no dialog.
  }
}

/**
 * Trigger the download. UPD-03 — opt-in: only fired when the user clicks
 * the "Download + Restart" button in `UpdateDialog` (state='available').
 * The renderer transitions the dialog to `state='downloading'` (indeterminate
 * spinner) and waits for `update:downloaded` to arrive.
 */
export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[auto-update] downloadUpdate', message);
    sendToWindow('update:error', { message });
  }
}

/**
 * Quit the app and apply the downloaded update. UPD-04 — only fired when
 * the user clicks the "Restart" button in `UpdateDialog` (state='downloaded').
 *
 * `autoUpdater.quitAndInstall(false, true)` is synchronous and quits the
 * process immediately. We MUST defer it via `setTimeout(..., 0)` so the
 * IPC send that triggered this call has time to ack to the renderer
 * before the app exits — same Pattern H idiom used at
 * src/main/index.ts:131-137 for `project:confirm-quit-proceed`.
 *
 * Args: `(isSilent=false, isForceRunAfter=true)`:
 *   - isSilent=false: show the installer UI on Windows (NSIS).
 *   - isForceRunAfter=true: relaunch the new app after install.
 */
export function quitAndInstallUpdate(): void {
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 0);
}

/**
 * Persist the user's "Later" decision. D-08 — `dismissedUpdateVersion`
 * is updated in `update-state.json` so subsequent startup checks suppress
 * the same version. A NEWER version (`> dismissedUpdateVersion` per the
 * strict semver compare in `deliverUpdateAvailable`) re-fires the prompt.
 */
export async function dismissUpdate(version: string): Promise<void> {
  try {
    await setDismissedVersion(version);
  } catch (err) {
    // Persistence failure is silent (UX state; non-critical). The user
    // will see the prompt again on next startup, which is annoying but
    // not broken.
    console.error('[auto-update] dismissUpdate', err);
  }
}

/**
 * Phase 14 D-03 — return the latest sticky update-available payload, or null.
 *
 * Renderer App.tsx calls this once on its update-subscription useEffect mount
 * (via `window.api.requestPendingUpdate()`) to handle the late-subscribe edge
 * case where main fired `update-available` BEFORE the renderer's React effect
 * committed (e.g., the 3.5s startup check resolving before React hydration
 * finishes). Returns null on first launch / no update.
 */
export function getPendingUpdateInfo(): UpdateAvailablePayload | null {
  return pendingUpdateInfo;
}

/**
 * Phase 14 D-03 — empty the sticky slot.
 *
 * Called by the renderer-side dismiss/download paths (Plan 03) so that a
 * subsequent `update:request-pending` invoke does not re-deliver a payload
 * the user has already acknowledged. Idempotent — safe to call when slot
 * is already null.
 */
export function clearPendingUpdateInfo(): void {
  pendingUpdateInfo = null;
}

// --- Internal helpers ------------------------------------------------------

/**
 * Compare two semver strings.
 *
 *   compareSemver('1.2.3', '1.2.3') === 0
 *   compareSemver('1.2.3', '1.2.4') === -1
 *   compareSemver('1.2.4', '1.2.3') === 1
 *   compareSemver('2.0.0', '1.99.99') === 1
 *
 * Pre-release / build-metadata suffixes (e.g. `-rc1`, `+build.5`) are
 * stripped from the numeric tuple — the spike runbook publishes
 * `1.1.0-rc1` → `1.1.0-rc2`, both of which become `[1, 1, 0]` here. The
 * D-08 suppression compare is exact-string when the available version
 * matches the dismissed version, so `'1.1.0-rc2'` dismissed and
 * `'1.1.0-rc2'` available will suppress correctly via the equal branch
 * in `deliverUpdateAvailable`. Re-firing on `1.1.0-rc3` requires both
 * tags to share the `1.1.0` numeric tuple — they do, so the strict-`>`
 * gate triggers on the pre-release suffix difference. Acceptable for
 * v1.1; if a more rigorous semver compare is needed later, swap to the
 * `semver` npm package (already a transitive dep of electron-updater).
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
  // Strip pre-release / build suffix for the numeric tuple compare.
  const numericA = a.split(/[-+]/)[0];
  const numericB = b.split(/[-+]/)[0];
  const pa = numericA.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = numericB.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  // Numeric tuples equal — check exact-string for pre-release differences.
  if (a === b) return 0;
  // Different pre-release tags but same numeric tuple — treat available as
  // newer when the dismissed has a pre-release suffix and available doesn't,
  // OR when their full strings are not equal (e.g. dismissed='1.1.0-rc1',
  // available='1.1.0-rc2' should re-fire). Conservative bias: any string
  // mismatch with equal numeric tuple resolves as "available is newer" so
  // we re-fire the prompt. False positives here are acceptable (extra
  // prompt) compared to false negatives (missed prompt for a newer version).
  if (a !== b) return -1;
  return 0;
}

/**
 * Extract the leading "Summary" section from `electron-updater`'s
 * `releaseNotes` field per D-09. Strips HTML tags. Plain-text only —
 * NO markdown rendering (HelpDialog precedent: zero XSS surface).
 *
 * Input forms (per electron-updater UpdateInfo type):
 *   - string: GitHub Release body markdown (REL-02 template format).
 *   - array: legacy multi-version notes; we join + re-extract.
 *   - null/undefined: no notes available; return ''.
 *
 * Extraction strategy:
 *   1. If string: locate `## Summary` (case-insensitive) followed by
 *      content until the next `\n##` or end-of-string.
 *   2. Fallback when no `## Summary`: take everything before the first
 *      `\n##` (the "intro paragraph" if any) — never returns the entire
 *      multi-section body.
 *   3. Strip HTML tags via simple regex (no DOMPurify; the strings are
 *      not rendered as HTML in the dialog — they go into a `<pre>` block).
 *   4. Trim whitespace.
 */
function extractSummary(
  notes: string | Array<{ version: string; note: string | null }> | null | undefined,
): string {
  if (notes === null || notes === undefined) return '';

  let text: string;
  if (Array.isArray(notes)) {
    // electron-updater's ReleaseNoteInfo.note is `string | null` — coerce
    // null entries to empty string before joining.
    text = notes.map((n) => n.note ?? '').join('\n');
  } else {
    text = notes;
  }

  // Locate `## Summary` (case-insensitive, no other prefix). Capture content
  // until the next `\n##` heading or end-of-string.
  const summaryMatch = /##\s*Summary\s*\n([\s\S]*?)(?=\n##\s|$)/i.exec(text);
  let extracted: string;
  if (summaryMatch) {
    extracted = summaryMatch[1];
  } else {
    // Fallback: text before the first `\n##` heading (the intro paragraph,
    // if any). When no headings exist, returns the full text.
    const firstHeading = text.indexOf('\n##');
    extracted = firstHeading >= 0 ? text.slice(0, firstHeading) : text;
  }

  // Strip HTML tags + trim. Plain text goes into a `<pre>` block in
  // UpdateDialog (D-09 + HelpDialog precedent: NO `dangerouslySetInnerHTML`).
  return extracted.replace(/<[^>]+>/g, '').trim();
}

/**
 * Bridge `update-available` to the renderer with D-08 suppression and
 * Phase 16 D-01 + D-02 variant routing.
 *
 * Suppression (D-08 strict `>` semantics): when the dismissed version is
 * newer-or-equal to the available version, drop the event. A NEWER version
 * re-fires the prompt — `dismissedUpdateVersion='1.2.3'` + `info.version='1.2.4'`
 * sends `update:available`; `dismissedUpdateVersion='1.2.4'` +
 * `info.version='1.2.3'` does NOT.
 *
 * Variant routing (Phase 16 D-01 + D-02 — supersedes the original Phase 12
 * D-04 routing framing): the platform-only gate IN_PROCESS_AUTO_UPDATE_OK
 * (Linux === true) routes Linux to 'auto-update'. macOS routes to
 * 'manual-download' unconditionally (Apple Developer ID code-signing required
 * for Squirrel.Mac swap on ad-hoc builds — declined for v1.2). Windows defaults
 * to 'manual-download' AND retains the Phase 12 D-02 runtime escape hatch:
 * `state.spikeOutcome === 'pass'` flips Windows to 'auto-update' without a
 * source change (used after a successful Windows-host spike per Phase 14 D-13).
 */
async function deliverUpdateAvailable(info: UpdateInfo): Promise<void> {
  const state = await loadUpdateState();

  // Phase 14 D-05 — asymmetric dismissal rule. Manual checks ALWAYS re-present
  // even when dismissedUpdateVersion >= available; the user explicitly clicked
  // Help → Check for Updates and expects feedback. Startup/null preserve the
  // Phase 12 D-08 strict-`>` suppression verbatim.
  const triggerSnapshot = lastCheckTrigger;
  const isManual = triggerSnapshot === 'manual';
  if (
    !isManual &&
    state.dismissedUpdateVersion !== null &&
    compareSemver(state.dismissedUpdateVersion, info.version) >= 0
  ) {
    console.info(
      `[auto-update] deliverUpdateAvailable: SUPPRESSED, ` +
        `trigger=${triggerSnapshot}, dismissed=${state.dismissedUpdateVersion}, ` +
        `available=${info.version}`,
    );
    return;
  }

  // Phase 16 D-01 + D-02 — single positive gate for in-process auto-update.
  // Linux always 'auto-update'. Windows 'auto-update' iff the runtime escape
  // hatch flag promotes (Phase 12 D-02 / Phase 14 D-13 — `spikeOutcome === 'pass'`
  // in update-state.json). Everything else routes to 'manual-download' (the
  // Phase 16 D-05 rename of the Phase 12 D-04 manual-fallback variant).
  const spikeRuntimePass = state.spikeOutcome === 'pass';
  const variant: 'auto-update' | 'manual-download' =
    IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)
      ? 'auto-update'
      : 'manual-download';

  // Phase 16 D-04 — per-release templated URL. Lands the user directly on the
  // release with the .dmg / .exe / .AppImage assets visible (one fewer click than
  // the index page). The IPC allow-list (src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED)
  // accepts both the index URL (kept for backward-compat) and any /releases/tag/v{semver}
  // URL — see Plan 16-04 isReleasesUrl helper.
  const payload: UpdateAvailablePayload = {
    version: info.version,
    summary: extractSummary(info.releaseNotes),
    variant,
    fullReleaseUrl: `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}`,
  };

  // Phase 14 D-03 — populate sticky slot BEFORE sendToWindow so a renderer
  // mounting between this assignment and the IPC ack can still pick it up
  // via `update:request-pending`.
  pendingUpdateInfo = payload;

  console.info(
    `[auto-update] deliverUpdateAvailable: DELIVERED, ` +
      `trigger=${triggerSnapshot}, variant=${variant}, version=${info.version}`,
  );

  sendToWindow('update:available', payload);
}

/**
 * Send a payload to the main BrowserWindow's renderer. Mirrors
 * `evt.sender.send('export:progress', ...)` at src/main/ipc.ts:511 with
 * the difference that auto-update events fire OUT OF BAND (no `evt`
 * available — they originate from `autoUpdater.on(...)` callbacks), so
 * we resolve the window via `getMainWindow()` and null-guard.
 *
 * Try/catch swallows the `Object has been destroyed` error that fires
 * when the renderer has gone away mid-flight.
 */
function sendToWindow(channel: string, payload: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send(channel, payload);
    } catch {
      // webContents gone — silent (one-way channel; nothing to return).
    }
  }
}
