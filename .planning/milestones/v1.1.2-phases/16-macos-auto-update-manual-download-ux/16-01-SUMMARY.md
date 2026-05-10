---
phase: 16-macos-auto-update-manual-download-ux
plan: 01
subsystem: ipc-bridge-types
tags: [rename, type-literal, ipc-contract, wave-1]
requires: []
provides:
  - "Variant type literal `'auto-update' | 'manual-download'` at the shared-types + preload boundary"
  - "Foundation for Wave 2 plans (16-03 main, 16-04 IPC, 16-05 renderer) to compile against the renamed contract"
affects:
  - src/shared/types.ts
  - src/preload/index.ts
tech-stack:
  added: []
  patterns: ["string-literal-only rename (CONTEXT.md D-05)"]
key-files:
  created: []
  modified:
    - src/shared/types.ts
    - src/preload/index.ts
decisions:
  - "Renamed `'windows-fallback'` → `'manual-download'` byte-for-byte at every literal site in the two Wave 1 files (3 sites each, 6 total)"
  - "Comment at types.ts line 918 updated alongside the type literal so the rationale text matches the type below it (no orphan literals)"
metrics:
  duration: "~3 minutes (string-literal swap, no logic edits)"
  completed: "2026-04-30T09:33:40Z"
  tasks_completed: 2
  files_modified: 2
  commits: 2
requirements: [UPDFIX-05]
---

# Phase 16 Plan 01: Rename `windows-fallback` → `manual-download` at the shared-types + preload boundary

## One-liner

Foundation Wave 1 task: byte-for-byte string-literal rename of the variant token from `'windows-fallback'` to `'manual-download'` in `src/shared/types.ts` and `src/preload/index.ts`, establishing the renamed IPC contract for Wave 2 to compile against.

## What landed

### Task 1 — `src/shared/types.ts` (commit c7d94c6)

Three sites updated:

| Line | Before | After |
| ---- | ------ | ----- |
| 918  | `// renderer never derives 'auto-update' vs 'windows-fallback' from` | `// renderer never derives 'auto-update' vs 'manual-download' from` |
| 945  | `variant: 'auto-update' \| 'windows-fallback';` (Api.requestPendingUpdate return type) | `variant: 'auto-update' \| 'manual-download';` |
| 963  | `variant?: 'auto-update' \| 'windows-fallback';` (Api.onUpdateAvailable cb payload) | `variant?: 'auto-update' \| 'manual-download';` |

### Task 2 — `src/preload/index.ts` (commit c71c6b7)

Three sites updated:

| Line | Context | Change |
| ---- | ------- | ------ |
| 437  | `requestPendingUpdate` inline return-type payload | `'auto-update' \| 'manual-download'` |
| 459  | `onUpdateAvailable` `cb` parameter inline payload | `'auto-update' \| 'manual-download'` |
| 468  | `onUpdateAvailable` wrapped IPC listener inline payload | `'auto-update' \| 'manual-download'` |

## Grep counts: BEFORE → AFTER

| File | `'windows-fallback'` BEFORE | `'windows-fallback'` AFTER | `'manual-download'` AFTER |
| ---- | --------------------------: | -------------------------: | ------------------------: |
| `src/shared/types.ts`   | 3 (incl. comment) | 0 | 3 |
| `src/preload/index.ts`  | 3 | 0 | 3 |

Plan-level invariant: `grep -rn "'windows-fallback'" src/shared/ src/preload/` returns **0 matches** (verified at end of Task 2).

## Typecheck result

| Project | Result |
| ------- | ------ |
| `tsc --noEmit -p tsconfig.node.json` (typecheck:node) | **PASS** — clean exit |
| `tsc --noEmit -p tsconfig.web.json` (typecheck:web)   | **2 errors** in `src/renderer/src/App.tsx` (lines 363 + 417): `TS2367: comparison appears to be unintentional because the types '"auto-update" \| "manual-download"' and '"windows-fallback"' have no overlap`. **Deferred to Wave 2 plan 16-05** — this is the expected Wave 1 boundary (App.tsx is owned by plan 16-05). |

