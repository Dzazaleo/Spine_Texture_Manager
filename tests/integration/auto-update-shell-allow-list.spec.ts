// @vitest-environment node
/**
 * Phase 14 Plan 05 — Open Release Page URL-consistency regression gate (UPDFIX-02).
 *
 * The manual-download "Open Release Page" CTA depends on URL trust-boundary checks
 * (both the legacy index URL byte-for-byte literal AND the Phase 16 D-04 runtime
 * per-release URL must pass through the SHELL_OPEN_EXTERNAL_ALLOWED gate).
 * Original Phase 14 URL agreement contract spans THREE surfaces:
 *
 *   1. src/renderer/src/App.tsx — onOpenReleasePage handler literal passed
 *      to window.api.openExternalUrl().
 *   2. src/main/ipc.ts — entry in SHELL_OPEN_EXTERNAL_ALLOWED Set (exact-string
 *      Set.has gate; mismatch = silently dropped per Phase 12 D-18 contract).
 *   3. src/main/auto-update.ts — GITHUB_RELEASES_INDEX_URL constant pushed in
 *      the `update:available` IPC payload (UpdateDialog reads payload.fullReleaseUrl,
 *      which Plan 14-03 keeps for non-manual-download variant — currently the
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
  it('(14-p) src/renderer/src/App.tsx forwards the runtime updateState.fullReleaseUrl to openExternalUrl (Phase 16 D-04)', () => {
    const appTsx = readFile('src/renderer/src/App.tsx');
    // Phase 16 D-04 — the renderer no longer hardcodes the index URL. The
    // per-release URL templated by deliverUpdateAvailable (src/main/auto-update.ts)
    // flows through the update-available IPC payload to the updateState slot,
    // and onOpenReleasePage forwards updateState.fullReleaseUrl to
    // window.api.openExternalUrl (which routes through src/main/ipc.ts'
    // shell:open-external handler — guarded by isReleasesUrl per Plan 16-04).
    expect(appTsx).toContain('openExternalUrl(updateState.fullReleaseUrl)');
    // Defense-in-depth: the hardcoded RELEASES_INDEX_URL literal MUST NOT
    // re-appear inside an openExternalUrl call in App.tsx (catches a future
    // regression that re-introduces the dead path).
    expect(appTsx).not.toMatch(
      new RegExp(`openExternalUrl\\(\\s*['"\`]${RELEASES_INDEX_URL.replace(/[/.]/g, '\\$&')}['"\`]\\s*\\)`),
    );
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
    // Phase 16 D-04 — App.tsx no longer carries a hardcoded URL literal (the
    // runtime updateState.fullReleaseUrl flows through). The byte-for-byte
    // URL-consistency check now compares only the two main-process files that
    // STILL carry the index URL literal: ipc.ts (allow-list Set entry) and
    // auto-update.ts (GITHUB_RELEASES_INDEX_URL constant — kept for backward
    // compat allow-list match per Phase 16 D-04 + UpdateDialog.tsx's "View
    // full release notes" link).
    const filesToCheck = [
      'src/main/ipc.ts',
      'src/main/auto-update.ts',
    ];

    // Match the canonical index URL literal exactly — no `/tag/...` suffix.
    // Phase 16 D-04 added a per-release templated URL form
    // (`/releases/tag/v${info.version}`) inside auto-update.ts; that's a
    // separate URL shape and is NOT covered by this byte-for-byte literal
    // check. We use a negative-lookahead to guard against accidentally
    // matching the start of the templated form.
    const ghReleasesPattern = /https:\/\/github\.com\/[\w-]+\/Spine_Texture_Manager\/releases(?!\/tag)\/?/g;

    const occurrences: { file: string; match: string }[] = [];
    for (const f of filesToCheck) {
      const content = readFile(f);
      const matches = content.match(ghReleasesPattern) ?? [];
      for (const m of matches) {
        occurrences.push({ file: f, match: m });
      }
    }

    expect(occurrences.length).toBeGreaterThanOrEqual(2); // at least one in each of the 2 remaining files (Phase 16 D-04 dropped App.tsx)

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
