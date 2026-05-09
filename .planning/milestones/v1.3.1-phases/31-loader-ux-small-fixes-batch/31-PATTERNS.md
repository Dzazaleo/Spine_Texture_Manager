# Phase 31: Loader & UX Small-Fixes Batch — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 11 (target files)
**Analogs found:** 11 / 11 (100% — every locus has a shipping precedent)

This phase is a four-slice UX batch on existing surfaces — no net-new files for sub-features A, B; one optional new file for C (advisory copy block); zero or one new file for D (depending on diagnosis outcome). Every modification has a sibling pattern already shipping in the repo.

---

## File Classification

| Target File | Role | Data Flow | Closest Analog | Match Quality |
|-------------|------|-----------|----------------|---------------|
| `src/main/summary.ts` | service (projection / IPC payload builder) | request-response (build SkeletonSummary) | self — extend existing `buildSummary` (lines 410-479 already do `fs.existsSync`-shaped probes) | exact (in-file extension) |
| `src/shared/types.ts` | model (IPC contract / interface) | data (interface declaration) | self — `SkeletonSummary` interface lines 683-758 (Phase 21 `atlasPath: string \| null` boolean-shape sibling) | exact (in-file extension) |
| `src/main/index.ts` | config (app boot / lifecycle) | event-driven (whenReady → init) | self — `app.whenReady().then(...)` block at lines 519-578 (PWA-style boot sequence with `registerIpcHandlers()`, `protocol.handle`, `applyMenu`, `initAutoUpdater` carve-out) | exact (in-file extension) |
| `src/main/ipc.ts` | controller (IPC handler) | request-response | `ipcMain.handle('skeleton:load', ...)` at line 672 + `ipcMain.handle('atlas:resolve-image-url', ...)` at line 883 (synchronous, no I/O after init — closest fit for cached-boolean read) | exact (role + flow) |
| `src/preload/index.ts` | controller (contextBridge surface) | request-response | `pathToImageUrl: (absolutePath) => ipcRenderer.invoke('atlas:resolve-image-url', ...)` lines 624-625 — simplest one-shot invoke bridge in the file | exact (role + flow) |
| `src/renderer/src/App.tsx` | component (top-level state machine) | event-driven (state transitions) | self — already plumbs `summary={state.summary}` to AppShell at lines 604-610 / 620-627; `isElevated` plumbs alongside via the same shape | exact (in-file extension) |
| `src/renderer/src/components/AppShell.tsx` | component (toolbar + menu shell) | event-driven (UI state) | self — h-8 toolbar buttons at lines 1787-1814 (Atlas Preview / Documentation / Optimize); loader-mode menu at 1735-1773; `loaderModeHealedNotice` inline banner at 1949-1967 | exact (multiple in-file precedents) |
| `src/renderer/src/components/DropZone.tsx` | component (drag-target / empty-state container) | event-driven (DnD) | self — `children: ReactNode` prop at line 63 already accepts state-appropriate body content from App.tsx; advisory replacement is an upstream `children` swap, not an internal change | exact (zero-diff DropZone; advisory composes via prop) |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | component (panel header + cards) | event-driven (UI state — collapse seed) | self — `<header className="mb-4 flex items-center gap-2">` at line 423 (header layout); `useState<Set<string>>(new Set([…]))` at lines 344-346 (collapse seed); h-8 toolbar button class verbatim from AppShell.tsx:1791 | exact (in-file extension) |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | component (table cell tooltips) | event-driven (UI hover) | self — TD-title block at lines 558-577 (SAME shape as AnimationBreakdownPanel.tsx:790-803; sibling-symmetry already enforced) | exact (in-file extension) |
| `src/renderer/src/components/icons/ExtrapolationIcon.tsx` | component (SVG icon primitive) | data (presentational) | `WarningTriangleIcon.tsx` (Phase 26.2 D-06 single-source-of-truth precedent); `DimsBadge.tsx` (Phase 22.1 G-02 React-managed tooltip precedent — reuse for fix-shape c) | exact for shape (a/b); role-match for shape (c) |

---

## Pattern Assignments

### `src/main/summary.ts` (service, request-response — extend `buildSummary`)

**Analog:** self (`src/main/summary.ts` already runs `fs.existsSync`-shaped probes at lines 410-479 for orphan detection). The new `hasAtlasFile` / `hasImagesDir` probe mirrors the same `fs` import + `path.join(skeletonDir, …)` shape.

**Imports already in scope** (lines 30-31, copy verbatim):
```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
```

**Existing fs-probe pattern** (lines 412-413):
```typescript
const skeletonDir = path.dirname(load.skeletonPath);
const imagesDir = path.join(skeletonDir, 'images');
```

