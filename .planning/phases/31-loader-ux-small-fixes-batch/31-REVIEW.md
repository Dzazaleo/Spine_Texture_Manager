---
phase: 31-loader-ux-small-fixes-batch
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/main/elevation.ts
  - src/main/index.ts
  - src/main/ipc.ts
  - src/main/summary.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/components/DropZone.tsx
  - src/renderer/src/components/icons/ExtrapolationIcon.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - src/shared/types.ts
  - tests/arch.spec.ts
  - tests/core/documentation.spec.ts
  - tests/main/elevation.spec.ts
  - tests/main/summary.spec.ts
  - tests/renderer/anim-breakdown-virtualization.spec.tsx
  - tests/renderer/app-elevation.spec.tsx
  - tests/renderer/dims-badge-tooltip.spec.tsx
  - tests/renderer/dropzone-elevated.spec.tsx
  - tests/renderer/extrapolation-icon-tooltip.spec.tsx
  - tests/renderer/loader-mode-toggle-disabled.spec.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18 (source + tests)
**Status:** issues_found

## Summary

Phase 31 ships four small loader-UX fixes (LOAD-05/06/07 source-toggle disabled state; PLATFORM-01 Windows-admin DnD advisory; TOOLTIP-01 ExtrapolationIcon tooltip primitive; PANEL-08..11 collapse-defaults + bulk Expand/Collapse). The work is well-scoped, well-commented, and well-tested.

No BLOCKER issues found. Source files compile cleanly, IPC envelope shapes are preserved, and the Layer-3 platform carve-out for `src/main/elevation.ts` is correctly registered in `tests/arch.spec.ts`. The new `hasAtlasFile`/`hasImagesDir` fields on `SkeletonSummary` are propagated through `summary.ts` → preload → renderer with structured-clone-safe primitives.

The findings below are quality and robustness defects — none of them risk data loss or shipping a broken UX, but several should be addressed before the next major surface change touches these files.

## Warnings

### WR-01: Unhandled promise rejection from `window.api.isElevated()` in App.tsx

**File:** `src/renderer/src/App.tsx:122-124`

**Issue:** The mount-time `isElevated` IPC call is fire-and-forget with `void` and `.then(setIsElevated)`, but no `.catch` handler. If the IPC channel fails to register (e.g., preload wiring regression in a future phase, or a renderer-side mock omitting `isElevated` — which is exactly the failure mode the existing `app-elevation.spec.tsx` works around with a full stub list), the promise rejects and the rejection is unhandled. In production this surfaces as `[Unhandled Promise Rejection]` in the renderer console; in test runs it can mark unrelated tests as flaky depending on the runner's unhandled-rejection policy.

```ts
useEffect(() => {
  void window.api.isElevated().then(setIsElevated);
}, []);
```

**Fix:** Add a `.catch` that defaults to `false` (the safe default — non-elevated path keeps DnD wired):

```ts
useEffect(() => {
  void window.api.isElevated()
    .then(setIsElevated)
    .catch(() => setIsElevated(false));
}, []);
```

Optional: add a `cancelled` guard to suppress `setIsElevated` after unmount (App.tsx is the always-mounted root in production but unmounts cleanly between test cases).

### WR-02: `summary.hasAtlasFile` / `hasImagesDir` derivation does not handle path edge cases

**File:** `src/main/summary.ts:483-493`

**Issue:** The new filesystem probe uses `path.basename(load.skeletonPath, path.extname(load.skeletonPath))` to strip the `.json` suffix and `path.join(projectDir, 'images')` to find the sibling images folder. Two edge cases are not handled:

