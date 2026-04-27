---
phase: 09-complex-rig-hardening-polish
verified: 2026-04-26T22:30:00Z
status: passed
score: 5/5 ROADMAP deliverables verified + 5/5 UAT reproducers signed off
re_verification: false
baseline_commit: eb97923
verified_at_head: 353f281
n2_2_wall_time_actual_ms: 608
n2_2_wall_time_budget_ms: 8000
n2_2_contract_ms: 10000
locked_file_invariants_clean: true
test_count_delta: "275 -> 331 (+56 GREEN)"
---

# Phase 9: Complex-rig hardening + polish — Verification Report

**Phase Goal (from ROADMAP.md:333-355):**
> Sampler offloaded to `worker_threads` Worker (D-190 unconditional, D-193 path-based protocol, D-194 progress + cancel via terminate); UI virtualization in BOTH panels via TanStack Virtual at threshold N=100 (D-191/D-192/D-195/D-196); SettingsDialog under Edit→Preferences (Cmd/Ctrl+,) exposing samplingHz with re-sample on change; rig-info tooltip on the filename chip showing `skeleton.fps: N (editor metadata — does not affect sampling)` aligned to sampler.ts:41-44; HelpDialog under Help→Documentation with 7 canonical static React sections + allow-listed external links.

**Exit Criteria:**
1. `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` samples in <10 s (test enforces <8000 ms with 2000 ms margin)
2. No dropped UI frames during sampling (manual UAT)

**Verified at:** HEAD `353f281` against baseline `eb97923` (post-08.2 close-out).
**Status:** PASS — all 5 ROADMAP deliverables shipped, exit criteria GREEN, locked-file invariants clean, manual UAT signed off.

---

## Goal Achievement — Five Observable Truths

| #   | Truth                                                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sampler runs in a Node `worker_threads` worker (D-190 unconditional, D-193 path-based protocol, D-194 progress + cancel)                | ✓ VERIFIED | `src/main/sampler-worker.ts:60` imports `parentPort, workerData from 'node:worker_threads'`; `src/main/sampler-worker-bridge.ts:25` imports `Worker from 'node:worker_threads'`; `runSamplerInWorker` called at `src/main/project-io.ts:452,678,819` (3 sites — Open, recovery reload, resample). |
| 2   | Both panels virtualize via TanStack Virtual at N=100 threshold (D-191/D-192/D-195 GlobalMax; D-196 AnimBreakdown per-card inner)       | ✓ VERIFIED | `package.json:23` declares `"@tanstack/react-virtual": "^3.13.24"`; `GlobalMaxRenderPanel.tsx:75` `VIRTUALIZATION_THRESHOLD = 100`, `:609` `useVirtual = sorted.length > 100`, `:620` `useVirtualizer({...})`; `AnimationBreakdownPanel.tsx:96/634/647` mirrored with `measureElement` (variable height). |
| 3   | SettingsDialog under Edit→Preferences (Cmd/Ctrl+,) exposes samplingHz; change re-samples                                               | ✓ VERIFIED | `src/main/index.ts:251-254` Preferences… menu item with `accelerator: 'CommandOrControl+,'` firing `menu:settings-clicked`; `SettingsDialog.tsx` real component (244 lines) with 60/120/240/Custom dropdown + validation + clamp at 1000 Hz; `ipc.ts:635` `project:resample` handle wired to `handleProjectResample` at `project-io.ts:753`; `AppShell.tsx:849` subscribes via `onMenuSettings`. |
| 4   | Rig-info tooltip on filename chip shows `skeleton.fps: N (editor metadata — does not affect sampling)` aligned to sampler.ts:41-44     | ✓ VERIFIED | `AppShell.tsx:1009-1043` renders `data-testid="rig-info-host"` div with `role="tooltip"`; line 1040: literal template `` `skeleton.fps: ${effectiveSummary.editorFps} (editor metadata — does not affect sampling)` ``; `summary.ts:113` surfaces `editorFps: load.editorFps` (loader.ts:225-229); `shared/types.ts:488` declares `editorFps: number`. |
| 5   | HelpDialog under Help→Documentation has 7 canonical sections + allow-listed external links                                              | ✓ VERIFIED | `main/index.ts:267-274` `role: 'help'` submenu with Documentation item firing `menu:help-clicked`; `HelpDialog.tsx` 238 lines with 7 numbered `<section>` blocks (1-7); 3 hardcoded URL constants (`SPINE_RUNTIMES_URL`, `SPINE_API_REF_URL`, `SPINE_JSON_FORMAT_URL`); `ipc.ts:131-138` `SHELL_OPEN_EXTERNAL_ALLOWED` Set contains exactly those 3 URLs; `ipc.ts:593-602` validates payload + allow-list before `shell.openExternal`. |

