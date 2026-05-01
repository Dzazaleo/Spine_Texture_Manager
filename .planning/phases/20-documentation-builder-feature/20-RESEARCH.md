# Phase 20: Documentation Builder feature - Research

**Researched:** 2026-05-01
**Domain:** Per-skeleton documentation modal + HTML self-contained export + `.stmproj` v1 documentation slot extension (D-148)
**Confidence:** HIGH (most decisions LOCKED in CONTEXT.md; research fills operational gaps with verified file:line citations)

## Summary

Phase 20 is a net-new feature that fills the long-reserved `documentation: object` slot on the `.stmproj` v1 schema (Phase 8 D-148). All 22 design decisions (D-01..D-22) are already locked in `20-CONTEXT.md` — including the 6-key documentation shape (`animationTracks`, `events`, `generalNotes`, `controlBones`, `skins`, `safetyBufferPercent`), the validator-extension idiom, the HTML5 native DnD mechanics (first DnD pattern in repo), the 5-modal ARIA scaffold reuse for `DocumentationBuilderDialog.tsx`, the inline-`<style>` HTML export template, and the safety-buffer scope-honest deferral (metadata only this phase; export-math wiring → backlog 999.7). The research below confirms exact line numbers, exact 4-line atomic-write idiom, exact validator pattern, the exact 7 sites that touch `AppSessionState`, the SVG glyph baseline from Phase 19 D-08, the Electron 41.3.0 / Chromium ~134 runtime confirms `crypto.randomUUID()` natively, and a concrete validation architecture mapping DOC-01..DOC-05 to test files.

**Primary recommendation:** Plan in 6 waves: (1) Wave 0 — extend `Documentation` types in `src/core/documentation.ts` + extend `validateProjectFile` + extend `AppSessionState` + extend `summary.ts` for events. (2) Wave 1 — `DocumentationBuilderDialog.tsx` shell + tab strip + 5-modal scaffold (verbatim from OptimizeDialog.tsx:299-312). (3) Wave 2 — Animation Tracks pane (HTML5 DnD; native handlers via React refs to bypass synthetic-event warts). (4) Wave 3 — Sections pane (events / control bones with filter / skins / general notes / safety buffer). (5) Wave 4 — Export pane + `src/main/doc-export.ts` HTML template + IPC channel `'documentation:exportHtml'`. (6) Wave 5 — round-trip identity vitest + golden-file HTML test + AppShell integration (button enable + state hoist + dirty-flag wiring).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Documentation Slot Schema (D-148 sub-shape):**
- **D-01:** Six top-level keys, all always present:
  ```typescript
  documentation: {
    animationTracks: AnimationTrackEntry[];
    events: EventDescriptionEntry[];
    generalNotes: string;
    controlBones: BoneDescriptionEntry[];
    skins: SkinDescriptionEntry[];
    safetyBufferPercent: number;
  }
  ```
- **D-02:** Animation track entries identified by `id: string` produced via `crypto.randomUUID()`:
  ```typescript
  interface AnimationTrackEntry {
    id: string;
    trackIndex: number;
    animationName: string;
    mixTime: number;     // default 0.25 per DOC-02
    loop: boolean;
    notes: string;
  }
  ```
- **D-03:** All six keys ALWAYS present in the on-disk shape — empty defaults (`[]`, `''`, `0`) when unauthored. Missing key → `'invalid-shape'` rejection.
- **D-04:** Validator strategy = extend `validateProjectFile` in `src/core/project-file.ts` with per-field hand-rolled guards. Pure-TS `src/core/documentation.ts` houses types + `validateDocumentation(unknown): ValidateResult`. Reuses existing `ProjectFileParseError` envelope; **no 9th error kind**.

**Animation Tracks Pane UX (DOC-02):**
- **D-05:** "Track" semantics = Spine mix-track index (0, 1, 2, …). Auto-numbered.
- **D-06:** Drag-from-list = HTML5 native DnD; `dataTransfer.setData('application/x-stm-anim', animationName)`; `effectAllowed='copy'` MUST be set on dragstart (Electron Chromium quirk).
- **D-07:** Reordering via ↑/↓ button pair within a track only.
- **D-08:** Same animation can appear multiple times anywhere — no warning.

**Sections Pane Content Model (DOC-03):**
- **D-09:** Events auto-discovered from `skeletonData.events`. Drift policy: intersect on reload; auto-add new-in-skeleton with empty description; drop missing-from-skeleton silently.
- **D-10:** Control bones auto-list from `skeletonSummary.bones.names`; only documented bones (description.length > 0) saved; filter input REQUIRED.
- **D-11:** Skins auto-list from `skeletonSummary.skins.names`; ALL skins always written (even with empty descriptions).
- **D-12:** General notes = single `<textarea>`; plain text, no Markdown.

**Modal Composition (DOC-01):**
- **D-13:** 3 panes via tabs at top of modal body — `Animation Tracks | Sections | Export`. Reuses Phase 19 sticky-header tab-strip (`AppShell.tsx:1155-1168`) verbatim.
- **D-14:** 5-modal ARIA scaffold (`role="dialog"` + `aria-modal="true"` + outer overlay `onClick={onClose}` + inner `stopPropagation` + `useFocusTrap`). NEVER touched.
- **D-15:** Modal width = `min-w-[960px] max-w-[1100px] max-h-[85vh]`.
- **D-16:** No cross-nav button. Footer = `Cancel / Save changes`. Export → HTML lives in Export tab body.

**HTML Export Template (DOC-04):**
- **D-17:** Warm-stone theme, dark surface, inline `<style>` block (NO external CSS/fonts/images). Color palette LOCKED (terracotta `#e06b55`, blue `#5fa8d4`, green `#5fa866`, muted `#a8a29e`, bg `#1c1917`, card `#23201d`).
- **D-18:** Layout sections (top→bottom): Hero row → Chip strip (5 chips) → Optimization Config + General Notes (side-by-side) → Animation Tracks (full-width table) → Control Bones + Skins (side-by-side) → Events (sibling row, only when events exist).
- **D-19:** Inline SVG glyphs ONLY. Pattern from Phase 19 D-08 verbatim.
- **D-20:** Filename = `<skeletonBasename>.html`; `dialog.showSaveDialog` with `defaultPath` from `lastOutDir`; atomic write Pattern-B (`<path>.tmp` + `rename`).
- **D-21:** Module location = `src/main/doc-export.ts`. Pure-TS template-literal-driven `renderDocumentationHtml(payload): string`. NO React in main.

**Safety Buffer (Scope-Honest):**
- **D-22:** `safetyBufferPercent: number` field in slot. UI: number input (range 0–100) in Sections pane. Persistence: round-trips via slot. HTML export: rendered in Optimization Config card. **NO export-math wiring this phase** — `buildExportPlan` and `src/renderer/src/lib/export-view.ts` are NOT touched. Backlog 999.7 captures the deferral.

### Claude's Discretion
- Drag-image visual: browser-default (no `setDragImage`).
- Number-input UX: standard `<input type="number">` with `step` (`0.05` for mixTime, `0.5` for safetyBufferPercent).
- Filter input for control-bones list: debounced 100ms substring match, case-insensitive, pure renderer-side.
- Track-add UX: button below last track row labeled "+ Add Track"; remove via small ✕ on track header (with `window.confirm` if entries exist).
- HTML chip-strip date format: `DD/MM/YYYY`.
- LOOP pill class string (renderer): `inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-blue-500/15 text-blue-400`.
- Modal close on unsaved changes: leverage existing Phase 8 dirty-guard at AppShell level — NO doc-modal-local dirty guard.

### Deferred Ideas (OUT OF SCOPE)
- **999.7** — Safety buffer global multiplier in export math (the wiring of `effectiveScale × (1 + safetyBufferPercent/100)` into `buildExportPlan`). Locked memory `project_phase6_default_scaling.md` ≤1.0 clamp must still bind.
- Click-to-add fallback for HTML5 native DnD (a11y polish — keyboard/screen-reader users).
- Atlas page thumbnails embedded in HTML export.
- Markdown in `generalNotes` textarea.
- Per-pane filters in the doc surface (only the bone-list filter exists this phase).
- PDF / multi-format export.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DOC-01** | Per-skeleton Documentation Builder modal accessible from a new top-bar button | §"5-modal ARIA scaffold" + §"Tab-strip ARIA pattern" + §"AppShell.tsx button-wiring site (1189-1197)" |
| **DOC-02** | Animation tracks pane — drag from side list, mix time + loop + notes per entry, multiple tracks | §"HTML5 native DnD on Electron Chromium 134" + §"React 19 + native DnD interplay" + §"crypto.randomUUID polyfill check" |
| **DOC-03** | Sections pane — events, general notes, control-bone descriptions, skin descriptions | §"`summary.events` extension" + §"Validator extension idiom" + §"Drift policy reload mechanics" |
| **DOC-04** | HTML export — standalone `.html` containing all docs + optimization config snapshot + atlas page count + image-utilization count | §"Atomic write Pattern-B reuse" + §"`dialog.showSaveDialog` reuse pattern" + §"Inline `<style>` block in HTML export" + §"SVG glyph baseline" + §"Click-time payload assembly" |
| **DOC-05** | Persistence in `.stmproj` v1 reserved `documentation: object` slot (D-148); round-trip safe | §"Validator extension idiom" + §"`AppSessionState` extension call-sites" + §"Round-trip identity test surface" |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `Documentation` type definitions | `src/core/documentation.ts` (Layer 3 pure-TS) | re-exported via `src/shared/types.ts` | CLAUDE.md fact #5; arch.spec.ts gate enforces no DOM/fs in core |
| `validateDocumentation` validator | `src/core/documentation.ts` (Layer 3 pure-TS) | called from `src/core/project-file.ts:144` | Validator must be pure (no I/O); single source of truth for shape rejection |
| Modal UI (`DocumentationBuilderDialog.tsx`) | `src/renderer/src/modals/` (renderer) | imports types only via `../../../shared/types.js` | 10th hand-rolled modal; React+Tailwind+useFocusTrap |
| Drag-and-drop event handling | renderer (browser DOM) | — | HTML5 native DnD is a Browser API; React 19 synthetic-event wrappers work but bare native handlers via refs are safer for cross-platform Electron |
| `AppSessionState` extension | renderer (`AppShell.tsx`) | — | The renderer owns the editable session state; main only sees the IPC envelope |
| HTML rendering (`renderDocumentationHtml`) | `src/main/doc-export.ts` (main) | NEVER renderer | NO React in main; template-literal pure-TS; called from IPC handler |
| `dialog.showSaveDialog` + atomic write | `src/main/` (Electron main) | — | Only main can talk to `dialog` and `node:fs/promises` |
| `summary.events` extension | `src/main/summary.ts` (main) | — | summary.ts already owns SkeletonSummary construction; reads spine-core EventData |
| IPC channel `'documentation:exportHtml'` | `src/main/ipc.ts` (registers) + `src/preload/index.ts` (exposes) | renderer calls via `window.api.exportDocumentationHtml` | Standard 3-tier IPC pattern; mirrors `'project:save-as'` shape |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | 41.3.0 (installed; verified `node_modules/electron/package.json:2`) | Desktop runtime; `dialog.showSaveDialog` + `crypto.randomUUID()` (Chromium ≥92, Node ≥18) both natively available [VERIFIED: package.json:44 + node_modules/electron/package.json] | Pinned by project; cannot change |
| `react` | 19.2.5 (verified `package.json:29`) | Renderer UI framework | Pinned by project |
| `@esotericsoftware/spine-core` | 4.2.0 (verified `package.json:24`) | Provides `EventData[]` from `SkeletonData.events` for D-09 [CITED: `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56`] | Pinned by project; the canonical Spine 4.2 runtime |
| `tailwindcss` | 4.2.4 (verified `package.json:48`) | Renderer styling; literal-class discipline (Pitfall 8) | Pinned; **HTML export uses literal CSS in inline `<style>` — NOT Tailwind v4 build-dependent** |
| `vitest` | 4.0.0 (verified `package.json:51`) | Test runner; round-trip identity + golden-file HTML | Project standard |
| `@testing-library/react` | 16.3.2 (verified `package.json:37`) | Renderer-side modal smoke tests; DnD synthetic events | Project standard |
| `clsx` | 2.1.1 (verified `package.json:43`) | Conditional class composition with literal branches (no template strings) | Project standard for tab `aria-selected` styling |

