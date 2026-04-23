---
name: Phase 1 — Electron + React scaffold Context
description: Locked decisions for Phase 1 — Electron/Vite/React scaffolding + Tailwind v4 dark-neutral tokens + drag-drop JSON load wired through the pure-TS core/ from Phase 0.
phase: 1
---

# Phase 1: Electron + React scaffold with JSON drop-load — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 1` interactive session

<domain>
## Phase Boundary

Phase 1 is the **first UI phase**. It wraps the headless `src/core/` package from Phase 0 in an Electron shell with a React + Vite renderer and Tailwind v4 styling in a Spine-editor–adjacent dark-neutral aesthetic. The only user-visible capability is: drag a `.json` skeleton file into the window, the app auto-discovers its sibling `.atlas` (and/or `images/` folder), calls `core/loader.ts` in the main process, and renders a debug dump that matches the Phase 0 CLI output (plus a header showing bone/slot/attachment/skin/animation counts).

**In scope:**
- `electron.vite.config.ts` at project root (electron-vite bundler — see D-01).
- `src/main/` — Electron main process (window creation, IPC handlers, invokes `src/core/loader.ts`).
- `src/preload/` — typed `contextBridge` API exposing `window.api.loadSkeleton(path)` to the renderer.
- `src/renderer/` — React app (Vite dev server in dev, static build in production). Tailwind v4 via CSS-first `@theme` in the renderer entry stylesheet.
- Full-window drag-drop target that accepts a single `.json` file, forwards its path to main via IPC, and renders the returned summary + CLI-style peak-scale table.
- Tailwind v4 + `@theme` tokens for warm-stone neutrals + Spine-adjacent orange-500 accent (see D-06 to D-10).
- macOS `.dmg` build via `electron-builder`.
- `npm run dev` (Electron dev with HMR in renderer) and `npm run build` (production bundle + dmg) scripts.
- Typed IPC error serialization — `SkeletonJsonNotFoundError` / `AtlasNotFoundError` / `AtlasParseError` survive the main↔renderer boundary with their `name` + `message` intact.

**Out of scope (deferred to later phases):**
- Global Max Render Source panel (Phase 2).
- Animation Breakdown panel (Phase 3).
- Scale overrides, override badges, override dialog (Phase 4).
- Unused attachment detection UI (Phase 5).
- Optimize Assets image export, `sharp` wiring, `src/main/image-worker.ts` (Phase 6).
- Atlas Preview modal (Phase 7).
- Save/Load session JSON (Phase 8).
- Windows `.exe` build target (Phase 9 — ROADMAP Phase 1 only requires `.dmg`; N4.1 full-portability gate is Phase 9).
- Code signing, notarization, auto-update wiring (out of MVP unless explicitly raised).
- State library (Zustand/Jotai/etc.) — Phase 1 has exactly one piece of state (the loaded skeleton summary), so React `useState` is sufficient. Revisit in Phase 2 when filters + sorting land.
- Multi-file drop, folder drop, batch load — single `.json` drop only for Phase 1.
- Sampling (`sampleSkeleton` from `src/core/sampler.ts`) is **included** in Phase 1's debug dump (required to match CLI output per ROADMAP exit criteria) but the UI presentation of peak records is minimal — polished presentation lands in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Toolchain & Packaging (Claude's discretion — canonical defaults)
- **D-01: Bundler — `electron-vite`.** ROADMAP explicitly names `electron.vite.config.ts`. `electron-vite` is the opinionated one-tool solution: handles main/preload/renderer bundling, HMR in renderer, asset pipeline. Simpler than stitching `vite-plugin-electron` manually. Not user-discussed; lock this as the canonical default with explicit rationale below.
- **D-02: Packaging — `electron-builder`.** Produces signed `.dmg` directly, clean config via `electron-builder.yml` or `package.json` `build` key. Integrates with `electron-vite`. Forge makers are viable too but add a second config layer on top of `electron-vite`.
- **D-03: Dev scripts.** `npm run dev` → `electron-vite dev` (Electron window + renderer HMR). `npm run build` → `electron-vite build && electron-builder --mac dmg`. `npm run preview` → `electron-vite preview`. Existing `npm run cli`, `npm run test`, `npm run typecheck` stay intact.
- **D-04: Code signing & notarization — deferred.** Phase 1 ships an unsigned `.dmg` (developer-local validation only). Signing + Apple notarization are a Phase 9 / post-MVP concern. Record the `electron-builder` config hook for signing but leave it unset.
- **D-05: Windows `.exe` — deferred.** ROADMAP Phase 1 requires only `.dmg`. N4.1 full-cross-platform gate is Phase 9.

