# Phase 41: Spine Animation Viewer — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 9 (4 new + 5 modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/modals/AnimationPlayerModal.tsx` (NEW) | modal-component | renderer-only-UI (WebGL via spine-player) | `src/renderer/src/modals/AtlasPreviewModal.tsx` | exact (sibling) |
| `tests/renderer/animation-player-modal.spec.tsx` (NEW) | test-spec (jsdom) | unit | `tests/renderer/atlas-preview-modal.spec.tsx` | exact (sibling) |
| `tests/renderer/app-shell-animation-viewer.spec.tsx` (NEW) | test-spec (source-grep) | unit | `tests/renderer/app-shell-atlas-state.spec.tsx` | exact (sibling) |
| `tests/main/viewer-asset-feed-ipc.spec.ts` (NEW, conditional on Option A) | test-spec (main IPC handler) | unit | `tests/main/ipc.spec.ts` (Map-backed `ipcMain.handle` captor pattern) | exact |
| `src/renderer/src/components/AppShell.tsx` (MODIFY) | toolbar-wiring + state-slot + JSX-mount + modalOpen-derivation | renderer-only-UI | self (existing `atlasPreviewOpen` slot pattern) | self-reference |
| `src/main/ipc.ts` (MODIFY — Option A only) | IPC-handler (invoke) | renderer-↔-main IPC | self — `atlas:resolve-image-url` handler (lines 1234-1248) + `documentation:exportHtml` (line 1299) | exact (sibling) |
| `src/preload/index.ts` (MODIFY — Option A only) | preload-bridge | renderer-↔-main IPC | self — `pathToImageUrl` (line 648-649) | exact (sibling) |
| `src/shared/types.ts` (MODIFY — Option A only) | shared-type (IPC envelope + Api method signature) | type-only | `Api.pathToImageUrl` signature (line 1726) | exact (sibling) |
| `package.json` (MODIFY) | package-manifest | dev-time dependency-pin | existing `@esotericsoftware/spine-core` line 26 | exact (sibling — same author) |

---

## Pattern Assignments

### `src/renderer/src/modals/AnimationPlayerModal.tsx` (modal-component, renderer-only-UI)

**Primary analog:** `src/renderer/src/modals/AtlasPreviewModal.tsx`

#### Imports pattern — `AtlasPreviewModal.tsx:50-66`
```typescript
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
```

**Adapt for viewer:** drop `AtlasPreviewProjection`/`AtlasPage`/`PackedRegion`/`buildAtlasPreview`; add:
```typescript
import { SpinePlayer, type SpinePlayerConfig } from '@esotericsoftware/spine-player';
import type { SkeletonSummary } from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';
```

#### Layer-3 invariant comment header — `AtlasPreviewModal.tsx:46-48`
```typescript
* Layer 3 invariant: imports only from react + clsx + ../../../shared/types.js
* + ../lib/atlas-preview-view.js (renderer inline copy) + ../hooks/useFocusTrap.
* NEVER from ../../core/* (tests/arch.spec.ts gate at lines 19-34).
```
Viewer adds `@esotericsoftware/spine-player` (node_modules — allowed; not a `src/core/*` import).

#### Props interface — `AtlasPreviewModal.tsx:68-103`
```typescript
export interface AtlasPreviewModalProps {
  open: boolean;
  summary: SkeletonSummary;
  overrides: ReadonlyMap<string, number>;
  onJumpToRegion: (regionName: string) => void;
  onClose: () => void;
  onOpenOptimizeDialog: () => void;
  safetyBufferPercent: number;
}
```

**Adapt for viewer:** drop overrides/safetyBufferPercent/onJumpToRegion/onOpenOptimizeDialog; add `loaderMode: 'auto' | 'atlas-less'` (per RESEARCH Q2 — derive `isAtlasLess` from `summary.atlasPath === null || loaderMode === 'atlas-less'`).
```typescript
export interface AnimationPlayerModalProps {
  open: boolean;
  summary: SkeletonSummary;
  loaderMode: 'auto' | 'atlas-less';
  onClose: () => void;
}
```

#### `useFocusTrap` activation — `AtlasPreviewModal.tsx:106-111`
```typescript
export function AtlasPreviewModal(props: AtlasPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // ARIA scaffold: focus trap + Tab cycle + ESC via shared hook.
  // useCallback narrowness (Pitfall 8): props.onClose is the literal callback,
  // NOT a wrapped one with broad deps.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });
```

**Critical:** pass `props.onClose` directly (not a wrapped lambda) per the explicit Pitfall-8 narrowness comment. The hook re-runs on `onEscape` identity change.

#### Open-gate early return — `AtlasPreviewModal.tsx:232`
```typescript
  if (!props.open) return null;
```
Placed AFTER all hooks but BEFORE the return JSX, mirroring this exact placement.

#### ARIA scaffold (overlay + inner card + header) — `AtlasPreviewModal.tsx:234-263`
```typescript
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
        className="bg-modal border border-border rounded-md p-6 w-[1024px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono shadow-2xl"
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
```

**Adapt for viewer:**
- Change `aria-labelledby="atlas-preview-title"` → `"animation-viewer-title"`.
- Change `<h2 id="atlas-preview-title">Atlas Preview` → `<h2 id="animation-viewer-title">Animation Viewer`.
- Outer div class stays IDENTICAL (`fixed inset-0 z-50 flex items-center justify-center bg-black/40`).
- Inner card class stays IDENTICAL but consider `w-[1280px]` (RESEARCH Code Example 2 picks 1280; AtlasPreviewModal uses 1024 — RESEARCH explicitly recommends 1280 for canvas room).
- Close button (`aria-label="Close"`) byte-identical.

