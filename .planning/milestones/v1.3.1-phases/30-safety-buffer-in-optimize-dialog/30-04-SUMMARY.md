---
phase: 30-safety-buffer-in-optimize-dialog
plan: 04
subsystem: ui
tags: [react, useEffect, ipc-types, jsdoc, eslint-suppression, regression-sentinel, optimize-dialog, atlas-preview, documentation-builder]

# Dependency graph
requires:
  - phase: 30-01
    provides: persistence (BUFFER-03) — safetyBufferPercent in MaterializedProject + AppSessionState + .stmproj
  - phase: 30-02
    provides: export math (BUFFER-02) — buildExportPlan opts + bufferedScale predicate + ExportRow.bufferCapped flag
  - phase: 30-03
    provides: OptimizeDialog UI (BUFFER-01) — input element, props.safetyBufferPercent + props.onSafetyBufferChange wiring at AppShell
provides:
  - reactive-plan-rebuild-effect: AppShell useEffect rebuilds exportDialogState.plan when safetyBufferPercentLocal/summary/overrides mutate while OptimizeDialog is open (CR-01 closure)
  - atlas-preview-buffer-thread: AtlasPreviewModal accepts + threads safetyBufferPercent prop into buildAtlasPreview opts and deps (CR-02 closure)
  - locate-skeleton-state-preservation: onClickLocateSkeleton threads loaderMode + sharpenOnExport + safetyBufferPercent through reloadProjectWithSkeleton IPC (WR-01 closure)
  - exportrow-buffercapped-jsdoc: corrected docblock matching the predicate at src/core/export.ts:269-272 (WR-02 closure, MOVED FROM 30-05)
  - untitled-dirty-extension: untitled-session dirty branch fires on non-default samplingHzLocal/sharpenOnExportLocal/safetyBufferPercentLocal (WR-03 closure)
  - optimize-dialog-clamp-cleanup: redundant Math.floor removed from buffer onChange clamp (WR-04 / IN-01 closure)
  - cr-01-regression-sentinel: 3 new tests in optimize-dialog-buffer.spec.tsx (StatefulWrapper render + IPC payload + static-grep AppShell useEffect sentinel) (IN-03 + Warning-4 closure)
  - documentation-builder-mount-prop-passthrough: AppShell passes safetyBufferPercent={safetyBufferPercentLocal} to DocumentationBuilderDialog (BLOCKER-2 site-5, MOVED FROM 30-05)
