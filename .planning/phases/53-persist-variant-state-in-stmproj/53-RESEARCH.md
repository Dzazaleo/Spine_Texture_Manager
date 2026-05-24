# Phase 53: Persist Variant State in `.stmproj` - Research

**Researched:** 2026-05-24
**Domain:** `.stmproj` additive-optional schema persistence (4th instance of a locked, in-repo pattern)
**Confidence:** HIGH

## Summary

This is a **copy-an-existing-pattern phase**, not a discovery phase. The `.stmproj`
project file already persists per-project config additively (no version bump, validator
pre-massages missing → default) for `loaderMode`, `sharpenOnExport`, `safetyBufferPercent`,
the four `atlas*` fields, and `overridesAtlasLess`. Phase 53 adds **one more optional
field — `variantRows`** (the list of per-row `scale`s from the Export Variant dialog) —
following the exact same five-touchpoint shape. CONTEXT.md (D-01..D-05) locks every
decision; this research's job is to **verify the cited seams against live code** and hand
the planner a verbatim, copy-ready precedent. [VERIFIED: codebase read of all six cited files]

The output-location half of SCALEUI-03 is **already done**: the variant flow reuses the
already-persisted `lastOutDir` (D-01), which is already the picker's pre-fill + start path
and always opens the native picker — so a stale saved dir can never hard-fail load (SC#3
satisfied by existing architecture, zero new fs/IPC). The only genuinely new on-disk
surface is `variantRows?`. [VERIFIED: `AppShell.tsx` `onConfirmStartVariant`, `variantDialogState`]

The single subtlety is **dirty detection** (D-03): rows are *content* and MUST mark the
project dirty (unlike `lastOutDir`, which stays non-dirty). Because row `id`s regenerate on
every load (`crypto.randomUUID()`), the dirty compare must be against the **persisted
projection** — the ordered list of `scale` numbers — NOT the `{id, scale}` objects, or the
project would falsely report "unsaved" the instant it opens. [VERIFIED: `isDirty` memo + `lastSaved` snapshot]

**Primary recommendation:** Mirror the `safetyBufferPercent` precedent end-to-end (it is the
cleanest single-field template), but persist `variantRows` as `{ scale: number }[]` and wire
it into BOTH load paths (the `useState` initializer AND `mountOpenResponse`) and into the
dirty machinery (`lastSaved` snapshot, `isDirty` scale-projection compare, post-save snapshot
refresh).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `variantRows` schema (shape + default + validation) | Core (`src/core/project-file.ts`, Layer-3 pure) | Shared types (`src/shared/types.ts`) | Pure-TS validator/serialize/materialize; no DOM/Electron/fs — `tests/arch.spec.ts` enforces this |
| Save/load fs serialization | Main (`src/main/project-io.ts`) | — | The only tier permitted `fs`; calls the pure core functions and threads the field through `MaterializedProject` |
| `variantRows` lifted UI state + dirty detection + restore | Renderer (`src/renderer/src/components/AppShell.tsx`) | — | AppShell owns the canonical `variantRows` slot; consumes precomputed restored values via IPC |
| Output folder memory | Renderer (reuses `lastOutDir`) | Main (persists it) | D-01 — no new tier work; `lastOutDir` already round-trips |

This is a vertical slice across all three tiers, following the established additive-field
seam. No capability is mis-tiered. The validator default MUST stay in the pure core tier
(do not put the missing→default logic in the renderer or main). [VERIFIED]

## Standard Stack

No new libraries. This phase uses only what is already in the repo. [VERIFIED: no new deps required]

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| vitest | ^4.0.0 | Test runner (`npm run test` = `vitest run`) | Existing project test framework |
| TypeScript (tsc) | repo `typecheck:node` + `typecheck:web` | Dual-program typecheck gate | CLAUDE.md Layer-1/Layer-3 enforcement |
| `crypto.randomUUID()` | platform (Electron 41 / Node 19+) | Fresh row ids on load | Already used at `AppShell.tsx:567` for row keys |

**Installation:** none.

**Version verification:** N/A — no package changes. `vitest ^4.0.0` confirmed in `package.json:57`. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram (the additive-field round-trip)

