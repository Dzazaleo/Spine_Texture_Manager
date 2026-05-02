/**
 * Phase 22 Plan 22-04 Task 2 — Real-bytes integration test for the
 * passthroughCopies branch of runExport.
 *
 * No mocks — real fs.promises.copyFile + real PNG bytes from
 * fixtures/EXPORT_PROJECT/images/CIRCLE.png. Mirrors the analog pattern in
 * tests/main/image-worker.integration.spec.ts (sister real-bytes file for
 * the resize path); proves D-03 byte-copy contract holds end-to-end.
 *
 * Coverage:
 *   1. byte-identical PNG output (Buffer.compare === 0; no Lanczos ran).
 *   2. R4 atomic-write: tmpPath does NOT exist after rename.
 *   3. R8 subfolder support: AVATAR/FACE.png creates AVATAR/ subdir.
 *   4. Mixed plan ordering: passthroughCopies fire FIRST (absolute index
 *      0..N-1), then resize rows (index N..total-1).
 *   5. Cooperative cancel: isCancelled() between passthrough rows breaks
 *      the loop.
 *   6. Error propagation: missing source PNG yields ExportError; subsequent
 *      rows still process.
 *
 * Layer 3 invariant: this is a main-process test (tests/main/) — sharp +
 * fs.promises.copyFile + electron all allowed. The mirror cap formula is
 * tested separately in tests/core/export.spec.ts; this file exercises only
 * the runExport main-process branch for plan.passthroughCopies rows.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-passthrough-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('image-worker — DIMS-04 passthrough byte-copy (Phase 22)', () => {
  it('passthrough row succeeds — summary.successes === 1, no errors', async () => {
    const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    expect(fs.existsSync(sourcePath), `fixture missing: ${sourcePath}`).toBe(true);
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath,
        outPath: 'images/CIRCLE.png',
        sourceW: 699, sourceH: 699,
        outW: 699, outH: 699,
        effectiveScale: 1.0,
        attachmentNames: ['CIRCLE'],
      }],
      totals: { count: 1 },
    };
    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(summary.successes).toBe(1);
    expect(summary.errors).toEqual([]);
    expect(summary.cancelled).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('success');
    expect(events[0].index).toBe(0);
    expect(events[0].total).toBe(1);
  });

  it('byte-identical: Buffer.compare returns 0 (no Lanczos pipeline ran)', async () => {
    const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath,
        outPath: 'images/CIRCLE.png',
        sourceW: 699, sourceH: 699,
        outW: 699, outH: 699,
        effectiveScale: 1.0,
        attachmentNames: ['CIRCLE'],
      }],
      totals: { count: 1 },
    };
    await runExport(plan, tmpDir, () => {}, () => false);
    const sourceBuf = fs.readFileSync(sourcePath);
    const outBuf = fs.readFileSync(path.join(tmpDir, 'images', 'CIRCLE.png'));
    // D-03 contract: passthrough is a pure byte-copy. If sharp.resize had
    // run (re-encoding the PNG even at 1.0× scale), the IDAT chunks would
    // differ. Buffer.compare === 0 proves the file was passed through verbatim.
    expect(Buffer.compare(sourceBuf, outBuf)).toBe(0);
  });

  it('R4 atomic-write: tmpPath does NOT exist after rename', async () => {
    const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath,
        outPath: 'images/CIRCLE.png',
        sourceW: 699, sourceH: 699,
        outW: 699, outH: 699,
        effectiveScale: 1.0,
        attachmentNames: ['CIRCLE'],
      }],
      totals: { count: 1 },
    };
    await runExport(plan, tmpDir, () => {}, () => false);
    const outPath = path.join(tmpDir, 'images', 'CIRCLE.png');
    // R4 macOS delayed-allocation safety: tmp file is renamed to final
    // path; the rename consumes the tmp inode atomically. After completion,
    // only the final file exists.
    expect(fs.existsSync(outPath + '.tmp')).toBe(false);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('R8 subfolder support: passthrough copy of AVATAR/FACE.png creates AVATAR/ subdir', async () => {
    // Construct an out-of-tree source file at <srcDir>/AVATAR/FACE.png so
    // we can prove the worker's mkdir-recursive parent-dir creation handles
    // nested region paths (e.g. mesh attachments under skin namespaces).
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-src-'));
    fs.mkdirSync(path.join(srcDir, 'AVATAR'));
    const sourcePath = path.join(srcDir, 'AVATAR', 'FACE.png');
    fs.copyFileSync(path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png'), sourcePath);
    try {
      const plan: ExportPlan = {
        rows: [],
        excludedUnused: [],
        passthroughCopies: [{
          sourcePath,
          outPath: 'images/AVATAR/FACE.png',
          sourceW: 699, sourceH: 699,
          outW: 699, outH: 699,
          effectiveScale: 1.0,
          attachmentNames: ['AVATAR/FACE'],
        }],
        totals: { count: 1 },
      };
      const summary = await runExport(plan, tmpDir, () => {}, () => false);
      expect(summary.successes).toBe(1);
      expect(summary.errors).toEqual([]);
      const outPath = path.join(tmpDir, 'images', 'AVATAR', 'FACE.png');
      expect(fs.existsSync(outPath)).toBe(true);
      expect(fs.statSync(path.join(tmpDir, 'images', 'AVATAR')).isDirectory()).toBe(true);
      // Byte-identical even through the subfolder copy.
      const sourceBuf = fs.readFileSync(sourcePath);
      const outBuf = fs.readFileSync(outPath);
      expect(Buffer.compare(sourceBuf, outBuf)).toBe(0);
    } finally {
      fs.rmSync(srcDir, { recursive: true, force: true });
    }
  });

  it('mixed plan: passthroughCopies fire FIRST then rows; progress events carry absolute index', async () => {
    const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    const plan: ExportPlan = {
      // Resize row will produce a 350×350 file via Lanczos.
      rows: [{
        sourcePath,
        outPath: 'images/RESIZED.png',
        sourceW: 699, sourceH: 699,
        outW: 350, outH: 350,
        effectiveScale: 0.5,
        attachmentNames: ['RESIZED'],
      }],
      excludedUnused: [],
      // Passthrough row will produce a byte-identical 699×699 copy.
      passthroughCopies: [{
        sourcePath,
        outPath: 'images/PASSTHROUGH.png',
        sourceW: 699, sourceH: 699,
        outW: 699, outH: 699,
        effectiveScale: 1.0,
        attachmentNames: ['PASSTHROUGH'],
      }],
      totals: { count: 2 },
    };
    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(summary.successes).toBe(2);
    expect(summary.errors).toEqual([]);
    const successEvents = events.filter((e) => e.status === 'success');
    expect(successEvents).toHaveLength(2);
    // Per RESEARCH Item #2 Option B: passthrough rows fire FIRST (index 0),
    // resize rows next (index 1..total-1). Single index space across both.
    expect(successEvents[0].index).toBe(0);
    expect(successEvents[0].outPath).toMatch(/PASSTHROUGH\.png$/);
    expect(successEvents[1].index).toBe(1);
    expect(successEvents[1].outPath).toMatch(/RESIZED\.png$/);
    expect(events.every((e) => e.total === 2)).toBe(true);
  });

  it('cooperative cancel: isCancelled() between passthrough rows breaks the loop', async () => {
    const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [
        { sourcePath, outPath: 'images/A.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['A'] },
        { sourcePath, outPath: 'images/B.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['B'] },
        { sourcePath, outPath: 'images/C.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['C'] },
      ],
      totals: { count: 3 },
    };
    let callCount = 0;
    const isCancelled = () => {
      callCount++;
      // Cancel AFTER the first iteration's pre-check has fired (callCount=1
      // returns false, callCount=2+ returns true). First row completes; the
      // second-row pre-check trips cancel.
      return callCount > 1;
    };
    const summary = await runExport(plan, tmpDir, () => {}, isCancelled);
    expect(summary.cancelled).toBe(true);
    expect(summary.successes).toBeLessThan(3);
    // First row should have completed before cancel surfaced.
    expect(summary.successes).toBeGreaterThanOrEqual(1);
  });

  it('missing source PNG yields error; subsequent passthrough rows still process', async () => {
    const realSource = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [
        // Row 0: missing source → error.
        { sourcePath: '/does/not/exist.png', outPath: 'images/MISSING.png', sourceW: 1, sourceH: 1, outW: 1, outH: 1, effectiveScale: 1.0, attachmentNames: ['M'] },
        // Row 1: real source → success (D-116 continuation invariant).
        { sourcePath: realSource, outPath: 'images/REAL.png', sourceW: 699, sourceH: 699, outW: 699, outH: 699, effectiveScale: 1.0, attachmentNames: ['R'] },
      ],
      totals: { count: 2 },
    };
    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors).toHaveLength(1);
    // The missing-source path matches the existing resize-path error
    // discriminator union: 'missing-source' is the established kind for
    // pre-flight access throws (image-worker.ts:161,171).
    expect(summary.errors[0].kind).toBe('missing-source');
    expect(summary.successes).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'images', 'REAL.png'))).toBe(true);
  });
});
