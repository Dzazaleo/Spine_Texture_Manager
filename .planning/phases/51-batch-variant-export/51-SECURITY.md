---
phase: 51-batch-variant-export
audited: 2026-05-24
asvs_level: L1
result: SECURED
threats_open: 0
threats_closed: 10
---

# Security Audit — Phase 51: Batch Variant Export

## Result: SECURED

All 10 declared threat mitigations verified present in implemented code.
No unregistered attack surface flags.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-51-01 | Tampering | mitigate | CLOSED | `src/main/ipc.ts:1124` — `Array.isArray(scales) ? (scales as unknown[]).map(Number).filter((n) => Number.isFinite(n)) : []` |
| T-51-02 | Tampering | mitigate | CLOSED | `src/main/ipc.ts:1125` — `typeof parentDir === 'string' ? parentDir : ''`; `src/main/variant-export.ts:120-121` rejects empty parentDir per-variant |
| T-51-03 | Tampering/Elevation | mitigate (inherited) | CLOSED | `src/main/variant-export.ts:142-148` — `basename(...)` + `:` rejection; batch loops `exportOneVariant` at line 482 so guard runs per variant |
| T-51-04 | Tampering | mitigate (inherited) | CLOSED | `src/main/variant-export.ts:212-230` — source-collision `pathResolve` equality guard inside `exportOneVariant`; inherited per batch iteration |
| T-51-05 | Tampering | mitigate (inherited) | CLOSED | `src/main/variant-export.ts:135-137` — `Math.max(0, Math.min(25, Math.trunc(safetyBufferPercent)))` with NaN→0 fallback; runs inside `exportOneVariant` per variant |
| T-51-06 | DoS | mitigate | CLOSED | `src/main/variant-export.ts:448` — `variantBatchCancelRequested = false` unconditionally at the start of every `handleExportVariantBatch` call |
| T-51-07 | DoS | mitigate | CLOSED | `src/main/variant-export.ts:234` — `const written = new Set<string>()` minted inside `exportOneVariant`; no batch-wide rollback Set exists |
| T-51-08 | Tampering | mitigate | CLOSED | `src/renderer/src/modals/VariantDialog.tsx:231-243` — `tokenCounts` + `collidingTokens` + `hasDuplicate`; `startDisabled = anyInvalid \|\| hasDuplicate`; button `disabled={startDisabled}` at line 958 |
| T-51-09 | Tampering | mitigate | CLOSED | `src/renderer/src/modals/VariantDialog.tsx:219-227` — `isRowInvalid` checks non-finite/out-of-range/degenerate token; `anyInvalid` folds into `startDisabled` |
| T-51-10 | Spoofing/Tampering | mitigate | CLOSED | `src/renderer/src/modals/variant-scale-derive.ts:49` — `tokenFor` is a renderer-local 1-liner with zero runtime imports from `core/` or `main/` |

---

## Unregistered Flags

None. Both 51-01-SUMMARY.md and 51-02-SUMMARY.md `## Threat Flags` sections
explicitly report "None". No new attack surface appeared during implementation
beyond the planned `variant:exportBatch` / `variant:cancelBatch` channels, both
of which are covered by T-51-01 and T-51-02.

---

## Audit Notes

### T-51-01 / T-51-02 coercion ladder (ipc.ts:1108-1144)

The `variant:exportBatch` handler at `ipc.ts:1108` mirrors the pre-existing
`variant:export` coercion ladder exactly. `scales` is coerced to a finite
number array at the channel entry point; `parentDir` is coerced to string.
Both reach `handleExportVariantBatch` in variant-export.ts already sanitized.

### T-51-03 / T-51-04 / T-51-05 — inherited guards via exportOneVariant loop

The batch does NOT bypass the single-variant guards. `handleExportVariantBatch`
at `variant-export.ts:482` calls `exportOneVariant(...)` for each scale.
`exportOneVariant` contains all three inherited guards (basename + colon-reject
at lines 142-148; source-collision at lines 212-230; safetyBufferPercent clamp
at lines 135-137). Inheritance is structural, not documentary.

### T-51-06 — stale-flag reset placement

`variantBatchCancelRequested = false` at line 448 precedes the
`variantExportInFlight = true` claim at line 449 and the loop at line 451.
A stale `true` from a prior cancelled run is cleared before the first
iteration's cancel-check at line 452.

### T-51-07 — per-unit rollback Set

`exportOneVariant` declares `const written = new Set<string>()` at line 234
on each invocation. The batch function owns only a `results: BatchVariantResult[]`
array (line 411). There is no batch-wide `written` Set that could sweep
already-landed folders on a later per-variant failure.

### T-51-10 — Layer-3 boundary

`src/renderer/src/modals/variant-scale-derive.ts` has no runtime imports.
`tokenFor` at line 49 is `String(displayFactor(s))` where `displayFactor` is
defined in the same file as `Number(s.toFixed(4))`. The math is byte-identical
to `formatScaleToken` in `src/main/variant-export.ts:58-60` but no cross-layer
import exists. The `tests/arch.spec.ts` gate (referenced in 51-02-SUMMARY.md
as passing 20/20) enforces this structurally.
