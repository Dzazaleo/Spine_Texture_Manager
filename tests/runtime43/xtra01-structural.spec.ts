// tests/runtime43/xtra01-structural.spec.ts
// Phase 44 Plan 04 Task 2 — XTRA-01 STRUCTURAL assertion (D-03 part c).
//
// THE ANTI-GREEN-WASH DEFENSE (Pitfall 6 / T-44-10). The own-baseline
// (xtra01-baseline.spec.ts) alone only proves a weak rig is *stably* weak —
// this spec parses the owner XTRA-01 rig JSON DIRECTLY (no runtime) and
// asserts it genuinely exercises the 4.3 TransformConstraint feature, failing
// LOUD (naming the deficiency, pointing at 42-OWNER-EXPORT-SPEC §4) if the
// owner re-exported a too-weak rig — surfacing it for re-export, never a
// silent pass.
//
// 4.3.0 shape (LIVE-VERIFIED node_modules/@esotericsoftware/spine-core
// SkeletonJson.js:160-247 + TransformConstraintData.d.ts:51-92): the rig's
// transform constraint lives in the TOP-LEVEL `constraints[]` array
// (`type:"transform"`); `constraintMap.properties = { <from>: { offset?, to: {
// <to>: {offset?,max?,scale?} } } }`; `data.localSource`/`data.localTarget`/
// `data.clamp`/`data.additive` are booleans (absent ⇒ false). The constraint
// `mix*` strengths default to 1.0 when absent.
//
// D-03 part c LOCKED invariants (XTRA-01):
//   (1) ≥2 differently-typed `to` target KINDS (distinct `to` keys — e.g. a
//       position target AND a rotate target, NOT 2 of the same kind).
//   (2) ≥1 local AND ≥1 world — FAITHFUL reading pinned in 44-04-PLAN.md
//       (commit f9b7b06): the (localSource, localTarget) set across the rig's
//       transform constraint(s) must contain ≥1 `true` AND ≥1 `false`.
//       `localSource:false` (absent ⇒ false) COUNTS AS the world config;
//       `localTarget:true` COUNTS AS the local config — a SINGLE constraint
//       with `localTarget:true` + `localSource` absent satisfies this. Do NOT
//       demand local→local + world→world or two constraints (that would exceed
//       D-03's locked wording and fail a valid rig).
//   (3) a `mix` ≠ 1.0 (the constraint strength is not the trivial identity).
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

const RIG_DIR = path.resolve(__dirname, '..', '..', 'fixtures/XTRA01_4_3');

function isFileAbsent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

/** Resolve the single `.json` in the owner rig dir by directory scan (the
 *  owner filename is Claude's-Discretion; only the dir name is locked). Null
 *  ONLY when the dir itself is absent (legit Wave-0 ENOENT skip). A dir that
 *  exists but lacks a `.json` is a malformed rig → throw (loud-over-silent). */
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
      `xtra01-structural: expected exactly one .json in ${RIG_DIR}, found ` +
        `${jsons.length} (${jsons.join(', ')}) — malformed owner rig, NOT a ` +
        'Wave-0 skip (loud-over-silent: a half-exported rig must fail loud).',
    );
  }
  return path.resolve(RIG_DIR, jsons[0]);
}

interface RigJson {
  constraints?: unknown[];
}
interface TransformConstraint {
  type?: string;
  properties?: Record<string, { to?: Record<string, unknown> }>;
  localSource?: boolean;
  localTarget?: boolean;
  [k: string]: unknown;
}

