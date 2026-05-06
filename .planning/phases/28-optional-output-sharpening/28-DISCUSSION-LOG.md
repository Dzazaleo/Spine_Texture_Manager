# Phase 28: Optional Output Sharpening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 28-optional-output-sharpening
**Original phase title:** PMA preservation in Optimize Assets export (pivoted mid-discussion)
**Areas discussed:** PMA toggle placement, PMA UX feedback, test fixture strategy, atlas-source/atlas-less precedence, downscale softness (emergent), sharpen amount, sharpen persistence

---

## Area 1: Atlas-less PMA toggle — placement & persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Settings dialog (project-level, persists in `.stmproj`) | Lives next to `samplingHz`. Per-project. Schema gains one optional boolean. | |
| OptimizeDialog (per-export-run, transient) | Visible at export trigger. No schema change. Re-checked every run. | |
| Both — `.stmproj` source of truth + OptimizeDialog mirror | Persist + visible at export. Two UIs for one setting. | |
| **(N/A) — reasoning superseded** | User asked for plain-English explanation, then questioned the underlying premise. Discussion pivoted. | ✓ |

**User's choice:** Triggered the pivot — "The app doesn't need to know if the pngs are premultiplied or not. It just needs to resize the images without doing any change that could potentially remove the PMA. Think of it this way: If user resizes PMA images in photoshop, when they are saved, they are practically the same images, just smaller. Our app needs to do the same. Am I thinking correctly or am I missing something?"

**Notes:** This question reframed the entire phase. Instead of presenting more options, ran a synthetic diagnostic (`scripts/pma-probe.mjs`) against the exact `image-worker.ts:447-451` resize chain to verify whether sharp 0.34 + libvips 8.17 actually produced PMA fringing or whether they auto-handled premultiplication internally. Result: sharp produces visually identical composited output for PMA and straight-alpha encodings — no fringing introduced by our pipeline. User then ran their own runtime A/B (atlas-source vs atlas-less, both PMA, byte-identical). Backlog 999.9 empirically falsified.

---

## Area 2: PMA UX feedback — silent vs visible indicator

**Status:** Mooted by D-01 falsification. No PMA work is being done; no UX feedback to design.

---

## Area 3: Test fixture strategy

**Status:** Mooted by D-01 falsification. No PMA test fixture needed. `scripts/pma-probe.mjs` retained as regression sentinel for the falsification itself.

---

## Area 4: Atlas-source/atlas-less precedence

**Status:** Mooted by D-01 falsification. No precedence rules to define because no per-source PMA flag is being introduced.

---

## Emergent Area 5: Downscale softness (Phase pivot)

User observation after PMA was settled: "the optimised version seems less sharp than the full size. I believe this is normal, because a downscaling can cause some blurriness. Anything we can do about this?"

Follow-up after I recommended Photoshop "Bicubic Sharper" mental model: user clarified Photoshop's manual default is plain Bicubic, not Bicubic Sharper. After empirically testing manual Photoshop reduction of their character texture and finding it slightly sharper than our Lanczos3-only export, user asked for an opt-in sharpen toggle on OptimizeDialog with default-OFF.

**Outcome:** Phase 28 scope pivoted from PMA preservation to optional output sharpening. The original phase title remains attached to the directory slug for grep-traceability; CONTEXT.md and ROADMAP.md will reflect the new scope.

---

## Area 6: Sharpen amount (post-pivot)

| Option | Description | Selected |
|--------|-------------|----------|
| Single conservative value, σ ≈ 0.5 | Hard-coded. Matches Photoshop's Bicubic Sharper preset. Simplest UX (just on/off). | ✓ |
| Preset dropdown — Low (0.3) / Medium (0.5) / High (0.8) | More flexible. Adds UI surface. Risk of "High" over-sharpening. | |
| Slider for σ, range 0.0–1.0 | Full control. Almost certainly overkill for v1.3. | |

**User's choice:** Single conservative σ = 0.5.
**Notes:** Locked as Decision D-05. If empirical feedback later says it's too weak/strong, revisit with evidence — but no preset menu / slider in v1.3.

---

## Area 7: Sharpen persistence (post-pivot)

| Option | Description | Selected |
|--------|-------------|----------|
| Persist in `.stmproj` (per-project) | Additive optional boolean. Backward-compat: missing field = false. Same pattern as `samplingHz`, `loaderMode`. | ✓ |
| Transient — reset to OFF every time OptimizeDialog opens | No schema change. Easy to forget. | |
| Persistent in app preferences (global, not per-project) | Same toggle across all projects. Mismatch risk between art styles. | |

**User's choice:** Persist in `.stmproj`.
**Notes:** Locked as Decision D-06. Schema gains `sharpenOnExport?: boolean` (or similar planner-chosen name); missing field defaults to false.

---

## Claude's Discretion

- Exact button copy on the OptimizeDialog toggle.
- Naming of the IPC payload field and the `.stmproj` field — should match each other.
- Location of the `SHARPEN_SIGMA = 0.5` constant (`src/core/` constants vs `src/main/image-worker.ts`).
- Test fixture choice for the SHARP-03 regression test.

## Deferred Ideas

- Sharpen preset menu (Low/Medium/High) — revisit if user feedback explicitly asks for granularity.
- Sigma slider — overkill without a live preview.
- Sharpen-on-upscale — out of scope; export ratios bounded ≤ 1.0 by Phase 22 override-cap.
- Atlas-source dark-fringe correction (PMA artifacts near arm/body overlaps in source atlases) — distinct concern surfaced during testing; future phase if it becomes a tester complaint.
- Auto-detect PMA in atlas-less mode — unreachable because PMA work itself is no-op; reopens only if `scripts/pma-probe.mjs` ever diverges.
