# Phase 1: Electron + React Scaffold — Research

**Researched:** 2026-04-23
**Domain:** Electron + Vite + React + Tailwind v4 shell wrapping the Phase 0 headless core
**Confidence:** HIGH (stack + structure) / MEDIUM (one locked decision needs revision — see Critical Finding #1)

---

## Summary

Phase 1 builds an Electron shell around the proven Phase 0 `src/core/` package. The canonical 2026 stack is **electron-vite 5 + electron 41 + electron-builder 26 + React 19 + Vite 7 + Tailwind v4 + @tailwindcss/vite**. The official `@alex8088/quick-start` react-ts starter gives us the exact folder layout, tsconfig split (3 files — root + node + web), and `electron-builder.yml` pattern; we adopt that verbatim and layer in our locked design tokens.

**The one surprise — and it invalidates a locked CONTEXT.md decision:** `file.path` was REMOVED in Electron 32. We're targeting Electron 41. D-09 (`Drop uses HTML5 DragEvent file.path`) MUST be updated to use `webUtils.getPathForFile(file)` exposed via the preload's contextBridge. This is documented below as **Critical Finding #1** and needs a quick confirmation with the user before planning — or the planner can absorb it as a tactical discovery since CONTEXT.md D-09's INTENT (get the absolute path from the drop event) is preserved; only the mechanism changes.

**Primary recommendation:** Follow the `@alex8088/quick-start/react-ts` template structure (3-tsconfig split, `src/main/`, `src/preload/`, `src/renderer/src/`, `electron-builder.yml`), drop in `@tailwindcss/vite` for the renderer, self-host JetBrains Mono via `@fontsource/jetbrains-mono` with the advanced `url(@fontsource/...)` @font-face pattern, and expose `window.api.loadSkeleton(file: File)` from preload (NOT a path string — pass the File object so preload can resolve the path via `webUtils.getPathForFile`).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (copy verbatim — planner MUST honor these)

**Toolchain & Packaging**
- **D-01:** Bundler = `electron-vite` — `electron.vite.config.ts` at project root.
- **D-02:** Packaging = `electron-builder`. Config via `package.json` `build` block OR `electron-builder.yml`.
- **D-03:** Dev scripts: `npm run dev` → `electron-vite dev`; `npm run build` → `electron-vite build && electron-builder --mac dmg`; `npm run preview` → `electron-vite preview`. Keep existing `cli`, `test`, `typecheck`.
- **D-04:** Unsigned `.dmg` for Phase 1. Signing/notarization deferred.
- **D-05:** Windows `.exe` deferred but config-flippable (no code rewrite required).

**IPC & Drop-Handling**
- **D-06:** Main process owns filesystem; `core/loader.ts` NEVER runs in renderer. `nodeIntegration: false`, `contextIsolation: true`.
- **D-07:** Preload exposes typed `window.api` via `contextBridge.exposeInMainWorld('api', ...)`. Types in `src/preload/api.ts` or `src/preload/index.d.ts`, imported by both preload and renderer.
- **D-08:** Single IPC channel = `'skeleton:load'`. `ipcMain.handle('skeleton:load', async (_evt, jsonPath: string) => ...)` wraps `loadSkeleton` + `sampleSkeleton` and returns a plain serializable summary.
- **D-09:** Drop uses HTML5 DragEvent `dataTransfer.files[i].path`. *⚠️ SEE CRITICAL FINDING #1 — this mechanism is REMOVED in Electron 32+; the INTENT (get absolute path from the drop event) is preserved but the API changes to `webUtils.getPathForFile(file)` in preload.*
- **D-10:** IPC error envelope = discriminated union `{ ok: false, error: { kind, message } }` where `kind` ∈ `'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown'`. Renderer pattern-matches `kind`.

**Tailwind v4 + Design Tokens**
- **D-11:** Tailwind v4 CSS-first via `@theme` in `src/renderer/index.css`. No `tailwind.config.js`, no `postcss.config.cjs`. `@import "tailwindcss"` + `@theme { ... }`. Vite plugin: `@tailwindcss/vite`.
- **D-12:** Warm stone neutrals mapped to `--color-surface` (stone-950), `--color-panel` (stone-900), `--color-border` (stone-800), `--color-fg` (stone-100), `--color-fg-muted` (stone-400).
- **D-13:** Two-layer depth (surface + panel). No third layer in Phase 1.
- **D-14:** Accent = `orange-500` (`--color-accent`), with `orange-300` for muted error text. Used only for drag-over ring + focus-visible outlines in Phase 1.
- **D-15:** System sans for UI chrome + JetBrains Mono (self-hosted via `@fontsource/jetbrains-mono`) for tabular/debug content. `font-display: swap`.

**Debug Dump Shape**
- **D-16:** Two-part panel: header (skeleton summary — bones, slots, attachments, skins, animations) + table (CLI-style peak-scale `<pre>`, matching `scripts/cli.ts` column set exactly).
- **D-17:** Debug dump ALSO echoed to `console.log` in renderer.
- **D-18:** Pre-drop empty state: "Drop a `.spine` JSON file anywhere in this window."
- **D-19:** Post-drop: dump replaces empty state in place. On error: muted-orange inline error text (`text-orange-300`) with typed error `name` + `message`.

**Renderer State**
- **D-20:** Plain React `useState` only. `AppState` = discriminated union (`idle` | `loading` | `loaded` | `error`). No state library.

**Serializable Summary Shape**
- **D-21:** `SkeletonSummary` lives in NEW `src/shared/types.ts` (readable by main + renderer). Fields: `skeletonPath`, `atlasPath`, `bones.{count,names}`, `slots.{count}`, `attachments.{count,byType}`, `skins.{count,names}`, `animations.{count,names}`, `peaks: PeakRecordSerializable[]`, `elapsedMs`.
- **D-22:** `PeakRecordSerializable` = flat JSON mirror of `PeakRecord` (no Map, no Float32Array, no class instances).

**Cross-Platform Readiness**
- **D-23:** Zero Windows-specific code. No `process.platform` / `os.platform()` branches. No macOS-only Electron APIs.
- **D-24:** `electron-builder` config target-agnostic. `mac.target: ['dmg']` only; adding `win.target: ['nsis']` later is additive.
- **D-25:** Path handling via `node:path` only. No hardcoded `/` in path strings.
- **D-26:** File drag-drop uses absolute path. *⚠️ See Finding #1.* Renderer forwards the absolute string verbatim — no normalization.
- **D-27:** No macOS-only window chrome: skip `titleBarStyle: 'hiddenInset'`, `trafficLightPosition`, `vibrancy`, `visualEffectState`. Use `titleBarStyle: 'default'`.

### Claude's Discretion (researcher/planner's call)
- Exact file layout inside `src/main/` and `src/preload/` (single `index.ts` vs. submodules).
- Exact `electron-vite` config details (externals, entry points) — follow official starter.
- Exact `electron-builder` `.dmg` window/icon config — reasonable defaults.
- Exact React structure (`components/`, `hooks/`, `panels/`) — start minimal.
- Dev-time logging verbosity.
- JetBrains Mono source — prefer `@fontsource/jetbrains-mono` npm package over CDN.
- Window size (start 1280×800).

### Deferred Ideas (OUT OF SCOPE for Phase 1)
- Windows `.exe` build target (Phase 9).
- Code signing & Apple notarization.
- Auto-update infrastructure.
- State library (Zustand/Jotai) — revisit Phase 2.
- Multi-file drop, folder drop, batch load.
- Settings modal / sampling-rate override in UI (Phase 9).
- Third depth layer (revisit Phase 3).
- Custom hex accent (non-stock Tailwind).
- Design system extraction module.
- Richer error UI (modals, retry buttons).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F1 (integrated) | Skeleton loading: load JSON, auto-detect atlas, stub TextureLoader, clear error on missing assets. | `loadSkeleton()` already implements F1.1–F1.4 [VERIFIED: src/core/loader.ts]. Phase 1 just invokes it from `ipcMain.handle('skeleton:load', ...)`. No code changes to loader. |
| N4.1 | Ships as signed `.dmg` (macOS) and `.exe` (Windows) at minimum. | Phase 1 covers `.dmg` only (unsigned — D-04); `.exe` deferred to Phase 9. Windows-portability review gates documented in CONTEXT.md `<portability>` section. electron-builder cross-compile via wine works out-of-the-box from macOS for unsigned `.exe` [CITED: electron.build/multi-platform-build.html]. |
| N4.2 | No native compilation beyond Electron + sharp defaults. | Phase 1 adds no native deps — `sharp` lands in Phase 6. |

Also indirectly exercised:
- F2.x (sampler) — `sampleSkeleton(load)` runs in the IPC handler; its output shape is flattened per D-22.
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Directive | Phase 1 Impact |
|-----------|----------------|
| **Fact #5:** `core/` is pure TypeScript, no DOM. Headless-testable. UI is a consumer. | LOAD-BEARING. Renderer MUST NOT import `src/core/*`. Enforce via: (a) electron-vite externals, (b) ESLint `no-restricted-imports` rule scoped to `src/renderer/**`, (c) `tsconfig.web.json` `include` excludes `src/core/**`. Cross-boundary contract goes through `src/shared/types.ts` ONLY. |
| **Atomic commits per logical unit** (Phase 0 convention: `feat(00-core):`). | Phase 1 mirrors: `feat(01-ui):`, `chore(01-ui):`, `build(01-ui):`. |
| **`npm run typecheck` gate on every plan.** | Must survive the tsconfig split — canonical starter uses `npm run typecheck:node && npm run typecheck:web` composed into `npm run typecheck`. Add `electron-vite build` as a secondary type-check proxy (bundle-time errors). |
| **No files in `temp/`.** | Already gitignored. Phase 1 adds `out/` (electron-vite bundle output) and `dist/` (electron-builder default output — already gitignored from Phase 0) to .gitignore. |
| **Rule #1:** Sampler prose must NOT contain the literal token `skeleton.fps`. | Phase 1 debug panel code shouldn't either — refer to it as "editor FPS" or `load.editorFps` when rendering the Frame column. |
| **Rule #3:** Sampler tick lifecycle locked. | Phase 1 doesn't touch it; IPC handler calls `sampleSkeleton(load)` as a black box. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parsing Spine JSON + atlas | Main process | — | `core/loader.ts` uses `node:fs`; must never execute in renderer (CLAUDE.md Fact #5). |
| Sampling peaks (`sampleSkeleton`) | Main process | — | Called immediately after loader inside the same IPC handler. Heavy CPU ~10 ms on simple rig; moves to worker only if Phase 9 complex rig profiling demands it (out of scope for Phase 1). |
| Resolving drag-dropped file path | Preload | — | `webUtils.getPathForFile(file)` is only safe in preload (has Electron module access, isolated from web content). Renderer passes the raw `File` object to preload via contextBridge. |
| IPC routing (`invoke` / `handle`) | Preload (invoke) ↔ Main (handle) | — | Standard Electron 2024+ pattern. No renderer→main direct coupling. |
| Drag-drop UI (drag events, visual feedback) | Renderer | — | HTML5 DragEvent API. Pure DOM. |
| Rendering skeleton summary + peak table | Renderer | — | Pure React/DOM. Receives a plain JSON `SkeletonSummary` object from IPC. |
| App state (`idle/loading/loaded/error`) | Renderer | — | Single top-level `App.tsx` with `useState`. D-20 locks this. |
| Design tokens (colors, fonts) | Renderer (Tailwind v4 `@theme` in CSS) | — | CSS-only, no runtime JS involved. |
| BrowserWindow creation | Main process | — | Standard Electron API. |
| `.dmg` packaging | Build-time (electron-builder) | — | No runtime code. |

---

## Critical Findings

### Finding #1 (LOAD-BEARING — affects locked decision D-09)

**`file.path` was REMOVED in Electron 32.** We're targeting Electron 41.3.0 [VERIFIED: `npm view electron version`]. D-09 in CONTEXT.md states:

> Electron renderer DragEvent `dataTransfer.files[i].path` gives the absolute filesystem path (Electron-specific extension). … `file.path` is canonical in Electron 30+.

This is **no longer true.** [CITED: electronjs.org/docs/latest/breaking-changes]

> "The nonstandard `path` property of the Web `File` object was added in an early version of Electron as a convenience method for working with native files when doing everything in the renderer was more common. However, it represents a deviation from the standard and poses a minor security risk as well, so beginning in Electron 32.0 it has been removed in favor of the `webUtils.getPathForFile` method."

**What replaces it:** `webUtils.getPathForFile(file)` [CITED: electronjs.org/docs/latest/api/web-utils] — but it must be called from the **preload script**, not the renderer, because `webUtils` is not exposed to isolated-context renderer code. The File object is passed from renderer → preload via contextBridge; preload resolves the path and returns it (synchronously — no IPC round-trip needed).

**Implications for the plan:**
1. The IPC shape **stays the same** (`window.api.loadSkeleton(jsonPath: string)` OR `window.api.loadSkeleton(file: File)` with path resolution inside preload — planner's call). D-08's `'skeleton:load'` channel with a path string argument is preserved; only the path-acquisition step changes.
2. The preload must import `webUtils` from Electron and call `webUtils.getPathForFile(file)` before `ipcRenderer.invoke`.
3. The RENDERER drag handler passes the File object (not a string path) to the preload-exposed function — because the renderer has no direct way to get the path.
4. `getPathForFile()` returns `""` (empty string) if the file wasn't backed by a disk file — preload should validate and throw/reject.
5. **Known bug** [CITED: github.com/electron/electron/issues/44600]: initially reported on macOS 15.1 with `react-dropzone`; the root cause was a react-dropzone-specific wrapper (it reconstructs File objects). Direct use via `e.dataTransfer.files[0]` → preload `webUtils.getPathForFile(file)` works reliably. **We are NOT using react-dropzone** — we write our own drop handler, so this bug does not affect us.

**Recommended preload API (corrects D-09 while preserving D-07/D-08/D-10):**
```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, LoadResponse } from '../shared/types';

const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) {
      return { ok: false, error: { kind: 'Unknown', message: 'File is not backed by a disk path' } };
    }
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },
};

contextBridge.exposeInMainWorld('api', api);
```

**This is the only deviation from CONTEXT.md** — every other locked decision stands. Planner should treat D-09 as meaning "acquire the drop target's absolute path via whatever the current-Electron mechanism is" and use `webUtils.getPathForFile` in the preload.

### Finding #2 (LOAD-BEARING — affects D-12 / `@theme` token syntax)

CONTEXT.md `<specifics>` block shows:
```css
@theme {
  --color-surface: var(--color-stone-950);  /* references a Tailwind default token */
}
```

**This won't work as intended in Tailwind v4.** [CITED: tailwindcss.com/docs/theme#referencing-other-variables] — when a `@theme` variable references another CSS variable, Tailwind needs to know to **inline** the value at utility-generation time. Otherwise the utility class generated is `background-color: var(--color-surface)` which expands to `var(--color-stone-950)` at render time — which **fails** if `--color-surface` is read in a context where `--color-stone-950` is not yet defined (subtle cascade-scope bug that bit the Tailwind team enough to document).

**Required fix:** use `@theme inline`:
```css
@theme inline {
  --color-surface:  var(--color-stone-950);
  --color-panel:    var(--color-stone-900);
  --color-border:   var(--color-stone-800);
  --color-fg:       var(--color-stone-100);
  --color-fg-muted: var(--color-stone-400);
  --color-accent:        var(--color-orange-500);
  --color-accent-muted:  var(--color-orange-300);
}
```

`@theme inline` inlines the value at the call site — generated utility becomes `background-color: oklch(...)` directly [VERIFIED: tailwindcss.com/docs/theme]. Fonts + typography tokens (which are literal strings, not variable references) can stay in a plain `@theme { ... }` block, OR live in the same `@theme inline` block — no functional difference for non-reference values.

### Finding #3 (non-critical — clarification of D-07)

The canonical electron-vite starter stores the preload type declaration in `src/preload/index.d.ts` with `declare global { interface Window { api: ... } }` — and `tsconfig.web.json` `include` list includes `src/preload/*.d.ts` so the renderer sees the global augmentation without pulling preload runtime code. [VERIFIED: raw.githubusercontent.com/alex8088/quick-start/.../tsconfig.web.json]

The CONTEXT.md says "Types live in `src/preload/api.ts`" — using `.d.ts` is equivalent for the augmentation part but cleaner (no risk of bundling runtime code). A cleaner split:

- `src/shared/types.ts` — `SkeletonSummary`, `PeakRecordSerializable`, `LoadResponse`, `SerializableError`, `Api` interface. Pure types. Imported by main, preload, renderer.
- `src/preload/index.d.ts` — `declare global { interface Window { api: Api } }`. Side-effect-only global augmentation.
- `src/preload/index.ts` — implementation (imports `Api` from `../shared/types`, exposes the impl via `contextBridge`).

This is what the canonical `@alex8088/quick-start/react-ts` starter does [VERIFIED: starter files fetched].

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | `^41.3.0` | Desktop shell runtime | Current stable. [VERIFIED: `npm view electron version` → 41.3.0, 2026-04-22] |
| `electron-vite` | `^5.0.0` | Main/preload/renderer bundler with HMR | Opinionated one-tool solution locked by D-01; v5 deprecated `externalizeDepsPlugin` in favor of default `build.externalizeDeps: true`. [VERIFIED: `npm view electron-vite version` → 5.0.0; CITED: electron-vite.org migration guide] |
| `electron-builder` | `^26.0.12` | `.dmg` (and later `.exe`) packaging | Standard in the ecosystem. [VERIFIED: `npm view electron-builder version` → 26.8.1] |
| `react` + `react-dom` | `^19.2.5` | UI framework | React 19 stable; works with Vite 7. [VERIFIED: `npm view react version` → 19.2.5] |
| `vite` | `^7.2.6` | (transitive via electron-vite) | Renderer build/HMR. [VERIFIED via react-ts starter package.json] |
| `@vitejs/plugin-react` | `^5.1.2` | React + Fast Refresh in the renderer | Pairs with Vite 7. [VERIFIED: `npm view @vitejs/plugin-react version` → 6.0.1; starter uses 5.1.x — 5.x is stable and what the starter ships, 6.x also available; use 5.1.x per starter] |
| `tailwindcss` | `^4.2.4` | Utility-first CSS | Current Tailwind v4. [VERIFIED: `npm view tailwindcss version` → 4.2.4] |
| `@tailwindcss/vite` | `^4.2.4` | Tailwind v4 Vite plugin (CSS-first, no postcss config) | Official plugin — CSS-first config via `@theme` in CSS. [VERIFIED: `npm view @tailwindcss/vite version` → 4.2.4] |
| `@fontsource/jetbrains-mono` | `^5.2.8` (or latest) | Self-hosted JetBrains Mono | Standard npm package for self-hosted fonts; Vite handles the asset pipeline. [VERIFIED: `npm view @fontsource/jetbrains-mono version`; CITED: fontsource.org/fonts/jetbrains-mono/install] |
| `typescript` | `^5.9.3` (NOT 6.x yet) | Compiler | ⚠️ **Current root tsconfig uses `typescript ^6.0.0`** — the canonical starter pins 5.9.3. TypeScript 6 exists but the starter ecosystem (including `@electron-toolkit/tsconfig`) is built against 5.x. Planner should verify 6.x + `@electron-toolkit/tsconfig` compatibility, OR pin to 5.9.x for Phase 1. [VERIFIED: package.json currently has `^6.0.0`; starter has `^5.9.3`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@electron-toolkit/tsconfig` | `^2.0.0` | Base tsconfigs for node + web | Extend from these in our `tsconfig.node.json` and `tsconfig.web.json` — saves ~40 lines of boilerplate. [VERIFIED via starter] |
| `@types/node` | `^22.19.1` (currently `^25.0.0` in our root) | Node types for main process | Starter uses 22.x — but we already have 25.x from Phase 0 and it works. No change needed unless compat issues appear. |
| `@types/react` + `@types/react-dom` | `^19.2.7` + `^19.2.3` | TypeScript React types | Standard. |
| `clsx` or `classnames` | `^2.1.1` (if needed) | Conditional className composition for the drag-over ring | Optional — D-14 example uses `clsx(...)`. Tiny utility, very common. |

### NOT using (canonical starter does — we skip)
| Library | Rationale for skipping |
|---------|------------------------|
| `@electron-toolkit/preload` | Bundles `ipcRenderer`, `process.platform`, etc. into `window.electron` — but D-06/D-07 spec a TINY custom `window.api`. Adding the toolkit would (a) bloat the preload surface, (b) violate D-23's "no `process.platform`" by shipping that helper. Our preload is 10 lines; no helper needed. |
| `@electron-toolkit/utils` | Only used by canonical starter for `electronApp.setAppUserModelId()` (Windows task-bar grouping) and `optimizer.watchWindowShortcuts()` (dev-only keyboard shortcut forwarding). We can add if needed later; zero Phase 1 value. |
| `react-dropzone` | Reconstructs File objects in a way that breaks `webUtils.getPathForFile` [CITED: github.com/electron/electron/issues/44600 comments]. We write a bare 30-line drop handler on a `<div>`. |
| ESLint + Prettier | Phase 0 shipped without them. Add later if code-review pain emerges. NOT Phase 1 scope. |
| PostCSS config | Tailwind v4 removed the need. CSS-first, plugin-only. [CITED: tailwindcss.com v4.0 blog] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `electron-vite` | `vite-plugin-electron` + manual wiring | Requires stitching main/preload/renderer Vite configs by hand. electron-vite abstracts this. D-01 locks choice. |
| `electron-builder` | Electron Forge | Forge layers on top of Vite — more magic, less direct control over `.dmg`. D-02 locks choice. |
| `@fontsource/jetbrains-mono` | Google Fonts CDN | CDN adds network dep + offline failure mode. Self-hosting is one-and-done. |
| Variable-weight font (`@fontsource-variable/jetbrains-mono`) | Standard weight-400 `@fontsource/jetbrains-mono` | Variable is ~220 KB vs 40 KB/weight; Phase 1 only needs regular 400. D-15's "one font load" commentary favors the standard package. |
| TypeScript 5.9.x | TypeScript 6.x (our current) | 6.x works but the `@electron-toolkit/tsconfig` base configs haven't published 6.x-compatible releases as of 2026-04. Recommend a quick typecheck spike early in Phase 1 Plan 1 — if 6.x works, stay; if not, downgrade. |

**Installation (Phase 1 net-new packages):**
```bash
npm install --save react react-dom @fontsource/jetbrains-mono
npm install --save-dev \
  electron electron-vite electron-builder \
  @vitejs/plugin-react tailwindcss @tailwindcss/vite \
  @electron-toolkit/tsconfig \
  @types/react @types/react-dom
```

**Version verification (all verified 2026-04-23 against npm registry):**
- `electron` — 41.3.0
- `electron-vite` — 5.0.0 (latest modified 2026-04-12)
- `electron-builder` — 26.8.1
- `tailwindcss` + `@tailwindcss/vite` — 4.2.4 (same version lockstep)
- `react` + `react-dom` — 19.2.5
- `@fontsource/jetbrains-mono` — 5.2.8
- `vite` — 7.2.6 (transitive; electron-vite pulls it)
- `@vitejs/plugin-react` — 6.0.1 (latest) or 5.1.x (starter-verified; safer)

---

## Architecture Patterns

### System Architecture Diagram

```
     ┌──────────────────────────────────────────────────────┐
     │ User drops .json file onto window                    │
     └─────────────────────────┬────────────────────────────┘
                               │ HTML5 DragEvent
                               ▼
     ┌──────────────────────────────────────────────────────┐
     │ RENDERER (src/renderer/)                              │
     │ ┌─────────────────────────────────────────────────┐  │
     │ │ App.tsx (useState: AppState discriminated union)│  │
     │ │   └─ DropZone.tsx                               │  │
     │ │        onDrop(e) →                              │  │
     │ │          file = e.dataTransfer.files[0]         │  │
     │ │          window.api.loadSkeletonFromFile(file)  │  │
     │ │        → updates state: 'loading'→'loaded'/'err'│  │
     │ │   └─ DebugPanel.tsx                             │  │
     │ │        renders <pre> CLI-style peak table       │  │
     │ └─────────────────────────────────────────────────┘  │
     └─────────────────────────┬────────────────────────────┘
                               │ File object (pure JS)
                               ▼
     ┌──────────────────────────────────────────────────────┐
     │ PRELOAD (src/preload/index.ts)                        │
     │   webUtils.getPathForFile(file) → absolute path       │
     │   ipcRenderer.invoke('skeleton:load', path)           │
     └─────────────────────────┬────────────────────────────┘
                               │ IPC: path string  (structuredClone)
                               ▼
     ┌──────────────────────────────────────────────────────┐
     │ MAIN (src/main/index.ts + src/main/ipc.ts)            │
     │   ipcMain.handle('skeleton:load', async path → {      │
     │     try {                                             │
     │       load  = loadSkeleton(path)   // reads FS ───────┼──► fs: SIMPLE_TEST.json
     │       peaks = sampleSkeleton(load) // pure compute    │     fs: SIMPLE_TEST.atlas
     │       summary = buildSummary(load, peaks)             │
     │       return { ok: true, summary }                    │
     │     } catch (err) {                                   │
     │       if (err instanceof SpineLoaderError)            │
     │         return { ok: false, error: {kind,message} }   │
     │     }                                                 │
     │   })                                                  │
     └─────────────────────────┬────────────────────────────┘
                               │ IPC: LoadResponse (structuredClone)
                               ▼
          Back up through preload → renderer state → DebugPanel

     ┌──────────────────────────────────────────────────────┐
     │ SHARED (src/shared/types.ts)                          │
     │   SkeletonSummary, PeakRecordSerializable,            │
     │   LoadResponse, SerializableError, Api interface      │
     │   (imported by all three processes — pure types)      │
     └──────────────────────────────────────────────────────┘
```

**Component Responsibilities:**

| File | Tier | Responsibility |
|------|------|----------------|
| `electron.vite.config.ts` | build-time | Bundles main/preload/renderer. Registers `@vitejs/plugin-react` + `@tailwindcss/vite` on renderer. |
| `src/main/index.ts` | main | `app.whenReady` → `createWindow()` with `webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true }`. Registers `'skeleton:load'` IPC handler. |
| `src/main/ipc.ts` | main | `ipcMain.handle('skeleton:load', ...)` — calls `loadSkeleton` + `sampleSkeleton`, catches `SpineLoaderError`, returns `LoadResponse`. |
| `src/main/summary.ts` | main | Pure function `buildSummary(load: LoadResult, peaks: Map<string,PeakRecord>): SkeletonSummary` — flattens the Map to array, counts attachments by type, produces plain JSON. |
| `src/preload/index.ts` | preload | Imports `webUtils`; exposes `window.api.loadSkeletonFromFile(file: File)` via `contextBridge`. |
| `src/preload/index.d.ts` | preload | `declare global { interface Window { api: Api } }`. |
| `src/shared/types.ts` | shared | All IPC-crossing types (plain JSON only). |
| `src/renderer/index.html` | renderer | Vite entry. |
| `src/renderer/src/main.tsx` | renderer | React mount. |
| `src/renderer/src/index.css` | renderer | `@import "tailwindcss"` + `@theme inline { ... }` + `@font-face` for JetBrains Mono. |
| `src/renderer/src/App.tsx` | renderer | Top-level `useState<AppState>`, renders DropZone + DebugPanel. |
| `src/renderer/src/components/DropZone.tsx` | renderer | Full-window `<div>` with drag handlers; calls `window.api.loadSkeletonFromFile(file)`. |
| `src/renderer/src/components/DebugPanel.tsx` | renderer | Renders `SkeletonSummary` — header block + `<pre>` CLI-style table. Ports `scripts/cli.ts` `renderTable()` logic. |

### Recommended Project Structure

```
.
├── electron.vite.config.ts            # NEW
├── electron-builder.yml               # NEW (or `build` key in package.json)
├── package.json                       # ADD: electron, electron-vite, electron-builder, react, react-dom, tailwindcss, @tailwindcss/vite, @vitejs/plugin-react, @fontsource/jetbrains-mono, @electron-toolkit/tsconfig, @types/react, @types/react-dom. ADD: dev, build, preview scripts. ADD: main: "./out/main/index.js". ADD: build {} block.
├── tsconfig.json                      # CHANGE: empty references-only
├── tsconfig.node.json                 # NEW: extends @electron-toolkit/tsconfig/tsconfig.node.json, includes src/main + src/preload + electron.vite.config.ts + src/shared
├── tsconfig.web.json                  # NEW: extends @electron-toolkit/tsconfig/tsconfig.web.json, includes src/renderer + src/preload/*.d.ts + src/shared
├── .gitignore                         # ADD: out/ (electron-vite output). dist/ already present (electron-builder output).
├── src/
│   ├── core/                          # (UNCHANGED from Phase 0)
│   │   ├── loader.ts
│   │   ├── sampler.ts
│   │   ├── bounds.ts
│   │   ├── errors.ts
│   │   └── types.ts
│   ├── shared/                        # NEW
│   │   └── types.ts                   # SkeletonSummary, PeakRecordSerializable, LoadResponse, SerializableError, Api
│   ├── main/                          # NEW
│   │   ├── index.ts                   # app lifecycle, BrowserWindow
│   │   ├── ipc.ts                     # ipcMain.handle('skeleton:load', ...)
│   │   └── summary.ts                 # buildSummary(load, peaks) — pure function
│   ├── preload/                       # NEW
│   │   ├── index.ts                   # contextBridge, webUtils
│   │   └── index.d.ts                 # global Window augmentation
│   └── renderer/                      # NEW
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── index.css              # @import "tailwindcss" + @theme inline + @font-face
│           └── components/
│               ├── DropZone.tsx
│               └── DebugPanel.tsx
├── scripts/cli.ts                     # (UNCHANGED from Phase 0)
├── tests/core/                        # (UNCHANGED from Phase 0)
└── fixtures/SIMPLE_PROJECT/            # (UNCHANGED)
```

### Pattern 1: Minimal Preload with Typed Bridge

```typescript
// src/preload/index.ts
// Source: verified against raw.githubusercontent.com/alex8088/quick-start/.../preload/index.ts + electronjs.org/docs/latest/api/web-utils
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, LoadResponse } from '../shared/types';

const api: Api = {
  loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
    const jsonPath = webUtils.getPathForFile(file);
    if (!jsonPath) {
      return {
        ok: false,
        error: { kind: 'Unknown', message: 'Dropped file has no filesystem path (not backed by a disk file).' },
      };
    }
    // Main process receives a plain string — structuredClone-safe.
    return ipcRenderer.invoke('skeleton:load', jsonPath);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('Failed to expose api via contextBridge:', error);
  }
} else {
  // Never happens given D-06, but keep the fallback as the starter does.
  (window as unknown as { api: Api }).api = api;
}
```

```typescript
// src/preload/index.d.ts
import type { Api } from '../shared/types';

