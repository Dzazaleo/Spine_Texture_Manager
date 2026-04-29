# Phase 11: CI release pipeline (GitHub Actions → draft Release) — Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 3 (2 created, 1 modified)
**Analogs found:** 1 / 3 (one in-repo analog; two greenfield against RESEARCH §Patterns)

> **Special framing for this phase:** Phase 11 is **greenfield CI**. There is no existing
> `.github/` directory in the repo, no prior workflow YAML, and no prior release-notes template.
> The bulk of this phase's code shape comes from `11-RESEARCH.md` §Patterns (which already
> contains the full target `release.yml` as a copy-pasteable artifact in §"Code Examples"),
> NOT from existing repo files. The closest *in-repo* style analog is `electron-builder.yml`
> (YAML conventions, comment style, top-of-file rationale block). The only file with a true
> in-repo analog is `package.json` itself (modified to bake `--publish never` into existing
> `build:*` scripts).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/release.yml` (NEW) | CI workflow / orchestration config | event-driven (tag push, workflow_dispatch) | RESEARCH §"Code Examples" complete release.yml; in-repo style only: `electron-builder.yml` | greenfield + style-only |
| `.github/release-template.md` (NEW) | release-notes template (envsubst-rendered markdown) | transform (string substitution) | RESEARCH §"Pattern 7" complete template | greenfield, no in-repo analog |
| `package.json` (MODIFIED) | build-script manifest (defensive `--publish never` bake-in) | n/a (config) | `package.json#scripts` itself (existing `build:mac`/`build:win`/`build:linux`) | exact (self-analog: extend existing pattern) |

## Pattern Assignments

### `.github/workflows/release.yml` (CI workflow, event-driven)

**Authoritative source:** `11-RESEARCH.md` §"Code Examples" → "Complete `.github/workflows/release.yml` (target state — combines all patterns)" (lines 753–906 of RESEARCH). The planner SHOULD copy this YAML verbatim into the plan's action section, with action SHAs preserved exactly as-pinned.

**Style-only in-repo analog:** `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/electron-builder.yml`

The existing `electron-builder.yml` establishes three project-level YAML conventions worth honoring in `release.yml`:

1. **Top-of-file rationale comment block.** `electron-builder.yml` opens with a 3–4 line comment block explaining what phase introduced the file and which decisions are encoded. RESEARCH's target `release.yml` already follows this pattern (top-of-file comment listing runner image rationale + SHA-pinning rationale); honor it.

   `electron-builder.yml` lines 1–8 (style template):
   ```yaml
   appId: com.spine.texture-manager
   productName: Spine Texture Manager
   copyright: Copyright (C) 2026

   # v1.1 Phase 10: ad-hoc macOS, unsigned NSIS, AppImage Linux.
   # DIST-04: mac single-quoted dash identity locks ad-hoc signing (was implicit on Apple Silicon in v1.0).
   # DIST-05: no Windows code-signing keys are present, so the NSIS installer is unsigned.
   # No release-channel block — auto-update wiring is Phase 12 (UPD-01..UPD-06).
   ```

2. **2-space YAML indentation** (no tabs, no 4-space). Confirmed throughout `electron-builder.yml`.

3. **Comment style:** `#` line comments referencing requirement IDs (e.g., `# DIST-04`, `# DIST-05`). `release.yml` should reference `# CI-01..CI-06`, `# REL-01..REL-04`, and `# D-01..D-23` for traceability the same way.

**Imports / `uses:` pattern (greenfield — copy from RESEARCH):**

All five third-party actions are SHA-pinned with the version as a trailing `# vX.Y.Z` comment.
Source: RESEARCH §Standard Stack table.

```yaml
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
- uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
- uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093  # v4.3.0
- uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  # v2.6.2
```

**Trigger pattern** (RESEARCH §Pattern 1):

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
```

**Workflow-level guards** (RESEARCH §Pattern 2):

```yaml
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false       # D-19

permissions:
  contents: write                 # D-20
```

**Tag↔package.json version-guard pattern** (RESEARCH §Pattern 3):

```yaml
- name: Verify tag matches package.json version
  if: github.event_name == 'push'      # D-10 — skip on workflow_dispatch
  run: |
    TAG_VERSION="${GITHUB_REF_NAME#v}"
    PKG_VERSION="$(node -p "require('./package.json').version")"
    if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
      echo "::error::Tag $GITHUB_REF_NAME does not match package.json version $PKG_VERSION."
      echo "::error::Run 'npm version <X>' before tagging, or delete the tag and retry."
      exit 1
    fi
    echo "Tag $GITHUB_REF_NAME ↔ package.json $PKG_VERSION — OK"