### IPC & Drop-Handling (Claude's discretion — canonical defaults)
- **D-06: Main process owns filesystem.** `core/loader.ts` uses `node:fs` and must never run in the renderer. Renderer has `nodeIntegration: false`, `contextIsolation: true` (Electron 2024+ defaults). All skeleton loading happens in main.
- **D-07: Preload exposes a typed `window.api`.** `src/preload/index.ts` uses `contextBridge.exposeInMainWorld('api', { loadSkeleton: (path: string) => ipcRenderer.invoke('skeleton:load', path) })`. Types live in `src/preload/api.ts` and are imported by both preload (for the implementation) and renderer (for the global `Window` augmentation). Single source of truth.
- **D-08: IPC channel — `skeleton:load`.** `ipcMain.handle('skeleton:load', async (_evt, jsonPath: string) => { ... })` wraps `loadSkeleton(jsonPath)` + `sampleSkeleton(load)` and returns a **plain serializable summary** (see D-13).
- **D-09: Drop flow — use `file.path` from the HTML5 DragEvent.** Electron renderer DragEvent `dataTransfer.files[i].path` gives the absolute filesystem path (Electron-specific extension). Renderer validates the extension is `.json`, then calls `window.api.loadSkeleton(path)`. No File System Access API, no `webUtils.getPathForFile` workaround — `file.path` is canonical in Electron 30+.
- **D-10: Error serialization across IPC.** `ipcMain.handle` catches thrown `SpineLoaderError` subclasses and returns a discriminated-union shape `{ ok: false, error: { kind: 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown', message: string } }`. Renderer pattern-matches `kind` and maps to inline UI error text. Preserves Phase 0's typed-error contract without serializing the entire error class.

### Tailwind v4 + Design Tokens (LOCKED via discussion)
- **D-11: Tailwind version — v4.** CSS-first via `@theme` in `src/renderer/index.css`. No `tailwind.config.js`, no `postcss.config.cjs`. `@import "tailwindcss"` + `@theme { ... }` in the renderer entry stylesheet. Vite plugin: `@tailwindcss/vite` (official v4 plugin).
- **D-12: Neutral base temperature — warm stone.** Use Tailwind's built-in `stone` scale. Explicit token mapping (see `<specifics>` for exact values):
  - `--color-surface` = `stone-950` (app background)
  - `--color-panel` = `stone-900` (drop zone + debug panel)
  - `--color-border` = `stone-800` (subtle separators)
  - `--color-fg` = `stone-100` (primary text)
  - `--color-fg-muted` = `stone-400` (secondary text, labels)
- **D-13: Depth — two layers.** Surface (`stone-950`) + panel (`stone-900`) with `stone-800` borders. No third layer in Phase 1; revisit if Phase 3's collapsible cards feel flat.
- **D-14: Accent — Tailwind `orange-500` (`#f97316`).** Spine-adjacent warm orange. Token name `--color-accent`. Used **only** in Phase 1 for:
  - Drag-over ring (on `<dropzone>` when a valid file is hovering): `ring-2 ring-orange-500 bg-orange-500/5`
  - Focus-visible outline on interactive elements: `focus-visible:outline-2 focus-visible:outline-orange-500`
  - Reserved for peak-scale highlights, override badges, and warnings in later phases.
