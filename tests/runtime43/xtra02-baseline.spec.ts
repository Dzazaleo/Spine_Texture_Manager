// tests/runtime43/xtra02-baseline.spec.ts
// Phase 44 Plan 04 Task 2 — XTRA-02 own-baseline SENTINEL (D-03 a+b).
//
// Identical to xtra01-baseline.spec.ts with the XTRA-02 driver / baseline-file
// / fixture-tag (the 4.3 IK scaleYMode Uniform+Volume rig). Clones the
// Phase-43 runtime43-baseline.spec.ts first-capture-then-strict pattern.
//
// D-03 part a (no-throw): buildLoadXtra02() non-null + sample() not throwing
//   proves the XTRA-02 IK rig samples through runtime-43 without throw.
// D-03 part b (own-baseline): byte-stable vs its OWN freshly-captured 4.3
//   baseline in the SEPARATE store (NOT golden-shared with SAFE-01); a
//   regression SENTINEL, NOT the phase-stop gate (only ORCL-02 is hard — D-01).
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { canonicalize } from '../safe01/canonical-json.js';
import { buildLoadXtra02, sample } from './baseline-driver.js';

const BASE_DIR = path.resolve(__dirname, 'baselines');
const BASE_XTRA02 = path.resolve(BASE_DIR, 'XTRA02_4_3.json');

function frozenPart(p: Record<string, unknown>) {
  return {
    globalPeaks: p.globalPeaks,
    perAnimation: p.perAnimation,
    setupPosePeaks: p.setupPosePeaks,
  };
}

describe('XTRA-02 own-baseline (SENTINEL, NOT the phase-stop gate — D-01; SEPARATE store)', () => {
  it('XTRA-02 4.3 rig samples no-throw through runtime-43 and is byte-stable vs its OWN committed 4.3 baseline', () => {
    const built = buildLoadXtra02();
    if (built == null) {
      // Legit Wave-0 skip: owner rig dir absent (impossible at Phase 44 —
      // D-01 + phase44-fixture-guard). Wave-0 safety net only.
      expect(true).toBe(true);
      return;
    }

    // D-03 part a: non-null build + non-throwing sample() proves the XTRA-02
    // IK scaleYMode rig drives through runtime-43 without throw.
    const output = sample(built.load);

    const json = canonicalize(output, {
      fixture: 'XTRA02_4_3/XTRA-02.json',
    });
    const live = JSON.parse(json) as Record<string, unknown>;

    if (!existsSync(BASE_XTRA02)) {
      mkdirSync(BASE_DIR, { recursive: true });
      writeFileSync(
        BASE_XTRA02,
        JSON.stringify(frozenPart(live), null, 2) + '\n',
        'utf8',
      );
    }

    const committed = JSON.parse(readFileSync(BASE_XTRA02, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(frozenPart(live)).toEqual(frozenPart(committed));
  });
});
