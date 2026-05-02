---
status: partial
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
source: [21-VERIFICATION.md]
started: 2026-05-02T00:51:00Z
updated: 2026-05-02T01:30:00Z
---

## Current Test

Test 5 (in progress); Tests 1, 3 still pending.

## Tests

### 1. Drag-drop atlas-less project (LOAD-01 / ROADMAP criterion #1)
expected: Drop `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` onto a running dev build (`npm run dev`). No AtlasNotFoundError modal surfaces. Global Max Render Source panel + Animation Breakdown panel populate with rows whose Source W/H columns match the PNG IHDR dims (cross-check via `sips -g pixelWidth -g pixelHeight` on each fixture PNG).
result: [pending]

### 2. loaderMode toggle visual + functional (LOAD-01 / D-08 UI surface)
expected: With an atlas-less project loaded, the checkbox "Use Images Folder as Source" is visible in the toolbar (right-aligned cluster, between SearchBar and Atlas Preview button). Drop the canonical `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — checkbox shows UNCHECKED. Click to ENABLE atlas-less mode — wait for resample (loading spinner brief) — panels REPOPULATE with png-header-derived dims.
result: [passed — covered in earlier session]

### 3. Save / Reopen round-trip preserves loaderMode (LOAD-01 / D-08 persistence)
expected: With canonical SIMPLE_PROJECT loaded and toggle ENABLED, File → Save (Cmd+S) to a tmp `.stmproj`. Close project (drop different fixture or reload window). Open the saved `.stmproj` — toggle returns to ENABLED state; panels populate via atlas-less path with the same dims as the pre-Save state.
result: [pending]

### 4. MissingImagesDirError dialog renders typed (not "Unknown error")
expected: Create a tmpdir with ONLY the JSON (no `images/` folder). Drop the JSON onto the dev app while the loaderMode toggle is checked (atlas-less). The error dialog must be structured (not "Unknown error") and the human-readable message must mention "images/ folder" or "atlas-less".
result: [partial-pass with new bugs surfaced]

  Sub-case (a) PASSED — drop JSON with NO `images/` folder content (whole folder emptied): MissingImagesDirError fires correctly with full enumerated PNG list. Verified on `fixtures/Girl copy 2/TOPSCREEN_ANIMATION_JOKER.json`.

  Sub-case (b) FAILED — see Gaps section, item G-01: deleting a single mesh-attachment PNG (e.g., `JOKER/BODY.png`) crashes with `Unknown: Cannot read properties of null (reading 'bones')` instead of either succeeding-with-skip (region behavior) or surfacing a typed MissingImagesDirError.

  Sub-case (c) FAILED — see Gaps section, item G-02: deleting a single region-attachment PNG (e.g., `MAGIC_EXPLOSION/00.png`) loads silently with the attachment dropped from the Max Render Scale panel; no warning surfaces.

### 5. AtlasNotFoundError verbatim message preserved in user-facing dialog (ROADMAP criterion #5)
expected: Create a tmpdir with ONLY the JSON. Manually create a `.stmproj` adjacent that pins explicit `atlasPath` to a nonexistent file. Open that `.stmproj`. The error dialog must show the verbatim message: "Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). Re-export from the Spine editor with the atlas included." (locked from `src/core/errors.ts:44-47`).
result: [pending]

## Summary

total: 5
passed: 1
issues: 1 (Test 4 partial-pass with 2 sub-bugs)
pending: 3
skipped: 0
blocked: 0

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
