---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
plan: 06
subsystem: build-pipeline / runtime-adapter-resolution
tags: [GAP-43-PROD-SEAM, electron-vite, pickRuntime, Option-A, lazy-single-copy, falsifier]
status: tasks-1-2-complete · TASK-3-BLOCKING-CHECKPOINT-PENDING
gap_closure: true
closes_gap: GAP-43-PROD-SEAM
requires:
  - 43-03 (Option A ESM seam — pickRuntime body + vitest globalThis resolver)
  - 43-05 (D-04 32/32 SAFE-02 close-gate; A1 Approach B)
provides:
  - "out/main/runtime-42.cjs + out/main/runtime-43.cjs emitted as resolvable entry artifacts"
  - "pickRuntime prod-arm require literal resolves on-disk from out/main/chunks/"
  - "build-required GAP-43-PROD-SEAM falsifier (hard-fail-not-skip + Cannot-find-module negative)"
affects:
  - electron.vite.config.ts (main.build.rollupOptions.input)
  - src/core/runtime/runtime.ts (prod-arm literal + comments only)
  - tests/main/sampler-worker.spec.ts (spawn-smoke → true falsifier)
tech-stack:
  added: []
  patterns:
    - "ARCHITECTURE §7 build-order item: adapters as explicit rollupOptions.input entries (spine-core externalized via electron-vite v5 build.externalizeDeps)"
    - "build-required falsifier: ensureFreshWorkerBundle() runs the bundler in-test, HARD-FAILS on stale/absent bundle"
key-files:
  created:
    - .planning/phases/43-runtime-adapter-facade-verified-4-3-api-mapping/43-06-SUMMARY.md
  modified:
    - electron.vite.config.ts
    - src/core/runtime/runtime.ts
    - tests/main/sampler-worker.spec.ts
decisions:
  - "Closed the gap by completing ARCHITECTURE §4/§7 (input entries + ../runtime-4x.cjs literal correction) — NOT a redesign of LOCKED Option A"
  - "FINDING surfaced for the blocking human-verify: out/main/runtime-43.cjs emits 1 bare side-effect require(\"spine-core-42\") via the pre-existing 43-04 runtime-43.ts → synthetic-atlas.ts coupling — contradicts the plan's probe-derived '0 spine-core-42 literals' empirical fact; ARCHITECTURE §4 adjudication is maintainer-owned (checkpoint check #2)"
metrics:
  duration: ~14 min (Tasks 1-2; Task 3 awaiting human gate)
  completed_date: pending-task-3
  commits: [b3b975b, 60b4fac]
---

# Phase 43 Plan 06: Close GAP-43-PROD-SEAM (production worker adapter-resolution seam) Summary

GAP-43-PROD-SEAM's prod arm is fixed by landing the ARCHITECTURE §4/§7 build-order
item 43-03 deferred: electron-vite now emits `out/main/runtime-4x.cjs` and the
`pickRuntime` prod literal is corrected to the on-disk-resolvable
`../runtime-4x.cjs`; a build-required RED→GREEN-proven falsifier replaces the
silent-skip blind-spot. **One blocking finding (a pre-existing 43-04 4.3-side
`spine-core-42` transitive edge that contradicts the plan's probe-derived
lazy-single-copy empirical fact) is surfaced for the blocking human-verify
checkpoint (Task 3) — it is NOT auto-resolved.**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Emit runtime-4x.cjs as resolvable entries + correct prod literal to ../runtime-4x.cjs | `b3b975b` | electron.vite.config.ts, src/core/runtime/runtime.ts |
| 2 | Harden spawn-smoke into a true GAP-43-PROD-SEAM falsifier | `60b4fac` | tests/main/sampler-worker.spec.ts |
| 3 | **Human verification (blocking checkpoint:human-verify)** | — | PENDING — executor paused, evidence surfaced |

## Chosen Remediation Mechanism (preserves LOCKED Option A)

The gap was closed by **completing the research spec's build-order item**, not
by a redesign of `project_phase43_pickruntime_esm_split`:

- **ARCHITECTURE §7 (input entries):** added `'runtime-42'` + `'runtime-43'`
  `resolve(__dirname,'src/core/runtime/runtime-4x.ts')` entries to
  `main.build.rollupOptions.input`. With the unchanged
  `output:{format:'cjs',entryFileNames:'[name].cjs'}` electron-vite emits
  `out/main/runtime-42.cjs` + `out/main/runtime-43.cjs` as real entry
  artifacts. No `manualChunks`, no custom `external`, no copy plugin.
