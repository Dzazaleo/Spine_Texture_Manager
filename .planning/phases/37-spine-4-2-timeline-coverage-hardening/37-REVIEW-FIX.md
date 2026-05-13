---
phase: 37-spine-4-2-timeline-coverage-hardening
fixed_at: 2026-05-13T00:00:00Z
review_path: .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 5
status: all_fixed
---

# Phase 37: Code Review Fix Report

**Fixed at:** 2026-05-13
**Source review:** `.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope (critical_warning): 2
- Fixed: 2
- Skipped (out of scope): 5
- Post-fix test status: `npm test` -> 99 files, 1079 passed / 2 skipped / 2 todo (pre-existing). No regressions.

## Fixed Issues

### WR-01: TIMELINE-03 test docstring contradicts the on-disk fixture

**Files modified:** `tests/core/sampler.spec.ts`
**Commit:** `1395052`
**Applied fix:** Rewrote the TIMELINE-03 docstring (lines 310-342) to describe the actual fixture: PARENT setup-pose scaleX/Y=0.4, BASELINE animation is a flat 0.4 scale timeline (not a 1.0->0.4->1.0 ramp), CHILD's world stays at ~0.4 in BASELINE and reaches ~1.0 only when INHERIT_DETACH flips the CHILD inherit timeline to NoScale at t=0.5. Added a "Why the differential holds" paragraph spelling out the setup-pose pass + animation pass latch behavior, matching the reviewer's summary in REVIEW.md.

This is option (b) from the reviewer's fix suggestion — the faster of the two options because the strict-`>` assertion was an intentional Rule 1 auto-fix during execution, so re-authoring the fixture would risk re-introducing the underlying problem the auto-fix solved.

Source code in `src/core/` is untouched. Verification:
- Tier 1: Re-read sampler.spec.ts:308-348 — new docstring text present and correctly anchored before the `peaksForAnimation` helper definition.
- Tier 2: `npx tsc --noEmit -p .` exited 0 — no TS errors introduced.
- Post-suite: `npm test` confirms TIMELINE-03 still passes (1079 total passing).

### WR-02: INHERIT_TEST.png dimensions disagree with the atlas declaration

**Files modified:** `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png`
**Commit:** `087ce63`
**Applied fix:** Replaced the on-disk PNG with a freshly generated 128x128 transparent RGBA PNG (165 bytes). The previous file was a 1839x1464 / 42 KB verbatim copy of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png`, contradicting `INHERIT_TEST.atlas` line 2 (`size:128,128`) and the REGION `bounds:2,2,100,100` declaration on line 5.

Generation method: `sharp({ create: { width: 128, height: 128, channels: 4, background: { r:0, g:0, b:0, alpha: 0 } } }).png().toFile(...)`. Sharp is already a project dependency (CLAUDE.md fact #4 references it for the Optimize Assets phase).

Sampler tests are unaffected because `TextureLoader` ignores PNG bytes per CLAUDE.md fact #4 — but any downstream consumer that reads PNG IHDR (atlas-less tests, export-time round-trip checks) will now observe dimensions that match the atlas declaration.

Verification:
- Tier 1: `file INHERIT_TEST.png` reports `PNG image data, 128 x 128, 8-bit/color RGBA, non-interlaced` — exactly matches the atlas declaration. Size dropped from 42007 -> 165 bytes.
- Tier 2: not applicable (binary PNG, no syntax checker for image data).
- Tier 3: Tier 1 accepted; verified by `file(1)` IHDR readout.
- Post-suite: `npm test` confirms 1079 tests still pass (sampler ignores PNG bytes per CLAUDE.md fact #4, so no test depends on the file's content).

## Skipped Issues

The following Info-severity findings are out of scope for this iteration per `fix_scope: critical_warning`. They are documented here for traceability and may be picked up in a future cleanup pass.

### IN-01: TIMELINE-03 reaches into globalPeaks via attachment-name probe (skin-agnostic) when the fixture has only one skin

**File:** `tests/core/sampler.spec.t.ts:346-351`
**Reason:** skipped: out of scope (fix_scope=critical_warning, severity=info)
**Original issue:** The `.find((r) => r.attachmentName === 'REGION')` lookup is unambiguous today because the fixture has only one skin / one attachment, but a future mesh-attachment variant could create two REGION entries and make the lookup non-deterministic. Reviewer's suggested forward-safety fix: also filter on `r.slotName === 'CHILD_SLOT'`.

### IN-02: TIMELINE-04 hardcodes the SQUARE2 darkColor sanity check to SIMPLE_TEST.json line 87

**File:** `tests/core/sampler.spec.ts:404-408`
**Reason:** skipped: out of scope (fix_scope=critical_warning, severity=info)
**Original issue:** The error message references `SIMPLE_TEST.json:87` for the `"dark": "ff0000"` field. If SIMPLE_TEST.json is reformatted or a slot is reordered, the line number will be stale. Reviewer's suggested fix: reference the field by name (`JSON 'dark' field on the SQUARE2 slot in SIMPLE_TEST.json`) instead of line number.

### IN-03: TIMELINE-04 compares only a subset of PeakRecord fields per record

**File:** `tests/core/sampler.spec.ts:431-446`
**Reason:** skipped: out of scope (fix_scope=critical_warning, severity=info)
**Original issue:** Per-record loop asserts equality on a hand-picked subset of PeakRecord fields (peakScale, peakScaleX, peakScaleY, worldW, worldH, time, animationName, attachmentName) but omits frame, regionName, sourceW, sourceH, isSetupPosePeak, attachmentKey, slotName, skinName, isSequenceFrame. CONTEXT.md DC-01 prescribes "strict deep-equal on the full PeakRecord." Reviewer's suggested fix: use `expect(ri).toEqual(recBaseline)` or `.toStrictEqual` inside the loop.

### IN-04: peaksForAnimation helper duplicated between TIMELINE-03 and the numeric-goldens describe block

**File:** `tests/core/sampler.spec.ts:335-341` and `tests/core/sampler.spec.ts:490-496`
**Reason:** skipped: out of scope (fix_scope=critical_warning, severity=info; reviewer flagged as low priority)
**Original issue:** TIMELINE-03 defines `peaksForAnimation` inline; the numeric-goldens describe block has an identical-body helper at line 490 (different fixture). Reviewer's suggested fix: extract once at file scope as `peaksForOnlyAnimation(fixturePath, animationName)`.

### IN-05: TIMELINE-04 docstring claims SIMPLE_TEST.json has only one slot with `dark` — verify before relying on the "only slot" framing

**File:** `tests/core/sampler.spec.ts:376-379`
**Reason:** skipped: out of scope (fix_scope=critical_warning, severity=info)
**Original issue:** Comment asserts "SQUARE2 is the only slot in SIMPLE_TEST with `'dark': 'ff0000'`" — load-bearing claim that should either cite a grep-verified count or soften to "any slot with `dark` would also work." Reviewer notes the test still passes either way.

### IN-06: Unused `RGBA2Timeline` import becomes file-wide if the test is ever skipped/deleted

**File:** `tests/core/sampler.spec.ts:33`
**Reason:** skipped: out of scope (fix_scope=critical_warning, severity=info; reviewer explicitly states "no action needed in this phase")
**Original issue:** `RGBA2Timeline` is imported at the top of the file and used only inside TIMELINE-04 (line 416). Not a problem today; flagged as a coupling note if TIMELINE-04 is ever `.skip`'d.

---

_Fixed: 2026-05-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
