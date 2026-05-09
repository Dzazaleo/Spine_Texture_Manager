# Phase 30: Safety buffer in Optimize dialog — Research

**Researched:** 2026-05-08
**Domain:** Renderer-side multiplicative buffer threaded into pure-TS export-plan math + `.stmproj` additive-optional persistence (mirrors Phase 28)
**Confidence:** HIGH — every cited line was re-read live; canonical_refs are accurate; Phase 28 plumbing precedent is one-to-one for everything except image-worker (which Phase 30 does not touch).

## Summary

Phase 30 adds a single integer-percent input to OptimizeDialog (range 0–25, step 1, default 0) that multiplicatively grows every row's effective scale before `buildExportPlan` computes outW/outH, then is hard-capped at source dims uniformly on both axes. The implementation is mechanically a Phase-28 mirror minus the image-worker step: types → validator/serializer/materializer → IPC envelope (3 sites) → AppShell state slot + dirty memo + Open hydration + ResampleArgs threading → OptimizeDialog UI + reactive recompute. The math change inserts BETWEEN `rawEffScale` (line 192 of `src/core/export.ts`) and `downscaleClampedScale` (line 202) in BOTH `src/core/export.ts` AND its renderer-side parity twin `src/renderer/src/lib/export-view.ts` — these two files are byte-identical by contract, enforced by parity tests at `tests/core/export.spec.ts:657-740`.

The single non-obvious risk: `buildExportPlan` is called from FOUR call sites in AppShell + atlas-preview + a renderer mirror; the `BuildExportPlanOptions` parameter must be threaded through every call site that needs the buffer applied (OptimizeDialog plan + atlas-preview projection + savings memo). The hygiene parity test enforces structural equivalence between core and renderer copies, so the buffer parameter must be added to BOTH module signatures with byte-identical bodies.

**Primary recommendation:** Wire `safetyBufferPercent` through the seven Phase-28 plumbing layers verbatim (the precedent is structurally identical), insert the buffer multiplier with the no-op-when-zero guard at line 192–202 of both `export.ts` files, and add a `bufferCapped: true` conditional spread at line 321 of both files mirroring the `isCapped` precedent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Buffer math (multiply effScale, clamp at source dims) | `src/core/` (pure TS) | `src/renderer/src/lib/export-view.ts` (byte-identical mirror) | Layer 3 invariant — no DOM/sharp in core; renderer needs the same math without crossing the `tests/arch.spec.ts` core-import gate |
| `.stmproj` persistence (validator/serializer/materializer) | `src/core/project-file.ts` | — | Pure TS; same layer as Phase 28 |
| IPC envelope threading | `src/main/project-io.ts` | `src/preload/index.ts` (transparent — no shape change) | Phase 28 precedent; passes through 3 sites: Open, recovery, resample |
| Buffer state ownership + reactive recompute trigger | `src/renderer/src/components/AppShell.tsx` | `src/renderer/src/modals/OptimizeDialog.tsx` (UI host) | Mirrors `sharpenOnExportLocal` precedent — state lifts to AppShell, prop drills into dialog |
| Buffer input UI (label + `<input type="number">` + `%` suffix) | OptimizeDialog inline JSX | — | UI-SPEC locked; no extracted component |
| Image-worker (resize / sharpen) | UNCHANGED | — | Buffer is baked into `ExportRow.outW/outH`; the worker does not need to know the buffer % |

## Standard Stack

No new dependencies. Phase 30 uses only modules already in the project:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (per project tsconfig) | Pure-TS math + types | Layer 3 invariant requires zero runtime deps in `src/core/` [VERIFIED: src/core/export.ts:64-70] |
| React | 19 | OptimizeDialog input + AppShell state slot | Existing modal stack [CITED: PROJECT.md line 35] |
| Tailwind v4 | (project) | Literal-class strings only (Pitfall 8) | Tooling already in place [CITED: 30-UI-SPEC.md] |
| vitest | 4 | Unit + integration tests | Existing test infrastructure [VERIFIED: package.json `test` script via CLAUDE.md] |

### Supporting
None — buffer math is a single multiplication + Math.min, no helper library required.

### Alternatives Considered
None. Buffer math is arithmetic; persistence shape is locked by D-14; UI shape is locked by UI-SPEC. CONTEXT.md D-01..D-15 close all design alternatives.

**Installation:** none required.

**Version verification:** N/A — no new dependencies.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Range & Step (UI input)**
- **D-01:** Maximum buffer = **25%**.
- **D-02:** Step = **1%** via `<input type="number" step={1}>`.
- **D-03:** Default = **0%** (backward-compat for v1.2/v1.3-era files; same value for fresh projects).
- **D-04:** **Strictly integer** — `<input type="number" step={1}>` blocks decimals. Persisted shape is `number` with integer value. Validation: clamp to `[0, 25]` on commit; non-numeric input falls back to last-valid-value or 0.

**Cap-Bound Feedback (silent contract)**
- **D-05:** **Silent UI** — when buffer pushes a row INTO the source-dim cap, OptimizeDialog shows nothing extra. The existing summary tiles reflect the clamped reality.
- **D-06:** **Add `bufferCapped: boolean` flag** on `ExportRow` (parallel to existing `isCapped`). Both flags are independent. `bufferCapped` fires when `bufferedScale > sourceRatio` AND `rawEffScale ≤ sourceRatio` (i.e. the buffer is what pushed it over the cap). Threaded through IPC; not rendered in v1.3.1.
- **D-07:** **Literal no-op when `safetyBufferPercent === 0`.** `if (buffer === 0) skip the multiplier`. Guarantees byte-identical behavior to pre-Phase-30 export.

**Reactivity & Math Locus**
- **D-08:** **Reactive on every change** — summary tiles recompute on every keystroke / arrow-tick.
- **D-09:** **Buffer is a parameter to `buildExportPlan`** via `BuildExportPlanOptions`, NOT a post-process step. Math order inside the function:
  ```
  1. raw effScale  := overridePct ? applyOverride(...) : peakScale
  2. bufferedScale := buffer === 0 ? raw : raw × (1 + buffer/100)
  3. clampedScale  := Math.min(safeScale(bufferedScale), 1.0)        // Gap-Fix #1 (Phase 6)
  4. cappedScale   := Math.min(clampedScale, sourceRatio)              // Phase 22.1 dims cap
  5. isCapped      := clampedScale > sourceRatio                        // existing flag
  6. bufferCapped  := bufferedScale > sourceRatio && (raw <= sourceRatio)  // new flag
  ```
- **D-10:** **Stay on renderer — no Worker offload.** `buildExportPlan` is pure `src/core/` TS.
- **D-11:** **No debounce in v1.3.1.** Every change triggers a recompute.

**UI Placement, Copy, Persistence**
- **D-12:** **Above the sharpen toggle, in a "Quality" group.**
- **D-13:** Input label: `Safety buffer:  [N] %`.
- **D-14:** Persisted field name: `safetyBufferPercent`. Type: `number` (integer-valued, 0–25). Same name across `.stmproj`, `MaterializedProject`, `LoadedProject`, `ExportOptions`/`ResampleArgs`, IPC envelope.
- **D-15:** **Tooltip on the input** explaining cap behavior. Suggested wording: "Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate." (Locked verbatim by UI-SPEC.)

### Claude's Discretion
- "Quality" group header label — **resolved by UI-SPEC: `Quality`** (sentence-case, single word).
- Tooltip wording — **resolved by UI-SPEC: D-15 verbatim.**
- `BuildExportPlanOptions` field name — **resolved by D-14: `safetyBufferPercent`** (must match across all surfaces).
- Validation clamp locus — **resolved by UI-SPEC: in OptimizeDialog `onChange` handler, NOT AppShell setter.** AppShell receives an already-clean value.
- Test fixture choice — `fixtures/SIMPLE_PROJECT/` for unit; `fixtures/Chicken-Min/` for the per-region dedup × buffer regression spec.

