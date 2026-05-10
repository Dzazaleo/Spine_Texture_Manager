---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 08
subsystem: renderer + integration-tests
tags: [renderer, ui-toggle, integration-test, round-trip, load-04, load-01, partial]
status: partial-complete-checkpoint-pending

# Dependency graph
requires:
  - phase: 21
    plan: 03
    provides: fixtures/SIMPLE_PROJECT_NO_ATLAS/ golden fixture (JSON + per-region PNGs, no .atlas)
  - phase: 21
    plan: 06
    provides: loadSkeleton 4-way branch (D-05/D-06/D-07/D-08) — atlas-less synthesis fall-through
  - phase: 21
    plan: 07
    provides: loaderMode field on ProjectFileV1 + AppSessionState + ResampleArgs + MaterializedProject (CONCURRENT — types not yet in this branch)
provides:
  - "tests/core/loader-atlas-less.spec.ts — 5 passing integration tests covering D-05/D-08/D-10/success-criterion-#5/INV-9"
  - "LOAD-04 closure — round-trip load → sample → analyze → buildExportPlan against atlas-less fixture, plan.rows.length > 0, sourcePath references SIMPLE_PROJECT_NO_ATLAS PNGs"
  - "AppShell.tsx loaderMode plumbing — 5 sites (state slot, buildSessionState, mountOpenResponse, resampleProject IPC, UI checkbox) following Phase 20 documentation field precedent"
  - "User-visible checkbox 'Use Images Folder as Source' wired to setLoaderMode; toggling triggers a resample"
affects:
  - "Phase 21 final wave merge — once 21-07 + 21-08 worktrees merge, typecheck passes (loaderMode field on types resolves my 4 type errors)"
  - "Plan 21 HUMAN-UAT checkpoint — pending user verification of drag-drop atlas-less + Save/Reopen round-trip + toggle visual"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 20 documentation-field plumbing precedent applied to loaderMode (lazy-init slot → buildSessionState → mountOpenResponse → resampleProject IPC payload + dependency array)"
    - "Inline UI checkbox in toolbar cluster (CONTEXT.md D-08 — binary toggle, NOT modal); Tailwind classes mirror text-muted toolbar conventions"
    - "Round-trip integration test mirrors tests/core/export.spec.ts:42-69 canonical pipeline (load → sampleSkeleton → analyze → findUnusedAttachments → buildExportPlan); pure-TS in-process (vitest can't spawn Workers)"
    - "Forward-compatible type access: code references `initialProject.loaderMode` / `loaderMode` on AppSessionState etc. that are added by concurrent Plan 21-07; on this isolated branch typecheck reports 4 errors that resolve post-merge"

key-files:
  created:
    - "tests/core/loader-atlas-less.spec.ts (173 lines, 5 passing tests)"
    - ".planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-08-renderer-roundtrip-SUMMARY.md (this file)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (5 plumbing sites + UI checkbox; +70/-6 LoC)"

key-decisions:
  - "[Rule 1 — Bug] Plan asserted sourceDims.size>=4 for SIMPLE_PROJECT_NO_ATLAS; actual unique-region count is 3 (SQUARE2 attachment reuses SQUARE region, so sourceDims keys off region names is 3). Fixed assertion to `>=3` matching Plan 21-06 SUMMARY's documented contract."
  - "[Rule 1 — Bug] Plan asserted D-10 catastrophic case via plain `loadSkeleton(skelPath)` with no images/. Plan 21-06's malformed-project guard (loader.ts:289-307) intentionally throws AtlasNotFoundError VERBATIM in that branch (preserves ROADMAP success criterion #5). To exercise MissingImagesDirError end-to-end, the test now uses `loaderMode: 'atlas-less'` override which bypasses the guard and reaches synthesizeAtlasText's MissingImagesDirError throw at synthetic-atlas.ts:96-101."
  - "Forward-compatible type access on loaderMode field: AppShell.tsx accesses `initialProject.loaderMode`, sets `loaderMode` in AppSessionState, and includes `loaderMode` in ResampleArgs IPC payload. These types gain the field in concurrent Plan 21-07 (different worktree). On this branch, typecheck reports 4 errors; they resolve post-merge. Per parallel_execution discipline, types.ts is out-of-scope for this branch."
  - "UI checkbox placed inline with right-aligned toolbar cluster (after SearchBar, before Atlas Preview). Label 'Use Images Folder as Source' is locked verbatim per CONTEXT.md D-08. Tailwind classes use `text-xs text-fg-muted` to differentiate from action buttons."

