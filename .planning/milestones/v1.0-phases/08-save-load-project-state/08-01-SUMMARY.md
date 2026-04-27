---
phase: 08-save-load-project-state
plan: 01
subsystem: shared-types-and-red-test-scaffolding
tags: [phase-8, wave-0, types, red-tests, ipc-contract, layer-3, save-load]
dependency_graph:
  requires:
    - "src/shared/types.ts (existing IPC contract surface — Phase 1+6+7 baseline)"
    - "tests/arch.spec.ts (existing 6-block Phase 0/1/4/6 baseline)"
    - "tests/main/ipc-export.spec.ts (Pattern I main-process mock prelude template)"
    - "tests/renderer/atlas-preview-modal.spec.tsx (jsdom prelude template)"
  provides:
    - "ProjectFileV1 + ProjectFile alias (.stmproj v1 schema, D-145..D-156)"
    - "AppSessionState (renderer snapshot for save handlers)"
    - "MaterializedProject (Open response payload with re-sampled summary)"
    - "SaveResponse / OpenResponse / LocateSkeletonResponse envelopes (D-10 mirror)"
    - "SerializableError union extended with 4 Phase 8 kinds"
    - "Api interface extended with 9 Phase 8 members (6 invoke + 1 listener + 1 sender + 1 D-149 recovery)"
    - "tests/core/project-file.spec.ts (8 describe/it RED shells, vitest fails with module-not-found)"
    - "tests/main/project-io.spec.ts (11 describe/it RED shells, vitest fails with module-not-found)"
    - "tests/renderer/save-load.spec.tsx (7 describe/it RED+shell tests, jsdom prelude)"
    - "tests/arch.spec.ts Phase 8 block (T-08-LAYER, graceful-skip when project-file.ts absent)"
    - "src/preload/index.ts NOT_YET_WIRED stubs for 9 new Api members (Plan 04 replaces)"
  affects:
    - "Plan 02 (Wave 2 GREEN — implements src/core/project-file.ts; arch block activates automatically)"
    - "Plan 03 (Wave 3 GREEN — implements src/main/project-io.ts; project-io.spec.ts turns GREEN)"
    - "Plan 04 (Wave 4 GREEN — wires AppShell + DropZone + SaveQuitDialog + preload bridges; save-load.spec.tsx GREEN; replaces NOT_YET_WIRED preload stubs)"
tech_stack:
  added: []
  patterns:
    - "structuredClone-safe IPC contract (file-top docblock at types.ts:1-17)"
    - "D-10 typed-error envelope mirror (LoadResponse → SaveResponse / OpenResponse / LocateSkeletonResponse)"
    - "NOT_YET_WIRED preload stub pattern (precedent: Phase 6 Plan 02 commit 13d395e)"
    - "RED via module-not-found import (vitest treats as suite-level FAIL, not crash)"
    - "Graceful-skip arch grep (try/catch wraps readFileSync so suite stays green until file lands)"
    - "Pattern I main-process test prelude (vi.mock electron + node:fs/promises with beforeEach reset)"
    - "Pattern jsdom prelude (// @vitest-environment jsdom + cleanup + vi.stubGlobal)"
key_files:
  created:
    - "tests/core/project-file.spec.ts (182 lines, 11 it cases in 4 describes — validator x4-reject + x2-accept + newer-version + round-trip x4 + migrate identity + hygiene)"
    - "tests/main/project-io.spec.ts (202 lines, 11 it cases in 2 describes — Save x4 + Open x7)"
    - "tests/renderer/save-load.spec.tsx (172 lines, 7 it cases in 5 describes — Save/Open buttons + Keyboard shortcuts + SaveQuitDialog + Stale-override banner + DropZone branch)"
  modified:
    - "src/shared/types.ts (+92 lines — 7 new types, 4 new SerializableError kinds, 9 new Api members)"
    - "src/preload/index.ts (+28 lines — NOT_YET_WIRED helper + 9 stub bridges, Rule 3 blocking deviation)"
    - "tests/arch.spec.ts (+22 lines — Phase 8 electron-import block with graceful-skip)"
