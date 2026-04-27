# Phase 10: Installer build (electron-builder, all 3 platforms) — Research

**Researched:** 2026-04-27
**Domain:** Cross-platform Electron app packaging (electron-builder 26 + sharp 0.34 + ad-hoc macOS signing + unsigned NSIS + AppImage)
**Confidence:** HIGH for macOS path; MEDIUM for Windows-from-macOS path; LOW for local Linux AppImage (defer to CI per scope).

---

## Summary

Phase 10 builds on a working v1.0 macOS-only `electron-builder.yml` (electron-builder 26.8.1, electron 41.3.0, sharp 0.34.5). The existing config already has the canonical sharp + asarUnpack incantation (`**/node_modules/sharp/**/*` + `**/node_modules/@img/**/*`) and a verified `.dmg` exists in `release/` proving the macOS path works. What Phase 10 actually adds is: (1) a Windows `nsis` target block with `signAndEditExecutable: false` to enforce unsigned output, (2) a Linux `AppImage` target block, (3) an explicit `mac.identity: '-'` to lock ad-hoc signing (today the build relies on electron-builder's *default* ad-hoc behavior on Apple Silicon when no Developer ID is in keychain — that default is correct but undocumented in the YAML), (4) per-platform npm scripts (`build:mac`, `build:win`, `build:linux`), and (5) a `package.json` version bump from `0.0.0` to a real semver so installer filenames + Info.plist `CFBundleShortVersionString` are non-zero.

The single most failure-prone area is **sharp on Windows when built from a macOS host**: a default `npm install` on macOS only fetches the `@img/sharp-darwin-arm64` and `@img/sharp-libvips-darwin-arm64` optional subpackages — the Windows `.exe` will be missing the Windows native binary unless the build pipeline either (a) runs `npm install --os=win32 --cpu=x64 sharp` to fetch the Windows subpackage before packing, or (b) defers Windows builds to CI on a real Windows runner (cleanest answer; this is what Phase 11 is for). Per the Phase 10 goal ("user can build locally on macOS + Windows; Linux best-effort"), Windows builds *can* be locally driven if the user runs them on a Windows machine — but cross-compiling Windows from macOS arm64 is tested-fragile and not the recommended path.

**Primary recommendation:** Leave the working sharp+asarUnpack lines untouched, add `mac.identity: '-'` explicitly, add a fully-formed `win.nsis` block and `linux.AppImage` block with no signing keys, add three npm scripts, bump `package.json` `version` to `1.1.0`, and document a manual post-install smoke test (load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → run Optimize Assets) for each platform. Treat cross-platform-from-macOS Windows builds as out-of-scope-of-success — Windows local builds happen on a Windows host; CI in Phase 11 is the canonical Windows + Linux producer.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md does not exist for this phase (running standalone research without prior `/gsd-discuss-phase`). The locked decisions come instead from the orchestrator's invocation context and the milestone-level decisions in `.planning/STATE.md` "Decisions" section. Treating those as the equivalent of a CONTEXT.md "Locked Decisions" block:

### Locked Decisions (from STATE.md + invocation context)

- **No paid signing certs in v1.1** — Apple Developer ID and Windows EV both deferred. macOS `.dmg` is ad-hoc-signed; Windows `.exe` is unsigned. Verified via `codesign -dv` (macOS) and absence of an embedded signature (Windows).
- **electron-builder version locked at 26.8.1** — already in `package.json` devDependencies; do not regress to v23/v24 patterns.
- **Linux verified by CI only (Phase 11)** — local AppImage is best-effort smoke; failure here is acceptable in this phase, but the YAML config must be complete and committed so Phase 11 has something to build with.
- **macOS arm64 minimum** — universal binary deferred. `mac.target` ships arm64 only.
- **No auto-update / electron-updater wiring in this phase** — that's Phase 12. Do not add `publish:` keys yet (a later phase will add `publish: github`).

### Claude's Discretion

- Exact directory layout for `build/` resources (icons, entitlements file if added). The current `electron-builder.yml` declares `directories.buildResources: build` but `build/` does not yet exist on disk — research recommends creating it with at minimum `entitlements.mac.plist` (see Pattern 3 below). App icons (`icon.icns`, `icon.ico`, `icon.png`) are nice-to-have but not blocking for v1.1 tester builds; document as a follow-up.
- Whether to use `electron-builder.yml` (current) vs. `package.json#build` (allowed but more cluttered). Recommendation: stay on YAML.
- Exact npm script naming (`build:mac` / `build:win` / `build:linux` is conventional; alternatives like `dist:mac` are equally valid).

### Deferred Ideas (OUT OF SCOPE — do not investigate)

- Apple Developer ID / notarization (`@electron/notarize`).
- Windows EV / OV code-signing certs.
- `electron-updater` and the `publish:` config block.
- Universal macOS binary (`arch: universal`).
- CI / GitHub Actions integration.
- Linux `.deb` / `.rpm` / Snap / Flatpak — AppImage only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DIST-01** | User can build a Windows `.exe` (NSIS) locally via an npm script. | Standard Stack §A; Pattern 2 (NSIS unsigned config); Pitfall 3 (cross-from-macOS is fragile, recommend running on a Windows host). |
| **DIST-02** | User can build a macOS `.dmg` locally via an npm script (arm64 minimum). | Existing `electron-builder.yml` already produces this; Pattern 1 (mac config); known good — `release/Spine Texture Manager-0.0.0-arm64.dmg` exists. |
| **DIST-03** | CI builds a Linux `.AppImage` on tag pushes (Phase 11 verifies; Phase 10 only commits the YAML). | Pattern 4 (AppImage config); Pitfall 5 (FUSE on Ubuntu 24.04 — testers need `libfuse2t64`). Local build is best-effort. |
| **DIST-04** | macOS `.dmg` is signed ad-hoc; first-launch instructions documented. | Pattern 3 (`mac.identity: '-'`); Pattern 6 (Sequoia 15.1+ first-launch flow — *NOT* the old right-click-Open). |
| **DIST-05** | Windows `.exe` is unsigned; SmartScreen "Run anyway" bypass documented. | Pattern 2 (no `win.certificateFile`/`win.signingHashAlgorithms` keys); Pattern 7 (SmartScreen "More info → Run anyway"). |
| **DIST-06** | sharp libvips bundled correctly; installed app completes Optimize Assets export. | Pitfall 1 (sharp 0.33+ subpackages); existing asarUnpack lines are correct; Pattern 8 (post-install smoke test). |
| **DIST-07** | Installer filenames + embedded version metadata match `package.json` version. | Pattern 5 (`${version}` template, `CFBundleShortVersionString` auto-derivation); Pitfall 6 (version is currently `0.0.0` — must be bumped). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives that bind Phase 10:

- **`core/` is pure TypeScript, no DOM** — Phase 10 does not touch `core/`. Pure packaging concern. ✓
- **`temp/` is the user's Spine editor source files; gitignored** — Already excluded in `electron-builder.yml` `files:` list (`!temp/**`). Verify still excluded in any YAML edits. ✓
- **Test fixture is `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`** — This drives the manual post-install smoke test (Pattern 8). Fixture must remain accessible at that path on the developer's machine for verification.
- **`sharp` only runs during Optimize Assets** — Smoke test must explicitly trigger Optimize Assets (not just app launch) to prove sharp's libvips bundled correctly. App-launch-only is insufficient verification for DIST-06.
- **Phases execute strictly in order** — Phase 10 must produce working installers before Phase 11 (CI) can build them. Phase 10's `electron-builder.yml` is the input contract for Phase 11's GitHub Actions workflow.
- **Source of truth for design facts** — None of the v1.1 distribution mechanics relate to the Spine math facts (sampling rate, computeWorldVertices, etc.). Phase 10 is fully orthogonal to the math layer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bundle main + preload + renderer to `out/` | Build tooling (electron-vite) | — | Already done by `electron-vite build`; Phase 10 consumes this output. |
| Pack `out/` + node_modules into platform installer | Build tooling (electron-builder) | — | electron-builder reads `out/` and produces `.dmg` / `.exe` / `.AppImage` from `release/`. |
| Unpack native modules from app.asar | Build tooling (electron-builder asarUnpack) | Runtime (Electron loader) | Without asarUnpack, sharp's `.node` and `libvips-cpp.dylib` are inside `app.asar` and `dlopen` fails at runtime. |
| Sign macOS `.app` ad-hoc | Build tooling (electron-builder + macOS `codesign`) | OS (Gatekeeper at first launch) | `mac.identity: '-'` triggers ad-hoc; OS enforces a one-time user-consent flow. |
| Embed version into Info.plist / Win version resource | Build tooling (electron-builder) | — | electron-builder reads `package.json#version` and writes `CFBundleShortVersionString` (macOS) and `FileVersion`/`ProductVersion` (Windows). |
| Smoke-test installed app | Manual (developer + tester) | — | Cannot be automated in v1.1 (no spectron, no Playwright on installed app); see Validation Architecture §Manual. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron-builder` | **26.8.1** | Cross-platform installer producer | Already locked in `package.json`; current major; ships YAML config schema used by Phase 10. `[VERIFIED: npm view electron-builder version → 26.8.1, 2026-04-27]` |
| `electron` | **41.3.0** | Runtime being packaged | Already locked. Sets the Node ABI sharp's prebuild must match. `[VERIFIED: npm view electron version → 41.3.0]` |
| `sharp` | **0.34.5** | Image processing (Optimize Assets) | Already locked. v0.33+ split into per-platform `@img/sharp-*` subpackages — this is the *whole reason* asarUnpack needs both `sharp/**` and `@img/**` patterns. `[VERIFIED: npm view sharp version → 0.34.5; node_modules/@img/ contains sharp-darwin-arm64 + sharp-libvips-darwin-arm64]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `electron-vite` | 5.0.0 | Bundle main/preload/renderer to `out/` | Already in use; Phase 10 calls `electron-vite build` *then* `electron-builder`. No change. |
| `@electron/notarize` | — | Apple notarization | **Do not install in v1.1** — locked out of scope. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-builder 26 | electron-forge 7 | Forge is the modern Electron-team-blessed tool, but switching tooling is out-of-scope for v1.1 (massive risk for zero requirement-coverage benefit). Stay on electron-builder. |
| ad-hoc signing (`-`) | unsigned (`null`) | `mac.identity: null` *also* disables hardened runtime, which is fine for unsigned but means `codesign -dv` on the produced `.app` shows "code object is not signed at all" instead of an ad-hoc signature. The success criterion (`codesign -dv shows ad-hoc`) requires `'-'`, not `null`. **Use `'-'`.** [CITED: electron-builder code-signing-mac.md] |
| AppImage | `.deb` / `.rpm` / Snap | All four are deferred per OOS list; AppImage is the only one in v1.1 scope. |

**Installation:**
No new dependencies — everything needed is already in `package.json`. The phase is config + scripts + version bump.

**Version verification (2026-04-27):**
- `electron-builder@26.8.1` — confirmed via `npm view electron-builder version` against npm registry.
- `electron@41.3.0` — confirmed via `npm view electron version`.
- `sharp@0.34.5` — confirmed via `npm view sharp version`. The `@img/sharp-*` subpackage versions (`0.34.5` runtime, `1.2.4` libvips) are visible in `node_modules/sharp/package.json` under `optionalDependencies`.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌────────────────────────────────────────────┐
                  │  Developer machine (macOS arm64 today)     │
                  └────────────────────────────────────────────┘
                                    │
   ┌────────────────────────────────┴───────────────────────────────────┐
   │                                                                    │
   ▼                                                                    ▼
┌─────────────────────────┐                            ┌──────────────────────────────┐
│  npm run build:mac      │                            │  npm run build:win | :linux  │
│                         │                            │  (best-effort cross-build OR │
│                         │                            │   "skip locally, defer P11") │
└──────────┬──────────────┘                            └──────────────┬───────────────┘
           │                                                          │
           ▼                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 1: electron-vite build                                              │
│    src/main/**, src/preload/**, src/renderer/** ── tsc + vite ──> out/     │
│    (no native modules touched here; pure JS bundling)                       │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Stage 2: electron-builder --mac dmg | --win nsis | --linux AppImage        │
│                                                                             │
│   Reads:                                                                    │
│     - electron-builder.yml  (target config)                                 │
│     - package.json#version  (→ artifactName + Info.plist + Win version)     │
│     - out/**                (bundled JS)                                    │
│     - node_modules/**       (whitelist; whitelisted by `files:`)            │
│                                                                             │
│   Per-platform behavior:                                                    │
│     macOS  : runs `codesign -s -` (ad-hoc) on .app, packs into .dmg         │
│     Win    : packs into NSIS .exe, NO signing                               │
│     Linux  : packs into AppImage (squashFS + AppRun + libfuse2 runtime)     │
│                                                                             │
│   asarUnpack:                                                               │
│     - **/node_modules/sharp/**/*    ──> app.asar.unpacked/sharp/            │
│     - **/node_modules/@img/**/*     ──> app.asar.unpacked/@img/             │
│       (sharp's .node binary + libvips dylib MUST live outside .asar so      │
│        dlopen() can resolve them at runtime)                                │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
                   ┌──────────────────────┐
                   │  release/            │
                   │   *-arm64.dmg        │  ← user runs, Gatekeeper prompts on
                   │   *-x64.exe          │     first launch (Sequoia: System Settings)
                   │   *-x86_64.AppImage  │  ← user runs, FUSE2 must be present
                   └──────────────────────┘
                          │
                          ▼
            ┌──────────────────────────────────┐
            │  POST-INSTALL SMOKE TEST          │
            │  (manual; cannot automate in v1.1) │
            │                                    │
            │  1. Launch installed app           │
            │  2. Drag fixtures/SIMPLE_PROJECT/  │
            │     SIMPLE_TEST.json onto window   │
            │  3. Run Optimize Assets export     │
            │     to a temp folder               │
            │  4. Verify non-zero output PNGs    │
            │     ≡ DIST-06 PASS                 │
            └──────────────────────────────────┘
```

### Component Responsibilities

| Component | File / Path | Responsibility |
|-----------|-------------|----------------|
| Build config | `electron-builder.yml` | Sole config source — file patterns, asarUnpack, per-platform target blocks. |
| Stage-1 bundler | `electron.vite.config.*` | Produces `out/main`, `out/preload`, `out/renderer`. Already correct from v1.0. Phase 10 does not touch this. |
| Stage-2 packer | `electron-builder` CLI | Reads YAML + `out/` + `node_modules` → produces `release/*.dmg|.exe|.AppImage`. |
| Version source | `package.json#version` | Single source of truth for installer filename, Info.plist, Win version resource. |
| Build resources dir | `build/` (does not yet exist) | electron-builder looks here for `entitlements.mac.plist`, icons. Phase 10 may need to create this dir. |
| Smoke-test fixture | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | Manual verification input. Already present, not modified. |

### Recommended Project Structure

```
.
├── electron-builder.yml          # extended in Phase 10 (mac/win/linux blocks)
├── package.json                  # version bumped 0.0.0 → 1.1.0; build:mac/win/linux scripts added
├── build/                        # NEW: created in Phase 10
│   └── entitlements.mac.plist    # NEW: required for ad-hoc on macOS (see Pattern 3)
├── out/                          # produced by electron-vite (already wired)
└── release/                      # produced by electron-builder (already gitignored)
```

### Pattern 1: macOS DMG with explicit ad-hoc signing

**What:** Lock ad-hoc signing in YAML rather than relying on the implicit Apple-Silicon-no-cert-found default.
**When:** Always, for v1.1.
**Example:**
```yaml
# Source: https://www.electron.build/code-signing-mac.md
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
  identity: '-'                                  # ad-hoc; '-' is THE canonical value
  hardenedRuntime: false                          # no entitlements needed for ad-hoc
  gatekeeperAssess: false                         # don't run `spctl --assess` (would fail)
  artifactName: ${productName}-${version}-${arch}.${ext}

dmg:
  artifactName: ${productName}-${version}-${arch}.${ext}
```
**Verification on produced `.app`:**
```sh
codesign -dv "release/mac-arm64/Spine Texture Manager.app" 2>&1 | grep Signature
# Expect: "Signature=adhoc"
```
[CITED: https://github.com/electron-userland/electron-builder/blob/master/pages/code-signing-mac.md] — "For ARM builds where ad-hoc signing is desired, set `mac.identity` to `-`."

### Pattern 2: NSIS Windows unsigned

**What:** Add a `win.target: nsis` block with no signing keys; electron-builder produces an unsigned `.exe`.
**When:** v1.1 only — replace with cert config when DIST-future lands.
**Example:**
```yaml
# Source: https://www.electron.build/nsis.html
win:
  target:
    - target: nsis
      arch: x64
  artifactName: ${productName}-${version}-${arch}.${ext}
  # No certificateFile / certificateSubjectName / signingHashAlgorithms
  # ⇒ unsigned (DIST-05).

nsis:
  oneClick: false                       # show install wizard
  perMachine: false                     # per-user install (no UAC prompt)
  allowToChangeInstallationDirectory: true
  artifactName: ${productName}-${version}-${arch}.${ext}
```
[VERIFIED: ctx7 docs /electron-userland/electron-builder NSIS section]

### Pattern 3: Entitlements file for ad-hoc macOS

**What:** Even ad-hoc-signed Electron apps under hardened runtime need entitlements; without them, the renderer process cannot use JIT and the app crashes on first JS execution. With `hardenedRuntime: false` (Pattern 1), entitlements are NOT required — but committing the file is cheap insurance against later enabling hardenedRuntime.
**When:** Optional for v1.1 ad-hoc + non-hardened; mandatory once hardened runtime or Developer ID lands.
**Example file** (`build/entitlements.mac.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key><true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
    <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict>
</plist>
```
[CITED: electron-builder code-signing-mac.md — "If encountering errors related to library validation or app crashes, ensure `com.apple.security.cs.disable-library-validation` entitlement is applied. For Electron Framework crashes, `com.apple.security.cs.allow-jit` is necessary."]

**Decision for Phase 10:** Skip entitlements file in v1.1 (we're not on hardened runtime); revisit when DIST-future Developer ID work lands. **`[ASSUMED]` — not blocker-tested in v1.1; if first-launch crash occurs, this is the first remediation.**

### Pattern 4: Linux AppImage minimal config

**What:** AppImage is the only Linux target in scope; minimal block sufficient.
**When:** Always include for completeness even though local build is best-effort.
**Example:**
```yaml
# Source: https://www.electron.build/appimage.md
linux:
  target:
    - target: AppImage
      arch: x64
  category: Development
  artifactName: ${productName}-${version}-${arch}.${ext}

appImage:
  artifactName: ${productName}-${version}-${arch}.${ext}
```
**Note:** `linux.category` uses freedesktop.org categories (not macOS LSApplicationCategoryType). "Development" is the closest match for a developer-tool app.
[CITED: https://www.electron.build/appimage.md]

### Pattern 5: Version + filename templating

**What:** electron-builder's macros expand at pack time. Standard tokens: `${productName}`, `${version}`, `${arch}`, `${os}`, `${ext}`.
**When:** Use in every `artifactName`. Already correct in current YAML.
**Example:**
```yaml
artifactName: ${productName}-${version}-${arch}.${ext}
# Renders to: "Spine Texture Manager-1.1.0-arm64.dmg"
```
**Embedding into Info.plist / Win version resource:**
- macOS: electron-builder writes `package.json#version` to `CFBundleShortVersionString` and `CFBundleVersion` automatically. Override with `mac.bundleShortVersion` / `mac.bundleVersion` if needed (we don't need to).
- Windows: electron-builder writes `version` to the PE-format VERSIONINFO resource as `FileVersion` and `ProductVersion`. Verifiable post-build via PowerShell `(Get-Item *.exe).VersionInfo`.

[VERIFIED: ctx7 docs /electron-userland/electron-builder File Macros section]

**Critical for DIST-07:** `package.json#version` is **currently `0.0.0`**. Phase 10 must bump it to `1.1.0` (or `1.1.0-rc1`) before any installer is built; otherwise filenames + embedded version are nonsense. This is a one-line edit but easy to forget.

### Pattern 6: macOS Sequoia first-launch flow (Gatekeeper)

**What:** macOS 15.1 (Sequoia) **removed the right-click → Open Gatekeeper bypass**. Tester instructions for v1.1 must use the System Settings flow.
**When:** First-launch instructions in `INSTALL.md` (Phase 12 deliverable, but Phase 10 documents the smoke-test recipe internally).
**Steps for tester:**
1. Download `Spine Texture Manager-1.1.0-arm64.dmg`.
2. Open the DMG, drag app to `/Applications`.
3. Double-click the app. **Expected:** macOS shows "Spine Texture Manager cannot be opened because the developer cannot be verified" or similar.
4. Open **System Settings → Privacy & Security**.
5. Scroll to the bottom of that pane. There will be a row about Spine Texture Manager being blocked, with an **"Open Anyway"** button.
6. Click "Open Anyway". Confirm with admin password if prompted.
7. macOS re-prompts; click **Open**. Subsequent launches work normally.

[CITED: https://support.apple.com/en-us/102445 — "click Open Anyway… The warning prompt reappears and, if you're absolutely sure, click Open"]
[CITED: https://www.idownloadblog.com/2024/08/07/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/ — Sequoia removed Control-click bypass]

**`[ASSUMED]`:** Behavior on Sequoia 15.1+ for an *ad-hoc-signed* app (vs. truly unsigned) — Apple Silicon Macs auto-ad-hoc-sign unsigned binaries on first run, so the user-visible Gatekeeper prompt should be identical for ad-hoc and unsigned. This is consistent with hackaday/macrumors sources but not verified on a clean Sequoia 15.4 machine in this session. Smoke test will confirm.

### Pattern 7: Windows SmartScreen first-launch flow

**What:** Unsigned NSIS installer on a Windows host with default Microsoft Defender SmartScreen settings shows "Windows protected your PC" blue dialog; "Run" button is hidden behind a "More info" link.
**When:** Tester instructions in `INSTALL.md` (Phase 12).
**Steps for tester:**
1. Download `Spine Texture Manager-1.1.0-x64.exe`.
2. Double-click. **Expected:** "Windows protected your PC" SmartScreen dialog.
3. Click **More info** (small text link, easy to miss).
4. A **Run anyway** button appears. Click it.
5. NSIS installer runs as normal.

[CITED: WebSearch — Microsoft Defender SmartScreen "More info → Run anyway" flow, generic for any unsigned EXE]

**Side note:** "Smart App Control" (SAC) on Windows 11 25H2 may *block outright* with no Run-anyway button; testers on SAC-enabled machines must disable SAC or right-click → Properties → Unblock. Document but don't try to engineer around — it's the tester's policy, not ours.

### Pattern 8: Post-install manual smoke test (DIST-06 verification)

**What:** The only way to prove sharp's libvips bundled correctly is to run an actual Optimize Assets export from the installed app. There is no automated test for "the .dmg works."
**When:** Once per platform per phase. Documented in PLAN.md as a manual checkbox.
**Recipe (per platform):**
1. Install the app (use its native installer).
2. Launch it.
3. File → Open → `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (or drag-drop).
4. Wait for the Global Max Render Source panel to populate (proves the sampler ran ⇒ proves `worker_threads` survived packaging).
5. File → Optimize Assets → choose a temp folder.
6. **Pass criteria:** No error dialog. The temp folder contains non-zero PNG files (one per attachment region) and a regenerated `.atlas`.
7. **If sharp packaging is broken:** Step 5 shows a dialog like `Cannot find module 'sharp'` or `dlopen failed: libvips-cpp.8.17.dylib not found`. This means `asarUnpack` lost the `@img/**` patterns or the wrong sharp subpackage was bundled.

This is the canonical Phase 10 success-criterion verification per ROADMAP.md success criterion #1.

### Anti-Patterns to Avoid

- **Using `mac.identity: null` for ad-hoc.** That value disables hardened runtime *and* produces an entirely unsigned binary; `codesign -dv` reports "code object is not signed at all" instead of "Signature=adhoc". DIST-04 explicitly requires ad-hoc, not unsigned. Use `'-'`. [CITED: electron-builder code-signing-mac.md]
- **Forgetting to bump `package.json#version`.** Already at `0.0.0`. Currently produces `Spine Texture Manager-0.0.0-arm64.dmg`. DIST-07 fails the moment a tester sees `0.0.0` in the filename.
- **Removing the `@img/**` asarUnpack pattern.** Sharp 0.32 → 0.33 split the libvips binary out of the main `sharp` package into `@img/sharp-libvips-{platform}-{arch}` and `@img/sharp-{platform}-{arch}`. asarUnpack must include BOTH `**/node_modules/sharp/**/*` AND `**/node_modules/@img/**/*`. The current YAML has both — preserve them. [CITED: https://sharp.pixelplumbing.com/install/#bundlers — "make sure the two modules are in the asarUnpack section"]
- **Trying to cross-build Windows from macOS arm64.** Officially supported by electron-builder, but riddled with "works on x86 Mac, fails on M-series" reports. Recommend running Windows builds on a Windows machine (or deferring to Phase 11 CI). See Pitfall 3.
- **Adding a `publish:` block in this phase.** That triggers electron-updater wiring, which is Phase 12. Phase 10 produces installers but does not push them anywhere.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code-signing on macOS | Custom `codesign` invocations in postbuild scripts | `electron-builder`'s `mac.identity` + `afterSign` hook | `electron-builder` already wraps `codesign` correctly; orchestrating it manually re-implements signing-order constraints (sign frameworks before bundle, recursive signing of helpers, etc.). |
| NSIS installer authoring | Hand-written `.nsi` script | `electron-builder` NSIS target | electron-builder ships an Electron-aware NSIS template; rolling your own loses uninstaller, version-resource embedding, multi-arch detection. |
| AppImage assembly | `appimagetool` invocations | electron-builder AppImage target | electron-builder handles AppRun, embedded squashFS, FUSE compatibility. |
| Native module rebuilding for Electron's Node ABI | `electron-rebuild` orchestration | electron-builder's automatic detection | electron-builder runs `install-app-deps` automatically when packing; manual `electron-rebuild` invocations are only needed if you've explicitly disabled npmRebuild. |
| Version embedding into Info.plist / VERSIONINFO | `plutil` edits / `rcedit` calls | electron-builder reads `package.json#version` directly | Free correctness, single source of truth. |
| First-launch Gatekeeper / SmartScreen workarounds | Bash scripts that `xattr -d` the app | Tester documentation in `INSTALL.md` | Don't try to fight Gatekeeper. Document the System Settings flow. (Phase 12 owns INSTALL.md.) |

**Key insight:** Phase 10 is almost entirely a *configuration* phase. The implementation work is editing one YAML file and one package.json. Resist the urge to write build scripts, postbuild hooks, or signing helpers — electron-builder does it all if you give it the right config keys.

## Runtime State Inventory

This is not a rename/refactor/migration phase. **Section omitted.**

(For completeness: nothing in Phase 10 changes a stored identifier, runtime config key, or service-registered name. The only runtime-state-adjacent change is bumping `package.json#version` from `0.0.0` to `1.1.0`, which is read by electron-builder at pack time but is not a runtime state itself — the installed app reads the embedded version, not package.json.)

## Common Pitfalls

### Pitfall 1: sharp's per-platform subpackages — installer-host-arch trap

**What goes wrong:** Running `npm install` on a macOS arm64 host fetches only `@img/sharp-darwin-arm64` and `@img/sharp-libvips-darwin-arm64` (verified — those are the only two `@img/` dirs present in `node_modules` right now). When electron-builder packs a Windows `.exe` from this host, the Windows `sharp-win32-x64` subpackage is **absent**, and the produced installer's `app.asar.unpacked/@img/` only contains the macOS subpackages. The installed Windows app crashes on first sharp call with `Cannot find module '@img/sharp-win32-x64'`.

**Why it happens:** sharp 0.33+ uses npm's `optionalDependencies` mechanism; npm by default skips optional deps that don't match the host's platform/arch.

**How to avoid:**
- **Recommended (cleanest):** Build each platform on its native host. macOS dmg on macOS, Windows exe on Windows, Linux AppImage on Linux/CI.
- **Alternative (cross-build):** Before each platform's electron-builder invocation, run `npm install --os=<target> --cpu=<arch> --include=optional sharp` to fetch the right subpackage. Fragile across npm versions; some npm versions ignore these flags.
- **Alternative (multi-arch lockfile):** Some teams maintain a `package-lock.json` populated by running `npm install` on each platform and merging — works but is a maintenance burden.

**Warning signs:** Look in `release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar.unpacked/@img/` after a build; should contain `sharp-darwin-arm64/` and `sharp-libvips-darwin-arm64/`. Any other platform's asarUnpacked dir contents tell you the host fetched only its native subpackages.

[CITED: https://github.com/lovell/sharp/issues/4109 — cross-platform sharp install with electron-builder]
[VERIFIED: `ls node_modules/@img/` returns only darwin-arm64 subpackages on this host, 2026-04-27]

### Pitfall 2: Building `0.0.0` installers

**What goes wrong:** `package.json#version` is currently `0.0.0`. Every produced installer shows `0.0.0` in its filename and embedded metadata. Tester confusion + DIST-07 failure.

**Why it happens:** v1.0 shipped without bumping the package.json version (it tagged `v1.0` in git but left package.json at scaffold default).

**How to avoid:** Bump to `1.1.0` (or `1.1.0-rc1` for tester rounds) as a discrete plan task in Phase 10, before any installer is built.

**Warning signs:** `release/Spine Texture Manager-0.0.0-arm64.dmg` already exists from v1.0 builds. Any new build that still produces a `0.0.0` filename is a missed-step indicator.

### Pitfall 3: Cross-building Windows from macOS arm64

**What goes wrong:** `electron-builder --win` on macOS arm64 historically required Wine (`brew install wine` no longer ships pre-built; needs MacPorts). Even with Wine, building NSIS on Apple Silicon has had segfault reports (issue #7165, #8038). Some recent electron-builder versions claim NSIS doesn't need Wine — but real-world reports remain mixed.

**Why it happens:** NSIS is a Windows tool. electron-builder bundles a portable Wine-shimmed `makensis.exe` for cross-builds, but Apple Silicon's Rosetta + Wine + qemu interaction is fragile.

**How to avoid:**
- **Phase 10 recommendation:** Don't try to cross-build Windows from macOS arm64. Either (a) the user has a Windows machine and runs `npm run build:win` there, or (b) Phase 11 CI on a `windows-latest` GHA runner produces the canonical Windows artifact.
- If user *must* cross-build on this Mac: try `npx electron-builder --win` once, observe whether NSIS cross-build succeeds; if it segfaults, fall back to (a) or (b).

**Warning signs:** Errors mentioning `qemu`, `wine`, `makensis`, `segmentation fault` during `--win` build.

[CITED: https://github.com/electron-userland/electron-builder/issues/7165, /issues/8038 — Apple Silicon Wine/qemu issues]

### Pitfall 4: `directories.buildResources: build` references a non-existent dir

**What goes wrong:** Current YAML declares `directories.buildResources: build` but `ls build/` returns "no such directory". electron-builder is forgiving (treats missing buildResources as "no extra resources") but a future YAML edit that references e.g. `build/icon.icns` will fail noisily.

**How to avoid:** Either (a) create `build/` with at least a `.gitkeep` so the path exists, or (b) explicitly drop `directories.buildResources` until we have something to put there.

**Warning signs:** Build fails with `cannot find file: build/icon.icns` once an icon line is added.

### Pitfall 5: AppImage FUSE on Ubuntu 24.04+

**What goes wrong:** AppImage runtime requires libfuse2. Ubuntu 24.04 renamed the package from `libfuse2` to `libfuse2t64` (time_t-64 transition). Testers on stock Ubuntu 24.04 see `dlopen(): error loading libfuse.so.2` when running the AppImage.

**How to avoid:** Document in tester install instructions (Phase 12 INSTALL.md) that Ubuntu 24.04 users must `sudo apt install libfuse2t64`. This is not a bug we can fix in the AppImage itself — AppImage v3 (FUSE3) is not the default electron-builder AppImage runtime as of writing.

**Warning signs:** Tester reports "AppImages require FUSE to run" error.

[CITED: https://docs.appimage.org/user-guide/troubleshooting/fuse.html, https://itsfoss.com/cant-run-appimage-ubuntu/]

### Pitfall 6: Missing `npmRebuild: true` (default is true)

**What goes wrong:** A previous user who set `npmRebuild: false` in YAML disables electron-builder's automatic call to `electron-builder install-app-deps`, leaving sharp's native binary built against system Node's ABI instead of Electron's. Result: installed app crashes with `NODE_MODULE_VERSION` mismatch.

**How to avoid:** Don't set `npmRebuild: false`. The default is `true`; current YAML omits the key, which means default applies. Verify it stays omitted (or explicitly set `npmRebuild: true`).

**Warning signs:** `Error: The module ... was compiled against a different Node.js version using NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y.`

[CITED: ctx7 docs /electron-userland/electron-builder configuration.html]

## Code Examples

Verified patterns from official sources:

### Complete Phase 10 `electron-builder.yml` (target state)

```yaml
# Source: derived from current YAML + electron-builder docs
appId: com.spine.texture-manager
productName: Spine Texture Manager
copyright: Copyright (C) 2026

directories:
  output: release
  buildResources: build

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

mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
  identity: '-'                               # ad-hoc (DIST-04)
  hardenedRuntime: false
  gatekeeperAssess: false
  artifactName: ${productName}-${version}-${arch}.${ext}

dmg:
  artifactName: ${productName}-${version}-${arch}.${ext}

win:
  target:
    - target: nsis
      arch: x64
  artifactName: ${productName}-${version}-${arch}.${ext}
  # NO certificate keys ⇒ unsigned (DIST-05)

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  artifactName: ${productName}-${version}-${arch}.${ext}

linux:
  target:
    - target: AppImage
      arch: x64
  category: Development
  artifactName: ${productName}-${version}-${arch}.${ext}

appImage:
  artifactName: ${productName}-${version}-${arch}.${ext}
```

### Complete `package.json` script changes

```json
{
  "version": "1.1.0",
  "scripts": {
    "build": "electron-vite build && electron-builder",
    "build:mac": "electron-vite build && electron-builder --mac dmg",
    "build:win": "electron-vite build && electron-builder --win nsis",
    "build:linux": "electron-vite build && electron-builder --linux AppImage",
    "build:dry": "electron-vite build && electron-builder --mac dmg --dir"
  }
}
```
- `build` (no flag) lets electron-builder pick the host platform's default targets — useful for "just build for whatever I'm on".
- Each `build:*` is explicit, deterministic, and CI-friendly (Phase 11 will call them directly).
- `build:dry` produces an unpacked `.app` in `release/mac-arm64/` without DMG packaging — fastest iteration loop for sharp packaging issues.

### Verification commands (post-build)

```sh
# macOS — verify ad-hoc signature (DIST-04)
codesign -dv "release/mac-arm64/Spine Texture Manager.app" 2>&1 | grep Signature
# Expected: Signature=adhoc

# macOS — verify version embedding (DIST-07)
plutil -p "release/mac-arm64/Spine Texture Manager.app/Contents/Info.plist" \
  | grep -E 'CFBundleShortVersionString|CFBundleVersion'
# Expected: both = "1.1.0"

# macOS — verify sharp + libvips landed in asar.unpacked (DIST-06)
ls "release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar.unpacked/node_modules/@img/"
# Expected: sharp-darwin-arm64/  sharp-libvips-darwin-arm64/

# Windows (run on a Windows host) — verify version embedding
powershell -c "(Get-Item 'release\\Spine Texture Manager-1.1.0-x64.exe').VersionInfo | Select FileVersion, ProductVersion"
# Expected: 1.1.0  1.1.0

# Linux — verify AppImage runs (FUSE2 must be installed)
chmod +x "release/Spine Texture Manager-1.1.0-x86_64.AppImage"
"./release/Spine Texture Manager-1.1.0-x86_64.AppImage" --appimage-extract-and-run --version
# Expected: app version printed, no FUSE errors
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `sharp` package containing libvips | sharp split into `@img/sharp-{platform}` + `@img/sharp-libvips-{platform}` | sharp 0.33 (May 2024) | asarUnpack patterns changed; old `**/node_modules/sharp/**/*` alone is insufficient — need `**/node_modules/@img/**/*` too. Already correct in current YAML. |
| `mac.identity: null` for unsigned | `mac.identity: '-'` for ad-hoc | electron-builder docs current | Different `codesign -dv` behavior; for DIST-04 we need ad-hoc, so `'-'`. |
| Right-click → Open Gatekeeper bypass | System Settings → Privacy & Security → Open Anyway | macOS Sequoia 15.1 (Oct 2024) | Tester INSTALL.md (Phase 12) must reflect new flow; old "right-click Open" advice is broken on Sequoia 15.1+. |
| Ubuntu `libfuse2` for AppImage | `libfuse2t64` on Ubuntu 24.04+ | Ubuntu 24.04 (Apr 2024) | Tester INSTALL.md (Phase 12) needs distro-specific install command. |
| `electron-builder` 23.x quirks (e.g. `asarUnpack` not honored, Issue #8640) | electron-builder 26.8.1 mostly resolved | Major version bumps 24/25/26 | We're on 26.8.1, current; no v23-era workarounds needed. |

**Deprecated/outdated:**
- Apple `productbuild` for `.pkg` — irrelevant; we ship `.dmg`, not `.pkg`.
- Squirrel.Windows — not used; NSIS is electron-builder's default Windows target.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ad-hoc-signed app on Sequoia 15.1+ shows the same Gatekeeper dialog as truly unsigned (just System Settings → Open Anyway flow) | Pattern 6 | Low — if behavior diverges, tester gets a slightly different dialog but the resolution is still in System Settings → Privacy & Security. |
| A2 | Skipping `entitlements.mac.plist` is safe with `hardenedRuntime: false` | Pattern 3 | Medium — if first-launch crashes with library validation error, add the entitlements file; one-line fix. |
| A3 | `build:win` on a Windows host with `npm install` already populating `@img/sharp-win32-x64` produces a working installer | Pitfall 1 | Low when run on Windows; high if attempted on macOS arm64 (covered by Pitfall 3). |
| A4 | electron-builder 26's NSIS cross-build from macOS arm64 segfaults often enough to be "don't bother" | Pitfall 3 | Medium — modern reports are mixed; user may try and find it works. Phase 10 plan should document "try, but don't block on it." |
| A5 | `npmRebuild` defaults to `true` and the current YAML omits it (so default applies) | Pitfall 6 | Low — verified in ctx7 docs, default is true. Current YAML omits the key. |
| A6 | Setting `version: "1.1.0"` is consistent with ROADMAP labeling Phase 10 as part of milestone v1.1 | Pattern 5, Pitfall 2 | Low — semver bump is mechanical; choose `1.1.0` or `1.1.0-rc1` per release-cadence preference. Decide at plan-phase. |

## Open Questions

1. **Should Phase 10 attempt local Windows cross-build, or defer entirely to Phase 11 CI?**
   - What we know: User host is macOS arm64, no Wine, no Docker. Cross-builds are fragile here.
   - What's unclear: Whether the user accepts "Windows verified by CI only" (parallel to the locked Linux decision) or insists on a local Windows path.
   - Recommendation: Frame the Phase 10 plan to (a) commit the `win:` block, (b) attempt `npm run build:win` once locally, (c) if it fails on macOS arm64, mark the local-Windows-build as "deferred to user running on a Windows machine" and rely on Phase 11 for the canonical artifact. Document this disposition explicitly.

2. **Should `package.json#version` jump to `1.1.0` or to `1.1.0-rc1`?**
   - What we know: Roadmap calls the milestone "v1.1 Distribution"; the eventual public tag will likely be `v1.1.0`. Tester rounds before that benefit from `-rc1`/`-rc2` suffixes.
   - What's unclear: Cadence — does the user want Phase 10 to ship a release candidate, or just a "build works" version?
   - Recommendation: `1.1.0-rc1` for the Phase 10 deliverable (filename `…-1.1.0-rc1-arm64.dmg` is unambiguous); bump to `1.1.0` (no suffix) at milestone close.

3. **Do we add `build/entitlements.mac.plist` now or defer to DIST-future?**
   - What we know: With `hardenedRuntime: false`, entitlements aren't required.
   - What's unclear: Whether ad-hoc *without* hardened runtime can hit any of the entitlement-related crashes (library validation; JIT).
   - Recommendation: Defer; if smoke test passes without it, ship without. Document as an immediate fallback if smoke test crashes.

4. **App icons (`build/icon.icns`, `build/icon.ico`, `build/icon.png`).**
   - What we know: Currently no icons are committed; electron-builder uses the default Electron icon if none provided. Tester builds with the default Electron icon look unprofessional but are fully functional.
   - What's unclear: Whether the user wants polished branding for v1.1 tester rounds.
   - Recommendation: Skip icons in Phase 10; flag as an INSTALL.md / branding follow-up item. Functional verification (DIST-01..07) does not depend on icons.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-builder runtime | ✓ | (engines.node ≥18 declared; user's installed version assumed compatible) | — |
| npm | dependency install | ✓ | (bundled with Node) | — |
| electron-builder | packaging | ✓ | 26.8.1 (devDep) | — |
| electron | runtime being packaged | ✓ | 41.3.0 (devDep) | — |
| sharp | image processing in packaged app | ✓ | 0.34.5 (dep), darwin-arm64 native binary present | — |
| `codesign` (macOS) | ad-hoc signing | ✓ (macOS Xcode CLT) | — | — |
| `xcrun` / `pkgutil` (macOS) | DMG assembly helpers | ✓ (macOS Xcode CLT) | — | — |
| Wine | NSIS cross-build from macOS | ✗ | — | Run Windows builds on a Windows host OR defer to Phase 11 CI |
| Docker | electronuserland/builder:wine container | ✗ | — | Same — Phase 11 CI |
| Linux runtime / FUSE2 | Local AppImage smoke test | ✗ (we're on macOS) | — | Phase 11 CI on `ubuntu-latest` is the canonical AppImage smoke surface |
| `appimage` runtime tools | AppImage assembly | bundled in electron-builder | — | — |

**Missing dependencies with no fallback:** None — all v1.0-required tools are present.

**Missing dependencies with fallback:**
- Wine / Docker (for cross-building Windows from macOS): fall back to running Windows builds on a Windows host or to Phase 11 GHA `windows-latest` runner.
- Linux runtime: fall back to Phase 11 GHA `ubuntu-latest` runner.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.0 (existing) |
| Config file | `vitest.config.ts` (existing; no changes needed) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` + `npm run typecheck` |

Phase 10 does not introduce new vitest tests for the YAML config itself — there is no clean way to unit-test "electron-builder will produce a working DMG." The validation surface is **(a) pre-pack typecheck/test gates** + **(b) post-pack manual smoke test** + **(c) static post-pack assertions via shell commands** (see "Code Examples → Verification commands").

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-01 | `npm run build:win` produces an `.exe` | manual + script-exit-code | `npm run build:win && test -f release/*.exe` | ❌ Wave 0 — script doesn't yet exist |
| DIST-02 | `npm run build:mac` produces a `.dmg` | manual + script-exit-code | `npm run build:mac && test -f "release/Spine Texture Manager-1.1.0-arm64.dmg"` | ✅ partial — current `npm run build` already does this |
| DIST-03 | `electron-builder.yml` has linux block; CI builds AppImage | static config check + Phase 11 CI run | `grep -q '^linux:' electron-builder.yml` | ❌ Wave 0 — block doesn't yet exist |
| DIST-04 | `.dmg` is ad-hoc signed | shell `codesign` check | `codesign -dv "release/mac-arm64/Spine Texture Manager.app" 2>&1 \| grep -q "Signature=adhoc"` | ❌ Wave 0 — verification command doesn't yet exist as a script |
| DIST-05 | `.exe` is unsigned | shell signtool verify (Windows only) | `signtool verify /pa release/*.exe; test $? -ne 0` | ❌ Wave 0 — Windows-only, runs in Phase 11 CI |
| DIST-06 | Installed app loads SIMPLE_TEST.json + runs Optimize Assets | **manual smoke test** (cannot be automated in v1.1) | (manual) — see Pattern 8 recipe | N/A — manual checkbox |
| DIST-07 | Filename + Info.plist version = package.json version | shell + plutil | `plutil -p "release/.../Info.plist" \| grep -q 'CFBundleShortVersionString.*"1.1.0"'` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run typecheck && npm run test` (existing vitest gate; no new tests for Phase 10 YAML changes).
- **Per phase gate:** Each platform installer is built once. Manual smoke test (Pattern 8) is run once per platform that is locally buildable (macOS for sure; Windows if user has a Windows machine; Linux deferred to Phase 11 CI smoke).
- **Phase 11 verification surface:** Linux AppImage produced + smoke-tested by CI.

This is the Nyquist floor for v1.1 distribution validation: one build, one smoke test, per platform per phase. We cannot sample more frequently because each build takes ~60–120s and the smoke test is human-driven. Deferring Linux to CI is the explicit shortcut that makes the Phase 10 cycle feasible on a single macOS host.

### Wave 0 Gaps

- [ ] `electron-builder.yml` — extend with `mac.identity: '-'`, full `win:` block, full `linux:` block, full `nsis:` and `appImage:` blocks
- [ ] `package.json` — version bump `0.0.0 → 1.1.0` (or `1.1.0-rc1`)
- [ ] `package.json` — add `build:mac`, `build:win`, `build:linux` scripts
- [ ] `build/` directory — create with `.gitkeep` to back the `directories.buildResources: build` reference
- [ ] (Optional) `build/entitlements.mac.plist` — only if smoke test fails without it
- [ ] (Optional) `scripts/verify-installer.sh` — bash script wrapping the post-build `codesign`/`plutil`/`ls` assertions for repeatability

*(No new vitest tests are required — Phase 10 is a packaging / config phase, not a behavior phase. Existing test coverage of `core/` and renderer is unchanged.)*

## Security Domain

> `security_enforcement` is not explicitly disabled in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — desktop app, no auth surface |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no | Phase 10 doesn't touch input handling; renderer + main validation is unchanged |
| V6 Cryptography | partial | Code-signing identity is the only crypto surface; ad-hoc cert is not a real cryptographic identity but the YAML key (`mac.identity: '-'`) gates which signing path runs |
| V10 Malicious Code | yes | Unsigned Windows + ad-hoc macOS = users see OS-level warnings; this is **the security surface we are explicitly accepting in v1.1** by deferring paid certs |
| V14 Configuration | yes | electron-builder config (`asarUnpack`, `files:` whitelist) controls what ships to end users; misconfig leaks source files or fixtures |

### Known Threat Patterns for {electron + sharp + electron-builder}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User runs malware-substituted installer (no sig to verify) | Spoofing | v1.1 accepted-risk; mitigated long-term by DIST-future code-signing certs |
| Tester source-file leak via `files:` glob | Information Disclosure | Current YAML uses explicit allowlist + `!src/**`, `!tests/**`, `!fixtures/**`, `!.planning/**`, `!temp/**` — verified correct |
| asarUnpack path traversal embedding host paths | Tampering | sharp 0.34's prebuilt binaries are clean; only at risk if user runs `SHARP_FORCE_GLOBAL_LIBVIPS` (which we do NOT) [CITED: lovell/sharp#4482] |
| Auto-update MITM | Tampering | n/a in Phase 10 — auto-update is Phase 12; no `publish:` block in Phase 10 means no update channel exposed yet |
| User runs old vulnerable Electron version | Elevation of Privilege | electron 41.3.0 is current as of 2026-04-27 — confirmed via npm registry; downstream phases must keep this current |

**Phase 10 security posture summary:** v1.1 ships unsigned Windows + ad-hoc macOS. This is a known accepted risk; the mitigation surface is documentation (Phase 12 INSTALL.md walks testers through OS warnings) plus a future cert-signing milestone (DIST-future). Phase 10's only NEW security-relevant change is exposing `mac.identity: '-'` and not exposing `win.certificateFile` — both are correct per the milestone scope.

## Sources

### Primary (HIGH confidence)
- **Context7 / electron-builder** (`/electron-userland/electron-builder`) — fetched 2026-04-27 — covers asarUnpack, mac/win/linux config schema, file macros, code-signing-mac, NSIS, AppImage.
- **Context7 / sharp** (`/lovell/sharp`) — fetched 2026-04-27 — covers asarUnpack patterns for sharp 0.33+, cross-platform install, electron bundler integration.
- **electron-builder docs** — https://www.electron.build/code-signing-mac.md, /nsis.md, /appimage.md, /multi-platform-build.md, /configuration.html
- **sharp docs** — https://sharp.pixelplumbing.com/install/
- **npm registry verification** — `npm view electron-builder version`, `npm view electron version`, `npm view sharp version` — all confirmed 2026-04-27.

### Secondary (MEDIUM confidence)
- **Apple Support — Safely open apps on your Mac** — https://support.apple.com/en-us/102445 — Sequoia first-launch flow.
- **iDownloadBlog (2024-08-07)** — https://www.idownloadblog.com/2024/08/07/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/ — confirms Sequoia removed right-click bypass.
- **AppImage troubleshooting** — https://docs.appimage.org/user-guide/troubleshooting/fuse.html, https://itsfoss.com/cant-run-appimage-ubuntu/ — Ubuntu 24.04 libfuse2t64.

### Tertiary (LOW confidence — flagged for validation during smoke test)
- **GitHub electron-builder #7165, #8038** — Apple Silicon Wine/qemu segfault reports; reports are 2022–2023 vintage and not retested in this session. Treat as "expect possible failure" rather than "guaranteed failure."
- **GitHub lovell/sharp #4109** — cross-platform sharp install with electron-builder; user reports the simple `asarUnpack` recipe didn't work — but the rebuttal in the thread is "do NOT pass --cpu/--os flags, just use yarn add normally + asarUnpack." Conflicting; resolution depends on host npm version.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry; existing YAML proves macOS path works.
- Architecture: HIGH for macOS DMG (proven), HIGH for NSIS config syntax (verified in ctx7 + electron.build), MEDIUM for AppImage (config syntax verified, runtime not locally testable).
- Pitfalls: MEDIUM-HIGH — sharp packaging pitfall (#1) is well-documented; cross-build pitfall (#3) has fewer current-vintage data points.
- Security: HIGH — accepted-risk posture is clearly within v1.1 scope; no novel attack surface introduced.

**Research date:** 2026-04-27

**Valid until:** 2026-05-27 (30 days; the Electron / electron-builder / sharp ecosystem is moderately stable but sharp's per-platform subpackage layout has evolved twice since 2024 — recheck if any of these libs ships a major bump).
