---
phase: 06-optimize-assets-image-export
plan: 05
subsystem: main-ipc-and-preload-bridge
tags: [ipc, preload, contextBridge, export, electron-dialog, electron-shell, security-trust-boundary]
dependency_graph:
  requires:
    - 06-02 (Api interface + ExportPlan/ExportResponse/ExportProgressEvent types in shared/types.ts)
    - 06-03 (buildExportPlan available in src/core/export.ts — unchanged here, used by Plan 06-06)
    - 06-04 (runExport available in src/main/image-worker.ts — wired into handleStartExport here)
  provides:
    - 4 new IPC channels (dialog:pick-output-dir, export:start, export:cancel, shell:open-folder)
    - 1 one-way emit channel (export:progress) — fired from inside runExport's onProgress callback
    - 5 contextBridge api methods (pickOutputDirectory, startExport, cancelExport, onExportProgress, openOutputFolder)
    - 2 extracted async handler functions for unit testing without Electron (handleStartExport, handlePickOutputDirectory)
    - Module-level re-entrancy guard + cancel flag isolated to ipc.ts
  affects:
    - 06-06 (AppShell click handler will invoke window.api.pickOutputDirectory + window.api.startExport)
    - 06-07 (close-out: full export flow human-verify against the bridges this plan ships)
tech-stack:
  added:
    - electron.dialog.showOpenDialog (folder picker with cross-platform properties array)
    - electron.shell.showItemInFolder (open Finder/Explorer at outDir)
    - electron.BrowserWindow.getFocusedWindow (modal-to-focused-window picker)
    - ipcRenderer.on + ipcRenderer.removeListener (subscription pattern with listener-identity preservation)
    - ipcRenderer.send (one-way fire-and-forget for cancel + open-folder)
  patterns:
    - extracted-handler discipline (Phase 1 D-10 inheritance — handlers are standalone async fns testable without spinning up Electron)
    - typed-error envelope (ExportResponse mirrors LoadResponse — { ok: true, summary } | { ok: false, error: { kind, message } })
    - module-level re-entrancy flag claimed BEFORE any await (D-115 — second call sees flag synchronously and bails)
    - Pitfall 9 listener-identity preservation (wrapped const captured BEFORE .on so removeListener targets same reference)
    - sandbox-discipline preserved (preload imports only 'electron' + type-only from shared/types.js — no new runtime npm dep)
key-files:
  created: []
  modified:
    - src/main/ipc.ts (extended with 4 channels + 2 handlers + module flags + 2 helper functions)
    - src/preload/index.ts (5 NOT_YET_WIRED stubs replaced with real contextBridge bridges)
decisions:
  - "Re-entrancy slot claimed BEFORE empty-plan early-return — uniform enforcement regardless of plan size; second call in same microtask queue sees flag and bails (test discovery — initial impl returned synchronously for empty plan, slot never claimed, re-entrancy test failed; restructured to always claim slot after input validation passes)"
  - "Plan + outDir validation BEFORE claiming exportInFlight (validation rejections do not poison the flag for follow-up calls — covered by the 'clears exportInFlight after error' test)"
  - "Source-images-dir derivation uses FIRST '/images/' segment, not lastIndexOf — handles nested region names like 'AVATAR/FACE' correctly so child-of-source-images check defends against e.g. outDir=/skel/images/sub even when row[0].sourcePath = /skel/images/AVATAR/FACE.png"
  - "Empty-plan path goes through runExport (not synchronously short-circuited) so the re-entrancy flag is uniformly claimed; runExport's loop runs zero times and returns an empty summary — no extra cost"
  - "evt.sender.send wrapped in try/catch — if the renderer window is closed mid-export, the export still completes and the summary returns to whoever (if anyone) is left listening"
  - "shell.showItemInFolder also wrapped in try/catch — defense-in-depth (T-06-14 disposition: accept; the upstream renderer outDir already passed handleStartExport validation, but a typo-resistant guard adds zero cost)"
metrics:
  duration: ~25 minutes
  completed: 2026-04-25
  tasks: 2
  commits: 2
  files_modified: 2
  tests_RED_to_GREEN: 9
---

# Phase 6 Plan 05: Wire Export IPC + Preload Bridge Summary

