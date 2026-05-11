---
phase: 33-rotated-atlas-region-support-loader-bounds-export-fixture
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - scripts/probe-sharp-rotate.mjs
  - src/core/errors.ts
  - src/core/loader.ts
  - src/main/image-worker.ts
  - src/main/ipc.ts
  - src/renderer/src/modals/AtlasPreviewModal.tsx
  - src/shared/types.ts
  - tests/core/bounds-rotation-aabb.spec.ts
  - tests/core/export-rotation-dims.spec.ts
  - tests/core/loader-atlas-source-dims.spec.ts
  - tests/core/loader-rotation-accept.spec.ts
  - tests/core/loader.spec.ts
  - tests/core/no-stale-rotation-error.spec.ts
  - tests/main/image-worker-rotation.spec.ts
  - tests/main/image-worker.atlas-extract.spec.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
fixed_in_phase:
  - CR-01 (commit pending — test constants corrected + content-aware pixel assertion added)
  - CR-02 (commit pending — test row data corrected to match real fixture canonical/page-pixel split)
  - WR-03 (commit pending — image-worker forces atlas-extract for rotated regions regardless of per-region PNG presence)
deferred_to_followup:
  - WR-01 (degrees ∈ {180, 270} guard) — Spine 4.2 editor never emits these; deferred per CONTEXT Out-of-Scope
  - WR-02 (SW + rotation test coverage) — real fixture is SW=off; backlog item
  - WR-04 (AtlasPreviewModal jsdom rotation gap) — UAT-by-eye is current safety net; needs node-canvas refactor or Playwright
  - IN-01 (probe-script dead prose), IN-02 (sequence-rotated regions), IN-03 (loader magic-number naming) — minor cleanups
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 33 adds rotated atlas region support across the loader (D-01 attachment-walk
to override RegionAttachment offsets), the image-worker (sharp.rotate(+90) +
canonical-orientation extend), and AtlasPreviewModal (pre-render CW90 into a
temp canvas). The shipping production code is broadly correct — the loader
swap of packW/packH (UAT fix 9bb078a) and the AtlasPreviewModal temp-canvas
pre-rotate (UAT fix 6a025c0) match the libgdx convention documented in
33-01-SUMMARY.md.

However, the test suite as committed does not validate what it advertises:
two of the new specs (`tests/main/image-worker-rotation.spec.ts` and
`tests/core/export-rotation-dims.spec.ts`) bake the canonical-vs-packed roles
INVERTED relative to the real fixture documented in 33-01-SUMMARY.md, and
would pass byte-identically against the pre-9bb078a buggy `packW/packH = canonical W/H`
loader code. This is the test-coverage gap referenced in `<phase_context>`
point (2) — and it remains unfixed.

Additionally, the loader's D-01 walk only handles `region.degrees === 90`
correctly (180/270 silently mis-cook offsets), the Strip-Whitespace + rotation
combo has zero test coverage despite being supported in both the loader and
image-worker, and AtlasPreviewModal's temp-canvas branch silently writes
nothing in jsdom (test env defensively skips draws).

The IPC trust-boundary remains solid — no new attack surface introduced by
this phase, atlas-extract path-traversal defenses preserved.

## Critical Issues

### CR-01: image-worker-rotation.spec.ts uses inverted fixture-shape constants — does not catch the packW/packH bug it was added to lock down

**File:** `tests/main/image-worker-rotation.spec.ts:24-33`
**Issue:**
The header comment claims constants are "verbatim from 33-01-SUMMARY.md
'Fixture Shape' table." 33-01-SUMMARY.md states for the real `rect` region:
- `canonicalW = 100`, `canonicalH = 500` (vertical strip drawn in Spine editor)
- page-pixel `W = 500`, page-pixel `H = 100` (post-pack horizontal slice)

The test file defines:
```ts
const CANONICAL_W = 500;
const CANONICAL_H = 100;
const PACKED_W = 100; // = CANONICAL_H (libgdx CCW90 swaps WH)
const PACKED_H = 500; // = CANONICAL_W
```
These roles are INVERTED. The test then passes `packW=100, packH=500` into
`atlasSource`, so `sharp.extract({width: 100, height: 500})` slices a 100w×500h
chunk starting at (2, 360) — NOT the real 500w×100h rotated rectangle. Because
- the dim assertions only check the post-rotate output shape (which is
  determined arithmetically by `rotate(+90)` on whatever buffer comes in), and
- the `totalAlpha > 0` smoke check is too loose to detect content drift,