- **D-15: Typography — system sans + JetBrains Mono.**
  - UI chrome / body text: CSS `font-sans` (Tailwind default — `ui-sans-serif, system-ui, ...`). Zero font load, matches host OS.
  - Tabular / numeric / debug-dump content: JetBrains Mono, self-hosted via `@font-face` in `src/renderer/index.css`, `font-display: swap`. Token: `--font-mono: 'JetBrains Mono', ui-monospace, ...`.
  - Rationale: CLI output is tabular, and Phase 2–3 panels add more tables. One font load buys us tight columns forever.

### Debug Dump Shape (Claude's discretion — canonical defaults)
- **D-16: Debug panel is a two-part layout.**
  - **Header:** skeleton summary — attachment counts, bone count, slot count, skin list, animation list (counts + names). Matches ROADMAP's "dumps the skeleton summary (bones, slots, attachments, skins, animations) to the console and a debug panel."
  - **Table:** CLI-style peak-scale table — exact replica of `scripts/cli.ts` output, rendered as a `<pre>` (monospace, no table markup needed for Phase 1 — Phase 2 replaces this with the sortable `GlobalMaxRenderPanel`). Columns per [00-07 shipping output](../00-core-math-spike/00-CONTEXT.md#cli-contract-locked): `Attachment | Skin | Source W×H | Peak W×H | Scale | Source Animation | Frame`.
- **D-17: Debug dump is also echoed to `console.log` in renderer.** ROADMAP exit criteria: "dumps the skeleton summary … to the console and to a debug panel." Satisfies both.
- **D-18: Pre-drop state.** Before any file is loaded, the panel shows "Drop a `.spine` JSON file anywhere in this window." (plus project/version chrome in a slim header). No placeholder data, no skeleton demo — it's a cold-start app.
- **D-19: Post-drop rendering.** On successful load, the dump replaces the empty-state copy in-place. On error, the empty-state copy is replaced with a short error message in muted-orange (`text-orange-300`), citing the typed error `name` + `message` from D-10.

### Renderer State (Claude's discretion — canonical defaults)
- **D-20: Plain React `useState` for Phase 1.** State shape: `type AppState = { status: 'idle' } | { status: 'loading', path: string } | { status: 'loaded', path: string, summary: SkeletonSummary } | { status: 'error', path: string, error: SerializableError }`. Managed in a single top-level `App.tsx`. Do **not** introduce Zustand/Jotai/Redux in Phase 1 — revisit in Phase 2 when overrides + filters arrive.

### Serializable Summary Shape (locked)
- **D-21: `SkeletonSummary` — the IPC return payload.** Lives in `src/shared/types.ts` (a new shared-types module readable by both main and renderer, since preload types already cross the boundary). Shape:
  ```ts
  interface SkeletonSummary {
    skeletonPath: string;
    atlasPath: string;
    bones: { count: number; names: string[] };
    slots: { count: number };
    attachments: { count: number; byType: Record<string, number> };
    skins: { count: number; names: string[] };
    animations: { count: number; names: string[] };
    peaks: PeakRecordSerializable[];  // sampleSkeleton() output, plain JSON
    elapsedMs: number;
  }
  ```
- **D-22: `PeakRecordSerializable`.** Matches `PeakRecord` from `src/core/sampler.ts` but flattened to a plain JSON object — no Map, no Float32Array, no class instances. Safe to `structuredClone` across IPC.

### Claude's Discretion (not locked)
- Exact file layout inside `src/main/` and `src/preload/` (single `index.ts` per dir vs `index.ts` + submodules) — planner's call.
- Exact `electron-vite` config details (entry points, externals) — follow the official `electron-vite` starter template for main + preload + renderer.
- Exact `electron-builder` `.dmg` config (icon, title, window size) — reasonable defaults, no user-visible chrome beyond the OS title bar in Phase 1.
- Exact React project structure (`components/`, `hooks/`, `panels/` folders) — start minimal (`App.tsx` + one `DropZone` component + one `DebugPanel` component) and let Phase 2+ grow it.
- Dev-time logging verbosity — reasonable defaults, no user setting in Phase 1.
- JetBrains Mono source — prefer `@fontsource/jetbrains-mono` npm package (self-hosted, no CDN) over Google Fonts CDN.
- Window size / resize behavior — start at a sensible default (1280×800), remember last size via Electron's built-in window state persistence or not at all — planner's call. Persistence can wait until Phase 8 (save/load).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` — approved technical plan. Phase 1 section covers the Electron scaffold requirements; "Why Electron + Vite + React" locks the shell.

### Project instructions
- `CLAUDE.md` — non-obvious facts, folder conventions, commands. Fact #5 ("`core/` is pure TypeScript, no DOM. Headless-testable in Node via vitest. The UI is a consumer.") is the load-bearing invariant for Phase 1's IPC architecture.

### Requirements
- `.planning/REQUIREMENTS.md` — F1.1–F1.4 (loader, used by main), F2.* (sampler, used by main), N4.1 (`.dmg` target).
- `.planning/ROADMAP.md` §"Phase 1" — deliverables and exit criteria (drag `SIMPLE_TEST.json` renders debug dump matching CLI; app builds `.dmg` on macOS).
- `.planning/PROJECT.md` §"Tech stack (locked)" — Electron + TypeScript + React + Vite + Tailwind + vitest.

### Phase 0 artifacts (Phase 1 consumers)
- `src/core/loader.ts` — `loadSkeleton(jsonPath, opts?): Promise<LoadResult>`. Main process imports this. Renderer must NEVER import it (contains `node:fs`).
- `src/core/sampler.ts` — `sampleSkeleton(load, opts?): Map<attachmentKey, PeakRecord>`. Main process imports this. Phase 1 converts the Map to a plain array for IPC serialization (D-22).
- `src/core/errors.ts` — `SpineLoaderError`, `SkeletonJsonNotFoundError`, `AtlasNotFoundError`, `AtlasParseError`. Main catches these in `ipcMain.handle` and returns the discriminated-union shape from D-10.
- `src/core/types.ts` — `LoadResult`, `SourceDims`, `PeakRecord`. `PeakRecord` shape is mirrored (flattened) in `src/shared/types.ts` as `PeakRecordSerializable` (D-22).
- `scripts/cli.ts` — the **reference implementation** for Phase 1's debug dump. Column format, alignment, elapsed-ms footer, error handling all come from here. Phase 1's `DebugPanel` essentially ports `formatTable(...)` to a React component rendering `<pre>`.
- `.planning/phases/00-core-math-spike/00-CONTEXT.md` §"CLI Contract (locked)" — defines the exact debug-dump column set that Phase 1 must match.
- `.planning/phases/00-core-math-spike/00-07-SUMMARY.md` — the accepted mesh-render-scale formula (iter-4 `hull_sqrt`) that `sampleSkeleton` now uses. Phase 1 inherits this transparently (no re-decision).

### External (for planner / researcher)
- [electron-vite docs](https://electron-vite.org/) — project structure, main/preload/renderer entry config, `externals`.
- [electron-builder docs](https://www.electron.build/) — `.dmg` target, macOS-specific config.
- [Tailwind v4 docs](https://tailwindcss.com/docs) — `@theme`, `@tailwindcss/vite`, CSS-first config.
- [Electron contextBridge docs](https://www.electronjs.org/docs/latest/api/context-bridge) — secure preload IPC pattern.
- [Electron File object extensions](https://www.electronjs.org/docs/latest/api/file-object) — `file.path` availability on DragEvents.
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) or [@fontsource/jetbrains-mono npm package](https://fontsource.org/fonts/jetbrains-mono).

### Fixture (Phase 1 drop target)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — primary drop-test target.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` — sibling atlas auto-discovered by `loader.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/loader.ts` + `src/core/sampler.ts` + `src/core/errors.ts` + `src/core/types.ts` — the entire Phase 0 headless package, consumed as-is by the Electron main process.
- `scripts/cli.ts` — the debug-dump reference implementation (column order, alignment, elapsed-ms footer, exit-code ↔ error-class mapping). Phase 1 rerenders this output in a React `<pre>` panel; the format is 100% reusable.
- `tsconfig.json` — already has strict mode, `moduleResolution: "bundler"`, ES2022 target. Renderer and main will inherit. May need a split `tsconfig.main.json` / `tsconfig.renderer.json` so renderer doesn't pull `node:*` types (planner's call — `electron-vite` starter templates show the pattern).

