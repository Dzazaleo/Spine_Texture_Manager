---
phase: 41-spine-animation-viewer
plan: 01
subsystem: ipc
tags: [electron, ipc, dependency-pin, spine-player, spine-core, structuredClone]

# Dependency graph
requires:
  - phase: 12-app-image-protocol
    provides: app-image:// custom scheme + pathToImageUrl bridge (used by renderer to convert absolute PNG paths returned from the new IPC into spine-player-friendly URLs)
  - phase: 21-atlas-less
    provides: synthesizeAtlasText core function (re-invoked main-side by the new IPC handler for atlas-less projects)
provides:
  - @esotericsoftware/spine-player@4.2.111 (exact pin) installed as a renderer dep — Wave 2 can now import { SpinePlayer } from '@esotericsoftware/spine-player'
  - @esotericsoftware/spine-core tightened to exact pin 4.2.111 — single dedup'd copy in the renderer bundle (Pitfall 1 mitigated)
  - ViewerAssetFeedResponse discriminated-union envelope in src/shared/types.ts (structuredClone-safe)
  - Api.getViewerAssetFeed method declaration on the renderer-side contextBridge surface
  - getViewerAssetFeed preload bridge in src/preload/index.ts (one-shot ipcRenderer.invoke proxy)
  - viewer:get-asset-feed main IPC handler in src/main/ipc.ts (T-41-01 trust-boundary mitigated; never throws across the IPC boundary)
affects: [phase-41-wave-2-animation-player-modal, phase-41-plan-02, phase-41-plan-03]

# Tech tracking
tech-stack:
  added:
    - "@esotericsoftware/spine-player@4.2.111 (exact pin; sibling of existing spine-core)"
  patterns:
    - "Sibling-IPC analog placement — new handler registered IMMEDIATELY after the closest existing analog (atlas:resolve-image-url) so related channels stay grouped in ipc.ts"
    - "Map → Record conversion at the IPC boundary — Map<regionName, absPath> is converted to Record<string, string> before envelope return so the renderer's structuredClone-receive surface stays safe"
    - "base64 data: URI atlas-text transport — synthesized atlas text crosses IPC as 'data:text/plain;base64,...' for direct spine-player rawDataURIs consumption (no intermediate filesystem materialization)"

key-files:
  created:
    - "tests/main/viewer-asset-feed-ipc.spec.ts (4 tests covering trust-boundary, atlas-less success, error-caught branches)"
    - ".planning/phases/41-spine-animation-viewer/deferred-items.md (worktree-fixture pre-existing failures — DEF-41-01-01)"
  modified:
    - "package.json (spine-player + spine-core exact pins at 4.2.111)"
    - "package-lock.json (regenerated lockfile)"
    - "src/shared/types.ts (+ ViewerAssetFeedResponse type + Api.getViewerAssetFeed method signature)"
    - "src/preload/index.ts (+ getViewerAssetFeed bridge + ViewerAssetFeedResponse type-import)"
    - "src/main/ipc.ts (+ readFile import + synthesizeAtlasText import + ViewerAssetFeedResponse type-import + viewer:get-asset-feed handler)"

key-decisions:
  - "D-01 + D-01a implemented as Option A: @esotericsoftware/spine-player installed as a `dependencies` entry (renderer-side, matches spine-core precedent). No vendoring."
  - "Exact pin 4.2.111 for BOTH spine-player AND spine-core (RESEARCH Pitfall 1 — prevents transitive-dep duplication of spine-core in the renderer bundle)."
  - "Atlas-less synth crosses IPC as base64 data: URI for atlas text + Record<regionName, absPath> for PNG paths. Renderer converts each absPath into an app-image:// URL via the existing pathToImageUrl bridge."

patterns-established:
  - "Pattern: IPC envelope discriminated union — { ok: true, ...payload } | { ok: false, error: { kind, message } } shape mirrors the existing SerializableError/LoadResponse precedent."
  - "Pattern: Trust-boundary guard before any fs read — typeof + extension check returns ok:false envelope before readFile is invoked, mirroring handleSkeletonLoad and atlas:resolve-image-url."
  - "Pattern: try/catch wrapping at the IPC seam — all main-side handler logic wrapped in try/catch with the catch converting the thrown Error into an ok:false envelope. No throws cross the Electron IPC boundary."

requirements-completed:
  - VIEWER-01
  - VIEWER-03

# Metrics
duration: 8min
completed: 2026-05-15
---

# Phase 41 Plan 01: Foundation Summary

**Renderer-dep pinning of `@esotericsoftware/spine-player@4.2.111` (with sibling exact-pin tightening of `@esotericsoftware/spine-core`) + new `viewer:get-asset-feed` IPC channel that synthesizes the atlas-less atlas text on demand main-side and ships it as a base64 `data:` URI alongside a region→absPath Record for spine-player's `rawDataURIs`.**

