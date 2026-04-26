---
phase: 7
slug: atlas-preview-modal
status: signed-off
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
signed_off: 2026-04-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (pure-TS core) + vitest+jsdom+@testing-library/react (renderer) |
| **Config file** | vitest.config.ts (extend `include` to cover `tests/**/*.spec.tsx`) |
| **Quick run command** | `npm run test -- tests/core/atlas-preview.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10-20 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <changed-spec>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled in by gsd-planner during planning. Each task gets one row mapping to its
> `<acceptance_criteria>` automated checks. Wave 0 may install missing infrastructure
> (jsdom, @testing-library/react) and seed empty spec files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD_   |      |      |             |            |                 |           |                   |             | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `maxrects-packer` (runtime), `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` (devDeps) per RESEARCH §"Vite + React + TypeScript + Test Stack"
- [ ] `vitest.config.ts` — extend `include` array to match `tests/**/*.spec.tsx`
- [ ] `tests/core/atlas-preview.spec.ts` — stub spec for F7.1 / F7.2 (filled in by execution-phase tasks)
- [ ] `tests/renderer/atlas-preview-modal.spec.tsx` — stub spec with `// @vitest-environment jsdom` pragma (filled in by execution-phase tasks)

*Existing tests/arch.spec.ts Layer 3 grep extends to `src/core/atlas-preview.ts` (no fs/sharp/Electron import).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas renders actual region pixels (drawImage 9-arg crop) | F7.1 | jsdom does not implement HTMLCanvasElement pixel rendering — automated tests verify the projection math + DOM structure, not pixels | Open app → load SIMPLE_TEST.json → click "Atlas Preview" toolbar button → verify each region rect contains its source PNG content (CIRCLE / SQUARE / TRIANGLE drawn into packed slots), not solid colors |
| Hover-reveal of fill + label | F7.1 | Visual interaction test — hover behavior across canvas pixel coords | Hover any region rect → expect warm-stone-accent low-opacity fill + attachment name overlay; mouseleave → outline-only restored |
| Dblclick-jump UX (canonical "20% glow override" workflow) | F7.1 | Cross-modal + cross-panel sequence — exercises focus, flash animation, and state coordination | Open Atlas Preview → dblclick any region rect → expect modal closes + AppShell tab switches to "Global Max Render Source" + matching row scrolls into view + flashes once |
| Mode + resolution toggles re-render projection | F7.1 / F7.2 | Visual verification of segmented control state + canvas re-paint | Toggle Original ↔ Optimized: expect different region sizes; toggle 2048 ↔ 4096: expect page count + efficiency to update |
| Snapshot-at-open semantics (D-131) | F7.1 | Sequence test across modal open/close + override edit | Open → close → edit override in panel → reopen → expect refreshed projection (region affected by override visibly shrinks) |
| Missing-source rendering (D-137) | F7.1 | Requires deliberately-broken fixture | Rename fixture PNG temporarily → reopen modal → expect rect outline + ⚠ glyph + tooltip "Source missing: <path>" on hover; restore PNG after |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` automated commands or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (maxrects-packer, jsdom, @testing-library/react, vitest config widening)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
