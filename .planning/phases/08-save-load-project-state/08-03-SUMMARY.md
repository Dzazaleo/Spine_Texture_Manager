---
phase: 08-save-load-project-state
plan: 03
subsystem: main-process-save-load-glue
tags: [phase-8, wave-3, main, ipc, preload, atomic-write, dirty-guard, locate-skeleton, save-load]
dependency_graph:
  requires:
    - "src/shared/types.ts (Phase 8 types — Plan 01)"
    - "src/core/project-file.ts (validator + migration + path helpers — Plan 02)"
    - "src/core/loader.ts (F1.2 atlas auto-discovery + SpineLoaderError hierarchy)"
    - "src/core/sampler.ts (samplingHz option — F9.2 thread target)"
    - "src/main/summary.ts (buildSummary projection — Phase 1 D-21)"
    - "src/main/image-worker.ts (Pattern B atomic-write reference impl)"
    - "src/main/ipc.ts (handleSkeletonLoad envelope shape + handlePickOutputDirectory dialog idiom)"
  provides:
    - "src/main/project-io.ts (6 async handlers: Save / SaveAs / Open / OpenFromPath / LocateSkeleton / ReloadWithSkeleton)"
    - "6 IPC channels registered in src/main/ipc.ts (project:save / save-as / open / open-from-path / locate-skeleton / reload-with-skeleton)"
    - "before-quit dirty-guard intercept + project:confirm-quit-proceed reverse channel + open-file scaffold in src/main/index.ts"
    - "8 contextBridge methods in src/preload/index.ts (replaces Plan 01 NOT_YET_WIRED stubs)"
  affects:
    - "Plan 04 (Wave 4 — AppShell mounts SaveQuitDialog + Save/Open buttons + dirty-marker; consumes preload bridges)"
tech_stack:
  added: []
  patterns:
    - "Pattern B atomic write (`<path>.tmp` + fs.rename, same-directory — Pitfall 2 EXDEV avoidance)"
    - "D-10 typed-error envelope (8-kind SerializableError union; 4 Phase 8 kinds — Phase 8 Plan 01 lock)"
    - "Pitfall 1 setTimeout deferral on second app.quit() (re-entry guard via module-level isQuitting flag)"
    - "Pitfall 7 dual-one-way dirty-guard wiring (preventDefault + send + reverse send; never invoke)"
    - "Pitfall 9 JSON.parse SyntaxError → ProjectFileParseError translation"
    - "Pitfall 5 empty-path guard for File-drop (webUtils.getPathForFile returns '' for synthetic Files)"
    - "Listener identity preservation (Pitfall 9 wrapped-const closure for clean unsubscribe)"
    - "D-149 Approach A locate-skeleton recovery (dedicated reload-with-skeleton IPC; reuses loader+sampler+buildSummary internals)"
    - "F1.2 atlas auto-discovery (D-152 — pass {} when atlasPath null, loader resolves sibling)"
    - "D-150 stale-override-key intersection (Set lookup over summary.peaks.attachmentName)"
    - "D-146 samplingHz default 120 (resolved by materializeProjectFile, threaded through sampleSkeleton)"
key_files:
  created:
    - "src/main/project-io.ts (555 lines, 6 async exports + 1 private writeProjectFileAtomic helper)"
  modified:
    - "src/main/ipc.ts (+39 lines — 1 import block + 6 channel registrations appended to registerIpcHandlers)"
    - "src/main/index.ts (+58 lines — module-level isQuitting flag + before-quit listener + confirmQuitProceed listener + open-file scaffold; ipcMain added to electron import)"
    - "src/preload/index.ts (+96 / -27 lines — 8 real contextBridge methods replace 9 NOT_YET_WIRED stubs; helper removed)"
