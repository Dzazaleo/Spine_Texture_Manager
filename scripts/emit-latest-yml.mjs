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
 *
 * Phase 15 D-03 extension (2026-04-29):
 * - mac platform now auto-detects BOTH .dmg AND .zip in release/.
 * - The .zip is required by electron-updater 6.x's MacUpdater for the
 *   Squirrel.Mac swap on Download & Restart (root cause of the
 *   `ZIP file not provided` / `ERR_UPDATER_ZIP_FILE_NOT_FOUND` error
 *   observed live on v1.1.1 macOS clients).
 * - latest-mac.yml emits a 2-entry files[] with .zip first per D-02; the
 *   legacy top-level path/sha512 fields mirror files[0] for older
 *   electron-updater clients (defensive forward-compat).
 * - win + linux platforms remain single-installer single-entry (byte-identical
 *   to v1.1.0 / v1.1.1 feed shape — DIST-* / CI-* / REL-* contracts preserved).
 * - The end-anchored regex `/\.zip$/i` correctly excludes the
 *   `.zip.blockmap` side-effect that electron-builder 26.x produces
 *   unconditionally on mac/zip target (no opt-out flag exists per
 *   app-builder-lib/out/macPackager.js:86).
 * - Phase 15 EXTENDS the 12.1-D-10 publish-race-fix architecture above;
 *   does NOT revert it. The synthesizer remains the single source of feed
 *   emission; electron-builder.yml `publish: null` posture is preserved.
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
  // Phase 15 D-03: mac uses dual-extension match (.zip + .dmg both expected from
  // electron-builder.yml mac.target). .zip is files[0] per D-02 — load-bearing
  // for the legacy top-level `path:` / `sha512:` mirror that older
  // electron-updater clients consume (current 6.x reads files[] by extension
  // match per node_modules/electron-updater/out/MacUpdater.js:77 — array index
  // is cosmetic for download selection but semantically correct here).
  mac:   { extRegexes: [/\.zip$/i, /\.dmg$/i], outName: 'latest-mac.yml'   },
  win:   { extRegex:    /\.exe$/i,             outName: 'latest.yml'       },
  linux: { extRegex:    /\.AppImage$/i,        outName: 'latest-linux.yml' },
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

/**
 * Find the installer files in release/ matching each provided regex.
 *
 * Phase 15 D-03: returns 1 entry for win/linux (single-regex array of length 1)
 * or 2 entries for mac (dual-regex: .zip first, .dmg second per D-02).
 *
 * Fail-fast preserved per kind: missing matches OR multiple matches of the
 * same regex both exit non-zero. mac requires exactly-one .dmg AND
 * exactly-one .zip; missing either fails the build.
 *
 * The .zip regex `/\.zip$/i` is end-anchored and naturally excludes
 * `.zip.blockmap` (electron-builder 26.x produces it as a benign side-effect
 * per RESEARCH §Q3 / §A3 — anchored regex correctly ignores it).
 *
 * @param {RegExp[]} extRegexes - Array of extension regex patterns
 * @returns {string[]} - Installer filenames (in same order as extRegexes input)
 */
function findInstallers(extRegexes) {
  if (!existsSync(RELEASE_DIR)) {
    console.error(`release/ does not exist; did electron-builder run? (cwd=${REPO_ROOT})`);
    process.exit(1);
  }
  const allFiles = readdirSync(RELEASE_DIR);
  const found = [];
  for (const re of extRegexes) {
    const matches = allFiles.filter((name) => re.test(name));
    if (matches.length === 0) {
      console.error(`No installer matching ${re} found in ${RELEASE_DIR}`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`Multiple installers match ${re} in ${RELEASE_DIR}: ${matches.join(', ')}. Pipeline must commit to one installer per kind per platform.`);
      process.exit(1);
    }
    found.push(matches[0]);
  }
  return found;
}

function computeSha512Base64(absPath) {
  const buf = readFileSync(absPath);
  return createHash('sha512').update(buf).digest('base64');
}

