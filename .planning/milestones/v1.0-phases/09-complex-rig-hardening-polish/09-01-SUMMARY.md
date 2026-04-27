---
phase: 09-complex-rig-hardening-polish
plan: 01
subsystem: test-scaffold
tags: [phase-9, wave-0, test-scaffold, virtualization-dep, red-by-design]
requirements: [N2.2]
dependency_graph:
  requires:
    - "Post-08.2 baseline (commit 6236a2f) — vitest + @testing-library/react devDeps already present"
    - ".planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (18 behaviors enumerated)"
    - ".planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (analog references)"
  provides:
    - "@tanstack/react-virtual@3.13.24 runtime dependency (Wave 2 prerequisite)"
    - "7 RED scaffold spec files claiming all 18 VALIDATION.md behaviors"
    - "tests/main/ipc.spec.ts Phase 9 D-194 describe block (Wave 1 flips GREEN)"
    - "tests/arch.spec.ts Phase 9 Layer 3 named anchor for src/main/sampler-worker.ts"
  affects:
    - "package.json dependencies block"
    - "package-lock.json (resolved tree)"
tech_stack:
  added:
    - "@tanstack/react-virtual@3.13.24 (runtime dep — D-192)"
  patterns:
    - "RED-by-design scaffolding: expect(true).toBe(false) + TODO comments"
    - "Named-anchor describe block with try/catch ENOENT tolerance (Phase 8 D-145 precedent)"
    - "Grep-traceable it(...) descriptions mirroring VALIDATION.md Behavior column"
key_files:
  created:
    - "tests/main/sampler-worker.spec.ts (65 lines, 5 RED)"
    - "tests/main/sampler-worker-girl.spec.ts (30 lines, 1 RED)"
    - "tests/renderer/global-max-virtualization.spec.tsx (45 lines, 4 RED)"
    - "tests/renderer/anim-breakdown-virtualization.spec.tsx (47 lines, 4 RED)"
    - "tests/renderer/settings-dialog.spec.tsx (41 lines, 3 RED)"
    - "tests/renderer/rig-info-tooltip.spec.tsx (37 lines, 2 RED)"
    - "tests/renderer/help-dialog.spec.tsx (44 lines, 2 RED)"
    - ".planning/phases/09-complex-rig-hardening-polish/deferred-items.md"
  modified:
    - "package.json (added @tanstack/react-virtual to dependencies)"
    - "package-lock.json (resolved 3.13.24)"
    - "tests/main/ipc.spec.ts (APPEND Phase 9 D-194 describe block, 2 RED)"
    - "tests/arch.spec.ts (APPEND Phase 9 Layer 3 named anchor, 1 GREEN early-return)"
key_decisions:
  - "@tanstack/react-virtual lands as `dependencies` (NOT devDependencies) since it is a runtime React dep used by panels (D-192)"
  - "Scaffolds use `expect(true).toBe(false)` over `it.todo` so Wave 1+ executors get a hard RED→GREEN signal when they implement"
  - "tests/arch.spec.ts Phase 9 anchor uses try/catch on readFileSync so the block ships GREEN today (file absent) and protects the Layer 3 invariant once Wave 1 lands sampler-worker.ts"
  - "Pre-existing scripts/probe-per-anim.ts TS error documented in deferred-items.md (out of Phase 9 scope per SCOPE BOUNDARY rule)"
metrics:
  duration: ~6 min
  completed_date: 2026-04-26
  tasks: 3
  files_changed: 11
  red_tests_added: 23
  baseline_passed: 297
  baseline_skipped: 1
  baseline_todo: 1
---

# Phase 09 Plan 01: Wave 0 Scaffold — Phase 9 Complex-Rig Hardening + Polish Summary

Wave 0 of Phase 9 lands the one runtime dependency (`@tanstack/react-virtual@^3.13.24`) and creates RED-by-design vitest scaffolds for all 7 new test files plus 2 extensions to existing test files (`tests/main/ipc.spec.ts` + `tests/arch.spec.ts`), claiming all 18 behaviors enumerated in `09-VALIDATION.md` so every Wave 1+ task can reference an existing spec file in its `<verify>` block.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install @tanstack/react-virtual runtime dependency | `7eedefb` | package.json, package-lock.json |
| 2 | Scaffold all 7 NEW test files with RED placeholders | `2e4fb71` | tests/main/sampler-worker.spec.ts, tests/main/sampler-worker-girl.spec.ts, tests/renderer/global-max-virtualization.spec.tsx, tests/renderer/anim-breakdown-virtualization.spec.tsx, tests/renderer/settings-dialog.spec.tsx, tests/renderer/rig-info-tooltip.spec.tsx, tests/renderer/help-dialog.spec.tsx, .planning/phases/09-complex-rig-hardening-polish/deferred-items.md |
| 3 | Extend tests/main/ipc.spec.ts and tests/arch.spec.ts with Phase 9 scaffolds | `6c5ae4a` | tests/main/ipc.spec.ts, tests/arch.spec.ts |

## What Shipped

### Dependency install (Task 1)

