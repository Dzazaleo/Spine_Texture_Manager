---
phase: 1
slug: electron-react-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated from `01-RESEARCH.md` §Validation Architecture. The planner MUST expand this during PLAN.md creation (fill the per-task table, set `nyquist_compliant: true` when coverage is complete).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (carried over from Phase 0) |
| **Config file** | `vitest.config.ts` at project root |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run typecheck && npm run build -- --dry` *(after plan 01-05; earlier plans only run the first two)* |
| **Estimated runtime** | ~5–8 seconds (vitest + tsc); ~30 seconds once `electron-vite build` is in scope |

Additional gates introduced in Phase 1 (documented for planner; wired into tasks):

| Gate | Command | When |
|------|---------|------|
| Typecheck (root) | `npm run typecheck` (= `tsc --noEmit` via the default tsconfig) | Every commit |
| Renderer isolation grep | `! grep -r "from ['\"].*src/core" src/renderer/` | After any renderer plan |
| Portability grep | `! grep -rn "process.platform\|os.platform()\|titleBarStyle: 'hiddenInset'\|trafficLightPosition\|vibrancy" src/` | After any main-process plan |
| electron-vite build | `npm run build -- --dry` (or `npx electron-vite build`) | After 01-05 packaging plan |

---

## Sampling Rate

- **After every task commit:** Run `npm test && npm run typecheck`
- **After every plan wave:** Run full suite (includes build once wave 5 lands)
- **Before `/gsd-verify-work`:** `npm test` green, `tsc --noEmit` clean, `electron-vite build` succeeds, drop-test fixture `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` renders debug dump matching Phase 0 CLI output
- **Max feedback latency:** 10 seconds for test+typecheck; 60 seconds for build

---

## Per-Task Verification Map

> Planner fills this during PLAN.md creation. Each task gets a row keyed by `{N}-XX-YY`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(planner fills)* | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 installs shared test infrastructure before any implementation plan runs:

- [ ] `tests/core/ipc.spec.ts` — placeholder that imports from `src/shared/types.ts` (forces the types module to exist before main consumes it)
- [ ] `tests/core/summary.spec.ts` — unit tests for `buildSummary(load, peaks, elapsedMs)` projection (Map→array, no class instances survive)
- [ ] `tests/arch.spec.ts` — architectural boundary grep test (fails CI if `src/renderer/**` imports from `src/core/**`)
- [ ] Vitest already installed (Phase 0) — no framework install needed

Research source: `01-RESEARCH.md` §Validation Architecture Wave 0 list (three-layer `core/ ↛ renderer/` boundary, IPC round-trip, summary serializability).

---

## Manual-Only Verifications

Phase 1 has one load-bearing manual gate — the end-to-end drag-drop flow. The `webUtils.getPathForFile` path acquisition requires a real Electron renderer + DragEvent to exercise; headless tests can cover `buildSummary` / IPC handlers / arch boundaries but cannot simulate an OS drag-drop event meaningfully.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop loads SIMPLE_TEST.json → debug dump matches CLI | Phase 1 exit criterion (ROADMAP) | DragEvent + webUtils.getPathForFile need real renderer context | 1. `npm run dev` 2. Drag `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` into window 3. Verify debug panel shows Skeleton/Atlas paths + bone/slot/attachment counts + peak-scale table matching `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` |
| Error path: drop non-JSON / missing-atlas | F1.4 | Typed-error UI surfacing needs real IPC round-trip | 1. Drag a `.txt` file → expect inline error text in muted orange; 2. Drop a JSON whose sibling `.atlas` is missing → expect `AtlasNotFoundError` kind + message |
| Unsigned `.dmg` opens on macOS (dev machine) | N4 baseline | `.dmg` install behavior not automatable without signed cert | `npm run build` → open `release/*.dmg` → drag to Applications → app launches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner checks)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (arch + summary + ipc shells)
- [ ] No watch-mode flags (`vitest run`, not `vitest` / `--watch`)
- [ ] Feedback latency < 10s for quick command; < 60s for full
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the per-task table

**Approval:** pending