decisions:
  - "Inserted 4 new SerializableError kinds BEFORE 'Unknown' to preserve the existing 4-kind ordering and the 'Unknown' fallback semantics."
  - "Reused the 'overrides: Record<string, number>' shape (not Map) on disk + IPC — Pitfall 3 boundary conversion happens in core/project-file.ts (Wave 2)."
  - "Added reloadProjectWithSkeleton as the 8th invoke method (D-149 Approach A recovery) so Plan 04 can dispatch the locate-skeleton flow without an App.tsx callback prop."
  - "Phase 8 arch block uses try/catch graceful-skip — Wave 1 must keep the test suite green even though src/core/project-file.ts won't exist until Plan 02; Plan 02 commits the file and the assertions activate automatically."
  - "Trimmed tests/main/project-io.spec.ts imports to the 3 handlers exercised in this RED file (omitting handleProjectOpen + handleLocateSkeleton) to avoid noUnusedLocals TS6133 noise on top of the expected TS2307 module-not-found. Plan 03 adds them when the dialog-form Open + locate cases get test bodies."
  - "[Rule 3 - Blocking] src/preload/index.ts NOT_YET_WIRED stubs added for the 9 new Api members. Same pattern as Phase 6 Plan 02 commit 13d395e (which superseded its stubs in Plan 06-05)."
metrics:
  duration_seconds: 490
  duration_human: "8 min 10 sec"
  completed_date: "2026-04-26"
  tasks_completed: 4
  files_created: 3
  files_modified: 3
  commits: 4
  test_count_delta:
    before_pass: 240
    before_skip: 1
    before_todo: 1
    after_pass: 246
    after_skip: 1
    after_todo: 1
    after_fail: 2
    net_pass_delta: 6
---

# Phase 8 Plan 01: Wave 0 Type Contracts + RED Test Scaffolding Summary

**One-liner:** Phase 8 IPC contracts (ProjectFileV1 + 3 response envelopes + 4 SerializableError kinds + 9 Api members) landed in `src/shared/types.ts` with NOT_YET_WIRED preload stubs (Rule 3); three RED spec files + Phase 8 arch.spec block shipped — Wave 2/3/4 turn them GREEN.

## Files Modified / Created

### Created (3)

| File | LOC | Purpose |
|------|-----|---------|
| `tests/core/project-file.spec.ts` | 182 | 11 it cases / 4 describes — RED until Plan 02 lands `src/core/project-file.ts` |
| `tests/main/project-io.spec.ts` | 202 | 11 it cases / 2 describes — RED until Plan 03 lands `src/main/project-io.ts` |
| `tests/renderer/save-load.spec.tsx` | 172 | 7 it cases / 5 describes — 5 pass / 2 fail predictably (Plan 04 wires Save + Cmd+S) |

### Modified (3)

| File | Change | Purpose |
|------|--------|---------|
| `src/shared/types.ts` | +92 lines | 7 new types + 4 new SerializableError kinds + 9 new Api members |
| `src/preload/index.ts` | +28 lines | NOT_YET_WIRED stubs (Rule 3 blocking) so the preload bundle typechecks until Plan 04 |
| `tests/arch.spec.ts` | +22 lines | Phase 8 electron-import block (T-08-LAYER) with graceful-skip |

## Test Name Strings Landed (verbatim, match VALIDATION.md `-t` selectors)

### tests/core/project-file.spec.ts

- `validator rejects non-object input`
- `validator rejects missing version`
- `validator rejects missing skeletonPath`
- `validator rejects wrong-type overrides`
- `validator accepts minimal v1 file`
- `validator accepts full v1 file`
- `newer version rejected (D-151)`
- `round-trip preserves all D-145 fields`
- `documentation slot preserved on round-trip (D-148)`
- `round-trip relative paths (D-155)`
- `cross-volume falls back to absolute (D-155 + Pitfall 4)`
- `migrate is identity on v1`
- `does not import node:fs / node:fs/promises / sharp / electron` (T-08-LAYER hygiene)

