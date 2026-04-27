---
phase: 07-atlas-preview-modal
plan: 01
subsystem: scaffolding
tags: [phase-07, wave-0, dependencies, types, ipc, vitest, jsdom, testing-library, maxrects-packer]

# Dependency graph
requires:
  - phase: 06-optimize-assets-image-export
    provides: ExportRow.atlasSource shape precedent (lines 213-220) reused verbatim by AtlasPreviewInput / PackedRegion
  - phase: 04-scale-overrides
    provides: Layer 3 inline-copy precedent (D-75) extended to atlas-preview core ↔ renderer-view in Plan 02
  - phase: 01-electron-react-scaffold
    provides: D-21 structuredClone-safe IPC discipline locked at file-top of src/shared/types.ts
provides:
  - maxrects-packer ^2.7.3 runtime dependency installed and resolvable from src/core/*
  - @testing-library/react ^16.3.2 + @testing-library/user-event ^14.6.1 + @testing-library/jest-dom ^6.9.1 + jsdom ^29.0.2 devDeps for the renderer modal test track
  - vitest config widened to scan tests/**/*.spec.tsx alongside tests/**/*.spec.ts
  - Four Phase 7 IPC types in src/shared/types.ts — AtlasPreviewInput, PackedRegion, AtlasPage, AtlasPreviewProjection (structuredClone-safe)
  - tests/core/atlas-preview.spec.ts — 19 it.todo slots covering F7.1 / F7.2 cases (a..h) + 5 hygiene + 5 parity
  - tests/renderer/atlas-preview-modal.spec.tsx — 5 it.todo slots covering D-128 / D-130 / D-135 / D-137 + first-line jsdom pragma
