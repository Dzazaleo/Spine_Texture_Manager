# Phase 48: Core Scale-Bake Module + Regression Oracle - Research

**Researched:** 2026-05-22
**Domain:** Spine `SkeletonJson.scale` field-rule replication (JSON→JSON), CI regression-oracle fixture coverage, git fixture-commit safety
**Confidence:** HIGH (every claim below verified by running the actual oracle against the actual on-disk fixtures, or transcribed from the spine-core source)

## Summary

The math is de-risked and was NOT re-derived. This research did three things the planner needs and the
spikes did not finish: (1) it ran the spike bake against **every relevant on-disk fixture** and produced
an exact per-channel coverage matrix with pass/fail evidence; (2) it transcribed the **authoritative
`* this.scale` rule list** from both `SkeletonJson.js` sources and found **two places where the spike
prototype diverges from the source** (path position/spacing mode-gating, and a deform-container-key claim
in CONTEXT that is inverted); (3) it verified, by re-running the oracle, the **exact corrected code** for
the two failing timeline channels and the slider remap. The PATH length-mode timeline channel has **zero
fixture coverage anywhere on disk** and is the one genuine residual-fixture gap.

**Primary recommendation:** Promote `baker.mjs` (NOT `bake.mjs` — see Pitfall 1) as the base; add three
small channel fixes (Pitfall 2/3/4, all verified field-identical here); commit DEMON + TEST_01 +
**one 4.2 ik-softness-curve rig (TEST_03)** by COPYING json+atlas into new non-ignored dirs; author **one
tiny synthetic 4.3 path-Fixed-mode fixture** to cover the only uncovered channel; rely on already-tracked
`spineboy_4.3` / `SLIDER_4_3` / `SIMPLE_PROJECT_43` / `SIMPLE_PROJECT` for the rest.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from CONTEXT § Decisions)
- **D-01:** Matrix = tracked redistributables for breadth + real spike-validated rigs as anchors + standalone authored fixtures only for residual gaps.
- **D-02:** `fixtures/DEMON/SKINS_SPINE_V02.json` + `.atlas` committed as a PUBLIC fixture (owner confirmed) — real 4.3 stress rig (`spine 4.3.02`; transform + ik + physics + slider; mesh). Anchors 4.3 all-constraint-types + slider coverage.
- **D-03:** `fixtures/MON_FILES/EXPORT/TEST_01/4.2/TEST_01.json` + `.atlas` committed as a PUBLIC fixture (owner confirmed) — deform-heavy 4.2 anchor (`spine 4.2.43`; transform×15 ik×8 path×14 physics×51; deform×18). Closes deform + PATH + all-four 4.2 constraint types in one rig.
- **D-04:** Fixtures committed as JSON + `.atlas` ONLY — ALL PNGs EXCLUDED (PNG-exclusion = the IP-protection mechanism; `.atlas` is plain text, no pixel data). Oracle builds the atlas directly from `.atlas` text (`new Spine.TextureAtlas(atlasText, stubLoader)`), NOT loader disk-probing for a page PNG. MUST verify fixtures are tracked + reachable on a fresh clone.
- **D-04a:** Only PNGs carry confidential art → the fixture matrix is NOT IP-constrained; `.json`+`.atlas` of ANY in-house rig may be committed freely. Prefer real rigs over synthetic.
- **D-05:** Residual gaps after DEMON + TEST_01 + tracked redistributables — candidates: a 4.3 PATH constraint, and a PATH position/spacing length-mode TIMELINE. Prefer closing with a REAL rig (json+atlas); author synthetic ONLY if no real rig covers the gap. Researcher must confirm coverage before authoring. ← **THIS RESEARCH RESOLVES D-05.**
- **D-06:** Gap-fillers, when needed, are standalone committed fixtures (real `.json` + minimal `.atlas`), NOT synthetic test-time injection.
- **D-06a:** FIXTURE-COMMIT SAFETY (planner: explicit separate task). Defense order: (1) COPY json+atlas into a NEW non-ignored dir; (2) prove tracked via `git check-ignore` / `git ls-files --error-unmatch` / `git archive HEAD | tar -t | grep`; (3) NO `skipIf(!exists)` — hard-fail on missing fixture; (4) authoritative signal is the watched per-OS CI run (ci.yml AND release.yml).
- **D-07:** Fix-and-verify ALL THREE finished channels, each gated by an in-repo fixture: (1) IK softness-timeline curve (scale `cy`, leave `mix` unscaled); (2) PATH position/spacing length-mode timelines; (3) Slider remap slope (`scale`/`propertyScale`, 4.3).
- **D-08:** The oracle catches both over- AND under-scaling, so "must stay unscaled" negatives need no separate assertions.
- **D-09:** `bake(json, s)` is direction-agnostic — valid for any finite `s > 0`; rejects ONLY degenerate input (`s ≤ 0`, `NaN`, `±Infinity`). The scaled-down product constraint lives at the export/UI edge (phases 49–50), not in core.
- **D-10:** Assert-known: throw a typed error on an unrecognized type discriminator (`attachment.type` / `constraint.type` / scalable-timeline name not in the rule table). Only type discriminators are asserted; non-geometry fields are freely ignored.
- **L-01..L-07:** Carry-forwards (see CONTEXT). L-07 (deform container key) — **see Pitfall 1: CONTEXT's bake.mjs/baker.mjs attribution is inverted; baker.mjs is the corrected one.**

### Claude's Discretion (verbatim)
- Module file name / exported function signature (e.g. `core/scale-bake.ts` `bake(json, s)`), internal helper structure, typed-error class name/shape, and exactly which scale factors the CI oracle iterates (spike used 0.5 + odd 0.26 — at least one non-round factor is wise). The oracle's cycle-safe deep-compare from the spike is the reference implementation to promote.