**SkeletonSummary return-shape extension** (lines 483-531): the return literal is the only place to add the two new boolean fields. The existing `events: { count, names }` and `atlasPath: load.atlasPath` shape are both Phase-N-additive precedents; copy that style:
```typescript
return {
  skeletonPath: load.skeletonPath,
  atlasPath: load.atlasPath,
  // ... existing fields ...
  // NEW Phase 31 LOAD-05..07:
  hasAtlasFile: <fs-probe-result>,
  hasImagesDir: <fs-probe-result>,
  elapsedMs,
  editorFps: load.editorFps,
};
```

**Layer 3 invariant compliance:** `src/main/summary.ts` is already in `src/main/` (Layer 3 carve-out for fs); the new probe stays here. Do NOT push the probe into `src/core/` (would violate `tests/arch.spec.ts` lines 143-173 fs-import grep).

---

### `src/shared/types.ts` (model, data — extend `SkeletonSummary` interface)

**Analog:** self (`SkeletonSummary` lines 683-758). The Phase 21 `atlasPath: string | null` field at lines 686-694 is the closest precedent — it has the same shape (additive, IPC-safe primitive, JSDoc explaining the renderer use case).

**Existing JSDoc + field pattern** (lines 686-694, copy this shape verbatim):
```typescript
/**
 * Absolute path of the loaded atlas, OR `null` in atlas-less mode (Phase 21
 * D-03). When null, the atlas was synthesized in-memory from per-region
 * PNG headers (no on-disk `.atlas` file). The renderer can use this null
 * signal to suppress UI affordances that only make sense for canonical-mode
 * projects (e.g., AtlasPreviewModal page-strip, hovers showing the .atlas
 * file path).
 */
atlasPath: string | null;
```

**Insertion point:** anywhere inside the interface body (likely between `atlasPath` and `bones`, or appended before `elapsedMs` at line 757). New JSDoc must explain:
1. What the boolean reports (filesystem state probe at summary build time).
2. How the renderer consumes it (gate the disabled state of the source-toggle menu item).
3. That false does NOT mean the project is broken — only that the alternate source is unavailable for swapping.

**IPC safety:** primitive `boolean` is structuredClone-safe. No new helper types.

---

### `src/main/index.ts` (config, event-driven — add elevation probe at boot)

**Analog:** self (`app.whenReady().then(...)` block at lines 519-578). The auto-updater init at line 580+ is the precedent for one-shot async work scheduled at boot.

**Existing boot-sequence pattern** (lines 519-578):
```typescript
app.whenReady().then(() => {
  // Phase 13 — App-level config (cross-platform; no platform branching).
  app.setAboutPanelOptions({ ... });

  // Phase 7 D-133 amendment: protocol handler.
  protocol.handle('app-image', async (request) => { ... });

  registerIpcHandlers();
  createWindow();

  // Phase 8.2 — async-but-fire-and-forget menu paint.
  void applyMenu(currentMenuState, mainWindowRef);

  // Phase 12 Plan 01 Task 5 — auto-update startup wiring.
  // (initAutoUpdater binds electron-updater listeners; one-shot async work)
  // ... lines 580+
});
```

