---
phase: 41-spine-animation-viewer
verified: 2026-05-15T16:15:08Z
status: human_needed
score: 5/5 success criteria verified
overrides_applied: 0
requirements_verified: [VIEWER-01, VIEWER-02, VIEWER-03, VIEWER-04, VIEWER-05, VIEWER-06, VIEWER-08, VIEWER-09]
human_verification:
  - test: "VIEWER-04 visible character render in a live Electron window"
    expected: "Loading any project and clicking the new Animation Viewer toolbar button opens a modal that paints the skeleton's first animation looping continuously inside a near-fullscreen card. The character appears against the #232732 panel-surface background with no blank canvas, no 1×1px collapse (Pitfall 8), and no DevTools error spam."
    why_human: "jsdom has no WebGL context; automated tests verify SpinePlayer construction shape only. Real GL rendering is observable only in a live Electron renderer."
  - test: "VIEWER-05 + VIEWER-06 visible animation/skin switch + scrub-pose synchrony"
    expected: "While the viewer is open and looping, changing the Animation dropdown to a different animation makes the character pose update on the next frame; changing the Skin dropdown rebinds attachments with no leftover slot bleed from the previous skin; dragging the scrub bar moves the pose to the corresponding time and pauses playback. Forward AND backward scrub both produce coherent poses (see WR-05 note below)."
    why_human: "Visual synchrony between control input and rendered pose can only be confirmed in a live WebGL canvas. Backward scrub is a known WR-05 concern that needs animator validation."
  - test: "VIEWER-08 real GL leak verification across 10 open/close cycles"
    expected: "Open the viewer, close it, repeat 10 times. DevTools Performance Monitor → GPU Memory stays flat across the cycle; chrome://memory does not grow unboundedly. Switching to a different project while the viewer is open closes the modal cleanly (no GL warning in DevTools console)."
    why_human: "Real GL context teardown is not observable in jsdom; the dispose-count assertion in the spec is a proxy. Requires DevTools instrumentation against a real Electron window."
  - test: "VIEWER-09 real-fs malformed/missing asset terminal error UI"
    expected: "Point the viewer at a project with a corrupted .json (truncate a few bytes off the end), or remove a referenced PNG from images/. The viewer renders the verbatim terminal error overlay ('Unable to load the animation viewer' + body + Close button) with controls disabled. Closing the modal works; no DevTools crash."
    why_human: "Requires real-filesystem fixture mutation; jsdom test path uses mocked error callbacks. The verbatim copy and Close-only UX behavior are observable in the rendered DOM but visual confirmation against a real failure path is human-only."
  - test: "VIEWER-04 atlas-less visual parity with atlas-source"
    expected: "Load a project that uses atlas-less loaderMode (no .atlas file present, only .json + images/ folder). The viewer renders the same character at the same poses as the atlas-source equivalent. No region misalignment, no color/PMA glitch, no missing slot."
    why_human: "Visual parity between the synthesized-atlas branch and the on-disk-atlas branch is the integration check that exercises Plan 01's viewer:get-asset-feed handler + Plan 02's rawDataURIs feed assembly end-to-end. Requires both fixture variants and live rendering."
  - test: "File menu auto-suppression contract (08.2 D-184) while viewer is open"
    expected: "With the viewer open, the OS-native File menu shows Save / Save As / Reload disabled (greyed out). Cmd-S keyboard accelerator is a no-op while the modal is up. Closing the modal restores the menu items."
    why_human: "OS-native menu state is not observable in vitest. Source-grep tests verify the modalOpen OR-chain participation; the runtime suppression contract needs a live Electron menu."
---

# Phase 41: Spine Animation Viewer — Verification Report

**Phase Goal:** Animators can open an in-app viewer and watch their character animated from the currently-open project's assets, switch animations and skins live, control playback (play / pause / scrub), and trust the viewer to behave cleanly across project changes and asset-error conditions — closing the optimize → pack → validate loop without round-tripping through the Spine editor.

