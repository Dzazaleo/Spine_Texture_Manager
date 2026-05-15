---
phase: 41-spine-animation-viewer
plan: 02
subsystem: renderer-ui
tags: [react, modal, webgl, spine-player, aria, viewer]

# Dependency graph
requires:
  - phase: 41-01
    provides: |
      @esotericsoftware/spine-player@4.2.111 exact pin in package.json +
      Api.getViewerAssetFeed bridge (renderer-side IPC for atlas-less
      synth-atlas text + region path map) + ViewerAssetFeedResponse
      discriminated-union envelope in src/shared/types.ts.
  - phase: 6-modals
    provides: |
      Locked 5-modal ARIA scaffold (role=dialog + aria-modal=true +
      aria-labelledby + outer overlay click-close + inner stopPropagation
      + useFocusTrap Tab cycle + document-level Escape) — verbatim mirror.
  - phase: 12-app-image-protocol
    provides: |
      app-image:// custom scheme + pathToImageUrl bridge — used here to
      convert absolute PNG paths from the IPC response into spine-player-
      friendly URLs without renderer-side string concat (Phase 12 D-19
      Windows-safe).
provides:
  - AnimationPlayerModal React component (named export +
    AnimationPlayerModalProps type export) at
    src/renderer/src/modals/AnimationPlayerModal.tsx — 6th member of the
    modal family ready to be mounted from AppShell in Plan 03.
  - buildAssetFeed() — mode-agnostic feed builder collapsing
    summary.atlasPath + loaderMode into a single isAtlasLess gate;
    atlas-source returns app-image:// URLs only, atlas-less returns
    synthetic.atlas + per-region rawDataURIs map.
  - jsdom + RTL coverage for VIEWER-02..06 + VIEWER-09 (22 specs across
    7 describes) at tests/renderer/animation-player-modal.spec.tsx.
affects: [phase-41-plan-03, phase-41-wave-2-finalize]

# Tech tracking
tech-stack:
  added: []  # spine-player itself was added by Plan 01
  patterns:
    - "vi.mock function-declaration mock factory — vi.fn().mockImplementation(arrow) is NOT constructable; `new SpinePlayer(...)` throws `is not a constructor`. Function declarations (not arrows) hoist [[Construct]] correctly. The module-scope `defaultSpinePlayerImpl` + `errorSpinePlayerImpl` functions are reusable across tests via mockImplementationOnce."
    - "Microtask flush wrapped in `act` — React 18 auto-batches state updates from async callbacks; without `act`, `await Promise.resolve()` advances the microtask queue but the DOM still reflects pre-success state. The flushMicrotasks helper does four awaits inside one `act(async () => {})` block."
    - "globalThis __spinePlayerInstances sink — vi.mock factories hoist above all module-scope declarations, so the factory cannot close over a `const spinePlayerInstances = []` declared at module scope. The sink lives on globalThis and a helper readInstances() lazily initialises it."
    - "Pitfall 8 belt-and-suspenders — player container div carries BOTH `flex-1` (Tailwind class) AND `style={{ minHeight: 400 }}` (inline). spine-player's inner canvas uses width:100%/height:100% which collapses to 1×1 px without a sized parent."
    - "Skin-switch call order: setSkinByName → setSlotsToSetupPose. Without the second call, attachments from the previous skin remain bound to slots (Pattern 3, vendored spine-player line 14446)."

key-files:
  created:
    - "src/renderer/src/modals/AnimationPlayerModal.tsx (451 lines)"
    - "tests/renderer/animation-player-modal.spec.tsx (783 lines, 22 it()s in 7 describes)"
    - ".planning/phases/41-spine-animation-viewer/41-02-SUMMARY.md (this file)"
  modified: []  # Only additive; no existing files touched

