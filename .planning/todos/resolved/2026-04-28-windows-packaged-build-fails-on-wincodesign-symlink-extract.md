---
created: 2026-04-28T09:52:21.945Z
title: Windows packaged build fails on winCodeSign symlink extract
area: tooling
files:
  - electron-builder.yml
  - package.json
---

## Problem

`npm run build` on Windows aborts with `electron-builder` repeatedly failing to extract `winCodeSign-2.6.0.7z`. The archive contains macOS dylib symlinks (`darwin/10.12/lib/libcrypto.dylib`, `libssl.dylib`); 7-Zip throws `ERROR: Cannot create symbolic link : A required privilege is not held by the client.` because creating symlinks on Windows requires either Administrator privileges or Developer Mode. `electron-builder` retries the download 4× and gives up.

Discovered 2026-04-28 on `C:\Users\LeonardoCunha\Desktop\WORKTEMP\Spine_Texture_Manager` (Windows 10 build 22000) while verifying the [windows-atlas-images-404 fix](../../debug/resolved/windows-atlas-images-404.md). `npm run dev` works fine — the dev workflow is unaffected. Only **packaged builds** are blocked.

This is environmental, not a code regression. But it means anyone running `npm run build` on a default Windows install hits a wall, which is bad for contributors and bad for any CI build matrix that includes Windows.

Verbatim error excerpt:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client. :
  C:\Users\LeonardoCunha\AppData\Local\electron-builder\Cache\winCodeSign\<id>\darwin\10.12\lib\libcrypto.dylib
ERROR: Cannot create symbolic link : A required privilege is not held by the client. :
  C:\Users\LeonardoCunha\AppData\Local\electron-builder\Cache\winCodeSign\<id>\darwin\10.12\lib\libssl.dylib
```

## Solution

**Workarounds that exist today** (no code change required):

1. Run terminal as **Administrator** — symlink creation succeeds.
2. Enable **Windows Developer Mode** (Settings → Privacy & Security → For developers → Developer Mode) — grants non-admin symlink rights once, persists across sessions. Recommended for contributors.
3. Use `npx electron-builder --win --x64 --dir` for an unsigned, unpacked build — sidesteps the cache extract entirely. Good for quick local test builds.

**Long-term fix candidates (pick one or layer):**

- (a) **Document the prerequisite.** Cheapest. Add a "Building on Windows" subsection to README / CONTRIBUTING with the Developer-Mode steps and the `--dir` shortcut. Owns the workaround in writing so contributors don't get stuck.
- (b) **Skip macOS signing tooling on Windows builds.** Configure `electron-builder` (`electron-builder.yml`) so the `winCodeSign` cache is not pulled when building only for Windows targets. Investigate the `electronCompile`/`win.signtoolOptions`/`buildDependenciesFromSource` knobs, or pin a `winCodeSign` version that doesn't ship the offending mac symlinks. Riskier — needs validation that mac→win cross-builds don't regress.
- (c) **Pre-extract `winCodeSign` in CI only and skip on local Windows.** If we add Windows CI later, run the cache prep as a privileged step there; locally rely on (a).

Recommendation: do (a) first (low cost, high value), then evaluate (b) only if the workaround proves friction-heavy in practice.

Out of scope for this todo: the Windows atlas 404 bug itself (already fixed in `ec16b2f` and verified live).

---

## Resolved

2026-04-28 — Phase 12.1 Plan 07: README.md gained a `## Building on Windows` section between `## Commands (developer)` and `## Reporting issues` covering the 3 documented workarounds (Developer Mode / Run as Administrator / `--dir` shortcut). Verbatim error excerpt + Solution-section content moved into README.md. `npm run dev` remains unaffected — only packaged builds need the workaround.
