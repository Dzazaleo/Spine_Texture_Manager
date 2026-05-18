---
phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
plan: 03
subsystem: testing
tags: [loader, dispatch, runtime-routing, spine-4.3, dual-runtime, d-11, multi-runtime-entrypoint, orcl-03]

# Dependency graph
requires:
  - phase: 44-02
    provides: "resolveRuntimeTag() (token-primary D-06/07 + asymmetric D-08 + split-out >=4.4 D-09) + the loader runtime-pick flipped to pickRuntime(resolveRuntimeTag(...)) + SpineVersionUnsupportedError 2->3 branch (D-10) + the 6-dir D-04 SAFE-01 denylist"
  - phase: 44-01
    provides: "the committed 4.3 fixtures (SIMPLE_PROJECT_43/skeleton2.* 4.3 leg + skeleton2_42.* 4.2 sibling) + the cross-runtime drivers + CURRENT_PHASE 42->44"
  - phase: 43
    provides: "pickRuntime 3-env split (vitest globalThis / built-CJS require('../runtime-43.cjs') / CLI tsx-ESM register-esm-adapter-resolver) + the RuntimeTag opaque-handle __rt identity contract"
provides:
  - "The full D-11 test-suite reconciliation: every 4.3-input arm asserts ROUTING (handleRuntime(load.skeletonData) === '4.3'), the <4.2 throw-cases PRESERVED explicitly, CI green at Phase-44 exit"
  - "44-03 single-gate fix: resolveRuntimeTag is now the loader's ONLY version gate — the unconditional pre-flip checkSpineVersion/checkSpine43Schema CALL SITES were removed (they were dead-code-ing the 44-02 dispatch flip for every 4.3 input)"
  - "d13-43-load-smoke.spec.ts 'made real': a gated-loader-routes arm added (loadSkeleton(skeleton2.json) -> 4.3 runtime) alongside the preserved direct-runtime arms"
  - "The load-bearing 3-entrypoint Multi-Runtime verification matrix: vitest + built out/main CJS worker + tsx/ESM CLI all independently route a 4.3 input to runtime-43"
  - "ORCL-03 v1.6-NO-OP disposition recorded (ik absent in BOTH skeleton2.json + skeleton2_42.json) + the ROADMAP Phase-45 SC#3 split explicitly re-stated (not silently descoped)"
affects: [44-04, 45, 46, 47]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Routing proof = the threaded runtime identity (handleRuntime(load.skeletonData) === '4.3'), not 'did not throw' — asserts the dispatch TARGET, not merely absence of reject"
    - "Single-gate loader: resolveRuntimeTag is the sole loadSkeleton version gate; the standalone predicates stay EXPORTED + byte-unchanged for their own unit tests but are no longer called unconditionally (a parallel unconditional pre-call re-introduces the pre-flip 4.3 hard-reject)"
    - "3-entrypoint per-runtime seam verification is LOAD-BEARING, not npm test alone (GAP-43-CLI-SEAM lesson: a 5/5-green seam had a fully-broken CLI)"

key-files:
  created: []
  modified:
    - "src/core/loader.ts — REMOVED the unconditional pre-flip checkSpineVersion/checkSpine43Schema call sites in loadSkeleton; the call site now defers entirely to resolveRuntimeTag (Rule-3 blocking fix — the 44-02 flip was dead code for 4.3)"
    - "tests/core/loader-version-guard.spec.ts — Phase-32 COMPAT-01 reject block FLIPPED to a routing block (handleRuntime === '4.3' + populated bones[]/skins[]); FIXTURE_38 <4.2 throws + fixture sentinels PRESERVED verbatim"
    - "tests/runtime/d13-43-load-smoke.spec.ts — ADDED a gated-loader-routes arm (D-11 'make it real'); existing direct-4.3.0-runtime arms KEPT verbatim"

