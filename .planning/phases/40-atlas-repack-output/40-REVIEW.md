---
phase: 40-atlas-repack-output
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - src/core/project-file.ts
  - src/core/repack.ts
  - src/main/atlas-paths.ts
  - src/main/atlas-writer.ts
  - src/main/image-worker.ts
  - src/main/ipc.ts
  - src/main/project-io.ts
  - src/main/repack-worker.ts
  - src/main/sharp-resize.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/OptimizeDialog.tsx
  - src/shared/types.ts
  - scripts/probe-sharp-rotate-write.mjs
  - scripts/repack-refresh-baselines.mjs
  - package.json
  - tests/core/project-file-loader-mode-heal.spec.ts
  - tests/core/project-file.spec.ts
  - tests/core/repack.spec.ts
  - tests/main/atlas-writer.spec.ts
  - tests/main/image-worker.integration.spec.ts
  - tests/main/ipc-export.spec.ts
  - tests/main/project-io.spec.ts
  - tests/main/repack-worker.spec.ts
  - tests/main/repack.loose-parity.spec.ts
  - tests/main/repack.parity.spec.ts
  - tests/preload/start-export-atlas-args.spec.ts
  - tests/renderer/app-shell-atlas-state.spec.tsx
  - tests/renderer/appshell-optimize-flow.spec.tsx
  - tests/renderer/optimize-dialog-auto-expand-error.spec.tsx
  - tests/renderer/optimize-dialog-buffer.spec.tsx
  - tests/renderer/optimize-dialog-output-card.spec.tsx
  - tests/renderer/optimize-dialog-passthrough-rows.spec.tsx
  - tests/renderer/optimize-dialog-passthrough.spec.tsx
  - tests/fixtures/repack-baselines.json
  - tests/fixtures/repack-expected/SIMPLE_TEST.atlas
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

Phase 40 adds an atlas-repack output pipeline (libgdx `.atlas` text + composite page PNGs) alongside the existing loose-PNG export. The implementation is largely well-structured: the `core/` purity invariant holds, the IPC trust-boundary validator (`validateExportOpts`) covers all 4 new fields, the writtenPaths rollback set is wired through both workers, and the REPACK-10 locked error string propagates verbatim from worker → IPC → renderer.

However, the adversarial pass found two BLOCKER-level correctness gaps and seven WARNINGs:

1. **Atlas-source projects without per-region PNGs are broken in atlas/both mode** — `runRepack` calls `sharp(row.sourcePath)` directly without the atlas-extract fallback that `runExport` has at image-worker.ts:444-476. Jokerman-style projects (atlas page + no on-disk per-region PNGs) cannot use atlas mode.

2. **Cancel semantics regression vs Phase 6 REVIEW M-03** — `runRepack`'s summary uses `cancelled: isCancelled()` (live flag at return time), which conflates true mid-run cancel with a post-success Cancel click. `runExport` fixed this exact bug via the `bailedOnCancel` local flag.

The remaining warnings cover locale-dependent sort determinism (REPACK-08 parity risk), missing isCancelled checks during the rotation loop, dropped atlas fields on the recovery-of-recovery envelope, sharp re-encoding of passthrough rows (no byte-parity to source), and a few defense-in-depth gaps.

## Critical Issues

### CR-01: runRepack lacks atlas-extract fallback — atlas-source projects without per-region PNGs are broken in atlas/both mode

**File:** `src/main/repack-worker.ts:178-184` (resize loop) and `src/main/repack-worker.ts:250` (passthrough loop)

**Issue:**
Both inner loops call `sharp(row.sourcePath)` and `sharp(row.sourcePath).png().toBuffer()` respectively, without any `row.atlasSource` fallback. By contrast, `src/main/image-worker.ts:444-476` (resize) and `:206-249` (passthrough) check `access(sourcePath, R_OK)` and fall back to a sharp-extract pipeline over `row.atlasSource.pagePath` when the per-region PNG does not exist.

For atlas-source projects where the on-disk layout is `<project>/skeleton.json + <project>.atlas + <project>.png` (Jokerman-style — no per-region PNGs), the loader still synthesises `row.sourcePath = <skeletonDir>/images/<regionName>.png`, but the file doesn't exist. `runExport` recovers via atlas-extract; `runRepack` crashes with sharp's "Input file is missing" error and the entire atlas export rolls back.

