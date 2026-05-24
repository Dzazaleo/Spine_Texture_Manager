---
phase: 52-batch-export-robustness-variant-dialog-cleanup
reviewed: 2026-05-24T10:42:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/main/ipc.ts
  - src/main/variant-export.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/VariantDialog.tsx
  - tests/main/variant-batch-faithful.spec.ts
  - tests/main/variant-token-equivalence.spec.ts
  - tests/renderer/variant-batch-dialog.spec.tsx
  - tests/renderer/variant-dialog.spec.tsx
  - tsconfig.node.json
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 52: Code Review Report

**Reviewed:** 2026-05-24T10:42:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 52 is a tightly-scoped hardening/cleanup pass (EXPORT-06) over the variant-export batch feature. The change set is small (234 lines across 9 files, all committed) and the four claimed change areas were each verified against their stated intent:

1. **`variant-export.ts` continue-on-error duplicate handling** — the whole-batch abort was correctly replaced with a per-row `dupTokens` set + per-row `continue`. The duplicate rows still fail with the verbatim reason; non-colliding scales export. Verified by the new `variant-batch-faithful.spec.ts` Block-2 partial-failure test (13/13 pass).
2. **`variant-export.ts` orphan-empty-dir rollback cleanup** — the new `readdir(outDir).length === 0` guard before `fsRm(outDir)` is the correct only-if-empty contract; it preserves pre-existing user content (overwrite=true re-export) and removes the freshly-created empty dir on rollback. The cleanup is inside the catch only; the happy path returns before it. The TOCTOU window between `readdir` and `fsRm` is benign because `variantExportInFlight` serializes the channel.
3. **`ipc.ts` dropped `Number(safetyBufferPercent) || 0`** — **verified genuinely safe and behavior-preserving.** Traced every coercion: `Number(undefined|null|""|"abc")` → `NaN`/`0`, all handled by the single canonical clamp in `exportOneVariant` step 2b (`Number.isFinite(...) ? Math.max(0, Math.min(25, Math.trunc(...))) : 0`). The old `|| 0` only ever masked `NaN`→`0`, which the body's `Number.isFinite` guard already does. Negative and over-range inputs clamp identically under both old and new code. No boundary regression.
4. **Renderer dead-code removal + `onStart` memoization** — the dead `plan` prop and its `buildExportPlan` call site were removed; `ExportPlan`/`buildExportPlan` imports remain live (still used by the untouched Optimize `exportDialogState` flow at AppShell.tsx:548 + lines 809/1027/etc.), so no orphaned imports. The `onStart` `useCallback([props, startDisabled])` → plain function conversion is genuinely behavior-preserving: `onStart` is referenced only by two inline handlers (line 367 keyDown, line 957 onClick), never in a dep array or a memoized child, and the prior callback was recreated every render anyway because `props` is freshly allocated.
5. **`tsconfig.node.json` modals include** — the single-level `src/renderer/src/modals/*.ts` glob matches exactly `variant-scale-derive.ts` (the zero-import pure helper); the sibling `.tsx` DOM modals are not matched. `typecheck:node` and `typecheck:web` both pass clean.

**Validation run during review:** `typecheck:node` clean, `typecheck:web` clean, all 4 in-scope spec files pass (33/33 tests). No BLOCKER-level defects found. The findings below are quality/robustness observations within the phase's own scope.

## Warnings

### WR-01: Duplicate-token detection silently swallows the degenerate-token (`@0x`/`@1x`) case with a misleading reason

**File:** `src/main/variant-export.ts:433-435, 470-480`
**Issue:** `dupTokens` is built over the full `scales` array, then each row matching a duplicated token is failed with the reason `"Duplicate scale token @{token}x — two rows produce the same folder."`. When two rows both round to a *degenerate* token (e.g. two rows at `0.99995` → both token `'1'`, or two rows at `0.00004` → both `'0'`), they collide in `dupTokens` and are reported as a "duplicate" — even though the more accurate (and primary) reason is that the scale rounds to a degenerate folder name. The degenerate-token guard (`exportOneVariant` step 1b, which returns the precise "rounds to a degenerate folder token" message) is never reached because the dup-skip `continue`s before `exportOneVariant` is called. The user sees a "two rows produce the same folder" message for what is actually a degenerate-scale problem, which is misleading when the rows have genuinely different (but both-degenerate-rounding) factors. This is a continue-on-error defense-in-depth path (the renderer pre-flight `isRowInvalid` blocks both degenerate and duplicate cases before submit), so it is not a correctness blocker, but the diagnostic message can misdirect a user who reached this path.
**Fix:** Check the degenerate-token condition before (or independently of) the duplicate condition so the more specific reason wins:
```ts
const tok = formatScaleToken(scales[i]);
if (tok === '0' || tok === '1') {
  pushResult({ token: tok, status: 'failed',
    reason: `Scale ${scales[i]} rounds to a degenerate folder token @${tok}x; choose a scale between 0.0001 and 0.9999.` });
  continue;
}
if (dupTokens.has(tok)) { /* existing dup-skip */ continue; }
```
Alternatively, simply let degenerate single-occurrence rows fall through to `exportOneVariant` (whose step-1b guard already produces the precise message) and reserve the dup-skip strictly for tokens with count > 1 that are *not* degenerate.