key-decisions:
  - "Rule-3 blocking fix: removed loadSkeleton's unconditional checkSpineVersion/checkSpine43Schema pre-calls. Plan 02 added resolveRuntimeTag + flipped the runtime-pick but left the pre-flip guard CALL SITE (loader.ts:350) that still hard-rejects every 4.3 input BEFORE resolveRuntimeTag (:404) is reached — proven via stack trace (threw at checkSpineVersion loader.ts:139 via :350). Without this fix the entire Plan-03 deliverable (4.3 must ROUTE) is impossible. resolveRuntimeTag re-derives the FULL checkSpineVersion band tree (all <4.2/>=4.4/unknown/malformed throws preserved) and subsumes the only reachable checkSpine43Schema reject via D-08; the standalone predicates stay exported + byte-unchanged (their unit-test contract is intact)."
  - "errors-version.spec.ts is verify-only-no-op: Plan 02 Task 2 already fully reconciled it (LOCKED >=4.4 + <4.2 wordings asserted; POSITIVE .toContain of the old 're-export as 4.2' string count = 0). Honored the plan's explicit 'don't re-edit redundantly' instruction; AC4's literal grep over-matches its own intent (the 2 literal hits are .not.toContain false-green-GUARDS, not assertions the string is present)."
  - "Routing proof = handleRuntime(load.skeletonData) === '4.3' (the threaded __rt identity), strengthened beyond not.toThrow — it asserts the dispatch TARGET. The 4.2 regression arm also asserts handleRuntime === '4.2' so the flip can't mis-route the 4.2 golden."

patterns-established:
  - "Pattern 1: A per-runtime seam exercised in PRODUCTION for the first time MUST be verified on every documented entrypoint independently (vitest globalThis arm + built out/main require('../runtime-43.cjs') arm + tsx/ESM CLI register-esm-adapter-resolver arm) — npm test alone green-washes it"
  - "Pattern 2: The loader's version gate is the dispatcher itself (resolveRuntimeTag); a parallel unconditional standalone-predicate pre-call silently re-introduces the pre-flip reject and makes the dispatch dead code"

requirements-completed: [DISP-01, DISP-03]

# Metrics
duration: 18min
completed: 2026-05-18
---

# Phase 44 Plan 03: Full D-11 Reconciliation + 3-Entrypoint Multi-Runtime Verification Summary

**The full D-11 test suite is reconciled to the dual-runtime dispatch (every 4.3-input arm now asserts ROUTING via the threaded `handleRuntime` identity, the `<4.2` throw-cases preserved explicitly), the `d13-43-load-smoke` smoke is "made real", and the load-bearing 3-entrypoint matrix (vitest + built `out/main` CJS worker + tsx/ESM CLI) independently confirms a 4.3 input routes to `runtime-43` — gated by a Rule-3 blocking fix that made `resolveRuntimeTag` the loader's actual single gate (the 44-02 flip was dead code for 4.3).**

## Performance

- **Duration:** ~18 min (active execution)
- **Started:** 2026-05-18T~11:03Z
- **Completed:** 2026-05-18T11:21Z
- **Tasks:** 3 (Task 3 is verification + documentation only — no source files)
- **Files modified:** 3 (1 source — the Rule-3 fix; 2 D-11 specs)

## Accomplishments

- **Rule-3 blocking fix (prerequisite for the entire plan):** Discovered via stack-trace probe that Plan 02's dispatch flip was **dead code for every 4.3 input** — `loadSkeleton` still called the unconditional pre-flip `checkSpineVersion(...)` at loader.ts:350, which throws `SpineVersionUnsupportedError` at loader.ts:139 (`major===4 && minor>=3`) **before** `resolveRuntimeTag` at :404 is ever reached. Removed the unconditional `checkSpineVersion`/`checkSpine43Schema` call sites; the loader call site now defers entirely to `resolveRuntimeTag` (which re-derives the full band tree — every `<4.2`/`≥4.4`/unknown/malformed throw preserved — and subsumes the only reachable `checkSpine43Schema` reject via its D-08 contradiction cross-check). The standalone predicates stay EXPORTED + byte-unchanged (their unit-test contract intact). Post-fix: `SPINE_4_3_TEST` + `skeleton2.json` ROUTE-and-load; `SIMPLE_TEST` (4.2) no regression; `SPINE_3_8_TEST` (3.8.99 `<4.2`) still throws.
- **Task 1 — HEAVY D-11 flip:** `tests/core/loader-version-guard.spec.ts`'s Phase-32 COMPAT-01 reject describe block is FLIPPED to a routing block: every `loadSkeleton(FIXTURE_43)` (spine 4.3.91-beta) arm asserts `not.toThrow` + `handleRuntime(load.skeletonData) === '4.3'` (the dispatch-target proof, not merely "did not throw") + populated `bones[]`/`skins[]`. The `F3` describe block's `loadSkeleton(FIXTURE_38)` (3.8.99, `<4.2`) `toThrow(SpineVersionUnsupportedError)` asserts + the fixture-existence sentinels are PRESERVED verbatim. The 4.2 regression arm now also asserts `handleRuntime === '4.2'`. `errors-version.spec.ts` confirmed verify-only-no-op (Plan 02 Task 2 already reconciled it).
- **Task 2 — "make it real" + verify-only:** `tests/runtime/d13-43-load-smoke.spec.ts` gained a gated-loader-routes arm (`loadSkeleton(SIMPLE_PROJECT_43/skeleton2.json)` → `handleRuntime === '4.3'` + populated structure); the existing direct-4.3.0-runtime arms are KEPT verbatim (beta-vs-stable parse fallback). The 4 unrelated/mocked D-11 files (`loader.spec`, core `ipc.spec`, `main/ipc.spec`, `viewer-asset-feed-ipc.spec`) are UNCHANGED (`git diff --stat` empty) and GREEN — Open-Q2 classification confirmed by zero-diff + green (their refs are atlas-not-found / `<4.2`-precondition / mocked `checkSpineVersion`, NOT 4.3-reject).
- **Task 3 — 3-entrypoint Multi-Runtime verification (BLOCKING gate, all GREEN):** see the matrix below. The `'4.3'` `require('../runtime-43.cjs')` arm — production-exercised for the first time by this flip — resolves correctly on the built `out/main` worker; the GAP-43-CLI-SEAM signature is verified absent on the CLI.