key-decisions:
  - "D-02 standalone modal implemented byte-for-byte verbatim — same outer overlay (z-50 + bg-black/40), same inner card class signature with the only difference being the wider w-[1280px] (D-02a near-fullscreen) and the additional `relative` class for the absolute-positioned error overlay."
  - "D-02a near-fullscreen sizing locked: w-[1280px] max-w-[95vw] max-h-[90vh]. Larger than AtlasPreviewModal's 1024px because complex rigs (Girl, JOKERMAN) need canvas room per the CONTEXT.md rationale."
  - "D-02c #232732 canvas background via TWO independent paths: (1) backgroundColor: '23273200' passed into SpinePlayerConfig (the alpha 00 means the spine-player canvas is transparent — the panel-surface below shows through); (2) bg-[#232732] Tailwind class on the player container div as the visible base. Belt-and-suspenders against any spine-player change in canvas painting behaviour."
  - "D-04 source-only feed locked. No Optimize output-dir coupling. buildAssetFeed dispatches strictly on isAtlasLess = (atlasPath === null || loaderMode === 'atlas-less') with NO third branch."
  - "D-04b default open: animations[0] + skins[0] + setAnimation(name, true) [loop on] + setSkinByName + setSlotsToSetupPose. No persistence — every open is predictable."
  - "D-04c terminal in-modal error overlay implemented exactly as plan's <error_copy> block: title 'Unable to load the animation viewer' + body 'The Spine project could not be loaded for playback.' + the verbatim spine-player reason on its own line + 'Close this dialog, fix the file on disk, and reopen the viewer.' instruction line. Single Close button; no retry; no folder-opener helper. role=alert for screen-reader live-region semantics."

requirements-completed:
  - VIEWER-02
  - VIEWER-03
  - VIEWER-04
  - VIEWER-05
  - VIEWER-06
  - VIEWER-08  # useEffect dep array satisfies the project-change cleanup contract; AppShell wiring is Plan 03's responsibility
  - VIEWER-09

# Metrics
duration: 10min
completed: 2026-05-15
---

# Phase 41 Plan 02: AnimationPlayerModal Summary

**6th member of the modal family — `AnimationPlayerModal.tsx` wraps `@esotericsoftware/spine-player@4.2.111` inside the locked Phase 6 D-81 ARIA scaffold, with a top control bar (Animation / Skin selects + play/pause + scrub), a 100%-height canvas container backed by Pitfall-8 belt-and-suspenders `flex-1` + `style={{ minHeight: 400 }}`, and a terminal in-modal error overlay (CONTEXT D-04c verbatim copy + Close-only).**

## Performance

- **Duration:** ~10 min (584 seconds)
- **Started:** 2026-05-15T15:46:27Z
- **Completed:** 2026-05-15T15:56:11Z
- **Tasks:** 2 (1 RED spec + 1 GREEN implementation)
- **Files created:** 2 (`AnimationPlayerModal.tsx` 451 lines, `animation-player-modal.spec.tsx` 783 lines)
- **Files modified:** 0
- **Test delta:** +22 it() specs in 7 describe blocks (mount/dispose, asset-feed, construction, animation+skin switching, transport, error state, close interactions)

## Accomplishments