declare global {
  interface Window {
    api: Api;
  }
}
```

### Pattern 2: IPC Handler with Typed-Error Envelope

```typescript
// src/main/ipc.ts
import { ipcMain } from 'electron';
import { loadSkeleton } from '../core/loader';
import { sampleSkeleton } from '../core/sampler';
import { SpineLoaderError } from '../core/errors';
import { buildSummary } from './summary';
import type { LoadResponse, SerializableError } from '../shared/types';

type KnownErrorKind = SerializableError['kind'];
const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);

export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath: string): Promise<LoadResponse> => {
    try {
      const t0 = performance.now();
      const load = loadSkeleton(jsonPath);          // may throw SpineLoaderError subclass
      const peaks = sampleSkeleton(load);           // pure — never throws for valid load
      const elapsedMs = performance.now() - t0;
      const summary = buildSummary(load, peaks, elapsedMs);
      return { ok: true, summary };
    } catch (err) {
      if (err instanceof SpineLoaderError && KNOWN_KINDS.has(err.name as KnownErrorKind)) {
        return { ok: false, error: { kind: err.name as KnownErrorKind, message: err.message } };
      }
      return {
        ok: false,
        error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
      };
    }
  });
}
```

```typescript
// src/main/summary.ts — pure conversion function
import type { LoadResult } from '../core/types';
import type { PeakRecord } from '../core/sampler';
import type { SkeletonSummary, PeakRecordSerializable } from '../shared/types';

