// @vitest-environment node
/**
 * Phase 14 Plan 05 — Open Release Page URL-consistency regression gate (UPDFIX-02).
 *
 * The windows-fallback "Open Release Page" CTA depends on byte-for-byte URL
 * agreement across THREE surfaces:
 *
 *   1. src/renderer/src/App.tsx — onOpenReleasePage handler literal passed
 *      to window.api.openExternalUrl().
 *   2. src/main/ipc.ts — entry in SHELL_OPEN_EXTERNAL_ALLOWED Set (exact-string
 *      Set.has gate; mismatch = silently dropped per Phase 12 D-18 contract).
 *   3. src/main/auto-update.ts — GITHUB_RELEASES_INDEX_URL constant pushed in
 *      the `update:available` IPC payload (UpdateDialog reads payload.fullReleaseUrl,
 *      which Plan 14-03 keeps for non-windows-fallback variant — currently the
 *      onOpenReleasePage handler hardcodes the literal directly, but the same
 *      URL must agree).
 *
 * Drift across these 3 surfaces would silently break the Windows-fallback path:
 * the renderer would push a URL the main allow-list rejects, shell.openExternal
 * would never fire, and the user would click "Open Release Page" with no effect.
 * Manual UAT would catch this — but only after a tester filed it.
 *
 * This spec is the proactive regression gate. Mirrors the URL-consistency
 * pattern from tests/integration/install-md.spec.ts (Phase 12 Plan 06).
 *
 * Phase 14 D-12 — re-verified by Plan 14-01 Task 2; this spec is the durable
 * verifier so future refactors cannot inadvertently regress D-12.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Phase 16 D-04 — the new Phase 16 describe block below imports `isReleasesUrl`
// from src/main/ipc.ts. The transitive load chain (`ipc.ts → project-io.ts →
// recent.ts → app.getPath('userData')`) needs an electron stub so the import
// resolves outside an Electron host. Pattern lifted from tests/core/ipc.spec.ts.
// The Phase 14 file-content URL-consistency tests (14-p..s) are unaffected —
// they use readFileSync, not the imported helper.
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
  app: {
    whenReady: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp/userData'),
  },
  shell: { showItemInFolder: vi.fn(), openExternal: vi.fn() },
}));

import { isReleasesUrl } from '../../src/main/ipc.js';

const REPO_ROOT = resolve(__dirname, '..', '..');
const RELEASES_INDEX_URL = 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases';

function readFile(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8');
}

describe('Phase 14 — Open Release Page URL-consistency gate', () => {
  it('(14-p) src/renderer/src/App.tsx contains the openExternalUrl call with the Releases-index URL', () => {
    const appTsx = readFile('src/renderer/src/App.tsx');
    expect(appTsx).toContain(`openExternalUrl('${RELEASES_INDEX_URL}')`);
  });

  it('(14-q) src/main/ipc.ts SHELL_OPEN_EXTERNAL_ALLOWED contains the Releases-index URL (D-12)', () => {
    const ipcTs = readFile('src/main/ipc.ts');
    expect(ipcTs).toContain('SHELL_OPEN_EXTERNAL_ALLOWED');
    expect(ipcTs).toContain(`'${RELEASES_INDEX_URL}'`);
  });

  it('(14-r) src/main/auto-update.ts GITHUB_RELEASES_INDEX_URL constant matches', () => {
    const autoUpdateTs = readFile('src/main/auto-update.ts');
    expect(autoUpdateTs).toContain('GITHUB_RELEASES_INDEX_URL');
    expect(autoUpdateTs).toContain(`'${RELEASES_INDEX_URL}'`);
  });

  it('(14-s) All 3 sites use the EXACT same literal (byte-for-byte) — no trailing slash, no scheme drift', () => {
    // Extract every occurrence of a Releases-index-shaped URL across the 3 files
    // and assert they are all strictly equal. Catches typos like a trailing slash,
    // scheme drift (http vs https), or repo-rename drift.
    const filesToCheck = [
      'src/renderer/src/App.tsx',
      'src/main/ipc.ts',
      'src/main/auto-update.ts',
    ];

    // Match any GitHub URL ending in /releases (with optional trailing slash) that
    // resembles the project's URL. The literal we expect is the canonical form.
    const ghReleasesPattern = /https:\/\/github\.com\/[\w-]+\/Spine_Texture_Manager\/releases\/?/g;

    const occurrences: { file: string; match: string }[] = [];
    for (const f of filesToCheck) {
      const content = readFile(f);
      const matches = content.match(ghReleasesPattern) ?? [];
      for (const m of matches) {
        occurrences.push({ file: f, match: m });
      }
    }

    expect(occurrences.length).toBeGreaterThanOrEqual(3); // at least one in each of the 3 files

    // Every occurrence must equal the canonical literal (no trailing slash variant).
    for (const o of occurrences) {
      expect(o.match).toBe(RELEASES_INDEX_URL);
    }
  });
});

/**
 * Phase 16 D-04 — Allow-list widening regression gate (UPDFIX-05).
 *
 * The shell-open-external trust boundary widens to accept per-release tag URLs
 * of the form `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v{version}`.
 * The widening MUST NOT allow:
 *   - Arbitrary repo paths under the project's URL surface (issues, pulls, wiki).
 *   - Different repos on the same hostname (attacker/Spine_Texture_Manager).
 *   - Hostname-spoofing (`github.com.attacker.com`, `attacker.github.com`).
 *   - Non-https schemes.
 *
 * This spec drives Plan 16-04 Task 2's `isReleasesUrl` helper. The helper does
 * a structural URL.parse + hostname-equals check + pathname-prefix check rather
 * than a naive string-prefix match (which would silently allow URL spoofing).
 *
 * Test approach: import the `isReleasesUrl` helper directly (Plan 16-04 Task 2
 * exports it ONLY for the test surface — `@internal` JSDoc to mark it as not
 * part of the public src/main/ipc.ts API). Each spec asserts the boolean
 * return.
 *
 * NOTE: the actual `import { isReleasesUrl }` lives at the top of this file
 * (alongside the electron `vi.mock`) — vi.mock factories must be hoisted
 * above any module under test, and ESM static imports are hoisted by the
 * runtime. Keeping the import + mock together satisfies the hoist contract.
 */

