# Phase 48: Core Scale-Bake Module + Regression Oracle - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 6 (2 NEW src, 1 NEW test, 1 MODIFIED test, 3 NEW fixture dirs)
**Analogs found:** 6 / 6 (all exact or strong role-matches; all analogs already pass CI)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/scale-bake.ts` (NEW) | utility (pure transform) | transform (JSON→JSON) | `src/core/bones.ts` + base = spike `baker.mjs` | exact (pure core/ transform) |
| typed error class in `src/core/scale-bake.ts` or `src/core/errors.ts` (NEW) | model (error) | — | `src/core/errors.ts` `SpineLoaderError` family | exact |
| `tests/scale-bake.spec.ts` (NEW) | test (oracle) | request-response (parse→compare) | `tests/runtime/d13-43-load-smoke.spec.ts` (atlas+parse) + `tests/runtime/runtime-distinctness.spec.ts` (both-specifier import) + `bake.mjs:96-121` (deep-compare) | exact |
| `tests/arch.spec.ts` (MODIFIED, optional) | test (arch gate) | — | `tests/arch.spec.ts` Phase-9 named-anchor block (lines 200-231) | exact (same file) |
| `fixtures/SCALE_BAKE_4_3/`, `fixtures/SCALE_BAKE_4_2/`, `fixtures/SCALE_BAKE_PATH_43/` (NEW) | config (fixture data) | file-I/O (test reads) | `fixtures/SIMPLE_PROJECT_43/` (`.json`+`.atlas`, tracked) | exact |

---

## Pattern Assignments

### `src/core/scale-bake.ts` (utility, pure JSON→JSON transform)

**Base to promote:** `.planning/spikes/002-json-bake-roundtrip/baker.mjs` (the `bake(json, s)` body, ~80 lines) — **NOT `bake.mjs`** (RESEARCH Pitfall 1: CONTEXT's L-07 attribution is inverted; `baker.mjs` has the corrected `anim.attachments[skin][slot][att].deform` walk, `bake.mjs` uses the wrong `anim.deform` key). Promote ~verbatim to TypeScript, then apply the three verified channel fixes + two guards below.

**Structural analog for "pure core/ module" conventions:** `src/core/bones.ts` (the smallest pure-delegation core module — shows the header-doc-citing-CLAUDE.md-Fact#5 + arch.spec convention, the `import type { ... } from 'spine-core-42'` style for type-only imports, named `export function`, zero DOM/fs/sharp).

**`bones.ts` header + import + export shape to mirror** (`src/core/bones.ts:1-25`):
```typescript
/**
 * Phase N — <one-line purpose>.
 * Pure ... — zero math/DOM. Follows CLAUDE.md rule #5 (core/ is pure TS, no DOM).
 * Enforced by ... the tests/arch.spec.ts Layer 3 defense ...
 */
import type { Slot } from 'spine-core-42';   // type-only imports OK; scale-bake needs NONE (operates on raw JSON)

