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
let outputYamlPath: string;

beforeAll(() => {
  // Build a self-contained temp project: temp/release/<fixture>.dmg + temp/package.json.
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
    expect(files[0].url).toBe('Spine Texture Manager-9.9.9-arm64.dmg');
  });

  test('files[0].sha512 matches the fixture installer hash exactly (base64)', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].sha512).toBe(fixtureInstallerSha512);
    expect(files[0].sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
  });

  test('files[0].size matches the fixture installer byte size exactly', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].size).toBe(fixtureInstallerSize);
    expect(typeof files[0].size).toBe('number');
    expect(files[0].size).toBeGreaterThan(0);
  });

  test('legacy top-level path mirrors files[0].url (electron-updater <6 backward compat)', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    expect(doc.path).toBe('Spine Texture Manager-9.9.9-arm64.dmg');
  });

  test('legacy top-level sha512 mirrors files[0].sha512 (electron-updater <6 backward compat)', () => {
    const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
    expect(doc.sha512).toBe(fixtureInstallerSha512);
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