describe('XTRA-01 structural (D-03 part c — anti-green-wash; parses the rig JSON, no runtime)', () => {
  it('the XTRA-01 owner rig genuinely exercises the 4.3 TransformConstraint feature (≥2 typed targets, ≥1 local + ≥1 world, mix≠1.0)', () => {
    const jsonPath = resolveRigJson();
    if (jsonPath == null) {
      expect(true).toBe(true);
      return;
    } // legit Wave-0 fixture-absence skip

    const rig = JSON.parse(readFileSync(jsonPath, 'utf8')) as RigJson;

    // 4.3.0: constraints live in the TOP-LEVEL `constraints[]` array.
    const constraints = Array.isArray(rig.constraints) ? rig.constraints : [];
    const transforms = constraints.filter(
      (c): c is TransformConstraint =>
        c != null &&
        typeof c === 'object' &&
        (c as TransformConstraint).type === 'transform',
    );
    expect(
      transforms.length,
      'XTRA-01 rig too weak: no `type:"transform"` constraint found in the ' +
        'top-level `constraints[]` array — re-export a 4.3 rig with a ' +
        'TransformConstraint per 42-OWNER-EXPORT-SPEC §4.',
    ).toBeGreaterThanOrEqual(1);

    // (1) ≥2 differently-typed `to` target KINDS across the constraint(s).
    const toKinds = new Set<string>();
    for (const tc of transforms) {
      const props = tc.properties ?? {};
      for (const from of Object.keys(props)) {
        const to = props[from]?.to ?? {};
        for (const toKey of Object.keys(to)) toKinds.add(toKey);
      }
    }
    expect(
      toKinds.size,
      `XTRA-01 rig too weak: only ${toKinds.size} distinct \`to\` target ` +
        `kind(s) ({${[...toKinds].join(', ')}}) — need ≥2 differently-typed ` +
        `targets (e.g. a position AND a rotate target) per ` +
        `42-OWNER-EXPORT-SPEC §4. Re-export a richer rig.`,
    ).toBeGreaterThanOrEqual(2);

    // (2) ≥1 local AND ≥1 world — the FAITHFUL D-03 reading (pinned f9b7b06):
    // the (localSource, localTarget) set must contain ≥1 `true` AND ≥1
    // `false`. localSource/localTarget absent ⇒ false. A single constraint
    // with localTarget:true + localSource absent (=false) satisfies this.
    const localWorldFlags = new Set<boolean>();
    for (const tc of transforms) {
      localWorldFlags.add(tc.localSource === true); // absent ⇒ false (world)
      localWorldFlags.add(tc.localTarget === true); // localTarget:true ⇒ local
    }
    expect(
      localWorldFlags.has(true),
      'XTRA-01 rig too weak: no local configuration ' +
        '(no `localSource:true` and no `localTarget:true` across the ' +
        'transform constraint(s)) — need ≥1 local per D-03. Re-export with ' +
        'a local source or local target per 42-OWNER-EXPORT-SPEC §4.',
    ).toBe(true);
    expect(
      localWorldFlags.has(false),
      'XTRA-01 rig too weak: no world configuration ' +
        '(both localSource and localTarget are true everywhere) — need ≥1 ' +
        'world per D-03. Re-export with a world source/target per ' +
        '42-OWNER-EXPORT-SPEC §4.',
    ).toBe(true);

    // (3) a `mix` ≠ 1.0 — the constraint strength is not the trivial identity.
    // 4.3 serializes per-property mixes (mixRotate / mixX / mixY /
    // mixScaleX / mixScaleY / mixShearY) and/or a `mix`; absent ⇒ 1.0.
    const MIX_KEYS = [
      'mix',
      'mixRotate',
      'mixX',
      'mixY',
      'mixScaleX',
      'mixScaleY',
      'mixShearY',
    ] as const;
    const declaredMixes: number[] = [];
    for (const tc of transforms) {
      for (const mk of MIX_KEYS) {
        const v = tc[mk];
        if (typeof v === 'number') declaredMixes.push(v);
      }
    }
    expect(
      declaredMixes.some((m) => m !== 1.0),
      `XTRA-01 rig too weak: no declared mix ≠ 1.0 (declared mixes: ` +
        `[${declaredMixes.join(', ') || 'none'}]) — the constraint must ` +
        `apply a non-identity strength per D-03 / 42-OWNER-EXPORT-SPEC §4. ` +
        `Re-export with a mix strictly between 0 and 1 (or otherwise ≠ 1.0).`,
    ).toBe(true);
  });
});
