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
    // Phase 12 Plan 01 carve-out (CONTEXT D-04): auto-update.ts is the
    // ONLY load-bearing platform-branching surface in v1.1 — the Windows
    // unsigned-NSIS spike outcome (Task 6) routes the Windows branch to
    // either the full auto-update path OR the manual-fallback notice. D-04
    // explicitly contracts: "macOS and Linux always take the full auto-update
    // path (download + apply). Windows is the only platform where the spike
    // result can route to the fallback. The two paths must be implemented
    // under one cohesive code surface (per-platform branching at the
    // update-flow boundary, not duplicated dialogs/menus)." The branch
    // lives in deliverUpdateAvailable's variant-routing constant + IPC
    // payload field — main is the single source of truth, renderer never
    // derives the variant from process.platform.
    const PLATFORM_CARVE_OUTS = new Set<string>([
      'src/main/auto-update.ts',
    ]);
    const offenders: string[] = [];
    for (const file of files) {
      // globSync emits backslashes on Windows; normalize so set lookup matches POSIX-form keys.
      const normalized = file.replace(/\\/g, '/');
      if (PLATFORM_CARVE_OUTS.has(normalized)) continue;
      if (forbidden.test(readFileSync(file, 'utf8'))) offenders.push(normalized);
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

describe('GlobalMaxRenderPanel batch-scope invariant (04-03 gap-fix A regression guard)', () => {
  // Locks the attachmentKey → attachmentName conversion at the batch override
  // invocation site. Human-verify 2026-04-24 surfaced that passing raw
  // `selected` (attachmentKey strings) to onOpenOverrideDialog silently
  // collapses batch scope to the clicked row because AppShell's scope check
  // uses `selectedKeys.has(row.attachmentName)`. The fix introduces a named
  // intermediate `selectedAttachmentNames`; this spec grep-anchors that
  // contract so a regression fails CI immediately.
  const SRC = readFileSync('src/renderer/src/panels/GlobalMaxRenderPanel.tsx', 'utf8');

  it('does not pass the raw attachmentKey selection set to onOpenOverrideDialog', () => {
    // Forbid passing the `selected` state directly as the selectedKeys prop
    // for the Row, because that set contains attachmentKey values not
    // attachmentName values. (The Row's onDoubleClick hands the set to
    // onOpenOverrideDialog unchanged.)
    expect(SRC, 'GlobalMaxRenderPanel must NOT pass raw `selected` (attachmentKey set) as selectedKeys').not.toMatch(
      /selectedKeys=\{selected\}/,
    );
  });

  it('uses a named intermediate attachmentName set for the outbound contract', () => {
    // Lock the conversion helper name so the grep has a stable anchor.
    expect(SRC, 'GlobalMaxRenderPanel must declare selectedAttachmentNames intermediate').toMatch(
      /selectedAttachmentNames/,
    );
    expect(SRC, 'Row must receive selectedAttachmentNames, not raw selected').toMatch(
      /selectedKeys=\{selectedAttachmentNames\}/,
    );
  });
});

describe('Architecture boundary: src/core must not import sharp / node:fs / node:fs/promises (CLAUDE.md Fact #5 + Phase 6 Layer 3 lock)', () => {
  it('no core file imports sharp or node:fs (sync or promises) — loader.ts exempt as Phase 0 load-time carve-out', () => {
    const files = globSync('src/core/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      // loader.ts is the Phase 0 load-time fs carve-out (CLAUDE.md fact #4 says
      // the math phase doesn't decode PNGs; loader.ts is the load phase, not
      // the math phase — it reads the .json + .atlas text files exactly once
      // at boot and never re-enters during the sampler hot loop). Phase 6
      // does not touch loader.ts; this exemption is name-anchored.
      if (file.endsWith('loader.ts')) continue;
      const text = readFileSync(file, 'utf8');
      if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]fs(\/promises)?['"]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Core files importing sharp/node:fs: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('Phase 8 Layer 3: src/core/project-file.ts must not import electron (T-08-LAYER)', () => {
  it('src/core/project-file.ts does not import from electron', () => {
    // Specifically guards the new project-file module — the existing core grep
    // (lines ~116-134) covers fs/sharp; this block adds electron coverage and
    // names the file explicitly so future Phase-8 hygiene drift is caught even
    // if the existing globSync rule changes.
    const filePath = 'src/core/project-file.ts';
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      // File doesn't exist yet (Plan 02 lands it). When it lands the grep applies.
      return;
    }
    expect(text, `${filePath} must not import from electron`).not.toMatch(/from ['"]electron['"]/);
    expect(text, `${filePath} must not import from node:fs`).not.toMatch(/from ['"]node:fs(\/promises)?['"]/);
    expect(text, `${filePath} must not import from sharp`).not.toMatch(/from ['"]sharp['"]/);
  });
});

// Phase 9 — Layer 3 named anchor for the new worker_threads worker.
// The existing globSync at lines 19-34 covers src/{main,preload,renderer}/**
// for general Layer 3 invariants; this named block makes a Phase-9-specific
// regression visible at PR-review time.
//
// Critical: Wave 0 lands this block BEFORE src/main/sampler-worker.ts exists,
// so the readFileSync MUST tolerate ENOENT gracefully (return early). When
// Wave 1 lands the file, every assertion below MUST hold.
describe('Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces', () => {
  it('does not import from src/renderer/, react, electron, or DOM globals', () => {
    const filePath = 'src/main/sampler-worker.ts';
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      // File doesn't exist yet (Wave 1 lands it). When it lands, the grep applies.
      return;
    }
    expect(text, `${filePath} must not import from src/renderer/`).not.toMatch(
      /from ['"][^'"]*\/renderer\//,
    );
    expect(text, `${filePath} must not import from react`).not.toMatch(
      /from ['"]react['"]/,
    );
    expect(text, `${filePath} must not import from electron`).not.toMatch(
      /from ['"]electron['"]/,
    );
    expect(text, `${filePath} must not reference DOM globals (document., window.)`).not.toMatch(
      /\b(document|window)\./,
    );
  });
});