### Deferred Ideas (OUT OF SCOPE)
- Cap-bound UI signal (count badge, per-row indicator). `bufferCapped` flag exists but is never rendered in v1.3.1.
- Sub-1% precision (decimals).
- Sharpen + buffer presets ("Conservative / Standard / Aggressive").
- Per-row buffer overrides.
- Web-Worker offload of `buildExportPlan`.
- Sigma-style preset-pinned constants.
- Auto-detect "ideal" buffer per-rig.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUFFER-01 | Optimize Assets dialog exposes a user-configurable safety-buffer percentage control that multiplicatively grows each row's effective scale (calculated peak AND user-set overrides) before the export plan is computed. | UI surface: OptimizeDialog input above the sharpen toggle inside a "Quality" group (UI-SPEC). State: AppShell `safetyBufferPercentLocal` (mirrors `sharpenOnExportLocal` at line 318). Math: insertion between line 192 `rawEffScale` and line 202 `downscaleClampedScale` of `src/core/export.ts` AND `src/renderer/src/lib/export-view.ts`. |
| BUFFER-02 | When the safety buffer would cause an exported texture to extrapolate beyond its source PNG dimensions, the export is hard-capped at source dimensions on both axes — preserving D-91 and D-79 / Phase 6 uniform-only invariant. | The buffered scale flows through the existing cap pipeline: `Math.min(safeScale(buffered), 1.0)` (canonical clamp, line 202) then `Math.min(clamped, sourceRatio)` (drift cap, line 227). Both clamps are uniform multipliers, so the existing aspect-ratio invariant is preserved untouched. New `bufferCapped` flag at conditional spread line 321 records when the buffer was the cause. |
| BUFFER-03 | The safety-buffer setting persists per-project in the `.stmproj` v1 schema as an additive optional field (mirrors `sharpenOnExport` precedent — missing field defaults to 0%; no schema-version bump). | Three-touch validator/serializer/materializer pattern at `src/core/project-file.ts:188-200` (validator pre-massage), line 316 (serializer), line 380 (`PartialMaterialized` shape), line 449 (materializer back-fill). Mirror verbatim. ProjectFileV1 type at `src/shared/types.ts:886-919` adds the field; AppSessionState at line 929-944 adds the field; MaterializedProject at line 951-997 adds the field; ResampleArgs at line 1022-1057 adds the field (optional). |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ User input: keystroke / arrow-tick on safety-buffer <input> in OptimizeDialog │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
                           OptimizeDialog onChange handler
                           (CLAMP HERE — UI-SPEC validation locus)
                           clampedValue = clamp(parseInt(value), 0, 25)
                                           │
                                           ▼
                            props.onSafetyBufferChange(clampedValue)
                                           │
                                           ▼
                              AppShell setSafetyBufferPercentLocal
                                           │
                                  ┌────────┴─────────┐
                                  │                  │
                                  ▼                  ▼
                  isDirty memo recomputes   exportDialogState.plan
                  (toggle dirty if !=        recomputes via
                   lastSaved)                buildExportPlan(summary,
                                             overrides,
                                             { safetyBufferPercent })
                                                     │
                                                     ▼
                                        OptimizeDialog re-renders
                                        (summary tiles update reactively;
                                         per-D-08 reactive contract)
                                                     │
                                            user clicks Save
                                                     │
                                                     ▼
                              buildSessionState() → state.safetyBufferPercent
                                                     │
                                                     ▼
                       window.api.saveProject(state, currentProjectPath)
                                                     │
                                                     ▼
                                IPC: src/main/project-io.ts handleProjectSave
                                                     │
                                                     ▼
                                    serializeProjectFile(state, path)
                                    → ProjectFileV1.safetyBufferPercent
                                                     │
                                                     ▼
                                     atomic write .stmproj.tmp + rename

                            ─── NEXT SESSION (Open) ─────────────

                       User opens .stmproj → window.api.openProject(path)
                                                     │
                                                     ▼
                                src/main/project-io.ts handleProjectOpen
                                                     │
                                                     ▼
                                    validateProjectFile(json)
                            (PRE-MASSAGE: missing safetyBufferPercent → 0)
                                                     │
                                                     ▼
                                    materializeProjectFile(file, path)
                            (back-fill: file.safetyBufferPercent ?? 0)
                                                     │
                                                     ▼
                            MaterializedProject.safetyBufferPercent set
                                                     │
                                                     ▼
                                  IPC reply → AppShell mountOpenResponse
                                                     │
                                                     ▼
                            setSafetyBufferPercentLocal(project.safetyBufferPercent ?? 0)
                                                     │
                                                     ▼
                            OptimizeDialog hydrates with restored value
```

### Recommended Project Structure

No new files. Surgical edits to:
```
src/
├── core/
│   ├── export.ts                  # Add buffer to BuildExportPlanOptions; insert at 192-202; bufferCapped at 321
│   └── project-file.ts            # Validator pre-massage + serializer + PartialMaterialized + materializer
├── shared/
│   └── types.ts                   # ProjectFileV1, AppSessionState, MaterializedProject, ResampleArgs, ExportRow, BuildExportPlanOptions (sibling of core)
├── main/
│   └── project-io.ts              # 3 IPC sites: Open envelope, recovery envelope, resample envelope
└── renderer/src/
    ├── lib/export-view.ts         # Byte-identical mirror of core/export.ts buffer math
    ├── components/AppShell.tsx    # safetyBufferPercentLocal state slot + lastSaved + isDirty + buildSessionState + mountOpenResponse + resample threading
    └── modals/OptimizeDialog.tsx  # safetyBufferPercent + onSafetyBufferChange props; "Quality" group with input above sharpen toggle
tests/
├── core/
│   ├── export.spec.ts             # Buffer math: 0% no-op, 5% growth, cap-binding, dedup interaction, passthrough partition
│   └── project-file.spec.ts       # Forward-compat (missing field → 0); reject non-integer / out-of-range; round-trip identity
└── renderer/
    ├── optimize-dialog-passthrough.spec.tsx  # Add buffer prop coverage where existing tests use OptimizeDialog
    └── (new) optimize-dialog-buffer.spec.tsx # Reactive recompute: typing in input changes summary tiles
```

### Pattern 1: Three-touch validator/serializer/materializer (Phase 28 mirror)

**What:** Each new `.stmproj` field touches three functions in `src/core/project-file.ts`: validator pre-massage (back-fill missing → default), serializer (state field → file field), materializer (file field → MaterializedProject field).

**When to use:** Every additive-optional field in `.stmproj` v1 since Phase 8 D-148.

**Example (pre-existing sharpenOnExport precedent — buffer mirrors verbatim):**

`src/core/project-file.ts:188-200` — VALIDATOR PRE-MASSAGE
```typescript
// Phase 28 SHARP-01 forward-compat — v1.2-era .stmproj files have no
// `sharpenOnExport` field; default to false so legacy projects load with
// the neutral baseline (D-04 default-OFF). Mirrors loaderMode pre-massage
// above (Phase 21 D-08).
if (obj.sharpenOnExport === undefined) {
  obj.sharpenOnExport = false;
}
if (typeof obj.sharpenOnExport !== 'boolean') {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: 'sharpenOnExport is not boolean' },
  };
}
```

`src/core/project-file.ts:316` — SERIALIZER
```typescript
// Phase 28 SHARP-01 — round-trips through .stmproj per D-06.
sharpenOnExport: state.sharpenOnExport,
```

`src/core/project-file.ts:380` — PartialMaterialized SHAPE
```typescript
/**
 * Phase 28 SHARP-01 — defence-in-depth fallback (validator pre-massage
 * already substitutes false, but defaults here too in case any future
 * code path bypasses the validator). Mirrors loaderMode field above.
 */
sharpenOnExport: boolean;
```

`src/core/project-file.ts:449` — MATERIALIZER BACK-FILL
```typescript
// Phase 28 SHARP-01 — defence-in-depth nullish-coalesce; validator
// pre-massage already substitutes false. Mirrors loaderMode line above.
sharpenOnExport: file.sharpenOnExport ?? false,
```

**Buffer-specific adaptations:**
- Validator: `obj.safetyBufferPercent === undefined → 0`. Validate `typeof === 'number'` AND `Number.isInteger(value)` AND `value >= 0 && value <= 25`. Reject otherwise with `invalid-shape`.
- Serializer: `safetyBufferPercent: state.safetyBufferPercent`.
- Materializer: `safetyBufferPercent: file.safetyBufferPercent ?? 0`.

[VERIFIED: lines re-read live from current `src/core/project-file.ts`]

### Pattern 2: Four-touch type cascade (Phase 28 mirror)

**What:** Each new persisted field touches four type definitions in `src/shared/types.ts`: `ProjectFileV1` (the file shape), `AppSessionState` (the editable session shape), `MaterializedProject` (the post-Open IPC shape), `ResampleArgs` (the resample IPC shape).

**Example excerpts (sharpenOnExport precedent):**

`src/shared/types.ts:914-918` — ProjectFileV1
```typescript
/**
 * Phase 28 SHARP-01 — opt-in unsharp-mask post-resize on downscale.
 * v1.2-era .stmproj files have no `sharpenOnExport` field; the validator
 * pre-massages missing → false (mirrors loaderMode pre-massage in
 * src/core/project-file.ts:174-186). D-04 default-OFF, D-06 persists per project.
 */
sharpenOnExport: boolean;
```

`src/shared/types.ts:943` — AppSessionState
```typescript
/** Phase 28 SHARP-01 — round-trips through .stmproj per D-06. */
sharpenOnExport: boolean;
```

`src/shared/types.ts:996` — MaterializedProject
```typescript
/**
 * Phase 28 SHARP-01 — threaded through main/project-io.ts so AppShell
 * seeds its sharpenOnExportLocal slot on Open / locate-skeleton recovery.
 */
