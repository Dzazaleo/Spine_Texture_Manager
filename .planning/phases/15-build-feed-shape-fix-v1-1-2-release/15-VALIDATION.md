---
phase: 15
slug: build-feed-shape-fix-v1-1-2-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `15-RESEARCH.md` §"Validation Architecture" (lines 334-435).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.x (493/493 passing post-Phase-14 close per `.planning/STATE.md`) |
| **Config file** | `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/vitest.config.ts` |
| **Quick run command** | `npm run test -- <relevant-spec-file>` |
| **Full suite command** | `npm run test` |
| **Typecheck command** | `npm run typecheck` (runs `typecheck:node` + `typecheck:web`) |
| **Estimated runtime** | ~5–8s vitest full suite; ~3s typecheck |

---

## Sampling Rate

- **After every task commit:** `npm run test -- <relevant-spec-file>` (~1–2s).
- **After every plan wave merge:** `npm run test` + `npm run typecheck` (~10s).
- **Phase gate (D-07 local pre-flight):** full local build + YAML field validation oneliners (see commands below).
- **Phase gate (D-07 CI dry run):** `gh workflow run release.yml --ref <feature-branch>` + artifact inspection.
- **Before `/gsd-verify-work 15`:** Full suite green + 7-asset live Release published + 15-HUMAN-UAT.md signed off.
- **Max feedback latency:** ~10s automated; ~10 min CI dry run.

---

## Per-Task Verification Map

Per-task assignment is finalized in PLAN.md files. Below is the requirement → behavior → automation map that each plan's tasks must collectively cover.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-* | 01 | 1 | UPDFIX-01 | — | electron-builder.yml `mac.target` contains both `dmg` AND `zip`; `package.json build:mac` is bare `--mac` (NOT `--mac dmg`); version 1.1.2 in package.json | smoke (yaml/json parse) | `node -e "const y=require('js-yaml').load(require('fs').readFileSync('electron-builder.yml','utf8')); const t=y.mac.target.map(x=>x.target); if(!t.includes('dmg')\|\|!t.includes('zip'))process.exit(1)"` + `node -p "require('./package.json').scripts['build:mac']" \| grep -v -E '\\-\\-mac\\s+dmg'` + `node -p "require('./package.json').version"` returns `1.1.2` | ❌ Wave 0 — new build-scripts spec | ⬜ pending |
| 15-02-* | 02 | 1 | UPDFIX-01 | — | Synthesizer auto-detects `.dmg`+`.zip` on `--platform=mac`; `latest-mac.yml` `files[]` has 2 entries, `.zip` first, valid base64 sha512, sizes match `fs.statSync`; legacy top-level `path`/`sha512` mirror `files[0]` (the `.zip`); fail-fast preserved on missing-of-either | unit | `npm run test -- tests/integration/emit-latest-yml.spec.ts` (extended per D-04) | ✅ extend existing | ⬜ pending |
| 15-03-* | 03 | 1 | UPDFIX-01 | — | `release.yml` build-mac upload-artifact path contains `release/*.zip` line; publish job files contains `assets/*.zip` line | smoke (yaml parse) | inline assertion in build-scripts spec OR `grep -E 'release/\\*\\.zip\|assets/\\*\\.zip' .github/workflows/release.yml \| wc -l` returns ≥ 2 | ❌ Wave 0 — new assertion | ⬜ pending |
| 15-04-T1 | 04 | 2 | UPDFIX-01 | — | D-07 gate 1 — local pre-flight produces both `release/*.dmg` and `release/*.zip`; valid `latest-mac.yml` with field-level matches | manual (gates the tag) | `rm -rf release/ && npm run build:mac` + 5 oneliners below | manual-only — runbook in 15-HUMAN-UAT.md | ⬜ pending |
| 15-04-T2 | 04 | 2 | UPDFIX-01 | — | D-07 gate 2 — CI workflow_dispatch dry run on feature branch produces 7-asset glob match (or `installer-mac` artifact has 3 files); publish job correctly skipped | manual (gates the tag) | `gh workflow run release.yml --ref <feature-branch>` + `gh run watch --exit-status <run-id>` + `gh run download <run-id> --name installer-mac` | manual-only — runbook in 15-HUMAN-UAT.md | ⬜ pending |
| 15-04-T3 | 04 | 2 | UPDFIX-03/04 (Phase-14 ride-forward) | — | Pre-tag UAT (Tests 1-4 from `14-HUMAN-UAT.md`) — mac/win cold-start auto-check + mac/win Help→Check from idle against locally-built v1.1.2 packaged + published v1.1.1 feed (NO updates available; verify silent-swallow + cold-start IPC + manual-check pre-load IPC) | manual / HUMAN-UAT | DevTools console evidence per Phase 14 D-09/D-10 log lines (`[auto-update] startup-check: setTimeout fired`, `[auto-update] checkUpdate: trigger=startup, version=1.1.2`, `[auto-update] event: update-not-available, version=...`) | manual-only — append to 15-HUMAN-UAT.md | ⬜ pending |
| 15-04-T7 | 04 | 2 | UPDFIX-01 (live, mac happy path) | — | Installed v1.1.1 mac client detects v1.1.2; clicks Download & Restart; relaunches into v1.1.2 with NO `ZIP file not provided` / `ERR_UPDATER_ZIP_FILE_NOT_FOUND` | manual / HUMAN-UAT | DevTools console: `[auto-update] event: update-available, version=1.1.2` + absence of `ERR_UPDATER_ZIP_FILE_NOT_FOUND` + Help→About reports `1.1.2` post-restart | manual-only — append to 15-HUMAN-UAT.md | ⬜ pending |
| 15-04-T7 | 04 | 2 | UPDFIX-02 (Phase-14 ride-forward) | — | Post-publish Tests 5-6 from `14-HUMAN-UAT.md` — Windows manual re-check after Later dismissal + Windows UpdateDialog `windows-fallback` Open Release Page button visibility | manual / HUMAN-UAT | DevTools console + screen-capture; Open Release Page click lands on `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` | manual-only — append to 15-HUMAN-UAT.md | ⬜ pending |
| 15-04-T7 | 04 | 2 | DIST-01..07 / CI-01..06 / REL-01..04 (regression) | — | Asset count locked at 7; `latest*.yml` shapes valid; release body has D-09 stranded-rc callout in Known issues; `isDraft: false`, `isPrerelease: false` on v1.1.2 | smoke + manual | `gh release view v1.1.2 --json assets --jq '.assets \| length'` returns `7` + manual inspection at D-08 checkpoint 3 | manual + automated | ⬜ pending |
| 15-04-Tlast | 04 | 2 | UPDFIX-01 (doc-flip) | — | `15-VERIFICATION.md` produced; `STATE.md` + `ROADMAP.md` + `14-HUMAN-UAT.md` + `15-HUMAN-UAT.md` reflect Phase 15 close-out | manual | `gsd-sdk query state.completed-phase --phase 15` + `git status` clean | existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per RESEARCH §"Wave 0 Gaps":

