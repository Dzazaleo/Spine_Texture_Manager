---
phase: 10-installer-build-electron-builder-all-3-platforms
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - build/.gitkeep
  - electron-builder.yml
  - package.json
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 10 introduces electron-builder configuration for the three target platforms
(macOS DMG ad-hoc signed, Windows NSIS unsigned, Linux AppImage), bumps the
package to `1.1.0-rc1`, and adds per-platform `build:*` npm scripts. All three
files are configuration; no executable source was added or modified.

The macOS smoke-test log
(`10-mac-assertions.log`) confirms the produced `.dmg` is ad-hoc signed
(`Signature=adhoc`), the version is correctly embedded in `Info.plist`
(`CFBundleShortVersionString = 1.1.0-rc1`), and `sharp` + `sharp-libvips-darwin-arm64`
are present under `app.asar.unpacked/` — so the `asarUnpack` globs are
empirically correct on the only platform that has been built so far.

No critical security issues, no command-injection patterns, no hardcoded secrets,
and no signing/identity misconfiguration. The two warnings cover platform-coverage
risks that have not yet been exercised (Windows / Linux smoke-tests are deferred to
Phase 11 CI). Info items are minor consistency/hygiene observations.

`build/.gitkeep` is a 0-byte sentinel as expected — nothing to flag.

## Warnings

### WR-01: `asarUnpack` for sharp on Windows/Linux is unverified — native binary path differs per platform

**File:** `electron-builder.yml:36-39`
**Issue:**
The unpack globs are:
```yaml
asarUnpack:
  - resources/**
  - "**/node_modules/sharp/**/*"
  - "**/node_modules/@img/**/*"
```
These were verified on macOS arm64 (the assertions log shows `sharp-darwin-arm64`
and `sharp-libvips-darwin-arm64` correctly unpacked). On other platforms the
prebuilt binary packages are different siblings under `@img/`:

- Windows x64: `@img/sharp-win32-x64` + `@img/sharp-libvips-win32-x64`
- Linux x64 (glibc): `@img/sharp-linux-x64` + `@img/sharp-libvips-linux-x64`
- Linux x64 (musl/AppImage on some hosts): `@img/sharp-linuxmusl-x64`

The wildcard `**/node_modules/@img/**/*` *should* catch all of these, but it has
not been observed end-to-end on Win/Linux yet (Phase 11 CI scope). If sharp is
imported with `require('sharp')` from inside `app.asar`, an unpack miss surfaces
at runtime as `Could not load the "sharp" module using the … runtime` — which is
silent until the user clicks Optimize Assets.

Additionally, the `resources/**` entry references a directory that does not
currently exist in the repo (verified: `ls resources/` -> No such file or directory).
This is harmless (electron-builder simply matches nothing) but it is also
non-load-bearing and could be removed or documented as a forward-looking hook.

**Fix:**
Either (a) add a Phase 11 CI assertion that grep-checks
`app.asar.unpacked/node_modules/@img/sharp-${platform}-${arch}/` exists for each
target, or (b) tighten the unpack glob to be explicit so a missing prebuild
fails the *build* rather than runtime:
```yaml
asarUnpack:
  - "**/node_modules/sharp/**/*"
  - "**/node_modules/@img/sharp-*/**/*"
  - "**/node_modules/@img/sharp-libvips-*/**/*"
```
(Drop the unused `resources/**` until Phase 12 actually writes there, or add a
`resources/.gitkeep` so the entry has a real target.)

### WR-02: `linux.target.AppImage` will not produce glibc + musl variants

**File:** `electron-builder.yml:70-75`
**Issue:**
```yaml
linux:
  target:
    - target: AppImage
      arch: x64
```
`AppImage` on a glibc host will bundle the glibc-linked sharp prebuild. Users on
Alpine/musl distros will get the "GLIBC_2.XX not found" error. This is
acceptable per the plan (CI is canonical and best-effort), but the failure mode
is silent — the AppImage launches and only crashes when sharp is first
required. Worth either:

1. documenting the glibc-only contract in a `RELEASE_NOTES.md` for v1.1, or
2. adding `--platform=linux --arch=x64` matrix entries in Phase 11 that explicitly
   target `linux-x64-glibc` so musl users get a clear "unsupported" message
   instead of a stack trace.

**Fix:**
Add a comment in `electron-builder.yml` next to the linux block, e.g.
```yaml
# AppImage uses glibc-linked sharp prebuilds; musl distros (Alpine) are
# unsupported in v1.1. Track in Phase 11 CI matrix.
linux:
  target:
    - target: AppImage
      arch: x64
```
No code change required if the limitation is documented elsewhere — flagging
because the current config gives no hint that this is a known constraint.