`npm install @tanstack/react-virtual@^3.13.24 --save` resolved to `@tanstack/react-virtual@3.13.24` and added the entry to `package.json` `dependencies` (NOT `devDependencies`) per D-192. `npm ls @tanstack/react-virtual` returns a single resolved version with no peer-dep warnings. The full pre-Phase-9 test suite (297 passed | 1 skipped | 1 todo) stays GREEN — the new dep does not regress anything.

### 7 New RED scaffold spec files (Task 2)

| File | Lines | RED Tests | VALIDATION rows claimed |
|------|------:|----------:|-------------------------|
| `tests/main/sampler-worker.spec.ts` | 65 | 5 | 2 (D-190/D-193 byte-identical), 3 (D-194 progress), 4 (D-194 cancel ≤200 ms), 5 (D-194 error) + Wave-1 spawn smoke |
| `tests/main/sampler-worker-girl.spec.ts` | 30 | 1 | 1 (N2.2 wall-time gate <8000 ms) |
| `tests/renderer/global-max-virtualization.spec.tsx` | 45 | 4 | 8 (below threshold), 9 (above threshold), 10 (sort/search/checkbox), 11 (sticky thead) |
| `tests/renderer/anim-breakdown-virtualization.spec.tsx` | 47 | 4 | 12 (outer cards), 13 (inner virtualization), 14 (collapse/expand), 15 (override mount) |
| `tests/renderer/settings-dialog.spec.tsx` | 41 | 3 | 16 (Settings — samplingHz dropdown + clamp + dirty derivation) |
| `tests/renderer/rig-info-tooltip.spec.tsx` | 37 | 2 | 17 (tooltip — fps labeling + counts) |
| `tests/renderer/help-dialog.spec.tsx` | 44 | 2 | 18 (Help — markdown + external links) |

Total: **309 lines of scaffolding · 21 RED tests claiming all 18 VALIDATION rows**.

Every `it(...)` description includes a substring traceable to the `Behavior` column of `09-VALIDATION.md` (verified via grep: `byte-identical` x2, `sticky thead` x3, `skeleton.fps` x2, `wall-time` x3 hits in their respective files). Wave 1+ executors flip `expect(true).toBe(false)` to real assertions when they land implementation.

### 2 Extension blocks (Task 3)

- **`tests/main/ipc.spec.ts`** — APPEND `describe('Phase 9 D-194 — sampler IPC channels')` with 2 RED placeholders for `sampler:cancel` registration + idempotent invocation. Existing `'menu:notify-state'` describe block preserved unchanged. File now reports 2 RED + 2 GREEN.
- **`tests/arch.spec.ts`** — APPEND `describe('Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces')`. Uses `try { readFileSync(...) } catch { return; }` so the block early-returns GREEN today (file absent) and protects the Layer 3 invariant (no `react`/`electron`/`/renderer/`/`document.`/`window.` imports) once Wave 1 lands `src/main/sampler-worker.ts`. arch.spec.ts file: **11/11 GREEN preserved**.

## Verification Results

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| `npm ls @tanstack/react-virtual` | 3.x version, no peer warnings | `@tanstack/react-virtual@3.13.24` | ✅ |
| `npx tsc --noEmit -p tsconfig.web.json` | exits 0 | exits 0 | ✅ |
| `npx tsc --noEmit -p tsconfig.node.json` | clean for new test files | clean for Phase 9 surface (one pre-existing error in scripts/probe-per-anim.ts — see Deviations) | ⚠ Pre-existing only |
| `npm run test` baseline preserved | ≥275 passed + 1 skipped | 298 passed + 1 skipped + 1 todo | ✅ |
| New RED tests | ≥18 (covering all VALIDATION rows) | 23 (21 from Task 2 + 2 from Task 3 ipc extension) | ✅ |
| `tests/arch.spec.ts` GREEN | early-returns when sampler-worker.ts absent | 11/11 GREEN | ✅ |
| `tests/main/ipc.spec.ts` Phase 9 D-194 placeholders | 2 RED, existing tests GREEN | 2 RED + 2 GREEN | ✅ |
| All 18 VALIDATION rows claimed | each row has ≥1 grep-traceable it(...) | 23 RED claim 18 rows + Wave-1 spawn smoke | ✅ |

## Deviations from Plan

### Out-of-scope discoveries (logged, not fixed)

**1. [Pre-existing TS error] scripts/probe-per-anim.ts:14 TS2339**
- **Found during:** Task 2 typecheck — `npx tsc --noEmit -p tsconfig.node.json`
- **Issue:** `Property 'values' does not exist on type 'SamplerOutput'.`
- **Pre-existing:** Yes — confirmed via `git stash` against the post-08.2 baseline (`6236a2f`); reproduces with no Phase 9 changes.
- **Action:** Per SCOPE BOUNDARY rule, NOT fixed in this plan. Documented in `.planning/phases/09-complex-rig-hardening-polish/deferred-items.md` for a future cleanup commit outside Phase 9.

### No auto-fixes were required

