# Phase 41: Spine Animation Viewer - Research

**Researched:** 2026-05-15
**Domain:** Electron renderer integration of `@esotericsoftware/spine-player@4.2.x` — official WebGL Spine playback library — as a new sibling modal (`AnimationPlayerModal.tsx`) wired through the existing 5-modal ARIA scaffold, the existing `app-image://` custom-scheme handler, and the Phase 21 synthetic-atlas path for atlas-less projects.
**Confidence:** HIGH

## Summary

`@esotericsoftware/spine-player` is the canonical, npm-shipped, TypeScript-typed wrapper around `spine-core` + `spine-webgl` from Esoteric Software (Spine's authors). Construction is `new SpinePlayer(parent, config)` where `parent` is an `HTMLElement` or string id; the player mounts its own `<div><canvas>...</canvas></div>` subtree inside `parent`, attaches WebGL via `ManagedWebGLRenderingContext`, fetches `skeleton`/`atlas` via its internal `AssetManager` (which itself uses `XMLHttpRequest` against URL strings), parses skeleton data, calls `config.success(player)` on completion (at which point `player.skeleton` / `player.animationState` become non-null), and starts a `requestAnimationFrame` loop.

The integration is dramatically simpler than the CONTEXT.md "spine-player accepts a pre-constructed `TextureAtlas`" wording suggested: spine-player does NOT take a pre-built `TextureAtlas` instance. Instead, it accepts a `rawDataURIs: StringMap<string>` config key whose entries are looked up by atlas-page filename at fetch time and substituted for either inline `data:` bytes (text/binary) or alternate URL strings (e.g., `blob:` or our `app-image://`). This is the single mechanism that lets BOTH atlas-source and atlas-less modes share one viewer feed shape with zero new IPC.

**Primary recommendation:** Install `@esotericsoftware/spine-player@4.2.111` as a renderer-context dependency (exact pin to match the already-installed `@esotericsoftware/spine-core@4.2.111` transitive). Build `AnimationPlayerModal.tsx` as the 6th member of the modal family, mounting a 100%-height div, passing it to `new SpinePlayer(divEl, config)` inside `useEffect`, and calling `player.dispose()` in the cleanup. Use the existing `window.api.pathToImageUrl(absPath)` bridge to construct `app-image://` URLs for the skeleton JSON, the `.atlas` file (atlas-source), and every page/region PNG. For atlas-less mode, route the synthesized atlas TEXT through `rawDataURIs["synthetic.atlas"]` as a base64 `data:` URI plus one `rawDataURIs[regionName + ".png"]` entry per region pointing at the per-region `app-image://` URL. `showControls: false` — we build our own top control bar with native `<select>` for animation + skin and `<input type="range">` for scrub.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebGL canvas rendering of skeleton | Browser (renderer) | — | Electron renderer is the only tier with a DOM and a WebGL context; `spine-player` is renderer-only by construction |
| Atlas-text materialization for atlas-less mode | Main process | Renderer | `src/core/synthetic-atlas.ts` is `fs`-bound (reads PNG IHDR bytes); must run main-side and ship the text string to renderer via existing IPC payload or a new bridge |
| Atlas / JSON / PNG bytes delivery to renderer | Main process (`app-image://` scheme handler) | — | Already-registered protocol handler at `src/main/index.ts:571`; renderer never reads files directly (Layer 3 invariant `core/` purity) |
| URL construction (absolute path → `app-image://` URL) | Preload bridge | — | `window.api.pathToImageUrl(absPath)` at `src/preload/index.ts:648` is the cross-platform-safe single source of truth (handles Windows drive-letter quirks per Phase 12 D-19) |
| Modal ARIA scaffold (focus trap, Esc, click-outside) | Renderer (`useFocusTrap` hook) | — | Hand-rolled, shared across all 5 existing modals (`src/renderer/src/hooks/useFocusTrap.ts`); Layer 3 — no DOM in `core/` |
| Animation + skin enumeration | Renderer (from `player.skeleton.data` after `success` callback) | — | spine-player surfaces parsed skeleton data via `player.skeleton.data.animations[]` + `.skins[]` post-load; we copy names into React state for the dropdowns |
| Project-change cleanup | Renderer (AppShell unmount + summary-identity reset useEffect) | — | App.tsx remounts AppShell on `state.status` transitions; in-place summary swaps caught by an existing reset useEffect pattern (see Project Constraints below) |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEWER-01 | spine-player runtime installed + importable from renderer | D-01 lock + npm registry verified: install `@esotericsoftware/spine-player@4.2.111` (exact pin); package ships TypeScript .d.ts, ESM + IIFE bundles; single import `{ SpinePlayer, type SpinePlayerConfig } from '@esotericsoftware/spine-player'` |
| VIEWER-02 | React wrapper mounts/unmounts cleanly, surviving HMR + project change | `useEffect` + `useRef` + `player.dispose()` in cleanup; spine-player owns its own DOM subtree under the container div, so dispose-then-React-unmount order is the canonical pattern (verified in vendored `spine-player.js:14227-14243`) |
| VIEWER-03 | Viewer consumes currently-open project's JSON + atlas + page PNGs (atlas-source + atlas-less) | Atlas-source: `pathToImageUrl(summary.skeletonPath)` + `pathToImageUrl(summary.atlasPath)`; atlas-less: synthesized atlas text inline via `rawDataURIs["synthetic.atlas"]` + per-region PNG URLs in `rawDataURIs[regionName + ".png"]`; both modes via single config shape |
| VIEWER-04 | Reachable from main UI — opens, shows character animated | Toolbar button at AppShell right cluster (D-03 locked); `setAnimationViewerOpen(true)` → modal mounts → `<div ref={containerRef}>` → `new SpinePlayer(containerRef.current, config)` → `success` callback fires → canvas renders skeleton |
| VIEWER-05 | Switch animations + skins live; playback updates on selection | `player.setAnimation(name, loop)` for animation switch; `player.skeleton.setSkinByName(name); player.skeleton.setSlotsToSetupPose()` for skin switch (verified Python reference + vendored player); React `<select>` controlled inputs in the top control bar |
| VIEWER-06 | Play / pause / scrub controls; default play + loop on | `player.play()` / `player.pause()` (no args); scrub: `entry = player.animationState.getCurrent(0); animationState.update(deltaToTarget); animationState.apply(player.skeleton); skeleton.update(delta); skeleton.updateWorldTransform(Physics.update); player.playTime = targetTime` (verified Python reference at viewer.js:274-287); native `<input type="range">` |
| VIEWER-08 | Disposes GL context, no leak on close/reopen, closes prior viewer on project change | `player.dispose()` in `useEffect` cleanup → frees sceneRenderer, assetManager (page textures), context (event listeners), canvas backing store, detaches DOM child; project-change closure via existing AppShell unmount-on-`loading`-transition OR a summary-identity-change reset useEffect mirroring the `setLocalSummary(null)` pattern at AppShell.tsx:281 |
| VIEWER-09 | Terminal in-modal error state on malformed JSON / missing atlas / unreadable PNGs | spine-player emits via TWO surfaces: (1) `config.error(player, reason)` callback receives a string reason; (2) AFTER the error callback, spine-player THROWS — must guard with try/catch around `new SpinePlayer(...)` and globally. React state machine: `'loading' | 'ready' | 'error'`; on error, render Close-only frame with verbatim copy (planner finalizes); ignore the player's own injected `<div class="spine-player-error">` overlay since we control the parent div |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 Dependency mode:**
- Install `@esotericsoftware/spine-player` as a regular npm dependency (`npm install @esotericsoftware/spine-player`). Pin range follows the existing `@esotericsoftware/spine-core@^4.2.0` pattern. Vendor option discarded.
- **D-01a (planner discretion):** Whether to add `spine-player` to `renderer` or `shared` deps in `package.json`. Default lean: `dependencies` (renderer-side) since the player only runs in the renderer process; spine-core's existing classification is the precedent.

**D-02 Viewer UI shape:**
- Standalone `AnimationPlayerModal.tsx` (sibling to `AtlasPreviewModal.tsx`, etc.). Reuses the locked 5-modal ARIA scaffold from Phase 6 Round 6: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + outer overlay `onClick={onClose}` + inner `stopPropagation` + `useFocusTrap` hook. VIEWER-07 (split-pane) is locked Future.
- **D-02a:** Modal sizing mirrors `AtlasPreviewModal` — near-fullscreen with small inset border.
- **D-02b:** Animation + skin selectors + playback transport in a single horizontal **top control bar** above the canvas.
- **D-02c:** Canvas background uses `#232732` panel-surface token. No checkerboard / no user toggle.

**D-03 Mount location:**
- Single **toolbar button** in the right-aligned cluster at `AppShell.tsx:2087-2090`. No tab; no inline embed. Modal overlays whichever tab is active.
- **D-03a:** Position: `SearchBar | Atlas Preview | **Animation Viewer** | Documentation | Optimize Assets`.
- **D-03b:** Label `Animation Viewer` (capitalized, two-word noun-phrase).
- **D-03c:** Disabled only when no skeleton loaded (`effectiveSummary.peaks.length === 0`, mirroring `Atlas Preview` at `AppShell.tsx:2095`). Stays enabled during sampler/export in-flight.

**D-04 Asset feed routing:**
- Always plays the source project (no Optimize-output-dir coupling, no VIEWER-07).
- **D-04a:** Atlas-less mode reuses the Phase 21 synthetic-atlas path. Viewer reads same data the sampler/preview pipeline consumes; no on-disk materialization.
- **D-04b:** Default open: `skeleton.data.animations[0]` + `skeleton.data.skins[0]`, play + loop on. No persistence.
- **D-04c:** Terminal in-modal error state with Close-only on malformed JSON / missing atlas / unreadable PNG. No retry button.

### Claude's Discretion

The following implementation details are left to the planner / executor:

- **Asset URL construction** — whether the viewer uses the existing Phase 12 `app-image://` custom scheme handler, bare `file://` URLs, or preload-injected blob URLs. Planner picks based on what `spine-player` accepts.
- **`spine-player` API surface** — exact construction call (`new SpinePlayer(...)` vs. `<spine-player>` web-component vs. options-object factory).
- **WebGL context teardown** — `player.dispose()` invocation order vs. React unmount order.
- **HMR resilience** (VIEWER-02) — exact `useEffect` cleanup pattern that survives Vite HMR in dev mode.
- **Project-change cleanup** (VIEWER-08) — exact integration point with AppShell's project-load lifecycle.
- **Scrub control implementation** — native `<input type="range">` vs. custom track.
- **Animation + skin `<select>` styling** — native vs. custom dropdown. Default lean: native `<select>` matching `OptimizeDialog.tsx`'s `atlasMaxPageSize`.
- **Final error copy** (VIEWER-09) — verbatim wording for "malformed JSON", "missing atlas", "unreadable PNG" cases. Resolved during `/gsd-plan-phase 41`.

### Deferred Ideas (OUT OF SCOPE)

- **VIEWER-07 — Source vs exported split-pane comparison** — Locked Future per D-02.
- **Checkerboard / solid bg toggle** in the viewer for transparency / edge-bleed validation.
- **Animation + skin selection persistence** (both `.stmproj` and in-session).
- **Retry button on error state** + **"Open project files folder" helper**.
- **`Animation Viewer` as a third tab** in the sub-toolbar.
- **Post-export asset-feed routing** (Optimize-output-dir → viewer).
- **Project-level animator-friendly "preview last export"**.
</user_constraints>

## Project Constraints (from CLAUDE.md + existing arch tests)

These are non-negotiable; planner MUST verify compliance:

1. **`src/core/*` purity** — viewer wiring lives ENTIRELY in `src/renderer/`; nothing in `core/` may change for Phase 41. Enforced by `tests/arch.spec.ts:19-34`: renderer files MUST NOT import from `src/core/`. spine-player itself is a `node_modules` package — fine to import.
2. **`src/main/index.ts`** is the ONLY place that registers the `app-image://` scheme; the renderer NEVER constructs `app-image://` URLs by hand (Phase 12 D-19 Windows-drive-letter F1 fix). Renderer ALWAYS goes through `window.api.pathToImageUrl(absPath)`.
3. **Tailwind v4 literal-class scanner discipline** — every `className` is a literal string or `clsx` with literal branches. No dynamic class composition.
4. **Spine 4.2-only target** — install `spine-player@4.2.111` exactly, NOT `^4.2.0` (which would resolve to 4.2.116 today and pull `spine-core@4.2.116` transitively, conflicting with the installed `spine-core@4.2.111` — see Pitfall 1 below).
5. **Prerelease tag dot-separator rule** — irrelevant to Phase 41 directly but if v1.5.1 ships an `-rc.N` build, the existing convention applies.
6. **Linux is deferred** — viewer UAT targets macOS + Windows only.
7. **`@esotericsoftware/spine-core@^4.2.0`** is already direct-installed (`package.json:26`); spine-player will deduplicate against it as long as exact versions match.
8. **`feedback_delegate_implementation_choices`** — for any further mid-execution decisions in Claude's-discretion areas, take the durable default rather than re-prompting the user.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-player` | **4.2.111** (exact pin) | Official Spine WebGL playback library — wraps spine-core + spine-webgl into a self-mounting `SpinePlayer` class with `dispose()`, `play()`, `pause()`, `setAnimation()`. | Authored by Spine's authors. No realistic alternative — re-implementing this would violate SEED-009 design fact #1 ("not in the business of writing a Spine runtime"). |
| `@esotericsoftware/spine-core` | `^4.2.0` (already installed → resolves 4.2.111) | Math + skeleton-data primitives; transitively required by spine-player. Reused from sampler. | Already in `package.json:26`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | `^2.1.1` (already installed) | Literal-branch class composition for the modal. | Every `className=` with conditional state (loading / ready / error). |
| `react` + `react-dom` | `^19.2.5` (already installed) | Modal lifecycle, useState, useEffect, useRef. | The viewer is a React modal; no React-Spine wrapper library needed (and the one published wrappers target old spine-player versions — avoid). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@esotericsoftware/spine-player` | `pixi-spine` + custom Pixi.js renderer | Pixi-spine wraps spine-core for Pixi rendering only — would add a second WebGL rendering stack (~250 KB Pixi.js core) for zero benefit; pixi-spine's 4.2 support also lags upstream. Discarded. |
| `@esotericsoftware/spine-player` | Hand-rolled WebGL renderer using spine-webgl directly | We'd reimplement `SpinePlayer`'s asset loading, viewport math, input handling, animation-state ticking, error UI. SEED-009 design fact #1 forbids this. Discarded. |
| npm dep | Vendoring `spine-player.js` (Python reference's choice) | Vendoring suits sandboxed WebView JS worlds (PyQt's QWebEngineView). We're npm-native Electron + Vite; vendoring buys nothing and costs version-tracking discipline. **Discarded per D-01.** |
| `4.2.111` exact pin | `^4.2.0` semver range | `^4.2.0` resolves to 4.2.116 (today) → pulls `spine-core@4.2.116` transitively → diverges from the already-resolved `spine-core@4.2.111` direct dep → npm dedup chain breaks → two spine-core copies in renderer bundle → `instanceof Skeleton` checks may fail across copies + ~200 KB duplication. **Exact pin required.** |

**Installation:**
```bash
npm install @esotericsoftware/spine-player@4.2.111
```

**Version verification:** `[VERIFIED: npm registry, 2026-05-15]`
- `npm view @esotericsoftware/spine-player@4.2.111` → exists, ships `dist/Player.d.ts` + `dist/index.d.ts` + `dist/esm/spine-player.mjs` (572 KB) + `dist/spine-player.css` (27.4 KB, optional — only needed when `showControls: true`).
- Depends on `@esotericsoftware/spine-webgl@4.2.111`, which depends on `@esotericsoftware/spine-core@4.2.111` → matches installed direct dep version exactly.
- `latest` dist-tag is `4.3.0` (published 3 hours ago, 2026-05-15) — DO NOT use; our target is Spine 4.2.

## Architecture Patterns

### System Architecture Diagram

```
                     User clicks "Animation Viewer" toolbar button
                                       │
                                       ▼
                  AppShell.tsx — setAnimationViewerOpen(true)
                                       │
                                       ▼
              AnimationPlayerModal.tsx (mounted; open=true)
              ┌──────────────────────────────────────────────┐
              │ <div role="dialog" aria-modal="true">        │
              │   <div className="bg-modal …">  ← inner card │
              │     [ Top control bar — animation/skin/play/pause/scrub ]
              │     <div ref={containerRef}     ← player mounts here
              │          className="bg-[#232732] flex-1">  │
              │     </div>                                   │
              │   </div>                                     │
              │ </div>                                       │
              └────────────────────┬─────────────────────────┘
                                   │ useEffect on `open===true`:
                                   ▼
                  new SpinePlayer(containerRef.current, config)
                                   │
                  ┌────────────────┴───────────────┐
                  │ atlas-source mode              │  atlas-less mode
                  │ skeleton: pathToImageUrl(json) │  skeleton: pathToImageUrl(json)
                  │ atlas:    pathToImageUrl(.atlas)│  atlas:    "synthetic.atlas"
                  │ rawDataURIs: {} (optional)     │  rawDataURIs: {
                  │                                │    "synthetic.atlas":
                  │                                │      "data:text/plain;base64,...",
                  │                                │    "<region>.png":
                  │                                │      pathToImageUrl(sourcePath),
                  │                                │    …per region
                  │                                │  }
                  └────────────────┬───────────────┘
                                   │
                                   ▼
                  spine-player AssetManager
                  • downloadText(skeleton url)  → XHR → app-image:// handler → readFile
                  • downloadText(atlas url)     → XHR → app-image:// handler (or rawDataURIs)
                  • loadTexture(page name)      → <img src=…> → app-image:// → readFile
                                   │
                                   ▼
                  config.success(player)  ← React captures player.skeleton.data
                                   │       ← populates animation/skin dropdowns
                                   ▼
                  requestAnimationFrame loop:
                  state.update → state.apply → skeleton.update → updateWorldTransform → render
                                   │
                                   │ (modal closed OR project changed)
                                   ▼
                  useEffect cleanup:
                  player.dispose()  ← detaches DOM child, frees GL context,
                                    ← textures, listeners, canvas backing store
                                   │
                                   ▼
                  React unmounts containerRef parent — no DOM-mutation conflict
```

Implementation file map (read alongside the diagram):

| Diagram Component | Source File(s) |
|-------------------|----------------|
| Toolbar button | `src/renderer/src/components/AppShell.tsx:2087-2099` (insert new button after line 2099, before Documentation button at 2105) |
| `setAnimationViewerOpen` state | `src/renderer/src/components/AppShell.tsx:208` (add alongside `atlasPreviewOpen`) |
| Modal mount JSX | `src/renderer/src/components/AppShell.tsx:2462-2476` (add `<AnimationPlayerModal>` after `<AtlasPreviewModal>`) |
| `AnimationPlayerModal.tsx` (NEW) | `src/renderer/src/modals/AnimationPlayerModal.tsx` |
| ARIA scaffold hook | `src/renderer/src/hooks/useFocusTrap.ts` (reused verbatim) |
| URL bridge | `src/preload/index.ts:648` (existing `pathToImageUrl`) |
| `app-image://` scheme handler | `src/main/index.ts:571-597` (existing) |
| Atlas-less synth atlas text | NEW IPC `viewer:get-asset-feed` in `src/main/ipc.ts` (re-runs `synthesizeAtlasText` from `src/core/synthetic-atlas.ts`) — see Pitfall 3 |
| `modalOpen` derivation | `src/renderer/src/components/AppShell.tsx:1632-1675` (add `animationViewerOpen ||` to the OR chain) |

### Recommended Project Structure

No new directories. The viewer slots into the existing renderer modal family:

```
src/
├── core/                          # UNCHANGED — purity invariant
├── main/
│   ├── ipc.ts                     # +1 new handler: viewer:get-asset-feed (atlas-less path only)
│   ├── index.ts                   # UNCHANGED — existing app-image:// handler is sufficient
│   └── …
├── preload/
│   └── index.ts                   # +1 new bridge: getViewerAssetFeed
├── renderer/src/
│   ├── components/
│   │   └── AppShell.tsx           # +1 button, +1 state slot, +1 modal mount, +1 modalOpen entry
│   └── modals/
│       ├── AnimationPlayerModal.tsx  # NEW — the viewer component
│       ├── AtlasPreviewModal.tsx     # reference pattern (do not modify)
│       └── …
└── shared/
    └── types.ts                   # +ViewerAssetFeed interface (IPC return shape)
```

### Pattern 1: SpinePlayer instantiation + cleanup

**What:** The canonical pattern from the official docs (and confirmed in vendored `spine-player.js:14156-14243`): construct in a `useEffect` keyed on the open transition, dispose in cleanup. The player owns its own child DOM under the container.

**When to use:** Every mount of `AnimationPlayerModal`. The `useEffect` runs on the `open` → `true` transition (mounted with `open === true`) and the cleanup runs on the inverse.

**Example:**
```typescript
// Source: vendored spine-player.js:14227 + Python reference viewer.js:124-130
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  let player: SpinePlayer | null = null;
  let cancelled = false;

  void (async () => {
    const feed = await buildAssetFeed(summary);  // see Pattern 2
    if (cancelled) return;

    try {
      player = new SpinePlayer(container, {
        skeleton: feed.skeletonUrl,    // "<...>.json" or rawDataURIs key
        atlas:    feed.atlasUrl,       // ".atlas" url OR "synthetic.atlas"
        rawDataURIs: feed.rawDataURIs, // empty {} or atlas-less map
        showControls: false,           // we own the control bar
        backgroundColor: '23273200',   // matches D-02c #232732 + 00 alpha if alpha:true
        premultipliedAlpha: true,      // canonical; toggled per page in spine-core anyway
        animation: skeleton.data?.animations[0]?.name,  // re-set in success
        skin:      skeleton.data?.skins[0]?.name,
        success: (p) => {
          if (cancelled) { p.dispose(); return; }
          setPlayerState('ready');
          setAvailableAnimations(p.skeleton.data.animations.map(a => a.name));
          setAvailableSkins(p.skeleton.data.skins.map(s => s.name));
        },
        error: (_p, reason) => {
          if (cancelled) return;
          setPlayerState('error');
          setErrorReason(reason);
        },
      });
    } catch (e) {
      // spine-player throws AFTER calling config.error (vendored line 14954)
      // — guard so we don't bubble to the React error boundary
      if (!cancelled) setPlayerState('error');
    }
  })();

  return () => {
    cancelled = true;
    if (player) {
      try { player.dispose(); } catch { /* idempotent */ }
      player = null;
    }
    // React unmounts container after this — player.dispose already
    // detached its child DOM (line 14241 of spine-player.js), so no
    // double-remove conflict.
  };
}, [/* keyed on summary identity — see Pitfall 6 */ summary]);
```

### Pattern 2: Building the asset feed (mode-agnostic)

**What:** A single async function returns `{skeletonUrl, atlasUrl, rawDataURIs}` regardless of loaderMode. Both branches share the SpinePlayer config shape.

**When to use:** Called inside the modal's mount `useEffect` before constructing the player.

**Example:**
```typescript
// Combines: pathToImageUrl bridge (src/preload/index.ts:648),
// summary.skeletonPath + summary.atlasPath + summary.regions[].sourcePath fields,
// and a NEW IPC `viewer:get-asset-feed` for atlas-less synth-text retrieval.
async function buildAssetFeed(summary: SkeletonSummary): Promise<ViewerAssetFeed> {
  const skeletonUrl = await window.api.pathToImageUrl(summary.skeletonPath);

  // Mode detect mirrors AppShell.tsx:932-935
  const isAtlasLess = summary.atlasPath === null;

  if (!isAtlasLess) {
    // Atlas-source: spine-player resolves page PNGs via `parent + page.name`
    // where parent = atlasUrl's dir (vendored line 5861-5862). All assets
    // sit next to .atlas → parent-relative URL chain works.
    const atlasUrl = await window.api.pathToImageUrl(summary.atlasPath!);
    return { skeletonUrl, atlasUrl, rawDataURIs: {} };
  } else {
    // Atlas-less: synth atlas text from main, region PNGs via existing summary
    const synth = await window.api.getViewerAssetFeed(summary.skeletonPath);
    const rawDataURIs: Record<string, string> = {
      'synthetic.atlas': synth.atlasTextDataUri, // "data:text/plain;base64,..."
    };
    // For each region, map "<regionName>.png" → app-image:// for its sourcePath.
    // Use summary.regions (NOT summary.peaks) since regions are dedup'd.
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

### Pattern 3: Animation + skin live-switching

**What:** Spine-player has only `setAnimation(name, loop)`. Skin switch goes through `player.skeleton.setSkinByName + setSlotsToSetupPose` (verified Python reference + vendored line 14446).

**When to use:** `<select onChange>` handlers in the top control bar.

**Example:**
```typescript
// Source: Python reference viewer.js:236-252 + vendored spine-player.js:14446
function onAnimationChange(name: string) {
  if (!playerRef.current) return;
  playerRef.current.setAnimation(name, loopEnabled); // returns TrackEntry
  // For consistency with the loop state, set entry.loop on the returned track:
  const entry = playerRef.current.animationState.getCurrent(0);
  if (entry) entry.loop = loopEnabled;
  setActiveAnimation(name);
}

function onSkinChange(name: string) {
  const p = playerRef.current;
  if (!p || !p.skeleton) return;
  p.skeleton.setSkinByName(name);
  p.skeleton.setSlotsToSetupPose();  // critical — without this, attachments
                                      // from the previous skin remain bound
  setActiveSkin(name);
}
```

### Pattern 4: Scrub via animationState time manipulation

**What:** spine-player has no `seek()` method. The Python reference's pattern (validated against vendored `spine-player.js:14330-14338` which does the same thing for the built-in timeline slider) is to pause, compute delta to target time, update + apply state, update skeleton, update world transform, write back `playTime`.

**When to use:** `<input type="range" onChange>` handler.

**Example:**
```typescript
// Source: Python reference viewer.js:274-287 +
// vendored spine-player.js:14330-14338 (built-in timeline slider uses identical logic)
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
  p.skeleton.updateWorldTransform(2);  // 2 === Physics.update (spine-core 4.2 enum)
  p.playTime = targetTime;
}
```

Note the world-transform argument `2` is the enum value for `Physics.update` per CLAUDE.md fact #3 (the same value the sampler uses). Pass `2` literally — no need to import the enum.

### Anti-Patterns to Avoid

- **Don't render spine-player's own controls (`showControls: true`)** — we own the control bar per D-02b. With `showControls: true`, spine-player injects a separate controls div + requires `dist/spine-player.css` to be loaded; we'd then have two overlapping control surfaces. Set `showControls: false` and ignore the bundled CSS file entirely.

- **Don't import from `@esotericsoftware/spine-core` AND `@esotericsoftware/spine-player` in the same renderer file** unless necessary — spine-player re-exports spine-core (`dist/index.js` re-exports from `@esotericsoftware/spine-core`). If you need a `Skeleton` or `AnimationState` type, import it from `@esotericsoftware/spine-player` to avoid the risk of two distinct `import` paths resolving to two distinct module instances under some bundler/HMR scenarios (low risk with exact-version pin but trivially avoided this way).

- **Don't construct `app-image://` URLs by string concatenation** — Phase 12 D-19 Windows bug. ALWAYS go through `window.api.pathToImageUrl(absPath)`.

