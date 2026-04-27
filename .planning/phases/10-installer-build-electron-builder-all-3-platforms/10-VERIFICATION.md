---
phase: 10-installer-build-electron-builder-all-3-platforms
verified: 2026-04-27T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
requirements_verified:
  - DIST-01
  - DIST-02
  - DIST-03
  - DIST-04
  - DIST-05
  - DIST-06
  - DIST-07
artifacts_verified:
  - path: package.json
    status: verified
  - path: build/.gitkeep
    status: verified
  - path: electron-builder.yml
    status: verified
  - path: .planning/phases/10-installer-build-electron-builder-all-3-platforms/10-SMOKE-TEST.md
    status: verified
  - path: .planning/phases/10-installer-build-electron-builder-all-3-platforms/10-mac-assertions.log
    status: verified
  - path: .planning/phases/10-installer-build-electron-builder-all-3-platforms/10-build-mac.log
    status: verified
  - path: release/Spine Texture Manager-1.1.0-rc1-arm64.dmg
    status: verified_on_disk_gitignored
  - path: release/mac-arm64/Spine Texture Manager.app
    status: verified_on_disk_gitignored
notes:
  - "Phase scope explicitly defers live Windows .exe + Linux .AppImage build to Phase 11 CI; static electron-builder.yml config completeness is the Phase 10 deliverable for those platforms (per ROADMAP success criterion 5 and verification context provided to verifier)."
  - "DIST-06 dynamic verified live by user against TWO fixtures (SIMPLE_TEST + Girl projects); both runs produced non-zero PNGs + .atlas with no error dialogs. Recorded in 10-SMOKE-TEST.md 'Last live macOS run' line and 10-03-SUMMARY.md."
  - "Sequoia 'Open Anyway' Gatekeeper bypass was not required on the user's dev host (likely prior trust / xattr already cleared). Informational, not a regression — bypass docs retained in 10-SMOKE-TEST.md for fresh-install testers and Phase 11 CI."
  - "release/ artifacts verified live on disk via test -f / codesign / plutil / ls (gitignored is correct — they are evidence, not committed content)."
---

# Phase 10: installer-build-electron-builder-all-3-platforms Verification Report

**Phase Goal:** User can produce a Windows `.exe`, macOS `.dmg`, and Linux `.AppImage` installer from a tagged checkout, with the bundled `sharp` native binary surviving packaging on every platform that the user can build locally (macOS + Windows; Linux is best-effort locally and verified by CI in Phase 11).

