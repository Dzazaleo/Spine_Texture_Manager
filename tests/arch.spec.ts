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
      // Phase 31 PLATFORM-01 — Windows admin DnD fallback probe (D-23 carve-out).
      // The probe wraps `child_process.exec('net session')` behind a
      // `process.platform === 'win32'` short-circuit so the renderer never
      // sees platform branching; only the cached boolean traverses IPC.
      'src/main/elevation.ts',
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

describe('GlobalMaxRenderPanel batch-scope invariant (Phase 29 Plan 29-05 / CR-01 regression guard)', () => {
  // Pre-Phase-29: panel selection was attachmentKey-keyed; AppShell's batch
  // scope check used `selectedKeys.has(row.attachmentName)`, so the panel
  // had to convert attachmentKey → attachmentName via a named intermediate
  // (selectedAttachmentNames) before handing the set to onOpenOverrideDialog.
  //
  // Post-Phase-29 Plan 29-02: panel selection is regionName-keyed (one row
  // per source PNG / atlas region).
  // Post-Phase-29 Plan 29-03: AppShell's overrides Map + batch-scope check
  // are also regionName-keyed (`rowKey = row.regionName ?? row.attachmentName`).
  // Post-Phase-29 Plan 29-05 (CR-01 fix): the obsolete contributor-fan-out
  // intermediate is removed — both ends key on regionName, so the panel
  // passes the regionName-keyed `selected` Set verbatim as `selectedKeys`.
  //
  // The guards below now lock the POST-29-05 contract — passing `selected`
  // verbatim (no fan-out intermediate). A regression that re-introduces the
  // attachmentName fan-out would fail CI here AND fail the
  // tests/regression/path-indirection.spec.ts REGION-04 batch-apply UI block.
  const SRC = readFileSync('src/renderer/src/panels/GlobalMaxRenderPanel.tsx', 'utf8');

  it('passes the regionName-keyed `selected` Set verbatim as selectedKeys at both Row prop sites (CR-01 fix)', () => {
    // The post-CR-01 contract: AppShell's overrides Map is regionName-keyed,
    // so the panel passes `selected` (regionName-keyed) directly. No
    // contributor-fan-out conversion needed. Both Row prop sites
    // (virtualized branch + flat-table branch) must use this shape.
    const selectedKeysHits = (SRC.match(/selectedKeys=\{selected\}/g) ?? []).length;
    expect(selectedKeysHits, 'Both Row prop sites (virtualized + flat-table) must pass `selected` verbatim').toBeGreaterThanOrEqual(2);
  });

  it('does not re-introduce the obsolete contributor-fan-out intermediate (selectedAttachmentNames)', () => {
    // The pre-29-05 fan-out intermediate poisoned AppShell's regionName-keyed
    // override Map with contributor attachmentNames on path-indirected
    // fixtures (CR-01). Removed in Plan 29-05; this guard prevents
    // re-introduction.
    expect(SRC, 'GlobalMaxRenderPanel must NOT re-introduce the contributor-fan-out intermediate').not.toMatch(
      /selectedAttachmentNames/,
    );
  });
});

