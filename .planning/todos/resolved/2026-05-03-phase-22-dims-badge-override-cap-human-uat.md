---
created: 2026-05-03
phase: 22
type: human-uat
status: pending
deferred_from: /gsd-execute-phase 22 (Plan 22-05 Task 3 — checkpoint:human-verify)
---

# Phase 22 — DIMS-02 + DIMS-04 + DIMS-05 visual UAT

Phase 22 implementation complete (5/5 plans, 687 tests passing, gsd-verifier scored 5/5 PASS at code level on 2026-05-03). Plan 22-05 Task 3 declared a `checkpoint:human-verify` gate with 9 visual UAT items that the executor cannot self-complete. User chose **"Run gsd-verifier now, defer UAT"** during execute-phase — these items are surfaced here for a future UAT session.

## Recipe

1. `npm run dev` — launches Electron in dev mode.
2. Load a project where actual PNG dims drift from canonical (e.g. run Optimize on the SIMPLE_PROJECT fixture once with a downscale, then re-load — that produces a `dimsMismatch` state on every region).

## UAT checks

| # | Surface | What to verify |
|---|---------|----------------|
| 1 | `GlobalMaxRenderPanel` Source W×H column | DIMS-02 info-circle badge renders cleanly at 100%, no clipping, dark-mode legible |
| 2 | `AnimationBreakdownPanel` Source W×H column | Sibling-symmetric with #1 (Phase 19 D-06 invariant); same badge component, same tooltip wording |
| 3 | Tooltip on either badge | Substitutes concrete dim values (e.g. "Canonical 1628×1908 → Actual 811×962"); no `${...}` template-literal leakage |
| 4 | `OptimizeDialog` pre-flight file list | "COPY" chip placement reads consistently with the existing `excludedUnused` muted UX (Round 1 parity) |
| 5 | `OptimizeDialog` passthrough rows | Show **actual on-disk dims** (e.g. 811×962), NOT canonical dims (e.g. 1628×1908) — this was the CHECKER FIX 2026-05-02 propagating `actualSourceW/H` from DisplayRow to ExportRow |
| 6 | Round-trip byte-fidelity | Run Optimize on a drifted project → output `images/` folder contains every PNG byte-identical to the halved input (`cmp` exit 0). No double Lanczos. |
| 7 | Layout sanity | No horizontal toolbar shift on badge addition; AppShell root `min-h-screen` invariant intact (per locked memory `project_layout_fragility_root_min_h_screen.md`) |
| 8 | Dark mode | Badge visibility + tooltip readability in the dark theme |
| 9 | Browser zoom 100% / 125% / 150% | Badge `w-4 h-4` scales appropriately, no clipping, tooltip stays anchored |

## Closing this todo

After UAT passes (or any item fails and gets routed to a follow-up phase):

```
mv .planning/todos/pending/2026-05-03-phase-22-dims-badge-override-cap-human-uat.md \
   .planning/todos/resolved/
```

If any item fails, capture the failure with a screenshot before iterating (per locked feedback memory `feedback_layout_bugs_request_screenshots_early.md`).
