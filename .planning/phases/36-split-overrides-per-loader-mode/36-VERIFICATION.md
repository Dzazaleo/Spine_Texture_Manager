---
phase: 36-split-overrides-per-loader-mode
verified: 2026-05-13T12:18:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 36: Split Overrides Per Loader Mode — Verification Report

**Phase Goal:** Atlas-source / atlas-less loader modes maintain independent override maps (`overrides` + `overridesAtlasLess`), so toggling between modes does not contaminate one bucket with the other's data. Covers SEED-007 split-overrides-per-loaderMode initiative.

**Verified:** 2026-05-13T12:18:00Z
**Status:** passed
**Re-verification:** No — initial verification on a post-fix codebase (REVIEW.md CR-01 + 4 WRs already resolved in commits e08c18e..b990a7f).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + REQUIREMENTS OVR-01..07)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | **OVR-01** ProjectFileV1 + AppSessionState + MaterializedProject carry `overridesAtlasLess` / `restoredOverridesAtlasLess`; SerializableError uses `mergedOverridesBuckets`; no schema bump. | VERIFIED | `src/shared/types.ts` — `grep -c overridesAtlasLess`=7, `restoredOverridesAtlasLess`=1, `mergedOverridesBuckets`=3, stale `mergedOverrides:`=0; ProjectFileV1 still `version: 1`. |
| 2 | **OVR-01 (cont.)** Validator pre-massage substitutes missing `overridesAtlasLess` → `{}` and rejects non-object / non-finite shapes. | VERIFIED | `src/core/project-file.ts:287-310` — pre-massage at 287-289, shape guard at 291-298, per-key finite-number validation at 300-310 (`overridesAtlasLess.${k} is not a finite number`). |
| 3 | **OVR-02** Legacy v1.3.x/v1.4.x .stmproj routing at Open seam by saved `loaderMode`; gated on on-disk key absence per WR-03 fix. | VERIFIED | `src/main/project-io.ts:435-438` reads `Object.prototype.hasOwnProperty.call(parsed, 'overridesAtlasLess')` BEFORE pre-massage; `legacyMapPresent && materialized.loaderMode === 'atlas-less' && !hadOverridesAtlasLessKey` at ~603-635. |
| 4 | **OVR-03** Toggling loaderMode does NOT auto-copy from active bucket. AppShell writes via `setActive` ternary; reads via `activeOverrides` memo. | VERIFIED | `src/renderer/src/components/AppShell.tsx:362-365` — `activeOverrides` memo; lines 632/645 — `setActive = loaderMode === 'atlas-less' ? setOverridesAtlasLess : setOverrides`. Integration test `tests/renderer/appshell-mode-switch-divergence.spec.tsx` (3/3 passing) asserts no leak in either direction. |
| 5 | **OVR-04** `migrateOverrides` runs per-bucket at all 3 IPC seams; `migratedKeyCount` summed; stale keys unioned. | VERIFIED | `src/main/project-io.ts` — `grep -c migrateOverrides(`=7 (6 calls + 1 import); 3 sum/union blocks at Open ~617-622, recovery ~949-954, resample ~1244-1247 (`aSrcRes.migratedKeyCount + aLessRes.migratedKeyCount`, `[...new Set([...aSrcRes.stale, ...aLessRes.stale])]`). Unit tests `tests/main/override-migration.spec.ts` Test 10 + 11 lock contract. |
| 6 | **OVR-05** AppShell holds two Maps; `activeOverrides` flows to 4 buildExportPlan + panels + AtlasPreviewModal; panel + buildExportPlan signatures unchanged; Save serializes both buckets. | VERIFIED | `grep -c overridesAtlasLess AppShell.tsx`=25; `activeOverrides`=24; `buildExportPlan(summary, activeOverrides`=3 + 1 (`effectiveSummary`) — all 4 sites covered via multi-line grep returning 4; `Object.fromEntries(overridesAtlasLess)` in Save serializer; AtlasPreviewModal at line 2160 uses `overrides={activeOverrides}`. Panels untouched (git diff empty per 36-03-SUMMARY.md). |
| 7 | **OVR-05 (cont.)** All 3 setOverrides hydration sites mirrored with setOverridesAtlasLess (runReload 1216, mountOpenResponse 1364, samplingHz-resample 1683). | VERIFIED | `grep -c setOverridesAtlasLess AppShell.tsx`=6 (state init + 2 ternary writes + 3 hydration sites at 1216/1364/1683). `resp.project.restoredOverridesAtlasLess` form returns 2 (matches runReload+samplingHz; mountOpenResponse uses `project.` parameter). |
| 8 | **OVR-05 (cont.)** SEED-007 status: dormant → closed at phase close. | VERIFIED | `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` frontmatter: `status: closed`, `closed_during: 36-split-overrides-per-loader-mode`, `closed: 2026-05-13`; top-of-doc closing note present. |
| 9 | **OVR-06** Round-trip both buckets losslessly through project-file.ts; legacy pre-massage path; per-bucket migration tests. | VERIFIED | `tests/core/project-file.spec.ts` — `Phase 36 — overridesAtlasLess (SEED-007 L-01)` describe block with `pre-massages missing overridesAtlasLess` (Test 1) + `round-trips both buckets losslessly` (Test 2) using DIFFERENT values per bucket (CIRCLE:75 / SQUARE:50); `tests/main/override-migration.spec.ts` Test 10/11 lock per-bucket + stale-union contract. |
| 10 | **OVR-07** AppShell mode-switch divergence integration test: apply-toggle-assert in both directions + samplingHz preservation. | VERIFIED | `tests/renderer/appshell-mode-switch-divergence.spec.tsx` exists (3 tests, all passing). `Phase 36 OVR-07`=2 hits, `does NOT leak`=2, `does NOT overwrite`=2, `samplingHz change preserves`=2 (test name + JSDoc summary). |
| 11 | **D-12 rename** `mergedOverrides` → `mergedOverridesBuckets` plumbed at SerializableError, recovery validator, both rescue sites, AppShell state, App.tsx drag-drop arm, and IPC arg. | VERIFIED | `mergedOverridesBuckets` count: types.ts=3, project-io.ts=10, AppShell.tsx=2, App.tsx=1; stale `mergedOverrides:` code-line count: ALL files = 0. (`.bak` files outside git index — not in codebase.) Recovery validator at `project-io.ts:820-831` returns verbatim `mergedOverridesBuckets must carry both buckets as objects` (WR-02 strict guards). |
| 12 | **D-01..D-04 toast** New `overrideModeToastVisible` state + `onToggleLoaderMode` handler + banner JSX with verbatim D-04 copy + verbatim D-03 localStorage key. | VERIFIED | `Overrides are tracked per loader mode`=1 (verbatim copy with em-dash); `stm.overrideModeToast.suppressed`=3 (doc-comment + getItem + setItem); state at line 450; handler at 675; banner at 2150; toggle-button rewire at 1942 (`onToggleLoaderMode(...)`). |
| 13 | **CR-01 fix** Resample IPC carries BOTH buckets; `handleProjectResample` routes by bucket-name; new regression suite drives the real main-side handler. | VERIFIED | Commit `e08c18e fix(36-CR-01)` exists; `ResampleArgs.overridesAtlasLess?: Record<string, number>` at `src/shared/types.ts:1213`; resample handler at `src/main/project-io.ts:1237-1247` uses `incomingAtlasSource = a.overrides` + `incomingAtlasLess = a.overridesAtlasLess` (no `loaderMode` lookup for bucket routing); `tests/main/project-io.spec.ts` `describe('Phase 36 CR-01 ...')` with 3 regression tests (atlas-less-mode no-leak, auto-mode shape-invariance, back-compat omitted field). |
| 14 | **WR-01 fix** App.tsx drag-drop recovery threads `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` in `reloadProjectWithSkeleton` IPC payload. | VERIFIED | Commit `64e12c1 fix(36-WR-01)` exists; `SerializableError.SkeletonNotFoundOnLoadError` envelope extended with optional fields at `src/shared/types.ts:891-893`; `src/renderer/src/App.tsx:202-204` threads all three; populated at rescue sites in `project-io.ts`. |