The SPEC's REPACK-08 cross-loaderMode parity test only exercises the SIMPLE_TEST fixture which DOES have per-region PNGs available, so this defect doesn't surface in the existing test suite — but is a primary acceptance gap against memory `project_atlas_less_primary_workflow` (Esoteric-recommended atlas-source layout has the page PNG as the canonical pixel source).

**Fix:**
Mirror image-worker's atlas-extract fallback in repack-worker. Pseudo-sketch (resize loop):
```ts
let pipeline: sharp.Sharp;
let useAtlasExtract = false;
if (row.atlasSource?.rotated === true) {
  await access(row.atlasSource.pagePath, fsConstants.R_OK);
  useAtlasExtract = true;
} else {
  try {
    await access(row.sourcePath, fsConstants.R_OK);
  } catch {
    if (!row.atlasSource) throw new Error(`Source not found: ${row.sourcePath}`);
    await access(row.atlasSource.pagePath, fsConstants.R_OK);
    useAtlasExtract = true;
  }
}
if (useAtlasExtract && row.atlasSource) {
  // Two-pipeline materialize-then-resize per image-worker.ts:582-606
  // for rotated + Strip-Whitespace handling.
  const a = row.atlasSource;
  // ... extract + (rotate if a.rotated) + (extend if SW) + toBuffer
  pipeline = sharp(orig);
} else {
  pipeline = sharp(row.sourcePath);
}
const resized = await resizeToBuffer(pipeline, row.outW, row.outH, row.effectiveScale, sharpenEnabled);
```
Same shape for the passthrough loop (no resize, but still needs atlasSource fallback). Consider extracting a shared helper `loadRegionBuffer(row, sharpenEnabled, mode: 'resize' | 'passthrough')` so the two workers share the atlas-extract logic verbatim (the helper is already ~50 lines in image-worker; duplication risks future drift).

### CR-02: runRepack reports `cancelled: isCancelled()` at return time — Phase 6 REVIEW M-03 regression

**File:** `src/main/repack-worker.ts:420-426`

**Issue:**
The success summary uses `cancelled: isCancelled()` which probes the LIVE cancel flag at return time. If the user clicks Cancel after the last region has been composited and the atlas-text rename has completed (but before the function returns), `isCancelled()` returns true and the summary falsely reports `cancelled: true` — even though every region succeeded and no work was skipped.

This is exactly the bug `runExport` fixed in Phase 6 REVIEW M-03 (image-worker.ts:128-139 and :683) by tracking `bailedOnCancel` only when the cooperative pre-iteration check actually fires. The renderer's progress card reads `summary.cancelled` and renders "— cancelled" in the status line; a clean run that happens to coincide with a stray Cancel click would be mislabelled in the UI.

In 'both' mode the IPC merger at ipc.ts:948 does `cancelled: looseSummary.cancelled || repackSummary.cancelled` — so a stray Cancel during the atlas stage would poison the merged summary even if neither stage actually bailed.

**Fix:**
Add a local `bailedOnCancel` flag in `runRepack` (parallels image-worker.ts:139):
```ts
let bailedOnCancel = false;
// In each loop:
if (isCancelled()) {
  bailedOnCancel = true;
  throw new Error('cancelled');
}
// In the summary:
cancelled: bailedOnCancel,
```
The `throw new Error('cancelled')` will be caught by the IPC handler's inner-catch (ipc.ts:967) and trigger writtenPaths rollback — so the only behavioural difference is the summary field, which the renderer surfaces in the status caption.

## Warnings

### WR-01: Locale-dependent `localeCompare` sort risks REPACK-08 parity across machines

**File:** `src/core/repack.ts:102-104`

**Issue:**
`sortedInputs = packable.slice().sort((a, b) => a.regionName.localeCompare(b.regionName))` uses the host's default locale for collation. On macOS (en-US) and most CI environments this produces stable ASCII order, but a contributor running tests under a non-default locale (Turkish dotted-i, German ß handling, Asian collation) could produce a different sort order — and therefore a different pack layout — and therefore different `SHA256(.atlas)` and `SHA256(page PNG)` than the committed baselines.

The repack-baselines.json `_meta.note` covers sharp/libvips/maxrects-packer version pinning but says nothing about the locale dependency. REPACK-08 cross-loaderMode parity holds within a host, but cross-machine parity (and CI repeatability across runners) is locale-coupled.

