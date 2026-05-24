/**
 * Phase 52 Plan 04 — IN-01 (D-05) cross-boundary token-equivalence lock.
 *
 * ROADMAP SC#4 chose the EQUIVALENCE-TEST route over a shared-helper refactor:
 * the renderer keeps its OWN pure `tokenFor`/`displayFactor`
 * (src/renderer/src/modals/variant-scale-derive.ts — the Layer-3 renderer-local
 * mirror, which must NOT import the Node-only main module) while the main side
 * owns the canonical `formatScaleToken` (src/main/variant-export.ts). This spec
 * is the test that locks the mirror: `tokenFor(x) === formatScaleToken(x)` over a
 * shared sample array (IEEE-754 step artifacts + near-collision pairs + the
 * canonical `0.5 → '0.5'` anchor). It COMPLEMENTS the single-source renderer test
 * at tests/renderer/variant-twoway.spec.ts:68-73 by proving cross-boundary parity.
 *
 * 🚨 PLACEMENT (the renderer-.ts-helper / TS6307 landmine): this spec lives in
 * `tests/main/` (the node program), NOT `tests/renderer/`. The renderer module
 * `variant-scale-derive.ts` is ZERO-import pure math (Number/Math/String,
 * ES2022-clean, no React/DOM), so importing it from an in-program node test
 * typechecks cleanly under `lib: ES2022, types: node` — NO `tsconfig.node.json`
 * exclude is needed. Authoring this as a renderer .ts file would hit the
 * "tests glob" (tsconfig.node.json:12) -> TS6307 and require the exact
 * exclude that variant-twoway.spec.ts already carries (tsconfig.node.json:35).
 * No fixtures, no fs, no electron — pure equivalence assertions.
 */
import { describe, expect, it } from 'vitest';
import { formatScaleToken } from '../../src/main/variant-export.js';
import { tokenFor, displayFactor } from '../../src/renderer/src/modals/variant-scale-derive';

// Shared sample (D-05): MUST include the canonical anchor (0.5 → '0.5'), an
// IEEE-754 floating-step artifact (0.30000000000000004 → '0.3'), near-collision
// pairs (0.5/0.50001, 0.36/0.36001 — each pair collapses to one token), a spread
// of ordinary down-scale factors, and a >4-decimal value to exercise toFixed(4).
const SAMPLE: readonly number[] = [
  0.5, // canonical contract anchor → '0.5'
  0.30000000000000004, // IEEE-754 0.1+0.2 step artifact → '0.3'
  0.50001, // near-collides with 0.5 → '0.5'
  0.36, // ordinary factor → '0.36'
  0.36001, // near-collides with 0.36 → '0.36'
  0.25,
  0.75,
  0.9,
  0.123456, // >4 decimals → toFixed(4) rounds to '0.1235'
];

// Near-collision pairs: each member rounds (toFixed(4)) to the SAME token, and
// BOTH helpers must agree on that collapsed token.
const NEAR_COLLISION_PAIRS: readonly [number, number, string][] = [
  [0.5, 0.50001, '0.5'],
  [0.36, 0.36001, '0.36'],
];

describe('variant token equivalence — tokenFor ≡ formatScaleToken (IN-01 / D-05)', () => {
  it('tokenFor === formatScaleToken across the shared sample (IN-01 / D-05)', () => {
    for (const x of SAMPLE) {
      expect(tokenFor(x), `tokenFor(${x}) must equal formatScaleToken(${x})`).toBe(
        formatScaleToken(x),
      );
    }
  });

  it('the canonical contract anchor holds on both sides (0.5 → "0.5")', () => {
    expect(tokenFor(0.5)).toBe('0.5');
    expect(formatScaleToken(0.5)).toBe('0.5');
    expect(tokenFor(0.5)).toBe(formatScaleToken(0.5));
  });

  it('the IEEE-754 step artifact normalizes identically on both sides (0.30000000000000004 → "0.3")', () => {
    expect(tokenFor(0.30000000000000004)).toBe('0.3');
    expect(formatScaleToken(0.30000000000000004)).toBe('0.3');
    expect(tokenFor(0.30000000000000004)).toBe(formatScaleToken(0.30000000000000004));
  });

  it('near-collision pairs normalize to the same token on both sides', () => {
    for (const [a, b, token] of NEAR_COLLISION_PAIRS) {
      // Each side collapses both members of the pair to the same token …
      expect(tokenFor(a), `tokenFor(${a})`).toBe(token);
      expect(tokenFor(b), `tokenFor(${b})`).toBe(token);
      expect(formatScaleToken(a), `formatScaleToken(${a})`).toBe(token);
      expect(formatScaleToken(b), `formatScaleToken(${b})`).toBe(token);
      // … the two members agree within each helper …
      expect(tokenFor(a)).toBe(tokenFor(b));
      expect(formatScaleToken(a)).toBe(formatScaleToken(b));
      // … and the two helpers agree on the collapsed token.
      expect(tokenFor(a)).toBe(formatScaleToken(a));
      expect(tokenFor(b)).toBe(formatScaleToken(b));
    }
  });

  it('displayFactor stringifies to the same token (renderer numeric mirror)', () => {
    for (const x of SAMPLE) {
      expect(String(displayFactor(x)), `String(displayFactor(${x}))`).toBe(formatScaleToken(x));
    }
  });
});
