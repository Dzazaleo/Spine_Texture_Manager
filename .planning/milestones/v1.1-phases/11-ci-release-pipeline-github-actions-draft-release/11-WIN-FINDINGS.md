---
phase: 11
type: findings-spillover
created: 2026-04-27
source: 11-02-PLAN.md / Task 5 — REL-04 install smoke
target_phase: 12 (tester distribution + INSTALL.md / REL-03)
status: open
---

# Phase 11 — Windows runtime findings (spillover for Phase 12)

These are runtime defects in the **app** (not the CI release pipeline) discovered during the v1.1.0-rc1 install smoke on Windows 11 x64. They are recorded here so Phase 11 can close cleanly while the items remain visible during Phase 12 planning.

**None of these block Phase 11.** Phase 11's contract is the CI release pipeline (build artifacts → atomic publish → draft release). That contract is met: the `.exe` was built by GHA, installed via NSIS, and the primary user workflow (Optimize Assets) works correctly on Spine 4.2 input. These findings are pre-existing app/UX bugs that were latent until Phase 11 produced the first Windows install ever (Phase 10 smoke was macOS-only).

## F1: Atlas Preview broken on Windows

**Severity:** medium (atlas viewer is a primary user-facing feature)
**Discovered in:** Spine Texture Manager v1.1.0-rc1 Windows x64 NSIS install
**Surface:** in-app **Atlas Preview** modal

### Symptoms

- Atlas viewer opens; rectangles for each region render correctly.
- Underlying texture image does NOT render — only the rect outlines are visible.
- DevTools console shows:
  ```
  GET app-image://localhostc/ 404 (Not Found)
  Image
    (anonymous) @ index-DT659NNz.js:16205
    (anonymous) @ index-DT659NNz.js:16439
    commitHookEffectListMount @ index-DT659NNz.js:6947
    [...React render stack...]
  ```
