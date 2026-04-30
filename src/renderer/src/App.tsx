/**
 * Phase 1 Plan 04 — Top-level wiring.
 *
 * Owns AppState discriminated union (D-20; plain useState, no library).
 * Composes DropZone (full-window drag target per D-43) with context-
 * appropriate children for each state:
 *
 *   status: 'idle'    → pre-drop empty-state copy (D-18)
 *   status: 'loading' → "Loading foo.json…" hint
 *   status: 'loaded'  → the global-max render panel (D-19 in-place
 *                       replacement per D-43 — DropZone keeps full-window
 *                       wrap, no app shell; D-17 echoes summary to console)
 *   status: 'error'   → inline muted-orange error line (D-19, text-accent-muted)
 *
 * D-17 console echo fires in a useEffect gated on status === 'loaded' — the
 * loaded-branch child component stays side-effect-free (Task 2 invariant),
 * and the StrictMode double-fire in dev is harmless (the echo is idempotent).
 * In production builds (app.isPackaged), consider reducing console verbosity
 * — Phase 9 concern per RESEARCH Security Domain line 1065.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DropZone } from './components/DropZone';
import { AppShell } from './components/AppShell';
import { UpdateDialog, type UpdateDialogState, type UpdateDialogVariant } from './modals/UpdateDialog';
import type {
  SkeletonSummary,
  SerializableError,
  LoadResponse,
  OpenResponse,
  MaterializedProject,
  SaveResponse,
} from '../../shared/types.js';

export type AppState =
  | { status: 'idle' }
  | { status: 'loading'; fileName: string }
  | { status: 'loaded'; fileName: string; summary: SkeletonSummary }
  /**
   * Phase 8 Plan 04 — NEW variant. Set when DropZone routed a .stmproj drop
   * (or Cmd+O picked one) through window.api.openProjectFromFile /
   * openProjectFromPath; carries the materialized project alongside the
   * summary so AppShell can be mounted with initialProject seeding the
   * restored overrides + lastSaved snapshot.
   *
   * The skeleton-only `loaded` variant is PRESERVED verbatim — existing
   * .json drop path stays at `loaded` exactly as today.
   */
  | { status: 'projectLoaded'; fileName: string; summary: SkeletonSummary; project: MaterializedProject }
  /**
   * Phase 8.1 Plan 04 — NEW variant (D-161, WR-09 fix-a).
   *
   * Set when handleProjectLoad receives an OpenResponse with ok:false and
   * error.kind === 'SkeletonNotFoundOnLoadError'. Carries the threaded
   * SerializableError (D-158) so the recovery banner can read the cached
   * recovery payload (originalSkeletonPath, mergedOverrides, samplingHz,
   * etc.) without a separate state slot.
   *
   * Pre-Phase-8.1 this routing landed in `error` and AppShell never mounted —
   * the locate-skeleton recovery surface was unreachable from the .stmproj
   * drag-drop path (VR-01). Post-fix, App.tsx renders a thin recovery banner
   * that drives window.api.locateSkeleton + window.api.reloadProjectWithSkeleton
   * directly — same IPC chain as AppShell.onClickLocateSkeleton.
   */
  | {
      status: 'projectLoadFailed';
      fileName: string;
      error: Extract<SerializableError, { kind: 'SkeletonNotFoundOnLoadError' }>;
    }
  | { status: 'error'; fileName: string; error: SerializableError };

