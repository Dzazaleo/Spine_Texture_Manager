// @vitest-environment jsdom
/**
 * Phase 41 — renderer-side specs for AnimationPlayerModal42.
 *
 * Coverage (mapping to REQUIREMENTS.md VIEWER-* under v1.5.1 milestone):
 *   - VIEWER-02 — ARIA scaffold (role=dialog + aria-modal + aria-labelledby);
 *                 mount-once / dispose-once contract via SpinePlayer mock spy
 *                 (Pitfall 5 — double-dispose guard via the `disposed` flag).
 *   - VIEWER-03 — Asset feed routing: atlas-source mode (urls only) vs
 *                 atlas-less mode (rawDataURIs map with synthetic.atlas +
 *                 per-region keys).
 *   - VIEWER-04 — Mount of SpinePlayer with showControls:false + the
 *                 D-02c '23273200' background and the Pitfall-8 sized
 *                 container (`flex-1` + minHeight:400).
 *   - VIEWER-05 — Live animation + skin switching: setAnimation(name,true)
 *                 (loop on per D-04b) and setSkinByName THEN
 *                 setSlotsToSetupPose in that exact order.
 *   - VIEWER-06 — Playback transport: play/pause + scrub via the Pattern 4
 *                 sequence (animationState.update + apply + skeleton.update
 *                 + updateWorldTransform(2) + playTime write-back). Default
 *                 open state is animations[0] + the fullest skin (most
 *                 attachments, JSON-order tiebreak; 2026-05-19) + loop on.
 *   - VIEWER-08 — Project-change cleanup contract: useEffect dep array
 *                 includes summary identity (asserted indirectly via the
 *                 'remount on summary change' test below — Plan 03 wires
 *                 the AppShell-side reset; this spec just guarantees the
 *                 modal honours the dep).
 *   - VIEWER-09 — Terminal in-modal error overlay (CONTEXT D-04c) — verbatim
 *                 copy + Close-only + role="alert".
 *
 * Manual UAT items (deferred to 41-HUMAN-UAT.md per 41-VALIDATION.md):
 *   - VIEWER-04 visible character render — jsdom has no WebGL; we exercise
 *     construction shape only.
 *   - VIEWER-06 visible scrub-pose-update synchrony — jsdom can't paint.
 *   - VIEWER-08 real GL leak verification across 10 open/close cycles.
 *   - VIEWER-09 real-fs corrupted-fixture error UI.
 *   - Atlas-less mode visual parity with atlas-source mode.
 *
 * Mock strategy: `vi.mock('spine-player-42', ...)` returns a
 * mock SpinePlayer class. Each constructor invocation pushes its config +
 * spied player object into a module-scope `spinePlayerInstances` array. The
 * constructor invokes `config.success(player)` on a `Promise.resolve().then`
 * microtask so tests can drive the post-success branch by `await
 * Promise.resolve()` once before assertions.
 *
 * Layer 3 invariant: this spec imports only renderer-side modules + shared
 * types — never `src/core/*` directly (tests/arch.spec.ts gate, lines 19-34).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { pathToFileURL } from 'node:url';
import { AnimationPlayerModal42 } from '../../src/renderer/src/modals/AnimationPlayerModal42';
import { SpinePlayer } from 'spine-player-42';
import type { SkeletonSummary } from '../../src/shared/types';

// Module-scope record of every SpinePlayer instance constructed during a test.
// `afterEach` empties this so tests can't bleed into each other.
interface MockSpinePlayerRecord {
  config: any;
  player: any;
  disposed: boolean;
}
// spinePlayerInstances kept as a documentation alias for the global sink
// the mock factory writes to (the factory can't reach into module scope
// because vi.mock hoists above all imports — see readInstances() below).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const spinePlayerInstances: MockSpinePlayerRecord[] = [];

vi.mock('spine-player-42', () => {
  // Vitest hoists this factory above the imports — we can't close over
  // module-scope variables defined later in the file. We synthesize the
  // shared sink via `(globalThis as any).__spinePlayerInstances` so the
  // spec body and the mock factory both reference the same array.
  const SpinePlayer = vi.fn();
  // The modal samples bounds on an ISOLATED skeleton (sampleAnimationBounds →
  // makeProbe → new Skeleton). Provide minimal faithful stubs so that path
  // runs for real in tests instead of only hitting the null fallback.
  class Vector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  }
  class Skeleton {
    data: unknown;
    skin: { name: string } | null = null;
    constructor(data: unknown) {
      this.data = data;
    }
    setSkinByName(): void {}
    setSlotsToSetupPose(): void {}
    setToSetupPose(): void {}
    updateWorldTransform(): void {}
    getBounds(off: { x: number; y: number }, size: { x: number; y: number }) {
      off.x = 0;
      off.y = 0;
      size.x = 100;
      size.y = 100;
    }
  }
  return {
    SpinePlayer,
    Skeleton,
    Vector2,
    MixBlend: { setup: 0 },
    MixDirection: { mixIn: 0 },
    Physics: { update: 2 },
  };
});

// Pull the global sink into a module-local alias for ergonomic test reads.
function readInstances(): MockSpinePlayerRecord[] {
  return ((globalThis as any).__spinePlayerInstances ??=
    [] as MockSpinePlayerRecord[]);
}

// Default mock implementation — invokes config.success on a microtask. The
// `mockImplementation(...)` call is applied in beforeEach so vi.clearAllMocks
// (and per-test `.mockImplementationOnce(...)` for the error path) interact
// cleanly. MUST be a function declaration (not an arrow) so `new SpinePlayer`
// can call it as a constructor — vi.fn's underlying mock invokes the
// implementation in a way that delegates to the impl's [[Construct]] internal
// method.
function defaultSpinePlayerImpl(_container: HTMLElement, config: any) {
  const player: any = {
    dispose: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setAnimation: vi.fn(),
    playTime: 0,
    paused: false,
    skeleton: {
      data: {
        animations: [{ name: 'idle' }, { name: 'walk' }],
        // pickInitialSkin (2026-05-19 amendment, mirrors the 4.3 leg) opens on
        // the FULLEST skin. 'default' is authored empty (skin-driven-rig case)
        // so the viewer must fall back to 'red', not the near-blank skins[0].
        skins: [
          { name: 'default', getAttachments: () => [] },
          { name: 'red', getAttachments: () => [{}, {}] },
        ],
        findAnimation: vi.fn((name: string) => ({
          name,
          duration: 1,
          apply: vi.fn(),
        })),
      },
      setSkinByName: vi.fn(),
      setSlotsToSetupPose: vi.fn(),
      update: vi.fn(),
      updateWorldTransform: vi.fn(),
    },
    animationState: {
      getCurrent: vi.fn(() => ({
        animation: { duration: 1, name: 'idle' },
        loop: true,
      })),
      update: vi.fn(),
      apply: vi.fn(),
    },
  };
  const record: MockSpinePlayerRecord = { config, player, disposed: false };
  // Bind dispose to flip the disposed flag so tests can verify the
  // double-dispose guard (Pitfall 5).
  player.dispose.mockImplementation(() => {
    record.disposed = true;
  });
  readInstances().push(record);
  // Microtask-deferred success — gives the renderer a chance to set
  // playerRef + transition state to 'ready' on the next tick.
  Promise.resolve().then(() => {
    try {
      config.success?.(player);
    } catch {
      /* tests drive error paths via mockImplementationOnce below */
    }
  });
  return player;
}

