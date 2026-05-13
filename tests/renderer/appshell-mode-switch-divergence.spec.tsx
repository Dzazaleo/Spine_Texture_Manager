// @vitest-environment jsdom
/**
 * Phase 36 OVR-07 — AppShell mode-switch override divergence integration test.
 *
 * Locks the SEED-007 split-overrides-per-loader-mode contract at the
 * renderer surface: an override applied in atlas-source mode MUST NOT leak
 * into atlas-less when the user toggles loaderMode, AND vice versa. The
 * third test covers the line-1542 hydration-site regression catcher (per
 * blocker review 2026-05-13): a samplingHz change MUST preserve the
 * inactive-mode bucket via the post-Plan-36-03 sibling hydration of
 * `setOverridesAtlasLess(...)` immediately after the existing `setOverrides(...)`
 * call in the samplingHz-change resample useEffect.
 *
 * Test coverage:
 *   1. atlas-source override does NOT leak into atlas-less bucket on toggle.
 *   2. atlas-less override does NOT overwrite atlas-source bucket on toggle-back.
 *   3. samplingHz change preserves the inactive-mode bucket (the line-1542
 *      hydration-site regression catcher per blocker review 2026-05-13).
 *
 * Scaffolding mirrors tests/renderer/override-migration-banner.spec.tsx +
 * tests/renderer/loader-mode-toggle-disabled.spec.tsx (window.api stub
 * verbatim, makeSummary helper extended to include CIRCLE region for the
 * Override-dialog interaction, openLoaderMenu helper from loader-mode-toggle
 * spec).
 *
 * Override-presence selector: each panel row's "Peak W×H" `<td>` carries a
 * `title` attribute that begins with the literal string "Override set" when
 * the row's regionName is present in the active overrides slice. Asserting
 * via `getByTitle(/^Override set/)` is a stable, render-tree-deterministic
 * selector — no `data-testid` additions needed.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type {
  SkeletonSummary,
  SaveResponse,
  RegionRow,
  ResampleArgs,
  OpenResponse,
} from '../../src/shared/types';
import { DEFAULT_DOCUMENTATION } from '../../src/shared/types';

afterEach(cleanup);

/**
 * Build a synthetic `RegionRow` for the panel. Plan-36-PATTERNS §10 specifies
 * that the row labels are queryable via `getByRole('checkbox', { name: 'Select X' })`
 * (the row's selection checkbox carries `aria-label="Select {regionName}"`).
 */
function makeRegionRow(regionName: string, sourceW = 64, sourceH = 64): RegionRow {
  return {
    regionName,
    attachmentName: regionName,
    skinName: 'default',
    slotName: `slot-${regionName.toLowerCase()}`,
    animationName: 'idle',
    time: 0,
    frame: 12,
    peakScale: 0.5,
    peakScaleX: 0.5,
    peakScaleY: 0.5,
    worldW: 32,
    worldH: 32,
    sourceW,
    sourceH,
    isSetupPosePeak: false,
    sourcePath: `/a/b/images/${regionName}.png`,
    canonicalW: sourceW,
    canonicalH: sourceH,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: `${sourceW}×${sourceH}`,
    peakSizeLabel: '32×32',
    scaleLabel: '0.500×',
    sourceLabel: 'idle',
    frameLabel: '12',
    contributingAttachments: [
      {
        attachmentName: regionName,
        skinName: 'default',
        slotName: `slot-${regionName.toLowerCase()}`,
        peakScale: 0.5,
        animationName: 'idle',
        time: 0,
        frame: 12,
        isSetupPosePeak: false,
      },
    ],
  };
}

/**
 * Minimal `SkeletonSummary` with TWO regions (CIRCLE + SQUARE) so the panel
 * renders >0 rows AND we can choose CIRCLE as our override target.
 * `hasAtlasFile: true` + `hasImagesDir: true` so the loader-mode toggle item
 * is enabled in both directions (per loader-mode-toggle-disabled.spec.tsx
 * pattern A3/A4). `atlasPath` is non-null on construction → AppShell mounts
 * in "atlas-source" UI state when `loaderMode === 'auto'`.
 */
