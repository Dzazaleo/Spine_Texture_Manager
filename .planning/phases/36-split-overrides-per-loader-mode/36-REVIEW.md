---
status: resolved
phase: 36-split-overrides-per-loader-mode
reviewed: 2026-05-13
resolved: 2026-05-13
depth: standard
files_reviewed: 12
findings:
  critical: 1
  warning: 4
  info: 0
  total: 5
diff_base: c01f149f0393cb5113d6efc98945a63a170b2b5f
---

# Phase 36 — Code Review

**Reviewed:** 2026-05-13
**Depth:** standard
**Files reviewed (5 source + 7 tests):**

- `src/core/project-file.ts`
- `src/main/project-io.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/AppShell.tsx`
- `src/shared/types.ts`
- `tests/core/project-file-loader-mode-heal.spec.ts`
- `tests/core/project-file.spec.ts`
- `tests/main/override-migration.spec.ts`
- `tests/main/project-io.spec.ts`
- `tests/renderer/appshell-mode-switch-divergence.spec.tsx`
- `tests/renderer/optimize-dialog-buffer.spec.tsx`
- `tests/renderer/save-load.spec.tsx`

**Findings:** 1 BLOCKER · 4 WARNING

---

## CR-01 — BLOCKER: `handleProjectResample` ignores `args.loaderMode` for bucket routing — every mode toggle silently corrupts both override buckets in production

**Files:**

- `src/main/project-io.ts:1170-1184`
- `src/renderer/src/components/AppShell.tsx:1602-1700` (resample useEffect)
- `src/renderer/src/components/AppShell.tsx:1161-1228` (`runReload`)

**Issue:**

The resample IPC's single-bucket `ResampleArgs.overrides` field carries the **active** bucket (whichever the user is currently editing) — renderer sends `Object.fromEntries(activeOverrides)` at `AppShell.tsx:1175` and `:1621`. The main-side handler at `project-io.ts:1174-1184` always routes:

```ts
const aSrcRes  = migrateOverrides(a.overrides as Record<string, unknown>, summary);  // ← treated as atlas-source
const aLessRes = migrateOverrides(resampleAtlasLessInput, summary);                  // ← always {} since ResampleArgs has no overridesAtlasLess
// ...
restoredOverrides:           aSrcRes.restored,   // ← contains atlas-LESS data when user just toggled to atlas-less
restoredOverridesAtlasLess:  aLessRes.restored,  // ← always empty
```

`a.loaderMode` is read for loader/sampler routing (lines 1122-1126) but **never** consulted for override-bucket routing.

**Reproduction:**

1. User loads a project with `overrides: {}, overridesAtlasLess: { CIRCLE: 75 }`.
2. User toggles to atlas-less mode → `loaderMode === 'atlas-less'`, `activeOverrides = overridesAtlasLess`.
3. The samplingHz/loaderMode-change useEffect (`AppShell.tsx:1602`) fires with `overrides: { CIRCLE: 75 }`, `loaderMode: 'atlas-less'`.
4. Main returns `restoredOverrides: { CIRCLE: 75 }`, `restoredOverridesAtlasLess: {}`.
5. Renderer hydration at `AppShell.tsx:1650-1656`:
   - `setOverrides(...)` → atlas-source Map is overwritten with atlas-less data.
   - `setOverridesAtlasLess(new Map([]))` → atlas-less Map is wiped.

The user's atlas-less bucket is destroyed and copied into the atlas-source bucket. The pre-existing atlas-source bucket data is destroyed.

The docblock at `project-io.ts:1167-1169` even states this contract incorrectly: *"the inactive bucket round-trips through the renderer, not the IPC seam, on the resample path."* The code DOES hydrate the inactive bucket from the response anyway (`setOverridesAtlasLess(...)` at `AppShell.tsx:1656` and `:1197`). Intent and implementation disagree.

**Compounding effect** — the `isDirty` memo (`AppShell.tsx:980-1019`) flips true after the corruption (both buckets differ from `lastSaved`), so the user can save and **persist the corrupted state to disk**.

The `runReload` path (`AppShell.tsx:1161-1228`) has the same bug — it also sends `Object.fromEntries(activeOverrides)` as the single `overrides` field and main routes via the same broken handler.