describe('Architecture boundary: src/core must not import sharp / node:fs / node:fs/promises (CLAUDE.md Fact #5 + Phase 6 Layer 3 lock)', () => {
  it('no core file imports sharp or node:fs (sync or promises) — loader.ts + png-header.ts + synthetic-atlas.ts exempt as load-time carve-outs', () => {
    const files = globSync('src/core/**/*.ts');
    // Phase 21 Plan 01 — png-header.ts is a load-time IHDR byte reader
    // (24 bytes from file head, no decompression, no IDAT). It is structurally
    // distinct from PNG decoding (which would require zlib/IDAT/pixel buffers
    // and IS forbidden by CLAUDE.md fact #4). Like loader.ts, it executes at
    // load-time only and never re-enters during the sampler hot loop.
    //
    // Phase 21 Plan 04 — synthetic-atlas.ts uses fs.statSync at load time to
    // check images/ folder existence (D-10 catastrophic case detection)
    // before delegating per-PNG IHDR reads to png-header.readPngDims. Same
    // structural carve-out: load-time only, never re-enters the sampler hot
    // loop, and the only fs surface is statSync (no decoding).
    const FS_LOAD_TIME_CARVE_OUTS = new Set<string>([
      'src/core/loader.ts',
      'src/core/png-header.ts',
      'src/core/synthetic-atlas.ts',
    ]);
    const offenders: string[] = [];
    for (const file of files) {
      const normalized = file.replace(/\\/g, '/');
      if (FS_LOAD_TIME_CARVE_OUTS.has(normalized)) continue;
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

// Phase 36 follow-up — Layer 3 named anchor for the window-close dirty-guard.
// Phase 8 wired `app.on('before-quit')` to gate Cmd+Q on the SaveQuitDialog,
// but the X / Cmd+W path bypassed it (window destroyed before the IPC
// roundtrip could land — surfaced during Phase 36 HUMAN-UAT Test 8 on
// 2026-05-13). The fix adds `mainWindow.on('close', ...)` mirroring the
// before-quit handler. This anchor block locks the binding in place so a
// future refactor that removes the close-event guard breaks the build
// instead of silently re-introducing the data-loss-on-X regression.
describe('Phase 36 follow-up Layer 3: src/main/index.ts must guard window close with the dirty-check IPC', () => {
  it("index.ts binds mainWindow.on('close', ...) AND sends project:check-dirty-before-quit from it", () => {
    const filePath = 'src/main/index.ts';
    const text = readFileSync(filePath, 'utf8');
    expect(
      text,
      `${filePath} must bind a 'close' listener on mainWindow to route X / Cmd+W through the dirty-guard. Removing this handler re-introduces the silent data-loss bug surfaced in Phase 36 HUMAN-UAT Test 8 (2026-05-13).`,
    ).toMatch(/mainWindow\.on\(\s*['"]close['"]/);
    // The handler must dispatch the same IPC that the before-quit handler
    // uses — single mental model, single renderer subscription path.
    const closeBlockMatch = text.match(
      /mainWindow\.on\(\s*['"]close['"][\s\S]*?\}\s*\)\s*;/,
    );
    expect(closeBlockMatch, 'expected the close handler to be a complete listener block').not.toBeNull();
    expect(closeBlockMatch?.[0], 'close handler must send project:check-dirty-before-quit').toMatch(
      /project:check-dirty-before-quit/,
    );
    // isQuitting re-entry guard is load-bearing — without it, the
    // app.quit() → mainWindow.close() chain re-fires preventDefault and
    // deadlocks the exit. Phase 8 Pitfall 1 carry-forward.
    expect(closeBlockMatch?.[0], 'close handler must early-return when isQuitting is true').toMatch(
      /isQuitting/,
    );
  });
});

// Phase 18 — Layer 3 named anchor for the lifted before-quit dirty-guard.
// CONTEXT D-08: AppShell.tsx must NOT contain `onCheckDirtyBeforeQuit` after
// the lift. Phase 18 moves that subscription up to App.tsx (always-mounted
// root) so Cmd+Q from any AppState routes through a live listener; this
// grep locks the lift architecturally so a future re-regression breaks
// the build, not just runtime.
//
// Unlike the Phase 8 / Phase 9 named-anchor blocks above, this block does
// NOT use a try/catch ENOENT swallow — AppShell.tsx already exists and a
// silent-pass on rename/delete would mask exactly the regression class
// this block is meant to catch.
describe('Phase 18 Layer 3: src/renderer/src/components/AppShell.tsx must not subscribe to onCheckDirtyBeforeQuit', () => {
  it('AppShell.tsx does not contain the literal "onCheckDirtyBeforeQuit"', () => {
    const filePath = 'src/renderer/src/components/AppShell.tsx';
    const text = readFileSync(filePath, 'utf8');
    expect(
      text,
      `${filePath} must NOT subscribe to onCheckDirtyBeforeQuit — that listener was lifted to App.tsx in Phase 18 (CONTEXT D-01 / D-02). Re-introducing it here would re-break QUIT-01 / QUIT-02 (Cmd+Q no-op when no project loaded).`,
    ).not.toMatch(/onCheckDirtyBeforeQuit/);
  });
});

// Phase 42 RT-04 + RT-03 backstop — appended (RESEARCH §Code Examples).
// The existing src/core/** fs/sharp scanner above already covers
// core/runtime/*.ts with NO carve-out (Phase 42 adds no fs/sharp/DOM there).
// These two named anchors add: (1) the Phase-42 "no spine-core in runtime/
// either" purity (RT-04) and (2) the no-co-mingled-imports backstop BEHIND
// the unique-symbol brand (RT-03 defense-in-depth — brand FIRST, grep SECOND).
// globSync self-handles a missing/empty dir → zero files = empty offenders =
// green, so no ENOENT guard is needed (the dir lands in this same commit).
describe('Phase 42 RT-04: src/core/runtime/ is Layer-3 pure (no DOM/Electron/sharp/spine-core in Phase 42)', () => {
  it('core/runtime/*.ts import neither sharp/node:fs/electron NOR a spine-core package (signatures only in Phase 42)', () => {
    const files = globSync('src/core/runtime/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // Phase 42: runtime/ is signatures only — NO spine-core import yet
      // (the two adapter impls that import it are Phase 43 / RT-02).
      if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]electron['"]|from ['"]@esotericsoftware\/spine-core['"]|from ['"]spine-core-42['"]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `core/runtime Phase-42 purity violation: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('Phase 42 RT-03 backstop: no source file imports BOTH spine-core alias specifiers', () => {
  it('no src/**/*.ts imports @esotericsoftware/spine-core AND spine-core-42 in the same file', () => {
    const files = globSync('src/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const has43 = /from ['"]@esotericsoftware\/spine-core['"]/.test(text);
      const has42 = /from ['"]spine-core-42['"]/.test(text);
      if (has43 && has42) offenders.push(file);
    }
    expect(offenders, `Files co-mingling both spine-core runtimes: ${offenders.join(', ')}`).toEqual([]);
  });
});
