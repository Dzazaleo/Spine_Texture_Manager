---
phase: 53-persist-variant-state-in-stmproj
plan: 02
subsystem: renderer
tags: [stmproj, persistence, variant-export, scaleui, dirty-tracking, appshell, renderer-wiring]

# Dependency graph
requires:
  - phase: 53-01-data-tier
    provides: "MaterializedProject.variantRows + AppSessionState.variantRows ({ scale: number }[]); buildSessionState save-half already wired"
  - phase: 30-safety-buffer (precedent)
    provides: "the dirty-tracked additive .stmproj field wiring pattern (safetyBufferPercent) mirrored for the dirty machinery"
  - phase: 51-batch-variant-export
    provides: "the lifted { id, scale }[] variantRows state + VariantDialog factor inputs this restores into"
provides:
  - "variantRows restored on BOTH load paths (useState initializer = first open; mountOpenResponse = re-open-in-session), each re-keyed with fresh crypto.randomUUID()"
  - "lastSaved.variantScales: number[] dirty-baseline (type member + 4 seed/snapshot sites)"
  - "isDirty order-sensitive scale-projection compare in both arms (untitled vs [0.5]; loaded vs lastSaved.variantScales) + deps"
  - "onClickSave AND onClickSaveAs refresh the post-save scale baseline (Pitfall 3)"
  - "renderer jsdom tests locking restore-into-UI (SC#1) + not-dirty-on-open + dirty-on-edit (D-03)"
