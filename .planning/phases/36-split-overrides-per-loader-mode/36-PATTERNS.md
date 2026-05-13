# Phase 36: Split Overrides Per Loader Mode — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 7 source + 3 test = 10 touched (per CONTEXT.md `<canonical_refs>` Code Anchors)
**Analogs found:** 10 / 10 (100%) — every new code region has an in-file precedent

This phase is a **pure copy-and-mirror exercise**: every new code region mirrors a precedent that already exists in the same file (or, for the new test, an adjacent test file). There is no role for which we lack an analog. The planner / executor should treat the excerpts below as the literal scaffolding to duplicate.

**Revision 2026-05-13 (post-checker review):** §5 read-site inventory expanded to be EXHAUSTIVE — all THREE `setOverrides(...resp.project.restoredOverrides)` hydration sites (1099 / 1239 / 1542) explicitly enumerated, all `overrides`-consuming JSX prop mounts listed (`<GlobalMaxRenderPanel>` at ~2045, `<AnimationBreakdownPanel>` at ~2064, **and** `<AtlasPreviewModal>` at 2138). Original §5-F lumped atlas-preview library wirings with the modal JSX prop; they are now split into F.1..F.4 with F.3 dedicated to the modal mount. Original §5-G covered runReload (1099) + mountOpenResponse (1239) but missed the samplingHz-change resample useEffect (1542); G.1..G.3 now exhaustive. See "Departure notes" at end of §5 for the planner-warning about `setOverrides` site count (6+ in file).

---

## File Classification

| File | New / Modify | Role | Data Flow | Closest Analog | Match Quality |
|------|--------------|------|-----------|----------------|---------------|
| `src/shared/types.ts` | modify | type-defs / IPC schema | static schema | self — `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` field-add precedents in same file (lines 1010-1024) | exact |
| `src/core/project-file.ts` | modify | validator + serializer (Layer 3 pure-TS) | request-response (load) | self — `loaderMode` pre-massage lines 176-188 + `sharpenOnExport` pre-massage lines 190-202 | exact |
| `src/main/project-io.ts` | modify | IPC handler / main-process glue | request-response (Open / locate-skeleton / resample) | self — three existing `migrateOverrides` call sites at 579, 873, 1074; recovery payload assembly at 479-491 | exact |
| `src/main/override-migration.ts` | **no body change** — called twice instead of once | service helper (pure-TS) | transform (Record → Record) | self — signature unchanged; only call-count changes upstream | exact |
| `src/renderer/src/components/AppShell.tsx` | modify | renderer state container (React) | event-driven + state derivation | self — existing `overrides` Map state (343-345) + `lastSaved` snapshot (363-377) + banner stack (1926-2001) + `mountOpenResponse` (1232-1279) + Save serializer (806, 998-1002) + samplingHz-change resample useEffect (1497-1572) + `<AtlasPreviewModal>` mount (2128-2144) | exact |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | **no change** | renderer component | event-driven | not modified — prop name `overrides` preserved per D-13/D-14 + OVR-05 | n/a |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | **no change** | renderer component | event-driven | not modified — prop name `overrides` preserved per D-13/D-14 + OVR-05 | n/a |
| `tests/main/override-migration.spec.ts` | modify (add tests) | unit test | transform | self — Test 6 falsifying-regression at lines 266-293 + `makeSummary`/`makePeak` helpers at 36-100 | exact |
| `tests/core/project-file.spec.ts` | modify (add tests) | unit test | round-trip | self — `loaderMode` round-trip pattern at 322-385 + `sharpenOnExport` pre-massage test at 388-409 | exact |
| `tests/renderer/appshell-mode-switch-divergence.spec.tsx` | **new** | integration test (RTL + jsdom) | event-driven (user simulation) | `tests/renderer/override-migration-banner.spec.tsx` (full AppShell mount + `vi.stubGlobal('api', ...)` scaffold at lines 59-107) | role-match |

---

## Pattern Assignments

### 1. `src/shared/types.ts` (type-defs / IPC schema)

**Analog:** self — three precedent additive fields (`loaderMode`, `sharpenOnExport`, `safetyBufferPercent`) all landed without a schema version bump.

#### A. Field-add pattern in `ProjectFileV1` (lines 1010-1024 — `safetyBufferPercent`)

```typescript
  /**
   * Phase 30 BUFFER-03 — multiplicative safety buffer (integer percent,
   * range [0, 25]). v1.2/v1.3-era .stmproj files have no `safetyBufferPercent`
   * field; the validator pre-massages missing → 0 (mirrors sharpenOnExport
   * pre-massage in src/core/project-file.ts:189-199). D-03 default 0%,
   * D-04 strictly integer, D-14 same name across all surfaces.
   */
  safetyBufferPercent: number;
}
```

**Mirror for `overridesAtlasLess`:** add after `overrides` (line 989), with a doc comment that references SEED-007 + L-01:

```typescript
  overrides: Record<string, number>;
  /**
   * Phase 36 SEED-007 L-01 — atlas-less mode's independent override bucket.
   * Sibling to `overrides` (which is now semantically the atlas-source bucket).
   * v1.3.x/v1.4.x .stmproj files have no `overridesAtlasLess` field; the
   * validator pre-massages missing → {} (mirrors loaderMode pre-massage in
   * src/core/project-file.ts:174-186). Routing of legacy single-map files into
   * one bucket vs. the other happens at the Open seam in src/main/project-io.ts
   * per SEED-007 Decision 2-A (saved loaderMode === 'atlas-less' → bucket here;
   * otherwise → bucket in `overrides`).
   */
  overridesAtlasLess: Record<string, number>;
```

#### B. Same field-add in `AppSessionState` (line 1039 area)

`AppSessionState.overrides` already exists at 1039; mirror with `overridesAtlasLess: Record<string, number>;` directly underneath, no doc comment needed (`AppSessionState` is in-process renderer↔main and tracks `ProjectFileV1` minus `version`).

#### C. Recovery payload rename in `SerializableError['SkeletonNotFoundOnLoadError']` (lines 871-884) AND state slot (`AppShell.tsx:428-437`)

Per D-12, **rename `mergedOverrides: Record<string, number>` → `mergedOverridesBuckets: { overrides: Record<string, number>; overridesAtlasLess: Record<string, number> }`**.

Excerpt to mirror (lines 871-884):

```typescript
export type SerializableError =
  | {
      kind: 'SkeletonNotFoundOnLoadError';
      message: string;
      projectPath: string;
      originalSkeletonPath: string;
      mergedOverrides: Record<string, number>;          // <-- RENAME
      samplingHz: number;
      lastOutDir: string | null;
      sortColumn: string | null;
      sortDir: 'asc' | 'desc' | null;
    }
```

**Departure notes:** `mergedOverrides` field renames to `mergedOverridesBuckets` carrying both buckets. Every reader (App.tsx:190, AppShell.tsx:1305, project-io.ts:486 + 801 + 874) updates atomically. Per-bucket migration re-runs main-side against the resolved skeleton.

---

### 2. `src/core/project-file.ts` (validator + serializer, Layer 3 pure-TS)

**Analog:** self — `loaderMode` pre-massage at lines 176-188 + `sharpenOnExport` pre-massage at lines 190-202.

#### A. Validator pre-massage pattern (lines 176-188 — `loaderMode`)

```typescript
  // Phase 21 D-08 forward-compat — Phase 8/20-era .stmproj files have no
  // `loaderMode` field; default to 'auto' so legacy projects load through
  // the canonical (atlas-by-default) path unchanged. Mirrors the Phase 20
  // documentation pre-massage immediately above (RESEARCH.md §Pitfall 6).
  if (obj.loaderMode === undefined) {
    obj.loaderMode = 'auto';
  }
  if (obj.loaderMode !== 'auto' && obj.loaderMode !== 'atlas-less') {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: "loaderMode is not 'auto' | 'atlas-less'" },
    };
  }
```

