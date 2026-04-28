#!/usr/bin/env node
/**
 * Spine Texture Manager — Phase 12.1 Plan 01 — release/latest-*.yml synthesizer.
 *
 * Invocation:
 *   node scripts/emit-latest-yml.mjs --platform=mac|win|linux
 *
 * Runs AFTER `electron-builder` exits 0 in each `build:{mac,win,linux}` npm
 * script. Reads the platform-appropriate installer from release/, computes
 * SHA-512 + byte size with node:crypto + node:fs.statSync, and writes
 * release/latest-{mac,win,linux}.yml in the schema electron-updater@6.x
 * consumes (modern files[] array + legacy top-level path/sha512 mirror).
 *
 * Why this exists (D-10): electron-builder.yml `publish: null` cleanly
 * suppresses publisher-chain construction (no per-artifact upload race)
 * but ALSO suppresses release/latest-*.yml emission. CI's
 * actions/upload-artifact `if-no-files-found: error` glob requires the
 * file. This script fills that gap with no electron-builder-publisher
 * coupling. See .planning/phases/12.1-…/12.1-CONTEXT.md D-10 +
 * 12.1-01-BLOCKED.md + 12.1-01-BLOCKED-D-09.md for the full lineage.
 *
 * Atomic write: .tmp + fs.renameSync (Pattern-B per CONTEXT.md
 * <code_context> Established Patterns).
 *
 * Test seam: EMIT_LATEST_YML_REPO_ROOT_OVERRIDE (env var).
 *   When set, REPO_ROOT resolves to that path instead of the script's
 *   parent directory. Used by tests/integration/emit-latest-yml.spec.ts
 *   so the test can spawn this script against a temp dir containing a
 *   sibling release/ + package.json without polluting the real repo.
 *   Production builds never set this var.
 *
 * Exit codes:
 *   0 — success (release/latest-{platform}.yml written atomically)
 *   1 — installer missing in release/, OR multiple installers match (force
 *       single-installer commitment), OR SHA-512/size compute failed
 *   2 — bad argv (missing --platform=, unknown platform value)
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

const REPO_ROOT = process.env.EMIT_LATEST_YML_REPO_ROOT_OVERRIDE
  ? resolve(process.env.EMIT_LATEST_YML_REPO_ROOT_OVERRIDE)
  : resolve(import.meta.dirname, '..');
const RELEASE_DIR = join(REPO_ROOT, 'release');

// Platform → (installer extension regex, output YAML filename) map.
// Locked from CONTEXT.md D-10 + electron-builder.yml mac/win/linux blocks.
const PLATFORM_MAP = {
  mac:   { extRegex: /\.dmg$/i,      outName: 'latest-mac.yml'   },
  win:   { extRegex: /\.exe$/i,      outName: 'latest.yml'       },
  linux: { extRegex: /\.AppImage$/i, outName: 'latest-linux.yml' },
};

function parseArgs(argv) {
  const platformArg = argv.find((a) => a.startsWith('--platform='));
  if (!platformArg) {
    console.error('Usage: node scripts/emit-latest-yml.mjs --platform=mac|win|linux');
    process.exit(2);
  }
  const platform = platformArg.slice('--platform='.length);
  if (!(platform in PLATFORM_MAP)) {
    console.error(`Unknown platform "${platform}". Expected: mac, win, linux.`);
    process.exit(2);
  }
  return platform;
}

function findInstaller(extRegex) {
  if (!existsSync(RELEASE_DIR)) {
    console.error(`release/ does not exist; did electron-builder run? (cwd=${REPO_ROOT})`);
    process.exit(1);
  }
  const matches = readdirSync(RELEASE_DIR).filter((name) => extRegex.test(name));
  if (matches.length === 0) {
    console.error(`No installer matching ${extRegex} found in ${RELEASE_DIR}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple installers match ${extRegex} in ${RELEASE_DIR}: ${matches.join(', ')}. Pipeline must commit to one installer per platform.`);
    process.exit(1);
  }
  return matches[0];
}

function computeSha512Base64(absPath) {
  const buf = readFileSync(absPath);
  return createHash('sha512').update(buf).digest('base64');
}

function emitYaml(platform) {
  const { extRegex, outName } = PLATFORM_MAP[platform];
  const installerName = findInstaller(extRegex);
  const installerPath = join(RELEASE_DIR, installerName);

  const sha512 = computeSha512Base64(installerPath);
  const size = statSync(installerPath).size;

  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;

  const doc = {
    version,
    files: [
      { url: installerName, sha512, size },
    ],
    // Legacy top-level mirror — electron-updater@6.x reads files[] first
    // but falls back to top-level for backward compatibility. Emit both.
    path: installerName,
    sha512,
    releaseDate: new Date().toISOString(),
  };

  const yamlText = yaml.dump(doc, { lineWidth: -1 });
  const outPath = join(RELEASE_DIR, outName);
  const tmpPath = `${outPath}.tmp`;
  writeFileSync(tmpPath, yamlText, 'utf8');
  renameSync(tmpPath, outPath);

  console.log(`emit-latest-yml: wrote ${outPath} (version=${version}, size=${size}, sha512=${sha512.slice(0, 16)}…)`);
}

const platform = parseArgs(process.argv);
emitYaml(platform);
