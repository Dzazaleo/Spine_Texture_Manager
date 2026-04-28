/**
 * Phase 12 Plan 06 Task 5 — REL-03 INSTALL.md cookbook + 4-surface linking
 * integration smoke test.
 *
 * Greenfield. Project's first tests/integration/ file. Asserts the END-TO-END
 * documentation contract that Plan 12-06 ships:
 *
 *   1. INSTALL.md exists at repo root with the cookbook structure (3 OS
 *      sections, libfuse2 / libfuse2t64 caveat, Gatekeeper + SmartScreen
 *      bypass copy).
 *   2. The 4 placeholder PNGs the doc references are committed to
 *      docs/install-images/ (real captures land in phase 12.1).
 *   3. All 4 documented linking surfaces (D-16) point at INSTALL.md:
 *        - .github/release-template.md (D-17 prune to single link)
 *        - .github/workflows/release.yml INSTALL_DOC_LINK env var (D-16.1)
 *        - README.md Installing section (D-16.2)
 *        - In-app Help → Installation Guide… menu + HelpDialog inline link
 *          (D-16.3 + D-16.4)
 *   4. The INSTALL.md URL literal is byte-for-byte identical across all 4
 *      surfaces — this is the URL-consistency gate that catches the most
 *      likely future regression (T-12-06-01 / T-12-06-04 in the threat
 *      register: a refactor that drifts one surface away from the SHELL_
 *      OPEN_EXTERNAL_ALLOWED entry silently breaks the in-app link with no
 *      runtime error — the channel is one-way, mismatches are dropped).
 *   5. SHELL_OPEN_EXTERNAL_ALLOWED Set in src/main/ipc.ts contains the
 *      INSTALL.md URL (Pattern E allow-list defense intact).
 *
 * The test is the regression spec — if any surface drifts, this fails in
 * CI on the next push (12-02's 3-OS test matrix runs all integration tests
 * on every leg).
 *
 * No vitest mocking, no jsdom — pure file-system + string-match assertions.
 * Runs under the default `node` environment (vitest.config.ts) without any
 * additional setup. Sibling pattern: tests/main/recent.spec.ts (file-system
 * + content assertions over committed artifacts).
 */
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..');
const INSTALL_MD_URL_LITERAL = 'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md';

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