### Established Patterns (from Phase 0)
- **Typed-error discipline:** `SpineLoaderError` hierarchy with `name`-based branching in consumers. Phase 1's IPC error shape (D-10) preserves this contract across the boundary.
- **Atomic commits per logical unit:** Phase 0 used one commit per plan with the scope convention `feat(00-core):`, `chore(00-core):`, etc. Phase 1 should mirror: `feat(01-ui):`, `chore(01-ui):`, `build(01-ui):`.
- **`npm run typecheck` gate:** all Phase 0 plans end with `tsc --noEmit` clean. Phase 1 keeps that, plus adds `electron-vite build` as a second type-check proxy (it'll fail if main/preload/renderer types don't compose).

### Integration Points
- **Electron main entry** (`src/main/index.ts`): creates `BrowserWindow`, loads the renderer URL/file, registers `ipcMain.handle('skeleton:load', ...)`. Imports `src/core/loader.ts` + `src/core/sampler.ts` directly — no bundler externals needed since `node:fs` is available in main.
- **Preload** (`src/preload/index.ts`): `contextBridge.exposeInMainWorld('api', { loadSkeleton })`. Shared type lives in `src/preload/api.ts` and is re-exported as a `Window` augmentation in `src/renderer/env.d.ts`.
- **Renderer entry** (`src/renderer/index.html` + `src/renderer/main.tsx`): standard Vite+React. Tailwind v4 via `@import "tailwindcss"` + `@theme` in `src/renderer/index.css`.
- **Shared types** (`src/shared/types.ts`): new module, readable by main + renderer. Houses `SkeletonSummary` and `PeakRecordSerializable` (D-21, D-22) plus the IPC error-envelope discriminated-union.
- **`.gitignore`** already excludes `node_modules/`, `dist/`, `temp/`, `coverage/`. Phase 1 adds `release/` (electron-builder output) and `out/` if electron-vite uses it.