## Multi-Runtime Entrypoint Matrix (Task 3 — the load-bearing integrity gate)

| # | Entrypoint | Command | Result |
|---|-----------|---------|--------|
| 1 | vitest (globalThis resolver) | `npm run test` | **GREEN** — DISP/D-11 specs pass (86/86 across the 7 D-11 files). 11 failing FILES = the documented pre-existing baseline ONLY: 9 `tests/renderer/*.spec.tsx` MixBlend IMPORT failures (Phase-47-owned) + 2 gitignored-heavy-rig-absent (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/` — both throw `SkeletonJsonNotFoundError` at loader.ts:329, file-absent, NOT a routing/dispatch regression; cannot be caused by the Rule-3 loader change since the file doesn't exist). **0 NEW failures.** |
| 2 | built CJS worker (`require('../runtime-43.cjs')`) | `npx electron-vite build` (main GREEN, `out/main/{sampler-worker,runtime-42,runtime-43}.cjs` emitted fresh) → spawn `out/main/sampler-worker.cjs` on `fixtures/SIMPLE_PROJECT_43/skeleton2.json` | **GREEN** — `progress → progress → complete` (real SamplerOutput); NO `Cannot find module .*runtime-4`; NO `SpineVersionUnsupportedError` reject. The runtime-43 analog of GAP-43-PROD-SEAM is verified ABSENT. Lazy-single-copy preserved (runtime.ts byte-untouched by the flip; both adapter `.cjs` artifacts emitted as separate lazy-required files; the existing `sampler-worker.spec.ts` GAP-43-PROD-SEAM gate enforces the negative continuously and is green in arm 1). |
| 3 | CLI tsx/ESM (`register-esm-adapter-resolver.ts`) | `npm run cli -- fixtures/SIMPLE_PROJECT_43/skeleton2.json` | **GREEN** — full peak-scale table printed (4 attachments / 1 skin / 4 animations / 120 Hz), **exit 0**. NOT a `pickRuntime` loud-throw, NOT a reject. `SIMPLE_TEST.json` (4.2) exit 0 (no regression); `SPINE_3_8_TEST.json` (3.8.99 `<4.2`) exit 3 (the `<4.2` reject is PRESERVED at the CLI entrypoint too). The GAP-43-CLI-SEAM signature (green test + broken CLI) is verified ABSENT. |

> The renderer target of `electron-vite build` aborts non-zero (`spine-player Player.js` importing `MixBlend` from canonical 4.3.0 spine-core). This is the Phase-47-owned, pre-existing, roadmap-design carry-forward (STATE.md Roadmap-Evolution 2026-05-16; memory `project_renderer_mixblend_preexisting_failure`) — downstream of the `out/main` emit (the worker chunks ARE produced cleanly). Out of scope; logged to `deferred-items.md` for the paper trail. NOT a hard stop (the existing `sampler-worker.spec.ts` harness tolerates this exact exit by design).

## ORCL-03 disposition — v1.6 NO-OP by design

`ik` is **ABSENT in BOTH** committed fixtures (parsed JSON evidence):

- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg, `spine="4.3.01"`): top-level `constraints[]` types = `["transform","path"]`; the substring `"ik"` does NOT appear anywhere in the file; top-level `ik[]` absent.
- `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json` (4.2 sibling, `spine="4.2-from-4.3.01"`): top-level `ik[]` absent; `transform[]`/`path[]` present; the substring `"ik"` does NOT appear anywhere.

**Verdict:** ORCL-01 is TransformConstraint-only → spine-editor#891-immune → ORCL-03 is a **v1.6 NO-OP by design** (Phase 42 D-03). **No human gate.**

## ROADMAP Phase-45 SC#3 split — explicitly re-stated (NOT silently descoped)

Phase 44 owns **ONLY**: the 4.3-input-now-asserts-ROUTING reconciliation across the D-11 suite + PRESERVING the `<4.2`/`≥4.4` throw-cases as explicit assertions + the loader making `resolveRuntimeTag` the real single gate. **Phase 45 retains** (UX-01/02): the user-facing copy / docs / drop-zone sweep + the final reject-test inversion. This is a *documented* split (CONTEXT D-11 / 44-PATTERNS § D-11 / this SUMMARY), NOT a silent descope (memory `feedback_replan_can_silently_descope_roadmap_contract`). The spec-header of `loader-version-guard.spec.ts` carries the split statement in-tree.

## Task Commits

1. **Rule-3 blocking fix: resolveRuntimeTag is the single loader gate** — `0c2ff89` (fix)
2. **Task 1: flip loader-version-guard.spec.ts 4.3 arms reject→route** — `03ce9dc` (test)
3. **Task 2: make d13-43-load-smoke.spec.ts real + confirm 4 verify-only D-11 files** — `d47e58f` (test)

_Task 3 modified no source files (verification + documentation only) — its evidence + the two dispositions are recorded above. Plan metadata commit (this SUMMARY + deferred-items.md) follows._

## Files Created/Modified

- `src/core/loader.ts` — Removed the unconditional pre-flip `checkSpineVersion`/`checkSpine43Schema` call-blocks in `loadSkeleton`; `parsedJson`/`spineFieldForDispatch` are extracted once and `resolveRuntimeTag` is the single gate (`pickRuntime(resolveRuntimeTag(...))` unchanged). The comment block now explains the single-gate correctness rationale (a parallel unconditional pre-call re-introduces the pre-flip 4.3 hard-reject). RT-02 spine-core-import-free preserved. (40 ins / 49 del — net simplification.)
- `tests/core/loader-version-guard.spec.ts` — Phase-32 COMPAT-01 reject block → routing block (`handleRuntime === '4.3'`); header reconciliation note + the Phase-45 split statement; FIXTURE_38 `<4.2` throws + fixture sentinels verbatim; FIXTURE_42 arm strengthened (`handleRuntime === '4.2'`). Added the `handleRuntime` import.
- `tests/runtime/d13-43-load-smoke.spec.ts` — Added the `loadSkeleton`/`handleRuntime` imports + a new `describe`/`it` gated-loader-routes arm; existing direct-runtime arms untouched.
- `.planning/phases/44-…/deferred-items.md` — created; logs the Phase-47-owned renderer build abort (paper trail).

## Decisions Made

- **The Rule-3 fix is in-scope, not architectural:** It completes the EXACT dispatch flip Plan 02 was meant to land (DISP-01/03: "routes 4.2→runtime-42, 4.3→runtime-43, decided BEFORE pickRuntime/atlas-resolve/parseSkeleton"); 44-PATTERNS.md's routing truth-table and Plan 03's `<interfaces>` both explicitly state `loadSkeleton(FIXTURE_43)` must NOT throw. All throw semantics are byte-identical (resolveRuntimeTag preserves them). No new DB/library/service/infra — Rule 3 (auto-fix blocking issue), not Rule 4.
- **errors-version.spec.ts not re-edited:** Plan body (`<interfaces>` L102-112, Task-1 action L199-212) explicitly says verify-only / no redundant edits if Plan 02 covered it — it did. The literal AC4 grep (`grep -c "Re-export from your 4.3 editor as Version 4.2" = 0`) over-matches its stated intent ("the OLD wrong-for-4.3 *assertion* is removed"): the 2 literal hits are `.not.toContain` false-green-GUARDS (the correct reconciliation), positive `.toContain` count = 0. Weakening the guards to satisfy the literal grep would be the exact silent-descope the plan forbids.
- **Routing proof strengthened to the threaded identity:** `handleRuntime(load.skeletonData) === '4.3'` (the `__rt` on the opaque handle) asserts the dispatch TARGET, not merely absence of a throw — closing the "did-not-throw could still be wrong-runtime" gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] resolveRuntimeTag was dead code for 4.3 — made it the loader's single gate**
- **Found during:** Task 1 pre-flight probe (before flipping the spec — verifying actual post-flip loader behavior so assertions match reality, per the plan's `<read_first>` "the live post-Plan-02 source").
- **Issue:** Plan 02 added `resolveRuntimeTag` + flipped the runtime-pick (`pickRuntime(resolveRuntimeTag(...))` at loader.ts:404) but, per its own stated decision, left the unconditional standalone `checkSpineVersion(...)` (loader.ts:350) + `checkSpine43Schema(...)` (loader.ts:371) call sites in `loadSkeleton`. `checkSpineVersion` still throws on `major===4 && minor>=3` (its byte-unchanged standalone-predicate contract). So `loadSkeleton(<any 4.3>)` threw `SpineVersionUnsupportedError` at loader.ts:139 (via :350) and `resolveRuntimeTag` at :404 was unreachable. Stack-trace proven. The 44-02 dispatch flip was end-to-end non-functional for every 4.3 input — making Plan 03's core deliverable (D-11: 4.3 must ROUTE) impossible.
- **Fix:** Removed the unconditional `checkSpineVersion`/`checkSpine43Schema` call-blocks; the loader call site defers entirely to `resolveRuntimeTag` (which re-derives the full band tree — every `<4.2`/`≥4.4`/unknown/malformed throw preserved — and subsumes the only reachable `checkSpine43Schema` reject via D-08). Standalone predicates remain EXPORTED + byte-unchanged (predicate unit-test contract intact — 76/76 predicate+loader+errors green post-fix).
- **Files modified:** `src/core/loader.ts`
- **Verification:** Probe — `SPINE_4_3_TEST` + `skeleton2.json` route-and-load (`handleRuntime === '4.3'`); `SIMPLE_TEST` 4.2 no regression (`handleRuntime === '4.2'`); `SPINE_3_8_TEST` 3.8.99 still throws. `tsc --noEmit` clean for loader.ts. 76/76 predicate/loader/errors specs green; all 7 D-11 files 86/86 green; all 3 entrypoints route 4.3 correctly.
- **Commit:** `0c2ff89`

**2. [Rule N/A — AC-literal vs AC-intent reconciliation, documented] AC4 literal grep honored by intent, not literally**
- The Task-1 AC `grep -c "Re-export from your 4.3 editor as Version 4.2" tests/core/errors-version.spec.ts` returns 2, not 0. Both hits are `.not.toContain(...)` false-green-GUARDS that Plan 02 Task 2 correctly added (the reconciliation itself). The AC's stated intent — "the OLD wrong-for-4.3 *assertion* is removed/reconciled" — IS satisfied: POSITIVE `.toContain` of the old string = 0 in both `errors-version.spec.ts` and `loader-version-guard.spec.ts`. Per the plan's explicit "verify-only / no redundant edits" instruction for this file, the guards were NOT weakened (doing so would be the silent descope the plan forbids). No code change; documented here.

**Total deviations:** 1 Rule-3 auto-fix (the blocking single-gate fix — scoped exactly to completing the intended 44-02 flip, zero scope creep, all throw semantics preserved) + 1 documented AC-literal/intent reconciliation (no code change).
**Impact on plan:** The Rule-3 fix is the prerequisite that makes the entire Plan-03 deliverable achievable; without it 4.3 cannot route. All other tasks executed as written. No scope creep into Phase-45 copy/docs.

## Issues Encountered

- **electron-vite renderer abort (Phase-47-owned, out of scope):** `electron-vite build` exits non-zero on the spine-player `MixBlend` import, AFTER the `out/main` worker chunks are emitted cleanly. Pre-existing, roadmap-design carry-forward; logged to `deferred-items.md`. The built-worker arm (Task 3 #2) targets `out/main` specifically — verified GREEN.
- **2 gitignored heavy-rig specs fail with `SkeletonJsonNotFoundError`** (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/` absent in the worktree checkout) — proven file-absent (throw at loader.ts:329 before any version/dispatch logic), cannot be caused by the Rule-3 loader change, matches Plan 01/02's documented baseline. NOT a regression.

