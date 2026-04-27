# Phase 12: Auto-update + tester install docs - Research

**Researched:** 2026-04-27
**Domain:** Electron auto-update (electron-updater 6.x + GitHub Releases) + Windows-runtime spillover bug fixes (F1/F2/F3) + cross-platform tester install docs
**Confidence:** HIGH for stack/lifecycle/F1/F2/F3 root-cause; MEDIUM-HIGH for unsigned-Windows spike prediction (now upgraded from "fail-likely" to "pass-likely" based on direct NsisUpdater source-code reading); MEDIUM for INSTALL.md screenshot tooling (manual-tester domain).

---

## Summary

electron-updater 6.8.3 is the locked stack; configure it via `electron-builder.yml` `publish: { provider: 'github', owner: 'Dzazaleo', repo: 'Spine_Texture_Manager', releaseType: 'release' }` (replacing today's `publish: null`). The CI workflow already produces `latest-mac.yml` in `release/`; Phase 12 adds two analogous files (`latest.yml` Windows, `latest-linux.yml` Linux) to the publish step's `files:` input (D-11/D-12). Main-process consumer wires `autoUpdater` events (`update-available` / `update-downloaded` / `error` / `update-not-available`) to one-way IPC sends, mirroring the Phase 6 `export:progress` pattern; `UpdateDialog.tsx` clones HelpDialog's ARIA scaffold and renders the leading `##` Summary section of `updateInfo.releaseNotes` as plain text (banned markdown footprint per HelpDialog precedent). "Later" persistence reuses `recent.ts`'s atomic-write idiom in a new dedicated file `app.getPath('userData')/update-state.json` — keeps tiny crash-safety with zero coupling to settings store. F1's bug is a single audit site (`AtlasPreviewModal.tsx:116` — `app-image://localhost${encodeURI(absolutePath)}` with `absolutePath = 'C:\\Users\\...'` glues drive-letter `C` onto host); fix is `pathToFileURL().pathname` from `node:url`. F2 fixes a `defaultPath` that combines source-dir + `'images'` literal, and F3 lands a `< 4.2` major.minor reject in `loader.ts` using `skeletonData.version` (already exposed by spine-core 4.2.111).

**Primary recommendation:** Predict the unsigned-Windows spike will **pass all three steps (detect + download + apply+relaunch)** because the NsisUpdater source explicitly skips signature verification when the installed app has no `publisherName` — which our unsigned electron-builder.yml guarantees. Plan `12-01-PLAN.md` should still lay down both the auto-update path AND the Windows manual-fallback under one cohesive code surface (per D-04) so the live spike result simply selects which branch ships, but bias the planner toward the auto-update path being live on Windows.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auto-update — Windows-unsigned strategy (UPD-06):**
- **D-01:** Resolve UPD-06 via a plan-phase spike. Phase 12 RESEARCH runs the spike (publish v1.1.0-rc1 → v1.1.0-rc2 via existing CI) and locks the result before `12-01-PLAN.md` is finalized.
- **D-02:** Strict spike bar — full Windows auto-update ships only if all three steps pass (detect + download + apply+relaunch). Any partial pass routes to manual fallback.
- **D-03:** Windows manual fallback is a non-blocking in-app notice with a button opening the GitHub Release page externally. Dismissible, no nag, no modal.
- **D-04:** macOS and Linux always take full auto-update. Windows is the only spike-routed platform. Both paths under one cohesive code surface (per-platform branching at the update-flow boundary, not duplicated dialogs).

**Auto-update — UX & cadence (UPD-01..UPD-05):**
- **D-05:** `UpdateDialog` is a hand-rolled ARIA modal cloning HelpDialog's scaffold (`role="dialog"`, `aria-modal="true"`, focus trap, outer overlay close, inner stopPropagation). Buttons: **Download + Restart** (primary), **Later** (cancel). No banner/toast/native notification.
- **D-06:** Startup check fires 3–5s after `app.whenReady()` with hard 10s timeout. Silent on timeout/network error/no-update.
- **D-07:** Help → Check for Updates menu item. Update available → same `UpdateDialog`. No update → small "You're up to date — running v${current}" confirmation. Slot is in existing Help submenu beside Documentation.
- **D-08:** "Later" persists `dismissedUpdateVersion = ${available_version}`. Subsequent startup checks suppress when versions match; newer version re-fires the prompt.
- **D-09:** Release-notes content shows **Summary section only** (first `##` from GitHub Release body). "View full release notes" link opens the GitHub release page externally. URL must be in `SHELL_OPEN_EXTERNAL_ALLOWED`.
- **D-10:** Offline graceful = silent-swallow rule from D-06.

**`latest.yml` feed publication:**
- **D-11:** Modify `.github/workflows/release.yml` `publish` job to upload `latest.yml`/`latest-mac.yml`/`latest-linux.yml` alongside installers. Same `softprops/action-gh-release@v2` step, just adding `files:` entries.
- **D-12:** Feed-file generation happens at electron-builder build time as a side-output of `electron-builder --publish never`. Build-output path: `release/latest*.yml`. Per-platform `actions/upload-artifact@v4` includes the feed file.

**INSTALL.md (REL-03):**
- **D-13:** Cookbook with screenshots, not long-form. Per-OS section (mac/Win/Linux), 1–2 screens each, embedded PNG screenshots of OS bypass dialogs.
- **D-14:** Screenshot storage in `docs/install-images/` (planner picks). Committed PNGs (no CDN).
- **D-15:** Linux libfuse2/libfuse2t64 caveat documented inline. Wording (planner refines): *"On Ubuntu 24.04+, install `libfuse2t64` first: `sudo apt install libfuse2t64`. On Ubuntu 22.04 and earlier, use `libfuse2`: `sudo apt install libfuse2`."*
- **D-16:** Linking surfaces — all four:
  1. `.github/release-template.md` `${INSTALL_DOC_LINK}` substituted with INSTALL.md URL.
  2. README.md "Installing" section.
  3. In-app Help menu "Installation Guide…" item.
  4. HelpDialog inline link/section.
- **D-17:** Release-template inline install bullets pruned to single INSTALL.md link. The `## Install instructions` section header stays per REL-02.
- **D-18:** `SHELL_OPEN_EXTERNAL_ALLOWED` adds INSTALL.md URL on `main`. For per-release URL: choose option (b) — add the GitHub Releases **index** page (`https://github.com/Dzazaleo/Spine_Texture_Manager/releases`) as a single allow-list entry; user clicks one more time to specific release. Avoids regex in trust-boundary check.

**Phase 11 spillover bugs:**
- **D-19:** F1 audit every renderer site building `app-image://` URLs. Use `pathToFileURL()` from `node:url` or explicit Windows-path normalization. Add Windows-runtime test under D-22 matrix.
- **D-20:** F2 three-part fix:
  1. Restore safeguard preventing output picker defaulting to source dir.
  2. Pass `properties: ['openDirectory', 'createDirectory']` to `dialog.showOpenDialog`.
  3. Overwrite-warning policy: warn only when export would overwrite existing files.
- **D-21:** F3 hard reject when `skeleton.spine` major.minor < 4.2 at loader-time. Typed-error envelope matching `SpineLoaderError` pattern. Message includes detected version + remediation. Add fixture test.

**CI test matrix expansion:**
- **D-22:** `release.yml` `test` job runs on `ubuntu-latest` + `windows-2022` + `macos-14` via `strategy.matrix.os`. Build jobs gate on `needs: test` (CI-05 atomicity preserved).
- **D-23:** Atomicity preserved — any matrix OS failure blocks all builds.

**Plan structure (D-24/D-25 — recommended ordering):**
- 12-01 Auto-update wiring (electron-updater + UpdateDialog + Help menu + startup check + Later persistence + Windows fallback)
- 12-02 GHA `latest.yml` publication + test-matrix expansion
- 12-03 F1 atlas-image URL fix
- 12-04 F2 file-picker UX fixes
- 12-05 F3 Spine 4.2 version guard
- 12-06 INSTALL.md authoring + linking surfaces

### Claude's Discretion
- Exact accelerator key for "Help → Check for Updates" menu item.
- Exact menu-item label wording.
- Exact "You're up to date" copy.
- Exact Windows manual-fallback notice copy.
- Exact filename/path for `dismissedUpdateVersion` persistence.
- Plain-text strip vs rendered markdown for `releaseNotes` (HelpDialog ban suggests strip).
- Whether `UpdateDialog` shows download-progress bar (UX nicety).
- Exact `SHELL_OPEN_EXTERNAL_ALLOWED` design (pattern vs Releases-index).
- Exact screenshot tooling.
- Exact INSTALL.md tone/length within cookbook constraint.
- Whether F2 safeguard restoration is its own task or rolled into picker fix.

### Deferred Ideas (OUT OF SCOPE)
- Apple Developer ID code-signing/notarization (v1.2+).
- Windows EV code-signing certificate (v1.2+).
- Crash + error reporting / Sentry (Phase 13).
- CI source-map upload (Phase 13).
- Spine 4.3+ versioned loader adapters (post-v1.1; Phase 12 only hard-rejects `< 4.2`, leaves 4.3+ as a future "distinct, actionable error" decision).
- Delta updates / staged rollouts / multi-channel.
- Feature-usage analytics.
- Native system-toast update notifications.
- In-app banner pattern as general UI primitive.
- F2 deeper output-path policy redesign.
- Download-progress UI in UpdateDialog (future polish).
- Per-release URL pattern-matching in `SHELL_OPEN_EXTERNAL_ALLOWED`.
- Integration smoke launching `.exe` headlessly to assert Atlas Preview renders.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **UPD-01** | Startup app checks GitHub Releases feed for newer version (non-blocking, background) | electron-updater Configuration §; Update Lifecycle §main-process consumer (3–5s deferred check + 10s timeout) |
| **UPD-02** | User can manually trigger update check via menu item (Help → Check for Updates) | Update Lifecycle §IPC channel design + new Help submenu item; mirrors `menu:help-clicked` pattern from Phase 9 |
| **UPD-03** | Update-available prompt shows version + release-notes summary + opt-in download | UpdateDialog §releaseNotes parsing (extract first `##` section, strip HTML) |
| **UPD-04** | After download, prompt for restart; "Later" defers without re-prompting next startup | Update Lifecycle §`update-downloaded` event triggers UpdateDialog state change; "Later" Persistence §`dismissedUpdateVersion` |
| **UPD-05** | Auto-update degrades gracefully when offline / GitHub unreachable (no crash, no error dialog, no nag) | Update Lifecycle §main-process consumer wraps `checkForUpdates()` in `Promise.race(timeout)` and silent-swallows all errors |
| **UPD-06** | macOS + Linux full path; Windows fallback if unsigned auto-update infeasible (notify + link to download page) | Spike Runbook §; Unsigned-Windows Behavior §; predicted PASS based on NsisUpdater source (skips verification when no `publisherName`) |
| **REL-03** | INSTALL.md per-OS install steps including Gatekeeper / SmartScreen walkthroughs | INSTALL.md Authoring Plan §; Linux libfuse2t64 paragraph |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md directives that bind Phase 12:

- **Spine 4.2+ is a hard requirement.** F3's runtime guard at `src/core/loader.ts` is the runtime that matches the documented contract. The version-check predicate must be `< 4.2` (reject 3.x and earlier; 4.3+ allowed silently per CONTEXT.md Deferred — though formally not "actively supported," v1.1 does NOT add a 4.3+ versioned adapter).
- **`core/` is pure TypeScript, no DOM, no Electron, no `node:fs` from `core/`.** F3's version-check predicate lives inside the existing `loadSkeleton` function in `src/core/loader.ts`, which already calls `fs.readFileSync` — but adding the version comparison adds zero new boundary crossings (parse `skeletonData.version` string, integer comparison). The error class extends `SpineLoaderError` in `src/core/errors.ts` per the same Layer 3 invariant.
- **The math phase does not decode PNGs.** F1's atlas-image URL fix is a renderer-side concern only; the math phase loader (Phase 0–6) is untouched.
- **Default sampler rate 120 Hz / `samplingHz` configurable.** Phase 12 does not touch sampling. Update-related main-process startup happens AFTER `app.whenReady()` resolves, in parallel with the existing `createWindow()` + `applyMenu()` initialization path.
- **CLI byte-for-byte unchanged across phases (D-102).** F3's version-check predicate must NOT alter loadSkeleton's existing error envelope shape, only add a new `SpineVersionUnsupportedError` kind to the discriminated union BEFORE the existing reads. CLI consumers (`scripts/cli.ts`) format from `err.name`, so a new typed kind threads through cleanly.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `autoUpdater.checkForUpdates()` and event lifecycle | Main process (Electron) | — | electron-updater is a main-process API; renderer cannot import it. |
| Update-available state → UI | Main → Renderer (one-way IPC sends) | Renderer (UpdateDialog mount) | Mirrors `export:progress` pattern from Phase 6 (one-way `evt.sender.send` from main; preload subscribes; renderer mounts modal). |
| `dismissedUpdateVersion` persistence | Main process (`fs.promises` + `app.getPath('userData')`) | — | Must survive across renderer reloads. recent.ts is the precedent. |
| `UpdateDialog` rendering + ARIA + focus trap | Renderer | — | Clones existing modal scaffold. No spine-core, no `node:fs`. |
| `latest*.yml` generation | Build tool (electron-builder) | — | Side-output of `electron-builder --publish never`. Phase 12 only confirms output path (`release/latest*.yml`) and uploads via Phase 11's CI. |
| Release-feed publication | CI (GitHub Actions + softprops/action-gh-release) | GitHub Releases API | Phase 12 adds files to the existing publish step. |
| F3 Spine version guard | `src/core/loader.ts` (Layer 3 pure TS) | `src/main/ipc.ts` (typed-error forwarder) | Loader-time check; error envelope handed to renderer via existing IPC. |
| F1 atlas-image URL construction | Renderer (`AtlasPreviewModal.tsx`) | `node:url` (`pathToFileURL()` available via preload helper or main-side resolution) | Single audit site (line 116). |
| F2 file-picker safeguards | Main process (`src/main/ipc.ts:handlePickOutputDirectory`) | Renderer (passes `defaultPath` only via `pickOutputDirectory(defaultPath)`) | Trust boundary already on main side. |
| INSTALL.md content | Greenfield Markdown + `docs/install-images/` PNGs | — | Pure docs, no code. |
| Help menu items (Check for Updates, Installation Guide) | Main (`src/main/index.ts:262-279` Help submenu) | Renderer (subscribes to new IPC channels via preload) | Mirrors existing `menu:help-clicked` pattern from Phase 9 Plan 05. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron-updater` | **6.3.9 minimum, recommend 6.8.3 (latest stable)** | Auto-update consumer (`autoUpdater`, `NsisUpdater`, `MacUpdater`, `AppImageUpdater`) | The canonical electron-builder companion package — already integrates with the existing `electron-builder.yml` publish provider. `[VERIFIED: npm view electron-updater version → 6.8.3 latest, dist-tags { next: '6.8.4', latest: '6.8.3' }, 2026-04-27]` |
| `electron-builder` | **26.8.1 (already locked)** | Generates `latest*.yml` feed files at build time | Already in `package.json` devDependencies; no version change. `[VERIFIED: package.json line 44]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `electron-log` | not adopting in v1.1 | electron-updater's recommended logger | Phase 13 (TEL) territory — Phase 12 logs to `console` only (silent failures per D-06/D-10); revisit when crash-reporting lands. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `electron-updater` | `update-electron-app` (drop-in module) | `update-electron-app` is the Electron-team-blessed simple wrapper around `update.electronjs.org`, but it requires the public `update.electronjs.org` service which **explicitly excludes draft/prerelease releases**. Our v1.1.x rcN releases are prerelease; we publish drafts via Phase 11 CI. Locked to `electron-updater` per D-01. |
| `electron-updater` `provider: 'github'` | `provider: 'generic'` pointing at our own server | No infra in v1.1; GitHub Releases is the existing distribution channel. Stay on `provider: 'github'`. |
| Render markdown release-notes | Plain-text strip | HelpDialog precedent: zero markdown footprint, zero XSS surface. Strip HTML, take leading `##` paragraph as plain text (D-09). |

**Installation:**
```bash
npm install electron-updater@6.8.3
```

**Version verification:** `npm view electron-updater version` → `6.8.3` (2026-04-27). dist-tags: `next: 6.8.4`, `latest: 6.8.3`. `[VERIFIED: npm registry, 2026-04-27]`

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Boot                                                                          │
│  app.whenReady() ──> registerIpcHandlers() ──> createWindow() ──> applyMenu()  │
│                  └─> setTimeout(initAutoUpdater, 3500)                         │
└──────────────────┬─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  Main process (src/main/auto-update.ts — greenfield)                          │
│                                                                                │
│  initAutoUpdater():                                                            │
│    autoUpdater.autoDownload = false   (we control download trigger)            │
│    autoUpdater.autoInstallOnAppQuit = false                                    │
│    autoUpdater.allowPrerelease = true (rc1, rc2 are prerelease tags)           │
│    bind events:                                                                │
│      'update-available'    → IPC 'update:available'   {version, summary}       │
│      'update-downloaded'   → IPC 'update:downloaded'  {version}                │
│      'update-not-available'→ IPC 'update:none'        {currentVersion}         │
│      'error'               → IPC 'update:error'       (manual-check only)      │
│      'download-progress'   → optional progress channel (Claude's discretion)   │
│    Promise.race([autoUpdater.checkForUpdates(), timeout(10_000)])              │
│       ├─ resolves with UpdateCheckResult or null                               │
│       └─ rejects (offline / timeout / GitHub unreachable) → silent swallow     │
└──────────────────┬─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  Trigger sources                                                               │
│   • Startup auto-check (D-06): silent unless update found                      │
│   • Help → Check for Updates menu item (D-07): always shows result             │
│  Both call the same checkUpdate(triggeredManually: boolean) function           │
│  (one cohesive code surface — D-04)                                            │
└──────────────────┬─────────────────────────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   on Win+     on macOS+   on Win+
   spike-PASS  Linux        spike-FAIL (D-03 fallback)
        │          │          │
        ▼          ▼          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Renderer (UpdateDialog mounts via App.tsx subscription)                     │
│                                                                              │
│  Auto-update branches (Win-pass, macOS, Linux):                              │
│    'update:available' → UpdateDialog open with version + summary             │
│    Click "Download + Restart" → ipcRenderer.invoke('update:download')         │
│    Wait for 'update:downloaded' event                                        │
│    UpdateDialog updates copy: "Restart now to apply…"                        │
│    Click "Restart" → ipcRenderer.send('update:quit-and-install')             │
│    Click "Later" → ipcRenderer.send('update:dismiss', version)               │
│       └─> main writes update-state.json {dismissedUpdateVersion}             │
│                                                                              │
│  Windows fallback branch (spike-fail only — D-03):                           │
│    'update:available' → low-intrusion notice (NOT modal) with                │
│       "Update available: v1.1.1 — open release page"                         │
│    Button calls window.api.openExternalUrl(GITHUB_RELEASES_INDEX_URL)        │
│    Dismiss button persists dismissedUpdateVersion (D-08 contract reused)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File / Path | Responsibility |
|-----------|-------------|----------------|
| Auto-update orchestrator | `src/main/auto-update.ts` (greenfield) | Imports `autoUpdater` from `electron-updater`; binds events; exports `initAutoUpdater()`, `checkUpdate(manual: boolean)`, `downloadUpdate()`, `quitAndInstallUpdate()`. |
| IPC channel registration | `src/main/ipc.ts` (extend) | Adds `update:check-now` (invoke), `update:download` (invoke), `update:dismiss` (send), `update:quit-and-install` (send). |
| App boot | `src/main/index.ts` (extend) | Adds `setTimeout(initAutoUpdater, 3500)` inside `app.whenReady().then(...)` after `applyMenu`. Adds Help menu items "Check for Updates" + "Installation Guide…" beside existing Documentation. |
| Persistence | `src/main/update-state.ts` (greenfield) | Mirrors `src/main/recent.ts` byte-for-byte: `loadUpdateState()`, `setDismissedVersion(v)`. JSON file `app.getPath('userData')/update-state.json` schema `{ version: 1, dismissedUpdateVersion: string \| null }`. |
| Modal | `src/renderer/src/modals/UpdateDialog.tsx` (greenfield) | Clones HelpDialog scaffold; renders summary + actions. |
| Preload bridge | `src/preload/index.ts` (extend) | Adds `window.api.checkForUpdates()`, `downloadUpdate()`, `quitAndInstallUpdate()`, `dismissUpdate(version)`, `onUpdateEvent(handler)`. |
| F1 fix site | `src/renderer/src/modals/AtlasPreviewModal.tsx:116` | One-line change: replace `app-image://localhost${encodeURI(absolutePath)}` with `pathToFileURL`-derived URL. |
| F2 fix sites | `src/renderer/src/lib/export-view.ts` (defaultPath derivation) + `src/main/ipc.ts:handlePickOutputDirectory` | Strip the `'images'` literal suffix from defaultPath; verify properties array; add overwrite-warning gate. |
| F3 fix site | `src/core/loader.ts` (insert after line 140 `readSkeletonData`) + `src/core/errors.ts` (new class) | Reject `< 4.2` major.minor with new typed error. |
| INSTALL.md | repo root (greenfield) | REL-03 deliverable. |
| Screenshots | `docs/install-images/` (greenfield) | Committed PNGs. |
| CI feed publish | `.github/workflows/release.yml` (extend `publish` job + matrix-expand `test` job) | D-11/D-12/D-22. |

### Recommended Project Structure

```
src/main/
├── auto-update.ts          ← Phase 12 greenfield (electron-updater orchestrator)
├── update-state.ts         ← Phase 12 greenfield (dismissedUpdateVersion persistence)
├── index.ts                ← Phase 12 edits (boot wiring + 2 new menu items)
├── ipc.ts                  ← Phase 12 edits (4 new IPC channels, 2 SHELL_OPEN_EXTERNAL_ALLOWED entries)
├── recent.ts               ← unchanged (pattern reference)
└── ...

src/renderer/src/modals/
├── UpdateDialog.tsx        ← Phase 12 greenfield (clones HelpDialog scaffold)
├── HelpDialog.tsx          ← Phase 12 edits (D-16.4 INSTALL.md link)
├── AtlasPreviewModal.tsx   ← Phase 12 edits (F1 fix at line 116)
└── ...

src/preload/index.ts        ← Phase 12 edits (5 new bridges)

src/core/
├── loader.ts               ← Phase 12 edits (F3 version guard after readSkeletonData)
├── errors.ts               ← Phase 12 edits (new SpineVersionUnsupportedError class)
└── ...

.github/
├── workflows/release.yml   ← Phase 12 edits (test matrix + publish files)
└── release-template.md     ← Phase 12 edits (D-17 install-bullets prune)

INSTALL.md                  ← Phase 12 greenfield (REL-03)
docs/install-images/        ← Phase 12 greenfield (screenshots)
README.md                   ← Phase 12 edits (D-16.2 Installing section)

fixtures/SPINE_3_8_TEST/
├── SPINE_3_8_TEST.json     ← Phase 12 greenfield (minimal 3.8-shaped fixture for F3 test)
├── SPINE_3_8_TEST.atlas    ← Phase 12 greenfield (placeholder)
└── images/SQUARE.png       ← Phase 12 greenfield (placeholder)
```

### Anti-Patterns to Avoid

- **Calling `autoUpdater.checkForUpdatesAndNotify()`.** This is the convenience helper that ALSO shows a native OS notification. Per D-05 we use a hand-rolled ARIA modal instead. Use `autoUpdater.checkForUpdates()` (no notify).
- **Setting `autoUpdater.autoDownload = true`.** This makes electron-updater download the update as soon as it's detected, bypassing user opt-in. UPD-03 requires "opt-in download." Set `autoDownload = false` and call `autoUpdater.downloadUpdate()` only after the user clicks "Download + Restart."
- **Importing `electron-updater` from the renderer.** Hard-fails on `import` resolution under sandbox: true. Always main-process only; route via IPC.
- **Calling `autoUpdater.quitAndInstall()` synchronously inside an IPC handler.** Quits the app — the IPC reply never reaches the renderer. Defer with `setTimeout(() => autoUpdater.quitAndInstall(), 0)` so the IPC ack returns first (mirrors the same setTimeout idiom in `src/main/index.ts:131-137` `before-quit` re-entry guard).
- **Letting a `checkForUpdates()` rejection bubble unhandled.** UPD-05 requires silent-swallow. Wrap in `Promise.race([checkForUpdates(), timeout(10_000)])` inside try/catch; log to console only; never surface to UI on the startup-check path.
- **Using markdown rendering for `releaseNotes`.** HelpDialog precedent forbids it (zero XSS surface, zero footprint). Plain-text strip leading `##` Summary section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Update-feed file format / SHA + size + version metadata | Custom YAML schema | `electron-builder`'s auto-generated `latest*.yml` | electron-builder writes these as a side-output of every build; the schema is what `electron-updater` reads. Hand-rolling would require also hand-rolling the consumer. |
| Cross-platform "newer version" semver compare | `version > current` string compare | `semver.gt()` from `electron-updater`'s internals via the events themselves (you never need to compare yourself — the `update-available` event ONLY fires when newer) | electron-updater already handles version compare against `package.json#version` at runtime. We never re-implement. |
| Atomic JSON write for `dismissedUpdateVersion` | `fs.writeFileSync` | `recent.ts` pattern (`<path>.tmp` + `fs.rename`) | Already proven in Phase 8.2 / Phase 6. Crash-safe. |
| Markdown rendering | `react-markdown` (~80 KB) | Plain-text strip (extract first `##` section, regex-strip HTML tags) | HelpDialog precedent. Zero XSS surface. |
| Windows path → URL conversion | String concat | `pathToFileURL()` from `node:url` | Standard library function; handles drive letters, UNC paths, Unicode, percent-encoding correctly. F1 root cause is exactly the missing use of this. |
| Hard timeout for async check | Custom Promise.race wrapper | `Promise.race([checkForUpdates(), new Promise((_, rej) => setTimeout(() => rej(...), 10_000))])` | electron-updater's GitHub provider has a default `timeout: 120_000` for the HTTP request itself, but UPD-05 wants the whole check (including DNS resolution) bounded at 10s. The race wrapper is two lines. |
| ARIA modal scaffold | Custom focus trap, ESC handler, tab cycle | Existing `useFocusTrap` hook from Phase 6 | Already used by HelpDialog, OverrideDialog, OptimizeDialog, SettingsDialog, AtlasPreviewModal, ConflictDialog, SaveQuitDialog. UpdateDialog is the 8th. |

**Key insight:** Phase 12 is a wiring phase. Every load-bearing primitive already exists in the codebase (modal scaffold, atomic-write, typed-error envelope, IPC pattern, allow-listed external-URL bridge). The novel surface area is electron-updater itself.

## Spike Runbook

> **Document-only research mode (user-confirmed pre-research).** This Runbook is the script a human runs (or `/gsd-execute-phase` invokes with explicit user supervision) AFTER plan-phase concludes. The Runbook does NOT execute during research — tag pushes are consequential, real-world actions reserved for explicit user invocation.

> Result: Phase 12 plan-phase SHOULD bias the planner toward the auto-update-on-Windows path being live. If the spike contradicts the prediction, `12-01-PLAN.md` already lays down the manual-fallback under one cohesive code surface (D-04), so flipping branches is a config change, not a refactor.

### Pre-conditions

1. `main` branch contains the Phase 11 CI workflow + `electron-builder.yml` with `publish: null` AND the Phase 12 wiring branches (12-01 auto-update + 12-02 latest.yml publish + 12-04 file-picker fix). The spike validates the CI-produced installer's auto-update lifecycle, so it MUST run AFTER 12-01 + 12-02 land.
2. **Critical pre-step:** flip `electron-builder.yml` `publish: null` → `publish: { provider: 'github', owner: 'Dzazaleo', repo: 'Spine_Texture_Manager' }` so `app-update.yml` gets baked into resources at build time. Without this, electron-updater errors at runtime ("app-update.yml is missing" — see Common Pitfalls §). The Pitfall 1 belt-and-braces of `--publish never` on the CLI is preserved in `package.json` scripts; this only changes the default-detection that `app-update.yml` is generated from.
3. v1.1.0-rc1 is already a draft on the main repo (Phase 11 verification). **It must be PUBLISHED, not draft, for electron-updater to read it** (electron-updater filters drafts on public repos). See [draft caveat] below.
4. Windows test host is available with admin privileges to run NSIS installer.
5. Network access (the test must NOT be run offline; offline behavior is verified separately per D-10).

### Step 1 — Publish v1.1.0-rc1 (currently draft)

```bash
# On dev machine, run from project root:
gh release edit v1.1.0-rc1 --draft=false --prerelease=true
gh release view v1.1.0-rc1 --json isDraft,isPrerelease  # verify isDraft:false isPrerelease:true
```

**Why prerelease:true:** Phase 11's release-template `prerelease: ${{ contains(github.ref_name, '-') }}` already flags rc-tags as prerelease. electron-updater's `allowPrerelease: true` (set in `auto-update.ts`) lets the rc-line subscribe to itself.

### Step 2 — Build + install v1.1.0-rc1 on Windows

The Windows-2022 CI runner already produced `Spine Texture Manager-1.1.0-rc1-x64.exe` and uploaded it to the release. Download from the published release page and install on the Windows test host:

```powershell
# On Windows test host, in PowerShell:
# 1. Download from https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.0-rc1
# 2. SmartScreen "More info → Run anyway" (manual click — REL-03 walkthrough validates this)
# 3. NSIS installer runs; install to default per-user location.
# 4. Launch app from Start Menu. Confirm version shows v1.1.0-rc1 (Help dialog or window title).
# 5. Open DevTools (Ctrl+Shift+I) → Console — leave open for the next step.
```

### Step 3 — Bump version, tag v1.1.0-rc2, push tag

```bash
# On dev machine, on a clean main branch:
npm version 1.1.0-rc2 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump to 1.1.0-rc2 for Phase 12 spike"
git push origin main
git tag v1.1.0-rc2
git push origin v1.1.0-rc2

# CI fires automatically. Wait for workflow run completion (~10 min):
gh run watch
gh release view v1.1.0-rc2 --json isDraft,assets   # confirm isDraft:true after run
gh release edit v1.1.0-rc2 --draft=false --prerelease=true   # publish so electron-updater can read it
```

### Step 4 — Trigger update check on the v1.1.0-rc1 install

```powershell
# On Windows test host, in the running v1.1.0-rc1 app with DevTools open:
# Either:
#   (a) Wait 3-5s after launch for the auto startup check (D-06), OR
#   (b) Trigger Help → Check for Updates manually (D-07).
# Watch DevTools console for electron-log emissions (auto-update.ts logs to console).
```

### Step 5 — Observe the strict-bar three steps

For a pass, observe IN ORDER:

| Strict bar step | Expected console line / event | Expected UI |
|------------------|--------------------------------|-------------|
| **(1) Detect** | `update-available` event fires; `updateInfo.version === '1.1.0-rc2'` | `UpdateDialog` opens with "Update available: v1.1.0-rc2" + Summary section + buttons |
| **(2) Download** | User clicks "Download + Restart" → `download-progress` events stream → `update-downloaded` event fires | Dialog button copy updates to "Restart now to apply" |
| **(3) Apply + relaunch** | User clicks "Restart" → app quits → NSIS spawns updater installer → new app launches automatically; window title shows v1.1.0-rc2 | App relaunches into v1.1.0-rc2 |

**Decision Matrix:**

| Outcome | Detect | Download | Apply | Routes to | Plan branch |
|---------|--------|----------|-------|-----------|-------------|
| **A: All three pass** | ✓ | ✓ | ✓ | Full auto-update on Windows (UPD-04 satisfied) | Drop the manual-fallback branch from production code; keep it under a feature flag for one rev as safety net |
| **B: Detect+Download pass, Apply fails** | ✓ | ✓ | ✗ (NSIS spawn fails / no relaunch) | Manual fallback (D-03) | Flip `auto-update.ts` Windows branch to manual fallback. Document in INSTALL.md known-issues. |
| **C: Detect passes, Download fails** | ✓ | ✗ | — | Manual fallback (D-03) | Flip Windows branch. Most likely cause: signature verification rejects unsigned installer. Investigate `verifyUpdateCodeSignature` (Pitfall 4 below). |
| **D: Detect fails (`error` event with signature error)** | ✗ | — | — | Manual fallback OR investigate `verifyUpdateCodeSignature` override | If error message is "publisherName mismatch" or "Sign verification failed", consider passing a `verifyUpdateCodeSignature: () => Promise.resolve(null)` to NsisUpdater (Pitfall 4) and re-run spike. If still fails, route to manual fallback. |
| **E: Detect returns null (no update found)** | — | — | — | Investigate (cache, draft state, version compare) | Verify v1.1.0-rc2 release is published not draft. Confirm `allowPrerelease: true`. Check `app-update.yml` was bundled into v1.1.0-rc1's resources. |
| **F: Network error / timeout** | — | — | — | Spike inconclusive — repeat with stable network | Not a fail — UPD-05 silent-swallow path is independently testable. |

### Predicted Outcome (without running spike)

**Predicted: Outcome A (all three pass).** Confidence: MEDIUM-HIGH.

**Evidence:**
- `[VERIFIED: NsisUpdater source via WebFetch of github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/NsisUpdater.ts]` — when the installed app's resources do NOT carry a publisherName (i.e., the installer was not code-signed), the verification function returns null early: `if (publisherName == null) { return null }`. This bypasses the signature check entirely. Our `electron-builder.yml` does NOT set `win.publisherName` and does NOT sign the installer; therefore the installed v1.1.0-rc1 has no `publisherName` to verify against, and electron-updater will accept the v1.1.0-rc2 unsigned NSIS installer without complaint.
- `[VERIFIED: WebSearch 2026-04-27, multiple GitHub issues]` — the documented common failure mode for Windows auto-update is "publisherName mismatch" or "Sign verification failed, installer signed with incorrect certificate" — both of which require an installed app that DOES have a publisherName (i.e., signed builds with a mismatched cert). They do NOT apply to our pure-unsigned-on-both-sides scenario.
- `[VERIFIED: electron-builder docs at electron.build/auto-update.html]` — Windows NSIS is officially listed as a supported auto-update target.

**Counter-evidence (why MEDIUM-HIGH not HIGH):**
- `[CITED: GitHub issue #7807]` — there's a documented edge case where the NSIS updater leaves the app in an unrecoverable state if the update spawns during sign-out or shutdown. Not in our threat model (manual restart click, not OS shutdown), but flagged.
- `[CITED: GitHub issue #4774]` — older electron-builder NSIS versions had a "Windows 7 or above is required" issue. Our test host is Windows 11; not applicable.
- `[CITED: GitHub issue #8620 + #2667]` — `app-update.yml` is sometimes missing from packaged builds when `publish: null` is set in electron-builder.yml. **This is the highest-risk pre-condition for our spike.** Pre-step 2 in this Runbook flips `publish: null` → `publish: { provider: 'github', ... }` specifically to avoid this.

### Cleanup

```bash
# After spike concludes, on dev machine:
gh release delete v1.1.0-rc2 --yes   # if rc2 was a one-shot spike
git push --delete origin v1.1.0-rc2  # if not part of release line
# OR keep rc2 if you intend to ship it as the next pre-release.
# update-state.json on the Windows host can be deleted manually if "Later" was clicked
# during the spike and the dismissed version is interfering with subsequent tests.
```

### Output of the spike

The spike outcome is recorded directly in `12-01-PLAN.md` Wave 0 — three-line block:

```markdown
SPIKE OUTCOME (UPD-06 / D-01):
- Result: A (all three pass) | B (detect+download pass, apply fails) | C-F as defined in 12-RESEARCH.md Decision Matrix.
- Windows branch: full auto-update | manual fallback.
- Evidence: <one-line gh CLI evidence or DevTools console excerpt>.
```

### Recorded Outcome (Plan 12-01 close-out, 2026-04-27)

```
SPIKE OUTCOME (UPD-06 / D-01):
- Result: DEFERRED to phase 12.1
- Windows branch: manual fallback (D-03 variant active by default; SPIKE_PASSED=false on win32)
- Evidence: 3 live CI runs on 2026-04-27 (25017095851 / 25017351602 / 25017624868) all failed at electron-builder publish race; spike runbook step 5 (install rc2 on Windows) never reached. See deferred-items.md "CI tag-push will fail..." entry for root cause and 12.1 disposition.
- Date: 2026-04-27
```

## electron-updater Configuration

### `electron-builder.yml` change (Phase 12)

Today (Phase 11):
```yaml
publish: null
```

Phase 12 replacement:
```yaml
publish:
  provider: github
  owner: Dzazaleo
  repo: Spine_Texture_Manager
  releaseType: release
  # Token NOT required for read access to public-repo releases.
  # vPrefixedTagName defaults to true — matches our v*.*.* tag scheme.
  # protocol defaults to https.
```

**Why `releaseType: release` not `prerelease`:** electron-updater's `releaseType` controls which release to PUBLISH to (Phase 11 already publishes drafts via softprops; this field is for the auto-publish path that we're NOT using because we keep `--publish never` on the CLI). The READ side of electron-updater (which is what we use) is governed by `autoUpdater.allowPrerelease` at runtime, not by this YAML field. `releaseType: release` here is a no-op for us, but `release` is the documented default and matches Phase 11's "publish to non-prerelease unless tag has dash" behavior.

`[VERIFIED: WebFetch of www.electron.build/publish — provider:'github', owner+repo optional/auto-detected, releaseType:draft|prerelease|release default draft, protocol:https only, GH_TOKEN not required for public-repo read]`

### `app-update.yml` (resource bundle file)

`electron-builder` writes `app-update.yml` into the packaged app's `resources/` directory at build time, populated from the `publish` block above. electron-updater reads this file at runtime to know which feed to query. The user never sees it. **If `publish: null` then `app-update.yml` is NOT generated and electron-updater errors at runtime.**

`[CITED: electron-builder docs at electron.build/auto-update.html: "electron-builder automatically creates app-update.yml file for you on build in the resources (this file is internal, you don't need to be aware of it)"]`

### `latest*.yml` feed file naming and paths

Per `[VERIFIED: ls release/ output 2026-04-27]` after a macOS build:
- `release/latest-mac.yml` — exists.

Per `[CITED: WebFetch of www.electron.build/auto-update.html]`:
- macOS: `latest-mac.yml`
- Windows: `latest.yml`
- Linux: `latest-linux.yml`

All written to `directories.output` (= `release/` per `electron-builder.yml`).

`[VERIFIED: contents of /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/release/latest-mac.yml]` — schema:
```yaml
version: 1.1.0-rc1
files:
  - url: Spine-Texture-Manager-1.1.0-rc1-arm64.dmg
    sha512: <base64-sha512>
    size: 124317884
path: Spine-Texture-Manager-1.1.0-rc1-arm64.dmg
sha512: <base64-sha512>
releaseDate: '2026-04-27T09:57:09.513Z'
```

⚠ **Asset-name mismatch warning:** the `path:` value in `latest-mac.yml` uses dashes (`Spine-Texture-Manager-1.1.0-rc1-arm64.dmg`) while the on-disk filename has spaces (`Spine Texture Manager-1.1.0-rc1-arm64.dmg`). electron-builder emits the URL-encoded form. When `softprops/action-gh-release@v2` uploads the file, the asset name on the GitHub Release becomes the filesystem name (with spaces). electron-updater downloads via the `url:` field which uses URL-encoded spaces. Confirm whether GitHub Releases serves the asset successfully under either name (typical UX: GitHub URL-encodes spaces in URLs but shows them as spaces in asset listings). **Open Question** — flagged in §Open Questions; verify during 12-02 implementation by inspecting an actual upload.

### CI publish-step diff (D-11)

In `.github/workflows/release.yml`, extend each `actions/upload-artifact@v4` step:

```yaml
# build-mac (line 67-72 today):
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
  with:
    name: installer-mac
    path: |
      release/*.dmg
      release/latest-mac.yml      # ← Phase 12 add
    if-no-files-found: error
    retention-days: 14

# build-win (line 86-91 today):
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
  with:
    name: installer-win
    path: |
      release/*.exe
      release/latest.yml          # ← Phase 12 add
    if-no-files-found: error
    retention-days: 14

# build-linux (line 105-110 today):
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
  with:
    name: installer-linux
    path: |
      release/*.AppImage
      release/latest-linux.yml    # ← Phase 12 add
    if-no-files-found: error
    retention-days: 14

# publish job files: input (line 147-150 today):
files: |
  assets/*.dmg
  assets/*.exe
  assets/*.AppImage
  assets/latest.yml               # ← Phase 12 add
  assets/latest-mac.yml           # ← Phase 12 add
  assets/latest-linux.yml         # ← Phase 12 add
```

Note: `if-no-files-found: error` is preserved per Phase 11 D-22 / 11-RESEARCH discipline. The `path:` input now takes a multi-line glob (YAML `|` block); this is a documented `actions/upload-artifact@v4` feature and behavior is the same for each line.

## Unsigned-Windows Behavior Analysis

### The Strict 3-Step Bar (D-02)

| Step | Predicted Result | Confidence | Evidence |
|------|------------------|------------|----------|
| **Detect** | PASS | HIGH | `electron-updater` GitHub provider polls `latest.yml` from the release page — public-repo read does not require a token (`[CITED: WebSearch + electron.build/publish]`). `app-update.yml` (bundled into v1.1.0-rc1's resources via `publish: { provider: 'github', ... }` per Pre-step 2) tells `autoUpdater` where to look. `autoUpdater.allowPrerelease = true` lets the rc-line subscribe to itself. The version compare (`1.1.0-rc2 > 1.1.0-rc1`) is handled by `electron-updater`'s internal semver. |
| **Download** | PASS | HIGH | NSIS `.exe` is a regular HTTP download from the GitHub Releases asset URL. Public-repo asset, no auth. The NsisUpdater code path's signature check **runs AFTER download succeeds**, not during. |
| **Apply (signature check + relaunch)** | PASS | MEDIUM-HIGH | `[VERIFIED: NsisUpdater source]` — when the installed app has no `publisherName` (i.e., `electron-builder.yml` does NOT set `win.publisherName` AND the installer was not code-signed), the verification function early-returns `null`: `if (publisherName == null) { return null }`. This bypasses signature verification entirely. Our build matches: no `win.publisherName`, no `win.certificateFile` (DIST-05 lock). |

### Predicted Outcome

**Outcome A (all three pass) is the predicted result.**

### Why MEDIUM-HIGH not HIGH

The remaining uncertainty lies in:
1. Whether the bundled `app-update.yml` file is correctly generated when `electron-builder.yml` flips from `publish: null` → `publish: { provider: 'github', ... }`. `[CITED: GitHub issue #8620 + #2667]` — historic reports of `app-update.yml` missing under certain electron-builder versions. Mitigation: build locally first (post-flip), inspect `release/win-unpacked/resources/app-update.yml`, confirm shape before pushing tag.
2. NSIS installer permission edge cases — `[CITED: GitHub issue #3480]` "spawn .exe EACCES" on per-user installs in non-default locations. Our `nsis.perMachine: false` + `oneClick: false` + `allowToChangeInstallationDirectory: true` (per `electron-builder.yml`) puts the install in `%LOCALAPPDATA%` which is writable; should not hit this. Flagged for Decision Matrix Outcome B.
3. Windows SmartScreen on the v1.1.0-rc2 installer (the new download). On first run after install, SmartScreen may block. But this is the user clicking "Run anyway" on the standalone installer — not in our control surface. Inside the auto-update flow, the spawn is from a trusted parent process (the running app), which typically bypasses SmartScreen. `[ASSUMED]` — not directly verified.

### Counter-evidence considered and rejected

- `[CITED: GitHub issue #4701]` "Update is installed even though signature verification fails." This is a security concern (verification is bypassable in some configs) — for our threat model it's actually evidence that the unsigned-bypass path works at runtime, not against us.
- `[CITED: Doyensec blog 2020/02/24 "Signature Validation Bypass Leading to RCE"]` — historical RCE via bypassed signature check on unsigned NSIS. Patched in current versions. Confirms the bypass path exists; the 2020-era RCE was the fix's catalyst.
- `[CITED: GitHub issue #6425]` "electron-updater@next breaks NSIS 'per machine' quitAndInstall() when not using silent mode." We use `oneClick: false` + `perMachine: false` (per-user, non-silent). Not the affected configuration.

## Update Lifecycle

### Main-process consumer (`src/main/auto-update.ts` greenfield)

```typescript
// Source: composed from electron-builder docs + Phase 6 export:progress pattern
import { app, BrowserWindow } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { getMainWindow } from './index.js';
import { loadUpdateState, setDismissedVersion } from './update-state.js';

const STARTUP_CHECK_DELAY_MS = 3500;
const CHECK_TIMEOUT_MS = 10_000;

let initialized = false;
let lastCheckedVersion: string | null = null;

export function initAutoUpdater(): void {
  if (initialized) return;
  initialized = true;

  // D-05 / D-09: we drive UI via our own modal; never call checkForUpdatesAndNotify.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true;  // rc1, rc2 are prerelease tags by D-11 contains('-')

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    lastCheckedVersion = info.version;
    void deliverUpdateAvailable(info);
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendToWindow('update:none', { currentVersion: app.getVersion() });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendToWindow('update:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err: Error) => {
    // D-06 / UPD-05 — silent on startup. Manual-check path emits update:error
    // only when the renderer's checkForUpdates() invoke is in flight.
    console.error('[auto-update]', err.message);
    sendToWindow('update:error', { message: err.message });
  });

  // D-06 — startup check runs ~3.5s after whenReady resolves.
  setTimeout(() => { void checkUpdate(false); }, STARTUP_CHECK_DELAY_MS);
}

export async function checkUpdate(triggeredManually: boolean): Promise<void> {
  try {
    // UPD-05 — bound the entire check at 10s, not just HTTP.
    const result = await Promise.race([
      autoUpdater.checkForUpdates(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('check-timeout')), CHECK_TIMEOUT_MS)
      ),
    ]);
    if (result === null && triggeredManually) {
      // Some sentinel — currently checkForUpdates returns null only when
      // updater is disabled. Treat as "no update."
      sendToWindow('update:none', { currentVersion: app.getVersion() });
    }
    // 'update-available' or 'update-not-available' event will fire either way.
  } catch (err) {
    if (triggeredManually) {
      sendToWindow('update:error', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    // D-06 / UPD-05 — startup-check failures are silent.
  }
}

async function deliverUpdateAvailable(info: UpdateInfo): Promise<void> {
  // D-08 — suppress if user previously dismissed this exact version.
  const state = await loadUpdateState();
  if (state.dismissedUpdateVersion === info.version) return;

  sendToWindow('update:available', {
    version: info.version,
    summary: extractSummary(info.releaseNotes),
    fullReleaseUrl: `https://github.com/Dzazaleo/Spine_Texture_Manager/releases`,
  });
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function quitAndInstallUpdate(): void {
  // Pitfall 5 — quitAndInstall is synchronous-quit; defer with setTimeout
  // so the IPC ack returns before quit propagates.
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 0);
}

