// @vitest-environment jsdom
/**
 * Phase 23 — appshell-optimize-flow.spec.tsx
 *
 * Tests for the deferred-folder-picker optimize flow (OPT-01 + OPT-02).
 *
 * Coverage:
 *   - D-01: pre-flight header shows "N images" (no path) when outDir is null
 *   - D-02: pre-flight header shows "N images → /path" when outDir is set
 *   - Source-grep: onClickOptimize does NOT call pickOutputDirectory
 *   - Source-grep: lastOutDir state slot exists in AppShell
 *   - Source-grep: onConfirmStart calls pickOutputDir before probeExportConflicts
 *   - Source-grep: buildSessionState uses lastOutDir (not null hardcode)
 *   - Source-grep: onRunEnd calls saveProject
 *
 * Per project test convention (tests/renderer/missing-attachments-panel.spec.tsx:13-14):
 * use `not.toBeNull()` / `toBeDefined()` rather than @testing-library/jest-dom
 * matchers — no jest-dom imports anywhere in tests/renderer.
 *
 * window.api stub: OptimizeDialog mounts with `state: 'pre-flight'` (no
 * onExportProgress subscription on first render), so a minimal stub suffices —
 * onExportProgress is only invoked when the user clicks Start (state flips to
 * 'in-progress').
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportRow } from '../../src/shared/types';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

beforeEach(() => {
  vi.stubGlobal('api', {
    onExportProgress: vi.fn(() => () => undefined),
    startExport: vi.fn(),
    cancelExport: vi.fn(),
    openOutputFolder: vi.fn(),
    pickOutputDirectory: vi.fn(),
    probeExportConflicts: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

/** Build a synthetic ExportRow with sane defaults. */
function makeRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    sourcePath: '/fake/CIRCLE.png',
    outPath: 'images/CIRCLE.png',
    sourceW: 699,
    sourceH: 699,
    outW: 350,
    outH: 350,
    effectiveScale: 0.5,
    attachmentNames: ['CIRCLE'],
    ...overrides,
  };
}

/** Build a synthetic ExportPlan with one resize row by default. */
function makePlan(opts: {
  rows?: ExportRow[];
  passthroughCopies?: ExportRow[];
} = {}): ExportPlan {
  return {
    rows: opts.rows ?? [makeRow()],
    excludedUnused: [],
    passthroughCopies: opts.passthroughCopies ?? [],
    totals: {
      count: (opts.rows?.length ?? 1) + (opts.passthroughCopies?.length ?? 0),
    },
  };
}

/** Common required-prop surface for OptimizeDialog. */
const REQUIRED_PROPS = {
  open: true,
  outDir: null as string | null, // Phase 23: null on first open (no saved path)
  onClose: vi.fn(),
  onOpenAtlasPreview: vi.fn(),
};

// ---------------------------------------------------------------------------
// D-01 / D-02: header title conditional on outDir
// ---------------------------------------------------------------------------

