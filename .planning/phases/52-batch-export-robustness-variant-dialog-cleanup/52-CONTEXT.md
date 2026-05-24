# Phase 52: Batch Export Robustness + Variant-Dialog Cleanup - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the Phase-51 batch variant-export path against partial-failure and edge
inputs, and clear the `51-REVIEW.md` deferred backlog — **with no change to
happy-path behavior**. Every work item originates in `51-REVIEW.md`:

- **WR-02** — duplicate `@{s}x` token currently aborts the WHOLE batch → make it
  continue-on-error (only the colliding row(s) fail; the rest export). *(SC#1)*
- **WR-03** — a failed variant leaves an orphan empty `{NAME}@{s}x/` directory →
  remove it on rollback. *(SC#2)*
- **WR-04** — variant-channel `safetyBufferPercent` coercion is redundant/asymmetric
  vs `export:start` → make it consistent + documented. *(SC#3)*
- **IN-01** — no cross-boundary `tokenFor` ≡ `formatScaleToken` test → add one. *(SC#4)*
- **IN-03** — dead `plan` prop + its `buildExportPlan` call → remove. *(SC#4)*
- **IN-04** — `onStart` `useCallback` deps defeat memoization → fix. *(SC#4)*

**Out of scope:** WR-01 / WR-05 / IN-02 (already fixed in `1c68cb8`); any new
user-facing capability; `.stmproj` persistence of variant state (Phase 53,
SCALEUI-03); merging the two-source token helper into `shared/`. Planned
`--skip-ui` — no UI-SPEC, no visual surface added.

**User delegated all gray-area calls** ("let you choose what's best", 2026-05-24).
The decisions below are Claude's choices, recorded with rationale so the
researcher/planner/executor act without re-asking.

</domain>

<decisions>
## Implementation Decisions

### WR-02 — Duplicate-token continue-on-error (SC#1)
- **D-01:** Replace the whole-batch dedup abort in `handleExportVariantBatch`
  (`src/main/variant-export.ts:414-428`) with per-row handling: build
  `dupTokens = new Set([...seen.entries()].filter(([,n]) => n > 1).map(([t]) => t))`,
  and in the export loop, when `dupTokens.has(formatScaleToken(scales[i]))`, push a
  `{ token, status: 'failed', reason: 'Duplicate scale token @{t}x — two rows produce the same folder.' }`
  result (via the existing `pushResult`, so the row colors red live) and `continue`
  WITHOUT calling `exportOneVariant`. All non-colliding scales export normally
  (continue-on-error parity with Phase-51 D-07). **Fail ALL rows sharing a duplicated
  token** (not keep-first): an ambiguous token cannot faithfully name a folder
  (the WR-01 fail-fast-on-ambiguous-token philosophy), and SC#1 says "row(s)"
  plural. The `variantExportInFlight` re-entrancy guard and the per-iteration
  between-variants cancel check are PRESERVED and still run unchanged.
- **D-02:** The renderer duplicate-token gate is UNCHANGED. `VariantDialog` keeps
  `startDisabled = anyInvalid || hasDuplicate` (`VariantDialog.tsx:249`) + the inline
  duplicate hint (Phase-51 D-10). A real user still resolves duplicates before
  submit; D-01 is defense-in-depth for a compromised/older/relaxed renderer. NO
  renderer behavior change and NO new renderer surface (keeps the diff surgical and
  honors "no happy-path change").

### WR-03 — No orphan empty variant directory (SC#2)
- **D-03:** In `exportOneVariant`'s rollback catch (`src/main/variant-export.ts:304-309`,
  AFTER the `for (const p of written) await fsRm(p,{force:true})` file sweep), remove
  the variant `outDir` ONLY when it exists and is empty after the sweep:
  `try { if ((await readdir(outDir)).length === 0) await fsRm(outDir, { recursive: true, force: true }); } catch {}`.
  The only-if-empty guard preserves a pre-existing non-empty folder (the overwrite=true
  re-export case) — never nuke user content. Result: a failed variant leaves NO orphan
  empty `{NAME}@{s}x/` directory. The happy path never throws → never reaches this code →
  unchanged.

### WR-04 — Variant-channel input coercion (SC#3)
- **D-04:** Variant IPC channels adopt an explicit **coerce-and-clamp** policy, with the
  single canonical clamp living in `exportOneVariant` step 2b (the WR-06 `safeBuffer`:
  `Number.isFinite(x) ? Math.max(0, Math.min(25, Math.trunc(x))) : 0`,
  `variant-export.ts:135-137`). Drop the redundant `Number(safetyBufferPercent) || 0`
  at BOTH variant handlers (`src/main/ipc.ts:1094` single, `:1132` batch) → pass
  `Number(safetyBufferPercent)` (the body's `Number.isFinite` guard coerces NaN→0).
  Single + batch coerce IDENTICALLY (already true for the rest of the ladder — keep
  them byte-parallel). Add a comment at BOTH handlers documenting the deliberate
  divergence: *"variant channels coerce-and-clamp (single canonical clamp in
  exportOneVariant step 2b); intentionally distinct from export:start's
  validate-and-reject (validateExportOpts) because the renderer pre-clamps and the
  body is the single authority."* **Do NOT** convert the variant channels to
  validate-and-reject — that would be a behavior change + dead ceremony (renderer
  already pre-clamps) and violates "no happy-path change."

### Cleanup (SC#4)
- **D-05 (IN-01):** Add a cross-boundary equivalence test asserting
  `tokenFor(x) === formatScaleToken(x)` over a shared sample array (include IEEE-754
  step artifacts like `0.30000000000000004` and near-collision pairs). Place it in
  **`tests/main/`** as a `.spec.ts` (node env) importing the main `formatScaleToken`
  (`src/main/variant-export.ts`) AND the renderer-local **pure** `tokenFor`/`displayFactor`
  (`src/renderer/src/modals/variant-scale-derive.ts` — pure math, no React/DOM).
  **MUST NOT** be authored as a `tests/renderer/*.ts` file (the node tsconfig
  `tests/**/*.ts` glob → TS6307, the renderer-.ts-helper landmine). Keep the
  two-source duplication — ROADMAP SC#4 chose the equivalence-test route, NOT the
  shared-helper refactor (Layer-3 keeps `tokenFor` renderer-local).
- **D-06 (IN-03):** Remove the dead `plan` prop. (a) Delete `plan: ExportPlan` from
  `VariantDialogProps` + its doc comment (`VariantDialog.tsx:72-75`) — first confirm no
  `props.plan` consumer exists in the dialog body. (b) In AppShell `onClickExportVariant`
  (`AppShell.tsx:822-828`) drop the `buildExportPlan(...)` call →
  `setVariantDialogState({ outDir: lastOutDir })`. (c) Drop `plan` from the
  `variantDialogState` type and stop passing it at the `<VariantDialog … />` site
  (`AppShell.tsx:2624`). KEEP the `buildExportPlan` import (still used at
  `AppShell.tsx:809/1031/1168/1302`). No behavior change (dead computation removed).
- **D-07 (IN-04):** Fix `onStart`'s misleading memoization (`VariantDialog.tsx:281-349`,
  deps `[props, startDisabled]` — `props` is a fresh object each render). Preferred:
  drop the `useCallback` wrapper and use a plain async function (it reads ~9 props, so
  an honest deps list ≡ "all props" → memoization buys nothing) with a one-line comment
  that it intentionally closes over the latest props. Acceptable alternative: keep
  `useCallback` and depend on the specific values actually read. Executor picks the
  cleaner diff. No behavior change (handler already reads latest props).

### Testing & scope
- **D-08:** Lock the new behaviors in tests. (a) TIGHTEN the existing orphan tolerance
  in `tests/main/variant-batch-faithful.spec.ts` (~`:278`, `if (fs.existsSync(folder))`)
  to ASSERT the failed variant's folder is GONE (WR-03). (b) Add a WR-02 partial-failure
  regression: a batch where two scales collide on one token → those rows `failed`, all
  non-colliding scales exported. (c) The D-05 equivalence test. Reuse existing fixtures
  or synthesize in-test — NO new committed fixture dir is expected. **IF** a new
  git-tracked fixture dir is added, co-extend `SAFE01_EXCLUDED_PREFIXES` in
  `tests/safe01/discover-fixtures.ts` (the SAFE-01 denylist landmine).
- **D-09 (scope guard):** Pure hardening + dead-code removal. ALL changes are confined
  to error/edge/rollback paths, IPC-boundary coercion, dead-prop removal, and tests.
  The happy path is behavior-preserving: a successful single export and a successful
  all-valid batch produce byte-identical output to pre-Phase-52. No new user-facing
  capability; `--skip-ui` (no UI-SPEC); NO `.stmproj` schema change (Phase 53). The
  existing 12/12 faithfulness matrix + full suite must stay green.

### Claude's Discretion
- Exact code form of D-03 (readdir-vs-stat empty check), D-07 (plain fn vs explicit
  deps list), and the precise sample array in D-05.
- Test file names, and whether WR-03's no-orphan assertion lands in the existing
  `variant-batch-faithful.spec.ts` or a new dedicated spec.
- Whether the D-01 dup `reason` copy matches the current message at
  `variant-export.ts:424` verbatim (keep it consistent).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirement
- `.planning/ROADMAP.md` → "### Phase 52" — goal + the 4 success criteria (authoritative scope)
- `.planning/REQUIREMENTS.md` → EXPORT-06 (line 40) — the requirement this phase closes

### Source of the backlog (MANDATORY — every item originates here)
- `.planning/phases/51-batch-variant-export/51-REVIEW.md` — WR-02/WR-03/WR-04 (§Warnings),
  IN-01/IN-03/IN-04 (§Info), and the §Resolution note (what `1c68cb8` already fixed:
  WR-01/WR-05/IN-02 — out of scope)

### Locked prior decisions
- `.planning/phases/51-batch-variant-export/51-CONTEXT.md` — 51 D-07 (continue-on-error
  per-variant rollback, the parity target for D-01), D-08 (per-folder result array),
  D-09 (between-variants cancel), D-10 (renderer dup-token gate, the D-02 anchor),
  D-11 (invalid gate), D-13 (one override bucket)

### Code under change
- `src/main/variant-export.ts` — `formatScaleToken` (:58), `exportOneVariant` body +
  WR-06 `safeBuffer` (:135), rollback catch (:304), `handleExportVariantBatch` dedup
  gate (:414)
- `src/main/ipc.ts` — `variant:export` handler (:1065), `variant:exportBatch` handler
  (:1103), `validateExportOpts` (:361, the validate-and-reject precedent D-04 deliberately
  does NOT adopt)
- `src/renderer/src/modals/VariantDialog.tsx` — `plan` prop (:72), `onStart` (:281),
  `isRowInvalid`/`hasDuplicate`/`startDisabled` (:225-249)
- `src/renderer/src/modals/variant-scale-derive.ts` — `tokenFor`/`displayFactor` (:40,49),
  Layer-3 invariant note (:11)
- `src/renderer/src/components/AppShell.tsx` — `onClickExportVariant` (:822),
  `<VariantDialog>` usage (:2622-2631)
- `src/main/skeleton-json-writer.ts` — `writeSkeletonJsonAtomic` mkdir (:42-46, the
  dir-creator behind the WR-03 orphan)

### Tests
- `tests/main/variant-batch-faithful.spec.ts` — continue-on-error test + the `:278`
  orphan tolerance to tighten (D-08a)
- `tests/renderer/variant-twoway.spec.ts` — existing `tokenFor` test (D-05 companion)
- `tests/main/variant-scale-guard.spec.ts` — WR-01 degenerate-token regression (the
  per-fix-regression pattern to mirror)

### Project guardrails
- `CLAUDE.md` — Fact #5 (core/ pure TS, no DOM; Layer-3 separation), test/fixture conventions
- `tests/arch.spec.ts` — Layer-3 purity gate (renderer ↛ core/main)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`exportOneVariant` `safeBuffer` clamp** (`variant-export.ts:135-137`) — THE canonical
  `safetyBufferPercent` guard; D-04 relies on it instead of the boundary `|| 0`.
- **The D-07 continue-on-error loop** (`variant-export.ts:444-465`) — each variant runs
  with its own `written` Set; the catch rolls back only that variant. D-01's dup-skip
  slots into the SAME loop with the same `pushResult` contract.
- **`pushResult`** (`variant-export.ts:405`) — appends to `results` AND emits on
  `variant:result`, so D-01's dup-failed rows color the scale/summary rows red live.
- **`validateExportOpts`** (`ipc.ts:361`) — the validate-and-reject precedent D-04
  deliberately does NOT extend to the variant channels.

### Established Patterns
- Per-variant rollback via a fresh `written` Set + force-rm sweep (T-49-ROLLBACK);
  WR-03 extends the sweep to the freshly-created (empty) `outDir`.
- Renderer-local token math mirrored from main (Layer-3): `tokenFor` ≡ `formatScaleToken`.
  D-05 locks the mirror with a test rather than merging the two sources.
- Regression-test-per-fix culture (Phase 51 added `variant-scale-guard.spec.ts`); D-08 follows it.

### Integration Points
- IPC boundary handlers (`ipc.ts` `variant:export` / `variant:exportBatch`) — D-04 coercion.
- The batch loop (`handleExportVariantBatch`) — D-01 dup-skip.
- The catch in `exportOneVariant` — D-03 dir cleanup.
- `VariantDialogProps` + AppShell `variantDialogState` — D-06 prop removal.

</code_context>

<specifics>
## Specific Ideas

- D-01 dup `reason` copy should match the existing collision-message style
  (`variant-export.ts:424`: `Duplicate scale token @${t}x — two rows produce the same folder.`).
- D-04 "documentation" = inline comments at both variant handlers + this CONTEXT decision;
  no separate doc file.
- "No happy-path change" (D-09) is verifiable: the 12/12 faithfulness matrix + full vitest
  suite + both typechecks must stay green; only edge/rollback/coercion/dead-code/test lines change.

</specifics>

<deferred>
## Deferred Ideas

- **Persist variant scale rows + output location in `.stmproj`** → Phase 53 (SCALEUI-03).
- **Merge `tokenFor`/`formatScaleToken` into a shared helper** — explicitly NOT done
  (ROADMAP SC#4 chose the equivalence-test route; Layer-3 keeps `tokenFor` renderer-local).
  Revisit only if the mirror proves fragile.
- **WR-05 (cancel affordance) / IN-02 (factor `max` attr)** — already FIXED in `1c68cb8`;
  not reopened.

### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-05-23-persist-variant-rows-and-output-location.md` —
  persist Export-Variant rows + output location in `.stmproj`. Considered but NOT folded:
  it belongs to Phase 53 (SCALEUI-03), not the `51-REVIEW.md` hardening scope of Phase 52.

</deferred>

---

*Phase: 52-batch-export-robustness-variant-dialog-cleanup*
*Context gathered: 2026-05-24*
