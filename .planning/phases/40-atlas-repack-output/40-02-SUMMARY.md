---
phase: 40-atlas-repack-output
plan: 02
subsystem: atlas-pack
tags: [maxrects-packer, pack-math, determinism, core-purity, rotation, repack]

# Dependency graph
requires:
  - phase: 07-atlas-preview-modal
    provides: maxrects-packer browser-safe runtime precedent (src/core/atlas-preview.ts)
provides:
  - src/core/repack.ts — pure-TS computeRepack(inputs, opts): RepackResult
  - Locked public API (RepackInput / RepackOptions / RepackedRegion / RepackPage / RepackResult)
  - Oversize pre-flight (regionName captured in result.oversize before any packer.add)
  - Deterministic regionName-sort guarantee (loader-mode-invariant per RESEARCH §Landmines #9)
  - Rotation read-back invariant (post-rotation rect.width/height emitted AS-IS per .d.ts:97-98)
affects: [40-03-atlas-writer, 40-05-repack-worker, 40-08-cross-loadermode-parity, 40-10-oversize-error]

# Tech tracking
tech-stack:
  added: []  # maxrects-packer@2.7.3 already in package.json (Phase 7)
  patterns:
    - "Pure-TS pack-planning layer wrapping maxrects-packer with locked public API"
    - "Oversize pre-flight returning regionName[] BEFORE packer.add — enables main/worker to throw locked error string without any sharp work"
    - "Deterministic regionName sort (loader-mode-invariant) as canonical pre-pack ordering for cross-loaderMode parity"

key-files:
  created:
    - src/core/repack.ts
    - tests/core/repack.spec.ts
  modified: []  # tests/arch.spec.ts: auto-scan glob already covers the new file; no carve-out required

key-decisions:
  - "regionName.localeCompare is the canonical pre-pack sort key (loader-mode-invariant per RESEARCH §Landmines #9; REPACK-08 cross-loaderMode parity prerequisite)"
  - "Oversize pre-flight runs BEFORE packer.add so result.oversize is populated even if 0 packable regions remain (REPACK-10 error-path prerequisite)"
  - "Rotation read-back emits packer.rect.width/height AS-IS (post-rotation) per maxrects-packer .d.ts:97-98 — no inverse-swap in this layer"
  - "Packer options: smart:true, pot:false, square:false, border:0 — matches src/core/atlas-preview.ts:110-119 precedent (tight-fit bin sizing per RESEARCH Pitfall 7)"
  - "Layer 3 hygiene preserved without an arch-test carve-out — only maxrects-packer imported at runtime (browser-safe)"

patterns-established:
  - "Pure-TS pack-planning entry: computeRepack(inputs, opts) returning {pages, regions, oversize}"
  - "Oversize-first algorithm: filter inputs by maxPageSize before constructing packer, sort oversize[] deterministically"
  - "MaxRectsPacker without explicit generic + (rect as unknown as {data:T, rot?:boolean}) assertion at fold step (matches atlas-preview.ts pattern)"

requirements-completed:
  - REPACK-02
  - REPACK-06

# Metrics
duration: 4min
completed: 2026-05-14
---

# Phase 40 Plan 02: Pack-Planning Core Summary

**Pure-TS `computeRepack` wrapping maxrects-packer@2.7.3 with oversize pre-flight, deterministic regionName sort, and rotation read-back — the pack-math foundation consumed by Plans 03 (atlas-writer) and 05 (repack-worker).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-14T16:49:35Z
- **Completed:** 2026-05-14T16:53:00Z (approx)
- **Tasks:** 3 (2 source + 1 verification-only)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- `src/core/repack.ts` (149 lines) — locked public API + pure-TS implementation
- `tests/core/repack.spec.ts` (153 lines) — 8 unit tests covering REPACK-02 (6) + REPACK-06 (2)
- Architectural-test passing with NO carve-out added (`src/core/repack.ts` is grep-clean of `sharp`, `node:fs`, `electron`, `react`, DOM)
- `npx tsc --noEmit` exits 0
- `npm run test -- tests/core/repack.spec.ts tests/arch.spec.ts` → 21 tests pass

## Task Commits

1. **Task 02.1: Create src/core/repack.ts** — `3516c2e` (feat)
2. **Task 02.2: Create tests/core/repack.spec.ts** — `b3a9269` (test)
3. **Task 02.3: Verify tests/arch.spec.ts auto-covers repack.ts** — no commit (verification-only; no source modification required because the existing `globSync('src/core/**/*.ts')` block already auto-scans the new file and it is clean)

## Public API (Locked)

Frozen from `<interfaces>` block of 40-02-PLAN.md — all consumer plans compile against THESE exact types:

```typescript
export interface RepackInput {
  regionName: string;
  packW: number;   // sharp-emits-truth: ACTUAL emitted width
  packH: number;   // sharp-emits-truth: ACTUAL emitted height
}

export interface RepackOptions {
  maxPageSize: 1024 | 2048 | 4096 | 8192;
  padding: number;          // 0..16
  allowRotation: boolean;
}

export interface RepackedRegion {
  regionName: string;
  pageIndex: number;        // 0-based
  x: number;
  y: number;
  w: number;                // post-rotation dim on page
  h: number;                // post-rotation dim on page
  rotated: boolean;
}

export interface RepackPage {
  pageIndex: number;
  width: number;
  height: number;
}

export interface RepackResult {
  pages: RepackPage[];
  regions: RepackedRegion[];
  oversize: string[];       // regionNames whose packW/packH > maxPageSize
}

export function computeRepack(inputs: RepackInput[], opts: RepackOptions): RepackResult;
```

## Determinism Strategy

1. **Oversize pre-flight** strips inputs exceeding `maxPageSize` on either axis BEFORE `packer.add` — captures `regionName` into `result.oversize` (sorted via `localeCompare`).
2. **Pre-pack sort** by `regionName.localeCompare(...)` — RESEARCH §Landmines #9 identifies `regionName` as the **only** loader-mode-invariant key. Atlas-source and atlas-less inputs produce identical regionName sets per the `project_strict_loadermode_separation` invariant; sorting on it guarantees identical packer input order across loader modes (Plan 08 SHA256 parity prerequisite).
3. **Packer construction** mirrors `src/core/atlas-preview.ts:110-119` precedent — `smart:true`, `pot:false`, `square:false`, `border:0`, `padding` from opts, `allowRotation` from opts.
4. **Rotation read-back** — packer's `rect.width/height` are ALREADY post-rotation per maxrects-packer `.d.ts:97-98` docblock ("after `rot` is set, `width/height` of this rectangle is swaped"). This module emits them AS-IS. The `rotated` field reads from `rect.rot`.

## Test Coverage Map

| Test                                                                  | Requirement | What it locks                                                                 |
| --------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| determinism: identical inputs produce JSON-identical outputs          | REPACK-02 a | Repeat-invocation byte parity                                                 |
| determinism is stable across input-array shuffling                    | REPACK-02 a | Internal regionName sort is canonical (input order irrelevant)                |
| preserves count: regions.length + oversize.length === inputs.length   | REPACK-02 b | No region silently dropped                                                    |
| within bounds: every region fits inside its assigned page             | REPACK-02 c | `x + w ≤ page.width && y + h ≤ page.height` for every region                  |
| oversize pre-flight: regionName lands in oversize[] and NOT regions[] | REPACK-10   | Worker can throw locked error string from `result.oversize[0]`                |
| page count grows when total region area exceeds maxPageSize²          | REPACK-02   | Spill-to-N-pages works (8 × 900² ≈ 6.48M px in a 1024² cap)                   |
| no rotation when allowRotation is false                               | REPACK-06   | `rotated === false` for every region when feature is off                      |
| rotation when allowRotation is true: rotated w/h are swapped (900/200)| REPACK-06   | When packer DOES rotate, emitted `w/h` reflect the .d.ts:97-98 swap           |

## Files Created/Modified

- **`src/core/repack.ts`** (149 lines, created) — pure-TS pack-planning entry; exports locked public API; oversize pre-flight + regionName sort + maxrects-packer fold.
- **`tests/core/repack.spec.ts`** (153 lines, created) — 8 vitest unit tests; synthetic dim arrays only (no fixtures); <1s runtime.
- **`tests/arch.spec.ts`** (NOT modified) — existing `globSync('src/core/**/*.ts')` block at lines 148-176 auto-covers the new file; verified clean of all forbidden imports without adding a carve-out entry.

## Decisions Made

- **Used `MaxRectsPacker` without an explicit generic parameter** (matches `src/core/atlas-preview.ts:110` precedent). The plan's `<action>` block offered a more elaborate generic typing as one option but explicitly permitted the simpler form; cleaner with the same `(rect as unknown as { data: RepackInput; rot?: boolean })` assertion at the fold step.
- **`oversize` is sorted via `localeCompare`** (not insertion order) so the array order is deterministic across loader modes regardless of input-array ordering — consistent with the canonical regionName sort applied to packable inputs.
- **No 8th rotation-edge test** beyond the two locked: the plan caller treats "may rotate" as packer-internal heuristic — locking exact rotation count would test maxrects-packer's behaviour, not ours. The rotated-w/h test is permissive (`if rotated.length > 0`) so it cannot flake on heuristic drift.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Public API frozen and ready for consumption by Plan 03 (atlas-writer reads `RepackResult.pages` + `RepackResult.regions` to compose page PNGs and emit `.atlas` text).
- Plan 05 (repack-worker) can compose `RepackInput[]` from sharp `metadata()` read-back and pass directly to `computeRepack`.
- Plan 10 (oversize error) reads `result.oversize[0]` to throw the locked REPACK-10 error string.
- Plan 08 (cross-loaderMode parity) can stand the SHA256 baseline on the determinism guarantee proven by Tests 1+2 in `tests/core/repack.spec.ts`.

## Self-Check: PASSED

- File `src/core/repack.ts` exists (149 lines) ✓
- File `tests/core/repack.spec.ts` exists (153 lines) ✓
- Commit `3516c2e` (Task 02.1) present in `git log` ✓
- Commit `b3a9269` (Task 02.2) present in `git log` ✓
- `npx tsc --noEmit` exits 0 ✓
- `npm run test -- tests/core/repack.spec.ts tests/arch.spec.ts` → 21 tests pass ✓
- Forbidden imports in `src/core/repack.ts`: 0 ✓
- `tests/arch.spec.ts` references to `src/core/repack.ts`: 0 (no carve-out added) ✓

---
*Phase: 40-atlas-repack-output*
*Completed: 2026-05-14*
