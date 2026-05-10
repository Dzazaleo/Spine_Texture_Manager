---
phase: 33
plan: 01
status: complete
completed: 2026-05-10
files_created:
  - fixtures/spine_rotated/EXPORT/skeleton.atlas
  - fixtures/spine_rotated/EXPORT/skeleton.json
  - fixtures/spine_rotated/EXPORT/skeleton.png
files_deferred:
  - fixtures/spine_rotated/rotated.spine
requirements_met:
  - ATLAS-04 (partial — fixture committed; .spine source deferred to a follow-up)
---

# Plan 33-01 — Rotated atlas fixture (real Spine packer)

## Result

Real-Spine-packer rotated-atlas regression fixture installed at
`fixtures/spine_rotated/EXPORT/` (68 KB total, well under the 100 KB cap).
Atlas-text contains one rotated region (`rect`) with libgdx `rotate:90`
encoding — spine-core's `TextureAtlas.parse` (TextureAtlas.js:87-93) handles
both `rotate:true` and `rotate:<degrees>` identically by setting
`region.degrees = 90`, so the fixture exercises the same loader path that the
plan's `rotate:true` example would.

## Acceptance verification (all PASS)

| Check | Command | Result |
|-------|---------|--------|
| skeleton.json exists | `test -f fixtures/spine_rotated/EXPORT/skeleton.json` | OK |
| skeleton.atlas exists | `test -f fixtures/spine_rotated/EXPORT/skeleton.atlas` | OK |
| skeleton.png exists | `test -f fixtures/spine_rotated/EXPORT/skeleton.png` | OK |
| atlas contains rotate token | `grep -E "rotate:(true|[0-9]+)" …skeleton.atlas` | `rotate:90` on line 13 |
| JSON parses | `node -e "JSON.parse(…)"` | OK |
| PNG valid | `sharp(…).metadata()` | PNG 1839×1464 |
| Total size ≤ 100K | `du -sk fixtures/spine_rotated/` | **68 KB** |
| NOT gitignored | `git check-ignore …` exits 1 | OK |
| No stale src/tests refs | `grep -rn "fixtures/spine_rotated" tests/ src/` | OK (none) |

## Fixture Shape — verbatim copy targets for Plan 04 / Plan 05

The atlas-text in `fixtures/spine_rotated/EXPORT/skeleton.atlas`:

```
skeleton.png
size:1839,1464
filter:Linear,Linear
pma:true
CIRCLE
bounds:1004,2,699,699
SQUARE
bounds:2,462,1000,1000
TRIANGLE
bounds:1004,703,833,759
rect
bounds:2,360,100,500
rotate:90
```

### Rotated region (load-bearing for ATLAS-01/02/03 tests)

| Field | Value | Notes |
|-------|-------|-------|
| `region_name` | `rect` | The single rotated region |
| `bounds.x` | 2 | packed-x on page |
| `bounds.y` | 360 | packed-y on page |
| `packedW` | 100 | bounds field 3; post-rotation packed width on page |
| `packedH` | 500 | bounds field 4; post-rotation packed height on page |
| `canonicalW` | 500 | = `packedH` (libgdx CCW90 inverts WH) |
| `canonicalH` | 100 | = `packedW` |
| `offsetX` | 0 | no `offsets:` line — Strip Whitespace was OFF |
| `offsetY` | 0 | |
| `originalWidth` | 500 | same as canonicalW (no SW trim) |
| `originalHeight` | 100 | same as canonicalH |
| `rotate` | `90` | spine-core sets `region.degrees = 90` |

### Unrotated regions (control set for ATLAS-02 reference comparison)

| Region | bounds (x,y,w,h) | rotate | Notes |
|--------|------------------|--------|-------|
| `CIRCLE` | 1004, 2, 699, 699 | — | Square aspect, unrotated |
| `SQUARE` | 2, 462, 1000, 1000 | — | Square aspect, unrotated |
| `TRIANGLE` | 1004, 703, 833, 759 | — | ~1.1:1 aspect, unrotated |

### Page metadata

| Field | Value |
|-------|-------|
| page file | `skeleton.png` |
| page size | 1839×1464 |
| filter | Linear,Linear |
| pma | `true` (Premultiplied Alpha — Phase 6 sharp pipeline already handles) |

## Deviations from plan

1. **`.spine` source file deferred.** Plan 33-01 `must_haves.artifacts` lists
   `fixtures/spine_rotated/rotated.spine`. User opted to ship without it and
   drop it in later as a follow-up. Verifier may flag ATLAS-04 as partial —
   acceptable per user decision recorded in the execution conversation.
2. **Atlas uses `rotate:90` not `rotate:true`.** Functionally identical for
   spine-core (`parseInt("90") == 90`, same as `rotate:true → degrees=90`).
   The plan's literal "contains `rotate:true`" string-match assertion is
   superseded by the broader test `rotate:(true|[0-9]+)`.
3. **Source-rectangle was 500w × 100h (wide-short), not 100w × 500h (tall-narrow).**
   Packer chose CCW90 rotation for tighter packing → packed appears at 100×500
   on the page. The aspect-extreme strip approach still triggered the heuristic
   as intended.
4. **Three additional unrotated regions (CIRCLE/SQUARE/TRIANGLE) are in the
   atlas alongside `rect`.** Side effect of the source rig the user authored.
   Provides a useful control set — Plan 04's ATLAS-02 reference comparison
   can use these as known-unrotated baselines.

## Grep hygiene

Per memory `feedback_gitignore_fixtures_check_test_refs`:

```
$ grep -rn "fixtures/spine_rotated" tests/ src/ 2>/dev/null
# (no matches — clean slate before Wave 2 scaffolds land)
```

`.gitignore` reviewed — no `fixtures/spine*` or `spine_*` wildcard entries
that could shadow the new path. `git check-ignore fixtures/spine_rotated/`
exits 1 (path is not ignored).

## Downstream consumers

The values in the "Rotated region" table above MUST appear verbatim in:

- `tests/core/loader-rotation-accept.spec.ts` (Plan 33-04) —
  asserts `atlasSources['rect'].rotated === true` and `degrees === 90`.
- `tests/core/bounds-rotation-aabb.spec.ts` (Plan 33-04) —
  uses `canonicalW=500, canonicalH=100` as the reference unrotated dims.
- `tests/core/export-rotation-dims.spec.ts` (Plan 33-05) —
  expects ExportPlan output dims = canonicalW × canonicalH = 500×100.
- `tests/main/image-worker-rotation.spec.ts` (Plan 33-05) —
  hand-built `atlasSource` row needs `packW=100, packH=500, w=500, h=100,
  offsetX=0, offsetY=0`.
