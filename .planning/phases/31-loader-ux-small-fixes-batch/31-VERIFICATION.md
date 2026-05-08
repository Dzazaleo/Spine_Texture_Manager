---
phase: 31-loader-ux-small-fixes-batch
verified: 2026-05-08T17:46:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Windows-admin DnD advisory live UAT"
    expected: "On a real Windows machine, launching the app via 'Run as administrator' produces an idle DropZone showing the verbatim two-sentence advisory. Dragging a .json file over the window does NOT toggle the drag-over ring and does NOT load anything. macOS + Linux DnD remain functional."
    why_human: "Layer 3 platform branch only triggers on Windows. The probe uses `child_process.exec('net session')` which cannot be exercised authentically in vitest/jsdom. Pre-existing memory `feedback_narrow_before_fixing.md` and Phase 31-03 SUMMARY explicitly defer this to live UAT (host-blocked)."
  - test: "ExtrapolationIcon hover tooltip live UAT"
    expected: "Loading a fixture with peakScale > 1 rows (e.g. fixtures with extrapolation), hovering the up-arrow icon in BOTH the Global Max Render Source panel AND the Animation Breakdown panel surfaces the verbatim 'Spine rig peak: X.XX× source — export capped at canonical' tooltip in a portaled `<div role=\"tooltip\">`. The parent TD's 'World AABB at peak' tooltip should NOT appear when hovering the icon."
    why_human: "Phase 31-04 Task 1 was a static source-walk diagnosis (no Electron dev server available to subagent). The fix-shape (c) port relies on browser-native `getBoundingClientRect` + cursor hover behavior which jsdom does not faithfully simulate. SUMMARY notes the regression-resistance is structural (createPortal escapes ancestor chain) but visual confirmation requires Chromium."
  - test: "Animation Breakdown Expand/Collapse all visual UAT"
    expected: "Loading a project with multiple animations and switching to the Animation Breakdown tab: all cards (Setup Pose first, all collapsed) render. Clicking 'Expand all' opens every card. Clicking 'Collapse all' closes every card. Reloading the project resets all to collapsed. The two h-8 buttons match the v1.3 unified toolbar style visually."
    why_human: "Visual style consistency (h-8 button style + cursor + hover states) and animation flow (smooth scroll + flash) cannot be fully validated in jsdom. Behavioral assertions are green; visual harmony with sibling toolbar buttons is a human-eyes check."
  - test: "Source-toggle disabled state visual UAT"
    expected: "Loading an atlas-source project where `images/` directory is absent: the loader-mode menu item appears greyed-out (text-fg-muted, cursor-not-allowed on hover) and shows a native browser tooltip with the verbatim 'No images/ folder found in this project's folder' on hover. Symmetric for atlas-less mode missing .atlas. When the alternate source IS present, no greying or tooltip surfaces and clicking still toggles."
    why_human: "Native HTML title attribute hover tooltips are browser-rendered and cannot be visually asserted in jsdom (the attribute presence is asserted programmatically — but the OS-level tooltip popup behavior is browser/OS dependent)."
---

# Phase 31: Loader & UX small-fixes batch Verification Report

