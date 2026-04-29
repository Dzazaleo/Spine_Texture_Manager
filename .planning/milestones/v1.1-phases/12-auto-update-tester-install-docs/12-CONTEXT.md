# Phase 12: Auto-update + tester install docs - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `electron-updater` to the GitHub Releases feed so installed copies of the app
detect newer published versions, prompt the user to download and restart on
macOS / Linux (and on Windows if the unsigned-build spike proves end-to-end
viability), degrade gracefully when offline, and degrade to a documented
manual-update fallback path on Windows if the spike fails. Ship a
single-page tester `INSTALL.md` covering Gatekeeper / SmartScreen / libfuse2
first-launch bypass walkthroughs. Bundle three Windows-runtime fixes
(Phase 11 spillover findings F1 / F2 / F3) so the v1.1 tester rounds the
auto-update path is unlocking are not undermined by latent app-side bugs on
the same OS.

**Out of scope:**
- Apple Developer ID code-signing or notarization (v1.2+ candidate; locked out of v1.1).
- Windows EV code-signing certificate (v1.2+ candidate; locked out of v1.1).
- Crash + error reporting / Sentry wiring → Phase 13 (TEL-01..TEL-07).
- Production source-map upload from CI to crash backend → Phase 13 (TEL-03).
- Spine 4.3+ versioned loader adapters → v1.0 deferred list, post-v1.1.
- Atlas-less mode (SEED-001), dims-badge override-cap (SEED-002) → post-MVP.
- Delta updates / staged rollouts / multi-channel release tracks (e.g. beta vs stable).
- Feature-usage analytics beyond crash reporting.
- UI improvements informed by tester feedback → v1.2.
- F2's deeper output-path safeguard refactor (this phase ships the picker-properties + overwrite-warning fix, not a broader output-path policy redesign).

</domain>

<decisions>
## Implementation Decisions

### Auto-update — Windows-unsigned strategy (UPD-06)

- **D-01:** Resolve UPD-06 via a **plan-phase spike**. `gsd-phase-researcher` for Phase 12 runs the spike as part of producing `12-RESEARCH.md` — produce two real builds (publish v1.1.0-rc1 → v1.1.0-rc2, both via the existing CI release pipeline), install rc1 on the Windows test host, observe whether `electron-updater` detects rc2 from the GitHub Releases feed, downloads it, and successfully replaces the installed app and relaunches. Result is locked in `12-RESEARCH.md` BEFORE `12-01-PLAN.md` is finalized.
- **D-02:** **Strict spike bar** — to ship the full auto-update path on Windows the spike must succeed at all three steps: detect + download + apply (replace + relaunch into new version). Any partial pass routes to the manual fallback. Reasoning: UPD-04 wording requires "prompts for restart and applies"; a partial pass means UPD-04 silently fails for testers, which is worse than shipping a manual path that obviously requires a click.
- **D-03:** **If the spike fails** (or partially fails), the Windows fallback is a non-blocking in-app notice surfaced after the startup check detects an update. Notice shows the available version label + a button that opens the GitHub Release page externally via `window.api.openExternalUrl()`. Dismissible, no nag loop, no modal interruption. This is the surface that satisfies UPD-06's "manual update path: notify of new release, link to download page."
- **D-04:** macOS and Linux always take the full auto-update path (download + apply). Windows is the only platform where the spike result can route to the fallback. The two paths must be implemented under one cohesive code surface (per-platform branching at the update-flow boundary, not duplicated dialogs/menus).

### Auto-update — UX & cadence (UPD-01..UPD-05)

