---
phase: 15-build-feed-shape-fix-v1-1-2-release
reviewed: 2026-04-29T00:00:00Z
reviewed_supplement: 2026-04-29T22:30:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - electron-builder.yml
  - package.json
  - scripts/emit-latest-yml.mjs
  - tests/integration/emit-latest-yml.spec.ts
  - .github/workflows/release.yml
  - tests/integration/build-scripts.spec.ts
  - scripts/emit-latest-yml.mjs (Plan 15-05 sanitizeAssetUrl helper + 2 call sites)
  - tests/integration/emit-latest-yml.spec.ts (Plan 15-05 new describe block + updated existing assertions)
  - tests/integration/build-scripts.spec.ts (Plan 15-06 version bump assertion 1.1.2 → 1.1.3)
findings:
  critical: 0
  warning: 2
  info: 7
  total: 9
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 6 (initial) + 3 (hotfix supplement) = 9
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

---

## Hotfix Supplement — Plans 15-05 + 15-06 (v1.1.3)

**Reviewed:** 2026-04-29T22:30:00Z
**Depth:** standard
**Files reviewed (this supplement):** 3
- `scripts/emit-latest-yml.mjs` (sanitizeAssetUrl helper + 2 call sites — Plan 15-05)
- `tests/integration/emit-latest-yml.spec.ts` (new "Phase 15 Plan 05" describe block + 5 updated existing assertions — Plan 15-05)
- `tests/integration/build-scripts.spec.ts` (1-line bump 1.1.2 → 1.1.3 — Plan 15-06 commit `95b76eb`)

**Out-of-scope (verified, no findings):**
- `package.json` (single-line `version` bump)
- `package-lock.json` (npm-managed dual `version` field bump)

### Summary

Plan 15-05 lands the v1.1.3 hotfix for D-15-LIVE-1: a `sanitizeAssetUrl()` synthesizer helper that rewrites local-filename spaces to dots in emitted `files[].url` and the legacy top-level `path:` mirror, so the published `latest-mac.yml` agrees byte-for-byte with GitHub's auto-renamed asset names. The fix is a single-line transformation `name.replace(/ /g, '.')` with extensive (35-line) JSDoc rationale. Plan 15-06 ships the v1.1.3 release; the only code-side change in Plan 15-06's surface is a 1-line bump of a hardcoded version assertion in `build-scripts.spec.ts`.

The hotfix code surface is tight, well-documented, and the test coverage (7 new assertions across 3 platforms + a multi-space negative test) is genuinely load-bearing. Empirical closure was verified live (Test 7-Retry, 22:00Z) — v1.1.1 → v1.1.3 .zip download succeeded byte-exact at the dotted URL. There are no critical issues. Findings below are all info-level and concern documentation precision, defensive programming opportunities, and structural test-coverage suggestions for future hardening.

### Info

### IN-05: `sanitizeAssetUrl()` only handles U+0020 (literal SPACE), not other Unicode whitespace forms

**File:** `scripts/emit-latest-yml.mjs:175-177`
**Issue:** The implementation `localFilename.replace(/ /g, '.')` matches U+0020 SPACE only. It does NOT match:
- U+00A0 NO-BREAK SPACE
- U+2009 THIN SPACE
- U+202F NARROW NO-BREAK SPACE
- U+3000 IDEOGRAPHIC SPACE
- U+0009 TAB / U+000A LF / U+000D CR
- Other Unicode `\p{Zs}` category characters

This is **correct for the current use case** — `electron-builder`'s `productName` is `"Spine Texture Manager"` which contains only ASCII U+0020 — but it is brittle to future product-name changes (e.g., trademark localization, or a non-ASCII rebrand). The JSDoc at line 160-166 explicitly justifies the choice ("GitHub's rename is a deterministic 1:1 substitution per character") which is correct for ASCII space; whether GitHub also normalizes other Unicode whitespace forms identically is unverified by this change set.

