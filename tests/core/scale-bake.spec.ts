/**
 * Phase 48 Plan 01 — Tests for src/core/scale-bake.ts (BAKE-01/02/04).
 *
 * Behavior gates (Task 1 — setup-side promotion + D-09 guard):
 *   - Non-mutating: bake clones first; the source object is byte-identical after.
 *   - Bone setup-pose length/x/y scale ×s; scaleX/Y/rotation/shear unchanged.
 *   - skeleton.referenceScale injects 100×s when absent, else ×s.
 *   - physics constraint limit injects 5000×s when absent; physics x/y unchanged.
 *   - D-09: bake(json, 0|-1|NaN|±Infinity) throws ScaleBakeError; s=2.0 succeeds.
 *
 * Behavior gates (Task 2 — D-10 assert-known on type discriminators):
 *   - Recognized attachment types (region/mesh/path/boundingbox/clipping/point/linkedmesh) do not throw.
 *   - Unknown attachment.type throws ScaleBakeError naming the type.
 *   - Recognized 4.3 constraint types (transform/ik/path/physics/slider) do not throw.
 *   - Unknown 4.3 constraint.type throws ScaleBakeError naming the type.
 *   - Unknown TIMELINE names do NOT throw (timelines stay allow-listed; unknowns skipped).
 */
import { describe, expect, it } from 'vitest';
import { bake, ScaleBakeError } from '../../src/core/scale-bake.js';

describe('scale-bake — Task 1: setup-side bake + D-09 guard', () => {
  it('returns a NEW object; the source is byte-identical before and after', () => {
    const orig = {
      skeleton: { referenceScale: 2 },
      bones: [{ name: 'b', x: 10, y: 20, length: 100, scaleX: 3, rotation: 45 }],
    };
    const snapshot = JSON.parse(JSON.stringify(orig));
    const out = bake(orig, 0.5);
    expect(out).not.toBe(orig); // new object
    expect(orig).toEqual(snapshot); // source untouched
  });

  it('scales bone length/x/y by s; leaves scaleX/rotation/shear unchanged', () => {
    const out = bake(
      { skeleton: {}, bones: [{ name: 'b', x: 10, y: 20, length: 100, scaleX: 3, rotation: 45, shearY: 7 }] },
      0.5,
    );
    expect(out.bones[0]).toMatchObject({ name: 'b', x: 5, y: 10, length: 50, scaleX: 3, rotation: 45, shearY: 7 });
  });

  it('injects referenceScale 100×s when absent', () => {
    expect(bake({}, 0.5).skeleton.referenceScale).toBe(50);
  });

  it('scales referenceScale ×s when present', () => {
    expect(bake({ skeleton: { referenceScale: 2 } }, 0.5).skeleton.referenceScale).toBe(1);
  });

  it('injects physics.limit 5000×s when absent; leaves physics x/y unchanged', () => {
    const out = bake({ skeleton: {}, physics: [{ x: 10, y: 20 }] }, 0.5);
    expect(out.physics[0].limit).toBe(2500);
    expect(out.physics[0].x).toBe(10);
    expect(out.physics[0].y).toBe(20);
  });

  it('rejects degenerate s with ScaleBakeError (0, -1, NaN, +Infinity)', () => {
    expect(() => bake({}, 0)).toThrow(ScaleBakeError);
    expect(() => bake({}, -1)).toThrow(ScaleBakeError);
    expect(() => bake({}, NaN)).toThrow(ScaleBakeError);
    expect(() => bake({}, Infinity)).toThrow(ScaleBakeError);
  });

  it('accepts upscale s=2.0 (direction-agnostic)', () => {
    expect(() => bake({ skeleton: {} }, 2.0)).not.toThrow();
    expect(bake({}, 2.0).skeleton.referenceScale).toBe(200);
  });

  it('uses the corrected deform container key (anim.attachments[skin][slot][att].deform)', () => {
    const out = bake(
      {
        skeleton: {},
        animations: {
          anim1: {
            attachments: {
              default: { slotA: { attA: { deform: [{ vertices: [4, 8], offset: 2 }] } } },
            },
          },
        },
      },
      0.5,
    );
    const k = out.animations.anim1.attachments.default.slotA.attA.deform[0];
    expect(k.vertices).toEqual([2, 4]); // ×s
    expect(k.offset).toBe(2); // index, not scaled
  });
});

