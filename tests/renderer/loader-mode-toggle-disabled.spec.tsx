// @vitest-environment jsdom
/**
 * Phase 31 LOAD-05/LOAD-06/LOAD-07 — source-toggle disabled state tests.
 *
 * Behavioral contract under test:
 *
 *   A1. atlas-source mode (summary.atlasPath !== null) AND
 *       summary.hasImagesDir === false → opening the loader menu reveals
 *       the "Use Images Folder as Source" item with `disabled` set; native
 *       title="No images/ folder found in this project's folder"; click is
 *       a no-op.
 *
 *   A2. atlas-less mode  (summary.atlasPath === null)  AND
 *       summary.hasAtlasFile === false → opening the loader menu reveals
 *       the "Use Atlas as Source" item with `disabled` set; native
 *       title="No .atlas file found in this project's folder"; click is
 *       a no-op.
 *
 *   A3. atlas-source mode + summary.hasImagesDir === true → menu item
 *       enabled; no `title` attribute; click changes loaderMode (existing
 *       behavior preserved — verified indirectly by absence of `disabled`).
 *
 *   A4. atlas-less mode  + summary.hasAtlasFile === true  → enabled +
 *       no title.
 *
 *   A5. aria-disabled="true" is mirrored to the `disabled` attribute
 *       (AT contract per UI-SPEC three-redundant-signals).
 *
 * Tests follow the AppShell test scaffolding pattern from
 * tests/renderer/save-load.spec.tsx (window.api stub + minimal summary).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary } from '../../src/shared/types';

afterEach(cleanup);

beforeEach(() => {
  // Mirrors the rig-info-tooltip stub list — AppShell mount-time effects
  // touch every preload method, throwing "is not a function" on misses.
  vi.stubGlobal('api', {
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
    onMenuSettings: vi.fn(() => () => undefined),
    onMenuHelp: vi.fn(() => () => undefined),
    onSamplerProgress: vi.fn(() => () => undefined),
    onCheckDirtyBeforeQuit: vi.fn(() => () => undefined),
    cancelSampler: vi.fn(),
    confirmQuitProceed: vi.fn(),
    openExternalUrl: vi.fn(),
    resampleProject: vi.fn(),
    pickOutputDirectory: vi.fn(),
    startExport: vi.fn(),
    cancelExport: vi.fn(),
    onExportProgress: vi.fn(() => () => undefined),
    openOutputFolder: vi.fn(),
    probeExportConflicts: vi.fn(),
    saveProject: vi.fn(),
    saveProjectAs: vi.fn(),
    openProject: vi.fn(),
    openProjectFromFile: vi.fn(),
    openProjectFromPath: vi.fn(),
    locateSkeleton: vi.fn(),
    reloadProjectWithSkeleton: vi.fn(),
    loadSkeletonFromFile: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    dismissUpdate: vi.fn(),
    quitAndInstallUpdate: vi.fn(),
    onUpdateAvailable: vi.fn(() => () => undefined),
    onUpdateDownloaded: vi.fn(() => () => undefined),
    onUpdateNone: vi.fn(() => () => undefined),
    onUpdateError: vi.fn(() => () => undefined),
    onMenuCheckForUpdates: vi.fn(() => () => undefined),
    onMenuInstallationGuide: vi.fn(() => () => undefined),
  });
});

interface SummaryOverrides {
  atlasPath: string | null;
  hasAtlasFile: boolean;
  hasImagesDir: boolean;
}

function makeSummary(o: SummaryOverrides): SkeletonSummary {
  return {
    skeletonPath: '/abs/path/to/SIMPLE_TEST.json',
    atlasPath: o.atlasPath,
    hasAtlasFile: o.hasAtlasFile,
    hasImagesDir: o.hasImagesDir,
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: [],
    regions: [],
    animationBreakdown: [],
    skippedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  } as unknown as SkeletonSummary;
}

/** Open the loader-mode menu by clicking the "Load summary" chip. */
function openLoaderMenu(): void {
  const chip = screen.getByLabelText('Load summary');
  fireEvent.click(chip);
}

describe('Phase 31 LOAD-05/06/07 — source-toggle disabled state', () => {
  it('A1: atlas-source mode + hasImagesDir=false → menu item disabled with verbatim title', () => {
    render(
      <AppShell
        summary={makeSummary({
          atlasPath: '/abs/path/to/SIMPLE_TEST.atlas',
          hasAtlasFile: true,
          hasImagesDir: false,
        })}
        samplingHz={120}
      />,
    );
    openLoaderMenu();

    const item = screen.getByRole('button', {
      name: 'Use Images Folder as Source',
    }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.getAttribute('title')).toBe(
      "No images/ folder found in this project's folder",
    );
  });

  it('A2: atlas-less mode + hasAtlasFile=false → menu item disabled with verbatim title', () => {
    render(
      <AppShell
        summary={makeSummary({
          atlasPath: null,
          hasAtlasFile: false,
          hasImagesDir: true,
        })}
        samplingHz={120}
      />,
    );
    openLoaderMenu();

    const item = screen.getByRole('button', {
      name: 'Use Atlas as Source',
    }) as HTMLButtonElement;
    expect(item.disabled).toBe(true);
    expect(item.getAttribute('title')).toBe(
      "No .atlas file found in this project's folder",
    );
  });

  it('A3: atlas-source mode + hasImagesDir=true → menu item enabled, no title attribute', () => {
    render(
      <AppShell
        summary={makeSummary({
          atlasPath: '/abs/path/to/SIMPLE_TEST.atlas',
          hasAtlasFile: true,
          hasImagesDir: true,
        })}
        samplingHz={120}
      />,
    );
    openLoaderMenu();

    const item = screen.getByRole('button', {
      name: 'Use Images Folder as Source',
    }) as HTMLButtonElement;
    expect(item.disabled).toBe(false);
    // jsdom returns null when the attribute is undefined / not set.
    expect(item.getAttribute('title')).toBeNull();
  });

  it('A4: atlas-less mode + hasAtlasFile=true → menu item enabled, no title attribute', () => {
    render(
      <AppShell
        summary={makeSummary({
          atlasPath: null,
          hasAtlasFile: true,
          hasImagesDir: true,
        })}
        samplingHz={120}
      />,
    );
    openLoaderMenu();

    const item = screen.getByRole('button', {
      name: 'Use Atlas as Source',
    }) as HTMLButtonElement;
    expect(item.disabled).toBe(false);
    expect(item.getAttribute('title')).toBeNull();
  });

  it('A5: aria-disabled mirrors disabled state in both alt-source-missing branches', () => {
    // atlas-source branch (alt = images, missing).
    const { unmount } = render(
      <AppShell
        summary={makeSummary({
          atlasPath: '/abs/path/to/SIMPLE_TEST.atlas',
          hasAtlasFile: true,
          hasImagesDir: false,
        })}
        samplingHz={120}
      />,
    );
    openLoaderMenu();
    const imagesItem = screen.getByRole('button', {
      name: 'Use Images Folder as Source',
    });
    expect(imagesItem.getAttribute('aria-disabled')).toBe('true');
    unmount();

    // atlas-less branch (alt = atlas, missing).
    render(
      <AppShell
        summary={makeSummary({
          atlasPath: null,
          hasAtlasFile: false,
          hasImagesDir: true,
        })}
        samplingHz={120}
      />,
    );
    openLoaderMenu();
    const atlasItem = screen.getByRole('button', {
      name: 'Use Atlas as Source',
    });
    expect(atlasItem.getAttribute('aria-disabled')).toBe('true');
  });
});
