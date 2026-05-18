---
artifact: owner-export-spec
phase: 46-slider-constraint-validation-4-3-performance-budget
audience: project owner (Spine editor operator)
created: 2026-05-18
status: action-required (Action (a) DONE; Action (b) the only remaining owner step — blocks the SLIDER-02 D-05 triangulation arm)
---

# 46-OWNER-EXPORT-SPEC — Spine 4.3 slider editor-read handoff (one short session)

> **One short Spine-editor session.** Action (a) is already complete and is
> recorded here only for the paper trail. **Action (b)** — authoring
> `fixtures/SLIDER_4_3/NOTES.txt` from one editor read — is the **only**
> remaining owner step. It does **NOT** block code work, but the SLIDER-02
> closed-form test's D-05 triangulation arm **hard-fails (throws)** until
> `fixtures/SLIDER_4_3/NOTES.txt` exists with a parseable slider scale value
> (it is committed by *this* phase per D-03, so its absence is a
> verification-integrity failure — **not** a Wave-0 skip).

## 0. Why this exists

The v1.6 Spine 4.3 runtime port needs **one editor-observed number the app
cannot compute for itself**: the value Esoteric's own reference runtime (the
Spine 4.3 editor) produces when it resolves the SLIDER-01 slider into a bone
world scale. Recorded beside the already-committed slider rig, that number lets
the SLIDER-02 closed-form test **triangulate three fully independent sources**:

1. **hand-math** — a literal derived by hand from the spine-core@4.3.0
   `Slider.update()` source, written verbatim in the test as a comment;
2. **the editor** — Esoteric's own reference runtime, read by you into
   `fixtures/SLIDER_4_3/NOTES.txt` (Action (b) below);
3. **our runtime** — the sampled `globalPeaks` peak from our dual-runtime path.

If all three agree, the 4.3 slider is proven to propagate correctly through
the **unchanged** `updateWorldTransform('update')` path with **zero**
slider-specific code in our `src/core/` (the absence of slider code IS the
SLIDER-02 deliverable).

**Action (a) is already complete** (the PERF-01 `spineboy-pro` rig was
version-aligned and verified on 2026-05-18) and is recorded below only so the
paper trail is self-contained. **Action (b) is the only remaining owner work.**
It does **not** block code work — but the SLIDER-02 test's D-05 triangulation
arm hard-fails (throws) until `fixtures/SLIDER_4_3/NOTES.txt` exists and
contains a parseable slider scale value.

> **Note on the stale Phase-42 spec.** `42-OWNER-EXPORT-SPEC.md` §3 recorded an
> idealized SLIDER-01 ground truth describing a 1:2 linear
> slider→X-translation map peaking at a translation of two-hundred units (an
> "x equals two-hundred-times-t" linear ramp). **That §3 ground truth is
> STALE (D-02) and MUST NOT be carried forward as truth here.** The committed
> `fixtures/SLIDER_4_3/SLIDER-01.json` rig (D-01, used AS-IS, no re-export)
> instead drives a self-referential slider→`scale`-animation feedback whose
> real closed form is **world scale 4.0**, not a translation of two-hundred.
> The Phase-42 §3 spec was consulted for document *structure only*; its
> numbers are explicitly flagged stale and are never carried forward.

## What this covers

| # | Artifact | What it is | Owner action | Status |
|---|----------|------------|--------------|--------|
| (a) | `fixtures/spineboy_4.3/spineboy-pro.{json,atlas,png}` | the PERF-01 complex 4.3 rig | version-align re-export at the 4.3.0x editor build | **DONE 2026-05-18 — PASSED, no action remaining** |
| (b) | `fixtures/SLIDER_4_3/NOTES.txt` | editor-observed `slider_bone` world scale | open SLIDER-01 in the Spine 4.3 editor, read `slider_bone` world scale at `slide` t = 1.0 s, record one line | **ACTION REQUIRED** |

## Action (a) — spineboy-pro version-align (ALREADY DONE; recorded for the paper trail)

- **Artifact:** `fixtures/spineboy_4.3/spineboy-pro.{json,atlas,png}`.
- **The action (already performed):** re-export `spineboy-pro` at the
  `4.3.0x` editor build. The first delivery carried `spine: "4.3.75-beta"`, an
  outlier vs the pinned `@esotericsoftware/spine-core@4.3.0` runtime; the
  re-export aligns the rig onto the exact `4.3.0x` parse path Phase-44 ORCL-02
  already proved correct.