- [ ] **`tests/integration/emit-latest-yml.spec.ts`** — extend with dual-installer mac test case per D-04 (~6–8 new assertions). The TDD-RED commit lives in Plan 15-02.
- [ ] **`tests/integration/build-scripts.spec.ts`** (greenfield, optional — planner may inline into existing spec) — assertions:
  - `package.json` `build:mac` script is bare `electron-builder --mac` (NOT `electron-builder --mac dmg`).
  - `electron-builder.yml` `mac.target` has both `dmg` AND `zip` entries with `arch: arm64`.
  - `.github/workflows/release.yml` build-mac upload-artifact path includes `release/*.zip`.
  - `.github/workflows/release.yml` publish files: includes `assets/*.zip`.
  - `package.json` version field is `1.1.2`.
- [ ] **`15-HUMAN-UAT.md`** (greenfield) — runbook for UPDFIX-01 live verification (mac happy-path) + the 6 deferred Phase 14 packaged-build UAT items per D-10. Frontmatter:
  ```yaml
  phase: 15-build-feed-shape-fix-v1-1-2-release
  source: [15-VERIFICATION.md]
  inherits: 14-HUMAN-UAT.md
  status: pending
  started: <timestamp>
  ```
  Content split into "pre-tag" (tests 1-4 from `14-HUMAN-UAT.md`) and "post-publish" (tests 5-6 from `14-HUMAN-UAT.md` + UPDFIX-01 mac happy-path) sections per D-10.

*No new framework install — vitest already in place, 493/493 baseline.*

---

## Manual-Only Verifications

