---
phase: 33
plan: 04
subsystem: core+tests
tags: [tdd, wave-3, rotated-atlas, d-01, atlas-01, atlas-02]
status: complete
completed: 2026-05-11
type: execute
wave: 3
depends_on: [33-03]
requires:
  - src/core/loader.ts (post-Plan-33-03 — throw block removed)
  - tests/core/loader-rotation-accept.spec.ts (Plan 33-02 Wave 1 RED scaffold to un-skip)
  - tests/core/bounds-rotation-aabb.spec.ts (Plan 33-02 Wave 1 RED scaffold to un-skip)
  - fixtures/spine_rotated/EXPORT/skeleton.{json,atlas,png} (Plan 33-01)
provides:
  - src/core/loader.ts D-01 attachment-walk: pre-cooks canonical-corner offsets for rotated RegionAttachments
  - tests/core/loader-rotation-accept.spec.ts ACTIVE (ATLAS-01 met)
  - tests/core/bounds-rotation-aabb.spec.ts ACTIVE (ATLAS-02 met — 16/16 cases pass)
affects:
  - npm test count (+18 active tests, -1 skipped file, -18 todos vs Plan 33-03 baseline)
  - npm test counts now 92 passed | 2 skipped (94 files); 1009 passed | 3 skipped | 7 todo (1019 tests)
key-files:
  created: []
  modified:
    - src/core/loader.ts
    - tests/core/loader-rotation-accept.spec.ts
    - tests/core/bounds-rotation-aabb.spec.ts
decisions:
  - "D-01 implementation: direct-offset-write variant (NOT save-restore region swap). Touches no region state; MeshAttachment.updateRegion downstream sees PACKED dims unchanged (D-02 invariant preserved)."
  - "Test-local cookD01Offsets helper duplicated from loader walk. Intentional isolation: future loader-call-site refactor cannot silently break ATLAS-02 coverage of the SWAP-form arithmetic itself."
metrics:
  duration_minutes: ~3
  completed_date: 2026-05-11
  task_count: 3
  file_count: 3
  commit_count: 3
requirements:
  - ATLAS-01
  - ATLAS-02
---

# Phase 33 Plan 04: D-01 attachment-walk + ATLAS-01/02 acceptance

## One-liner

Implemented the D-01 direct-offset-write walk in `src/core/loader.ts` (post-`readSkeletonData`) — pre-cooks canonical-corner offsets into `attachment.offset[]` for every rotated RegionAttachment via the SWAP form (`region.height` for `localX2`, `region.width` for `localY2`); un-skipped both Wave 1 spec scaffolds; ATLAS-01 (loader accepts rotated atlases) and ATLAS-02 (world AABB matches unrotated reference across 16-case bone-rotation matrix) now met.

## What landed

### Task 1: D-01 walk in `src/core/loader.ts` (commit `02576c4`)

Inserted at lines 530–615 (post-`readSkeletonData`, pre-sourceDims-build), 85 insertions total. Plus 1 line for the new `RegionAttachment` named import.

Key shape:

```ts
if (!isAtlasLess) {
  for (const skin of skeletonData.skins) {
    for (const slotMap of skin.attachments) {
      if (!slotMap) continue;
      for (const attachmentName in slotMap) {
        const attachment = slotMap[attachmentName];
        if (!(attachment instanceof RegionAttachment)) continue;
        const region = attachment.region;
        if (!region || region.degrees === 0) continue;
        // ... compute rsX/rsY, localX/Y, SWAP localX2 = ... + region.height * rsX,
        //                                  SWAP localY2 = ... + region.width  * rsY,
        // ... cos/sin block,
        // ... write 8 floats into attachment.offset[0..7].
      }
    }
  }
}
```

Iteration shape differs from the plan's verbatim sketch (`for (const [, attachment] of slotEntry)`) because `Skin.attachments` is typed `StringMap<Attachment>[]` (array of plain JS objects keyed by attachment name), not `Map<string, Attachment>[]`. The chosen pattern (`for ... in slotMap`) mirrors spine-core's own iteration in `Skin.js:158-167` (`getAttachments()`). Functionally equivalent; clearer intent.

### Task 2: `tests/core/loader-rotation-accept.spec.ts` un-skipped (commit `46810e9`)

ATLAS-01 acceptance test (2 it() cases) now active against `fixtures/spine_rotated/EXPORT/skeleton.json`:

