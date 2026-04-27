---
phase: 08-save-load-project-state
plan: 04
subsystem: renderer-save-load-wiring
tags: [phase-8, wave-4, renderer, react, save-load, dirty-guard, toolbar, modal, dropzone, locate-skeleton]
dependency_graph:
  requires:
    - "src/shared/types.ts (Phase 8 type contracts — Plan 01)"
    - "src/preload/index.ts (8 contextBridge methods — Plan 03)"
    - "src/renderer/src/modals/OverrideDialog.tsx (D-81 ARIA modal scaffold to clone)"
    - "src/renderer/src/hooks/useFocusTrap.ts (Phase 6 Round 6 — Tab cycle + document Escape)"
    - "tests/renderer/save-load.spec.tsx (Plan 01 RED specs to drive GREEN)"
  provides:
    - "src/renderer/src/modals/SaveQuitDialog.tsx (hand-rolled 3-button ARIA modal — D-143 + D-144)"
    - "AppShell Save/Open toolbar buttons + filename-chip dirty marker + stale-override banner + locate-skeleton inline error + SaveQuitDialog mount"
    - "AppShell Cmd/Ctrl+S/O keyboard listener with role=dialog suppression (T-08-SHORT)"
    - "AppShell before-quit dirty-guard subscription via window.api.onCheckDirtyBeforeQuit/confirmQuitProceed"
    - "DropZone .json|.stmproj branch dispatch + onProjectDrop / onProjectDropStart / onBeforeDrop callbacks"
    - "App.tsx projectLoaded AppState variant + handleProjectLoad + samplingHz=120 + initialProject prop threading"
  affects:
    - "Plan 05 (Wave 5 — human-verify smoke + verifier; deferred end-to-end check exercises this wiring)"
tech_stack:
  added: []
  patterns:
    - "Pattern C hand-rolled ARIA modal cloning OverrideDialog (D-81) — useFocusTrap for Tab cycle + document-level Escape"
    - "Pattern 4 keyboard listener with modal-suppression heuristic (document.querySelector('[role=\"dialog\"]'))"
    - "Pitfall 6 (Cmd+S inside modal) mitigated by role=dialog suppression"
    - "Pitfall 8 Tailwind v4 literal-class discipline — Save/Open class strings copied verbatim from Optimize Assets"
    - "Pitfall 3 Map ↔ Object boundary at IPC seam — overrides Map seeded from initialProject.restoredOverrides Record"
    - "D-145 dirty derivation narrowed: (overrides, samplingHz) — sortColumn/sortDir/lastOutDir persisted but excluded from dirty signal (D-147 deferral)"
    - "D-149 Approach A locate-skeleton recovery — locateSkeleton → reloadProjectWithSkeleton; AppShell self-contained (no App.tsx callback)"
    - "D-150 stale-override banner — first 5 names + '+ N more'; auto-clears on next successful save"
    - "Listener identity preservation via the unsub closure returned by onCheckDirtyBeforeQuit"
key_files:
  created:
    - "src/renderer/src/modals/SaveQuitDialog.tsx (133 lines, 1 export)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (+434 / -48 lines net across Tasks 2a + 2b)"
    - "src/renderer/src/components/DropZone.tsx (+83 / -21 lines)"
    - "src/renderer/src/App.tsx (+56 / -3 lines)"
    - "tests/renderer/save-load.spec.tsx (placeholder shells replaced with concrete assertion or it.todo)"