export function boneChainPath(slot: Slot, attachmentName: string): string[] { ... }
```
> Note for scale-bake: it operates on the **raw parsed JSON** (dynamic keys), so it needs **no spine-core import at all** — neither runtime nor type. Type the input/return as a permissive structural shape (`unknown` / a local `interface SkeletonJsonRaw` / `Record<string, any>` with `as` casts at the JSON boundary per RESEARCH § Promotion #4). This keeps it trivially Layer-3 pure AND avoids the both-specifier co-mingle concern entirely.

**Core transform pattern to promote verbatim** (`baker.mjs:22-81`) — clone-first non-mutating shape (L-05):
```js
const clone = (o) => JSON.parse(JSON.stringify(o));
export function bake(json, s) {
  const j = clone(json);                       // L-05: clone FIRST; source never mutated
  if (!j.skeleton) j.skeleton = {};
  // L-02 scaled-default injection (the easy-to-miss landmine):
  j.skeleton.referenceScale = (typeof j.skeleton.referenceScale === 'number' ? j.skeleton.referenceScale : 100) * s;
  for (const b of j.bones || []) for (const f of ['length','x','y']) if (typeof b[f]==='number') b[f] *= s;
  for (const [type, c] of constraintsOf(j)) { ... }   // one branch per type
  for (const skin of j.skins || []) { ... }           // one branch per attachment.type
  for (const anim of Object.values(j.animations || {})) { ... }  // bones/translate, attachments/deform, ik, path TLs
  return j;                                            // the NEW clone
}
```

**`constraintsOf` schema-bridge to promote verbatim** (`baker.mjs:7-16`) — this is what makes the bake handle BOTH 4.2 (split arrays) and 4.3 (unified `constraints[]`) through one loop:
```js
function constraintsOf(j) {
  const out = [];
  for (const c of j.constraints || []) out.push([c.type, c]);   // 4.3 unified
  for (const c of j.transform || []) out.push(['transform', c]);// 4.2 split ↓
  for (const c of j.ik || []) out.push(['ik', c]);
  for (const c of j.path || []) out.push(['path', c]);
  for (const c of j.physics || []) out.push(['physics', c]);
  for (const c of j.slider || []) out.push(['slider', c]);
  return out;
}
```

**Weighted-mesh vertex walk to promote verbatim** (`baker.mjs:17-21`, RESEARCH § Don't Hand-Roll — already validated field-identical on DEMON mesh):
```js
function scaleVertices(att, verticesLength, s) {
  const v = att.vertices; if (!Array.isArray(v)) return;
  if (verticesLength === v.length) { for (let i=0;i<v.length;i++) v[i]*=s; return; }      // unweighted
  for (let i=0;i<v.length;) { const bc=v[i++]; for (let nn=i+bc*4;i<nn;i+=4){ v[i+1]*=s; v[i+2]*=s; } } // weighted: bone-count stride, positions only
}
```

**THREE VERIFIED CHANGES when promoting (RESEARCH Pitfalls 2/3/4 — each re-verified field-identical, no regression). The base `baker.mjs` is WRONG/incomplete on all three:**

1. **Slider branch — ADD (Pitfall 4; `baker.mjs` has NO slider branch → SLIDER_4_3 fails on `constraints[].scale`). Source: SkeletonJson.js:333-336.** Add to the `constraintsOf` loop:
```js
else if (type === 'slider') {
  if (c.bone) {                                                 // remap reads only when a bone is bound
    const ps = (c.property === 'x' || c.property === 'y') ? s : 1;  // propertyScale
    if (typeof c.from === 'number') c.from *= ps;
    if (typeof c.scale === 'number') c.scale /= ps;             // SLOPE = ÷ps
  }
}
```

2. **PATH mode-gating — REPLACE `baker.mjs:43-44` (it uses `!== 'percent'` for position and scales `'proportional'` spacing; source gates `Fixed` for position, `Length||Fixed` for spacing). Source: SkeletonJson.js:274-279 / :994,:999.** Setup pose:
```js
else if (type === 'path') {
  const pm = (c.positionMode || 'percent').toLowerCase();   // enumValue is case-insensitive — normalize first
  const sm = (c.spacingMode  || 'length').toLowerCase();
  if (pm === 'fixed' && typeof c.position === 'number') c.position *= s;                       // NOT "!== percent"
  if ((sm === 'length' || sm === 'fixed') && typeof c.spacing === 'number') c.spacing *= s;   // NOT proportional
}
// Path TIMELINES (in the animations loop): gate position-channel keys by pm==='fixed',
// spacing-channel keys by sm∈{length,fixed}; scale k.value AND its curve cy (same pm/sm gate).
```

3. **IK softness-timeline curve cy — ADD to the `anim.ik` keyframe walk (`baker.mjs:78` scales only `k.softness` value; the curve cy is unscaled → spineboy/TEST_03/Girl fail on `curves.N`). A naive "scale every cy" is ALSO wrong — it breaks the mix channel. Source: SkeletonJson.js:904/914/918 + readCurve:1370-1382.** The IK keyframe `curve` is a flat 8-float array `[mixCx,mixCy,mixCx2,mixCy2, softCx,softCy,softCx2,softCy2]`:
```js
for (const keys of Object.values(anim.ik || {})) {
  if (!Array.isArray(keys)) continue;
  for (const k of keys) {
    if (typeof k.softness === 'number') k.softness *= s;            // value
    if (Array.isArray(k.curve) && k.curve.length >= 8) {
      k.curve[5] *= s; k.curve[7] *= s;                            // softness-channel cy ONLY; mix cy (curve[1],[3]) stays ×1
    }
  }
}
```
> RE-USE WITH CARE: `baker.mjs`'s generic `scaleCurve` (`i%4===1||i%4===3`) is CORRECT for the bone `translate` timelines (all channels spatial) but WRONG for IK (would scale the mix channel) — keep `scaleCurve` only on the translate walk, use the channel-specific cy indexing above for IK (RESEARCH Anti-Patterns).

**TWO GUARDS to add (the only net-new logic beyond promotion):**
- **D-09 degenerate-`s` guard** at entry: `if (!Number.isFinite(s) || s <= 0) throw new ScaleBakeError(...)` — direction-agnostic, rejects ONLY `s<=0`/`NaN`/`±Infinity`.
- **D-10 assert-known** in each `switch`/branch `default:` for the **type discriminators only** (`attachment.type`, `constraint.type` / 4.3 `c.type`) → `throw new ScaleBakeError(...)`. **Do NOT assert on timeline names** — the bake allow-lists scalable timelines and silently skips the rest by design (RESEARCH § Promotion: asserting every unknown timeline name would false-throw on the many ×1 timelines). Recognized attachment types (allow-list, no throw): `region`(default-when-absent), `mesh`, `path`, `boundingbox`, `clipping`, `point`, plus `linkedmesh` as a recognized **no-own-geometry** type (inherits source geometry — recognized, not scaled, not a throw). Verify the full set against `SkeletonJson.readAttachment`'s switch before finalizing.

---

### Typed error class (model)

**Analog:** `src/core/errors.ts` (the project's discriminated-union typed-error culture — RESEARCH § Code Examples + D-10 "matches the `≥4.4` typed-reject").

**Pattern to follow** (`src/core/errors.ts:13-18` — the root class shape):
```typescript
export class SpineLoaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpineLoaderError';   // .name is load-bearing IF routed through IPC (KNOWN_KINDS) — not needed in Phase 48, but free to be consistent
  }
}
```
**For scale-bake, mirror that exact shape** (RESEARCH § typed-error guards — extend a root class, set `.name`):
```typescript
export class ScaleBakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaleBakeError';
  }
}
```

**Placement decision (Claude's Discretion per CONTEXT):** Two valid options, both consistent with the codebase:
- **(A) Co-locate in `src/core/scale-bake.ts`** — simplest; the error is single-module-scoped, has no IPC routing need this phase (no `KNOWN_KINDS` entry, no `src/main/ipc.ts` wiring). Keeps the new module self-contained. **Recommended for Phase 48** (the error is internal; Phase 49 can promote it to `errors.ts` if/when it crosses an IPC boundary).
- **(B) Add to `src/core/errors.ts`** — matches "the existing error culture" most literally; appropriate if you want a single error registry. Note `errors.ts` errors all extend `SpineLoaderError` (a loader concept) — a bake error is not a *loader* error, so if added here it should extend `Error` directly (a sibling root) OR a new neutral root, NOT `SpineLoaderError`.

> Either way: a SINGLE `ScaleBakeError` class serving both D-09 (degenerate `s`) and D-10 (unknown discriminator) is sufficient — the message string discriminates the two cases (RESEARCH § Code Examples uses one class for both). No discriminated *subclass* hierarchy is required here unlike `errors.ts` (whose subclasses exist for IPC `err.name` routing — not in play for the bake in Phase 48).

---

### `tests/scale-bake.spec.ts` (test, oracle)

This is a composite of **three** existing patterns. Each maps to a distinct analog.

**Analog A — atlas-build + reference-parse (the oracle's reference side):** `tests/runtime/d13-43-load-smoke.spec.ts:53-55,119-122` (EXACT precedent for D-04's "build atlas from `.atlas` text, parse directly with `SkeletonJson`, never call `loadSkeleton`").

Imports + parse helper to copy (`d13-43-load-smoke.spec.ts:53-55,119-122`):
```typescript
import { SkeletonJson, AtlasAttachmentLoader, TextureAtlas } from '@esotericsoftware/spine-core';
// ... for 4.2 rigs, the spine-core-42 trio (see Analog B):
//     import { SkeletonJson as SkeletonJson42, AtlasAttachmentLoader as AAL42, TextureAtlas as TA42 } from 'spine-core-42';

