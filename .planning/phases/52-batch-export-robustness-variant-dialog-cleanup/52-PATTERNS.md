# Phase 52: Batch Export Robustness + Variant-Dialog Cleanup - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 5 source files modified + 2 test files extended + 1 new test file
**Analogs found:** 8 / 8 (every work item has an in-repo established pattern to replicate)

> **Phase shape:** Pure hardening + dead-code-removal + test-addition. NO new source
> files. Every change edits an EXISTING file or mirrors an EXISTING test. So each
> entry below pins the **exact current code the executor must read first** (with
> verified, drift-corrected line numbers) and the **established pattern it must
> replicate or respect**.

---

## ⚠️ Line-Number Drift Report (CONTEXT.md → actual source)

CONTEXT.md's anchors predate the `1c68cb8` WR-01/WR-05/IN-02 landings, which
inserted code into `variant-export.ts` and `VariantDialog.tsx`. **Use the ACTUAL
columns below, not CONTEXT's.**

| Symbol | CONTEXT.md ref | ACTUAL current location | Drift |
|--------|----------------|-------------------------|-------|
| `formatScaleToken` | `variant-export.ts:58` | `variant-export.ts:58-60` | none ✓ |
| `safeBuffer` clamp (WR-06) | `variant-export.ts:135-137` | `variant-export.ts:135-137` | none ✓ |
| `exportOneVariant` rollback catch | `variant-export.ts:304-309` | `variant-export.ts:304-316` | none ✓ (sweep loop is :307-311) |
| `handleExportVariantBatch` dedup gate | `variant-export.ts:414-428` | `variant-export.ts:414-428` | none ✓ |
| continue-on-error loop | `variant-export.ts:444-465` | `variant-export.ts:444-487` | loop body longer than cited |
| `pushResult` | `variant-export.ts:405` | `variant-export.ts:405-412` | none ✓ |
| dup `reason` copy | `variant-export.ts:424` | `variant-export.ts:424` | none ✓ |
| `variant:export` handler | `ipc.ts:1065` | `ipc.ts:1065-1096` | none ✓ |
| `variant:export` `safetyBufferPercent` coerce | `ipc.ts:1094` | `ipc.ts:1094` | none ✓ |
| `variant:exportBatch` handler | `ipc.ts:1103` | `ipc.ts:1103-1134` | none ✓ |
| `variant:exportBatch` `safetyBufferPercent` coerce | `ipc.ts:1132` | `ipc.ts:1132` | none ✓ |
| `validateExportOpts` | `ipc.ts:361` | `ipc.ts:361-396` | none ✓ |
| `plan` prop in `VariantDialogProps` | `VariantDialog.tsx:72-75` | `VariantDialog.tsx:71-75` | doc comment starts :71 |
| `isRowInvalid`/`hasDuplicate`/`startDisabled` | `VariantDialog.tsx:225-249` | `VariantDialog.tsx:225-249` | none ✓ |
| `onStart` | `VariantDialog.tsx:281-349` | `VariantDialog.tsx:281-349` | none ✓ (deps `[props, startDisabled]` at :349, NOT :298) |
| `tokenFor`/`displayFactor` | `variant-scale-derive.ts:40,49` | `variant-scale-derive.ts:40,49` | none ✓ |
| Layer-3 invariant note | `variant-scale-derive.ts:11` | `variant-scale-derive.ts:10-15` | none ✓ |
| `onClickExportVariant` | `AppShell.tsx:822` | `AppShell.tsx:822-828` | none ✓ |
| `<VariantDialog>` usage | `AppShell.tsx:2622-2631` | `AppShell.tsx:2621-2645` | `plan={...}` is at :2624 ✓ |
| `variantDialogState` type | (D-06c) | `AppShell.tsx:557-560` | — |
| `skeleton-json-writer` mkdir | `skeleton-json-writer.ts:42-46` | `skeleton-json-writer.ts:43-44` | `mkdir` is at :44 |
| orphan tolerance (`if existsSync(folder)`) | `variant-batch-faithful.spec.ts:278` | `variant-batch-faithful.spec.ts:278-283` | none ✓ |
| existing `tokenFor` test | `variant-twoway.spec.ts:68-73` | `variant-twoway.spec.ts:68-73` | none ✓ |

