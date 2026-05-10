# Requirements: Spine Texture Manager — Milestone v1.4

**Defined:** 2026-05-10
**Milestone:** v1.4 Spine 4.3 Forward-Compat + Rotated Atlases
**Core Value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

**Scope statement:** Honor Esoteric's "upgrade to 4.3" recommendation pragmatically — make 4.2-only support honest and visible in the UI, replace today's cryptic 4.3-beta load failures with an actionable re-export message, AND remove the rotated-atlas hard-throw with full rotation support. Defers the full 4.3 runtime port until npm publishes 4.3.0 stable (queued via SEED-006).

## v1.4 Requirements

### Spine 4.3 Compatibility (detect-and-warn)

- [ ] **COMPAT-01**: When a Spine 4.3-beta-exported `.json` is dropped, the loader detects it (sniff `root.constraints` array OR `skeleton.spine` semver `≥ 4.3`) and throws a structured `SpineVersionUnsupportedError` with the message: *"This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again."* Replaces today's misleading `IK Constraint not found: <name>` (the symptom 4.2 spine-core surfaces when reading a 4.3 JSON whose constraint definitions live under unified `root.constraints` instead of the legacy four-array layout).
- [ ] **COMPAT-02**: The initial drop-zone advisory at `src/renderer/src/App.tsx:622` calls out the supported Spine version explicitly. The `v4.2` token is rendered with strong/bold emphasis using the project's existing `text-danger` token so users on a 4.3 editor see the constraint *before* they drop a file. Visually pairs with COMPAT-01's error message.

### Rotated Atlas Region Support

- [x] **ATLAS-01**: Loader accepts atlas regions packed with `rotate: true`. The hard-throw `RotatedRegionUnsupportedError` at `src/core/errors.ts:154` is removed. Rotated regions propagate through `analyzer.ts` like any other region. Atlas-less mode is unaffected (synthetic atlas never packs with rotation).
- [x] **ATLAS-02**: `attachmentWorldAABB` in `src/core/bounds.ts` swaps source W↔H for rotated regions before computing the world-space AABB, so the computed bounds match what the runtime would render at identity scale.
- [x] **ATLAS-03**: ExportPlan output dimensions for rotated regions reflect the visually-correct (unrotated) W×H — animators get exported per-region PNGs whose dims match the unrotated source dimensions, not the packed-rotated dims.
- [ ] **ATLAS-04**: A rotated-atlas regression fixture (re-pack of an existing in-repo fixture using Spine packer's `rotation: true` toggle) is committed under `fixtures/` and exercised by core unit tests covering ATLAS-01..03.

### Future Planning (no user-facing requirement)

- Plant `SEED-006: Full Spine 4.3 runtime port` carrying the costed inventory from this milestone's investigation (5 sampler renames + 2 bounds signature changes + slot.pose access + slider validate + vendoring strategy). This is a phase deliverable, not a REQ. **Mapped to Phase 32 (close-of-phase plant).**

## Future Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Full Spine 4.3 Runtime Port (SEED-006)

- **PORT-01**: Migrate `core/sampler.ts` from spine-core 4.2 to 4.3 (`setToSetupPose` → `setupPose`; `setSlotsToSetupPose` → `setupPoseSlots`; `state.setAnimationWith` → `state.setAnimation`; `slot.getAttachment()` → `slot.pose.attachment`).
- **PORT-02**: Migrate `core/bounds.ts` `computeWorldVertices` call sites to the 4.3 signatures (`RegionAttachment`: adds `vertexOffsets`; `VertexAttachment`: adds `skeleton` first arg).
- **PORT-03**: Validate `slider` constraint timelines sample correctly via the existing `updateWorldTransform` propagation path with a dedicated fixture.
- **PORT-04**: Decide vendoring strategy (git submodule + tsc, npm fork, or wait-for-publish) and publish a build pipeline change.

**Trigger condition:** `npm view @esotericsoftware/spine-core@latest` returns 4.3.x (i.e. 4.3.0 stable shipped + npm publish landed) OR a paying user reports they cannot re-export their rig as Version 4.2.

### Other Carry-Forwards

- **SKEL-01**: `.skel` binary loader (deferred since v1.0).
- **NOTARIZE-01**: Apple Developer ID code-signing + notarization ($99/yr; carry-forward from v1.0 deferred list).

## Out of Scope (explicit exclusions)

| Feature | Reason |
|---------|--------|
| Vendor `spine-ts/spine-core` 4.3-beta source today | Mid-beta schema drift (`uniform: bool` → `scaleY: number` rename at `4.3.73-beta` is recent precedent). Tracking a moving target burns engineering hours that get rewritten when 4.3.0 stable lands. |
| Schema-shim translating 4.3 `root.constraints[]` → 4.2 four-array layout | SEED-003 Option B; labelled HIGH trap risk — doesn't model the new `slider` constraint type, brittle against beta drift. Re-export-as-4.2 is a supported editor downgrade and a cleaner UX. |
| `slider` constraint type modeling | New in 4.3; no 4.2 analog. Sampler-level support deferred to PORT-* requirements after the full 4.3 port lands. |
| Rotated-region support in atlas-less mode | Synthetic atlas in `synthetic-atlas.ts` never packs (each PNG is its own region). Rotation is a packer-only concern; not a meaningful surface for atlas-less workflows. |
| Loading 4.3-beta JSONs without re-export | Deliberate; re-export-as-Version-4.2 is the supported editor workflow. Detect-and-warn (COMPAT-01) routes users there. |

## Traceability

Populated by gsd-roadmapper 2026-05-10.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMPAT-01 | Phase 32 | Pending |
| COMPAT-02 | Phase 32 | Pending |
| ATLAS-01 | Phase 33 | Complete |
| ATLAS-02 | Phase 33 | Complete |
| ATLAS-03 | Phase 33 | Complete |
| ATLAS-04 | Phase 33 | Pending |

**Coverage:**
- v1.4 requirements: 6 total
- Mapped to phases: 6 ✓
- Unmapped: 0
- Phases: 2 (Phase 32 carries 2 REQs; Phase 33 carries 4 REQs)
- SEED-006 plant: Phase 32 close-of-phase deliverable (not a REQ).

---
*Requirements defined: 2026-05-10*
*Last updated: 2026-05-10 — gsd-roadmapper traceability fill: COMPAT-01/02 → Phase 32; ATLAS-01..04 → Phase 33.*
