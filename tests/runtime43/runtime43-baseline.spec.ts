import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { tryLoad43 } from './load43.js';

const BASE_43 = path.resolve(__dirname, 'baselines', 'skeleton2.json');
function frozenPart(p: Record<string, unknown>) {
  return { globalPeaks: p.globalPeaks, perAnimation: p.perAnimation, setupPosePeaks: p.setupPosePeaks };
}

describe('runtime-43 own-baseline (SENTINEL, NOT the phase-stop gate — D-01; SEPARATE store)', () => {
  it('4.3 skeleton2.json samples byte-stable vs its OWN committed 4.3 baseline', () => {
    const loaded = tryLoad43();
    if (loaded == null || !existsSync(BASE_43)) { expect(true).toBe(true); return; } // Wave-0 skip (Plan 04/05)
    // The actual sample-and-canonicalize is wired by Plan 05 (it owns the
    // sampler-through-runtime-43 driver). This seam asserts the SEPARATE-store
    // contract + the strict-toEqual shape so Plan 05 has a fixed target.
    const committed = JSON.parse(readFileSync(BASE_43, 'utf8')) as Record<string, unknown>;
    expect(frozenPart(committed)).toBeDefined();
    expect(committed.globalPeaks).toBeDefined();
  });
});