- **Don't put canvas inside a flex container without a fixed/percentage height** — spine-player's inner canvas uses `style="width:100%;height:100%"`. If the parent collapses to height 0, the canvas renders at 1×1 px and the user sees a blank modal. The reference modal sizing (`max-h-[90vh] flex flex-col`) provides the necessary outer height; the canvas container must use `flex-1` to claim the leftover space.

- **Don't call `player.dispose()` twice** — the `disposed` flag (vendored line 14242) is set after first dispose, but the parent.removeChild call (line 14241) would throw on a second invocation since the DOM child is already gone. Guard the cleanup with a try/catch or a local `disposed` flag.

- **Don't await `pathToImageUrl` inside the React render path** — it returns a Promise. Use it ONLY inside `useEffect` async closures. Storing the resolved URL in `useState` to re-render with src=... is an alternative but unnecessary for the viewer (the player consumes the URL once at construction).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebGL skeleton renderer | Custom Pixi.js / Three.js / raw WebGL2 + spine-core | `@esotericsoftware/spine-player` | spine-player handles viewport math, padding, animation-state tick order, mesh deformation, texture filtering, mipmap generation, premultiplied-alpha pipelines, WebGL context loss/restore — ~600 KB of battle-tested logic Esoteric maintains. SEED-009 design fact #1. |
| Animation timeline scrubber primitive | Custom track + thumb + drag-math | Native `<input type="range" min="0" max="1" step="0.001">` driving the Pattern 4 seek logic | Native range input is keyboard-accessible (arrow keys), screen-reader friendly, focus-trap-compatible, free. The Python reference also uses a custom slider — but its host (PyQt WebView) lacks native range input styling, which is not our constraint. |
| Animation / skin dropdowns | Custom popover + listbox | Native `<select>` (precedent: `OptimizeDialog.tsx:atlasMaxPageSize`) | Native select handles keyboard navigation (arrow keys + type-ahead), focus-trap-compatible, no a11y rework. Renderer-wide pattern. |
| Asset fetch / atlas parse / texture upload | Custom XHR + `new TextureAtlas(text)` + `loadTexture` orchestration | spine-player's internal `AssetManager` (kicks in automatically from config) | Handles concurrent fetches, error propagation through `config.error`, retry-free single-attempt semantics, content-type-agnostic XHR via `overrideMimeType('text/html')`. |
| Atlas-less synth-atlas re-implementation in renderer | Calling `synthesizeAtlasText` from renderer-side | New main-side IPC handler that re-uses `src/core/synthetic-atlas.ts` | `core/` is `fs`-bound; renderer is forbidden from importing `core/` (arch.spec.ts). The IPC handler runs `synthesizeAtlasText` main-side and ships the text + path map across. |
| WebGL context teardown logic | Custom `gl.getExtension('WEBGL_lose_context')` calls | `player.dispose()` | Player's dispose chain (sceneRenderer + assetManager + canvas + listeners + DOM child) is the canonical path — verified at vendored line 14227-14243. |