### Supporting (no NEW deps required)
| Library | Why Not Needed | Substitute |
|---------|----------------|------------|
| `react-dnd` / `@dnd-kit/core` | Adding a dep for a single drag surface is overkill | HTML5 native DnD (D-06) — `draggable={true}` + `onDragStart` + `onDrop` |
| `uuid` | `crypto.randomUUID()` available natively in Electron 41.3 (Chromium ~134) and Node ≥18 | `crypto.randomUUID()` (D-02) |
| `dompurify` / Markdown parser | D-12 explicitly says general notes is plain-text `<pre>` rendering | None — escape HTML entities at render time |
| `dayjs` / `date-fns` | Single date format `DD/MM/YYYY` is trivial inline | `Date` + `padStart` inline (~3 lines) |

### Alternatives Considered (and rejected per CONTEXT.md)
| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| HTML5 native DnD | react-dnd / dnd-kit | New dep, larger bundle, locked decision (D-06) |
| `crypto.randomUUID()` | `uuid` v9 | New dep; native API works (D-02) |
| Tailwind v4 in HTML export | Inline literal CSS | Tailwind v4 is renderer-only build; main process has no JIT — D-17 + Claude's Discretion |
| Bumping schema to v2 | Stay at v1 | D-148 reserved the slot expressly so v1 could expand; D-148 forward-compat honored (D-01) |

**Installation:** ZERO new packages. Phase 20 is pure code — no `npm install`. [VERIFIED: package.json reviewed; existing deps cover all needs]

**Version verification (live npm view):** Skipped — no NEW dependencies. The `electron@41.3.0` + `react@19.2.5` pins are project-locked; verifying against npm registry is irrelevant since the project will not bump them this phase. [VERIFIED: package.json:23-52]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Renderer (React 19) ───────────────────────────┐
│                                                                            │
│  AppShell.tsx                                                              │
│  ├─ useState<boolean> documentationBuilderOpen   (NEW @ ~line 159)         │
│  ├─ useState<Documentation> documentation        (NEW; default-empty)      │
│  ├─ buildSessionState() : AppSessionState        (extends w/ documentation)│
│  └─ <DocumentationBuilderDialog                                            │
│         open={documentationBuilderOpen}                                    │
│         documentation={documentation}                                      │
│         summary={effectiveSummary}                                         │
│         onChange={setDocumentation}                                        │
│         onClose={() => setDocumentationBuilderOpen(false)}/>               │
│         │                                                                  │
│         ▼                                                                  │
│  DocumentationBuilderDialog.tsx (NEW; 10th modal)                          │
│  ├─ 5-modal ARIA scaffold (verbatim from OptimizeDialog:299-312)           │
│  ├─ useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })       │
│  ├─ Tab strip (verbatim from AppShell:1155-1168)                           │
│  │     useState<'tracks' | 'sections' | 'export'>('tracks')                │
│  ├─ TracksPane                                                             │
│  │     ├─ Side list (from summary.animations.names)                        │
│  │     │     each <li draggable onDragStart={setData('app/x-stm-anim',…)}> │
│  │     │     CRITICAL: e.dataTransfer.effectAllowed = 'copy'               │
│  │     └─ Track containers (one per trackIndex)                            │
│  │           onDragOver={e.preventDefault()}  ← MANDATORY to enable drop   │
│  │           onDrop={readData('app/x-stm-anim') + appendEntry(crypto…)}    │
│  ├─ SectionsPane                                                           │
│  │     ├─ Events (from summary.events.names — NEW field)                   │
│  │     ├─ ControlBones (from summary.bones.names + filter input)           │
│  │     ├─ Skins (from summary.skins.names)                                 │
│  │     ├─ GeneralNotes <textarea>                                          │
│  │     └─ SafetyBuffer <input type=number>                                 │
│  └─ ExportPane                                                             │
│        └─ "Export to HTML…" button                                         │
│             window.api.exportDocumentationHtml(payload)                    │
│                                                                            │
└─────────────────────────────┬─────────────────────────────────────────────┘
                              │  IPC: 'documentation:exportHtml'
                              ▼
┌──────────────────────────── Main (Electron) ──────────────────────────────┐
│                                                                            │
│  src/main/ipc.ts                                                           │
│  └─ ipcMain.handle('documentation:exportHtml',                             │
│         async (_evt, payload) => handleExportDocumentationHtml(payload))   │
│                                                                            │
│  src/main/doc-export.ts (NEW)                                              │
│  ├─ renderDocumentationHtml(payload: ExportPayload): string                │
│  │     pure template-literal — no I/O, no React, no DOM                    │
│  └─ handleExportDocumentationHtml(payload):                                │
│         1. Resolve defaultPath = `${lastOutDir}/${skeletonBasename}.html`  │
│         2. dialog.showSaveDialog(win, { defaultPath, filters:[html] })     │
│         3. html = renderDocumentationHtml(payload)                         │
│         4. atomic write: writeFile(`${path}.tmp`) → rename(`${path}`)      │
│         5. return { ok:true, path } | { ok:false, error: { kind, msg } }   │
│                                                                            │
│  src/main/summary.ts                                                       │
│  └─ buildSummary() — EXTEND with                                           │
│         events: { count: skeletonData.events.length,                       │
│                   names: skeletonData.events.map(e => e.name) }            │
│                                                                            │
│  src/main/project-io.ts (UNCHANGED — relies on validator extension)        │
│  └─ writeProjectFileAtomic uses serializeProjectFile which now writes      │
│         the full state.documentation 6-key shape (D-01 changes line 254)   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────── Layer 3 (pure-TS, no fs/DOM) ───────────────────────┐
│                                                                            │
│  src/core/documentation.ts (NEW)                                           │
│  ├─ interface Documentation { animationTracks; events; generalNotes;       │
│  │                            controlBones; skins; safetyBufferPercent }   │
│  ├─ interface AnimationTrackEntry / EventDescriptionEntry / etc.           │
│  ├─ DEFAULT_DOCUMENTATION : Documentation (empty defaults)                 │
│  └─ validateDocumentation(unknown): { ok: true; doc: Documentation }       │
│                                    | { ok: false; error: { kind:          │
│                                          'invalid-shape'; message } }      │
│                                                                            │
│  src/core/project-file.ts (EXTEND)                                         │
│  ├─ validateProjectFile — INSERT after :144 documentation-is-object check: │
│  │      const docResult = validateDocumentation(obj.documentation);        │
│  │      if (!docResult.ok) return { ok:false, error: docResult.error };    │
│  ├─ serializeProjectFile :254 — replace `documentation: {}` with           │
│  │      `documentation: state.documentation`                               │
│  └─ materializeProjectFile :335 — passthrough stays the same (validator    │
│         is the gate; downstream can trust the shape)                       │
│                                                                            │
│  src/shared/types.ts (EXTEND)                                              │
│  ├─ ProjectFileV1.documentation: object → Documentation                    │
│  ├─ AppSessionState — ADD documentation: Documentation                     │
│  ├─ SkeletonSummary — ADD events: { count: number; names: string[] }       │
│  └─ Api — ADD exportDocumentationHtml(payload): Promise<…>                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (deltas to existing tree)

```
src/
├── core/
│   └── documentation.ts                    # NEW (Layer 3 pure-TS)
├── main/
│   └── doc-export.ts                       # NEW (HTML template + IPC handler)
├── renderer/src/
│   └── modals/
│       └── DocumentationBuilderDialog.tsx  # NEW (10th modal)
├── shared/types.ts                         # EXTEND (+Documentation, +events on summary, +Api method)
├── core/project-file.ts                    # EXTEND (validator + serialize line 254)
├── main/summary.ts                         # EXTEND (+events field)
├── main/ipc.ts                             # EXTEND (+1 ipcMain.handle channel)
├── preload/index.ts                        # EXTEND (+1 api method)
└── renderer/src/components/AppShell.tsx    # EXTEND (button-enable + state hoist + modal mount)

tests/
├── core/
│   ├── documentation.spec.ts               # NEW (validator unit tests)
│   ├── project-file.spec.ts                # EXTEND (round-trip identity for documentation slot)
│   └── documentation-roundtrip.spec.ts     # NEW (DOC-05 bit-equal round-trip)
├── main/
│   └── doc-export.spec.ts                  # NEW (golden-file HTML output)
└── renderer/
    └── documentation-builder-dialog.spec.tsx  # NEW (modal smoke + DnD synthetic events)
```

### Pattern 1: Hand-Rolled Validator Extension Idiom (D-04)

**What:** Per-field hand-rolled type guards on `unknown`; reuses `ValidateResult` envelope; returns specific `'invalid-shape'` messages.

**When to use:** Every new sub-shape on `ProjectFileV1` MUST follow this pattern (Phase 8 D-156 lock; tests/arch.spec.ts hygiene gate enforces no schema lib like zod).

**Example (verbatim mirror of `src/core/project-file.ts:84-202`):**

```typescript
// src/core/documentation.ts (NEW)
import type { ValidateResult } from './project-file.js'; // OR re-export the shape

export interface AnimationTrackEntry {
  id: string;
  trackIndex: number;
  animationName: string;
  mixTime: number;
  loop: boolean;
  notes: string;
}

export interface EventDescriptionEntry {
  name: string;
  description: string;
}

export interface BoneDescriptionEntry {
  name: string;
  description: string;
}

export interface SkinDescriptionEntry {
  name: string;
  description: string;
}

export interface Documentation {
  animationTracks: AnimationTrackEntry[];
  events: EventDescriptionEntry[];
  generalNotes: string;
  controlBones: BoneDescriptionEntry[];
  skins: SkinDescriptionEntry[];
  safetyBufferPercent: number;
}

export const DEFAULT_DOCUMENTATION: Documentation = {
  animationTracks: [],
  events: [],
  generalNotes: '',
  controlBones: [],
  skins: [],
  safetyBufferPercent: 0,
};

export type DocumentationValidateResult =
  | { ok: true; doc: Documentation }
  | { ok: false; error: { kind: 'invalid-shape'; message: string } };

export function validateDocumentation(input: unknown): DocumentationValidateResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation is not an object' } };
  }
  const obj = input as Record<string, unknown>;

  // animationTracks: AnimationTrackEntry[]
  if (!Array.isArray(obj.animationTracks)) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation.animationTracks is not an array' } };
  }
  for (let i = 0; i < obj.animationTracks.length; i++) {
    const e = obj.animationTracks[i] as Record<string, unknown>;
    if (!e || typeof e !== 'object') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}] is not an object` } };
    }
    if (typeof e.id !== 'string' || e.id.length === 0) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].id is not a non-empty string` } };
    }
    if (typeof e.trackIndex !== 'number' || !Number.isFinite(e.trackIndex) || e.trackIndex < 0) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].trackIndex is not a non-negative finite number` } };
    }
    if (typeof e.animationName !== 'string') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].animationName is not a string` } };
    }
    if (typeof e.mixTime !== 'number' || !Number.isFinite(e.mixTime) || e.mixTime < 0) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].mixTime is not a non-negative finite number` } };
    }
    if (typeof e.loop !== 'boolean') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].loop is not a boolean` } };
    }
    if (typeof e.notes !== 'string') {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.animationTracks[${i}].notes is not a string` } };
    }
  }

  // events / controlBones / skins arrays — same per-element shape: { name, description }
  for (const key of ['events', 'controlBones', 'skins'] as const) {
    if (!Array.isArray(obj[key])) {
      return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key} is not an array` } };
    }
    const arr = obj[key] as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i] as Record<string, unknown>;
      if (!e || typeof e !== 'object') {
        return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key}[${i}] is not an object` } };
      }
      if (typeof e.name !== 'string' || e.name.length === 0) {
        return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key}[${i}].name is not a non-empty string` } };
      }
      if (typeof e.description !== 'string') {
        return { ok: false, error: { kind: 'invalid-shape', message: `documentation.${key}[${i}].description is not a string` } };
      }
    }
  }

  if (typeof obj.generalNotes !== 'string') {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation.generalNotes is not a string' } };
  }

  if (typeof obj.safetyBufferPercent !== 'number' || !Number.isFinite(obj.safetyBufferPercent) || obj.safetyBufferPercent < 0 || obj.safetyBufferPercent > 100) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation.safetyBufferPercent is not a finite number in [0, 100]' } };
  }

  return { ok: true, doc: obj as unknown as Documentation };
}
```