**Verified:** 2026-04-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run build:mac` produces a `.dmg` whose installed app launches, loads `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, and completes an Optimize Assets export to a non-zero output folder (proves sharp libvips bundled correctly). | VERIFIED | Live `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg` (124,317,884 bytes) + `release/mac-arm64/Spine Texture Manager.app` exist on disk; `10-build-mac.log` shows `npm run build:mac` exit 0; user-approved manual Optimize Assets smoke test against SIMPLE_TEST.json AND Girl-project fixture (verbatim user verdict in `10-03-SUMMARY.md`); both runs produced non-zero PNGs + .atlas with no error dialogs. |
| 2 | `npm run build:win` produces a Windows `.exe` (NSIS) — Windows live verification deferred to Phase 11 CI. | VERIFIED | `package.json#scripts.build:win` = `electron-vite build && electron-builder --win nsis` (correct command); `electron-builder.yml` has complete `win:` + `nsis:` blocks (target: nsis, arch: x64, oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true). Static config completeness is the Phase 10 deliverable for Windows per phase scope; live build deferred to Phase 11 CI Windows job (per ROADMAP success criterion 2 paraphrase). |
| 3 | macOS `.dmg` is signed ad-hoc (`codesign -dv` shows ad-hoc signature); Windows `.exe` is unsigned (locked by v1.1 scope). | VERIFIED | Live `codesign -dv "release/mac-arm64/Spine Texture Manager.app"` returns `Identifier=com.spine.texture-manager` + `Signature=adhoc` + `TeamIdentifier=not set` (DIST-04 anchor met). For Windows: `electron-builder.yml` contains zero occurrences of `certificateFile`, `certificateSubjectName`, `signingHashAlgorithms` (DIST-05 — absence of cert keys produces unsigned NSIS by construction). |
| 4 | Installer filenames + version string embedded in macOS Info.plist and Windows version resource match `package.json#version` exactly. | VERIFIED | `package.json#version = "1.1.0-rc1"`; live `plutil -p` on built `Info.plist` shows `CFBundleShortVersionString = "1.1.0-rc1"` AND `CFBundleVersion = "1.1.0-rc1"`; produced .dmg filename `Spine Texture Manager-1.1.0-rc1-arm64.dmg` matches the canonical `${productName}-${version}-${arch}.${ext}` template; all 6 `artifactName:` lines in `electron-builder.yml` use the same uniform template (mac, dmg, win, nsis, linux, appImage). Windows version resource will derive identically from the same `package.json#version` substitution at Phase 11 CI build time. |
| 5 | Linux `.AppImage` build is best-effort locally; Linux is verified by CI in Phase 11. The `electron-builder.yml` Linux target configuration is complete and committed. | VERIFIED | `electron-builder.yml` has complete `linux:` block (target: AppImage, arch: x64, category: Development) and matching top-level `appImage:` block with uniform `artifactName`. `package.json#scripts.build:linux` = `electron-vite build && electron-builder --linux AppImage`. Configuration committed (commit 7e3c248). Live Linux build explicitly deferred to Phase 11 CI per scope; ROADMAP success criterion 5 explicitly accepts this. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | version=1.1.0-rc1 + per-platform build scripts | VERIFIED | version exactly `1.1.0-rc1`; `build`, `build:mac`, `build:win`, `build:linux`, `build:dry` all present with correct command strings; dependencies/devDependencies/engines untouched per Plan 01. |
| `build/.gitkeep` | 0-byte sentinel so directories.buildResources resolves | VERIFIED | File exists, is 0 bytes (matches `scripts/.gitkeep` analog), tracked by git (`git ls-files build/.gitkeep` returns 1). |
| `electron-builder.yml` | complete 3-platform build config (mac ad-hoc, NSIS unsigned, AppImage Linux) | VERIFIED | All 12 required structural patterns present (identity:'-', hardenedRuntime:false, gatekeeperAssess:false, win:/nsis:/linux:/appImage: top-level blocks, NSIS oneClick/perMachine/allowToChangeInstallationDirectory, target:nsis, target:AppImage, category:Development, asarUnpack:); all 6 forbidden patterns absent (certificateFile, certificateSubjectName, signingHashAlgorithms, npmRebuild:false, publish:, identity:null); 6/6 artifactName lines uniform; YAML parses cleanly (79 lines, 2122 bytes). |
| `10-SMOKE-TEST.md` | per-platform smoke-test recipe document (≥80 lines) | VERIFIED | 128 lines (60% over threshold); macOS/Windows/Linux H2 sections each present; codesign references (2), Open Anyway references (2), libfuse2t64 references (2), SIMPLE_PROJECT references (2), Last live macOS run line (1) — all acceptance criteria met. |
| `10-mac-assertions.log` | live shell evidence on built .app (DIST-04/06/07) | VERIFIED | Contains `Signature=adhoc` (DIST-04), `CFBundleShortVersionString => "1.1.0-rc1"` (DIST-07), `sharp-darwin-arm64` + `sharp-libvips-darwin-arm64` (DIST-06 static), `Spine Texture Manager-1.1.0-rc1-arm64.dmg` (DIST-02 + DIST-07 filename anchor) — all 5 grep substring assertions green. |
| `10-build-mac.log` | full electron-builder build trace | VERIFIED | 44 lines; tail shows `building target=DMG arch=arm64 file=release/Spine Texture Manager-1.1.0-rc1-arm64.dmg` and `signing file=release/mac-arm64/Spine Texture Manager.app platform=darwin type=distribution identityName=- identityHash=none`. |
| `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg` | produced macOS installer | VERIFIED ON DISK (gitignored) | 124,317,884 bytes; filename matches `${productName}-${version}-${arch}.${ext}` template exactly. |
| `release/mac-arm64/Spine Texture Manager.app` | unpacked .app bundle | VERIFIED ON DISK (gitignored) | Directory present; `Info.plist` parseable; `app.asar.unpacked/node_modules/@img/` contains `sharp-darwin-arm64`, `sharp-libvips-darwin-arm64`, plus `colour` runtime subpkg. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `package.json#version` | electron-builder artifactName template `${version}` | electron-builder reads package.json at pack time | WIRED | Live evidence: produced .dmg name `Spine Texture Manager-1.1.0-rc1-arm64.dmg` and Info.plist `CFBundleShortVersionString = "1.1.0-rc1"` both reflect the version-bump verbatim. |
| `package.json#scripts` | electron-builder CLI | `npm run build:{platform}` invokes `electron-vite build && electron-builder --{flag}` | WIRED | `npm run build:mac` exit code 0 confirmed in `10-build-mac.log`; build-log shows electron-builder 26.8.1 was invoked with the YAML config and produced the expected artifacts. |
| `electron-builder.yml mac.identity: '-'` | produced .app codesign signature | electron-builder invokes codesign -s - | WIRED | Live `codesign -dv` returns `Signature=adhoc`; build log shows `signing ... identityName=- identityHash=none` confirming ad-hoc engaged. |
| `electron-builder.yml asarUnpack patterns` | `app.asar.unpacked/@img/`, `app.asar.unpacked/sharp/` | electron-builder pack stage extracts matched node_modules dirs out of .asar | WIRED | Live `ls` of `app.asar.unpacked/node_modules/@img/` shows `sharp-darwin-arm64` + `sharp-libvips-darwin-arm64` present; `app.asar.unpacked/node_modules/sharp/` contains LICENSE/install/lib/package.json/src. |
| `package.json#version (1.1.0-rc1)` | Info.plist `CFBundleShortVersionString` and Win VERSIONINFO `ProductVersion` | electron-builder reads package.json#version and writes platform-specific resources | WIRED | macOS verified live (plutil output). Windows VERSIONINFO is the same substitution path; live verification deferred to Phase 11 CI Windows job per phase scope. |

