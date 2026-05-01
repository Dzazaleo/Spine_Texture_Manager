/**
 * Phase 21 Plan 01 — Tests for `src/core/png-header.ts`.
 *
 * Behavior gates pulled from RESEARCH.md INV-1, INV-2:
 *   - INV-1: Reads valid PNG IHDR width/height correctly (4 fixture PNGs).
 *   - INV-2: Throws PngHeaderParseError on: empty file, non-PNG signature,
 *     non-IHDR first chunk, zero-size IHDR.
 *
 * Fixture dims discovered via `sips -g pixelWidth -g pixelHeight` against
 * fixtures/EXPORT_PROJECT/images/*.png on macOS (2026-05-01):
 *   - CIRCLE.png   : 699 × 699
 *   - SQUARE.png   : 1000 × 1000
 *   - TRIANGLE.png : 833 × 759
 *   - SQUARE2.png  : 250 × 250
 * These are hardcoded golden values — do NOT compute at test time.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readPngDims, PngHeaderParseError } from '../../src/core/png-header.js';

const FIXTURE_DIR = path.resolve('fixtures/EXPORT_PROJECT/images');

// PNG signature bytes 0-7 (used to construct negative-path fixtures).
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('readPngDims (LOAD-02 happy path)', () => {
  it('reads IHDR width/height from CIRCLE.png', () => {
    const dims = readPngDims(path.join(FIXTURE_DIR, 'CIRCLE.png'));
    expect(dims.width).toBe(699);
    expect(dims.height).toBe(699);
  });

  it('reads IHDR width/height from SQUARE.png', () => {
    const dims = readPngDims(path.join(FIXTURE_DIR, 'SQUARE.png'));
    expect(dims.width).toBe(1000);
    expect(dims.height).toBe(1000);
  });

  it('reads IHDR width/height from TRIANGLE.png (non-square)', () => {
    const dims = readPngDims(path.join(FIXTURE_DIR, 'TRIANGLE.png'));
    expect(dims.width).toBe(833);
    expect(dims.height).toBe(759);
  });

  it('reads IHDR width/height from SQUARE2.png (small fixture)', () => {
    const dims = readPngDims(path.join(FIXTURE_DIR, 'SQUARE2.png'));
    expect(dims.width).toBe(250);
    expect(dims.height).toBe(250);
  });
});

describe('readPngDims (LOAD-02 negative paths)', () => {
  it('throws PngHeaderParseError on empty file (< 24 bytes)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-png-'));
    const pngPath = path.join(tmpDir, 'empty.png');
    fs.writeFileSync(pngPath, Buffer.alloc(0));
    try {
      let caught: unknown;
      try {
        readPngDims(pngPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(PngHeaderParseError);
      expect((caught as Error).message).toMatch(/(too short|0 bytes)/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws PngHeaderParseError on non-PNG signature (24 bytes of garbage)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-png-'));
    const pngPath = path.join(tmpDir, 'not-a-png.png');
    // 24 bytes of ASCII garbage — bytes 0-7 will not match PNG_SIG.
    fs.writeFileSync(pngPath, Buffer.from('NOT_A_PNG_FILE_BYTES_24X'));
    try {
      let caught: unknown;
      try {
        readPngDims(pngPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(PngHeaderParseError);
      expect((caught as Error).message).toMatch(/signature mismatch/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws PngHeaderParseError when first chunk is not IHDR', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-png-'));
    const pngPath = path.join(tmpDir, 'wrong-chunk.png');
    // Valid PNG signature bytes 0-7, but bytes 12-15 are 'XXXX' instead of 'IHDR'.
    const buf = Buffer.alloc(24);
    PNG_SIG.copy(buf, 0);
    buf.writeUInt32BE(13, 8); // IHDR length
    Buffer.from('XXXX').copy(buf, 12); // chunk type — NOT 'IHDR'
    buf.writeUInt32BE(100, 16); // would-be width
    buf.writeUInt32BE(100, 20); // would-be height
    fs.writeFileSync(pngPath, buf);
    try {
      let caught: unknown;
      try {
        readPngDims(pngPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(PngHeaderParseError);
      expect((caught as Error).message).toMatch(/(not IHDR|first chunk)/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws PngHeaderParseError when IHDR reports zero-size image', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-png-'));
    const pngPath = path.join(tmpDir, 'zero-size.png');
    // Valid PNG signature + IHDR chunk type, but width=0.
    const buf = Buffer.alloc(24);
    PNG_SIG.copy(buf, 0);
    buf.writeUInt32BE(13, 8); // IHDR length
    Buffer.from('IHDR').copy(buf, 12); // chunk type
    buf.writeUInt32BE(0, 16); // width = 0  ← invalid
    buf.writeUInt32BE(100, 20); // height = 100
    fs.writeFileSync(pngPath, buf);
    try {
      let caught: unknown;
      try {
        readPngDims(pngPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(PngHeaderParseError);
      expect((caught as Error).message).toMatch(/zero-size/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
