# Phase 15: Build/feed shape fix + v1.1.2 release - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 10 (7 modified + 3 greenfield)
**Analogs found:** 10/10 (all in-tree precedents — no external pattern lookups needed)

> **For the planner.** Every entry below names a real file at a real line range. When writing PLAN.md `<read_first>` and `<acceptance_criteria>` blocks, cite the analog file + line numbers verbatim. The "do-not-misread" callouts encode subtle gotchas (anchored regexes, the `findInstaller` → `findInstallers` rename, the win/linux paths that must NOT change) that would silently break the v1.1.2 ship if the planner abstracts past them.

---

## File Classification

| File | Created/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|------------------|------|-----------|----------------|---------------|
| `electron-builder.yml:55-67` (mac block) | modified | build-config (declarative YAML) | configuration / batch | (self — `mac.target[0]` lines 58-60 — the existing `dmg` entry) | exact (sibling-array-entry) |
| `package.json:6` (version field) | modified | npm metadata | configuration | Plan 12.1-02 + Plan 13-03 (version-bump-only atomic commit) | exact (process-precedent) |
| `package.json:11-13` (build:* scripts) | modified | npm script orchestration | configuration | (self — `build:mac` line 17 — the line being edited; sibling `build:win` 18 + `build:linux` 19 receive the same hygiene edit) | role-match (no in-repo CLI-flag-drop precedent; cite electron-builder docs `electron.build/cli` per RESEARCH §A2) |
| `scripts/emit-latest-yml.mjs:42-46` (PLATFORM_MAP) | modified | post-build artifact synthesizer | batch / file-I/O | (self — `findInstaller()` 70-85 + `emitYaml()` 92-122 + `PLATFORM_MAP.win/linux` lines 52-53) | exact (self-precedent — win+linux paths are the load-bearing don't-touch invariant) |
| `.github/workflows/release.yml:73-80` (build-mac upload-artifact) | modified | CI workflow (declarative YAML) | event-driven / batch | (self — `release/*.dmg` line 77 — the existing single-glob entry; sibling `build-win` 94-101 + `build-linux` 115-122 stay unchanged) | exact (sibling-glob-entry) |
| `.github/workflows/release.yml:159-165` (publish files: list) | modified | CI workflow (declarative YAML) | event-driven / batch | (self — `assets/*.dmg` line 160 — the existing entry being extended) | exact (sibling-glob-entry) |
| `tests/integration/emit-latest-yml.spec.ts` | modified | vitest integration spec | unit / file-I/O | (self — existing single-installer mac test 84-139 + error-handling 141-153) | exact (self-precedent — same fixture-binary scaffold extended) |
| `tests/integration/build-scripts.spec.ts` | greenfield (planner discretion — D-04 inline-or-separate) | vitest integration spec | unit / file-I/O | `tests/integration/install-md.spec.ts` (URL-consistency-style file-existence + grep regression spec) | exact (sibling-pattern: `read()` helper + `expect(text).toContain(...)` + `.toMatch(/regex/)`) |
| `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-HUMAN-UAT.md` | greenfield | UAT runbook | docs | `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-HUMAN-UAT.md` (frontmatter + tests + summary + gaps shape) | exact (inherits 14's tests 5-6 + UPDFIX-01 happy path per D-10) |
| `.planning/phases/15-build-feed-shape-fix-v1-1-2-release/15-VERIFICATION.md` | greenfield | close-out doc | docs | `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-VERIFICATION.md` (frontmatter + Goal Achievement table + Required Artifacts + Key Link Verification + Behavioral Spot-Checks + Requirements Coverage + Anti-Patterns) | exact (verbatim shape) |

**Process-pattern analog (whole-of-Plan-15-04):** `.planning/milestones/v1.1-phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-05-PLAN.md` — see "Plan 15-04 process pattern" section below for the verbatim shape mirror.

---

## Pattern Assignments

### `electron-builder.yml:55-67` (mac block) — modified

**Analog:** SELF — append a sibling entry to `mac.target` array.

**Existing pattern** (`electron-builder.yml:56-64`):
```yaml
# DIST-02, DIST-04: macOS arm64 .dmg, ad-hoc signed.
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
  identity: '-'
  hardenedRuntime: false
  gatekeeperAssess: false
  artifactName: ${productName}-${version}-${arch}.${ext}
```

**Phase 15 edit (D-01 verbatim diff):**
```yaml
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
    - target: zip          # ← Phase 15 add
      arch: arm64           # ← Phase 15 add
  identity: '-'
  ...
```

**Do-not-misread:**
- The `artifactName: ${productName}-${version}-${arch}.${ext}` template at line 64 substitutes `${ext}` per target — no per-target override needed; the `.zip` filename will be `Spine Texture Manager-1.1.2-arm64.zip` (literal spaces) automatically.
- The `dmg:` block at lines 66-67 stays as-is (DMG-specific options); there is NO sibling `zip:` block — electron-builder's mac/zip target accepts no per-target options that v1.1.2 needs.
- `identity: '-'` ad-hoc signing applies to both `.app`-inside-`.dmg` and `.app`-inside-`.zip`. No additional code-signing config.
- The `extraResources: build/app-update.yml` at lines 20-22 is the 12.1-D-10 invariant — DO NOT TOUCH (12.1-D-10 lineage explicit in CONTEXT.md `<canonical_refs>`).

---

### `package.json:6` (version field) — modified

**Analog (process-pattern):** Plan 12.1-02 + Plan 13-03 — atomic version-bump-only commit per `npm version <X> --no-git-tag-version`.

**Pattern (verbatim from Plan 13-03 precedent):**
```bash
npm version 1.1.2 --no-git-tag-version
# Edits: package.json (version field) + package-lock.json (version + packages."" field)
# Stages nothing; user commits next.
git add package.json package-lock.json
git commit -m "chore(15): bump version 1.1.1 → 1.1.2"
```

**Existing state** (`package.json:3`):
```json
{
  "name": "spine-texture-manager",
  "version": "1.1.1",                    // ← Phase 15 changes to "1.1.2"
  "private": true,
  "type": "module",
```

**Do-not-misread:**
- The `--no-git-tag-version` flag is REQUIRED — without it, `npm version` auto-creates a local `v1.1.2` tag, which collides with Plan 15-04's deliberate user-confirmed annotated tag creation later. The 12.1-02 + 13-03 commits both used this flag.
- The bump touches TWO files (`package.json` + `package-lock.json` — note: `package-lock.json` is currently NOT in the repo per quick check; if `npm version` creates it, INCLUDE it; if it doesn't, just commit `package.json`).
- The CI tag-version-guard (`release.yml:43-54`) compares stripped-`v` tag form against `package.json` `version` exactly — bump must land BEFORE the v1.1.2 tag push or CI rejects the tag.

---

### `package.json:11-13` (build:* scripts) — modified

**Analog:** No direct in-repo precedent for dropping a CLI flag arg. Cite electron-builder docs `electron.build/cli` per RESEARCH §A2.

**Existing pattern** (`package.json:17-19`):
```json
"build:mac": "electron-vite build && electron-builder --mac dmg --publish never && node scripts/emit-latest-yml.mjs --platform=mac",
"build:win": "electron-vite build && electron-builder --win nsis --publish never && node scripts/emit-latest-yml.mjs --platform=win",
"build:linux": "electron-vite build && electron-builder --linux AppImage --publish never && node scripts/emit-latest-yml.mjs --platform=linux",
```

**Phase 15 edit (RESEARCH §A2 — mandatory for D-01 to actually take effect):**
```json
"build:mac": "electron-vite build && electron-builder --mac --publish never && node scripts/emit-latest-yml.mjs --platform=mac",
"build:win": "electron-vite build && electron-builder --win --publish never && node scripts/emit-latest-yml.mjs --platform=win",
"build:linux": "electron-vite build && electron-builder --linux --publish never && node scripts/emit-latest-yml.mjs --platform=linux",
```

**Do-not-misread (CRITICAL — RESEARCH §Risk #1, HIGH impact):**
- `electron-builder --mac dmg` IS NOT EQUIVALENT TO `electron-builder --mac` with `mac.target: [dmg, zip]` in YAML. The CLI arg overrides the YAML target list (verified at `node_modules/app-builder-lib/out/targets/targetFactory.js:11-17`). If the planner adds the `zip` target to YAML but FORGETS this script edit, the build silently produces only `.dmg` and the synthesizer's "no .zip found" fail-fast triggers — looking like a synth bug rather than a CLI flag bug.
- Bare `--mac` makes the YAML `mac.target` array the single source of truth. Future target additions (e.g., `mas` for App Store) need no script edit.
- Drop the win/linux flags too for consistency (no current-phase requirement; hygiene only — RESEARCH §A2 last paragraph).
- The trailing `-- --publish never` in `release.yml` lines 70/93/114 (CI invocation) is a benign no-op duplicate (the npm-script already has `--publish never`); RESEARCH §A2 last paragraph confirms — DO NOT TOUCH.

---

### `scripts/emit-latest-yml.mjs:42-46` (PLATFORM_MAP) — modified

**Analog:** SELF — extend mac entry from single-regex to dual-regex; preserve win+linux paths byte-identical.

**Existing PLATFORM_MAP** (`scripts/emit-latest-yml.mjs:48-54`):
```javascript
// Platform → (installer extension regex, output YAML filename) map.
// Locked from CONTEXT.md D-10 + electron-builder.yml mac/win/linux blocks.
const PLATFORM_MAP = {
  mac:   { extRegex: /\.dmg$/i,      outName: 'latest-mac.yml'   },
  win:   { extRegex: /\.exe$/i,      outName: 'latest.yml'       },
  linux: { extRegex: /\.AppImage$/i, outName: 'latest-linux.yml' },
};
```

**Existing single-installer pattern** (`scripts/emit-latest-yml.mjs:70-85` — `findInstaller()`):
```javascript
function findInstaller(extRegex) {
  if (!existsSync(RELEASE_DIR)) {
    console.error(`release/ does not exist; did electron-builder run? (cwd=${REPO_ROOT})`);
    process.exit(1);
  }
  const matches = readdirSync(RELEASE_DIR).filter((name) => extRegex.test(name));
  if (matches.length === 0) {
    console.error(`No installer matching ${extRegex} found in ${RELEASE_DIR}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple installers match ${extRegex} in ${RELEASE_DIR}: ${matches.join(', ')}. Pipeline must commit to one installer per platform.`);
    process.exit(1);
  }
  return matches[0];
}
```

**Existing emitYaml (single files[] entry)** (`scripts/emit-latest-yml.mjs:92-122`):
```javascript
function emitYaml(platform) {
  const { extRegex, outName } = PLATFORM_MAP[platform];
  const installerName = findInstaller(extRegex);
  const installerPath = join(RELEASE_DIR, installerName);

  const sha512 = computeSha512Base64(installerPath);
  const size = statSync(installerPath).size;

  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;

  const doc = {
    version,
    files: [
      { url: installerName, sha512, size },
    ],
    // Legacy top-level mirror — electron-updater@6.x reads files[] first
    // but falls back to top-level for backward compatibility. Emit both.
    path: installerName,
    sha512,
    releaseDate: new Date().toISOString(),
  };

  const yamlText = yaml.dump(doc, { lineWidth: -1 });
  const outPath = join(RELEASE_DIR, outName);
  const tmpPath = `${outPath}.tmp`;
  writeFileSync(tmpPath, yamlText, 'utf8');
  renameSync(tmpPath, outPath);
  ...
}
```

**Phase 15 extension (D-03 + RESEARCH §A1+A4 — recommended shape):**
```javascript
const PLATFORM_MAP = {
  mac:   { extRegexes: [/\.zip$/i, /\.dmg$/i], outName: 'latest-mac.yml'   },  // ← .zip first per D-02 ordering (cosmetic but semantically correct for legacy mirror)
  win:   { extRegex:    /\.exe$/i,             outName: 'latest.yml'       },  // ← UNCHANGED (single-installer)
  linux: { extRegex:    /\.AppImage$/i,        outName: 'latest-linux.yml' },  // ← UNCHANGED (single-installer)
};

// Phase 15 D-03 — rename single → multi; preserve fail-fast on missing/multiple-of-same-kind.
function findInstallers(extRegexes) {
  if (!existsSync(RELEASE_DIR)) { /* same error */ process.exit(1); }
  const allFiles = readdirSync(RELEASE_DIR);
  const found = [];
  for (const re of extRegexes) {
    const matches = allFiles.filter((name) => re.test(name));
    if (matches.length === 0) {
      console.error(`No installer matching ${re} found in ${RELEASE_DIR}`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`Multiple installers match ${re} in ${RELEASE_DIR}: ${matches.join(', ')}. Pipeline must commit to one installer per kind per platform.`);
      process.exit(1);
    }
    found.push(matches[0]);
  }
  return found;  // 1 entry for win/linux, 2 entries for mac (.zip first).
}

// Phase 15 D-02 — files[] gains N entries; legacy top-level mirrors files[0].
function emitYaml(platform) {
  const cfg = PLATFORM_MAP[platform];
  const extRegexes = cfg.extRegexes ?? [cfg.extRegex];   // mac → array; win/linux → wrapped single
  const installerNames = findInstallers(extRegexes);
  const files = installerNames.map((name) => {
    const p = join(RELEASE_DIR, name);
    return { url: name, sha512: computeSha512Base64(p), size: statSync(p).size };
  });
  ...
  const doc = {
    version,
    files,                              // N entries (1 for win/linux; 2 for mac)
    path:   files[0].url,               // legacy top-level mirror = files[0]
    sha512: files[0].sha512,            // legacy top-level mirror = files[0]
    releaseDate: new Date().toISOString(),
  };
  ...
}
```

**Do-not-misread:**
- **The win+linux paths are LOAD-BEARING UNCHANGED.** D-03 explicitly says "win + linux paths' existing tests unchanged"; the synthesizer's behavior on those platforms must be byte-identical to v1.1.1 (CI on those legs is producing exactly the same `latest.yml` / `latest-linux.yml`). The `extRegex` vs `extRegexes` field-name divergence is INTENTIONAL — preserves backward read-shape for the planner's mental model. Acceptable alternative: unify both to `extRegexes` array of length 1; the test surface validates either.
- **Files[] ordering is `.zip` first (D-02).** RESEARCH §A1 confirms MacUpdater 6.8.3 selects download by extension regex (`findFile(files, "zip", ["pkg", "dmg"])`), NOT array index — ordering is COSMETIC for download selection. BUT it IS load-bearing for the legacy top-level `path` / `sha512` mirror — D-02 makes those reference `files[0]` (the .zip), which is what an electron-updater <6 client would download. `.zip` first is correct.
- **`.zip.blockmap` is produced unconditionally by electron-builder 26.x mac/zip target** (RESEARCH §A3). The existing regex `/\.zip$/i` is end-anchored and naturally excludes `*.zip.blockmap` — no synthesizer code change needed for this. The CI glob `release/*.zip` (D-05) is also end-anchored and naturally excludes it.
- **Atomic-write contract preserved.** The existing `.tmp + fs.renameSync` Pattern-B at lines 117-119 stays — DO NOT change to direct `writeFileSync(outPath, ...)`.
- **Test seam env var (`EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` line 43) stays.** RESEARCH §Risk #5 — never set this in production CI.
- **Header comment block (lines 1-37) MUST be updated** to reference D-03 dual-installer mac case (Plan 15-02 Commit 3 `docs(15)` per RESEARCH §Plan 15-02).

---

### `.github/workflows/release.yml:73-80` (build-mac upload-artifact path) — modified

**Analog:** SELF — append a sibling glob line to the existing 2-line `path:` block.

**Existing pattern** (`.github/workflows/release.yml:73-80`):
```yaml
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2
        with:
          name: installer-mac
          path: |
            release/*.dmg
            release/latest-mac.yml
          if-no-files-found: error
          retention-days: 14
```

**Phase 15 edit (D-05 verbatim):**
```yaml
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: installer-mac
          path: |
            release/*.dmg
            release/*.zip          # ← Phase 15 add
            release/latest-mac.yml
          if-no-files-found: error
          retention-days: 14
```

**Sibling unchanged platforms** (verify they stay byte-identical):
- `build-win` job (`release.yml:94-101`) — `release/*.exe` + `release/latest.yml`. UNCHANGED.
- `build-linux` job (`release.yml:115-122`) — `release/*.AppImage` + `release/latest-linux.yml`. UNCHANGED.

**Do-not-misread:**
- **Explicit lines, NOT broadened glob.** D-05 explicitly rejects `release/*.{dmg,zip}` — glob expansion behavior varies by runner shell; explicit lines are deterministic for supply-chain hygiene.
- **`release/*.zip` is end-anchored** (no trailing `*`). RESEARCH §Risk #2 (MEDIUM impact): if the planner OR a future maintainer broadens to `release/*.zip*`, the `.zip.blockmap` will be uploaded as an 8th asset, breaking D-05's locked count of 7.
- **`if-no-files-found: error` preserved.** Adding `release/*.zip` means the job MUST produce a `.zip`, otherwise it fails fast — correct behavior; missing `.zip` would mean MacUpdater can't auto-update.
- **Action SHA pin `ea165f8d...` (v4.6.2) preserved.** Phase 11 D-22 supply-chain hygiene; do NOT bump.

---

### `.github/workflows/release.yml:159-165` (publish job files: list) — modified

**Analog:** SELF — append a sibling glob line to the existing 6-line `files:` block.

**Existing pattern** (`.github/workflows/release.yml:151-165`):
```yaml
      - name: Create draft GitHub Release
        uses: softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  # v2.6.2
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
            assets/latest.yml
            assets/latest-mac.yml
            assets/latest-linux.yml
```

**Phase 15 edit (D-05 verbatim):**
```yaml
          files: |
            assets/*.dmg
            assets/*.zip               # ← Phase 15 add
            assets/*.exe
            assets/*.AppImage
            assets/latest.yml
            assets/latest-mac.yml
            assets/latest-linux.yml
```

**Do-not-misread:**
- **Asset count flips 6 → 7.** D-05 explicitly locks 7 (`.dmg` + `.zip` + `latest-mac.yml` + `.exe` + `latest.yml` + `.AppImage` + `latest-linux.yml`). NOT 6 or 8. Plan 15-04's CHECKPOINT 3 verification asserts `gh release view v1.1.2 --json assets --jq '.assets | length'` returns exactly `7`.
- **`fail_on_unmatched_files: true` (line 158) preserved.** Means if the build-mac upload-artifact didn't produce a `.zip`, the publish step fails fast — correct; this is the second of two fail-fast gates (build-mac's `if-no-files-found: error` is the first).
- **softprops SHA pin `3bb12739...` (v2.6.2) preserved.** Phase 11 D-22; do NOT bump.
- **The publish job's `if:` gate at line 127** (`github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')`) ensures `workflow_dispatch` dry runs (D-07 gate 2) DO NOT publish. Read-only verify — DO NOT TOUCH.

---

### `tests/integration/emit-latest-yml.spec.ts` — modified (extend in place)

**Analog:** SELF — extend with new dual-installer test case + tighten existing single-mac test per D-04.

**Existing fixture-binary scaffold** (`tests/integration/emit-latest-yml.spec.ts:44-76`):
```typescript
beforeAll(() => {
  // Build a self-contained temp project: temp/release/<fixture>.dmg + temp/package.json.
  tempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-'));
  const releaseDir = join(tempDir, 'release');
  mkdirSync(releaseDir, { recursive: true });

  // 4KB of random bytes — well above the 1KB minimum specified in CONTEXT.md
  // D-10. SHA-512 is computed deterministically from the buffer.
  const fixtureBuf = randomBytes(4096);
  fixtureInstallerPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg');
  writeFileSync(fixtureInstallerPath, fixtureBuf);
  fixtureInstallerSize = statSync(fixtureInstallerPath).size;
  fixtureInstallerSha512 = createHash('sha512').update(fixtureBuf).digest('base64');

  writeFileSync(
    join(tempDir, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
    'utf8',
  );

  outputYamlPath = join(releaseDir, 'latest-mac.yml');

  execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
    env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: tempDir },
    stdio: 'pipe',
  });
});
```

**Existing single-mac assertions** (`tests/integration/emit-latest-yml.spec.ts:100-130`) — used as template for dual-installer assertions:
```typescript
test('files[] is a non-empty array with the .dmg installer entry', () => {
  const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
  expect(Array.isArray(doc.files)).toBe(true);
  const files = doc.files as Array<Record<string, unknown>>;
  expect(files.length).toBeGreaterThanOrEqual(1);
  expect(files[0].url).toBe('Spine Texture Manager-9.9.9-arm64.dmg');
});

