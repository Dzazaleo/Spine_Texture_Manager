---
phase: 11-ci-release-pipeline-github-actions-draft-release
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .github/workflows/release.yml
  - .github/release-template.md
  - package.json
  - electron-builder.yml
  - tests/main/sampler-worker-girl.spec.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found (no blockers — 3 warnings, 5 info; pipeline is live-verified green)

## Summary

Reviewed all five files comprising Phase 11's CI release pipeline: the GitHub Actions workflow (`release.yml`), the envsubst-rendered release-notes template (`release-template.md`), `package.json` build-script changes, the `electron-builder.yml` `publish: null` patch, and the CI-skip patch on `sampler-worker-girl.spec.ts`.

The pipeline is structurally sound. The atomicity-by-construction design (publish job depends on all three platform builds + every artifact upload uses `if-no-files-found: error` + `fail_on_unmatched_files: true`) is correctly implemented. Token scope is tight (`contents: write` only). All five third-party actions are SHA-pinned with version annotations on first use. The two main injection surfaces I checked (envsubst on `github.ref_name`, and the bash tag-vs-version gate) are safe given Git refname constraints and proper quoting.

**No critical issues.** The warnings are quality/robustness improvements: an `envsubst` allowlist to prevent future template-edit foot-guns, a small `concurrency` semantics note, and a Node version-floor mismatch between local (`>=18`) and CI (pinned to 22). The five info items are minor hygiene — redundant `--publish never` flags, a missing `--publish never` on `build:dry`, inconsistent SHA-version comments, an `ubuntu-latest`/`ubuntu-22.04` asymmetry worth documenting, and a hardcoded asset-name example in the template that could drift from `electron-builder.yml`'s `artifactName`.

The `tests/main/sampler-worker-girl.spec.ts` skip patch and the `electron-builder.yml` `publish: null` patch are both excellent — well-commented, correctly scoped, with forward-references to future phases.

## Warnings

### WR-01: `envsubst` runs without a variable allowlist; future template edits could leak runner env

**File:** `.github/workflows/release.yml:136`
**Issue:** The render step is `envsubst < .github/release-template.md > release-body.md` with no positional allowlist. `envsubst` substitutes *every* `${NAME}` reference in the template whose name matches any env var in scope. The Actions runner exports dozens (`HOME`, `USER`, `PATH`, `RUNNER_OS`, `RUNNER_TEMP`, `GITHUB_*`, `CI`, …). Today's template is clean, but if a future maintainer puts a literal `${HOME}` or `${PATH}` in release notes (e.g., as a documentation example), it will be silently expanded and leak runner-internal paths into the published release body. The fix is one line and removes the foot-gun permanently.

**Fix:**
```yaml
- name: Render release body from template
  env:
    VERSION: ${{ github.ref_name }}
    TAG: ${{ github.ref_name }}
    INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/README.md
  run: envsubst '${VERSION} ${TAG} ${INSTALL_DOC_LINK}' < .github/release-template.md > release-body.md
```
The single-quoted positional argument restricts substitution to exactly those three names; every other `${...}` in the template is preserved as a literal.

### WR-02: `concurrency` group keyed on ref allows parallel runs across different tags

**File:** `.github/workflows/release.yml:20-22`
**Issue:** `concurrency.group: release-${{ github.ref }}` produces a different group per tag, so back-to-back tag pushes (e.g., `v1.1.0-rc1` then `v1.1.0-rc2` 30 s later) execute fully in parallel rather than serializing. Combined with `cancel-in-progress: false`, that's intentional — but if someone *retags the same version* (delete + repush), the second run can race the first; `softprops/action-gh-release` defaults to updating an existing release, so the first run's draft body and assets could be overwritten mid-flight by the second. Releases are rare and deliberate, so the practical risk is low; flagging for awareness.

**Fix:** If serializing all releases is preferred, key the group on workflow + event:
```yaml
concurrency:
  group: release-${{ github.workflow }}-${{ github.event_name }}
  cancel-in-progress: false
```
Otherwise, document the current semantics inline ("releases on different tags are intentionally parallel; do not retag the same version").

### WR-03: `engines.node: ">=18"` is looser than CI's pinned Node 22 — local builds may diverge

**File:** `package.json:52-54` vs `.github/workflows/release.yml:34, 60, 80, 100`
**Issue:** All four CI jobs pin `node-version: 22`, but `engines.node: ">=18"` lets a contributor on Node 18 or 20 produce a locally different bundle. `sharp` ships per-Node-major prebuilt binaries; ABI mismatches between local and CI Node versions can silently degrade or crash native paths. Electron 41 bundles its own Node runtime, so this affects local-build reproducibility, not the shipped artifact's Node — but reproducibility itself is a CI guarantee worth defending.

**Fix:** Tighten the engines floor to match CI:
```json
"engines": {
  "node": ">=22"
}
```
And/or add an `.nvmrc` file containing `22` so contributors who use nvm/fnm/volta auto-switch to the CI version.

