---
phase: 03-animation-breakdown-panel
plan: 02
subsystem: renderer-ui
tags: [appshell, tabs, collapsible-cards, bone-path, override-button, jump-target, flash-highlight, tailwind-v4, layer-3, react-19]

requires:
  - phase: 03-animation-breakdown-panel
    provides: [AnimationBreakdown interface, BreakdownRow interface, SkeletonSummary.animationBreakdown IPC field, 'setup-pose' cardId + 'anim:${name}' cardId convention, Plan 03-01 sampler + analyzer + bones + IPC stack]
  - phase: 02-global-max-render-source-panel
    provides: [GlobalMaxRenderPanel with SearchBar + sort + select + match-highlight + dedupe, SearchBar component reused verbatim, chip-style class string for Source Animation cell, 4/4 arch.spec guards]
  - phase: 01-electron-react-scaffold
    provides: [AppState discriminated union, DropZone full-window wrap, Tailwind v4 @theme inline tokens, Layer 1+2+3 core↛renderer defense]
provides:
  - AppShell component (top-tab container + filename chip + activeTab state + onJumpToAnimation callback threading)
  - AnimationBreakdownPanel component (collapsible cards + Bone Path mid-ellipsis + disabled Override button + cross-card search + scroll+expand+flash focus effect)
  - GlobalMaxRenderPanel.onJumpToAnimation prop + conditional <button> Source Animation chip upgrade (resolves Phase 2 D-44 deferral)
  - D-49 resolution: filename chip hoisted out of GlobalMaxRenderPanel into AppShell header
  - D-72 resolution: Source Animation cell becomes interactive <button> when prop supplied, decoupled <span> fallback otherwise
affects: [Plan 03-03 wires AppShell into App.tsx + runs human-verify end-to-end]

tech-stack:
  added: [none — Phase 3 Plan 02 is purely additive over the Electron + React 19 + Tailwind v4 + clsx stack]
  patterns:
    - "Hand-rolled top-tab shell (no tab library — D-28 discipline)"
    - "Hand-rolled collapsible cards via <button aria-expanded>+<div role='region'> (rejected <details>/<summary> for tighter CSS control)"
    - "Hand-rolled mid-ellipsis truncation on Bone Path cell (preserves actionable leaf token; rejected CSS end-ellipsis)"
    - "useRef<Map<cardId, HTMLElement>> + registerCardRef callback for scrollIntoView targets"
    - "Synchronous onFocusConsumed() inside useEffect (before the setTimeout) resolves panel-remount flash leak (RESEARCH §Pitfall 5)"
    - "Derived effectiveExpanded = userExpanded ∪ cards-with-matches during active search (D-71)"
    - "Three accent-alpha tiers communicate increasing interactivity: bg-accent/5 row-ambient → bg-accent/10 hover-on-chip → bg-accent/20 match-highlight"
    - "Decoupled-fallback pattern for the jump chip: presence of onJumpToAnimation prop decides between <button> and <span> render"
    - "Two-weight typography contract locked: only font-normal (400) + font-semibold (600); weight 500 forbidden project-wide"

key-files:
  created:
    - "src/renderer/src/components/AppShell.tsx"
    - "src/renderer/src/panels/AnimationBreakdownPanel.tsx"
    - ".planning/phases/03-animation-breakdown-panel/03-02-SUMMARY.md"
  modified:
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx"