- **Full RED → GREEN cycle observed:** Task 1 committed (`3c5523b`) the 22 failing tests against the not-yet-existing AnimationPlayerModal export; Task 2 (`5d29147`) implemented the modal and turned all 22 GREEN in a single iteration.
- **Layer 3 invariant preserved:** AnimationPlayerModal imports only from `react`, `clsx`, `../../../shared/types.js`, `../hooks/useFocusTrap`, and `@esotericsoftware/spine-player`. No `../../core/*` imports. `tests/arch.spec.ts` runs 13/13 GREEN unchanged.
- **Both Pitfall guards present:** `try/catch` wraps `new SpinePlayer(...)` to swallow the synchronous throw that fires AFTER `config.error` (vendored line 14954); `disposed` flag in the cleanup guards `player.dispose()` from running twice on the same instance (HMR + double-unmount safety).
- **Pitfall 8 belt-and-suspenders:** Player container has BOTH `flex-1` AND inline `style={{ minHeight: 400 }}`. Verified by spec test `player container div has BOTH flex-1 class AND minHeight:400 inline style (Pitfall 8)`.
- **useEffect dep array is `[props.summary, props.loaderMode, props.open]`** — supports Plan 03's AppShell-side project-change cleanup contract (VIEWER-08) without modification: whenever AppShell threads a fresh `summary` identity, the effect tears down the prior player and rebuilds the asset feed against the new project.
- **Asset-feed routing is mode-agnostic:** atlas-source returns `{skeletonUrl, atlasUrl, rawDataURIs: {}}` (spine-player resolves page PNGs via `parent + page.name`); atlas-less returns `{skeletonUrl, atlasUrl: 'synthetic.atlas', rawDataURIs: { 'synthetic.atlas': <base64 data URI>, '<region>.png': <app-image:// URL> }}`. Branch is `summary.atlasPath === null || loaderMode === 'atlas-less'` — covered by three separate spec tests (atlas-source, atlas-less by loaderMode, atlas-less by summary.atlasPath fallback).
- **Skin-switch call order asserted:** `setSkinByName` precedes `setSlotsToSetupPose` (via `.mock.invocationCallOrder` comparison in the spec).
- **Scrub uses RESEARCH Pattern 4 sequence exactly:** pause → animationState.update(delta) → animationState.apply(skeleton) → skeleton.update(delta) → skeleton.updateWorldTransform(2) → write back playTime. The literal `2` is the Physics.update enum value per CLAUDE.md fact #3.

## Task Commits

Each task committed atomically with RED before GREEN, enforcing the TDD gate:

1. **Task 1 (RED): Failing AnimationPlayerModal spec** — `3c5523b` (test)
   - 22 it() specs across 7 describes. RED state confirmed: `Failed to resolve import "AnimationPlayerModal" — Does the file exist?` (exactly the failure mode Task 2 resolved).

2. **Task 2 (GREEN): AnimationPlayerModal implementation** — `5d29147` (feat)
   - 22/22 specs GREEN after the implementation lands; full suite 1184 passing + 22 skipped + 2 pre-existing failures (DEF-41-01-01, out of scope per Plan 01 deferred-items log).

_TDD gate compliance: A `test(...)` commit at `3c5523b` precedes a `feat(...)` commit at `5d29147`. No REFACTOR commit was needed — the implementation matched the RESEARCH patterns + CONTEXT decisions verbatim and required no clean-up after RED→GREEN landed._

## Files Created/Modified

### Created

- **`src/renderer/src/modals/AnimationPlayerModal.tsx`** (451 lines)
  - Exports: `AnimationPlayerModal` function component + `AnimationPlayerModalProps` interface.
  - Imports: `react` (useCallback/useEffect/useRef/useState), `clsx`, `@esotericsoftware/spine-player` (SpinePlayer + SpinePlayerConfig type), `../../../shared/types.js` (SkeletonSummary + ViewerAssetFeedResponse), `../hooks/useFocusTrap`.
  - Body: header doc, `buildAssetFeed()` async helper (mode-agnostic), `AnimationPlayerModalProps` interface, `AnimationPlayerModal` function with state (`playerState`, `errorReason`, `availableAnimations`, `availableSkins`, `activeAnimation`, `activeSkin`, `isPaused`, `scrubPercent`), the main mount effect, four callback handlers (onAnimationChange, onSkinChange, onPlay/onPause, onScrub), open-gate early return, and the JSX tree (overlay → card → header → control bar → player container → conditional error overlay).