#### B. Mixed object-shape guard + per-key value validation (`overrides`, lines 136-141 + 264-278)

```typescript
  if (!obj.overrides || typeof obj.overrides !== 'object' || Array.isArray(obj.overrides)) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'overrides is not an object' },
    };
  }
  // ...
  for (const [k, v] of Object.entries(obj.overrides as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `overrides.${k} is not a finite number`,
        },
      };
    }
  }
```

**Mirror for `overridesAtlasLess`:** add after the existing `overrides` per-key validation loop (around line 278):

```typescript
  // Phase 36 SEED-007 L-01 forward-compat — v1.3.x/v1.4.x .stmproj files have
  // no `overridesAtlasLess` field; default to {} so legacy projects load with
  // an empty atlas-less bucket. Legacy single-map routing per SEED-007 Decision
  // 2-A happens at the Open seam in src/main/project-io.ts — by the time the
  // file reaches the validator the legacy map either was already routed (Open
  // pre-flight) or stays in `overrides` (validator is the inner gate).
  // Mirrors loaderMode pre-massage at lines 176-188 above.
  if (obj.overridesAtlasLess === undefined) {
    obj.overridesAtlasLess = {};
  }
  if (
    !obj.overridesAtlasLess
    || typeof obj.overridesAtlasLess !== 'object'
    || Array.isArray(obj.overridesAtlasLess)
  ) {
    return {
      ok: false,
      error: { kind: 'invalid-shape', message: 'overridesAtlasLess is not an object' },
    };
  }
  for (const [k, v] of Object.entries(obj.overridesAtlasLess as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return {
        ok: false,
        error: {
          kind: 'invalid-shape',
          message: `overridesAtlasLess.${k} is not a finite number`,
        },
      };
    }
  }
```

#### C. Serializer pattern (lines 319-345 — `serializeProjectFile`)

```typescript
export function serializeProjectFile(
  state: AppSessionState,
  projectFilePath: string,
): ProjectFileV1 {
  const basedir = path.dirname(projectFilePath);
  return {
    version: 1,
    skeletonPath: relativizePath(state.skeletonPath, basedir),
    atlasPath: state.atlasPath !== null ? relativizePath(state.atlasPath, basedir) : null,
    imagesDir: state.imagesDir !== null ? relativizePath(state.imagesDir, basedir) : null,
    overrides: { ...state.overrides },
    samplingHz: state.samplingHz,
    // ...
    loaderMode: state.loaderMode,
    sharpenOnExport: state.sharpenOnExport,
    safetyBufferPercent: state.safetyBufferPercent,
  };
}
```

**Mirror for `overridesAtlasLess`:** add `overridesAtlasLess: { ...state.overridesAtlasLess },` immediately after the existing `overrides: { ...state.overrides },` line (line 329).

#### D. Materializer pattern (`materializeProjectFile`, lines 441-489) + `PartialMaterialized` shape (lines 364-431)

```typescript
  return {
    // ...
    overrides: { ...file.overrides },
    samplingHz: file.samplingHz ?? 120,
    // ...
    sharpenOnExport: file.sharpenOnExport ?? false,
    safetyBufferPercent: file.safetyBufferPercent ?? 0,
    projectFilePath,
  };
```

**Mirror:** add `overridesAtlasLess: { ...file.overridesAtlasLess },` to the materializer return and add `overridesAtlasLess: Record<string, number>;` to the `PartialMaterialized` interface immediately after the existing `overrides: Record<string, number>;` slot at line 372.

**Departure notes:** Single-line mirror; no new logic. The legacy-routing logic (D-02 / L-02 / OVR-02) is **deliberately NOT here** — it lives at the Open seam in `project-io.ts`, see §3 below.

---

### 3. `src/main/project-io.ts` (IPC handler / main-process glue)

**Analog:** self — three existing `migrateOverrides` sites at lines 579, 873, 1074; recovery payload assembly at 479-491 and 794-807.

#### A. Existing `migrateOverrides` call pattern (lines 572-588 — Open seam)

```typescript
  // 9. Compute stale-override keys + migrate v1.3-era attachmentName-keyed
  //    overrides to v1.3.1 regionName keys (Phase 29 D-06; supersedes the
  //    D-150 stale-key intersect with a richer 3-pass migration — Case A
  //    region-keyed wins, Case B contributor-keyed migrates with lex-
  //    smallest-wins, Case C orphans drop into the existing stale-override
  //    banner). Dropped names travel as `staleOverrideKeys`; migrated count
  //    travels as `migratedKeyCount` for the new sibling banner.
  const { restored, stale, migratedKeyCount } = migrateOverrides(
    materialized.overrides as Record<string, unknown>,
    summary,
  );
```

**Mirror per OVR-04 + D-07:** at every one of the three sites (Open at ~579, recovery at ~873, resample at ~1074), replace the single call with two calls and sum/union the results. Also apply **legacy-routing decision (D-02 / L-02) at the Open seam only** — recovery and resample receive the buckets already-split from the renderer.

```typescript
  // Phase 36 SEED-007 L-02 — legacy single-map routing at the Open seam.
  // v1.3.x/v1.4.x files saved a single `overrides` map shared across modes;
  // the validator's pre-massage at src/core/project-file.ts substitutes {}
  // for missing `overridesAtlasLess`. When the legacy file's saved loaderMode
  // === 'atlas-less', the legacy single-map's intent was atlas-less; route
  // the entire map into the atlas-less bucket. Otherwise (`auto` / undefined)
  // the legacy map's intent was atlas-source; keep it in `overrides`.
  // The bucket NOT receiving the legacy map starts empty. Per SEED-007
  // Decision 2-A LOCKED 2026-05-12.
  //
  // Detection: a legacy v1.3.x/v1.4.x file is one where the pre-massage
  // substituted `overridesAtlasLess === {}` AND `overrides` has at least
  // one entry. We can't distinguish "legacy file" from "v1.5 file that
  // happens to have an empty atlas-less bucket"; the conservative rule is
  // that routing only matters when both conditions hold, and applying
  // the rule to a v1.5 file with the same shape is a no-op.
  const legacyMapPresent =
    Object.keys(materialized.overrides).length > 0
    && Object.keys(materialized.overridesAtlasLess).length === 0;
  const routeToAtlasLess =
    legacyMapPresent && materialized.loaderMode === 'atlas-less';

  const atlasSourceBucketInput = routeToAtlasLess ? {} : materialized.overrides;
  const atlasLessBucketInput = routeToAtlasLess
    ? materialized.overrides
    : materialized.overridesAtlasLess;

  // Per-bucket migration against the shared mode-invariant summary.regions
  // (REGION-05 skin-manifest pass — JSON-only, identical for both modes).
  // OVR-04: migratedKeyCount sums; staleOverrideKeys union.
  const aSrc = migrateOverrides(atlasSourceBucketInput as Record<string, unknown>, summary);
  const aLess = migrateOverrides(atlasLessBucketInput as Record<string, unknown>, summary);
  const restoredAtlasSource = aSrc.restored;
  const restoredAtlasLess = aLess.restored;
  const stale = [...new Set([...aSrc.stale, ...aLess.stale])]; // D-06 union
  const migratedKeyCount = aSrc.migratedKeyCount + aLess.migratedKeyCount; // D-07 sum
```

Then update the `MaterializedProject` assembly (line 584+):