describe('Phase 16 D-04 — releases-URL structural allow-list widening', () => {
  it('(16-a) the index URL still passes (Phase 12 D-18 backward-compat)', () => {
    expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases')).toBe(true);
  });

  it('(16-b) per-release tag URL with simple semver passes (D-04 happy path)', () => {
    expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(true);
  });

  it('(16-c) per-release tag URL with dotted-prerelease passes (CLAUDE.md release-tag convention)', () => {
    expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0-rc.1')).toBe(true);
  });

  it('(16-d) issues URL on the project repo is REJECTED (path-prefix narrowness)', () => {
    expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/issues')).toBe(false);
  });

  it('(16-e) different-repo /releases URL is REJECTED (path-prefix narrowness)', () => {
    expect(isReleasesUrl('https://github.com/attacker/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(false);
  });

  it('(16-f) hostname-spoofed URL `github.com.attacker.com` is REJECTED (T-16-04 mitigated)', () => {
    expect(isReleasesUrl('https://github.com.attacker.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(false);
  });

  it('(16-g) subdomain-spoofed URL `attacker.github.com` is REJECTED (T-16-04 mitigated)', () => {
    expect(isReleasesUrl('https://attacker.github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0')).toBe(false);
  });

  it('(16-h) non-https scheme is REJECTED (T-16-04 mitigated)', () => {
    expect(isReleasesUrl('http://github.com/Dzazaleo/Spine_Texture_Manager/releases')).toBe(false);
  });

  it('(16-i) malformed URL strings return false (T-16-04 — URL parse failure path)', () => {
    expect(isReleasesUrl('not a url')).toBe(false);
    expect(isReleasesUrl('')).toBe(false);
    expect(isReleasesUrl('javascript:alert(1)')).toBe(false);
  });
});