**Note (IN-04 / D-07):** the 51-REVIEW cited the `onStart` deps array at
`VariantDialog.tsx:298`; in the current source the deps `[props, startDisabled]`
are at **`:349`** (the close of the `useCallback` body, :281-349). Use :349.

---

## File Classification

| File under change | Role | Data Flow | Closest Analog / Established Pattern | Match Quality |
|-------------------|------|-----------|--------------------------------------|---------------|
| `src/main/variant-export.ts` (D-01 dup-skip) | service (orchestrator) | batch / continue-on-error | D-07 continue-on-error loop in the SAME function (`:444-487`) | exact (self) |
| `src/main/variant-export.ts` (D-03 dir cleanup) | service (orchestrator) | rollback / file-I/O | per-variant `written` force-rm sweep in the SAME catch (`:307-311`) | exact (self) |
| `src/main/ipc.ts` (D-04 coercion) | IPC boundary handler | request-response | the variant channels' existing coercion ladder + `validateExportOpts` (the precedent D-04 does NOT adopt) | exact (self) |
| `src/renderer/src/modals/VariantDialog.tsx` (D-06a, D-07) | component (modal) | event-driven (form) | sibling `onCloseSafely`/`onOpenOutputFolder` `useCallback`s (D-07) | role-match |
| `src/renderer/src/components/AppShell.tsx` (D-06b/c) | component (shell) | event-driven (state) | `onClickOptimize` (`:805-814`) — the master-plan-builder sibling | exact (sibling) |
| `tests/main/variant-batch-faithful.spec.ts` (D-08a) | test (node) | rollback assertion | the orphan tolerance to TIGHTEN at `:278-283` | exact (self) |
| `tests/main/variant-batch-faithful.spec.ts` (D-08b) | test (node) | continue-on-error assertion | the Block-2 continue-on-error test (`:227-285`) | exact (self) |
| `tests/main/<new>.spec.ts` (D-05/D-08c) | **NEW** test (node) | pure equivalence | `variant-scale-guard.spec.ts` (regression-per-fix) + `variant-twoway.spec.ts:68-73` (the `tokenFor` companion) | role-match |

---

## Pattern Assignments

### D-01 — WR-02 duplicate-token continue-on-error (`variant-export.ts`, SC#1)

**Change type:** edit-in-place (replace the whole-batch abort with per-row skip)
**Site to REPLACE:** `handleExportVariantBatch` dedup gate, **`variant-export.ts:414-428`**
**Analog to REPLICATE:** the D-07 continue-on-error loop in the SAME function, **`:444-487`** — same `pushResult` + `continue`/no-break contract.

**Current code to REPLACE (`:414-428`) — the whole-batch abort:**
```typescript
  // Defense-in-depth (RESEARCH §Q3): reject the whole batch if two scales collide
  // on the SAME normalized token (the renderer also blocks this pre-flight, D-10).
  const seen = new Map<string, number>();
  for (const s of scales) seen.set(formatScaleToken(s), (seen.get(formatScaleToken(s)) ?? 0) + 1);
  const collision = [...seen.entries()].find(([, n]) => n > 1);
  if (collision) {
    for (const s of scales) {
      pushResult({
        token: formatScaleToken(s),
        status: 'failed',
        reason: `Duplicate scale token @${collision[0]}x — two rows produce the same folder.`,
      });
    }
    return { ok: true, results };
  }
```

**Pattern the replacement must follow (build `dupTokens` set, then skip+continue inside the loop):**
- Build `const dupTokens = new Set([...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t));` (CONTEXT D-01 verbatim).
- Inside the existing loop (`:444`), AFTER the `variantBatchCancelRequested` check (`:445-451`) and BEFORE the `exportOneVariant` call (`:463`), add: when `dupTokens.has(formatScaleToken(scales[i]))`, `pushResult({ token, status: 'failed', reason: <dup copy> })` then `continue` — never calling `exportOneVariant`.
- **Reason copy MUST match the existing message** at `:424` verbatim (D-01 + CONTEXT specifics): `` `Duplicate scale token @${token}x — two rows produce the same folder.` `` (note: now per-row `token`, not `collision[0]`).
- **PRESERVE unchanged:** the `variantExportInFlight` re-entrancy guard (`:430-439`), the `variantBatchCancelRequested = false` reset (`:441`), the between-variants cancel check (`:445-451`), and the per-iteration `variant:batch-progress` emit (`:453-461`). **Fail ALL rows sharing a dup token** (the set already captures every colliding token).

