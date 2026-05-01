---
phase: 20
plan: 04
type: execute
wave: 4
depends_on: [20-03]
files_modified:
  - src/main/doc-export.ts
  - src/main/ipc.ts
  - src/preload/index.ts
  - src/shared/types.ts
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx
  - src/renderer/src/components/AppShell.tsx
  - tests/main/doc-export.spec.ts
  - tests/core/documentation-roundtrip.spec.ts
autonomous: true
requirements:
  - DOC-04
  - DOC-05
tags:
  - electron
  - ipc
  - main
  - html
  - export
  - testing
  - roundtrip

must_haves:
  truths:
    - "User clicks 'Export HTML…' in the Export pane and a save dialog opens with defaultPath = lastOutDir/skeletonBasename.html (or Documents folder fallback)"
    - "On save, src/main/doc-export.ts writes a self-contained .html file via atomic Pattern-B (writeFile .tmp then rename)"
    - "The exported HTML contains zero <script src=, zero <link href= rel=stylesheet, zero <img src=, zero remote url(http(s):// references — fully offline-viewable"
    - "All user-supplied strings (animationName, notes, descriptions, generalNotes, event/bone/skin names) are HTML-escaped via escapeHtml helper"
    - "The HTML renders the locked layout from D-18: hero row, 5-chip strip, Optimization Config + General Notes side-by-side, Animation Tracks full-width table with track-divider rows, Control Bones + Skins side-by-side, Events row only when summary.events.count > 0"
    - "IPC channel 'documentation:exportHtml' is registered in src/main/ipc.ts, bridged in src/preload/index.ts, and typed in the Api interface in src/shared/types.ts"
    - "renderDocumentationHtml is a pure function (no I/O); generatedAt is injected for deterministic golden-file testing"
    - "Round-trip test in tests/core/documentation-roundtrip.spec.ts proves a representative Documentation survives serialize → JSON.parse → validate → materialize bit-equal (DOC-05)"
    - "Golden HTML test in tests/main/doc-export.spec.ts verifies output is self-contained and matches a frozen snapshot for a fixed payload + generatedAt"
    - "An XSS-attempt input ('<script>alert(1)</script>' as a notes field) is HTML-escaped to '&lt;script&gt;alert(1)&lt;/script&gt;' in the output"
  artifacts:
    - path: src/main/doc-export.ts
      provides: "renderDocumentationHtml + handleExportDocumentationHtml IPC handler + DocExportPayload + DocExportResponse types"
      min_lines: 200
      contains:
        - "renderDocumentationHtml"
        - "handleExportDocumentationHtml"
        - "writeFile"
        - "rename"
        - "escapeHtml"
        - "documentation:exportHtml"
        - "<style>"
    - path: src/main/ipc.ts
      provides: "IPC channel registration"
      contains:
        - "documentation:exportHtml"
        - "handleExportDocumentationHtml"
    - path: src/preload/index.ts
      provides: "Preload bridge for exportDocumentationHtml"
      contains:
        - "exportDocumentationHtml"
        - "ipcRenderer.invoke('documentation:exportHtml'"
    - path: tests/main/doc-export.spec.ts
      provides: "Golden HTML snapshot + self-containment proof + XSS escape proof"
      contains:
        - "renderDocumentationHtml"
        - "toMatchSnapshot"
        - "&lt;script&gt;"
      min_lines: 60
    - path: tests/core/documentation-roundtrip.spec.ts
      provides: "DOC-05 round-trip identity test"
      contains:
        - "serializeProjectFile"
        - "validateProjectFile"
        - "materializeProjectFile"
        - "toEqual"
      min_lines: 40
  key_links:
    - from: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      to: window.api.exportDocumentationHtml
      via: "Export pane button onClick → window.api.exportDocumentationHtml(payload)"
      pattern: "exportDocumentationHtml"
    - from: src/main/ipc.ts
      to: src/main/doc-export.ts
      via: "ipcMain.handle('documentation:exportHtml', ... handleExportDocumentationHtml)"
      pattern: "handleExportDocumentationHtml"
    - from: src/preload/index.ts
      to: 'documentation:exportHtml'
      via: "ipcRenderer.invoke('documentation:exportHtml', payload)"
      pattern: "documentation:exportHtml"
---

<objective>
Ship the HTML export pipeline (DOC-04) and prove the round-trip identity contract (DOC-05). This plan creates `src/main/doc-export.ts` with the pure-TS HTML template + atomic-write IPC handler, registers the new IPC channel through the standard 3-tier (handler / preload / Api type), wires the renderer Export pane to invoke it, and lands two backstop tests: a golden-file HTML snapshot proving self-containment + XSS escape, and a representative-Documentation round-trip identity test.

Purpose: This is the last functional plan — after it lands, every requirement (DOC-01..DOC-05) is testably covered.

Output:
- `src/main/doc-export.ts` (NEW) — `renderDocumentationHtml`, `handleExportDocumentationHtml`, `writeHtmlAtomic`, `escapeHtml`, `DocExportPayload`, `DocExportResponse`
- `src/main/ipc.ts` extended — `'documentation:exportHtml'` registration
- `src/preload/index.ts` extended — preload bridge `exportDocumentationHtml`
- `src/shared/types.ts` extended — `Api.exportDocumentationHtml` + re-export of payload/response types
- `src/renderer/src/modals/DocumentationBuilderDialog.tsx` extended — `ExportPanePlaceholder` replaced with full `ExportPane`
- `src/renderer/src/components/AppShell.tsx` extended — pass `lastOutDir`, `atlasPreview`, `savingsPct` props through to the modal
- `tests/main/doc-export.spec.ts` (NEW) — golden snapshot + self-containment + XSS escape
- `tests/core/documentation-roundtrip.spec.ts` (NEW) — DOC-05 round-trip identity
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/20-documentation-builder-feature/20-CONTEXT.md
@.planning/phases/20-documentation-builder-feature/20-RESEARCH.md
@.planning/phases/20-documentation-builder-feature/20-PATTERNS.md
@.planning/phases/20-documentation-builder-feature/20-UI-SPEC.md
@.planning/phases/20-documentation-builder-feature/20-03-animation-tracks-pane-dnd-SUMMARY.md
@./CLAUDE.md
@src/main/project-io.ts
@src/main/ipc.ts
@src/preload/index.ts
@src/shared/types.ts
@src/renderer/src/modals/DocumentationBuilderDialog.tsx
@src/renderer/src/components/AppShell.tsx
@src/core/documentation.ts

<interfaces>
<!-- Verbatim references the executor needs. -->

Atomic write Pattern-B (verbatim from src/main/project-io.ts:246-271):

```typescript
const tmpPath = finalPath + '.tmp';
try {
  await writeFile(tmpPath, content, 'utf8');
} catch (err) {
  return { ok: false, error: { kind: 'Unknown', message: `writeFile tmp failed: ${err instanceof Error ? err.message : String(err)}` } };
}
try {
  await rename(tmpPath, finalPath);
} catch (err) {
  return { ok: false, error: { kind: 'Unknown', message: `rename tmp→final failed: ${err instanceof Error ? err.message : String(err)}` } };
}
```

