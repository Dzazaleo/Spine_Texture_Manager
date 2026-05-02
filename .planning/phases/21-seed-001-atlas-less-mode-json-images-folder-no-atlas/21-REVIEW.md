---
phase: 21
phase_name: seed-001-atlas-less-mode-json-images-folder-no-atlas
scope: gap-closure (plans 21-09, 21-10, 21-11 + post-merge CSS fixes)
reviewed_at: 2026-05-02T18:28:29Z
reviewer: gsd-code-reviewer (Claude)
depth: standard
files_reviewed: 13
status: issues_found
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
preserves: 21-REVIEW-plans-01-08.md (original 8-plan review from commit 434ce95)
---

# Phase 21 Code Review — Gap-Closure Session (Plans 21-09, 21-10, 21-11 + CSS Follow-ups)

**Reviewed:** 2026-05-02T18:28:29Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found (0 critical / 2 warning / 5 info)

## Scope

This review targets ONLY the changes from the Phase 21 gap-closure session covering G-01 / G-02 / G-03. The original 8-plan code review for this phase is preserved at [21-REVIEW-plans-01-08.md](21-REVIEW-plans-01-08.md) (commit `434ce95`, 0 critical / 2 warning / 5 info).

Files in scope:

- [src/core/loader.ts](../../../src/core/loader.ts)
- [src/core/synthetic-atlas.ts](../../../src/core/synthetic-atlas.ts)
- [src/core/types.ts](../../../src/core/types.ts)
- [src/main/summary.ts](../../../src/main/summary.ts)
- [src/renderer/src/components/AppShell.tsx](../../../src/renderer/src/components/AppShell.tsx)
- [src/renderer/src/panels/GlobalMaxRenderPanel.tsx](../../../src/renderer/src/panels/GlobalMaxRenderPanel.tsx)
- [src/renderer/src/panels/MissingAttachmentsPanel.tsx](../../../src/renderer/src/panels/MissingAttachmentsPanel.tsx)
- [src/shared/types.ts](../../../src/shared/types.ts)
- [tests/core/documentation.spec.ts](../../../tests/core/documentation.spec.ts)
- [tests/core/loader-atlas-less.spec.ts](../../../tests/core/loader-atlas-less.spec.ts)
- [tests/core/summary.spec.ts](../../../tests/core/summary.spec.ts)
- [tests/core/synthetic-atlas.spec.ts](../../../tests/core/synthetic-atlas.spec.ts)
- [tests/renderer/missing-attachments-panel.spec.tsx](../../../tests/renderer/missing-attachments-panel.spec.tsx)

## Summary

The core implementation is solid: filter logic uses an O(N+M) `Set<string>`, IPC types are end-to-end consistent with appropriate optional/required discipline, the new test surfaces are non-vacuous, and the layered CSS fixes are well-justified. **No critical issues found.**

Per scope-note checklist:

1. **Optional vs required field discipline** — verified consistent. `LoadResult.skippedAttachments?:` (optional, [src/core/types.ts:153](../../../src/core/types.ts#L153)) is correctly defaulted to `[]` at the buildSummary write site ([src/main/summary.ts:181](../../../src/main/summary.ts#L181)), populating the required `SkeletonSummary.skippedAttachments` ([src/shared/types.ts:553](../../../src/shared/types.ts#L553)).
2. **Defensive `?? []` fallbacks in AppShell** — only ONE site (line 1510). See WR-01.
3. **summary.ts filter logic** — `skippedNames` Set built once ([src/main/summary.ts:60-62](../../../src/main/summary.ts#L60-L62)), three O(N) filter calls. Correct.
4. **Four layered CSS fixes** — non-conflicting. `min-h-screen` on root works alongside `flex-1 overflow-auto` `<main>`; only `<td>` accents and modals use `h-full`. See IN-04 for a minor scrolling-overflow consideration.
5. **Test coverage** — all new tests are non-vacuous. summary.spec.ts UNIT test ([tests/core/summary.spec.ts:152](../../../tests/core/summary.spec.ts#L152)) explicitly motivates falsifying ISSUE-003.

## Warnings

### WR-01: Runtime `?? []` guard contradicts required-field type contract

**File:** [src/renderer/src/components/AppShell.tsx:1510](../../../src/renderer/src/components/AppShell.tsx#L1510)

**Issue:** `SkeletonSummary.skippedAttachments` is declared REQUIRED in [src/shared/types.ts:553](../../../src/shared/types.ts#L553) and populated unconditionally by `buildSummary` ([src/main/summary.ts:181](../../../src/main/summary.ts#L181) uses `load.skippedAttachments ?? []`). But the renderer pass-through site uses `effectiveSummary.skippedAttachments ?? []` because "older renderer-side test fixtures cast a partial summary via `as unknown as SkeletonSummary` and omit the field" (per the inline comment at lines 1500-1509). The `?? []` is a workaround for fixture type-laundering, not for any runtime path the production code exercises. This conflates a test-fixture maintenance shortcut with a production safety guard, and the `?? []` will silently mask future regressions where buildSummary actually fails to populate the field.

**Fix:** Either (a) update the offending test fixtures to populate `skippedAttachments: []` explicitly (preferred — matches [tests/core/documentation.spec.ts:247](../../../tests/core/documentation.spec.ts#L247) which already does this), then drop the `?? []`; or (b) widen the `MissingAttachmentsPanelProps` type to accept `skippedAttachments?: ...` and let the panel handle undefined natively. Option (a) is consistent with the field being required per the IPC contract.

### WR-02: `for...in` loop body uses non-null assertion that can mask runtime errors

**File:** [src/core/synthetic-atlas.ts:241-244](../../../src/core/synthetic-atlas.ts#L241-L244)

**Issue:** `walkSyntheticRegionPaths` uses `for (const slotName in skin.attachments)` followed by `const slot = skin.attachments![slotName]`. The non-null assertion is defensible because `for...in` over `undefined` is a no-op, but it tells future readers the field is guaranteed non-null when the type signature says optional. Also, `for...in` enumerates inherited enumerable properties; `Object.keys`/`Object.entries` is the modern idiom. Additionally, the inner loop reads `att.type` and `att.path` without checking `att` is non-null — would crash on a malformed JSON entry like `{ "skins": [{ "attachments": { "slot1": { "X": null } } }] }`.

**Fix:**
```ts
for (const skin of root.skins ?? []) {
  for (const [_slotName, slot] of Object.entries(skin.attachments ?? {})) {
    for (const [entryName, att] of Object.entries(slot)) {
      if (att === null || typeof att !== 'object') continue;
      const type = att.type ?? 'region';
      if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
      const lookupPath = att.path ?? entryName;
      paths.add(lookupPath);
    }
  }
}
```

## Info

### IN-01: `imagesDir` path computed three times in same function

**File:** [src/core/loader.ts:243, 303, 405](../../../src/core/loader.ts#L243)

`path.join(path.dirname(skeletonPath), 'images')` is computed in three separate branches as `dirOfImages`, `probeImagesDir`, and `imagesDir`. All resolve to the same value; minor DRY violation.

**Fix:** Hoist a single `const imagesDir = ...` near the top of `loadSkeleton`, then reference in all three branches.

### IN-02: Dead `endsWith('.png')` ternary branch

**File:** [src/core/loader.ts:492](../../../src/core/loader.ts#L492)

`name: filename.endsWith('.png') ? filename.slice(0, -4) : filename` — the synthesizer ([src/core/synthetic-atlas.ts:181](../../../src/core/synthetic-atlas.ts#L181)) always pushes `regionName + '.png'`, so the fallback branch is unreachable.

**Fix:** Drop the conditional (`name: filename.slice(0, -4)`) or push raw region names from the synthesizer and append `.png` only at the renderer-display site.

### IN-03: Synthesizer's loader-side `imagesDir` pre-check is redundant with the synthesizer's own check

**File:** [src/core/loader.ts:303-313](../../../src/core/loader.ts#L303-L313)

The fall-through atlas-less branch pre-checks `imagesDirExists` before calling `synthesizeAtlasText`, but `synthesizeAtlasText` performs the same check and throws `MissingImagesDirError` ([src/core/synthetic-atlas.ts:134-150](../../../src/core/synthetic-atlas.ts#L134-L150)). The loader-side pre-check exists to swap `MissingImagesDirError` for `AtlasNotFoundError` in the legacy "no atlas, no images" case (preserves ROADMAP success criterion #5). Intent documented; duplicate `statSync` is wasteful (~µs, irrelevant).

**Fix:** Document-only or restructure so the loader passes `{ throwLegacy: true }` to the synthesizer. Not worth the refactor cost.

### IN-04: Inner-section `min-h-[calc(100vh-200px)]` magic-number does not account for MissingAttachmentsPanel banner height

**File:** [src/renderer/src/panels/GlobalMaxRenderPanel.tsx:797](../../../src/renderer/src/panels/GlobalMaxRenderPanel.tsx#L797)

The 200px offset (header + tab strip + bottom padding) does not account for the `MissingAttachmentsPanel` banner (~30-50px of additional chrome when atlas-less mode encounters missing PNGs). The inner virtualized scroll container at line 878 uses fixed `height: 'calc(100vh - 200px)'`, so when the banner is visible it can overflow viewport by banner-height. The `<main>` parent's `overflow-auto [scrollbar-gutter:stable]` handles this gracefully, but inner + outer scrollbars may co-exist visually in the rare missing-PNG case.

**Fix:** Either subtract a banner-height offset dynamically (requires measurement), or accept the dual-scrollbar artifact. Not a regression — same calculation pre-21-11; banner is the new variable.

### IN-05: Test creates tmp file outside try-block; potential leak on writeFileSync failure

**File:** [tests/core/synthetic-atlas.spec.ts:151-170, 184-203](../../../tests/core/synthetic-atlas.spec.ts#L151-L170)

Pattern `const tmpDir = mkdtempSync(...); fs.writeFileSync(...); try { ... } finally { fs.rmSync(tmpDir) }` puts setup that can throw OUTSIDE the try-block. If setup throws (EACCES, ENOSPC), tmpDir leaks until OS-level cleanup.

**Fix:**
```ts
let tmpDir: string | undefined;
try {
  tmpDir = fs.mkdtempSync(...);
  fs.mkdirSync(...);
  fs.writeFileSync(...);
} finally {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

Low-priority — only affects test-process cleanup robustness.

---

_Next steps: Run [/gsd-code-review-fix 21](../../../) to auto-fix WR-01/WR-02 if desired, or proceed to phase verification._