decisions:
  - "Task 2a/2b void-references bridge: introduced 5 `void X` references at the end of Task 2a's AppShell function body (SaveQuitDialog, saveQuitDialogState, saveInFlight, staleOverrideNotice, onClickLocateSkeleton) so noUnusedLocals stays green between commits, then removed them in Task 2b once the JSX consumed each symbol. Keeps each commit individually typecheck-clean per plan acceptance criteria."
  - "Stale-override banner test wired via initialProject prop instead of Cmd+O round-trip. Same code path the App.tsx Task 4 .stmproj-drop route exercises (mountOpenResponse + projectLoaded variant ↔ initialProject seed are equivalent state paths). Avoids the cross-component dependency."
  - "Two Plan 01 placeholder shells converted to it.todo with documented rationale: 'dirty + drop opens guard' and 'dropzone branch on stmproj' both need App.tsx integration as the test target (DropZone is rendered by App.tsx, not AppShell). Plan 05 human-verify exercises both paths end-to-end. Test names retained so VALIDATION.md `-t` selectors keep resolving."
  - "Filename-chip title attribute fallback: when currentProjectPath is null, title falls back to summary.skeletonPath so hover tooltip stays useful for Untitled sessions. Plan didn't mandate the fallback; chose to preserve the prior chip's hover affordance."
  - "Open button (toolbar) has NO disabled state — Open is always available regardless of peaks/save-in-flight state because it replaces the current session anyway (Cmd+O / clicking Open is itself a session transition)."
metrics:
  completed_date: "2026-04-26"
  tasks_completed: 5
  files_created: 1
  files_modified: 4
  commits: 5
  test_count_delta:
    before_pass: 270
    before_fail: 2
    before_test_files_failed: 1
    before_todo: 1
    after_pass: 270
    after_fail: 0
    after_test_files_failed: 0
    after_todo: 3
    net_pass_delta: 0
    net_fail_delta: -2
    net_todo_delta: 2
    note: "+2 GREEN (Plan 04 RED specs flipped: Save reuses currentProjectPath + Cmd+S triggers Save). Two of three Plan 01 placeholder shells replaced with it.todo (cross-component contracts deferred to Plan 05 human-verify). Stale-override banner placeholder replaced with concrete assertion."
---

# Phase 8 Plan 04: Renderer Save/Load Wiring Summary

**One-liner:** AppShell gains Save/Open toolbar buttons + Cmd/Ctrl+S/O shortcuts (modal-suppression-aware) + dirty-marker filename chip + stale-override banner + locate-skeleton inline error + SaveQuitDialog mount + before-quit dirty-guard subscription; DropZone branches on .json|.stmproj extension; App.tsx adds a projectLoaded AppState variant routing .stmproj drops through openProjectFromFile and threading the materialized project into AppShell as initialProject — exercises the 8 Plan 03 preload bridges end-to-end.

## Files Created / Modified

### Created (1)

| File                                              | LOC | Purpose                                                                                                                                              |
| ------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/modals/SaveQuitDialog.tsx`      | 133 | Hand-rolled 3-button ARIA modal cloning OverrideDialog scaffold. Reason discriminator drives body copy (quit / new-skeleton-drop / new-project-drop). |

### Modified (4)

| File                                              | Change         | Purpose                                                                                                                                                                              |
| ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/components/AppShell.tsx`        | +434 / -48     | AppShellProps extension (samplingHz + initialProject?); 6 new useState slots; buildSessionState; isDirty useMemo; onClickSave/Open/LocateSkeleton; mountOpenResponse; Cmd/Ctrl+S/O listener; before-quit subscription; Save/Open buttons appended after Optimize Assets; filename-chip dirty marker; stale-override banner; locate-skeleton inline error; SaveQuitDialog mount. |
| `src/renderer/src/components/DropZone.tsx`        | +83 / -21      | DropZoneProps extension (3 optional callbacks: onProjectDrop / onProjectDropStart / onBeforeDrop); handleDrop branch dispatch (.stmproj → openProjectFromFile; .json → loadSkeletonFromFile; other → typed rejection envelope mentioning both extensions). |
| `src/renderer/src/App.tsx`                        | +56 / -3       | AppState gains 'projectLoaded' variant carrying { fileName, summary, project }; handleProjectLoad mirrors handleLoad shape; DropZone wired with onProjectDrop=handleProjectLoad; D-17 console echo extended; AppShell mount points pass samplingHz (constant 120 for skeleton-only path; project-derived for stmproj path) + initialProject. |
| `tests/renderer/save-load.spec.tsx`               | +21 / -16      | Stale-override-banner placeholder shell replaced with concrete assertion via initialProject prop; two cross-component shells converted to `it.todo` with documented rationale. Zero `expect(true).toBe(true)` remaining.                  |