dialog.showSaveDialog pattern (verbatim from src/main/project-io.ts:166-180):

```typescript
const win = BrowserWindow.getFocusedWindow();
const options: Electron.SaveDialogOptions = {
  title: 'Export Documentation as HTML',
  defaultPath: path.join(defaultDir, `${skeletonBasename}.html`),
  filters: [{ name: 'HTML Document', extensions: ['html'] }],
};
const result = win
  ? await dialog.showSaveDialog(win, options)
  : await dialog.showSaveDialog(options);

if (result.canceled || !result.filePath) {
  return { ok: false, error: { kind: 'Unknown', message: 'Export cancelled' } };
}
```

IPC channel registration (mirror of src/main/ipc.ts:881):

```typescript
ipcMain.handle('documentation:exportHtml', async (_evt, payload) =>
  handleExportDocumentationHtml(payload as DocExportPayload),
);
```

Preload bridge (mirror of src/preload/index.ts:78-79 pickOutputDirectory):

```typescript
exportDocumentationHtml: (payload: DocExportPayload): Promise<DocExportResponse> =>
  ipcRenderer.invoke('documentation:exportHtml', payload),
```

HTML escaping helper:

```typescript
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

DocExportPayload shape (defined in src/main/doc-export.ts; re-exported through shared/types.ts):

```typescript
export interface DocExportPayload {
  documentation: Documentation;
  summary: SkeletonSummary;
  atlasPreview: AtlasPreviewProjection;     // existing type from src/shared/types.ts (Phase 7)
  exportPlanSavingsPct: number | null;       // pre-computed by renderer; avoids re-importing buildExportPlan in main
  skeletonBasename: string;                   // from path.basename(skeletonPath, '.json')
  lastOutDir: string | null;                  // from AppSessionState.lastOutDir
  generatedAt: number;                        // ms epoch — Date.now() in production; fixed in tests
}

export type DocExportResponse =
  | { ok: true; path: string }
  | { ok: false; error: { kind: 'Unknown'; message: string } };
```

Inline `<style>` HTML template baseline (from RESEARCH.md Pattern 8 lines 808-895):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Spine Documentation — {SKELETON_NAME}</title>
<style>
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
body {
  margin: 0;
  padding: 32px;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
.hero { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.hero-title { font-size: 24px; font-weight: 600; }
.hero-name { color: var(--terracotta); }
.chip-strip { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--muted);
}
.chip svg { color: var(--blue); }
.row { display: flex; gap: 16px; margin-bottom: 16px; }
.card {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
}
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 16px; font-weight: 600; }
.card-header svg { color: var(--green); }
.card-header.bones svg, .card-header.events svg { color: var(--terracotta); }
.card-header.skins svg { color: var(--blue); }
.card-header.tracks svg { color: var(--terracotta); }
.card-header.notes svg { color: var(--blue); }
.loop-pill {
  display: inline-flex; align-items: center;
  padding: 2px 6px;
  font-size: 10px;
  font-family: monospace;
  border-radius: 4px;
  background-color: rgba(95, 168, 212, 0.15);
  color: var(--blue);
}
.track-divider {
  display: flex; align-items: center; gap: 8px;
  font-family: monospace; font-size: 12px;
  color: var(--terracotta);
  margin-top: 12px; margin-bottom: 4px;
}
.track-divider::before {
  content: ''; display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%; background: var(--terracotta);
}
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 11px; color: var(--muted); padding: 8px 12px; border-bottom: 1px solid var(--border); }
td { padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: top; }
.entry-name { font-family: monospace; color: var(--terracotta); }
.entry-name.skin { color: var(--blue); }
.entry-desc { color: var(--muted); margin-top: 2px; font-size: 12px; }
.notes-pre { white-space: pre-wrap; font-family: inherit; color: var(--muted); margin: 0; }
.config-value { font-family: monospace; font-size: 28px; color: var(--fg); }
.config-label { font-size: 11px; color: var(--muted); margin-top: 4px; }
.entry-list { list-style: none; padding: 0; margin: 0; }
.entry-list li { margin-bottom: 12px; }
</style>
</head>
<body>
{BODY}
</body>
</html>
```

Inline SVG glyphs (per RESEARCH.md Pattern 9 — viewBox 20x20, stroke=currentColor):

| Section | Glyph path |
|---------|-----------|
| Tracks header / Generated chip | `<circle cx="10" cy="10" r="7"/><path d="M10 6 v4 l3 2"/>` |
| Control bones header | `<path d="M5 8 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 v4 a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 z"/>` |
| Skins header | `<path d="M2 6 l8 -3 8 3 -8 3 z"/><path d="M2 10 l8 3 8 -3"/><path d="M2 14 l8 3 8 -3"/>` |
| Optimization Config header | `<path d="M10 3 L4 5 v5 c0 4 3 6 6 7 3 -1 6 -3 6 -7 V5 z"/>` |
| General Notes header | `<path d="M3 4 h14 v9 h-7 l-4 3 v-3 H3 z"/>` |
| Events header | `<path d="M5 13 v-3 a5 5 0 0 1 10 0 v3 l1 2 H4 z"/>` |
| Hero doc-icon | `<path d="M5 2 h7 l3 3 v13 H5 z"/><path d="M12 2 v3 h3"/>` |
| Images Utilized chip | `<rect x="2" y="3" width="16" height="14" rx="1"/><circle cx="7" cy="8" r="1.5"/><path d="M2 14 l4 -4 4 3 4 -5 4 4 v5"/>` |
| Animations Configured chip | `<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M9 7 l4 3 -4 3 z"/>` |
| Optimized Assets chip | `<path d="M11 2 L4 11 h5 l-2 7 7 -9 h-5 z"/>` |
| Atlas Pages chip | `<path d="M2 5 l5 -2 6 2 5 -2 v12 l-5 2 -6 -2 -5 2 z"/><path d="M7 3 v14 M13 5 v14"/>` |

All wrapped in: `<svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">{path}</svg>`
</interfaces>

<copy_contract>
<!-- All copy locked by 20-UI-SPEC.md Export pane + HTML export. -->

Renderer Export pane:
- Heading: "Export to HTML"
- Body: "Generates a self-contained .html file with all documentation, optimization config, and atlas summary."
- Button: "Export HTML…"
- Success inline: "Exported to {PATH}"
- Error inline: "Could not export documentation. {REASON}" (REASON falls back to "An unknown error occurred. Try a different folder." when error.message is empty)

HTML export — chip strip:
- Chip 1: "Generated: {DD/MM/YYYY}"
- Chip 2: "{N} Images Utilized" (N = summary.attachments.count)
- Chip 3: "{N} Animations Configured" (N = documentation.animationTracks.length per Specifics §"Locking interpretation"; NOT summary.animations.count)
- Chip 4: "{N} Optimized Assets" (N = summary.peaks.length)
- Chip 5: "{N} Atlas Pages ({MAX_PAGE_PX}px)" (N = atlasPreview.totalPages; MAX_PAGE_PX = max page width or height across pages)