### Deferred Ideas (OUT OF SCOPE)
- Upscaling (`s > 1`) as a user-facing feature; per-attachment override sharing across scales; `3Queens`/`Girl` rigs unless a residual gap needs them; placeholder PNGs for Phase 49–51 export tests. Variant export / sizing / UI / batch (phases 49–51).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BAKE-01 | Scaled JSON's parsed `SkeletonData` field-identical to original parsed at `SkeletonJson.scale=s` (CI oracle, exclude parse-assigned ids) | Oracle pattern verified working (`baker.mjs:96–121` style); SKIP-set + 1e-3 tol confirmed; runs green today on DEMON/SIMPLE/TEST_01/SIMPLE_43/XTRA01 |
| BAKE-02 | Faithful for both 4.2 (split `transform/ik/path/physics[]`) and 4.3 (unified `constraints[]`) | Both `SkeletonJson.js` sources transcribed; value rules confirmed identical, only schema shape differs; 4.2 anchor = TEST_01, 4.3 anchor = DEMON, both pass today |
| BAKE-03 | Every constraint construct incl. remaining timeline curve channels (IK `softness` curve; PATH position/spacing length-mode) + scaled-default injections (`physics.limit`, `referenceScale`) | Exact authoritative rules transcribed (see Architecture Patterns); corrected IK-curve + slider fixes verified field-identical here; PATH-length-timeline gap identified + synthetic fixture spec given |
| BAKE-04 | Oracle runs in CI across a matrix incl. a deform-heavy rig + ≥1 all-constraint-types rig per runtime; bake module stays Layer-3 pure | Coverage matrix + commit-safety recipe below; `arch.spec.ts` `src/core/**` scanner auto-covers a new `src/core/scale-bake.ts`; oracle test in `tests/` is exempt from the both-specifier guard (precedent: `tests/runtime/runtime-distinctness.spec.ts`) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JSON→JSON scale bake | Core (Layer-3 pure TS) | — | Pure data transform; no DOM/Electron/sharp/fs; first feature that *writes* a skeleton JSON (returns new object, never mutates source — L-05) |
| Field-identity oracle | Test harness (`tests/`) | Core (consumes bake) | Tests may import spine-core directly + both alias specifiers; not bound by `src/**` purity/co-mingle guards |
| Atlas acquisition for oracle | Test harness | — | Build atlas from `.atlas` text via `new Spine.TextureAtlas(text, stubLoader)` (D-04) — bypasses `loadSkeleton` PNG/version gating; bulletproof with PNGs absent |
| Runtime selection (4.2 vs 4.3) | Test harness | — | Pick `Spine42`/`Spine43` module by the rig's `skeleton.spine` major.minor (the bake is runtime-agnostic) |

## Standard Stack

This is an internal-code phase — no new dependencies. The "stack" is the existing project deps used as-is.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-core` | 4.3.0 | 4.3 reference parse (`SkeletonJson.scale`) + authoritative rule source | Already a dep; the bake mirrors THIS code [VERIFIED: `node -e require(...).version`] |
| `spine-core-42` (npm alias) | 4.2.111 | 4.2 reference parse + authoritative rule source | Already a dep (alias) [VERIFIED] |
| `vitest` | (project pinned) | Oracle CI test runner | Existing test matrix; `setupFiles: ['tests/setup/esm-adapter-resolver.ts']` [VERIFIED: vitest.config.ts:23] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `new Spine.TextureAtlas(atlasText, stubLoader)` (D-04) | `loadSkeleton(src).atlas` (spike harness) | `loadSkeleton` REJECTS beta in-band versions and disk-probes — fine for the stable anchors, but D-04's direct-from-text path is mandatory for PNG-absent safety and is the only safe path if any beta rig is ever added. Use D-04's approach. |

**Installation:** none (no new packages).

## Architecture Patterns

### System Architecture Diagram

```
                          source skeleton JSON (read-only)
                                      │
                                      ▼
                       ┌─────────────────────────────┐
   scale factor s ───► │  bake(json, s)  [core/]      │  ← pure: clone → walk → ×rule → return NEW json
   (finite, >0)        │  • degenerate-s guard (D-09) │     (source never mutated, L-05)
                       │  • assert-known guard (D-10) │
                       └──────────────┬──────────────┘
                                      │ baked JSON (scale baked in)
                  ┌───────────────────┴───────────────────┐
                  ▼ (oracle test only)                     ▼ (Phase 49 — out of scope)
        parse(baked, scale=1)                      export pipeline
                  │                                         
                  │     parse(source, scale=s)  ◄── reference side, generated LIVE
                  ▼            │
        SkeletonData  ◄════════╪════════►  SkeletonData
                  └──── cycle-safe deep-compare (1e-3 rel tol, SKIP refs+ids) ────┘
                                      │
                              FIELD-IDENTICAL  ⇒  bake ≡ Spine's own scaling