### tests/main/project-io.spec.ts

- `save writes file with all D-145 fields`
- `atomic-write tmp then rename (D-141 + Pattern B)`
- `save with currentPath skips dialog`
- `save-as opens dialog with correct defaultPath`
- `load restores overrides verbatim`
- `load threads samplingHz into sampleSkeleton`
- `load drops stale override keys (D-150)`
- `missing skeleton returns typed error (D-149, T-08-MISS)`
- `newer version returns typed error (D-151, T-08-VER)`
- `malformed JSON returns ProjectFileParseError (Pitfall 9)`
- `atlas auto-discovery on null path (D-152)`

### tests/renderer/save-load.spec.tsx

- `Save reuses currentProjectPath` (RED — Plan 04 wires)
- `dirty marker bullet renders when state mutates (D-144)` (passes today)
- `Cmd+S triggers Save` (RED — Plan 04 wires)
- `Cmd+S suppressed when modal open (T-08-SHORT)` (passes today — guard heuristic works pre-wiring)
- `dirty + drop opens guard` (shell — Plan 04 fills behavior)
- `stale override banner renders count + names` (shell — Plan 04 fills behavior)
- `dropzone branch on stmproj` (shell — Plan 04 fills behavior)

### tests/arch.spec.ts (new block)

- `src/core/project-file.ts does not import from electron` (graceful-skip until Plan 02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NOT_YET_WIRED preload stubs for 9 new Api members**

- **Found during:** Task 1 verification (`npx tsc --noEmit -p tsconfig.node.json`)
- **Issue:** Extending the `Api` interface in `src/shared/types.ts` immediately broke `src/preload/index.ts` typecheck with `TS2740 — Type '{...}' is missing the following properties from type 'Api': saveProject, saveProjectAs, openProject, openProjectFromFile, and 5 more.` The preload's `const api: Api = {...}` declaration enforces the contract at compile time.
- **Fix:** Added a `NOT_YET_WIRED_PHASE8(method)` helper that throws an explicit "Phase 8 Plan 04 ships the IPC bridge" error, then bound it as the implementation for the 9 new Api members. Same pattern as Phase 6 Plan 02 commit `13d395e` — those stubs were superseded by real bridges in Plan 06-05.
- **Files modified:** `src/preload/index.ts` (+28 lines: helper docblock + helper definition + 9 stub assignments after the existing `openOutputFolder` member)
- **Commit:** `4731820` (folded into Task 1's commit so the typecheck stays green at every commit boundary)

**2. [Rule 3 - Blocking] Trimmed unused imports from project-io.spec.ts**

- **Found during:** Task 3 verification (`npx tsc --noEmit -p tsconfig.node.json`)
- **Issue:** The plan's spec stub imports `handleProjectSave / handleProjectSaveAs / handleProjectOpen / handleProjectOpenFromPath / handleLocateSkeleton` but only exercises the first three in test bodies. With `noUnusedLocals: true` (Phase 1 baseline tsconfig), this produces `TS6133 — 'handleProjectOpen' is declared but its value is never read` + same for `handleLocateSkeleton`. Two extra red marks on top of the expected `TS2307 — Cannot find module '../../src/main/project-io.js'`.
- **Fix:** Trimmed the import list to the 3 handlers actually exercised; added an explanatory comment that Plan 03 re-imports the missing two when their dedicated test cases get bodies during GREEN.
- **Files modified:** `tests/main/project-io.spec.ts` (import block re-shaped from 5 names → 3 names + explanatory comment)
- **Commit:** `8ecf968` (folded into Task 3's commit)

## Acceptance Criteria Status

### Task 1 (src/shared/types.ts) — 21/21 pass

All 21 grep checks pass: 7 new types, 4 new SerializableError kinds, 9 new Api members, 1 untouched `loadSkeletonFromFile`, 1 untouched `onExportProgress`, web typecheck exit 0, node typecheck only the pre-existing deferred `scripts/probe-per-anim.ts` TS2339.

### Task 2 (tests/core/project-file.spec.ts) — 9/9 pass

Greps: validator rejects (4), validator accepts (2), documentation slot preserved (1), round-trip relative paths (1), cross-volume falls back to absolute (1), newer version rejected (1), RED import (1), T-08-LAYER (1). vitest exit non-zero with module-not-found.

### Task 3 (tests/main/project-io.spec.ts) — 12/12 pass

Greps: 9 verbatim test names + 2 mock preludes + 1 RED import. vitest exit non-zero with module-not-found.

### Task 4 (tests/renderer/save-load.spec.tsx + tests/arch.spec.ts) — 12/12 pass

Greps for save-load.spec: jsdom prelude + 7 verbatim test names + vi.stubGlobal('api'.
Greps for arch.spec: T-08-LAYER (1), src/core/project-file.ts (3), describe blocks (7).
arch.spec runs: 10/10 pass (was 9/9 — added Phase 8 block as 7th describe). save-load.spec runs: 5 pass + 2 fail (RED — Plan 04 wires Save button + Cmd+S handler).

## Pre-existing Typecheck Warnings (Noted but Not Regressed)

- `scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.` — deferred per `.planning/phases/04-scale-overrides/deferred-items.md` and `.planning/phases/07-atlas-preview-modal/deferred-items.md`. Out of scope for Phase 8.

Post-Phase-8 RED additions to typecheck output (these resolve when Plan 02 + Plan 03 land):

- `tests/core/project-file.spec.ts(13,8): error TS2307: Cannot find module '../../src/core/project-file.js'` — expected RED; Plan 02 lands the module.
- `tests/main/project-io.spec.ts(14,8): error TS2307: Cannot find module '../../src/main/project-io.js'` — expected RED; Plan 03 lands the module.

## Locked Files (Byte-Identical Confirmation)

- `git diff --exit-code scripts/cli.ts` → empty (Phase 5 D-102 lock preserved)
- `git diff --exit-code src/core/sampler.ts` → empty (CLAUDE.md rule #3 lock preserved)

## Test Counts

| Suite | Before (Phase 7 baseline) | After (this plan) | Delta |
|-------|--------------------------|-------------------|-------|
| Total tests pass | 240 | 246 | **+6** (5 new save-load.spec passes + 1 new arch.spec block) |
| Total tests skipped | 1 | 1 | 0 |
| Total tests todo | 1 | 1 | 0 |
| Total tests failed | 0 | 2 | **+2** (RED predictable: Save button + Cmd+S not yet wired by Plan 04) |
| Test files failed | 0 | 3 | **+3** (RED predictable: project-file.spec module-not-found + project-io.spec module-not-found + save-load.spec contains 2 RED tests) |

**Existing green count not regressed.** All 240 prior tests still pass; 6 new tests added that pass today.

## Build Verification

- `npx tsc --noEmit -p tsconfig.web.json` → **exit 0** (clean)
- `npx tsc --noEmit -p tsconfig.node.json` → **only the pre-existing scripts/probe-per-anim.ts TS2339 + 2 expected RED TS2307** (project-file.spec / project-io.spec module-not-found)
- `npx electron-vite build` → **exit 0** (renderer 671 KB JS + 23.48 KB CSS — types.ts changes erase at compile time, no runtime impact)

## Self-Check: PASSED

All 4 commits exist:
- `4731820` feat(08-01): extend src/shared/types.ts with Phase 8 contracts
- `eff13da` test(08-01): RED stubs for src/core/project-file.ts
- `8ecf968` test(08-01): RED stubs for src/main/project-io.ts
- `12bfe3e` test(08-01): RED renderer save-load spec + Phase 8 arch.spec block

All created files exist:
- `tests/core/project-file.spec.ts`
- `tests/main/project-io.spec.ts`
- `tests/renderer/save-load.spec.tsx`

All modified files modified:
- `src/shared/types.ts` (7 new types + 4 new error kinds + 9 new Api members)
- `src/preload/index.ts` (NOT_YET_WIRED helper + 9 stub bridges)
- `tests/arch.spec.ts` (+1 Phase 8 describe block)