**Score:** 14/14 truths verified. **All ROADMAP success criteria 1-5 satisfied.**

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/shared/types.ts` | Type contracts (overridesAtlasLess/restoredOverridesAtlasLess/mergedOverridesBuckets); WR-01 envelope fields | VERIFIED | All 5 type edits present; ResampleArgs.overridesAtlasLess (CR-01) at 1213; SerializableError.loaderMode/sharpenOnExport/safetyBufferPercent (WR-01) at 891-893. |
| `src/core/project-file.ts` | Validator pre-massage + serializer + materializer + PartialMaterialized | VERIFIED | 13 references to overridesAtlasLess; pre-massage at 287-289; shape guard 291-298; per-key validation 300-310; serializer + materializer + PartialMaterialized slots all present. |
| `src/main/project-io.ts` | Per-bucket migration × 3 seams + legacy-routing + mergedOverridesBuckets at rescue/validator + CR-01 bucket-routing + WR-03 key detection | VERIFIED | 7 migrateOverrides( hits (6 calls + import); 13 mergedOverridesBuckets refs; 3 restoredOverridesAtlasLess assignments; routeToAtlasLess + hadOverridesAtlasLessKey both present; resample handler routes by bucket-name (no loaderMode lookup). |
| `src/main/override-migration.ts` | UNCHANGED (mode-invariant helper) | VERIFIED | `git diff --stat` empty since base; 11 pre-existing tests (Tests 1-9 + 6 falsifying regression) still pass alongside new Tests 10/11. |
| `src/renderer/src/components/AppShell.tsx` | Two-Map state + activeOverrides memo + active-bucket writes + dual-bucket Save + 3 hydration sites + toast + AtlasPreviewModal swap | VERIFIED | 25 overridesAtlasLess, 24 activeOverrides, 4× buildExportPlan with activeOverrides, 6 setOverridesAtlasLess; AtlasPreviewModal prop at line 2160 uses activeOverrides. |
| `src/renderer/src/App.tsx` | Drag-drop recovery arm rename + WR-01 fields threaded | VERIFIED | 1 mergedOverridesBuckets ref; 0 stale mergedOverrides: code lines; lines 187-204 thread newSkeletonPath + mergedOverridesBuckets + samplingHz + lastOutDir + sortColumn + sortDir + loaderMode + sharpenOnExport + safetyBufferPercent. |
| `tests/core/project-file.spec.ts` | Phase 36 describe block with pre-massage + round-trip; 13 fixture updates | VERIFIED | `Phase 36 — overridesAtlasLess (SEED-007 L-01)` describe present; INTENTIONALLY ABSENT marker present; round-trip with CIRCLE:75 / SQUARE:50; 33/33 tests passing. |
| `tests/main/override-migration.spec.ts` | Test 10 (per-bucket independence) + Test 11 (stale union) | VERIFIED | Both test names present; helper body unchanged; 13/13 tests passing. |
| `tests/renderer/appshell-mode-switch-divergence.spec.tsx` | OVR-07 integration test (3 cases) | VERIFIED | 3 tests pass (does-NOT-leak, does-NOT-overwrite, samplingHz-preservation); echo-style closure stub + Test 3 tailored mockResolvedValueOnce. |
| `tests/main/project-io.spec.ts` | CR-01 regression suite (3 tests driving real handler) | VERIFIED | `describe('Phase 36 CR-01 — handleProjectResample bucket routing (no cross-bucket leak)')` with 3 it() blocks; fixture updates for AppSessionState (`overridesAtlasLess: {}`) + SkeletonNotFoundOnLoadError mergedOverridesBuckets assertion shape. |
| `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` | status: closed + closed_during: 36 | VERIFIED | Frontmatter shows `status: closed`, `closed_during: 36-split-overrides-per-loader-mode`, `closed: 2026-05-13`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| AppShell.tsx | export.ts | `buildExportPlan(summary, activeOverrides, ...)` × 4 | WIRED | All 4 call sites at lines 720, 843, 965, 1071 use activeOverrides; signature unchanged. |
| AppShell.tsx | AtlasPreviewModal.tsx | `overrides={activeOverrides}` JSX prop | WIRED | Line 2160 (inside `atlasPreviewOpen &&` conditional mount) verified via grep. |
| AppShell.tsx | GlobalMaxRenderPanel.tsx | `overrides={activeOverrides}` prop into unchanged signature | WIRED | Panel files untouched per OVR-05 (36-03-SUMMARY: `git diff --stat` empty). |
| AppShell.tsx | AnimationBreakdownPanel.tsx | `overrides={activeOverrides}` prop into unchanged signature | WIRED | Same as above. |
| AppShell.tsx → main IPC | window.api.resampleProject | `overrides: Object.fromEntries(overrides), overridesAtlasLess: Object.fromEntries(overridesAtlasLess)` (CR-01) | WIRED | Renderer sends BOTH buckets unconditionally; main routes by bucket-name. |
| AppShell.tsx → main IPC | window.api.reloadProjectWithSkeleton | `mergedOverridesBuckets: { overrides, overridesAtlasLess }` | WIRED | locate-skeleton handler at AppShell line 1320 + App.tsx drag-drop at line 190. |
| App.tsx → main IPC | window.api.reloadProjectWithSkeleton | mergedOverridesBuckets + loaderMode + sharpenOnExport + safetyBufferPercent (WR-01) | WIRED | App.tsx:187-205 threads all fields from `state.error`. |
| project-io.ts → override-migration.ts | `migrateOverrides(bucket, summary)` × 6 calls | WIRED | 6 explicit calls (Open × 2, recovery × 2, resample × 2); helper body untouched. |
| project-file.ts validator | overridesAtlasLess pre-massage + per-key validation | WIRED | 287-310 — substitute missing, reject non-object, reject non-finite values; mirrors `overrides` validation pattern. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| AppShell.tsx | overrides (atlas-source Map) | initialProject.restoredOverrides (Open) / project-io.ts per-bucket migration / OverrideDialog onApply | Yes (real DB-less local state seeded from disk via materializeProjectFile + migrateOverrides) | FLOWING |
| AppShell.tsx | overridesAtlasLess (atlas-less Map) | initialProject.restoredOverridesAtlasLess (Open) / per-bucket migration / OverrideDialog onApply | Yes (symmetric to atlas-source bucket; verified by 3-test divergence spec + Test 3 samplingHz preservation) | FLOWING |
| AppShell.tsx | activeOverrides memo | useMemo(loaderMode==='atlas-less' ? overridesAtlasLess : overrides) | Yes (derives from real state) | FLOWING |
| AtlasPreviewModal mount | overrides prop | `activeOverrides` (line 2160) | Yes (real active-slice data) | FLOWING |
| Save serializer | both buckets | `Object.fromEntries(overrides)` + `Object.fromEntries(overridesAtlasLess)` | Yes (both maps unconditionally serialized; round-trip test asserts both keys present + lossless) | FLOWING |
| Resample IPC response | restoredOverrides / restoredOverridesAtlasLess | per-bucket migrateOverrides against summary.regions | Yes (real per-bucket migration; CR-01 regression test drives the real handler and confirms no cross-bucket leak) | FLOWING |
| project-file.ts pre-massage | overridesAtlasLess default | `{}` substitution when on-disk key missing | Yes (legacy forward-compat verified by Test 1 with INTENTIONALLY ABSENT field) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite passes | `npm test` | 1076 passed / 2 skipped / 2 todo (99 files) | PASS |
| OVR-07 integration test passes | `npm test -- tests/renderer/appshell-mode-switch-divergence.spec.tsx` | 3/3 passed | PASS |
| Typecheck clean (Phase 36 scope) | `npm run typecheck` | Only 3 pre-existing out-of-scope errors: `scripts/probe-per-anim.ts(14,31)`, `tests/_trace_tmp/trace.spec.ts(2,29)`, `tests/main/image-worker-rotation.spec.ts(187,13)` — all predate Phase 36 per 36-01-SUMMARY.md | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| OVR-01 | 36-01 | ProjectFileV1 gains `overridesAtlasLess`; validator pre-massage; no schema bump | SATISFIED | Truth #1, #2 above; types.ts + project-file.ts |
| OVR-02 | 36-02 | Legacy file routing by saved `loaderMode` at Open seam (Decision 2-A) | SATISFIED | Truth #3; project-io.ts:603-635 with WR-03 hadOverridesAtlasLessKey gate |
| OVR-03 | 36-03 | Toggling loaderMode does NOT auto-copy from active bucket | SATISFIED | Truth #4; activeOverrides is read-only memo; setActive ternary writes active-only; OVR-07 spec asserts both directions |
| OVR-04 | 36-02, 36-04 | Per-bucket migration; sum/union semantics at IPC seams | SATISFIED | Truth #5; 3 seams × 2 calls; Tests 10/11 lock helper-level contract |
| OVR-05 | 36-03, 36-05 | AppShell two-Map state; signatures unchanged; both buckets serialized; SEED-007 closure | SATISFIED | Truth #6, #7, #8; panels untouched; SEED-007 closed |
| OVR-06 | 36-04 | Round-trip + legacy pre-massage + per-bucket migration tests | SATISFIED | Truth #9; project-file.spec.ts Phase 36 describe + override-migration.spec.ts Tests 10/11 |
| OVR-07 | 36-05 | Mode-switch divergence test (both directions + samplingHz preservation) | SATISFIED | Truth #10; appshell-mode-switch-divergence.spec.tsx 3/3 passing |

**Orphaned requirements:** None. All OVR-01..07 from REQUIREMENTS.md are owned by 36-XX plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none in Phase 36 scope) | — | — | — | — |

REVIEW.md's CR-01 + 4 WRs were identified post-execution and all resolved in commits `e08c18e`, `64e12c1`, `dbdd621`, `9d62991`, `29f4202`. REVIEW.md frontmatter `status: resolved`.

Pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts:187` and two other typecheck errors are documented as out-of-scope, predate Phase 36.