**Where the elevation probe goes:** before `createWindow()` (and before/after `registerIpcHandlers()` — the IPC channel can be registered first; the probe writes to a module-level `let` that the channel reads at invoke time; ordering doesn't matter because the renderer calls the channel only post-mount).

**Platform-branch carve-out precedent** — `src/main/auto-update.ts:123` (carved out of `tests/arch.spec.ts:36-67` via `PLATFORM_CARVE_OUTS` Set):
```typescript
const IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux';
```

**Critical:** PLATFORM-01 needs a similar carve-out. The cleanest path: put `process.platform === 'win32'` branching ENTIRELY inside `src/main/auto-update.ts` (existing carve-out), or add a NEW carve-out file (e.g., `src/main/elevation.ts`) and append it to the `PLATFORM_CARVE_OUTS` Set in `tests/arch.spec.ts:52-54`. Planner picks; the second is cleaner separation.

**Module-level cache shape** (mirror `pendingUpdateInfo` at `auto-update.ts:135`):
```typescript
let isElevated = false; // module-level cache; written once at boot, read at IPC invoke time
```

---

### `src/main/ipc.ts` (controller, request-response — register `'platform:isElevated'`)

**Analog:** `ipcMain.handle('atlas:resolve-image-url', (_evt, absolutePath: unknown): string => { ... })` at line 883 — the closest cached-string-or-cached-boolean read pattern (no I/O at invoke time).

**Channel registration shape** (line 672, simplest invoke channel — copy verbatim shape):
```typescript
ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
```

**Compact synchronous variant** (line 883 — closer to what platform:isElevated should look like; cached boolean read, no I/O):
```typescript
ipcMain.handle('atlas:resolve-image-url', (_evt, absolutePath: unknown): string => {
  // T-XX-IPC trust-boundary validation
  // ... return cached or computed value ...
});
```

**Phase 31 channel shape:**
```typescript
ipcMain.handle('platform:isElevated', () => isElevated);
// — module-level boolean populated at app.whenReady() (see src/main/index.ts pattern above).
// No payload, no validation, no async. Sync invoke is fine because the value is module-level cached.
```

**Insertion point:** anywhere inside `registerIpcHandlers()` (lines 671-987). Group near `'atlas:resolve-image-url'` (line 883) since both are simple cached-data reads.

---

### `src/preload/index.ts` (controller, request-response — bridge `window.api.isElevated`)

**Analog:** `pathToImageUrl: (absolutePath: string): Promise<string> => ipcRenderer.invoke('atlas:resolve-image-url', absolutePath)` at lines 624-625 — the simplest one-shot invoke bridge (no listener identity scaffolding).

**Bridge pattern** (lines 624-625, copy verbatim shape):
```typescript
pathToImageUrl: (absolutePath: string): Promise<string> =>
  ipcRenderer.invoke('atlas:resolve-image-url', absolutePath),
```

**Phase 31 bridge shape:**
```typescript
isElevated: (): Promise<boolean> => ipcRenderer.invoke('platform:isElevated'),
```

**Type signature:** add `isElevated: () => Promise<boolean>` to the `Api` interface in `src/shared/types.ts` (the Api interface is referenced via `import type { Api } from '../shared/types.js';` at preload line 48).

**Why one-shot invoke (not subscription):** elevation is fixed at process start (Windows can't change a running process's token mid-life — see CONTEXT.md `<deferred>` line 192 "Re-probe elevation on window focus"). No `Pitfall 9 listener-identity` scaffolding needed.

---

### `src/renderer/src/App.tsx` (component, event-driven — plumb isElevated)

**Analog:** self — `summary={state.summary}` already plumbs through to AppShell at lines 604-610 and 620-627. `isElevated` plumbs the same way: read once at App.tsx mount via `window.api.isElevated()`, store in `useState<boolean>(false)`, pass as prop to AppShell.

**Existing prop-passing pattern** (lines 604-610):
```typescript
<AppShell
  summary={state.summary}
  samplingHz={120}
  onBeforeDropRef={beforeDropRef}
  appShellMenuRef={appShellMenuRef}
  dirtyCheckRef={dirtyCheckRef}
/>
```

**One-shot read pattern at mount** (precedent: `requestPendingUpdate` at preload line 511-516, App.tsx late-mount payload re-delivery): `useEffect` with empty dep array, fires `window.api.isElevated()` once, setState updates the closure.

**Phase 31 wiring shape:**
```typescript
const [isElevated, setIsElevated] = useState(false);
useEffect(() => {
  void window.api.isElevated().then(setIsElevated);
}, []);
// ... pass `isElevated={isElevated}` to AppShell (and through to DropZone) ...
```

**Idle-AppState surface:** the DropZone is rendered when AppState is `idle` (no project loaded). Look for the App.tsx `state.status === 'idle'` branch (around `state.status === 'loaded'` at line 599 / `'projectLoaded'` at line 612 — the idle branch sits adjacent and renders DropZone with `children` for the empty-state). The `children` swap is the cleanest surface for the advisory replacement.

---

### `src/renderer/src/components/AppShell.tsx` (component, event-driven — disabled menu item + h-8 buttons)

**Analog (disabled menu item):** self — the existing menu-item button at lines 1761-1770 is the precedent. Add `disabled` + `title` attributes conditionally.

**Existing menu-item pattern** (lines 1761-1770, modify in place):
```tsx
<button
  type="button"
  className="w-full text-left px-3 py-2 text-xs text-fg hover:bg-surface transition-colors cursor-pointer"
  onClick={() => {
    setLoaderMode(effectiveSummary.atlasPath === null ? 'auto' : 'atlas-less');
    setLoaderMenuOpen(false);
  }}
>
  {effectiveSummary.atlasPath === null ? 'Use Atlas as Source' : 'Use Images Folder as Source'}
</button>
```

**Phase 31 disabled-state extension** (UI-SPEC § sub-feature A interaction contract):
- Compute `altSourceMissing` from `effectiveSummary.atlasPath === null ? !summary.hasAtlasFile : !summary.hasImagesDir`.
- Add `disabled={altSourceMissing}` to the `<button>`.
- Add `title={altSourceMissing ? (effectiveSummary.atlasPath === null ? "No .atlas file found in this project's folder" : "No images/ folder found in this project's folder") : undefined}` (verbatim copy from UI-SPEC).
- Append disabled-state Tailwind variants to className: `disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:text-fg-muted`.
- Add `aria-disabled={altSourceMissing}` for AT consistency.

**Analog (h-8 toolbar button class — verbatim for Phase 31 bulk buttons):** `AppShell.tsx:1791` (Atlas Preview button). UI-SPEC locks this exact string for the bulk Expand/Collapse buttons in AnimationBreakdownPanel.

**Verbatim h-8 button class string** (line 1791, Pitfall 8 discipline — DO NOT factor into shared variable, DO NOT template-string interpolate):
```tsx
className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
```

**Inline-banner pattern (NOT used in Phase 31, kept as reference)** — `loaderModeHealedNotice` at lines 1949-1967:
```tsx
{loaderModeHealedNotice && (
  <div
    role="status"
    className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
  >
    <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
    <span className="flex-1">
      Project file had an inconsistent loader-mode setting and was
      opened in atlas-source mode. Save again to fix the file on disk.
    </span>
    <button type="button" onClick={() => setLoaderModeHealedNotice(false)} ...>Dismiss</button>
  </div>
)}
```
Not used directly; PLATFORM-01 places its advisory inside DropZone's `children` (App.tsx surface), not as a status banner. UI-SPEC explicitly chose DropZone-internal replacement (UI-SPEC § sub-feature C interaction contract).

---

### `src/renderer/src/components/DropZone.tsx` (component, event-driven — zero internal change)

**Analog:** self — the `children: ReactNode` prop at line 63 already accepts state-appropriate body content from the parent. Phase 31 makes ZERO internal changes to DropZone; the advisory copy is composed by App.tsx (or AppShell) via the existing `children` prop.

**Existing render shape** (lines 165-182, do NOT modify):
```tsx
<div
  onDragEnter={handleDragEnter}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={clsx(
    'w-full min-h-screen flex items-center justify-center',
    'bg-surface text-fg',
    'focus-visible:outline-2 focus-visible:outline-accent',
    isDragOver && 'ring-2 ring-accent bg-accent/5',
  )}
>
  {children}
</div>
```

**Phase 31 contract:** keep the `min-h-screen flex items-center justify-center` container verbatim (UI-SPEC Layout Anchors locks it — the `min-h-screen` is load-bearing per memory `project_layout_fragility_root_min_h_screen.md`).

**Optional internal extension (planner discretion per UI-SPEC):** if the DropZone needs to no-op the drop handlers when `isElevated`, add an `isElevated` prop and short-circuit `handleDragEnter` / `handleDragOver` / `handleDrop` early. The class-string `clsx` block can suppress the `ring-2 ring-accent bg-accent/5` when `isElevated`.

**Suggested extension shape (planner discretion):**
```tsx
export interface DropZoneProps {
  // ... existing props ...
  /** Phase 31 PLATFORM-01: when true on Windows, disables DnD handlers and suppresses drag-over ring. */
  isElevated?: boolean;
}
```

**Advisory body composition (in App.tsx idle branch):** the `children` prop passed to DropZone is replaced based on `isElevated`:
```tsx
<DropZone {...props} isElevated={isElevated}>
  {isElevated && isWin32 ? (
    <div role="status" className="max-w-md text-center text-sm text-fg-muted">
      <p>
        Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges.
      </p>
    </div>
  ) : (
    <ExistingEmptyStateBody />
  )}
</DropZone>
```

**Note on `isWin32`:** the renderer cannot read `process.platform` (Layer 3). Instead, `isElevated` is THE signal — the main-side handler short-circuits to `false` on non-Windows (CONTEXT.md C-D-05), so `isElevated === true` is sufficient.

---

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (component, event-driven — collapse seed + bulk buttons + TD title)

**Analog (collapse seed flip):** self — `useState<Set<string>>(new Set([…]))` at lines 344-346.

**Existing seed shape** (lines 344-346, modify in place — flip `['setup-pose']` → `[]`):
```typescript
const [userExpanded, setUserExpanded] = useState<Set<string>>(
  new Set(['setup-pose']),
);
```

**Phase 31 modification (PANEL-08):**
```typescript
const [userExpanded, setUserExpanded] = useState<Set<string>>(
  new Set(),
);
```

**Search auto-expand union (preserve VERBATIM, lines 376-382):**
```typescript
const effectiveExpanded = useMemo(() => {
  if (query === '') return userExpanded;
  const cardsWithMatches = filteredCards
    .filter((c) => c.rows.length > 0)
    .map((c) => c.cardId);
  return new Set<string>([...userExpanded, ...cardsWithMatches]);
}, [query, userExpanded, filteredCards]);
```
This block is preserved unchanged. PANEL-08 only changes the seed.

**Analog (bulk buttons + header layout):** self — the existing `<header className="mb-4 flex items-center gap-2">` at line 423 is the insertion site. The `{N} animations` count span at lines 442-444 currently has `ml-auto`; UI-SPEC § sub-feature B header layout contract requires wrapping `[count, Expand all, Collapse all]` in a single `<div className="ml-auto flex items-center gap-2">`.

**Existing header pattern** (lines 423-445):
```tsx
<header className="mb-4 flex items-center gap-2">
  <span className="inline-flex items-center justify-center w-5 h-5 text-fg flex-shrink-0" aria-hidden="true">
    <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" ... className="w-5 h-5" aria-hidden="true">
      <path d="M3 17 V10 M8 17 V6 M13 17 V12 M18 17 V4" />
    </svg>
  </span>
  <h2 className="text-sm font-semibold text-fg">Animation Breakdown</h2>
  <span className="text-fg-muted font-mono text-xs font-normal ml-auto">
    {filteredCards.length} animations
  </span>
</header>
```

**Phase 31 modified shape (bulk buttons added in right cluster):**
```tsx
<header className="mb-4 flex items-center gap-2">
  <span ...><svg ...></svg></span>
  <h2 className="text-sm font-semibold text-fg">Animation Breakdown</h2>
  <div className="ml-auto flex items-center gap-2">
    <span className="text-fg-muted font-mono text-xs font-normal">
      {filteredCards.length} animations
    </span>
    {summary.animations.count > 0 && (
      <>
        <button
          type="button"
          aria-label="Expand all animation cards"
          onClick={() => setUserExpanded(new Set(allCardIds))}
          className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
        >
          Expand all
        </button>
        <button
          type="button"
          aria-label="Collapse all animation cards"
          onClick={() => setUserExpanded(new Set())}
          className="border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
        >
          Collapse all
        </button>
      </>
    )}
  </div>
</header>
```

**Note (B-D-04 absolute, not filter-scoped):** "Expand all" sets `userExpanded` to ALL card IDs (not filtered cards). Compute `allCardIds` from `summary.animationBreakdown.map(c => c.cardId)`, NOT from `filteredCards` — this preserves the absolute state across search-clear.

**Analog (TD title + ExtrapolationIcon — TOOLTIP-01 conflict site #2, lines 790-803):**
```tsx
title={
  row.override !== undefined
    ? `Override set • World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)} • double-click to edit`
    : `World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)} • double-click to override`
}
>
  <span className="inline-flex items-center justify-end gap-1">
    <span>{`${row.peakDisplayW}×${row.peakDisplayH}`}</span>
    {row.peakScale > 1 && (
      <ExtrapolationIcon
        className="w-3.5 h-3.5 inline-block text-white"
        title={`Spine rig peak: ${row.peakScale.toFixed(2)}× source — export capped at canonical`}
      />
    )}
    {row.override !== undefined && (
      <PencilIcon className="w-3.5 h-3.5 inline-block text-white" />
    )}
  </span>
</td>
```