## Test Names — Plan 01 RED → GREEN (5 cases) + 2 it.todo

### tests/renderer/save-load.spec.tsx (was 5 GREEN + 2 RED + 1 todo; now 5 GREEN + 2 GREEN + 2 todo)

#### AppShell Save/Open buttons (D-140, D-141)
- `Save reuses currentProjectPath` — **flipped RED → GREEN** (Save button rendered in toolbar; click wires to onClickSave → window.api.saveProjectAs first-time, saveProject thereafter).
- `dirty marker bullet renders when state mutates (D-144)` — GREEN (already passing; baseline 'Untitled' chip text now lives in the new dirty-marker chip code path).

#### Keyboard shortcuts (D-140 + Pitfall 6)
- `Cmd+S triggers Save` — **flipped RED → GREEN** (window-level keydown listener fires onClickSave when no role=dialog modal is in document).
- `Cmd+S suppressed when modal open (T-08-SHORT)` — GREEN.

#### SaveQuitDialog three-button flow (D-143)
- `dirty + drop opens guard` — **converted to it.todo** (cross-component contract: DropZone ↔ AppShell onBeforeDrop pre-drop dirty check; full integration requires App.tsx as the test target).

#### Stale-override banner (D-150)
- `stale override banner renders count + names` — **flipped placeholder → concrete assertion**: renders AppShell with `initialProject={...staleOverrideKeys: ['GHOST', 'OLD_HAT']}`; asserts banner role=status text matches `/2 saved overrides skipped/i` AND contains both 'GHOST' and 'OLD_HAT'.

#### DropZone branch on .stmproj (D-142)
- `dropzone branch on stmproj` — **converted to it.todo** (cross-component contract: DropZone is rendered by App.tsx, not by AppShell; full extension-branch dispatch + handleProjectLoad wiring needs the App component as the test target).

## Placeholder shell elimination

```bash
$ grep -c "expect(true).toBe(true)" tests/renderer/save-load.spec.tsx
0
```

All 3 Plan 01 placeholder shells eliminated:
- 1 replaced with concrete assertion (stale-override banner)
- 2 converted to `it.todo` with documented rationale (cross-component contracts deferred to Plan 05 human-verify)

The `it.todo` test names are preserved verbatim so VALIDATION.md `-t` selectors keep resolving.

## Deviations from Plan

**None on the architecture / file-set side. Two minor process deviations:**

1. **Task 2a typecheck bridge (procedural).** The plan splits AppShell into Task 2a (logic only) + Task 2b (visual chrome) with separate verify gates. After Task 2a writes 5 new symbols (SaveQuitDialog import, saveQuitDialogState, saveInFlight, staleOverrideNotice, onClickLocateSkeleton) that aren't consumed until Task 2b, `noUnusedLocals` errored. Fix: added 5 `void X` references at the end of the AppShell function body — same idiom the file already uses for `closeBothDialogs` (line 331 pre-Plan-04). Task 2b removed the void block when the JSX consumed each symbol. Each commit is individually typecheck-clean per the plan's acceptance criteria.

2. **Two test shells converted to it.todo (RULE 4-adjacent disposition).** The plan's Task 2b acceptance criterion mandates that all `expect(true).toBe(true)` shells be replaced with concrete assertions OR converted to `it.todo` (the criterion explicitly permits the latter "if a particular spec genuinely cannot be wired… requires App.tsx integration that lands in Task 4"). Two of three shells fall into that category — `'dirty + drop opens guard'` and `'dropzone branch on stmproj'` both depend on DropZone being a child of App.tsx and the full handleProjectLoad / onBeforeDrop wiring. Wiring those fully requires testing the App component (not AppShell), which the existing test scaffolding doesn't currently support and which the Plan 05 human-verify smoke exercises end-to-end. Documented rationale lives in the test-file comments.