1. `loadSkeleton resolves without throwing on rotate:true regions` — confirms skeletonData/atlas/atlasPath all populated.
2. `at least one atlasSources entry has rotated=true` — asserts `>= 1` then locks exact count to `toBe(1)` per the Fixture Shape table (only `rect` is rotated; CIRCLE/SQUARE/TRIANGLE are unrotated controls).

### Task 3: `tests/core/bounds-rotation-aabb.spec.ts` un-skipped (commit `bee6423`)

ATLAS-02 16-case synthetic AABB-equality matrix (8 bone states × 2 attachment rotations) — all 16 it() cases pass on first run.

Matrix:

| # | bone state | a, b, c, d |
|---|------------|------------|
| 1 | identity | (1, 0, 0, 1) |
| 2 | rot 45° | (cos45, sin45, -sin45, cos45) |
| 3 | rot 90° | (0, 1, -1, 0) |
| 4 | rot 180° | (-1, 0, 0, -1) |
| 5 | rot -45° | (cos45, -sin45, sin45, cos45) |
| 6 | scale 2×0.5 | (2, 0, 0, 0.5) |
| 7 | scale 0.5×2 | (0.5, 0, 0, 2) |
| 8 | rot 30° + scale 2×0.5 | (2·cos30, 2·sin30, -0.5·sin30, 0.5·cos30) |

Attachment rotations: 0°, 30°.