function parseSkeleton43(jsonText: string, atlasText: string): /* SkeletonData */ unknown {
  const atlas = new TextureAtlas(atlasText);              // D-04: single-arg ctor (current spine-core 4.3.0 API)
  const attachmentLoader = new AtlasAttachmentLoader(atlas);
  const skeletonJson = new SkeletonJson(attachmentLoader);
  return skeletonJson.readSkeletonData(JSON.parse(jsonText));
}
```
> **IMPORTANT API CORRECTION:** CONTEXT/RESEARCH D-04 write `new Spine.TextureAtlas(atlasText, stubLoader)` (a two-arg form). The **installed `@esotericsoftware/spine-core@4.3.0` `TextureAtlas` ctor takes a SINGLE string arg** (`TextureAtlas.d.ts:35: constructor(atlasText: string)`) — no loader param; textures are attached separately via `setTextures(...)` and are **not needed** because the bake/oracle never read pixels (CLAUDE.md Fact #4). Use the **single-arg form** as in `d13-43-load-smoke.spec.ts:119`. The intent of D-04 (build atlas from text, no PNG probe, no `loadSkeleton`) is satisfied — the `stubLoader` second arg is a stale API memory.

For the oracle, parametrize this over `scale`:
```typescript
const parseAt = (jsonText: string, atlasText: string, scale: number, Spine /* 42 or 43 module */) => {
  const atlas = new Spine.TextureAtlas(atlasText);
  const sj = new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas));
  sj.scale = scale;                                        // the reference side: SkeletonJson's OWN scaling
  return sj.readSkeletonData(JSON.parse(jsonText));
};
const baked = parseAt(JSON.stringify(bake(orig, s)), atlasText, 1, Spine);   // bake → parse@1
const ref   = parseAt(JSON.stringify(orig),          atlasText, s, Spine);   // orig → parse@s (LIVE reference, no goldens)
```

**Analog B — both-specifier co-import (4.2 + 4.3 runtime selection):** `tests/runtime/runtime-distinctness.spec.ts:38-47` (EXACT precedent + the rationale comment that `tests/**` is EXEMPT from arch.spec's `src/**`-scoped both-specifier guard — RESEARCH § Oracle Entrypoint).

Import shape (`runtime-distinctness.spec.ts:42-47`):
```typescript
import * as sc43 from '@esotericsoftware/spine-core';   // 4.3.0
import * as sc42 from 'spine-core-42';                   // 4.2.111 alias
// Pick by the rig's skeleton.spine major.minor: "4.2.x"→sc42, "4.3.x"→sc43 (RESEARCH § runtime selection).
```
> This co-import is SANCTIONED in `tests/` (precedent: this file + `d13-43-load-smoke.spec.ts`). `arch.spec.ts` RT-03 (lines 325-337) scans `src/**` ONLY — the oracle is fine.

**Analog C — cycle-safe deep-compare oracle (the field-identity assertion):** `.planning/spikes/002-json-bake-roundtrip/bake.mjs:96-121` (identical to `baker.mjs`'s; promote to a vitest assertion). Promote verbatim:
```js
const near = (x, y) => Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y));   // L-04 ~1e-3 rel tol
const SKIP = new Set(['parent','children','bones','bone','target','source','slot','skin',
  'attachment','page','region','texture','rendererObject','renderObject','timelineAttachment',
  'data','_parent','_bones','_bone','_target','_source','_slot','_skin','_data',
  '_meshAttachment','sequence','name','path','id','hash','assetId']);   // exclude refs + parse-assigned ids (L-04)

function fieldMismatches(baked, ref) {                    // returns string[] of mismatched paths (empty = field-identical)
  const seen = new WeakSet(); const mism = new Map();
  (function cmp(a, b, p) {
    if (typeof a === 'number' && typeof b === 'number') { if (!near(a, b)) mism.set(p, (mism.get(p) ?? 0) + 1); return; }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
    if (seen.has(a)) return; seen.add(a);                 // WeakSet on the a-side breaks cycles
    if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${p}[]`); return; }
    for (const k of Object.keys(a)) { if (SKIP.has(k) || typeof a[k] === 'function') continue; if (k in b) cmp(a[k], b[k], p ? `${p}.${k}` : k); }
  })(baked, ref, '');
  return [...mism.entries()].sort((a, b) => b[1] - a[1]).map(([path, n]) => `${path} (${n})`);
}
// vitest assertion:  expect(fieldMismatches(baked, ref), `field-identity broke @ s=${s} for ${rig}`).toEqual([]);
```

**Fixture-load + ENOENT/exists discipline (D-06a #3 — NO `skipIf(!exists)`; hard-fail on missing):** mirror the `tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts:37-49,68-74` `readFileSync` + `REPO_ROOT` pattern, BUT instead of a silent ENOENT skip, **hard-fail**. The standing-guard precedent for "assert every matrix fixture exists" is `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts:14-26` (a `FIXTURES[]` array resolved against `REPO_ROOT`, looped with a per-fixture `it(...)`). Compose:
```typescript
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const REPO_ROOT = resolve(__dirname, '..');               // tests/ is one level under repo root (vs '..','..' for tests/runtime/)
const MATRIX = [
  { rig: 'fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02', runtime: '4.3' as const },   // DEMON copy
  { rig: 'fixtures/SCALE_BAKE_4_2/TEST_01',          runtime: '4.2' as const },   // TEST_01 copy
  { rig: 'fixtures/SCALE_BAKE_4_2/TEST_03',          runtime: '4.2' as const },   // 4.2 ik-curve (A1, optional)
  { rig: 'fixtures/SCALE_BAKE_PATH_43/PATH_FIXED',   runtime: '4.3' as const },   // synthetic path-Fixed
  { rig: 'fixtures/spineboy_4.3/spineboy-pro',       runtime: '4.3' as const },   // TRACKED — ik-curve
  { rig: 'fixtures/SLIDER_4_3/SLIDER-01',            runtime: '4.3' as const },   // TRACKED — slider remap
  { rig: 'fixtures/SIMPLE_PROJECT_43/skeleton2',     runtime: '4.3' as const },   // TRACKED — 4.3 path setup
  { rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST',      runtime: '4.2' as const },   // TRACKED — 4.2 baseline
];
const SCALES = [0.5, 0.26, 2.0];                          // RESEARCH Open-Q2: non-round + upscale (D-09 direction-agnostic)
// Standing guard (D-06a #3): assert presence FIRST, hard-fail, never skip:
for (const { rig } of MATRIX) {
  it(`fixture present: ${rig}`, () => {
    expect(existsSync(resolve(REPO_ROOT, rig + '.json')), `fixture not found: ${rig}.json`).toBe(true);
    expect(existsSync(resolve(REPO_ROOT, rig + '.atlas')), `fixture not found: ${rig}.atlas`).toBe(true);
  });
}
```
> Do NOT copy `runtime-43-mesh-uv-pagespace.spec.ts`'s `isFileAbsent`/`return null` ENOENT-skip idiom — that is the green-wash D-06a #3 forbids for THIS oracle. (It is legitimate there because that test's fixtures are guaranteed-tracked; the oracle's fixtures include freshly-committed ones whose tracking must be PROVEN, so a missing file must be a loud failure.)

**Import the bake under test** (vitest setup auto-resolves `.ts`; `vitest.config.ts:23 setupFiles: ['tests/setup/esm-adapter-resolver.ts']`): `import { bake, ScaleBakeError } from '../src/core/scale-bake.js';` (the `.js` extension convention as in `d12-...spec.ts:3-5`). The oracle does NOT route through `loadSkeleton`/the facade (D-04 direct-atlas path), so the ESM adapter seam is NOT on the critical path — but it is bound under vitest if ever needed (RESEARCH § Oracle Entrypoint).

---

### `tests/arch.spec.ts` (test, arch gate — MODIFIED, OPTIONAL)

**The `src/core/**` glob ALREADY covers `src/core/scale-bake.ts` with NO carve-out** (`arch.spec.ts:148-178` — the fs/sharp scanner globs `src/core/**/*.ts`; only `loader.ts`/`png-header.ts`/`synthetic-atlas.ts` are carved out). A new pure module needs ZERO arch.spec change to be enforced. A named anchor is **optional belt-and-suspenders** (RESEARCH § Promotion #5 + CONTEXT canonical_refs).

**If adding the optional named anchor, copy the Phase-9 ENOENT-tolerant block shape** (`arch.spec.ts:200-231` — the canonical "name a not-yet-existing file, tolerate ENOENT until it lands" pattern):
```typescript
// Phase 48 — Layer-3 named anchor for the new pure scale-bake module.
// The existing src/core/** fs/sharp scanner (lines 148-178) already covers
// scale-bake.ts with NO carve-out; this named block makes a Phase-48-specific
// purity regression visible at PR-review time.
describe('Phase 48 Layer 3: src/core/scale-bake.ts is pure (no DOM/Electron/sharp/node:fs)', () => {
  it('does not import sharp, node:fs, electron, or DOM globals', () => {
    const filePath = 'src/core/scale-bake.ts';
    let text = '';
    try { text = readFileSync(filePath, 'utf8'); } catch { return; }   // tolerate ENOENT until Wave 1 lands it
    expect(text, `${filePath} must not import sharp`).not.toMatch(/from ['"]sharp['"]/);
    expect(text, `${filePath} must not import node:fs`).not.toMatch(/from ['"]node:fs(\/promises)?['"]/);
    expect(text, `${filePath} must not import electron`).not.toMatch(/from ['"]electron['"]/);
    expect(text, `${filePath} must not reference DOM globals`).not.toMatch(/\b(document|window)\./);
  });
});
```
> Caveat (memory `project_phase46_sliderguard_pinned`): if the anchor diffs against a commit range, PIN the upper bound to the phase-end commit, never `..HEAD` (a `..HEAD` range becomes a time-bomb once any later phase touches `src/core/`). A plain content-grep (as above) has no range and is time-bomb-free — prefer it.

---

### Fixture dirs (config / file-I/O)

**Analog:** `fixtures/SIMPLE_PROJECT_43/` — a tracked `fixtures/<RIG>/` dir with `.json` + `.atlas` siblings, the exact convention every oracle/golden test drives from. **VERIFIED tracked + not-ignored** (`git ls-files --error-unmatch` succeeds; `git check-ignore` prints nothing).

**Real `.atlas` text shape** (`fixtures/SIMPLE_PROJECT_43/skeleton2.atlas` — verbatim; this is the minimal multi-region form, text-only, NO pixel data — D-04 confirms committing it leaks nothing):
```
skeleton2.png
size:2466,1004
filter:Linear,Linear
CIRCLE
bounds:1765,303,699,699
SQUARE
bounds:2,2,1000,1000
TRIANGLE
bounds:1004,169,833,759
rotate:90
rect
bounds:1004,67,100,500
rotate:90
```
> Format per region: `<regionName>` line, then `bounds:x,y,w,h` (page-space UV rect), optional `rotate:90`. The first 3 lines are the page header: `<page>.png` / `size:W,H` / `filter:...`. (DEMON's atlas uses the same shape with `rotate:90` on rotated regions — `fixtures/DEMON/SKINS_SPINE_V02.atlas` confirmed.)

**Minimal synthetic `.atlas` for `fixtures/SCALE_BAKE_PATH_43/`** (single 1-region page is enough — the bake/oracle read only region dims, never pixels; RESEARCH § residual gap spec):
```
PATH_FIXED.png
size:64,64
filter:Linear,Linear
region
bounds:0,0,32,32
```

**The three dirs + their provenance (RESEARCH § Recommended Project Structure + Fixture Coverage Matrix):**

| New dir | Source | Why load-bearing (not redundant with tracked rigs) |
|---------|--------|---------------------------------------------------|
| `fixtures/SCALE_BAKE_4_3/` | COPY `fixtures/DEMON/SKINS_SPINE_V02.{json,atlas}` (json 454KB + atlas 2.8KB; spine 4.3.02) | ONLY source of 4.3 physics + `physics.limit`-present injection + all-types 4.3 stress. DEMON has 0 deform (false-confidence trap), 0 path, slider is `rotate`→×1. |
| `fixtures/SCALE_BAKE_4_2/` | COPY `fixtures/MON_FILES/EXPORT/TEST_01/4.2/TEST_01.{json,atlas}` (json 704KB + atlas 3.4KB; spine 4.2.43) + optionally `TEST_03.{json,atlas}` (A1, 4.2 ik-curve) | ONLY 4.2 deform-heavy all-four-types rig (transform+ik+path+physics, deform×18). Defeats the DEMON-has-no-deform trap. |
| `fixtures/SCALE_BAKE_PATH_43/` | AUTHOR a tiny synthetic 4.3 path-Fixed rig + `.atlas` above | The ONLY genuine residual gap (RESEARCH verified exhaustive scan: zero on-disk rig uses `positionMode:fixed`/`spacingMode:fixed`/any spacing timeline). Drives SkeletonJson.js:994/999. Shape: 2 bones, 1 path attachment (verts + `lengths`), 1 slot, 1 path constraint (`positionMode:"fixed"`, `spacingMode:"fixed"`), 1 anim with a `path` timeline animating BOTH position+spacing, ≥2 keys, ≥1 with a `curve`. ~60-100 lines JSON. |

---

## Shared Patterns

### Layer-3 purity (applies to `src/core/scale-bake.ts`)
**Source:** `tests/arch.spec.ts:148-178` (`src/core/**` fs/sharp scanner, no carve-out for new files) + `src/core/bones.ts` (the pure-module exemplar).
**Apply to:** the new bake module — import no `sharp`/`node:fs`/`node:fs/promises`/`electron`, reference no `document.`/`window.`. Easiest guarantee: the bake takes raw JSON and imports NOTHING from spine-core (not even types). This is auto-enforced by the existing glob; the named anchor is optional.

### Cross-version handling via raw JSON, not the facade (applies to bake + oracle)
**Source:** the `constraintsOf` schema-bridge (`baker.mjs:7-16`) for the bake; both-specifier import (`runtime-distinctness.spec.ts:42-47`) for the oracle's per-version reference parse.
**Apply to:** the bake handles 4.2-split + 4.3-unified through ONE loop (`constraintsOf`); the oracle picks `sc42` vs `sc43` by `skeleton.spine`. The bake is runtime-agnostic; ONLY the reference parser is per-version. (Memory `project_strict_loadermode_separation` does NOT apply — the bake is atlas-independent by construction, L-06; no atlas/atlas-less branch.)

### Typed-error envelope (applies to the guards)
**Source:** `src/core/errors.ts:13-18` (root class + `.name`).
**Apply to:** one `ScaleBakeError extends Error` (set `.name`) serving both D-09 + D-10. No IPC `KNOWN_KINDS`/`src/main/ipc.ts` wiring needed in Phase 48 (the bake has no UI/IPC caller this phase — Phase 49 wires it).

### Fixture-commit safety (applies to all three new fixture dirs — RESEARCH § Fixture-Commit Safety; planner: SEPARATE EXPLICIT TASK per D-06a)
**Source:** the COPY-into-new-non-ignored-dir recipe (D-06a option 1) + memory `feedback_gitignore_fixtures_check_test_refs`.
**VERIFIED git-status reality this session:**
- `fixtures/DEMON/SKINS_SPINE_V02.json` — **untracked, NOT ignored** (`git ls-files --error-unmatch` fails). `git add fixtures/DEMON/` would stage **63 PNGs / 174MB** — DO NOT.
- `fixtures/MON_FILES/EXPORT/TEST_01/4.2/TEST_01.json` — **DIR-IGNORED** (`.gitignore:27 fixtures/MON_FILES/`); `git check-ignore` MATCHES → `git add` **silently no-ops** (the exact v1.3.1 landmine).
- `fixtures/spineboy_4.3/`, `fixtures/SLIDER_4_3/`, `fixtures/SIMPLE_PROJECT_43/`, `fixtures/SIMPLE_PROJECT/` — **TRACKED + reachable** (verified). Reuse in place, no action.
- `.gitignore` also dir-ignores `fixtures/3Queens/`, `fixtures/Girl/`, `fixtures/test_4.3/` (the latter = rejected betas, RESEARCH Pitfall 5 — never use as fixtures).

**Apply to:** COPY only `.json`+`.atlas` (NEVER PNGs) into the three NEW dirs (a brand-new dir has no PNGs to stage, no ignore rule to fight). Then PROVE tracked (acceptance criteria — RESEARCH § verification commands):
```bash
git check-ignore fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.json   # must print NOTHING (exit 1)
git ls-files --error-unmatch fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02.json   # must succeed AFTER commit
git archive HEAD | tar -t | grep SCALE_BAKE_4_3   # must list the file in the committed tree
# repeat for EVERY fixture the oracle reads, incl. each .atlas
```
Authoritative signal = the watched per-OS run of BOTH `ci.yml` AND `release.yml` (they diverge — memory `feedback_release_yml_diverges_from_ci_yml`). Local green ≠ CI green.

---

## No Analog Found

None — every file has a strong, CI-passing analog in the repo.

| File | Role | Closest fit | Note |
|------|------|-------------|------|
| (all 6) | — | — | The bake's *base* is a spike `.mjs` (not in `src/`), but its structural conventions map exactly to `src/core/bones.ts`; the oracle composes three existing test patterns; fixtures follow `fixtures/SIMPLE_PROJECT_43/`. No RESEARCH-pattern fallback needed. |

---

## Metadata

**Analog search scope:** `src/core/`, `src/core/runtime/`, `tests/`, `tests/runtime/`, `fixtures/`, `.planning/spikes/002-json-bake-roundtrip/`, `node_modules/@esotericsoftware/spine-core/dist/` (TextureAtlas/AtlasAttachmentLoader d.ts).
**Files scanned (read):** `src/core/errors.ts`, `src/core/bones.ts`, `.planning/spikes/002-json-bake-roundtrip/baker.mjs`, `.../bake.mjs` (oracle + header), `tests/runtime/runtime-distinctness.spec.ts`, `tests/runtime/runtime-43-mesh-uv-pagespace.spec.ts`, `tests/runtime/d13-43-load-smoke.spec.ts` (atlas-build), `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts`, `tests/arch.spec.ts`, `fixtures/SIMPLE_PROJECT_43/skeleton2.atlas`, `fixtures/DEMON/SKINS_SPINE_V02.atlas` (head).
**New dependency required:** none (spine-core 4.3.0 + spine-core-42 4.2.111 + vitest all present — VERIFIED).
**Key API correction surfaced:** D-04's `new Spine.TextureAtlas(atlasText, stubLoader)` 2-arg form is stale — installed spine-core 4.3.0 `TextureAtlas` ctor is single-arg `(atlasText: string)`; use `d13-43-load-smoke.spec.ts:119-122`'s `new TextureAtlas(text)` → `AtlasAttachmentLoader` → `SkeletonJson` chain.
**Pattern extraction date:** 2026-05-22
