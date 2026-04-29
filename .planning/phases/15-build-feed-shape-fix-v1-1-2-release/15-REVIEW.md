---
phase: 15-build-feed-shape-fix-v1-1-2-release
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - electron-builder.yml
  - package.json
  - scripts/emit-latest-yml.mjs
  - tests/integration/emit-latest-yml.spec.ts
  - .github/workflows/release.yml
  - tests/integration/build-scripts.spec.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 15 ships the v1.1.2 UPDFIX-01 fix: macOS auto-update was silently failing because Squirrel.Mac requires a `.zip` swap medium that v1.1.1 was not producing. The fix adds `target: zip` to `mac.target`, drops explicit `--mac dmg` CLI flags from `build:*` scripts (which would override the YAML), extends the synthesizer to emit a 2-entry `files[]` (`.zip` first), and updates CI globs to upload+publish the `.zip`. The greenfield 14-test `build-scripts.spec.ts` invariant suite is excellent — it catches glob-broadening regressions, target-flag drift, and SHA-pin removal.

Overall the change is tightly scoped, well-documented (every non-obvious decision traces to a D-XX or RESEARCH §X anchor), and the test coverage is strong on both the synthesizer-output (`emit-latest-yml.spec.ts`) and synthesizer-input (`build-scripts.spec.ts`) layers. v1.1.1 byte-identity for win/linux feed shape is preserved.

The findings below are all non-blocking. Two warnings concern subtle correctness gaps that could surface at build-time if the environment varies; the four info items are stylistic / documentation tightening.

## Warnings

### WR-01: Stale comment in `electron-builder.yml` (mac block) does not reflect dual-target reality

**File:** `electron-builder.yml:55`
**Issue:** The comment above the `mac:` block reads `# DIST-02, DIST-04: macOS arm64 .dmg, ad-hoc signed.` — but as of Phase 15 D-01, the mac target produces both `.dmg` AND `.zip`. A future maintainer reading only the comment will miss the `.zip` artifact and may "clean up" the second target as redundant, breaking auto-update again. The comment is documentation drift on a load-bearing decision that took an entire investigation phase to recover.

**Fix:**
```yaml
# DIST-02, DIST-04, UPDFIX-01 (Phase 15 D-01): macOS arm64 .dmg + .zip, ad-hoc signed.
# .zip is REQUIRED by electron-updater 6.x's MacUpdater for the Squirrel.Mac swap
# on Download & Restart. Removing the zip target reintroduces ERR_UPDATER_ZIP_FILE_NOT_FOUND.
# See .planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-CONTEXT.md D-01.
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
    - target: zip
      arch: arm64
  ...
```

### WR-02: Synthesizer runs unconditionally on `npm run build:mac`, can mask a build failure

**File:** `package.json:17`
**Issue:** The shell chain is `electron-vite build && electron-builder --mac --publish never && node scripts/emit-latest-yml.mjs --platform=mac`. The `&&` short-circuits correctly if `electron-builder` exits non-zero — so the synthesizer is skipped on failure, which is the desired behavior. However, `electron-builder` is known to occasionally exit `0` while emitting only a partial set of artifacts (e.g., when a sub-target fails but the publisher chain swallows the error). In that edge case, `findInstallers` will surface the failure with a clear "No installer matching /\.zip$/i found" message — but ONLY for the missing kind. If the `.dmg` is present and the `.zip` is missing, the test in `tests/integration/emit-latest-yml.spec.ts:267` covers that exact path, so the synthesizer's fail-fast is verified. The risk is solely that a maintainer running `npm run build:mac` locally on a non-arm64 mac (e.g., Intel) would see electron-builder skip the arm64 zip silently and the synthesizer fail with what looks like a configuration error. There's no defense beyond the existing error message.

**Fix:** Tighten the synthesizer's "No installer matching" error to mention the platform context, e.g.:

```js
// scripts/emit-latest-yml.mjs:122
console.error(`No installer matching ${re} found in ${RELEASE_DIR}. ` +
  `Did electron-builder produce both .dmg AND .zip for mac? ` +
  `Check electron-builder.yml mac.target and verify the host arch matches arch: arm64.`);
```

This is a documentation-quality fix, not a logic fix — the failure is already loud, the suggestion just shortens the time-to-diagnosis for an arch-mismatch developer.

## Info

### IN-01: `tests/integration/emit-latest-yml.spec.ts` first describe block now writes a `.zip` fixture but its description still says "schema correctness"

**File:** `tests/integration/emit-latest-yml.spec.ts:46-89`
**Issue:** The original `beforeAll` in the top-level test file now writes BOTH a `.dmg` and a `.zip` to satisfy the dual-installer mac requirement, then runs `--platform=mac`. The first describe block ("schema correctness") at line 97 inherits this fixture state. Tests like `files[] is a non-empty array with the .dmg installer entry` (line 113) now pass mostly by accident — the test would also pass against the `dual-installer mac case` describe block (line 182). There's some duplicate coverage between the top-level beforeAll and the `Phase 15 D-04 — dual-installer mac case` block.

This is not a bug, just structural redundancy. If a future change to the dual-installer mac contract is needed, both describe blocks would need updating in lockstep.

