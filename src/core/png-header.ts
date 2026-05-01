/**
 * Phase 21 Plan 01 (LOAD-02) — Pure-TS PNG IHDR width/height reader.
 *
 * Reads at most 24 bytes from the file head — no decompression, no IDAT
 * processing, no full-file load. Layer 3 invariant preserved: only node:fs
 * + ./errors.js imports (no `sharp`/libvips/DOM/zlib/streaming buffer libs).
 *
 * CLAUDE.md fact #4 ("the math phase does not decode PNGs") is honored —
 * IHDR byte-parsing is structurally distinct from decoding (which requires
 * zlib decompression of IDAT chunks).
 *
 * PNG spec reference: RFC 2083 / W3C PNG (Second Edition) §5.2-§5.3.
 * IHDR is mandated to be the first chunk in every PNG (§5.6).
 *
 * Phase 22 (SEED-002) consumes this module for canonical-vs-source dim
 * drift detection. Phase 21 Plan 04 consumes it for synthetic-atlas
 * region dim resolution.
 */

import * as fs from 'node:fs';
import { SpineLoaderError } from './errors.js';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export class PngHeaderParseError extends SpineLoaderError {
  constructor(
    public readonly path: string,
    reason: string,
  ) {
    super(`Failed to read PNG header at ${path}: ${reason}`);
    this.name = 'PngHeaderParseError';
  }
}

export interface PngDims {
  width: number;
  height: number;
}

/**
 * Reads PNG width/height from the IHDR chunk via byte parsing only.
 *
 * Throws PngHeaderParseError on:
 *   - file unreadable (ENOENT, EACCES, etc.)
 *   - file shorter than 24 bytes
 *   - PNG signature mismatch (bytes 0-7)
 *   - first chunk type is not 'IHDR' (bytes 12-15)
 *   - IHDR reports zero width or zero height
 *
 * Endianness: PNG is big-endian (network byte order). Uses
 * Buffer.readUInt32BE — the little-endian variant would silently produce
 * garbage on every little-endian host (every modern dev box).
 */
export function readPngDims(pngPath: string): PngDims {
  let buf: Buffer;
  try {
    // Open + read 24 bytes only; do NOT readFileSync the whole file —
    // PNGs in real Spine projects can be hundreds of MB and we only need
    // the head. The 24-byte head read is the structural distinction
    // from "decoding" (CLAUDE.md fact #4).
    const fd = fs.openSync(pngPath, 'r');
    try {
      buf = Buffer.alloc(24);
      const bytesRead = fs.readSync(fd, buf, 0, 24, 0);
      if (bytesRead < 24) {
        throw new PngHeaderParseError(
          pngPath,
          `file too short (read ${bytesRead} bytes, need 24)`,
        );
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    if (err instanceof PngHeaderParseError) throw err;
    throw new PngHeaderParseError(
      pngPath,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Verify PNG signature (bytes 0-7).
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) {
      throw new PngHeaderParseError(pngPath, 'not a PNG file (signature mismatch)');
    }
  }

  // Verify first chunk is IHDR. Bytes 8-11 are length (always 13 for IHDR;
  // we trust the spec invariant rather than re-validating). Bytes 12-15
  // are chunk type — must be ASCII 'IHDR' (0x49 0x48 0x44 0x52).
  if (buf[12] !== 0x49 || buf[13] !== 0x48 || buf[14] !== 0x44 || buf[15] !== 0x52) {
    throw new PngHeaderParseError(pngPath, 'first chunk is not IHDR');
  }

  // Width = big-endian uint32 at offset 16. Height = big-endian uint32 at
  // offset 20. Buffer.readUInt32BE is the right method — the little-endian
  // variant would silently produce garbage on little-endian hosts.
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  if (width === 0 || height === 0) {
    throw new PngHeaderParseError(
      pngPath,
      `IHDR reports zero-size image (${width}x${height})`,
    );
  }

  return { width, height };
}
