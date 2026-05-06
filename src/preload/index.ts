/**
 * Phase 1 Plan 03 — Electron preload script.
 * Phase 6 Plan 05 — Extended with 5 export-pipeline bridges
 *   (pickOutputDirectory / startExport / cancelExport / onExportProgress /
 *   openOutputFolder). Replaces the Plan 06-02 NOT_YET_WIRED stubs with
 *   real ipcRenderer.invoke / .send / .on bridges.
 *
 * Exposes a multi-method `window.api` surface via contextBridge (D-07):
 *
 *     window.api.loadSkeletonFromFile(file: File): Promise<LoadResponse>
 *     window.api.pickOutputDirectory(defaultPath?): Promise<string | null>
 *     window.api.startExport(plan, outDir): Promise<ExportResponse>
 *     window.api.cancelExport(): void
 *     window.api.onExportProgress(handler): () => void  // returns unsubscribe
 *     window.api.openOutputFolder(dir): void
 *
 * Skeleton-load mechanism (RESEARCH Finding #1 — corrects CONTEXT.md D-09):
 *   1. Renderer's DropZone passes the raw DragEvent File to preload.
 *   2. Preload calls webUtils.getPathForFile(file) to resolve the absolute
 *      path — the legacy File.path property was removed in Electron 32; we
 *      target Electron 41.
 *   3. Preload validates non-empty path (Pitfall 3: getPathForFile returns ""
 *      for Files not backed by a disk file — e.g. synthesized in JS).
 *   4. Preload invokes ipcRenderer.invoke('skeleton:load', jsonPath) and
 *      returns the typed LoadResponse envelope to the renderer.
 *
 * Export-pipeline mechanism (Phase 6 Plan 05):
 *   - Request/response (invoke): pickOutputDirectory, startExport.
 *   - One-way send (no return): cancelExport, openOutputFolder.
 *   - Subscription (on + return unsubscribe): onExportProgress. The wrapped
 *     listener reference is captured in a local const BEFORE calling .on
 *     so the returned unsubscribe targets the SAME reference (RESEARCH
 *     §Pitfall 9 — listener identity preservation; without this, listeners
 *     accumulate and unsubscribe silently fails).
 *
 * Surface minimalism (D-07 + Security Domain V4): only the named api
 * methods are exposed. The raw ipcRenderer global is NEVER exposed to the
 * renderer. If a future phase needs more methods, add them to the Api
 * interface in src/shared/types.ts and extend the api object here — the
 * contextBridge exposes only what this file explicitly names.
 *
 * Sandbox discipline (Pitfall 5): sandbox: true in src/main/index.ts means
 * this preload can ONLY import 'electron' (always externalized) and type-only
 * from '../shared/types.js' (erased at compile time). Adding a runtime npm
 * dep would break the preload load with "module not found" at runtime.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, ExportProgressEvent, LoadResponse } from '../shared/types.js';
// Phase 20 D-21 — Documentation HTML export. Type-only import: the actual
// renderDocumentationHtml + handleExportDocumentationHtml run in main; preload
// only forwards the structured-clone payload through ipcRenderer.invoke.
import type { DocExportPayload, DocExportResponse } from '../main/doc-export.js';

const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) {
      // Pitfall 3: file was synthesized (not backed by a disk file).
      // getPathForFile returns "" — surface a typed-error envelope inline,
      // do not round-trip to main.
      return {
        ok: false,
        error: {
          kind: 'Unknown',
          message: 'Dropped file has no filesystem path (not backed by a disk file).',
        },
      };
    }
    // Main-process handler validates string + .json extension + existence;
    // see src/main/ipc.ts handleSkeletonLoad.
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },

  // -------------------------------------------------------------------------
  // Phase 6 Plan 05 — export surface.
  // -------------------------------------------------------------------------

  /**
   * F8.1 + D-118: open OS folder picker. defaultPath honored cross-platform.
   * Returns the chosen absolute path or null if the user cancels.
   */
  pickOutputDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),

  /**
   * D-118 + D-119: start export. The plan is built renderer-side from
   * the local SkeletonSummary + overrides Map (Plan 06-06 AppShell).
   * Resolves with ExportResponse envelope when the export completes,
   * is cancelled, or is rejected (re-entrant / invalid-out-dir).
   * Per-file progress arrives on the separate onExportProgress channel.
   *
   * Gap-Fix Round 3 (2026-04-25) — `overwrite` flag forwarded as a 3rd
   * argument. When omitted or false, main re-runs the conflict probe as
   * defense-in-depth and rejects with `'overwrite-source'` if any files
   * would be overwritten. After ConflictDialog "Overwrite all", AppShell
   * passes overwrite=true and main bypasses the per-row collision check.
   */
  startExport: (plan, outDir, overwrite, sharpenEnabled) =>
    ipcRenderer.invoke(
      'export:start',
      plan,
      outDir,
      overwrite === true,
      sharpenEnabled === true, // Phase 28 SHARP-02
    ),

  /**
   * Gap-Fix Round 3 (2026-04-25) — pre-start conflict probe. The renderer
   * (AppShell) calls this BEFORE startExport so it can mount a
   * ConflictDialog listing the exact files that would be overwritten and
   * offer Cancel / Pick-different-folder / Overwrite-all. Empty conflicts
   * list === safe to start without a confirmation modal. No re-entrancy
   * mutation in main — safe to call repeatedly.
   */
  probeExportConflicts: (plan, outDir) =>
    ipcRenderer.invoke('export:probe-conflicts', plan, outDir),

  /**
   * D-115: one-way cancel signal. Fire-and-forget. The next progress
   * event the renderer receives will be the final one and startExport()
   * resolves with summary.cancelled === true.
   */
  cancelExport: (): void => {
    ipcRenderer.send('export:cancel');
  },

  /**
   * D-119 + RESEARCH §Pattern 3: subscribe to streaming export progress
   * events. Returns an unsubscribe function.
   *
   * Pitfall 9 (RESEARCH): the wrapped listener reference is captured in
   * a local const so removeListener targets the SAME reference, not a
   * new closure. Without this, listeners accumulate and unsubscribe
   * silently fails.
   */
  onExportProgress: (handler) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
    ipcRenderer.on('export:progress', wrapped);
    return () => {
      ipcRenderer.removeListener('export:progress', wrapped);
    };
  },

  /**
   * D-120 close-state action: open Finder/Explorer with the output
   * directory. One-way (shell.showItemInFolder has no useful return).
   */
  openOutputFolder: (dir: string): void => {
    ipcRenderer.send('shell:open-folder', dir);
  },

  // -------------------------------------------------------------------------
  // Phase 8 — project file IPC surface (D-140..D-156). Eight new bridges
  // (6 invoke + 1 listener + 1 sender). Replaces the Plan 01 NOT_YET_WIRED
  // stubs. Same precedent as Phase 6 Plan 02 commit 13d395e (which superseded
  // its stubs in Plan 06-05).
  // -------------------------------------------------------------------------

  /** F9.1 — write current session to a known .stmproj path (dirty save). */
  saveProject: (state, currentPath) =>
    ipcRenderer.invoke('project:save', state, currentPath),

  /** F9.1 — open native save-file picker, then write atomically. */
  saveProjectAs: (state, defaultDir, defaultBasename) =>
    ipcRenderer.invoke('project:save-as', state, defaultDir, defaultBasename),

  /** F9.2 — open native file picker, then chain to handleProjectOpenFromPath. */
  openProject: () => ipcRenderer.invoke('project:open'),

  /**
   * Drop-handler entry point. Resolves the dropped File's filesystem path
   * via webUtils.getPathForFile and forwards to the path-based handler.
   * Mirrors loadSkeletonFromFile (Phase 1 D-09 mechanism).
   *
   * Returns OpenResponse envelope with kind:'Unknown' when the File has no
   * underlying path (synthetic File from a test harness — Pitfall 5:
   * getPathForFile returns "" for Files not backed by a disk file).
   */
  openProjectFromFile: async (file: File) => {
    const projectPath = webUtils.getPathForFile(file);
    if (!projectPath) {
      return {
        ok: false,
        error: {
          kind: 'Unknown',
          message: 'Dropped project file has no filesystem path.',
        },
      } as const;
    }
    return ipcRenderer.invoke('project:open-from-path', projectPath);
  },

  /** F9.2 — direct path-based open (used by Phase 9 OS file association). */
  openProjectFromPath: (absolutePath) =>
    ipcRenderer.invoke('project:open-from-path', absolutePath),

  /** D-149 — open native picker for the replacement skeleton on missing-skeleton load. */
  locateSkeleton: (originalPath) =>
    ipcRenderer.invoke('project:locate-skeleton', originalPath),

  /**
   * D-149 recovery (Approach A) — path-based skeleton reload.
   *
   * Called by AppShell AFTER locateSkeleton resolves with a user-picked path.
   * The renderer forwards args verbatim; main re-runs loader + sampler +
   * buildSummary + stale-key intersect against the new skeleton, returning
   * OpenResponse so AppShell mounts via the same handler used for Open.
   *
   * The args shape is structured-clone-safe (Record + primitives, no Map).
   */
  reloadProjectWithSkeleton: (args) =>
    ipcRenderer.invoke('project:reload-with-skeleton', args),

  /**
   * Phase 8 — dirty-guard listener (D-143 + Pitfall 1). Subscribe pattern
   * mirrors onExportProgress (lines 143-149): wrapped const captures the
   * listener identity for clean unsubscribe.
   *
   * The renderer mounts SaveQuitDialog when the channel fires; on user
   * click, it calls confirmQuitProceed (or does nothing for Cancel).
   * Dual-one-way wiring per RESEARCH §Pitfall 7 — main pauses at
   * preventDefault until the renderer responds via the separate
   * confirm-quit-proceed sender below.
   *
   * Listener identity preservation (RESEARCH §Pitfall 9): the wrapped
   * const is captured by the returned unsubscribe closure — ipcRenderer.on/off
   * compare by reference, so this is the only correct pattern. Anonymous
   * wrappers leak listeners.
   */
  onCheckDirtyBeforeQuit: (handler) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => handler();
    ipcRenderer.on('project:check-dirty-before-quit', wrapped);
    return () => {
      ipcRenderer.removeListener('project:check-dirty-before-quit', wrapped);
    };
  },

  /**
   * Phase 8 — dirty-guard reverse channel (D-143 + Pitfall 1). One-way send
   * fired by the renderer's SaveQuitDialog after the user picks Save (and
   * save resolved) or Don't Save. Cancel does NOT send — main stays paused
   * at the before-quit preventDefault and the app keeps running.
   *
   * NEVER use ipcRenderer.invoke here — the synchronous before-quit listener
   * cannot await an invoke roundtrip.
   */
  confirmQuitProceed: () => {
    ipcRenderer.send('project:confirm-quit-proceed');
  },

  // -------------------------------------------------------------------------
  // Phase 8.2 D-175 / D-181 — menu surface bridges.
  //   - notifyMenuState pushes derived menu state to main on every relevant
  //     renderer-state change (summary, dialogState, modal flags). Main
  //     rebuilds + reapplies the application Menu on every notify.
  //   - onMenu* subscribe to main's menu click events (one-way
  //     webContents.send from the menu builder's click handlers in
  //     src/main/index.ts). All four follow Pitfall 9 listener-identity
  //     preservation: the wrapped const is captured BEFORE ipcRenderer.on
  //     and the unsubscribe closure references the SAME wrapped (else
  //     ipcRenderer.removeListener silently fails — it compares by
  //     reference).
  // -------------------------------------------------------------------------

  /**
   * Phase 8.2 D-181 — push derived menu state to main; main rebuilds and
   * reapplies the application Menu on every notify (canSave / canSaveAs /
   * modalOpen). Fire-and-forget — main does not respond. Main validates
   * the payload field-by-field at the trust boundary (T-08.2-03-01).
   */
  notifyMenuState: (state: {
    canSave: boolean;
    canSaveAs: boolean;
    canReload: boolean;
    modalOpen: boolean;
  }): void => {
    ipcRenderer.send('menu:notify-state', state);
  },

  /**
   * Phase 8.2 D-175 — subscribe to menu File→Open click. Returns unsubscribe.
   * Pitfall 9: wrapped const captured for listener-identity preservation.
   */
  onMenuOpen: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:open-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:open-clicked', wrapped);
    };
  },

  /**
   * Phase 8.2 D-175 — subscribe to menu File→Open Recent → <path> click.
   * Callback receives the absolute path of the recent entry the user
   * clicked. Pitfall 9 listener-identity preservation.
   */
  onMenuOpenRecent: (cb: (path: string) => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, path: string) => cb(path);
    ipcRenderer.on('menu:open-recent-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:open-recent-clicked', wrapped);
    };
  },

  /** Phase 8.2 D-175 — subscribe to menu File→Save click. Pitfall 9. */
  onMenuSave: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:save-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:save-clicked', wrapped);
    };
  },

  /** Phase 8.2 D-175 — subscribe to menu File→Save As… click. Pitfall 9. */
  onMenuSaveAs: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:save-as-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:save-as-clicked', wrapped);
    };
  },

  /**
   * Subscribe to menu File→Reload Project click (CmdOrCtrl+R override).
   * Pitfall 9 listener-identity preservation: wrapped const captured BEFORE
   * ipcRenderer.on so the unsubscribe closure references the SAME identity
   * removeListener compares by reference.
   */
  onMenuReloadProject: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:reload-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:reload-clicked', wrapped);
    };
  },

  /**
   * Subscribe to menu File→Export… click (CmdOrCtrl+E). Pitfall 9
   * listener-identity preservation: same shape as onMenuReloadProject.
   */
  onMenuExport: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:export-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:export-clicked', wrapped);
    };
  },

  /**
   * Subscribe to menu File→Close Project click (CmdOrCtrl+Shift+W).
   * Pitfall 9 listener-identity preservation.
   */
  onMenuCloseProject: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:close-project-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:close-project-clicked', wrapped);
    };
  },

  /**
   * Subscribe to menu File→Show in Folder click. Pitfall 9 listener-identity
   * preservation.
   */
  onMenuShowInFolder: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:show-in-folder-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:show-in-folder-clicked', wrapped);
    };
  },

  /**
   * Subscribe to menu File→Copy Peak Table click. Pitfall 9 listener-identity
   * preservation.
   */
  onMenuCopyPeakTable: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:copy-peak-table-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:copy-peak-table-clicked', wrapped);
    };
  },

  // -------------------------------------------------------------------------
  // Phase 9 Plan 02 D-194 — sampler progress + cancel bridges. Mirror byte-
  // for-byte the export pattern at lines 113-115 + 126-132 (channel renames
  // and payload type only).
  // -------------------------------------------------------------------------

  /**
   * Phase 9 D-194 — subscribe to streaming sampler progress events.
   * Returns an unsubscribe function. Pitfall 9 listener-identity preservation:
   * the wrapped const is captured BEFORE ipcRenderer.on so removeListener
   * targets the SAME reference.
   *
   * Progress is INDETERMINATE per RESEARCH §Q4: the byte-frozen sampler has
   * no inner-loop emit point, so percent is 0 on start and 100 on complete
   * — no intermediate values. The renderer SHOULD show an indeterminate
   * spinner.
   */
  onSamplerProgress: (handler) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, percent: number) => handler(percent);
    ipcRenderer.on('sampler:progress', wrapped);
    return () => {
      ipcRenderer.removeListener('sampler:progress', wrapped);
    };
  },

  /**
   * Phase 9 D-194 — fire-and-forget cancel signal. Main routes this to
   * worker.terminate() (RESEARCH §Q5 — actual cancellation primitive).
   */
  cancelSampler: (): void => {
    ipcRenderer.send('sampler:cancel');
  },

  // -------------------------------------------------------------------------
  // Phase 9 Plan 05 — Settings + Help menu + external-URL bridges. Three new
  // methods that mirror the existing 08.2 onMenu* / openOutputFolder patterns
  // byte-for-byte (channel name + payload type only differ). Pitfall 9
  // listener-identity preservation applies to both onMenu* methods.
  // -------------------------------------------------------------------------

  /**
   * Phase 9 Plan 05 — subscribe to menu Edit→Preferences… click. Returns
   * unsubscribe. Pitfall 9: wrapped const captured BEFORE ipcRenderer.on so
   * the unsubscribe closure references the SAME identity that
   * removeListener compares by reference.
   */
  onMenuSettings: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:settings-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:settings-clicked', wrapped);
    };
  },

  /**
   * Phase 9 Plan 05 — subscribe to menu Help→Documentation click. Returns
   * unsubscribe. Pitfall 9 listener-identity preservation (same shape as
   * onMenuSettings).
   */
  onMenuHelp: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:help-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:help-clicked', wrapped);
    };
  },

  /**
   * Phase 9 Plan 05 — open an external URL in the system browser. One-way
   * fire-and-forget. Main validates the URL against a hardcoded allow-list
   * (T-09-05-OPEN-EXTERNAL). Mirrors openOutputFolder's shape at lines
   * 138-140 with the channel renamed.
   *
   * Renderer-side callers (HelpDialog) MUST pass only static URLs that match
   * the main-process allow-list — see SHELL_OPEN_EXTERNAL_ALLOWED in
   * src/main/ipc.ts.
   */
  openExternalUrl: (url: string): void => {
    ipcRenderer.send('shell:open-external', url);
  },

  // -------------------------------------------------------------------------
  // Phase 9 Plan 06 — Re-sample bridge. SettingsDialog.onApply triggers
  // AppShell to call this with the new samplingHz + the cached session state
  // (overrides + paths + sort + lastOutDir + projectFilePath). Main returns
  // OpenResponse so AppShell can mount via mountOpenResponse — same seam as
  // File→Open success. RESEARCH §Pitfall 7 + 09-CONTEXT.md Settings modal.
  // -------------------------------------------------------------------------
  resampleProject: (args) => ipcRenderer.invoke('project:resample', args),

  // -------------------------------------------------------------------------
  // Phase 12 Plan 01 — auto-update bridges (UPD-01..UPD-06).
  //
  // Five subscribe methods + four invoke/send methods. Every on* method
  // captures the wrapped listener identity in a local const BEFORE
  // ipcRenderer.on so the returned unsubscribe targets the SAME reference
  // (Pitfall 9 — listener-identity preservation; without this, listeners
  // accumulate and unsubscribe silently fails. Same idiom as Phase 6's
  // onExportProgress at lines 126-132 and Phase 8.2's onMenu* methods).
  // -------------------------------------------------------------------------

  /** UPD-02 — Help → Check for Updates manual trigger. Resolves when checkUpdate completes. */
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('update:check-now'),

  /**
   * Phase 14 D-03 — late-mount pending-update re-delivery.
   *
   * Renderer App.tsx calls this ONCE on mount in the lifted update-subscription
   * useEffect. Main returns the sticky 'update-available' payload (overwritten
   * on each newer version; cleared on dismiss/download), or null on first
   * launch / no pending update.
   *
   * Handles the edge case where main fired 'update-available' BEFORE the
   * renderer's React effect committed (e.g. the 3.5s startup check resolving
   * before React hydration finishes — was the root cause of UPDFIX-03's
   * "no startup notification" symptom on shipped v1.1.1).
   *
   * One-shot invoke — NO subscription, NO Pitfall 9 listener-identity scaffold
   * needed (no removeListener cleanup; the slot lives in main-process module
   * state and is read-only from the renderer's perspective).
   *
   * Type signature is defined inline (mirrors the Phase 12 D-04 inline payload
   * type at the onUpdateAvailable bridge below) — preload runs in a separate
   * context with its own type-graph; importing from main would cross the trust
   * boundary unnecessarily for v1.1.2 hotfix scope.
   */
  requestPendingUpdate: (): Promise<{
    version: string;
    summary: string;
    variant: 'auto-update' | 'manual-download';
    fullReleaseUrl: string;
  } | null> => ipcRenderer.invoke('update:request-pending'),

  /** UPD-03 — UpdateDialog "Download + Restart" click. Opt-in download (autoDownload=false). */
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('update:download'),

  /** D-08 — UpdateDialog "Later" click. Persists dismissedUpdateVersion. One-way. */
  dismissUpdate: (version: string): void => {
    ipcRenderer.send('update:dismiss', version);
  },

  /** UPD-04 — UpdateDialog "Restart" click after download. One-way; main defers via setTimeout(0). */
  quitAndInstallUpdate: (): void => {
    ipcRenderer.send('update:quit-and-install');
  },

  /** UPD-04 — subscribe to 'update:available'. Pitfall 9 listener-identity. */
  onUpdateAvailable: (
    cb: (payload: {
      version: string;
      summary: string;
      variant?: 'auto-update' | 'manual-download';
      fullReleaseUrl: string;
    }) => void,
  ) => {
    const wrapped = (
      _evt: Electron.IpcRendererEvent,
      payload: {
        version: string;
        summary: string;
        variant?: 'auto-update' | 'manual-download';
        fullReleaseUrl: string;
      },
    ) => cb(payload);
    ipcRenderer.on('update:available', wrapped);
    return () => {
      ipcRenderer.removeListener('update:available', wrapped);
    };
  },

  /** UPD-04 — subscribe to 'update:downloaded'. Pitfall 9 listener-identity. */
  onUpdateDownloaded: (cb: (payload: { version: string }) => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, payload: { version: string }) => cb(payload);
    ipcRenderer.on('update:downloaded', wrapped);
    return () => {
      ipcRenderer.removeListener('update:downloaded', wrapped);
    };
  },

  /** UPD-02 — subscribe to 'update:none'. Renderer filters by manualCheckPendingRef. */
  onUpdateNone: (cb: (payload: { currentVersion: string }) => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, payload: { currentVersion: string }) =>
      cb(payload);
    ipcRenderer.on('update:none', wrapped);
    return () => {
      ipcRenderer.removeListener('update:none', wrapped);
    };
  },

  /** UPD-02 — subscribe to 'update:error'. Renderer filters by manualCheckPendingRef. */
  onUpdateError: (cb: (payload: { message: string }) => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, payload: { message: string }) => cb(payload);
    ipcRenderer.on('update:error', wrapped);
    return () => {
      ipcRenderer.removeListener('update:error', wrapped);
    };
  },

  /** D-07 — subscribe to Help → Check for Updates menu click. Pitfall 9 listener-identity. */
  onMenuCheckForUpdates: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:check-for-updates-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:check-for-updates-clicked', wrapped);
    };
  },

  /**
   * Phase 12 Plan 06 (D-16.3) — subscribe to Help → Installation Guide… menu
   * click. Mirrors onMenuCheckForUpdates byte-for-byte (channel name only
   * differs). Renderer (AppShell) calls window.api.openExternalUrl with the
   * INSTALL.md URL on fire; URL routes through SHELL_OPEN_EXTERNAL_ALLOWED
   * allow-list. Pitfall 9 listener-identity preservation: wrapped const
   * captured BEFORE ipcRenderer.on so the unsubscribe closure references the
   * SAME identity that removeListener compares by reference.
   */
  onMenuInstallationGuide: (cb: () => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
    ipcRenderer.on('menu:installation-guide-clicked', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:installation-guide-clicked', wrapped);
    };
  },

  // -------------------------------------------------------------------------
  // Phase 12 Plan 03 (D-19) — F1 atlas-image URL bridge.
  //
  // Returns Promise<string> via main-process IPC; pathToFileURL runs in main
  // (privileged context — renderer is sandboxed and has no node:url). Renderer
  // awaits the result before assigning img.src in AtlasPreviewModal.tsx.
  // RESEARCH Open Question 1 was pre-resolved at plan time: the IPC-invoke
  // variant ships unconditionally (no synchronous preload variant) so the
  // bridge works regardless of preload sandbox state.
  //
  // Layer-3 invariant (renderer): renderer MUST NOT import node:url directly
  // — every absolute-path → app-image:// URL conversion goes through this
  // bridge so the (well-tested, single-source-of-truth) main-side handler
  // owns the cross-platform `pathToFileURL` semantics.
  // -------------------------------------------------------------------------
  pathToImageUrl: (absolutePath: string): Promise<string> =>
    ipcRenderer.invoke('atlas:resolve-image-url', absolutePath),

  // -------------------------------------------------------------------------
  // Phase 20 D-21 — Documentation HTML export.
  //
  // The renderer (DocumentationBuilderDialog ExportPane) builds the
  // structured-clone-safe DocExportPayload at click time and awaits
  // DocExportResponse. Main owns the dialog.showSaveDialog + atomic write;
  // this bridge is just the IPC forwarder. Mirrors the saveProjectAs shape
  // (lines 154-155 above) — the user-facing pattern is the same: open a save
  // dialog, write to disk, return success/error envelope. No subscription /
  // listener-identity scaffolding needed (one-shot invoke).
  // -------------------------------------------------------------------------
  exportDocumentationHtml: (payload: DocExportPayload): Promise<DocExportResponse> =>
    ipcRenderer.invoke('documentation:exportHtml', payload),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    // contextBridge.exposeInMainWorld throws if called with an already-reserved
    // key or invalid shape — log to main-process stderr so we see it in dev.
    console.error('Failed to expose api via contextBridge:', error);
  }
} else {
  // D-06 pins contextIsolation: true — this branch never runs in our app.
  // Kept so the starter pattern's invariant is preserved; a future phase
  // flipping contextIsolation would still get a working window.api.
  // (Use globalThis rather than the DOM `window` global here so this file
  // typechecks under tsconfig.node.json's ES2022-only lib set — the node
  // project includes src/preload/index.ts but does not pull DOM types.)
  (globalThis as unknown as { api: Api }).api = api;
}
