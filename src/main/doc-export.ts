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
  /**
   * Phase 30 closure plan 30-05 — CR-04 fix (Option C). The new top-level
   * safetyBufferPercent (range 0-25, integer) that drives buildExportPlan
   * math. Pre-Phase-30, the HTML report's "Optimization Config" card read
   * the LEGACY `documentation.safetyBufferPercent` (range 0-100, fractional,
   * metadata-only per the v1.2 input copy). Phase 30 wires the report to
   * read the value that actually drives the export instead. Optional for
   * backward-compat: pre-30-05 callers (test fixtures) without this field
   * fall through the defensive integer-range coerce in
   * renderOptimizationConfigCard with a 0 default.
   */
  safetyBufferPercent?: number;
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
// Inline SVG glyphs.
//
// 2026-05-19: the locked 20-CONTEXT.md D-17 palette and D-18 layout were
// superseded by a user-approved "exact visual match" reskin against the
// reference design (Unity_Documentation/spine-documentation-2 Skeletons).
// The DELIVERY contract is unchanged and still LOCKED — one self-contained
// .html, zero network, inline <style> + inline SVG (no CDN React/Tailwind/
// Babel like the reference file used). Only the visual design changed.
//
// stroke=currentColor so the parent element's CSS `color` drives each
// glyph's tint (Phase 19 D-08 pattern). `icon(body, size)` stamps a glyph
// at a given pixel box; viewBox stays 20×20 regardless of size.
// ---------------------------------------------------------------------------