**Key insight:** every part of the viewer surface that's NOT "ARIA modal scaffold" or "thread the data into the player" is already in spine-player. The phase work is plumbing, not graphics.

## Runtime State Inventory

Phase 41 is greenfield-additive — no rename, no migration, no refactor of existing surfaces. Omitting the inventory per the protocol rule (greenfield-only phase). Existing surfaces touched (toolbar button, AppShell state, modal mount JSX) are all additive insertions, not modifications to existing state.

**Verification:**
- Stored data: None — viewer does not persist (D-04b). No `.stmproj` schema change, no migration.
- Live service config: None — viewer is in-process only.
- OS-registered state: None.
- Secrets/env vars: None — viewer reads local on-disk assets via existing scheme handler.
- Build artifacts: None — adds renderer-bundle code only; out/main is unaffected.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-player@4.2.111` | All VIEWER-* | ✗ (not installed; D-01 lock authorizes install) | — | None — phase blocks until installed |
| `@esotericsoftware/spine-core@^4.2.0` | spine-player transitive | ✓ | 4.2.111 (resolved) | — |
| WebGL 1.0 / WebGL 2.0 in Electron renderer | VIEWER-02, VIEWER-04 | ✓ | Electron 41.3.x ships Chromium 137+ with WebGL 1 + 2 enabled by default | None needed |
| `app-image://` scheme handler | VIEWER-03 | ✓ | Registered at `src/main/index.ts:106-111` + `:571-597` | — |
| `useFocusTrap` hook | VIEWER-02 modal scaffold | ✓ | `src/renderer/src/hooks/useFocusTrap.ts` | — |
| `synthesizeAtlasText` core function | VIEWER-03 atlas-less | ✓ | `src/core/synthetic-atlas.ts:134` | — |
| `pathToImageUrl` preload bridge | VIEWER-03 | ✓ | `src/preload/index.ts:648` + main handler at `src/main/ipc.ts:1234-1242` | — |

