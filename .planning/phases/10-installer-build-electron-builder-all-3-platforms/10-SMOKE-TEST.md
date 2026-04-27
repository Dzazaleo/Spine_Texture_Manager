# Phase 10 — Installer Smoke Test Recipe

> Per-platform manual + shell verification for DIST-01..DIST-07. This document is the only DIST-06 verification path in v1.1 (sharp/libvips bundling cannot be unit-tested) and is the input contract for Phase 11 CI.

**Phase:** 10
**Locked version:** `1.1.0-rc1` (from `package.json#version`)
**Last live macOS run:** 2026-04-27 — approved. Verified against fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json AND a Girl-project fixture; non-zero PNGs + .atlas produced in both runs; no error dialogs. Gatekeeper "Open Anyway" step was not required on this developer host (likely prior trust / xattr already cleared) — bypass docs retained for fresh-install testers and Phase 11 CI. See 10-mac-assertions.log for shell evidence; see 10-03-SUMMARY.md for full run.

***

## macOS — DIST-02, DIST-04, DIST-06, DIST-07

### Build
```sh
npm run build:mac
# Produces release/Spine Texture Manager-1.1.0-rc1-arm64.dmg
# Produces release/mac-arm64/Spine Texture Manager.app
```

### Shell assertions (run after build, before manual install)

```sh
# DIST-04: ad-hoc signature
codesign -dv "release/mac-arm64/Spine Texture Manager.app" 2>&1 | grep Signature
# Expect: Signature=adhoc

# DIST-07: version embedding
plutil -p "release/mac-arm64/Spine Texture Manager.app/Contents/Info.plist" \
  | grep -E 'CFBundleShortVersionString|CFBundleVersion'
# Expect: both = "1.1.0-rc1"

# DIST-06: sharp + libvips in app.asar.unpacked
ls "release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar.unpacked/node_modules/@img/"
# Expect: sharp-darwin-arm64/  sharp-libvips-darwin-arm64/
```

### Manual Optimize Assets smoke (DIST-06 final gate)

1. Mount `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg`. Drag the app to `/Applications`.
2. **Sequoia 15.1+ Gatekeeper bypass** (the old right-click → Open flow was removed):
   - Double-click the app from `/Applications`.
   - Expect a "cannot be opened because the developer cannot be verified" dialog.
   - Open **System Settings → Privacy & Security**.
   - Scroll to the bottom; click **"Open Anyway"** next to the Spine Texture Manager row.
   - Confirm with admin password if prompted.
   - Re-launch; macOS shows a final confirmation, click **Open**. Subsequent launches work normally.
3. **Optimize Assets test:**
   - File → Open → `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (or drag-drop).
   - Wait for the Global Max Render Source panel to populate (this proves the `worker_threads` sampler survived packaging).
   - File → Optimize Assets → choose a temp folder (e.g., `~/Desktop/stm-smoke-test/`).
   - **Pass criteria:** No error dialog. The temp folder contains non-zero PNG files (one per attachment region) + a regenerated `.atlas` file.
   - **Fail signature:** dialog with `Cannot find module 'sharp'` or `dlopen failed: libvips-cpp.dylib not found`. This means `asarUnpack` regressed; re-check `electron-builder.yml` lines containing `sharp` and `@img`.

***

## Windows — DIST-01, DIST-05, DIST-06, DIST-07

> Phase 10 cross-build from macOS arm64 is fragile (RESEARCH.md Pitfall 3 — Apple Silicon Wine/qemu segfaults). Recommended path: run `npm run build:win` on a real Windows host. Phase 11 CI on `windows-latest` is the canonical Windows artifact source.

### Build (on a Windows host)
```powershell
npm run build:win
# Produces release\Spine Texture Manager-1.1.0-rc1-x64.exe
```

### Shell assertions (PowerShell, on Windows)

```powershell
# DIST-07: version embedding
(Get-Item 'release\Spine Texture Manager-1.1.0-rc1-x64.exe').VersionInfo `
  | Select FileVersion, ProductVersion
# Expect: 1.1.0-rc1  1.1.0-rc1

# DIST-05: confirm unsigned (signtool exits non-zero)
signtool verify /pa 'release\Spine Texture Manager-1.1.0-rc1-x64.exe'
# Expect: exit code != 0; "No signature found" message
```

### Manual Optimize Assets smoke (Windows)

1. Transfer `Spine Texture Manager-1.1.0-rc1-x64.exe` to a Windows machine.
2. Double-click. **SmartScreen:** "Windows protected your PC" dialog appears.
3. Click **More info** (small text link), then **Run anyway**.
4. NSIS wizard runs (per-user install — `perMachine: false`). Accept defaults.
5. Launch from Start Menu → Spine Texture Manager.
6. Same Optimize Assets recipe as macOS step 3 above.
7. **Pass:** non-zero PNGs in output folder. **Fail:** `Cannot find module '@img/sharp-win32-x64'` ⇒ Pitfall 1 host-arch trap (Windows host's `npm install` didn't fetch the Windows sharp subpackage); rerun `npm install` on the Windows host before retrying `build:win`.

***

## Linux — DIST-03, DIST-06

> Local build is best-effort per Phase 10 scope. Phase 11 CI on `ubuntu-latest` is the canonical AppImage source.

### Build (best-effort, locally or in a Linux VM)
```sh
npm run build:linux
# Produces release/Spine Texture Manager-1.1.0-rc1-x86_64.AppImage
```

### Shell assertions

```sh
# DIST-03: AppImage runs (FUSE2 must be present; Ubuntu 24.04+ needs libfuse2t64)
chmod +x "release/Spine Texture Manager-1.1.0-rc1-x86_64.AppImage"
"./release/Spine Texture Manager-1.1.0-rc1-x86_64.AppImage" --appimage-extract-and-run --version
# Expect: app version printed (1.1.0-rc1 or similar), no FUSE errors
```

### Manual Optimize Assets smoke (Linux)

Same recipe as macOS step 3, with `chmod +x` + `./AppImage` to launch. If `dlopen(): error loading libfuse.so.2`: tester needs `sudo apt install libfuse2t64` on Ubuntu 24.04+ (per RESEARCH.md Pitfall 5).

***

## Phase 10 acceptance summary

| Requirement | Verification | Surface |
|-------------|--------------|---------|
| DIST-01 | `npm run build:win` produces `.exe` on a Windows host (or via Phase 11 CI) | Windows-only |
| DIST-02 | `npm run build:mac` produces `.dmg`; this plan's macOS run is the live evidence | macOS (this plan) |
| DIST-03 | `electron-builder.yml` `linux:` block parses; AppImage produced by Phase 11 CI | YAML completeness (Plan 02) + Phase 11 CI |
| DIST-04 | `codesign -dv` shows `Signature=adhoc` on macOS .app | macOS shell (this plan) |
| DIST-05 | `signtool verify` exits non-zero on Windows .exe | Windows shell or absence of `certificateFile` keys (Plan 02) |
| DIST-06 | Manual Optimize Assets export produces non-zero PNGs after install | Manual smoke (this plan + tester rounds) |
| DIST-07 | Filenames include `1.1.0-rc1`; `Info.plist` `CFBundleShortVersionString = "1.1.0-rc1"`; Win VERSIONINFO matches | Shell (this plan, macOS) + Phase 11 CI Windows |

Failure handling: if any shell assertion fails on macOS, treat as a Phase 10 regression — re-read RESEARCH.md "Anti-Patterns" + this plan's `<read_first>` block before proceeding.