### Constraints from Phase 0
- `core/` must stay DOM-free. Phase 1 renderer MUST NOT import `src/core/*` directly. Cross-boundary data flows through `src/shared/types.ts` only.
- N2.3 "Sampler hot loop does zero filesystem I/O" — Phase 1's IPC handler runs `loadSkeleton` (FS reads allowed) then `sampleSkeleton` (no FS). Don't accidentally wire an FS read inside the sample loop via some clever "progressive" handler.

</code_context>

<specifics>
## Specific Ideas

### Tailwind v4 `@theme` token set (locked)

```css
/* src/renderer/index.css */
@import "tailwindcss";

@theme {
  /* Neutrals — warm stone base, two layers */
  --color-surface:   var(--color-stone-950);  /* #0c0a09 */
  --color-panel:     var(--color-stone-900);  /* #1c1917 */
  --color-border:    var(--color-stone-800);  /* #292524 */
  --color-fg:        var(--color-stone-100);  /* #f5f5f4 */
  --color-fg-muted:  var(--color-stone-400);  /* #a8a29e */

  /* Accent — Spine-adjacent orange */
  --color-accent:        var(--color-orange-500);  /* #f97316 */
  --color-accent-muted:  var(--color-orange-300);  /* for inline error text */

  /* Typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-Regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
```

### Accent-usage pattern (Phase 1 only)

```tsx
<div
  className={clsx(
    "border border-border rounded-lg bg-panel p-8",
    "focus-visible:outline-2 focus-visible:outline-accent",
    isDragOver && "ring-2 ring-accent bg-accent/5"
  )}
  // ... drag handlers
>
  Drop a .spine JSON file anywhere in this window
</div>
```

### IPC contract (locked shape)

