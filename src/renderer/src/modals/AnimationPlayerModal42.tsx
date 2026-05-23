// @ts-nocheck
// FROZEN literal v1.5.1 4.2-leg modal — materialized byte-verbatim from
//   git show 9f967d2:src/renderer/src/modals/AnimationPlayerModal.tsx
// plus the 2 DV-NOTE seds (import specifier -> spine-player-42; component
// identifier -> AnimationPlayerModal42). This file carries 11 strict-TS gaps
// that are INTRINSIC to the v1.5.1 source (v1.5.1 gated on tests + runtime,
// never strict typecheck:web); they are NOT 4.3 type-bleed — alias isolation
// is verified (0 typecheck:web errors outside this file). Owner-sanctioned
// 3rd transform per the 47-03 GA-1 escalation (AskUserQuestion 2026-05-19):
// DV-NOTE re-scoped to "byte-verbatim body + 2 seds + 1 @ts-nocheck sentinel".
// Visual correctness is the binding contract of the 47-05 owner UAT
// (CONTEXT D-02), not tsc. The body was byte-verbatim; it now carries owner-
// sanctioned behavioral amendments shared verbatim with the 4.3 leg: the
// `f N` frame-readout and the fullest-skin initial-pick (both 2026-05-19,
// AskUserQuestion — the latter supersedes the skins[0] open default).
/**
 * Phase 41 — Spine Animation Viewer modal.
 *
 * 6th member of the modal family (after OverrideDialog, OptimizeDialog,
 * AtlasPreviewModal, SaveQuitDialog, SettingsDialog, DocumentationBuilderDialog).
 * Reuses the locked 5-modal ARIA scaffold (Phase 6 D-81): role=dialog +
 * aria-modal + aria-labelledby + outer overlay onClick={onClose} + inner
 * stopPropagation + useFocusTrap hook (Tab cycle + document-level Esc).
 *
 * Wraps `spine-player-42@4.2.111` (4.2.111 exact pin for
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
 * + ../hooks/useFocusTrap + spine-player-42.
 * NEVER from ../../core/* (tests/arch.spec.ts:19-34).
 *
 * Tailwind v4 literal-class discipline (RESEARCH Pitfall 3 + Pattern S-7):
 * every className is a literal string or clsx with literal branches.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  MixBlend,
  MixDirection,
  Physics,
  Skeleton,
  SpinePlayer,
  Vector2,
  type SpinePlayerConfig,
} from 'spine-player-42';
import type {
  SkeletonSummary,
  ViewerAssetFeedResponse,
} from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface AnimationPlayerModal42Props {
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
 * User-controlled camera state. spine-player recomputes camera.zoom /
 * camera.position EVERY frame to fit the current animation's full motion
 * bounding box (Player.js drawFrame → calculateAnimationViewport). In an app
 * whose subject IS scale, that auto-fit is actively misleading: a tall jump
 * zooms the whole rig down, and every animation renders at a different scale.
 *
 * We neutralize it via the PUBLIC `config.update(player, delta)` hook, which
 * spine-player invokes AFTER it sets the auto-fit camera but BEFORE
 * `renderer.begin()` / `drawSkeleton` (Player.js order, verified against the
 * vendored 4.2.111 source). Overwriting camera.zoom / camera.position there
 * makes our values the ones actually drawn — no vendored-source patching, no
 * per-frame rAF fighting.
 *
 * `initialized` is the freeze latch: on the first frame where spine-player has
 * a valid per-animation fit, we ADOPT that fit once (so the rig opens nicely
 * framed, matching user expectation) and then lock. Setting it back to false
 * (Fit button / double-click) re-adopts spine-player's fit for whatever
 * animation is current, then re-locks.
 */
type CameraState = {
  zoom: number;
  x: number;
  y: number;
  initialized: boolean;
};

// Zoom % is anchored to TRUE actual size: 100% ⇒ one skeleton world unit maps
// to one on-screen CSS pixel (DPI-corrected). Clamp keeps the field sane.
const MIN_ZOOM_PCT = 5;
const MAX_ZOOM_PCT = 4000;