affects: [07-02, 07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added:
    - "maxrects-packer ^2.7.3 (browser-safe rect-packing — RESEARCH §Library Verification audited tarball, zero node:* / fs / sharp / electron imports in dist)"
    - "@testing-library/react ^16.3.2 (React 19 compatible)"
    - "@testing-library/user-event ^14.6.1"
    - "@testing-library/jest-dom ^6.9.1"
    - "jsdom ^29.0.2 (renderer test env — flipped on per-file via `// @vitest-environment jsdom` pragma; vitest default stays 'node')"
  patterns:
    - "Per-file `// @vitest-environment jsdom` pragma — flips test env per spec without changing vitest.config default; FIRST line of file is required (otherwise jsdom is not loaded and the modal component import fails non-usefully)"
    - "RED stub specs as it.todo — vitest reports them as `skipped`, not failures; lets a Wave 0 plan ship test scaffolding that downstream waves fill in without crashing CI"
    - "AtlasSource shape duplication discipline — DisplayRow / ExportRow / AtlasPreviewInput / PackedRegion all carry the same inline `atlasSource?: { pagePath; x; y; w; h; rotated }` literal shape; project precedent is duplication over named-type extraction (lines 85-92, 213-220, and the new Phase 7 block)"

key-files:
  created:
    - "tests/core/atlas-preview.spec.ts (78 lines, 19 it.todo)"
    - "tests/renderer/atlas-preview-modal.spec.tsx (38 lines, 5 it.todo)"
    - ".planning/phases/07-atlas-preview-modal/07-01-SUMMARY.md (this file)"
  modified:
    - "package.json (5 new deps: 1 runtime + 4 dev)"
    - "package-lock.json (npm-managed)"
    - "vitest.config.ts (include array widened by one glob)"
    - "src/shared/types.ts (+86 lines — 4 new exported interfaces, no existing block touched)"

key-decisions:
  - "Phase 7 type block placement: between ProbeConflictsResponse and SkeletonSummary (line ~350), not between ExportPlan and ExportError as the plan's literal wording suggested. Keeps all Phase 6 types contiguous; plan explicitly allowed flexibility (`or wherever the existing file places it — keep the section-comment discipline`)."
  - "jsdom pinned to ^29.0.2 (latest stable) instead of plan's suggested ^25.0.0. RESEARCH Assumption A1+A2 mandated using `npm view <pkg> version` on install day and accepting the latest stable major; jsdom 29.0.2 was current at install. Same for @testing-library/jest-dom (6.9.1 vs suggested 6.5.0) and @testing-library/react (16.3.2 vs suggested 16.0.0)."
  - "vitest default environment stays `'node'`. Renderer specs flip to jsdom via per-file pragma. Avoids a global env switch that would have re-keyed all 16 existing test files (210 passing) onto jsdom for no benefit."
  - "RED stub specs use it.todo, NOT it() with `expect(true).toBe(false)`. Vitest reports todo entries as `skipped` — the suite still exits 0, which keeps CI green between Wave 0 and the implementing waves (02 + 04). it() with deliberate failure would have required an `expect.fail` or skip-comment dance."

patterns-established:
  - "Pattern: per-file `// @vitest-environment jsdom` pragma on FIRST line of .spec.tsx — first renderer-test file in the project; downstream Phase 7 + future-phase renderer specs follow this exact shape"
  - "Pattern: RED-as-todo for cross-wave test scaffolding — Wave 0 ships the spec skeleton with it.todo slots, Wave N replaces todos with real assertions; suite stays green throughout (vitest reports todos as skipped). Different from RED-with-failing-import — used when downstream wave is far enough out that we don't want suite-fail noise in the meantime"
  - "Pattern: structuredClone-safe IPC type discipline preserved even when type lives renderer-only. Phase 7's AtlasPreviewProjection lives entirely in the renderer (no IPC crossing in the recommended path) but declares no Map / class instance / Float32Array fields, preserving the IPC fallback option (one config flip away)"

requirements-completed: [F7.1, F7.2]

# Metrics
duration: 7min
completed: 2026-04-25
---

# Phase 7 Plan 01: Wave 0 dependencies + Phase 7 IPC types + RED stub specs Summary

**maxrects-packer + four React testing-library packages installed; vitest widened to .spec.tsx; four AtlasPreview* types exported from src/shared/types.ts; two RED stub spec files seeded with 24 it.todo slots ready for Plan 02 + Plan 04 to fill.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-25T18:23:00Z (approx — Task 1 install begin)
- **Completed:** 2026-04-25T18:27:30Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (package.json, package-lock.json, vitest.config.ts, src/shared/types.ts)
- **Files created:** 2 (tests/core/atlas-preview.spec.ts, tests/renderer/atlas-preview-modal.spec.tsx)

## Accomplishments

- maxrects-packer ^2.7.3 added as runtime dep — resolvable from src/core/ without TS or runtime errors
- 4 renderer-test devDeps installed — @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom — all React-19 + Vitest-4 compatible at their latest stable majors
- vitest.config.ts include array widened — `tests/**/*.spec.tsx` pattern now scanned alongside `.spec.ts`; default env stays 'node' so per-file `// @vitest-environment jsdom` pragma flips renderer specs without disturbing the 210-passing core suite
- Four Phase 7 IPC types exported from src/shared/types.ts — AtlasPreviewInput, PackedRegion, AtlasPage, AtlasPreviewProjection — all structuredClone-safe, all using the project's standard inline atlasSource literal shape
- Two RED stub spec files committed — 19 it.todo in core, 5 in renderer; the suite reports them as `skipped`, not failed; Plan 02 + Plan 04 fill them with real assertions
- Phase 0-6 invariants preserved: 210 core tests still pass, 1 still skipped (Phase 0 stretch), no behavioral change

## Task Commits

Each task committed atomically:

1. **Task 1: Install deps + widen vitest config** — `e521b6d` (chore)
2. **Task 2: Extend src/shared/types.ts with Phase 7 IPC types** — `fbf96b0` (feat)
3. **Task 3: Seed RED stub specs for core projection + renderer modal** — `6610f25` (test)

## Files Created/Modified

### Created

- `tests/core/atlas-preview.spec.ts` — 78-line RED stub for the pure-TS atlas-preview projection builder. 19 it.todo entries: 8 case-block describes (a..h) + 5 hygiene-grep slots + 5 core ↔ renderer-view parity slots + 1 D-127 metrics-surface slot. Imports nothing from `src/core/atlas-preview.ts` yet (Plan 02 lands the module).
- `tests/renderer/atlas-preview-modal.spec.tsx` — 38-line RED stub for AtlasPreviewModal. FIRST-line `// @vitest-environment jsdom` pragma. 5 it.todo describes covering default-view (D-135) / toggle-rerender (D-128) / pager-bounds (D-128) / dblclick-jump (D-130) / missing-source-glyph (D-137). Imports nothing from `src/renderer/src/modals/AtlasPreviewModal` yet (Plan 04 lands the component).

### Modified

- `package.json` — 1 runtime dep added (maxrects-packer ^2.7.3) + 4 dev deps added (@testing-library/jest-dom ^6.9.1, @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1, jsdom ^29.0.2). Both `dependencies` and `devDependencies` blocks remain alphabetically sorted (npm install handles ordering automatically).
- `package-lock.json` — npm-managed; +57 transitive packages (testing-library tree + jsdom).
- `vitest.config.ts` — `include` array widened from `['tests/**/*.spec.ts']` to `['tests/**/*.spec.ts', 'tests/**/*.spec.tsx']`. `environment: 'node'` unchanged.
- `src/shared/types.ts` — +86 lines of new Phase 7 type exports inserted between ProbeConflictsResponse and SkeletonSummary. Zero existing types modified.

## Decisions Made

- **Phase 7 type block placement.** Inserted between ProbeConflictsResponse (line 349) and SkeletonSummary (line 355), not between ExportPlan (line 232) and ExportError (line 265) as a literal reading of the plan would suggest. Splitting Phase 6's ExportPlan / ExportError / ExportProgressEvent / ExportSummary / ExportResponse / ProbeConflictsResponse cluster apart would harm the file's narrative discipline; the plan explicitly permitted "or wherever the existing file places it — keep the section-comment discipline". Phase 7 block now sits as its own section immediately above SkeletonSummary, mirroring how Phase 6 types sit above SkeletonSummary in the existing layout.

- **Pin choices for testing-library + jsdom.** Plan suggested ^25.0.0 (jsdom), ^16.0.0 (react), ^14.5.0 (user-event), ^6.5.0 (jest-dom). RESEARCH Assumptions A1+A2 mandate verifying via `npm view` on install day and using the latest stable major. Actual pins: jsdom ^29.0.2, @testing-library/react ^16.3.2, @testing-library/user-event ^14.6.1, @testing-library/jest-dom ^6.9.1. Same major-version family in every case (16.x for react, 14.x for user-event, 6.x for jest-dom); jsdom diverged majors (25 → 29) but no breaking API changes affect this plan since no specs use jsdom yet (Plan 04 will).

- **vitest default environment stays `'node'`.** Per-file `// @vitest-environment jsdom` pragma flips renderer specs. The alternative (set `environment: 'jsdom'` globally) would have re-keyed all 210 existing tests onto jsdom for zero benefit and a measurable startup-time cost.

- **RED stub specs use `it.todo`, not `it() + expect.fail`.** Vitest reports `it.todo` as `skipped` in test output and the suite still exits 0. This is the correct posture for Wave 0 → Wave 2/3 cross-wave test scaffolding — different from RED-with-failing-import (used when the implementation lands in the same plan). Plans 02 + 04 replace the todos with real assertions when their implementations land.

## Deviations from Plan

None — plan executed exactly as written.

The only judgement-call adjustments are documented under "Decisions Made" above:

1. Type block placement nuance (between ProbeConflictsResponse and SkeletonSummary, not between ExportPlan and ExportError) — the plan explicitly permitted this flexibility.
2. Pinning the latest stable major of jsdom + testing-library packages — explicitly mandated by RESEARCH Assumptions A1+A2.

Neither rises to the level of a Rule 1-4 deviation. All acceptance criteria for all three tasks passed on the first run of every grep.

**Total deviations:** 0
**Impact on plan:** None — Wave 0 invariants preserved; downstream Phase 7 plans unblocked.

## Issues Encountered

None during execution.

**Pre-existing out-of-scope finding (not introduced by this plan):** `npm run typecheck:node` still surfaces the pre-existing TS2339 in `scripts/probe-per-anim.ts` (Property 'values' does not exist on type 'SamplerOutput'). Logged in `.planning/phases/04-scale-overrides/deferred-items.md`; reproduced on an unmodified working tree per that log. Not auto-fixed (SCOPE BOUNDARY rule — pre-existing failures in unrelated files are out of scope). `npm run typecheck:web` is fully clean.

## Verification Results

| Check | Result |
|-------|--------|
| `npm ls maxrects-packer jsdom @testing-library/{react,user-event,jest-dom}` | All 5 packages resolvable, no peer warnings |
| `node -e "require.resolve('maxrects-packer')"` | exit 0 |
| `grep '"maxrects-packer"' package.json` | found |
| `grep '"jsdom"' package.json` | found |
| `grep '"@testing-library/react"' package.json` | found |
| `grep '"@testing-library/user-event"' package.json` | found |
| `grep '"@testing-library/jest-dom"' package.json` | found |
| `grep "tests/\\*\\*/\\*\\.spec\\.tsx" vitest.config.ts` | found |
| `grep "environment: 'node'" vitest.config.ts` | found (unchanged default) |
| `grep -E "^export interface AtlasPreviewInput\|PackedRegion\|AtlasPage\|AtlasPreviewProjection" src/shared/types.ts` | all 4 found |
| `grep 'sourceMissing?: boolean' src/shared/types.ts` | found |
| `grep 'maxPageDim: 2048 \| 4096' src/shared/types.ts` | found |
| `grep "mode: 'original' \| 'optimized'" src/shared/types.ts` | found |
| `! grep -E "AtlasPreviewInput.*=.*new Map\|PackedRegion.*=.*new Map" src/shared/types.ts` | no Map / class instance fields |
| `npm run typecheck:web` | exit 0 (clean) |
| `npm run typecheck:node` | exit 1 (pre-existing scripts/probe-per-anim.ts TS2339; logged out-of-scope) |
| `test -f tests/core/atlas-preview.spec.ts` | found |
| `test -f tests/renderer/atlas-preview-modal.spec.tsx` | found |
| `head -1 tests/renderer/atlas-preview-modal.spec.tsx` matches `// @vitest-environment jsdom` | matched |
| `grep -c 'it.todo' tests/core/atlas-preview.spec.ts` | 19 (≥14 required) |
| `grep -c 'it.todo' tests/renderer/atlas-preview-modal.spec.tsx` | 5 (≥5 required) |
| `grep` for required describe headers (case (a), parity, dblclick) | all 3 found |
| `npm run test` | exit 0 — **210 passed + 1 skipped + 24 todo** (was 210 + 1; +24 new todos from this plan, no regressions) |
| `npx electron-vite build` | exit 0 — main 23.96 kB CJS + preload 3.68 kB CJS + renderer 623.67 kB JS + 22.37 kB CSS (build still green; no behavioral changes shipped) |
| `git diff` on locked `scripts/cli.ts` | empty (D-102 lock intact) |
| `git diff` on locked `src/core/sampler.ts` | empty (CLAUDE.md rule #3 intact) |

## Next Phase Readiness

All downstream Phase 7 plans unblocked:

- **Plan 02 (core projection):** can `import type` from `src/shared/types.js` for AtlasPreviewInput / PackedRegion / AtlasPage / AtlasPreviewProjection; can `import` maxrects-packer from `src/core/atlas-preview.ts`; tests/core/atlas-preview.spec.ts already exists with 19 it.todo slots ready to be replaced with real assertions.
- **Plan 03 (main process / CSP):** no Plan 01 dependency surface (CSP changes are independent of dep + types work).
- **Plan 04 (renderer modal):** can `import` jsdom-flavoured testing-library from tests/renderer/atlas-preview-modal.spec.tsx; per-file pragma is in place; modal component target file path is locked.
- **Plan 05 (AppShell wiring):** consumes the same types Plan 04 uses — no Plan 01-specific blocker.

Wave 0 complete; Wave 2 (Plan 02) is unblocked to start.

---
*Phase: 07-atlas-preview-modal*
*Plan: 01*
*Completed: 2026-04-25*

## Self-Check: PASSED

Verified before final commit:

- `tests/core/atlas-preview.spec.ts` — FOUND
- `tests/renderer/atlas-preview-modal.spec.tsx` — FOUND
- `e521b6d` (Task 1) — FOUND in `git log`
- `fbf96b0` (Task 2) — FOUND in `git log`
- `6610f25` (Task 3) — FOUND in `git log`
- All 4 Phase 7 type names — FOUND in `src/shared/types.ts`
- vitest.config.ts include array — widened
- maxrects-packer + 4 testing-library packages — installed and resolvable
- Locked files diff — empty (`scripts/cli.ts`, `src/core/sampler.ts`)