**Phase 31 modification (TOOLTIP-01 fix-shape determined by D-D-01 diagnostic spike):**
- **Fix-shape (a):** suppress the `<td title>` when `row.peakScale > 1` (move text to aria-label or separate cell).
- **Fix-shape (b):** wrap `<ExtrapolationIcon>` in a `<span title="…">` carrying the icon's tooltip text (gives the hover-target a title attribute at every ancestor depth).
- **Fix-shape (c):** port `ExtrapolationIcon`'s tooltip to the React-managed primitive from `DimsBadge.tsx` (see ExtrapolationIcon section below).

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (component, event-driven — TD title sibling site)

**Analog:** AnimationBreakdownPanel.tsx:790-803 (sibling-symmetry — Phase 22.1 D-04). The two panels share the SAME TD-title + ExtrapolationIcon block byte-for-byte.

**Existing TD-title pattern** (lines 558-577 — IDENTICAL TO ABP block above):
```tsx
<td
  className={clsx(...)}
  onDoubleClick={() => onOpenOverrideDialog(row, selectedKeys)}
  title={
    row.override !== undefined
      ? `Override set • World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)} • double-click to edit`
      : `World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)} • double-click to override`
  }
>
  <span className="inline-flex items-center justify-end gap-1">
    <span>{`${row.peakDisplayW}×${row.peakDisplayH}`}</span>
    {row.peakScale > 1 && (
      <ExtrapolationIcon
        className="w-3.5 h-3.5 inline-block text-white"
        title={`Spine rig peak: ${row.peakScale.toFixed(2)}× source — export capped at canonical`}
      />
    )}
    {row.override !== undefined && <PencilIcon className="w-3.5 h-3.5 inline-block text-white" />}
  </span>
</td>
```