Live UAT items that require packaged installers + a real published feed. These cannot be automated in vitest because they exercise the macOS Squirrel.Mac swap mechanic and Windows shell external-URL launch — both of which are kernel/OS-level behaviors that integration tests cannot simulate.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS auto-update relaunch (UPDFIX-01 happy path) | UPDFIX-01 | Squirrel.Mac swap mechanic requires real macOS kernel + Gatekeeper interaction | Install published v1.1.1 → launch → wait 3.5s → DevTools shows `update-available, version=1.1.2` → click Download & Restart → DevTools has NO `ERR_UPDATER_ZIP_FILE_NOT_FOUND` → app relaunches → Help → About shows `1.1.2`. Append transcript to `15-HUMAN-UAT.md`. |
| Windows UpdateDialog `windows-fallback` Open Release Page (Phase-14 ride-forward Test 6) | UPDFIX-02 | Requires real packaged Win installer + the `shell.openExternal` allow-list path | Install packaged v1.1.1 win → launch → Help → Check for Updates → modal opens with "Open Release Page" variant (NOT Download button per D-13 SPIKE_PASSED=false) → click → browser opens `https://github.com/Dzazaleo/Spine_Texture_Manager/releases`. |
| Windows manual re-check after Later dismissal (Phase-14 ride-forward Test 5) | UPDFIX-02 | UpdateDialog dismissal-asymmetric-rule (Phase-14 D-05) needs full state-machine + IPC round-trip | Install v1.1.1 win → wait for v1.1.2 modal → click Later → Help → Check for Updates → modal re-opens (asymmetric rule: manual triggers bypass `dismissedUpdateVersion`). |
| Cold-start auto-check silent-swallow (Tests 1-2 from 14-HUMAN-UAT.md) | UPDFIX-03 | Phase-14 cold-start IPC fires only on packaged builds | Build v1.1.2 locally → install over previous v1.1.2 → launch → DevTools console shows `[auto-update] startup-check: setTimeout fired`, `[auto-update] checkUpdate: trigger=startup`, `[auto-update] event: update-not-available, version=...` (no UpdateDialog rendered). |
| Help → Check from idle silent-no-update (Tests 3-4 from 14-HUMAN-UAT.md) | UPDFIX-04 | Phase-14 manual-check pre-load IPC fires only on packaged builds | Install v1.1.2 over v1.1.2 → Help → Check for Updates → DevTools shows manual-trigger log + `update-not-available` (no UpdateDialog rendered). |
| Tag points at version-bump commit (D-08 checkpoint 2) | UPDFIX-01 | Annotated tag SHA assertion is a human read on `git log --oneline v1.1.2 -1` output | Display `git log --oneline v1.1.2 -1` to user; confirm SHA matches the `chore(15)` version-bump commit per Plan 13-05 / 12.1-02 precedent. |
| 7-asset Release inspection (D-08 checkpoint 3) | UPDFIX-01 | Release body wording (D-09 stranded-rc callout) and asset visual list both need a human-eye review | `gh release view v1.1.2 --json assets --jq '.assets[].name' \| sort` (automated count check) + open Release page in browser, verify Known issues block has verbatim Phase 13 D-04 callout cross-linked to CLAUDE.md `## Release tag conventions`. |

---

## Validation Commands (Embed in Plans)

Per RESEARCH §"Dimension-8 (Nyquist validation) shape recommendation". The planner MUST embed these in PLAN.md task `<verify>` blocks where applicable.

### D-07 Gate 1 — Local Pre-Flight Validation

```bash
# Clean build
rm -rf release/
npm run build:mac

# Both installers exist
test -f "release/Spine Texture Manager-1.1.2-arm64.dmg" || (echo "FAIL: missing .dmg"; exit 1)
test -f "release/Spine Texture Manager-1.1.2-arm64.zip" || (echo "FAIL: missing .zip"; exit 1)

# YAML parses with 2-entry files[]
node -e "
const y = require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8'));
if (y.files.length !== 2) { console.error('FAIL: files[] expected 2 entries, got', y.files.length); process.exit(1); }
if (!y.files[0].url.endsWith('.zip')) { console.error('FAIL: files[0] not .zip'); process.exit(1); }
if (!y.files[1].url.endsWith('.dmg')) { console.error('FAIL: files[1] not .dmg'); process.exit(1); }
if (y.path !== y.files[0].url) { console.error('FAIL: path mismatch'); process.exit(1); }
if (y.sha512 !== y.files[0].sha512) { console.error('FAIL: top-level sha512 mismatch'); process.exit(1); }
console.log('OK: latest-mac.yml shape valid');
"

# sha512 byte-for-byte match (zip)
EXPECTED_ZIP_SHA512=$(shasum -a 512 "release/Spine Texture Manager-1.1.2-arm64.zip" | awk '{print $1}' | xxd -r -p | base64)
ACTUAL_ZIP_SHA512=$(node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); console.log(y.files[0].sha512)")
[ "$EXPECTED_ZIP_SHA512" = "$ACTUAL_ZIP_SHA512" ] && echo "OK: zip sha512 match" || (echo "FAIL: zip sha512 mismatch"; exit 1)

# size byte-count match (zip)
EXPECTED_ZIP_SIZE=$(wc -c < "release/Spine Texture Manager-1.1.2-arm64.zip")
ACTUAL_ZIP_SIZE=$(node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); console.log(y.files[0].size)")
[ "$EXPECTED_ZIP_SIZE" = "$ACTUAL_ZIP_SIZE" ] && echo "OK: zip size match" || (echo "FAIL: zip size mismatch"; exit 1)

# Same checks for .dmg (files[1])
EXPECTED_DMG_SHA512=$(shasum -a 512 "release/Spine Texture Manager-1.1.2-arm64.dmg" | awk '{print $1}' | xxd -r -p | base64)
ACTUAL_DMG_SHA512=$(node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); console.log(y.files[1].sha512)")
[ "$EXPECTED_DMG_SHA512" = "$ACTUAL_DMG_SHA512" ] && echo "OK: dmg sha512 match" || (echo "FAIL: dmg sha512 mismatch"; exit 1)

EXPECTED_DMG_SIZE=$(wc -c < "release/Spine Texture Manager-1.1.2-arm64.dmg")
ACTUAL_DMG_SIZE=$(node -e "const y=require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8')); console.log(y.files[1].size)")
[ "$EXPECTED_DMG_SIZE" = "$ACTUAL_DMG_SIZE" ] && echo "OK: dmg size match" || (echo "FAIL: dmg size mismatch"; exit 1)

# Base64 sha512 format regex
node -e "
const y = require('js-yaml').load(require('fs').readFileSync('release/latest-mac.yml','utf8'));
for (const f of y.files) { if (!/^[A-Za-z0-9+/=]{64,}\$/.test(f.sha512)) process.exit(1); }
console.log('OK: sha512 format');
"

# .zip.blockmap is benign side-effect (not in 7-asset CI count, but locally present)
test -f "release/Spine Texture Manager-1.1.2-arm64.zip.blockmap" && echo "INFO: .zip.blockmap produced (benign; CI glob excludes)"

# Vitest gate
npm run test
npm run typecheck
```