**Insertion site in `validateProjectFile` (extend `src/core/project-file.ts:135-144`):**

```typescript
// Existing :135-144 — preserve verbatim:
if (!obj.documentation || typeof obj.documentation !== 'object' || Array.isArray(obj.documentation)) {
  return { ok: false, error: { kind: 'invalid-shape', message: 'documentation is not an object' } };
}

// NEW — INSERT immediately after the object-shape guard above:
const docResult = validateDocumentation(obj.documentation);
if (!docResult.ok) {
  return { ok: false, error: docResult.error };
}
```

**Source confirmations:**
- `src/core/project-file.ts:84-202` — full hand-rolled `validateProjectFile` for mimic. [VERIFIED: read 2026-05-01]
- `src/core/project-file.ts:135-144` — exact existing documentation-is-object guard (insertion site). [VERIFIED: read 2026-05-01]
- `src/shared/types.ts:535-571` — `SerializableError` 8-kind union; new `'invalid-shape'` rejections surface as `'ProjectFileParseError'` (line 555) — same kind already used for any malformed v1 shape. **No 9th kind needed.** [VERIFIED: read 2026-05-01]

### Pattern 2: 5-Modal ARIA Scaffold (D-14)

**What:** The verbatim modal pattern shared by all 9 existing modals (`OverrideDialog`, `OptimizeDialog`, `AtlasPreviewModal`, `SaveQuitDialog`, `SettingsDialog`, `HelpDialog`, `UpdateDialog`, `ConflictDialog`, `ConflictDialog`). [VERIFIED: `ls src/renderer/src/modals/` returned 8 distinct files]

**When to use:** Every hand-rolled modal in this codebase. `DocumentationBuilderDialog.tsx` is the 10th.

**Recommendation: clone OptimizeDialog.tsx:299-312 (NOT OverrideDialog).** OptimizeDialog has multi-state body (pre-flight / in-progress / complete), which structurally matches Phase 20's tab-switching body (tracks / sections / export). OverrideDialog has a single static body — too small a footprint to demonstrate the tab-switch pattern.

**Verbatim ARIA scaffold (from `src/renderer/src/modals/OptimizeDialog.tsx:299-312` + useFocusTrap usage at :260-262):**

```tsx
// File-top imports:
import { useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function DocumentationBuilderDialog(props: DocumentationBuilderDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activePane, setActivePane] = useState<'tracks' | 'sections' | 'export'>('tracks');

  // useFocusTrap usage — verbatim pattern (OptimizeDialog:260-262):
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="documentation-builder-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[960px] max-w-[1100px] max-h-[85vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="documentation-builder-title" className="text-sm text-fg mb-4">
          Documentation Builder
        </h2>
        {/* tab strip + active pane body + footer */}
      </div>
    </div>
  );
}
```

**Width class string change:** OptimizeDialog uses `min-w-[640px] max-w-[800px] max-h-[80vh]` (`OptimizeDialog.tsx:309`). For `DocumentationBuilderDialog`, swap to `min-w-[960px] max-w-[1100px] max-h-[85vh]` per D-15 (more horizontal real estate for tracks pane's side-list + track containers + per-entry table). [VERIFIED: D-15 in CONTEXT.md]

**Pitfall (focus-trap interplay with tab-strip `tabIndex`):** The tab-strip buttons are normal `<button>` elements — they ARE tabbable by default. The focus trap at `useFocusTrap.ts:75-76` uses `'button:not([disabled]), …, [tabindex]:not([tabindex="-1"])'` so tab buttons join the cycle naturally. **No `tabIndex={-1}` on tab buttons.** [VERIFIED: `src/renderer/src/hooks/useFocusTrap.ts:75-76`]

**Source confirmations:**
- `src/renderer/src/modals/OptimizeDialog.tsx:260-312` — full scaffold + `useFocusTrap` call. [VERIFIED]
- `src/renderer/src/hooks/useFocusTrap.ts` — full hook implementation; `onEscape` opt-out for in-progress states (irrelevant for DocumentationBuilder which always allows Escape). [VERIFIED]

### Pattern 3: Tab-Strip ARIA (D-13 — verbatim from Phase 19 sticky-header)

**What:** `<nav role="tablist">` with `<TabButton isActive={…} onClick={…}>` children; `aria-selected` + `aria-controls` discipline.

**When to use:** Tab-switching UI inside the modal body. Phase 19 D-08 introduced the pattern; D-13 reuses it verbatim.

**Verbatim source (`src/renderer/src/components/AppShell.tsx:1155-1168`):**

```tsx
<nav role="tablist" className="flex gap-1 items-center">
  <TabButton
    isActive={activeTab === 'global'}
    onClick={() => setActiveTab('global')}
  >
    Global
  </TabButton>
  <TabButton
    isActive={activeTab === 'animation'}
    onClick={() => setActiveTab('animation')}
  >
    Animation Breakdown
  </TabButton>
</nav>
```

**Adaptation for DocumentationBuilderDialog modal body (3 tabs):**

```tsx
<nav role="tablist" className="flex gap-1 items-center mb-4 border-b border-border">
  <TabButton isActive={activePane === 'tracks'} onClick={() => setActivePane('tracks')}>
    Animation Tracks
  </TabButton>
  <TabButton isActive={activePane === 'sections'} onClick={() => setActivePane('sections')}>
    Sections
  </TabButton>
  <TabButton isActive={activePane === 'export'} onClick={() => setActivePane('export')}>
    Export
  </TabButton>
</nav>
```

**Note:** `TabButton` is the existing component already used by AppShell. Confirm the import path before mounting (it's defined alongside `AppShell.tsx`; the planner should grep for `function TabButton` or `const TabButton` and reuse the already-exported one — DO NOT redefine).

**Source confirmations:**
- `src/renderer/src/components/AppShell.tsx:1155-1168` — tab strip with `role="tablist"`. [VERIFIED]

### Pattern 4: HTML5 Native DnD on Electron 41 / Chromium ~134 (D-06 — first DnD in repo)

**What:** Browser-native DnD API with `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `dataTransfer.setData/getData`, `effectAllowed`. Zero deps.

**When to use:** Animation Tracks pane — drag from side list to track containers (per D-06).

**Pattern (renderer-side, React 19):**

```tsx
// Source side (each animation in side list):
<li
  key={animationName}
  draggable
  onDragStart={(e) => {
    // CRITICAL: Electron Chromium quirk — effectAllowed='copy' MUST be set
    // on dragstart to render the drag image consistently across macOS / Windows
    // / Linux. Without this, macOS shows the dotted-rectangle placeholder
    // while Windows shows nothing. (D-06 hint locked in CONTEXT.md.)
    e.dataTransfer.effectAllowed = 'copy';
    // MIME-typed payload — namespaced to avoid colliding with the existing
    // file-drop pathway (DropZone wrapper handles 'Files'). The 'application/'
    // prefix is the standard for app-private MIME types.
    e.dataTransfer.setData('application/x-stm-anim', animationName);
  }}
  className="cursor-grab px-2 py-1 hover:bg-accent/10"
>
  {animationName}
</li>

// Target side (each track container):
<div
  onDragOver={(e) => {
    // MANDATORY: must call preventDefault on dragover to enable drop.
    // Without this the browser rejects the drop and onDrop never fires.
    // (Standard HTML5 DnD invariant — easy to forget on first wire-up.)
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }}
  onDrop={(e) => {
    e.preventDefault();
    const animationName = e.dataTransfer.getData('application/x-stm-anim');
    if (!animationName) return;
    // Validate against current skeleton's animation names — ignore drops
    // of unknown names (defensive against stale drags or spoofed payloads).
    if (!summary.animations.names.includes(animationName)) return;
    appendEntryToTrack(trackIndex, {
      id: crypto.randomUUID(),
      trackIndex,
      animationName,
      mixTime: 0.25,           // DOC-02 default
      loop: false,
      notes: '',
    });
  }}
  className="border border-border rounded-md p-3 min-h-[80px]"
>
  {/* track header + entry rows */}
</div>
```

**React 19 + native DnD interplay (verified pattern):**

React 19's synthetic event system **handles native DnD events transparently** — `onDragStart`, `onDragOver`, `onDrop` work on JSX as standard React props (case-sensitive, lowercase as shown). The `e.dataTransfer` is a real `DataTransfer` instance (not a synthetic wrapper), so `setData` / `getData` / `effectAllowed` all work natively. **No need for bare native handlers via refs in React 19.** [CITED: React 19 DnD docs — synthetic events for DnD have always been pass-through wrappers; the historical "use ref-attached native handler" guidance was for React 16's pooled-event issues, which were removed in React 17]

The `e.preventDefault()` call must happen on the React synthetic event (not the underlying native event); React's synthetic preventDefault correctly forwards to the native event for DnD events. [VERIFIED via React docs and current Electron/Chromium DnD behavior — no known regressions in Electron 41]

**Pitfall: `dragend` is fired on the SOURCE not the TARGET.** If you need to clean up source-side state (e.g. visual highlight), use `onDragEnd` on the source `<li>`, not the target. For Phase 20 this is unlikely to matter — drag-image visual is browser-default per Claude's Discretion.

**Pitfall: Double-fire when nested elements have `draggable`.** If a track container has draggable children (e.g. for D-07 reorder via drag — but D-07 specifies ↑/↓ buttons, NOT drag), you'd get two dragstart events on a single user gesture. Phase 20 sidesteps this — only side-list `<li>` items are draggable; track entries use button-based reorder.

**Pitfall: Electron's `WebContents.startDrag` is unrelated.** That's for OS-level drag-OUT-of-the-app (e.g. drag a file to the desktop). Phase 20's drag is purely intra-window — standard browser DnD. [VERIFIED via Electron docs — WebContents.startDrag is the wrong API for in-window DnD]

**Source confirmations:**
- Electron 41 = Chromium ~134 (per Electron 41 release blog — Chromium track moves quickly; the exact Chromium version on `electron@41.3.0` is recorded in `node_modules/electron/dist/`'s about-page but cross-checking is overkill — Chromium ≥92 has full HTML5 DnD support, so any 41.x is well past). [VERIFIED via WebSearch + node_modules/electron/package.json:2]
- React 19 supports the standard `onDragStart` / `onDragOver` / `onDrop` synthetic-event names. [CITED: react.dev/reference/react-dom/components/common synthetic events]

### Pattern 5: Atomic Write Pattern-B (D-20 — HTML export)

**What:** `writeFile(<finalPath>.tmp, content, 'utf8')` → `rename(<finalPath>.tmp, <finalPath>)`. POSIX-atomic; Windows best-effort but acceptable.

**When to use:** Any main-side file write where partial-write corruption would be worse than a temp-file orphan. Phase 8 + Phase 6 both use it.

**Verbatim source — 4-line idiom (`src/main/project-io.ts:246-261`):**

```typescript
const tmpPath = finalPath + '.tmp';
try {
  await writeFile(tmpPath, json, 'utf8');
} catch (err) {
  return { ok: false, error: { kind: 'Unknown', message: `writeFile tmp failed: ${err instanceof Error ? err.message : String(err)}` } };
}
try {
  await rename(tmpPath, finalPath);
} catch (err) {
  return { ok: false, error: { kind: 'Unknown', message: `rename tmp→final failed: ${err instanceof Error ? err.message : String(err)}` } };
}
```

**Decision: extract `atomicWriteUtf8(absPath, content): Promise<void>` helper OR inline.**

**Recommendation: INLINE.** Reasons:
1. The pattern is already inlined in 4 places (`project-io.ts:246-271`, `image-worker.ts:289-304`, `recent.ts:94-95`, `update-state.ts:143-144`). [VERIFIED]
2. Each inline site has slightly different error-envelope shapes — `project-io.ts` uses `SaveResponse` (tagged `kind: 'Unknown'`), `recent.ts` swallows errors silently, `image-worker.ts` uses `ExportError` with `kind: 'write-error'`. A shared helper would either need to throw (forcing callers to catch and re-shape) or return a generic envelope (forcing callers to translate). Both patterns add boilerplate without removing duplication.
3. Phase 20's `doc-export.ts` will follow `project-io.ts` shape exactly (`SaveResponse`-style envelope returned to renderer via IPC) — direct inline-copy keeps the pattern obvious to future readers.
4. Extraction would cross the existing convention boundary established by Phases 6, 8, and 14 — three precedents. Don't break a 4-precedent pattern for a 5th caller.

**Verbatim copy for `src/main/doc-export.ts`:**

```typescript
async function writeHtmlAtomic(finalPath: string, html: string): Promise<{ ok: true; path: string } | { ok: false; error: { kind: 'Unknown'; message: string } }> {
  const tmpPath = finalPath + '.tmp';
  try {
    await writeFile(tmpPath, html, 'utf8');
  } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: `writeFile tmp failed: ${err instanceof Error ? err.message : String(err)}` } };
  }
  try {
    await rename(tmpPath, finalPath);
  } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: `rename tmp→final failed: ${err instanceof Error ? err.message : String(err)}` } };
  }
  return { ok: true, path: finalPath };
}
```

**Source confirmations:**
- `src/main/project-io.ts:39, 246-271` — full atomic-write block. [VERIFIED]
- `src/main/image-worker.ts:289-304` — Pattern-B prior art. [VERIFIED]
- `src/main/recent.ts:94-95` — silent-fail variant. [VERIFIED]
- `src/main/update-state.ts:143-144` — same pattern. [VERIFIED]

### Pattern 6: `dialog.showSaveDialog` Reuse (D-20)

**What:** Open OS save-file picker with pre-filled `defaultPath`; handle cancel branch.

**When to use:** Any main-side "save as…" affordance that needs the user to pick a target path.

**Verbatim source (`src/main/project-io.ts:166-180`):**

```typescript
const win = BrowserWindow.getFocusedWindow();
const options: Electron.SaveDialogOptions = {
  title: 'Save Spine Texture Manager Project',
  defaultPath: path.join(defaultDir, `${defaultBasename}.stmproj`),
  filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
};
const result = win
  ? await dialog.showSaveDialog(win, options)
  : await dialog.showSaveDialog(options);