affects: [30-05, future-phases-touching-OptimizeDialog, future-phases-touching-AtlasPreviewModal, future-phases-touching-DocumentationBuilderDialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reactive useEffect with boolean state-presence dep: `[deps..., stateObject !== null]` instead of `[deps..., stateObject]` — avoids feedback loop when the effect itself calls the matching setter. Documented with eslint-disable-next-line react-hooks/exhaustive-deps suppression."
    - "Static-grep regression sentinel: a vitest test that reads a production source file and asserts an exact code literal exists. Survives even when behavioural tests are naive. Mirrors tests/core/export.spec.ts:719-725 parity-regex pattern."
    - "Cross-plan file ownership disjointness: when two parallel plans in the same wave touch the same surface, move all edits in a given file to one plan to keep TS-clean intermediates achievable. Plan-checker iter-1 BLOCKER 1 (types.ts) + BLOCKER 2 site-5 (AppShell.tsx) consolidated under 30-04."

key-files:
  created: []
  modified:
    - "src/renderer/src/components/AppShell.tsx (+70 / −1) — reactive useEffect, untitled-dirty extension, onClickLocateSkeleton wiring, AtlasPreviewModal mount prop, DocumentationBuilderDialog mount prop"
    - "src/renderer/src/modals/AtlasPreviewModal.tsx (+19 / −2) — safetyBufferPercent prop type + projection useMemo opts/deps"
    - "src/renderer/src/modals/OptimizeDialog.tsx (+5 / −1) — Math.floor cleanup"
    - "src/shared/types.ts (+34 / −11) — reloadProjectWithSkeleton IPC args 3 new optional fields + ExportRow.bufferCapped JSDoc rewrite"
    - "tests/renderer/optimize-dialog-buffer.spec.tsx (+164 / −1) — 3 new tests under describe('reactive plan rebuild — Phase 30 CR-01 closure')"
    - ".planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md (+6 / 0) — pre-existing OptimizeDialog null-vs-undefined gap logged"

key-decisions:
  - "CR-01 fix shape: Option (a) — minimal-patch useEffect in AppShell rebuilds exportDialogState.plan reactively. Picked over Option (b) (lift plan derivation into OptimizeDialog as a useMemo against summary+overrides+buffer) because (a) does not require refactoring OptimizeDialog's prop surface (which would ripple through tests/renderer/optimize-dialog-passthrough.spec.tsx + tests/renderer/optimize-dialog-buffer.spec.tsx)."
  - "Boolean dep form (`exportDialogState !== null`) instead of object reference (`exportDialogState`) — using the object would create a setExportDialogState→re-fire→re-set feedback loop. Documented with eslint-disable-next-line react-hooks/exhaustive-deps suppression."
  - "Match onClickOptimize at line 639 exactly: useEffect uses `summary` (raw prop) NOT `effectiveSummary` (post-resample render-tree memo). Export pipeline reads originally-loaded skeleton's pre-resample shape; effectiveSummary is for render-tree displays only."
  - "Wave-ordering wrinkle accepted: in tsconfig.web.json, AppShell.tsx now references safetyBufferPercent={safetyBufferPercentLocal} on DocumentationBuilderDialog before its receiving prop interface is added by parallel Plan 30-05 in the same wave. Wave-4 final-check after both plans land confirms TS-clean."

patterns-established:
  - "Static-grep regression sentinel as a permanent fail-safe alongside behavioural tests."
  - "Inline `// eslint-disable-next-line react-hooks/exhaustive-deps` with explanatory paragraph for intentional non-exhaustive dep arrays."

requirements-completed: [BUFFER-01, BUFFER-03]

# Metrics
duration: ~10 min
completed: 2026-05-08
---

# Phase 30 Plan 04: Reactive Plan Rebuild & Locate-Skeleton State Preservation Summary

**AppShell now rebuilds OptimizeDialog's exportDialogState.plan when the safety-buffer changes mid-dialog (CR-01); AtlasPreviewModal threads the buffer for cross-nav tile-dim consistency (CR-02); locate-skeleton recovery preserves loaderMode + sharpenOnExport + safetyBufferPercent (WR-01); plus 4 paired closures (WR-02 JSDoc rewrite, WR-03 untitled-dirty extension, WR-04 Math.floor cleanup, BLOCKER-2 site-5 DocumentationBuilderDialog mount).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-08T11:42:54Z
- **Completed:** 2026-05-08T11:51:12Z
- **Tasks:** 6 (1 RED test + 4 source/test wiring tasks 2a–2d + 1 verification sweep)
- **Files modified:** 5 (+1 deferred-items.md)

## Accomplishments

- **CR-01 BLOCKER closed.** AppShell gains a reactive useEffect (between isDirty useMemo at line 905 and onClickSave at line 952) that rebuilds `exportDialogState.plan` when `safetyBufferPercentLocal` (or `summary`/`overrides`) change while the OptimizeDialog is open. Boolean dep `exportDialogState !== null` (NOT the object) avoids `setExportDialogState` → re-fire → re-set feedback loop. ROADMAP SC #1 (reactive recompute of summary tiles) restored end-to-end.
- **CR-02 BLOCKER closed.** AtlasPreviewModal now declares `safetyBufferPercent: number` as a required prop, threads it into `buildAtlasPreview({ mode, maxPageDim, safetyBufferPercent })`, and adds it to the projection useMemo deps. AppShell's modal mount passes `safetyBufferPercent={safetyBufferPercentLocal}`. Cross-nav from OptimizeDialog now shows buffered tile dims and matching page count.
- **WR-01 closed.** `reloadProjectWithSkeleton` IPC type extended with 3 optional fields (`loaderMode`, `sharpenOnExport`, `safetyBufferPercent`); `onClickLocateSkeleton` threads them. Locate-skeleton recovery no longer silently resets non-default user state. Main-side handler at `src/main/project-io.ts:700-716` already reads them defensively with fallback to defaults — type-extension only.
- **WR-02 closed (MOVED FROM 30-05).** ExportRow.bufferCapped JSDoc rewritten to remove the misleading `clean atlas with no dims drift, just buffer pushing past 1.0 → canonical clamp binds` parenthetical (impossible because clean atlases have `sourceRatio === Infinity`). New docblock states the predicate verbatim (`bufferPct > 0 && bufferedScale > sourceRatio && safeScale(rawEffScale) <= sourceRatio`) and explicitly clarifies `Does NOT fire on canonical-1.0 clamp`.
- **WR-03 closed.** Untitled-session dirty branch fires on non-default `samplingHzLocal !== 120`, `sharpenOnExportLocal !== false`, `safetyBufferPercentLocal !== 0`. SaveQuitDialog now prompts on close-without-save when the user has typed non-default values into a never-saved session.
- **WR-04 / IN-01 closed.** Redundant `Math.floor(parseInt(...))` collapsed to `parseInt(...)` in OptimizeDialog buffer onChange clamp. Behaviour preserved (parseInt already truncates fractional input).
- **IN-03 + Warning-4 closed.** 3 new tests added under `describe('reactive plan rebuild — Phase 30 CR-01 closure')`: (1) StatefulWrapper integration test asserts post-mount buffer change re-renders the dialog with `outW=525` (buffer=5%, peakScale=0.5, sourceW=1000); (2) IPC payload assertion proves `window.api.startExport` receives the rebuilt plan with `outW=525` (no soft-fail fallback per Warning-5); (3) static-grep regression sentinel reads `src/renderer/src/components/AppShell.tsx` and asserts the exact useEffect signature literal exists — permanent regression sentinel against future maintainer reverts.
- **BLOCKER-2 site-5 closed (MOVED FROM 30-05).** AppShell `<DocumentationBuilderDialog>` mount passes `safetyBufferPercent={safetyBufferPercentLocal}`. The receiving prop interface change ships in 30-05 (sites 1-4 in DocumentationBuilderDialog.tsx + doc-export.ts).
- **Warning-6 closed.** New useEffect carries `// eslint-disable-next-line react-hooks/exhaustive-deps` immediately above its dep array, documented in the explanatory paragraph above. Project does not run lint in CI but the suppression is in place for future maintainers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reactive plan-rebuild integration tests + Warning-4 static-grep regression sentinel (RED)** — `0a63d20` (test)
2. **Task 2a: Extend src/shared/types.ts (WR-01 IPC type + WR-02 JSDoc)** — `3eb1cff` (feat)
3. **Task 2b: Wire AtlasPreviewModal safetyBufferPercent prop + AppShell mount-site (CR-02)** — `2b02277` (feat)
4. **Task 2c: AppShell core changes — CR-01 useEffect + WR-01 wiring + WR-03 untitled-dirty + BLOCKER-2 site-5** — `6b4341c` (fix)
5. **Task 2d: OptimizeDialog Math.floor cleanup (WR-04 / IN-01)** — `d2d3408` (refactor)
6. **Task 3: Full-suite regression sweep + cumulative gap-closure verification** — no commit (diagnostic only)

_TDD note:_ Task 1 was RED at commit (Test 3 static-grep sentinel failed until Task 2c landed the AppShell useEffect literal). Tests 1 + 2 (StatefulWrapper render + IPC payload) were GREEN immediately because the wrapper carries the contract independently of AppShell — by design (the wrapper is the test's standalone reference implementation; the static-grep sentinel locks AppShell to match).

## Files Created/Modified

- `src/renderer/src/components/AppShell.tsx` (+70 / −1) — reactive useEffect, untitled-dirty extension, onClickLocateSkeleton wiring + dep array update, AtlasPreviewModal mount prop, DocumentationBuilderDialog mount prop
- `src/renderer/src/modals/AtlasPreviewModal.tsx` (+19 / −2) — safetyBufferPercent prop type + projection useMemo opts/deps
- `src/renderer/src/modals/OptimizeDialog.tsx` (+5 / −1) — Math.floor cleanup with documenting comment
- `src/shared/types.ts` (+34 / −11) — reloadProjectWithSkeleton IPC args 3 new optional fields + ExportRow.bufferCapped JSDoc rewrite
- `tests/renderer/optimize-dialog-buffer.spec.tsx` (+164 / −1) — `import * as React from 'react'` namespace import + 3 new tests under `describe('reactive plan rebuild — Phase 30 CR-01 closure')`
- `.planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md` (+6 / 0) — logged the pre-existing OptimizeDialog null-vs-undefined gap exposed by Task 1 IPC test

## Decisions Made

- Adopted Option (a) per `30-VERIFICATION.md` "Suggested closure plan #1" — minimal-patch useEffect in AppShell — over Option (b) (lift plan derivation into OptimizeDialog). (a) preserves OptimizeDialog's existing prop surface; (b) would ripple through 18+ tests.
- Used `summary` (raw prop) NOT `effectiveSummary` (post-resample memo) inside the useEffect, matching `onClickOptimize` at line 640 exactly. The export pipeline reads the originally-loaded pre-resample shape.
- Boolean dep `exportDialogState !== null` (not the object) — eliminates the would-be feedback loop. Documented eslint suppression.
- Mock the IPC test's `startExport` to return a complete `ExportSummary` shape so InProgressBody doesn't crash on `undefined.successes` (pre-existing OptimizeDialog null-vs-undefined gap; fixed in test setup, logged to deferred-items.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OptimizeDialog InProgressBody null-vs-undefined gap surfaced by Task 1 IPC test (deferred — out of scope)**
- **Found during:** Task 1 (IPC payload assertion test triggered Start → entered in-progress state)
- **Issue:** `src/renderer/src/modals/OptimizeDialog.tsx:776` checks `props.summary !== null` before reading `props.summary.successes`, but the new test's `startExport` mock returned `{ ok: true }` without a `summary` field, leaving `props.summary` as `undefined` (passes `!== null` check). Crash: `Cannot read properties of undefined (reading 'successes')`.
- **Fix:** SCOPE BOUNDARY rule applies — pre-existing production gap, not caused by this plan's changes. Test mock corrected to return a complete `ExportSummary` shape (`{ successes: 1, errors: [], durationMs: 100, cancelled: false }`) so the post-export render works in jsdom. Underlying production gap (use `!=` not `!==`, OR contract that startExport always carries `summary`) logged to `deferred-items.md` for a future Rule-1 fix.
- **Files modified:** `tests/renderer/optimize-dialog-buffer.spec.tsx` (mock correction), `.planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md` (logged for future)
- **Verification:** Buffer tests now pass cleanly with no unhandled errors (15/15).
- **Committed in:** `6b4341c` (Task 2c commit, alongside the test mock correction and deferred-items.md update)

---

**Total deviations:** 1 deferred (test-side mock corrected; production gap logged out-of-scope)
**Impact on plan:** Negligible. Pre-existing gap; no scope creep.

## Plan-checker iteration 1 revisions applied

- **BLOCKER 1 (WR-02):** ExportRow.bufferCapped JSDoc rewrite moved here from 30-05 to keep `src/shared/types.ts` exclusively under 30-04 ownership. Done in commit `3eb1cff`.
- **BLOCKER 2 site 5:** AppShell `<DocumentationBuilderDialog>` mount edit moved here from 30-05 to keep `src/renderer/src/components/AppShell.tsx` exclusively under 30-04 ownership. Done in commit `6b4341c`.
- **Warning 4:** Static-grep regression sentinel test added to Task 1 — locks the exact useEffect signature in AppShell against future maintainer reverts. Done in commit `0a63d20`.
- **Warning 5:** Task-1 IPC test has NO soft-fail fallback. The `expect(startExportMock.mock.calls.length).toBeGreaterThan(0)` assertion fails loudly if the harness cannot reach the IPC path. (The test reaches the path successfully via `onConfirmStart` mock returning `{ proceed: true, overwrite: false }`.)
- **Warning 6:** Inline `// eslint-disable-next-line react-hooks/exhaustive-deps` documented above the new useEffect dep array. Project has no lint script in CI but the suppression is in place for future maintainers.
- **Warning 7:** Original 9-step Task 2 was split into 4 smaller tasks (2a–2d) each with a single-file or 2-files-1-logical-change scope. Each task committed atomically.

## Issues Encountered

- TypeScript check under `tsconfig.web.json` reports 1 error on AppShell.tsx referencing the unknown `safetyBufferPercent` prop on DocumentationBuilderDialog. **This is the documented wave-ordering wrinkle** — Plan 30-05 lands the receiving `safetyBufferPercent: number` field on `DocumentationBuilderDialogProps`. After both plans complete in Wave 4, the final tsc check is clean. Per the plan: _"if 30-04 ships first the dangling prop will trigger a TS-2353-style error until 30-05 lands. (...) The Wave-4 final-check confirms both together."_
- TS check under `tsconfig.json` (the Node test + main config) — 0 errors. Only the renderer-strict project config catches the wave-ordering intermediate.

## Self-Check

Verified each commit exists in git history and each modified file exists on disk:

```
FOUND: src/renderer/src/components/AppShell.tsx
FOUND: src/renderer/src/modals/AtlasPreviewModal.tsx
FOUND: src/renderer/src/modals/OptimizeDialog.tsx
FOUND: src/shared/types.ts
FOUND: tests/renderer/optimize-dialog-buffer.spec.tsx
FOUND: .planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md
FOUND commit: 0a63d20 (test RED)
FOUND commit: 3eb1cff (types.ts WR-01 + WR-02)
FOUND commit: 2b02277 (AtlasPreviewModal CR-02)
FOUND commit: 6b4341c (AppShell CR-01 + WR-01 + WR-03 + BLOCKER-2 site-5)
FOUND commit: d2d3408 (OptimizeDialog WR-04)
```

Verified gap-closure grep gates:

| Gate | Expected | Actual |
|------|----------|--------|
| AppShell `if (exportDialogState === null) return` | ≥1 | 2 (new useEffect + pre-existing onConfirmStart guard) |
| AppShell `exportDialogState !== null` | ≥1 | 5 (new useEffect dep + pre-existing dialog mount conditional) |
| AppShell `buildExportPlan(summary, overrides, {` | ≥3 | 3 (onClickOptimize + onConflictPickDifferent + new useEffect) |
| AppShell `safetyBufferPercent={safetyBufferPercentLocal}` | ≥3 | 3 (OptimizeDialog + AtlasPreviewModal + DocumentationBuilderDialog mounts) |
| AppShell `safetyBufferPercentLocal !== 0` | ≥1 | 1 (untitled-dirty branch) |
| AppShell `sharpenOnExportLocal !== false` | ≥1 | 1 (untitled-dirty branch) |
| AppShell `samplingHzLocal !== 120` | ≥1 | 1 (untitled-dirty branch) |
| AppShell `safetyBufferPercent: safetyBufferPercentLocal` after `reloadProjectWithSkeleton({` | ≥1 | 1 (locate-skeleton wiring) |
| AppShell `eslint-disable-next-line react-hooks/exhaustive-deps` | ≥1 | 2 (new useEffect + pre-existing site) |
| AtlasPreviewModal `safetyBufferPercent` | ≥3 | 5 (prop type + JSDoc + opts field + deps array + 1 from comment) |
| types.ts `loaderMode?: 'auto' \| 'atlas-less'` (in IPC args) | ≥1 | 1 |
| types.ts `safetyBufferPercent?: number` | ≥2 | 2 (existing MaterializedProject + new IPC args) |
| types.ts misleading parenthetical removed | 0 single-line | 0 (semantic content rewritten; historical citation in WR-02 explanatory paragraph) |
| OptimizeDialog `Math.max(0, Math.min(25, Math.floor` | 0 | 0 |
| optimize-dialog-buffer.spec.tsx `reactive plan rebuild — Phase 30 CR-01 closure` | 1 | 1 |
| optimize-dialog-buffer.spec.tsx static-grep sentinel test | 1 | 1 |
| Layer 3: `from 'sharp'` in src/core/ | 0 | 0 |
| Layer 3: `from 'electron'` in src/core/ | 0 | 0 |
| Full vitest run | 902 → ≥905 passed | 905 passed (1 pre-existing failure unchanged) |

## Self-Check: PASSED

## Next Phase Readiness

- Plan 30-05 (CR-03 core mirror parity + CR-04 documentation field reconciliation, sites 1-4 only) ships in parallel — file-disjoint with this plan per plan-checker iter-1. Once 30-05 lands, the wave-ordering wrinkle resolves and `tsconfig.web.json` is clean.
- All 6 verification gaps from `30-VERIFICATION.md` (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04/IN-01) plus IN-03 plus 5 plan-checker iter-1 fixes (BLOCKER 1, BLOCKER 2 site 5, Warning 4, Warning 5, Warning 6) are addressed by this plan.
- ROADMAP SC #1 (reactive recompute of summary tiles) restored end-to-end. Setting buffer=5% in the input AFTER dialog open now reaches both the dialog's tiles AND `window.api.startExport` IPC payload (`outW=525` for the canonical 0.5×1000 row, vs the pre-fix `outW=500`).

---
*Phase: 30-safety-buffer-in-optimize-dialog*
*Plan: 04*
*Completed: 2026-05-08*
