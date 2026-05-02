---
phase: 21
phase_name: seed-001-atlas-less-mode-json-images-folder-no-atlas
scope: gap-closure (plans 21-09, 21-10, 21-11 + post-merge CSS fixes + 21-12 G-04 toggle-resample precedence)
reviewed_at: 2026-05-02T18:28:29Z
last_reviewed_at: 2026-05-02
reviewer: gsd-code-reviewer (Claude)
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/core/loader.ts
  - src/core/synthetic-atlas.ts
  - src/core/types.ts
  - src/main/summary.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/MissingAttachmentsPanel.tsx
  - src/shared/types.ts
  - tests/core/documentation.spec.ts
  - tests/core/loader-atlas-less.spec.ts
  - tests/core/summary.spec.ts
  - tests/core/synthetic-atlas.spec.ts
  - tests/renderer/missing-attachments-panel.spec.tsx
  - src/main/project-io.ts
  - src/main/sampler-worker.ts
  - tests/main/project-io.spec.ts
  - tests/main/sampler-worker.spec.ts
status: issues_found
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
preserves: 21-REVIEW-plans-01-08.md (original 8-plan review from commit 434ce95)
sessions:
  - label: Gap closure G-01 / G-02 / G-03 (3fec6ac)
    findings: 0 critical / 2 warning / 5 info
  - label: Gap closure G-04 (HEAD)
    findings: 0 critical / 0 warning / 3 info
---

# Phase 21 Code Review — Gap-Closure Sessions

This file aggregates code-review findings across BOTH gap-closure sessions for phase 21. Latest session is at the bottom.

The original 8-plan code review is preserved at [21-REVIEW-plans-01-08.md](21-REVIEW-plans-01-08.md) (commit `434ce95`, 0 critical / 2 warning / 5 info, scope: plans 21-01 through 21-08).

---

## Prior session: Gap closure G-01 / G-02 / G-03 (3fec6ac)

**Reviewed:** 2026-05-02T18:28:29Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found (0 critical / 2 warning / 5 info)

### Scope (prior session)

This review targets ONLY the changes from the Phase 21 gap-closure session covering G-01 / G-02 / G-03.

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

### Summary (prior session)

The core implementation is solid: filter logic uses an O(N+M) `Set<string>`, IPC types are end-to-end consistent with appropriate optional/required discipline, the new test surfaces are non-vacuous, and the layered CSS fixes are well-justified. **No critical issues found.**

Per scope-note checklist:

1. **Optional vs required field discipline** — verified consistent. `LoadResult.skippedAttachments?:` (optional, [src/core/types.ts:153](../../../src/core/types.ts#L153)) is correctly defaulted to `[]` at the buildSummary write site ([src/main/summary.ts:181](../../../src/main/summary.ts#L181)), populating the required `SkeletonSummary.skippedAttachments` ([src/shared/types.ts:553](../../../src/shared/types.ts#L553)).
2. **Defensive `?? []` fallbacks in AppShell** — only ONE site (line 1510). See WR-01.
3. **summary.ts filter logic** — `skippedNames` Set built once ([src/main/summary.ts:60-62](../../../src/main/summary.ts#L60-L62)), three O(N) filter calls. Correct.
4. **Four layered CSS fixes** — non-conflicting. `min-h-screen` on root works alongside `flex-1 overflow-auto` `<main>`; only `<td>` accents and modals use `h-full`. See IN-04 for a minor scrolling-overflow consideration.
5. **Test coverage** — all new tests are non-vacuous. summary.spec.ts UNIT test ([tests/core/summary.spec.ts:152](../../../tests/core/summary.spec.ts#L152)) explicitly motivates falsifying ISSUE-003.

### Warnings (prior session)

#### WR-01: Runtime `?? []` guard contradicts required-field type contract

**File:** [src/renderer/src/components/AppShell.tsx:1510](../../../src/renderer/src/components/AppShell.tsx#L1510)

**Issue:** `SkeletonSummary.skippedAttachments` is declared REQUIRED in [src/shared/types.ts:553](../../../src/shared/types.ts#L553) and populated unconditionally by `buildSummary` ([src/main/summary.ts:181](../../../src/main/summary.ts#L181) uses `load.skippedAttachments ?? []`). But the renderer pass-through site uses `effectiveSummary.skippedAttachments ?? []` because "older renderer-side test fixtures cast a partial summary via `as unknown as SkeletonSummary` and omit the field" (per the inline comment at lines 1500-1509). The `?? []` is a workaround for fixture type-laundering, not for any runtime path the production code exercises. This conflates a test-fixture maintenance shortcut with a production safety guard, and the `?? []` will silently mask future regressions where buildSummary actually fails to populate the field.

**Fix:** Either (a) update the offending test fixtures to populate `skippedAttachments: []` explicitly (preferred — matches [tests/core/documentation.spec.ts:247](../../../tests/core/documentation.spec.ts#L247) which already does this), then drop the `?? []`; or (b) widen the `MissingAttachmentsPanelProps` type to accept `skippedAttachments?: ...` and let the panel handle undefined natively. Option (a) is consistent with the field being required per the IPC contract.

#### WR-02: `for...in` loop body uses non-null assertion that can mask runtime errors

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

### Info (prior session)

#### IN-01: `imagesDir` path computed three times in same function

**File:** [src/core/loader.ts:243, 303, 405](../../../src/core/loader.ts#L243)

`path.join(path.dirname(skeletonPath), 'images')` is computed in three separate branches as `dirOfImages`, `probeImagesDir`, and `imagesDir`. All resolve to the same value; minor DRY violation.

**Fix:** Hoist a single `const imagesDir = ...` near the top of `loadSkeleton`, then reference in all three branches.

#### IN-02: Dead `endsWith('.png')` ternary branch

**File:** [src/core/loader.ts:492](../../../src/core/loader.ts#L492)

`name: filename.endsWith('.png') ? filename.slice(0, -4) : filename` — the synthesizer ([src/core/synthetic-atlas.ts:181](../../../src/core/synthetic-atlas.ts#L181)) always pushes `regionName + '.png'`, so the fallback branch is unreachable.

**Fix:** Drop the conditional (`name: filename.slice(0, -4)`) or push raw region names from the synthesizer and append `.png` only at the renderer-display site.

#### IN-03: Synthesizer's loader-side `imagesDir` pre-check is redundant with the synthesizer's own check

**File:** [src/core/loader.ts:303-313](../../../src/core/loader.ts#L303-L313)

The fall-through atlas-less branch pre-checks `imagesDirExists` before calling `synthesizeAtlasText`, but `synthesizeAtlasText` performs the same check and throws `MissingImagesDirError` ([src/core/synthetic-atlas.ts:134-150](../../../src/core/synthetic-atlas.ts#L134-L150)). The loader-side pre-check exists to swap `MissingImagesDirError` for `AtlasNotFoundError` in the legacy "no atlas, no images" case (preserves ROADMAP success criterion #5). Intent documented; duplicate `statSync` is wasteful (~µs, irrelevant).

**Fix:** Document-only or restructure so the loader passes `{ throwLegacy: true }` to the synthesizer. Not worth the refactor cost.

#### IN-04: Inner-section `min-h-[calc(100vh-200px)]` magic-number does not account for MissingAttachmentsPanel banner height

**File:** [src/renderer/src/panels/GlobalMaxRenderPanel.tsx:797](../../../src/renderer/src/panels/GlobalMaxRenderPanel.tsx#L797)

The 200px offset (header + tab strip + bottom padding) does not account for the `MissingAttachmentsPanel` banner (~30-50px of additional chrome when atlas-less mode encounters missing PNGs). The inner virtualized scroll container at line 878 uses fixed `height: 'calc(100vh - 200px)'`, so when the banner is visible it can overflow viewport by banner-height. The `<main>` parent's `overflow-auto [scrollbar-gutter:stable]` handles this gracefully, but inner + outer scrollbars may co-exist visually in the rare missing-PNG case.

**Fix:** Either subtract a banner-height offset dynamically (requires measurement), or accept the dual-scrollbar artifact. Not a regression — same calculation pre-21-11; banner is the new variable.

#### IN-05: Test creates tmp file outside try-block; potential leak on writeFileSync failure

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

## This session: Gap closure G-04 (HEAD, plan 21-12)

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found (0 critical / 0 warning / 3 info)
**Diff base:** `3fec6ac..HEAD`

### Scope (G-04 session)

Plan 21-12 — toggle-resample-into-atlas-less-precedence. Caller-side LoaderOptions construction was rebuilt at five call sites so the loader's D-08 synthesis branch reaches when `loaderMode === 'atlas-less'`, even if the cached state still carries an `atlasPath`. Changes target the `if (loaderMode === 'atlas-less') { ...; /* omit atlasPath */ } else if (atlasPath !== undefined) ...` precedence pattern at:

- [src/main/project-io.ts](../../../src/main/project-io.ts) — Site 1 (`handleProjectOpenFromPath` line 414-420), Site 4 (`handleProjectResample` line 901-907).
- [src/main/sampler-worker.ts](../../../src/main/sampler-worker.ts) — Site 5 (`runSamplerJob` line 113-119).
- Site 3 (`handleProjectReloadWithSkeleton` line 700-705) was already shape-correct from Plan 21-08; G-04 added a pin-locking comment only.

Plus three new test gates:

- [tests/core/loader-atlas-less.spec.ts](../../../tests/core/loader-atlas-less.spec.ts) — two new tests (lines 241, 294): `D-06 wins when both opts set` (loader-contract pin) and `caller-correct` (post-fix shape).
- [tests/main/project-io.spec.ts](../../../tests/main/project-io.spec.ts) — new `handleProjectResample` IPC test (line 297) with new `runSamplerInWorker` + `BrowserWindow.getAllWindows` mocks.
- [tests/main/sampler-worker.spec.ts](../../../tests/main/sampler-worker.spec.ts) — new direct-invocation `runSamplerJob` test (line 171) covering Site 5.

### Summary (G-04 session)

Sites 1, 4, and 5 implement the precedence pattern identically — `if (loaderMode === 'atlas-less') { …; /* omit atlasPath */ } else if (atlasPath !== undefined) { … }`. Site 3 has a structurally-different but semantically-equivalent shape (`atlasPath` was always omitted at this call site by F1.2 sibling-discovery design; only `loaderMode` is conditionally set). The fix is correct at every site reviewed.

The new vitest gates are **genuinely falsifying**:

- The loader-contract test (line 241) writes a tmp `.atlas` containing `MESH_REGION` so the D-06 branch parses cleanly; the assertion shape collapses to `result.atlasPath === path.resolve(tmpAtlas)` and `skippedAttachments === []`, both of which would invert pre-fix vs post-fix if the loader's branch order ever flipped.
- The caller-correct test (line 294) is the post-fix shape gate; pre-fix it would receive D-06 behavior (atlasPath wins) and `skippedAttachments` would be empty — assertion fails.
- The IPC test (`tests/main/project-io.spec.ts:323`) and the worker-direct test (`tests/main/sampler-worker.spec.ts:191`) both mount a synthesized atlas so D-06 succeeds for the wrong reason pre-fix; the load-bearing assertion is `summary.skippedAttachments.length === 1` (IPC) and `result.type === 'complete'` (worker, against an atlas WITHOUT MESH_REGION so the AtlasAttachmentLoader throws if D-06 wins). Both are correctly designed to fail pre-fix.

**No critical issues. No warnings. Three Info items below.**

Per scope-note checklist:

1. **Identical precedence pattern at Sites 1 / 4 / 5** — verified. The three sites use the exact same `if/else if` shape and identical comment ("atlasPath intentionally OMITTED — D-08 synthesis must run.").
2. **No simultaneous `loaderMode='atlas-less'` + `atlasPath` to the loader** — verified at all four loader-call sites (project-io.ts:421, project-io.ts:705, project-io.ts:908, sampler-worker.ts:120). The else-if structure makes simultaneous-set unreachable.
3. **Falsifying gate strength** — all four new tests would fail against the pre-fix implementation (verified by tracing branch flow against the loader source at src/core/loader.ts:219-254).
4. **IPC mock fidelity** — `runSamplerInWorker` is mocked to return `{type:'complete', output: {globalPeaks: new Map(), perAnimation: new Map(), setupPosePeaks: new Map()}}`. The IPC test's load-bearing assertion is on `result.project.summary.skippedAttachments`, which `buildSummary` derives from `load.skippedAttachments` (verified at [src/main/summary.ts:181](../../../src/main/summary.ts#L181)) — i.e. from the loader's output, NOT from the sampler. The mock is fidelity-correct: empty sampler Maps are sufficient because the assertion shape doesn't reach them. `BrowserWindow.getAllWindows` is mocked to `[]` so `[0]?.webContents` resolves to `undefined`, then to `null` via `?? null`. The bridge mock ignores webContents anyway. Mock is sound.

### Critical (G-04 session)

None.

### Warnings (G-04 session)

None.

### Info (G-04 session)

#### IN-06: Worker-boundary call still passes both `atlasRoot` AND `loaderMode='atlas-less'`; correctness depends solely on Site 5 disambiguating

**File:** [src/main/project-io.ts:497-505](../../../src/main/project-io.ts#L497-L505), [src/main/project-io.ts:961-969](../../../src/main/project-io.ts#L961-L969)

The `runSamplerInWorker` call at Site 2 (`handleProjectOpenFromPath`, line 500) sets `atlasRoot: materialized.atlasPath !== null ? materialized.atlasPath : undefined` UNCONDITIONALLY of `loaderMode`. Likewise Site 4-worker (line 964) passes `atlasRoot: atlasPath` regardless of `resampleLoaderMode`. The bridge at [src/main/sampler-worker-bridge.ts:75](../../../src/main/sampler-worker-bridge.ts#L75) forwards `params` verbatim into `workerData`, so both fields cross the postMessage boundary together.

This is fine in practice — Site 5 (the worker's `runSamplerJob`) applies the same `if/else if` precedence rule and correctly omits `atlasPath` when `loaderMode === 'atlas-less'`. But the asymmetry is worth flagging: the load-call sites (Sites 1, 4) clear `atlasPath` ahead of `loadSkeleton`, while the worker-call sites (Sites 2, 4-worker) defer disambiguation to Site 5. If a future refactor strips Site 5's precedence rule (or changes the worker's loader-call shape), the worker boundary becomes a silent regression vector.

**Fix (low priority):** For consistency with the load-call site pattern, also filter `atlasRoot` at the worker-call sites:
```ts
const samplerParams = {
  skeletonPath: materialized.skeletonPath,
  atlasRoot: materialized.loaderMode === 'atlas-less'
    ? undefined
    : materialized.atlasPath ?? undefined,
  samplingHz: materialized.samplingHz,
  loaderMode: materialized.loaderMode,
};
```
Site 5's defense-in-depth check stays as a safety net. Not a bug today; pure symmetry/maintainability concern.

#### IN-07: Three sites repeat the identical `loaderOpts` builder verbatim — extract a helper

**File:** [src/main/project-io.ts:414-420](../../../src/main/project-io.ts#L414-L420), [src/main/project-io.ts:901-907](../../../src/main/project-io.ts#L901-L907), [src/main/sampler-worker.ts:113-119](../../../src/main/sampler-worker.ts#L113-L119)

The post-fix builder is:
```ts
const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
if (loaderMode === 'atlas-less') {
  loaderOpts.loaderMode = 'atlas-less';
  // atlasPath intentionally OMITTED — D-08 synthesis must run.
} else if (atlasPath !== undefined) {
  loaderOpts.atlasPath = atlasPath;
}
```
appearing verbatim at three sites (project-io.ts Sites 1 + 4, sampler-worker.ts Site 5) plus a fourth structurally-similar site (project-io.ts Site 3, where atlasPath is always omitted). Future refactors must update all three (or four) in lockstep — the same drift vector that produced G-04 in the first place.

**Fix (low priority):** Hoist a small helper into a shared module (e.g. `src/core/loader-opts.ts`):
```ts
export function buildLoaderOpts(
  loaderMode: 'auto' | 'atlas-less' | undefined,
  atlasPath: string | null | undefined,
): { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } {
  if (loaderMode === 'atlas-less') return { loaderMode: 'atlas-less' };
  if (atlasPath !== undefined && atlasPath !== null) return { atlasPath };
  return {};
}
```
Each call site then becomes one line. Note the helper must live in `src/core/` (NOT `src/main/`) so `sampler-worker.ts` can import it without violating Layer 3 (worker only imports `node:worker_threads`, `../core/*`, `../shared/types`).

#### IN-08: `handleProjectResample` — `resampleLoaderMode` validation is more lenient than the load-call branch

**File:** [src/main/project-io.ts:902, 954-959](../../../src/main/project-io.ts#L902)

At line 902 (the `loadSkeleton` call site), the precedence test is `if (a.loaderMode === 'atlas-less')` — a raw string-equality on the unverified `Record<string, unknown>` arg. Any non-`'atlas-less'` value (`undefined`, `'auto'`, garbage) falls through to the canonical-mode arm. Correct by construction.

At line 954-959 (the worker-call site), `resampleLoaderMode` is validated as `'atlas-less' | 'auto' | undefined`:
```ts
const resampleLoaderMode: 'auto' | 'atlas-less' | undefined =
  a.loaderMode === 'atlas-less'
    ? 'atlas-less'
    : a.loaderMode === 'auto'
      ? 'auto'
      : undefined;
```

So if the IPC payload arrives with `loaderMode: 'auto'`, the load-call site treats it as canonical-mode (no `loaderMode` set on `loaderOpts`) but the worker call site EXPLICITLY threads `loaderMode: 'auto'` to the worker. This disparity has no observable effect today (the loader's branches at line 219, 241, 255 collapse `loaderMode: undefined` and `loaderMode: 'auto'` into the same D-05/D-07 fall-through), but a future loader change that distinguishes `'auto'` (e.g., "force sibling discovery") from `undefined` (e.g., "no preference") would silently desync the two paths.

**Fix (low priority):** Either thread `resampleLoaderMode` to the load call too (`loaderOpts.loaderMode = resampleLoaderMode` when not undefined), or simplify both sites to share the same validation pass. Aligns with IN-07's helper extraction.

---

_Last reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

_Next steps: Run [/gsd-code-review-fix 21](../../../) to auto-fix WR-01/WR-02 (carry-over from prior session) if desired, or proceed to phase verification. The G-04 session adds three Info items only — no new actionable warnings._