**Fix (optional, Plan 15-05+):** Add a guard or expand the rationale. One option: assert in the helper (or a sibling test) that `localFilename` contains no `[\s ]` *other than* U+0020, failing loudly at synthesizer time if a future productName change introduces exotic whitespace. Trivial:

```js
function sanitizeAssetUrl(localFilename) {
  // Defensive: GitHub's rename behavior is empirically verified for U+0020
  // only. Other Unicode whitespace would silently pass through and re-introduce
  // the 3-name mismatch class. Guard surfaces the inconsistency at synth time.
  if (/[^\S  ]| /.test(localFilename)) {
    throw new Error(`sanitizeAssetUrl: filename contains non-U+0020 whitespace: ${JSON.stringify(localFilename)}. GitHub rename behavior is only verified for ASCII space.`);
  }
  return localFilename.replace(/ /g, '.');
}
```

Status: Recommended for v1.2+ hardening. Not blocking v1.1.3.

### IN-06: `sanitizeAssetUrl()` has no defense against null/undefined/non-string input

**File:** `scripts/emit-latest-yml.mjs:175-177`
**Issue:** `localFilename.replace(...)` throws `TypeError: Cannot read properties of null/undefined (reading 'replace')` if `localFilename` is null or undefined. It throws `TypeError: localFilename.replace is not a function` if it's a number/object/array. The caller chain — `findInstallers()` returns `string[]` from `readdirSync()`, mapped via `installerNames.map((name) => …)` — guarantees `name` is always a non-empty string. So the guard is unreachable in practice.

This is **acceptable** given the internal-only use; flagged for completeness because the JSDoc declares `@param {string}` but does not assert it, and a future refactor that exposes the helper to a different code path (e.g., a CLI entry) could surface the gap.

**Fix (optional):** None required. If exposing the helper externally in the future, add `if (typeof localFilename !== 'string') throw new TypeError(...)`.

### IN-07: Test fixture `Multi  Space  Name` is not exercised by the universal regex assertion

**File:** `tests/integration/emit-latest-yml.spec.ts:447-470`
**Issue:** The "universal regex invariant" test at line 447 iterates `[macOutputYamlPath, winOutputYamlPath, linuxOutputYamlPath]` — the three "real productName" fixtures. The multi-space negative-test fixture (`multiSpaceOutputYamlPath`) is NOT in this iteration. So the universal regex `^[A-Za-z0-9.+/_=-]+\.(zip|dmg|exe|AppImage)$` is NEVER applied to the `Multi..Space..Name-9.9.9-arm64.zip` output (which would still pass — `+` quantifier allows consecutive dots — but that's never confirmed).

This is fine for D-15-LIVE-1's regression scope (the multi-space test enforces 1:1-ness, the regex test enforces shape; they're orthogonal). Surface it because a maintainer skimming the regex test might assume "every emit goes through this gate" — and it doesn't.

**Fix (optional):** Either add `multiSpaceOutputYamlPath` to the `allYamls` array in the universal regex test (would still pass; locks behavior universally), or add an explicit comment noting the multi-space fixture is intentionally exempt because it tests the helper's transformation contract, not the output shape contract.

### IN-08: `tests/integration/build-scripts.spec.ts:80` hardcodes `'1.1.3'` — coupling test maintenance to every release

**File:** `tests/integration/build-scripts.spec.ts:78-81`
**Issue:** The assertion `expect(pkg.version).toBe('1.1.3')` was bumped from `'1.1.2'` (commit `95b76eb`, Plan 15-06) and was previously bumped from `'1.1.1'` to `'1.1.2'` in Plan 15-01. This is the SECOND coupling between a release-engineering version-bump and a test-update; it will be the THIRD on v1.1.4, the FOURTH on v1.1.5, and so on. Every future hotfix or feature release must include this 1-line spec edit or CI will fail.

The assertion's intent is unclear: it does not catch a real defect (the `tag-version-guard` in `release.yml:43-54` already enforces `TAG_VERSION === PKG_VERSION`). It also cannot detect a "stale package.json" bug because the `pkg.version` read is from the same `package.json` that any developer would be editing. So the assertion is purely a tautology — it asserts that the version assertion matches the version field. It adds no defensive value beyond the tag-version-guard.

