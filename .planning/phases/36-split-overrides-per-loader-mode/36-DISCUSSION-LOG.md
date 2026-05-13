# Phase 36: Split Overrides Per Loader Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 36-split-overrides-per-loader-mode
**Areas discussed:** UX nudge (toast on mode switch), Migration banner aggregation, Clear/reset scope across buckets, Dirty-detection + recovery payload shape

---

## UX Nudge — Toast on Mode Switch

### Q1: Should the one-shot toast ship in Phase 36, or defer to v1.6?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship in Phase 36 | Cheap signal (~30-40 LOC + one-shot suppress key). Prevents SEED-007 confusion from recurring during v1.5→v1.6 gap. Fires once per session on first toggle after overrides exist. | ✓ |
| Defer to v1.6 patch | Phase 36 stays focused on schema/routing/tests. Toast becomes small v1.6 follow-up. Risk: users hit the empty-inactive-bucket surprise before nudge lands. | |
| You decide | Pick what fits phase scope. | |

**User's choice:** Ship in Phase 36
**Notes:** Toast lands in this phase. Phase 36 plan grows by one small UX plan.

### Q2: What exactly should trigger the toast?

| Option | Description | Selected |
|--------|-------------|----------|
| First mode toggle after any override exists | Fire only when loaderMode toggles AND (overridesAtlasSource.size > 0 \|\| overridesAtlasLess.size > 0). Matches SEED-007 verbatim. | ✓ |
| First mode toggle in any session | Fire first time per session regardless of override state. Risk: noisy for users who toggle but never override. | |
| Every mode toggle until dismissed | Fire on every toggle until "don't show again". Maximum visibility, naggy. | |

**User's choice:** First mode toggle after any override exists

### Q3: How should "don't show again" suppression persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-machine via localStorage | Key `stm.overrideModeToast.suppressed=true`. Suppresses across all projects. Matches "I learned the lesson" intent. | ✓ |
| Per-session only | Suppressed for the rest of the session, reappears on next launch. Lighter, but "don't show again" feels broken. | |
| Persisted in .stmproj | Per-project flag. Roams with project. Schema cost; concept isn't project-scoped. | |

**User's choice:** Per-machine via localStorage

### Q4: Toast copy — which wording?

| Option | Description | Selected |
|--------|-------------|----------|
| SEED-007 verbatim | "Overrides are tracked per loader mode." — short, neutral. | |
| Slightly more explanatory | "Overrides are tracked per loader mode — atlas-source and atlas-less each have their own." — spells out the consequence. | ✓ |
| You decide | Pick whichever reads cleaner. | |

**User's choice:** Slightly more explanatory

---

## Migration Banner Aggregation

### Q1: Migration banner display when both buckets have migrated keys?

| Option | Description | Selected |
|--------|-------------|----------|
| Single aggregate count | `Updated {N1+N2} override(s) to per-region keys.` Banner contract unchanged. | ✓ |
| Split per bucket | Two lines or annotated single line. Provides transparency but 2-A means only one bucket migrates per legacy file. | |
| You decide | Whatever is least intrusive. | |

**User's choice:** Single aggregate count
**Notes:** With 2-A routing, a legacy file feeds ONE bucket; the per-bucket split would almost always show one count as 0. Aggregate keeps the existing banner formatter untouched.

### Q2: Stale-overrides banner — how to surface keys from both buckets?

| Option | Description | Selected |
|--------|-------------|----------|
| Union, no per-bucket label | Both buckets' stale keys merged into existing `staleOverrideKeys: string[]`. Banner text unchanged. | ✓ |
| Annotate each key with its bucket | Show keys like `CIRCLE (atlas-less)`. Changes contract to {key, bucket}. | |
| Two separate banners | One per bucket. Most explicit, most visual noise. | |

**User's choice:** Union, no per-bucket label

### Q3: MaterializedProject IPC payload — how to report per-bucket counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Sum at main, single migratedKeyCount | main/project-io.ts runs migrateOverrides twice, sums migratedKeyCount, unions stale[]. Zero IPC contract change. | ✓ |
| Per-bucket fields on MaterializedProject | Add migratedKeyCountAtlasSource + migratedKeyCountAtlasLess. Forward-compatible if banner UX changes. | |
| You decide | Pick whichever costs less without painting us into a corner. | |