- **`tests/renderer/animation-player-modal.spec.tsx`** (783 lines)
  - vi.mock for `@esotericsoftware/spine-player` with a `globalThis.__spinePlayerInstances` sink + function-declaration mock implementations (default + error path).
  - `vi.stubGlobal('api', { pathToImageUrl, getViewerAssetFeed })` matching the production main-side shape.
  - `makeSummary({ atlasPath?, skeletonPath? })` helper synthesizing a SkeletonSummary with `regions[]` populated for atlas-less feed-builder coverage.
  - `flushMicrotasks()` async helper wrapped in `act` (React-18 batching safety).
  - 7 describes / 22 it() blocks covering VIEWER-02..06 + VIEWER-09 + close-interaction triad.

- **`.planning/phases/41-spine-animation-viewer/41-02-SUMMARY.md`** (this file)

### Modified

None.

## Decisions Made

None — every planner-locked decision (D-02 standalone modal, D-02a near-fullscreen size, D-02c canvas bg path, D-04 source-only feed, D-04b default open state, D-04c terminal error UX with verbatim copy) was implemented byte-for-byte. The plan's `<error_copy>` block, the RESEARCH Pattern 1-4 code, and the Pitfall 2/5/8 guards were all transcribed verbatim or paraphrased without semantic change.

## Deviations from Plan

None — the plan executed exactly as written for both tasks.

**One implementation refinement during Task 2 GREEN iteration** (not a deviation from the plan body — these are improvements to the spec test harness only, which the plan's <action> block left to the executor's discretion):

- The plan's <action> block proposed `vi.fn().mockImplementation((_container, config) => { ... })` for the SpinePlayer mock. That shape uses an arrow function, which lacks an internal `[[Construct]]` method and throws `is not a constructor` when the renderer calls `new SpinePlayer(...)`. The implementation upgraded the mock to a function declaration (`function defaultSpinePlayerImpl(_container, config) { ... }`) which vi.fn can correctly invoke as a constructor. The same pattern was applied to the error-path mock (a single shared `errorSpinePlayerImpl` function with a `mockErrorReason` module-scope variable so the three error tests can reuse it via `mockImplementationOnce`).
- The plan's <action> block expected `await Promise.resolve()` to suffice for flushing the success microtask. React 18's auto-batching of async state updates means the DOM doesn't reflect post-success state until the next React commit, which requires an `act` wrapper. The `flushMicrotasks` helper was upgraded to `act(async () => { await Promise.resolve(); ... })`. This is a Vitest + React 18 + jsdom interaction pattern; not a deviation from the plan's contract (the plan asserts contract observable behaviour, not the specific await pattern used to reach it).

Both adjustments are spec-harness internals — the contract assertions (constructor invocation count, asset-feed shape, dispose count, call order of setSkinByName/setSlotsToSetupPose, updateWorldTransform(2), error overlay copy) match the plan's <behavior> block verbatim.

## Verify Block Status

The plan's automated verify-string ran the GREEN file through 15 individual greps. All 15 pass after a docstring-phrasing cleanup pass (e.g., removing `new SpinePlayer(container, config)` from the file header comment so `grep -c "new SpinePlayer("` returns `1` instead of `2`). The functional content is unchanged.

| Check | Status |
|---|---|
| `export function AnimationPlayerModal` | 1 ✓ |
| `new SpinePlayer(` | 1 ✓ |
| `.dispose()` | ≥1 ✓ (3 sites total) |
| `role="dialog"` | 1 ✓ |
| `aria-modal="true"` | 1 ✓ |
| `aria-labelledby="animation-viewer-title"` + `id="animation-viewer-title"` | 1+1 ✓ |
| `useFocusTrap(` | 1 ✓ |
| `showControls: false` | 1 ✓ |
| `backgroundColor: '23273200'` | 1 ✓ |
| `flex-1` | ≥1 ✓ (3 sites: control-bar scrub, player container, button gap) |
| `minHeight: 400` | 1 ✓ |
| `updateWorldTransform(2)` | 1 ✓ |
| `setSkinByName(` + `setSlotsToSetupPose()` | 2+2 ✓ (initial open + onSkinChange handler) |
| Verbatim error copy ("Unable to load the animation viewer" + "Close this dialog…") | 1+1 ✓ |
| `role="alert"` | 1 ✓ |
| `max-w-[95vw]` + `max-h-[90vh]` + `e.stopPropagation()` | 1+1+1 ✓ |
| `npm test -- tests/renderer/animation-player-modal.spec.tsx` | 22/22 GREEN ✓ |
| `npm test` full suite | 1184 passed (only DEF-41-01-01 pre-existing failures remain) ✓ |
| `npx tsc --noEmit` | 0 errors ✓ |
| `npm test -- tests/arch.spec.ts` | 13/13 GREEN (Layer 3 invariant) ✓ |

