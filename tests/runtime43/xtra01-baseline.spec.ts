// tests/runtime43/xtra01-baseline.spec.ts
// Phase 44 Plan 04 Task 2 — XTRA-01 own-baseline SENTINEL (D-03 a+b).
//
// Clones the Phase-43 runtime43-baseline.spec.ts first-capture-then-strict
// pattern VERBATIM (only the driver / baseline-file / fixture-tag differ).
//
// D-03 part a (no-throw): buildLoadXtra01() returning non-null + sample() not
//   throwing proves the XTRA-01 rig samples through runtime-43 without throw,
//   exercising the 4.3 TransformConstraint surface.
// D-03 part b (own-baseline): byte-stable vs its OWN freshly-captured 4.3
//   baseline in the SEPARATE store tests/runtime43/baselines/ (NOT
//   golden-shared with the SAFE-01 corpus). This is a regression SENTINEL,
//   NOT the phase-stop gate — only ORCL-02 is a hard gate (D-01).
// First-capture writes are EXPECTED and the captured baseline is committed
// (D-05; the Phase-43 D-01 pattern).
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { canonicalize } from '../safe01/canonical-json.js';
import { buildLoadXtra01, sample } from './baseline-driver.js';

const BASE_DIR = path.resolve(__dirname, 'baselines');
const BASE_XTRA01 = path.resolve(BASE_DIR, 'XTRA01_4_3.json');

/** The frozen part — identical shape to SAFE-01 / runtime43-baseline
 *  (`_meta` excluded as volatile provenance). SEPARATE store (D-01). */
function frozenPart(p: Record<string, unknown>) {
  return {
    globalPeaks: p.globalPeaks,
    perAnimation: p.perAnimation,
    setupPosePeaks: p.setupPosePeaks,
  };
}

describe('XTRA-01 own-baseline (SENTINEL, NOT the phase-stop gate — D-01; SEPARATE store)', () => {
  it('XTRA-01 4.3 rig samples no-throw through runtime-43 and is byte-stable vs its OWN committed 4.3 baseline', () => {
    const built = buildLoadXtra01();
    if (built == null) {
      // Legit Wave-0 skip: the owner rig directory is genuinely absent. D-01 +
      // phase44-fixture-guard make this impossible at Phase 44 (the rig is
      // committed by 44-01); this arm is the Wave-0 safety net only — NOT a
      // value-mismatch escape hatch (this sentinel is strict on a present rig).
      expect(true).toBe(true);
      return;
    }

    // D-03 part a: a non-null build + a non-throwing sample() is the proof the
    // XTRA-01 TransformConstraint rig drives through runtime-43 without throw.
    const output = sample(built.load);

    const json = canonicalize(output, {
      fixture: 'XTRA01_4_3/XTRA-01.json',
    });
    const live = JSON.parse(json) as Record<string, unknown>;

    if (!existsSync(BASE_XTRA01)) {
      // First capture (D-05 — committed; SEPARATE store, NOT golden-shared
      // with SAFE-01). frozenPart only (`_meta` is volatile provenance).
      mkdirSync(BASE_DIR, { recursive: true });
      writeFileSync(
        BASE_XTRA01,
        JSON.stringify(frozenPart(live), null, 2) + '\n',
        'utf8',
      );
    }

    const committed = JSON.parse(readFileSync(BASE_XTRA01, 'utf8')) as Record<
      string,
      unknown
    >;
    // Strict regression sentinel (NOT the SAFE-02 hard gate — D-01). Any drift
    // shows EXACTLY which `${skin}/${slot}/${attachment}` record moved.
    expect(frozenPart(live)).toEqual(frozenPart(committed));
  });
});