function clampPct(pct: number): number {
  return Math.max(MIN_ZOOM_PCT, Math.min(MAX_ZOOM_PCT, pct));
}

/**
 * Camera.zoom semantics (spine-webgl OrthoCamera.update):
 *   projection.ortho(zoom·-vpW/2, zoom·vpW/2, …) ⇒ visible world width =
 *   zoom · viewportWidth. spine-player runs renderer.resize(Expand) each
 *   frame, so viewportWidth === canvas.width (device px). Therefore
 *   device-px-per-world-unit = canvas.width / (zoom · viewportWidth) = 1/zoom.
 *
 * CSS px per world unit = that ÷ (canvas.width / clientWidth), the
 * backing-store→CSS ratio (≈ devicePixelRatio, but measured so it stays
 * correct even if spine-player caps the backing size). 100% ⇒ 1 CSS px / unit.
 */
function percentFromZoom(
  canvasW: number,
  vpW: number,
  clientW: number,
  zoom: number,
): number {
  const pxPerCss = clientW > 0 ? canvasW / clientW : 1;
  const devicePerWorld = canvasW / (zoom * vpW);
  const pct = (devicePerWorld / pxPerCss) * 100;
  return Number.isFinite(pct) && pct > 0 ? pct : 100;
}

function zoomFromPercent(
  canvasW: number,
  vpW: number,
  clientW: number,
  pct: number,
): number {
  const pxPerCss = clientW > 0 ? canvasW / clientW : 1;
  const devicePerWorld = (pct / 100) * pxPerCss;
  const zoom = canvasW / (devicePerWorld * vpW);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

// Breathing room around the rig when fitting. spine-player's own default is
// 10% per side (×1.2); we keep it a touch tighter. Larger camera.zoom = more
// world visible = zoomed out.
const FIT_MARGIN = 1.15;

type Bounds = { x: number; y: number; width: number; height: number };

// Last-resort framing if even the setup pose has no measurable bounds (e.g. a
// skeleton whose every attachment is hidden). Keeps the viewer usable.
const FALLBACK_BOUNDS: Bounds = { x: -100, y: -100, width: 200, height: 200 };

/**
 * Replicates spine-player's own fit math (Player.js drawFrame) from a
 * world-space bounding box and the live canvas size. We feed it OUR own
 * sampled bounds (see sampleAnimationBounds) — spine-player's per-animation
 * sampler is disabled (fixed config.viewport) because it calls a FATAL
 * showError on any content-less animation. Hard-guards every input so a
 * degenerate box can never lock a blank/NaN camera.
 */
function computeFit(
  cv: Bounds,
  canvasW: number,
  canvasH: number,
): { zoom: number; x: number; y: number } | null {
  const { x, y, width, height } = cv;
  if (
    !(canvasW > 0) ||
    !(canvasH > 0) ||
    !(width > 0) ||
    !(height > 0) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }
  const zoom =
    (canvasH / canvasW > height / width
      ? width / canvasW
      : height / canvasH) * FIT_MARGIN;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  return { zoom, x: x + width / 2, y: y + height / 2 };
}

function finiteBox(off: Vector2, size: Vector2): boolean {
  return (
    Number.isFinite(off.x) &&
    Number.isFinite(off.y) &&
    Number.isFinite(size.x) &&
    Number.isFinite(size.y) &&
    size.x > 0 &&
    size.y > 0
  );
}

/**
 * Build an ISOLATED skeleton from the live skeleton's data + current skin, so
 * bounds sampling never disturbs on-screen playback (vs. spine-player's
 * calculateAnimationViewport, which poses the live skeleton). Returns null if
 * the player has no skeleton yet.
 */
function makeProbe(p: SpinePlayer): Skeleton | null {
  const live = p.skeleton;
  if (!live) return null;
  const probe = new Skeleton(live.data);
  const skinName = live.skin?.name;
  if (skinName) probe.setSkinByName(skinName);
  probe.setSlotsToSetupPose();
  return probe;
}

/**
 * Our replacement for spine-player's calculateAnimationViewport: samples the
 * animation across its duration and unions skeleton.getBounds(). Same math,
 * but returns null for a content-less animation (e.g. a "STOP" state that
 * hides every attachment) instead of calling the fatal showError that kills
 * the whole player. Any unexpected throw from the spine API also degrades to
 * null (caller keeps the last good box) — resilience is the whole point of
 * owning this path.
 */
function sampleAnimationBounds(
  p: SpinePlayer,
  animationName: string,
): Bounds | null {
  try {
    const probe = makeProbe(p);
    const anim = probe && p.skeleton?.data.findAnimation(animationName);
    if (!probe || !anim) return null;
    probe.setToSetupPose();
    const steps = 64;
    const dur = anim.duration || 0;
    const dt = dur ? dur / steps : 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let any = false;
    const off = new Vector2();
    const size = new Vector2();
    const temp: number[] = [];
    for (let i = 0, t = 0; i < steps; i++, t += dt) {
      anim.apply(probe, t, t, false, [], 1, MixBlend.setup, MixDirection.mixIn);
      probe.updateWorldTransform(Physics.update);
      probe.getBounds(off, size, temp);
      if (finiteBox(off, size)) {
        any = true;
        minX = Math.min(minX, off.x);
        maxX = Math.max(maxX, off.x + size.x);
        minY = Math.min(minY, off.y);
        maxY = Math.max(maxY, off.y + size.y);
      }
      if (dt === 0) break; // static pose — one sample is enough.
    }
    if (!any) return null;
    const width = maxX - minX;
    const height = maxY - minY;
    if (!(width > 0) || !(height > 0)) return null;
    return { x: minX, y: minY, width, height };
  } catch {
    return null;
  }
}

/** Setup-pose bounds — the graceful fallback for a content-less animation. */
function sampleSetupBounds(p: SpinePlayer): Bounds | null {
  try {
    const probe = makeProbe(p);
    if (!probe) return null;
    probe.setToSetupPose();
    probe.updateWorldTransform(Physics.update);
    const off = new Vector2();
    const size = new Vector2();
    probe.getBounds(off, size, []);
    if (!finiteBox(off, size)) return null;
    return { x: off.x, y: off.y, width: size.x, height: size.y };
  } catch {
    return null;
  }
}

/**
 * Live render metrics. Returns null until the player has a canvas + camera
 * with a non-zero backing size (i.e. before the first renderer.resize).
 */
function readMetrics(
  p: SpinePlayer,
  container: HTMLDivElement | null,
): {
  cam: { zoom: number; position: { x: number; y: number }; update: () => void };
  canvasW: number;
  canvasH: number;
  vpW: number;
  vpH: number;
  clientW: number;
} | null {
  const sr = p.sceneRenderer;
  const canvas = p.canvas;
  if (!sr || !canvas) return null;
  const cam = sr.camera;
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  if (canvasW <= 0 || canvasH <= 0) return null;
  return {
    cam,
    canvasW,
    canvasH,
    vpW: cam.viewportWidth || canvasW,
    vpH: cam.viewportHeight || canvasH,
    clientW: container?.clientWidth ?? 0,
  };
}

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

/**
 * Initial-skin policy — owner-sanctioned 2026-05-19 amendment, byte-identical
 * to the 4.3 leg's pickInitialSkin (AnimationPlayerModal.tsx). Open on the
 * FULLEST skin (most attachments, JSON-order tiebreak via strict `>`) instead
 * of skins[0]: skins[0] is the authored "default" skin, which on skin-driven
 * rigs holds only skin-independent extras → near-blank canvas. No-op for
 * conventional rigs whose `default` is the fullest skin. availableSkins still
 * lists every skin in JSON order; only the initial selection moves.
 */
function pickInitialSkin(
  skins: ReadonlyArray<{
    name: string;
    getAttachments(): ReadonlyArray<unknown>;
  }>,
): string {
  if (skins.length === 0) return '';
  let best = skins[0];
  let bestCount = best.getAttachments().length;
  for (let i = 1; i < skins.length; i++) {
    const count = skins[i].getAttachments().length;
    if (count > bestCount) {
      best = skins[i];
      bestCount = count;
    }
  }
  return best.name;
}

export function AnimationPlayerModal42(props: AnimationPlayerModal42Props) {
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
  // Dopesheet-style current-frame readout (seconds → frames via
  // SkeletonData.fps, the editor's dopesheet rate; CLAUDE.md fact #1).
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  // Last committed integer frame — dedupes the rAF poll so React renders are
  // bounded by the animation's frame rate, not the display refresh rate.
  const lastFrameRef = useRef<number>(-1);

  // User-controlled camera (Phase 41+ — see CameraState doc). Lives in a ref
  // so the per-frame config.update reads it WITHOUT triggering React renders.
  const cameraRef = useRef<CameraState>({
    zoom: 1,
    x: 0,
    y: 0,
    initialized: false,
  });
  // In-flight drag. Pointer-captured on the container; null when not panning.
  const dragRef = useRef<{
    startX: number;
    startY: number;
    camX: number;
    camY: number;
  } | null>(null);
  // The editable zoom field mirrors the live camera; kept as a string so the
  // user can clear it / type freely before commit.
  const [zoomField, setZoomField] = useState<string>('100');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  // Current-animation bounds: a preformatted label for the readout, plus the
  // raw box driving Fit. Sampled on a throwaway skeleton (sampleAnimationBounds)
  // on init / animation / skin change — NOT per frame.
  const [boundsLabel, setBoundsLabel] = useState<string>('');
  const boundsRef = useRef<Bounds | null>(null);

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
    setCurrentFrame(0);
    lastFrameRef.current = -1;
    cameraRef.current = { zoom: 1, x: 0, y: 0, initialized: false };
    dragRef.current = null;
    boundsRef.current = null;
    setIsDragging(false);
    setZoomField('100');
    setBoundsLabel('');

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

      // Debug `moon-glow-double-squares` PART 2 — mirror buildAssetFeed's
      // isAtlasLess test (line 363). Atlas-less feeds the SYNTHESIZED atlas +
      // loose region PNGs, which are STRAIGHT (un-premultiplied) on disk; we
      // premultiply them at GPU upload below so Spine's screen/multiply blend
      // modes (which require premultiplied textures) render like the editor.
      const isAtlasLess =
        props.summary.atlasPath === null || props.loaderMode === 'atlas-less';

      const config: SpinePlayerConfig = {
        skeleton: feed.skeletonUrl,
        atlas: feed.atlasUrl,
        rawDataURIs: feed.rawDataURIs,
        showControls: false, // We own the control bar (anti-pattern from RESEARCH).
        backgroundColor: '23273200', // D-02c #232732 panel-surface, 00 alpha.
        // Debug `moon-glow-double-squares` — the render flag MUST match the GPU
        // texture encoding, NOT a hardcoded literal. (The OLD comment here claimed
        // the OS PNG decoder un-premultiplies — FALSE: spine-webgl keeps
        // UNPACK_PREMULTIPLY_ALPHA_WEBGL at WebGL's default and uploads PNG bytes
        // verbatim.)
        //   - Atlas-source: a pma:true atlas (e.g. Chicken/SYMBOLS) is premultiplied
        //     on disk → true; a straight atlas (SIMPLE_TEST, no `pma:`) → false.
        //     summary.premultipliedAlpha carries the loaded atlas's pma flag.
        //   - Atlas-less (PART 2): the loose images are STRAIGHT, but we premultiply
        //     them at GPU upload below (UNPACK_PREMULTIPLY_ALPHA_WEBGL=true), so the
        //     GPU texture IS premultiplied → true. Required because Spine's
        //     screen/multiply blend modes (srcRgb=ONE/DST_COLOR, never alpha-gated)
        //     flood the quad with the un-premult amplified-color halo otherwise.
        premultipliedAlpha: isAtlasLess
          ? true
          : props.summary.premultipliedAlpha,
        alpha: false,
        // Auto-fit neutralizer (see CameraState doc). spine-player calls this
        // every frame AFTER it sets ITS camera and BEFORE it draws — so
        // overwriting camera here is what actually renders. We freeze to a
        // user-controlled camera, defaulting to a self-computed Fit. (Our
        // bounds come from sampleAnimationBounds, not spine-player's sampler,
        // which is disabled via the fixed config.viewport below.)
        update: (p) => {
          const m = readMetrics(p, containerRef.current);
          if (!m) return;
          const cs = cameraRef.current;
          if (!cs.initialized) {
            if (!boundsRef.current) {
              let b: Bounds | null = null;
              const animName =
                p.animationState?.getCurrent(0)?.animation?.name;
              if (animName) b = sampleAnimationBounds(p, animName);
              if (!b) b = sampleSetupBounds(p);
              boundsRef.current = b ?? FALLBACK_BOUNDS;
              setBoundsLabel(
                b
                  ? `${Math.round(b.width)} × ${Math.round(b.height)} u`
                  : 'no visible content',
              );
            }
            const fit = computeFit(boundsRef.current, m.canvasW, m.canvasH);
            if (!fit) return;
            cs.zoom = fit.zoom;
            cs.x = fit.x;
            cs.y = fit.y;
            cs.initialized = true;
            setZoomField(
              String(
                Math.round(
                  clampPct(
                    percentFromZoom(m.canvasW, m.vpW, m.clientW, cs.zoom),
                  ),
                ),
              ),
            );
          }
          m.cam.zoom = cs.zoom;
          m.cam.position.x = cs.x;
          m.cam.position.y = cs.y;
          m.cam.update();
        },
        // Fixed dummy viewport. With x/y/width/height all present, spine-player
        // uses these verbatim and SKIPS calculateAnimationViewport entirely —
        // which is the whole point: that sampler calls a FATAL showError
        // ("Animation bounds are invalid: …") on any content-less animation
        // (e.g. a STOP state), permanently killing the player. The actual
        // values are irrelevant because `update` above overwrites the camera
        // every frame. `animations: {}` keeps the per-animation override
        // lookup from throwing; transitionTime: 0 disables the viewport lerp.
        viewport: {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          padLeft: 0,
          padRight: 0,
          padTop: 0,
          padBottom: 0,
          transitionTime: 0,
          animations: {},
        },
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
          // 2026-05-19 amendment: open on the FULLEST skin, not skins[0]
          // (skins[0] is the authored "default" skin → near-blank canvas on
          // skin-driven rigs). Mirrors the 4.3 leg verbatim.
          const initialSkin = pickInitialSkin(p.skeleton.data.skins);
          setActiveAnimation(initialAnim);
          setActiveSkin(initialSkin);
          // Default open state per D-04b: first animation + fullest skin +
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
        // Debug `moon-glow-double-squares` PART 2 — premultiply loose textures at
        // GPU upload for atlas-less. The SpinePlayer ctor calls initialize()
        // synchronously (Player.js:97), which creates the GL context AND only
        // STARTS async texture loading (texImage2D fires later on Image.onload), so
        // setting this now lands before every texture upload. Spine's screen/multiply
        // blend modes require premultiplied textures; the loose "Alpha: Auto"
        // extracted images are straight (un-premultiplied) with amplified color in
        // their transparent regions, which those blend modes would flood across each
        // quad (the atlas-less squares). This makes WebGL premultiply on upload —
        // exactly what the Spine editor does for loose images — paired with
        // premultipliedAlpha:true above. Atlas-source is untouched (its pages are
        // already premultiplied on disk; double-premultiply would be wrong).
        if (isAtlasLess) {
          const gl = player.context?.gl;
          if (gl) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        }
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

  // Re-sample the current animation's bounds (live anim + skin read off the
  // player) for the Fit target + readout. A content-less animation keeps the
  // last good box so zoom/pan stay fixed across animations (the core ask) and
  // the viewer never crashes.
  const refreshBounds = useCallback((p: SpinePlayer) => {
    const animName = p.animationState?.getCurrent(0)?.animation?.name;
    const b = animName ? sampleAnimationBounds(p, animName) : null;
    if (b) {
      boundsRef.current = b;
      setBoundsLabel(`${Math.round(b.width)} × ${Math.round(b.height)} u`);
      return;
    }
    setBoundsLabel('no visible content');
    if (!boundsRef.current) {
      boundsRef.current = sampleSetupBounds(p) ?? FALLBACK_BOUNDS;
    }
  }, []);

  // Animation change handler (Pattern 3 — VIEWER-05).
  const onAnimationChange = useCallback(
    (name: string) => {
      const p = playerRef.current;
      if (!p) return;
      p.setAnimation(name, true); // loop on per D-04b
      setActiveAnimation(name);
      refreshBounds(p);
    },
    [refreshBounds],
  );

  // Skin change handler (Pattern 3 — VIEWER-05). Call order matters: name
  // first, then setSlotsToSetupPose to rebind the new skin's attachments.
  const onSkinChange = useCallback(
    (name: string) => {
      const p = playerRef.current;
      if (!p?.skeleton) return;
      p.skeleton.setSkinByName(name);
      p.skeleton.setSlotsToSetupPose();
      setActiveSkin(name);
      refreshBounds(p);
    },
    [refreshBounds],
  );

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
    const frame = Math.round(targetTime * (p.skeleton.data.fps || 30));
    lastFrameRef.current = frame;
    setCurrentFrame(frame);
    setScrubPercent(percentage);
    setIsPaused(true);
  }, []);

  // Live timeline poll. spine-player exposes no per-frame React hook we may
  // use — config.update is the camera path and MUST NOT setState per frame
  // (see the CameraState doc) — so we run our own rAF loop while the modal is
  // open and the player is ready. It reads ONLY the public TrackEntry surface
  // (getAnimationTime already handles looping/clamping) and commits state only
  // when the integer frame changes, so the slider thumb and the `f N` readout
  // advance in lock-step during playback and stay put while paused/scrubbed.
  useEffect(() => {
    if (!props.open || playerState !== 'ready') return;
    let raf = 0;
    const tick = () => {
      const p = playerRef.current;
      const entry = p?.animationState?.getCurrent(0);
      if (entry && entry.animation && p?.skeleton) {
        const fps = p.skeleton.data.fps || 30;
        const time = entry.getAnimationTime();
        const duration = entry.animation.duration;
        const frame = Math.round(time * fps);
        if (frame !== lastFrameRef.current) {
          lastFrameRef.current = frame;
          setCurrentFrame(frame);
          setScrubPercent(duration > 0 ? time / duration : 0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.open, playerState]);

  // Mouse-wheel zoom, anchored to the cursor (the world point under the
  // pointer stays put). Native non-passive listener — React's onWheel is
  // passive in many setups, so e.preventDefault() (stop page scroll) is
  // unreliable there. Re-bound when the modal opens (the container div only
  // exists while open).
  useEffect(() => {
    if (!props.open) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const p = playerRef.current;
      if (!p) return;
      const cs = cameraRef.current;
      if (!cs.initialized) return;
      const m = readMetrics(p, el);
      if (!m) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width; // 0..1
      const sy = (e.clientY - rect.top) / rect.height; // 0..1
      const worldW = cs.zoom * m.vpW;
      const worldH = cs.zoom * m.vpH;
      // World point currently under the cursor (y is flipped: screen-down =
      // world-down here because position.y grows upward).
      const wx = cs.x + (sx - 0.5) * worldW;
      const wy = cs.y - (sy - 0.5) * worldH;
      // deltaY > 0 = wheel toward user = zoom OUT = larger camera.zoom.
      let nz = cs.zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1);
      const pct = clampPct(percentFromZoom(m.canvasW, m.vpW, m.clientW, nz));
      nz = zoomFromPercent(m.canvasW, m.vpW, m.clientW, pct);
      const nWorldW = nz * m.vpW;
      const nWorldH = nz * m.vpH;
      cs.zoom = nz;
      cs.x = wx - (sx - 0.5) * nWorldW;
      cs.y = wy + (sy - 0.5) * nWorldH;
      setZoomField(String(Math.round(pct)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [props.open]);

  // Drag-to-pan. Pointer-captured on the container so a drag that leaves the
  // canvas keeps panning. Pan is in viewport fractions → world units, so it's
  // independent of the device-pixel basis.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const cs = cameraRef.current;
    if (!cs.initialized) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      camX: cs.x,
      camY: cs.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const p = playerRef.current;
      const el = containerRef.current;
      if (!p || !el) return;
      const m = readMetrics(p, el);
      if (!m) return;
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - d.startX) / rect.width;
      const fy = (e.clientY - d.startY) / rect.height;
      const cs = cameraRef.current;
      cs.x = d.camX - fx * cs.zoom * m.vpW;
      cs.y = d.camY + fy * cs.zoom * m.vpH;
    },
    [],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released — idempotent */
    }
    setIsDragging(false);
  }, []);

  // Fit / double-click: re-adopt spine-player's auto-fit for the CURRENT
  // animation once, then re-freeze (the CameraState freeze latch).
  const onFit = useCallback(() => {
    cameraRef.current.initialized = false;
  }, []);

  // Commit the typed zoom %. Keeps the camera center fixed (zoom about the
  // canvas center); only the scale changes.
  const commitZoom = useCallback(() => {
    const p = playerRef.current;
    const cs = cameraRef.current;
    if (!p || !cs.initialized) return;
    const m = readMetrics(p, containerRef.current);
    if (!m) return;
    const raw = parseFloat(zoomField);
    if (!Number.isFinite(raw)) {
      setZoomField(
        String(
          Math.round(percentFromZoom(m.canvasW, m.vpW, m.clientW, cs.zoom)),
        ),
      );
      return;
    }
    const pct = clampPct(raw);
    cs.zoom = zoomFromPercent(m.canvasW, m.vpW, m.clientW, pct);
    setZoomField(String(Math.round(pct)));
  }, [zoomField]);

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
            className="w-56 bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
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
            className="w-56 bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
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

          <span
            className="text-xs text-fg-muted w-12 text-right tabular-nums"
            aria-label={`Current frame ${currentFrame}`}
          >
            f {currentFrame}
          </span>
        </div>

        {/* Zoom / pan control row. The viewer no longer auto-zooms per
            animation — scale is fixed and user-driven. */}
        <div className="flex items-center gap-3 pb-3 mb-1 text-xs text-fg-muted">
          <label htmlFor="animation-viewer-zoom" className="text-fg-muted">
            Zoom
          </label>
          <div className="flex items-center">
            <input
              id="animation-viewer-zoom"
              type="text"
              inputMode="numeric"
              value={zoomField}
              onChange={(e) => setZoomField(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitZoom();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={commitZoom}
              disabled={controlsDisabled}
              className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg w-16 text-right disabled:opacity-50"
              aria-label="Zoom percentage (100 = actual size)"
            />
            <span className="ml-1">%</span>
          </div>
          <button
            type="button"
            onClick={onFit}
            disabled={controlsDisabled}
            className={clsx(
              'border border-border rounded-md px-3 py-1 text-xs transition-colors hover:border-accent hover:text-accent disabled:hover:border-border disabled:hover:text-fg',
              controlsDisabled && 'opacity-50',
            )}
          >
            Fit
          </button>
          <span className="text-fg-muted/70">
            scroll = zoom · drag = pan · double-click = fit
          </span>
          {boundsLabel && (
            <span className="ml-auto text-fg-muted">
              Rig bounds: {boundsLabel}
            </span>
          )}
        </div>

        {/* Player container — Pitfall 8 (MUST have flex-1 AND inline minHeight).
            Without both, spine-player's inner canvas (`width:100%;height:100%`)
            collapses to 1×1 px and the modal looks blank. */}
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onFit}
          className={clsx(
            'flex-1 overflow-hidden bg-[#232732] border border-border rounded-md',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
          )}
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
