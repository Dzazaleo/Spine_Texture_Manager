---
id: SEED-004
status: planted
planted: 2026-05-08
planted_during: post-spine-sequence-undercount audit (.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 1)
trigger_when: (a) a user reports "load failed: Rotated atlas regions are not supported"; OR (b) any new fixture exercises Spine packer's rotation toggle
scope: A=Small (error-message UX) / B=Medium (full rotated-region support)
proposed_phase: TBD — likely v1.4 if it surfaces
---

# SEED-004: Rotated atlas regions hard-fail

## The Bug (one-line)

Spine packer has a `rotation: true` toggle that lets it pack atlases more densely by rotating individual regions 90°. Our loader hard-throws on any such region with `Rotated atlas regions are not supported.` ([src/core/errors.ts:154](src/core/errors.ts#L154)). Any user whose Spine team enabled rotation in their atlas pack settings can't load the project.

## Why it might matter

The Spine editor's default atlas packer setting is "Rotation: Off" but production-quality atlases often turn it ON for ~10-20% better packing density. We don't know what the user base looks like, but it's not a niche feature.

## Why we deferred today (2026-05-08)

User explicitly chose to defer this and item 5 to a later phase, prioritizing the SequenceTimeline/DeformTimeline + Skin-bones + PhysicsConstraint timeline investigations (items 2/3/4 in the audit doc).

## What it would take to fix (sketch)

**Option A — better error message (Small):**
- Detect rotated regions during atlas parse, count them, throw a structured error: `"Atlas pack uses rotation: 12 of 240 regions are rotated. Re-pack with rotation disabled in Spine, or wait for v1.X where we'll support this."`
- Maybe surface as a UI alert with a "How to fix" link.

**Option B — actual support (Medium):**
- spine-ts already handles rotated regions at the GPU/render level (`region.rotate` flag). Our pipeline doesn't use spine-ts rendering — we read region geometry directly.
- AABB calculation in [src/core/bounds.ts](src/core/bounds.ts) needs to swap W↔H when `region.rotate === true` (or whatever flag the runtime exposes).
- ExportPlan output dimensions need the same swap.
- atlas-less mode: synthesizeAtlasText currently emits `rotated:false` always ([src/core/loader.ts:403](src/core/loader.ts#L403)). Likely OK to leave atlas-less alone — synth atlas doesn't pack so rotation is unnatural in that mode.

## Reproduction

1. Take any in-repo fixture's images.
2. Re-pack via Spine editor's "Texture Packer" with `Rotation: True` checked.
3. Drop the resulting `.atlas` + packed `.png` next to the `.json`.
4. Load → should hard-throw at [src/core/errors.ts:154](src/core/errors.ts#L154).

## Pointers

- Hard-throw: [src/core/errors.ts:154](src/core/errors.ts#L154)
- atlas-less rotated:false stub: [src/core/loader.ts:403](src/core/loader.ts#L403)
- spine-ts region rotation flag: `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js` — look for `rotate` parsing
- Bounds calc that'd need W↔H swap: [src/core/bounds.ts](src/core/bounds.ts)