**Fix (recommended for follow-up, NOT a blocker for v1.1.3):** Either:
1. **Remove the assertion entirely** — the `tag-version-guard` in `.github/workflows/release.yml` is the load-bearing check; the spec assertion is redundant.
2. **Replace with a structural check** that does NOT pin a literal version, e.g.:
   ```ts
   test('package.json version is a valid semver', () => {
     const pkg = JSON.parse(read('package.json'));
     expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/);
   });
   ```
   This catches `version: "TBD"` / `version: undefined` / typos without coupling to the current version literal.
3. Document the assertion as intentional and make the bump-in-lockstep coupling explicit (e.g., move it into the version-bump runbook checklist).

Process gap: Plan 15-01 bumped the version to 1.1.2 and updated this assertion in lockstep; Plan 15-06 had to do the same again. Each future version-bump plan inherits this coupling. A structural fix here removes the recurring maintenance burden.

### IN-09: `Multi  Space  Name` fixture's package.json declares `version: '9.9.9-test'` but the fixture filename embeds `9.9.9` (without `-test`)

**File:** `tests/integration/emit-latest-yml.spec.ts:486-490`
**Issue:** The temp `package.json` written at line 488-491 declares `version: '9.9.9-test'`. The fixture installer filenames at line 486-487 are `Multi  Space  Name-9.9.9-arm64.dmg/.zip` (versioning embeds `9.9.9`, not `9.9.9-test`). The synthesizer reads `pkg.version` from the temp package.json and writes it to the YAML's top-level `version` field, which then mismatches the version embedded in the file URLs.

This **does not affect any assertion** in Plan 15-05's tests because the assertions only check `files[].url` and `doc.path`, not the relationship between `doc.version` and the URL's embedded version. Real production builds DO have `pkg.version` (e.g., `1.1.3`) match the version embedded in the filename (`...-1.1.3-arm64.zip`). So the fixture is a structurally valid test for the URL-rewrite contract but is internally inconsistent in a way real builds aren't.

**Fix (optional):** Either (a) align the package.json version literal to `'9.9.9'` (drop `-test`) for this fixture only, or (b) align the filenames to embed `9.9.9-test`. Functionally cosmetic; flag because it's a small but real surprise for a maintainer cross-referencing the fixture.

### IN-10: 4 `beforeAll` hooks in the same `describe` block silently order-coupled by vitest registration order

**File:** `tests/integration/emit-latest-yml.spec.ts:329, 383, 417, 478`
**Issue:** The `Phase 15 Plan 05` describe block has 4 separate `beforeAll` hooks (one per fixture: mac, win, linux, multi-space) and 4 separate `afterAll` hooks. Vitest runs `beforeAll` hooks in registration order (top-down), and each hook spawns a synthesizer subprocess + writes a temp dir. This works correctly today but has 3 subtle implications:

1. If any one `beforeAll` throws (e.g., `execFileSync` failure on a CI runner with a broken Node binary), all subsequent tests in the describe fail with cryptic "fixture not found" errors rather than a clear synth-failure error.
2. The 4 hooks share no setup state (each scopes its own `tempDir`) so they're independent; the arrangement is purely organizational. A future refactor could split the describe into 4 sub-describes (one per platform) with cleaner failure isolation.
3. The 4 hooks each spawn a synthesizer subprocess sequentially — this adds ~4 × N ms to test startup. Not a perf concern at v=4 but noteworthy.

**Fix (optional):** Refactor into 4 nested `describe` blocks, each with its own setup/teardown — improves failure-isolation and matches the existing pattern (see "Phase 15 D-04 — dual-installer mac case" describe at line 186). Not a v1.1.3 blocker.

### IN-11: JSDoc `@returns` description in `sanitizeAssetUrl` does not specify what happens to non-space characters