**Fix:** Optionally consolidate. If the top-level beforeAll is meant to assert "the legacy single-installer happy path," it should write only the `.dmg` and use `--platform=win` or `--platform=linux` (which are still single-installer). As-is, the top-level describe and the D-04 dual-installer describe test the same configuration with different assertions. No action required for v1.1.2; consider for a future test-cleanup pass.

### IN-02: `fixtureZipSha512` is computed in top-level `beforeAll` but only used by one assertion

**File:** `tests/integration/emit-latest-yml.spec.ts:69, 157`
**Issue:** `fixtureZipSha512` is declared at module scope (line 43) and assigned in `beforeAll` (line 69). It's used by exactly one assertion: `expect(doc.sha512).toBe(fixtureZipSha512)` at line 157. Meanwhile, `fixtureInstallerSha512` (the `.dmg` hash) is referenced once at line 132. The `D-04 — dual-installer mac case` describe declares its own `dualZipSha512` / `dualDmgSha512` independently. Two parallel naming schemes for the same concept (top-level `fixtureZipSha512` vs nested `dualZipSha512`) makes the intent harder to follow.

**Fix:** Rename the top-level fixtures to clarify what they're testing — e.g., `topLevelZipSha512` / `topLevelDmgSha512` — or drop the top-level zip fixture entirely if IN-01 is addressed.

### IN-03: `findInstallers` could log all matched files on multi-match failure without forcing platform context

**File:** `scripts/emit-latest-yml.mjs:125-128`
**Issue:** When multiple installers match a regex, the error message lists them but does not say which platform's pipeline triggered the failure. In a CI log, this is less helpful than it could be (the platform argv is the very first thing the script logs in its success path).

**Fix:**
```js
console.error(`Multiple installers match ${re} in ${RELEASE_DIR} for platform ${platform}: ${matches.join(', ')}. Pipeline must commit to one installer per kind per platform.`);
```

This requires threading `platform` into `findInstallers` (currently called from `emitYaml(platform)`, the value is in scope via the parent closure; just pass it explicitly). Tiny change; improves log-reading ergonomics.

### IN-04: `build:dry` script in `package.json` still uses `electron-builder --mac dmg` which is the exact pattern Phase 15 RESEARCH §A2 says NOT to use

**File:** `package.json:20`
**Issue:** `"build:dry": "electron-vite build && electron-builder --mac dmg --dir"` — this is a dev-only smoke test, but it deliberately uses the form RESEARCH §A2 identifies as overriding `mac.target`. That's actually fine here because `--dir` mode is a fast unpacked-bundle preview that never touches auto-update, but a maintainer reading `build-scripts.spec.ts` line 62 (`expect(pkg.scripts['build:mac']).not.toMatch(/--mac\s+dmg/)`) might wonder why `build:dry` uses the forbidden form. The test correctly only asserts on `build:mac` / `build:win` / `build:linux`, so this is purely a comprehension hazard.

**Fix:** Add a brief inline comment on the script or tighten the comment in the spec at line 60 noting that `build:dry` is intentionally exempt because it bypasses the feed-emit chain entirely (`--dir` skips packaging/codesigning/zip). Alternatively, change `build:dry` to use bare `--mac --dir` and trust the YAML; both work.

---

## Notes on out-of-scope concerns examined

- **Security — YAML injection in synthesizer:** `js-yaml.dump` is the only sink for user-controlled-ish data (filename, version). `js-yaml` correctly escapes these. The `version` field comes from `package.json` via `JSON.parse` of trusted local repo file. The filename comes from `readdirSync` of the local `release/` dir. No injection vector.
- **Security — path traversal:** All paths constructed via `path.join`/`resolve` against `REPO_ROOT`. The `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` env var widens scope but is a documented test-seam consumed only by the same Node process, not a server boundary. No exploit.
- **Security — supply-chain in release.yml:** All actions pinned to immutable SHAs (verified by `build-scripts.spec.ts:105-109`). `--publish never` and `CSC_IDENTITY_AUTO_DISCOVERY: false` correctly set. `concurrency.cancel-in-progress: false` prevents partial-publish races. `permissions: contents: write` is minimal scope. `tag_name: ${{ github.ref_name }}` — ref_name is GitHub-validated. `prerelease: ${{ contains(github.ref_name, '-') }}` correctly drives the v1.2.0-rc.1 dot-suffix path documented in CLAUDE.md. No findings.
- **Correctness — electron-updater 6.x feed format:** `sha512` is base64 (not hex), `size` is integer (`statSync().size` is `number`), `files[]` is array with `.zip` first on mac. `releaseDate` is ISO 8601. All match electron-updater 6.x consumer expectations.
- **Correctness — `app-update.yml` byte-identity:** The synthesizer writes `latest-mac.yml`, NOT `app-update.yml`. The `extraResources` block at `electron-builder.yml:20-22` continues to bundle `build/app-update.yml` unchanged. The 12.1-D-10 publish-race-fix architecture is preserved verbatim. No regression.
- **Correctness — end-anchored globs:** `findInstallers` uses `/\.zip$/i` which excludes `.zip.blockmap`. The CI globs use `release/*.zip` (NOT `release/*.zip*`), explicitly asserted by `build-scripts.spec.ts:97-103`. No findings.
- **Correctness — files[] order matters for Squirrel.Mac:** Verified `.zip` is files[0] both in synthesizer (PLATFORM_MAP.mac.extRegexes order) and in test fixtures.

---

_Reviewed: 2026-04-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
