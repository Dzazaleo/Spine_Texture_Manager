#!/usr/bin/env node
/**
 * Phase 40 D-07 — SHA256 baseline refresh for repack regression tests.
 *
 * Regenerates:
 *   - tests/fixtures/repack-baselines.json       (SHA256 sidecar per D-06)
 *   - tests/fixtures/repack-expected/SIMPLE_TEST.atlas (committed expected text)
 *
 * Usage:
 *   npm run repack:refresh-baselines
 *
 * CI invariant: this script does NOT run in CI (D-07). CI stays loud on
 * mismatch. Developer runs locally when intentionally bumping sharp /
 * libvips / maxrects-packer / @esotericsoftware/spine-core.
 *
 * Implementation:
 *   This script delegates to vitest with UPDATE_FIXTURES=1. The vitest
 *   specs (tests/main/repack.loose-parity.spec.ts +
 *   tests/main/repack.parity.spec.ts) read the env flag and, on detection,
 *   write computed SHA256 hex digests to the JSON sidecar AND copy the
 *   produced .atlas text to tests/fixtures/repack-expected/{fixture}.atlas
 *   in-place (instead of asserting). Same code path = no drift between
 *   refresh-script output and in-test refresh output.
 *
 *   Why delegate rather than import the workers directly: image-worker.ts
 *   + repack-worker.ts are TypeScript, only available as compiled JS under
 *   out/main/ after `npm run build`. Vitest already imports the .ts sources
 *   directly via its TS pipeline, so reusing the spec files avoids both a
 *   build dependency AND the risk of the script's logic drifting from the
 *   test assertions. EXPECTED_ATLAS_DIR + the JSON sidecar shape are
 *   documented below for grep-able traceability.
 *
 * Alternative refresh path:
 *   UPDATE_FIXTURES=1 npx vitest run tests/main/repack.loose-parity.spec.ts \
 *     tests/main/repack.parity.spec.ts
 *
 * The script does the same thing as the alternative path, just wrapped in
 * an npm-script entry. Both paths use createHash('sha256') under the hood
 * (see tests/main/repack.loose-parity.spec.ts:sha) and both write to the
 * same baseline JSON + EXPECTED_ATLAS_DIR target — neither runs in CI.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Target paths (documented here for traceability — the specs themselves
// own the write logic; this script merely orchestrates vitest invocation).
const BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'repack-baselines.json');
const EXPECTED_ATLAS_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'repack-expected');

const SPEC_FILES = [
  'tests/main/repack.loose-parity.spec.ts',
  'tests/main/repack.parity.spec.ts',
];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function ensureBaselineDir() {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.mkdirSync(EXPECTED_ATLAS_DIR, { recursive: true });
}

function ensureBaselineFile() {
  if (!fs.existsSync(BASELINE_PATH)) {
    const scaffold = {
      _meta: {
        generatedAt: 'PENDING_FIRST_REFRESH',
        sharpVersion: 'PENDING',
        maxrectsPackerVersion: 'PENDING',
        spineCoreVersion: 'PENDING',
        note: 'Regenerate via `npm run repack:refresh-baselines` or `UPDATE_FIXTURES=1 npx vitest run ...`. Neither runs in CI (D-07).',
      },
      SIMPLE_TEST: { loose: {}, atlas: {} },
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(scaffold, null, 2) + '\n', 'utf8');
  }
}

function bumpMetaVersions() {
  // After the vitest run, refresh _meta with the current dependency
  // versions so the baseline records which sharp / maxrects-packer /
  // spine-core SHAs are pinned. This block uses createHash('sha256')-style
  // determinism by reading package.json files synchronously.
  try {
    const sharpPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'node_modules/sharp/package.json'), 'utf8'),
    );
    const packerPkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'node_modules/maxrects-packer/package.json'), 'utf8'),
    );
    const spinePkg = JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, 'node_modules/@esotericsoftware/spine-core/package.json'),
        'utf8',
      ),
    );
    const current = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    current._meta = {
      generatedAt: new Date().toISOString(),
      sharpVersion: sharpPkg.version,
      maxrectsPackerVersion: packerPkg.version,
      spineCoreVersion: spinePkg.version,
      note: 'Regenerate via `npm run repack:refresh-baselines` or `UPDATE_FIXTURES=1 npx vitest run ...`. Neither runs in CI (D-07).',
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.warn('repack-refresh-baselines: could not bump _meta versions:', err.message);
  }
}

function reportFingerprints() {
  // Print SHA256 digests of the committed expected text + baseline JSON so
  // the developer can verify on the way out. Uses sha256() helper above.
  try {
    const baselineSha = sha256(fs.readFileSync(BASELINE_PATH));
    console.log(`  baseline JSON sha256: ${baselineSha}`);
    const atlasPath = path.join(EXPECTED_ATLAS_DIR, 'SIMPLE_TEST.atlas');
    if (fs.existsSync(atlasPath)) {
      const atlasSha = sha256(fs.readFileSync(atlasPath));
      console.log(`  expected .atlas sha256: ${atlasSha}`);
    }
  } catch (err) {
    console.warn('repack-refresh-baselines: could not report fingerprints:', err.message);
  }
}

function main() {
  console.log('repack-refresh-baselines: regenerating SHA256 baselines...');
  console.log(`  baseline JSON : ${BASELINE_PATH}`);
  console.log(`  expected atlas: ${EXPECTED_ATLAS_DIR}/SIMPLE_TEST.atlas`);

  ensureBaselineDir();
  ensureBaselineFile();

  console.log('  delegating to vitest with UPDATE_FIXTURES=1...');
  const result = spawnSync(
    'npx',
    ['vitest', 'run', ...SPEC_FILES],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, UPDATE_FIXTURES: '1' },
      stdio: 'inherit',
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    console.error('repack-refresh-baselines: vitest run failed (exit code ' + result.status + ')');
    process.exit(result.status ?? 1);
  }

  bumpMetaVersions();
  reportFingerprints();

  console.log('Done. Commit the regenerated files alongside any dep bump that triggered the refresh.');
}

main();
