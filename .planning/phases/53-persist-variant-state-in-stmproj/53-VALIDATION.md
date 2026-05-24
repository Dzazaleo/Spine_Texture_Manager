---
phase: 53
slug: persist-variant-state-in-stmproj
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `53-RESEARCH.md` §Validation Architecture (not a stub).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.0 |
| **Config file** | `vitest.config.ts` (env `node`; renderer specs opt into jsdom via `// @vitest-environment jsdom` pragma) |
| **Quick run command** | `npx vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts` |
| **Full suite command** | `npm run test` (= `vitest run`) then `npm run typecheck:node && npm run typecheck:web` |
| **Estimated runtime** | quick ~5s · full ~ (153 files / ~1546 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts`
- **After every plan wave:** Run `npm run test` + `npm run typecheck:node && npm run typecheck:web`
- **Before `/gsd-verify-work`:** Full suite green AND both typechecks green
- **Max feedback latency:** ~5 seconds (quick); full suite per wave

---

## Per-Task Verification Map

> Task IDs finalized by the planner; behaviors/commands below are the binding contract.
> Each row is a grep/test-verifiable signal derived from the SCALEUI-03 success criteria.

| SC | Behavior | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|----|----------|------|-------------|-----------|-------------------|-------------|--------|
| SC#1 (save) | Serializing an `AppSessionState` writes `variantRows` (scales) to the on-disk `ProjectFileV1` | 1 | SCALEUI-03 | unit (core) | `npx vitest run tests/core/project-file.spec.ts -t "variantRows"` | ✅ extend existing | ⬜ pending |
| SC#1 (load) | Materializing a `.stmproj` restores the scales, order-preserved, with fresh ids | 1 | SCALEUI-03 | unit (core) + integration (main) | `npx vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts -t "variantRows"` | ✅ extend existing | ⬜ pending |
| SC#1 (restore-into-UI) | First-open init AND `mountOpenResponse` re-open both seed `variantRows` with restored scales | 1 | SCALEUI-03 | renderer (jsdom) | `npx vitest run tests/renderer/save-load.spec.tsx -t "variant rows restore"` | ✅ extend existing | ⬜ pending |
| SC#1 (dirty) | Editing rows marks dirty; a freshly opened project is NOT dirty (scale-projection compare, not `{id,scale}`) | 1 | SCALEUI-03 | renderer (jsdom) | `npx vitest run tests/renderer/save-load.spec.tsx -t "variant rows dirty"` | ⬜ Wave 0 (add) | ⬜ pending |
| SC#2 (back-compat) | Old file with no `variantRows` → validator pre-massages to default `[{scale:0.5}]`, opens clean | 1 | SCALEUI-03 | unit (core) | `npx vitest run tests/core/project-file.spec.ts -t "missing variantRows"` | ✅ extend existing | ⬜ pending |
| SC#3 (stale dir) | Saved `lastOutDir` pointing nowhere never hard-fails load; no new fs check added | 1 | SCALEUI-03 | integration (main) + grep guard | `npx vitest run tests/main/project-io.spec.ts -t "lastOutDir"` + grep no new `existsSync`/`access`/`stat` on `lastOutDir` | ✅ assert via existing load path | ⬜ pending |
| D-05 (no version bump) | Serialized output keeps `"version":1`; `V_LATEST` unchanged | 1 | SCALEUI-03 | unit (core) + grep guard | `npx vitest run tests/core/project-file.spec.ts -t "version"` + grep `V_LATEST` == 1 | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Concrete acceptance signals (copied from RESEARCH §Validation Architecture)

- **SC#1 (round-trip equality):** `materializeProjectFile(serializeProjectFile(state,p),p).variantRows.map(r=>r.scale)` deep-equals input scales, order-preserved → `toEqual([0.5,0.36,0.57])`.
- **SC#2 (back-compat default):** pass a `version:1` object with NO `variantRows` to `validateProjectFile` → `result.ok === true` AND `result.project.variantRows` deep-equals `[{scale:0.5}]`.
- **SC#3 (stale dir never hard-fails):** loaded `.stmproj` `lastOutDir` points at a non-existent path → open response `ok: true`, `materialized.lastOutDir` returned verbatim; grep-guard that `src/main/project-io.ts` adds NO `existsSync`/`access`/`stat` keyed on `lastOutDir`/`variantOutputDir`.
- **No-version-bump (D-05):** serialized output contains `"version":1`; grep that `V_LATEST` in `src/core/project-file.ts` is still `1`.

---

## Wave 0 Requirements

- [ ] `tests/renderer/save-load.spec.tsx` — add "variant rows mark project dirty on edit, but a freshly opened project is NOT dirty" case (D-03 scale-projection compare). Name stays `.spec.tsx` (see `feedback_renderer_ts_helper_test_breaks_typecheck_node`).
- [ ] Framework install: none — vitest already present.
- [ ] Shared fixtures: none — tests construct in-memory `ProjectFileV1`/`AppSessionState` literals (existing precedent). **No committed `.stmproj` fixture is added**, so the SAFE-01 denylist (`tests/safe01/discover-fixtures.ts` `SAFE01_EXCLUDED_PREFIXES`) does NOT need extension. [VERIFIED]

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end sticky scale set across a real app restart | SCALEUI-03 | jsdom can't exercise the full Electron save→quit→relaunch→reopen cycle | In the running app: open a project, add scale rows (e.g. 0.5/0.36/0.57) in Export Variant, Save, quit, relaunch, reopen the `.stmproj` → rows return; variant picker pre-fills the remembered folder |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (quick command)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
