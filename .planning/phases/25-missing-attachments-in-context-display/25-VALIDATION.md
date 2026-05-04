---
phase: 25
slug: missing-attachments-in-context-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vite.config.ts` (vitest section) |
| **Quick run command** | `npm run test -- --run tests/core/summary.spec.ts tests/renderer/missing-attachments-panel.spec.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run tests/core/summary.spec.ts tests/renderer/missing-attachments-panel.spec.tsx`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | PANEL-03 | — | N/A | unit | `npm run test -- --run tests/core/summary.spec.ts` | ✅ (needs update) | ⬜ pending |
| 25-01-02 | 01 | 1 | PANEL-03 | — | N/A | unit | `npm run test -- --run tests/core/summary.spec.ts` | ✅ (needs update) | ⬜ pending |
| 25-02-01 | 02 | 2 | PANEL-03 | — | N/A | unit/RTL | `npm run test -- --run tests/renderer/global-max-missing-row.spec.tsx` | ❌ Wave 0 | ⬜ pending |
| 25-02-02 | 02 | 2 | PANEL-03 | — | N/A | unit/RTL | `npm run test -- --run tests/renderer/global-max-missing-row.spec.tsx` | ❌ Wave 0 | ⬜ pending |
| regression | 02 | 2 | PANEL-03 | — | N/A | unit/RTL | `npm run test -- --run tests/renderer/missing-attachments-panel.spec.tsx` | ✅ (no change needed) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/renderer/global-max-missing-row.spec.tsx` — new spec file covering PANEL-03 renderer layer: `rowState()` returns `'missing'` when `isMissing=true`, `rowState()` checks `isMissing` before `isUnused`, `⚠` icon renders for missing rows in GlobalMaxRenderPanel, no ⚠ icon for non-missing rows

*Existing infrastructure (`tests/core/summary.spec.ts`, `tests/renderer/missing-attachments-panel.spec.tsx`) covers all other phase requirements. Only the new renderer spec is a Wave 0 gap.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Missing-attachment row visible in Global panel with red left-border accent + ⚠ icon | PANEL-03 | Visual accent (bg-danger CSS class) requires human verification in Electron dev server | Load fixtures/SIMPLE_PROJECT with one PNG deleted; confirm TRIANGLE row appears with red bar and ⚠ |
| Missing-attachment row visible in Animation Breakdown card with same treatment | PANEL-03 | Same — visual CSS verification | Expand an animation card containing TRIANGLE; confirm red bar and ⚠ icon |
| MissingAttachmentsPanel above Global panel still shows skipped attachment list | PANEL-03 | Additive behavior — both panels visible simultaneously | Confirm MissingAttachmentsPanel still present and unchanged alongside the now-visible rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/renderer/global-max-missing-row.spec.tsx`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
