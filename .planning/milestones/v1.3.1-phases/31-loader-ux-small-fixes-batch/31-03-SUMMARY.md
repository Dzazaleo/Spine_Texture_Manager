---
phase: 31-loader-ux-small-fixes-batch
plan: 03
subsystem: platform
tags: [windows, elevation, drag-and-drop, ipc, dropzone, layer3-carve-out, advisory-copy, tdd, vitest]

# Dependency graph
requires:
  - phase: 31-01
    provides: Wave 1 baseline — source-toggle disable + tooltip plan completed before Plan 31-03 lands its renderer-state changes (no shared file collisions; depends_on declared in plan frontmatter).
provides:
  - Windows admin DnD fallback (PLATFORM-01) — silent-broken-DnD failure mode replaced with verbatim two-sentence advisory routing user to File → Open or unprivileged relaunch.
  - New Layer 3 carve-out file `src/main/elevation.ts` (probeElevation / getIsElevated / __setIsElevatedForTesting) — module-level cache + one-shot net-session probe; non-Windows short-circuits.
  - New IPC channel `'platform:isElevated'` end-to-end (main handler → preload bridge → Api type → renderer mount-time read).
  - DropZone optional `isElevated` prop suppressing all 4 drag handlers + drag-over ring when true; container className verbatim preserved.
  - Architectural test extension: `tests/arch.spec.ts` PLATFORM_CARVE_OUTS Set extended with `'src/main/elevation.ts'` so the D-23 portability gate stays green.
affects:
  - Phase 31-04 (final wave) — must not duplicate the platform branch surface (no second carve-out file unless absolutely necessary).
  - Future v1.4+ work that adds new platform branching — must follow the same single-file carve-out + cached-boolean IPC pattern.

# Tech tracking
tech-stack:
  added: [child_process.exec at app boot for elevation probe]
  patterns:
    - "Single-file Layer 3 carve-out for platform branching (template: auto-update.ts → elevation.ts)"
    - "Module-level cache populated at app.whenReady, read synchronously by IPC handler"
    - "One-shot mount-time renderer read via window.api.* bridge (no listener identity scaffolding)"
    - "Renderer never sees process.platform — cached boolean traverses the trust boundary instead"
    - "Verbatim Tailwind v4 class strings (Pitfall 8 discipline) — advisory body composed directly in App.tsx"

key-files:
  created:
    - "src/main/elevation.ts — Windows elevation probe (Layer 3 carve-out file)"
    - "tests/main/elevation.spec.ts — 6 vitest cases covering probe behavior C2..C5 + sync-throw defense"
    - "tests/renderer/app-elevation.spec.tsx — 4 vitest cases covering D1..D4 (render-tree contract)"
    - "tests/renderer/dropzone-elevated.spec.tsx — 4 vitest cases covering E1..E4 (handler suppression + anchor preservation)"
  modified:
    - "src/main/index.ts — async whenReady + await probeElevation() before registerIpcHandlers"
    - "src/main/ipc.ts — register 'platform:isElevated' invoke handler"
    - "src/preload/index.ts — isElevated bridge alongside pathToImageUrl"
    - "src/shared/types.ts — isElevated field on Api with full JSDoc"
    - "src/renderer/src/App.tsx — useState/useEffect calling window.api.isElevated() once at mount; idle-branch advisory swap; isElevated prop threaded to DropZone"
    - "src/renderer/src/components/DropZone.tsx — optional isElevated prop; 4 handler early-returns; render block byte-identical"
    - "tests/arch.spec.ts — PLATFORM_CARVE_OUTS Set extended with 'src/main/elevation.ts'"
    - "tests/renderer/app-update-subscriptions.spec.tsx, tests/renderer/app-quit-subscription.spec.tsx, tests/renderer/save-load.spec.tsx — added isElevated stub to existing window.api stubs"

key-decisions:
  - "Locked C-D-01 / C-D-05 verbatim: net session exec, exit-code-0 → elevated, any error → safe default false; non-Windows short-circuits without exec'ing."
  - "Locked the advisory copy verbatim from CONTEXT.md C-D-03: single <p>, both sentences, U+2192 right-arrow (NOT ASCII '->'), informational tone (text-fg-muted, NOT danger)."
  - "DropZone container className left byte-identical (Pitfall 8 + min-h-screen anchor invariant); suppression lives entirely in handler bodies."
  - "await probeElevation() before registerIpcHandlers() (not after) so the cached value is ready by the time the IPC channel is bound — eliminates a race where a fast renderer mount could call isElevated() before the probe resolves."