**Phase Goal:** Four independent UX wirings on existing surfaces, batched per granularity calibration: (a) source-toggle disable+tooltip when atlas/images-folder absent (LOAD-05..07); (b) Animation Breakdown default-collapsed + bulk Expand all/Collapse all toolbar buttons + Setup Pose stays first (PANEL-08..11); (c) Windows admin drag-drop fallback — detect elevation, disable drop targets, route user to File → Open or unprivileged relaunch via clear message (PLATFORM-01); (d) ExtrapolationIcon tooltip regression — up-arrow icon on Peak W×H cells with peakScale > 1 no longer surfaces its SVG `<title>` on hover (TOOLTIP-01).
**Verified:** 2026-05-08T17:46:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Source-toggle controls indicate when alt source absent (greyed + verbatim tooltip) — LOAD-05/06/07 | VERIFIED | `src/main/summary.ts:487-493` probes `<basename>.atlas` + `images/` via `fs.existsSync`. `src/shared/types.ts:708,718` declares `hasAtlasFile`/`hasImagesDir`. `src/renderer/src/components/AppShell.tsx:1757-1793` IIFE computes `altSourceMissing` and applies `disabled`, `aria-disabled`, conditional `title` with verbatim copy at lines 1771-1772. Tests: `tests/main/summary.spec.ts` (4 fs scenarios) + `tests/renderer/loader-mode-toggle-disabled.spec.tsx` (5 RTL scenarios) all pass. |
| 2 | AB panel cards default collapsed; per-card open state per-session; reload resets — PANEL-08/09/11 | VERIFIED | `src/renderer/src/panels/AnimationBreakdownPanel.tsx:351-353` flips seed to `new Set()`. Setup Pose card-id remains first in `summary.animationBreakdown` (built first in `src/main/summary.ts:170,244,358` with `SETUP_LABEL`). No `.stmproj` schema field added (grep confirms). Tests: B1-B7 in `anim-breakdown-virtualization.spec.tsx` all pass. |
| 3 | AB panel header has Expand all + Collapse all `h-8` toolbar buttons — PANEL-10 | VERIFIED | `src/renderer/src/panels/AnimationBreakdownPanel.tsx:463-482` renders both buttons inside `{summary.animations.count > 0 && (...)}`. `grep -c "border border-border rounded-md px-3 h-8 text-xs font-semibold ..."` returns 2 hits in panel + 2 in AppShell — verbatim h-8 class string copied byte-for-byte. `allCardIds` memo at line 375-378 derives from `summary.animationBreakdown` (NOT `filteredCards`), preserving B-D-04 absolute semantics. |
| 4 | Windows admin DnD — drop targets disabled + advisory; macOS+Linux unchanged — PLATFORM-01 | VERIFIED (programmatic) / requires live UAT | `src/main/elevation.ts` exists with `probeElevation()` (net session exec), `getIsElevated()`, `__setIsElevatedForTesting()`. Non-Windows short-circuits (line 40). `src/main/index.ts:582` awaits probe before `registerIpcHandlers()`. `src/main/ipc.ts:895` registers IPC handler. `src/preload/index.ts:636` exposes bridge. `src/shared/types.ts` declares Api field. `src/renderer/src/App.tsx:121-123` reads once at mount; lines 600,603,617 swap advisory body with verbatim copy + role="status" + U+2192 arrow. `src/renderer/src/components/DropZone.tsx:72,83,98,108,118,131` adds optional prop + 4 handler early-returns; line 208 preserves `min-h-screen flex items-center justify-center` byte-identical. `tests/arch.spec.ts:58` extends PLATFORM_CARVE_OUTS. All 14 new tests pass (6 elevation + 4 app-elevation + 4 dropzone-elevated). |
| 5 | ExtrapolationIcon hover surfaces icon tooltip on peakScale > 1 rows in both panels — TOOLTIP-01 | VERIFIED (programmatic) / requires live UAT | `src/renderer/src/components/icons/ExtrapolationIcon.tsx` rewritten to use `createPortal` + `getBoundingClientRect` (Phase 22.1 G-02 primitive port). `<title>` SVG child removed; React-managed `<div role="tooltip">` portaled to `document.body` on `onMouseEnter`. Both panel call sites (`GlobalMaxRenderPanel.tsx:575` + `AnimationBreakdownPanel.tsx:840`) BYTE-UNCHANGED — sibling-symmetry by construction (D-D-04). Doc-comment fully rewritten to remove invalidated "SVG `<title>` reliably wins" claim and document new mechanism. Tests: 9 cases in `extrapolation-icon-tooltip.spec.tsx` all pass. |

