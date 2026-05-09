#!/usr/bin/env node
/**
 * Diagnostic for debug session sequence-peak-atlas-vs-less.
 *
 * The TEST_03 fixture's images/ folder already contains the post-export
 * shrunk PNGs (PARTICLES_1/00.png is 405×396, NECK.png is 78×91, etc.).
 * images_unpacked/ contains the canonical-dim PNGs (PARTICLES_1/00.png is
 * 414×405). So we can run the round-trip directly:
 *   1. Atlas-source mode (uses .atlas, page=4096²).
 *   2. Atlas-less mode pointing at images/  (post-export shrunk PNGs).
 *
 * Print peakScale + displayScale (= outW / actualSourceW) for every
 * PARTICLES_1/* row plus a few non-sequence rows for comparison.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadSkeleton } from '../src/core/loader.ts';
import { sampleSkeleton, DEFAULT_SAMPLING_HZ } from '../src/core/sampler.ts';
import { analyze } from '../src/core/analyzer.ts';

const FIXTURE_DIR = path.resolve(
  'fixtures/MON_FILES/EXPORT/TEST_03/4.2',
);
const FIXTURE_JSON = path.join(FIXTURE_DIR, 'TEST_03.json');

function computeDisplayScale(r) {
  // Mirror computeExportDims (export-view.ts:184-225).
  const peakScale = r.peakScale;
  const canonicalW = r.canonicalW ?? r.sourceW;
  const canonicalH = r.canonicalH ?? r.sourceH;
  const actualSourceW = r.actualSourceW;
  const actualSourceH = r.actualSourceH;
  const dimsMismatch = r.dimsMismatch;
  const sourceRatio =
    dimsMismatch === true && actualSourceW !== undefined && actualSourceH !== undefined
      ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
      : Infinity;
  const downscaleClampedScale = Math.min(peakScale > 0 ? peakScale : 1, 1);
  const effScale = Math.min(downscaleClampedScale, sourceRatio);
  const outW = Math.ceil(canonicalW * effScale);
  const outH = Math.ceil(canonicalH * effScale);
  const sourceWForRatio = actualSourceW ?? canonicalW;
  const displayScale = sourceWForRatio > 0 ? outW / sourceWForRatio : effScale;
  return { effScale, outW, outH, displayScale };
}

function dumpRows(label, rows, names) {
  console.log(`\n=== ${label} ===`);
  const matches = rows.filter((r) =>
    names.some((n) =>
      typeof n === 'string'
        ? r.attachmentName === n
        : n.test(r.attachmentName ?? ''),
    ),
  );
  matches.sort((a, b) => a.attachmentName.localeCompare(b.attachmentName));
  for (const r of matches) {
    const d = computeDisplayScale(r);
    console.log(
      `  ${r.attachmentName.padEnd(20)} ` +
        `peakScale=${r.peakScale?.toFixed(6)} ` +
        `world=${r.worldW?.toFixed(1)}×${r.worldH?.toFixed(1)} ` +
        `source=${r.sourceW}×${r.sourceH} ` +
        `actualSource=${r.actualSourceW}×${r.actualSourceH} ` +
        `canonical=${r.canonicalW}×${r.canonicalH} ` +
        `mismatch=${r.dimsMismatch} ` +
        `outW=${d.outW} outH=${d.outH} ` +
        `displayScale=${d.displayScale.toFixed(4)}`,
    );
  }
}

async function probeMode(label, opts) {
  const load = await loadSkeleton(FIXTURE_JSON, opts);
  const out = sampleSkeleton(load, { samplingHz: DEFAULT_SAMPLING_HZ });
  const rows = analyze(
    out.globalPeaks,
    load.sourcePaths,
    load.atlasSources,
    load.canonicalDimsByRegion,
    load.actualDimsByRegion,
  );
  return { label, load, out, rows };
}

async function main() {
  // Use a stable subset of names: 5 sequence frames + 3 non-sequence comparators.
  const names = [
    'PARTICLES_1/00',
    'PARTICLES_1/01',
    'PARTICLES_1/02',
    'PARTICLES_1/03',
    'PARTICLES_1/04',
    'NECK',
    'HEAD_TOP',
    'HEADBAND',
  ];

  // Atlas-less expects <jsonDir>/images. The fixture's images/ already holds
  // post-export shrunk PNGs (round-trip end-state). To exercise the canonical
  // dims (atlas-less initial load), we'd need the full unshrunk set (which lives
  // in images_unpacked/) but the loader hard-codes 'images' — symlink swap
  // would be invasive. Instead, do two passes:
  //   - Atlas-source: uses .atlas / page PNG (canonical).
  //   - Atlas-less:   uses images/ (already shrunk = round-trip state).
  // The DELTA between them IS the bug.

  const A = await probeMode('Atlas-source mode (real .atlas, canonical)', {});
  dumpRows(A.label, A.rows, names);

  const B = await probeMode('Atlas-less mode (images/ already shrunk = post-export)', {
    loaderMode: 'atlas-less',
  });
  dumpRows(B.label, B.rows, names);

  // Diff
  console.log('\n=== Diff (atlas-source vs atlas-less / post-export) ===');
  const aMap = new Map(A.rows.map((r) => [r.attachmentName, r]));
  const bMap = new Map(B.rows.map((r) => [r.attachmentName, r]));
  for (const n of names) {
    const a = aMap.get(n);
    const b = bMap.get(n);
    if (!a || !b) {
      console.log(`  ${n}: missing in one mode (a=${!!a} b=${!!b})`);
      continue;
    }
    const da = computeDisplayScale(a);
    const db = computeDisplayScale(b);
    console.log(
      `  ${n.padEnd(20)} ` +
        `peakScale a=${a.peakScale?.toFixed(6)} b=${b.peakScale?.toFixed(6)} Δ=${(b.peakScale - a.peakScale).toFixed(6)} | ` +
        `displayScale a=${da.displayScale.toFixed(4)} b=${db.displayScale.toFixed(4)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