HTML export — card headers:
- Hero row: "Spine Documentation / {SKELETON_NAME}" (uppercased)
- Optimization Config: header "Optimization Config"; tile 1 value "{N}%" label "Safety Buffer"; tile 2 value "{X.X}%" label "Space Savings" + sub-label "Estimated Reduction"
- General Notes: header "General Notes"; body inside <pre class="notes-pre">{escaped generalNotes}</pre>
- Animation Tracks: header "Animation Tracks"; table columns "ANIMATION NAME / MIX TIME / LOOP / NOTES"; group divider "● Track {N}"; LOOP cell renders `<span class="loop-pill">LOOP</span>` when loop=true, else `—`
- Control Bones: header "Control Bones"; per-entry: monospace name + muted body; empty: "No control bones documented."
- Skins: header "Skins"; per-entry: monospace name + muted body
- Events: header "Events" — ONLY rendered when summary.events.count > 0 (per D-18 sub-step 6)
</copy_contract>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/main/doc-export.ts (renderDocumentationHtml + handleExportDocumentationHtml + tests/main/doc-export.spec.ts)</name>
  <files>src/main/doc-export.ts, tests/main/doc-export.spec.ts</files>
  <read_first>
    - src/main/project-io.ts (lines 1-50 imports; 147-208 handleProjectSaveAs full body; 218-271 atomic write + serialize)
    - src/shared/types.ts (lines 466-506 SkeletonSummary; lines 436-460 AtlasPage + AtlasPreviewProjection — VERIFIED shape: pages: AtlasPage[]; lines 535-571 SerializableError; lines 687-690 SaveResponse pattern)
    - src/core/documentation.ts (verify Documentation type)
    - src/core/atlas-preview.ts (verify totalPages + page dim accessors used by chip 5)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 765-1195 (Pattern 8 + Pattern 5 + Pattern 6 + IPC handler skeleton)
    - .planning/phases/20-documentation-builder-feature/20-UI-SPEC.md lines 196-217 (HTML export copy)
    - .planning/phases/20-documentation-builder-feature/20-CONTEXT.md (D-17..D-21 — HTML template + export module location)
  </read_first>
  <behavior>
    - Test 1: renderDocumentationHtml(payload) returns a string starting with '<!DOCTYPE html>' and ending with '</html>'
    - Test 2: output contains zero `<img ` tags, zero `<script src=`, zero `<link rel="stylesheet"`, zero `url(http://` or `url(https://` references (self-contained per D-17)
    - Test 3: a documentation field with notes='<script>alert(1)</script>' renders as '&lt;script&gt;alert(1)&lt;/script&gt;' in the output (XSS escape proof)
    - Test 4: with summary.events.count === 0, the output does NOT contain the Events card header text 'Events' as a card-header (the card is omitted per D-18 sub-step 6) — verify by ensuring `<h2 class="card-header events">` or equivalent is absent
    - Test 5: with summary.events.count > 0, the Events card IS rendered with the locked header copy
    - Test 6: Hero row contains 'Spine Documentation /' and the uppercased skeleton basename
    - Test 7: Chip strip includes all 5 chips with the locked formats (Generated: DD/MM/YYYY, N Images Utilized, N Animations Configured, N Optimized Assets, N Atlas Pages (MAX_PAGE_PXpx))
    - Test 8: Animation Tracks table includes 'ANIMATION NAME', 'MIX TIME', 'LOOP', 'NOTES' column headers and `● Track N` divider rows for each unique trackIndex
    - Test 9: A LOOP cell with loop=true renders the loop-pill span; loop=false renders '—'
    - Test 10: Snapshot test — full HTML output for a fixed payload + generatedAt = new Date('2026-04-14T12:00:00Z').getTime() matches a frozen vitest snapshot
  </behavior>
  <action>
**Step A — Create `src/main/doc-export.ts`:**

```typescript
// src/main/doc-export.ts
//
// Phase 20 D-21 — Documentation HTML export. Pure-TS template-literal-driven
// HTML rendering + atomic-write IPC handler. NO React in main; NO Tailwind
// in the output (Tailwind v4 is renderer-only build-time JIT).
//
// renderDocumentationHtml is a pure function (no I/O). The IPC handler
// orchestrates dialog.showSaveDialog → renderDocumentationHtml → atomic write.

import { writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app, dialog, BrowserWindow } from 'electron';
import type { Documentation, AnimationTrackEntry } from '../core/documentation.js';
import type { SkeletonSummary, AtlasPreviewProjection } from '../shared/types.js';

export interface DocExportPayload {
  documentation: Documentation;
  summary: SkeletonSummary;
  atlasPreview: AtlasPreviewProjection;
  exportPlanSavingsPct: number | null;
  skeletonBasename: string;
  lastOutDir: string | null;
  generatedAt: number;
}

export type DocExportResponse =
  | { ok: true; path: string }
  | { ok: false; error: { kind: 'Unknown'; message: string } };

export async function handleExportDocumentationHtml(payload: DocExportPayload): Promise<DocExportResponse> {
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
  // Defensive path validation: ensure result.filePath is absolute (Electron's
  // dialog returns absolute paths, but assert before writing).
  if (!path.isAbsolute(result.filePath)) {
    return { ok: false, error: { kind: 'Unknown', message: 'Export path must be absolute' } };
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateDDMMYYYY(ms: number): string {
  const d = new Date(ms);
  // Use UTC-based getters with toISOString to keep deterministic for tests.
  // For production parity with user's local time, we use the local-time getters here.
  // Test passes a fixed UTC midnight-ish timestamp; the resulting DD/MM/YYYY
  // is determined by the local TZ. To make the snapshot stable, we use
  // toISOString() and parse the YYYY-MM-DD prefix.
  const iso = new Date(ms).toISOString(); // 2026-04-14T12:00:00.000Z
  const datePart = iso.slice(0, 10); // 2026-04-14
  const [yyyy, mm, dd] = datePart.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

const SVG_OPEN = '<svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">';

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

function renderHero(skeletonName: string): string {
  return `<div class="hero">
    ${GLYPH.doc}
    <div class="hero-title">Spine Documentation / <span class="hero-name">${escapeHtml(skeletonName)}</span></div>
  </div>`;
}

function renderChipStrip(payload: DocExportPayload): string {
  const generated = formatDateDDMMYYYY(payload.generatedAt);
  const imagesUtilized = payload.summary.attachments.count;
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

function computeMaxPagePx(ap: AtlasPreviewProjection): number {
  // Verified against src/shared/types.ts:447-460 (AtlasPreviewProjection) and
  // src/shared/types.ts:436-445 (AtlasPage) and src/core/atlas-preview.ts:111-136
  // (where pages are constructed). Confirmed shape:
  //   AtlasPreviewProjection.pages: AtlasPage[]
  //   AtlasPage = { pageIndex: number; width: number; height: number;
  //                 regions: PackedRegion[]; usedPixels: number;
  //                 totalPixels: number; efficiency: number }
  // We only read width + height. Fall back to 0 when no pages exist (degenerate
  // empty-input case, which atlas-preview already guards at line 138-149 — at
  // least one page is always emitted, but we double-guard).
  if (!ap.pages || ap.pages.length === 0) return 0;
  return Math.max(...ap.pages.map((p) => Math.max(p.width, p.height)));
}

function renderOptimizationConfigCard(payload: DocExportPayload): string {
  const safetyRaw = payload.documentation.safetyBufferPercent;
  const safetyDisplay = Number.isInteger(safetyRaw) ? `${safetyRaw}` : `${safetyRaw.toFixed(1)}`;
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
  // Group entries by trackIndex; render in ascending order.
  const indices = Array.from(new Set(tracks.map((t) => t.trackIndex))).sort((a, b) => a - b);
  let body = `<table><thead><tr><th>ANIMATION NAME</th><th>MIX TIME</th><th>LOOP</th><th>NOTES</th></tr></thead><tbody>`;
  for (const idx of indices) {
    body += `<tr><td colspan="4"><div class="track-divider">Track ${idx}</div></td></tr>`;
    for (const entry of tracks.filter((t) => t.trackIndex === idx)) {
      const loopCell = entry.loop ? `<span class="loop-pill">LOOP</span>` : '—';
      body += `<tr>
        <td><span class="entry-name">${escapeHtml(entry.animationName)}</span></td>
        <td>${escapeHtml(`${entry.mixTime}s`)}</td>
        <td>${loopCell}</td>
        <td class="entry-desc">${escapeHtml(entry.notes)}</td>
      </tr>`;
    }
  }
  body += `</tbody></table>`;
  return `<div class="card">
    <div class="card-header tracks"><span>${GLYPH.clock}</span><span>Animation Tracks</span></div>
    ${body}
  </div>`;
}

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
  const items = entries.map((e) =>
    `<li><div class="entry-name${skinExtra}">${escapeHtml(e.name)}</div><div class="entry-desc">${escapeHtml(e.description)}</div></li>`,
  ).join('');
  return `<div class="card">
    <div class="card-header ${headerClass}"><span>${glyph}</span><span>${escapeHtml(title)}</span></div>
    <ul class="entry-list">${items}</ul>
  </div>`;
}

export function renderDocumentationHtml(payload: DocExportPayload): string {
  const skeletonName = payload.skeletonBasename.toUpperCase();
  // Documented bones = those with description.length > 0 already (validator
  // contract from D-10; renderer ensures only documented bones are saved).
  const documentedBones = payload.documentation.controlBones;
  const skins = payload.documentation.skins;
  const events = payload.documentation.events;
  const showEventsCard = payload.summary.events.count > 0; // D-18 sub-step 6

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
```