the test PASSES even though the worker extracted the wrong page slice. More
damning: if the worker were reverted to the pre-9bb078a code (which used
canonical W/H as extract args), the test would STILL PASS because the test
constants compensate for the bug. This is exactly the regression-prevention
contract this spec was added to enforce, and it does not enforce it.

The dual loader-rotation-accept.spec.ts has the canonical/packed roles
correct (`expect(rect!.w).toBe(100); expect(rect!.packW).toBe(500)`).

**Fix:** Swap the constant assignments to match 33-01-SUMMARY.md and the
companion loader spec:
```ts
const CANONICAL_W = 100;
const CANONICAL_H = 500;
const PACKED_W = 500; // page-pixel W (= libgdx bounds H for rotated)
const PACKED_H = 100; // page-pixel H (= libgdx bounds W for rotated)
```
Then add a content-aware assertion that distinguishes the correct extract
slice from a wrong-coordinates slice — e.g., sample 4 corner pixels of the
rotated output and assert the expected color profile of the `rect`
fixture, OR `sharp(outPath).stats()` channel averages vs a baseline.

---

### CR-02: export-rotation-dims.spec.ts uses inverted canonical dims — assertion is the wrong invariant

**File:** `tests/core/export-rotation-dims.spec.ts:33-55, 80-99`
**Issue:**
Per 33-01-SUMMARY.md, the rotated `rect` region has `canonicalW=100,
canonicalH=500`. The real loader populates the corresponding `DisplayRow`
with `sourceW=100, sourceH=500, canonicalW=100, canonicalH=500` and
`atlasSource: { packW: 500, packH: 100, w: 100, h: 500, rotated: true }`.

The test fixture inverts these:
```ts
sourceW: 500, sourceH: 100,
canonicalW: 500, canonicalH: 100,
atlasSource: {
  packW: 100, // PACKED dims — comment claims "swapped per libgdx CCW90"
  packH: 500,
  w: 500,  // CANONICAL (unrotated) dims — INVERTED vs real fixture
  h: 100,
  rotated: true,
},
```
The assertion `expect(row.outW).toBe(500)` then locks the WRONG invariant.
For the real fixture the correct invariant is `outW === 100, outH === 500`.

This spec is sold (line 19) as proving "ExportPlan output dims MUST equal
canonical (500×100), NOT the packed-swapped form (100×500)." With the
constants flipped, the test would also pass against an implementation that
used `outW = packW × scale` (the bug the test is supposed to prevent),
because `packW × 1.0 = 100` matches the (incorrectly-set) "canonical"-W=500
check ... wait, actually it would fail with `100 !== 500` in that case.
But it would also pass against an implementation that uses
`row.atlasSource.w` (synthetic value 500), which is a different bug pattern
that bypasses the canonicalW field entirely.

More importantly, the test models a hypothetical "wide rect, short height"
canonical that the real fixture does NOT have. Anyone wiring this spec to a
new test should not be misled into thinking they're locking the real fixture
shape.

**Fix:** Re-author with canonical dims matching the real fixture:
```ts
sourceW: 100, sourceH: 500,
canonicalW: 100, canonicalH: 500,
atlasSource: { packW: 500, packH: 100, w: 100, h: 500, rotated: true },
// assertion
expect(row.outW).toBe(100); // canonical W = 100 (NOT packW = 500)
expect(row.outH).toBe(500); // canonical H = 500 (NOT packH = 100)
```
This will make the spec FAIL against the pre-9bb078a code (which would write
`outW = packW × scale = 500` from a `row.atlasSource.w`-or-similar path),
restoring the regression-prevention purpose.

## Warnings

### WR-01: Loader D-01 walk silently mis-cooks offsets for `region.degrees ∈ {180, 270}`

