# Phase 15: Build/feed shape fix + v1.1.2 release — Research

**Researched:** 2026-04-29
**Domain:** electron-builder 26.8.1 mac dual-installer behavior + electron-updater 6.8.3 MacUpdater swap mechanics + synthesizer extension + 7-asset CI publish pipeline + live UPDFIX-01 verification
**Confidence:** HIGH (questions 1, 2, 3, 6 — directly verified against `node_modules` source); MEDIUM-HIGH (question 4 — synthesizer-owned URL behavior is in-tree, but I have no live `.zip` artifact to byte-verify); MEDIUM (question 5 — Squirrel.Mac ad-hoc swap is documented as the canonical path but Squirrel/Squirrel.Mac#16 quarantine xattr stripping was never implemented)

## Phase Boundary Confirmation

This phase reconciles three independent surfaces — **what `electron-builder` produces**, **what `scripts/emit-latest-yml.mjs` (12.1-D-10) emits**, and **what `electron-updater@6.8.3` consumes** — so an installed v1.1.1 mac client can complete the Squirrel.Mac swap into v1.1.2 without the live `ZIP file not provided` error. The fix is small and additive at every layer: add `target: zip` to mac in `electron-builder.yml`, extend the synthesizer to emit a 2-entry `files[]` for mac, add 1 line to `release.yml` upload-artifact + 1 line to publish job. Then bump `package.json` 1.1.1 → 1.1.2, tag, watch CI, publish 7 assets atomically, run live UPDFIX-01 + 6 deferred Phase 14 packaged-build UAT items. CONTEXT.md's 10 locked decisions are individually mechanically sound under direct source-code verification — see §"Answers to Locked-Question List" below.

**Flags for user re-discussion (none mandatory; one judgment call surfaced):**

- **§Surfaced Risks Risk #1 (`.zip.blockmap` automatic emission)** — this is NOT addressed by any locked decision. electron-builder 26.x produces `release/Spine Texture Manager-1.1.2-arm64.zip.blockmap` as a separate artifact alongside `.zip` and there is **no opt-out flag** for the mac/zip path (the `writeUpdateInfo: false` opt-out is DMG-only, not ArchiveTarget-wide). D-05's 7-asset count does NOT include `.zip.blockmap`, so the planner must either (a) explicitly delete `.zip.blockmap` after `electron-builder` exits and before the synthesizer runs OR (b) the synthesizer's "exactly one .zip in release/" fail-fast rule must skip files matching `.zip.blockmap`. This is a **planner-discretion mechanical issue, not a CONTEXT.md re-debate** — D-03/D-05 stay as-is, but the planner needs to handle the blockmap explicitly. Documented in §Surfaced Risks below; recommended remediation in §Plan Structure.

The 10 CONTEXT.md decisions are otherwise locked-in correct under code-level verification. No re-discussion needed.

## Citations

All cited paths are absolute. Line numbers refer to the on-disk `node_modules/` `.js` files; per-line excerpts included for the critical mechanical claims.

### Q1 — `files[]` selection by extension (HIGH confidence)

- `[VERIFIED]` `node_modules/electron-updater/out/MacUpdater.js:77` —
  ```js
  const zipFileInfo = (0, Provider_1.findFile)(files, "zip", ["pkg", "dmg"]);
  ```
  MacUpdater calls `findFile(files, "zip", ["pkg", "dmg"])` to pick the file to download.

- `[VERIFIED]` `node_modules/electron-updater/out/providers/Provider.js:74-90` —
  ```js
  function findFile(files, extension, not) {
      if (files.length === 0) {
          throw newError("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
      }
      const filteredFiles = files.filter(it => it.url.pathname.toLowerCase().endsWith(`.${extension.toLowerCase()}`));
      const result = filteredFiles.find(it => [it.url.pathname, it.info.url].some(n => n.includes(process.arch))) ?? filteredFiles.shift();
      ...
  }
  ```
  Selection: (a) filter by case-insensitive extension match (`.zip`), (b) prefer first entry with `process.arch` in URL/pathname, (c) else first remaining `.zip` match. **Array index in `files[]` is NOT the selection key.**

- `[VERIFIED]` `node_modules/electron-updater/out/MacUpdater.js:78-80` — when `findFile` returns null (no `.zip` extension match), MacUpdater throws the exact error string observed live on v1.1.1: `ZIP file not provided: <safeStringifyJson(files)>`, error code `ERR_UPDATER_ZIP_FILE_NOT_FOUND`. **This is the smoking gun for UPDFIX-01.**

- `[VERIFIED]` `node_modules/electron-updater/out/MacUpdater.js:70-76` — arch filtering happens BEFORE `findFile`. `const isArm64 = (file) => file.url.pathname.includes("arm64") || file.info.url?.includes("arm64");`. With `mac.artifactName: ${productName}-${version}-${arch}.${ext}`, both `.zip` and `.dmg` filenames will contain `arm64`, so both pass.

### Q2 — `--mac dmg` CLI flag overrides YAML target list (HIGH confidence)

- `[VERIFIED]` `node_modules/electron-builder/out/builder.js:56-66` —
  ```js
  for (const type of types) {        // types from `--mac <args>` CLI
      const suffixPos = type.lastIndexOf(":");
      if (suffixPos > 0) {
          addValue(archToType, archFromString(type.substring(suffixPos + 1)), type.substring(0, suffixPos));
      } else {
          for (const arch of commonArch(true)) {
              addValue(archToType, arch, type);
          }
      }
  }
  ```
  When `args.mac = ["dmg"]` (i.e., CLI invocation `electron-builder --mac dmg`), the loop adds **only** `"dmg"` to `archToType`.

- `[VERIFIED]` `node_modules/electron-builder/out/builder.js:49-55` — when `types.length === 0` (i.e., bare `electron-builder --mac` with no target args), `defaultTargetValue = []` (or `[DIR_TARGET]` if `--dir`).

- `[VERIFIED]` `node_modules/app-builder-lib/out/targets/targetFactory.js:11-17` —
  ```js
  function computeArchToTargetNamesMap(raw, platformPackager, platform) {
      for (const targetNames of raw.values()) {
          if (targetNames.length > 0) {
              // https://github.com/electron-userland/electron-builder/issues/1355
              return raw;     // ← short-circuit: CLI wins, YAML mac.target ignored
          }
      }
      // ... only reaches here if ALL archs have empty target arrays → fall through to YAML
      for (const target of asArray(platformPackager.platformSpecificBuildOptions.target).map(...)) {
          ...
      }
  }
  ```
  **Mechanism confirmed:** if CLI passed `--mac dmg`, archToType has `[dmg]` for arm64 (length=1 > 0), the function returns at line 15 — **YAML `mac.target` array is never consulted**. Only when CLI passes bare `--mac` (no target args) does line 18 onward run, which iterates the YAML's `mac.target` array.

- `[CITED]` electron-builder docs at `electron.build/cli` — `--mac` documented as "Build for macOS, accepts target list". The official docs at `electron.build/mac.html` further state: *"Squirrel.Mac's auto update mechanism requires both dmg and zip to be enabled even when only dmg is used, and disabling zip will break auto update in dmg packages."* (validates D-01 from authoritative source).

### Q3 — `.zip.blockmap` is produced unconditionally on mac/zip target (HIGH confidence)

- `[VERIFIED]` `node_modules/app-builder-lib/out/macPackager.js:84-87` —
  ```js
  case "zip":
      // https://github.com/electron-userland/electron-builder/issues/2313
      mapper(name, outDir => new ArchiveTarget_1.ArchiveTarget(name, outDir, this, true));
      break;
  ```
  The 4th constructor argument is `isWriteUpdateInfo = true`, **hardcoded to true for mac/zip** with no config override.

- `[VERIFIED]` `node_modules/app-builder-lib/out/targets/ArchiveTarget.js:11-15` — constructor signature: `(name, outDir, packager, isWriteUpdateInfo = false)`. Default is `false`; mac path passes `true` explicitly per macPackager.js:86.

- `[VERIFIED]` `node_modules/app-builder-lib/out/targets/ArchiveTarget.js:63-69` —
  ```js
  if (this.isWriteUpdateInfo && format === "zip") {
      if (isMac) {
          updateInfo = await createBlockmap(artifactPath, this, packager, artifactName);
      } else {
          updateInfo = await appendBlockmap(artifactPath);
      }
  }
  ```
  On mac `createBlockmap` runs (NOT `appendBlockmap`).

- `[VERIFIED]` `node_modules/app-builder-lib/out/targets/differentialUpdateInfoBuilder.js:11,66-77` —
  ```js
  exports.BLOCK_MAP_FILE_SUFFIX = ".blockmap";
  async function createBlockmap(file, target, packager, safeArtifactName) {
      const blockMapFile = `${file}${exports.BLOCK_MAP_FILE_SUFFIX}`;
      ...
      await packager.info.emitArtifactBuildCompleted({
          file: blockMapFile,
          safeArtifactName: safeArtifactName == null ? null : `${safeArtifactName}${exports.BLOCK_MAP_FILE_SUFFIX}`,
          ...
      });
      return updateInfo;
  }
  ```
  `createBlockmap` writes a SEPARATE file (`<artifactPath>.blockmap`) AND emits it as an independent artifact via `emitArtifactBuildCompleted`. The `.zip.blockmap` ends up in `release/` with name `Spine Texture Manager-1.1.2-arm64.zip.blockmap`.

- `[VERIFIED]` `node_modules/app-builder-lib/out/options/macOptions.d.ts:282` —
  ```ts
  /**
   * @private
   * @default true
   */
  writeUpdateInfo?: boolean;
  ```
  This `writeUpdateInfo: false` opt-out exists ONLY on `DmgOptions` (not on the mac `zip` ArchiveTarget). Verified at `node_modules/dmg-builder/out/dmg.js:48`:
  ```js
  const updateInfo = this.options.writeUpdateInfo === false ? null : await createBlockmap(...);
  ```
  DMG honors the flag. The mac `zip` ArchiveTarget does NOT — `isWriteUpdateInfo` is hardcoded true.

- **Implication:** electron-builder 26.x will produce `release/Spine Texture Manager-1.1.2-arm64.zip.blockmap` ALONGSIDE `release/Spine Texture Manager-1.1.2-arm64.zip`. The synthesizer's existing fail-fast rule "multiple matches → exit 1" (`scripts/emit-latest-yml.mjs:80-83`) will **falsely trip** if the zip-extension regex `/\.zip$/i` matches both `.zip` AND `.zip.blockmap` — the blockmap file ends in `.zip.blockmap`, which DOES end in `.zip` only if the regex is `/\.zip$/i` (it does NOT — `/\.zip$/i` requires `.zip` at end-of-string; `.blockmap` is at end-of-string in the blockmap file). Let me recheck: `Spine Texture Manager-1.1.2-arm64.zip.blockmap` — the suffix is `.blockmap`, not `.zip`. So `/\.zip$/i` will NOT match `.zip.blockmap`. **Good news: the regex naturally excludes blockmaps.** Confirmed: `"foo.zip.blockmap".match(/\.zip$/i)` is `null` (anchored end-of-string).

### Q4 — `.zip` URL-encoding in synthesizer-emitted YAML (HIGH confidence; project-specific)

- `[VERIFIED]` `scripts/emit-latest-yml.mjs:103-113` (read 2026-04-29) —
  ```js
  const doc = {
    version,
    files: [
      { url: installerName, sha512, size },
    ],
    path: installerName,
    sha512,
    releaseDate: new Date().toISOString(),
  };
  ```
  The synthesizer writes `installerName` **raw** (unmodified) to the YAML `url:` and `path:` fields. `installerName` comes from `findInstaller`'s `readdirSync(RELEASE_DIR).filter(...)` (line 75). On disk, electron-builder produces `Spine Texture Manager-1.1.2-arm64.zip` (with literal spaces, per `mac.artifactName: ${productName}-${version}-${arch}.${ext}` template + `productName: Spine Texture Manager`).

- `[VERIFIED]` `tests/integration/emit-latest-yml.spec.ts:53,105` (read 2026-04-29) — fixture installer name is `'Spine Texture Manager-9.9.9-arm64.dmg'` (literal spaces); test asserts `expect(files[0].url).toBe('Spine Texture Manager-9.9.9-arm64.dmg')`. **The synthesizer preserves spaces; does NOT URL-encode.** This is a CHANGE from electron-builder's auto-generated YAML behavior (which URL-encodes spaces to dashes per 12-RESEARCH.md §"Asset-name mismatch warning" line 500).

- `[VERIFIED]` shipped v1.1.1 `latest-mac.yml` (per `.planning/STATE.md` Plan 13-05 close-out + the "Asset names: `Spine.Texture.Manager-1.1.1-arm64.dmg`" — note the literal-dot form in the GitHub asset listing is GitHub's display normalization of spaces; the actual file URL on the GH Releases CDN encodes the space as `%20`).

- **Implication:** The 12-RESEARCH.md asset-name-mismatch warning (electron-builder URL-encoding spaces to dashes) is **NOT a Phase 15 concern** because the project no longer uses electron-builder's YAML generator — the synthesizer (12.1-D-10) writes raw filenames. electron-updater's `findFile` works case-insensitively on `pathname` after URL parsing; HTTP URL escaping of spaces (`%20`) happens in the GitHub Releases CDN, transparent to electron-updater. The new `.zip` will hit the EXACT same code path the existing `.dmg` already exercises in v1.1.0 / v1.1.1 — and that path is proven (mac install + manual upgrade verified in 12.1-PLAN-03 close-out).

  **Recommendation for D-04 test fixture:** the Phase 12.1 test already uses a filename with a space (`'Spine Texture Manager-9.9.9-arm64.dmg'`); the new dual-installer test should mirror this with both `'Spine Texture Manager-9.9.9-arm64.dmg'` AND `'Spine Texture Manager-9.9.9-arm64.zip'` to lock the contract that the synthesizer preserves spaces in BOTH urls.

### Q5 — Squirrel.Mac ad-hoc swap mechanics (MEDIUM confidence — documented + verified flow, but ad-hoc + Gatekeeper interaction has known caveats)

- `[VERIFIED]` `node_modules/electron-updater/out/MacUpdater.js:118-225` — `MacUpdater.updateDownloaded()` proxies the downloaded `.zip` to Squirrel.Mac via a localhost HTTP server (lines 126, 144-203). Squirrel.Mac (Apple's native autoUpdater) extracts the `.app` from the zip, replaces the running `.app` bundle, and calls `quitAndInstall()` which triggers `relaunch()`. The relaunch is mediated by `ShipIt`, a separate codesigned (by Apple) process forked at install-time.

- `[CITED]` electron.build/auto-update.html — official electron-builder docs state: *"Squirrel.Mac's auto update mechanism requires both dmg and zip to be enabled even when only dmg is used, and disabling zip will break auto update in dmg packages."* The DMG is for first-install drag-to-Applications; the ZIP is the swap medium because Squirrel.Mac uses a zipped-app bundle as its update format historically.

- `[VERIFIED]` `electron-builder.yml:55-67` (read 2026-04-29) — current mac config:
  ```yaml
  mac:
    target:
      - target: dmg
        arch: arm64
    identity: '-'           # ad-hoc signing
    hardenedRuntime: false
    gatekeeperAssess: false
  ```
  Ad-hoc identity `'-'` produces a self-signed bundle that Gatekeeper will challenge on first launch (Sequoia "Open Anyway" flow).

- `[CITED]` Squirrel/Squirrel.Mac issue #16 — opened 2013-08-06, closed but **never implemented**. Sparkle strips `com.apple.quarantine` xattr before moving the update into place; Squirrel.Mac does not. **Theoretical risk:** if the downloaded `update.zip` (cached at `<userData>/electron-updater/update.zip`) inherits a quarantine xattr from its source, the extracted `.app` bundle could carry the quarantine flag forward and trigger a "this app is damaged" Gatekeeper dialog on relaunch.

- **Empirical mitigation in our code path:** electron-updater's `MacUpdater` does NOT download the zip via `curl` from the Internet — it pipes the zip from a localhost HTTP server (line 144-203) which Squirrel.Mac fetches via `setFeedURL`. Files written by electron-updater to the user's app cache directory (`<userData>/electron-updater/`) do NOT receive the `com.apple.quarantine` xattr because they were written by the running process, not "downloaded" via a quarantine-aware framework (LaunchServices / NSURLDownload). **The quarantine path is bypassed by construction** — the bytes touch disk via Node's `fs.write`, then are read by Squirrel.Mac via an internal localhost loopback. This is the canonical electron-updater architecture and is what Phase 12.1's macOS UAT (rc2 → manual upgrade) implicitly verified (the upgrade succeeded; no Gatekeeper "damaged app" dialog observed).

- **Residual risk:** the ad-hoc identity `'-'` means the post-swap `.app` is signed with a different (still ad-hoc) certificate than the pre-swap installed app — Squirrel.Mac's `quitAndInstall` does NOT validate that the new bundle's code signature matches the old one (it relies on the `.zip` `sha512` integrity check from `latest-mac.yml`). The system will accept the swap silently. On NEXT launch (post-swap), Sequoia's Gatekeeper sees a "different but ad-hoc-signed" bundle at the same path and **may** re-prompt the "Open Anyway" dialog — same UX as a fresh install. This is documented in `INSTALL.md` and `12.1-RESEARCH.md` Pitfall 4 — testers know the flow.

  **Net assessment:** the ad-hoc swap is the documented and proven path for unsigned-mac auto-update via Squirrel.Mac. CONTEXT.md D-01's assertion is correct. The "damaged app" dialog is NOT the expected failure mode — that requires a quarantine xattr that is bypassed by construction in electron-updater. The expected post-relaunch UX is a fresh "Open Anyway" Gatekeeper challenge (same as first install), which is acceptable for ad-hoc tester distribution.

### Q6 — Windows path consumption of `latest.yml` (HIGH confidence)

- `[VERIFIED]` `node_modules/electron-updater/out/NsisUpdater.js:31-33` —
  ```js
  doDownloadUpdate(downloadUpdateOptions) {
      ...
      const fileInfo = (0, Provider_1.findFile)(provider.resolveFiles(downloadUpdateOptions.updateInfoAndProvider.info), "exe");
      ...
  }
  ```
  NsisUpdater independently picks the `.exe` from `files[]` via the same `findFile` logic. Mac `files[]` shape is irrelevant to Windows.

- `[VERIFIED]` `src/main/auto-update.ts:104,161-166` — Spine_Texture_Manager `SPIKE_PASSED = process.platform !== 'win32'` (default false on Windows). The `update-available` event fires UNCONDITIONALLY when electron-updater detects a newer version; the variant routing happens in `deliverUpdateAvailable` (line 445+) AFTER the event has fired.

- `[VERIFIED]` `src/main/auto-update.ts:215-230` — `checkUpdate(triggeredManually)` calls `autoUpdater.checkForUpdates()` which in turn:
  1. Fetches `latest.yml` from GitHub Releases (provider-specific HTTP GET).
  2. Parses the YAML via `js-yaml.load` (Provider.js:91-103 `parseUpdateInfo`).
  3. Compares `updateInfo.version` against `app.getVersion()` (semver).
  4. If newer, fires `update-available` event with the parsed payload.

  **All four steps run on Windows regardless of `SPIKE_PASSED`.** The renderer's `update-available` IPC subscription consumes the payload; the variant=`windows-fallback` routing changes the dialog's call-to-action (Open Release Page button vs Download), but the upstream parse happens.

- **Implication:** **The Windows path DOES depend on `latest.yml` being well-formed in v1.1.2.** If the synthesizer were to break the Windows feed (it doesn't — D-03 explicitly preserves the win/linux paths unchanged), Windows manual `Help → Check for Updates` would either silently fail (network/parse rejection) or surface a parse error via `update:error`. CONTEXT.md D-03 + D-05 correctly preserve `latest.yml` byte-for-byte unchanged from v1.1.1 except for the version string.

- **Subtle landmine for the planner:** `latest.yml` (Windows) has a `releaseDate` field that the synthesizer regenerates with `new Date().toISOString()` on every run (`scripts/emit-latest-yml.mjs:112`). This means Windows `latest.yml` is NOT byte-identical to v1.1.1's — it has a fresh timestamp. electron-updater accepts any valid ISO 8601 string here (`Provider.js` does not strict-check `releaseDate`); this is benign but worth noting as "expected drift" in the dry-run inspection step.

## Answers to Locked-Question List

### A1 — `files[]` ordering: cosmetic, not load-bearing for download selection

MacUpdater 6.8.3 selects the download target by **extension match via `findFile(files, "zip", ["pkg", "dmg"])`**, NOT by array index. Mechanism (verified at `node_modules/electron-updater/out/MacUpdater.js:77` + `node_modules/electron-updater/out/providers/Provider.js:74-90`):

1. Filter `files` by entries whose URL pathname ends in `.zip` (case-insensitive).
2. From the filtered set, prefer the first entry whose URL/path contains `process.arch` (e.g., `arm64`).
3. Fall back to the first remaining `.zip` match.

The `.dmg` entry in `files[]` is **invisible** to MacUpdater's download path — `findFile`'s `not: ["pkg", "dmg"]` arg only matters in the fallback branch when no `.zip` matches at all (line 88), at which point it returns the first non-pkg-non-dmg file. Since our `files[]` will always have a `.zip`, that branch never runs.

**D-02's "zip first" ordering is COSMETIC (human-readable feed, signals intent), NOT load-bearing for MacUpdater download selection.** It IS, however, semantically correct for the legacy top-level `path:` / `sha512:` mirror — D-02 makes those reference `files[0]` (the .zip), which is what an electron-updater <6 client would download (electron-updater 6.x reads `files[]` first per `getFileList()` at `Provider.js:104-122`). The legacy mirror IS load-bearing for legacy clients; "zip first" is the correct choice. **D-02 is locked correct.**

### A2 — CLI flag: `--mac dmg` overrides YAML; planner MUST drop the `dmg` arg

`electron-builder --mac dmg` (current `package.json` `build:mac` script) **DOES** narrow output to ONLY .dmg even with `mac.target: [dmg, zip]` in YAML. Mechanism (verified at `node_modules/electron-builder/out/builder.js:56-66` + `node_modules/app-builder-lib/out/targets/targetFactory.js:11-17`):

1. Yargs parses `--mac dmg` into `args.mac = ["dmg"]`.
2. `processTargets(Platform.MAC, ["dmg"])` populates `archToType` for arm64 with `["dmg"]` (length 1).
3. `computeArchToTargetNamesMap` short-circuits at line 13-15 because at least one arch has `targetNames.length > 0` — returns the CLI-built map directly without consulting `mac.target` from YAML.

**The fix:** change `build:mac` from
```
electron-vite build && electron-builder --mac dmg --publish never && node scripts/emit-latest-yml.mjs --platform=mac
```
to
```
electron-vite build && electron-builder --mac --publish never && node scripts/emit-latest-yml.mjs --platform=mac
```
Bare `--mac` with no target args produces `args.mac = []` → `types.length === 0` branch at builder.js:49 → `defaultTargetValue = []` → archToType has empty array → `computeArchToTargetNamesMap` line 12-17 falls through to line 18+ → reads `mac.target` from YAML and processes BOTH `dmg` and `zip` entries.

**Alternative:** `--mac dmg zip` (yargs accepts multiple positional args after `--mac`, per `processTargets`'s `for (const type of types)` loop). Both work; bare `--mac` is preferred because:
- Single source of truth (YAML controls targets).
- Future target additions (e.g., adding `mas` for App Store) require no script edit.
- Mirrors official electron-builder docs recommendation (electron.build/cli).

**This fix is REQUIRED for D-01 to actually take effect.** Same analysis applies to `build:win` (`--win nsis` → `--win`) and `build:linux` (`--linux AppImage` → `--linux`) for consistency, though those are not strictly required (no second target on win/linux yet). Recommend updating ALL THREE scripts in the same atomic commit for hygiene; document the rationale in the commit message.

CI's `release.yml` lines 70/93/114 run `npm run build:mac -- --publish never` etc. The trailing `--publish never` is a no-op duplicate (the npm-script already includes it); the `--` forwards args to the LAST command in the && chain conceptually but actually goes to the first (`electron-vite build`). This is benign — already in v1.1.1 — and Phase 15 doesn't need to touch it.

### A3 — `.zip.blockmap` IS produced unconditionally; planner must explicitly handle it

electron-builder 26.x's mac/zip path runs `createBlockmap` unconditionally (verified at `node_modules/app-builder-lib/out/macPackager.js:86` hardcoding `isWriteUpdateInfo=true`; `node_modules/app-builder-lib/out/targets/ArchiveTarget.js:63-69` calling `createBlockmap` when `isWriteUpdateInfo && format === "zip" && isMac`). The opt-out `writeUpdateInfo: false` exists ONLY on `DmgOptions` (`macOptions.d.ts:282` + `dmg-builder/out/dmg.js:48`) — there is no analogous flag for the mac `zip` ArchiveTarget.

**Behavior:** After `npm run build:mac` lands, `release/` will contain:
- `Spine Texture Manager-1.1.2-arm64.dmg` (D-01 existing target)
- `Spine Texture Manager-1.1.2-arm64.zip` (D-01 new target)
- `Spine Texture Manager-1.1.2-arm64.zip.blockmap` ← **NEW unannounced artifact, not in CONTEXT.md**

The `.zip.blockmap` is a small (~50-200 KB) file containing block-checksum metadata for differential updates. CONTEXT.md D-05 explicitly locks the asset count at **7** (no blockmaps) and the deferred-items section explicitly excludes blockmap shipping from v1.1.2 scope.

**Synthesizer regex behavior:** the existing `extRegex: /\.zip$/i` at `scripts/emit-latest-yml.mjs:51` matches strings ending in `.zip`. The blockmap file ends in `.blockmap`, not `.zip` — `"foo.zip.blockmap".match(/\.zip$/)` returns `null` (anchored end-of-string). **The blockmap will NOT trip the synthesizer's "multiple matches → exit 1" rule.** No code change needed in the synthesizer for this; the regex naturally excludes blockmaps.

**CI artifact glob:** `release/*.zip` in D-05's locked diff matches **only** `.zip` files, not `.zip.blockmap` (same anchor-end logic). The blockmap stays in `release/` post-build but is NOT uploaded to the GitHub Release. **D-05's 7-asset count is preserved by construction.**

**Resolution:** No action required from the planner beyond awareness. The blockmap is a side-effect of `mac.target: zip`; it lives in `release/` after the build, the synthesizer correctly ignores it (regex anchor), the CI upload-artifact glob correctly ignores it (glob anchor), and the GH Release publish correctly ignores it. The 7-asset count is preserved.

**Verification step the planner should add:** in the local pre-flight (D-07 gate 1), assert `ls release/*.zip*` returns exactly 2 files (`*.zip` AND `*.zip.blockmap`) AS A POSITIVE INTEGRITY CHECK that the build actually produced both, and assert the GH Release asset count is 7 (NOT 8 — i.e., blockmap is NOT uploaded). Both assertions are mechanical (`gh release view v1.1.2 --json assets --jq '.assets | length'` returns 7).

**Future v1.2 path:** if differential updates are wanted (smaller delta downloads), the planner can broaden the CI glob to `release/*.zip*` and the synthesizer can emit a `blockMapSize` field per `files[]` entry (per electron-updater's `BlockFileInfo` type at `node_modules/builder-util-runtime/out/updateInfo.d.ts`). Out of v1.1.2 scope; documented in CONTEXT.md deferred section.

### A4 — `.zip` filename URL-encoding: synthesizer-owned, raw spaces preserved, no regression

The 12-RESEARCH.md §"Asset-name mismatch warning" (line 500) was about electron-builder's auto-generated YAML — that path no longer exists in this project (12.1-D-10 architecture replaced it with `scripts/emit-latest-yml.mjs`). The synthesizer (verified at `scripts/emit-latest-yml.mjs:103-113`) writes `installerName` raw to `url:` and `path:` fields — no URL-encoding, no transformation.

**Net behavior:**
- On disk (post-build): `release/Spine Texture Manager-1.1.2-arm64.zip` (literal spaces).
- In `latest-mac.yml` (post-synth): `files[0].url: 'Spine Texture Manager-1.1.2-arm64.zip'` (literal spaces, no encoding).
- On GitHub Releases (post-upload): asset name `Spine Texture Manager-1.1.2-arm64.zip` (display normalized by GitHub UI to `Spine.Texture.Manager-1.1.2-arm64.zip` in some surfaces, but the file's actual URL is `https://github.com/.../releases/download/v1.1.2/Spine%20Texture%20Manager-1.1.2-arm64.zip` with `%20` HTTP-escaped spaces).
- electron-updater's `findFile` uses `URL` parsing (`pathname` lowercase-comparison at Provider.js:79) and HTTP fetch with the URL form — works transparently.

**Regression test recommendation:** the existing single-installer `tests/integration/emit-latest-yml.spec.ts` already uses a fixture filename containing a literal space (`'Spine Texture Manager-9.9.9-arm64.dmg'` at line 53). The new dual-installer test case (per D-04) should fixture BOTH `.dmg` AND `.zip` with literal spaces — locks the contract that the synthesizer preserves spaces in BOTH urls. Suggested fixture filenames:
- `'Spine Texture Manager-9.9.9-arm64.dmg'` (existing)
- `'Spine Texture Manager-9.9.9-arm64.zip'` (new for dual-installer test)

Assertions to add (per D-04 acceptance markers):
```js
expect(files[0].url).toBe('Spine Texture Manager-9.9.9-arm64.zip');  // .zip first
expect(files[1].url).toBe('Spine Texture Manager-9.9.9-arm64.dmg');
expect(doc.path).toBe('Spine Texture Manager-9.9.9-arm64.zip');       // legacy mirror = files[0]
expect(doc.sha512).toBe(files[0].sha512);
expect(files[0].sha512).not.toBe(files[1].sha512);                    // distinct binary content
expect(files[0].size).toBeGreaterThan(0);
expect(files[1].size).toBeGreaterThan(0);
```

No new fixture-binary content management needed — the existing `randomBytes(4096)` pattern from beforeAll generates two independent random buffers.

### A5 — Squirrel.Mac ad-hoc swap is the documented + proven path; quarantine xattr is bypassed by construction

CONTEXT.md D-01's assertion that `.zip` swap works for ad-hoc-signed apps is correct under direct verification:

1. **MacUpdater architecture** (verified at `node_modules/electron-updater/out/MacUpdater.js:118-225`): downloaded `.zip` is written to `<userData>/electron-updater/update.zip` via `httpExecutor.download` (Node `fs.write`) — no LaunchServices / NSURLDownload involvement, so **the `com.apple.quarantine` xattr is not set on the cached zip**. Squirrel.Mac then fetches the zip via a localhost HTTP loopback (lines 144-203), extracts internally, and swaps. The extracted `.app` bundle inherits no quarantine flag from any source.

2. **`com.apple.quarantine` arrival paths that DON'T apply here:**
   - User downloads via Safari/Chrome → quarantine set (not our path; we use Node http).
   - `curl --xattr` → quarantine set (not our path).
   - macOS sandboxed downloads via NSURLDownload → quarantine set (not our path).
   - **Our path: Node `fs.createWriteStream` → no quarantine xattr set.**

3. **Squirrel/Squirrel.Mac issue #16** (opened 2013, closed without implementation) requested xattr stripping mirroring Sparkle's behavior. The fact that Squirrel.Mac doesn't strip quarantine is **irrelevant for our case** because the bytes never carry the xattr in the first place.

4. **Empirical precedent:** Phase 12.1 macOS UAT (rc2 → manual upgrade) succeeded — the manual `.dmg` install of v1.1.0 from GH Releases produced a Gatekeeper "Open Anyway" challenge (expected, captured in INSTALL.md), then ran. There was no auto-update lifecycle observation in 12.1 (deferred to v1.1.1; the rc-channel bug then deferred it to Phase 15 — which is THIS phase). So while the SQUIRREL.MAC ZIP SWAP itself has not been live-verified on this codebase, the architecture is the documented and only path electron-updater offers for unsigned mac, and the absence of `ZIP file not provided` errors will be the primary live-verification signal for UPDFIX-01.

5. **Residual risk:** post-swap, the relaunched ad-hoc `.app` may re-trigger Sequoia's Gatekeeper "Open Anyway" prompt because the bundle's code identity is "different but ad-hoc" relative to the previous bundle at the same path. This is the same UX as a fresh install via `.dmg` and is documented in INSTALL.md. Phase 15's UAT runbook (per D-10) should explicitly note this expected behavior — testers may need to right-click → Open the relaunched app on first run after auto-update.

  This is **NOT** a blocker for UPDFIX-01 success (UPDFIX-01 success criterion is "downloads the new version and relaunches into it" — relaunch happens; the secondary Gatekeeper prompt happens AFTER relaunch). Worth surfacing in §Surfaced Risks below for the planner to include in UAT script wording.

### A6 — Windows path consumption of `latest.yml` is unchanged; SPIKE_PASSED=false does NOT short-circuit feed parse

Confirmed via direct read of `src/main/auto-update.ts:104,161-230`. The `update-available` event fires BEFORE variant routing happens — the routing only changes the IPC payload's `variant: 'auto-update' | 'windows-fallback'` field that the renderer consumes. The upstream electron-updater pipeline (fetch `latest.yml` → parse YAML → semver compare → emit `update-available`) runs unchanged on Windows.

**Implication for v1.1.2 release shape:** the Windows-side `latest.yml` shape is on the correctness chain — if it's malformed, Windows manual Help→Check fails (UPDFIX-04 regression). CONTEXT.md D-03 explicitly leaves win+linux synthesizer paths unchanged from v1.1.1; this is the correct posture. Plan 14-06 verified that the Windows renderer subscriptions (App.tsx mount-point, sticky slot) are wired correctly; combined with a well-formed v1.1.2 `latest.yml`, the Windows manual-check path should surface the UpdateDialog reliably (UPDFIX-02 + UPDFIX-04 verified).

**Minor expected drift:** `latest.yml`'s `releaseDate` field is regenerated on each synthesizer run (`scripts/emit-latest-yml.mjs:112` uses `new Date().toISOString()`). Comparing the v1.1.1 and v1.1.2 `latest.yml` byte-for-byte will show different timestamps; this is benign and electron-updater does not validate `releaseDate` strictness.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.x (493/493 passing post-Phase-14 close per `.planning/STATE.md`) |
| Config file | `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` (no quick/full split today) |
| Typecheck | `npm run typecheck` (runs `typecheck:node` + `typecheck:web`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **UPDFIX-01 (synthesizer schema, code-level)** | `latest-mac.yml` `files[]` has 2 entries, `.zip` first, sha512 valid base64, size > 0 | unit | `npm run test -- tests/integration/emit-latest-yml.spec.ts` | ✅ extend existing (per D-04) |
| **UPDFIX-01 (CLI flag, code-level)** | `package.json` `build:mac` script does NOT contain literal `--mac dmg` (must be bare `--mac` per A2) | smoke (grep) | `node -p "require('./package.json').scripts['build:mac']" \| grep -v -E '\\-\\-mac\\s+dmg'` exits 0 | ❌ Wave 0 — new assertion in `tests/integration/build-scripts.spec.ts` OR inline in synth spec |
| **UPDFIX-01 (electron-builder.yml shape, code-level)** | `mac.target` array contains BOTH `dmg` AND `zip` entries with `arch: arm64` | smoke (yaml parse) | `node -e "const y=require('js-yaml').load(require('fs').readFileSync('electron-builder.yml','utf8')); const t=y.mac.target.map(x=>x.target); if(!t.includes('dmg')||!t.includes('zip'))process.exit(1)"` | ❌ Wave 0 — new assertion in same spec file |
| **UPDFIX-01 (CI artifact glob, code-level)** | `release.yml` build-mac upload-artifact path contains `release/*.zip` line; publish job files contains `assets/*.zip` line | smoke (yaml parse) | inline in build-scripts spec | ❌ Wave 0 — new assertion |
| **UPDFIX-01 (live, packaged build)** | Installed v1.1.1 mac client detects v1.1.2 in published feed; clicks Download & Restart; relaunches into v1.1.2 with no `ZIP file not provided` | manual / HUMAN-UAT | N/A — live observation; evidence is DevTools console log absence of `ERR_UPDATER_ZIP_FILE_NOT_FOUND` + Help→About showing `1.1.2` post-restart | manual-only — see 15-HUMAN-UAT.md (greenfield) |
| **UPDFIX-01 (live, Windows)** | Installed v1.1.1 windows client renders UpdateDialog with `windows-fallback` variant when v1.1.2 published; Open Release Page button opens GH Releases | manual / HUMAN-UAT | N/A | manual-only — closes 14-HUMAN-UAT.md tests 5+6 per D-10 |
| **DIST-01..07 + CI-01..06 + REL-01..04 (regression)** | No regressions in build/CI/publish contracts outside Phase 15's targeted edits | smoke (full vitest run) | `npm run test` returns 493+ green (count grows by N from D-04 dual-installer assertions) | existing |
| **REL-02 release notes shape (regression)** | `.github/release-template.md` 4-section structure unchanged by Phase 15 | smoke | inspection during D-08 checkpoint 3 | existing (12-RESEARCH.md REL-02) |
| **REL-04 stranded-rc callout (D-09)** | v1.1.2 release body Known issues section contains the verbatim Phase 13 D-04 callout text | manual / D-08 checkpoint 3 visual | N/A | manual-only |
| **Synthesizer fail-fast on missing .zip (regression)** | When `release/` has only `.dmg` and no `.zip`, synthesizer exits non-zero with clear error | unit | extend existing in `tests/integration/emit-latest-yml.spec.ts` | ✅ extend per D-04 ("existing single .dmg test stays — fails fast") |
| **Synthesizer fail-fast on multiple .zip (regression)** | When `release/` has 2+ `.zip` files, synthesizer exits non-zero | unit | new assertion | ❌ Wave 0 if D-04 doesn't already cover |

### Sampling Rate

- **Per task commit:** `npm run test` (full vitest, ~5-8s).
- **Per wave merge:** `npm run test` + `npm run typecheck`.
- **Phase gate (D-07 local pre-flight):**
  1. `npm run test` returns full-suite green (≥ 493 + N from D-04).
  2. `npm run typecheck` exits 0.
  3. `rm -rf release/ && npm run build:mac` produces BOTH `release/Spine Texture Manager-1.1.2-arm64.dmg` AND `release/Spine Texture Manager-1.1.2-arm64.zip` (and `.zip.blockmap` as a benign side-effect).
  4. `cat release/latest-mac.yml` shows 2-entry `files[]` with `.zip` first; sha512 fields match `^[A-Za-z0-9+/=]{64,}$`; size fields match `wc -c "release/Spine Texture Manager-1.1.2-arm64.zip"` and `wc -c "release/Spine Texture Manager-1.1.2-arm64.dmg"`.
  5. `shasum -a 512 "release/Spine Texture Manager-1.1.2-arm64.zip" | awk '{print $1}' | xxd -r -p | base64` matches `files[0].sha512` byte-for-byte.
  6. Bundled `app-update.yml` byte-identical to `build/app-update.yml` (12.1-D-10 invariant). `diff <(unzip -p "release/mac-arm64/Spine Texture Manager.app/Contents/Resources/app.asar" app-update.yml) build/app-update.yml` exits 0. (NOTE: `app-update.yml` is `extraResources` to `Contents/Resources/app-update.yml` — adjust path; not under app.asar.)
- **Phase gate (D-07 CI dry run):**
  1. `gh workflow run release.yml --ref <feature-branch>` triggers a successful run with all 3 build jobs green and the publish job CORRECTLY SKIPPED (per `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` at `release.yml:127`).
  2. `gh run view <run-id> --log` does NOT contain "GitHub Personal Access Token is not set", "asset_already_exists", or "publish provider".
  3. `gh run download <run-id> --name installer-mac` downloads BOTH `.dmg` AND `.zip` AND `latest-mac.yml`.
  4. Downloaded `latest-mac.yml` parses cleanly + has 2-entry `files[]` with `.zip` first.

### Wave 0 Gaps

- [ ] `tests/integration/emit-latest-yml.spec.ts` — extend with dual-installer mac test case per D-04 (~6-8 new assertions).
- [ ] `tests/integration/build-scripts.spec.ts` (greenfield, optional) — assert `package.json` `build:mac` script contains bare `--mac` (NOT `--mac dmg`); assert `electron-builder.yml` mac.target has both `dmg` and `zip`; assert `release.yml` upload-artifact path includes `release/*.zip` and publish files includes `assets/*.zip`. Alternative: inline these assertions into the existing `tests/integration/install-md.spec.ts` URL-consistency-style file as project precedent. Planner discretion.
- [ ] `15-HUMAN-UAT.md` (greenfield) — runbook for UPDFIX-01 live verification (mac happy-path) + 6 deferred Phase 14 packaged-build UAT items per D-10. Frontmatter `phase: 15-...`, `source: [15-VERIFICATION.md]`, `started: <timestamp>`. Content split into "pre-tag" (tests 1-4 from 14-HUMAN-UAT) and "post-publish" (tests 5-6 from 14-HUMAN-UAT + UPDFIX-01 happy path) sections per D-10.
- [ ] No new framework install — vitest already in place, 493/493 baseline.

### Dimension-8 (Nyquist validation) shape recommendation

The planner's VALIDATION.md should populate Dimension 8 with **per-task sampling at 3 cadences**:

1. **Task-local (per atomic commit):** `npm run test -- <relevant-spec-file>` for the specific test files touched. ~1-2s.
2. **Plan-local (per plan close):** `npm run test` full suite + `npm run typecheck`. ~10s.
3. **Phase-local (D-07 gate, per release-engineering plan):** D-07 gate 1 (local) + D-07 gate 2 (CI workflow_dispatch dry run). ~10 min wall.

**Specific commands the planner should embed in plans:**

```bash
# YAML sha512 + size validation (D-07 gate 1):
EXPECTED_ZIP_SHA512=$(shasum -a 512 "release/Spine Texture Manager-1.1.2-arm64.zip" | awk '{print $1}' | xxd -r -p | base64)
ACTUAL_ZIP_SHA512=$(node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); console.log(y.files[0].sha512)")
[ "$EXPECTED_ZIP_SHA512" = "$ACTUAL_ZIP_SHA512" ] && echo "OK: sha512 match" || (echo "FAIL: sha512 mismatch"; exit 1)

EXPECTED_ZIP_SIZE=$(wc -c < "release/Spine Texture Manager-1.1.2-arm64.zip")
ACTUAL_ZIP_SIZE=$(node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); console.log(y.files[0].size)")
[ "$EXPECTED_ZIP_SIZE" = "$ACTUAL_ZIP_SIZE" ] && echo "OK: size match" || (echo "FAIL: size mismatch"; exit 1)

# Base64 sha512 regex validation (one-liner, both files):
node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); for(const f of y.files){ if(!/^[A-Za-z0-9+/=]{64,}\$/.test(f.sha512))process.exit(1); } console.log('OK: sha512 format');"

# CI watch (D-08 checkpoint 3 prep):
gh run watch --exit-status <run-id>

# Asset count assertion (D-08 checkpoint 3 evidence):
ASSET_COUNT=$(gh release view v1.1.2 --json assets --jq '.assets | length')
[ "$ASSET_COUNT" = "7" ] && echo "OK: 7 assets" || (echo "FAIL: expected 7, got $ASSET_COUNT"; exit 1)

# 7-asset name verification (D-08 checkpoint 3 evidence):
gh release view v1.1.2 --json assets --jq '.assets[].name' | sort
# Expected exactly:
#   Spine Texture Manager-1.1.2-arm64.dmg     (display normalized to .)
#   Spine Texture Manager-1.1.2-arm64.zip
#   Spine Texture Manager-1.1.2-x64.exe
#   Spine Texture Manager-1.1.2-x86_64.AppImage
#   latest-linux.yml
#   latest-mac.yml
#   latest.yml

# Live UPDFIX-01 verification (post-publish, in 15-HUMAN-UAT.md):
# 1. On macOS dev box: install v1.1.1 from existing GH Release.
# 2. Launch installed v1.1.1; wait 3.5s for startup-check.
# 3. Observe DevTools: console contains `[auto-update] event: update-available, version=1.1.2`.
# 4. Click Download & Restart in the modal.
# 5. Observe DevTools: NO line containing `ERR_UPDATER_ZIP_FILE_NOT_FOUND`.
# 6. App relaunches; Help → About reports `1.1.2`.
```

## Plan Structure Recommendation

CONTEXT.md `<code_context>` Reusable Assets lists 7 surface files Phase 15 touches. The estimated 4-plan split (1 release-engineering + 3 parallel preparation) aligns well with a context-budget-conscious decomposition. **Recommendation: 4 plans, with one minor adjustment to surface assignment.**

### Plan 15-01 — Build config + version bump (autonomous, Wave 1)

Mechanically-tight atomic commits in this single plan:
1. **Commit 1 (`feat(15)`):** `electron-builder.yml` mac block — append `- target: zip` `arch: arm64` entry alongside existing dmg entry. Single 2-line YAML diff.
2. **Commit 2 (`fix(15)`):** `package.json` `build:mac` script — change `electron-builder --mac dmg --publish never` → `electron-builder --mac --publish never`. Same edit for `build:win` and `build:linux` (drop explicit `nsis` and `AppImage` target args) for consistency. **REQUIRED for D-01 to take effect** per A2 above. 3-line `package.json` diff.
3. **Commit 3 (`chore(15)`):** `package.json` + `package-lock.json` version bump 1.1.1 → 1.1.2 via `npm version 1.1.2 --no-git-tag-version`. Mirrors 12.1-02 / 13-03 precedent (single atomic commit). 2-file, 3-ins-3-del.

**Rationale for combining:** these 3 commits are all small, all in 2-3 root-level files, all part of the "build configuration delta" atom. Splitting them across plans buys nothing and adds orchestrator overhead. Total ~5 lines changed across 3 files.

**Acceptance:** `npm run build:mac` locally produces both `release/*.dmg` AND `release/*.zip` (this is verified at D-07 gate 1, NOT in plan-15-01 itself — keep plan-15-01 fast/cheap, defer the build to D-07).

### Plan 15-02 — Synthesizer extension + tests (autonomous, Wave 1)

1. **Commit 1 (`test(15)`):** `tests/integration/emit-latest-yml.spec.ts` — RED commit adding the dual-installer mac test case per D-04. Asserts:
   - `files[]` has 2 entries.
   - `files[0].url` ends `.zip`; `files[1].url` ends `.dmg`.
   - `path === files[0].url`; `sha512 === files[0].sha512`.
   - Both sha512 fields match `^[A-Za-z0-9+/=]{64,}$` and are computed correctly from the fixture buffers.
   - Both size fields > 0 and match `fs.statSync` exactly.
   - Existing single-installer mac test is NOT removed; it gets a tightened assertion that `.dmg`-only with no `.zip` triggers exit 1 (synth fail-fast).
2. **Commit 2 (`feat(15)`):** `scripts/emit-latest-yml.mjs` — extend PLATFORM_MAP for mac to dual-pattern (e.g., `extRegexes: [/\.zip$/i, /\.dmg$/i]` — `.zip` first to match files[] order); rename `findInstaller` → `findInstallers` (returns 1-or-N results); update `emitYaml` to build `files[]` from the array. Win + linux paths unchanged. ~30-line diff.
3. **Commit 3 (`docs(15)`):** inline JSDoc and the script header comment block updated to reference the dual-installer mac case.

**Rationale:** TDD shape (RED → GREEN → docs) mirrors 14-04 / 14-05. The synthesizer is an isolated file; testing seam already exists (`EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` env var). Estimated 3 commits, ~50 LoC total.

### Plan 15-03 — CI workflow extension (autonomous, Wave 1)

1. **Commit 1 (`ci(15)`):** `.github/workflows/release.yml` — single 2-line addition:
   - build-mac job upload-artifact path: add `release/*.zip` line.
   - publish job files: add `assets/*.zip` line.

**Rationale:** absolutely minimal change; no logic, just a glob extension. Locked-in by D-05 verbatim diff. Single atomic commit ~2 lines. **Could be merged into Plan 15-01 to save a plan slot**, but keeping it isolated makes the CI seam reviewable as an atom and matches the CONTEXT.md decomposition intent. Planner discretion: 4 plans vs 3 plans + folded into 15-01 are both defensible.

### Plan 15-04 — Release engineering (autonomous: false, 3 BLOCKING checkpoints, Wave 2)

Mirrors Plan 13-05's 9-task shape verbatim, adapted for v1.1.2:

1. **Task 1 (manual / read-only):** D-07 gate 1 — local pre-flight. User runs `rm -rf release/ && npm run build:mac` + the validation oneliners from §Validation Architecture above. Captures: 2 installers + `.zip.blockmap` (benign), valid `latest-mac.yml`, all 5 vitest assertions pass.
2. **Task 2 (manual / read-only):** D-07 gate 2 — CI workflow_dispatch dry run on a feature branch (planner-discretion name; suggest `feat/v1.1.2-mac-zip`). User runs `git checkout -b feat/v1.1.2-mac-zip; git push origin feat/v1.1.2-mac-zip; gh workflow run release.yml --ref feat/v1.1.2-mac-zip`. Watches via `gh run watch --exit-status <run-id>`. Captures: 7-asset glob match (or, on dry run, `installer-mac` artifact has 3 files: `.dmg`, `.zip`, `latest-mac.yml`), publish job correctly skipped.
3. **CHECKPOINT 1 (BLOCKING):** "Pre-flight verify complete. 2 gates green. Ready to tag v1.1.2 at `<HEAD-of-main-after-15-01-merge>`?"
4. **Task 3 (autonomous):** Pre-tag UAT execution per D-10 split — Tests 1-4 from 14-HUMAN-UAT.md (mac/win cold-start auto-check, mac/win Help→Check from idle, against locally-built v1.1.2 + published v1.1.1 feed, NO updates available — verifies silent-swallow + cold-start IPC + manual-check pre-load). Append transcript lines to greenfield `15-HUMAN-UAT.md`.
5. **Task 4 (autonomous, default to HEAD~N):** create annotated tag `git tag -a v1.1.2 <bump-commit-sha> -m "v1.1.2 — macOS .zip auto-update fix"`. SHA defaults to the chore(15) version-bump commit per 12.1-02 / 13-03 precedent.
6. **CHECKPOINT 2 (BLOCKING):** "Tag created locally at `<sha>`. Verify with `git log --oneline v1.1.2 -1`. Ready to push v1.1.2 to origin?"
7. **Task 5 (autonomous):** `git push origin v1.1.2`. Watch CI via `gh run watch --exit-status <run-id>`. Capture: run conclusion `success`, `gh release view v1.1.2 --json assets --jq '.assets | length'` returns 7.
8. **Task 6 (autonomous):** Render release notes via `gh release edit v1.1.2 --notes-file <body.md>` — body authored from `.github/release-template.md` envsubst output, with the D-09 verbatim Phase 13 D-04 stranded-rc callout in `## Known issues` block + cross-link to CLAUDE.md `## Release tag conventions`. New-in-this-version bullet wording at planner discretion (suggest user-facing: "macOS auto-update now successfully downloads and relaunches into newer versions" — does not call out the `.zip` fix mechanically).
9. **CHECKPOINT 3 (BLOCKING):** "Draft v1.1.2 release exists with 7 assets, 3× `latest*.yml` valid, release body includes stranded-rc callout. Ready to publish v1.1.2 (flip to non-draft, non-prerelease)?"
10. **Task 7 (autonomous):** `gh release edit v1.1.2 --draft=false`. Verify `isDraft: false`, `isPrerelease: false`.
11. **Task 8 (autonomous):** Post-publish UAT execution per D-10 split — Tests 5-6 from 14-HUMAN-UAT.md (Windows manual re-check after Later, Windows UpdateDialog button surface) + UPDFIX-01 happy path (mac install of published v1.1.1 + observe v1.1.2 detect-download-relaunch). Append transcript to `15-HUMAN-UAT.md`. Each test produces evidence for `15-VERIFICATION.md`.
12. **Task 9 (autonomous):** doc-flip atomic commit — `15-VERIFICATION.md` (greenfield), `STATE.md` (Phase 15 closed, `last_completed`, `progress.completed_phases`), `ROADMAP.md` (Phase 15 plan list `[x]`, milestone bullet `🚧 → ✅`), `14-HUMAN-UAT.md` frontmatter `status: signed-off`, `15-HUMAN-UAT.md` frontmatter `status: signed-off`. **Mirror 13-05 Task 9 verbatim**; the planner has the template.

**Total task count: 9-12 tasks (vs Plan 13-05's 9). Within the budget of "if it grows >12, split into 5 plans."** Recommendation: **stay at 4 plans.** The pre-tag + post-publish UAT execution within Plan 15-04 is operationally intertwined with the tag/CI/publish sequence; splitting it into a 5th plan would introduce a coordination boundary inside what is logically a single user-driven release-engineering wave. CONTEXT.md `<code_context>` Reusable Assets's 7-file touch list is well within Plan 15-04's context budget (mostly read-only operations: `gh`, `git`, `npm`).

**If the planner finds Plan 15-04 grows past 12 tasks during planning,** a clean split would be: Plan 15-04 (release-engineering: pre-flight + tag-push + CI watch + release-body + publish, ~7 tasks) + Plan 15-05 (UAT execution + doc-flip, ~5 tasks). Both autonomous: false (15-05 inherits the 3 checkpoints from 15-04 conceptually but does not re-prompt).

### Wave structure

- **Wave 1 (parallel, 3 plans):** 15-01 (build config + version bump) + 15-02 (synthesizer + tests) + 15-03 (CI workflow). All autonomous. Worktree merge after each; full vitest gate after the last merge. Estimated wall clock: 30-45 min orchestrator + 3 worktree commits each.
- **Wave 2 (sequential, 1 plan):** 15-04 (release engineering). autonomous: false; 3 BLOCKING user checkpoints. Estimated wall clock: 30 min CI dry run + 5 min tag/push + ~4 min CI run + 5 min publish + 30-60 min UAT execution = 75-105 min wall.

## Surfaced Risks / Landmines

Listed by impact, highest first.

### Risk #1 (HIGH impact, MEDIUM probability) — `--mac dmg` CLI flag silently defeats D-01

If the planner adds `target: zip` to `electron-builder.yml` per D-01 but **forgets to also remove the `dmg` arg from `electron-builder --mac dmg`** in `package.json` build:mac script, the build will produce ONLY `.dmg` (the YAML's `mac.target` array is ignored when the CLI passes specific target args — verified at `node_modules/app-builder-lib/out/targets/targetFactory.js:11-17`). **No explicit error fires; the build succeeds, the synth's "no .zip found in release/" fail-fast runs, and the user sees `No installer matching /\.zip$/i found in release/`.** Fast feedback loop (synth catches it), but the user might mis-diagnose this as a synth bug rather than a CLI flag issue.

**Mitigation (planner MUST embed):** Plan 15-01 Task 2 commits the `package.json` build:* script edit in the SAME commit as the `electron-builder.yml` mac.target edit (or in adjacent atomic commits with a clear commit message). Plan 15-04 Task 1 (D-07 gate 1) verifies BOTH artifacts exist post-build with an explicit `[ -f "release/Spine Texture Manager-1.1.2-arm64.zip" ]` shell check.

### Risk #2 (MEDIUM impact, LOW probability) — `.zip.blockmap` causes asset-count drift

If the planner OR a future maintainer broadens the CI upload-artifact glob from `release/*.zip` → `release/*.zip*` (intending "include zip-related files"), the blockmap WILL be uploaded as an 8th asset. The synthesizer's regex naturally excludes it from the YAML, but the GH Release would show 8 assets, breaking D-05's locked count.

**Mitigation:** D-05 explicitly locks `release/*.zip` (no trailing `*`). Planner must NOT broaden the glob. Plan 15-04 Task 5's asset-count assertion (`gh release view v1.1.2 --json assets --jq '.assets | length'`) returns 7 — a value of 8 would surface the drift immediately.

### Risk #3 (MEDIUM impact, LOW probability) — Sequoia Gatekeeper "Open Anyway" re-challenge after auto-update relaunch

After Squirrel.Mac swaps the `.app` bundle, the relaunched ad-hoc-signed app may trigger Sequoia's Gatekeeper "Open Anyway" prompt because the bundle's code identity differs (different ad-hoc cert) from the previously-trusted version. **This is NOT an UPDFIX-01 failure** — the success criterion is "downloads + relaunches"; the relaunch happens. But UPDFIX-01's UAT runbook in `15-HUMAN-UAT.md` should explicitly note the expected secondary Gatekeeper prompt so the tester doesn't conflate it with a download/swap failure.

**Mitigation:** Plan 15-04 Task 8 UAT script wording for UPDFIX-01 happy-path: include "EXPECTED: after relaunch, Gatekeeper may show the 'Open Anyway' prompt — this is normal for ad-hoc-signed builds. Right-click the app icon → Open. The relaunched app should now show v1.1.2 in Help → About."

### Risk #4 (LOW impact, MEDIUM probability) — `latest.yml` (Windows) `releaseDate` drift surfaces in dry-run inspection

The synthesizer regenerates `releaseDate` on every run. Comparing the dry-run-generated `latest.yml` against published v1.1.1's `latest.yml` byte-for-byte will show different timestamps; if the planner writes a "byte-identical" assertion, it will fail.

**Mitigation:** D-07 gate 1's local validation should compare specific FIELDS (`version`, `files[].url`, `files[].sha512`, `files[].size`, `path`, `sha512`) — NOT byte-identity. The shell snippets in §Validation Architecture above use field-level comparison.

### Risk #5 (LOW impact, LOW probability) — `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` env var collision

The synthesizer's test seam env var (`scripts/emit-latest-yml.mjs:43`) is set in the integration test only. If a future CI step accidentally exports it (unlikely but possible if someone copies the test invocation pattern into a workflow step), the production build will write `latest-mac.yml` to a wrong directory.

**Mitigation:** Plan 15-04 Task 5's CI watch step inspects `gh run view <run-id> --log` for any line mentioning `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` — should be 0 occurrences in production runs.

### Risk #6 (LOW impact, LOW probability) — Stranded v1.1.0-rcN tester pool grew since v1.1.1 ship

D-09 inherits Phase 13 D-04's verbatim callout text targeting v1.1.0-rc1/rc2/rc3 stranded testers. If new rcN tags shipped between v1.1.1 (2026-04-29) and v1.1.2 (this phase), the callout text would need extending. Verified via `git tag -l 'v1.1.0-rc*'` (must equal 3 tags: rc1, rc2, rc3).

**Mitigation:** Plan 15-04 Task 6 (release-body authoring) starts with `git tag -l 'v1.1.0-rc*' | wc -l` — should return 3. If it returns >3, the callout text needs update before the publish checkpoint.

## Project Constraints (from CLAUDE.md)

CLAUDE.md establishes the following Phase-15-relevant directives:

1. **Release tag conventions** (load-bearing for D-09): prerelease tags use **dot-separated** number suffixes (`v1.2.0-rc.1` ✅; `v1.2.0-rc1` ❌). Phase 15 ships `v1.1.2` final, so the convention does not apply to the tag itself, BUT D-09 cross-links to this section in the release-notes callout. Plan 15-04 Task 6 must verify the cross-link URL renders correctly on GitHub.
2. **GSD workflow strict order:** `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work`. Plan 15-04 Task 9 is the doc-flip; `/gsd-verify-work 15` runs after that against the published v1.1.2 + UAT transcripts.
3. **Test framework: vitest.** `npm run test` is the gate. 493/493 baseline post-Phase-14; Phase 15 D-04 adds N more.
4. **`core/` is pure TypeScript, no DOM.** Phase 15 has no `core/` surface; not load-bearing.
5. **Spine 4.2+ hard requirement.** Not load-bearing (auto-update layer).
6. **Folder convention:** `temp/` is gitignored. Phase 15 must not write to `temp/`.

**Source-of-truth files** (per CLAUDE.md):
- Approved plan: `~/.claude/plans/i-need-to-create-zesty-eich.md` — math-phase doc, not Phase 15.
- Requirements: `.planning/REQUIREMENTS.md` — UPDFIX-01 wording.
- Roadmap: `.planning/ROADMAP.md` — Phase 15 entry + 5 success criteria.
- Current state: `.planning/STATE.md` — Phase 14 close + Phase 15 next-action.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; CI uses `GITHUB_TOKEN` (scoped, not changed) |
| V3 Session Management | no | No app-side session changes |
| V4 Access Control | no | `SHELL_OPEN_EXTERNAL_ALLOWED` allow-list unchanged from Phase 14 |
| V5 Input Validation | no | No new user input boundaries; YAML parse uses `js-yaml.load` (not `loadAll`); synth fixtures are programmatic |
| V6 Cryptography | yes | electron-updater verifies SHA-512 of downloaded `.zip` against `latest-mac.yml` `files[].sha512` (verified at `node_modules/electron-updater/out/AppUpdater.js:570-580` — `executeDownload` task wraps `httpExecutor.download` which validates checksum before returning). Standard control — Phase 15 does not introduce new crypto. |
| V7 Error Handling | yes | Synthesizer's fail-fast on missing/multiple `.zip` is the standard control; preserved by D-03 |
| V12 Files and Resources | yes | New artifacts (`.zip`, `.zip.blockmap`) committed nowhere; produced in `release/` (gitignored). The `.zip` IS uploaded to GH Releases (public-repo, no auth). The `.zip.blockmap` stays local. |
| V14 Configuration | yes | `electron-builder.yml` + `package.json` + `release.yml` config edits; all committed; reviewed at D-08 checkpoints |

### Known Threat Patterns for {Electron + GitHub Releases + auto-update + Squirrel.Mac swap}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious `.zip` swap on GH Release (replaced asset content) | Tampering | electron-updater verifies SHA-512 of downloaded zip against `latest-mac.yml` `files[].sha512`; the YAML itself is served via TLS from GH; only repo collaborators can publish — already mitigated by GitHub's access model and the existing softprops/action-gh-release@v2.6.2 pin |
| Replay attack on draft v1.1.2 release | Spoofing | Drafts only visible to repo collaborators; tags require write access; softprops SHA-pinned at v2.6.2 (release.yml:151) |
| Squirrel.Mac swap interrupted mid-extract leaves corrupt `.app` bundle | Denial of Service | Atomic file replacement is Squirrel.Mac's responsibility (`ShipIt` process). On crash, the user can re-download from `.dmg` (manual). Phase 15 does not introduce new DoS surface. |
| Quarantine xattr survives swap → "damaged app" dialog | Tampering | Bypassed by construction — electron-updater writes via Node `fs.write`, no quarantine xattr (verified Q5 above). Out-of-band mitigation: tester right-click → Open if Gatekeeper challenges (documented in INSTALL.md). |
| Stranded v1.1.0-rcN tester downloads wrong asset | Spoofing | D-09 verbatim callout in v1.1.2 release notes directs them to download `v1.1.2` final manually; cross-link to CLAUDE.md release-tag conventions explains the rc-channel-name bug. |
| Unsigned `.zip` content modified between download and Squirrel.Mac extract | Tampering | electron-updater's SHA-512 check happens BEFORE the localhost proxy hand-off to Squirrel.Mac. If the cached `.zip` is tampered with after the check (e.g., another process modifies `<userData>/electron-updater/update.zip` mid-flight), the swap could fail or apply tampered code. Out-of-scope for v1.1.2 (no telemetry / TPM / mandatory-signing). Acceptable for tester distribution. |

**No new security-sensitive surfaces.** Phase 15 is a build/feed-shape fix + release; the security posture is identical to v1.1.1 (ad-hoc mac, unsigned win, public GH Releases). The `.zip` addition narrows the auto-update path's "wedge of failure" — which is a security improvement (failed swap → user falls back to `.dmg` manual download → consistent UX).

## Sources

### Primary (HIGH confidence)

- `[VERIFIED]` Direct file read 2026-04-29: `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/node_modules/electron-updater/out/MacUpdater.js`, `node_modules/electron-updater/out/providers/Provider.js`, `node_modules/electron-updater/out/AppUpdater.js`, `node_modules/electron-updater/out/NsisUpdater.js`, `node_modules/electron-updater/out/AppImageUpdater.js`, `node_modules/electron-updater/package.json` (v6.8.3 confirmed), `node_modules/electron-builder/out/builder.js`, `node_modules/app-builder-lib/out/macPackager.js`, `node_modules/app-builder-lib/out/targets/ArchiveTarget.js`, `node_modules/app-builder-lib/out/targets/targetFactory.js`, `node_modules/app-builder-lib/out/targets/differentialUpdateInfoBuilder.js`, `node_modules/app-builder-lib/out/options/macOptions.d.ts`, `node_modules/dmg-builder/out/dmg.js`.
- `[VERIFIED]` Direct file read 2026-04-29: `electron-builder.yml`, `package.json`, `.github/workflows/release.yml`, `scripts/emit-latest-yml.mjs`, `tests/integration/emit-latest-yml.spec.ts`, `src/main/auto-update.ts`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-CONTEXT.md`, `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-HUMAN-UAT.md`, `.planning/milestones/v1.1-phases/12.1-installer-auto-update-live-verification/12.1-CONTEXT.md`, `.planning/milestones/v1.1-phases/12.1-installer-auto-update-live-verification/12.1-RESEARCH.md`, `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-RESEARCH.md` (lines 450-548), `.planning/config.json`, `CLAUDE.md`.
- `[VERIFIED]` `electron-updater@6.8.3` confirmed via `node_modules/electron-updater/package.json:3` `"version": "6.8.3"`.
- `[VERIFIED]` `electron-builder@26.8.1` confirmed via `node_modules/electron-builder/package.json` `"version": "26.8.1"`.

### Secondary (MEDIUM confidence)

- `[CITED]` electron-builder docs at `electron.build/cli` — `--mac` CLI flag accepts target list; bare `--mac` uses defaults from config.
- `[CITED]` electron-builder docs at `electron.build/mac.html` — *"Squirrel.Mac's auto update mechanism requires both dmg and zip to be enabled even when only dmg is used, and disabling zip will break auto update in dmg packages."* (validates D-01 from authoritative source).
- `[CITED]` electron-builder docs at `electron.build/auto-update.html` — overall auto-update architecture; `latest-mac.yml` schema reference.
- `[CITED]` GitHub issue Squirrel/Squirrel.Mac#16 — opened 2013-08-06, closed without implementation; confirms Squirrel.Mac does NOT strip `com.apple.quarantine` xattr (relevant for Q5 ad-hoc swap analysis; mitigated by construction in electron-updater's Node-write path).
- `[CITED]` GitHub issue electron-userland/electron-builder#2313 — referenced in `node_modules/app-builder-lib/out/macPackager.js:85` comment; explains why mac/zip target uses `isWriteUpdateInfo=true`.
- `[CITED]` GitHub issue electron-userland/electron-builder#1355 — referenced in `node_modules/app-builder-lib/out/targets/targetFactory.js:14` comment; explains the CLI-overrides-YAML short-circuit logic.
- `[CITED]` 12-RESEARCH.md §"Asset-name mismatch warning" line 500 — historical context for URL-encoding-of-spaces in electron-builder's auto-generated YAML; superseded by 12.1-D-10 synthesizer architecture (synth preserves spaces raw).

### Tertiary (LOW confidence; flagged)

- `[ASSUMED]` Sequoia Gatekeeper "Open Anyway" re-challenge frequency post-swap — based on documented ad-hoc signing semantics; not directly verified on this codebase since v1.1.0 → v1.1.1 lifecycle was deferred to Phase 13.1. Empirical signal will come from Plan 15-04 Task 8 UAT.
- `[ASSUMED]` `gh run watch --exit-status <run-id>` returns immediately (with non-zero exit) on a failed CI run — based on `gh` CLI 2.x docs; not specific-version-verified for the `gh` install on the user's machine. Mitigation: planner can fall back to polling `gh run view <run-id> --json status,conclusion`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | electron-builder 26.8.1's mac/zip path produces `.zip.blockmap` unconditionally with no opt-out | Q3, Risk #2 | If electron-builder added a flag in 26.x that we missed, blockmap might be suppressible — D-05 asset count would still hold (no blockmap shipped) and synth regex naturally excludes; risk is low. Mitigation: Plan 15-04 Task 1 (D-07 gate 1) inspects `ls release/*.zip*` to detect blockmap presence empirically. |
| A2 | electron-updater 6.8.3's Squirrel.Mac swap works for ad-hoc-signed apps without quarantine xattr issues | Q5, Risk #3 | If quarantine xattr DOES land on the cached zip somehow, post-swap relaunch could surface "damaged app" dialog. Mitigation: Plan 15-04 Task 8 UAT runbook captures Console.app diagnostic logs if the relaunch fails. |
| A3 | The 7-asset count locked by D-05 covers the full mac dual-installer + win + linux + 3× yml shape | §Phase Boundary | If electron-builder 26.x produces additional artifacts on mac (e.g., `.dmg.blockmap` if a future config edit accidentally enables it), count would drift to 8+. Mitigation: D-08 checkpoint 3 asset-count assertion. |
| A4 | The synthesizer's `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` env var is not set in production builds | Risk #5 | If accidentally exported in CI, production builds would write to wrong dir → CI fail-fast on `if-no-files-found: error`. Self-detecting; low risk. |

**Empty rows mean:** all other claims in this research were verified by direct source-code reading or cited from authoritative docs.

## Open Questions (RESOLVED)

None remaining at the locked-decision level. All 6 questions in the original brief are answered with HIGH or HIGH/MEDIUM confidence per source-code verification. The 4-plan structure is recommended; planner has discretion on the optional 5th-plan split if Plan 15-04 grows beyond 12 tasks.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22.x | npm scripts | ✓ | per CI setup-node@v4.4.0 | None — required |
| npm | dependency install | ✓ | bundled with Node | None |
| GitHub CLI (`gh`) | Tag push verification + release inspection + workflow_dispatch dry run | ✓ (assumed dev box per Plan 13-05 precedent) | 2.x | Web UI on github.com (slower; less scriptable) |
| macOS test host | UPDFIX-01 happy-path live verification (Plan 15-04 Task 8) + 14-HUMAN-UAT tests 1, 3 | ✓ (developer's primary box per CLAUDE.md context) | macOS Sequoia 14+ | Defer mac UAT; ship v1.1.2 with code-level UPDFIX-01 confidence only (NOT recommended; UPDFIX-01 success criterion REQUIRES live verification) |
| Windows test host | 14-HUMAN-UAT tests 2, 4, 5, 6 (Plan 15-04 Task 8 post-publish) | ✓ (per `winCodeSign` todo: `C:\Users\LeonardoCunha\Desktop\WORKTEMP\Spine_Texture_Manager` Win10 build 22000) | Win10/11 | Defer Windows UAT to Phase 13.1 / v1.2 |
| Linux test host | Linux opportunistic verification | UNKNOWN (per Phase 12.1 / 13 / 14 lineage — separately tracked) | — | Skip Linux UAT in Phase 15 (per CONTEXT.md "out of scope" — Linux UAT deferred to Phase 13.1) |
| `shasum`, `xxd`, `base64` | D-07 gate 1 sha512 validation oneliners | ✓ (macOS/Linux built-in) | OS-bundled | Use `openssl dgst -sha512 -binary <file> \| base64` (BSD-portable) |
| `wc`, `awk` | D-07 gate 1 size validation oneliners | ✓ (macOS built-in) | OS-bundled | Use `node -e "console.log(require('fs').statSync('<file>').size)"` |
| `js-yaml` (already devDep) | Synth + tests + dry-run inspection oneliners | ✓ | per package.json devDep (transitive via electron-builder) | None — already locked |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None Phase-15-blocking. Linux test host is the only longest-lead-time item, and Linux UAT is explicitly out of scope for v1.1.2 (per CONTEXT.md).

## Metadata

**Confidence breakdown:**
- Q1 (`files[]` selection by extension): **HIGH** — directly verified at `node_modules/electron-updater/out/MacUpdater.js:77` + `Provider.js:74-90`.
- Q2 (`--mac dmg` overrides YAML): **HIGH** — directly verified at `node_modules/electron-builder/out/builder.js:56-66` + `app-builder-lib/out/targets/targetFactory.js:11-17`.
- Q3 (`.zip.blockmap` produced unconditionally): **HIGH** — directly verified at `node_modules/app-builder-lib/out/macPackager.js:86` + `ArchiveTarget.js:63-69` + `differentialUpdateInfoBuilder.js:66-77`.
- Q4 (`.zip` URL-encoding posture): **HIGH** — directly verified at `scripts/emit-latest-yml.mjs:103-113` + `tests/integration/emit-latest-yml.spec.ts:53,105`.
- Q5 (Squirrel.Mac ad-hoc swap mechanics): **MEDIUM** — architectural path verified; ad-hoc + Sequoia Gatekeeper interaction has documented caveats (Squirrel/Squirrel.Mac#16) but mitigated by construction in our Node-write path. Empirical mac-side UAT in Plan 15-04 Task 8 is the live verification.
- Q6 (Windows path consumption of `latest.yml`): **HIGH** — directly verified at `src/main/auto-update.ts:104,161-230` + `node_modules/electron-updater/out/NsisUpdater.js:31-33`.

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days; the source-code verifications are durable across electron-updater 6.8.3 / electron-builder 26.8.1; only the WebSearched secondary sources (Squirrel.Mac issue status, electron-builder docs page wording) are time-sensitive — re-verify before any future v1.2+ work that revisits the auto-update layer).

---

## RESEARCH COMPLETE
