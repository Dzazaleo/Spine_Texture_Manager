/**
 * Phase 41 — Spine Animation Viewer modal.
 *
 * 6th member of the modal family (after OverrideDialog, OptimizeDialog,
 * AtlasPreviewModal, SaveQuitDialog, SettingsDialog, DocumentationBuilderDialog).
 * Reuses the locked 5-modal ARIA scaffold (Phase 6 D-81): role=dialog +
 * aria-modal + aria-labelledby + outer overlay onClick={onClose} + inner
 * stopPropagation + useFocusTrap hook (Tab cycle + document-level Esc).
 *
 * Wraps `@esotericsoftware/spine-player@4.2.111` (4.2.111 exact pin for
 * spine-core dedup per RESEARCH Pitfall 1). The player is constructed inside
 * a `useEffect` keyed on (summary, loaderMode, open); cleanup calls
 * `player.dispose()` guarded by a `disposed` flag (Pitfall 5 double-dispose).
 *
 * Asset feed (RESEARCH Pattern 2 — mode-agnostic shape):
 *   - Atlas-source (`summary.atlasPath !== null` AND `loaderMode !== 'atlas-less'`):
 *     spine-player resolves page PNGs via parent + page.name (vendored line
 *     5862) where parent = atlasUrl's dir. We pass app-image:// URLs for both
 *     skeleton and atlas; rawDataURIs stays empty.
 *   - Atlas-less (`summary.atlasPath === null` OR `loaderMode === 'atlas-less'`):
 *     atlas text is synthesized main-side via the new viewer:get-asset-feed
 *     IPC (Plan 01), crosses as a base64 data URI, and per-region PNGs are
 *     mapped into rawDataURIs as "<regionName>.png" → app-image:// URLs.
 *
 * Transport (RESEARCH Pattern 4 — VIEWER-06):
 *   - play / pause invoke the player methods directly.
 *   - scrub computes the delta to target time, calls animationState.update +
 *     apply, skeleton.update + updateWorldTransform with the Physics.update
 *     literal `2` (CLAUDE.md fact #3), then writes player.playTime =
 *     targetTime.
 *
 * Skin switching (RESEARCH Pattern 3 — VIEWER-05):
 *   - setSkinByName THEN setSlotsToSetupPose in that exact order. Without
 *     setSlotsToSetupPose, attachments from the previous skin remain bound.
 *
 * Layer 3 invariant: imports only from react + clsx + ../../../shared/types.js
 * + ../hooks/useFocusTrap + @esotericsoftware/spine-player.
 * NEVER from ../../core/* (tests/arch.spec.ts:19-34).
 *
 * Tailwind v4 literal-class discipline (RESEARCH Pitfall 3 + Pattern S-7):
 * every className is a literal string or clsx with literal branches.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  SpinePlayer,
  type SpinePlayerConfig,
} from '@esotericsoftware/spine-player';
import type {
  SkeletonSummary,
  ViewerAssetFeedResponse,
} from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface AnimationPlayerModalProps {
  open: boolean;
  summary: SkeletonSummary;
  /**
   * Project-level loader mode. Atlas-less is selected whenever
   * `summary.atlasPath === null` OR the user explicitly picked 'atlas-less';
   * the modal collapses both signals into a single isAtlasLess gate per
   * RESEARCH Pattern 2 + memory:project_strict_loadermode_separation.
   */
  loaderMode: 'auto' | 'atlas-less';
  onClose: () => void;
}

/**
 * Internal asset-feed shape produced by buildAssetFeed. spine-player's config
 * consumes skeleton + atlas as string URLs (or rawDataURIs keys) and an
 * optional rawDataURIs Record for inline-resolved assets.
 */
type ViewerFeed = {
  skeletonUrl: string;
  atlasUrl: string;
  rawDataURIs: Record<string, string>;
};

/**
 * Build the spine-player asset feed for either loader mode.
 *
 * Atlas-source: spine-player resolves page PNGs via parent + page.name. Since
 * pathToImageUrl(atlasPath) returns app-image://localhost/.../JOKERMAN.atlas,
 * parent becomes app-image://localhost/.../, and a page filename like
 * 'JOKERMAN.png' resolves correctly. rawDataURIs stays empty.
 *
 * Atlas-less: the synth atlas text is fetched main-side via the new IPC
 * (Plan 01), arrives as a base64 data: URI, and is keyed under
 * 'synthetic.atlas'. Each region's PNG absolute path is converted to an
 * app-image:// URL and keyed under '<regionName>.png' (vendored line 5862
 * resolves <regionName>.png against the atlas's rawDataURIs map).
 */