sharpenOnExport: boolean;
```

`src/shared/types.ts:1056` — ResampleArgs (OPTIONAL — nullable for backward-compat)
```typescript
/**
 * Phase 28 D-06 — per-project sharpen-on-export toggle. The resample
 * round-trip re-materialises the project; threading the renderer's
 * current `sharpenOnExportLocal` keeps `MaterializedProject.sharpenOnExport`
 * truthful at the resample seam. Optional for backward-compat
 * (undefined → false).
 */
sharpenOnExport?: boolean;
```

[VERIFIED: lines re-read live from current `src/shared/types.ts`]

### Pattern 3: AppShell three-touch lifecycle (state slot + dirty + Open hydration)

**What:** Every persisted-and-editable field touches three points in `src/renderer/src/components/AppShell.tsx`:

1. `useState` slot seeded from `initialProject?.X ?? default`
2. `lastSaved` shape + `isDirty` memo entry comparing local-vs-saved
3. `mountOpenResponse` setter + `buildSessionState` field threading

**Example (sharpenOnExportLocal precedent, line numbers from live file):**

`AppShell.tsx:318-320` — STATE SLOT
```typescript
const [sharpenOnExportLocal, setSharpenOnExportLocal] = useState<boolean>(
  () => initialProject?.sharpenOnExport ?? false,
);
```

`AppShell.tsx:355-367` — lastSaved SHAPE
```typescript
const [lastSaved, setLastSaved] = useState<{
  overrides: Record<string, number>;
  samplingHz: number;
  sharpenOnExport: boolean; // Phase 28 SHARP-01
} | null>(
  initialProject
    ? {
        overrides: { ...initialProject.restoredOverrides },
        samplingHz: initialProject.samplingHz,
        sharpenOnExport: initialProject.sharpenOnExport ?? false,
      }
    : null,
);
```

`AppShell.tsx:872-876` — isDirty MEMO
```typescript
// Phase 28 SHARP-01 — toggle change marks project dirty. Mirrors
// samplingHz line above (D-06 — toggle persists per-project).
if (sharpenOnExportLocal !== lastSaved.sharpenOnExport) return true;
return false;
}, [overrides, lastSaved, samplingHzLocal, sharpenOnExportLocal]);
```

`AppShell.tsx:1163-1166` — Open HYDRATION (mountOpenResponse)
```typescript
// Phase 28 SHARP-01 — restore sharpenOnExport from materialized project.
// Materializer back-fills file.sharpenOnExport ?? false, so legacy
// .stmproj files load with toggle OFF. D-04.
setSharpenOnExportLocal(project.sharpenOnExport ?? false);
```

`AppShell.tsx:1134-1138` — lastSaved seed in mountOpenResponse
```typescript
setLastSaved({
  overrides: { ...project.restoredOverrides },
  samplingHz: project.samplingHz,
  sharpenOnExport: project.sharpenOnExport ?? false, // Phase 28 SHARP-01
});
```

`AppShell.tsx:798-800` — buildSessionState THREADING
```typescript
// Phase 28 SHARP-01 — round-trips through .stmproj per D-06.
sharpenOnExport: sharpenOnExportLocal,
```

[VERIFIED: every line re-read live]

### Pattern 4: IPC envelope threading (3 sites in `src/main/project-io.ts`)

**What:** Each new `MaterializedProject` field is built in three places:
1. **Open path** (`handleProjectOpen`) — the standard Open-from-disk flow.
2. **Recovery path** (`handleLocateSkeletonAndReopen`) — when the user re-points a missing skeleton.
3. **Resample path** (`handleResampleProject`) — when the user changes samplingHz at runtime.

**Example excerpts:**

`src/main/project-io.ts:566` — Open path
```typescript
// Phase 28 SHARP-01 — thread sharpenOnExport so AppShell can seed its
// sharpenOnExportLocal slot on Open. Mirrors loaderMode site immediately
// above (Phase 21 D-08 Site 2).
sharpenOnExport: materialized.sharpenOnExport,
```

`src/main/project-io.ts:696-701, 832` — Recovery path
```typescript
// Phase 28 SHARP-01 — recovery path threads sharpenOnExport from the
// renderer's last-known session payload (mirrors samplingHz/loaderMode
// lifts above). Type-coerce defensively (the recovery shape is loosely
// typed at this boundary).
const sharpenOnExport: boolean =
  typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false;
// ... (used in MaterializedProject construction at line 832)
sharpenOnExport,
```

`src/main/project-io.ts:1044-1045` — Resample path
```typescript
sharpenOnExport:
  typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false,
```

**Buffer-specific adaptation:** all three sites coerce `typeof a.safetyBufferPercent === 'number' && Number.isInteger(a.safetyBufferPercent) && a.safetyBufferPercent >= 0 && a.safetyBufferPercent <= 25 ? a.safetyBufferPercent : 0` (defensive — recovery / resample payloads cross IPC and are loosely typed; integer-and-range guard at the seam matches OptimizeDialog `onChange` clamp).

[VERIFIED: lines re-read live from current `src/main/project-io.ts`]

### Pattern 5: OptimizeDialog props mirror (Phase 28 precedent)

`src/renderer/src/modals/OptimizeDialog.tsx:104-110` — PROP SHAPE
```typescript
/**
 * Phase 28 SHARP-01 — opt-in sharpen toggle. Hydrated from the project's
 * .stmproj per D-06; toggling marks the project dirty (AppShell wires the
 * setter into its isDirty memo, mirroring samplingHzLocal).
 */
sharpenOnExport: boolean;
onSharpenChange: (v: boolean) => void;
```

`OptimizeDialog.tsx:421-434` — UI ELEMENT (visual precedent for buffer placement)
```typescript
{/* Phase 28 SHARP-01 — opt-in sharpen toggle. Hydrated from the project's
    .stmproj on dialog mount (D-06). Disabled in-progress (mirrors Atlas
    Preview button disabled-predicate at line 417). Tailwind v4 literal-class
    discipline (Pitfall 8) — every className is a string literal. */}
<label
  htmlFor="sharpen-on-export-toggle"
  className="flex items-center gap-2 mb-4 text-xs text-fg cursor-pointer"
>
  <input
    id="sharpen-on-export-toggle"
    type="checkbox"
    checked={props.sharpenOnExport}
    onChange={(e) => props.onSharpenChange(e.target.checked)}
    disabled={state === 'in-progress'}
    className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
  />
  Sharpen output on downscale
