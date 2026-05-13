---
phase: 37-spine-4-2-timeline-coverage-hardening
plan: 03
type: execute
wave: 3
depends_on: [37-01, 37-02]
files_modified:
  - tests/core/sampler.spec.ts
  - .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md
autonomous: true
requirements: [TIMELINE-04, TIMELINE-05]
requirements_addressed: [TIMELINE-04, TIMELINE-05]

must_haves:
  truths:
    - "tests/core/sampler.spec.ts contains an it() block named 'TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline' that loads SIMPLE_TEST twice, injects an RGBA2Timeline onto one slot's animation in the second copy, runs the sampler on both, and asserts strict per-key equality on peakScale / peakScaleX / peakScaleY / worldW / worldH between the two globalPeaks Maps"
    - "Injecting RGBA2Timeline onto an animation produces byte-identical sampler output vs the same animation without it — proves slot-color timelines cannot affect render scale"
    - "SEED-005 frontmatter status flipped from `planted` to `closed`; `closed_during: 37-spine-4-2-timeline-coverage-hardening` and `closed: 2026-05-13` (or actual close date) keys added; body has a one-paragraph closure breadcrumb between the H1 and the existing `## The Gap (one-line)` section"
    - "The audit doc's items-deferred block (updated in Plan 37-01) already reflects items 5/6/7 closure — Plan 37-03 verifies the doc-level traceability is complete and does NOT re-edit that section (37-01 owns it)"
    - "D-05: RGBA2 test uses synthetic in-test construction — load SIMPLE_TEST via loadSkeleton, programmatically inject a new RGBA2Timeline(frameCount, bezierCount, slotIndex) onto one slot's animation timelines array in a second loaded copy, sample both, compare for byte-equality (no JSON fixture)"
    - "D-06: no new fixtures/RGBA2_TINT/ directory is created — the synthetic approach is fully test-resident, reusing fixtures/SIMPLE_PROJECT/SIMPLE_TEST as the base skeleton"
  artifacts:
    - path: "tests/core/sampler.spec.ts"
      provides: "TIMELINE-04 it() block + RGBA2Timeline import from @esotericsoftware/spine-core"
      contains: "TIMELINE-04 RGBA2Timeline geometry-invariance"
    - path: ".planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md"
      provides: "Frontmatter status=closed + closed_during + closed keys; body closure breadcrumb"
      contains: "status: closed"
  key_links:
    - from: "tests/core/sampler.spec.ts (TIMELINE-04 block)"
      to: "@esotericsoftware/spine-core (RGBA2Timeline import)"
      via: "new import statement near the top of the file"
      pattern: "import.*RGBA2Timeline.*@esotericsoftware/spine-core"
    - from: ".planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md (body)"
      to: ".planning/phases/37-spine-4-2-timeline-coverage-hardening/"
      via: "closure breadcrumb naming the phase"
      pattern: "Phase 37"
---

<objective>
Add the TIMELINE-04 RGBA2Timeline geometry-invariance test (synthetic in-test injection, no on-disk fixture) and flip SEED-005's frontmatter `status:` from `planted` to `closed` with a closing-phase breadcrumb. This closes the regression contract proving RGBA2Timeline keyframes cannot affect sampler output — the assumption recorded in audit doc Item 6 from Plan 37-01.

Per CONTEXT.md D-05 + D-06: the RGBA2 test uses synthetic in-test construction (NOT a JSON fixture). Pattern: load SIMPLE_TEST.json twice via `loadSkeleton`, programmatically inject a new `RGBA2Timeline(frameCount, bezierCount, slotIndex)` instance onto one slot's animation timelines array in the second copy, then run `sampleSkeleton` on both and assert strict per-key byte-equality on the `globalPeaks` Map.

Per CONTEXT.md DC-01: strict-equal (`.toBe()`, not `.toBeCloseTo()` or epsilon-tolerant); same skeleton, same animation, same sampler lifecycle modulo a slot-color-only timeline that MUST not influence bone transforms — any drift indicates a real bug.

Purpose: Closes REQ TIMELINE-04 (RGBA2 geometry-invariance test) + REQ TIMELINE-05 (SEED-005 status flip + audit-doc closure traceability).

