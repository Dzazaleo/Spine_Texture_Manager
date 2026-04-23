/**
 * Phase 1 Plan 03 — Top-level renderer state machine.
 *
 * Owns the `AppState` discriminated union per D-20 (plain useState, no state
 * library). Renders:
 *   - 'idle'    — pre-drop empty-state message (D-18).
 *   - 'loading' — pre-drop message remains visible with a subtle hint.
 *   - 'loaded'  — DebugPanel (added in Plan 01-04).
 *   - 'error'   — inline muted-orange error text citing typed-error kind
 *                 and message (D-19).
 *
 * The drop-target + drag handlers + path resolution happen downstream in
 * Plan 01-04's DropZone component. This file exposes the seam via props:
 * DropZone will receive a setState callback; DebugPanel will receive the
 * loaded summary.
 *
 * Plan 01-04 wires concrete DropZone + DebugPanel imports; for now the
 * pre-drop empty state (D-18) renders a simple full-window message so
 * `npx electron-vite build` emits a working renderer bundle at end of
 * Plan 01-03.
 */
import { useState } from 'react';
import type { SkeletonSummary, SerializableError } from '../../shared/types.js';

export type AppState =
  | { status: 'idle' }
  | { status: 'loading'; fileName: string }
  | { status: 'loaded'; fileName: string; summary: SkeletonSummary }
  | { status: 'error'; fileName: string; error: SerializableError };

export function App() {
  // Plan 01-04 lifts this state + wires DropZone + DebugPanel.
  const [state] = useState<AppState>({ status: 'idle' });

  return (
    <div className="w-full min-h-screen bg-surface text-fg font-sans antialiased">
      <main className="w-full min-h-screen flex items-center justify-center">
        {state.status === 'idle' && (
          <p className="text-fg-muted font-mono text-sm">
            Drop a <code>.spine</code> JSON file anywhere in this window
          </p>
        )}
        {state.status === 'loading' && (
          <p className="text-fg-muted font-mono text-sm">Loading {state.fileName}…</p>
        )}
        {state.status === 'loaded' && (
          <p className="text-fg font-mono text-sm">
            Loaded {state.fileName} — {state.summary.peaks.length} peaks (DebugPanel lands in Plan 01-04)
          </p>
        )}
        {state.status === 'error' && (
          <p className="text-accent-muted font-mono text-sm">
            {state.error.kind}: {state.error.message}
          </p>
        )}
      </main>
    </div>
  );
}
