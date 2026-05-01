/**
 * Phase 20 D-21 — Documentation HTML export.
 *
 * Pure-TS template-literal-driven HTML rendering + atomic-write IPC handler.
 * NO React in main (renderer-only build dep); NO Tailwind in the output
 * (Tailwind v4 is a renderer-only build-time JIT — its class names are NOT
 * part of the runtime CSS payload).
 *
 * Surface:
 *   - `renderDocumentationHtml(payload): string` — pure function, NO I/O.
 *     `generatedAt` is injected via the payload so tests can pin it for a
 *     deterministic golden-file snapshot (T-20-26 mitigation).
 *   - `handleExportDocumentationHtml(payload): Promise<DocExportResponse>` —
 *     the IPC handler. Orchestrates `dialog.showSaveDialog` →
 *     `renderDocumentationHtml` → `writeHtmlAtomic`. Cancel returns a
 *     `kind:'Unknown'` envelope with message 'Export cancelled' (mirrors the
 *     Save As cancel path in src/main/project-io.ts:179-181).
 *   - `DocExportPayload` / `DocExportResponse` types — the IPC contract,
 *     re-exported through `src/shared/types.ts` for renderer access (type-
 *     only; no runtime cross-boundary imports).
 *
 * Self-containment contract (T-20-20 mitigation):
 *   - Inline `<style>` block (no `<link rel="stylesheet">`).
 *   - Inline SVG glyphs (no `<img>` tags, no remote URLs).
 *   - System font stack (no `@font-face`, no Google Fonts).
 *   - Tests in tests/main/doc-export.spec.ts assert the absence of every
 *     external-asset surface via regex.
 *
 * XSS contract (T-20-19 mitigation):
 *   - `escapeHtml` runs on EVERY user-supplied string field before it lands
 *     in the output: animationName, notes, generalNotes, descriptions,
 *     event/bone/skin names, skeletonBasename. Tests prove that
 *     `<script>alert(1)</script>` becomes `&lt;script&gt;alert(1)&lt;/script&gt;`.
 *
 * Atomic write Pattern-B (mirrors src/main/project-io.ts:246-274):
 *   - writeFile to `<finalPath>.tmp` then rename to `<finalPath>`. Same-
 *     directory tmp avoids EXDEV cross-device errors on rename. On POSIX
 *     this is atomic; on Windows it is best-effort (acceptable for a non-
 *     critical export artifact).
 *
 * Layer 3: this file lives in src/main/, so importing from src/core/* is
 * legal (the renderer is structurally barred from reaching here by the
 * tsconfig.web.json / electron.vite / tests/arch.spec.ts three-layer
 * defense). All electron-specific surface (dialog, BrowserWindow, app)
 * stays in handleExportDocumentationHtml; renderDocumentationHtml is pure
 * and can be unit-tested in vitest's node environment.
 */

import { writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app, dialog, BrowserWindow } from 'electron';
import type { Documentation, AnimationTrackEntry } from '../core/documentation.js';
import type { SkeletonSummary, AtlasPreviewProjection } from '../shared/types.js';

// ---------------------------------------------------------------------------
// IPC contract — payload + response.
// ---------------------------------------------------------------------------

export interface DocExportPayload {
  documentation: Documentation;
  summary: SkeletonSummary;
  atlasPreview: AtlasPreviewProjection;
  /**
   * Pre-computed by renderer (Phase 20 D-18 sub-step 3 — byte-identical to
   * OptimizeDialog.tsx:280-291). null when no rows / no source pixels →
   * the HTML rendering shows '—' instead of a percentage.
   */
  exportPlanSavingsPct: number | null;
  /** Skeleton JSON basename without extension. Used for hero + filename. */
  skeletonBasename: string;
  /** AppSessionState.lastOutDir (D-145); null falls back to OS Documents. */
  lastOutDir: string | null;
  /** ms epoch — Date.now() in production; fixed in tests for snapshot stability. */
  generatedAt: number;
}

export type DocExportResponse =
  | { ok: true; path: string }
  | { ok: false; error: { kind: 'Unknown'; message: string } };

// ---------------------------------------------------------------------------
// IPC handler — dialog → render → atomic write.
// ---------------------------------------------------------------------------

export async function handleExportDocumentationHtml(
  payload: DocExportPayload,
): Promise<DocExportResponse> {
  const win = BrowserWindow.getFocusedWindow();
  const defaultDir = payload.lastOutDir ?? app.getPath('documents');
  const options: Electron.SaveDialogOptions = {
    title: 'Export Documentation as HTML',
    defaultPath: path.join(defaultDir, `${payload.skeletonBasename}.html`),
    filters: [{ name: 'HTML Document', extensions: ['html'] }],
  };
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { ok: false, error: { kind: 'Unknown', message: 'Export cancelled' } };
  }
  // T-20-21 path-traversal mitigation: the dialog returns an absolute path,
  // but defensively reject anything else before writing.
  if (!path.isAbsolute(result.filePath)) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'Export path must be absolute' },
    };
  }
  const html = renderDocumentationHtml(payload);
  return writeHtmlAtomic(result.filePath, html);
}

