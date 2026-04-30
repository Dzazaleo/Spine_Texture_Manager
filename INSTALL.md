# Installing Spine Texture Manager

Pre-built installers are published to GitHub Releases for each tagged version. This guide walks through download → install → first-launch on macOS, Windows, and Linux. No `git`, Node.js, or developer tooling required.

> **Latest release:** [github.com/Dzazaleo/Spine_Texture_Manager/releases](https://github.com/Dzazaleo/Spine_Texture_Manager/releases)
>
> Pick the asset that matches your OS:
>
> - macOS (Apple Silicon): `Spine-Texture-Manager-<version>-arm64.dmg`
> - Windows (64-bit): `Spine-Texture-Manager-<version>-x64.exe`
> - Linux (64-bit AppImage): `Spine-Texture-Manager-<version>-x86_64.AppImage`

---

## macOS

**Note:** This build is signed ad-hoc, not with an Apple Developer ID. The first launch requires a one-time Gatekeeper bypass. The app behaves normally afterward — open from Applications, Launchpad, or Spotlight.

### Steps (macOS 15 Sequoia and later)

1. Download `Spine-Texture-Manager-<version>-arm64.dmg` from the Releases page.
2. Double-click the downloaded `.dmg`. macOS mounts the disk image and shows a Finder window with the app icon next to an Applications folder shortcut.
3. Drag **Spine Texture Manager.app** into **Applications**.
4. Open **Applications** in Finder and double-click **Spine Texture Manager**. macOS shows a Gatekeeper warning:

   _"Apple could not verify 'Spine Texture Manager.app' is free of malware that may harm your Mac or compromise your privacy."_ with **Move to Trash** / **Done** buttons.

   ![Gatekeeper warning dialog](docs/install-images/macos-gatekeeper-open-anyway.png)

   Click **Done** to dismiss. **Do NOT click "Move to Trash"**.

5. Open **System Settings → Privacy & Security**. Scroll down to the **Security** section. You'll see:

   _"Spine Texture Manager.app" was blocked to protect your Mac._

   Click **Open Anyway** next to it. macOS asks for your Mac password or Touch ID — confirm.

6. A second confirmation dialog appears with an actual **Open** button. Click **Open**. The app launches.

7. Future launches work normally — double-click from Applications, Spotlight (`Cmd+Space` → type "Spine Texture Manager"), or Launchpad. The Gatekeeper bypass is one-time per binary.

### Older macOS versions (14 Sonoma and earlier)

The right-click bypass path may still work as a one-step alternative on macOS 14 and earlier:

1. **Right-click** (or Control-click) the app icon in Applications. Choose **Open** from the context menu.
2. macOS shows: _"App cannot be opened because the developer cannot be verified."_ Click **Open Anyway** (or **Open**, depending on the exact macOS version).

If the right-click path doesn't show an "Open Anyway" option, fall back to the System Settings flow above (it works on every macOS version that supports the app).

### Troubleshooting

- **"App is damaged and can't be opened"**: the macOS quarantine attribute is sometimes set on downloaded files in unexpected ways. In Terminal, clear quarantine and re-attempt step 4:

  ```bash
  xattr -cr "/Applications/Spine Texture Manager.app"
  ```

---

## Windows

**Note:** This build is unsigned (no EV code-signing certificate). The first launch requires a one-time SmartScreen bypass. The app behaves normally afterward — launch from the Start Menu.

### Steps

1. Download `Spine-Texture-Manager-<version>-x64.exe` from the Releases page.
2. Double-click the downloaded `.exe`. Windows SmartScreen shows: _"Microsoft Defender SmartScreen prevented an unrecognized app from starting."_ The dialog has a **More info** link and a **Don't run** button.

   ![SmartScreen More info](docs/install-images/windows-smartscreen-more-info.png)

3. Click **More info**. The dialog expands to show "Publisher: Unknown publisher", the application file name, and a **Run anyway** button.

   ![SmartScreen Run anyway](docs/install-images/windows-smartscreen-run-anyway.png)

4. Click **Run anyway**. The NSIS installer launches.
5. Follow the installer prompts. The default install location (`%LOCALAPPDATA%\Programs\Spine Texture Manager`) is per-user — no admin rights required.
6. Launch from the Start Menu (search "Spine Texture Manager") or the Desktop shortcut if the installer offered one.

### Troubleshooting

- **The `.exe` doesn't open after Run anyway**: confirm the file is fully downloaded (size matches the GitHub Releases asset listing). If the file is truncated, redownload.
- **Antivirus quarantines the installer**: Windows Defender occasionally flags unsigned NSIS installers. Whitelist the `.exe` in your AV's quarantine list, or contact your IT department if you are on a managed machine.

---

## Linux

**Note:** This is a portable AppImage — no installer, no system-wide install. Just download, mark executable, run. Tested against Ubuntu 22.04+ and Fedora 40+.

### Steps

1. Download `Spine-Texture-Manager-<version>-x86_64.AppImage` from the Releases page.
2. Mark the file executable. In Terminal:

   ```bash
   chmod +x ~/Downloads/Spine-Texture-Manager-*.AppImage
   ```

   Or right-click in your file manager → Properties → Permissions → Allow executing as program.

3. Install the FUSE library (one-time setup; required for AppImage launch):

   **On Ubuntu 24.04 and later:**

   ```bash
   sudo apt install libfuse2t64
   ```

   **On Ubuntu 22.04 and earlier (and most other distros — Fedora, Debian 11, etc.):**

   ```bash
   sudo apt install libfuse2
   ```

   _If you skip step 3 and run the AppImage, you'll see a "dlopen(): error loading libfuse.so.2" error. That's the libfuse2-not-installed signal._

   ![Linux libfuse2 error](docs/install-images/linux-libfuse2-error.png)

   _(Screenshot deferred to v1.1.1 — placeholder until a real Ubuntu 24.04 capture lands.)_

4. Launch:

   ```bash
   ~/Downloads/Spine-Texture-Manager-*.AppImage
   ```

   Or double-click in your file manager.

### Troubleshooting

- **AppImage won't run after libfuse2 install**: confirm the file is executable (`ls -l ~/Downloads/Spine-Texture-Manager-*.AppImage` should show `-rwxr-xr-x` or similar). If not, redo `chmod +x`.
- **Wayland-only systems**: Electron apps run under XWayland by default and should work on GNOME 46+ / KDE Plasma 6 + Wayland sessions without extra configuration.

---

## After installation: auto-update

Once installed, the app checks GitHub Releases for newer versions on startup (silently — only shows a prompt if an update is available). You can also check manually via **Help → Check for Updates**.

On Linux, accepting an update downloads the new version and prompts you to restart. On macOS and Windows, the app shows a non-blocking notice with a button to open the Releases page — download the new installer manually and run it (re-triggering the first-launch Gatekeeper / SmartScreen step).

---

## Reporting issues

Found a bug? Open an issue at [github.com/Dzazaleo/Spine_Texture_Manager/issues](https://github.com/Dzazaleo/Spine_Texture_Manager/issues). Include:

- Your OS + version (e.g. macOS 14.4, Windows 11 23H2, Ubuntu 24.04).
- The app version (the file name of the installer you ran, or check **Help → About** if available).
- Steps to reproduce + the output you expected vs got.
