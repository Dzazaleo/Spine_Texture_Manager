---
status: partial
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
source: [21-VERIFICATION.md]
started: 2026-05-02T00:51:00Z
updated: 2026-05-02T00:51:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag-drop atlas-less project (LOAD-01 / ROADMAP criterion #1)
expected: Drop `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` onto a running dev build (`npm run dev`). No AtlasNotFoundError modal surfaces. Global Max Render Source panel + Animation Breakdown panel populate with rows whose Source W/H columns match the PNG IHDR dims (cross-check via `sips -g pixelWidth -g pixelHeight` on each fixture PNG).
result: [pending]

### 2. loaderMode toggle visual + functional (LOAD-01 / D-08 UI surface)
expected: With an atlas-less project loaded, the checkbox "Use Images Folder as Source" is visible in the toolbar (right-aligned cluster, between SearchBar and Atlas Preview button). Drop the canonical `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — checkbox shows UNCHECKED. Click to ENABLE atlas-less mode — wait for resample (loading spinner brief) — panels REPOPULATE with png-header-derived dims.
result: [pending]

### 3. Save / Reopen round-trip preserves loaderMode (LOAD-01 / D-08 persistence)
expected: With canonical SIMPLE_PROJECT loaded and toggle ENABLED, File → Save (Cmd+S) to a tmp `.stmproj`. Close project (drop different fixture or reload window). Open the saved `.stmproj` — toggle returns to ENABLED state; panels populate via atlas-less path with the same dims as the pre-Save state.
result: [pending]

### 4. MissingImagesDirError dialog renders typed (not "Unknown error")
expected: Create a tmpdir with ONLY the JSON (no `images/` folder). Drop the JSON onto the dev app while the loaderMode toggle is checked (atlas-less). The error dialog must be structured (not "Unknown error") and the human-readable message must mention "images/ folder" or "atlas-less".
result: [pending]

### 5. AtlasNotFoundError verbatim message preserved in user-facing dialog (ROADMAP criterion #5)
expected: Create a tmpdir with ONLY the JSON. Manually create a `.stmproj` adjacent that pins explicit `atlasPath` to a nonexistent file. Open that `.stmproj`. The error dialog must show the verbatim message: "Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). Re-export from the Spine editor with the atlas included." (locked from `src/core/errors.ts:44-47`).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
