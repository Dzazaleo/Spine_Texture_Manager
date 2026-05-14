/**
 * Phase 40 REPACK-03 / D-03a — Shared sharp resize+sharpen helpers.
 *
 * Extracted from src/main/image-worker.ts:89-110 to support BOTH the
 * loose-export path (image-worker.ts) AND the atlas-repack path
 * (repack-worker.ts) without duplication. Same resize kernel + same
 * conditional sharpen body = byte-identical PNG output between the
 * two callers given identical inputs.
 *
 * Two entry points by terminal action:
 *   - resizeToTmpFile: returns the chained sharp pipeline up to
 *     .png({ compressionLevel: 9 }); caller appends .toFile(tmpPath).
 *     This is the loose-export shape (image-worker.ts:616/624).
 *   - resizeToBuffer: returns Promise<Buffer> via .toBuffer(). This is
 *     the atlas-composite input shape (repack-worker.ts Plan 05).
 *
 * Byte-parity invariant (REPACK-01 acceptance, RESEARCH §Landmines #10):
 * resizeToTmpFile MUST produce SHA256-identical PNG output to the
 * pre-extraction applyResizeAndSharpen for the same inputs. The
 * tests/main/image-worker.integration.spec.ts byte-parity test gates
 * this; a regression here breaks the entire phase's primary acceptance.
 */
import sharp from 'sharp';

/**
 * SHARPEN_SIGMA = 0.5 per Phase 28 SHARP-01 / image-worker.ts:72.
 * Empirically tuned for lanczos3 downscale artifact correction.
 */
export const SHARPEN_SIGMA = 0.5;

/**
 * Internal shared chain — both public entries delegate here so the
 * resize+sharpen body lives in ONE place. NOT exported — callers MUST
 * go through resizeToTmpFile or resizeToBuffer to make the terminal
 * action (.toFile vs .toBuffer) explicit at the call site.
 *
 * Sharpen runs only when sharpenEnabled === true AND effectiveScale is
 * finite AND effectiveScale < 1.0 (D-07). Identity (1.0×) and upscale
 * rows skip sharpen entirely. The explicit Number.isFinite gate (WR-02,
 * 2026-05-06) makes the NaN-effectiveScale skip explicit rather than
 * implicit (NaN < 1.0 is `false`, so the original gate happened to skip
 * by accident — defense-in-depth at the decision site).
 *
 * Idempotency guaranteed by shape: the helper applies sharpen at most
 * once per call. Calling .sharpen() twice in a single sharp pipeline is
 * NOT idempotent (compounds the unsharp mask).
 */
function applyResizeAndSharpenChain(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): sharp.Sharp {
  let p = pipeline.resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' });
  if (
    sharpenEnabled
    && Number.isFinite(effectiveScale)
    && effectiveScale < 1.0
  ) {
    p = p.sharpen({ sigma: SHARPEN_SIGMA });
  }
  return p.png({ compressionLevel: 9 });
}

/**
 * Loose-export path: returns the chained sharp.Sharp pipeline up to and
 * including .png({ compressionLevel: 9 }). Caller chains .toFile(tmpPath)
 * to materialize. Used by image-worker.ts at L616 + L624.
 */
export function resizeToTmpFile(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): sharp.Sharp {
  return applyResizeAndSharpenChain(
    pipeline,
    outW,
    outH,
    effectiveScale,
    sharpenEnabled,
  );
}

/**
 * Atlas-composite-input path: materializes the resized + (optionally) sharpened
 * PNG buffer for the per-page sharp composite step. Used by repack-worker.ts
 * (Plan 05).
 *
 * Returns PNG-encoded bytes (NOT raw RGBA). The libvips composite step at
 * Plan 05 will decode this in a fresh sharp() pipeline, which is correct
 * per RESEARCH §"Pipeline fusion landmine" (materialize-then-reload pattern
 * prevents libvips from fusing resize().rotate().composite() in unexpected
 * order — same idiom as image-worker.ts:583-606 for Phase 33 SW + rotated).
 */
export async function resizeToBuffer(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): Promise<Buffer> {
  return applyResizeAndSharpenChain(
    pipeline,
    outW,
    outH,
    effectiveScale,
    sharpenEnabled,
  ).toBuffer();
}
