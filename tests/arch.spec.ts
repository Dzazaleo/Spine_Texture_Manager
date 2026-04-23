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

describe('Sandbox invariant: preload must be CJS (sandbox: true cannot load ESM preloads)', () => {
  it('src/main/index.ts references the compiled CJS preload, not ESM', () => {
    const main = readFileSync('src/main/index.ts', 'utf8');
    expect(main, 'main must point at preload/index.cjs').toMatch(/preload\/index\.cjs/);
    expect(main, 'main must NOT point at preload/index.mjs').not.toMatch(/preload\/index\.mjs/);
  });

  it('electron.vite.config.ts emits the preload as CJS with .cjs extension', () => {
    const cfg = readFileSync('electron.vite.config.ts', 'utf8');
    expect(cfg, 'preload output.format must be cjs').toMatch(/format:\s*['"]cjs['"]/);
    expect(cfg, 'preload entryFileNames must end in .cjs').toMatch(/\[name\]\.cjs/);
  });
});

describe('Main-bundle invariant: main must be CJS (Node 24 ESM loader cannot destructure electron named exports)', () => {
  it('package.json "main" field points at the compiled CJS main bundle, not ESM or plain .js', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { main?: string };
    expect(pkg.main, 'package.json main field must point at out/main/index.cjs').toBe('./out/main/index.cjs');
    expect(pkg.main, 'package.json main must NOT point at out/main/index.js').not.toBe('./out/main/index.js');
    expect(pkg.main, 'package.json main must NOT point at out/main/index.mjs').not.toBe('./out/main/index.mjs');
  });

  it('electron.vite.config.ts emits the main bundle as CJS with .cjs extension', () => {
    const cfg = readFileSync('electron.vite.config.ts', 'utf8');
    // Isolate the `main:` block (from `main: {` to the sibling `preload:` key at matching indent)
    // so the preload CJS guard can't accidentally satisfy this assertion.
    const mainBlockMatch = cfg.match(/main:\s*\{[\s\S]*?\n\s{2}preload:/);
    expect(mainBlockMatch, 'could not locate main: block in electron.vite.config.ts').not.toBeNull();
    const mainBlock = mainBlockMatch![0];
    expect(mainBlock, 'main output.format must be cjs').toMatch(/format:\s*['"]cjs['"]/);
    expect(mainBlock, 'main entryFileNames must end in .cjs').toMatch(/\[name\]\.cjs/);
  });
});
