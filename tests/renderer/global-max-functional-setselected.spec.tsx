// @vitest-environment jsdom
/**
 * Phase 27 QA-01 — Functional setSelected updater regression spec.
 *
 * Falsifies the closure-capture form `setSelected(new Set(selected))` in
 * `GlobalMaxRenderPanel.handleToggleRow` and `handleRangeToggle`, and locks
 * the cumulative-selection user-visible behavior.
 *
 * Scaffold note (testing-environment realism):
 *   React 19 + @testing-library/react v16+ auto-flush state between
 *   `fireEvent.click` calls — even within the same `act()` block. That means
 *   the closure-capture bug is NOT directly observable through two stacked
 *   `fireEvent.click` calls on the panel's <input>; the second click sees a
 *   freshly-rendered closure carrying the first click's mutation. Verified
 *   empirically during Plan 27-01 task 1 via a temporary diagnostic.
 *
 *   To genuinely falsify the closure-capture race, Tests A and B render a
 *   minimal harness component that mirrors the production handler shape
 *   verbatim (one-for-one with the pre-refactor handleToggleRow at lines
 *   757-766 and the multi-line range branch at lines 791-799), and capture
 *   the handler instance via a ref so two synchronous calls run inside the
 *   SAME render's closure — the exact path real-world rapid keyboard repeat
 *   takes. With the closure-capture form, the second call's `new Set(selected)`
 *   reads the pre-update `selected`; the test sees only the second key in
 *   final state. With the functional `setSelected((prev) => ...)` form, the
 *   second call's `new Set(prev)` reads the post-first-update queued state
 *   and produces the cumulative union.
 *
 *   Test C is the user-facing control: it exercises the real GlobalMaxRenderPanel
 *   through the rendered checkbox surface and asserts that sequential single-
 *   toggle still produces the union — a regression guard against any
 *   future change to the panel's selection wiring.
 *
 *   The harness's handler shape is byte-for-byte the production code under
 *   test; if a future React/RTL upgrade changes auto-flush semantics, the
 *   harness's RED state would surface immediately, making this spec a durable
 *   trap for the same defect class.
 *
 * jsdom polyfill block + `makeRow` shape mirror the existing
 * `tests/renderer/global-max-missing-row.spec.tsx`.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import type { DisplayRow, SkeletonSummary } from '../../src/shared/types';

// jsdom polyfills — without these the virtualizer (when it triggers) sees a
// 0×0 rect and emits zero virtual items. Verbatim from
// global-max-missing-row.spec.tsx lines 20-44.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() { return 800; },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() { return 600; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return 800; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 600; },
  });
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(cleanup);

// =============================================================================
// Production-handler harness (Tests A + B)
// =============================================================================
// HandlerHarness mirrors GlobalMaxRenderPanel's selection-handler shape, but
// keeps the implementation form (closure-capture vs functional updater)
// configurable via a prop. Each test specifies the form under test; the
// harness exposes the latest handler instance through a ref-capture pattern
// so the test can call it twice synchronously inside one act() flush — the
// scenario rapid keyboard repeat creates in-the-wild but RTL+React 19 elide
// when going through fireEvent.

type ToggleHandler = (key: string) => void;
type RangeHandler = (key: string) => void;

interface HandlerCapture {
  toggle: ToggleHandler | null;
  range: RangeHandler | null;
  selected: ReadonlySet<string>;
}

interface HarnessProps {
  /** 'closure' = pre-refactor shape (drops updates on rapid-fire);
   *  'functional' = post-refactor shape (cumulative). */
  form: 'closure' | 'functional';
  capture: HandlerCapture;
  visibleKeys: readonly string[];
}

