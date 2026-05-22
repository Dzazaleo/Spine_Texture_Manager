// The validated JSON→JSON similarity bake (Spike 002). Mirrors spine-core's
// SkeletonJson.scale field rules; covers 4.3 unified constraints[] and 4.2 split
// transform/ik/path/physics[]. Proven field-identical to Spine's own scaling.
export const spatial = (p) => p === 'x' || p === 'y';
const clone = (o) => JSON.parse(JSON.stringify(o));
function scaleCurve(curve, s) { if (Array.isArray(curve)) for (let i = 0; i < curve.length; i++) if (i % 4 === 1 || i % 4 === 3) curve[i] *= s; }
function constraintsOf(j) {
  const out = [];
  for (const c of j.constraints || []) out.push([c.type, c]);
  for (const c of j.transform || []) out.push(['transform', c]);
  for (const c of j.ik || []) out.push(['ik', c]);
  for (const c of j.path || []) out.push(['path', c]);
  for (const c of j.physics || []) out.push(['physics', c]);
  for (const c of j.slider || []) out.push(['slider', c]);
  return out;
}
function scaleVertices(att, verticesLength, s) {
  const v = att.vertices; if (!Array.isArray(v)) return;
  if (verticesLength === v.length) { for (let i = 0; i < v.length; i++) v[i] *= s; return; }
  for (let i = 0; i < v.length;) { const bc = v[i++]; for (let nn = i + bc * 4; i < nn; i += 4) { v[i + 1] *= s; v[i + 2] *= s; } }
}
export function bake(json, s) {
  const j = clone(json);
  if (!j.skeleton) j.skeleton = {};
  j.skeleton.referenceScale = (typeof j.skeleton.referenceScale === 'number' ? j.skeleton.referenceScale : 100) * s;
  for (const b of j.bones || []) for (const f of ['length', 'x', 'y']) if (typeof b[f] === 'number') b[f] *= s;
  for (const [type, c] of constraintsOf(j)) {
    if (type === 'transform') {
      for (const f of ['x', 'y']) if (typeof c[f] === 'number') c[f] *= s;
      for (const [srcProp, from] of Object.entries(c.properties || {})) {
        const fromScale = spatial(srcProp) ? s : 1;
        if (typeof from.offset === 'number' && spatial(srcProp)) from.offset *= s;
        for (const [tgtProp, to] of Object.entries(from.to || {})) {
          const toScale = spatial(tgtProp) ? s : 1;
          if (typeof to.offset === 'number') to.offset *= toScale;
          if (typeof to.max === 'number') to.max *= toScale;
          if (typeof to.scale === 'number') to.scale *= toScale / fromScale;
        }
      }
    } else if (type === 'ik') { if (typeof c.softness === 'number') c.softness *= s; }
    else if (type === 'path') {
      if (typeof c.limit === 'number') c.limit *= s;
      if (c.positionMode !== 'percent' && typeof c.position === 'number') c.position *= s;
      if ((c.spacingMode === 'length' || c.spacingMode === 'proportional') && typeof c.spacing === 'number') c.spacing *= s;
    } else if (type === 'physics') {
      // physics x/y are NOT scaled by spine (they're not length offsets). Only limit is.
      c.limit = (typeof c.limit === 'number' ? c.limit : 5000) * s;
    }
  }
  for (const skin of j.skins || []) {
    for (const slotName of Object.keys(skin.attachments || {})) {
      for (const a of Object.values(skin.attachments[slotName])) {
        const type = a.type || 'region';
        if (type === 'region') { for (const f of ['x', 'y', 'width', 'height']) if (typeof a[f] === 'number') a[f] *= s; }
        else if (type === 'mesh') { for (const f of ['width', 'height']) if (typeof a[f] === 'number') a[f] *= s; if (Array.isArray(a.uvs)) scaleVertices(a, a.uvs.length, s); }
        else if (type === 'path') { if (Array.isArray(a.lengths)) for (let i = 0; i < a.lengths.length; i++) a.lengths[i] *= s; scaleVertices(a, (a.vertexCount || 0) * 2, s); }
        else if (type === 'boundingbox' || type === 'clipping') { scaleVertices(a, (a.vertexCount || 0) * 2, s); }
        else if (type === 'point') { for (const f of ['x', 'y']) if (typeof a[f] === 'number') a[f] *= s; }
      }
    }
  }
  for (const anim of Object.values(j.animations || {})) {
    for (const tls of Object.values(anim.bones || {}))
      for (const [tlName, keys] of Object.entries(tls)) {
        if (!Array.isArray(keys) || !(tlName === 'translate' || tlName === 'translatex' || tlName === 'translatey')) continue;
        for (const k of keys) { for (const f of ['x', 'y', 'value']) if (typeof k[f] === 'number') k[f] *= s; scaleCurve(k.curve, s); }
      }
    // Deform timelines live under attachments[skin][slot][attachment].deform on BOTH 4.2 and 4.3
    // (NOT anim.deform). Scale the keyframe `vertices` offsets ×s; `offset` is an index (no scale);
    // the deform `curve` is a normalized 0..1 mix bezier — do NOT scale it.
    for (const skinMap of Object.values(anim.attachments || {}))
      for (const slotMap of Object.values(skinMap))
        for (const attMap of Object.values(slotMap))
          for (const [tlName, keys] of Object.entries(attMap)) {
            if (tlName !== 'deform' || !Array.isArray(keys)) continue; // 'sequence' etc.: no scaling
            for (const k of keys) if (Array.isArray(k.vertices)) for (let i = 0; i < k.vertices.length; i++) k.vertices[i] *= s;
          }
    for (const keys of Object.values(anim.ik || {})) { if (!Array.isArray(keys)) continue; for (const k of keys) if (typeof k.softness === 'number') k.softness *= s; }
  }
  return j;
}