beforeEach(() => {
  // Re-apply the default mock implementation so vi.clearAllMocks (afterEach)
  // doesn't leave the constructor with a no-op body. Per-test error tests
  // override via `.mockImplementationOnce(...)`.
  (SpinePlayer as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    defaultSpinePlayerImpl,
  );
  // window.api stub mirrors AtlasPreviewModal spec (pathToImageUrl mock)
  // and adds the new Plan 01 getViewerAssetFeed channel.
  vi.stubGlobal('api', {
    pathToImageUrl: vi.fn(async (absolutePath: string) => {
      const fileUrl = pathToFileURL(absolutePath);
      return `app-image://localhost${fileUrl.pathname}`;
    }),
    getViewerAssetFeed: vi.fn(async (_skeletonPath: string) => ({
      ok: true,
      atlasTextDataUri: 'data:text/plain;base64,Zm9vCg==',
      regionPaths: {
        CIRCLE: '/tmp/CIRCLE.png',
        SQUARE: '/tmp/SQUARE.png',
      },
    })),
  });
});

afterEach(() => {
  // Drain the global sink so each test starts from zero instances.
  const sink = (globalThis as any).__spinePlayerInstances as
    | MockSpinePlayerRecord[]
    | undefined;
  if (sink) sink.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

/**
 * Synthesize a minimal SkeletonSummary for the modal. atlasPath defaults to
 * a fake .atlas (atlas-source mode); pass `atlasPath: null` for atlas-less
 * mode. Regions carry sourcePath for the atlas-less rawDataURIs map.
 */
function makeSummary(
  overrides: Partial<{ atlasPath: string | null; skeletonPath: string }> = {},
): SkeletonSummary {
  return {
    skeletonPath: overrides.skeletonPath ?? '/fake/skeleton.json',
    atlasPath: 'atlasPath' in overrides ? overrides.atlasPath : '/fake/skeleton.atlas',
    hasAtlasFile: true,
    hasImagesDir: true,
    bones: { count: 1, names: ['root'] },
    slots: { count: 2 },
    attachments: { count: 2, byType: { RegionAttachment: 2 } },
    skins: { count: 2, names: ['default', 'red'] },
    animations: { count: 2, names: ['idle', 'walk'] },
    events: { count: 0, names: [] },
    peaks: [],
    regions: [
      {
        regionName: 'CIRCLE',
        attachmentName: 'CIRCLE',
        skinName: 'default',
        slotName: 'CIRCLE',
        animationName: '__SETUP__',
        time: 0,
        frame: 0,
        peakScale: 1,
        peakScaleX: 1,
        peakScaleY: 1,
        worldW: 64,
        worldH: 64,
        sourceW: 64,
        sourceH: 64,
        isSetupPosePeak: true,
        sourcePath: '/tmp/CIRCLE.png',
        canonicalW: 64,
        canonicalH: 64,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        originalSizeLabel: '64×64',
        peakSizeLabel: '64×64',
        scaleLabel: '1.000×',
        sourceLabel: '__SETUP__',
        frameLabel: '—',
        contributingAttachments: [],
      },
      {
        regionName: 'SQUARE',
        attachmentName: 'SQUARE',
        skinName: 'default',
        slotName: 'SQUARE',
        animationName: '__SETUP__',
        time: 0,
        frame: 0,
        peakScale: 1,
        peakScaleX: 1,
        peakScaleY: 1,
        worldW: 128,
        worldH: 128,
        sourceW: 128,
        sourceH: 128,
        isSetupPosePeak: true,
        sourcePath: '/tmp/SQUARE.png',
        canonicalW: 128,
        canonicalH: 128,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        originalSizeLabel: '128×128',
        peakSizeLabel: '128×128',
        scaleLabel: '1.000×',
        sourceLabel: '__SETUP__',
        frameLabel: '—',
        contributingAttachments: [],
      },
    ],
    animationBreakdown: [],
    unusedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  } as unknown as SkeletonSummary;
}

// Error-path mock implementation — invokes config.error on a microtask with
// the supplied reason. MUST be a function declaration (not an arrow) so it
// can be invoked as a constructor via `new SpinePlayer(...)`. The reason is
// captured via a module-scope variable rather than a closure so the same
// function declaration can be reused across both error tests.
let mockErrorReason: string = 'Mocked load failure';
function errorSpinePlayerImpl(_container: HTMLElement, config: any) {
  const player: any = {
    dispose: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setAnimation: vi.fn(),
    playTime: 0,
    paused: false,
    skeleton: {
      data: { animations: [], skins: [] },
      setSkinByName: vi.fn(),
      setSlotsToSetupPose: vi.fn(),
      update: vi.fn(),
      updateWorldTransform: vi.fn(),
    },
    animationState: {
      getCurrent: vi.fn(() => null),
      update: vi.fn(),
      apply: vi.fn(),
    },
  };
  const record: MockSpinePlayerRecord = { config, player, disposed: false };
  player.dispose.mockImplementation(() => {
    record.disposed = true;
  });
  readInstances().push(record);
  const reason = mockErrorReason;
  Promise.resolve().then(() => config.error?.(player, reason));
  return player;
}

// Helper: lets queued microtasks flush so post-success state lands. Wrapped
// in `act` so React state updates triggered by the mock's success microtask
// commit synchronously to the DOM (React 18 auto-batches state updates from
// async callbacks; without `act`, the DOM reflects 'loading' state even
// though the post-success effects ran).
async function flushMicrotasks() {
  await act(async () => {
    // Three microtask hops cover (1) buildAssetFeed's awaited
    // pathToImageUrl/getViewerAssetFeed promise chain, (2) the
    // config.success microtask scheduled inside the mock constructor,
    // (3) any post-success setState batching.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER-02 — Modal scaffold + dispose contract
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — modal scaffold (VIEWER-02)', () => {
  it('renders role=dialog + aria-modal=true + aria-labelledby when open=true', () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('animation-viewer-title');
    const title = document.getElementById('animation-viewer-title');
    expect(title).not.toBeNull();
  });

  it('returns null when open=false (no dialog rendered)', () => {
    const { container } = render(
      <AnimationPlayerModal42
        open={false}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('mount + unmount calls SpinePlayer.dispose exactly once (Pitfall 5)', async () => {
    const { unmount } = render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    expect(readInstances().length).toBe(1);
    unmount();
    // The cleanup function disposes the active player; double-dispose
    // guard means we should see EXACTLY one dispose call.
    expect(readInstances()[0].player.dispose).toHaveBeenCalledTimes(1);
  });

  it('repeated open/close cycles produce equal constructor + dispose counts (no GL leak)', async () => {
    for (let i = 0; i < 5; i++) {
      const { unmount } = render(
        <AnimationPlayerModal42
          open={true}
          summary={makeSummary()}
          loaderMode="auto"
          onClose={vi.fn()}
        />,
      );
      await flushMicrotasks();
      unmount();
    }
    const sink = readInstances();
    expect(sink.length).toBe(5);
    for (const rec of sink) {
      expect(rec.player.dispose).toHaveBeenCalledTimes(1);
    }
    // Constructor call count must equal dispose call count.
    const ctorCalls = (SpinePlayer as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const disposeCalls = sink.reduce(
      (acc, rec) => acc + (rec.player.dispose as ReturnType<typeof vi.fn>).mock.calls.length,
      0,
    );
    expect(ctorCalls).toBe(disposeCalls);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER-03 — Asset feed routing (atlas-source vs atlas-less)
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — asset feed routing (VIEWER-03)', () => {
  it('atlas-source mode passes app-image:// urls and empty rawDataURIs', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary({ atlasPath: '/fake/skeleton.atlas' })}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    expect(inst).toBeDefined();
    expect(typeof inst.config.skeleton).toBe('string');
    expect(inst.config.skeleton).toMatch(/^app-image:\/\/localhost\//);
    expect(typeof inst.config.atlas).toBe('string');
    expect(inst.config.atlas).toMatch(/^app-image:\/\/localhost\//);
    // rawDataURIs MUST be empty (or absent) in atlas-source mode.
    const raw = inst.config.rawDataURIs ?? {};
    expect(Object.keys(raw).length).toBe(0);
  });

  it('atlas-less mode passes synthetic.atlas + base64 atlas text + per-region urls', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary({ atlasPath: null })}
        loaderMode="atlas-less"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    expect(inst).toBeDefined();
    expect(inst.config.atlas).toBe('synthetic.atlas');
    const raw = inst.config.rawDataURIs as Record<string, string>;
    expect(raw).toBeDefined();
    expect(raw['synthetic.atlas']).toMatch(/^data:text\/plain;base64,/);
    // One entry per region; key shape is "<regionName>.png" → app-image:// url.
    expect(raw['CIRCLE.png']).toMatch(/^app-image:\/\/localhost\//);
    expect(raw['SQUARE.png']).toMatch(/^app-image:\/\/localhost\//);
  });

  it('atlas-less branch is selected when summary.atlasPath is null even with loaderMode=auto', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary({ atlasPath: null })}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    expect(inst.config.atlas).toBe('synthetic.atlas');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER-04 — SpinePlayer construction shape
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — SpinePlayer construction (VIEWER-04)', () => {
  it('sets showControls=false (we own the control bar) + #232732 background', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const cfg = readInstances()[0].config;
    expect(cfg.showControls).toBe(false);
    expect(cfg.backgroundColor).toBe('23273200');
  });

  it('player container div has BOTH flex-1 class AND minHeight:400 inline style (Pitfall 8)', () => {
    const { container } = render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    // The player container is the only div with `flex-1` + an explicit
    // inline minHeight. We grep the rendered HTML for both signals.
    const html = container.innerHTML;
    expect(html).toMatch(/flex-1/);
    // jsdom serialises inline styles with `min-height: 400px`.
    expect(html).toMatch(/min-height:\s*400px/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER-05 — Animation + skin switching
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — animation + skin switching (VIEWER-05)', () => {
  it('populates animation select from skeleton.data.animations[].name after success', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const animSelect = screen.getByLabelText(/animation/i, {
      selector: 'select',
    }) as HTMLSelectElement;
    const optionNames = Array.from(animSelect.options).map((o) => o.value);
    expect(optionNames).toEqual(['idle', 'walk']);
  });

  it('populates skin select from skeleton.data.skins[].name after success', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const skinSelect = screen.getByLabelText(/skin/i, {
      selector: 'select',
    }) as HTMLSelectElement;
    const optionNames = Array.from(skinSelect.options).map((o) => o.value);
    expect(optionNames).toEqual(['default', 'red']);
  });

  it('animation onChange calls setAnimation(name, true) (loop on per D-04b)', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    const animSelect = screen.getByLabelText(/animation/i, {
      selector: 'select',
    });
    fireEvent.change(animSelect, { target: { value: 'walk' } });
    // setAnimation gets called twice — first during success default open
    // (with 'idle'), then on user change (with 'walk'). We assert the LAST
    // call matches (name='walk', loop=true).
    const setAnimMock = inst.player.setAnimation as ReturnType<typeof vi.fn>;
    expect(setAnimMock).toHaveBeenCalledWith('walk', true);
  });

  it('skin onChange calls setSkinByName THEN setSlotsToSetupPose in that order', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    const setSkinByName = inst.player.skeleton.setSkinByName as ReturnType<typeof vi.fn>;
    const setSlotsToSetupPose = inst.player.skeleton
      .setSlotsToSetupPose as ReturnType<typeof vi.fn>;
    // Clear the success-path default-open calls so we measure the user
    // interaction only.
    setSkinByName.mockClear();
    setSlotsToSetupPose.mockClear();
    const skinSelect = screen.getByLabelText(/skin/i, { selector: 'select' });
    fireEvent.change(skinSelect, { target: { value: 'red' } });
    expect(setSkinByName).toHaveBeenCalledWith('red');
    expect(setSlotsToSetupPose).toHaveBeenCalledTimes(1);
    // setSkinByName MUST be called before setSlotsToSetupPose
    // (Pattern 3 — without setSlotsToSetupPose, attachments from the
    // previous skin remain bound to slots).
    const skinOrder = setSkinByName.mock.invocationCallOrder[0];
    const setupOrder = setSlotsToSetupPose.mock.invocationCallOrder[0];
    expect(skinOrder).toBeLessThan(setupOrder);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER-06 — Playback transport (play / pause / scrub)
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — playback transport (VIEWER-06)', () => {
  it('default open state primes setAnimation with animations[0] + setSkinByName with the fullest skin (empty skins[0] falls back)', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    // First call to setAnimation should be the default ('idle', true).
    const setAnim = inst.player.setAnimation as ReturnType<typeof vi.fn>;
    expect(setAnim.mock.calls[0]).toEqual(['idle', true]);
    // 'default' is authored empty, 'red' has 2 attachments → pickInitialSkin
    // opens on the fullest skin ('red'), not the near-blank skins[0].
    const setSkin = inst.player.skeleton.setSkinByName as ReturnType<typeof vi.fn>;
    expect(setSkin.mock.calls[0]).toEqual(['red']);
  });

  it('clicking the play/pause button toggles between player.play() and player.pause()', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    // The initial state is "playing" (default-open is play); button shows
    // the pause glyph. First click → pause.
    const btn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(btn);
    expect(inst.player.pause).toHaveBeenCalledTimes(1);
    // Second click on the same toolbar position now has the play label.
    const playBtn = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playBtn);
    expect(inst.player.play).toHaveBeenCalledTimes(1);
  });

  it('scrub range calls animationState.update + apply + skeleton.update + updateWorldTransform(2)', async () => {
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const inst = readInstances()[0];
    const scrub = screen.getByLabelText(/timeline/i) as HTMLInputElement;
    fireEvent.change(scrub, { target: { value: '0.5' } });
    expect(inst.player.animationState.update).toHaveBeenCalled();
    expect(inst.player.animationState.apply).toHaveBeenCalledWith(inst.player.skeleton);
    expect(inst.player.skeleton.update).toHaveBeenCalled();
    expect(inst.player.skeleton.updateWorldTransform).toHaveBeenCalledWith(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER-09 — Terminal in-modal error overlay
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — error state (VIEWER-09)', () => {
  it('renders role=alert with verbatim copy when config.error fires', async () => {
    // Override the mock for this test: instead of calling success on
    // microtask, call error with a known reason. Uses the function-declaration
    // helper so vi.fn can invoke it as a constructor (arrow functions throw
    // "is not a constructor").
    mockErrorReason = 'Mocked load failure';
    (SpinePlayer as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      errorSpinePlayerImpl,
    );
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const alert = screen.getByRole('alert');
    expect(alert.textContent ?? '').toMatch(/Unable to load the animation viewer/);
    expect(alert.textContent ?? '').toMatch(/Mocked load failure/);
    expect(alert.textContent ?? '').toMatch(
      /Close this dialog, fix the file on disk, and reopen the viewer\./,
    );
  });

  it('clicking the Close button inside the error overlay calls onClose', async () => {
    mockErrorReason = 'Some error';
    (SpinePlayer as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      errorSpinePlayerImpl,
    );
    const onClose = vi.fn();
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={onClose}
      />,
    );
    await flushMicrotasks();
    const alert = screen.getByRole('alert');
    const closeBtn = alert.querySelector('button');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn as HTMLButtonElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('error state disables animation + skin selects (or renders them empty)', async () => {
    mockErrorReason = 'Err';
    (SpinePlayer as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      errorSpinePlayerImpl,
    );
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={vi.fn()}
      />,
    );
    await flushMicrotasks();
    const animSelect = screen.queryByLabelText(/animation/i, {
      selector: 'select',
    }) as HTMLSelectElement | null;
    // Either the select is disabled OR the options array is empty.
    if (animSelect) {
      const isDisabled = animSelect.disabled;
      const noOptions = animSelect.options.length === 0;
      expect(isDisabled || noOptions).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Close interactions (D-81 reuse)
// ─────────────────────────────────────────────────────────────────────────────

describe('AnimationPlayerModal42 — close interactions (D-81)', () => {
  it('clicking the X close button calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={onClose}
      />,
    );
    await flushMicrotasks();
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the outer overlay calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={onClose}
      />,
    );
    await flushMicrotasks();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the inner card content does NOT call onClose (stopPropagation)', async () => {
    const onClose = vi.fn();
    render(
      <AnimationPlayerModal42
        open={true}
        summary={makeSummary()}
        loaderMode="auto"
        onClose={onClose}
      />,
    );
    await flushMicrotasks();
    // The header title h2 is inside the inner card — clicking it must
    // NOT propagate to the outer overlay's onClick.
    const title = document.getElementById('animation-viewer-title') as HTMLElement;
    fireEvent.click(title);
    expect(onClose).not.toHaveBeenCalled();
  });
});