## Issues Encountered

**Two iteration loops during Task 2 GREEN** (both resolved within Task 2 — no deviation commits needed):

1. **vi.fn arrow-impl is not a constructor.** First test run failed with `(_container, config) => { ... } is not a constructor` because the spec's `vi.fn().mockImplementation(arrowFn)` arrow doesn't have a `[[Construct]]` slot. Fix: extracted both the default-path and error-path mocks into named function declarations (`defaultSpinePlayerImpl`, `errorSpinePlayerImpl`); both work correctly with `new` because function declarations are constructable.

2. **React 18 batching swallowed setState before assertions.** After fix #1, ~half the specs still failed because the DOM showed `<select disabled />` even though `setAvailableAnimations` had run. Fix: wrapped `flushMicrotasks()`'s four `await Promise.resolve()` hops inside `act(async () => { ... })`. After this, all 22 specs GREEN on first run.

Both fixes are spec-harness internals — no impact on the production component code.

**Pre-existing test failures in worktree (out of scope, documented by Plan 01)**

The full vitest suite reports the same 2 pre-existing failures Plan 41-01's SUMMARY documented under DEF-41-01-01:

- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — fixture `fixtures/SAMPLER_ALPHA_ZERO/...` not in worktree base.
- `tests/main/sampler-worker-girl.spec.ts` — fixture `fixtures/Girl/...` not in worktree base.

Both reproduce against the base commit `0169948` BEFORE any Plan 02 changes. Per executor deviation-rules scope-boundary, these are out of scope. Plan 02 introduces ZERO new regressions: the 1184-passed delta exactly matches Plan 01's post-execution count plus the +22 specs added here.

**Plan 02's own scoped suite:**

```
npm test -- tests/renderer/animation-player-modal.spec.tsx → Test Files 1 passed, Tests 22 passed
```

## Known Stubs

None.

A stub-pattern scan of `AnimationPlayerModal.tsx` for `TODO`, `FIXME`, "coming soon", "placeholder", "not available", and hardcoded empty-state UI returned zero hits.

The viewer's default-empty state (`availableAnimations: []` + `availableSkins: []` before the success callback) is a transient loading state, not a stub — it transitions to populated state within one microtask after spine-player's asset-load completes. The controls are `disabled` until `playerState === 'ready'`, ensuring no user can interact with a half-loaded viewer.

## Threat Flags

No new threat surface beyond the plan's `<threat_model>` block. The component consumes the trust-bounded `ViewerAssetFeedResponse` envelope from Plan 01's IPC, threads `regionPaths` absolute paths through the existing `pathToImageUrl` Phase 12 bridge (no new file-system surface), and the `try/catch` around `new SpinePlayer(...)` (T-41-03 mitigation) is in place.

## User Setup Required

None — no external service configuration. The new modal is loaded by the next Plan (03) wire-up in AppShell.

## Next Phase Readiness

- **Plan 03 (AppShell wiring + project-change cleanup useEffect)** is the final wave-2 plan. It depends on:
  - `AnimationPlayerModal` named export from `src/renderer/src/modals/AnimationPlayerModal.tsx` — ✓ provided.
  - `AnimationPlayerModalProps` type with `{ open, summary, loaderMode, onClose }` — ✓ provided.
  - useEffect dep array supporting summary-identity-driven cleanup — ✓ implemented; AppShell can rely on `setAnimationViewerOpen(false)` in its own summary-reset effect to satisfy VIEWER-08 without further changes inside the modal.
