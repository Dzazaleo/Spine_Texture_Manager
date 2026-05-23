# Phase 51: Batch Variant Export - Research

**Researched:** 2026-05-23
**Domain:** Electron main↔renderer orchestration of an N-fold reuse of a proven single-scale export engine (TypeScript / React / IPC)
**Confidence:** HIGH — this is a brownfield extension; every recommendation is grounded in the live code (file:line cited), not re-derivation. The risky core (the bake + the single-scale orchestrator + the faithfulness oracle) is already shipped and green.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-13 — do NOT relitigate)
- **D-01:** Scale set = a list of rows. Each row is the full Phase-50 two-way control (factor / target-W / target-H, aspect-locked, uniform), with add (`+ Add scale`) and per-row remove. Rejected: free-text comma list, presets-first toggles.
- **D-02:** No quick-add presets. Just the manual `+ Add scale` button; every row typed from scratch.
- **D-03:** Dialog opens with one row at `0.5`. A 1-row list IS a single export.
- **D-04:** Unify single + batch into the existing "Export Variant…" dialog. 1 row = single export (today's behavior), 2+ rows = batch. No separate action, no mode switch. Button label stays "Export Variant…".
- **D-05:** "Optimize Assets" stays a SEPARATE, byte-untouched action (49-D-04 preserved). The Optimize⊕Variant merge is a deferred v1.8 UX refactor.
- **D-06:** Single pane, NO tabs. Scale-list rows → output mode / atlas opts / sharpen / safety buffer → progress / per-folder results. **Overturns the 49-D-06/50-D-09 "tabs land at 51" expectation — do NOT add tabs, do NOT cite those decisions to re-add them.**
- **D-07:** Continue-on-error; each `{NAME}@{s}x/` folder atomic on its own. A failure in one variant does NOT stop the others. Each variant keeps the Phase-49 per-export rollback contract (its OWN `written` Set). Rejected: all-or-nothing, stop-on-first-failure.
- **D-08:** Per-folder result list in the `complete` state — each scale's folder ✓ exported / ✗ reason, plus an aggregate ("2 of 3 exported"). Extends the single-scale summary. Rejected: aggregate-only.
- **D-09:** Cancel = stop after the current variant. Gates the batch BETWEEN variants: the in-flight folder finishes (it's atomic), remaining scales skipped, completed variants kept. Rejected: abort + roll back in-flight, no-cancel.
- **D-10:** Duplicate normalized tokens → flag + block Start. Two rows whose scales normalize to the same `@{s}x` token (via `formatScaleToken` = `String(Number(s.toFixed(4)))`) are detected pre-flight: offending rows highlighted, Export disabled with an inline hint. No silent collapse, no in-run overwrite.
- **D-11:** Start stays disabled while any row is invalid (blank / non-finite / `s ≤ 0` / `s ≥ 1`) — mirror the existing single-scale cheap renderer gate; the authoritative reject stays the main-side `VariantScaleError`. Invalid rows are a pre-flight gate, NOT a runtime per-variant failure.
- **D-12:** One overwrite choice for the whole run. Reuse the Phase-49 picker/confirm (`onConfirmStart` → `{ proceed, overwrite?, outDir? }`): one parent pick + one overwrite decision applies to all variants. With overwrite off, any pre-existing folder's variant fails per-folder (D-07). Zero new collision UX.
- **D-13:** The one active override bucket applies uniformly to every scale. Overrides are %-of-peak (relative), so they scale cleanly to each variant's `s × peak`. The active bucket already follows `loaderMode` via `effectiveOverrides` (AppShell.tsx:408-411) — no new routing. Per-scale override divergence stays deferred (L-05).

### Locked Carry-Forwards (L-01..L-05 — do NOT relitigate)
- **L-01:** Variant production = core `bake()` (full `SkeletonJson.scale` similarity bake), NOT a bone scale. Field-identical on 4.2 + 4.3 (spikes 001–003).
- **L-02:** `variant_peak = s × master_peak` (exact). NEVER re-sample a variant. Batch = N pure arithmetic re-sizings, one bake per scale.
- **L-03:** `core/` stays Layer-3 pure; `bake()` returns NEW JSON. The skeleton-JSON write lives in `main/` (`skeleton-json-writer.ts`).
- **L-04:** Dual-runtime (4.2 + 4.3) + dual-mode (atlas-source + atlas-less) are hard requirements. Each batch variant must satisfy this (SC#2).
- **L-05:** Folder layout `{PARENT}/{NAME}@{s}x/` sibling subfolders, clean basenames (49-D-01/D-02), is LOCKED and was DESIGNED as the no-collision batch fan-out.

### Claude's Discretion (research/planner resolves)
- Batch orchestration seam (renderer N×loop vs main-side `variant:exportBatch` channel) — **resolved in this doc, Q1**.
- Scale-list internal data model (array of `{ id, scale }` rows; per-row px-edit state) — **resolved, Q6**.
- In-run progress display — **resolved, Q5**.
- Master summary tiles (keep as master reference or drop) — **recommended drop, Q6**.
- Per-row live folder hint reuse of the inline `scaleToken` normalization — **resolved, Q3**.
- Whether to expose a `%` readout per row — minor enrichment; flagged not required (Deferred Ideas).
- Toolbar/label copy — button stays "Export Variant…" (D-04, no rename).

### Deferred Ideas (OUT OF SCOPE — do NOT build)
- What-if preview (per-scale dims/peak vs source; Atlas Preview reflecting a selected scale) — Future Req L-52, v1.8.
- Unified Export dialog (Optimize ⊕ Variant merge) — v1.8 UX refactor.
- Per-scale per-attachment overrides (independent buckets per scale) — Future Req L-05.
- Quick-add scale presets (½ ¼ ⅛ buttons) — declined this phase (D-02).
- Saved scale-sets / variant presets in `.stmproj` — Future Req.
- Percent (%) readout per scale row — minor enrichment, not required.
- Scale | Output | Batch tabs — explicitly NOT introduced (D-06).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-04 | User can export multiple scales in one batch run, each variant written to its own folder. | Q1 (orchestration seam) + Q2 (per-variant rollback) deliver the engine reuse; Q6 (scale-list data model) delivers the multi-row input; Q3/Q4/Q5 deliver dedup, cancel, and the per-folder result surface; Q7/Q8 deliver the SC#2 faithfulness proof + validation map. SC#2 ("each variant byte-identical to single-scale output for that scale, dual-runtime × dual-mode") is satisfied **by construction** because the orchestration reuses `handleExportVariant`'s body verbatim per scale (variant-export.ts:69-301). |
</phase_requirements>

## Summary

Phase 51 is the v1.7 finale and is almost entirely **reuse**. The single-scale engine `handleExportVariant` (`src/main/variant-export.ts:69-301`) already does everything one variant needs: D-08 guard → read source JSON → `bake(s)` (pure core) → derive `{PARENT}/{NAME}@{s}x/` → write-baked-JSON-first → `buildExportPlan(scaleSummaryPeaks(summary, s), …)` UNCHANGED → dispatch `runExport`/`runRepack` under **one `written` rollback Set local to that call** → merge → `ExportResponse`. The faithfulness bar (SC#2) is satisfied *by construction* if batch invokes that exact body once per scale.

The central design decision (Q1) is the orchestration seam: a renderer loop calling the existing `variant:export` channel N times, vs. a new main-side `variant:exportBatch` channel that loops internally. **Recommendation: a new thin main-side `variant:exportBatch` channel that loops over `handleExportVariant` per scale.** It owns the between-variants Cancel gate (D-09), the per-folder results aggregation (D-08), and a clean per-variant progress prefix far more naturally than a renderer loop — and, decisively, it makes per-variant rollback scope (D-07) free and obvious (each `handleExportVariant` call already mints its own `written` Set), while a renderer loop fights the module-level `variantExportInFlight` re-entrancy slot (`variant-export.ts:67`) on every iteration.

The renderer work (Q6) generalizes `VariantDialog`'s single `scale` + `activePxField`/`activePxRaw` edit state into an array of rows, each replicating the proven Phase-50 two-way control via the renderer-local `variant-scale-derive.ts` helpers. Dedup (Q3, D-10) and the invalid-row gate (Q4, D-11) are cheap renderer pre-flight checks that block Start; the authoritative rejects stay main-side. The faithfulness proof (Q7) reuses the *existing* committed fixtures and the existing drop-in oracle pattern — **no new fixture dir** (pre-empting the SAFE-01 denylist landmine), one new `tests/main/variant-batch-*.spec.ts` that asserts batch output is byte-identical to a per-scale single-call run, plus a renderer `.spec.tsx` for the multi-row UI.

**Primary recommendation:** Add a thin `handleExportVariantBatch` in `src/main/variant-export.ts` that loops `handleExportVariant` per scale under one outer guard, returns a `{ token, status, reason? }[]` array, and honors a between-variants cancel flag; wire it as a new `variant:exportBatch` IPC channel + preload binding; turn `VariantDialog` into a multi-row scale list; prove faithfulness by byte-comparing batch output to per-scale single-call output over the existing dual-runtime × dual-mode fixtures.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-row scale-list input + two-way derive per row | Renderer (`VariantDialog.tsx` + `variant-scale-derive.ts`) | — | Pure UI state; the derive helpers are renderer-local and Layer-3 (must not import core/main). |
| Duplicate-token pre-flight detection (D-10) | Renderer (Start gate) | Main (defense-in-depth, optional) | The blocking UX is renderer-side; main can reject too, but the renderer is where the user sees the highlight + disabled Start. |
| Invalid-row pre-flight gate (D-11) | Renderer (Start gate) | Main (`VariantScaleError`, authoritative) | Cheap renderer gate mirrors existing single-scale `scaleInvalid`; main owns the real reject. |
| One parent-pick + one overwrite decision (D-12) | Renderer (`onConfirmStartVariant` in AppShell) | — | Reused verbatim from Phase 49; runs the native picker once for the whole run. |
| Batch orchestration loop (iterate scales, between-variants cancel, aggregate results) | **Main** (`handleExportVariantBatch`, NEW) | — | Owns cancel signal, progress prefixing, results aggregation; serializes variants. |
| Per-variant bake + size + write under per-variant rollback Set | **Main** (`handleExportVariant`, REUSED unchanged) | Core (`bake`, `scaleSummaryPeaks`, `buildExportPlan`) | The proven engine; SC#2-by-construction. The skeleton-JSON write is main-only (L-03). |
| `s × master_peak` arithmetic (no re-sample) | Core (`scaleSummaryPeaks`) | — | L-02; pure arithmetic on the summary; never a sampler call. |
| Faithful scaled JSON | Core (`bake`) | — | L-01/L-03; returns new JSON, source never mutated. |
| Per-folder results + aggregate surface | Renderer (`complete` state) | Main (returns the result array) | Main computes the per-token outcome; renderer renders it, extending the existing per-row error list. |

---

## Q1 — Orchestration seam: renderer N×loop vs. main-side `variant:exportBatch` channel

### What the live code shows

**The single-scale engine is a self-contained, per-call atomic unit.** `handleExportVariant` (`variant-export.ts:69-301`):
- mints a **fresh `written` Set per call** at `variant-export.ts:213` (`const written = new Set<string>();`), used by both `runExport` (`:235-243`) and `runRepack` (`:246-256`) and swept on failure (`:286-290`);
- guards re-entrancy with a **module-level slot** `variantExportInFlight` (`:67`) — claimed at `:135`, released in `finally` at `:299`;
- returns the discriminated `ExportResponse` envelope (`shared/types.ts:601-608`), never throwing across the IPC boundary;
- imports **no spine-core** below `bake` — it's runtime-agnostic (the runtime facade is only touched earlier, during `buildSummary`/`loadSkeleton`, before export).

**The existing IPC channel** (`ipc.ts:1060-1091`) is a thin coercion wrapper delegating to `handleExportVariant`. **The preload binding** (`preload/index.ts:127-149`) mirrors it. **Progress** flows on a *separate* one-way channel: `runExport`/`runRepack` call `sendProgress` (`variant-export.ts:214-220`) which does `evt.sender.send('export:progress', e)`; the renderer subscribes via `window.api.onExportProgress` (`preload/index.ts:193-199`). **Crucial finding: `VariantDialog` does NOT currently subscribe to `export:progress`** — only `OptimizeDialog.tsx:197` does. The variant dialog shows a static "Exporting…" button (`VariantDialog.tsx:719-727`).

### The two options weighed

| Concern | Renderer N×loop (reuse `variant:export`) | Main-side `variant:exportBatch` (NEW) |
|---------|------------------------------------------|----------------------------------------|
| **Per-variant rollback (D-07)** | Free — each `exportVariant` call is a separate `handleExportVariant` invocation → own `written` Set. ✓ | Free — the loop calls `handleExportVariant` per scale → own `written` Set per iteration. ✓ |
| **Re-entrancy slot (`variantExportInFlight`)** | **Fights the loop.** The slot serializes naturally *if* the renderer awaits each call — but it returns `{ ok:false, 'already-running' }` (`:86-88`) if a second call overlaps. A renderer `await`-in-`for` loop is safe, but any accidental concurrency (double Start, React re-render race) yields a spurious `already-running` failure attributed to a *variant*, polluting the per-folder results. | **Clean.** One outer claim for the whole batch; the inner per-variant calls run sequentially inside, so the slot is held once. (Minor refactor needed — see "Implementation note" below.) |
| **Between-variants Cancel (D-09)** | Renderer owns a `cancelled` ref and breaks the loop between awaits. Works, but the cancel state lives in the dialog and must survive re-renders. | Main owns a per-batch cancel flag set by a `variant:cancelBatch` one-way send; checked between iterations. Mirrors the established `export:cancel` → `exportCancelFlag` pattern (`ipc.ts:1092-1096`). Cleaner ownership. |
| **Per-folder results (D-08)** | Renderer accumulates an array as each `await` resolves. Works. | Main returns the full `{ token, status, reason? }[]` array in one envelope. Single source of truth; the renderer just renders it. |
| **Per-variant progress prefix ("variant 2 of 3 — NAME@0.36x")** | Renderer knows the loop index → can render the prefix locally, but `export:progress` events are *per-file* and don't carry which variant they belong to → the renderer must correlate by ordering (fragile across the await boundary). | Main can emit a new `variant:batch-progress` event per variant ({ variantIndex, variantTotal, token }) interleaved with the existing per-file `export:progress`, giving the renderer an unambiguous prefix. |
| **IPC surface added** | Zero new channels (reuse `variant:export` + `onExportProgress`). | One new invoke channel (`variant:exportBatch`) + one new one-way cancel channel (`variant:cancelBatch`) + optionally one new progress event. |
| **SC#2 by construction** | Yes — each call IS the single-scale path. | Yes — the loop calls the single-scale path. |

### Recommendation: main-side `variant:exportBatch` channel

Add a thin orchestrator `handleExportVariantBatch` to `src/main/variant-export.ts` that:
1. claims a batch-level guard once,
2. loops the scales in order, calling the **existing `handleExportVariant` body per scale** (do NOT re-implement bake/size/write),
3. checks a between-variants cancel flag before each iteration (D-09),
4. accumulates a `BatchVariantResult[]` (one `{ token, status: 'exported' | 'failed' | 'skipped', reason?, successes? }` per scale),
5. optionally emits a `variant:batch-progress` event before each variant for the renderer's "variant N of M — NAME@{s}x" prefix,
6. returns `{ ok: true, results }`.

Rationale, decisively:
- **D-07 is free either way**, but the batch channel makes it *obvious* and removes the renderer-loop concurrency hazard around `variantExportInFlight`.
- **D-08 and D-09 are owned cleanly in main** — the cancel flag and the results array have one home, mirroring the proven `export:cancel`/`exportCancelFlag` precedent.
- **Progress correlation** is the deciding ergonomic factor: per-file `export:progress` events carry no variant identity, so a renderer loop cannot reliably label them by variant; a main-side batch emits an explicit per-variant marker.

### Implementation note: the re-entrancy slot must be refactored, not reused as-is

`handleExportVariant` currently both claims `variantExportInFlight` AND returns `'already-running'` if it's set. If `handleExportVariantBatch` claims a batch guard and *then* calls `handleExportVariant` per scale, the **first inner call would see the slot already claimed by the batch and return `'already-running'`**, failing every variant. Two clean ways out (planner picks one):

- **(A, recommended) Extract the inner work into an un-guarded function.** Pull the body of `handleExportVariant` (steps 1–10, i.e. `variant-export.ts:90-295`) into a private `exportOneVariant(evt, summary, s, parentDir, overwrite, …): Promise<ExportResponse>` that does **not** touch the slot. Keep the public `handleExportVariant` as a thin guard wrapper: claim slot → `try { return await exportOneVariant(...) } finally { release }`. `handleExportVariantBatch` claims the slot once, then calls `exportOneVariant` per scale. Each `exportOneVariant` call still mints its own `written` Set (the line `const written = new Set<string>()` moves with the body), so D-07 holds. This is a pure extraction — `handleExportVariant`'s external behavior is byte-identical, so all Phase-49 tests stay green.
- **(B) Add a shared module-level slot used by both.** Have batch claim `variantExportInFlight`, and have `handleExportVariant` accept an internal `_alreadyGuarded` flag to skip the claim when called from batch. Uglier; (A) is cleaner and keeps the guard logic in one place.

**→ Planner guidance:** Create `handleExportVariantBatch(evt, summary, scales: number[], parentDir, overwrite, sharpenEnabled, outputMode, atlasOpts, effectiveOverrides, safetyBufferPercent): Promise<{ ok: true; results: BatchVariantResult[] }>` in `src/main/variant-export.ts`. Refactor per option (A): extract the current `handleExportVariant` body (lines 90-295) into a private un-guarded `exportOneVariant(...)`, leave `handleExportVariant` as the guard wrapper, and have the batch claim the guard once and loop `exportOneVariant` per scale. Wire a new `variant:exportBatch` invoke channel in `ipc.ts` (model: the existing `variant:export` wiring at `ipc.ts:1060-1091`, same coercion ladder + the scales array) and a `variant:cancelBatch` one-way channel (model: `export:cancel` at `ipc.ts:1092-1096`). Add the matching preload bindings in `src/preload/index.ts` (model: `exportVariant` at `:127-149` for the invoke; `cancelExport`/`onExportProgress` for the one-way + subscription shapes). Each `exportOneVariant` call MUST keep its own `written` Set — verify the `const written = new Set<string>()` line travels into the extracted function, NOT up into the batch loop.

---

## Q2 — Per-variant rollback scope (D-07, continue-on-error)

### What the live code shows

`handleExportVariant` already gives each export its own rollback scope. At `variant-export.ts:213`:
```typescript
// 9. Shared rollback Set + progress closure (verbatim from ipc.ts:901-906 …).
const written = new Set<string>();
```
This Set is:
- passed to `writeSkeletonJsonAtomic` (`:230`) so the baked JSON registers in it,
- passed to `runExport` (`:243`) and `runRepack` (`:255`) as the `writtenPaths` accumulator (confirmed signatures: `runExport` 7th param `writtenPaths: Set<string>`, image-worker.ts:89+; `runRepack` 8th param `writtenPaths`, repack-worker.ts:257+),
- swept on any inner throw (`:286-290`: `for (const p of written) await fsRm(p, { force: true })`).

The Set is **a `const` local to the function call** — it cannot leak across calls. The `written` Set's lifetime is exactly one variant.

### Recommendation: reuse the whole body per scale → each variant gets its own Set for free

With option (A) from Q1, the extracted `exportOneVariant` body still declares `const written = new Set<string>()` per invocation. The batch loop calls `exportOneVariant` once per scale, so:
- variant @0.5x gets Set #1 (rolled back only if @0.5x fails),
- variant @0.36x gets Set #2 (independent),
- a failure in @0.5x rolls back ONLY `{PARENT}/NAME@0.5x/*` and **continues** to @0.36x (D-07).

**There is NO shared batch-wide Set.** The batch loop owns only the *results array*, never a rollback Set. The atomic boundary is the variant; the batch is a sequence of atomic variants. This is exactly the "each `{NAME}@{s}x/` folder must be atomic; no half-written package" requirement from the memory landmine [[feedback_fix_review_blockers_before_close]].

### Continue-on-error wiring

`handleExportVariant`/`exportOneVariant` already returns a typed `ExportResponse` rather than throwing — so the batch loop never needs a try/catch around it for control flow. Per scale:
```
res = await exportOneVariant(...)        // never throws across the boundary
if (res.ok) {
  results.push({ token, status: res.summary.errors.length ? 'exported-with-errors' : 'exported',
                 successes: res.summary.successes, errors: res.summary.errors })
} else {
  results.push({ token, status: 'failed', reason: res.error.message })
}
// LOOP CONTINUES regardless (D-07) — no break, no rethrow
```
Note the partial-failure nuance already handled in the renderer for single-scale (`VariantDialog.tsx:209-221`, CR-01): `runExport`/`runRepack` push per-row failures into `summary.errors[]` and return `ok:true`. The batch result shape must preserve that distinction so the per-folder list can show "@0.5x — 3 exported, 1 failed" (D-08).

**→ Planner guidance:** Do NOT introduce a batch-wide rollback Set. Confirm via task action that the extracted `exportOneVariant` retains its own `const written = new Set<string>()` (variant-export.ts:213 moves into the body). The batch loop owns only `results: BatchVariantResult[]`. Define `BatchVariantResult` (suggest in `src/shared/types.ts` next to `ExportResponse`) as `{ token: string; status: 'exported' | 'exported-with-errors' | 'failed' | 'skipped'; successes?: number; errors?: ExportError[]; reason?: string }`. Require a test (Q7) that injects a forced failure in one scale (the existing `maxPageSize: 64` oversize trick from variant-package-layout.spec.ts:328-382) and asserts the OTHER scales' folders fully landed and the failed scale's folder is empty/absent.

---

## Q3 — Dedup key + placement (D-10)

### What the live code shows

The canonical token math is `formatScaleToken` at `variant-export.ts:57-59`:
```typescript
export function formatScaleToken(s: number): string {
  return String(Number(s.toFixed(4)));   // formatScaleToken(0.5) === '0.5'
}
```
This is the SAME normalization the folder name uses (`variant-export.ts:129`: `` `${NAME}@${formatScaleToken(s)}x` ``). The renderer already duplicates this exact 1-liner inline twice, deliberately, to honor Layer-3:
- `VariantDialog.tsx:293`: `const scaleToken = String(Number(props.scale.toFixed(4)));` (the folder hint),
- `variant-scale-derive.ts:40`: `displayFactor = (s) => Number(s.toFixed(4));` (note: returns the *number* before `String()`).

The renderer-local helper `displayFactor` (`variant-scale-derive.ts:40`) is explicitly documented as "== formatScaleToken math" and copied inline "precisely to honor the renderer-↛-core/main boundary." The arch gate (`tests/arch.spec.ts:20-31`) forbids the renderer from importing `core/` (and by the same Layer-3 doctrine, `main/`).

### Recommendation: dedup runs renderer-side as the primary Start gate; the token helper is the renderer-local one

- **Renderer-side (primary, required):** Compute the token per row with `String(displayFactor(row.scale))` (i.e. `String(Number(row.scale.toFixed(4)))` — byte-identical to `formatScaleToken`). Group rows by token; any token with >1 row marks those rows as colliding → highlight them + disable Start with the inline hint "two scales produce @0.5x" (D-10). This is the user-facing gate.
- **Main-side (defense-in-depth, optional but cheap):** `handleExportVariantBatch` can `formatScaleToken`-normalize the incoming scales and, if it finds a collision, reject the whole batch with a typed error before doing any work. This guards a misbehaving renderer (the documented trust boundary, ipc.ts:30-32). Low cost; recommend including it.

**How the renderer reaches the same token math without importing main/:** It already does — extend the existing renderer-local `displayFactor` (`variant-scale-derive.ts:40`) usage. Add a tiny `tokenFor(s: number): string => String(displayFactor(s))` to `variant-scale-derive.ts` (one line, pure, no imports) so the dedup grouping and the per-row folder hint share ONE renderer-local source. This keeps the "byte-identical to formatScaleToken" contract that `variant-scale-derive.ts:11-15` already documents.

**Do NOT** try to import `formatScaleToken` from `variant-export.ts` into the renderer — it's a Node module (`node:fs`, `node:path`), and the arch gate + Layer-3 doctrine forbid it. The 1-liner duplication is the *sanctioned* pattern here (precedent: VariantDialog.tsx:290-293, variant-scale-derive.ts:11-15).

**→ Planner guidance:** Add `export const tokenFor = (s: number): string => String(displayFactor(s));` to `src/renderer/src/modals/variant-scale-derive.ts` (pure, no new imports — `displayFactor` is already there). In `VariantDialog`, compute `tokenFor(row.scale)` per row, group by token, and treat any token shared by >1 row as a collision: add the colliding rows to a highlighted set and include "duplicate token" in the Start-disabled predicate (alongside the invalid-row gate from Q4). Optionally add a main-side guard in `handleExportVariantBatch`: normalize the scales with `formatScaleToken` and reject the batch (typed error) if any two collide. Add a unit test in the renderer `.ts` helper spec asserting `tokenFor(0.5) === tokenFor(0.50001) === '0.5'` (the D-10 example) — and remember this `.ts` file must be in the `tsconfig.node.json` exclude list (it already is, for `variant-twoway.spec.ts`; add the new file the same way if you create a new `.ts` spec — see Q8).

---

## Q4 — Cancel plumbing (D-09 — between-variants only)

### What the live code shows

- Each variant's workers are called with a **hard-wired no-op cancel cb**: `runExport(plan, outDir, sendProgress, () => false, …)` (`variant-export.ts:239`) and `runRepack(…, () => false, …)` (`:250`). The comment at `:239` is explicit: "no separate variant cancel channel this phase." Both workers DO accept a `() => boolean` `isCancelled` as their 4th positional arg (confirmed: image-worker.ts:89+, repack-worker.ts:257+ both list `isCancelled: () => boolean` 4th).
- The established cancel precedent for the *non-variant* export is `ipc.ts:1092-1096`: `ipcMain.on('export:cancel', () => { exportCancelFlag = true; })` — a one-way renderer→main send that flips a module-level flag the runExport loop reads between files (D-115).
- D-09 (CONTEXT) is unambiguous: "Cancel = stop AFTER the current variant... the in-flight folder finishes (it's atomic)... D-09 only needs a between-variants gate, NOT threading cancel into a variant's workers." The per-worker `() => false` STAYS `() => false`.

### Recommendation: a main-side per-batch cancel flag, checked between iterations (mirrors `export:cancel`)

For the chosen main-side orchestration seam (Q1):
1. Add a module-level `let variantBatchCancelRequested = false;` in `variant-export.ts` (or pass a cancel-token object into `handleExportVariantBatch`).
2. Add `ipcMain.on('variant:cancelBatch', () => { variantBatchCancelRequested = true; })` in `ipc.ts` (model: `export:cancel` at `ipc.ts:1092-1096`).
3. In `handleExportVariantBatch`, **reset the flag to false at the start** (so a stale cancel from a prior run doesn't poison a new batch), then **check it at the top of each iteration**:
   ```
   variantBatchCancelRequested = false;          // reset at batch start
   for (let i = 0; i < scales.length; i++) {
     if (variantBatchCancelRequested) {
       // record remaining scales as 'skipped' (D-09: "cancelled before NAME@{s}x")
       for (let j = i; j < scales.length; j++)
         results.push({ token: formatScaleToken(scales[j]), status: 'skipped' });
       break;
     }
     const res = await exportOneVariant(... scales[i] ...);   // ATOMIC unit — finishes or rolls back
     results.push(...);
   }
   ```
4. The in-flight variant is **never interrupted** — `exportOneVariant`'s workers keep their `() => false` cb, so the current folder either fully lands or fully rolls back (its own Set). Cancel only prevents the *next* variant from starting (D-09).
5. Preload: add `cancelVariantBatch: () => ipcRenderer.send('variant:cancelBatch')` (model: `cancelExport` send). The renderer's Cancel button (shown during in-progress) calls it.

This keeps the cancel flag's ownership in main (single source of truth), exactly like `exportCancelFlag`, and guarantees the atomic-variant invariant.

**→ Planner guidance:** Add a module-level `variantBatchCancelRequested` flag in `src/main/variant-export.ts`, reset it at the start of `handleExportVariantBatch`, and check it at the top of each loop iteration; on cancel, record the remaining scales as `status: 'skipped'` and break. Add `ipcMain.on('variant:cancelBatch', …)` in `ipc.ts` (model: `export:cancel` ipc.ts:1092-1096) and `cancelVariantBatch` in the preload (model: `cancelExport`). DO NOT change the per-worker `() => false` cancel cbs (variant-export.ts:239,250) — D-09 is between-variants only. Add a test asserting that a cancel set after variant 1 leaves variant 1's folder intact, variant 2's folder absent, and variant 2 recorded `skipped`.

---

## Q5 — Per-folder results + in-run progress surface (D-08)

### What the live code shows

- **Existing complete-state summary** (`VariantDialog.tsx:662-696`): on `ok`, shows "Variant written to NAME@0.5x/ — N files exported"; on partial failure, shows "N succeeded, M failed" + a `<ul>` of per-file `{path}: {message}` (the CR-01 fix, mirroring OptimizeDialog.tsx:1003-1028).
- **Existing in-progress state** (`VariantDialog.tsx:719-727`): a static disabled "Exporting…" button. **No live progress bar in the variant dialog** (only OptimizeDialog subscribes to `onExportProgress`).
- **Progress event shape** (`shared/types.ts:549-564`): `ExportProgressEvent { index, total, path, outPath, status, error?, phase? }` — all per-file, no variant identity.

### Recommendation: result shape + a two-level progress display

**Result shape** (what `handleExportVariantBatch` returns — see Q2): `{ ok: true; results: BatchVariantResult[] }`, where each `BatchVariantResult = { token, status: 'exported' | 'exported-with-errors' | 'failed' | 'skipped', successes?, errors?, reason? }`. The renderer renders, in the `complete` state:
- **Aggregate line** (D-08): "2 of 3 exported" — count `status === 'exported' || 'exported-with-errors'` over `results.length`. If cancelled, append "(cancelled before NAME@{s}x)" using the first `skipped` token.
- **Per-folder list** (D-08): one row per result — ✓ `NAME@0.5x/ — 3 files` (exported), ⚠ `NAME@0.36x/ — 2 exported, 1 failed` + nested per-file errors (exported-with-errors, reuse the existing `<ul>` pattern at VariantDialog.tsx:680-693), ✗ `NAME@0.25x/ — {reason}` (failed), ⊘ `NAME@0.2x/ — skipped` (cancelled). This is a direct generalization of the single-scale summary block (VariantDialog.tsx:662-696) — one block per result instead of one block total.

**In-run progress** (Claude's discretion, "pick the clearest"): two levels.
- **Variant-level prefix** (the clear win): subscribe to a new `variant:batch-progress` event ({ variantIndex, variantTotal, token }) emitted by `handleExportVariantBatch` before each `exportOneVariant`. Render "Exporting variant 2 of 3 — NAME@0.36x". This is the minimum that makes a long batch legible.
- **File-level bar** (optional reuse): the variant dialog *could* now also subscribe to the existing `onExportProgress` (preload/index.ts:193-199) to show the per-file count within the current variant, mirroring OptimizeDialog. Recommended but not required; if included, reset the per-file counter on each `variant:batch-progress` so the bar restarts per variant. If the planner wants to keep scope tight, the variant-level prefix alone is acceptable (the single-scale dialog shipped with no file bar at all).

**Cancel button** lives in the in-progress footer (replacing/alongside the disabled "Exporting…" button). It calls `cancelVariantBatch` (Q4). Disable it once `variantIndex === variantTotal` (last variant in flight, can't skip anything).

**→ Planner guidance:** Define `BatchVariantResult` (Q2) and return `{ ok: true; results }` from `handleExportVariantBatch`. In `VariantDialog`, replace the single complete-state summary block (VariantDialog.tsx:662-696) with a per-result list + aggregate "X of N exported" line, reusing the existing per-file `<ul>` (`:680-693`) for `exported-with-errors`/`failed` rows. Emit a `variant:batch-progress` event from main before each variant and render a "variant N of M — {token}" prefix in the in-progress state (replace the static "Exporting…" at `:719-727`). Add a Cancel button in the in-progress footer wired to `cancelVariantBatch`. The per-file `onExportProgress` bar is optional (recommend reuse if cheap; reset per variant).

---

## Q6 — Scale-list renderer data model (D-01/D-03)

### What the live code shows

`VariantDialog` currently holds a **single** scale via props (`scale: number`, `onScaleChange`, `VariantDialog.tsx:79-80`) lifted to AppShell state (`variantScale`, AppShell.tsx:564), and a **single** px-edit state pair internally:
```typescript
const [activePxField, setActivePxField] = useState<'w' | 'h' | null>(null);  // :112
const [activePxRaw, setActivePxRaw] = useState<string>('');                  // :113
```
The two-way control is three coupled inputs (Factor / Width / Height) wired through the renderer-local `pxFromScale`/`scaleFromPx`/`displayFactor` (`variant-scale-derive.ts`), reading `props.summary.bbox` (`:137-145`) as the reference axes. The `bbox` is shared across all rows (it's the rig's setup-pose box — one rig, one box; D-13's "one active config" doctrine extends naturally).

### Recommendation: an array of row objects with per-row scale + per-row px-edit state

Generalize to a rows array. Two viable homes for the state:

- **(Recommended) Lift the rows array to AppShell**, mirroring how `variantScale` is lifted today (AppShell.tsx:564). Replace `const [variantScale, setVariantScale] = useState(0.5)` with `const [variantRows, setVariantRows] = useState<{ id: string; scale: number }[]>(() => [{ id: crypto.randomUUID(), scale: 0.5 }])` (D-03: opens with one row at 0.5). Pass `rows` + `onRowsChange` to the dialog. This keeps the dialog's "controlled by parent" shape consistent with the existing `scale`/`onScaleChange` contract and lets AppShell own the canonical scale set (useful if a future phase persists it).
- **(Alternative) Keep the rows array internal to `VariantDialog`** (initialized to `[{ id, scale: 0.5 }]` on open). Simpler diff, but diverges from the existing lifted-state pattern. Acceptable if the planner prefers a smaller AppShell change.

**Per-row px-edit state:** the single `activePxField`/`activePxRaw` pair (`:112-113`) generalizes to "which row, which axis, raw text." Cleanest as a single piece of state keyed by row id:
```typescript
const [activePx, setActivePx] = useState<{ rowId: string; field: 'w' | 'h'; raw: string } | null>(null);
```
A px input is "active" iff `activePx?.rowId === row.id && activePx.field === axis`. The onFocus/onChange/onBlur handlers (currently VariantDialog.tsx:402-420 for width, :447-465 for height) become per-row closures that set/clear `activePx` with the row id. The derive math per row is unchanged — call `pxFromScale(row.scale, bbox.w)` / `scaleFromPx(parsed, bbox.w)` exactly as today, just per row.

**Add/remove mechanics:**
- `+ Add scale` button: `setVariantRows(rows => [...rows, { id: crypto.randomUUID(), scale: <default> }])`. Default for a new row: 0.5 is fine (D-02: typed from scratch; the user edits it). If 0.5 already exists it'll show as a dedup collision (D-10) until edited — acceptable and self-explanatory.
- Per-row remove (✕): `setVariantRows(rows => rows.filter(r => r.id !== id))`. Guard against removing the last row (a 1-row list IS a single export, D-03/D-04 — never zero rows; disable/hide remove when `rows.length === 1`).
- Stable React keys: use `row.id` (the `crypto.randomUUID()`), NOT the array index — index keys break when removing a middle row.

**Per-row folder hint:** reuse `tokenFor(row.scale)` (Q3) to render `{NAME}@{token}x` next to each row (generalizes the single `folderHint` at VariantDialog.tsx:294).

**Master summary tiles** (Claude's discretion): the current display-only master-sized `plan` tiles (`props.plan`, VariantDialog.tsx:56-59) describe the *master*, not any variant. With N variants they're ambiguous. **Recommend dropping them from the batch dialog** (or keeping a single "master setup-pose: W×H" reference line, which the bbox line at `:346-350` already provides). Don't build per-variant preview tiles — that's the deferred what-if preview (L-52, v1.8).

**Invalid-row gate (D-11):** the existing `scaleInvalid` check (VariantDialog.tsx:127-128) becomes per-row; Start is disabled if ANY row is invalid OR any dedup collision exists (Q3). Each invalid row shows the existing inline hint (`:473-477`).

**→ Planner guidance:** Replace the single `scale`/`onScaleChange` prop with a `rows: { id: string; scale: number }[]` + `onRowsChange` prop (lift state to AppShell, mirroring `variantScale` at AppShell.tsx:564 → `variantRows` initialized to `[{ id: crypto.randomUUID(), scale: 0.5 }]`). Generalize the internal `activePxField`/`activePxRaw` (VariantDialog.tsx:112-113) to a single `activePx: { rowId, field, raw } | null`. Render one two-way control block per row (the existing Factor/Width/Height block at `:340-478`, parameterized by row), reusing `pxFromScale`/`scaleFromPx`/`displayFactor` per row unchanged. Add `+ Add scale` (append `{ id: crypto.randomUUID(), scale: 0.5 }`) and per-row remove (filter by id; disable when `rows.length === 1`). Use `row.id` as the React key. Per-row folder hint via `tokenFor(row.scale)` (Q3). Drop the master `plan` tiles (or keep only the bbox reference line at `:346-350`). The `onStart` flow (VariantDialog.tsx:147-254) changes from a single `exportVariant` call to one `exportVariantBatch` call passing `rows.map(r => r.scale)` (the picker/overwrite confirm at `:158-163` is unchanged — one pick for the run, D-12).

---

## Q7 — SC#2 faithfulness test strategy (dual-runtime × dual-mode)

### What the live code shows (the reusable oracle infrastructure)

- **`tests/main/variant-dropin-faithful.spec.ts`** (CONFIRMED exact path/name) — the Phase-49 drop-in faithfulness oracle. It runs `handleExportVariant` into a tmpdir over a 2-rig matrix (SIMPLE_TEST 4.2 + SLIDER-01 4.3, lines 77-80) and proves (a) geometry field-identity, (b) cross-resolve load, (c) `s×` world-AABB. Co-imports both spine-core specifiers (`sc42`/`sc43`, lines 45-46) — the sanctioned dual-runtime test harness. **No new entrypoint risk** (header lines 28-33): it parses via co-imported runtimes directly, inheriting the proven harness.
- **`tests/main/variant-package-layout.spec.ts`** — the dual-runtime × dual-mode MATRIX (lines 93-136): (4.2 + 4.3) × (atlas-source + atlas-less), with the documented 4.3-atlas-less-is-atlas-mode-only deviation (lines 120-135). Also the oversize-forced-rollback test (lines 319-383) using `maxPageSize: 64` to force a genuine worker throw.
- Both reuse the **existing committed fixtures** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.*` (4.2) and `fixtures/SLIDER_4_3/SLIDER-01.*` (4.3) — both already in `SAFE01_EXCLUDED_PREFIXES` (discover-fixtures.ts:121) where needed. **No new fixture dir is required** for Phase 51.

### Recommendation: prove batch ≡ N× single-call, byte-for-byte, over the existing matrix — no new fixtures

The SC#2 bar is "each batch variant is byte-identical to the single-scale path output for that scale." The cleanest proof, given SC#2-by-construction:

**New test `tests/main/variant-batch-faithful.spec.ts`** (a `.ts` file under `tests/main/` — fine, NOT a renderer test, so no `.spec.tsx` rule applies; it's already in the node program's `tests/**/*.ts` glob and that's correct for a main-side test). Over the existing dual-runtime × dual-mode matrix (copy the MATRIX shape from variant-package-layout.spec.ts:93-136):
1. **Batch-vs-single byte-identity (the SC#2 core):** for a multi-scale set (e.g. `[0.5, 0.36]`), run `handleExportVariantBatch` into tmpdir A, and separately run `handleExportVariant` once per scale into tmpdir B. Assert that for each scale, `B/NAME@{s}x/*` and `A/NAME@{s}x/*` are byte-identical: compare the baked `{NAME}.json` bytes, the `{NAME}.atlas` text, and (for deterministic PNG output) the PNG bytes — or at minimum the JSON + atlas (PNG byte-determinism depends on libvips; if PNGs aren't byte-stable across runs, compare dimensions + the atlas region table instead, which IS deterministic). The JSON + atlas byte-identity is the load-bearing SC#2 proof (the textures follow from the same plan).
   - *Why this works:* batch calls the same `exportOneVariant` body the single path calls, with the same `(summary, s, parentDir, overwrite, …)` per scale → identical output by construction. The test *guards* that the refactor (Q1 option A) didn't perturb the body.
2. **Continue-on-error + per-variant rollback (D-07):** run a 3-scale batch where the middle scale is forced to fail (the `maxPageSize: 64` oversize trick, variant-package-layout.spec.ts:328-382, applied to one scale — or a per-scale overwrite collision). Assert: scales 1 and 3 folders fully landed (JSON + artifacts present), the failed scale's folder is empty/absent (its own Set rolled back), and `results` reports `[exported, failed, exported]`. **This is the highest-value new test** — it proves the per-variant atomic boundary that the memory landmine [[feedback_fix_review_blockers_before_close]] demands for a data-writing feature.
3. **Between-variants cancel (D-09):** simulate a cancel after variant 1 (set the cancel flag, or inject via the cancel mechanism). Assert variant 1 landed, variant 2 folder absent, variant 2 recorded `skipped`.
4. **Dual-runtime × dual-mode coverage:** run the byte-identity case (1) for at least one 4.2 cell and one 4.3 cell, and for both atlas-source and atlas-less modes (honoring the 4.3-atlas-less-is-atlas-mode-only deviation documented at variant-package-layout.spec.ts:120-135). Reuse the existing `buildCellSummary` helper pattern (variant-package-layout.spec.ts:143-151).

**Renderer test `tests/renderer/variant-batch-dialog.spec.tsx`** (MUST be `.spec.tsx`, NOT `.ts` — [[feedback_renderer_ts_helper_test_breaks_typecheck_node]]; harness pattern from variant-dialog.spec.tsx:1-114): assert the multi-row mechanics —
- opens with one row at 0.5 (D-03);
- `+ Add scale` adds a row; per-row remove removes it; remove is disabled at 1 row;
- two duplicate-token rows highlight + disable Start (D-10);
- an invalid row (s ≥ 1 / blank) disables Start (D-11);
- clicking Export with 2 valid rows calls `window.api.exportVariantBatch` ONCE with `scales: [0.5, 0.36]` (or whatever) + the picked parent dir (mirror the single-scale arg-order assertion at variant-dialog.spec.tsx:11-14);
- the complete state renders the per-folder result list + aggregate from a stubbed `results` array (D-08).

**Renderer helper test:** if you add `tokenFor` (Q3), test it in the EXISTING `tests/renderer/variant-twoway.spec.ts` (already excluded in tsconfig.node.json:34) OR a new `.spec.tsx` — do NOT create a NEW `.ts` renderer test without adding it to the `tsconfig.node.json` exclude (Q8).

**Per-runtime entrypoint verification** ([[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]]): the batch path is **runtime-agnostic below `bake`** — `variant-export.ts` imports no spine-core (verified: imports are `bake`, `scaleSummaryPeaks`, `buildExportPlan`, `VariantScaleError`, `writeSkeletonJsonAtomic`, `runExport`, `runRepack`, types). The runtime facade is touched only earlier, at `buildSummary`/`loadSkeleton` (before export), which Phase 49 already proved across all entrypoints. So **batch adds NO new per-runtime seam** — the only new code is the orchestration loop + IPC, which never touches the runtime. The existing vitest setup (`tests/setup/esm-adapter-resolver.ts`, vitest.config.ts:23) covers the test entrypoint; the built CJS worker and `npm run cli` entrypoints are unaffected (batch is a main-process orchestrator, not a new core seam). **Confirm in a task:** the new `handleExportVariantBatch` imports nothing from spine-core / the runtime facade (grep assertion).

### No new fixtures → no SAFE-01 denylist work

Confirmed: the batch tests reuse `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.*` and `fixtures/SLIDER_4_3/SLIDER-01.*`, both already handled in `SAFE01_EXCLUDED_PREFIXES` (discover-fixtures.ts:121). **No new committed fixture dir → no `SAFE01_EXCLUDED_PREFIXES` extension needed** ([[feedback_new_committed_fixtures_need_safe01_denylist]] pre-empted). If the planner finds it needs a NEW fixture (it should not), it MUST co-extend the denylist — but the recommendation is explicitly to reuse.

**→ Planner guidance:** Add `tests/main/variant-batch-faithful.spec.ts` (`.ts`, main-side) covering: (1) batch-vs-single byte-identity of `{NAME}.json` + `{NAME}.atlas` per scale over a 4.2 + 4.3 × atlas-source + atlas-less matrix (copy the MATRIX + `buildCellSummary` from variant-package-layout.spec.ts:93-151); (2) continue-on-error with one forced-fail scale (the `maxPageSize: 64` trick, variant-package-layout.spec.ts:328-382) asserting other folders intact + failed folder absent; (3) between-variants cancel leaving variant 1 intact + variant 2 skipped. Add `tests/renderer/variant-batch-dialog.spec.tsx` (`.spec.tsx`, harness from variant-dialog.spec.tsx) covering add/remove rows, dedup-disables-Start, invalid-disables-Start, one `exportVariantBatch` call with the scales array, and the per-folder result render. Reuse the EXISTING fixtures — NO new fixture dir (do NOT touch `SAFE01_EXCLUDED_PREFIXES`). Add a grep/import assertion that `handleExportVariantBatch`'s module imports no spine-core.

---

## Q8 — Validation Architecture (REQUIRED — Nyquist VALIDATION.md instantiation)

`workflow.nyquist_validation: true` (.planning/config.json) → this section is required and the planner MUST instantiate `51-VALIDATION.md` fully from it ([[feedback_instantiate_validation_md_from_research]] — a stub blocks plan-checker Check 8e).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (config: `vitest.config.ts`; setupFile `tests/setup/esm-adapter-resolver.ts`) |
| Config file | `vitest.config.ts` (+ `tsconfig.node.json` / `tsconfig.web.json` for typecheck programs) |
| Quick run command | `npx vitest run tests/main/variant-batch-faithful.spec.ts tests/renderer/variant-batch-dialog.spec.tsx` |
| Full suite command | `npm run test` (vitest run, all files) |
| Typecheck (node program) | `npm run typecheck:node` (or the project's tsc:node script) — gates `.ts` renderer-test glob (Q8 landmine) |
| Typecheck (web program) | `npm run typecheck:web` — gates renderer `.tsx` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| EXPORT-04 / SC#1 | N scales → N `{NAME}@{s}x/` sibling folders in one run | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "byte-identity"` | ❌ Wave 0 |
| EXPORT-04 / SC#2 | Each batch variant byte-identical to single-scale output for that scale (JSON + atlas), dual-runtime × dual-mode | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "matrix"` | ❌ Wave 0 |
| D-07 | Continue-on-error; each folder atomic (own rollback Set); failed scale's folder absent, others intact | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "continue-on-error"` | ❌ Wave 0 |
| D-09 | Between-variants cancel: in-flight finishes, remaining skipped | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "cancel"` | ❌ Wave 0 |
| D-10 | Duplicate normalized tokens flagged + Start blocked; `tokenFor(0.5)===tokenFor(0.50001)` | unit (renderer helper) + component | `npx vitest run tests/renderer/variant-twoway.spec.ts tests/renderer/variant-batch-dialog.spec.tsx -t "duplicate"` | ❌ Wave 0 |
| D-11 | Invalid row disables Start (mirror single-scale gate) | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "invalid"` | ❌ Wave 0 |
| D-01/D-03 | Opens with one row at 0.5; add/remove rows; remove disabled at 1 row | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "rows"` | ❌ Wave 0 |
| D-12 | One parent pick + one overwrite for the run; one `exportVariantBatch` call with scales[] | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "single call"` | ❌ Wave 0 |
| D-08 | Per-folder result list + aggregate ("X of N exported") rendered in complete state | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "result list"` | ❌ Wave 0 |
| L-03 / Layer-3 | `core/` stays pure; renderer never imports core/; `handleExportVariantBatch` imports no spine-core | static (grep/arch) | `npx vitest run tests/arch.spec.ts` + a grep assertion | ✅ (arch.spec.ts exists; add the spine-core grep) |
| L-04 / SC#2 | Dual-runtime (4.2 + 4.3) + dual-mode (atlas-source + atlas-less) cells all green | integration (main) | covered by the matrix in variant-batch-faithful.spec.ts | ❌ Wave 0 |

### Headless-testable vs. needs running Electron
- **Headless (vitest/node + jsdom) — fully automated:** the orchestration loop, per-variant rollback, continue-on-error, between-variants cancel, byte-identity vs single-call, dedup/invalid gates, the multi-row UI mechanics, the result-list render, Layer-3 purity. This is the bulk of SC#1/SC#2.
- **Needs a running Electron dev server — HUMAN-UAT carry-forward:** (1) the **native parent-folder picker** rendering + behavior (not jsdom-testable — consistent with Phase 49's open "native folder-picker visual UAT" carry-forward, STATE.md line 27, and the long-standing pattern at STATE.md:118 "require Electron native folder picker (not jsdom-testable)"); (2) the **actual multi-row UI interaction** end-to-end (typing two real percentages, picking a real parent, seeing two real sibling folders appear with two real drop-in packages) — the "I want 36% and 57%" end-state from CONTEXT `<specifics>`. Recommend a `51-HUMAN-UAT.md` with: pick a real rig, add a 2nd row, enter two distinct scales, run, confirm two `{NAME}@{s}x/` folders each load in Spine. State the observable END-STATE in each criterion ([[feedback_uat_opened_is_not_rendered]] — "two folders exist AND each loads/renders," not "dialog opened").

### Sampling Rate
- **Per task commit:** the quick run command (the two new spec files).
- **Per wave merge:** `npm run test` + `npm run typecheck:node` + `npm run typecheck:web` (the `.ts`-renderer-glob landmine means typecheck:node MUST be in the merge gate).
- **Phase gate:** full suite green on all 3 OS via CI (`ci.yml`) AND, before any release, `release.yml` separately ([[feedback_release_yml_diverges_from_ci_yml]], [[feedback_verify_whole_ci_surface_locally]]) — local green ≠ CI green; CI green ≠ release green.

### Wave 0 Gaps
- [ ] `tests/main/variant-batch-faithful.spec.ts` — covers EXPORT-04 SC#1/SC#2 + D-07 + D-09 + L-04 (reuses existing fixtures + `buildCellSummary`/MATRIX patterns).
- [ ] `tests/renderer/variant-batch-dialog.spec.tsx` — covers D-01/D-03/D-08/D-10/D-11/D-12 multi-row UI (harness from variant-dialog.spec.tsx).
- [ ] `tokenFor` unit assertion in `tests/renderer/variant-twoway.spec.ts` (already tsconfig.node-excluded) OR a new `.spec.tsx`.
- [ ] A grep/arch assertion that `src/main/variant-export.ts` (the batch additions) imports no spine-core / runtime facade.
- [ ] **If (and only if) a new `.ts` renderer test file is created:** add it to `tsconfig.node.json` `exclude` (the `variant-twoway.spec.ts` precedent, tsconfig.node.json:34). Prefer `.spec.tsx` to avoid this entirely.
- Framework install: none — vitest already configured.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-scale bake + size + write | A new batch-specific export path | `handleExportVariant` body (extract to `exportOneVariant`), called per scale | SC#2-by-construction; re-implementing risks divergence from the single-scale output the oracle proved. |
| Per-variant rollback | A batch-wide `written` Set + manual partitioning | The existing per-call `const written = new Set()` (variant-export.ts:213) inside `exportOneVariant` | Each variant already gets its own atomic scope for free; a shared Set would violate D-07. |
| Scale-token normalization (renderer) | A new formatter / importing `formatScaleToken` from main | `tokenFor = (s) => String(displayFactor(s))` in variant-scale-derive.ts | Layer-3 forbids renderer→main import; the 1-liner is the sanctioned byte-identical duplication (variant-scale-derive.ts:11-15 precedent). |
| Cancel flag | A new cancel framework / threading cancel into workers | A module-level flag + a one-way `variant:cancelBatch` send (mirror `export:cancel`, ipc.ts:1092-1096) | D-09 is between-variants only; the per-worker `() => false` stays. |
| Two-way factor↔px control per row | New derive math | `pxFromScale`/`scaleFromPx`/`displayFactor` (variant-scale-derive.ts) per row | Proven in Phase 50; pure, Layer-3, already tested. |
| Parent pick + overwrite | A per-folder prompt / pre-scan | `onConfirmStartVariant` (AppShell.tsx:833-845) once for the run (D-12) | Zero new collision UX; pre-existing folders fail per-folder via D-07. |
| Faithfulness fixtures | A new committed rig dir | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.*` + `fixtures/SLIDER_4_3/SLIDER-01.*` | Already committed + denylisted; a new dir triggers the SAFE-01 landmine. |

**Key insight:** Phase 51 adds essentially no new *algorithms* — it adds an orchestration loop, an IPC channel pair, and a multi-row UI. Every piece of math/IO it needs already exists and is tested. The risk is entirely in (a) the body-extraction refactor not perturbing single-scale output (guarded by the byte-identity test) and (b) the per-variant atomic boundary holding under continue-on-error (guarded by the forced-fail test).

## Common Pitfalls

### Pitfall 1: The re-entrancy slot rejects the first inner variant
**What goes wrong:** If `handleExportVariantBatch` claims `variantExportInFlight` and then calls the unmodified `handleExportVariant` per scale, the first inner call sees the slot set and returns `'already-running'` → every variant fails.
**Why it happens:** `handleExportVariant` both claims AND checks the module-level slot (variant-export.ts:86-88, :135).
**How to avoid:** Extract the body into an un-guarded `exportOneVariant` (Q1 option A); the public `handleExportVariant` stays the guard wrapper; the batch claims once and loops `exportOneVariant`.
**Warning signs:** Every batch result is `failed` with "A variant export is already in progress."

### Pitfall 2: A renderer loop mislabels per-file progress by variant
**What goes wrong:** `export:progress` events carry no variant identity (shared/types.ts:549-564); a renderer loop correlating them by ordering across `await` boundaries shows the wrong "variant N of M" prefix.
**Why it happens:** Progress is a fire-and-forget per-file stream, decoupled from the invoke promise.
**How to avoid:** Use the main-side seam (Q1) and emit an explicit `variant:batch-progress` marker per variant.
**Warning signs:** Progress prefix jumps or lags the actual folder being written.

### Pitfall 3: A new `.ts` renderer test reddens typecheck:node
**What goes wrong:** A renderer test named `*.spec.ts` (importing renderer source) is caught by the node program's `tests/**/*.ts` glob (tsconfig.node.json:10) → TS6307, missed by the vitest-only self-check.
**Why it happens:** The node tsconfig includes `tests/**/*.ts` but not renderer source.
**How to avoid:** Name renderer tests `.spec.tsx` (outside both tsc programs), OR add the `.ts` file to `tsconfig.node.json` exclude (the `variant-twoway.spec.ts` precedent, tsconfig.node.json:34).
**Warning signs:** `npm run typecheck:node` RED on a file `npm run test` passes. ([[feedback_renderer_ts_helper_test_breaks_typecheck_node]])

### Pitfall 4: A shared batch-wide rollback Set
**What goes wrong:** If the batch threads ONE `written` Set into every variant, a failure in scale 3 sweeps scales 1+2's already-landed folders → violates D-07.
**Why it happens:** Mis-hoisting the `const written` out of the per-variant body.
**How to avoid:** Keep `const written = new Set()` inside `exportOneVariant` (Q2); the batch owns only the results array.
**Warning signs:** A late-scale failure deletes earlier successful folders (the forced-fail test, Q7, catches this).

### Pitfall 5: Stale cancel flag poisons the next batch
**What goes wrong:** A `variantBatchCancelRequested` left `true` from a cancelled run makes the next batch skip everything.
**How to avoid:** Reset the flag to `false` at the START of `handleExportVariantBatch` (Q4), not just on completion.
**Warning signs:** A fresh batch immediately reports all `skipped`.

### Pitfall 6: React index keys on the rows list
**What goes wrong:** Using array index as the `key` for rows breaks edit state when a middle row is removed (the wrong row's px-edit state carries over).
**How to avoid:** Use `row.id` (`crypto.randomUUID()`) as the key (Q6).
**Warning signs:** Removing row 2 of 3 makes row 3's typed value appear in row 2.

## Code Examples

### The per-variant rollback Set (already correct — preserve it in the extraction)
```typescript
// Source: src/main/variant-export.ts:213 (inside handleExportVariant → moves into exportOneVariant)
const written = new Set<string>();          // ← per-call; must stay INSIDE the per-variant body
// ... writeSkeletonJsonAtomic(..., written, overwrite)  (:230)
// ... runExport(plan, outDir, sendProgress, () => false, overwrite, sharpen, written)  (:235-243)
// ... runRepack(..., () => false, ..., written)  (:246-256)
// on throw: for (const p of written) await fsRm(p, { force: true })  (:286-290)
```

### The canonical token math (renderer must duplicate it, not import it)
```typescript
// Source: src/main/variant-export.ts:57-59 (the folder name's source of truth)
export function formatScaleToken(s: number): string {
  return String(Number(s.toFixed(4)));     // formatScaleToken(0.5) === '0.5'
}
// Renderer-local equivalent (Layer-3 — do NOT import the above):
// src/renderer/src/modals/variant-scale-derive.ts:40 already has displayFactor;
// add:  export const tokenFor = (s: number): string => String(displayFactor(s));
```

### The established cancel-flag precedent to mirror
```typescript
// Source: src/main/ipc.ts:1092-1096 (the non-variant export cancel — mirror this shape)
ipcMain.on('export:cancel', () => {
  exportCancelFlag = true;     // module-level flag, read between files
});
// New for batch:  ipcMain.on('variant:cancelBatch', () => { variantBatchCancelRequested = true; });
```

### The IPC channel shape to mirror for the new batch channel
```typescript
// Source: src/main/ipc.ts:1060-1091 (the single-scale variant:export channel)
ipcMain.handle('variant:export', async (evt, summary, s, parentDir, overwrite,
  sharpenEnabled, outputMode, atlasOpts, effectiveOverrides, safetyBufferPercent) =>
    handleExportVariant(evt, summary as SkeletonSummary, Number(s),
      typeof parentDir === 'string' ? parentDir : '', overwrite === true, /* …coercion ladder… */));
// New: ipcMain.handle('variant:exportBatch', …) — same coercion ladder, but `scales: number[]`
//      (coerce: Array.isArray(scales) ? scales.map(Number).filter(Number.isFinite) : []).
```

## State of the Art

| Old Approach (single-scale, Phase 49) | Current (batch, Phase 51) | When Changed | Impact |
|---------------------------------------|---------------------------|--------------|--------|
| One `scale` prop → one `exportVariant` call | `rows[]` → one `exportVariantBatch` call | Phase 51 | Multi-row UI; one run, N folders. |
| `handleExportVariant` is the public entry | `handleExportVariant` = guard wrapper; `exportOneVariant` = un-guarded body; `handleExportVariantBatch` = loop | Phase 51 | Refactor must keep single-scale output byte-identical (tested). |
| No cancel (single export, `() => false`) | Between-variants cancel via `variant:cancelBatch` flag | Phase 51 | Long batches get an escape hatch (D-09); per-worker cb unchanged. |
| Static "Exporting…" button (no progress) | "variant N of M — {token}" prefix via `variant:batch-progress` | Phase 51 | Legible long-run progress. |

**Deprecated/outdated:**
- The CONTEXT/code comments referencing "Phase 50/51 add tabs" (e.g. VariantDialog.tsx:16-17, :325) are **superseded by D-06** — single pane, NO tabs. Do not act on those stale "tab-ready" hints.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exported PNG bytes may not be byte-stable across runs (libvips), so the byte-identity SC#2 test should compare baked JSON + atlas text (deterministic) and PNG *dimensions* rather than PNG bytes. | Q7 | LOW — if PNGs ARE byte-stable, the test can additionally compare PNG bytes (strictly stronger); if they're not and the test assumed they were, it'd flake. The JSON+atlas comparison is the load-bearing proof either way. Planner should confirm PNG determinism empirically or compare dims. |
| A2 | `crypto.randomUUID()` is available in the renderer (Electron Chromium). | Q6 | LOW — `crypto.randomUUID` is in all modern Chromium/Electron. If unavailable, use a simple incrementing counter or `Date.now()+index` for row ids. |
| A3 | The body-extraction refactor (Q1 option A) leaves `handleExportVariant`'s external behavior byte-identical, so all existing Phase-49 variant tests stay green. | Q1 | LOW — it's a pure cut/paste of lines 90-295 into a function with the same params; the guard wrapper preserves the slot semantics. The existing Phase-49 suite (variant-scale-guard, variant-package-layout, variant-dropin-faithful, variant-source-immutable) is the regression net. |
| A4 | A `.ts` test under `tests/main/` is fine (not subject to the renderer `.spec.tsx` rule) because it imports only main/core, which ARE in the node tsconfig program. | Q7/Q8 | LOW — confirmed by every existing `tests/main/*.spec.ts` (e.g. variant-package-layout.spec.ts). The rule is specific to renderer-source imports. |

## Open Questions

1. **PNG byte-determinism for the SC#2 byte-identity test.**
   - What we know: the baked JSON and the `.atlas` text are deterministic (pure functions of the summary + scale + opts). The byte-identity-vs-single-call proof is airtight for those.
   - What's unclear: whether `sharp`/libvips produces byte-identical PNGs run-to-run for the same input. If not, the PNG arm of the byte-identity test must compare dimensions + the atlas region table instead of raw bytes.
   - Recommendation: planner has the test compare JSON + atlas bytes (always) and PNG dimensions; optionally add a PNG-byte compare guarded by an empirical check. The JSON+atlas identity is sufficient for SC#2 (textures follow from the identical plan).

2. **Whether to also surface the per-file progress bar in the batch dialog.**
   - What we know: single-scale shipped with no file bar; OptimizeDialog has one. The variant-level "N of M" prefix is the clear win.
   - What's unclear: whether the user wants a per-file bar within each variant.
   - Recommendation: ship the variant-level prefix (required for legibility); add the per-file bar only if cheap (Claude's discretion per CONTEXT). Reset it per variant if included.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | All automated tests | ✓ | configured (vitest.config.ts) | — |
| sharp / libvips | Per-variant texture resize (via `runExport`/`runRepack`) | ✓ (already used by Phase 49) | per project | — |
| Electron native folder picker | The one parent-folder pick (D-12) | ✓ (already used by `onConfirmStartVariant`) | — | — (HUMAN-UAT for visual confirmation) |
| Both spine-core specifiers (`spine-core-42` + `@esotericsoftware/spine-core`) | The dual-runtime test harness (co-import) | ✓ (used by variant-dropin-faithful.spec.ts:45-46) | 4.2.111 alias + 4.3.0 | — |

**No new external dependencies.** Phase 51 is orchestration + UI + tests over an existing, fully-provisioned stack.

## Security Domain

> `security_enforcement` not set to `false` → included. Scope is narrow: this is a desktop app writing to a user-chosen folder; the relevant surface is the IPC trust boundary and path safety, both already hardened in Phase 49.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V5 Input Validation | yes | The new `variant:exportBatch` channel MUST re-validate at the trust boundary (ipc.ts:30-32 doctrine): coerce `scales` to a finite-number array, coerce/clamp `safetyBufferPercent` (the existing single-scale clamp at variant-export.ts:112-114 runs per `exportOneVariant` call — preserved), and reject non-string `parentDir`. Mirror the existing `variant:export` coercion ladder (ipc.ts:1073-1090). |
| V12 File/Resource (path safety) | yes | `exportOneVariant` already derives `{NAME}` via `basename(...)` to strip `../` traversal (variant-export.ts:119-125) and runs the source-collision guard (variant-export.ts:191-208). Batch inherits both per variant — no new path-safety code, but the batch MUST NOT bypass them (it calls the same body). |
| V6 Cryptography | no | No crypto beyond `crypto.randomUUID()` for React keys (non-security use). |
| V2/V3/V4 Auth/Session/Access | no | Single-user desktop app; no auth surface. |

### Known Threat Patterns for {Electron IPC + filesystem write}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/garbage `scales[]` from a compromised renderer | Tampering | Coerce to finite numbers, drop non-finite; each survives the per-variant D-08 guard (s ≥ 1 / NaN → `VariantScaleError`, recorded as a failed result, not a crash). |
| Path traversal via crafted skeleton name → write outside parent | Tampering / Elevation | `basename()` strip + `:`-reject (variant-export.ts:119-125), inherited per variant. |
| Output dir IS the source images dir → overwrite sources | Tampering | The source-collision guard (variant-export.ts:191-208), inherited per variant; with overwrite off, a pre-existing folder fails per-folder (D-12). |
| Unbounded `safetyBufferPercent` | Tampering | Clamp to [0,25] at the trust boundary (variant-export.ts:112-114), runs per variant. |

**No new attack surface beyond the new IPC channel's input validation** — and that's a direct mirror of the already-hardened `variant:export` channel.

## Sources

### Primary (HIGH confidence) — live codebase, read in full this session
- `src/main/variant-export.ts` (1-301) — `handleExportVariant`, `formatScaleToken` (:57), `variantExportInFlight` (:67), the per-call `written` Set (:213), the `() => false` worker cbs (:239,250).
- `src/renderer/src/modals/VariantDialog.tsx` (1-753) — single-scale dialog: props (:50-100), `onStart` (:147-254), `scaleInvalid` (:127-128), `scaleToken`/`folderHint` (:293-294), two-way control (:340-478), complete-state summary (:662-696), in-progress button (:719-727).
- `src/renderer/src/modals/variant-scale-derive.ts` (1-40) — `pxFromScale`/`scaleFromPx`/`displayFactor` + the Layer-3 inline-duplication doctrine.
- `src/main/ipc.ts` (1040-1096) — `variant:export` channel (:1060-1091), `export:cancel` precedent (:1092-1096).
- `src/preload/index.ts` (110-207) — `exportVariant` binding (:127-149), `onExportProgress` (:193-199).
- `src/renderer/src/components/AppShell.tsx` (395-413, 540-565, 810-845, 2220-2250, 2581-2607) — `activeOverrides` (:410-413), `variantDialogState`/`variantScale` (:557-564), `onClickExportVariant` (:814-820), `onConfirmStartVariant` (:833-845), toolbar button (:2234-2241), VariantDialog mount (:2581-2607).
- `src/shared/types.ts` (505-564, 572-608, 756-812) — `ExportError`, `ExportProgressEvent`, `ExportSummary`, `ExportResponse`, `SkeletonSummary` (incl. `bbox` :812).
- `src/main/image-worker.ts` (89+) / `src/main/repack-worker.ts` (257+) — `runExport`/`runRepack` signatures (`isCancelled` 4th param, `writtenPaths` last).
- `tests/main/variant-dropin-faithful.spec.ts` (1-321) — the drop-in faithfulness oracle (CONFIRMED path/name) + dual-runtime co-import harness.
- `tests/main/variant-package-layout.spec.ts` (1-384) — dual-runtime × dual-mode MATRIX + `buildCellSummary` + oversize-rollback (`maxPageSize:64`).
- `tests/main/variant-scale-guard.spec.ts` (1-103) — the D-08 guard test pattern + headless summary build.
- `tests/renderer/variant-dialog.spec.tsx` (1-90) — renderer harness (window.api stub + ComponentProps builder).
- `tests/safe01/discover-fixtures.ts` (1-179) — `SAFE01_EXCLUDED_PREFIXES` (existing fixtures already covered :121).
- `tests/arch.spec.ts` (1-50+) — Layer-3 boundary gates.
- `tsconfig.node.json` — the `tests/**/*.ts` glob + the `variant-twoway.spec.ts` exclude precedent (:34).
- `.planning/config.json` — `nyquist_validation: true`.
- `.planning/phases/51-batch-variant-export/51-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `./CLAUDE.md`.

### Secondary / Tertiary
- None — every claim is grounded in the live codebase or the planning docs above. No web research needed (brownfield extension of a fully-read codebase).

## Metadata

**Confidence breakdown:**
- Orchestration seam (Q1): HIGH — both options traced through real code; the re-entrancy-slot interaction and progress-correlation are concrete code facts.
- Per-variant rollback (Q2): HIGH — the per-call `written` Set is a `const` local at variant-export.ts:213; behavior is unambiguous.
- Dedup (Q3): HIGH — `formatScaleToken` + the renderer-local `displayFactor` are both read; the Layer-3 doctrine is explicit in-code.
- Cancel (Q4): HIGH — the `export:cancel` precedent is exact; D-09 is explicit.
- Results/progress (Q5): HIGH — existing summary block + progress channel read; the variant dialog's lack of a progress subscription is confirmed.
- Scale-list model (Q6): HIGH — the single-scale state + props are read; the generalization is mechanical.
- SC#2 tests (Q7): HIGH — the oracle + matrix + fixtures are read; no new fixture needed (denylist pre-empted).
- Validation (Q8): HIGH — framework + tsconfig globs + the typecheck:node landmine all confirmed in-code.

**Research date:** 2026-05-23
**Valid until:** ~30 days (stable brownfield codebase; no fast-moving external deps). Re-verify only if `variant-export.ts`, the IPC layer, or the fixtures change before planning.
