/**
 * Phase 6 Plan 04 Task 2 — Real-bytes integration test for runExport.
 *
 * No mocks. Uses fixtures/EXPORT_PROJECT/images/CIRCLE.png (Plan 06-01)
 * as the source. Verifies sharp + node:fs/promises actually produce the
 * right bytes — the only test in tests/main/ that exercises the live
 * libvips binding end-to-end. Sister file image-worker.spec.ts uses
 * vi.mock for the unit cases (a)-(f); this file complements those by
 * proving the binding works for real.
 *
 * Why a separate file: vitest scopes vi.mock per-file. Putting this
 * test in image-worker.spec.ts would either need vi.doUnmock + dynamic
 * re-import gymnastics OR leak the unmocked bindings into the unit
 * cases. A dedicated file is cleanest (Plan 06-04 Task 2 <action>
 * Option 1, "preferred").
 *
 * Source dims: CIRCLE.png is 699×699 (Plan 06-01 fixture; libvips
 * reports format=png, width=699, height=699). Output dims: 350×350
 * (≈ half — verifies resize actually happened) at effectiveScale 0.5.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-int-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runExport — real-bytes end-to-end (F8.2 + N3.1 + D-121)', () => {
  it('CIRCLE.png 699×699 → 350×350 output is a valid PNG with correct dims', async () => {
    const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    expect(fs.existsSync(sourcePath), `fixture missing: ${sourcePath}`).toBe(true);

    const plan: ExportPlan = {
      rows: [{
        sourcePath,
        outPath: 'images/CIRCLE.png',
        sourceW: 699,
        sourceH: 699,
        outW: 350,
        outH: 350,
        effectiveScale: 0.5,
        attachmentNames: ['CIRCLE'],
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);

    // Summary contract.
    expect(summary.successes).toBe(1);
    expect(summary.errors).toEqual([]);
    expect(summary.cancelled).toBe(false);
    expect(summary.outputDir).toBe(path.resolve(tmpDir));
    expect(summary.durationMs).toBeGreaterThan(0);

    // Progress event contract.
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('success');
    expect(events[0].index).toBe(0);
    expect(events[0].total).toBe(1);
    expect(events[0].outPath).toBe(path.join(tmpDir, 'images', 'CIRCLE.png'));

    // Output file exists + is a valid PNG with correct dims.
    const outPath = path.join(tmpDir, 'images', 'CIRCLE.png');
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(350);
    expect(meta.height).toBe(350);
    // F8.2 + N3.1: alpha preserved through PNG-in → PNG-out.
    expect(meta.hasAlpha).toBe(true);

    // D-121 atomic write: tmp file should NOT remain after rename.
    expect(fs.existsSync(outPath + '.tmp')).toBe(false);
  });
});