#### Tailwind v4 literal-class discipline — `AtlasPreviewModal.tsx:43-44`
```typescript
* Tailwind v4 literal-class discipline (RESEARCH Pitfall 3 + 8): every
* className is a string literal or clsx with literal branches.
```

**Critical:** the canvas-container `className="flex-1 overflow-hidden bg-[#232732] border border-border rounded-md"` (Tailwind arbitrary-value `bg-[#232732]` is literal — D-02c). NEVER template-interpolate.

---

### SpinePlayer-specific patterns (NEW territory — extracted from RESEARCH Patterns 1-4)

#### Mount + dispose lifecycle (Pattern 1, RESEARCH lines 244-298)
```typescript
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  let player: SpinePlayer | null = null;
  let cancelled = false;
  let disposed = false;

  void (async () => {
    const feed = await buildAssetFeed(summary, loaderMode);
    if (cancelled) return;

    try {
      player = new SpinePlayer(container, {
        skeleton: feed.skeletonUrl,
        atlas:    feed.atlasUrl,
        rawDataURIs: feed.rawDataURIs,
        showControls: false,
        backgroundColor: '23273200',
        premultipliedAlpha: true,
        success: (p) => {
          if (cancelled) { p.dispose(); return; }
          setPlayerState('ready');
          setAvailableAnimations(p.skeleton.data.animations.map((a) => a.name));
          setAvailableSkins(p.skeleton.data.skins.map((s) => s.name));
        },
        error: (_p, reason) => {
          if (cancelled) return;
          setPlayerState('error');
          setErrorReason(reason);
        },
      });
    } catch (e) {
      // spine-player THROWS after firing config.error (Pitfall 2)
      if (!cancelled) setPlayerState('error');
    }
  })();

  return () => {
    cancelled = true;
    if (player && !disposed) {
      disposed = true;
      try { player.dispose(); } catch { /* idempotent */ }
    }
  };
}, [summary, loaderMode]); // Pitfall 5 — stable deps key on summary identity
```

**Critical guards:**
- `cancelled` flag (StrictMode double-invocation + async-build-feed race)
- `disposed` flag (Pitfall 5 — double-dispose throws on `removeChild`)
- Try/catch around `new SpinePlayer(...)` (Pitfall 2 — throws after `error` callback)
- Dep array on `summary` (Pitfall 5 HMR + Pitfall 6 project-change)

#### Asset feed builder (Pattern 2, RESEARCH lines 311-339)
```typescript
async function buildAssetFeed(
  summary: SkeletonSummary,
  loaderMode: 'auto' | 'atlas-less',
): Promise<{ skeletonUrl: string; atlasUrl: string; rawDataURIs: Record<string, string> }> {
  const skeletonUrl = await window.api.pathToImageUrl(summary.skeletonPath);
  const isAtlasLess = summary.atlasPath === null || loaderMode === 'atlas-less';

  if (!isAtlasLess) {
    const atlasUrl = await window.api.pathToImageUrl(summary.atlasPath!);
    return { skeletonUrl, atlasUrl, rawDataURIs: {} };
  } else {
    const synth = await window.api.getViewerAssetFeed(summary.skeletonPath);
    const rawDataURIs: Record<string, string> = {
      'synthetic.atlas': synth.atlasTextDataUri,
    };
    for (const region of summary.regions) {
      if (region.sourcePath) {
        rawDataURIs[region.regionName + '.png'] =
          await window.api.pathToImageUrl(region.sourcePath);
      }
    }
    return { skeletonUrl, atlasUrl: 'synthetic.atlas', rawDataURIs };
  }
}
```

**Critical:** mirrors `effectiveLoaderMode` idiom at `AppShell.tsx:932-935` exactly — `summary.atlasPath === null || loaderMode === 'atlas-less'`.

#### Animation + skin switch (Pattern 3, RESEARCH lines 350-368)
```typescript
function onAnimationChange(name: string) {
  if (!playerRef.current) return;
  playerRef.current.setAnimation(name, true); // loop on per D-04b
  setActiveAnimation(name);
}

function onSkinChange(name: string) {
  const p = playerRef.current;
  if (!p?.skeleton) return;
  p.skeleton.setSkinByName(name);
  p.skeleton.setSlotsToSetupPose(); // critical — D-04b verbatim
  setActiveSkin(name);
}
```

#### Scrub (Pattern 4, RESEARCH lines 380-395)
```typescript
function onScrub(percentage: number) {
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
  p.skeleton.updateWorldTransform(2); // 2 === Physics.update (CLAUDE.md fact #3)
  p.playTime = targetTime;
}
```

**Critical:** `updateWorldTransform(2)` matches sampler.ts's call site — do NOT import the `Physics` enum, pass the literal `2`.

#### Top control bar JSX (RESEARCH Code Example 1, lines 532-581)
Native `<select>` precedent at `OptimizeDialog.tsx:atlasMaxPageSize`. Class strings byte-identical:
```typescript
<div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
  <label className="text-xs text-fg-muted">Animation</label>
  <select
    value={activeAnimation}
    onChange={(e) => onAnimationChange(e.target.value)}
    disabled={playerState !== 'ready'}
    className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
  >
    {availableAnimations.map((name) => (
      <option key={name} value={name}>{name}</option>
    ))}
  </select>
  {/* ... Skin select + Play/Pause button + Scrub <input type="range"> */}
</div>
```

