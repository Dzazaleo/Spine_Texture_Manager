---
phase: 41-spine-animation-viewer
reviewed: 2026-05-15T16:07:04Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - package.json
  - src/main/ipc.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/AnimationPlayerModal.tsx
  - src/shared/types.ts
  - tests/main/viewer-asset-feed-ipc.spec.ts
  - tests/renderer/animation-player-modal.spec.tsx
  - tests/renderer/app-shell-animation-viewer.spec.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-05-15T16:07:04Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 41 adds a Spine animation viewer modal driven by `@esotericsoftware/spine-player` and exposes a new `viewer:get-asset-feed` Electron IPC channel that re-runs the atlas-less synthesizer on demand. The trust-boundary discipline on the new IPC handler is mostly consistent with the project's existing pattern (`handleSkeletonLoad`-style typeof + extension check), and the IPC envelope is structured-clone-safe (`Record<string,string>`, no Maps). The modal correctly disposes the player in `useEffect` cleanup with a `disposed` flag and reuses the locked 5-modal ARIA scaffold via `useFocusTrap`. The AppShell wiring (`modalOpen` OR-chain + dep-array parity, project-change cleanup keyed on `[summary]`) appears correctly threaded.

No critical issues were found, but five warnings surface non-trivial defects:

- (WR-01) the new IPC channel will `readFile + JSON.parse` any user-supplied `.json` path without size/bounds limits — DoS surface in main
- (WR-02) the `pngPathsByRegionName` map keys flow through unsanitized from the JSON into an object literal (no `Object.create(null)`) — prototype-key shadowing hazard
- (WR-03) `useFocusTrap` re-mounts and resnaps focus on every AppShell re-render because the `onClose` arrow is recreated inline at the JSX site — focus-jumping UX defect when AppShell re-renders while modal is open
- (WR-04) the IPC handler's `JSON.parse`/fs error message is forwarded verbatim and can leak file content fragments / path existence via repeated probes ("Unexpected token X at position 5")
- (WR-05) the scrub handler does `animationState.update(negative-delta)` when seeking backward — undefined behavior in spine-runtime

Four info-level items cover error-message metadata loss, sequential `pathToImageUrl` await loop, redundant initial-mount fire of the `[summary]` reset effect, and weakened error-kind typing.

## Warnings

### WR-01: `viewer:get-asset-feed` reads + JSON-parses arbitrary user-controlled paths with no size cap

**File:** `src/main/ipc.ts:1283-1294`
**Issue:** The handler validates only `typeof skeletonPath === 'string'` and `.json` suffix, then does `JSON.parse(await readFile(skeletonPath, 'utf8'))`. Any compromised renderer call site (or any caller wiring around `window.api.getViewerAssetFeed`) can pass a multi-gigabyte path ending in `.json` and main will load the entire file into memory + run a blocking parse, freezing the main process. The handler comment explicitly invokes "Trust boundary (T-41-01)" but the validation does not match `handleSkeletonLoad`'s defense (which routes through `loadSkeleton` and inherits its bounds via `fs.statSync`/spine-loader limits). The IPC channel also does NOT verify the path corresponds to a previously-loaded skeleton; nothing constrains it to the user's current project.
**Fix:**
```ts
ipcMain.handle('viewer:get-asset-feed', async (_evt, skeletonPath: unknown) => {
  if (typeof skeletonPath !== 'string' || skeletonPath.length === 0) { /* ... */ }
  if (!skeletonPath.toLowerCase().endsWith('.json')) { /* ... */ }
  try {
    const st = await stat(skeletonPath);
    // Match the implicit cap loadSkeleton imposes; a few MB is plenty for any
    // real Spine skeleton JSON. Anything beyond 16MB is almost certainly a
    // non-skeleton path probe.
    if (st.size > 16 * 1024 * 1024) {
      return { ok: false, error: { kind: 'Unknown', message: 'Skeleton JSON exceeds 16MB' } };
    }
    const parsedJson = JSON.parse(await readFile(skeletonPath, 'utf8'));
    // ...rest unchanged
  } catch (err) {
    return { ok: false, error: { kind: 'Unknown', message: (err as Error).message ?? String(err) } };
  }
});
```

### WR-02: `regionPaths` populated as plain object literal — `__proto__`/`constructor` region names can shadow prototype keys

