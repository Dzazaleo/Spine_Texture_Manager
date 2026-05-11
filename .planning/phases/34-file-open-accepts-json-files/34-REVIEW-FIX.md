---
phase: 34-file-open-accepts-json-files
fixed_at: 2026-05-11
review_path: .planning/phases/34-file-open-accepts-json-files/34-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
commits:
  - c1b32e4 fix(34): CR-01 case-insensitive suffix checks at load validators
  - 1ab9f87 fix(34): WR-01 + WR-02 surface loading state on menu Open + fix deps array
  - ac12122 fix(34): WR-03 add dontAddToRecent to handleOpenDialog properties
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-05-11
**Source review:** `.planning/phases/34-file-open-accepts-json-files/34-REVIEW.md`
**Iteration:** 1
**Fix scope:** critical_warning (CR-01 + WR-01..04; Info findings excluded)

**Summary:**

| Status | Count |
|---|---|
| Findings in scope | 5 |
| Fixed | 4 (CR-01, WR-01, WR-02, WR-03) |
| Skipped | 1 (WR-04 — wider scope than auto-fix can safely handle) |

Test suite went from 1049 → 1056 passing tests across 95 files (7 new
regression cases added under CR-01; zero existing tests broken; one
test assertion updated under WR-03 to match the new properties array).

---

## Fixed Issues

### CR-01: Picker routes uppercase `.STMPROJ` / `.JSON` correctly but downstream load handlers reject them

**Files modified:**
- `src/main/project-io.ts:367` (handleProjectOpenFromPath)
- `src/main/project-io.ts:700` (handleProjectReloadWithSkeleton — projectPath)
- `src/main/project-io.ts:706` (handleProjectReloadWithSkeleton — newSkeletonPath)
- `src/main/project-io.ts:933` (handleProjectResample)
- `src/main/ipc.ts:425` (handleSkeletonLoad)
- `tests/main/project-io.spec.ts` (4 new regression cases)
- `tests/main/ipc.spec.ts` (3 new regression cases)

**Commit:** `c1b32e4`

**Applied fix:** All four `.endsWith('.stmproj')` / `.endsWith('.json')`
suffix checks at the downstream load validators now lowercase the path
first before the suffix match, matching the picker contract at
`handleOpenDialog` (which already lowercased before routing). End-to-end
flow: a file named `MyRig.STMPROJ` arrives at the picker, routes to
`{ kind: 'project', path: '/abs/MyRig.STMPROJ' }`, dispatches to
`openProjectFromPath`, and reaches the loader chain — no longer
rejected with the generic `kind: 'Unknown'` envelope.

**Regression coverage added:**
- `tests/main/project-io.spec.ts:565-657` — `Phase 34 CR-01` describe
  block with 4 cases:
  - End-to-end: `MyRig.STMPROJ` through picker → `handleProjectOpenFromPath`
    no longer hits the validator (load progresses to fs.readFile, which
    surfaces `ProjectFileNotFoundError` instead of `'absolutePath must
    be a non-empty .stmproj path'`).
  - Direct validator test for `/abs/RIG.STMPROJ` — passes the validator,
    fails downstream with a different kind.
  - Sanity check 1: empty string still rejected at the validator.
  - Sanity check 2: non-`.stmproj` suffix (`/abs/wrong.txt`) still
    rejected at the validator.
