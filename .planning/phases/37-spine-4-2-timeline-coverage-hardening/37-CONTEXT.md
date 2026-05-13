# Phase 37: Spine 4.2 Timeline Coverage Hardening - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Source-audit RGBA2Timeline + InheritTimeline in spine-core 4.2 (`@esotericsoftware/spine-core@4.2.111`), then lock the resulting render-scale contracts with fixtures + sampler tests. Append findings to the existing `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` (items 6 + 7), ship one on-disk fixture for InheritTimeline + one synthetic in-test construction for RGBA2, flip `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` `status:` from `planted` to `closed`.

Touched surfaces (canonical): `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` (append items 6/7 + closure update), `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` (status flip), new `fixtures/INHERIT_TIMELINE/` directory (json + atlas + placeholder png), and `tests/core/sampler.spec.ts` (two new test blocks). No `src/core/` source changes are expected — the phase verifies that existing sampler lifecycle already covers these timelines correctly. If the InheritTimeline test fails (peak ≤ baseline), it surfaces a real sampler gap and the phase scope expands to include the fix — but pre-discussion source-read evidence says the lifecycle already covers it via `state.apply` → `bone.inherit` mutation → `updateWorldTransform` read.

</domain>

<decisions>
## Implementation Decisions

### TIMELINE-02 Conditional Escalation (pre-resolved in CONTEXT)
- **D-01:** **TIMELINE-03 is load-bearing (real-risk gap fix), NOT precautionary.** Pre-discussion source-read of `node_modules/@esotericsoftware/spine-core/dist/Animation.js:740-756` (`InheritTimeline.apply`) confirms it directly mutates `bone.inherit` via `bone.inherit = this.frames[Timeline.search(...) + 1]` at line 755. Cross-referenced against `node_modules/@esotericsoftware/spine-core/dist/Bone.js:144` (`switch (this.inherit)` drives the world-transform branch in `updateLocalToWorld`) — the flag IS read by the world-transform computation. The ROADMAP conditional escalation clause (`if InheritTimeline mutates a Bone field that affects updateWorldTransform, the test MUST assert peak > baseline`) is therefore TRIGGERED. The phase plan locks `peak > baseline` as the TIMELINE-03 test direction from day 1.
- **D-02:** Plan 37-01 still performs the formal source audit and writes findings to `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` — the audit-doc trail is preserved (derives from in-execution source-read with explicit line citations, not from CONTEXT discussion notes). CONTEXT's role is to pre-commit the test assertion direction so the planner doesn't depend on 37-01's findings to scope 37-02.

