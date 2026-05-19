---
phase: 47-spine-player-4-3-0-bump-viewer-regression
verified: 2026-05-19T11:05:00Z
status: passed
score: 2/2 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  note: initial verification (no prior 47-VERIFICATION.md)
---

# Phase 47: spine-player 4.3.0 Bump + Viewer Regression Verification Report

**Phase Goal:** Bump the decoupled spine-player viewer to 4.3.0, migrating the removed apply-model imports, and re-run the carried Phase 41 viewer UATs — delivered as a DUAL-RUNTIME viewer (DV-1/DV-2: the original single-runtime 4.3-only model was falsified; spine-core@4.3.0 categorically cannot parse 4.2 split-array constraint JSON).
**Verified:** 2026-05-19T11:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC#1 (PLAYER-01) | `@esotericsoftware/spine-player` bumped 4.2.111→4.3.0; MixBlend/MixDirection dropped from AnimationPlayerModal.tsx and migrated to the new `apply(fromSetup, add, out, appliedPose)` model | ✓ VERIFIED | `package.json:27` = `"@esotericsoftware/spine-player": "4.3.0"` (exact, no caret); lockfile resolves canonical spine-player/webgl/core all 4.3.0. AnimationPlayerModal.tsx: 0 MixBlend/MixDirection, import from `@esotericsoftware/spine-player`, migrated 10-arg `anim.apply(probe, t, t, false, [], 1, /*fromSetup*/ true, /*add*/ false, /*out*/ false, /*appliedPose*/ false)` at L260; 0 stale 4.2 method names; literal `updateWorldTransform(2)` preserved; no `(p as any).playTime`. The +1 falsified `premultipliedAlpha` key removed (47-01 Deviation 1, source-verified — AssetManager pma=false default reproduces straight-alpha). `typecheck:web` exits 0. |
| SC#2 (PLAYER-02, DV-2 reworded) | Viewer renders a 4.2 fixture via the FROZEN spine-player@4.2.111 path AND a 4.3 fixture via the MIGRATED spine-player@4.3.0 path; GL straight-alpha independently re-verified; 5 carried Phase 41 HUMAN-UATs re-run per the DV-3 matrix | ✓ VERIFIED | **Dual-runtime machine half:** npm-alias trio (`spine-player-42`/`spine-webgl-42`/`spine-core-42`) in package.json:35-37, lockfile nests `spine-player-42 → spine-core@4.2.111 + spine-webgl@4.2.111` with canonical at 4.3.0. `SkeletonSummary.runtimeTag: '4.2' \| '4.3'` REQUIRED field (types.ts:801, inside the interface declared L756). `summary.ts:552 runtimeTag: rt.tag` from `rt = load.runtime` (L325, null-guarded). `AnimationPlayerModalRouter` dispatches SOLELY on `props.summary.runtimeTag === '4.2'` (no JSON/`.spine`/`resolveRuntime` in executable code — all 3 hits comment-only). AppShell:2546 mounts the router (0 direct modal mounts). Frozen `AnimationPlayerModal42.tsx` diff vs `git show 9f967d2: \| sed (2 transforms)` == EXACTLY the 12-line `@ts-nocheck` sentinel (`0a1,12`) and nothing else — body byte-identical (LOCKED owner-sanctioned design). 4.3-leg modal + spec byte-untouched since 5b35935; zero src/core/ diff across 9f967d2^..HEAD. T-A/T-B/T-C/T-D guards 38/38 GREEN. **Visual half:** owner DV-3 UAT signed (`status: passed`, `approved_by: user`, `approved_at: 2026-05-19`, 7/7 `result: passed`, 0 `[pending]`) — the binding D-02 gate. |