/**
 * Rewrite a local installer filename (with spaces) to its GitHub-canonical
 * asset-store form (with dots) — Phase 15 Plan 05 hotfix for D-15-LIVE-1.
 *
 * Why this exists:
 *   electron-builder's `artifactName: ${productName}-${version}-${arch}.${ext}`
 *   substitutes productName="Spine Texture Manager" verbatim (with spaces),
 *   producing local files like `release/Spine Texture Manager-1.1.3-arm64.zip`.
 *   GitHub Releases auto-renames spaces → dots on upload, storing the asset
 *   as `Spine.Texture.Manager-1.1.3-arm64.zip`. electron-updater@6.x reads
 *   the url field from latest-*.yml and constructs a download URL by appending
 *   the url to the Release tag's download base — sanitizing spaces to DASHES
 *   in that construction. So the three sides see THREE different names:
 *     - Local filename:        `Spine Texture Manager-1.1.3-arm64.zip` (SPACES)
 *     - GitHub stored name:    `Spine.Texture.Manager-1.1.3-arm64.zip` (DOTS)
 *     - electron-updater req:  `Spine-Texture-Manager-1.1.3-arm64.zip` (DASHES)
 *   The fix: emit the url field in latest-*.yml as the GitHub-stored DOT form.
 *   electron-updater reads the dot form, builds the download URL from it
 *   verbatim (no further sanitization needed because dots are not whitespace),
 *   and the URL agrees byte-for-byte with the GitHub-stored asset name → 200.
 *
 * Why ONLY space→dot (not multi-space-collapse, not URL encode, not NFD):
 *   GitHub's rename is a deterministic 1:1 substitution per character. Two
 *   consecutive spaces in the source filename produce two consecutive dots
 *   in the stored filename (verified by the multi-space negative test in
 *   tests/integration/emit-latest-yml.spec.ts). Any other transformation
 *   (regex \s+ collapse, encodeURIComponent, normalize 'NFD') would diverge
 *   from GitHub's behavior and re-introduce the 3-name mismatch class.
 *
 * sha512 + size compute path is UNCHANGED — those read bytes from the local
 * file (which still has the spaced name); the hash + byte count are intrinsic
 * to file content, not the asset's stored URL.
 *
 * @param {string} localFilename - Filename as it appears in release/ (may contain spaces)
 * @returns {string} - GitHub-canonical form (spaces replaced with dots; all other chars preserved)
 */
function sanitizeAssetUrl(localFilename) {
  return localFilename.replace(/ /g, '.');
}

function emitYaml(platform) {
  const cfg = PLATFORM_MAP[platform];
  const { outName } = cfg;
  // Phase 15 D-03: normalize single-regex (win/linux) and array-of-regex (mac)
  // into a uniform array. extRegexes wins if present (mac); fall back to wrapped
  // single extRegex (win/linux byte-identical to v1.1.1).
  const extRegexes = cfg.extRegexes ?? [cfg.extRegex];
  const installerNames = findInstallers(extRegexes);

  // Build files[] from N installer entries (N=1 for win/linux; N=2 for mac).
  // Each entry independently hashed + sized; preserves per-file integrity.
  const files = installerNames.map((name) => {
    const p = join(RELEASE_DIR, name);
    return {
      // Phase 15 Plan 05 hotfix (D-15-LIVE-1): emit GitHub-canonical url (dots,
      // not spaces). sha512 + size compute uses the LOCAL filename (read bytes
      // from the spaced file on disk); only the url FIELD is rewritten.
      url: sanitizeAssetUrl(name),
      sha512: computeSha512Base64(p),
      size: statSync(p).size,
    };
  });

  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;

  const doc = {
    version,
    files,
    // Phase 15 D-02: legacy top-level mirror = files[0]. On mac, files[0] is
    // the .zip (per PLATFORM_MAP.mac.extRegexes ordering) — older
    // electron-updater clients that read top-level path/sha512 instead of
    // files[] will download the .zip (the swap medium for Squirrel.Mac).
    path: files[0].url,
    sha512: files[0].sha512,
    releaseDate: new Date().toISOString(),
  };

  const yamlText = yaml.dump(doc, { lineWidth: -1 });
  const outPath = join(RELEASE_DIR, outName);
  const tmpPath = `${outPath}.tmp`;
  writeFileSync(tmpPath, yamlText, 'utf8');
  renameSync(tmpPath, outPath);

  console.log(`emit-latest-yml: wrote ${outPath} (version=${version}, files=${files.length}, files[0].sha512=${files[0].sha512.slice(0, 16)}…)`);
}

const platform = parseArgs(process.argv);
emitYaml(platform);
