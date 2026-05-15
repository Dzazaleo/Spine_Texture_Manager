---
phase: 40-atlas-repack-output
plan: 07
subsystem: ui
tags: [optimize-dialog, output-card, atlas-knobs, ipc-threading, repack-01, d-01, d-04, d-05, repack-10]

# Dependency graph
requires:
  - phase: 40
    plan: 01
    provides: "ProjectFileV1 + AppSessionState atlas-field schema (atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding); ExportProgressEvent.phase additive optional field"
  - phase: 40
    plan: 06
    provides: "src/main/ipc.ts export:start handler accepts 7 args (evt + plan + outDir + overwrite + sharpenEnabled + outputMode + atlasOpts); shared rollback list across both modes"
provides:
  - "OptimizeDialog Output card UI: bordered group above Quality card with Loose|Atlas|Both radio + 3 atlas knobs (max page size select 1024/2048/4096/8192, allow-rotation checkbox with locked title= tooltip, padding number input clamped 0..16)"
  - "OptimizeDialog onStart threads outputMode + atlasOpts as 5th + 6th positional args into window.api.startExport (renderer-perspective; main-side index counts evt at 0 → 7 args total)"
  - "OptimizeDialog progress handler reads additive ExportProgressEvent.phase and prefixes the stored lastPath with `Resize: ` / `Composite: ` labels (D-05)"
  - "OptimizeDialog InProgressBody renders synthetic-summary write-errors verbatim — REPACK-10 surfacing fix: the locked oversize-region error string reaches the user UNCHANGED"
  - "AppShell 4 useState slots (atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding) seeded from .stmproj on Open / locate-skeleton recovery; round-tripped through Save/Save As; dirty-tracked in isDirty memo; threaded to OptimizeDialog props"
  - "Preload bridge window.api.startExport widened to accept 6 positional args; Api type declaration in shared/types.ts extended with optional outputMode + atlasOpts (main has safe defaults)"
  - "MaterializedProject IPC return type extended with 4 atlas fields; all 3 project-io.ts builders (Open / locate-skeleton recovery / resample) thread the fields through, completing the Plan 01 schema extension that was left unfinished at the IPC seam"
affects:
  - 40-08
  - 40-09
  - 40-verify

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled-prop pattern for atlas state mirrors sharpenOnExport/safetyBufferPercent ×4 — AppShell owns state, OptimizeDialog renders + mutates via prop callbacks"
    - "Conditional knob reveal via plain JSX `{props.outputMode !== 'loose' && (...)}` — no animation primitive needed; matches existing Quality card section pattern"
    - "Source-grep contract tests for cross-module IPC signatures (tests/preload + tests/renderer/app-shell-atlas-state.spec.tsx) — same idiom as tests/preload/request-pending-update.spec.ts"
    - "Synthetic-summary-only error rendering — when summary.errors arrives without per-row events (pre-flight aborts), the InProgressBody renders summary.errors[].message verbatim so locked IPC error strings reach the user unchanged"

key-files:
  created:
    - "tests/preload/start-export-atlas-args.spec.ts — 6 contract tests for preload bridge + Api type widening"
    - "tests/renderer/optimize-dialog-output-card.spec.tsx — 17 jsdom UI tests for Output card / atlas knobs / onStart wiring / REPACK-10 verbatim surfacing / D-05 progress prefix"
    - "tests/renderer/app-shell-atlas-state.spec.tsx — 7 source-grep AppShell threading contract tests"
  modified:
    - "src/preload/index.ts — window.api.startExport arrow widened to 6 positional args; ipcRenderer.invoke forwards them"
    - "src/shared/types.ts — Api.startExport declaration extended with optional outputMode + atlasOpts; MaterializedProject extended with 4 atlas fields"
    - "src/renderer/src/modals/OptimizeDialog.tsx — OptimizeDialogProps gains 4 atlas props; new Output card inserted above Quality card; onStart threads 6 args; progress handler reads event.phase; InProgressBody surfaces synthetic-summary errors verbatim"
    - "src/renderer/src/components/AppShell.tsx — 4 new useState slots seeded from initialProject.atlas*; buildSessionState reads from state; isDirty extended; mountOpenResponse + setLastSaved sites baseline atlas; OptimizeDialog mount receives outputMode + atlasOpts"
    - "src/main/project-io.ts — 3 MaterializedProject builders thread the 4 atlas fields; recovery + resample paths gained defensive validators mirroring sharpenOnExport / safetyBufferPercent"
    - "5 existing renderer test files — REQUIRED_PROPS / buildProps scaffolds extended with the 4 new required OptimizeDialog props (default outputMode='loose')"

key-decisions:
  - "REPACK-10 verbatim surfacing required adding a new DOM render for summary.errors[].message — Plan 01 + 06 captured the message into state but no UI surface existed; without this fix, the locked error string silently disappears. Tracked as Rule 2 deviation."
  - "MaterializedProject (the IPC return type) needed extending with 4 atlas fields to make AppShell state seeding possible — Plan 01 added fields to PartialMaterialized but not to the renderer-facing IPC type. Tracked as Rule 3 deviation."
  - "Plan acceptance criteria referenced `src/preload/index.d.ts` for the typed startExport declaration; the actual Api type lives in src/shared/types.ts (index.d.ts only re-exports via global Window). Widening shared/types.ts achieves the renderer-facing surface goal — doc-only deviation."
  - "D-02 honored: AtlasPreviewModal.tsx left untouched — pack-plan preview deferred."
  - "Existing test scaffolds updated to include the 4 new required props with outputMode='loose' default — preserves backward compat without making props optional, since the prop contract from AppShell is always populated."