- All four blocking pre-reqs from the plan's `<context>` block are met (Plan 01 dependency-pin + IPC, Phase 12 app-image:// bridge, Phase 6 useFocusTrap hook, Phase 21 synth-atlas path).

## Manual UAT Items (handed off to 41-HUMAN-UAT.md per 41-VALIDATION.md)

This jsdom + RTL spec covers the contract surface (mount/dispose, asset-feed shape, dispose count, switch order, transport sequence, error copy verbatim, close interactions). The following are NOT covered here and MUST be exercised in a live Electron window during phase verification:

- **VIEWER-04 visible character render** — jsdom has no WebGL; we exercise SpinePlayer construction shape only.
- **VIEWER-06 visible scrub-pose-update synchrony** — jsdom can't paint.
- **VIEWER-08 real GL leak verification across 10 open/close cycles** — `chrome://memory` or Cmd-Shift-J Performance panel during dev mode.
- **VIEWER-09 real-fs corrupted-fixture error UI** — point the viewer at a malformed `.json` or remove a referenced PNG and confirm the terminal overlay renders the spine-player reason verbatim with the Close button working.
- **Atlas-less mode visual parity with atlas-source mode** — confirm a synth-atlas project renders identically to its atlas-source counterpart.

Plan 03's verification block (or the phase-level `/gsd-verify-work 41` step) will hand these off to a freshly-created `41-HUMAN-UAT.md`. This plan does NOT create that file (the plan's <output> block delegates that handoff to Plan 03 or downstream).

## TDD Gate Compliance

Task 1 + Task 2 followed the canonical RED → GREEN gate:

- **RED commit `3c5523b`:** 22 specs fail at vite import-resolution (`Failed to resolve import "AnimationPlayerModal" — Does the file exist?`) — exactly the failure mode the plan's `<done>` block for Task 1 specifies.
- **GREEN commit `5d29147`:** 22 specs pass against the new implementation; verify-block grep gates all pass; `npx tsc --noEmit` clean; arch invariant unchanged.
- **No REFACTOR commit needed** — the GREEN implementation directly followed the verbatim PATTERNS.md + RESEARCH.md code blocks; no second-pass cleanup landed.

---

## Self-Check: PASSED

- [x] `src/renderer/src/modals/AnimationPlayerModal.tsx` exists at the planned path
- [x] `tests/renderer/animation-player-modal.spec.tsx` exists at the planned path
- [x] `.planning/phases/41-spine-animation-viewer/41-02-SUMMARY.md` exists (this file)
- [x] `AnimationPlayerModal` is exported (1 named export — verified via grep)
- [x] `AnimationPlayerModalProps` is exported (1 named interface — verified via grep)
- [x] All 22 spec tests passing in scoped suite
- [x] Full vitest suite: 1184 passed, 22 skipped, 2 pre-existing failures (DEF-41-01-01, out of scope per Plan 01)
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm test -- tests/arch.spec.ts` → 13/13 passing (Layer 3 invariant preserved)
- [x] RED commit `3c5523b` exists in git log of the worktree branch
- [x] GREEN commit `5d29147` exists in git log of the worktree branch
- [x] No accidental file deletions in either commit (`git diff --diff-filter=D --name-only HEAD~2 HEAD` → empty)
- [x] STATE.md NOT modified (orchestrator owns shared-file writes per worktree-mode contract)
- [x] ROADMAP.md NOT modified (orchestrator owns shared-file writes per worktree-mode contract)
- [x] Worktree HEAD remained on `worktree-agent-a1590136822708dc4` throughout (protected-ref deny-list never triggered)

---

*Phase: 41-spine-animation-viewer*
*Plan: 02 (Wave 2)*
*Completed: 2026-05-15*