</label>
```

`AppShell.tsx:1965-1966` — PROP WIRING AT MOUNT
```typescript
sharpenOnExport={sharpenOnExportLocal}
onSharpenChange={setSharpenOnExportLocal}
```

The buffer prop will sit alongside (`safetyBufferPercent={safetyBufferPercentLocal}`, `onSafetyBufferChange={setSafetyBufferPercentLocal}`). UI-SPEC §"Layout & Interaction Contract" locks the input + sharpen-toggle into a single "Quality" group `<div>`. The sharpen toggle moves INTO the new group (not removed; just relocated).

[VERIFIED: lines re-read live from current OptimizeDialog.tsx + AppShell.tsx]

### Pattern 6: Reactive recompute (samplingHzLocal → buildExportPlan)

**`buildExportPlan` is called from FOUR sites in the renderer** [VERIFIED via grep]:

| Site | File:Line | Purpose |
|------|-----------|---------|
| 1 | `AppShell.tsx:627` | `onClickOptimize` — initial plan when user clicks toolbar Optimize button |
| 2 | `AppShell.tsx:745` | `onConfirmStart` — re-build plan after user picks output dir, just before kicking off image-worker |
| 3 | `AppShell.tsx:837` | `savingsPctMemo` — Documentation Builder HTML export's chip-strip savings number |
| 4 | `src/renderer/src/lib/atlas-preview-view.ts:183` | `buildAtlasPreview('optimized')` — Atlas Preview modal's optimized-mode page count |

For reactive recompute (D-08), the buffer must be threaded through all FOUR. The cleanest approach: change `buildExportPlan(summary, overrides)` calls to `buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal })` and add `safetyBufferPercentLocal` to the `useMemo` dep array at `AppShell.tsx:846`.

**Reactivity wiring sample (samplingHzLocal precedent at AppShell.tsx:846):**

```typescript
const savingsPctMemo = useMemo<number | null>(() => {
  const plan = buildExportPlan(effectiveSummary, overrides);
  if (plan.rows.length === 0) return null;
  // ...
}, [effectiveSummary, overrides]);
```

**Buffer-adapted shape:**
```typescript
const savingsPctMemo = useMemo<number | null>(() => {
  const plan = buildExportPlan(effectiveSummary, overrides, {
    safetyBufferPercent: safetyBufferPercentLocal,
  });
  // ... unchanged body
}, [effectiveSummary, overrides, safetyBufferPercentLocal]);
```

**For OptimizeDialog reactive recompute,** the cleanest wire is: AppShell already builds `exportDialogState.plan` at line 627 / 745 — but those are `useCallback`s not `useMemo`s. To make the plan recompute as the user types in the buffer input, EITHER:
- **Option A (recommended):** Lift `plan` to a `useMemo` keyed on `[summary, overrides, safetyBufferPercentLocal]`, then OptimizeDialog reads `props.plan` reactively. Modify `setExportDialogState({ plan, outDir })` shape to `{ outDir }` only; OptimizeDialog selects `plan` from the memo via a separate prop.
- **Option B (smaller diff):** Have OptimizeDialog itself call `buildExportPlan` from props (`summary`, `overrides`, `safetyBufferPercent`) inside its own `useMemo`, replacing the `props.plan` field. AppShell's `setExportDialogState` shrinks to `{ outDir }` (just the picker state).

**Option B is preferred** because the OptimizeDialog already receives `summary` / `overrides` indirectly via `props.plan`; making it the owner of the memo localizes reactivity to the dialog and avoids a stale-plan window when the user types fast. The planner picks the option; CONTEXT D-08 only mandates reactivity, not the wiring shape.

[VERIFIED: AppShell.tsx:627, 745, 836-846 + atlas-preview-view.ts:183]

### Anti-Patterns to Avoid

- **NO buffer multiplication outside `buildExportPlan`.** Per D-09, the math lives inside the function so the existing cap pipeline stays the single source of truth for "outW ≤ sourceW always."
- **NO independent buffer math in `computeExportDims`** (the per-row helper at `export-view.ts:139-236` used by panel display columns). The panel "Peak W×H" column intentionally answers "what does the rig demand BEFORE buffer?" — buffer is an export-time concern, not a peak-display concern. UI-SPEC implicitly aligns: only the OptimizeDialog summary tiles update reactively when the buffer changes; the Global Max Render Source panel does NOT change.
- **NO bumping `version: 1` to `version: 2`** for `safetyBufferPercent`. Phase 8 D-148 + Phase 21 + Phase 28 all extended the schema additively without bumping; the buffer mirrors that pattern.
- **NO new sharp / DOM imports in `src/core/`.** Layer 3 invariant — verified clean today via `grep -rn "from 'sharp'" src/core/` returning ZERO hits.
- **NO conditional class concatenation in OptimizeDialog** (Tailwind v4 Pitfall 8). All className strings are literals.
- **NO floating-point flag for `bufferCapped` set in the dedup keep-max branch** unless guarded by an explicit recompute. The existing `isCapped` is set both at first-write and at keep-max replacement (lines 234-244). Mirror the same shape: capture `bufferCapped` once per row before the dedup compare, and update both when `effScale > prev.effScale` AND `bufferCapped` differs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Integer input clamping | Custom regex / parsing logic | `<input type="number" min={0} max={25} step={1}>` + `parseInt(e.target.value, 10)` + `Math.max(0, Math.min(25, n))` in `onChange`; fall back to last-valid-value on `NaN` | Browser handles arrow steps, paste validation, decimal rejection. UI-SPEC §"Behavioral edge cases" locks the contract. |
| Buffer multiplication math | Helper module / class | Inline `buffer === 0 ? raw : raw * (1 + buffer / 100)` | Single line; D-07 no-op gate must be visible in the math; no abstraction earns its weight. |
| Round-trip identity test for `.stmproj` | Compare individual field values | Save → reload → byte-compare `JSON.stringify` (or fs read+compare) on the .stmproj | Phase 22 DIMS-05 round-trip via `Buffer.compare === 0` precedent (PROJECT.md). The locked invariant is byte-identical, not field-equal. |
| Tooltip rendering | New tooltip library / Radix portal | Native `title=` attribute on the `<input>` | UI-SPEC §"Component Inventory" forbids tooltip libraries. Project's zero-runtime-tooltip-library posture. |
| Disabled-state UI | Custom CSS class | Tailwind `disabled:opacity-50 disabled:cursor-not-allowed` literal string | Existing sharpen toggle uses this verbatim. |

**Key insight:** Every layer of this phase has an exact Phase-28 / Phase-22.1 precedent. Inventing new patterns is harmful — the maintenance burden of mirroring is already 7 sites; introducing a different shape on any one of them creates a search-and-grep landmine for future agents.

## Common Pitfalls

### Pitfall 1: Floating-point drift on `buffer === 0`
**What goes wrong:** Without the explicit `if (buffer === 0)` short-circuit, `raw * (1 + 0/100)` is `raw * 1.0`, which is mathematically identity but in floating-point can produce different bit patterns from `raw` for some non-representable values.
**Why it happens:** IEEE-754 subnormals and round-to-even at multiplication boundaries.
**How to avoid:** D-07 mandates the literal short-circuit: `const bufferedScale = buffer === 0 ? rawEffScale : rawEffScale * (1 + buffer / 100);`. Add a unit test asserting `buildExportPlan(..., { safetyBufferPercent: 0 })` produces an `ExportPlan` deeply equal to `buildExportPlan(...)` (omitted opts) on the SIMPLE_TEST + Chicken-Min fixtures.
**Warning signs:** Any existing golden test starts producing different `effectiveScale` field values when the buffer parameter is undefined.

### Pitfall 2: Lockstep parity drift between `src/core/export.ts` and `src/renderer/src/lib/export-view.ts`
**What goes wrong:** Edit one file, forget the other. The renderer-side mirror is byte-identical-by-contract; tests at `tests/core/export.spec.ts:657-740` enforce structural sameness via grep regex.
**Why it happens:** Layer 3 invariant forbids the renderer from importing `src/core/*`. The two files live in different trees.
**How to avoid:** Edit both files in the same commit. Read both before changing either. The parity test will catch divergent function signatures via the regex `/Math\.ceil\(\(acc\.row\.canonicalW \?\? acc\.row\.sourceW\)/` — buffer math should NOT alter that line, only the LINES BEFORE it (between rawEffScale and downscaleClampedScale) AND the conditional spread at line 321 (adding `bufferCapped`).
**Warning signs:** `tests/core/export.spec.ts` "core ↔ renderer parity" describe block fails after a buffer-only edit.

### Pitfall 3: Passthrough re-partitioning when buffer pushes a row out of passthrough
**What goes wrong:** A row at `outW === effectiveSourceW` (passthrough) becomes `outW > effectiveSourceW` after a 5% buffer is applied, but the buffer is THEN clamped down to `sourceRatio` so `outW === effectiveSourceW` again — and the row remains in `passthroughCopies[]`. This is correct (CONTEXT D-09 confirms: "Phase 22.1 POST-override passthrough partition runs unchanged on the final outW/outH — buffer effects flow through naturally"). The pitfall is misreading: the partition is computed AT THE EMIT LOOP from the FINAL outW/outH (lines 279-298 of `export.ts`), AFTER all clamps. A capped row at `outW = sourceW` is genuinely passthrough whether the cap was hit by `peakScale > 1` or by `bufferedScale > sourceRatio`.
**Why it happens:** Confusing "buffer pushed it" with "buffer changed the partition." The partition runs on outputs, not inputs.
**How to avoid:** Add a regression test: a TRIANGLE-style row with `peakScale === 1.0` and zero override (already passthrough) + `safetyBufferPercent: 5` should still emit to `passthroughCopies[]` because the canonical clamp at line 202 holds the `effScale ≤ 1.0`, so `outW === sourceW`.
**Warning signs:** Existing `optimize-dialog-passthrough.spec.tsx` tests fail after the buffer is added with default 0 (means the no-op path is broken).

### Pitfall 4: Per-region dedup × buffer interaction
**What goes wrong:** With Phase 29 per-region dedup, multiple attachments share a `sourcePath`/`regionName`. If two attachments have raw effScales `0.6` and `0.8`, the dedup keeps `0.8` (max). Apply a 5% buffer: `0.6 × 1.05 = 0.63`, `0.8 × 1.05 = 0.84`. Both contribute `0.84` after the buffer. Order matters — buffer must be applied BEFORE the dedup keep-max comparison so all contributing attachments fold to the same buffered max, deterministically.
**Why it happens:** Putting the buffer multiplication after the `bySourcePath.set` write site would apply buffer to only the winning row, leaving the loser's pre-buffer value as a comparison anchor that's stale.
**How to avoid:** Insert buffer math INSIDE the for loop at lines 187-202, between `rawEffScale` (line 192) and `downscaleClampedScale` (line 202). The dedup keep-max at line 240-244 then operates on the buffered+clamped+capped value as before. CONTEXT.md D-09 step order confirms.
**Warning signs:** A regression test on `fixtures/Chicken-Min/` (path-indirection rig) shows non-deterministic dedup-winner selection under a non-zero buffer.

### Pitfall 5: `safeScale` ordering — buffer × safeScale
**What goes wrong:** `safeScale` is the ceil-thousandth lower-bound helper at `export.ts:133-135`. Question: do we apply `safeScale(buffered)` or `buffered = safeScale(raw) * (1 + buffer/100)`? D-09 step order says `safeScale(bufferedScale)` AFTER the buffer multiply.
**Why it happens:** `safeScale` rounds up to nearest thousandth. Applied to `0.36071 × 1.05 = 0.378745` it produces `0.379`. Applied to `safeScale(0.36071) = 0.361` then `× 1.05 = 0.37905` produces `0.379` after another `safeScale`. Different values for some inputs.
**How to avoid:** Follow D-09 verbatim: `bufferedScale := buffer === 0 ? rawEffScale : rawEffScale × (1 + buffer/100)`, THEN `clampedScale := Math.min(safeScale(bufferedScale), 1.0)`. ONE `safeScale` call, applied to the post-buffer value.
**Warning signs:** Math drift between core and renderer-view if the two files apply `safeScale` at different points in the chain.

### Pitfall 6: ResampleArgs optional vs required
**What goes wrong:** `MaterializedProject.sharpenOnExport: boolean` is REQUIRED, but `ResampleArgs.sharpenOnExport?: boolean` is OPTIONAL (line 1056). The asymmetry is intentional — older renderer builds may not thread sharpenOnExport through resample, and the seam coerces undefined → false (line 1044-1045).
**Why it happens:** Resample crosses the IPC boundary; the renderer's `useState` slot is the source of truth, but the resample payload is loosely typed.
**How to avoid:** Make `safetyBufferPercent` REQUIRED on `MaterializedProject` (mirrors sharpenOnExport — ProjectFileV1 and AppSessionState all REQUIRED). Make it OPTIONAL on `ResampleArgs` (mirrors line 1056). Defensive coercion at the seam.

### Pitfall 7: AppShell `mountOpenResponse` field-restoration order
**What goes wrong:** `AppShell.tsx:1132-1167` runs many setters in sequence. Order matters: `setLastSaved` should record the JUST-LOADED `safetyBufferPercent`, while `setSafetyBufferPercentLocal` should restore that same value. If one of them is missed, the project will read as dirty immediately on Open.
**Why it happens:** The two writes happen inline; a developer mirroring sharpenOnExport must touch BOTH lines 1137 AND 1166.
**How to avoid:** Add a regression test: open `.stmproj` with `safetyBufferPercent: 5` → `isDirty` is `false` immediately after `mountOpenResponse` completes. Mirror sharpenOnExport's existing test at `tests/renderer/save-load.spec.tsx`.

## Code Examples

Verified patterns from official sources / live codebase:

### Insertion point for buffer math in `src/core/export.ts:187-228`

**BEFORE (current code):**
```typescript
const overrideKey = row.regionName ?? row.attachmentName;
const overridePct = overrides.get(overrideKey);
const rawEffScale =
  overridePct !== undefined
    ? applyOverride(overridePct, row.peakScale).effectiveScale
    : row.peakScale;
// Gap-Fix Round 5...
const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);

// Phase 22 DIMS-03 cap...
const { actualSourceW, actualSourceH, canonicalW, canonicalH } = row;
const sourceRatio =
  row.dimsMismatch && actualSourceW !== undefined && actualSourceH !== undefined
    ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
    : Infinity;
const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);
const isCapped = downscaleClampedScale > sourceRatio;
```

**AFTER (Phase 30 surgical insert):**
```typescript
const overrideKey = row.regionName ?? row.attachmentName;
const overridePct = overrides.get(overrideKey);
const rawEffScale =
  overridePct !== undefined
    ? applyOverride(overridePct, row.peakScale).effectiveScale
    : row.peakScale;

// Phase 30 BUFFER-01 — multiplicative safety buffer applied AFTER override
// resolution + BEFORE the canonical ≤ 1.0 clamp. D-07 literal no-op when
// buffer === 0 guarantees byte-identical behavior to pre-Phase-30 export.
const bufferPct = _opts?.safetyBufferPercent ?? 0;
const bufferedScale =
  bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100);

// Gap-Fix Round 5 (existing)... safeScale applied to BUFFERED value per D-09.
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1);

// Phase 22 DIMS-03 cap (existing — unchanged)...
const { actualSourceW, actualSourceH, canonicalW, canonicalH } = row;
const sourceRatio =
  row.dimsMismatch && actualSourceW !== undefined && actualSourceH !== undefined
    ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
    : Infinity;
const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);
const isCapped = downscaleClampedScale > sourceRatio;

// Phase 30 BUFFER-02 — bufferCapped fires when buffer pushed the scale past
// sourceRatio AND the raw (pre-buffer) scale was within sourceRatio.
// Independent of isCapped: a row can be bufferCapped without being isCapped
// (clean atlas with no dims drift, just buffer pushing past 1.0 → clamped
// at the canonical 1.0 ceiling, which is sourceRatio === Infinity here so
// the canonical clamp applies). Compute against safeScale(rawEffScale) to
// match the comparison shape downscaleClampedScale uses.
const safeRaw = safeScale(rawEffScale);
const bufferCapped =
  bufferPct > 0
  && Math.min(safeScale(bufferedScale), 1) > Math.min(safeRaw, 1, sourceRatio)
  && safeRaw <= sourceRatio;
```

[ASSUMED — exact `bufferCapped` predicate shape: CONTEXT D-06 says "fires when `bufferedScale > sourceRatio` AND `(raw <= sourceRatio)`". Above I've expanded this to also cover the canonical (sourceRatio = Infinity) ceiling case, which D-09 implies via "1.0 clamp guards canonical." Planner should confirm during plan authoring whether `bufferCapped` should fire on the 1.0-canonical clamp too, or only on the actualSource sourceRatio cap. Leaning toward "yes both" because user mental model is "buffer was clamped" — both clamps are forms of source-dim cap.]

### Then at the conditional-spread line (existing `isCapped` precedent at line 321):

**BEFORE:**
```typescript
// Phase 22.1 G-07 D-07 — cap-binding signal for OptimizeDialog row label.
...(acc.isCapped ? { isCapped: true } : {}),
```

**AFTER (add bufferCapped alongside):**
```typescript
// Phase 22.1 G-07 D-07 — cap-binding signal for OptimizeDialog row label.
...(acc.isCapped ? { isCapped: true } : {}),
// Phase 30 BUFFER-02 D-06 — buffer-induced cap signal. Independent of
// isCapped (a row can be bufferCapped without being isCapped). Carried
// in IPC; not surfaced in v1.3.1 UI per silent-cap contract D-05.
...(acc.bufferCapped ? { bufferCapped: true } : {}),
```

The `Acc` interface at line 157-162 must gain `bufferCapped: boolean`; the dedup keep-max at line 240-244 must propagate `bufferCapped` alongside `isCapped` when the new row wins.

### `BuildExportPlanOptions` extension (line 72-75)

**BEFORE:**
```typescript
export interface BuildExportPlanOptions {
  /** Default false (D-109). Future Settings toggle path. */
  includeUnused?: boolean;
}
```

**AFTER:**
```typescript
export interface BuildExportPlanOptions {
  /** Default false (D-109). Future Settings toggle path. */
  includeUnused?: boolean;
  /**
   * Phase 30 BUFFER-01 — multiplicative safety buffer (integer percent,
   * 0–25). When 0 or undefined: literal no-op per D-07 (byte-identical
   * pre-Phase-30 behavior). When > 0: each row's rawEffScale is multiplied
   * by (1 + safetyBufferPercent/100) BEFORE the canonical 1.0 clamp and
   * the Phase 22.1 sourceRatio cap. The cap pipeline preserves D-91
   * (no texture surpasses source dims) regardless of buffer value.
   */
  safetyBufferPercent?: number;
}
```

### `ExportRow` type extension (`src/shared/types.ts` — currently has `isCapped?: boolean` per existing interface)

```typescript
/**
 * Phase 30 BUFFER-02 D-06 — true when buffer-induced effective scale
 * exceeds source dims and is silently clamped. Parallel to existing
 * isCapped from Phase 22.1; both flags are independent. Carried in IPC
 * payload but not rendered in v1.3.1 UI per D-05 silent-cap contract.
 */