async function buildAssetFeed(
  summary: SkeletonSummary,
  loaderMode: 'auto' | 'atlas-less',
): Promise<ViewerFeed> {
  const skeletonUrl = await window.api.pathToImageUrl(summary.skeletonPath);
  // Mirror AppShell.tsx:932-935 effectiveLoaderMode idiom — atlas-less is
  // selected if either the summary lacks an atlas file OR the user picked
  // atlas-less explicitly.
  const isAtlasLess = summary.atlasPath === null || loaderMode === 'atlas-less';

  if (!isAtlasLess) {
    const atlasUrl = await window.api.pathToImageUrl(summary.atlasPath as string);
    return { skeletonUrl, atlasUrl, rawDataURIs: {} };
  }

  const feed: ViewerAssetFeedResponse = await window.api.getViewerAssetFeed(
    summary.skeletonPath,
  );
  if (!feed.ok) {
    throw new Error(feed.error.message);
  }
  const rawDataURIs: Record<string, string> = {
    'synthetic.atlas': feed.atlasTextDataUri,
  };
  for (const [regionName, absPath] of Object.entries(feed.regionPaths)) {
    rawDataURIs[regionName + '.png'] = await window.api.pathToImageUrl(absPath);
  }
  return { skeletonUrl, atlasUrl: 'synthetic.atlas', rawDataURIs };
}

