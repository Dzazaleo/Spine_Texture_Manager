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
| `bounds.x` | 2 | left-x on page |
| `bounds.y` | 360 | top-y on page |
| `bounds W (field 3)` | 100 | libgdx convention: CANONICAL (pre-rotation) W |
| `bounds H (field 4)` | 500 | libgdx convention: CANONICAL (pre-rotation) H |
| `canonicalW` | 100 | source rectangle width (vertical strip drawn in Spine editor) |
| `canonicalH` | 500 | source rectangle height |
| `page-pixel W` | 500 | actual horizontal extent on the page (= `bounds H` for rotated) — used as `sharp.extract.width` |
| `page-pixel H` | 100 | actual vertical extent on the page (= `bounds W` for rotated) — used as `sharp.extract.height` |
| `offsetX` | 0 | no `offsets:` line — Strip Whitespace was OFF |
| `offsetY` | 0 | |
| `originalWidth` | 100 | spine-core falls back to bounds W when no offsets line (= canonicalW here) |
| `originalHeight` | 500 | spine-core falls back to bounds H when no offsets line (= canonicalH here) |
| `rotate` | `90` | spine-core sets `region.degrees = 90` |

**libgdx atlas convention (clarification — earlier draft of this table had
canonical and page-pixel swapped):** For rotated regions, `bounds:x,y,W,H`
stores W/H in CANONICAL (pre-rotation) orientation. The packer rotates the
source 90° CCW to fit it on the page, so the actual page-pixel rectangle
has dimensions (H × W) — height-of-canonical horizontally and
width-of-canonical vertically. spine-core's `TextureAtlas.js:164-167`
encodes this by computing `u2 = (x + region.height) / page.width` and
`v2 = (y + region.width) / page.height` when `degrees==90`. The loader
honors this by writing `atlasSources.{w, h}` as canonical and
`atlasSources.{packW, packH}` as page-pixel (with the swap applied for
rotated regions). The fix landed in commit `b96e6c8...` (next commit) after
HUMAN-UAT surfaced the cascade.

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

- `tests/core/loader-rotation-accept.spec.ts` (Plan 33-04 + UAT fix) —
  asserts `atlasSources['rect'].rotated === true`, `degrees === 90`,
  `w === 100, h === 500` (canonical), and `packW === 500, packH === 100`
  (page-pixel).
- `tests/core/bounds-rotation-aabb.spec.ts` (Plan 33-04) —
  synthetic test data; uses canonical W/H to seed the AABB math.
- `tests/core/export-rotation-dims.spec.ts` (Plan 33-05) —
  expects ExportPlan output dims to match canonical source dims (the test
  uses its own synthetic row; per the libgdx convention canonical = the
  user-facing "Source W×H").
- `tests/main/image-worker-rotation.spec.ts` (Plan 33-05) —
  hand-built `atlasSource` row uses page-pixel `packW/packH` for the
  sharp.extract call and canonical `w/h` for the canvas-extend math.

**For the real fixture row (`rect`):**
- canonical: `w=100, h=500`
- page-pixel: `packW=500, packH=100`
- offsets: `offsetX=0, offsetY=0`
- rotated: `true`, `degrees=90`
