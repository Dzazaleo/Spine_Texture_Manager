---
phase: 52-batch-export-robustness-variant-dialog-cleanup
audited: 2026-05-24
asvs_level: L1
result: SECURED
status: verified
threats_open: 0
threats_closed: 6
---

# Security Audit — Phase 52: Batch Export Robustness / Variant Dialog Cleanup

## Result: SECURED

All 6 declared threat mitigations verified present in implemented code (3 `mitigate`
verified against code, 3 `accept` documented). No unregistered attack surface flags.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-52-01 | Tampering (destructive FS) | mitigate | CLOSED | `variant-export.ts:317-320` (readdir empty guard) + `:142-148` (NAME sanitization rejects empty/`:`) + `:152` (outDir derived child, not parentDir) |
| T-52-02 | DoS (batch abort) | mitigate | CLOSED | `variant-export.ts:426-480` (`dupTokens` Set build + per-row `.has` skip with `continue`; whole-batch abort absent; re-entrancy guard :437 + cancel check :452-458 preserved) |
| T-52-03 | Tampering (unbounded input) | mitigate | CLOSED | `variant-export.ts:135-137` (canonical clamp before `buildExportPlan`); `ipc.ts:1099,1142` (bare `Number(...)`; `|| 0` removed; clamp authority unchanged) |
| T-52-04 | Documentation-only | accept | CLOSED | `ipc.ts:1094-1098,1137-1141` — comment-only; no runtime surface |
| T-52-05 | None (renderer dead-code) | accept | CLOSED | dead `plan` prop + `buildExportPlan` removed; D-02 dup-token gate preserved (`VariantDialog.tsx:227,239,243`) |
| T-52-06 | None (test-only) | accept | CLOSED | temp-dir I/O; reuses `SIMPLE_TEST` fixture; no new committed fixture dir → SAFE-01 unaffected |

---

## Closed Threat Details

### T-52-01 — Tampering: destructive FS (rollback rm)

**Mitigation verified at:** `src/main/variant-export.ts`

Four independently necessary sub-mitigations, all present:

1. **Only-if-empty guard** — the recursive force-rm fires only after `readdir(outDir).length === 0`, preventing deletion of a pre-existing non-empty folder (overwrite=true re-export scenario).
   - Evidence: `src/main/variant-export.ts:317-320`
     ```
     if ((await readdir(outDir)).length === 0) {
       await fsRm(outDir, { recursive: true, force: true });
     }
     ```
   - `readdir` imported at line 27: `import { rm as fsRm, readFile, readdir, access as fsAccess } from 'node:fs/promises';`
2. **outDir is app-derived only** — leaf path is `join(parentDir, `${NAME}@${formatScaleToken(s)}x`)`; `NAME` is rejected if empty or containing `:` (T-49-DIR guard) before `outDir` is constructed.
   - Evidence: `src/main/variant-export.ts:142-148` — `if (!NAME || NAME.includes(':'))` early-returns before `outDir` derivation (line 152).
3. **rm targets only the derived leaf, never parentDir** — the rm operand is `outDir = join(parentDir, ...)`, a child of `parentDir`, never `parentDir` itself.
4. **Catch guard** — the readdir/rm block is wrapped in `try { … } catch { /* outDir already gone / unreadable */ }` (lines 317-323), so rollback cannot throw.

### T-52-02 — DoS: whole-batch abort on duplicate token

**Mitigation verified at:** `src/main/variant-export.ts`

The old whole-batch abort is **absent**. The replacement per-row dup-skip is present and correct:

- `dupTokens` Set built at line 435: collects every token appearing 2+ times.
- Per-row check at lines 470-480: `if (dupTokens.has(dupToken))` → `pushResult({ status: 'failed', reason: 'Duplicate scale token @…x — two rows produce the same folder.' })` → `continue` (skips `exportOneVariant`, so no folder is created).
- Non-colliding rows proceed to `exportOneVariant` unchanged.
- `variantExportInFlight` re-entrancy guard (line 437) and `variantBatchCancelRequested` cancel check (lines 452-458) **preserved unchanged**.
- Evidence: `src/main/variant-export.ts:426-480`.

### T-52-03 — Tampering: unbounded safetyBufferPercent at IPC boundary

**Mitigation verified at:** `src/main/variant-export.ts` and `src/main/ipc.ts`

