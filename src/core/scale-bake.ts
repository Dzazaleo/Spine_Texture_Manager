/**
 * Phase 48 Plan 01 — The JSON→JSON similarity bake (BAKE-01/02/04).
 *
 * Pure JSON→JSON similarity bake, mirroring spine-core's `SkeletonJson.scale`
 * field rules. Promoted VERBATIM from the validated spike
 * `.planning/spikes/002-json-bake-roundtrip/baker.mjs` (proven field-identical
 * to Spine's own scaling on 4.2 + 4.3, incl. DEMON's worst constraints).
 *
 * Covers BOTH the 4.3 unified `constraints[]` schema and the 4.2 split
 * `transform`/`ik`/`path`/`physics[]` schema through one `constraintsOf` loop.
 *
 * The source object is NEVER mutated (L-05): `bake` clones first and returns the
 * NEW clone. The bake operates on the RAW parsed skeleton JSON (dynamic keys) —
 * it imports NOTHING from spine-core (not even types). Follows CLAUDE.md rule #5
 * (core/ is pure TS, no DOM); enforced by the tests/arch.spec.ts `src/core/**`
 * Layer-3 purity scanner (no carve-out for this file).
 *
 * Scope note (Phase 48): this plan delivers the SETUP-SIDE bake (bones,
 * constraints, skin attachments, scaled-default injections) + the two guards
 * (D-09 degenerate-`s`, D-10 assert-known). It carries over the existing
 * translate/deform/ik-value animation walks from the spike so the module is
 * whole. The three constraint-timeline curve channel fixes (slider remap, path
 * mode-gating, ik softness-curve cy) land in Plan 48-02; the slider setup branch
 * and path setup mode-gating fix also land in 48-02 (NOT here).
 */

type SkeletonJsonRaw = Record<string, any>;

/**
 * Typed error for the bake. Serves both D-09 (degenerate `s`) and D-10
 * (unrecognized type discriminator) — the message string discriminates the two
 * cases. Mirrors the `src/core/errors.ts` root-class shape (extend Error, set
 * `.name`). Co-located here per 48-PATTERNS (the error is single-module-scoped
 * with no IPC routing need this phase).
 */
export class ScaleBakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaleBakeError';
  }
}

const spatial = (p: string) => p === 'x' || p === 'y';
const clone = (o: SkeletonJsonRaw): SkeletonJsonRaw => JSON.parse(JSON.stringify(o));

function scaleCurve(curve: any, s: number) {
  if (Array.isArray(curve)) for (let i = 0; i < curve.length; i++) if (i % 4 === 1 || i % 4 === 3) curve[i] *= s;
}

function constraintsOf(j: SkeletonJsonRaw): [string, any][] {
  const out: [string, any][] = [];
  for (const c of j.constraints || []) out.push([c.type, c]); // 4.3 unified
  for (const c of j.transform || []) out.push(['transform', c]); // 4.2 split ↓
  for (const c of j.ik || []) out.push(['ik', c]);
  for (const c of j.path || []) out.push(['path', c]);
  for (const c of j.physics || []) out.push(['physics', c]);
  for (const c of j.slider || []) out.push(['slider', c]);
  return out;
}

function scaleVertices(att: any, verticesLength: number, s: number) {
  const v = att.vertices;
  if (!Array.isArray(v)) return;
  if (verticesLength === v.length) {
    for (let i = 0; i < v.length; i++) v[i] *= s;
    return;
  }
  // weighted: bone-count stride, positions only (v[i+1], v[i+2])
  for (let i = 0; i < v.length; ) {
    const bc = v[i++];
    for (let nn = i + bc * 4; i < nn; i += 4) {
      v[i + 1] *= s;
      v[i + 2] *= s;
    }
  }
}