**User's choice:** Sum at main, single migratedKeyCount

---

## Clear / Reset Scope Across Buckets

### Q1: OverrideDialog `Clear` on a row — which bucket?

| Option | Description | Selected |
|--------|-------------|----------|
| Active bucket only | Strict separation. Same path as Apply. Matches the whole point of the split. | ✓ |
| Both buckets | Convenience but couples buckets at exactly the moment we said they should diverge (Decision 2-B logic). | |
| You decide | Pick whichever is consistent with Apply. | |

**User's choice:** Active bucket only

### Q2: Is there any 'wipe all overrides' / project-wide reset path that needs a scope decision?

| Option | Description | Selected |
|--------|-------------|----------|
| No bulk reset exists — skip | No path today, no decision needed. Per-row Clear is the only path. | ✓ |
| Yes — active bucket only | If bulk reset exists, acts on active bucket only. | |
| Yes — prompt user which bucket(s) | If bulk reset exists, dialog asks which bucket(s) to wipe. | |

**User's choice:** No bulk reset exists — skip

### Q3: OverrideDialog multi-row selection — cross-bucket awareness?

| Option | Description | Selected |
|--------|-------------|----------|
| Active bucket only, no cross-bucket awareness | Selection lives in active panel; Apply writes to active bucket only. Dialog doesn't peek at inactive bucket. | ✓ |
| Show inactive-bucket value as a hint | Passive `(atlas-less: 75%)` note next to current. Visibility but couples UI to both buckets. | |
| You decide | Defer to whatever keeps dialog simplest. | |

**User's choice:** Active bucket only, no cross-bucket awareness

---

## Dirty-Detection + Recovery Payload Shape

### Q1: AppShell.lastSaved snapshot — how to track overrides?

| Option | Description | Selected |
|--------|-------------|----------|
| Both buckets in lastSaved | Snapshot includes overrides + overridesAtlasLess. Dirty = either differs. Mode-switches alone stay clean. | ✓ |
| Active-bucket only | Mis-marks dirty state on mode-switch+apply. Edge cases. | |
| Combined hash | Single hash of both. Harder to debug, not idiomatic for lastSaved shape. | |

**User's choice:** Both buckets in lastSaved

### Q2: skeletonNotFoundError.mergedOverrides — carry one bucket or both?

| Option | Description | Selected |
|--------|-------------|----------|
| Both buckets, rename to mergedOverridesBuckets | Carry { overrides, overridesAtlasLess }. Per-bucket migration re-runs main-side. Rename keeps shape readable. | ✓ |
| Both buckets, keep field name mergedOverrides as record-of-records | Reuse name with nested shape. Minimal rename but mergedOverrides becomes ambiguous. | |
| Active bucket only | Silent data-loss bug for inactive bucket. | |

**User's choice:** Both buckets, rename to mergedOverridesBuckets

### Q3: AppShell state shape — how to hold the two buckets?

| Option | Description | Selected |
|--------|-------------|----------|
| Two named useState Maps | `overrides` (now semantically atlas-source) + `overridesAtlasLess`. Minimum churn. | ✓ |
| Single state object holding both Maps | More cohesive but every existing `overrides` reference must be rewritten. | |
| Single derived Map per active mode + storage Record | Loses Map identity stability the existing code relies on for memo deps. | |

**User's choice:** Two named useState Maps

### Q4: Active-mode slice selection across call sites?

| Option | Description | Selected |
|--------|-------------|----------|
| Single memoized activeOverrides at top of AppShell | One useMemo derives active slice; passed to 4 buildExportPlan call sites + dialog handler + 2 panels. One source of truth. | ✓ |
| Inline ternary at each call site | Six+ duplicate ternaries; easy to forget when adding a new call site. | |
| You decide | Smallest diff while satisfying REQ OVR-05. | |

**User's choice:** Single memoized activeOverrides at top of AppShell

---

## Claude's Discretion

None — every gray area resolved to a specific user choice.

## Deferred Ideas

- Decision 3-C escape hatch ("Copy from X mode" button) — rejected at SEED-007 capture; revisitable in v1.6+ if friction reports surface.
- Per-skin overrides — future seed candidate.
- Bulk override clear path — none today; default to active-bucket-only if/when added.
- Inactive-bucket visibility hint in OverrideDialog — rejected for simplicity; revisitable if users report the inactive bucket feels invisible.