#### Canvas container (Pitfall 8 — `flex-1` is load-bearing)
```typescript
<div
  ref={containerRef}
  className="flex-1 overflow-hidden bg-[#232732] border border-border rounded-md"
  style={{ minHeight: 400 }}
/>
```

`flex-1` (and `minHeight: 400` belt-and-suspenders) are NON-NEGOTIABLE: without them the canvas collapses to 1×1 px and the modal looks blank.

---

### `src/renderer/src/components/AppShell.tsx` (MODIFY — 5 insertion sites)

**Analog:** the existing `atlasPreviewOpen` slot's full lifecycle is the byte-for-byte template. Mirror every site.

#### Site 1: Import — after `AppShell.tsx:66`
```typescript
import { AtlasPreviewModal } from '../modals/AtlasPreviewModal';
```
**Insert after line 66:**
```typescript
import { AnimationPlayerModal } from '../modals/AnimationPlayerModal';
```

#### Site 2: State slot — after `AppShell.tsx:208`
```typescript
  // Phase 7 D-134 — NEW: Atlas Preview modal lifecycle. Plain boolean, no
  // snapshot state — the modal reads summary + overrides directly (D-131).
  const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
```
**Insert after line 208 (between `atlasPreviewOpen` and `documentationBuilderOpen`):**
```typescript
  // Phase 41 VIEWER-04 — Animation Viewer modal lifecycle. Plain boolean
  // mirroring atlasPreviewOpen above (D-03). No snapshot state — the viewer
  // reads effectiveSummary + loaderMode directly on mount and disposes
  // its WebGL context in useEffect cleanup (D-04b: no persistence).
  const [animationViewerOpen, setAnimationViewerOpen] = useState(false);
```

#### Site 3: Click handler — after `AppShell.tsx:586-588`
```typescript
  // Phase 7 D-134 — NEW: toolbar button click handler.
  const onClickAtlasPreview = useCallback(() => {
    setAtlasPreviewOpen(true);
  }, []);
```
**Insert sibling at same location:**
```typescript
  // Phase 41 VIEWER-04 — Animation Viewer toolbar button click handler.
  const onClickAnimationViewer = useCallback(() => {
    setAnimationViewerOpen(true);
  }, []);
```

#### Site 4: `modalOpen` derivation — modify `AppShell.tsx:1632-1675`
**Existing OR chain (line 1633-1651):**
```typescript
  useEffect(() => {
    const modalOpen =
      dialogState !== null ||
      exportDialogState !== null ||
      atlasPreviewOpen ||
      saveQuitDialogState !== null ||
      settingsOpen ||
      helpOpen ||
      documentationBuilderOpen;
    window.api.notifyMenuState({
      canSave: true,
      canSaveAs: true,
      canReload: true,
      modalOpen,
    });
  }, [
    dialogState,
    exportDialogState,
    atlasPreviewOpen,
    saveQuitDialogState,
    settingsOpen,
    helpOpen,
    documentationBuilderOpen,
  ]);
```

**MUST add `animationViewerOpen ||` to the OR chain AND `animationViewerOpen` to the dep array** (Pitfall 7 — without this, Cmd-S works while viewer is open, regressing 08.2 D-184).

#### Site 5: Toolbar button — after `AppShell.tsx:2092-2099`
```typescript
          <button
            type="button"
            onClick={onClickAtlasPreview}
            disabled={effectiveSummary.peaks.length === 0}
            className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
          >
            Atlas Preview
          </button>
```

**Insert IMMEDIATELY after this button's closing tag (between Atlas Preview and Documentation buttons per D-03a):**
```typescript
          <button
            type="button"
            onClick={onClickAnimationViewer}
            disabled={effectiveSummary.peaks.length === 0}
            className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
          >
            Animation Viewer
          </button>
```

**Class string MUST be byte-identical** to the Atlas Preview button — Tailwind v4 literal-class scanner discipline (Pitfall 3). Disable predicate (`effectiveSummary.peaks.length === 0`) is byte-identical per D-03c.

#### Site 6: JSX modal mount — after `AppShell.tsx:2462-2476`
```typescript
      {atlasPreviewOpen && (
        <AtlasPreviewModal
          open={true}
          summary={effectiveSummary}
          overrides={activeOverrides}
          onJumpToRegion={onJumpToRegion}
          onClose={() => setAtlasPreviewOpen(false)}
          onOpenOptimizeDialog={onClickOptimize}
          safetyBufferPercent={safetyBufferPercentLocal}
        />
      )}
```

**Insert sibling immediately after (before line 2477 Documentation Builder mount):**
```typescript
      {/* Phase 41 VIEWER-04 — Animation Viewer modal. Reads effectiveSummary +
          loaderMode at mount; disposes WebGL on close (VIEWER-08). Mirrors
          atlasPreviewOpen conditional-mount pattern at lines 2462-2476. */}
      {animationViewerOpen && (
        <AnimationPlayerModal
          open={true}
          summary={effectiveSummary}
          loaderMode={loaderMode}
          onClose={() => setAnimationViewerOpen(false)}
        />
      )}
```

