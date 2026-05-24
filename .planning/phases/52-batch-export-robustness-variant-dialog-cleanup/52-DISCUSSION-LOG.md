# Phase 52: Batch Export Robustness + Variant-Dialog Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 52-batch-export-robustness-variant-dialog-cleanup
**Areas discussed:** WR-04 coercion policy, WR-02 duplicate-token UX, WR-03 orphan-dir + test rigor

---

## Context gate (pre-discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| Continue without context | Plan directly from ROADMAP SC + 51-REVIEW.md | |
| Run discuss-phase first | Lock decisions (esp. WR-04) before planning | ✓ |

**User's choice:** Run discuss-phase first.
**Notes:** Scope is fully pinned by ROADMAP SC + `51-REVIEW.md` (6 items: WR-02/03/04 + IN-01/03/04). User opted to capture decisions before planning rather than plan straight from the review doc.

---

## Gray-area selection

Three decision-bearing areas were presented via multiSelect (WR-04 coercion policy,
WR-02 duplicate-token UX, WR-03 orphan-dir + test rigor). The mechanical items
(IN-01 equivalence test — ROADMAP-locked route; IN-03 prop removal; IN-04 onStart deps)
were noted as Claude's-discretion cleanup.

**User's choice:** "i've decided to let you choose what's best" — delegated ALL gray-area
calls to Claude. Per the project's delegate-implementation-choices signal, Claude made each
decision and recorded the rationale in CONTEXT.md rather than re-asking.

---

## WR-04 — Variant-channel coercion policy

| Option | Description | Selected |
|--------|-------------|----------|
| Coerce-and-clamp | Drop the redundant `Number()||0`; rely on `exportOneVariant`'s canonical `safeBuffer` clamp; document the deliberate divergence from `export:start` | ✓ |
| Validate-and-reject | Mirror `export:start`'s `validateExportOpts` — reject bad `safetyBufferPercent` at the variant IPC boundary | |

**Claude's choice (delegated):** Coerce-and-clamp (D-04).
**Rationale:** The body already holds the single canonical clamp (WR-06 `safeBuffer`); both
variant channels already coerce identically; the renderer pre-clamps, so validate-and-reject
would be dead ceremony + a behavior change against "no happy-path change." Documenting the
intentional divergence satisfies SC#3 ("consistent and documented").

---

## WR-02 — Duplicate-token UX

| Option | Description | Selected |
|--------|-------------|----------|
| Main continue-on-error (required) + renderer stays strict | Fail all colliding rows main-side, others export; renderer keeps blocking submit on any dup (defense-in-depth) | ✓ |
| Also relax the renderer | Renderer flags colliding rows + allows exporting the rest | |

**Claude's choice (delegated):** Main continue-on-error, fail ALL colliding rows; renderer
unchanged (D-01 + D-02).
**Rationale:** SC#1 mandates the main-engine behavior. "row(s)" plural + the WR-01
fail-fast-on-ambiguous-token philosophy → fail all colliding rows (not keep-first). Keeping
the renderer strict surfaces dupes before a long run and keeps the diff surgical; the main
fix is the contract (defense-in-depth for a compromised/older renderer).

---

## WR-03 — Orphan-dir cleanup + test rigor

| Option | Description | Selected |
|--------|-------------|----------|
| Only-if-empty rmdir + tighten tests | Remove `outDir` only when empty after the file sweep; tighten the tolerant `if(fs.existsSync)` assertion + add regression tests | ✓ |
| Minimal | Fix cleanup, leave the existing tolerant test as-is | |

**Claude's choice (delegated):** Only-if-empty rmdir + tighten the assertion + add
regression tests (D-03 + D-08).
**Rationale:** Only-if-empty preserves a pre-existing folder (overwrite case). Locking the
new behavior in tests matches the project's regression-test-per-fix culture; otherwise SC#2
isn't protected from future regression.

---

## Claude's Discretion

- IN-01 equivalence test (D-05) — ROADMAP-locked route; placed in `tests/main/` to dodge the
  typecheck:node TS6307 renderer-.ts landmine.
- IN-03 dead `plan` prop removal (D-06) — mechanical; verify no consumer first.
- IN-04 `onStart` deps (D-07) — pure-impl; default = drop `useCallback` + plain function.
- Exact code form of D-03/D-07 and the D-05 sample array; test file names.

## Deferred Ideas

- Persist variant scale rows + output location in `.stmproj` → Phase 53 (SCALEUI-03)
  (reviewed todo `2026-05-23-persist-variant-rows-and-output-location.md`, not folded).
- Merge `tokenFor`/`formatScaleToken` into a shared helper — NOT done (Layer-3 + ROADMAP
  chose the equivalence-test route).
- WR-05 / IN-02 — already fixed in `1c68cb8`.
