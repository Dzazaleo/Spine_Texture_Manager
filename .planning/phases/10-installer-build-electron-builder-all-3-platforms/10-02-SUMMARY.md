---
phase: 10
plan: 02
subsystem: build-config
tags:
  - electron-builder
  - macos
  - windows
  - linux
  - codesigning
requires:
  - 10-01  # version bump 1.1.0-rc1 + build/.gitkeep + per-platform npm scripts
provides:
  - electron-builder.yml-3-platform  # complete mac+win+linux target config
  - mac-adhoc-signing-locked  # mac.identity: '-' explicit
  - nsis-unsigned-config  # win: + nsis: blocks, no cert keys
  - appimage-config  # linux: + appImage: blocks
affects:
  - npm-run-build-mac  # now exercises identity:'-' + arm64 + hardenedRuntime:false
  - npm-run-build-win  # now has a target config to consume (NSIS x64)
  - npm-run-build-linux  # now has a target config to consume (AppImage x64)
  - phase-11-ci  # CI matrix can now invoke each platform; no further YAML edits expected for CI
  - phase-10-03  # smoke-test plan can now run electron-builder --dir on each platform
tech-stack:
  added: []
  patterns:
    - electron-builder ad-hoc macOS signing via single-quoted dash identity
    - electron-builder NSIS unsigned config (no certificateFile / certificateSubjectName / signingHashAlgorithms)
    - electron-builder Linux AppImage minimal config (target + freedesktop category)
    - uniform artifactName template across mac/dmg/win/nsis/linux/appImage
    - sharp 0.34+ asarUnpack patterns preserved (sharp/** AND @img/**)
key-files:
  created: []
  modified:
    - electron-builder.yml  # +35 / -4 lines vs v1.0; preserves all load-bearing v1.0 blocks verbatim
decisions:
  - id: D-10-02-01
    decision: macOS arm64 only (no universal binary, no x64 cross-compile)
    rationale: Orchestrator-locked decision per 10-RESEARCH.md ("macOS arm64 minimum"). Universal/x64 deferred to a future phase. arm64 covers Apple Silicon dev machines; v1.1 testers are assumed Apple Silicon.
  - id: D-10-02-02
    decision: Single-quoted '-' for mac.identity (NOT bare -, NOT null, NOT "")
    rationale: Bare YAML `-` is a list marker; `null` and `""` produce a fully unsigned .app (codesign reports "code object is not signed at all" instead of "Signature=adhoc"), failing DIST-04. The single-quoted form `'-'` is the canonical electron-builder ad-hoc value per RESEARCH.md Pattern 1.
  - id: D-10-02-03
    decision: NSIS perMachine:false (per-user install) + allowToChangeInstallationDirectory:true + oneClick:false
    rationale: Per-user install avoids UAC elevation prompts on Windows, reducing attack surface (T-10-11 mitigation). allowToChangeInstallationDirectory:true gives testers flexibility for sandboxed install paths. oneClick:false surfaces a real installer wizard (matches NSIS conventions for non-paid distributions).
  - id: D-10-02-04
    decision: linux.category=Development (freedesktop.org top-level)
    rationale: Spine Texture Manager is a developer/animator tool, not a game or media player. `Development` is the standard freedesktop.org category for this class. Surfaces correctly in GNOME/KDE app menus.
  - id: D-10-02-05
    decision: Refresh stale comment block (lines 5-7 in v1.0 said "macOS-only target in this phase")
    rationale: That comment was true in v1.0 but is misleading after Phase 10. Replaced with a v1.1 Phase 10 description naming each DIST requirement covered. Preserves intent (orient future readers) while updating facts.
  - id: D-10-02-06
    decision: Avoid the substrings "certificateFile", "certificateSubjectName", "signingHashAlgorithms", and "publish:" in comments
    rationale: Plan 10-02's `<verify>` regex check uses bare-substring forbid patterns (`/certificateFile/`, `/^publish:/m`). Comments mentioning those keys would trip the verifier even though they're documentation, not config. Comments now use paraphrased forms ("Windows code-signing keys", "release-channel block") that preserve readability without colliding with the forbid regex. See "Deviations" below.
metrics:
  duration_seconds: 280
  completed_at: "2026-04-27T10:55:00Z"
  tasks_completed: 1
  files_changed: 1
---

# Phase 10 Plan 02: Electron-Builder 3-Platform Config Summary

**One-liner:** Extended `electron-builder.yml` from a v1.0 mac-only DMG config into a complete 3-platform build spec — locked macOS ad-hoc signing via `identity: '-'`, added unsigned Windows NSIS x64 + Linux AppImage x64 target blocks, preserved every load-bearing v1.0 line (files allowlist, asarUnpack sharp+@img, appId/productName/copyright, directories) bit-for-bit.

## What was done

Single atomic edit to `electron-builder.yml`. The file grew from 48 lines / 47 SLOC to 79 lines / 75 SLOC. The diff is +35/-4 — net +31 lines, all additive except for one stale-comment refresh and a structural change to the existing `mac.target` (string-form `- dmg` → object-form `- target: dmg / arch: arm64`).

### Final electron-builder.yml (full text)

```yaml
appId: com.spine.texture-manager
productName: Spine Texture Manager
copyright: Copyright (C) 2026

# v1.1 Phase 10: ad-hoc macOS, unsigned NSIS, AppImage Linux.
# DIST-04: mac single-quoted dash identity locks ad-hoc signing (was implicit on Apple Silicon in v1.0).
# DIST-05: no Windows code-signing keys are present, so the NSIS installer is unsigned.
# No release-channel block — auto-update wiring is Phase 12 (UPD-01..UPD-06).

directories:
  output: release
  buildResources: build

# Whitelist: ship only the bundled output + package.json metadata.
# Explicitly EXCLUDE source, tests, fixtures, planning notes, scripts, and the
# user's Spine editor source files under temp/.
files:
  - out/**
  - package.json
  - "!src/**"
  - "!tsconfig*.json"
  - "!fixtures/**"
  - "!temp/**"
  - "!tests/**"
  - "!scripts/**"
  - "!.planning/**"
  - "!electron.vite.config.*"
  - "!vitest.config.*"
  - "!tailwind.config.*"
  - "!postcss.config.*"
  - "!*.md"
  - "!.gitignore"
  - "!.eslintrc*"
  - "!.prettierrc*"

asarUnpack:
  - resources/**
  - "**/node_modules/sharp/**/*"
  - "**/node_modules/@img/**/*"

# DIST-02, DIST-04: macOS arm64 .dmg, ad-hoc signed.
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
  identity: '-'
  hardenedRuntime: false
  gatekeeperAssess: false
  artifactName: ${productName}-${version}-${arch}.${ext}

dmg:
  artifactName: ${productName}-${version}-${arch}.${ext}

# DIST-01, DIST-05: Windows x64 NSIS, unsigned.
# Intentionally NO Windows code-signing keys ⇒ unsigned NSIS installer.
win:
  target:
    - target: nsis
      arch: x64
  artifactName: ${productName}-${version}-${arch}.${ext}

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  artifactName: ${productName}-${version}-${arch}.${ext}

# DIST-03: Linux x64 AppImage. Best-effort local build; CI is the canonical surface (Phase 11).
linux:
  target:
    - target: AppImage
      arch: x64
  category: Development
  artifactName: ${productName}-${version}-${arch}.${ext}

appImage:
  artifactName: ${productName}-${version}-${arch}.${ext}
```

### Exact diff vs v1.0 baseline

```diff
--- v1.0 electron-builder.yml (48 lines)
+++ v1.1 Phase 10 electron-builder.yml (79 lines)
@@ -5,7 +5,8 @@
-# D-04: unsigned build. No afterPack / publish / notarize keys.
-# D-02 + D-24: macOS-only target in this phase. Windows enablement is additive
-# (add a `win:` block in a later phase); deliberately omitted here.
+# v1.1 Phase 10: ad-hoc macOS, unsigned NSIS, AppImage Linux.
+# DIST-04: mac single-quoted dash identity locks ad-hoc signing (was implicit on Apple Silicon in v1.0).
+# DIST-05: no Windows code-signing keys are present, so the NSIS installer is unsigned.
+# No release-channel block — auto-update wiring is Phase 12 (UPD-01..UPD-06).
@@ -39,3 +41,4 @@
+# DIST-02, DIST-04: macOS arm64 .dmg, ad-hoc signed.
 mac:
   category: public.app-category.developer-tools
   target:
-    - dmg
+    - target: dmg
+      arch: arm64
+  identity: '-'
+  hardenedRuntime: false
+  gatekeeperAssess: false
   artifactName: ${productName}-${version}-${arch}.${ext}
@@ -46,0 +53,25 @@
+
+# DIST-01, DIST-05: Windows x64 NSIS, unsigned.
+# Intentionally NO Windows code-signing keys ⇒ unsigned NSIS installer.
+win:
+  target:
+    - target: nsis
+      arch: x64
+  artifactName: ${productName}-${version}-${arch}.${ext}
+
+nsis:
+  oneClick: false
+  perMachine: false
+  allowToChangeInstallationDirectory: true
+  artifactName: ${productName}-${version}-${arch}.${ext}
+
+# DIST-03: Linux x64 AppImage. Best-effort local build; CI is the canonical surface (Phase 11).
+linux:
+  target:
+    - target: AppImage
+      arch: x64
+  category: Development
+  artifactName: ${productName}-${version}-${arch}.${ext}
+
+appImage:
+  artifactName: ${productName}-${version}-${arch}.${ext}
```

## Confirmation of preserved load-bearing blocks

Bit-for-bit verbatim preservation of every v1.0 line called out in the plan as "DO NOT TOUCH":

| Block | v1.0 line(s) | v1.1 line(s) | State |
|-------|--------------|--------------|-------|
| `appId: com.spine.texture-manager` | L1 | L1 | preserved |
| `productName: Spine Texture Manager` | L2 | L2 | preserved |
| `copyright: Copyright (C) 2026` | L3 | L3 | preserved |
| `directories.output: release` | L10 | L11 | preserved |
| `directories.buildResources: build` | L11 | L12 | preserved (backed by Plan 01's `build/.gitkeep`) |
| `files:` allowlist (19 lines: 1 inclusion + 1 package.json + 17 exclusions) | L16-33 | L17-34 | preserved verbatim |
| `asarUnpack:` block including `resources/**`, `**/node_modules/sharp/**/*`, `**/node_modules/@img/**/*` | L35-38 | L36-39 | preserved verbatim — DIST-06 anchor |
| `dmg.artifactName: ${productName}-${version}-${arch}.${ext}` | L47 | L52-53 | preserved |

Note: line numbers shifted by +1 throughout because the old 3-line stale comment at L5-7 was replaced with a 4-line refreshed comment at L5-8.

## Verification results

All checks from the plan's `<verification>` section pass:

| Check | Result |
|-------|--------|
| `grep -c "identity: '-'" electron-builder.yml` | `1` (single occurrence, single-quoted) |
| `grep -c "hardenedRuntime: false"` | `1` |
| `grep -c "gatekeeperAssess: false"` | `1` |
| `grep -c "^win:"` / `"^nsis:"` / `"^linux:"` / `"^appImage:"` | each `1` (top-level blocks present) |
| `grep -c "target: nsis"` | `1` |
| `grep -c "target: AppImage"` | `1` |
| `grep -c "category: Development"` | `1` |
| `grep -c "oneClick: false"` / `"perMachine: false"` / `"allowToChangeInstallationDirectory: true"` | each `1` |
| artifactName template count | `6` (mac, dmg, win, nsis, linux, appImage — uniform per DIST-07) |
| `**/node_modules/sharp/**/*` and `**/node_modules/@img/**/*` patterns | each `1` (asarUnpack preserved — DIST-06) |
| `appId`, `productName`, `copyright` | each `1` (v1.0 metadata preserved) |
| `buildResources: build` | `1` |
| `!temp/**`, `!fixtures/**` exclusions | each `1` (security boundary preserved) |
| Anti-patterns: `identity: null`, `npmRebuild: false`, `publish:`, `certificateFile`, `certificateSubjectName`, `signingHashAlgorithms` | each `0` |
| Plan's `<verify>` JS regex check | `OK` (all must-have regexes match, all forbid regexes absent, artifactName count = 6) |
| `npx js-yaml electron-builder.yml` | exit 0 (parses cleanly) |
| `npx electron-builder --help` | exit 0 (CLI accessible) |
| `npm run typecheck` | passes (no regressions) |
| `npm run test` | 329 passing, 1 pre-existing failure unrelated to this plan (see Deferred Issues) |

## Requirements coverage

This plan completes the YAML side of all 7 DIST requirements (runtime verification of the produced installers is Plan 10-03's job):

| Requirement | How this plan addresses it |
|-------------|----------------------------|
| DIST-01 (Windows installer) | `win:` block with `target: nsis / arch: x64` + `nsis:` config block |
| DIST-02 (macOS installer) | `mac:` block with `target: dmg / arch: arm64` (preserved from v1.0, made explicit) |
| DIST-03 (Linux installer) | `linux:` block with `target: AppImage / arch: x64` + `appImage:` config block |
| DIST-04 (macOS ad-hoc signing locked) | `mac.identity: '-'` (single-quoted) + `hardenedRuntime: false` + `gatekeeperAssess: false` |
| DIST-05 (Windows unsigned) | No `certificateFile` / `certificateSubjectName` / `signingHashAlgorithms` keys anywhere |
| DIST-06 (sharp libvips bundled) | `asarUnpack` preserves both `**/node_modules/sharp/**/*` AND `**/node_modules/@img/**/*` |
| DIST-07 (uniform artifactName) | All 6 `artifactName` lines use the canonical `${productName}-${version}-${arch}.${ext}` template |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comment phrasing collided with plan's own `<verify>` regex**

- **Found during:** Task 1 verification step (running the plan's `<verify>` JS regex check)
- **Issue:** The plan's target YAML included three comment lines mentioning forbidden anti-pattern names verbatim:
  - L7: `# DIST-05: no win.certificateFile keys ⇒ unsigned NSIS.`
  - L56: `# NO certificateFile / certificateSubjectName / signingHashAlgorithms keys ⇒ unsigned.`
  - L8: `` # No `publish:` block — auto-update wiring is Phase 12 (UPD-01..UPD-06). ``
  The plan's automated `<verify>` block uses bare-substring forbid regexes (`/certificateFile/`, `/certificateSubjectName/`, `/signingHashAlgorithms/`, `/^publish:/m`) which trip on these comments even though they are documentation, not config keys. Result: the plan as authored was self-inconsistent — its target YAML failed its own verifier.
- **Fix:** Replaced the offending substrings in comments with paraphrased equivalents that preserve documentation intent without colliding with the forbid regex:
  - L7: `# DIST-05: no Windows code-signing keys are present, so the NSIS installer is unsigned.`
  - L56: `# Intentionally NO Windows code-signing keys ⇒ unsigned NSIS installer.`
  - L8: `# No release-channel block — auto-update wiring is Phase 12 (UPD-01..UPD-06).`
  Future readers still see the same documentation; the verifier no longer trips on the words.
- **Files modified:** `electron-builder.yml`
- **Commit:** `7e3c248` (single Task 1 commit; the paraphrasing was applied before the commit landed, so it is part of the same atomic change)

This is a Rule 3 auto-fix (blocking issue: the literal plan target couldn't pass its own verifier and would have blocked Plan 10-03's prerequisite check). No behavioral change to the produced installers — comments are stripped during electron-builder parsing.

### Architectural Changes

None.

### Authentication Gates

None.

## Deferred Issues

**Pre-existing test failure (out of scope per executor SCOPE BOUNDARY rule):**

- `tests/main/sampler-worker-girl.spec.ts > sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl) > fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms` fails with `warm-up run must complete (not error/cancel): expected 'error' to be 'complete'`.
- Confirmed pre-existing by running `npm run test` on the unchanged base commit `9948959` (same 1/333 result before any Plan 10-02 changes).
- Plan 10-02 only modifies `electron-builder.yml`. The failing test exercises Phase 9 worker_threads sampler logic on `fixtures/Girl/` — entirely unrelated to electron-builder configuration.
- Logged in `.planning/phases/10-installer-build-electron-builder-all-3-platforms/deferred-items.md`.
- Owner: Phase-9 maintenance / pre-existing-issue triage.

## Threat Mitigation Status

Per the plan's `<threat_model>`, this plan was responsible for `mitigate` actions on T-10-06, T-10-07, T-10-08, T-10-11.

| Threat | Mitigation Applied |
|--------|-------------------|
| T-10-06 (Information Disclosure — files allowlist leak) | All 19 allowlist lines preserved verbatim; `!temp/**`, `!fixtures/**`, `!tests/**`, `!.planning/**`, `!src/**` all confirmed by grep |
| T-10-07 (Tampering — wrong identity value) | `identity: '-'` single-quoted; bare-dash and `identity: null` confirmed absent by JS regex check |
| T-10-08 (Tampering — sharp libvips silently dropped) | `asarUnpack` retains BOTH `sharp/**` AND `@img/**` patterns (each grep-count 1) |
| T-10-11 (EoP — UAC elevation) | `nsis.perMachine: false` set (per-user install, no UAC prompt) |

T-10-05, T-10-09, T-10-10 are explicitly `accept` / `transfer` dispositions deferred to Phase 11 (CI + SHA256 manifests) and DIST-future code-signing work — not this plan's responsibility.

## Threat Flags

None. The YAML edit introduces no new network endpoints, auth paths, or trust-boundary surface beyond what the plan's `<threat_model>` already enumerates.

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `electron-builder.yml` exists at repo root: FOUND
- `.planning/phases/10-installer-build-electron-builder-all-3-platforms/10-02-SUMMARY.md` exists: FOUND (this file)
- `.planning/phases/10-installer-build-electron-builder-all-3-platforms/deferred-items.md` exists: FOUND
- Task 1 commit `7e3c248` exists in `git log --oneline --all`: FOUND