**Note on audit-doc closure:** Plan 37-01 already updates the audit-doc "Items deferred" block (`Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37 — see items 6 + 7 above).`) — that satisfies the REQ TIMELINE-05 "audit doc reflects items 5/6/7 closed" clause. Plan 37-03 does NOT re-edit the audit doc (avoids merge conflicts with 37-01's edits); it only verifies the doc-level traceability is intact, and owns the SEED-005 status flip + breadcrumb.

Output:
- `tests/core/sampler.spec.ts` — new `RGBA2Timeline` import + new TIMELINE-04 `it()` block inside the existing `describe('sampler — sampleSkeleton (...)', ...)` describe (lands alongside the TIMELINE-03 block from Plan 37-02)
- `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` — frontmatter `status: closed` + `closed_during` + `closed` keys; body closure paragraph
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-CONTEXT.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-01-SUMMARY.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-02-SUMMARY.md
@.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md
@.planning/seeds/SEED-007-split-overrides-per-loader-mode.md
@.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md
@tests/core/sampler.spec.ts
@fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json

<interfaces>
<!-- RGBA2Timeline constructor + setFrame signatures (the new import we'll add). -->
From node_modules/@esotericsoftware/spine-core/dist/Animation.js lines 951-1010 (RGBA2Timeline class):
```javascript
class RGBA2Timeline extends CurveTimeline {
    constructor(frameCount, bezierCount, slotIndex) {
        super(frameCount, bezierCount, [
            Property.rgb + "|" + slotIndex,
            Property.alpha + "|" + slotIndex,
            Property.rgb2 + "|" + slotIndex
        ]);
        this.slotIndex = slotIndex;
    }
    getFrameEntries() { return ENTRIES; /* 8 */ }
    setFrame(frame, time, r, g, b, a, r2, g2, b2) {
        frame *= ENTRIES;
        this.frames[frame] = time;
        this.frames[frame + R] = r; this.frames[frame + G] = g; this.frames[frame + B] = b; this.frames[frame + A] = a;
        this.frames[frame + R2] = r2; this.frames[frame + G2] = g2; this.frames[frame + B2] = b2;
    }
    apply(skeleton, lastTime, time, events, alpha, blend, direction) {
        // writes to slot.color (light) + slot.darkColor (dark); NO bone.* writes; NO geometry writes
    }
}
```

<!-- Existing test patterns we mirror (sampler.spec.ts:144-186 for clone-and-modify, sampler.spec.ts:238-256 for byte-equal Map comparison). -->
From tests/core/sampler.spec.ts lines ~349-355 (perAnimationPeaks helper):
```typescript
const perAnimationPeaks = (animationName: string): Map<string, PeakRecord> => {
    const scoped = loadSkeleton(FIXTURE);
    scoped.skeletonData.animations = scoped.skeletonData.animations.filter(
      (a) => a.name === animationName,
    );
    return sampleSkeleton(scoped).globalPeaks;
};
```

From tests/core/sampler.spec.ts lines ~243-255 (N1.6 byte-equal Map loop):
```typescript
expect(a.size).toBe(b.size);
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
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add TIMELINE-04 RGBA2Timeline geometry-invariance test + RGBA2Timeline import to sampler.spec.ts</name>
  <files>tests/core/sampler.spec.ts</files>
  <read_first>
    - tests/core/sampler.spec.ts (read in full — confirm the TIMELINE-03 block from Plan 37-02 is present; confirm existing imports at lines 30-38; confirm the describe block layout; identify the EXACT line number of the closing `});` of the top-level describe so the new TIMELINE-04 block lands inside that describe immediately after TIMELINE-03)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md section 6 ("file 6 → TIMELINE-04 template") and S3 ("Per-record byte-equal Map comparison loop")
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-CONTEXT.md D-05 (synthetic in-test injection, not JSON fixture) + D-06 (no new fixtures/RGBA2_TINT/ directory) + DC-01 (strict deep-equal on globalPeaks Map, no epsilon, also assert numeric fields per-record)
    - node_modules/@esotericsoftware/spine-core/dist/Animation.js (read lines 950-1010 — confirm RGBA2Timeline constructor and setFrame signatures match what we use)
    - fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (read lines 80-160 — confirm the slots array and the PATH animation; we will inject the RGBA2Timeline onto a slot in the PATH animation since PATH drives non-trivial bone scale changes — produces meaningful peak values to compare)
  </read_first>
  <behavior>
    - Test 1 (TIMELINE-04): Loading SIMPLE_TEST.json twice via `loadSkeleton`, then injecting a new `RGBA2Timeline(2, 0, slotIndex)` instance onto the PATH animation's timelines array in the second copy and populating two color keyframes via `setFrame(0, 0, 1,1,1,1, 0,0,0)` and `setFrame(1, 1.0, 0,0,0,1, 1,1,1)`, then running `sampleSkeleton` on both — produces globalPeaks Maps with strictly equal `.size`, strictly equal keys, and per-record strict equality on `peakScale`, `peakScaleX`, `peakScaleY`, `worldW`, `worldH`, `time`, `animationName`, `attachmentName`.
    - Regression guard: If RGBA2Timeline.apply leaked into the bone transform path (impossible per Animation.js:951-1030 read but locked here defensively), or if the sampler hot loop snapshot were affected by slot-color state, the strict equality would fail. Strict `.toBe()` catches any drift.
  </behavior>
  <action>
**Step A — Add the RGBA2Timeline import.** Use the Edit tool to insert a new import statement immediately after the existing sampler import block. Target the lines 30-38 region:

Find:
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

Replace with:
```typescript
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RGBA2Timeline } from '@esotericsoftware/spine-core';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  sampleSkeleton,
  DEFAULT_SAMPLING_HZ,
  type PeakRecord,
} from '../../src/core/sampler.js';
```

Per PATTERNS.md section 6: this is the ONLY new import needed for the file. Spine-core is already a runtime dep (loader.ts imports from it).

**Step B — Add the TIMELINE-04 it() block.** Use the Edit tool to insert a new it() block immediately AFTER the TIMELINE-03 block (which Plan 37-02 added inside the `describe('sampler — sampleSkeleton (...)', ...)` describe). Place it inside the same describe, before the describe's closing `});`.

Insert this complete it() block verbatim (do NOT abbreviate or paraphrase):

```typescript
  it('TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline', () => {
    // Fixture inspection: fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json is the de-facto smoke
    // fixture (CIRCLE / SQUARE / TRIANGLE / CHAIN_2..8 / PATH animation with non-trivial
    // bone-scale variation). We pick the SQUARE slot (index 2 in skeletonData.slots) and
    // the PATH animation as the injection target — PATH already exercises CHAIN_2 scale
    // + CTRL_PATH translate/rotate/scale, so the sampler captures meaningful peaks.
    //
    // What we exercise (CONTEXT.md D-05): load SIMPLE_TEST twice via loadSkeleton, inject
    // a synthetic RGBA2Timeline(frameCount=2, bezierCount=0, slotIndex=SQUARE) onto the
    // PATH animation's timelines array in the second copy, populate two keyframes via
    // setFrame, then run sampleSkeleton on both and compare globalPeaks Maps.
    //
    // Hypothesis (audit doc Item 6 + Animation.js:951-1030 source-read): RGBA2Timeline.apply
    // writes only to slot.color + slot.darkColor. The sampler reads bone.* for transforms
    // and attachment.vertices for geometry — neither path consults slot color. Therefore
    // the two globalPeaks Maps must be byte-identical: same size, same keys, same numeric
    // values for every PeakRecord.
    //
    // If RGBA2Timeline.apply somehow leaked into the bone transform path (impossible per
    // the source-read but locked here defensively), strict .toBe() catches any drift —
    // no epsilon tolerance per CONTEXT.md DC-01.
    const baselineLoad = loadSkeleton(FIXTURE);
    const baselinePeaks = sampleSkeleton(baselineLoad).globalPeaks;

    const injectedLoad = loadSkeleton(FIXTURE);
    const slotIndex = injectedLoad.skeletonData.slots.findIndex(
      (s) => s.name === 'SQUARE',
    );
    expect(slotIndex, 'SQUARE slot must exist in SIMPLE_TEST').toBeGreaterThanOrEqual(0);

    const pathAnimation = injectedLoad.skeletonData.animations.find(
      (a) => a.name === 'PATH',
    );
    expect(pathAnimation, 'PATH animation must exist in SIMPLE_TEST').toBeDefined();

    // RGBA2Timeline(frameCount=2, bezierCount=0, slotIndex). Constructor at Animation.js:953.
    const rgba2 = new RGBA2Timeline(2, 0, slotIndex);
    // setFrame(frame, time, r, g, b, a, r2, g2, b2) per Animation.js:965 — full color sweep
    // from white-tint+black-dark to black-tint+white-dark across the animation. The exact
    // color values are irrelevant; what matters is that the timeline ticks during state.apply.
    rgba2.setFrame(0, 0.0, 1, 1, 1, 1, 0, 0, 0);
    rgba2.setFrame(1, 1.0, 0, 0, 0, 1, 1, 1, 1);
    pathAnimation!.timelines.push(rgba2);

    const injectedPeaks = sampleSkeleton(injectedLoad).globalPeaks;

    // Map size must match (no key added or removed by the slot-color timeline).
    expect(injectedPeaks.size).toBe(baselinePeaks.size);

    // Per-record strict equality on every numeric field (PATTERNS.md S3 mirrors N1.6
    // determinism loop). No epsilon — CONTEXT.md DC-01.
    for (const [key, recBaseline] of baselinePeaks) {
      const recInjected = injectedPeaks.get(key);
      expect(
        recInjected,
        `missing key in injected run: ${key}`,
      ).toBeDefined();
      const ri = recInjected as PeakRecord;
      expect(ri.peakScale).toBe(recBaseline.peakScale);
      expect(ri.peakScaleX).toBe(recBaseline.peakScaleX);
      expect(ri.peakScaleY).toBe(recBaseline.peakScaleY);
      expect(ri.worldW).toBe(recBaseline.worldW);
      expect(ri.worldH).toBe(recBaseline.worldH);
      expect(ri.time).toBe(recBaseline.time);
      expect(ri.animationName).toBe(recBaseline.animationName);
      expect(ri.attachmentName).toBe(recBaseline.attachmentName);
    }
  });