```

Atlas for both parse sides: built once from the rig's `.atlas` TEXT (D-04), shared. No PNG bytes read.

### Recommended Project Structure
```
src/core/
└── scale-bake.ts          # the promoted pure bake + typed errors (Claude's-discretion name)
tests/
└── (scale-bake oracle)    # field-identity oracle across the fixture matrix; imports both spine-core
fixtures/
├── SCALE_BAKE_4_3/        # NEW non-ignored dir: COPIED DEMON json+atlas (no PNGs) — see D-06a recipe
├── SCALE_BAKE_4_2/        # NEW non-ignored dir: COPIED TEST_01 (+ TEST_03 for 4.2 ik-curve) json+atlas
└── SCALE_BAKE_PATH_43/    # NEW: tiny SYNTHETIC 4.3 path-Fixed-mode fixture (only uncovered channel)
```
(Already-tracked `spineboy_4.3`, `SLIDER_4_3`, `SIMPLE_PROJECT_43`, `SIMPLE_PROJECT` are reused in place.)

### Pattern 1: The authoritative `* this.scale` rule list (transcribed, NOT value-diffed)

[CITED: `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` and `node_modules/spine-core-42/dist/SkeletonJson.js`]
**Value rules are identical across 4.2 and 4.3; only the schema shape differs** (4.2 split `transform/ik/path/physics[]`; 4.3 unified `constraints[]` + `slider` + property-remap which 4.2 lacks). Line numbers are 4.3 / 4.2.

| Field | Rule | 4.3 line | 4.2 line |
|-------|------|----------|----------|
| `skeleton.referenceScale` | `getValue(…,100) * s` — **inject 100×s when absent** | 73 | 72 |
| bone `length`,`x`,`y` | ×s (scaleX/Y/rotation/shear* unchanged) | 87–90 | 86–88 |
| ik `softness` (setup) | ×s | 153 | 142 |
| transform `x`,`y` offsets (setup) | ×s (rotation/scaleX/scaleY/shearY offsets ×1) | 233–234 | 172–173 |
| transform remap `from.offset` | ×`propertyScale(srcProp)` = s iff srcProp∈{x,y} else ×1 | 184 | (4.3 only) |
| transform remap `to.offset`,`to.max` | ×`toScale` = s iff tgtProp∈{x,y} else ×1 | 224–225 | (4.3 only) |
| transform remap `to.scale` (SLOPE) | ×`toScale/fromScale` → **×1/s for spatial→angle** | 226 | (4.3 only) |
| path `position` (setup) | ×s **iff `positionMode===Fixed`** (default Percent) | 274–276 | 209–211 |
| path `spacing` (setup) | ×s **iff `spacingMode===Length` OR `Fixed`** (default Length) | 277–279 | 212–214 |
| physics `limit` | `getValue(…,5000) * s` — **inject 5000×s when absent** | 299 | 238 |
| physics `x`,`y` | **NOT scaled** (L-03) | 294–295 | — |
| slider `from` (4.3, if `bone`) | ×`propertyScale(property)` = s iff property∈{x,y} | 334 | (4.3 only) |
| slider `scale` (4.3, SLOPE) | ÷`propertyScale(property)` → /s iff property∈{x,y} | 336 | (4.3 only) |
| region `x`,`y`,`width`,`height` | ×s | 529–535 | 374–380 |
| mesh `width`,`height` + vertices | ×s; weighted = bound positions only (`v[i+1],v[i+2]`) | 563–564, 665–666 | 410–411, 503–504 |
| path-attachment `lengths[]` + vertices | ×s | 597, (verts) | 438, (verts) |
| boundingbox/clipping/point vertices,x,y | ×s | 608–609 | 449–450 |
| timeline `translate`/`translatex`/`translatey` value + curve cy | ×s | 850–856 | (readTimeline) |
| timeline `deform` keyframe `vertices` | ×s; **deform curve is normalized 0..1 → NOT scaled** (L-03) | (readTimeline) | (readVertices) |
| timeline ik `softness` value + **its cy** | value ×s; **curve cy for the SOFTNESS channel ×s, MIX channel cy ×1** | 904/914/918 | 736/746 |
| timeline path `position` value+cy | ×s **iff positionMode===Fixed** | 994 | 830 |
| timeline path `spacing` value+cy | ×s **iff spacingMode===Length\|\|Fixed** | 999 | 834 |

**`propertyScale(type, scale)`** [CITED: 4.3 SkeletonJson.js:510–516] returns `scale` for `"x"`/`"y"`, else `1`.
**`Utils.enumValue`** [CITED: Utils.js:336–338] is **case-insensitive** (`name[0].toUpperCase()+slice(1)`), so JSON `"fixed"`/`"length"` map to the `Fixed`/`Length` enum — **the bake's mode checks MUST normalize case**.
**`readCurve`** [CITED: 4.3 SkeletonJson.js:1370–1382] reads cy at `(value<<2)+1` and `(value<<2)+3` and multiplies by the per-channel `scale`. For a 2-channel IK timeline the flat keyframe `curve` is 8 floats `[mixCx,mixCy,mixCx2,mixCy2, softCx,softCy,softCx2,softCy2]` → **softness cy = `curve[5]` and `curve[7]`** (verified against real data below).

### Pattern 2: Cycle-safe field-identity oracle (promote from `baker.mjs:96–121`)
```js
// Source: .planning/spikes/002-json-bake-roundtrip/bake.mjs:96-121 (cycle-safe deep-compare)
const near = (x, y) => Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y)); // L-04 tolerance
const SKIP = new Set(['parent','children','bones','bone','target','source','slot','skin',
  'attachment','page','region','texture','rendererObject','renderObject','timelineAttachment',
  'data','_parent','_bones','_bone','_target','_source','_slot','_skin','_data',
  '_meshAttachment','sequence','name','path','id','hash','assetId']);   // exclude refs + parse-assigned ids
