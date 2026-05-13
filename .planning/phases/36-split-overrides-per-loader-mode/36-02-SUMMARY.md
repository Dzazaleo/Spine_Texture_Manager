---
phase: 36-split-overrides-per-loader-mode
plan: 02
subsystem: main-process-ipc-glue
tags: [main-process, ipc-handler, project-io, override-migration, per-bucket, legacy-routing, seed-007]

# Dependency graph
requires:
  - phase: 36-01
    provides: "overridesAtlasLess on ProjectFileV1/AppSessionState + restoredOverridesAtlasLess on MaterializedProject + mergedOverridesBuckets on SerializableError/reloadProjectWithSkeleton"
  - phase: 29
    provides: "migrateOverrides 3-pass helper (Phase 29 D-06; body unchanged)"
provides:
  - "Open seam (handleProjectOpenFromPath ~line 596): legacy-routing decision (D-02 / L-02) + per-bucket migration with summed migratedKeyCount + unioned staleOverrideKeys"
  - "Recovery seam (handleProjectReloadWithSkeleton ~line 945): per-bucket migration over the validated mergedOverridesBuckets payload (no legacy-routing — buckets arrive pre-split)"
  - "Resample seam (handleProjectResample ~line 1158): per-bucket migration with defensive optional a.overridesAtlasLess read (Pitfall-3-safe forward-compat for ResampleArgs)"
  - "mergedOverridesBuckets rename at BOTH failed-Open rescue payload sites (line ~488 + ~862)"
  - "Recovery validator (~line 770) asserts BOTH sub-buckets exist as objects with verbatim 'mergedOverridesBuckets must carry both buckets' rejection message"
