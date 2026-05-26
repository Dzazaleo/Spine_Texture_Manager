---
phase: 55
slug: variant-export-sizes-to-peak-demand
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/core/variant-sizing.spec.ts tests/core/export.spec.ts tests/scale-bake.spec.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (quick); ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/core/variant-sizing.spec.ts tests/core/export.spec.ts tests/scale-bake.spec.ts`
- **After every plan wave:** Run `npm test && npm run typecheck:node && npm run typecheck:web`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | D-A (Universal clamp) | — | `variantScale` is validated at IPC boundary before reaching `buildExportPlan` | unit | `npm test -- tests/core/variant-sizing.spec.ts` | ❌ new test needed | ⬜ pending |
| 55-01-02 | 01 | 1 | D-A (Master byte-identity) | — | N/A | unit | `npm test -- tests/core/export.spec.ts` | ✅ existing | ⬜ pending |
| 55-01-03 | 01 | 1 | D-C (sourceRatio tighter) | — | N/A | unit | `npm test -- tests/core/variant-sizing.spec.ts` | ❌ new test needed | ⬜ pending |
| 55-01-04 | 01 | 1 | D-E (Override update) | — | N/A | unit | `npm test -- tests/core/variant-sizing.spec.ts` | ❌ existing test update | ⬜ pending |
| 55-01-05 | 01 | 1 | Phase 48 oracle | — | N/A | unit | `npm test -- tests/scale-bake.spec.ts` | ✅ existing (unchanged) | ⬜ pending |
| 55-01-06 | 01 | 1 | Layer-3 purity | — | No fs/DOM/spine-core imports in `src/core/export.ts` | hygiene | `npm test -- tests/arch.spec.ts` | ✅ existing | ⬜ pending |
| 55-01-07 | 01 | 1 | CI full surface | — | N/A | integration | `npm test && npm run typecheck:node && npm run typecheck:web` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/variant-sizing.spec.ts` — UPDATE existing `'no overrides'` BIG test: change `expectedEff` formula comment from `Math.min(safeScale(s * master.peakScale), 1)` to `Math.min(safeScale(s * master.peakScale), 1 / s)`. Number stays 1.0 for BIG/0.5 case (safeScale(1.0) < 2.0).
- [ ] `tests/core/variant-sizing.spec.ts` — UPDATE existing override test: `expectedEff = min(safeScale(1.5), 1/s=2) = 1.5` (was 1.0). `outW = ceil(1000 × 1.5) = 1500` (was 1000).
- [ ] `tests/core/variant-sizing.spec.ts` — ADD new describe block `'Phase 55 — 1/s ceiling'` with:
  - T1: clean-atlas, master peak 2.5, s=0.5 → `effScale = 1.25`; `outW = ceil(canonicalW × 1.25)` (not clamped at 1)
  - T2: clean-atlas, master peak 5.0, s=0.5 → clamps at `1/s = 2`; `outW = 2 × canonicalW = masterSourceW`
  - T3: drifted-atlas (actualSource < canonical), master peak 2.0, s=0.5 → `sourceRatio` binds; `1/s = 2` is harmless headroom

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TEST_ARMAN 80×40 / 1.02× row variant reopen | D-A live UAT | Requires user's local `/Users/leo/Downloads/TEST_ARMAN/` project | (1) Load master SYMBOLS.json. (2) Export Variant at 0.5× with Phase 55 code. (3) Re-open variant. (4) Confirm: source = 41×21, resampled peakScale ≤ 1, ExtrapolationIcon does NOT fire. |
| Counter-test: pre-optimized master still shows icon | D-F | Requires specific master with actualSource < canonical AND peakScale > 1 | Open a master where `actualSource < canonical`. Confirm ExtrapolationIcon fires + "capped at source dims" tooltip suffix is still present. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
