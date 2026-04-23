/**
 * Phase 1 Plan 04 — DebugPanel: skeleton summary header + CLI-style peak table.
 *
 * Two parts (D-16):
 *   1. Header block — skeleton path, atlas path, bone/slot/attachment counts,
 *      skin list, animation list. Composed from SkeletonSummary fields.
 *   2. Peak-scale table — monospace <pre> ported verbatim from
 *      `scripts/cli.ts` renderTable() (lines 77–126). Column order, header
 *      labels, two-space separator, Unicode × (U+00D7), and all three
 *      formatters must match the CLI output byte-for-byte (manual smoke
 *      test scheduled in Plan 01-05).
 *
 * Port mechanics (PATTERNS §DebugPanel steps 1–4):
 *   - Input: DisplayRow[] (already sorted by buildSummary — src/main/summary.ts
 *     delegates the fold to src/core/analyzer.ts which sorts by
 *     (skinName, slotName, attachmentName) matching cli.ts byte-for-byte per
 *     D-16/D-34; sort step from cli.ts is skipped here).
 *   - Output: <pre className="font-mono">{text}</pre> where `text` is the
 *     same string that cli.ts renderTable would emit.
 *
 * D-17 console echo: caller (App.tsx) is responsible for echoing summary
 * to console on load — NOT this component. Keep DebugPanel side-effect-free.
 *
 * Fonts: font-mono utility class resolves to --font-mono (JetBrains Mono via
 * self-hosted @fontsource/jetbrains-mono @font-face in index.css — Plan 01-03).
 */
import type {
  SkeletonSummary,
  DisplayRow,
} from '../../../shared/types.js';

export interface DebugPanelProps {
  summary: SkeletonSummary;
}

/** Lower-case + strip 'Attachment' suffix: 'RegionAttachment' → 'region'. */
function displayType(spineClassName: string): string {
  return spineClassName.replace(/Attachment$/, '').toLowerCase();
}

/** Byte-for-byte port of scripts/cli.ts renderTable, minus the sort step. */
function renderTable(peaks: readonly DisplayRow[]): string {
  const rows: string[][] = [];
  rows.push([
    'Attachment',
    'Skin',
    'Source W×H',
    'Peak W×H',
    'Scale',
    'Source Animation',
    'Frame',
  ]);
  // peaks[] is already sorted by (skinName, slotName, attachmentName) —
  // src/main/summary.ts did the sort per tests/core/summary.spec.ts D-16
  // assertion. We intentionally DO NOT re-sort here.
  for (const rec of peaks) {
    const worldW = rec.worldW.toFixed(1);
    const worldH = rec.worldH.toFixed(1);
    rows.push([
      `${rec.slotName}/${rec.attachmentName}`,
      rec.skinName,
      `${rec.sourceW}×${rec.sourceH}`,
      `${worldW}×${worldH}`,
      rec.peakScale.toFixed(3),
      rec.animationName,
      String(rec.frame),
    ]);
  }

  // Compute column widths.
  const cols = rows[0].length;
  const widths = new Array<number>(cols).fill(0);
  for (const r of rows) {
    for (let c = 0; c < cols; c++) {
      if (r[c].length > widths[c]) widths[c] = r[c].length;
    }
  }

  // Two-space column separator (no pipes) — matches Phase 0 CLI output.
  const pad = (s: string, w: number) => s + ' '.repeat(w - s.length);
  const out: string[] = [];
  out.push(rows[0].map((s, i) => pad(s, widths[i])).join('  '));
  out.push(widths.map((w) => '-'.repeat(w)).join('  '));
  for (let i = 1; i < rows.length; i++) {
    out.push(rows[i].map((s, j) => pad(s, widths[j])).join('  '));
  }
  return out.join('\n');
}

function formatByType(byType: Record<string, number>): string {
  const parts: string[] = [];
  for (const [className, count] of Object.entries(byType)) {
    parts.push(`${displayType(className)}:${count}`);
  }
  return parts.length > 0 ? ` (${parts.join(' ')})` : '';
}

export function DebugPanel({ summary }: DebugPanelProps) {
  const tableText = renderTable(summary.peaks);
  const byType = formatByType(summary.attachments.byType);
  const skinsText = summary.skins.names.join(', ');
  const animsText = summary.animations.names.join(', ');

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="mb-6 font-mono text-sm text-fg">
        <div>
          <span className="text-fg-muted">Skeleton: </span>
          <span>{summary.skeletonPath}</span>
        </div>
        <div>
          <span className="text-fg-muted">Atlas:    </span>
          <span>{summary.atlasPath}</span>
        </div>
        <div className="mt-2">
          <span className="text-fg-muted">Bones:    </span>
          <span>{summary.bones.count}</span>
          <span className="text-fg-muted">   Slots: </span>
          <span>{summary.slots.count}</span>
          <span className="text-fg-muted">   Attachments: </span>
          <span>
            {summary.attachments.count}
            {byType}
          </span>
        </div>
        <div>
          <span className="text-fg-muted">Skins:    </span>
          <span>{skinsText}</span>
        </div>
        <div>
          <span className="text-fg-muted">Animations: </span>
          <span>
            {summary.animations.count} — {animsText}
          </span>
        </div>
        <div className="mt-2 text-fg-muted">
          Elapsed: {summary.elapsedMs.toFixed(1)} ms (120 Hz sampling)
        </div>
      </header>
      <pre className="font-mono text-xs text-fg whitespace-pre overflow-x-auto bg-panel border border-border rounded p-4">
        {tableText}
      </pre>
    </div>
  );
}
