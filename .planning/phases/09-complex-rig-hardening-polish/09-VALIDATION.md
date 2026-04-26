---
phase: 9
slug: complex-rig-hardening-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `09-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (verified via `package.json` devDependencies) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `vitest run tests/main/sampler-worker.spec.ts tests/renderer/global-max-virtualization.spec.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 s full / ~5 s slice |

---

## Sampling Rate

- **After every task commit:** Run quick slice (`vitest run` for the touched test files; ~5 s).
- **After every plan wave:** Run `npm run test` (full suite).
- **Before `/gsd-verify-work 9`:** Full suite green INCLUDING the `fixtures/Girl` wall-time gate.
- **Max feedback latency:** 30 s.

---

## Per-Task Verification Map

> `Task ID` is filled by the planner during plan generation. The rows below define the *behaviors* that must each be claimed by at least one task. Wave 0 == the new test files listed under "Wave 0 Requirements" below.

| # | Plan target | Wave | Requirement / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|---|-------------|------|------------------------|----------|-----------|-------------------|-------------|--------|
| 1 | sampler-worker | 1 | **N2.2** | `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` wall-time < 8000 ms (margin from 10000 ms gate) | integration | `vitest run tests/main/sampler-worker-girl.spec.ts` | ❌ W0 | ⬜ pending |
| 2 | sampler-worker | 1 | **D-190 / D-193** | Worker spawns; `sampleSkeleton` over SIMPLE_PROJECT returns Map-key-parity + peakScale within `PEAK_EPSILON` vs in-thread call | integration | `vitest run tests/main/sampler-worker.spec.ts -t "byte-identical"` | ❌ W0 | ⬜ pending |
| 3 | sampler-worker | 1 | **D-194 progress** | Worker emits `{type:'progress', percent:0}` on start and `100` (or `complete`) on finish; ordering preserved on subscriber | unit | `vitest run tests/main/sampler-worker.spec.ts -t "progress"` | ❌ W0 | ⬜ pending |
| 4 | sampler-worker | 1 | **D-194 cancel ≤200 ms** | After `worker.terminate()`, exit-event resolves within 200 ms | integration | `vitest run tests/main/sampler-worker.spec.ts -t "cancel"` | ❌ W0 | ⬜ pending |
| 5 | sampler-worker | 1 | **D-194 error** | Worker reports `{type:'error', error: SerializableError}` when `skeletonPath` is missing/unreadable | unit | `vitest run tests/main/sampler-worker.spec.ts -t "error"` | ❌ W0 | ⬜ pending |
| 6 | sampler-worker | 1 | **Layer 3** | `src/main/sampler-worker.ts` does not import from `src/renderer/`, `react`, `electron`, or DOM globals | hygiene grep | `vitest run tests/arch.spec.ts -t "sampler-worker"` | ❌ W0 (new describe block) | ⬜ pending |
| 7 | ipc | 1 | **D-194 IPC** | `'sampler:progress'` registered on `ipcMain` (payload `{percent:number}`); `'sampler:cancel'` handler registered | unit | `vitest run tests/main/ipc.spec.ts -t "sampler"` | ✅ existing (extension) | ⬜ pending |
| 8 | virtualization (GlobalMaxRender) | 2 | **D-191 / D-195 below** | 50 rows: `getAllByRole('row').length === 51` (header + 50) | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "below threshold"` | ❌ W0 | ⬜ pending |
| 9 | virtualization (GlobalMaxRender) | 2 | **D-191 / D-195 above** | 200 rows: `getAllByRole('row').length ≤ 60` (header + window + overscan); ≥70% reduction vs naive | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "above threshold"` | ❌ W0 | ⬜ pending |
| 10 | virtualization (GlobalMaxRender) | 2 | **D-191 sort/search/checkbox preserved** | Click sort header / type in search / toggle checkbox all work in virtualized path | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "sort\|search\|checkbox"` | ❌ W0 | ⬜ pending |
| 11 | virtualization (GlobalMaxRender) | 2 | **Sticky thead** | Outer scroll by 1000 px → `<thead>.getBoundingClientRect().top === 0` | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "sticky"` | ❌ W0 | ⬜ pending |
| 12 | virtualization (AnimBreakdown) | 2 | **D-196 outer in regular DOM** | 16 cards: all 16 section elements present regardless of expand state | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "outer cards"` | ❌ W0 | ⬜ pending |
| 13 | virtualization (AnimBreakdown) | 2 | **D-196 inner virtualization** | Expanded card with 200 rows: rendered `<tr>` count ≤ 60 (window + overscan) | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "inner above threshold"` | ❌ W0 | ⬜ pending |
| 14 | virtualization (AnimBreakdown) | 2 | **D-196 collapse/expand** | 200-row card collapse → re-expand: filter query preserved; planner-chosen scroll-reset policy holds | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "collapse"` | ❌ W0 | ⬜ pending |
| 15 | virtualization (AnimBreakdown) | 2 | **D-196 OverrideDialog from virtualized row** | Click "Override Scale" on virtualized inner row → OverrideDialog mounts with correct row context | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "override"` | ❌ W0 | ⬜ pending |
| 16 | settings-dialog | 3 | **Settings — samplingHz** | SettingsDialog: dropdown 60/120/240 + custom; positive-int clamp; apply → AppShell `samplingHz` updates → project dirty (D-145) | renderer | `vitest run tests/renderer/settings-dialog.spec.tsx` | ❌ W0 | ⬜ pending |
| 17 | rig-info tooltip | 3 | **Tooltip — fps labeling** | Hover filename chip → tooltip shows `skeleton.fps: N (editor metadata — does not affect sampling)`; counts (bones/slots/anims) match `summary` | renderer | `vitest run tests/renderer/rig-info-tooltip.spec.tsx` | ❌ W0 | ⬜ pending |
| 18 | help-dialog | 3 | **Help — markdown + external links** | Help-menu click → HelpDialog mounts with content; external link click invokes `shell.openExternal` (mocked) | renderer | `vitest run tests/renderer/help-dialog.spec.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## DOM-Count Assertion Thresholds (precise bounds)

- **GlobalMaxRender below (50 rows):** `getAllByRole('row').length === 51` — exact match.
- **GlobalMaxRender above (200 rows):** `getAllByRole('row').length ≤ 60` — header + ≤59 rendered rows; conservative bound for `overscan: 20` + ~20 visible window.
- **AnimationBreakdown outer (16 cards, all collapsed):** all 16 `<section>` (or `aria-labelledby`-keyed) elements present in DOM.
- **AnimationBreakdown inner (1 card expanded, 200 rows):** within the expanded card's body, `<tr>` count ≤ 60.

---

## Cancellation Latency Budget

- **Hard budget:** ≤ 200 ms (D-194).
- **Test assertion:** `performance.now() - terminateStart < 200` after `await worker.terminate()` resolves.
- **Empirical margin:** Node 22 LTS typically resolves `worker.terminate()` <50 ms for JS-bound workers — 200 ms gives ~4× margin against thermal throttling.

---

## N2.2 Wall-Time Budget (Girl gate)

- **Contract (REQUIREMENTS.md N2.2):** < 10000 ms wall time on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`.
- **Test budget:** < 8000 ms (2000 ms margin).
- **Warm-up:** 1 discarded run BEFORE the timed run (JIT + worker spawn).
- **CI policy:** `.skipIf(env.CI)` permitted if empirical CI variance exceeds budget; the LOCAL `npm run test` gate is non-negotiable.

