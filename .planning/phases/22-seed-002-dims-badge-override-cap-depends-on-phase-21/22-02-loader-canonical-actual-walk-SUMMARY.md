---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 02
subsystem: loader
tags: [typescript, loader, png-header, canonical-dims, actual-dims, atlas-less, dims-mismatch, dims-01]

# Dependency graph
requires:
  - phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
    provides: "readPngDims (PNG IHDR byte parser); walkSyntheticRegionPaths (skin-attachment iteration template); SilentSkipAttachmentLoader (orphan tolerance)"
  - phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
    provides: "LoadResult.canonicalDimsByRegion + actualDimsByRegion fields (Plan 22-01); analyzer + summary plumbing wired (Plan 22-01); 1px-tolerance dimsMismatch predicate at toDisplayRow (Plan 22-01)"
provides:
  - "loadSkeleton() walks parsedJson.skins[*].attachments per D-01 and harvests width/height per region"
  - "loadSkeleton() reads PNG IHDR via readPngDims for every region with a sourcePath; per-region try/catch tolerates atlas-extract path"
  - "LoadResult.canonicalDimsByRegion populated for every region/mesh/linkedmesh attachment with non-zero JSON width/height"
  - "LoadResult.actualDimsByRegion populated only when per-region PNG resolves on disk; missing PNGs leave entry undefined (no throw)"
  - "R5 fallback: zero-width/height attachments skipped + dev-mode console.warn fires"
