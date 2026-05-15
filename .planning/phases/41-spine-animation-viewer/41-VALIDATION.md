---
phase: 41
slug: spine-animation-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Mirrors `41-RESEARCH.md` § Validation Architecture; planner fills the Per-Task Verification Map after PLAN.md tasks are assigned IDs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom env for renderer specs; node env for core specs) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- tests/renderer/animation-player-modal.spec.tsx tests/renderer/app-shell-animation-viewer.spec.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20 seconds (full suite); ~2 seconds (modal-scoped quick run) |

---

## Sampling Rate

- **After every task commit:** Run quick command (modal + AppShell wiring specs).
- **After every plan wave:** Run full suite.
- **Before `/gsd-verify-work`:** Full suite green; manual UAT checklist (VIEWER-04-visible, VIEWER-06-visible, VIEWER-08-real-leak, VIEWER-09-real-fs) executed against `fixtures/SIMPLE_PROJECT/` + a complex rig (e.g., `fixtures/Girl/`) on macOS at minimum.
- **Max feedback latency:** 20 seconds.

---

## Per-Task Verification Map

> Populated by planner during PLAN.md authoring. Each task lands one row. Test Type ∈ {unit, integration, manual}. Automated Command shows the precise `npm test --` invocation that proves the task's acceptance criteria.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-XX-XX | XX | X | VIEWER-XX | — | N/A (read-only viewer; no user input persistence; no network) | unit / integration / manual | `npm test -- {spec}` | ✅ / ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/renderer/animation-player-modal.spec.tsx` — vitest jsdom spec stub covering modal scaffold + selectors + transport + error state (stubs `window.api`, mocks `@esotericsoftware/spine-player`'s `SpinePlayer` class)
- [ ] `tests/renderer/app-shell-animation-viewer.spec.tsx` — vitest jsdom spec stub covering toolbar button presence + disable predicate + open/close state + project-change cleanup
- [ ] (If new IPC added per Q1) `tests/main/viewer-asset-feed.spec.ts` — stub for `viewer:get-asset-feed` handler covering atlas-source and atlas-less branches

Vitest + jsdom + react testing library are already installed (see existing `tests/renderer/atlas-preview-modal.spec.tsx`); no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Character actually renders + animates onscreen | VIEWER-04 (visible) | jsdom has no WebGL context; canvas pixel assertions are infeasible without a headless browser | Open app → load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → click "Animation Viewer" → confirm character appears + animates + loops |
| Scrub control updates playback position in real time | VIEWER-06 (visible) | Requires real GL state mutation observable only in a real browser | Drag scrub slider mid-animation; confirm character pose updates synchronously with slider position |
| GL context releases on close (no leak) | VIEWER-08 (real-leak) | Real leak detection requires `chrome://gpu-internals` or DevTools Memory profiling, not jsdom | Open viewer → close → reopen 10x; in DevTools Performance Monitor, confirm GPU memory does not climb monotonically. Then load a different project; confirm viewer closes if open. |
| Real-FS errors surface as terminal in-modal copy | VIEWER-09 (real-fs) | The unit spec mocks `SpinePlayer` errors; manual test confirms the player itself produces the expected error path against a corrupted on-disk fixture | Edit `SIMPLE_TEST.json` to invalid JSON → open viewer → confirm error copy + Close-only state. Restore, then delete a page PNG → confirm same. Restore, then break a path in `.atlas` → confirm same. |
| Atlas-less mode renders correctly | VIEWER-03 (atlas-less branch) | Synthetic-atlas integration end-to-end requires a real renderer + main IPC roundtrip; vitest stubs the IPC | Load a project in atlas-less mode (`.json + images/` folder, no `.atlas`) → open viewer → confirm character renders against the synthesized atlas with no visible differences from atlas-source mode |
| Cross-platform parity (Windows) | All VIEWER-* | App-image scheme handler historical drive-letter bug + per memory `feedback_platform_divergent_check_stale_build` | macOS verification + Windows verification both required before `/gsd-ship`; if Windows-only failure surfaces, wipe `dist/` + `.vite/` + `out/` before suspecting source |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