**Why the integration test missed it:** `tests/renderer/appshell-mode-switch-divergence.spec.tsx:192-228` installs a `makeResampleEcho` stub that **does** route by `args.loaderMode` (`if (args.loaderMode === 'atlas-less') state.overridesAtlasLess = { ...args.overrides }`). The stub models the corrected behavior, not what `handleProjectResample` actually does. Test 3 additionally uses `mockResolvedValueOnce` with hand-crafted response payloads, fully bypassing the real handler. **No test exercises the production main-side path** — `tests/main/project-io.spec.ts:313-407` covers the G-04 loaderMode-routing fix but does not assert per-bucket routing of the override Records.

**Fix (Option A — minimal change, schema-compatible):**

Route by `loaderMode` in the resample handler:

```ts
// project-io.ts ~1170
const incomingActive = a.overrides as Record<string, unknown>;
const incomingInactive: Record<string, unknown> =
  a.overridesAtlasLess && typeof a.overridesAtlasLess === 'object'
    ? (a.overridesAtlasLess as Record<string, unknown>)
    : {};

const isAtlasLess = resampleLoaderMode === 'atlas-less';
const atlasSourceInput = isAtlasLess ? incomingInactive : incomingActive;
const atlasLessInput   = isAtlasLess ? incomingActive   : incomingInactive;

const aSrcRes  = migrateOverrides(atlasSourceInput, summary);
const aLessRes = migrateOverrides(atlasLessInput, summary);
// ...
restoredOverrides:           aSrcRes.restored,
restoredOverridesAtlasLess:  aLessRes.restored,
```

AND extend `ResampleArgs` (`shared/types.ts:1167`) with `overridesAtlasLess?: Record<string, number>`, then have AppShell's resample useEffect + `runReload` send BOTH buckets:

```ts
overrides:           Object.fromEntries(overrides),
overridesAtlasLess:  Object.fromEntries(overridesAtlasLess),
```

**Fix (Option B):** Keep `ResampleArgs.overrides` single-bucket but make the renderer NOT re-hydrate the inactive bucket from the response (drop `setOverridesAtlasLess(...)` at lines 1197 and 1656). This matches the docblock claim but is fragile.

**Regression test required:** Drive the **actual** `handleProjectResample` handler (not the stub) with `loaderMode: 'atlas-less'` and seeded `overridesAtlasLess`, asserting that the response's `restoredOverrides` is **empty** and `restoredOverridesAtlasLess` carries the active bucket.

---

## WR-01 — WARNING: App.tsx-level locate-skeleton recovery drops `loaderMode`, `sharpenOnExport`, and `safetyBufferPercent` (silent state loss)

**File:** `src/renderer/src/App.tsx:183-218`

**Issue:**

The AppShell-level `onClickLocateSkeleton` (`AppShell.tsx:1402-1434`) was extended to thread `loaderMode`, `sharpenOnExport`, and `safetyBufferPercent` into `reloadProjectWithSkeleton`. The parallel `App.tsx`-level `handleLocateSkeleton` (drag-drop recovery path) at lines 187-196 was **not** updated:

```ts
const resp = await window.api.reloadProjectWithSkeleton({
  projectPath: state.error.projectPath,
  newSkeletonPath: located.newPath,
  mergedOverridesBuckets: state.error.mergedOverridesBuckets,
  samplingHz: state.error.samplingHz,
  lastOutDir: state.error.lastOutDir,
  sortColumn: state.error.sortColumn,
  sortDir: state.error.sortDir,
  // MISSING: loaderMode, sharpenOnExport, safetyBufferPercent
});
```

Main's handler defensively defaults these (`loaderMode: 'auto'`, `sharpenOnExport: false`, `safetyBufferPercent: 0`), so a user whose `.stmproj` was saved with `loaderMode: 'atlas-less'` and `safetyBufferPercent: 10` and hits this drag-drop recovery path will silently get atlas-source mode + 0% buffer + sharpen off.

The `state.error` payload doesn't carry these fields today (the `SerializableError` shape at `types.ts:872-894` only threads `mergedOverridesBuckets`, `samplingHz`, `lastOutDir`, `sortColumn`, `sortDir`). The pre-existing Phase 30 WR-01 fix added these to AppShell's path; the App.tsx path is the missed sibling.

