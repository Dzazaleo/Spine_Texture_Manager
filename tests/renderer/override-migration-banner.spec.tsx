// @vitest-environment jsdom
/**
 * Phase 29 D-06 — AppShell migration banner tests.
 *
 * Sibling banner to staleOverrideNotice (Phase 8 D-150). Surfaces when the
 * load-time helper (src/main/override-migration.ts) translated v1.3-era
 * attachmentName-keyed overrides to v1.3.1+ regionName keys. Visual idiom
 * mirrors staleOverrideNotice; auto-clears on next successful Save.
 *
 * Test coverage:
 *   1. Banner renders with the correct count + pluralization.
 *   2. Singular form when migratedKeyCount === 1.
 *   3. Banner is dismissible — clicking Dismiss removes it.
 *   4. Banner does NOT render when migratedKeyCount === 0 (no migration).
 *   5. Auto-clears on next successful Save (Cmd+S onClickSave).
 *   6. Banner is sibling to (not replacing) the staleOverrideNotice — both can
 *      coexist when both stale + migrated keys land on the same load.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type {
  SkeletonSummary,
  OpenResponse,
  SaveResponse,
} from '../../src/shared/types';
import { DEFAULT_DOCUMENTATION } from '../../src/shared/types';

afterEach(cleanup);

function makeSummary(): SkeletonSummary {
  return {
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: '/a/b/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: 'CIRCLE', regionName: 'CIRCLE', skinName: 'default', slotName: 'slot-circle', sourceW: 64, sourceH: 64,
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

beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
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
    resampleProject: vi.fn().mockResolvedValue({ ok: false, error: { kind: 'Unknown', message: 'no-op' } }),
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
});

describe('Phase 29 D-06 — override migration banner (sibling to staleOverrideNotice)', () => {
  it('renders banner with plural copy when migratedKeyCount > 1', () => {
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: { CIRCLE: 50 },
            staleOverrideKeys: [],
            migratedKeyCount: 3,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    // The banner is a role=status element with the "Updated N overrides" copy.
    const banners = screen.getAllByRole('status');
    const migrationBanner = banners.find((el) =>
      /Updated 3 overrides to per-region keys/i.test(el.textContent ?? ''),
    );
    expect(migrationBanner, 'migration banner should mount').toBeTruthy();
  });

  it('renders banner with singular copy when migratedKeyCount === 1', () => {
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: { CIRCLE: 50 },
            staleOverrideKeys: [],
            migratedKeyCount: 1,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    const banners = screen.getAllByRole('status');
    const migrationBanner = banners.find((el) =>
      /Updated 1 override to per-region keys/i.test(el.textContent ?? ''),
    );
    expect(migrationBanner, 'singular migration banner should mount').toBeTruthy();
    // And explicitly NOT plural.
    const pluralBanner = banners.find((el) =>
      /Updated 1 overrides to per-region keys/i.test(el.textContent ?? ''),
    );
    expect(pluralBanner, 'plural form should NOT render for count === 1').toBeFalsy();
  });

  it('does NOT render banner when migratedKeyCount === 0', () => {
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: {},
            staleOverrideKeys: [],
            migratedKeyCount: 0,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    // No element should match the migration banner copy.
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/Updated \d+ override.*to per-region keys/i);
  });

  it('does NOT render banner when migratedKeyCount is missing/undefined (backward-compat)', () => {
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: {},
            staleOverrideKeys: [],
            // migratedKeyCount intentionally omitted to verify the
            // typeof-number guard in the useState initializer.
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/Updated \d+ override.*to per-region keys/i);
  });

  it('clicking Dismiss removes the migration banner', async () => {
    const user = userEvent.setup();
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: {},
            staleOverrideKeys: [],
            migratedKeyCount: 2,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    expect(document.body.textContent ?? '').toMatch(
      /Updated 2 overrides to per-region keys/i,
    );
    // The migration banner is the only role=status containing this copy;
    // its Dismiss button is the descendant button.
    const banners = screen.getAllByRole('status');
    const migrationBanner = banners.find((el) =>
      /Updated 2 overrides/i.test(el.textContent ?? ''),
    );
    expect(migrationBanner).toBeTruthy();
    const dismissBtn = migrationBanner!.querySelector('button');
    expect(dismissBtn).toBeTruthy();
    await user.click(dismissBtn!);
    // Banner gone after dismiss.
    expect(document.body.textContent ?? '').not.toMatch(
      /Updated 2 overrides to per-region keys/i,
    );
  });

  it('coexists with staleOverrideNotice when BOTH staleOverrideKeys and migratedKeyCount are populated', () => {
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: { CIRCLE: 50 },
            staleOverrideKeys: ['GHOST'],
            migratedKeyCount: 1,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    // Both banners present.
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/skipped — attachments no longer in skeleton:/i);
    expect(text).toContain('GHOST');
    expect(text).toMatch(/Updated 1 override to per-region keys/i);
  });

  it('auto-clears migration banner on next successful Save (menu File→Save)', async () => {
    // Phase 08.2 D-175 — Save is fired via the native menu's File→Save item,
    // which calls through appShellMenuRef.current.onClickSave(). The legacy
    // Cmd+S window keydown listener was deleted (see save-load.spec.tsx
    // describe block at line 176). This test injects an appShellMenuRef and
    // dispatches the saved handler directly.
    const summary = makeSummary();
    const appShellMenuRef = { current: null } as unknown as React.MutableRefObject<{
      onClickSave: () => Promise<unknown>;
      onClickSaveAs: () => Promise<unknown>;
      onClickReload: () => Promise<void>;
      onClickExport: () => void;
      onClickShowInFolder: () => void;
      onClickCopyPeakTable: () => Promise<void>;
    } | null>;
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        appShellMenuRef={appShellMenuRef}
        initialProject={
          {
            summary,
            restoredOverrides: { CIRCLE: 50 },
            staleOverrideKeys: [],
            migratedKeyCount: 4,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    expect(document.body.textContent ?? '').toMatch(
      /Updated 4 overrides to per-region keys/i,
    );
    // Wait for the appShellMenuRef registration useEffect to flush
    // (mounts post-first-paint).
    await new Promise((r) => setTimeout(r, 0));
    expect(appShellMenuRef.current, 'menu ref must be registered').toBeTruthy();
    // Dispatch File → Save via the menu ref.
    await appShellMenuRef.current!.onClickSave();
    // setState committed inside onClickSave's success arm; flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.textContent ?? '').not.toMatch(
      /Updated 4 overrides to per-region keys/i,
    );
  });
});
