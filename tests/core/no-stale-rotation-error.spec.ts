// Phase 33 Wave 1 RED scaffold — skipped placeholders. Bodies filled in by Plan 03
// (lockstep removal commit also un-skips this spec).
//
// After Plan 03 deletes RotatedRegionUnsupportedError from src/core/errors.ts and
// removes the throw site in src/core/loader.ts, this arch-grep guard ensures no
// stale references survived. Pattern mirrors tests/arch.spec.ts:20-33 (globSync +
// regex over src/**/*.ts).

import { describe, it } from 'vitest';

describe.skip('No stale RotatedRegionUnsupportedError reference (Phase 33 lockstep cleanup)', () => {
  it.todo("no src/ file references the identifier 'RotatedRegionUnsupportedError'");
  it.todo("no src/ file references the ExportError kind 'rotated-region-unsupported'");
});