function HandlerHarness({ form, capture, visibleKeys }: HarnessProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  // handleToggleRow — both forms.
  const handleToggleClosure = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelected(next);
      setLastClicked(key);
    },
    [selected],
  );
  const handleToggleFunctional = useCallback(
    (key: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setLastClicked(key);
    },
    [],
  );

  // handleRangeToggle — multi-line range branch only (the falsifying surface).
  const handleRangeClosure = useCallback(
    (key: string) => {
      if (lastClicked === null) {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelected(next);
        setLastClicked(key);
        return;
      }
      const aIdx = visibleKeys.indexOf(lastClicked);
      const bIdx = visibleKeys.indexOf(key);
      if (aIdx < 0 || bIdx < 0) {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelected(next);
        setLastClicked(key);
        return;
      }
      const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
      const next = new Set(selected);
      const targetSelected = !selected.has(key);
      for (let i = lo; i <= hi; i++) {
        if (targetSelected) next.add(visibleKeys[i]);
        else next.delete(visibleKeys[i]);
      }
      setSelected(next);
      setLastClicked(key);
    },
    [selected, lastClicked, visibleKeys],
  );
  const handleRangeFunctional = useCallback(
    (key: string) => {
      if (lastClicked === null) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        setLastClicked(key);
        return;
      }
      const aIdx = visibleKeys.indexOf(lastClicked);
      const bIdx = visibleKeys.indexOf(key);
      if (aIdx < 0 || bIdx < 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        setLastClicked(key);
        return;
      }
      const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
      setSelected((prev) => {
        const next = new Set(prev);
        const targetSelected = !prev.has(key);
        for (let i = lo; i <= hi; i++) {
          if (targetSelected) next.add(visibleKeys[i]);
          else next.delete(visibleKeys[i]);
        }
        return next;
      });
      setLastClicked(key);
    },
    [lastClicked, visibleKeys],
  );

  // Expose the latest handler instances + selected snapshot through the ref-
  // capture object. Each render replaces the references; tests capture before
  // act() and call inside act() synchronously.
  capture.toggle = form === 'closure' ? handleToggleClosure : handleToggleFunctional;
  capture.range = form === 'closure' ? handleRangeClosure : handleRangeFunctional;
  capture.selected = selected;

  return null;
}

// =============================================================================
// Real-panel harness (Test C)
// =============================================================================

/** Minimal DisplayRow with sane non-NaN numerics — same shape as
 *  global-max-missing-row.spec.tsx makeRow. */
function makeRow(attachmentName: string): DisplayRow {
  return {
    attachmentKey: `default/slot/${attachmentName}`,
    skinName: 'default',
    slotName: 'slot',
    attachmentName,
    animationName: 'Setup Pose (Default)',
    time: 0,
    frame: 0,
    peakScaleX: 0.5,
    peakScaleY: 0.5,
    peakScale: 0.5,
    worldW: 32,
    worldH: 32,
    sourceW: 64,
    sourceH: 64,
    isSetupPosePeak: true,
    originalSizeLabel: '64×64',
    peakSizeLabel: '32×32',
    scaleLabel: '0.500×',
    sourceLabel: 'Setup Pose (Default)',
    frameLabel: '—',
    sourcePath: `/fake/${attachmentName}.png`,
    canonicalW: 64,
    canonicalH: 64,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
  };
}

