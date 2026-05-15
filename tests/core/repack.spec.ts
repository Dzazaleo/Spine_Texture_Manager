/**
 * Phase 40 REPACK-02 + REPACK-06 — pack-math unit tests.
 *
 * These tests use SYNTHETIC dim arrays only — no spine loader, no sharp,
 * no fixtures. The pack math is purely a function of (regionName, packW,
 * packH) tuples. This keeps the test fast (<1s) and isolates the
 * pack-planning layer from the rest of the pipeline.
 *
 * Determinism contract (REPACK-02): cross-loaderMode parity (REPACK-08)
 * depends on this test passing. If `computeRepack` is non-deterministic,
 * Plan 08's cross-loaderMode SHA256 baseline cannot hold.
 */
import { describe, expect, it } from 'vitest';
import { computeRepack } from '../../src/core/repack.js';
import type { RepackInput, RepackOptions } from '../../src/core/repack.js';

const DEFAULT_OPTS: RepackOptions = {
  maxPageSize: 4096,
  padding: 2,
  allowRotation: false,
};

function makeInput(name: string, w: number, h: number): RepackInput {
  return { regionName: name, packW: w, packH: h };
}

describe('computeRepack — REPACK-02 pack-math invariants', () => {
  it('determinism: identical inputs produce JSON-identical outputs', () => {
    const inputs: RepackInput[] = [
      makeInput('CIRCLE', 400, 400),
      makeInput('SQUARE', 600, 600),
      makeInput('TRIANGLE', 500, 350),
      makeInput('STAR', 250, 250),
    ];
    const r1 = computeRepack(inputs, DEFAULT_OPTS);
    const r2 = computeRepack(inputs, DEFAULT_OPTS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('determinism is stable across input-array shuffling (regionName sort is canonical)', () => {
    const a: RepackInput[] = [
      makeInput('CIRCLE', 400, 400),
      makeInput('SQUARE', 600, 600),
      makeInput('TRIANGLE', 500, 350),
    ];
    const b: RepackInput[] = [
      makeInput('TRIANGLE', 500, 350),
      makeInput('CIRCLE', 400, 400),
      makeInput('SQUARE', 600, 600),
    ];
    const r1 = computeRepack(a, DEFAULT_OPTS);
    const r2 = computeRepack(b, DEFAULT_OPTS);
    // After internal regionName sort, both runs see the same input order.
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('WR-01: sort uses codepoint compare so result is host-locale-invariant', () => {
    // WR-01: localeCompare() without an explicit locale uses the host's
    // default collation; macOS / Windows / Linux defaults can flip case-
    // folding and diacritic order. REPACK-08 SHA256 parity needs the sort
    // to be byte-identical across hosts. Codepoint compare (a<b/a>b) is
    // invariant to LC_ALL / LANG / process.env locale.
    //
    // Test strategy: build inputs whose codepoint order DIFFERS from a
    // common locale-aware order. Lowercase 'a' (U+0061) has a higher
    // codepoint than uppercase 'Z' (U+005A), so codepoint sort yields
    // ['Z_X', 'a_y'] while a common case-insensitive locale collation
    // yields ['a_y', 'Z_X']. Names are short and otherwise unique so the
    // pack layout is fully deterministic.
    const inputs: RepackInput[] = [
      makeInput('a_lower', 200, 200),
      makeInput('Z_upper', 200, 200),
      makeInput('B_upper', 200, 200),
    ];
    const r = computeRepack(inputs, DEFAULT_OPTS);
    // Read back order by tracing pack output. With codepoint sort the
    // first-packed region is `B_upper` (U+0042), then `Z_upper` (U+005A),
    // then `a_lower` (U+0061). With case-insensitive locale collation we'd
    // see [`a_lower`, `B_upper`, `Z_upper`] — DIFFERENT byte ordering.
    const namesInPackOrder = r.regions.map((x) => x.regionName);
    expect(
      namesInPackOrder,
      'codepoint sort produces uppercase-first ordering; locale collation would interleave',
    ).toEqual(['B_upper', 'Z_upper', 'a_lower']);

    // Re-run with a different input array order; pack layout must be
    // identical (the internal sort canonicalizes input order regardless of
    // host locale).
    const shuffled: RepackInput[] = [
      makeInput('Z_upper', 200, 200),
      makeInput('a_lower', 200, 200),
      makeInput('B_upper', 200, 200),
    ];
    const r2 = computeRepack(shuffled, DEFAULT_OPTS);
    expect(JSON.stringify(r)).toBe(JSON.stringify(r2));
  });

  it('preserves count: regions.length + oversize.length === inputs.length', () => {
    const inputs: RepackInput[] = [
      makeInput('A', 400, 400),
      makeInput('B', 500, 500),
      makeInput('C', 300, 300),
      makeInput('OVERSIZE', 5000, 5000), // larger than 4096 cap
    ];
    const r = computeRepack(inputs, DEFAULT_OPTS);
    expect(r.regions.length + r.oversize.length).toBe(inputs.length);
  });

  it('within bounds: every region fits inside its assigned page', () => {
    const inputs: RepackInput[] = [
      makeInput('A', 800, 800),
      makeInput('B', 700, 700),
      makeInput('C', 600, 600),
      makeInput('D', 500, 500),
    ];
    const r = computeRepack(inputs, DEFAULT_OPTS);
    for (const region of r.regions) {
      const page = r.pages.find((p) => p.pageIndex === region.pageIndex);
      expect(page).toBeDefined();
      if (page) {
        expect(region.x + region.w).toBeLessThanOrEqual(page.width);
        expect(region.y + region.h).toBeLessThanOrEqual(page.height);
        expect(region.x).toBeGreaterThanOrEqual(0);
        expect(region.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('oversize pre-flight: regions exceeding maxPageSize land in oversize[] and NOT in regions[]', () => {
    const inputs: RepackInput[] = [
      makeInput('OK', 400, 400),
      makeInput('TOO_WIDE', 5000, 200),
      makeInput('TOO_TALL', 200, 5000),
      makeInput('ALSO_OK', 300, 300),
    ];
    const r = computeRepack(inputs, DEFAULT_OPTS);
    expect(r.oversize).toContain('TOO_WIDE');
    expect(r.oversize).toContain('TOO_TALL');
    expect(r.regions.map((x) => x.regionName)).not.toContain('TOO_WIDE');
    expect(r.regions.map((x) => x.regionName)).not.toContain('TOO_TALL');
    expect(r.regions.map((x) => x.regionName)).toContain('OK');
    expect(r.regions.map((x) => x.regionName)).toContain('ALSO_OK');
  });

  it('page count grows when total region area exceeds maxPageSize²', () => {
    // 8 regions of 900x900 ≈ 6.48M px; 1024² = ~1.05M px. Must spill to multiple pages.
    const opts: RepackOptions = { maxPageSize: 1024, padding: 2, allowRotation: false };
    const inputs: RepackInput[] = Array.from({ length: 8 }, (_, i) =>
      makeInput(`REGION_${i.toString().padStart(2, '0')}`, 900, 900),
    );
    const r = computeRepack(inputs, opts);
    expect(r.pages.length).toBeGreaterThan(1);
    expect(r.oversize).toHaveLength(0);
  });
});

describe('computeRepack — REPACK-06 rotation invariants', () => {
  it('no rotation when allowRotation is false', () => {
    const inputs: RepackInput[] = [
      makeInput('TALL', 200, 900),
      makeInput('WIDE', 900, 200),
      makeInput('SQUARE', 500, 500),
    ];
    const r = computeRepack(inputs, { ...DEFAULT_OPTS, allowRotation: false });
    for (const region of r.regions) {
      expect(region.rotated).toBe(false);
    }
  });

  it('rotation when allowRotation is true: rotated regions report swapped w/h', () => {
    // Constrain to small page + force tall-skinny shapes to encourage rotation.
    const opts: RepackOptions = { maxPageSize: 1024, padding: 2, allowRotation: true };
    const inputs: RepackInput[] = [
      makeInput('SKINNY_A', 200, 900),
      makeInput('SKINNY_B', 200, 900),
      makeInput('SKINNY_C', 200, 900),
      makeInput('SKINNY_D', 200, 900),
    ];
    const r = computeRepack(inputs, opts);
    // With allowRotation:true, the packer MAY rotate at least one region
    // to improve fit. The post-rotation dims are reported AS-IS (swapped):
    // a rotated 200×900 input appears as w=900, h=200 in the region entry.
    const rotated = r.regions.filter((x) => x.rotated);
    if (rotated.length > 0) {
      for (const rot of rotated) {
        expect(rot.w).toBe(900);
        expect(rot.h).toBe(200);
      }
    }
    // (Note: maxrects-packer is free to NOT rotate if the un-rotated
    // layout fits; this test allows for either outcome but locks the
    // swap invariant when rotation DOES happen — RESEARCH §Landmines #3.)
  });
});