- **Acceptance — ALL VERIFIED & PASSED 2026-05-18:**
  - `skeleton.spine == 4.3.01` (no `-beta`).
  - Structure preserved identically: **67 bones / 52 slots / 11 animations /
    1 skin / 14 constraints**.
  - The `.json` + `.atlas` + page PNG triple is committable / **NOT
    gitignored** (CI-enforceable).
- **State:** no owner action remaining. This section-spec records Action (a)
  as already-accepted. It dissolves the D-11 false-green-budget risk **by
  construction** — the rig now rides the exact `4.3.0x` parse path Phase-44
  ORCL-02 already proved correct (D-11 resolved-by-construction; no
  parse-fidelity investigation is performed).

## Action (b) — fixtures/SLIDER_4_3/NOTES.txt (the only remaining owner step)

- **Artifact:** `fixtures/SLIDER_4_3/NOTES.txt` (new file, in the same
  directory as the already-committed `SLIDER-01.json`/`.atlas`/`.png`).
- **Steps:**
  1. Open the **SLIDER-01** rig in the **Spine 4.3 editor** (the rig committed
     at `fixtures/SLIDER_4_3/SLIDER-01.json`, or its source `.spine` project).
  2. Select and **play** the **`slide`** animation.
  3. **Scrub to its end frame:** time = **1.0 s** (frame 30 at the editor's
     default 30 fps dopesheet — note: the dopesheet fps is editor-display
     metadata only and has **zero runtime effect** (CLAUDE.md Fact 1); the
     runtime time that matters is the **1.0 s**).
  4. Read the editor's **transform readout** for the bone **`slider_bone`** —
     specifically its **world scaleX** and **world scaleY** at that frame.
     Expected ≈ **4.0** each.
  5. Create `fixtures/SLIDER_4_3/NOTES.txt` recording:
     - the **animation observed**: `slide`;
     - the **peak time**: t = 1.0 s (frame 30 @ 30 fps dopesheet);
     - the **source property at peak**: `slider_bone` local X = 200;
     - the **observed `slider_bone` world scaleX and world scaleY** (THIS is
       the number the SLIDER-02 D-05 arm parses);
     - a **units note**: world scale is a dimensionless multiplier; local X is
       in skeleton units.
- **Suggested exact machine-extractable line** (paste this verbatim so the
  test parser is trivial and robust):

  ```
  slider_bone world scaleX = 4.000, scaleY = 4.000 at slide t=1.0s (slider_bone.x=200)
  ```

  Free-text around that line is fine (this mirrors `42-OWNER-EXPORT-SPEC.md`
  §3's "document the actual numbers ... in a `NOTES.txt`"), but the **scaleX
  numeric value MUST be present and parseable**. If the editor shows
  materially different numbers, write the **actual observed values** — but the
  expected is ≈ 4.0; a value far from 4.0 means re-check the
  animation/frame, or surface it so the closed form can be reconciled.
- **Acceptance:** `fixtures/SLIDER_4_3/NOTES.txt` exists, contains a parseable
  numeric scaleX value, and that value agrees with the hand-derived **`4.0`**
  within **`1e-2`**. The SLIDER-02 test enforces this — it **loud-fails
  (throws)** if the file is absent or the number is unparseable. This is
  **NOT a Wave-0 skip**: Phase 46 commits the file per **D-03**, so its
  absence is a verification-integrity failure.

## Why the editor read matters (D-05 triangulation)

The SLIDER-02 test already asserts, **directly in code**, that the
**hand-derived literal `4.0`** (source-cited from the `@esotericsoftware/
spine-core@4.3.0` `Slider.update()` formula, with the full derivation written
verbatim in a test comment) equals the **sampled `globalPeaks` peak from our
own runtime**. Those are two of the three legs.

The owner's editor read is the **independent third leg** — *Esoteric's own
reference runtime's* answer for the very same rig. Recording it into
`fixtures/SLIDER_4_3/NOTES.txt` makes the triangulation a **machine-checked
three-way agreement** (hand-math ≡ editor ≡ our runtime) rather than a prose
claim. If all three agree, the 4.3 slider is proven to propagate correctly
with **zero** slider-specific code in our `src/core/` — the SLIDER-02 SC#2
deliverable.

## One-session checklist

- [x] Action (a): spineboy-pro version-aligned to spine 4.3.01 (DONE
  2026-05-18 — token + 67/52/11/14 structure verified, committable)
- [ ] Action (b): open SLIDER-01 in the Spine 4.3 editor, play `slide`, scrub
  to t = 1.0 s, read `slider_bone` world scaleX/scaleY (≈ 4.0)
- [ ] Write `fixtures/SLIDER_4_3/NOTES.txt` with the suggested
  machine-extractable line
- [ ] Commit `fixtures/SLIDER_4_3/NOTES.txt`