```

**Per-platform build-job pattern** (RESEARCH §Pattern 4):

Three near-identical jobs, each with `needs: test`, native runner, `npm ci`, `npm run build:<os> -- --publish never`, then `actions/upload-artifact` with `if-no-files-found: error`. Full YAML in RESEARCH lines 808–865.

**Critical per-job invariants:**
- `if-no-files-found: error` on every upload-artifact step (catches silent zero-file uploads).
- `retention-days: 14` (explicit override of 90-day default).
- `node-version: 22` (LTS, pre-installed on all three runners).
- `cache: 'npm'` on every setup-node (lockfile-keyed, ~30s/job savings).
- `npm ci` (NOT `npm install`) per D-16.
- macOS-only: `env: CSC_IDENTITY_AUTO_DISCOVERY: false` (defensive per Pitfall 7).
- macOS-only: NEVER set `GH_TOKEN` or `GITHUB_TOKEN` env (Pitfall 1).

**Atomic publish job pattern** (RESEARCH §Pattern 6):

```yaml
publish:
  needs: [build-mac, build-win, build-linux]
  runs-on: ubuntu-latest
  if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')   # D-04
  permissions:
    contents: write
  steps:
    - uses: actions/checkout@<sha>
    - name: Download all platform installers
      uses: actions/download-artifact@<sha>
      with:
        pattern: installer-*
        merge-multiple: true
        path: ./assets
    - name: Render release body from template
      env:
        VERSION: ${{ github.ref_name }}
        TAG: ${{ github.ref_name }}
        INSTALL_DOC_LINK: https://github.com/${{ github.repository }}/blob/main/README.md
      run: envsubst < .github/release-template.md > release-body.md
    - name: Create draft GitHub Release
      uses: softprops/action-gh-release@<sha>
      with:
        tag_name: ${{ github.ref_name }}
        name: ${{ github.ref_name }}
        body_path: release-body.md
        draft: true
        prerelease: ${{ contains(github.ref_name, '-') }}
        fail_on_unmatched_files: true
        files: |
          assets/*.dmg
          assets/*.exe
          assets/*.AppImage
```

**Error / failure-mode handling:**
- The `needs:` graph is the entire error-handling mechanism for CI-05 atomicity. If any build job fails, `publish` is never scheduled (status: "Skipped" in the run UI).
- `fail_on_unmatched_files: true` on the softprops step catches the pathological "download-artifact returned empty directory" case.
- `if-no-files-found: error` on every upload-artifact is the upstream guard for the same.
- No `try/catch` equivalent at the YAML level; failure semantics are step-level + job-level + workflow-level.

**Validation pattern:** None at the unit-test level (RESEARCH §"Validation Architecture" explicitly forbids inventing vitest tests for YAML — they are tautologies). The validation gate is the live first-real-run of `v1.1.0-rc1`.

---

### `.github/release-template.md` (release-notes template, transform)

**Authoritative source:** `11-RESEARCH.md` §"Pattern 7" lines 528–558 + §"Code Examples" lines 908–937. Copy verbatim.

**No in-repo analog** — there is no existing markdown template anywhere in the repo that uses `${VAR}` envsubst placeholders. The closest convention-only reference is the project's existing markdown style (CLAUDE.md, REQUIREMENTS.md, ROADMAP.md) — H1 titles, `##` section headers, conventional Markdown.

**Required structure (RESEARCH §Pattern 7 + D-11):**

```markdown
# Spine Texture Manager ${VERSION}

## Summary

<!-- One-line summary of what this release contains. Edit before publishing. -->

## New in this version

<!-- Bullet list of user-facing changes. Edit before publishing. -->

## Known issues

<!-- Any issues testers should know about. Edit before publishing. -->

## Install instructions

Choose the installer for your platform:

- **macOS (Apple Silicon):** Download the `.dmg`. After mounting, drag to /Applications. **First launch:** macOS will block the app (it's ad-hoc-signed). Open System Settings → Privacy & Security → scroll to the bottom → click "Open Anyway" next to the Spine Texture Manager row.
- **Windows (x64):** Download the `.exe`. Double-click. SmartScreen will show "Windows protected your PC" — click "More info" → "Run anyway". Then walk through the NSIS installer.
- **Linux (x64):** Download the `.AppImage`. Make it executable: `chmod +x "Spine Texture Manager-${VERSION}-x86_64.AppImage"`, then run it. On Ubuntu 24.04+ you may need `sudo apt install libfuse2t64`.

For full install instructions: ${INSTALL_DOC_LINK}

## Tag

This release was built from tag `${TAG}`.
```

**Placeholder contract:**
- `${VERSION}` — receives `${{ github.ref_name }}` (e.g., `v1.1.0-rc1`).
- `${TAG}` — receives the same value as `${VERSION}` in v1.1 (RESEARCH treats them as duplicates; the distinction exists for forward-compat with future tag/version divergence).
- `${INSTALL_DOC_LINK}` — Phase 11: points at `README.md`. Phase 12 will repoint at `INSTALL.md` once REL-03 lands.

**Substitution mechanism:** `envsubst` (pre-installed on `ubuntu-latest` via `gettext-base`). No `sed`, no Mustache, no Jinja. RESEARCH explicitly recommends `envsubst` over `sed` (handles `/` and `&` in substitution values without escaping concerns).

**Phase-12 forward note (RESEARCH §Pattern 7 closing):** The inline first-launch text (Gatekeeper / SmartScreen / `chmod +x`) is intentionally redundant with future INSTALL.md. Per D-13, this redundancy is acceptable for v1.1 and is updated in Phase 12.

---

### `package.json` (MODIFIED — defensive `--publish never` bake-in)

**Self-analog:** the existing `scripts` block in `package.json` itself.

**Existing pattern** (`package.json` lines 17–19):
```json
"build:mac": "electron-vite build && electron-builder --mac dmg",
"build:win": "electron-vite build && electron-builder --win nsis",
"build:linux": "electron-vite build && electron-builder --linux AppImage",
```

**Target pattern** (RESEARCH §"Defensive `package.json` script update"):
```json
"build:mac": "electron-vite build && electron-builder --mac dmg --publish never",
"build:win": "electron-vite build && electron-builder --win nsis --publish never",
"build:linux": "electron-vite build && electron-builder --linux AppImage --publish never",
```

**Rationale (RESEARCH §Pitfall 1 + Open Question 1):**
- Bakes the `--publish never` protection into the npm script so it survives even if a future workflow author forgets to append `-- --publish never` in `release.yml`.
- Zero behavioral change for Phase 10 dev-host builds (no `GH_TOKEN` was set there either).
- Phase 12 will revisit when wiring `publish: github` into `electron-builder.yml` for auto-update support — that's Phase 12's concern.
- Recommended in RESEARCH Open Question 1 with answer: "Bake into package.json. The protection should travel with the build script regardless of who invokes it."

**Pattern shape (preserve all existing conventions):**
- Single-line script values (no multi-line continuation).
- `&&` chaining of `electron-vite build` → `electron-builder ...`.
- Trailing `--publish never` flag, space-separated, after the `--<os> <target>` flag pair.
- No quoting changes; flags are unambiguous space-separated tokens.

**Other `package.json` keys unchanged:** `version`, `dependencies`, `devDependencies`, `engines`, `main`, `type`. Phase 11 ONLY touches the three `build:*` script values.

---

## Shared Patterns

### SHA-Pinning of GitHub Actions

**Source:** RESEARCH §Standard Stack + §Pitfall 4 (supply-chain hygiene)
**Apply to:** Every `uses:` directive in `release.yml`

```yaml
- uses: <owner>/<action>@<full-40-char-commit-sha>  # vX.Y.Z
```

The trailing `# vX.Y.Z` comment is required for human-readable version tracking; the SHA is what GitHub actually resolves. Bumping is a deliberate PR (update both the SHA and the comment), never a floating tag re-point.

### `if-no-files-found: error` on Every Upload-Artifact

**Source:** RESEARCH §Anti-Patterns + §Pattern 5
**Apply to:** Every `actions/upload-artifact@v4` step in build jobs (3 occurrences)

```yaml
- uses: actions/upload-artifact@<sha>
  with:
    name: installer-<os>
    path: release/*.<ext>
    if-no-files-found: error      # <-- non-negotiable
    retention-days: 14
```

Without this, a silent build failure that emitted no installer file would upload an empty artifact, and the publish job would proceed with 2 of 3 assets attached to the draft release. This is the explicit upstream guard for CI-05 atomicity.

### `--publish never` on Every electron-builder Invocation

**Source:** RESEARCH §Pitfall 1 (the load-bearing trap)
**Apply to:** All three `npm run build:<os>` invocations in `release.yml` AND (defensively) all three `package.json#scripts.build:<os>` definitions

```yaml
# In release.yml:
- run: npm run build:mac -- --publish never
- run: npm run build:win -- --publish never
- run: npm run build:linux -- --publish never
```

```json
// In package.json (defensive, Wave 0 patch):
"build:mac": "electron-vite build && electron-builder --mac dmg --publish never",
"build:win": "electron-vite build && electron-builder --win nsis --publish never",
"build:linux": "electron-vite build && electron-builder --linux AppImage --publish never",
```

Belt-and-braces. If `package.json` already has it baked in, the YAML's `-- --publish never` is redundant but harmless. RESEARCH recommends both layers.

### Never Export `GH_TOKEN` / `GITHUB_TOKEN` to env

**Source:** RESEARCH §Pitfall 1 + §Anti-Patterns + §Security Domain
**Apply to:** All three build jobs in `release.yml`

**Anti-pattern (do NOT do this):**
```yaml
build-mac:
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}    # <-- breaks atomicity
```

**Correct pattern (do nothing — GHA does not auto-export GITHUB_TOKEN to env):**
```yaml
build-mac:
  # No env block needed for GH_TOKEN at all.
  # The publish job uses ${{ github.token }} via the softprops action input — never via env.
  steps:
    - run: npm run build:mac -- --publish never
```

The publish job receives the token implicitly through the `softprops/action-gh-release` action's default `token:` input (which is `${{ github.token }}`). No explicit `env: GH_TOKEN: ...` is needed anywhere.

### Comment-Driven Decision Traceability (in-repo style)

**Source:** `electron-builder.yml` lines 5–8 (existing convention)
**Apply to:** `release.yml` top-of-file comment block + per-step comments

`electron-builder.yml` references `DIST-04`, `DIST-05` in inline comments. `release.yml` should reference `CI-01..CI-06`, `REL-01..REL-04`, and `D-01..D-23` the same way — every non-obvious decision (concurrency, permissions, tag glob, runner pin, version-guard skip-on-dispatch, etc.) gets a one-line comment naming the governing requirement or decision ID.

Example shape:
```yaml
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false       # D-19 — never cancel a half-built release

permissions:
  contents: write                 # D-20 — minimum scope
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/release.yml` | CI workflow YAML | event-driven | Repo has no `.github/` directory; first GHA workflow. **Mitigation:** RESEARCH §"Code Examples" provides the complete target YAML as a copy-pasteable artifact. |
| `.github/release-template.md` | release-notes template | transform | First markdown template using envsubst placeholders in this repo. **Mitigation:** RESEARCH §Pattern 7 + §"Code Examples" provides complete template. |

**Implication for the planner:** For the two greenfield files, the planner's plan-action sections should reference RESEARCH section/line numbers as the authoritative pattern source, NOT search for further in-repo analogs. The only true in-repo pattern reuse is the `package.json#scripts` self-extension.

## Metadata

**Analog search scope:**
- `Read` of `electron-builder.yml` (full file, 79 lines) — confirmed no `publish:` block, captured YAML style conventions.
- `Read` of `package.json` (full file, 56 lines) — confirmed existing `build:*` scripts and that `--publish never` is not currently present.
- `Read` of `11-CONTEXT.md` (full file, 162 lines) — extracted file list (D-01 → `release.yml`, D-11 → `release-template.md`) and constraints.
- `Read` of `11-RESEARCH.md` (sections: lines 1–400, 400–800, 800–1100, 1099–1196) — extracted complete target YAML, complete template, defensive package.json patch, and shared-pattern rules.
- **No directory listing or grep was needed:** CONTEXT explicitly states "No CI infrastructure exists yet. No `.github/` directory in the repo." (line 120) and "Greenfield surface" (line 129). RESEARCH confirms the same and provides the complete target artifacts inline.

**Files scanned:** 4 (`electron-builder.yml`, `package.json`, `11-CONTEXT.md`, `11-RESEARCH.md`).

**Pattern extraction date:** 2026-04-27

## PATTERN MAPPING COMPLETE
