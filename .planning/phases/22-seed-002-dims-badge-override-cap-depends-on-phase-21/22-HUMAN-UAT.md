---
status: complete
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
source: [22-VERIFICATION.md (human_verification), .planning/todos/pending/2026-05-03-phase-22-dims-badge-override-cap-human-uat.md]
started: 2026-05-03T08:08:49Z
updated: 2026-05-03T09:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. DIMS-02 badge — GlobalMaxRenderPanel
expected: Run `npm run dev`. Load a drifted project (e.g. run Optimize on SIMPLE_PROJECT once with a downscale, then re-load). In Global Max Render Source panel, every row whose actual PNG is smaller than canonical carries an info-circle badge after Source W×H. Badge `w-4 h-4`, inline-flex, no clipping at 100% zoom.
result: issue
reported: |
  Basic badge rendering verified — when actual PNG dims < canonical, info-circle badge appears on CIRCLE + SQUARE rows; TRIANGLE (no drift) has no badge. No clipping at 100% zoom.

  HOWEVER cross-mode UX bug surfaced: badge ALSO appears when "Use Images Folder as Source" is UNCHECKED (atlas-source mode). In atlas-source mode the Source W×H column displays the canonical/atlas dims (e.g. 699×699 for CIRCLE) while the badge tooltip declares "Source PNG (smaller dims) is smaller than canonical (699×699)" — the displayed Source value IS the canonical value, making the badge message confusing/contradictory in this mode.

  Expected user mental model: badge surfaces drift only when the displayed Source W×H is the actual on-disk dim (i.e. atlas-less / images-folder-as-source mode). In atlas-source mode the displayed dims already match canonical, so the "smaller than canonical" callout reads as a contradiction.
severity: major

### 2. DIMS-02 badge — AnimationBreakdownPanel sibling parity
expected: With same drifted project loaded, switch to Animation Breakdown panel. Same info-circle badge appears on the same regions, identical visual treatment to GlobalMaxRenderPanel (Phase 19 D-06 sibling-symmetric invariant).
result: pass

### 3. Badge tooltip — concrete dim values, no template-literal leakage
expected: Hover the badge in either panel. Tooltip reads "Source PNG (W×H) is smaller than canonical region dims (W×H). Optimize will cap at source size." with W/H replaced by concrete numbers (e.g. 811×962 → 1628×1908). No literal `${...}` text. No clipping when region names are long.
result: issue
reported: |
  Two distinct issues:

  (3a) Tooltip flakiness — hovered the badge multiple times with no effect. Tooltip surfaced exactly once with correct concrete dim values (no template-literal leakage when it did render). Several subsequent hovers produced nothing. Hover-trigger appears unreliable.

  (3b) Tooltip wording should be cap-binding-aware (UX refinement / behavioral correctness):

  Current wording always claims "Optimize will cap at source size." But when actual < canonical, two cases exist mathematically:
    - Case A (cap binding): peakScale > actualW/canonicalW → cap actually clamps export → current wording correct
    - Case B (cap not binding): peakScale ≤ actualW/canonicalW → cap is irrelevant; export already below source → current wording is misleading

  The data already distinguishes these via `peakAlreadyAtOrBelowSource` flag in buildExportPlan. Proposed UX:
    - Case A → keep current full message
    - Case B → drop second sentence; show only "Source PNG (W×H) is smaller than canonical region dims (W×H)." (informational, no cap claim)
    - If user applies an override that pushes effective scale ABOVE source → wording reverts to include "Optimize will cap at source size."

  This makes the tooltip honest about when the cap is actually doing work.
severity: major

### 4. OptimizeDialog — COPY chip placement parity with excludedUnused muted UX
expected: Open OptimizeDialog on the drifted project. Pre-flight file list shows passthrough rows with `opacity-60` muting and a bordered uppercase "COPY" chip. Placement and visual weight read consistently with the existing `excludedUnused` muted treatment (Phase 6 D-109 round-1 parity).
result: issue
reported: |
  COPY chip placement and muted styling read fine. But two real issues surfaced:

  (4a) Predicate too narrow — TRIANGLE row shows `833×759 → 833×759` (no-op resize) with NO COPY chip. CIRCLE and SQUARE (dimsMismatch=true, cap binding) get the COPY chip correctly. But TRIANGLE has dimsMismatch=false and peakScale=1.000× so no resize is actually needed — yet it falls into rows[] and would be Lanczos-resampled at scale=1.0× (wasteful + not byte-identical to source). Current passthrough predicate is `dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)`. Should also catch `peakScale=1.0` no-op rows regardless of dimsMismatch. Generalised: any row where outW = sourceW AND outH = sourceH (post-cap) should be a byte-copy passthrough.

  (4b) UX wording — drop the "(already optimized)" parenthetical; show only the COPY chip. The chip alone communicates "this file is byte-copied, no resize"; "already optimized" is redundant and arguably wrong for the no-op-resize case (TRIANGLE isn't optimized — it's just at the right size already).
