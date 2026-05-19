---
phase: 47-spine-player-4-3-0-bump-viewer-regression
plan: 04
subsystem: testing
tags: [spine-player, dual-runtime, vitest, regression-guard, npm-alias, runtimeTag, validation, roadmap]

# Dependency graph
requires:
  - phase: 47-03
    provides: the DV-1 npm-alias trio + SkeletonSummary.runtimeTag + AnimationPlayerModalRouter + the frozen AnimationPlayerModal42 (the surface T-A/T-B/T-C exercise)
  - phase: 53e480c (REG-47-01 fix)
    provides: buildSummary materialized via load.runtime.makeSkeleton (the fix T-A is the permanent standing guard for)
provides:
  - tests/runtime/reg4701-buildsummary-handoff.spec.ts — the PERMANENT REG-47-01 cross-runtime buildSummary-handoff regression (the deleted _dbg- throwaway, now git-tracked)
  - tests/runtime/dual-viewer-routing.spec.ts — the T-B dual-runtime routing + DV-RISK-1 alias-distinctness standing guard
  - tests/runtime/dv1-42-parse-guard.spec.ts — the T-C DV-RISK-1 4.2-parse standing guard over all 4 DV-3 fixtures
  - DV-2 reworded PLAYER-02 (same ID) in ROADMAP SC#2 + REQUIREMENTS + Traceability — the falsified single-runtime wording removed, GL-alpha + 5-UAT clauses preserved
  - ROADMAP Phase 47 plan list re-sequenced to 47-01/03/04/05 + the explicit 47-02-SUPERSEDED note
  - 47-VALIDATION.md coherently rewritten (superseded D-09 Plan-02 rows REPLACED by the T-A..T-D + DV-3 owner-checkpoint rows; 47-01 rows retained)