affects: [36-03, 36-04, 36-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-bucket migration with sum/union IPC contract — single scalar migratedKeyCount + single unioned staleOverrideKeys list across both buckets per D-06 / D-07. Zero IPC contract change at the renderer banner surface."
    - "Legacy-routing decision at Open seam ONLY (D-02 / L-02) — recovery + resample seams receive buckets pre-split from the renderer per PATTERNS.md §3-A 'Departure notes'. Conservative rule: applying the legacy-routing rule to a v1.5 file with the same shape (overrides populated, overridesAtlasLess empty) is a documented no-op."
    - "Defensive optional bucket read at resample seam — `a.overridesAtlasLess` defaults to `{}` when the IPC payload omits it. ResampleArgs (Plan 36-01) carries only the active `overrides` bucket today (Pitfall-3 boundary; renderer Plan 36-03 sends only `Object.fromEntries(activeOverrides)`); the missing-bucket migrateOverrides call is a guaranteed no-op (empty restored/stale, 0 migratedKeyCount)."

key-files:
  created:
    - .planning/phases/36-split-overrides-per-loader-mode/36-02-SUMMARY.md
  modified:
    - src/main/project-io.ts

key-decisions:
  - "Per-bucket migration at resample seam uses defensive optional read (`a.overridesAtlasLess` || `{}`) rather than extending ResampleArgs in types.ts — Plan 36-01 deliberately did not add the field to ResampleArgs (Pitfall-3 active-bucket-only IPC). The defensive read keeps the door open for Plan 36-03 / a future refactor to extend ResampleArgs without re-touching project-io.ts."
  - "Recovery seam casts `a.mergedOverridesBuckets` to a typed sub-bucket object inline at both sites (rescue re-thread at line ~852 + migration call at line ~945). Validator above already asserted both sub-buckets exist as objects, so the cast is sound; an intermediate typed local would clutter the function for zero correctness gain."
  - "Doc comment at line 728 retains historical reference 'renamed from `mergedOverrides`' — the only remaining textual occurrence of the bare old field name in the file. Excluded from the verification grep by the comment-line filter; preserved as breadcrumb for future archaeology."

patterns-established:
  - "Pattern: per-bucket migration at IPC seams — every migrateOverrides site that produces a MaterializedProject now runs the helper twice (once per bucket) against the shared mode-invariant summary.regions, sums migratedKeyCount, unions staleOverrideKeys."
  - "Pattern: legacy-routing decision lives at the Open seam ONLY — recovery and resample handlers receive buckets pre-split from the renderer; no re-routing across the IPC chain (re-routing would be a second migration of the same data, accepted-risk per T-36-05 in the threat model)."

requirements-completed: [OVR-02, OVR-04]

# Metrics
duration: ~6 min
completed: 2026-05-13
---

# Phase 36 Plan 02: Main-Process Per-Bucket Migration + Legacy Routing Summary

**Wired up `src/main/project-io.ts` to do per-bucket migration at all three IPC seams (Open / locate-skeleton recovery / resample), apply the SEED-007 D-02 / L-02 legacy-routing decision at the Open seam, and complete the `mergedOverridesBuckets` rename atomically across both `SkeletonNotFoundOnLoadError` rescue payload assembly sites + the recovery validator — `src/main/override-migration.ts` body is unchanged (mode-invariant helper).**

## Performance

- **Duration:** ~6 min (3m 16s wall-time across both tasks)
- **Started:** 2026-05-13T10:06:18Z
- **Completed:** 2026-05-13T10:09:34Z
- **Tasks:** 2
- **Files modified:** 1 (`src/main/project-io.ts`)
- **Lines changed:** +124 / -21 net across both commits

## Accomplishments

- **Open seam (~line 596)** — legacy-routing decision block lands per D-02 / L-02. `legacyMapPresent` + `routeToAtlasLess` short-circuit on the conservative rule (legacy file = `overrides` populated AND `overridesAtlasLess` empty; route to atlas-less iff saved `loaderMode === 'atlas-less'`). Two per-bucket `migrateOverrides` calls; sum `migratedKeyCount`; union `staleOverrideKeys` via `[...new Set([...aSrc.stale, ...aLess.stale])]`. `MaterializedProject` populates both `restoredOverrides` and `restoredOverridesAtlasLess`.
- **Recovery seam (~line 945)** — replaces single `migrateOverrides` call with per-bucket pair against the validated `a.mergedOverridesBuckets.overrides` + `.overridesAtlasLess` inputs. No legacy-routing block here per PATTERNS.md §3-A "Departure notes" — buckets arrive pre-split from the renderer (Plan 36-03 owns the dispatch).
- **Resample seam (~line 1158)** — per-bucket migration with defensive optional read for `a.overridesAtlasLess` (defaults to `{}` when the IPC payload omits the field). `MaterializedProject` carries both restored buckets back to the renderer.
- **Failed-Open rescue payload rename at both sites** — line 482-499 (handleProjectOpenFromPath SkeletonJsonNotFoundError arm) + line 851-872 (handleProjectReloadWithSkeleton SkeletonJsonNotFoundError arm); both now carry `mergedOverridesBuckets: { overrides, overridesAtlasLess }` per D-12.
- **Recovery validator (~line 769)** — replaces the old `a.mergedOverrides` Record check with a four-clause guard: rejects missing `a.mergedOverridesBuckets`, non-object shape, or missing/falsy `.overrides` / `.overridesAtlasLess` sub-buckets. Rejection message reads `'mergedOverridesBuckets must carry both buckets'` verbatim per acceptance criterion.
- **Doc comment update** — `handleProjectReloadWithSkeleton` JSDoc arg description at line 727 reflects the rename + retains historical breadcrumb ("renamed from `mergedOverrides`").
- **`src/main/override-migration.ts` body** — unchanged. `git diff --stat src/main/override-migration.ts` returns empty output (helper is mode-invariant; the two-pass determinism + Test 6 regression coverage stay intact).
- **All 11 existing `tests/main/override-migration.spec.ts` tests pass at runtime** post-changes (helper body untouched).
- **Zero typecheck errors in `src/main/project-io.ts`** after both tasks (the 5 baseline errors from Plan 36-01's typecheck snapshot — 4 in project-io.ts + 1 in tests — are gone from project-io.ts; the test errors remain and are explicitly owned by Plan 36-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert the Open seam to per-bucket migration with legacy-routing decision (D-02 / L-02)** — `c080dde` (feat). Added legacy-routing block + two-call migration + `MaterializedProject` sibling field at the Open seam.
2. **Task 2: Convert the locate-skeleton recovery and resample seams to per-bucket migration + rename `mergedOverrides` → `mergedOverridesBuckets` at both rescue payload sites and the recovery validator** — `f27bea4` (feat). Four logical edits across one file: rescue site 1 rename, validator rename, rescue site 2 rename + recovery seam per-bucket migration + resample seam per-bucket migration with defensive bucket read.

## Files Created/Modified

- `src/main/project-io.ts` — five logic edits across two commits:
  - Line ~572-624 (Task 1): legacy-routing detection block + per-bucket migration + `MaterializedProject` assembly with sibling `restoredOverridesAtlasLess` field
  - Line 482-499 (Task 2 Edit 3): failed-Open rescue payload site 1 renamed to `mergedOverridesBuckets`
  - Line 727-734 (Task 2 ancillary): JSDoc arg description for `mergedOverridesBuckets` (renamed from `mergedOverrides`)
  - Line 767-783 (Task 2 Edit 4): recovery validator renamed + asserts both sub-buckets exist
  - Line 851-872 (Task 2 Edit 3): failed-Open rescue payload site 2 (recovery handler's own SkeletonJsonNotFoundError arm) renamed to `mergedOverridesBuckets`
  - Line 933-967 (Task 2 Edit 1): recovery seam per-bucket migration + `MaterializedProject` sibling field
  - Line 1149-1184 (Task 2 Edit 2): resample seam per-bucket migration with defensive optional bucket read + `MaterializedProject` sibling field

## Grep Counts (final)

| Counter                                                                              | Plan requires                  | Actual |
| ------------------------------------------------------------------------------------ | ------------------------------ | ------ |
| `migrateOverrides(` in `src/main/project-io.ts`                                      | >= 6 (3 seams × 2 calls)       | 7 (6 calls + 1 import) |
| `mergedOverridesBuckets` in `src/main/project-io.ts`                                 | >= 4                           | 13     |
| `mergedOverrides:` code-line count (excluding comments) in `src/main/project-io.ts`  | == 0                           | 0      |
| `restoredOverridesAtlasLess` in `src/main/project-io.ts`                             | >= 3 (one per seam)            | 4 (one per seam + type ref) |
| `routeToAtlasLess` in `src/main/project-io.ts`                                       | >= 1 (Open seam)               | 3 (definition + 2 read sites) |
| `legacyMapPresent` in `src/main/project-io.ts`                                       | >= 1                           | 2 (definition + read) |
| `SEED-007 L-02` doc comment in `src/main/project-io.ts`                              | >= 1                           | 1      |
| `restoredOverridesAtlasLess: ` (assignment line) in `src/main/project-io.ts`         | >= 1 (Open seam Task 1)        | 3 (Open + recovery + resample) |
| Validator verbatim `mergedOverridesBuckets must carry both buckets`                  | == 1                           | 1      |
| `git diff --stat src/main/override-migration.ts`                                     | empty (helper unchanged)       | empty  |
| `npm run typecheck` errors originating in `src/main/project-io.ts`                   | 0                              | 0      |

All thresholds met or exceeded.

## Decisions Made

- **Resample seam uses defensive optional read for `a.overridesAtlasLess`** rather than extending `ResampleArgs` in `src/shared/types.ts`. Plan 36-01 deliberately did not add the field to `ResampleArgs` (Pitfall-3 active-bucket-only IPC contract; the renderer sends only the active bucket per Plan 36-03). The defensive `typeof === 'object'` check + `{}` default keeps the door open for a future ResampleArgs extension without re-touching `project-io.ts` and produces a guaranteed no-op call (`migrateOverrides({}, summary)` returns empty restored/stale and 0 migratedKeyCount). This honors the plan's exact instruction: *"thread both fields through if both are present, otherwise honor the existing single-field shape; the type contract from Plan 36-01 governs."*
- **No legacy-routing block at recovery + resample seams** per PATTERNS.md §3-A "Departure notes". Recovery receives the buckets pre-split from the renderer's `mergedOverridesBuckets` payload; resample receives the active bucket (and the optional second bucket via the defensive read). Re-routing across the IPC chain would be a second migration of the same data and an accepted-risk-elevating change (T-36-05 explicitly accepts the routing-once contract).
- **Recovery seam casts `a.mergedOverridesBuckets` to a typed sub-bucket object inline at both consumer sites** — the validator above already asserted both sub-buckets exist as objects, so casting at point-of-use is sound. An intermediate typed local would clutter the function for zero correctness gain.

## Deviations from Plan

None — both tasks executed exactly as written. The plan's `<action>` blocks for Task 1 (Open seam legacy routing) and Task 2 (recovery + resample per-bucket + rescue + validator) translated directly into the code edits with no scope creep, no auto-fixes, no architectural surprises.

The only judgment call (resample seam defensive read vs. ResampleArgs type extension) was explicitly forecast in the plan's Task 2 `<action>` text ("the type contract from Plan 36-01 governs") and the defensive-read choice is the one that honors Plan 36-01's locked design (Pitfall-3 boundary preserved).

## Authentication Gates

None — no external services touched. The work is pure main-process TypeScript modification.

## Issues Encountered

- **Pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts:187`** ("'data' is declared but its value is never read") — still present, per Plan 36-01 summary noting it's pre-existing on the base commit. Out of scope per the Scope Boundary rule.
- **17 typecheck errors in `tests/`** post-Plan-36-02 — all are "Property 'overridesAtlasLess' is missing" (compile-only fixture errors) or one residual `'mergedOverrides' does not exist` in `tests/main/project-io.spec.ts:260`. Both are explicitly owned by **Plan 36-04** (test fixture deterministic add per Plan 36-01 summary § "Next Plan Readiness"). Not touched by this plan.

## TDD Gate Compliance

N/A — this is a `type: execute` plan, not `type: tdd`. Per plan frontmatter `wave: 2, type: execute, autonomous: true`. Both task commits use `feat(...)` per task_commit_protocol.

## Threat Model Verification

The plan declared three STRIDE threats:

- **T-36-04 (Tampering — recovery validator accepts payload missing one sub-bucket):** MITIGATED. Validator at line 769-783 explicitly checks both `(a.mergedOverridesBuckets as Record<string, unknown>).overrides` AND `.overridesAtlasLess` are truthy AND `typeof a.mergedOverridesBuckets === 'object'`. Missing either returns `Unknown` error kind with verbatim message `'mergedOverridesBuckets must carry both buckets'`. Plan 36-03 renderer-side dispatch guarantees both buckets per D-11 (lastSaved snapshot carries both).
- **T-36-05 (Tampering — routing decision misroutes on malformed legacy file):** ACCEPTED. The saved `loaderMode` IS the user's last expressed intent per SEED-007 Decision 2-A. Worst case: user opens the file, sees the override in the wrong bucket, manually re-applies. Severity: low (UX confusion, not data loss; override values intact in the routed-to bucket). No code-level mitigation needed; the doc comment at line 583-594 documents the conservative-rule rationale for future archaeology.
- **T-36-06 (Information disclosure — incomplete field rename leak):** MITIGATED. Compile-time TypeScript enforcement; `grep -v 'comments' src/main/project-io.ts | grep -c 'mergedOverrides[^B]'` returns 0 in code, matching the verification gate. The single residual `mergedOverrides` token in the file is in the doc-comment string `"renamed from \`mergedOverrides\`"` — intentional historical breadcrumb. Renderer-side audit (Plan 36-03) extends the same grep to `src/renderer/`; Plan 36-05 quality-gate task closes the loop.

ASVS L1 alignment: input validation at trust boundary (V5.1.x) — recovery validator now checks both buckets exist. No `high` severity threats — security gate not triggered.

## Threat Flags

None — no new network endpoints, no new auth surface, no new file access patterns, no schema-version change. All edits stay within the existing renderer ↔ main IPC trust boundary (the same boundary that handled the single `mergedOverrides` field before this plan).

## Known Stubs

None — this plan is pure main-process IPC + migration plumbing. No UI surface, no data sources to wire (the data sources are renderer-side and owned by Plan 36-03).

## Next Plan Readiness

- **Plan 36-03 (AppShell.tsx + App.tsx renderer-side state slots, OVR-03 / OVR-05 / OVR-06):** READY. The main-process IPC response shape now carries `restoredOverridesAtlasLess` from all three seams (Open / recovery / resample); the `SerializableError.SkeletonNotFoundOnLoadError.mergedOverridesBuckets` payload carries both buckets across the locate-skeleton recovery chain. AppShell can now: (a) seed both useState Maps from `restoredOverrides` + `restoredOverridesAtlasLess` on Open, (b) thread `mergedOverridesBuckets` into `window.api.reloadProjectWithSkeleton(...)` args, (c) derive `activeOverrides = useMemo(...)` per D-14.
- **Plan 36-04 (project-file.spec.ts test fixtures, OVR-06):** READY. 17 typecheck errors in `tests/` are deterministic add-`overridesAtlasLess: {}`-to-fixtures + one `mergedOverrides` → `mergedOverridesBuckets` field rename in `tests/main/project-io.spec.ts:260` — Plan 36-04 owns the lot.
- **Plan 36-05 (mode-toggle divergence renderer spec + quality gate):** READY. Type foundation + main-process plumbing both complete; new spec can be authored against the locked contract.

## Self-Check: PASSED

**Verified existence of modified files:**
- `src/main/project-io.ts` — FOUND (modified)
- `.planning/phases/36-split-overrides-per-loader-mode/36-02-SUMMARY.md` — FOUND (created by this write)
- `src/main/override-migration.ts` — FOUND (unchanged; `git diff --stat` empty)

**Verified commit hashes:**
- `c080dde` — FOUND in git log (Task 1: Open seam legacy routing + per-bucket migration)
- `f27bea4` — FOUND in git log (Task 2: recovery + resample + rescue rename + validator rename)

**Verified verification grep counts (final, post both tasks):**
- `migrateOverrides(` = 7 (>= 6 required) ✓
- `mergedOverridesBuckets` = 13 (>= 4 required) ✓
- `mergedOverrides:` code-line = 0 (== 0 required) ✓
- `restoredOverridesAtlasLess` = 4 (>= 3 required) ✓
- validator message verbatim = 1 (== 1 required) ✓
- `override-migration.ts` diff empty ✓
- typecheck errors in `project-io.ts` = 0 ✓

**Verified runtime regression coverage:**
- `tests/main/override-migration.spec.ts` — 11/11 PASS (helper body unchanged)

All claims in this SUMMARY validated.

---
*Phase: 36-split-overrides-per-loader-mode*
*Completed: 2026-05-13*