patterns-established:
  - "Output card layout: bordered surface, label span at top-left, controls inline (mirrors Quality card pattern verbatim — same Tailwind v4 literal-class discipline)"
  - "Conditional knob reveal: `{props.outputMode !== 'loose' && (...)}` — plain JSX, no animation library, matches existing project conventions"
  - "REPACK-10-style verbatim error surfacing: pre-flight aborts arrive as summary.errors without per-row events; the InProgressBody's new error-list block renders them unchanged so locked IPC error strings reach the user"
  - "MaterializedProject + project-io.ts ×3-builder threading sub-pattern: every additive field needs entries in handleProjectOpenFromPath (Open), handleProjectReloadWithSkeleton (locate-skeleton recovery), handleProjectResample (Settings re-sample) — mirrors safetyBufferPercent's ×3-site fan-out"

requirements-completed: [REPACK-01]

# Metrics
duration: ~25 min
completed: 2026-05-14
---

# Phase 40 Plan 07: OptimizeDialog Output Card + AppShell Atlas State Threading Summary

**Loose/Atlas/Both radio + 3 atlas knobs (max page size / allow rotation / padding) in OptimizeDialog Output card, threaded end-to-end through AppShell .stmproj round-trip and Plan 06's widened export:start IPC, with REPACK-10 verbatim error surfacing.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-14T18:35Z
- **Completed:** 2026-05-14T18:55Z (approx, pre-checkpoint)
- **Tasks:** 3 code tasks + 1 human-verify checkpoint (returned to orchestrator)
- **Files modified:** 13 (4 src + 1 shared types + 1 main IPC + 7 test files including 3 new ones)
- **Net diff:** +955 / -11 lines

## Accomplishments

- **Output card UI complete** — bordered group inserted ABOVE the existing Quality card (D-01 layout): radiogroup `Loose PNGs | Atlas | Both` (D-01a, default `loose`) + conditional render of 3 atlas knobs (D-01b) — max page size select (D-01c), allow rotation checkbox with locked title= tooltip (D-01d), padding number input clamped 0..16 (D-01e).
- **End-to-end IPC threading** — preload bridge widened (5th + 6th positional args) → shared/types.ts Api type widened → OptimizeDialog onStart passes `props.outputMode` + `props.atlasOpts` → main-side handler (Plan 06) dispatches accordingly.
- **AppShell state round-trip** — 4 useState slots seeded from `.stmproj` (Open / locate-skeleton recovery / resample) and written back via buildSessionState on Save / Save As. isDirty memo extended so atlas changes mark the project dirty and SaveQuitDialog surfaces on close.
- **REPACK-10 surfacing** — locked oversize-region error string (`"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."`) reaches the user UNCHANGED via a new synthetic-summary error render block in InProgressBody.
- **D-05 progress phase handling** — onExportProgress callback reads additive `event.phase` field and prefixes the stored `lastPath` with `Resize: ` / `Composite: ` labels.
- **Plan 01 schema completion** — MaterializedProject extended with 4 atlas fields + 3 project-io.ts builders threaded; this completes the Plan 01 schema extension that left the IPC return type unfinished.

## Task Commits

Each task was committed atomically with TDD RED → GREEN pattern:

1. **Task 07.1 RED:** test(40-07) failing tests for widened startExport preload bridge — `23a37e9` (test)
2. **Task 07.1 GREEN:** feat(40-07) widen startExport preload bridge with outputMode + atlasOpts — `26089af` (feat)
3. **Task 07.2 RED:** test(40-07) failing tests for OptimizeDialog Output card — `2575405` (test)
4. **Task 07.2 GREEN:** feat(40-07) render OptimizeDialog Output card + atlas knobs + thread IPC args — `e89ef9d` (feat)
5. **Task 07.3 RED:** test(40-07) failing tests for AppShell atlas state threading — `baf6868` (test)
6. **Task 07.3 GREEN:** feat(40-07) thread atlasOutputMode + atlasOpts state through AppShell + IPC return type — `b6d48f9` (feat)

Task 07.4 is a human-verify checkpoint — execution paused at this point and a checkpoint state was returned to the orchestrator.

## Files Created/Modified

