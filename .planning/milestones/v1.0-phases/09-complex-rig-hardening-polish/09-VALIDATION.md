---
phase: 9
slug: complex-rig-hardening-polish
status: ready-for-uat
nyquist_compliant: true
wave_0_complete: true
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

| # | Plan target | Wave | Plan ID | Requirement / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|---|-------------|------|---------|------------------------|----------|-----------|-------------------|-------------|--------|
| 1 | sampler-worker | 1 | 09-02 | **N2.2** | `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` wall-time < 8000 ms (margin from 10000 ms gate) | integration | `vitest run tests/main/sampler-worker-girl.spec.ts` | ✅ Wave 0 + Wave 1 | ✅ green |
| 2 | sampler-worker | 1 | 09-02 | **D-190 / D-193** | Worker spawns; `sampleSkeleton` over SIMPLE_PROJECT returns Map-key-parity + peakScale within `PEAK_EPSILON` vs in-thread call | integration | `vitest run tests/main/sampler-worker.spec.ts -t "byte-identical"` | ✅ | ✅ green |
| 3 | sampler-worker | 1 | 09-02 | **D-194 progress** | Worker emits `{type:'progress', percent:0}` on start and `100` (or `complete`) on finish; ordering preserved on subscriber | unit | `vitest run tests/main/sampler-worker.spec.ts -t "progress"` | ✅ | ✅ green |
| 4 | sampler-worker | 1 | 09-02 | **D-194 cancel ≤200 ms** | After `worker.terminate()`, exit-event resolves within 200 ms | integration | `vitest run tests/main/sampler-worker.spec.ts -t "cancel"` | ✅ | ✅ green |
| 5 | sampler-worker | 1 | 09-02 | **D-194 error** | Worker reports `{type:'error', error: SerializableError}` when `skeletonPath` is missing/unreadable | unit | `vitest run tests/main/sampler-worker.spec.ts -t "error"` | ✅ | ✅ green |
| 6 | sampler-worker | 1 | 09-02 | **Layer 3** | `src/main/sampler-worker.ts` does not import from `src/renderer/`, `react`, `electron`, or DOM globals | hygiene grep | `vitest run tests/arch.spec.ts -t "sampler-worker"` | ✅ Wave 0 + Wave 1 | ✅ green |
| 7 | ipc | 1 | 09-02 | **D-194 IPC** | `'sampler:progress'` registered on `ipcMain` (payload `{percent:number}`); `'sampler:cancel'` handler registered | unit | `vitest run tests/main/ipc.spec.ts -t "sampler"` | ✅ existing (extension) | ✅ green |
| 8 | virtualization (GlobalMaxRender) | 2 | 09-03 | **D-191 / D-195 below** | 50 rows: `getAllByRole('row').length === 51` (header + 50) | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "below threshold"` | ✅ | ✅ green |
| 9 | virtualization (GlobalMaxRender) | 2 | 09-03 | **D-191 / D-195 above** | 200 rows: `getAllByRole('row').length ≤ 60` (header + window + overscan); ≥70% reduction vs naive | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "above threshold"` | ✅ | ✅ green |
| 10 | virtualization (GlobalMaxRender) | 2 | 09-03 | **D-191 sort/search/checkbox preserved** | Click sort header / type in search / toggle checkbox all work in virtualized path | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "sort\|search\|checkbox"` | ✅ | ✅ green |
| 11 | virtualization (GlobalMaxRender) | 2 | 09-03 | **Sticky thead** | Outer scroll by 1000 px → `<thead>.getBoundingClientRect().top === 0` | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "sticky"` | ✅ | ✅ green |
| 12 | virtualization (AnimBreakdown) | 2 | 09-04 | **D-196 outer in regular DOM** | 16 cards: all 16 section elements present regardless of expand state | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "outer cards"` | ✅ | ✅ green |
| 13 | virtualization (AnimBreakdown) | 2 | 09-04 | **D-196 inner virtualization** | Expanded card with 200 rows: rendered `<tr>` count ≤ 60 (window + overscan) | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "inner above threshold"` | ✅ | ✅ green |
| 14 | virtualization (AnimBreakdown) | 2 | 09-04 | **D-196 collapse/expand** | 200-row card collapse → re-expand: filter query preserved; planner-chosen scroll-reset policy holds | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "collapse"` | ✅ | ✅ green |
| 15 | virtualization (AnimBreakdown) | 2 | 09-04 | **D-196 OverrideDialog from virtualized row** | Click "Override Scale" on virtualized inner row → OverrideDialog mounts with correct row context | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "override"` | ✅ | ✅ green |
| 16 | settings-dialog | 3/4 | 09-05+09-06 | **Settings — samplingHz** | SettingsDialog: dropdown 60/120/240 + custom; positive-int clamp; apply → AppShell `samplingHz` updates → project dirty (D-145) | renderer | `vitest run tests/renderer/settings-dialog.spec.tsx` | ✅ | ✅ green |
| 17 | rig-info tooltip | 3/4 | 09-06 | **Tooltip — fps labeling** | Hover filename chip → tooltip shows `skeleton.fps: N (editor metadata — does not affect sampling)`; counts (bones/slots/anims) match `summary` | renderer | `vitest run tests/renderer/rig-info-tooltip.spec.tsx` | ✅ | ✅ green |
| 18 | help-dialog | 3/5 | 09-05+09-07 | **Help — markdown + external links** | Help-menu click → HelpDialog mounts with content; external link click invokes `shell.openExternal` (mocked) | renderer | `vitest run tests/renderer/help-dialog.spec.tsx` | ✅ | ✅ green |

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