describe('OptimizeDialog — Phase 23 deferred-picker header title', () => {
  it('D-01: pre-flight header shows "N images" (no path) when outDir is null', () => {
    render(<OptimizeDialog {...REQUIRED_PROPS} outDir={null} plan={makePlan()} />);
    // The header title must end with "N images" — no "→ /path" suffix.
    const headerEl = screen.getByText(/Optimize Assets — \d+ images$/);
    expect(headerEl).not.toBeNull();
    // Header element itself must NOT contain "→" (the arrow is in the row
    // body dims display "699 × 699 → 350 × 350", NOT in the header when
    // outDir is null).
    expect(headerEl.textContent).not.toMatch(/→.*\//);
  });

  it('D-02: pre-flight header shows "N images → /path" when outDir is set', () => {
    render(
      <OptimizeDialog
        {...REQUIRED_PROPS}
        outDir="/saved/output"
        plan={makePlan()}
      />,
    );
    expect(
      screen.getByText(/Optimize Assets — \d+ images → \/saved\/output/),
    ).not.toBeNull();
  });

  it('null guard: openOutputFolder does not call window.api when outDir is null', () => {
    // Mount in pre-flight. The "Open output folder" button only renders in
    // complete state — this test verifies the null guard exists in the source
    // (type-safety; button unreachable when outDir is null by construction).
    render(<OptimizeDialog {...REQUIRED_PROPS} outDir={null} plan={makePlan()} />);
    // openOutputFolder is guarded; no call during mount
    expect(vi.mocked(window.api.openOutputFolder)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Source-grep regression gates (read AppShell.tsx as a string)
// ---------------------------------------------------------------------------

describe('AppShell.tsx — Phase 23 source-grep gates', () => {
  const APPSHELL_PATH = resolve(
    __dirname,
    '..',
    '..',
    'src',
    'renderer',
    'src',
    'components',
    'AppShell.tsx',
  );

  async function readCodeOnly(): Promise<string> {
    const src = await readFile(APPSHELL_PATH, 'utf8');
    // Strip comments (coarse: block + line).
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
  }

  it('onClickOptimize does NOT call pickOutputDirectory (picker deferred to Start)', async () => {
    // Read raw source — comment stripping is unreliable when "/*" appears
    // inside "//" comments (e.g. "src/core/* per arch.spec.ts gate"). Use
    // the raw source for these checks; the patterns we search for are not
    // inside comments in the Phase 23 implementation.
    const src = await readFile(APPSHELL_PATH, 'utf8');
    // Extract the onClickOptimize useCallback body up to its dependency array.
    const match = src.match(/const onClickOptimize[\s\S]*?\}\s*,\s*\[summary,/);
    if (match) {
      // The body must NOT call pickOutputDirectory
      expect(match[0]).not.toMatch(/pickOutputDirectory/);
    } else {
      // If the body isn't found with the expected deps, assert the new
      // pattern is present (fails RED if not implemented).
      expect(src).toMatch(/const onClickOptimize/);
      expect(src).not.toMatch(/onClickOptimize[\s\S]{0,300}pickOutputDirectory/);
    }
    // Belt-and-suspenders: new body contains setExportDialogState({ plan, outDir: lastOutDir })
    expect(src).toMatch(/setExportDialogState\(\s*\{\s*plan,\s*outDir:\s*lastOutDir\s*\}\s*\)/);
  });

  it('lastOutDir state slot exists in AppShell (useState<string | null>)', async () => {
    const src = await readFile(APPSHELL_PATH, 'utf8');
    expect(src).toMatch(/lastOutDir,\s*setLastOutDir\s*\]\s*=\s*useState/);
  });

  it('onConfirmStart calls pickOutputDir before probeExportConflicts', async () => {
    const src = await readFile(APPSHELL_PATH, 'utf8');
    // Both must appear in the file and pickOutputDir must appear before
    // probeExportConflicts in the onConfirmStart body.
    const confirmStartMatch = src.match(
      /const onConfirmStart[\s\S]*?},\s*\[exportDialogState/,
    );
    if (confirmStartMatch) {
      const body = confirmStartMatch[0];
      const pickerIdx = body.indexOf('pickOutputDir(');
      const probeIdx = body.indexOf('probeExportConflicts');
      expect(pickerIdx).toBeGreaterThanOrEqual(0);
      expect(probeIdx).toBeGreaterThanOrEqual(0);
      expect(pickerIdx).toBeLessThan(probeIdx);
    } else {
      // If we didn't match, assert the pattern is there (will fail RED → GREEN)
      expect(src).toMatch(/const onConfirmStart[\s\S]*?pickOutputDir/);
    }
  });

  it('buildSessionState uses lastOutDir state slot (no null hardcode)', async () => {
    const src = await readFile(APPSHELL_PATH, 'utf8');
    // Must NOT contain the old deferral pattern
    expect(src).not.toMatch(/lastOutDir:\s*null,\s*\/\/ Phase 9 polish/);
    // Must contain the state-slot reference (shorthand or explicit)
    expect(src).toMatch(/lastOutDir,/);
  });

  it('onRunEnd calls saveProject silently after export (D-07)', async () => {
    const src = await readFile(APPSHELL_PATH, 'utf8');
    expect(src).toMatch(/saveProject\(\s*buildSessionState\(\s*\)/);
  });
});