**File:** `src/main/ipc.ts:1290-1293` (and renderer mirror at `src/renderer/src/modals/AnimationPlayerModal.tsx:114-119`)
**Issue:** The handler builds `regionPaths: Record<string,string> = {}` and loops `regionPaths[regionName] = absPath`. `regionName` originates from user-controlled JSON content (walked by `synthesizeAtlasText` from `parsedJson`). While `regionPaths['__proto__'] = '/some/path.png'` is a no-op against object-prototype in modern V8 (string assignment to `__proto__` is silently dropped when the RHS isn't an object), keys like `'constructor'`, `'hasOwnProperty'`, `'toString'`, `'valueOf'` ARE legitimate own-property writes that shadow `Object.prototype.constructor` etc. Downstream consumers using `regionPaths.hasOwnProperty(...)` or `regionPaths[k].toString()` will see the shadowed string value instead of the prototype method and throw. Defense-in-depth fix is to use a null-prototype object on both sides of the boundary.
**Fix:**
```ts
// src/main/ipc.ts:1290
const regionPaths: Record<string, string> = Object.create(null);
for (const [regionName, absPath] of synth.pngPathsByRegionName) {
  regionPaths[regionName] = absPath;
}

// src/renderer/src/modals/AnimationPlayerModal.tsx:114
const rawDataURIs: Record<string, string> = Object.create(null);
rawDataURIs['synthetic.atlas'] = feed.atlasTextDataUri;
for (const [regionName, absPath] of Object.entries(feed.regionPaths)) {
  rawDataURIs[regionName + '.png'] = await window.api.pathToImageUrl(absPath);
}
```
Note: spine-player's AssetManager reads `rawDataURIs[key]` directly — a null-prototype Record works identically for the consumer.

### WR-03: `useFocusTrap` re-runs and snaps focus to first tabbable on every AppShell re-render

**File:** `src/renderer/src/components/AppShell.tsx:2541-2548` (mount site) + `src/renderer/src/modals/AnimationPlayerModal.tsx:144` (hook call) + `src/renderer/src/hooks/useFocusTrap.ts:189` (deps)
**Issue:** AppShell mounts the modal with `onClose={() => setAnimationViewerOpen(false)}` — a freshly-allocated arrow on every AppShell render. The modal passes `{ onEscape: props.onClose }` to `useFocusTrap`, whose effect deps include `onEscape`. Because `onEscape` identity changes on every AppShell render, the focus-trap effect tears down and re-mounts on each render, calling `initialTabbables[0].focus()` at `useFocusTrap.ts:125` every time. AppShell re-renders for many reasons while the viewer is open (samplingInFlight ticks, prop updates from App.tsx, parent's update-dialog subscribers, etc.) — the user's focus will snap back to the animation `<select>` mid-interaction, breaking play/pause/scrub flow. The `useFocusTrap.ts:185-188` comment claims "the closure capture is stable for the duration of any given (enabled === true) lifecycle" — that invariant does NOT hold when the caller passes inline arrows. Existing modals share the same call-site shape but their interaction lifetimes are short (one button click → close); Phase 41's modal is the first long-lived modal where this bites.
**Fix:** Memoize the close handler at the AppShell site (preferred — minimal blast radius):
```tsx
const onCloseAnimationViewer = useCallback(() => setAnimationViewerOpen(false), []);
// ...
{animationViewerOpen && (
  <AnimationPlayerModal
    open={true}
    summary={effectiveSummary}
    loaderMode={loaderMode}
    onClose={onCloseAnimationViewer}
  />
)}
```
…or strip `onEscape` from the `useFocusTrap` deps via a ref inside the hook (deeper fix benefiting every modal call site):
```ts
// useFocusTrap.ts
const onEscapeRef = useRef(onEscape);
useEffect(() => { onEscapeRef.current = onEscape; }, [onEscape]);
// ...inside onKeyDown: if (onEscapeRef.current) { event.preventDefault(); onEscapeRef.current(); }
// deps: [containerRef, enabled]
```

### WR-04: `JSON.parse` / fs error messages forwarded verbatim — content + path-existence oracle

**File:** `src/main/ipc.ts:1295-1300`
**Issue:** When `readFile` succeeds but `JSON.parse` fails, V8 emits errors like `"Unexpected token 'a' in JSON at position 1234"` that include literal characters from the file at the failure offset. Combined with the absence of any path-scope restriction (see WR-01), a renderer-side attacker can pass paths to non-JSON files (`/etc/passwd`, `~/.aws/credentials`, etc.) and reconstruct content one offset at a time. The `ENOENT` branch (file-not-found) similarly leaks absolute path existence + filesystem layout. The project's existing pattern in `handleSkeletonLoad` mitigates this by routing through `loadSkeleton`'s typed errors (`SpineLoaderError` subclasses), which carry pre-sanitized messages — the new handler bypasses that filter.
**Fix:**
```ts
} catch (err) {
  // Don't forward V8's JSON-parse offset/character details — they leak
  // content of arbitrary files when called with a non-skeleton path.
  // Don't forward ENOENT/EACCES details — they leak path existence and
  // filesystem layout to a compromised renderer.
  const code = (err as NodeJS.ErrnoException)?.code;
  const message =
    err instanceof SyntaxError ? 'Skeleton JSON is malformed' :
    code === 'ENOENT' ? 'Skeleton file not found' :
    code === 'EACCES' ? 'Skeleton file not readable' :
    err instanceof Error ? err.message : String(err);
  return { ok: false, error: { kind: 'Unknown', message } };
}
```

### WR-05: Scrub handler issues negative `animationState.update(delta)` when seeking backward

**File:** `src/renderer/src/modals/AnimationPlayerModal.tsx:294-301`
**Issue:** `delta = targetTime - p.playTime`. When the user drags the timeline slider to the left (seek backward), `delta` is negative. `animationState.update(negative)` on spine-runtime's `TrackEntry.trackTime` advances internally via `trackTime += delta * timeScale`; negative deltas drive `trackTime` below 0 which interacts incorrectly with `loop`/`mixDuration` accounting in spine-runtimes 4.2 (`AnimationState.update` does not symmetrically handle negative deltas — the loop wrap-around assumes monotonic forward progress). The comment references "the vendored built-in slider's logic (line 14330-14338)" — but the vendored slider writes `entry.trackTime = targetTime` directly rather than driving it through `animationState.update(delta)`. Forward-scrub dominates user behavior so manual UAT may not catch this; backward-scrub will exhibit visual glitches (frozen pose, wrong wrap point, or skipped mix).
**Fix:** Write `trackTime` directly to mirror the vendored slider behavior:
```ts
const onScrub = useCallback((percentage: number) => {
  const p = playerRef.current;
  if (!p?.animationState) return;
  const entry = p.animationState.getCurrent(0);
  if (!entry) return;
  p.pause();
  const duration = entry.animation.duration;
  const targetTime = duration * percentage;
  // Write trackTime directly — animationState.update(delta) is forward-only
  // and produces glitches on backward scrub.
  entry.trackTime = targetTime;
  p.animationState.apply(p.skeleton);
  p.skeleton.update(0);
  p.skeleton.updateWorldTransform(2);
  p.playTime = targetTime;
  setScrubPercent(percentage);
  setIsPaused(true);
}, []);
```
(Cross-check against the actual vendored spine-player slider implementation referenced in the existing comment — the code claims to mirror it but the call sequence is different.)

## Info

### IN-01: `feed.error.kind` discarded — only `feed.error.message` reaches the user

**File:** `src/renderer/src/modals/AnimationPlayerModal.tsx:111-113`
**Issue:** `if (!feed.ok) throw new Error(feed.error.message);` drops `feed.error.kind`. The IPC envelope models `kind` and `message` as a discriminator pair (mirrors `LoadResponse`'s `SerializableError`), but only `message` flows through. If main eventually emits typed kinds beyond `'Unknown'` (e.g. `'MissingImagesDirError'`), the viewer would need this distinction to vary copy or behavior.
**Fix:** Preserve both via a structured error, or switch on `feed.error.kind` to compose a kind-specific user-facing message.

### IN-02: Sequential `await` loop in `buildAssetFeed` — N+1 IPC round-trips for atlas-less projects

**File:** `src/renderer/src/modals/AnimationPlayerModal.tsx:117-119`
**Issue:** `for (const [regionName, absPath] of Object.entries(feed.regionPaths)) { rawDataURIs[regionName + '.png'] = await window.api.pathToImageUrl(absPath); }` issues IPC invokes one at a time. For an atlas-less project with 50 regions, that's 50 serialized round-trips. Performance is out of v1 scope per review rules, but correctness-wise it leaves the viewer in `'loading'` state for an unnecessarily long stretch.
**Fix:**
```ts
const entries = await Promise.all(
  Object.entries(feed.regionPaths).map(async ([name, abs]) =>
    [name + '.png', await window.api.pathToImageUrl(abs)] as const,
  ),
);
const rawDataURIs: Record<string, string> = Object.create(null);
rawDataURIs['synthetic.atlas'] = feed.atlasTextDataUri;
for (const [k, v] of entries) rawDataURIs[k] = v;
```

### IN-03: VIEWER-08 `[summary]`-keyed effect fires redundantly on initial AppShell mount

**File:** `src/renderer/src/components/AppShell.tsx:307-309`
**Issue:** `useEffect(() => { setAnimationViewerOpen(false); }, [summary]);` runs on initial mount (React always fires effects on mount regardless of dep-array contents). On first mount `animationViewerOpen` is already `false`, so `setAnimationViewerOpen(false)` is a no-op via React's `Object.is` bailout — benign but creates an effect-run that won't show up as a state change in dev tooling and may confuse readers. The localSummary reset at AppShell.tsx:288-290 has the same shape.
**Fix:** Add a comment noting the initial-mount no-op behavior is intentional; or guard with a `useRef` first-render flag if it ever becomes a debugging concern.

### IN-04: `ViewerAssetFeedResponse.error.kind` typed as bare `string` instead of a literal union

**File:** `src/shared/types.ts:968-971`
**Issue:** The other IPC envelopes (`LoadResponse`, `OpenResponse`) use `SerializableError` with a literal-union `kind`. `ViewerAssetFeedResponse` uses `kind: string`, which weakens consumer narrowing. The producer (`viewer:get-asset-feed`) currently only emits `kind: 'Unknown'` so a literal `'Unknown'` would suffice today; widening to a union later is non-breaking.
**Fix:**
```ts
| { ok: false; error: { kind: 'Unknown' | 'MissingImagesDirError'; message: string } };
```
Optionally update the handler to emit `'MissingImagesDirError'` when `synthesizeAtlasText` throws that specific subclass — matching the project-load envelope precedent and giving the viewer a hook for future kind-specific copy.

---

_Reviewed: 2026-05-15T16:07:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
