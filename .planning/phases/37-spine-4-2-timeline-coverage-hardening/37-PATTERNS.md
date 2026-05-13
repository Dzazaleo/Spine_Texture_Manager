# Phase 37: Spine 4.2 Timeline Coverage Hardening — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 6 (1 modify + 1 modify + 3 create + 1 modify)
**Analogs found:** 6 / 6 (all in-repo, all exact role-match)

This phase is audit + test-coverage only. No `src/` production-code changes are expected. Every new artifact has a direct in-repo template to copy from. The executor should mimic the cited line ranges verbatim and substitute only the values flagged below.

---

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` | MODIFY | audit-doc | append-only | self (items 2/3/4 closure block, lines 170-197) | exact |
| `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` | MODIFY | seed (status-flip) | frontmatter | `.planning/seeds/SEED-007-*.md` lines 1-14 | exact |
| `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` | CREATE | fixture (skeleton JSON) | static data | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | role-match (no existing InheritTimeline fixture) |
| `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` | CREATE | fixture (atlas text) | static data | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` | exact |
| `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` | CREATE | fixture (placeholder bytes) | unread (math phase) | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png` | exact (any PNG works; per CLAUDE.md fact #4) |
| `tests/core/sampler.spec.ts` | MODIFY | test (vitest spec) | request-response | self (N1.4 + N1.5 differential tests) | exact |

**Key constraint:** Phase 37 does NOT touch `src/core/*`. Confidence high per CONTEXT.md `<decisions>` D-01 + Bone.js:144 / Animation.js:740-756 source-read; if the InheritTimeline test fails (peak ≤ baseline), scope expands and the planner adds a sampler fix.

---

## Pattern Assignments

### 1. `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` — append items 6 + 7 + update items-deferred block

**Analog:** self (this is an append-only artifact; mimic the existing items 2/3/4 closure block written 2026-05-08).

**Frontmatter — leave UNCHANGED.** Lines 1-9 stay exactly as-is:

```markdown
---
type: handoff
created: 2026-05-08
created_during: post-spine-sequence-undercount audit
purpose: Spine 4.2 feature coverage audit (closed 2026-05-08 via source-read pass)
goal: Items 2, 3, 4 closed PASS. Items 1 and 5 deferred to SEED-004 + SEED-005.
status: closed
closed_date: 2026-05-08
---
```

Phase 37 does NOT update the frontmatter. The closing block at the bottom of the doc records the Phase 37 update; the doc-level `status: closed` is preserved because the audit task itself remains closed — Phase 37 only adds items 6 + 7 as follow-up PASS findings derived from SEED-005.

**Items 6 + 7 placement** (CONTEXT.md `<specifics>` line 97): append AFTER the existing Item 4 entry (which currently ends at line 192) but BEFORE the "Items deferred (unchanged)" block (lines 194-197). Specifically: insert between line 192 (Item 4's `**Verdict:**` line) and line 194 (`### Items deferred (unchanged)`).

**Item heading + verdict format** — copy from Item 2 (lines 170-176) verbatim, swap names + line citations. Template:

```markdown
### Item N — <title> → <VERDICT (PASS|SAFE|FALSIFIED)>

- <bullet 1 — primary source-read evidence with explicit `File.js:LINE` citation>
- <bullet 2 — cross-cited code at the readback site that proves the field is consumed (or isn't)>
- <bullet 3 — consequence in the sampler (oversize-bias / safe / undersize-risk)>
- **Verdict:** <one-line summary; flag any caveat>
```

Exact source for the template (lines 170-176 of the current doc):

```markdown
### Item 2 — SequenceTimeline + DeformTimeline interaction → PASS (oversize-bias only)

- DeformTimeline DOES mutate `slot.deform` per-tick (Animation.js:1286-1399). `MeshAttachment.computeWorldVertices` reads `slot.deform` (attachments/MeshAttachment.js:173-176 → VertexAttachment.js superclass at attachments/Attachment.js:73-130). So vertex positions CAN change across ticks on a sequence-mesh.
- However, the sampler's hot loop already records the **global peak across all ticks** (sampler.ts:317-338, snapshotFrame fold). When `fanOutSequencePeaks` (sampler.ts:407-557) broadcasts that peak record to all N region keys, every frame's record carries the worst-case (largest) deform-driven scale.
- Consequence: a sequence frame whose actual display window has small deform is *oversized* (sized for the largest deform any frame ever reached), never undersized. Safe direction.
- The Option C lock on "measure once, fan out" stays correct for the safety contract. It's suboptimal only for the rare combination of sequence-mesh + per-frame DeformTimeline on the same attachment, and only ever in the oversize direction.
- **Verdict:** SAFE. Audit doc's hypothesis was technically true about per-tick vertex mutation but mis-stated the consequence — the fan-out captures the maximum, not "one frame's deform." Consider a future seed if a real asset reports unexpectedly oversized sequence textures.
```

**Substitution table** for Phase 37 (planner pre-populates titles + citations from CONTEXT.md `<canonical_refs>`):

| Slot | Item 6 (RGBA2Timeline) | Item 7 (InheritTimeline) |
|---|---|---|
| Title | `RGBA2Timeline geometry-invariance` | `InheritTimeline detaches bone.inherit at runtime` |
| Verdict | `PASS (geometry-invariant by construction)` | `PASS (lifecycle already covers — proven by TIMELINE-03 test)` |
| Primary cite | `Animation.js:951-1030` — RGBA2Timeline.apply writes only `slot.color` (light) + `slot.darkColor`; no `bone.*` writes | `Animation.js:723-757` — InheritTimeline.apply mutates `bone.inherit = this.frames[Timeline.search(...) + 1]` at line 755 |
| Readback cite | `slot.darkColor` is consumed by GPU rendering only; sampler reads `bone.*` for transforms and `attachment.vertices` for geometry — neither path consults slot color | `Bone.js:144` — `switch (this.inherit)` in `updateLocalToWorld` drives the world-transform branch; cross-cited at Bone.js:271/278/288/299 |
| Consequence | Slot-color timelines cannot affect peak render scale; TIMELINE-04 asserts byte-equal globalPeaks Map between baseline and RGBA2-injected runs | `state.apply → bone.inherit mutation → updateWorldTransform` lifecycle (CLAUDE.md fact #3) inherently covers; TIMELINE-03 asserts peak(detached) > peak(baseline) |
| Test ref | `tests/core/sampler.spec.ts` — `TIMELINE-04` it() block | `tests/core/sampler.spec.ts` — `TIMELINE-03` it() block + `fixtures/INHERIT_TIMELINE/` |

**Items-deferred block update** — replace lines 194-197. Current text:

```markdown
### Items deferred (unchanged)

- Item 1 — Rotated atlas regions → SEED-004 (untouched).
- Item 5 — RGBA2 + InheritTimeline → SEED-005 (untouched).
```

Replace with (CONTEXT.md `<specifics>` line 97):

```markdown
### Items deferred (unchanged)

- Item 1 — Rotated atlas regions → SEED-004 (untouched).
- Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37 — see items 6 + 7 above).
```

**Triage table update (optional but consistent with audit-doc style)** — lines 105 + 111 currently show RGBA2 / InheritTimeline as `🟡 Deferred → SEED-005`. Update to `✅ Covered (Phase 37)` to keep the table in sync. This is a one-character row edit per row; planner should call it out explicitly so the executor sees it as part of the same atomic commit.

---

### 2. `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` — frontmatter status flip + body breadcrumb

**Analog:** `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` lines 1-14 (most recent closed-seed precedent, closed 2026-05-13 the day before Phase 37 — the format is the freshest reference). SEED-004 is the older precedent but still `status: planted` so it doesn't show closed-format frontmatter.

**Current SEED-005 frontmatter** (lines 1-9, planted state):

```markdown
---
id: SEED-005
status: planted
planted: 2026-05-08
planted_during: post-spine-sequence-undercount audit (.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 5)
trigger_when: (a) we ship a feature that depends on accurate slot tinting (e.g. Atlas Preview color rendering); OR (b) a user reports a rig where animations look different in our app vs. Spine player; OR (c) a fixture surfaces an InheritTimeline-driven bug
scope: A=Small (audit only — confirm both are render-scale-irrelevant) / B=Medium (add fixture coverage) / C=Large (handle in any product feature that surfaces tint/inheritance)
proposed_phase: TBD — likely v1.4 or later
---
```

**Target frontmatter** — copy SEED-007's three-extra-key pattern (lines 2-8 of SEED-007):

```markdown
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
```

**Key changes (verbatim diff for the executor):**
1. `status: planted` → `status: closed`
2. ADD line after `planted_during`: `closed_during: 37-spine-4-2-timeline-coverage-hardening`
3. ADD line after `closed_during`: `closed: 2026-05-13`

(SEED-007 used `closed:` not `closed_date:`. Both formats exist in the seeds dir — SEED-007 uses `closed:`, the audit doc uses `closed_date:`. SEED-007 is the seed-specific precedent; use `closed:` to match it.)

**Body breadcrumb** — SEED-007 added a one-paragraph closure note as the first body section after the H1 (lines 13-14):

```markdown
# SEED-007: Split overrides per loaderMode (atlas-source vs atlas-less)

**Closed:** 2026-05-13 (Phase 36 — Split Overrides Per Loader Mode shipped; OVR-01..OVR-07 all satisfied; mode-toggle one-shot toast D-01..D-04 + per-bucket migration + AppShell mode-switch divergence integration test all green).
```

**Mimic for SEED-005** — insert this paragraph between line 11 (H1) and line 13 (`## The Gap (one-line)`):

```markdown
**Closed:** 2026-05-13 (Phase 37 — Spine 4.2 Timeline Coverage Hardening shipped; TIMELINE-01..TIMELINE-05 all satisfied; audit doc items 6 + 7 PASS with source-cited evidence; `fixtures/INHERIT_TIMELINE/` + sampler tests `TIMELINE-03` / `TIMELINE-04` green).
```

Existing body content (the Gap / Why it matters / What it would take to investigate / Pointers / Open question sections) stays untouched. The frontmatter flip + breadcrumb are the only edits.

---

### 3. `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` — new skeleton JSON with InheritTimeline rig

**Analog:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (top-level skeleton structure + bone shape + region attachment shape + animation shape).

**Top-level skeleton block** — copy SIMPLE_TEST.json lines 1-11 verbatim, swap only `hash` (any pseudo-random) and bounding box numbers (estimate from rig — non-load-bearing per CLAUDE.md fact #4):

```json
{
"skeleton": {
	"hash": "INHERIT_42",
	"spine": "4.2.43",
	"x": -100,
	"y": -100,
	"width": 400,
	"height": 400,
	"images": "./IMAGES/",
	"audio": "./audio"
},
```

**Bone definition shape** — copy from SIMPLE_TEST.json lines 12-22 (a parent `CTRL` + a child bone with rotation/position). For Phase 37 the rig needs minimum 3 bones: `root`, `PARENT` (animated shrink), `CHILD` (inheritScale: true at setup, driven by InheritTimeline). Use this shape (cites SIMPLE_TEST.json lines 13-23):

```json
"bones": [
	{ "name": "root" },
	{ "name": "PARENT", "parent": "root", "x": 0, "y": 0 },
	{ "name": "CHILD", "parent": "PARENT", "length": 100, "x": 50, "y": 0 }
],
```

Notes on `inherit` field (per SkeletonJson.js:94 + CONTEXT.md `<decisions>` DC-02):
- Setup-pose inheritance defaults to `Normal` (full inherit) when no `inherit` field is present on BoneData. CHILD bone setup wants `Normal` (so InheritTimeline can flip to `NoScale` during animation).
- No `"inherit"` key needed in the bones[] block — defaults are correct.

**Slot definition shape** — copy SIMPLE_TEST.json lines 82-88. One slot on CHILD bone with a region attachment:

```json
"slots": [
	{ "name": "CHILD_SLOT", "bone": "CHILD", "attachment": "REGION" }
],
```

**Skin block (region attachment)** — copy SIMPLE_TEST.json lines 141-143 (SQUARE region — simplest possible region attachment, `width: 1000 height: 1000`):

```json
"skins": [
	{
		"name": "default",
		"attachments": {
			"CHILD_SLOT": {
				"REGION": { "width": 100, "height": 100 }
			}
		}
	}
],
```

**Animations block** — TWO animations required per DC-02:

1. `BASELINE` — parent shrink with NO InheritTimeline on CHILD (child always inherits). Provides baseline peak.
2. `INHERIT_DETACH` — same parent shrink + InheritTimeline on CHILD keying `Inherit.NoScale` at the shrink-peak frame. Provides detached peak.

**Animation bone-scale shape** — copy SIMPLE_TEST.json `SIMPLE_SCALE` animation (lines 264-303). Specifically the CHAIN_2 scale block at lines 266-271 shows the 3-keyframe pattern `{ x, y, [curve] } / { time, x, y }`. For the shrink, mirror SQUARE2's down-up pattern at SIMPLE_TEST.json lines 201-207:

```json
"SQUARE2": {
	"scale": [
		{ "x": 0.848, "y": 0.848 },
		{ "time": 0.6667, "x": 1.814, "y": 1.814 },
		{ "time": 1.6667, "x": 0.848, "y": 0.848 }
	]
}
```

For Phase 37's PARENT bone, invert: start at 1.0, dip to 0.4 at mid-animation, return to 1.0:

```json
"animations": {
	"BASELINE": {
		"bones": {
			"PARENT": {
				"scale": [
					{ "x": 1.0, "y": 1.0 },
					{ "time": 0.5, "x": 0.4, "y": 0.4 },
					{ "time": 1.0, "x": 1.0, "y": 1.0 }
				]
			}
		}
	},
	"INHERIT_DETACH": {
		"bones": {
			"PARENT": {
				"scale": [
					{ "x": 1.0, "y": 1.0 },
					{ "time": 0.5, "x": 0.4, "y": 0.4 },
					{ "time": 1.0, "x": 1.0, "y": 1.0 }
				]
			},
			"CHILD": {
				"inherit": [
					{ "time": 0.0, "inherit": "Normal" },
					{ "time": 0.5, "inherit": "NoScale" },
					{ "time": 1.0, "inherit": "Normal" }
				]
			}
		}
	}
}
```

**InheritTimeline JSON shape — source citation** (SkeletonJson.js:711-718):

```javascript
else if (timelineName === "inherit") {
    let timeline = new InheritTimeline(frames, bone.index);
    for (let frame = 0; frame < timelineMap.length; frame++) {
        let aFrame = timelineMap[frame];
        timeline.setFrame(frame, getValue(aFrame, "time", 0), Utils.enumValue(Inherit, getValue(aFrame, "inherit", "Normal")));
    }
    timelines.push(timeline);
}
```

This proves the JSON shape: a per-bone `"inherit": [ { "time": <number>, "inherit": "<enum-string>" }, ... ]` block. Valid enum strings (per `Bone.js` Inherit enum referenced at lines 145/158/167/196/197/271/279/288): `Normal`, `OnlyTranslation`, `NoRotationOrReflection`, `NoScale`, `NoScaleOrReflection`.

---

### 4. `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` — new atlas text

**Analog:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (entire file, 10 lines).

**Full atlas text from analog** (verbatim):

```
SIMPLE_TEST.png
size:1839,1464
filter:Linear,Linear
CIRCLE
bounds:1004,2,699,699
SQUARE
bounds:2,462,1000,1000
TRIANGLE
bounds:1004,703,833,759
```

**Target for INHERIT_TIMELINE/INHERIT_TEST.atlas** — single region named `REGION`, 100×100 to match the JSON attachment:

```
INHERIT_TEST.png
size:128,128
filter:Linear,Linear
REGION
bounds:2,2,100,100
```

The atlas text format is the AtlasReader's expected newline-separated key/value shape. Header is `<png-filename>` + `size:W,H` + `filter:Min,Mag`; per-region is `<name>` + `bounds:x,y,w,h` (no `rotate:` field needed; default is false; we don't exercise the rotated-region hard-fail at errors.ts:154).

---

### 5. `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` — placeholder bytes

**Analog:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png` (42 KB on disk).

**Per CLAUDE.md fact #4:** "The math phase does not decode PNGs. A stub `TextureLoader` populated from `.atlas` metadata is sufficient." Sampler does not decode PNG pixels — atlas bounds drive the source dims.

**Two acceptable approaches** (planner picks; both work; the second is more diff-friendly):

1. **Copy SIMPLE_TEST.png verbatim** to `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png`. Adds ~42 KB to the repo. Simplest in execution: `cp fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png fixtures/INHERIT_TIMELINE/INHERIT_TEST.png`.
2. **Minimal 1×1 PNG** generated via `node -e "..."` or `sharp` one-liner. Smallest possible bytes (~67 bytes for a transparent 1×1). Slightly more setup but cleaner blame trail.

**Recommendation:** Approach 1 (copy SIMPLE_TEST.png). Phase 37 is audit + coverage, not bytes-minimization. Repo size impact is negligible and the executor avoids any image-tooling dependency.

---

### 6. `tests/core/sampler.spec.ts` — add TIMELINE-03 + TIMELINE-04 it() blocks

**Analog:** existing N1.x test blocks in the same file. Two specific templates:

1. **TIMELINE-03 (InheritTimeline NoScale detach — peak > baseline):** mimic N1.4 (lines 108-142) — the "fresh-load-and-compare-two-runs" differential pattern.
2. **TIMELINE-04 (RGBA2Timeline geometry-invariance):** mimic N1.5 (lines 144-186) — the "clone-and-mutate-skeletonData-pre-sampler" pattern, plus N1.6 (lines 238-256) for the per-record byte-equal assertion loop.

**Imports** — UNCHANGED. The current imports at lines 30-38 already cover everything:

```typescript
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  sampleSkeleton,
  DEFAULT_SAMPLING_HZ,
  type PeakRecord,
} from '../../src/core/sampler.js';
```

**FIXTURE constant pattern** (line 40):

```typescript
const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
```

Add directly below (same const-pattern, scoped to the file top so both new tests can reuse):

```typescript
const INHERIT_FIXTURE = path.resolve('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json');
```

**Landing site** — inside the existing `describe('sampler — sampleSkeleton (N1.1–N1.6, N2.1, N2.3)', () => { ... })` block (line 44), after the N1.6 determinism test (ends line 256). The describe block's title can be updated to include `TIMELINE-03 / TIMELINE-04` for tag-traceability with the existing N-tag convention (planner micro-decision per CONTEXT.md `<code_context>` line 89).

#### TIMELINE-03 template — copy N1.4 shape (sampler.spec.ts:108-142)

Reference block (verbatim):

```typescript
it('N1.4 weighted-mesh DIFFERENTIAL (Strategy B): doubling dominant bone scale grows CIRCLE worldW > 1.5x baseline', () => {
    // Fixture inspection: CIRCLE mesh vertex 0 has bones=[4,5] weights=[0.00761, 0.99239].
    // Bone index 5 in the mesh's `bones` array refers to the SKELETON bone ordinal;
    // spine-core resolves `skeleton.bones[5]` which is `CHAIN_5` in SIMPLE_TEST.
    // We mutate `skeletonData.bones[5].scaleX/Y` to 2× BEFORE the sampler instantiates
    // the Skeleton — the bone's setup pose scale is doubled, cascading through the
    // weighted-sum math in computeWorldVertices.
    //
    // If the sampler ignored bone influences (e.g. treated weights as identity),
    // worldW wouldn't change. Observed ratio on the fixture ~1.78×; threshold 1.5×
    // is conservative and well above FP noise / per-vertex weight distribution.
    const baseline = sampleSkeleton(loadSkeleton(FIXTURE)).globalPeaks;
    const baseCircle = [...baseline.values()].find(
      (r) => r.attachmentName === 'CIRCLE',
    );
    expect(baseCircle).toBeDefined();

    const mutated = loadSkeleton(FIXTURE);
    const targetBoneIndex = 5;
    const boneData = mutated.skeletonData.bones[targetBoneIndex];
    expect(boneData).toBeDefined();
    // Sanity: we're mutating the expected chain bone.
    expect(boneData!.name.startsWith('CHAIN_')).toBe(true);
    boneData!.scaleX = (boneData!.scaleX ?? 1) * 2.0;
    boneData!.scaleY = (boneData!.scaleY ?? 1) * 2.0;

    const scaledPeaks = sampleSkeleton(mutated).globalPeaks;
    const scaledCircle = [...scaledPeaks.values()].find(
      (r) => r.attachmentName === 'CIRCLE',
    );
    expect(scaledCircle).toBeDefined();

    // Differential gate — proves weighted-sum path actively reads bone transforms.
    expect(scaledCircle!.worldW).toBeGreaterThan(baseCircle!.worldW * 1.5);
  });
```

**Substitution table for TIMELINE-03:**

| Slot | TIMELINE-03 value |
|---|---|
| Test name | `'TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline'` (CONTEXT.md `<specifics>` line 101) |
| FIXTURE | `INHERIT_FIXTURE` (the new const) |
| Mutation | Drop the InheritTimeline from the `INHERIT_DETACH` animation's timelines array for the baseline run (mirrors N1.5's filter on `transformConstraints`). Alternative: sample `BASELINE` (no InheritTimeline) vs `INHERIT_DETACH` (with) via the `perAnimationPeaks` helper at sampler.spec.ts:349-355. The two-animations-in-one-fixture approach is cleaner. |
| Subject | `CHILD_SLOT` / `REGION` peak from `INHERIT_DETACH` vs `BASELINE` |
| Assertion | `expect(detachedPeak.peakScale).toBeGreaterThan(baselinePeak.peakScale)` (strict `>` per CONTEXT.md DC-02 — "Assertion: peak(detached) > peak(baseline) strict") |
| Comment | Cite Animation.js:740-756 + Bone.js:144 for traceability — mirror N1.4's "if the sampler ignored X" framing |

**Per-animation isolation pattern** — already in the file at lines 349-355 (`perAnimationPeaks` helper). Reuse:

```typescript
const perAnimationPeaks = (animationName: string): Map<string, PeakRecord> => {
    const scoped = loadSkeleton(FIXTURE);
    scoped.skeletonData.animations = scoped.skeletonData.animations.filter(
      (a) => a.name === animationName,
    );
    return sampleSkeleton(scoped).globalPeaks;
  };
```

For TIMELINE-03 the helper signature changes to take a fixture path:

```typescript
const perAnimationPeaks = (fixturePath: string, animationName: string): Map<string, PeakRecord> => {
    const scoped = loadSkeleton(fixturePath);
    scoped.skeletonData.animations = scoped.skeletonData.animations.filter(
      (a) => a.name === animationName,
    );
    return sampleSkeleton(scoped).globalPeaks;
  };
```

(Planner micro-decision: hoist the helper to file scope, OR inline the load+filter in TIMELINE-03 — either is fine, the existing helper is already scoped inside the `describe('sampler — numeric goldens', ...)` block at line 315.)

#### TIMELINE-04 template — copy N1.5 (clone-and-strip) + N1.6 (byte-equal-loop) shape

Reference for the clone-and-strip pattern (sampler.spec.ts:144-186, especially the timeline-array filter at line 169):

```typescript
it('N1.5 TransformConstraint (LOCKED per CONTEXT.md): SQUARE constrained-vs-unconstrained peaks differ strictly', () => {
    // ...
    const constrainedLoad = loadSkeleton(FIXTURE);
    const constrainedPeaks = sampleSkeleton(constrainedLoad).globalPeaks;
    // ...
    const uncLoad = loadSkeleton(FIXTURE);
    const before = uncLoad.skeletonData.transformConstraints.length;
    uncLoad.skeletonData.transformConstraints =
      uncLoad.skeletonData.transformConstraints.filter(
        (c) => !c.bones.some((b) => b.name === 'SQUARE'),
      );
    expect(uncLoad.skeletonData.transformConstraints.length).toBe(before - 1);
    // ...
});
```

For TIMELINE-04 we do the **inverse**: load baseline, then ADD an RGBA2Timeline to a copy. RGBA2Timeline constructor signature per CONTEXT.md `<specifics>` line 100 + Animation.js:953:

```javascript
constructor(frameCount, bezierCount, slotIndex) {
    super(frameCount, bezierCount, [
        Property.rgb + "|" + slotIndex,
        Property.alpha + "|" + slotIndex,
        Property.rgb2 + "|" + slotIndex
    ]);
    this.slotIndex = slotIndex;
}
```

setFrame signature per Animation.js:965:

```javascript
setFrame(frame, time, r, g, b, a, r2, g2, b2) { /* ... */ }
```

**Reference for the byte-equal Map comparison** (sampler.spec.ts:243-255, N1.6):

```typescript
expect(a.size).toBe(b.size);
// Compare every key/value — peak scale must match bit-for-bit.
for (const [key, recA] of a) {
  const recB = b.get(key);
  expect(recB, `missing key on second run: ${key}`).toBeDefined();
  const rb = recB as PeakRecord;
  expect(rb.peakScale).toBe(recA.peakScale);
  expect(rb.peakScaleX).toBe(recA.peakScaleX);
  expect(rb.peakScaleY).toBe(recA.peakScaleY);
  expect(rb.worldW).toBe(recA.worldW);
  expect(rb.worldH).toBe(recA.worldH);
  expect(rb.time).toBe(recA.time);
  expect(rb.animationName).toBe(recA.animationName);
}
```

**Substitution table for TIMELINE-04:**

| Slot | TIMELINE-04 value |
|---|---|
| Test name | `'TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline'` (CONTEXT.md `<specifics>` line 101) |
| Fixture | `FIXTURE` (existing SIMPLE_PROJECT — the de-facto smoke fixture per CONTEXT.md `<code_context>` line 78), OR `INHERIT_FIXTURE` (planner pick — D-05 leaves it open). SIMPLE_PROJECT preferred for diff-minimization with existing tests. |
| Baseline run | `const baseline = sampleSkeleton(loadSkeleton(FIXTURE)).globalPeaks;` |
| Injection step | Load fresh, clone or pick an Animation, instantiate `new RGBA2Timeline(2, 0, slotIndex)`, populate two keyframes via `setFrame(0, 0, 1,1,1,1, 0,0,0)` + `setFrame(1, 1.0, 0,0,0,1, 1,1,1)` (full red→black tint sweep), push onto `animation.timelines` array. Import `RGBA2Timeline` from `@esotericsoftware/spine-core` at the top of the file (NEW import — not currently in the file). |
| Injected run | `const injected = sampleSkeleton(injectedLoad).globalPeaks;` |
| Assertion loop | Per-key byte-equal exactly as N1.6 (lines 243-255), copied verbatim. Compare `baseline` to `injected`. |
| DC-01 strictness | No epsilon — strict `.toBe()` per CONTEXT.md DC-01: "No epsilon tolerance: same skeleton, same animation, same sampler lifecycle modulo a slot-color-only timeline that MUST not influence bone transforms" |

**New import** required at file top (between lines 33-38):

```typescript
import { RGBA2Timeline } from '@esotericsoftware/spine-core';
```

This is the only new import in the file. Spine-core is already a runtime dep (loader.ts imports from it).

**slotIndex resolution** — `skeletonData.slots` array is indexed; find the target slot's index via `skeletonData.slots.findIndex(s => s.name === '<slot-name>')`. SIMPLE_PROJECT has `CIRCLE / TRIANGLE / SQUARE / PATH / SQUARE2` slots (sampler.spec.ts:55-57). Pick `SQUARE` (slot index 2). Any textured slot works since RGBA2 is geometry-invariant by hypothesis.

**Animation pick** — inject into an existing animation that already drives bone scale, so the run exercises a non-trivial peak. `PATH` is the obvious pick (CHAIN_2 scale + CTRL_PATH translate/rotate/scale — see SIMPLE_TEST.json lines 154-216). Locate via `skeletonData.animations.find(a => a.name === 'PATH')`.

---

## Shared Patterns

### S1 — File-top FIXTURE/SOURCE constant pattern

**Source:** `tests/core/sampler.spec.ts:40-41`

**Apply to:** TIMELINE-03 (`INHERIT_FIXTURE`). TIMELINE-04 reuses existing `FIXTURE`.

```typescript
const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const SAMPLER_SRC = path.resolve('src/core/sampler.ts');
```

Add (same pattern):

```typescript
const INHERIT_FIXTURE = path.resolve('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json');
```

### S2 — Differential-test commentary style

**Source:** N1.4 (sampler.spec.ts:108-142) and N1.5 (sampler.spec.ts:144-186).

**Apply to:** both TIMELINE-03 and TIMELINE-04 — copy the "Fixture inspection / What we mutate / Why the assertion holds / Observed anchor" four-paragraph commentary structure. The verbosity is consistent with the existing sampler.spec.ts house style and aids audit-doc cross-reference. Specifically the "if the sampler ignored X, Y wouldn't change" framing at N1.4 line 116-118 maps directly onto TIMELINE-03 ("if state.apply didn't tick InheritTimeline, peak(detached) would equal peak(baseline)").

### S3 — Per-record byte-equal Map comparison loop

**Source:** N1.6 (sampler.spec.ts:238-256). Mirrored for the `D-53` extension test at lines 537-555.

**Apply to:** TIMELINE-04 (DC-01 strict-equal assertion). Use `.toBe()` not `.toBeCloseTo()` per DC-01.

### S4 — Frontmatter status-flip pattern for seeds

**Source:** SEED-007 lines 1-14 (closed 2026-05-13).

**Apply to:** SEED-005 frontmatter. Three additive keys (`status` flip + `closed_during` + `closed`); no removals; one body breadcrumb paragraph.

### S5 — Audit-doc append-only edit policy

**Source:** SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md frontmatter (lines 1-9) preserved across Phase 37; only body sections amended.

**Apply to:** `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md`. Do NOT update `status: closed` / `closed_date: 2026-05-08`. The doc-level audit is closed; Phase 37 only appends follow-up findings as items 6 + 7.

---

## No Analog Found

None. Every new artifact has a same-role precedent in the repo.

Closest "no-analog risk" was the InheritTimeline JSON shape (no existing fixture exercises the `"inherit"` per-bone timeline array), but the canonical reference is the spine-core JSON parser at `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:711-718` (loaded under "Pattern Assignments → file 3 → InheritTimeline JSON shape — source citation"). The parser IS the authoritative spec; no in-repo fixture is needed to copy from.

---

## Metadata

**Analog search scope:** `.planning/` (audit doc + seeds dir), `fixtures/SIMPLE_PROJECT/`, `tests/core/sampler.spec.ts`, `node_modules/@esotericsoftware/spine-core/dist/{Animation,SkeletonJson,Bone}.js` (read-only source-cite for the InheritTimeline + RGBA2Timeline JSON / runtime contracts).

**Files scanned:** 9 (`.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` × 1 full read; `SEED-005`, `SEED-007`, `SEED-004` × 1 full read each; `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` × 1 full read; `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` × 1 full read; `tests/core/sampler.spec.ts` × 3 chunked reads; `Animation.js` + `SkeletonJson.js` × targeted grep + range reads).

**Pattern extraction date:** 2026-05-13
