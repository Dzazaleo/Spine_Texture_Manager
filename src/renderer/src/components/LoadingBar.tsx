/**
 * Indeterminate loading bar shown while a dropped Spine skeleton's images
 * + atlas are being processed — i.e. App.tsx's `loading` AppState, the
 * window between the drop and the Global panel populating.
 *
 * Indeterminate by design (decision 2026-05-15): the initial-load path
 * (`handleSkeletonLoad` in src/main/ipc.ts) runs `loadSkeleton` +
 * `sampleSkeleton` synchronously on the main process and emits no
 * intermediate progress, so this is a continuous left→right sweep rather
 * than a percentage fill. The renderer process is NOT blocked by the
 * main-process sampler, so the CSS animation keeps running smoothly for
 * the full duration of a multi-second sample.
 *
 * Accessibility: `role="progressbar"` WITHOUT `aria-valuenow` is the
 * canonical ARIA signal for an indeterminate operation (a determinate
 * bar would carry valuemin/valuemax/valuenow). The keyframe and the
 * prefers-reduced-motion fallback live in index.css under
 * `.loading-bar-sweep` — Tailwind v4 has no built-in utility for a
 * custom sweep keyframe. Every className here is a string literal
 * (Pitfall 8 — Tailwind v4 scanner safe; do not refactor to template
 * strings).
 */
interface LoadingBarProps {
  /** Basename of the file being processed; rendered in the caption. */
  fileName?: string;
}

export function LoadingBar({ fileName }: LoadingBarProps) {
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-3">
      <p className="text-fg-muted font-mono text-sm">
        {fileName !== undefined && fileName.length > 0 ? (
          <>
            Loading <code className="text-fg">{fileName}</code>…
          </>
        ) : (
          'Loading…'
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Processing images and atlas"
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-border"
      >
        <span
          aria-hidden="true"
          className="loading-bar-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-accent"
        />
      </div>
      <p className="text-fg-muted font-mono text-xs">
        Processing images &amp; atlas…
      </p>
    </div>
  );
}