- **The 3 reconciliation hazards (43-VERIFICATION.md):** the worker-shared
  chunk preserves the require literal verbatim and resolves it relative to
  `out/main/chunks/`; the emitted artifacts are at `out/main/runtime-4x.cjs`
  (one dir UP, `.cjs` not `.js`). Source literal corrected
  `./runtime-4x.js` → `../runtime-4x.cjs`. Verified on-disk:
  `path.resolve('out/main/chunks','../runtime-42.cjs')` exists and the chunk
  contains the verbatim `require("../runtime-42.cjs")`.

### LOCKED Option-A constraints — each explicitly preserved

- **(a) lazy single-copy:** `runtime-42.cjs` externalizes `spine-core-42`
  (`require("spine-core-42")` ×1) and has **0** `require("@esotericsoftware/spine-core")`
  — the 4.3 graph is NOT co-bundled into the 4.2 adapter. **(4.3-side has a
  pre-existing exception — see "Blocking Finding" below.)**
- **(b) env-split byte-untouched:** resolver-first precedence preserved
  (`esmResolver != null` at runtime.ts:179 < `typeof require` at :189);
  `__GSD_ESM_ADAPTER_RESOLVER__` globalThis key, `__getEsmAdapterResolver` /
  `__setEsmAdapterResolver`, the cache, and the test setupFile are
  byte-IDENTICAL. `git diff --stat tests/setup/esm-adapter-resolver.ts
  vitest.config.ts` is EMPTY.
- **(c) synchronous:** the prod arm stays a conditional sync `require` — no
  executable `await import()` introduced (the only `await import(` /
  `./runtime-4x.js` occurrences are documentary comment prose, including the
  plan-mandated 43-06 header note documenting the falsified A2 form).
- **(d) loud-throw arm (3):** byte-UNCHANGED.

Only the two prod-arm specifier strings, the prod-arm comment, and the
module-header 43-06 note changed in `runtime.ts`; only the two input entries
(+ comment) in `electron.vite.config.ts`.

## A/B RED→GREEN Falsifier Proof (true falsifier, not a tautology)

Mirrors the 43-03 addendum stash-and-reproduce discipline. Task 1's literal is
committed (`b3b975b`); the A/B was done via an in-place scratch revert/restore
of ONLY the `runtime.ts` prod-arm literal (electron.vite.config.ts entries kept).

**(1) RED — orphaned `./runtime-42.js` literal, rebuilt + falsifier run:**

```
× sampler-worker — Wave 1 spawn smoke (GAP-43-PROD-SEAM falsifier) >
  BUILT worker spawns ... NEVER emits a Cannot-find-module runtime-4x error  995ms
AssertionError: GAP-43-PROD-SEAM REGRESSION: the BUILT worker could not resolve
the runtime adapter — {"type":"error","error":{"kind":"Unknown",
"message":"Cannot find module './runtime-42.js'\nRequire stack:\n-
.../out/main/chunks/sampler-D9HR2Ty_.cjs\n- .../out/main/sampler-worker.cjs"}}.
... expected { type: 'error', error: { …(2) } } to be undefined
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

**(2) GREEN — fixed `../runtime-4x.cjs` literal restored, rebuilt + falsifier run:**

```
✓ sampler-worker — Wave 1 spawn smoke (GAP-43-PROD-SEAM falsifier) >
  BUILT worker spawns ... NEVER emits a Cannot-find-module runtime-4x error  1019ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

The falsifier is build-required (`ensureFreshWorkerBundle()` runs
`npx electron-vite build` ≈1s — the main/worker chunks emit before the
known Phase-47 spine-player MixBlend abort; the non-zero exit is swallowed
and the freshness+existence assertions are the real gate) and HARD-FAILS
(throws, never `it.skip`) on a stale/absent bundle. RED-before / GREEN-after
proves it is a true GAP-43-PROD-SEAM falsifier, not a tautology.

## SAFE-02 Re-assertion + D-04 Non-Re-derivation