patterns-established:
  - "Pattern: every renderer spec that mounts <App /> needs the new isElevated stub in its window.api fake. Three existing specs were updated; future App-mounting specs must include `isElevated: vi.fn().mockResolvedValue(false)`."
  - "Pattern: optional component props default to safe behavior. DropZone's `isElevated?: boolean` defaults to false so existing callers keep their pre-Phase-31 byte-identical behavior — only the App.tsx call site explicitly threads the new state."

requirements-completed: [PLATFORM-01]

# Metrics
duration: ~11 min
completed: 2026-05-08
---

# Phase 31 Plan 03: Windows admin Drag-and-Drop fallback (PLATFORM-01) Summary

**Eliminates the silent-broken-DnD failure mode on Windows-when-elevated via a one-shot `net session` probe at app boot, a cached-boolean IPC channel, and a verbatim two-sentence advisory body that replaces the DropZone empty-state when elevated.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-08T17:20:53Z (first RED test commit)
- **Completed:** 2026-05-08T17:31:25Z (Task 3 GREEN commit)
- **Tasks:** 3 (all type=auto, all tdd=true)
- **Files modified:** 11 (4 created + 7 modified)
- **Tests added:** 14 (6 elevation probe + 4 App-tree + 4 DropZone)

## Accomplishments
- Windows admin elevation probed once at app boot via `child_process.exec('net session')`; result cached in module-level boolean exposed to renderer via the new `'platform:isElevated'` IPC channel.
- Verbatim two-sentence advisory replaces the DropZone idle-state empty-message when elevated — single `<p>`, `role="status"`, `text-fg-muted` (informational tone, not danger), U+2192 right-arrow preserved.
- DropZone `isElevated` prop suppresses all 4 drag handlers (dragOver / dragEnter / dragLeave / drop) — defense-in-depth: even if a synthesized drag event surfaces, no `setIsDragOver(true)` fires and the IPC is never invoked.
- Layer 3 portability invariant preserved: `tests/arch.spec.ts` PLATFORM_CARVE_OUTS Set extended with `'src/main/elevation.ts'`; the new file is the only post-Phase-31 surface that branches on `process.platform`.
- AppShell `min-h-screen` layout anchor (memory `project_layout_fragility_root_min_h_screen.md`) preserved byte-identical — the suppression is entirely inside handler bodies, not the render block.

## Task Commits

Each task was committed atomically with TDD discipline (RED → GREEN):

1. **Task 1 RED: failing elevation probe tests** — `24a4ab3` (test)
2. **Task 1 GREEN: elevation.ts + arch carve-out + boot-time probe** — `fe00643` (feat)
3. **Task 2 RED: failing App.tsx elevation plumbing tests** — `f471bde` (test)
4. **Task 2 GREEN: IPC + preload + Api type + App.tsx advisory swap** — `b0a36ad` (feat)
5. **Task 3 RED: failing DropZone elevated-suppression tests** — `7a3a304` (test)
6. **Task 3 GREEN: DropZone handler short-circuits + App.tsx prop threading** — `b4e39ae` (feat)

## Files Created/Modified

### Created
- `src/main/elevation.ts` — Windows elevation probe (Layer 3 carve-out file): `probeElevation()` (one-shot exec, idempotent), `getIsElevated()` (sync cache read), `__setIsElevatedForTesting()` (test-only seed). Non-Windows short-circuits without exec'ing per C-D-05.
- `tests/main/elevation.spec.ts` — 6 vitest cases: C5 (default false pre-probe), C2 (darwin short-circuit), C2b (linux short-circuit), C3 (win32 + null err → true), C4 (win32 + Error → false), C4b (sync exec throw → false).
- `tests/renderer/app-elevation.spec.tsx` — 4 vitest cases: D1 (non-elevated default body), D2 (elevated advisory), D3 (role="status" ARIA), D4 (single mount-time call).
- `tests/renderer/dropzone-elevated.spec.tsx` — 4 vitest cases: E1 (no ring on dragOver when elevated), E2 (no IPC fire on drop when elevated), E3 (non-elevated regression preserved), E4 (min-h-screen anchor preserved across both states).

