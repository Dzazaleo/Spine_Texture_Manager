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
 */
import { useState } from 'react';
import type { OrphanedFile } from '../../../shared/types.js';
import { formatBytes } from '../lib/format-bytes';
import { WarningTriangleIcon } from '../components/icons/WarningTriangleIcon';

export interface UnusedAssetsPanelProps {
  orphanedFiles: OrphanedFile[];
}

export function UnusedAssetsPanel({ orphanedFiles }: UnusedAssetsPanelProps) {
  const [expanded, setExpanded] = useState(true); // D-06: expanded by default when N > 0

  // Computed values — must be derived before the early-return so hooks are
  // unconditionally called (Rules of Hooks).
  const count = orphanedFiles.length;
  const plural = count === 1 ? '' : 's';
  const totalBytes = orphanedFiles.reduce((acc, f) => acc + f.bytesOnDisk, 0);

  // Empty-state contract: render nothing. The panel is invisible when there
  // are no orphaned files. (Verified by RTL test (a).)
  if (orphanedFiles.length === 0) return null;

  return (
    <div
      role="alert"
      aria-label="Unused image files"
      className="border-b border-danger/40 bg-danger/10 px-6 py-2 text-xs text-fg flex flex-wrap items-center gap-2"
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 text-danger flex-shrink-0"
        aria-hidden="true"
      >
        <WarningTriangleIcon className="w-4 h-4" />
      </span>
      <span
        className="inline-block w-1 h-4 bg-danger flex-shrink-0"
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="font-semibold text-danger">
          {count} unused file{plural}
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
            {orphanedFiles.map((f) => (
              <tr key={f.filename} className="border-b border-border">
                <td className="py-2 px-3 font-mono text-sm text-fg">
                  {f.filename}
                </td>
                <td className="py-2 px-3 font-mono text-sm text-fg-muted">
                  {formatBytes(f.bytesOnDisk)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