- **SAFE-02:** `npx vitest run tests/safe01/safe01-baseline.spec.ts` →
  **`Tests 32 passed | 1 skipped (33)`, 0 failed, exit 0** (the local set:
  20 heavy/proprietary + 12 git-tracked redistributable byte-equal; the 12
  CI-runnable redistributable subset — the gap contract's re-assert target —
  is wholly within this and GREEN). The 1 skip is the intentional Phase-44
  `SIMPLE_PROJECT_43/skeleton2_42.json` 4.2-sibling exclusion (designed).
- **D-09 zero baseline regen:** `git status --porcelain tests/safe01/baselines/`
  EMPTY; `git status --porcelain tests/safe01/` shows no baseline mutation.
- **D-04 32/32 close-gate does NOT need re-derivation:** SAFE-02 runs under
  vitest where `pickRuntime` takes the globalThis-resolver arm (1) — the
  corrected prod-arm-(2) literal is dead code there. This change touches ONLY
  module-resolution plumbing (where the prod worker finds the SAME
  `runtime-42` module) and the build-emit artifact topology; it does NOT
  alter the 4.2 sampling math, the parse seam, or `canonicalize`. The 43-05
  D-04 heavy-rig 32/32 byte-equal close-gate (vs the independent frozen
  `c5ef358` reference) therefore remains valid and need not be re-derived.

## Phase-47 MixBlend Work-Around Confirmed

`npm run build` / `npx electron-vite build` exits non-zero on the KNOWN,
PRE-EXISTING, PHASE-47-OWNED `spine-player/dist/Player.js` "MixBlend not
exported" rollup abort. This fires AFTER the main/worker chunks emit
(verified: `out/main/sampler-worker.cjs` mtime refreshes on every build
despite the non-zero exit). The build tolerates it; the falsifier swallows
it and asserts artifact freshness instead. **No `tests/renderer/*` file and
no spine-player file was touched.** `git diff --stat tests/renderer/` EMPTY;
`grep -c "SIMPLE_PROJECT_43|fixtures/Girl|fixtures/SKINS|tests/renderer"
tests/main/sampler-worker.spec.ts` = 0.

## Blocking Finding — surfaced for the Task 3 human-verify checkpoint (NOT auto-resolved)

`out/main/runtime-43.cjs` emits **one bare side-effect `require("spine-core-42")`**
(line 8), in ADDITION to its correct primary `require("@esotericsoftware/spine-core")`.