Note for executor: the `AtlasPreviewProjection.pages` accessor may differ in actual code — read `src/core/atlas-preview.ts:124-155` and `src/shared/types.ts:380-400` to confirm the correct property name (`pages`, `pageDims`, etc.) and adjust `computeMaxPagePx` accordingly. If the existing module already exposes a `maxPagePx` value, use that directly.

**Step B — Create `tests/main/doc-export.spec.ts`:**

```typescript
import { describe, it, expect } from 'vitest';
import { renderDocumentationHtml, type DocExportPayload } from '../../src/main/doc-export.js';
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../src/core/documentation.js';
import type { SkeletonSummary, AtlasPreviewProjection } from '../../src/shared/types.js';

const FIXED_GENERATED_AT = new Date('2026-04-14T12:00:00Z').getTime();

function makeMinimalPayload(overrides: Partial<DocExportPayload> = {}): DocExportPayload {
  const summary: SkeletonSummary = {
    skeletonPath: '/tmp/SIMPLE.json',
    atlasPath: '/tmp/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 174, byType: {} as never },
    skins: { count: 0, names: [] },
    animations: { count: 23, names: [] },
    events: { count: 0, names: [] },
    peaks: new Array(170).fill(null) as never,  // 170 peaks
  } as SkeletonSummary;

  // Build a minimal AtlasPreviewProjection. computeMaxPagePx only reads
  // pages[i].width + pages[i].height; the `as unknown as AtlasPreviewProjection`
  // cast is acceptable here because we are NOT exercising regions/usedPixels/
  // totalPixels/efficiency in the export path. (Full shape verified at
  // src/shared/types.ts:436-460 — AtlasPage requires pageIndex/regions/
  // usedPixels/totalPixels/efficiency, but renderDocumentationHtml only
  // consumes width + height, so the cast is safe for this test surface.)
  const atlasPreview: AtlasPreviewProjection = {
    mode: 'optimized',
    maxPageDim: 2048,
    totalPages: 4,
    oversize: [],
    pages: [
      { pageIndex: 0, width: 2048, height: 2048, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
      { pageIndex: 1, width: 2048, height: 2048, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
      { pageIndex: 2, width: 2048, height: 1024, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
      { pageIndex: 3, width: 2048, height: 1024, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0 },
    ],
  };

  return {
    documentation: DEFAULT_DOCUMENTATION,
    summary,
    atlasPreview,
    exportPlanSavingsPct: 91.7,
    skeletonBasename: 'CHJWC_SYMBOLS',
    lastOutDir: null,
    generatedAt: FIXED_GENERATED_AT,
    ...overrides,
  };
}

describe('renderDocumentationHtml (DOC-04)', () => {
  it('produces a valid HTML document', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.endsWith('</html>')).toBe(true);
  });

  it('output is self-contained — no external assets', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).not.toMatch(/<img\s/);
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/);
    expect(html).not.toMatch(/<script\s+src=/);
    expect(html).not.toMatch(/url\(['"]?https?:/);
    expect(html).not.toMatch(/@font-face/);
    expect(html).not.toMatch(/@import/);
  });

  it('HTML-escapes user-supplied notes (XSS attempt)', () => {
    const xssDoc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      generalNotes: '<script>alert(1)</script>',
      animationTracks: [
        { id: 'a', trackIndex: 0, animationName: '<img onerror="x">', mixTime: 0.25, loop: false, notes: '"&\'<>' },
      ],
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ documentation: xssDoc }));
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img onerror=&quot;x&quot;&gt;');
  });

  it('omits the Events card when summary.events.count === 0', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).not.toMatch(/card-header events/);
  });

  it('renders the Events card when summary.events.count > 0', () => {
    const summary = {
      ...makeMinimalPayload().summary,
      events: { count: 1, names: ['shoot'] },
    } as SkeletonSummary;
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ summary, documentation: doc }));
    expect(html).toMatch(/card-header events/);
    expect(html).toContain('shoot');
    expect(html).toContain('Fires when ammo expended');
  });

  it('renders the hero with uppercased skeleton name', () => {
    const html = renderDocumentationHtml(makeMinimalPayload({ skeletonBasename: 'hello_world' }));
    expect(html).toContain('Spine Documentation /');
    expect(html).toContain('HELLO_WORLD');
  });

  it('chip strip renders all 5 chips with locked formats', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).toMatch(/Generated: 14\/04\/2026/);
    expect(html).toContain('174 Images Utilized');
    expect(html).toContain('0 Animations Configured'); // DEFAULT_DOCUMENTATION = 0 tracks
    expect(html).toContain('170 Optimized Assets');
    expect(html).toContain('4 Atlas Pages (2048px)');
  });

  it('renders the Animation Tracks table with track-divider rows + LOOP pill', () => {
    const doc: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'a', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: true, notes: 'Primary' },
        { id: 'b', trackIndex: 1, animationName: 'shoot', mixTime: 0.5, loop: false, notes: '' },
      ],
    };
    const html = renderDocumentationHtml(makeMinimalPayload({ documentation: doc }));
    expect(html).toContain('ANIMATION NAME');
    expect(html).toContain('MIX TIME');
    expect(html).toContain('LOOP');
    expect(html).toContain('NOTES');
    expect(html).toContain('Track 0');
    expect(html).toContain('Track 1');
    expect(html).toContain('walk');
    expect(html).toContain('0.25s');
    expect(html).toContain('loop-pill');
    expect(html).toMatch(/<td[^>]*>—<\/td>/);
  });

  it('snapshot — full HTML for fixed payload + generatedAt', () => {
    const html = renderDocumentationHtml(makeMinimalPayload());
    expect(html).toMatchSnapshot();
  });
});
```