**Missing dependencies with no fallback:** `@esotericsoftware/spine-player@4.2.111` install is the first phase task; nothing else can land until it's in `package.json` + `node_modules`.

**Missing dependencies with fallback:** None.

## Common Pitfalls

### Pitfall 1: Loose semver pin (`^4.2.0`) duplicates spine-core in the renderer bundle
**What goes wrong:** With `^4.2.0`, npm resolves `spine-player` to 4.2.116 (today's highest 4.2.x, published 2 days ago). That pulls `spine-webgl@4.2.116` → `spine-core@4.2.116`. The project's existing direct dep `spine-core@^4.2.0` is ALREADY locked at 4.2.111. npm dedup cannot collapse two different exact versions; the renderer bundle ends up with TWO copies of spine-core. Symptoms: ~200 KB bundle bloat, `instanceof Skeleton` checks may fail across copies, and the sampler's spine-core instance ≠ the viewer's spine-core instance (no shared state but no apparent bug — silently divergent code paths).
**Why it happens:** The convenience of `^` semver ranges loses to the velocity of Esoteric's release cadence (116 patch versions of 4.2.x already shipped).
**How to avoid:** Pin exact: `npm install @esotericsoftware/spine-player@4.2.111`. After install, verify with `ls node_modules/@esotericsoftware/` shows ONE spine-core, ONE spine-webgl, ONE spine-player, all at 4.2.111. Also pin the existing `spine-core` from `^4.2.0` to `4.2.111` for symmetry (small fix in `package.json:26`).
**Warning signs:** `ls node_modules/@esotericsoftware/spine-core/` shows multiple subdirectories, or `npm ls @esotericsoftware/spine-core` shows multiple entries at different versions.

### Pitfall 2: `error` callback fires THEN spine-player throws (double error surface)
**What goes wrong:** spine-player's `showError(message, error)` method (vendored line 14944-14957) sets `this.error = true`, appends a `<div class="spine-player-error">` overlay to its own DOM (line 14949-14952), calls `config.error(this, message)` (line 14953), then **throws** the underlying Error (line 14954). The synchronous throw bubbles out of the `new SpinePlayer(...)` call, unless asset loading was async (then the throw goes to the unhandled-rejection / requestAnimationFrame frame).
**Why it happens:** Defensive overengineering in the player — calls user callback AND throws so misimplemented integrations notice errors loudly. Our integration uses the callback for state, so the throw is redundant noise.
**How to avoid:** Wrap `new SpinePlayer(...)` in try/catch. Also add a global guard for the async case — the throw from inside the AssetManager's loadJson/loadTexture rejection inside the rAF tick lands as an unhandled rejection on `window`. Surface it via a `window.addEventListener('unhandledrejection', ...)` registered on viewer mount IF the planner wants belt-and-suspenders coverage. The terminal Close-only state (D-04c) means there's no recovery flow regardless — the `error` callback firing first is sufficient to set `setPlayerState('error')`.
**Warning signs:** DevTools shows "Uncaught Error: Couldn't load JSON..." in the console even though the modal is showing the in-app error state — symptom of the throw escaping the try/catch.

### Pitfall 3: Atlas text doesn't cross IPC by default — must be added
**What goes wrong:** The renderer has `summary.skeletonPath` (path string) and `summary.atlasPath` (path string OR null). It does NOT have the atlas TEXT — `synthesizeAtlasText` runs in `core/loader.ts` and the output gets consumed by `new TextureAtlas()` server-side, but the raw text is discarded after parsing. For atlas-less mode, the viewer needs the synthesized text inline.
**Why it happens:** Pre-Phase-41 there was no consumer of the atlas text on the renderer side; the loader's atlas text was a transient. Phase 21 added the synth path but kept it main-internal.
**How to avoid:** Add a NEW IPC `viewer:get-asset-feed` (the planner picks the exact name) registered in `src/main/ipc.ts` that takes the current `skeletonPath` + project loaderMode and:
1. **Atlas-source branch:** returns `{atlasUrl: <pathToFileURL>(.atlas), pages: [{ filename, url }]}`. Or omits this branch since atlas-source needs no synth and renderer can construct URLs via `pathToImageUrl`. Default lean: handle atlas-source entirely in renderer (no IPC needed), use this new IPC ONLY for atlas-less.
2. **Atlas-less branch:** re-runs `synthesizeAtlasText(parsedJson, imagesDir, skeletonPath)` (importable from `src/core/synthetic-atlas.ts` since main is `core/`-allowed), encodes `synth.atlasText` as a base64 `data:text/plain;base64,...` URI, and returns `{atlasTextDataUri, regionPaths: synth.pngPathsByRegionName}`. The renderer transforms the absolute paths into `app-image://` URLs via the existing `pathToImageUrl` bridge.

Alternatively (lower-friction but adds a small string to every IPC payload that re-uses MaterializedProject): cache `atlasText` on `MaterializedProject` after the loader run. This avoids the new IPC entirely. Atlas text is typically a few hundred bytes per region — for a 100-region rig that's ~30 KB, structuredClone-safe and gitignore-safe.
**Warning signs:** Atlas-less viewer fails with "Couldn't load text synthetic.atlas: status 0" — symptom of `rawDataURIs["synthetic.atlas"]` not being set or being malformed.

### Pitfall 4: `summary.regions[].sourcePath` may be `undefined` for atlas-source mode
**What goes wrong:** In atlas-source mode, regions have `atlasSource.pagePath` (where the page PNG lives) but NOT necessarily `sourcePath` (per-region PNG, which often doesn't exist on disk for atlas-packed projects). Building the `rawDataURIs` map naively from `regions[].sourcePath` would skip these entries and the player would 404 on page loads.
**Why it happens:** atlas-source's atlas file references page PNGs by name (e.g., `JOKERMAN.png`); per-region PNGs are an atlas-less concept. In atlas-source mode, the page PNG is the unit of texture upload.
**How to avoid:** Branch the asset-feed construction on `isAtlasLess`. For atlas-source mode, do NOT populate `rawDataURIs` per-region — let spine-player resolve page PNGs via `parent + page.name` (vendored line 5862) where parent = directory of atlasUrl. Since `pathToImageUrl(atlasPath)` is an `app-image://localhost/Users/.../JOKERMAN.atlas`, parent becomes `app-image://localhost/Users/.../`, and page filename `JOKERMAN.png` resolves correctly. **For atlas-less mode**, every region IS its own page (synthetic-atlas writes one page-per-region), so per-region `sourcePath` is reliably populated.
**Warning signs:** atlas-source viewer renders a blank canvas because pages 404 — symptom of `rawDataURIs` polluted with bad keys masking the parent-relative lookup.

### Pitfall 5: HMR + WebGL context leak in dev mode
**What goes wrong:** Vite HMR replaces the AnimationPlayerModal module without unmounting the React tree. The new module's `useEffect` runs against the old DOM container, calling `new SpinePlayer(...)` while the previous instance's WebGL context still holds the canvas. Result: leaked GL context per HMR update — DevTools' "WebGL contexts in use" climbs until Chrome enforces its 16-context limit and starts evicting the oldest.
**Why it happens:** spine-player's dispose pattern relies on React's unmount/remount semantics. HMR sidesteps both.
**How to avoid:** Two layers of defense:
1. Make the player-mount `useEffect` depend on a stable identity for the project (e.g., `summary.skeletonPath`). When HMR replaces the module, useEffect re-evaluates its dep array — since the dep is the same path string, React skips re-creating the player. (Vite HMR for React refreshes hooks by re-running effects when their deps differ; if deps are identical, the previous instance is preserved across the HMR boundary.)
2. Defensively in the cleanup function, guard `player.dispose()` with a `disposed` flag (vendored line 14242 sets `this.disposed` after first dispose, but doesn't guard subsequent calls — second dispose would throw on the removeChild). Pattern:
   ```typescript
   return () => {
     if (player && !disposed) {
       disposed = true;
       try { player.dispose(); } catch { /* idempotent best-effort */ }
     }
   };
   ```
**Warning signs:** Dev console shows "WARNING: Too many active WebGL contexts. Oldest context will be lost." after the third or fourth HMR reload of the modal file. Or memory in `chrome://memory` (Electron exposes the same surface via Cmd-Shift-J → Performance → Memory) grows on every HMR.

### Pitfall 6: AppShell does NOT unmount on summary-only changes (same `state.status === 'loaded'`)
**What goes wrong:** VIEWER-08 requires "switching to a different project closes any prior viewer instance." If the user picks a new file via File→Open (App.tsx state transitions through `'loading'` → `'projectLoaded'`), AppShell unmounts entirely and the modal disappears cleanly. BUT if the parent re-renders AppShell with a NEW `summary` prop at the same `state.status` (rare but possible via SettingsDialog re-sample), AppShell stays mounted, the modal stays open, but it's pointing at the OLD player tied to the OLD summary's assets. The player would continue rendering correctly until the next user interaction tries to switch animation/skin to a name that doesn't exist in the new skeleton.
**Why it happens:** App.tsx remounts AppShell only on `status` transition, not on prop-identity change.
**How to avoid:** Add a reset useEffect in AppShell mirroring the existing `setLocalSummary(null)` pattern at `AppShell.tsx:281-283`:
```typescript
// Phase 41 — close viewer when a new summary identity arrives (resample,
// settings-driven re-sample). Mirrors the localSummary reset at line 281.
useEffect(() => {
  setAnimationViewerOpen(false);
}, [summary]);
```
This is the "project-change cleanup seam" referenced in CONTEXT D-50 / D-74 parity rule. The trigger is `summary` prop identity, which changes whenever App.tsx materializes a fresh skeleton (drop / Open / resample). AppShell-internal `localSummary` overrides don't trigger this — but a viewer pointed at the local override is fine since the modal can read either bucket.
**Warning signs:** User does Settings → "Re-sample at 240 Hz" with the viewer open → viewer shows the old skeleton playing → user clicks the animation dropdown → empty list because dropdown was populated from the new skeleton's data but the player is still rendering the old.

### Pitfall 7: AppShell `modalOpen` derivation must include `animationViewerOpen`
**What goes wrong:** The viewer is a `role="dialog"` modal but is NOT included in the OR-chain at `AppShell.tsx:1632-1675`. Result: File menu items (Save / Save As / Reload / Open) stay enabled at the OS level while the viewer is open — user can Cmd-S during playback. Phase 08.2 D-184 spec says modalOpen disables File menu items.
**Why it happens:** Easy to overlook — there are 7 boolean slots already in the derivation; adding a new modal without adding to the chain is a silent regression.
**How to avoid:** Plan an explicit task: edit `AppShell.tsx:1632-1675` to add `animationViewerOpen ||` to the derivation and add `animationViewerOpen` to the `useEffect` dep array on line 1667-1675. Include this in the verification checklist.
**Warning signs:** Cmd-S works while the viewer is open; AppShell-spec test that asserts `modalOpen === true` for each modal fails for the viewer.

### Pitfall 8: Canvas's `style="width:100%;height:100%"` collapses to 1×1 px without a sized parent
**What goes wrong:** Spine-player's inner DOM (vendored line 14181) is `<div class="spine-player" style="position:relative;height:100%"><canvas class="spine-player-canvas" style="display:block;width:100%;height:100%"></canvas></div>`. The outer div needs a known height; if dropped into a `flex flex-col` parent without `flex-1`, it computes to 0 and the canvas renders at 1×1 px → user sees a blank modal even though the player is "working."
**Why it happens:** Inherited from CSS percentage-height rules — `height: 100%` requires the parent to have a non-`auto` height.
**How to avoid:** The container div MUST be a flex child with `flex-1` (or `flex-grow: 1` equivalent), OR have a fixed `height` / `min-height`. The AtlasPreviewModal layout pattern (`max-h-[90vh] flex flex-col` outer → `flex-1 overflow-hidden` inner) is the proven shape; mirror it for AnimationPlayerModal with the player container as the `flex-1` child below the top control bar.
**Warning signs:** Modal opens, all controls render, canvas area is empty / no visible character; resizing the window has no effect.

## Code Examples

### Example 1: Native top control bar with `<select>` + `<input type="range">`

Verified pattern from `OptimizeDialog.tsx` (native `<select>` precedent — `atlasMaxPageSize` dropdown):

```typescript
// Source: src/renderer/src/modals/OptimizeDialog.tsx (atlasMaxPageSize dropdown)
// + Pattern 4 above for the scrub handler
<div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
  <label className="text-xs text-fg-muted">Animation</label>
  <select
    value={activeAnimation}
    onChange={(e) => onAnimationChange(e.target.value)}
    disabled={playerState !== 'ready'}
    className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
  >
    {availableAnimations.map(name => (
      <option key={name} value={name}>{name}</option>
    ))}
  </select>

  <label className="text-xs text-fg-muted ml-3">Skin</label>
  <select
    value={activeSkin}
    onChange={(e) => onSkinChange(e.target.value)}
    disabled={playerState !== 'ready'}
    className="bg-surface border border-border rounded-md px-2 py-1 text-xs text-fg disabled:opacity-50"
  >
    {availableSkins.map(name => (
      <option key={name} value={name}>{name}</option>
    ))}
  </select>

  <button
    type="button"
    onClick={isPaused ? onPlay : onPause}
    disabled={playerState !== 'ready'}
    className="border border-border rounded-md px-3 py-1 text-xs ml-3"
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
    disabled={playerState !== 'ready'}
    className="flex-1 ml-3"
    aria-label="Animation timeline"
  />
</div>
```

### Example 2: Modal frame mirroring AtlasPreviewModal scaffold

```typescript
// Source: src/renderer/src/modals/AtlasPreviewModal.tsx:234-339 (verbatim ARIA scaffold)
if (!props.open) return null;
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
      className="bg-modal border border-border rounded-md p-6 w-[1280px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="animation-viewer-title" className="text-sm text-fg">
          Animation Viewer
          <span className="ml-2 text-fg-muted">
            {/* dynamic project basename or animation name */}
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

      {/* Top control bar — see Example 1 */}

      {/* Player container — MUST be flex-1 (Pitfall 8) */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-[#232732] border border-border rounded-md"
        style={{ minHeight: 400 }}  // belt-and-suspenders against parent collapse
      />

      {/* Error overlay (rendered conditionally when playerState === 'error') */}
      {playerState === 'error' && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="bg-modal border border-border rounded-md p-6 max-w-md">
            <p className="text-sm text-fg mb-4">{errorMessage}</p>
            <button type="button" onClick={props.onClose} className="...">Close</button>
          </div>
        </div>
      )}
    </div>
  </div>
);
```

### Example 3: `SpinePlayerConfig` type-checked construction

```typescript
// Verified from dist/Player.d.ts (TypeScript definitions ship with package)
import { SpinePlayer, type SpinePlayerConfig } from '@esotericsoftware/spine-player';

const config: SpinePlayerConfig = {
  skeleton: skeletonUrl,
  atlas: atlasUrl,
  rawDataURIs: rawDataURIs,           // optional, Record<string, string>
  showControls: false,
  premultipliedAlpha: true,
  backgroundColor: '23273200',         // RGBA hex (no '#'); 6 or 8 hex chars
  defaultMix: 0.25,
  animation: firstAnimationName,
  skin: firstSkinName,
  alpha: false,                        // no canvas transparency (matches D-02c solid bg)
  success: (player) => { /* ... */ },
  error: (player, reason) => { /* ... */ },
};
const player = new SpinePlayer(containerRef.current!, config);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| spine-player as a vendored `.js` file (Python reference's pattern) | npm package `@esotericsoftware/spine-player` with TypeScript .d.ts | Esoteric has published to npm since spine-ts 4.0 | Vite tree-shakes unused parts (PlayerEditor not bundled); TypeScript types catch config typos at compile time |
| `<script src="https://esotericsoftware.com/files/spine-player/4.1/spine-player.js">` (CDN) | npm install pinned version | 4.0+ era | Version reproducibility, offline-friendly, no CSP `script-src` exception for the remote CDN |
| `spine-player.css` for built-in controls UI | `showControls: false` + own React control bar | Always (CSS is optional when `showControls: false`) | Skip CSS load entirely; integrate with app's Tailwind token system |
| Loading PNGs via direct `file://` URL strings | `app-image://` custom scheme with main-side handler (Phase 12 D-19) | 2026-04-28 | Cross-platform-safe (Windows drive-letter), CSP-clean, secure-context tag for canvas reads |

**Deprecated/outdated:**
- `spine-player@4.1.x` references in the Python reference (`spine-skin-swap/viewer.js` was authored against 4.1.55). API surface is byte-for-byte identical in 4.2.x for the keys we use (`skeleton`, `atlas`, `rawDataURIs`, `showControls`, `premultipliedAlpha`, `backgroundColor`, `animation`, `skin`, `success`, `error`, `frame`, `defaultMix`) — verified by reading the vendored player's class body (which is the IIFE bundle of the same upstream source).
- Manual XHR + `new TextureAtlas()` + `new Skeleton()` construction (pre-spine-player era). spine-player wraps all of this and exposes the result via `player.skeleton` + `player.animationState`.

## Assumptions Log

All claims tagged `[ASSUMED]` in this research:

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite renderer bundler will tree-shake spine-player's IIFE-targeting code paths (PlayerEditor + CodeMirror dynamic imports at lines 15159-15183 of vendored source) when consuming the ESM build (`dist/esm/spine-player.mjs`) | Standard Stack — Installation | Mild — worst case the renderer bundle ships an extra ~50KB of unused PlayerEditor code. Verify by running `npm run build` post-install and inspecting renderer bundle size. No functional impact. |
| A2 | `app-image://` scheme handler's `application/octet-stream` content-type works for spine-player's atlas-text XHR via `overrideMimeType('text/html')` | Pattern 2, Pitfall 4 | Low — verified `XMLHttpRequest.overrideMimeType` semantics in the W3C spec but not in this specific Electron version. If broken, surface is a single content-type branch addition in `src/main/index.ts:588-592` (add `ext === 'atlas'` → `text/plain` and `ext === 'json'` → `application/json`). |
| A3 | Player's `parent.removeChild(this.dom)` at line 14241 won't conflict with React's reconciliation of the container div as long as the container is a `useRef`-managed direct child (no React children, just the player's mounted subtree) | Pattern 1, Anti-Patterns | Low — React documents that direct ref-based DOM mutation of an "owned" subtree (no React children) is safe. The container div has zero React children — only the player's auto-injected subtree. |
| A4 | spine-player's bundled CSS (`dist/spine-player.css`) can be omitted entirely when `showControls: false` | Anti-Patterns, Standard Stack | Low — verified the only CSS classes the player injects are scoped to its inner `spine-player` div and only meaningful when controls render. Confirm by inspecting the canvas div in DevTools post-mount: no class-targeted styles missing. |
| A5 | The exact-version pin `@esotericsoftware/spine-player@4.2.111` will continue to be available on npm | Standard Stack | Negligible — Esoteric does not unpublish; npm registry retention is permanent for non-revoked packages. |

## Open Questions

### Q1 — Atlas text delivery shape: new IPC vs additive `MaterializedProject` field
**What we know:** Renderer cannot run `synthesizeAtlasText` (`fs`-bound, lives in `core/`). Main can. Two paths exist:
- **Option A (new IPC):** Add `viewer:get-asset-feed` handler that re-runs synth on demand. Pro: nothing changes in existing payload shapes. Con: ~one-off IPC roundtrip per viewer open + planner-mandated coordination on type definitions in `shared/types.ts`.
- **Option B (additive field):** Add optional `atlasText?: string` to `SkeletonSummary` (or `MaterializedProject`), populated by `core/loader.ts` for atlas-less mode (already has the text — line 417 + 494 pass it into `new TextureAtlas()`). Pro: zero IPC cost on viewer open. Con: ~30 KB string in every payload regardless of whether the viewer is opened; couples a renderer-of-the-future feature to a load-time data structure.

**Recommendation:** Option A. The structuredClone cost across all IPC paths to plumb an unused field is wasteful for a low-frequency viewer-open event. The IPC roundtrip is fast (synth is ~5ms for the SIMPLE_TEST fixture, dominated by I/O).

### Q2 — `atlasOutputMode: 'atlas' | 'both'` projects: does the viewer play the source atlas or the user-side `loaderMode` bucket?
**What we know:** Phase 40 added `atlasOutputMode` (loose / atlas / both) for export. CONTEXT D-04 locks "viewer plays the source project" — but is "source project" the `loaderMode='atlas-less'` bucket regardless of what `atlasOutputMode` is set to?
**Recommendation:** Yes. `loaderMode` is the user's INPUT-side decision (what files on disk to read). `atlasOutputMode` is the OUTPUT-side decision (what to write during Optimize). The viewer plays SOURCE, so input-side bucket wins. Concretely: the viewer's `isAtlasLess` branch in `buildAssetFeed` should derive from `summary.atlasPath === null || loaderMode === 'atlas-less'` (mirroring the `effectiveLoaderMode` idiom at `AppShell.tsx:932-935`), NOT from `atlasOutputMode`. This is consistent with D-04a "atlas-less reuses Phase 21 synthetic-atlas path."

### Q3 — Loop toggle: needed in v1.5.1 or implicit?
**What we know:** D-04b says "play + loop on" by default. VIEWER-06 doesn't list a loop toggle in the control set. CONTEXT D-02b lists "[Animation ▾] [Skin ▾] [⏵ play] [⏸ pause] [───●───── scrub]" — no loop control.
**Recommendation:** No loop UI in v1.5.1. Loop stays on permanently. If a future phase wants the toggle, the state lives in a `loopEnabled` boolean already needed internally (Pattern 3 uses it to set `entry.loop` on animation change). Surface in UI later if animator UAT requests it.

## Project Constraints (from CLAUDE.md)

Already enumerated in detail above under "Project Constraints (from CLAUDE.md + existing arch tests)". Recap:

1. `src/core/*` purity invariant (arch.spec.ts:19-34)
2. `app-image://` scheme handler is single source of truth for cross-platform URLs
3. Tailwind v4 literal-class discipline
4. Spine 4.2-only target (do NOT install 4.3.x)
5. Prerelease tag dot-separator rule
6. Linux deferred
7. Existing spine-core direct dep at 4.2.111 — pin spine-player to match exactly
8. Delegate-pure-implementation-choices durable signal

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@^4.0.0` (already configured) |
| Config file | `vitest.config.ts` (root) — discovered via grep |
| Quick run command | `npm run test -- AnimationPlayerModal` (filters to viewer specs) |
| Full suite command | `npm run test` |
| Test environment | `jsdom@^29.0.2` (for renderer specs) — note `getContext('2d')` returns null AND `getContext('webgl')` returns null in jsdom; WebGL-rendered output is NOT testable in jsdom, only structural smoke tests |

### Phase Requirements → Test Map

Critical scope note: jsdom cannot run WebGL. Visual canvas content (the actual animated character) is NOT automatable through vitest. The validation architecture below uses jsdom-friendly structural assertions (mount/unmount/state) for VIEWER-01..05 + VIEWER-08 + VIEWER-09, and flags VIEWER-04's "shows character animated" and VIEWER-06's "scrub visibly moves the character" as **manual UAT** that runs on a live Electron dev server.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEWER-01 | spine-player importable from renderer; renderer bundle builds | unit + build | `pytest tests/...` N/A — vitest: `npx vitest run --reporter=verbose tests/renderer/animation-player-modal.spec.tsx -t "imports"` AND `npm run build` (succeeds with new dep) | ❌ Wave 0 (new spec file) |
| VIEWER-01 | spine-player version installed matches pin | unit | `cat package.json` grep + `npm ls @esotericsoftware/spine-player` (script-friendly via `--json`) — runnable in CI | ❌ Wave 0 (no existing version-pin assertion test) |
| VIEWER-02 | Modal mounts (`role="dialog"` + container ref non-null after open=true → true transition) | unit | `npx vitest run tests/renderer/animation-player-modal.spec.tsx -t "mounts"` | ❌ Wave 0 |
| VIEWER-02 | Modal cleans up on close (player.dispose called once) | unit | spy on `SpinePlayer.prototype.dispose` via `vi.spyOn`; mount + setOpen(false); assert spy.calls.length === 1 | ❌ Wave 0 |
| VIEWER-02 | HMR resilience | manual-only | dev server: edit `AnimationPlayerModal.tsx` while open, count WebGL contexts in DevTools | n/a — requires live Electron |
| VIEWER-03 | Asset feed (atlas-source): config.skeleton + config.atlas are app-image:// URLs | unit | mock window.api.pathToImageUrl → assert constructor called with both fields populated as `app-image://localhost/...` | ❌ Wave 0 |
| VIEWER-03 | Asset feed (atlas-less): config.rawDataURIs includes `synthetic.atlas` + per-region keys | unit | mock summary with `atlasPath: null` + regions[].sourcePath fixtures; mock window.api.getViewerAssetFeed; assert rawDataURIs keys + values | ❌ Wave 0 |
| VIEWER-04 | Toolbar button renders + onClick opens modal | unit | `npx vitest run tests/renderer/appshell-...` — extend existing AppShell smoke test with viewer-button assertions | ⚠️ existing AppShell spec needs viewer-button extension |
| VIEWER-04 | Character animated visibly | manual-only | dev server: open viewer with fixtures/SIMPLE_PROJECT, observe character on canvas | n/a |
| VIEWER-05 | Animation `<select>` populated from skeleton.data.animations after success callback | unit | mock SpinePlayer to invoke success synchronously with stub skeleton; assert `<select>` option count + names | ❌ Wave 0 |
| VIEWER-05 | onChange handler calls player.setAnimation with new name + loop flag | unit | fireEvent.change on select; spy on `SpinePlayer.prototype.setAnimation`; assert call args | ❌ Wave 0 |
| VIEWER-05 | Skin onChange calls player.skeleton.setSkinByName + setSlotsToSetupPose | unit | spy on skin chain; assert both methods called in order | ❌ Wave 0 |
| VIEWER-06 | Play / pause buttons toggle player.paused state | unit | mock player.paused getter + play/pause spies; fireEvent.click; assert spies | ❌ Wave 0 |
| VIEWER-06 | Scrub updates player.playTime + animationState | unit | spy on animationState.update/apply + skeleton.update/updateWorldTransform; fireEvent.change on range input; assert call order | ❌ Wave 0 |
| VIEWER-06 | Default open: first animation + first skin + play + loop on | unit | mount with stub success callback; assert config.animation = data.animations[0].name etc. | ❌ Wave 0 |
| VIEWER-08 | dispose count == construction count across N open/close cycles | unit | for (i=0; i<5; i++) { mount, unmount }; assert SpinePlayer constructor + dispose spy call counts | ❌ Wave 0 |
| VIEWER-08 | Project change closes viewer (setAnimationViewerOpen(false) on summary identity change) | unit | render AppShell with summary A + viewer open; re-render with summary B (new identity); assert modal unmounted | ❌ Wave 0 (extends AppShell spec) |
| VIEWER-09 | Malformed JSON: error callback fires + state → 'error' + Close-only UI rendered | unit | mock SpinePlayer constructor to invoke config.error inline (skip throw); assert error UI + no animation dropdown | ❌ Wave 0 |
| VIEWER-09 | Missing atlas: same path with reason="Couldn't load text..." | unit | as above, vary reason string | ❌ Wave 0 |
| VIEWER-09 | Missing PNG: same path with reason="Couldn't load image..." | unit | as above | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/renderer/animation-player-modal.spec.tsx tests/renderer/appshell-viewer.spec.tsx` (~1-2 sec)
- **Per wave merge:** `npm run test` (full vitest run; ~30 sec)
- **Phase gate:** Full suite green + manual UAT scenarios documented in `41-HUMAN-UAT.md` before `/gsd-verify-work 41`

### Wave 0 Gaps
- [ ] `tests/renderer/animation-player-modal.spec.tsx` — primary spec, covers VIEWER-01..03 + VIEWER-05..06 + VIEWER-08 + VIEWER-09 unit assertions
- [ ] `tests/renderer/appshell-viewer-integration.spec.tsx` — extends AppShell smoke tests for VIEWER-04 + VIEWER-08 project-change cleanup
- [ ] `tests/renderer/conftest.ts` equivalent — vitest setup file with `vi.stubGlobal('api', ...)` stubbing `pathToImageUrl` + new `getViewerAssetFeed` bridge (mirrors `atlas-preview-modal.spec.tsx:44-51` pattern)
- [ ] `tests/main/viewer-asset-feed-ipc.spec.ts` — main-process spec for the new IPC handler (atlas-less synth path)
- [ ] Framework install: NONE — `vitest@^4` + `jsdom@^29` + `@testing-library/react@^16` already installed (package.json:36-50)

The viewer is the first spine-player consumer in the project. Existing test infrastructure (jsdom + RTL + vitest) covers all jsdom-feasible assertions; WebGL output verification is manual-only and lives in `41-HUMAN-UAT.md` per the existing partial-UAT pattern from Phase 21 / Phase 26.1.

## Sources

### Primary (HIGH confidence)
- **npm registry** — `npm view @esotericsoftware/spine-player@4.2.111`, versions list, dependencies, package.json contents (verified 2026-05-15)
- **Vendored `spine-player.js`** at `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/spine-player.js` — same upstream as the npm package, unbundled. Lines 14156-14958 cover the SpinePlayer class verbatim. Lines 5755-5972 cover AssetManager. Lines 6075-6157 cover the Downloader / rawDataURIs resolution.
- **Python reference `viewer.js`** at `/Users/leo/Documents/WORK/CODING/spine-skin-swap/src/spine_skin_swap/gui/viewer/assets/viewer.js` — production-tested integration pattern in PyQt WebView. 412 lines, covers full lifecycle from loadSkeleton through scrub.
- **Existing project files** at `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/modals/AtlasPreviewModal.tsx` (ARIA scaffold), `src/renderer/src/hooks/useFocusTrap.ts` (focus trap), `src/renderer/src/components/AppShell.tsx` (state slot + button + JSX mount pattern), `src/main/index.ts:96-111+571-597` (`app-image://` scheme handler), `src/preload/index.ts:648` (URL bridge), `src/shared/types.ts:740-810` (SkeletonSummary fields), `src/core/synthetic-atlas.ts:134-211` (synthesizeAtlasText)
- **TypeScript .d.ts** (verified via unpkg) — `Player.d.ts` + `index.d.ts` confirm public class + interface shape

### Secondary (MEDIUM confidence)
- **Official Spine Player documentation** at https://esotericsoftware.com/spine-player — config API reference, lifecycle callbacks, success/error semantics. Confirmed alignment with vendored source.
- **Spine Runtimes GitHub issue #2355** — known iOS 15.5 memory disposal issue. Closed, mobile-Safari-specific, does NOT affect Chromium/Electron. Documented as non-blocking for our target platforms.

### Tertiary (LOW confidence)
- None used. All findings cross-verified against either the vendored source (which IS the upstream code) or the npm registry / official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry; dependency chain confirmed; .d.ts types confirmed via unpkg
- Architecture: HIGH — every integration point read in the live project files; scheme handler, preload bridge, modal scaffold, AppShell anchor points all confirmed at exact line numbers
- Pitfalls: HIGH — Pitfall 1 (semver dedup) verified via npm view; Pitfall 2 (error+throw) verified at vendored line 14944-14957; Pitfall 5 (HMR + WebGL) reasoned from Electron + Chromium known behaviors; Pitfall 6 (summary-identity-change) verified via AppShell.tsx mount/unmount flow read

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (Esoteric publishes 4.2.x patches ~weekly; spine-player API surface is stable across 4.2.x. Re-verify the exact-pin choice if delayed beyond 30 days — newer 4.2.x patches may be safe but the spine-core 4.2.111 ↔ spine-player exact-version dedup logic still applies.)
