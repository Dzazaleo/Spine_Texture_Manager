// src/shared/spine43-constraint-mix-normalize.ts
//
// debug-fix viewer-43-42-constraint-parse (2026-05-19) — owner-classified
// post-v1.6-completion fix, same class as e7db8fe (folded into v1.6).
//
// ── What this fixes ──────────────────────────────────────────────────────────
//
// spine-core@4.3.0's `SkeletonJson` applies CHAINED defaults when reading a
// `type:"transform"` constraint's setup-pose mixes
// (node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:239-250,
// verified 2026-05-19):
//
//   if (x)      setup.mixX      = getValue(map, "mixX",      1);
//   if (y)      setup.mixY      = getValue(map, "mixY",      setup.mixX);   // ← chained
//   if (scaleX) setup.mixScaleX = getValue(map, "mixScaleX", 1);
//   if (scaleY) setup.mixScaleY = getValue(map, "mixScaleY", setup.mixScaleX); // ← chained
//   if (shearY) setup.mixShearY = getValue(map, "mixShearY", 1);            // NOT chained
//
// `x`/`y`/`scaleX`/`scaleY` are set true ONLY when the constraint's
// `properties.{input}.to` block declares that output axis. When a constraint
// has a `y` output but NO `x` output (a legitimate, Spine-editor-producible
// rig — e.g. DEMON's `R_IK_HEEL-to-R_IK_WRIST`, a y-input → {rotate, y}-output
// transform), `if (x)` is false ⇒ `setup.mixX` is NEVER assigned ⇒ stays
// `undefined`. Then `if (y)` is true ⇒ `setup.mixY = getValue(map, "mixY",
// undefined)`. The Spine 4.3 editor OMITS `mixY` from the JSON precisely
// because it relies on this chained default — but the chain source (`mixX`)
// is absent, so `mixY` resolves to `undefined`, which spine-core coerces to
// `0`. Result: the Y-axis transform-constraint coupling is silently DEAD,
// collapsing every downstream IK chain that the constraint drives (the
// observed symptom: R_IK_WRIST world-position frozen ⇒ the R-arm IK chain
// never animates on `drive`/`con` × `FULL_SKINS/{ANGEL,DEMON}`).
//
// Same defect for the `scaleY ← scaleX` chained pair (line 248).
//
// `mixShearY` is INTENTIONALLY EXCLUDED: SkeletonJson.js:250 is
// `getValue(map, "mixShearY", 1)` — an UNCONDITIONAL `1` default, NOT a
// chained `setup.mixShearX`. It cannot collapse to undefined, so it needs no
// normalization. (This reconciles the owner fix-direction note, which listed
// mixShearY as an analogous chained pair: the 4.3.0 source shows it is not.)
//
// ── The shim ─────────────────────────────────────────────────────────────────
//
// Mirror the runtime's chained default EXACTLY at the JSON level, ONLY when
// the JSON genuinely omits the explicit key (never overwrite an
// author-specified mix): if a transform constraint has a `y` output, NO `x`
// output, and NO own `mixY` key, inject `mixY: 1` (the value the chain WOULD
// have produced had an `x` output been present, since `mixX` itself defaults
// to `1`). Symmetrically for `mixScaleY` (scaleY output, no scaleX output, no
// own `mixScaleY`).
//
// ── Scope (per-runtime seam — applied on BOTH 4.3 feed points) ────────────────
//
//   1. App-core runtime-43 ingest (runtime-43.ts:parseSkeleton) — feeds the
//      Scale-table sampler.
//   2. Animation Viewer's 4.3 leg (AnimationPlayerModal.tsx) — feeds
//      spine-player@4.3.0.
//
// Both must apply the SAME normalization so the viewer and the core Scale
// table cannot diverge (memory: per-runtime-seam verify-all-entrypoints rule).
// This module is the single shared chokepoint. It lives in src/shared/
// (not src/core/) BECAUSE the renderer-to-core import boundary is enforced
// (tests/arch.spec.ts:19-23 — a src/renderer/** file may not import
// src/core/*). src/shared/ is the sanctioned cross-boundary location both
// src/core/runtime/runtime-43.ts and the renderer modal may import. It is
// intentionally spine-core-free and DOM-free — pure structural JSON mutation.
//
// Only 4.3-native `root.constraints[]` JSON is ever passed here: the loader's
// `resolveRuntimeTag` routes a 4.2 JSON (separate `root.ik/transform/path`,
// no `root.constraints[]`) to runtime-42 / the frozen 4.2 viewer leg, neither
// of which calls this. A non-4.3 / array-less input is a structural no-op.

/** Minimal structural views — no spine-core / DOM types. */
interface TransformProperty {
  to?: Record<string, unknown> | null;
}
interface TransformConstraintMap {
  type?: unknown;
  properties?: Record<string, TransformProperty | null | undefined> | null;
  mixY?: unknown;
  mixScaleY?: unknown;
  [k: string]: unknown;
}
interface SkeletonRoot {
  constraints?: unknown;
  [k: string]: unknown;
}

/**
 * In-place normalization of Spine 4.3 `root.constraints[]` transform entries
 * so spine-core@4.3.0's chained `mix{Y,ScaleY} ← mix{X,ScaleX}` defaults do
 * not collapse to `undefined` (→ `0`) for a secondary-axis-only output.
 *
 * Mutates and returns `root` (callers feed the same object straight to
 * `SkeletonJson.readSkeletonData` / spine-player, so in-place is correct and
 * allocation-free). A non-object / non-4.3 / array-less `root` is returned
 * unchanged.
 *
 * Idempotent: re-running never changes an already-normalized object (the
 * injected key is then "own", so the `!('mixY' in c)` guard skips it), and it
 * NEVER overwrites an author-specified `mixY`/`mixScaleY`.
 */
export function normalizeSpine43ConstraintMixDefaults<T>(root: T): T {
  if (root === null || typeof root !== 'object') return root;
  const r = root as SkeletonRoot;
  const constraints = r.constraints;
  if (!Array.isArray(constraints)) return root;

  for (const raw of constraints) {
    if (raw === null || typeof raw !== 'object') continue;
    const c = raw as TransformConstraintMap;
    if (c.type !== 'transform') continue;
    const props = c.properties;
    if (props === null || props === undefined || typeof props !== 'object') {
      continue;
    }

    let hasX = false;
    let hasY = false;
    let hasScaleX = false;
    let hasScaleY = false;

    for (const inputKey of Object.keys(props)) {
      const entry = props[inputKey];
      const to = entry && entry.to;
      if (to === null || to === undefined || typeof to !== 'object') continue;
      // `in` (not value-truthiness): the runtime sets x/y/scaleX/scaleY = true
      // by the mere PRESENCE of the output key in `.to` (SkeletonJson.js:189-221),
      // regardless of the output's own offset/max/scale values.
      if ('x' in to) hasX = true;
      if ('y' in to) hasY = true;
      if ('scaleX' in to) hasScaleX = true;
      if ('scaleY' in to) hasScaleY = true;
    }

    // Mirror SkeletonJson.js:241-244 — only inject when the JSON omits the
    // explicit key (Object own-property check; never overwrite the author).
    if (
      hasY &&
      !hasX &&
      !Object.prototype.hasOwnProperty.call(c, 'mixY')
    ) {
      c.mixY = 1;
    }
    // Mirror SkeletonJson.js:245-248 for the scale pair.
    if (
      hasScaleY &&
      !hasScaleX &&
      !Object.prototype.hasOwnProperty.call(c, 'mixScaleY')
    ) {
      c.mixScaleY = 1;
    }
  }

  return root;
}