AtlasPreviewProjection shape is locked above (verified against src/shared/types.ts:436-460 on 2026-05-01). If `SkeletonSummary` requires more fields than the test stubs include, fill in minimal valid stubs (cast via `as SkeletonSummary` is acceptable for tests).
  </action>
  <verify>
    <automated>npm run test -- tests/main/doc-export.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `src/main/doc-export.ts` exists
    - `grep -c "export function renderDocumentationHtml" src/main/doc-export.ts` returns 1
    - `grep -c "export async function handleExportDocumentationHtml" src/main/doc-export.ts` returns 1
    - `grep -c "writeFile" src/main/doc-export.ts` returns at least 1
    - `grep -c "rename" src/main/doc-export.ts` returns at least 1
    - `grep -c "function escapeHtml" src/main/doc-export.ts` returns 1
    - `grep -c "BrowserWindow.getFocusedWindow" src/main/doc-export.ts` returns 1
    - `grep -c "Export Documentation as HTML" src/main/doc-export.ts` returns 1
    - File `tests/main/doc-export.spec.ts` exists with at least 8 `it(` blocks
    - `npm run test -- tests/main/doc-export.spec.ts` exits 0 (all tests + snapshot pass)
    - Snapshot file `tests/main/__snapshots__/doc-export.spec.ts.snap` is created on first run
    - Self-containment verified: snapshot does NOT contain `<img `, `<script src=`, `<link rel="stylesheet"`, or `url(http`
    - XSS escape verified: `<script>alert(1)</script>` becomes `&lt;script&gt;alert(1)&lt;/script&gt;`
  </acceptance_criteria>
  <done>
    `src/main/doc-export.ts` exports renderDocumentationHtml (pure-fn) + handleExportDocumentationHtml (IPC handler) + DocExportPayload + DocExportResponse types. HTML escapes all user-supplied strings, embeds the locked CSS palette, omits Events card when no events exist, renders the chip strip with the locked formats. Atomic write Pattern-B used. Tests cover self-containment, XSS escape, conditional Events card, hero, chip strip, tracks table, and a snapshot.
  </done>
</task>

<task type="auto" tdd="false">
  <!-- Single-task scope justification (Warning 6): the IPC 3-tier (handler /
       preload / Api type), the renderer Export pane that calls window.api.exportDocumentationHtml,
       and the round-trip integration test are tightly coupled — landing them
       in one task keeps the contract under one verify command. Splitting into
       2a (IPC + types) and 2b (renderer wiring + round-trip) would force the
       executor to leave the IPC channel registered without a renderer caller
       between commits (typecheck on `window.api.exportDocumentationHtml`
       fails until the consumer lands), creating a dead-end intermediate state. -->
  <name>Task 2: Wire IPC channel + Export pane + AppShell prop threading + round-trip integration test</name>
  <files>src/main/ipc.ts, src/preload/index.ts, src/shared/types.ts, src/renderer/src/modals/DocumentationBuilderDialog.tsx, src/renderer/src/components/AppShell.tsx, tests/core/documentation-roundtrip.spec.ts</files>
  <read_first>
    - src/main/ipc.ts (lines 657-905 — registration patterns; line 881 project:save for the closest analog)
    - src/preload/index.ts (lines 1-100 — full file probably; line 78-79 pickOutputDirectory analog)
    - src/shared/types.ts (lines 800-830 Api interface; lines 380-400 AtlasPreviewProjection)
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx (read the post-Plan-03 file — focus on the activePane === 'export' render branch and the props interface)
    - src/renderer/src/components/AppShell.tsx (find the modal mount block; find the existing buildExportPlan call sites at lines 470 and 562; find atlasPreview state if any)
    - src/main/doc-export.ts (just-created — confirm DocExportPayload + DocExportResponse export names)
    - tests/core/project-file.spec.ts (lines 92-125 — round-trip test idiom)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 1196-1256 (IPC + Api + click-time payload assembly + structuredClone safety)
    - .planning/phases/20-documentation-builder-feature/20-PATTERNS.md lines 753-799 (IPC registration triple)
  </read_first>
  <action>
**Step A — Register IPC handler in `src/main/ipc.ts`:**

Add file-top import (alongside existing main module imports):

```typescript
import { handleExportDocumentationHtml, type DocExportPayload } from './doc-export.js';
```

Inside the `registerIpcHandlers()` (or equivalent — the function that calls `ipcMain.handle` repeatedly around line 881 for `project:save` etc.), ADD after the `project:*` handlers:

```typescript
// Phase 20 D-21 — Documentation HTML export channel.
ipcMain.handle('documentation:exportHtml', async (_evt, payload) =>
  handleExportDocumentationHtml(payload as DocExportPayload),
);
```

**Step B — Add preload bridge in `src/preload/index.ts`:**

Add file-top import (with the other type-only imports):

```typescript
import type { DocExportPayload, DocExportResponse } from '../main/doc-export.js';
```

Inside the `api` object literal (the same object that has `pickOutputDirectory` at line 78-79), ADD:

```typescript
// Phase 20 D-21 — Documentation HTML export.
exportDocumentationHtml: (payload: DocExportPayload): Promise<DocExportResponse> =>
  ipcRenderer.invoke('documentation:exportHtml', payload),
```

**Step C — Extend the `Api` interface in `src/shared/types.ts`:**

Add at the top of the file (after the existing `Documentation` re-export):

```typescript
export type { DocExportPayload, DocExportResponse } from '../main/doc-export.js';
```

In the `Api` interface (around lines 807-810, after the `project:*` methods), ADD:

```typescript
// Phase 20 D-21 — HTML export.
exportDocumentationHtml: (payload: DocExportPayload) => Promise<DocExportResponse>;
```

