/**
 * Phase 24 PANEL-02 — UnusedAssetsPanel.
 *
 * Surfaces SkeletonSummary.orphanedFiles — PNG files in images/ that the rig
 * does not reference. Hidden when orphanedFiles.length === 0 (D-06).
 * Expanded by default when N > 0 (D-06 "expanded when N > 0").
 *
 * Visual treatment mirrors MissingAttachmentsPanel (border-danger accent strip,
 * collapsible header, inline count + bytes in header per D-11).
 *
 * Security: filenames from OrphanedFile are rendered as React children (text
 * content), NOT via dangerouslySetInnerHTML. React auto-escapes text — no XSS
 * vector (T-24-03-01 mitigated).
 *
 * Returns null when length === 0 — no empty-state placeholder. The panel is
 * invisible when there's nothing to surface. Panel position in render tree:
 * after <GlobalMaxRenderPanel>, before <AnimationBreakdownPanel> (D-07).
 *
 * Phase 26.2 D-03 — query lifted to AppShell (single SearchBar drives all
 * panels). Internal query useState removed; query is now driven by AppShell
 * via props, matching GlobalMaxRenderPanel/AnimationBreakdownPanel shape.
 */
import { useState, useMemo } from 'react';
import type { OrphanedFile } from '../../../shared/types.js';
import { formatBytes } from '../lib/format-bytes';

export interface UnusedAssetsPanelProps {
  orphanedFiles: OrphanedFile[];
  /** Phase 26.2 D-03 — query lifted to AppShell (single SearchBar drives all panels). */
  query: string;
  onQueryChange: (q: string) => void;
}

export function UnusedAssetsPanel({ orphanedFiles, query, onQueryChange: _onQueryChange }: UnusedAssetsPanelProps) {
  const [expanded, setExpanded] = useState(true); // D-06: expanded by default when N > 0
  // query useState REMOVED (Phase 26.2 D-03) — now driven by AppShell via props

  // Computed values — must be derived before the early-return so hooks are
  // unconditionally called (Rules of Hooks). `filteredOrphans` is only
  // consumed in the expanded branch; we compute it here regardless.
  const count = orphanedFiles.length;
  const plural = count === 1 ? '' : 's';
  const totalBytes = orphanedFiles.reduce((acc, f) => acc + f.bytesOnDisk, 0);

  const filteredOrphans = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return orphanedFiles.slice();
    return orphanedFiles.filter((f) => f.filename.toLowerCase().includes(q));
  }, [orphanedFiles, query]);

  // Empty-state contract: render nothing. The panel is invisible when there
  // are no orphaned files. (Verified by RTL test (a).)
  if (orphanedFiles.length === 0) return null;

  return (
    <div
      role="alert"
      aria-label="Orphaned image files"
      className="border-b border-danger/40 bg-danger/10 px-6 py-2 text-xs text-fg flex flex-wrap items-center gap-2"
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 text-danger flex-shrink-0"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M10 3.5 L17.5 16.5 H2.5 Z" />
          <line x1="10" y1="8" x2="10" y2="12" />
          <circle cx="10" cy="14.5" r="0.5" fill="currentColor" />
        </svg>
      </span>
      <span
        className="inline-block w-1 h-4 bg-danger flex-shrink-0"
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="font-semibold text-danger">
          {count} orphaned file{plural}
        </span>
        {totalBytes > 0 && (
          <span className="text-fg-muted"> · {formatBytes(totalBytes)}</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer flex-shrink-0"
      >
        {expanded ? 'Hide details' : 'Show details'}
      </button>
      {expanded && (
        <>
          <table className="basis-full mt-2 w-full border-collapse">
            <thead>
              <tr className="bg-panel">
                <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">
                  Filename
                </th>
                <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">
                  Size on Disk
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrphans.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="text-fg-muted font-mono text-sm text-center py-4"
                  >
                    (no matches)
                  </td>
                </tr>
              ) : (
                filteredOrphans.map((f) => (
                  <tr key={f.filename} className="border-b border-border">
                    <td className="py-2 px-3 font-mono text-sm text-fg">
                      {f.filename}
                    </td>
                    <td className="py-2 px-3 font-mono text-sm text-fg-muted">
                      {formatBytes(f.bytesOnDisk)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
