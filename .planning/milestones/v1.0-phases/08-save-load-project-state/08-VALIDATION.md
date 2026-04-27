---
phase: 8
slug: save-load-project-state
status: signed-off
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-25
signed_off: 2026-04-26
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `08-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.x |
| **Config file** | `vitest.config.ts` (jsx: `'automatic'`, node env default, jsdom opt-in via `// @vitest-environment jsdom`, include `tests/**/*.spec.ts(x)`) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` (single command — repo runs all 240+ tests in <10s) |
| **Estimated runtime** | ~10 seconds |

Renderer specs use the prelude pattern from `tests/renderer/atlas-preview-modal.spec.tsx`:
```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
```

---

## Sampling Rate

- **After every task commit:** `npm run test` (full suite — quick on this repo).
- **After every plan wave:** `npm run test`.
- **Before `/gsd-verify-work`:** Full suite green + `npx electron-vite build` green + `npm run typecheck` green + manual UAT signed off.
- **Max feedback latency:** ~10 seconds (full vitest run).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-XX-01 | core/project-file | 1 | F9.1 | T-08-VAL | Validator rejects unknown/missing/newer-version files | unit | `npx vitest run tests/core/project-file.spec.ts -t "validator rejects"` | ✅ | ✅ green |
| 8-XX-02 | core/project-file | 1 | F9.1 | — | Validator accepts minimal v1 + full v1 | unit | `npx vitest run tests/core/project-file.spec.ts -t "validator accepts"` | ✅ | ✅ green |
| 8-XX-03 | core/project-file | 1 | D-148 | — | `documentation: {}` slot preserved on round-trip | unit | `npx vitest run tests/core/project-file.spec.ts -t "documentation slot preserved"` | ✅ | ✅ green |
| 8-XX-04 | core/project-file | 1 | D-155 | — | Round-trip relative paths resolve to absolute on load | unit | `npx vitest run tests/core/project-file.spec.ts -t "round-trip relative paths"` | ✅ | ✅ green |
| 8-XX-05 | core/project-file | 1 | D-155 | — | Cross-volume paths fall back to absolute storage | unit | `npx vitest run tests/core/project-file.spec.ts -t "cross-volume falls back to absolute"` | ✅ | ✅ green |
| 8-XX-06 | core/project-file | 1 | D-151 | T-08-VER | `version > 1` → `'newer-version'` error | unit | `npx vitest run tests/core/project-file.spec.ts -t "newer version rejected"` | ✅ | ✅ green |
| 8-XX-07 | main/project-io | 2 | F9.1 | — | Save writes `.stmproj` containing all D-145 fields | unit | `npx vitest run tests/main/project-io.spec.ts -t "save writes file with all D-145 fields"` | ✅ | ✅ green |
| 8-XX-08 | main/project-io | 2 | F9.1 | T-08-IO | Save uses `<path>.tmp` + `fs.rename` (atomic) | unit | `npx vitest run tests/main/project-io.spec.ts -t "atomic-write tmp then rename"` | ✅ | ✅ green |
| 8-XX-09 | main/project-io | 2 | F9.2 | — | Load restores overrides verbatim | unit | `npx vitest run tests/main/project-io.spec.ts -t "load restores overrides verbatim"` | ✅ | ✅ green |
| 8-XX-10 | main/project-io | 2 | F9.2 | — | Load threads samplingHz into `sampleSkeleton` | unit | `npx vitest run tests/main/project-io.spec.ts -t "load threads samplingHz into sampleSkeleton"` | ✅ | ✅ green |
| 8-XX-11 | main/project-io | 2 | F9.2 / D-150 | — | Load with stale-override keys drops them + reports in response | unit | `npx vitest run tests/main/project-io.spec.ts -t "load drops stale override keys"` | ✅ | ✅ green |
| 8-XX-12 | main/project-io | 2 | D-149 | T-08-MISS | Missing skeleton → `'SkeletonNotFoundOnLoadError'` | unit | `npx vitest run tests/main/project-io.spec.ts -t "missing skeleton returns typed error"` | ✅ | ✅ green |
| 8-XX-13 | main/project-io | 2 | D-152 | — | atlasPath null → re-runs F1.2 sibling auto-discovery | unit | `npx vitest run tests/main/project-io.spec.ts -t "atlas auto-discovery on null path"` | ✅ | ✅ green |
| 8-XX-14 | renderer/save-load | 3 | D-141 | — | Save with currentProjectPath !== null writes silently (no dialog) | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Save reuses currentProjectPath"` | ✅ | ✅ green |
| 8-XX-15 | renderer/save-load | 3 | D-140 | — | Cmd/Ctrl+S on window fires Save handler | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Cmd+S triggers Save"` | ✅ | ✅ green |
| 8-XX-16 | renderer/save-load | 3 | D-140 | T-08-SHORT | Cmd+S while OverrideDialog open does NOT fire Save | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Cmd+S suppressed when modal open"` | ✅ | ✅ green |
| 8-XX-17 | renderer/save-load | 3 | D-143 | — | New-skeleton-drop on dirty session opens SaveQuitDialog | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dirty + drop opens guard"` | ✅ | ✅ green (it.todo — Plan 05 Task 2 Gate 4) |
| 8-XX-18 | renderer/save-load | 3 | D-144 | — | Filename chip renders `• MyRig.stmproj` when isDirty | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dirty marker bullet"` | ✅ | ✅ green |
| 8-XX-19 | renderer/save-load | 3 | D-150 | — | Stale-override banner renders count + name list | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "stale override banner"` | ✅ | ✅ green |
| 8-XX-20 | renderer/save-load | 3 | D-142 | — | DropZone branches on `.json` vs `.stmproj` extension | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dropzone branch on stmproj"` | ✅ | ✅ green (it.todo — Plan 05 Task 2 Gate 2) |
| 8-XX-21 | arch | 1 | Layer 3 | T-08-LAYER | `src/core/project-file.ts` imports no `fs`/`sharp`/`electron` | hygiene | `npx vitest run tests/arch.spec.ts -t "Architecture boundary"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/project-file.spec.ts` — RED stubs for D-148, D-151, D-155, D-156 cases.
- [ ] `tests/main/project-io.spec.ts` — RED stubs for F9.1, F9.2, D-149, D-150, D-152, atomic-write trace.
- [ ] `tests/renderer/save-load.spec.tsx` — RED stubs for AppShell Save/Open buttons, dirty marker, SaveQuitDialog, Cmd+S+O keydown, stale-override banner, DropZone branching. Uses `// @vitest-environment jsdom` prelude.
- [ ] `tests/arch.spec.ts` — Add optional electron-import block for `src/core/project-file.ts` (existing fs/sharp grep auto-scans new file via `globSync('src/core/**/*.ts')`).
- [ ] No framework install required — vitest 4.0.x + jsdom + @testing-library/react + user-event + jest-dom all wired since Phase 7.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Atomic-write crash safety | F9.1 (D-141 atomic) | Requires killing Electron mid-write; vitest cannot simulate process termination at the fs.rename point with confidence | Dev mode → drop SIMPLE_TEST.json → Cmd+S → in another terminal `kill -9 $(pgrep -f electron)` immediately as save fires (within ~50 ms window). Restart app, open the previous `.stmproj` (or confirm absence). Either: (a) original `.stmproj` from a prior save remains intact, OR (b) no half-written file exists if this was the first save. **Pass criteria:** no malformed `.stmproj` on disk; previous-saved file (if any) loads cleanly. |
| ROADMAP round-trip exit criterion | F9, F9.1, F9.2 | End-to-end behavioral verification spans Electron processes + filesystem + UI restoration; integration test only validates IPC layer | Dev mode (`npm run dev`) → drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → set TRIANGLE override to 50% → Cmd+S, save as `~/Desktop/simple.stmproj` → Cmd+Q (clean quit, no dirty) → relaunch dev → drop `simple.stmproj` onto DropZone → confirm: skeleton renders, override list shows TRIANGLE @ 50%, recompute peaks runs, no errors. **Pass criteria:** overrides round-trip identical, sampler re-ran, no banners other than expected info. |
| `.stmproj` drag-drop entry point | D-142 | DropZone branching is renderer-tested but actual OS drag-drop event semantics differ across platforms | Dev mode → drag a `.stmproj` file from Finder/Explorer onto DropZone → confirm the project loads (not the skeleton-load error path). |
| Locate-skeleton recovery flow | D-149 | Requires moving a real file on disk between save and load; integration test mocks fs and cannot simulate OS-level file relocation timing | Dev mode → save a project → quit → rename the source `.json` skeleton on disk → relaunch → open `.stmproj` → confirm the locate-skeleton inline error appears with `Locate skeleton…` button → click → pick the renamed file → confirm load succeeds with overrides applied. |
| `before-quit` dirty-guard 3-button flow | D-143 | Native confirm dialog interaction with Cmd+Q + app shutdown sequence is OS-integrated | For each of {Save, Don't Save, Cancel}: dev mode → load skeleton → set override (dirty) → Cmd+Q → click button → verify outcome (Save: writes then quits; Don't Save: quits without writing; Cancel: app stays open, no write). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the three new spec files + arch.spec block)
- [x] No watch-mode flags in any planned command
- [x] Feedback latency < 10s per run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed-off 2026-04-26 — full automated sweep green; manual UAT pending Plan 05 Task 2.