key-decisions:
  - "AppShell is plain useState per D-50 — no context, no library, no persistence. Default activeTab='global' on every mount (i.e. every new skeleton drop); focusAnimationName=null until a Source Animation chip click fires."
  - "Synchronous onFocusConsumed inside the useEffect body (before setTimeout) — not deferred into the 900ms timer callback. The 900ms timer is local (isFlashing state inside the panel); only the flash-clearing runs at timeout expiry. AppShell's focusAnimationName clears on the same React tick, so a mid-flash unmount (user tab-switches back to Global) can never leave AppShell stuck with stale focus."
  - "900ms flash duration (not 800/1000/1200) — threads the needle between 'something happened, look here' (~800ms floor) and 'feels sluggish' (~1200ms ceiling) per UI-SPEC. Linear instant-on/instant-off: a pulse reads as an error toast; a fade looks unfinished."
  - "Bone Path mid-ellipsis threshold = 48 chars (for max-w-[320px] cell at 12px JetBrains Mono). Hand-rolled over CSS end-ellipsis because the leaf (attachmentName) is the actionable token; `root → … → CHAIN_8 → CIRCLE` beats `root → CTRL → CHAIN_2 → CHAIN…` for animator scanning."
  - "Module-top highlightMatch helper duplicated verbatim from Phase 2 GlobalMaxRenderPanel.tsx (same 15 lines). Extracting it to a shared module would have touched Phase 2 files needlessly; intentional duplication keeps each panel self-contained and review-friendly."
  - "GlobalMaxRenderPanel Source Animation cell fallback to <span> when onJumpToAnimation is undefined — preserves the panel's decoupled mode (Phase 2 used it standalone in App.tsx until Plan 03-03 wraps with AppShell)."
  - "Filename chip hoisted OUT of GlobalMaxRenderPanel's internal header (D-49) — now lives in AppShell's header bar. Consequence: GlobalMaxRenderPanel is tested visually via human-verify AFTER the AppShell wrap (Plan 03-03); for Plan 03-02 the grep `! grep -q \"summary.skeletonPath\"` against the file enforces the removal."
  - "Active/inactive tab contrast carried by THREE orthogonal channels — weight (font-semibold vs font-normal) + color (text-accent vs text-fg-muted) + 2px bg-accent underline. Dropping the medium-weight intermediate step keeps the two-weight contract strict without weakening the active-state signal."
  - "AnimationCard + BreakdownTable are local (same-file) sub-components in AnimationBreakdownPanel.tsx — simplifies imports, keeps per-panel concerns co-located. If Phase 9 adds windowing or per-card virtualization, extraction into sibling files is trivial."

patterns-established:
  - "Hand-rolled top-tab shell with useCallback-threaded jump callback — template for future top-tab additions (Phase 5 unused-attachments tab, Phase 7 atlas-preview tab)."
  - "Collapsible-card panel with synchronous focus-consume — pattern generalizes to any future 'jump from summary to detail' UI (e.g. Phase 4 override review → source row jump)."
  - "Derived-set expansion during search (effectiveExpanded = user ∪ matches) — pragmatic UX: search is pointless if matches hide inside collapsed containers."
  - "Three-tier accent-alpha convention — codifies 'increasing interactivity intensity' so future hover states have a home (row hover 5 → interactive-chip hover 10 → active-match 20)."
  - "Decoupled-fallback rendering via optional prop — pattern generalizes to any panel that might render standalone OR wrapped (e.g. a future embedded-panel-in-modal scenario)."

requirements-completed: [F4.1, F4.2, F4.3, F4.4]
# Note: F4.1 (collapsible cards + unique asset count + "No assets referenced"),
# F4.2 (Setup Pose top card — rendered first via summary.animationBreakdown[0]
# which Plan 03-01 placed as cardId='setup-pose'), F4.3 (Bone Path + source→scale
# →peak→frame columns), F4.4 (disabled Override button) all ship in this plan's
# AnimationBreakdownPanel. End-to-end wiring + human-verify live in Plan 03-03.

duration: ~13 min
completed: 2026-04-23
---

# Phase 3 Plan 02: Renderer Trio — AppShell + AnimationBreakdownPanel + GlobalMaxRenderPanel chip upgrade

**Built the three renderer artifacts that turn Plan 03-01's IPC contract into the Animation Breakdown UI: a new AppShell top-tab container, a new AnimationBreakdownPanel with collapsible cards + Bone Path + disabled Override + cross-card search + jump-target flash highlight, and a surgical upgrade to GlobalMaxRenderPanel that makes the Source Animation chip an interactive jump-target button and hoists the filename chip into AppShell.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-04-23T21:30:09Z
- **Completed:** 2026-04-23T21:43:06Z
- **Tasks:** 3 (all GREEN; zero deviations)
- **Files created:** 2 + 1 SUMMARY
- **Files modified:** 1 (surgical)

