---
phase: 38
slug: phase-4-code-review-polish-pass
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | POLISH-01 | — | N/A — audit doc | doc | `test -s .planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` | ❌ W0 | ⬜ pending |
| 38-02-01 | 02 | 2 | POLISH-02 | — | overlay-click during drag does NOT close dialog | unit | `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx` | ❌ W0 | ⬜ pending |
| 38-02-02 | 02 | 2 | POLISH-02 | — | overlay mousedown→mouseup-on-overlay closes dialog | unit | `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx` | ❌ W0 | ⬜ pending |
| 38-03-01 | 03 | 3 | POLISH-03 | — | N/A — todo file move | manual | `test -f .planning/todos/resolved/2026-04-24-phase-4-code-review-follow-up.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` — new spec mirroring `tests/renderer/override-dialog-empty-input.spec.tsx` for IN-02 drag-to-cancel guard
- [ ] `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` — audit doc enumerating IN-01..IN-06 + WR-03 verdicts

*Existing renderer test harness (vitest + @testing-library/react) covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audit doc is human-readable and verdicts are defensible | POLISH-01 | Audit is a doc artifact, not executable | Read `38-POLISH-AUDIT.md`; confirm one row per IN-01..06 + WR-03; each row cites current-source evidence (file:line or commit SHA) |
| Todo file moved and close-out note references Phase 38 + per-finding outcomes | POLISH-03 | Filesystem move + freeform note | `test -f .planning/todos/resolved/2026-04-24-phase-4-code-review-follow-up.md && ! test -f .planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md`; grep close-out note for "Phase 38" and IN-01..06 outcomes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