bufferCapped?: boolean;
```

### `.stmproj` validator pre-massage extension at `project-file.ts:188-200`

```typescript
// Phase 30 BUFFER-03 forward-compat — v1.2/v1.3-era .stmproj files have no
// `safetyBufferPercent` field; default to 0 so legacy projects load with
// the buffer disabled (D-03 default 0%). Mirrors sharpenOnExport pre-massage
// above (Phase 28 SHARP-01).
if (obj.safetyBufferPercent === undefined) {
  obj.safetyBufferPercent = 0;
}
if (typeof obj.safetyBufferPercent !== 'number'
    || !Number.isInteger(obj.safetyBufferPercent)
    || obj.safetyBufferPercent < 0
    || obj.safetyBufferPercent > 25) {
  return {
    ok: false,
    error: {
      kind: 'invalid-shape',
      message: 'safetyBufferPercent is not an integer in [0, 25]',
    },
  };
}
```

[VERIFIED: line range re-read live; mirror shape is byte-identical pattern to sharpenOnExport at lines 188-200]

### OptimizeDialog input + Quality group container (UI-SPEC locked)

```tsx
{/* Phase 30 BUFFER-01 — Quality group containing safety buffer input and the
    moved sharpen toggle. UI-SPEC locks DOM structure; Tailwind v4 literal-class
    discipline (Pitfall 8) — every className is a string literal. */}