**Step D — Replace `ExportPanePlaceholder` with full `ExportPane` in `src/renderer/src/modals/DocumentationBuilderDialog.tsx`:**

Update the parent dialog render branch:

```tsx
{activePane === 'export' && (
  <ExportPane
    draft={draft}
    summary={props.summary}
    atlasPreview={props.atlasPreview}
    exportPlanSavingsPct={props.exportPlanSavingsPct}
    lastOutDir={props.lastOutDir}
  />
)}
```

EXTEND the props interface:

```tsx
export interface DocumentationBuilderDialogProps {
  open: boolean;
  documentation: Documentation;
  summary: SkeletonSummary;
  atlasPreview: AtlasPreviewProjection;
  exportPlanSavingsPct: number | null;
  lastOutDir: string | null;
  onChange: (next: Documentation) => void;
  onClose: () => void;
}
```

(Add file-top import: `import type { AtlasPreviewProjection } from '../../../shared/types.js';`.)

Implement `ExportPane`:

```tsx
interface ExportPaneProps {
  draft: Documentation;
  summary: SkeletonSummary;
  atlasPreview: AtlasPreviewProjection;
  exportPlanSavingsPct: number | null;
  lastOutDir: string | null;
}

function ExportPane({ draft, summary, atlasPreview, exportPlanSavingsPct, lastOutDir }: ExportPaneProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; path: string } | { ok: false; reason: string } | null>(null);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      // Derive skeleton basename from summary.skeletonPath. Strip directory
      // and `.json` extension.
      const fileName = summary.skeletonPath.split(/[\\/]/).pop() ?? 'Untitled';
      const skeletonBasename = fileName.replace(/\.json$/i, '');
      const payload = {
        documentation: draft,
        summary,
        atlasPreview,
        exportPlanSavingsPct,
        skeletonBasename,
        lastOutDir,
        generatedAt: Date.now(),
      };
      const resp = await window.api.exportDocumentationHtml(payload);
      if (resp.ok) {
        setResult({ ok: true, path: resp.path });
      } else {
        const reason = resp.error.message.length > 0
          ? resp.error.message
          : 'An unknown error occurred. Try a different folder.';
        setResult({ ok: false, reason });
      }
    } catch (err) {
      setResult({ ok: false, reason: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-base font-semibold text-fg">Export to HTML</h3>
      <p className="text-sm text-fg-muted">
        Generates a self-contained .html file with all documentation, optimization config, and atlas summary.
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="self-start bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Export HTML…
      </button>
      {result && result.ok && (
        <p className="text-sm text-success">Exported to {result.path}</p>
      )}
      {result && !result.ok && (
        <p className="text-sm text-danger">Could not export documentation. {result.reason}</p>
      )}
    </div>
  );
}
```