export function buildSummary(
  load: LoadResult,
  peaks: Map<string, PeakRecord>,
  elapsedMs: number,
): SkeletonSummary {
  const { skeletonData } = load;

  // Count attachments by type by walking skins — cannot rely on peaks alone
  // (peaks only include textured attachments with source dims).
  const byType: Record<string, number> = {};
  let attachmentCount = 0;
  for (const skin of skeletonData.skins) {
    for (const attachmentsPerSlot of skin.attachments) {
      for (const [, attachment] of attachmentsPerSlot) {
        attachmentCount++;
        const type = attachment.constructor.name; // e.g. 'RegionAttachment', 'MeshAttachment'
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }

  const peaksArray: PeakRecordSerializable[] = [...peaks.values()].map(p => ({
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    slotName: p.slotName,
    attachmentName: p.attachmentName,
    animationName: p.animationName,
    time: p.time,
    frame: p.frame,
    peakScaleX: p.peakScaleX,
    peakScaleY: p.peakScaleY,
    peakScale: p.peakScale,
    worldW: p.worldW,
    worldH: p.worldH,
    sourceW: p.sourceW,
    sourceH: p.sourceH,
    isSetupPosePeak: p.isSetupPosePeak,
  }));

  return {
    skeletonPath: load.skeletonPath,
    atlasPath: load.atlasPath,
    bones: {
      count: skeletonData.bones.length,
      names: skeletonData.bones.map(b => b.name),
    },
    slots: { count: skeletonData.slots.length },
    attachments: { count: attachmentCount, byType },
    skins: {
      count: skeletonData.skins.length,
      names: skeletonData.skins.map(s => s.name),
    },
    animations: {
      count: skeletonData.animations.length,
      names: skeletonData.animations.map(a => a.name),
    },
    peaks: peaksArray,
    elapsedMs,
  };
}
```

### Pattern 3: electron-vite config with Tailwind v4

```typescript
// electron.vite.config.ts
// Source: starter (raw.githubusercontent.com/alex8088/quick-start/.../electron.vite.config.ts) + search result verified pattern
import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    // `build.externalizeDeps: true` is the default in v5 — no plugin needed.
    // Main process imports `src/core/loader.ts` + `src/core/sampler.ts` directly (same bundle).
    // `@esotericsoftware/spine-core` stays external by default (it's in `dependencies`).
  },
  preload: {
    // Preload is small (10 lines). `sandbox: true` works because our preload has ONE entry,
    // no external runtime deps beyond `electron` itself (which is always externalized).
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
```

### Pattern 4: Tailwind v4 `@theme inline` with Warm-Stone Tokens

```css
/* src/renderer/src/index.css */
@import "tailwindcss";

/* JetBrains Mono — advanced @font-face via Vite asset resolution */
/* Source: fontsource.org/fonts/jetbrains-mono/install — "Advanced @font-face Method" */
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  src:
    url("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2") format("woff2"),
    url("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff") format("woff");
}

/* Design tokens — LOAD-BEARING `inline` keyword (Finding #2). */
/* Inline required because these reference built-in --color-stone-* / --color-orange-* variables. */
@theme inline {
  /* Neutrals — warm stone base, two layers */
  --color-surface:   var(--color-stone-950);   /* app background */
  --color-panel:     var(--color-stone-900);   /* drop zone + debug panel */
  --color-border:    var(--color-stone-800);   /* subtle separators */
  --color-fg:        var(--color-stone-100);   /* primary text */
  --color-fg-muted:  var(--color-stone-400);   /* secondary text */

  /* Accent — Spine-adjacent orange */
  --color-accent:        var(--color-orange-500);
  --color-accent-muted:  var(--color-orange-300);
}

/* Non-reference tokens — plain @theme is fine */
@theme {
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

/* Baseline body — mount point and default chrome */
body {
  @apply bg-surface text-fg font-sans antialiased;
  margin: 0;
}
```

### Pattern 5: Drop Handler (Renderer)

```tsx
// src/renderer/src/components/DropZone.tsx
import { useState, useCallback, type DragEvent } from 'react';
import clsx from 'clsx';
import type { LoadResponse } from '../../../shared/types';

interface Props {
  onLoad: (resp: LoadResponse, path: string) => void;
}

export function DropZone({ onLoad }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      onLoad(
        { ok: false, error: { kind: 'Unknown', message: `Not a .json file: ${file.name}` } },
        file.name,
      );
      return;
    }

    // Preload resolves the absolute path via webUtils.getPathForFile(file).
    // We pass the FILE, not a string — D-09 intent preserved, mechanism updated for Electron 32+.
    const resp = await window.api.loadSkeletonFromFile(file);
    onLoad(resp, file.name);
  }, [onLoad]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        'w-full min-h-screen flex items-center justify-center',
        'border border-border bg-panel',
        'focus-visible:outline-2 focus-visible:outline-accent',
        isDragOver && 'ring-2 ring-accent bg-accent/5',
      )}
    >
      <p className="text-fg-muted font-mono text-sm">
        Drop a <code>.spine</code> JSON file anywhere in this window
      </p>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Importing `src/core/*` from renderer code.** Violates CLAUDE.md Fact #5. Enforce via tsconfig.web.json `include` (exclude `src/core/**`), electron-vite renderer config (no `src/core/` alias), AND a grep/test/ESLint rule. **Multiple defenses needed** — a tsconfig-only guard won't catch `import core from '../../core/loader'` at Vite bundle time.
