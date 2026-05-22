# Phase 48: Core Scale-Bake Module + Regression Oracle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 48-core-scale-bake-module-regression-oracle
**Areas discussed:** CI fixture matrix, Channel-proof depth, Scale-range policy, Unknown-construct handling

---

## CI Fixture Matrix — Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Redistributables + authored gap-fillers | Tracked real rigs for breadth + small authored synthetic fixtures only for in-repo gaps | ✓ |
| All synthetic, purpose-built | A tight set of minimal synthetic fixtures, one per coverage dimension | |
| Trim + commit a proprietary rig | Strip DEMON + a deform-heavy 4.2 rig to committable size | |

**User's choice:** Redistributables + authored gap-fillers — *then* upgraded mid-discussion (see below).
**Notes:** Discovery that drove this: the roadmap-named oracle rigs (DEMON / MON_FILES-TEST_01 /
3Queens / Girl) are all gitignored or untracked proprietary data (174M–465M) and cannot run in CI.
The oracle needs no golden values (it regenerates its reference side live via `SkeletonJson.scale=s`),
so authored fixtures are unusually low-risk.

## CI Fixture Matrix — Gap-filler production

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone committed fixtures | Real `.json` (+ minimal `.atlas`) under `fixtures/`, committed; reusable downstream | ✓ |
| Synthetic injection at test time | Inject missing constructs into tracked rigs in-test (Phase 37 / 46 precedent) | |
| You decide per gap | Let researcher/planner choose per construct | |

**User's choice:** Standalone committed fixtures.
**Notes:** Reusable by the Phase 49–51 export tests, more legible/reviewable.

## CI Fixture Matrix — Real-rig upgrade (free-text, supersedes synthetic-first plan)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep synthetic-only gap-fillers | Author synthetic stand-ins for all 4.3/deform/path gaps | |
| Make DEMON + TEST_01 public (JSON+atlas only) | Commit the real spike-validated rigs minus PNGs | ✓ |

**User's choice (free text):** "DEMON rig can be a public fixture" → then, on confirming TEST_01
fills the deform-heavy + PATH gap: "If so, let's use it then."
**Notes:** DEMON (`SKINS_SPINE_V02.json` 4.3.02; transform+ik+physics+slider+mesh; **0 deform, no
path**) anchors 4.3. TEST_01 (`MON_FILES/EXPORT/TEST_01/4.2`; 4.2.43; transform×15 ik×8 path×14
physics×51; **deform×18**) anchors the deform-heavy 4.2 all-four-constraint slot — defeats the
"DEMON has zero deform → false confidence" trap. Both committed JSON+atlas ONLY (PNGs excluded:
DEMON 107M, TEST_01 4M; the math/oracle never decode PNGs). Synthetic gap-fillers now reduced to
only the residual (4.3 PATH; path length-mode timeline if TEST_01 lacks it).

---

## Channel-proof depth

| Option | Description | Selected |
|--------|-------------|----------|
| Fix-and-verify ALL three | Each channel (IK softness curve, PATH length-mode timeline, slider remap slope) gets an in-repo fixture the oracle gates on | ✓ |
| Verify the two named; trust slider remap | Fixture the two roadmap-named channels; implement slider remap from source, document un-fixtured | |
| Fix-and-trust all | Implement from source; gate only on what existing rigs happen to exercise | |

**User's choice:** Fix-and-verify ALL three.
**Notes:** Tracked spineboy_4.3 already exercises IK softness timelines (16 keys). Oracle catches
over- and under-scaling by construction (covers the must-stay-unscaled `mix`/deform-curve negatives).

## Scale-range policy

| Option | Description | Selected |
|--------|-------------|----------|
| Core stays general; reject only degenerate s | Direction-agnostic for finite s>0; reject s≤0/NaN/∞; down-only at the export edge | ✓ |
| Core enforces down-only (0<s≤1) | Bake throws for s>1 | |
| Pure transform, zero validation | No input checks at all | |

**User's choice:** Core stays general; reject only degenerate s.
**Notes:** Keeps core single-responsibility + testable; product down-only rule lives in phases 49–50.

## Unknown-construct handling

| Option | Description | Selected |
|--------|-------------|----------|
| Assert-known: throw a typed error | Unrecognized type discriminator → typed throw; loud testable failure | ✓ |
| Silent passthrough | Leave unrecognized constructs untouched (spike behavior) | |
| Warn-and-passthrough | Log a warning but continue | |

**User's choice:** Assert-known: throw a typed error.
**Notes:** Complements the oracle — oracle proves covered constructs, guard prevents silent
corruption on uncovered/unknown ones. Asserts only type discriminators, not every field.

---

## Claude's Discretion

- Module file name / exported function signature; internal helper structure; typed-error class
  name/shape; exactly which scale factors the CI oracle iterates (≥1 non-round factor advised).
- Whether residual synthetic gap-fillers are needed (depends on researcher's coverage confirmation
  of DEMON + TEST_01 + redistributables for the 4.3 PATH constraint and PATH-timeline channels).

## Deferred Ideas

- Upscaling (`s > 1`) as a user-facing feature (math supports it; v1.7 is down-only).
- Per-attachment override sharing across scales (roadmap-deferred beyond Phase 49).
- `3Queens` / `Girl` proprietary rigs as public fixtures (not needed once TEST_01 anchors 4.2).