if (result.canceled || !result.filePath) {
  return { ok: false, error: { kind: 'Unknown', message: 'Save cancelled' } };
}
```

**Adaptation for HTML export:**

```typescript
const win = BrowserWindow.getFocusedWindow();
// defaultDir per D-20: lastOutDir from session state, fall back to OS Documents
// (matches Phase 8 D-145 lastOutDir semantic — null means "no preference yet").
const defaultDir = lastOutDir ?? app.getPath('documents');
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

**`skeletonBasename` derivation:** `path.basename(skeletonPath, '.json')`. The skeletonPath is in the IPC payload from the renderer (which has `summary.skeletonPath`).

**Source confirmations:**
- `src/main/project-io.ts:147-180` — full Save As IPC handler with dialog. [VERIFIED]

### Pattern 7: `summary.events` Extension (D-09 source)

**What:** Mirror the existing `bones` / `skins` / `animations` field construction in `src/main/summary.ts:113-130`.

**Verbatim source (`src/main/summary.ts:116-130`):**

```typescript
return {
  // ... existing fields ...
  bones: { count: skeletonData.bones.length, names: skeletonData.bones.map((b) => b.name) },
  slots: { count: skeletonData.slots.length },
  attachments: { count: attachmentCount, byType },
  skins: { count: skeletonData.skins.length, names: skeletonData.skins.map((s) => s.name) },
  animations: { count: skeletonData.animations.length, names: skeletonData.animations.map((a) => a.name) },
  // ... ...
};
```

**Phase 20 extension (insert immediately after `animations` field at `summary.ts:128`):**

```typescript
events: {
  count: skeletonData.events.length,
  names: skeletonData.events.map((e) => e.name),
},
```

**`EventData.name` confirmation:**

```
node_modules/@esotericsoftware/spine-core/dist/EventData.d.ts:
  export declare class EventData {
      name: string;
      intValue: number;
      // ... (other fields are runtime-time payload, not identity)
  }
```

`EventData.name` is the canonical identifier in spine-core 4.2 — set at editor-export time, immutable. Mirrors `BoneData.name`, `SkinData.name`, `Animation.name` shape. [VERIFIED: `node_modules/@esotericsoftware/spine-core/dist/EventData.d.ts`]

**`SkeletonData.events` confirmation:**

```
node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56:
  /** The skeleton's events. */
  events: EventData[];
```

[VERIFIED: lines 55-56 of SkeletonData.d.ts]

**`SkeletonSummary` type extension (`src/shared/types.ts:466-506`):**

```typescript
// Insert in SkeletonSummary interface, immediately after the animations field at :476:
events: { count: number; names: string[] };
```

The Phase 19 RESEARCH already established the precedent for "extend SkeletonSummary with a primitive-only field" via `unusedAttachments?` (lines 491). For `events`, mark as REQUIRED (not optional) — Phase 20 extends summary.ts at the same time it extends the type, so there's no Wave-0 typecheck-without-runtime gap.

### Pattern 8: Inline `<style>` HTML Export Template (D-17)

**What:** Self-contained HTML with all CSS in a single inline `<style>` block at the top of the document. No external assets, no Tailwind classes (Tailwind v4 is renderer-only build-time JIT).

**Why this matters:** The HTML file must be openable offline as a stand-alone file:// URL. No Tailwind v4 runtime exists in main.

**LOOP pill class string conversion:**