Wired the IPC + preload glue connecting Plan 06-04's `runExport` to the renderer: extended `src/main/ipc.ts` with 4 new channels (`dialog:pick-output-dir`, `export:start`, `export:cancel`, `shell:open-folder`) plus the existing `export:progress` one-way emit fired from inside `runExport`'s onProgress callback; replaced the 5 NOT_YET_WIRED stubs in `src/preload/index.ts` with real contextBridge bridges. Drove all 9 RED tests in `tests/main/ipc-export.spec.ts` to GREEN.

## What Was Built

### Task 1 — `src/main/ipc.ts` extension (commit `cad017f`)

Added without touching `handleSkeletonLoad`:

- **Module-level state:**
  - `let exportInFlight = false` — D-115 re-entrancy guard.
  - `let exportCancelFlag = false` — D-116 cooperative cancel flag, reset on every successful entry to `handleStartExport`.

- **Helper functions (file-internal):**
  - `isOutDirInsideSourceImages(outDir, sourceImagesDir): boolean` — D-122 / F8.4 cross-platform path-prefix check via `path.relative` + `path.resolve`. Returns `true` for equal or child-of, `false` for sibling/elsewhere.
  - `validateExportPlan(plan: unknown): string | null` — T-01-02-01 cheap shape validation at the trust boundary. Checks `rows`/`excludedUnused`/`totals` shape + every row's 8 required fields + primitive types.

- **Exported handlers (testable without Electron):**
  - `handlePickOutputDirectory(defaultPath?): Promise<string | null>` — F8.1 + D-118. Uses `BrowserWindow.getFocusedWindow()` for modal-to-window picker; properties array includes `'openDirectory' + 'createDirectory' + 'promptToCreate' + 'dontAddToRecent'` for cross-platform behavior. Returns first `filePaths` entry or `null` on cancel.
  - `handleStartExport(evt, plan, outDir): Promise<ExportResponse>` — D-115 + D-122 + F8.4. Validation order:
    1. Re-entrancy guard first → `{ ok: false, error: { kind: 'already-running' } }`.
    2. `outDir` typeof + length check → `{ ok: false, error: { kind: 'Unknown' } }`.
    3. `validateExportPlan(plan)` → `{ ok: false, error: { kind: 'Unknown', message: 'Invalid plan: ...' } }`.
    4. `isOutDirInsideSourceImages` (only if `rows.length > 0`) → `{ ok: false, error: { kind: 'invalid-out-dir' } }`.
    5. Claim slot (set `exportInFlight = true`, reset `exportCancelFlag = false`).
    6. `await runExport(plan, outDir, onProgress, isCancelled)` — `onProgress` calls `evt.sender.send('export:progress', e)` wrapped in try/catch (renderer-window-gone safe); `isCancelled` returns the closed-over `exportCancelFlag`.
    7. `finally` clears both flags so a follow-up call after error proceeds.

- **`registerIpcHandlers` extension:** wires the 4 new channels next to the existing `'skeleton:load'` registration. `'dialog:pick-output-dir'` and `'export:start'` use `ipcMain.handle` (request/response); `'export:cancel'` and `'shell:open-folder'` use `ipcMain.on` (one-way). The `'export:cancel'` handler simply flips `exportCancelFlag = true`. The `'shell:open-folder'` handler validates `typeof dir === 'string' && dir.length > 0` (T-06-14 defense-in-depth) and wraps `shell.showItemInFolder(dir)` in try/catch (silent — one-way channel).

- **`src/main/index.ts` verified untouched** — `registerIpcHandlers()` already called once at `app.whenReady()`; the new channels register through the same wiring.

### Task 2 — `src/preload/index.ts` extension (commit `adfc692`)

Replaced the 5 `NOT_YET_WIRED` stubs from Plan 06-02 with real bridges. `loadSkeletonFromFile` and the `contextBridge.exposeInMainWorld('api', api)` invocation at the bottom of the file remained untouched.