export function bake(json: SkeletonJsonRaw, s: number): SkeletonJsonRaw {
  // D-09 — direction-agnostic degenerate-`s` guard: reject ONLY s<=0/NaN/±Infinity.
  if (!Number.isFinite(s) || s <= 0) throw new ScaleBakeError(`scale must be finite > 0, got ${s}`);
  const j = clone(json); // L-05: clone FIRST; source never mutated
  if (!j.skeleton) j.skeleton = {};
  // L-02 scaled-default injection: 100×s when absent, else ×s.
  j.skeleton.referenceScale = (typeof j.skeleton.referenceScale === 'number' ? j.skeleton.referenceScale : 100) * s;
  for (const b of j.bones || []) for (const f of ['length', 'x', 'y']) if (typeof b[f] === 'number') b[f] *= s;
  for (const [type, c] of constraintsOf(j)) {
    if (type === 'transform') {
      for (const f of ['x', 'y']) if (typeof c[f] === 'number') c[f] *= s;
      for (const [srcProp, from] of Object.entries(c.properties || {}) as [string, any][]) {
        const fromScale = spatial(srcProp) ? s : 1;
        if (typeof from.offset === 'number' && spatial(srcProp)) from.offset *= s;
        for (const [tgtProp, to] of Object.entries(from.to || {}) as [string, any][]) {
          const toScale = spatial(tgtProp) ? s : 1;
          if (typeof to.offset === 'number') to.offset *= toScale;
          if (typeof to.max === 'number') to.max *= toScale;
          if (typeof to.scale === 'number') to.scale *= toScale / fromScale;
        }
      }
    } else if (type === 'ik') {
      if (typeof c.softness === 'number') c.softness *= s;
    } else if (type === 'path') {
      if (typeof c.limit === 'number') c.limit *= s;
      if (c.positionMode !== 'percent' && typeof c.position === 'number') c.position *= s;
      if ((c.spacingMode === 'length' || c.spacingMode === 'proportional') && typeof c.spacing === 'number')
        c.spacing *= s;
    } else if (type === 'physics') {
      // physics x/y are NOT scaled by spine (they're not length offsets). Only limit is.
      c.limit = (typeof c.limit === 'number' ? c.limit : 5000) * s;
    }
    // NOTE (Phase 48-01): the slider setup branch + the path setup mode-gating
    // fix land in Plan 48-02. The `path` branch above is the verbatim spike form.
  }
  for (const skin of j.skins || []) {
    for (const slotName of Object.keys(skin.attachments || {})) {
      for (const a of Object.values(skin.attachments[slotName]) as any[]) {
        const type = a.type || 'region';
        if (type === 'region') {
          for (const f of ['x', 'y', 'width', 'height']) if (typeof a[f] === 'number') a[f] *= s;
        } else if (type === 'mesh') {
          for (const f of ['width', 'height']) if (typeof a[f] === 'number') a[f] *= s;
          if (Array.isArray(a.uvs)) scaleVertices(a, a.uvs.length, s);
        } else if (type === 'path') {
          if (Array.isArray(a.lengths)) for (let i = 0; i < a.lengths.length; i++) a.lengths[i] *= s;
          scaleVertices(a, (a.vertexCount || 0) * 2, s);
        } else if (type === 'boundingbox' || type === 'clipping') {
          scaleVertices(a, (a.vertexCount || 0) * 2, s);
        } else if (type === 'point') {
          for (const f of ['x', 'y']) if (typeof a[f] === 'number') a[f] *= s;
        }
        // 'linkedmesh' is recognized no-own-geometry (inherits source geometry):
        // recognized, NOT scaled, NOT a throw.
      }
    }
  }
  for (const anim of Object.values(j.animations || {}) as any[]) {
    for (const tls of Object.values(anim.bones || {}) as any[])
      for (const [tlName, keys] of Object.entries(tls) as [string, any][]) {
        if (!Array.isArray(keys) || !(tlName === 'translate' || tlName === 'translatex' || tlName === 'translatey'))
          continue;
        for (const k of keys) {
          for (const f of ['x', 'y', 'value']) if (typeof k[f] === 'number') k[f] *= s;
          scaleCurve(k.curve, s);
        }
      }
    // Deform timelines live under attachments[skin][slot][attachment].deform on BOTH 4.2 and 4.3
    // (NOT anim.deform). Scale the keyframe `vertices` offsets ×s; `offset` is an index (no scale);
    // the deform `curve` is a normalized 0..1 mix bezier — do NOT scale it.
    for (const skinMap of Object.values(anim.attachments || {}) as any[])
      for (const slotMap of Object.values(skinMap) as any[])
        for (const attMap of Object.values(slotMap) as any[])
          for (const [tlName, keys] of Object.entries(attMap) as [string, any][]) {
            if (tlName !== 'deform' || !Array.isArray(keys)) continue; // 'sequence' etc.: no scaling
            for (const k of keys) if (Array.isArray(k.vertices)) for (let i = 0; i < k.vertices.length; i++) k.vertices[i] *= s;
          }
    for (const keys of Object.values(anim.ik || {}) as any[]) {
      if (!Array.isArray(keys)) continue;
      for (const k of keys) if (typeof k.softness === 'number') k.softness *= s;
    }
  }
  return j;
}