affects: [22-03, 22-04, 22-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Map population at load time + threading through LoadResult — pattern mirrors Phase 6 sourcePaths/atlasSources, Phase 21 sourceDims provenance"
    - "Per-region try/catch over readPngDims — atlas-extract path semantics (CONTEXT D-01) preserved without throwing"
    - "JSON skin walk + harvest width/height — reuses Phase 21's walkSyntheticRegionPaths skeleton verbatim, only the collection target differs (Map<{w,h}> vs Set<string>)"

key-files:
  created: []
  modified:
    - "src/core/loader.ts (3 inserts: import readPngDims; canonical-dims walk after version guard; actual-dims PNG-read loop after sourcePaths; populated maps in return literal replace empty placeholders)"
    - "tests/core/loader.spec.ts (+7 DIMS-01 tests under new describe block; +3 import additions)"

key-decisions:
  - "Per-region readPngDims runs in BOTH canonical-atlas mode AND atlas-less mode per D-01 — single drift-detection path covers both"
  - "Atlas-extract path tolerance: every PNG read failure swallowed silently; actualDimsByRegion stays empty for Jokerman-style atlas-only projects (no throws)"
  - "R5 linkedmesh fallback: width===0 || height===0 skipped + dev-mode console.warn; CLI fallback at toDisplayRow (Plan 22-01) handles downstream"
  - "Last-write-wins on duplicate region name across skins (canonical dims are PNG-property, not skin-variant) — matches Phase 21 walkSyntheticRegionPaths semantics"

patterns-established:
  - "Pattern: Layer 3-clean per-region byte-header read at load time — readPngDims is pure node:fs IHDR parsing (no zlib/IDAT decoding); honors CLAUDE.md fact #4"
  - "Pattern: dual-source dim threading — canonical (JSON) and actual (PNG-IHDR) populated as parallel Maps, both keyed by region name (att.path ?? entryName), consumed by analyzer for dimsMismatch predicate"

requirements-completed: [DIMS-01]

# Metrics
duration: 12min
completed: 2026-05-03
---

# Phase 22 Plan 02: Loader Canonical+Actual Walk Summary

**loadSkeleton() now harvests canonical width/height from JSON skin attachments and reads PNG IHDR per-region for actual dims, threading both maps through LoadResult so analyzer (Plan 22-01) can compute dimsMismatch.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-03T00:15:00Z (approx)
- **Completed:** 2026-05-03T00:27:00Z
- **Tasks:** 1
- **Files modified:** 2
- **Commits:** 2 atomic (TDD RED + GREEN) + 1 metadata (this SUMMARY)

## Accomplishments

- **Canonical-dims walk landed** in `loadSkeleton()` — walks `parsedJson.skins[*].attachments[slot][entry]`, filters on `type ∈ {region, mesh, linkedmesh}`, keys by `att.path ?? entryName`, harvests `att.width` + `att.height`. Pattern verbatim from Phase 21's `walkSyntheticRegionPaths` — only the collection target differs (Map of `{canonicalW, canonicalH}` instead of Set of strings).
- **Per-region readPngDims loop landed** — iterates `sourcePaths` (already absolute paths to per-region PNGs), calls `readPngDims(pngPath)` inside per-region `try/catch`. Successful reads populate `actualDimsByRegion`; failures (atlas-extract / Jokerman-style atlas-only projects, or transient missing-PNG cases) leave the entry absent with no throw. Layer 3 invariant preserved — `readPngDims` is byte-parsing IHDR only, no zlib/IDAT decoding.
- **R5 fallback wired** — when JSON attachment has `width === 0` or `height === 0` (linkedmesh-without-explicit-dims, or malformed JSON), skip the entry and emit `console.warn` in dev mode. Backlog v1.3: "linkedmesh canonical-dims fallback via parent mesh resolution."
- **Empty-Map placeholders replaced** — Plan 22-01's `canonicalDimsByRegion: new Map()` + `actualDimsByRegion: new Map()` placeholders in the LoadResult return literal swapped for the populated variables. Analyzer + summary.ts (already wired in 22-01) now thread real data through to `DisplayRow.canonicalW/H` + `DisplayRow.actualSourceW/H` + `DisplayRow.dimsMismatch`.
- **7 new DIMS-01 unit tests** under `describe('loader (DIMS-01 canonical-vs-actual dim mapping)')` in `tests/core/loader.spec.ts`:
  1. canonical-atlas mode populates `canonicalDimsByRegion` from JSON (SQUARE 1000×1000, TRIANGLE 833×759, CIRCLE 699×699 — verified against `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`).
  2. atlas-less mode populates `canonicalDimsByRegion` identically (same JSON, same values — D-01 unification).
  3. atlas-less mode populates `actualDimsByRegion` from `readPngDims` (each map entry equals direct `readPngDims` call on the same PNG).
  4. canonical-atlas with per-region PNGs (`EXPORT_PROJECT`) populates `actualDimsByRegion` (proves PNG-read loop runs in BOTH modes, not just atlas-less).
  5. atlas-extract path: `actualDimsByRegion.size === 0` when no per-region PNGs exist (`SIMPLE_PROJECT` has atlas + page PNG but no `images/` folder).
  6. missing-PNG resilience: programmatic tmpdir with one PNG removed → `actualDimsByRegion` partial (TRIANGLE absent, others present), no throw.
  7. R5 fallback: programmatic JSON mutation setting `width: 0` on one entry → that region absent from `canonicalDimsByRegion`; `console.warn` fires with `'canonical-dims fallback'` substring.

## Task Commits

Each task was committed atomically per the TDD gate sequence:

1. **Task 1 RED gate: 7 failing DIMS-01 tests added** — `49618cf` (test)
2. **Task 1 GREEN gate: loader.ts canonical+actual walks** — `07f42ed` (feat)

**Plan metadata:** committed via SUMMARY.md (this file) — orchestrator handles STATE.md/ROADMAP.md updates after wave merge.

_TDD-flagged plan honored: tests committed BEFORE implementation. RED commit `49618cf` had 7 failing tests against the empty-Map placeholders from Plan 22-01; GREEN commit `07f42ed` flips all 7 to passing. No REFACTOR commit — implementation landed cleanly with no follow-up cleanup needed._

## Files Created/Modified

**Created:** none (additive extension only — no new core/ files; the infrastructure landed in Phase 21).

**Modified:**

- `src/core/loader.ts` — three inserts:
  1. `import { readPngDims } from './png-header.js';` appended to the imports block (line 51).
  2. Canonical-dims walk inserted after the version guard (`checkSpineVersion` call) and before atlas resolution. Iterates `root.skins[*].attachments[slot][entry]`, filters on type, keys on `att.path ?? entryName`, populates `canonicalDimsByRegion: Map<string, {canonicalW, canonicalH}>`. R5 fallback emits `console.warn` and skips when `width === 0 || height === 0`.
  3. Per-region PNG-read loop inserted after `sourcePaths` is fully built (works for both atlas-less and canonical-atlas branches). Iterates `sourcePaths`, calls `readPngDims(pngPath)` inside per-region try/catch, populates `actualDimsByRegion: Map<string, {actualSourceW, actualSourceH}>`.
  4. Return literal: empty-Map placeholders replaced with the populated `canonicalDimsByRegion` + `actualDimsByRegion` variables; updated docblock cites Plan 22-01 contract.
- `tests/core/loader.spec.ts` — three additions:
  1. New imports: `vi` from vitest, `readPngDims` from `png-header.js`, `ATLAS_LESS_FIXTURE` + `EXPORT_FIXTURE` constants.
  2. New `describe('loader (DIMS-01 canonical-vs-actual dim mapping)')` block with 7 tests (canonical population, atlas-less parity, actual map parity with readPngDims, EXPORT_PROJECT canonical-atlas-with-PNGs path, atlas-extract empty case, missing-PNG resilience, R5 width:0 fallback).

## Decisions Made

- **PNG-read loop runs in BOTH modes, not just atlas-less** — D-01 says canonical drift detection covers both atlas-less AND canonical-atlas modes. The loop iterates `sourcePaths` regardless of `isAtlasLess`. In canonical-atlas mode without an `images/` folder (e.g., `SIMPLE_PROJECT`), every PNG read throws and `actualDimsByRegion` stays empty — that's the locked atlas-extract behavior. In canonical-atlas mode WITH `images/` (e.g., `EXPORT_PROJECT`), the PNG read succeeds and `actualDimsByRegion` populates.
- **Atlas-extract tolerance via per-region try/catch** — RESEARCH §"Change 2" + plan acceptance criteria #5 explicitly require missing PNGs to NOT throw. The empty `catch {}` swallows `readPngDims` failures silently — every alternative (logging, conditional throw, error-list accumulation) was rejected because:
  - It's the loader's "best-effort" contract per Phase 21 D-12.
  - Phase 21 G-01's `skippedAttachments` already surfaces missing-PNG cases for atlas-less mode.
  - Atlas-extract mode (Jokerman-style) has every PNG missing by design; logging would spam the console.
- **R5 dev-warn vs always-warn** — guarded behind `process.env.NODE_ENV !== 'production'` per the threat register entry T-22-06 ("Information disclosure: console.warn leaks region names — accept; dev-mode only"). Production builds run silently; developers see the explicit fallback signal during testing.
- **Last-write-wins on duplicate region keys** — `SIMPLE_TEST.json` has `SQUARE2/SQUARE` (slot=SQUARE2, entry=SQUARE) which references the same `SQUARE` region as `SQUARE/SQUARE`. Both entries write to `canonicalDimsByRegion.set('SQUARE', ...)`. Since canonical dims are a property of the source PNG (NOT the skin variant), the duplicate write is value-identical — last-write-wins is correct + invisible to consumers. Matches Phase 21's `walkSyntheticRegionPaths` semantics (Set deduplicates the same way).

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` block specified Steps 1-6 + automated verification command; every step landed in a single Task 1 RED+GREEN cycle.

One minor scope-internal observation:

- **R5 test uses no extra fixture copy** — the plan's example test in Step 6 sketched `fs.copyFileSync(SIMPLE_TEST_ATLAS, ...)` plus a comment "use whichever copy approach the existing test infra prefers". The implementation copies `SIMPLE_TEST.atlas` AND `SIMPLE_TEST.png` (the atlas page PNG) into the tmpdir — both are needed because the loader's atlas branch reads the atlas text and the parsed atlas references the page PNG. No `images/` folder is created (atlas-extract path); the R5 test only asserts on the canonical map + warn-spy, which fire BEFORE atlas resolution. Plan acceptance criteria all met.

**Total deviations:** 0
**Impact on plan:** None — plan as written.

## Issues Encountered

- **Pre-existing failing test (out of scope, not auto-fixed):** `tests/main/sampler-worker-girl.spec.ts` fails with `expected 'error' to be 'complete'` on a sampler-worker run. Verified pre-existing via `git stash && npx vitest run tests/main/sampler-worker-girl.spec.ts` → identical failure on the pre-Plan-22-02 baseline. This is the same failure documented in Plan 22-01's SUMMARY (sampler-worker timing/environment issue, unrelated to type-cascade or loader changes). Out of scope per scope-boundary rule. Logged here for visibility.

## Self-Check

**Files claimed in this SUMMARY exist and contain the claimed contracts:**

- `src/core/loader.ts` — `readPngDims` import: FOUND (1 import + 1 call site = 5 grep hits including comment refs); canonical walk: FOUND (`canonicalDimsByRegion.set` populates; `att.path ?? entryName` keying preserved; type filter `region|mesh|linkedmesh` preserved); PNG-read loop: FOUND (`actualDimsByRegion.set(regionName, { actualSourceW, actualSourceH })` inside `for (const [regionName, pngPath] of sourcePaths)`); return literal: empty-Map placeholders REMOVED; populated `canonicalDimsByRegion` + `actualDimsByRegion` variables now referenced.
- `tests/core/loader.spec.ts` — `describe('loader (DIMS-01 canonical-vs-actual dim mapping)')` block: FOUND (7 `it()` blocks; each asserts on a distinct DIMS-01 facet).

**Acceptance criteria verification (from plan):**

- `grep -c "readPngDims" src/core/loader.ts` → **5** (≥ 2 required) ✓
- `grep -c "canonicalDimsByRegion" src/core/loader.ts` → **4** (≥ 2 required) ✓
- `grep -c "actualDimsByRegion" src/core/loader.ts` → **7** (≥ 2 required) ✓
- `grep -cE "^import.*from ['\"](sharp|electron)" src/core/loader.ts` → **0** (Layer 3 invariant preserved) ✓
- `npx vitest run tests/core/loader.spec.ts -t "DIMS-01"` → **7 passed | 15 skipped (22)** ✓
- `npm run test -- tests/core/loader.spec.ts` → **22 passed (22)** ✓ (15 baseline + 7 new)
- `npm run test` (full suite) → **644 passed | 1 failed | 2 skipped | 2 todo** — the 1 failure is the pre-existing `tests/main/sampler-worker-girl.spec.ts` issue documented in Issues Encountered (verified pre-existing via stash test before any Plan 22-02 commit).
- `npx tsc --noEmit` → **clean** (no TS errors) ✓

**Commits exist on branch:**

- `49618cf` (test RED) — FOUND in `git log --oneline -5`.
- `07f42ed` (feat GREEN) — FOUND in `git log --oneline -5`.

## Self-Check: PASSED

## Next Plan Readiness

- **Plan 22-03 (core export cap + passthrough)** — ready to start. Loader now produces non-empty `canonicalDimsByRegion` + `actualDimsByRegion`; analyzer (already wired by Plan 22-01) populates `DisplayRow.canonicalW/H` + `DisplayRow.actualSourceW/H` + `DisplayRow.dimsMismatch`. The cap formula in `buildExportPlan` can read these fields directly off `summary.peaks[i]` rows. Plan 22-03 will partition rows into `entries[]` (Lanczos resize) vs `passthroughCopies[]` (byte-copy) per CONTEXT D-04 wording.
- **Plan 22-04 (renderer mirror + image-worker copyFile)** — depends on 22-03 for the canonical export shape. No additional loader changes needed.
- **Plan 22-05 (panels + modal + roundtrip)** — depends on 22-03 + 22-04. The DIMS-05 round-trip integration test will use programmatic PNG mutation per RESEARCH §6 + the now-populated `actualDimsByRegion` from `loadSkeleton()`.

---
*Phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21*
*Completed: 2026-05-03*
