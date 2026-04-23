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
import type { LoadResponse } from '../../../shared/types.js';

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
  /** State-appropriate body content injected by parent App.tsx. */
  children: ReactNode;
}

export function DropZone({ onLoad, onLoadStart, children }: DropZoneProps) {
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

      // UX guard — surface a typed envelope inline without a main-process
      // round trip if the user dropped a clearly-wrong extension. NOT a
      // security check; the main handler re-validates (T-01-02-01).
      if (!file.name.toLowerCase().endsWith('.json')) {
        onLoad(
          {
            ok: false,
            error: { kind: 'Unknown', message: `Not a .json file: ${file.name}` },
          },
          file.name,
        );
        return;
      }

      onLoadStart(file.name);
      // Pass the raw File — preload calls webUtils.getPathForFile(file).
      // D-09 mechanism correction (RESEARCH Finding #1): the legacy
      // filesystem-path property on the File object was removed in
      // Electron 32+; we target 41.
      const resp = await window.api.loadSkeletonFromFile(file);
      onLoad(resp, file.name);
    },
    [onLoad, onLoadStart],
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