function makeSummary(opts: { atlasPath: string | null } = { atlasPath: '/a/b/SIMPLE.atlas' }): SkeletonSummary {
  const circle = makeRegionRow('CIRCLE');
  const square = makeRegionRow('SQUARE');
  return {
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: opts.atlasPath,
    hasAtlasFile: true,
    hasImagesDir: true,
    bones: { count: 0, names: [] },
    slots: { count: 2 },
    attachments: { count: 2, byType: { RegionAttachment: 2 } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 1, names: ['idle'] },
    events: { count: 0, names: [] },
    peaks: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        attachmentName: 'CIRCLE',
        regionName: 'CIRCLE',
        skinName: 'default',
        slotName: 'slot-circle',
        sourceW: 64,
        sourceH: 64,
        worldW: 32,
        worldH: 32,
        peakScale: 0.5,
        animationName: 'idle',
        frame: 12,
        sourcePath: '/a/b/images/CIRCLE.png',
        canonicalW: 64,
        canonicalH: 64,
      } as unknown,
      {
        attachmentName: 'SQUARE',
        regionName: 'SQUARE',
        skinName: 'default',
        slotName: 'slot-square',
        sourceW: 64,
        sourceH: 64,
        worldW: 32,
        worldH: 32,
        peakScale: 0.5,
        animationName: 'idle',
        frame: 12,
        sourcePath: '/a/b/images/SQUARE.png',
        canonicalW: 64,
        canonicalH: 64,
      } as unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
    regions: [circle, square],
    animationBreakdown: [],
    orphanedFiles: [],
    skippedAttachments: [],
    elapsedMs: 5,
    editorFps: 30,
  } as unknown as SkeletonSummary;
}

/**
 * Echo-style resample stub. Tracks the two buckets across calls so that the
 * resample-on-toggle (resample useEffect deps include `loaderMode`) preserves
 * state on the renderer side after re-hydration. Mirrors the post-CR-01-fix
 * main-process per-bucket migration contract: the response carries BOTH
 * buckets back so the renderer's line-1656 sibling hydration can re-mount
 * them.
 *
 * Returns a function suitable for `vi.mocked(window.api.resampleProject).mockImplementation(...)`.
 *
 * Phase 36 CR-01 fix — pre-fix the renderer sent only the active bucket via
 * `args.overrides` and this stub routed by `args.loaderMode`, which is what
 * the broken main-side handler effectively did (and what hid the bug from
 * this test). Post-CR-01 the renderer sends BOTH buckets unconditionally
 * (`args.overrides` = atlas-source, `args.overridesAtlasLess` = atlas-less),
 * and main routes by bucket-NAME, not by `loaderMode`. The stub now mirrors
 * that contract.
 *
 * The caller seeds the initial state via `initial`. On each call, the stub:
 *   - Reads `args.overrides`           (atlas-source bucket).
 *   - Reads `args.overridesAtlasLess`  (atlas-less bucket; defaults to `{}`
 *                                       if the renderer omitted it).
 *   - Updates both buckets in `state` from the matching field.
 *   - Echoes BOTH buckets back via `restoredOverrides` + `restoredOverridesAtlasLess`.
 *
 * The closure variable can also be mutated externally between resample calls
 * (Test 3 uses this to force a SPECIFIC return shape for the samplingHz-change
 * call to confirm the renderer's line-1656 hydration site re-mounts the
 * inactive bucket from the response — not from local closure state).
 */
