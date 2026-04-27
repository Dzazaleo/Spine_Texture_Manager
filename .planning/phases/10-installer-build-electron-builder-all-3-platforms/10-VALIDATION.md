---
phase: 10
slug: installer-build-electron-builder-all-3-platforms
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
last_updated: 2026-04-27
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + shell assertions on built artifacts |
| **Config file** | `vitest.config.ts` (existing) — no new test framework added in Phase 10 |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run typecheck` |
| **Estimated runtime** | ~30 seconds (vitest) + ~3-8 minutes per platform installer build |

Phase 10 is primarily a config/scripts/version phase. Most validation comes from:
1. **vitest** — unchanged from prior phases (no new tests added here)
2. **shell assertions** — `codesign -dv`, `plutil`, `ls app.asar.unpacked/...`, file-exists checks on installer outputs
3. **manual smoke test** — install the app, load fixture, run Optimize Assets (the only DIST-06 verification path; cannot be automated in v1.1)

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (vitest, fast — should stay green throughout)
- **After every plan wave:** Run `npm run test && npm run typecheck`
- **After installer-producing tasks:** Run shell assertions on the produced artifact (codesign / plutil / asar inspection — see Per-Task Verification Map below)
- **Before `/gsd-verify-work`:** vitest green + at least one platform installer built and smoke-tested
- **Max feedback latency:** ~30s for vitest; installer builds are slow (3-8 min) but produce immediate exit-code feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-T1 | 10-01 | 1 | DIST-07 | T-10-01, T-10-02, T-10-04 | package.json edits restricted to version + scripts; no leaked paths | static-config | `node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); if(p.version!=='1.1.0-rc1') process.exit(1); for(const k of ['build:mac','build:win','build:linux']) if(!p.scripts[k]) process.exit(1); console.log('OK')"` | ✅ package.json | ⬜ pending |
| 10-01-T2 | 10-01 | 1 | DIST-07 (indirect) | T-10-03 | sentinel file is 0 bytes; no payload smuggled into buildResources | shell | `test -d build && test -f build/.gitkeep && [ "$(wc -c < build/.gitkeep \| tr -d ' ')" = "0" ]` | ✅ build/.gitkeep | ⬜ pending |
| 10-02-T1 | 10-02 | 2 | DIST-01, DIST-02, DIST-03, DIST-04, DIST-05, DIST-06, DIST-07 | T-10-05, T-10-06, T-10-07, T-10-08, T-10-09, T-10-10, T-10-11 | identity: '-' single-quoted; no certificateFile keys; both sharp + @img asarUnpack patterns preserved; files allowlist 19 lines intact | static-config (regex over YAML) | (see 10-02-PLAN.md `<verify>` block — 30+ regex assertions covering all required keys, all forbidden keys, and the 6× artifactName template count) | ✅ electron-builder.yml | ⬜ pending |
| 10-03-T1 | 10-03 | 3 | DIST-02, DIST-07 | T-10-05 | build script produces correctly-named artifact at expected path | shell | `test -d "release/mac-arm64/Spine Texture Manager.app" && test -f "release/Spine Texture Manager-1.1.0-rc1-arm64.dmg"` | ✅ release/ (gitignored) + 10-build-mac.log | ⬜ pending |
| 10-03-T2 | 10-03 | 3 | DIST-04, DIST-06, DIST-07 | T-10-08, T-10-12 | ad-hoc signature engaged on .app; sharp + libvips subpackages physically present in app.asar.unpacked | shell | `grep -q 'Signature=adhoc' 10-mac-assertions.log && grep -q '1.1.0-rc1' 10-mac-assertions.log && grep -q 'sharp-darwin-arm64' 10-mac-assertions.log && grep -q 'sharp-libvips-darwin-arm64' 10-mac-assertions.log` | ✅ 10-mac-assertions.log + 10-SMOKE-TEST.md | ⬜ pending |
| 10-03-T3 | 10-03 | 3 | DIST-06 | T-10-12, T-10-15, T-10-16 | dlopen successfully resolves libvips at runtime; app exports non-zero PNGs from real fixture | manual (checkpoint:human-verify) | (no automated command — recipe in 10-SMOKE-TEST.md `## macOS → Manual Optimize Assets smoke`) | N/A — manual checkpoint | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage:** All 7 DIST requirements (DIST-01..DIST-07) covered by at least one task with an automated command, OR by a manual checkpoint where automation is impossible (DIST-06 dynamic). DIST-01, DIST-03, DIST-05 are covered by Plan 02's static YAML config alone (Windows + Linux artifacts produced by Phase 11 CI; Plan 02 establishes the config that CI consumes).

**Phase 11 CI hand-off:** The verification commands in this map (and in `10-SMOKE-TEST.md`) are written to be re-runnable in a CI environment without modification. Phase 11 will consume `10-SMOKE-TEST.md` as its source-of-truth for per-platform shell assertions.

---

## Wave 0 Requirements

- [x] No new test infrastructure required — vitest already configured from prior phases.
- [x] Confirm `package.json#version` is bumped to `1.1.0-rc1` before any installer build (DIST-07 prerequisite). **Gated by Plan 01.**
- [x] No `MISSING — Wave 0 must create` placeholders — all automated commands target real, existing tooling (`node`, `grep`, `codesign`, `plutil`, `ls`, `test`).

*Existing test infrastructure covers all automatable phase requirements. Manual smoke tests cover what shell assertions cannot (DIST-06 dlopen-time validation).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installed macOS app launches and runs Optimize Assets export to non-zero PNGs | DIST-02, DIST-06 | Requires GUI interaction with installed app; no headless harness in v1.1 | See `10-SMOKE-TEST.md` → "macOS → Manual Optimize Assets smoke" — gated by Plan 03 Task 3 (checkpoint:human-verify) |
| Installed Windows app launches and runs Optimize Assets export to non-zero PNGs | DIST-01, DIST-05, DIST-06 | Requires Windows host + GUI; SmartScreen interaction is OS-mediated; deferred to user-on-Windows or Phase 11 CI | See `10-SMOKE-TEST.md` → "Windows → Manual Optimize Assets smoke" |
| Linux AppImage build attempted locally (best-effort) | DIST-03 | Local Linux build is best-effort per Phase 10 scope; CI is the actual verification surface (Phase 11) | See `10-SMOKE-TEST.md` → "Linux" section. YAML config completeness (Plan 02) is the actual phase deliverable; runtime smoke is Phase 11. |
| macOS `.dmg` ad-hoc signature present | DIST-04 | Signature is on the produced artifact; verified by `codesign` shell tool, not unit test | Automated in Plan 03 Task 2 (shell assertion against `10-mac-assertions.log`) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit `checkpoint:human-verify` (Plan 03 Task 3).
- [x] Sampling continuity: every task in every plan has either an automated verify or a human-verify checkpoint (no 3-task gap of automation).
- [x] Wave 0 covers all MISSING references (none — all tooling pre-existed).
- [x] No watch-mode flags (no `vitest --watch`, no `electron-vite dev` in verify commands).
- [x] Feedback latency < 30s for vitest; installer-build feedback is necessarily slower (per-platform, 3-8 min) and tracked separately.
- [x] `nyquist_compliant: true` set in frontmatter (Per-Task Verification Map populated).

**Approval:** ready for execution
