---
phase: 33
slug: rotated-atlas-region-support-loader-bounds-export-fixture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for test scaffolding: `33-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- tests/core/bounds-rotation-aabb.spec.ts tests/core/loader-rotation-accept.spec.ts tests/core/export-rotation-dims.spec.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | quick: ~5s, full: ~60s |

---

## Sampling Rate

- **After every task commit:** Run quick run command (rotation-specific specs)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run typecheck` green
- **Max feedback latency:** ~60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD-fixture-01 | TBD | 1 | ATLAS-04 | fixture-build | `ls fixtures/spine_rotated/EXPORT/skeleton.{json,atlas,png}` | ❌ W0 | ⬜ pending |
| TBD-loader-01 | TBD | 2 | ATLAS-01 | unit | `npm test -- tests/core/loader-rotation-accept.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-bounds-01 | TBD | 2 | ATLAS-02 | unit (16-case matrix) | `npm test -- tests/core/bounds-rotation-aabb.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-export-01 | TBD | 2 | ATLAS-03 | unit | `npm test -- tests/core/export-rotation-dims.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-worker-01 | TBD | 3 | ATLAS-03 | integration (pixel) | `npm test -- tests/main/image-worker-rotation.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-cleanup-01 | TBD | 3 | (cleanup) | arch-grep | `npm test -- tests/core/no-stale-rotation-error.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-cleanup-02 | TBD | 3 | (cleanup) | delete | `! test -f tests/core/loader-rotation-rejection.spec.ts && ! test -f tests/core/rotated-region-error.spec.ts` | n/a | ⬜ pending |

*Task IDs and plan assignments will be finalized by the planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fixtures/spine_rotated/EXPORT/skeleton.{json,atlas,png}` — committed real-Spine-packer fixture with ≥1 rotated region (tall-narrow, ≥5:1 aspect)
- [ ] `tests/core/loader-rotation-accept.spec.ts` — stub for ATLAS-01
- [ ] `tests/core/bounds-rotation-aabb.spec.ts` — 16-case AABB matrix (bones × attachment.rotation × scale) for ATLAS-02
- [ ] `tests/core/export-rotation-dims.spec.ts` — canonical outW/outH check for ATLAS-03
- [ ] `tests/main/image-worker-rotation.spec.ts` — passthrough + resize pixel/dim compare for ATLAS-03
- [ ] `tests/core/no-stale-rotation-error.spec.ts` — arch-grep guard against `RotatedRegionUnsupportedError` references

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real rotated atlas loads end-to-end | ATLAS-01 | UAT confidence (live render of Global + Animation Breakdown panels) | Drop `fixtures/spine_rotated/EXPORT/skeleton.json` into a dev build; verify no error banner, panels populate with at least one rotated region present |
| Optimize Assets produces canonical-dim PNGs | ATLAS-03 | UAT confidence (real export round-trip) | After loading rotated fixture, click Optimize → choose folder → inspect produced PNGs; verify per-region dims match canonical (unrotated) source W×H |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (fixture + 5 spec files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planner finalizes task IDs

**Approval:** pending
