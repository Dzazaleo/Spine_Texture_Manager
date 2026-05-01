---
phase: 20
slug: documentation-builder-feature
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test -- tests/core/documentation` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/core/documentation`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-XX-XX | TBD | TBD | DOC-01..DOC-05 | — | — | TBD | `npm run test` | ❌ W0 | ⬜ pending |

*Per-task rows will be filled by the planner from PLAN.md `<verify>` blocks; row above is the placeholder until plans land.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/documentation.spec.ts` — validator + serialize/deserialize stubs for DOC-05 round-trip
- [ ] `tests/core/project-file-doc-roundtrip.spec.ts` — full save → reload → bit-equal `documentation` slot for DOC-05
- [ ] `tests/main/doc-export.spec.ts` — golden-file HTML export for DOC-04 (clock-frozen via dependency injection)
- [ ] `tests/renderer/DocumentationBuilderDialog.spec.tsx` — modal open + tab switching for DOC-01

*Existing vitest infrastructure (`vitest.config.ts`, `tests/arch.spec.ts`) covers config; new test files are scaffolded in Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop animation from side list onto a track container | DOC-02 | HTML5 native DnD requires a real browser DOM; jsdom does not implement DnD | 1. `npm run dev`, load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. 2. Click Documentation button. 3. Switch to Animation Tracks pane. 4. Click "+ Add Track" to create Track 0. 5. Drag an animation from the side list onto the track container; confirm new entry appears with default mixTime=0.25 + loop=false. |
| HTML export opens correctly in a browser offline | DOC-04 | Browser rendering is the contract | 1. With docs authored, switch to Export pane. 2. Click "Export → HTML". 3. Choose a save location. 4. Open the resulting `.html` file in Safari/Firefox/Chrome with no network. 5. Confirm: hero row + chip strip + optimization config card + general notes card + animation tracks table + control bones + skins + events render with no broken refs (no missing icons, no missing fonts, no `file://` 404s). |
| Cross-platform DnD drag-image consistency | DOC-02 | Electron Chromium quirk on macOS/Windows/Linux | Repeat manual DnD test on each OS the project ships to (per release matrix); confirm drag image renders identically (no missing thumbnail). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (validator stub, round-trip stub, golden-file stub, modal stub)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