**Phase 31 modification (TOOLTIP-01 D-D-04 sibling-symmetry mandate):** WHATEVER fix-shape lands MUST be applied to BOTH panels in lock-step (the smaller-diff path is fix-shape (c) — port the change inside `ExtrapolationIcon.tsx` so both call sites inherit automatically without further edits). For fix-shape (a) or (b), the TD-title + wrapper-span change must be applied to both panels manually.

---

### `src/renderer/src/components/icons/ExtrapolationIcon.tsx` (component, presentational — comment update + possible tooltip-shape change)

**Analog (sibling-symmetry single-source-of-truth precedent):** `WarningTriangleIcon.tsx` (Phase 26.2 D-06). The whole-file shape is the gold standard for shared icon components.

**WarningTriangleIcon full pattern** (lines 1-43 — copy this discipline for any tooltip-shape changes to ExtrapolationIcon):
```tsx
/**
 * Phase 26.2 D-06/D-07 — Canonical stroke-style warning triangle icon.
 *
 * Single source of truth for the warning-triangle SVG used in:
 *   - MissingAttachmentsPanel header (alert bar)
 *   - UnusedAssetsPanel header (alert bar)
 *   - GlobalMaxRenderPanel missing-row cell (table)
 *   - AnimationBreakdownPanel missing-row cell (table)
 * ...
 */
export interface WarningTriangleIconProps {
  className?: string;
}
export function WarningTriangleIcon({ className }: WarningTriangleIconProps) {
  return (
    <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" fill="none"
         className={className} aria-hidden="true">
      <path d="M10 3 L17 16 H3 Z" />
      <path d="M10 8 V12" />
      <circle cx="10" cy="14.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
```

