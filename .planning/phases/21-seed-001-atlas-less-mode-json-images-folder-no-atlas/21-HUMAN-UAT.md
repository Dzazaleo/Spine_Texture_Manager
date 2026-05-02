---
status: passed
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
source: [21-VERIFICATION.md]
started: 2026-05-02T00:51:00Z
updated: 2026-05-02T21:30:00Z
---

## Current Test

number: complete
name: All UAT items passed; 2 follow-up items captured for backlog (out of Phase 21 scope).
result: phase 21 approved by user 2026-05-02
awaiting: backlog capture + phase close-out

## Tests

### 1. Drag-drop atlas-less project (LOAD-01 / ROADMAP criterion #1)
expected: Drop `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` onto a running dev build (`npm run dev`). No AtlasNotFoundError modal surfaces. Global Max Render Source panel + Animation Breakdown panel populate with rows whose Source W/H columns match the PNG IHDR dims (cross-check via `sips -g pixelWidth -g pixelHeight` on each fixture PNG).
result: passed

### 2. loaderMode toggle visual + functional (LOAD-01 / D-08 UI surface)
expected: With an atlas-less project loaded, the checkbox "Use Images Folder as Source" is visible in the toolbar (right-aligned cluster, between SearchBar and Atlas Preview button). Drop the canonical `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — checkbox shows UNCHECKED. Click to ENABLE atlas-less mode — wait for resample (loading spinner brief) — panels REPOPULATE with png-header-derived dims.
result: passed

### 3. Save / Reopen round-trip preserves loaderMode (LOAD-01 / D-08 persistence)
expected: With canonical SIMPLE_PROJECT loaded and toggle ENABLED, File → Save (Cmd+S) to a tmp `.stmproj`. Close project (drop different fixture or reload window). Open the saved `.stmproj` — toggle returns to ENABLED state; panels populate via atlas-less path with the same dims as the pre-Save state.
result: passed

### 4. MissingImagesDirError dialog renders typed (not "Unknown error")
expected: Create a tmpdir with ONLY the JSON (no `images/` folder). Drop the JSON onto the dev app while the loaderMode toggle is checked (atlas-less). The error dialog must be structured (not "Unknown error") and the human-readable message must mention "images/ folder" or "atlas-less".
result: [partial-pass with new bugs surfaced]

  Sub-case (a) PASSED — drop JSON with NO `images/` folder content (whole folder emptied): MissingImagesDirError fires correctly with full enumerated PNG list. Verified on `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json`.

  Sub-case (b) FAILED — see Gaps section, item G-01: deleting a single mesh-attachment PNG (e.g., `JOKER/BODY.png`) crashes with `Unknown: Cannot read properties of null (reading 'bones')` instead of either succeeding-with-skip (region behavior) or surfacing a typed MissingImagesDirError.

  Sub-case (c) FAILED — see Gaps section, item G-02: deleting a single region-attachment PNG (e.g., `MAGIC_EXPLOSION/00.png`) loads silently with the attachment dropped from the Max Render Scale panel; no warning surfaces.

### 4b (re-test 2026-05-02) — G-01 closure verification (post-21-09 / 21-10 merge)
expected: With Plan 21-09 stub-region machinery merged: drop an atlas-less project with a single MESH-attachment PNG deleted (e.g. JOKER/BODY.png). App must not crash; missing entry must appear in MissingAttachmentsPanel.
result: passed (G-01 + G-04 closures verified via UAT walkthrough)
reported: |
  Path 1 (atlas-less project — JSON has no .atlas beside it, app reads from images/ on first load):
  PASSED — load does not crash; MissingAttachmentsPanel correctly shows the missing JOKER/BODY entry.

  Path 2 (canonical project with .atlas present, then user toggles "Use Images Folder as Source" ON to switch into atlas-less mode):
  PASSED 2026-05-02 (post-21-12 merge) — G-04 closed by Plan 21-12 caller-side LoaderOptions
  precedence fix at project-io.ts Sites 1+4 + sampler-worker.ts Site 5. The resample-into-atlas-less
  path now produces the same `summary.skippedAttachments` shape as the cold-load path; the
  MissingAttachmentsPanel surfaces the missing entry identically.

### 5. AtlasNotFoundError verbatim message preserved in user-facing dialog (ROADMAP criterion #5)
expected: Create a tmpdir with ONLY the JSON. Manually create a `.stmproj` adjacent that pins explicit `atlasPath` to a nonexistent file. Open that `.stmproj`. The error dialog must show the verbatim message: "Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). Re-export from the Spine editor with the atlas included." (locked from `src/core/errors.ts:44-47`).
result: passed — verified on `fixtures/Girl copy 2/test5-atlas-not-found.stmproj` (atlasPath='DOES_NOT_EXIST.atlas'). Dialog shows the verbatim string word-for-word, with `Skeleton:` + `Expected atlas at:` lines appended after — the locked criterion-#5 message is intact.

NOTE: surfaced two minor authoring issues on the way (out of Phase 21 scope, no fix needed):
- macOS TextEdit defaults to RTF — easy gotcha for test setup. Documented in 21.1 plan if any.
- `.stmproj` validator requires all 11 fields explicitly set (no implicit nullability). May be worth a follow-up to allow optional fields with sensible defaults.

## Summary

total: 5 (+ 1 re-test sub-case 4b post-21-09/21-10/21-12 merge)
passed: 5 (Tests 1, 2, 3, 4b/Path 1+2, 5 all confirmed pass by user 2026-05-02)
issues: 0 — all 4 surfaced gaps (G-01, G-02, G-03, G-04) are now closed and re-verified
pending: 0
skipped: 0
blocked: 0

## Follow-up feedback captured (out of Phase 21 scope; routed to backlog)

- **F-01: missing-attachments display in main panels.** Currently `summary.ts` filters `peaks`/`animationBreakdown` to drop entries whose `attachmentName` matches `skippedAttachments[*].name` (Plan 21-10 must_have). User feedback: keep those rows visible in Global Max Render + Animation Breakdown panels, marked with a red accent + danger triangle (⚠) next to the name. MissingAttachmentsPanel stays as the dedicated surface; rows also keep their natural context.
- **F-02: AtlasNotFoundError message should mention the images-folder alternative.** Current verbatim message ("Re-export from the Spine editor with the atlas included") is preserved by ROADMAP criterion #5. User feedback: the message should also tell users that placing an `images/` folder beside the JSON and enabling "Use Images Folder as Source" is a valid alternative. Implementing this requires revising criterion #5 first.

## Gaps

### G-01 — Mesh-attachment crash on missing PNG (Phase 21 scope gap)

**Severity:** high — typed-error contract broken; raw JS TypeError surfaces to user with kind: 'Unknown' instead of a structured MissingImagesDirError.

**Reproduction:**
1. Open `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json` with images/ folder mostly intact
2. Delete a single mesh-attachment PNG, e.g. `images/JOKER/BODY.png`
3. Drop the JSON onto the dev app

**Observed:**
```
Unknown: Cannot read properties of null (reading 'bones')
Dropped: TOPSCREEN_ANIMATION_JOKER.json
```

**Expected:** either MissingImagesDirError (listing the missing mesh PNG), or successful load with the mesh attachment silently skipped + visible "MISSING" warning panel (preferred — see G-02).

**Root-cause hypothesis (validated by mesh-vs-region asymmetry):**
- Plan 21-04's `SilentSkipAttachmentLoader.newRegionAttachment` returns `null` when the PNG is absent. SkeletonJson's region-attachment path tolerates null (silently skips).
- The mesh-attachment construction path (`SkeletonJson.readAttachment` for type='mesh' / 'linkedmesh') reads `region.bones` on the returned attachment without a null check → JS TypeError.
- Confirmed by the asymmetric behavior: deleting `MAGIC_EXPLOSION/*.png` (all regions, no meshes) loads successfully with attachments silently dropped; deleting any mesh PNG in `JOKER/` crashes.

**Fix sketch (for 21.1 plan):** Extend `SilentSkipAttachmentLoader` to also override `newMeshAttachment` and `newLinkedMesh` with the same null-on-missing behavior, OR change SkeletonJson's mesh path to null-check the loader return.

### G-02 — Missing PNGs not surfaced to user (Phase 21 UX gap)

**Severity:** medium — silent failure; user has no signal that attachments were dropped.

**Reproduction:**
1. Open atlas-less project with images/ folder mostly intact
2. Delete a single region-attachment PNG, e.g. `images/MAGIC_EXPLOSION/00.png`
3. Drop the JSON onto the dev app

**Observed:** App loads normally. The attachment for `MAGIC_EXPLOSION/00.png` is absent from the Max Render Scale panel. No warning, no badge, no panel highlights the gap.

**Expected:** a "MISSING" panel above the Max Render Scale panel listing dropped attachments + their expected PNG paths. The user should be able to see at a glance that the project loaded with N missing assets, not just trust that the panel is complete.

**Why it matters:** Plan 21-04's silent-skip behavior was deliberate (atlas-less mode shouldn't fail just because a non-essential PNG is absent). But silence is the wrong UX — the user needs visibility into what was skipped.

**Fix sketch (for 21.1 plan):** SilentSkipAttachmentLoader already has the missing-PNG list internally (it's logged in MissingImagesDirError when 100% of PNGs are absent); thread that list through the loader return → MaterializedProject → renderer → new MissingAttachmentsPanel rendered above GlobalMaxRenderPanel when length > 0.

### G-03 — UI layout regression: panel slides toward center on filter-from-attachment

**Severity:** medium — visual regression that wasn't present before Phase 21.

**Reproduction:**
1. Load a project (any fixture)
2. Use the per-attachment filter feature
3. Observe panel positioning shift

**Observed:** UI changes position downward, toward the center of the window.

**Expected:** UI position should remain stable across filter operations.

**Root-cause hypothesis:** Plan 21-08 added the "Use Images Folder as Source" checkbox to the AppShell toolbar. The toolbar reflow may have changed flex/grid metrics in a way that interacts with the filter feature's render path. Bisect against base commit `f09c29b` to confirm.

**Fix sketch (for 21.1 plan):** Bisect `git diff f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx` and any modified panel component; restore stable layout while preserving the loaderMode toggle.

**RESOLVED 2026-05-02:** Closed by Plan 21-11 (cumulative fix chain `b8f2a0f` + `30ff95f` + `a9e0c0a` + `8a0a6ec`). Root cause was `h-full` on a height-less parent chain in `AppShell.tsx:1243`; final fix changed it to `min-h-screen`. User confirmation: "issue resolved" (UAT-3, see 21-11-toolbar-layout-regression-SUMMARY.md).

### G-04 — Toggle-resample-into-atlas-less path does NOT re-detect missing PNGs

**Severity:** high — G-01/G-02 fixes are path-asymmetric. The cold-load atlas-less path (Plan 21-09 + 21-10) correctly threads `LoadResult.skippedAttachments` → `SkeletonSummary.skippedAttachments` → MissingAttachmentsPanel. But when the user starts on a CANONICAL project (.atlas present) and then toggles "Use Images Folder as Source" ON to switch into atlas-less mode mid-session, the resample path does not surface missing PNGs.

**Reproduction:**
1. Start with a canonical project (.atlas present beside JSON), images/ folder also present.
2. Delete a single PNG (e.g. `images/JOKER/BODY.png`) from the images/ folder while the project is loaded.
3. Toggle the "Use Images Folder as Source" checkbox ON.
4. App resamples and switches to atlas-less mode.

**Observed:** The sampling-skeleton panel renders. The deleted JOKER/BODY entry still appears in the Max Render Source list with stale dims (carried over from the canonical .atlas's region metadata). No MissingAttachmentsPanel banner surfaces. The user has no signal that the PNG is missing.

**Expected:** the resample-into-atlas-less path should re-run synthetic-atlas synthesis from the JSON+images/ folder (NOT reuse the canonical .atlas's cached region metadata) and produce the same `skippedAttachments` array that the cold-load path produces. The MissingAttachmentsPanel should then surface the missing entry identically.

**Root-cause hypothesis (to be validated by debug agent):**
- The resample IPC handler in `src/main/project-io.ts` site 4 (resampleProject, ~line 870-877) threads `loaderMode` through to the worker, but may be reading region metadata from the previously-canonical-mode `MaterializedProject` cache instead of re-running `loadSkeleton()` with `loaderMode: 'atlas-less'` from scratch.
- OR: `loadSkeleton` is re-run, but the canonical-mode `atlasPath` is still passed in and wins precedence over the `loaderMode === 'atlas-less'` override (Plan 21-06's 4-way branch order: `opts.atlasPath !== undefined` is checked BEFORE `opts.loaderMode === 'atlas-less'` per loader.ts:214 vs :236 — and the explicit-atlasPath branch does not consult the synthetic-atlas pipeline at all, so it never produces `skippedAttachments`).
- The asymmetry between PASSING-Path-1 (cold-load → no .atlas in tree → loader naturally falls into D-08 branch) and FAILING-Path-2 (canonical-load-then-toggle → .atlas was already loaded, `atlasPath` is non-null in the resample payload → loader takes the canonical D-06 branch even though `loaderMode === 'atlas-less'`) is consistent with this hypothesis.

**Fix sketch (for gap-closure plan 21-12 or similar):**
- When `loaderMode === 'atlas-less'` is set on a resample, ensure the resample handler builds `loaderOpts` with `atlasPath: undefined` (clearing any cached canonical atlasPath) so that the loader's branch order routes through the synthetic-atlas + SilentSkipAttachmentLoader path. This re-derives `skippedAttachments` from the current images/ folder state.
- Add a regression test mirroring `tests/core/loader-atlas-less.spec.ts` Test 6 but exercising the toggle-resample path (load with atlas → toggle to atlas-less → assert `skippedAttachments` is populated when a PNG is missing).

**RESOLVED 2026-05-02:** Closed by Plan 21-12 (commits `179b1dd` test + `de99e84` fix + `0a31aee` test + `fee0070` fix-recovery + `9b70056` test + `3180661` docs). Caller-side LoaderOptions precedence pattern applied identically at project-io.ts Sites 1 + 4 and sampler-worker.ts Site 5: when `loaderMode === 'atlas-less'`, set `loaderOpts.loaderMode = 'atlas-less'` and OMIT `atlasPath` so the loader's D-08 synthesis branch runs. `src/core/loader.ts` is UNCHANGED (criterion #5 verbatim AtlasNotFoundError preserved). 4 G-04 regression tests added (2 loader-contract + 1 IPC integration + 1 worker-boundary); 630/630 vitest passing post-fix. UAT 4b Path 2 confirmed by user 2026-05-02.