- **D-05:** Update-available prompt is a **hand-rolled ARIA modal** that reuses the existing dialog scaffold from `src/renderer/src/modals/` (HelpDialog, SettingsDialog, SaveQuitDialog all use this pattern — five dialogs, one pattern). New file `UpdateDialog.tsx` mirrors `HelpDialog.tsx` shape (role="dialog", aria-modal="true", focus trap, outer-overlay onClick = close, inner content stops propagation). Buttons: **Download + Restart** (primary), **Later** (cancel). No banner, no native toast, no new UI primitive.
- **D-06:** **Startup check** runs in the background ~3–5 s after `app.whenReady()` resolves with a hard timeout (recommend 10 s). User sees nothing during the check — only a modal if an update is found. On timeout / network error / GitHub unreachable: silently swallow, log to dev console only, no error dialog (UPD-05). On no-update-available at startup: silently no-op.
- **D-07:** **On-demand check** (Help → Check for Updates menu item, UPD-02) shows a result either way. With an update available: the same `UpdateDialog` modal opens. With no newer version: small confirmation modal/dialog (or tiny in-modal-shell message) saying "You're up to date — running v${current}". Accelerator and exact menu placement: planner discretion (slot is in the existing Help submenu in [src/main/index.ts:262-279](src/main/index.ts#L262-L279), beside the existing Documentation item).
- **D-08:** **"Later" semantics** — clicking Later persists `dismissedUpdateVersion = ${available_version}` to a small settings-side store (electron-store equivalent or hand-rolled JSON in `app.getPath('userData')` per the existing project-state pattern). On subsequent startup checks, if `available_version === dismissedUpdateVersion`, no prompt. When a newer version (`> dismissedUpdateVersion`) becomes available, the prompt re-fires. This is the strictest reading of UPD-04 "defers without nagging on next startup."
- **D-09:** **Release-notes content** in the modal: show the **Summary** section only (the first `##` section of the GitHub Release body — REL-02 template's leading section). `electron-updater` exposes `updateInfo.releaseNotes`; we extract the leading section. A "View full release notes" link below the summary opens the GitHub Release page externally via `window.api.openExternalUrl()`. The full release-page URL must be added to `SHELL_OPEN_EXTERNAL_ALLOWED` in [src/main/ipc.ts](src/main/ipc.ts) — see Specifics §allow-list for the pattern-vs-exact-string concern.
- **D-10:** **Offline graceful** (UPD-05) is satisfied by the silent-swallow rule in D-06; planner verifies by running the app with the network disconnected and asserting no error dialog, no crash, normal startup to load screen.

### Auto-update — `latest.yml` feed publication

- **D-11:** Modify the existing `.github/workflows/release.yml` `publish` job to also upload the per-platform update-feed files (`latest.yml`, `latest-mac.yml`, `latest-linux.yml` — names depend on `electron-updater` conventions; planner confirms via electron-updater docs) alongside the installer assets in the same atomic-publish step. This was Phase 11's deferred item (see `.planning/phases/11-…/11-CONTEXT.md` §Deferred). The upload is the same `softprops/action-gh-release@v2` step, just adding files to the `files:` input — does not require a workflow restructure.
- **D-12:** Feed-file generation happens at electron-builder build time (each platform job produces its own feed file as a side-output of `electron-builder --publish never`). Planner confirms the build-output path (likely `release/latest*.yml`) and adjusts the per-platform `actions/upload-artifact@v4` step to include the feed file in addition to the installer.

### INSTALL.md (REL-03)

- **D-13:** **INSTALL.md is a cookbook with screenshots**, not a long-form walkthrough or a terse text-only doc. Per-OS section (macOS / Windows / Linux), 1–2 screens of content each: download link → install step → first-launch bypass with embedded PNG screenshots of the actual OS dialog at the bypass moment (Gatekeeper "Open Anyway", Windows SmartScreen "More info → Run anyway", Linux `chmod +x` terminal). Designed for non-developer testers who hit the bypass dialog and won't know what to do without seeing it.
- **D-14:** **Screenshot storage** — `docs/install-images/` (or equivalent — planner picks). Screenshots are committed PNGs (not external/CDN-hosted). Capture is the user's task during plan-phase or as part of Plan 12-02 execution (or a designated single-task plan); planner chooses sequencing.
- **D-15:** **Linux libfuse2 / libfuse2t64 caveat documented inline** in the Linux section. Exact wording (subject to planner refinement): _"On Ubuntu 24.04 and later, install `libfuse2t64` first: `sudo apt install libfuse2t64`. On Ubuntu 22.04 and earlier, use `libfuse2` instead: `sudo apt install libfuse2`."_ This is the most predictable Linux tester papercut (Phase 10 RESEARCH §Pitfall 5) and we own a fix in INSTALL.md; testers hitting the FUSE error find the answer in the doc.
- **D-16:** **Linking surfaces — all four**:
  1. **`.github/release-template.md` ${INSTALL_DOC_LINK}** — substituted with the GitHub-rendered INSTALL.md URL on `main` (e.g. `https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md`). The placeholder already exists from Phase 11 (D-11/D-12 in `11-CONTEXT.md`); Phase 12 fills it.
  2. **README.md** — add an "Installing" section pointing to INSTALL.md so anyone landing on the GitHub repo page also sees the install path.
  3. **In-app Help menu** — new menu item ("Installation Guide…" or similar; planner picks copy) calling `window.api.openExternalUrl()` to the INSTALL.md URL. Slot is in the Help submenu in [src/main/index.ts:262-279](src/main/index.ts#L262-L279).
  4. **HelpDialog** — add a link/section inside `src/renderer/src/modals/HelpDialog.tsx` pointing to INSTALL.md. Discoverable from inside the app for testers who lost their bypass instructions.
- **D-17:** **Release-template install-bullets pruned to a single link** — the inline Gatekeeper/SmartScreen/`chmod +x` bullets in `.github/release-template.md` (Phase 11 D-13 wrote them inline because INSTALL.md didn't exist yet) are replaced with a single line: `See [INSTALL.md](${INSTALL_DOC_LINK}) for per-OS install + first-launch instructions.` One source of truth, no drift between two surfaces, smaller release body. The `##` Install Instructions section in the template stays (REL-02 requires it); only the bullet content collapses to the link.
- **D-18:** **`SHELL_OPEN_EXTERNAL_ALLOWED` additions** — at minimum the INSTALL.md URL on `main`. The GitHub Release page URL is per-version (per-tag) and changes with every release — the current allow-list uses exact strings, not patterns. Planner decides between (a) pattern-match support (regex or prefix match), or (b) building the release-page URL deterministically from `electron-updater`'s `updateInfo.tag` and adding a single allow-list entry that is the GitHub Releases _index_ page (a stable URL: `https://github.com/Dzazaleo/Spine_Texture_Manager/releases`). Option (b) is simpler and avoids regex in the trust-boundary check; trade-off is the user lands one click away from the specific release.

### Phase 11 spillover bugs — fold all three into Phase 12

- **D-19:** **F1 (Atlas Preview broken on Windows)** — fold in. Audit every site in the renderer that constructs `app-image://` URLs from filesystem paths; use `pathToFileURL()` from `node:url` or explicitly normalize Windows paths before building URL host/path. The bug is the literal `localhostc/` in the URL (extra trailing `c`) — Windows drive-letter `C:` is being naively concatenated to `localhost`. Add a Windows-runtime test (vitest under the expanded test matrix from D-22) that asserts URL construction is correct on Windows path inputs.
- **D-20:** **F2 (file-picker UX confusion on Windows)** — fold in. Three-part fix:
  1. Restore/confirm the documented safeguard preventing the output picker from defaulting to the same directory as the source files (per the user's recall — "I think we had a safeguard against that").
  2. Pass `properties: ['openDirectory', 'createDirectory']` to `dialog.showOpenDialog` for the output-folder picker so the native Windows picker treats the call as folder-select rather than save-as.
  3. Overwrite-warning policy: warn only if the export _would_ overwrite existing files in the chosen folder. Don't fail/warn on empty target folders. Per user direction: _"only issue a warning if it will overwrite anything."_
- **D-21:** **F3 (Spine 3.8 silent failure)** — fold in. **Hard reject** when `skeleton.spine` major.minor < 4.2 at loader-time. Surface a typed-error envelope matching the existing D-10 `SpineLoaderError` pattern in [src/core/errors.ts](src/core/errors.ts); message: _"This file was exported from Spine ${version}. Spine Texture Manager requires Spine 4.2 or later. Re-export from Spine 4.2 or later in the editor."_ Add a fixture test against a 3.8-shaped JSON to lock the version-rejection behavior. CLAUDE.md already documents 4.2+ as a hard requirement; this is the runtime that matches the documented contract. We do NOT add 4.3+ detection in this phase (4.3+ adapter is on the v1.0 deferred list).

### CI test matrix expansion

- **D-22:** Modify `.github/workflows/release.yml` to run the `test` job on **all three runners** (`ubuntu-latest` + `windows-2022` + `macos-14`) in parallel before the build jobs. Use a matrix `strategy: matrix: os: [...]` on the existing `test` job (single workflow file, no duplication). This catches future F1-class Windows-only regressions automatically — F1 itself was a silent regression latent until Phase 11's first Windows install. Cost is small and bounded (vitest run is ~1–2 min; 3× the test minutes on a tag-triggered low-frequency workflow is acceptable).
- **D-23:** The expanded matrix gates the build jobs the same way (`build-*` jobs `needs: test`). The `publish` job atomicity (CI-05) is preserved — if any `os` in the test matrix fails, no platform builds, no publish.

### Plan structure (plan-phase guidance, not locked)

- **D-24:** Recommended plan ordering for `gsd-plan-phase 12` to consider (planner finalizes):
  - **12-01:** Auto-update wiring — `electron-updater` integration, `UpdateDialog.tsx` modal, Help menu Check-for-Updates item, startup check + hard timeout, "Later" persistence, Windows fallback path. Includes the spike outcome from `12-RESEARCH.md` so the path is locked before execution.
  - **12-02:** GHA `latest.yml` feed publication — modify `.github/workflows/release.yml` `publish` job to upload feed files alongside installers; expand `test` job matrix to include `windows-2022` + `macos-14`.
  - **12-03:** F1 atlas-image URL fix on Windows.
  - **12-04:** F2 file-picker UX fixes.
  - **12-05:** F3 Spine 4.2 version guard.
  - **12-06:** INSTALL.md authoring + linking surfaces (release-template prune, README, Help menu item, HelpDialog link, `SHELL_OPEN_EXTERNAL_ALLOWED` additions, screenshot capture).
- **D-25:** Plan ordering rationale — auto-update (12-01) and feed publication (12-02) are the load-bearing UPD-* deliverables and must land first to unblock the Windows-spike validation. Spillover fixes (12-03/04/05) land before INSTALL.md (12-06) so the doc is written against a tester-ready Windows app, not a broken one. Each plan is independently revertable (per-plan atomic-commit hygiene; matches Phase 8.1 / 9 granularity).

### Claude's Discretion

- Exact accelerator key for "Help → Check for Updates" menu item (planner picks; macOS standard is no accelerator on Help-menu items).
- Exact menu-item label wording ("Check for Updates…", "Check for Updates", "Updates…", etc.).
- Exact wording of the "You're up to date" copy on on-demand check.
- Exact wording of the Windows manual-fallback notice copy.
- Exact filename / path for the `dismissedUpdateVersion` persistence (e.g. dedicated file vs piggyback on existing settings store).
- Whether to render `electron-updater`'s `releaseNotes` HTML as plain text (strip tags) or as rendered markdown — current HelpDialog ban on markdown rendering (zero XSS surface) suggests plain-text strip; planner confirms.
- Whether the `UpdateDialog` shows a download-progress bar during the `Download + Restart` action (UX nicety; not required by UPD-*).
- Exact `SHELL_OPEN_EXTERNAL_ALLOWED` design (pattern support vs Releases-index URL — see D-18).
- Exact screenshot capture process and tooling.
- Exact INSTALL.md tone and per-section length within the cookbook constraint.
- Whether F2's safeguard restoration is its own plan-internal task or rolled into the picker-properties fix.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 contract
- `.planning/REQUIREMENTS.md` — UPD-01..UPD-06 (auto-update, Phase 12 scope), REL-03 (INSTALL.md, Phase 12 scope), REL-04 (Phase 11-completed but Linux smoke deferred to Phase 12 tester rounds). TEL-* and DIST-future items are explicitly NOT in scope.
- `.planning/ROADMAP.md` §"Phase 12" — Goal statement, Success Criteria 1–5, Depends on Phase 11.
- `.planning/PROJECT.md` §"Current Milestone: v1.1 Distribution" — milestone goal, "no paid signing certs in v1.1" lock, "three pre-existing Windows runtime findings ... spilled forward as Phase 12 prereqs."
- `CLAUDE.md` — non-obvious facts. **Spine 4.2+ requirement is the contract F3's hard-reject runtime guard locks down.**

### Phase 11 deliverables (Phase 12 input contract)
- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-WIN-FINDINGS.md` — F1 / F2 / F3 details, severity, hypothesis, suggested fix, reproduction. Phase 12 plans 12-03 / 12-04 / 12-05 are scoped from this doc.
- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-CONTEXT.md` — Phase 11 lineage; D-11/D-12/D-13 (release-template `${INSTALL_DOC_LINK}` placeholder + envsubst rendering) are the substrate Phase 12 fills in. §Deferred lists `latest.yml` / `latest-mac.yml` publication as Phase 12 work.
- `.planning/phases/11-ci-release-pipeline-github-actions-draft-release/11-RESEARCH.md` — patterns Phase 11 used (SHA-pinning, `if-no-files-found: error`, etc.) that Phase 12's workflow modifications must preserve.
- `.planning/phases/10-installer-build-electron-builder-all-3-platforms/10-RESEARCH.md` §"Common Pitfalls" — Pitfall 5 (libfuse2 vs libfuse2t64) is the basis for D-15.

### Phase 12 surface files (greenfield + edits)
- `.github/workflows/release.yml` — Phase 12 modifies the `test` job (matrix expansion, D-22) and the `publish` job (latest.yml uploads, D-11/D-12). Must preserve atomicity (CI-05, Phase 11 contract) and SHA-pin discipline.
- `.github/release-template.md` — Phase 12 prunes the inline install bullets to a single INSTALL.md link (D-17). The `${INSTALL_DOC_LINK}` placeholder already exists from Phase 11.
- `package.json` §scripts — `build:mac/win/linux` end with `--publish never` (Phase 11 D-01). Phase 12 must keep this — `electron-updater`'s detection happens at runtime against the GitHub feed, not via `electron-builder`'s built-in publisher.
- `electron-builder.yml` — generator of the `latest*.yml` feed files. Phase 12 confirms the output path; does not restructure the targets section.
- `INSTALL.md` (greenfield) — repo root, REL-03 deliverable.
- `docs/install-images/` (or equivalent path — planner picks) — committed PNG screenshots referenced from INSTALL.md (D-13/D-14).

### App-side surface files (Phase 12 edits)
- [src/main/index.ts:142-279](src/main/index.ts#L142-L279) — application Menu builder. Phase 12 inserts "Help → Check for Updates" + "Help → Installation Guide…" menu items (D-07, D-16.3). Existing Edit menu Preferences pattern (lines 225-260) shows the pattern for unconditionally-enabled Help-menu items (T-09-05-MENU-02).
- [src/main/ipc.ts:113-140](src/main/ipc.ts#L113-L140) §SHELL_OPEN_EXTERNAL_ALLOWED — allow-list at the trust boundary for `window.api.openExternalUrl()` calls. Phase 12 adds INSTALL.md URL (D-16) and the GitHub-Releases URL surface (D-18).
- [src/main/ipc.ts:586-600](src/main/ipc.ts#L586-L600) — `shell:open-external-url` handler. Phase 12 may extend if pattern-match support is chosen (D-18 path A).
- [src/preload/index.ts](src/preload/index.ts) — `window.api.openExternalUrl()` bridge. Phase 12 does not modify the bridge surface; reuses it.
- [src/renderer/src/modals/HelpDialog.tsx](src/renderer/src/modals/HelpDialog.tsx) — Phase 12 reuses the modal scaffold for `UpdateDialog.tsx` (D-05) AND extends HelpDialog with an INSTALL.md link section (D-16.4). Wording stability constraints documented in the file's comment block (the em-dash + "editor metadata" + "does not affect sampling" substrings are gated by `tests/renderer/help-dialog.spec.tsx` — Phase 12 must not regress these).
- [src/renderer/src/modals/SaveQuitDialog.tsx](src/renderer/src/modals/SaveQuitDialog.tsx), `OverrideDialog.tsx`, `OptimizeDialog.tsx`, `SettingsDialog.tsx`, `AtlasPreviewModal.tsx`, `ConflictDialog.tsx` — five existing modals using the hand-rolled ARIA pattern. `UpdateDialog.tsx` mirrors their shape.
- [src/core/loader.ts](src/core/loader.ts) — Phase 12 inserts the F3 version guard at skeleton-load time (D-21).
- [src/core/errors.ts](src/core/errors.ts) — typed-error envelope (D-10 from project decisions); F3 uses this for `SpineVersionUnsupportedError` (or equivalent — planner picks the kind name).
- [src/main/recent.ts](src/main/recent.ts), [src/main/project-io.ts](src/main/project-io.ts) — example patterns for `app.getPath('userData')` persistence (D-08 `dismissedUpdateVersion`).

### Atlas Preview surface (F1 audit target)
- Renderer code that constructs `app-image://` URLs — Phase 12 audits all sites. The 404'd URL (`app-image://localhostc/`) implies a path-concat bug; planner identifies the exact construction site as part of `12-03-PLAN.md`. The custom protocol registration is in `src/main/index.ts` near `protocol.registerFileProtocol` / equivalent (Phase 1 plan); planner confirms.

### External
- electron-updater documentation: https://www.electron.build/auto-update — base API, `autoUpdater.checkForUpdates()`, event lifecycle (`update-available`, `update-downloaded`, `error`, `update-not-available`), GitHub provider config.
- electron-updater GitHub provider: https://www.electron.build/configuration/publish#githuboptions — `provider: 'github'`, owner/repo, draft handling.
- electron-updater Windows / unsigned NSIS — Phase 12 RESEARCH agent confirms current behavior; D-01 spike validates against this.
- `softprops/action-gh-release@v2`: https://github.com/softprops/action-gh-release — already pinned in Phase 11; Phase 12 extends the `files:` input to include `latest*.yml`.
- GitHub Actions matrix strategy: https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs — pattern for D-22 test-job expansion.
- Spine JSON skeleton format: https://en.esotericsoftware.com/spine-json-format — `skeleton.spine` field semantics for F3 version guard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Hand-rolled ARIA modal scaffold** (5 dialogs in `src/renderer/src/modals/`) — `UpdateDialog.tsx` clones this. Pattern: `role="dialog"` + `aria-modal="true"` + focus trap (`useFocusTrap` with `onEscape: onClose`) + outer overlay onClick = onClose + inner content stops propagation. Phase 8.2 D-184 also auto-suppresses File-menu accelerators while a modal is open — `UpdateDialog` inherits this for free.
- **`window.api.openExternalUrl()` bridge** with allow-list defense (`SHELL_OPEN_EXTERNAL_ALLOWED` in [src/main/ipc.ts](src/main/ipc.ts)) — Phase 12 adds entries; does not redesign the bridge or the allow-list mechanism (unless D-18 pattern-support path is chosen).
- **Typed-error envelope pattern** (`SpineLoaderError` in [src/core/errors.ts](src/core/errors.ts), discriminated union with 8 kinds including 7-field `SkeletonNotFoundOnLoadError`) — F3 adds a new kind for unsupported Spine version; same shape, same handling at the IPC boundary in [src/main/ipc.ts](src/main/ipc.ts).
- **Atomic Pattern-B writes** (`.tmp` + `fs.rename`) — used in Phase 6 (sharp export) and Phase 8 (.stmproj save). `dismissedUpdateVersion` persistence (D-08) reuses this for crash-safety if the planner chooses a JSON-on-disk approach.
- **App menu state machine** ([src/main/index.ts:53-78](src/main/index.ts#L53-L78)) — Phase 12 menu items (Check for Updates, Installation Guide) are unconditionally enabled (no AppState gating) and slot in next to existing Documentation item which already follows this pattern.
- **electron-builder + GitHub Releases pipeline** (Phase 10/11) — already produces installers and publishes to draft releases. Phase 12 adds `latest*.yml` to the same atomic publish step; no architectural change.

### Established Patterns
- **`core/` is pure TS, zero DOM/Electron deps.** F3's version guard lands in `src/core/loader.ts` and stays consistent with this Layer 3 invariant — no `electron`, no DOM, no `node:fs` from `core/`.
- **No markdown rendering in modals** (HelpDialog: "zero markdown footprint, zero XSS surface"). `UpdateDialog`'s release-notes Summary section follows this constraint — plain-text strip of `electron-updater`'s `releaseNotes`, no HTML rendering.
- **App's URL allow-list at the trust boundary** — adding URLs to the allow-list is the standard Phase 9-onward pattern for any new external-link surface. Pattern-matching is not currently supported (exact-string only); D-18 explicitly flags this for plan-phase resolution.
- **Custom protocol `app-image://`** — registered in `src/main/index.ts` for renderer-side image loading. F1's bug is in URL construction _by the renderer_ (the protocol handler itself is fine — it's getting an invalid host). Audit site is renderer code, not main-process protocol registration.
- **Single-OS test job** today ([.github/workflows/release.yml](.github/workflows/release.yml)) — vitest only runs on `ubuntu-latest`. F1 is the second-order consequence of this gap (Windows regression went uncaught). D-22 closes the gap.
- **`samplingHz` settings persistence** (Phase 9) — there's already a settings-store pattern for the `dismissedUpdateVersion` persistence to reuse. Planner confirms file/format.

### Integration Points
- **App menu → renderer IPC** — existing one-way `webContents.send('menu:help-clicked')` handles Documentation. Phase 12 adds `menu:check-for-updates-clicked` (or equivalent) for the on-demand check (UPD-02, D-07). Renderer subscribes via the existing `window.api.on*` bridge surface in [src/preload/index.ts](src/preload/index.ts).
- **GitHub Releases atomic publish** (Phase 11 D-02) — Phase 12 adds files to the existing publish step; the all-or-nothing CI-05 contract is preserved by construction (publish job remains the only step that touches the Releases API).
- **CI workflow matrix expansion** — touches only the `test` job; the three `build-*` jobs and the `publish` job stay structurally identical.
- **`electron-updater` lifecycle hooks** — main-process consumer; results bridge to the renderer via a new IPC channel (`update:available` / `update:downloaded` / `update:error` / `update:none` — names planner-discretion). Pattern matches the existing `export:progress` one-way send in [src/main/ipc.ts](src/main/ipc.ts).

### Greenfield surface (Phase 12 creates)
- `INSTALL.md` (repo root) — REL-03 deliverable.
- `docs/install-images/` (or equivalent) — committed screenshots.
- `src/renderer/src/modals/UpdateDialog.tsx` — new modal cloning HelpDialog scaffold.
- `dismissedUpdateVersion` persistence file (or settings-store key, depending on planner choice).
- New IPC channels for update lifecycle (main → renderer one-way sends).
- New menu items in Help submenu for "Check for Updates" + "Installation Guide…".

</code_context>

<specifics>
## Specific Ideas

- **Spike test releases land on the main repo, not a scratch repo.** v1.1.0-rc1 is already a draft on the main repo (Phase 11 verification); v1.1.0-rc2 (the spike's "newer version") is published from `main` via the same CI workflow — keeps the spike fidelity-equivalent to a real tester scenario. Plan-phase researcher coordinates the rc2 publish + cleanup (the rc2 draft can be deleted post-spike to avoid confusion).
- **`SHELL_OPEN_EXTERNAL_ALLOWED` pattern-vs-exact** (D-18) — recommended path is option (b): add the **GitHub Releases _index_ page** as a single allow-list entry (`https://github.com/Dzazaleo/Spine_Texture_Manager/releases`). The "View full release notes" link in `UpdateDialog` and the manual-fallback notice on Windows both point at the index page; the user navigates one click further to the specific release. Avoids regex in the trust-boundary check; planner can revisit if a per-release URL surface becomes load-bearing.
- **Windows fallback notice prominence** (D-03) — should appear at startup but NOT be a modal. Planner-discretion location: status-bar-equivalent area, top-of-app banner, or a dedicated low-intrusion surface. Existing app shell does not have a banner pattern today — if planner introduces one it's a new UI primitive that should be minimal and dismissible.
- **F1 reproduction starting point** — repro is in `11-WIN-FINDINGS.md` §Reproduction. The 404'd URL `app-image://localhostc/` is the smoking gun (extra trailing `c` from drive-letter `C:` glued onto `localhost`). Planner audits all renderer sites that construct `app-image://` URLs, ranks by likelihood of being the bug source, and uses `pathToFileURL()` from `node:url` or explicit Windows-path normalization.
- **F3 fixture test** — add `fixtures/SPINE_3_8_TEST/` (or equivalent — minimal 3.8-shaped JSON, doesn't need to be a real rig) so the version-rejection has a regression test. Vitest runs in the expanded matrix (D-22) so the test executes on Windows + macOS + Linux automatically.
- **Auto-update success criterion verification** — Phase 12's verifier (gsd-verifier or equivalent) needs to actually push v1.1.1 (or rc2/rc3) and observe the prompt fire on a v1.1.0-rc1 install. The verification surface is real, not synthetic — matches Phase 11's "actually push the tag" approach in 11-CONTEXT.md §specifics.
- **Linux smoke deferred from Phase 11 to Phase 12 tester rounds** (REL-04 from `.planning/REQUIREMENTS.md`) — the AppImage was produced and uploaded by Phase 11 CI but never functionally verified by a tester. Phase 12 tester rounds are the verification surface; INSTALL.md's libfuse2t64 paragraph (D-15) is the testers' fix recipe when they hit the FUSE error.
- **One small defense-in-depth concern**: `electron-updater` on the unsigned-Windows path may attempt to apply the update via a side-by-side install. If the spike reveals this, Phase 12 documents the known-issue in INSTALL.md (e.g. "if the new version doesn't relaunch automatically, run the new installer manually from %APPDATA%\spine-texture-manager-updater\..."). This is an "only if" surface — no plan currently includes it, but planner is aware.
- **Phase 11 Open Question (STATE.md)** — _"Phase 12: Does unsigned-Windows electron-updater work end-to-end, or do we ship the documented manual-update fallback (UPD-06)? Spike during plan-phase 12."_ — directly resolved by D-01 + D-02. The spike happens, the strict bar decides the path.

</specifics>

<deferred>
## Deferred Ideas

- **Apple Developer ID code-signing + notarization** — v1.2+ candidate, locked out of v1.1 by PROJECT.md. Phase 12 inherits the lock.
- **Windows EV code-signing certificate** — v1.2+ candidate, locked out of v1.1.
- **Crash + error reporting (Sentry or equivalent)** — Phase 13 owns the entire TEL-* group; Phase 12 explicitly does not begin the wiring.
- **CI source-map upload to crash backend** — Phase 13 (TEL-03).
- **Spine 4.3+ versioned loader adapters** — v1.0 deferred list; Phase 12 hard-rejects 4.3+ alongside 3.x via the "less than 4.2 OR not exactly 4.2" decision in F3 (D-21 strict-reject path; the recommended message specifies "4.2 or later" but the runtime check is `major.minor < 4.2`, which is what we mean — 4.3+ is not silently rejected, but it's also not actively supported. Planner refines the precise version-check predicate so 4.2.x passes and 4.3+ produces a distinct, actionable error if needed).
- **Delta updates / staged rollouts / multi-channel release tracks** — out of v1.1 entirely.
- **Feature-usage analytics** — out of v1.1 entirely.
- **Native system-toast update notifications** (Electron `Notification` API) — discussed and rejected (D-05 picked the modal); not revisited unless tester feedback says modals are too intrusive.
- **In-app banner pattern as a general UI primitive** — discussed in the context of Update UX (D-05) and Windows fallback (D-03). The Windows fallback notice introduces a low-intrusion banner-equivalent surface; if it generalizes well, future phases can promote it to a reusable primitive. Not done speculatively in Phase 12.
- **F2 deeper output-path policy redesign** — Phase 12 ships D-20.1 (safeguard restoration) + D-20.2 (picker properties) + D-20.3 (overwrite-warning). A broader "where do exports default to and why" redesign is out of scope; revisit if tester rounds reveal the safeguard restoration isn't enough.
- **Download-progress UI in `UpdateDialog`** — D-05 left this as Claude's discretion. If the planner ships without it, future polish can add it; not a blocking concern.
- **Per-release URL pattern-matching in `SHELL_OPEN_EXTERNAL_ALLOWED`** — D-18 picked the Releases-index URL approach (option b) to avoid regex at the trust boundary. If a per-release URL surface becomes load-bearing later, revisit.
- **F1's findings doc cross-cutting note** about adding Win-runtime tests in CI is realized via D-22 (test-matrix expansion). The note also obliquely suggests an integration-level smoke test (e.g. launching `.exe` headlessly and asserting Atlas Preview renders) — out of scope for Phase 12; tester rounds remain the dynamic verification surface.

</deferred>

---

*Phase: 12-auto-update-tester-install-docs*
*Context gathered: 2026-04-27*