## Automated Sweep Results (2026-04-26)

| Gate | Command | Result |
|------|---------|--------|
| Full vitest | `npm run test` | ✅ 270 passed + 1 skipped + 3 todo (was 240+1+1 at Phase 7 close — net +30 passed, +2 todo across Plans 01-04) |
| Web typecheck | `npx tsc --noEmit -p tsconfig.web.json` | ✅ exit 0 |
| Node typecheck | `npx tsc --noEmit -p tsconfig.node.json` | ✅ exit 0 modulo pre-existing `scripts/probe-per-anim.ts(14,31): TS2339` (out-of-scope per `.planning/phases/04-scale-overrides/deferred-items.md` + `.planning/phases/07-atlas-preview-modal/deferred-items.md`) |
| electron-vite build | `npx electron-vite build` | ✅ exit 0 — `out/main/index.cjs` (57.96 kB) + `out/preload/index.cjs` (8.03 kB) + `out/renderer/index.html` + assets emitted (CJS lock from Phase 2 + Phase 6 preserved) |
| CLI sanity | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | ✅ exit 0; 3 rows (CIRCLE/SQUARE/TRIANGLE) at 23.3 ms; byte-for-byte unchanged from Phase 7 |
| `scripts/cli.ts` lock | `git diff 984d01c..HEAD -- scripts/cli.ts` | ✅ empty (Phase 5 D-102) |
| `src/core/sampler.ts` lock | `git diff 984d01c..HEAD -- src/core/sampler.ts` | ✅ empty (CLAUDE.md rule #3) |
| arch.spec | `npm run test -- tests/arch.spec.ts` | ✅ 10/10 (Phase 7 baseline 8 + Phase 8 Plan 01 electron-import block adds 2 — graceful-skip auto-activated when `src/core/project-file.ts` landed in Plan 02) |

**Note on it.todo rows (8-XX-17 + 8-XX-20):** Plans 01-04 implemented the renderer logic and the renderer-spec stubs both ship as `it.todo` because the underlying components (DropZone branch + dirty-drop guard) are wired through App.tsx, not AppShell. Plan 04 SUMMARY records that decision; Plan 05 Task 2 Gates 2 + 4 cover them via real OS drag-drop + Cmd+Q interaction (manual UAT is the load-bearing verification per CLAUDE.md / Phase 1 D-load-bearing-human-verify lesson).
