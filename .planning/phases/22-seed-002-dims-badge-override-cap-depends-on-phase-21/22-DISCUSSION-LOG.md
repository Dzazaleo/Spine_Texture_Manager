# Phase 22: SEED-002 dims-badge + override-cap (depends on Phase 21) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 22-seed-002-dims-badge-override-cap-depends-on-phase-21
**Areas discussed:** Atlas-less drift scope, Override % semantics, OptimizeDialog cap visibility, Already-optimized round threshold

---

## Atlas-less drift scope (D-01)

User initially asked for a plain-language explanation. After explanation: "ok option1 then".

| Option | Description | Selected |
|--------|-------------|----------|
| Unified — JSON as canonical for both modes | Use JSON skin attachment width/height as the canonical dims source for ALL projects (atlas-less + canonical-atlas). Verified: Spine 4.2 JSON skin attachments carry per-region width/height. Compare against PNG header reads. One drift-detection path for both modes; atlas-less Scenario A is caught. Phase 21's `'png-header'` SourceDims variant stays untouched — we add a parallel `canonicalW/H` field separate from `sourceW/H`. | ✓ |
| Atlas-only canonical, atlas-less drift skipped | Use atlas `orig:` lines as canonical (canonical-atlas only). Atlas-less projects never report drift since synthetic-atlas canonical == PNG by Phase 21's D-12. Scenario A in atlas-less mode silently unsupported. Smaller blast radius (no Phase 21 contract changes), but leaves a real user scenario uncovered. | |
| Hybrid — atlas-orig when available, JSON fallback otherwise | In canonical-atlas mode use atlas `orig:`; in atlas-less mode fall back to JSON. Two code paths but each minimal. Risk: if atlas `orig:` and JSON width/height disagree on the same project, behavior diverges by load mode. | |

**User's choice:** Unified — JSON as canonical for both modes
**Notes:** User asked for plain-terms explanation first. Explained Scenario A (user pre-shrunk PNGs in Photoshop) and Scenario B (re-running Optimize after Overwrite-all). Explained that Phase 21 made canonical=PNG by construction in atlas-less mode, but Spine 4.2 JSON carries per-region width/height regardless of atlas presence — so JSON-as-canonical works for both modes. User confirmed Option 1 after explanation.

---

## Override % semantics (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| % of canonical | Override field stays as '% of canonical JSON dims' (current behavior, locked memory `project_phase6_default_scaling.md` precedent). Cap kicks in transparently. Existing .stmproj override values keep meaning across loads. Badge + tooltip explain WHY the cap fires. | ✓ |
| % of actualSource | Override field becomes '% of actual PNG dims'. User sees what they get directly. But .stmproj overrides written before Phase 22 referenced canonical dims — needs a migration step on load. More UX clarity, more migration cost. | |
| Show both, override % of canonical | Behavior identical to option 1, but the override dialog UI shows both numbers — e.g. '50% → 814×954 canonical, capped to 811×962 actual'. No migration; clearer UX surface. Slightly more dialog real estate. | |

**User's choice:** % of canonical (Recommended)
**Notes:** No additional notes.

---

## OptimizeDialog cap visibility (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — muted only for fully-skipped | Already-optimized rows get muted treatment + 'already-optimized — skipped' indicator (parity with Phase 6 D-109 `excludedUnused`). Partially-capped rows look identical to normal rows. Cleanest dialog. | ✓ (with modification) |
| Verbose — cap label on every capped row | Every capped row shows '↓ capped' chip + 'X× → Y× (source-limited)' text. Most informative. Risk: dialog gets noisy on Scenario B projects. | |
| Grouped sections | Dialog splits into 'Already-Optimized (skipped)' / 'Capped (partial)' / 'Normal' sections. Most surface change. | |

**User's choice:** Option 1 (minimal) — but with **"COPY"** label instead of "skipped" / "X smaller".

**Follow-up — what does "COPY" mean?**

| Option | Description | Selected |
|--------|-------------|----------|
| Action: byte-copy file to output dir | Already-optimized rows get a `fs.copyFileSync` from source PNG to outDir/images/<region>.png — no Lanczos, no quality loss, output folder is COMPLETE. Indicator label reads 'COPY'. New third category: passthrough copies (NOT exclusions). User gets a complete output folder. | ✓ |
| Label only — still excluded from output | Behavior matches SEED-002 literal wording: row added to `excludedAlreadyOptimized[]`, no file written. Only the dialog text changes. User left with a partial output folder. | |

**User's choice:** Action: byte-copy file to output dir
**Notes:** This deviates from SEED-002's literal "skip the export entirely" wording in favor of the user's mental model ("I hit Optimize, I get a complete `images/` folder back"). Resulting design: new `passthroughCopies[]` array on `ExportPlan` (parallel to but distinct from Phase 6 `excludedUnused[]`); image-worker.ts gains a copy path alongside the sharp-resize path; OptimizeDialog shows muted "COPY" indicator.

---

## Already-optimized round threshold (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict ceil-equality on both axes | A row is passthrough only when `ceil(actualSourceW × cappedEffScale) === actualSourceW` AND `ceil(actualSourceH × cappedEffScale) === actualSourceH`. Matches SEED-002's literal wording. Edge case: aspect-ratio rounding noise can leave a row at -1px on one axis, triggering a wasteful 1px Lanczos resample. Predictable; SEED-aligned. | ✓ |
| Tolerant — ±1px on either axis | Treat any output dim within 1px of actualSource as zero-net-change → passthrough copy. Catches aspect-ratio rounding noise. Side effect: a legitimately-tiny reduction (e.g. 962 → 961) gets passthrough'd instead of Lanczos'd. | |
| Tolerant — ±1px AND cappedEffScale ≥ 0.999 | Most defensive. Both ceil-output within 1px of actualSource AND cappedEffScale rounds to 1.000× at safeScale's thousandth precision. Closest to 'literally no shrinkage warranted by the math'. Fewer accidental passthroughs than option 2. | |

**User's choice:** Strict ceil-equality on both axes (Recommended)
**Notes:** No additional notes.

---

## Claude's Discretion

- Exact badge icon + visual styling — pick consistent with existing Phase 19 panel iconography. Tooltip wording matches ROADMAP DIMS-02 verbatim.
- Exact placement of the "COPY" indicator in OptimizeDialog — mirror Round 1 `excludedUnused` muted-row treatment.
- Whether `canonicalW/H` is `number | undefined` (matching `actualSourceW/H`) or always-required `number`. Recommend always-required (every region attachment in JSON has width/height per Spine schema).
- Round-trip vitest fixture strategy — programmatic mutation of Phase 21 fixture vs new directory. Planner decides.

## Deferred Ideas

- Atlas-extract drift detection (atlas page PNG drift) — backlog if it surfaces.
- Scenario A vs B distinguishing tooltip — single locked wording for now; revisit if user feedback warrants.
- Recency-based auto-detection (mtime comparison) — rejected per Phase 21 D-08 (mtime unreliable cross-platform).
- Telemetry for cap fires — defer to v1.3 if support volume warrants.
- Override dialog secondary indicator when cap fires on a 100% override row — defer pending UAT feedback.
- Async vs sync copyFile — planner research item.
- Round-trip fixture strategy — planner picks.

## Reviewed Todos (Not Folded)

- `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` — Phase 4 panel code review follow-up. Surface overlap (panels) but unrelated scope.
- `.planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — Phase 20 cross-platform DnD UAT. Unrelated to Phase 22.
