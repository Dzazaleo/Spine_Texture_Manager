---
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
plan: 02
subsystem: main
tags: [electron, fs, orphan-detection, ipc, skeleton-summary, tdd]

# Dependency graph
requires:
  - phase: 24-01
    provides: "findOrphanedFiles pure helper in src/core/usage.ts + OrphanedFile type in shared/types.ts"

provides:
  - "orphanedFiles I/O layer in src/main/summary.ts — fs.readdirSync + fs.statSync + findOrphanedFiles call"
  - "buildSummary returns orphanedFiles: OrphanedFile[] populated from images/ scan (not stub [])"
  - "Two-mode algorithm: atlas regions authority in atlas-mode, sourceDims proxy in atlas-less mode"

affects:
  - "24-03 (GlobalMaxRenderPanel cleanup + savingsPct chip) — depends on orphanedFiles being populated"
  - "24-04 (UnusedAssetsPanel + AppShell wiring) — depends on orphanedFiles in SkeletonSummary"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-05 Layer-3 split: I/O in src/main/, pure set-difference in src/core/ (no I/O in core)"
    - "Dual-mode inUseNames: atlas regions (atlas-mode) vs sourceDims proxy (atlas-less mode)"
    - "Silent ENOENT/EACCES: try/catch on both readdirSync and statSync; 0 on stat failure"

key-files:
  created: []
  modified:
    - src/main/summary.ts
    - tests/core/summary.spec.ts

key-decisions:
  - "Non-null assertion load.atlas!.regions is safe: atlasPath !== null guarantees atlas is populated by loader"
  - "No refactor needed: implementation directly matches D-02 spec from PATTERNS.md verbatim code block"

patterns-established:
  - "TDD RED/GREEN: stub returns [] → failing test → real I/O implementation → all tests pass"

requirements-completed:
  - PANEL-01
  - PANEL-02

# Metrics
duration: 7min
completed: 2026-05-04
---

# Phase 24 Plan 02: Summary

**Orphaned file I/O wiring in summary.ts: fs.readdirSync images/ + mode-aware inUseNames set + findOrphanedFiles + fs.statSync augmentation replaces the Plan 01 stub**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-04T12:24:00Z
- **Completed:** 2026-05-04T12:28:00Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- Replaced `const orphanedFiles = []` stub with the real D-02 two-step algorithm
- Atlas-mode: builds inUseNames from `load.atlas!.regions[*].name` (the manifest authority)
- Atlas-less mode: builds inUseNames from `load.skeletonData.skins[*].attachments` filtered via `load.sourceDims` presence (sourceDims proxy excludes BoundingBox/Path/Clipping/Point attachments)
- No images/ folder (ENOENT) → `imagesFolderFiles = []` → `orphanedFiles = []` → panel stays hidden (D-06)
- Each orphaned basename augmented with `fs.statSync(pngPath).size`; ENOENT/EACCES → 0 silently
- 4 new TDD integration tests in summary.spec.ts; all 736 previously-passing tests still pass

## Task Commits

RED/GREEN TDD cycle:

1. **RED: add failing tests for orphanedFiles I/O wiring** - `d0827a6` (test)
2. **GREEN: rewrite orphan detection I/O layer in summary.ts** - `ad9570c` (feat)

## Files Created/Modified

- `src/main/summary.ts` — replaced stub `orphanedFiles: []` with full D-02 I/O algorithm; added `import { findOrphanedFiles } from '../core/usage.js'` and `import * as path from 'node:path'`
- `tests/core/summary.spec.ts` — 4 new tests: ENOENT → [], orphaned GHOST.png found + bytesOnDisk, used PNGs not orphaned (atlas-mode), structuredClone-safe

## Decisions Made

- Used `load.atlas!.regions` non-null assertion (safe: `atlasPath !== null` guard guarantees `load.atlas` is populated by the loader — this is the documented plan guidance from D-05 Step 4)
- Left existing comment in skippedNames block ("peaks / animationBreakdown.rows / unusedAttachments are filtered") as pre-existing historical text out of scope for this plan
- No REFACTOR phase needed — implementation matched PATTERNS.md verbatim code block exactly

## Deviations from Plan

None — plan executed exactly as written. The verbatim code block from `24-PATTERNS.md § src/main/summary.ts` was applied as specified.

## Issues Encountered

None.

## Known Stubs

None — `orphanedFiles` is now fully wired. The renderer (wave 3) still needs to surface it via `UnusedAssetsPanel` (Plan 24-04) and the savings chip (Plan 24-03), but the IPC payload is correct.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. `path.join(skeletonDir, 'images')` uses a hard-coded `'images'` literal — no user-controlled string spliced in as a path segment (T-24-02-01 mitigated as per threat model in plan frontmatter). `OrphanedFile.filename` is a PNG basename with no extension or path separator (T-24-02-02 accepted per plan).

## TDD Gate Compliance

- RED gate: `test(24-02)` commit `d0827a6` — 1 failing test ("GHOST.png orphaned" asserted `ghost !== undefined` but stub returned `[]`)
- GREEN gate: `feat(24-02)` commit `ad9570c` — all 15 summary.spec.ts tests pass
- REFACTOR gate: not needed (implementation was direct and clean)

## Self-Check

Files exist:
- `src/main/summary.ts` — FOUND (modified)
- `tests/core/summary.spec.ts` — FOUND (modified)

Commits exist:
- `d0827a6` (RED test) — FOUND
- `ad9570c` (GREEN feat) — FOUND

## Self-Check: PASSED

## Next Phase Readiness

- Wave 2 complete: `buildSummary` now populates `orphanedFiles` with real data
- Wave 3 (Plans 24-03 + 24-04) can render the UnusedAssetsPanel and the savingsPct chip
- `SkeletonSummary.orphanedFiles` is always populated (never undefined) — renderer uses `?? []` as IPC backward-compat coalesce

---
*Phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric*
*Completed: 2026-05-04*
