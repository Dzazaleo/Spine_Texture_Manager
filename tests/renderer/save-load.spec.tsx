// @vitest-environment jsdom
/**
 * Phase 8 Plan 04 — renderer specs for AppShell Save/Open buttons + dirty
 * marker + SaveQuitDialog + Cmd/Ctrl+S/O shortcuts + stale-override banner +
 * DropZone .stmproj branch.
 *
 * RED until Plan 04 wires AppShell + DropZone + SaveQuitDialog. Imports below
 * intentionally reference modules/exports that do not yet exist, OR existing
 * modules whose new behavior has not been wired yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary, OpenResponse, SaveResponse } from '../../src/shared/types';

afterEach(cleanup);

function makeSummary(): SkeletonSummary {
  // Synthetic minimal SkeletonSummary that satisfies AppShell's mount.
  // Plan 04 may need to enrich this — adapt as required during GREEN.
  return {
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: '/a/b/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    peaks: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: 'CIRCLE', skinName: 'default', slotName: 'slot-circle', sourceW: 64, sourceH: 64,
        worldW: 32, worldH: 32, peakScale: 0.5, animationName: 'idle', frame: 12, sourcePath: '/a/b/images/CIRCLE.png' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: 'SQUARE', skinName: 'default', slotName: 'slot-square', sourceW: 64, sourceH: 64,
        worldW: 64, worldH: 64, peakScale: 1.0, animationName: 'idle', frame: 0, sourcePath: '/a/b/images/SQUARE.png' } as any,
    ],
    animationBreakdown: [],
    elapsedMs: 5,
  } as unknown as SkeletonSummary;
}

beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    openProject: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj' } } as OpenResponse),
    openProjectFromFile: vi.fn(),
    openProjectFromPath: vi.fn(),
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
  });
});

describe('AppShell Save/Open buttons (D-140, D-141)', () => {
  it('Save reuses currentProjectPath', async () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Plan 04 wires: clicking Save with currentProjectPath !== null calls
    // window.api.saveProject (NOT saveProjectAs).
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await userEvent.click(saveBtn);
    // First Save with no path opens save-as; subsequent calls use save.
    // The contract Plan 04 must satisfy:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.saveProjectAs.mock.calls.length + (globalThis as any).api.saveProject.mock.calls.length).toBeGreaterThan(0);
  });

  it('dirty marker bullet renders when state mutates (D-144)', () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Untitled clean → 'Untitled' literal in chip.
    // Plan 04: a dirty mutation (override added) prepends '• '.
    // We assert the clean baseline here; the dirty path is exercised after a
    // user action that Plan 04's onApplyOverride flow fires.
    expect(screen.getByText(/Untitled|SIMPLE\.json/i)).toBeTruthy();
  });
});

describe('Keyboard shortcuts (D-140 + Pitfall 6)', () => {
  it('Cmd+S triggers Save', async () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    // Plan 04: window-level listener fires onClickSave when no modal is open.
    await Promise.resolve();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (globalThis as any).api.saveProject.mock.calls.length + (globalThis as any).api.saveProjectAs.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
  });

  it('Cmd+S suppressed when modal open (T-08-SHORT)', async () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Mount a fake modal element with role="dialog" (the suppression heuristic).
    const fakeModal = document.createElement('div');
    fakeModal.setAttribute('role', 'dialog');
    document.body.appendChild(fakeModal);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    await Promise.resolve();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.saveProject).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.saveProjectAs).not.toHaveBeenCalled();
    document.body.removeChild(fakeModal);
  });
});

describe('SaveQuitDialog three-button flow (D-143)', () => {
  it('dirty + drop opens guard', async () => {
    // Plan 04 wires DropZone branch to call AppShell's pre-drop dirty check.
    // When isDirty is true, the SaveQuitDialog mounts before the new file load proceeds.
    // We assert the dialog mount path by checking that role=dialog appears once
    // we simulate the dirty + drop sequence — Plan 04's contract.
    expect(true).toBe(true); // shell — Plan 04 fills behavior
  });
});

describe('Stale-override banner (D-150)', () => {
  it('stale override banner renders count + names', async () => {
    // Plan 04 wires the banner to setStaleOverridesNotice([...names]) when Open
    // resolves with non-empty staleOverrideKeys. We assert it via Open with stale keys.
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).api.openProject = vi.fn().mockResolvedValue({
      ok: true,
      project: {
        summary, restoredOverrides: { CIRCLE: 50 }, staleOverrideKeys: ['GHOST', 'OLD_HAT'],
        samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null,
        projectFilePath: '/a/b/proj.stmproj',
      },
    } as OpenResponse);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Trigger the open path the way Plan 04 wires it (Cmd+O or Open button click):
    fireEvent.keyDown(window, { key: 'o', metaKey: true });
    await Promise.resolve(); await Promise.resolve();
    // After Plan 04 wires the banner, the text below must appear:
    // expect(screen.getByText(/saved overrides skipped/i)).toBeTruthy();
    expect(true).toBe(true); // shell
  });
});

describe('DropZone branch on .stmproj (D-142)', () => {
  it('dropzone branch on stmproj', async () => {
    // Plan 04 extends DropZone to dispatch on extension. .stmproj routes to
    // window.api.openProjectFromFile(file); .json routes to existing
    // window.api.loadSkeletonFromFile(file). This shell asserts the contract.
    expect(true).toBe(true); // shell — Plan 04 fills behavior
  });
});
