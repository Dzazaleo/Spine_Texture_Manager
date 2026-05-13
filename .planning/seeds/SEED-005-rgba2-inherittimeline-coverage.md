---
id: SEED-005
status: closed
planted: 2026-05-08
planted_during: post-spine-sequence-undercount audit (.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 5)
closed_during: 37-spine-4-2-timeline-coverage-hardening
closed: 2026-05-13
trigger_when: (a) we ship a feature that depends on accurate slot tinting (e.g. Atlas Preview color rendering); OR (b) a user reports a rig where animations look different in our app vs. Spine player; OR (c) a fixture surfaces an InheritTimeline-driven bug
scope: A=Small (audit only — confirm both are render-scale-irrelevant) / B=Medium (add fixture coverage) / C=Large (handle in any product feature that surfaces tint/inheritance)
proposed_phase: TBD — likely v1.4 or later
---

# SEED-005: RGBA2 (two-color tinting) + InheritTimeline coverage gap

**Closed:** 2026-05-13 (Phase 37 — Spine 4.2 Timeline Coverage Hardening shipped; TIMELINE-01..TIMELINE-05 all satisfied; audit doc items 6 + 7 PASS with source-cited evidence; `fixtures/INHERIT_TIMELINE/` + sampler tests `TIMELINE-03` / `TIMELINE-04` green).

## The Gap (one-line)

Two Spine 4.2 features that spine-ts handles but no fixture in our suite exercises:
1. **RGBA2Timeline** — slot two-color tinting (separate light + dark color channels, animated independently).
2. **InheritTimeline** — per-animation override of bone inheritance flags (`inheritScale`, `inheritRotation`).

Both are likely render-scale-irrelevant (they don't change geometry or world transforms in a way that affects bounding-box AABB), but neither is verified.

## Why it might matter

**RGBA2:** affects slot color rendering (Spine's two-color tinting is used for stylized lighting effects — separate hot-light and shadow tints). Doesn't affect geometry, so unrelated to peak render scale. **But** if we ever build a feature that previews slot colors (e.g. a thumbnail in Atlas Preview that shows the rig as it'd look at runtime, with tinting), RGBA2-ignoring code would render wrong.

**InheritTimeline:** lets an animation toggle a bone's `inheritScale` or `inheritRotation` mid-animation. If a rig uses this to make a child bone "detach" from the parent's scale during a specific frame, the world transform of that bone changes accordingly. If our sampler doesn't tick InheritTimeline through `state.apply()` correctly, we'd miss the detached-frame's bounds — likely an undersized peak.

## Why we deferred today (2026-05-08)

User explicitly chose to defer this and item 1 to a later phase, prioritizing the SequenceTimeline/DeformTimeline + Skin-bones + PhysicsConstraint timeline investigations (items 2/3/4 in the audit doc). RGBA2 is render-scale-irrelevant; InheritTimeline likely is too but unproven.

## What it would take to investigate (sketch)

**Step 1 — confirm the assumption that both are render-scale-irrelevant:**
- Read `node_modules/@esotericsoftware/spine-core/dist/Animation.js` for `RGBA2Timeline.apply` — confirm it only writes to `slot.color` / `slot.darkColor` (no geometry).
- Read same file for `InheritTimeline.apply` — does it mutate `Bone.inherit`, and does that flag affect `Bone.updateWorldTransform`? (It does: `Bone.js` checks `inherit` when computing world transforms from local.)
- If InheritTimeline DOES affect world transforms: it's not a coverage gap, it's a real risk. Re-route to the active investigation list.

**Step 2 — fixture or synthetic test:**
- Construct a minimal JSON fixture with one animation that toggles `inheritScale` from true→false→true on a rotating bone. Check if our sampler captures the increased scale during the "detached" frame.
- For RGBA2: if/when we ship slot-color preview, gate the test on that feature.

## Pointers

- spine-ts timeline classes: `node_modules/@esotericsoftware/spine-core/dist/Animation.js`
  - `RGBA2Timeline` — search the file
  - `InheritTimeline` — imported at SkeletonJson.js:29
- Sampler tick loop where state.apply happens: [src/core/sampler.ts:309-311](src/core/sampler.ts#L309-L311)
- Bone inheritance code in spine-ts: `node_modules/@esotericsoftware/spine-core/dist/Bone.js`

## Open question

If InheritTimeline turns out to affect world transforms, this seed should be promoted to the active audit list and routed to `/gsd-debug` immediately. Until then, deferred.
