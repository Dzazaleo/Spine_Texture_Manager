---
phase: 8
slug: save-load-project-state
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
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
| 8-XX-01 | core/project-file | 1 | F9.1 | T-08-VAL | Validator rejects unknown/missing/newer-version files | unit | `npx vitest run tests/core/project-file.spec.ts -t "validator rejects"` | ❌ W0 | ⬜ pending |
| 8-XX-02 | core/project-file | 1 | F9.1 | — | Validator accepts minimal v1 + full v1 | unit | `npx vitest run tests/core/project-file.spec.ts -t "validator accepts"` | ❌ W0 | ⬜ pending |
| 8-XX-03 | core/project-file | 1 | D-148 | — | `documentation: {}` slot preserved on round-trip | unit | `npx vitest run tests/core/project-file.spec.ts -t "documentation slot preserved"` | ❌ W0 | ⬜ pending |
| 8-XX-04 | core/project-file | 1 | D-155 | — | Round-trip relative paths resolve to absolute on load | unit | `npx vitest run tests/core/project-file.spec.ts -t "round-trip relative paths"` | ❌ W0 | ⬜ pending |
| 8-XX-05 | core/project-file | 1 | D-155 | — | Cross-volume paths fall back to absolute storage | unit | `npx vitest run tests/core/project-file.spec.ts -t "cross-volume falls back to absolute"` | ❌ W0 | ⬜ pending |
| 8-XX-06 | core/project-file | 1 | D-151 | T-08-VER | `version > 1` → `'newer-version'` error | unit | `npx vitest run tests/core/project-file.spec.ts -t "newer version rejected"` | ❌ W0 | ⬜ pending |
| 8-XX-07 | main/project-io | 2 | F9.1 | — | Save writes `.stmproj` containing all D-145 fields | unit | `npx vitest run tests/main/project-io.spec.ts -t "save writes file with all D-145 fields"` | ❌ W0 | ⬜ pending |
| 8-XX-08 | main/project-io | 2 | F9.1 | T-08-IO | Save uses `<path>.tmp` + `fs.rename` (atomic) | unit | `npx vitest run tests/main/project-io.spec.ts -t "atomic-write tmp then rename"` | ❌ W0 | ⬜ pending |
| 8-XX-09 | main/project-io | 2 | F9.2 | — | Load restores overrides verbatim | unit | `npx vitest run tests/main/project-io.spec.ts -t "load restores overrides verbatim"` | ❌ W0 | ⬜ pending |
| 8-XX-10 | main/project-io | 2 | F9.2 | — | Load threads samplingHz into `sampleSkeleton` | unit | `npx vitest run tests/main/project-io.spec.ts -t "load threads samplingHz into sampleSkeleton"` | ❌ W0 | ⬜ pending |
| 8-XX-11 | main/project-io | 2 | F9.2 / D-150 | — | Load with stale-override keys drops them + reports in response | unit | `npx vitest run tests/main/project-io.spec.ts -t "load drops stale override keys"` | ❌ W0 | ⬜ pending |
| 8-XX-12 | main/project-io | 2 | D-149 | T-08-MISS | Missing skeleton → `'SkeletonNotFoundOnLoadError'` | unit | `npx vitest run tests/main/project-io.spec.ts -t "missing skeleton returns typed error"` | ❌ W0 | ⬜ pending |
| 8-XX-13 | main/project-io | 2 | D-152 | — | atlasPath null → re-runs F1.2 sibling auto-discovery | unit | `npx vitest run tests/main/project-io.spec.ts -t "atlas auto-discovery on null path"` | ❌ W0 | ⬜ pending |
| 8-XX-14 | renderer/save-load | 3 | D-141 | — | Save with currentProjectPath !== null writes silently (no dialog) | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Save reuses currentProjectPath"` | ❌ W0 | ⬜ pending |
| 8-XX-15 | renderer/save-load | 3 | D-140 | — | Cmd/Ctrl+S on window fires Save handler | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Cmd+S triggers Save"` | ❌ W0 | ⬜ pending |
| 8-XX-16 | renderer/save-load | 3 | D-140 | T-08-SHORT | Cmd+S while OverrideDialog open does NOT fire Save | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "Cmd+S suppressed when modal open"` | ❌ W0 | ⬜ pending |
| 8-XX-17 | renderer/save-load | 3 | D-143 | — | New-skeleton-drop on dirty session opens SaveQuitDialog | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dirty + drop opens guard"` | ❌ W0 | ⬜ pending |
| 8-XX-18 | renderer/save-load | 3 | D-144 | — | Filename chip renders `• MyRig.stmproj` when isDirty | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dirty marker bullet"` | ❌ W0 | ⬜ pending |
| 8-XX-19 | renderer/save-load | 3 | D-150 | — | Stale-override banner renders count + name list | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "stale override banner"` | ❌ W0 | ⬜ pending |
| 8-XX-20 | renderer/save-load | 3 | D-142 | — | DropZone branches on `.json` vs `.stmproj` extension | renderer | `npx vitest run tests/renderer/save-load.spec.tsx -t "dropzone branch on stmproj"` | ❌ W0 | ⬜ pending |
| 8-XX-21 | arch | 1 | Layer 3 | T-08-LAYER | `src/core/project-file.ts` imports no `fs`/`sharp`/`electron` | hygiene | `npx vitest run tests/arch.spec.ts -t "Architecture boundary"` | ✅ existing covers fs/sharp; ❌ W0 for electron rule | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the three new spec files + optional arch.spec block)
- [ ] No watch-mode flags in any planned command
- [ ] Feedback latency < 10s per run
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes task IDs)

**Approval:** pending