```
SAVE PATH
  AppShell.variantRows  ({id, scale}[])  [state slot, AppShell.tsx ~:565]
        │  buildSessionState() strips ids → {scale}[]   [AppShell.tsx ~:1047]
        ▼
  AppSessionState.variantRows  ({scale}[])  [src/shared/types.ts AppSessionState ~:1207]
        │  window.api.saveProject / saveProjectAs (IPC)
        ▼
  serializeProjectFile(state, path)  [src/core/project-file.ts ~:420]  ← Layer-3 pure
        │  → ProjectFileV1.variantRows  [src/shared/types.ts ProjectFileV1 ~:1117]
        ▼
  src/main/project-io.ts  → JSON.stringify → atomic write (.tmp + rename)

LOAD PATH
  .stmproj on disk
        ▼
  JSON.parse → validateProjectFile(input)  [project-file.ts ~:91]
        │  PRE-MASSAGE: obj.variantRows === undefined → default [{scale:0.5}]   ← back-compat
        │  + per-element finite-number / shape validation
        ▼
  materializeProjectFile(file, path)  [project-file.ts ~:579]  → PartialMaterialized.variantRows
        ▼
  src/main/project-io.ts  → MaterializedProject.variantRows  [src/shared/types.ts ~:1240]
        │  (IPC back to renderer)
        ▼
  AppShell consumes via TWO entry points:
    (a) initial mount  → useState initializer reads initialProject.variantRows   [~:565]
    (b) runtime re-open → mountOpenResponse(project) setVariantRows(...)          [~:1594]
        │  BOTH regenerate fresh crypto.randomUUID() ids per restored scale
        ▼
  AppShell.variantRows restored;  lastSaved snapshot seeded with scale-projection
```

### Recommended Project Structure (files to touch — verified live locations)

```
src/shared/types.ts          # +variantRows? on ProjectFileV1, AppSessionState, MaterializedProject
src/core/project-file.ts     # +validator pre-massage, +serialize, +materialize, +PartialMaterialized field
src/main/project-io.ts       # +thread variantRows into MaterializedProject (and recovery envelope if desired)
src/renderer/src/components/AppShell.tsx   # +restore (2 paths), +lastSaved snapshot, +isDirty scale-compare, +buildSessionState payload
tests/core/project-file.spec.ts   # +pre-massage/round-trip/no-version-bump cases (pure)
tests/main/project-io.spec.ts     # +fs write-contains-field / load-restores-field cases
# (optional) tests/renderer/save-load.spec.tsx   # +restore-into-variantRows + dirty-on-edit (jsdom)
```

### Pattern 1: The additive-optional `.stmproj` field (THE template — `safetyBufferPercent`)

**What:** A new optional config field that round-trips with no schema version bump; legacy
files lacking it default cleanly via a validator pre-massage. `safetyBufferPercent` is the
cleanest single-scalar precedent. [VERIFIED: all sites read]

**When to use:** Always, for any new `.stmproj` field. This is the locked contract (D-05).

**The five touchpoints (copy each for `variantRows`):**

**(1) Schema declaration** — `src/shared/types.ts`. Add to `ProjectFileV1` (~:1117–1197),
`AppSessionState` (~:1207), AND `MaterializedProject` (~:1240) AND `PartialMaterialized`
(in `project-file.ts` ~:475). Precedent:

```typescript
// src/shared/types.ts — ProjectFileV1 (verified ~:1160-1168)
sharpenOnExport: boolean;
safetyBufferPercent: number;   // Phase 30 BUFFER-03 — validator pre-massages missing → 0
// AppSessionState (verified ~:1222-1224)
sharpenOnExport: boolean;
safetyBufferPercent: number;   // round-trips through .stmproj per D-14
```

