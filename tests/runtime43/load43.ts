// tests/runtime43/load43.ts
// Phase 43: shared 4.3-load helper. The core loader hard-picks 4.2 (D-02), so
// the 4.3 fixture is loaded directly via pickRuntime('4.3') + the runtime-43
// parse seam — mirrors what runtime43-baseline.spec.ts + safe03 both need.
//
// 43-03 verification-integrity fix (Option A): this helper previously wrapped
// the ENTIRE body (including `pickRuntime('4.3')`) in a single
// `try/catch → return null`. That silently swallowed a BROKEN pickRuntime
// (`require is not defined` under ESM) as if it were a legit Wave-0 skip,
// masking that pickRuntime was non-functional and that all of 43-04's 4.3
// seams were never actually exercised. After Option A the 4.3 path resolves
// under vitest, so we now distinguish:
//   • pickRuntime('4.3') failure (require-missing / resolver-missing / a real
//     runtime-43 defect) → PROPAGATE (must fail loudly — never a silent skip)
//   • the 4.3 fixture genuinely not present yet (Plan 05 owns
//     fixtures/SIMPLE_PROJECT_43/) → return null (legit Wave-0 ENOENT skip)
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { pickRuntime } from '../../src/core/runtime/runtime.js';

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

function isFileAbsent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

/** Returns null ONLY when the 4.3 fixture (Plan 05) is not yet present —
 *  callers MUST treat null as "skip this assertion in Wave 0". A broken
 *  pickRuntime (require-missing / resolver-missing / a runtime-43 defect)
 *  PROPAGATES — it is NOT a legit skip and must fail loudly so a
 *  non-functional 4.3 path can never be silently green. */
export function tryLoad43(): Loaded43 | null {
  // pickRuntime('4.3') must succeed — runtime-43.ts landed in Plan 04 and (under
  // Option A) resolves via the vitest ESM adapter resolver. Any failure here is
  // a genuine defect, NOT a Wave-0 skip: let it propagate (no catch).
  const rt = pickRuntime('4.3');
  if (rt == null) {
    throw new Error(
      "tryLoad43: pickRuntime('4.3') returned null — runtime-43 must be " +
        'resolvable (Plan 04 landed it; Option A wires the ESM resolver). ' +
        'A null here is a verification-integrity failure, not a Wave-0 skip.',
    );
  }

  // The fixture/atlas may legitimately be absent until Plan 05 captures
  // fixtures/SIMPLE_PROJECT_43/. ONLY a file-absent (ENOENT) error is a legit
  // Wave-0 skip → null; any other error (parse defect, runtime-43 bug)
  // propagates.
  let json: unknown;
  let atlasText: string;
  try {
    json = JSON.parse(readFileSync(FIXTURE_43, 'utf8'));
    atlasText = readFileSync(ATLAS_43, 'utf8');
  } catch (err) {
    if (isFileAbsent(err)) return null; // legit Wave-0: Plan 05 owns the fixture
    throw err;
  }

  const atlas = rt.makeAtlas(atlasText);
  const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
  rt.applyRotatedRegionFix(skeletonData);
  return { rt, skeletonData };
}
