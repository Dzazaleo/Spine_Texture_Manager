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
*Phase: 40-atlas-repack-output*
*Completed: 2026-05-14*
*UAT-fix appendix: 2026-05-15*