```typescript
  const project: MaterializedProject = {
    summary,
    restoredOverrides: restoredAtlasSource,             // existing field, now atlas-source slice
    restoredOverridesAtlasLess: restoredAtlasLess,      // NEW field per OVR-04
    staleOverrideKeys: stale,
    migratedKeyCount,
    // ...
  };
```

#### B. Recovery payload assembly (lines 479-491 — failed-Open rescue)

```typescript
      return {
        ok: false,
        error: {
          kind: 'SkeletonNotFoundOnLoadError',
          message: err.message,
          projectPath: absolutePath,
          originalSkeletonPath: materialized.skeletonPath,
          mergedOverrides: materialized.overrides,          // <-- RENAME
          samplingHz: materialized.samplingHz,
          lastOutDir: materialized.lastOutDir,
          sortColumn: materialized.sortColumn,
          sortDir: materialized.sortDir,
        },
      };
```

**Mirror per D-12:** rename to `mergedOverridesBuckets` and carry both buckets:

```typescript
          mergedOverridesBuckets: {
            overrides: materialized.overrides,
            overridesAtlasLess: materialized.overridesAtlasLess,
          },
```

Identical change at the second rescue site (lines 794-807 inside `handleProjectReloadWithSkeleton`).

#### C. `handleProjectReloadWithSkeleton` recovery validator (lines 726-731)

```typescript
  if (!a.mergedOverrides || typeof a.mergedOverrides !== 'object') {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'mergedOverrides must be a Record' },
    };
  }
```

**Mirror per D-12:** rename and validate both buckets are Records:

```typescript
  if (
    !a.mergedOverridesBuckets
    || typeof a.mergedOverridesBuckets !== 'object'
    || !(a.mergedOverridesBuckets as Record<string, unknown>).overrides
    || !(a.mergedOverridesBuckets as Record<string, unknown>).overridesAtlasLess
  ) {
    return {
      ok: false,
      error: { kind: 'Unknown', message: 'mergedOverridesBuckets must carry both buckets' },
    };
  }
```

Then in the migration call (line 873-876), per-bucket migrate as in §3A, and update the `MaterializedProject` assembly at 878-906 + 1079-1126 (resample seam) similarly.

#### D. `MaterializedProject` field add (shared/types.ts) — sibling to `restoredOverrides`

Mirror line 1061 (`restoredOverrides: Record<string, number>;`):

```typescript
  restoredOverrides: Record<string, number>;
  /**
   * Phase 36 SEED-007 L-02 — atlas-less bucket of overrides intersected
   * against the resampled summary (mirrors `restoredOverrides` line above).
   * Per-bucket migration ran main-side at the Open / recovery / resample
   * seams; stale keys (`staleOverrideKeys`) are unioned across buckets;
   * `migratedKeyCount` is the sum across buckets (D-07 IPC contract — single
   * scalar, no per-bucket label needed at the renderer banner surface).
   */
  restoredOverridesAtlasLess: Record<string, number>;
```

**Departure notes:** Legacy-routing logic at the Open seam ONLY (D-02 — main-process gating; recovery + resample receive pre-split buckets from the renderer). Banner aggregates remain single scalars per D-05 / D-06 / D-07 — renderer banner code is **untouched**.

---

### 4. `src/main/override-migration.ts` (service helper, pure-TS)

**Analog:** self — body **unchanged**. Only the call count changes (1 → 2) from `project-io.ts`.

**Signature for the planner to reference (lines 92-95):**

```typescript
export function migrateOverrides(
  savedOverrides: Record<string, unknown>,
  summary: SkeletonSummary,
): OverrideMigrationResult {
```

**Return type (lines 49-62):**

```typescript
export interface OverrideMigrationResult {
  restored: Record<string, number>;
  stale: string[];
  migratedKeyCount: number;
}
```

**Departure notes:** Zero changes to this file. Called twice from `project-io.ts` (per-bucket); results summed/unioned at the call sites. The two-pass determinism (Pass 1 / Pass 2 / Pass 3) and the falsifying-regression Test 6 stay intact and **also gate the per-bucket behavior** — running twice on the same `summary.regions` is identical to running once (the helper is stateless).

---

### 5. `src/renderer/src/components/AppShell.tsx` (renderer state container)

This file holds the bulk of the diff. There are eight distinct excerpt regions to mirror (revised 2026-05-13 to be exhaustive).

#### Exhaustive read-site inventory (post-checker-review 2026-05-13)

Before quoting individual sub-patterns, here is the complete inventory of every place in `AppShell.tsx` where `overrides` (or its setter `setOverrides`) is referenced. Each row MUST be addressed by the executor; missing any one causes a per-mode data-leak or data-loss bug.

**ALL `setOverrides(new Map(Object.entries(...))`) hydration sites — THREE TOTAL:**

| Site | Approx. line | Context | `resp.project.` or `project.` source? | Mirror call to add |
|------|--------------|---------|----------------------------------------|--------------------|
| 1 | **1099** | `runReload` reset inside the locate-skeleton recovery `reloadProjectWithSkeleton` response handler | `resp.project.restoredOverrides` | `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})));` |
| 2 | **1239** | `mountOpenResponse` callback — fires on every Open / Save As / programmatic project mount | `project.restoredOverrides` | `setOverridesAtlasLess(new Map(Object.entries(project.restoredOverridesAtlasLess ?? {})));` |
| 3 | **1542** | `samplingHz-change resample useEffect` (lines 1497-1572) — fires whenever `samplingHzLocal` or `loaderMode` changes; calls `window.api.resampleProject(...)` then re-mounts the response. **MISSED IN ORIGINAL PLAN — caught by checker 2026-05-13.** | `resp.project.restoredOverrides` | `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})));` |

**Acceptance criteria guard:** `grep -c "setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess" src/renderer/src/components/AppShell.tsx` must return ≥ 2 (covers sites 1 + 3 — both use `resp.project.`; site 2 uses the bare `project.` parameter variable and is caught by the broader `grep -c 'setOverridesAtlasLess' ≥ 5` audit).

**ALL `overrides`-consuming JSX prop mounts — THREE TOTAL:**

| Mount | Approx. line | Component | Prop name | Original value | Target value |
|-------|--------------|-----------|-----------|----------------|--------------|
| 1 | **~2045** | `<GlobalMaxRenderPanel>` | `overrides` | `overrides` | `activeOverrides` |
| 2 | **~2064** | `<AnimationBreakdownPanel>` | `overrides` | `overrides` | `activeOverrides` |
| 3 | **2138** | `<AtlasPreviewModal>` (inside `{atlasPreviewOpen && (...)}` conditional at lines 2134-2144) | `overrides` | `overrides` | `activeOverrides` | **MISSED IN ORIGINAL PLAN — caught by checker 2026-05-13.** Modal would render atlas-source bucket regardless of active mode → wrong optimization plan in atlas-less mode. |

**ALL `buildExportPlan(summary, ..., ...)` library call sites — FOUR TOTAL:** at lines 639, 761, 875, 970. All four pass `overrides` as the second argument and must change to `activeOverrides`. Dep arrays update accordingly.

**ALL `buildAtlasPreview` library / preview-state useMemo call sites — TWO TOTAL:** at lines 855-863 + 875. Read `overrides`; change to `activeOverrides`. **Distinct from the JSX prop mount at line 2138** — the library calls produce a snapshotted preview state that gets passed alongside the modal mount.

**ALL `Object.fromEntries(overrides)` IPC payload sites — TWO TOTAL:** at lines 1082 (runReload IPC payload) + 1513 (samplingHz-change resample IPC payload). Change to `Object.fromEntries(activeOverrides)`. IPC schema stays single-Record; the inactive bucket is preserved untouched on the renderer side.

