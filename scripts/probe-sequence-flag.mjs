#!/usr/bin/env node
/**
 * Verification probe for debug-fix sequence-peak-atlas-vs-less REOPENED 2026-05-09.
 * Confirms `isSequenceFrame` flows from sampler → analyzer → DisplayRow / RegionRow
 * for both atlas-source and atlas-less modes, and that non-sequence rows do
 * NOT carry the flag.
 */
import * as path from 'node:path';
import { loadSkeleton } from '../src/core/loader.ts';
import { sampleSkeleton, DEFAULT_SAMPLING_HZ } from '../src/core/sampler.ts';
import { analyze, analyzeRegions } from '../src/core/analyzer.ts';

const fixture = path.resolve('fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json');

async function dump(label, opts) {
  const load = await loadSkeleton(fixture, opts);
  const out = sampleSkeleton(load, { samplingHz: DEFAULT_SAMPLING_HZ });
  const rows = analyze(out.globalPeaks, load.sourcePaths, load.atlasSources, load.canonicalDimsByRegion, load.actualDimsByRegion);
  const regions = analyzeRegions(out.globalPeaks, load.sourcePaths, load.atlasSources, load.canonicalDimsByRegion, load.actualDimsByRegion);
  console.log(`\n=== ${label} ===`);
  const targetNames = ['PARTICLES_1/00','PARTICLES_1/01','PARTICLES_1/02','PARTICLES_1/03','PARTICLES_1/04','NECK','HEAD_TOP','HEADBAND'];

  console.log('DisplayRow rows:');
  for (const r of rows.filter((r) => targetNames.includes(r.attachmentName)).sort((a, b) => a.attachmentName.localeCompare(b.attachmentName))) {
    console.log(`  ${r.attachmentName.padEnd(20)} mismatch=${r.dimsMismatch} isSequenceFrame=${r.isSequenceFrame ?? false}`);
  }

  console.log('RegionRow rows:');
  for (const r of regions.filter((r) => targetNames.includes(r.regionName)).sort((a, b) => a.regionName.localeCompare(b.regionName))) {
    console.log(`  ${r.regionName.padEnd(20)} mismatch=${r.dimsMismatch} isSequenceFrame=${r.isSequenceFrame ?? false}`);
  }
}

async function main() {
  await dump('Atlas-source mode (auto)', {});
  await dump('Atlas-less mode', { loaderMode: 'atlas-less' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