<div className="border border-border rounded-md bg-surface p-3 mb-4">
  <span className="text-xs text-fg-muted mb-2 block">Quality</span>
  <label
    htmlFor="safety-buffer-input"
    className="flex items-center gap-2 mb-2 text-xs text-fg cursor-pointer"
  >
    Safety buffer:
    <input
      id="safety-buffer-input"
      type="number"
      min={0}
      max={25}
      step={1}
      value={props.safetyBufferPercent}
      onChange={(e) => {
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isFinite(parsed)) {
          props.onSafetyBufferChange(0);
          return;
        }
        const clamped = Math.max(0, Math.min(25, Math.floor(parsed)));
        props.onSafetyBufferChange(clamped);
      }}
      disabled={state === 'in-progress'}
      title="Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate."
      className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
    />
    <span className="text-fg-muted">%</span>
  </label>
  {/* MOVED from above (was at OptimizeDialog.tsx:421-434) — sharpen toggle
      relocated INTO the Quality group per UI-SPEC §"Component Inventory". */}
  <label
    htmlFor="sharpen-on-export-toggle"
    className="flex items-center gap-2 text-xs text-fg cursor-pointer"
  >
    <input
      id="sharpen-on-export-toggle"
      type="checkbox"
      checked={props.sharpenOnExport}
      onChange={(e) => props.onSharpenChange(e.target.checked)}
      disabled={state === 'in-progress'}
      className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    />
    Sharpen output on downscale
  </label>
</div>
```

[ASSUMED — exact Tailwind class for the `<input>` `width` (`w-16`). UI-SPEC does not lock the input width; planner picks based on existing OptimizeDialog input precedents. The input must show 1–2 digit values cleanly.]

## State of the Art

No state-of-the-art technology shifts apply. This phase reuses 6 established project patterns (Phase 8 schema-additive, Phase 9 reactive memo, Phase 21 + Phase 28 plumbing, Phase 22.1 cap math, Phase 29 per-region dedup, UI-SPEC component placement). The "current approach" is the established codebase pattern; nothing is "old."

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bufferCapped` should fire on the canonical 1.0 clamp too (not just on the actualSource sourceRatio cap) | Code Examples / `bufferCapped` predicate | If WRONG: the flag underreports cap-binding for rows with no `dimsMismatch` (clean atlases). Planner can flip to D-06 narrow-reading: `bufferedScale > sourceRatio && (raw <= sourceRatio)` only — but then a pure-canonical row pushed past 1.0 by buffer gets no flag, which contradicts the user's mental model of "buffer was clamped." Recommend planner sanity-check during /gsd-discuss-phase or accept the broader interpretation. |
| A2 | The OptimizeDialog input width should be `w-16` (Tailwind 4rem ≈ 64px) | Code Examples / OptimizeDialog input | If WRONG: visual tweak, no behavior impact. UI-SPEC locks the suffix `<span>` and wrapping flex but doesn't lock input width. Planner can adjust. |
| A3 | `Option B` (OptimizeDialog owns the `useMemo`) is cleaner than `Option A` (AppShell owns) for reactive recompute | Pattern 6 | If WRONG: minor architectural difference. Both options satisfy CONTEXT D-08 reactive-on-every-change contract. Planner picks based on existing OptimizeDialog state-flow precedents. Option A may be safer because `exportDialogState.plan` is consumed in multiple places (onConfirmStart re-builds it at line 745); centralizing the memo avoids a divergence. |
| A4 | `safeScale` must be applied to the POST-buffer value, not before. | Pitfall 5 | If WRONG: math drifts between core and renderer-view; existing display-vs-export lower-bound contract may break. CONTEXT D-09 step order is unambiguous: `bufferedScale := raw × (1 + buffer/100)` THEN `clampedScale := Math.min(safeScale(bufferedScale), 1.0)`. Single source of truth. |

## Open Questions (RESOLVED)

1. **Should `bufferCapped` fire on the canonical 1.0 clamp?** (See A1 above.)
   - What we know: D-06 says "fires when `bufferedScale > sourceRatio` and `raw <= sourceRatio`". For clean rows (no dims drift), `sourceRatio === Infinity` so the strict reading never fires.
   - What's unclear: is the user's mental model "buffer pushed me past source dims" (narrow) or "buffer was silently clamped" (broad)?
   - Recommendation: planner adopts the broad reading (fires on either canonical-1.0 clamp or sourceRatio clamp). The flag is silent-only in v1.3.1, so the over-reporting is harmless; conversely under-reporting now would force a future migration when the flag becomes user-visible. **However:** since the flag is silent and CONTEXT D-06 is explicit, narrow reading is also acceptable — the planner should pick AND document the choice.
   - **RESOLVED:** NARROW predicate per CONTEXT D-06 verbatim — `bufferPct > 0 && bufferedScale > sourceRatio && safeScale(rawEffScale) <= sourceRatio`. Documented in Plan 30-01 must_haves (ExportRow.bufferCapped comment block) and locked into Plan 30-02 Task 2 Step 5 (predicate compute) + Plan 30-02 Task 4 Test 3 (canonical-1.0 clamp does NOT fire bufferCapped) + Test 4 (cap-binding fires bufferCapped). Future PATCH may broaden to canonical-1.0 clamp; not v1.3.1 scope.

2. **Should the buffer apply to `passthroughCopies[]` rows (effScale = 1.0× → buffer × 1.0 = 1.05× → cap at 1.0× → still passthrough)?**
   - What we know: D-09 step order applies buffer BEFORE all clamps. A passthrough-1.0 row gets buffer-multiplied to 1.05, clamped back to 1.0, partition still passthrough.
   - What's unclear: nothing — CONTEXT D-09 + Phase 22.1 partition-on-output flow correctly covers it.
   - Recommendation: add an explicit regression test for this case (TRIANGLE peakScale=1.0 + buffer=5 + zero override → still in passthroughCopies[]).
   - **RESOLVED:** Buffer applies to passthrough rows; the canonical 1.0 clamp keeps them in `passthroughCopies` when buffered scale stays at 1.0 (partition runs on FINAL outW/outH at the emit loop, so buffer effects flow through naturally — Pitfall 3 + ROADMAP §Constraints to preserve). Explicit regression test added in Plan 30-02 Task 4 Test 5 ("Phase 22.1 partition: passthrough preserved at buffer=0; row at canonical 1.0 with buffer 5 stays in passthroughCopies via canonical clamp"). Plan 30-01 must_haves also covers this in the Phase 22.1 invariant truth.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TypeScript | All edits | ✓ (existing project) | strict 5.x | — |
| vitest | Test additions | ✓ (existing project) | 4 | — |
| jsdom | OptimizeDialog UI tests | ✓ (existing pattern: `// @vitest-environment jsdom` at top of test files) | — | — |
| `@testing-library/react` | OptimizeDialog interaction tests | ✓ (existing usage at `tests/renderer/optimize-dialog-passthrough.spec.tsx`) | — | — |