function makeResampleEcho(initial: {
  overrides: Record<string, number>;
  overridesAtlasLess: Record<string, number>;
}): {
  impl: (args: ResampleArgs) => Promise<OpenResponse>;
  state: { overrides: Record<string, number>; overridesAtlasLess: Record<string, number> };
} {
  const state = {
    overrides: { ...initial.overrides },
    overridesAtlasLess: { ...initial.overridesAtlasLess },
  };
  const impl = (args: ResampleArgs): Promise<OpenResponse> => {
    // Phase 36 CR-01 fix — route by bucket-name, NOT by loaderMode. Both
    // buckets are sent on every call; mirror what the production main-side
    // handler now does.
    state.overrides = { ...args.overrides };
    state.overridesAtlasLess = { ...(args.overridesAtlasLess ?? {}) };
    return Promise.resolve({
      ok: true,
      project: {
        summary: {
          ...makeSummary({
            atlasPath: args.loaderMode === 'atlas-less' ? null : '/a/b/SIMPLE.atlas',
          }),
          skeletonPath: args.skeletonPath,
        },
        restoredOverrides: { ...state.overrides },
        restoredOverridesAtlasLess: { ...state.overridesAtlasLess },
        staleOverrideKeys: [],
        migratedKeyCount: 0,
        samplingHz: args.samplingHz,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
        projectFilePath: args.projectFilePath,
        documentation: DEFAULT_DOCUMENTATION,
        loaderMode: args.loaderMode,
        sharpenOnExport: args.sharpenOnExport ?? false,
        safetyBufferPercent: args.safetyBufferPercent ?? 0,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  };
  return { impl, state };
}

beforeEach(() => {
  // Verbatim mirror of the IPC stub block from
  // tests/renderer/override-migration-banner.spec.tsx lines 59-107. AppShell
  // mount-time effects (preload subscriptions, menu hooks) touch every
  // member; omitting any one throws "is not a function" at render time.
  // resampleProject is set to a per-test mockImplementation downstream.
  vi.stubGlobal('api', {
    saveProject: vi
      .fn()
      .mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    saveProjectAs: vi
      .fn()
      .mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    openProject: vi.fn(),
    openProjectFromFile: vi.fn(),
    openProjectFromPath: vi.fn(),
    loadSkeletonFromFile: vi.fn(),
    locateSkeleton: vi.fn(),
    reloadProjectWithSkeleton: vi.fn(),
    onCheckDirtyBeforeQuit: vi.fn(() => () => undefined),
    confirmQuitProceed: vi.fn(),
    pickOutputDirectory: vi.fn(),
    startExport: vi.fn(),
    cancelExport: vi.fn(),
    onExportProgress: vi.fn(() => () => undefined),
    openOutputFolder: vi.fn(),
    probeExportConflicts: vi.fn(),
    notifyMenuState: vi.fn(),
    onMenuOpen: vi.fn(() => () => undefined),
    onMenuOpenRecent: vi.fn(() => () => undefined),
    onMenuSave: vi.fn(() => () => undefined),
    onMenuSaveAs: vi.fn(() => () => undefined),
    onMenuReloadProject: vi.fn(() => () => undefined),
    onMenuExport: vi.fn(() => () => undefined),
    onMenuCloseProject: vi.fn(() => () => undefined),
    onMenuShowInFolder: vi.fn(() => () => undefined),
    onMenuCopyPeakTable: vi.fn(() => () => undefined),
    onSamplerProgress: vi.fn(() => () => undefined),
    cancelSampler: vi.fn(),
    onMenuSettings: vi.fn(() => () => undefined),
    onMenuHelp: vi.fn(() => () => undefined),
    openExternalUrl: vi.fn(),
    // Default: ok:false. Each test overrides via mockImplementation to install
    // the bucket-echo behavior. The default is a safe no-op (the on:false
    // arm of the resample useEffect leaves state untouched).
    resampleProject: vi
      .fn()
      .mockResolvedValue({ ok: false, error: { kind: 'Unknown', message: 'no-op' } }),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    dismissUpdate: vi.fn(),
    quitAndInstallUpdate: vi.fn(),
    onUpdateAvailable: vi.fn(() => () => undefined),
    onUpdateDownloaded: vi.fn(() => () => undefined),
    onUpdateError: vi.fn(() => () => undefined),
    onUpdateProgress: vi.fn(() => () => undefined),
    onUpdateNotAvailable: vi.fn(() => () => undefined),
    onUpdateNone: vi.fn(() => () => undefined),
    onMenuCheckForUpdates: vi.fn(() => () => undefined),
    onMenuInstallationGuide: vi.fn(() => () => undefined),
    requestPendingUpdate: vi.fn().mockResolvedValue(null),
  });
  // jsdom polyfills required by the virtualized panel + AppShell mount-time
  // effects (mirrors tests/renderer/global-max-render-panel.spec.tsx
  // beforeAll). The panel uses TanStack useVirtualizer which reads
  // offsetHeight/scrollIntoView/ResizeObserver. Even at 2 rows < VIRTUALIZATION_THRESHOLD
  // (100), some of these are touched by the parent layout layer.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 800;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 600;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 800;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 600;
    },
  });
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function () {};
  }
});

