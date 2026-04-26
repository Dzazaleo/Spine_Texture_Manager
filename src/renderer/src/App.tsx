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
    </DropZone>
  );
}