#### Site 7: Project-change cleanup `useEffect` — fold into existing reset at `AppShell.tsx:281-283`
**Existing pattern:**
```typescript
  // When the parent passes a new `summary` prop (e.g. App.tsx re-mounted
  // AppShell on a fresh drop), drop the localSummary override so the prop
  // wins again. Without this, dropping a NEW skeleton after a Settings
  // change would still show the previous skeleton's peaks.
  useEffect(() => {
    setLocalSummary(null);
  }, [summary]);
```

**OPTIONS for the planner:**
- **Option 1 (RESEARCH lines 504-510 — recommended):** add a new sibling `useEffect`:
  ```typescript
  // Phase 41 VIEWER-08 — close viewer when a new summary identity arrives
  // (resample, Settings-driven re-sample, locate-skeleton recovery).
  // Mirrors the localSummary reset above at line 281. Trigger is summary
  // prop identity (App.tsx materializes a fresh skeleton on drop/Open/resample).
  useEffect(() => {
    setAnimationViewerOpen(false);
  }, [summary]);
  ```
- **Option 2:** fold setter call into the existing effect body (same trigger):
  ```typescript
  useEffect(() => {
    setLocalSummary(null);
    setAnimationViewerOpen(false); // VIEWER-08 — dispose viewer on new summary
  }, [summary]);
  ```

Both work; Option 1 keeps the audit-trail cleaner (one phase = one effect).

---

### `src/main/ipc.ts` (MODIFY — Option A only)

**Analog:** `atlas:resolve-image-url` handler at `src/main/ipc.ts:1234-1248`:
```typescript
  ipcMain.handle('atlas:resolve-image-url', (_evt, absolutePath: unknown): string => {
    if (typeof absolutePath !== 'string' || absolutePath.length === 0) return '';
    try {
      const isWindowsPath = /^[A-Za-z]:[\\/]/.test(absolutePath);
      const fileUrl = isWindowsPath
        ? pathToFileURL(absolutePath, { windows: true })
        : pathToFileURL(absolutePath);
      return `app-image://localhost${fileUrl.pathname}`;
    } catch {
      return '';
    }
  });
```

**Adapt for viewer asset feed** (RESEARCH Q1 Option A — atlas-less synth path only):
```typescript
  // Phase 41 VIEWER-03 — atlas-less synth-atlas materialization for the
  // Animation Viewer. The renderer cannot run synthesizeAtlasText (fs-bound,
  // lives in core/); main re-runs it on demand. Returns the synth atlas text
  // as a base64 data: URI plus the per-region PNG absolute-path map; renderer
  // converts absolute paths to app-image:// URLs via pathToImageUrl bridge.
  // Trust boundary: typeof check on skeletonPath + .json extension check
  // mirror handleSkeletonLoad's validation (T-01-02-01).
  ipcMain.handle('viewer:get-asset-feed', async (_evt, skeletonPath: unknown): Promise<ViewerAssetFeedResponse> => {
    if (typeof skeletonPath !== 'string' || !skeletonPath.toLowerCase().endsWith('.json')) {
      return { ok: false, error: { kind: 'Unknown', message: 'Invalid skeleton path' } };
    }
    try {
      const parsedJson = JSON.parse(await readFile(skeletonPath, 'utf8'));
      const imagesDir = path.join(path.dirname(skeletonPath), 'images');
      const synth = synthesizeAtlasText(parsedJson, imagesDir, skeletonPath);
      const atlasTextDataUri =
        'data:text/plain;base64,' + Buffer.from(synth.atlasText, 'utf8').toString('base64');
      const regionPaths: Record<string, string> = {};
      for (const [regionName, absPath] of synth.pngPathsByRegionName) {
        regionPaths[regionName] = absPath;
      }
      return { ok: true, atlasTextDataUri, regionPaths };
    } catch (err) {
      return { ok: false, error: { kind: 'Unknown', message: (err as Error).message } };
    }
  });
```

**Import additions** (top of `src/main/ipc.ts`):
```typescript
import { synthesizeAtlasText } from '../core/synthetic-atlas.js'; // Phase 41 VIEWER-03 — atlas-less synth re-run
import { readFile } from 'node:fs/promises';
```

**Note:** `loadSkeleton`/`sampleSkeleton` already import from `../core/*.js` at lines 48-49 — adding `synthetic-atlas.js` is precedented.

---

### `src/preload/index.ts` (MODIFY — Option A only)

**Analog:** `pathToImageUrl` bridge at `src/preload/index.ts:648-649`:
```typescript
  pathToImageUrl: (absolutePath: string): Promise<string> =>
    ipcRenderer.invoke('atlas:resolve-image-url', absolutePath),
```

**Adapt for viewer:**
```typescript
  // -------------------------------------------------------------------------
  // Phase 41 VIEWER-03 — atlas-less synth-atlas materialization bridge.
  //
  // For atlas-less projects, the renderer cannot run synthesizeAtlasText
  // (core/ is fs-bound, renderer is forbidden from importing core/* per
  // tests/arch.spec.ts:19-34). This bridge invokes the main-side handler
  // that re-runs synthesis on demand and returns the synth atlas text +
  // per-region absolute PNG path map. The renderer transforms absolute
  // paths into app-image:// URLs via pathToImageUrl above.
  //
  // Atlas-source projects do NOT use this bridge — spine-player resolves
  // page PNGs via `parent + page.name` from the .atlas URL automatically.
  // -------------------------------------------------------------------------
  getViewerAssetFeed: (skeletonPath: string): Promise<ViewerAssetFeedResponse> =>
    ipcRenderer.invoke('viewer:get-asset-feed', skeletonPath),
```

---

### `src/shared/types.ts` (MODIFY — Option A only)

**Analog (Api method type entry):** `pathToImageUrl: (absolutePath: string) => Promise<string>;` at line 1726.

**Add Api method signature near line 1726:**
```typescript
  /**
   * Phase 41 VIEWER-03 — atlas-less synth-atlas materialization bridge.
   * Returns synth atlas text encoded as a base64 data: URI plus a per-region
   * map of absolute PNG paths (renderer converts via pathToImageUrl).
   * Atlas-source projects do not need this — spine-player resolves page
   * PNGs from the .atlas URL parent path automatically.
   */
  getViewerAssetFeed: (skeletonPath: string) => Promise<ViewerAssetFeedResponse>;