**Existing ExtrapolationIcon pattern** (full file, 1-53):
```tsx
/**
 * Extrapolation icon — marks the Peak W×H cell when the Spine rig demands
 * resolution above canonical (`peakScale > 1`). [...]
 *
 * Tooltip: the `title` prop renders as an SVG `<title>` child element
 * (not a wrapper-span title attribute) — this is the canonical SVG
 * tooltip approach and reliably wins over the parent cell's HTML title
 * attribute when the cursor is over the icon. [...]
 */
export interface ExtrapolationIconProps {
  className?: string;
  title?: string;
}
export function ExtrapolationIcon({ className, title }: ExtrapolationIconProps) {
  return (
    <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" fill="none"
         className={className}
         role={title !== undefined ? 'img' : undefined}
         aria-label={title}
         aria-hidden={title === undefined ? true : undefined}>
      {title !== undefined && <title>{title}</title>}
      <path d="M10 16 L10 4" />
      <path d="M5 9 L10 4 L15 9" />
    </svg>
  );
}
```

**MANDATORY change (regardless of fix-shape):** the doc-comment at lines 8-22 currently claims "SVG `<title>` reliably wins" — the regression invalidates this claim. Update the comment to accurately describe the new mechanism (whichever fix-shape lands).

**Analog for fix-shape (c) — React-managed tooltip primitive:** `DimsBadge.tsx` (Phase 22.1 G-02). Verbatim primitive shape:

**DimsBadge tooltip primitive pattern** (lines 42-110):
```tsx
const hostRef = useRef<HTMLDivElement>(null);
const [tooltipPos, setTooltipPos] = useState<{ top: number; right: number } | null>(null);

function handleMouseEnter() {
  const rect = hostRef.current?.getBoundingClientRect();
  if (rect) {
    setTooltipPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }
}

return (
  <div
    ref={hostRef}
    className="inline-block"
    onMouseEnter={handleMouseEnter}
    onMouseLeave={() => setTooltipPos(null)}
  >
    <span aria-label={ariaLabel} aria-describedby={tooltipPos !== null ? tooltipId : undefined} className="...">
      {/* SVG icon */}
    </span>
    {tooltipPos !== null &&
      createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          style={{ position: 'fixed', top: tooltipPos.top, right: tooltipPos.right }}
          className="z-[9999] bg-panel border border-border rounded-md p-2 text-xs font-mono text-fg whitespace-pre min-w-[260px] shadow-lg"
        >
          {tooltipText}
        </div>,
        document.body,
      )}
  </div>
);
```

**Phase 31 fix-shape (c) extension (if diagnosis points there):** wrap the existing `<svg>` body of ExtrapolationIcon in a `<div ref={hostRef} onMouseEnter={...} onMouseLeave={...}>`, render the tooltip via `createPortal` with `position:fixed`. Drop the SVG `<title>` child (the React-managed tooltip replaces it). Keep `role="img"` + `aria-label` for AT.

**Native `title=` precedent (fix-shape b OR sub-feature A):** `OptimizeDialog.tsx:457`:
```tsx
disabled={state === 'in-progress'}
title="Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate."
className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
```
Bare HTML `title=` attribute on a disabled-state interactive element. Hover-reliability is good because the disabled element still receives mouseenter (the input is `disabled` but not `pointer-events: none`). Same shape applies to the disabled menu-item in sub-feature A.

---

## Shared Patterns

### Pattern S-01: Native HTML `title=` attribute (sub-feature A + D fix-shapes a/b)

**Source:** `src/renderer/src/modals/OptimizeDialog.tsx:457` (Phase 30 buffer-tooltip precedent).

**Apply to:**
- Sub-feature A: disabled source-toggle menu item (AppShell.tsx:1761-1770) gets a `title=` attribute when `altSourceMissing`.
- Sub-feature D fix-shape (b): wrap `<ExtrapolationIcon>` in `<span title="…">` for both panel call sites.

