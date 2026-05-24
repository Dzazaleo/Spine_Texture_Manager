# Phase 53: Persist Variant State in `.stmproj` - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 53-persist-variant-state-in-stmproj
**Areas discussed:** Output-folder memory, Path portability, Dirty tracking, Persistence scope

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Output-folder memory | Reuse shared `lastOutDir` vs dedicated `variantOutputDir` | ✓ |
| Path portability | Absolute / relative / validate-on-open | ✓ |
| Does editing rows mark unsaved? | Dirty-track rows vs persist-on-save-only | ✓ |
| Persistence scope | Rows + dir only vs something more | ✓ |

**User's choice:** All four areas.

---

## Output-Folder Memory

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse shared `lastOutDir` | Variant + Optimize share one remembered folder; already persists + pre-fills the variant picker; near-zero work | ✓ |
| Dedicated `variantOutputDir` | Variant remembers its own folder; matches the todo's literal field; adds schema + wiring | |

**User's choice:** Reuse shared `lastOutDir`.
**Notes:** Collapses the output-location half to "already done" — the phase becomes almost entirely about persisting the scale rows. (D-01)

---

## Path Portability

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Absolute, picker start-hint only, no existence check; SC#3 already satisfied because the picker always opens; zero new code | ✓ |
| Validate + clear on load | fs-check the saved dir on load and clear if gone; nicer on moved projects but adds main-side fs + IPC and alters shared `lastOutDir` for Optimize too | |

**User's choice:** Leave as-is.
**Notes:** The variant flow always opens the native picker, so a stale saved dir can only ever be a starting location — it can't hard-fail load. SC#3 is satisfied by the existing architecture. (D-02)

---

## Dirty Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Persist on Save, no dirty flag | Treat rows like `lastOutDir`/sort: written on explicit Save, no "unsaved" flag, no quit prompt; matches the reused field + "if project is saved" phrasing | |
| Mark dirty (protect the rows) | Treat rows like overrides: editing marks unsaved, quit-guard prompts, never silently lose a built scale set | ✓ |

**User's choice:** Mark dirty (protect the rows).
**Notes:** Rows are authored content, not mere session metadata — the quit-guard should protect them. Intentionally diverges from the reused `lastOutDir` (which stays non-dirty). Implementation note captured: dirty comparison must use the persisted projection (the `scale`s), NOT the full `{ id, scale }` objects, because `id`s regenerate on load and would otherwise trigger a false "unsaved" on every open. (D-03)

---

## Persistence Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Just the scale rows | Persist only `variantRows`; output mode / sharpen / safety buffer / overrides already persist as top-level config; output dir = reused `lastOutDir` | ✓ |
| Something else too | Additional dialog state to remember (risks expanding toward the deferred saved-scale-sets Future Req) | |

**User's choice:** Just the scale rows.
**Notes:** The only genuinely new on-disk surface is one optional array. Old files with no `variantRows` → open with the default single row at `0.5`. (D-04)

---

## Claude's Discretion

- Exact new field name (`variantRows`) and persisted element shape (`{ scale }[]` vs `number[]`).
- Where the missing→default validator massage lives (mirror the `overridesAtlasLess` / `sharpenOnExport` massage in `src/core/project-file.ts`).
- How load threads restored rows into AppShell's `variantRows` (fresh `crypto.randomUUID()` ids) and how the save payload is assembled in `buildSessionState`.

## Deferred Ideas

- Dedicated `variantOutputDir` (rejected D-01; revisit only if sharing `lastOutDir` confuses).
- Saved scale-sets / variant presets in `.stmproj` (Future Requirement — named/reusable scale lists; this phase persists current rows only).
- Validate-and-clear a stale output dir on load (rejected D-02; possible future polish).
- Explicitly persisting the rest of the variant dialog config (unnecessary — already round-trips, D-04).