**Score: 5/5 truths VERIFIED.**

---

## Required Artifacts — Substantive + Wired Check

| Artifact                                                | Expected                                          | Exists | Substantive | Wired | Status     |
| ------------------------------------------------------- | ------------------------------------------------- | ------ | ----------- | ----- | ---------- |
| `src/main/sampler-worker.ts`                            | Worker entrypoint + `runSamplerJob` extract       | ✓      | ✓ 178 lines | ✓     | ✓ VERIFIED |
| `src/main/sampler-worker-bridge.ts`                     | `runSamplerInWorker` + `getSamplerWorkerHandle`   | ✓      | ✓ 127 lines | ✓     | ✓ VERIFIED |
| `src/renderer/src/modals/SettingsDialog.tsx`            | samplingHz dropdown + clamp + validation         | ✓      | ✓ 244 lines | ✓     | ✓ VERIFIED |
| `src/renderer/src/modals/HelpDialog.tsx`                | 7 sections + 3 external link buttons              | ✓      | ✓ 238 lines | ✓     | ✓ VERIFIED |
| `src/main/ipc.ts` `sampler:cancel` + `shell:open-external` + `project:resample` | 3 new IPC channels                              | ✓      | ✓           | ✓     | ✓ VERIFIED |
| `src/preload/index.ts` onSamplerProgress / cancelSampler / onMenuSettings / onMenuHelp / openExternalUrl / resampleProject | 6 new contextBridge methods | ✓ | ✓ | ✓ | ✓ VERIFIED |
| `tests/main/sampler-worker.spec.ts`                     | byte-identical + progress + cancel + error + spawn smoke | ✓ | ✓ 169 lines | ✓ | ✓ VERIFIED |
| `tests/main/sampler-worker-girl.spec.ts`                | N2.2 wall-time gate <8000 ms                      | ✓      | ✓ 63 lines  | ✓     | ✓ VERIFIED |
| `tests/renderer/global-max-virtualization.spec.tsx`     | Threshold tests + sticky thead                    | ✓      | ✓ 8.4 KB    | ✓     | ✓ VERIFIED |
| `tests/renderer/anim-breakdown-virtualization.spec.tsx` | Outer DOM + inner virt + collapse + Override      | ✓      | ✓ 13 KB     | ✓     | ✓ VERIFIED |
| `tests/renderer/settings-dialog.spec.tsx`               | Modal + validation + dirty derivation             | ✓      | ✓ 4.3 KB    | ✓     | ✓ VERIFIED |
| `tests/renderer/rig-info-tooltip.spec.tsx`              | Tooltip wording + counts                          | ✓      | ✓ 4.9 KB    | ✓     | ✓ VERIFIED |
| `tests/renderer/help-dialog.spec.tsx`                   | 7 sections + openExternal mock                    | ✓      | ✓ 5.1 KB    | ✓     | ✓ VERIFIED |

---

## Key Link Verification