decisions:
  - "Imported SkeletonJsonNotFoundError from '../core/errors.js' directly (not via loader re-export) — confirmed via reading src/main/ipc.ts:44 + src/core/errors.ts; matches existing main-side convention."
  - "writeProjectFileAtomic kept as private (non-exported) helper — not part of the public 6-handler surface; mirrors validateExportPlan's private-helper status in src/main/ipc.ts."
  - "atlasPath conditional: pass {atlasPath: ...} only when materialized.atlasPath is non-null; pass {} otherwise → loader's F1.2 sibling auto-discovery runs (D-152 lock). Mirrors the D-152 contract verbatim."
  - "Removed the Plan 01 NOT_YET_WIRED_PHASE8 helper from preload — no longer referenced after the 9 stubs were superseded by real bridges. Same supersedence pattern as Phase 6 Plan 02→05."
  - "as const cast on the openProjectFromFile rejection branch — ensures 'kind: Unknown' literal narrowing survives the OpenResponse discriminated-union return type without an explicit OpenResponse cast."
metrics:
  completed_date: "2026-04-26"
  tasks_completed: 3
  files_created: 1
  files_modified: 3
  commits: 3
  test_count_delta:
    before_pass: 259
    before_fail: 2
    before_test_files_failed: 2
    after_pass: 270
    after_fail: 2
    after_test_files_failed: 1
    net_pass_delta: 11
    net_fail_delta: 0
---

# Phase 8 Plan 03: Main + Preload Save/Load Glue Summary

**One-liner:** `src/main/project-io.ts` shipped (6 async handlers — atomic-write Save + 9-step Open chain + D-149 locate-skeleton recovery via dedicated reload-with-skeleton IPC); 6 ipcMain channels wired in `ipc.ts`; before-quit dirty-guard + open-file scaffold landed in `index.ts`; 8 contextBridge methods replaced the Plan 01 NOT_YET_WIRED stubs in preload — all 11 Plan 01 RED specs in `tests/main/project-io.spec.ts` flipped GREEN.

## Files Created / Modified

### Created (1)

| File                     | LOC | Purpose                                                                                                |
| ------------------------ | --- | ------------------------------------------------------------------------------------------------------ |
| `src/main/project-io.ts` | 555 | 6 async handlers + 1 private atomic-write helper. Sole Phase 8 main-side caller of fs.promises + dialog. |

**Six exports:**

| Symbol                              | Returns                       | One-line doc                                                                                                                                                  |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handleProjectSave`                 | `Promise<SaveResponse>`       | Writes session to a known .stmproj path (dirty-save). Belt-and-suspenders typeof + extension check; renderer guarantees non-null currentPath.                  |
| `handleProjectSaveAs`               | `Promise<SaveResponse>`       | Opens native save-file picker (defaultPath = `${defaultDir}/${defaultBasename}.stmproj`), then writes atomically. Cancel returns `Save cancelled` envelope.    |
| `handleProjectOpen`                 | `Promise<OpenResponse>`       | Opens native file picker, then chains to handleProjectOpenFromPath. Cancel returns `Open cancelled` envelope.                                                  |
| `handleProjectOpenFromPath`         | `Promise<OpenResponse>`       | 9-step chain: readFile → JSON.parse → validate → migrate → materialize → loadSkeleton → sampleSkeleton → buildSummary → stale-override intersect.              |
| `handleLocateSkeleton`              | `Promise<LocateSkeletonResponse>` | D-149 picker for replacement skeleton. Returns `{ok:true, newPath}` or `{ok:false}` (no error message — cancel is dominant case).                          |
| `handleProjectReloadWithSkeleton`   | `Promise<OpenResponse>`       | D-149 recovery (Approach A). Reuses steps 6-9 of OpenFromPath against a user-picked replacement skeleton + cached overrides; returns same OpenResponse shape. |

### Modified (3)

| File                  | Change                  | Purpose                                                                                                                       |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/main/ipc.ts`     | +39 lines               | Import 6 project-io handlers; append 6 ipcMain.handle registrations to registerIpcHandlers (project:save / save-as / open / open-from-path / locate-skeleton / reload-with-skeleton). |
| `src/main/index.ts`   | +58 lines               | `ipcMain` added to electron import; module-level `isQuitting` flag; before-quit listener + project:confirm-quit-proceed reverse channel (dual-one-way, Pitfall 1 setTimeout deferral); open-file scaffold (Phase 9 macOS file association drop-in). |
| `src/preload/index.ts`| +96 / -27 lines         | 8 real contextBridge methods (6 invoke + 1 listener + 1 sender) replace the 9 Plan 01 NOT_YET_WIRED stubs; helper removed.    |

