---
phase: 16-macos-auto-update-manual-download-ux
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/main/auto-update.ts
  - src/main/ipc.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/modals/UpdateDialog.tsx
  - src/shared/types.ts
  - tests/integration/auto-update-shell-allow-list.spec.ts
  - tests/integration/no-windows-fallback-literal.spec.ts
  - tests/main/auto-update-dismissal.spec.ts
  - tests/main/auto-update.spec.ts
  - tests/main/ipc.spec.ts
  - tests/renderer/app-update-subscriptions.spec.tsx
  - tests/renderer/update-dialog.spec.tsx
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 16 ships a clean, well-scoped UX refactor: the `windows-fallback` literal → `manual-download` rename is applied uniformly across all 6 source files; the in-process gate flip from `SPIKE_PASSED = process.platform !== 'win32'` to `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'` correctly routes macOS to manual-download by default while preserving the Windows runtime escape hatch (`spikeOutcome === 'pass'`); the per-release URL templating in `deliverUpdateAvailable` propagates correctly through the renderer; and the new `isReleasesUrl` IPC trust-anchor helper has a sensible structural-match design (URL-parse + exact-equals on protocol + hostname + pathname-prefix) backed by 9 dedicated test cases.

The five trust-anchor concerns called out in the review prompt all check out:

1. **`isReleasesUrl` (IPC):** The hostname-equals + pathname-startsWith approach correctly defends against the four documented threats (subdomain spoof, sibling-domain spoof, scheme downgrade, parse failure). The version-segment guard (`length > 0` + no further `/`) blocks pathological extensions like `/releases/tag/v1.2.0/admin`. The threat model in the JSDoc is accurate — the residual cases (encoded slashes, dotted prereleases that fail GitHub's tag lookup) land on a 404 GitHub page rather than constituting privilege escalation.
2. **Gate flip (`auto-update.ts:123`):** Linux-only positive form is correct; the macOS-via-darwin-plus-spike fallthrough is structurally impossible (no `macSignedOk` field exists, per D-02), so off-platform leakage is closed. Test 14-e explicitly mocks `process.platform = 'darwin'` and asserts `variant === 'manual-download'`.
3. **Variant routing call-site (`auto-update.ts:493-496`):** The boolean expression `IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)` reads correctly under all four platform/spike combinations; `fullReleaseUrl` is templated with the verified `info.version` from electron-updater (which itself parses a published tag).
4. **Renderer subscription cleanup (`App.tsx:367-444`):** All 5 unsubscribers (`unsubAvailable`, `unsubDownloaded`, `unsubNone`, `unsubError`, `unsubMenuCheck`) are returned in the cleanup function. The `requestPendingUpdate()` Promise is intentionally unawaited in cleanup (it's a one-shot read); no leak.
5. **Cross-file consistency:** The regression-gate test `tests/integration/no-windows-fallback-literal.spec.ts` walks the entire `src/` tree and fails on any reintroduction of the old literal — a strong durable lock.

The two warnings below describe defects that are not yet exploitable but represent latent invariant violations the test suite will not catch.

## Warnings

### WR-01: Optional `variant?` in preload + Api type lets `undefined` payloads silently regress to `'auto-update'`

**Files:**
- `src/preload/index.ts:459`, `src/preload/index.ts:468`
- `src/shared/types.ts:963`
- `src/renderer/src/App.tsx:374`, `src/renderer/src/App.tsx:431`

**Issue:** The `update:available` payload type in `src/preload/index.ts` (`onUpdateAvailable` arg) and the matching field in `src/shared/types.ts:Api['onUpdateAvailable']` declare `variant?: 'auto-update' | 'manual-download'` (optional). Main always populates `variant` (`auto-update.ts:493-496`, non-optional in `UpdateAvailablePayload`), but the renderer treats absence as `'auto-update'`:

```ts
// App.tsx:374
variant: payload.variant === 'manual-download' ? 'manual-download' : 'auto-update',
```

This is a fail-open pattern: any future regression that drops the `variant` field from the IPC payload (e.g., a refactor that re-introduces a default at a different layer, or a new path in `deliverUpdateAvailable` that forgets the field) silently routes macOS users back into the `'auto-update'` variant — i.e., the Squirrel.Mac code-signature-mismatch failure mode that this entire phase exists to close. There is no test that fires `update:available` without a `variant` field and asserts the renderer does NOT mount the `auto-update` UI.

This is the same risk shape as a missing CSRF token defaulting to "trusted": invariant failure in the unhappy direction.

**Fix:** Make `variant` required end-to-end. Update three spots:

```ts
// src/shared/types.ts (line ~960)
onUpdateAvailable: (
  cb: (payload: {
    version: string;
    summary: string;
    variant: 'auto-update' | 'manual-download';  // remove the `?`
    fullReleaseUrl: string;
  }) => void,
) => () => void;

// src/preload/index.ts (lines 456-475) — same: drop the `?` on both occurrences

// src/renderer/src/App.tsx (lines 374, 431) — replace the ternary fallback with
// a strict assignment now that the type forbids undefined:
variant: payload.variant,
```

The runtime ternary in App.tsx is then dead code that can be deleted; if a malformed payload ever arrives (impossible under the new type), TS will flag the call site at compile time. Add a regression test in `tests/renderer/app-update-subscriptions.spec.tsx` that fires a synthesized payload with `variant: 'manual-download'` and asserts the dialog renders the `Open Release Page` button (not `Download + Restart`).

---

### WR-02: `isReleasesUrl` accepts URLs with arbitrary `userinfo`, query string, or fragment — these reach `shell.openExternal` unchanged

**File:** `src/main/ipc.ts:223-252`

**Issue:** Empirically verified: the helper returns `true` for inputs like

- `https://user:pass@github.com/Dzazaleo/Spine_Texture_Manager/releases` → accepted (userinfo)
- `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0?evil=anything` → accepted (query string)
- `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0#anchor` → accepted (fragment)

The helper checks only `protocol`, `hostname`, and `pathname`. It does NOT check `username`, `password`, `search`, or `hash`. The full original URL (including userinfo + query + fragment) is then handed to `shell.openExternal(url)` at `ipc.ts:734`. None of these constitute privilege escalation — they all open in the system browser at GitHub — but they widen the trust boundary beyond the per-release UX intent.

The realistic concern is **phishing via authority-confusion**: a renderer compromise that calls `openExternalUrl('https://login@github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v9.9.9?prompt=Sign+in+to+continue')` opens a real GitHub URL that displays a userinfo prompt or attacker-controlled query parameters in the browser address bar. The threat model in the JSDoc (T-16-04-01..05) does not mention these surfaces.

The threat is low-severity because (a) the renderer is sandboxed + contextIsolated, (b) `info.version` comes from a verified electron-updater feed and cannot include `@`, and (c) the per-release URL is constructed by main, not the renderer. But the helper is also used by the IPC handler at `ipc.ts:732` against arbitrary renderer-supplied input, where the threat model says "any future renderer compromise that tries to inject arbitrary URLs."

**Fix:** Tighten the helper to reject userinfo + query + fragment when the URL claims to be a Releases URL. These are not part of the legitimate per-release URL shape that `deliverUpdateAvailable` emits.

```ts
export function isReleasesUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.hostname !== 'github.com') return false;
  // Phase 16 D-04 hardening: reject any URL with userinfo, query, or fragment.
  // The legitimate per-release URL emitted by deliverUpdateAvailable is
  // `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${version}`
  // — no auth, no query, no anchor. Any of those on inbound input is
  // attacker-controlled, never main-emitted.
  if (parsed.username !== '' || parsed.password !== '') return false;
  if (parsed.search !== '') return false;
  if (parsed.hash !== '') return false;
  // Also reject non-standard ports — github.com:443 is fine (port === '' after parse),
  // but :8080 etc. are not part of the legitimate URL shape.
  if (parsed.port !== '') return false;
  if (parsed.pathname === '/Dzazaleo/Spine_Texture_Manager/releases') return true;
  if (parsed.pathname.startsWith('/Dzazaleo/Spine_Texture_Manager/releases/tag/v')) {
    const versionSegment = parsed.pathname.slice(
      '/Dzazaleo/Spine_Texture_Manager/releases/tag/v'.length,
    );
    if (versionSegment.length === 0) return false;
    if (versionSegment.includes('/')) return false;
    return true;
  }
  return false;
}
```

Add three test cases to `tests/integration/auto-update-shell-allow-list.spec.ts`:

```ts
it('(16-j) URL with userinfo is REJECTED', () => {
  expect(isReleasesUrl('https://user:pass@github.com/Dzazaleo/Spine_Texture_Manager/releases')).toBe(false);
});
it('(16-k) URL with query string is REJECTED', () => {
  expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0?evil=1')).toBe(false);
});
it('(16-l) URL with fragment is REJECTED', () => {
  expect(isReleasesUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0#anchor')).toBe(false);
});
```

Note: `parsed.port === ''` for both `:443` (default https port, normalized away) and explicit no-port URLs, so the port guard does not break the existing 16-a/b/c happy-path tests.

## Info

### IN-01: Out-of-scope `compareSemver` numeric-tuple shim is broader than this phase but worth flagging

**File:** `src/main/auto-update.ts:368-392`

**Issue:** Pre-existing function (not introduced by Phase 16) that was carried over with a known soft spot: when numeric tuples are equal but strings differ (e.g., `1.1.0-rc1` vs `1.1.0-rc2`), the function returns `-1` (i.e., "available is newer") for ANY string mismatch. The conservative-bias docblock acknowledges this. The risk: if the user dismisses `1.1.0-rc2` and a later `1.1.0-rc1` event ever arrives (out-of-order CDN cache, manual feed edit), the code will fail to suppress because `compareSemver('1.1.0-rc2', '1.1.0-rc1')` returns `-1` (treats rc1 as newer). Phase 16 does not change this behavior. Out of scope to fix in this phase, but worth tracking as a v1.3 cleanup — switching to the `semver` npm package (already a transitive dep per the comment) is a 5-line change.

**Fix:** Defer to a follow-up phase. No action required for Phase 16.

---

### IN-02: `GITHUB_RELEASES_INDEX_URL` exported but no longer imported by `ipc.ts`

**File:** `src/main/auto-update.ts:90-91`

**Issue:** The JSDoc at line 87-88 says: "Exported so Plan 16-04's IPC allow-list helper can import the canonical literal rather than re-stating the URL in two places." But `src/main/ipc.ts:174` still uses an inline string literal for the index URL, not an import from `auto-update.ts`. The two literals agree byte-for-byte (and test 14-s asserts this), but the export is not consumed for its stated purpose.

**Fix:** Either (a) import `GITHUB_RELEASES_INDEX_URL` from `'./auto-update.js'` in `ipc.ts` and replace the inline literal at line 174 with the imported constant, OR (b) drop the "exported so Plan 16-04 can import" sentence from the docblock. The byte-for-byte regression gate (test 14-s) covers drift either way; the choice is purely stylistic.

---

### IN-03: Renderer's `payload.variant === 'manual-download'` ternary is a leftover from the previous default-fallback shape

**File:** `src/renderer/src/App.tsx:374`, `src/renderer/src/App.tsx:431`

**Issue:** The ternary `payload.variant === 'manual-download' ? 'manual-download' : 'auto-update'` is a no-op when `variant` is required (which it is in main's `UpdateAvailablePayload`). Identical to the `payload.variant ?? 'auto-update'` shape this was apparently meant to replace — both fall back to `'auto-update'` on missing/unknown values. Closely related to WR-01 but called out separately because even after fixing WR-01 the explicit literal-equals comparison is dead defensive code.

**Fix:** Once WR-01 is applied (variant becomes required), simplify to:

```ts
variant: payload.variant,
```

---

### IN-04: Tag-segment regex check would catch one corner case that the current `.includes('/')` guard lets through

**File:** `src/main/ipc.ts:244-249`

**Issue:** Empirical test: `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v..` parses as `true` because `..` does not contain `/`. Lands on a GitHub 404 (no v.. tag exists) — not exploitable, but slightly outside the per-release URL contract. The docblock at `ipc.ts:206-211` explicitly accepts this trade-off ("permissive about the version segment shape"); flagged here only so a future hardening pass has a paper trail.

**Fix:** Optional. If hardening is desired, replace the segment check with a semver-shape regex:

```ts
// Accept dotted prereleases (CLAUDE.md release-tag convention) and build metadata.
if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9a-zA-Z.-]+)?(?:\+[0-9a-zA-Z.-]+)?$/.test(versionSegment)) {
  return false;
}
```

Test 16-c (`v1.2.0-rc.1`) and 16-b (`v1.2.0`) both pass this regex; 16-i parse-failure cases stay unaffected. This is purely defense-in-depth — not required for Phase 16.

---

### IN-05: `App.tsx` update-subscription `useEffect` has `[]` deps but reads `manualCheckPendingRef` (correct via ref idiom — but easy to misread)

**File:** `src/renderer/src/App.tsx:367-444`

**Issue:** The lifted `useEffect(() => { ... }, [])` callback reads `manualCheckPendingRef.current` inside the `onUpdateNone` and `onUpdateError` subscribers (lines 385 and 401). This is correct — `useRef` containers are stable across renders and reading `.current` inside a long-lived subscriber is the canonical React pattern for "see the latest value without re-subscribing." But a future maintainer scanning the deps array could mistake this for a stale-closure bug and "fix" it by adding `manualCheckPendingRef.current` to the deps array, which would re-run the effect on every check-pending state change and tear down/reattach all 5 subscribers.

**Fix:** Add a short comment above the `useEffect` clarifying that `manualCheckPendingRef` is intentionally NOT in the deps array because it's a `useRef` (stable identity, current value read on each event fire). Example:

```ts
// Intentionally empty deps — the 5 IPC subscribers and the requestPendingUpdate
// invocation must run exactly once per App mount (Phase 14 D-03 lift). The
// `manualCheckPendingRef` reads inside subscribers are useRef-stable: the
// `.current` value is fetched at event-fire time, NOT at effect-commit time,
// so adding the ref to the deps array would tear down + re-bind subscribers
// on every check-pending toggle.
}, []);
```

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