For `variantRows` the type is `{ scale: number }[]` on all four declarations (D-05; element
shape is Claude's discretion — `{scale}[]` chosen as marginally more forward-extensible).

**(2) Validator pre-massage (missing → default + shape check)** — `src/core/project-file.ts`,
in `validateProjectFile`. THIS is the back-compat mechanism (SC#2). Verified precedent at
lines 204–224:

```typescript
// src/core/project-file.ts:204-224 (verified) — safetyBufferPercent
if (obj.safetyBufferPercent === undefined) {
  obj.safetyBufferPercent = 0;
}
if (
  typeof obj.safetyBufferPercent !== 'number'
  || !Number.isInteger(obj.safetyBufferPercent)
  || obj.safetyBufferPercent < 0
  || obj.safetyBufferPercent > 25
) {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: 'safetyBufferPercent is not an integer in [0, 25]' },
  };
}
```

For `variantRows`, mirror this AND the array-of-objects validation idiom used by
`overridesAtlasLess` (verified at lines 356–379, which validates an object whose values must
be finite numbers). The `variantRows` massage default is `[{ scale: 0.5 }]` (one row at 0.5,
matching the in-memory default at `AppShell.tsx:567`). Validate: is-array, each element is an
object with a finite-number `scale`. Reject non-finite (NaN/Infinity are not JSON-safe — the
existing code rejects them for `overrides`, lines 337–346). [VERIFIED]

**(3) Serialize** — `src/core/project-file.ts` `serializeProjectFile` (~:420–456). Verified
precedent at line 448:

```typescript
// src/core/project-file.ts:444-448 (verified)
sharpenOnExport: state.sharpenOnExport,
safetyBufferPercent: state.safetyBufferPercent,
```

Add `variantRows: state.variantRows.map((r) => ({ scale: r.scale }))` (strip any id; here
`state.variantRows` is already `{scale}[]` since AppShell strips ids in `buildSessionState`
— see touchpoint 5 — but defensive `.map` is harmless and matches the shallow-clone idiom
used for `overrides` at line 430). [VERIFIED]

**(4) Materialize (load) + `PartialMaterialized` field** — `src/core/project-file.ts`
`materializeProjectFile` (~:579–639) and the `PartialMaterialized` interface (~:475–569).
Verified precedent at line 628 + 531:

```typescript
// PartialMaterialized field (verified ~:531)
safetyBufferPercent: number;
// materializeProjectFile defence-in-depth nullish-coalesce (verified ~:628)
safetyBufferPercent: file.safetyBufferPercent ?? 0,
```

Add `variantRows: file.variantRows ?? [{ scale: 0.5 }]` (defence-in-depth; the validator
pre-massage already substitutes the default, but the materializer back-fills too for any
future code path that bypasses the validator — this is the documented pattern). [VERIFIED]

**(5) Renderer: state + restore + dirty + save payload** — `src/renderer/src/components/AppShell.tsx`.
Four sub-sites (see Pattern 2). [VERIFIED]

### Pattern 2: Renderer wiring (AppShell) — the four sub-sites

**(5a) Lifted state initializer (also load-path A)** — `AppShell.tsx:565-567` (verified):

```typescript
// AppShell.tsx:565-567 (verified live)
const [variantRows, setVariantRows] = useState<
  { id: string; scale: number }[]
>(() => [{ id: crypto.randomUUID(), scale: 0.5 }]);
```

Change the initializer to restore from `initialProject` when present, regenerating ids:
```typescript
>(() =>
  (initialProject?.variantRows ?? [{ scale: 0.5 }]).map((r) => ({
    id: crypto.randomUUID(),
    scale: r.scale,
  })),
);
```
This mirrors how `lastOutDir` (`:382-383`), `safetyBufferPercentLocal` (`:353-354`), and the
`overrides` Map (`:394`) all seed from `initialProject?.…`. [VERIFIED]

**(5b) Runtime re-open (load-path B) — `mountOpenResponse`** — `AppShell.tsx:1594-1661`
(verified). **CRITICAL: AppShell is NOT remounted with a `key` per project** — App.tsx mounts
`<AppShell initialProject={state.project} …>` (App.tsx:701-708, no `key`), so opening a
*second* project within a session does NOT re-run the `useState` initializer; it flows through
`mountOpenResponse`, which calls setters directly (e.g. `setSafetyBufferPercentLocal(...)` at
`:1651`, `setLastOutDir(...)` at `:1660`). You MUST add a `setVariantRows(...)` call here too,
or row restore silently works on first open but breaks on subsequent opens. [VERIFIED — this is the easy-to-miss seam]

```typescript
// Add inside mountOpenResponse, mirroring setLastOutDir(project.lastOutDir ?? null) at :1660
setVariantRows(
  (project.variantRows ?? [{ scale: 0.5 }]).map((r) => ({
    id: crypto.randomUUID(),
    scale: r.scale,
  })),
);
```

**(5c) `buildSessionState` save payload** — `AppShell.tsx:1047-1133` (verified). Add to the
returned `AppSessionState` (mirror `safetyBufferPercent: safetyBufferPercentLocal` at `:1104`)
and add `variantRows` to the `useCallback` dependency array (mirror `safetyBufferPercentLocal`
at `:1126`):
```typescript
// inside the returned object
variantRows: variantRows.map((r) => ({ scale: r.scale })),   // strip ephemeral ids
// inside the deps array
variantRows,
```
[VERIFIED]

**(5d) Dirty machinery** — three coordinated edits (see Pattern 3 / D-03). [VERIFIED]

### Pattern 3: Dirty-by-scale-projection (D-03 — the one subtlety)

**What:** Rows are authored content → editing them marks the project dirty (quit-guard
protects them). But ids regenerate on load, so compare the **ordered scale projection**, not
the row objects.

There are three coordinated sites in `AppShell.tsx`:

**`lastSaved` snapshot type + seed** — `:431-461` (verified). The snapshot is an object of
persisted-and-dirty-tracked fields. Add a `variantScales: number[]` member (the projection),
seeded from `initialProject.variantRows`:
```typescript
// add to the lastSaved useState<{...}> type
variantScales: number[];
// add to the initialProject ? { … } seed (mirror safetyBufferPercent: initialProject.safetyBufferPercent ?? 0 at :451)
variantScales: (initialProject.variantRows ?? [{ scale: 0.5 }]).map((r) => r.scale),
```

**`isDirty` memo** — `:1193-1259` (verified). Add a scale-projection compare in BOTH arms:
```typescript
// Untitled arm (lastSaved === null), mirror `if (safetyBufferPercentLocal !== 0) return true;` at :1207:
//   dirty if the rows differ from the single default [0.5]
const scales = variantRows.map((r) => r.scale);
if (scales.length !== 1 || scales[0] !== 0.5) return true;

// Loaded arm, mirror `if (safetyBufferPercentLocal !== lastSaved.safetyBufferPercent) return true;` at :1238:
const scales = variantRows.map((r) => r.scale);
if (scales.length !== lastSaved.variantScales.length) return true;
for (let i = 0; i < scales.length; i++) {
  if (scales[i] !== lastSaved.variantScales[i]) return true;   // ORDER-SENSITIVE (D-03)
}
```
Add `variantRows` to the memo's dependency array (`:1247-1259`, mirror
`safetyBufferPercentLocal` at `:1253`). [VERIFIED]

**Post-save snapshot refresh** — `onClickSave` `:1325-1339` AND `onClickSaveAs` (same shape
~:1378-1390, verified). Add `variantScales: state.variantRows.map((r) => r.scale)` to BOTH
`setLastSaved({...})` calls (mirror `safetyBufferPercent: state.safetyBufferPercent` at
`:1331`). Forgetting `onClickSaveAs` leaves the project dirty immediately after a Save-As. [VERIFIED]

### Anti-Patterns to Avoid

- **Comparing whole `{id, scale}` row objects for dirty.** Ids regenerate on load →
  guaranteed false-dirty on open. Compare the ordered scale array only. (D-03) [VERIFIED]
- **Serializing `id` or `activePx`.** Both are ephemeral UI state (`id` = React key per
  `:567`; `activePx` = transient px-edit state in VariantDialog). Persist `scale` only. (D-05)
- **Putting the missing→default logic in the renderer or main.** It belongs in the pure
  validator (`project-file.ts`) so every load path inherits back-compat. (Layer-3, `tests/arch.spec.ts`)
- **Wiring restore into only the `useState` initializer.** Second-open-in-session goes through
  `mountOpenResponse`; both paths need the setter. [VERIFIED — high-risk omission]
- **A `.stmproj` `version` bump.** The contract is additive-optional, version stays `1`. (D-05)
- **A dedicated `variantOutputDir`.** Rejected (D-01); reuse `lastOutDir`.
- **An fs existence check on the saved output dir at load.** Rejected (D-02); the always-open
  picker makes a stale dir harmless. SC#3 needs ZERO new code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Back-compat for old `.stmproj` | A migration step / version bump | The validator pre-massage (`obj.x === undefined → default`) | Locked precedent; no version ladder needed for additive fields [VERIFIED] |
| Output-folder persistence | A new `variantOutputDir` field + load/save/dirty wiring | Reuse `lastOutDir` (already persisted + already the variant picker's pre-fill/start path) | D-01; output half is already done [VERIFIED] |
| Stale-output-dir safety | An fs/IPC existence check + clear-on-load | The existing always-open native picker | D-02; SC#3 holds by architecture [VERIFIED] |
| Row id stability across save/load | Persisting ids | `crypto.randomUUID()` on restore | Ids are React keys, not data (D-05) |
| Persisting the rest of the variant dialog config | Adding output-mode/sharpen/buffer/override fields | They already round-trip as top-level config | D-04 [VERIFIED — `sharpenOnExport`, `safetyBufferPercent`, `atlas*`, `overrides`/`overridesAtlasLess` all present in ProjectFileV1] |

**Key insight:** Every "hard" part of this phase is already solved by an existing field. The
only new work is one more instance of a four-times-proven pattern plus the dirty-by-projection
nuance.

## Runtime State Inventory

> This is a schema-additive phase, not a rename/refactor. No string-rename runtime state.
> Included for completeness because it touches the persisted file format.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (`.stmproj` files) | Old `.stmproj` files lack `variantRows`; new files written by this build add it. New files opened by an OLDER build are forward-compatible (additive contract — unknown fields ignored on read; but note: an older build's serialize would DROP the field on re-save). | Validator pre-massage handles missing → default (SC#2). No data migration; no version bump. [VERIFIED] |
| Live service config | None — desktop app, no external services. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | None — pure source + test changes. | None. |

**Note on old-build round-trip:** opening a Phase-53-written file in a pre-53 build is safe
(extra field ignored), but saving from the old build silently drops `variantRows`. This is the
inherent additive-contract tradeoff already accepted for all prior fields; no action needed.

## Common Pitfalls

### Pitfall 1: Restoring rows only on first open (missing `mountOpenResponse`)
**What goes wrong:** Rows restore correctly when the app boots into a project, but opening a
*different* project mid-session resets to the default `[0.5]` row.
**Why it happens:** AppShell is not keyed per-project; the second open dispatches through
`mountOpenResponse` (`:1594`), not the `useState` initializer. [VERIFIED]
**How to avoid:** Add `setVariantRows(...)` (with fresh ids) inside `mountOpenResponse`,
adjacent to `setLastOutDir` at `:1660`.
**Warning signs:** A renderer test that only exercises initial-mount restore passes while
re-open is broken — explicitly test `mountOpenResponse` (or open-twice).

### Pitfall 2: False-dirty on open (comparing row objects, not scales)
**What goes wrong:** A freshly opened project immediately shows the unsaved dot; quit-guard
fires on a project the user never edited.
**Why it happens:** Comparing `{id, scale}` objects where `id` regenerated on load. [VERIFIED via D-03 note]
**How to avoid:** Snapshot and compare `number[]` of scales, order-sensitive.
**Warning signs:** `isDirty` true right after load with no user action.

### Pitfall 3: Save-As leaves project dirty
**What goes wrong:** After File→Save As…, the dot stays.
**Why it happens:** `onClickSaveAs` (~:1378-1390) has its OWN `setLastSaved({...})` separate
from `onClickSave` (`:1326`). Updating only one leaves the other's snapshot stale. [VERIFIED — two snapshot sites]
**How to avoid:** Add `variantScales: state.variantRows.map(r => r.scale)` to BOTH.

### Pitfall 4: Renderer `.ts` test breaks `typecheck:node`
**What goes wrong:** A new renderer-touching test named `*.spec.ts` under `tests/renderer/`
imports renderer source, gets caught by the node program's `tests/**/*.ts` glob → TS6307 RED,
invisible to the vitest-only run. [VERIFIED: `tsconfig.node.json` include `tests/**/*.ts`; precedents `variant-twoway.spec.ts` and `dual-viewer-routing.spec.ts` are explicitly excluded]
**How to avoid:** Name any new renderer test `*.spec.tsx` (the project convention — see
`save-load.spec.tsx`, `variant-twoway.spec.tsx`). The pure core test (`tests/core/project-file.spec.ts`)
and the main fs test (`tests/main/project-io.spec.ts`) stay `.ts` (they import no renderer source).
This matches the project memory `feedback_renderer_ts_helper_test_breaks_typecheck_node`.

### Pitfall 5: Non-finite scale crashes JSON round-trip
**What goes wrong:** `NaN`/`Infinity` in a `scale` serializes to JSON `null`, silently
corrupting on reload.
**Why it happens:** `JSON.stringify(NaN) === 'null'`. The existing validator already rejects
non-finite numbers for `overrides`/`overridesAtlasLess` (lines 337-346, 369-378). [VERIFIED]
**How to avoid:** The `variantRows` validator must reject any element whose `scale` is not a
finite number — mirror the existing finite-number guard.

## Code Examples

Verified patterns from the live codebase (all cited locations re-read 2026-05-24).

### The full `safetyBufferPercent` test template (mirror for `variantRows`)
`tests/core/project-file.spec.ts:525-685` (verified) is the canonical six-case block:
1. validator pre-massages missing → default (back-compat / SC#2)
2. validator rejects bad values (non-finite / wrong shape)
3. serialize → materialize round-trips a NON-default value identically (SC#1)
4. serialize → materialize round-trips the DEFAULT value identically
5. serializing keeps `version === 1` (no schema bump, D-05)
6. double-serialize is byte-identical (determinism)

```typescript
// tests/core/project-file.spec.ts:526-548 (verified) — the back-compat case to mirror
it('validateProjectFile pre-massages missing safetyBufferPercent to 0 ...', () => {
  const legacy: Record<string, unknown> = {
    version: 1, skeletonPath: 'x.json', overrides: {}, documentation: {},
    /* ...other required fields... */
    // safetyBufferPercent INTENTIONALLY ABSENT (v1.2/v1.3-era shape)
  };
  const result = validateProjectFile(legacy);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect((result.project as ProjectFileV1).safetyBufferPercent).toBe(0);
  }
});
```
For `variantRows`: the legacy-file case asserts the pre-massaged result equals
`[{ scale: 0.5 }]`; the round-trip case asserts a multi-row set (e.g. `[{scale:0.5},{scale:0.36},{scale:0.57}]`)
survives serialize → materialize order-preserved and value-identical.

### The main fs round-trip (write-contains-field / load-restores-field)
`tests/main/project-io.spec.ts:131-148, 177-199` (verified). Save asserts the written JSON
(`vi.mocked(fs.writeFile).mock.calls[0][1]` → `JSON.parse`) contains the field; load mocks
`fs.readFile` returning a crafted JSON and asserts the materialized output restores it.

### crypto.randomUUID in jsdom tests (if a renderer test is added)
jsdom 29.x on Node 19+ exposes `globalThis.crypto`, but the project defensively polyfills it.
Reuse the pattern from `tests/renderer/documentation-builder-dialog.spec.tsx:40-46` (verified):
```typescript
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) { (globalThis as any).crypto = webcrypto as Crypto; }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.stmproj` version bump per new field | Additive-optional + validator pre-massage, version stays `1` | Established Phase 21 (`loaderMode`), reinforced Phase 28/30/36/40 | No migration ladder; this phase follows it [VERIFIED] |
| Output folder re-picked every session | Persisted `lastOutDir`, reused as variant picker pre-fill | Phase 23 | Output half of SCALEUI-03 already done [VERIFIED] |

**Deprecated/outdated:**
- CONTEXT.md cites `tests/project-io.spec.ts` — that path does NOT exist. The real specs are
  `tests/core/project-file.spec.ts` (pure validate/serialize/materialize) and
  `tests/main/project-io.spec.ts` (fs save/load). [VERIFIED — corrected location]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | All claims verified against live code or CITED from CONTEXT.md/ROADMAP/REQUIREMENTS |

**This table is empty** — every factual claim was verified by reading the cited file, or is a
direct LOCKED decision from CONTEXT.md. No user confirmation needed; decisions are already locked.

## Line-Number Verification (CONTEXT.md cited seams vs. live code)

CONTEXT.md provided line numbers; line numbers drift between phases. Verified 2026-05-24:

| CONTEXT.md citation | Live status | Notes |
|---------------------|-------------|-------|
| `types.ts` `ProjectFileV1` :1117 | ✅ exact (:1117) | |
| `types.ts` `AppSessionState` :1207 | ✅ exact (:1207) | |
| `types.ts` `sharpenOnExport` :1160 | ✅ exact (:1160) | |
| `types.ts` `safetyBufferPercent` :1168 | ✅ exact (:1168) | |
| `types.ts` `overridesAtlasLess` :1133 | ✅ exact (:1133) | |
| `types.ts` `MaterializedProject` | ✅ :1240 | (not cited but the 4th declaration site — MUST also get `variantRows`) |
| `project-file.ts` validator pre-massage | ✅ `safetyBufferPercent` :204-224; `overridesAtlasLess` :356-379 | mirror either |
| `project-file.ts` serialize :420 / materialize :579 / PartialMaterialized :475 | ✅ exact | |
| `project-io.ts` `sharpenOnExport` :680 / `safetyBufferPercent` :684 | ✅ exact | recovery-envelope threading :517-527 |
| `project-io.ts` `MaterializedProject` assembly | ✅ :656-694 | add `variantRows` alongside |
| `AppShell.tsx` `variantRows` lifted state :565-567 | ✅ exact (:565-567) | |
| `AppShell.tsx` `lastOutDir` state :382 | ✅ exact (:382-383) | |
| `AppShell.tsx` `lastOutDir` restore :1660 | ✅ exact (:1660, inside `mountOpenResponse`) | |
| `AppShell.tsx` `buildSessionState` :1047 | ✅ exact (:1047) | |
| `AppShell.tsx` isDirty derivation :1179+ | ✅ memo at :1193-1259; `lastSaved` snapshot :431-461 | |
| `AppShell.tsx` `variantDialogState.outDir` :823 | ✅ exact (:823) | |
| `AppShell.tsx` `onConfirmStartVariant` :837-878 | ✅ exact (:837-878) | reads `variantRows.map(r => r.scale)` at :856 |
| `VariantDialog.tsx` `VariantRow` :63 / rows prop :98 | ✅ exact (`{ id: string; scale: number }`) | |
| `tests/project-io.spec.ts` | ❌ wrong path | real: `tests/core/project-file.spec.ts` + `tests/main/project-io.spec.ts` |

**Net:** All cited seams exist; only the test file path needs correcting. CONTEXT.md is
otherwise accurate to the line. The two NOT-explicitly-cited-but-mandatory sites the planner
must not miss: (a) `MaterializedProject` in `types.ts:1240` (4th type declaration), and
(b) `setVariantRows` inside `mountOpenResponse` (the second load path).

## Open Questions

1. **Persist `{ scale }[]` vs. bare `number[]`?**
   - What we know: D-05 leaves this to Claude's discretion; `{ scale }[]` is marginally more
     forward-extensible (room for future per-row metadata).
   - What's unclear: nothing material.
   - Recommendation: use `{ scale: number }[]` (consistent with `VariantRow` minus `id`).

2. **Thread `variantRows` through the locate-skeleton recovery envelope?**
   - What we know: the `SkeletonNotFoundOnLoadError` recovery arm threads `lastOutDir`,
     `sharpenOnExport`, `safetyBufferPercent` etc. (`project-io.ts:513-527`) so a missing-skeleton
     reload preserves them. `variantRows` is content (dirty-tracked) like overrides, which ARE
     threaded (`mergedOverridesBuckets`).
   - What's unclear: whether the phase scope requires preserving rows across the rare
     missing-skeleton-on-open recovery hop.
   - Recommendation: thread it for parity (low cost, prevents silent row loss on that edge
     path) — but it is OPTIONAL polish, not an SC. The planner may defer it; flag if deferred.

## Environment Availability

> Skipped — this phase is pure source + test changes with no external tool/service
> dependencies (Step 2.6: no external dependencies identified beyond the already-present
> `vitest` + `tsc`, both confirmed in `package.json`).

## Validation Architecture

> nyquist_validation = true (`.planning/config.json` workflow.nyquist_validation). Section REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.0 |
| Config file | `vitest.config.ts` (environment `node`; renderer specs opt into jsdom via `// @vitest-environment jsdom` pragma) |
| Quick run command | `npx vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts` |
| Full suite command | `npm run test` (= `vitest run`) — then `npm run typecheck` (node + web) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCALEUI-03 (SC#1, save) | Saving serializes the current scale rows | unit (core) | `npx vitest run tests/core/project-file.spec.ts -t "variantRows.*round-trip"` | ✅ extend existing |
| SCALEUI-03 (SC#1, load) | Reopening restores the scales (order-preserved, fresh ids) | unit (core) + integration (main) | `npx vitest run tests/main/project-io.spec.ts -t "variantRows"` | ✅ extend existing |
| SCALEUI-03 (SC#1, restore-into-UI) | `mountOpenResponse`/init seeds `variantRows` with restored scales | renderer (jsdom) | `npx vitest run tests/renderer/save-load.spec.tsx -t "variant rows restore"` | ✅ extend existing (optional but recommended) |
| SCALEUI-03 (SC#1, dirty) | Editing rows marks project dirty; load does NOT (scale-projection compare) | renderer (jsdom) | `npx vitest run tests/renderer/save-load.spec.tsx -t "variant rows dirty"` | ⬜ Wave 0 (add) |
| SCALEUI-03 (SC#2, back-compat) | Old file lacking `variantRows` → default `[{scale:0.5}]`, opens clean | unit (core) | `npx vitest run tests/core/project-file.spec.ts -t "pre-massages missing variantRows"` | ✅ extend existing |
| SCALEUI-03 (SC#3, stale dir) | Saved output dir never hard-fails load (architecture: always-open picker) | unit (assert no fs check) / arch | `npx vitest run tests/main/project-io.spec.ts -t "lastOutDir.*restored verbatim"` + assert load succeeds when `lastOutDir` points nowhere | ✅ assert via existing load path |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/project-file.spec.ts tests/main/project-io.spec.ts` (fast, < 5s)
- **Per wave merge:** `npm run test` (full suite — 153 files, ~1546 tests per STATE.md) + `npm run typecheck`
- **Phase gate:** Full suite green + `npm run typecheck:node && npm run typecheck:web` green before `/gsd-verify-work`

### Concrete acceptance signals (grep/test-verifiable)
- **SC#1 (round-trip equality):** a core test where `materializeProjectFile(serializeProjectFile(state,p),p).variantRows.map(r=>r.scale)` deep-equals the input scales, order-preserved. PASS = `toEqual([0.5,0.36,0.57])`.
- **SC#2 (back-compat default):** a core test passing a `version:1` object with NO `variantRows` key to `validateProjectFile`; PASS = `result.ok === true` AND `result.project.variantRows` deep-equals `[{scale:0.5}]`.
- **SC#3 (stale dir never hard-fails):** an integration test where the loaded `.stmproj`'s
  `lastOutDir` points at a non-existent path; PASS = the open response is `ok: true` and
  `materialized.lastOutDir` is returned verbatim (no fs.existsSync/access call on `lastOutDir`
  exists in the load path). Assert there is NO new fs check: a grep guard that
  `src/main/project-io.ts` adds no `existsSync`/`access`/`stat` call keyed on `lastOutDir`/`variantOutputDir`.
- **No-version-bump (D-05):** assert serialized output contains `"version":1` and a grep that
  `V_LATEST` in `src/core/project-file.ts` is still `1`.

### Wave 0 Gaps
- [ ] `tests/renderer/save-load.spec.tsx` — add a "variant rows mark project dirty on edit, but
      a freshly opened project is NOT dirty" case (D-03 scale-projection). Name stays `.spec.tsx`.
- [ ] Framework install: none (vitest present).
- [ ] Shared fixtures: none required — tests construct in-memory `ProjectFileV1`/`AppSessionState`
      literals (existing precedent); **no committed `.stmproj` fixture file is added**, so the
      SAFE-01 denylist (`tests/safe01/discover-fixtures.ts` `SAFE01_EXCLUDED_PREFIXES`) does NOT
      need extension. [VERIFIED — all existing project-file tests use inline literals + mocked fs]

*(SC#3's "no fs check" assertion is the only genuinely-new test idea; everything else extends
existing describe blocks.)*

## Project Constraints (from CLAUDE.md)

- **`core/` is pure TypeScript, no DOM** — `src/core/project-file.ts` must stay Layer-3 pure
  (no DOM/Electron/sharp/`node:fs`). `node:path` is permitted. Enforced by `tests/arch.spec.ts:180-196`.
  The `variantRows` validator/serialize/materialize all live here and MUST stay pure. [VERIFIED]
- **Tests via vitest** — `npm run test`; renderer tests `.spec.tsx`, core/main tests `.ts`.
- **Folder conventions** — `temp/` is gitignored user data; `fixtures/` is in-repo test data.
  This phase adds no fixture.
- **Release-tag conventions** — dot-separated prerelease suffixes (not relevant to this phase;
  no release work).
- **Phases execute strictly in order** — Phase 53 is the last v1.7 phase.

## Sources

### Primary (HIGH confidence — codebase read 2026-05-24)
- `src/shared/types.ts` (ProjectFileV1 :1117, AppSessionState :1207, MaterializedProject :1240)
- `src/core/project-file.ts` (validator :91, pre-massage precedents :204/:356, serialize :420, materialize :579, PartialMaterialized :475)
- `src/main/project-io.ts` (MaterializedProject assembly :656-694, recovery envelope :498-528, save :131)
- `src/renderer/src/components/AppShell.tsx` (variantRows :565, lastOutDir :382, buildSessionState :1047, isDirty :1193, lastSaved :431, mountOpenResponse :1594, onClickSave :1311, onConfirmStartVariant :837)
- `src/renderer/src/modals/VariantDialog.tsx` (VariantRow :63, rows prop :98)
- `tests/core/project-file.spec.ts` (safetyBufferPercent template :525-685)
- `tests/main/project-io.spec.ts` (fs round-trip :131-199)
- `tests/renderer/save-load.spec.tsx` (renderer dirty/restore harness)
- `tests/arch.spec.ts` (Layer-3 purity gate :180-196)
- `tsconfig.node.json` (renderer `.ts` test hazard — `tests/**/*.ts` include + explicit `.spec.tsx` exclusions)
- `vitest.config.ts` (env node + jsdom pragma convention)
- `.planning/config.json` (nyquist_validation: true)
- `.planning/REQUIREMENTS.md` (SCALEUI-03 :46), `.planning/ROADMAP.md` (Phase 53 :212-220)

### Secondary
- CONTEXT.md (`53-CONTEXT.md`) — LOCKED decisions D-01..D-05
- Folded source spec `.planning/todos/pending/2026-05-23-persist-variant-rows-and-output-location.md`
- Project memory `feedback_renderer_ts_helper_test_breaks_typecheck_node`, `feedback_new_committed_fixtures_need_safe01_denylist`

### Tertiary (LOW confidence)
- None — no WebSearch needed (entirely in-repo, locked-decision phase).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; existing tools verified in package.json.
- Architecture: HIGH — pattern is a verbatim 4th instance; all five touchpoints + both load
  paths + three dirty sites read in live code.
- Pitfalls: HIGH — each derived from a verified live-code structural fact (two load paths,
  two save snapshots, tsconfig glob, JSON non-finite, id regeneration).
- Validation: HIGH — maps each SC to a concrete extend-existing test with a pass threshold;
  SC#3 satisfied by architecture with a no-new-fs-check assertion.

**Research date:** 2026-05-24
**Valid until:** 2026-06-23 (stable — pure in-repo pattern; only risk is further line drift if
other phases edit these files first, but the structural seams are stable). Re-verify line
numbers if any phase touches `AppShell.tsx` / `project-file.ts` before 53 executes.