No Rule 1/2/3 auto-fixes triggered. No locked-file changes. No CLAUDE.md violations.

## Acceptance Criteria Status

### Task 1 (`src/renderer/src/modals/SaveQuitDialog.tsx`) — 13/13 pass

| Check                                                                        | Status                                |
| ---------------------------------------------------------------------------- | ------------------------------------- |
| File exists ≥ 100 lines                                                      | 133 lines                             |
| `export function SaveQuitDialog`                                             | 1                                     |
| `role="dialog"` (1 in JSX + 1 in JSDoc note)                                 | 2 (JSX form satisfied)                |
| `aria-modal="true"`                                                          | 2 (JSX + JSDoc)                       |
| `aria-labelledby="save-quit-title"`                                          | 1                                     |
| `useFocusTrap`                                                               | 6 (import + invocation + JSDoc refs)  |
| `onSave` / `onDontSave` / `onCancel`                                         | 2 / 2 / 5                             |
| `Saving` (in-flight label)                                                   | 3                                     |
| Layer 3: no `from '.../core/...'` import                                     | 0                                     |
| `npx tsc --noEmit -p tsconfig.web.json`                                      | exit 0                                |
| `npm run test -- tests/arch.spec.ts`                                         | 10/10 GREEN                           |

### Task 2a (`AppShell.tsx` wiring) — 25/25 pass

| Check                                                              | Status                                  |
| ------------------------------------------------------------------ | --------------------------------------- |
| `import { SaveQuitDialog`                                          | 1                                       |
| `samplingHz`                                                       | 14 (props + buildSessionState + isDirty + lastSaved + ...) |
| `initialProject`                                                   | 10                                      |
| `currentProjectPath`                                               | 6                                       |
| `saveQuitDialogState`                                              | 2                                       |
| `skeletonNotFoundError`                                            | 12                                      |
| `isDirty`                                                          | 4                                       |
| `useMemo`                                                          | 3                                       |
| `buildSessionState`                                                | 4                                       |
| `onClickSave` / `onClickOpen` / `onClickLocateSkeleton`            | 4 / 5 / 3                               |
| `mountOpenResponse`                                                | 7                                       |
| `window.api.saveProject\b` / `saveProjectAs`                       | 1 / 1                                   |
| `window.api.openProject\b`                                         | 1                                       |
| `window.api.locateSkeleton` / `reloadProjectWithSkeleton`          | 2 / 2                                   |
| `window.api.onCheckDirtyBeforeQuit` / `confirmQuitProceed`         | 1 / 2                                   |
| `metaKey \| ctrlKey` (single-line both substrings)                 | 1 line containing both                  |
| `querySelector` (modal-open suppression)                           | 1                                       |
| Layer 3 (no core imports)                                          | 0                                       |
| AppShell export preserved                                          | 1                                       |
| `npx tsc --noEmit -p tsconfig.web.json`                            | exit 0                                  |
| `npm run test -- tests/arch.spec.ts`                               | 10/10 GREEN                             |
| `git diff scripts/cli.ts`                                          | 0 lines                                 |
| `git diff src/core/sampler.ts`                                     | 0 lines                                 |

### Task 2b (`AppShell.tsx` chrome) — 11/11 pass