**The `pushResult` contract this slots into (`:405-412`) — the LIVE-red mechanism:**
```typescript
  const pushResult = (r: BatchVariantResult) => {
    results.push(r);
    try {
      evt.sender.send('variant:result', r);   // ← renderer colors the row red LIVE
    } catch {
      /* sender gone */
    }
  };
```

**The continue-on-error loop tail it parallels (`:476-486`):**
```typescript
      if (res.ok) {
        pushResult({ token, status: res.summary.errors.length > 0 ? 'exported-with-errors' : 'exported', ... });
      } else {
        pushResult({ token, status: 'failed', reason: res.error.message });
      }
      // LOOP CONTINUES regardless of res.ok (D-07 continue-on-error) — no break, no rethrow.
```

**D-02 (renderer gate UNCHANGED):** Do NOT touch `VariantDialog.tsx` `startDisabled`
(`:249`) or the duplicate hint (`:663`). The renderer dup gate stays; D-01 is
defense-in-depth for a relaxed/compromised renderer.

---

### D-03 — WR-03 no orphan empty variant directory (`variant-export.ts`, SC#2)

**Change type:** edit-in-place (extend the rollback catch)
**Site to EDIT:** `exportOneVariant` rollback catch, **`variant-export.ts:304-316`** (the file sweep is `:307-311`)
**Analog to REPLICATE:** the existing per-variant `written` force-rm sweep in the SAME catch (T-49-ROLLBACK) — extend it to the now-empty `outDir`.
**Root cause to RESPECT:** `skeleton-json-writer.ts:44` `await mkdir(dirname(finalPath), { recursive: true })` creates `{NAME}@{s}x/` but the dir path is never added to `written`.

**Current rollback catch to EXTEND (`:304-316`):**
```typescript
    } catch (innerErr) {
      // Rollback sweep — covers the baked JSON too (T-49-ROLLBACK). force-rm
      // swallows ENOENT, so sweeping half-landed paths is safe.
      for (const p of written) {
        await fsRm(p, { force: true }).catch(() => {
          /* defense-in-depth */
        });
      }
      return {
        ok: false,
        error: { kind: 'Unknown', message: innerErr instanceof Error ? innerErr.message : String(innerErr) },
      };
    }
```

**Pattern to add AFTER the `for (const p of written)` sweep, BEFORE the `return`:**
```typescript
      // WR-03 — remove the freshly-created variant dir ONLY if it is empty after
      // the file sweep. The only-if-empty guard preserves a pre-existing non-empty
      // folder (overwrite=true re-export) — never nuke user content.
      try { if ((await readdir(outDir)).length === 0) await fsRm(outDir, { recursive: true, force: true }); } catch {}
```
- **`readdir` must be added to the `node:fs/promises` import** at `variant-export.ts:27` (currently `{ rm as fsRm, readFile, access as fsAccess }`).
- The only-if-empty guard is mandatory (D-03): preserves the overwrite=true non-empty case.
- The happy path returns at `:303` and never reaches this catch → unchanged.
- **Claude's Discretion (D-03):** readdir-vs-stat empty check — readdir-length-0 is the form already used by the `probeVariantBatchConflicts` cousin and the orphan-probe test (`variant-scale-guard.spec.ts:140-149`); prefer it for consistency.

---

### D-04 — WR-04 variant-channel coerce-and-clamp (`ipc.ts`, SC#3)

**Change type:** edit-in-place (drop `|| 0` at both handlers + add a documenting comment)
**Sites to EDIT:** `ipc.ts:1094` (single `variant:export`) and `ipc.ts:1132` (batch `variant:exportBatch`)
**Canonical clamp it relies on:** `exportOneVariant` `safeBuffer`, **`variant-export.ts:135-137`** (the single authority).
**Precedent it deliberately does NOT adopt:** `validateExportOpts` (`ipc.ts:361-396`) — validate-and-reject.

**The canonical clamp (already in place — the reason `|| 0` is redundant) at `variant-export.ts:135-137`:**
```typescript
  const safeBuffer = Number.isFinite(safetyBufferPercent)
    ? Math.max(0, Math.min(25, Math.trunc(safetyBufferPercent)))
    : 0;
```