- Note the `localhostc` literal (extra trailing `c`). This strongly suggests a path-concatenation bug where a Windows path separator (`\\` or `\`) is leaking into the custom `app-image://` URL scheme — likely something like `app-image://localhost` + `c:\\Users\\...` being naively concatenated to produce `app-image://localhostc\\Users...` and then URL-encoded.

### Hypothesis

The custom protocol handler (`app-image://`) was likely written assuming POSIX paths. On Windows, paths look like `C:\Users\...`. If the URL is constructed with `new URL(filepath, 'app-image://localhost')` or string concat, the `C:` drive letter gets glued onto `localhost` and produces invalid URL hosts.

### Reproduction

1. Install v1.1.0-rc1 NSIS on Windows.
2. Load any Spine 4.2 JSON.
3. Click **Atlas Preview**.
4. Modal opens; rect outlines render but PNG textures do not.
5. Open DevTools (Ctrl+Shift+I) → Console → see the 404 on `app-image://localhostc/`.

### Suggested fix

- Audit every place the renderer constructs `app-image://` URLs from filesystem paths. Use `pathToFileURL()` from `node:url` or explicitly normalize Windows paths before building the URL host/path components.
- Add a Windows runtime test (vitest in CI matrix on `windows-2022` runner — currently CI only runs the test job on `ubuntu-latest`; consider running tests on all 3 runners for cross-platform regression coverage).

### Phase placement

**Phase 12 prerequisite.** Atlas Preview is mentioned in REL-03 (INSTALL.md user surface). Cannot ship to non-developer testers with the viewer broken on Windows.

---

## F2: File-picker UX confusion on Windows

**Severity:** low / UX (workaround exists; doesn't block functionality)
**Discovered in:** Optimize Assets → output folder picker, on Windows 11
**Surface:** native Windows folder picker dialog (Electron `dialog.showOpenDialog` or similar)

### Symptoms

The output-location picker pre-fills the folder name field with the literal string `images`. On Windows:

1. User clicks **Optimize Assets** → output picker opens at the source-file directory (`Desktop\stm\` in the repro).
2. Field at bottom shows `Folder: images`.
3. User clicks **Export Here**.
4. Dialog: _"images — This file doesn't exist. Create the file?"_ (Windows interprets the prefilled name as a save-as filename).
5. User clicks Yes → second dialog: _"images — The folder name is not valid"_ (Windows rejects "images" as a literal filename without extension).
6. Workaround: user clicks **New folder**, types a custom name, clicks **Export Here** → works correctly. 153/153 succeeded in 10.7s.

The user noted: _"Maybe this error happens because app opens output location in the same place as source files? I think we had a safeguard against that. Anyway, it should only issue a warning if it will overwrite anything."_

### Hypothesis

The Optimize Assets flow specifies `defaultPath` = source-file directory + `images` as the suggested folder name. On macOS this is harmless (the picker treats it as a suggested NEW folder name). On Windows the native picker treats it as an open-existing-folder request and errors when the named folder isn't there.

### Suggested fix

Two-part:
1. **Output location strategy.** Confirm/restore the documented safeguard preventing the picker from defaulting to the same directory as source files. If the safeguard exists and was lost in a refactor, this is a regression worth a Phase 12 fix.
2. **Folder-vs-filename UX.** On Windows, when prompting for an output FOLDER, pass `properties: ['openDirectory', 'createDirectory']` to `dialog.showOpenDialog` instead of treating it as a save-as. This sidesteps the prefilled-name confusion entirely.
3. **Overwrite warning.** Per user request: only issue a warning if the export would overwrite existing files in the chosen folder. Don't fail/warn on empty target folders.

### Phase placement

**Phase 12 polish.** Doesn't block functionality (workaround works) but the first-run UX is confusing for non-developer testers. Should be fixed before broader tester rounds.

---

## F3: No safeguard for Spine 3.8 rigs

**Severity:** medium / UX (silent failure mode)
**Discovered in:** maintainer's Windows smoke when accidentally loading a Spine 3.8 fixture
**Surface:** Optimize Assets pipeline

### Symptoms

- User loads a Spine 3.8 JSON.
- App reads the file without error, populates the rig info panel.
- Optimize Assets runs to completion — the progress UI shows attachments being processed.
- Result: every attachment silently "fails" or produces no output. The app reports success but no usable images are written.

User initially misreported this as "Optimize Assets is broken on Windows"; subsequently confirmed that switching to a Spine 4.2 fixture resolves the issue and 153/153 succeeds in 10.7s.

### Hypothesis

Spine 4.2's JSON schema differs from 3.8 (different bone-curve representation, attachment metadata, etc.). The loader silently parses 3.8 input as if it were 4.2 because most fields overlap, but later processing steps fail to find expected 4.2-only fields and skip every attachment.

### Suggested fix

At skeleton-load time:
1. Read `skeleton.spine` (the version field — 4.2+ stores it explicitly).
2. If the version major.minor is < `4.2`, refuse to load with a clear error: _"This file was exported from Spine ${version}. Spine Texture Manager requires Spine 4.2 or later. Please re-export from Spine 4.2+ in the Spine editor."_
3. Add a fixture test against a 3.8-shaped JSON to lock the version-rejection behavior.

CLAUDE.md already documents this as a critical fact: _"Reads Spine 4.2+ skeleton JSON"_. The runtime safeguard is missing.

### Phase placement

**9.x retroactive polish OR Phase 12 prereq.** Should land before tester rounds — testers won't know which Spine version their rigs are exported from and will report "the app is broken" when it's actually rejecting unsupported input silently.

---

## Cross-cutting note

Findings F1 and F2 are **Windows-specific** runtime bugs that would have been caught earlier if Phase 9/10 had run tests on a Windows CI runner. F3 is platform-agnostic but only surfaced on Windows during this smoke because the maintainer happened to grab a 3.8 rig from local desktop content.

**Phase 12 recommendation:** add `windows-2022` to the test matrix in `release.yml`, at least for vitest. Currently only `ubuntu-latest` runs tests; the build matrix produces `.exe` binaries but never exercises any of the app's behavior on Windows.