## Deviations from Plan

### Auto-fixed issues

None — the literal-swap edits landed exactly as specified.

### Acceptance-criterion drift (documented, not fixed)

**Issue:** Task 2's `<verify>` clause and `<acceptance_criteria>` require `npm run typecheck` to exit 0. The plan's `<done>` clause for Task 2 predicted that typecheck would still pass (because TS would allow the existing-but-stale `'windows-fallback'` literals in `main/auto-update.ts` + `renderer/*` to disagree). That prediction was incorrect for `src/renderer/src/App.tsx` specifically: the renderer has *equality comparisons* (`variant === 'windows-fallback'`) against the renamed type — TypeScript flags these as `TS2367` "comparison appears to be unintentional" at compile time, not as runtime test failures.

**Why not auto-fixed (Rule 3 considered):** The plan's `files_modified` frontmatter restricts this plan to two files: `src/shared/types.ts` + `src/preload/index.ts`. `src/renderer/src/App.tsx` is owned by Wave 2 plan 16-05, which runs in a different worktree under the parallel-execution model. Editing `App.tsx` here would conflict with that worktree.

**Resolution:** The plan-level `<verification>` block already acknowledges this: *"Wave 1's contract is type-shape boundary only … those resolve at Wave 4 (Plan 16-06)."* The `typecheck:node` half passes cleanly (proving the renamed contract is internally consistent at the Wave 1 boundary). Full typecheck-green will land naturally when Wave 2 plan 16-05 renames the renderer comparisons. The orchestrator's post-merge validation will exercise this.

**Files NOT modified by this plan but flagged for Wave 2:**
- `src/renderer/src/App.tsx` lines 363 + 417 (still reference `'windows-fallback'`) — owned by plan 16-05
- `src/main/auto-update.ts` — still emits `'windows-fallback'`; owned by plan 16-03
- `src/main/ipc.ts` — owned by plan 16-04
- `src/renderer/src/modals/UpdateDialog.tsx` — owned by plan 16-05
- All five test files listed in CONTEXT.md D-07 — owned by plan 16-06

## Authentication gates

None — this is a string-literal-only rename, no external systems touched.

## Wave 1 invariant satisfied

> The shared variant type literal is `'auto-update' | 'manual-download'` at every site in `src/shared/types.ts`, and the preload bridge surface (`src/preload/index.ts`) carries `'manual-download'` everywhere it previously carried `'windows-fallback'`. The `UpdateAvailablePayload` contract crossing main → preload → renderer uses the renamed variant literal. No `'windows-fallback'` literal survives in either file.

All four bullets from `<must_haves><truths>` validated by grep + line inspection.

## Commits

| Commit  | Task | Description                                                  |
| ------- | ---- | ------------------------------------------------------------ |
| c7d94c6 | 1    | refactor(16-01): rename variant literal in src/shared/types.ts |
| c71c6b7 | 2    | refactor(16-01): rename variant literal in src/preload/index.ts |

## Self-Check

- File `src/shared/types.ts` exists: **FOUND**
- File `src/preload/index.ts` exists: **FOUND**
- Commit `c7d94c6` exists: **FOUND**
- Commit `c71c6b7` exists: **FOUND**
- `grep -c "'windows-fallback'" src/shared/types.ts` returns 0: **PASS**
- `grep -c "'windows-fallback'" src/preload/index.ts` returns 0: **PASS**
- `grep -c "'manual-download'" src/shared/types.ts` ≥ 2: **PASS** (3)
- `grep -c "'manual-download'" src/preload/index.ts` ≥ 3: **PASS** (3)
- `grep -rn "'windows-fallback'" src/shared/ src/preload/`: 0 matches **PASS**
- `npm run typecheck:node`: **PASS**
- `npm run typecheck:web`: 2 errors in App.tsx, **deferred to plan 16-05** as documented above

## Self-Check: PASSED (with documented Wave-1 boundary deferral)
