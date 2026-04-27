# Phase 10: Installer build (electron-builder, all 3 platforms) - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 4 (2 modified existing, 2 new optional)
**Analogs found:** 3 / 4 (one new file has no in-repo analog by design — see "No Analog Found")

---

## File Classification

| New/Modified File                         | Status   | Role           | Data Flow            | Closest Analog                                    | Match Quality          |
|-------------------------------------------|----------|----------------|----------------------|---------------------------------------------------|------------------------|
| `electron-builder.yml`                    | MODIFIED | config (YAML)  | build-time transform | `electron-builder.yml` (self, current state)      | exact (self-extension) |
| `package.json`                            | MODIFIED | config (JSON)  | build-time transform | `package.json` (self, current state)              | exact (self-extension) |
| `build/.gitkeep`                          | NEW      | config (sentinel) | n/a               | `scripts/.gitkeep`                                | exact                  |
| `scripts/verify-installer.sh` (OPTIONAL)  | NEW      | utility (shell)| static-assertion     | (none — repo has zero `.sh` scripts; see below)   | no match               |

**Note on "self-extension":** The two primary files in this phase already exist and already work for the macOS path. The "analog" the planner should copy from is the **same file's existing structure** — preserve the working v1.0 patterns (file allowlist, asarUnpack, mac block scaffolding) and add new sibling blocks (`win:`, `linux:`, `nsis:`, `appImage:`) using the same indentation, key ordering, and `${productName}-${version}-${arch}.${ext}` artifactName convention.

---

## Pattern Assignments

### `electron-builder.yml` (config (YAML), build-time transform)

**Analog:** `electron-builder.yml` — current state (lines 1-48). This is a **self-extension** edit; the existing file establishes every convention the new blocks must follow.

**Top-level structure pattern** (lines 1-11) — preserve verbatim:
```yaml
appId: com.spine.texture-manager
productName: Spine Texture Manager
copyright: Copyright (C) 2026

# D-04: unsigned build. No afterPack / publish / notarize keys.
# D-02 + D-24: macOS-only target in this phase. Windows enablement is additive
# (add a `win:` block in a later phase); deliberately omitted here.

directories:
  output: release
  buildResources: build
```
**Action for executor:** Update the comment block (lines 5-7). The "macOS-only target in this phase" comment is now inaccurate — Phase 10 IS the phase that adds `win:` and `linux:`. Replace with comments matching the v1.1 reality: "ad-hoc macOS, unsigned NSIS, AppImage Linux. No publish: block — that's Phase 12 (auto-update)."

**Files-allowlist pattern** (lines 13-33) — preserve verbatim, do not edit:
```yaml
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
```
This block satisfies CLAUDE.md "`temp/` is gitignored / user source files" and the V14 ASVS allowlist concern. The executor MUST NOT delete or reorder any of these lines. Confirmed correct in RESEARCH.md "Security Domain → Tester source-file leak."

**asarUnpack pattern** (lines 35-38) — preserve verbatim:
```yaml
asarUnpack:
  - resources/**
  - "**/node_modules/sharp/**/*"
  - "**/node_modules/@img/**/*"
```
Both `sharp/**` AND `@img/**` patterns are required (sharp 0.33+ subpackage split). RESEARCH.md Pitfall 1 + Anti-Patterns confirm: removing the `@img/**` line is the #1 way to silently break Optimize Assets in the installed app. Executor MUST NOT touch this block.

**macOS target block — current** (lines 40-47) — extend, do not replace:
```yaml
mac:
  category: public.app-category.developer-tools
  target:
    - dmg
  artifactName: ${productName}-${version}-${arch}.${ext}

dmg:
  artifactName: ${productName}-${version}-${arch}.${ext}
```