- `tests/main/ipc.spec.ts:506-555` — `Phase 34 CR-01` describe block
  with 3 cases:
  - `handleSkeletonLoad('/abs/SKEL.JSON')` progresses past the validator
    (stubbed loader's throw message reaches the caller, not the
    validator's `'Invalid path argument'` string).
  - Sanity check 1: empty string still rejected.
  - Sanity check 2: non-`.json` suffix still rejected.

**Human verification:** UAT item 6 (`MyRig.STMPROJ` opens via File →
Open) — the human-confirmed regression vector that produced this fix.

---

### WR-01: Menu Open does not transition AppState to `loading`

**Files modified:**
- `src/renderer/src/App.tsx` (onMenuOpen + onMenuOpenRecent subscriptions)

**Commit:** `1ab9f87`

**Applied fix:** Insert `handleLoadStart(fileName)` between the
dirty-guard return and the load IPC dispatch in both subscriptions.
This mirrors the drag-drop arms (`onLoadStart` /
`onProjectDropStart` at the AppShell mount in the same file) and
surfaces the existing `Loading {fileName}…` UI hint during the
multi-second sampler window on picker-driven opens.

For `onMenuOpenRecent` I lifted the `fileName` derivation out of the
inline `handleProjectLoad` argument so the `handleLoadStart` call uses
the same value the load handler does (cosmetic, but the pattern
matches `onMenuOpen` directly above it).

---

### WR-02: `handleLoad` and `handleLoadStart` missing from useEffect deps array

**Files modified:**
- `src/renderer/src/App.tsx:415` (deps array on the menu-event useEffect)

**Commit:** `1ab9f87` (bundled with WR-01 — same file, same hunk
region; atomic together because the WR-01 fix introduces the
`handleLoadStart` dependency, so WR-02 has to land in the same commit
to keep the lint invariant clean across history).

**Applied fix:** Add both `handleLoad` and `handleLoadStart` to the
deps array. Both remain `useCallback(..., [])` stable so the bug is
dormant today, but the `react-hooks/exhaustive-deps` invariant
requires them to be declared. Also strengthens robustness if either
becomes state-dependent under future refactors.

---

### WR-03: `handleOpenDialog` picker missing `dontAddToRecent` property

**Files modified:**
- `src/main/project-io.ts:317-321` (handleOpenDialog `properties` array)
- `tests/main/project-io.spec.ts:419` (test assertion updated to match)

**Commit:** `ac12122`

**Applied fix:** Add `'dontAddToRecent'` to the `properties` array in
`handleOpenDialog`, matching the precedent at
`handlePickOutputDirectory` (`src/main/ipc.ts:497`). Prevents File →
Open from polluting the Windows OS-level recent-docs list. No-op on
macOS. The matching unit test at
`tests/main/project-io.spec.ts:407-420` was updated to assert the new
two-element properties array; comment added inline explaining the
mirror-relationship with `handlePickOutputDirectory`.

---

## Skipped Issues

### WR-04: Defense-in-depth fallthrough for unknown suffixes produces a user-hostile error envelope

**File:** `src/main/project-io.ts:334-337`
**Skip reason:** wider scope than auto-fix can safely handle — file as separate task

**Cascade analysis (why this skipped):**

The fix would touch:
- `src/shared/types.ts:1192-1195` — add 4th arm to `OpenDialogResponse`.
- `src/main/project-io.ts:handleOpenDialog` — add `.stmproj` test +
  return `{ kind: 'unsupported', path }` arm.
- `src/renderer/src/App.tsx:339-346` — rewrite the dispatch with
  exhaustive narrowing + add `else if (kind === 'unsupported')` branch.
- `tests/shared/types.spec.ts:259-295` — two assertions that lock the
  "exactly three arms" union shape and a compile-time exhaustive switch
  that misses the new arm.
- `tests/main/project-io.spec.ts:479-489` — defense-in-depth test
  "unknown suffix → `{ kind: 'project' }`" must be inverted to
  "unknown suffix → `{ kind: 'unsupported' }`".
- `tests/main/project-io.spec.ts:532-544` — `34-OPEN-04`
  requirement-named gate with the same assertion (the comment block
  there explicitly cites this as the D-03 contract).

Additionally, the renderer needs **net-new UI surface** to render a
toast/banner explaining "Please pick a .stmproj or .json file." There
is no existing toast/banner mechanism in `App.tsx` to reuse; the
closest precedent is `AppShell.tsx`'s `MissingAttachments` /
`UnusedAssets` alert bars, but those require a mounted `AppShell` and
the unsupported-suffix arm fires from `App.tsx` (which may be in
`idle` or `error` state where AppShell isn't mounted).

This is **design-level UX work**, not a mechanical fix. The current
defense-in-depth behavior (route to `kind: 'project'` and let
`handleProjectOpenFromPath`'s validator surface the typed error) is
**a deliberate D-03 plan decision** and the reviewer flagged it as
"worth flagging as a UX wart" — explicitly not a correctness defect.

**Original issue (preserved verbatim from REVIEW.md):**

> When the picker yields a path with neither `.stmproj` nor `.json`
> suffix (vector: Windows file-name field paste of an arbitrary path),
> the handler defaults to `{ kind: 'project', path }` and lets
> `handleProjectOpenFromPath` reject it. But the rejection message is
> the generic `"absolutePath must be a non-empty .stmproj path"` with
> `kind: 'Unknown'` — same generic envelope as for genuinely unknown
> errors. Users get no signal that their picked-file extension was the
> problem.

**Recommendation:** file as a standalone polish task ("OPEN-UX-01:
typed unsupported-suffix envelope + renderer toast") for a future
phase. The structural change spans 6+ files and adds new UI surface;
auto-fix would either ship a partial fix (type only, no UI) or break
2+ existing tests without good answers.

---

## Verification

**Per-commit verification (Tier 2 syntax check + Tier 1 file re-read
+ full vitest run after each fix):**

| Commit | Verification |
|---|---|
| `c1b32e4` (CR-01) | `npx vitest run tests/main/project-io.spec.ts tests/main/ipc.spec.ts` — 54 passing (29 + 25). Full suite: 1056 passing (up from 1049 — 7 new tests). |
| `1ab9f87` (WR-01 + WR-02) | `npx vitest run tests/renderer/save-load.spec.tsx` — 17 passing. Full suite: 1056 passing. |
| `ac12122` (WR-03) | `npx vitest run tests/main/project-io.spec.ts` — 29 passing (one assertion updated). Full suite: 1056 passing. |

**Final state:** test suite green, 1056 passing / 2 skipped / 2 todo
across 95 files. No regressions introduced. CR-01 is fixed at the
runtime level AND has new regression coverage that would catch a
future revert.

---

_Fixed: 2026-05-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