**File:** `src/core/loader.ts:541-543, 562, 587-588`
**Issue:**
The D-01 walk's SWAP formula (`localX2 += region.height * rsX;
localY2 += region.width * rsY;`) is derived for `degrees === 90` only — the
documented comment at line 541-543 acknowledges "ASSUMES region.degrees === 90
only. Spine editor never emits 180/270 in 4.2; if a future export surfaces
non-90° rotation, this path silently misbehaves (deferred per CONTEXT
Out-of-Scope)."

The gate at line 562 is `region.degrees === 0` (skip), which lets ANY non-zero
value through to the 90°-specific math. There's no explicit "is exactly 90"
guard — so if libgdx (or any compatible packer) ever emits `degrees: 180` or
`degrees: 270`, the loader runs the wrong formula and produces silently
incorrect world AABBs without any error/warning surface.

CLAUDE.md fact #2 says spine-core handles the bone chain, but the loader is
overriding spine-core's offset[] computation here — so the responsibility for
correctness sits in this file.

**Fix:** Tighten the gate to `region.degrees === 90` (preserve existing behavior
for the known case) and either explicitly skip non-90° (matching spine-core's
own behavior pre-loader-override) OR throw an actionable error:
```ts
if (!region || region.degrees === 0) continue;
if (region.degrees !== 90) {
  // Out-of-scope per Phase 33 CONTEXT; surface a typed error or a single
  // dev-mode warning so silent mis-cooking cannot ship.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`Phase 33 D-01: unsupported region.degrees=${region.degrees} on '${attachmentName}'; skipping offset override.`);
  }
  continue;
}
```

---

### WR-02: Strip-Whitespace + rotation combo has zero test coverage

**File:** `src/main/image-worker.ts:307-315, 527-565`; tests across phase 33
**Issue:**
Both image-worker paths (passthrough lines 307-315, resize lines 527-552) ship
post-rotation extend logic that depends on `sourceCanvasW = a.rotated ? a.packH
: a.packW` and `sourceCanvasH = a.rotated ? a.packW : a.packH`. The real
fixture (`fixtures/spine_rotated/EXPORT/`) has `offsetX=0, offsetY=0,
packW===canonicalH, packH===canonicalW` — so `sourceCanvasW === a.w` and
`sourceCanvasH === a.h`, and the `if` branch at line 307 / 527 is dead in the
fixture. No test exercises the actual extend-args computation for a
rotated+trimmed region.

The same gap exists at the bounds-rotation-aabb level
(`tests/core/bounds-rotation-aabb.spec.ts:35-51`): the synthetic region is
hard-coded with `offsetX=0, offsetY=0` so the `region.offsetX * rsX` and
`region.offsetY * rsY` terms in the SWAP formula collapse to zero — the test
matrix never proves the formula works for non-zero offsets.

If a future Spine export combines Strip Whitespace + rotation, the production
code may emit wrong extend args (libgdx offsetY is bottom-left; canvas y-axis
is top-down; the rotated buffer's "top of trim" sits at the
`a.h - a.offsetY - sourceCanvasH` location used at lines 309 + 544 — this
flip needs an empirical test).

**Fix:** Add at least one synthetic SW+rotated test at each layer:
- `tests/core/bounds-rotation-aabb.spec.ts`: extend the matrix to include
  non-zero `offsetX`/`offsetY` cases.
- `tests/main/image-worker-rotation.spec.ts`: hand-build a synthetic plan
  row with `offsetX > 0, offsetY > 0` and assert the output PNG content is
  correctly positioned within the orig canvas via sharp pixel sampling.

Without these, the SW+rotation extend formula remains an unverified hypothesis
in shipped code.

---

### WR-03: image-worker per-region path skips rotation handling — silent bug if rotated region has a per-region PNG present

**File:** `src/main/image-worker.ts:317-318, 573-581`
**Issue:**
When the per-region source PNG exists on disk and atlas-source mode is active,
the worker uses `copyFile(sourcePath, tmpPath)` (passthrough, line 318) or
`sharp(sourcePath)` (resize, line 575) directly — with NO rotation handling.
This is correct ONLY if you assume the per-region PNG on disk is already in
canonical orientation (which atlas-less mode guarantees), and that no rotated
atlas-source project ever has matching per-region PNGs.

The loader at lines 676-690 populates `sourcePaths` in atlas-source mode for
every region (including rotated ones), and the worker pre-flights `sourcePath`
FIRST. So a user who has a rotated atlas-source project AND happens to have
non-canonical PNGs at the same path layout would get raw (non-rotated) PNG
content into the export, silently bypassing the rotation-handling branch.

Real-world likelihood is low (per-region PNGs alongside an atlas-only fixture
is unusual), but the contract is: "atlas-source means atlas is authoritative."
Currently the worker silently prefers a non-existent invariant (sourcePath is
canonical-oriented) for atlas-source rotated regions.

**Fix:** When `row.atlasSource.rotated === true`, force the atlas-extract
path even if the per-region PNG exists:
```ts
// after pre-flight access(sourcePath):
if (row.atlasSource?.rotated === true) {
  // Atlas-source mode: per-region PNGs are not guaranteed canonical orientation;
  // route rotated regions through atlas-extract unconditionally.
  useAtlasExtract = true;
}
```
This matches the strict mode-separation invariant from CLAUDE.md memory
(`project_strict_loadermode_separation`).

---

### WR-04: AtlasPreviewModal's temp-canvas branch silently degrades in jsdom — test environment cannot validate rotation

**File:** `src/renderer/src/modals/AtlasPreviewModal.tsx:576-590`
**Issue:**
The rotated-region rendering path creates `document.createElement('canvas')`,
gets its 2D context (`tctx`), and conditionally draws into it. The fallback
on line 580 (`if (tctx)`) silently no-ops if `tctx` is null. jsdom DOES return
a non-null `CanvasRenderingContext2D` stub from `getContext('2d')` BUT it does
not actually rasterize the rotated drawImage — the stub no-ops, so subsequent
`ctx.drawImage(srcImg, ...)` with the temp canvas as srcImg draws nothing
visible.

This means any vitest spec that mounts AtlasPreviewModal with a rotated region
will NOT detect rotation regressions — the modal will render in jsdom whether
or not the rotation math is correct.

There is no compensating screenshot or real-browser test in this phase. The
UAT-driven HUMAN-UAT discovery noted in `<phase_context>` was caught by eye,
not by automation. That signal is fragile.

**Fix:** Either:
1. Add a Playwright/end-to-end test that renders the modal in a real browser
   for the rotated fixture, OR
2. Refactor the rotation math out of the React render path into a pure
   helper (`renderRotatedRegionToCanvas(img, atlasSource): HTMLCanvasElement`),
   then unit-test the helper with `node-canvas` (which actually rasterizes).

The current state is "shipping code we can't regress-test."

## Info

### IN-01: probe-sharp-rotate.mjs has minor comment inaccuracy

**File:** `scripts/probe-sharp-rotate.mjs:69-72`
**Issue:**
Lines 73-79 contain an unused/abandoned mid-derivation comment block
("CCW90 mapping: (x_new, y_new) = ( y_old, W - 1 - x_old ) ... Easier: use
sharp itself") whose "Easier" branch is never taken — the actual code at
lines 93-102 implements the manual pixel-by-pixel CCW90 mapping. The dead
prose adds noise. The probe IS executed and the synthesis IS manual; the
"easier" alternative was rejected.
**Fix:** Trim lines 75-81 down to a one-line "Synthesizing PACKED manually
via CCW90 mapping (x_new, y_new) = (y_old, W-1-x_old)" or just delete the
abandoned alternative.

---

### IN-02: Loader D-01 walk does not handle sequence-bearing rotated attachments

**File:** `src/core/loader.ts:552-613`
**Issue:**
The D-01 walk iterates `skeletonData.skins[*].attachments[*]` and operates on
`RegionAttachment` instances. Spine 4.2 sequence attachments are single
`RegionAttachment` (or `MeshAttachment`) instances with a `sequence` property
that resolves per-frame regions at runtime via `region.region.regionTable`.
The D-01 walk cooks `attachment.offset[]` once based on the initial
`attachment.region` — if the per-frame regions have different `degrees`
values (rotation-mixed sequence frames), the offset cooking is wrong for the
non-base frames.

Likelihood is low (sequence-bearing rotated regions are an uncommon authoring
choice), and CLAUDE.md memory `project_sampler_visibility_invariant` already
flags sampler edge cases for sequence attachments, but the D-01 walk's
"deferred per CONTEXT Out-of-Scope" comment doesn't enumerate this gap.

**Fix:** Document the limitation explicitly in the comment block at line
531-551, or add a `// TODO: sequence-rotated regions are not handled` marker
referencing a follow-up backlog item.

---

### IN-03: Magic numbers without named constants in loader rotation walk

**File:** `src/core/loader.ts:572-607`
**Issue:**
The D-01 walk uses raw `Math.PI / 180`, raw `2` and `4` and `6` and `8` array
indices for `attachment.offset[]`, and inline `-w / 2` / `-h / 2` (half-dim
offsets). The arithmetic mirrors `RegionAttachment.updateRegion()` in
spine-core verbatim, so the magic numbers are semantically faithful — but a
single-line comment naming the index meanings would speed up future audits.
**Fix:** Add a brief comment block over the `off[0]..off[7]` writes naming
the X1Y1/X2Y1/X2Y2/X1Y2 corner mapping that spine-core uses (RegionAttachment
constants `OX1/OY1/OX2/OY2/OX3/OY3/OX4/OY4`).

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