severity: major

### 5. OptimizeDialog passthrough rows — show actual on-disk dims, not canonical
expected: In OptimizeDialog passthrough rows, the dim label renders the **actual on-disk** PNG dims (e.g. 811×962), NOT the canonical region dims (e.g. 1628×1908). This was the CHECKER FIX 2026-05-02 propagating actualSourceW/H from DisplayRow → ExportRow.
result: pass
notes: |
  Confirmed: CIRCLE shows 392×392 (actual), SQUARE shows 670×670 (actual). Canonical dims (699×699, 1000×1000) are correctly NOT rendered on passthrough rows. CHECKER FIX 2026-05-02 verified.

  Adjacent gap surfaced (recorded separately in Gaps): passthrough rows show only source dims; missing the `→ target` half. TRIANGLE row shows `833×759 → 833×759`. Passthrough rows should adopt the same source→target shape so user-applied overrides can preview their target dims before clicking Start.

### 6. Round-trip byte-fidelity — re-running Optimize produces zero exports
expected: Run Optimize on the drifted project to a fresh outDir. Then `cmp -s` each output PNG against its source — every file is byte-identical (no double Lanczos). Optimize summary shows N passthrough copies and 0 resizes.
result: pass
notes: |
  No-override byte-identity verified via `cmp -s` loop — every output PNG byte-identical to source. DIMS-05 round-trip claim holds when no override is applied.

  HOWEVER a blocker bug surfaced during this test: applied a 50% override to SQUARE.png and the row still wrote a byte-copy instead of a 50% resize (335×335). Override silently ignored on passthrough rows. Recorded as separate gap (Gaps section) — affects core feature contract. User explained the practical importance: animators routinely override glow/blend-mode attachments below the calculated optimum because perceptual degradation is hidden by additive blending; this is a primary memory-saving workflow that the current passthrough partition breaks.

### 7. Layout sanity — no horizontal toolbar shift on badge addition
expected: With and without drifted projects loaded, toolbar position is invariant (no horizontal shift when badges appear). AppShell root `min-h-screen` invariant intact (per locked memory project_layout_fragility_root_min_h_screen.md). Row height not pushed by inline badge.
result: pass

### 8. Dark mode — badge + tooltip legibility
expected: Toggle dark mode (system or app). Badge icon stroke visible against dark surface; tooltip background contrast sufficient for readability; no color regressions versus light mode.
result: pass
notes: |
  Badge legibility in dark mode confirmed by user. Tooltip legibility portion deferred — could not be exercised reliably due to hover-flakiness logged as Test 3 gap 3a (tooltip surfaces unpredictably). Re-run dark-mode tooltip check after gap 3a fix lands.

### 9. Browser zoom 100% / 125% / 150% — badge scales without clipping
expected: Use Electron zoom (Cmd+= / Cmd+-) to step through 100/125/150%. Badge `w-4 h-4` scales proportionally, stays vertically centered with the dim text, no clipping. Tooltip stays anchored to the badge at all zoom levels.
result: pass

## Summary