**Fix:**
Pin the locale explicitly:
```ts
const collator = new Intl.Collator('en-US', { numeric: false, sensitivity: 'variant' });
const sortedInputs = packable.slice().sort((a, b) => collator.compare(a.regionName, b.regionName));
```
Or — simpler — use byte-order codepoint compare which is locale-independent:
```ts
const sortedInputs = packable.slice().sort((a, b) => a.regionName < b.regionName ? -1 : a.regionName > b.regionName ? 1 : 0);
```
The latter matches the existing array-comparison pattern used elsewhere in core/ (no Intl dependency, deterministic across hosts).

### WR-02: Rotation loop has no isCancelled() check — slow cancel on large atlases

**File:** `src/main/repack-worker.ts:304-311`

**Issue:**
The rotation prep loop (Step 4) iterates `packResult.regions` and applies sharp.rotate per rotated region. There's no `isCancelled()` check inside the loop. With N rotated regions × O(50-200ms) per region on large atlases, a Cancel click during this phase has no effect until the loop completes. Phase 6 D-115 cooperative-cancel contract says cancel is honoured between sharp operations; this loop violates that.

**Fix:**
Add the cancel check:
```ts
for (const region of packResult.regions) {
  if (isCancelled()) {
    throw new Error('cancelled');
  }
  if (region.rotated) { ... }
}
```
Same pattern as the resize loop at line 151 and the composite loop at line 316.

### WR-03: SkeletonNotFoundOnLoadError envelope drops the 4 atlas fields — locate-skeleton-twice recovery loses settings

**File:** `src/shared/types.ts:880-917` (envelope shape) and `src/main/project-io.ts:936-961` (re-throw site)

**Issue:**
Phase 36 WR-01 added `loaderMode/sharpenOnExport/safetyBufferPercent` to the `SkeletonNotFoundOnLoadError` envelope so locate-skeleton-twice recovery preserves user settings across the failed-reload → re-locate cycle. Phase 40 adds 4 new persistent settings but does NOT thread them through this envelope.

In the recovery-of-recovery path (`handleProjectReloadWithSkeleton` at project-io.ts:921 catches `SkeletonJsonNotFoundError` for the user's just-picked replacement skeleton), the re-thrown envelope re-threads `loaderMode/sharpenOnExport/safetyBufferPercent` from `a.*` but the 4 atlas fields are dropped. When the user picks ANOTHER replacement and that succeeds, atlas settings have silently reverted to defaults.

This is the exact symptom Phase 36 WR-01 fixed for the older fields — Phase 40 didn't pattern-match against the precedent.

**Fix:**
1. Add 4 optional fields to `SerializableError['SkeletonNotFoundOnLoadError']` arm in types.ts:
   ```ts
   atlasOutputMode?: 'loose' | 'atlas' | 'both';
   atlasMaxPageSize?: 1024 | 2048 | 4096 | 8192;
   atlasAllowRotation?: boolean;
   atlasPadding?: number;
   ```
2. Thread them through the project-io.ts:936-961 re-throw site:
   ```ts
   atlasOutputMode,
   atlasMaxPageSize,
   atlasAllowRotation,
   atlasPadding,
   ```
3. Verify both App.tsx drag-drop and AppShell.onClickLocateSkeleton consume them on re-attempt (mirroring the Phase 36 WR-01 fix).

### WR-04: AppShell does not thread atlas fields into ResampleArgs — main-side coerce is silently defaulting

**File:** `src/renderer/src/components/AppShell.tsx:1295-1322` (runReload) and `:1760-1794` (samplingHz-change useEffect)

**Issue:**
Both resample call sites omit `atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding` from the `window.api.resampleProject(...)` payload. The main-side handler at project-io.ts:1346-1365 then coerces missing fields to validator pre-massage defaults (loose / 4096 / false / 2) on the response.

Today the response's atlas fields are not consumed by AppShell (the renderer's atlas state slots survive resample untouched), so user-visible behaviour is correct. But:

1. The main-side coerce code at project-io.ts:1340-1365 is dead — exercised only when a renderer accidentally sends garbage, never on the happy path.
2. If a future code change adds `setAtlasOutputMode(resp.project.atlasOutputMode)` to a resample handler (mirroring the existing `setLastSaved((prev) => ...samplingHz...)`), it will silently wipe user atlas settings to defaults because the renderer never told main what they currently are.