test('files[0].sha512 matches the fixture installer hash exactly (base64)', () => {
  const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
  const files = doc.files as Array<Record<string, unknown>>;
  expect(files[0].sha512).toBe(fixtureInstallerSha512);
  expect(files[0].sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
});

test('legacy top-level path mirrors files[0].url (electron-updater <6 backward compat)', () => {
  const doc = yaml.load(readFileSync(outputYamlPath, 'utf8')) as Record<string, unknown>;
  expect(doc.path).toBe('Spine Texture Manager-9.9.9-arm64.dmg');
});
```

**Phase 15 dual-installer test (RESEARCH §A4 verbatim assertions — picks .zip first):**
```typescript
describe('emit-latest-yml.mjs (Phase 15 D-04) — dual-installer mac case', () => {
  let dualTempDir: string;
  let dualOutputYamlPath: string;
  let dualZipSha512: string;
  let dualDmgSha512: string;
  let dualZipSize: number;
  let dualDmgSize: number;

  beforeAll(() => {
    dualTempDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-dual-'));
    const releaseDir = join(dualTempDir, 'release');
    mkdirSync(releaseDir, { recursive: true });

    // Two independent random buffers — distinct sha512 confirms files[0] vs files[1] don't collapse.
    const dmgBuf = randomBytes(4096);
    const zipBuf = randomBytes(4096);
    const dmgPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg');
    const zipPath = join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.zip');
    writeFileSync(dmgPath, dmgBuf);
    writeFileSync(zipPath, zipBuf);
    dualDmgSha512 = createHash('sha512').update(dmgBuf).digest('base64');
    dualZipSha512 = createHash('sha512').update(zipBuf).digest('base64');
    dualDmgSize = statSync(dmgPath).size;
    dualZipSize = statSync(zipPath).size;

    writeFileSync(
      join(dualTempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '9.9.9-test' }, null, 2),
      'utf8',
    );

    dualOutputYamlPath = join(releaseDir, 'latest-mac.yml');

    execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
      env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: dualTempDir },
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    if (dualTempDir && existsSync(dualTempDir)) rmSync(dualTempDir, { recursive: true, force: true });
  });

  test('files[] has 2 entries with .zip first', () => {
    const doc = yaml.load(readFileSync(dualOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files.length).toBe(2);
    expect(files[0].url).toBe('Spine Texture Manager-9.9.9-arm64.zip');
    expect(files[1].url).toBe('Spine Texture Manager-9.9.9-arm64.dmg');
  });

  test('legacy top-level path + sha512 mirror files[0] (the .zip)', () => {
    const doc = yaml.load(readFileSync(dualOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(doc.path).toBe(files[0].url);
    expect(doc.sha512).toBe(files[0].sha512);
    expect(doc.path).toBe('Spine Texture Manager-9.9.9-arm64.zip');
  });

  test('both files[] entries have valid base64 sha512 + correct size', () => {
    const doc = yaml.load(readFileSync(dualOutputYamlPath, 'utf8')) as Record<string, unknown>;
    const files = doc.files as Array<Record<string, unknown>>;
    expect(files[0].sha512).toBe(dualZipSha512);
    expect(files[1].sha512).toBe(dualDmgSha512);
    expect(files[0].sha512).not.toBe(files[1].sha512);
    expect(files[0].sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
    expect(files[1].sha512).toMatch(/^[A-Za-z0-9+/=]{64,}$/);
    expect(files[0].size).toBe(dualZipSize);
    expect(files[1].size).toBe(dualDmgSize);
  });
});
```

**Existing test to TIGHTEN per D-04** (the existing single-mac test at lines 84-139 stays, but add a sibling describe block asserting the synthesizer fail-fast on `.dmg`-only after Phase 15 D-03 is in place):
```typescript
describe('emit-latest-yml.mjs (Phase 15 D-04) — fail-fast when .zip missing on mac', () => {
  test('exits non-zero when release/ has only .dmg and no .zip', () => {
    const onlyDmgDir = mkdtempSync(join(tmpdir(), 'emit-latest-yml-onlydmg-'));
    const releaseDir = join(onlyDmgDir, 'release');
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(join(releaseDir, 'Spine Texture Manager-9.9.9-arm64.dmg'), randomBytes(4096));
    writeFileSync(join(onlyDmgDir, 'package.json'), JSON.stringify({ name: 'f', version: '9.9.9' }), 'utf8');
    expect(() => {
      execFileSync('node', [SCRIPT_PATH, '--platform=mac'], {
        env: { ...process.env, EMIT_LATEST_YML_REPO_ROOT_OVERRIDE: onlyDmgDir },
        stdio: 'pipe',
      });
    }).toThrow();
    rmSync(onlyDmgDir, { recursive: true, force: true });
  });
});
```

**Do-not-misread:**
- **Existing single-mac test stays — `files.length).toBeGreaterThanOrEqual(1)`** (line 104) is intentionally loose; the new dual-installer describe block asserts strict `=== 2`.
- **Existing error-handling tests at lines 141-153** (missing `--platform`, unknown platform) stay UNCHANGED.
- **Independent random buffers for `.dmg` and `.zip`** (the code above uses two separate `randomBytes(4096)` calls) — confirms the assertion `files[0].sha512 !== files[1].sha512` distinguishes the two files. RESEARCH §A4 names this explicitly.
- **The fixture filenames have literal spaces** (`'Spine Texture Manager-9.9.9-arm64.zip'`) — confirms RESEARCH §A4's URL-encoding contract: synthesizer preserves spaces raw; URL-encoding (`%20`) happens at the HTTP fetch layer. Don't strip the spaces.
- **`afterAll` cleanup** for the new dual-installer dir mirrors the existing `afterAll` at lines 78-82.
- **Spec file is already 153 lines.** Adding 2 describe blocks (~70 lines) keeps it under 250 lines — well within readable scope.

---

### `tests/integration/build-scripts.spec.ts` — greenfield (planner discretion)

**Analog:** `tests/integration/install-md.spec.ts` (URL-consistency-style file-existence + grep regression spec).

**Pattern: helper + describe blocks + `expect(text).toContain` / `expect(text).toMatch`** (`tests/integration/install-md.spec.ts:37-46`):
```typescript
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..');
const INSTALL_MD_URL_LITERAL = 'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md';

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}
```

**Pattern: file-existence + content-shape assertions** (`tests/integration/install-md.spec.ts:48-84`):
```typescript
describe('REL-03: INSTALL.md cookbook surface', () => {
  test('INSTALL.md exists at repo root', () => {
    expect(existsSync(resolve(REPO_ROOT, 'INSTALL.md'))).toBe(true);
  });

  test('INSTALL.md has macOS / Windows / Linux sections', () => {
    const text = read('INSTALL.md');
    expect(text).toMatch(/^##\s+macOS/m);
    expect(text).toMatch(/^##\s+Windows/m);
    expect(text).toMatch(/^##\s+Linux/m);
  });
  ...
});
```

**Phase 15 spec recommended shape** (per VALIDATION.md §"Per-Task Verification Map" + RESEARCH §"Phase Requirements → Test Map"):
```typescript
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const REPO_ROOT = resolve(__dirname, '../..');
function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8');
}

describe('Phase 15 build config (D-01 + RESEARCH A2)', () => {
  test('package.json version is 1.1.2', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.version).toBe('1.1.2');
  });

  test('package.json build:mac script is bare --mac (NOT --mac dmg)', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:mac']).not.toMatch(/--mac\s+dmg/);
    expect(pkg.scripts['build:mac']).toMatch(/electron-builder\s+--mac\s+--publish/);
  });

  test('electron-builder.yml mac.target has both dmg AND zip with arch arm64', () => {
    const cfg = yaml.load(read('electron-builder.yml')) as { mac: { target: Array<{ target: string; arch: string }> } };
    const targets = cfg.mac.target.map((t) => t.target);
    expect(targets).toContain('dmg');
    expect(targets).toContain('zip');
    for (const t of cfg.mac.target) {
      expect(t.arch).toBe('arm64');
    }
  });

  test('release.yml build-mac upload-artifact path includes release/*.zip', () => {
    const text = read('.github/workflows/release.yml');
    expect(text).toMatch(/path:\s*\|[\s\S]*?release\/\*\.zip[\s\S]*?release\/latest-mac\.yml/);
  });

  test('release.yml publish job files: includes assets/*.zip', () => {
    const text = read('.github/workflows/release.yml');
    expect(text).toMatch(/files:\s*\|[\s\S]*?assets\/\*\.zip/);
  });

  test('release.yml publish files: glob is end-anchored (no .zip*)', () => {
    // Risk #2 mitigation: assets/*.zip MUST NOT be assets/*.zip* (would upload .zip.blockmap).
    const text = read('.github/workflows/release.yml');
    expect(text).not.toMatch(/assets\/\*\.zip\*/);
    expect(text).not.toMatch(/release\/\*\.zip\*/);
  });
});
```

**Do-not-misread:**
- **Greenfield — planner discretion to inline into existing spec OR create new file.** RESEARCH §"Wave 0 Gaps" line 382 + VALIDATION.md `## Wave 0 Requirements` line 67-72 both note this. Recommended: separate file for reviewability (the assertions are about build-config invariants, not about the synthesizer's emit-latest-yml shape).
- **Use `js-yaml.load` with type assertion**, NOT raw regex on YAML text — `yaml.load` confirms YAML is parseable AND structured correctly. The `tests/integration/emit-latest-yml.spec.ts` precedent at line 33 imports `js-yaml` already.
- **The "end-anchored glob" assertion (Risk #2 mitigation)** is the load-bearing one. If a future maintainer accidentally broadens `release/*.zip` → `release/*.zip*`, this test fails immediately.
- **Test file name + location follow project precedent**: `tests/integration/<surface>.spec.ts` lowercase-hyphenated. Matches `emit-latest-yml.spec.ts` + `install-md.spec.ts` + `auto-update-shell-allow-list.spec.ts`.

---

### `15-HUMAN-UAT.md` — greenfield

**Analog:** `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-HUMAN-UAT.md`.

**Frontmatter pattern (verbatim from 14-HUMAN-UAT.md:1-21):**
```yaml
---
status: pending
phase: 14-auto-update-reliability-fixes-renderer-state-machine
source: [14-VERIFICATION.md]
started: 2026-04-29T12:11:00Z
updated: 2026-04-29T13:30:00Z
deferred_to: phase-15-build-feed-shape-fix-v1.1.2-release
deferral_reason: |
  Phase 14 is code-only by ROADMAP contract. ...
---
```

**Phase 15 frontmatter (per VALIDATION.md §"Wave 0 Requirements" lines 73-80):**
```yaml
---
phase: 15-build-feed-shape-fix-v1-1-2-release
source: [15-VERIFICATION.md]
inherits: 14-HUMAN-UAT.md
status: pending
started: <timestamp>
---
```

**Tests structure pattern (verbatim from 14-HUMAN-UAT.md:27-51):**
```markdown
## Tests

### 1. macOS cold-start auto-check (UPDFIX-03 / ROADMAP SC-3 mac branch)
expected: Within ~3-5s of `app.whenReady()` completing on a fresh dock-launch of a packaged build, DevTools console emits `[auto-update] startup-check: setTimeout fired` followed by `[auto-update] checkUpdate: trigger=startup, version=1.1.1` and `[auto-update] event: update-available, version=...` (or update-not-available). When a newer published version exists, UpdateDialog auto-mounts; when not, no dialog (silent per UPD-05).
result: [pending]

### 2. ...
```

**Summary block pattern (verbatim from 14-HUMAN-UAT.md:53-60):**
```markdown
## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0
```

**Phase 15 content split (D-10):**
- **Pre-tag section** (Tests 1-4 from 14-HUMAN-UAT.md, executed against locally-built v1.1.2 packaged + published v1.1.1 feed; NO updates available):
  - Test 1: macOS cold-start auto-check (verifies silent-swallow + cold-start IPC fires)
  - Test 2: Windows cold-start auto-check (same; windows-fallback variant routing)
  - Test 3: macOS Help → Check from idle (verifies manual-check pre-load IPC)
  - Test 4: Windows Help → Check from idle (same; windows-fallback variant)
- **Post-publish section** (Tests 5-6 from 14-HUMAN-UAT.md + UPDFIX-01 happy path, executed against installed v1.1.1 packaged + published v1.1.2 feed):
  - Test 5: Windows manual re-check after Later dismissal (UPDFIX-02 asymmetric rule)
  - Test 6: Windows UpdateDialog Open Release Page button visibility (UPDFIX-02 windows-fallback variant)
  - Test 7: UPDFIX-01 mac happy path — installed v1.1.1 mac client downloads + relaunches into v1.1.2 with NO `ZIP file not provided` error (RESEARCH §"Live UPDFIX-01 verification" lines 211-225)

**Log-line evidence format (verbatim from VALIDATION.md §"Live UPDFIX-01 (Manual, Post-Publish)" lines 215-225):**
```
1. On macOS dev box: install v1.1.1 from existing GH Release (via .dmg drag-to-Applications).
2. Launch installed v1.1.1; wait 3.5s for startup-check.
3. Open DevTools console; observe:
   - `[auto-update] startup-check: setTimeout fired`
   - `[auto-update] checkUpdate: trigger=startup, version=1.1.1`
   - `[auto-update] event: update-available, version=1.1.2`
4. UpdateDialog opens; click "Download & Restart".
5. Observe DevTools: NO line containing `ERR_UPDATER_ZIP_FILE_NOT_FOUND`.
6. App relaunches; Help → About reports `1.1.2`.
7. Capture transcript verbatim into 15-HUMAN-UAT.md `<post-publish>` section.
```

**Do-not-misread:**
- **`inherits: 14-HUMAN-UAT.md` frontmatter field is novel** — 14's frontmatter has `deferred_to: phase-15-...`, signalling forward; 15's `inherits: 14-HUMAN-UAT.md` signals back-link. The pair forms the ride-forward contract per CONTEXT.md §specifics line 235.
- **Sequoia Gatekeeper "Open Anyway" prompt is EXPECTED on UPDFIX-01 happy path** — per RESEARCH §A5 + §Risk #3, the relaunched ad-hoc-signed `.app` may re-trigger Gatekeeper. UAT script must say "EXPECTED: after relaunch, Gatekeeper may show 'Open Anyway' — this is normal for ad-hoc-signed builds. Right-click → Open." (RESEARCH §Risk #3 verbatim).
- **`status: signed-off` is the close-out flip** — Plan 15-04 Task 9 doc-flip commits this transition (per RESEARCH §Plan 15-04 Task 9 + 14-HUMAN-UAT.md frontmatter precedent).

---

### `15-VERIFICATION.md` — greenfield

**Analog:** `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-VERIFICATION.md`.

**Frontmatter pattern (verbatim shape from 14-VERIFICATION.md:1-39):**
```yaml
---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
verified: 2026-04-29T12:10:00Z
status: human_needed                       # or: passed, passed_partial, failed
score: 5/5 code-level truths verified; 5/5 ROADMAP success criteria require live OS testing
overrides_applied: 0
gaps:
  - truth: "..."
    status: failed                         # or: passed, partial, deferred
    reason: "..."
    artifacts:
      - path: "src/main/auto-update.ts:111-115"
        issue: "..."
human_verification:
  - test: "..."
    expected: "..."
    why_human: "..."
---
```

**Goal Achievement table pattern (14-VERIFICATION.md:50-61):**
```markdown
## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (ROADMAP SC) | Status | Evidence |
| --- | ------------------ | ------ | -------- |
| 1   | ... | ✓ VERIFIED / ⚠️ NEEDS HUMAN / ✗ FAILED | <file>:<line> ... |
```

**Required Artifacts table pattern (14-VERIFICATION.md:63-77):**
```markdown
### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `electron-builder.yml` | mac.target has 2 entries (dmg + zip with arch arm64) | ✓ VERIFIED | yaml.load parses; both entries present |
```

**Key Link Verification table pattern (14-VERIFICATION.md:79-94):**
```markdown
### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `electron-builder --mac` (bare flag) | `mac.target: [dmg, zip]` from YAML | npm script `build:mac` | ✓ WIRED | package.json:17 |
```

**Behavioral Spot-Checks pattern (14-VERIFICATION.md:103-117):**
```markdown
### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 15 spec suite | `npx vitest run tests/integration/emit-latest-yml.spec.ts tests/integration/build-scripts.spec.ts` | <count> tests passed | ✓ PASS |
| 7-asset Release | `gh release view v1.1.2 --json assets --jq '.assets \| length'` | 7 | ✓ PASS |
| `.zip` filename URL-encoding | `gh release view v1.1.2 --json assets --jq '.assets[].name'` | spaces preserved on disk | ✓ PASS |
```

**Requirements Coverage table pattern (14-VERIFICATION.md:118-126):**
```markdown
### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| UPDFIX-01 | 15-01..15-04 | macOS .zip auto-update fix | ✓ SATISFIED (code) / ✓ SATISFIED (live UAT) | ... |
```

**Do-not-misread:**
- **`status: passed` vs `passed_partial` vs `failed`.** RESEARCH §Plan 15-04 Task 9 describes 13-VERIFICATION.md frontmatter `passed_partial → passed` flip on close-out; if any UAT carries forward (e.g., Linux opportunistic — see CONTEXT.md `<deferred>` line 249), `passed_partial` is correct.
- **Score format mirrors 13-VERIFICATION.md / 14-VERIFICATION.md** — "X/Y truths code-wired; Z/Y require live OS UAT" or similar narrative + numerator/denominator.
- **The Anti-Patterns Found table is OPTIONAL** — only populate if Phase 15 introduces any. v1.1.1 had 4 entries (auto-update.ts:131 lastCheckTrigger reset, etc.); Phase 15's surface is purely build-config + synth + docs, so likely 0-1 entries.
- **The `## Human Verification Required` block at the bottom (14-VERIFICATION.md:138-176)** lists the 6 deferred packaged-build UAT items. For Phase 15, this block becomes the cross-reference to `15-HUMAN-UAT.md` rather than re-listing tests.

---

## Process Pattern: Plan 15-04 Release Engineering

**Analog:** `.planning/milestones/v1.1-phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-05-PLAN.md` (verbatim shape mirror per CONTEXT.md D-08).

### Frontmatter shape (`13-05-PLAN.md:1-70`)

```yaml
---
phase: 15-build-feed-shape-fix-v1-1-2-release   # ← Phase 15 swap
plan: 04                                          # ← Plan slot
type: execute
wave: 2                                           # ← Wave 2 (after Wave 1 build/synth/CI prep merges)
depends_on:
  - 15-01
  - 15-02
  - 15-03
files_modified: []                                # ← release-engineering = no source edits
autonomous: false                                 # ← BLOCKING checkpoints — non-negotiable per D-08
requirements:
  - UPDFIX-01
tags:
  - release-engineering
  - tag-push
  - github-release
  - ci

user_setup:
  - service: github
    why: "Tag push to origin triggers .github/workflows/release.yml; GitHub Release publish step uploads 7 build artifacts (4 installers + 3 latest*.yml feed files)"
    env_vars:
      - name: (none — uses ambient git push auth via SSH/HTTPS already configured)
        source: "User's git auth is already set up; no new secrets required"
    dashboard_config:
      - task: "Verify the draft v1.1.2 GitHub Release after CI completes; manually flip via `gh release edit v1.1.2 --draft=false` after verifying body"
        location: "https://github.com/Dzazaleo/Spine_Texture_Manager/releases (after CI run completes)"

must_haves:
  truths:
    - "Tag `v1.1.2` exists locally AND on origin"
    - "GitHub Actions CI workflow `release.yml` triggered by the tag push fires and completes successfully"
    - "Draft GitHub Release `v1.1.2` exists with exactly 7 attached assets (.dmg + .zip + .exe + .AppImage + 3× latest*.yml)"
    - "Draft Release body follows the 4-section release-template per REL-02 contract"
    - "Release body INCLUDES the stranded-rc-tester callout per CONTEXT D-09 (verbatim Phase 13 D-04)"
    - "Release published (non-draft, non-prerelease) after user verification"
    - "After publication: 15-VERIFICATION.md authored; STATE.md `## Current phase` flipped to closed; ROADMAP.md Phase 15 plan list 4/4; Milestones v1.1.2 patch ✅"
  artifacts: ...
  key_links: ...
---
```

### 9-Task Skeleton (verbatim shape from 13-05-PLAN.md:193-877)

| Task | Type | Phase 15 Adaptation |
|------|------|---------------------|
| Task 1 | `checkpoint:human-verify` BLOCKING | Pre-flight verify (D-07 gate 1 + D-07 gate 2 both green; user confirms "ready to tag v1.1.2") |
| Task 2 | `auto` | Pre-tag UAT execution per D-10 split — Tests 1-4 from 14-HUMAN-UAT.md against locally-built v1.1.2 + published v1.1.1 feed; append transcripts to 15-HUMAN-UAT.md (RESEARCH §Plan 15-04 Task 3) |
| Task 3 | `auto` | Create local annotated tag `git tag -a v1.1.2 <bump-commit-sha> -m "v1.1.2 — macOS .zip auto-update fix"` (default to HEAD~N pointing at chore(15) version-bump per 12.1-02 / 13-03 precedent) |
| Task 4 | `checkpoint:human-verify` BLOCKING | Pre-push final confirmation — user verifies SHA via `git log --oneline v1.1.2 -1`; types "push" |
| Task 5 | `auto` | `git push origin v1.1.2`; watch CI via `gh run watch --exit-status <run-id>`; verify 7-asset count + clean publish-job log |
| Task 6 | `auto` | Author release-notes body via `gh release edit v1.1.2 --notes-file <body.md>` — verbatim Phase 13 D-04 stranded-rc callout in `## Known issues` (D-09); cross-link to CLAUDE.md `## Release tag conventions` |
| Task 7 | `checkpoint:human-verify` BLOCKING | Pre-publish final verification — user inspects 7-asset count, 3 × `latest*.yml` shape, release-notes body; types "publish" |
| Task 8 | `auto` | `gh release edit v1.1.2 --draft=false`; verify `isDraft: false`, `isPrerelease: false`; capture publication evidence |
| Task 8b (post-publish UAT) | `auto` | Tests 5-6 from 14-HUMAN-UAT.md + UPDFIX-01 happy path; append transcripts to 15-HUMAN-UAT.md (RESEARCH §Plan 15-04 Task 8) |
| Task 9 | `auto` | Doc-flip atomic commit — `15-VERIFICATION.md` greenfield, `STATE.md`, `ROADMAP.md`, `14-HUMAN-UAT.md` frontmatter `status: signed-off`, `15-HUMAN-UAT.md` frontmatter `status: signed-off` (mirror 13-05 Task 9 verbatim) |

### Pre-Flight Check Pattern (`13-05-PLAN.md:147-186` `<mandatory_pre_flight_check>` block)

```bash
# Plans 15-01..15-03 must all be landed:
git log --oneline -5

# Version field is 1.1.2:
node -p 'require("./package.json").version'

# Working tree is clean:
git status --short

# All vitest tests pass:
npm run test

# Typecheck clean:
npm run typecheck

# Tag does not already exist locally:
git tag --list | grep -x "v1.1.2"

# Tag does not already exist on origin:
git ls-remote --tags origin | grep "refs/tags/v1.1.2$"
```

**Do-not-misread:**
- **3 BLOCKING checkpoints, NOT 2 or 4.** D-08 explicitly locks 3 (pre-flight verify, pre-push final confirmation, pre-publish final verification). 13-05 used these exact 3.
- **autonomous: false is non-negotiable** per D-08. The orchestrator MUST stop at each `checkpoint:human-verify gate="blocking"` task and wait for the user's resume signal.
- **Scope-sanity note for >5 tasks:** 13-05 has a `## Scope-sanity note (intentional task count)` block at line 189 explaining why 9 tasks is correct; Plan 15-04 should mirror this rationale (3 of the tasks are checkpoints; 4 of the autonomous tasks are read-only verifications).
- **Heredoc commit message pattern** (`13-05-PLAN.md:795-836`) — Task 9 uses `<<EOF` (NOT `<<'EOF'`) so `${RUN_ID}` expands. Note carefully: the executor must verify the run-ID substitution before finalizing.
- **Threat model + verification + success_criteria + output blocks** at lines 882-937 — Plan 15-04 mirrors this 4-block tail verbatim.

---

## Shared Patterns

### Pattern: Atomic file writes (`.tmp + fs.renameSync`)

**Source:** `scripts/emit-latest-yml.mjs:117-119` (Pattern-B per CONTEXT.md `<code_context>` line 214).

**Apply to:** Synthesizer extension (Plan 15-02) — preserve verbatim; do NOT switch to direct `writeFileSync`.

```javascript
const tmpPath = `${outPath}.tmp`;
writeFileSync(tmpPath, yamlText, 'utf8');
renameSync(tmpPath, outPath);
```

### Pattern: Fail-fast in build-pipeline scripts

**Source:** `scripts/emit-latest-yml.mjs:71-83` (existing `findInstaller` exit-1 paths).

**Apply to:** D-03 dual-installer extension — preserve "exactly one of each kind, fail otherwise" semantics. Mac requires exactly-one `.dmg` AND exactly-one `.zip`; missing either fails fast.

### Pattern: CI artifact `if-no-files-found: error`

**Source:** `.github/workflows/release.yml:79, 100, 121` (3 build jobs all use this).

**Apply to:** Plan 15-03 build-mac upload-artifact extension — preserve. Adding `release/*.zip` means missing `.zip` fails fast.

### Pattern: Annotated tag pointing at version-bump commit

**Source:** Plan 12.1-02 + Plan 13-03 + Plan 13-05 Task 2 (`13-05-PLAN.md:241-256`).

**Apply to:** Plan 15-04 Task 3.

```bash
TAG_TARGET_SHA=$(git rev-parse HEAD~N)   # the chore(15) version-bump commit
git tag -a v1.1.2 "$TAG_TARGET_SHA" -m "v1.1.2 — macOS .zip auto-update fix"
git for-each-ref refs/tags/v1.1.2 --format='%(objecttype)'   # expect: tag (annotated)
```

**Do-not-misread:** `git tag v1.1.2` (lightweight) is NOT acceptable. The annotated form is locked by 12.1-02 / 13-05 precedent.

### Pattern: `gh run watch --exit-status <run-id>` for CI watch

**Source:** Plan 13-05 Task 5 (`13-05-PLAN.md:395-401`).

**Apply to:** Plan 15-04 Task 5 (tag-push CI run) AND Plan 15-04 Task 1 (D-07 gate 2 dry run).

### Pattern: Heredoc commit messages with Co-Authored-By

**Source:** Plan 13-05 Task 9 (`13-05-PLAN.md:795-836`).

**Apply to:** Plan 15-04 Task 9 doc-flip commit.

```bash
git commit -m "$(cat <<EOF
docs(15-04): flip 15-VERIFICATION.md / STATE.md / ROADMAP.md from publication-pending to published

v1.1.2 final published <date> with 7-asset atomicity validated by CI workflow run \${RUN_ID}.

Release URL: https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2

15-VERIFICATION.md: greenfield — frontmatter status: passed (or passed_partial if Linux UAT carries forward); ...
STATE.md: ## Current phase flipped to "Phase 15 CLOSED 4/4" + Release URL + CI run ID
ROADMAP.md: Plan 15-04 [x]; Progress table 4/4 Complete; Milestones ✅ v1.1.2 patch
14-HUMAN-UAT.md: frontmatter status: signed-off (closes the ride-forward contract)
15-HUMAN-UAT.md: frontmatter status: signed-off

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Pattern: `gh release view ... --json` for verification

**Source:** Plan 13-05 Task 5 + Task 8 (`13-05-PLAN.md:431-435, 619-629`).

**Apply to:** Plan 15-04 Task 5 (CI run) + Task 8 (publication evidence).

```bash
gh release view v1.1.2 --json isDraft,isPrerelease,publishedAt,assets,url --jq \
    '{ isDraft, isPrerelease, publishedAt, assetCount: (.assets | length), url }'
# expect:
#   { "isDraft": false, "isPrerelease": false, "publishedAt": "...", "assetCount": 7, "url": "..." }
```

### Pattern: Stranded-rc callout (D-09 verbatim from Phase 13 D-04)

**Source:** Phase 13 D-04 release notes (visible at `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.1` Known issues block).

**Apply to:** Plan 15-04 Task 6 — verbatim reuse:
```markdown
- **Stranded `v1.1.0-rcN` testers (rc1, rc2, or rc3):** the auto-updater couldn't reach you due to a naming bug fixed in this version. Please download `v1.1.2` manually from the assets list below — after upgrading, all future auto-updates work normally. (Root cause: `electron-updater@6.x` GitHub provider channel-matching treats `rc1` / `rc2` / `rc3` as opaque tokens because they lack a dot before the number. Fixed convention documented in `CLAUDE.md` `## Release tag conventions`.)
```

**Do-not-misread:** RESEARCH §Risk #6 — verify `git tag -l 'v1.1.0-rc*' | wc -l` returns exactly `3` (rc1, rc2, rc3) before publish; if more rcN tags exist, callout text needs extending.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json:11-13` build:* CLI flag drop | npm script | configuration | No in-repo precedent for "drop a CLI flag because YAML controls truth"; cite electron-builder docs `electron.build/cli` per RESEARCH §A2 |

(Only one entry — every other file has a strong in-tree analog.)

---

## Metadata

**Analog search scope:**
- `electron-builder.yml` (full)
- `package.json` (full)
- `scripts/emit-latest-yml.mjs` (full, 126 lines)
- `.github/workflows/release.yml` (full, 166 lines)
- `tests/integration/emit-latest-yml.spec.ts` (full, 153 lines)
- `tests/integration/install-md.spec.ts` (full, 235 lines)
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-HUMAN-UAT.md` (full, 101 lines)
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-VERIFICATION.md` (full, 222 lines)
- `.planning/milestones/v1.1-phases/13-v1-1-1-polish-phase-12-1-carry-forwards/13-05-PLAN.md` (full, 937 lines)
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-PATTERNS.md` (structural sample for output shape, ~80 lines)

**Files scanned:** 10
**Pattern extraction date:** 2026-04-29

**Cross-reference:**
- All file:line citations verified against actual repo state at extraction time (commit `907de91` "docs(15): capture phase context").
- All "do-not-misread" callouts trace back to a specific RESEARCH.md §Q-or-A or CONTEXT.md §decision lock.

## PATTERN MAPPING COMPLETE