export function App() {
  const [state, setState] = useState<AppState>({ status: 'idle' });

  // Phase 14 Plan 03 (D-02) — UpdateDialog lifecycle, LIFTED from AppShell.
  // App.tsx is the always-mounted root, so subscriptions run on every AppState
  // branch (idle / loading / loaded / projectLoaded / projectLoadFailed / error).
  // Pre-Phase-14 these lived in AppShell which mounted only on `loaded` /
  // `projectLoaded` — that meant startup auto-check (UPDFIX-03) and pre-load
  // manual check (UPDFIX-04) fired into the void with no subscriber.
  const [updateState, setUpdateState] = useState<{
    open: boolean;
    state: UpdateDialogState;
    version: string;
    summary: string;
    variant: UpdateDialogVariant;
    /**
     * Phase 16 D-04 — per-release templated URL (`/releases/tag/v{version}`)
     * supplied by main on the UpdateAvailablePayload. Flows from main payload
     * → this slot → onOpenReleasePage handler → window.api.openExternalUrl
     * → main's isReleasesUrl allow-list check (Plan 16-04) →
     * shell.openExternal. Empty string when no payload has been received yet
     * (state='none' / startup pre-check) — onOpenReleasePage guards on
     * length > 0 as defense-in-depth.
     */
    fullReleaseUrl: string;
  }>({
    open: false,
    state: 'available',
    version: '',
    summary: '',
    variant: 'auto-update',
    fullReleaseUrl: '',
  });

  // D-07 — only show "you're up to date" / error on MANUAL checks. Startup
  // checks fire 'update:none' and 'update:error' too, but the renderer
  // suppresses those mounts via this ref. Set to true when the user clicks
  // Help → Check for Updates, consumed-and-cleared by the next 'update:none'
  // / 'update:error' event. Plain useRef so the value persists across
  // useEffect cleanups without triggering re-renders. LIFTED from
  // AppShell.tsx:181.
  const manualCheckPendingRef = useRef<boolean>(false);

  const handleLoadStart = useCallback((fileName: string) => {
    setState({ status: 'loading', fileName });
  }, []);

  const handleLoad = useCallback((resp: LoadResponse, fileName: string) => {
    if (resp.ok) {
      setState({ status: 'loaded', fileName, summary: resp.summary });
    } else {
      setState({ status: 'error', fileName, error: resp.error });
    }
  }, []);

  /**
   * Phase 8 Plan 04 — handleProjectLoad. Mirrors handleLoad's shape but
   * targets the new `projectLoaded` AppState variant. Triggered when DropZone
   * receives a .stmproj drop and forwards via window.api.openProjectFromFile.
   * On error, the existing `error` branch UI surfaces the SerializableError.
   */
  const handleProjectLoad = useCallback((resp: OpenResponse, fileName: string) => {
    if (resp.ok) {
      setState({
        status: 'projectLoaded',
        fileName,
        summary: resp.project.summary,
        project: resp.project,
      });
    } else {
      // Phase 8.1 D-161: route the recoverable SkeletonNotFoundOnLoadError to
      // the dedicated `projectLoadFailed` variant. The Extract<...> type in
      // the variant exposes the 7 threaded fields directly. Other error kinds
      // keep landing in the generic `error` branch.
      if (resp.error.kind === 'SkeletonNotFoundOnLoadError') {
        setState({ status: 'projectLoadFailed', fileName, error: resp.error });
      } else {
        setState({ status: 'error', fileName, error: resp.error });
      }
    }
  }, []);

  /**
   * Phase 8.1 D-162 recovery flow (drag-drop arm). Mirrors AppShell's
   * onClickLocateSkeleton (AppShell.tsx:563-586) but lives in App.tsx
   * because the projectLoadFailed state means AppShell isn't mounted.
   *
   * Steps (per D-162):
   *   1. Call window.api.locateSkeleton(originalSkeletonPath). User picks
   *      a replacement file or cancels.
   *   2. On pick: call window.api.reloadProjectWithSkeleton with the cached
   *      recovery payload + new path.
   *   3. On success: transition to projectLoaded with the materialized result.
   *   4. On reload-failure: stay in projectLoadFailed but update the error
   *      message to the new failure (rare — user picked a file that ALSO
   *      fails the loader).
   *
   * Does NOT remount any component above the DropZone; the state machine
   * change is the entire effect.
   */
  const handleLocateSkeleton = useCallback(async () => {
    if (state.status !== 'projectLoadFailed') return;
    const located = await window.api.locateSkeleton(state.error.originalSkeletonPath);
    if (!located.ok) return; // user cancelled picker
    const resp = await window.api.reloadProjectWithSkeleton({
      projectPath: state.error.projectPath,
      newSkeletonPath: located.newPath,
      mergedOverrides: state.error.mergedOverrides,
      samplingHz: state.error.samplingHz,
      lastOutDir: state.error.lastOutDir,
      sortColumn: state.error.sortColumn,
      sortDir: state.error.sortDir,
    });
    if (!resp.ok) {
      if (resp.error.kind === 'SkeletonNotFoundOnLoadError') {
        // The replacement file ALSO fails to load — update the message but
        // keep the recovery surface mounted with the original cached payload
        // (let the user try again).
        setState({
          status: 'projectLoadFailed',
          fileName: state.fileName,
          error: { ...state.error, message: resp.error.message },
        });
      } else {
        setState({ status: 'error', fileName: state.fileName, error: resp.error });
      }
      return;
    }
    setState({
      status: 'projectLoaded',
      fileName: state.fileName,
      summary: resp.project.summary,
      project: resp.project,
    });
  }, [state]);

  const handleDismissProjectLoadFailed = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  /**
   * Phase 8.1 D-163 — callback-ref bridge for the dirty-guard.
   *
   * AppShell registers its impl into beforeDropRef.current via a useEffect
   * (AppShell.tsx Plan 08.1-05 Task 1). The handleBeforeDrop wrapper passed to
   * DropZone is stable (useCallback with empty deps); it dereferences the ref
   * at call time so it always sees the latest registered impl. When AppShell
   * is unmounted (state.status !== 'loaded' / 'projectLoaded'), the ref is
   * null and handleBeforeDrop returns true (no guard — the drop proceeds).
   */
  const beforeDropRef = useRef<
    ((fileName: string, kind: 'json' | 'stmproj') => Promise<boolean>) | null
  >(null);

  const handleBeforeDrop = useCallback(
    async (fileName: string, kind: 'json' | 'stmproj'): Promise<boolean> => {
      return beforeDropRef.current?.(fileName, kind) ?? true;
    },
    [],
  );

  /**
   * Phase 08.2 D-175 — callback-ref bridge for menu-driven Save / Save As.
   * Parallel to beforeDropRef (Phase 8.1 D-163). AppShell registers
   * { onClickSave, onClickSaveAs } via a useEffect; menu-event subscriptions
   * below dereference at call time so the latest registered impl always wins.
   * When AppShell is unmounted (idle / error / projectLoadFailed), the ref
   * is null and menu Save / Save As clicks are silent no-ops — main also
   * disables those items in those states (D-181 / D-187), so the IPC
   * shouldn't fire; the optional-chain is defense-in-depth.
   */
  const appShellMenuRef = useRef<{
    onClickSave: () => Promise<SaveResponse>;
    onClickSaveAs: () => Promise<SaveResponse>;
  } | null>(null);

  /**
   * Phase 18 D-01 + D-02 — callback-ref bridge for the before-quit dirty-guard,
   * LIFTED from AppShell.tsx:786-800. App.tsx is the always-mounted root, so
   * the onCheckDirtyBeforeQuit subscription runs on every AppState branch
   * (idle / loading / loaded / projectLoaded / projectLoadFailed / error) —
   * pre-lift, the listener lived inside AppShell which only mounted on
   * `loaded` / `projectLoaded`, leaving Cmd+Q / AppleScript quit no-op'd from
   * idle (closes QUIT-01 + QUIT-02).
   *
   * Object shape parallels appShellMenuRef (Phase 08.2 D-175): two members so
   * AppShell can keep ownership of both the isDirty memo (line 580) AND the
   * SaveQuitDialog mount slot (saveQuitDialogState at line 232 / SaveQuitDialog
   * mount at line 1357). The lifted listener below dereferences at IPC-fire
   * time, treating null as "AppShell unmounted — no project to save, fire
   * confirmQuitProceed immediately" (D-04).
   */
  const dirtyCheckRef = useRef<{
    isDirty: () => boolean;
    openSaveQuitDialog: (onProceed: () => void) => void;
  } | null>(null);

  // D-17: echo summary to console on successful load (ROADMAP exit criterion).
  // Phase 8: extended to fire on `projectLoaded` too — same console contract.
  useEffect(() => {
    if (state.status === 'loaded' || state.status === 'projectLoaded') {
      // eslint-disable-next-line no-console
      console.log('[Spine Texture Manager] Loaded skeleton summary:', state.summary);
    }
  }, [state]);

  /**
   * Phase 08.2 D-175 + D-183 — subscribe to all four menu-event channels.
   * App.tsx is the always-mounted root, so menu Open works in EVERY
   * AppState (idle / loading / loaded / projectLoaded / projectLoadFailed
   * / error). This is the canonical 08.1 UAT bug fix end-to-end —
   * Cmd+O on the recovery banner now opens the file picker.
   *
   * onMenuOpen routes through handleBeforeDrop (D-163 ref-bridge) so menu
   * Open honors the SaveQuitDialog dirty-guard. When AppShell is
   * unmounted, beforeDropRef.current is null → handleBeforeDrop returns
   * true via `?? true` fallback → Open proceeds without a guard (the
   * unmounted state has no dirty session).
   *
   * onMenuSave / onMenuSaveAs late-bind through appShellMenuRef. When
   * AppShell is unmounted the ref is null and the call is a silent no-op
   * (defense-in-depth — main also disables those items per D-181 / D-187).
   *
   * Pitfall 15 cleanup: all four unsubs MUST be called in the cleanup
   * function so subsequent App.tsx renders don't leak listeners on the
   * preload's ipcRenderer.on registration.
   */
  useEffect(() => {
    const unsubOpen = window.api.onMenuOpen(async () => {
      const proceed = await handleBeforeDrop('', 'stmproj');
      if (!proceed) return;
      const resp = await window.api.openProject();
      handleProjectLoad(resp, '(menu)');
    });

    const unsubOpenRecent = window.api.onMenuOpenRecent(async (path: string) => {
      const proceed = await handleBeforeDrop(path, 'stmproj');
      if (!proceed) return;
      const resp = await window.api.openProjectFromPath(path);
      handleProjectLoad(resp, path.split(/[\\/]/).pop() ?? path);
    });

    const unsubSave = window.api.onMenuSave(() => {
      void appShellMenuRef.current?.onClickSave();
    });

    const unsubSaveAs = window.api.onMenuSaveAs(() => {
      void appShellMenuRef.current?.onClickSaveAs();
    });

    return () => {
      unsubOpen();
      unsubOpenRecent();
      unsubSave();
      unsubSaveAs();
    };
  }, [handleBeforeDrop, handleProjectLoad]);

  /**
   * Phase 18 D-01..D-05, D-11 — before-quit dirty-guard subscription, LIFTED
   * from AppShell.tsx:786-800. Closes QUIT-01 + QUIT-02. Mirrors the canonical
   * Phase 14 commit 802a76e shape (auto-update lift, lines 367-444 above).
   *
   * Three-branch dispatch (D-03, D-04, D-05):
   *   - dirtyCheckRef.current === null  → AppShell unmounted (idle / error /
   *     projectLoadFailed). No project to save. Fire confirmQuitProceed
   *     immediately. (D-04 — this branch is the QUIT-01/QUIT-02 fix.)
   *   - ref.isDirty() === false         → AppShell mounted but session is
   *     clean. Same fast-path as D-04 — no SaveQuitDialog needed. (D-05)
   *   - ref.isDirty() === true          → AppShell mounted + dirty. Hand the
   *     proceed callback into AppShell via openSaveQuitDialog so the existing
   *     SaveQuitDialog mount + setSaveQuitDialogState invocation runs verbatim.
   *     Phase 8 contract LOCKED — Cancel keeps the app running (no
   *     confirmQuitProceed call → main stays paused at preventDefault →
   *     Electron aborts the quit). Save / Don't Save fires the proceed
   *     callback through the existing pendingAction chain (AppShell.tsx:1370,
   *     1377). (D-03)
   *
   * Empty dep array is correct: dirtyCheckRef.current is dereferenced at
   * IPC-fire time (NOT at effect-attach time), so this effect must NOT re-run
   * when AppShell mounts/unmounts. Mirrors the auto-update useEffect at line
   * 444 (`}, []);`) and the Pitfall 9 / 15 cleanup discipline (preload
   * preserves listener identity via a wrapped const closure, so the cleanup
   * MUST return the unsubscribe — without `return unsub;` every re-mount
   * would leak a listener).
   *
   * D-11: accepted pre-mount race. If the user presses Cmd+Q within ~500ms
   * of cold start (before this effect commits on first render), main stays
   * paused at preventDefault. The arch-grep test in Plan 02 catches the
   * regression class structurally; the empirical race is bounded by React
   * hydration and is not user-reachable in practice. Escalation path
   * (main-side ~2s timeout fallback) is preserved as a deferred idea in
   * 18-CONTEXT.md.
   */
  useEffect(() => {
    const unsub = window.api.onCheckDirtyBeforeQuit(() => {
      const ref = dirtyCheckRef.current;
      if (ref === null) {
        // D-04 — AppShell unmounted. No project, no dirty state, no dialog.
        window.api.confirmQuitProceed();
        return;
      }
      if (!ref.isDirty()) {
        // D-05 — mounted but clean. Same fast-path as D-04.
        window.api.confirmQuitProceed();
        return;
      }
      // D-03 — mounted + dirty. Defer to the existing SaveQuitDialog flow
      // (mount + setSaveQuitDialogState stay in AppShell). Save / Don't Save
      // → onProceed runs → confirmQuitProceed. Cancel → onProceed never runs
      // → main stays paused at preventDefault → Electron aborts the quit.
      ref.openSaveQuitDialog(() => {
        window.api.confirmQuitProceed();
      });
    });
    return unsub;
  }, []);

  /**
   * Phase 08.2 D-187 — push menu state to main whenever the AppState
   * transitions to a branch where AppShell is NOT mounted. AppShell pushes
   * its own state while mounted (see AppShell.tsx Plan 04 Task 2 changes).
   *
   * For idle / error / projectLoadFailed: no project loaded, no modal
   * surface (the recovery banner is a div with role="alert", NOT a
   * [role="dialog"][aria-modal]). File→Open stays enabled — that's the
   * Cmd+O fix. Save / Save As are disabled (no project to save).
   *
   * The 'loading' state is transient (the next state-change useEffect
   * cycle takes over); the 'loaded' / 'projectLoaded' states are owned
   * by AppShell's own notifyMenuState push.
   */
  useEffect(() => {
    if (
      state.status === 'idle' ||
      state.status === 'error' ||
      state.status === 'projectLoadFailed'
    ) {
      window.api.notifyMenuState({
        canSave: false,
        canSaveAs: false,
        modalOpen: false,
      });
    }
  }, [state.status]);

  /**
   * Phase 14 Plan 03 (D-02 + D-03) — auto-update IPC subscriptions, LIFTED
   * from AppShell.tsx. App.tsx renders unconditionally on every AppState
   * branch, so this useEffect runs once on first render and the 5 subscribers
   * survive every state transition. Closes UPDFIX-03 + UPDFIX-04 root cause:
   * pre-lift, the subscribers lived in AppShell which only mounted on
   * `loaded` / `projectLoaded` — startup auto-check at 3.5s fired into the
   * void on every cold start, and `Help → Check for Updates` from idle
   * silently swallowed the response.
   *
   * Five channels (UPD-01..UPD-06 + Phase 12 D-04 + D-05 + D-07):
   *   - 'update:available'  → mount UpdateDialog with version + summary +
   *     variant supplied by main (D-04 — main is single source of truth).
   *   - 'update:downloaded' → transition state from 'downloading' to
   *     'downloaded'; UpdateDialog flips Download+Restart → Restart button.
   *   - 'update:none'       → ONLY surface "You're up to date" on manual
   *     checks (D-07); startup checks silent (manualCheckPendingRef gate).
   *   - 'update:error'      → ONLY surface error on manual checks
   *     (mirrors update:none; main itself silent-swallows on startup
   *     before sending update:error per UPD-05).
   *   - 'menu:check-for-updates-clicked' → set manualCheckPendingRef and
   *     invoke checkForUpdates (Help → Check for Updates path).
   *
   * Phase 14 D-03 addition: after attaching all 5 subscribers, invoke
   * window.api.requestPendingUpdate() ONCE to recover from the late-mount
   * race where main fired 'update-available' BEFORE this effect committed
   * (e.g., 3.5s startup check resolving before React hydration finished).
   * If main has a sticky payload, hydrate updateState as if 'update:available'
   * had just fired — UpdateDialog mounts and the user sees the prompt they
   * would otherwise have missed.
   */
  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable((payload) => {
      setUpdateState({
        open: true,
        state: 'available',
        version: payload.version,
        summary: payload.summary,
        variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',
        fullReleaseUrl: payload.fullReleaseUrl,
      });
    });
    const unsubDownloaded = window.api.onUpdateDownloaded(() => {
      setUpdateState((prev) => ({ ...prev, state: 'downloaded' }));
    });
    const unsubNone = window.api.onUpdateNone((payload) => {
      // D-07 — only surface on manual checks. Startup-mode 'update:none'
      // events fire harmlessly through this listener but the gate filters
      // them out.
      if (manualCheckPendingRef.current) {
        manualCheckPendingRef.current = false;
        setUpdateState({
          open: true,
          state: 'none',
          version: payload.currentVersion,
          summary: '',
          variant: 'auto-update',
          fullReleaseUrl: '',
        });
      }
    });
    const unsubError = window.api.onUpdateError((payload) => {
      // D-06 — main itself silent-swallows on startup before sending; this
      // gate is belt-and-braces (main's autoUpdater.on('error') unconditional
      // bridge can fire OUTSIDE a checkUpdate call).
      if (manualCheckPendingRef.current) {
        manualCheckPendingRef.current = false;
        setUpdateState({
          open: true,
          state: 'none',
          version: '',
          summary: `Update check failed: ${payload.message}`,
          variant: 'auto-update',
          fullReleaseUrl: '',
        });
      }
    });
    const unsubMenuCheck = window.api.onMenuCheckForUpdates(() => {
      manualCheckPendingRef.current = true;
      void window.api.checkForUpdates();
    });

    // Phase 14 D-03 — late-mount sticky-slot recovery. Main may have fired
    // 'update-available' BEFORE the 5 subscribers above attached (e.g., the
    // 3.5s startup check resolving before React hydration committed). Pull
    // the sticky payload once on mount; if non-null, hydrate updateState
    // exactly as if 'update:available' had just been received. Wrapped in
    // void Promise to avoid a useEffect-async-fn anti-pattern.
    void window.api.requestPendingUpdate().then((payload) => {
      if (payload !== null) {
        setUpdateState({
          open: true,
          state: 'available',
          version: payload.version,
          summary: payload.summary,
          variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',
          fullReleaseUrl: payload.fullReleaseUrl,
        });
      }
    });

    return () => {
      unsubAvailable();
      unsubDownloaded();
      unsubNone();
      unsubError();
      unsubMenuCheck();
    };
  }, []);

  return (
    <DropZone
      onLoad={handleLoad}
      onLoadStart={handleLoadStart}
      onProjectDrop={handleProjectLoad}
      onProjectDropStart={handleLoadStart}
      onBeforeDrop={handleBeforeDrop}
    >
      {state.status === 'idle' && (
        <p className="text-fg-muted font-mono text-sm">
          Drop a <code>.spine</code> JSON file anywhere in this window
        </p>
      )}
      {state.status === 'loading' && (
        <p className="text-fg-muted font-mono text-sm">
          Loading {state.fileName}…
        </p>
      )}
      {state.status === 'loaded' && (
        // Phase 8 Plan 04 Task 4: thread samplingHz=120 constant. Phase 9
        // replaces this with a value read from settings state.
        // Phase 8.1 D-163: pass beforeDropRef so AppShell can register its
        // dirty-guard impl for the new-skeleton/new-project drop guard.
        <AppShell
          summary={state.summary}
          samplingHz={120}
          onBeforeDropRef={beforeDropRef}
          appShellMenuRef={appShellMenuRef}
          dirtyCheckRef={dirtyCheckRef}
        />
      )}
      {state.status === 'projectLoaded' && (
        // Phase 8 Plan 04 Task 4: .stmproj drop / open path. Pass the
        // materialized project as initialProject so AppShell seeds
        // restored overrides + lastSaved + stale-override banner from
        // the saved file. samplingHz comes from the project (D-146).
        // Phase 8.1 D-163: pass beforeDropRef (same as 'loaded' branch).
        // Phase 08.2 D-175: pass appShellMenuRef so AppShell can register
        // { onClickSave, onClickSaveAs } for menu-driven Save / Save As.
        <AppShell
          summary={state.summary}
          samplingHz={state.project.samplingHz}
          initialProject={state.project}
          onBeforeDropRef={beforeDropRef}
          appShellMenuRef={appShellMenuRef}
          dirtyCheckRef={dirtyCheckRef}
        />
      )}
      {state.status === 'projectLoadFailed' && (
        <div className="w-full max-w-3xl mx-auto p-8">
          {/* Phase 8.1 D-162: recovery banner mirroring AppShell.tsx:746-770
              visually. role="alert" + bg-panel + bg-danger 1px accent bar +
              "Skeleton not found:" prefix. Two buttons: Locate skeleton…
              invokes the IPC chain via handleLocateSkeleton; Dismiss returns
              to idle.
              Tailwind v4 literal-class discipline (Pitfall 8): every className
              is a string literal. */}
          <div
            role="alert"
            className="border border-border bg-panel px-6 py-3 text-xs text-fg flex items-center gap-2 rounded-md"
          >
            <span className="inline-block w-1 h-4 bg-danger" aria-hidden="true" />
            <span className="flex-1">
              <span className="font-semibold text-danger">Skeleton not found:</span>{' '}
              {state.error.message}
            </span>
            <button
              type="button"
              onClick={() => void handleLocateSkeleton()}
              className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              Locate skeleton…
            </button>
            <button
              type="button"
              onClick={handleDismissProjectLoadFailed}
              className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-2 text-fg-muted font-mono text-xs">
            Dropped: <code>{state.fileName}</code>
          </p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="w-full max-w-3xl mx-auto p-8">
          <p className="text-accent-muted font-mono text-sm">
            <span className="font-semibold">{state.error.kind}:</span>{' '}
            {state.error.message}
          </p>
          <p className="mt-2 text-fg-muted font-mono text-xs">
            Dropped: <code>{state.fileName}</code>
          </p>
        </div>
      )}
      {/* Phase 14 Plan 03 — UpdateDialog mount, LIFTED from AppShell.tsx.
          Renders as a sibling of the 6 AppState-branch JSX blocks above.
          Visible on EVERY branch (idle / loading / loaded / projectLoaded
          / projectLoadFailed / error) via the z-50 overlay in UpdateDialog
          itself. State machine driven by the auto-update IPC subscription
          useEffect above. Variant supplied by main per D-04 (auto-update on
          Linux always; Windows-IF-spike-PASS; manual-download otherwise per
          Phase 16 D-01). */}
      <UpdateDialog
        open={updateState.open}
        state={updateState.state}
        version={updateState.version}
        summary={updateState.summary}
        variant={updateState.variant}
        onDownload={() => {
          setUpdateState((prev) => ({ ...prev, state: 'downloading' }));
          void window.api.downloadUpdate();
        }}
        onRestart={() => {
          window.api.quitAndInstallUpdate();
        }}
        onLater={() => {
          // Only persist when there's a real version to remember; the
          // state='none' "You're up to date" / error paths use Later as a
          // pure close affordance (no version to suppress).
          if (updateState.state !== 'none' && updateState.version.length > 0) {
            window.api.dismissUpdate(updateState.version);
          }
          setUpdateState((prev) => ({ ...prev, open: false }));
        }}
        onOpenReleasePage={() => {
          // Phase 16 D-04 — forward the per-release templated URL the main
          // payload supplied (`/releases/tag/v{version}`). Defense-in-depth
          // length > 0 guard: if the manual-download button somehow renders
          // when the slot is empty (state='none' with no payload received),
          // the call is silently dropped rather than firing an empty URL at
          // the IPC allow-list.
          if (updateState.fullReleaseUrl.length > 0) {
            window.api.openExternalUrl(updateState.fullReleaseUrl);
          }
        }}
        onClose={() => setUpdateState((prev) => ({ ...prev, open: false }))}
      />
    </DropZone>
  );
}