---

## Wave 0 Requirements

- [ ] `tests/main/sampler-worker.spec.ts` — D-190 / D-193 / D-194 cases (a-d) + Worker spawn smoke
- [ ] `tests/main/sampler-worker-girl.spec.ts` — N2.2 wall-time gate (8000 ms budget; warm-up; `.skipIf(env.CI)` allowed)
- [ ] `tests/renderer/global-max-virtualization.spec.tsx` — D-191 / D-195 + sticky thead
- [ ] `tests/renderer/anim-breakdown-virtualization.spec.tsx` — D-196 outer + inner + collapse/expand + override
- [ ] `tests/renderer/settings-dialog.spec.tsx` — Settings modal + samplingHz dirty derivation
- [ ] `tests/renderer/rig-info-tooltip.spec.tsx` — tooltip content + skeleton.fps labeling
- [ ] `tests/renderer/help-dialog.spec.tsx` — Help dialog + `shell.openExternal` mock
- [ ] `tests/arch.spec.ts` — extend with new `describe` block: "Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces"
- [ ] `tests/main/ipc.spec.ts` — extend with `'sampler:progress'` and `'sampler:cancel'` registration cases

**Framework install:** none — `vitest` + `@testing-library/react` already in devDependencies. `@tanstack/react-virtual` is the one new runtime dependency (D-192).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Indeterminate sampling spinner UX | D-194 (research §Open question 4) | Subjective UX feel — does the spinner read as "working" rather than "frozen" during the 5-10 s wait? | Run `npm run dev`; load `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`; observe AppShell spinner during sampling; confirm no UI freeze |
| No dropped UI frames during sampling | ROADMAP exit criterion | Frame-drop measurement requires DevTools Performance tab, not automatable in vitest | Run `npm run dev`; open DevTools → Performance; record while loading Girl fixture; confirm < 3 dropped frames during sampling window |
| User-supplied production rig (stretch) | D-189 deferred | User's own rig may exceed Girl in size; gate is informational not blocking | Drop user's `.json + .atlas + .png` into a temp folder; load via Cmd+O; sampling completes < 10 s |
| Settings modal accelerator (`Cmd/Ctrl+,`) | Claude's Discretion | Cross-platform menu accelerator triggering requires real OS event loop | macOS: press `Cmd+,` in app — Settings opens. Win/Linux: press `Ctrl+,` — Settings opens |
| Help dialog external links | Claude's Discretion | `shell.openExternal` is mocked in tests; real handoff to OS browser is OS-mediated | Open Help dialog; click external link (e.g., Spine docs); confirm system browser opens |

---

## Validation Sign-Off

- [ ] All Phase 9 tasks have `<automated>` verify or claim a Wave 0 dependency in `read_first` / `acceptance_criteria`
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify edge
- [ ] Wave 0 covers all 18 behaviors above (the seven new test files + two extensions)
- [ ] No watch-mode flags (vitest `--watch` is forbidden in CI / verification runs)
- [ ] Feedback latency < 30 s (full suite) / < 5 s (slice)
- [ ] `nyquist_compliant: true` set in frontmatter once all 18 rows are ✅ green

**Approval:** pending
