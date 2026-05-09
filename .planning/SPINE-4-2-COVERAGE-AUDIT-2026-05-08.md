---
type: handoff
created: 2026-05-08
created_during: post-spine-sequence-undercount audit
purpose: Spine 4.2 feature coverage audit (closed 2026-05-08 via source-read pass)
goal: Items 2, 3, 4 closed PASS. Items 1 and 5 deferred to SEED-004 + SEED-005.
status: closed
closed_date: 2026-05-08
---

# Spine 4.2 Coverage Audit — Handoff

## Why this exists

Today (2026-05-08) we discovered and fixed a major silent gap in Spine 4.2 coverage: **sequence attachments** (debug session: [.planning/debug/spine-sequence-undercount.md](.planning/debug/spine-sequence-undercount.md), commits `a8cf3c6`, `1dd4ab8`, `cd0aabd`, `ae4de84`). The bug was discovered because the user added a new fixture (TEST_03) that exercised features the existing fixtures didn't.

This audit asks: **what other Spine 4.2 features might be silently broken because no fixture exercises them?**

## What was audited (recon, 2026-05-08)

A grep + spine-ts source review across:
- `src/core/`, `src/main/` for self-flagged TODOs / "not supported" / Pitfall comments
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` for parser surface
- `fixtures/*/[A-Z]*.json` for per-fixture feature inventory (grep for `"sequence"|"physics"|"ik"|"transform"|"deform"|"blend"|"audio"|"path"|"clipping"|"events"`)

Result: 8 features flagged. 5 well-covered, 3 with real risk, 2 deferred.

## Items to investigate THIS session

### Item 2 — SequenceTimeline + DeformTimeline interaction 🔴

**Hypothesis:** Today's sequence fix (Option C) measures the bone-driven world scale ONCE per tick and fans out to N PeakRecord rows, on the assumption that all N sequence frames share identical mesh vertices. If Spine 4.2 permits a DeformTimeline that mutates a sequence-mesh's vertices per-frame (e.g. animated mouth shapes synced with sequence frames), our peak measurement is wrong — we'd capture only one frame's deform but broadcast its scale to all 30.

**What to check:**
1. Read `node_modules/@esotericsoftware/spine-core/dist/Animation.js` — find the DeformTimeline class. Does its `apply()` access `attachment.sequence.regions[currentIndex]`, or just `attachment.vertices`?
2. Read `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:940-976`. Can a single attachment slot bind BOTH a DeformTimeline AND a SequenceTimeline? Does spine-ts give them precedence?
3. Construct a synthetic JSON fixture with a sequence-mesh + per-frame deform values (or find a real-world fixture).
4. Falsify or confirm: does `slot.attachment.vertices` change between sequence frames during animation playback?

**If the assumption breaks:** our `fanOutSequencePeaks` post-pass at [src/core/sampler.ts:407-557](src/core/sampler.ts#L407-L557) needs a per-frame inner loop, or sequence frames need to be sampled distinctly. Memory entry to update if this triggers: any sequence-related project memory we save.

**Where today's fix lives:**
- [src/core/sampler.ts:407-557](src/core/sampler.ts#L407-L557) — `fanOutSequencePeaks`
- [src/core/synthetic-atlas.ts:243-263](src/core/synthetic-atlas.ts#L243-L263) — `composeSequenceFramePath`
- [src/core/synthetic-atlas.ts:265-315](src/core/synthetic-atlas.ts#L265-L315) — sequence-aware `walkSyntheticRegionPaths`

### Item 3 — Skin-specific bones (4.0+ feature) 🔴

**Hypothesis:** Spine 4.0+ permits skins to declare their own bones (`skin.bones[]`), used for accessories where different skins have different bone counts (e.g. a hat skin adds the hat-bone). Our sampler iterates `skeleton.skin / skin.attachments` but there's no fixture that exercises skin-bound bones, so we don't know if those bones are correctly added/removed when skins change.

**What to check:**
1. Read `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` — find skin parsing. Does it parse `skin.bones` and `skin.constraints`?
2. Read [src/core/sampler.ts:168-219](src/core/sampler.ts#L168-L219) — does our per-skin pass call `skeleton.setSkin()` and re-resolve bones? Or does it only iterate `skin.attachments` while keeping bones static?
3. Check Spine docs: https://esotericsoftware.com/spine-skins (skin-specific bones section).
4. Construct or find a fixture where a skin adds a bone. The `temp/` dir (gitignored, user's Spine source files) might have one. Or build a minimal one.

**Risk:** if a skin's added bone influences a mesh's world transform, and we don't tick that bone, our peak scale for attachments under that skin is wrong (likely undersized).

### Item 4 — PhysicsConstraint timelines (4.2 only) ⚠️

**Hypothesis:** TEST_03, SIMPLE_PROJECT, EXPORT_PROJECT all have `"physics"` blocks (root-level constraint definitions), but no test in the suite asserts the **7 PhysicsConstraint timeline subtypes** (`Reset`, `Inertia`, `Strength`, `Damping`, `Mass`, `Wind`, `Gravity`, `Mix`) advance correctly during sampling. The sampler ticks `Physics.update` per the lifecycle (verified at [src/core/sampler.ts:309-311](src/core/sampler.ts#L309-L311)), but timeline-driven mutations to physics state (e.g. wind ramping up mid-animation, gravity flipping) are unproven.

**What to check:**
1. Read `node_modules/@esotericsoftware/spine-core/dist/Animation.js` — find `PhysicsConstraintWindTimeline`, `PhysicsConstraintGravityTimeline`, etc. Confirm they mutate the `PhysicsConstraint.wind/gravity` fields per-tick.
2. Read `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:976+` for parser handling.
3. Inspect TEST_03.json or SIMPLE_PROJECT for any physics timeline blocks (grep `"physics"` inside `"animations":`). If yes, we can write a sampler test that asserts the physics constraint's runtime field changes between two ticks at different time offsets.
4. If no fixture has a physics-timeline animation, build a minimal one or note this as a deferred test.

**Risk:** if wind ramps up over a 2-second animation and at peak wind a hair-physics chain swings out 150% wider than at rest, we'd undersize that hair texture. Concrete user impact, but probably rare in practice.

## Items DEFERRED to seeds

- **Item 1 — Rotated atlas regions hard-fail** → [.planning/seeds/SEED-004-rotated-atlas-regions.md](.planning/seeds/SEED-004-rotated-atlas-regions.md)
- **Item 5 — RGBA2 + InheritTimeline coverage** → [.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md](.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md)

## Today's audit — full triage table (reference)

### Attachment-side features

| Feature | Status | Evidence |
|---|---|---|
| Region attachments | ✅ Covered | SIMPLE_PROJECT |
| Mesh (weighted) attachments | ✅ Covered | Jokerman, CHJ, MeshOnly |
| LinkedMesh attachments | ✅ Covered | Jokerman |
| BoundingBox / Path / Point / Clipping | ✅ Filtered | bounds.ts:76, sampler.ts:610 |
| Sequence attachments | ✅ Covered (today) | TEST_03 + commits `a8cf3c6`, `cd0aabd`, `ae4de84` |
| Rotated atlas regions | 🟡 Deferred → SEED-004 | errors.ts:154 hard-throws |

### Constraint-side features

| Feature | Status | Evidence |
|---|---|---|
| IK constraint | ✅ Covered | Jokerman |
| TransformConstraint | ✅ Covered | SIMPLE_PROJECT (CLAUDE.md attests) |
| PathConstraint | ✅ Covered | universal |
| PhysicsConstraint root block | ⚠️ Partial → Item 4 | Fixtures have `"physics"`, no timeline test |
| Skin-specific bones (4.0+) | 🔴 Unknown → Item 3 | No fixture |

### Animation timeline features

| Feature | Status | Evidence |
|---|---|---|
| Rotate/Scale/Translate/Shear | ✅ Covered | universal |
| RGBATimeline (slot color) | ✅ Covered (render-scale-irrelevant) | universal |
| RGBA2Timeline (two-color tinting) | 🟡 Deferred → SEED-005 | render-scale-irrelevant |
| AttachmentTimeline | ✅ Covered | sampler reads `slot.getAttachment()` per-tick |
| DeformTimeline | ✅ Covered | CHJ, computeWorldVertices handles |
| DrawOrderTimeline | ✅ Irrelevant for bounds | n/a |
| EventTimeline + audio | ✅ Ignored (correct) | events ≠ render |
| **SequenceTimeline + DeformTimeline interaction** | 🔴 Latent → Item 2 | unproven assumption from today's fix |
| InheritTimeline (4.0+) | 🟡 Deferred → SEED-005 | spine-ts has it; no fixture |

### Loader/format features

| Feature | Status | Evidence |
|---|---|---|
| 4.0–4.2 JSON | ✅ Covered | loader.ts version guard |
| 4.3+ JSON | 🟡 Deferred → SEED-003 | already a seed |
| Binary `.skel` files | 🟡 Out of scope | ROADMAP v1.2 |
| Atlas-less mode | ✅ Covered | SIMPLE_PROJECT_NO_ATLAS, TEST_03 |

## How to resume in a fresh session

```
/gsd-explore .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md
```

OR for direct investigation of a specific item:

```
/gsd-debug investigate Item 2 from .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md
```

OR start with a quick spike for Item 2 specifically (lowest cost, highest information):

```
/gsd-spike "verify SequenceTimeline + DeformTimeline interaction in Spine 4.2; see .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 2"
```

## Pointers (cheat sheet)

| Need | Location |
|---|---|
| Today's sequence fix design | [.planning/debug/spine-sequence-undercount.md](.planning/debug/spine-sequence-undercount.md) |
| Sequence fan-out logic | [src/core/sampler.ts:407-557](src/core/sampler.ts#L407-L557) |
| Synthetic atlas sequence expansion | [src/core/synthetic-atlas.ts:265-315](src/core/synthetic-atlas.ts#L265-L315) |
| Sequence regression tests | [tests/core/sequence-attachment-fanout.spec.ts](tests/core/sequence-attachment-fanout.spec.ts) |
| Sequence-aware orphan + counter tests | [tests/core/summary.spec.ts](tests/core/summary.spec.ts) — bottom-most describe block |
| Spine 4.2 parser surface | `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` |
| Spine 4.2 timeline classes | `node_modules/@esotericsoftware/spine-core/dist/Animation.js` |
| Sampler lifecycle (Physics ordering) | [src/core/sampler.ts:1-50](src/core/sampler.ts#L1-L50) |
| Sequence test fixture | `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` (gitignored) |

## Locked context (do not relitigate)

- `core/` is pure TypeScript, no DOM, no sharp/electron imports. Layer 3 invariant.
- Sampler lifecycle is `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` — that order. Do not reorder.
- Sequence fix is locked to **Option C (Hybrid)**: register N regions, measure once, fan out at tick end. If Item 2 falsifies the "measure once" assumption, the fix needs amendment but the data model (1 attachment + N regions) stays.
- Two strict-separated loader modes (atlas-source, atlas-less). Don't blur them.
- `summary.regions.length` (Phase 29 D-01) is the canonical user-facing region count. `summary.attachments.count` is structural. Both are now load-bearing for different surfaces — see commit `ae4de84` rationale.

---

## Findings (2026-05-08, source-read pass)

Closure bar agreed for this pass: source-level inspection of spine-ts + our sampler. No new fixtures, no new tests. Falsifications would have stopped the pass and seeded a follow-up.

**Result: all three items PASS. Audit is closed.**

### Item 2 — SequenceTimeline + DeformTimeline interaction → PASS (oversize-bias only)

- DeformTimeline DOES mutate `slot.deform` per-tick (Animation.js:1286-1399). `MeshAttachment.computeWorldVertices` reads `slot.deform` (attachments/MeshAttachment.js:173-176 → VertexAttachment.js superclass at attachments/Attachment.js:73-130). So vertex positions CAN change across ticks on a sequence-mesh.
- However, the sampler's hot loop already records the **global peak across all ticks** (sampler.ts:317-338, snapshotFrame fold). When `fanOutSequencePeaks` (sampler.ts:407-557) broadcasts that peak record to all N region keys, every frame's record carries the worst-case (largest) deform-driven scale.
- Consequence: a sequence frame whose actual display window has small deform is *oversized* (sized for the largest deform any frame ever reached), never undersized. Safe direction.
- The Option C lock on "measure once, fan out" stays correct for the safety contract. It's suboptimal only for the rare combination of sequence-mesh + per-frame DeformTimeline on the same attachment, and only ever in the oversize direction.
- **Verdict:** SAFE. Audit doc's hypothesis was technically true about per-tick vertex mutation but mis-stated the consequence — the fan-out captures the maximum, not "one frame's deform." Consider a future seed if a real asset reports unexpectedly oversized sequence textures.

### Item 3 — Skin-specific bones (4.0+) → PASS

- All bones live on `skeleton.bones` regardless of skin. Skin-required bones are tagged via `bone.data.skinRequired`.
- `Skeleton.updateCache` (Skeleton.js:139-198) flips `bone.active=false` for skin-required bones at start (lines 142-147), then walks `this.skin.bones` and re-activates the active skin's bones plus all parents (lines 148-158). The `_updateCache` array drives `updateWorldTransform` (Skeleton.js:330-346).
- `Skeleton.setSkin` calls `updateCache()` (Skeleton.js:483) on every skin change.
- Our sampler calls `skeleton.setSkin(skin)` per skin in the per-skin pass (sampler.ts:165), so the active-bone set is rebuilt correctly for each skin we sample.
- **Verdict:** SAFE. Audit doc's hypothesis was misframed — the surfacing mechanism for skin-bones is `bone.active` + `_updateCache`, not `skin.attachments`. The sampler doesn't need to iterate `skin.bones` directly.

### Item 4 — PhysicsConstraint timelines → PASS

- All seven physics timeline subtypes (Inertia/Strength/Damping/Mass/Wind/Gravity/Mix at Animation.js:1894-2017, plus Reset at 2020+) inherit from `PhysicsConstraintTimeline` whose `apply()` (Animation.js:1877-1891) writes the per-frame value directly to the constraint's runtime field (`constraint.wind`, `constraint.gravity`, etc.) via the subclass `set()` method.
- Mutation happens during `state.apply(skeleton)` — step 2 of our locked tick lifecycle.
- The physics solver reads those same runtime fields when `skeleton.updateWorldTransform(Physics.update)` runs — step 4 of the lifecycle. By the time bones are repositioned, the per-frame physics parameters are already in place.
- The locked tick order (state.apply before updateWorldTransform) inherently covers timeline-driven physics mutation. No fixture or test gap to close — the lifecycle itself is the proof.
- **Verdict:** SAFE. Worth noting if anyone proposes reordering the lifecycle in future, this is one more reason not to.

### Items deferred (unchanged)

- Item 1 — Rotated atlas regions → SEED-004 (untouched).
- Item 5 — RGBA2 + InheritTimeline → SEED-005 (untouched).

### How to reopen

If a real asset surfaces evidence that contradicts any of the three PASS verdicts, reopen via `/gsd-debug investigate <item> from .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md`. The hypotheses, code pointers, and triage table above remain valid as starting context.
