---
phase: 01-electron-react-scaffold
plan: 03
subsystem: ui-scaffold
tags: [electron, preload, contextbridge, webutils, react19, strictmode, tailwindcss4, theme-inline, jetbrains-mono, csp, arch-boundary, layer3-active]

# Dependency graph
requires:
  - phase: 01-electron-react-scaffold
    provides: Plan 01-01 — electron-vite 5 + tailwind v4 toolchain + three-tsconfig split; Plan 01-02 — src/shared/types.ts IPC contract + src/main/{index,ipc,summary}.ts + Wave 0 tests
provides:
  - src/preload/index.ts — contextBridge window.api.loadSkeletonFromFile via webUtils.getPathForFile (D-09 mechanism correction)
  - src/preload/index.d.ts — global Window.api type augmentation (bridges Api from src/shared/types into renderer project)
  - src/renderer/index.html — Vite HTML entry with CSP meta restricting default/style/script/img/font sources; mounts #root + /src/main.tsx module script
  - src/renderer/src/main.tsx — React 19 createRoot with StrictMode + side-effect ./index.css import
  - src/renderer/src/App.tsx — AppState discriminated union (4 states per D-20) + D-18 pre-drop empty-state render
  - src/renderer/src/env.d.ts — Vite env type shim for renderer
  - src/renderer/src/index.css — Tailwind v4 CSS-first config — @theme inline warm-stone + orange tokens + @font-face JetBrains Mono
  - out/ bundle tree via electron-vite build — out/main/index.js + out/preload/index.mjs + out/renderer/index.html + CSS/JS/woff2 assets