**Fix:**
Either (a) add the 4 fields to the ResampleArgs payload at both call sites (mirroring how `sharpenOnExport`/`safetyBufferPercent` are threaded):
```ts
atlasOutputMode,
atlasMaxPageSize,
atlasAllowRotation,
atlasPadding,
```
…or (b) remove the dead coerce code in project-io.ts:1346-1365 and add a comment that ResampleArgs intentionally omits atlas fields (renderer state is the source of truth). Option (a) is the safer pattern for future-proofing.

### WR-05: writtenPaths rollback has no defense-in-depth check that entries are inside outDir

**File:** `src/main/ipc.ts:974-976` and `src/main/repack-worker.ts:342-343, 410-411`

**Issue:**
The IPC handler iterates the shared `writtenPaths` Set and calls `fsRm(p, { force: true })` on each entry. There's no check that `p` is actually inside the resolved `outDir`. A regression in either worker that registers a bogus path (e.g. a wrong join, or a future code path that doesn't `pathResolve(outDir, ...)` first) would silently delete files anywhere on the filesystem the Electron main process can write.

This isn't currently exploitable — the workers use `pathResolve(outDir, ...)` and `join(resolvedOutDir, ...)` consistently — but the rollback sweep is the highest-risk side-effect in the entire phase and lacks the defense-in-depth gate that path-traversal guards (image-worker.ts:482) have on the WRITE side.

**Fix:**
Add a sweep-time guard:
```ts
const resolvedOutDir = path.resolve(outDir);
for (const p of written) {
  const rel = path.relative(resolvedOutDir, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    // Skip — entry escapes outDir; do not delete.
    continue;
  }
  await fsRm(p, { force: true }).catch(() => {});
}
```

### WR-06: Passthrough rows are re-encoded through sharp — breaks byte-parity-to-source invariant in atlas mode

**File:** `src/main/repack-worker.ts:250`

**Issue:**
`runRepack`'s passthrough loop calls `sharp(row.sourcePath).png().toBuffer()` to normalise input bytes through libvips. This is documented at line 246 as intentional for downstream metadata/rotate/composite consistency.

But: `runExport`'s passthrough handling (image-worker.ts:337) uses `copyFile(sourcePath, tmpPath)` for the byte-identical "no double Lanczos" contract documented in REPACK-09. In atlas mode the source bytes are decoded → re-encoded → composited, which means the per-pixel composite content is NOT byte-identical to what loose mode would emit. The SPEC REPACK-03 acceptance ("the pixel value at (x,y) inside a page PNG matches the corresponding pixel ... in the loose-mode PNG") is satisfied at the PIXEL level (sharp re-encode is lossless for unmodified PNG content), but byte-identity at the file level for passthrough rows is silently lost.

This isn't a SPEC violation (SPEC.md out-of-scope item: "Cross-mode loose-vs-atlas pixel equivalence on a per-pixel basis"), but the implementation drifts from the user's mental model: a passthrough row in 'both' mode produces a `.png` in loose output AND a different byte sequence inside the atlas page. The comment is correct but could surface as a user-reported bug if they checksum.

**Fix:**
If the normalisation is actually required (libvips composite + raw PNG mixed-mode), keep the current code and add an integration test that asserts pixel-equivalence after PNG round-trip (not byte-equivalence). If the re-encode is not required, add a sharp({raw:{...}}) path that operates on raw RGBA throughout the composite pipeline to skip the PNG re-encode for passthrough rows. Lower urgency than the BLOCKERs above — this is an invariant-clarity issue.

### WR-07: `regionBuffers.get(r.regionName)!` non-null assertion in composite layers

**File:** `src/main/repack-worker.ts:347-351`

**Issue:**
The composite-layer build uses a non-null assertion: `input: regionBuffers.get(r.regionName)!`. The dedup logic ensures `regionBuffers` is populated 1-to-1 with `repackInputsByName` (and `computeRepack` emits one region per input), so this is structurally safe today.

But: if a future refactor changes the dedup logic (e.g. drops a region after pack-plan-time), the non-null assertion silently passes `undefined` into sharp's `composite([{input: undefined, ...}])` which throws a non-obvious "Expected typed array for input" error. The current invariant is undocumented at the call site.