## Performance

- **Duration:** 8 min (7m 49s)
- **Started:** 2026-05-15T15:32:48Z
- **Completed:** 2026-05-15T15:40:37Z
- **Tasks:** 4
- **Files modified:** 5 (`package.json`, `package-lock.json`, `src/shared/types.ts`, `src/preload/index.ts`, `src/main/ipc.ts`)
- **Files created:** 2 (`tests/main/viewer-asset-feed-ipc.spec.ts`, `.planning/phases/41-spine-animation-viewer/deferred-items.md`)

## Accomplishments

- spine-player@4.2.111 + spine-core@4.2.111 both exact-pinned and dedup-verified (`npm ls @esotericsoftware/spine-core` shows a single resolved version — spine-webgl's transitive resolves to the same direct-dep version, no bundle duplication).
- New `ViewerAssetFeedResponse` shared envelope is structuredClone-safe (no Maps, no functions, only primitives + plain object + Record).
- Atlas-less branch is materialisable from the renderer side without breaking the `core/` purity invariant: `synthesizeAtlasText` runs main-side on demand, atlas text crosses IPC as a base64 `data:text/plain;base64,...` URI, per-region PNG absolute paths cross as a `Record<string, string>` (renderer wraps each into `app-image://` via the existing `pathToImageUrl` bridge).
- T-41-01 trust boundary mitigated by `typeof` + case-insensitive `.json` extension guards BEFORE any `readFile` is attempted; thrown errors (`JSON.parse` syntax, missing file, `MissingImagesDirError` inside the synth walk) are caught and wrapped in the `ok:false` envelope — no exceptions ever propagate across the IPC seam.

## Task Commits

Each task committed atomically:

1. **Task 1: Install spine-player + tighten spine-core to exact pin 4.2.111** — `04a3a83` (feat)
2. **Task 2: Add `ViewerAssetFeedResponse` type + `Api.getViewerAssetFeed` signature** — `fc7253d` (feat)
3. **Task 3: Add `getViewerAssetFeed` preload bridge** — `b18131c` (feat)
4. **Task 4 (RED): Failing IPC handler spec** — `8a37e86` (test)
5. **Task 4 (GREEN): Register `viewer:get-asset-feed` handler** — `b4a5085` (feat)
6. **Deferred-items log** — `a3c0ef2` (chore)

_TDD gate compliance: Task 2/3 are shared-type / preload-bridge surfaces (no runtime behavior — type contract verified by `tsc --noEmit`). Task 4 follows the canonical RED → GREEN gate: a `test(...)` commit at `8a37e86` (4/4 failing) precedes a `feat(...)` commit at `b4a5085` (4/4 passing). No refactor commit was needed._

## Files Created/Modified

- `package.json` — `@esotericsoftware/spine-player` added at exact pin `4.2.111`; `@esotericsoftware/spine-core` tightened from `^4.2.0` to exact pin `4.2.111`.
- `package-lock.json` — regenerated for the tightened pin pair. Spine deps dedupe correctly: one `spine-core@4.2.111`, one `spine-webgl@4.2.111`, one `spine-player@4.2.111`.
- `src/shared/types.ts` — new `ViewerAssetFeedResponse` discriminated-union type after the `SerializableError` group (~line 941); new `Api.getViewerAssetFeed` method signature immediately after `pathToImageUrl` (~line 1756).
- `src/preload/index.ts` — new `getViewerAssetFeed` bridge immediately after `pathToImageUrl` (line 672); `ViewerAssetFeedResponse` folded into the existing type-only import from `../shared/types.js` (no new bare import line — preload sandbox discipline preserved).
- `src/main/ipc.ts` — `readFile` added to the existing `node:fs/promises` destructured import (line 47); new value-import of `synthesizeAtlasText` from `../core/synthetic-atlas.js` (line 54) alongside the existing `core/loader.js` and `core/sampler.js` imports; `ViewerAssetFeedResponse` added to the existing type-only import from `../shared/types.js`; new `viewer:get-asset-feed` handler registered at line 1272 IMMEDIATELY AFTER `atlas:resolve-image-url`.
- `tests/main/viewer-asset-feed-ipc.spec.ts` (NEW) — 4 specs covering (a) non-string rejection, (b) non-.json rejection, (c) atlas-less happy path with mocked synth + readFile, (d) thrown-error catch.

## Decisions Made

None — every planner-locked decision (D-01/D-01a `dependencies` placement, D-04a IPC envelope shape, T-41-01 mitigation scaffold) was implemented verbatim. The plan's pattern-extraction in 41-PATTERNS.md was followed byte-for-byte for the handler body, preload bridge, and shared-type envelope.

## Deviations from Plan

None — plan executed exactly as written.

The plan's automated verify-string `grep -c "ipcMain.handle(\s*'viewer:get-asset-feed'" src/main/ipc.ts | grep -q '^1$'` reports 0 instead of 1 because the canonical formatter required wrapping the long `async (_evt, skeletonPath: unknown): Promise<ViewerAssetFeedResponse> => {` signature onto its own line, putting `'viewer:get-asset-feed',` on the line below `ipcMain.handle(`. The handler IS registered exactly once with that channel name (verified via `grep -n "viewer:get-asset-feed" src/main/ipc.ts` → unique hit at line 1272). This is a verify-pattern phrasing mismatch, not a behavioural deviation; all four `it(...)` blocks in `tests/main/viewer-asset-feed-ipc.spec.ts` pass.

## Issues Encountered

**Pre-existing test failures in worktree (out of scope for this plan)**

Running the full vitest suite at the end of execution surfaced two failing tests:

| Test | Failure |
|------|---------|
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `SkeletonJsonNotFoundError` on `fixtures/SAMPLER_ALPHA_ZERO/...` — fixture not in worktree base. |
| `tests/main/sampler-worker-girl.spec.ts` | warm-up returns `'error'` against `fixtures/Girl/...` — fixture not in worktree base. |

Both fixtures exist in the main repo working tree but are NOT in the worktree base commit `63e4a87`. Failures reproduce against the base commit before any plan changes — they are NOT regressions introduced by Plan 41-01 (which only touches `package.json`, `package-lock.json`, `src/shared/types.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, and a new file under `tests/main/`).

Per the executor deviation-rules scope-boundary clause, these are explicitly out of scope. Logged in `.planning/phases/41-spine-animation-viewer/deferred-items.md` (DEF-41-01-01) for orchestrator visibility on merge-back.

**Plan 01's own scoped suite remains 4/4 green:**
```
npm test -- tests/main/viewer-asset-feed-ipc.spec.ts → Test Files 1 passed, Tests 4 passed
```

## User Setup Required

None — no external service configuration required. The new spine-player package is a regular npm install picked up automatically by `npm install` against the updated `package.json` + `package-lock.json`.

## Next Phase Readiness

- **Plan 02 (`AnimationPlayerModal.tsx`)** unblocked: can now `import { SpinePlayer } from '@esotericsoftware/spine-player'` and consume `window.api.getViewerAssetFeed(skeletonPath)` for the atlas-less branch of its `buildAssetFeed`.
- **Plan 03 (AppShell wiring + project-change cleanup useEffect)** unblocked: depends only on Plan 02's modal component existence; Plan 02's pre-reqs are now all in place.
- Wave 2 can start in parallel for plans 02 and 03 (they're cross-cutting on AppShell but don't share IPC surface).

## TDD Gate Compliance

Task 4 followed the canonical RED → GREEN gate:

- **RED commit `8a37e86`:** 4 failing tests against an unregistered handler (`expected undefined to be defined` on `ipcMainHandleHandlers.get('viewer:get-asset-feed')`).
- **GREEN commit `b4a5085`:** 4 passing tests against the registered handler (verify-block `npm test -- tests/main/viewer-asset-feed-ipc.spec.ts` → 4/4 green).
- No REFACTOR commit was needed — the implementation matched the verbatim PATTERNS.md template and required no clean-up.

Tasks 2 and 3 carry `tdd="true"` in the plan frontmatter but are shared-type / preload-forwarder surfaces (no runtime behavior of their own). Their "test" is the type contract, verified by `npx tsc --noEmit` (0 errors after each commit) — equivalent gate for type-level changes.

---

## Self-Check: PASSED

- [x] `package.json` contains `"@esotericsoftware/spine-player": "4.2.111"` (verified via grep)
- [x] `package.json` contains `"@esotericsoftware/spine-core": "4.2.111"` (verified via grep)
- [x] `src/shared/types.ts` exports `ViewerAssetFeedResponse` (1 declaration)
- [x] `src/shared/types.ts` declares `Api.getViewerAssetFeed` (1 signature)
- [x] `src/preload/index.ts` exposes `getViewerAssetFeed` bridge (1 occurrence, line 672)
- [x] `src/main/ipc.ts` registers `viewer:get-asset-feed` handler (1 occurrence, line 1272)
- [x] `tests/main/viewer-asset-feed-ipc.spec.ts` exists with 4 `it(...)` blocks
- [x] `npm test -- tests/main/viewer-asset-feed-ipc.spec.ts` → 4/4 passing
- [x] `npx tsc --noEmit` → 0 errors
- [x] All commits exist in `git log --oneline` of the worktree branch: `04a3a83 fc7253d b18131c 8a37e86 b4a5085 a3c0ef2`

---

*Phase: 41-spine-animation-viewer*
*Completed: 2026-05-15*