### WR-02: `variant:batch-progress` is emitted for duplicate-skipped rows, advancing the renderer's "variant N of M" counter and resetting the per-image bar for a variant that never runs

**File:** `src/main/variant-export.ts:459-480`
**Issue:** The `variant:batch-progress` send (lines 460-468) executes for every loop iteration *before* the dup-skip check (lines 470-480). For a duplicate row, the renderer receives a progress marker (incrementing `variantIndex`, resetting `imageProgress` to `null`/0), then immediately a `variant:result` with `status: 'failed'` — but no `export:progress` events ever follow because `exportOneVariant` is never invoked for that row. The per-image bar therefore visibly resets to 0 and stalls for the duplicate, and the "Exporting variant N of M" label briefly displays the duplicated token. This is cosmetic and only reachable via a compromised/relaxed renderer (the normal renderer's `startDisabled` blocks submitting duplicates), but it produces a confusing transient UI state. The cancel-button disable logic (`progress.variantIndex === progress.variantTotal - 1`) also keys off the dup-inflated index, so a trailing duplicate could mis-enable/disable Cancel by one position.
**Fix:** Move the `variant:batch-progress` emission *after* the dup-skip check so it only fires for rows that actually run `exportOneVariant`:
```ts
const dupToken = formatScaleToken(scales[i]);
if (dupTokens.has(dupToken)) {
  pushResult({ token: dupToken, status: 'failed', reason: `Duplicate scale token @${dupToken}x — two rows produce the same folder.` });
  continue;
}
try {
  evt.sender.send('variant:batch-progress', { variantIndex: i, variantTotal: scales.length, token: dupToken });
} catch { /* sender gone */ }
const res = await exportOneVariant(...);
```
(Note: `variantTotal` still counts skipped/dup rows, so the denominator overstates the real export count — acceptable, but the index should not advance through non-running rows.)

## Info

### IN-01: `formatScaleToken` is called redundantly inside the `dupTokens` build loop

**File:** `src/main/variant-export.ts:434`
**Issue:** `for (const s of scales) seen.set(formatScaleToken(s), (seen.get(formatScaleToken(s)) ?? 0) + 1);` invokes `formatScaleToken(s)` twice per element (once for the `set` key, once for the `get`). Minor duplication; readability and a small redundant `toFixed`/`Number`/`String` round-trip.
**Fix:** Hoist the token: `for (const s of scales) { const t = formatScaleToken(s); seen.set(t, (seen.get(t) ?? 0) + 1); }`. (Performance is out of v1 review scope; flagged purely as a code-quality / clarity nit.)

### IN-02: `formatScaleToken(scales[i])` recomputed up to four times per loop iteration

**File:** `src/main/variant-export.ts:464, 470, 494`
**Issue:** Within one iteration the token is computed at line 464 (`variant:batch-progress`), line 470 (`dupToken`), and line 494 (`token` after export). These are all the same value for a given `i`. The duplication is harmless but invites drift if one call site is later changed (e.g. a different rounding) without the others.
**Fix:** Compute `const token = formatScaleToken(scales[i]);` once at the top of the loop body and reuse it for the progress marker, the dup check, and the result push.

### IN-03: Phase-52 commit body comment in `variant-export.ts` no longer reflects the implemented behavior

**File:** `src/main/variant-export.ts:62-67` (re-entrancy guard comment) and the broader file header
**Issue:** Not introduced by this phase, but worth noting for maintainability: the file header (lines 1-26) and several inline comments describe the *Phase 49/51* design without a Phase-52 note that the whole-batch dup-abort was changed to per-row continue-on-error and that an empty-dir rollback cleanup was added. The only Phase-52 markers are the inline `D-01 (WR-02)` / `D-03 (WR-03)` comments at the change sites. A future reader skimming the header would not learn that the dup-handling semantics changed in 52.
**Fix:** Add a one-line "Phase 52 (EXPORT-06)" entry to the file header invariants block noting the continue-on-error dup handling + orphan-empty-dir rollback cleanup, mirroring how the header already enumerates Phase 49/51 contracts.

---

_Reviewed: 2026-05-24T10:42:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