This pre-dates Phase 36 strictly speaking, but Phase 36 touches the surrounding lines (D-12 `mergedOverridesBuckets` rename) so it's in-scope to call out — Phase 36 was the natural opportunity to close the inherited gap.

**Fix:** Extend `SerializableError`'s recovery arm (`types.ts:872-894`) with `loaderMode?`, `sharpenOnExport?`, `safetyBufferPercent?`; populate them at the `SkeletonJsonNotFoundError` rescue branches in `project-io.ts:486-499` from the `materialized` object; thread through `App.tsx`'s `handleLocateSkeleton`.

---

## WR-02 — WARNING: `mergedOverridesBuckets` validator uses truthiness which silently accepts non-object sub-buckets

**File:** `src/main/project-io.ts:775-785`

**Issue:**

```ts
if (
  !a.mergedOverridesBuckets
  || typeof a.mergedOverridesBuckets !== 'object'
  || !(a.mergedOverridesBuckets as Record<string, unknown>).overrides
  || !(a.mergedOverridesBuckets as Record<string, unknown>).overridesAtlasLess
) {
  return { ok: false, error: { kind: 'Unknown', message: 'mergedOverridesBuckets must carry both buckets' } };
}
```

The `!...overrides` truthiness check passes the validation for:

- A non-empty string (`"foo"` is truthy)
- A number (`42` is truthy)
- An array (`[]` is truthy)
- A function reference

…all of which then get cast at line 852-855 as `Record<string, number>` and passed to `migrateOverrides`. `migrateOverrides` calls `Object.entries(...)` which works on arrays / strings without throwing but produces garbage. Per-key value validation inside `migrateOverrides` (Test 7 in `override-migration.spec.ts`) silently skips non-finite values, so the corruption is silent rather than thrown.

This is defense-in-depth at the IPC trust boundary; the renderer is the only caller and always sends well-formed objects, so the practical risk is low. But the existing `validateProjectFile` precedent at `project-file.ts:290-298` uses the stricter `!obj.X || typeof !== 'object' || Array.isArray(obj.X)` triple-check — the recovery seam should mirror that pattern for consistency.

**Fix:**

```ts
const buckets = a.mergedOverridesBuckets as Record<string, unknown> | null;
if (
  !buckets || typeof buckets !== 'object' || Array.isArray(buckets)
  || typeof buckets.overrides !== 'object' || buckets.overrides === null || Array.isArray(buckets.overrides)
  || typeof buckets.overridesAtlasLess !== 'object' || buckets.overridesAtlasLess === null || Array.isArray(buckets.overridesAtlasLess)
) {
  return { ok: false, error: { kind: 'Unknown', message: 'mergedOverridesBuckets must carry both buckets as objects' } };
}
```

---

## WR-03 — WARNING: Empty `overridesAtlasLess` on a v1.5-era file with non-empty `overrides` saved in atlas-less mode triggers legacy-routing false-positive

**File:** `src/main/project-io.ts:596-613`

**Issue:**

The legacy-routing heuristic at the Open seam:

```ts
const legacyMapPresent =
  Object.keys(materialized.overrides).length > 0
  && Object.keys(materialized.overridesAtlasLess).length === 0;
const routeToAtlasLess =
  legacyMapPresent && materialized.loaderMode === 'atlas-less';
```

The docblock at lines 599-602 acknowledges: *"We can't distinguish 'legacy file' from 'v1.5 file that happens to have an empty atlas-less bucket'; the conservative rule is that routing only matters when both conditions hold, and applying the rule to a v1.5 file with the same shape is a no-op."*

**It is NOT a no-op.** Consider a v1.5+ user who:

1. Saves project in atlas-source mode with `overrides: { CIRCLE: 50 }` and `overridesAtlasLess: {}` (untouched empty bucket).
2. Toggles to atlas-less mode (overrides bucket stays at `{ CIRCLE: 50 }`, atlas-less bucket stays empty per OVR-03 no-auto-copy).
3. Saves. `effectiveLoaderMode` (`AppShell.tsx:859-862`) promotes to `'atlas-less'` because the loader actually used the atlas-less path. The file on disk now reads `loaderMode: 'atlas-less'`, `overrides: { CIRCLE: 50 }`, `overridesAtlasLess: {}`.
4. Re-open. `legacyMapPresent === true` AND `materialized.loaderMode === 'atlas-less'`. The heuristic moves `{ CIRCLE: 50 }` from `overrides` to `overridesAtlasLess`.

The user's atlas-source bucket `{ CIRCLE: 50 }` silently migrates to atlas-less. **Symptom:** the next time the user toggles back to atlas-source mode, CIRCLE has no override.

This is unlikely but reachable. Mitigation: write a schema marker to differentiate "explicitly empty" from "field absent". Without a schema bump, the conservative fix is to *only* apply legacy routing when the on-disk schema lacks the `overridesAtlasLess` key entirely (vs. carries it as an empty object). The validator's pre-massage at `project-file.ts:287-289` substitutes `{}` for missing AND for empty `{}`, losing the distinction by the time `materialized.overridesAtlasLess` is read.

**Fix:** Detect legacy at the validator level — set a non-typed flag (or write a sentinel value) when the pre-massage substitutes `{}` for missing, vs. when the file genuinely contains `overridesAtlasLess: {}`. Carry the flag through `PartialMaterialized` to gate the routing at `project-io.ts:603-613`. Lower-effort alternative: bump the schema to `version: 2` for files written post-Phase-36 so the heuristic can use `version === 1` AS the legacy signal.

---

## WR-04 — WARNING: `onToggleLoaderMode` reads `overrides.size` / `overridesAtlasLess.size` for D-02 trigger but deps array uses property-access form

**File:** `src/renderer/src/components/AppShell.tsx:661-674`

**Issue:**

```ts
const onToggleLoaderMode = useCallback((next: 'auto' | 'atlas-less') => {
  setLoaderMode(next);
  setLoaderMenuOpen(false);
  const anyOverrides = overrides.size > 0 || overridesAtlasLess.size > 0;
  if (!anyOverrides) return;
  // ...
}, [overrides.size, overridesAtlasLess.size]);
```

The dep array uses `overrides.size` as a primitive (number) dep. This works correctly today — but newer `react-hooks/exhaustive-deps` rule versions flag this as "depend on `overrides` instead." The pattern is functionally correct but stylistically non-idiomatic; future lint upgrades may emit warnings and a less careful refactor could replace `overrides.size` with `overrides`, causing the callback to re-bind on every override mutation.

Lower priority — note the pattern for consistency review. Either:

- Move `anyOverrides` derivation OUT of the callback into a `useMemo([overrides, overridesAtlasLess])` and reference the boolean memo in the deps, OR
- Add an inline `// eslint-disable react-hooks/exhaustive-deps` with a comment explaining the size-only dep intent.

The behavior is correct today but the form is brittle to future maintenance.

---

## What was verified (no findings)

- **Bucket reads (active slice):** Every reader (`buildExportPlan`, `buildAtlasPreview`, panel `overrides` props, `AtlasPreviewModal`, `OverrideDialog` prefill at `AppShell.tsx:602/618`) goes through `activeOverrides` (line 363-366).
- **Bucket writes (active slice only):** `onApplyOverride` and `onClearOverride` (lines 624-653) correctly select the active bucket via `loaderMode === 'atlas-less' ? setOverridesAtlasLess : setOverrides`.
- **Stale `mergedOverrides:` references:** None outside JSDoc/comments. Source-code line `mergedOverridesBuckets:` is consistent across `types.ts`, `project-io.ts`, `AppShell.tsx`, `App.tsx`, and tests.
- **Save serializer:** `buildSessionState` (`AppShell.tsx:849-921`) writes both buckets unconditionally; `serializeProjectFile` round-trips both losslessly; validator pre-massages missing `overridesAtlasLess` to `{}` and rejects non-object / non-finite values; `materializeProjectFile` clones both buckets symmetrically.
- **Migration sum/union semantics:** All three seams (Open at 617-622, recovery at 949-954, resample at 1174-1179) correctly sum `migratedKeyCount` and union `staleOverrideKeys`. Unit tests (`override-migration.spec.ts` Tests 10–11) lock this.
- **Legacy single-map routing (Decision 2-A):** Implemented at `project-io.ts:603-613` — gated by `legacyMapPresent && materialized.loaderMode === 'atlas-less'`. Subject to WR-03 above but the routing direction is correct.
- **Dirty detection:** Both buckets contribute to `isDirty` (lines 980-1019).
- **`lastSaved` snapshots:** Both buckets captured in initial state, `onClickSave`, `onClickSaveAs`, `mountOpenResponse`.
- **Mode-toggle toast (D-01..D-04):** New `overrideModeToastVisible` slot, banner JSX, "Don't show again" → localStorage `stm.overrideModeToast.suppressed`, ARIA `role="status"` parity with sibling banners.
- **App.tsx recovery banner** carries `mergedOverridesBuckets: state.error.mergedOverridesBuckets` — both buckets flow through.
- **mountOpenResponse + runReload + samplingHz-change resample** hydrate `setOverridesAtlasLess(new Map(Object.entries(resp.project.restoredOverridesAtlasLess ?? {})))` symmetrically. The hydration is correct *from the response's perspective*; CR-01 above is that main produces the wrong response data.