// WeakSet on the a-side breaks cycles; generalize array indices to `[]`; both sides parsed from the SAME
// atlas; reference side = parse(orig, scale=s) generated LIVE (no hand-computed goldens).
```

### Anti-Patterns to Avoid
- **Value-diffing two parses to derive rules.** Hides `×1` cases and scaled-defaults (Spike 001 caveat). Transcribe from source.
- **Generic `scaleCurve` (every `i%4===1||i%4===3`) on multi-channel timelines.** Correct for translate/deform (all channels spatial) but WRONG for IK (it would scale the `mix` channel's cy). Scale only the value-axis cy of the *scalable* channel.
- **`positionMode !== 'percent'` / scaling Proportional spacing.** The spike prototype does this; it diverges from the source (see Pitfall 3). Authoritative gate is `Fixed` (position) and `Length||Fixed` (spacing).
- **Routing oracle fixtures through `loadSkeleton` when a beta rig is involved.** `loadSkeleton`/`resolveRuntimeTag` typed-rejects in-band pre-release versions (4.3.88-beta, 4.3.91-beta) — see Common Pitfalls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-field scale rules | A value-diff-derived table | Transcribe `* this.scale` from `SkeletonJson.js` | Value-diff hides ×1 + scaled-defaults (Spike 001) |
| Reference "correct" scaled output | Hand-computed golden numbers | `parse(orig, SkeletonJson.scale=s)` generated live | Spine's own parser IS the oracle; zero golden maintenance; this is why authored fixtures are low-risk |
| Mode enum parsing | String compares against guessed casings | Normalize case then compare to `Fixed`/`Length` | `enumValue` is case-insensitive; JSON uses lowercase |
| Weighted-mesh vertex walk | Re-derive the stride | Reuse spike `scaleVertices` (bc-count stride, positions only) | Already validated field-identical on DEMON mesh |

**Key insight:** the entire bake is a faithful transcription of ~30 source lines; the risk is never the
arithmetic, it's (a) missing a scaled-default, (b) mis-gating a mode, (c) scaling a normalized/mix curve.
All three are now mapped and verified.

## Runtime State Inventory

Not a rename/refactor/migration phase — N/A. (The bake *writes* JSON but only to in-memory return values
in Phase 48; no datastore, no OS state, no service config. The only on-disk writes are the committed test
fixtures, covered under Fixture-Commit Safety below.)

## Common Pitfalls

### Pitfall 1: CONTEXT's bake.mjs ↔ baker.mjs deform attribution is INVERTED
**What goes wrong:** CONTEXT (L-07 + canonical_refs) says `bake.mjs` has the *corrected* deform container
key and to prefer it over `baker.mjs`. **The opposite is true.** [VERIFIED by reading both files + probing fixtures]
- `baker.mjs:71–77` walks `anim.attachments[skin][slot][att].deform` — the **CORRECT** key (matches real data).
- `bake.mjs:87–89` walks `anim.deform[...]` — the **WRONG/legacy** key (finds **0** keys in TEST_01, spineboy, 3Queens).
- Real data lives at `anim.attachments[...].deform`: TEST_01=60 keys, spineboy=9, 3Queens=129; `anim.deform`=0 in all.
- **Oracle confirmation:** `baker.mjs` bake on deform-heavy TEST_01 4.2 → ✅ FIELD-IDENTICAL [VERIFIED: ran it].
**Why it happens:** `bake.mjs`'s oracle only ran DEMON (zero deform) + SIMPLE (zero deform), so its wrong
deform key never mattered there; the deform-key fix actually landed in `baker.mjs`.
**How to avoid:** **Promote `baker.mjs` as the base**, not `bake.mjs`. Promote the deep-compare oracle from
either (identical). Treat CONTEXT L-07's *intent* (use `anim.attachments[...].deform`) as correct; its
*file attribution* as wrong.
**Warning signs:** any 4.2/4.3 deform rig showing `animations[].attachments[][][].deform.vertices` mismatches.

### Pitfall 2: IK softness-timeline curve — the `cy` offsets are channel-specific
**What goes wrong:** Neither spike baker scales the IK timeline curve at all (`baker.mjs:78` scales only
`k.softness` value). Result: spineboy_4.3 (27 fields), TEST_03 4.2 (18), Girl 4.2 (18) FAIL on
`animations[].timelines[].curves.N` [VERIFIED: ran the oracle]. A naive "scale every cy" fix is ALSO wrong
(it scales the `mix` channel's cy and breaks regressions — I tried it; +regressions on DEMON/TEST_01).
**Why it happens:** the IK keyframe `curve` is a flat 8-float array `[mixCx,mixCy,mixCx2,mixCy2,
softCx,softCy,softCx2,softCy2]` [VERIFIED: spineboy `{"mix":0,"curve":[0.3,0,0.9,1,0.3,0,0.9,0]}`].
Spine scales cy only for the **softness** channel (value-index 1 → `curve[5]`, `curve[7]`); the mix channel
(value-index 0 → `curve[1]`, `curve[3]`) stays ×1 [CITED: readCurve cx/cy at `(value<<2)+1/+3`; IK call
at SkeletonJson.js:917 (mix, scale=1) + :918 (softness, scale=scale)].
**How to avoid (VERIFIED FIX):** in the `anim.ik` keyframe walk, after `k.softness *= s`, also
`if (Array.isArray(k.curve) && k.curve.length >= 8) { k.curve[5] *= s; k.curve[7] *= s; }`. Re-ran the
oracle: spineboy + TEST_03 + Girl all → ✅ FIELD-IDENTICAL, DEMON + TEST_01 + SIMPLE_43 still ✅ (no regression).
**Warning signs:** `curves.N` mismatches clustered on IK constraint timelines.

### Pitfall 3: PATH position/spacing mode-gating diverges from the source
**What goes wrong:** spike prototype uses `positionMode !== 'percent'` (scales position in ANY non-percent
mode) and `spacingMode === 'length' || 'proportional'` (scales Proportional spacing). **The source scales
position ONLY in `Fixed` mode and spacing ONLY in `Length`/`Fixed` — Proportional spacing is NOT scaled.**
[CITED: 4.3 SkeletonJson.js:274–279, 994, 999; 4.2:209–214, 830, 834 — identical]. This is latent: no
on-disk path rig uses Fixed/Proportional, so it hasn't bitten — but it's a correctness bug for a future rig.
**Why it happens:** the spike author paraphrased the gate from memory rather than transcribing.
**How to avoid (VERIFIED):** gate setup AND timeline on the normalized mode: `pm==='fixed'` for position;
`sm==='length' || sm==='fixed'` for spacing. (Case-normalize first — `enumValue` is case-insensitive.)
**Warning signs:** `constraints[].setupPose.position`/`.spacing` or path position/spacing timeline mismatch
on any Fixed-mode rig.

### Pitfall 4: Slider remap slope (4.3) is entirely unbaked in the spike
**What goes wrong:** `baker.mjs`'s `constraintsOf` *lists* sliders but the `bake` body has **no slider
branch** → `constraints[].scale` mismatch [VERIFIED: SLIDER_4_3 oracle fails on exactly that 1 field].
**Why it happens:** the spike note said "slider remap slope was not exercised by any test rig" — but the
**already-tracked `fixtures/SLIDER_4_3/SLIDER-01.json` HAS `property: "x"`** (spatial) which DOES trigger
the slope (DEMON's slider is `property: "rotate"` → `propertyScale=1` → no spatial effect, which is why DEMON passed) [VERIFIED].
**How to avoid (VERIFIED FIX):** add a slider branch: when the slider has a `bone`, `const ps =
(property==='x'||property==='y') ? s : 1; if (typeof from==='number') from *= ps; if (typeof scale==='number')
scale /= ps;` [CITED: SkeletonJson.js:333–336]. Re-ran: SLIDER_4_3 → ✅ FIELD-IDENTICAL, no regressions.
**Warning signs:** `constraints[].scale` and `constraints[].property.offset` mismatch on slider rigs.

### Pitfall 5: `loadSkeleton` rejects beta-version rigs (don't use them as fixtures)
**What goes wrong:** `test_4.3/girl` (4.3.88-beta), `test_4.3/jokerman` (4.3.88-beta), `SPINE_4_3_TEST`
(4.3.91-beta) are typed-rejected by `resolveRuntimeTag`'s pre-release arm → `SpineVersionUnsupportedError`
[VERIFIED: loader.ts:296+; memory `project_prerelease_spine_exports_rejected`]. If the oracle obtains the
atlas via `loadSkeleton`, these throw before any compare.
**How to avoid:** use only STABLE-version rigs as fixtures (DEMON 4.3.02, spineboy 4.3.01, SLIDER_4_3 4.3.02,
SIMPLE_43 4.3.01, all the 4.2.43 rigs). The 4.3-beta Joker rigs are NOT viable matrix members. (Even with
D-04's direct-atlas path, the *reference parse* `sj.readSkeletonData` would run on a structurally-suspect
beta rig — avoid entirely; stable equivalents exist for every needed channel.)
**Warning signs:** `SpineVersionUnsupportedError` / "pre-release build" in oracle setup.

## Code Examples

### Verified slider branch (add to the constraint loop)
```js
// Source: spine-core 4.3 SkeletonJson.js:333-336 (slider; 4.2 has no slider). VERIFIED field-identical.
else if (type === 'slider') {
  if (c.bone) {                                   // remap reads only happen when a bone is bound
    const ps = (c.property === 'x' || c.property === 'y') ? s : 1;  // propertyScale
    if (typeof c.from === 'number') c.from *= ps;
    if (typeof c.scale === 'number') c.scale /= ps;
  }
}
```

### Verified IK softness-timeline curve fix (in the `anim.ik` keyframe walk)
```js
// Source: spine-core 4.3 SkeletonJson.js:904/914/918 + readCurve:1370-1382. VERIFIED field-identical.
for (const keys of Object.values(anim.ik || {})) {
  if (!Array.isArray(keys)) continue;
  for (const k of keys) {
    if (typeof k.softness === 'number') k.softness *= s;            // value
    if (Array.isArray(k.curve) && k.curve.length >= 8) {            // 8 floats: [mixCx,mixCy,mixCx2,mixCy2, softCx,softCy,softCx2,softCy2]
      k.curve[5] *= s; k.curve[7] *= s;                            // softness channel cy ONLY; mix cy (curve[1],[3]) stays ×1
    }
  }
}
```

### Verified path mode-gating correction (setup; mirror for timelines)
```js
// Source: spine-core 4.3 SkeletonJson.js:274-279 / :994,:999 (4.2 identical). VERIFIED no-regression.
else if (type === 'path') {
  const pm = (c.positionMode || 'percent').toLowerCase();
  const sm = (c.spacingMode  || 'length').toLowerCase();
  if (pm === 'fixed' && typeof c.position === 'number') c.position *= s;            // NOT "!== percent"
  if ((sm === 'length' || sm === 'fixed') && typeof c.spacing === 'number') c.spacing *= s;  // NOT proportional
}
// Path TIMELINES: gate cmap.position by pm==='fixed', cmap.spacing by sm∈{length,fixed}; scale k.value + cy.
```

### Typed-error guards (follow `src/core/errors.ts` discriminated-union culture)
```ts
// D-09 degenerate-s + D-10 assert-known. Mirror errors.ts: extend a root class, set .name (load-bearing
// if ever routed through IPC — not needed in Phase 48 but free to be consistent).
if (!Number.isFinite(s) || s <= 0) throw new ScaleBakeError(`scale must be finite > 0, got ${s}`);  // D-09
// D-10: in each switch, default: throw new ScaleBakeError(`unknown <kind>: ${value}`)  — for
//   attachment.type, constraint.type (4.3 c.type / the 4.2 split-array origin), and any scalable timeline name.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bone-scaling for variants | Full `SkeletonJson.scale` similarity bake | SEED-010, 2026-05-21 | Root-scale catastrophic; bake is the only faithful path (L-01) |
| `bake.mjs` `anim.deform` walk | `baker.mjs` `anim.attachments[...].deform` walk | Spike 002 coverage-42 | Deform now scaled correctly (Pitfall 1) |
| Spike "slider never exercised" | `SLIDER_4_3` (tracked) has `property:"x"` → IS exercised | this research | Slider remap MUST be implemented + is gated (Pitfall 4) |