describe('REL-03: INSTALL.md cookbook surface', () => {
  test('INSTALL.md exists at repo root', () => {
    expect(existsSync(resolve(REPO_ROOT, 'INSTALL.md'))).toBe(true);
  });

  test('INSTALL.md has macOS / Windows / Linux sections', () => {
    const text = read('INSTALL.md');
    expect(text).toMatch(/^##\s+macOS/m);
    expect(text).toMatch(/^##\s+Windows/m);
    expect(text).toMatch(/^##\s+Linux/m);
  });

  test('INSTALL.md documents libfuse2 / libfuse2t64 caveat (D-15)', () => {
    const text = read('INSTALL.md');
    // libfuse2t64 — Ubuntu 24.04+ package name (the t64 variant).
    expect(text).toContain('libfuse2t64');
    // libfuse2 (without t64) — the older Ubuntu 22.04 / Fedora / Debian 11
    // package name. Match \blibfuse2 followed by NOT a "t" so we don't
    // accept `libfuse2t64` on its own as a positive match.
    expect(text).toMatch(/\blibfuse2(?!t)/);
  });

  test('INSTALL.md documents Gatekeeper + SmartScreen bypass copy', () => {
    const text = read('INSTALL.md');
    expect(text).toContain('Open Anyway');
    expect(text).toContain('Run anyway');
  });

  test('INSTALL.md mentions auto-update (Help → Check for Updates)', () => {
    const text = read('INSTALL.md');
    expect(text).toMatch(/Check for Updates/);
  });

  test('INSTALL.md does not reference internal .planning/ paths', () => {
    const text = read('INSTALL.md');
    expect(text).not.toContain('.planning/');
  });
});

describe('REL-03: docs/install-images/ screenshot directory', () => {
  test('Directory exists', () => {
    expect(existsSync(resolve(REPO_ROOT, 'docs/install-images'))).toBe(true);
  });

  test('All 4 expected PNG slots exist (real captures or 1×1 placeholders)', () => {
    // Per plan 12-06 Task 1 BLOCKING checkpoint: the user resumed with
    // `partial: none` (skip captures and ship text-first). All 4 slots are
    // 1×1 placeholders today; phase 12.1's tester rounds replace them
    // with real screenshots. The doc keeps the markdown image references
    // so the swap is binary-only — INSTALL.md needs no edits.
    const expected = [
      'docs/install-images/macos-gatekeeper-open-anyway.png',
      'docs/install-images/windows-smartscreen-more-info.png',
      'docs/install-images/windows-smartscreen-run-anyway.png',
      'docs/install-images/linux-libfuse2-error.png',
    ];
    for (const rel of expected) {
      expect(existsSync(resolve(REPO_ROOT, rel))).toBe(true);
    }
  });

  test('Each screenshot file is recognized as PNG (magic bytes)', () => {
    const expected = [
      'docs/install-images/macos-gatekeeper-open-anyway.png',
      'docs/install-images/windows-smartscreen-more-info.png',
      'docs/install-images/windows-smartscreen-run-anyway.png',
      'docs/install-images/linux-libfuse2-error.png',
    ];
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A (\x89PNG\r\n\x1a\n).
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const rel of expected) {
      const full = resolve(REPO_ROOT, rel);
      const head = readFileSync(full).subarray(0, 8);
      expect(head.equals(pngMagic)).toBe(true);
      // Sanity: file is non-empty (≥ pngMagic length); 1×1 placeholders are
      // ~67 bytes, real captures will be larger but still well under the
      // 500 KB acceptance limit.
      expect(statSync(full).size).toBeGreaterThanOrEqual(pngMagic.length);
    }
  });

  // Plan 12.1-06 soft-gate (≥ 5KB) — catches accidental re-commits of the
  // 67-byte 1×1 placeholders. Real captures are 100KB-1MB. Linux libfuse2
  // capture deferred to v1.1.1 (lima/multipass on Apple Silicon Sequoia
  // hit blockers; placeholder stays in tree until a real Ubuntu 24.04
  // host or x86_64 VM produces the screenshot).
  test('Each real-captured screenshot is ≥ 5KB (soft-gate against placeholder regression)', () => {
    const realCaptures = [
      'docs/install-images/macos-gatekeeper-open-anyway.png',
      'docs/install-images/windows-smartscreen-more-info.png',
      'docs/install-images/windows-smartscreen-run-anyway.png',
    ];
    const MIN_BYTES = 5 * 1024; // 5 KB
    for (const rel of realCaptures) {
      const full = resolve(REPO_ROOT, rel);
      const size = statSync(full).size;
      expect(
        size,
        `${rel} is ${size} bytes; expected ≥ ${MIN_BYTES} bytes (real capture). 67-byte 1×1 placeholder regression?`,
      ).toBeGreaterThanOrEqual(MIN_BYTES);
    }
  });

  test.todo('Linux libfuse2 PNG deferred to v1.1.1 — capture on real Ubuntu 24.04 host or x86_64 VM');
});

describe('REL-03: 4 INSTALL.md linking surfaces', () => {
  test('Surface 1a — release-template uses ${INSTALL_DOC_LINK} link, not inline bullets', () => {
    const text = read('.github/release-template.md');
    expect(text).toContain('[INSTALL.md](${INSTALL_DOC_LINK})');
    // Bullets should be pruned (D-17):
    expect(text).not.toMatch(/^- \*\*macOS\*\*/m);
    expect(text).not.toMatch(/^- \*\*Windows\*\*/m);
    expect(text).not.toMatch(/^- \*\*Linux\s*\(?\s*x64\s*\)?\*\*/m);
  });

  test('Surface 1b — release.yml INSTALL_DOC_LINK env var points at INSTALL.md', () => {
    const text = read('.github/workflows/release.yml');
    expect(text).toMatch(/INSTALL_DOC_LINK:\s*https:\/\/github\.com\/.*\/blob\/main\/INSTALL\.md/);
    // Make sure no leftover README.md placeholder lurks in the env block:
    expect(text).not.toMatch(/INSTALL_DOC_LINK:\s*https:\/\/github\.com\/.*\/blob\/main\/README\.md/);
  });

  test('Surface 2 — README.md has Installing section with INSTALL.md link', () => {
    const text = read('README.md');
    expect(text).toMatch(/^##\s+Installing/m);
    expect(text).toMatch(/\[INSTALL\.md\]\(INSTALL\.md\)/);
  });

  test('Surface 3a — Help menu has Installation Guide… item', () => {
    const text = read('src/main/index.ts');
    expect(text).toContain('Installation Guide');
    expect(text).toContain("'menu:installation-guide-clicked'");
  });

  test('Surface 3b — preload bridge exposes onMenuInstallationGuide', () => {
    const preloadJs = read('src/preload/index.ts');
    const sharedTypes = read('src/shared/types.ts');
    expect(preloadJs).toContain('onMenuInstallationGuide');
    expect(sharedTypes).toContain('onMenuInstallationGuide');
    // Pitfall 9 listener-identity preservation: wrapped const captured
    // BEFORE ipcRenderer.on so the unsubscribe closure references the
    // SAME identity that removeListener compares by reference. Same shape
    // as onMenuCheckForUpdates / onMenuHelp / onMenuSettings.
    expect(preloadJs).toMatch(/onMenuInstallationGuide:[\s\S]{0,400}const wrapped/);
  });

  test('Surface 3c — AppShell subscribes and calls openExternalUrl with INSTALL.md URL', () => {
    const text = read('src/renderer/src/components/AppShell.tsx');
    expect(text).toContain('onMenuInstallationGuide');
    expect(text).toContain('blob/main/INSTALL.md');
  });

  test('Surface 4 — HelpDialog has module constant + section linking to INSTALL.md', () => {
    const text = read('src/renderer/src/modals/HelpDialog.tsx');
    expect(text).toContain('INSTALL_DOC_URL');
    expect(text).toContain(INSTALL_MD_URL_LITERAL);
    expect(text).toContain('openLink(INSTALL_DOC_URL)');
  });

  test('Trust-boundary — INSTALL.md URL is in SHELL_OPEN_EXTERNAL_ALLOWED Set', () => {
    const text = read('src/main/ipc.ts');
    // The Set entry MUST be the exact literal (Set.has compares by value).
    expect(text).toContain(`'${INSTALL_MD_URL_LITERAL}'`);
  });
});

describe('REL-03: URL consistency across all 4 surfaces', () => {
  test('The INSTALL.md URL literal matches in all 4 places', () => {
    const ipc = read('src/main/ipc.ts');
    const helpDialog = read('src/renderer/src/modals/HelpDialog.tsx');
    const appShell = read('src/renderer/src/components/AppShell.tsx');
    const workflow = read('.github/workflows/release.yml');

    // All 4 must contain the exact literal. T-12-06-01 / T-12-06-04
    // mitigation: this assertion fails in CI if any surface's URL drifts
    // away from the others (e.g. someone renames the GitHub org/repo and
    // forgets to update one of the 4 — the in-app link silently breaks
    // because Set.has returns false on the mismatched URL).
    expect(ipc).toContain(INSTALL_MD_URL_LITERAL);
    expect(helpDialog).toContain(INSTALL_MD_URL_LITERAL);
    expect(appShell).toContain(INSTALL_MD_URL_LITERAL);
    // workflow URL is interpolated via ${{ github.repository }} so the literal
    // form differs ('${{ github.repository }}' vs 'Dzazaleo/Spine_Texture_Manager').
    // The shape we assert is: any GitHub URL with /blob/main/INSTALL.md suffix.
    expect(workflow).toMatch(/blob\/main\/INSTALL\.md/);
  });
});