All three tasks executed exactly as written. The plan's analog references (`tests/main/image-worker.spec.ts`, `tests/renderer/atlas-preview-modal.spec.tsx`, `tests/main/ipc.spec.ts:25-77` Map captor, `tests/arch.spec.ts:136-154` Phase 8 named-anchor) all matched repository reality verbatim.

## Authentication Gates

None encountered. No external services or auth flows touched.

## Wave 0 Status

- All 7 new test files exist and contain RED scaffolds.
- `tests/main/ipc.spec.ts` and `tests/arch.spec.ts` extended (not rewritten).
- All 18 behaviors in `09-VALIDATION.md` claimed by ≥1 grep-traceable `it(...)` description.
- `@tanstack/react-virtual@^3.13.24` lands in `package.json` `dependencies`.
- Pre-Phase-9 baseline preserved: 298 passed | 1 skipped | 1 todo (vs 297/1/1 pre-Wave 0 — 1 extra pass came from elsewhere; no regressions).
- `npx tsc --noEmit` for both tsconfigs — Phase 9 surface clean. (Pre-existing `scripts/probe-per-anim.ts` error logged.)
- `tests/arch.spec.ts` 11/11 GREEN today (Phase 9 anchor early-returns).
- The `09-VALIDATION.md` `wave_0_complete: true` flag is now eligible to be flipped by the orchestrator's Wave-0 close-out commit.

## Key Decisions Made

1. **Scaffold style: `expect(true).toBe(false)` over `it.todo`.** Wave 1+ executors verify their work by FLIPPING these scaffolds GREEN one assertion at a time. `it.todo` would emit no signal that an implementation is wired correctly; hard-RED `expect(...).toBe(false)` fires loudly until the placeholder is replaced.
2. **`@tanstack/react-virtual` placement: `dependencies` (NOT `devDependencies`).** It is a runtime React import used by `src/renderer/src/panels/*` per D-192; pulling it into the production bundle requires the runtime classification.
3. **Phase 9 arch.spec.ts anchor uses try/catch ENOENT tolerance.** Mirrors the Phase 8 D-145 precedent at `tests/arch.spec.ts:136-154`. The named anchor is added in Wave 0 (today) but the file it grep-protects ships in Wave 1 — the early-return pattern lets Wave 0 ship without putting arch.spec.ts into RED.
4. **Pre-existing `scripts/probe-per-anim.ts` TS error not fixed.** Out of Phase 9 scope per SCOPE BOUNDARY rule. Logged in `deferred-items.md` for a future cleanup pass.

## Wave 1 Unblocked

Every Phase 9 Wave 1+ executor task now has a pre-existing test file it can reference in `<verify>`:

- Wave 1 (`09-02-sampler-worker-PLAN.md`) → flips 5 specs in `tests/main/sampler-worker.spec.ts` + 1 in `tests/main/sampler-worker-girl.spec.ts` + 2 in `tests/main/ipc.spec.ts` GREEN; the `tests/arch.spec.ts` Phase 9 anchor begins enforcing once `src/main/sampler-worker.ts` lands.
- Wave 2 (`09-03-globalmax-virtualization-PLAN.md`, `09-04-anim-breakdown-virtualization-PLAN.md`) → flips 4 specs in `tests/renderer/global-max-virtualization.spec.tsx` + 4 in `tests/renderer/anim-breakdown-virtualization.spec.tsx` GREEN.
- Wave 4 (`09-06-settings-and-tooltip-PLAN.md`) → flips 3 specs in `tests/renderer/settings-dialog.spec.tsx` + 2 in `tests/renderer/rig-info-tooltip.spec.tsx` GREEN.
- Wave 5 (`09-07-help-dialog-PLAN.md`) → flips 2 specs in `tests/renderer/help-dialog.spec.tsx` GREEN.

Per Nyquist Rule, every `<verify>` block in Wave 1+ tasks now references a test file that EXISTS, scaffold-side.

## Self-Check: PASSED

- ✅ FOUND: tests/main/sampler-worker.spec.ts
- ✅ FOUND: tests/main/sampler-worker-girl.spec.ts
- ✅ FOUND: tests/renderer/global-max-virtualization.spec.tsx
- ✅ FOUND: tests/renderer/anim-breakdown-virtualization.spec.tsx
- ✅ FOUND: tests/renderer/settings-dialog.spec.tsx
- ✅ FOUND: tests/renderer/rig-info-tooltip.spec.tsx
- ✅ FOUND: tests/renderer/help-dialog.spec.tsx
- ✅ FOUND: .planning/phases/09-complex-rig-hardening-polish/deferred-items.md
- ✅ FOUND: commit 7eedefb (Task 1 — chore: install @tanstack/react-virtual)
- ✅ FOUND: commit 2e4fb71 (Task 2 — test: scaffold 7 RED specs)
- ✅ FOUND: commit 6c5ae4a (Task 3 — test: extend ipc + arch with Phase 9 anchors)
- ✅ package.json dependencies block contains "@tanstack/react-virtual": "^3.13.24"
- ✅ tests/arch.spec.ts contains "Phase 9 Layer 3: src/main/sampler-worker.ts must not import"
- ✅ tests/main/ipc.spec.ts contains "Phase 9 D-194 — sampler IPC channels"