```

**Add response envelope (group with `SerializableError` block ~line 879):**
```typescript
/**
 * Phase 41 VIEWER-03 — IPC envelope for the atlas-less synth-atlas feed.
 * structuredClone-safe: only primitives + plain object/array.
 */
export type ViewerAssetFeedResponse =
  | {
      ok: true;
      /** Synthesized libgdx atlas text encoded as `data:text/plain;base64,...`. */
      atlasTextDataUri: string;
      /** Map from region name → absolute PNG path on disk. */
      regionPaths: Record<string, string>;
    }
  | {
      ok: false;
      error: { kind: string; message: string };
    };
```

---

### `package.json` (MODIFY)

**Analog:** existing `@esotericsoftware/spine-core` at line 26:
```json
    "@esotericsoftware/spine-core": "^4.2.0",
```

**Adapt:** add `@esotericsoftware/spine-player` as a sibling AND tighten spine-core to exact pin (RESEARCH Pitfall 1 — dedup):
```json
    "@esotericsoftware/spine-core": "4.2.111",
    "@esotericsoftware/spine-player": "4.2.111",
```

**Install command (D-01 lock):**
```bash
npm install @esotericsoftware/spine-player@4.2.111
```

**Verification command:**
```bash
npm ls @esotericsoftware/spine-core   # expect single entry at 4.2.111
npm ls @esotericsoftware/spine-player # expect single entry at 4.2.111
```

---

### `tests/renderer/animation-player-modal.spec.tsx` (NEW)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx`

#### Vitest jsdom env + imports — `atlas-preview-modal.spec.tsx:1-31`
```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { pathToFileURL } from 'node:url';
import { AtlasPreviewModal } from '../../src/renderer/src/modals/AtlasPreviewModal';
import type { SkeletonSummary, DisplayRow } from '../../src/shared/types';

afterEach(cleanup);
```

**Adapt for viewer:**
```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { pathToFileURL } from 'node:url';
import { AnimationPlayerModal } from '../../src/renderer/src/modals/AnimationPlayerModal';
import type { SkeletonSummary } from '../../src/shared/types';

afterEach(cleanup);
```

#### `vi.stubGlobal('api', ...)` setup — `atlas-preview-modal.spec.tsx:44-55`
```typescript
beforeEach(() => {
  vi.stubGlobal('api', {
    pathToImageUrl: vi.fn(async (absolutePath: string) => {
      const fileUrl = pathToFileURL(absolutePath);
      return `app-image://localhost${fileUrl.pathname}`;
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