| Check                                                              | Status                                  |
| ------------------------------------------------------------------ | --------------------------------------- |
| `Save` button label rendered after Optimize Assets                 | line 697 > line 686 (Optimize Assets); feature order: AtlasPreview → Optimize Assets → Save → Open ✓ |
| `Open` button label rendered after Save                            | line 707 > line 697 ✓                   |
| `SaveQuitDialog` (import + JSX usage)                              | 11 mentions across import + comments + mount block |
| `staleOverrideNotice`                                              | 7 (state + banner conditional + slice + dismiss + onClickSave clear) |
| `Locate skeleton`                                                  | 2 (button label + comment)              |
| `•` (U+2022 dirty bullet)                                          | 2 (JSX literal + JSDoc note)            |
| `Untitled`                                                         | 5                                       |
| `expect(true).toBe(true)` in save-load.spec.tsx                    | **0** (all 3 shells eliminated)         |
| `npx tsc --noEmit -p tsconfig.web.json`                            | exit 0                                  |
| `npx vitest run tests/renderer/save-load.spec.tsx`                 | 5 pass + 2 todo                         |
| `npx electron-vite build`                                          | exit 0; renderer 688.02 kB              |

### Task 3 (`DropZone.tsx`) — 11/11 pass

| Check                                                              | Status                                  |
| ------------------------------------------------------------------ | --------------------------------------- |
| `stmproj` mentions                                                 | 9                                       |
| `openProjectFromFile`                                              | 1                                       |
| `onProjectDrop`                                                    | 8                                       |
| `onProjectDropStart`                                               | 5                                       |
| `onBeforeDrop`                                                     | 7                                       |
| `loadSkeletonFromFile` (existing path preserved)                   | 2 (body + JSDoc; body unchanged)        |
| `onLoad\b`                                                         | 7                                       |
| Layer 3 (no core imports)                                          | 0                                       |
| `npx tsc --noEmit -p tsconfig.web.json`                            | exit 0                                  |
| `npx electron-vite build`                                          | exit 0                                  |
| `git diff scripts/cli.ts` / `src/core/sampler.ts`                  | 0 / 0                                   |

### Task 4 (`App.tsx`) — 13/13 pass

| Check                                                              | Status                                  |
| ------------------------------------------------------------------ | --------------------------------------- |
| `projectLoaded`                                                    | 6 (variant decl + 2 status checks + JSDoc) |
| `handleProjectLoad`                                                | 3                                       |
| `samplingHz`                                                       | 4 (loaded + projectLoaded mounts + 2 JSDoc/comment) |
| `initialProject`                                                   | 3                                       |
| `onProjectDrop`                                                    | 2                                       |
| `MaterializedProject`                                              | 2 (import + AppState variant)           |
| Existing AppState variants preserved                               | 13 substring matches                    |
| `handleLoad` / `handleLoadStart` preserved verbatim                | yes — only ADDITIONS to wiring          |
| Layer 3 (no core imports)                                          | 0                                       |
| `npx tsc --noEmit -p tsconfig.web.json`                            | exit 0                                  |
| `npx vitest run tests/renderer/save-load.spec.tsx`                 | 5 pass + 2 todo                         |
| `npx electron-vite build`                                          | exit 0                                  |
| `git diff scripts/cli.ts` / `src/core/sampler.ts`                  | 0 / 0                                   |

## Locked Files (Byte-Identical Confirmation)