### Data-Flow Trace (Level 4)

Phase 10 produces configuration + build artifacts (no UI components rendering dynamic state). Level 4 traces are not applicable to YAML config / npm scripts / installer binaries. Behavioral spot-checks (Step 7b) cover the equivalent runtime evidence.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| package.json#version equals 1.1.0-rc1 | `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)"` | `1.1.0-rc1` | PASS |
| All 5 build scripts registered | `node -e "..."` (build, build:mac, build:win, build:linux, build:dry) | All 5 present | PASS |
| build/.gitkeep is 0-byte sentinel | `wc -c < build/.gitkeep` | `0` (matches scripts/.gitkeep) | PASS |
| electron-builder.yml has all required structural patterns | 12 grep checks (identity:'-', mac/win/nsis/linux/appImage blocks, NSIS keys, asarUnpack) | All 12 each grep-count = 1 | PASS |
| electron-builder.yml has zero forbidden patterns | 6 grep checks (certificateFile, certificateSubjectName, signingHashAlgorithms, npmRebuild:false, publish:, identity:null) | All 6 each grep-count = 0 | PASS |
| electron-builder.yml has 6 uniform artifactName lines | `grep -c '\${productName}-\${version}-\${arch}\.\${ext}' electron-builder.yml` | `6` | PASS |
| electron-builder.yml YAML parses without error | node read + line count | 79 lines, 2122 bytes, parses | PASS |
| Live .dmg exists and matches template filename | `test -f "release/Spine Texture Manager-1.1.0-rc1-arm64.dmg"` | exit 0 (124,317,884 bytes) | PASS |
| Live .app codesign signature is ad-hoc | `codesign -dv "release/mac-arm64/Spine Texture Manager.app"` | `Signature=adhoc` | PASS |
| Live Info.plist version matches package.json | `plutil -p` Info.plist | `CFBundleShortVersionString => "1.1.0-rc1"` and `CFBundleVersion => "1.1.0-rc1"` | PASS |
| Live app.asar.unpacked contains sharp + libvips | `ls app.asar.unpacked/node_modules/@img/` | `colour`, `sharp-darwin-arm64`, `sharp-libvips-darwin-arm64` | PASS |
| 10-SMOKE-TEST.md has substantive content | `wc -l 10-SMOKE-TEST.md` | `128` (≥ 80 threshold) | PASS |
| All 5 mac-assertion grep substrings present | `grep -q` × 5 (Signature=adhoc, 1.1.0-rc1, sharp-darwin-arm64, sharp-libvips-darwin-arm64, .dmg filename) | All 5 green | PASS |
| All 7 phase commits land in git log | `git log` filtered for phase-10 patterns | 10 commits found (covers 10-01, 10-02, 10-03, plus tracking + research) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DIST-01 | 10-02 | Build Windows `.exe` (NSIS) locally via npm script | SATISFIED | `package.json#scripts.build:win` is correct; `electron-builder.yml` has complete `win:` + `nsis:` blocks (target:nsis, arch:x64, oneClick:false, perMachine:false, allowToChangeInstallationDirectory:true). Live Windows build deferred to Phase 11 CI per phase scope (acceptable per ROADMAP and verification context). |
| DIST-02 | 10-02, 10-03 | Build macOS `.dmg` locally via npm script | SATISFIED | Live `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg` produced from `npm run build:mac` (exit code 0); 124 MB on disk; build log captured at `10-build-mac.log`. |
| DIST-03 | 10-02 | CI builds Linux `.AppImage` on tag pushes | SATISFIED | `electron-builder.yml` has complete `linux:` + `appImage:` blocks (target:AppImage, arch:x64, category:Development); `package.json#scripts.build:linux` is correct. Live Linux build is best-effort locally per Phase 10 scope; canonical AppImage production handed to Phase 11 CI Linux job. |
| DIST-04 | 10-02, 10-03 | macOS `.dmg` signed ad-hoc | SATISFIED | `electron-builder.yml` has `mac.identity: '-'` (single-quoted), `hardenedRuntime: false`, `gatekeeperAssess: false`. Live `codesign -dv` on the produced .app returns `Signature=adhoc`. |
| DIST-05 | 10-02 | Windows `.exe` is unsigned | SATISFIED | `electron-builder.yml` contains zero occurrences of `certificateFile`, `certificateSubjectName`, `signingHashAlgorithms`. Absence of cert keys produces unsigned NSIS by construction. Live `signtool verify` deferred to Phase 11 CI Windows job per phase scope. |
| DIST-06 | 10-02, 10-03 | Native dependencies (sharp libvips) bundled correctly; installed app can perform Optimize Assets export | SATISFIED | Static: `electron-builder.yml asarUnpack` retains both `**/node_modules/sharp/**/*` AND `**/node_modules/@img/**/*`; live `ls app.asar.unpacked/node_modules/@img/` shows `sharp-darwin-arm64` + `sharp-libvips-darwin-arm64`. Dynamic: user-approved manual Optimize Assets smoke against TWO fixtures (SIMPLE_TEST + Girl project); both produced non-zero PNGs + .atlas with no error dialogs (verbatim approval recorded in `10-03-SUMMARY.md` and `10-SMOKE-TEST.md` "Last live macOS run" line). |
| DIST-07 | 10-01, 10-02, 10-03 | Installer filenames + embedded version match `package.json#version` | SATISFIED | `package.json#version = "1.1.0-rc1"`; produced .dmg filename `Spine Texture Manager-1.1.0-rc1-arm64.dmg`; live Info.plist `CFBundleShortVersionString = "1.1.0-rc1"` AND `CFBundleVersion = "1.1.0-rc1"`; all 6 `artifactName:` lines in YAML use uniform `${productName}-${version}-${arch}.${ext}` template (substituted identically on Windows/Linux at CI build time). |