- [x] `tests/main/sampler-worker.spec.ts` — D-190 / D-193 / D-194 cases (a-d) + Worker spawn smoke
- [x] `tests/main/sampler-worker-girl.spec.ts` — N2.2 wall-time gate (8000 ms budget; warm-up; `.skipIf(env.CI)` allowed)
- [x] `tests/renderer/global-max-virtualization.spec.tsx` — D-191 / D-195 + sticky thead
- [x] `tests/renderer/anim-breakdown-virtualization.spec.tsx` — D-196 outer + inner + collapse/expand + override
- [x] `tests/renderer/settings-dialog.spec.tsx` — Settings modal + samplingHz dirty derivation
- [x] `tests/renderer/rig-info-tooltip.spec.tsx` — tooltip content + skeleton.fps labeling
- [x] `tests/renderer/help-dialog.spec.tsx` — Help dialog + `shell.openExternal` mock
- [x] `tests/arch.spec.ts` — extend with new `describe` block: "Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces"
- [x] `tests/main/ipc.spec.ts` — extend with `'sampler:progress'` and `'sampler:cancel'` registration cases

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

- [x] All Phase 9 tasks have `<automated>` verify or claim a Wave 0 dependency in `read_first` / `acceptance_criteria`
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify edge
- [x] Wave 0 covers all 18 behaviors above (the seven new test files + two extensions)
- [x] No watch-mode flags (vitest `--watch` is forbidden in CI / verification runs)
- [x] Feedback latency < 30 s (full suite) / < 5 s (slice)
- [x] `nyquist_compliant: true` set in frontmatter once all 18 rows are ✅ green

**Approval:** ready for manual UAT (Plan 09-08 Task 2)

---

## Exit Criteria Sweep — 2026-04-26

### Automated test suite

```
$ npx vitest run
Test Files  30 passed (30)
Tests       331 passed | 1 skipped | 1 todo (333)
```

Pre-Phase-9 baseline: 275 passed + 1 skipped + 1 todo. Phase 9 added +56 GREEN.

### N2.2 wall-time gate

```
[N2.2] Girl sample: 606 ms total
```

Budget: <8000 ms (margin from 10000 ms N2.2 contract). Result: **GREEN** (~13× under budget).

### Locked-file invariants (Phase 5 D-102 + Phase 8 D-145 + 8.1 D-171 + 8.1 D-165)

| File | Diff vs eb97923 |
|------|-----------------|
| src/core/sampler.ts | 0 lines |
| scripts/cli.ts | 0 lines |
| src/core/loader.ts | 0 lines |
| src/core/project-file.ts | 0 lines |
| src/renderer/src/components/DropZone.tsx | 0 lines |
| src/renderer/src/modals/SaveQuitDialog.tsx | 0 lines |

### Build

- `npx electron-vite build` exits 0
- `out/main/sampler-worker.cjs`: 4.0 KB
- `out/main/index.cjs`: 60 KB
- `out/preload/index.cjs`: 16 KB
- Total `out/` size: 920 KB

### TypeScript

- `npx tsc --noEmit -p tsconfig.web.json` — clean
- `npx tsc --noEmit -p tsconfig.node.json` — pre-existing TS2339 in `scripts/probe-per-anim.ts:14` (out of Phase 9 scope; documented in 09-01 deferred-items.md)

### CLI smoke (D-102 byte-frozen output preservation)

```
$ npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json
Attachment         Skin     Source W×H  Peak W×H       Scale  Source Animation  Frame
-----------------  -------  ----------  -------------  -----  ----------------  -----
CIRCLE/CIRCLE      default  699×699     1440.4×1411.4  2.018  PATH              27
SQUARE/SQUARE      default  1000×1000   2102.8×2102.8  1.500  PATH              0
TRIANGLE/TRIANGLE  default  833×759     1870.6×1979.1  2.000  PATH              0

Sampled in 25.4 ms at 120 Hz (4 attachments across 1 skins, 4 animations)
```

CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000 — byte-for-byte match with Phase 5 baseline.

### Phase 9 grep audit (mandatory invariants)

```bash
$ grep -rn "worker_threads\|new Worker" src/ | head -5
src/main/sampler-worker.ts:2: * Phase 9 Plan 02 — Sampler worker (Node `worker_threads`).
src/main/sampler-worker.ts:48: *   This file imports ONLY from node:worker_threads + ../core/* +
src/main/sampler-worker-bridge.ts: imports `Worker` from `node:worker_threads`

$ grep -E "from ['\"]electron['\"]|from ['\"]react['\"]" src/main/sampler-worker.ts
[empty — Layer 3 invariant clean]
```