## Info

### IN-01: Workflow's `-- --publish never` flags are redundant with package.json scripts

**File:** `package.json:17-19` and `.github/workflows/release.yml:64, 85, 104`
**Issue:** Commit 69c8cc1 baked `--publish never` into `build:mac`/`build:win`/`build:linux` as the Pitfall 2 defense. The workflow then re-passes `-- --publish never` on top. electron-builder accepts the duplicate without error, but the redundancy is a stale layering artifact and can confuse future readers about which is authoritative.

**Fix:** Either drop `-- --publish never` from the three workflow `run:` lines (script-level baking is the canonical defense per the commit message), or add a one-line comment to the workflow explaining the belt-and-braces intent.

### IN-02: `build:dry` is the only build script missing `--publish never`

**File:** `package.json:20`
**Issue:** `"build:dry": "electron-vite build && electron-builder --mac dmg --dir"` is the only build script without baked `--publish never`. With `electron-builder.yml` now setting `publish: null`, the publisher auto-detect is blocked at the config layer, so this is currently safe. But if Phase 12 swaps `publish: null` for a real provider as the file's own L15 comment promises, `build:dry` will start attempting to publish. `--dir` skips packaging so the practical impact is small, but consistency is cheap.

**Fix:**
```json
"build:dry": "electron-vite build && electron-builder --mac dmg --dir --publish never"
```

### IN-03: SHA pinning version comments inconsistent on action re-uses

**File:** `.github/workflows/release.yml:31, 57, 78, 97, 119` (and similar for setup-node, upload-artifact)
**Issue:** L31 carries `# v4.3.1`; L57, 78, 97, 119 reuse the same `actions/checkout` SHA without the version comment. Same pattern for `actions/setup-node` and `actions/upload-artifact`. Not a bug — but when bumping a pinned SHA, future-you has to grep all reuse sites and remember they should move together. Cosmetic but easy to fix.

**Fix:** Either annotate every occurrence, or add a workflow-header note: "version comments appear on the first use of each action; all reuses match the same SHA and version."

### IN-04: `ubuntu-latest` (test, publish) vs pinned `ubuntu-22.04` (build-linux) is an undocumented asymmetry

**File:** `.github/workflows/release.yml:29, 95, 114`
**Issue:** The header comment (L4-7) explains why `build-linux` is pinned (GLIBC compat with electron-builder's AppImage toolset). The `test` and `publish` jobs deliberately ride `ubuntu-latest` — which is correct policy ("track upstream upgrades deliberately" per L4) — but the asymmetry isn't restated near the `runs-on:` lines themselves, so a future maintainer might "normalize" them all to `ubuntu-latest` without realizing why `build-linux` is pinned, or vice versa.

**Fix:** Optional one-line `# pinned: see header re GLIBC` next to the `build-linux` `runs-on:` line. No code change otherwise.

### IN-05: `release-template.md` chmod example hardcodes the AppImage filename

**File:** `.github/release-template.md:21`
**Issue:** Template line 21 contains `chmod +x "Spine Texture Manager-${VERSION}-x86_64.AppImage"` as a literal example. The real AppImage name is rendered from `artifactName: ${productName}-${version}-${arch}.${ext}` in `electron-builder.yml` (L83/86) — today they align (`productName: Spine Texture Manager`, `arch=x86_64` for `x64` AppImage), but if anyone renames `productName` or changes `artifactName`, the published install instructions will lie to users. The drift is cosmetic but customer-facing.

**Fix:** Either link to the actual attached AppImage asset rather than naming it, or add a brief comment in `electron-builder.yml` near the `artifactName` line: `# also referenced literally in .github/release-template.md L21 — keep in sync`.

---

## Positive notes (not findings)

- `tests/main/sampler-worker-girl.spec.ts` skip patch is well-documented: L23-26 cite `.gitignore` L22 and explain why CI cannot run the test, with the canonical `it.skipIf(process.env.CI)` API. The 30 s timeout safety net (L61) and warm-up-discard pattern (L32-38) are preserved.
- `electron-builder.yml`'s `publish: null` patch carries an exemplary comment block (L10-16) — explains the failure mode prevented, forward-references Phase 12, and stays narrowly scoped.
- Tag-vs-`package.json`-version gate (release.yml L38-48) fails fast at the cheapest job before any platform build spins up.
- Atomicity-by-construction is correctly enforced: `if-no-files-found: error` on all 3 upload-artifacts + `fail_on_unmatched_files: true` on the release action + `needs: [build-mac, build-win, build-linux]` on publish.
- `prerelease: ${{ contains(github.ref_name, '-') }}` correctly distinguishes `v1.1.0-rc1` (prerelease) from `v1.1.0` (final) without extra tooling.
- All third-party actions SHA-pinned to 40-char commit hashes; supply-chain hygiene matches industry guidance.

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