**Missing dependencies with no fallback:** None — purely existing-stack work.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4 + @testing-library/react (renderer); vitest 4 (core) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- export.spec.ts project-file.spec.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUFFER-01 | Buffer threaded into `BuildExportPlanOptions`; rawEffScale × (1 + buffer/100) computed pre-clamp; produces correct outW/outH for buffer values 0/5/10/25 on SIMPLE_TEST | unit (core) | `npm run test -- tests/core/export.spec.ts -t "Phase 30"` | ✅ `tests/core/export.spec.ts` exists; new describe block needed |
| BUFFER-01 | Buffer reactivity: typing in OptimizeDialog input changes summary tile values | integration (renderer) | `npm run test -- tests/renderer/optimize-dialog-buffer.spec.tsx` | ❌ Wave 0 — new file |
| BUFFER-02 | Buffer pushing scale past sourceRatio is silently clamped; `bufferCapped: true` set on resulting ExportRow; outW ≤ effectiveSourceW preserved on both axes | unit (core) | `npm run test -- tests/core/export.spec.ts -t "BUFFER-02"` | ✅ existing file |
| BUFFER-02 | Phase 6 D-110 uniform-scale aspect ratio preserved when buffer + cap binds | unit (core) | `npm run test -- tests/core/export.spec.ts -t "aspect ratio"` | ✅ existing pattern at Phase 22 DIMS test |
| BUFFER-03 | v1.2/v1.3-era `.stmproj` (no `safetyBufferPercent` field) loads with `safetyBufferPercent = 0` | unit (core) | `npm run test -- tests/core/project-file.spec.ts -t "safetyBufferPercent"` | ✅ existing file; new describe block needed |
| BUFFER-03 | Save with `safetyBufferPercent: 5` → reload → field equals 5; byte-identical round-trip | integration | `npm run test -- tests/integration/save-load.spec.ts` (or sibling) OR an in-memory serialize→materialize test in project-file.spec.ts | ✅ pattern at lines 427-465 of project-file.spec.ts |
| BUFFER-03 | Validator rejects non-integer / out-of-range / non-numeric `safetyBufferPercent` (e.g., -1, 26, 5.5, "yes") | unit (core) | `npm run test -- tests/core/project-file.spec.ts -t "rejects"` | ✅ pattern at lines 404-425 of project-file.spec.ts |
| BUFFER-03 | Schema version stays at `1` after save with non-zero buffer | unit (core) | `npm run test -- tests/core/project-file.spec.ts -t "version"` | ✅ pattern exists |
| BUFFER-01 + Phase 22.1 | Passthrough-1.0 row with buffer=5 still emits to passthroughCopies[] (Open Question 2 regression) | unit (core) | `npm run test -- tests/core/export.spec.ts -t "passthrough preserved under buffer"` | ❌ Wave 0 — new test |
| BUFFER-01 + Phase 29 | Per-region dedup × buffer interaction on `fixtures/Chicken-Min/` deterministic | unit (core) | `npm run test -- tests/core/export.spec.ts -t "Chicken-Min buffer"` | ❌ Wave 0 — new test, fixture exists |
| BUFFER-01 + Layer 3 | `grep -rn "from 'sharp'" src/core/` returns zero hits after buffer math added | hygiene | `npm run test -- tests/core/export.spec.ts -t "hygiene"` | ✅ existing pattern at `lines 616-636` of export.spec.ts |
| Parity | core ↔ renderer-view byte-identical buffer math | unit (core) | `npm run test -- tests/core/export.spec.ts -t "parity"` | ✅ existing pattern at lines 657-740 of export.spec.ts (regex must be extended to include `safetyBufferPercent` signature) |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/core/export.spec.ts tests/core/project-file.spec.ts` — fast, < 5 seconds
- **Per wave merge:** `npm run test` — full vitest suite (~700 tests; <30s on M-series Mac per Phase 22 telemetry)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/renderer/optimize-dialog-buffer.spec.tsx` — new file; covers reactive recompute (typing changes summary tile content) + clamp behavior (negative / >25 / decimal / NaN inputs)
- [ ] New `describe('Phase 30 — safetyBufferPercent')` block in `tests/core/project-file.spec.ts` (mirror `tests/core/project-file.spec.ts:381-466` Phase 28 block byte-for-byte; substitute boolean → integer + range)
- [ ] New `describe('buildExportPlan — Phase 30 BUFFER-01..03')` block in `tests/core/export.spec.ts` (multiple `it` cases per requirement; covers no-op, growth, cap-binding, dedup, passthrough preservation, parity-with-renderer-view)
- [ ] Extend existing parity describe block at `tests/core/export.spec.ts:657-740` with regex check for `safetyBufferPercent` and `bufferCapped` keywords in BOTH files

## Validation Architecture (Nyquist 8 Dimensions)

### 1. Functional
**Test outline:** Set buffer to 0%, 1%, 5%, 10%, 25% on SIMPLE_TEST fixture; for each, assert `ExportRow.effectiveScale === safeScale(rawEffScale × (1 + buffer/100))` clamped at 1.0 and capped at sourceRatio.
**Fixture:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (CIRCLE / SQUARE / TRIANGLE).
**Acceptance criterion:** All five buffer values produce predictable, formula-derivable outW/outH; the 0% case is bit-exact-equal to a `buildExportPlan` call without `_opts`.

### 2. Negative-path
**Test outline:** Validator rejection on (a) `safetyBufferPercent: -1` (b) `safetyBufferPercent: 26` (c) `safetyBufferPercent: 5.5` (d) `safetyBufferPercent: "5"` (e) `safetyBufferPercent: NaN`. OptimizeDialog input handler clamps user-typed `-1` → `0`, `26` → `25`, `abc` → last-valid-or-0 (per D-04).
**Fixture:** synthetic ProjectFileV1 literal in `tests/core/project-file.spec.ts`; jsdom render of OptimizeDialog with controlled state.
**Acceptance criterion:** All invalid file values return `{ ok: false, error: { kind: 'invalid-shape' } }`; all invalid input events fire `onSafetyBufferChange` with a clamped integer.

### 3. Boundary
**Test outline:** Buffer values exactly at the boundary: 0 (no-op), 1 (smallest growth), 25 (max), 26 (clamped), -1 (clamped). Buffer just sufficient to trigger cap-binding: a row with `peakScale = 0.95` + `safetyBufferPercent = 6` (`0.95 × 1.06 = 1.007 > 1.0`) → cap at 1.0, `bufferCapped: true`.
**Fixture:** Synthetic SkeletonSummary literal with hand-tuned `peakScale` values.
**Acceptance criterion:** Boundary buffer values produce the documented behavior; bufferCapped flag fires exactly when raw ≤ sourceRatio and buffered > sourceRatio (or whichever clamp variant the planner locks in A1).

### 4. Concurrency
**Test outline:** Rapid keystroke sequence (e.g. user types "1", "2", "3" in 50ms) → React's batched updates should produce a final `safetyBufferPercent` of 123 → clamped to 25 in the onChange handler. No race between renderer recompute and AppShell state.
**Fixture:** jsdom + `@testing-library/user-event` (existing usage in `tests/renderer/`).
**Acceptance criterion:** After the keystroke sequence, OptimizeDialog summary tiles reflect a buffer of 25 (the final clamp), not an intermediate value.

### 5. Cross-platform
**Test outline:** `safetyBufferPercent: 5` round-trips through serialize → materialize on (a) macOS / POSIX paths (b) Windows-style backslash project file paths via the existing `relativizePath` / `absolutizePath` boundary. The integer field is path-independent so the cross-platform concern is whether the `.stmproj` JSON is byte-identical across line-ending strategies.
**Fixture:** Existing project-file.spec.ts pattern with hard-coded `'/abs/project.stmproj'` (POSIX) and `'C:\\abs\\project.stmproj'` (Windows synthetic).
**Acceptance criterion:** Round-trip identity preserved on both path styles; field value is integer-valued in both serialized JSON outputs.

### 6. Persistence (CRITICAL — locked round-trip identity contract per CONTEXT)

**Locked contract:**
1. **Backward-compat:** A v1.2/v1.3-era `.stmproj` file with no `safetyBufferPercent` field loads with `safetyBufferPercent === 0` and `version === 1` (no schema bump).
2. **Forward identity:** Save a project with `safetyBufferPercent: 5` → close → reopen → in-memory state has `safetyBufferPercent === 5`. Re-save → on-disk file is byte-identical to the prior save (when no other state changed).
3. **Zero-default omission policy:** Planner picks one of two consistent shapes (per CONTEXT specifics): EITHER `safetyBufferPercent: 0` is always written to disk (verbose-but-explicit) OR the field is omitted when value is 0 (terse-but-relies-on-validator-pre-massage). Phase 28 wrote `sharpenOnExport: false` always (verbose path); recommend mirroring.

**Test outline:** (a) Synthesize a v1.2-era ProjectFileV1 literal lacking the field → validateProjectFile pre-massages to 0 → materializeProjectFile yields `safetyBufferPercent === 0`. (b) Build an AppSessionState with `safetyBufferPercent: 5` → serializeProjectFile → materializeProjectFile → `safetyBufferPercent === 5`. (c) Run (b) twice and compare the JSON output byte-by-byte (`Buffer.compare === 0`).
**Fixture:** In-memory ProjectFileV1 / AppSessionState literals.
**Acceptance criterion:** All three contracts hold.

