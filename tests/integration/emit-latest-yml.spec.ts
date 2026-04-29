/**
 * Phase 12.1 Plan 01 (D-10) — release/latest-*.yml synthesizer integration test.
 *
 * Greenfield. Asserts the schema-correctness contract that
 * scripts/emit-latest-yml.mjs ships:
 *
 *   1. Emitted YAML parses (js-yaml load returns an object).
 *   2. Top-level `version` matches package.json `version`.
 *   3. files[0].url is a non-empty string ending in the platform extension.
 *   4. files[0].sha512 is a base64-shaped string of length ≥ 64
 *      (electron-updater@6.x verifies download integrity against this).
 *   5. files[0].size matches fs.statSync(fixtureInstaller).size exactly.
 *   6. Top-level `path` mirrors files[0].url; top-level `sha512` mirrors
 *      files[0].sha512 (legacy electron-updater <6 fields).
 *   7. `releaseDate` parses as a valid ISO 8601 string.
 *
 * The fixture installer is a programmatically-generated buffer (≥ 1KB of
 * random bytes) written to a temp directory in beforeAll — no checked-in
 * binary. The script is invoked via child_process.execFileSync against the
 * temp directory's release/ subdir; we override REPO_ROOT by spawning the
 * script with cwd set to the temp dir + a sibling temp package.json.
 *
 * No vitest mocking, no jsdom. Pure file-system + content + spawn assertions.
 * Sibling pattern: tests/integration/install-md.spec.ts (file-system over
 * committed artifacts) + tests/main/recent.spec.ts (atomic-write verification).
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import yaml from 'js-yaml';

const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts/emit-latest-yml.mjs');

let tempDir: string;
let fixtureInstallerPath: string;
let fixtureInstallerSize: number;
let fixtureInstallerSha512: string;
let fixtureZipPath: string;
let fixtureZipSha512: string;
let outputYamlPath: string;

beforeAll(() => {
  // Build a self-contained temp project: temp/release/<fixture>.dmg + .zip + temp/package.json.
  tempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-'));
  const releaseDir = join(tempDir, 'release');
  mkdirSync(releaseDir, { recursive: true });

  // 4KB of random bytes — well above the 1KB minimum specified in CONTEXT.md
  // D-10. SHA-512 is computed deterministically from the buffer.
  const fixtureBuf = randomBytes(4096);
  fixtureInstallerPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg');
  writeFileSync(fixtureInstallerPath, fixtureBuf);
  fixtureInstallerSize = statSync(fixtureInstallerPath).size;
  fixtureInstallerSha512 = createHash('sha512').update(fixtureBuf).digest('base64');

  // Phase 15 D-04 — also create a .zip fixture for the dual-installer mac path.
  // After D-03 mac REQUIRES both .dmg + .zip in release/. Independent random
  // buffer keeps the .zip's sha512 distinct from the .dmg's so existing
  // assertions stay strict (fixtureInstallerSha512 still matches the .dmg only;
  // fixtureZipSha512 matches the .zip — used by the legacy top-level mirror
  // assertion that now points at files[0] = the .zip per Phase 15 D-02).
  const fixtureZipBuf = randomBytes(4096);
  fixtureZipPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.zip');
  writeFileSync(fixtureZipPath, fixtureZipBuf);
  fixtureZipSha512 = createHash('sha512').update(fixtureZipBuf).digest('base64');

  // Sibling package.json so the script can read `version` from cwd. Use a
  // distinct version string so accidental cross-pollination from the real
  // repo's package.json shows up in the assertions.
  writeFileSync(
    join(tempDir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
    'utf8',
  );

  outputYamlPath = join(releaseDir, 'latest-mac.yml');

  // Run the synthesizer with EMIT_LATEST_YML_REPO_ROOT_OVERRIDE pointing at
  // tempDir so its REPO_ROOT resolution skips the import.meta.dirname-based
  // walk and uses the temp dir's sibling release/ + package.json.
  execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
    env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: tempDir },
    stdio: 'pipe',
  });
});

afterAll(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('emit-latest-yml.mjs (D-10) — schema correctness', () => {
  test('produces release/latest-mac.yml in the temp release/ dir', () => {
    expect(existsSync(outputYamlPath)).toBe(true);
    expect(statSync(outputYamlPath).size).toBeGreaterThan(0);
  });

  test('emitted YAML parses cleanly', () => {
    const text = readFileSync(outputYamlPath, 'utf8');
    expect(() => yaml.load(text)).not.toThrow();
  });

  test('top-level version matches the temp package.json version', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    expect(doc.version).toBe('9.9.9-test');
  });

  test('files[] is a non-empty array with the .dmg installer entry', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    expect(Array.isArray(doc.files)).toBe(true);
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files.length).toBeGreaterThanOrEqual(1);
    // Phase 15 D-04: find-by-extension shape (forward-compat with future
    // PLATFORM_MAP.mac.extRegexes ordering changes; .dmg is no longer
    // guaranteed at files[0] — see Phase 15 D-02 dual-installer mac case).
    const dmgEntry = files.find((f) => (f.url as string).endsWith('.dmg'));
    // Phase 15 Plan 05 (D-15-LIVE-1): synthesizer must rewrite the spaced local
    // filename to GitHub-canonical dotted form before emitting it as the url field.
    expect(dmgEntry?.url).toBe('Spine.Texture.Manager-9.9.9-arm64.dmg');
  });

  test('files[0].sha512 matches the fixture installer hash exactly (base64)', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    // Phase 15 D-04: find-by-extension shape (.dmg's sha512 lives wherever the
    // .dmg entry sits in files[]; current ordering puts .zip first so the .dmg
    // is at files[1], but assert by url-suffix match for forward-compat).
    const dmgEntry = files.find((f) => (f.url as string).endsWith('.dmg'));
    expect(dmgEntry?.sha512).toBe(fixtureInstallerSha512);
    expect(dmgEntry?.sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
  });

  test('files[0].size matches the fixture installer byte size exactly', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    // Phase 15 D-04: find-by-extension shape (.dmg byte size matches the
    // fixture buffer regardless of files[] ordering).
    const dmgEntry = files.find((f) => (f.url as string).endsWith('.dmg'));
    expect(dmgEntry?.size).toBe(fixtureInstallerSize);
    expect(typeof dmgEntry?.size).toBe('number');
    expect(dmgEntry?.size as number).toBeGreaterThan(0);
  });

  test('legacy top-level path mirrors files[0].url (electron-updater <6 backward compat)', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    // Phase 15 D-02: on mac, files[0] is now the .zip (per PLATFORM_MAP.mac
    // extRegexes ordering); legacy top-level path mirrors files[0] = the .zip.
    // Phase 15 Plan 05 (D-15-LIVE-1): the .zip's url is rewritten to dots by
    // sanitizeAssetUrl(); top-level path inherits that rewrite via files[0].url.
    expect(doc.path).toBe('Spine.Texture.Manager-9.9.9-arm64.zip');
  });

  test('legacy top-level sha512 mirrors files[0].sha512 (electron-updater <6 backward compat)', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    // Phase 15 D-02: legacy top-level sha512 mirrors files[0].sha512 = .zip's hash.
    expect(doc.sha512).toBe(fixtureZipSha512);
  });

  test('releaseDate parses as a valid ISO 8601 timestamp', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    expect(typeof doc.releaseDate).toBe('string');
    const parsed = Date.parse(doc.releaseDate as string);
    expect(Number.isFinite(parsed)).toBe(true);
  });
});

describe('emit-latest-yml.mjs (D-10) — error handling', () => {
  test('exits non-zero when --platform is missing', () => {
    expect(() => {
      execFileSync('node', [SCRIPT_PATH], { stdio: 'pipe' });
    }).toThrow();
  });

  test('exits non-zero when --platform is unknown', () => {
    expect(() => {
      execFileSync('node', [SCRIPT_PATH, '--platform=bogus'], { stdio: 'pipe' });
    }).toThrow();
  });
});

describe('emit-latest-yml.mjs (Phase 15 D-04) — dual-installer mac case', () => {
  let dualTempDir: string;
  let dualOutputYamlPath: string;
  let dualZipSha512: string;
  let dualDmgSha512: string;
  let dualZipSize: number;
  let dualDmgSize: number;

  beforeAll(() => {
    dualTempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-dual-'));
    const releaseDir = join(dualTempDir, 'release');
    mkdirSync(releaseDir, { recursive: true });

    // Two independent random buffers — distinct sha512 confirms files[0] vs files[1] don't collapse.
    const dmgBuf = randomBytes(4096);
    const zipBuf = randomBytes(4096);
    const dmgPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg');
    const zipPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.zip');
    // Phase 15 RESEARCH §A3 regression gate: also write a .zip.blockmap to assert
    // the end-anchored regex `/\.zip$/i` excludes it. Smaller buffer (2048 vs 4096)
    // makes it visually obvious this is NOT the real .zip if a maintainer ever
    // weakens the regex (e.g. drops the `$` anchor).
    const blockmapPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.zip.blockmap');
    writeFileSync(dmgPath, dmgBuf);
    writeFileSync(zipPath, zipBuf);
    writeFileSync(blockmapPath, randomBytes(2048));
    dualDmgSha512 = createHash('sha512').update(dmgBuf).digest('base64');
    dualZipSha512 = createHash('sha512').update(zipBuf).digest('base64');
    dualDmgSize = statSync(dmgPath).size;
    dualZipSize = statSync(zipPath).size;

    writeFileSync(
      join(dualTempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
      'utf8',
    );

    dualOutputYamlPath = join(releaseDir, 'latest-mac.yml');

    execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
      env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: dualTempDir },
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    if (dualTempDir && existsSync(dualTempDir)) rmSync(dualTempDir, { recursive: true, force: true });
  });

  test('files[] has 2 entries with .zip first AND excludes .zip.blockmap', () => {
    const doc = yaml.load(readFileSync(dualOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files.length).toBe(2);
    // Phase 15 Plan 05 (D-15-LIVE-1): every emitted url is GitHub-canonical (dots).
    // Local fixture filenames in release/ keep spaces (electron-builder unchanged);
    // sanitizeAssetUrl() rewrites url field at emit time.
    expect(files[0].url).toBe('Spine.Texture.Manager-9.9.9-arm64.zip');
    expect(files[1].url).toBe('Spine.Texture.Manager-9.9.9-arm64.dmg');
    // Phase 15 RESEARCH §A3 regression gate: the end-anchored regex `/\.zip$/i`
    // must NOT match `.zip.blockmap`. The fixture above writes one; this assertion
    // locks the anchor as a regression gate (a future maintainer dropping the `$`
    // would surface a 3rd entry here and fail the test).
    expect(files.every((f) => !(f.url as string).includes('.blockmap'))).toBe(true);
  });

  test('legacy top-level path + sha512 mirror files[0] (the .zip)', () => {
    const doc = yaml.load(readFileSync(dualOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(doc.path).toBe(files[0].url);
    expect(doc.sha512).toBe(files[0].sha512);
    // Phase 15 Plan 05 (D-15-LIVE-1): legacy path mirrors files[0].url which is
    // already the dotted form post-sanitizeAssetUrl().
    expect(doc.path).toBe('Spine.Texture.Manager-9.9.9-arm64.zip');
  });

  test('both files[] entries have valid base64 sha512 + correct size', () => {
    const doc = yaml.load(readFileSync(dualOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].sha512).toBe(dualZipSha512);
    expect(files[1].sha512).toBe(dualDmgSha512);
    expect(files[0].sha512).not.toBe(files[1].sha512);
    expect(files[0].sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
    expect(files[1].sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
    expect(files[0].size).toBe(dualZipSize);
    expect(files[1].size).toBe(dualDmgSize);
    expect(files[0].size).toBeGreaterThan(0);
    expect(files[1].size).toBeGreaterThan(0);
  });
});

describe('emit-latest-yml.mjs (Phase 15 D-04) — fail-fast when .zip missing on mac', () => {
  test('exits non-zero when release/ has only .dmg and no .zip', () => {
    const onlyDmgDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-onlydmg-'));
    const releaseDir = join(onlyDmgDir, 'release');
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg'), randomBytes(4096));
    writeFileSync(join(onlyDmgDir, 'package.json'), JSON.stringify({ name: 'f', version: '9.9.9' }), 'utf8');
    expect(() => {
      execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
        env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: onlyDmgDir },
        stdio: 'pipe',
      });
    }).toThrow();
    rmSync(onlyDmgDir, { recursive: true, force: true });
  });
});

// =============================================================================
// Phase 15 Plan 05 — files[].url GitHub-canonical name (no spaces;
// UPDFIX-01 hotfix; D-15-LIVE-1 regression guard)
// =============================================================================
//
// Why these tests exist:
//
//   D-15-LIVE-1 surfaced in live UAT 2026-04-29T19:30Z (Test 7, macOS): HTTP 404
//   on Squirrel.Mac swap. Three sides saw three different filenames:
//     - Local filename:        Spine Texture Manager-1.1.2-arm64.zip (SPACES)
//     - GitHub stored name:    Spine.Texture.Manager-1.1.2-arm64.zip (DOTS)
//     - electron-updater req:  Spine-Texture-Manager-1.1.2-arm64.zip (DASHES)
//
//   GitHub Releases auto-renames spaces → dots on upload; electron-updater 6.x
//   sanitizes spaces in url → dashes when constructing the request URL. The
//   synthesizer must emit url in the GitHub-canonical (DOT) form so all three
//   sides agree.
//
//   These assertions guard the synthesizer-output side of the URL contract:
//   every files[].url AND legacy top-level path: emitted by
//   scripts/emit-latest-yml.mjs MUST contain NO literal spaces, on ALL 3
//   platforms (mac dual-installer; win; linux). The test runs on the existing
//   3-OS CI matrix per release.yml — re-introduction of spaces fails CI BEFORE
//   tag push.
//
// Each test below carries the comment:
//   // D-15-LIVE-1 regression guard — do not delete without re-architecting
//   // the URL contract.
// =============================================================================

describe('emit-latest-yml.mjs (Phase 15 Plan 05) — files[].url GitHub-canonical name (no spaces; UPDFIX-01 hotfix; D-15-LIVE-1 regression guard)', () => {
  // -- mac dual-installer fixture (mirrors the Phase 15 D-04 dual-installer
  //    setup; spaced local filenames; new tests assert dotted url emit)
  let macTempDir: string;
  let macOutputYamlPath: string;

  beforeAll(() => {
    macTempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-p15p05-mac-'));
    const releaseDir = join(macTempDir, 'release');
    mkdirSync(releaseDir, { recursive: true });
    // FIXTURE FILENAMES KEEP SPACES — this mirrors what electron-builder
    // produces locally (productName = "Spine Texture Manager"). The test
    // asserts the synthesizer rewrites the spaced filenames to dotted urls.
    writeFileSync(join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg'), randomBytes(4096));
    writeFileSync(join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.zip'), randomBytes(4096));
    writeFileSync(
      join(macTempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
      'utf8',
    );
    macOutputYamlPath = join(releaseDir, 'latest-mac.yml');
    execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
      env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: macTempDir },
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    if (macTempDir && existsSync(macTempDir)) rmSync(macTempDir, { recursive: true, force: true });
  });

  test('mac files[0].url (.zip) is GitHub-canonical dotted form with NO spaces', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    const doc = yaml.load(readFileSync(macOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].url).toBe('Spine.Texture.Manager-9.9.9-arm64.zip');
    expect(files[0].url as string).not.toMatch(/ /);
  });

  test('mac files[1].url (.dmg) is GitHub-canonical dotted form with NO spaces', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    const doc = yaml.load(readFileSync(macOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[1].url).toBe('Spine.Texture.Manager-9.9.9-arm64.dmg');
    expect(files[1].url as string).not.toMatch(/ /);
  });

  test('mac top-level path mirrors files[0].url AND contains no spaces', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    const doc = yaml.load(readFileSync(macOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(doc.path).toBe(files[0].url);
    expect(doc.path as string).not.toMatch(/ /);
    expect(doc.path).toBe('Spine.Texture.Manager-9.9.9-arm64.zip');
  });

  // -- win fixture (single-installer; spaced local filename; dotted url)
  let winTempDir: string;
  let winOutputYamlPath: string;

  beforeAll(() => {
    winTempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-p15p05-win-'));
    const releaseDir = join(winTempDir, 'release');
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(join(releaseDir, 'Spine Texture Manager-9.9.9-x64.exe'), randomBytes(4096));
    writeFileSync(
      join(winTempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
      'utf8',
    );
    winOutputYamlPath = join(releaseDir, 'latest.yml');
    execFileSync('node', [SCRIPT_PATH, '--platform=win'], {
      env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: winTempDir },
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    if (winTempDir && existsSync(winTempDir)) rmSync(winTempDir, { recursive: true, force: true });
  });

  test('win files[0].url (.exe) is GitHub-canonical dotted form with NO spaces', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    const doc = yaml.load(readFileSync(winOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].url).toBe('Spine.Texture.Manager-9.9.9-x64.exe');
    expect(files[0].url as string).not.toMatch(/ /);
    expect(doc.path as string).not.toMatch(/ /);
  });

  // -- linux fixture (single-installer; spaced local filename; dotted url)
  let linuxTempDir: string;
  let linuxOutputYamlPath: string;

  beforeAll(() => {
    linuxTempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-p15p05-linux-'));
    const releaseDir = join(linuxTempDir, 'release');
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(join(releaseDir, 'Spine Texture Manager-9.9.9-x86_64.AppImage'), randomBytes(4096));
    writeFileSync(
      join(linuxTempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
      'utf8',
    );
    linuxOutputYamlPath = join(releaseDir, 'latest-linux.yml');
    execFileSync('node', [SCRIPT_PATH, '--platform=linux'], {
      env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: linuxTempDir },
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    if (linuxTempDir && existsSync(linuxTempDir)) rmSync(linuxTempDir, { recursive: true, force: true });
  });

  test('linux files[0].url (.AppImage) is GitHub-canonical dotted form with NO spaces', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    const doc = yaml.load(readFileSync(linuxOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].url).toBe('Spine.Texture.Manager-9.9.9-x86_64.AppImage');
    expect(files[0].url as string).not.toMatch(/ /);
    expect(doc.path as string).not.toMatch(/ /);
  });

  test('universal regex invariant — every files[].url on every platform matches GitHub-canonical shape', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    //
    // Asserts every emitted files[].url:
    //   1. contains NO literal spaces
    //   2. matches /^[A-Za-z0-9.+/_=-]+\.(zip|dmg|exe|AppImage)$/ — the conservative
    //      character set of every legitimate installer filename across our 3 platforms.
    //
    // Iterates all 3 platforms' parsed YAML to lock the invariant universally.
    const yamlShapeRegex = /^[A-Za-z0-9.+/_=-]+\.(zip|dmg|exe|AppImage)$/;
    const allYamls = [macOutputYamlPath, winOutputYamlPath, linuxOutputYamlPath];
    for (const ymlPath of allYamls) {
      const doc = yaml.load(readFileSync(ymlPath, 'utf8')) as Record<string, unknown>;
      const files = doc.files as Array<Record<string, unknown>>;
      for (const f of files) {
        const url = f.url as string;
        expect(url).not.toMatch(/ /);
        expect(url).toMatch(yamlShapeRegex);
      }
      // top-level path mirrors files[0].url; same invariant.
      expect(doc.path as string).not.toMatch(/ /);
      expect(doc.path as string).toMatch(yamlShapeRegex);
    }
  });

  // -- multi-space negative test fixture (TWO consecutive spaces in source
  //    → TWO consecutive dots in url; deterministic 1:1 substitution NOT
  //    multi-space-collapse)
  let multiSpaceTempDir: string;
  let multiSpaceOutputYamlPath: string;

  beforeAll(() => {
    multiSpaceTempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-p15p05-multi-'));
    const releaseDir = join(multiSpaceTempDir, 'release');
    mkdirSync(releaseDir, { recursive: true });
    // TWO consecutive spaces between each word — locks the deterministic 1:1
    // per-char rewrite. A future maintainer using `.replace(/\s+/g, '.')`
    // (multi-space-collapse) would produce 'Multi.Space.Name-...' and fail this
    // assertion. GitHub's actual rename behavior is per-character.
    writeFileSync(join(releaseDir, 'Multi  Space  Name-9.9.9-arm64.dmg'), randomBytes(4096));
    writeFileSync(join(releaseDir, 'Multi  Space  Name-9.9.9-arm64.zip'), randomBytes(4096));
    writeFileSync(
      join(multiSpaceTempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
      'utf8',
    );
    multiSpaceOutputYamlPath = join(releaseDir, 'latest-mac.yml');
    execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
      env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: multiSpaceTempDir },
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    if (multiSpaceTempDir && existsSync(multiSpaceTempDir)) rmSync(multiSpaceTempDir, { recursive: true, force: true });
  });

  test('multi-space negative test — deterministic 1:1 per-char rewrite (NOT multi-space-collapse)', () => {
    // D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract.
    //
    // Source filename has TWO consecutive spaces between each word; GitHub's
    // actual rename produces TWO consecutive dots (verified empirically against
    // v1.1.2's published assets). A maintainer who uses `.replace(/\s+/g, '.')`
    // (collapsing whitespace) would produce 'Multi.Space.Name-...' (single dots)
    // and diverge from GitHub's behavior — re-introducing the 3-name mismatch class.
    const doc = yaml.load(readFileSync(multiSpaceOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    // .zip first per Phase 15 D-02 ordering
    expect(files[0].url).toBe('Multi..Space..Name-9.9.9-arm64.zip');
    expect(files[1].url).toBe('Multi..Space..Name-9.9.9-arm64.dmg');
    // No spaces preserved anywhere in the rewrite.
    expect(files[0].url as string).not.toMatch(/ /);
    expect(files[1].url as string).not.toMatch(/ /);
    // top-level path mirrors files[0].url
    expect(doc.path).toBe('Multi..Space..Name-9.9.9-arm64.zip');
  });
});