- **`pickOutputDirectory(defaultPath?)`** → `ipcRenderer.invoke('dialog:pick-output-dir', defaultPath)` (request/response).
- **`startExport(plan, outDir)`** → `ipcRenderer.invoke('export:start', plan, outDir)` (request/response).
- **`cancelExport()`** → `ipcRenderer.send('export:cancel')` (one-way fire-and-forget).
- **`openOutputFolder(dir)`** → `ipcRenderer.send('shell:open-folder', dir)` (one-way).
- **`onExportProgress(handler)`** — RESEARCH §Pitfall 9 listener-identity preservation:
  ```typescript
  const wrapped = (_evt, event) => handler(event);
  ipcRenderer.on('export:progress', wrapped);
  return () => ipcRenderer.removeListener('export:progress', wrapped);
  ```
  The `wrapped` const is captured BEFORE `.on` so the returned unsubscribe targets the SAME reference. Without this, the unsubscribe would create a new closure and silently fail to remove the listener (long-running renderer would leak listeners).

- **Sandbox discipline preserved:** only `'electron'` runtime import + type-only `'../shared/types.js'` (added `ExportProgressEvent` to the existing type-only import line). No new runtime npm dep.

## Plan 06-01 RED → GREEN Status

All 4 spec files seeded by Plan 06-01 are now GREEN:

| File | Status | Tests |
|------|--------|-------|
| `tests/core/export.spec.ts` | GREEN | (Plan 06-03 drove green earlier) |
| `tests/main/image-worker.spec.ts` | GREEN | (Plan 06-04 drove green earlier) |
| `tests/main/image-worker.integration.spec.ts` | GREEN | (Plan 06-04 drove green earlier) |
| `tests/main/ipc-export.spec.ts` | GREEN | 9/9 (Plan 06-05 — this plan) |

Combined: **35/35 GREEN** for the four Plan 06-01 RED files.

## Verification

```
npm run typecheck:web                                   → clean
npm run typecheck:node                                  → 1 PRE-EXISTING error in scripts/probe-per-anim.ts
                                                          (out of scope; pre-existing on base c0dd0c1)
npm run test -- tests/main/ipc-export.spec.ts           → 9/9 passed
npm run test -- tests/arch.spec.ts                      → 9/9 passed (Layer 3 invariants intact)
npm run test                                            → 172 passed | 1 skipped (173 total)
npx electron-vite build                                 → main + preload (2.74 kB CJS) + renderer (599 kB) all clean
git diff --exit-code scripts/cli.ts                     → empty (CLI byte-for-byte unchanged — D-102 lock)
git diff --exit-code src/core/sampler.ts                → empty (sampler byte-for-byte unchanged — CLAUDE.md fact #3)
```

## Acceptance Criteria

Task 1:
- ✅ `grep -E "^export async function handlePickOutputDirectory" src/main/ipc.ts` matches
- ✅ `grep -E "^export async function handleStartExport" src/main/ipc.ts` matches
- ✅ `grep -E "let exportInFlight" src/main/ipc.ts` matches
- ✅ `grep -E "let exportCancelFlag" src/main/ipc.ts` matches
- ✅ `grep -E "isOutDirInsideSourceImages" src/main/ipc.ts` matches
- ✅ 5 distinct `ipcMain.(handle|on)(` channel registrations: `skeleton:load` + 4 new
- ✅ All 4 channel literals + `'createDirectory'` + `'promptToCreate'` greps match
- ✅ `npm run test -- tests/main/ipc-export.spec.ts` 9/9 GREEN
- ✅ `npm run test -- tests/arch.spec.ts` 9/9 GREEN
- ✅ scripts/cli.ts + src/core/sampler.ts byte-for-byte unchanged

Task 2:
- ✅ 5 method-name greps match (`pickOutputDirectory` + `startExport` + `cancelExport` + `onExportProgress` + `openOutputFolder`)
- ✅ `ipcRenderer.on('export:progress'` + `ipcRenderer.removeListener('export:progress'` both match (listener-identity pattern wired)
- ✅ `ipcRenderer.send('export:cancel'` + `ipcRenderer.send('shell:open-folder'` both match
- ✅ `ipcRenderer.invoke('dialog:pick-output-dir'` + `ipcRenderer.invoke('export:start'` both match
- ✅ Imports: only `electron` runtime + type-only from `shared/types.js` (sandbox discipline preserved; no new runtime npm dep)
- ✅ `npx electron-vite build` clean (preload bundles to 2.74 kB CJS)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-entrancy slot must be claimed before empty-plan early-return**

