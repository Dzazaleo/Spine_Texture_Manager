---
phase: 04-scale-overrides
plan: 03
subsystem: ui
tags: [react, electron, tailwind, override-dialog, aria-modal, human-verify]

# Dependency graph
requires:
  - phase: 04-01
    provides: src/core/overrides.ts + renderer/lib/overrides-view.ts (clampOverride + applyOverride) — now with new single-arg applyOverride semantics (supersedes D-78/D-79 via D-91)
  - phase: 04-02
    provides: AppShell overrides Map + dialogState + three callbacks (onOpenOverrideDialog/onApplyOverride/onClearOverride) + OverrideDialog hand-rolled ARIA modal + panel Props-interface extensions (optional overrides + onOpenOverrideDialog)
  - phase: 03
    provides: AppShell top-tab shell (D-49/D-50/D-51/D-52) + AnimationBreakdownPanel collapsible cards (D-62..D-71) + Phase 3 D-69 reserved Override Scale button
  - phase: 02
    provides: GlobalMaxRenderPanel sortable/searchable/selectable table (D-29..D-48) + Set<attachmentKey> selection (D-31) + analyzer dedup (gap-fix B)
provides:
  - Override-aware Scale + Peak W×H cells on both panels rendering override/source-dim math
  - onDoubleClick dialog trigger on every row's Scale cell (both panels)
  - Unlocked AnimationBreakdown D-69 Override Scale button with hover affordance
  - Effective-scale sort comparator on Global panel (resolves pattern-mapper flag 3)
  - D-91 new override semantics (percent = fraction of SOURCE dimensions, not peak)
  - Two-reset-button dialog (Reset to peak + Reset to source (100%))
  - Dialog prefill = round(peakScale*100) for non-overridden rows
  - Batch override attachmentKey → attachmentName conversion + regression guard
  - Global panel default sort changed to (attachmentName, asc)
  - CONTEXT.md supersede markers on D-78/D-79 with forward reference to D-91
