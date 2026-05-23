---
created: 2026-05-23
type: feature
status: pending
target_milestone: v1.8
deferred_from: user request after Phase 51 UAT (2026-05-23) — flagged "if not convenient, save for later"
---

# Persist Export-Variant rows + output location in the .stmproj project file

When a project is saved, the **Export Variant** dialog's state should round-trip across
sessions:

1. **The scale rows** — the list of `{ scale }` rows the user built (e.g. 0.5 / 0.36 /
   0.57), so reopening the project restores them instead of resetting to the single
   default row at 0.5.
2. **The output (parent) location** — the last parent folder the user exported variants
   into, so the picker can pre-fill / default to it next time.

User words (2026-05-23, after the Phase-51 batch UAT): *"rows added in the Export Variant
dialog and saving location should persist across sessions, if project is saved."*

## Why this was deferred (not done inline)

This changes the persisted `.stmproj` data format. v1.7 was complete + verified at the
time of the request; a schema-touching feature belongs in a planned cycle, not a
post-close patch. There are real design decisions (below).

## Established pattern to follow (low risk)

`.stmproj` already persists optional config additively with NO version bump and a
missing→default massage in the validator — precedents in `src/shared/types.ts`:
`sharpenOnExport?` (≈970/1144), `safetyBufferPercent?` (≈970/1148), `overridesAtlasLess`
(≈1117). Add `variantRows?` + `variantOutputDir?` the same way:
- `AppSessionState` / `ProjectFileV1` (the in-memory + on-disk shapes) — additive optional.
- The load validator pre-massages missing → defaults (`variantRows` → `[{ scale: 0.5 }]`
  equivalent on open; `variantOutputDir` → null).
- Save serializes the current `variantRows` (AppShell already lifts this state since
  Phase 51) + the chosen parent dir.
- Dirty-detection must cover both (mirror how overrides/sharpen feed the dirty check)
  so editing rows marks the project unsaved.

## Design decisions to make first (candidates for /gsd-discuss-phase)

- **Output-path portability:** store the parent dir as an **absolute** path (simple, but
  breaks if the project file is moved to another machine/user) vs. relative-to-project
  vs. store-but-validate-on-open (fall back to picker if the saved dir no longer exists).
  Recommend: store absolute, but on open treat a missing/inaccessible dir as "no
  pre-fill" (fall back to the native picker) — never hard-fail load.
- **What persists from the rows:** just the `scale` per row (regenerate fresh `id`s on
  load — ids are ephemeral UI keys, must NOT be serialized/relied on). The px-edit
  transient state (`activePx`) is never persisted.
- **Scope:** rows + output dir only (per the request). The other dialog config
  (output mode / atlas opts / safety buffer / sharpen) is out of scope unless the user
  also wants it — confirm at discuss.
- **Back-compat:** old `.stmproj` files (no fields) must open cleanly → defaults. New
  files opened in an older app build already ignore unknown fields (additive contract).

## Where to touch

- `src/shared/types.ts` — `AppSessionState` + `ProjectFileV1` additive fields + validator massage.
- `src/main/project-io.ts` — save/load serialization (mirror the overrides/sharpen handling).
- `src/renderer/src/components/AppShell.tsx` — feed `variantRows` (already lifted) +
  the variant output dir into the saved session; restore on load; include in dirty-detection.
- Tests: a `.stmproj` round-trip spec (save → load → rows + dir restored) + a back-compat
  spec (old file with no fields → defaults), following the existing project-io round-trip tests.