- **Found during:** Task 1 verification — initial implementation had an empty-plan synchronous early-return BEFORE `exportInFlight = true` was set, causing the test `'rejects re-entrant call with { ok:false, error:{ kind:"already-running" } }'` to fail. The first `handleStartExport(plan-with-empty-rows, ...)` call returned synchronously without ever setting the flag, so the second call saw `exportInFlight = false` and proceeded.
- **Issue:** Test contract requires re-entrancy enforcement uniformly across plan sizes. JS microtask semantics: a synchronous return resolves the promise immediately, so a sequential `const first = handleStartExport(...); await handleStartExport(...)` would never see the flag set if the first call short-circuited synchronously.
- **Fix:** Removed the empty-plan early-return; let the empty plan flow through `runExport` (which loops zero times and returns an empty summary anyway). The `exportInFlight = true` set is now reached uniformly for all valid plans, so a microtask-adjacent second call sees the flag and bails with `'already-running'`.
- **Files modified:** src/main/ipc.ts (handleStartExport restructure)
- **Commit:** included in `cad017f` (single-task commit)

### Architectural Choices Within Discretion

**2. [Discretion within plan] Source-images-dir derivation uses FIRST `/images/` segment, not lastIndexOf**

- **Plan said:** "for nested regions (e.g. 'AVATAR/FACE'), use the first `/images/` segment"
- **Implementation:** Used `normalised.indexOf('/images/')` (first occurrence). The plan's `<action>` block had `lastIndexOf` in the example code but the prose explicitly said "FIRST `/images/` segment" — chose to align with the prose and the security intent (a deeper `/images/` deeper in the source path is irrelevant; the topmost is the source-images-dir).
- **Rationale:** Defends F8.4 correctly: if `row[0].sourcePath = /skel/images/AVATAR/FACE.png` and user picks `/skel/images/sub` as outDir, `lastIndexOf` would derive `sourceImagesDir = /skel/images/AVATAR/FACE/images` (wrong if no nested `/images/` exists, or wrong-deep otherwise). `indexOf` derives `/skel/images` correctly, which then properly catches `/skel/images/sub` as a child.

**3. [Discretion within plan] empty-plan rows.length === 0 explicitly skips outDir validation**

- **Plan said:** outDir validation runs against `row[0].sourcePath`-derived sourceImagesDir.
- **Implementation:** Wrapped the entire `isOutDirInsideSourceImages` check in `if (validPlan.rows.length > 0)` to avoid a `row[0]` access on an empty plan. Empty plans skip the validation and proceed directly to `runExport` (which then returns an empty summary).
- **Rationale:** Empty plans have no source path to validate against; defaulting to "always allowed" is correct — there is nothing to overwrite.

### Out-of-Scope Pre-Existing Issues (Not Fixed)

**4. [SCOPE BOUNDARY — out-of-scope] Pre-existing typecheck error in scripts/probe-per-anim.ts**

- **Found during:** `npm run typecheck:node` baseline check
- **Issue:** `scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.`
- **Status:** Pre-existing on base commit `c0dd0c1` (verified by stashing my changes and re-running typecheck). Not caused by this plan; not in `files_modified` for this plan.
- **Action:** Logged here. Not fixing — out of scope per executor scope-boundary rule.

## Auth Gates

None — Plan 06-05 is local code only; no third-party services or credentials touched.

## Self-Check: PASSED

Files claimed created/modified verified:
- ✅ src/main/ipc.ts — modified (handleSkeletonLoad preserved untouched; 4 new channels + 2 handlers + module flags added)
- ✅ src/preload/index.ts — modified (5 stubs replaced with real bridges; loadSkeletonFromFile + contextBridge call preserved)

Commits verified in git log:
- ✅ `cad017f` — `feat(06-05): wire export IPC channels with re-entrancy + outDir validation`
- ✅ `adfc692` — `feat(06-05): wire preload contextBridge for export pipeline`

Test claims verified by re-running:
- ✅ tests/main/ipc-export.spec.ts: 9/9 GREEN
- ✅ tests/arch.spec.ts: 9/9 GREEN
- ✅ Full vitest: 172 passed / 1 skipped / 0 failures
- ✅ tests/core/export.spec.ts + tests/main/image-worker.spec.ts + tests/main/image-worker.integration.spec.ts + tests/main/ipc-export.spec.ts: 35/35 GREEN combined

Byte-for-byte locks verified:
- ✅ scripts/cli.ts unchanged
- ✅ src/core/sampler.ts unchanged
