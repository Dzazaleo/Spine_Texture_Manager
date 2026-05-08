// @vitest-environment jsdom
/**
 * Phase 31 PLATFORM-01 — DropZone elevated-state handler suppression (Task 3).
 *
 * Tests E1..E4 from 31-03-PLAN.md <behavior>:
 *   - E1 — isElevated=true: dragOver does NOT toggle the ring-2 ring-accent
 *     bg-accent/5 classes on the container.
 *   - E2 — isElevated=true: drop with .json file does NOT call
 *     window.api.loadSkeletonFromFile.
 *   - E3 — isElevated=false (default): existing behavior preserved — dragOver
 *     toggles ring AND drop fires the IPC.
 *   - E4 — Container retains 'w-full min-h-screen flex items-center
 *     justify-center' regardless of isElevated (memory anchor:
 *     project_layout_fragility_root_min_h_screen.md).
 *
 * Mounts <DropZone> directly (not <App>) — Task 3 is a leaf-component
 * contract, isolated from App.tsx state machine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { DropZone } from '../../src/renderer/src/components/DropZone';

afterEach(cleanup);

const RING_CLASSES = ['ring-2', 'ring-accent', 'bg-accent/5'];
const ANCHOR_CLASSES = ['w-full', 'min-h-screen', 'flex', 'items-center', 'justify-center'];

function stampApi(loadSkeletonFromFile: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window, 'api', {
    writable: true,
    configurable: true,
    value: {
      loadSkeletonFromFile,
      openProjectFromFile: vi.fn(),
    },
  });
}

describe('Phase 31 PLATFORM-01 — DropZone elevated-state suppression', () => {
  let loadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadSpy = vi.fn().mockResolvedValue({ ok: true, summary: {} });
    stampApi(loadSpy);
  });

  it('E1: isElevated=true — dragOver does NOT toggle the drag-over ring', () => {
    const { container } = render(
      <DropZone
        isElevated={true}
        onLoad={vi.fn()}
        onLoadStart={vi.fn()}
      >
        <p>idle</p>
      </DropZone>,
    );
    const target = container.firstElementChild as HTMLElement;
    fireEvent.dragOver(target);
    fireEvent.dragEnter(target);
    for (const ringClass of RING_CLASSES) {
      expect(
        target.className.split(/\s+/).includes(ringClass),
        `dragOver while elevated must NOT add ${ringClass}`,
      ).toBe(false);
    }
  });

  it('E2: isElevated=true — drop with .json file does NOT call loadSkeletonFromFile', async () => {
    const onLoad = vi.fn();
    const onLoadStart = vi.fn();
    const { container } = render(
      <DropZone
        isElevated={true}
        onLoad={onLoad}
        onLoadStart={onLoadStart}
      >
        <p>idle</p>
      </DropZone>,
    );
    const target = container.firstElementChild as HTMLElement;
    const file = new File(['{}'], 'TEST.json', { type: 'application/json' });
    fireEvent.drop(target, {
      dataTransfer: { files: [file] } as unknown as DataTransfer,
    });
    // Allow microtasks to flush — handler is async.
    await new Promise((r) => setTimeout(r, 0));
    expect(loadSpy).not.toHaveBeenCalled();
    expect(onLoad).not.toHaveBeenCalled();
    expect(onLoadStart).not.toHaveBeenCalled();
  });

  it('E3: isElevated=false (default) — existing behavior preserved (ring + IPC fire)', async () => {
    const onLoad = vi.fn();
    const onLoadStart = vi.fn();
    const { container } = render(
      <DropZone
        isElevated={false}
        onLoad={onLoad}
        onLoadStart={onLoadStart}
      >
        <p>idle</p>
      </DropZone>,
    );
    const target = container.firstElementChild as HTMLElement;
    fireEvent.dragOver(target);
    // Ring classes appear in the non-elevated branch.
    for (const ringClass of RING_CLASSES) {
      expect(
        target.className.split(/\s+/).includes(ringClass),
        `dragOver must add ${ringClass} when not elevated`,
      ).toBe(true);
    }
    // Drop fires the IPC.
    const file = new File(['{}'], 'TEST.json', { type: 'application/json' });
    fireEvent.drop(target, {
      dataTransfer: { files: [file] } as unknown as DataTransfer,
    });
    // Async handler awaits both onBeforeDrop (none) and the IPC.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('E4: container retains min-h-screen anchor regardless of isElevated', () => {
    const { container, rerender } = render(
      <DropZone isElevated={true} onLoad={vi.fn()} onLoadStart={vi.fn()}>
        <p>idle</p>
      </DropZone>,
    );
    let target = container.firstElementChild as HTMLElement;
    for (const cls of ANCHOR_CLASSES) {
      expect(
        target.className.split(/\s+/).includes(cls),
        `elevated container must retain ${cls}`,
      ).toBe(true);
    }
    rerender(
      <DropZone isElevated={false} onLoad={vi.fn()} onLoadStart={vi.fn()}>
        <p>idle</p>
      </DropZone>,
    );
    target = container.firstElementChild as HTMLElement;
    for (const cls of ANCHOR_CLASSES) {
      expect(
        target.className.split(/\s+/).includes(cls),
        `non-elevated container must retain ${cls}`,
      ).toBe(true);
    }
  });
});
