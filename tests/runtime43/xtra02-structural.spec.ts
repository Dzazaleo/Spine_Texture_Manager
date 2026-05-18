// tests/runtime43/xtra02-structural.spec.ts
// Phase 44 Plan 04 Task 2 — XTRA-02 STRUCTURAL assertion (D-03 part c).
//
// THE ANTI-GREEN-WASH DEFENSE (Pitfall 6 / T-44-10) for the 4.3 IK
// `scaleYMode` feature. Parses the owner XTRA-02 rig JSON DIRECTLY (no
// runtime) and asserts the rig exercises BOTH non-None scale-Y modes
// (Uniform AND Volume), failing LOUD (naming the deficiency, pointing at
// 42-OWNER-EXPORT-SPEC §5) if the owner re-exported a too-weak rig.
//
// 4.3.0 shape (LIVE-VERIFIED node_modules/@esotericsoftware/spine-core
// SkeletonJson.js:148-150 + Utils.js:336-338 + IkConstraintData.js:64-72):
//   const scaleY = getValue(constraintMap, "scaleY", null);
//   if (scaleY != null) data.scaleYMode = Utils.enumValue(ScaleYMode, scaleY);
//   Utils.enumValue(type, name) => type[name[0].toUpperCase()+name.slice(1)]
//   ScaleYMode { None=0, Uniform=1, Volume=2 } ; absent ⇒ None.
// The JSON key is "scaleY" (a STRING enum value). The pinned 4.3.0 parser
// normalizes it by upper-casing the FIRST letter only (so "uniform" →
// "Uniform" → ScaleYMode.Uniform). This spec applies the SAME normalization
// rule (faithful to the runtime parser — NOT a raw case-sensitive literal
// match, which would over-strict a valid rig; NOT a loose substring, which
// would green-wash). The XTRA-02 owner rig serializes lowercase
// "scaleY":"uniform" / "scaleY":"volume" (auditable in
// fixtures/XTRA02_4_3/NOTES.md — a documented D-15 minimal fixture-prep).
//
// D-03 part c LOCKED invariant (XTRA-02): the resolved scaleYMode across the
// rig's IK constraints contains BOTH `Uniform` AND `Volume`.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

const RIG_DIR = path.resolve(__dirname, '..', '..', 'fixtures/XTRA02_4_3');

function isFileAbsent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

function resolveRigJson(): string | null {
  let entries: string[];
  try {
    entries = readdirSync(RIG_DIR);
  } catch (err) {
    if (isFileAbsent(err)) return null; // legit Wave-0: owner rig dir absent
    throw err;
  }
  const jsons = entries.filter((f) => f.toLowerCase().endsWith('.json'));
  if (jsons.length === 0) return null; // empty dir → Wave-0
  if (jsons.length !== 1) {
    throw new Error(
      `xtra02-structural: expected exactly one .json in ${RIG_DIR}, found ` +
        `${jsons.length} (${jsons.join(', ')}) — malformed owner rig, NOT a ` +
        'Wave-0 skip (loud-over-silent: a half-exported rig must fail loud).',
    );
  }
  return path.resolve(RIG_DIR, jsons[0]);
}

/** Replicate Utils.enumValue's normalization (4.3.0 Utils.js:336-338):
 *  upper-case the FIRST letter only, leave the rest. "uniform"→"Uniform". */
function normalizeScaleYMode(raw: string): string {
  if (raw.length === 0) return raw;
  return raw[0].toUpperCase() + raw.slice(1);
}

interface RigJson {
  constraints?: unknown[];
}
interface IkConstraint {
  type?: string;
  scaleY?: unknown;
  [k: string]: unknown;
}

describe('XTRA-02 structural (D-03 part c — anti-green-wash; parses the rig JSON, no runtime)', () => {
  it('the XTRA-02 owner rig genuinely exercises 4.3 IK scaleYMode in BOTH Uniform AND Volume', () => {
    const jsonPath = resolveRigJson();
    if (jsonPath == null) {
      expect(true).toBe(true);
      return;
    } // legit Wave-0 fixture-absence skip

    const rig = JSON.parse(readFileSync(jsonPath, 'utf8')) as RigJson;

    // 4.3.0: constraints live in the TOP-LEVEL `constraints[]` array.
    const constraints = Array.isArray(rig.constraints) ? rig.constraints : [];
    const iks = constraints.filter(
      (c): c is IkConstraint =>
        c != null &&
        typeof c === 'object' &&
        (c as IkConstraint).type === 'ik',
    );
    expect(
      iks.length,
      'XTRA-02 rig too weak: no `type:"ik"` constraint found in the ' +
        'top-level `constraints[]` array — re-export a 4.3 rig with IK ' +
        'constraints per 42-OWNER-EXPORT-SPEC §5.',
    ).toBeGreaterThanOrEqual(2);

    // Resolve the scaleY enum value per IK constraint, normalized by the
    // pinned 4.3.0 parser's exact rule (Utils.enumValue). Absent ⇒ None.
    const modes = new Set<string>();
    for (const ik of iks) {
      const raw = ik.scaleY;
      if (typeof raw === 'string' && raw.length > 0) {
        modes.add(normalizeScaleYMode(raw));
      } else {
        modes.add('None'); // absent ⇒ ScaleYMode.None (4.3.0 default)
      }
    }

    expect(
      modes.has('Uniform'),
      `XTRA-02 rig too weak: scaleY modes found = {${[...modes].join(', ')}}; ` +
        `'Uniform' is MISSING — need BOTH Uniform AND Volume. Re-export per ` +
        `42-OWNER-EXPORT-SPEC §5 (set one IK constraint's scale-Y mode to ` +
        `Uniform).`,
    ).toBe(true);
    expect(
      modes.has('Volume'),
      `XTRA-02 rig too weak: scaleY modes found = {${[...modes].join(', ')}}; ` +
        `'Volume' is MISSING — need BOTH Uniform AND Volume. Re-export per ` +
        `42-OWNER-EXPORT-SPEC §5 (set one IK constraint's scale-Y mode to ` +
        `Volume).`,
    ).toBe(true);
  });
});