**No orphaned requirements.** All 7 DIST IDs declared in plan frontmatter (10-01: DIST-07; 10-02: DIST-01..DIST-07; 10-03: DIST-01..DIST-07) match REQUIREMENTS.md Phase 10 mapping verbatim.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | None detected. Code review (`10-REVIEW.md`) flagged 2 warnings + 5 info items, all forward-looking polish concerns (Windows/Linux smoke unverified — explicitly Phase 11 scope; glibc-only AppImage caveat; no `nsis.publisherName`; `build:dry` is mac-only; `1.1.0-rc1` vs `1.1.0-rc.1` semver pre-release dot convention). None are Phase 10 blockers. |

### Human Verification Required

**None.** DIST-06 dynamic verification was already performed live by the user against TWO fixtures (SIMPLE_TEST + Girl projects) on 2026-04-27 — verbatim approval recorded in `10-03-SUMMARY.md` and reflected in `10-SMOKE-TEST.md`'s "Last live macOS run" line. No additional human verification items remain for Phase 10. (Windows + Linux live smoke is explicitly deferred to Phase 11 CI per phase scope.)

### Gaps Summary

**No gaps.** All 5 ROADMAP success criteria verified; all 7 DIST requirements satisfied; all 8 expected artifacts exist on disk and pass structural + live-runtime checks.

The verification context provided to the verifier explicitly stated:

1. *"Phase scope explicitly defers Windows live build and Linux live build to Phase 11 CI. Do NOT mark Phase 10 as gaps_found just because no live Windows .exe or Linux .AppImage was produced. The static `electron-builder.yml` config completeness for those platforms IS the Phase 10 deliverable."* — Honored. Static config completeness verified for both Windows and Linux blocks (12/12 required patterns, 0/6 forbidden patterns).

2. *"DIST-06 dynamic verification IS required — it was performed live by the user (see `10-03-SUMMARY.md` and `10-SMOKE-TEST.md`'s 'Last live macOS run' line). User verified two fixtures (SIMPLE_TEST + Girl)."* — Honored. Two-fixture user approval explicitly verified; exceeds plan's single-fixture requirement.

3. *"The user reported the Sequoia 'Open Anyway' Gatekeeper bypass was not needed on their dev host — this is informational, not a regression."* — Honored. Captured in deviation note D-10-03-03 in `10-03-SUMMARY.md`; "Open Anyway" docs retained in `10-SMOKE-TEST.md` for fresh-install testers and Phase 11 CI / Phase 12 INSTALL.md.

4. *"`release/` artifacts are gitignored (correct). Verify presence via filesystem checks (`test -f`), not via git."* — Honored. `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg` (124 MB) and `release/mac-arm64/Spine Texture Manager.app` confirmed present via `test -f` / `ls` / `codesign` / `plutil` / `wc -c`.

Pre-existing test failure (`tests/main/sampler-worker-girl.spec.ts`) is documented in `deferred-items.md` as out of scope — verified pre-existing on the base commit `9948959` before any Phase 10 changes; owner is Phase-9 maintenance triage. Does not affect Phase 10 status.

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