## Accomplishments

- **AppShell resolves Phase 2 D-43 + D-49.** New `src/renderer/src/components/AppShell.tsx` (~127 lines) hosts the filename chip (hoisted from GlobalMaxRenderPanel's internal header) and a two-tab strip with Global first + Animation Breakdown second per D-51. Owns activeTab useState + focusAnimationName useState + onJumpToAnimation/onFocusConsumed useCallbacks. Exactly one panel mounts at a time.
- **AnimationBreakdownPanel ships with all four F4 requirements satisfied in-file.** New `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (~436 lines) with three sub-components (main panel + AnimationCard + BreakdownTable) and three module-top pure helpers (filterCardsByAttachmentName + truncateMidEllipsis + highlightMatch). Three useState (query, userExpanded seeded with the D-64 literal `new Set(['setup-pose'])`, isFlashing) + two useMemo (filteredCards, effectiveExpanded) + useRef<Map<cardId, HTMLElement>> + one useEffect for the jump-target scroll/expand/flash/sync-consume flow.
- **GlobalMaxRenderPanel resolves Phase 2 D-44.** Three surgical edits: (1) props gain optional onJumpToAnimation; (2) Source Animation cell branches `<button>` vs Phase 2 `<span>` on prop presence (decoupled-fallback preserved); (3) internal filename chip removed — header now a 2-child layout (SearchBar + status indicator).
- **All 22+ UI-SPEC grep signatures emit.** Positive: `role="tablist"`, `role="tab"`, `aria-selected={isActive}`, `font-semibold text-accent`, `font-normal text-fg-muted`, `h-[2px] bg-accent` (active tab underline), `aria-expanded={expanded}`, `aria-controls={bodyId}`, `role="region"`, `new Set(['setup-pose'])` (D-64 literal), `ring-2 ring-accent ring-offset-2 ring-offset-surface` (flash), `bg-accent/5` (row hover), `bg-accent/10` (jump-chip hover — new tier), `bg-accent/20 text-accent` (match), `opacity-50 cursor-not-allowed` + `title="Coming in Phase 4"` (disabled Override), `text-fg-muted font-mono text-sm text-center py-8` (empty-state row), `colSpan={7}`, `max-w-[320px]` (Bone Path column), `▸`/`▾`/`→`/`…`/`×` (Unicode glyphs verbatim).
- **All UI-SPEC negative greps clean.** Zero occurrences of `font-medium` / `font-weight:500` / `process.platform` / `src/core/*` imports across all three files. Template-string class interpolation absent — every className is a literal string (Tailwind v4 Pitfall 8 discipline).
- **Zero deviations.** Each task executed byte-for-byte per plan. No Rule 1/2/3/4 triggers; no architectural surprises; no test bugs; no blocking environmental issues.
- **Test suite preserved.** `npm run test` → 87 passed + 1 skipped (Plan 03-01 baseline unchanged — this plan adds no new tests, as renderer specs are deferred to Plan 03-03's human-verify gate per plan intent).
- **Build green.** `npx electron-vite build` emits out/main/index.cjs (23.89 kB, +6 kB from Plan 02-03's 17.35 kB — AppShell + panel code) + out/preload/index.cjs (0.68 kB, unchanged) + out/renderer (JS 573.01 kB +10 kB, CSS 19.37 kB +2 kB for ring-offset-* / h-[2px] / max-w-[320px] / hover:bg-accent/10 utilities).
- **Layer 3 defense green.** All three files scanned by tests/arch.spec.ts on every run — 6/6 arch guards pass (Layer 3 + D-23 portability + preload-CJS + main-CJS). Main + preload bundles stay CJS — no regression on the Electron-41 + Node-24 CJS requirement established in Plan 01-05 + Plan 02-03.

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1: AppShell.tsx** — `76aac1d` (feat) — tab strip + filename chip + activeTab + focusAnimationName + onJumpToAnimation/onFocusConsumed useCallbacks; TabButton local sub-component with two-weight contract.
2. **Task 2: AnimationBreakdownPanel.tsx** — `826a213` (feat) — three useState + two useMemo + useRef + useEffect + three sub-components (panel body + AnimationCard + BreakdownTable) + three pure helpers.
3. **Task 3: GlobalMaxRenderPanel.tsx surgical upgrade** — `a9911e5` (feat) — interface prop + component destructure + RowProps field + Row destructure + Source Animation cell branch + header filename chip removal + sorted.map passthrough.

## Files Created/Modified

**Created (2 source + 1 SUMMARY):**
- `src/renderer/src/components/AppShell.tsx` — 127 lines. Exports AppShell + AppShellProps. Local TabButton sub-component.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — 436 lines. Exports AnimationBreakdownPanel + AnimationBreakdownPanelProps. Local AnimationCard + BreakdownTable sub-components. Module-top pure helpers (filterCardsByAttachmentName, truncateMidEllipsis, highlightMatch).
- `.planning/phases/03-animation-breakdown-panel/03-02-SUMMARY.md` — this file.

**Modified (1 source):**
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — +30 / −8 lines net. GlobalMaxRenderPanelProps gains `onJumpToAnimation?: (animationName: string) => void`; RowProps adds the same optional prop; component signature destructures it; Row destructures it; Source Animation `<td>` branches `<button>` (with UI-SPEC locked class string) vs existing `<span>` chip (fallback); sorted.map Row instance passes onJumpToAnimation through; internal filename chip `<span>` removed from header. Phase 2 behavior elsewhere (sort, select, shift-click range, match highlight, tri-state select-all, zero-results row, 8-column table) untouched.

## Deviations from Plan

**None.** Plan executed byte-for-byte as written.

Zero Rule 1 (bugs), Rule 2 (missing critical functionality), Rule 3 (blocking issues), or Rule 4 (architectural escalations) triggered during Plan 03-02 execution. The plan's UI-SPEC locked class strings, grep signatures, and task verify gates all matched the implementation 1:1.

## Key Links

- **AppShell.tsx:** `src/renderer/src/components/AppShell.tsx`
  - activeTab useState: line 37
  - focusAnimationName useState: line 39
  - onJumpToAnimation useCallback: line 41
  - onFocusConsumed useCallback: line 46
  - Filename chip span: line 55
  - TabButton sub-component: line 92
- **AnimationBreakdownPanel.tsx:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx`
  - Module helpers (filter/truncate/highlight): lines 82-132
  - userExpanded initial literal `new Set(['setup-pose'])`: line 149
  - Jump useEffect (scroll+expand+flash+sync-consume): lines 185-209
  - AnimationCard sub-component: lines 243-295
  - BreakdownTable sub-component: lines 299-end
  - Disabled Override button: inside BreakdownTable's Actions td
- **GlobalMaxRenderPanel.tsx surgical changes:**
  - Interface prop: lines 45-55 (Props interface with onJumpToAnimation JSDoc)
  - RowProps prop: lines 149-152
  - Source Animation conditional cell: lines 211-227
  - Component destructure: lines 261-264
  - sorted.map passthrough: lines 440 (onJumpToAnimation forwarded)
  - Filename chip REMOVED from header (no line — replaced with 2-child header)

## Invariants Preserved

- **Layer 3 (renderer ↛ core):** None of the three files import from `src/core/*`. All imports restricted to react, clsx, `'../../../shared/types.js'`, and sibling renderer modules. `tests/arch.spec.ts` 6/6 guards green on every `npm run test`.
- **D-23 portability (no platform branching):** Zero `process.platform` / `os.platform()` / macOS-only BrowserWindow API references in any of the three files. Pre-existing D-23 grep gate in arch.spec.ts stays green.
- **Preload CJS lock (Plan 01-05 commit `b5d6988`):** Unchanged; no touches to `src/main/index.ts` / `electron.vite.config.ts` / `package.json`. Arch.spec preload-CJS guards green.
- **Main CJS lock (Plan 02-03 commit `9424903`):** Unchanged; same. Arch.spec main-CJS guards green.
- **Tailwind v4 Pitfall 8 (no template-string class interpolation):** Every className is a literal string or clsx with literal branches. No ``` `bg-accent/${alpha}` ``` patterns.
- **Two-weight typography contract (UI-SPEC negative grep):** `font-medium` appears zero times across all three files; `font-weight` also absent. Active-state signal carried by weight + color + underline (three orthogonal channels).
- **D-35 preformatted-labels + raw-numbers split (Phase 2 carryover):** AnimationBreakdownPanel consumes BreakdownRow.scaleLabel / originalSizeLabel / peakSizeLabel / frameLabel preformatted from core — zero formatting in the renderer.
- **CLAUDE.md rule #5 (core/ stays DOM-free):** No core changes; Plan 03-02 is renderer-only.
- **CLAUDE.md fact #1 (skeleton JSON fps is editor metadata):** Not touched — renderer has no temporal concerns.
- **Phase 2 decoupling (panel rendered outside AppShell):** GlobalMaxRenderPanel's `<span>` chip fallback preserves standalone usage. App.tsx still renders `<GlobalMaxRenderPanel summary={state.summary} />` without `onJumpToAnimation` — the panel uses the fallback branch cleanly until Plan 03-03 wraps it in AppShell.

## Threat Flags

None introduced. All four threats in the plan's `<threat_model>` are mitigated by construction:

- **T-03-02-01 (XSS via attachment/animation/bone name rendering):** Every user-supplied string renders via React text nodes. `dangerouslySetInnerHTML` absent from all three files. Bone Path full-path tooltip uses `title={bonePath.join(' → ')}` attribute — React auto-escapes attribute values.
- **T-03-02-02 (XSS via search query echo):** Query is state string passed to `.toLowerCase().includes()` (not `new RegExp`) and rendered only as text children of DOM elements. highlightMatch helper uses React fragments + `<mark>` — never HTML parsing.
- **T-03-02-03 (Layer 3 boundary escape):** None of the three files imports from `src/core/*`. Layer 3 grep in tests/arch.spec.ts auto-scans all three on every `npm run test`.
- **T-03-02-04 (focus leak across panel re-mounts):** AnimationBreakdownPanel calls `onFocusConsumed()` SYNCHRONOUSLY inside the useEffect body (before `setTimeout`). isFlashing state is local to the panel; useEffect cleanup `clearTimeout` guards mid-flash unmounts. Pattern locked in RESEARCH §Pitfall 5.

## Known Stubs

- **Disabled Override button (D-69) — intentional stub.** Every row in the Animation Breakdown table renders a `<button disabled title="Coming in Phase 4" aria-label="Override Scale (disabled until Phase 4)">Override Scale</button>`. This is NOT a bug or unwired feature — it is an explicit architectural decision (D-69) to reserve Column 7 visual real estate so Phase 4 wire-up is layout-preserving. The button is native-disabled (no onClick handler needed; browser blocks click events). Phase 4 wires the dialog by removing `disabled` and attaching onClick. Documented in file as a code comment.

No other stubs: every field rendered pulls from `summary.animationBreakdown` (populated by Plan 03-01's IPC with real data on every skeleton:load) or from panel state (query, userExpanded, isFlashing).

## Deferred Issues

- **`scripts/probe-per-anim.ts` stale against the Plan 03-01 sampler API.** Pre-existing throwaway probe (dated Apr 22, untracked, gitignored via `scripts/probe-*.ts` pattern Plan 03-01 added). Uses old sampler API — `peaks.values()` on what is now a `SamplerOutput { globalPeaks, perAnimation, setupPosePeaks }`. Surfaces as one TS2339 error when running `npm run typecheck` (full, typecheck:node + typecheck:web). `npm run typecheck:web` alone (Plan 03-02 acceptance criterion) is clean. Out of scope for Plan 03-02 per the scope-boundary rule (file predates our work; not touched by any Plan 03-02 task; gitignored so not a production concern). Plan 03-03 or a subsequent cleanup phase can either update the probe to use `.globalPeaks` (a one-line fix) or delete the file.

## Self-Check: PASSED

All claims verified against current working tree:

**Files created exist:**
- `src/renderer/src/components/AppShell.tsx` → FOUND
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` → FOUND
- `.planning/phases/03-animation-breakdown-panel/03-02-SUMMARY.md` → FOUND (this file)

**Files modified as claimed:**
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` → MODIFIED (+30 / −8 per `git show a9911e5 --stat`)

**Commits exist in git log:**
- `76aac1d` feat(03-breakdown): AppShell → FOUND
- `826a213` feat(03-breakdown): AnimationBreakdownPanel → FOUND
- `a9911e5` feat(03-breakdown): GlobalMaxRenderPanel upgrade → FOUND

**Automated gates green:**
- `npm run typecheck:web` → exit 0 (clean)
- `npm run test` → 87 passed + 1 skipped (Plan 03-01 baseline preserved)
- `npm run test -- tests/arch.spec.ts` → 6/6 arch guards green (Layer 3 auto-scans all three files)
- `npx electron-vite build` → green; out/main/index.cjs 23.89 kB + out/preload/index.cjs 0.68 kB + out/renderer (JS 573 kB + CSS 19.37 kB); both entry points CJS-locked as required.

**UI-SPEC grep gates (positive):** role=tablist ✓ | role=tab ✓ | aria-selected={isActive} ✓ | font-semibold text-accent ✓ | font-normal text-fg-muted ✓ | focus-visible:outline-2 focus-visible:outline-accent ✓ | h-[2px] bg-accent ✓ | filename chip class ✓ | onJumpToAnimation ✓ | focusAnimationName ✓ | onFocusConsumed ✓ | new Set(['setup-pose']) ✓ | aria-expanded={expanded} ✓ | aria-controls={bodyId} ✓ | card outer class ✓ | ring-2 ring-accent ring-offset-2 ring-offset-surface ✓ | hover:bg-accent/5 ✓ | bg-accent/20 text-accent ✓ | opacity-50 cursor-not-allowed ✓ | title="Coming in Phase 4" ✓ | empty-state class ✓ | role="region" ✓ | ▸ ✓ | ▾ ✓ | → ✓ | … ✓ | colSpan={7} ✓ | max-w-[320px] ✓ | all 7 column headers (Attachment / Bone Path / Source W×H / Scale / Peak W×H / Frame / Actions) ✓ | hover:bg-accent/10 ✓ | GlobalMaxRenderPanel button class ✓ | `Jump to ${row.sourceLabel} in Animation Breakdown` ✓ | `onJumpToAnimation !== undefined` ✓.

**UI-SPEC grep gates (negative):** font-medium absent ✓ | font-weight absent ✓ | process.platform absent ✓ | src/core/* imports absent ✓ | summary.skeletonPath absent from GlobalMaxRenderPanel ✓.

## Next

**Plan 03-03 (Wave 3):** swap `<GlobalMaxRenderPanel summary={state.summary} />` in `src/renderer/src/App.tsx` for `<AppShell summary={state.summary} />`; run the full `/gsd-verify-work 3` human-verify gate covering drop → tab switch → card expand/collapse → Setup Pose contents → empty-state animation → Bone Path + mid-ellipsis + hover reveal → disabled Override tooltip → Source Animation chip jump + scroll + flash → SearchBar filter + auto-expand + `M / N filtered` header math. Optional: fix or delete `scripts/probe-per-anim.ts` (one-line fix or deletion; not plan-blocking).