**Score:** 5/5 truths verified (programmatically). 4 truths require live UAT for visual/OS-dependent behavior.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/shared/types.ts` | hasAtlasFile/hasImagesDir on SkeletonSummary; isElevated on Api | VERIFIED | Lines 708, 718 declare booleans; isElevated on Api interface verified by `grep -n "isElevated:"` returning ≥1 hit. |
| `src/main/summary.ts` | fs.existsSync probes; populate new fields | VERIFIED | Lines 487-493 mirror loader F1.2 rule (`<basename>.atlas`); lines 534-535 surface in return literal. Uses pre-existing fs/path imports. |
| `src/renderer/src/components/AppShell.tsx` | disabled + title on loader menu item | VERIFIED | Lines 1757-1793 IIFE with `altSourceMissing`, verbatim copy, three redundant disabled-state signals. |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | seed flip + bulk buttons | VERIFIED | Line 352: `new Set()`. Lines 463-482: bulk buttons with verbatim h-8 class string + count cluster. Line 375: allCardIds memo. |
| `src/main/elevation.ts` (NEW) | net session probe + getIsElevated | VERIFIED | 77-line file with `process.platform !== 'win32'` short-circuit, `exec('net session', ...)` with timeout, sync getter, test-only seed. |
| `src/main/index.ts` | awaits probe before registerIpcHandlers | VERIFIED | Line 41 imports; line 582 awaits in async whenReady callback. |
| `src/main/ipc.ts` | platform:isElevated handler | VERIFIED | Line 895: `ipcMain.handle('platform:isElevated', () => getIsElevated())`. |
| `src/preload/index.ts` | isElevated bridge | VERIFIED | Line 636: `isElevated: (): Promise<boolean> => ipcRenderer.invoke('platform:isElevated')`. |
| `src/renderer/src/App.tsx` | useState/useEffect + advisory swap + thread to DropZone | VERIFIED | Lines 121-123 (state + effect), 600 (prop threaded), 603-624 (conditional swap with verbatim copy). |
| `src/renderer/src/components/DropZone.tsx` | optional isElevated prop + 4 handler guards | VERIFIED | Lines 72, 83, 98, 108, 118, 131; 4 early-returns confirmed; min-h-screen anchor at 208 byte-identical. |
| `tests/arch.spec.ts` | elevation.ts in PLATFORM_CARVE_OUTS | VERIFIED | Line 58. |
| `src/renderer/src/components/icons/ExtrapolationIcon.tsx` | doc-comment + createPortal mechanism | VERIFIED | Lines 1-49 doc-comment rewritten with Phase 31 annotation; lines 50-117 implement createPortal + getBoundingClientRect; 0 hits for "reliably wins"; 4 hits for createPortal/getBoundingClientRect. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/main/summary.ts` | `SkeletonSummary` IPC envelope | return literal populates hasAtlasFile/hasImagesDir | WIRED | Lines 534-535. |
| `AppShell.tsx` loader menu | `summary.hasAtlasFile`/`hasImagesDir` | altSourceMissing computed from raw IPC booleans | WIRED | Lines 1767-1769. |
| `useState` seed | initial collapsed state | `new Set()` (no setup-pose) | WIRED | AnimationBreakdownPanel.tsx:352. |
| Expand all onClick | setUserExpanded | `new Set(allCardIds)` absolute setter | WIRED | AnimationBreakdownPanel.tsx:468. |
| Collapse all onClick | setUserExpanded | `new Set()` absolute setter | WIRED | AnimationBreakdownPanel.tsx:476. |
| `app.whenReady` | `probeElevation()` | await before registerIpcHandlers | WIRED | src/main/index.ts:582. |
| IPC handler | `getIsElevated()` cache | sync read returns module-level boolean | WIRED | src/main/ipc.ts:895. |
| App.tsx mount | `window.api.isElevated()` | one-shot useEffect at line 122-124 | WIRED | App.tsx:121-123. |
| App.tsx idle branch | DropZone children swap | `isElevated ? advisory : prompt` | WIRED | App.tsx:602-624. |
| DropZone handlers | isElevated guard | 4× `if (isElevated) return;` | WIRED | DropZone.tsx:98,108,118,131. |
| ExtrapolationIcon | both panel call sites | shared component, panel files BYTE-UNCHANGED | WIRED (structural) | git diff src/renderer/src/panels/ shows no relevant hunks for the icon mechanism. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| AppShell loader menu | summary.hasAtlasFile, summary.hasImagesDir | buildSummary() in src/main/summary.ts (real fs.existsSync probes) | Yes — real disk probes per load/resample | FLOWING |
| Source-toggle altSourceMissing | computed from raw summary booleans | summary prop at AppShell:82 (from AppShell consumer) | Yes — IPC envelope carries probed booleans | FLOWING |
| AB panel allCardIds | summary.animationBreakdown | buildSummary's animationBreakdown construction | Yes — real per-animation cards array, including 'setup-pose' | FLOWING |
| AB panel userExpanded | useState seed | Initial empty Set; user/bulk handlers populate | Yes — empty default + real handlers wired | FLOWING |
| App.tsx isElevated | useState | window.api.isElevated() one-shot at mount | Yes — real IPC call to main process; non-Windows always false | FLOWING |
| DropZone isElevated | prop from App.tsx | threaded explicitly | Yes | FLOWING |
| ExtrapolationIcon tooltip | tooltipPos | getBoundingClientRect on host span | Yes — real rect from React ref | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All Phase 31 main tests pass | `npx vitest run tests/main/summary.spec.ts tests/main/elevation.spec.ts tests/arch.spec.ts` | 22 tests passed | PASS |
| All Phase 31 renderer tests pass | `npx vitest run tests/renderer/loader-mode-toggle-disabled.spec.tsx tests/renderer/app-elevation.spec.tsx tests/renderer/dropzone-elevated.spec.tsx tests/renderer/extrapolation-icon-tooltip.spec.tsx tests/renderer/anim-breakdown-virtualization.spec.tsx` | 36 tests passed | PASS |
| Renderer typecheck clean | `npm run typecheck:web` | exits 0 | PASS |
| Layer 3 portability invariant | `tests/arch.spec.ts` portability test | PASS | PASS |
| platform.process branches scoped to carve-outs | `grep -l "process\\.platform" src/main/*.ts` | only auto-update.ts + elevation.ts | PASS |
| Verbatim tooltip copy LOAD-07 | `grep "No .atlas file found"` + "No images/ folder found" in AppShell.tsx | 1 hit each | PASS |
| Verbatim PLATFORM-01 advisory | `grep "Drag-and-drop is unavailable while running as administrator." src/renderer/src/App.tsx` | 1 hit | PASS |
| Verbatim Spine rig peak template at both call sites | `grep "Spine rig peak:" src/renderer/src/panels/{Global,Animation}*.tsx` | 1 hit each (2 total) | PASS |
| Verbatim h-8 toolbar class string in AB panel | `grep -c "border border-border rounded-md px-3 h-8 ..." AnimationBreakdownPanel.tsx` | 2 hits (one per bulk button) | PASS |
| ExtrapolationIcon: "reliably wins" claim removed | `grep -c "reliably wins" ExtrapolationIcon.tsx` | 0 hits | PASS |
| Sibling-symmetry: both panels use shared icon, no per-site tooltip wrapper | grep panels for spans wrapping ExtrapolationIcon | no wrappers; structural symmetry | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LOAD-05 | 31-01-PLAN.md | "Use Atlas as Source" greyed when no .atlas | SATISFIED | AppShell.tsx:1779 disabled; summary.hasAtlasFile probed at summary.ts:492. |
| LOAD-06 | 31-01-PLAN.md | "Use Images Folder as Source" greyed when no images/ | SATISFIED | AppShell.tsx:1779 disabled; summary.hasImagesDir at summary.ts:493. |
| LOAD-07 | 31-01-PLAN.md | Disabled toggle exposes verbatim tooltip | SATISFIED | AppShell.tsx:1781 conditional title; verbatim copy at 1771-1772. |
| PANEL-08 | 31-02-PLAN.md | All AB cards collapsed by default | SATISFIED | AnimationBreakdownPanel.tsx:352 `new Set()`; B1 test passes. |
| PANEL-09 | 31-02-PLAN.md | In-memory state; reload resets | SATISFIED | useState (no schema field added; verified via deferred-items + types.ts grep). |
| PANEL-10 | 31-02-PLAN.md | Expand all + Collapse all bulk buttons in header (h-8) | SATISFIED | AnimationBreakdownPanel.tsx:463-482; verbatim h-8 class string from AppShell:1791. |
| PANEL-11 | 31-02-PLAN.md | Setup Pose first card | SATISFIED | summary.ts:170,244,358 build setup-pose card first; pre-Phase-31 ordering preserved (only seed-state changed). |
| PLATFORM-01 | 31-03-PLAN.md | Windows admin DnD fallback w/ advisory | SATISFIED (programmatic) — needs live UAT | elevation.ts + IPC + advisory; full chain verified. |
| TOOLTIP-01 | 31-04-PLAN.md | ExtrapolationIcon hover tooltip restored | SATISFIED (programmatic) — needs live UAT | createPortal primitive in ExtrapolationIcon.tsx; sibling-symmetry by construction. |

