---
phase: 10
slug: installer-build-electron-builder-all-3-platforms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
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

> Filled out by gsd-planner during planning. Each task in PLAN.md must have an entry here mapping it to its automated verification command and acceptance criteria.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | DIST-XX     | —          | N/A             | shell     | TBD               | ⬜ pending  | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test infrastructure required — vitest already configured from prior phases.
- [ ] Confirm `package.json#version` is bumped to `1.1.0-rc1` (or chosen v1.1 string) before any installer build — DIST-07 depends on this.

*Existing test infrastructure covers all automatable phase requirements. Manual smoke tests cover what shell assertions cannot.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installed macOS app launches and runs Optimize Assets export to non-zero PNGs | DIST-02, DIST-06 | Requires GUI interaction with installed app; no headless harness in v1.1 | (1) Open the produced `.dmg`, drag to /Applications. (2) System Settings → Privacy & Security → "Open Anyway" on first launch (Sequoia-compatible path). (3) Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. (4) Run Optimize Assets → output to a temp folder. (5) Verify output PNGs exist and have non-zero size. |
| Installed Windows app launches and runs Optimize Assets export to non-zero PNGs | DIST-01, DIST-05, DIST-06 | Requires Windows host + GUI; SmartScreen interaction is OS-mediated | (1) Transfer `.exe` to a Windows machine. (2) Run installer; on SmartScreen prompt click "More info" → "Run anyway". (3) Launch installed app from Start Menu. (4) Load fixture, run Optimize Assets, verify output PNGs. |
| Linux AppImage build attempted locally (best-effort) | DIST-03 | Local Linux build is best-effort per Phase 10 scope; CI is the actual verification surface (Phase 11) | Run `npm run build:linux` on macOS or in a Linux VM. Document outcome (success or failure mode) in commit message. Failure is acceptable; YAML config completeness is the actual deliverable. |
| macOS `.dmg` ad-hoc signature present | DIST-04 | Signature is on the produced artifact; verified by tool, not unit test | Run `codesign -dv "Spine Texture Manager.app"` (mounted from .dmg). Output must include `Signature=adhoc`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills Per-Task Verification Map)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (version bump for DIST-07 is the only Wave 0 prerequisite)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for vitest; installer-build feedback is necessarily slower (per-platform, 3-8 min)
- [ ] `nyquist_compliant: true` set in frontmatter once planner has populated the Per-Task Verification Map

**Approval:** pending