**Deprecated/outdated:** `bake.mjs`'s deform walk; spike path mode-gating; "slider untested" assumption.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 4.2 IK-softness-curve coverage by `spineboy_4.3` (4.3) alone *might* satisfy D-07#1 since the rule code is byte-identical across runtimes; this research recommends also adding a 4.2 instance (TEST_03) for belt-and-suspenders | Coverage / Open Q1 | Low — adding TEST_03 is cheap; if skipped, a 4.2-specific schema-shape bug in the ik-curve walk would go uncaught (unlikely — same walk) |
| A2 | The synthetic 4.3 path-Fixed fixture is the ONLY way to cover the PATH length-mode timeline channel (no real rig on disk uses Fixed position / any spacing timeline) | Coverage / Gap | Low — verified by exhaustive on-disk scan; if the owner has another rig with a Fixed-mode path it could substitute (D-05 prefers real) |
| A3 | `referenceScale`-present path is acceptable to leave uncovered by a fixture (every on-disk rig omits it → only the inject-100×s path is exercised) | Coverage (f) | Very low — it's a trivial `×s` multiply; the riskier inject path IS covered |

**This table is non-empty:** A1/A2 are coverage-completeness judgment calls the planner/owner may confirm;
A3 is a documented minor gap. All arithmetic claims are VERIFIED, not assumed.

## Open Questions

1. **Does D-07#1 (IK softness curve) require a 4.2 fixture, or is the tracked 4.3 `spineboy` enough?**
   - What we know: the ik-curve walk is identical code for both runtimes; `spineboy_4.3` (tracked) exercises
     it (16 keys, 3 curves) and the verified fix makes it field-identical. No tracked 4.2 rig has it.
   - What's unclear: whether D-07's "every channel gets a fixture" means *per runtime*.
   - Recommendation: add `TEST_03` (4.2; ik-curve×1, deform×12 — small) to be safe; cheap insurance.

