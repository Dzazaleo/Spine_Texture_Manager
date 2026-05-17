// tests/runtime43/load43.ts
// Phase 43: shared 4.3-load helper. The core loader hard-picks 4.2 (D-02), so
// the 4.3 fixture is loaded directly via pickRuntime('4.3') + the runtime-43
// parse seam — mirrors what runtime43-baseline.spec.ts + safe03 both need.
// ENOENT/throw-tolerant: returns null if runtime-43.ts or the fixture is absent
// (Wave-0 ordering — runtime-43.ts lands in Plan 04, the fixture in Plan 05).
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const FIXTURE_43 = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.json',
);
const ATLAS_43 = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.atlas',
);

export interface Loaded43 {
  rt: import('../../src/core/runtime/runtime.js').SpineRuntime;
  skeletonData: import('../../src/core/runtime/types.js').OpaqueSkeletonData;
}

/** Returns null if runtime-43.ts (Plan 04) or the 4.3 fixture (Plan 05) is not
 *  yet present — callers MUST treat null as "skip this assertion in Wave 0". */
export function tryLoad43(): Loaded43 | null {
  let pickRuntime: typeof import('../../src/core/runtime/runtime.js').pickRuntime;
  try {
    ({ pickRuntime } = require('../../src/core/runtime/runtime.js'));
    const rt = pickRuntime('4.3');           // throws/returns null until Plan 04 lands runtime-43
    if (rt == null) return null;
    const json = JSON.parse(readFileSync(FIXTURE_43, 'utf8'));
    const atlasText = readFileSync(ATLAS_43, 'utf8');
    const atlas = rt.makeAtlas(atlasText);
    const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
    rt.applyRotatedRegionFix(skeletonData);
    return { rt, skeletonData };
  } catch {
    return null;                              // runtime-43 / fixture not present yet
  }
}