## Info

### IN-01: `dependencies` whitelist excludes `sharp` from `files` filter implicitly — confirm intent

**File:** `electron-builder.yml:17-34`
**Issue:**
The `files` block whitelists `out/**` and `package.json` and explicitly excludes
source/test/fixture trees. By default electron-builder also packs `node_modules/`
for runtime `dependencies` (not `devDependencies`). That is exactly what is
wanted here (sharp is a runtime dep at `package.json:30`), and the `asarUnpack`
globs presuppose that node_modules is packed. Just calling out that the
config relies on electron-builder's *implicit* `node_modules/**` inclusion —
there is no explicit `- node_modules/**` line. This is the documented default,
but a reader might assume the whitelist is exhaustive.

**Fix:**
Optionally add a comment near `files:` explaining that `node_modules/**` is
included by default and that the `!devDependencies` filter is automatic, e.g.
```yaml
# NOTE: electron-builder includes runtime `dependencies` from node_modules
# automatically; only the explicit !patterns below override that default.
files:
  - out/**
  ...
```

### IN-02: `${productName}` contains a space — verify all artifact paths quote-safely

**File:** `electron-builder.yml:50,53,61,67,75,78`
**Issue:**
`productName: Spine Texture Manager` produces artifact filenames such as
`Spine Texture Manager-1.1.0-rc1-arm64.dmg`. The mac assertions log confirms
this works: `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg`. But any
downstream Phase 11 CI step that consumes the artifact via `cp`, `rsync`, or
`gh release upload` must double-quote the path or the space will split it into
three arguments. Not a defect in this config, but a tripwire for the next phase.

**Fix:**
When wiring CI in Phase 11, prefer `--glob 'release/*.dmg'` style matchers, or
rename to `artifactName: SpineTextureManager-${version}-${arch}.${ext}` (uses
`name` field, not `productName`) so the on-disk filename has no spaces while
the user-facing `productName` keeps its spaced form. This is a deferred concern,
not an issue with the current file.

### IN-03: `version: 1.1.0-rc1` is valid semver but `electron-updater` parses pre-release tags strictly

**File:** `package.json:3`
**Issue:**
`1.1.0-rc1` is a valid SemVer 2.0 pre-release. Phase 12 (UPD-01..UPD-06) will
add `electron-updater`, which uses `semver.prerelease()` to gate channel
matching. `rc1` (without a dot) is parsed as the pre-release identifier `["rc1"]`,
which is fine, but the more conventional form is `1.1.0-rc.1` (dot-separated)
so the numeric `1` is treated as numeric and sorts correctly against future
`rc.2`, `rc.10`, etc. With `rc1` vs `rc2`, lexicographic ordering still works
for one digit, but `rc10` would sort before `rc2`.

**Fix:**
For the next pre-release, prefer `1.1.0-rc.1` → `1.1.0-rc.2` → `1.1.0-rc.10`
so SemVer's numeric pre-release ordering applies. No change required for the
current build — it ships, signs, and embeds correctly.

### IN-04: `build:dry` is mac-only — script name doesn't reflect that

**File:** `package.json:20`
**Issue:**
```json
"build:dry": "electron-vite build && electron-builder --mac dmg --dir"
```
`--dir` produces an unpacked app directory without packaging. The `--mac` flag
makes this script fail or no-op on Windows/Linux dev machines. The name
`build:dry` reads as platform-agnostic.

**Fix:**
Rename for clarity, e.g.
```json
"build:dry:mac": "electron-vite build && electron-builder --mac dmg --dir"
```
or drop the platform flag and let electron-builder pick the host platform:
```json
"build:dry": "electron-vite build && electron-builder --dir"
```
The latter matches dev intent (smoke-test the bundle on whatever you're on)
and avoids confusion when the CI matrix expands.

### IN-05: No `nsis.publisherName` / `nsis.shortcutName` set — installer UX uses defaults

**File:** `electron-builder.yml:63-67`
**Issue:**
```yaml
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  artifactName: ${productName}-${version}-${arch}.${ext}
```
Without `publisherName`, Windows SmartScreen will show "Unknown publisher"
(expected for an unsigned installer, called out in DIST-05). Without
`shortcutName`, the Start Menu entry uses `productName` verbatim, including the
space. Neither is a defect; both are quality-of-life that could be tuned now.

**Fix:**
Optional addition for v1.1 polish:
```yaml
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  shortcutName: Spine Texture Manager
  publisherName: Spine Texture Manager
  artifactName: ${productName}-${version}-${arch}.${ext}
```
Defer to Phase 11 if Windows smoke-test is also deferred.

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