**Adapt for viewer:** extend the stub to include `getViewerAssetFeed` (Option A only):
```typescript
beforeEach(() => {
  vi.stubGlobal('api', {
    pathToImageUrl: vi.fn(async (absolutePath: string) => {
      const fileUrl = pathToFileURL(absolutePath);
      return `app-image://localhost${fileUrl.pathname}`;
    }),
    getViewerAssetFeed: vi.fn(async (_skeletonPath: string) => ({
      ok: true,
      atlasTextDataUri: 'data:text/plain;base64,Zm9vCg==', // 'foo\n'
      regionPaths: { CIRCLE: '/fixtures/SIMPLE/images/CIRCLE.png' },
    })),
  });

  // SpinePlayer mock — jsdom has no WebGL; replace the constructor so we
  // can spy on dispose() + drive success/error callbacks synchronously.
  vi.mock('@esotericsoftware/spine-player', () => ({
    SpinePlayer: vi.fn().mockImplementation((_container, config) => {
      const player = {
        dispose: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        setAnimation: vi.fn(),
        skeleton: { data: { animations: [{ name: 'idle' }], skins: [{ name: 'default' }] } },
        animationState: { getCurrent: vi.fn(() => null), update: vi.fn(), apply: vi.fn() },
        playTime: 0,
      };
      // Invoke success on next microtask so the modal can render error UI first if it wants
      Promise.resolve().then(() => config.success?.(player));
      return player;
    }),
  }));
});
```

#### Test signatures (mirror `atlas-preview-modal.spec.tsx:225-405` describe blocks)

**Describe block per requirement (RESEARCH Validation Architecture table):**
```typescript
describe('AnimationPlayerModal — mount + dispose (VIEWER-02)', () => {
  it('renders role="dialog" when open=true', () => {
    render(<AnimationPlayerModal open={true} summary={makeSummary()} loaderMode="auto" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  it('does not render when open=false', () => {
    const { container } = render(<AnimationPlayerModal open={false} summary={makeSummary()} loaderMode="auto" onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('calls player.dispose() exactly once on unmount', async () => {
    /* mount + unmount, assert dispose spy call count === 1 */
  });
});

describe('AnimationPlayerModal — asset feed (VIEWER-03)', () => {
  it('atlas-source: SpinePlayer config.skeleton + config.atlas are app-image:// URLs', () => { /* ... */ });
  it('atlas-less: SpinePlayer config.rawDataURIs has synthetic.atlas + per-region keys', () => { /* ... */ });
});

describe('AnimationPlayerModal — animation + skin switching (VIEWER-05)', () => {
  it('<select> options populated from skeleton.data.animations after success', () => { /* ... */ });
  it('onChange calls player.setAnimation(name, loop)', () => { /* ... */ });
  it('skin onChange calls setSkinByName + setSlotsToSetupPose', () => { /* ... */ });
});

describe('AnimationPlayerModal — playback controls (VIEWER-06)', () => {
  it('play/pause toggle calls player.play() / player.pause()', () => { /* ... */ });
  it('scrub calls animationState.update + skeleton.update + updateWorldTransform(2)', () => { /* ... */ });
});

describe('AnimationPlayerModal — error state (VIEWER-09)', () => {
  it('config.error invocation → renders terminal Close-only error UI', () => { /* ... */ });
});

describe('AnimationPlayerModal — close interactions (D-81 reuse)', () => {
  it('clicking the X button calls onClose', () => { /* mirror line 372-386 */ });
  it('clicking the overlay calls onClose', () => { /* mirror line 388-405 */ });
});
```

**Critical close-interaction tests — verbatim mirror from `atlas-preview-modal.spec.tsx:372-405`:**
```typescript
it('clicking the close X button calls onClose', () => {
  const onClose = vi.fn();
  render(<AnimationPlayerModal open={true} summary={makeSummary()} loaderMode="auto" onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('clicking the overlay (outside the panel) calls onClose', () => {
  const onClose = vi.fn();
  render(<AnimationPlayerModal open={true} summary={makeSummary()} loaderMode="auto" onClose={onClose} />);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(dialog); // overlay onClick
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

---

### `tests/renderer/app-shell-animation-viewer.spec.tsx` (NEW)

**Analog:** `tests/renderer/app-shell-atlas-state.spec.tsx` (source-grep-as-test pattern).

#### Source-grep test scaffold — `app-shell-atlas-state.spec.tsx:17-43`
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const APP_SHELL_PATH = 'src/renderer/src/components/AppShell.tsx';

function appShellSource(): string {
  return readFileSync(APP_SHELL_PATH, 'utf8');
}

describe('Phase 40 Plan 07 — AppShell atlas state threading', () => {
  it('(1) declares 4 useState slots for atlas fields', () => {
    const src = appShellSource();
    expect(/useState<['"]loose['"]\s*\|\s*['"]atlas['"]\s*\|\s*['"]both['"]>/.test(src)).toBe(true);
    /* ... */
  });

  it('(2) each setter appears at least twice (declaration + at least one update site)', () => {
    const src = appShellSource();
    expect((src.match(/setAtlasOutputMode\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    /* ... */
  });
```

**Adapt for viewer (mirror invariants 1, 2, modal-mount, modalOpen-derivation, project-change cleanup):**
```typescript
describe('Phase 41 — AppShell Animation Viewer wiring', () => {
  it('(1) declares animationViewerOpen useState slot', () => {
    const src = appShellSource();
    expect(/const \[animationViewerOpen, setAnimationViewerOpen\] = useState\(false\)/.test(src)).toBe(true);
  });

  it('(2) setAnimationViewerOpen appears at least 3 times (decl + click handler + close + project-change reset)', () => {
    const src = appShellSource();
    expect((src.match(/setAnimationViewerOpen\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('(3) toolbar button rendered with onClick={onClickAnimationViewer} + disabled rule mirroring Atlas Preview', () => {
    const src = appShellSource();
    expect(/onClick=\{onClickAnimationViewer\}/.test(src)).toBe(true);
    expect(/onClickAnimationViewer.*[\s\S]*?setAnimationViewerOpen\(true\)/.test(src)).toBe(true);
  });

  it('(4) <AnimationPlayerModal> mounted with effectiveSummary + loaderMode + onClose', () => {
    const src = appShellSource();
    expect(/<AnimationPlayerModal[\s\S]*?summary=\{effectiveSummary\}[\s\S]*?loaderMode=\{loaderMode\}/.test(src)).toBe(true);
  });

  it('(5) modalOpen derivation includes animationViewerOpen in OR-chain AND dep array (Pitfall 7)', () => {
    const src = appShellSource();
    expect(/modalOpen[\s\S]*?animationViewerOpen \|\|/.test(src)).toBe(true);
    // Dep array entry
    expect(/animationViewerOpen,/.test(src)).toBe(true);
  });

  it('(6) project-change cleanup (VIEWER-08) — setAnimationViewerOpen(false) reset on summary identity change', () => {
    const src = appShellSource();
    // Either a sibling useEffect on [summary] OR folded into the existing localSummary reset
    expect(/useEffect\([^)]*setAnimationViewerOpen\(false\)[\s\S]*?\}, \[summary\]\)/.test(src)).toBe(true);
  });
});
```

---

### `tests/main/viewer-asset-feed-ipc.spec.ts` (NEW — Option A only)

**Analog:** `tests/main/ipc.spec.ts` Map-backed `ipcMain.handle` captor pattern.

#### Hoisted invoke-captor — `tests/main/ipc.spec.ts:22-65`
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { ipcMainHandleHandlers } = vi.hoisted(() => ({
  ipcMainHandleHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  Menu: { /* ... */ },
  app: { /* ... */ },
  BrowserWindow: { /* ... */ },
  dialog: { /* ... */ },
  shell: { /* ... */ },
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn((channel: string, handler: (evt: unknown, ...args: unknown[]) => unknown) => {
      ipcMainHandleHandlers.set(channel, handler);
    }),
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));
```

**Test cases for `viewer:get-asset-feed`:**
```typescript
describe("Phase 41 — 'viewer:get-asset-feed' IPC handler", () => {
  beforeEach(async () => {
    ipcMainHandleHandlers.clear();
    const { registerIpcHandlers } = await import('../../src/main/ipc.js');
    registerIpcHandlers();
  });

  it('rejects non-string skeletonPath with ok:false envelope', async () => {
    const handler = ipcMainHandleHandlers.get('viewer:get-asset-feed')!;
    const result = await handler({}, null);
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects non-.json paths', async () => {
    const handler = ipcMainHandleHandlers.get('viewer:get-asset-feed')!;
    const result = await handler({}, '/tmp/foo.txt');
    expect(result).toMatchObject({ ok: false });
  });

  it('atlas-less fixture: returns base64-encoded synth atlas text + per-region paths', async () => {
    // Use fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (atlas-source) — would need
    // an atlas-less fixture; or stub synthesizeAtlasText via vi.mock if simpler.
  });
});
```

---

## Shared Patterns (apply to multiple files)

### Pattern S-1: `useFocusTrap` invocation
**Source:** `src/renderer/src/hooks/useFocusTrap.ts:100-104` (signature) + `AtlasPreviewModal.tsx:111`
**Apply to:** `AnimationPlayerModal.tsx`
```typescript
const dialogRef = useRef<HTMLDivElement>(null);
useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });
```
**Critical:** `containerRef` typed as `RefObject<HTMLElement | null>`. The hook handles Tab cycle + document-level Escape + previously-focused restoration. Pass `props.onClose` raw — wrapping in `useCallback` with broad deps re-runs the trap every render (Pitfall 8 from AtlasPreviewModal comment).

### Pattern S-2: ARIA dialog overlay scaffold (verbatim from 5 existing modals)
**Source:** `AtlasPreviewModal.tsx:234-246`
**Apply to:** `AnimationPlayerModal.tsx`
```typescript
<div
  ref={dialogRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="<unique-id>"
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onClick={props.onClose}
>
  <div
    className="bg-modal border border-border rounded-md p-6 [size classes] flex flex-col font-mono shadow-2xl"
    onClick={(e) => e.stopPropagation()}
  >
    {/* content */}
  </div>
</div>
```
**Critical:** outer `onClick={props.onClose}` (click-outside-to-close); inner `onClick={(e) => e.stopPropagation()}` (prevent click bubbling). Same `z-50`, `bg-black/40`, `bg-modal`, `border-border`, `rounded-md`, `font-mono`, `shadow-2xl` tokens as all 5 existing modals.

### Pattern S-3: `app-image://` URL bridge
**Source:** `src/preload/index.ts:648-649` + `src/main/ipc.ts:1234-1248` + `src/main/index.ts:571-597`
**Apply to:** `AnimationPlayerModal.tsx` (use), main IPC handler stays as-is
```typescript
// Renderer never constructs app-image:// URLs by string concatenation —
// always go through this bridge (Phase 12 D-19 Windows-drive-letter F1 fix):
const url = await window.api.pathToImageUrl(absolutePath);
```

### Pattern S-4: vitest jsdom modal spec setup/teardown
**Source:** `tests/renderer/atlas-preview-modal.spec.tsx:31-55`
**Apply to:** `tests/renderer/animation-player-modal.spec.tsx`
```typescript
// @vitest-environment jsdom  ← first line, MUST be a comment
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal('api', { /* mock methods */ });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Pattern S-5: IPC handler shape (invoke + trust-boundary validation)
**Source:** `src/main/ipc.ts:1234-1248` (`atlas:resolve-image-url` — synchronous) + `src/main/ipc.ts:1299` (`documentation:exportHtml` — async, returns envelope)
**Apply to:** new `viewer:get-asset-feed` handler
```typescript
ipcMain.handle('channel-name', async (_evt, arg: unknown): Promise<Envelope> => {
  // Trust-boundary type check
  if (typeof arg !== 'string' || ...) {
    return { ok: false, error: { kind: 'Unknown', message: 'Invalid arg' } };
  }
  try {
    // core/* import is allowed in main/* per arch.spec.ts
    const result = doWork(arg);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: (err as Error).message } };
  }
});
```

### Pattern S-6: Preload bridge shape
**Source:** `src/preload/index.ts:648-649` (one-shot invoke) + `Api` type at `shared/types.ts:1726`
**Apply to:** new `getViewerAssetFeed` bridge
```typescript
// In src/preload/index.ts (inside the `api: Api = { ... }` object literal):
methodName: (arg: T): Promise<ResponseEnvelope> =>
  ipcRenderer.invoke('channel-name', arg),

// In src/shared/types.ts (inside the `export interface Api { ... }`):
methodName: (arg: T) => Promise<ResponseEnvelope>;
```

### Pattern S-7: Tailwind v4 literal-class discipline
**Source:** comment at `AtlasPreviewModal.tsx:43-44` (Pitfall 3); discipline enforced project-wide.
**Apply to:** every `className` in `AnimationPlayerModal.tsx`
- **Allowed:** literal strings, `clsx(...)` with literal-branch arguments, arbitrary-value classes like `bg-[#232732]` and `max-h-[90vh]` (all-literal-content).
- **Forbidden:** template-string interpolation, dynamic class composition (`className={'border-' + colorName}`).

### Pattern S-8: Stable summary-identity dep + `setX(false)` reset (project-change cleanup)
**Source:** `AppShell.tsx:281-283` (`setLocalSummary(null)` on `[summary]`)
**Apply to:** new `useEffect` for `setAnimationViewerOpen(false)` reset (or fold into existing) — RESEARCH Pitfall 6 / VIEWER-08

---

## File Locations Quick-Reference

| Anchor | File | Line(s) | Purpose |
|--------|------|---------|---------|
| 5-modal ARIA scaffold | `src/renderer/src/modals/AtlasPreviewModal.tsx` | 234-263 | Outer overlay + inner card + header |
| `useFocusTrap` hook | `src/renderer/src/hooks/useFocusTrap.ts` | 100-189 | Tab cycle + Escape; reused verbatim |
| `atlasPreviewOpen` state slot | `src/renderer/src/components/AppShell.tsx` | 208 | Boolean useState slot pattern |
| `onClickAtlasPreview` handler | `src/renderer/src/components/AppShell.tsx` | 585-588 | useCallback setter pattern |
| Atlas Preview toolbar button | `src/renderer/src/components/AppShell.tsx` | 2092-2099 | Insertion site + class-string template |
| `<AtlasPreviewModal>` JSX mount | `src/renderer/src/components/AppShell.tsx` | 2462-2476 | Conditional-mount template |
| `modalOpen` derivation | `src/renderer/src/components/AppShell.tsx` | 1632-1675 | MUST add `animationViewerOpen` (Pitfall 7) |
| Project-change cleanup useEffect | `src/renderer/src/components/AppShell.tsx` | 281-283 | `[summary]`-keyed reset pattern |
| `app-image://` scheme handler | `src/main/index.ts` | 571-597 | Existing protocol handler — no change |
| `appImageUrlToPath` helper | `src/main/index.ts` | 542-545 | Reverse path conversion |
| `pathToImageUrl` IPC handler | `src/main/ipc.ts` | 1234-1248 | Sync invoke handler template |
| `pathToImageUrl` preload bridge | `src/preload/index.ts` | 648-649 | Invoke-bridge template |
| `Api.pathToImageUrl` type | `src/shared/types.ts` | 1726 | Type-decl template |
| `SkeletonSummary` shape | `src/shared/types.ts` | 738-850 | Field reference for viewer feed builder |
| `RegionRow.sourcePath` | `src/shared/types.ts` | 235 | atlas-less per-region PNG path source |
| `synthesizeAtlasText` (core) | `src/core/synthetic-atlas.ts` | 134-211 | Main re-import target for Option A handler |
| `SynthResult.pngPathsByRegionName` | `src/core/synthetic-atlas.ts` | 79-89 | Map<regionName, absPath> shape |
| `SynthResult.atlasText` | `src/core/synthetic-atlas.ts` | 81 | Base64-encode this for `data:` URI |
| Atlas-preview modal spec | `tests/renderer/atlas-preview-modal.spec.tsx` | 1-55 | jsdom env + `vi.stubGlobal('api', ...)` setup |
| AppShell source-grep spec | `tests/renderer/app-shell-atlas-state.spec.tsx` | 17-98 | source-grep-as-test pattern (no jsdom mount) |
| Main IPC test scaffold | `tests/main/ipc.spec.ts` | 22-65 | Hoisted `ipcMainHandleHandlers` captor |

---

## No Analog Found

None — every file in this phase has a strong analog in the codebase. The new territory (spine-player WebGL integration) is documented in RESEARCH Patterns 1-4 with vendored-source line numbers; the planner uses RESEARCH directly for that, not codebase analogs.

---

## Metadata

**Analog search scope:**
- `src/renderer/src/modals/*.tsx` (6 existing modals — AtlasPreviewModal is closest)
- `src/renderer/src/components/AppShell.tsx` (self-reference for state/JSX patterns)
- `src/renderer/src/hooks/useFocusTrap.ts` (reused verbatim)
- `src/main/ipc.ts` (existing invoke handlers — `atlas:resolve-image-url` closest)
- `src/main/index.ts` (existing protocol handler — unchanged)
- `src/preload/index.ts` (existing bridge — closest sibling = `pathToImageUrl`)
- `src/shared/types.ts` (Api interface + envelope shape)
- `src/core/synthetic-atlas.ts` (re-imported main-side for Option A)
- `tests/renderer/atlas-preview-modal.spec.tsx` (modal spec template)
- `tests/renderer/app-shell-atlas-state.spec.tsx` (source-grep template)
- `tests/main/ipc.spec.ts` (Map-backed captor template)

**Files scanned:** ~15 (early-stop at 5+ strong matches)
**Pattern extraction date:** 2026-05-15
