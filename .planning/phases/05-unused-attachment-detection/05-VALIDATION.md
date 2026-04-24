---
phase: 5
slug: unused-attachment-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/core/usage.spec.ts tests/main/summary.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5–8 seconds (quick) / ~15–20 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <touched spec(s)>` — per-task filtered vitest.
- **After every plan wave:** Run `npm run test` — full suite.
- **Before `/gsd-verify-work`:** Full suite must be green + CLI golden diff byte-identical.
- **Max feedback latency:** ≤ 20 seconds (full suite worst case).

---

## Per-Task Verification Map

*Populated by planner when plans are written. Each task's `<automated>` block fills one row below.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *TBD by planner* | | | F6.1 / F6.2 | — | N/A | unit | `npm run test -- <spec>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/usage.spec.ts` — **new** stubs for F6.1 (ghost-def, cross-skin, setup-pose semantics, dim aggregation, non-textured filter)
- [ ] `tests/main/summary.spec.ts` — **extend** (`summary.unusedAttachments` field exists + empty array on SIMPLE_TEST.json)
- [ ] `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` + `SIMPLE_TEST_GHOST.atlas` — **new** ghost-def fork per RESEARCH.md Finding #4 (12-line JSON diff adding GHOST region to default skin's CIRCLE slot dict; 2-line atlas diff)

*Existing vitest + arch.spec.ts infrastructure carries the rest (Layer 3 boundary checks auto-scan new files).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unused `<section>` renders above peak table with warm/terracotta header in `text-danger`; row cells in standard `text-fg`/`text-fg-muted` (D-105) | F6.2 | Visual — no DOM assertion can confirm perceived warm/terracotta hue or WCAG-validated contrast on a live render | Drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` → section appears with `⚠ 1 unused attachment`; header red, cells neutral; JetBrains Mono renders U+26A0 cleanly (fall back to inline SVG if garbled per Pitfall 9 of RESEARCH) |
| SearchBar filters BOTH peak table AND unused section consistently by substring match (D-107) | F6.2 | Cross-section UI interaction — integration between SearchBar state + two filter pipelines + consistent visibility toggle | Drop GHOST fixture → type "GHO" → peak table empties, unused row remains; type "CIRC" → peak table shows 1 row, unused section collapses (filtered empty); clear filter → both re-expand |
| Layout shift on dirty rig IS the alarm signal (D-106) — no reserved space on clean rigs, section pushes peak table down when non-empty | F6.2 | Visual — layout reflow is a perceptual UX signal, not a DOM invariant | Drop SIMPLE_TEST.json (clean) → no section, peak table sits flush with SearchBar; drop GHOST fixture → section appears, peak table shifts down; swap back → layout returns |
| CLI byte-for-byte unchanged (D-102) | F6.2 invariant | CLI golden compare — captured in automated test but manual sanity confirms terminal rendering identical | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → compare byte-for-byte against a reference output captured before Phase 5 changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills table above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (fixtures + spec stubs)
- [ ] No watch-mode flags (vitest `run` mode only, never `watch`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