**Fix:**
Replace the assertion with an explicit guard:
```ts
const layers = packResult.regions
  .filter((r) => r.pageIndex === page.pageIndex)
  .map((r) => {
    const buf = regionBuffers.get(r.regionName);
    if (!buf) {
      throw new Error(`repack-worker: missing region buffer for ${r.regionName} on page ${page.pageIndex} (invariant violation)`);
    }
    return { input: buf, top: r.y, left: r.x };
  });
```

## Info

### IN-01: Inconsistent regionName derivation — atlas-paths.ts and atlas-writer.ts each have a private pageFilename

**File:** `src/main/atlas-paths.ts:59-62` and `src/main/atlas-writer.ts:52-55`

**Issue:**
Both files declare a private `pageFilename(projectName, pageIndex)` helper with identical bodies. atlas-writer.ts could import from atlas-paths.ts (which is a sibling module in src/main/) to share the canonical implementation. Today the two implementations agree byte-for-byte; a future change to one risks drift.

**Fix:**
In atlas-writer.ts, replace the private helper with `import { pageFilename } from './atlas-paths.js'`. Delete the local definition.

### IN-02: `regionBuffers` map is never cleared — large-atlas memory pressure

**File:** `src/main/repack-worker.ts:127`

**Issue:**
`regionBuffers` accumulates PNG buffers across ALL resize + passthrough rows. For a 158-region SKINS-class fixture at 4096² each, this could approach 100+ MB of resident PNG bytes in the main process before the composite phase starts. The Map is never `.clear()`'d even after each page composite completes — by Step 6 every region buffer is still in memory.

Out of scope per SPEC ("Performance issues ... are NOT in scope for v1"), but flagging because it's a fix-with-fix opportunity if memory pressure surfaces under real-world fixtures.

**Fix:**
Clear buffers after each page composite:
```ts
for (const r of packResult.regions.filter((r) => r.pageIndex === page.pageIndex)) {
  regionBuffers.delete(r.regionName);
}
```
…after the rename succeeds. This is safe because each region appears on exactly one page.

### IN-03: deriveProjectName falls back silently when basename includes `:` — error message is generic

**File:** `src/main/atlas-paths.ts:39-52`

**Issue:**
When both outDir basename and skeleton sourcePath produce a name containing `:`, `deriveProjectName` throws with a generic message: `"atlas-paths: could not derive projectName (outDir + skeleton sourcePath both unusable)."` This bubbles up through the IPC `Unknown` kind. The atlas-writer's separate `projectName.includes(':')` defense at atlas-writer.ts:65 has a clearer error message documenting the libgdx parsing landmine.

If the derivation falls back to sourcePath and that string happens to contain a colon (e.g., a user's project named `MyProject:Beta`), the throw fires with the generic message. Users won't know it's a libgdx-format constraint.

**Fix:**
Improve the message in deriveProjectName:
```ts
throw new Error(
  `atlas-paths: cannot derive a projectName for atlas output. ` +
  `Both outDir basename ("${fromDir}") and skeleton sourcePath fallback ` +
  `("${fromRow ?? '(none)'}") would produce a name containing ':', which ` +
  `corrupts libgdx page-header parsing (RESEARCH §Landmines #5). ` +
  `Pick an output folder without ':' in its name.`,
);
```

### IN-04: Duplicate-outPath warning emits success progress event — surfaces as "succeeded" in the dialog

**File:** `src/main/repack-worker.ts:167-176, 235-243`

**Issue:**
When the defensive dedup branch fires (`repackInputsByName.has(regionName)`), the code emits `onProgress({...status: 'success'})` for the dropped row, then continues. The renderer's per-row table reads `status: 'success'` and renders the row as completed — silently masking the fact that the row was actually dropped from the atlas output.

This is intentional per the comment ("First occurrence wins; subsequent rows dropped from atlas"), and the console.warn surfaces the upstream bug to devs. But the user-visible signal is misleading: row marked succeeded, region missing from atlas. UAT-quality bug if D-108 ever regresses.

**Fix:**
Either (a) emit an error event with `kind: 'write-error'` and message explaining the dedup, or (b) keep the success event but add a TODO documenting that this branch should be unreachable post-D-108 and should arguably hard-throw. Option (b) is more conservative — a hard throw would BREAK an upstream regression instead of degrading gracefully, which matches REPACK-10's atomic-or-fail posture for other invariant violations.

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