function icon(body: string, size: number): string {
  return `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const PATH = {
  doc: '<path d="M5 2 h7 l3 3 v13 H5 z"/><path d="M12 2 v3 h3"/><path d="M7.5 11 h5 M7.5 14 h5"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6 v4 l3 2"/>',
  bone: '<path d="M5 8 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 v4 a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 z"/>',
  layers:
    '<path d="M10 2 l8 4 -8 4 -8 -4 z"/><path d="M2 10 l8 4 8 -4"/><path d="M2 14 l8 4 8 -4"/>',
  shield: '<path d="M10 2.5 L4 5 v4.5 c0 4 3 6.5 6 7.5 3 -1 6 -3.5 6 -7.5 V5 z"/>',
  speech: '<path d="M3 4 h14 v10 h-8 l-4 3 v-3 H3 z"/>',
  scaling:
    '<path d="M3 17 L17 3"/><path d="M9 3 h8 v8"/><rect x="3" y="11" width="6" height="6" rx="1"/>',
  image:
    '<rect x="2" y="3" width="16" height="14" rx="1.5"/><circle cx="7" cy="8" r="1.5"/><path d="M2.5 14 l4 -4 4 3 4 -5 3 3"/>',
  film: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 7.5 h14 M3 12.5 h14 M7 3 v14 M13 3 v14"/>',
  lightning: '<path d="M11 2 L4 11 h5 l-2 7 7 -9 h-5 z"/>',
  map: '<path d="M2 5 l5 -2 6 2 5 -2 v12 l-5 2 -6 -2 -5 2 z"/><path d="M7 3 v14 M13 5 v14"/>',
};

// ---------------------------------------------------------------------------
// Inline <style> block — reference-matched palette + layout (see glyph note
// above for the D-17/D-18 supersession). Self-contained: no @font-face,
// no @import, no remote url(). System font stack uses local OS fonts only.
// Tailwind utility classes from the reference are translated to plain CSS
// so the output renders identically with ZERO runtime dependencies.
// ---------------------------------------------------------------------------

const STYLE_BLOCK = `<style>
:root {
  --bg: #1e1e23;
  --fg: #e5e7eb;
  --white: #ffffff;
  --accent: #ff5c5c;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-700-50: rgba(55, 65, 81, 0.5);
  --gray-700-30: rgba(55, 65, 81, 0.3);
  --gray-800: #1f2937;
  --gray-800-30: rgba(31, 41, 55, 0.3);
  --gray-800-40: rgba(31, 41, 55, 0.4);
  --gray-800-50: rgba(31, 41, 55, 0.5);
  --gray-800-80: rgba(31, 41, 55, 0.8);
  --gray-900-50: rgba(17, 24, 39, 0.5);
  --blue-300: #93c5fd;
  --blue-400: #60a5fa;
  --purple-400: #c084fc;
  --yellow-400: #facc15;
  --yellow-500: #eab308;
  --green-400: #4ade80;
  --blue-900-30: rgba(30, 58, 138, 0.3);
  --blue-700-30: rgba(29, 78, 216, 0.3);
  --white-5: rgba(255, 255, 255, 0.05);
  --black-20: rgba(0, 0, 0, 0.2);
}
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
::selection { background: var(--accent); color: #fff; }
.doc { max-width: 1152px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }

.header { display: flex; flex-direction: column; gap: 16px; border-bottom: 1px solid var(--gray-700); padding-bottom: 24px; }
.title { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.025em; color: var(--white); }
.title svg { color: var(--accent); flex-shrink: 0; }
.title .sep { color: var(--gray-500); margin: 0 8px; }
.title .name { color: var(--accent); }
.chips { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; font-size: 14px; font-family: monospace; color: var(--gray-400); }
.chip { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: var(--black-20); border: 1px solid var(--white-5); border-radius: 9999px; }
.chip svg { width: 14px; height: 14px; }
.chip.img svg { color: var(--blue-400); }
.chip.film svg { color: var(--purple-400); }
.chip.zap svg { color: var(--yellow-400); }
.chip.map svg { color: var(--green-400); }

.grid3 { display: grid; grid-template-columns: 1fr; gap: 24px; }
.card { background: var(--gray-800-50); border: 1px solid var(--gray-700); border-radius: 12px; padding: 20px; }
.card.optim { display: flex; flex-direction: column; justify-content: space-between; }
.sec-mini { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.sec-mini svg { width: 20px; height: 20px; }
.sec-mini h3 { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.sec-mini.shield { color: var(--green-400); }
.sec-mini.scaling, .sec-mini.notes { color: var(--blue-400); }
.big-value { font-size: 30px; font-weight: 700; color: var(--white); }
.sub-label { margin: 0; font-size: 14px; color: var(--gray-400); }
.divider-top { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--gray-700-50); }
.notes-card { margin-bottom: 0; }
.notes-card .sec-mini { margin-bottom: 12px; }
.notes-body { font-size: 14px; color: var(--fg); white-space: pre-wrap; line-height: 1.625; margin: 0; font-family: inherit; }
.notes-empty { margin: 0; font-size: 14px; color: var(--gray-500); font-style: italic; }

.table-card { background: var(--gray-800-30); border: 1px solid var(--gray-700); border-radius: 12px; overflow: hidden; }
.table-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: var(--gray-800); border-bottom: 1px solid var(--gray-700); }
.table-card-head h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; font-weight: 700; color: var(--white); }
.table-card-head svg { width: 20px; height: 20px; color: var(--gray-400); }
.table-wrap { overflow-x: auto; }
table { width: 100%; text-align: left; border-collapse: collapse; }
thead tr { background: var(--gray-900-50); font-size: 12px; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; }
th { padding: 12px 24px; border-bottom: 1px solid var(--gray-700); font-weight: 400; }
th.col-mix { width: 128px; text-align: center; }
th.col-loop { width: 96px; text-align: center; }
th.col-name { width: 33.333%; }
tbody.track-group { border-bottom: 1px solid var(--gray-700-50); }
tbody.track-group:last-of-type { border-bottom: 0; }
td { padding: 12px 24px; border-bottom: 1px solid var(--gray-700-30); font-size: 14px; vertical-align: top; }
.track-group tr:last-child td { border-bottom: 0; }
tr.track-row td { padding: 8px 24px; background: var(--gray-800-40); }
.track-tag { display: flex; align-items: center; gap: 8px; font-family: monospace; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); }
.track-dot { display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background: var(--accent); }
tr.anim-row { transition: background-color 0.15s; }
tr.anim-row:hover { background: var(--white-5); }
td.cell-name { font-size: 14px; font-weight: 500; color: var(--fg); padding-left: 40px; }
td.cell-mix, td.cell-loop { text-align: center; }
.mix-val { font-family: monospace; font-size: 14px; color: var(--gray-300); }
.mix-none { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500); opacity: 0.6; }
.loop-pill { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: var(--blue-900-30); color: var(--blue-300); border: 1px solid var(--blue-700-30); }
.loop-dash { font-size: 12px; color: var(--gray-600); opacity: 0.5; }
td.cell-notes { font-size: 14px; color: var(--gray-400); }
.notes-blank { font-style: italic; opacity: 0.2; }
.table-empty { padding: 32px 24px; text-align: center; font-style: italic; color: var(--gray-500); }