- **Root cause (PRE-EXISTING, NOT introduced by this plan):** `runtime-43.ts`
  imports `SilentSkipAttachmentLoader` from `../synthetic-atlas.js` (line 56)
  and constructs it at runtime (line 102). `synthetic-atlas.ts` imports
  `AtlasAttachmentLoader` (a VALUE/base-class, not type-only) from
  `spine-core-42` (line 63), and `SilentSkipAttachmentLoader extends
  AtlasAttachmentLoader`. The 4.3 adapter therefore deliberately subclasses a
  `spine-core-42` class (source comment runtime-43.ts:95: "SilentSkipAttachmentLoader
  extends the 4.2 AtlasAttachmentLoader"). Committed in
  `f2cf770 feat(43-04)`; HEAD before this plan. `git status --porcelain
  src/core/runtime/runtime-43.ts src/core/synthetic-atlas.ts` is EMPTY — this
  plan did not touch them.
- **Contradiction with the plan's stated empirical facts:** the plan's
  `<interfaces>` (derived from a now-deleted throwaway probe) asserts
  "runtime-43.cjs has 0 `require("spine-core-42")` literals" / "the lone
  `spine-core-42` SUBSTRING is a comment/string, NOT a `require()` literal".
  Reality: it is a real bare `require("spine-core-42")` literal. The plan's
  automated `<verify>` and acceptance criterion
  `! grep -q 'require("spine-core-42")' out/main/runtime-43.cjs` therefore
  do NOT pass as written, and threat-register T-43-17 (ARCHITECTURE §4
  lazy-single-copy: an adapter must not co-bundle the other's spine-core
  graph) is implicated for the 4.3 side.
- **Why NOT auto-fixed (Rule 4 — architectural):** resolving it is a
  STRUCTURAL decision on a LOCKED surface (`project_phase43_pickruntime_esm_split`
  / ARCHITECTURE §4). Candidate resolutions are mutually exclusive and
  product-affecting: (i) decouple `SilentSkipAttachmentLoader` from
  `spine-core-42` so the 4.3 adapter does not subclass a 4.2 class (touches
  the LOCKED, plan-forbidden `synthetic-atlas.ts`/`runtime-43.ts` 43-04
  design); or (ii) amend the ARCHITECTURE §4 doctrine so "lazy single-copy"
  scopes the spine-core *runtime* graph (which IS clean: `runtime-42.cjs` has
  0 `@esotericsoftware/spine-core`; the 4.3 adapter's actual spine-core is
  `@esotericsoftware/spine-core`) and explicitly accepts the shared
  `synthetic-atlas` helper's single `spine-core-42` edge as a documented,
  bounded exception. The plan also forbids re-probing the bundler. This is
  exactly the adjudication the blocking `checkpoint:human-verify` (check #2,
  "REJECT … if an adapter co-bundles the other's spine-core") exists for.
- **What IS proven regardless of (i)/(ii):** the prod seam resolves (worker
  spawns + samples, no Cannot-find-module), the 4.2-side lazy-single-copy is
  clean, SAFE-02 32/32 GREEN, env-split byte-untouched, RED→GREEN falsifier
  proven. The finding is scoped to the 4.3-adapter's shared-helper edge, not
  the gap's prod-resolution mechanism.

## Deviations from Plan

### Findings surfaced for checkpoint review (NOT auto-applied — Rule 4)

**1. [Rule 4 - Architectural] runtime-43.cjs emits a bare `require("spine-core-42")`**
- **Found during:** Task 1 (`<verify>` lazy-single-copy assertion)
- **Issue:** pre-existing 43-04 `runtime-43.ts → synthetic-atlas.ts →
  spine-core-42` value coupling makes the 4.3 adapter artifact carry one
  `spine-core-42` require, contradicting the plan's probe-derived
  empirical "0 literals" fact + threat T-43-17 / ARCHITECTURE §4 gate.
- **Action:** NOT auto-fixed — surfaced for the blocking human-verify
  (touches LOCKED Option-A/§4; structural; plan forbids touching
  synthetic-atlas.ts/runtime-43.ts + re-probing the bundler).

### Verify-command interpretation notes (no code change)

- The plan's `<automated>` greps for the falsifier describe name in stdout;
  the project's default vitest reporter prints only the summary. Authoritative
  evidence captured with `--reporter=verbose`
  (`✓ … spawn smoke (GAP-43-PROD-SEAM falsifier) … RAN, not skipped, GREEN`).
- `grep -c "it.skip|bundleExists ? it : it.skip"` returns 1 — the sole match
  is explanatory comment prose (the plan's own verbatim block documenting the
  REMOVED old blind-spot). No executable `it.skip` / ternary remains; the
  gate HARD-FAILS via `throw`. Intent satisfied.
- `grep -c "await import("` / `"./runtime-42.js"` in `runtime.ts` match only
  comment prose (incl. the plan-mandated preserved module header + 43-06
  note); the sole executable require literal is `../runtime-4x.cjs`. Intent
  (no async, orphan literal gone from executable code) satisfied.

### Untracked scratch residue (cosmetic; not committed)

- `src/core/runtime/runtime.ts.abak` — a `sed -i.abak` backup created during
  the A/B proof; it is a byte-copy of the committed `runtime.ts` (the sed was
  reverted via Edit). It is untracked and was NOT committed (files staged
  individually by exact path; never `git add .`). Sandbox `rm` was denied;
  the maintainer may delete it: `rm src/core/runtime/runtime.ts.abak`. It has
  zero effect on build/tests/gap closure.

## Known Stubs

None — no stub patterns introduced. The plan is build-config + a 2-string
source literal + a test hardening; no UI/data wiring.

## Self-Check: PASSED

- FOUND: `43-06-SUMMARY.md`
- FOUND: `out/main/runtime-42.cjs`, `out/main/runtime-43.cjs`, `out/main/sampler-worker.cjs`
- FOUND commit: `b3b975b` (Task 1)
- FOUND commit: `60b4fac` (Task 2)
- Worker-shared chunk: `require("../runtime-42.cjs")` literal present AND
  `path.resolve('out/main/chunks','../runtime-42.cjs')` resolves on-disk
  (the 3 reconciliation hazards closed; prod seam resolves)

Task 3 (blocking `checkpoint:human-verify`) is PENDING — executor paused and
returned the structured checkpoint with evidence. ROADMAP plan-progress and
the final D-04/phase-close advance are intentionally NOT applied until the
human gate clears (per execute-plan.md checkpoint protocol).