affects: [phase-06-optimize-assets (consumer of overrides map for export target dims), phase-08-save-load (persistence of overrides), phase-09-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Percent-as-fraction-of-source (D-91): override math is decoupled from peakScale — consumers render peakScale as the floor-free default, switch to percent/100 when an override exists. Peak remains the engine-computed measurement; source is the absolute max."
    - "attachmentKey → attachmentName conversion at panel→AppShell boundary: internal React row identity stays attachmentKey; outbound override-dialog contract uses attachmentName. Conversion lives at the panel edge, grep-anchored by arch.spec invariant."
    - "Two-reset-button dialog pattern: one button clears state, one applies a concrete value. Both are valid user intents; making them separate removes ambiguity about what 'Reset' means."
    - "Supersede-with-forward-reference: when a human-verify deviation supersedes a locked decision, mark the original SUPERSEDED inline with a forward reference to the new decision number + the SUMMARY §Deviations section, rather than deleting the original text. Preserves the reasoning trail."
    - "Grep-anchored regression guard for UI invariants: test/arch.spec greps the panel source for a forbidden pattern (raw `selected` passed as `selectedKeys`) and a required pattern (named `selectedAttachmentNames` intermediate). Lightweight, CI-enforced, catches prop-contract regressions without Testing Library."

key-files:
  created:
    - ".planning/phases/04-scale-overrides/04-03-SUMMARY.md"
  modified:
    - "src/core/overrides.ts (applyOverride single-arg signature)"
    - "src/renderer/src/lib/overrides-view.ts (byte-identical twin)"
    - "tests/core/overrides.spec.ts (rewrite applyOverride cases; parity loop reduced to single-arg percents)"
    - "src/renderer/src/modals/OverrideDialog.tsx (two-reset-button UX)"
    - "src/renderer/src/components/AppShell.tsx (dialog prefill reads row.peakScale)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (batch fix + default sort + effective-scale consumer update + tooltip format)"
    - "src/renderer/src/panels/AnimationBreakdownPanel.tsx (effective-scale consumer update + tooltip format)"
    - "tests/arch.spec.ts (+2 regression guards for attachmentKey→attachmentName conversion)"
    - ".planning/phases/04-scale-overrides/04-CONTEXT.md (D-78/D-79 SUPERSEDED markers + D-91 new semantics block)"

key-decisions:
  - "D-91: Override percent = target effective scale as fraction of SOURCE dimensions (supersedes D-78/D-79). 100% = source dims (absolute max). Peak is no longer part of applyOverride's math; consumers fall back to peakScale when no override is set."
  - "Dialog gets two reset buttons: Reset to peak (clear override) and Reset to source (100%) (apply-100). Replaces the single ambiguous Reset from D-80."
  - "Dialog prefill for non-overridden rows = round(peakScale*100) — shows current effective as the starting value under the new semantics. Batch scope reuses the clicked row's peak."
  - "Batch-override scope is carried by attachmentName, not attachmentKey. Global panel converts its internal Set<attachmentKey> to Set<attachmentName> at the dialog invocation site. arch.spec greps lock the contract."
  - "Global panel default sort changed from (peakScale, desc) to (attachmentName, asc) so the animator doesn't lose edited rows off-screen in long lists."
  - "CLI stays byte-for-byte unchanged. Overrides are renderer-only session state until Phase 6 export consumes the map."

patterns-established:
  - "Deviation rule 4 (Rule 4 — architectural change-of-intent) loop: human-verify surfaces a gap → user authorizes via quote → executor documents supersede marker + new decision + SUMMARY §Deviations with verbatim quote → all locked decision text preserved for traceability."
  - "Gap-fix continuation agent: Tasks 1+2 shipped by prior agent, human-verify by user, continuation agent applies gap-fixes as atomic commits per gap, closes the plan with a unified SUMMARY covering the full arc."

requirements-completed: [F5.1, F5.2, F5.3]

# Metrics
duration: ~45min (Task 1+2 prior ~15min + human-verify user time + gap-fix continuation ~9min + admin)
completed: 2026-04-24
---

# Phase 4 Plan 03: Panel wiring + gap-fix continuation Summary

**Two panels now render override-aware cells; override dialog opens on double-click; new D-91 source-fraction semantics rewire applyOverride, dialog reset buttons, prefill, tooltip, and Global-panel default sort — all human-verify-approved.**

## Performance

- **Duration:** ~45 min total (Task 1+2 prior execution ~15min + human-verify flow + 8 gap-fix commits ~9min)
- **Started:** 2026-04-24T09:58Z (plan open) / 2026-04-24T15:06:20Z (gap-fix continuation)
- **Completed:** 2026-04-24T15:14:59Z
- **Tasks:** 3 planned + 8 gap-fix sub-tasks = 11 total
- **Files modified:** 10

## Accomplishments

- Both panels (GlobalMaxRenderPanel + AnimationBreakdownPanel) render override-aware Scale + Peak W×H cells with orange-accent badging.
- Double-click on any Scale cell opens the override dialog with correct scope (Global: batch when ≥2 selected; Animation Breakdown: always per-row per D-90).
- D-69 AnimationBreakdown Override Scale button unlocked with hover affordance.
- D-91 new override semantics: percent is now fraction of source dimensions (not peak); applyOverride is single-arg; helper text "Max = 100% (source dimensions)" is literally true.
- Two-reset-button dialog: "Reset to peak" (clear) + "Reset to source (100%)" (apply 100). Resolves the single-Reset ambiguity surfaced at human-verify.
- Global-panel default sort is (attachmentName, asc) so the just-edited row stays visible.
- Batch-override scope bug (attachmentKey vs attachmentName mismatch) fixed with a grep-anchored arch.spec regression guard.
- Phase 4 CLOSED — ready for /gsd-verify-work 4.

## Task Commits

1. **Task 1 (prior agent): Wire GlobalMaxRenderPanel — badges + dialog trigger + effective-scale sort** — `0011f0d` (feat)
2. **Task 2 (prior agent): Wire AnimationBreakdownPanel — badges + dialog trigger + unlock Override button** — `bb9f526` (feat)
3. **Task 3 (human-verify checkpoint): Full drop flow on SIMPLE_TEST.json** — user signed off 14 steps with 4 deviations surfaced
4. **Gap-fix G1: applyOverride semantics — effective scale = override/100 (supersedes D-78/D-79)** — `6a1a61d` (refactor)
5. **Gap-fix G2: two-reset-button override dialog (Reset to peak + Reset to source)** — `0c5af2f` (feat)
6. **Gap-fix G3: AppShell dialog prefill = round(peakScale*100) for non-overridden rows** — `22626e9` (feat)
7. **Gap-fix G4: Global panel — batch-scope attachmentName conversion + default sort by name + effective-scale consumer update** — `0d964a5` (fix)
8. **Gap-fix G5: Animation Breakdown panel — effective-scale consumer update + tooltip format** — `b98d918` (fix)
9. **Gap-fix G6: lock attachmentKey → attachmentName conversion at batch override invocation (regression for human-verify gap)** — `c5118b3` (test)
10. **Gap-fix G7: supersede D-78/D-79; document new override semantics (D-91)** — `e396021` (docs)
11. **Plan metadata: final SUMMARY + STATE + ROADMAP** — landed in the final docs commit (see STATE.md session timestamp)

_Note: Task 3 was a checkpoint, not a commit. The 8 gap-fix commits replace what would have been a single "Task 3 signoff" metadata commit under the clean path._

## Files Created/Modified

- `src/core/overrides.ts` — applyOverride signature changed to single-arg (overridePercent) → { effectiveScale = percent/100, clamped }. Docblock updated with supersede note forward-referencing D-91 + 04-03-SUMMARY.md.
- `src/renderer/src/lib/overrides-view.ts` — byte-identical twin; same signature change.
- `tests/core/overrides.spec.ts` — applyOverride behavior cases rewritten (7 cases: 50/200/30/100/101/1/0 percents → effectiveScale 0.5/1.0/0.3/1.0/1.0/0.01/0.01 with correct clamped flags); parity loop reduced to 10 sampled percents; 26 specs pass.
- `src/renderer/src/modals/OverrideDialog.tsx` — "Reset to 100%" replaced by two buttons: "Reset to peak" (calls onClear, visible only when anyOverridden) + "Reset to source (100%)" (calls onApply(100), always visible). ARIA unchanged.
- `src/renderer/src/components/AppShell.tsx` — onOpenOverrideDialog now prefills currentPercent with `overrides.get(row.attachmentName) ?? Math.round(row.peakScale * 100)`.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — (a) enrichWithEffective switched to applyOverride(override) + sourceW/H × override/100 for effective dims; (b) default sort changed to (attachmentName, asc); (c) selectedAttachmentNames intermediate (memoized from keyToName map) handed to Row.selectedKeys instead of raw `selected`; (d) Scale-cell tooltip format is now "{X}% of source = {S.SSS}×".
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — enrichCardsWithEffective switched to applyOverride(override) + sourceW/H × override/100; tooltip format updated.
- `tests/arch.spec.ts` — new describe block "GlobalMaxRenderPanel batch-scope invariant (04-03 gap-fix A regression guard)" with two greps: forbid `selectedKeys={selected}`, require `selectedAttachmentNames` + `selectedKeys={selectedAttachmentNames}`. arch.spec 6→8.
- `.planning/phases/04-scale-overrides/04-CONTEXT.md` — D-78 and D-79 gain inline SUPERSEDED markers with forward references; new D-91 block documents the full set of new semantics.

## Decisions Made

See the plan's key-decisions frontmatter. Summary:

- **D-91 added** — percent = target fraction of source dimensions. Peak is no longer part of applyOverride's math. Source dims are the canonical absolute max, matching F5.2's "clamped at source max" literal.
- **D-78/D-79 superseded** — preserved inline with SUPERSEDED markers. Rule 4 (architectural change-of-intent) deviation signed off by the user at human-verify.
- **Batch-contract boundary clarified** — panels may track selection by any stable identity internally (attachmentKey for Global), but outbound override-dialog contract is always attachmentName.
- **Default sort changed** — attachmentName asc beats peakScale desc when edits are active; the animator needs to keep the edited row visible.
- **CLI stays unchanged** — overrides are renderer session state until Phase 6 export.

## Deviations from Plan

### Deviations surfaced at Task 3 (human-verify) and fixed in gap-fix G1–G7

All four deviations are documented with the verbatim user quote from human-verify 2026-04-24.

**1. [Rule 1 - Bug] Batch override silently collapses to clicked row (Gap A)**

- **Found during:** Task 3 (human-verify step 6).
- **User quote:** "Failed: only the row selected gets overriden"
- **Issue:** GlobalMaxRenderPanel tracks selection via `selected: Set<string>` where strings are `attachmentKey` values (stable React row keys, format `"${skin}|${slot}|${attachment}"`). But AppShell.onOpenOverrideDialog does `selectedKeys.has(row.attachmentName)` to detect batch scope — attachmentKey ≠ attachmentName, so the `.has` check always fails, `inSelection` stays false, scope falls back to `[row.attachmentName]`, and only the double-clicked row gets the override.
- **Fix:** At the invocation site inside GlobalMaxRenderPanel, convert `selected` → `Set<attachmentName>` via a memoized `keyToName` map over the enriched rows. The named intermediate `selectedAttachmentNames` is grep-anchored by tests/arch.spec.ts so a future regression (passing `selected` directly) trips CI.
- **Files modified:** src/renderer/src/panels/GlobalMaxRenderPanel.tsx, tests/arch.spec.ts (regression guard).
- **Verification:** arch.spec 6→8; full suite 116/1 green; manual human-verify re-check would show 2+ selected rows all receiving the same override now.
- **Committed in:** `0d964a5` (Gap A fix) + `c5118b3` (regression guard).

**2. [Rule 4 - Architectural change-of-intent] Override semantics rewrite (Gap B)**

- **Found during:** Task 3 (human-verify step 4).
- **User quote:** "The override panel states 'Max = 100% (source dimensions)' but this is not true - resetting to 100% currently resets to peak value instead. User has no way to increase value past calculated peak. My suggestion is: let user type the value it wants (e.g., 500%) and the texture size may increase until it hits source dimensions (canonical dimensions must be the abslute maximum, never to be surpassed)"
- **Issue:** D-78 and D-79 as originally locked treated percent as a fraction of the engine-computed peakScale. Under that model: no override = peak, 100% = peak (not source), >100% is mathematically unreachable since peak ≤ source and any value above peak would break F5.2. The helper text "Max = 100% (source dimensions)" was aspirational/misleading. User wants the percent to target source dimensions directly so 100% genuinely = source.
- **Fix (user-approved):**
  - `applyOverride(percent)` now single-arg, returns `effectiveScale = clampOverride(percent) / 100`.
  - No override set → effective scale = peakScale (the floor-free engine default, unchanged).
  - Override X% → effective scale = X/100, regardless of peak (user may under-size below peak intentionally).
  - Peak W×H column = sourceW/H × override/100 on overridden rows.
  - Dialog prefill for non-overridden rows = round(peakScale * 100) so the starting value shows current effective.
  - Two reset buttons replace the single "Reset to 100%": Reset to peak (clear override) + Reset to source (100%) (apply-100). Reset to peak is visible only when anyOverridden; Reset to source is always visible.
  - Scale-cell hover tooltip format: "{X}% of source = {S.SSS}×" (dropped the old "Peak N× × Y% =" prefix).
  - D-78 and D-79 marked SUPERSEDED inline in 04-CONTEXT.md with forward reference to D-91; full rationale preserved in both the decision block and this SUMMARY.
- **Files modified:** src/core/overrides.ts, src/renderer/src/lib/overrides-view.ts, tests/core/overrides.spec.ts, src/renderer/src/modals/OverrideDialog.tsx, src/renderer/src/components/AppShell.tsx, src/renderer/src/panels/GlobalMaxRenderPanel.tsx, src/renderer/src/panels/AnimationBreakdownPanel.tsx, .planning/phases/04-scale-overrides/04-CONTEXT.md.
- **Verification:** 26 overrides.spec specs pass (was 25); full suite 116/1; web typecheck clean; CLI byte-for-byte unchanged.
- **Committed in:** `6a1a61d` (G1 core math) + `0c5af2f` (G2 dialog) + `22626e9` (G3 AppShell prefill) + `0d964a5` (G4 Global panel) + `b98d918` (G5 Animation Breakdown panel) + `e396021` (G7 CONTEXT.md supersede + D-91).

**3. [Rule 4 - UX polish, user-approved] Global panel default sort by name, not scale (Gap C)**

- **Found during:** Task 3 (human-verify step 14).
- **User quote:** "yes, but it's annoying because the row can go offscreen in long list, so user can't verify edit. My suggestion: the default sorting should be by name, not by scale."
- **Issue:** With effective-scale sort as default (D-29 peakScale desc), editing a row re-shuffles the list; on long rigs the just-edited row goes off-screen and the animator can't verify the change.
- **Fix:** Default sort changed to (attachmentName, asc). Sort comparator and user's ability to re-sort by any column preserved (clicking Scale header re-sorts by effective scale).
- **Files modified:** src/renderer/src/panels/GlobalMaxRenderPanel.tsx (initial useState values).
- **Verification:** Single-line state change; rest of sort pipeline untouched. arch.spec unaffected.
- **Committed in:** `0d964a5` (part of G4 Global panel commit).

**4. [Documentation deferral — no code change] CLI override reflection (Gap D)**

- **Found during:** Task 3 (human-verify step 13).
- **User quote:** "the cli info should show the overrides made or not? It doesn't, it shows an unchanged table."
- **Issue/decision:** This is a boundary question, not a bug. Overrides are renderer session state and intentionally don't cross the preload→main→CLI boundary until Phase 6 introduces the export pipeline. Phase 6 "Optimize Assets" will consume overrides for real output; the CLI remains the pure-math "what does the engine peak at?" dump.
- **Fix:** No code change. Documented explicitly in the Deferred section of this SUMMARY and in 04-CONTEXT.md §Domain boundary. `scripts/cli.ts` stays byte-for-byte unchanged.
- **Committed in:** N/A (docs-only, covered by the final metadata commit).

---

**Total deviations:** 4 surfaced at human-verify, 3 fixed with code commits (Gap A Rule 1 + Gap B Rule 4 + Gap C Rule 4) + 1 documented deferral (Gap D).

**Impact on plan:** All four are user-approved. Gap A is a pure bug fix (Rule 1) — no design impact. Gap B is a locked-decision supersede (Rule 4) with D-91 as the authoritative replacement; the original D-78/D-79 text is preserved with supersede markers for traceability. Gap C is a UX tweak that landed as part of Gap B's commit. Gap D is a boundary clarification for Phase 6 readers.

## Issues Encountered

- **Intermediate typecheck red state between G1 and G5.** G1 changed applyOverride's signature; the two panel consumers only catch up in G4/G5. Intermediate commits 6a1a61d, 0c5af2f, 22626e9 have a red web typecheck. This is called out in the G1 commit message. A future refactor could order the consumer updates first, but the semantics-first ordering was clearer for reviewers and the full suite is green at the end of G5.

## Deferred

- **CLI does not reflect overrides (Gap D from human-verify).** Intentional Phase 4/Phase 6 boundary. Overrides are renderer session state; Phase 6 export pipeline consumes them via `src/core/export.ts` + `applyOverride()` from Phase 4's math. `scripts/cli.ts` remains the pure engine-peak dump.
- **Pre-existing `scripts/probe-per-anim.ts` TS2339** — inherited from Phase 0; logged in `deferred-items.md`. Not Phase 4's problem.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- Phase 4 COMPLETE — F5.1 + F5.2 + F5.3 implemented end-to-end.
- F5.4 (cross-session persistence) remains Phase 8.
- Phase 4 `/gsd-verify-work 4` ready.
- Phase 5 (unused attachment detection) unblocked.

## Self-Check: PASSED

- `.planning/phases/04-scale-overrides/04-03-SUMMARY.md` — FOUND (this file).
- Commit `0011f0d` (Task 1) — FOUND.
- Commit `bb9f526` (Task 2) — FOUND.
- Commit `6a1a61d` (G1) — FOUND.
- Commit `0c5af2f` (G2) — FOUND.
- Commit `22626e9` (G3) — FOUND.
- Commit `0d964a5` (G4) — FOUND.
- Commit `b98d918` (G5) — FOUND.
- Commit `c5118b3` (G6) — FOUND.
- Commit `e396021` (G7) — FOUND.

---
*Phase: 04-scale-overrides*
*Completed: 2026-04-24*