/** Resolve the panel row `<tr>` for the given regionName via its selection checkbox. */
function rowFor(regionName: string): HTMLTableRowElement {
  const checkbox = screen.getByRole('checkbox', { name: `Select ${regionName}` });
  const row = checkbox.closest('tr');
  if (!row) throw new Error(`Could not find <tr> ancestor for region ${regionName}`);
  return row as HTMLTableRowElement;
}

/** True iff the row's Peak W×H cell carries the override-active title. */
function rowHasOverride(regionName: string): boolean {
  const row = rowFor(regionName);
  // The override-bearing cell is the Peak W×H `<td>` whose title starts with
  // "Override set •" (per src/renderer/src/panels/GlobalMaxRenderPanel.tsx:560).
  // We use a within(row) query so the assertion is scoped to the row.
  const matches = within(row).queryAllByTitle(/^Override set/);
  return matches.length > 0;
}

/** Open the loader-mode menu by clicking the "Load summary" chip. */
async function openLoaderMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  // The chip uses aria-label="Load summary" — stable selector since Phase 31
  // (tests/renderer/loader-mode-toggle-disabled.spec.tsx confirms). Note
  // that loader-mode-toggle-disabled.spec.tsx uses `fireEvent.click` on the
  // chip; our pattern uses `userEvent.click` for consistency with the rest
  // of this file (which models real user behavior — userEvent dispatches
  // pointerdown/pointerup/click + bubbles via the synthetic event system).
  const chip = screen.getByLabelText('Load summary');
  await user.click(chip);
}

/**
 * Open the OverrideDialog by double-clicking the CIRCLE row's Peak W×H cell,
 * type `percent` into the dialog's input, and click Apply.
 *
 * Uses `userEvent.dblClick` for the open step (real user behavior) and
 * `userEvent.clear` + `userEvent.type` for the input (per @testing-library
 * best practice).
 */
async function applyOverride(
  user: ReturnType<typeof userEvent.setup>,
  regionName: string,
  percent: number,
): Promise<void> {
  const row = rowFor(regionName);
  // The Peak W×H cell is the FIRST cell carrying the "double-click to override"
  // title (when no override is set) or "double-click to edit" (when one is
  // already set). Match either via the shared "double-click to" prefix.
  const peakCell =
    within(row).queryByTitle(/double-click to override/) ??
    within(row).getByTitle(/double-click to edit/);
  await user.dblClick(peakCell);
  // OverrideDialog mounts a number input (role=spinbutton) — per
  // tests/renderer/override-dialog-empty-input.spec.tsx pattern.
  const input = (await screen.findByRole('spinbutton')) as HTMLInputElement;
  await user.clear(input);
  await user.type(input, String(percent));
  const applyBtn = screen.getByRole('button', { name: /^Apply$/ });
  await user.click(applyBtn);
}

/**
 * Build an `initialProject` literal compatible with the AppShell prop. Cast
 * via the existing migration-banner-spec idiom (`OpenResponse extends ... ? P : never`).
 */
function makeInitialProject(opts: {
  summary: SkeletonSummary;
  restoredOverrides?: Record<string, number>;
  restoredOverridesAtlasLess?: Record<string, number>;
  loaderMode?: 'auto' | 'atlas-less';
}): unknown {
  return {
    summary: opts.summary,
    restoredOverrides: opts.restoredOverrides ?? {},
    restoredOverridesAtlasLess: opts.restoredOverridesAtlasLess ?? {},
    staleOverrideKeys: [],
    migratedKeyCount: 0,
    samplingHz: 120,
    lastOutDir: null,
    sortColumn: null,
    sortDir: null,
    projectFilePath: '/a/b/proj.stmproj',
    documentation: DEFAULT_DOCUMENTATION,
    loaderMode: opts.loaderMode ?? 'auto',
    sharpenOnExport: false,
    safetyBufferPercent: 0,
  };
}

