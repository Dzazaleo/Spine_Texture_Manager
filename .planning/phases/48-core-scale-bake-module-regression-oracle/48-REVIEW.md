---
phase: 48-core-scale-bake-module-regression-oracle
reviewed: 2026-05-22T12:39:18Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/core/scale-bake.ts
  - tests/scale-bake.spec.ts
  - tests/core/scale-bake.spec.ts
  - tests/arch.spec.ts
  - tests/safe01/discover-fixtures.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 48: Code Review Report

**Reviewed:** 2026-05-22T12:39:18Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 48 promotes the validated spike-002 JSON->JSON similarity bake into
`src/core/scale-bake.ts` as a pure Layer-3 module, plus a sampling-free
regression oracle (`tests/scale-bake.spec.ts`), unit tests
(`tests/core/scale-bake.spec.ts`), an `arch.spec.ts` purity anchor, and a
`discover-fixtures.ts` denylist extension.

I verified the bake math field-by-field against the actual installed spine-core
sources (`node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` for 4.3
and `node_modules/spine-core-42/dist/SkeletonJson.js` for 4.2). **The bake math
is correct and source-faithful.** Notably, three places where the promoted module
DIVERGES from the original spike are all corrections of spike bugs, each confirmed
against the canonical source:

- **path `limit`** — the spike scaled `c.limit` on the *path* branch; `limit` is a
  *physics* field (SkeletonJson 4.3:299 / 4.2:238). The module correctly drops it.
- **path mode-gating** — the spike used `positionMode !== 'percent'` and
  `spacingMode === 'length' || 'proportional'`. Source (4.3:275-279, 4.2:210-213)
  is `position` iff `Fixed`, `spacing` iff `Length || Fixed`. The module is correct.
- **deform `curve`** — the spike scaled the deform mix bezier via `scaleCurve`;
  source reads it with `readCurve(..., scale=1)` (4.3:1172), so it must NOT be
  scaled. The module correctly leaves it untouched.

The slider remap (`from *= ps`, `scale /= ps`), IK softness-timeline curve
(`curve[5]/[7]` only), transform `properties`/`to` offset/max/scale, weighted-mesh
`scaleVertices` stride, and physics-x/y-stay-unscaled are all byte-faithful to the
sources. Mutation safety (clone-first), the D-09 degenerate-`s` guard, and the D-10
assert-known guards are correct and tested. All 68 bake tests, the safe01 suite (44
pass / 3 skip), and arch.spec (17 pass) are green. The denylist `startsWith`
prefixes are precise (trailing-slash terminated; no over-match against
`SIMPLE_PROJECT`, `SCALE_BAKE_*`, etc.). Every oracle matrix fixture exists, is
git-tracked, and genuinely exercises its targeted branch (verified: SLIDER-01 has a
spatial-`x` bone-bound slider; spineboy has 5 eight-float IK curves; PATH_FIXED has
a Fixed/Fixed path with a position timeline).

No BLOCKER-class defects found. The findings below are oracle-scope-clarity items
and one review-artifact cleanup; none changes the correctness verdict.

## Warnings

### WR-01: Oracle deep-compare is one-directional and length-clamped — "two-sided equality" header overclaims

