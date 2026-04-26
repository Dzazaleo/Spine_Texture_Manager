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
import { useCallback, useEffect, useState } from 'react';
import { DropZone } from './components/DropZone';
import { AppShell } from './components/AppShell';
import type {
  SkeletonSummary,
  SerializableError,
  LoadResponse,
  OpenResponse,
  MaterializedProject,
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
      setState({ status: 'error', fileName, error: resp.error });
    }
  }, []);

  // D-17: echo summary to console on successful load (ROADMAP exit criterion).
  // Phase 8: extended to fire on `projectLoaded` too — same console contract.
  useEffect(() => {
    if (state.status === 'loaded' || state.status === 'projectLoaded') {
      // eslint-disable-next-line no-console
      console.log('[Spine Texture Manager] Loaded skeleton summary:', state.summary);
    }
  }, [state]);

  return (
    <DropZone
      onLoad={handleLoad}
      onLoadStart={handleLoadStart}
      onProjectDrop={handleProjectLoad}
      onProjectDropStart={handleLoadStart}
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
        <AppShell summary={state.summary} samplingHz={120} />
      )}
      {state.status === 'projectLoaded' && (
        // Phase 8 Plan 04 Task 4: .stmproj drop / open path. Pass the
        // materialized project as initialProject so AppShell seeds
        // restored overrides + lastSaved + stale-override banner from
        // the saved file. samplingHz comes from the project (D-146).
        <AppShell
          summary={state.summary}
          samplingHz={state.project.samplingHz}
          initialProject={state.project}
        />
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
