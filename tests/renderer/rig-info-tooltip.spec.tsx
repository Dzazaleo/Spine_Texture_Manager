// @vitest-environment jsdom
/**
 * Phase 9 Plan 06 Task 2 — Wave 4 GREEN tests for the RigInfoTooltip on the
 * AppShell filename chip.
 *
 * Behavior claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 17: Tooltip — fps labeling (skeleton.fps: <N> (editor metadata — does not affect sampling))
 *     plus bones/slots/attachments/animations/skins counts matching the summary shape.
 *
 * The wording "(editor metadata — does not affect sampling)" is **load-bearing**
 * per CLAUDE.md fact #1 + the canonical comment block at src/core/sampler.ts:41-44.
 * Plan 06 must surface this exactly so animators are not misled into thinking
 * skeleton.fps drives sampling.
 *
 * Wave 4 GREEN: replaces the Wave 0 RED scaffolds. We render the full AppShell
 * (the chip is part of AppShell's header at :830-838 pre-Plan-06) with the
 * window.api preload surface stubbed out — AppShell's mount-time effects need
 * notifyMenuState / onMenuOpen / onSamplerProgress / onMenuSettings to be
 * present as functions or it throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary } from '../../src/shared/types';

afterEach(cleanup);

beforeEach(() => {
  // Stub the preload surface AppShell touches at mount. Every method must be
  // either an unsub-returning subscription or a vi.fn() — any missing field
  // throws "is not a function" at AppShell's first render. Mirror save-load.spec.tsx:44-76.
  vi.stubGlobal('api', {
    notifyMenuState: vi.fn(),
    onMenuOpen: vi.fn(() => () => undefined),
    onMenuOpenRecent: vi.fn(() => () => undefined),
    onMenuSave: vi.fn(() => () => undefined),
    onMenuSaveAs: vi.fn(() => () => undefined),
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
    // Phase 12 Plan 01 — auto-update preload surface (UPD-01..UPD-06).
    // AppShell mounts a useEffect that subscribes to all five on* methods
    // at first render — every method must be present (returning unsub fn)
    // or React throws 'is not a function' on the useEffect commit.
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

function makeSummary(): SkeletonSummary {
  return {
    skeletonPath: '/abs/path/to/SIMPLE_TEST.json',
    atlasPath: '/abs/path/to/SIMPLE_TEST.atlas',
    bones: { count: 12, names: [] },
    slots: { count: 5 },
    attachments: { count: 8, byType: { RegionAttachment: 8 } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 3, names: [] },
    // Phase 20 D-09 — events field added to SkeletonSummary in Plan 20-01.
    events: { count: 0, names: [] },
    peaks: [],
    animationBreakdown: [],
    unusedAttachments: [],
    elapsedMs: 42,
    editorFps: 30,
  };
}

describe('RigInfoTooltip — Wave 4 (Claude Discretion: rig-info on filename chip)', () => {
  it('hover filename chip: tooltip becomes visible with skeletonName + bones/slots/attachments/animations/skins counts matching summary', () => {
    render(<AppShell summary={makeSummary()} samplingHz={120} />);
    // The filename chip text reads 'Untitled' for fresh sessions; the rig-info
    // tooltip surface is NOT the chip itself — Plan 06 wraps the chip in a
    // hoverable container (data-testid='rig-info-host' for unambiguous targeting).
    const chipHost = screen.getByTestId('rig-info-host');
    fireEvent.mouseEnter(chipHost);
    const tooltip = screen.getByRole('tooltip');
    const text = tooltip.textContent ?? '';
    expect(text).toMatch(/SIMPLE_TEST\.json/);
    expect(text).toMatch(/bones:\s*12/);
    expect(text).toMatch(/slots:\s*5/);
    expect(text).toMatch(/attachments:\s*8/);
    expect(text).toMatch(/animations:\s*3/);
    expect(text).toMatch(/skins:\s*1/);

    // Leaving the host hides the tooltip again.
    fireEvent.mouseLeave(chipHost);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('skeleton.fps line reads exactly: "skeleton.fps: <N> (editor metadata — does not affect sampling)"', () => {
    render(<AppShell summary={makeSummary()} samplingHz={120} />);
    const chipHost = screen.getByTestId('rig-info-host');
    fireEvent.mouseEnter(chipHost);
    const tooltip = screen.getByRole('tooltip');
    // CRITICAL wording per CLAUDE.md fact #1 + src/core/sampler.ts:41-44 canonical comment.
    expect(tooltip.textContent).toMatch(
      /skeleton\.fps:\s*30\s*\(editor metadata — does not affect sampling\)/,
    );
  });
});