**Excerpt (verbatim):**
```tsx
title="<verbatim copy from REQUIREMENTS.md / UI-SPEC § Copywriting>"
```

**Why native `title=` works here (not virtualized):** the disabled menu-item and the ExtrapolationIcon-wrapper are not inside a virtualized container, so the once-per-session DimsBadge native-title bug does NOT apply (per Phase 22.1 G-02 root-cause). Native `title=` is correct for this surface.

---

### Pattern S-02: h-8 toolbar button class string (sub-feature B bulk buttons)

**Source:** `src/renderer/src/components/AppShell.tsx:1791` (Atlas Preview), 1803 (Documentation), 1811 (Optimize Assets — primary CTA variant; NOT used here).

**Apply to:** Sub-feature B Expand all / Collapse all buttons in AnimationBreakdownPanel header. Inherit the secondary/border-only variant verbatim.

**Excerpt (verbatim — Pitfall 8 literal-class discipline; DO NOT factor):**
```
border border-border rounded-md px-3 h-8 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0
```

**Why verbatim:** Tailwind v4's source scanner only sees literal class strings. Template-string interpolation (`` `border border-${color}` ``) is invisible to the scanner. Refactoring to a shared variable also breaks the scanner. Copy-paste the literal string at every use site — 3+ sites already exist in AppShell.tsx, so this is established discipline.

---

### Pattern S-03: One-shot IPC invoke for cached boolean (sub-feature C platform:isElevated)

**Source:** `src/preload/index.ts:624-625` (`pathToImageUrl`); `src/main/ipc.ts:883` (`atlas:resolve-image-url` handle).

**Apply to:** `'platform:isElevated'` channel (renderer reads cached boolean once at App.tsx mount; main returns module-level cached value populated at app.whenReady).

**Renderer-side excerpt (preload):**
```typescript
isElevated: (): Promise<boolean> => ipcRenderer.invoke('platform:isElevated'),
```

**Main-side excerpt (ipc.ts):**
```typescript
ipcMain.handle('platform:isElevated', () => isElevated);
// `isElevated` is a module-level let-binding populated at app.whenReady() in src/main/index.ts.
```

**Type signature (shared/types.ts Api interface):**
```typescript
interface Api {
  // ... existing methods ...
  isElevated(): Promise<boolean>;
}
```

---

### Pattern S-04: Sibling-symmetry single-source-of-truth icon (sub-feature D)

**Source:** `src/renderer/src/components/icons/WarningTriangleIcon.tsx` (Phase 26.2 D-06 — used in 4 sites, ALL inherit changes from one file).

**Apply to:** Sub-feature D — whichever fix-shape lands MUST be implemented in `src/renderer/src/components/icons/ExtrapolationIcon.tsx` (or via a new shared wrapper consumed by both panels) so the two panel call sites inherit the fix automatically.

**Anti-pattern (from Phase 19 / Phase 22.1 fix history):** patching `GlobalMaxRenderPanel.tsx:558-577` and `AnimationBreakdownPanel.tsx:790-803` independently would re-introduce a sibling-symmetry violation. The two TD-title blocks are byte-identical today; any divergence between them is a regression to be caught in code review.

---

### Pattern S-05: Layer 3 carve-out for `process.platform` (sub-feature C)

**Source:** `src/main/auto-update.ts:123` carved out of `tests/arch.spec.ts:36-67` via:
```typescript
const PLATFORM_CARVE_OUTS = new Set<string>([
  'src/main/auto-update.ts',
]);
```

**Apply to:** Sub-feature C elevation probe. Either:
- (a) Co-locate elevation logic in `src/main/auto-update.ts` (already carved out), OR
- (b) Add a NEW dedicated file (e.g. `src/main/elevation.ts`) and append it to the `PLATFORM_CARVE_OUTS` Set in `tests/arch.spec.ts:52-54`.

**Recommended:** option (b) — cleaner separation, single-responsibility file. Update both `src/main/elevation.ts` (NEW) and `tests/arch.spec.ts:52-54` (extend the Set) in lock-step.

**Trust boundary:** `child_process.exec('net session', ...)` runs INSIDE the carved-out file with `process.platform === 'win32'` short-circuit. Renderer never sees `process.platform`; only the cached boolean traverses IPC.

---

### Pattern S-06: Module-level cache populated at app.whenReady (sub-feature C)

**Source:** `src/main/auto-update.ts:135` (`pendingUpdateInfo`); `src/main/auto-update.ts:127` (`initialized`).

**Apply to:** `isElevated` boolean populated once at app boot.

**Excerpt:**
```typescript
// src/main/elevation.ts (NEW) OR inside src/main/index.ts:
let isElevated = false; // module-level cache; safe default

export async function probeElevation(): Promise<void> {
  if (process.platform !== 'win32') return; // C-D-05 — non-Windows short-circuit
  try {
    const { exec } = await import('node:child_process');
    await new Promise<void>((resolve) => {
      exec('net session', (err) => {
        isElevated = err === null; // exit code 0 → elevated
        resolve();
      });
    });
  } catch {
    isElevated = false; // safe default on any error (C-D-01)
  }
}

export function getIsElevated(): boolean {
  return isElevated;
}
```

