---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
reviewed: 2026-05-01T23:41:48Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/core/errors.ts
  - src/core/loader.ts
  - src/core/png-header.ts
  - src/core/project-file.ts
  - src/core/synthetic-atlas.ts
  - src/core/types.ts
  - src/main/ipc.ts
  - src/main/project-io.ts
  - src/main/sampler-worker.ts
  - src/renderer/src/components/AppShell.tsx
  - src/shared/types.ts
  - tests/arch.spec.ts
  - tests/core/loader-atlas-less.spec.ts
  - tests/core/loader.spec.ts
  - tests/core/png-header.spec.ts
  - tests/core/project-file.spec.ts
  - tests/core/summary.spec.ts
  - tests/core/synthetic-atlas.spec.ts
  - tests/main/ipc.spec.ts
  - tests/main/project-io.spec.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-01T23:41:48Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 21 implements an atlas-less Spine project loader (`.json + images/` folder, no `.atlas`). The change set is well-tested, defensively coded, and threads the new `loaderMode` field through every IPC seam (open / open-from-path / reload-with-skeleton / resample / sampler-worker / .stmproj round-trip / AppShell state). Architecture invariants are intact: `src/core/png-header.ts` and `src/core/synthetic-atlas.ts` are correctly carved out in `tests/arch.spec.ts` as load-time fs readers (no DOM, no decoding, no sampler hot-loop re-entry — CLAUDE.md fact #4 + #5 honored).

The PNG IHDR parser (focus area #1) is correct and resistant to malformed input: explicit short-read check, fixed 24-byte buffer, big-endian decode, file-descriptor leak guarded by try/finally, and zero-size IHDR rejected. The `SilentSkipAttachmentLoader` (focus area #2) is narrowly scoped — it only converts spine-core's "Region not found" throw into a `null` return and otherwise delegates verbatim to `super`; real errors (atlas parse failure, malformed JSON) still propagate through their canonical paths. The 4-way branch order in `loadSkeleton` (focus area #3) preserves `AtlasNotFoundError` verbatim for the malformed-project case via the explicit `imagesDirExists` probe at lines 297-307. The `MissingImagesDirError` IPC routing (focus area #4) is correctly wired — `KNOWN_KINDS` Set has the entry; envelope tests pass; `.name` discriminator matches. The `.stmproj` round-trip (focus area #5) is defended at three layers (validator pre-massage, materializer fallback, AppShell mountOpenResponse default). The Wave-4 coordination gap (focus area #6) is closed — `MaterializedProject.loaderMode` is required and populated at every construction site. The Layer 3 invariant (focus area #7) is preserved with appropriate carve-outs and matching named-anchor blocks.

Findings below are minor — two warnings about edge-case behavior worth a comment-or-fix decision, and five informational items (mostly observations or candidates for tightening).

## Warnings

### WR-01: Empty atlas text fed to `new TextureAtlas('')` when JSON has no region attachments and `images/` exists

**File:** `src/core/synthetic-atlas.ts:79-145`
**Issue:** When `parsedJson` references zero region/mesh/linkedmesh attachments but the `images/` folder exists, the synthesizer falls through with `lines = []` and returns `atlasText: ''`. The catastrophic-case guards on lines 96-101 (`!imagesDirExists && regionPaths.size > 0`) and 137-139 (`regionPaths.size > 0 && pngPathsByRegionName.size === 0`) both have `regionPaths.size > 0` predicates, so the empty-regions branch silently succeeds. The caller (`src/core/loader.ts:240`) then constructs `new TextureAtlas('')` which yields an atlas with zero pages and zero regions. Downstream `AtlasAttachmentLoader` would then never find any region — but since the JSON also has no region refs, this is mostly self-consistent. It's still a quietly empty success. A no-region rig is rare/synthetic but the silent zero-output behavior parallels the F3 zero-output failure mode that motivated the Spine version guard.
**Fix:** Either (a) explicitly handle `regionPaths.size === 0` at the top of `synthesizeAtlasText` with a documented short-circuit return (atlasText: '' is fine; just make the intent explicit and lock it in a test), or (b) add a defensive guard near the inner check at line 137 that throws `MissingImagesDirError` only when `regionPaths.size > 0`. The current code is safe, but the silent empty-atlas success deserves a comment so a future reader doesn't assume it's a bug.

```ts
// In synthesizeAtlasText, after computing regionPaths:
if (regionPaths.size === 0) {
  // Skeleton has no region/mesh/linkedmesh attachments — atlas-less synthesis
  // produces an empty atlas. Caller will pair this with SilentSkipAttachmentLoader
  // so SkeletonJson.readAttachment returns null for any orphan refs (none expected).
  return { atlasText: '', pngPathsByRegionName: new Map(), dimsByRegionName: new Map() };
}
```

### WR-02: `handleProjectResample` silently coerces invalid inbound `loaderMode` to `undefined`, while envelope returns 'auto'

**File:** `src/main/project-io.ts:920-928, 992`
**Issue:** The resample handler applies a tri-state coercion (`'atlas-less'` → `'atlas-less'`, `'auto'` → `'auto'`, anything else → `undefined`) at lines 923-928. The `undefined` value is then passed to the worker (which treats it as "atlas-by-default" semantics — fine), but the IPC response coerces `resampleLoaderMode ?? 'auto'` at line 992 to satisfy the `MaterializedProject` non-undefined union. The result: a renderer that ships malformed `loaderMode` (e.g. `'packed'`) gets back `'auto'` in the envelope without any indication that its requested mode was rejected. The validator in `validateProjectFile` (lines 181-186) returns `kind: 'invalid-shape'` for the same drift in the .stmproj path — the resample IPC does not. Trust-boundary inconsistency between two code paths that both validate the same field.
**Fix:** Either (a) reject invalid inbound `loaderMode` at the trust-boundary checks at lines 845-867 (mirroring the same predicate set as `validateProjectFile`), returning `kind: 'Unknown', message: "loaderMode must be 'auto' | 'atlas-less'"`, OR (b) document explicitly in the JSDoc that invalid `loaderMode` silently falls back to 'auto' so future readers don't trip over the inconsistency. Option (a) is preferred for trust-boundary consistency.

```ts
// In handleProjectResample, alongside the existing input validators:
if (
  a.loaderMode !== undefined &&
  a.loaderMode !== 'auto' &&
  a.loaderMode !== 'atlas-less'
) {
  return {
    ok: false,
    error: { kind: 'Unknown', message: "loaderMode must be 'auto' | 'atlas-less'" },
  };
}
```

## Info

### IN-01: `validateProjectFile` mutates the caller's input object during pre-massage

**File:** `src/core/project-file.ts:145-180`
**Issue:** Both the documentation pre-massage (lines 145-152) and the loaderMode pre-massage (lines 178-180) write directly into `obj` (which is the caller's `input` cast to `Record<string, unknown>`). For typical callers this is fine — `handleProjectOpenFromPath` constructs `parsed` via `JSON.parse(text)` and discards it after validation. But the contract isn't documented as "may mutate input", and a future caller passing a re-used object literal would observe the mutation. The existing tests pass an object literal to `validateProjectFile` and then re-assert against the same literal after `migrate` (line 134-150 of project-file.spec.ts) — the tests succeed because the mutation happens to fill in defaults consistent with the assertions, but the behavior is opaque.
**Fix:** Either (a) clone `obj` before mutating, or (b) add a JSDoc note to `validateProjectFile` stating "MUTATES input to apply forward-compat defaults; callers must pass disposable input."

### IN-02: Magic-byte literal `0x49 0x48 0x44 0x52` for IHDR is duplicated relative to `PNG_SIGNATURE`

**File:** `src/core/png-header.ts:23-25, 94`
**Issue:** The PNG signature is hoisted as a module-level `Buffer.from([...])` constant (line 23-25). The IHDR chunk-type bytes are embedded as inline hex literals at line 94 (`buf[12] !== 0x49 || buf[13] !== 0x48 || buf[14] !== 0x44 || buf[15] !== 0x52`). The inline-comparison is correct and arguably cheaper than a buffer compare, but the asymmetry between the two patterns is mild noise. Tests cover the negative path (`tests/core/png-header.spec.ts:92-115`).
**Fix:** Optional — extract `const IHDR_CHUNK_TYPE = Buffer.from('IHDR', 'ascii');` and use `buf.compare(IHDR_CHUNK_TYPE, 0, 4, 12, 16) === 0`. Pure stylistic — leave as-is unless a future PNG-header extension grows.

### IN-03: `validateExportPlan`-style validator comment in IPC says "lines 92-112" but the function is at 279-299

**File:** `src/main/ipc.ts:946-947`
**Issue:** The `'menu:notify-state'` handler comment at lines 946-947 references `validateExportPlan (ipc.ts:106-126)`. The actual `validateExportPlan` definition is at lines 279-299 — the comment line numbers are stale (likely from a prior file layout). Pure documentation drift; no behavioral impact.
**Fix:** Update the line-number reference, or remove the parenthetical and just say "mirrors `validateExportPlan` above".

### IN-04: `SpineSequence` placeholder type is `unknown`, but the `as any` cast fights it back to runtime

**File:** `src/core/synthetic-atlas.ts:56, 209, 226`
**Issue:** The `SpineSequence` alias is declared as `unknown` (line 56) because spine-core does not re-export `Sequence` from its package root. The two override methods then cast `sequence as any` (lines 209, 226) to satisfy the `super.newRegionAttachment` / `super.newMeshAttachment` non-nullable signatures, with eslint-disable directives for `@typescript-eslint/no-explicit-any`. The chain of casts (`unknown` → `any`) is documented in the file header but is a known type-soundness gap in the override contract. Working as designed for v1; the only consumer that can break this is a future spine-core upgrade that tightens the `sequence` parameter shape.
**Fix:** When spine-core 4.3+ stabilizes `Sequence` as a public re-export, replace `SpineSequence = unknown` with `import type { Sequence } from '@esotericsoftware/spine-core'` and drop the two `as any` casts.

### IN-05: `loadSkeleton` accepts `loaderMode: 'atlas-less'` AND `atlasPath` together; `atlasPath` wins silently

**File:** `src/core/loader.ts:214-235, src/core/types.ts:24-37`
**Issue:** The 4-way branch order documents (and `tests/core/loader.spec.ts:262-295` locks) that branch 1 (`opts.atlasPath !== undefined`) fires before branch 2 (`opts.loaderMode === 'atlas-less'`). The doc comment in `types.ts:35-37` explicitly says "Independent of `atlasPath` — when both are provided, `atlasPath` is still tried first per D-06". This is intentional and locked, but a renderer caller that simultaneously sets `summary.atlasPath` (stale) AND `loaderMode === 'atlas-less'` in `ResampleArgs` would silently get canonical-mode behavior. In practice the renderer's resample call at AppShell.tsx:1087 uses `summary.atlasPath ?? undefined`, and atlas-less projects have `summary.atlasPath === null`, so the `undefined` coercion makes branch 1 not fire — the issue cannot manifest with current call sites. Documenting it here for future maintainers.
**Fix:** No code change needed. Consider adding a comment in `loadSkeleton`'s docblock or in `LoaderOptions.loaderMode`'s JSDoc clarifying that `atlasPath` and `loaderMode: 'atlas-less'` are conflicting — `atlasPath` wins by D-06 design. The current types.ts comment partially says this; tightening would help.

---

_Reviewed: 2026-05-01T23:41:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