describe('Phase 36 OVR-07 — AppShell mode-switch divergence', () => {
  it('atlas-source override does NOT leak into atlas-less bucket when toggling modes', async () => {
    const user = userEvent.setup();
    const summary = makeSummary();
    const echo = makeResampleEcho({ overrides: {}, overridesAtlasLess: {} });
    (window.api.resampleProject as ReturnType<typeof vi.fn>).mockImplementation(echo.impl);

    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          makeInitialProject({ summary, loaderMode: 'auto' }) as unknown as OpenResponse extends {
            ok: true;
            project: infer P;
          }
            ? P
            : never
        }
      />,
    );

    // Step 1 — atlas-source mode active (loaderMode === 'auto', summary.atlasPath !== null).
    // CIRCLE row should have NO override yet.
    expect(rowHasOverride('CIRCLE')).toBe(false);

    // Step 2 — apply override 50% in atlas-source mode.
    await applyOverride(user, 'CIRCLE', 50);

    // Assert post-Apply: CIRCLE row shows the override-active title.
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(true));

    // Step 3 — toggle to atlas-less mode via the toolbar.
    await openLoaderMenu(user);
    const toggleBtn = screen.getByRole('button', { name: 'Use Images Folder as Source' });
    await user.click(toggleBtn);

    // Step 4 — wait for the resample-on-toggle to settle. Stub preserves
    // both buckets via the echo closure.
    await waitFor(() =>
      expect((window.api.resampleProject as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        0,
      ),
    );
    // Give React a chance to flush the resample-response setState batch.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Step 5 — CIRCLE row in atlas-less mode shows NO override (the
    // atlas-source 50% did NOT leak into the atlas-less bucket).
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(false));
  });

  it('atlas-less override does NOT overwrite atlas-source bucket when toggling modes', async () => {
    const user = userEvent.setup();
    const summary = makeSummary();
    // Seed the atlas-source bucket with CIRCLE: 50 pre-mount.
    const echo = makeResampleEcho({
      overrides: { CIRCLE: 50 },
      overridesAtlasLess: {},
    });
    (window.api.resampleProject as ReturnType<typeof vi.fn>).mockImplementation(echo.impl);

    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          makeInitialProject({
            summary,
            restoredOverrides: { CIRCLE: 50 },
            restoredOverridesAtlasLess: {},
            loaderMode: 'auto',
          }) as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );

    // atlas-source mode shows CIRCLE override (pre-seeded).
    expect(rowHasOverride('CIRCLE')).toBe(true);

    // Toggle to atlas-less.
    await openLoaderMenu(user);
    const toAtlasLess = screen.getByRole('button', { name: 'Use Images Folder as Source' });
    await user.click(toAtlasLess);

    await waitFor(() =>
      expect((window.api.resampleProject as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        0,
      ),
    );
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // CIRCLE row in atlas-less should have NO override yet (atlas-less bucket
    // started empty; mode-switch does not auto-copy per D-13/SEED-007 3-A).
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(false));

    // Apply override 75% in atlas-less.
    await applyOverride(user, 'CIRCLE', 75);
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(true));

    // Toggle back to atlas-source. After the resample, the renderer should
    // re-hydrate BOTH buckets from the echo response:
    //   - overrides = { CIRCLE: 50 }   (pre-existing atlas-source value preserved)
    //   - overridesAtlasLess = { CIRCLE: 75 }
    await openLoaderMenu(user);
    const toAtlasSource = screen.getByRole('button', { name: 'Use Atlas as Source' });
    await user.click(toAtlasSource);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Assertion: atlas-source CIRCLE still shows an override (the 50% value,
    // preserved across the toggle round-trip). The negative assertion below
    // confirms the atlas-less 75% did not bleed into the atlas-source view.
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(true));
    // Closure-state sanity: the stub's atlas-source bucket (which mirrors
    // what main-process project-io.ts holds at the resample seam) still
    // carries the 50% value — the user's atlas-less 75% never touched the
    // atlas-source bucket on either renderer or stub side.
    expect(echo.state.overrides.CIRCLE).toBe(50);
  });

  it('samplingHz change preserves the inactive-mode bucket (regression catcher for AppShell.tsx:1542 hydration site, per blocker review 2026-05-13)', async () => {
    const user = userEvent.setup();
    const summary = makeSummary();

    // Seed atlas-less bucket with CIRCLE: 75 pre-mount. Atlas-source empty.
    const echo = makeResampleEcho({
      overrides: {},
      overridesAtlasLess: { CIRCLE: 75 },
    });
    (window.api.resampleProject as ReturnType<typeof vi.fn>).mockImplementation(echo.impl);

    // Capture the onMenuSettings handler so the test can open the
    // SettingsDialog (the same path the native menu's Edit→Preferences
    // takes). Mirrors the appShellMenuRef pattern in
    // tests/renderer/override-migration-banner.spec.tsx line ~340.
    let menuSettingsHandler: (() => void) | null = null;
    (window.api.onMenuSettings as ReturnType<typeof vi.fn>).mockImplementation(
      (handler: () => void) => {
        menuSettingsHandler = handler;
        return () => undefined;
      },
    );

    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          makeInitialProject({
            summary,
            restoredOverrides: {},
            restoredOverridesAtlasLess: { CIRCLE: 75 },
            loaderMode: 'auto',
          }) as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );

    // Initial state: atlas-source mode active, atlas-source bucket empty,
    // atlas-less bucket seeded with CIRCLE: 75. activeOverrides = overrides
    // = {} → CIRCLE row shows NO override in the panel.
    expect(rowHasOverride('CIRCLE')).toBe(false);

    // Toggle to atlas-less to confirm the seed propagated.
    await openLoaderMenu(user);
    let toAtlasLess = screen.getByRole('button', { name: 'Use Images Folder as Source' });
    await user.click(toAtlasLess);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(true));

    // Toggle back to atlas-source. The samplingHz change we will trigger
    // next must preserve the now-inactive atlas-less bucket.
    await openLoaderMenu(user);
    const toAtlasSource = screen.getByRole('button', { name: 'Use Atlas as Source' });
    await user.click(toAtlasSource);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Atlas-source CIRCLE has no override; atlas-less still seeded with 75
    // in the echo closure.
    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(false));
    expect(echo.state.overridesAtlasLess.CIRCLE).toBe(75);

    // Now install a SPECIFIC mock response for the next call only — the
    // samplingHz-change resample. The tailored response confirms the
    // renderer hydrates the atlas-less bucket from the response payload
    // (the line-1542 sibling setOverridesAtlasLess hydration). If that line
    // were missing, the atlas-less bucket would be wiped here even though
    // the response carries it.
    const stubbedOpenResponse = {
      ok: true,
      project: {
        summary: {
          ...makeSummary({ atlasPath: '/a/b/SIMPLE.atlas' }),
          skeletonPath: summary.skeletonPath,
        },
        restoredOverrides: {},
        restoredOverridesAtlasLess: { CIRCLE: 75 },
        staleOverrideKeys: [],
        migratedKeyCount: 0,
        samplingHz: 60,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
        projectFilePath: '/a/b/proj.stmproj',
        documentation: DEFAULT_DOCUMENTATION,
        loaderMode: 'auto',
        sharpenOnExport: false,
        safetyBufferPercent: 0,
      },
    };
    (window.api.resampleProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      stubbedOpenResponse as unknown as OpenResponse,
    );

    // Open Settings via the menu IPC handler. The handler captures the
    // SettingsDialog's open state by calling `setSettingsOpen(true)`.
    expect(menuSettingsHandler).not.toBeNull();
    menuSettingsHandler!();
    await new Promise((r) => setTimeout(r, 0));

    // Change samplingHz from 120 to 60 via the SettingsDialog preset dropdown.
    // The select is labeled "Sampling rate" via the label-htmlFor association
    // at SettingsDialog.tsx:179-181 (htmlFor="settings-sampling-rate").
    const samplingSelect = (await screen.findByLabelText(/^Sampling rate$/i)) as HTMLSelectElement;
    await user.selectOptions(samplingSelect, '60');
    const applyBtn = await screen.findByRole('button', { name: /^Apply$/ });
    await user.click(applyBtn);

    // Wait for the samplingHz-change resample useEffect to fire and the
    // mocked response to settle. The mockResolvedValueOnce we installed
    // above is the one consumed here.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    // Toggle back to atlas-less and assert CIRCLE still shows the
    // pre-resample 75% override. If the line-1542 sibling
    // setOverridesAtlasLess hydration were missing, this assertion would
    // FAIL — the atlas-less bucket would be empty post-resample.
    await openLoaderMenu(user);
    toAtlasLess = screen.getByRole('button', { name: 'Use Images Folder as Source' });
    await user.click(toAtlasLess);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    await waitFor(() => expect(rowHasOverride('CIRCLE')).toBe(true));
  });
});
