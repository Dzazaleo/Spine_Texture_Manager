---
id: SEED-006
status: planted
planted: 2026-05-10
planted_during: v1.4 Phase 32 (Spine 4.3-beta detect-and-warn close-out)
trigger_when: "`npm view @esotericsoftware/spine-core@latest` returns 4.3.x (i.e. 4.3.0 stable shipped + npm publish landed) OR a paying user reports they cannot re-export their rig as Version 4.2"
scope: Large (full runtime port — sampler + bounds + new constraint type + vendoring decision)
proposed_phase: TBD (post-4.3.0-stable npm publish)
---

# SEED-006: Full Spine 4.3 runtime port

## Why This Matters

Phase 32 (v1.4) shipped the detect-and-warn path (Option A from SEED-003): a 4.3-beta JSON now produces a clear "Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again" message instead of the misleading `IK Constraint not found:` symptom. That unblocks the user-facing failure mode but does NOT add 4.3 support — the app still requires 4.2-shaped JSON. Once Spine 4.3.0 stable ships and `@esotericsoftware/spine-core@4.3.x` lands on npm (currently latest is 4.2.x — no 4.3 tag), the full port becomes worthwhile: the schema is frozen, the runtime API is stable, and porting effort isn't burned on mid-beta drift (the `uniform: bool` -> `scaleY: number` rename at 4.3.73-beta is the cautionary precedent).

This seed captures the costed inventory the v1.4 milestone investigation produced, so the future port phase has a queue-ready scoping document.

## Costed Inventory (verbatim from REQUIREMENTS.md -> Future Requirements)

- **PORT-01**: Migrate `core/sampler.ts` from spine-core 4.2 to 4.3 (`setToSetupPose` -> `setupPose`; `setSlotsToSetupPose` -> `setupPoseSlots`; `state.setAnimationWith` -> `state.setAnimation`; `slot.getAttachment()` -> `slot.pose.attachment`).
- **PORT-02**: Migrate `core/bounds.ts` `computeWorldVertices` call sites to the 4.3 signatures (`RegionAttachment`: adds `vertexOffsets`; `VertexAttachment`: adds `skeleton` first arg).
- **PORT-03**: Validate `slider` constraint timelines sample correctly via the existing `updateWorldTransform` propagation path with a dedicated fixture.
- **PORT-04**: Decide vendoring strategy (git submodule + tsc, npm fork, or wait-for-publish) and publish a build pipeline change.

## Schema + Runtime Deltas (full inventory from the v1.4 investigation)

### 5 sampler renames (PORT-01)

| 4.2 API | 4.3 API | Affected sites |
|---|---|---|
| `Skeleton.setToSetupPose()` | `Skeleton.setupPose()` | `core/sampler.ts` |
| `Skeleton.setSlotsToSetupPose()` | `Skeleton.setupPoseSlots()` | `core/sampler.ts` |
| `AnimationState.setAnimationWith(trackIndex, animation, loop)` | `AnimationState.setAnimation(trackIndex, animation, loop)` | `core/sampler.ts` |
| `slot.getAttachment()` | `slot.pose.attachment` (property access via Pose API) | `core/sampler.ts` (visibility-pass loops) |
| `state.update(dt)` / `state.apply(skeleton)` lifecycle | likely-unchanged shape but new `Pose`/`Posed`/`PosedActive`/`BonePose`/`IkConstraintPose` types thread through; verify against final 4.3.0 SkeletonJson.ts | `core/sampler.ts` |

### 2 bounds signature changes (PORT-02)

| 4.2 signature | 4.3 signature | Affected sites |
|---|---|---|
| `regionAttachment.computeWorldVertices(slot, worldVertices, offset, stride)` | `regionAttachment.computeWorldVertices(slot, worldVertices, offset, stride, vertexOffsets)` | `core/bounds.ts` |
| `vertexAttachment.computeWorldVertices(slot, start, count, worldVertices, offset, stride)` | `vertexAttachment.computeWorldVertices(skeleton, slot, start, count, worldVertices, offset, stride)` (adds `skeleton` first arg) | `core/bounds.ts` |

### slot.pose access pattern (PORT-01 detail)

4.2's `slot.getAttachment()` becomes a property read in 4.3: `slot.pose.attachment`. Visibility tests in `core/sampler.ts` (Pass 1 + the skin-manifest pass added in v1.3 per memory `project_sampler_visibility_invariant.md`) read `slot.getAttachment()` to determine whether an attachment is bound at sample-time. The 4.3 port must thread Pose access through every call site that reads attachment-binding state.

### Slider constraint timeline validation (PORT-03)

