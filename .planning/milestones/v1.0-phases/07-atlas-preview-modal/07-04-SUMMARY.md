---
phase: 07-atlas-preview-modal
plan: 04
subsystem: renderer-modal
tags: [phase-07, wave-3, renderer, modal, canvas, hover, dblclick, hand-rolled-aria, jsdom-spec]

# Dependency graph
requires:
  - phase: 07-atlas-preview-modal
    plan: 01
    provides: AtlasPreviewInput / PackedRegion / AtlasPage / AtlasPreviewProjection types in src/shared/types.ts; jsdom + @testing-library/react + vitest .spec.tsx scanning; RED stub at tests/renderer/atlas-preview-modal.spec.tsx
  - phase: 07-atlas-preview-modal
    plan: 02
    provides: src/renderer/src/lib/atlas-preview-view.ts — buildAtlasPreview renderer-copy (Layer 3) consumed by the modal on every toggle/pager change
  - phase: 07-atlas-preview-modal
    plan: 03
    provides: app-image:// protocol scheme for <img>.src on every region's atlas page or per-region PNG
  - phase: 06-optimize-assets-image-export
    provides: hand-rolled ARIA modal scaffold pattern (OptimizeDialog.tsx Round 6 — useFocusTrap hoist, sub-component extraction, clsx literal-class discipline)
  - phase: 04-scale-overrides
    provides: D-81 ARIA modal scaffold (OverrideDialog.tsx — role/aria-modal/aria-labelledby + outer-overlay onClose + inner stopPropagation)
provides:
  - src/renderer/src/modals/AtlasPreviewModal.tsx — 501-line hand-rolled ARIA modal exporting AtlasPreviewModal with three inline sub-components (LeftRail, InfoCard, AtlasCanvas)
  - 11 GREEN renderer specs across 6 describe blocks driving Plan 01's RED stubs to GREEN
  - vitest.config.ts esbuild jsx 'automatic' configuration unblocking renderer-spec JSX transformation