### 7. Performance
**Test outline:** Reactive recompute latency on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (largest in repo). Measure `buildExportPlan` wall time at buffer values 0, 5, 25 — assert each call completes in < 10ms (CONTEXT.md specifics: "≤500-row rigs should run in single-digit ms").
**Fixture:** `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (Phase 9 N2.2 wall-time gate fixture).
**Acceptance criterion:** Each call < 10ms wall time. If perf budget exceeded → planner introduces 100–150ms debounce per CONTEXT D-11.

### 8. Regression
**Test outline:** Run the entire existing vitest suite (~700 tests) BEFORE and AFTER the buffer wiring. Diff the test counts, snapshots, and any golden-file outputs — D-07's literal no-op guarantees byte-identical behavior when buffer === 0, so no existing test should change. Specific high-risk regression suspects:
- `tests/core/export.spec.ts` — case (a) baseline + case (b) override + case (d) dedup + Round 5 ceil + parity describe
- `tests/renderer/optimize-dialog-passthrough.spec.tsx` — ExportRow shape extended (bufferCapped optional); existing tests must not break
- `tests/renderer/save-load.spec.tsx` — round-trip integration; new field shape must not perturb existing round-trips
**Fixture:** Full repo suite.
**Acceptance criterion:** All ~700 existing tests pass with zero changes to expected values. If any existing test fails: D-07 no-op contract is broken — investigate immediately.

## Risk Landmines

### R1: `safeScale` × buffer ordering edge case
On `peakScale: 0.36071` + `safetyBufferPercent: 5`: `0.36071 × 1.05 = 0.378745`. `safeScale(0.378745) = Math.ceil(378.745) / 1000 = 0.379`. Output `outW = ceil(canonicalW × 0.379)`. CONTEXT D-09 step order is the single source of truth — the planner must NOT introduce a second `safeScale` call before the buffer multiply.

### R2: `Acc.bufferCapped` keep-max propagation
At `src/core/export.ts:240-244`, the dedup keep-max replaces `prev.row`, `prev.effScale`, `prev.isCapped` when a new row wins. The new field `prev.bufferCapped` must also be replaced — otherwise the ACC carries the LOSER's bufferCapped flag while presenting the WINNER's effScale. Symmetric edit.

### R3: ExportRow IPC shape breakage
`ExportRow` crosses IPC from renderer → main `handleStartExport`. Adding `bufferCapped?: boolean` is structurally safe (optional field; structured-clone-compatible) but the type definition in `src/shared/types.ts` (search for `interface ExportRow`) must declare it so both the renderer producer and main consumer agree on shape.

### R4: `tests/core/export.spec.ts` parity regex must be extended
The parity test at lines 681-694 uses regex `/Math\.ceil\(\(acc\.row\.canonicalW \?\? acc\.row\.sourceW\)/` to assert that both files share the emit-loop shape. Adding buffer math BEFORE the emit loop does not change this regex — but planner should ADD a new parity assertion: both files must contain the buffer-multiply line `bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100)` (or equivalent stable signature). Otherwise a future agent might accidentally drop the buffer from one copy without the test catching it.

### R5: AppShell `lastSaved` shape extension
`AppShell.tsx:355-367` defines `lastSaved` with three explicit fields (`overrides`, `samplingHz`, `sharpenOnExport`). Adding `safetyBufferPercent: number` to this shape is a TypeScript change that propagates to every `setLastSaved({...})` call site (multiple). A grep audit before editing is mandatory: `grep -n "setLastSaved" src/renderer/src/components/AppShell.tsx`. Phase 28's plan likely already encountered this.

### R6: `BuildExportPlanOptions` is currently `_opts` (renamed from `opts`)
At `src/core/export.ts:140`, the parameter is named `_opts` to satisfy `noUnusedParameters`. When the buffer becomes the FIRST consumer of the parameter, the name should rename back to `opts` (no underscore). Renderer-view at line 241 has the same `_opts` name; both must rename identically per parity. **Watch:** if the rename is incomplete on either side, the parity test passes (it doesn't grep parameter names) but TypeScript may still emit a noUnusedParameters warning if `safetyBufferPercent` access is gated behind a function that doesn't reference `_opts` directly.

## Project Constraints (from CLAUDE.md)

- **Source of truth:** `~/.claude/plans/i-need-to-create-zesty-eich.md` (full technical design); `.planning/REQUIREMENTS.md`; `.planning/ROADMAP.md`; `.planning/STATE.md`.
- **Spine animations are stored in seconds, not frames** — irrelevant for Phase 30 (no sampler changes).
- **`computeWorldVertices` after `updateWorldTransform(Physics.update)` already handles** all transforms — irrelevant for Phase 30.
- **Sampler lifecycle** — irrelevant for Phase 30 (no sampler changes).
- **The math phase does not decode PNGs** — irrelevant for Phase 30.
- **`core/` is pure TypeScript, no DOM** — DIRECTLY APPLIES. Buffer math must be pure TS in `src/core/export.ts`. No new imports.
- **Default sampler rate: 120 Hz** — irrelevant for Phase 30.
- **Release tag conventions** — irrelevant for Phase 30 (no release work).
- **Test fixture:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — APPLIES (golden-driver for unit tests).
- **`temp/`** — must remain gitignored — APPLIES (no changes there).
- **GSD workflow:** `/gsd-plan-phase 30` is next.

[CITED: `./CLAUDE.md`]

## Sources

### Primary (HIGH confidence)
- `src/core/export.ts:60-342` — re-read live; full `buildExportPlan` body, `BuildExportPlanOptions`, `safeScale`, dedup loop, emit loop. [VERIFIED]
- `src/core/project-file.ts:180-453` — re-read live; validator pre-massage, serializer, PartialMaterialized, materializer, with sharpenOnExport precedent at lines 188-200, 316, 380, 449. [VERIFIED]
- `src/shared/types.ts:880-1057` — re-read live; ProjectFileV1, AppSessionState, MaterializedProject, ResampleArgs with sharpenOnExport at lines 918, 943, 996, 1056. [VERIFIED]
- `src/main/project-io.ts:540-1048` — re-read live; three IPC envelope sites at 566 (Open), 700/832 (recovery), 1044 (resample). [VERIFIED]
- `src/renderer/src/modals/OptimizeDialog.tsx:100-434` — re-read live; props shape at 104-110, sharpen toggle at 421-434. [VERIFIED]
- `src/renderer/src/components/AppShell.tsx:310-1408` — re-read live; sharpenOnExportLocal state slot at 318, lastSaved at 355-367, isDirty memo at 872-876, mountOpenResponse hydration at 1132-1167, buildSessionState threading at 798-810, OptimizeDialog mount at 1965-1966, savingsPctMemo at 836-846, resample threading at 1407. [VERIFIED]
- `src/renderer/src/lib/export-view.ts:1-432` — re-read live; byte-identical mirror of core/export.ts; computeExportDims helper. [VERIFIED]
- `tests/core/export.spec.ts:1-740` — re-read live; existing test patterns + parity describe block. [VERIFIED]
- `tests/core/project-file.spec.ts:381-466` — re-read live; sharpenOnExport test pattern (precedent for buffer tests). [VERIFIED]
- `tests/renderer/optimize-dialog-passthrough.spec.tsx:1-120` — re-read live; existing OptimizeDialog UI test pattern. [VERIFIED]
- `.planning/phases/30-safety-buffer-in-optimize-dialog/30-CONTEXT.md` — D-01..D-15 locked decisions; canonical_refs table with line numbers (re-verified accurate). [CITED]
- `.planning/phases/30-safety-buffer-in-optimize-dialog/30-UI-SPEC.md` — locked UI design contract with checker sign-off 6/6 PASS. [CITED]
- `.planning/REQUIREMENTS.md` lines 23-27 — BUFFER-01..03 acceptance text. [CITED]
- `.planning/ROADMAP.md` lines 708-734 — Phase 30 detail block. [CITED]
- `.planning/PROJECT.md` — Layer 3 invariant, Phase 6 uniform-only, Phase 22.1 partition decisions, Phase 28 sharpenOnExport precedent. [CITED]
- `./CLAUDE.md` — project source-of-truth and test-fixture references. [CITED]

### Secondary (MEDIUM confidence)
- (none — every claim was verified against the live source.)

### Tertiary (LOW confidence)
- (none — every claim was verified against the live source.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all uses are existing-stack.
- Architecture: HIGH — every plumbing layer has a Phase-28 precedent re-read live this session.
- Pitfalls: HIGH for floating-point/parity/dedup interactions (all verified by reading existing tests and live math). MEDIUM for `bufferCapped` predicate exact shape (A1) — see Open Questions.
- Code Examples: HIGH — every excerpt was copy-pasted from live source files.

**Research date:** 2026-05-08
**Valid until:** 30 days (stable codebase; Phase 28 pattern is locked; last touch to canonical sites was Phase 29 commits dated 2026-05-07).

## RESEARCH COMPLETE