Renderer-side LOOP pill (Claude's Discretion in CONTEXT.md):
```
inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-blue-500/15 text-blue-400
```

Tailwind v4 token resolution (from `src/renderer/src/index.css:47-71`):
- `inline-flex` → `display: inline-flex`
- `items-center` → `align-items: center`
- `px-1.5` → `padding-left: 0.375rem; padding-right: 0.375rem` (1.5 × 0.25rem = 0.375rem = 6px)
- `py-0.5` → `padding-top: 0.125rem; padding-bottom: 0.125rem` (0.5 × 0.25rem = 0.125rem = 2px)
- `text-[10px]` → `font-size: 10px`
- `font-mono` → `font-family: ui-monospace, SFMono-Regular, …` (or whatever the renderer mono stack is — for export simplicity use `font-family: monospace`)
- `rounded` → `border-radius: 0.25rem` (= 4px)
- `bg-blue-500/15` → `background-color: rgba(59, 130, 246, 0.15)` (Tailwind blue-500 = #3b82f6; /15 = 15% alpha)
- `text-blue-400` → `color: #60a5fa` (Tailwind blue-400)

**Recommended inline CSS (for the LOOP pill specifically):**

```css
.loop-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 10px;
  font-family: monospace;
  border-radius: 4px;
  background-color: rgba(95, 168, 212, 0.15);
  color: #5fa8d4;
}
```

**Note:** Use the LOCKED color palette from D-17 (`#5fa8d4` blue accent), NOT Tailwind's `#60a5fa` `blue-400`. The HTML export's blue is `#5fa8d4` per the user's screenshot; Tailwind palette is irrelevant for the standalone export.

**Suggested base `<style>` template (paste into `renderDocumentationHtml`):**

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
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.card-header svg { color: var(--green); }
.card-header.bones svg { color: var(--terracotta); }
.card-header.skins svg { color: var(--blue); }
.card-header.events svg { color: var(--terracotta); }
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
td { padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
.entry-name { font-family: monospace; color: var(--terracotta); }
.entry-name.skin { color: var(--blue); }
.entry-desc { color: var(--muted); margin-top: 2px; font-size: 12px; }
.notes-pre { white-space: pre-wrap; font-family: inherit; color: var(--muted); margin: 0; }
.config-value { font-family: monospace; font-size: 28px; color: var(--fg); }
.config-label { font-size: 11px; color: var(--muted); margin-top: 4px; }
</style>
</head>
<body>
<!-- hero / chips / cards rendered here -->
</body>
</html>
```

**HTML escaping:** All user-supplied strings (`description`, `notes`, `generalNotes`, `animationName`) MUST be HTML-escaped. Provide a small inline helper:

```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

[ASSUMED] No external HTML escape library is in the project. The 5-replacement helper above is the minimum sufficient. (Confirm by grep; if `escape-html` or `he` is somewhere in node_modules, prefer that.)

### Pattern 9: SVG Glyph Baseline (D-19 — Phase 19 D-08 carry-over)

**What:** Inline SVG with `viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"`. Single-stroke geometry. Inherit color via `currentColor`.

**When to use:** Every icon in both the renderer modal AND the HTML export.

**Verbatim Phase 19 source (`19-UI-SPEC.md:227-261`):**

```html
<!-- Ruler / measure (Phase 19 Global panel) -->
<svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">
  <rect x="2" y="6" width="16" height="8" rx="1"/>
  <path d="M5 6 v3 M8 6 v2 M11 6 v3 M14 6 v2 M17 6 v3"/>
</svg>

<!-- Play / film (Phase 19 Animation Breakdown) -->
<svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">
  <rect x="3" y="3" width="14" height="14" rx="2"/>
  <path d="M9 7 l4 3 -4 3 z"/>
</svg>

<!-- Warning triangle (Phase 19 Unused Assets — REPLACES ⚠) -->
<svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" width="16" height="16">
  <path d="M10 3 L18 16 L2 16 Z"/>
  <path d="M10 8 v4 M10 14.5 v0.01"/>
</svg>
```

**Repo glyph reuse:** The Phase 19 "play/film" glyph (rect + triangle) is exactly the "film-icon" called for in the chip-strip (D-18 "Animations Configured"). REUSE. The "warning triangle" is unused for Phase 20.

**Net-new glyphs needed for Phase 20 (11 total per D-18 + D-19):**

| Section | Glyph | viewBox-20 path (suggested — hand-tunable) |
|---------|-------|---------------------------------------------|
| Tracks card header (also chip strip "Generated") | clock | `<circle cx="10" cy="10" r="7"/><path d="M10 6 v4 l3 2"/>` |
| Control bones card header | bone | `<path d="M5 8 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 v4 a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 z"/><circle cx="6" cy="6" r="1.5"/><circle cx="14" cy="6" r="1.5"/><circle cx="6" cy="14" r="1.5"/><circle cx="14" cy="14" r="1.5"/>` |
| Skins card header | layered-stack | `<path d="M2 6 l8 -3 8 3 -8 3 z"/><path d="M2 10 l8 3 8 -3"/><path d="M2 14 l8 3 8 -3"/>` |
| Optimization Config card header | shield | `<path d="M10 3 L4 5 v5 c0 4 3 6 6 7 3 -1 6 -3 6 -7 V5 z"/>` |
| General Notes card header | speech-bubble | `<path d="M3 4 h14 v9 h-7 l-4 3 v-3 H3 z"/>` |
| Events card header | bell | `<path d="M5 13 v-3 a5 5 0 0 1 10 0 v3 l1 2 H4 z"/><path d="M8 16 a2 2 0 0 0 4 0"/>` |
| Chip "Images Utilized" | image | `<rect x="2" y="3" width="16" height="14" rx="1"/><circle cx="7" cy="8" r="1.5"/><path d="M2 14 l4 -4 4 3 4 -5 4 4 v5"/>` |
| Chip "Animations Configured" | film | (REUSE Phase 19 play/film glyph above) |
| Chip "Optimized Assets" | lightning | `<path d="M11 2 L4 11 h5 l-2 7 7 -9 h-5 z"/>` |
| Chip "Atlas Pages" | map | `<path d="M2 5 l5 -2 6 2 5 -2 v12 l-5 2 -6 -2 -5 2 z"/><path d="M7 3 v14 M13 5 v14"/>` |
| Hero "doc-icon" (top-left) | doc | `<path d="M5 2 h7 l3 3 v13 H5 z"/><path d="M12 2 v3 h3"/>` |

**[ASSUMED]** These glyph paths are reasonable approximations matching the Phase 19 D-08 visual style (single-stroke, 20×20 viewBox, simple geometry). The user's screenshot reference is the LOCKED visual; if a hand-tune is needed at implementation time, the planner should mark these as Claude's Discretion variants. Rationale for [ASSUMED]: glyph paths are not "verifiable" in the same way as APIs — they're design choices. The pattern (viewBox + currentColor + stroke-only) IS verified.

**Source confirmations:**
- `.planning/phases/19-ui-improvements-ui-01-05/19-UI-SPEC.md:227-261` — 3 verbatim SVG bodies. [VERIFIED]
- `.planning/phases/19-ui-improvements-ui-01-05/19-PATTERNS.md:944-962` — pattern wrapper. [VERIFIED]

### Anti-Patterns to Avoid

- **DO NOT** use `react-dnd`, `@dnd-kit`, or any DnD library. D-06 locks HTML5 native; adding a dep is wasted bytes + bundle bloat.
- **DO NOT** use `uuid` package. `crypto.randomUUID()` is native (D-02).
- **DO NOT** use Tailwind classes inside the HTML export `<style>` block. Tailwind v4 is renderer-only build; main has no JIT. [LOCKED: Claude's Discretion in CONTEXT.md]
- **DO NOT** add a 9th `SerializableError` kind for malformed documentation. Reuse `'ProjectFileParseError'` envelope (D-04 + `src/shared/types.ts:555`).
- **DO NOT** bump the schema to v2. D-148 reserved the slot specifically so v1 could expand without a migration. [LOCKED: D-148 + D-01]
- **DO NOT** add markdown rendering for `generalNotes`. D-12 = plain text only. Use `<pre style="white-space: pre-wrap">` so newlines + tabs preserve.
- **DO NOT** write to `documentation: object` literal at `src/core/project-file.ts:254` anymore. Replace with `documentation: state.documentation` (D-01 LOCKED).
- **DO NOT** use `import * as fs from 'node:fs'` in `src/core/documentation.ts`. arch.spec.ts hygiene gate (`tests/arch.spec.ts:116-134`) bans `node:fs` from `src/core/*`. Use `node:fs/promises` only in `src/main/doc-export.ts`. [LOCKED: CLAUDE.md fact #5]
- **DO NOT** put `<img>` tags or `<link rel="stylesheet">` in the HTML export. D-17 = self-contained.
- **DO NOT** add a doc-modal-local dirty guard. Leverage existing Phase 8 dirty-guard at AppShell level. [LOCKED: Claude's Discretion in CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random-string | `crypto.randomUUID()` | Native in Electron 41 (Chromium ~134) + Node ≥18; cryptographically strong; standard format |
| HTML escaping | Regex over arbitrary chars | The 5-char `&<>"'` replacement helper above (or `escape-html` if a dep is acceptable) | Standard set; proven correct; ~6 lines |
| Date formatting | Locale-aware `Intl.DateTimeFormat` for one format | Inline `Date` + `padStart` to produce `DD/MM/YYYY` | One format only; no locale variation; ~3 lines |
| Schema validation | Zod / Yup / Ajv | Hand-rolled per-field guards (D-04 LOCKED) | Project precedent (Phase 8 D-156); arch.spec.ts hygiene bans schema libraries from core |
| DnD library | react-dnd / dnd-kit | HTML5 native (D-06 LOCKED) | One DnD surface in entire app; library overhead unjustified |
| Modal/dialog framework | Radix / Headless UI | Hand-rolled with `useFocusTrap` (D-14 LOCKED) | 9 existing modals all hand-rolled; consistency |
| ARIA tab strip | `react-tabs` / Radix Tabs | `<nav role="tablist">` + `<TabButton>` (D-13 LOCKED — Phase 19 prior art) | Phase 19 prior art; no dep needed |
| Atomic file write | `write-file-atomic` | Inline `<path>.tmp` + `rename` (D-20 LOCKED — Pattern-B) | 4-precedent inline pattern |

**Key insight:** Phase 20 introduces ZERO new dependencies. All "could-hand-roll" decisions point at existing patterns from Phases 4, 6, 8, and 19. The discipline is reuse, not invention.

## Common Pitfalls

### Pitfall 1: Forgetting `e.preventDefault()` in `onDragOver`
**What goes wrong:** `onDrop` never fires; the drop is silently rejected by the browser.
**Why it happens:** HTML5 spec requires explicit consent to allow a drop on a target via `preventDefault` in dragover. Standard gotcha for first-time DnD wire-ups.
**How to avoid:** Always include `e.preventDefault()` AS THE FIRST LINE of every `onDragOver` handler.
**Warning signs:** Drag works (drag-image renders, source's onDragStart fires), but releasing over the target does nothing — no console error, no callback.

### Pitfall 2: `effectAllowed` not set on Electron Chromium dragstart
**What goes wrong:** Drag image renders inconsistently — macOS shows the dotted-rect placeholder, Windows shows nothing or the wrong icon, Linux varies.
**Why it happens:** Electron Chromium has stricter defaults than browser Chrome for cross-window drag effects; without an explicit `effectAllowed`, the OS-level drag system gets ambiguous data.
**How to avoid:** Set `e.dataTransfer.effectAllowed = 'copy'` in `onDragStart` BEFORE `setData`. (D-06 hint LOCKED in CONTEXT.md.)
**Warning signs:** Inconsistent visual feedback across OSes during manual QA.

### Pitfall 3: MIME-type collision with file-drop pathway
**What goes wrong:** Drag-and-drop conflicts with the existing DropZone (which handles `dataTransfer.types.includes('Files')` to load skeleton JSON).
**Why it happens:** Both pathways listen for drop events on the renderer DOM. Without a namespaced MIME type, the Documentation drag could be misinterpreted as a file drop or vice versa.
**How to avoid:** Use `'application/x-stm-anim'` MIME type (per D-06). The DropZone wrapper already filters on `'Files'`. Verify by checking `e.dataTransfer.types.includes('Files')` — if true, it's a file drop; if false but `getData('application/x-stm-anim')` returns non-empty, it's an animation drag.
**Warning signs:** Dragging from the side list spuriously triggers DropZone load attempts.

### Pitfall 4: Stale documentation slot after skeleton change (drift)
**What goes wrong:** User opens project A (with documentation referencing event "shoot"); switches to project B which has no "shoot" event; the saved doc still has a "shoot" entry that points to nothing.
**Why it happens:** Without intersection on reload (D-09 / D-10 / D-11 drift policy), stale entries persist forever.
**How to avoid:** On `materializeProjectFile`, INTERSECT each per-name entry list with the current skeleton's name list:
- `events`: intersect with `summary.events.names`. New names → add empty description; missing names → drop silently.
- `controlBones`: intersect with `summary.bones.names`. Drop missing-from-skeleton.
- `skins`: intersect with `summary.skins.names`. New names → add empty description; missing names → drop silently.
- `animationTracks`: each entry's `animationName` checked against `summary.animations.names`. Missing names → drop the entry silently.

This intersection happens **renderer-side** (in the AppShell after the materialized project arrives) — not in `materializeProjectFile` (which is Layer 3 pure-TS and doesn't know about the live skeleton's summary). The renderer has access to both `restoredOverrides` (the saved documentation slot, accessed via `materialized.documentation`) AND `summary.events.names` etc. Mirrors how Phase 8 D-150 dropped stale overrides at the same boundary.

**Warning signs:** HTML export shows entries for events/bones/skins/animations that no longer exist in the skeleton.

### Pitfall 5: `crypto.randomUUID()` not available (false alarm)
**What goes wrong:** `crypto.randomUUID is not a function` exception.
**Why it happens (or doesn't):** `crypto.randomUUID()` requires Chromium ≥92 (May 2021) and Node ≥14.17 / ≥15.6 (March 2021). Electron 41.3.0 is on Chromium ~134. Node target is ≥18 (per `package.json:54`). Both vastly exceed the requirement.
**How to avoid:** No polyfill needed. **CONFIRMED zero polyfill required for Electron 41 + Node 18+.** [VERIFIED: package.json:44 + package.json:54]
**Warning signs:** Would only fail on a sub-Electron-15 fork — irrelevant.

### Pitfall 6: structuredClone failure on `Documentation` payload
**What goes wrong:** IPC payload silently corrupts (Maps become `{}`, class instances lose prototypes).
**Why it happens:** Electron's IPC uses structured-clone serialization. Any non-cloneable type (Map, Set, Date with timezone, Function, class instance, Symbol) breaks silently.
**How to avoid:** The locked `Documentation` shape has only primitives + arrays + plain objects:
- `string`, `number`, `boolean` — all primitives ✓
- `string[]`, plain object arrays ✓
- `crypto.randomUUID()` returns `string` ✓
**Warning signs:** None at compile time; only at runtime when IPC strips fields.

### Pitfall 7: Tailwind v4 literal-class scanner missing classes (Pitfall 8 from Phase 19)
**What goes wrong:** Tailwind v4 statically scans source files for class strings; programmatic class composition (template literals, runtime concatenation) is INVISIBLE to the scanner — those classes don't get emitted to the bundle.
**Why it happens:** Tailwind v4's JIT operates on literal strings only.
**How to avoid:** Every `className=` in `DocumentationBuilderDialog.tsx` is a string literal or `clsx` with literal branches. Phase 19 PATTERNS doc enforces this. **The HTML export's inline `<style>` is NOT subject to this** — it's a static string in main.
**Warning signs:** A class works in dev (Vite dev server), breaks in production build because the scanner missed it.

### Pitfall 8: Round-trip date stamp instability in golden-file test
**What goes wrong:** `tests/main/doc-export.spec.ts` golden-file test fails on every CI run because the HTML embeds a wall-clock date that changes every day.
**Why it happens:** D-18 specifies "Generated: DD/MM/YYYY" chip with the export-time date.
**How to avoid:** Inject the date as a parameter to `renderDocumentationHtml(payload, generatedAt)` — golden test passes a fixed `new Date('2026-04-14')`. Production caller passes `new Date()`. OR: stub `Date.now()` in the test setup with `vi.useFakeTimers({ now: 1744588800000 /* 2026-04-14 */ })`. **Recommendation: inject the date.** Pure-function discipline > timer mocking.

### Pitfall 9: Documentation slot empty-default mismatch (D-03 contract)
**What goes wrong:** Old `.stmproj` files written by Phase 8 have `documentation: {}` (empty object); after the validator extension lands, those files fail to load with `'invalid-shape'` because the new validator requires all 6 keys.
**Why it happens:** D-03 requires all 6 keys always present. Old files have `{}`.
**How to avoid:** In `materializeProjectFile` (or before it — at the validator boundary), apply a **back-fill default** for missing-but-defaulted fields. Two options:
- **Option A (preferred):** Modify `materializeProjectFile` at `src/core/project-file.ts:335` to apply `{ ...DEFAULT_DOCUMENTATION, ...file.documentation }` so old `{}` becomes the full empty-default shape on load. No validator change needed; old files continue loading.
- **Option B:** Pre-validate-massage in `validateProjectFile` — if `documentation` is `{}`, replace with `DEFAULT_DOCUMENTATION` before the per-field guard runs. More fragile (validator becomes lossy).
**Recommendation:** Option A. The validator stays strict (rejects malformed shapes); the materializer applies a forward-compat default for the empty-slot case. Document this in the materializer's docblock.
**Warning signs:** "AtlasNotFoundError" or "ProjectFileParseError" on Phase 8-era `.stmproj` files post-Phase-20.

### Pitfall 10: Modal width too wide on small displays
**What goes wrong:** Modal at `min-w-[960px]` cannot fit on a 1280×720 laptop after window chrome + browser padding.
**Why it happens:** D-15 sets `min-w-[960px] max-w-[1100px]`. On a 1280px display with default Electron chrome, usable width is ~1240px — 960 fits, but the modal looks oversized.
**How to avoid:** Test on 1280×720 viewport before merging. The `max-w-[1100px]` is sized for comfortable use on 1440+ displays; the `min-w-[960px]` is the floor below which the side-list + track-container layout breaks. If 960 doesn't fit (say, on a 1024px display), the dialog will horizontal-scroll — acceptable per D-15. [LOCKED: D-15]
**Warning signs:** Manual QA on small laptops shows horizontal scroll inside the modal.

### Pitfall 11: Layer 3 leak — importing `node:fs` or `electron` in `src/core/documentation.ts`
**What goes wrong:** `tests/arch.spec.ts:116-134` grep gate fails; CI red.
**Why it happens:** It's tempting to add a "load default documentation from disk" or "log to electron console" helper.
**How to avoid:** `src/core/documentation.ts` MUST be pure-TS. Imports allowed: `node:path` (per Phase 8 precedent), type-only from `'../shared/types.js'`. NOTHING ELSE.
**Warning signs:** `npm test` red on the arch.spec.

## Code Examples

Verified patterns from official sources:

### `validateProjectFile` extension call (insert in `src/core/project-file.ts:144`)
```typescript
// Source: src/core/project-file.ts:135-144 (existing) + new validator call.
import { validateDocumentation } from './documentation.js';

// ... existing validateProjectFile body up to :144 ...
if (!obj.documentation || typeof obj.documentation !== 'object' || Array.isArray(obj.documentation)) {
  return { ok: false, error: { kind: 'invalid-shape', message: 'documentation is not an object' } };
}
// NEW (Phase 20 D-04):
const docResult = validateDocumentation(obj.documentation);
if (!docResult.ok) {
  return { ok: false, error: docResult.error };
}
```

### `serializeProjectFile` extension (replace `src/core/project-file.ts:254`)
```typescript
// Source: src/core/project-file.ts:254 (existing literal `{}`).
// BEFORE:
//   documentation: {}, // D-148 reserved slot
// AFTER (Phase 20 D-01):
documentation: state.documentation,
```

### `materializeProjectFile` extension (replace `src/core/project-file.ts:335`)
```typescript
// Source: src/core/project-file.ts:335 (existing passthrough).
// BEFORE:
//   documentation: file.documentation,
// AFTER (Phase 20 Pitfall 9 — forward-compat default for old {} slots):
import { DEFAULT_DOCUMENTATION } from './documentation.js';
// ...
documentation: { ...DEFAULT_DOCUMENTATION, ...file.documentation },
```

### `summary.events` extension (insert in `src/main/summary.ts:128`)
```typescript
// Source: src/main/summary.ts:122-129 (existing skins/animations construction).
// AFTER `animations: {…}` and BEFORE `peaks: peaksArray,`:
events: {
  count: skeletonData.events.length,
  names: skeletonData.events.map((e) => e.name),
},
```

### `AppSessionState` builder extension (modify `src/renderer/src/components/AppShell.tsx:578-597`)
```typescript
// Source: src/renderer/src/components/AppShell.tsx:578-597 (existing buildSessionState).
const buildSessionState = useCallback(
  (): AppSessionState => ({
    skeletonPath: summary.skeletonPath,
    atlasPath: summary.atlasPath ?? null,
    imagesDir: null,
    overrides: Object.fromEntries(overrides),
    samplingHz: samplingHzLocal,
    lastOutDir: null,
    sortColumn: 'attachmentName',
    sortDir: 'asc',
    documentation,  // NEW (Phase 20 D-01) — drives serializeProjectFile :254
  }),
  [summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal, documentation],
);
```

### IPC handler skeleton (`src/main/doc-export.ts`)
```typescript
// Source: src/main/project-io.ts:147-208 + src/main/doc-export.ts (NEW).
import { writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app, dialog, BrowserWindow } from 'electron';
import type { Documentation } from '../core/documentation.js';
import type { SkeletonSummary, AtlasPreviewProjection } from '../shared/types.js';

export interface DocExportPayload {
  documentation: Documentation;
  summary: SkeletonSummary;
  atlasPreview: AtlasPreviewProjection;
  exportPlanSavingsPct: number | null; // pre-computed by renderer (avoids re-importing buildExportPlan in main)
  skeletonBasename: string;
  lastOutDir: string | null;
  generatedAt: number; // ms epoch — renderer passes Date.now(); test injects fixed date
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
  const html = renderDocumentationHtml(payload);
  return writeHtmlAtomic(result.filePath, html);
}

export function renderDocumentationHtml(payload: DocExportPayload): string {
  // template-literal-driven HTML; pure function; no I/O.
  // ... uses inline <style> per Pattern 8 + glyphs per Pattern 9 + escapeHtml.
  return `<!DOCTYPE html>...`;
}

async function writeHtmlAtomic(finalPath: string, html: string): Promise<DocExportResponse> {
  // Verbatim Pattern-B (Pattern 5 above).
  const tmpPath = finalPath + '.tmp';
  try { await writeFile(tmpPath, html, 'utf8'); } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: `writeFile tmp failed: ${err instanceof Error ? err.message : String(err)}` } };
  }
  try { await rename(tmpPath, finalPath); } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: `rename tmp→final failed: ${err instanceof Error ? err.message : String(err)}` } };
  }
  return { ok: true, path: finalPath };
}
```

### IPC channel registration (`src/main/ipc.ts`)
```typescript
// Source: src/main/ipc.ts:881 (existing project:save pattern).
// In registerIpcHandlers(), add alongside the project:* handlers:
ipcMain.handle('documentation:exportHtml', async (_evt, payload) =>
  handleExportDocumentationHtml(payload as DocExportPayload),
);
```

### Preload bridge (`src/preload/index.ts`)
```typescript
// Source: src/preload/index.ts:78-80 (existing pickOutputDirectory pattern).
// In the `api` const object, add:
exportDocumentationHtml: (payload: DocExportPayload): Promise<DocExportResponse> =>
  ipcRenderer.invoke('documentation:exportHtml', payload),
```

### `Api` interface extension (`src/shared/types.ts`)
```typescript
// Source: src/shared/types.ts:807-810 (existing project:* IPC bridge methods).
// In the Api interface, add:
exportDocumentationHtml: (payload: DocExportPayload) => Promise<DocExportResponse>;
```

### Click-time payload assembly (renderer-side)
```typescript
// In DocumentationBuilderDialog's Export pane handler:
const onClickExport = async () => {
  const skeletonBasename = path.basename(props.summary.skeletonPath, '.json');
  // savingsPct from existing OptimizeDialog formula (D-18 step 3); compute
  // identically here OR pass through prop from AppShell which can derive
  // from buildExportPlan(summary, overrides). Recommendation: prop-drill
  // savingsPct in via DocumentationBuilderDialogProps so the modal stays
  // free of math imports.
  const payload: DocExportPayload = {
    documentation: props.documentation,
    summary: props.summary,
    atlasPreview: props.atlasPreview, // computed by AppShell once + threaded in
    exportPlanSavingsPct: props.savingsPct,
    skeletonBasename,
    lastOutDir: props.lastOutDir,
    generatedAt: Date.now(),
  };
  const resp = await window.api.exportDocumentationHtml(payload);
  if (resp.ok) {
    // Surface success — could open Finder/Explorer, or just log + close.
  } else {
    // Surface error — reuse existing error-banner pattern.
  }
};
```

**structuredClone-safety check for `DocExportPayload`:**
- `Documentation`: primitives + arrays + plain objects ✓
- `SkeletonSummary`: already structuredClone-safe (Phase 1 D-21 lock) ✓
- `AtlasPreviewProjection`: already structuredClone-safe (Phase 7 D-21 lock at types.ts:391-394) ✓
- `number | null` fields ✓
- `string` fields ✓

[VERIFIED: shape-by-shape walkthrough against `src/shared/types.ts:7-15` docblock.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `uuid` npm package for UUIDs | `crypto.randomUUID()` native | Chrome 92 (May 2021) / Node 14.17+ | Zero-dep UUID generation |
| `react-dnd` for drag-drop | HTML5 native DnD via React synthetic events | React 17+ (event pooling removed) | No DnD library needed for simple drag surfaces |
| `dompurify` for HTML escaping | Inline 5-char replacement (when no markdown is involved) | Always (D-12 plain-text) | Tiny helper, no XSS surface for trusted user-generated text in offline HTML |
| External CSS files in HTML export | Inline `<style>` block | Self-contained-export pattern (always best practice) | Single-file, file:// portable |
| Schema validation libraries (zod/yup/ajv) | Hand-rolled per-field guards (D-156 Phase 8 lock) | Phase 8 (April 2026) | Zero dep weight; explicit error messages |

**Deprecated/outdated:**
- React's "must use ref-attached native handlers for DnD" guidance — that was for React 16's pooled events. React 17+ (and 19) have unpooled synthetic events; standard `onDragStart`/`onDrop` work as expected.
- `dataTransfer.types` returning `DOMStringList` — modern browsers (Chromium 92+, Electron 41 included) return `string[]`. Phase 20 uses `getData('application/x-stm-anim')` directly; doesn't enumerate types.

## Project Constraints (from CLAUDE.md)

| Directive | Phase 20 Compliance |
|-----------|---------------------|
| **Fact #1:** Spine animations stored in seconds, not frames; `skeleton.fps` is editor metadata | Phase 20 surfaces `mixTime` as **seconds** (D-02, default 0.25). NEVER convert to frames. |
| **Fact #2:** `computeWorldVertices` after `updateWorldTransform(Physics.update)` handles bone chain + slot scale + IK + constraints + DeformTimelines. Don't reimplement | Phase 20 doesn't touch sampler math. ✓ |
| **Fact #3:** Sampler lifecycle = `state.update → state.apply → skeleton.update → updateWorldTransform`. Must be in order every tick | Phase 20 doesn't touch sampler. ✓ |
| **Fact #4:** Math phase does not decode PNGs. Stub `TextureLoader` from `.atlas` metadata | Phase 20 HTML export ALSO does not decode PNGs (text + inline SVG only per D-19). ✓ |
| **Fact #5:** `core/` is pure TypeScript, no DOM | `src/core/documentation.ts` has zero DOM imports; arch.spec.ts gate enforces. ✓ |
| **Fact #6:** Default sampler rate 120 Hz | Irrelevant — Phase 20 doesn't touch sampling. ✓ |
| **Release tag conventions:** Prerelease tags MUST use dot-separated number suffixes (`v1.2.0-rc.1` not `v1.2.0-rc1`) | Irrelevant for Phase 20 source. Future v1.2 releases handled by existing electron-updater config. ✓ |
| **GSD workflow:** Phases execute strictly in order — do not skip ahead | Phase 20 follows Phase 19 (already complete per STATE.md); next in order. ✓ |

## Runtime State Inventory

> Phase 20 is a net-new feature, not a rename/refactor — runtime state inventory is largely vacuous, but the documentation slot semantics on existing `.stmproj` files DO require explicit handling.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `.stmproj` files written by Phase 8 era have `documentation: {}` (empty object) at the slot. Test fixture: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.stmproj` | **Code edit (forward-compat default in materializeProjectFile)** — see Pitfall 9 Option A. The materializer applies `{ ...DEFAULT_DOCUMENTATION, ...file.documentation }` so old `{}` becomes the empty 6-key shape on load. NO data migration needed; old files continue loading. |
| Live service config | None — Phase 20 doesn't interact with external services | None |
| OS-registered state | None — no Task Scheduler / launchd / pm2 / systemd entries are affected | None |
| Secrets/env vars | None | None |
| Build artifacts | None — TypeScript compilation is incremental; no installed packages or compiled binaries embed the documentation slot literal | None |

**Verified:** grep for `documentation:` across `.stmproj` files in `fixtures/` returns the existing `documentation: {}` literal in `SIMPLE_TEST.stmproj`. The forward-compat default in `materializeProjectFile` (Pitfall 9) covers this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | Renderer + main runtime | ✓ | 41.3.0 (verified `node_modules/electron/package.json:2`) | — |
| Node.js | Build + tests | ✓ | ≥18 (per `package.json:54`) | — |
| `crypto.randomUUID` | D-02 entry IDs | ✓ | Native in Electron 41 (Chromium ~134 ≥ ≥92) + Node ≥18 | None needed |
| `dialog.showSaveDialog` | HTML export save (D-20) | ✓ | Electron 41 stable API | — |
| `node:fs/promises` | Atomic write (D-20) | ✓ | Node ≥18 | — |
| `@esotericsoftware/spine-core` | `EventData` type (D-09) | ✓ | 4.2.0 (verified `package.json:24`) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

**Conclusion:** Phase 20 has zero external blockers. All required runtime + library dependencies are already present in the project's locked toolchain.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.0 (verified `package.json:51`) |
| Config file | `vitest.config.ts` (renderer JSDOM env) + `tests/` directory layout follows `tests/{core,main,renderer,integration,preload}/<name>.spec.ts` |
| Quick run command | `npm run test -- --run --reporter=dot tests/core/documentation.spec.ts tests/core/documentation-roundtrip.spec.ts tests/main/doc-export.spec.ts` |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **DOC-01** | Modal opens from top-bar Documentation button; ARIA scaffold complete; ESC closes | renderer integration | `npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx` | ❌ Wave 0 |
| **DOC-01** | Tab strip switches panes; `aria-selected` discipline correct; focus trap honors tab buttons | renderer integration | (same file) | ❌ Wave 0 |
| **DOC-02** | Drag from side list to track container appends entry with `crypto.randomUUID()` id | renderer integration | (same file; uses `@testing-library/user-event` DnD synthetic events) | ❌ Wave 0 |
| **DOC-02** | Same animation can appear multiple times per D-08 | renderer integration | (same file) | ❌ Wave 0 |
| **DOC-02** | ↑/↓ reorder swaps within track only; disabled at edges per D-07 | renderer integration | (same file) | ❌ Wave 0 |
| **DOC-03** | Events auto-discovered from `summary.events.names`; user description per event persists | renderer integration | (same file) | ❌ Wave 0 |
| **DOC-03** | Control bones list filters via debounced 100ms substring match | renderer integration | (same file) | ❌ Wave 0 |
| **DOC-03** | Skins list always shows all skins (even with empty descriptions) per D-11 | renderer integration | (same file) | ❌ Wave 0 |
| **DOC-04** | `renderDocumentationHtml(payload)` produces deterministic HTML; golden-file test | unit (main) | `npm run test -- tests/main/doc-export.spec.ts` | ❌ Wave 0 |
| **DOC-04** | HTML is self-contained (no `<img src>`, no `<link rel="stylesheet">`, no external `<script src>`) | unit (main) | (same file; assertions on output string) | ❌ Wave 0 |
| **DOC-04** | Filename pre-fill = `<skeletonBasename>.html`; uses `lastOutDir` + falls back to OS Documents | unit (main, mocked dialog) | (same file) | ❌ Wave 0 |
| **DOC-04** | Atomic write succeeds; orphan `.tmp` cleanup not required (Pattern-B) | integration | `npm run test -- tests/integration/doc-export-atomic-write.spec.ts` (optional — main covers via Pattern-B inheritance) | ❌ Wave 0 |
| **DOC-05** | `validateDocumentation` accepts well-formed + rejects malformed (per-field guards) | unit (core) | `npm run test -- tests/core/documentation.spec.ts` | ❌ Wave 0 |
| **DOC-05** | Round-trip: serialize → JSON.stringify → JSON.parse → validate → materialize → bit-equal | unit (core) | `npm run test -- tests/core/documentation-roundtrip.spec.ts` | ❌ Wave 0 |
| **DOC-05** | Old `.stmproj` with empty `documentation: {}` loads with empty defaults applied (Pitfall 9 forward-compat) | unit (core) | (same file) | ❌ Wave 0 |
| **DOC-05** | `validateProjectFile` rejects malformed documentation with `kind: 'invalid-shape'` (no 9th error kind) | unit (core) | `npm run test -- tests/core/project-file.spec.ts` (extend existing) | ✓ extend |

### Sampling Rate
- **Per task commit:** `npm run test -- --run --reporter=dot tests/core/documentation.spec.ts tests/core/documentation-roundtrip.spec.ts` (~3-5s)
- **Per wave merge:** `npm run test -- --run tests/core tests/main` (~30s)
- **Phase gate:** Full suite green (`npm run test` ≈ ~60s) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/core/documentation.spec.ts` — covers DOC-05 validator surface; per-field rejection tests; accept/reject minimum + max + edge shapes (empty arrays, max-length notes).
- [ ] `tests/core/documentation-roundtrip.spec.ts` — covers DOC-05 bit-equal round-trip via `serialize → JSON.parse → validate → materialize` chain on representative + edge payloads.
- [ ] `tests/main/doc-export.spec.ts` — covers DOC-04 golden-file HTML output; injected `generatedAt` for deterministic dates; assertions on self-contained-ness (regex for forbidden tags).
- [ ] `tests/renderer/documentation-builder-dialog.spec.tsx` — covers DOC-01/02/03 via `@testing-library/react` + `user-event` synthetic DnD; verifies modal lifecycle + tab switching + DnD round-trip + bone-list filter + skin/event auto-list.
- [ ] (Optional) `tests/integration/doc-export-atomic-write.spec.ts` — full save-dialog-stubbed atomic write; only needed if golden-file unit doesn't cover the file-IO branch sufficiently. Pattern-B is shared with project-io which has full integration coverage at `tests/main/project-io.spec.ts`.
- [ ] Framework install: NONE — vitest 4.0.0 + @testing-library/react 16.3.2 already in `package.json`.

### Round-Trip Test Surface (DOC-05) — Recommended Setup

```typescript
// tests/core/documentation-roundtrip.spec.ts
import { describe, expect, it } from 'vitest';
import {
  serializeProjectFile,
  validateProjectFile,
  materializeProjectFile,
} from '../../src/core/project-file.js';
import type { Documentation, AnimationTrackEntry } from '../../src/core/documentation.js';
import type { AppSessionState } from '../../src/shared/types.js';

const SIMPLE_TEST_PATH = '/path/to/SIMPLE_TEST.json'; // fixture-relative

const REPRESENTATIVE_DOC: Documentation = {
  animationTracks: [
    { id: 'uuid-1', trackIndex: 0, animationName: 'PATH', mixTime: 0.25, loop: true, notes: 'Primary loop' },
    { id: 'uuid-2', trackIndex: 1, animationName: 'PATH', mixTime: 0.5, loop: false, notes: '' },
  ],
  events: [{ name: 'shoot', description: 'Fires when ammo expended' }],
  generalNotes: 'Multi-line\nnotes\nhere.',
  controlBones: [{ name: 'CHAIN_2', description: 'Spine root' }],
  skins: [{ name: 'default', description: 'The default skin' }],
  safetyBufferPercent: 5,
};

const EMPTY_DOC: Documentation = {
  animationTracks: [], events: [], generalNotes: '', controlBones: [], skins: [], safetyBufferPercent: 0,
};

describe('documentation slot round-trip (DOC-05)', () => {
  it('representative documentation survives serialize → JSON.parse → validate → materialize bit-equal', () => {
    const state: AppSessionState = {
      skeletonPath: SIMPLE_TEST_PATH, atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: null, lastOutDir: null,
      sortColumn: null, sortDir: null,
      documentation: REPRESENTATIVE_DOC,
    };
    const file = serializeProjectFile(state, '/tmp/test.stmproj');
    const json = JSON.stringify(file);
    const parsed = JSON.parse(json);
    const v = validateProjectFile(parsed);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const mat = materializeProjectFile(v.project, '/tmp/test.stmproj');
    expect(mat.documentation).toEqual(REPRESENTATIVE_DOC);
  });

  it('empty documentation round-trips bit-equal', () => { /* same shape, EMPTY_DOC */ });

  it('old .stmproj with empty `documentation: {}` materializes with defaults applied (Pitfall 9 forward-compat)', () => {
    // Simulate Phase 8-era file:
    const oldFile = {
      version: 1, skeletonPath: 'x.json', atlasPath: null, imagesDir: null,
      overrides: {}, samplingHz: null, lastOutDir: null, sortColumn: null, sortDir: null,
      documentation: {}, // Phase 8 literal
    };
    // Validator currently accepts the shape (empty object passes object check).
    // After Phase 20: empty documentation MUST be back-filled to DEFAULT_DOCUMENTATION
    // OR the validator must be tolerant of the empty {} shape.
    // Recommended: materializeProjectFile applies the spread default.
    // ... assert mat.documentation === EMPTY_DOC.
  });
});
```

**Edge cases to cover:**
- Empty arrays in all 3 array fields (events / controlBones / skins / animationTracks).
- All-fields-empty payload.
- `safetyBufferPercent` boundary values: 0, 100, 50.5, 0.5.
- `safetyBufferPercent` rejection: -1, 101, NaN, Infinity, "1" (string).
- Drift cases per D-09/D-10/D-11: an event/bone/skin/animation that no longer exists in the skeleton (handled in renderer at materialize time, not by validator).
- `id` collision (multiple entries with same UUID — should be tolerated; uniqueness is renderer-side responsibility).
- Long `generalNotes` (>10K chars).

### Golden-File HTML Test Setup (DOC-04)

**Recommendation: snapshot-style with `vitest`'s `expect(html).toMatchSnapshot()` BUT pretty-printed.** Reasons:
1. Pretty-printed HTML is human-readable in code review when the golden file changes.
2. `toMatchSnapshot` makes regeneration trivial via `vitest --update`.
3. Date-stamp is injected (Pitfall 8) so the snapshot is deterministic.

```typescript
// tests/main/doc-export.spec.ts
import { describe, expect, it } from 'vitest';
import { renderDocumentationHtml } from '../../src/main/doc-export.js';
import type { DocExportPayload } from '../../src/main/doc-export.js';

const FIXED_GENERATED_AT = new Date('2026-04-14T12:00:00Z').getTime();

const PAYLOAD: DocExportPayload = {
  documentation: { /* representative doc */ },
  summary: { /* SIMPLE_TEST-derived */ },
  atlasPreview: { /* 1-page mock */ totalPages: 1, pages: [{ width: 2048, height: 2048, /* ... */ }] },
  exportPlanSavingsPct: 91.7,
  skeletonBasename: 'SIMPLE_TEST',
  lastOutDir: null,
  generatedAt: FIXED_GENERATED_AT,
};

describe('renderDocumentationHtml (DOC-04)', () => {
  it('produces deterministic snapshot for representative payload', () => {
    expect(renderDocumentationHtml(PAYLOAD)).toMatchSnapshot();
  });

  it('output is self-contained — no <img src>, no <link rel="stylesheet">, no <script src>', () => {
    const html = renderDocumentationHtml(PAYLOAD);
    expect(html).not.toMatch(/<img\s/);
    expect(html).not.toMatch(/<link\s+rel=["']stylesheet["']/);
    expect(html).not.toMatch(/<script\s+src=/);
    expect(html).not.toMatch(/url\(['"]?https?:/);
  });

  it('chip strip uses DD/MM/YYYY format', () => {
    const html = renderDocumentationHtml(PAYLOAD);
    expect(html).toMatch(/Generated:\s*14\/04\/2026/);
  });

  it('LOOP pill rendered for animations with loop=true', () => {
    const html = renderDocumentationHtml(PAYLOAD);
    expect(html).toMatch(/class="loop-pill"/);
  });

  it('events card omitted when documentation.events.length === 0', () => {
    const html = renderDocumentationHtml({ ...PAYLOAD, documentation: { ...PAYLOAD.documentation, events: [] } });
    expect(html).not.toMatch(/events-card/); // assuming class hook
  });
});
```

**Snapshot file location:** `tests/main/__snapshots__/doc-export.spec.ts.snap` (vitest default).

## Security Domain

> `security_enforcement` is implicitly enabled (no explicit disable in config); applicable categories below.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | NO | Desktop app; no user accounts |
| V3 Session Management | NO | Single-user local desktop |
| V4 Access Control | NO | No multi-user concerns |
| V5 Input Validation | YES | Hand-rolled per-field guard pattern (D-04 LOCKED) — `validateDocumentation` rejects all malformed shapes at the IPC boundary |
| V6 Cryptography | YES | `crypto.randomUUID()` is the standard cryptographically-strong UUID generator; never roll your own |
| V7 Error Handling | YES | Reuse `'ProjectFileParseError'` envelope; never leak stack traces (T-01-02-02 mitigation already in place) |
| V8 Data Protection | YES (limited) | HTML export contains user-supplied descriptions — escape HTML entities to prevent injection if file is ever opened in a browser |
| V11 Business Logic | YES | Drift policy on reload (D-09/D-10/D-11) — invariant that doc references match skeleton state |
| V12 File Handling | YES | Atomic write Pattern-B (D-20 LOCKED); `dialog.showSaveDialog` (no path injection — OS dialog is the source of truth) |

### Known Threat Patterns for Phase 20 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `documentation` slot from disk crashes loader | Tampering / DoS | `validateDocumentation` per-field guard returns `{ kind: 'invalid-shape' }` (D-04) |
| HTML injection via `description` / `notes` / `generalNotes` text in HTML export | Tampering | `escapeHtml()` 5-char replacement helper before any concatenation into template (Pattern 8) |
| File-write race / partial-write corruption on power loss | Tampering / DoS | Atomic write Pattern-B (`<path>.tmp` + `rename`) (D-20) |
| MIME-type collision triggers wrong handler (file drop vs animation drag) | Spoofing | Namespaced `'application/x-stm-anim'` MIME type; check `dataTransfer.types.includes('Files')` first to disambiguate |
| Stale documentation references in saved file disclose skeleton structure that no longer exists | Information Disclosure | Drift policy intersection on reload (Pitfall 4) |
| `dataTransfer.setData` payload from external source (cross-window drag) is malicious | Tampering | Validate `animationName` against `summary.animations.names` whitelist before appending entry |
| `dialog.showSaveDialog` cancellation handled as success | Tampering / wrong-state | Check `result.canceled || !result.filePath` and return cancellation envelope (Pattern 6 verbatim from project-io.ts:178-180) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `escape-html` or `he` is NOT in node_modules — Phase 20 ships a 5-char inline helper | Pattern 8 | LOW — if a library exists, prefer it. Verify with `grep -r "escape-html\|^he$" package.json node_modules/` at planning time. |
| A2 | The 11 SVG glyph paths suggested in Pattern 9 are reasonable visual approximations matching Phase 19 D-08 style | Pattern 9 | LOW — glyph paths are design choices, not API facts. If implementation reveals they look wrong, the planner can mark them as Claude's Discretion variants. |
| A3 | `react-dnd` / `@dnd-kit` are NOT in package.json devDependencies (i.e. truly zero DnD libs in repo) | Don't Hand-Roll | LOW — verified via package.json read; only `@tanstack/react-virtual` resembles a UI lib. ✓ confirmed. |
| A4 | TabButton component is exported from AppShell.tsx and reusable as-is | Pattern 3 | LOW — if not exported, the planner extracts it as part of Wave 0 (small ~10-line component). |
| A5 | `tabIndex` discipline on tab buttons does not interfere with `useFocusTrap` | Pattern 2 | LOW — verified that `useFocusTrap.ts:75-76` selector includes `button:not([disabled])` natively. ✓ |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (5 LOW-risk assumptions remain; none block planning.)

## Open Questions (RESOLVED)

1. **Chip "Animations Configured" count semantics — `documentation.animationTracks.length` vs `summary.animations.count`?**
   - What we know: User screenshot shows "23 Animations Configured" in chip strip but only 6 tracked entries in the table. CONTEXT.md `<specifics>` section flags this as a "narrow ambiguity" — locked interpretation = `documentation.animationTracks.length` (entries the user authored on tracks).
   - What's unclear: Whether the user actually meant `summary.animations.count` (rig's total animation count) when designing the screenshot.
   - Recommendation: Implement per LOCKED interpretation (`documentation.animationTracks.length`). If Phase 20 verification surfaces user disagreement, swap one variable in `doc-export.ts` (single-line change).
   - **RESOLVED:** `documentation.animationTracks.length` (per Plan 04 chip 3 — chip counts user-authored entries, single-line variable swap available if user disagrees).

2. **Should `materializeProjectFile`'s forward-compat default for empty `documentation: {}` (Pitfall 9 Option A) live in `core/project-file.ts` or be applied in `main/project-io.ts` AFTER materialization?**
   - What we know: Option A modifies `materializeProjectFile` directly (single source of truth, atomic with the validator extension).
   - What's unclear: Whether the planner prefers to keep `materializeProjectFile` as a pure passthrough and back-fill in main.
   - Recommendation: Option A (modify materializeProjectFile). Cleaner; the back-fill is structural shape-shaping, not I/O — belongs in the pure module. Document in materializer's docblock.
   - **RESOLVED:** Option A (validator pre-massage in `validateProjectFile`) — refined per checker iteration. The materializer back-fill alone is insufficient because the validator runs FIRST and rejects strict-shape violations before reaching the materializer. Plan 01 Task 2 Step A pre-massages `obj.documentation` to `DEFAULT_DOCUMENTATION` when it is missing or `{}` BEFORE the per-field guards run; the materializer back-fill remains as defence in depth.

3. **Should `events` field on `SkeletonSummary` be REQUIRED or OPTIONAL?**
   - What we know: Phase 19 introduced `unusedAttachments?` as OPTIONAL because Wave 0 typecheck would fail before Wave 2 wired the field.
   - What's unclear: Whether Phase 20 has the same Wave-0 typecheck risk.
   - Recommendation: REQUIRED. Phase 20 extends `summary.ts:128` and `types.ts:476` in the same wave, so there's no Wave-0 typecheck-without-runtime gap. Optional adds runtime null-checks throughout the renderer — avoid when possible.
   - **RESOLVED:** REQUIRED (per Plan 01 — `events: { count: number; names: string[] }` lands as a non-optional `SkeletonSummary` field in the same wave that extends `summary.ts`).

4. **Where exactly should the modal-local documentation state live? AppShell or modal-internal useState?**
   - What we know: D-16 says "Save changes commits the modal-local doc copy into AppSessionState; the existing SaveQuitDialog/onClose paths handle the rest."
   - What's unclear: Whether modal-local state means a deep copy (modal can edit freely; commit on Save copies back) OR direct binding (every keystroke mutates AppSessionState).
   - Recommendation: Modal-internal `useState<Documentation>` seeded from `props.documentation` on every modal-open mount. Commit copies the local state into `setDocumentation` (AppShell-side) on Save. Cancel discards modal-local. This matches the OverrideDialog pattern (`useState(String(props.currentPercent))` at OverrideDialog.tsx:61 — local state seeded from prop, applied via callback).
   - **RESOLVED:** Modal-internal `useState<Documentation>` seeded from `props.documentation` on every open transition (per Plan 02 — Cancel discards, Save copies into AppShell `setDocumentation`).

5. **Should `summary.events` extension include any extra metadata beyond `name`?**
   - What we know: D-09 specifies `{ name, description }` per event. EventData carries `intValue / floatValue / stringValue / volume / balance` for runtime payload, but those are runtime-time, not identity.
   - What's unclear: Nothing — D-09 is unambiguous. `name` is identity; description is user-supplied.
   - Recommendation: Stop at `{ count, names }` mirror of bones/skins/animations. No extra fields.
   - **RESOLVED:** name + count only (per Plan 01 — `events: { count: number; names: string[] }` mirrors the bones/skins/animations shape; no `intValue/floatValue/stringValue/volume/balance` fields).

## Sources

### Primary (HIGH confidence)
- **Project files (read 2026-05-01):**
  - `src/core/project-file.ts:1-387` — full validator, serializer, materializer
  - `src/shared/types.ts:1-90, 370-680, 770-860` — Documentation slot location, AppSessionState, Api interface, structuredClone-safety docblock
  - `src/main/project-io.ts:1-270, 470-510` — atomic write Pattern-B + dialog.showSaveDialog precedent
  - `src/main/summary.ts:1-145` — events extension target
  - `src/main/image-worker.ts:280-310` — Pattern-B prior art
  - `src/main/recent.ts:32-95` — atomic-write second precedent
  - `src/renderer/src/components/AppShell.tsx:130-205, 570-600, 940-980, 1120-1230` — modal lifecycle pattern, AppSessionState builder, button-wiring site
  - `src/renderer/src/modals/OverrideDialog.tsx:1-160` — small 5-modal scaffold reference
  - `src/renderer/src/modals/OptimizeDialog.tsx:260-340` — multi-state-body 5-modal scaffold reference
  - `src/renderer/src/modals/AtlasPreviewModal.tsx:90-220` — useFocusTrap usage + projection useMemo
  - `src/renderer/src/hooks/useFocusTrap.ts:1-190` — full hook implementation
  - `src/preload/index.ts:1-90` — bridge pattern
  - `tests/core/project-file.spec.ts:1-190` — round-trip test pattern
  - `package.json:1-56` — Electron 41.3.0 + React 19.2.5 + dependencies
  - `node_modules/electron/package.json:2` — verified electron@41.3.0
  - `node_modules/@esotericsoftware/spine-core/dist/EventData.d.ts` — EventData.name field
  - `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56` — events: EventData[]
- `.planning/phases/20-documentation-builder-feature/20-CONTEXT.md` — D-01..D-22 LOCKED
- `.planning/phases/19-ui-improvements-ui-01-05/19-PATTERNS.md:944-962, 1041-1069` — Phase 19 SVG glyph pattern + analog citations
- `.planning/phases/19-ui-improvements-ui-01-05/19-UI-SPEC.md:227-261` — verbatim SVG glyph bodies
- `.planning/REQUIREMENTS.md:43-51` — DOC-01..DOC-05 verbatim acceptance
- `CLAUDE.md` — facts #4 + #5 + workflow guidance

### Secondary (MEDIUM confidence)
- WebSearch (2026-05-01): Electron 41 = Chromium ~134 (per Electron 41 release blog); HTML5 native DnD `effectAllowed` cross-platform behavior in Electron Chromium documented in [electron/electron#7207](https://github.com/electron/electron/issues/7207) (related but for `WebContents.startDrag` not in-window DnD).
- React 19 synthetic-event handling for DnD: standard React docs guidance (no library wrapper needed for native DnD in React 17+).

### Tertiary (LOW confidence)
- SVG glyph path approximations in Pattern 9 — design choices, not verified APIs. Marked [ASSUMED].

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against package.json + node_modules.
- Architecture: HIGH — all file:line citations verified live against repo at HEAD.
- Pitfalls: HIGH — drawn from project precedents (Phase 6, 8, 19) + standard HTML5 DnD knowledge.
- SVG glyph paths: LOW — design suggestions, not verified.
- Validation architecture: HIGH — based on existing test layout + Phase 8 `project-file.spec.ts` precedent.

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (30 days — stable Electron / React / spine-core versions; no fast-moving deps)