**File:** `scripts/emit-latest-yml.mjs:173`
**Issue:** The JSDoc `@returns` line says `GitHub-canonical form (spaces replaced with dots; all other chars preserved)`. The "all other chars preserved" clause is true but glosses over a subtle case: the helper does NOT validate that the input does not already contain dots in unexpected positions (e.g., `Spine.Texture.Manager-1.1.3-arm64.zip` as an input — already canonicalized — would idempotently return the same string, which is correct, but the JSDoc doesn't make idempotence explicit).

**Fix (optional):** Add one more line to the JSDoc:

```
 * Idempotent: an already-canonical filename (no spaces) is returned unchanged.
```

This is genuinely useful documentation because a maintainer might wonder "what if upstream pre-canonicalizes" — the answer is "no harm done."

---

### Notes on the supplement's threat-model and out-of-scope concerns

**Threat model coverage (Plan 15-05 §<threat_model>):**
- T-15-05-01 (Tampering, deterministic 1:1 helper): Implementation matches design verbatim; vitest gate locks it. ✓
- T-15-05-02 (Information disclosure, sha512+size from local file): Implementation reads bytes from `p = join(RELEASE_DIR, name)` — local spaced filename — at lines 197-198, intrinsic to file content; correct. ✓
- T-15-05-03 (DoS via CI, 3-OS test matrix): The new describe block is part of the existing vitest suite which runs on `ubuntu-latest`/`windows-2022`/`macos-14` per release.yml. ✓
- T-15-05-04 (Elevation, npm version side-effects): Verified post-hoc the version bump touched only `package.json` + `package-lock.json` (commit `95b76eb` and earlier). ✓

**Threat-model gap (informational, NOT a finding):** The model does not address the *forward-compat* concern flagged in the prompt's Review Focus #5: if `electron-builder` or its productName template ever changes its space-substitution rules, `sanitizeAssetUrl()` would silently emit the wrong URL. The no-spaces invariant test catches the case where spaces leak through; it does NOT catch the case where electron-builder changes to *another* character (e.g., underscore) and the helper becomes a no-op. This is genuinely informational — the only mitigation is the live UAT Test 7 path, which is in place and verified. No action.

**Test coverage gaps NOT flagged as findings (because out-of-realistic-scope):**
- Empty string input: `''.replace(/ /g, '.') === ''` — trivially correct.
- URL-special chars (`#`, `?`, `&`, `+`): Not in productName "Spine Texture Manager"; the universal regex `[A-Za-z0-9.+/_=-]` permits `+`, `/`, `_`, `=`, `-` but NOT `#`/`?`/`&`/`%`/parens — so future productName changes containing those would fail the universal regex assertion at line 456. This is a defense-in-depth gate, not a gap.
- Very long filenames: No length-dependent logic; not exercised.
- Path-separator-looking chars (`/` or `\`): The universal regex *does* permit `/` (matches `[A-Za-z0-9.+/_=-]`). If a future productName contained a literal `/`, it would slip through. This is a real defense gap, but extremely contrived (electron-builder's `sanitize-filename` strips `/` before substitution, per the Plan 15-05 objective's Option B analysis). Not flagging.

**Plan 15-06 code-side surface:** The 1-line bump of `pkg.version` assertion is the only code change; flagged in IN-08 above. Plan 15-06 is otherwise pure release-engineering (tag, push, publish, retry-Test-7) which has no code-review surface.

**JSDoc quality:** The 35-line JSDoc on `sanitizeAssetUrl()` is genuinely excellent — it documents the WHY (3-name mismatch with concrete examples), the WHY-NOT (alternative transformations like `\s+` collapse, encodeURIComponent, NFD normalize), and the invariants (sha512+size compute path unchanged). Future maintainers will understand the load-bearing nature of this helper without needing to re-read Plan 15-05. No findings.

**Inline call-site comment:** Lines 193-195 explain the dot-rewrite at the assignment with a pointer to D-15-LIVE-1. Good. No findings.

---

_Supplement reviewed: 2026-04-29T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Supplement scope: Plans 15-05 (sanitizeAssetUrl + tests) + 15-06 (version-bump test assertion)_