No orphaned requirements: the 9 IDs declared in REQUIREMENTS.md table for Phase 31 each appear in exactly one plan's `requirements:` field. Cross-reference: REQUIREMENTS.md lines 100-108 list all 9 IDs as Phase 31 / Pending; all 9 are now SATISFIED.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 567-572 | Stale doc-comment claiming "SVG `<title>` reliably wins" still references the old mechanism | INFO | The 31-04 SUMMARY explicitly notes this as a "Process adaptation" — the panel files are intentionally byte-unchanged for sibling-symmetry-by-construction. The truth-of-mechanism canonically lives in `ExtrapolationIcon.tsx`'s updated doc-comment. Acceptable scope deferral; documented in SUMMARY. |
| `tests/core/analyzer.spec.ts` | 647, 654 | Pre-existing TS2345/TS2339 errors | INFO | Pre-existing on base branch (verified via stash). Out-of-scope per executor scope boundary. Logged in deferred-items.md. Does not affect Phase 31 success criteria. |
| `tests/core/project-file-loader-mode-heal.spec.ts` | 16 | Pre-existing TS2459 error | INFO | Pre-existing on base. Logged in deferred-items.md. |
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | (full file) | Pre-existing test failure | INFO | Pre-existing on base; sampler untouched by Phase 31. Logged in deferred-items.md. |
| `tests/main/sampler-worker-girl.spec.ts` | (full file) | Pre-existing wall-time gate failure (host-dependent) | INFO | Pre-existing on base. Logged in deferred-items.md. |