1. **Symlinks:** `fs.existsSync` follows symlinks. If `images` is a symlink to a file (or to a directory outside the project), `hasImagesDir` returns `true` but the renderer's enable-toggle action will then fail at the loader. Same applies to `<basename>.atlas` being a symlink to a directory.
2. **Case-insensitive filesystems (macOS HFS+ / Windows NTFS default):** A file `IMAGES/` will satisfy `hasImagesDir = true` on the case-insensitive volume but the loader's atlas-less code path may match a different casing. This is consistent with the loader's own existing case-handling, but the comment claim "Mirrors src/core/loader.ts F1.2 sibling-atlas discovery rule" is only true if loader.ts uses the same `existsSync` contract.

**Fix:** Either narrow the probe to `fs.statSync(...).isDirectory()` / `isFile()` to reject symlink-to-wrong-kind cases, or document explicitly that the probe is a presence-only check (false-positive tolerant) and that the loader is the source of truth on actual usability:

```ts
let hasAtlasFile = false;
try {
  hasAtlasFile = fs.statSync(siblingAtlasPath).isFile();
} catch { /* ENOENT */ }

let hasImagesDir = false;
try {
  hasImagesDir = fs.statSync(path.join(projectDir, 'images')).isDirectory();
} catch { /* ENOENT */ }
```

The current `existsSync` is permissive enough to false-positive both cases; tightening it to a stat-based check matches the strictness the rest of the loader applies and reduces the risk of the disabled-state UI showing "available" when the loader will reject the swap.

### WR-03: ExtrapolationIcon tooltip position becomes stale on window resize / scroll mid-hover

**File:** `src/renderer/src/components/icons/ExtrapolationIcon.tsx:64-77`

**Issue:** `tooltipPos` is captured **once** on `onMouseEnter` via `getBoundingClientRect()` and stored as `position: fixed; top/right`. If the user resizes the window or scrolls the underlying virtualized list while hovering, the tooltip stays anchored to its initial viewport position — visually disconnecting from the icon. The icon's host span itself may scroll out from under the tooltip while the tooltip floats in place.

This is the same shape as the issue the documented `DimsBadge` primitive presumably also has (the comment claims sibling-symmetry with that primitive). But "DimsBadge does it the same way" is not a defense — it's a sibling regression risk.

```tsx
function handleMouseEnter() {
  if (title === undefined) return;
  const rect = hostRef.current?.getBoundingClientRect();
  if (rect) {
    setTooltipPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }
}
```

**Fix:** Either (a) recompute on `scroll` / `resize` while the tooltip is open, or (b) document the limitation and accept it as a UX trade-off (tooltips are transient hover-only). Lightweight option:

```tsx
useEffect(() => {
  if (tooltipPos === null) return;
  const recompute = () => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    } else {
      setTooltipPos(null);
    }
  };
  window.addEventListener('scroll', recompute, true);
  window.addEventListener('resize', recompute);
  return () => {
    window.removeEventListener('scroll', recompute, true);
    window.removeEventListener('resize', recompute);
  };
}, [tooltipPos]);
```

Alternatively, since this is a hover-only transient surface, the team may explicitly choose to accept the stale-position behavior — but in that case the doc-comment should call it out so the next maintainer doesn't mistake it for a bug.

### WR-04: `B-D-04` bulk-button derivation does not match the test's documented contract