### Fixture Authoring — InheritTimeline
- **D-03:** **Atlas-source artifacts**: `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` + `INHERIT_TEST.atlas` + `INHERIT_TEST.png` (placeholder, 1×1 or reused from SIMPLE_TEST is fine — sampler does not decode PNGs per CLAUDE.md fact #4). Mirrors `fixtures/SIMPLE_PROJECT/` pattern. Loader/sampler path used here is the same well-traveled atlas-source path the rest of the suite exercises. No atlas-less parallel variant needed — InheritTimeline behavior is mode-invariant by construction (the loader differs; the sampler's `state.apply → updateWorldTransform` lifecycle does not).
- **D-04:** Test landing site is `tests/core/sampler.spec.ts` per REQ TIMELINE-03. Co-locates with the existing N1.1–N1.6 sampler invariants, reuses the existing test harness (`loadSkeleton` + `sampleSkeleton` imports already in place at sampler.spec.ts:33-38).

### Fixture Authoring — RGBA2
- **D-05:** **Synthetic in-test construction**, NOT a JSON fixture. Pattern: load an existing skeleton (`SIMPLE_TEST.json` or the new `INHERIT_TIMELINE` fixture — planner picks; SIMPLE_TEST is the de-facto smoke fixture), parse via `loadSkeleton`, clone the resulting `skeletonData`, programmatically inject an `RGBA2Timeline` instance onto one slot's animation timelines array (constructor signature is `(frameCount, bezierCount, slotIndex)` per `Animation.js:953`), then run `sampleSkeleton` on baseline + injected variants. Compare outputs for byte-equality. Cleanest "with vs without" diff because both runs share the exact same animation modulo the injected color timeline.
- **D-06:** No new `fixtures/RGBA2_TINT/` directory. The synthetic approach is fully test-resident.

### Claude's Discretion (resolved without user-facing question)
- **DC-01 — Geometry-invariance assertion granularity for RGBA2 (TIMELINE-04):** Strict deep-equal on `summary.globalPeaks` Map (key + full PeakRecord) between baseline and RGBA2-injected runs. No epsilon tolerance: same skeleton, same animation, same sampler lifecycle modulo a slot-color-only timeline that MUST not influence bone transforms — any drift indicates a real bug. Also assert strict equality on `peakScale` / `peakScaleX` / `peakScaleY` numeric fields per-record (belt-and-suspenders against Map-iteration-order edge cases).
- **DC-02 — InheritTimeline test rig mechanics (TIMELINE-03):** Parent bone is animated with a SCALE-DOWN phase (e.g. parent `scaleX` / `scaleY` ramping from 1.0 → 0.4 → 1.0 over the animation duration) plus rotation. Child bone (single region attachment) has `inheritScale: true` at setup (`Inherit.Normal`); InheritTimeline keys it to `Inherit.NoScale` at the mid-frame during the parent's shrunk pose, then back to `Inherit.Normal`. Baseline run: drop the InheritTimeline → child always inherits → child's peak world scale ≈ parent's max scale × child's local. Test run: with InheritTimeline detaching at the shrink-peak → child stays at its own setup scale (1.0) when parent is at 0.4 → child's detached-frame world scale > inheriting-baseline world scale at that frame. Assertion: `peak(detached) > peak(baseline)` strict. Region attachment (not mesh) — the inheritance signal is bone-driven, mesh adds noise. Attachment shape = SIMPLE_TEST.atlas region reused or a 1×1 placeholder (PNG bytes irrelevant).

### Folded Todos
None — the `cross_reference_todos` step matched 3 pending todos (Phase 4 code review follow-up; Phase 20 Windows DnD UAT; Phase 31 Windows admin DnD UAT) but ALL belong to Phase 38 + Phase 39 per ROADMAP and are out of scope here. See "Reviewed Todos (not folded)" below.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Design (do NOT relitigate)
- `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` — Level B scope (audit + fixture coverage) chosen 2026-05-08. Flip `status:` from `planted` to `closed` at phase close per REQ TIMELINE-05.
- `.planning/REQUIREMENTS.md` §"Spine 4.2 Timeline Coverage Hardening (SEED-005 Level B)" — TIMELINE-01..TIMELINE-05 acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 37: Spine 4.2 Timeline Coverage Hardening" — Goal + success criteria 1-5 + conditional escalation clause + 3-plan estimate.

### Audit Doc (the centerpiece artifact)
- `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` — Existing audit doc (status: closed 2026-05-08 for items 2/3/4). Phase 37 reopens for append-only edits: add items 6 (RGBA2Timeline) + 7 (InheritTimeline) as PASS-with-evidence findings following the items 2/3/4 format ("Verdict" + line-cited evidence + "Reopen" pointer). Items 5/6/7 closure update at phase close per REQ TIMELINE-05.

### Spine 4.2 Source (read-only; cite line numbers in audit findings)
- `node_modules/@esotericsoftware/spine-core/dist/Animation.js:723-757` — `InheritTimeline` class + `apply()`. Line 755 is the load-bearing mutation: `bone.inherit = this.frames[Timeline.search(frames, time, 2) + 1]`.
- `node_modules/@esotericsoftware/spine-core/dist/Animation.js:951-1030+` — `RGBA2Timeline` class + `apply()`. Mutates `slot.color` (light) + `slot.darkColor` only; no `bone.*` writes; no geometry.
- `node_modules/@esotericsoftware/spine-core/dist/Bone.js:144` — `switch (this.inherit)` in `updateLocalToWorld`. This is the readback that proves `bone.inherit` writes affect world transforms. Cross-cited at line 271 + 278 + 288 + 299 for the various inherit-mode branches.

### Sampler Lifecycle (the contract under test)
- `src/core/sampler.ts:1-50` — Lifecycle header comment. The locked order `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` is the load-bearing guarantee: InheritTimeline's `bone.inherit` mutation happens during `state.apply` (step 2), and the next `updateWorldTransform` (step 4) reads the new flag value. CLAUDE.md fact #3 attests.
- `src/core/sampler.ts:165` — per-skin `skeleton.setSkin(skin)` call (referenced in audit doc Item 3 closure). Not modified by Phase 37 but bracketed by the same sampler hot loop the new tests will run through.
- `tests/core/sampler.spec.ts:30-43` — Existing import surface (`loadSkeleton`, `sampleSkeleton`, `DEFAULT_SAMPLING_HZ`, `PeakRecord`). The two new test blocks land in this file per REQ TIMELINE-03 + TIMELINE-04.

### Locked Project Invariants (memory — informational, do not relitigate)
- CLAUDE.md fact #1 — Spine FPS is dopesheet metadata only; sampling rate is our choice (120 Hz default).
- CLAUDE.md fact #2 — `computeWorldVertices` after `updateWorldTransform(Physics.update)` handles IK / TransformConstraint / PathConstraint / PhysicsConstraint / DeformTimeline. We don't reimplement.
- CLAUDE.md fact #3 — Sampler lifecycle order is fixed (state.update → state.apply → skeleton.update → updateWorldTransform). InheritTimeline test is one more proof this order is correct.
- CLAUDE.md fact #4 — Math phase does not decode PNGs; stub TextureLoader from `.atlas` metadata is sufficient. Placeholder PNG bytes in the new fixture are irrelevant to the test outcome.
- CLAUDE.md fact #5 — `core/` is pure TS, no DOM (Layer 3 invariant). The new tests live in `tests/core/`, importing only from `src/core/`.
- CLAUDE.md fact #6 — Default 120 Hz sampling; REQ TIMELINE-03 explicitly runs at default 120 Hz.
- `project_sampler_visibility_invariant` (memory) — sampler measures all skin-declared attachments; alpha gate is a red herring. RGBA2 only changes color (not alpha-gated visibility), so it's geometry-invariant — aligns with the TIMELINE-04 invariance assertion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`loadSkeleton` + `sampleSkeleton`** at `src/core/loader.ts` + `src/core/sampler.ts` — the test harness for both new test blocks. Already imported in `tests/core/sampler.spec.ts:33-38`. No new imports needed at the test-file top.
- **SIMPLE_TEST fixture** at `fixtures/SIMPLE_PROJECT/` — the de-facto smoke fixture (CIRCLE / SQUARE / TRIANGLE / CHAIN_2..8 / TransformConstraint). RGBA2 synthetic injection can target one of these slots; cloning the parsed `skeletonData` and adding an `RGBA2Timeline` to an existing animation is the lightest path. (Planner: verify cloning approach — `JSON.parse(JSON.stringify(...))` won't suffice for spine-core's class instances; may need to call `loadSkeleton` twice and inject into the second instance's timelines array.)
- **Fixture directory pattern** — `fixtures/<NAME>/<NAME>.json` + `<NAME>.atlas` + `<NAME>.png` (e.g. `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`). New `fixtures/INHERIT_TIMELINE/INHERIT_TEST.{json,atlas,png}` follows the same shape.
- **Existing test naming convention** — `N1.1`, `N1.2`, ... `N2.3` in `tests/core/sampler.spec.ts` ties test names to requirement tags. New tests can use `TIMELINE-03` and `TIMELINE-04` as N-tag equivalents for traceability.

### Established Patterns
- **Audit-doc append style** — `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` items 2/3/4 closure findings (lines 170-192) use the format: `### Item N — <title> → <VERDICT>` then bulleted line-cited evidence then a one-line `**Verdict:**`. Items 6/7 follow the same shape. Items 5/6/7 closure update at the bottom of the doc per the "How to reopen" structure.
- **Test FIXTURE constant pattern** — `const FIXTURE = path.resolve('fixtures/<NAME>/<NAME>.json');` at the top of `tests/core/sampler.spec.ts:40`. New `INHERIT_FIXTURE` constant follows the same shape.
- **Seed status-flip pattern** — frontmatter `status:` change at phase close (e.g. SEED-007 flipped `dormant → closed` at Phase 36 close; SEED-005 flips `planted → closed` at Phase 37 close). Closing-phase reference is added inline in the seed body, not just frontmatter.

### Integration Points
- **Audit doc reopen** — Phase 37 writes to the existing closed audit doc. The doc's `status: closed` frontmatter is preserved (the doc itself is one append-only artifact across milestones); only the body is amended with items 6/7 + the items 5/6/7 closure block at the bottom. No new audit doc is created.
- **Sampler test harness** — both new tests piggyback on the existing `sampler.spec.ts` describe block (`describe('sampler — sampleSkeleton (...)', () => { ... })`). Whether they go inside or alongside the existing describe is a planner micro-decision.
- **No production-code touch** — confidence level for "no `src/core/` changes" is high (per the source-read evidence above). If the InheritTimeline test fails (peak ≤ baseline at the detached frame), that's a real sampler bug and Phase 37 scope expands to include the fix — but per CLAUDE.md fact #3 + the bone.inherit readback at Bone.js:144, the lifecycle already covers this case correctly. Plan 37-02 should include a "if test fails, escalate" note.

</code_context>

<specifics>
## Specific Ideas

- **Audit-doc append placement:** Items 6 + 7 land in the "Findings (2026-05-08, source-read pass)" section, after the existing Item 4 entry, then the "Items deferred (unchanged)" block (lines 194-197) is updated: replace "Item 5 — RGBA2 + InheritTimeline → SEED-005 (untouched)" with "Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37)" + a one-line link to items 6/7.
- **Seed file status flip:** `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` frontmatter `status: planted` → `status: closed` + add `closed_date: 2026-05-13` (or actual close date) + `closed_during: Phase 37` per the SEED-007 / SEED-004 precedent.
- **InheritTimeline rig setup constraint** (planner — see DC-02 for rationale): parent bone must SHRINK during animation; child must detach via `Inherit.NoScale` at the shrink frame. Without shrinking parent, peak(detached) < peak(baseline) and the assertion direction inverts.
- **RGBA2 synthetic injection** (planner — see D-05): the RGBA2Timeline constructor is `new RGBA2Timeline(frameCount, bezierCount, slotIndex)` per `node_modules/@esotericsoftware/spine-core/dist/Animation.js:953`. Use `setFrame(frame, time, r, g, b, a, r2, g2, b2)` to populate keys. Inject into an existing `Animation`'s `timelines: Timeline[]` array.
- **Test names for traceability:** Recommend `it('TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline', ...)` and `it('TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline', ...)` so the N-tag pattern from N1.1–N2.3 extends naturally.

</specifics>

<deferred>
## Deferred Ideas

- **Per-frame inner-loop fan-out for sequence-mesh + DeformTimeline combo** — audit doc Item 2 closure flagged this as oversize-bias only (safe direction). Re-open via `/gsd-debug investigate Item 2 from .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` only if a real asset reports unexpectedly oversized sequence textures. Not in Phase 37 scope.
- **Full Spine 4.3 runtime port (SEED-006)** — gated on `@esotericsoftware/spine-core@4.3.x` npm publish. As of 2026-05-13 latest is 4.2.x. Out of scope per REQUIREMENTS.md.
- **Slot-color preview / RGBA2 product feature** — SEED-005 Level B explicitly scopes RGBA2 to audit + invariance proof only (REQUIREMENTS.md Out of Scope). Any product feature surfacing slot colors becomes its own milestone scope item.
- **Mesh-attachment InheritTimeline coverage** — DC-02 uses a region attachment to isolate the bone-inheritance signal. A mesh-attachment variant could be added later if a real rig surfaces an issue; not in Phase 37 scope.
- **60 Hz vs 120 Hz sampling cross-coverage** — REQ TIMELINE-03 explicitly runs at default 120 Hz. Cross-rate coverage is over-scope; sampling rate is mode-invariant for the inherit signal (rate affects sub-frame easing peaks, not which timelines apply).

### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` — Phase 4 code review WR-03 + 6 info findings. Owned by **Phase 38** per ROADMAP + REQUIREMENTS.md mapping. Out of Phase 37 scope; matcher hit on the loose "phase" keyword.
- `.planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — Phase 20 cross-platform DnD UAT. Owned by **Phase 39** (WINUAT-01). Out of Phase 37 scope.
- `.planning/todos/pending/2026-05-08-phase-31-windows-admin-dnd-release-uat.md` — Phase 31 Windows admin DnD release UAT. Owned by **Phase 39** (WINUAT-02). Out of Phase 37 scope.

</deferred>

---

*Phase: 37-spine-4-2-timeline-coverage-hardening*
*Context gathered: 2026-05-13*