**macOS target block — phase 10 target state** (per RESEARCH.md "Pattern 1" + "Code Examples" lines 502-513):
```yaml
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64                                  # explicit; was implicit in v1.0
  identity: '-'                                    # ad-hoc (DIST-04)
  hardenedRuntime: false
  gatekeeperAssess: false
  artifactName: ${productName}-${version}-${arch}.${ext}

dmg:
  artifactName: ${productName}-${version}-${arch}.${ext}
```
**Diff summary:** Add four lines (`identity: '-'`, `hardenedRuntime: false`, `gatekeeperAssess: false`, plus the `arch: arm64` sub-key on the existing target). Per RESEARCH.md Anti-Patterns: use `'-'` (with quotes), NOT `null`. The single quotes matter in YAML — bare `-` is a list marker.

**Windows target block — NEW** (insert after `dmg:` block; per RESEARCH.md "Pattern 2" lines 515-526):
```yaml
win:
  target:
    - target: nsis
      arch: x64
  artifactName: ${productName}-${version}-${arch}.${ext}
  # NO certificateFile / certificateSubjectName / signingHashAlgorithms
  # ⇒ unsigned (DIST-05).

nsis:
  oneClick: false                       # show install wizard
  perMachine: false                     # per-user install (no UAC prompt)
  allowToChangeInstallationDirectory: true
  artifactName: ${productName}-${version}-${arch}.${ext}
```

**Linux target block — NEW** (insert after `nsis:` block; per RESEARCH.md "Pattern 4" lines 528-536):
```yaml
linux:
  target:
    - target: AppImage
      arch: x64
  category: Development                          # freedesktop.org category, NOT macOS LSApplicationCategoryType
  artifactName: ${productName}-${version}-${arch}.${ext}

appImage:
  artifactName: ${productName}-${version}-${arch}.${ext}
```

**Convention enforcement:** Every `artifactName` in the file uses the same template `${productName}-${version}-${arch}.${ext}`. The new blocks MUST follow this; do not introduce a new format like `${name}-${version}` or `${productName}_${version}`. Consistency here is what makes RESEARCH.md DIST-07 verifiable by `grep` rather than per-platform parsing.

**Comment style:** Existing file uses `# D-XX:` decision-trace comments (e.g., line 5 `# D-04: unsigned build`). The new blocks use ASCII-arrow comments `⇒ unsigned (DIST-05)` per RESEARCH.md "Pattern 2." Either style is acceptable; planner should pick one and apply uniformly across the new blocks.

---

### `package.json` (config (JSON), build-time transform)

**Analog:** `package.json` — current state (lines 1-52). Self-extension edit.