| From                                                    | To                                                      | Via                                                                            | Status   | Detail                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-io.ts` (handleProjectOpenFromPath et al.)      | `sampler-worker.ts`                                     | `runSamplerInWorker(...)` at lines 452, 678, 819 (no direct `sampleSkeleton`)  | WIRED    | `grep "sampleSkeleton\b" src/main/project-io.ts` shows ONLY comment references; the actual call moved into the worker (`sampler-worker.ts:111`). Confirmed no fallback in-thread sampling path remains in main.                                                |
| `sampler-worker.ts`                                     | `src/core/sampler.ts`                                   | `import { sampleSkeleton } from '../core/sampler.js'` at line 62               | WIRED    | The byte-frozen sampler is wrapped, never modified.                                                                                                                                                                                                            |
| `sampler-worker-bridge.ts`                              | `mainWindow.webContents`                                | `webContents?.send('sampler:progress', msg.percent)` at line 99                | WIRED    | Progress events flow main → renderer via the existing `'sampler:progress'` channel.                                                                                                                                                                            |
| `AppShell.tsx`                                          | `sampler:progress`                                      | `window.api.onSamplerProgress((percent) => ...)` at line 800                   | WIRED    | Progress event toggles `samplingInFlight` (indeterminate spinner per RESEARCH §Q4).                                                                                                                                                                            |
| `AppShell.tsx`                                          | `sampler:cancel`                                        | `window.api.cancelSampler()` at line 677 (in onClickOpen)                      | WIRED    | Mid-sample Cmd+O pre-empts via terminate(); `ipc.ts:565-570` calls `getSamplerWorkerHandle()?.terminate()`.                                                                                                                                                    |
| Edit→Preferences menu                                    | SettingsDialog                                          | `menu:settings-clicked` (main:253) → `onMenuSettings` (preload:354) → `setSettingsOpen(true)` (AppShell:849) | WIRED    | Cross-platform via `accelerator: 'CommandOrControl+,'`.                                                                                                                                                                                                        |
| SettingsDialog onApply                                   | re-sample                                                | `setLocalSamplingHz` → `useEffect` re-sample → `window.api.resampleProject(...)` → `project:resample` IPC → `handleProjectResample` → `runSamplerInWorker` | WIRED    | Full re-sample chain; `resampleSkipMount` ref skips the initial mount run (RESEARCH §Pitfall 7).                                                                                                                                                                |
| Help→Documentation menu                                  | HelpDialog                                              | `menu:help-clicked` (main:271) → `onMenuHelp` (preload:367) → `setHelpOpen(true)` (AppShell:863) | WIRED    | macOS Help-menu search comes free with `role: 'help'`.                                                                                                                                                                                                         |
| HelpDialog external link buttons                         | system browser                                           | `window.api.openExternalUrl(url)` (HelpDialog:86) → `shell:open-external` IPC → allow-list check → `shell.openExternal` | WIRED    | `SHELL_OPEN_EXTERNAL_ALLOWED` (ipc.ts:131-138) contains exactly the 3 URLs HelpDialog references; non-matching URLs silently dropped (T-09-05-OPEN-EXTERNAL).                                                                                                  |
| Filename chip hover                                      | rig-info tooltip                                         | `onMouseEnter`/`onMouseLeave` toggle `rigInfoOpen` (AppShell:1011-1012); tooltip renders `effectiveSummary.editorFps` from `summary.ts:113` (which reads `load.editorFps` from `loader.ts:225-229`) | WIRED    | Full data-flow path verified; the skeleton.fps line is a literal string interpolation matching sampler.ts:41-44 verbatim.                                                                                                                                       |

---

## Data-Flow Trace (Level 4)

| Artifact                                | Data Variable    | Source                                                                | Produces Real Data | Status      |
| --------------------------------------- | ---------------- | --------------------------------------------------------------------- | ------------------ | ----------- |
| GlobalMaxRenderPanel virtualized rows   | `sorted`         | Built from `summary.peaks` (real sampler output)                      | ✓                  | ✓ FLOWING   |
| AnimationBreakdownPanel inner rows      | per-card `rows`  | Built from `summary.perAnimation` (real sampler output)               | ✓                  | ✓ FLOWING   |
| Rig-info tooltip skeleton.fps           | `effectiveSummary.editorFps` | `loader.ts:225-229` `editorFps = skeletonData.fps \|\| 30`     | ✓                  | ✓ FLOWING   |
| Indeterminate spinner state             | `samplingInFlight`| Toggled by `sampler:progress` 0/100 from real worker                 | ✓                  | ✓ FLOWING   |
| HelpDialog content                       | static JSX       | Authored content (zero markdown library — RESEARCH §Recommendations #4) | ✓                  | ✓ FLOWING   |

No HOLLOW props, no DISCONNECTED data sources.

---

## Behavioral Spot-Checks

| Behavior                                                                       | Command                                                                                            | Result                                                                                                                                                                          | Status |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Full vitest suite passes                                                       | `npx vitest run`                                                                                   | `Test Files 30 passed (30) / Tests 331 passed \| 1 skipped \| 1 todo (333) / Duration 3.36s`                                                                                     | ✓ PASS |
| N2.2 wall-time gate                                                            | `npx vitest run tests/main/sampler-worker-girl.spec.ts`                                            | `[N2.2] Girl sample: 608 ms total` (budget 8000 ms; ~13× under)                                                                                                                  | ✓ PASS |
| TypeScript web project clean                                                   | `npx tsc --noEmit -p tsconfig.web.json`                                                            | exit 0, no output                                                                                                                                                                | ✓ PASS |
| TypeScript node project (pre-existing TS2339 documented)                       | `npx tsc --noEmit -p tsconfig.node.json`                                                           | one pre-existing error: `scripts/probe-per-anim.ts(14,31): TS2339 Property 'values' does not exist on type 'SamplerOutput'` — confirmed pre-existing in `deferred-items.md` and not Phase 9 scope | ⚠️ KNOWN-DEFERRED |
| Production build emits sampler-worker bundle                                   | `npx electron-vite build`                                                                          | `out/main/sampler-worker.cjs (1.79 kB)`, `out/main/index.cjs (58.10 kB)`, `out/preload/index.cjs (14.69 kB)`; build exits 0                                                       | ✓ PASS |
| CLI byte-frozen output preserved (D-102)                                       | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`                                          | CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000 — byte-identical to Phase 5 baseline; sampling 22.4 ms at 120 Hz                                                                     | ✓ PASS |
| Layer 3 invariant — sampler-worker has no DOM/electron imports                 | `grep -E "from ['\"]electron['\"]|from ['\"]react['\"]" src/main/sampler-worker.ts`               | empty output                                                                                                                                                                     | ✓ PASS |
| Sampler-worker spawn smoke (real Worker against built bundle)                  | bundled in `tests/main/sampler-worker.spec.ts` "Wave 1 spawn smoke" describe block                 | passes via `new Worker(WORKER_BUNDLE)` against `out/main/sampler-worker.cjs` (post-build)                                                                                        | ✓ PASS |

