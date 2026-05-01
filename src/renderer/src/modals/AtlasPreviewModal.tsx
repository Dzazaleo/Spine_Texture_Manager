/**
 * Phase 7 Plan 04 — Hand-rolled ARIA modal for Atlas Preview (F7.1 + F7.2).
 *
 * Three-axis state (D-128 + D-131 snapshot-at-open):
 *   - mode: 'original' | 'optimized' (segmented toggle)
 *   - maxPageDim: 2048 | 4096 (segmented toggle)
 *   - currentPageIndex: number (pager)
 *
 * Plus derived state:
 *   - projection: AtlasPreviewProjection — recomputed via useMemo([summary,
 *     overrides, mode, maxPageDim]); D-131 captures overrides at mount and
 *     does NOT subscribe to changes — user closes + reopens to refresh.
 *   - hoveredAttachmentName: string | null (mousemove hit-test result)
 *
 * ARIA scaffold cloned verbatim from OverrideDialog.tsx (Phase 4 D-81)
 * + OptimizeDialog.tsx (Phase 6 Round 6): role='dialog' + aria-modal='true' +
 * aria-labelledby + outer overlay onClick=onClose + inner stopPropagation;
 * Tab cycle + document-level Escape via useFocusTrap (Phase 6 Round 6).
 *
 * Canvas:
 *   - dpr-aware backing store (canvas.width/height = page.width × dpr;
 *     canvas.style.width/height = page.width); ctx.scale(dpr, dpr).
 *   - drawImage 9-arg form for atlas-packed (srcRect crops region from page
 *     atlas) and full-image for per-region PNGs (RESEARCH §Pattern 4).
 *   - Hover: linear-scan hit-test (RESEARCH §Code Examples 2; O(N) acceptable
 *     per CONTEXT §Claude's Discretion).
 *   - Dblclick: same hit-test → props.onJumpToAttachment(region.attachmentName).
 *
 * Image cache: hoisted into useRef per Pitfall 4 (no module-scope leaks).
 *   <img> sources are app-image:// URLs constructed in main via
 *   `window.api.pathToImageUrl(absolutePath)` (Phase 12 Plan 03 D-19 — F1
 *   Windows fix). The bridge returns Promise<string>, so img.src is set
 *   inside a .then() callback after the bridge resolves; the existing
 *   onload/onerror callbacks fire when the resulting <img> finishes
 *   loading. Combined onerror + naturalWidth===0 detection per Pitfall 5
 *   (CSP block edge case). Renderer must NOT construct the URL inline —
 *   naive concat (`app-image://localhost${path}`) glues Windows drive
 *   letters onto the host, producing 'localhostc' 404s
 *   (11-WIN-FINDINGS §F1).
 *
 * Tailwind v4 literal-class discipline (RESEARCH Pitfall 3 + 8): every
 * className is a string literal or clsx with literal branches.
 *
 * Layer 3 invariant: imports only from react + clsx + ../../../shared/types.js
 * + ../lib/atlas-preview-view.js (renderer inline copy) + ../hooks/useFocusTrap.
 * NEVER from ../../core/* (tests/arch.spec.ts gate at lines 19-34).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import clsx from 'clsx';
import type {
  SkeletonSummary,
  AtlasPreviewProjection,
  AtlasPage,
  PackedRegion,
} from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { buildAtlasPreview } from '../lib/atlas-preview-view.js';

export interface AtlasPreviewModalProps {
  open: boolean;
  summary: SkeletonSummary;
  overrides: ReadonlyMap<string, number>;
  onJumpToAttachment: (attachmentName: string) => void;
  onClose: () => void;
  /**
   * Phase 19 UI-03 + D-11/D-12 — REQUIRED cross-nav handler. The modal
   * renders a footer-LEFT outlined-secondary button that invokes
   * `props.onClose()` THEN `props.onOpenOptimizeDialog()` (sequential mount
   * per D-11; AppShell's onClickOptimize re-runs the full async
   * output-picker + plan-builder flow — the user re-picks the output
   * directory on cross-nav, acceptable phase-scope behaviour per
   * orchestrator's revision-pass lock). Plan 19-03 pre-emptively added the
   * prop type definition (interim OPTIONAL) + the AppShell-side binding
   * `onOpenOptimizeDialog={onClickOptimize}`; Plan 19-07 tightens to
   * REQUIRED here because the cross-nav button consumes the prop
   * unconditionally in render.
   */
  onOpenOptimizeDialog: () => void;
}