### Modified
- `src/main/index.ts` — added `import { probeElevation } from './elevation.js';` + converted `app.whenReady().then(() => …)` to `async () => …` + inserted `await probeElevation()` immediately after the `protocol.handle('app-image', …)` block and before `registerIpcHandlers()`.
- `src/main/ipc.ts` — registered `ipcMain.handle('platform:isElevated', () => getIsElevated())` near `'atlas:resolve-image-url'` (closest cached-read sibling shape).
- `src/preload/index.ts` — added `isElevated: () => ipcRenderer.invoke('platform:isElevated')` bridge near `pathToImageUrl`.
- `src/shared/types.ts` — added `isElevated: () => Promise<boolean>;` to the `Api` interface with full JSDoc.
- `src/renderer/src/App.tsx` — added `useState<boolean>(false)` + one-shot `useEffect` calling `window.api.isElevated()`; replaced idle-branch body with conditional swap (advisory when true, existing prompt when false); threaded `isElevated={isElevated}` to `<DropZone>`.
- `src/renderer/src/components/DropZone.tsx` — added optional `isElevated?: boolean` prop (default `false`); each of the 4 handlers now early-returns after `preventDefault` when `isElevated` is true; render block left byte-identical.
- `tests/arch.spec.ts` — `PLATFORM_CARVE_OUTS` Set extended with `'src/main/elevation.ts'` plus an inline JSDoc comment explaining the carve-out.
- `tests/renderer/app-update-subscriptions.spec.tsx`, `tests/renderer/app-quit-subscription.spec.tsx`, `tests/renderer/save-load.spec.tsx` — added `isElevated: vi.fn().mockResolvedValue(false)` to each `window.api` stub so the new mount-time IPC call doesn't crash the existing tests.

## Decisions Made
- Locked the boot-sequence ordering: probe runs **after** `protocol.handle('app-image', …)` and **before** `registerIpcHandlers()`. This matters because the probe takes ~50–100 ms (5 s timeout cap) and a renderer mount that lands during that window otherwise sees an unbound IPC channel; awaiting before registration eliminates the race entirely.
- Suppressed handlers via early-return after `preventDefault` (not by omitting handler attributes). Reason: consistent with React's preventDefault contract for event delegation; also keeps the handler graph stable (no remount churn) when the user toggles elevation simulated in tests.
- Default `isElevated = false` on the prop signature so the prop stays backwards-compatible with any future call site that omits it; only `App.tsx` explicitly threads the value today.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment in src/main/ipc.ts triggered the arch.spec portability grep**
- **Found during:** Task 2 (post-implementation full-suite run)
- **Issue:** My initial PLATFORM-01 import comment in `src/main/ipc.ts` mentioned `process.platform === 'win32'` as a reference to where the branch lives. The `tests/arch.spec.ts` portability grep at lines 36–67 uses `forbidden = /process\.platform|os\.platform\(\)|.../` and matched the comment text — flagging `src/main/ipc.ts` as a portability violation even though there was no real branching, just a comment.
- **Fix:** Reworded the comment to describe the elevation.ts file in plain English ("the win32 platform branch") without using the `process.platform` token. The grep now stays green and the carve-out remains scoped to elevation.ts only.
- **Files modified:** `src/main/ipc.ts` (comment text only).
- **Verification:** `npx vitest run tests/arch.spec.ts` passes; `grep -rn 'process.platform' src/main/` returns only auto-update.ts and elevation.ts as expected.
- **Committed in:** `b0a36ad` (Task 2 GREEN commit).

**2. [Rule 3 - Blocking] Pre-existing renderer specs crashed on mount because their window.api stubs lacked the new isElevated method**
- **Found during:** Task 2 (post-implementation full-suite run)
- **Issue:** App.tsx now invokes `window.api.isElevated()` inside a useEffect at mount. Three existing renderer specs (`app-update-subscriptions.spec.tsx`, `app-quit-subscription.spec.tsx`, `save-load.spec.tsx`) build a complete `window.api` stub object via `Object.defineProperty` / `vi.stubGlobal` but the stubs predate Plan 31-03 and therefore lack the new `isElevated` method. The mount-time call threw `TypeError: window.api.isElevated is not a function` inside the useEffect commit, cascading to 17 spec failures across the three files.
- **Fix:** Added `isElevated: vi.fn().mockResolvedValue(false)` to each of the three stub blocks. Default false because the suites only need to confirm pre-Phase-31 behavior continues to work — they're not testing the elevated branch.
- **Files modified:** `tests/renderer/app-update-subscriptions.spec.tsx`, `tests/renderer/app-quit-subscription.spec.tsx`, `tests/renderer/save-load.spec.tsx`.
- **Verification:** All three specs back to fully green after the stub addition; full suite shows only 2 pre-existing failures (sampler regressions), both confirmed unrelated by `git stash && vitest run` against the unmodified base.
- **Committed in:** `b0a36ad` (Task 2 GREEN commit; the test-stub edits are a pure test-plumbing fix paired with the renderer change that necessitated them).

---

**Total deviations:** 2 auto-fixed (1 bug — pre-existing arch grep collision; 1 blocking — test stub plumbing). No scope creep; both fixes are direct consequences of the renderer change.

## Issues Encountered