**File:** `tests/scale-bake.spec.ts:151-158` (and the duplicated header claim at lines 44-49)
**Issue:** `fieldMismatches` only walks keys present in the *baked* (`a`) side and
only compares them `if (k in b)` (line 157), and arrays are compared over
`Math.min(a.length, b.length)` (line 152). Consequently the comparison is blind to:
(1) a field present in `ref` but absent in `baked` (under-emit), and (2) array-length
divergence (dropped/added elements). The header comment (lines 44-49) asserts the
oracle "catches BOTH over- and under-scaling ... by construction." That is true only
for *value* divergence on numeric leaves that exist on BOTH sides — it is NOT true
for *structural* divergence. In practice this is safe because both sides parse a
structurally-identical JSON shape (the bake is purely multiplicative and never
adds/removes keys or array elements), so the two `SkeletonData` trees are guaranteed
isomorphic. But the gate's stated guarantee is stronger than what the code enforces;
a future bake change that *did* alter structure (e.g. a regression that drops a
keyframe) could pass the oracle silently.
**Fix:** Either tighten the comparison to be symmetric and length-strict, or downscope
the header claim. Minimal hardening — flag array-length and key-set asymmetry:
```ts
if (Array.isArray(a) && Array.isArray(b)) {
  if (a.length !== b.length) mism.set(`${p}[].length`, (mism.get(`${p}[].length`) ?? 0) + 1);
  for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${p}[]`);
  return;
}
// after the for-of over Object.keys(a), also flag ref-only keys:
for (const k of Object.keys(b)) {
  if (SKIP.has(k) || typeof b[k] === 'function') continue;
  if (!(k in a)) mism.set(p ? `${p}.${k}` : k, (mism.get(p ? `${p}.${k}` : k) ?? 0) + 1);
}
```
(If the symmetric form is rejected to preserve verbatim-spike provenance, then at
minimum reword the lines 44-49 header to scope the guarantee to "shared numeric
leaf fields," so the gate is not trusted beyond what it checks.)

### WR-02: Review scratch file left in the tree — `tests/_tmp_probe/lm-probe.spec.ts`

**File:** `tests/_tmp_probe/lm-probe.spec.ts` (created during this review)
**Issue:** While verifying the `linkedmesh` width/height question (see IN-01), I
created a probe spec under `tests/_tmp_probe/`. The sandboxed review environment
refused to delete it, so I reduced it to a harmless placeholder test (1 passing
no-op). It is currently UNTRACKED (`?? tests/_tmp_probe/`), so it will not enter the
source commit unless explicitly `git add`-ed — but it should not be left in the
working tree, and if added it would be dead test code.
**Fix:** The orchestrator should delete the directory before/after committing:
```bash
rm -rf tests/_tmp_probe
```
Do NOT `git add tests/_tmp_probe/`.

## Info

### IN-01: `linkedmesh` width/height intentionally unscaled — verified harmless (documenting the analysis)

**File:** `src/core/scale-bake.ts:144,158-159`
**Issue:** The bake recognizes `linkedmesh` as a no-geometry type and does NOT scale
its `width`/`height`, even though both spine-core sources DO scale them at parse
(`mesh.width = getValue(map,"width",0) * scale`, shared `case "mesh": case
"linkedmesh":` at 4.3:579-region / 4.2). The SCALE_BAKE_4_3 (DEMON) oracle fixture
contains 17 linkedmesh attachments that carry real width/height (e.g. 641x1087).
This *looks* like an under-scaling divergence, but it is provably harmless:
`MeshAttachment.setSourceMesh` (MeshAttachment.js:102-103) OVERWRITES the linkedmesh's
width/height with the *source* mesh's width/height during `LinkedMesh` resolution
(SkeletonJson 4.3:430). The source mesh IS a regular `mesh` type whose width/height
the bake scales, so the final resolved value is identical on both sides. I confirmed
this empirically: baked-vs-ref linkedmesh `DEMON/BODY_TOP` both resolve to 320.5x543.5
(= 641x1087 x 0.5). No action needed; the module comment is accurate.
**Fix:** None required. Optionally extend the inline comment to note "width/height in
the linkedmesh JSON is dead post-resolution (setSourceMesh overwrites it)," so a
future reader does not re-flag this as a missing scale (as I initially did).

### IN-02: `constraintsOf` would double-process if both 4.2-split and 4.3-unified schemas coexist

**File:** `src/core/scale-bake.ts:50-59`
**Issue:** `constraintsOf` unconditionally concatenates `j.constraints[]` (4.3) AND
`j.transform/ik/path/physics/slider[]` (4.2). A real Spine export emits exactly one
schema, so this never fires in practice — but a malformed JSON carrying both would
have its constraints scaled twice (and the 4.3-unified ones counted once more). This
is a latent input-contract assumption, identical to the spike's behavior (not a
regression), and the oracle's real fixtures never hit it.
**Fix:** Low priority. If hardening is wanted, gate the split arrays on the absence of
the unified array:
```ts
if (Array.isArray(j.constraints)) {
  for (const c of j.constraints) out.push([c.type, c]);
} else {
  for (const c of j.transform || []) out.push(['transform', c]);
  // ...ik/path/physics/slider
}
```

### IN-03: D-10 attachment/constraint guards are content-driven, not schema-version-driven

**File:** `src/core/scale-bake.ts:85-86,100,144`
**Issue:** `CONSTRAINT_TYPES` and `ATTACHMENT_TYPES` are flat sets shared across both
schema versions. A 4.2 rig that (per a future spine editor) introduces `slider` in a
split `j.slider[]` array would be accepted, and a 4.3 type the editor renames would
throw `unknown constraint type`. This is the intended assert-known design (D-10) and
is correct for the 4.2/4.3 surface today; the note is only to flag that the guard
couples "recognized" to a static type list rather than to the rig's declared
`skeleton.spine` version. No bug — the bake is deliberately version-agnostic on the
geometry discriminators.
**Fix:** None required. The static allow-list is the correct D-10 design.

---

_Reviewed: 2026-05-22T12:39:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