### D-07 Gate 2 — CI Workflow_Dispatch Dry Run

```bash
# On feature branch (NOT main, NOT a tag)
git checkout -b feat/v1.1.2-mac-zip
git push origin feat/v1.1.2-mac-zip
gh workflow run release.yml --ref feat/v1.1.2-mac-zip

# Capture run ID, watch
RUN_ID=$(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch --exit-status "$RUN_ID"

# Verify publish job correctly skipped
gh run view "$RUN_ID" --log | grep -E "^(GitHub Personal Access Token|asset_already_exists|publish provider)" && (echo "FAIL: publish leaked into dry run"; exit 1) || echo "OK: publish skipped"

# Download installer-mac artifact, verify both .dmg + .zip + latest-mac.yml present
gh run download "$RUN_ID" --name installer-mac --dir /tmp/dry-run
ls /tmp/dry-run/*.dmg /tmp/dry-run/*.zip /tmp/dry-run/latest-mac.yml > /dev/null || (echo "FAIL: artifact missing files"; exit 1)
echo "OK: dry-run artifact has dmg + zip + latest-mac.yml"
```

### D-08 Checkpoint 3 — Published Release Verification

```bash
# Watch tag-push CI run
gh run watch --exit-status <run-id>

# Asset count
ASSET_COUNT=$(gh release view v1.1.2 --json assets --jq '.assets | length')
[ "$ASSET_COUNT" = "7" ] && echo "OK: 7 assets" || (echo "FAIL: expected 7, got $ASSET_COUNT"; exit 1)

# Asset names exactly
gh release view v1.1.2 --json assets --jq '.assets[].name' | sort
# Expected exactly:
#   Spine Texture Manager-1.1.2-arm64.dmg
#   Spine Texture Manager-1.1.2-arm64.zip
#   Spine Texture Manager-1.1.2-x64.exe
#   Spine Texture Manager-1.1.2-x86_64.AppImage
#   latest-linux.yml
#   latest-mac.yml
#   latest.yml

# Release flags
gh release view v1.1.2 --json isDraft,isPrerelease --jq '. | "isDraft=\(.isDraft) isPrerelease=\(.isPrerelease)"'
# Expected: isDraft=false isPrerelease=false (after publish flip)
```

### Live UPDFIX-01 (Manual, Post-Publish)

Per RESEARCH §"Live UPDFIX-01 verification". Append transcript to `15-HUMAN-UAT.md`:

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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (release-engineering Plan 15-04 Tasks 1-2 are manual gates by design — D-07 gate 1 + D-07 gate 2 — and produce inspectable artifacts; this is documented and intentional)
- [ ] Wave 0 covers all MISSING references (build-scripts spec assertions, dual-installer test in synth spec, 15-HUMAN-UAT.md greenfield)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for vitest; < 10 min for D-07 CI dry run
- [ ] `nyquist_compliant: true` set in frontmatter (after Plan 15-04 close)

**Approval:** pending — set after Plan 15-04 Task 9 (doc-flip) commits the close-out.