export async function dismissUpdate(version: string): Promise<void> {
  await setDismissedVersion(version);
}

function sendToWindow(channel: string, payload: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    try { win.webContents.send(channel, payload); } catch { /* renderer gone */ }
  }
}

function extractSummary(notes: string | Array<{ version: string; note: string }> | null | undefined): string {
  // D-09 — strip leading `## Summary` section as plain text.
  if (!notes) return '';
  const text = typeof notes === 'string'
    ? notes
    : notes.map((n) => n.note).join('\n');
  // Find the first `## Summary` heading (case-insensitive, allow whitespace).
  const summaryMatch = /##\s+Summary\s*\n([\s\S]*?)(?=\n##\s|$)/i.exec(text);
  const raw = summaryMatch ? summaryMatch[1] : text.split(/\n##/)[0];
  // Strip HTML tags (release-notes can be HTML when GitHub API renders the body).
  // Use a tight whitelist regex; never use innerHTML on the renderer side.
  return raw.replace(/<[^>]+>/g, '').trim();
}
```

### `releaseNotes` shape

`[CITED: electron-builder auto-update docs]` — `updateInfo.releaseNotes` is **string** when `updater.fullChangelog` is `false` (the default), or **array of `{ version: string, note: string }`** when true. We keep the default; `extractSummary` handles both shapes defensively.

### IPC channels (Phase 12 additions)

| Channel | Direction | Type | Payload | Purpose |
|---------|-----------|------|---------|---------|
| `update:check-now` | renderer → main | invoke | — | UPD-02 manual check from Help menu / UpdateDialog |
| `update:download` | renderer → main | invoke | — | UPD-03 user clicks "Download + Restart" |
| `update:dismiss` | renderer → main | send | `{version: string}` | D-08 "Later" click |
| `update:quit-and-install` | renderer → main | send | — | UPD-04 user clicks "Restart" after download |
| `update:available` | main → renderer | send | `{version, summary, fullReleaseUrl}` | UpdateDialog mount trigger |
| `update:downloaded` | main → renderer | send | `{version}` | UpdateDialog state transition |
| `update:none` | main → renderer | send | `{currentVersion}` | D-07 "you're up to date" path |
| `update:error` | main → renderer | send | `{message}` | D-07 manual-check error path (NOT startup) |

### `UpdateDialog.tsx` rendering of `releaseNotes` (D-09)

Plain text only (HelpDialog precedent). Renderer receives `summary: string` already stripped by main; renders inside `<pre className="text-xs text-fg-muted whitespace-pre-wrap">…</pre>` to preserve newlines without enabling HTML.

State machine inside UpdateDialog:
1. `available` → "Update available: v${version}" + summary + [Download + Restart] [Later] buttons.
2. `downloading` (after click Download + Restart, before `update:downloaded`) → "Downloading…" + indeterminate spinner (mirrors Phase 9 sampler progress UX); buttons disabled.
3. `downloaded` (after `update:downloaded`) → "Restart now to apply" + [Restart] [Later] buttons.

Optional D-05 download-progress bar: planner discretion. If shipping it, subscribe to `download-progress` event and render `progressObj.percent` in a small bar; if not, ship the indeterminate spinner.

## "Later" Persistence Recommendation

**Recommendation: dedicated file `app.getPath('userData')/update-state.json`.**

### Rationale

1. **Zero coupling to the existing settings store.** `samplingHz` is the only existing setting (Phase 9), and it's persisted as part of `.stmproj` project files (per-project), not per-app. There is no app-global settings store today. Creating `update-state.json` as a dedicated file matches `recent.json`'s precedent (Phase 8.2 D-177) — "tiny, robust JSON store with version FIRST gating, atomic write, silent-swallow on malformed."
2. **Crash-safety reuses the proven pattern.** `recent.ts:writeRecentFileAtomic` (Phase 8.2 D-178) is the byte-for-byte reference. Same `<path>.tmp` + `fs.rename` idiom. Same `validate*File()` discriminated-union return.
3. **Schema versioning is free.** Future fields (e.g., `lastUpdateCheckTime` for backoff, `updateChannel` for v1.2 multi-channel support) extend the v1 schema without breaking existing installs. Schema:
   ```typescript
   type UpdateStateV1 = {
     version: 1;
     dismissedUpdateVersion: string | null;
   };
   ```
4. **Layer 3 invariant satisfied.** The file lives in `src/main/update-state.ts` (mirrors `src/main/recent.ts`), keeping `app.getPath` out of `src/core/`.

### File location

`app.getPath('userData')/update-state.json`

| OS | Resolves to |
|----|-------------|
| macOS | `~/Library/Application Support/Spine Texture Manager/update-state.json` |
| Windows | `%APPDATA%\Spine Texture Manager\update-state.json` |
| Linux | `~/.config/Spine Texture Manager/update-state.json` |

`[VERIFIED: src/main/recent.ts:40 RECENT_PATH precedent]`

### API surface (`src/main/update-state.ts`)

```typescript
export type UpdateStateV1 = {
  version: 1;
  dismissedUpdateVersion: string | null;
};

export async function loadUpdateState(): Promise<UpdateStateV1>;
export async function setDismissedVersion(version: string): Promise<void>;
export function validateUpdateStateFile(input: unknown): { ok: true; state: UpdateStateV1 } | { ok: false };
```

`loadUpdateState` returns `{ version: 1, dismissedUpdateVersion: null }` on any failure (missing, malformed, version mismatch) per the recent.ts D-177 silent-swallow contract.

### Why NOT piggyback on existing settings

`samplingHz` is per-project (in `.stmproj`); there is no per-app store today. Phase 9 explicitly didn't introduce an app-level settings file because nothing needed one. Creating one in Phase 12 just for `dismissedUpdateVersion` adds a new abstraction (where do other settings live?) without payoff. The dedicated file is smaller, simpler, and zero-coupled.

## F1 Atlas-Image URL Audit

### Audit complete — single site

`[VERIFIED: grep -rn "app-image://" src/ --include="*.ts" --include="*.tsx" 2026-04-27]`:

```
src/main/index.ts:78          (comment only — protocol scheme description)
src/main/index.ts:354         (comment only — protocol handler description)
src/renderer/src/modals/AtlasPreviewModal.tsx:30   (JSDoc only)
src/renderer/src/modals/AtlasPreviewModal.tsx:116  ← THE BUG
```

**Single audit site:** `src/renderer/src/modals/AtlasPreviewModal.tsx:116`

### Root-cause confirmed

Current code:
```typescript
img.src = `app-image://localhost${encodeURI(absolutePath)}`;
```

On Windows, `absolutePath = 'C:\\Users\\Leo\\stm\\images\\CIRCLE.png'`. After `encodeURI()`:
- backslashes encoded → `%5C`
- colon NOT encoded (`encodeURI` per WHATWG URL spec preserves `:` because it's a valid URI delimiter)
- Result: `C:%5CUsers%5CLeo%5Cstm%5Cimages%5CCIRCLE.png`

Concatenated to `app-image://localhost`:
- `app-image://localhostC:%5CUsers%5CLeo...`

URL parser sees:
- scheme: `app-image`
- host: `localhostc` (lowercased per URL spec; up to first `:`)
- port: `%5cusers%5cleo...` (everything between `:` and next `/`)

The literal `localhostc/` in the bug report's 404'd URL is exactly this — host is `localhostc` (the `c` from `C:` glued onto `localhost`), and the protocol handler's `request.url`'s pathname is empty, so `decodeURIComponent(url.pathname)` returns empty, `readFile('')` throws, handler returns 404. **The bug is confirmed by reading both the renderer and main-process protocol handler.**

### Recommended fix

Use `pathToFileURL().pathname` from `node:url` to get a properly-formed URL path, then graft onto the `app-image://` host. Two-line change at line 116:

```typescript
// BEFORE (line 116):
img.src = `app-image://localhost${encodeURI(absolutePath)}`;

// AFTER:
// pathToFileURL produces e.g. 'file:///C:/Users/Leo/stm/images/CIRCLE.png' on Windows,
// or 'file:///Users/leo/stm/images/CIRCLE.png' on POSIX. We extract the encoded
// pathname (which starts with '/' on both platforms post-encoding) and graft it onto
// our custom protocol's host. Drive-letters become path segments ('/C:/...') and
// the URL parser sees a clean host == 'localhost' on both platforms.
import { pathToFileURL } from 'node:url';
// ...
const fileUrl = pathToFileURL(absolutePath);
img.src = `app-image://localhost${fileUrl.pathname}`;
```

**Layer-3 concern:** `node:url` is a Node-only module; the renderer runs in a sandbox without Node access. `pathToFileURL` MUST be exposed via the preload bridge — add `window.api.pathToImageUrl(absolutePath: string): string` to `src/preload/index.ts`. The preload script DOES have access to `node:url` even under sandbox: true (preload scripts run in a special context where Node modules are available; verified by the existing `webUtils.getPathForFile` import in preload). 

⚠ **Verify this:** sandbox mode restricts certain Node modules in the preload. Confirm at plan-phase time that `node:url`'s `pathToFileURL` is available in the preload context. If NOT, the alternative is to do the URL construction in the main process and expose it via an invoke channel (slightly more overhead but always-correct). See §Open Questions.

### Main-process protocol handler — already correct

`[VERIFIED: src/main/index.ts:363-379]`:
```typescript
protocol.handle('app-image', async (request) => {
  const url = new URL(request.url);
  const filePath = decodeURIComponent(url.pathname);
  // ...
});
```

This correctly reads `url.pathname` after parsing the URL. Once the renderer constructs the URL correctly, the handler resolves the path correctly. **No main-process changes needed for F1.**

### Windows-runtime test (D-19)

```typescript
// tests/renderer/atlas-preview-modal.spec.tsx — extend with Windows-path test
import { test, expect } from 'vitest';
import { pathToFileURL } from 'node:url';

test('app-image:// URL is well-formed for Windows-style paths', () => {
  // Synthesize a Windows path. node:url normalizes; we test the constructor.
  const winPath = 'C:\\Users\\Tester\\stm\\images\\CIRCLE.png';
  const fileUrl = pathToFileURL(winPath);
  const appImageUrl = `app-image://localhost${fileUrl.pathname}`;
  const parsed = new URL(appImageUrl);
  expect(parsed.host).toBe('localhost');
  expect(parsed.pathname).toMatch(/^\/C:\//);  // drive letter is in path, not host
});
```

This test runs on the expanded D-22 matrix — Windows runner exercises actual `pathToFileURL` Windows behavior; macOS/Linux runners verify the renderer code doesn't break on POSIX paths.

## F2 File-Picker Fixes

### Three-part fix per D-20

**Part 1: Restore safeguard preventing output picker defaulting to source dir.**

Audit target — find the existing `defaultPath` derivation. Likely in `src/renderer/src/lib/export-view.ts` or `src/renderer/src/AppShell.tsx`. A grep for `pickOutputDirectory` calls on the renderer side:

```bash
grep -rn "pickOutputDirectory" src/renderer/ --include="*.ts" --include="*.tsx"
```

(Not run during research — flagged as planner first-step at 12-04.)

Hypothesis from F2 reproduction: the export-view code computes `defaultPath = sourceImagesDir + '/images'` or similar, which on Windows the picker treats as a save-as filename request. The fix is to either (a) drop `defaultPath` entirely (let the OS pick last-used), or (b) compute `defaultPath` as the **parent of the source-images dir**, not a sibling-named subfolder. Option (b) preserves the UX hint (user lands near their project) without confusing the picker.

The user's "I think we had a safeguard against that" recall — confirmed via grep at `src/main/ipc.ts:209-228` `probeExportConflicts` and `src/main/ipc.ts:415-460` `handleStartExport`'s "outDir IS source-images-dir" hard-reject. Both are POST-pick checks that fire AFTER the user has chosen a folder. They prevent overwriting source files but don't prevent the picker from suggesting that folder. **The "safeguard" the user remembers is reactive (post-pick), not proactive (pre-pick suggestion).** The Phase 12 fix is to ALSO add a proactive defaultPath that lands the picker outside the source directory.

**Part 2: Picker properties.**

`[VERIFIED: src/main/ipc.ts:343-353]` — current `handlePickOutputDirectory` already passes:
```typescript
properties: [
  'openDirectory',
  'createDirectory',   // macOS — allow creating new folder in picker
  'promptToCreate',    // Windows — prompt if entered path doesn't exist
  'dontAddToRecent',   // Windows — don't pollute recent docs
],
```

**Both `openDirectory` and `createDirectory` are already present.** The properties array IS correct per D-20.2. The bug is in the `defaultPath` value the renderer passes (which makes the picker open as save-as on Windows even though we asked for openDirectory). Part 1 is the actual fix; Part 2 is a verification that no further property changes are needed.

**Part 3: Overwrite-warning predicate.**

Already implemented per `[VERIFIED: src/main/ipc.ts:205-228 probeExportConflicts]`:
```typescript
const exists = await access(resolvedOut, fsConstants.F_OK)
  .then(() => true)
  .catch(() => false);
return exists ? resolvedOut : null;
```

Returns the list of files that WOULD be overwritten. Empty list = no warning. The pre-existing `ConflictDialog` (Phase 6 Round 3) renders the list. Per D-20.3 ("warn only if the export _would_ overwrite anything"), the existing flow ALREADY satisfies this. **No code change needed for Part 3.**

**Phase 12 net change: Part 1 only — fix the renderer's `defaultPath` derivation to not point at a sibling `'images'` folder name.**

### Recommended fix sequence for 12-04

1. Grep for existing `pickOutputDirectory(defaultPath)` callers in renderer.
2. Identify the line that builds `defaultPath` (likely `path.join(sourceDir, 'images')` or similar).
3. Replace with `path.dirname(skeletonPath)` (parent of skeleton .json — typically the project root) so the picker lands one level up, with the user navigating into a fresh subfolder.
4. Add a vitest test that confirms `defaultPath` does NOT contain the literal `'images'` suffix.
5. Verify on Windows-2022 CI runner (D-22 matrix) that the test runs correctly.

## F3 Spine Version Guard

### Insertion site — confirmed

`[VERIFIED: src/core/loader.ts:140]` — immediately after:
```typescript
const skeletonData = skeletonJson.readSkeletonData(JSON.parse(jsonText));
```

This is the line where `skeletonData.version` becomes available. The version guard inserts AT line 141 (before the `editorFps` derivation at 229).

### Parser

`[VERIFIED: spine-core's SkeletonData.d.ts]` exposes:
```typescript
/** The Spine version used to export the skeleton data, or null. */
version: string | null;
```

`[VERIFIED: fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json]` shape:
```json
{
  "skeleton": {
    "spine": "4.2.43",
    ...
  }
}
```

spine-core's `SkeletonJson.readSkeletonData` reads `skeleton.spine` from the JSON and assigns it to `skeletonData.version`.

### Predicate

```typescript
// Source: composed; mirrors error-class pattern from src/core/errors.ts
function checkSpineVersion(version: string | null, skeletonPath: string): void {
  if (version === null) {
    // Pre-3.7 had no `skeleton.spine` field. Treat as < 4.2 — reject.
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);
  }
  // version is e.g. "4.2.43" or "3.8.99". Parse first two segments.
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '', 10);
  const minor = parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    // Malformed version string — reject.
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  // Reject if major < 4, OR if major === 4 AND minor < 2.
  if (major < 4 || (major === 4 && minor < 2)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  // 4.2.x and 4.3+ pass. (CONTEXT.md Deferred: 4.3+ is "not silently rejected,
  // but it's also not actively supported." Phase 12 takes the lenient pass for
  // 4.3+. A future phase can split this into a distinct "untested-version" warning.)
}
```

### Error envelope

New class in `src/core/errors.ts`:

```typescript
export class SpineVersionUnsupportedError extends SpineLoaderError {
  constructor(
    public readonly detectedVersion: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `This file was exported from Spine ${detectedVersion}. ` +
      `Spine Texture Manager requires Spine 4.2 or later. ` +
      `Re-export from Spine 4.2 or later in the editor.`,
    );
    this.name = 'SpineVersionUnsupportedError';
  }
}
```

### Discriminated-union threading

`src/shared/types.ts` `SerializableError` union and `src/main/ipc.ts:KNOWN_KINDS` set must add the new kind:

```typescript
// src/shared/types.ts (extend SerializableError union — add the new kind):
| { kind: 'SpineVersionUnsupportedError'; message: string; detectedVersion: string }

// src/main/ipc.ts:92-96 KNOWN_KINDS Set (extend):
const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
  'SpineVersionUnsupportedError',  // ← Phase 12 add
]);
```

The IPC forwarder at `handleSkeletonLoad` already forwards by `err.name` — once the kind is in `KNOWN_KINDS`, the existing code path handles it correctly without further changes. The renderer reads the typed kind in its existing error UI; if it needs to show `detectedVersion` separately, AppShell extends its error-display branch (planner discretion at 12-05).

### Fixture for the version-rejection test

`fixtures/SPINE_3_8_TEST/` greenfield. Minimal 3.8-shaped JSON (just enough to trigger the version check before any other parsing fails):

```json
{
  "skeleton": {
    "spine": "3.8.99"
  },
  "bones": [{ "name": "root" }],
  "slots": [],
  "skins": [{"name": "default", "attachments": {}}]
}
```

Plus a stub `.atlas` file (one region, points to `images/SQUARE.png`) and a 1×1 transparent `images/SQUARE.png` so loadSkeleton's atlas-resolution path doesn't error before the version check fires.

⚠ Order issue: F3's version check must run AFTER `readSkeletonData` (line 140) but BEFORE any 4.2-specific assumption. Spine 3.8 JSON might or might not parse via spine-core 4.2's `SkeletonJson` — if it errors during parse, our version check never runs. **Mitigation:** insert the version check earlier — read just the `skeleton.spine` field from the parsed JSON BEFORE `readSkeletonData`:

```typescript
// EARLIER variant — at line 100, after JSON.parse:
const parsedJson: unknown = JSON.parse(jsonText);
if (parsedJson && typeof parsedJson === 'object' && 'skeleton' in parsedJson) {
  const skel = (parsedJson as Record<string, unknown>).skeleton as Record<string, unknown> | undefined;
  if (skel && typeof skel.spine === 'string') {
    checkSpineVersion(skel.spine, skeletonPath);
  } else {
    checkSpineVersion(null, skeletonPath);  // unknown — reject
  }
}
// ... atlas resolution ...
const skeletonData = skeletonJson.readSkeletonData(parsedJson);
```

**Recommended:** the earlier variant. Run version check at JSON-parse time, before atlas resolution and `readSkeletonData`. This guarantees the rejection fires on truly old Spine inputs that don't even parse cleanly.

### Vitest test (loader.spec.ts)

```typescript
test('rejects Spine 3.8 with SpineVersionUnsupportedError', () => {
  const fixtureRoot = join(__dirname, '../../fixtures/SPINE_3_8_TEST');
  expect(() => loadSkeleton(join(fixtureRoot, 'SPINE_3_8_TEST.json')))
    .toThrow(SpineVersionUnsupportedError);
});

test('accepts Spine 4.2', () => {
  const fixtureRoot = join(__dirname, '../../fixtures/SIMPLE_PROJECT');
  expect(() => loadSkeleton(join(fixtureRoot, 'SIMPLE_TEST.json')))
    .not.toThrow();
});
```

Runs on D-22 expanded matrix (Win+macOS+Linux) — version-check is platform-agnostic but the matrix gives free regression coverage.

## CI Test-Matrix Expansion

### Exact YAML diff for `.github/workflows/release.yml`

`[VERIFIED: .github/workflows/release.yml:28-51]` — current `test` job:

```yaml
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci

      - name: Verify tag matches package.json version
        if: github.event_name == 'push'
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION="$(node -p "require('./package.json').version")"
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION."
            echo "::error::Run 'npm version <X>' before tagging, or delete the tag and retry."
            exit 1
          fi
          echo "Tag $GITHUB_REF_NAME ↔ package.json $PKG_VERSION — OK"

      - run: npm run typecheck
      - run: npm run test
```

Phase 12 replacement:

```yaml
  test:
    strategy:
      fail-fast: true       # any OS failure aborts the matrix; preserves CI-05 atomicity (D-23)
      matrix:
        os: [ubuntu-latest, windows-2022, macos-14]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci

      - name: Verify tag matches package.json version
        if: github.event_name == 'push' && matrix.os == 'ubuntu-latest'   # run guard once
        shell: bash
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION="$(node -p "require('./package.json').version")"
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION."
            echo "::error::Run 'npm version <X>' before tagging, or delete the tag and retry."
            exit 1
          fi
          echo "Tag $GITHUB_REF_NAME ↔ package.json $PKG_VERSION — OK"

      - run: npm run typecheck
      - run: npm run test
```

**Key changes:**
1. `runs-on:` becomes `${{ matrix.os }}`.
2. `strategy.matrix.os` lists three runners.
3. `strategy.fail-fast: true` — one OS failure cancels the others, mirrors D-23 atomicity.
4. The version-guard step runs only on `ubuntu-latest` to avoid 3× redundant guard executions (the guard reads `package.json` from the same git ref on all matrix legs).
5. `shell: bash` added to the version-guard step to ensure the bash-specific `${GITHUB_REF_NAME#v}` parameter expansion works on the Windows runner (Windows defaults to PowerShell which doesn't support that syntax).

### Build job `needs: test`

Already correct per `[VERIFIED: .github/workflows/release.yml:54, 75, 94]`:
```yaml
build-mac:
  needs: test
build-win:
  needs: test
build-linux:
  needs: test
```

When `test` is a matrix job, `needs: test` waits for ALL matrix legs to pass before the build jobs start. This satisfies D-23 by construction.

### CI-05 atomicity preserved

| Test matrix outcome | Build jobs run? | Publish runs? |
|---------------------|-----------------|----------------|
| All 3 OSes pass | yes | yes (if tag push) |
| Any OS fails | no (needs:test gate) | no (transitively) |

This is the same all-or-nothing semantics Phase 11 D-23 / CI-05 contracts demand. The matrix expansion adds OS coverage without changing the gating shape.

## SHELL_OPEN_EXTERNAL_ALLOWED Update

### Current state

`[VERIFIED: src/main/ipc.ts:131-138]`:

```typescript
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
]);
```

### Phase 12 additions (D-16 + D-18)

```typescript
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  // Phase 9 — Spine docs (HelpDialog).
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',

  // Phase 12 — INSTALL.md link surfaces (D-16).
  // Render-target on the GitHub web UI for INSTALL.md on the main branch.
  // Used by HelpDialog (D-16.4 inline link) AND Help → Installation Guide menu item (D-16.3).
  'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md',

  // Phase 12 — GitHub Releases index page (D-18 option b).
  // Used by:
  //   - "View full release notes" link in UpdateDialog (D-09)
  //   - Windows manual-fallback notice (D-03) if the spike fails
  // Index page is stable across releases; user clicks one more time to a specific version.
  // Per-release URL pattern-matching is explicitly deferred (CONTEXT §Deferred).
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
]);
```

**Total entries: 5 (3 existing + 2 new).**

### Decision: option (b) confirmed (no pattern-match support)

D-18 left this as Claude's discretion. The CONTEXT-recommended option (b) is correct because:
1. Pattern-matching at the trust boundary adds attack surface (regex injection / ReDoS risks). Exact-string allow-listing is the strictest interpretation of "trust boundary defense in depth."
2. The user-experience cost is one extra click (Releases index → specific release card). Acceptable for a tester rounds context where the user is already navigating to GitHub.
3. Future per-release URL surfaces (if they prove load-bearing) can introduce pattern-matching deliberately as a separate Phase decision; deferring this complexity is correct now.

### `shell:open-external` handler — no changes

`[VERIFIED: src/main/ipc.ts:586-602]` — handler:
```typescript
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
  try {
    void shell.openExternal(url);
  } catch { /* silent */ }
});
```

`Set.has` is the exact-string check. No pattern logic introduced. **No handler-level changes for Phase 12.**

## INSTALL.md Authoring Plan

### Structure

Per D-13 cookbook constraint (1–2 screens per OS):

```markdown
# Installing Spine Texture Manager

A short guide for non-developer testers. Pick your OS below.

---

## macOS (Apple Silicon)

1. Download `Spine Texture Manager-${VERSION}-arm64.dmg` from the [latest release page](https://github.com/Dzazaleo/Spine_Texture_Manager/releases).
2. Double-click the `.dmg`. Drag **Spine Texture Manager** into the Applications folder.
3. **First launch — Gatekeeper bypass:** double-clicking the app shows "Apple could not verify Spine Texture Manager is free of malware." This is expected — the app is ad-hoc-signed (no paid Developer ID).
4. Open **System Settings → Privacy & Security**. Scroll to the bottom. Click **Open Anyway** next to "Spine Texture Manager was blocked."
5. Confirm by clicking **Open** in the dialog that follows.

![Gatekeeper Open Anyway button](docs/install-images/macos-gatekeeper-open-anyway.png)

---

## Windows (x64)

1. Download `Spine Texture Manager-${VERSION}-x64.exe` from the [latest release page](https://github.com/Dzazaleo/Spine_Texture_Manager/releases).
2. Double-click the `.exe`.
3. **SmartScreen bypass:** Windows shows "Microsoft Defender SmartScreen prevented an unrecognized app from starting." This is expected — the installer is unsigned.
4. Click **More info**. Click **Run anyway**.
5. Walk through the NSIS installer (default location is fine).
6. Launch from the Start Menu.

![SmartScreen More Info button](docs/install-images/windows-smartscreen-more-info.png)

![SmartScreen Run anyway button](docs/install-images/windows-smartscreen-run-anyway.png)

---

## Linux (x64)

1. Download `Spine Texture Manager-${VERSION}-x86_64.AppImage` from the [latest release page](https://github.com/Dzazaleo/Spine_Texture_Manager/releases).
2. Make it executable:
   ```bash
   chmod +x "Spine Texture Manager-${VERSION}-x86_64.AppImage"
   ```
3. Run it:
   ```bash
   ./"Spine Texture Manager-${VERSION}-x86_64.AppImage"
   ```

### libfuse2 / libfuse2t64 (Linux only)

AppImage uses FUSE2 to self-mount. If you see an error like *"Cannot mount AppImage, please check your FUSE setup"*, install the FUSE2 runtime:

- **Ubuntu 24.04 and later:** `sudo apt install libfuse2t64`
- **Ubuntu 22.04 and earlier:** `sudo apt install libfuse2`
- **Other distros:** install the equivalent FUSE2 user-space library.

![Linux libfuse2 error wording](docs/install-images/linux-libfuse2-error.png)

---

## Troubleshooting

- **App won't launch / silent crash:** open a terminal and run the binary directly to see error output.
  - macOS: `/Applications/Spine\ Texture\ Manager.app/Contents/MacOS/Spine\ Texture\ Manager`
  - Linux: run the AppImage from a terminal (above).
  - Windows: launch from Command Prompt to capture stderr.
- **Auto-update doesn't fire:** make sure your network can reach `github.com`. Updates check 3–5 seconds after launch in the background; with no update found, you see nothing.
- **Atlas Preview shows empty rectangles:** known issue on Windows pre-v1.1.1 (fixed in v1.1.1+). Update via Help → Check for Updates.
```

### Screenshot list (committed PNGs in `docs/install-images/`)

| Filename | Captures | Tooling | Target dimensions |
|----------|----------|---------|-------------------|
| `macos-gatekeeper-open-anyway.png` | macOS Sequoia 15.x System Settings → Privacy & Security → "Open Anyway" button highlighted | macOS Cmd+Shift+4 (window selection mode: Cmd+Shift+4 then Spacebar then click window) | ≤ 1200px wide, PNG |
| `windows-smartscreen-more-info.png` | Windows 11 SmartScreen "Windows protected your PC" dialog with **More info** link visible | Windows Snipping Tool (Win+Shift+S → window) | ≤ 1200px wide, PNG |
| `windows-smartscreen-run-anyway.png` | Windows 11 SmartScreen expanded view with **Run anyway** button | Windows Snipping Tool | ≤ 1200px wide, PNG |
| `linux-libfuse2-error.png` | Terminal showing "Cannot mount AppImage" error verbatim | GNOME Screenshot or `gnome-terminal --geometry=80x10` + native screenshot | ≤ 1200px wide, PNG |

### Naming convention

`<os>-<step>-<short-desc>.png`, lowercase-with-dashes. Examples above follow this. PNG always (no JPG; PNG is lossless and small for UI screenshots).

### Capture process

Per D-14, screenshot capture is the user's task. The user runs the spike (Spike Runbook §) on the Windows test host and on a recently-installed macOS host; for each bypass dialog, they capture using the OS-native tool. The 4 screenshots above are committed alongside `INSTALL.md` in `docs/install-images/`.

The Linux libfuse2 error capture requires either (a) a Linux test host with libfuse2 NOT installed (artificial — most Linux hosts have it pre-installed), or (b) a synthesized error screenshot (open `gnome-terminal`, paste the error wording, screenshot). Option (b) is simpler and matches the user-facing error byte-for-byte if the wording is verified against an actual AppImage launch on Ubuntu 24.04 without `libfuse2t64`. **Recommendation:** option (b) — synthesize for v1.1, verify wording during a tester round on actual Ubuntu 24.04 host, replace the screenshot if the actual error wording differs.

### Linux libfuse2 paragraph wording

Per D-15, recommended wording (cookbook-tone):

> ### libfuse2 / libfuse2t64 (Linux only)
>
> AppImage uses FUSE2 to self-mount. If you see *"Cannot mount AppImage, please check your FUSE setup"*, install the FUSE2 runtime:
>
> - **Ubuntu 24.04 and later:** `sudo apt install libfuse2t64`
> - **Ubuntu 22.04 and earlier:** `sudo apt install libfuse2`
> - **Other distros:** install the equivalent FUSE2 user-space library.

Phase 12 commits this verbatim. CONTEXT.md D-15 left "subject to planner refinement"; the above is unchanged from D-15 except for swapping the heading shape to align with the rest of the doc.

### Release-template prune (D-17)

`[VERIFIED: .github/release-template.md:14-23]` — current install bullets:

```markdown
## Install instructions

Choose the installer for your platform:

- **macOS (Apple Silicon):** Download the `.dmg`. After mounting, drag to /Applications. **First launch:** macOS will block the app (it's ad-hoc-signed). Open System Settings → Privacy & Security → scroll to the bottom → click "Open Anyway" next to the Spine Texture Manager row.
- **Windows (x64):** Download the `.exe`. Double-click. SmartScreen will show "Windows protected your PC" — click "More info" → "Run anyway". Then walk through the NSIS installer.
- **Linux (x64):** Download the `.AppImage`. Make it executable: `chmod +x "Spine Texture Manager-${VERSION}-x86_64.AppImage"`, then run it. On Ubuntu 24.04+ you may need `sudo apt install libfuse2t64`.

For full install instructions: ${INSTALL_DOC_LINK}
```

Phase 12 replacement (D-17 — single-link):

```markdown
## Install instructions

See [INSTALL.md](${INSTALL_DOC_LINK}) for per-OS install + first-launch instructions.
```

The `## Install instructions` heading stays per REL-02. The `${INSTALL_DOC_LINK}` placeholder is already substituted by `.github/workflows/release.yml`'s envsubst step (Phase 11 D-12) — Phase 12 changes the workflow's `INSTALL_DOC_LINK` env var value:

`[VERIFIED: .github/workflows/release.yml:135]`:
```yaml
INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/README.md
```

Phase 12 changes this to:
```yaml
INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/INSTALL.md
```

### README.md "Installing" section (D-16.2)

Add at the top of README.md after the project description:

```markdown
## Installing

For non-developer testers: see [INSTALL.md](INSTALL.md).

For developers (build from source): clone, `npm install`, `npm run dev`. See `CLAUDE.md` for project conventions.
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.x (already locked, 331 tests passing as of v1.0; ~340+ after Phase 11) |
| Config file | `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` (no separate full-vs-quick split today) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **UPD-01** | Startup check fires 3-5s after whenReady, with 10s timeout, silent on no-update | unit (mocked autoUpdater) | `npm run test -- tests/main/auto-update.spec.ts -t "startup check"` | ❌ Wave 0 |
| **UPD-02** | Help → Check for Updates menu item triggers `update:check-now` IPC | unit (mocked Electron Menu) | `npm run test -- tests/main/menu.spec.ts -t "Check for Updates"` | ❌ Wave 0 (extend existing menu.spec.ts) |
| **UPD-03** | UpdateDialog renders version + summary + Download button when `update:available` payload received | unit (vitest renderer with jsdom) | `npm run test -- tests/renderer/update-dialog.spec.tsx -t "renders summary"` | ❌ Wave 0 |
| **UPD-04** | "Later" persists `dismissedUpdateVersion`; subsequent startup with same version = no prompt | unit (file-system + mocked event) | `npm run test -- tests/main/update-state.spec.ts -t "dismiss-and-resilencer"` AND manual-tester verification on Windows test host | ❌ Wave 0 |
| **UPD-05** | Network-disconnect during startup check = no error dialog, no crash | manual tester (network disconnect on macOS / Windows / Linux) | manual checklist item in 12-VALIDATION.md | manual-only — UI-level network-disconnect simulation is brittle in vitest |
| **UPD-06** | Windows unsigned auto-update path passes 3-step bar OR fallback path is wired | spike + manual tester | Spike Runbook § (manual); plus unit test for fallback-branch UI mount on `process.platform === 'win32' && spike-fail-flag` | spike runbook only — no automation |
| **REL-03** | INSTALL.md exists at repo root with three OS sections + libfuse2 paragraph + 4 referenced screenshots | smoke (file existence + content grep) | `npm run test -- tests/integration/install-md.spec.ts -t "REL-03 sections present"` | ❌ Wave 0 |
| **F1 (atlas-image URL)** | `app-image://` URL constructed from a Windows-style absolute path produces a valid URL with host=localhost | unit | `npm run test -- tests/renderer/atlas-preview-modal.spec.tsx -t "Windows-style path URL"` | ✓ extend existing |
| **F2 (file-picker)** | `defaultPath` does not contain literal `'images'` substring; overwrite-warning fires only when conflicts exist | unit | `npm run test -- tests/main/ipc.spec.ts -t "pickOutputDirectory defaultPath"` AND `tests/main/ipc.spec.ts -t "probeExportConflicts"` | ✓ extend existing |
| **F3 (Spine 3.8 reject)** | loadSkeleton on a 3.8-shaped fixture throws `SpineVersionUnsupportedError`; loadSkeleton on SIMPLE_TEST.json (4.2.43) does not throw | unit (fixture-driven) | `npm run test -- tests/core/loader.spec.ts -t "rejects Spine 3.8"` | ✓ extend existing |
| **CI matrix expansion (D-22)** | Vitest runs and passes on `ubuntu-latest` + `windows-2022` + `macos-14` | CI infrastructure | observe matrix legs in GitHub Actions UI on next workflow_dispatch | not a unit test — workflow inspection |

### Sampling Rate

- **Per task commit:** `npm run test` (full vitest run; ~5–8s on the dev host).
- **Per wave merge:** `npm run test` (same — there's no separate "quick vs full" today).
- **Phase gate:** Full vitest green on D-22 expanded matrix (3 OS legs) + Spike Runbook executed AND outcome recorded in 12-01-PLAN.md before `/gsd-verify-work 12`.

### Wave 0 Gaps

- [ ] `tests/main/auto-update.spec.ts` — covers UPD-01, UPD-02, UPD-04 (mocked `autoUpdater` from electron-updater; assert event-driven IPC sends + dismiss persistence)
- [ ] `tests/main/update-state.spec.ts` — covers UPD-04 file-store contract (load, dismiss, reload, version mismatch silent-recovery)
- [ ] `tests/renderer/update-dialog.spec.tsx` — covers UPD-03 modal rendering + ARIA + button interactions
- [ ] `tests/integration/install-md.spec.ts` — covers REL-03 file presence + content greps
- [ ] `fixtures/SPINE_3_8_TEST/` — covers F3 rejection (greenfield; SPINE_3_8_TEST.json + .atlas + images/SQUARE.png)
- [ ] CI matrix expansion (D-22) — `.github/workflows/release.yml` `test` job becomes matrix-strategy
- [ ] Spike Runbook execution + result-record — manual / user-supervised

*(F1, F2, F3 unit tests extend existing files — `tests/renderer/atlas-preview-modal.spec.tsx`, `tests/main/ipc.spec.ts`, `tests/core/loader.spec.ts` — all already exist.)*

### Manual-tester checklist (12-VALIDATION.md greenfield surface)

1. **UPD-05 offline-graceful:** disconnect network, launch app on macOS / Windows / Linux. Assert: app boots normally to load screen; no error dialog; no console errors fatal to UI.
2. **UPD-06 Windows live spike:** execute Spike Runbook §; record outcome A-F; if A, verify the v1.1.0-rc1 → v1.1.0-rc2 auto-update flow end-to-end on Windows test host.
3. **REL-03 INSTALL.md tester check:** non-developer reads INSTALL.md, follows the macOS section against a fresh `.dmg`, succeeds at the Gatekeeper bypass without further help. Repeat for Windows + Linux.
4. **REL-04 Linux smoke (deferred from Phase 11):** AppImage launch on Ubuntu 22.04 + 24.04 with appropriate libfuse2 variant. Optimize Assets export against SIMPLE_TEST fixture succeeds.
5. **F1 Atlas Preview on Windows:** Atlas Preview modal opens on Windows v1.1.0-rc2 install; PNG textures render (rect outlines AND images visible).
6. **F2 file-picker on Windows:** Optimize Assets → output picker opens; folder field is empty; user clicks **New folder** → enters name → **Export Here** succeeds. No "create the file?" or "folder name not valid" errors.
7. **F3 Spine 3.8 reject:** drop a Spine 3.8 JSON onto the app; assert error message reads *"This file was exported from Spine 3.8.99. Spine Texture Manager requires Spine 4.2 or later. ..."* (or equivalent matching the typed-error envelope shape).

## Open Questions (RESOLVED)

> Each Q below carries an inline `**RESOLVED**:` annotation citing the plan/task that handles it. All six are pre-resolved at plan time; nothing remains open against Phase 12 execution.

1. **`pathToFileURL` availability in sandboxed preload context.**
   - What we know: the existing preload imports `webUtils` from `electron` and uses it under sandbox: true (`[VERIFIED: src/preload/index.ts:47]`). Sandboxed preloads have access to a curated subset of Node modules.
   - What's unclear: whether `node:url` is in the curated subset, or whether `pathToFileURL` must be moved to the main process behind an invoke channel.
   - Recommendation: at 12-03 plan time, attempt the preload import; if it fails at runtime, fall back to a main-process invoke (`window.api.pathToImageUrl(absolutePath)` → `ipcMain.handle('image-url:path-to-url', (e, p) => pathToFileURL(p).pathname)`). Both work; preload is faster (no IPC roundtrip per region).
   - **RESOLVED**: 12-03 Task 1 ships the IPC-invoke variant unconditionally (channel `atlas:resolve-image-url`); preload bridge `pathToImageUrl` returns `Promise<string>`. AtlasPreviewModal.tsx awaits the bridge call. No runtime detection, no conditional rewrite — the sync-vs-IPC choice is pre-resolved at plan time per checker blocker fix #5.

2. **Asset filename URL-encoding mismatch in `latest*.yml`.**
   - What we know: electron-builder writes `path: Spine-Texture-Manager-1.1.0-rc1-arm64.dmg` (dashes) into `latest-mac.yml`, while the on-disk file is `Spine Texture Manager-1.1.0-rc1-arm64.dmg` (spaces). `[VERIFIED: ls release/ + cat release/latest-mac.yml]`
   - What's unclear: whether GitHub Releases serves the asset successfully when electron-updater requests the URL-encoded form.
   - Recommendation: during 12-02 implementation, manually upload v1.1.0-rc2 build artifacts to a draft release, then `curl -I` the URL form electron-updater will request (`https://github.com/.../releases/download/v1.1.0-rc2/Spine-Texture-Manager-1.1.0-rc2-arm64.dmg`). If it 404s, set `electron-builder.yml` `productName` to a hyphen-cased variant or set `artifactName` template to use `${name}` instead of `${productName}`.
   - **RESOLVED**: 12-02 Task 2 acceptance criterion includes a `curl -I` smoke test against the rc1 release feed; 12-01 Spike Task 6 verifies end-to-end against the real feed during the live spike runbook. Mismatch (if any) is caught before the spike's Detect step succeeds.

3. **Actual Windows 11 SmartScreen wording in 2026.**
   - What we know: documented historical wording is "Windows protected your PC" + "More info" + "Run anyway." `[CITED: WebSearch + multiple electron-builder docs references]`
   - What's unclear: Microsoft has updated the SmartScreen UI multiple times since 2024. The exact button text on the Windows test host as of 2026-04-27 may differ from documented wording.
   - Recommendation: capture the actual screenshot during INSTALL.md authoring (D-14); if wording differs, transcribe verbatim into INSTALL.md so testers see the same string the OS displays.
   - **RESOLVED**: 12-06 Task 1 (screenshot capture checkpoint) handles this — capture happens against live Windows 11 in 2026, no prediction needed. Wording in INSTALL.md is transcribed verbatim from the captured screenshot.

4. **Renderer-side `pickOutputDirectory(defaultPath)` call site identification.**
   - What we know: the bug repro shows the picker landing on the source-files directory with a prefilled `images` folder name. The renderer must be passing `defaultPath = sourceDir + '/images'` or similar.
   - What's unclear: which file in `src/renderer/` contains this construction (research did not grep).
   - Recommendation: at 12-04 plan time, run `grep -rn "pickOutputDirectory" src/renderer/` first; identify the construction site; apply Part 1 fix.
   - **RESOLVED**: located at plan-phase via PATTERNS audit at `src/renderer/src/components/AppShell.tsx:412-413`. 12-04 Task 1 `read_first` cites the line. The bug pattern is `skeletonDir + '/images-optimized'`; the fix drops the suffix.

5. **Whether the `app-update.yml` resource bundle is correctly emitted when `electron-builder.yml` flips from `publish: null` to `publish: { provider: 'github', ... }`.**
   - What we know: `[CITED: GitHub issues #8620, #2667]` — historic reports of `app-update.yml` not being emitted under certain configs. The Phase 11 belt-and-braces was `publish: null`. Phase 12 must flip this.
   - What's unclear: whether the v1.1.0-rc1 build that's already on the draft release has `app-update.yml` baked in (it doesn't — built with `publish: null`).
   - Recommendation: a fresh local build with the flipped config MUST be done before pushing v1.1.0-rc2 tag. Inspect `release/win-unpacked/resources/app-update.yml` (Windows) or `release/mac/Spine Texture Manager.app/Contents/Resources/app-update.yml` (macOS); confirm shape matches `{ provider: 'github', owner: 'Dzazaleo', repo: 'Spine_Texture_Manager', updaterCacheDirName: '...' }`. If missing, escalate before tag push.
   - **RESOLVED**: 12-02 Task 2 acceptance criterion greps for `app-update.yml` in `dist/` (or `release/{platform}-unpacked/resources/`) after `electron-builder` build; spike runbook step 2 (12-01 Task 6) re-verifies pre-tag-push. If missing, the spike aborts before Detect step — no silent failure path.

6. **Whether `releaseType: 'release'` in `electron-builder.yml`'s `publish` block affects the READ side of electron-updater at all.**
   - What we know: `[CITED: electron.build/publish]` — `releaseType` controls electron-builder's auto-publish (which we don't use; CLI is `--publish never`). Read-side filtering is via `autoUpdater.allowPrerelease: true` at runtime.
   - What's unclear: whether setting `releaseType: 'prerelease'` in the YAML changes how electron-updater reads the feed (e.g., if the feed file embedding includes a "treat-as-prerelease" hint that suppresses update detection from non-prerelease tracks).
   - Recommendation: Use `releaseType: release` (or omit entirely — defaults to draft). The READ side is governed by `allowPrerelease: true` we'll set in `auto-update.ts`. If unexpected behavior arises in spike, revisit.
   - **RESOLVED**: at runtime — `electron-updater` 6.x reads any non-draft release on the public GitHub provider regardless of the YAML `releaseType` flag (which only affects the unused PUBLISH side). Defer to spike outcome (12-01 Task 6) for confirmation. Low-risk; runtime-defaultable.

## Sources

### Primary (HIGH confidence)

- Context7 `/electron-userland/electron-builder` — auto-update event lifecycle, NsisUpdater configuration, GitHub provider example code (queried 2026-04-27)
- `[VERIFIED]` Direct source-code reading: `https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/NsisUpdater.ts` — confirms `if (publisherName == null) { return null }` early-return in signature verification
- `[VERIFIED]` Direct file-system inspection: `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/release/latest-mac.yml` — confirms feed file schema + path
- `[VERIFIED]` Direct file inspection: `electron-builder.yml`, `package.json`, `.github/workflows/release.yml`, `src/main/index.ts`, `src/main/ipc.ts`, `src/main/recent.ts`, `src/preload/index.ts`, `src/renderer/src/modals/HelpDialog.tsx`, `src/renderer/src/modals/AtlasPreviewModal.tsx`, `src/core/errors.ts`, `src/core/loader.ts`, `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts`
- `[VERIFIED]` `npm view electron-updater version` → 6.8.3 (latest), 6.8.4 (next) — 2026-04-27
- electron-builder docs: https://www.electron.build/auto-update.html — `latest*.yml` naming, `app-update.yml` purpose, supported NSIS target, releaseNotes shape (string | array)
- electron-builder docs: https://www.electron.build/electron-updater.class.nsisupdater — `verifyUpdateCodeSignature` is a function override, default uses windowsExecutableCodeSignatureVerifier

### Secondary (MEDIUM confidence)

- `[CITED]` GitHub issue #3667 — signed-cert mismatch failure mode (NOT applicable to unsigned-on-both-sides; rejected as counter-evidence)
- `[CITED]` GitHub issue #4701 — signature-bypass historical context (confirms unsigned path works at runtime)
- `[CITED]` GitHub issue #8620 + #2667 — `app-update.yml` missing under certain electron-builder configs (highest-risk pre-condition for spike — flagged in Open Question 5)
- `[CITED]` GitHub issue #7807 — NSIS unrecoverable-state edge case during shutdown (out of scope for our threat model)
- `[CITED]` GitHub issue #6425 — per-machine quitAndInstall edge case (we use perMachine: false; not applicable)
- `[CITED]` https://blog.doyensec.com/2020/02/24/electron-updater-update-signature-bypass.html — historical RCE context
- `[CITED]` Multiple WebSearch results re: GitHub draft releases NOT detected by electron-updater on public repos (drives Spike Runbook Step 1)

### Tertiary (LOW confidence)

- `[ASSUMED]` Windows 11 SmartScreen 2026 wording is unchanged from documented 2024-era wording. (Open Question 3.)
- `[ASSUMED]` `node:url`'s `pathToFileURL` is available in sandboxed preload context. (Open Question 1.)
- `[ASSUMED]` GitHub Releases asset URLs serve correctly under both space-encoded and dash-encoded names. (Open Question 2.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Windows 11 SmartScreen wording in 2026-04-27 matches the historical "Windows protected your PC" / "More info" / "Run anyway" strings | INSTALL.md Authoring Plan §screenshots | Documented bypass instructions don't match what testers actually see → tester confusion. Mitigation: capture screenshots at INSTALL.md authoring time; transcribe verbatim if differs. |
| A2 | `pathToFileURL` from `node:url` is available in sandboxed preload | F1 §recommended fix | If unavailable, must fall back to main-process invoke. Both paths work; preload is faster. Verifiable in 5 minutes during 12-03 plan. |
| A3 | GitHub Releases asset URLs serve correctly under either space-encoded or dash-encoded filename | electron-updater Configuration §asset-name mismatch warning | If 404s, electron-updater download step fails → Outcome C in Decision Matrix. Mitigation: pre-flight `curl -I` check during 12-02 implementation. |
| A4 | The auto-update spawn from a trusted parent app process bypasses Windows SmartScreen on the v1.1.0-rc2 installer | Unsigned-Windows Behavior §why MEDIUM-HIGH not HIGH | If SmartScreen blocks the spawned installer, Apply step fails → Outcome B. Mitigation: spike validates this directly. |
| A5 | `electron-builder.yml` `releaseType: release` does not affect the READ side of electron-updater (only the unused PUBLISH side) | Open Question 6 | If wrong, may need `releaseType: prerelease`. Verifiable in spike. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. **(Not the case here — 5 ASSUMED claims tagged for confirmation. Risk assessment provided per row.)**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions npm-verified; electron-updater is the canonical electron-builder companion; locked by D-01.
- Architecture: HIGH — patterns mirror existing Phase 6 (export progress IPC), Phase 8.2 (recent.ts atomic-write), Phase 9 (HelpDialog ARIA scaffold + SHELL_OPEN_EXTERNAL_ALLOWED + menu→IPC bridge). Greenfield surface is well-understood.
- Spike prediction: MEDIUM-HIGH — direct NsisUpdater source-code reading shifted prediction from "fail-likely" to "pass-likely." Remaining risk in `app-update.yml` emission (Open Q 5) and runtime SmartScreen behavior (A4).
- F1 root cause: HIGH — confirmed by file-system grep + URL parser semantics analysis. Single-site fix.
- F2 root cause: MEDIUM — picker properties already correct; bug is in renderer-side `defaultPath` derivation site that needs to be located at 12-04 plan time.
- F3 root cause: HIGH — `skeletonData.version` confirmed exposed by spine-core 4.2.111. Predicate is straightforward semver-major.minor compare. Order-of-operations concern (parse-time vs readSkeletonData-time) flagged with mitigation.
- INSTALL.md: MEDIUM — content structure HIGH-confidence; screenshots are a manual-capture concern subject to current OS UI realities.
- CI matrix YAML: HIGH — exact diff produced; matches `actions/runner-images` documented availability.

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; electron-updater is fast-moving but the API surface we use is stable; revisit if a major version bump lands).

---

## RESEARCH COMPLETE