### Pre-existing failures (out of scope; logged in deferred-items.md)
- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — failing on the unmodified base. Unrelated to Plan 31-03 (Sub-feature C touches main IPC + a new file + renderer; sampler core is untouched).
- `tests/main/sampler-worker-girl.spec.ts` — wall-time gate is host-environment-dependent and was already failing on the unmodified base.
- `tests/core/analyzer.spec.ts` (lines 647, 654) — pre-existing `tsc` errors against an updated analyzer interface (TS2345/TS2339).
- `tests/core/project-file-loader-mode-heal.spec.ts` (line 16) — pre-existing TS2459: imports `ProjectFileV1` which is declared but not exported.

All four are logged at `.planning/phases/31-loader-ux-small-fixes-batch/deferred-items.md` for the verifier / orchestrator. None affect Plan 31-03's success criteria.

## Verification Evidence

### Acceptance criteria greps (all pass)
- `grep -n "net session" src/main/elevation.ts` → 3 hits (declaration + comment + call)
- `grep -n "process.platform !== 'win32'" src/main/elevation.ts` → 1 hit (non-Windows short-circuit per C-D-05)
- `grep -n "src/main/elevation.ts" tests/arch.spec.ts` → 1 hit (carve-out registered)
- `grep -n "probeElevation" src/main/index.ts` → 2 hits (import + await call); the `await probeElevation()` sits BEFORE `registerIpcHandlers()` in the file
- `grep -n "isElevatedCache" src/main/elevation.ts` → 6 hits (declaration + 4 read/write sites + test-only setter)
- `grep -rn "process.platform" src/main/` excluding auto-update.ts and elevation.ts → 0 hits (no leakage outside carve-outs)
- `grep -n "platform:isElevated" src/main/ipc.ts` → 1 hit (handler)
- `grep -n "platform:isElevated" src/preload/index.ts` → 1 hit (bridge)
- `grep -n "isElevated:" src/shared/types.ts` → 1 hit (Api interface field)
- `grep -cn "isElevated\b" src/renderer/src/App.tsx` → 3 hits (state declaration, useEffect, render branch / DropZone prop)
- `grep -n "Drag-and-drop is unavailable while running as administrator." src/renderer/src/App.tsx` → 1 hit (verbatim)
- `grep -n "Use File → Open instead, or relaunch the app without administrator privileges." src/renderer/src/App.tsx` → 1 hit (verbatim — Unicode arrow U+2192)
- `grep -n 'role="status"' src/renderer/src/App.tsx` → 2 (1 in comment + 1 in JSX advisory wrapper)
- `grep -cn "isElevated" src/renderer/src/components/DropZone.tsx` → 10 hits (interface field + JSDoc + destructure + 4 handler guards + dep array + comment refs)
- `grep -n "if (isElevated) return" src/renderer/src/components/DropZone.tsx` → 4 hits (one per handler, exact)
- `grep -n "min-h-screen flex items-center justify-center" src/renderer/src/components/DropZone.tsx` → 1 hit (anchor preserved verbatim)
- `grep -n "isElevated={isElevated}" src/renderer/src/App.tsx` → 1 hit (prop threaded)

### Test runs
- `npx vitest run tests/main/elevation.spec.ts tests/arch.spec.ts tests/renderer/app-elevation.spec.tsx tests/renderer/dropzone-elevated.spec.tsx` → 26 / 26 pass.
- Full suite: 936 / 938 effective passes (2 pre-existing failures documented above).
- `npm run typecheck:web` → clean. `npm run typecheck:node` → only the 2 pre-existing tsc errors (analyzer + project-file-loader-mode-heal); no new type errors introduced by Plan 31-03.

## Self-Check: PASSED

**Files created — verified to exist:**
- FOUND: `src/main/elevation.ts`
- FOUND: `tests/main/elevation.spec.ts`
- FOUND: `tests/renderer/app-elevation.spec.tsx`
- FOUND: `tests/renderer/dropzone-elevated.spec.tsx`
- FOUND: `.planning/phases/31-loader-ux-small-fixes-batch/deferred-items.md`

**Commits — verified to exist on the branch:**
- FOUND: `24a4ab3` (Task 1 RED), `fe00643` (Task 1 GREEN)
- FOUND: `f471bde` (Task 2 RED), `b0a36ad` (Task 2 GREEN)
- FOUND: `7a3a304` (Task 3 RED), `b4e39ae` (Task 3 GREEN)

---

*Phase: 31-loader-ux-small-fixes-batch*
*Plan: 03 — Windows admin Drag-and-Drop fallback (Sub-feature C, PLATFORM-01)*
*Completed: 2026-05-08*