## Test Names — Plan 01 RED → GREEN (11 cases, all match VALIDATION.md selectors verbatim)

### tests/main/project-io.spec.ts (0/11 GREEN → 11/11 GREEN)

#### handleProjectSave / handleProjectSaveAs (F9.1, T-08-IO)

- `save writes file with all D-145 fields`
- `atomic-write tmp then rename (D-141 + Pattern B)`
- `save with currentPath skips dialog`
- `save-as opens dialog with correct defaultPath`

#### handleProjectOpen / handleProjectOpenFromPath (F9.2)

- `load restores overrides verbatim`
- `load threads samplingHz into sampleSkeleton`
- `load drops stale override keys (D-150)`
- `missing skeleton returns typed error (D-149, T-08-MISS)`
- `newer version returns typed error (D-151, T-08-VER)`
- `malformed JSON returns ProjectFileParseError (Pitfall 9)`
- `atlas auto-discovery on null path (D-152)`

(The Plan 01 RED file shipped 11 it cases. Plan 03 GREEN's all of them; the spec file did NOT need modification — the imports and assertions Plan 01 wrote matched the contract this Plan 03 implementation provides, no Rule 3 fix-ups needed in the spec.)

## Deviations from Plan

None. The plan ran exactly as written. All 11 Plan 01 RED specs flipped GREEN with zero modifications to the spec file. No Rule 1/2/3 auto-fixes triggered.

The plan's `<action>` block included a parenthetical "Important: verify `errors.js` is the correct module path for `SkeletonJsonNotFoundError`" — confirmed via reading `src/main/ipc.ts:44` (already imports from `'../core/errors.js'`) and `src/core/errors.ts:20` (declares `export class SkeletonJsonNotFoundError`). The plan's suggested import path matched verbatim.

## Acceptance Criteria Status

### Task 1 (`src/main/project-io.ts`) — 19/19 pass

| Check                                                                    | Status                                |
| ------------------------------------------------------------------------ | ------------------------------------- |
| File exists ≥ 220 lines                                                  | 555 lines                             |
| `handleProjectSave` exported                                             | 1                                     |
| `handleProjectSaveAs` exported                                           | 1                                     |
| `handleProjectOpen` exported                                             | 1                                     |
| `handleProjectOpenFromPath` exported                                     | 1                                     |
| `handleLocateSkeleton` exported                                          | 1                                     |
| `handleProjectReloadWithSkeleton` exported                               | 1                                     |
| `.tmp` mention                                                           | 3 (atomic-write tmp suffix)           |
| `rename(` mention                                                        | 1                                     |
| `ProjectFileParseError` mention                                          | 7                                     |
| `ProjectFileVersionTooNewError` mention                                  | 3                                     |
| `SkeletonNotFoundOnLoadError` mention                                    | 4                                     |
| `loadSkeleton` mention                                                   | 5                                     |
| `sampleSkeleton` mention                                                 | 5                                     |
| `buildSummary` mention                                                   | 8                                     |
| `validateProjectFile` mention                                            | 3                                     |
| `showSaveDialog` / `showOpenDialog` mention                              | 6                                     |
| `npx vitest run tests/main/project-io.spec.ts`                           | exit 0 — 11/11 GREEN                  |
| `npx tsc --noEmit -p tsconfig.node.json`                                 | exit 0 (only pre-existing scripts/probe-per-anim.ts TS2339) |

### Task 2 (`src/main/ipc.ts` + `src/main/index.ts`) — 17/17 pass

| Check                                                                    | Status                                |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `from './project-io.js'` import                                          | 1                                     |
| `ipcMain.handle('project:save'`                                          | 1                                     |
| `ipcMain.handle('project:save-as'`                                       | 1                                     |
| `ipcMain.handle('project:open'`                                          | 1                                     |
| `ipcMain.handle('project:open-from-path'`                                | 1                                     |
| `ipcMain.handle('project:locate-skeleton'`                               | 1                                     |
| `ipcMain.handle('project:reload-with-skeleton'`                          | 1                                     |
| `ipcMain.handle('skeleton:load'` preserved                               | 2 (1 docblock + 1 registration; baseline preserved) |
| `let isQuitting`                                                         | 1                                     |
| `app.on('before-quit'`                                                   | 1                                     |
| `ipcMain.on('project:confirm-quit-proceed'`                              | 1                                     |
| `app.on('open-file'`                                                     | 1                                     |
| `setTimeout(() => app.quit()`                                            | 2 (re-entry path + no-window path)    |
| `project:check-dirty-before-quit`                                        | 2 (1 docblock + 1 send call)          |
| `npx tsc --noEmit -p tsconfig.node.json`                                 | exit 0                                |
| `npx electron-vite build`                                                | exit 0; main bundle 57.96 kB CJS      |
| `npx vitest run tests/arch.spec.ts`                                      | 10/10 GREEN                           |

### Task 3 (`src/preload/index.ts`) — 18/18 pass

| Check                                                                    | Status                                |
| ------------------------------------------------------------------------ | ------------------------------------- |
| `saveProject:` member                                                    | 1                                     |
| `saveProjectAs:` member                                                  | 1                                     |
| `openProject:` member                                                    | 1                                     |
| `openProjectFromFile:` member                                            | 1                                     |
| `openProjectFromPath:` member                                            | 1                                     |
| `locateSkeleton:` member                                                 | 1                                     |
| `reloadProjectWithSkeleton:` member                                      | 1                                     |
| `ipcRenderer.invoke('project:reload-with-skeleton'`                      | 1                                     |
| `onCheckDirtyBeforeQuit:` member                                         | 1                                     |
| `confirmQuitProceed:` member                                             | 1                                     |
| `ipcRenderer.invoke('project:save'`                                      | 1                                     |
| `ipcRenderer.invoke('project:open-from-path'`                            | 2 (openProjectFromFile + openProjectFromPath both invoke this channel) |
| `ipcRenderer.send('project:confirm-quit-proceed'`                        | 1                                     |
| `ipcRenderer.on('project:check-dirty-before-quit'`                       | 1                                     |
| `webUtils.getPathForFile`                                                | 4 (2 calls + 2 docblock mentions)     |
| `loadSkeletonFromFile:` preserved                                        | 1                                     |
| `npx tsc --noEmit -p tsconfig.node.json` AND `tsconfig.web.json`         | both exit 0 (only deferred TS2339)    |
| `npx electron-vite build` — `out/preload/index.cjs` emitted              | 8.03 kB (was 4.84 kB pre-Plan-03)     |

## Locked Files (Byte-Identical Confirmation)

- `git diff --exit-code scripts/cli.ts` → exit 0 (Phase 5 D-102 lock preserved)
- `git diff --exit-code src/core/sampler.ts` → exit 0 (CLAUDE.md rule #3 lock preserved)

CLI smoke test: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → exit 0 with the expected 3-row golden table (CIRCLE 2.018, SQUARE 1.500, TRIANGLE 2.000).

## Test Counts

| Suite               | Before (Plan 02 baseline) | After (this plan) | Delta                                                              |
| ------------------- | ------------------------- | ----------------- | ------------------------------------------------------------------ |
| Total tests pass    | 259                       | 270               | **+11** (project-io.spec.ts went from RED suite-fail to 11/11 GREEN) |
| Total tests skipped | 1                         | 1                 | 0                                                                  |
| Total tests todo    | 1                         | 1                 | 0                                                                  |
| Total tests failed  | 2                         | 2                 | 0 (same Plan 04 RED — Save button + Cmd+S in save-load.spec.tsx)   |
| Test files failed   | 2                         | 1                 | **−1** (project-io.spec.ts went from RED suite-fail to all-GREEN)  |

**Existing green count not regressed.** All 259 prior tests still pass; +11 new GREEN tests added.

## Build Verification

- `npx tsc --noEmit -p tsconfig.web.json` → **exit 0** (clean)
- `npx tsc --noEmit -p tsconfig.node.json` → **exit 0** with only the pre-existing `scripts/probe-per-anim.ts` TS2339
- `npx electron-vite build` → **exit 0**:
  - `out/main/index.cjs` 57.96 kB (was 41.86 kB pre-Plan-03 — +16 kB for the 6 new project handlers; main bundle still emits as CJS per Phase 2 D-arch lock at tests/arch.spec.ts:65-78)
  - `out/preload/index.cjs` 8.03 kB (was 4.84 kB pre-Plan-03 — +3 kB for the 8 new bridges; preload still emits as CJS per Phase 1 sandbox lock at tests/arch.spec.ts:51-62)
  - renderer bundle 671.03 kB JS + 23.48 KB CSS (unchanged — this plan touches no renderer code; Plan 04 wires AppShell)

## Commits

| Hash      | Subject                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `f58adb9` | feat(08-03): add src/main/project-io.ts (6 async handlers — Save/Open/Locate/Reload)                  |
| `7558a7d` | feat(08-03): wire 6 project IPC channels + before-quit dirty-guard                                     |
| `09d1c22` | feat(08-03): wire 8 project contextBridge methods in preload                                           |

## CJS Bundle Locks Preserved (arch.spec 4/4 + Phase 8 hygiene block)

- **Preload sandbox invariant** (tests/arch.spec.ts:51-62): main references `preload/index.cjs` (not `.mjs`); electron.vite.config.ts emits preload as `format: 'cjs'` with `[name].cjs` filename. **Both checks GREEN.**
- **Main-bundle CJS invariant** (tests/arch.spec.ts:65-82): package.json `main` field === `'./out/main/index.cjs'`; electron.vite.config.ts main block emits as `format: 'cjs'` with `[name].cjs` filename. **Both checks GREEN.**
- **Phase 8 Layer 3 hygiene** (tests/arch.spec.ts:136-150): `src/core/project-file.ts` does not import from `electron`. **GREEN** (Plan 02 lock preserved).

Total arch.spec runs: **10/10 GREEN** (8 pre-Phase-8 blocks + Phase 8 block + Phase 8 hygiene block).

## Self-Check: PASSED

All 3 commits exist:

- `f58adb9` confirmed by `git log --oneline | grep f58adb9`
- `7558a7d` confirmed by `git log --oneline | grep 7558a7d`
- `09d1c22` confirmed by `git log --oneline | grep 09d1c22`

Created file exists:

- `src/main/project-io.ts` (555 lines) confirmed by `wc -l`

Modified files in commits:

- `src/main/ipc.ts` (+39 lines: import block + 6 channel registrations)
- `src/main/index.ts` (+58 lines: isQuitting flag + before-quit + confirm-quit-proceed + open-file scaffold; ipcMain added to electron import)
- `src/preload/index.ts` (+96 / -27 lines: 8 real bridges replace 9 stubs; NOT_YET_WIRED helper removed)

Locked files unchanged:

- `git diff --exit-code scripts/cli.ts` → exit 0
- `git diff --exit-code src/core/sampler.ts` → exit 0

All 11 Plan 01 RED specs in `tests/main/project-io.spec.ts` now GREEN; full suite at 270 pass / 2 fail (Plan 04 RED for Save button + Cmd+S, unchanged); arch.spec 10/10 GREEN.