# Execution metrics
metrics:
  duration: ~7 minutes (449 seconds; tasks 1+2 only — checkpoint blocks task 3)
  tests-added: 5
  tests-passing: 5/5 (no .skip)
  tasks-completed: 2/3 (Task 3 = HUMAN-UAT checkpoint)
  files-created: 2
  files-modified: 1
  completed: 2026-05-01 (partial — UAT pending)
---

# Phase 21 Plan 08: Atlas-less renderer toggle + round-trip integration (PARTIAL — Checkpoint Pending)

## One-liner

Atlas-less mode lands the user-visible loaderMode toggle in AppShell.tsx (5 plumbing sites following Phase 20 documentation precedent) and the LOAD-04-closing round-trip integration test (5 passing tests in `tests/core/loader-atlas-less.spec.ts`). Task 3 is a HUMAN-UAT checkpoint awaiting user verification.

## Tasks Completed

| Task | Status   | Commit  | What                                                                                              |
| ---- | -------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1    | DONE     | 272d8f1 | tests/core/loader-atlas-less.spec.ts — 5 integration tests (D-05/D-08/D-10/criterion-#5/INV-9)    |
| 2    | DONE     | 39b72bb | AppShell.tsx — loaderMode plumbing (state slot, buildSessionState, mountOpenResponse, IPC, UI)    |
| 3    | PENDING  | -       | HUMAN-UAT checkpoint: drag-drop, Save/Reopen, toggle visual — awaits user verification            |

## Test Outcomes

`npx vitest run tests/core/loader-atlas-less.spec.ts` — 5 passing, 0 failed, 0 skipped:

- **D-05 + INV-8** (`load returns LoadResult with atlasPath: null and sourceDims source: "png-header"`) — fall-through synthesis path verified end-to-end
- **D-10 catastrophic** (`loaderMode: "atlas-less" override on tmpdir with JSON only throws MissingImagesDirError end-to-end`) — bypasses Plan 21-06's malformed-project guard to reach synthesizeAtlasText
- **D-08** (`explicit loaderMode: "atlas-less" opt is byte-equivalent to fall-through`) — override path produces same LoadResult as auto-detected atlas-less
- **Success criterion #5** (`explicit opts.atlasPath unreadable STILL throws AtlasNotFoundError verbatim`) — regression test locks "Spine projects require an .atlas file beside the .json" message
- **INV-9** (`round-trip load → sample → analyze → buildExportPlan produces non-empty plan with fixture PNG paths`) — **LOAD-04 closure** — `plan.rows.length > 0`, every row's `sourcePath` ends with `.png` and contains `SIMPLE_PROJECT_NO_ATLAS`

## ROADMAP Success Criteria Coverage

- **#1 (loader routes through synthesized atlas; panels populate)**: Plan 21-06's loader work + Plan 21-08 Test 1 (sourceDims provenance check). UI half awaits HUMAN-UAT (Task 3).
- **#2 (sourceDims `source === 'png-header'`)**: Plan 21-08 Test 1 verifies for every region.
- **#3 (LoadResult.atlasPath === null)**: Plan 21-08 Test 1 + Test 3.
- **#4 (atlas-less round-trip — load → sample → buildExportPlan)**: Plan 21-08 Test 5 (INV-9). **LOAD-04 closed**.
- **#5 (AtlasNotFoundError verbatim message preserved)**: Plan 21-08 Test 4 — explicit unreadable atlasPath path locks the verbatim message; Plan 21-06's malformed-project guard locks the no-atlas-no-images path.

## AppShell.tsx Plumbing Sites

1. **State slot** (~line 272): `useState<'auto' | 'atlas-less'>(() => initialProject?.loaderMode ?? 'auto')` — mirrors Phase 20 documentation slot pattern immediately above.
2. **buildSessionState** (~line 651): includes `loaderMode` field; dependency array gains `loaderMode`.
3. **mountOpenResponse** (~line 826): `setLoaderMode(project.loaderMode ?? 'auto')` — restores from materialized project.
4. **resampleProject IPC payload** (~line 1099): includes `loaderMode` so main re-runs `loadSkeleton(skeletonPath, { atlasPath, loaderMode })` through the correct branch.
5. **UI checkbox**: inline with toolbar cluster (after SearchBar, before Atlas Preview); label "Use Images Folder as Source"; toggling between `'auto'` and `'atlas-less'` triggers a resample via the `loaderMode` dependency in the resample useEffect.

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — Bug fixes)