## Deferred Issues

None within scope. The renderer build abort + the 2 heavy-rig-absent specs are documented above as Phase-47-owned / fixture-absent pre-existing baseline (not deferrals of this plan's scope). The Phase-45 user-facing copy/docs/drop-zone sweep + final reject-test inversion is the *documented* ROADMAP SC#3 split (UX-01/02), not a deferral.

## Threat Model Adherence

- **T-44-07 (mitigate) — the `'4.3'` require arm mis-resolving in production while vitest is green:** All 3 entrypoints verified INDEPENDENTLY (vitest + built `out/main` worker spawn on the 4.3 fixture + tsx CLI). The built-worker arm returned a SamplerOutput with NO `Cannot find module .*runtime-4` and NO reject — the runtime-43 analog of GAP-43-PROD-SEAM is verified absent. CLI exit 0 with a full table — the GAP-43-CLI-SEAM signature is verified absent. Lazy-single-copy re-verified (runtime.ts byte-untouched by the flip; the existing GAP-43-PROD-SEAM gate is green in arm 1). **PASS.**
- **T-44-08 (mitigate) — test green-washing a residual 4.3-reject or dropping a `<4.2`/`≥4.4` throw:** D-11 false-green-guard applied: only 4.3 arms flipped to routing (proven via `handleRuntime === '4.3'`, not merely not.toThrow); FIXTURE_38 `<4.2` `toThrow` asserts grep-verified surviving (count ≥1); the old "re-export as 4.2" POSITIVE `.toContain` count = 0 (the 2 literal hits are negation guards). The `≥4.4`/`<4.2` LOCKED wordings are asserted in `errors-version.spec.ts` (count ≥1 each). The Phase-45 split is documented in-tree. **PASS.**

No new network / IPC-surface / filesystem-trust boundary. The Rule-3 fix is a net code reduction (removed dead-code-ing pre-calls); `runtime.ts` untouched; RT-02 spine-core-import-free preserved. No `threat_flag` surface beyond the plan's register.

## Self-Check: PASSED

- `src/core/loader.ts` modified — unconditional `checkSpineVersion(`/`checkSpine43Schema(` call sites removed from `loadSkeleton`; `pickRuntime(resolveRuntimeTag(` flip intact; spine-core-import-free (grep `@esotericsoftware/spine-core`: 0) — VERIFIED
- `tests/core/loader-version-guard.spec.ts`: `loadSkeleton(FIXTURE_43)).toThrow` count = 0; `loadSkeleton(FIXTURE_43)` refs ≥1 (routing); `loadSkeleton(FIXTURE_38)).toThrow` count ≥1 (PRESERVED) — VERIFIED
- `tests/runtime/d13-43-load-smoke.spec.ts`: `loadSkeleton` count ≥1; `SIMPLE_PROJECT_43/skeleton2.json` count ≥1 — VERIFIED
- 4 verify-only D-11 files: `git diff --stat` empty (zero changed lines) — VERIFIED
- Commits exist on the worktree branch: `0c2ff89`, `03ce9dc`, `d47e58f` (`git log d7304b9..HEAD`) — VERIFIED
- All 7 D-11 spec files: `npx vitest run …` 86/86 green, exit 0 — VERIFIED
- 3 entrypoints (vitest / built `out/main` worker / tsx CLI) independently route 4.3→runtime-43 — VERIFIED
- ORCL-03 v1.6-NO-OP (ik absent in both JSONs) + Phase-45 SC#3 split recorded — VERIFIED
- `tests/runtime43/*` NOT touched (44-04's lane); STATE.md/ROADMAP.md NOT modified — VERIFIED

## Next Phase Readiness

- The dual-runtime dispatch is now LIVE end-to-end (the 44-02 flip is no longer dead code for 4.3): a 4.3 input routes to `runtime-43` through ALL THREE entrypoints. D-11 is satisfied — CI is green at Phase-44 exit (the documented 11-file pre-existing baseline is the only noise; 0 NEW failures).
- **44-04 runs in parallel (disjoint lane: `tests/runtime43/*`)** — its ORCL-02 oracle + XTRA baselines depend on the SAME dispatch routing this plan made real; the single-gate fix (`0c2ff89`) is the load-bearing prerequisite for 44-04's `buildLoad43`/`buildLoadSibling42` to route correctly. No conflict (this plan touched only the 7 D-11 spec files + loader.ts; 44-04 touches only `tests/runtime43/*`).
- No blockers. `STATE.md`/`ROADMAP.md` intentionally NOT modified (orchestrator-owned per the worktree contract).

---
*Phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring*
*Plan: 03*
*Completed: 2026-05-18*