export function AnimationPlayerModal(props: AnimationPlayerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SpinePlayer | null>(null);

  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [errorReason, setErrorReason] = useState<string>('');
  const [availableAnimations, setAvailableAnimations] = useState<readonly string[]>(
    [],
  );
  const [availableSkins, setAvailableSkins] = useState<readonly string[]>([]);
  const [activeAnimation, setActiveAnimation] = useState<string>('');
  const [activeSkin, setActiveSkin] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scrubPercent, setScrubPercent] = useState<number>(0);

  // ARIA scaffold — pass props.onClose raw per Pattern S-1 + Pitfall 8 (no
  // wrapped callback that captures broader deps and re-runs the hook every
  // render).
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  useEffect(() => {
    if (!props.open) return;
    const container = containerRef.current;
    if (!container) return;

    let player: SpinePlayer | null = null;
    let cancelled = false;
    let disposed = false;

    // Reset state on each (re)mount so a previous error / animation list
    // doesn't bleed across project-change cleanups.
    setPlayerState('loading');
    setErrorReason('');
    setAvailableAnimations([]);
    setAvailableSkins([]);
    setActiveAnimation('');
    setActiveSkin('');
    setIsPaused(false);
    setScrubPercent(0);

    void (async () => {
      let feed: ViewerFeed;
      try {
        feed = await buildAssetFeed(props.summary, props.loaderMode);
      } catch (err) {
        if (!cancelled) {
          setPlayerState('error');
          setErrorReason((err as Error).message ?? String(err));
        }
        return;
      }
      if (cancelled) return;

      const config: SpinePlayerConfig = {
        skeleton: feed.skeletonUrl,
        atlas: feed.atlasUrl,
        rawDataURIs: feed.rawDataURIs,
        showControls: false, // We own the control bar (anti-pattern from RESEARCH).
        backgroundColor: '23273200', // D-02c #232732 panel-surface, 00 alpha.
        // Straight alpha (not PMA). Spine 4.x atlas PNGs may ship PMA-encoded
        // on disk, but Chrome/Electron's PNG decoder UN-premultiplies during
        // the `Image`-element decode path that spine-player uses
        // (assetManager.loadTexture → `new Image()` → `texImage2D`), so the
        // in-memory texture is always straight alpha here. Setting
        // premultipliedAlpha:true makes spine-player's shader pick
        // srcFunc=gl.ONE (Player.js:13167) and transparent-white border
        // pixels (255,255,255,0) blend as opaque white — the artifact ring
        // around mesh attachments the user reproduced on SIMPLE_TEST.
        premultipliedAlpha: false,
        alpha: false,
        success: (p) => {
          if (cancelled) {
            try {
              p.dispose();
            } catch {
              /* idempotent — Pitfall 5 */
            }
            return;
          }
          playerRef.current = p;
          const animations = p.skeleton.data.animations.map((a) => a.name);
          const skins = p.skeleton.data.skins.map((s) => s.name);
          setAvailableAnimations(animations);
          setAvailableSkins(skins);
          const initialAnim = animations[0] ?? '';
          const initialSkin = skins[0] ?? '';
          setActiveAnimation(initialAnim);
          setActiveSkin(initialSkin);
          // Default open state per D-04b: first animation + first skin +
          // play + loop on. setSkinByName THEN setSlotsToSetupPose per
          // Pattern 3 (without setSlotsToSetupPose, attachments from a
          // prior skin remain bound to slots).
          if (initialAnim) p.setAnimation(initialAnim, true);
          if (initialSkin) {
            p.skeleton.setSkinByName(initialSkin);
            p.skeleton.setSlotsToSetupPose();
          }
          setPlayerState('ready');
        },
        error: (_p, reason) => {
          if (cancelled) return;
          setPlayerState('error');
          setErrorReason(reason);
        },
      };

      try {
        player = new SpinePlayer(container, config);
        playerRef.current = player;
      } catch (e) {
        // spine-player THROWS after firing config.error (RESEARCH Pitfall 2,
        // vendored line 14954) — swallow the throw because the error
        // callback already transitioned state to 'error'. If for some
        // reason the throw arrives without a prior error callback, we
        // surface its message as the terminal error.
        if (!cancelled) {
          setPlayerState((prev) =>
            prev === 'error' ? prev : 'error',
          );
          setErrorReason((prev) =>
            prev !== '' ? prev : (e as Error).message ?? String(e),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (player && !disposed) {
        disposed = true;
        try {
          player.dispose();
        } catch {
          /* idempotent — Pitfall 5 */
        }
      }
      playerRef.current = null;
    };
  }, [props.summary, props.loaderMode, props.open]);

  // Animation change handler (Pattern 3 — VIEWER-05).
  const onAnimationChange = useCallback((name: string) => {
    const p = playerRef.current;
    if (!p) return;
    p.setAnimation(name, true); // loop on per D-04b
    setActiveAnimation(name);
  }, []);

  // Skin change handler (Pattern 3 — VIEWER-05). Call order matters: name
  // first, then setSlotsToSetupPose to rebind the new skin's attachments.
  const onSkinChange = useCallback((name: string) => {
    const p = playerRef.current;
    if (!p?.skeleton) return;
    p.skeleton.setSkinByName(name);
    p.skeleton.setSlotsToSetupPose();
    setActiveSkin(name);
  }, []);

  // Play / pause (Pattern 4 — VIEWER-06).
  const onPlay = useCallback(() => {
    playerRef.current?.play();
    setIsPaused(false);
  }, []);
  const onPause = useCallback(() => {
    playerRef.current?.pause();
    setIsPaused(true);
  }, []);

  // Scrub (Pattern 4 — VIEWER-06). spine-player has no seek() — we replicate
  // the vendored built-in slider's logic (line 14330-14338).
  const onScrub = useCallback((percentage: number) => {
    const p = playerRef.current;
    if (!p?.animationState) return;
    const entry = p.animationState.getCurrent(0);
    if (!entry) return;
    p.pause();
    const duration = entry.animation.duration;
    const targetTime = duration * percentage;
    const delta = targetTime - p.playTime;
    p.animationState.update(delta);
    p.animationState.apply(p.skeleton);
    p.skeleton.update(delta);
    // 2 === Physics.update enum value (CLAUDE.md fact #3); the sampler uses
    // the same literal.
    p.skeleton.updateWorldTransform(2);
    p.playTime = targetTime;
    setScrubPercent(percentage);
    setIsPaused(true);
  }, []);

  // Open-gate early return AFTER hooks (React rules — hooks must run on every
  // render or the order changes). Mirrors AtlasPreviewModal.tsx:232.
  if (!props.open) return null;

  const controlsDisabled = playerState !== 'ready';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="animation-viewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-modal border border-border rounded-md p-6 w-[1280px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <h2 id="animation-viewer-title" className="text-sm text-fg">
            Animation Viewer
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            className="text-fg-muted hover:text-fg text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Top control bar (RESEARCH Code Example 1). */}
        <div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
          <label
            htmlFor="animation-viewer-anim-select"
            className="text-xs text-fg-muted"
          >
            Animation
          </label>
          <select
            id="animation-viewer-anim-select"
            value={activeAnimation}
            onChange={(e) => onAnimationChange(e.target.value)}
            disabled={controlsDisabled}
            className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
          >
            {availableAnimations.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <label
            htmlFor="animation-viewer-skin-select"
            className="text-xs text-fg-muted ml-3"
          >
            Skin
          </label>
          <select
            id="animation-viewer-skin-select"
            value={activeSkin}
            onChange={(e) => onSkinChange(e.target.value)}
            disabled={controlsDisabled}
            className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
          >
            {availableSkins.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={isPaused ? onPlay : onPause}
            disabled={controlsDisabled}
            className={clsx(
              'border border-border rounded-md px-3 py-1 text-xs ml-3',
              controlsDisabled && 'opacity-50',
            )}
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={scrubPercent}
            onChange={(e) => onScrub(Number(e.target.value))}
            disabled={controlsDisabled}
            className="flex-1 ml-3"
            aria-label="Animation timeline"
          />
        </div>

        {/* Player container — Pitfall 8 (MUST have flex-1 AND inline minHeight).
            Without both, spine-player's inner canvas (`width:100%;height:100%`)
            collapses to 1×1 px and the modal looks blank. */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-[#232732] border border-border rounded-md"
          style={{ minHeight: 400 }}
        />

        {/* Terminal error overlay — CONTEXT D-04c. Rendered absolute over the
            entire inner card; single Close button; no retry, no helper. */}
        {playerState === 'error' && (
          <div
            role="alert"
            className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-md"
          >
            <div className="bg-modal border border-border rounded-md p-6 max-w-md">
              <h3 className="text-sm text-fg mb-3">
                Unable to load the animation viewer
              </h3>
              <p className="text-xs text-fg-muted mb-2">
                The Spine project could not be loaded for playback.
              </p>
              <p className="text-xs text-fg mb-4 font-mono break-words">
                {errorReason}
              </p>
              <p className="text-xs text-fg-muted mb-4">
                Close this dialog, fix the file on disk, and reopen the viewer.
              </p>
              <button
                type="button"
                onClick={props.onClose}
                className="border border-border rounded-md px-3 py-1 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
