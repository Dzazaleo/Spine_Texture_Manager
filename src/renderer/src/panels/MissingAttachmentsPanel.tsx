/**
 * Phase 21 Plan 21-10 (G-02) — MissingAttachmentsPanel.
 *
 * Surfaces SkeletonSummary.skippedAttachments — attachments whose PNG was
 * missing in atlas-less mode. Plan 21-09's stub-region fix synthesizes a
 * 1x1 region for missing PNGs (so spine-core's animation/skin parser doesn't
 * crash on `attachment.bones`); this panel is the user-facing surface that
 * communicates which attachments were stubbed. Without this panel the
 * stubbed attachments would be silently absent from the Max Render Scale
 * list (per HUMAN-UAT G-02 finding) — the user would have zero visual
 * signal that an attachment was dropped due to a missing PNG.
 *
 * Visual treatment: warning banner (left-edge color strip + count header
 * + collapsible list) modeled after AppShell.tsx's skeletonNotFoundError
 * banner pattern (AppShell.tsx:1454-1479). Each entry shows the attachment
 * `name` + the expected PNG path on disk so the user can locate and
 * provide the missing file if needed.
 *
 * Token note (Plan 21-10 ISSUE-010): the project's Tailwind config has no
 * `border-warning` token, so this panel uses `border-danger` (red).
 * Visual severity over-indexes vs the actual issue (warning, not error),
 * but visibility is the primary UX goal here. Future enhancement may add
 * a `border-warning` token.
 *
 * Returns null when length === 0 — no empty-state placeholder. The panel
 * is invisible when there's nothing to surface.
 *
 * AppShell.tsx mounts this above GlobalMaxRenderPanel + AnimationBreakdownPanel
 * inside <main>, so it shows on BOTH the Global tab and the Animation
 * Breakdown tab (orthogonal to the activeTab split — skipped attachments
 * are a project-level concern, not a tab-specific one).
 */
import { useState } from 'react';

export interface MissingAttachmentsPanelProps {
  skippedAttachments: { name: string; expectedPngPath: string }[];
}

export function MissingAttachmentsPanel({
  skippedAttachments,
}: MissingAttachmentsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Empty-state contract: render nothing. The panel is invisible when there
  // are no skipped attachments — atlas-backed projects + happy-path atlas-
  // less loads never see this panel. (Verified by RTL test
  // "returns null when skippedAttachments is empty".)
  if (skippedAttachments.length === 0) {
    return null;
  }

  const count = skippedAttachments.length;
  const plural = count === 1 ? '' : 's';

  return (
    <div
      role="alert"
      aria-label="Missing attachment PNGs"
      className="border-b border-danger/40 bg-danger/10 px-6 py-2 text-xs text-fg flex flex-wrap items-center gap-2"
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 text-danger flex-shrink-0"
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path d="M8 1.5 L14.5 13.5 H1.5 Z" />
        </svg>
      </span>
      <span
        className="inline-block w-1 h-4 bg-danger flex-shrink-0"
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="font-semibold text-danger">
          {count} attachment{plural} missing PNG{plural}
        </span>{' '}
        — see list below
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
        <ul className="basis-full mt-2 space-y-1 font-mono text-xs text-fg-muted">
          {skippedAttachments.map((entry) => (
            <li key={entry.name} className="flex flex-wrap gap-2">
              <span className="text-fg">{entry.name}</span>
              <span aria-hidden="true">→</span>
              <span>{entry.expectedPngPath}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