async function writeHtmlAtomic(finalPath: string, html: string): Promise<DocExportResponse> {
  const tmpPath = finalPath + '.tmp';
  try {
    await writeFile(tmpPath, html, 'utf8');
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `writeFile tmp failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  try {
    await rename(tmpPath, finalPath);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `rename tmp→final failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  return { ok: true, path: finalPath };
}

// ---------------------------------------------------------------------------
// HTML escape — every user-supplied string flows through this. T-20-19.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * DD/MM/YYYY date format (matches user's locked screenshot format `14/04/2026`).
 *
 * Uses `toISOString()` to extract the YYYY-MM-DD prefix in a TZ-stable way —
 * the test pins `generatedAt` to a fixed UTC midnight-ish timestamp, and we
 * want the same string in every locale. Production wall-clock dates land on
 * the same UTC date except for users authoring near midnight in a timezone
 * with a UTC offset that crosses the date boundary; that edge case is
 * acceptable for a documentation snapshot.
 */
function formatDateDDMMYYYY(ms: number): string {
  const iso = new Date(ms).toISOString(); // 2026-04-14T12:00:00.000Z
  const datePart = iso.slice(0, 10); // 2026-04-14
  const [yyyy, mm, dd] = datePart.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Inline SVG glyphs — viewBox=20×20, stroke=currentColor (Phase 19 D-08
// pattern; the parent's text color drives the visual). Locked per
// 20-CONTEXT.md D-19.
// ---------------------------------------------------------------------------

const SVG_OPEN =
  '<svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">';

const GLYPH = {
  clock: `${SVG_OPEN}<circle cx="10" cy="10" r="7"/><path d="M10 6 v4 l3 2"/></svg>`,
  bone: `${SVG_OPEN}<path d="M5 8 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 v4 a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 z"/></svg>`,
  layeredStack: `${SVG_OPEN}<path d="M2 6 l8 -3 8 3 -8 3 z"/><path d="M2 10 l8 3 8 -3"/><path d="M2 14 l8 3 8 -3"/></svg>`,
  shield: `${SVG_OPEN}<path d="M10 3 L4 5 v5 c0 4 3 6 6 7 3 -1 6 -3 6 -7 V5 z"/></svg>`,
  speech: `${SVG_OPEN}<path d="M3 4 h14 v9 h-7 l-4 3 v-3 H3 z"/></svg>`,
  bell: `${SVG_OPEN}<path d="M5 13 v-3 a5 5 0 0 1 10 0 v3 l1 2 H4 z"/></svg>`,
  doc: `${SVG_OPEN}<path d="M5 2 h7 l3 3 v13 H5 z"/><path d="M12 2 v3 h3"/></svg>`,
  image: `${SVG_OPEN}<rect x="2" y="3" width="16" height="14" rx="1"/><circle cx="7" cy="8" r="1.5"/><path d="M2 14 l4 -4 4 3 4 -5 4 4 v5"/></svg>`,
  film: `${SVG_OPEN}<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M9 7 l4 3 -4 3 z"/></svg>`,
  lightning: `${SVG_OPEN}<path d="M11 2 L4 11 h5 l-2 7 7 -9 h-5 z"/></svg>`,
  map: `${SVG_OPEN}<path d="M2 5 l5 -2 6 2 5 -2 v12 l-5 2 -6 -2 -5 2 z"/><path d="M7 3 v14 M13 5 v14"/></svg>`,
};

// ---------------------------------------------------------------------------
// Inline <style> block — locked palette per 20-CONTEXT.md D-17.
// Self-contained: no @font-face, no @import, no remote url(). System font
// stack uses local OS fonts only.
// ---------------------------------------------------------------------------

const STYLE_BLOCK = `<style>
:root {
  --bg: #1c1917;
  --card: #23201d;
  --border: rgba(168, 162, 158, 0.18);
  --terracotta: #e06b55;
  --blue: #5fa8d4;
  --green: #5fa866;
  --muted: #a8a29e;
  --fg: #f5f5f4;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 32px; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.5; }
.hero { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.hero-title { font-size: 24px; font-weight: 600; }
.hero-name { color: var(--terracotta); }
.chip-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; font-size: 12px; color: var(--muted); }
.chip svg { color: var(--blue); }
.row { display: flex; gap: 16px; margin-bottom: 16px; }
.card { flex: 1; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 16px; font-weight: 600; }
.card-header svg { color: var(--green); }
.card-header.bones svg, .card-header.events svg { color: var(--terracotta); }
.card-header.skins svg { color: var(--blue); }
.card-header.tracks svg { color: var(--terracotta); }
.card-header.notes svg { color: var(--blue); }
.loop-pill { display: inline-flex; align-items: center; padding: 2px 6px; font-size: 10px; font-family: monospace; border-radius: 4px; background-color: rgba(95, 168, 212, 0.15); color: var(--blue); }
.track-divider { display: flex; align-items: center; gap: 8px; font-family: monospace; font-size: 12px; color: var(--terracotta); margin-top: 12px; margin-bottom: 4px; }
.track-divider::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--terracotta); }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 11px; color: var(--muted); padding: 8px 12px; border-bottom: 1px solid var(--border); }
td { padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: top; }
.entry-name { font-family: monospace; color: var(--terracotta); }
.entry-name.skin { color: var(--blue); }
.entry-desc { color: var(--muted); margin-top: 2px; font-size: 12px; }
.notes-pre { white-space: pre-wrap; font-family: inherit; color: var(--muted); margin: 0; }
.config-value { font-family: monospace; font-size: 28px; color: var(--fg); }
.config-label { font-size: 11px; color: var(--muted); margin-top: 4px; }
.config-sublabel { font-size: 10px; color: var(--muted); margin-top: 2px; }
.entry-list { list-style: none; padding: 0; margin: 0; }
.entry-list li { margin-bottom: 12px; }
.empty-state { font-style: italic; color: var(--muted); font-size: 13px; }
</style>`;

// ---------------------------------------------------------------------------
// Section renderers.
// ---------------------------------------------------------------------------

function renderHero(skeletonName: string): string {
  return `<div class="hero">
    ${GLYPH.doc}
    <div class="hero-title">Spine Documentation / <span class="hero-name">${escapeHtml(skeletonName)}</span></div>
  </div>`;
}

/**
 * Compute the largest dimension across all atlas pages for the chip strip's
 * "{N} Atlas Pages ({MAX_PAGE_PX}px)" line. Returns 0 for the degenerate
 * empty-input case (atlas-preview already guards at least-one-page emit, so
 * this is double-defense).
 */
function computeMaxPagePx(ap: AtlasPreviewProjection): number {
  if (!ap.pages || ap.pages.length === 0) return 0;
  return Math.max(...ap.pages.map((p) => Math.max(p.width, p.height)));
}

function renderChipStrip(payload: DocExportPayload): string {
  const generated = formatDateDDMMYYYY(payload.generatedAt);
  const imagesUtilized = payload.summary.attachments.count;
  // D-18 sub-step 3 + 20-UI-SPEC copy contract: this counts USER-AUTHORED
  // tracked entries, NOT summary.animations.count. The chip wording is
  // "Animations Configured" (configured for runtime), not "Animations".
  const animationsConfigured = payload.documentation.animationTracks.length;
  const optimizedAssets = payload.summary.peaks.length;
  const atlasPages = payload.atlasPreview.totalPages;
  const maxPagePx = computeMaxPagePx(payload.atlasPreview);
  return `<div class="chip-strip">
    <span class="chip">${GLYPH.clock}Generated: ${escapeHtml(generated)}</span>
    <span class="chip">${GLYPH.image}${imagesUtilized} Images Utilized</span>
    <span class="chip">${GLYPH.film}${animationsConfigured} Animations Configured</span>
    <span class="chip">${GLYPH.lightning}${optimizedAssets} Optimized Assets</span>
    <span class="chip">${GLYPH.map}${atlasPages} Atlas Pages (${maxPagePx}px)</span>
  </div>`;
}

function renderOptimizationConfigCard(payload: DocExportPayload): string {
  const safetyRaw = payload.documentation.safetyBufferPercent;
  // Integer values render plain (e.g. "1"); fractional values render with
  // one-decimal precision (e.g. "1.5"). The '%' suffix is appended once
  // outside the value span so the snapshot is stable.
  const safetyDisplay = Number.isInteger(safetyRaw)
    ? `${safetyRaw}`
    : `${safetyRaw.toFixed(1)}`;
  const savingsPct = payload.exportPlanSavingsPct;
  const savingsDisplay = savingsPct === null ? '—' : `${savingsPct.toFixed(1)}%`;
  return `<div class="card">
    <div class="card-header"><span>${GLYPH.shield}</span><span>Optimization Config</span></div>
    <div class="config-value">${escapeHtml(safetyDisplay)}%</div>
    <div class="config-label">Safety Buffer</div>
    <div class="config-value" style="margin-top:16px;">${escapeHtml(savingsDisplay)}</div>
    <div class="config-label">Space Savings</div>
    <div class="config-sublabel">Estimated Reduction</div>
  </div>`;
}

function renderGeneralNotesCard(notes: string): string {
  return `<div class="card">
    <div class="card-header notes"><span>${GLYPH.speech}</span><span>General Notes</span></div>
    <pre class="notes-pre">${escapeHtml(notes)}</pre>
  </div>`;
}

function renderTracksCard(tracks: AnimationTrackEntry[]): string {
  if (tracks.length === 0) {
    return `<div class="card">
      <div class="card-header tracks"><span>${GLYPH.clock}</span><span>Animation Tracks</span></div>
      <p class="empty-state">No animation tracks configured.</p>
    </div>`;
  }
  // Group entries by trackIndex; render in ascending order (D-05).
  const indices = Array.from(new Set(tracks.map((t) => t.trackIndex))).sort(
    (a, b) => a - b,
  );
  let body =
    '<table><thead><tr><th>ANIMATION NAME</th><th>MIX TIME</th><th>LOOP</th><th>NOTES</th></tr></thead><tbody>';
  for (const idx of indices) {
    body += `<tr><td colspan="4"><div class="track-divider">Track ${idx}</div></td></tr>`;
    for (const entry of tracks.filter((t) => t.trackIndex === idx)) {
      const loopCell = entry.loop ? '<span class="loop-pill">LOOP</span>' : '—';
      body += `<tr>
        <td><span class="entry-name">${escapeHtml(entry.animationName)}</span></td>
        <td>${escapeHtml(`${entry.mixTime}s`)}</td>
        <td>${loopCell}</td>
        <td class="entry-desc">${escapeHtml(entry.notes)}</td>
      </tr>`;
    }
  }
  body += '</tbody></table>';
  return `<div class="card">
    <div class="card-header tracks"><span>${GLYPH.clock}</span><span>Animation Tracks</span></div>
    ${body}
  </div>`;
}

/**
 * Generic per-entry list card for Control Bones / Skins / Events. Empty
 * lists either render the empty-state copy (when emptyMessage !== null) or
 * an empty <ul> (when emptyMessage === null — Skins always lists every
 * skin per D-11; the renderer never sees an empty list under normal flow).
 */
function renderEntryListCard(
  headerClass: 'bones' | 'skins' | 'events',
  glyph: string,
  title: string,
  entries: Array<{ name: string; description: string }>,
  emptyMessage: string | null,
): string {
  const skinExtra = headerClass === 'skins' ? ' skin' : '';
  if (entries.length === 0 && emptyMessage !== null) {
    return `<div class="card">
      <div class="card-header ${headerClass}"><span>${glyph}</span><span>${escapeHtml(title)}</span></div>
      <p class="empty-state">${escapeHtml(emptyMessage)}</p>
    </div>`;
  }
  const items = entries
    .map(
      (e) =>
        `<li><div class="entry-name${skinExtra}">${escapeHtml(e.name)}</div><div class="entry-desc">${escapeHtml(e.description)}</div></li>`,
    )
    .join('');
  return `<div class="card">
    <div class="card-header ${headerClass}"><span>${glyph}</span><span>${escapeHtml(title)}</span></div>
    <ul class="entry-list">${items}</ul>
  </div>`;
}

// ---------------------------------------------------------------------------
// Top-level render — assembles the locked layout from D-18.
// ---------------------------------------------------------------------------

export function renderDocumentationHtml(payload: DocExportPayload): string {
  const skeletonName = payload.skeletonBasename.toUpperCase();
  // D-10 opt-in: only documented bones (description.length > 0) are saved.
  // The renderer's SectionsPane filters at save-time; this is defensive.
  const documentedBones = payload.documentation.controlBones;
  const skins = payload.documentation.skins;
  const events = payload.documentation.events;
  // D-18 sub-step 6 — Events card only renders when the skeleton has events.
  // Mirrors the user's screenshot reference (no events → no card section).
  const showEventsCard = payload.summary.events.count > 0;

  let body = '';
  body += renderHero(skeletonName);
  body += renderChipStrip(payload);
  body += `<div class="row">${renderOptimizationConfigCard(payload)}${renderGeneralNotesCard(payload.documentation.generalNotes)}</div>`;
  body += renderTracksCard(payload.documentation.animationTracks);
  body += `<div class="row">${renderEntryListCard('bones', GLYPH.bone, 'Control Bones', documentedBones, 'No control bones documented.')}${renderEntryListCard('skins', GLYPH.layeredStack, 'Skins', skins, null)}</div>`;
  if (showEventsCard) {
    body += renderEntryListCard('events', GLYPH.bell, 'Events', events, null);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Spine Documentation — ${escapeHtml(skeletonName)}</title>
${STYLE_BLOCK}
</head>
<body>
${body}
</body>
</html>`;
}