affects: [47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permanent regression-guard for an already-landed fix: the test passes on first run and exists solely to fail loudly if the fix is ever reverted (T-A guards 53e480c)"
    - "Cross-runtime alias distinctness via createRequire of the RESOLVED package.json (non-forgeable; robust to a botched lockfile collapsing the split-brain) — under jsdom env so the resolution arm + the React dispatcher arm co-exist in one .spec.ts"
    - "Coherent VALIDATION.md REPLACE-fold (not append): superseded rows removed + every self-referential meta-mention of the dead tokens reworded so grep-count == 0 is literally true (plan-checker Check 8e / gap-item-9)"

key-files:
  created:
    - tests/runtime/reg4701-buildsummary-handoff.spec.ts
    - tests/runtime/dual-viewer-routing.spec.ts
    - tests/runtime/dv1-42-parse-guard.spec.ts
    - .planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-04-SUMMARY.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-VALIDATION.md

key-decisions:
  - "T-B is one jsdom-env .spec.ts file carrying BOTH the node-style resolution arm (createRequire works identically under jsdom — empirically probed) AND the React dispatcher arm — the fixed artifact path is .spec.ts (not .spec.tsx) so JSX is via React.createElement"
  - "T-C parses each DV-3 fixture with its REAL sibling AtlasAttachmentLoader (not a null stub): the plan's 'null/AtlasAttachmentLoader' option resolved to the real-atlas form because a naive stub fails CHJWC/TQORW color parse (setFromString) — the analog runtime43-d03/d13 idiom uses a real TextureAtlas; clean-via-42/throw-via-43 confirmed for all 4"
  - "DV-2 explanatory parentheticals were reworded to AVOID the literal 'through the 4.3 player' substring anywhere (ROADMAP/REQUIREMENTS AND 47-VALIDATION meta-prose) — the plan's grep-c==0 ACs are binding with no meta-prose exception"

requirements-completed: []   # PLAYER-02's machine half advanced; the binding visual completion is the 47-05 owner UAT (Traceability stays Pending)

# Metrics
duration: 9min
completed: 2026-05-19
---

# Phase 47 Plan 04: T-A/T-B/T-C Dual-Runtime Headless Guards + DV-2 Rewording + 47-VALIDATION Coherent Rewrite Summary

**The DV-1 dual-runtime viewer is now machine-guarded headlessly: T-A makes the deleted REG-47-01 `_dbg-` throwaway a permanent cross-runtime-handoff regression, T-B/T-C are the DV-RISK-1 standing guards (alias split-brain distinctness + the 4 DV-3 constraint-mix fixtures clean-via-spine-player-42 / throw-via-canonical-4.3), and the DV-2 source contract is reworded in ROADMAP/REQUIREMENTS/Traceability + 47-VALIDATION coherently rewritten — same PLAYER-02 ID, no clause descoped, zero `src/` change.**

## Performance

- **Duration:** ~9 min (sequential, main working tree)
- **Started:** 2026-05-19T08:40:30Z · **Completed:** 2026-05-19T08:49:30Z
- **Tasks:** 3 (all executed this run; HEAD verified at `08fa8fd` before starting)
- **Files:** 3 new spec files + 3 planning docs modified (+ this SUMMARY)

## Accomplishments

- **T-A (Task 1, `c3e676a`):** `tests/runtime/reg4701-buildsummary-handoff.spec.ts` — the permanent REG-47-01 cross-runtime-handoff regression (the debug `reg-47-01` Resolution `repro_spec_disposition` explicitly owed this; the original `_dbg-reg4701-full-load-chain.spec.ts` was a never-git-tracked throwaway). Drives the FULL `loadSkeleton → sampleSkeleton → buildSummary` chain (NOT just `loadSkeleton` — that gap is exactly why the Phase-44 D-11 test missed this escapee). 4.3 (`skeleton2.json`): does NOT throw the `reading 'r'` symptom + `summary.runtimeTag === '4.3'`; 4.2 control (`SIMPLE_TEST.json`): `runtimeTag === '4.2'`. GREEN 2/2. Analog: `tests/runtime/d13-43-load-smoke.spec.ts` + `tests/core/summary.spec.ts`.
- **T-B + T-C (Task 2, `a9170ef`):**
  - `tests/runtime/dual-viewer-routing.spec.ts` (jsdom env) — *resolution arm* (real modules, no mock): `spine-player-42`'s transitive `@esotericsoftware/spine-core` resolves `4.2.111` (lacks 4.3-only `Slider`/`BonePose`) while canonical resolves `4.3.0` (the split-brain is real & distinct — GA-3 guard). *Dispatcher arm* (`vi.mock` BOTH modal siblings): `runtimeTag:'4.2'` constructs `AnimationPlayerModal42` (not migrated) / `'4.3'` constructs the migrated modal (not 42); + a router-source guard asserting no `JSON.parse`/`.spine`/`resolveRuntime` re-detection token. Analog: `tests/runtime/runtime-distinctness.spec.ts`.
  - `tests/runtime/dv1-42-parse-guard.spec.ts` (node env) — all 4 DV-3 4.2-leg fixtures (SIMPLE_TEST path / CHJWC_SYMBOLS transform / TQORW_SYMBOLS ik+transform+events / TEST_03 ik+transform+physics) parse CLEAN via `spine-player-42`'s bare core AND THROW via canonical `@esotericsoftware/spine-core@4.3.0`. Analog: `tests/runtime43/runtime43-d03.spec.ts`. GREEN 14/14 (T-B+T-C together).
- **DV-2 reword + ROADMAP re-sequence + 47-VALIDATION rewrite (Task 3, `4c6aad5`):** see the detailed before→after below; zero `src/` and `tests/` change.
- **Plan-level gates:** the 4 T-A..T-D guards GREEN together (38/38); full `npx vitest run` → **138 files / 1371 passed / 2 skipped / 2 todo / 0 failures** — no NEW failures vs the 47-03 post-state (cleaner — the +36 net is exactly the T-A..T-D additions; the documented MixBlend import failures are themselves green here).

## Task Commits

1. **Task 1: T-A permanent REG-47-01 cross-runtime buildSummary handoff regression** — `c3e676a` (test)
2. **Task 2: T-B dual-runtime routing/alias-distinctness + T-C 4.2-parse standing guards** — `a9170ef` (test)
3. **Task 3: DV-2 reword + ROADMAP re-sequence + 47-VALIDATION coherent rewrite** — `4c6aad5` (docs)

## DV-2 — exact before→after of PLAYER-02 SC#2 in ALL 3 places

**Locked replacement wording (47-CONTEXT DV-2, consumed verbatim-in-substance):** *"the viewer renders a 4.2 fixture correctly via the frozen spine-player@4.2.111 path AND a 4.3 fixture via the migrated spine-player@4.3.0 path."*

### 1. `.planning/ROADMAP.md` Phase 47 Success Criteria item 2

**BEFORE:**
> 2. The v1.5.1 viewer renders both a 4.2 and a 4.3 fixture correctly **through the 4.3 player**, GL straight-alpha is independently re-verified (the sharp/libvips PMA reasoning does NOT transfer to spine-webgl GL — no dark-fringe/double-multiply halo on SIMPLE_TEST), and the 5 carried Phase 41 HUMAN-UATs are re-run on the 4.3 player. *(PLAYER-02)*

**AFTER:**
> 2. The viewer renders a 4.2 fixture correctly via the frozen spine-player@4.2.111 path AND a 4.3 fixture via the migrated spine-player@4.3.0 path (DV-1/DV-2 dual-runtime; the original single-runtime 4.3-only-player model was falsified — spine-core@4.3.0 categorically cannot parse 4.2 split-array constraint JSON), **GL straight-alpha is independently re-verified (the sharp/libvips PMA reasoning does NOT transfer to spine-webgl GL — no dark-fringe/double-multiply halo on SIMPLE_TEST)**, and **the 5 carried Phase 41 HUMAN-UATs are re-run** (on the migrated 4.3 leg + the frozen 4.2 leg per the DV-3 matrix). *(PLAYER-02)*

### 2. `.planning/REQUIREMENTS.md` PLAYER-02

**BEFORE:**
> - [ ] **PLAYER-02**: The v1.5.1 viewer renders both a 4.2 and a 4.3 fixture correctly **through the 4.3 player**, GL straight-alpha is re-verified, and the 5 carried Phase 41 HUMAN-UATs are re-run on the 4.3 player.

**AFTER:**
> - [ ] **PLAYER-02**: The viewer renders a 4.2 fixture correctly via the frozen spine-player@4.2.111 path AND a 4.3 fixture via the migrated spine-player@4.3.0 path (DV-1/DV-2 dual-runtime — reworded from the falsified single-runtime 4.3-only-player wording; same requirement, NOT a new ID), GL straight-alpha is re-verified, and the 5 carried Phase 41 HUMAN-UATs are re-run (DV-3 matrix: the migrated 4.3 leg + the frozen 4.2 leg).

### 3. `.planning/REQUIREMENTS.md` Traceability row

**BEFORE:** `| PLAYER-02 | Phase 47 | Pending |`
**AFTER:** `| PLAYER-02 | Phase 47 | Pending |` — **unchanged by design.** The row has no description column; the ID + Phase mapping are preserved and the status correctly stays `Pending` (this plan does NOT complete PLAYER-02 — the binding visual completion is the 47-05 owner UAT, which flips it to Complete).

### Descope / new-ID self-check (memory `feedback_replan_can_silently_descope_roadmap_contract`)

- **GL straight-alpha clause SURVIVED** in ROADMAP SC#2 — `grep -c 'straight-alpha' .planning/ROADMAP.md` ≥ 1 (the full "sharp/libvips PMA does NOT transfer / no halo on SIMPLE_TEST" sub-clause is verbatim-in-substance).
- **"5 carried Phase 41 HUMAN-UATs" clause SURVIVED** in ROADMAP SC#2 — `grep -c '5 carried Phase 41 HUMAN-UATs' .planning/ROADMAP.md` == 2.
- **Same requirement ID, no new ID:** `grep -c 'PLAYER-03' .planning/REQUIREMENTS.md` == 0 AND `grep -c 'PLAYER-03' .planning/ROADMAP.md` == 0; `grep -c 'PLAYER-02' .planning/REQUIREMENTS.md` == 4 (requirement line + Traceability row + the 2 coverage references, all still PLAYER-02).
- **The now-impossible wording is GONE:** `grep -c 'through the 4.3 player' .planning/ROADMAP.md` == 0 AND == 0 in REQUIREMENTS — not merely appended-past; the literal substring is absent.
- **Conclusion:** DV-2 reworded ONLY the player-path half. No clause was dropped; no requirement was descoped; no new requirement ID was introduced. It is a reword of PLAYER-02, not a descope.

## ROADMAP Phase 47 plan-list re-sequence + 47-02-SUPERSEDED note

`**Plans**: 2 plans` → `**Plans**: 4 plans`. The single `- [ ] 47-02-PLAN.md …` bullet was replaced with the three gap-closure bullets (47-03 DV-1/DV-1a/DV-NOTE; 47-04 DV-2/Q4; 47-05 DV-3/D-02/D-08), 47-01's `[x]` bullet unchanged, plus the explicit note:

> 47-02-PLAN.md is SUPERSEDED by the DV-1..DV-3 gap re-discussion (its D-09-matrix 47-HUMAN-UAT.md is re-authored to the DV-3 matrix in 47-05; its owner-checkpoint + 41-flip Tasks are subsumed by 47-05). 47-01 is unchanged (the 4.3 leg).

## 47-VALIDATION.md coherent REPLACE-fold (before→after)

**Before:** the file was the SUPERSEDED single-runtime D-09 artifact — its Per-Task Map carried 3 dead `47-02-01/02/03` rows (47-02 superseded, no SUMMARY), its Manual-Only table carried 2 rows asserting render "through the 4.3 player" (DV-2-falsified), and its Wave-0 / frontmatter prose said "No new test file or framework install needed".

**After (REPLACE, not augment):**
- **Per-Task Map:** the 3 dead `47-02-0*` rows REPLACED by the real `47-03-02` (T-D), `47-04-01` (T-A), `47-04-02` (T-B + T-C), `47-04-03` (DV-2 grep), `47-05-01`/`47-05-02` (DV-3 owner checkpoint) rows — fully instantiated with the actual new filenames (NOT `<…>` placeholders). The 3 `47-01-01/02/03` PLAYER-01 rows RETAINED verbatim (47-01 is COMPLETE).
- **Manual-Only table:** the 2 single-runtime-4.3-player rows REWRITTEN to the DV-3 dual-leg model (the 4 4.2-leg fixtures via the frozen 4.2.111 path + skeleton2.json via the migrated 4.3.0 path; the UAT's job stated as routing + alias-isolation-loads + constraint-mix-incl-physics, NOT re-proving the byte-identical 4.2 renderer). The GL-straight-alpha / same-framing-parity (D-06) / 5-carried-UAT / content-less-STOP rows KEPT, leg references reworded to DV-3. Added the GA-2 §1c(a) dual-stack-bundle build-gate promotion to `/gsd-verify-work`.
- **Wave-0 prose:** corrected from "none needed" to "the 4 T-A..T-D files owed by RESEARCH §7 are created within 47-03/47-04, all with in-repo analogs, no new framework" (`wave_0_complete` stays `true`; only the justification text changed).
- **DV-NOTE rows use the AMENDED LOCKED wording** ("byte-verbatim body + 2 seds + 1 owner-sanctioned `@ts-nocheck` sentinel") per the 47-CONTEXT GA-1 amendment — no relitigation of the `@ts-nocheck` decision.
- `updated:` / `Approval:` bumped to 2026-05-19.
- **REPLACE-not-augment proof (binding):** `grep -c '47-02-0' 47-VALIDATION.md` == **0** AND `grep -c 'through the 4.3 player' 47-VALIDATION.md` == **0** (every self-referential meta-mention of the dead tokens was also reworded so the count is literally zero — the plan's gap-item-9 / Check-8e ACs have no meta-prose exception). All 4 real filenames present (`reg4701-buildsummary-handoff`, `dual-viewer-routing`, `dv1-42-parse-guard`, `animation-player-modal-42` — 3 occurrences each, fully instantiated).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking ambiguity resolved in-scope] T-C "null/AtlasAttachmentLoader" → real sibling AtlasAttachmentLoader**
- **Found during:** Task 2 (pre-write probe of the 4 DV-3 fixtures).
- **Issue:** The plan's T-C action allows "a null / AtlasAttachmentLoader". A probe showed a naive null/stub attachment-loader makes CHJWC_SYMBOLS + TQORW_SYMBOLS THROW on the 4.2 leg too (`Cannot read properties of undefined (reading 'setFromString')` — the stub returns `{}`, color parse fails), which would have falsely broken the clean-via-42 assertion.
- **Fix:** Used each fixture's REAL sibling `.atlas` via a real `TextureAtlas` + `AtlasAttachmentLoader` — exactly the analog idiom (`tests/runtime43/runtime43-d03.spec.ts` / `tests/runtime/d13-43-load-smoke.spec.ts` both use a real `TextureAtlas`). All 4 fixtures then parse CLEAN via `spine-player-42` (anims 4/22/30/2) AND THROW via canonical 4.3.0 (`<X> constraint not found`). This is the plan's own permitted "AtlasAttachmentLoader" branch — no logic/assertion intent changed.
- **Files modified:** `tests/runtime/dv1-42-parse-guard.spec.ts` (the form chosen at authoring time, not a post-hoc edit).
- **Verification:** GREEN 9/9 in T-C; 47-RESEARCH §1d's SIMPLE_TEST result reproduced and generalized to all 4.

**2. [Rule 3 - plan-AC literal-substring conflict] Reworded DV-2/47-VALIDATION explanatory prose to avoid the forbidden literal substrings**
- **Found during:** Task 3 (post-edit grep-AC verification).
- **Issue:** My first-pass explanatory parentheticals/meta-notes legitimately *named* the falsified phrase ("the single-runtime 'through the 4.3 player' model was falsified") and the dead task IDs ("the dead `47-02-0*` rows"). The plan's binding ACs are `grep -c 'through the 4.3 player' == 0` and `grep -c '47-02-0' == 0` with NO exception for meta-prose — a self-referential mention still fails the gate.
- **Fix:** Reworded every self-referential occurrence to a synonym ("the original single-runtime 4.3-only-player model"; "the dead Plan-02 Per-Task rows"; the `47-04-03` grep cell rephrased to describe the check without embedding the literal command string). The substantive meaning is unchanged; the literal substrings are now absent file-wide. Re-verified: both grep-counts == 0 in ROADMAP, REQUIREMENTS, and 47-VALIDATION.md.
- **Files modified:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `47-VALIDATION.md` (within the same Task-3 commit).
- **Verification:** the plan's full Task-3 `<automated>` command emits `DV2_VALIDATION_OK`.

**Total deviations:** 2 auto-fixed (2× Rule 3 — both in-scope blocking-ambiguity resolutions using the plan's own permitted options; neither altered logic, assertions, or any LOCKED CONTEXT/RESEARCH decision; zero `src/` touched). No checkpoint required — no `src/` edit was ever tempted; no LOCKED decision was relitigated (the GA-1 `@ts-nocheck` amendment was consumed verbatim, not re-debated).

## Issues Encountered

- **`grep -c '**Plans**: 4 plans' .planning/ROADMAP.md` == 2, not 1.** Investigated: line 147 is **Phase 44's** independent block (it already had 4 plans pre-existing) and line 184 is my Phase 47 edit. Not a defect — the AC only requires the Phase 47 block show `**Plans**: 4 plans` + the re-sequenced 47-03/04/05 list + the SUPERSEDED note, all present at line 184. Resolved by analysis, no edit.
- **Pre-existing untracked `.planning/debug/*` + `.planning/phases/*/SECURITY.md|*-PATTERNS.md` files** (in the start-of-session git status) are out of scope and were left untouched — not this plan's deliverables, not staged.

## User Setup Required

None — all 3 new specs run headless under the standard `npx vitest run`; no env vars, no external service, no dependency change (the `spine-player-42` alias trio was already installed by 47-03 and restored by `npm ci` from the committed lockfile).

## Self-Check: PASSED

**Created files exist:**
- `tests/runtime/reg4701-buildsummary-handoff.spec.ts` — FOUND
- `tests/runtime/dual-viewer-routing.spec.ts` — FOUND
- `tests/runtime/dv1-42-parse-guard.spec.ts` — FOUND
- `.planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-04-SUMMARY.md` — FOUND (this file)

**Commits exist:** `c3e676a` (T-A), `a9170ef` (T-B+T-C), `4c6aad5` (DV-2/ROADMAP/47-VALIDATION) — all in `git log 08fa8fd..HEAD`.

**Quoted blast-radius gate — `git diff --name-only 08fa8fd..HEAD`:**
```
.planning/REQUIREMENTS.md
.planning/ROADMAP.md
.planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-VALIDATION.md
tests/runtime/dual-viewer-routing.spec.ts
tests/runtime/dv1-42-parse-guard.spec.ts
tests/runtime/reg4701-buildsummary-handoff.spec.ts
```
- `git diff --name-only 08fa8fd..HEAD -- src/` → **EMPTY** (ZERO `src/` change — binding gate)
- `git diff --name-only 08fa8fd..HEAD -- vitest.config.ts electron.vite.config.ts tsconfig.json tsconfig.web.json package.json package-lock.json` → **EMPTY** (no bundler/tsconfig/dependency/CSP/CORS change)
- Exactly the 3 new spec files + ROADMAP + REQUIREMENTS + 47-VALIDATION.md — the binding blast-radius, nothing else.

**Test gates:** the 4 T-A..T-D guards GREEN together (38/38); full `npx vitest run` → 138 files / 1371 passed / 2 skipped / 2 todo / **0 failures** — no NEW failures vs the 47-03 post-state. `typecheck:node` not worsened (no tracked `scripts/**`/`*.test.ts` baseline source touched — git-diff proves it; memory `project_typecheck_node_preexisting_red` baseline unchanged).

**Grep gates:** `47-02-0`==0 AND `through the 4.3 player`==0 in 47-VALIDATION.md AND ROADMAP AND REQUIREMENTS; `PLAYER-03`==0; `frozen spine-player@4.2.111` ≥ 1 in ROADMAP + REQUIREMENTS; GL-alpha + 5-UAT clauses present in ROADMAP SC#2; 47-01 PLAYER-01 rows retained; the plan's full Task-3 `<automated>` → `DV2_VALIDATION_OK`.

## Next Phase Readiness

- **47-05** (wave 5, the binding visual gate) can proceed: T-A/T-B/T-C are the machine half of PLAYER-02; the DV-3 matrix + the blocking owner `checkpoint:human-action` is 47-05's job. The 47-VALIDATION.md `47-05-01`/`47-05-02` rows specify the exact signed-artifact post-conditions 47-05 must satisfy (`approved_by: user`, zero `result: [pending]`, 7× `result: passed`).
- **v1.6 close stays HELD** per D-01 (STRICT, no revert) on the 47-05 owner UAT — unchanged by this plan.
- **Hand-off note:** the GA-1 `@ts-nocheck` amendment was consumed verbatim in the 47-VALIDATION DV-NOTE rows ("byte-verbatim body + 2 seds + 1 owner-sanctioned @ts-nocheck sentinel"); 47-05 must likewise NOT relitigate it. The frozen modal's visual correctness is the binding contract of the 47-05 owner UAT, not tsc.

---
*Phase: 47-spine-player-4-3-0-bump-viewer-regression*
*Plan: 04*
*Completed: 2026-05-19*