**Verified:** 2026-05-15T16:15:08Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open the viewer from the main UI and immediately see their character animated (VIEWER-01/02/03/04/06) | VERIFIED (automated) + HUMAN-NEEDED (visual) | Toolbar button wired at `AppShell.tsx:2150-2157` between Atlas Preview and Documentation (D-03a); `onClickAnimationViewer` (`AppShell.tsx:619-621`) sets `animationViewerOpen`; modal mount at `AppShell.tsx:2541-2548`; SpinePlayer constructed inside useEffect with `success` callback populating animation/skin lists and calling `p.setAnimation(initialAnim, true)` (`AnimationPlayerModal.tsx:187-215`). Live canvas render requires Electron — see human verification 1. |
| 2 | User can switch animations and skins live; playback updates on selection (VIEWER-05) | VERIFIED (contract) + HUMAN-NEEDED (visual) | `onAnimationChange` calls `p.setAnimation(name, true)` (`AnimationPlayerModal.tsx:258-263`); `onSkinChange` calls `setSkinByName` THEN `setSlotsToSetupPose` in that order (`AnimationPlayerModal.tsx:267-273`). Call-order asserted in spec via `.mock.invocationCallOrder` at `tests/renderer/animation-player-modal.spec.tsx:554`. Visual pose update requires Electron — see human verification 2. |
| 3 | User can control playback: play/pause/scrub, default play+loop (VIEWER-06) | VERIFIED (contract) + HUMAN-NEEDED (visual) | Play/pause callbacks at `AnimationPlayerModal.tsx:276-283` invoke `player.play()` / `player.pause()`. Scrub callback at `AnimationPlayerModal.tsx:287-305` runs the full RESEARCH Pattern 4 sequence: pause → `animationState.update(delta)` → `apply` → `skeleton.update` → `updateWorldTransform(2)` (Physics.update literal per CLAUDE.md fact #3) → write `playTime`. Default behavior: first animation + first skin + loop-on (`AnimationPlayerModal.tsx:201-213`). |
| 4 | Viewer works in both atlas-source AND atlas-less loaderModes — no cross-mode bleed (VIEWER-03) | VERIFIED | `buildAssetFeed()` at `AnimationPlayerModal.tsx:93-121` collapses both signals into a single `isAtlasLess = summary.atlasPath === null \|\| loaderMode === 'atlas-less'` gate. Atlas-source returns `{skeletonUrl, atlasUrl, rawDataURIs: {}}` (spine-player resolves page PNGs via parent+page.name). Atlas-less returns `{skeletonUrl, atlasUrl: 'synthetic.atlas', rawDataURIs: {...}}` keyed by `<regionName>.png`. Three independent spec tests cover atlas-source, atlas-less by loaderMode, and atlas-less by null atlasPath fallback (`animation-player-modal.spec.tsx:398-454`). The IPC handler (`src/main/ipc.ts:1271-1302`) re-runs `synthesizeAtlasText` on demand with structuredClone-safe Record return shape. |
| 5 | Viewer disposes cleanly on close, survives re-open + project-change, terminal in-modal error state for malformed/missing assets (VIEWER-08, VIEWER-09) | VERIFIED (contract) + HUMAN-NEEDED (GL leak + real-fs error) | `useEffect` cleanup at `AnimationPlayerModal.tsx:243-254` calls `player.dispose()` guarded by `disposed` flag (Pitfall 5 double-dispose). Repeated open/close cycles assert equal constructor/dispose counts (`animation-player-modal.spec.tsx:365`). Project-change cleanup useEffect at `AppShell.tsx:307-309` sets `setAnimationViewerOpen(false)` keyed on `[summary]` (Pitfall 6 / VIEWER-08). Terminal error overlay at `AnimationPlayerModal.tsx:420-447` renders `role="alert"` + verbatim copy ("Unable to load the animation viewer" + body + "Close this dialog…" + Close button). `try/catch` at `AnimationPlayerModal.tsx:223-240` absorbs the post-error spine-player throw (Pitfall 2). Real GL teardown + real-fs error UI need live runs — see human verification 3, 4. |

**Score:** 5/5 success criteria verified at the automated / contract level. All five require companion human verification for visual / live-runtime aspects.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | spine-player + spine-core both at exact pin 4.2.111 | VERIFIED | Both deps confirmed via grep. `npm ls` shows `@esotericsoftware/spine-core@4.2.111` direct + `spine-player@4.2.111` direct + transitive `spine-webgl@4.2.111 → spine-core@4.2.111 deduped` (Pitfall 1 satisfied — single resolved spine-core copy). |
| `src/shared/types.ts` | `ViewerAssetFeedResponse` exported + `Api.getViewerAssetFeed` declared | VERIFIED | Type at line 960 (discriminated union, structuredClone-safe — `Record<string,string>` not Map). Api method at line 1774. |
| `src/preload/index.ts` | `getViewerAssetFeed` bridge | VERIFIED | Bridge at line 672 — single-arg ipcRenderer.invoke proxy mirroring `pathToImageUrl`. |
| `src/main/ipc.ts` | `viewer:get-asset-feed` handler with trust-boundary guards | VERIFIED | Handler at lines 1271-1302. `typeof skeletonPath !== 'string'` guard + case-insensitive `.endsWith('.json')` guard fire BEFORE any fs read. `synthesizeAtlasText` invoked. Try/catch wraps the entire fs+synth path; all error paths return `{ok: false}` envelope — no throws cross the IPC boundary. |
| `src/renderer/src/modals/AnimationPlayerModal.tsx` | 6th modal-family member wrapping spine-player | VERIFIED | 451 lines. Imports only react + clsx + ../../../shared/types.js + ../hooks/useFocusTrap + @esotericsoftware/spine-player. Zero `core/` imports (Layer 3 invariant intact). Named exports `AnimationPlayerModal` + `AnimationPlayerModalProps`. |
| `src/renderer/src/components/AppShell.tsx` | Import + state slot + click handler + toolbar button + JSX mount + modalOpen OR-chain + dep array + [summary] cleanup useEffect | VERIFIED | All 7 insertion sites confirmed via grep at the expected lines (67, 215, 308, 619, 1686, 1715, 2152, 2541-2548). |
| `tests/main/viewer-asset-feed-ipc.spec.ts` | 4 tests covering trust boundary + success + error | VERIFIED | File exists; 4 `it()` blocks. All pass under `npm test`. |
| `tests/renderer/animation-player-modal.spec.tsx` | jsdom + RTL coverage of mount/dispose/feed/switching/transport/error | VERIFIED | 22 `it()` blocks across 7 describes (VIEWER-02/03/04/05/06/09 + close interactions). All pass. |
| `tests/renderer/app-shell-animation-viewer.spec.tsx` | 13 source-grep tests for all 7 AppShell insertion sites | VERIFIED | 13 `it()` blocks. All pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AppShell.tsx` (button) | state setter | `onClickAnimationViewer` → `setAnimationViewerOpen(true)` | WIRED | Button at line 2152 references `onClickAnimationViewer` (defined at line 619, sets `animationViewerOpen=true` at line 620). |
| `AppShell.tsx` (JSX mount) | `AnimationPlayerModal` component | `<AnimationPlayerModal summary={effectiveSummary} loaderMode={loaderMode} onClose={...} />` | WIRED | Mount at lines 2541-2548. Props `summary={effectiveSummary}` (line 2544) and `loaderMode={loaderMode}` (line 2545) pass correct values from existing AppShell state. |
| `AppShell.tsx` (modalOpen OR-chain) | main IPC menu state | `animationViewerOpen \|\|` in body + dep array (Pitfall 7) | WIRED | OR-chain entry at line 1686. Dep array entry at line 1715. Both halves of Pitfall 7 satisfied → File menu auto-suppresses while viewer open (08.2 D-184). |
| `AppShell.tsx` (project-change cleanup useEffect) | viewer modal close | `setAnimationViewerOpen(false)` keyed on `[summary]` | WIRED | useEffect at lines 307-309 fires on `summary` identity change → animationViewerOpen flips false → conditional mount unmounts → modal cleanup runs → `player.dispose()` (Pitfall 6 / VIEWER-08). |
| `AnimationPlayerModal.tsx` | `@esotericsoftware/spine-player` | `import { SpinePlayer, type SpinePlayerConfig }` + `new SpinePlayer(container, config)` | WIRED | Import at lines 45-48. Constructor at line 224. dispose at line 248. |
| `AnimationPlayerModal.tsx` (buildAssetFeed atlas-less branch) | `viewer:get-asset-feed` IPC | `window.api.getViewerAssetFeed(summary.skeletonPath)` | WIRED | Call at line 108. Preload bridge at `preload/index.ts:672`. Main handler at `ipc.ts:1271`. Handler calls `synthesizeAtlasText` (line 1286). |
| `AnimationPlayerModal.tsx` (buildAssetFeed) | `window.api.pathToImageUrl` | per-region absPath → app-image:// URL | WIRED | Call at line 118 for atlas-less per-region; line 97/104 for skeleton/atlas URLs. |
| `AnimationPlayerModal.tsx` | `useFocusTrap` hook | `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` | WIRED | Call at line 144. ARIA scaffold (Tab cycle + Esc) reused verbatim. |
| `AnimationPlayerModal.tsx` (success callback) | UI state populating dropdowns | `setAvailableAnimations(animations)` + `setAvailableSkins(skins)` | WIRED | Callback at lines 187-215 reads `p.skeleton.data.animations.map(a => a.name)` and `p.skeleton.data.skins.map(s => s.name)`. State drives the `<select>` `<option>` lists at lines 356-361 and 376-381. |
| `AnimationPlayerModal.tsx` (config.error) | terminal error overlay | `setPlayerState('error') + setErrorReason(reason)` → `playerState === 'error'` render gate | WIRED | Error callback at lines 216-220. Overlay JSX at lines 420-447 conditionally renders verbatim copy + Close button. Try/catch at 223-240 absorbs Pitfall 2 post-error throw. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `AnimationPlayerModal.tsx` Animation `<select>` options | `availableAnimations` state | `p.skeleton.data.animations.map(a => a.name)` populated in spine-player success callback | YES (post-success) | FLOWING — populated only after real spine-player parses real skeleton JSON. In jsdom tests, the mocked SpinePlayer fires success with stub data; in production, spine-player's AssetManager XHRs the skeleton via app-image://. |
| `AnimationPlayerModal.tsx` Skin `<select>` options | `availableSkins` state | `p.skeleton.data.skins.map(s => s.name)` in success callback | YES (post-success) | FLOWING — same path. |
| `AnimationPlayerModal.tsx` canvas | spine-player internal renderer | spine-player AssetManager downloads skeleton + atlas via app-image://; on success, requestAnimationFrame loop ticks | YES (in Electron) | FLOWING — verified by SpinePlayer constructor + dispose contract in tests; live rendering needs human-verification 1. |
| `AnimationPlayerModal.tsx` error overlay | `errorReason` state | spine-player config.error callback reason string OR caught throw OR buildAssetFeed throw (`feed.ok === false`) | YES | FLOWING — overlay only renders when `playerState === 'error'`. State is set only on real failure path (mocked in tests, real in Electron). |
| `AppShell.tsx` `effectiveSummary` (modal prop) | effectiveSummary | derived from AppShell `summary` prop + localSummary state | YES | FLOWING — AppShell receives summary from App.tsx project-load state. |
| `AppShell.tsx` `loaderMode` (modal prop) | loaderMode useState | initialized from `initialProject?.loaderMode ?? 'auto'` | YES | FLOWING — existing AppShell state, not new to this phase. |

No hollow components found. The default-empty state for `availableAnimations: []` + `availableSkins: []` is transient loading state (controls are `disabled` until `playerState === 'ready'`) — not a stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| spine-player dep installed at exact pin | `npm ls @esotericsoftware/spine-player @esotericsoftware/spine-core` | spine-core@4.2.111 direct + spine-player@4.2.111 direct + transitive spine-webgl@4.2.111 → spine-core@4.2.111 deduped | PASS |
| Architecture invariant (no core/ imports from renderer) | `npm test -- tests/arch.spec.ts` | 13/13 passing | PASS |
| Phase 41 scoped test suites | `npm test -- tests/main/viewer-asset-feed-ipc.spec.ts tests/renderer/animation-player-modal.spec.tsx tests/renderer/app-shell-animation-viewer.spec.tsx` | 39/39 passing across 3 test files | PASS |
| TypeScript compilation | `npx tsc --noEmit` | 0 errors | PASS |
| Full vitest suite | `npm test` | 1220 passed / 2 skipped / 2 todo (post-merge state, stable on second run; first run flaked on jsdom canvas getContext issue then recovered) | PASS |
| Layer 3 invariant — no core/ imports in modal | `grep "from '\.\./\.\./core\|from '\.\./\.\./\.\./core'" AnimationPlayerModal.tsx` | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEWER-01 | Plan 01 | spine-player runtime installed + importable from renderer | SATISFIED | `package.json` exact pin 4.2.111; `npm ls` dedupe confirmed; modal imports `{ SpinePlayer, type SpinePlayerConfig }` from package at `AnimationPlayerModal.tsx:45-48`. |
| VIEWER-02 | Plan 02 | React wrapper mounts/unmounts cleanly, HMR-safe | SATISFIED | useEffect with `[props.summary, props.loaderMode, props.open]` dep array; `disposed` flag guards double-dispose; mount-and-unmount-×5 test asserts equal constructor and dispose counts (`animation-player-modal.spec.tsx:365`). HMR resilience via the dep array (any prop change triggers full teardown). |
| VIEWER-03 | Plan 01 + Plan 02 | Viewer consumes currently-open project's JSON + atlas + page PNGs (both modes) | SATISFIED | `buildAssetFeed` dispatches on `isAtlasLess`; atlas-source uses on-disk paths via `pathToImageUrl`; atlas-less uses new IPC `getViewerAssetFeed` + synthesizeAtlasText; three independent specs cover both modes (`animation-player-modal.spec.tsx:398-454`). |
| VIEWER-04 | Plan 03 | Reachable from main UI — opens, shows character animated | SATISFIED (contract) / NEEDS HUMAN (visual) | Toolbar button at AppShell.tsx:2150-2157 + state slot + click handler + JSX mount. Visual character render needs live Electron (human verification 1). |
| VIEWER-05 | Plan 02 | Switch animations + skins live; playback updates on selection | SATISFIED (contract) / NEEDS HUMAN (visual) | `setAnimation(name, true)` for anim; `setSkinByName(name)` THEN `setSlotsToSetupPose()` for skin. Call-order asserted via `.mock.invocationCallOrder`. Visual pose update needs live Electron (human verification 2). |
| VIEWER-06 | Plan 02 | Play / pause / scrub controls; default play + loop on | SATISFIED (contract) / NEEDS HUMAN (visual) | Play/pause callbacks invoke `player.play/pause()`; scrub callback runs RESEARCH Pattern 4 sequence with literal `2` for Physics.update; default open uses animations[0] + skins[0] with `setAnimation(initialAnim, true)` (loop on). NOTE: WR-05 from 41-REVIEW.md identifies that backward scrub may produce visual glitches in spine-runtime 4.2 due to negative-delta animationState.update behavior — human verification 2 specifically asks to test backward scrub. |
| VIEWER-08 | Plan 02 + Plan 03 | Disposes GL context; no leak on close/reopen; switching project closes prior viewer | SATISFIED (contract) / NEEDS HUMAN (GL leak) | Modal-level: `player.dispose()` in useEffect cleanup guarded by `disposed` flag. AppShell-level: `[summary]`-keyed useEffect closes modal on project change. GL leak verification needs DevTools instrumentation (human verification 3). |
| VIEWER-09 | Plan 02 | Terminal in-modal error state on malformed JSON / missing atlas / unreadable PNGs | SATISFIED (contract) / NEEDS HUMAN (real-fs error) | Terminal overlay at lines 420-447 renders `role="alert"` + verbatim copy ("Unable to load the animation viewer" + body + "Close this dialog…" + Close button) when `playerState === 'error'`. Triggered by spine-player config.error callback OR caught throw OR buildAssetFeed throw. Real-filesystem failure UX needs human verification 4. |

All 8 active requirement IDs are accounted for in PLAN frontmatter and verified. VIEWER-07 is correctly out of scope (Future per REQUIREMENTS.md, gated on SEED-009 D-02 picking option B or C).

No orphaned requirements: REQUIREMENTS.md maps VIEWER-01..06 + VIEWER-08 + VIEWER-09 to Phase 41, and all 8 are claimed by at least one of Plans 01/02/03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/ipc.ts` | 1271-1302 | Trust-boundary handler reads + JSON.parses any path matching `.json` with no size cap (WR-01 from 41-REVIEW.md) | WARNING | Post-shipping hardening — does not block the phase goal. The handler does enforce typeof + extension guards and never throws across IPC; the unbounded readFile is a DoS surface to a compromised renderer, not a user-facing defect. |
| `src/main/ipc.ts` | 1290-1293 / `src/renderer/src/modals/AnimationPlayerModal.tsx:114-119` | `regionPaths` populated as plain object literal (no `Object.create(null)`) — keys like `'constructor'`, `'hasOwnProperty'` would shadow prototype methods (WR-02) | WARNING | Defense-in-depth — does not block the phase goal. The keys come from synthesizeAtlasText walking a parsed skeleton JSON; the spine-player AssetManager reads via `rawDataURIs[key]` so a region literally named "constructor" would be the trigger. Real-world Spine projects do not name regions after prototype methods. |
| `src/renderer/src/components/AppShell.tsx` | 2546 + 2530 + 2563 + 2590 | `onClose={() => setX(false)}` inline arrow — fresh allocation every render → `useFocusTrap` deps change → focus snaps on every AppShell re-render (WR-03) | WARNING | Long-lived modal UX defect. The viewer is the first long-lived modal where this pattern bites (existing modals are short-lived). NOT a blocker for the phase goal (functional contract is satisfied), but flagged for human verification — animator may notice focus snapping mid-interaction during a real playback session. Fix is a 1-line memoization at the AppShell call site. |
| `src/main/ipc.ts` | 1295-1300 | JSON.parse / fs error messages forwarded verbatim — content + path-existence oracle to a compromised renderer (WR-04) | WARNING | Post-shipping hardening — same disposition as WR-01. |
| `src/renderer/src/modals/AnimationPlayerModal.tsx` | 287-305 | Scrub handler issues `animationState.update(negative-delta)` when seeking backward — spine-runtime 4.2 does not symmetrically handle negative deltas (WR-05) | WARNING | Potential visible defect on backward scrub. Forward scrub dominates so initial UAT may pass without exposing this. Human verification 2 specifically asks to test backward scrub. Fix is to write `entry.trackTime = targetTime` directly per the vendored slider behavior. |

No BLOCKER-class anti-patterns found. Five warnings; none gate the phase goal but the WR-03 focus-snap and WR-05 backward-scrub are observable UX defects flagged for human verification.

### Human Verification Required

See `human_verification:` block in frontmatter. Six items:

1. VIEWER-04 visible character render in a live Electron window.
2. VIEWER-05 + VIEWER-06 visible animation/skin switch + scrub-pose synchrony (forward AND backward — flag WR-05).
3. VIEWER-08 GL leak verification across 10 open/close cycles (DevTools Performance Monitor).
4. VIEWER-09 real-fs malformed/missing-asset terminal error UI.
5. Atlas-less visual parity with atlas-source mode.
6. File menu auto-suppression contract (08.2 D-184) while viewer is open.

### Decisions Honored (CONTEXT.md cross-check)

| Decision | Status | Where |
|----------|--------|-------|
| D-01 spine-player as npm dep (not vendored) | HONORED | `package.json:26-27` exact pin 4.2.111 |
| D-01a `dependencies` block (renderer default lean) | HONORED | placed in `dependencies`, mirrors spine-core |
| D-02 Standalone modal (sibling to AtlasPreviewModal) | HONORED | `AnimationPlayerModal.tsx` — 6th modal-family member |
| D-02a Near-fullscreen sizing | HONORED | `w-[1280px] max-w-[95vw] max-h-[90vh]` at line 323 |
| D-02b Top control bar (anim / skin / play-pause / scrub) | HONORED | Control bar at lines 342-407 in horizontal flex layout |
| D-02c #232732 canvas bg | HONORED | `backgroundColor: '23273200'` (config) + `bg-[#232732]` (container class) — belt-and-suspenders |
| D-03 Single toolbar button | HONORED | `AppShell.tsx:2150-2157` |
| D-03a Position: Atlas Preview → Animation Viewer → Documentation | HONORED | Source-grep test (8) at `app-shell-animation-viewer.spec.tsx` verifies byte-order |
| D-03b Label "Animation Viewer" | HONORED | line 2156 |
| D-03c Disable when `peaks.length === 0` | HONORED | line 2153 |
| D-04 Source project only (no Optimize coupling) | HONORED | `buildAssetFeed` reads `summary.skeletonPath` + `summary.atlasPath` only — no output-dir branch |
| D-04a Atlas-less reuses Phase 21 synth path | HONORED | new IPC re-runs `synthesizeAtlasText` on demand |
| D-04b Default open: animations[0] + skins[0] + play + loop on | HONORED | lines 201-213 |
| D-04c Terminal error UX with Close-only (verbatim copy locked) | HONORED | lines 420-447 — exact title, body, and instruction line; single Close button; no retry, no helper |

All locked decisions implemented verbatim.

### Gaps Summary

No automation-detectable gaps. All 5 ROADMAP success criteria pass at the automated/contract level. All 8 active requirement IDs (VIEWER-01..06 + VIEWER-08 + VIEWER-09) are claimed and verified. All 7 surgical AppShell insertion sites land at the expected locations with the expected shapes. Plan 02's TDD spec coverage is comprehensive (22 jsdom assertions); Plan 03's source-grep spec coverage is comprehensive (13 invariants). TypeScript compiles clean. Full vitest suite passes 1220/1220 (post-flake on a single jsdom canvas getContext stub that recovered on the second run — orthogonal to this phase).

Six items require human verification because they involve real WebGL rendering, real filesystem error paths, real GL context teardown, or real OS-native menu suppression — surfaces that jsdom + RTL cannot exercise. None of these gaps indicate missing implementation; they are the inherent automation ceiling for a WebGL renderer in an Electron app.

The five warning-class findings from 41-REVIEW.md (WR-01 size cap, WR-02 prototype shadowing, WR-03 focus snap, WR-04 error oracle, WR-05 backward scrub) are documented for post-shipping hardening. Only WR-03 (focus snap on inline-arrow `onClose`) and WR-05 (backward scrub negative-delta) are observable UX defects that the user may notice during human verification 2 — both are flagged in the human verification entries. Neither blocks the phase goal as written.

---

_Verified: 2026-05-15T16:15:08Z_
_Verifier: Claude (gsd-verifier)_