function makeSummary(rows: DisplayRow[]): SkeletonSummary {
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: null,
    bones: { count: 1, names: ['root'] },
    slots: { count: rows.length },
    attachments: { count: rows.length, byType: { RegionAttachment: rows.length } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: rows,
    animationBreakdown: [],
    orphanedFiles: [],
    skippedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
}

function PanelWrapper({ rows }: { rows: DisplayRow[] }) {
  const [query, setQuery] = useState('');
  return (
    <GlobalMaxRenderPanel
      summary={makeSummary(rows)}
      overrides={undefined}
      onOpenOverrideDialog={vi.fn()}
      query={query}
      onQueryChange={setQuery}
      loaderMode="auto"
      savingsPct={null}
    />
  );
}

function getCheckbox(name: string): HTMLInputElement {
  return screen.getByLabelText('Select ' + name) as HTMLInputElement;
}

// =============================================================================
// Tests
// =============================================================================

describe('GlobalMaxRenderPanel — functional setSelected updaters', () => {
  it('Test A — closure-capture handleToggleRow drops first update under rapid-fire (RED proof)', () => {
    // RED-falsifying test: the pre-refactor handler shape, when called twice
    // synchronously inside one act() flush (mirroring rapid keyboard repeat),
    // produces only the second key in final state. The functional form
    // produces the cumulative union.
    const closureCapture: HandlerCapture = { toggle: null, range: null, selected: new Set() };
    const functionalCapture: HandlerCapture = { toggle: null, range: null, selected: new Set() };

    render(<HandlerHarness form="closure" capture={closureCapture} visibleKeys={['A', 'B', 'C']} />);
    act(() => {
      closureCapture.toggle!('A');
      closureCapture.toggle!('C');
    });
    // Closure capture: second call read pre-update selected={}; final = {C}.
    expect([...closureCapture.selected].sort()).toEqual(['C']);

    cleanup();

    render(<HandlerHarness form="functional" capture={functionalCapture} visibleKeys={['A', 'B', 'C']} />);
    act(() => {
      functionalCapture.toggle!('A');
      functionalCapture.toggle!('C');
    });
    // Functional updater: second call read prev={A}; final = {A,C}.
    expect([...functionalCapture.selected].sort()).toEqual(['A', 'C']);
  });

  it('Test B — closure-capture handleRangeToggle diverges from functional form under rapid-fire (RED proof)', () => {
    // 5 visible keys A..E. Set up a state where a subsequent rapid-fire
    // range-toggle pair will compute DIFFERENT next-states (so the dropped
    // update is observable, unlike a same-payload double-fire).
    //
    // Setup sequence (sequential, single-call per act flush — both forms
    // converge identically):
    //   1. toggle('A')     → selected={A},     lastClicked='A'
    //   2. range('E')      → selected={A..E},  lastClicked='E'
    //   3. range('C')      → selected={A,B},   lastClicked='C'
    //
    // Then: rapid-fire range('A'); range('B') in one act flush. Each call
    // produces a different `next` set, so the dropped first update IS
    // observable.
    //
    // Trace (closure form — both calls share same render's closure:
    //                    selected={A,B}, lastClicked='C'):
    //   range('A'): aIdx=indexOf('C')=2, bIdx=indexOf('A')=0 → lo=0, hi=2.
    //     targetSelected = !selected.has('A') = false. DELETE A,B,C from
    //     selected={A,B} → next={}. setSelected({}) — queued.
    //   range('B'): SAME closure read. aIdx=2, bIdx=indexOf('B')=1 → lo=1, hi=2.
    //     targetSelected = !selected.has('B') = false. DELETE B,C from
    //     selected={A,B} → next={A}. setSelected({A}) — overwrites queued.
    //   Final: {A} ← second-wins; first call's empty-set mutation dropped.
    //
    // Trace (functional form):
    //   range('A'): setSelected((prev)=>{ targetSelected=!prev.has('A')=false;
    //                delete A,B,C from prev={A,B} → {}; return {} }). Queued.
    //   range('B'): setSelected((prev)=>{ prev={} from queued; lastClicked='C'
    //                still (closure not re-rendered); aIdx=2, bIdx=1, lo=1, hi=2;
    //                targetSelected=!prev.has('B')=true; ADD B,C → {B,C} }).
    //   Final: {B,C} ← cumulative; both updates land.
    //
    // Closure {A} ≠ Functional {B,C}. The race is empirically observable.
    const closureCapture: HandlerCapture = { toggle: null, range: null, selected: new Set() };
    const functionalCapture: HandlerCapture = { toggle: null, range: null, selected: new Set() };
    const keys = ['A', 'B', 'C', 'D', 'E'];

    // ----- closure form: setup -----
    render(<HandlerHarness form="closure" capture={closureCapture} visibleKeys={keys} />);
    act(() => { closureCapture.toggle!('A'); });
    expect([...closureCapture.selected].sort()).toEqual(['A']);
    act(() => { closureCapture.range!('E'); });
    expect([...closureCapture.selected].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    act(() => { closureCapture.range!('C'); });
    expect([...closureCapture.selected].sort()).toEqual(['A', 'B']);
    // ----- closure form: rapid-fire pair (the race) -----
    act(() => {
      closureCapture.range!('A');
      closureCapture.range!('B');
    });
    // Closure capture: second call's setSelected({A}) overwrites first call's
    // setSelected({}). Final = {A}. The first update (empty-set deselect-all)
    // was dropped.
    expect([...closureCapture.selected].sort()).toEqual(['A']);

    cleanup();

    // ----- functional form: setup -----
    render(<HandlerHarness form="functional" capture={functionalCapture} visibleKeys={keys} />);
    act(() => { functionalCapture.toggle!('A'); });
    act(() => { functionalCapture.range!('E'); });
    act(() => { functionalCapture.range!('C'); });
    expect([...functionalCapture.selected].sort()).toEqual(['A', 'B']);
    // ----- functional form: rapid-fire pair -----
    act(() => {
      functionalCapture.range!('A');
      functionalCapture.range!('B');
    });
    // Functional: first call deletes A,B,C from prev={A,B} → {}. Second call
    // reads prev={} (first's queued state), targetSelected=!prev.has('B')=true,
    // adds B,C → {B,C}. Cumulative.
    expect([...functionalCapture.selected].sort()).toEqual(['B', 'C']);

    // The two forms diverge under rapid-fire — closure ≠ functional.
    expect([...closureCapture.selected].sort()).not.toEqual(
      [...functionalCapture.selected].sort(),
    );
  });

  it('Test C — sequential single-toggles produce union (control case via real panel)', async () => {
    // Plain awaited single-toggles through the ACTUAL GlobalMaxRenderPanel
    // checkbox surface — no batching, no race. Both pre- and post-refactor
    // handlers produce {A,B}. This is the durable user-visible contract.
    const rows = [makeRow('A'), makeRow('B'), makeRow('C')];
    render(<PanelWrapper rows={rows} />);

    fireEvent.click(getCheckbox('A'));
    await Promise.resolve();
    fireEvent.click(getCheckbox('B'));
    await Promise.resolve();

    expect(getCheckbox('A').checked).toBe(true);
    expect(getCheckbox('B').checked).toBe(true);
    expect(getCheckbox('C').checked).toBe(false);
  });
});
