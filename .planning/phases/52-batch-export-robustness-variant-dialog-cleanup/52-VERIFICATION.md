---
phase: 52-batch-export-robustness-variant-dialog-cleanup
verified: 2026-05-24T10:46:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 52: Batch Export Robustness + Variant-Dialog Cleanup Verification Report

**Phase Goal:** Harden the batch path against partial-failure + edge inputs and clear the Phase-51 code-review backlog, with no change to happy-path behavior.
**Requirement:** EXPORT-06
**Verified:** 2026-05-24T10:46:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a hardening/cleanup phase (D-09: no happy-path behavior change; all changes confined to error/edge/rollback paths, IPC-boundary coercion, dead-code removal, and tests). Every claimed change area was verified against the ACTUAL codebase — not the SUMMARY claims — at the existence, substance, wiring, and behavioral level. The four ROADMAP success criteria map 1:1 to the locked decisions D-01..D-08, all of which were verified present, substantive, and behaviorally proven by the test suite.

### Observable Truths

| #   | Truth (ROADMAP SC / Decision)                                                                                         | Status     | Evidence |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | **SC#1 / D-01:** A duplicate `@{s}x` token fails ONLY its own row(s) via `pushResult({status:'failed'})`+`continue`; non-colliding scales still export (continue-on-error parity with 51 D-07) | ✓ VERIFIED | `variant-export.ts:435,470-480` — `dupTokens` skip-before-`exportOneVariant`; `:482` non-colliding scales call `exportOneVariant`. Test D-08b (`variant-batch-faithful.spec.ts:320-365`) PASSES: `[0.5,0.50001,0.36]` → both `@0.5x` rows failed, `@0.36x` exported. 30/30 main specs pass. |
| 2   | **SC#1 / D-01:** ALL rows sharing a duplicated token fail (fail-all-on-ambiguous, not keep-first)                      | ✓ VERIFIED | `dupTokens = Set(...filter(([,n]) => n>1)...)` (`:435`) flags every member of a count>1 token. Test asserts `dupRows.length===2` AND both `status==='failed'` (`:345-357`). |
| 3   | **SC#1 / D-01:** the `variantExportInFlight` re-entrancy guard and the between-variants cancel check are PRESERVED     | ✓ VERIFIED | Re-entrancy guard intact at `:437-449`; cancel check `if (variantBatchCancelRequested)` intact at `:452-458`; `finally { variantExportInFlight = false }` at `:508-510`. Old whole-batch abort (`seen.entries().find`) is GONE (grep=0). |
| 4   | **SC#2 / D-03:** A failed variant leaves NO orphan empty `{NAME}@{s}x/` directory — rollback removes `outDir` only-if-empty | ✓ VERIFIED | `variant-export.ts:312-323` — inside `catch(innerErr)`, after the `written` file sweep: `if ((await readdir(outDir)).length===0) await fsRm(outDir,{recursive,force})`. Test D-08a (`:283-286`) hard-asserts `fs.existsSync(folder)===false` ("folder GONE") for every forced-fail variant. PASSES. |
| 5   | **SC#2 / D-03:** A pre-existing non-empty folder (overwrite=true re-export) is NEVER deleted (only-if-empty guard)     | ✓ VERIFIED | The `readdir(outDir).length===0` guard (`:318`) fires the rm solely on an empty, run-created leaf dir; the happy path returns at `:303` before the catch. `outDir` correctly scoped (defined `:152`). |
| 6   | **SC#3 / D-04:** Both variant handlers pass `Number(safetyBufferPercent)` (redundant `|| 0` dropped at BOTH); coerce-and-clamp documented; single+batch byte-parallel; NOT converted to validate-and-reject | ✓ VERIFIED | `ipc.ts:1094-1099` (single) + `:1137-1142` (batch) — identical D-04 comment + bare `Number(safetyBufferPercent)`. grep: `\|\| 0`=0, `coerce-and-clamp`=2, `validate-and-reject`=2, `validateVariant`=0. Canonical clamp authority confirmed at `variant-export.ts:135-136`. |
| 7   | **SC#4 / D-05:** Cross-boundary `tokenFor(x) === formatScaleToken(x)` equivalence test in `tests/main/` (node env) over IEEE-754 + near-collision sample; NOT a `tests/renderer/*.ts` (TS6307 landmine) | ✓ VERIFIED | `tests/main/variant-token-equivalence.spec.ts` imports BOTH `src/main/variant-export` (`formatScaleToken`) AND `src/renderer/src/modals/variant-scale-derive` (`tokenFor`/`displayFactor`); sample includes `0.30000000000000004` + `0.50001`. 5/5 tests pass; `typecheck:node` exit 0. |
| 8   | **SC#4 / D-06:** Dead `plan` prop removed from `VariantDialogProps` + AppShell `variantDialogState` type + `<VariantDialog/>` site + the dead `buildExportPlan` call; `buildExportPlan`+`ExportPlan` imports KEPT | ✓ VERIFIED | grep `props.plan`=0, `plan: ExportPlan`=0 (VariantDialog); `variantDialogState.plan`=0, `plan={variantDialogState.plan}`=0 (AppShell). `onClickExportVariant` is the one-liner `setVariantDialogState({outDir:lastOutDir})` (`AppShell.tsx:822-824`). `import { buildExportPlan }`=1 with 4 callsites; `ExportPlan`=10 refs (kept). `typecheck:web` exit 0. |
| 9   | **SC#4 / D-07:** `onStart`'s misleading memoization (deps `[props, startDisabled]`) fixed; D-02 renderer dup gate UNCHANGED | ✓ VERIFIED | `onStart` is now a plain `async () =>` (`VariantDialog.tsx:280`); grep `[props, startDisabled]`=0; body reads `props.outDir`/`props.onConfirmStart` directly (`:288-290`, behavior-preserving). D-02 gate `startDisabled = anyInvalid \|\| hasDuplicate` UNCHANGED (`:243`). 24/24 renderer variant tests pass. |
| 10  | **D-09:** The happy path is behavior-preserving — successful single export and all-valid batch produce byte-identical output to pre-Phase-52 | ✓ VERIFIED | Full `npx vitest run`: **153 files / 1546 passed / 0 failed** (12 skipped, 2 todo) on a checkout WITH the local fixtures present. 12/12 faithfulness matrix green. `typecheck:node`=0, `typecheck:web`=0. Phase-52 diff confined to error/edge/coercion/dead-code/test lines only. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/main/variant-export.ts` | Per-row `dupTokens` skip + readdir-empty `outDir` cleanup | ✓ VERIFIED | `dupTokens` Set (`:435`) + per-row skip (`:470-480`); readdir-empty rollback (`:312-323`); `readdir` imported (`:27`). Old abort removed. |
| `src/main/ipc.ts` | Unified `Number(...)` coercion + comment at both handlers | ✓ VERIFIED | Both handlers byte-parallel (`:1099`,`:1142`); no validate-and-reject path. |
| `src/renderer/src/modals/VariantDialog.tsx` | `plan` prop removed; `onStart` memoization fixed | ✓ VERIFIED | Plain async `onStart` (`:280`); prop deleted; D-02 gate intact. |
| `src/renderer/src/components/AppShell.tsx` | Dead `buildExportPlan` call removed; `plan` dropped from state/site | ✓ VERIFIED | One-liner `onClickExportVariant` (`:822`); `variantDialogState` type has only `outDir` (`:558-560`); imports KEPT. |
| `tests/main/variant-token-equivalence.spec.ts` | D-05 cross-boundary equivalence test | ✓ VERIFIED | New file, 5/5 pass, imports both boundaries. |
| `tests/main/variant-batch-faithful.spec.ts` | D-08a orphan-gone + D-08b partial-failure regression | ✓ VERIFIED | Hard "folder GONE" assertion (`:283-286`) + partial-failure `it(...)` (`:320+`). |
| `tsconfig.node.json` | (deviation) `src/renderer/src/modals/*.ts` include for D-05 | ✓ VERIFIED | Added `:21`; single-level `*.ts` matches only the pure helper, not `.tsx` siblings; both typechecks exit 0. Documented in 52-04-SUMMARY. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `handleExportVariantBatch` dup-skip | `pushResult` / `variant:result` | `pushResult({token,status:'failed',reason})` then `continue` | ✓ WIRED | `variant-export.ts:474-479` — emits the live-red result before `continue`; never reaches `exportOneVariant`. |
| `exportOneVariant` rollback catch | `node:fs/promises` readdir + fsRm | only-if-empty `outDir` removal after `written` sweep | ✓ WIRED | `:317-320` inside `catch(innerErr)`, after the `for (const p of written)` sweep. |
| variant IPC handlers | `exportOneVariant` step-2b `safeBuffer` clamp | pass `Number(safetyBufferPercent)`; body's `Number.isFinite` is single authority | ✓ WIRED | `ipc.ts:1099/1142` → `variant-export.ts:135-136` clamp → `:195` plan. |
| AppShell `onClickExportVariant` | `setVariantDialogState({outDir:lastOutDir})` | removal of dead `buildExportPlan` call | ✓ WIRED | `AppShell.tsx:823`. |
| `variant-token-equivalence.spec.ts` | main `formatScaleToken` + renderer `tokenFor` | `expect(tokenFor(x)).toBe(formatScaleToken(x))` | ✓ WIRED | Both imports resolve; test green. |

### Data-Flow Trace (Level 4)

Phase 52 is hardening/cleanup of error/edge/rollback paths and dead-code removal — it does not introduce new dynamic-data-rendering artifacts. The one user-visible data path it touches (the live-red dup-failed row via `variant:result`) was traced: `pushResult` appends to `results` AND `evt.sender.send('variant:result', r)` (`variant-export.ts:474-479`) — real `BatchVariantResult` flows to the renderer, not a static/empty value. No HOLLOW/STATIC/DISCONNECTED artifacts. Level 4: N/A for the dead-code/coercion changes; FLOWING for the dup-result path.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| In-scope main specs (D-01/D-03/D-05/D-08 behaviors) | `vitest run variant-token-equivalence + variant-batch-faithful + variant-scale-guard` | 3 files / 30 passed | ✓ PASS |
| Renderer variant specs (D-02/D-06/D-07) | `vitest run variant-twoway + variant-dialog + variant-batch-dialog` | 4 files / 24 passed | ✓ PASS |
| Full suite (D-09 happy-path + faithfulness matrix) | `npx vitest run` (local fixtures present) | 153 files / 1546 passed / 0 failed | ✓ PASS |
| Node typecheck (D-05 landmine guard) | `npm run typecheck:node` | exit 0 | ✓ PASS |
| Web typecheck (D-06 prop-removal guard) | `npm run typecheck:web` | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| EXPORT-06 | 52-01, 52-02, 52-03, 52-04 (all declare it) | Batch variant export robust against partial-failure + edge inputs: per-row dup-token continue-on-error, no orphan empty folder, consistent IPC-boundary coercion (WR-02/03/04 + IN-01/03/04 cleanup) | ✓ SATISFIED | All four ROADMAP success criteria verified (truths 1-9); WR-02 (SC#1/D-01), WR-03 (SC#2/D-03), WR-04 (SC#3/D-04), IN-01 (D-05), IN-03 (D-06), IN-04 (D-07) all landed and behaviorally proven. No orphaned requirement IDs — EXPORT-06 is the only ID and is declared in every plan. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TODO/FIXME/PLACEHOLDER/stub in any changed source file | — | Clean — grep over `variant-export.ts`, `ipc.ts`, `VariantDialog.tsx`, `AppShell.tsx` returned 0 anti-pattern matches. |

**Note on 52-REVIEW.md warnings (informational, not gaps):** The code review found 0 critical / 2 warning / 3 info.
- **WR-01 (REVIEW)** — degenerate-token (`@0x`/`@1x`) collisions report the "duplicate" reason rather than the more specific "degenerate" reason. This is cosmetic/diagnostic: two rows that both round to a degenerate token ARE genuine duplicates (same folder name), so failing them is *correct*; only the message wording is imperfect. It does NOT break SC#1 — a non-colliding (single-occurrence) degenerate scale is never added to `dupTokens` (count>1 filter), so it falls through to `exportOneVariant`'s precise step-1b guard. No success criterion affected.
- **WR-02 (REVIEW)** — `variant:batch-progress` is emitted before the dup-skip check (`variant-export.ts:459-468` precedes `:470-480`), so a dup-skipped row briefly advances the "variant N of M" counter. Cosmetic transient UI state, only reachable via a compromised/relaxed renderer (the normal renderer's `startDisabled` blocks submitting duplicates). Does not affect any data path or success criterion.
- **IN-01/02/03 (REVIEW)** — code-quality nits (redundant `formatScaleToken` recomputation; missing Phase-52 file-header note). Non-functional.

All five review findings are within-scope quality observations, not correctness or data-integrity blockers, consistent with the phase's hardening contract.

### Disconfirmation Pass (Confirmation Bias Counter)

Per the verification thinking models, a deliberate pass to find a partial requirement, a misleading test, and an uncovered error path:
1. **Partial requirement?** SC#3 says coercion consistent AND documented "across the variant channels." Verified BOTH handlers are byte-parallel AND both carry the documenting comment — not just one. Fully met.
2. **Misleading test?** The D-08b partial-failure test could pass trivially if the dup folder were simply never reachable. Checked: it asserts the *non-colliding* `@0.36x` folder DOES exist (real export happened) AND the `@0.5x` folder does NOT — so it genuinely exercises the continue-on-error path, not a no-op. Not misleading.
3. **Uncovered error path?** The D-03 readdir-empty cleanup's own `try/catch` (`:321-322`) swallows a failed `readdir` (dir already gone) — this is intentional defense-in-depth, not an uncovered path; the forced-fail test (`maxPageSize:64`) exercises the cleanup on every iteration. The TOCTOU window between `readdir` and `fsRm` is benign because `variantExportInFlight` serializes the channel (confirmed by the preserved guard, truth #3).

### Deferred Items

The phase-dir `deferred-items.md` documents only an environmental note (2 local-fixture-absence tests in a fixture-less worktree). On this verification machine the fixtures (`fixtures/Girl`, `fixtures/SAMPLER_ALPHA_ZERO`) ARE present and the full suite is green — so this is resolved, not a deferred gap. No Phase-52 success criterion was deferred to a later phase; `.stmproj` persistence (SCALEUI-03) is Phase 53's scope and was correctly out-of-scope for Phase 52.

### Gaps Summary

None. All 10 must-have truths are VERIFIED with codebase + behavioral evidence. The four ROADMAP success criteria (WR-02/03/04 + the IN-01/03/04 cleanup) are each implemented, wired, and locked by passing regression tests. The happy-path-unchanged contract (D-09) is confirmed by a fully green full suite (1546 passed / 0 failed) and both typechecks (exit 0). The change set is surgically confined to the expected files with no anti-patterns. EXPORT-06 is satisfied.

### Human Verification Required

None. This phase is pure hardening/cleanup of internal error/edge/rollback paths, IPC-boundary coercion, and dead-code removal — explicitly `--skip-ui` with no new user-facing surface (D-09). Every observable truth is verifiable programmatically via the test suite and source inspection, all of which were run and passed. There is no visual, real-time, or external-service behavior introduced that requires human testing.

---

_Verified: 2026-05-24T10:46:00Z_
_Verifier: Claude (gsd-verifier)_
