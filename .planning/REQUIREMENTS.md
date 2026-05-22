# Requirements: Spine Texture Manager v1.7 — Multi-Scale Per-Resolution Variant Exporter

**Defined:** 2026-05-22
**Core Value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

**Milestone goal:** From one full-size Spine export, produce faithful scaled-down rig variants — each a complete drop-in package (scaled skeleton JSON + scaled atlas + resized textures, in its own folder) sized to the peak render demand of that smaller rig.

**Source seed:** [SEED-010](seeds/SEED-010-multi-scale-per-resolution-variant-exporter.md) — explored 2026-05-21; core de-risked by spikes 001–003 (`.planning/spikes/`).

> **⚠ This milestone is heavily pre-researched.** The risky core (a faithful scaled-JSON bake) is PROVEN: spikes 001–003 (all VALIDATED) show a JSON→JSON transform mirroring `SkeletonJson.scale` is **field-identical** to Spine's own scaling on 4.2 + 4.3 (incl. DEMON's worst constraints), and the baked variant is geometrically `s×` for every attachment incl. constraint-driven R_ARM. The spike `baker.mjs` is a working prototype; the spike MANIFEST records the field rules, the regression oracle, and the remaining finite gaps. Use those artifacts, not re-derivation.

**Locked design facts (do not relitigate — from SEED-010):**
1. **Don't scale a bone** (root explodes; pivot leaves constraint residual) — produce variants via a **full Spine-style similarity bake** (= `SkeletonJson.scale` as a JSON→JSON transform).
2. **variant_peak = s × master_peak** (exact; the bake is a true similarity → no re-sampling). The sampler's `peakScale` is invariant under the bake (measurement blind spot) — NEVER size a variant by sampling it.
3. **Faithfulness bar:** a scaled variant behaves identically to the master (proven achievable).
4. **Decisive regression oracle:** `parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)`, run across a fixture matrix incl. a **deform-heavy** rig (DEMON 4.3 has no deform → false confidence).
5. Dual-runtime (4.2 + 4.3) and both loader modes (atlas-source + atlas-less) are hard requirements. `core/` stays pure-TS (Layer-3 invariant, `tests/arch.spec.ts`).
6. First feature to ever make the app **write** a skeleton JSON. Source JSON is never modified.

---

## v1.7 Requirements

Active scope for this milestone. Each maps to exactly one phase.

### Scale-Bake Core (BAKE)

- [x] **BAKE-01**: The app produces a scaled skeleton JSON whose parsed `SkeletonData` is field-identical to the original parsed at Spine's own `SkeletonJson.scale = s` (verified by the round-trip oracle as a CI test, excluding parse-assigned ids).
- [x] **BAKE-02**: The scale-bake produces faithful output for both Spine 4.2 and Spine 4.3 skeleton JSON (dual schema — split `transform/ik/path/physics[]` and unified `constraints[]`).
- [x] **BAKE-03**: The scale-bake correctly handles every constraint construct including the remaining constraint-timeline curve channels (IK `softness` curve; PATH `position`/`spacing` timelines in length mode) and the scaled-default injections (`physics.limit`, `referenceScale`).
- [x] **BAKE-04**: The regression oracle runs in CI across a fixture matrix that includes a deform-heavy rig and at least one all-constraint-types rig per runtime; the bake module stays Layer-3 pure (no DOM/Electron/sharp).

### Variant Export (EXPORT)

- [x] **EXPORT-01**: User can export a single scaled-down variant to a chosen folder as a drop-in package — scaled JSON + resized textures + (per output mode) scaled atlas — usable as-is at that size.
- [x] **EXPORT-02**: Variant texture sizes are derived as `s × master peak` (each variant sized to its own smaller render demand), reusing the existing export-sizing + atlas-write pipeline; the source project is never modified.
- [x] **EXPORT-03**: Variant export respects the existing output mode (`loose | atlas | both`) — the scaled JSON is the one always-present new artifact; textures/atlas follow the chosen mode.
- [ ] **EXPORT-04**: User can export multiple scales in one batch run, each variant written to its own folder.
- [x] **EXPORT-05**: Variant export works for both atlas-source and atlas-less projects, and for both 4.2 and 4.3 rigs.

### Scale Input & Preview (SCALEUI)

- [ ] **SCALEUI-01**: User can specify a variant scale either as a factor (e.g. `0.5`) or as a target dimension in pixels; entering one displays the corresponding other value.
- [ ] **SCALEUI-02**: The dimension reference shown to the user is the rig's overall setup-pose bounding box (width × height in px).

---

## Future Requirements (deferred)

- Per-attachment override behavior across scales (shared vs independent buckets) — needs a discuss-phase decision before scoping; deferred until the single-scale path lands.
- Variant export presets / saved scale-sets in `.stmproj`.
- A "what-if" peak preview (show variant demand without exporting).

## Out of Scope (explicit exclusions)

- **Scaling via a bone (root or pivot)** — falsified in SEED-010 (root explodes; pivot leaves constraint residual). The bake is the only faithful path.
- **Re-sampling the baked variant for sizing** — invalid (measurement blind spot); variant peak is `s × master` arithmetic.
- **Spine texture-packer-style "same rig, lower-res atlas"** — Spine's own packer already does that; this milestone is the genuinely-smaller-rig variant.
- Linux build/UAT (dropped at v1.3; `project_linux_deferred`).
- `.skel` binary loader (carried since v1.0).

---

## Traceability

Maps every v1.7 REQ-ID to exactly one phase. Coverage: 11/11 mapped, no orphans, no duplicates.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| BAKE-01 | Phase 48 | Complete |
| BAKE-02 | Phase 48 | Complete |
| BAKE-03 | Phase 48 | Complete |
| BAKE-04 | Phase 48 | Complete |
| EXPORT-01 | Phase 49 | Complete |
| EXPORT-02 | Phase 49 | Complete |
| EXPORT-03 | Phase 49 | Complete |
| EXPORT-05 | Phase 49 | Complete |
| SCALEUI-01 | Phase 50 | Pending |
| SCALEUI-02 | Phase 50 | Pending |
| EXPORT-04 | Phase 51 | Pending |