total: 9
passed: 6
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "DIMS-02 badge surfaces canonical-vs-actual drift only when meaningful — i.e. only when the displayed Source W×H is the actual on-disk PNG dim (atlas-less / images-folder mode). In atlas-source mode the displayed dims already equal canonical so the badge tooltip 'Source PNG smaller than canonical (W×H)' reads as a contradiction."
  status: failed
  reason: "User reported: badge appears in BOTH modes (atlas-source unchecked AND images-folder-as-source checked). In atlas-source mode the Source W×H column shows canonical (e.g. 699×699) yet the badge declares the source is smaller than canonical — confusing/contradictory. Expected: badge gated to images-folder-as-source mode, OR tooltip wording updated to disambiguate atlas-source case (e.g. 'Atlas declares 699×699 but on-disk PNG is 392×392 — Optimize will cap at on-disk size')."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "DIMS-02 badge tooltip reliably surfaces on hover (primary affordance for surfacing the drift message)."
  status: failed
  reason: "User reported: hovered the badge multiple times with no tooltip rendering. Tooltip appeared correctly exactly once during the session; many subsequent hover attempts produced nothing. Hover-trigger is unreliable. Possible causes: hover-target sized too small, pointer-events misconfigured on parent, tooltip mount/unmount race, or virtualization re-creating row removing the listener mid-hover."
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "DIMS-02 badge tooltip wording reflects whether the source-dim cap is actually binding for this row (cap-binding-aware copy)."
  status: failed
  reason: "User-proposed UX refinement (mathematically grounded). Current wording always asserts 'Optimize will cap at source size.' regardless of whether peakScale > sourceRatio or peakScale ≤ sourceRatio. When peakAlreadyAtOrBelowSource (cap not binding), the second sentence is misleading — the export would be smaller than source even without a cap. Proposed: gate the 'Optimize will cap at source size.' suffix on isCapped (peakScale > sourceRatio); when peakAlreadyAtOrBelowSource, render only the first sentence ('Source PNG (W×H) is smaller than canonical region dims (W×H).'). Override interaction: if user override pushes effective scale ABOVE source, the suffix should re-appear. Data already exists in ExportPlan via isCapped/peakAlreadyAtOrBelowSource flags from buildExportPlan."
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "DIMS-04 passthrough predicate covers ALL rows where output dims would equal source dims (i.e. no actual resize), not just dimsMismatch rows."
  status: failed
  reason: "User reported: TRIANGLE row (no drift, peakScale=1.0×) shows '833×759 → 833×759' with NO COPY chip — falls into rows[] and would be Lanczos-resampled at scale=1.0×. Wasteful work + not byte-identical to source. Current predicate `isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)` excludes dimsMismatch=false rows. Generalised predicate: passthrough whenever outW === sourceW AND outH === sourceH after cap (covers TRIANGLE 1.0× case AND existing dimsMismatch+cap-binding cases). Files: src/core/export.ts:217+260+302 partition logic, src/renderer/src/lib/export-view.ts mirror, src/main/image-worker.ts:127 passthrough loop."
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "OptimizeDialog passthrough row label uses COPY chip alone as the indicator (drop redundant '(already optimized)' parenthetical)."
  status: failed
  reason: "User UX feedback: '(already optimized)' is redundant with the COPY chip and arguably wrong for no-op-resize rows (TRIANGLE isn't optimized — just at the right size). Drop the parenthetical; keep only the COPY chip. File: src/renderer/src/modals/OptimizeDialog.tsx PreFlightBody passthroughCopies block (~line 492+499)."
  severity: minor
  test: 4
  artifacts: []
  missing: []

- truth: "OptimizeDialog passthrough rows display source→target dims (same shape as resize rows) so user can preview override outcomes before clicking Start."
  status: failed
  reason: "User reported: TRIANGLE (resize row, no-op) shows '833×759 → 833×759'; CIRCLE/SQUARE (passthrough) show only '392×392' / '670×670' — missing the '→ target' half. When the cap binds with no override, source = target, but if user applies a 50% override to SQUARE (passthrough byte-copy currently), they'd expect the row to read '670×670 → 335×335' so they can review the override before exporting. Currently the override would have no preview because the passthrough row label doesn't carry target dims. Pre-flight review is the user's last sanity check — both row types should expose source→target consistently. Files: src/renderer/src/modals/OptimizeDialog.tsx PreFlightBody passthroughCopies dim label (line ~499); also coordinate with override-aware passthrough re-routing (an override that increases scale ABOVE source-ratio cap converts a passthrough back into a resize row — see also gap '3b' cap-binding-aware tooltip)."
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "User-applied scale overrides are honored on passthrough rows — when override forces effective scale BELOW the source-ratio cap, the row leaves the passthrough bucket and becomes a genuine resize."
  status: failed
  reason: "User reported BLOCKER: applied 50% override to SQUARE.png (passthrough state, actual 670×670 < canonical 1000×1000). Expected: SQUARE leaves passthroughCopies[], joins rows[] with effective scale = 0.5 × actualSourceRatio (or override interpreted as fraction of source — depends on semantic), output written as 335×335 resize. Actual: row remained in passthroughCopies[], `cmp -s` confirmed byte-copy, override silently ignored. Real-world impact (per user): animators routinely override glow/blend-mode attachments well below the calculated optimum because additive blending hides degradation — this is a primary memory-saving workflow currently broken. ROOT CAUSE HYPOTHESIS: passthrough partition in src/core/export.ts:217+260+302 uses `isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)` evaluated against the natural peakScale BEFORE override is applied. Need to compute effectiveScale post-override, then re-partition: a row is passthrough only if (outW === sourceW AND outH === sourceH) AFTER all overrides resolved. FIX SCOPE: src/core/export.ts buildExportPlan + override threading; src/renderer/src/lib/export-view.ts mirror; src/main/image-worker.ts passthrough loop unchanged (still byte-copy when row IS passthrough); add tests/core/export.spec.ts coverage for 'override below source-ratio re-routes passthrough to resize'."
  severity: blocker
  test: 6
  artifacts: []
  missing: []
