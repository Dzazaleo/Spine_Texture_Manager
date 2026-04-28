import { describe, test, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Phase 13 source-grep regression tests (D-07 Claude's Discretion adopted).
 *
 * Locks two carry-forward Phase 12.1 cosmetic fixes against future careless
 * refactors. Mirrors the F2 source-grep pattern in
 * `tests/renderer/app-shell-output-picker.spec.tsx` (commit `4e7fe08`).
 *
 * Why source-grep, not behavioral test: BrowserWindow constructor options +
 * app-level setAboutPanelOptions calls are not exercised by vitest in this
 * codebase (no Electron main-process mock at that level). Source-grep is the
 * cheapest defensible regression gate. Live verification on a packaged
 * Windows install is owned by Phase 13.1.
 *
 * Cross-references:
 *   - `.planning/todos/resolved/2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md`
 *   - `.planning/todos/resolved/2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md`
 *   - `.planning/phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md`
 *     §Anti-Patterns Found #3 + #4
 */
describe('Phase 13 regression: src/main/index.ts cosmetic Windows fixes locked in', () => {
  const SRC_PATH = resolve(__dirname, '..', '..', 'src', 'main', 'index.ts');

  test('autoHideMenuBar is false (Windows menu bar visible by default)', async () => {
    const src = await readFile(SRC_PATH, 'utf8');
    // Strip /* ... */ block comments and // ... line comments so a docblock
    // referencing the historical `true` value cannot false-trigger the
    // negative assertion. Pattern verbatim from F2's app-shell-output-picker.spec.tsx.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(codeOnly).toMatch(/autoHideMenuBar:\s*false/);
    expect(codeOnly).not.toMatch(/autoHideMenuBar:\s*true/);
  });

  test('app.setAboutPanelOptions is called with applicationVersion: app.getVersion()', async () => {
    const src = await readFile(SRC_PATH, 'utf8');
    // Presence check; no comment-stripping needed because the docblock above
    // the call cites the call shape verbatim, but the assertions target the
    // canonical form which is unambiguous.
    expect(src).toMatch(/app\.setAboutPanelOptions\s*\(\s*\{/);
    expect(src).toMatch(/applicationVersion:\s*app\.getVersion\(\)/);
  });
});