- **Returning `LoadResult` directly from `ipcMain.handle`.** `LoadResult.skeletonData` is a `SkeletonData` class instance from spine-core — not structured-clone-serializable. Same for `LoadResult.atlas`. ALWAYS project through `buildSummary()`.
- **Using `sandbox: false` in `BrowserWindow`.** The canonical starter does this because `@electron-toolkit/preload` uses multi-file `require()`. Our preload is one file with one `electron` import — `sandbox: true` works AND is the security best practice.
- **Writing `@theme { --color-x: var(--color-stone-950); }` without `inline`** — see Finding #2. Utility generation silently produces variable references that break outside the root cascade.
- **Forgetting `ELECTRON_RENDERER_URL` check in main's `createWindow`.** [CITED: electron-vite docs HMR section] — dev mode loads URL; prod loads file. Omitting this → renderer fails to load in one of the two modes.
- **Hardcoding `process.platform === 'darwin'`.** Forbidden by D-23. If a macOS-only behavior is genuinely needed, flag it in the plan and justify.
- **Using `file.path` (deprecated/removed).** See Finding #1. Use `webUtils.getPathForFile(file)` in preload.
- **Importing `node:fs` / `node:path` from renderer code.** Would fail silently in the browser context anyway, but the tsconfig.web.json `types` should exclude `node` to make this a compile-time error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Electron bundler for main/preload/renderer with HMR | Custom Vite configs stitched together | `electron-vite` | Handles entry resolution, Electron externals, HMR env var (`ELECTRON_RENDERER_URL`), build output structure (`out/main`, `out/preload`, `out/renderer`). Pure gain. |
| Typed `window.api` surface | Manual `declare` in renderer + runtime augmentation in preload | Shared types module + single `.d.ts` augmentation | Canonical starter pattern. One source of truth. |
| `.dmg` creation | Hand-rolled `hdiutil` + `create-dmg` scripts | `electron-builder --mac dmg` | Handles background image, window position, app folder symlink, code signing hooks. |
| PostCSS + Tailwind v3 config | `postcss.config.cjs` + `tailwind.config.js` | `@tailwindcss/vite` plugin + `@theme` in CSS | Tailwind v4 pattern. Zero JS config. |
| Font loading | Google Fonts CDN `<link>` | `@fontsource/jetbrains-mono` npm + `@font-face` with Vite asset URLs | Offline, no FOIT/FOUC surprises, bundler handles hashing. |
| IPC error serialization | Throwing errors across IPC (they lose stack/name) | Discriminated-union response envelope (D-10) | `ipcMain.handle` auto-wraps thrown errors but only preserves `.message` — no `.name` — breaking our `kind` dispatch. Explicit envelope makes it bulletproof. |
| React state management (for Phase 1's single piece of state) | Zustand, Jotai, Redux | `useState` in `App.tsx` | D-20 lock. |
| Spine JSON parsing | Anything except `SkeletonJson.readSkeletonData` | Phase 0 `loadSkeleton()` | Already done. |
| AABB / sampler math | Anything | Phase 0 `sampleSkeleton()` | Already done. |
| Peak table rendering logic | React Table, TanStack, data grid library | `<pre>` element with Phase 0's `renderTable()` logic ported to return a string | D-16: Phase 1 uses `<pre>` monospace dump. Fancy tables land in Phase 2's `GlobalMaxRenderPanel`. |
| Drag-drop file handling | `react-dropzone` | Bare 30-line drop handler on a `<div>` | react-dropzone reconstructs File objects → `webUtils.getPathForFile` returns empty string. Bare handler is bug-free and tiny. |

**Key insight:** Phase 1 is almost entirely wiring. The math is done (Phase 0). The only net-new implementation is: (1) IPC handler + summary projection, (2) 2 React components + drop handler, (3) Tailwind tokens, (4) electron-vite + electron-builder config. Every temptation to "build something smart" is a red flag — the canonical starter + Phase 0 core do the work.

---

## Runtime State Inventory

**Skip condition:** Phase 1 is a greenfield addition of the Electron shell, not a rename/refactor. Phase 0's `src/core/`, `scripts/cli.ts`, and `tests/core/` code remains untouched. No stored data to migrate, no live services to reconfigure.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 1 has no persistence. (Session save/load is Phase 8.) | None |
| Live service config | None — no external services in Phase 1. | None |
| OS-registered state | None — no LaunchAgents, Task Scheduler, launchd plists. (Electron appId `com.spine-texture-manager.app` registers at install time of the `.dmg` ONLY if the user copies to `/Applications`; an unsigned `.dmg` that runs from the download folder registers nothing persistent.) | None |
| Secrets/env vars | None — no `.env`, no secrets, no CI/CD yet. | None |
| Build artifacts | `package-lock.json` updates when we `npm install` Phase 1 deps. `node_modules/` grows by ~300 MB (Electron binary + dev tooling). `.gitignore` already covers `node_modules`. Phase 1 adds `out/` (electron-vite bundle) and keeps the existing `dist/` exclusion (electron-builder default). | Update `.gitignore` to add `out/` |

**Everything else:** Phase 1 is purely additive. No renames. No removals from `src/core/`, `scripts/`, `tests/`, or `fixtures/`. The only file that CHANGES is `tsconfig.json` (becomes references-only), plus `.gitignore` (adds `out/`) and `package.json` (deps + scripts + build block).

---

## Common Pitfalls

### Pitfall 1: `LoadResult` not structured-clone-serializable
**What goes wrong:** IPC handler returns `LoadResult` directly → Electron throws "An object could not be cloned" or silently sends `{}`.
**Why it happens:** `LoadResult.skeletonData: SkeletonData` and `LoadResult.atlas: TextureAtlas` are class instances with methods/prototypes. Structured-clone strips those.
**How to avoid:** ALWAYS project via `buildSummary(load, peaks, elapsed)` returning plain JSON `SkeletonSummary` (D-21). Plan should have a typecheck/smoke test that verifies the IPC return is plain JSON.
**Warning signs:** Silent empty objects in renderer state; `TypeError` about cloning in main-process console.

### Pitfall 2: `@theme { --x: var(--color-stone-950); }` without `inline`
**What goes wrong:** `bg-surface` utility generates `background-color: var(--color-surface)` which chains through `var(--color-stone-950)` — which may or may not be defined at the cascade scope where `bg-surface` is applied (usually works, sometimes produces unstyled elements under dynamic shadow roots or `@scope` blocks).
**Why it happens:** Tailwind v4 documented this exact class of bug [CITED: tailwindcss.com/docs/theme#referencing-other-variables]. Without `inline`, the value is NOT captured at generation time.
**How to avoid:** Use `@theme inline { ... }` for any token that references another CSS variable (which is ALL our color tokens).
**Warning signs:** `bg-surface` appears fully transparent in a nested component; works in Chrome devtools "All CSS" but not in the computed style.

### Pitfall 3: `webUtils.getPathForFile` returns empty string
**What goes wrong:** File was constructed in JS (not backed by a disk file) → `getPathForFile` returns `""` → IPC handler calls `loadSkeleton("")` → `SkeletonJsonNotFoundError` with empty path.
**Why it happens:** The DragEvent File can come from `fetch().then(r => r.blob()).then(b => new File([b], 'x.json'))` or similar — no disk backing.
**How to avoid:** Preload validates `jsonPath !== ""` and returns `{ ok: false, error: { kind: 'Unknown', message: '...' } }` early. Shown in Pattern 1.
**Warning signs:** Error message says "not found" but user swears they dropped a real file.

### Pitfall 4: React component imports `src/core/loader` and "works in dev"
**What goes wrong:** Dev mode with `nodeIntegration: true` or `sandbox: false` may let the import succeed — but it violates CLAUDE.md Fact #5 and breaks in production with `contextIsolation: true`. Or worse, it silently loads `node:fs` in a sandboxed renderer and crashes with "module not found: node:fs".
**Why it happens:** There's no compile-time wall between `src/core/` and `src/renderer/` unless we build one.
**How to avoid:** Three-layer defense:
1. `tsconfig.web.json` `include` list does NOT list `src/core/**` (already true per starter pattern).
2. Renderer `vite.config` has NO alias pointing to `src/core/`.
3. Add a `tests/arch.spec.ts` that greps `src/renderer/**/*.{ts,tsx}` for the literal `from '../core` / `from '../../core` / `from '@core` and fails if any match. Runs under `npm run test`.
**Warning signs:** Renderer bundle in `out/renderer/` contains `node:fs` polyfill attempts.

### Pitfall 5: Sandbox breaks when preload adds a dependency
**What goes wrong:** Adding `import somelib from 'somelib'` to preload makes Electron fail to load it with "module not found" because sandboxed preloads only have a polyfilled `require` [CITED: electron-vite troubleshooting].
**Why it happens:** Sandbox preloads can't resolve arbitrary npm deps.
**How to avoid:** For Phase 1, preload imports ONLY from `electron` (no problem) and from `../shared/types` (type-only — erased at compile time). If we ever add a runtime preload dep, either (a) set `build.externalizeDeps: false` in preload config to bundle it, OR (b) move the logic to main via IPC.
**Warning signs:** Preload script fails to load; renderer's `window.api` is `undefined`.

### Pitfall 6: `electron-builder` packages `src/` into the `.dmg`
**What goes wrong:** Default `files` glob is `**/*` — includes source TS files, test fixtures, `.planning/`, `temp/`. `.dmg` bloats from ~100 MB to 500 MB+.
**Why it happens:** `files` field defaults are permissive. The canonical starter explicitly excludes `src/*`, `tsconfig.*`, `.env*`, etc.
**How to avoid:** Copy the canonical `electron-builder.yml` `files` block (shown in the `electron-builder.yml` content fetched above) and add our project-specific exclusions (`fixtures/*`, `temp/*`, `tests/*`, `.planning/*`, `scripts/*`).
**Warning signs:** `.dmg` > 200 MB (simple app should be ~80 MB for Electron + our code).

### Pitfall 7: HMR env var not checked in `createWindow`
**What goes wrong:** Dev mode loads `out/renderer/index.html` (which doesn't exist yet) instead of the Vite dev server URL → blank window.
**Why it happens:** `electron-vite dev` runs Vite at a URL and sets `process.env.ELECTRON_RENDERER_URL` for main to read. Main must branch on it.
**How to avoid:** Use the canonical `if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) { mainWindow.loadURL(...) } else { mainWindow.loadFile(...) }` pattern (shown in Pattern 1 of electron-vite docs).
**Warning signs:** `npm run dev` opens a blank Electron window; devtools shows no network requests.

### Pitfall 8: Tailwind v4 utility classes don't tree-shake with arbitrary values
**What goes wrong:** `ring-accent/5` (arbitrary opacity) may not generate at build time if Tailwind can't statically see it.
**Why it happens:** Tailwind v4 scans source files for class-string literals. Dynamic constructions like `` `ring-${color}/5` `` are invisible.
**How to avoid:** Use literal class strings. In our Phase 1 code, `'ring-accent bg-accent/5'` is a literal — safe. Don't concatenate class names from variables where Tailwind can't see them.
**Warning signs:** A class visible in devtools' HTML but with no matching CSS rule; production build missing styles that work in dev.

---

## Code Examples

All canonical patterns are in the **Architecture Patterns** section above (Patterns 1–5). These are verified against:
- `@alex8088/quick-start/packages/create-electron/playground/react-ts/` — the canonical starter (fetched verbatim)
- `electronjs.org/docs/latest/api/web-utils` — webUtils docs
- `tailwindcss.com/docs/theme` — Tailwind v4 theme docs
- `fontsource.org/fonts/jetbrains-mono/install` — Fontsource install docs
- Phase 0's own `scripts/cli.ts` — reference implementation for Pattern 5's DebugPanel table rendering (Phase 1 ports this logic to a React `<pre>`)

---

## Enforcing `core/ ↛ renderer/` Boundary (CLAUDE.md Fact #5)

Three-layer defense (all three needed — any single one is bypassable):

**Layer 1 — tsconfig.web.json `include`:**
```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": [
    "src/renderer/src/**/*",
    "src/renderer/src/env.d.ts",
    "src/preload/*.d.ts",
    "src/shared/**/*"
  ],
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@renderer/*": ["src/renderer/src/*"]
    }
  }
}
```
`src/core/**` is deliberately NOT in `include` → importing it from renderer yields TS2307 "Cannot find module".

**Layer 2 — electron-vite renderer alias limited to `@renderer`:**
```typescript
renderer: {
  resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
  plugins: [react(), tailwindcss()],
}
```
No alias for `@core` in renderer config → deep relative imports still *could* work (`'../../core/loader'`) but are caught by Layers 1 and 3.

**Layer 3 — arch-boundary test:**
```typescript
// tests/arch.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs'; // or fast-glob; vitest has globSync under node 22+

describe('Architecture boundary: renderer must not import from src/core', () => {
  it('no renderer file imports from src/core', () => {
    const files = globSync('src/renderer/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*\/core\/|from ['"]@core/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Renderer files importing core: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

This test runs under `npm test` (Phase 0's existing script) and gates every commit.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `file.path` on DragEvent File objects | `webUtils.getPathForFile(file)` in preload | Electron 32 (Sept 2024) | D-09 in CONTEXT.md needs mechanism update (path acquisition); IPC shape unchanged. |
| `externalizeDepsPlugin()` in electron-vite config | `build.externalizeDeps: true` (default) | electron-vite v5 (2025) | CONTEXT.md doesn't reference `externalizeDepsPlugin` — we're clean. Don't add it. |
| `postcss.config.cjs` + `tailwind.config.js` | `@import "tailwindcss"` + `@theme` in CSS | Tailwind v4 (Jan 2025) | D-11 already picks the v4 path. |
| `@theme { --x: var(--color-stone-950) }` | `@theme inline { --x: var(--color-stone-950) }` | Tailwind v4 (doc clarified late 2025) | CONTEXT.md specifics need `inline` keyword added. |
| `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` | Tailwind v4 | Already correct in D-11. |
| Forge Makers for `.dmg` | `electron-builder --mac dmg` | — | Style preference; both work. D-02 locks electron-builder. |
| `require('electron')` in renderer with `nodeIntegration: true` | `contextBridge.exposeInMainWorld` + `nodeIntegration: false` | Electron 12+ (stable years) | Locked by D-06. |

**Deprecated/outdated (do NOT use):**
- `file.path` — removed in Electron 32. Replacement: `webUtils.getPathForFile`.
- `externalizeDepsPlugin` — removed from recommended usage in electron-vite 5.
- `tailwind.config.js` with Tailwind v4 — use `@theme` in CSS.
- `postcss.config.cjs` for Tailwind — `@tailwindcss/vite` handles it.
- `sandbox: false` as default in new projects — `sandbox: true` is the 2024+ norm; use false only when you have multi-file preload with npm deps.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript 6.x (our current `^6.0.0`) works with `@electron-toolkit/tsconfig ^2.0.0`. | Standard Stack | MEDIUM — if 6.x base config isn't published, planner must downgrade to TS 5.9.x (canonical starter version) in Plan 1. Test: run `npm install @electron-toolkit/tsconfig` and `tsc --noEmit -p tsconfig.node.json` at plan-start. |
| A2 | `sandbox: true` works in our preload given we only import `electron` + type-only `../shared/types`. | Anti-patterns | LOW — verified pattern; if it ever breaks, fallback is `sandbox: false` per starter (security tradeoff but functional). |
| A3 | Electron 41's `webUtils.getPathForFile` does NOT have the macOS drag-drop bug from issue #44600 when called on a raw DragEvent file (we're not using react-dropzone). | Critical Finding #1 | LOW — issue was closed by the reporter; root cause was library-specific. But if the bug resurfaces on macOS 15.x + Electron 41, manual smoke test during Phase 1 execution will catch it immediately; fallback is a native file-picker (`dialog.showOpenDialog`) triggered by a click handler, which is orthogonal to drag-drop and always works. |
| A4 | `electron-vite build` in Phase 1 successfully emits `out/main/index.js`, `out/preload/index.js`, `out/renderer/` — no custom config beyond the starter template. | Project Structure | LOW — canonical pattern, verified against multiple public repos. |
| A5 | `electron-builder --mac dmg` produces a working unsigned `.dmg` on Apple Silicon macOS 14+ without any additional tooling. | Package Strategy | LOW — unsigned `.dmg` is the historical default for dev builds. Macs will show a Gatekeeper warning on first launch (expected for unsigned apps). |
| A6 | `structuredClone` handles our `SkeletonSummary` shape (plain primitives + Map-less plain arrays) across IPC without issue. | Architecture | LOW — verified by spec: Structured Clone Algorithm supports primitives, arrays, plain objects, Map, Set, Date. Our summary is all primitives + arrays. |
| A7 | The canonical `@alex8088/quick-start/react-ts` starter's `sandbox: false` is not load-bearing for our use case — we can use `sandbox: true`. | Anti-patterns | LOW — the starter sets `sandbox: false` because it uses `@electron-toolkit/preload` (multi-file). We don't use that toolkit; our preload is self-contained. |
| A8 | Dropping a file with a path containing spaces or Unicode works with `webUtils.getPathForFile` and propagates cleanly through IPC + `loadSkeleton`. | Common Pitfalls | LOW — paths are strings; `structuredClone` and `fs.readFileSync` handle Unicode. Smoke test with a path containing a space during Phase 1 Task 4 (drag-drop). |

**If this table is empty:** N/A — it is not empty. 8 assumptions flagged; A1 is the only MEDIUM-risk one.

---

## Open Questions

1. **TypeScript 6 vs 5.9 for Phase 1** — planner must resolve in Plan 1.
   - What we know: Canonical starter pins TS 5.9.x. Our Phase 0 uses `^6.0.0` and compiles cleanly.
   - What's unclear: Whether `@electron-toolkit/tsconfig` extends cleanly under TS 6.x.
   - Recommendation: Plan 1 Task 1 runs a bootstrap spike — `npm install @electron-toolkit/tsconfig` + `tsc --noEmit`. If green, stay on 6.x. If red, downgrade to 5.9.x.

2. **`electron-builder.yml` vs. `package.json` `build` key** — both work; no functional difference.
   - CONTEXT.md `<portability>` section shows a YAML diff, implying `electron-builder.yml`.
   - Canonical starter uses `electron-builder.yml`.
   - Recommendation: Use `electron-builder.yml` (more readable, keeps package.json short). Matches starter.

3. **Preload API name: `loadSkeleton(path: string)` vs. `loadSkeletonFromFile(file: File)`** — CONTEXT.md D-07 says `loadSkeleton(path: string)` but Finding #1 requires the renderer to pass a File (preload calls `webUtils.getPathForFile`).
   - What we know: User-facing API shape is planner's call.
   - What's unclear: Whether to stick with the CONTEXT.md name (and document internally that it takes a File) or add a new name.
   - Recommendation: Rename to `loadSkeletonFromFile(file: File)` for clarity. Document the D-09 update in Phase 1 Plan 1 rationale.

4. **Renderer root: `src/renderer/` vs. `src/renderer/src/`** — canonical starter uses `src/renderer/src/`, CONTEXT.md `<domain>` block says `src/renderer/`.
   - What we know: electron-vite's default convention is `src/renderer/index.html` at the renderer root; canonical starter adds an extra `src/` level to separate HTML entry from TSX source.
   - Recommendation: Follow canonical starter (`src/renderer/src/`) — cleaner separation and matches the tsconfig.web.json pattern (which assumes `src/renderer/src/`).

5. **electron-vite `out/` directory vs. `dist/` collision with electron-builder** — electron-vite defaults to `out/` for bundle output; electron-builder defaults to `dist/` for `.dmg` output. No collision, but make sure both are gitignored.
   - Recommendation: `.gitignore` should explicitly list both. Currently has `dist/` — add `out/`.

6. **Window size & titleBarStyle** — D-27 forbids macOS-only `titleBarStyle: 'hiddenInset'`. Default chrome it is.
   - No open question; just noting for plan.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 18+ | All tooling | ✓ (assumed from Phase 0 — `npm test` works) | (existing) | — |
| npm | Package install | ✓ | (existing) | — |
| macOS (for `.dmg` build) | Phase 1 exit criterion | ✓ (user is on darwin per `/env` block) | Darwin 25.3.0 (macOS 14 Sonoma or later) | — |
| Xcode Command Line Tools | electron-builder native-module postinstall (if any); DMG creation uses `hdiutil` which requires CLT | ✓ (assumed; npm works) | — | If missing: `xcode-select --install` |
| wine | Cross-compiling `.exe` from macOS (Phase 9, not Phase 1) | ✗ | — | Not needed until Phase 9. |
| Electron 41 binary | `electron-vite dev`, `electron-builder` | Auto-downloaded on `npm install electron` | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None for Phase 1.

---

## Validation Architecture

> workflow.nyquist_validation is not explicitly false in .planning/config.json — treated as enabled per convention.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest ^4.0.0` (already installed Phase 0) |
| Config file | `vitest.config.ts` at project root (exists) |
| Quick run command | `npm run test` (`vitest run`) |
| Full suite command | `npm run test` + `npm run typecheck` + `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (CLI smoke) |
| Phase gate | All existing Phase 0 tests (35 tests + 1 skip) still green + Phase 1 arch-boundary test + typecheck:node + typecheck:web + `electron-vite build` succeeds + `electron-builder --mac dmg --dir` succeeds (dry-pack, no signing) + manual drop test on `SIMPLE_TEST.json` |

### Phase Requirements → Test Map

| Req ID / Deliverable | Behavior | Test Type | Automated Command | Pass Signal | File Exists? |
|------|----------|-----------|-------------------|-------------|--------------|
| F1 (integrated) — loader invoked from main | `ipcMain.handle('skeleton:load', SIMPLE_TEST.json)` returns `{ ok: true, summary: { ... }}` | Integration (Node) | `vitest run tests/main/ipc.spec.ts` | Returned object has `ok: true`, `summary.bones.count === 9` (matches Phase 0 fixture), `summary.peaks.length === 4` | ❌ Wave 0 — needs `tests/main/ipc.spec.ts` |
| F1 + error envelope (D-10) | `ipcMain.handle` with bogus path returns `{ ok: false, error: { kind: 'SkeletonJsonNotFoundError', message: ... }}` | Integration (Node) | `vitest run tests/main/ipc.spec.ts -t error` | Returned object has `ok: false`, `error.kind === 'SkeletonJsonNotFoundError'` | ❌ Wave 0 |
| N4.1 — `.dmg` packageable | `electron-builder --mac dmg --dir` exits 0 on this machine | Integration (shell) | `npm run build:dry` (new script: `electron-vite build && electron-builder --mac dmg --dir`) | Exit code 0; `dist/mac-arm64/Spine Texture Manager.app` exists | ❌ Wave 0 — needs `build:dry` script |
| D-23 — portability | Renderer grep for `process.platform`, `os.platform()`, `titleBarStyle: 'hiddenInset'`, `trafficLightPosition`, hardcoded `/` path literals | Unit (grep) | `vitest run tests/arch.spec.ts -t portability` | No matches in `src/renderer/` or `src/main/` or `src/preload/` | ❌ Wave 0 — `tests/arch.spec.ts` new |
| CLAUDE.md Fact #5 — renderer boundary | Renderer files don't import `src/core/*` | Unit (grep) | `vitest run tests/arch.spec.ts -t core-boundary` | No `src/renderer/**/*.{ts,tsx}` file matches `from ['"][^'"]*\/core\/|from ['"]@core` | ❌ Wave 0 |
| D-10 error serialization | `SerializableError.kind` values match `SpineLoaderError.name` values byte-for-byte | Unit | `vitest run tests/shared/types.spec.ts` | Literal union `'SkeletonJsonNotFoundError' \| 'AtlasNotFoundError' \| 'AtlasParseError' \| 'Unknown'` matches values in `src/core/errors.ts` | ❌ Wave 0 (can be part of existing patterns) |
| D-21 summary shape | `buildSummary` output is `structuredClone`-serializable (no class instances, no functions) | Unit | `vitest run tests/main/summary.spec.ts` | `structuredClone(summary)` returns equal object (deep-equal check) | ❌ Wave 0 |
| D-11/D-12/D-14 — Tailwind tokens resolvable | Built CSS includes `--color-surface`, `--color-accent`, etc. | Unit (build-time) | `npm run build` then `grep '"--color-surface"' dist/` | Output CSS file contains the token | ❌ Wave 0 — covered by `electron-vite build` success (if compile fails, bug is obvious) |
| Manual drop test (exit criterion) | Drag `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` into dev window → debug panel shows CIRCLE/SQUARE/SQUARE2/TRIANGLE rows matching CLI output | Manual | `npm run dev` (human runs the drop) | 4 attachment rows visible in DebugPanel; console.log shows identical data | ❌ Manual — NO automation possible in Phase 1 (no Playwright) |
| Windows-portability dry-check | `electron-builder --win nsis --dir` doesn't explode on config errors (build itself may fail without wine — that's OK) | Integration (shell, optional) | `npm run build:win:dry` | Exits with config-valid error (not syntax error); or succeeds if wine is present | ❌ Wave 0 — optional, can be `skip` until Phase 9 |

### Sampling Rate (per atomic commit cadence)
- **Per task commit:** `npm run typecheck && npm run test` (full test suite — it's still fast, ~2.5 ms sampler + ~100 ms overhead for 35 tests)
- **Per plan merge:** Full typecheck + test + `electron-vite build` (catches bundler-level issues that TS doesn't)
- **Per phase gate (`/gsd-verify-work 1`):** Full suite + `electron-builder --mac dmg --dir` (catches packaging-level issues) + manual drop smoke on `SIMPLE_TEST.json` + manual resize test (window behaves on macOS)

### Wave 0 Gaps (must create these before implementation tasks can run)

- [ ] `tests/main/ipc.spec.ts` — spawns `ipcMain.handle` in a test harness OR directly imports the handler function and invokes it (simpler). Covers F1-integrated + D-10 error envelope.
- [ ] `tests/main/summary.spec.ts` — covers `buildSummary` pure function; tests `structuredClone` round-trip.
- [ ] `tests/arch.spec.ts` — greps `src/renderer/` for forbidden `src/core` imports (CLAUDE.md Fact #5) + greps `src/main/`, `src/renderer/`, `src/preload/` for D-23 portability anti-patterns.
- [ ] `tests/shared/types.spec.ts` (optional — could merge with ipc.spec.ts) — verifies `SerializableError.kind` union matches `SpineLoaderError` subclass `name` values.
- [ ] `npm` script: `"build:dry": "electron-vite build && electron-builder --mac dmg --dir"` — dry-pack for exit-gate validation.
- [ ] `npm` script: `"typecheck": "npm run typecheck:node && npm run typecheck:web"` (split from current `tsc --noEmit`).
- [ ] Install `vitest` globbing — either use `globSync` from `node:fs` (Node 22+) or add `fast-glob` dev dep (pick whichever vitest already pulls).
- [ ] Framework install: `npm install --save-dev electron electron-vite electron-builder @vitejs/plugin-react tailwindcss @tailwindcss/vite @electron-toolkit/tsconfig @types/react @types/react-dom` + `npm install --save react react-dom @fontsource/jetbrains-mono`.

### What an Executor Agent Would Run to Self-Verify

For each phase 1 plan task commit:
```bash
# 1. Unit + integration tests pass
npm test

# 2. Typecheck both node and web contexts
npm run typecheck

# 3. If the task touches src/main/, src/preload/, or electron.vite.config.ts:
npm run build:dry  # electron-vite build + electron-builder --mac dmg --dir

# 4. CLI smoke still works (Phase 0 guarantee intact)
npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json
```

Final phase-gate verification (human-driven):
```bash
npm run dev
# Drag fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json into the window.
# Expected: debug panel shows header (9 bones, 5 slots, 4 attachments, 1 skin, 4 animations)
# + <pre> table matching CLI output exactly (CIRCLE/SQUARE/SQUARE2/TRIANGLE rows, peaks identical).
# Expected: console.log (devtools) echoes the same data.
# Expected: Error case — drop a .txt file → inline orange "Not a .json file" error.
# Expected: Error case — drop fixtures/missing-atlas/foo.json (create one) → "AtlasNotFoundError: Expected atlas at ..." inline error.
```

### Expected Pass Signals Summary

| Signal | What It Means |
|--------|---------------|
| `npm run test` green (≥ 35 existing + new arch/ipc/summary tests) | Wave 0 tests pass; boundaries enforced |
| `npm run typecheck` green (both node + web configs) | Types compose cleanly across main/preload/renderer |
| `npm run build:dry` exit 0; `dist/mac-arm64/Spine Texture Manager.app` exists | electron-builder config is valid; `.dmg` would pack |
| Manual drop: 4-row debug panel appears within 50 ms of drop | Happy path works; F1-integrated ✓; D-16/D-17/D-19 ✓ |
| Manual drop of non-.json: inline orange error | Error envelope + renderer dispatch ✓; D-10/D-19 ✓ |
| Window opens at 1280×800, shows stone-950 background, orange-500 drop ring on drag-over | D-11/D-12/D-13/D-14 ✓ |
| DevTools console.log of debug dump | D-17 ✓ |

---

## Security Domain

> `security_enforcement` is not explicitly set in `.planning/config.json` — treated as enabled (absent = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Electron's main/renderer separation with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — principal of least privilege (D-06). |
| V2 Authentication | no | No users, no auth. Single-user desktop app. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | partial | Only the preload's `window.api` surface is exposed to the renderer — the `ipcRenderer` global is NOT exposed. This is the Electron-canonical principle of least privilege for IPC. |
| V5 Input Validation | yes | IPC handler receives a `jsonPath: string` from the renderer. Validation: `loadSkeleton()` uses `fs.readFileSync(path)` which throws `SkeletonJsonNotFoundError` for unreadable paths — we rely on that + the typed error envelope. Filename-extension check (`endsWith('.json')`) happens in the renderer as UX (not a security boundary). |
| V6 Cryptography | no | No encryption needed in Phase 1. |
| V7 Error Handling | yes | Typed error envelope (D-10) — we do NOT leak stack traces, file-system structure beyond the attempted path, or internal class hierarchy to the renderer. Only `{kind, message}`. `kind` is one of 4 known values; `message` is the user-friendly string from `SpineLoaderError.message`. |
| V8 Data Protection | partial | No persistent storage in Phase 1. In-memory skeleton/atlas data lives only in main process; renderer sees a projected summary. |
| V10 Malicious Code | yes | CSP (Content Security Policy) should be set in `index.html` or via main-process `webRequest` to prevent untrusted content from running in the renderer. Phase 1 ships an entirely-local renderer (no CDN, no third-party iframes), so risk is minimal. |
| V12 Files & Resources | **yes** | The user drag-drops arbitrary files. The main process reads them with `fs.readFileSync` via `loadSkeleton`. Risks: (a) path traversal — not applicable, we use the user-provided absolute path as-is; (b) zip-bomb-style resource exhaustion — Phase 0 sampler is ~10 ms on small rigs but could hang on adversarial skeletons. For Phase 1, accept the risk (this is a single-user local tool); Phase 9 should consider a timeout. |

### Known Threat Patterns for Electron

| Pattern | STRIDE | Standard Mitigation | Phase 1 Status |
|---------|--------|---------------------|----------------|
| Remote code execution via XSS in renderer | Elevation of Privilege | `contextIsolation: true`, `nodeIntegration: false`, CSP | ✓ D-06 locks the webPreferences; CSP should be added in `index.html` |
| `ipcRenderer` exposed to renderer | Elevation of Privilege | `contextBridge.exposeInMainWorld` with a minimal typed surface | ✓ D-07 locks the pattern; our `window.api` exposes ONE method (`loadSkeletonFromFile`) |
| Arbitrary file read via unvalidated IPC path | Information Disclosure | The user's own drag-drop provides the path; we don't accept arbitrary paths from untrusted sources. | ✓ Phase 1 only reads files the user explicitly drops. No network-sourced paths. |
| `remote` module abuse | Elevation of Privilege | Don't enable `remote` (it's deprecated in Electron 14+ and removed in 22+) | ✓ Not enabled. Not even available in Electron 41. |
| Open redirect / malicious `webview` | Spoofing | Disable `webviewTag`, don't call `shell.openExternal` with untrusted URLs | ✓ We don't use webviews or openExternal in Phase 1. |
| Sensitive data in devtools | Information Disclosure | Close devtools in production, or use `app.isPackaged` check | ⚠ Planner decision: open devtools in dev (`mainWindow.webContents.openDevTools()` when `!app.isPackaged`). Never in production. Canonical pattern. |
| Dropped file stolen via leaked path | Information Disclosure | Don't log absolute paths to console.log in production | ⚠ D-17 says echo debug dump to console.log. Acceptable for Phase 1 (single-user local tool); revisit for multi-user/shared scenarios. |
| Supply-chain compromise (npm deps) | Tampering | Pin versions; run `npm audit`; keep `package-lock.json` committed | ⚠ Planner should include `npm audit` in the phase-gate. Current phase 0 doesn't check. |
| Unsigned `.dmg` masquerading as another app | Spoofing | Code sign + notarize | ✗ Phase 1 ships UNSIGNED per D-04. Acceptable for developer-local use; must be resolved before public distribution (Phase 9). |

### Phase 1 Security Posture (summary)

- ✓ `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- ✓ Minimal contextBridge surface (ONE method)
- ✓ Typed error envelope — no stack-trace leakage
- ✓ No network calls, no CDN, no third-party runtime deps in renderer
- ⚠ Add CSP `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self';">` to `index.html` (unsafe-inline needed only if Tailwind emits inline style — verify; otherwise drop it)
- ⚠ DevTools enabled in dev only (`if (!app.isPackaged) mainWindow.webContents.openDevTools()`)
- ✗ Unsigned — acknowledged deferral for Phase 9

---

## Sources

### Primary (HIGH confidence)
- `/alex8088/electron-vite-docs` (Context7) — project structure, config, dependency handling, HMR, TypeScript, isolated-build, preload sandbox limitations. [multiple topics fetched via ctx7]
- `/electron-userland/electron-builder` (Context7) — `.dmg` config, `mac` + `dmg` + `files` fields, multi-target cross-platform config. [multiple topics fetched via ctx7]
- `electronjs.org/docs/latest/api/web-utils` — `webUtils.getPathForFile` API. [WebFetch]
- `electronjs.org/docs/latest/breaking-changes` — File.path removal in Electron 32 (verbatim quote cited). [WebFetch]
- `electronjs.org/docs/latest/tutorial/ipc` — ipcMain.handle / Structured Clone Algorithm semantics. [WebFetch]
- `electronjs.org/blog/electron-41-0` — Electron 41 breaking changes (none affect our plane). [WebFetch]
- `tailwindcss.com/docs/installation/using-vite` — Tailwind v4 + Vite install. [WebFetch]
- `tailwindcss.com/docs/theme` and `tailwindcss.com/docs/theme#referencing-other-variables` — `@theme` and `@theme inline`. [WebFetch]
- `fontsource.org/fonts/jetbrains-mono/install` — Fontsource JetBrains Mono install. [WebFetch]
- `raw.githubusercontent.com/alex8088/quick-start/.../react-ts/` — canonical starter files (package.json, tsconfig.web.json, tsconfig.node.json, electron-builder.yml, .gitignore, electron.vite.config.ts, preload/index.d.ts) verbatim. [WebFetch]
- Local: `src/core/loader.ts`, `src/core/sampler.ts`, `src/core/errors.ts`, `src/core/types.ts`, `scripts/cli.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md`, `CLAUDE.md`. [Read]
- `npm view` (registry) — version confirmations for electron 41.3.0, electron-vite 5.0.0, electron-builder 26.8.1, tailwindcss 4.2.4, @tailwindcss/vite 4.2.4, react 19.2.5, @fontsource/jetbrains-mono 5.2.8, vite 7.2.6, @vitejs/plugin-react 6.0.1. [Bash]

### Secondary (MEDIUM confidence)
- GitHub issue `electron/electron#44600` — confirmed closed (bug was react-dropzone-specific, resolved). [WebFetch + gh CLI]
- `jiaopucun.com/2025/04/04/drag-drop-files-electron-file-paths/` — 2025 complete pattern for drag-drop path retrieval post-`file.path` removal. [WebFetch]
- Blog post `iifx.dev/en/articles/.../electron-vite-and-tailwind-v4` — search result only, page unreachable on fetch (503); confirmed via other sources. [WebSearch]
- `blog.mohitnagaraj.in/.../Electron_Shadcn_Guide` — 2025 setup guide; search result. [WebSearch]
- `github.com/GeorgiMY/Vite-Electron-Template` — public Electron + Vite + Tailwind v4 reference repo; package.json verified. [WebFetch]
- `electron-vite.org/guide/build` — production build notes. [WebSearch result summary]

### Tertiary (LOW confidence — flagged for validation)
- `restack.io/p/vite-answer-adding-fonts-guide` — Vite font handling (search-result-only; used as directional hint, not verbatim).
- `dev.to/.../phamquyetthang/build-a-cross-platform-desktop-app-with-electron-and-react-typescript-tailwind-css` — blog walkthrough (search-result snippet only).

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every version verified against `npm view`; canonical starter pattern verified by fetching raw files.
- Architecture: **HIGH** — patterns verified against canonical electron-vite starter + official Electron docs + Tailwind v4 docs.
- Pitfalls: **HIGH** — every pitfall traces to a concrete Electron docs breaking-change, Tailwind docs caveat, or canonical-starter choice.
- CONTEXT.md D-09 revision (Finding #1): **HIGH** — two authoritative sources (breaking-changes page + webUtils API docs) + issue-tracker closure confirmation.
- Tailwind `@theme inline` (Finding #2): **HIGH** — documented explicitly on tailwindcss.com/docs/theme.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days; Electron ships a new major every 8 weeks, check `webUtils` + breaking-changes before starting a rebuild this far later).