.grid-ref { display: grid; grid-template-columns: 1fr; gap: 24px; }
.ref-card { background: var(--gray-800-30); border: 1px solid var(--gray-700); border-radius: 12px; overflow: hidden; height: fit-content; }
.ref-card-head { padding: 12px 20px; background: var(--gray-800-80); border-bottom: 1px solid var(--gray-700); }
.ref-card-head h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; color: var(--white); }
.ref-card-head svg { width: 18px; height: 18px; }
.ref-card-head.bones svg { color: var(--gray-400); }
.ref-card-head.events svg { color: var(--yellow-400); }
.ref-card-head.skins svg { color: var(--blue-400); }
.ref-list > div { padding: 16px; border-top: 1px solid var(--gray-700-50); }
.ref-list > div:first-child { border-top: 0; }
.ref-name { font-family: monospace; font-size: 14px; margin-bottom: 4px; }
.ref-card.bones .ref-name { color: var(--gray-300); }
.ref-card.events .ref-name { color: var(--yellow-500); }
.ref-card.skins .ref-name { color: var(--blue-400); }
.ref-desc { font-size: 14px; color: var(--gray-400); }
.ref-desc .none { font-style: italic; opacity: 0.5; }
.ref-empty { padding: 16px; font-size: 14px; font-style: italic; color: var(--gray-500); }

.footer { padding-top: 48px; text-align: center; }
.footer p { margin: 0; font-size: 12px; color: var(--gray-600); }

@media (min-width: 768px) {
  body { padding: 48px; }
  .header { flex-direction: row; align-items: flex-end; justify-content: space-between; }
  .title { font-size: 36px; }
  .grid3 { grid-template-columns: repeat(3, 1fr); }
  .notes-card { grid-column: span 2; }
}
@media (min-width: 1024px) {
  .grid-ref { grid-template-columns: repeat(3, 1fr); }
}
</style>`;

// ---------------------------------------------------------------------------
// Section renderers.
// ---------------------------------------------------------------------------

function renderHeader(skeletonName: string, payload: DocExportPayload): string {
  return `<div class="header">
    <div>
      <h1 class="title">
        ${icon(PATH.doc, 32)}
        <span>Spine Documentation <span class="sep">/</span> <span class="name">${escapeHtml(skeletonName)}</span></span>
      </h1>
      ${renderChipStrip(payload)}
    </div>
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
  // Phase 29 D-01 — count per-region (matches the 4 user-named surfaces:
  // Global panel, Atlas Preview, Optimize dialog, exported folder). On
  // path-indirected projects this differs from peaks.length; on
  // SIMPLE_PROJECT-style fixtures with no indirection the values coincide
  // (3 = 3) so the doc-export golden snapshot stays byte-equal.
  const optimizedAssets = payload.summary.regions.length;
  const atlasPages = payload.atlasPreview.totalPages;
  const maxPagePx = computeMaxPagePx(payload.atlasPreview);
  return `<div class="chips">
    <span class="chip">${icon(PATH.clock, 14)}<span>Generated: ${escapeHtml(generated)}</span></span>
    <span class="chip img">${icon(PATH.image, 14)}<span>${imagesUtilized} Images Utilized</span></span>
    <span class="chip film">${icon(PATH.film, 14)}<span>${animationsConfigured} Animations Configured</span></span>
    <span class="chip zap">${icon(PATH.lightning, 14)}<span>${optimizedAssets} Optimized Assets</span></span>
    <span class="chip map">${icon(PATH.map, 14)}<span>${atlasPages} Atlas Pages (${maxPagePx}px)</span></span>
  </div>`;
}

function renderOptimizationConfigCard(payload: DocExportPayload): string {
  // Phase 30 closure plan 30-05 — CR-04 fix (Option C). Read the new
  // top-level safetyBufferPercent (range 0-25, integer) that ACTUALLY
  // drives buildExportPlan math, NOT the legacy documentation.safetyBufferPercent
  // (range 0-100, "metadata only" per v1.2 D-22 input copy). Defensive
  // integer-and-range coerce mirrors the IPC-seam pattern at
  // src/main/project-io.ts:700-716 — falls back to 0 for missing /
  // out-of-range / non-integer / non-numeric values.
  const safetyRaw = payload.safetyBufferPercent;
  const safetyBuffer =
    typeof safetyRaw === 'number'
    && Number.isInteger(safetyRaw)
    && safetyRaw >= 0
    && safetyRaw <= 25
      ? safetyRaw
      : 0;
  // Top-level field is integer-only per D-04, so always renders plain (no
  // fractional path). The escapeHtml + '%' suffix shape preserved from the
  // legacy implementation.
  const safetyDisplay = `${safetyBuffer}`;
  const savingsPct = payload.exportPlanSavingsPct;
  const savingsDisplay = savingsPct === null ? '—' : `${savingsPct.toFixed(1)}%`;
  return `<div class="card optim">
    <div>
      <div class="sec-mini shield">${icon(PATH.shield, 20)}<h3>Optimization Config</h3></div>
      <div class="big-value">${escapeHtml(safetyDisplay)}%</div>
      <p class="sub-label">Safety Buffer</p>
    </div>
    <div class="divider-top">
      <div class="sec-mini scaling">${icon(PATH.scaling, 20)}<h3>Space Savings</h3></div>
      <div class="big-value">${escapeHtml(savingsDisplay)}</div>
      <p class="sub-label">Estimated Reduction</p>
    </div>
  </div>`;
}