**ALL `Object.fromEntries(overrides)` Save serializer sites — ONE:** at line 806 (Save / Save As). Add sibling `overridesAtlasLess: Object.fromEntries(overridesAtlasLess),`.

**ALL `lastSaved` snapshot sites — FOUR TOTAL:** state init (363-377) + onClickSave (~997) + onClickSaveAs (~1038) + mountOpenResponse (~1241). All must carry the new `overridesAtlasLess` field.

**Dirty-derivation sites — TWO TOTAL:** untitled-session check (line 914) + saved-session check (lines 920-932). Both must extend to include the atlas-less bucket.

**OverrideDialog handler sites — THREE TOTAL:** `onOpenOverrideDialog` reads at lines 564 + 579 → `activeOverrides`; `onApplyOverride` (585-597) → `setActive` ternary; `onClearOverride` (599-607) → `setActive` ternary.

Sub-patterns A through H below give the verbatim code excerpts for each region.

#### A. State init — single `overrides` Map (lines 343-345)

```typescript
  const [overrides, setOverrides] = useState<Map<string, number>>(
    () => new Map(initialProject ? Object.entries(initialProject.restoredOverrides) : []),
  );
```

**Mirror per D-13:** preserve the existing `overrides` line verbatim (semantically now the atlas-source bucket), then add a sibling `overridesAtlasLess` Map immediately below:

```typescript
  // Phase 36 SEED-007 L-01 — atlas-source bucket. Preserve the variable name
  // (existing references throughout the file referred to atlas-source intent
  // pre-Phase-36; semantic shift is no-op).
  const [overrides, setOverrides] = useState<Map<string, number>>(
    () => new Map(initialProject ? Object.entries(initialProject.restoredOverrides) : []),
  );
  // Phase 36 SEED-007 L-01 — atlas-less bucket. Seeded from
  // initialProject.restoredOverridesAtlasLess on Open (Pitfall 3 boundary:
  // Object → Map at the IPC seam). Strict mode-separation per
  // project_strict_loadermode_separation (locked 2026-05-06).
  const [overridesAtlasLess, setOverridesAtlasLess] = useState<Map<string, number>>(
    () => new Map(initialProject ? Object.entries(initialProject.restoredOverridesAtlasLess ?? {}) : []),
  );
```

#### B. Active-slice derivation (D-14 — new)

**Analog:** no exact analog in-file, but the `effectiveLoaderMode` pattern at lines 790-793 is the closest precedent for a memo that derives one state slot from another:

```typescript
      const effectiveLoaderMode: 'auto' | 'atlas-less' =
        loaderMode === 'atlas-less' || summary.atlasPath === null
          ? 'atlas-less'
          : 'auto';
```

**Mirror per D-14:** add immediately AFTER the `overridesAtlasLess` state init (so all readers below can reference `activeOverrides`):

```typescript
  // Phase 36 D-14 — active-mode slice. Read by the 4 buildExportPlan call
  // sites, the OverrideDialog apply/clear handlers (D-08, D-10), the two
  // panel mounts, AND the <AtlasPreviewModal> JSX prop mount at line 2138.
  // Panel + modal prop signatures unchanged per OVR-05 — they still receive
  // `overrides` but the slice that crosses the prop boundary is mode-aware.
  // Atlas-source mode (auto / undefined-loaderMode legacy) reads the
  // preserved `overrides` Map; atlas-less mode reads `overridesAtlasLess`.
  const activeOverrides = useMemo(
    () => (loaderMode === 'atlas-less' ? overridesAtlasLess : overrides),
    [loaderMode, overrides, overridesAtlasLess],
  );
```

#### C. `lastSaved` dirty-snapshot extension (D-11) — lines 363-377

```typescript
  const [lastSaved, setLastSaved] = useState<{
    overrides: Record<string, number>;
    samplingHz: number;
    sharpenOnExport: boolean;
    safetyBufferPercent: number;
  } | null>(
    initialProject
      ? {
          overrides: { ...initialProject.restoredOverrides },
          samplingHz: initialProject.samplingHz,
          sharpenOnExport: initialProject.sharpenOnExport ?? false,
          safetyBufferPercent: initialProject.safetyBufferPercent ?? 0,
        }
      : null,
  );
```

**Mirror per D-11:** add `overridesAtlasLess` slot alongside `overrides`:

```typescript
  const [lastSaved, setLastSaved] = useState<{
    overrides: Record<string, number>;
    overridesAtlasLess: Record<string, number>;     // NEW per D-11
    samplingHz: number;
    sharpenOnExport: boolean;
    safetyBufferPercent: number;
  } | null>(
    initialProject
      ? {
          overrides: { ...initialProject.restoredOverrides },
          overridesAtlasLess: { ...(initialProject.restoredOverridesAtlasLess ?? {}) },
          samplingHz: initialProject.samplingHz,
          sharpenOnExport: initialProject.sharpenOnExport ?? false,
          safetyBufferPercent: initialProject.safetyBufferPercent ?? 0,
        }
      : null,
  );
```

Also extend the dirty derivation at lines 920-932:

```typescript
    if (overrides.size !== Object.keys(lastSaved.overrides).length) return true;
    for (const [k, v] of overrides) {
      if (lastSaved.overrides[k] !== v) return true;
    }
    if (samplingHzLocal !== lastSaved.samplingHz) return true;
    if (sharpenOnExportLocal !== lastSaved.sharpenOnExport) return true;
    if (safetyBufferPercentLocal !== lastSaved.safetyBufferPercent) return true;
    return false;
```

Mirror the `overrides` size+entries comparison for `overridesAtlasLess`:

```typescript
    if (overridesAtlasLess.size !== Object.keys(lastSaved.overridesAtlasLess).length) return true;
    for (const [k, v] of overridesAtlasLess) {
      if (lastSaved.overridesAtlasLess[k] !== v) return true;
    }
```

Also extend the untitled-session dirty check (line 914 — `if (overrides.size > 0) return true;`):

```typescript
      if (overrides.size > 0) return true;
      if (overridesAtlasLess.size > 0) return true;        // NEW per D-11
```

#### D. `skeletonNotFoundError` state slot rename (D-12) — lines 428-437

```typescript
  const [skeletonNotFoundError, setSkeletonNotFoundError] = useState<{
    message: string;
    originalSkeletonPath: string;
    projectPath: string;
    mergedOverrides: Record<string, number>;          // <-- RENAME per D-12
    cachedSamplingHz: number;
    cachedLastOutDir: string | null;
    cachedSortColumn: string | null;
    cachedSortDir: 'asc' | 'desc' | null;
  } | null>(null);
```

**Mirror per D-12:** rename `mergedOverrides` → `mergedOverridesBuckets`:

```typescript
    mergedOverridesBuckets: {
      overrides: Record<string, number>;
      overridesAtlasLess: Record<string, number>;
    };
```

Then update the locate-skeleton handler at lines 1298-1329 (where the state is read) and the App.tsx mirror at lines 183-217 (drag-drop recovery arm). Per `App.tsx:190` excerpt:

```typescript
    const resp = await window.api.reloadProjectWithSkeleton({
      projectPath: state.error.projectPath,
      newSkeletonPath: located.newPath,
      mergedOverrides: state.error.mergedOverrides,
      samplingHz: state.error.samplingHz,
      // ...
    });
```

**Mirror:**

```typescript
      mergedOverridesBuckets: state.error.mergedOverridesBuckets,
```

#### E. OverrideDialog handler — active-slice write (D-08 + D-10) — lines 520-607