The canonical clamp is present and runs before `buildExportPlan`:

- `src/main/variant-export.ts:135-137`:
  ```typescript
  const safeBuffer = Number.isFinite(safetyBufferPercent)
    ? Math.max(0, Math.min(25, Math.trunc(safetyBufferPercent)))
    : 0;
  ```
  Fires in `exportOneVariant` step 2b before any export-plan construction. A renderer sending `100000` clamps to `25`; `NaN`/`Infinity` coerces to `0`.
- IPC handlers pass bare `Number(safetyBufferPercent)` (no `|| 0`):
  - `src/main/ipc.ts:1099` (`variant:export`) and `1142` (`variant:exportBatch`).
  - Both carry the D-04 documenting comment confirming the deliberate coerce-and-clamp policy distinct from `export:start`'s validate-and-reject.
  - `grep "Number(safetyBufferPercent) || 0"` → 0 hits.
- Dropping the boundary `|| 0` does not weaken the mitigation: `Number(NaN)` → `NaN`, which the body's `Number.isFinite` guard converts to `0`. The clamp is not bypassed.

### T-52-04 — Documentation-only (D-04 comment)

The D-04 documenting comment is present at both IPC handler sites (`src/main/ipc.ts:1094-1098` and `1137-1141`). Code comment with no runtime effect. No new trust boundary, IPC channel, FS operation, or network call introduced.

### T-52-05 — Renderer dead-code removal (plan prop + memoization)

Two accepted non-security changes; the security-relevant D-02 gate is verified preserved:

1. **Dead `plan` prop removed from `VariantDialogProps`** — `src/renderer/src/modals/VariantDialog.tsx:68-119` has no `plan: ExportPlan` field.
2. **Dead `buildExportPlan` call removed from `onClickExportVariant`** — `src/renderer/src/components/AppShell.tsx:843-845`: callback is `setVariantDialogState({ outDir: lastOutDir })` with no `buildExportPlan`.
3. **`variantDialogState` type has no `plan` field** — `src/renderer/src/components/AppShell.tsx:569-571`. (The `plan: ExportPlan` at AppShell line 559 belongs to the sibling `exportDialogState`, correct per D-06.)
4. **`onStart` memoization fixed** — `src/renderer/src/modals/VariantDialog.tsx:280` uses a plain `const onStart = async () => {`; the smelly `[props, startDisabled]` deps array is absent.
5. **D-02 renderer dup-token gate preserved** — `src/renderer/src/modals/VariantDialog.tsx:227,239,243`:
   - `const anyInvalid = props.rows.some(isRowInvalid);`
   - `const hasDuplicate = collidingTokens.size > 0;`
   - `const startDisabled = anyInvalid || hasDuplicate;`

### T-52-06 — Test-only (new/edited specs)

Tests operate on `mkdtempSync` temp dirs cleaned up in `afterEach`. No new committed fixture directory under `fixtures/` (specs reuse `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`); the SAFE-01 denylist is unaffected. Regression coverage verified:
- `tests/main/variant-batch-faithful.spec.ts:285` — tightened orphan-gone assertion.
- `tests/main/variant-batch-faithful.spec.ts:322-352` — D-08b partial-failure regression (`[0.5, 0.50001, 0.36]`).
- `tests/main/variant-token-equivalence.spec.ts` — D-05 cross-boundary `tokenFor ≡ formatScaleToken` equivalence spec.

---

## Unregistered Flags

None. The SUMMARY.md threat-flag sections report no items outside the declared register. No new attack surface beyond the six registered threats.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-52-04 | T-52-04 | Comment-only change in `src/main/ipc.ts`. No runtime surface. Per STRIDE analysis in 52-02-PLAN.md. | gsd-security-auditor | 2026-05-24 |
| AR-52-05 | T-52-05 | Renderer dead-code removal (dead prop + plain-fn memoization fix). No new IPC/FS/network surface. D-02 dup-token gate verified preserved. Per 52-03-PLAN.md. | gsd-security-auditor | 2026-05-24 |
| AR-52-06 | T-52-06 | Test-only changes. Temp-dir I/O, no new committed fixture dir, no SAFE-01 impact. Per 52-04-PLAN.md. | gsd-security-auditor | 2026-05-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-24 | 6 | 6 | 0 | gsd-security-auditor (verify all open threats) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-24
