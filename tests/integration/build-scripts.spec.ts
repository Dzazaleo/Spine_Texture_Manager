/**
 * Phase 15 build-config invariants regression spec.
 *
 * Asserts the static (non-runtime) shape of the v1.1.2 release pipeline:
 * - electron-builder.yml `mac.target` has both dmg + zip with arch arm64 (D-01)
 * - package.json `build:*` scripts use bare CLI flags (RESEARCH §A2 — required
 *   for D-01 to take effect; without this, electron-builder produces only .dmg)
 * - .github/workflows/release.yml uploads + publishes the .zip globs (D-05)
 * - All globs are end-anchored — `release/*.zip` (NOT `release/*.zip*`) so
 *   .zip.blockmap is NOT uploaded (RESEARCH §Risk #2; locks 7-asset count)
 * - Action SHA pins preserved (Phase 11 D-22 supply-chain hygiene)
 *
 * Companion to tests/integration/emit-latest-yml.spec.ts which asserts
 * synthesizer-OUTPUT shape; this spec asserts synthesizer-INPUT (build-config)
 * shape. Drift in either layer is caught at test time.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const REPO_ROOT = resolve(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

describe('Phase 15 D-01 — electron-builder.yml mac.target has dmg + zip', () => {
  test('mac.target is an array with both dmg AND zip entries', () => {
    const cfg = yaml.load(read('electron-builder.yml')) as {
      mac: { target: Array<{ target: string; arch: string }> };
    };
    expect(Array.isArray(cfg.mac.target)).toBe(true);
    const targets = cfg.mac.target.map((t) => t.target);
    expect(targets).toContain('dmg');
    expect(targets).toContain('zip');
    expect(targets.length).toBe(2);
  });

  test('all mac.target entries have arch arm64', () => {
    const cfg = yaml.load(read('electron-builder.yml')) as {
      mac: { target: Array<{ target: string; arch: string }> };
    };
    for (const t of cfg.mac.target) {
      expect(t.arch).toBe('arm64');
    }
  });

  test('mac block preserves 12.1-D-10 invariant (extraResources, identity, hardenedRuntime, gatekeeperAssess)', () => {
    const text = read('electron-builder.yml');
    expect(text).toMatch(/identity:\s*'-'/);
    expect(text).toMatch(/hardenedRuntime:\s*false/);
    expect(text).toMatch(/gatekeeperAssess:\s*false/);
    expect(text).toMatch(/extraResources:/);
  });
});

describe('Phase 15 RESEARCH §A2 — package.json build:* scripts drop explicit target args', () => {
  test('build:mac is bare --mac (NOT --mac dmg)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:mac']).not.toMatch(/--mac\s+dmg/);
    expect(pkg.scripts['build:mac']).toMatch(/electron-builder\s+--mac\s+--publish/);
  });

  test('build:win is bare --win (NOT --win nsis)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:win']).not.toMatch(/--win\s+nsis/);
    expect(pkg.scripts['build:win']).toMatch(/electron-builder\s+--win\s+--publish/);
  });

  test('build:linux is bare --linux (NOT --linux AppImage)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:linux']).not.toMatch(/--linux\s+AppImage/);
    expect(pkg.scripts['build:linux']).toMatch(/electron-builder\s+--linux\s+--publish/);
  });

  test('package.json version is 1.1.2', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.version).toBe('1.1.2');
  });
});

describe('Phase 15 D-05 — release.yml CI workflow extends with .zip globs', () => {
  test('build-mac upload-artifact path includes release/*.zip', () => {
    const text = read('.github/workflows/release.yml');
    // Build-mac path block has 3 globs (was 2): release/*.dmg, release/*.zip, release/latest-mac.yml.
    // Use a multiline regex matching the path: | block content.
    expect(text).toMatch(/path:\s*\|[\s\S]*?release\/\*\.dmg[\s\S]*?release\/\*\.zip[\s\S]*?release\/latest-mac\.yml/);
  });

  test('publish job files: includes assets/*.zip', () => {
    const text = read('.github/workflows/release.yml');
    expect(text).toMatch(/files:\s*\|[\s\S]*?assets\/\*\.dmg[\s\S]*?assets\/\*\.zip[\s\S]*?assets\/\*\.exe/);
  });

  test('RISK #2 mitigation — globs are end-anchored (no .zip* trailing asterisk)', () => {
    const text = read('.github/workflows/release.yml');
    // If a future maintainer broadens the glob, .zip.blockmap would be uploaded
    // as an 8th asset, breaking the locked 7-asset count (RESEARCH §Risk #2).
    expect(text).not.toMatch(/release\/\*\.zip\*/);
    expect(text).not.toMatch(/assets\/\*\.zip\*/);
  });

  test('action SHA pins preserved (Phase 11 D-22 supply-chain hygiene)', () => {
    const text = read('.github/workflows/release.yml');
    expect(text).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02');
    expect(text).toContain('softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65');
  });

  test('fail-fast gates preserved (if-no-files-found + fail_on_unmatched_files)', () => {
    const text = read('.github/workflows/release.yml');
    // 3 build jobs each have if-no-files-found: error
    const ifNoFilesMatches = text.match(/if-no-files-found:\s*error/g) ?? [];
    expect(ifNoFilesMatches.length).toBe(3);
    expect(text).toMatch(/fail_on_unmatched_files:\s*true/);
  });
});

describe('Phase 15 D-05 — sibling platforms (win, linux) byte-identical to v1.1.1', () => {
  test('build-win upload-artifact path has only .exe + latest.yml (no .zip)', () => {
    const text = read('.github/workflows/release.yml');
    // Match the build-win section by the artifact name
    const winSection = text.match(/name:\s*installer-win\b[\s\S]*?if-no-files-found/);
    expect(winSection).not.toBeNull();
    if (winSection) {
      expect(winSection[0]).toMatch(/release\/\*\.exe/);
      expect(winSection[0]).toMatch(/release\/latest\.yml/);
      expect(winSection[0]).not.toMatch(/release\/\*\.zip/);
    }
  });

  test('build-linux upload-artifact path has only .AppImage + latest-linux.yml', () => {
    const text = read('.github/workflows/release.yml');
    const linuxSection = text.match(/name:\s*installer-linux\b[\s\S]*?if-no-files-found/);
    expect(linuxSection).not.toBeNull();
    if (linuxSection) {
      expect(linuxSection[0]).toMatch(/release\/\*\.AppImage/);
      expect(linuxSection[0]).toMatch(/release\/latest-linux\.yml/);
      expect(linuxSection[0]).not.toMatch(/release\/\*\.zip/);
    }
  });
});