```

**Step C — Run the tests.** Use the Bash tool:

```bash
npm test -- tests/core/sampler.spec.ts
```

Expected: all existing tests still pass, plus TIMELINE-03 (from Plan 37-02), plus the new TIMELINE-04 test all green.

**Step D — Per CLAUDE.md fact #5:** the test imports only from `src/core/*` and `@esotericsoftware/spine-core` (a runtime dependency already used by loader.ts) — no DOM, no Electron, no React.
  </action>
  <verify>
    <automated>grep -q "import { RGBA2Timeline } from '@esotericsoftware/spine-core'" tests/core/sampler.spec.ts &amp;&amp; grep -q "TIMELINE-04 RGBA2Timeline geometry-invariance" tests/core/sampler.spec.ts &amp;&amp; grep -q "new RGBA2Timeline(2, 0, slotIndex)" tests/core/sampler.spec.ts &amp;&amp; grep -q "pathAnimation!.timelines.push(rgba2)" tests/core/sampler.spec.ts &amp;&amp; grep -q "expect(injectedPeaks.size).toBe(baselinePeaks.size)" tests/core/sampler.spec.ts &amp;&amp; npm test -- tests/core/sampler.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "import { RGBA2Timeline } from '@esotericsoftware/spine-core'" tests/core/sampler.spec.ts` exits 0 (new import added)
    - `grep -c "RGBA2Timeline" tests/core/sampler.spec.ts` outputs a number >= 3 (import + constructor + at least one comment/reference)
    - `grep -q "TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline" tests/core/sampler.spec.ts` exits 0 (exact test name per CONTEXT.md specifics)
    - `grep -c "TIMELINE-04 RGBA2Timeline geometry-invariance" tests/core/sampler.spec.ts` outputs exactly `1` (no duplicate insertion)
    - `grep -q "new RGBA2Timeline(2, 0, slotIndex)" tests/core/sampler.spec.ts` exits 0 (frameCount=2, bezierCount=0 constructor args)
    - `grep -q "pathAnimation!.timelines.push(rgba2)" tests/core/sampler.spec.ts` exits 0 (timeline injected onto PATH animation)
    - `grep -q "expect(injectedPeaks.size).toBe(baselinePeaks.size)" tests/core/sampler.spec.ts` exits 0 (size equality assertion)
    - `grep -q "expect(ri.peakScale).toBe(recBaseline.peakScale)" tests/core/sampler.spec.ts` exits 0 (strict per-record numeric equality, no .toBeCloseTo)
    - `! grep -q "toBeCloseTo.*peakScale" tests/core/sampler.spec.ts` exits 0 (TIMELINE-04 must use strict .toBe per DC-01 — no epsilon-tolerant comparisons added)
    - `npm test -- tests/core/sampler.spec.ts` exits 0 (all sampler tests pass — existing N1.x / N2.x + TIMELINE-03 + new TIMELINE-04)
    - `npm test -- tests/core/sampler.spec.ts 2>&amp;1 | grep -q "TIMELINE-04"` exits 0 (vitest output shows the new test ran)
  </acceptance_criteria>
  <done>
`tests/core/sampler.spec.ts` contains the new `RGBA2Timeline` import (single named import from `@esotericsoftware/spine-core`) and the new `it('TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline', ...)` block inside the existing top-level describe. The test loads SIMPLE_TEST twice, identifies the SQUARE slot index + PATH animation, constructs a synthetic RGBA2Timeline with 2 keyframes, injects it into PATH's timelines array on the second copy, runs the sampler on both, and asserts strict equality (`.toBe()`, no epsilon) on globalPeaks Map size and every numeric field of every PeakRecord. Vitest exits 0 with all sampler tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Flip SEED-005 frontmatter status + add body closure breadcrumb + verify audit doc closure traceability</name>
  <files>.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md</files>
  <read_first>
    - .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md (read in full — confirm current frontmatter shape lines 1-9 and the body structure; PATTERNS.md section 2 gives the verbatim diff)
    - .planning/seeds/SEED-007-split-overrides-per-loader-mode.md (read lines 1-14 — the closest closed-seed precedent; PATTERNS.md S4 cites this as the template for the three-extra-key frontmatter pattern)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md section 2 (full "Pattern Assignments → file 2" section — verbatim diff for frontmatter changes + body breadcrumb)
    - .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md (read the "Items deferred (unchanged)" block — verify Plan 37-01 already updated the Item 5 line to read "closed Phase 37 — see items 6 + 7 above"; this is the doc-level closure traceability REQ TIMELINE-05 references)
  </read_first>
  <action>
**Step A — Verify Plan 37-01 already closed the audit-doc traceability for Item 5.** Run:

```bash
grep -q 'Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37 — see items 6 + 7 above).' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md
```

If exit code is non-zero, Plan 37-01 did NOT update the audit doc as expected — STOP and report; do not proceed with the SEED-005 flip until 37-01's audit-doc edits are verified. (This is the "items 5/6/7 closed" portion of REQ TIMELINE-05; 37-01 owns it.)

**Step B — Flip the SEED-005 frontmatter.** Use the Edit tool to perform two precise edits:

**Edit 1** — change `status: planted` to `status: closed`. Target the frontmatter on line 3:

Find: `status: planted`
Replace: `status: closed`

**Edit 2** — insert two new keys (`closed_during:` + `closed:`) immediately after the `planted_during:` line and before the `trigger_when:` line. Target the block starting at line 4:

Find:
```
planted_during: post-spine-sequence-undercount audit (.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 5)
trigger_when: (a) we ship a feature that depends on accurate slot tinting (e.g. Atlas Preview color rendering); OR (b) a user reports a rig where animations look different in our app vs. Spine player; OR (c) a fixture surfaces an InheritTimeline-driven bug
```

Replace with:
```
planted_during: post-spine-sequence-undercount audit (.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 5)
closed_during: 37-spine-4-2-timeline-coverage-hardening
closed: 2026-05-13
trigger_when: (a) we ship a feature that depends on accurate slot tinting (e.g. Atlas Preview color rendering); OR (b) a user reports a rig where animations look different in our app vs. Spine player; OR (c) a fixture surfaces an InheritTimeline-driven bug
```

Per PATTERNS.md section 2 and S4: matches the SEED-007 closed-seed precedent — three additive keys (`status` flip + `closed_during` + `closed`); no removals. Uses `closed:` (not `closed_date:`) to match SEED-007.

**Note on close date:** If the actual close date when this task runs is NOT 2026-05-13, use the actual current date (in `YYYY-MM-DD` format) instead of `2026-05-13`. The pattern is "date the seed was closed" — typically the date Plan 37-03 completes.

**Edit 3** — insert a one-paragraph closure breadcrumb in the body. Target the region between the H1 (line 11, `# SEED-005: ...`) and the existing `## The Gap (one-line)` heading (line 13).

Find:
```markdown
# SEED-005: RGBA2 (two-color tinting) + InheritTimeline coverage gap

## The Gap (one-line)
```

Replace with:
```markdown
# SEED-005: RGBA2 (two-color tinting) + InheritTimeline coverage gap

**Closed:** 2026-05-13 (Phase 37 — Spine 4.2 Timeline Coverage Hardening shipped; TIMELINE-01..TIMELINE-05 all satisfied; audit doc items 6 + 7 PASS with source-cited evidence; `fixtures/INHERIT_TIMELINE/` + sampler tests `TIMELINE-03` / `TIMELINE-04` green).

## The Gap (one-line)
```

(Substitute the actual close date for `2026-05-13` if different.)

The existing body content (The Gap / Why it matters / Why we deferred / What it would take to investigate / Pointers / Open question sections) stays UNTOUCHED. The frontmatter flip + breadcrumb are the only edits.

**Step C — Sanity-check the seed file.** Run:

```bash
head -12 .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md
```

Visually confirm: `status: closed`, `closed_during: 37-spine-4-2-timeline-coverage-hardening`, `closed: <date>`, and the body breadcrumb between H1 and `## The Gap (one-line)`.
  </action>
  <verify>
    <automated>grep -q '^status: closed$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md &amp;&amp; grep -q '^closed_during: 37-spine-4-2-timeline-coverage-hardening$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md &amp;&amp; grep -qE '^closed: 20[0-9]{2}-[0-9]{2}-[0-9]{2}$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md &amp;&amp; ! grep -q '^status: planted$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md &amp;&amp; grep -q '\*\*Closed:\*\*.*Phase 37' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md &amp;&amp; grep -q 'TIMELINE-03.*TIMELINE-04.*green' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md &amp;&amp; grep -q 'Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '^status: closed$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (status flipped)
    - `! grep -q '^status: planted$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (old status removed, no duplicates)
    - `grep -q '^closed_during: 37-spine-4-2-timeline-coverage-hardening$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (closing-phase key added; exact phase-dir name)
    - `grep -qE '^closed: 20[0-9]{2}-[0-9]{2}-[0-9]{2}$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (close-date key added with YYYY-MM-DD format)
    - `grep -c '^---$' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` outputs exactly `2` (frontmatter delimiters intact — one open, one close)
    - `grep -q '\*\*Closed:\*\*.*Phase 37' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (body breadcrumb starts with `**Closed:**` and names Phase 37)
    - `grep -q 'TIMELINE-03.*TIMELINE-04.*green' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (breadcrumb names the new tests by their N-tag identifiers)
    - `grep -q 'TIMELINE-01..TIMELINE-05 all satisfied' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (breadcrumb references the REQ-ID range that this phase closed)
    - `grep -q '## The Gap (one-line)' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (existing body section preserved)
    - `grep -q '## Why it might matter' .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` exits 0 (existing body section preserved — sanity-checks no accidental body deletion)
    - `grep -q 'Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (Plan 37-01 audit-doc closure-line still in place — verifies the doc-level traceability portion of REQ TIMELINE-05)
  </acceptance_criteria>
  <done>
SEED-005 frontmatter now has `status: closed` (replacing `status: planted`), `closed_during: 37-spine-4-2-timeline-coverage-hardening`, and `closed: <YYYY-MM-DD>` (the date Plan 37-03 closed). The body has a one-paragraph `**Closed:**` breadcrumb immediately after the H1 referencing Phase 37, the satisfied REQs (TIMELINE-01..TIMELINE-05), the audit doc items 6 + 7, the fixture, and both new tests by name. Existing body sections (`## The Gap (one-line)`, `## Why it might matter`, `## Why we deferred today (2026-05-08)`, `## What it would take to investigate (sketch)`, `## Pointers`, `## Open question`) are untouched. Audit doc still has the Item 5 closure-line from Plan 37-01 in the "Items deferred (unchanged)" block — full closure traceability is intact across both files.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No trust boundaries crossed. This plan adds one test block to `tests/core/sampler.spec.ts` (using an existing runtime dependency `@esotericsoftware/spine-core`) and updates a seed file's frontmatter + adds a body paragraph. No production source (`src/`) is touched. No user input, no network, no auth.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-37-03 | N/A | tests/core/sampler.spec.ts + .planning/seeds/SEED-005-*.md | accept | No production surface; threats N/A for test + planning-doc-only changes. Mitigation: code review covers the test addition (RGBA2Timeline import + injection pattern verified against Animation.js:951-1010 in Task 1 read_first) and the seed status flip (precedent: SEED-007 closed 2026-05-13 with identical three-key pattern). |
</threat_model>

<verification>
1. `grep` gates in Task 1 `<acceptance_criteria>` confirm RGBA2Timeline import added once, TIMELINE-04 block inserted once, injection pattern present (`new RGBA2Timeline(2, 0, slotIndex)` + `pathAnimation!.timelines.push(rgba2)`), strict per-record equality assertions present, no epsilon-tolerant comparisons added.
2. `npm test -- tests/core/sampler.spec.ts` exits 0 — full sampler test suite green: existing N1.x / N2.x + TIMELINE-03 (from 37-02) + new TIMELINE-04.
3. `grep` gates in Task 2 `<acceptance_criteria>` confirm SEED-005 frontmatter flipped (`status: closed`, no `status: planted` remnant, `closed_during` + `closed` keys added with valid date format), body breadcrumb naming Phase 37 + the REQ range + the two tests by N-tag identifier inserted between H1 and `## The Gap (one-line)`, existing body sections preserved.
4. Cross-file traceability check: audit-doc Item 5 closure-line (added by Plan 37-01) still present — confirms the doc-level "items 5/6/7 closed" portion of REQ TIMELINE-05 is intact alongside the seed flip.
</verification>

<success_criteria>
- REQ TIMELINE-04 satisfied: synthetic RGBA2Timeline injection test asserts identical `globalPeaks` Map (size + every key + every numeric field per-record) between baseline and injected sampler runs over the same animation. Strict `.toBe()` per CONTEXT.md DC-01.
- REQ TIMELINE-05 satisfied: SEED-005 frontmatter `status:` flipped from `planted` to `closed` with `closed_during` + `closed` keys following SEED-007 precedent; body has a closure breadcrumb naming Phase 37 + the REQ range + the test names; audit-doc items-deferred block already updated by Plan 37-01 still in place (cross-file traceability intact).
- No `src/core/` files touched. Sampler production code unchanged.
- All existing sampler tests + TIMELINE-03 (from Plan 37-02) + new TIMELINE-04 all green.
</success_criteria>

<output>
After completion, create `.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-03-SUMMARY.md` per the standard summary template, capturing:
- TIMELINE-04 test name + injection pattern (frameCount, slotIndex resolution path, animation target, assertion shape)
- SEED-005 frontmatter diff (the three changes — status flip + 2 added keys) + the body breadcrumb text used
- Confirmation that the audit-doc Item 5 closure line from Plan 37-01 is still in place
- Final test counts: existing sampler tests + TIMELINE-03 + TIMELINE-04, all green
- Phase 37 closure-summary: 5/5 REQs satisfied (TIMELINE-01 through TIMELINE-05)
</output>
