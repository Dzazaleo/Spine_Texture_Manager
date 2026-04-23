/**
 * Phase 1 Plan 02 — Architectural boundary + portability grep tests.
 *
 * Layer 3 of the three-layer defense (Layer 1 = tsconfig.web.json exclude,
 * Layer 2 = no @core alias in electron.vite.config.ts renderer.resolve.alias,
 * Layer 3 = THIS FILE) enforcing CLAUDE.md Fact #5:
 *   "core/ is pure TypeScript, no DOM. The UI is a consumer."
 *
 * D-23 portability gate: no `process.platform` / `os.platform()` branches
 * or macOS-only BrowserWindow options in src/. Phase 1 must be structurally
 * ready to add a Windows .exe target (Phase 9) by config-only diff.
 *
 * RESEARCH §Enforcing core/ ↛ renderer/ Boundary lines 840–860 is the canonical
 * grep regex — copied verbatim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';

describe('Architecture boundary: renderer must not import from src/core (CLAUDE.md Fact #5)', () => {
  it('no renderer file imports from src/core', () => {
    const files = globSync('src/renderer/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*\/core\/|from ['"]@core/.test(text)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `Renderer files importing core: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

describe('Portability: no platform-specific code in src/ (D-23)', () => {
  it('no process.platform / os.platform / macOS-only BrowserWindow chrome', () => {
    const files = globSync('src/{main,preload,renderer}/**/*.{ts,tsx}');
    const forbidden = /process\.platform|os\.platform\(\)|titleBarStyle:\s*['"]hiddenInset['"]|trafficLightPosition|vibrancy:|visualEffectState/;
    const offenders: string[] = [];
    for (const file of files) {
      if (forbidden.test(readFileSync(file, 'utf8'))) offenders.push(file);
    }
    expect(
      offenders,
      `Files with platform-specific code: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