2. **Final scale-factor set for the oracle iteration (Claude's discretion).**
   - What we know: spike used 0.5 + 0.26; both pass. D-09 allows `s>1`.
   - Recommendation: iterate `{0.5, 0.26, 2.0}` (a non-round factor + an upscale to exercise direction-agnosticism).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-core` | reference parse + rule source | ✓ | 4.3.0 | — |
| `spine-core-42` (alias) | 4.2 reference parse | ✓ | 4.2.111 | — |
| `vitest` + `tests/setup/esm-adapter-resolver.ts` | oracle CI test | ✓ | project-pinned | — |
| `npx tsx` | spike re-runs (not the CI test) | ✓ | (project) | — |

**Missing dependencies with no fallback:** none. **Missing dependencies with fallback:** none.

## Fixture Coverage Matrix (THE core research deliverable — all VERIFIED by running the oracle)

Per-channel: which on-disk fixture(s) EXERCISE each channel, with evidence and tracking status. Counts are
exact (probed the JSON). "tracked" = already in git; "COPY" = needs D-06a copy-to-new-dir; "synthetic" = author.

| Channel (D-07 / requirement) | 4.2 coverage | 4.3 coverage | Current oracle verdict (baker.mjs) | Action |
|------------------------------|--------------|--------------|------------------------------------|--------|
| **(a) Deform timelines** | TEST_01 (60 keys/4 atts), 3Queens (129/13), Girl (131/6), JOKER (70/5) | **spineboy_4.3 (9/4, TRACKED)**, SIMPLE_43 sk2 (1, TRACKED) | ✅ pass (after baker deform key) | DEMON has **0** deform (confirmed false-confidence trap); commit TEST_01 (D-03) for 4.2 deform-heavy; 4.3 already tracked |
| **(b) IK softness-timeline CURVE (cy)** | TEST_03 (1 curve), Girl (2), JOKER (1) | **spineboy_4.3 (3 curves, 16 keys, TRACKED)** | ❌ FAILS (27/18/18 fields) → ✅ after Pitfall-2 fix | Implement fix; gate on tracked spineboy (4.3) + add TEST_03 (4.2, A1) |
| **(c) PATH position/spacing LENGTH-mode TIMELINE** | **NONE** (all path rigs: positionMode=Percent, spacingMode=Length, **zero spacing timelines**, position timelines are Percent→unscaled) | **NONE** | n/a — no fixture triggers it | **GENUINE GAP → author 1 synthetic 4.3 path-Fixed fixture** (A2) |
| **(d) 4.3 PATH constraint (setup)** | (4.2: TEST_01/Girl/JOKER/SIMPLE have path) | **SIMPLE_PROJECT_43 sk2 (path×1, TRACKED, stable 4.3.01)**; DEMON has **none** | ✅ pass | Tracked SIMPLE_43 covers 4.3 path setup; no action |
| **(e) Slider remap slope (spatial)** | (4.2 has no slider) | **SLIDER_4_3 (`property:"x"` → spatial, TRACKED)**; DEMON slider is `rotate`→×1 | ❌ FAILS (`constraints[].scale`) → ✅ after Pitfall-4 fix | Implement fix; gate on tracked SLIDER_4_3 |
| **(f) Scaled-default injections** | `referenceScale` ABSENT in ALL rigs (inject path always hit, present path never); `physics.limit` absent in TEST_01 (51), SIMPLE (7) | DEMON physics.limit **present 32/139 + absent** (BOTH paths hit); referenceScale absent | ✅ pass | DEMON covers physics.limit present+absent; referenceScale present-path uncovered (A3, trivial) |
| **(g) All-constraint-types per runtime** | **TEST_01 = transform+ik+path+physics (all four)** | **DEMON = transform+ik+physics+slider** (no path; path covered by SIMPLE_43) | ✅ pass | TEST_01 (4.2) + DEMON (4.3) are the anchors; no single 4.3 rig has all 5 types — acceptable (path setup via SIMPLE_43) |

**Raw verdicts (corrected bake re-run here):** DEMON ✅, SIMPLE_43 ✅, XTRA01 ✅, TEST_01 ✅, SIMPLE ✅ (already pass);
SLIDER_4_3 ✅ *after slider fix*; spineboy_4.3 ✅, TEST_03 ✅, Girl ✅ *after ik-curve fix*. PATH-length-timeline: untestable until the synthetic fixture exists.

### Residual gap decision (resolves D-05)
- **PATH position/spacing length-mode TIMELINE = the ONLY genuine residual gap.** No real rig on disk uses
  `positionMode:fixed`, `spacingMode:fixed`, or any spacing timeline (verified by exhaustive scan of all
  `fixtures/**/*.json`). Per D-05/D-06: **author one standalone synthetic 4.3 fixture** (a real rig would be
  preferred but none exists — the owner would have to make a new one). Minimal shape:
  - 2 bones, 1 path attachment (a few vertices + `lengths`), 1 slot.
  - 1 path constraint with `positionMode: "fixed"` AND `spacingMode: "fixed"` (or `length`).
  - 1 animation with a `path` timeline animating BOTH `position` and `spacing`, ≥2 keys, ≥1 with a `curve`
    (so the cy-scale path is exercised). Keep it tiny (~60–100 lines JSON + a 1-region `.atlas`).
  - This is the smallest fixture that drives lines 994/999 (4.3) / 830/834 (4.2). (A 4.3 instance suffices —
    the rule is identical across runtimes; add a 4.2 twin only if D-07 is read as strictly per-runtime.)
- **4.3 PATH setup (D-05's other named candidate) is NOT a gap** — tracked `SIMPLE_PROJECT_43/skeleton2.json`
  (stable 4.3.01) already declares a path constraint. Do not author a fixture for it.
- **DEMON + TEST_01 commits are genuinely load-bearing** (not redundant with tracked rigs): DEMON is the
  only source of 4.3 physics (+ `physics.limit`-present injection) and the all-types 4.3 stress; TEST_01 is
  the only 4.2 deform-heavy all-four-types rig.
- **Add TEST_03** (4.2) for the 4.2 ik-softness-curve channel (A1 — cheap; or accept 4.3-only coverage).

## Fixture-Commit Safety (D-06a) — concrete, verified recipe

**Git-status reality (re-verified on disk):**
- `fixtures/DEMON/` — **untracked, NOT ignored.** `git add fixtures/DEMON/` would stage **63 PNGs / 174 MB**
  [VERIFIED: `find` + `du`]. The committable payload is json 454 KB + atlas 2.8 KB.
- `fixtures/MON_FILES/` — **dir-ignored** (`.gitignore:27`). `git check-ignore` matches the TEST_01 file at
  its full path → `git add` **silently no-ops** (the exact v1.3.1 landmine). TEST_01 payload: json 704 KB + atlas 3.4 KB.
- `fixtures/3Queens/`, `fixtures/Girl/`, `fixtures/test_4.3/` — all dir-ignored. (`Girl/` top-level has NO
  `.atlas` on disk; only `test_4.3/girl/` has one — and that's a rejected beta. So Girl-4.2 is **not** oracle-usable
  as-is without sourcing its atlas. Prefer TEST_03 for the 4.2 ik-curve channel — it has its `.atlas`.)
- TRACKED + reachable today: `spineboy_4.3`, `SLIDER_4_3`, `SIMPLE_PROJECT_43`, `SIMPLE_PROJECT`, `XTRA01_4_3`,
  `XTRA02_4_3`, `SPINE_4_3_TEST` (beta — unusable), etc.

**The recipe (D-06a option 1 — confirmed correct):** `.gitignore` **cannot re-include a child of a
dir-excluded path** without a fragile descend-then-reinclude rewrite of the `fixtures/MON_FILES/` rule.
COPY the `.json` + `.atlas` (NOT the PNGs) into NEW non-ignored dirs:
```
fixtures/SCALE_BAKE_4_3/   ← cp fixtures/DEMON/SKINS_SPINE_V02.json + .atlas
fixtures/SCALE_BAKE_4_2/   ← cp fixtures/MON_FILES/EXPORT/TEST_01/4.2/TEST_01.json + .atlas
                              (+ TEST_03.json + .atlas if adopting A1 for 4.2 ik-curve)
fixtures/SCALE_BAKE_PATH_43/  ← the authored synthetic path-Fixed fixture + minimal .atlas
```
A brand-new dir has no PNGs to accidentally stage, no ignore rule to fight, and is self-documenting. **Do
NOT `git add fixtures/DEMON/`** (107–174 MB PNG hazard). If keeping DEMON in place were ever chosen instead,
a `fixtures/DEMON/*.png` ignore would be mandatory first — but the COPY approach avoids this entirely.

**The `.atlas` is text-only** (verified: TEST_01.atlas is `TEST_01.png` / `size:` / `bounds:` lines —
region names + page dims + UV rects + a page *filename*; **no pixel data**), so committing it leaks nothing (D-04).

**Verification commands (the authoritative "would CI see it?" — make these the D-06a task's acceptance):**
```bash
git check-ignore fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.json   # must print NOTHING (exit 1)
git ls-files --error-unmatch fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.json   # must succeed (after commit)
git archive HEAD | tar -t | grep SCALE_BAKE_4_3   # must list the file in the committed tree
# repeat for every fixture the oracle reads, incl. each .atlas
```
Run these in CI-equivalent conditions (or a throwaway `git clone . /tmp/x && cd /tmp/x && ls fixtures/SCALE_BAKE_*`).

**No silent skip (D-06a #3):** the oracle MUST `fs.existsSync`-assert each fixture and **hard-fail** with
"fixture not found: <path>" if absent — NO `skipIf(!exists)` (a skip green-washes a missing fixture, same
class as the SAMPLER `skipIf(CI)` and UAT-opened-≠-rendered false-greens). Optionally a tiny standing guard
test that asserts every matrix path exists.

**Authoritative signal (D-06a #4):** the watched per-OS run of **both** `ci.yml` AND `release.yml` (they
diverge — release.yml uses a different checkout depth and has independently failed on green-ci commits).
Local green ≠ CI green.

## Oracle Entrypoint-Runtime Resolution (verified)

- **Reference side** (`new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas)); sj.scale = s;
  sj.readSkeletonData(json)`) imports spine-core **directly** — allowed in tests; does NOT version-gate.
- **Atlas acquisition** — use **D-04's `new Spine.TextureAtlas(atlasText, stubLoader)`** built from the
  `.atlas` file text. This bypasses `loadSkeleton` entirely → no PNG probe, no version reject, bulletproof
  with PNGs absent. (The spike harness used `loadSkeleton(src).atlas`, which works for the stable anchors but
  would reject any beta rig and disk-probes — use D-04's path.)
- **Runtime selection** — pick `Spine42` vs `Spine43` by the rig's `skeleton.spine` major.minor
  (`"4.2.43"`→42, `"4.3.02"`→43). The bake itself is runtime-agnostic; only the reference parser is per-version.
- **ESM seam** — IF the oracle ever routes through `loadSkeleton`/the facade, the vitest `setupFiles:
  ['tests/setup/esm-adapter-resolver.ts']` binds the adapter resolver [VERIFIED: vitest.config.ts:23 +
  the setup file statically imports the real runtime-42/43 adapters]. With D-04's direct-atlas path the
  oracle needs neither `loadSkeleton` nor the facade, so the seam is **not on the critical path** — but it's
  present if needed. (`npx tsx` spike runs use `scripts/register-esm-adapter-resolver.ts` instead; plain
  `node` cannot resolve the `.ts` imports — confirmed.)
- **No `tests/`-scoped co-mingle guard:** `arch.spec.ts` RT-03 (both-specifier) and RT-02 scanners target
  `src/**` only; the oracle importing BOTH `@esotericsoftware/spine-core` and `spine-core-42` is fine and has
  precedent (`tests/runtime/runtime-distinctness.spec.ts`) [VERIFIED].

## Promotion Specifics for the `core/` Module

**Base:** `baker.mjs` (the `~80-line` validated transform) — NOT `bake.mjs` (Pitfall 1). Structure:
`clone(json)` → inject `referenceScale` default → bones → `constraintsOf()` loop (one branch per type) →
skins/attachments loop (one branch per attachment.type) → animations loop (bones/translate, attachments/deform,
ik, path timelines). Returns the new clone; **source never mutated** (L-05).

**Changes when promoting to TypeScript:**
1. **Add the three verified channel fixes** (Pitfalls 2, 3, 4) — slider branch, IK-softness-curve cy, path
   mode-gating correction + path length-mode timelines. All three re-verified field-identical in this research.
2. **D-09 degenerate-`s` guard** at entry: `if (!Number.isFinite(s) || s <= 0) throw new ScaleBakeError(...)`.
3. **D-10 assert-known** typed throws in each `switch` `default:` (mirror `errors.ts` discriminated-union style).
4. **Pure / non-mutating** (L-05) — keep the leading `clone`; never write back to `json`. Type the input/return
   as the raw JSON shape (or `unknown`/a structural type) — the bake reads dynamic keys, so a permissive type
   or `as` casts at the JSON boundary are acceptable; the geometry rules are the contract, not the TS shape.
5. **Layer-3 purity** (L-05) — no DOM/Electron/sharp/`node:fs`. The `arch.spec.ts` `src/core/**` scanner
   (lines 148–178) will auto-include `src/core/scale-bake.ts` with NO carve-out → it must import none of those.
   D-04a/canonical_refs say "add the bake module to arch.spec's anchored surface" — a named anchor block is
   optional belt-and-suspenders; the existing glob already enforces purity.

**Exact D-10 type discriminators to assert (the keys that decide HOW to scale):**
- `attachment.type` ∈ {`region`(default when absent), `mesh`, `path`, `boundingbox`, `clipping`, `point`}.
  Note: spine also has `linkedmesh`/`clipping`/`sequence`-bearing meshes — a `linkedmesh` has no own geometry
  to scale (inherits from source) and should be a recognized no-geometry type, not an assert-throw. Verify the
  full attachment-type set against `SkeletonJson.readAttachment`'s switch before finalizing the allowed set.
- `constraint.type`: 4.3 unified `c.type` ∈ {`ik`,`transform`,`path`,`physics`,`slider`}; 4.2 split-array
  origin ∈ {`transform`,`ik`,`path`,`physics`} (no slider, no remap). Assert on an unrecognized 4.3 `c.type`.
- **scalable timeline names** — the bake only touches: bones `translate`/`translatex`/`translatey`;
  `deform`; ik (`softness` + curve); path `position`/`spacing`. **It legitimately IGNORES** (no scale, no
  assert): `rotate`/`scale*`/`shear*`, `rgba`/`rgb`/`alpha`/`rgba2`/`rgb2`, `attachment`, `drawOrder`,
  `event`, `sequence`, all `physics` timelines (`inertia`/`strength`/`damping`/`mass`/`wind`/`gravity`/`mix`/
  `reset`), transform/path/slider `mix*` channels, `time`. D-10 should assert ONLY on the discriminators that
  decide scaling (attachment.type, constraint.type) — NOT on timeline names (the bake walks named channels
  it knows and skips the rest by design; asserting on every unknown timeline name would false-throw on the
  many ×1 timelines). Per D-10's own note: "only type discriminators are asserted." Keep timeline handling as
  allow-listed (scale the known scalable ones; silently skip the rest).

## Validation Architecture

> nyquist_validation: treated as ENABLED (no explicit `false` found; this phase IS gated by a CI oracle).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (project-pinned), `environment: 'node'` [VERIFIED: vitest.config.ts:14] |
| Config file | `vitest.config.ts` (`setupFiles: ['tests/setup/esm-adapter-resolver.ts']`, `include: ['tests/**/*.spec.ts(x)']`) |
| Quick run command | `npx vitest run tests/<scale-bake-oracle>.spec.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAKE-01 | `parse(bake(orig,s),1)` ≡ `parse(orig,scale=s)` field-identical (ids excluded) on every matrix rig | oracle (unit-ish) | `npx vitest run tests/scale-bake.spec.ts` | ❌ Wave 0 |
| BAKE-02 | Both 4.2 (TEST_01/SIMPLE) and 4.3 (DEMON/spineboy/SIMPLE_43/SLIDER_4_3) rigs pass | oracle | same | ❌ Wave 0 |
| BAKE-03 | IK-softness-curve (spineboy/TEST_03), slider-remap (SLIDER_4_3), path-length-timeline (synthetic), injections (DEMON physics.limit) all field-identical | oracle | same | ❌ Wave 0 (+ synthetic fixture) |
| BAKE-04 | Oracle iterates ≥1 deform-heavy + ≥1 all-types-per-runtime; module passes `arch.spec.ts` | oracle + arch grep | `npx vitest run tests/scale-bake.spec.ts tests/arch.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scale-bake.spec.ts` (the oracle).
- **Per wave merge:** `npm run test` (full suite — catches arch.spec + any cross-impact).
- **Phase gate:** full suite green on **all 3 OS** in **both** `ci.yml` AND `release.yml` before `/gsd-verify-work`.

### Sampling / Coverage Strategy (the matrix IS the sampling)
The "sample" is the per-channel fixture matrix above: each scalable channel must be exercised by ≥1 matrix
rig, across ≥2 scale factors (`{0.5, 0.26}` minimum; recommend adding `2.0` for direction-agnosticism D-09).
Hard-fail-on-missing-fixture (D-06a #3) is the anti-green-wash control.

### Wave 0 Gaps
- [ ] `tests/scale-bake.spec.ts` (or chosen name) — the field-identity oracle across the matrix; covers BAKE-01..04.
- [ ] `fixtures/SCALE_BAKE_4_3/` (DEMON copy) + `fixtures/SCALE_BAKE_4_2/` (TEST_01 copy, + TEST_03 if A1) — copied json+atlas, verified tracked.
- [ ] `fixtures/SCALE_BAKE_PATH_43/` — authored synthetic path-Fixed fixture + minimal `.atlas` (the only uncovered channel).
- [ ] (optional) named anchor block in `tests/arch.spec.ts` for `src/core/scale-bake.ts` (the glob already covers it).
- [ ] No framework install needed (vitest present).

## Security Domain

> `security_enforcement`: no `.planning/config.json` security gate found for this internal-core phase.
> This phase reads in-house fixture JSON and produces in-memory JSON; no untrusted input, no network, no
> auth/session/crypto surface. The relevant "security" property is **IP-protection via PNG-exclusion**
> (D-04), which is verified: the bake/oracle read zero PNG bytes (`loader.ts:802` atlas-source mode reads
> dims from atlas metadata; D-04 builds atlas from text), and `.atlas` files are pixel-data-free text.

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V5 Input Validation | partial | D-09 degenerate-`s` guard + D-10 assert-known typed throw (defends against silent geometry corruption on malformed/unknown rigs) |
| V2/V3/V4/V6 | no | No auth/session/access-control/crypto in a pure JSON transform |

## Sources

### Primary (HIGH confidence)
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` (4.3.0) — all `* this.scale` reads (lines 73,87–90,153,184,224–226,233–234,274–279,294–295,299,333–336,510–516,529–535,563–564,597,608–609,665–666,850–856,904/914/918,994,999,1279–1328,1370–1382). Transcribed, not value-diffed.
- `node_modules/spine-core-42/dist/SkeletonJson.js` (4.2.111) — parallel reads (72,86–88,142,172–173,205–214,238,374–380,410–411,438,449–450,503–504,736/746,830,834); confirmed identical value rules, no slider/remap.
- `node_modules/@esotericsoftware/spine-core/dist/PathConstraintData.js` + `Utils.js` — enum values + `enumValue` case-insensitivity.
- The spike artifacts (`.planning/spikes/{001,002,003}`, MANIFEST, CONVENTIONS) — the de-risked math (treated as ground truth per objective).
- **Live oracle runs in this session** — ran the corrected bake against DEMON, SLIDER_4_3, spineboy_4.3, SIMPLE_43, XTRA01, TEST_01, TEST_03, Girl, SIMPLE (all results reported above); probed every candidate fixture's channel content; verified git tracking/ignore status and PNG sizes.

### Secondary (MEDIUM confidence)
- Project memory (`project_prerelease_spine_exports_rejected`, `feedback_gitignore_fixtures_check_test_refs`, `feedback_release_yml_diverges_from_ci_yml`, `feedback_uat_opened_is_not_rendered`) — cross-checked against code (`loader.ts`, `arch.spec.ts`).

### Tertiary (LOW confidence)
- None — every load-bearing claim was tool-verified.

## Metadata

**Confidence breakdown:**
- Field rules / authoritative spec: HIGH — transcribed from both source files, cross-checked by live oracle.
- Fixture coverage matrix: HIGH — exact counts probed from JSON + oracle pass/fail run per rig.
- Channel fixes (slider, ik-curve, path mode-gating): HIGH — each re-verified field-identical with no regression.
- Residual gap (PATH length-mode timeline): HIGH — exhaustive on-disk scan found zero coverage.
- Commit-safety mechanics: HIGH — `git check-ignore`/`ls-files`/PNG-size all run; ignore rules read.
- bake.mjs/baker.mjs inversion: HIGH — read both files + probed real deform containers + ran the oracle.

**Research date:** 2026-05-22
**Valid until:** ~2026-06-21 (stable; would only shift on a spine-core bump — re-transcribe `* this.scale` then).