affects: [01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS comment `*/` trap — avoid writing `--something-*/--other-*` inside C-style comments; the first `*/` ends the comment regardless of intent. Reword to `something and other palette variables` (parallel to 01-01 Dev #4 grep-literal compliance pattern)."
    - "electron-vite 5 + package.json `\"type\": \"module\"` emits preload as `index.mjs`, not `.js`. Main must reference `'../preload/index.mjs'` when joining under __dirname. Canonical electron-vite ESM pattern."
    - "globalThis-as-fallback preload idiom — in the `!process.contextIsolated` branch, using `(globalThis as unknown as { api: Api }).api = api` avoids the DOM `window` global so the file typechecks under tsconfig.node.json's ES2022-only lib set (the node project includes src/preload/index.ts; DOM is not pulled in there)."
    - "CSP `'unsafe-inline'` still in dev; built prod HTML emits zero <style>/style= attributes (all CSS extracted to assets/*.css). Plan 01-05 can tighten style-src to `'self'` only."

key-files:
  created:
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/renderer/index.html
    - src/renderer/src/main.tsx
    - src/renderer/src/App.tsx
    - src/renderer/src/env.d.ts
    - src/renderer/src/index.css
  modified:
    - src/main/index.ts

key-decisions:
  - "Preload fallback branch uses globalThis, not window — keeps src/preload/index.ts typecheckable under tsconfig.node.json's ES2022-only lib (which has no DOM types). Semantically equivalent in the renderer at runtime; the branch only fires when process.contextIsolated is false (never, under D-06)."
  - "electron-vite emits preload as index.mjs under `\"type\": \"module\"`; Plan 01-02's `../preload/index.js` reference in src/main/index.ts was a latent bug that only surfaced when a real preload compiled. Corrected in 01-03 Task 3 commit — canonical electron-vite ESM pattern."
  - "CSS comment trap resolved via prose rewording (not escape) — replaced `--color-stone-*/--color-orange-*` with `Tailwind's built-in stone and orange palette variables`. Same class of issue as 01-01 Dev #4 and 01-02 Dev #3/#4: documentation comments triggering grep/parser machinery. Pattern established for Phase 1 CSS authoring too."
  - "CSP `'unsafe-inline'` retained in style-src for Plan 01-03 — confirmed by inspection of `out/renderer/index.html` (zero inline <style>, zero style= attributes) that Plan 01-05 can safely tighten to `style-src 'self'`. Flagged for Plan 01-05 verification."

patterns-established:
  - "Atomic commit scope `01-03` for Phase 1 Plan 03 work: feat(01-03) exclusively (no test commits — Wave 0 tests already wrote in 01-02; this plan only adds implementation surface that the existing arch.spec.ts Layer 3 covers)."
  - "Layer 3 arch.spec.ts now scans REAL renderer files on every test run — previously vacuous. src/renderer/src/{App.tsx,main.tsx} confirmed importing only from ../../shared/types.js (safe) + react/react-dom/react packages (external). No src/core offenders."
  - "Sandbox-constrained preload — src/preload/index.ts imports only from 'electron' (always externalized) + type-only from ../shared/types.js (erased at compile time). Any future runtime npm dep addition to preload will fail at Electron load time under sandbox: true."

requirements-completed: [F1.1, F1.2, F1.4]

# Metrics
duration: 6min 9s
completed: 2026-04-23
---

# Phase 01 Plan 03: Preload + Renderer Bootstrap Summary

**Preload contextBridge surface with `webUtils.getPathForFile` (D-09 RESEARCH correction) + React 19 + StrictMode renderer bootstrap + AppState discriminated union (D-20) + Tailwind v4 `@theme inline` warm-stone stylesheet (D-12/D-14 RESEARCH correction) + self-hosted JetBrains Mono; `npx electron-vite build` now emits a complete `out/{main,preload,renderer}/` bundle tree.**

## Performance

- **Duration:** ~6 min 9 s
- **Started:** 2026-04-23T10:47:27Z
- **Completed:** 2026-04-23T10:53:36Z
- **Tasks:** 3
- **Files created:** 7 (src/preload/index.ts, src/preload/index.d.ts, src/renderer/index.html, src/renderer/src/main.tsx, src/renderer/src/App.tsx, src/renderer/src/env.d.ts, src/renderer/src/index.css)
- **Files modified:** 1 (src/main/index.ts — preload path correction `index.js` → `index.mjs`)

## Accomplishments

- Preload surface landed as a single-method contextBridge exposure: `window.api.loadSkeletonFromFile(file: File): Promise<LoadResponse>`. `webUtils.getPathForFile(file)` resolves the drag-drop path in preload (D-09 mechanism correction per RESEARCH Finding #1 — Electron 32 removed `file.path`; we target Electron 41). Pitfall 3 empty-path guard returns typed `{ok: false, error: {kind: 'Unknown', ...}}` envelope inline, no round-trip to main. The raw `ipcRenderer`/`webUtils` globals are NEVER exposed to the renderer.
- `src/preload/index.d.ts` augments the `Window` interface with `api: Api` via `declare global`; `src/shared/types.ts` is the single source of truth for the `Api` type (consumed by preload implementation + renderer global).
- Renderer bootstrap shipped: `src/renderer/index.html` has a CSP meta tag locking `default-src`, `script-src`, `style-src`, `img-src`, `font-src` to `'self'` (+ `'unsafe-inline'` for styles during dev; Plan 01-05 can tighten — built HTML confirms zero inline styles). `main.tsx` mounts `<App />` under `<React.StrictMode>` via `createRoot` with side-effect `./index.css` import.
- `App.tsx` owns the `AppState` discriminated union per D-20: `{idle} | {loading, fileName} | {loaded, fileName, summary} | {error, fileName, error}`. Pre-drop empty state per D-18 renders a full-window message; Plan 01-04 will wire DropZone + DebugPanel through this seam.
- `index.css` uses Tailwind v4 CSS-first config — `@import "tailwindcss"` + `@theme inline { ... }` with warm-stone (stone-950/900/800/100/400) + orange-accent (500/300) tokens (D-12/D-14 RESEARCH Finding #2 correction — `inline` keyword is load-bearing so utility classes inline `var()` references at utility-generation time). `@font-face` self-hosts JetBrains Mono via `@fontsource/jetbrains-mono` woff2/woff asset URLs (D-15). Body baseline via `@apply bg-surface text-fg font-sans antialiased`.
- `npx electron-vite build` succeeds cleanly (zero warnings after the CSS comment-trap fix) and emits: `out/main/index.js` (16.17 kB), `out/preload/index.mjs` (0.66 kB), `out/renderer/index.html` + `assets/index-*.css` (7.44 kB) + `assets/index-*.js` (556.12 kB) + two JetBrains Mono assets (21 + 27 kB).
- Layer 3 `tests/arch.spec.ts` is now actively scanning real renderer files; still green (zero src/core imports under src/renderer/, zero D-23 portability offenders anywhere in src/{main,preload,renderer}/).
- Phase 0 invariants preserved: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` exits 0 with the full CIRCLE/SQUARE/SQUARE2/TRIANGLE table at 22 ms on 120 Hz sampling.

## Task Commits

Each task committed atomically:

1. **Task 1: Preload contextBridge surface with `webUtils.getPathForFile` (D-09 correction)** — `bd91356` (feat)
2. **Task 2: Renderer bootstrap — App.tsx state machine + CSP + React 19 entry** — `0023eb7` (feat)
3. **Task 3: Renderer stylesheet with `@theme inline` warm-stone tokens + JetBrains Mono** — `0cd2399` (feat)

**Plan metadata:** to follow (docs: complete plan).

## Files Created/Modified

### Created

- `src/preload/index.ts` — Electron preload (45 lines body + docstring). Imports `contextBridge, ipcRenderer, webUtils` from 'electron' and type-only `Api, LoadResponse` from `../shared/types.js`. Single-method `api` object; `webUtils.getPathForFile(file)` resolves the drag-drop File; empty-path → typed `Unknown` envelope. `process.contextIsolated` branch + `globalThis` fallback.
- `src/preload/index.d.ts` — Ambient type augmentation (20 lines). `declare global { interface Window { api: Api; } }` with type-only import from `../shared/types.js`.
- `src/renderer/index.html` — Vite HTML entry (17 lines). CSP meta restricting default/style/script/img/font sources to `'self'` (+ `'unsafe-inline'` for styles + `data:` for img/font). `#root` mount + `/src/main.tsx` module script.
- `src/renderer/src/main.tsx` — React 19 bootstrap (25 lines). `createRoot` + `<StrictMode>` around `<App />`; throws if `#root` not found; side-effect `./index.css` import.
- `src/renderer/src/App.tsx` — Top-level state machine (55 lines). `export type AppState` with 4 variants per D-20; `useState<AppState>({status: 'idle'})`; exhaustive render of all four branches; imports only from `../../shared/types.js` (Layer 3 arch.spec.ts scans this file — zero core offenders).
- `src/renderer/src/env.d.ts` — Vite env shim (8 lines). `/// <reference types="vite/client" />` + `export {}`.
- `src/renderer/src/index.css` — Tailwind v4 stylesheet (70 lines). `@import "tailwindcss"`; `@font-face` for JetBrains Mono via `@fontsource/...` asset URLs; `@theme inline { ... }` block with 7 color tokens + 2 font tokens; body baseline via `@apply`.

### Modified

- `src/main/index.ts` — preload join target corrected from `'../preload/index.js'` to `'../preload/index.mjs'`. Plan 01-02's original value was a latent bug — electron-vite emits preload as `.mjs` under `"type": "module"`, so the Electron runtime would have failed to load preload in a packaged build. Rule 3 deviation (see below).

## Decisions Made

- **Preload `globalThis` fallback, not `window`.** The non-contextIsolated fallback branch writes `(globalThis as unknown as { api: Api }).api = api` rather than `(window as unknown as ...).api = api`. Reason: `tsconfig.node.json` includes `src/preload/index.ts` with `lib: ["ES2022"]` (no DOM types), so `window` is not a known global. `globalThis` is ES2020 standard; under contextIsolation: true (pinned in `src/main/index.ts`) this branch never runs anyway. Semantic equivalent; zero runtime cost.
- **electron-vite emits preload as `.mjs`.** Under `package.json` `"type": "module"`, electron-vite 5 compiles both main and preload as ESM; preload lands at `out/preload/index.mjs`. This is the canonical electron-vite pattern. Plan 01-02's `src/main/index.ts` referenced `'../preload/index.js'` — corrected in this plan (Deviation #2 below).
- **CSP `'unsafe-inline'` retained for now; documented for Plan 01-05 to drop.** Manual inspection of `out/renderer/index.html` confirms the built HTML has zero `<style>` blocks and zero `style=` attributes — all CSS is extracted to `assets/index-*.css` and loaded via `<link rel="stylesheet">`. Plan 01-05 can safely tighten `style-src 'self' 'unsafe-inline'` to `style-src 'self'`.
- **CSS comment rewording over C-style escape.** The `*/` trap in `--color-stone-*/--color-orange-*` was fixed by rewording the comment prose to `Tailwind's built-in stone and orange palette variables` rather than using an escape sequence or alternate comment style. This matches the Phase 1 grep-literal-compliance pattern established in 01-01 Dev #4 and 01-02 Dev #3/#4: documentation prose, not literal tokens.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tsconfig.node.json` has no DOM lib → `window` in preload fails TS2304**
- **Found during:** Task 1 (first `npm run typecheck` after writing preload).
- **Issue:** Plan 01-03 action step A for the preload specified `(window as unknown as { api: Api }).api = api` in the `!process.contextIsolated` fallback branch. `tsconfig.node.json` (which includes `src/preload/index.ts`) has `lib: ["ES2022"]` only — no DOM types. `tsc --noEmit -p tsconfig.node.json` reports `TS2304: Cannot find name 'window'`.
- **Fix:** Replaced `window` with `globalThis` in the fallback branch (added an explanatory comment citing the lib-set rationale). The fallback branch never fires under our D-06 pinned `contextIsolation: true`; semantic equivalent at runtime.
- **Files modified:** `src/preload/index.ts`.
- **Verification:** `npm run typecheck` → exit 0 on both projects.
- **Committed in:** `bd91356` (Task 1).

**2. [Rule 3 - Blocking] electron-vite emits preload as `.mjs`; Plan 01-02's `../preload/index.js` reference was a latent bug**
- **Found during:** Task 3 (first `npx electron-vite build` — output listed `out/preload/index.mjs` not `out/preload/index.js`).
- **Issue:** `src/main/index.ts` line 37 was `preload: join(__dirname, '../preload/index.js')` (Plan 01-02). electron-vite 5 under `package.json` `"type": "module"` compiles preload to ESM, emitting `.mjs`. At runtime in a packaged build, Electron would fail to load the preload with "module not found". This is not Plan 01-03's code, but Plan 01-03 is the first time a real preload compiles — the bug only surfaces now. Plan 01-03's explicit acceptance criterion ("`npx electron-vite build` emits complete bundle tree") transitively requires the compiled main to load the compiled preload successfully, which requires the path to match.
- **Fix:** Changed `'../preload/index.js'` to `'../preload/index.mjs'` in `src/main/index.ts` with an explanatory comment citing the electron-vite ESM output convention.
- **Files modified:** `src/main/index.ts`.
- **Verification:** `grep 'preload/index' out/main/index.js` → `preload: join(__dirname, "../preload/index.mjs")`. Bundle tree complete; no runtime resolution drift.
- **Committed in:** `0cd2399` (Task 3).

**3. [Rule 1 - Bug] CSS comment `*/` trap in stylesheet produced 3 build warnings + broke `@theme inline`**
- **Found during:** Task 3 (first `npx electron-vite build` — Lightning CSS emitted 3 warnings).
- **Issue:** Initial `src/renderer/src/index.css` had a comment `/* ... --color-stone-*/--color-orange-* which are resolved ... */`. CSS comments end at the first `*/` — so the comment actually ended at `--color-stone-*/`, and the remaining text plus the following `@theme inline { ... }` block were parsed as real CSS. Cascading errors: "Unexpected token Delim('*')", "Unknown at rule: @apply", "Unexpected end of input". Shipping behavior was still produced (the stylesheet was processed anyway, and extracted CSS was valid) but Tailwind's @apply processing may have been compromised.
- **Fix:** Rewrote the comment prose to describe the invariant without the literal `*/` embedded: `Colors reference Tailwind's built-in stone and orange palette variables, which are resolved at utility-generation time rather than render time`. No semantic change.
- **Files modified:** `src/renderer/src/index.css`.
- **Verification:** Rebuild → zero CSS warnings; `out/renderer/assets/index-*.css` grew from 7.06 → 7.44 kB (indicating @apply + @theme inline now process correctly and emit the body baseline + utility variables).
- **Committed in:** `0cd2399` (Task 3, same commit as Deviation #2 — stylesheet + main/index.ts path fix are the two pieces that together make the build green).

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking — TypeScript lib-set mismatch on `window`, preload filename mismatch — plus 1 Rule 1 bug — CSS comment trap). Zero Rule 2, zero Rule 4. All three have the same character: planner snippets assumed behavior that disagreed with tooling reality (TS node-project lib set, electron-vite ESM output filenames, CSS comment parsing semantics). Pattern: the Phase 1 grep-literal-compliance idiom established in 01-01/01-02 now extends to CSS authoring too — documentation prose over literal tokens.

**Impact on plan:** The plan's three-task structure, atomic commits, and key invariants all executed as written. Deviation #1 is a one-line runtime-neutral swap. Deviation #2 fixes a latent bug in a Plan 01-02 file that the plan's acceptance gate (`npx electron-vite build` emits complete bundle tree) transitively required fixing. Deviation #3 is a prose rewording. No scope creep.

## Issues Encountered

None beyond the deviations above. Full gate sweep at end of plan:

```
npm run typecheck          → TC=0 (both projects clean)
npm run test               → 55 passed + 1 skipped (Phase 0 47+1 preserved; summary 3/3; ipc 3/3; arch 2/2 — Layer 3 now scanning real renderer files)
npx electron-vite build    → clean build, zero warnings
ls out/main/index.js       → PRESENT (16.17 kB)
ls out/preload/index.mjs   → PRESENT (0.66 kB) — note .mjs per electron-vite ESM output
ls out/renderer/index.html → PRESENT (0.60 kB)
npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json → exit 0, 22ms, CIRCLE/SQUARE/SQUARE2/TRIANGLE
```

Verification grep gates:
```
grep "webUtils.getPathForFile" src/preload/index.ts                           → PASS (2 occurrences)
! grep "file\.path" src/preload/index.ts                                      → PASS (D-09 correction applied)
grep "@theme inline" src/renderer/src/index.css                               → PASS (3 occurrences — block, docstring, comment)
grep "var(--color-stone-950)" src/renderer/src/index.css                      → PASS
grep "var(--color-orange-500)" src/renderer/src/index.css                     → PASS
! grep -rnE "from ['\"][^'\"]*\/core\/|from ['\"]@core" src/renderer/         → PASS (CLEAN — zero core imports in renderer)
grep 'Content-Security-Policy' src/renderer/index.html                        → PASS
grep -c "^  loadSkeletonFromFile" src/preload/index.ts                        → 1 (preload surface = one method)
```

## Self-Check: PASSED

All 7 created + 1 modified files verified present on disk via `ls`:
- `src/preload/index.ts` (new — 67 lines)
- `src/preload/index.d.ts` (new — 21 lines)
- `src/renderer/index.html` (new — 17 lines)
- `src/renderer/src/main.tsx` (new — 26 lines)
- `src/renderer/src/App.tsx` (new — 55 lines)
- `src/renderer/src/env.d.ts` (new — 9 lines)
- `src/renderer/src/index.css` (new — 67 lines)
- `src/main/index.ts` (modified — 4-line change: preload target `index.js` → `index.mjs` + explanatory comment)

All 3 task commits verified in `git log --oneline -5`:
- `bd91356 feat(01-03): preload contextBridge surface with webUtils.getPathForFile (D-09 correction)`
- `0023eb7 feat(01-03): renderer bootstrap — App.tsx state machine + CSP + React 19 entry`
- `0cd2399 feat(01-03): renderer stylesheet with @theme inline warm-stone tokens + JetBrains Mono`

## User Setup Required

None — all operations are local TypeScript/HTML/CSS edits + an `electron-vite build` sanity check. The Electron app will actually boot (`npm run dev` / `npm run build:dry`) now that preload and renderer both compile, but actually running it interactively is outside Plan 01-03's automated scope — Plan 01-04 will add DropZone + DebugPanel and Plan 01-05 will do the `.dmg` packaging + exit-criteria sweep.

## CSP Tightening Flag for Plan 01-05

Inspection of built `out/renderer/index.html` confirms zero `<style>` blocks and zero `style=` attributes — all CSS is extracted to `assets/index-*.css` and loaded via `<link rel="stylesheet">`. Plan 01-05 should:

1. Change the CSP meta `style-src 'self' 'unsafe-inline'` → `style-src 'self'`.
2. Rebuild and verify the renderer still renders correctly (no console-blocked inline-style warnings).
3. If clean, commit the tightened CSP as part of the Plan 01-05 packaging pass.

## Next Phase Readiness

**Ready for Plan 01-04** (Wave 4): DropZone + DebugPanel components. Plan 01-04 will:
- Add `src/renderer/src/components/DropZone.tsx` with drag/drop handlers that call `window.api.loadSkeletonFromFile(file)`.
- Add `src/renderer/src/components/DebugPanel.tsx` that renders the `SkeletonSummary` header + peak-scale `<pre>` table (matches `scripts/cli.ts` output byte-for-byte via `buildSummary`'s pre-sorted peaks[]).
- Lift `AppState` management from `App.tsx` into a shared state owner; wire DropZone to call `setState` on drop events and DebugPanel to render the `loaded` branch.
- Implement D-17 `console.log` echo of the summary on the `loaded` branch (`useEffect`).
- Implement D-19 in-place replacement of the pre-drop empty state with the loaded dump or error text.

**Contracts locked for Plan 01-04:**
- `window.api.loadSkeletonFromFile(file: File)` signature is stable; DropZone calls exactly this with the raw drag-drop File.
- `AppState` discriminated union shape is stable; DropZone transitions `idle → loading → loaded|error`; DebugPanel consumes `{status: 'loaded', summary}`.
- `SkeletonSummary.peaks[]` is already pre-sorted by (skinName, slotName, attachmentName) — DebugPanel does no re-sorting; it maps straight to `<pre>` rows.
- Tailwind token set (bg-surface, bg-panel, border-border, text-fg, text-fg-muted, ring-accent, bg-accent/5, text-accent-muted, font-sans, font-mono) is stable and confirmed emitting at build time via the `@theme inline` block.

**Open items for Plan 01-04:**
- Plan 01-04 must use class-literal strings (not template-string concatenation) in `className` attributes so Tailwind's content scanner picks them up. Plan 01-03's App.tsx already follows this pattern.
- Plan 01-04 should consider whether `window.api` can be undefined in dev (e.g. accessed before preload loads). An optional-chain `window.api?.loadSkeletonFromFile(file)` with a fallback to an error state is a defensive idiom.

## Threat Surface Scan

No new security-relevant surface introduced beyond what the plan's `<threat_model>` already covers:
- **T-01-03-01 (empty getPathForFile result, mitigate):** Preload checks `!jsonPath` before invoking ipcRenderer; returns typed `{ok: false, error: {kind: 'Unknown', message: '...no filesystem path...'}}` without round-tripping to main.
- **T-01-03-02 (wide contextBridge surface, mitigate):** `api` object exposes ONE method (`loadSkeletonFromFile`); raw `ipcRenderer`/`webUtils` not exposed. Preload surface = one method confirmed via `grep -c "^  loadSkeletonFromFile" src/preload/index.ts`.
- **T-01-03-03 (renderer XSS, mitigate):** CSP meta locks `default-src/script-src/style-src/img-src/font-src` to `'self'` (+ `'unsafe-inline'` for styles in dev; Plan 01-05 can tighten to `'self'` only — flagged above). No CDN; no inline scripts.
- **T-01-03-04 (contextIsolation regression, transfer):** Pinned `contextIsolation: true, nodeIntegration: false, sandbox: true` in `src/main/index.ts` (Plan 01-02). Preload defensively handles both `process.contextIsolated` branches; non-isolated path is dead code under D-06.

No `threat_flag` section required.

---
*Phase: 01-electron-react-scaffold*
*Completed: 2026-04-23*
