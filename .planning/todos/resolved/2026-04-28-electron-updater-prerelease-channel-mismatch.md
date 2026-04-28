---
created: 2026-04-28T20:00:00Z
title: electron-updater rc-channel mismatch — prerelease auto-update broken with rc1/rc2/rc3-style tags
area: build-pipeline
files:
  - .github/workflows/release.yml
  - package.json
---

## Problem

During Phase 12.1 live verification (rc2 install → wait for rc3 publish → expect UpdateDialog), the auto-update flow on macOS + Windows kept reporting `Update for version 1.1.0-rc2 is not available (latest version: 1.1.0-rc2, downgrade is disallowed).` Even after publishing the v1.1.0 final tag (semver: `1.1.0` > `1.1.0-rc2`), rc2 still saw rc2 as the latest. Reproduced on both macOS and Windows, ruling out a local cache issue.

Root cause traced to `electron-updater@6.8.3` GitHub provider channel-matching logic in `node_modules/electron-updater/out/providers/GitHubProvider.js:51-83`:

```js
const currentChannel = semver.prerelease(this.updater.currentVersion)?.[0] || null;
//   semver.prerelease("1.1.0-rc2") === ["rc2"]  (NOT ["rc", 2])
//   currentChannel = "rc2"

for (const element of feed.getElements("entry")) {
    const hrefChannel = semver.prerelease(hrefTag)?.[0] || null;
    // For "v1.1.0-rc3" → hrefChannel = "rc3"
    const isNextPreRelease = hrefChannel && hrefChannel === currentChannel;
    // "rc3" === "rc2" → false → SKIP
    // Then iterates to v1.1.0-rc2 → "rc2" === "rc2" → true → MATCH
}
```

Because semver treats `rc2` (no dot before the number) as a single opaque prerelease token, the channel name becomes `"rc2"` literally — different from `"rc3"` and from `"rc1"`. electron-updater's iteration walks past v1.1.0 (final, channel=null, skipped because shouldFetchVersion=false on a non-alpha/beta currentChannel) and v1.1.0-rc3 (channel="rc3" ≠ "rc2"), eventually matching the install's own version v1.1.0-rc2 as "the latest" — at which point the comparison `1.1.0-rc2 vs 1.1.0-rc2` reports no update.

This means **rc-tagged builds of this app with the current naming convention can never auto-update to anything**, including a final non-prerelease release.

## Solution

Use semver-canonical prerelease syntax with a dot before the iteration number. Future prerelease tags should be:

- `v1.2.0-rc.1` (NOT `v1.2.0-rc1`)
- `v1.2.0-rc.2` (NOT `v1.2.0-rc2`)
- `v1.2.0-rc.3` (NOT `v1.2.0-rc3`)
- `v2.0.0-beta.1` (NOT `v2.0.0-beta1`)

With this naming, `semver.prerelease("1.2.0-rc.2")` returns `["rc", 2]` — channel becomes `"rc"`, not `"rc2"`. All `rc.*` tags then share the same channel and rc.1 → rc.2 → rc.3 → 1.2.0 auto-update works correctly.

**Fix locations:**

1. **`.github/workflows/release.yml`** — the tag-version-guard regex/check (release.yml:43-54) accepts any `v*.*.*` pattern. No edit needed; the dot-prefix variant matches the same pattern.

2. **Project conventions / docs** — update CLAUDE.md (or wherever release-tag conventions live) to specify dot-prefix prerelease format. Example: `v1.1.0-rc.1` ✅, `v1.1.0-rc1` ❌.

3. **Existing v1.1 stranded installs** — anyone who installed v1.1.0-rc1/rc2/rc3 cannot auto-update. They must manually download v1.1.0 (or later) from GitHub Releases once. After they're on v1.1.0 (final, no prerelease), all future auto-updates work because the `currentChannel === null` code branch in GitHubProvider.js picks the first atom feed entry unconditionally.

4. **Optional belt-and-braces** — could explicitly set `autoUpdater.channel = 'latest'` in `src/main/auto-update.ts`, but with `allowPrerelease: true` and final-release installs that's a no-op (semver.prerelease() returns null, currentChannel falls back to null, first-entry path).

## Verification path (post-fix)

1. Ship v1.1.0 final (already done — 2026-04-28).
2. When v1.1.1 ships as a real bug-fix release, test v1.1.0 → v1.1.1 auto-update on macOS and Windows. Both are non-prerelease, currentChannel=null path → expected to work cleanly.
3. When the next major prerelease ships (e.g. v1.2.0-rc.1), test v1.1.x → v1.2.0-rc.1 (with dot) auto-update if `allowPrerelease: true`.
4. Then v1.2.0-rc.1 → v1.2.0-rc.2 (same-channel rc), then v1.2.0-rc.2 → v1.2.0 (final).

## Cross-references

- Discovered during Phase 12.1 Plan 12.1-03 / 12.1-05 Tasks 2-3 (rc2-detects-rc3 observation, 2026-04-28).
- Live evidence: `temp/autoupdate_log_v3.md` (terminal output: `Update for version 1.1.0-rc2 is not available (latest version: 1.1.0-rc2)`).
- Atom feed snapshot at the time: v1.1.0 → v1.1.0-rc3 → v1.1.0-rc2 → v1.1.0-rc1 → v1.0 MVP (correct order).
- Both `/releases/latest` REST endpoint and `releases.atom` feed return the correct latest tag (v1.1.0) — server-side is fine; the bug is purely in electron-updater's channel-matching client logic.
- Affects Phase 12.1 ROADMAP success criteria SC-2/SC-3/SC-4 partial-deferral: live verification of UPD-01..UPD-04 lifecycle requires the next non-prerelease bug-fix release (v1.1.1) to test the realistic v1.1.0 → v1.1.1 upgrade path.

## Sibling todos from same testing round

- `2026-04-28-windows-menu-bar-hidden-by-default-alt-reveals.md` — autoHideMenuBar at src/main/index.ts:339
- `2026-04-28-windows-about-panel-shows-1.1.0.0-not-semver.md` — about-panel cosmetic display

---

## Resolved

2026-04-28 — Phase 13 Plan 02: CLAUDE.md gained a `## Release tag conventions` section between `## Critical non-obvious facts` and `## Test fixture` documenting `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ with one-line rationale (electron-updater 6.x channel-name comparison; semver prerelease parser semantics) and a cross-link back to this resolved todo. Workflow-level regex guard at `.github/workflows/release.yml:43-54` intentionally deferred to v1.2+ per D-05 — CLAUDE.md docs are sufficient for a single-developer project, and the next prerelease cycle (if any) will adopt the dot-form naturally. Existing rc-shaped tags (`v1.1.0-rc1` / `-rc2` / `-rc3`) stay as-is in release history; no rewrite, no force-push.