```ts
// src/shared/types.ts
export type LoadResponse =
  | { ok: true;  summary: SkeletonSummary }
  | { ok: false; error: SerializableError };

export interface SerializableError {
  kind: 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown';
  message: string;
}

// src/preload/api.ts
export interface Api {
  loadSkeleton: (jsonPath: string) => Promise<LoadResponse>;
}
declare global {
  interface Window { api: Api; }
}
```

### Main-process handler skeleton

```ts
// src/main/ipc.ts
import { ipcMain } from 'electron';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';
import { SpineLoaderError } from '../core/errors.js';
import type { LoadResponse, SkeletonSummary } from '../shared/types.js';

ipcMain.handle('skeleton:load', async (_evt, jsonPath: string): Promise<LoadResponse> => {
  try {
    const load = await loadSkeleton(jsonPath);
    const peaks = sampleSkeleton(load);
    const summary: SkeletonSummary = buildSummary(load, peaks);
    return { ok: true, summary };
  } catch (err) {
    if (err instanceof SpineLoaderError) {
      return { ok: false, error: { kind: err.name as SerializableError['kind'], message: err.message } };
    }
    return { ok: false, error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) } };
  }
});
```

### Debug dump — Phase 1 format (matches CLI)

```
Skeleton: /path/to/SIMPLE_TEST.json
Atlas:    /path/to/SIMPLE_TEST.atlas
Bones:    9   Slots: 5   Attachments: 4 (region:3 mesh:1)
Skins:    default
Animations: 4 — idle, jump, physics, setup

Attachment   Skin      Source W×H   Peak W×H    Scale   Source Animation   Frame
-----------  --------  -----------  ----------  ------  -----------------  -----
CIRCLE       default   64×64        114×114     1.78    idle               12
SQUARE       default   96×96        96×96       1.00    Setup Pose (Default)  —
SQUARE2      default   96×96        192×192     2.00    Setup Pose (Default)  —
TRIANGLE     default   80×80        88×88       1.10    jump               4

Elapsed: 9.4 ms (120 Hz sampling)
```

### Reference screenshots

The user is open-sourcing this project and wants it **similar to the Spine editor aesthetic** — dark-neutral, minimal, tool-like — without directly copying it. Warm-stone base + Spine-orange accent captures that spirit. Original screenshots live in `~/.claude/plans/i-need-to-create-zesty-eich.md` (attached images in the approved plan); planner can read the plan for layout reference but **the design differentiator is intentionally close to Spine, not distinct from it.**

</specifics>

<deferred>
## Deferred Ideas

- **Windows `.exe` build target.** ROADMAP Phase 1 is macOS `.dmg` only; full-portability (N4.1) is Phase 9.
- **Code signing & Apple notarization.** Unsigned `.dmg` is acceptable for Phase 1 developer-local validation. Commercial shipping concern — post-MVP.
- **Auto-update infrastructure.** Out of MVP.
- **State library (Zustand / Jotai).** Phase 1 uses `useState`. Revisit at Phase 2 when overrides + filters + sorting land.
- **Multi-file drop + folder drop.** Single-file drop only in Phase 1. F9 "Save/Load project state" (Phase 8) adds file dialog–based project loading.
- **Settings modal / sampling-rate override in UI.** Phase 9 concern (per ROADMAP).
- **Third depth layer (card-in-panel).** Two-layer depth in Phase 1. Reopen if Phase 3 Animation Breakdown cards need nested visual hierarchy.
- **Custom hex accent (non-stock Tailwind).** Using stock `orange-500` for now. Revisit if brand differentiation later requires a custom token.
- **Design system extraction.** All tokens live in `src/renderer/index.css` `@theme` for Phase 1. If the codebase grows to justify a separate `design-tokens/` module, that's a later refactor.
- **Richer error UI (modals, retry buttons).** Phase 1 shows inline muted-orange error text. Fancier error surfaces can wait until Phase 2+.

</deferred>

---

*Phase: 01-electron-react-scaffold*
*Context gathered: 2026-04-23 via `/gsd-discuss-phase 1`*