describe('scale-bake — Task 2: D-10 assert-known on type discriminators', () => {
  const skinJson = (type: string) => ({
    skeleton: {},
    skins: [{ name: 'default', attachments: { slotA: { attA: { type } } } }],
  });

  it.each(['region', 'mesh', 'path', 'boundingbox', 'clipping', 'point', 'linkedmesh'])(
    'recognized attachment type %s does not throw',
    (type) => {
      expect(() => bake(skinJson(type), 0.5)).not.toThrow();
    },
  );

  it('throws ScaleBakeError naming an unknown attachment type', () => {
    expect(() => bake(skinJson('banana'), 0.5)).toThrow(/unknown attachment type.*banana/i);
  });

  it.each(['transform', 'ik', 'path', 'physics', 'slider'])(
    'recognized 4.3 constraint type %s does not throw',
    (type) => {
      expect(() => bake({ skeleton: {}, constraints: [{ type, name: 'c' }] }, 0.5)).not.toThrow();
    },
  );

  it('throws ScaleBakeError naming an unknown 4.3 constraint type', () => {
    expect(() => bake({ skeleton: {}, constraints: [{ type: 'wormhole', name: 'c' }] }, 0.5)).toThrow(
      /unknown constraint type.*wormhole/i,
    );
  });

  it('does NOT throw on unknown timeline names (rgba/event/drawOrder)', () => {
    const out = bake(
      {
        skeleton: {},
        animations: {
          anim1: {
            slots: { slotA: { rgba: [{ time: 0, color: 'ffffffff' }] } },
            drawOrder: [{ time: 0 }],
            events: [{ time: 0, name: 'evt' }],
          },
        },
      },
      0.5,
    );
    expect(out).toBeDefined(); // no throw — unknown timelines silently skipped
  });
});

describe('scale-bake — Task 1 (48-03): slider remap branch + source-faithful PATH setup mode-gating', () => {
  // Slider remap (4.3 only; SkeletonJson.js:333-336). Spatial property -> from ×s, scale ÷s; non-spatial ×1.
  it('4.3 slider with bone + spatial property x: from ×s, scale ÷s (slope)', () => {
    const out = bake(
      { skeleton: {}, constraints: [{ type: 'slider', name: 's', bone: 'b', property: 'x', from: 10, scale: 4 }] },
      0.5,
    );
    expect(out.constraints[0].from).toBe(5); // 10 × 0.5
    expect(out.constraints[0].scale).toBe(8); // 4 / 0.5 (slope = ÷ps)
  });

  it('4.3 slider with bone + non-spatial property rotate: from and scale unchanged (propertyScale = 1)', () => {
    const out = bake(
      { skeleton: {}, constraints: [{ type: 'slider', name: 's', bone: 'b', property: 'rotate', from: 10, scale: 4 }] },
      0.5,
    );
    expect(out.constraints[0].from).toBe(10); // ×1
    expect(out.constraints[0].scale).toBe(4); // ÷1
  });

  it('4.3 slider with NO bone: no remap reads happen (from/scale untouched)', () => {
    const out = bake(
      { skeleton: {}, constraints: [{ type: 'slider', name: 's', property: 'x', from: 10, scale: 4 }] },
      0.5,
    );
    expect(out.constraints[0].from).toBe(10); // no bone -> remap not read
    expect(out.constraints[0].scale).toBe(4);
  });

  // PATH setup-pose mode-gating (SkeletonJson.js:274-279). position iff Fixed; spacing iff Length||Fixed.
  it('path positionMode fixed scales position ×s', () => {
    const out = bake(
      { skeleton: {}, constraints: [{ type: 'path', name: 'p', positionMode: 'fixed', position: 100 }] },
      0.5,
    );
    expect(out.constraints[0].position).toBe(50);
  });

  it('path positionMode percent (and absent default) leaves position ×1', () => {
    const pct = bake(
      { skeleton: {}, constraints: [{ type: 'path', name: 'p', positionMode: 'percent', position: 100 }] },
      0.5,
    );
    expect(pct.constraints[0].position).toBe(100);
    const absent = bake({ skeleton: {}, constraints: [{ type: 'path', name: 'p', position: 100 }] }, 0.5);
    expect(absent.constraints[0].position).toBe(100); // default Percent -> ×1
  });

  it('path spacingMode length OR fixed scales spacing ×s; proportional leaves ×1 (the spike bug)', () => {
    const len = bake(
      { skeleton: {}, constraints: [{ type: 'path', name: 'p', spacingMode: 'length', spacing: 100 }] },
      0.5,
    );
    expect(len.constraints[0].spacing).toBe(50);
    const fix = bake({ skeleton: {}, constraints: [{ type: 'path', name: 'p', spacingMode: 'fixed', spacing: 100 }] }, 0.5);
    expect(fix.constraints[0].spacing).toBe(50);
    const prop = bake(
      { skeleton: {}, constraints: [{ type: 'path', name: 'p', spacingMode: 'proportional', spacing: 100 }] },
      0.5,
    );
    expect(prop.constraints[0].spacing).toBe(100); // proportional NOT scaled
  });

  it('mode comparison is case-insensitive (Fixed / FIXED / fixed all gate the same)', () => {
    for (const mode of ['Fixed', 'FIXED', 'fixed']) {
      const out = bake(
        { skeleton: {}, constraints: [{ type: 'path', name: 'p', positionMode: mode, position: 100 }] },
        0.5,
      );
      expect(out.constraints[0].position, `positionMode=${mode}`).toBe(50);
    }
  });
});
