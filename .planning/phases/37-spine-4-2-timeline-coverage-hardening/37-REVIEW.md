---
phase: 37-spine-4-2-timeline-coverage-hardening
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - tests/core/sampler.spec.ts
  - fixtures/INHERIT_TIMELINE/INHERIT_TEST.json
  - fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The two new test blocks (TIMELINE-03 InheritTimeline and TIMELINE-04 RGBA2Timeline geometry-invariance) appear functionally correct. I traced the fixture + sampler lifecycle and confirmed both assertions hold under the implemented sampler:

- TIMELINE-03: `peak(detached) > peak(baseline)` holds. Setup-pose pass yields `world ≈ 0.4` for both runs; BASELINE animation pass cannot exceed this (flat-line parent scale, no inherit timeline), so its globalPeak latches at 0.4. INHERIT_DETACH animation pass produces `world ≈ 1.0` at t=0.5 (inherit flipped to NoScale), so its globalPeak latches at 1.0. Margin ~0.6 vs `>` strict, comfortably above FP noise.
- TIMELINE-04: `RGBA2Timeline.apply` mutates only `slot.color` and `slot.darkColor`; the sampler reads only `slot.color.a` (visibility gate) and bone/attachment geometry. Color writes do not propagate into bounds or render-scale. Strict equality on every numeric peak field is the correct invariant.

Issues found are concentrated in:
1. A factual mismatch between the TIMELINE-03 docstring and the actual fixture (the docstring describes a 1.0→0.4→1.0 parent ramp, but the fixture has a flat 0.4 timeline plus 0.4 setup-pose scale on PARENT). This survives only because the underlying differential still holds.
2. Fixture integrity drift: `INHERIT_TEST.png` is the SIMPLE_TEST PNG copy (1839×1464, 42 KB) while `INHERIT_TEST.atlas` declares `size:128,128`.

No security or data-loss issues. No source code in `src/core/` is touched by this phase (per CONTEXT.md), so the only attack surface is test correctness + fixture integrity.

## Warnings

### WR-01: TIMELINE-03 test docstring contradicts the on-disk fixture

**File:** `tests/core/sampler.spec.ts:310-334`
**Issue:** The TIMELINE-03 docstring claims the BASELINE animation has "parent scaleX/Y ramps 1.0 -> 0.4 -> 1.0" and that INHERIT_DETACH shares the "same parent shrink." It states the rationale as: "At t=0.5 (parent shrunk to 0.4), CHILD is detached -> CHILD's world scale remains ~1.0. Without detach it would be 0.4." This is wrong about how the rig works in the fixture:

- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json:14` sets PARENT's **setup-pose** `scaleX: 0.4, scaleY: 0.4` (already shrunk before any animation runs).
- BASELINE's PARENT scale timeline is `[{x:0.4, y:0.4}, {time:1.0, x:0.4, y:0.4}]` — a **flat line at 0.4**, not a 1.0→0.4→1.0 ramp.
- INHERIT_DETACH's PARENT scale timeline is identical (flat 0.4); the only animated mutation is the per-bone CHILD `inherit` timeline.

The assertion still passes because BASELINE's child world stays at ~0.4 throughout (setup + animation latch at 0.4) while INHERIT_DETACH's child reaches ~1.0 at the t=0.5 NoScale frame. But the docstring's "ramp" framing misrepresents what's actually being exercised. CONTEXT.md DC-02 explicitly prescribes a ramp shape ("parent `scaleX` / `scaleY` ramping from 1.0 → 0.4 → 1.0 over the animation duration"), so the fixture also drifts from the documented design intent.

Risk: future maintainers reading the docstring will wonder why the assertion holds (they'll look for the ramp, fail to find it, and either re-author the fixture or weaken the assertion). The differential remains valid but the documented chain of cause-and-effect is broken.

**Fix:** Either (a) rewrite the BASELINE/INHERIT_DETACH scale timelines in the fixture to match DC-02's ramp + setup-pose scale 1.0 on PARENT, or (b) rewrite the docstring at sampler.spec.ts:310-334 to describe the actual flat-0.4 fixture. The faster fix is (b):

```
//   - BASELINE:       parent scaleX/Y stays at 0.4 (matches setup pose); CHILD
//                     inherits Normal throughout. CHILD's world scale ≈ 0.4.
//   - INHERIT_DETACH: same flat parent scale + a per-bone "inherit" timeline on CHILD
//                     keying Inherit.Normal -> Inherit.NoScale -> Inherit.Normal at
//                     times 0.0 / 0.5 / 1.0. At t=0.5 CHILD detaches -> world scale
//                     jumps to ~1.0. With detach, peak > baseline (~1.0 vs ~0.4).
```

Option (a) is the more rigorous fix because DC-02 also specifies "rotation" on PARENT which the fixture omits entirely; revisiting the fixture closes both gaps.

### WR-02: INHERIT_TEST.png dimensions disagree with the atlas declaration

**File:** `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` (referenced by `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas:2`)
**Issue:** `INHERIT_TEST.atlas` declares `size:128,128` (line 2) and region `bounds:2,2,100,100` (line 5), but the on-disk PNG is **1839×1464** (8-bit/color RGBA, 42 KB) — appears to be a verbatim copy of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png`. While the sampler does not decode PNG bytes (CLAUDE.md fact #4), any downstream path that calls `readPngDims` on this fixture (e.g. atlas-less mode, or a future export-time round-trip check) would observe IHDR dims that contradict the atlas's declared page size and region bounds. The fixture is internally inconsistent.

This isn't a sampler-test bug today (atlas-source mode + sampler hot loop ignore PNG bytes), but it is a fixture-correctness defect that future tests will trip over.

**Fix:** Replace `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` with a real 128×128 image (or any image whose dimensions match the atlas declaration). Simplest: a 128×128 single-color PNG. Even a 1×1 PNG paired with an atlas `size:1,1` line would be smaller and more honest. Drop the 42 KB SIMPLE_TEST copy.

## Info

### IN-01: TIMELINE-03 reaches into globalPeaks via attachment-name probe (skin-agnostic) when the fixture has only one skin

**File:** `tests/core/sampler.spec.ts:346-351`
**Issue:** The lookups use `[...peaks.values()].find((r) => r.attachmentName === 'REGION')` without filtering on skin or slot. The fixture has only the default skin and one slot/attachment, so this is unambiguous today. But CONTEXT.md DC-02 leaves the door open to add a mesh-attachment variant later (deferred), and a future fixture growth could create two REGION attachments (e.g. one in default skin, one in a variant skin), making the `.find` non-deterministic.

**Fix:** Narrow the lookup once more for forward-safety:

```ts
const baselineChild = [...baselinePeaks.values()].find(
  (r) => r.slotName === 'CHILD_SLOT' && r.attachmentName === 'REGION',
);
```

### IN-02: TIMELINE-04 hardcodes the SQUARE2 darkColor sanity check to SIMPLE_TEST.json line 87

**File:** `tests/core/sampler.spec.ts:404-408`
**Issue:** The error message references `SIMPLE_TEST.json:87` to point the reader at the `"dark": "ff0000"` field. If SIMPLE_TEST.json is ever re-formatted or a slot is reordered, the line number will be stale. Line numbers in error strings are a fragile coupling.

**Fix:** Reference the field by name rather than line:

```ts
'SQUARE2 must have a non-null darkColor (JSON `dark` field on the SQUARE2 slot in SIMPLE_TEST.json)',
```

### IN-03: TIMELINE-04 compares only a subset of PeakRecord fields per record

**File:** `tests/core/sampler.spec.ts:431-446`
**Issue:** The per-record loop asserts equality on `peakScale`, `peakScaleX`, `peakScaleY`, `worldW`, `worldH`, `time`, `animationName`, `attachmentName` — but omits `peakScale`-adjacent fields that are also in PeakRecord and *could* drift under a hypothetical bug: `frame`, `regionName`, `sourceW`, `sourceH`, `isSetupPosePeak`, `attachmentKey`, `slotName`, `skinName`, `isSequenceFrame`. CONTEXT.md DC-01 explicitly calls for "Strict deep-equal on `summary.globalPeaks` Map (key + full PeakRecord) … No epsilon tolerance." The current loop is "deep-equal on a hand-picked subset of fields," which is one short of the locked invariant.

**Fix:** Use `expect(ri).toEqual(recBaseline)` (or vitest's `.toStrictEqual`) inside the loop instead of field-by-field. Adds full-record coverage at no readability cost. Alternatively, just iterate the keys of `recBaseline` and assert each via bracket-indexing.

### IN-04: peaksForAnimation helper duplicated between TIMELINE-03 and the numeric-goldens describe block

**File:** `tests/core/sampler.spec.ts:335-341` and `tests/core/sampler.spec.ts:490-496`
**Issue:** TIMELINE-03 defines `peaksForAnimation` inline; the numeric-goldens describe block has an identical helper at line 490 (different fixture, but the body shape is verbatim: re-load, filter animations, return `globalPeaks`). Minor duplication; could be extracted to a module-private helper accepting `(fixturePath, animationName)`.

**Fix:** Extract once at file scope:

```ts
const peaksForOnlyAnimation = (
  fixturePath: string,
  animationName: string,
): Map<string, PeakRecord> => {
  const scoped = loadSkeleton(fixturePath);
  scoped.skeletonData.animations = scoped.skeletonData.animations.filter(
    (a) => a.name === animationName,
  );
  return sampleSkeleton(scoped).globalPeaks;
};
```

Low priority — neither call site is bug-prone today.

### IN-05: TIMELINE-04 docstring claims SIMPLE_TEST.json has only one slot with `dark` — verify before relying on the "only slot" framing

**File:** `tests/core/sampler.spec.ts:376-379`
**Issue:** The comment asserts: "SQUARE2 is the only slot in SIMPLE_TEST with `"dark": "ff0000"` (SIMPLE_TEST.json:87)." This is a load-bearing claim — if multiple slots have `dark`, the test's slot-pick rationale weakens (any of them would satisfy the invariant; the comment's "only" is then misleading). I didn't exhaustively grep SIMPLE_TEST.json for other `dark` fields, but the comment should either cite evidence (`grep '"dark"' SIMPLE_TEST.json` shows one hit) or soften the framing to "we use SQUARE2 because it has `dark` set; any slot with `dark` would also work."

**Fix:** Either drop the "only slot" claim or anchor it to a grep-verified count. Test still passes either way.

### IN-06: Unused `RGBA2Timeline` import becomes file-wide if the test is ever skipped/deleted

**File:** `tests/core/sampler.spec.ts:33`
**Issue:** `RGBA2Timeline` is imported at the top of the file. It's used only inside TIMELINE-04 (line 416). If the test is ever `.skip`'d or deleted, the import becomes dead. Not a problem today, but flagging because the existing import block at lines 30-39 is otherwise tightly scoped to first-party + vitest.

**Fix:** Leave as-is for now; if TIMELINE-04 is ever skipped, drop the import in the same commit. No action needed in this phase.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