function renderGeneralNotesCard(notes: string): string {
  const trimmed = notes.trim();
  const body =
    trimmed.length > 0
      ? `<pre class="notes-body">${escapeHtml(notes)}</pre>`
      : `<p class="notes-empty">No general implementation notes provided.</p>`;
  return `<div class="card notes-card">
    <div class="sec-mini notes">${icon(PATH.speech, 20)}<h3>General Notes</h3></div>
    ${body}
  </div>`;
}

function renderTracksCard(tracks: AnimationTrackEntry[]): string {
  const head = `<div class="table-card-head"><h2>${icon(PATH.clock, 20)}Animation Tracks</h2></div>`;
  const thead =
    '<thead><tr><th class="col-name">ANIMATION NAME</th><th class="col-mix">MIX TIME</th><th class="col-loop">LOOP</th><th>NOTES</th></tr></thead>';

  if (tracks.length === 0) {
    return `<div class="table-card">
      ${head}
      <div class="table-wrap"><table>${thead}<tbody><tr><td class="table-empty" colspan="4">No tracks configured.</td></tr></tbody></table></div>
    </div>`;
  }

  // Group entries by trackIndex; render in ascending order (D-05). One
  // <tbody> per track so the inter-track hairline matches the reference.
  const indices = Array.from(new Set(tracks.map((t) => t.trackIndex))).sort(
    (a, b) => a - b,
  );
  let body = '';
  for (const idx of indices) {
    let rows = `<tr class="track-row"><td colspan="4"><span class="track-tag"><span class="track-dot"></span>TRACK ${idx}</span></td></tr>`;
    for (const entry of tracks.filter((t) => t.trackIndex === idx)) {
      const mixCell =
        entry.mixTime === 0
          ? '<span class="mix-none">No Mix Time</span>'
          : `<span class="mix-val">${escapeHtml(`${entry.mixTime}s`)}</span>`;
      const loopCell = entry.loop
        ? '<span class="loop-pill">Loop</span>'
        : '<span class="loop-dash">-</span>';
      const notesCell =
        entry.notes.length > 0
          ? escapeHtml(entry.notes)
          : '<span class="notes-blank"></span>';
      rows += `<tr class="anim-row">
        <td class="cell-name">${escapeHtml(entry.animationName)}</td>
        <td class="cell-mix">${mixCell}</td>
        <td class="cell-loop">${loopCell}</td>
        <td class="cell-notes">${notesCell}</td>
      </tr>`;
    }
    body += `<tbody class="track-group">${rows}</tbody>`;
  }
  return `<div class="table-card">
    ${head}
    <div class="table-wrap"><table>${thead}${body}</table></div>
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
  const head = `<div class="ref-card-head ${headerClass}"><h3>${glyph}${escapeHtml(title)}</h3></div>`;
  if (entries.length === 0 && emptyMessage !== null) {
    return `<div class="ref-card ${headerClass}">
      ${head}
      <p class="ref-empty">${escapeHtml(emptyMessage)}</p>
    </div>`;
  }
  const items = entries
    .map((e) => {
      const desc =
        e.description.length > 0
          ? escapeHtml(e.description)
          : '<span class="none">No description</span>';
      return `<div><div class="ref-name">${escapeHtml(e.name)}</div><div class="ref-desc">${desc}</div></div>`;
    })
    .join('');
  return `<div class="ref-card ${headerClass}">
    ${head}
    <div class="ref-list">${items}</div>
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

  // Reference grid: Control Bones | Events | Skins (Events only when the
  // skeleton declares events; Bones always renders, with an empty-state
  // when nothing is documented).
  let refCards = renderEntryListCard(
    'bones',
    icon(PATH.bone, 18),
    'Control Bones',
    documentedBones,
    'No control bones documented.',
  );
  if (showEventsCard) {
    refCards += renderEntryListCard('events', icon(PATH.lightning, 18), 'Events', events, null);
  }
  refCards += renderEntryListCard('skins', icon(PATH.layers, 18), 'Skins', skins, null);

  const body = `<div class="doc">
${renderHeader(skeletonName, payload)}
<div class="grid3">${renderOptimizationConfigCard(payload)}${renderGeneralNotesCard(payload.documentation.generalNotes)}</div>
${renderTracksCard(payload.documentation.animationTracks)}
<div class="grid-ref">${refCards}</div>
<div class="footer"><p>Generated by Spine Texture Manager</p></div>
</div>`;

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
