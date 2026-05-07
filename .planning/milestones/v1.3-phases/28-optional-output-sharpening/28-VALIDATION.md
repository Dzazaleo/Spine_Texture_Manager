---
phase: 28
slug: optional-output-sharpening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/main/image-worker` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds (full suite) / ~5 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <relevant test path>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD by planner | TBD | TBD | SHARP-01 | — | UI toggle hydrates from .stmproj; persists on save; backward-compat (missing field → false) | unit | `npm run test -- tests/core/project-file` | TBD | ⬜ pending |
| TBD by planner | TBD | TBD | SHARP-02 | — | sharpen() called iff effectiveScale<1.0 AND toggle ON; both call sites covered; sigma=SHARPEN_SIGMA constant | integration | `npm run test -- tests/main/image-worker` | TBD | ⬜ pending |
| TBD by planner | TBD | TBD | SHARP-03 | — | Real-bytes regression: variance increases at downscale<1 with toggle ON; identical at toggle OFF; identical at scale=1.0 regardless | integration | `npm run test -- tests/main/image-worker` | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No new test infrastructure needed — vitest already configured.
- [ ] `tests/core/project-file.spec.ts` — already exists; new cases append (Phase 21 `loaderMode` precedent).
- [ ] `tests/main/image-worker.integration.spec.ts` — already exists per research; SHARP-02/03 cases append.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual A/B vs Photoshop "Bicubic Sharper (reduction)" baseline | SHARP-02 (perceptual) | Subjective perceptual judgment; not deterministic-pixel-asserting | Run Optimize Assets on the user's reference character (blue dress + yellow border) at downscale 0.5–0.75 with toggle ON, compare to Photoshop reduction output side-by-side. |
| Toggle UX in OptimizeDialog (label clarity, position, disabled state when no downscale rows) | SHARP-01 | UX feel + copy review | Open OptimizeDialog with a project that has mixed scale/passthrough rows; verify checkbox appears, default OFF, persists across project save/reload. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills task IDs)

**Approval:** pending