No blockers. No warnings on Phase-31-introduced surfaces. All flagged items are pre-existing or intentional scope deferrals documented in deferred-items.md.

### Human Verification Required

See YAML frontmatter `human_verification` for the four items requiring live UAT:

1. Windows-admin DnD advisory live UAT (Windows-only; subagent host can't run)
2. ExtrapolationIcon hover tooltip live UAT (jsdom doesn't simulate browser hover authentically)
3. Animation Breakdown Expand/Collapse all visual UAT (visual h-8 style harmony)
4. Source-toggle disabled state visual UAT (native HTML title is browser/OS-rendered)

### Gaps Summary

No gaps blocking goal achievement. All five ROADMAP Success Criteria are programmatically VERIFIED:

1. LOAD-05/06/07 source-toggle disable+tooltip — wired end-to-end; tests green.
2. PANEL-08/09/11 default-collapsed + Setup Pose first — seed flipped; ordering preserved; tests green.
3. PANEL-10 bulk buttons in h-8 style — verbatim class string copy; tests green.
4. PLATFORM-01 Windows admin DnD fallback — full chain (probe → cache → IPC → preload → Api type → App.tsx state → DropZone prop + handler guards) wired; arch carve-out registered; tests green; programmatic verification complete pending live UAT.
5. TOOLTIP-01 regression fix — fix-shape (c) React-managed primitive ported into shared component; both panel call sites byte-unchanged (sibling-symmetry by construction); tests green; programmatic verification complete pending live UAT.

The 4 human-verification items are NOT gaps — they are quality-of-experience checks that exceed what static / jsdom verification can reach. Three are platform/browser-dependent (Windows admin, ExtrapolationIcon hover, native HTML title rendering); one is visual style harmony (h-8 button rendering).

Recommendation: PROCEED with caveat that the 4 live UAT items should be exercised before tagging the v1.3.1 release that includes Phase 31.

---

_Verified: 2026-05-08T17:46:00Z_
_Verifier: Claude (gsd-verifier)_
