---
phase: 30
slug: safety-buffer-in-optimize-dialog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `30-RESEARCH.md` §Validation Architecture (lines 819-905).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4 + @testing-library/react (renderer); vitest 4 (core) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test -- export.spec.ts project-file.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds full suite (per Phase 22 telemetry); <5 s quick |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- export.spec.ts project-file.spec.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green (~700 tests)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Tasks numbered `30-PP-TT` (PP = plan, TT = task). Filled by gsd-planner.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-* | 01 | 1 | BUFFER-03 | — | Validator rejects out-of-range / non-integer; v1.2-era files load with default 0 | unit (core) | `npm run test -- tests/core/project-file.spec.ts -t "Phase 30"` | ✅ existing file; new describe block | ⬜ pending |
| 30-02-* | 02 | 2 | BUFFER-01, BUFFER-02 | — | rawEffScale × (1+buffer/100) → safeScale → cap at sourceRatio; bufferCapped flag fires correctly; parity between core and renderer-view | unit (core) | `npm run test -- tests/core/export.spec.ts -t "Phase 30"` | ✅ existing file; new describe block | ⬜ pending |
| 30-03-* | 03 | 3 | BUFFER-01 | — | Reactive recompute on input change; clamp negative/>25/decimal/NaN at handler; tooltip + ARIA per UI-SPEC | integration (renderer) | `npm run test -- tests/renderer/optimize-dialog-buffer.spec.tsx` | ❌ Wave 0 (new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/renderer/optimize-dialog-buffer.spec.tsx` — new file; covers reactive recompute (typing changes summary tile content) + clamp behavior (negative / >25 / decimal / NaN inputs) + tooltip + ARIA per UI-SPEC.
- [ ] New `describe('Phase 30 — safetyBufferPercent')` block in `tests/core/project-file.spec.ts` (mirror Phase 28 block at lines 381-466 byte-for-byte; substitute boolean → integer + range validation).
- [ ] New `describe('buildExportPlan — Phase 30 BUFFER-01..03')` block in `tests/core/export.spec.ts` (no-op, growth, cap-binding, dedup, passthrough preservation, parity with renderer-view).
- [ ] Extend the existing parity describe block at `tests/core/export.spec.ts:657-740` with regex check for `safetyBufferPercent` and `bufferCapped` keywords in both `src/core/export.ts` and `src/renderer/src/lib/export-view.ts`.

---

## Nyquist 8 Dimensions Summary

| # | Dimension | Test outline | Acceptance |
|---|-----------|-------------|-----------|
| 1 | Functional | Buffer at 0/1/5/10/25 on SIMPLE_TEST → effectiveScale = safeScale(raw × (1+b/100)) clamped + capped | All five values produce formula-derivable outW/outH; 0% case bit-equal to no-buffer call |
| 2 | Negative-path | Validator rejects -1/26/5.5/"5"/NaN; OptimizeDialog clamps invalid input | All invalid file values → `{ ok: false, error: 'invalid-shape' }`; input handler clamps to [0,25] |
| 3 | Boundary | Buffer 0/1/25/26/-1; row with peak 0.95 + buffer 6% → cap at 1.0, bufferCapped:true | bufferCapped fires per locked predicate (A1 resolution) |
| 4 | Concurrency | Rapid keystroke "123" → batched updates → final clamp 25 | Summary tiles reflect 25, not intermediate value |
| 5 | Cross-platform | safetyBufferPercent round-trips on POSIX + Windows path styles | Round-trip identity preserved on both |
| 6 | Persistence (CRITICAL) | (a) v1.2 file (no field) → load → 0; (b) save w/ 5 → reload → 5; (c) double save → byte-identical JSON | All three contracts hold; schema version stays at 1 |
| 7 | Performance | `buildExportPlan` on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` at buffer 0/5/25 | Each call < 10 ms wall time; debounce only if exceeded |
| 8 | Regression | Full ~700-test suite pre/post buffer wiring; D-07 no-op contract | Zero existing test fails when buffer === 0 |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual placement of buffer input above sharpen toggle in "Quality" group | UI-SPEC | Layout/visual fidelity not jsdom-testable | Open OptimizeDialog in dev build; confirm group label "Quality" with buffer above sharpen line |
| Tooltip appears on hover with cap-explanation copy | D-15 | Tooltip rendering depends on real CSS hover state | Hover the input in dev build; confirm tooltip text matches D-15 wording |
| Reactive perf feel on real-world Spine rig (no jank perception) | D-08, D-11 | Subjective perceived smoothness | Open OptimizeDialog with `fixtures/Girl/`; type buffer 0→25 quickly; confirm no perceived stutter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