---

## Locked-File Invariant Check (D-102 + D-145 + D-165 + D-171)

`git diff eb97923..353f281 -- <file> | wc -l` for each:

| File                                            | Diff lines | Status   |
| ----------------------------------------------- | ---------- | -------- |
| `src/core/sampler.ts`                           | 0          | ✓ CLEAN  |
| `scripts/cli.ts`                                | 0          | ✓ CLEAN  |
| `src/core/loader.ts`                            | 0          | ✓ CLEAN  |
| `src/core/project-file.ts`                      | 0          | ✓ CLEAN  |
| `src/renderer/src/components/DropZone.tsx`      | 0          | ✓ CLEAN  |
| `src/renderer/src/modals/SaveQuitDialog.tsx`    | 0          | ✓ CLEAN  |

All 6 locked files: **0 lines of diff** — D-102 byte-frozen invariants preserved.

---

## N2.2 Exit Gate — Confirmation

| Item                                | Value                                                  |
| ----------------------------------- | ------------------------------------------------------ |
| **Contract** (REQUIREMENTS.md N2.2) | <10000 ms wall time on `fixtures/Girl/...JOKER.json`   |
| **Test budget** (with 2000 ms margin) | <8000 ms                                              |
| **Actual measured (this verification run, warm)** | **608 ms**                                |
| **Margin from budget**              | ~13× under                                              |
| **Margin from contract**            | ~16× under                                              |
| **Warm-up policy**                   | 1 discarded warm-up run before timed run               |
| **Test file**                       | `tests/main/sampler-worker-girl.spec.ts:27-62`         |
| **Status**                          | ✓ GREEN                                                 |

---

## Test Count Delta — Confirmation

| Snapshot               | Test Files | Tests passed | Skipped | Todo | Total |
| ---------------------- | ---------- | ------------ | ------- | ---- | ----- |
| Pre-Phase-9 (baseline) | (~21)      | 275          | 1       | 1    | 277   |
| Post-Phase-9 (HEAD)    | 30         | 331          | 1       | 1    | 333   |
| **Delta**              | +9         | **+56**      | 0       | 0    | +56   |

7 new spec files + 2 extensions (ipc.spec.ts, arch.spec.ts) match the +56 GREEN target.

---

## Requirements Coverage

| Requirement | Source                            | Description                                                                                          | Status      | Evidence                                                                                                       |
| ----------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| N2.2        | REQUIREMENTS.md `### N2`           | Complex rig (~80 attachments, ~16 animations) samples in <10 s                                       | ✓ SATISFIED | fixtures/Girl wall-time = 608 ms (vs 10000 ms contract); enforced by `tests/main/sampler-worker-girl.spec.ts`. |
| N2.3        | REQUIREMENTS.md `### N2` (preserved invariant) | Sampler hot loop does zero filesystem I/O                                                | ✓ SATISFIED | Worker performs `loadSkeleton` ONCE before the sampler loop; sampleSkeleton itself unchanged (D-102).          |
| Usability polish | ROADMAP.md:357                | Settings modal + tooltip + help button                                                                | ✓ SATISFIED | All 3 Claude's-Discretion deliverables shipped per CONTEXT.md §Suggested defaults.                              |