---

## Summary

| Severity | Count | Detail |
|----------|------:|--------|
| Critical/Blocker | 1 | CR-01 — resample handler silently corrupts both buckets on every mode toggle |
| Warning | 4 | WR-01 (recovery state loss), WR-02 (validator truthiness), WR-03 (legacy-routing false positive), WR-04 (deps form) |
| Info | 0 | — |

Recommend running `/gsd-code-review-fix 36` to auto-apply CR-01 and WR-02 first; WR-01 / WR-03 may need a small Phase 36.1 closure plan as they touch surface beyond the strict OVR-01..07 scope.

---

## Fix Log

**Resolved:** 2026-05-13
**Scope applied:** Critical (CR-01) + Warning (WR-01, WR-02, WR-03, WR-04). No Info findings.

| Finding | Status | Commit | Notes |
|---------|--------|--------|-------|
| CR-01   | fixed  | `e08c18e` | `ResampleArgs` extended with optional `overridesAtlasLess`; renderer sends BOTH buckets unconditionally on `runReload` + samplingHz-change useEffect; `handleProjectResample` routes by bucket-name (not `loaderMode`); 3 new regression tests in `tests/main/project-io.spec.ts` drive the real handler; `appshell-mode-switch-divergence.spec.tsx` stub updated to match the new IPC shape. |
| WR-01   | fixed  | `64e12c1` | `SerializableError.SkeletonNotFoundOnLoadError` arm extended with optional `loaderMode` / `sharpenOnExport` / `safetyBufferPercent`; populated at both `project-io.ts` rescue payload sites; threaded through `App.tsx`'s `handleLocateSkeleton`. |
| WR-02   | fixed  | `dbdd621` | `mergedOverridesBuckets` validator now uses strict object guards (mirrors `project-file.ts:290-298` pattern); rejects non-null/non-array/plain-object sub-buckets. Error message updated to `"... as objects"` (no test depended on the verbatim previous string). |
| WR-03   | fixed  | `9d62991` | Legacy-routing heuristic now requires `!hadOverridesAtlasLessKey` — sensed via `Object.prototype.hasOwnProperty.call(parsed, 'overridesAtlasLess')` BEFORE validator pre-massage substitutes `{}`. v1.5+ files always serialise the key explicitly, so the heuristic no longer fires on legitimate v1.5 atlas-source-mode files with an empty atlas-less bucket. Lower-effort alternative — no schema version bump (per review recommendation). |
| WR-04   | fixed  | `29f4202` | `anyOverrides` lifted to a `useMemo` above `onToggleLoaderMode`; deps array now references the stable boolean memo instead of `[overrides.size, overridesAtlasLess.size]`. |

**Verification:** All 1076 tests pass (+3 new CR-01 regression tests over the 1073 baseline). `npm run typecheck` clean except 3 pre-existing out-of-scope errors (`scripts/probe-per-anim.ts`, `tests/_trace_tmp/trace.spec.ts`, `tests/main/image-worker-rotation.spec.ts`).