**File:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:368-376` (allCardIds derivation) + `tests/renderer/anim-breakdown-virtualization.spec.tsx:686-718` (B6 test)

**Issue:** The new `allCardIds` is derived from `summary.animationBreakdown` (absolute) per the comment `B-D-04 — absolute card-id set for bulk Expand all. Derived from summary.animationBreakdown (NOT filteredCards) so bulk actions are absolute, not filter-scoped`. This is correct for "Expand all".

However, "Collapse all" uses `setUserExpanded(new Set())` directly. With the search-union behavior (`autoExpandedDuringSearch` derived elsewhere), Collapse all does NOT clear the in-memory userExpanded — it sets it to empty, but the matched-card auto-expansion overrides that during active search. The test B6 itself documents this expected behavior:

```text
// bulk Collapse all does not remove matched cards while search is still active.
```

This is intentional by design, but it creates a UX surprise: the user clicks "Collapse all" and the matched card stays open. The Bulk-Collapse button gives no visual hint that its effect is partial. From a code-correctness view this is a quality concern, not a bug — but the deferred state interaction is fragile and easy to break.

**Fix:** Either:
- Add an `aria-describedby` pointing to a screen-reader-only note explaining "Collapse all does not affect cards opened by an active search filter", or
- Change `allCardIds` derivation for Collapse to also clear the search query (more invasive — likely a future-phase decision), or
- Document the policy in the button's title attribute so power users see "Collapses cards. Cards matching active search remain visible."

At minimum, capture the deferred behavior in `deferred-items.md` so it isn't forgotten.

## Info

### IN-01: `useId` hook called even when `title` is undefined in ExtrapolationIcon

**File:** `src/renderer/src/components/icons/ExtrapolationIcon.tsx:57`

**Issue:** `useId()` runs unconditionally on every render of the icon, but the id is only consumed when a tooltip is mounted. Calling `useId` is cheap (a counter increment) but means every decorative-icon use case (without `title`) generates a wasted id. With this icon potentially rendering hundreds of times in a virtualized panel, the ID counter advances faster than it needs to.

**Fix:** Negligible perf impact; consider this a style note. If the team prefers strict economy, conditionally render two variants of the host span — one for the tooltip-bearing case and one for the decorative case. Not worth a refactor unless the same pattern proliferates.

### IN-02: Tooltip portal renders into `document.body` — no portal teardown on unmount race

**File:** `src/renderer/src/components/icons/ExtrapolationIcon.tsx:99-110`

**Issue:** The `createPortal(...)` mounts directly into `document.body`. When the icon component unmounts (e.g., virtualization scrolls the row off-screen) while the tooltip is open, React's reconciler will unmount the portal correctly — but the contract relies on `tooltipPos !== null` being reset before unmount. There's no explicit cleanup `useEffect` that nulls `tooltipPos` on unmount. In practice React unmounts the entire subtree synchronously, so the portal disappears with it, but a future change that adds a leave-animation or a delay would expose this gap.

**Fix:** Defensive `useEffect(() => () => setTooltipPos(null), [])` cleanup, or accept the reliance on React's unmount contract (current behavior is correct).

### IN-03: `app.whenReady().then(async () => { ... await probeElevation() ... })` blocks window creation by ~50-100ms

**File:** `src/main/index.ts:523-585`

**Issue:** The probe is awaited before `createWindow()` runs. The comment justifies this: "the small startup tax buys a deterministic value for the IPC handler registered immediately below (no race between App.tsx mount and probe completion)". The 5s timeout on `exec` means the worst case is a 5-second window-show delay if `net session` hangs.

The renderer code already handles `isElevated === false` as the safe default (non-elevated path), and the probe is one-shot at boot. Awaiting it is defensible, but a hung `net session` (e.g., on a domain-controller-blocked enterprise Windows machine) will visibly delay the splash by up to 5 seconds.

**Fix:** Consider firing `probeElevation()` without `await` and registering the IPC handler to read the cached value (which defaults to `false` until the probe completes — same as the renderer's safe default). The trade-off is documented in the comment block; acceptable as-is for v1.1.x.

### IN-04: `summary.ts` filesystem probe is plain sync I/O on every `buildSummary` call

**File:** `src/main/summary.ts:487-493`

**Issue:** `buildSummary` is called from `handleSkeletonLoad` and `handleProjectResample` (Settings → samplingHz change). Each call now does two synchronous `fs.existsSync` invocations. Cost is negligible (~1ms total), but the existing `summary.ts` was previously fs-touch-only via the orphan-detection block (gated behind `load.atlasPath === null`). The new probe runs unconditionally regardless of mode — which is correct (the probe is mode-orthogonal) but worth noting for future I/O-budget audits.

**Fix:** None required. Documented here for future awareness.

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