affects: [07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-component extraction inline (LeftRail / InfoCard / AtlasCanvas) — clones OptimizeDialog precedent (PreFlightBody / InProgressBody at lines 364-393); keeps the modal narrative readable while preserving Layer 3 isolation"
    - "Image cache lifecycle pattern: useRef<Map<string, HTMLImageElement>>(new Map()) + useRef<Set<string>>(new Set()) + useState<number> imageCacheVersion for redraw-trigger. Pitfall 4 mitigation — module-scope leak avoided; per-session lifecycle matches D-131 snapshot-at-open"
    - "Combined <img>.onerror + naturalWidth===0 detection in onload — Pitfall 5 carry-over for CSP/decode-failure detection"
    - "jsdom canvas safety pattern: `if (!ctx) return` guard inside the canvas useEffect lets the modal mount under jsdom without throwing (jsdom getContext('2d') returns null). Spec asserts on DOM/role queries only; pixel correctness covered by tests/core/atlas-preview.spec.ts golden values + the eventual human-verify checkpoint in Plan 05"
    - "Vitest esbuild jsx 'automatic' — first project use of jsx-automatic transformer. Aligns vitest's renderer-spec transformer with tsconfig.web.json's `\"jsx\": \"react-jsx\"` setting; future renderer specs use this same config"

key-files:
  created:
    - "src/renderer/src/modals/AtlasPreviewModal.tsx (501 lines — modal + 3 sub-components inline)"
    - ".planning/phases/07-atlas-preview-modal/07-04-SUMMARY.md (this file)"
  modified:
    - "tests/renderer/atlas-preview-modal.spec.tsx (38 lines RED → 312 lines GREEN; 6 it.todo → 11 it() blocks across 6 describe blocks)"
    - "vitest.config.ts (+8 lines — esbuild jsx 'automatic' for renderer-spec JSX transform)"

key-decisions:
  - "`--color-success` token NOT added to src/renderer/src/index.css. The InfoCard component renders the EFFICIENCY value with text-fg (warm-stone) — no green accent. Plan 05's human-verify checkpoint may revisit if user requests a green accent on the EFFICIENCY card; for now the existing palette covers the surface and Phase 5 D-104 precedent is preserved (only add tokens when the screenshot review demands one)."
  - "Sub-component extraction inline (not in src/renderer/src/components/*). LeftRail / InfoCard / AtlasCanvas each scope to AtlasPreviewModal usage; no shared consumer. Matches OptimizeDialog precedent (PreFlightBody / InProgressBody at lines 364-393). Future shared sub-components can graduate to components/ if a second consumer emerges."
  - "Rule 3 deviation: vitest.config.ts esbuild.jsx 'automatic' added. Without it, vitest's esbuild transformer emits classic React.createElement calls and the spec throws ReferenceError at runtime because the renderer's modern automatic-runtime convention does not import React explicitly. Aligns vitest with tsconfig.web.json's `\"jsx\": \"react-jsx\"` contract."
  - "Mock canvas.getBoundingClientRect in dblclick spec rather than relying on jsdom defaults (which returns 0×0 zero-pixel rects, making CSS→canvas-logical coord ratio 0/1 = 0 and breaking hit-test). Mock to 0,0,2048,2048 so clicks at (5,5) deterministically hit the first packed region near the origin."

patterns-established:
  - "Hand-rolled ARIA modal scaffold + useFocusTrap + outer-overlay onClick + inner stopPropagation is the project's canonical modal pattern. AtlasPreviewModal is the FOURTH adopter (after OverrideDialog Phase 4, OptimizeDialog Phase 6, ConflictDialog Phase 6). Future modals follow this exact shape."
  - "DOM-only renderer-spec posture for canvas-bearing components: assert on accessible queries (getByRole, getByText, aria-label string content) and dispatched events (fireEvent + onClick/doubleClick handlers). Skip pixel-content assertions in jsdom — those go in core/golden tests + human-verify."
  - "Per-spec `// @vitest-environment jsdom` first-line pragma is the project's renderer-spec convention. Plan 01 established the pattern; this plan is the first consumer with real assertions. vitest.config.ts default env stays 'node' — only renderer specs flip to jsdom."

requirements-completed: [F7.1, F7.2]

# Metrics
duration: ~12min
completed: 2026-04-25
---

# Phase 7 Plan 04: AtlasPreviewModal renderer + spec drive-to-GREEN Summary

**Hand-rolled 501-line ARIA modal cloning OverrideDialog/OptimizeDialog scaffold; three-axis state (mode × maxPageDim × currentPageIndex) drives a useMemo-backed projection from the renderer-copy buildAtlasPreview; canvas with dpr-aware backing store + drawImage 9-arg srcRect form + hover hit-test + dblclick → onJumpToAttachment + missing-source ⚠ glyph; image cache + missing-paths set hoisted into useRef per Pitfall 4; 11 jsdom specs across 6 describe blocks driving Plan 01's RED stubs to GREEN.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-25T19:46:30Z (approx — first read of plan)
- **Completed:** 2026-04-25T19:51:30Z
- **Tasks:** 2 / 2
- **Files modified:** 2 (tests/renderer/atlas-preview-modal.spec.tsx, vitest.config.ts)
- **Files created:** 1 (src/renderer/src/modals/AtlasPreviewModal.tsx)

## Accomplishments

- **F7.1 + F7.2 visible deliverable lands.** AtlasPreviewModal renders `role="dialog"` + `aria-modal="true"` + `aria-labelledby="atlas-preview-title"` chrome with header (title + sub-line + close X), left-rail control panel (VIEW MODE + ATLAS RESOLUTION segmented toggles + ATLAS PAGE pager + TOTAL ATLASES + EFFICIENCY cards), main-view canvas, and footer disclaimer. Default open state = Optimized @ 2048, page 1 (D-135).
- **D-128 three-axis state implemented.** `mode` ('original'|'optimized') + `maxPageDim` (2048|4096) + `currentPageIndex` (clamped on toggle changes that shrink pages.length). useMemo([summary, overrides, mode, maxPageDim]) recomputes projection on every toggle/pager change.
- **D-130 dblclick-jump gesture wired.** Linear-scan hit-test on `pages[currentPageIndex].regions[]` converts CSS coords → canvas-logical coords via getBoundingClientRect ratio; calls props.onJumpToAttachment(region.attachmentName) when a region rect contains the click coords. Plan 05 wires the AppShell consumer.
- **D-131 snapshot-at-open semantics.** `props.summary` + `props.overrides` are captured by useMemo deps; the modal does NOT subscribe to override changes during the open session. User closes + reopens to refresh.
- **D-137 missing-source detection.** Combined `<img>.onerror` + `naturalWidth === 0` check (Pitfall 5) flags missing paths in `missingPathsRef`; canvas useEffect renders muted placeholder pattern + ⚠ glyph in `--color-danger` for those regions.
- **Pitfall 4 — image cache leak avoided.** `imageCacheRef = useRef(new Map<string, HTMLImageElement>())` and `missingPathsRef = useRef(new Set<string>())` hoisted INSIDE the component; on unmount the refs are GC'd. `imageCacheVersion` state forces canvas redraw when an image finishes loading.
- **Layer 3 invariant intact.** Modal imports only react + clsx + ../../../shared/types.js (type-only) + ../lib/atlas-preview-view.js (renderer copy) + ../hooks/useFocusTrap. Zero `../../core/*` imports — `tests/arch.spec.ts` 9/9 green.
- **Tailwind v4 literal-class discipline preserved.** Every `className=` is a literal string or `clsx` with literal branches (RESEARCH Pitfall 3 + 8). No template interpolation. The acceptance grep `! grep -E 'className=\\{`bg-\\$' src/renderer/src/modals/AtlasPreviewModal.tsx` exits 0.
- **jsdom-safe canvas effect.** `if (!ctx) return` guard inside the canvas useEffect lets the modal mount under jsdom without throwing (`getContext('2d')` returns null in jsdom). Spec confirms 11 it() blocks render the modal without throwing.
- **Spec drive-to-GREEN.** Plan 01's 6 `it.todo` stubs replaced with 11 real `it()` blocks across 6 describe blocks: default view (3) + toggle re-render (2) + pager bounds (1) + dblclick (2) + accessibility (1) + close interactions (2). Helper `row()` builds a fully-populated DisplayRow; helper `makeSummary()` synthesizes a 3-region SkeletonSummary.
- **Full suite green.** 239 passed + 1 skipped + 1 todo (was 228 + 1 + 7); +11 new renderer it() blocks − 6 replaced it.todo. `npm run typecheck:web` clean. `tests/core/atlas-preview.spec.ts` 18 passed + 1 todo (Plan 02 baseline preserved). `npx electron-vite build` green (renderer 623.67 kB JS + 23.42 kB CSS).
- **CLI + sampler locks intact.** `git diff e54fc65 -- scripts/cli.ts` empty (D-102); `git diff e54fc65 -- src/core/sampler.ts` empty (CLAUDE.md rule #3).

## Task Commits

Each task committed atomically:

1. **Task 1: Build src/renderer/src/modals/AtlasPreviewModal.tsx** — `ab78097` (feat)
2. **Task 2: Drive RED renderer spec to GREEN with 11 it() blocks** — `9f3504f` (test)

## Files Created/Modified

### Created

- `src/renderer/src/modals/AtlasPreviewModal.tsx` — 501-line hand-rolled ARIA modal exporting `AtlasPreviewModal` plus three inline sub-components:
  - `LeftRail` — VIEW MODE + ATLAS RESOLUTION segmented toggles (clsx literal-branch active class) + ATLAS PAGE pager (Previous page / Next page aria-labels + bounds-disable) + TOTAL ATLASES card + EFFICIENCY card with sub-line "X% Empty Space".
  - `InfoCard` — generic label + value + sub stat card (border-border + bg-surface + 2xl numeric).
  - `AtlasCanvas` — dpr-aware backing store + drawImage 9-arg srcRect form for atlas-packed regions + 5-arg form for per-region PNGs + hover hit-test + dblclick → onJumpToAttachment + missing-source ⚠ glyph in `--color-danger` + always-on outline + hover-only fill+label overlay.
- `.planning/phases/07-atlas-preview-modal/07-04-SUMMARY.md` — this file.

### Modified

- `tests/renderer/atlas-preview-modal.spec.tsx` — RED 38-line stub (6 `it.todo`) → GREEN 312-line spec with 11 real `it()` blocks across 6 describe blocks. Helper `row()` builds a fully-populated DisplayRow per src/shared/types.ts (every numeric field set so buildExportPlan / buildAtlasPreview consume without NaN propagation). Helper `makeSummary()` synthesizes a 3-region SkeletonSummary (CIRCLE 64×64 + SQUARE 128×128 + TRIANGLE 96×96) packing into a single 2048×2048 page.
- `vitest.config.ts` — `esbuild: { jsx: 'automatic' }` added (8 lines including the JSDoc explaining why). First-line `// @vitest-environment jsdom` pragma flips renderer specs to jsdom; vitest's esbuild transformer now uses the React-19 automatic JSX runtime so the spec doesn't need to import React explicitly.

## Decisions Made

- **`--color-success` token NOT added to src/renderer/src/index.css.** The plan offered an optional one-line token addition for the EFFICIENCY card green accent. The InfoCard component renders the EFFICIENCY value with `text-fg` (warm-stone) — no green accent applied. Plan 05's human-verify checkpoint may revisit if the user's screenshot review requests a green accent; for now the existing warm-stone palette covers the surface and Phase 5 D-104 precedent is preserved (only add tokens when the screenshot review demands one).
- **Sub-component extraction inline (not in `src/renderer/src/components/*`).** LeftRail / InfoCard / AtlasCanvas each scope to AtlasPreviewModal usage with no shared consumer. Matches OptimizeDialog precedent (PreFlightBody / InProgressBody at lines 364-393 of `src/renderer/src/modals/OptimizeDialog.tsx`). Future shared sub-components can graduate to `components/` if a second consumer emerges.
- **vitest.config.ts esbuild jsx 'automatic'.** First project use of jsx-automatic transformer in vitest. Aligns vitest's renderer-spec JSX transformer with tsconfig.web.json's `"jsx": "react-jsx"` setting. Future renderer specs use this same config without needing per-file React imports.
- **DOM-only renderer-spec posture.** Asserts on accessible queries (getByRole / getByText) and dispatched events (fireEvent.click / fireEvent.doubleClick + handler call counts). Skips pixel-content assertions because jsdom returns null from `canvas.getContext('2d')`. Pixel correctness lives in `tests/core/atlas-preview.spec.ts` golden values + the eventual human-verify checkpoint in Plan 05.
- **canvas.getBoundingClientRect mocked in dblclick specs.** jsdom's default getBoundingClientRect returns a zero-pixel rect, which makes the CSS→canvas-logical coord ratio degenerate (0 / 1 = 0) and breaks the hit-test. Mock to `{ left: 0, top: 0, right: 2048, bottom: 2048, width: 2048, height: 2048, x: 0, y: 0 }` so clicks at (5, 5) deterministically hit the first packed region near the origin.

## Patterns Established

- **Hand-rolled ARIA modal scaffold + useFocusTrap** is the project's canonical modal pattern. AtlasPreviewModal is the FOURTH adopter (after OverrideDialog Phase 4 D-81, OptimizeDialog Phase 6, ConflictDialog Phase 6). Future modals follow this exact shape: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + outer overlay `onClick={onClose}` + inner panel `onClick={(e) => e.stopPropagation()}` + `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` + `if (!props.open) return null;` early return.
- **Image cache lifecycle pattern** for canvas-bearing modals: `useRef<Map<string, HTMLImageElement>>(new Map())` + `useRef<Set<string>>(new Set())` + `useState<number>` imageCacheVersion. The version state forces canvas redraw when an image finishes loading; the refs are GC'd on unmount (Pitfall 4). Combined `<img>.onerror` + `naturalWidth === 0` detection in onload (Pitfall 5).
- **DOM-only renderer-spec posture** for canvas-bearing components — assert on `getByRole` / `getByText` queries and dispatched-event handler counts; skip pixel-content assertions; pixel correctness lives in core golden tests + human-verify.
- **vitest.config.ts esbuild jsx 'automatic'** is now the project default for renderer-spec JSX transformation. Per-file `// @vitest-environment jsdom` pragma still flips env per-spec; this config flips the JSX transformer globally (no behavioral change for non-JSX specs because esbuild doesn't transform .ts files as JSX).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts esbuild jsx 'automatic' added.**
- **Found during:** Task 2 (first spec run after fill-in).
- **Issue:** `ReferenceError: React is not defined` thrown by every it() block. vitest's esbuild transformer defaulted to classic JSX runtime (emitting `React.createElement(...)` calls), but the spec imports nothing named React because the renderer's tsconfig.web.json declares `"jsx": "react-jsx"` (modern automatic runtime, no React import needed). Vitest doesn't read tsconfig.web.json — it uses esbuild defaults.
- **Fix:** Added `esbuild: { jsx: 'automatic' }` to vitest.config.ts. Aligns vitest's transformer with the renderer's tsconfig contract. Documented inline with a 6-line comment explaining the why.
- **Files modified:** `vitest.config.ts` (+8 lines including the explanatory comment).
- **Commit:** `9f3504f` (committed atomically with Task 2).
- **Scope:** This is a renderer-test infrastructure fix, NOT a deviation from Plan 04's task spec. The plan assumed renderer specs would just work (Plan 01 established jsdom + testing-library deps); the JSX transform alignment was a missing piece that surfaced only when real assertions ran. Future renderer specs benefit from this config without further changes.

**2. [Rule 1 - Bug] Pager button aria-label literal-string mismatch.**
- **Found during:** Task 2 acceptance-grep run.
- **Issue:** Initial spec used `screen.getByRole('button', { name: /previous page/i })` (case-insensitive regex) which DID resolve correctly at runtime, but the plan's acceptance-criteria gate `grep -F "Previous page" tests/renderer/atlas-preview-modal.spec.tsx` (case-sensitive literal) failed because the spec contained only the lowercase regex form.
- **Fix:** Changed both pager-button queries from regex form to exact literal strings — `screen.getByRole('button', { name: 'Previous page' })` and `{ name: 'Next page' }`. The aria-label literals come directly from `src/renderer/src/modals/AtlasPreviewModal.tsx` (lines 296 + 308). Added a comment line citing the source-of-truth.
- **Files modified:** `tests/renderer/atlas-preview-modal.spec.tsx` (2 lines + 1 comment line).
- **Commit:** `9f3504f` (folded into Task 2 commit).
- **Scope:** Microfix — preserves test behavior while satisfying the case-sensitive literal-grep gate.

### Architectural changes
None.

### Authentication gates
None — modal is renderer-only; no IPC / auth surface.

## Verification Results

- **`npm run test`** → 239 passed | 1 skipped | 1 todo (was 228 + 1 + 7; +11 new renderer it() blocks − 6 replaced it.todo).
- **`npm run test -- tests/renderer/atlas-preview-modal.spec.tsx`** → 11 passed (all 11 it() blocks across 6 describe blocks).
- **`npm run test -- tests/core/atlas-preview.spec.ts`** → 18 passed + 1 todo (Plan 02 baseline preserved — this plan didn't touch core).
- **`npm run test -- tests/arch.spec.ts`** → 9 passed (Layer 3 grep auto-scanned the modal — zero `src/core` imports).
- **`npm run typecheck:web`** → clean.
- **`npx electron-vite build`** → green (main 41.55 kB CJS + preload 3.68 kB CJS + renderer 623.67 kB JS + 23.42 kB CSS).
- **`git diff e54fc65 -- scripts/cli.ts`** → empty (D-102 byte-for-byte CLI lock).
- **`git diff e54fc65 -- src/core/sampler.ts`** → empty (CLAUDE.md rule #3).

## Self-Check: PASSED

**Files created exist:**
- FOUND: `src/renderer/src/modals/AtlasPreviewModal.tsx`
- FOUND: `.planning/phases/07-atlas-preview-modal/07-04-SUMMARY.md`

**Commits exist in git log:**
- FOUND: `ab78097` — feat(07-04): build AtlasPreviewModal hand-rolled ARIA modal
- FOUND: `9f3504f` — test(07-04): drive RED renderer spec to GREEN with 11 it() blocks