---

## Anti-Patterns Found

Scanned modified Phase 9 files for stubs / placeholders / TODOs.

| File                                            | Line | Pattern                                              | Severity | Impact |
| ----------------------------------------------- | ---- | ---------------------------------------------------- | -------- | ------ |
| (none)                                          | —    | No `TODO` / `FIXME` / `placeholder` / `coming soon` strings found in any Phase 9 production source file | —        | —      |

(`grep -rn "TODO\|FIXME\|placeholder" src/main/sampler-worker.ts src/main/sampler-worker-bridge.ts src/renderer/src/modals/SettingsDialog.tsx src/renderer/src/modals/HelpDialog.tsx` — empty results in production code; the only `placeholder` occurrence is in comment text describing 08.2 D-188 history.)

---

## Manual UAT Sign-Off

Per Plan 09-08 Task 2 (`checkpoint:human-verify` gate), 5 reproducers were walked through in a real Electron run:

1. **Reproducer 1 — N2.2 wall-time**: fixtures/Girl loads + samples within budget; indeterminate spinner shows; no UI freeze. ✓ PASS
2. **Reproducer 2 — Both panels virtualize**: GlobalMax + AnimBreakdown render ≤60 `<tr>` at any scroll; sticky thead intact; sort/search/checkbox preserved. ✓ PASS
3. **Reproducer 3 — Settings modal triggers re-sample**: Cmd/Ctrl+, opens dialog; samplingHz change dispatches re-sample; project saves with new rate. ✓ PASS
4. **Reproducer 4 — Rig-info tooltip wording**: `skeleton.fps: <N> (editor metadata — does not affect sampling)` matches sampler.ts:41-44 verbatim. ✓ PASS
5. **Reproducer 5 — Help dialog → external link**: HelpDialog opens with 7 sections; clicking Spine docs link opens system browser via allow-list. ✓ PASS

**Sign-off recorded in commit `353f281` body**: *"Manual UAT signed off 2026-04-26 — 5 reproducers PASS."*

---

## Gaps Found

**None.**

All 5 ROADMAP deliverables shipped. All exit criteria green. All locked-file invariants preserved. All requirements satisfied. The single TS2339 in `scripts/probe-per-anim.ts:14` is pre-existing (confirmed via `git stash` test against `6236a2f` per `deferred-items.md`) and explicitly out of Phase 9 scope.

---

## Summary

Phase 9 ("Complex-rig hardening + polish") delivers exactly what the ROADMAP and CONTEXT specify, verified codebase-side rather than SUMMARY-side:

- **Worker offloading is real.** `src/main/sampler-worker.ts` imports `node:worker_threads`; the bridge spawns a real Worker against the built bundle; project-io's three sample call sites all dispatch through `runSamplerInWorker`. No in-thread sampler call remains in main.
- **Virtualization is real and threshold-gated.** Both panels import `useVirtualizer` from `@tanstack/react-virtual` and gate at `length > 100`. AnimationBreakdownPanel virtualizes per-card inner rows only (D-196), preserving the variable-height-outer-list constraint.
- **SettingsDialog and HelpDialog are substantive.** 244 lines and 238 lines respectively — not placeholders. Validation, clamp at 1000 Hz, focus trap, role="dialog" / aria-modal="true" auto-suppression of File menu all wired.
- **Rig-info tooltip wording is load-bearing.** Literal template at `AppShell.tsx:1040` reads `` `skeleton.fps: ${effectiveSummary.editorFps} (editor metadata — does not affect sampling)` `` — matches sampler.ts:41-44 and CLAUDE.md fact #1 verbatim.
- **N2.2 exit gate is comfortably GREEN.** Measured 608 ms vs 8000 ms test budget vs 10000 ms contract — 13× margin under budget.
- **Locked-file invariants are clean.** All 6 D-102/D-145/D-165/D-171-locked files have 0 lines of diff vs `eb97923`.
- **Manual UAT signed off** in commit body 2026-04-26.

---

**OVERALL: PASS**

_Verified: 2026-04-26T22:30:00Z_
_Verifier: Claude (gsd-verifier, goal-backward verification against codebase, not SUMMARY claims)_
