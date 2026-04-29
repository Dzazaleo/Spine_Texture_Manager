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
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