**Current boundary coercion to CHANGE — `ipc.ts:1094` (single) and `:1132` (batch), IDENTICAL line:**
```typescript
        Number(safetyBufferPercent) || 0,
```
→ change BOTH to:
```typescript
        Number(safetyBufferPercent),    // variant channels coerce-and-clamp (single canonical clamp in exportOneVariant step 2b) …
```
- Pass `Number(safetyBufferPercent)` (the body's `Number.isFinite` guard coerces NaN→0).
- **Both handlers must change IDENTICALLY** (keep single + batch byte-parallel — the rest of the coercion ladder at `:1081-1093` / `:1119-1131` is already mirrored).
- **Add the documenting comment at BOTH handlers** (D-04 verbatim): *"variant channels coerce-and-clamp (single canonical clamp in exportOneVariant step 2b); intentionally distinct from export:start's validate-and-reject (validateExportOpts) because the renderer pre-clamps and the body is the single authority."*
- **Do NOT** convert the variant channels to validate-and-reject (would be a behavior change + dead ceremony; violates D-09 no-happy-path-change).

**The validate-and-reject precedent NOT to extend (`ipc.ts:361-396`):**
```typescript
function validateExportOpts(outputMode: unknown, atlasOpts: unknown): string | null {
  if (outputMode !== 'loose' && outputMode !== 'atlas' && outputMode !== 'both') {
    return "outputMode is not 'loose' | 'atlas' | 'both'";
  }
  // … returns a string error message; handleStartExport short-circuits on non-null
}
```

---

### D-05 — IN-01 cross-boundary `tokenFor` ≡ `formatScaleToken` test (NEW `tests/main/*.spec.ts`, SC#4)

**Change type:** new-test (a brand-new `.spec.ts` in `tests/main/`)
**MUST be placed in `tests/main/`** (node env), importing BOTH:
- main `formatScaleToken` from `src/main/variant-export.js` (`:58-60`)
- the renderer-local **pure** `tokenFor` + `displayFactor` from `src/renderer/src/modals/variant-scale-derive.ts` (`:40,49`)

**🚨 LANDMINE — the renderer-`.ts`-helper / TS6307 trap (verified against `tsconfig.node.json`):**
- The node program (`tsconfig.node.json`) includes `tests/**/*.ts` (`:12`) and
  `src/renderer/src/lib/**/*.ts` (`:10`) but **NOT** `src/renderer/src/modals/**`.
- `variant-twoway.spec.ts` (a `tests/renderer/*.ts`) is **explicitly excluded** at
  `tsconfig.node.json:35` precisely because it imports the modals helper.
- **Why the new `tests/main/*.spec.ts` is SAFE anyway:** `variant-scale-derive.ts`
  has **zero imports** (verified — pure `Number`/`Math`/`String`, ES2022-clean, no
  React/DOM). When the in-program test imports it, the file is pulled into the node
  program via the import edge and **typechecks cleanly** under `lib: ES2022, types: node`.
- **DO NOT** author this as a `tests/renderer/*.ts` file (it would hit the
  `tests/**/*.ts` glob → TS6307 and need a `tsconfig.node.json` exclude, the exact
  documented landmine). A `tests/main/*.spec.ts` importing the pure module needs NO
  exclude.

**Patterns to MIRROR:**
- File header + node-fixture-free structure: `variant-scale-guard.spec.ts` (regression-per-fix culture).
- The existing single-source `tokenFor` test it COMPLEMENTS — `variant-twoway.spec.ts:68-73`:
```typescript
  it('tokenFor normalizes IEEE-754 drift to the canonical @{s}x token (D-10)', () => {
    expect(tokenFor(0.5)).toBe('0.5');
    expect(tokenFor(0.50001)).toBe('0.5');
    expect(tokenFor(0.5)).toBe(tokenFor(0.50001));
    expect(tokenFor(0.36)).toBe('0.36');
```
- New assertion shape: `expect(tokenFor(x)).toBe(formatScaleToken(x))` over a shared
  sample array. **Sample array MUST include** (CONTEXT D-05): IEEE-754 step artifacts
  (`0.30000000000000004`), near-collision pairs, and the canonical contract anchor
  `0.5 → '0.5'`. (Exact sample array is Claude's Discretion, D-05.)

---

### D-06 — IN-03 remove the dead `plan` prop (`VariantDialog.tsx` + `AppShell.tsx`, SC#4)

**Change type:** dead-code-removal (3 sub-edits across 2 files)
**Confirmed precondition (D-06a):** `props.plan` has **NO consumer** in the dialog body
— `grep` shows `plan` only at the prop declaration (`VariantDialog.tsx:71-75`); no
`props.plan` read anywhere. Safe to delete.

**(a) Delete `plan` from `VariantDialogProps` — `VariantDialog.tsx:71-75`:**
```typescript
  /**
   * Display-only plan for the summary tiles (master-sized; the actual
   * s-scaling happens MAIN-side per Plan-01 from `summary` + each `scale`).
   */
  plan: ExportPlan;
```
- After deleting, check whether the `ExportPlan` import at `VariantDialog.tsx:50`
  becomes unused → if so, drop it from the `import type { … } from '…/shared/types.js'`
  block (`:48-52`). (`BatchVariantResult` + `SkeletonSummary` stay.)

**(b) AppShell `onClickExportVariant` — drop the dead `buildExportPlan` call — `AppShell.tsx:822-828`:**
```typescript
  const onClickExportVariant = useCallback(() => {
    const plan = buildExportPlan(summary, activeOverrides, {
      skeletonPath: summary.skeletonPath,
      safetyBufferPercent: safetyBufferPercentLocal,
    });
    setVariantDialogState({ plan, outDir: lastOutDir });
  }, [summary, activeOverrides, lastOutDir, safetyBufferPercentLocal]);
```
→ becomes:
```typescript
  const onClickExportVariant = useCallback(() => {
    setVariantDialogState({ outDir: lastOutDir });
  }, [lastOutDir]);
```
- Drop `summary`, `activeOverrides`, `safetyBufferPercentLocal` from the deps (no
  longer read here).
- **KEEP the `buildExportPlan` import** (`AppShell.tsx:74`) — still used at
  `:809, :1031, :1168, :1302` (verified).
- **KEEP the `ExportPlan` import** in AppShell (`:48`) — still used by the
  `exportDialogState` type at `:548`. (Only the VariantDialog-side `ExportPlan`
  import may become removable.)

**(c) Drop `plan` from `variantDialogState` type AND the `<VariantDialog>` site:**
- Type — `AppShell.tsx:557-560`:
```typescript
  const [variantDialogState, setVariantDialogState] = useState<{
    plan: ExportPlan;       // ← DELETE this line
    outDir: string | null;
  } | null>(null);
```
- Usage — `AppShell.tsx:2624`: delete the `plan={variantDialogState.plan}` prop line
  from the `<VariantDialog … />` block (`:2621-2645`).

**No behavior change** (dead computation + dead prop removed; D-06 + D-09).

---

### D-07 — IN-04 fix `onStart` misleading memoization (`VariantDialog.tsx`, SC#4)

**Change type:** edit-in-place (drop the `useCallback` wrapper OR honest deps)
**Site:** `onStart`, **`VariantDialog.tsx:281-349`** — deps `[props, startDisabled]` at **`:349`** (NOT :298 as 51-REVIEW cited).

**Current (misleading) wrapper — `:281` open, `:349` close:**
```typescript
  const onStart = useCallback(async () => {
    if (startDisabled) return;
    // … reads ~9 props (props.outDir, props.onConfirmStart, props.summary,
    //   props.rows, props.sharpenOnExport, props.outputMode, props.atlasOpts,
    //   props.effectiveOverrides, props.safetyBufferPercent) …
    setState('complete');
  }, [props, startDisabled]);   // ← `props` is a fresh object each render → no memoization
```

**Preferred form (CONTEXT D-07 + matches the readable diff):** drop `useCallback`,
use a plain async function, one-line comment that it intentionally closes over the
latest props:
```typescript
  // Plain function (not useCallback): onStart reads ~9 props, so an honest deps
  // list ≡ "all props" → memoization buys nothing. Intentionally closes over the
  // latest props on each render (the handler must read the current set).
  const onStart = async () => { … };
```
- **Acceptable alternative (D-07):** keep `useCallback` and depend on the SPECIFIC
  values actually read (`props.onConfirmStart, props.outDir, props.summary,
  props.rows, props.sharpenOnExport, props.outputMode, props.atlasOpts,
  props.effectiveOverrides, props.safetyBufferPercent, startDisabled`). Executor
  picks the cleaner diff (Claude's Discretion).
- **No behavior change** — the handler already reads latest props on every call.
- **Sibling pattern for reference:** the other handlers in this file ARE legitimately
  `useCallback`'d with honest deps — `onCloseSafely` (`:351`), `onOpenOutputFolder`
  (`:357`). `onStart` is the only one with the `[props, …]` smell.

---

### D-08a — TIGHTEN the orphan tolerance (`variant-batch-faithful.spec.ts`, WR-03 lock)

**Change type:** new-test edit (tighten an existing tolerant assertion to a hard assert)
**Site:** **`variant-batch-faithful.spec.ts:278-283`** (the `if (fs.existsSync(folder))` tolerance the 51-REVIEW flagged).

**Current TOLERANT code to TIGHTEN (`:272-284`):**
```typescript
    for (const s of SCALES) {
      const folder = path.join(tmp, `${NAME}@${formatScaleToken(s)}x`);
      expect(
        fs.existsSync(path.join(folder, `${NAME}.json`)),
        `orphan {NAME}.json survived rollback for @${formatScaleToken(s)}x`,
      ).toBe(false);
      if (fs.existsSync(folder)) {              // ← TOLERANCE to remove (D-08a)
        const remaining = fs
          .readdirSync(folder)
          .filter((n) => n.endsWith('.atlas') || n.endsWith('.png') || n.endsWith('.json'));
        expect(remaining, `partial artifacts survived rollback in @${formatScaleToken(s)}x`).toEqual([]);
      }
    }
```

**Pattern to apply (D-08a):** replace the `if (fs.existsSync(folder))` tolerance with
a HARD assertion that the failed variant's folder is GONE — e.g.
`expect(fs.existsSync(folder), \`orphan empty dir survived rollback for @…x\`).toBe(false);`
This is the WR-03 lock: the D-03 readdir-empty cleanup now guarantees no orphan dir.
- This test (Block 2, continue-on-error, `:227-285`) ALREADY forces every variant to
  fail via `maxPageSize: 64` → exercises the D-03 catch on every iteration. No new
  fixture needed.

**D-08c (Claude's Discretion):** whether D-08a lands here or in a new dedicated spec.
Recommend extending this existing Block-2 test (it already forces the failure).

---

### D-08b — WR-02 partial-failure regression (`variant-batch-faithful.spec.ts`)

**Change type:** new-test (add an `it(...)` to the continue-on-error describe block)
**Analog to MIRROR:** the Block-2 continue-on-error test (`:245-285`) — same
`handleExportVariantBatch` call shape + per-result status assertions.

**Pattern (D-08b + D-01):** a batch where TWO scales collide on one token → those
rows `failed`, all non-colliding scales `exported`. The collision must be REAL post-
dedup-fix: pick two distinct scales that round to the same 4dp token (e.g. `0.5` and
`0.50001` both → `'0.5'`), plus a third non-colliding valid scale (e.g. `0.36`).
Assert:
- `batch.results` has a `failed` status for BOTH colliding rows with the dup reason copy.
- the non-colliding scale is `exported` and its `{NAME}.json` folder exists.
- the colliding token's folder was NEVER created (skipped before `exportOneVariant`).

**Result-status assertion idiom to copy from the existing valid-batch test (`:300-308`):**
```typescript
    for (const s of SCALES) {
      const idx = batch.results.findIndex((r) => r.token === formatScaleToken(s));
      expect(batch.results[idx].status, `@${formatScaleToken(s)}x should be exported`).toBe('exported');
      expect(fs.existsSync(path.join(tmp, `${NAME}@${formatScaleToken(s)}x`, `${NAME}.json`)), …).toBe(true);
    }
```
- **No new committed fixture** — reuse `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`
  (already loaded by `simpleSummary()` at `:232-236`).

---

## Shared Patterns

### Continue-on-error (D-07 parity)
**Source:** `variant-export.ts:444-487` (the `handleExportVariantBatch` loop) + `pushResult` (`:405-412`)
**Apply to:** D-01 (the dup-skip slots into the SAME loop with the SAME `pushResult` + `continue` contract — never `break`, never rethrow).
```typescript
// per row: pushResult({ token, status: 'failed', reason }) then `continue` — the
// loop carries on; the renderer colors that row red LIVE via the variant:result emit.
```

### Per-variant rollback via a fresh `written` Set + force-rm sweep (T-49-ROLLBACK)
**Source:** `variant-export.ts:234` (`const written = new Set()`) + the catch sweep (`:307-311`)
**Apply to:** D-03 (extend the sweep to the freshly-`mkdir`'d, now-empty `outDir`; only-if-empty so a pre-existing non-empty folder is preserved).

### Trust-boundary coercion: variant = coerce-and-clamp (NOT validate-and-reject)
**Source (canonical clamp):** `variant-export.ts:135-137` (`safeBuffer`)
**Source (the precedent NOT to adopt):** `ipc.ts:361-396` (`validateExportOpts`)
**Apply to:** D-04 (both variant handlers `ipc.ts:1094` + `:1132` pass `Number(...)`,
documenting the deliberate divergence in a comment at both sites; the body is the single authority).

### Layer-3 renderer-local token mirror (locked by a test, NOT merged)
**Source:** `variant-scale-derive.ts:42-49` (`tokenFor` ≡ main `formatScaleToken`) + the Layer-3 note (`:10-15`)
**Apply to:** D-05 (a cross-boundary equivalence test asserting the mirror, in
`tests/main/` so the node program typechecks the pure module without a tsconfig exclude).
**Guardrail:** `tests/arch.spec.ts:20` — renderer must NOT import `core/`. Do NOT
"fix" the duplication by merging into `shared/` (CONTEXT Deferred — ROADMAP SC#4 chose the test route).

### Regression-test-per-fix culture
**Source:** `variant-scale-guard.spec.ts` (Phase 51 added it for WR-01)
**Apply to:** D-08 (every Phase-52 behavior change ships its lock: D-08a tightens the
orphan tolerance, D-08b adds the dup partial-failure regression, D-05 adds the
equivalence test).

---

## No Analog Found

None. Every Phase-52 work item maps to an established in-repo pattern (continue-on-
error loop, rollback sweep, coercion ladder, Layer-3 mirror, regression-per-fix). No
file lacks a precedent; the planner does NOT need to fall back to RESEARCH.md patterns.

---

## Layer-3 / Landmine Checklist for the Planner

1. **D-05 placement:** new test goes in `tests/main/*.spec.ts` (node env), imports the
   PURE `variant-scale-derive.ts` (zero imports, ES2022-clean) → typechecks under the
   node program with NO `tsconfig.node.json` exclude. **NEVER** author it as
   `tests/renderer/*.ts` (TS6307 / `tests/**/*.ts`-glob landmine — see
   `tsconfig.node.json:28-35` for the precedent exclude).
2. **D-03 import:** add `readdir` to the `node:fs/promises` import at `variant-export.ts:27`.
3. **D-06 imports:** after removing `plan`, drop the now-unused `ExportPlan` import in
   `VariantDialog.tsx:50`; KEEP `buildExportPlan` + `ExportPlan` in `AppShell.tsx`
   (both still used elsewhere).
4. **No new committed fixtures** expected (D-08 reuses `SIMPLE_TEST`). IF one is added,
   co-extend `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts`
   (the SAFE-01 denylist landmine).
5. **Happy-path invariant (D-09):** the 12/12 faithfulness matrix in
   `variant-batch-faithful.spec.ts` Block 1 (`:127-221`) MUST stay green — only
   error/edge/rollback/coercion/dead-code/test lines change.

## Metadata

**Analog search scope:** `src/main/`, `src/renderer/src/{modals,components,lib}/`, `tests/main/`, `tests/renderer/`, `tsconfig.*.json`
**Files scanned (read in full or targeted):** variant-export.ts (full), ipc.ts (§361-396, §1058-1147), variant-scale-derive.ts (full), VariantDialog.tsx (§38-167, §222-351), AppShell.tsx (§555-560, §805-839, §2621-2645), skeleton-json-writer.ts (grep), variant-batch-faithful.spec.ts (full), variant-scale-guard.spec.ts (full), variant-twoway.spec.ts (§1-30, §58-73), tsconfig.node.json (full), tsconfig.web.json (grep), arch.spec.ts (grep)
**Pattern extraction date:** 2026-05-24
