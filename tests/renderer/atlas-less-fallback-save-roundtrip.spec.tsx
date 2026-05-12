// @vitest-environment jsdom
/**
 * Regression — atlas-less D-05 fallback save roundtrip.
 *
 * Root cause (see .planning/debug/atlas-mode-toggle-load-prio.md):
 *   When the loader hits the D-05 atlas-less fallback (no sibling .atlas at
 *   load time) the renderer's `loaderMode` state slot stays at its default
 *   `'auto'` because the user never explicitly toggled. AppShell's
 *   buildSessionState used to persist this slot verbatim, so the saved
 *   `.stmproj` carried { loaderMode: 'auto', atlasPath: null } — ambiguous
 *   on reload. If the user later restored a sibling `.atlas` and re-opened
 *   the project, the loader's D-07 branch (sibling .atlas readable →
 *   canonical) won, silently overriding the user's saved atlas-less view.
 *
 * Fix: AppShell.tsx buildSessionState now derives an `effectiveLoaderMode`
 * that promotes the D-05 fallback to explicit `'atlas-less'` when
 * `summary.atlasPath === null`, regardless of the React state slot.
 *
 * This spec locks the save-time contract:
 *   - A fresh-load atlas-less-fallback session (atlasPath=null, loaderMode
 *     state='auto') must save as { loaderMode: 'atlas-less', atlasPath: null }.
 *   - A normal atlas-source session must save as { loaderMode: 'auto',
 *     atlasPath: <path> } (unchanged behavior).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import type { MutableRefObject } from 'react';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary, SaveResponse } from '../../src/shared/types';

afterEach(cleanup);

type MenuRef = MutableRefObject<{
  onClickSave: () => Promise<SaveResponse>;
  onClickSaveAs: () => Promise<SaveResponse>;
  onClickReload: () => Promise<void>;
  onClickExport: () => Promise<void>;
  onClickShowInFolder: () => void;
  onClickCopyPeakTable: () => Promise<void>;
} | null>;

function makeAtlasLessFallbackSummary(): SkeletonSummary {
  // Mimics the loader's D-05 atlas-less fallback outcome: no sibling .atlas
  // at load time → resolvedAtlasPath=null, isAtlasLess=true. The renderer
  // receives this summary on a fresh DropZone load; loaderMode state stays
  // at 'auto' (initial useState) because the user never toggled.
  return {
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: null,
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: 'CIRCLE', skinName: 'default', slotName: 'slot-circle', sourceW: 64, sourceH: 64,
        worldW: 32, worldH: 32, peakScale: 0.5, animationName: 'idle', frame: 12, sourcePath: '/a/b/images/CIRCLE.png' } as any,
    ],
    regions: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { regionName: 'CIRCLE', attachmentName: 'CIRCLE', skinName: 'default', slotName: 'slot-circle', sourceW: 64, sourceH: 64,
        worldW: 32, worldH: 32, peakScale: 0.5, animationName: 'idle', frame: 12, sourcePath: '/a/b/images/CIRCLE.png',
        contributingAttachments: [{ attachmentName: 'CIRCLE', skinName: 'default', slotName: 'slot-circle', peakScale: 0.5, animationName: 'idle', time: 0, frame: 12, isSetupPosePeak: false }] } as any,
    ],
    animationBreakdown: [],
    elapsedMs: 5,
  } as unknown as SkeletonSummary;
}

function makeAtlasSourceSummary(): SkeletonSummary {
  const s = makeAtlasLessFallbackSummary();
  return { ...s, atlasPath: '/a/b/SIMPLE.atlas' } as SkeletonSummary;
}

beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    openProjectPicker: vi.fn().mockResolvedValue({ kind: 'cancelled' }),
    loadSkeletonFromPath: vi.fn(),
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
    resampleProject: vi.fn(),
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
    requestPendingUpdate: vi.fn().mockResolvedValue(null),
    isElevated: vi.fn().mockResolvedValue(false),
  });
});

describe('Atlas-less D-05 fallback save roundtrip', () => {
  it('atlas-less fallback session (summary.atlasPath=null, loaderMode state=auto) saves as loaderMode=atlas-less', async () => {
    const summary = makeAtlasLessFallbackSummary();
    const menuRef = createRef() as MenuRef;
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <AppShell summary={summary} samplingHz={120} appShellMenuRef={menuRef} {...({} as any)} />,
    );

    // Fire Save As via the same menu-register surface the File menu uses.
    // No initialProject prop → loaderMode state defaults to 'auto' (the
    // exact production scenario for a fresh DropZone-load fallback).
    expect(menuRef.current).not.toBeNull();
    await menuRef.current!.onClickSaveAs();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    expect(api.saveProjectAs).toHaveBeenCalledTimes(1);
    const persistedState = api.saveProjectAs.mock.calls[0][0] as {
      loaderMode: 'auto' | 'atlas-less';
      atlasPath: string | null;
    };

    // The fix: effectiveLoaderMode = (loaderMode==='atlas-less' || summary.atlasPath===null)
    // promotes the fallback to explicit 'atlas-less' even though the React
    // state slot is still 'auto'.
    expect(persistedState.loaderMode).toBe('atlas-less');
    expect(persistedState.atlasPath).toBeNull();
  });

  it('atlas-source session (summary.atlasPath set, loaderMode state=auto) saves as loaderMode=auto with atlasPath (unchanged)', async () => {
    // Sanity-check the other side of the ternary — the fix must NOT
    // regress the canonical atlas-source path. When summary.atlasPath is
    // a real string and loaderMode is 'auto', the saved file should still
    // carry { loaderMode: 'auto', atlasPath: '<path>' }.
    const summary = makeAtlasSourceSummary();
    const menuRef = createRef() as MenuRef;
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <AppShell summary={summary} samplingHz={120} appShellMenuRef={menuRef} {...({} as any)} />,
    );

    expect(menuRef.current).not.toBeNull();
    await menuRef.current!.onClickSaveAs();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    const persistedState = api.saveProjectAs.mock.calls[0][0] as {
      loaderMode: 'auto' | 'atlas-less';
      atlasPath: string | null;
    };
    expect(persistedState.loaderMode).toBe('auto');
    expect(persistedState.atlasPath).toBe('/a/b/SIMPLE.atlas');
  });
});