**Wired in `src/main/index.ts` whenReady block:**
```typescript
app.whenReady().then(async () => {
  // ... existing setup ...
  await probeElevation(); // ~50-100ms one-shot; safe to await before window
  registerIpcHandlers();
  createWindow();
  // ... rest unchanged ...
});
```

---

### Pattern S-07: F1.2 sibling-discovery rule (sub-feature A — `.atlas` probe)

**Source:** `src/core/loader.ts:261-264`:
```typescript
const siblingAtlasPath = path.join(
  path.dirname(skeletonPath),
  path.basename(skeletonPath, path.extname(skeletonPath)) + '.atlas',
);
```

**Apply to:** `summary.ts` `hasAtlasFile` probe. Mirror the SAME `<basename>.atlas` precedence — look for the basename-matched .atlas first, optionally fall back to any `*.atlas` in the dir (CONTEXT.md A-D-01 leaves the fallback as a planner detail).

**Recommended probe shape (planner finalizes):**
```typescript
// In src/main/summary.ts buildSummary, after the existing skeletonDir/imagesDir:
const skeletonDir = path.dirname(load.skeletonPath);
const basename = path.basename(load.skeletonPath, path.extname(load.skeletonPath));
const siblingAtlasPath = path.join(skeletonDir, basename + '.atlas');
const hasAtlasFile = fs.existsSync(siblingAtlasPath);
const hasImagesDir = fs.existsSync(path.join(skeletonDir, 'images'));
```

**Note on fallback:** CONTEXT.md A-D-01 mentions "any `*.atlas` in the same dir as fallback". If implemented, use `fs.readdirSync(skeletonDir).some(f => f.toLowerCase().endsWith('.atlas'))`. If `<basename>.atlas` is sufficient (matches the loader's actual logic byte-for-byte), the fallback is unnecessary. Planner picks based on whether the additional probe matters for the disabled-state UX.

---

## No Analog Found

None. Every Phase 31 file modification has a concrete shipping precedent in the codebase:

| File | Why precedent exists |
|------|----------------------|
| All summary.ts changes | `fs.existsSync` + `path.join` already used at lines 412-477 for orphan detection |
| All types.ts changes | `atlasPath: string \| null` (lines 686-694) is the additive-boolean-shape sibling |
| All AppShell changes | h-8 buttons (3 sites), loader-mode menu, inline banner — all existing |
| All AnimationBreakdownPanel changes | Header layout + useState seed + TD-title — all in-file |
| All ExtrapolationIcon changes | WarningTriangleIcon + DimsBadge cover all three fix-shapes |
| `src/main/index.ts` boot extension | auto-update startup wiring at line 580+ is the precedent |
| IPC + preload bridges | `atlas:resolve-image-url` is the simplest shipping invoke channel |
| App.tsx isElevated state | `summary` plumbing already follows this exact shape |
| Layer 3 carve-out | `auto-update.ts` is already carved out (template for elevation.ts) |

---

## Metadata

**Analog search scope:** `src/main/`, `src/preload/`, `src/renderer/src/`, `src/shared/`, `src/core/loader.ts`, `tests/arch.spec.ts`.

**Files scanned:**
- `src/core/loader.ts` (sibling-atlas discovery rule, F1.2 path)
- `src/main/summary.ts` (full file — buildSummary projection)
- `src/main/ipc.ts` (channel registrations + handler shapes)
- `src/main/index.ts` (app.whenReady boot block)
- `src/main/auto-update.ts` (Layer 3 carve-out precedent + module-level cache pattern)
- `src/preload/index.ts` (Api bridge pattern; one-shot invoke shape)
- `src/shared/types.ts` (SkeletonSummary interface)
- `src/renderer/src/App.tsx` (top-level state plumbing)
- `src/renderer/src/components/AppShell.tsx` (h-8 button class, menu, inline banner)
- `src/renderer/src/components/DropZone.tsx` (full file)
- `src/renderer/src/components/DimsBadge.tsx` (full file — React-managed tooltip primitive)
- `src/renderer/src/components/icons/ExtrapolationIcon.tsx` (full file)
- `src/renderer/src/components/icons/WarningTriangleIcon.tsx` (full file — sibling-symmetry precedent)
- `src/renderer/src/modals/OptimizeDialog.tsx` (native title= precedent at line 457)
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (header, seed, TD-title)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (TD-title sibling site)
- `tests/arch.spec.ts` (Layer 3 invariant — PLATFORM_CARVE_OUTS Set)

**Pattern extraction date:** 2026-05-08

---

*Phase: 31-loader-ux-small-fixes-batch*
*Pattern map written: 2026-05-08*
