# Phase 37: Spine 4.2 Timeline Coverage Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 37-spine-4-2-timeline-coverage-hardening
**Areas discussed:** TIMELINE-02 escalation pre-resolution, Fixture authoring approach

---

## TIMELINE-02 escalation pre-resolution

Pre-discussion source-read in this session confirmed `InheritTimeline.apply` mutates `bone.inherit` (Animation.js:755) AND `bone.inherit` is read by `Bone.updateLocalToWorld` (Bone.js:144). The ROADMAP conditional escalation clause is therefore TRIGGERED → TIMELINE-03 is load-bearing (real-risk gap fix), test direction is `peak > baseline`. Question: how should the Phase 37 plan reflect that?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-commit in CONTEXT.md | CONTEXT.md records the source-read evidence + the escalation conclusion now. Plan 37-01 still writes the formal audit findings during execution (preserves the audit-doc trail), but planner pre-commits TIMELINE-03 to peak > baseline from day 1. Fastest path; ROADMAP already calls this a planning checkpoint. | ✓ |
| Re-derive in execution | CONTEXT.md just flags "audit likely to escalate per source-read." Plan 37-01 audits fresh during execution. Plan 37-02 test assertion direction (peak > baseline vs. invariance) is decided after 37-01's findings land in the doc. | |
| Pre-commit + skip the audit step | If the source-read is conclusive, audit doc gets a one-liner referencing this discussion + the Animation.js + Bone.js line numbers. No need for plan 37-01 to re-read source. Saves a plan but breaks the audit-trail convention (audit doc derives from in-execution source-read, not from CONTEXT discussion). | |

**User's choice:** Pre-commit in CONTEXT.md (Recommended).
**Notes:** Locks D-01 + D-02. Audit-doc trail is preserved (37-01 re-derives findings from source during execution with explicit line citations) while the planner can scope 37-02's assertion direction without depending on 37-01 first.

---

## Fixture authoring — InheritTimeline

REQ TIMELINE-03 locks the fixture path to `fixtures/INHERIT_TIMELINE/<file>.json` on disk. Which loader artifact set should ship alongside?

| Option | Description | Selected |
|--------|-------------|----------|
| Atlas-source (json + atlas + tiny placeholder png) | Mirrors fixtures/SIMPLE_PROJECT/. Atlas-source is the de-facto pattern across the existing fixture suite; loader/sampler paths are most-traveled. Texture content doesn't matter — a 1x1 placeholder or reused 1000x1000 from SIMPLE_TEST is fine. | ✓ |
| Atlas-less (json + images folder) | Aligns with project memory project_atlas_less_primary_workflow (Esoteric-recommended primary workflow). Synthetic atlas is built from PNG IHDR. Adds slight coverage for the atlas-less loader path on a new fixture, but isn't strictly under test here — only the sampler is. | |
| Both (atlas-source + parallel atlas-less variant) | Double-fixture under fixtures/INHERIT_TIMELINE/{atlas-source,atlas-less}/. Costs a second skeleton.json + sibling artifacts; gives mode-parity coverage of InheritTimeline through both loader paths. Probably overkill — InheritTimeline behavior is mode-invariant by construction. | |

**User's choice:** Atlas-source (Recommended).
**Notes:** Locks D-03 + D-04. Follows the existing fixture-directory pattern; reuses well-traveled loader code-path. Placeholder PNG bytes irrelevant per CLAUDE.md fact #4.

---

## Fixture authoring — RGBA2

REQ TIMELINE-04 explicitly allows JSON or synthetic. Which path?

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic in-test | Load an existing skeleton (e.g. SIMPLE_TEST), clone its skeletonData, programmatically inject an RGBA2Timeline on one slot's animation, run sampleSkeleton on both variants, assert byte-identical output. No new fixture directory; cleanest "with vs without" diff because both runs share the exact same animation modulo the injected timeline. | ✓ |
| JSON file at fixtures/RGBA2_TINT/ | Hand-author a minimal skeleton with RGBA2 keyframes on one slot in one animation. Pair with a baseline-without-RGBA2 sibling animation in the same skeleton (or sibling JSON). More on-disk artifact churn; matches the InheritTimeline pattern visually but is awkward for the "identical AABB output" assertion because two on-disk files drift over time. | |
| Hybrid — JSON skeleton, synthetic RGBA2 injection in test | Reuse an existing fixture's JSON (e.g. SIMPLE_TEST or a new minimal one), inject RGBA2Timeline programmatically at test time on top of the parsed skeletonData. Best of both — deterministic baseline JSON, controlled inject for the diff. | |

**User's choice:** Synthetic in-test (Recommended).
**Notes:** Locks D-05 + D-06. Test-resident construction is cleanest for the "with vs without" byte-equality assertion. Planner micro-decision: which existing skeleton to load (likely SIMPLE_TEST for smoke parity, or the new INHERIT_TIMELINE fixture for locality).

---

## Claude's Discretion

Two gray areas were surfaced in the initial multi-select but NOT selected by the user. Resolved without further user-facing question:

- **Geometry-invariance assertion granularity for RGBA2 (DC-01):** Strict deep-equal on `summary.globalPeaks` Map (key + full PeakRecord) plus strict equality on `peakScale` / `peakScaleX` / `peakScaleY` numeric fields per-record. No epsilon — RGBA2 must not influence bone math, so any drift is a real bug.
- **InheritTimeline test rig mechanics (DC-02):** Parent shrinks (1.0 → 0.4 → 1.0) + rotates; child has region attachment + `inheritScale: true` at setup, InheritTimeline detaches at the shrink frame via `Inherit.NoScale`. Baseline = same skeleton without InheritTimeline (always-inheriting). Detached peak world scale > inheriting baseline at the shrink frame.

## Deferred Ideas

- Per-frame inner-loop fan-out for sequence-mesh + DeformTimeline (oversize-bias only; reopen only on real-asset signal).
- Slot-color preview / RGBA2 product feature (out of SEED-005 Level B scope).
- Mesh-attachment InheritTimeline variant (region is sufficient to isolate the bone-inheritance signal).
- 60 Hz cross-rate coverage (REQ explicitly runs at default 120 Hz; rate is mode-invariant for inherit signal).
- Three pending todos surfaced by cross_reference_todos all belong to Phase 38 / Phase 39 per ROADMAP — explicitly NOT folded into Phase 37.
