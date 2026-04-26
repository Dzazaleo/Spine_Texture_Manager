/**
 * Phase 1 Plan 04 — DropZone full-window drag target.
 *
 * Responsibilities:
 *   1. Render a full-window <div> with React DragEvent handlers.
 *   2. On drop, guard the JSON extension (UX-only check — not a security
 *      boundary per RESEARCH Security Domain V5; main process re-validates).
 *   3. Pass the raw File object to `window.api.loadSkeletonFromFile(file)`.
 *      The preload (Plan 01-03) resolves the filesystem path via
 *      `webUtils.getPathForFile(file)` — D-09 mechanism correction.
 *   4. Visual feedback — drag-over ring using literal Tailwind classes
 *      (`ring-2 ring-accent bg-accent/5`) per Pitfall 8: Tailwind v4 scans
 *      source files for class-string literals; concatenated class names
 *      from variables are invisible to the scanner.
 *   5. Call onLoad(resp, fileName) when the async roundtrip completes;
 *      parent App.tsx transitions AppState.
 *
 * Rationale for hand-rolling the drop handler (RESEARCH "NOT using" table
 * line 246): popular third-party drop-library wrappers reconstruct File
 * objects in a way that makes webUtils.getPathForFile return an empty
 * string — breaking the entire drop flow. A bare ~50-line handler avoids
 * the bug class and sidesteps the Electron issue #44600 regression.
 *
 * Rationale for NOT importing src/core/* directly (CLAUDE.md Fact #5):
 *   loader/sampler live in main process; renderer only consumes the
 *   projected SkeletonSummary via IPC. Three-layer defense enforced via
 *   tests/arch.spec.ts (Layer 3).
 */
import { useState, useCallback, type DragEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import type { LoadResponse, OpenResponse } from '../../../shared/types.js';

export interface DropZoneProps {
  /**
   * Called when the drop completes (success OR typed error).
   * Parent is responsible for transitioning AppState.
   */
  onLoad: (resp: LoadResponse, fileName: string) => void;
  /**
   * Called the moment a valid drop starts — parent transitions to 'loading'
   * so the UI can show a loading hint (D-19 in-place replacement).
   */
  onLoadStart: (fileName: string) => void;
  /**
   * Phase 8 — .stmproj branch (D-142). Optional so the existing single-callback
   * pattern keeps working; AppShell wires both pairs in Plan 04 Task 4.
   */
  onProjectDrop?: (resp: OpenResponse, fileName: string) => void;
  /** Phase 8 — .stmproj loading-start handshake. Mirrors onLoadStart shape. */
  onProjectDropStart?: (fileName: string) => void;
  /**
   * Phase 8 — pre-drop dirty-guard hook (D-143). When provided, DropZone
   * awaits this promise before invoking the IPC. Returns true to proceed,
   * false to abort. Default behavior (when undefined): proceed.
   *
   * The parent (AppShell or App.tsx) inspects isDirty inside this callback
   * and may mount the SaveQuitDialog with reason matching the kind:
   * 'json' → 'new-skeleton-drop'; 'stmproj' → 'new-project-drop'.
   * Resolves true (Save / Don't Save) or false (Cancel).
   */
  onBeforeDrop?: (fileName: string, kind: 'json' | 'stmproj') => Promise<boolean>;
  /** State-appropriate body content injected by parent App.tsx. */
  children: ReactNode;
}

export function DropZone({
  onLoad,
  onLoadStart,
  onProjectDrop,
  onProjectDropStart,
  onBeforeDrop,
  children,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Phase 8 D-142: extension dispatch — .json → existing skeleton-load
      // path; .stmproj → new project-load path; everything else → typed
      // rejection envelope. UX guards only — main handlers re-validate.
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.stmproj')) {
        if (typeof onProjectDrop !== 'function' || typeof onProjectDropStart !== 'function') {
          // No project-handling wired — fall through to legacy rejection
          // envelope so the parent's existing error UI surfaces something.
          onLoad(
            {
              ok: false,
              error: { kind: 'Unknown', message: `Project drop not wired: ${file.name}` },
            },
            file.name,
          );
          return;
        }
        // Pre-drop dirty-guard (D-143). Parent (AppShell via App.tsx wiring)
        // gets a chance to mount SaveQuitDialog before the IPC fires.
        if (typeof onBeforeDrop === 'function') {
          const proceed = await onBeforeDrop(file.name, 'stmproj');
          if (!proceed) return;
        }
        onProjectDropStart(file.name);
        // Pass the raw File — preload calls webUtils.getPathForFile(file).
        const resp = await window.api.openProjectFromFile(file);
        onProjectDrop(resp, file.name);
        return;
      }

      if (lower.endsWith('.json')) {
        if (typeof onBeforeDrop === 'function') {
          const proceed = await onBeforeDrop(file.name, 'json');
          if (!proceed) return;
        }
        onLoadStart(file.name);
        // Pass the raw File — preload calls webUtils.getPathForFile(file).
        // D-09 mechanism correction (RESEARCH Finding #1): the legacy
        // filesystem-path property on the File object was removed in
        // Electron 32+; we target 41.
        const resp = await window.api.loadSkeletonFromFile(file);
        onLoad(resp, file.name);
        return;
      }

      // Other → typed rejection envelope. Message updated to mention .stmproj
      // alongside .json so users understand the new accepted formats.
      onLoad(
        {
          ok: false,
          error: {
            kind: 'Unknown',
            message: `Not a .json or .stmproj file: ${file.name}`,
          },
        },
        file.name,
      );
    },
    [onLoad, onLoadStart, onProjectDrop, onProjectDropStart, onBeforeDrop],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      // All class strings are LITERAL — Pitfall 8 safe (Tailwind v4 scanner
      // picks them up). Do not refactor to template strings like `ring-${color}`.
      className={clsx(
        'w-full min-h-screen flex items-center justify-center',
        'bg-surface text-fg',
        'focus-visible:outline-2 focus-visible:outline-accent',
        isDragOver && 'ring-2 ring-accent bg-accent/5',
      )}
    >
      {children}
    </div>
  );
}