**Version field pattern** (line 3) — modify:
```json
  "version": "0.0.0",
```
**Phase 10 target state** (per RESEARCH.md Pitfall 2 + Open Question #2):
```json
  "version": "1.1.0-rc1",
```
RESEARCH.md recommends `1.1.0-rc1` for Phase 10 deliverable; bump to `1.1.0` (no suffix) at milestone close. Planner: confirm the `rc1` vs `1.1.0` choice with user when drafting PLAN.md (this is the only open question that genuinely needs resolution before execution).

**Scripts block — current** (lines 8-19):
```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json",
    "cli": "tsx scripts/cli.ts",
    "dev": "electron-vite dev",
    "build": "electron-vite build && electron-builder --mac dmg",
    "build:dry": "electron-vite build && electron-builder --mac dmg --dir",
    "preview": "electron-vite preview"
  },
```

**Scripts block — phase 10 target state** (per RESEARCH.md "Code Examples" lines 543-551):
```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json",
    "cli": "tsx scripts/cli.ts",
    "dev": "electron-vite dev",
    "build": "electron-vite build && electron-builder",
    "build:mac": "electron-vite build && electron-builder --mac dmg",
    "build:win": "electron-vite build && electron-builder --win nsis",
    "build:linux": "electron-vite build && electron-builder --linux AppImage",
    "build:dry": "electron-vite build && electron-builder --mac dmg --dir",
    "preview": "electron-vite preview"
  },
```

**Diff summary:**
1. `build` script: drop the `--mac dmg` flag so it picks the host's default targets (lets a Windows user run plain `npm run build` and get a `.exe`). Old verbatim was `electron-vite build && electron-builder --mac dmg`; new is `electron-vite build && electron-builder`.
2. Add three new explicit per-platform scripts (`build:mac`, `build:win`, `build:linux`) — each follows the existing two-stage pattern `electron-vite build && electron-builder <platform-flag>`.
3. Preserve `build:dry` exactly — it's already correctly macOS-specific because its purpose is fast iteration on the macOS host.

**Naming convention enforcement:** Existing repo uses colon-separated namespacing (`typecheck:node`, `typecheck:web`, `test:watch`). The new `build:mac` / `build:win` / `build:linux` follow this convention. Do not switch to `build-mac` or `dist:mac` — RESEARCH.md Open Question doesn't dictate the form, but consistency with `typecheck:*` makes the namespace homogeneous.

**No-touch zones:** Lines 1-7 (name/private/type/main/description) and lines 20-51 (dependencies, devDependencies, engines) are out of scope for Phase 10. The phase touches **two keys only**: `version` and `scripts`. Resist the urge to bump dep versions in this phase — RESEARCH.md "Don't Hand-Roll" confirms the stack is current.

---

### `build/.gitkeep` (config (sentinel), n/a)

**Analog:** `scripts/.gitkeep` (exact match — same purpose, same convention).

**Pattern** (file is empty, 0 bytes):
```
# (empty file)
```

**Why:** RESEARCH.md Pitfall 4: `electron-builder.yml` references `directories.buildResources: build`, but `build/` does not exist on disk. electron-builder is forgiving today, but a future YAML edit referencing `build/icon.icns` will fail noisily. Adding an empty `.gitkeep` parallels the existing `scripts/.gitkeep` pattern and lets the directory survive `git clone`.

**Action for executor:** `mkdir build && touch build/.gitkeep`. Single command. No content. Add to git.

---

### `scripts/verify-installer.sh` (utility (shell), static-assertion) — OPTIONAL

**See "No Analog Found" section below.** This file is recommended by RESEARCH.md "Wave 0 Gaps" as optional. The repo has zero `.sh` files; all existing automation is TypeScript via `tsx`. Planner decision required: inline the verification commands into the PLAN.md task list (executor runs them ad-hoc post-build), OR commit a new shell script (introduces a new file class to the repo).

---

## Shared Patterns

### Pattern: artifactName template
**Source:** `electron-builder.yml:44`
**Apply to:** Every new target block (`mac.artifactName`, `dmg.artifactName`, `win.artifactName`, `nsis.artifactName`, `linux.artifactName`, `appImage.artifactName`).
```yaml
artifactName: ${productName}-${version}-${arch}.${ext}
```
**Why:** Consistent rendering means `release/Spine Texture Manager-1.1.0-rc1-arm64.dmg`, `release/Spine Texture Manager-1.1.0-rc1-x64.exe`, `release/Spine Texture Manager-1.1.0-rc1-x86_64.AppImage` all parse with the same regex. RESEARCH.md DIST-07 verification depends on this uniformity.

### Pattern: two-stage build script
**Source:** `package.json:16-17` (existing `build` and `build:dry` scripts)
**Apply to:** Every new `build:*` script.
```
electron-vite build && electron-builder <platform-flag>
```
**Why:** Stage 1 (`electron-vite build`) bundles `src/main`, `src/preload`, `src/renderer` into `out/`. Stage 2 (`electron-builder`) reads `out/` and packs. Both stages must run on every install, in this order. RESEARCH.md Architecture Diagram confirms.

### Pattern: gitkeep sentinel for empty-but-required dirs
**Source:** `scripts/.gitkeep` (existing)
**Apply to:** `build/.gitkeep` (new).
**Why:** Git does not track empty directories. `directories.buildResources: build` in YAML requires the directory to exist; sentinel file is the standard fix.

### Pattern: decision-trace comments in YAML
**Source:** `electron-builder.yml:5` (`# D-04: unsigned build. ...`)
**Apply to:** New target blocks may optionally include `# DIST-04:`, `# DIST-05:`, `# DIST-03:` decision-trace comments referencing RESEARCH.md requirement IDs. Existing `D-XX` style is from milestone v1.0; new comments using `DIST-XX` style trace v1.1 requirements (per RESEARCH.md `<phase_requirements>` table).

### Pattern: NOT-touched zones
The following blocks are **load-bearing for v1.0** and must NOT be edited in Phase 10:
- `electron-builder.yml` `files:` allowlist (lines 16-33) — controls what ships, security-relevant.
- `electron-builder.yml` `asarUnpack:` (lines 35-38) — controls sharp packaging, DIST-06-relevant.
- `package.json` `dependencies` (lines 20-28) and `devDependencies` (lines 29-48) — version stack is current per RESEARCH.md.

Executor invariant: If a diff in Phase 10 touches any of these zones, the executor must stop and re-read RESEARCH.md "Pitfall 1" / "Anti-Patterns" before proceeding.

---

## No Analog Found

| File                              | Role            | Data Flow         | Reason                                                                                                                |
|-----------------------------------|-----------------|-------------------|-----------------------------------------------------------------------------------------------------------------------|
| `scripts/verify-installer.sh`     | utility (shell) | static-assertion  | Repo has zero `.sh` scripts. All automation is TypeScript via `tsx` (e.g., `scripts/cli.ts`, `scripts/probe-*.ts`). |

**Planner guidance for verify-installer:** Two viable paths:

1. **Inline (recommended):** Embed the shell-assertion commands directly into PLAN.md as a per-platform verification checklist. Executor runs them by hand or pastes them into a terminal. No new file. This matches the existing repo posture (RESEARCH.md "manual smoke test" + Pattern 8 are already manual; one more set of manual asserts fits the phase character).

2. **Extract:** Commit `scripts/verify-installer.sh` as the first `.sh` file in the repo. Source patterns from RESEARCH.md "Code Examples → Verification commands" (lines 558-581). If chosen, planner should write a PLAN.md task that creates the file with executable bit set (`chmod +x`) and includes a header comment `#!/usr/bin/env bash\nset -euo pipefail` since the repo has no precedent for shell scripting style.

**Note on the alternate "TypeScript verification script" path:** Possible to write `scripts/verify-installer.ts` mirroring `scripts/cli.ts`'s structure (`tsx`-runnable, uses Node `child_process`). But the verification commands (`codesign`, `plutil`, `signtool`, `ls`) are platform-specific shell tools, not amenable to a TS wrapper without ceremony. Shell or inline is more appropriate. Defer the TypeScript option unless planner explicitly wants it.

---

## Metadata

**Analog search scope:**
- `/electron-builder.yml` (whole file, 48 lines)
- `/package.json` (whole file, 52 lines)
- `/scripts/` (directory listing — 14 .ts files, 1 .gitkeep, no .sh)
- `/build/` (does not exist; confirmed via `ls`)
- `/release/` (existing `Spine Texture Manager-0.0.0-arm64.dmg` confirms macOS path works in v1.0 — proves DIST-02 baseline)

**Files scanned:** 4 source files + 2 directory listings.

**Pattern extraction date:** 2026-04-27

**Confidence in pattern assignments:**
- HIGH for `electron-builder.yml` extension — every new block has a verbatim recipe in RESEARCH.md "Code Examples" + a self-analog (existing `mac:` block) for indentation/comment style.
- HIGH for `package.json` script additions — three new scripts follow the existing two-stage `build` pattern exactly.
- HIGH for `build/.gitkeep` — exact analog (`scripts/.gitkeep`) exists.
- MEDIUM for `scripts/verify-installer.sh` (optional, no analog) — planner must choose inline-vs-extract; either is defensible.

**Decision points the planner still owns:**
1. `1.1.0` vs `1.1.0-rc1` for the version bump (RESEARCH.md Open Question #2 — recommendation: `1.1.0-rc1`).
2. Inline verification vs. `scripts/verify-installer.sh` (no analog precedent — recommendation: inline).
3. Comment style for new YAML blocks: `# D-XX` (v1.0 style, milestone-decision IDs) vs. `# DIST-XX` (RESEARCH.md requirement IDs) vs. plain prose. Recommendation: `# DIST-XX:` for new blocks since they trace directly to v1.1 requirements; leave existing `# D-04:` comments untouched.