Two pre-existing test failures (`tests/core/sampler-skin-defined-unbound-attachment.spec.ts`, `tests/main/sampler-worker-girl.spec.ts`) noted in 36-05-SUMMARY require gitignored proprietary fixtures (SAMPLER_ALPHA_ZERO + Girl) — but the verifier's `npm test` shows 1076 passed / 0 failed, meaning either the fixtures are present locally or the skips are now resolving correctly. Either way: no failures attributable to Phase 36 work.

### Phase-Wide Quality Gate Audits (from 36-05 + verifier re-run)

| Audit | Plan threshold | Actual | Pass? |
| ----- | -------------- | ------ | ----- |
| stale `mergedOverrides:` code lines in src/ + tests/ (excluding .bak files, comments, mergedOverridesBuckets) | 0 | 0 | yes |
| `overridesAtlasLess` total refs in src/ + tests/ | >= 20 | 110 | yes |
| `restoredOverridesAtlasLess` in src/ | >= 4 | 12 | yes |
| `mergedOverridesBuckets` in src/ | >= 5 | 16 | yes |
| SEED-007 `status: closed` | 1 | 1 | yes |
| SEED-007 `closed_during: 36` | 1 | 1 | yes |
| Phase 36 REVIEW.md fix commits | 5 | 5 (e08c18e, 64e12c1, dbdd621, 9d62991, 29f4202) | yes |

### Human Verification Required

None. Phase scope is renderer state + main-process IPC + unit + integration tests, all programmatically verifiable. Visual mode-toggle toast appearance is locked to verbatim D-04 copy and verbatim Tailwind class string mirroring `loaderModeHealedNotice`; the rendered output is exercised by the OVR-07 integration test (3/3 passing). No UI behavior outside the locked contracts requires human eyes.

### Gaps Summary

None. All 5 ROADMAP Success Criteria, all 7 OVR-01..07 REQUIREMENTS, all 14 frontmatter-declared truths, all 11 artifacts, all 9 key links, all 7 data-flow traces, and all 3 behavioral spot-checks verified. REVIEW.md CR-01 + 4 WRs were identified post-execution and all resolved (REVIEW frontmatter `status: resolved`); the resolution included 3 main-side regression tests (CR-01) and 4 warning fixes. SEED-007 closed with traceability metadata. Phase ready to ship.

---

_Verified: 2026-05-13T12:18:00Z_
_Verifier: Claude (gsd-verifier)_
