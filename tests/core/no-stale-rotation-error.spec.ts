// Phase 33 Wave 2 active arch-grep guard — ensures no stale references to the
// removed RotatedRegionUnsupportedError class or 'rotated-region-unsupported'
// ExportError kind survive in src/. Pattern mirrors tests/arch.spec.ts:20-33
// (globSync + regex over src/**/*.ts).

import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';

describe('No stale RotatedRegionUnsupportedError reference (Phase 33 lockstep cleanup)', () => {
  it("no src/ file references the identifier 'RotatedRegionUnsupportedError'", () => {
    const files = globSync('src/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/RotatedRegionUnsupportedError/.test(text)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `Files still referencing RotatedRegionUnsupportedError: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it("no src/ file references the ExportError kind 'rotated-region-unsupported'", () => {
    const files = globSync('src/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/'rotated-region-unsupported'/.test(text)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `Files still referencing 'rotated-region-unsupported' ExportError kind: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