The `onOpenOverrideDialog` handler (lines 520-583) reads from `overrides.get(rowKey)` and `overrides.has(name)` (lines 564, 579). The `onApplyOverride` handler (lines 585-597) and `onClearOverride` (lines 599-607) write to `setOverrides`:

```typescript
  const onApplyOverride = useCallback((scope: string[], percent: number) => {
    const clamped = clampOverride(percent);
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const name of scope) next.set(name, clamped);
      return next;
    });
    setDialogState(null);
  }, []);

  const onClearOverride = useCallback((scope: string[]) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const name of scope) next.delete(name);
      return next;
    });
    setDialogState(null);
  }, []);
```

**Mirror per D-08 + D-10 (active-bucket-only writes):** route the read/write through the active slice. Two options — pick (a):

```typescript
  // (a) Branch in the handler body (simplest, no API surface change):
  const onApplyOverride = useCallback((scope: string[], percent: number) => {
    const clamped = clampOverride(percent);
    const setActive = loaderMode === 'atlas-less' ? setOverridesAtlasLess : setOverrides;
    setActive((prev) => {
      const next = new Map(prev);
      for (const name of scope) next.set(name, clamped);
      return next;
    });
    setDialogState(null);
  }, [loaderMode]);
```

Update `onOpenOverrideDialog`'s read sites (lines 564 + 579):

```typescript
        const stored = activeOverrides.get(rowKey);
        // ...
      const anyOverridden = scope.some((name) => activeOverrides.has(name));
```

Add `activeOverrides` to the `useCallback` dependency array (line 582: `[overrides]` → `[activeOverrides]`).

#### F. All `overrides`-consuming reads — split into F.1..F.4 (post-checker-review 2026-05-13)

##### F.1. The 4 `buildExportPlan` call sites — read `activeOverrides` (D-14)

The four sites (lines 639, 761, 875, 970) all pass `overrides` as the second arg:

```typescript
    const plan = buildExportPlan(summary, overrides, {
      safetyBufferPercent: safetyBufferPercentLocal,
    });
```

**Mirror per OVR-05 + D-14:** change `overrides` → `activeOverrides` at all four sites. `buildExportPlan` signature unchanged (still accepts `Map<string, number>`). Also update the dep arrays accordingly (e.g. line 643: `[summary, overrides, lastOutDir, safetyBufferPercentLocal]` → `[summary, activeOverrides, lastOutDir, safetyBufferPercentLocal]`).

##### F.2. Atlas-preview library wirings (lines 855-863 + 875)

The `buildAtlasPreview` library calls + the `atlasPreviewState` useMemo consume `overrides` to compute the preview state passed alongside the modal mount. Change to `activeOverrides`.

##### F.3. `<AtlasPreviewModal>` JSX prop mount (line 2138, inside the `{atlasPreviewOpen && (...)}` conditional at lines 2134-2144) — **DISTINCT FROM F.2** (post-checker-review 2026-05-13)

Existing JSX at line 2138:

```typescript
      {atlasPreviewOpen && (
        <AtlasPreviewModal
          open={true}
          summary={effectiveSummary}
          overrides={overrides}                       // <-- LINE 2138: SWAP
          onJumpToRegion={onJumpToRegion}
          onClose={() => setAtlasPreviewOpen(false)}
          onOpenOptimizeDialog={onClickOptimize}
          safetyBufferPercent={safetyBufferPercentLocal}
        />
      )}
```

**Mirror:** swap the JSX prop value from `overrides={overrides}` to `overrides={activeOverrides}`:

```typescript
      {atlasPreviewOpen && (
        <AtlasPreviewModal
          open={true}
          summary={effectiveSummary}
          overrides={activeOverrides}                 // <-- post-Phase-36
          onJumpToRegion={onJumpToRegion}
          onClose={() => setAtlasPreviewOpen(false)}
          onOpenOptimizeDialog={onClickOptimize}
          safetyBufferPercent={safetyBufferPercentLocal}
        />
      )}
```

**Why this is distinct from F.2:** F.2 changes the `buildAtlasPreview` library call inputs (snapshot computation); F.3 changes the modal's prop value (what the modal's internal useMemo will snapshot on next open / mode toggle). Both must be active-slice. Missing F.3 means the modal renders the atlas-source bucket regardless of mode (silent data leak; wrong optimization plan in atlas-less mode). The acceptance criterion `grep -A 8 "atlasPreviewOpen &&" src/renderer/src/components/AppShell.tsx | grep "overrides={activeOverrides}"` audits this specific swap.

##### F.4. Resample IPC payloads (lines 1082, 1513)

Existing payload at both sites:

```typescript
        overrides: Object.fromEntries(overrides),
```

