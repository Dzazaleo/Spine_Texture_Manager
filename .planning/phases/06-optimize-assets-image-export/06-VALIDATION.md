---
phase: 6
slug: optimize-assets-image-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Authoritative source: `.planning/phases/06-optimize-assets-image-export/06-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (no Wave 0 install) |
| **Quick run command** | `npm run test -- --run tests/core/export.spec.ts tests/main/image-worker.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~25 s (full suite) / ~5 s (Phase 6 quick subset) |

---

## Sampling Rate

- **After every task commit:** Run quick subset for the file/feature touched.
- **After every plan wave:** Run full suite.
- **Before `/gsd-verify-work 6`:** Full suite must be green; arch.spec.ts green; packaged-build sharp-load smoke check passing.
- **Max feedback latency:** ≤ 30 seconds.

---

## Per-Task Verification Map

> Filled by `gsd-planner` as plans 06-01-PLAN.md … 06-NN-PLAN.md are written. Each task's `<automated>` verification command lands in this table. The `Test Type` column maps to the dimension classes from RESEARCH.md §Validation Architecture: pure-unit, mocked-unit, integration, packaged-build, manual-visual, arch-grep.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 prepares test fixtures + RED test shells before any implementation. Planner fills concrete file lists; below is the structural commitment from RESEARCH.md.

- [ ] `fixtures/EXPORT_PROJECT/` — dedicated export fixture (atlas + JSON + `images/CIRCLE.png`, `SQUARE.png`, `SQUARE2.png`, `TRIANGLE.png`) so tests can exercise real PNG read/write end-to-end without depending on `SIMPLE_PROJECT` (which has no `images/` folder).
- [ ] `tests/core/export.spec.ts` — RED shell covering buildExportPlan dedup, override-clamping, unused-exclusion, Math.round half-cases, hygiene grep (no `fs`/`sharp`/`spine-core` imports in `src/core/export.ts`).
- [ ] `tests/main/image-worker.spec.ts` — RED shell with mocked `sharp` + `node:fs/promises` covering all-success, missing-source, sharp-error mid-run, cancel-after-N, atomic-write protocol, re-entrant `'export:start'` rejection.
- [ ] `tests/arch.spec.ts` — extend forbidden-import scan for `src/core/export.ts` to include `sharp`, `node:fs`, `fs/promises` (verify whether already covered by the existing Layer 3 grep).
- [ ] No new framework install — vitest covers all dimensions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lanczos3 visual quality vs Photoshop reference | N3.2 | "no perceptible difference" is subjective; no automated golden-image diff in MVP | Export `CIRCLE.png` at peakScale ≈ 0.7. Open exported file + a Photoshop-Lanczos resize of the same source at the same target dims. Side-by-side diff in an image diff tool. Flag any visible difference. |
| Packaged `.dmg` loads sharp without `electron-rebuild` | N4.2 + D-123 | Native binary unpacking only verifiable on a built artifact, not in dev mode | `npm run build`. Open the produced `.dmg`, install, launch. Trigger an export of the SIMPLE/EXPORT fixture. Confirm: no native-module load error, output file produced at correct dims. |
| OS folder picker behavior + `defaultPath` honored | F8.1 + D-122 | Electron `dialog.showOpenDialog` is OS-driven; cannot be unit-tested | Click "Optimize Assets" with a loaded skeleton. Picker opens at `<skeleton_dir>/images-optimized/` (creates if absent). Cancel button closes picker silently. Confirm button mounts OptimizeDialog with the chosen path. |
| Cancellation UX during a 30+ file export | F8.5 + D-115 | Race-condition behavior of cooperative cancel only observable on a real-sized batch | Export the EXPORT_PROJECT fixture (or larger). Click Cancel mid-run. In-flight file finishes; subsequent files do not start; partial output stays on disk; summary shows `cancelled: true` + correct successes count. |
| OptimizeDialog ARIA + keyboard | F8.5 (UX safety) | Screen-reader/keyboard interaction is not in the unit-test surface | Open dialog. Tab cycles through Start/Cancel without leaking. ESC closes pre-flight. Click-outside closes pre-flight. During run, Cancel is reachable via Tab. Open-output-folder works after completion. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