**Score:** 2/2 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `package.json` | spine-player exact 4.3.0 + alias trio | ✓ VERIFIED | L26-27 canonical 4.3.0; L35-37 spine-core-42/spine-player-42/spine-webgl-42 exact `npm:@esotericsoftware/...@4.2.111` |
| `package-lock.json` | nested 4.2.111 graph, canonical 4.3.0 | ✓ VERIFIED | spine-player-42 nests spine-core/webgl @4.2.111; canonical all 4.3.0 |
| `src/renderer/src/modals/AnimationPlayerModal.tsx` (4.3 leg) | migrated Pose API, byte-untouched since 5b35935 | ✓ VERIFIED | 1045 lines; 0 MixBlend/MixDirection; 10-arg apply; git diff 5b35935..HEAD EMPTY |
| `src/renderer/src/modals/AnimationPlayerModal42.tsx` (4.2 leg) | byte-verbatim 9f967d2 + 2 seds + @ts-nocheck | ✓ VERIFIED | 1012 lines; diff vs transformed 9f967d2 == only the 12-line sentinel; imports `spine-player-42`; retains MixBlend/MixDirection (×3 — proof it is literal v1.5.1) |
| `src/renderer/src/modals/AnimationPlayerModalRouter.tsx` | runtimeTag dispatcher, no re-detection | ✓ VERIFIED | branches `runtimeTag === '4.2'`; 0 JSON-sniff in code; renders both real modals |
| `src/shared/types.ts` | required runtimeTag on SkeletonSummary | ✓ VERIFIED | L801 `runtimeTag: '4.2' \| '4.3';` (no `?`), inside `SkeletonSummary` |
| `src/main/summary.ts` | runtimeTag from load.runtime.tag | ✓ VERIFIED | L552 `runtimeTag: rt.tag` from L325 `const rt = load.runtime` (guarded) |
| `tests/runtime/reg4701-buildsummary-handoff.spec.ts` (T-A) | permanent REG-47-01 handoff guard | ✓ VERIFIED | exists; GREEN; asserts full loadSkeleton→sampleSkeleton→buildSummary, runtimeTag 4.3/4.2 |
| `tests/runtime/dual-viewer-routing.spec.ts` (T-B) | routing + alias-distinctness | ✓ VERIFIED | exists; GREEN |
| `tests/runtime/dv1-42-parse-guard.spec.ts` (T-C) | 4 DV-3 fixtures clean-via-42/throw-via-4.3 | ✓ VERIFIED | exists; GREEN |
| `tests/renderer/animation-player-modal-42.spec.tsx` (T-D) | frozen-modal unit spec | ✓ VERIFIED | exists; mocks spine-player-42; 26 pre-e08a2a3 4.2 tokens; GREEN |
| `.planning/ROADMAP.md` / `REQUIREMENTS.md` | DV-2 reworded, same ID | ✓ VERIFIED | SC#2 DV-2 wording; `through the 4.3 player`=0; PLAYER-03=0; GL-alpha+5-UAT clauses survive |
| `.planning/.../47-VALIDATION.md` | coherent rewrite, no dead rows | ✓ VERIFIED | `47-02-0`=0; `through the 4.3 player`=0; 4 real T-A..T-D filenames (9 occ); 47-01 rows retained (3) |
| `.planning/.../47-HUMAN-UAT.md` | owner-signed DV-3 matrix | ✓ VERIFIED | status passed, approved_by user, 7× passed, 0 pending, full DV-3 matrix |
| `.planning/phases/41-.../41-HUMAN-UAT.md` | D-08 in-place flip | ✓ VERIFIED | 0 pending; 8 Phase 47 + 7 47-HUMAN-UAT.md pointers; test-1 gaps fixed_in preserved (b40b338 + 6600761/f772427) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/main/summary.ts` | `load.runtime.tag` | `runtimeTag: rt.tag` additive return field | ✓ WIRED | rt bound L325 (REG-47-01 fix), guarded L326, returned L552 — real loader-resolved source, not hardcoded |
| `SkeletonSummary.runtimeTag` | `AnimationPlayerModalRouter` | `props.summary.runtimeTag === '4.2'` branch | ✓ WIRED | required compile-time field consumed; no re-detection |
| `AppShell.tsx` | `AnimationPlayerModalRouter` | import L67 + JSX mount L2546 (`summary={effectiveSummary}`) | ✓ WIRED | 0 direct `<AnimationPlayerModal>` mounts; router takes the byte-identical prop contract |
| `AnimationPlayerModalRouter` | both modals | `<AnimationPlayerModal42>` (4.2) / `<AnimationPlayerModal>` (4.3) | ✓ WIRED | both render real modals (not null stubs) |
| `AnimationPlayerModal42.tsx` | `spine-player-42@4.2.111` | `from 'spine-player-42'` | ✓ WIRED | alias resolves nested 4.2.111 stack (lockfile-verified); 0 canonical leak |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `AnimationPlayerModalRouter` | `props.summary.runtimeTag` | `summary.ts` `rt.tag` ← `load.runtime` (core `pickRuntime`, trusted main process) | Yes — T-A empirically asserts `runtimeTag==='4.3'` for skeleton2.json and `'4.2'` for SIMPLE_TEST through the real loadSkeleton→buildSummary chain | ✓ FLOWING |

The dispatch tag is sourced from the core's already-resolved runtime adapter (not a JSON sniff, not a hardcoded literal), null-guarded, threaded as a required compile-time field, and empirically proven to carry the correct per-fixture value end-to-end by the T-A guard.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| T-A/T-B/T-C/T-D headless guards | `npx vitest run` (4 guard files) | 4 files / 38 tests passed | ✓ PASS |
| Full regression suite | `npx vitest run` | 138 files / 1371 passed / 2 skipped / 2 todo / 0 failures @ 66d809a | ✓ PASS |
| Web typecheck | `npm run typecheck:web` | exit 0, 0 errors (@ts-nocheck isolates the 11 v1.5.1-intrinsic frozen-modal errors; 0 out-of-file → alias isolation perfect) | ✓ PASS |
| Frozen modal byte-fidelity | `diff <(git show 9f967d2: \| sed ...) AnimationPlayerModal42.tsx` | only `0a1,12` (the sentinel); body byte-identical | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PLAYER-01 | 47-01 | spine-player 4.2.111→4.3.0 + Pose-API migration | ✓ SATISFIED | SC#1 verified; REQUIREMENTS.md L73 `[x]` Complete, Traceability L146 Complete |
| PLAYER-02 | 47-03/04/05 | dual-runtime viewer (DV-1/DV-2/DV-3) | ✓ SATISFIED | SC#2 verified machine half + owner-signed D-02 UAT; reworded same ID (no PLAYER-03). Traceability row L147 still `Pending` — a documentation-state artifact the orchestrator flips at milestone close; the binding goal-achievement evidence (signed 47-HUMAN-UAT.md) is present |

No orphaned requirements: only PLAYER-01/PLAYER-02 map to Phase 47, both declared in plan frontmatter (47-01 → PLAYER-01; 47-03/04/05 → PLAYER-02). 47-02 SUPERSEDED by 47-05 (LOCKED — no 47-02-SUMMARY owed).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TODO/FIXME/placeholder/stub/return-null in the Router, summary.ts, types.ts | ℹ️ Info | Clean |
| `src/main/summary.ts` | 325-333 | 47-REVIEW WR-01: `load.runtime` is optional-typed; the runtime null-guard message asserts an invariant the type does not express | ⚠️ Info (non-blocking) | Pre-existing type-design nuance, NOT a goal failure: the guard works (throws on null), `runtimeTag: rt.tag` is correctly populated on the documented path, and T-A empirically proves the chain produces the right tag without throwing. A maintainability note only — does not prevent SC#2 |

Note: `AnimationPlayerModal42.tsx` is intentionally byte-verbatim v1.5.1 (LOCKED owner design) — its `@ts-nocheck`, un-migrated body, and 11 strict-TS gaps are the sanctioned, correct, owner-approved state per the dated 47-CONTEXT GA-1 amendment. NOT scanned/flagged as anti-patterns per the locked context.

### Human Verification Required

None outstanding. The visual half of SC#2 (dual-runtime rendering + GL straight-alpha + the 5 carried Phase 41 UATs) is the binding D-02 owner `checkpoint:human-action`, which is **already signed** in 47-HUMAN-UAT.md (`status: passed`, `approved_by: user`, 7/7 `result: passed`, 0 `[pending]`). The human gate has cleared.

Informational observation (NOT a blocking gap, per locked context): the GL-alpha per-leg screenshots were not captured; this is honestly documented in 47-HUMAN-UAT.md (lines 124-127, 352-354, "documented, not fabricated") and 47-05-SUMMARY Deviation 2. The owner is the D-02 authority and approved live; absence of the artifact is recorded transparently, not green-washed.

### Gaps Summary

No gaps. Both ROADMAP success criteria are met:

- **SC#1 (PLAYER-01):** machine-verified — exact 4.3.0 pin, full MixBlend/MixDirection drop + 10-arg apply migration, typecheck:web 0, the falsified `premultipliedAlpha` deviation source-justified and behaviorally neutral.
- **SC#2 (PLAYER-02, DV-2 reworded):** the dual-runtime machine half is fully verified (alias trio + lockfile nesting, required `runtimeTag` threaded from the trusted core, router dispatch with zero re-detection, AppShell mount, byte-verbatim frozen 4.2 modal == 9f967d2+2seds+sanctioned-@ts-nocheck, 4.3 leg + src/core/ byte-untouched, T-A..T-D 38/38 green, full suite 1371/0 @ 66d809a, DV-2 reword non-descoping with traceability clean); the visual half is owner-signed via the binding D-02 47-HUMAN-UAT (passed). The DV-2 reword is a verified reword (same PLAYER-02 ID, GL-alpha + 5-UAT clauses preserved), not a silent descope.

All LOCKED owner/architect decisions (GA-1 → @ts-nocheck sentinel; 47-02 supersession; D-01 no-revert; transcribed blanket owner sign-off with documented screenshot residual; DV-2 reword) were HONORED, not violated. The single 47-REVIEW WARNING (WR-01) is a non-blocking type-expressiveness maintainability note that does not affect goal achievement.

Phase goal achieved. Ready to proceed (v1.6 milestone-close gate satisfied — orchestrator-owned flip of the PLAYER-02 traceability row to Complete is the remaining bookkeeping step).

---

_Verified: 2026-05-19T11:05:00Z_
_Verifier: Claude (gsd-verifier)_