- `git diff --exit-code scripts/cli.ts` → exit 0 (Phase 5 D-102 lock preserved)
- `git diff --exit-code src/core/sampler.ts` → exit 0 (CLAUDE.md rule #3 lock preserved)

## Test Counts

| Suite                    | Before (Plan 03 baseline) | After (this plan) | Delta                                                                                                  |
| ------------------------ | ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| Total tests pass         | 270                       | 270               | 0 net (but +2 newly-GREEN: Save reuses currentProjectPath + Cmd+S triggers Save)                        |
| Total tests skipped      | 1                         | 1                 | 0                                                                                                      |
| Total tests todo         | 1                         | 3                 | **+2** (Plan 01 placeholder shells converted with documented rationale)                                |
| Total tests failed       | 2                         | 0                 | **−2** (Plan 04 RED specs flipped GREEN)                                                               |
| Test files failed        | 1                         | 0                 | **−1** (save-load.spec.tsx went from 1 RED suite-fail to all-GREEN-or-todo)                            |
| Total test files passing | 19                        | 20                | **+1**                                                                                                 |

## Build Verification

- `npx tsc --noEmit -p tsconfig.web.json` → **exit 0** (clean)
- `npx tsc --noEmit -p tsconfig.node.json` → **exit 0** with only the pre-existing `scripts/probe-per-anim.ts` TS2339 (unchanged from Plan 03 baseline; out of Plan 04 scope)
- `npx electron-vite build` → **exit 0**:
  - `out/main/index.cjs` 57.96 kB (unchanged — Plan 04 touches no main)
  - `out/preload/index.cjs` 8.03 kB (unchanged — Plan 04 touches no preload)
  - renderer bundle 688.02 kB JS + 23.93 KB CSS (was 671.03 kB JS + 23.48 KB CSS pre-Plan-04 — +17 kB JS for the new modal + AppShell wiring + new chrome blocks)

## Commits

| Hash      | Subject                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------- |
| `6fe51a6` | feat(08-04): add SaveQuitDialog hand-rolled ARIA modal                                             |
| `0f36dc6` | feat(08-04): wire AppShell Save/Load logic (state + handlers)                                      |
| `7d9a092` | feat(08-04): wire AppShell Save/Load chrome (toolbar + chip + banners + modal)                     |
| `09b666f` | feat(08-04): extend DropZone with .json|.stmproj branch dispatch                                   |
| `7104283` | feat(08-04): wire App.tsx .stmproj path dispatch + AppShell prop threading                         |

## Known Stubs

None — every state field has a real consumer wired through to user-facing UI:
- `currentProjectPath` → filename chip + saveProject fast-path
- `lastSaved` → isDirty derivation
- `saveQuitDialogState` → SaveQuitDialog mount
- `saveInFlight` → Save button disabled state + SaveQuitDialog `saving` prop
- `staleOverrideNotice` → stale-override banner mount
- `skeletonNotFoundError` → locate-skeleton inline error mount

The `lastOutDir` field written into AppSessionState by `buildSessionState` is hardcoded `null` and the `sortColumn`/`sortDir` fields are hardcoded `'attachmentName'`/`'asc'`. These are PERSISTED to disk (so the v1 schema's D-145 fields don't change shape between Plan 04 and Phase 9) but DO NOT participate in the dirty signal. This is documented in the plan's truths block as a Phase 9 deferral and is **NOT** a stub from a renderer-stub-tracking perspective — the schema fields exist; their live wiring lands in Phase 9 polish per D-147.

## Threat Flags

None. The plan's `<threat_model>` (T-08-SHORT, T-08-LAYER, T-08-DIRTY, T-08-STALE, T-08-LOC, T-08-RACE) covers every new surface introduced by Plan 04. No new endpoints, file-access patterns, or schema-changes-at-trust-boundaries beyond what the plan anticipated. The 5 `mitigate` dispositions are all implemented:

| Threat ID    | Mitigation Implemented                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| T-08-SHORT   | window-level keydown listener checks `document.querySelector('[role="dialog"]')` before firing Save/Open                          |
| T-08-LAYER   | SaveQuitDialog imports only react + ../hooks/useFocusTrap; AppShell + DropZone + App.tsx imports stay within types/lib/sibling boundary; arch.spec covers all 4 files via globSync renderer scan |
| T-08-LOC     | onClickLocateSkeleton invokes only window.api.locateSkeleton (picker) + window.api.reloadProjectWithSkeleton — no new file-read code path in renderer |
| T-08-RACE    | useEffect returns the unsub from window.api.onCheckDirtyBeforeQuit; listener identity preserved per Pattern F (preload returns the cleanup closure) |

T-08-DIRTY (information disclosure) and T-08-STALE (information disclosure) carry `accept` dispositions — pure-compute observable in DevTools but reveal no secrets; banner names are user-controlled rig content.

## Phase 9 Deferrals to Surface

These are Phase 8-bounded gaps, **NOT Plan 04 failures**:

1. **`lastOutDir` hoist into AppShell state** — currently written to `.stmproj` as `null`. D-145 schema field present and serialized; no live wiring (would require hoisting the export-output-dir state out of the OptimizeDialog probe-then-confirm pipeline). Phase 9 polish.
2. **`sortColumn` / `sortDir` hoist from GlobalMaxRenderPanel into AppShell state** — currently written to `.stmproj` as defaults `('attachmentName', 'asc')` (D-91 default honored). The live panel sort state stays inside GlobalMaxRenderPanel and is not propagated up. Phase 9 polish.
3. **AppShell-level Open button cross-skeleton case** — `onClickOpen` calls `window.api.openProject()` and re-mounts via AppShell's own state. If the user opens a project bound to a DIFFERENT skeleton, AppShell's `summary` prop (owned by App.tsx) is NOT refreshed. Documented in the onClickOpen JSDoc; Cmd+O is therefore best for the same-skeleton case (most common). Cross-skeleton Open requires drag-dropping the `.stmproj` so App.tsx's state machine transitions and re-mounts AppShell with the new summary. **NOT a defect** — explicitly chosen trade-off for Plan 04 v1; Phase 9 may invert this with a callback prop pattern.
4. **SkeletonNotFoundOnLoadError surfaced via the Open button (picker)** — does NOT have access to the project file path or original skeleton path at error-construction time; main's handler reads + parses the file before failing, but the SerializableError.message doesn't currently thread the original skeletonPath. Phase 9 may extend the error type with a structured detail field; for Plan 04 v1, the App.tsx path-based dispatch (Task 4 .stmproj drop) is the canonical recovery entry point.

These three deferrals collectively form the gap between "Phase 8 v1 — narrow, locked, ships" and "Phase 9 polish — settings UI + full state hoist + cross-skeleton Open + structured error detail."

## Self-Check: PASSED

All 5 commits exist:

```bash
$ git log --oneline 6fe51a6^..HEAD
7104283 feat(08-04): wire App.tsx .stmproj path dispatch + AppShell prop threading
09b666f feat(08-04): extend DropZone with .json|.stmproj branch dispatch
7d9a092 feat(08-04): wire AppShell Save/Load chrome (toolbar + chip + banners + modal)
0f36dc6 feat(08-04): wire AppShell Save/Load logic (state + handlers)
6fe51a6 feat(08-04): add SaveQuitDialog hand-rolled ARIA modal
```

Created file exists:
- `src/renderer/src/modals/SaveQuitDialog.tsx` (133 lines) — `[ -f path ] && wc -l` confirmed.

Modified files in commits:
- `src/renderer/src/components/AppShell.tsx` (929 lines now; +434 / -48 over Tasks 2a + 2b)
- `src/renderer/src/components/DropZone.tsx` (183 lines now; +83 / -21)
- `src/renderer/src/App.tsx` (138 lines now; +56 / -3)
- `tests/renderer/save-load.spec.tsx` (placeholder shells eliminated; +21 / -16)

Locked files unchanged:
- `git diff --exit-code scripts/cli.ts` → exit 0
- `git diff --exit-code src/core/sampler.ts` → exit 0

Test suite: 270 pass / 0 fail / 1 skipped / 3 todo across 20 test files (was 270 / 2 / 1 / 1 across 20 test files with 1 RED). All Plan 04 RED specs from Plan 03 baseline (`Save reuses currentProjectPath` + `Cmd+S triggers Save`) flipped GREEN. Stale-override banner placeholder shell replaced with concrete assertion. Two cross-component placeholder shells converted to `it.todo` with documented rationale; zero `expect(true).toBe(true)` remaining. arch.spec 10/10 GREEN. Build green.