affects: [variant-export, save-load, quit-guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dirty-by-scale-projection: compare an order-sensitive number[] projection, never the { id, scale } objects (ids regenerate on load and would false-dirty)"
    - "Fresh-id-on-restore: persisted/compared values are always the scales; the React-key id is always regenerated via crypto.randomUUID() on both load paths"

key-files:
  created: []
  modified:
    - src/renderer/src/components/AppShell.tsx
    - tests/renderer/save-load.spec.tsx

key-decisions:
  - "D-03 asymmetry preserved: variantRows gets the FULL dirty machinery (rows are authored content); the reused lastOutDir stays NON-dirty (no fs check, no variantOutputDir)"
  - "D-03 dirty compare is an order-sensitive number[] scale projection — NOT { id, scale } objects (regenerated ids would false-dirty on open)"
  - "Both load paths restore + baseline (initializer + mountOpenResponse); a freshly-opened project is NOT dirty"
  - "53-01 already wired the buildSessionState save half (payload line + deps entry) to keep typecheck:web green — verified present, NOT double-added (sub-site 5c)"

requirements-completed: [SCALEUI-03]

# Metrics
duration: ~4min
completed: 2026-05-24
---

# Phase 53 Plan 02: Wire variantRows through the renderer (restore + dirty) Summary

**`variantRows` now restores on BOTH renderer load paths (first-open `useState` initializer + mid-session `mountOpenResponse`) with fresh `crypto.randomUUID()` ids, and the project tracks an order-sensitive scale-projection dirty signal across `isDirty` + `lastSaved` + both Save snapshots (D-03) — delivering the user-facing "sticky scale set" (SCALEUI-03 SC#1) while keeping the reused `lastOutDir` deliberately non-dirty.**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-05-24
- **Tasks:** 2 (1 implementation, 1 renderer test — layered split per the plan's `<done>` structure, mirroring 53-01)
- **Files modified:** 2

## Accomplishments
- **Load-path A (first open):** the `variantRows` `useState` initializer now seeds from `initialProject?.variantRows ?? [{ scale: 0.5 }]`, regenerating each row's id.
- **Load-path B (re-open in session, the highest-risk omission / Pitfall 1):** `mountOpenResponse` now calls `setVariantRows(...)` adjacent to `setLastOutDir`, with fresh ids, AND baselines `lastSaved.variantScales` so a re-opened project is not dirty.
- **Dirty machinery (D-03):** `lastSaved` gains `variantScales: number[]`; `isDirty` compares an order-sensitive scale projection in BOTH arms (untitled vs the single `[0.5]` default; loaded vs `lastSaved.variantScales`, mirroring the `overrides` length-then-elementwise loop); `variantRows` added to the memo deps.
- **Both Save snapshots refreshed (Pitfall 3):** `onClickSave` AND `onClickSaveAs` set `variantScales: state.variantRows.map(r => r.scale)` so Save and Save As… both go clean.
- **D-01/D-02 asymmetry held:** no `variantOutputDir`, no `existsSync`/fs check — `lastOutDir` stays the non-dirty picker hint.
- **Tests:** two new jsdom cases in `save-load.spec.tsx` lock restore-into-UI (factor inputs reflect `0.5`/`0.36` in order) and the dirty asymmetry (not-dirty-on-open despite regenerated ids; dirty after editing a row's factor).

## Task Commits

1. **Task 1: Restore variantRows on both load paths + dirty-by-scale-projection (5 sub-sites)** - `a91c1e2` (feat)
2. **Task 2: Renderer jsdom test — restore + dirty-on-edit / not-dirty-on-open** - `a4f537e` (test)

_Note: Task 1 (implementation) was committed before Task 2 (tests) per this plan's layered-split task structure and its `<done>` notes — the same shape 53-01 used at the data tier. The `tdd="true"` attribute is honored as a layered RED/GREEN at the plan level: Task 2's tests are RED against any leg of the wiring being absent (verified by reasoning — each assertion targets a specific sub-site: restore depends on 5a/5b, not-dirty-on-open on 5d-i, dirty-on-edit on 5d-ii) and GREEN against the completed Task 1._

## Files Created/Modified
- `src/renderer/src/components/AppShell.tsx` — sub-sites 5a (initializer restore), 5b (mountOpenResponse restore + lastSaved baseline), 5d-i (lastSaved type member + initial-mount seed), 5d-ii (isDirty both arms + deps), 5d-iii (both Save snapshots). Sub-site 5c (buildSessionState payload + deps) was already present from 53-01 — verified, not double-added.
- `tests/renderer/save-load.spec.tsx` — `Phase 53 — variantRows persistence (SCALEUI-03)` describe (2 cases) + a `makeProjectWithVariantRows` helper + a defensive `crypto.randomUUID` jsdom polyfill guard. File stayed `.spec.tsx` (Pitfall 4).

## Decisions Made
- **D-03 dirty asymmetry preserved** — `variantRows` (authored content) gets the full dirty wiring; `lastOutDir` (a picker start-hint) stays non-dirty. No `variantOutputDir` field and no fs existence check were added (D-01/D-02).
- **Order-sensitive scale-projection compare** — the dirty equality test projects to `number[]` and never touches the `{ id, scale }` objects, so the ids regenerated on load via `crypto.randomUUID()` do not false-dirty (Pitfall 2). Row add/remove/reorder/scale-edit all flip dirty.
- **Both load paths + both Save sites wired** — first-open initializer and `mountOpenResponse` restore + baseline; `onClickSave` and `onClickSaveAs` both refresh the snapshot. A freshly opened project is not dirty.
- **53-01 save-half left intact** — the `buildSessionState` payload line (`variantRows: variantRows.map((r) => ({ scale: r.scale }))`) and its deps-array entry were already added by the 53-01 executor (to keep `typecheck:web` green when `AppSessionState.variantRows` became required). Per the orchestrator heads-up, this was verified present and NOT double-added.

## Deviations from Plan

None — plan executed as written. The only divergence from the plan's literal text is documented under the next section as a measurement-vs-intent note, not a code deviation.

### Acceptance-criterion measurement note (not a deviation)

The Task 1 acceptance criterion `grep -c "setVariantRows(" >= 2` returns **1**, not 2. Its parenthetical rationale assumed the state-hook declaration line matches `setVariantRows(`. The actual source shape is `const [variantRows, setVariantRows] = useState<...>(...)` — the destructured `setVariantRows` is followed by `]`, not `(`, so only the new `mountOpenResponse` call literally matches `setVariantRows(`. The criterion's stated **purpose** ("the state hook declaration line PLUS the new call inside mountOpenResponse") is fully satisfied: the declaration exists (AppShell:581) and the new `mountOpenResponse` call exists (AppShell:1724). The load-bearing requirement — both load paths restore — is met and independently verified by:
- `grep "initialProject?.variantRows"` → 1 (load-path A initializer)
- `grep "project.variantRows" inside mountOpenResponse` → 2 (the `setVariantRows` restore + the `lastSaved.variantScales` baseline)
- both typechecks exit 0; the `variant rows restore` renderer test (which exercises load-path A end-to-end into the UI) passes.

All other Task 1 ACs pass exactly: `variantScales` count = 12 (>= 5); the buildSessionState payload literal is present; `ORDER-SENSITIVE` sits next to a `variantScales[i]` compare; `existsSync|variantOutputDir` returns nothing (D-01/D-02); `setVariantRows(` confirmed inside `mountOpenResponse`. All Task 2 ACs pass exactly.

## Issues Encountered
- **2 pre-existing fixture-absence test failures (out of scope, already logged by 53-01 to `deferred-items.md`):** `tests/main/sampler-worker-girl.spec.ts` and `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` need absent/gitignored proprietary fixtures. Both SKIP cleanly under `CI=true` (verified in the full-suite run below) — environment-only, unrelated to this renderer change. No fix attempted (SCOPE BOUNDARY).

## Verification Confirmation
- `npm run typecheck:web` exits 0; `npm run typecheck:node` exits 0 (renderer wiring coherent; no renderer `.spec.ts` regression — TS6307-safe).
- `npx vitest run tests/renderer/save-load.spec.tsx -t "variant rows restore"` → 1 passed (SC#1 restore-into-UI).
- `npx vitest run tests/renderer/save-load.spec.tsx -t "variant rows dirty"` → 1 passed (not-dirty-on-open + dirty-on-edit, D-03).
- `npx vitest run tests/renderer/save-load.spec.tsx` → 19 passed / 1 skipped (no existing case regressed; was 17 before this plan).
- `tests/arch.spec.ts` → 20 passed (Layer-3 purity preserved; the change is renderer-only).
- Full suite (`CI=true npx vitest run`) → **1513 passed / 25 skipped / 2 todo / 0 failures** across 149 test files.
- `grep -c "variantScales" src/renderer/src/components/AppShell.tsx` → 12 (>= 5; all dirty sites wired).
- `grep -nE "existsSync|variantOutputDir" src/renderer/src/components/AppShell.tsx` → nothing (D-01/D-02).
- Test file remains `tests/renderer/save-load.spec.tsx` (`.spec.tsx`); no new `tests/renderer/*.spec.ts` created.

## Next Phase Readiness
- **SCALEUI-03 renderer tier complete.** The "sticky scale set" round-trips end-to-end: 53-01 (data tier) persists/validates/materializes `variantRows`; this plan restores it into the UI on both load paths and protects an unsaved set via the quit-guard.
- **Deferred (carried from 53-01, not a blocker):** recovery-envelope + `ResampleArgs` threading of `variantRows` — on the rare missing-skeleton-on-open recovery hop the rows still reset to the single `[0.5]` default. Not an SC; widening it would touch the SerializableError envelope + App.tsx recovery arm.
- **Orchestrator owns** STATE.md / ROADMAP.md / REQUIREMENTS.md writes after the wave merges (this is a worktree executor — those shared files were intentionally not modified).

## Self-Check: PASSED

- All modified files verified present on disk (AppShell.tsx, save-load.spec.tsx, this SUMMARY).
- Both task commits verified in git log (`a91c1e2`, `a4f537e`).

---
*Phase: 53-persist-variant-state-in-stmproj*
*Completed: 2026-05-24*