**Mirror:** change to `Object.fromEntries(activeOverrides)` per Pitfall 3 boundary (the IPC schema is still single-Record; resample is one-shot for the active bucket and the renderer's other bucket stays untouched).

Panel JSX prop mounts (`<GlobalMaxRenderPanel overrides={...} />` at ~2045 and `<AnimationBreakdownPanel overrides={...} />` at ~2064) similarly pass `activeOverrides` into the existing `overrides` prop slot — panel signatures unchanged per OVR-05.

#### G. Save serializer + `buildSessionState` + ALL THREE setOverrides hydration sites (post-checker-review 2026-05-13)

##### G.0. Save serializer (line 806)

The Save serializer at line 806 writes `overrides: Object.fromEntries(overrides)`:

```typescript
        overrides: Object.fromEntries(overrides),
```

**Mirror per OVR-05 Save-serializes-both-buckets:** add the sibling line:

```typescript
        overrides: Object.fromEntries(overrides),
        overridesAtlasLess: Object.fromEntries(overridesAtlasLess),
```

Also update `buildSessionState`'s dep array (lines 835-845): add `overridesAtlasLess` alongside `overrides`.

Three more places update `lastSaved` after a successful Save (lines 997-1002 onClickSave + 1038-1043 onClickSaveAs + 1240-1245 mountOpenResponse):

```typescript
        setLastSaved({
          overrides: { ...state.overrides },
          samplingHz: state.samplingHz ?? 120,
          sharpenOnExport: state.sharpenOnExport,
          safetyBufferPercent: state.safetyBufferPercent,
        });
```

**Mirror at all 3:**

```typescript
        setLastSaved({
          overrides: { ...state.overrides },
          overridesAtlasLess: { ...state.overridesAtlasLess },   // NEW per D-11
          samplingHz: state.samplingHz ?? 120,
          sharpenOnExport: state.sharpenOnExport,
          safetyBufferPercent: state.safetyBufferPercent,
        });
```

##### G.1. `runReload` reset (line 1099) — first `setOverrides` hydration site

Existing line 1099 inside the locate-skeleton recovery `reloadProjectWithSkeleton` response handler:

```typescript
    setOverrides(new Map(Object.entries(resp.project.restoredOverrides)));
```

**Mirror:** add the sibling line immediately AFTER:

```typescript
    setOverrides(new Map(Object.entries(resp.project.restoredOverrides)));
    setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})));
```

##### G.2. `mountOpenResponse` (line 1239) — second `setOverrides` hydration site

Inside `mountOpenResponse` (lines 1232-1279). Existing line 1239:

```typescript
    setOverrides(new Map(Object.entries(project.restoredOverrides)));
```

**Mirror:** add the sibling line immediately AFTER (note: this site uses the bare `project.` parameter variable, NOT `resp.project.`):

```typescript
    setOverrides(new Map(Object.entries(project.restoredOverrides)));
    setOverridesAtlasLess(new Map(Object.entries(project.restoredOverridesAtlasLess ?? {})));
```

##### G.3. `samplingHz-change resample useEffect` (line 1542) — THIRD `setOverrides` hydration site (post-checker-review 2026-05-13)

The samplingHz-change resample useEffect at lines 1497-1572 fires whenever `samplingHzLocal` or `loaderMode` changes; it calls `window.api.resampleProject(...)` and on `ok: true` (lines 1536-1569) re-mounts the response. Existing line 1542 inside the `if (resp.ok) { ... }` block:

```typescript
        setLocalSummary(resp.project.summary);
        setOverrides(new Map(Object.entries(resp.project.restoredOverrides)));
        setStaleOverrideNotice(...);
        // ...
```

**Mirror:** add the sibling line immediately AFTER the existing `setOverrides(...)` (symmetric to G.1's `runReload` site — both hydrate from a `resp.project` payload):

```typescript
        setLocalSummary(resp.project.summary);
        setOverrides(new Map(Object.entries(resp.project.restoredOverrides)));
        setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})));
        setStaleOverrideNotice(...);
        // ...
```

**Why this matters:** This useEffect fires on EVERY samplingHz change AND on every loaderMode change. Without the sibling hydration, every time the user changes samplingHz (or toggles loaderMode while a samplingHz response is pending), the atlas-less bucket would be wiped because the renderer's local `overridesAtlasLess` state is never re-mounted from the main-process response. The blocker per checker review 2026-05-13.

**Acceptance criterion specifically for G.1 + G.3 (both `resp.project.` shaped):** `grep -c "setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess" src/renderer/src/components/AppShell.tsx` must return ≥ 2.

#### H. Banner stack — new mode-toggle one-shot toast (D-01..D-04)

**Analog:** `loaderModeHealedNotice` state slot + JSX (lines 418-420 + 1983-2001):

State slot:

```typescript
  const [loaderModeHealedNotice, setLoaderModeHealedNotice] = useState<boolean>(
    initialProject?.loaderModeHealed === true,
  );
```

JSX:

```typescript
      {loaderModeHealedNotice && (
        <div
          role="status"
          className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
        >
          <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
          <span className="flex-1">
            Project file had an inconsistent loader-mode setting and was
            opened in atlas-source mode. Save again to fix the file on disk.
          </span>
          <button
            type="button"
            onClick={() => setLoaderModeHealedNotice(false)}
            className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
```

**Mirror for new mode-toggle toast (D-01..D-04):** new state slot reading from localStorage (one-shot suppression), trigger inside the `setLoaderMode` toggle handler at line 1798:

```typescript
  // Phase 36 D-01..D-04 — one-shot mode-toggle toast. Fires the first time
  // per session the user toggles loaderMode AND at least one bucket has
  // overrides (D-02 trigger). Suppressible per-machine via localStorage
  // (D-03 — `stm.overrideModeToast.suppressed === 'true'` blocks future
  // mounts). Auto-clears via the [Close] button.
  const [overrideModeToastVisible, setOverrideModeToastVisible] = useState(false);

  const onToggleLoaderMode = useCallback((next: 'auto' | 'atlas-less') => {
    setLoaderMode(next);
    setLoaderMenuOpen(false);
    // D-02 trigger: at least one bucket has overrides.
    const anyOverrides = overrides.size > 0 || overridesAtlasLess.size > 0;
    if (!anyOverrides) return;
    // D-03 suppression check (per-machine).
    try {
      if (localStorage.getItem('stm.overrideModeToast.suppressed') === 'true') return;
    } catch {
      // localStorage unavailable (e.g., jsdom in tests with no storage) — skip suppression check.
    }
    setOverrideModeToastVisible(true);
  }, [overrides.size, overridesAtlasLess.size]);
```

Rewire the toggle button at line 1797-1800:

```typescript
                    onClick={() => {
                      onToggleLoaderMode(effectiveSummary.atlasPath === null ? 'auto' : 'atlas-less');
                    }}
```

Add the JSX above the existing banner stack (after `loaderModeHealedNotice`'s JSX, before `skeletonNotFoundError`'s):

```typescript
      {/* Phase 36 D-01..D-04 — one-shot toast surfaced on first mode-toggle
          when either bucket has overrides. Verbatim copy from D-04; two
          actions: "Don't show again" persists to localStorage (D-03),
          "Close" dismisses for the session. Mirrors loaderModeHealedNotice
          surface above so the visual idiom is consistent. */}
      {overrideModeToastVisible && (
        <div
          role="status"
          className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
        >
          <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
          <span className="flex-1">
            Overrides are tracked per loader mode — atlas-source and atlas-less each have their own.
          </span>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('stm.overrideModeToast.suppressed', 'true');
              } catch {
                // localStorage unavailable — best-effort persistence.
              }
              setOverrideModeToastVisible(false);
            }}
            className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Don&apos;t show again
          </button>
          <button
            type="button"
            onClick={() => setOverrideModeToastVisible(false)}
            className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
```

#### Departure notes (revised 2026-05-13 — exhaustive read-site warning to future planners)

Two state hooks instead of one; `activeOverrides` `useMemo` derives the slice for downstream consumers. Panel + modal prop signatures unchanged — the active slice still crosses the prop boundary under the existing name `overrides`. New toast piggybacks on the existing banner-stack visual idiom (one-shot dismissible, role="status", same Tailwind class string).

**WARNING TO FUTURE PLANNERS:** the variable `overrides` in this file is referenced extensively. Specifically, `setOverrides(...)` appears in **6+ distinct sites** in `AppShell.tsx`:

1. State init (line 343-345) — kept; declared alongside new `setOverridesAtlasLess`.
2. `onApplyOverride` handler (~line 585) — routed through `setActive` ternary per D-08; can write to either bucket.
3. `onClearOverride` handler (~line 599) — same ternary as #2.
4. **`runReload` reset (~line 1099)** — needs sibling `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})))`.
5. **`mountOpenResponse` (~line 1239)** — needs sibling `setOverridesAtlasLess(new Map(Object.entries(project.restoredOverridesAtlasLess ?? {})))`.
6. **`samplingHz-change resample useEffect` (~line 1542)** — needs sibling `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})))`. **CAUGHT BY CHECKER 2026-05-13 — originally missed.**

Any future feature that adds a new `setOverrides(...)` call site MUST add a sibling `setOverridesAtlasLess(...)` call OR justify the omission (e.g., an active-bucket-only write path that explicitly should not touch the inactive bucket). The phase 36-03 acceptance criterion `grep -c 'setOverridesAtlasLess' src/renderer/src/components/AppShell.tsx ≥ 5` plus the targeted `grep -c "setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess" ≥ 2` audit are the regression sentinels.

Similarly, `overrides` is consumed by **three JSX prop mounts** (NOT just two as the original §5 implied):

1. `<GlobalMaxRenderPanel overrides={...} />` at line ~2045 → `activeOverrides`.
2. `<AnimationBreakdownPanel overrides={...} />` at line ~2064 → `activeOverrides`.
3. **`<AtlasPreviewModal overrides={...} />` at line 2138** (inside conditional `{atlasPreviewOpen && (...)}` mount, lines 2134-2144) → `activeOverrides`. **CAUGHT BY CHECKER 2026-05-13 — originally missed; the original plan lumped this with the F.2 library wirings.**

Any future feature that mounts a new `<*Modal overrides={...} />` or `<*Panel overrides={...} />` consumer MUST pass `activeOverrides`, not `overrides`, unless there's an explicit reason to render the atlas-source bucket regardless of mode (no such reason exists today).

All 11 read sites of `overrides` in the file get evaluated: writes (Save / Apply / Clear / mountOpenResponse / runReload / samplingHz-resample) route to active or both; reads (panels + AtlasPreviewModal + buildExportPlan + buildAtlasPreview + IPC resample payloads) route to active.

---

### 6. & 7. `GlobalMaxRenderPanel.tsx` + `AnimationBreakdownPanel.tsx`

**Not modified.** Per OVR-05 + D-13/D-14: the panels still receive `overrides: Map<string, number>` as a prop. AppShell passes `activeOverrides` (the memoized slice) into the existing `overrides={...}` prop slot. The panels are entirely mode-agnostic.

---

### 8. `tests/main/override-migration.spec.ts` (unit test)

**Analog:** self — Test 6 falsifying regression (lines 266-293) + `makeSummary`/`makePeak`/`deriveRegionsFromPeaks` helpers (lines 36-100).

#### Existing test setup pattern (lines 36-65)

```typescript
function makePeak(attachmentName: string, regionName?: string): DisplayRow {
  return {
    attachmentKey: `default/SLOT/${attachmentName}`,
    skinName: 'default',
    slotName: 'SLOT',
    attachmentName,
    animationName: 'PATH',
    time: 0,
    frame: 0,
    peakScale: 1,
    // ... rest stubbed ...
    regionName: regionName ?? attachmentName,
  };
}
```

#### Existing assertion shape (Test 6, lines 277-293)

```typescript
    // Insertion order A: contributor first, region second.
    const savedA = { '5/5/5/7/7': 30, '5/7': 50 };
    const resA = migrateOverrides(savedA, summary);
    expect(resA.restored).toEqual({ '5/7': 50 });
    expect(resA.stale).toEqual([]);
    expect(resA.migratedKeyCount).toBe(1);
```

**New tests per OVR-06:**

```typescript
  it('Test 10 (Phase 36 OVR-04): per-bucket migration runs independently against shared summary.regions', () => {
    // Atlas-source bucket has CIRCLE override; atlas-less bucket has SQUARE
    // override. Both regions exist in summary.regions. Per-bucket migration
    // produces identical results to running each in isolation.
    const summary = makeSummary([makePeak('CIRCLE'), makePeak('SQUARE')]);
    const aSrc = migrateOverrides({ CIRCLE: 75 }, summary);
    const aLess = migrateOverrides({ SQUARE: 50 }, summary);
    expect(aSrc.restored).toEqual({ CIRCLE: 75 });
    expect(aSrc.stale).toEqual([]);
    expect(aLess.restored).toEqual({ SQUARE: 50 });
    expect(aLess.stale).toEqual([]);
    // OVR-04 sum semantics:
    expect(aSrc.migratedKeyCount + aLess.migratedKeyCount).toBe(0);
    // OVR-04 union semantics:
    expect([...new Set([...aSrc.stale, ...aLess.stale])]).toEqual([]);
  });

  it('Test 11 (Phase 36 OVR-04): stale keys union across buckets (Case C orphans in both)', () => {
    const summary = makeSummary([makePeak('CIRCLE')]);
    const aSrc = migrateOverrides({ ORPHAN_A: 25 }, summary);
    const aLess = migrateOverrides({ ORPHAN_B: 50 }, summary);
    expect(aSrc.stale).toEqual(['ORPHAN_A']);
    expect(aLess.stale).toEqual(['ORPHAN_B']);
    const union = [...new Set([...aSrc.stale, ...aLess.stale])];
    expect(union.sort()).toEqual(['ORPHAN_A', 'ORPHAN_B']);
  });
```

**Departure notes:** Tests stay at the pure-helper level (no `migrateOverrides` body change). Per-bucket coverage = run helper twice with different inputs against the same `summary`. Legacy-routing fixture (the OVR-02 test) belongs at the `project-io.ts` integration test layer if one exists; this file proves the per-bucket math.

---

### 9. `tests/core/project-file.spec.ts` (unit test)

**Analog:** self — `loaderMode` round-trip test (lines 322-385) + `sharpenOnExport` pre-massage test (lines 388-409).

#### Existing pre-massage test pattern (lines 322-342 — `loaderMode`)

```typescript
describe('Phase 21 — loaderMode (D-08)', () => {
  it('validateProjectFile pre-massages missing loaderMode to "auto" (forward-compat for Phase 8/20-era files)', () => {
    const legacy: Record<string, unknown> = {
      version: 1,
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: {},
      // loaderMode INTENTIONALLY ABSENT (Phase 8/20-era shape)
    };
    const result = validateProjectFile(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.project as ProjectFileV1).loaderMode).toBe('auto');
    }
  });
```

#### Existing round-trip test pattern (lines 366-385)

```typescript
  it('serialize → materialize round-trips loaderMode: "atlas-less" identically', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null,
      imagesDir: null,
      overrides: {},
      samplingHz: 120,
      lastOutDir: null,
      sortColumn: null,
      sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'atlas-less',
      sharpenOnExport: false,
      safetyBufferPercent: 0,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.loaderMode).toBe('atlas-less');
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.loaderMode).toBe('atlas-less');
  });
```

**New tests per OVR-06:** Add at the end of the file:

```typescript
describe('Phase 36 — overridesAtlasLess (SEED-007 L-01)', () => {
  it('validateProjectFile pre-massages missing overridesAtlasLess to {} (forward-compat for v1.3.x/v1.4.x files)', () => {
    const legacy: Record<string, unknown> = {
      version: 1,
      skeletonPath: '/abs/rig.json',
      atlasPath: null, imagesDir: null,
      overrides: { CIRCLE: 75 },
      samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null,
      documentation: {},
      loaderMode: 'auto',
      sharpenOnExport: false,
      safetyBufferPercent: 0,
      // overridesAtlasLess INTENTIONALLY ABSENT (v1.3.x/v1.4.x shape)
    };
    const result = validateProjectFile(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.project as ProjectFileV1).overridesAtlasLess).toEqual({});
    }
  });

  it('serialize → materialize round-trips both buckets losslessly', () => {
    const session: AppSessionState = {
      skeletonPath: '/abs/rig.json',
      atlasPath: null, imagesDir: null,
      overrides: { CIRCLE: 75 },
      overridesAtlasLess: { SQUARE: 50 },
      samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null,
      documentation: { ...DEFAULT_DOCUMENTATION },
      loaderMode: 'atlas-less',
      sharpenOnExport: false,
      safetyBufferPercent: 0,
    };
    const serialized = serializeProjectFile(session, '/abs/project.stmproj');
    expect(serialized.overrides).toEqual({ CIRCLE: 75 });
    expect(serialized.overridesAtlasLess).toEqual({ SQUARE: 50 });
    const materialized = materializeProjectFile(serialized, '/abs/project.stmproj');
    expect(materialized.overrides).toEqual({ CIRCLE: 75 });
    expect(materialized.overridesAtlasLess).toEqual({ SQUARE: 50 });
  });
});
```

**Departure notes:** Mirror precedent verbatim. Update every existing `AppSessionState` literal in this file (lines 113-180 + 200-208 + 270-280 + 308-316 + 366-380) to include the new `overridesAtlasLess: {}` field — otherwise TypeScript widens the literal to `AppSessionState` and fails to compile.

---

### 10. `tests/renderer/appshell-mode-switch-divergence.spec.tsx` (NEW)

**Analog:** `tests/renderer/override-migration-banner.spec.tsx` — closest match for AppShell-mounted RTL test. Same pattern (`vi.stubGlobal('api', ...)` IPC stub + `render(<AppShell initialProject={...} />)`).

#### Existing scaffolding pattern (lines 59-107 + 109-138)

```typescript
beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    openProject: vi.fn(),
    // ... 30+ more IPC stubs, all returning vi.fn() or vi.fn().mockResolvedValue(...) ...
  });
});

describe('Phase 29 D-06 — override migration banner (sibling to staleOverrideNotice)', () => {
  it('renders banner with plural copy when migratedKeyCount > 1', () => {
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={
          {
            summary,
            restoredOverrides: { CIRCLE: 50 },
            staleOverrideKeys: [],
            migratedKeyCount: 3,
            samplingHz: 120,
            lastOutDir: null,
            sortColumn: null,
            sortDir: null,
            projectFilePath: '/a/b/proj.stmproj',
            documentation: DEFAULT_DOCUMENTATION,
          } as unknown as OpenResponse extends { ok: true; project: infer P } ? P : never
        }
      />,
    );
    // ...
  });
});
```

**New test file per OVR-07:** Copy the scaffolding wholesale; replace the test bodies with the divergence assertions:

```typescript
// @vitest-environment jsdom
/**
 * Phase 36 OVR-07 — AppShell mode-switch divergence test.
 *
 * Three tests:
 * 1. Apply override in atlas-source, switch to atlas-less, assert atlas-less
 *    bucket is empty (no leak).
 * 2. Apply in atlas-less, switch to atlas-source, assert atlas-source bucket
 *    retains its pre-switch value (no overwrite).
 * 3. (NEW per checker review 2026-05-13) Apply in atlas-less, switch to
 *    atlas-source, change samplingHz (triggers AppShell.tsx:1542 resample
 *    useEffect), switch back to atlas-less — atlas-less bucket preserved.
 *    Regression catcher for the line-1542 hydration-site blocker.
 *
 * Mode-toggle is exposed via the toolbar's "Use Images Folder as Source" /
 * "Use Atlas as Source" button (AppShell.tsx:1797). Override application
 * goes through OverrideDialog (mounted via onOpenOverrideDialog).
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary, SaveResponse } from '../../src/shared/types';
import { DEFAULT_DOCUMENTATION } from '../../src/shared/types';

afterEach(cleanup);

// Copy makeSummary() from override-migration-banner.spec.tsx lines 33-57.
function makeSummary(): SkeletonSummary {
  // ... (identical to the existing override-migration-banner.spec.tsx helper) ...
}

// Copy the full vi.stubGlobal('api', ...) block from override-migration-banner.spec.tsx lines 59-107.
beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    // ... full IPC stub set ...
    // For Test 3, re-configure resampleProject per-test via vi.mocked(...) or .mockResolvedValueOnce(...).
  });
});

describe('Phase 36 OVR-07 — AppShell mode-switch divergence', () => {
  it('atlas-source override does NOT leak into atlas-less bucket when toggling modes', async () => {
    // ... (full body — see 36-05-PLAN.md Task 1 Step 2) ...
  });

  it('atlas-less override does NOT overwrite atlas-source bucket when toggling modes', async () => {
    // ... (full body — see 36-05-PLAN.md Task 1 Step 3) ...
  });

  it('samplingHz change preserves the inactive-mode bucket (regression catcher for AppShell.tsx:1542 hydration site, per blocker review 2026-05-13)', async () => {
    // 1. Stub resampleProject to return a tailored response that includes
    //    restoredOverridesAtlasLess populated so the renderer's post-Plan-36-03
    //    line-1542 sibling hydration can prove it fires.
    // 2. Mount with restoredOverridesAtlasLess: { CIRCLE: 75 }, loaderMode: 'auto'.
    // 3. Toggle atlas-less; confirm CIRCLE shows 75%.
    // 4. Toggle back to atlas-source.
    // 5. Change samplingHz to 60 (triggers the line-1542 useEffect).
    // 6. Toggle back to atlas-less.
    // 7. Assert CIRCLE still shows 75% — the atlas-less bucket survived the
    //    samplingHz-change resample response. If line 1542's sibling hydration
    //    were missing, this would FAIL (atlas-less bucket would be empty).
    // ... (full body — see 36-05-PLAN.md Task 1 Step 4) ...
  });
});
```

**Departure notes:** Closest analog is `override-migration-banner.spec.tsx` (full AppShell mount with `initialProject` literal cast). The new test exercises user interactions through RTL `userEvent` and asserts bucket independence at the DOM level. The test scaffolding (mocks + helpers) is **copy-and-paste** from the analog; only the assertion bodies differ. Notable: the `loaderMode` toggle button text is dynamic ("Use Images Folder as Source" vs. "Use Atlas as Source") — the test queries by partial match or `aria-label`. If finer-grained simulation is needed, fall back to exposing a `data-testid` on the toggle button or driving via the underlying `setLoaderMode` indirectly. **Test 3 specifically requires `vi.mocked(window.api.resampleProject).mockResolvedValueOnce(...)` (or equivalent) to seed the response payload's `restoredOverridesAtlasLess` field — otherwise the renderer's hydration branch can't be exercised.**

---

## Shared Patterns

### Pitfall 3 boundary (renderer↔IPC conversions)

**Source:** repeatedly in `AppShell.tsx` (lines 343-345 read, 806 + 1082 + 1513 write, 1099 + 1239 + 1542 read).

```typescript
// Read (on Open / samplingHz-change resample / runReload response):
new Map(Object.entries(initialProject.restoredOverrides))
// Write (on Save / resample request):
Object.fromEntries(overrides)
```

**Apply to:** every new `overridesAtlasLess` boundary crossing. Maps live in renderer; Records cross IPC; on-disk shape is Record. Strict symmetry. **All THREE hydration sites (1099 / 1239 / 1542) must mirror the conversion for both buckets.**

### Banner stack visual idiom

**Source:** `AppShell.tsx:1926-2001` — `staleOverrideNotice`, `overrideMigrationNotice`, `loaderModeHealedNotice` all use identical class string + structure.

```typescript
<div
  role="status"
  className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
>
  <span className="inline-block w-1 h-4 bg-accent" aria-hidden="true" />
  <span className="flex-1">...</span>
  <button
    type="button"
    onClick={...}
    className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
  >
    Dismiss
  </button>
</div>
```

**Apply to:** the new mode-toggle toast — verbatim class strings (Tailwind v4 literal-class scanner discipline per project memory).

### Field-add precedent (no schema version bump)

**Source:** `loaderMode` (Phase 21), `sharpenOnExport` (Phase 28), `safetyBufferPercent` (Phase 30) — three precedent additive fields, all without a version bump.

**Apply to:** `overridesAtlasLess` follows the same precedent. The `migrate(project)` ladder at `project-file.ts:296-305` is unchanged.

---

## No Analog Found

None. Every new surface has an in-file or cross-file precedent.

---

## Metadata

**Analog search scope:**
- `src/shared/types.ts` (ProjectFileV1, AppSessionState, MaterializedProject, SerializableError)
- `src/core/project-file.ts` (validator, serializer, materializer)
- `src/main/project-io.ts` (Open / locate-skeleton recovery / resample seams)
- `src/main/override-migration.ts` (helper signature + return shape)
- `src/renderer/src/components/AppShell.tsx` (state, dirty signal, banner stack, mode toggle, panel mounts, AtlasPreviewModal mount, samplingHz-change resample useEffect)
- `src/renderer/src/App.tsx` (drag-drop recovery mirror — mergedOverrides field)
- `tests/core/project-file.spec.ts` (round-trip + pre-massage tests)
- `tests/main/override-migration.spec.ts` (per-helper unit tests)
- `tests/renderer/override-migration-banner.spec.tsx` (full AppShell mount pattern)

**Files scanned:** 9 source + 3 test
**Pattern extraction date:** 2026-05-13
**Revision date:** 2026-05-13 (§5 read-site inventory expanded to be exhaustive per checker review)
</content>
</invoke>
