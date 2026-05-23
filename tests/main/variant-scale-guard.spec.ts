/**
 * Phase 49 Plan 01 — V5 (EXPORT-01, D-08) scale-direction guard.
 *
 * The variant export EDGE accepts 0 < s < 1 and rejects s >= 1 (and NaN / <= 0)
 * with the typed VariantScaleError message; s = 0.5 PROCEEDS. Core bake() stays
 * direction-agnostic (Phase-48 D-09 preserved — bake(json, 1.0) still SUCCEEDS):
 * the guard is edge-only, never inside src/core/scale-bake.ts.
 *
 * Imports handleExportVariant (Task 3) — this file is RED until Task 3 wires the
 * handler; that intermediate red is the documented TDD ordering, NOT a regression.
 *
 * handleExportVariant does NOT import electron, so this runs without a vi.mock
 * (mirrors tests/main/summary.spec.ts's real-fixture build). The vitest setup
 * registers the ESM adapter resolver so loadSkeleton works under the harness.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
import { bake } from '../../src/core/scale-bake.js';
import { handleExportVariant } from '../../src/main/variant-export.js';
import { VariantScaleError } from '../../src/core/errors.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const GUARD_MESSAGE_FRAGMENT = 'Variants are scaled-down only';

// fakeEvt — the sendProgress closure tolerates a no-op sender (ipc.ts:901-906).
const fakeEvt = { sender: { send: () => {} } };
const defaultAtlasOpts = { maxPageSize: 4096 as const, allowRotation: false, padding: 2 };

function buildFixtureSummary(): SkeletonSummary {
  const load = loadSkeleton(FIXTURE);
  const sampled = sampleSkeleton(load);
  return buildSummary(load, sampled, 0);
}

describe('handleExportVariant — D-08 scale-direction guard (V5)', () => {
  let summary: SkeletonSummary;
  beforeAll(() => {
    summary = buildFixtureSummary();
  });

  for (const badScale of [1.0, 2.0, 0, NaN, -0.5]) {
    it(`rejects s = ${badScale} with the VariantScaleError message`, async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-guard-'));
      try {
        const res = await handleExportVariant(
          fakeEvt,
          summary,
          badScale,
          tmpDir,
          false,
          false,
          'loose',
          defaultAtlasOpts,
        );
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error.message).toContain(GUARD_MESSAGE_FRAGMENT);
        }
        // The reference message must match the typed error exactly.
        expect(new VariantScaleError(badScale).message).toContain(GUARD_MESSAGE_FRAGMENT);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  }

  it('s = 0.5 PROCEEDS (does not return the guard error)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-guard-ok-'));
    try {
      const res = await handleExportVariant(
        fakeEvt,
        summary,
        0.5,
        tmpDir,
        false,
        false,
        'loose',
        defaultAtlasOpts,
      );
      // Either it succeeded (ok:true) OR it failed for a NON-guard reason —
      // the one thing it must NOT be is the scale-direction rejection.
      if (!res.ok) {
        expect(res.error.message).not.toContain(GUARD_MESSAGE_FRAGMENT);
      } else {
        expect(res.ok).toBe(true);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('core bake() stays direction-agnostic — bake(json, 1.0) does NOT throw (D-09 preserved)', () => {
    const minimal = { skeleton: {}, bones: [{ name: 'root' }] };
    expect(() => bake(minimal, 1.0)).not.toThrow();
    expect(() => bake(minimal, 2.0)).not.toThrow();
  });
});

describe('handleExportVariant — WR-01 degenerate folder-token guard', () => {
  let summary: SkeletonSummary;
  beforeAll(() => {
    summary = buildFixtureSummary();
  });

  // Both scales pass the 0 < s < 1 D-08 guard but round (4dp) to a degenerate
  // folder token: 0.99999 → "1", 0.00001 → "0". The on-disk folder name would no
  // longer identify the variant, so the export EDGE must reject them — and leave
  // NO folder behind.
  for (const [badScale, token] of [
    [0.99999, '1'],
    [0.00001, '0'],
  ] as const) {
    it(`rejects s = ${badScale} (rounds to @${token}x) with the degenerate-token message and writes no folder`, async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-wr01-'));
      try {
        const res = await handleExportVariant(
          fakeEvt,
          summary,
          badScale,
          tmpDir,
          false,
          false,
          'loose',
          defaultAtlasOpts,
        );
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error.message).toContain('degenerate folder token');
          expect(res.error.message).toContain(`@${token}x`);
        }
        // No folder was written for the rejected scale (rejected before any I/O).
        expect(fs.readdirSync(tmpDir)).toHaveLength(0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  }
});