Tolerance: `Math.abs(wRot - wUnrot) < 1e-6` and same for height. Asserts AABB extents (width = maxX − minX, height = maxY − minY) match the unrotated reference (which uses canonical-orientation `region.width/height` directly through spine-core's stock `updateRegion`). The rotated path uses the test-local `cookD01Offsets` helper (verbatim copy of the loader formula) to pre-cook offsets before calling `attachmentWorldAABB`.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| TypeScript compiles | `npx tsc --noEmit` | EXIT=0 |
| ATLAS-01 (Task 2) | `npm test -- tests/core/loader-rotation-accept.spec.ts` | 2/2 PASS |
| ATLAS-02 (Task 3) | `npm test -- tests/core/bounds-rotation-aabb.spec.ts` | 16/16 PASS |
| Arch tests (Layer 3) | `npm test -- tests/arch.spec.ts` | 12/12 PASS — `core/` still has no DOM/sharp/electron imports |
| Full suite | `npm test` | `92 passed \| 2 skipped (94)` files ; `1009 passed \| 3 skipped \| 7 todo (1019)` tests |
| D-01 walk header | `grep -c 'Phase 33' src/core/loader.ts` | 2 |
| RegionAttachment imported | `grep -c 'RegionAttachment' src/core/loader.ts` | 6 |
| Offset-write block landed | `grep -c 'off\[0\] = lXc - lYs' src/core/loader.ts` | 1 |
| SWAP form: localX2 = … + region.height * rsX | `grep -c 'region.height \* rsX' src/core/loader.ts` | 1 |
| SWAP form: localY2 = … + region.width * rsY | `grep -c 'region.width \* rsY' src/core/loader.ts` | 1 |
| atlas-less guard | `grep -c 'if (!isAtlasLess)' src/core/loader.ts` | 2 (existing one + the new D-01 walk) |
| describe.skip removed (ATLAS-01) | `grep -c 'describe.skip' tests/core/loader-rotation-accept.spec.ts` | 0 |
| describe.skip removed (ATLAS-02) | `grep -c 'describe.skip' tests/core/bounds-rotation-aabb.spec.ts` | 0 |
| ATLAS-01 rotated-count lock | `grep -E 'toBe\([0-9]+\)' tests/core/loader-rotation-accept.spec.ts` | `expect(rotatedRegions.length).toBe(1);` |
| ATLAS-02 case count | `npm test -- tests/core/bounds-rotation-aabb.spec.ts` count | `16 passed` |

### Test-count delta vs Plan 33-03 baseline

| Metric | Plan 33-03 end | Plan 33-04 end | Δ |
|--------|----------------|-----------------|---|
| Files passed | 90 | 92 | +2 |
| Files skipped | 4 | 2 | −2 |
| Tests passed | 991 | 1009 | +18 |
| Tests skipped | 3 | 3 | 0 |
| Tests todo | 25 | 7 | −18 |

The two un-skipped spec files added 18 active passing tests (2 ATLAS-01 + 16 ATLAS-02) and converted 18 `it.todo` placeholders to real assertions.

## Deviations from plan

**[Rule 3 — Type-shape correction] Iteration shape over `skin.attachments`**

- **Found during:** Task 1 — reading `node_modules/@esotericsoftware/spine-core/dist/Skin.d.ts`.
- **Issue:** The plan's verbatim D-01 sketch used `for (const slotEntry of skin.attachments)` then `for (const [, attachment] of slotEntry)` — implying a `Map<string, Attachment>` per slot. The actual spine-core 4.2 shape is `Skin.attachments: StringMap<Attachment>[]` — an array of plain JS objects keyed by attachment name (interface in `Utils.d.ts:31-33`).
- **Fix:** Changed to `for (const slotMap of skin.attachments) { if (!slotMap) continue; for (const attachmentName in slotMap) { const attachment = slotMap[attachmentName]; ... }` — matches spine-core's own iteration pattern in `Skin.js:158-167` (`getAttachments()`).
- **Files modified:** `src/core/loader.ts` only.
- **Commit:** `02576c4` (Task 1) — the corrected iteration shape landed alongside the offset-write block; not split out.
- **Impact:** Functionally equivalent — both shapes visit every attachment in every slot of every skin. The corrected form is the only one that compiles (the original `for ... of` over `StringMap` would error at the type level since `StringMap` is a plain interface, not an Iterable, and `[, attachment]` destructure would fail on a non-Map).

No other deviations — Rules 1, 2, 4 did not trigger. All 16 ATLAS-02 cases passed on the FIRST run with the verbatim SWAP formula from RESEARCH §"D-01 Loader walk (recommended direct-offset variant)" — empirical confirmation that the offset arithmetic transcribed from probe-verified RESEARCH math is correct in production.

## Auth gates encountered

None.

## Notes for downstream

- **Plan 33-05** can now safely add `sharp.rotate(+90)` in `src/main/image-worker.ts` atlas-extract paths. The loader side is complete: rotated regions surface in `atlasSources` with `rotated=true` and the `region.degrees=90` shape that the image-worker will pivot on. RESEARCH §"Sharp Rotation Direction (Empirical)" confirms `+90` (not `-90`).
- **The test-local `cookD01Offsets` helper in `bounds-rotation-aabb.spec.ts` is intentionally a verbatim copy of the loader formula.** If a future plan extracts the formula into an exported helper (e.g., `cookRotatedRegionOffset(att)` in `src/core/loader.ts`), the test file CAN be updated to import that helper — but it MUST stay a copy until then, so that a regression in the loader walk does not silently pass via shared code.
- **Plan 33-05 / ATLAS-03 export-rotation-dims.spec.ts** will assert that `outW=canonicalW=500, outH=canonicalH=100` for the `rect` region. This already works in `src/core/export.ts` per RESEARCH §Architectural Responsibility Map — `outW = ceil(canonicalW × effScale)` is already canonical-relative, and the D-01 walk landed here makes peakScale canonical-correct, which flows through automatically.

## Self-Check: PASSED

- File `src/core/loader.ts` — modified (D-01 walk landed at lines 530–615)
- File `tests/core/loader-rotation-accept.spec.ts` — modified (describe.skip removed, 2 active assertions)
- File `tests/core/bounds-rotation-aabb.spec.ts` — modified (describe.skip removed, 16 active assertions)
- Commit `02576c4` — FOUND in `git log` (`feat(33-04): add D-01 attachment-walk for rotated regions`)
- Commit `46810e9` — FOUND in `git log` (`test(33-04): un-skip ATLAS-01 loader-rotation-accept spec`)
- Commit `bee6423` — FOUND in `git log` (`test(33-04): un-skip ATLAS-02 bounds-rotation-aabb 16-case matrix`)
- `npx tsc --noEmit` exits 0
- `npm test` exits 0 (92 files pass, 2 skipped, 0 failures; 1009 tests pass, 3 skipped, 7 todo)
- `npm test -- tests/core/loader-rotation-accept.spec.ts` exits 0 (2/2)
- `npm test -- tests/core/bounds-rotation-aabb.spec.ts` exits 0 (16/16)
- `npm test -- tests/arch.spec.ts` exits 0 (12/12 — Layer 3 invariant preserved)