**1. [Rule 1] Plan asserted `sourceDims.size>=4`; actual unique-region count is 3**
- **Found during:** Task 1 (test execution)
- **Issue:** SIMPLE_PROJECT_NO_ATLAS has 4 attachments (CIRCLE, SQUARE, SQUARE2, TRIANGLE) but only 3 unique regions — SQUARE2 attachment references SQUARE region. `sourceDims` keys off region names (verified by Plan 21-06 SUMMARY's "≥3 entries" specification).
- **Fix:** Updated assertion from `>= 4` to `>= 3` with comment explaining the SQUARE2-reuses-SQUARE pattern.
- **Files modified:** tests/core/loader-atlas-less.spec.ts
- **Commit:** 272d8f1

**2. [Rule 1] D-10 catastrophic test direction conflicts with Plan 21-06's malformed-project guard**
- **Found during:** Task 1 (test execution)
- **Issue:** Plan asserted `loadSkeleton(skelPath)` on JSON-only tmpdir throws `MissingImagesDirError`. Plan 21-06's malformed-project guard (loader.ts:289-307) intentionally throws `AtlasNotFoundError` VERBATIM in this branch (preserves ROADMAP success criterion #5; pre-existing F1.4 tests depend on this contract).
- **Fix:** Test now passes `loaderMode: 'atlas-less'` to bypass the guard. The synthesis branch (loader.ts:236) runs unconditionally with the override and reaches `synthesizeAtlasText`'s `MissingImagesDirError` throw at synthetic-atlas.ts:96-101.
- **Files modified:** tests/core/loader-atlas-less.spec.ts
- **Commit:** 272d8f1

### Out-of-scope (deferred)

- **Pre-existing typecheck warnings** (`onQueryChange unused` in `AnimationBreakdownPanel.tsx:286` and `GlobalMaxRenderPanel.tsx:531`) — already in `deferred-items.md`. Not addressed.

### Type errors blocked on concurrent worktree (NOT a deviation; expected)

- AppShell.tsx introduces 4 typecheck errors all referencing `loaderMode` on types defined in `src/shared/types.ts` (`MaterializedProject`, `AppSessionState`, `ResampleArgs`). Plan 21-07 (concurrent worktree) adds these fields. The orchestrator merges both branches; typecheck passes post-merge. Per `<parallel_execution>` discipline, `types.ts` is out-of-scope for this branch.

## HUMAN-UAT Checkpoint (Task 3) — Pending

**This plan is partial-complete.** Task 3 is a `checkpoint:human-verify` gate that requires the user to run the dev app (`npm run dev`) and verify:

1. **LOAD-01 drag-drop**: drag `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` onto the app — Global + Animation Breakdown panels populate with rows whose dims match PNG headers (no AtlasNotFoundError modal).
2. **D-08 toggle visible + functional**: checkbox "Use Images Folder as Source" appears in the toolbar; clicking it triggers a resample.
3. **Save/Reopen round-trip**: toggle survives Save → Reopen on `.stmproj` (depends on Plan 21-07's persistence — must be merged first).
4. **Catastrophic case**: drop a JSON-only tmpdir — error dialog mentions images / atlas-less (not "Unknown error").
5. **Criterion #5 regression**: explicit unreadable atlasPath via .stmproj surfaces "Spine projects require an .atlas file beside the .json".

Tests 3, 4, 5 require Plan 21-07 to land first (otherwise `loaderMode` doesn't round-trip via .stmproj and the catastrophic case can't construct a malformed `.stmproj`). Suggest the orchestrator merges 21-07 + 21-08 to main BEFORE the human runs UAT, so all 5 tests can be exercised.

## Self-Check: PASSED

- File `tests/core/loader-atlas-less.spec.ts` exists.
- Commit `272d8f1` exists in git log.
- File `src/renderer/src/components/AppShell.tsx` modified.
- Commit `39b72bb` exists in git log.
- All 5 tests in `tests/core/loader-atlas-less.spec.ts` pass via `npx vitest run`.
- 5 acceptance criteria for Task 2 grep checks all PASS.

## Threat Flags

None — no new security-relevant surface introduced. The renderer checkbox writes to a string-literal-typed React state slot (T-21-08-02 accepted in plan threat register); IPC payload remains structured-clone-safe (`'auto' | 'atlas-less'` literal). Race-condition + DoS concerns (T-21-08-01 + T-21-08-03) inherited from existing AppShell resample guard pattern.