export function AtlasPreviewModal(props: AtlasPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // ARIA scaffold: focus trap + Tab cycle + ESC via shared hook.
  // useCallback narrowness (Pitfall 8): props.onClose is the literal callback,
  // NOT a wrapped one with broad deps.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  // D-135 default state.
  const [mode, setMode] = useState<'original' | 'optimized'>('optimized');
  const [maxPageDim, setMaxPageDim] = useState<2048 | 4096>(2048);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hoveredAttachmentName, setHoveredAttachmentName] = useState<string | null>(null);

  // D-131 snapshot-at-open: useMemo on the three axes + summary + overrides.
  // Overrides Map identity is captured here; changes after mount are ignored.
  const projection: AtlasPreviewProjection = useMemo(
    () => buildAtlasPreview(props.summary, props.overrides, { mode, maxPageDim }),
    [props.summary, props.overrides, mode, maxPageDim],
  );

  // Phase 19 UI-03 + D-10 — summary-tile derivations. Three values rendered
  // in the new flex gap-3 mb-4 row above the body. Derived as plain constants
  // (not a useMemo) because `projection` is itself the existing memo — these
  // reduces re-run only when `projection` changes, which is exactly when the
  // user flips the `mode` toggle (or maxPageDim, or summary/overrides). Cost
  // is O(N pages) which is small. UI-SPEC §8 line 446 explicitly accepts
  // inline derived constants here.
  const totalPages = projection.totalPages;
  const totalRegions = projection.pages.reduce(
    (acc, p) => acc + p.regions.length,
    0,
  );
  const totalUsedPixels = projection.pages.reduce(
    (acc, p) => acc + p.usedPixels,
    0,
  );
  const totalPagePixels = projection.pages.reduce(
    (acc, p) => acc + p.totalPixels,
    0,
  );
  const utilizationPct =
    totalPagePixels > 0 ? (totalUsedPixels / totalPagePixels) * 100 : 0;

  // Clamp currentPageIndex when toggle changes shrink pages.length.
  useEffect(() => {
    if (currentPageIndex >= projection.totalPages) {
      setCurrentPageIndex(Math.max(0, projection.totalPages - 1));
    }
  }, [projection.totalPages, currentPageIndex]);

  const currentPage = projection.pages[currentPageIndex] ?? projection.pages[0];

  // Image cache (Pitfall 4 — hoisted into useRef so unmount frees it).
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const missingPathsRef = useRef(new Set<string>());
  const [imageCacheVersion, setImageCacheVersion] = useState(0);

  const loadImage = useCallback((absolutePath: string): HTMLImageElement => {
    const existing = imageCacheRef.current.get(absolutePath);
    if (existing) return existing;
    const img = new Image();
    img.onload = () => {
      // Combined check (Pitfall 5): some browsers swallow onerror under CSP block;
      // naturalWidth === 0 catches that case + decode failures.
      if (img.naturalWidth === 0) missingPathsRef.current.add(absolutePath);
      setImageCacheVersion((v) => v + 1);
    };
    img.onerror = () => {
      missingPathsRef.current.add(absolutePath);
      setImageCacheVersion((v) => v + 1);
    };
    // Phase 12 Plan 03 (D-19) — F1 Windows-runtime fix.
    //
    // The previous shape (renderer-side string concat of an app-image
    // URL with the encodeURI'd absolutePath) produced a malformed URL
    // on Windows: encodeURI preserves ':', so the drive letter `C:` got
    // glued onto 'localhost' and the URL parser saw host='localhostc'
    // (lowercased; up to first ':') — the protocol handler 404'd and
    // the atlas preview only showed outline rectangles instead of the
    // underlying texture (11-WIN-FINDINGS §F1). See the buggy-shape
    // anti-test at tests/renderer/atlas-preview-modal.spec.tsx
    // §"F1 regression" for the pinned failure mode.
    //
    // The bridge returns Promise<string> (RESEARCH Open Question 1 was
    // pre-resolved at plan time → IPC-invoke variant unconditionally).
    // We can't make loadImage itself async without cascading to many call
    // sites, so .then() sets img.src after the bridge resolves; the
    // existing onload/onerror callbacks fire whenever the <img> finishes
    // loading the bytes. The HTMLImageElement is returned synchronously
    // and inserted into the cache so concurrent callers reuse the same
    // <img> instance regardless of which one's bridge resolves first.
    void window.api.pathToImageUrl(absolutePath).then((url) => {
      img.src = url;
    });
    imageCacheRef.current.set(absolutePath, img);
    return img;
  }, []);

  // Lazy-load every region's source on currentPage change.
  useEffect(() => {
    if (!currentPage) return;
    for (const region of currentPage.regions) {
      const path = region.atlasSource?.pagePath ?? region.sourcePath;
      if (path) loadImage(path);
    }
  }, [currentPage, loadImage]);

  // Pager handlers — narrow useCallback deps (Pitfall 8).
  const goPrev = useCallback(() => {
    setCurrentPageIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setCurrentPageIndex((i) => Math.min(projection.totalPages - 1, i + 1));
  }, [projection.totalPages]);

  if (!props.open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 w-[1024px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <h2 id="atlas-preview-title" className="text-sm text-fg">
            Atlas Preview
            <span className="ml-2 text-fg-muted">
              {`Visual estimation of packed textures (${maxPageDim}×${maxPageDim})`}
            </span>
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

        {/* Phase 19 UI-03 + D-10 — summary tiles (Pages / Regions / Utilization).
            Re-derive on mode toggle via the existing `projection` memo. */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
            <span className="text-base font-semibold text-fg">{totalPages}</span>
            <span className="text-xs text-fg-muted text-center">Pages</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
            <span className="text-base font-semibold text-fg">{totalRegions}</span>
            <span className="text-xs text-fg-muted text-center">Regions</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
            <span className="text-base font-semibold text-fg">{utilizationPct.toFixed(1)}%</span>
            <span className="text-xs text-fg-muted text-center">Utilization</span>
          </div>
        </div>

        {/* Body: left rail + main canvas */}
        <div className="flex flex-1 gap-4 overflow-hidden">
          <LeftRail
            mode={mode}
            setMode={setMode}
            maxPageDim={maxPageDim}
            setMaxPageDim={setMaxPageDim}
            currentPageIndex={currentPageIndex}
            totalPages={projection.totalPages}
            onPrev={goPrev}
            onNext={goNext}
            efficiency={currentPage?.efficiency ?? 0}
          />
          <main className="flex-1 overflow-hidden flex flex-col gap-2">
            {projection.oversize.length > 0 && (
              <div
                role="alert"
                className="text-xs px-3 py-2 border rounded-md"
                style={{ borderColor: 'var(--color-danger, #e06b55)', color: 'var(--color-danger, #e06b55)' }}
              >
                {`${projection.oversize.length} attachment${projection.oversize.length === 1 ? '' : 's'} exceed the ${maxPageDim}px atlas and ${projection.oversize.length === 1 ? 'is' : 'are'} excluded from this preview: ${projection.oversize.join(', ')}`}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <AtlasCanvas
                page={currentPage}
                frameDim={maxPageDim}
                hoveredAttachmentName={hoveredAttachmentName}
                setHoveredAttachmentName={setHoveredAttachmentName}
                loadImage={loadImage}
                missingPaths={missingPathsRef.current}
                imageCacheVersion={imageCacheVersion}
                onJumpToAttachment={props.onJumpToAttachment}
              />
            </div>
          </main>
        </div>

        {/* Footer disclaimer (D-132 footer copy) + cross-nav (Phase 19 D-12) */}
        <div className="flex justify-between items-center mt-4">
          <button
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenOptimizeDialog();
            }}
            disabled={props.summary.peaks.length === 0}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
          >
            <span aria-hidden="true">→ </span>Optimize Assets
          </button>
          <p className="text-xs text-fg-muted italic">
            * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Sub-component: left-rail control panel.
 * Hosts mode toggle, resolution toggle, pager, and the two info cards.
 * Tailwind literal-class discipline (Pitfall 3): clsx with literal branches.
 */
interface LeftRailProps {
  mode: 'original' | 'optimized';
  setMode: (m: 'original' | 'optimized') => void;
  maxPageDim: 2048 | 4096;
  setMaxPageDim: (d: 2048 | 4096) => void;
  currentPageIndex: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  efficiency: number;
}

function LeftRail(p: LeftRailProps) {
  return (
    <aside className="w-56 flex flex-col gap-3">
      {/* VIEW MODE */}
      <div>
        <h3 className="text-xs text-fg-muted mb-1">VIEW MODE</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => p.setMode('original')}
            className={clsx(
              'border border-border rounded-md px-3 py-1 text-xs font-mono transition-colors',
              p.mode === 'original'
                ? 'bg-accent text-panel font-semibold'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => p.setMode('optimized')}
            className={clsx(
              'border border-border rounded-md px-3 py-1 text-xs font-mono transition-colors',
              p.mode === 'optimized'
                ? 'bg-accent text-panel font-semibold'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            Optimized
          </button>
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          {p.mode === 'original'
            ? 'Showing source/unoptimized sizes'
            : 'Showing calculated max render sizes'}
        </p>
      </div>

      {/* ATLAS RESOLUTION */}
      <div>
        <h3 className="text-xs text-fg-muted mb-1">ATLAS RESOLUTION</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => p.setMaxPageDim(2048)}
            className={clsx(
              'border border-border rounded-md px-3 py-1 text-xs font-mono transition-colors',
              p.maxPageDim === 2048
                ? 'bg-accent text-panel font-semibold'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            2048px
          </button>
          <button
            type="button"
            onClick={() => p.setMaxPageDim(4096)}
            className={clsx(
              'border border-border rounded-md px-3 py-1 text-xs font-mono transition-colors',
              p.maxPageDim === 4096
                ? 'bg-accent text-panel font-semibold'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            4096px
          </button>
        </div>
      </div>

      {/* ATLAS PAGE pager */}
      <div>
        <h3 className="text-xs text-fg-muted mb-1">ATLAS PAGE</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={p.onPrev}
            disabled={p.currentPageIndex === 0}
            className="border border-border rounded-md px-2 py-1 text-xs font-mono text-fg hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
            aria-label="Previous page"
          >
            &lt;
          </button>
          <span className="text-xs text-fg-muted">
            {`${p.currentPageIndex + 1} / ${p.totalPages}`}
          </span>
          <button
            type="button"
            onClick={p.onNext}
            disabled={p.currentPageIndex >= p.totalPages - 1}
            className="border border-border rounded-md px-2 py-1 text-xs font-mono text-fg hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
            aria-label="Next page"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* TOTAL ATLASES card */}
      <InfoCard
        label="TOTAL ATLASES"
        value={String(p.totalPages)}
        sub={p.totalPages === 1 ? '1 page' : `${p.totalPages} pages`}
      />

      {/* EFFICIENCY card */}
      <InfoCard
        label={`EFFICIENCY (PAGE ${p.currentPageIndex + 1})`}
        value={`${p.efficiency.toFixed(1)}%`}
        sub={`${(100 - p.efficiency).toFixed(1)}% Empty Space`}
      />
    </aside>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  sub: string;
}
function InfoCard({ label, value, sub }: InfoCardProps) {
  return (
    <div className="border border-border rounded-md p-3 bg-surface">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="text-2xl font-semibold text-fg">{value}</div>
      <div className="text-xs text-fg-muted">{sub}</div>
    </div>
  );
}

/**
 * Sub-component: canvas with dpr scaling, hover hit-test, dblclick gesture,
 * drawImage of region content, missing-source placeholder pattern.
 */
interface AtlasCanvasProps {
  page: AtlasPage | undefined;
  frameDim: 2048 | 4096;
  hoveredAttachmentName: string | null;
  setHoveredAttachmentName: (name: string | null) => void;
  loadImage: (absolutePath: string) => HTMLImageElement;
  missingPaths: Set<string>;
  imageCacheVersion: number;
  onJumpToAttachment: (attachmentName: string) => void;
}

function AtlasCanvas({
  page,
  frameDim,
  hoveredAttachmentName,
  setHoveredAttachmentName,
  loadImage,
  missingPaths,
  imageCacheVersion,
  onJumpToAttachment,
}: AtlasCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    // D-139 amendment (Plan 06 follow-up): canvas backing-store and display-frame
    // stay at the user-selected maxPageDim × maxPageDim so the canvas frame is a
    // fixed reference across pages and overrides — empty space stays visible
    // ("you can see how much capacity is unused"). Regions are drawn at their
    // packed (x, y, w, h) coords inside this fixed frame.
    canvas.width = frameDim * dpr;
    canvas.height = frameDim * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom returns null — test env safety
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, frameDim, frameDim);

    for (const region of page.regions) {
      const sourceUrl = region.atlasSource?.pagePath ?? region.sourcePath;
      const isMissing = missingPaths.has(sourceUrl);
      const img = sourceUrl ? loadImage(sourceUrl) : null;
      if (img && img.complete && img.naturalWidth > 0 && !isMissing) {
        if (region.atlasSource) {
          ctx.drawImage(
            img,
            region.atlasSource.x,
            region.atlasSource.y,
            region.atlasSource.w,
            region.atlasSource.h,
            region.x,
            region.y,
            region.w,
            region.h,
          );
        } else {
          ctx.drawImage(
            img,
            0,
            0,
            img.naturalWidth,
            img.naturalHeight,
            region.x,
            region.y,
            region.w,
            region.h,
          );
        }
      } else if (isMissing) {
        // D-137 placeholder: muted pattern + ⚠ glyph in --color-danger.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(region.x, region.y, region.w, region.h);
        ctx.fillStyle = 'var(--color-danger, #e06b55)';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠', region.x + region.w / 2, region.y + region.h / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }

      // Always: outline + (if hovered) overlay + label.
      const isHovered = hoveredAttachmentName === region.attachmentName;
      ctx.strokeStyle = isHovered ? 'rgba(249, 115, 22, 1)' : 'rgba(255, 255, 255, 0.4)';
      ctx.strokeRect(region.x, region.y, region.w, region.h);
      if (isHovered) {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
        ctx.fillRect(region.x, region.y, region.w, region.h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '12px sans-serif';
        ctx.fillText(region.attachmentName, region.x + 4, region.y + 14);
        ctx.fillText(`${Math.round(region.w)} × ${Math.round(region.h)}`, region.x + 4, region.y + 28);
      }
    }
  }, [page, frameDim, hoveredAttachmentName, imageCacheVersion, loadImage, missingPaths]);

  const hitTest = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>): PackedRegion | null => {
      const canvas = canvasRef.current;
      if (!canvas || !page) return null;
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const x = (cssX / Math.max(rect.width, 1)) * frameDim;
      const y = (cssY / Math.max(rect.height, 1)) * frameDim;
      for (const region of page.regions) {
        if (
          x >= region.x &&
          x < region.x + region.w &&
          y >= region.y &&
          y < region.y + region.h
        ) {
          return region;
        }
      }
      return null;
    },
    [page, frameDim],
  );

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const hit = hitTest(e);
      setHoveredAttachmentName(hit?.attachmentName ?? null);
    },
    [hitTest, setHoveredAttachmentName],
  );

  const onDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      const hit = hitTest(e);
      if (hit) onJumpToAttachment(hit.attachmentName);
    },
    [hitTest, onJumpToAttachment],
  );

  if (!page) return <div className="text-fg-muted text-xs">No projection.</div>;

  // D-139 (Plan 06 amendment): canvas frame is the fixed maxPageDim × maxPageDim
  // square — empty space stays visible so the user sees how much page capacity
  // is unused. Pages do NOT shrink to packed-content bounds. This eliminates
  // the "page jump" between pager clicks and override changes (each page would
  // otherwise have a different bin size from the tight-fit packer at D-132).
  // Backing-store: frameDim × dpr × frameDim × dpr (set in the useEffect above).
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="aspect-[1/1] w-full max-w-full max-h-full"
        style={{ maxWidth: `${frameDim}px`, maxHeight: `${frameDim}px` }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Packed atlas page ${page.pageIndex + 1}, ${page.regions.length} regions, ${page.efficiency.toFixed(1)}% efficiency`}
          className="block w-full h-full border border-border"
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHoveredAttachmentName(null)}
          onDoubleClick={onDoubleClick}
        />
      </div>
    </div>
  );
}