(If the existing renderer type-color tokens are `text-success` / `text-danger` per UI-SPEC the classes are correct; otherwise use the project's Tailwind token names — verify by `grep "text-success\\|text-danger" src/renderer/src/index.css`.)

Remove the `ExportPanePlaceholder` function after the new `ExportPane` is integrated.

**Step E — Thread props through AppShell.tsx:**

The modal now needs `atlasPreview`, `exportPlanSavingsPct`, and `lastOutDir`. Locate the existing `<DocumentationBuilderDialog ... />` mount (added by Plan 02 Task 2 Step F, mounted alongside the existing `<AtlasPreviewModal>` block at AppShell.tsx:1387-1396) and extend the props:

```tsx
<DocumentationBuilderDialog
  open={documentationBuilderOpen}
  documentation={documentation}
  summary={effectiveSummary}
  atlasPreview={atlasPreviewState}
  exportPlanSavingsPct={savingsPctMemo}
  lastOutDir={null}
  onChange={setDocumentation}
  onClose={() => setDocumentationBuilderOpen(false)}
/>
```

Concrete bindings (verified against AppShell.tsx at HEAD on 2026-05-01):

- **`summary={effectiveSummary}`** — `effectiveSummary` is the existing AppShell variable already passed to `<AtlasPreviewModal summary={effectiveSummary} ... />` at AppShell.tsx:1390. Reuse the SAME variable so the Documentation modal sees the same skeleton snapshot the Atlas Preview modal does.

- **`lastOutDir={null}`** — AppShell does NOT currently hoist `lastOutDir` into renderer state. Per AppShell.tsx:589-591, the `buildSessionState` callback hardcodes `lastOutDir: null` with the comment *"Phase 9 polish — currently null; D-145 schema field present but not yet hoisted into AppShell state. Documented deferral per D-147."* Phase 20 inherits this stance: pass literal `null` to the modal. The HTML export's `defaultPath` falls back to `app.getPath('documents')` per `handleExportDocumentationHtml` Step A in this plan. (When a future phase hoists `lastOutDir`, the swap is one prop edit at this site.)

- **`atlasPreviewState`** — there is no existing `AtlasPreviewProjection` state in AppShell. The Atlas Preview modal builds its own projection internally via `buildAtlasPreview(props.summary, props.overrides, { mode, maxPageDim })` at AtlasPreviewModal.tsx:105 (imported from `../lib/atlas-preview-view.js` at AtlasPreviewModal.tsx:64). Phase 20 needs an always-current projection for the Export pane chip strip. Add a memoized projection in AppShell using the SAME helper:

  Add file-top import (alongside the existing `import { buildExportPlan } from '../lib/export-view.js';` at AppShell.tsx:63):

  ```tsx
  import { buildAtlasPreview } from '../lib/atlas-preview-view.js';
  ```

  Add this `useMemo` adjacent to `buildSessionState` (insert immediately after the closing `);` at AppShell.tsx:597, before the dirty-derivation comment block at line 599):

  ```tsx
  // Phase 20 — always-current AtlasPreviewProjection for the Documentation
  // Builder's Export pane chip strip ("N Atlas Pages (MAX_PAGE_PXpx)"). Mirrors
  // AtlasPreviewModal.tsx:105 — same buildAtlasPreview call, fixed mode +
  // maxPageDim because the chip is a single-line snapshot, not a stepper.
  // Mode 'optimized' matches the locked HTML-export semantics (the chip
  // counts pages of the OPTIMIZED atlas, mirroring the OptimizeDialog savings).
  const atlasPreviewState = useMemo(
    () => buildAtlasPreview(effectiveSummary, overrides, { mode: 'optimized', maxPageDim: 2048 }),
    [effectiveSummary, overrides],
  );
  ```

- **`savingsPctMemo`** — D-18 sub-step 3 LOCKS the formula as `(1 - sumOutPixels / sumSourcePixels) * 100`, byte-identical to `OptimizeDialog.tsx:280-291`. Reproduce it as a memo in AppShell adjacent to the `atlasPreviewState` memo. AppShell already imports `buildExportPlan` at AppShell.tsx:63 and calls it at AppShell.tsx:470 and AppShell.tsx:562, so no new import is needed. ExportPlan rows have `sourceW / sourceH / outW / outH` numeric fields (verified via grep on `props.plan.rows` at OptimizeDialog.tsx:280-285). Insert verbatim:

  ```tsx
  // Phase 20 — savings-percentage snapshot for the Documentation Builder's
  // HTML export Optimization Config card. Formula LOCKED in CONTEXT.md D-18
  // sub-step 3: (1 - sumOutPixels / sumSourcePixels) * 100, byte-identical
  // to OptimizeDialog.tsx:280-291 (which is the visual source-of-truth on
  // the existing Optimize Assets dialog). Returns null when there are no
  // rows in the plan (avoids divide-by-zero AND signals "no data" to the
  // HTML export's "—" placeholder per renderOptimizationConfigCard).
  const savingsPctMemo = useMemo<number | null>(() => {
    const plan = buildExportPlan(effectiveSummary, overrides);
    if (plan.rows.length === 0) return null;
    const sumSourcePixels = plan.rows.reduce(
      (acc, r) => acc + r.sourceW * r.sourceH,
      0,
    );
    const sumOutPixels = plan.rows.reduce(
      (acc, r) => acc + r.outW * r.outH,
      0,
    );
    if (sumSourcePixels <= 0) return null;
    return (1 - sumOutPixels / sumSourcePixels) * 100;
  }, [effectiveSummary, overrides]);
  ```

  Key verification points for the executor:
  - The `plan.rows` accessor (NOT `plan.entries`) — verified at OptimizeDialog.tsx:280-285 + 562 in AppShell.
  - The `useMemo` deps array `[effectiveSummary, overrides]` — same deps as the new `atlasPreviewState` memo above (same inputs).
  - The `null` return on empty rows or zero source pixels — `renderOptimizationConfigCard` in Plan 04 Task 1 explicitly handles `payload.exportPlanSavingsPct === null` by displaying `'—'`.

After landing both memos, the modal mount JSX (around AppShell.tsx:1387-1396 area, parallel to `<AtlasPreviewModal>`) reads each binding directly with no further computation.

**Step F — Create `tests/core/documentation-roundtrip.spec.ts` (DOC-05):**

```typescript
import { describe, it, expect } from 'vitest';
import {
  serializeProjectFile,
  validateProjectFile,
  materializeProjectFile,
} from '../../src/core/project-file.js';
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../src/core/documentation.js';
import type { AppSessionState } from '../../src/shared/types.js';

function makeBaseState(overrides: Partial<AppSessionState> = {}): AppSessionState {
  return {
    skeletonPath: '/tmp/SIMPLE.json',
    atlasPath: '/tmp/SIMPLE.atlas',
    imagesDir: null,
    overrides: {},
    samplingHz: null,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    documentation: DEFAULT_DOCUMENTATION,
    ...overrides,
  } as AppSessionState;
}

describe('documentation round-trip identity (DOC-05)', () => {
  it('DEFAULT_DOCUMENTATION survives serialize → JSON.parse → validate → materialize bit-equal', () => {
    const state = makeBaseState();
    const file = serializeProjectFile(state, '/tmp/proj.stmproj');
    const json = JSON.stringify(file);
    const parsed = JSON.parse(json);
    const v = validateProjectFile(parsed);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/tmp/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });

  it('non-empty Documentation survives bit-equal', () => {
    const doc: Documentation = {
      animationTracks: [
        { id: 'uuid-1', trackIndex: 0, animationName: 'PATH', mixTime: 0.25, loop: true, notes: 'Primary loop' },
        { id: 'uuid-2', trackIndex: 1, animationName: 'PATH', mixTime: 0.5, loop: false, notes: '' },
        { id: 'uuid-3', trackIndex: 1, animationName: 'walk', mixTime: 0.1, loop: true, notes: 'Multi-line\nnotes' },
      ],
      events: [
        { name: 'shoot', description: 'Fires when ammo expended' },
        { name: 'land', description: '' },
      ],
      generalNotes: 'Multi-line\nnotes\nwith\ttabs.',
      controlBones: [
        { name: 'CHAIN_2', description: 'Spine root' },
      ],
      skins: [
        { name: 'default', description: 'The default skin' },
        { name: 'gold', description: '' },
      ],
      safetyBufferPercent: 5,
    };
    const state = makeBaseState({ documentation: doc });
    const file = serializeProjectFile(state, '/tmp/proj.stmproj');
    const json = JSON.stringify(file);
    const parsed = JSON.parse(json);
    const v = validateProjectFile(parsed);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/tmp/proj.stmproj');
    expect(mat.documentation).toEqual(doc);
  });

  it('Phase 8-era empty {} slot back-fills DEFAULT_DOCUMENTATION on materialize (Pitfall 9)', () => {
    // Simulate an old .stmproj with documentation:{} written by Phase 8.
    const oldFile: unknown = {
      version: 1,
      skeletonPath: '/tmp/SIMPLE.json',
      atlasPath: '/tmp/SIMPLE.atlas',
      imagesDir: null,
      overrides: {},
      samplingHz: null,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
    };
    // Per Plan 01 Task 2 Step A, the validator pre-massages empty {} to
    // DEFAULT_DOCUMENTATION before per-field guards run, so Phase 8-era files
    // pass validation. This test exercises the materializer's defence-in-depth
    // back-fill in isolation; the full-pipeline test (validate → materialize)
    // lives in tests/core/project-file.spec.ts (`Phase 8-era full pipeline`).
    const mat = materializeProjectFile(oldFile as never, '/tmp/proj.stmproj');
    expect(mat.documentation).toEqual(DEFAULT_DOCUMENTATION);
  });
});
```

Forward-compat note: validator pre-massage is locked in Plan 01 Task 2 Step A — the validator substitutes `DEFAULT_DOCUMENTATION` for a missing or empty `documentation` slot BEFORE per-field guards run, so Phase 8-era `.stmproj` files (with `documentation: {}` literal on disk) flow through `validateProjectFile` cleanly. The `Phase 8-era empty {} slot back-fills DEFAULT_DOCUMENTATION on materialize` test in this plan exercises the materializer in isolation (the materializer back-fill is defence in depth); the full-pipeline forward-compat test that proves the entire validate → materialize chain accepts `documentation: {}` lives in Plan 01 Task 2 Step D (`Phase 8-era full pipeline (validate → materialize) accepts empty {} ...`). No conditional pre-massage decision is delegated to the executor in this plan.
  </action>
  <verify>
    <automated>npm run test && npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "documentation:exportHtml" src/main/ipc.ts` returns at least 1
    - `grep -c "handleExportDocumentationHtml" src/main/ipc.ts` returns at least 1
    - `grep -c "documentation:exportHtml" src/preload/index.ts` returns at least 1
    - `grep -c "exportDocumentationHtml" src/preload/index.ts` returns at least 1
    - `grep -c "exportDocumentationHtml" src/shared/types.ts` returns at least 1
    - `grep -c "DocExportPayload" src/shared/types.ts` returns at least 1
    - `grep -c "function ExportPane" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "ExportPanePlaceholder" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 0
    - `grep -c "Export HTML" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "exportDocumentationHtml" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "atlasPreview=" src/renderer/src/components/AppShell.tsx` returns at least 1 (modal mount uses the prop)
    - `grep -c "exportPlanSavingsPct" src/renderer/src/components/AppShell.tsx` returns at least 1
    - File `tests/core/documentation-roundtrip.spec.ts` exists with at least 3 `it(` blocks
    - `npm run test` full suite exits 0
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>
    IPC channel `'documentation:exportHtml'` registered (handler / preload / Api type — three-tier complete). Renderer Export pane invokes `window.api.exportDocumentationHtml(payload)` and renders success/error states with the locked copy. AppShell threads `atlasPreview`, `exportPlanSavingsPct`, and `lastOutDir` through to the modal. Round-trip identity test (DOC-05) covers DEFAULT_DOCUMENTATION + a representative non-empty Documentation + Phase 8-era empty `{}` forward-compat. Full test suite green; typecheck green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → IPC payload | `exportDocumentationHtml` payload crosses the renderer/main boundary; main MUST NOT trust the payload's path component (skeletonBasename, lastOutDir) without validation |
| user-supplied strings → HTML output | All Documentation field values + summary names + path strings are HTML-escaped before embedding in the output file |
| filesystem write | `dialog.showSaveDialog` returns an absolute path the user explicitly chose; main writes to that exact path (no path joining of user-supplied components beyond what dialog returned) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-19 | Tampering / XSS | renderDocumentationHtml | mitigate | All user-supplied strings (animationName, notes, generalNotes, descriptions, event/bone/skin names, skeletonBasename) routed through escapeHtml before embedding. Acceptance criterion: test `'<script>alert(1)</script>'` becomes `&lt;script&gt;alert(1)&lt;/script&gt;` in output. |
| T-20-20 | Tampering / Self-Containment | renderDocumentationHtml output | mitigate | No `<img src=>`, no `<link rel="stylesheet">`, no `<script src=>`, no `url(http://...)`, no `@font-face`, no `@import`. Inline `<style>` block + inline SVG glyphs only. Acceptance criterion: regex assertions in tests/main/doc-export.spec.ts ensure no external refs survive. |
| T-20-21 | Path Traversal | handleExportDocumentationHtml | mitigate | Save path is determined SOLELY by `dialog.showSaveDialog` result (`result.filePath`). Defensive `if (!path.isAbsolute(result.filePath))` guard rejects relative paths. We do NOT join the user's payload skeletonBasename to the final write path — Electron's dialog already returns the absolute, user-confirmed path. |
| T-20-22 | Tampering (IPC payload spoofing) | handleExportDocumentationHtml | accept | The IPC payload comes from the trusted renderer over Electron IPC; structuredClone serialization rejects non-cloneable types. The payload's Documentation has already been validator-checked (round-trip-safe) and the renderer-side draft only flows from validator-accepted data. No additional validation in main beyond the structuredClone gate. |
| T-20-23 | Information Disclosure (filesystem) | atomic write | accept | The user explicitly chose the save target via `dialog.showSaveDialog`; writing user-authored documentation to that location is the entire point of the feature. No PII concern beyond what the user typed. |
| T-20-24 | Denial of Service (large doc) | renderDocumentationHtml | accept | Output size scales O(n) with documentation entries; user-bounded (rigs have hundreds of bones, not millions). String concatenation in V8 is performant; no streaming needed for typical sizes. |
| T-20-25 | Round-trip drift on load | materializeProjectFile + Pitfall 9 | mitigate | Forward-compat default + drift policy intersection at load time (Plan 02). DOC-05 round-trip identity test proves bit-equal preservation for representative shapes. Phase 8-era empty `{}` slots back-fill cleanly. |
| T-20-26 | Tampering (deterministic golden test) | tests/main/doc-export.spec.ts | mitigate | `generatedAt` is injected as a payload field; tests pass `new Date('2026-04-14T12:00:00Z').getTime()`. `formatDateDDMMYYYY` uses `toISOString` for TZ-stable output. No locale-dependent formatting in the snapshot. |
| T-20-27 | Renderer Layer 3 leak | shared/types.ts re-exports types from main/doc-export.ts | mitigate | The re-export is type-only (`export type {...}`); no runtime code crosses the boundary. Renderer at runtime only calls `window.api.exportDocumentationHtml` (preload-bridged), never imports from `src/main/`. arch.spec.ts grep gates remain green. |
</threat_model>

<verification>
After both tasks land:

1. `npm run test` full suite exits 0 (all phases of tests, including new doc-export + roundtrip)
2. `npm run typecheck` exits 0
3. `npm run test -- tests/arch.spec.ts` exits 0 (Layer 3 + literal-class invariants preserved)
4. Manual smoke (`npm run dev`):
   - Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`
   - Click Documentation button → modal opens
   - Sections tab: type a description on at least one bone + general notes
   - Animation Tracks tab: click + Add Track, drag any animation onto Track 0
   - Save changes
   - Re-open the modal → confirm draft persists in AppSessionState (after Save → Save Project the documentation should round-trip via `.stmproj`)
   - Export tab: click "Export HTML…", choose a save location, confirm the .html file opens in a browser offline with no broken refs (no missing icons, no missing fonts, no `file://` 404s)
5. `grep -E "<script src=|<link[^>]+rel=\"stylesheet\"|<img |url\\(https?:" tests/main/__snapshots__/doc-export.spec.ts.snap` returns NOTHING (snapshot proves self-containment)
</verification>

<success_criteria>
- DOC-04: Self-contained HTML export wired end-to-end (renderer button → IPC → main handler → atomic write); content includes all docs + optimization-config snapshot + atlas page count + image-utilization count
- DOC-05: Round-trip identity proven via tests/core/documentation-roundtrip.spec.ts; Phase 8-era empty `{}` slots load via the locked validator pre-massage (Plan 01 Task 2 Step A) + materializer back-fill (defence in depth)
- HTML output is self-contained: no `<script src=`, no `<link rel="stylesheet">`, no `<img src=`, no remote `url(http(s)://)` references — provable via vitest assertions
- All user-supplied strings HTML-escaped (XSS attempt becomes harmless text) — provable via vitest assertion
- IPC channel `'documentation:exportHtml'` registered through the standard 3-tier (handler / preload / Api type)
- Renderer Export pane invokes the IPC and renders success/error states with locked copy
- AppShell threads atlasPreview / exportPlanSavingsPct / lastOutDir into the modal
- Atomic write Pattern-B used (no partial writes can leave a corrupt .html)
- Full test suite + typecheck green
</success_criteria>

<output>
After completion, create `.planning/phases/20-documentation-builder-feature/20-04-html-export-ipc-roundtrip-SUMMARY.md` documenting:
- HTML template structure (hero / chip strip / cards / table) and conditional Events card
- IPC channel registration (handler / preload / Api type)
- Renderer Export pane click-time payload assembly
- Round-trip identity coverage (DEFAULT + representative + Phase 8-era empty)
- XSS escape + self-containment proofs in the test surface
- Phase 20 completion: all DOC-01..DOC-05 requirements covered
</output>