- `src/preload/index.ts` — `window.api.startExport` arrow widened to 6 positional args (plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts); ipcRenderer.invoke forwards all 6.
- `src/shared/types.ts` — `Api.startExport` declaration extended with optional `outputMode` + `atlasOpts` params (main has safe defaults); `MaterializedProject` interface extended with 4 atlas fields (`atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding`).
- `src/renderer/src/modals/OptimizeDialog.tsx` — `OptimizeDialogProps` gains 4 atlas props; new bordered "Output" card with radio + conditional 3-knob group inserted above Quality card; `onStart` threads `outputMode` + `atlasOpts` as 5th + 6th args to `window.api.startExport`; `onExportProgress` handler reads `event.phase` and builds `Resize:/Composite:` prefix; `InProgressBody` surfaces synthetic-summary write-errors verbatim (REPACK-10 fix).
- `src/renderer/src/components/AppShell.tsx` — 4 new `useState` slots seeded from `initialProject.atlas*`; `lastSaved` snapshot type extended; `buildSessionState` reads from state (replaces Plan 01's hardcoded placeholders); `isDirty` memo extended ×2 (untitled-session non-default checks + loaded-session diff vs `lastSaved`); `mountOpenResponse` seeds `setAtlas*` state from `project.atlas*`; Save/Save As setLastSaved sites baseline all 4 atlas fields; OptimizeDialog mount receives `outputMode + atlasOpts` props.
- `src/main/project-io.ts` — all 3 MaterializedProject builders thread the 4 atlas fields: `handleProjectOpenFromPath` (Open), `handleProjectReloadWithSkeleton` (locate-skeleton recovery — gained defensive validators mirroring sharpenOnExport/safetyBufferPercent), `handleProjectResample` (Settings re-sample — gained the same defensive coerce block).
- `tests/preload/start-export-atlas-args.spec.ts` — 6 source-grep contract tests for preload bridge + Api type widening.
- `tests/renderer/optimize-dialog-output-card.spec.tsx` — 17 jsdom tests covering D-01 UI / D-04 onStart wiring / D-05 progress phase / REPACK-10 verbatim DOM surfacing.
- `tests/renderer/app-shell-atlas-state.spec.tsx` — 7 source-grep AppShell threading contract tests.
- `tests/renderer/optimize-dialog-buffer.spec.tsx`, `optimize-dialog-passthrough.spec.tsx`, `optimize-dialog-passthrough-rows.spec.tsx`, `optimize-dialog-auto-expand-error.spec.tsx`, `appshell-optimize-flow.spec.tsx` — REQUIRED_PROPS / buildProps scaffolds extended with the 4 new required props (default `outputMode='loose'`).

## Decisions Made

- **REPACK-10 verbatim error rendering added inline** — the existing onStart error path already captured `response.error.message` into `summary.errors[0].message` verbatim, but no DOM surface displayed it (only the count `N failed` was shown). For the locked REPACK-10 string to actually reach the user as the plan acceptance criterion requires, a new render block was added in `InProgressBody` that renders `summary.errors[].message` unchanged when `rowErrors` is empty (pre-flight abort).
- **MaterializedProject extended at the IPC seam** — Plan 01 added the 4 atlas fields to `PartialMaterialized` (core/project-file.ts) but NOT to `MaterializedProject` (shared/types.ts — the IPC return type the renderer reads from `initialProject`). Without this extension, AppShell could not read `initialProject.atlasOutputMode` etc, breaking Open round-trip. Extended the interface + all 3 project-io.ts builders. This completes the Plan 01 schema extension that was left unfinished.
- **D-02 honored** — AtlasPreviewModal.tsx was NOT modified. Pack-plan preview wiring is deferred to a future phase per CONTEXT D-02.
- **Existing test scaffolds extended (not made optional)** — kept the 4 new props as required on `OptimizeDialogProps` since AppShell always passes them; updated 5 existing test files' `REQUIRED_PROPS` / `buildProps` helpers with `outputMode: 'loose'` defaults. This preserves the type contract from AppShell while not regressing existing tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] REPACK-10 verbatim error surfacing required new DOM render block**
- **Found during:** Task 07.2 (running TDD GREEN against the REPACK-10 verbatim surfacing test)
- **Issue:** Plan acceptance criteria locked the REPACK-10 string (`"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."`) must reach the user UNCHANGED via the toast. The existing onStart error path captured `response.error.message` into `summary.errors[0].message` verbatim — but the `InProgressBody` only rendered the error COUNT (`N failed`), never the individual `.message` strings. The locked error string was preserved in state but silently disappeared from the DOM.
- **Fix:** Added a new render block in `InProgressBody` that renders `summary.errors[i].message` verbatim when `rowErrors.size === 0` (pre-flight abort heuristic — no per-row events fired). The block uses `text-[color:var(--color-danger)]` for visual distinction.
- **Files modified:** `src/renderer/src/modals/OptimizeDialog.tsx`
- **Verification:** The new test `REPACK-10 surfacing: response.error.message reaches the summary verbatim` asserts the locked substring appears in the DOM after a failing IPC. All 17 OptimizeDialog Output card tests + 48 OptimizeDialog full-suite tests pass.
- **Committed in:** `e89ef9d` (Task 07.2 GREEN commit)

**2. [Rule 3 - Blocking] MaterializedProject extended with 4 atlas fields**
- **Found during:** Task 07.3 (attempting to seed AppShell state from `initialProject.atlasOutputMode` etc)
- **Issue:** Plan 01 added the 4 atlas fields to `ProjectFileV1` + `AppSessionState` + `PartialMaterialized`, but NOT to `MaterializedProject` (the IPC return type the renderer reads from `initialProject` and `mountOpenResponse(project)`). Without this extension, the AppShell state-seeding code Plan 07 prescribed would fail to type-check: `initialProject.atlasOutputMode` would be `unknown`. This is the Plan 01 schema extension that was left unfinished at the IPC seam.
- **Fix:** Extended `MaterializedProject` interface in `src/shared/types.ts` with the 4 atlas fields. Threaded the fields through all 3 project-io.ts builders: `handleProjectOpenFromPath` reads from `materialized.atlas*`; `handleProjectReloadWithSkeleton` gained 4 defensive arg validators (mirroring `sharpenOnExport`/`safetyBufferPercent`) and writes them to the recovery-path MaterializedProject; `handleProjectResample` gained the same defensive coerce block.
- **Files modified:** `src/shared/types.ts`, `src/main/project-io.ts`
- **Verification:** `tsc --noEmit` clean across the whole worktree. Full test sweep (renderer + main/project-io + core/project-file + preload) passes 342/343 (1 pre-existing skip unrelated to this plan).
- **Committed in:** `b6d48f9` (Task 07.3 GREEN commit)

**3. [Doc-only] Plan referenced `src/preload/index.d.ts` for typed declaration; actual location is `src/shared/types.ts`**
- **Found during:** Task 07.1
- **Issue:** Plan acceptance criteria specified `grep -c "outputMode: 'loose' | 'atlas' | 'both'" src/preload/index.d.ts` returns 1 — but `src/preload/index.d.ts` only re-exports `Api` from `src/shared/types.ts` via `declare global { interface Window { api: Api } }`. The actual Api type declaration lives in `shared/types.ts`. Widening the `Api.startExport` declaration there achieves the same renderer-facing surface goal.
- **Fix:** Widened `Api.startExport` in `src/shared/types.ts` with optional `outputMode` + `atlasOpts` params. No actual change to `src/preload/index.d.ts` (which remains a 1-line type re-export).
- **Files modified:** `src/shared/types.ts`
- **Verification:** Contract tests in `tests/preload/start-export-atlas-args.spec.ts` (6/6 pass) source-grep both the preload arrow shape AND the shared/types.ts Api declaration shape.
- **Committed in:** `26089af` (Task 07.1 GREEN commit)

---

**Total deviations:** 3 (1 Rule 2 — missing critical functionality for REPACK-10 surfacing; 1 Rule 3 — Plan 01 IPC-seam gap; 1 doc-only — file-location mismatch in plan, no behavioral impact)

**Impact on plan:** All 3 deviations necessary. The Rule 2 fix unblocks the locked REPACK-10 acceptance criterion. The Rule 3 fix completes Plan 01's schema extension at the IPC seam. The doc-only deviation was non-behavioral. No scope creep.

## Issues Encountered

- **3 OptimizeDialog test files used `as unknown as ComponentProps<...>` scaffolds without the 4 new required props.** The new required props default to `outputMode: 'loose'` in the validator pre-massage. When tests passed `undefined`, `props.outputMode !== 'loose'` evaluated `true` (since `undefined !== 'loose'`), triggering the conditional knob render which accessed `props.atlasOpts.maxPageSize` on `undefined`. Fixed by extending each `REQUIRED_PROPS` / `buildProps` helper with the 4 new defaults. 48/48 OptimizeDialog tests pass post-fix.
- **2 pre-existing test failures unrelated to this plan:**
  - `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (7 skipped — fixture gitignored per commit `40a4f2c`)
  - `tests/main/sampler-worker-girl.spec.ts` (wall-time CI-skipif test per commit `f00e232`)
  Neither was introduced by Plan 07.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **OptimizeDialog UI is ready for human verification.** A `human-verify` checkpoint is returned to the orchestrator (Task 07.4). User must run `npm run dev`, open a project, click Optimize Selected, and confirm:
  1. Output card visible ABOVE Quality card; radio group reads "Loose PNGs | Atlas | Both"; "Loose PNGs" pre-selected
  2. Selecting "Atlas" reveals 3 knobs (4096 default; rotation unchecked; padding 2)
  3. Hovering Allow rotation shows the locked tooltip text
  4. Selecting "Both" keeps knobs visible; selecting "Loose PNGs" hides them
  5. Changing any knob marks the project dirty (title bar `•` indicator)
  6. Save → Open round-trips all 4 atlas fields
  7. Exporting with mode=Atlas on the fixture writes a `.atlas` + page PNG
  8. Exporting with mode=Both writes BOTH loose PNGs and `.atlas`
  9. Setting `atlasMaxPageSize=1024` + a region override large enough to exceed the cap surfaces the verbatim REPACK-10 error string in the toast/error-list, and the output dir stays in pre-export state.
- **Plan 06 IPC dispatch is wired.** No code blockers for the verification flow.
- **Plan 08 / 09 unaffected** — neither requires Plan 07 changes.

## Self-Check: PASSED

- All 6 task commits (3 RED + 3 GREEN) exist in `git log`.
- All 13 files referenced in this SUMMARY exist on disk (4 src + 1 shared + 1 main + 7 tests).
- `tsc --noEmit` clean.
- 41 test files / 342 tests pass (renderer + preload + main/project-io + core/project-file).
- No file deletions across the plan.
- Worktree HEAD on `worktree-agent-ac6e696801596a2fb`; merge-base correct against plan base `af6a55594e12b18e94c3ea31b8c87aec3e2674b4`.

---

## UAT-Fix Appendix (2026-05-15)

Human UAT against `fixtures/SKINS/test_repack/` surfaced 4 concrete bugs in
the Phase 40 atlas-mode export. All 4 were fixed in this worktree on top of
plan 40-07's original deliverable; per-bug RED test → GREEN fix → atomic
commit. STATE.md and ROADMAP.md were NOT modified (re-verification pass
owns that.)

### Bug 1 (CRITICAL) — `runRepack` did not dedup by regionName

**Symptom (user-reported):** `fixtures/SKINS/test_repack/test_repack.atlas`
contained 161 entries for only 26 unique region names. `AVATAR/BODY`
appeared 7 times. Page PNG had overlapping regions.

**Root cause:** `src/main/repack-worker.ts` iterated every `plan.rows` entry
and pushed one item per row into `repackInputs[]`. With N skeletons sharing
the same source PNG (the SKINS workflow), the packer received N copies of
the same regionName and laid them out at N distinct positions.
`regionBuffers` (Map) naturally deduped — the inputs array did not.

**Fix:** Dedup `repackInputs` by regionName (Map keyed by regionName, first
occurrence wins). `computeRepack`'s `localeCompare` sort guarantees pack
determinism regardless of insertion order, preserving REPACK-08 cross-mode
parity.

- **Commit:** `b41e009` — `fix(40-07): dedup runRepack inputs by regionName (UAT bug 1)`
- **Files:** `src/main/repack-worker.ts`, `tests/main/repack-worker.spec.ts`
- **Regression test:** 6 rows declaring 2 unique regionNames → `.atlas`
  contains exactly 1 entry per region (2 bounds lines).

### Bug 2 (CRITICAL) — atlas page bytes rotated in the wrong direction (faces upside-down)

**Symptom (user-reported):** Rotated regions on the atlas page rendered
upside-down in Spine (180° net error).

**Root cause:** `repack-worker.ts` applied `sharp.rotate(+90)` for the
canonical → atlas WRITE direction. Phase 33's empirical "+90 is CCW" verdict
was about the READ direction the spine runtime applies (atlas → canonical),
so the WRITE direction is its INVERSE. Pre-fix the on-page bytes were
rotated in the same direction the runtime later rotates → 180° net.

**Empirical verification:** New script `scripts/probe-sharp-rotate-write.mjs`
painted distinguishable canonical corners, applied each candidate WRITE
rotation, then applied the Phase-33-verified READ rotation. Verdict:

```
WRITE rotate(-90) -> READ rotate(+90) restores canonical: true
ROTATE_FOR_ATLAS = rotate(-90)
```

**Fix:** Change `sharp(orig).rotate(90)` → `sharp(orig).rotate(-90)` in the
materialize-then-reload step. Expand the docblock to call out the READ/WRITE
inverse pair so this is not re-litigated.

- **Commit:** `b2dda96` — `fix(40-07): correct atlas rotation direction (UAT bug 2)`
- **Files:** `src/main/repack-worker.ts`, `tests/main/repack-worker.spec.ts`,
  `scripts/probe-sharp-rotate-write.mjs` (NEW — regression sentinel)
- **Regression test:** Composites a single WIDE region with corner-marked
  canonical (RED/GREEN/BLUE/WHITE), forces packer rotation via 2× TALL +
  1× WIDE fixture at maxPageSize=1024, extracts the rotated bytes from the
  page, applies spine READ rotation, asserts corners match canonical.
  Pre-fix: corners 180°-rotated; post-fix: corners match.

### Bug 3 (HIGH) — atlas-mode summary reported "0 of N succeeded"

**Symptom (user-reported):** After successful atlas-mode export the
renderer's progress card read literally "0 of 160 succeeded" despite files
being written.

**Root cause:** `runRepack` returned only `{ pageFiles, atlasFile }`.
`src/main/ipc.ts` synthesized `{ successes: 0, durationMs: 0, ... }`
whenever loose-mode was not run. The renderer dutifully reported what it
received.

**Fix:**
1. Widen `RepackResultPaths` with `summary: ExportSummary`. Successes =
   unique regionNames packed (post-Bug-1 dedup count). durationMs =
   wall-time delta. outputDir = resolved outDir. cancelled =
   isCancelled() at completion.
2. Replace the placeholder summary synth in ipc.ts with the real summaries
   from each worker. For `both` mode: sum successes; concat errors;
   outputDir = looseSummary's; sum durationMs (sequential); OR cancelled.

- **Commit:** `34c8fa7` — `fix(40-07): surface real success count for atlas-mode exports (UAT bug 3)`
- **Files:** `src/main/repack-worker.ts`, `src/main/ipc.ts`,
  `tests/main/repack-worker.spec.ts`, `tests/main/ipc-export.spec.ts`
- **Regression tests:** runRepack summary shape + dedup interplay (6 rows
  / 2 unique → successes=2); IPC atlas mode `successes` matches worker
  (NOT 0); IPC both mode merge math; IPC both mode cancelled flag is OR.

### Bug 4 (LOW) — tooltip on checkbox not on label (hover-on-row didn't work)

**Symptom (user-reported):** Hovering over "Allow rotation" text did not
show the tooltip; users had to hover the tiny checkbox square.

**Root cause:** `OptimizeDialog.tsx` placed `title=` only on the `<input>`,
not the wrapping `<label>`.

**Fix:** Mirror the title onto the `<label>` element. Keep the input title
too (defense in depth + preserves existing test asserting checkbox.title).

- **Commit:** `c09cb26` — `fix(40-07): move tooltip to label so hover-on-row works (UAT bug 4)`
- **Files:** `src/renderer/src/modals/OptimizeDialog.tsx`,
  `tests/renderer/optimize-dialog-output-card.spec.tsx`
- **Regression test:** `checkbox.closest('label')!.getAttribute('title')`
  equals the locked tooltip string.

### UAT-fix verification

- `npx tsc --noEmit` — clean.
- `npm test` — 1140 passes; 1 pre-existing failure
  (`tests/main/sampler-worker-girl.spec.ts` — missing `fixtures/Girl/` per
  `.planning/phases/40-atlas-repack-output/deferred-items.md`); 1
  pre-existing suite-load failure (`tests/core/sampler-skin-defined-unbound-attachment.spec.ts`
  — missing `fixtures/SAMPLER_ALPHA_ZERO/` per the same deferred-items log).
  Both are unrelated to Phase 40 work and were already known.
- All 11 `tests/main/repack-worker.spec.ts` cases pass (10 pre-existing + 2 new dedup +
  1 new rotation + 2 new summary). All 18 `tests/renderer/optimize-dialog-output-card.spec.tsx`
  cases pass (17 pre-existing + 1 new tooltip-on-label). All 33
  `tests/main/ipc-export.spec.ts` cases pass (30 pre-existing + 3 new
  summary-merge).

### Self-Check (UAT appendix): PASSED

- All 4 fix commits exist on `worktree-agent-ad2d0ef4c58b142ee`
  (`b41e009`, `b2dda96`, `34c8fa7`, `c09cb26`).
- `scripts/probe-sharp-rotate-write.mjs` exists on disk and prints
  `ROTATE_FOR_ATLAS = rotate(-90)` when invoked.
- No file deletions across the 4 fix commits.
- HEAD on `worktree-agent-ad2d0ef4c58b142ee` (worktree-agent namespace
  preserved).
- No STATE.md / ROADMAP.md modifications (re-verification owns these).

---

## UAT-Fix Round 2 Appendix (2026-05-15)

A second UAT iteration against `fixtures/SKINS/JOKERMAN_SPINE.json`
surfaced that the Round 1 dedup fix (commit `b41e009`) used the WRONG
KEY. The user's freshly produced atlas (`fixtures/SKINS/test_repack/
test_repack.atlas`) contained only **23 entries** when the export plan
declared **160** (158 rows + 2 passthroughCopies). Every skin except
skin 0 (`AVATAR/*`) was silently dropped from the atlas page PNG.

### Round-1 fix was wrong: `attachmentNames[0]` is shared across skins

The Round-1 dedup keyed by `row.attachmentNames?.[0] ?? row.outPath`.
But `attachmentNames[0]` is the **slot-binding name** in Spine — it is
SHARED across skins. The JOKERMAN_SPINE fixture demonstrates the
collision:

| Skin     | Slot binding `attachmentNames[0]` | JSON `path:`      | Source PNG                        |
| -------- | --------------------------------- | ----------------- | --------------------------------- |
| AVATAR   | `AVATAR/BODY`                     | `AVATAR/BODY`     | `images/AVATAR/BODY.png`          |
| BEACHMAN | `AVATAR/BODY`                     | `BEACHMAN/BODY`   | `images/BEACHMAN/BODY.png`        |
| JOKER    | `AVATAR/BODY`                     | `JOKER/BODY`      | `images/JOKER/BODY.png`           |
| IRONMAN  | `AVATAR/BODY`                     | `IRONMAN/BODY`    | `images/IRONMAN/BODY.png`         |

Keying by `attachmentNames[0]` collapsed all 4 BODY rows into ONE atlas
entry. Across 7 skins × ~23 attachments, this dropped ~135 legitimate
plan.rows from the .atlas. The page PNG was missing every non-AVATAR
skin's textures entirely.

### Round-2 fix: dedup by `row.outPath` stripped of extension + `images/`

`row.outPath` is unique per source PNG (D-108 — `src/shared/types.ts`
L361: plan.rows is ALREADY deduped per source PNG path upstream). The
correct atlas region name is `row.outPath` with `images/` prefix and
`.png` suffix stripped — matching the Spine JSON `path:` attribute
(`JOKER/BODY`, `BEACHMAN/BODY`, ...) which the spine runtime uses to
look up regions in the atlas at load time.

- **Commit:** `a34cdda` — `fix(40-07): use outPath as atlas region key (UAT 2 bug — dropped skins)`
- **Files:** `src/main/repack-worker.ts`
- **Defensive net:** since D-108 already deduplicates upstream, the
  Map-based dedup branch in runRepack should be unreachable for well-
  formed plans. Replaced silent dedup with `console.warn` so an
  upstream regression surfaces loudly rather than silently dropping
  rows.
- **Verified via SKINS fixture:** atlas region count goes from 23 →
  160; per-skin names (`JOKER/BODY`, `BEACHMAN/BODY`, `IRONMAN/BODY`,
  ...) all present.

### `passthroughCopies` were not packed into atlas mode

`runRepack` iterated only `plan.rows`, ignoring `plan.passthroughCopies`
entirely. In atlas mode this dropped every "no resize needed" row from
the .atlas — the spine runtime looks up every region declared in the
.json `path:` field regardless of resize vs. byte-copy.

Fix: a second loop after the resize loop iterates `passthroughCopies`,
reads source bytes verbatim via `sharp(srcPath).png().toBuffer()` (no
resize chain), reads back native dims via `sharp(buf).metadata()`
(sharp-emits-truth invariant per REPACK-03), and feeds the result into
the same `regionBuffers + repackInputsByName` Maps with the same
regionName-key discipline.

- **Commit:** `a20f80c` — `feat(40-07): pack passthroughCopies into atlas mode`
- **Files:** `src/main/repack-worker.ts`

### Progress-event index-space widened to include passthroughCopies

With passthroughCopies now packed, the progress-event totals had to
widen so the renderer's progress bar stays monotonic [0, 100%]:

- Resize loop: `total = plan.rows.length + passthroughCopies.length`
- Passthrough loop: `index = rows + pi`, same `total`
- Composite loop: `index = (rows + passthrough) + pi`,
  `total = (rows + passthrough) + packResult.pages.length`

`passthroughCopies` is hoisted to the top of `runRepack` so every
`onProgress` call references the same array (uniform denominator
across phases).

- **Commit:** `bf97402` — `fix(40-07): include passthroughCopies in progress-event totals`
- **Files:** `src/main/repack-worker.ts`

### Regression tests

- **Skin-aliased slot bindings (new):** 6 rows with the same
  `attachmentNames[0]` but distinct `outPath` produce 6 distinct atlas
  entries (replaces the OLD test that asserted they collapsed to 1 —
  the OLD test was verifying the bug).
- **Defensive duplicate outPath (new):** rows with the SAME outPath
  (= D-108 violation) collapse to 1 entry AND emit a `console.warn`,
  asserted via `vi.spyOn(console, 'warn')`.
- **passthroughCopies in atlas (new):** plan with 1 resize + 2
  passthrough rows produces 3 atlas entries; passthrough entries land
  at native dims; `summary.successes === 3`.
- **passthroughCopies in progress events (new):** resize-phase events
  all carry `total = rows + passthrough`; composite events use the
  combined work-unit denominator and indices >= resizeUnits.
- **SKINS fixture sanity (new, gated):** when
  `fixtures/SKINS/JOKERMAN_SPINE.json` is present, builds the full
  ExportPlan via `loadSkeleton → sampleSkeleton → analyze →
  analyzeRegions → buildExportPlan` and asserts the resulting atlas
  contains exactly 160 entries (= plan.rows + passthroughCopies),
  including `JOKER/BODY`, `BEACHMAN/BODY`, `IRONMAN/BODY` as distinct
  region names. Gated on `fs.existsSync` → `describe.skip` when fixture
  is absent (CI / fresh clones).
- **Updated:** the OLD `summary.successes counts unique regionNames
  AFTER dedup` test was rewritten to use shared outPaths + warn spy
  (the same defensive dedup path).
- **Updated:** the `makePlan()` helper auto-derives `outPath` from
  `attachmentNames[0]` so existing tests asserting on region names
  like `SQUARE` / `HUGE` still hit predictable names.

- **Commit:** `7d72be7` — `test(40-07): cover skin-aliased dedup + passthroughCopies in repack-worker`
- **Files:** `tests/main/repack-worker.spec.ts`

### Manual UAT step (SKINS fixture is gitignored)

Because `fixtures/SKINS/` is gitignored (heavy, 358M), the fixture-
driven sanity test is gated on `fs.existsSync(JOKERMAN_SPINE.json)`
and skipped in CI clones. To run it manually on a clone that has the
fixture:

```bash
# Verify fixture exists, then run the gated test
test -f fixtures/SKINS/JOKERMAN_SPINE.json && \
  npx vitest run tests/main/repack-worker.spec.ts -t "SKINS fixture sanity"
```

Expected: 1 passed, 16 skipped. Atlas region count = 160. If the count
is 23, the Round-1 regression returned. If the count is 0, the packer
pre-flight aborted (oversize).

Verified locally via symlink (the worktree was not initialized with the
heavy fixture): the SKINS sanity test PASSES post-fix — 160 entries,
`JOKER/BODY` / `BEACHMAN/BODY` / `IRONMAN/BODY` all present.

### UAT-fix Round 2 verification

- `npx tsc --noEmit` — clean.
- `npx vitest run tests/core/ tests/main/ tests/preload/` — 783 passed
  / 21 skipped / 1 todo / **2 pre-existing failures** unrelated to
  this fix (sampler-worker-girl + sampler-skin-defined-unbound-
  attachment, both missing fixtures per
  `.planning/phases/40-atlas-repack-output/deferred-items.md`).
- `npx vitest run tests/main/repack-worker.spec.ts` — 16 passed / 1
  skipped (SKINS fixture-gated, expected in worktree clones).
- All 4 Round-2 commits on `worktree-agent-a4bcf4d9df6e973b9`.
- No file deletions across the 4 fix commits.
- No STATE.md / ROADMAP.md modifications (re-verification owns those).

### Self-Check (UAT Round 2 appendix): PASSED

- All 4 fix commits exist on `worktree-agent-a4bcf4d9df6e973b9`
  (`a34cdda`, `a20f80c`, `bf97402`, `7d72be7`).
- `src/main/repack-worker.ts` contains the new `outPathToRegionName`
  helper + passthrough loop + widened progress totals.
- `tests/main/repack-worker.spec.ts` contains the 5 new test cases +
  the SKINS fixture-gated sanity check.
- The Round-1 SUMMARY appendix (commit `c09cb26` and earlier) is
  preserved unchanged — Round 2 is purely additive.
- HEAD on `worktree-agent-a4bcf4d9df6e973b9` (worktree-agent namespace
  preserved).

---

## UAT-Fix Round 3 Appendix (2026-05-15)

A third UAT iteration surfaced two regressions in the atlas-mode export
flow. Both were fixed in this worktree on top of the Round-2 deliverables;
per-bug fix → test → atomic commit. STATE.md and ROADMAP.md were NOT
modified (re-verification pass owns those).

### Bug A — Overwrite probe blind to atlas targets

**Symptom (user-reported):** Re-running atlas-mode export against the same
outDir failed with:
```
repack-worker: page PNG already exists at .../{projectName}.png;
pass allowOverwrite=true to overwrite.
```
The ConflictDialog never appeared even though the page PNG + .atlas were
clearly present in outDir.

**Root cause:** `probeExportConflicts` (src/main/ipc.ts L398) only iterated
`plan.rows[].outPath` — the loose-mode per-region paths under
`outDir/images/`. It never derived the atlas-mode targets at outDir root
(`{projectName}.png`, `{projectName}_N.png`, `{projectName}.atlas`). For an
atlas-only re-export the loose paths didn't exist, so the probe returned
zero conflicts; the renderer skipped the ConflictDialog and called
`startExport(overwrite=false)`; `runRepack` hit its defensive existence
check at write time and threw.

The probe + the worker were also using two independently-defined
`deriveProjectName` helpers — by good luck they agreed today, but any
future drift in one would silently break the probe.

**Fix:**
1. **Extract shared helpers.** Pulled `deriveProjectName` + `pageFilename`
   out of `repack-worker.ts` into a new `src/main/atlas-paths.ts`. Both the
   probe AND the worker import from the same source — the agreement is now
   structural.
2. **Widen `probeExportConflicts` signature** with `outputMode` +
   `atlasOpts` (defaults preserve pre-Round-3 loose-only behavior).
3. **Atlas-mode probe:** for `outputMode === 'atlas' | 'both'`, derive the
   canonical sentinels (`{projectName}.png` + `{projectName}.atlas`) via
   the shared helpers and probe disk for each via `fs.access(F_OK)`.
   Multi-page exports are discovered via `readdir(outDir)` + a regex match
   on `{projectName}_<N>.png` (N >= 2).
4. **Gate loose-mode per-row check** on `outputMode === 'loose' | 'both'`
   so atlas-only exports don't surface stale `images/foo.png` paths as
   conflicts.
5. **Forward through the layers:** preload bridge `probeExportConflicts`
   accepts 4 args; `Api.probeExportConflicts` in `src/shared/types.ts`
   widened with optional `outputMode` + `atlasOpts`; AppShell's
   `onConfirmStart` threads `atlasOutputMode` + the 3 atlas knobs through.
6. **Defense-in-depth:** the probe inside `handleStartExport` (run when
   `overwrite=false`) forwards the validated `outputMode` + `atlasOpts` so
   bypass callers still get the precise mode-aware conflict list.

- **Commits:**
  - `cce08ae` — `refactor(40-07): extract deriveProjectName + pageFilename to shared atlas-paths util`
  - `4eebaf6` — `fix(40-07): extend probeExportConflicts to atlas-mode targets (UAT 3 bug A)`
- **Files:**
  - NEW `src/main/atlas-paths.ts`
  - `src/main/repack-worker.ts` (imports from shared util)
  - `src/main/ipc.ts` (widened probe + handler + channel forwarding)
  - `src/preload/index.ts` (bridge accepts 4 args)
  - `src/shared/types.ts` (Api type widened)
  - `src/renderer/src/components/AppShell.tsx` (call site threads atlas state)

### Bug B — Progress counter overshoots local total

**Symptom (user-reported):** In-progress header read literally
"Optimize Assets — 163 of 160 → /tmp/test_repack" at the last composite
event of a SKINS-fixture atlas export.

**Root cause:** The in-progress header used a static local denominator
computed at render time: `total = plan.rows.length + passthroughCopies.length`
(160 for SKINS). The composite-phase progress events emit
`total: resizeUnits + pages.length` (163 for SKINS — 158 rows + 2
passthrough + 3 pages). `setProgress({ current: event.index + 1 })` pushed
`progress.current` to 163 while the displayed denominator stayed at 160.

The IPC was already reporting the correct total — the renderer was simply
ignoring it.

**Fix:**
1. Add `total` to the progress state — `{ current, total, lastPath }`.
2. `onExportProgress` writes `event.total` to `progress.total` on every
   event so the IPC stays the source of truth.
3. In-progress header reads `progress.total` when > 0, falls back to local
   `total` during the brief window between in-progress flip and the first
   IPC event (so the header never displays a literal `of 0`).
4. `InProgressBody` receives the same IPC-sourced total (renamed at the
   call site to `inProgressTotal`) so the progress bar denominator stays
   in lockstep with the header.

- **Commit:** `a1c2f3d` — `fix(40-07): track IPC-reported total in renderer progress state (UAT 3 bug B)`
- **File:** `src/renderer/src/modals/OptimizeDialog.tsx`

### Regression tests

- **Atlas-mode probe surfaces {projectName}.png + .atlas (new):** outDir
  populated with the canonical sentinels; probe returns both paths as
  conflicts; loose-mode per-row path NOT in result.
- **Atlas-mode probe discovers multi-page pages via readdir (new):**
  readdir returns `test_repack.png`, `test_repack_2.png`,
  `test_repack_3.png`, `README.txt`, `other_project_5.png`; probe returns
  pages 0/2/3 only; unrelated basename `other_project_5.png` and non-PNG
  `README.txt` filtered out.
- **Loose mode does NOT surface atlas sentinels (new):** even when the
  atlas sentinels exist on disk, `outputMode='loose'` returns an empty
  conflict list — mode-aware probing.
- **Both mode surfaces atlas sentinels AND loose per-row collisions
  (new):** mixed atlas + loose collisions all appear in the result.
- **Empty outDir → empty conflicts (new):** default mocks (access ENOENT,
  readdir []) produce no false positives.
- **Header denominator follows event.total in atlas mode (new):**
  composite event with `total=163` against a 160-row plan; header reads
  "163 of 163"; the buggy "of 160" framing is absent.
- **Loose-mode header unchanged when event.total === local total (new):**
  regression-lock against accidental loose-mode breakage.

The `vi.mock('node:fs/promises', ...)` factory + `beforeEach` reset were
extended with `readdir` (default: empty array) so the new atlas-mode
probe paths can override per-test via
`vi.mocked(fsPromises.readdir).mockResolvedValueOnce(...)`.

- **Commit:** `ea57f95` — `test(40-07): cover atlas-mode probe + progress-overshoot regressions`
- **Files:**
  - `tests/main/ipc-export.spec.ts` (+5 tests, 37 → 42 total)
  - `tests/renderer/optimize-dialog-output-card.spec.tsx` (+2 tests, 18 → 20)

### UAT-fix Round 3 verification

- `npx tsc --noEmit` — clean.
- `npx vitest run tests/main tests/renderer tests/preload` —
  571 passed / 3 skipped / **1 pre-existing failure** unrelated to this
  fix: `tests/main/sampler-worker-girl.spec.ts` (missing `fixtures/Girl/`
  per `.planning/phases/40-atlas-repack-output/deferred-items.md`).
- All 42 `tests/main/ipc-export.spec.ts` cases pass (37 pre-existing +
  5 new atlas-mode probe).
- All 20 `tests/renderer/optimize-dialog-output-card.spec.tsx` cases
  pass (18 pre-existing + 2 new IPC-sourced progress total).
- All 4 Round-3 commits on `worktree-agent-aba58f713ee8eaaff`.
- No file deletions across the 4 fix commits.
- No STATE.md / ROADMAP.md modifications (re-verification owns those).

### Self-Check (UAT Round 3 appendix): PASSED

- All 4 fix commits exist on `worktree-agent-aba58f713ee8eaaff`
  (`cce08ae`, `4eebaf6`, `a1c2f3d`, `ea57f95`).
- `src/main/atlas-paths.ts` exists on disk and exports `deriveProjectName`
  + `pageFilename`.
- `src/main/repack-worker.ts` imports from `./atlas-paths.js` (no
  duplicate helper definitions).
- `src/main/ipc.ts` `probeExportConflicts` signature includes
  `outputMode` + `atlasOpts` positional args; channel registration
  forwards both.
- `src/shared/types.ts` `Api.probeExportConflicts` declaration includes
  optional `outputMode` + `atlasOpts`.
- `src/renderer/src/modals/OptimizeDialog.tsx` `progress` state shape
  includes `total: number`; in-progress header reads `progress.total`
  with local-total fallback.
- Earlier UAT appendices (Round 1 + Round 2) preserved unchanged — Round
  3 is purely additive.
- HEAD on `worktree-agent-aba58f713ee8eaaff` (worktree-agent namespace
  preserved).

---
*Phase: 40-atlas-repack-output*
*Completed: 2026-05-14*
*UAT-fix appendix: 2026-05-15*
*UAT-fix Round 2 appendix: 2026-05-15*
*UAT-fix Round 3 appendix: 2026-05-15*