`slider` is a NEW constraint type in 4.3 with `SliderTimeline` and `SliderMixTimeline`. There is no 4.2 analog; the detect-and-warn path in v1.4 Phase 32 explicitly does NOT translate it (Out of Scope per REQUIREMENTS.md L51). The full-port phase needs a dedicated fixture exercising slider-driven bone movement and asserting that `updateWorldTransform` propagates the slider's effect into the world matrix the same way IK / Transform / Path / Physics do. If the propagation works for free (via the existing `Physics.update` pass), PORT-03 is a fixture-only task; if not, the sampler needs a slider-specific apply step.

### Vendoring strategy (PORT-04)

Three options, in cost order:

| Option | Effort | Pros | Cons |
|---|---|---|---|
| **a. Wait for `@esotericsoftware/spine-core@4.3.x` npm publish** | 0 LOC | One-line `package.json` bump | Time-bound on Esoteric's npm release cadence (4.3.0-stable -> npm tag could lag months) |
| **b. Git submodule on `spine-runtimes/spine-ts/spine-core` + tsc-via-build-script** | ~1 day setup | Pin to any commit, including post-stable-tag pre-npm | Build-time tsc dependency; submodule-update discipline |
| **c. Maintain a fork on npm** | ~2-3 days setup + ongoing maintenance | Easiest CI; works around upstream-publish gaps | Maintenance burden; fork drift |

Recommendation: default to (a) once the trigger fires; fall back to (b) only if the npm publish lags >3 months past the 4.3.0 stable tag.

## Trigger Condition

`npm view @esotericsoftware/spine-core@latest` returns 4.3.x (i.e. 4.3.0 stable shipped + npm publish landed) OR a paying user reports they cannot re-export their rig as Version 4.2.

## Cross-Links

- **SEED-003** (`.planning/seeds/SEED-003-spine-4.3-compatibility.md`) — the schema-delta groundwork. Documents WHY 4.2 + 4.3 JSON breaks (constraint section unification: `root.ik`/`root.transform`/`root.path`/`root.physics` -> `root.constraints[]`), provides the reproduction fixture inventory, costs Options A/B/C. Phase 32 closed Option A; this seed queues Option C.
- **Phase 32 CONTEXT.md** (`.planning/phases/32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure/32-CONTEXT.md`) — the implementation closure for Option A. Documents the predicate-pair pattern, the byte-locked COMPAT-01 message, the SPINE_4_3_TEST fixture shape.
- **REQUIREMENTS.md -> Future Requirements** (PORT-01..04 + the trigger clause) — the formal carry-forward of the costed inventory.

## Recommendation

1. **Do nothing today.** The 4.3 schema is frozen but `@esotericsoftware/spine-core@4.3.x` has not landed on npm. Porting against the 4.3-beta tarball would burn engineering hours that get rewritten when stable + npm publish converge.
2. **Trigger the port phase** (a) the moment `npm view @esotericsoftware/spine-core@latest` reports 4.3.x, OR (b) the moment a paying user reports they cannot re-export as 4.2 (e.g. their pipeline has 4.3-only assets — `slider` constraints, mid-beta `scaleY` IK rigs — that the editor's "Version: 4.2" downgrade can't preserve).
3. **Plan as 4-task phase**: Task 1 PORT-04 (vendoring landed first), Task 2 PORT-01 (sampler renames), Task 3 PORT-02 (bounds signature changes), Task 4 PORT-03 (slider fixture + validation). Each task lands its own commit; CI matrix expands to test 4.3.x alongside 4.2.x for one milestone before deprecating 4.2.

## Sources (verified during the v1.4 milestone investigation; re-cited verbatim from SEED-003)

- [Spine Changelog](https://esotericsoftware.com/spine-changelog) — 4.3-beta release timeline and per-build notes
- [Blog: 4.3 beta announcement (April 4, 2025)](https://en.esotericsoftware.com/blog/The-4.3-beta-is-now-available)
- [spine-runtimes 4.3-beta CHANGELOG.md](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3-beta/CHANGELOG.md) — confirms unified `ConstraintData` list, `Slider`/`SliderData`/`SliderTimeline`/`SliderMixTimeline`, IK `scaleY` replaces `uniform`
- [4.3-beta SkeletonJson.ts (raw)](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3-beta/spine-ts/spine-core/src/SkeletonJson.ts) — verified unified `root.constraints` array with `type` discriminator
- [4.2 SkeletonJson.ts (raw)](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-core/src/SkeletonJson.ts) — verified four separate `root.ik`/`root.transform`/`root.path`/`root.physics` arrays
- [Spine-Unity 4.2 -> 4.3 Upgrade Guide (forum)](https://esotericsoftware.com/forum/d/29234-spine-unity-42-to-43-upgrade-guide)
- [spine-editor#891 — IK timeline scrambling on 4.3->4.2 downgrade](https://github.com/EsotericSoftware/spine-editor/issues/891)
- [Spine JSON format docs](https://en.esotericsoftware.com/spine-json-format)
