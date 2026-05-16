---
artifact: owner-export-spec
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
audience: project owner (Spine editor operator)
created: 2026-05-16
status: action-required (off the critical path; due BEFORE the milestone reaches Phase 44)
---

# 42-OWNER-EXPORT-SPEC — Spine fixture export handoff (one session)

> **You can do this whenever convenient — it does NOT block code work.** Phases
> 42 -> 43 proceed in parallel while you export. But it **MUST be done before
> the milestone reaches Phase 44**, because Phase 44's dual-runtime oracle and
> Phase 46's slider closed-form oracle have no ground truth without these
> fixtures. A CI guard (`tests/safe01/phase44-fixture-guard.spec.ts`) is
> SKIPPED while we are in Phase 42/43 and will **hard-fail CI at Phase 44** if
> `fixtures/SIMPLE_PROJECT_43/` and `fixtures/SLIDER_4_3/` are still absent.

## 0. Why this exists (plain English)

The v1.6 milestone teaches the app to read **Spine 4.3** skeletons (today it
only reads 4.2). To prove the 4.3 math is correct we need a handful of small
test rigs **you** export from the Spine editor — the app cannot generate them.
This document is self-contained: everything needed to export all 5 artifacts
(4 rigs) in **one Spine session** is here. No back-and-forth required.

## 1. What to export — 4 rigs, 5 artifacts, one session (D-01, D-02)

| # | Rig | What it is | Export as | Destination dir |
|---|-----|------------|-----------|-----------------|
| 1+2 | **ORCL-01** | A `SIMPLE_TEST`-equivalent rig, **non-IK by design** (see §2) | **Version 4.3** AND **Version 4.2** (TWO exports, same rig) | `fixtures/SIMPLE_PROJECT_43/` (both JSONs in this one dir) |
| 3 | **SLIDER-01** | A minimal slider rig (see §3 for the EXACT parameters) | **Version 4.3** | `fixtures/SLIDER_4_3/` |
| 4 | **XTRA-01** | A 4.3 transform-constraint multi-map rig (see §4) | **Version 4.3** | `fixtures/XTRA01_4_3/` |
| 5 | **XTRA-02** | A 4.3 IK `scaleYMode` rig (see §5) | **Version 4.3** | `fixtures/XTRA02_4_3/` |

That is **5 export artifacts** (ORCL-01 is exported twice — once as 4.3, once
as 4.2 — for the cross-runtime equivalence oracle), across **4 rigs**.

**Directory-naming rule (do NOT deviate — the CI guard checks these exact
names):** the new dirs are `fixtures/SIMPLE_PROJECT_43/`, `fixtures/SLIDER_4_3/`,
`fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`. These must **NOT collide** with
the existing `fixtures/SPINE_4_3_TEST/` or `fixtures/test_4.3/` (those are the
Phase-32 4.3-reject canaries — different purpose, do not reuse them) nor with
the existing 4.2 `fixtures/SIMPLE_PROJECT/`.

## 2. ORCL-01 — the cross-runtime equivalence oracle (D-02, D-03)

**Design it to mirror today's `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`:** a
few bones, a couple of region attachments, and crucially **a
`TransformConstraint`** (today's `SIMPLE_TEST` has a `TransformConstraint` on
`SQUARE` — that constraint is the `appliedPose` correctness canary; reproduce
that idea).

**ORCL-01 MUST be non-IK by design — TransformConstraint-only, ZERO IK
constraints.** This is load-bearing, not a stylistic preference:

- ORCL-01 is exported BOTH as 4.3 and as 4.2 so we can assert the two runtimes
  compute identical peak scales for the same rig.
- The 4.2 export is produced by the 4.3 editor's **"Re-export as Version 4.2"**
  downgrade workflow.
- Spine editor bug **#891** (`https://github.com/EsotericSoftware/spine-editor/issues/891`)
  scrambles **IK** constraints on the 4.3 -> 4.2 downgrade. By making ORCL-01
  **non-IK** (TransformConstraint-only) the rig is **immune to #891** — the
  4.3 and 4.2 exports stay genuinely equivalent, so the oracle is sound.
- Full 4.3 IK coverage is NOT lost — it lives in **XTRA-02** (§5), which is
  **4.3-only** (never downgraded -> #891 cannot apply to it).

Net: keep ORCL-01 free of IK constraints. A `TransformConstraint` (and other
non-IK constraints) is exactly what we want.

**Export both versions into the SAME dir** `fixtures/SIMPLE_PROJECT_43/`:
- the 4.3 export (e.g. `ORCL_01.json` + `.atlas` + page PNG)
- the 4.2 export (e.g. `ORCL_01_42.json` + `.atlas` + page PNG)

(Give the two JSONs clearly distinct filenames so they don't overwrite. The
exact filenames are your choice — only the directory name is locked.)

## 3. SLIDER-01 — the analytically-derivable slider rig (D-02)

A **minimal** rig whose peak is computable by hand so Phase 46 has exact ground
truth. Build it with these **EXACT parameters** (so the closed-form peak is
unambiguous):

- One bone named **`slider_bone`**, child of `root`, at setup-pose local
  position **x = 0**.
- One **region attachment** on a slot bound to `slider_bone` (any 1x1-ish
  square region is fine — it just needs to exist so there is something to
  measure).
- One **slider** named **`drive`** wired to drive **`slider_bone`'s local
  X translation only** (no rotation, no scale, no other targets).
- Slider range: **min = 0, max = 100** (slider units).
- One animation named **`slide`**, duration **1.0 second**, with the slider
  `drive` keyed: **value 0 at time 0.0 s**, **value 100 at time 1.0 s**,
  **linear interpolation** (no curve / no stepped).
- Map the slider so **slider value 100 -> `slider_bone` local X = +200**
  (i.e. a linear 1:2 map; X = 2 * sliderValue). If the editor's slider->bone
  mapping UI does not let you set the gain directly, instead key
  `slider_bone` local X **0 -> 200 over the same 0.0 -> 1.0 s window** and
  document the actual numbers you used in a `NOTES.txt` beside the export.

**Resulting closed-form ground truth** (record this — Phase 46 verifies
against it): with the above, the peak local X of `slider_bone` over the
animation is **+200** at t = 1.0 s; with no parent scale and no other
transforms the peak world translation contribution is the linear ramp
`x(t) = 200 * t`, peaking at **200** at t = 1.0 s. If you had to use different
numbers, write the actual min/max/gain/keyed-window/peak into the `NOTES.txt`
so the exact closed form is unambiguous.

Export as **Version 4.3** into `fixtures/SLIDER_4_3/`.

## 4. XTRA-01 — 4.3 transform-constraint multi-map rig (D-02)

A 4.3-only rig exercising a `TransformConstraint` where **one source property
drives multiple, differently-typed target properties**, with **local<->world**
and a **clamp/mix** in play:

- A source bone whose rotation (or X translation) is the single driver.
- A `TransformConstraint` mapping that one source property into **at least
  two different target property kinds** on a target bone — e.g. target
  rotation AND target X-scale (differently-typed targets), at least one
  configured **local** and one **world**, with a non-trivial **mix** (not
  1.0) and a **clamped** range if the editor exposes one.
- One short animation that sweeps the source property through its range so the
  multi-map and the clamp are both exercised.

Export as **Version 4.3** into `fixtures/XTRA01_4_3/`.

## 5. XTRA-02 — 4.3 IK scaleYMode rig (D-02)

A 4.3-**only** rig (never downgraded -> #891-immune) exercising the new 4.3
IK `scaleYMode`:

- A 2+ bone IK chain with an IK constraint and an IK target.
- Configure the IK constraint's **`scaleYMode`** and produce variants/poses
  that exercise **`Uniform`** and **`Volume`**. (Default `None` is already
  confirmed 4.2-equivalent and does not need a dedicated rig — focus on
  `Uniform` + `Volume`.)
- One short animation that bends the chain so the scaleYMode behaviour is
  visible in the sampled output.

Export as **Version 4.3** into `fixtures/XTRA02_4_3/`. This rig is **4.3-only**
on purpose: it is never run through the 4.3 -> 4.2 downgrade, so spine-editor
**#891** (the IK-scramble-on-downgrade bug) cannot affect it.

## 6. Artifact set per rig (D-04) — atlas-source only

For **every** rig export the **atlas-source** set: the `.json` skeleton + its
`.atlas` + the page PNG(s). **No atlas-less (`images/`-folder) variant is
needed** — the sampler math is loaderMode-invariant by construction (atlas-less
only changes input plumbing, never the world math), and atlas-less parity is
already regression-covered by the existing 4.2 fixtures. So: **atlas-source
only**, every rig.

## 7. Redistributability (D-05) — your own assets only

Every rig MUST be **your own original asset**, committed in-repo and freely
**redistributable**. Do **NOT** export a licensed or third-party rig (no
purchased/clientg art, nothing from a licensed pack). These fixtures ship in
the public repo, so they must be redistributable with no attribution strings
attached. Simple primitive shapes (squares/circles, like `SIMPLE_TEST`) are
ideal and sufficient.

## 8. Destination directory table (locked — CI guard checks these)

| Rig | Export version(s) | Directory |
|-----|-------------------|-----------|
| ORCL-01 | **Version 4.3** + **Version 4.2** | `fixtures/SIMPLE_PROJECT_43/` |
| SLIDER-01 | **Version 4.3** | `fixtures/SLIDER_4_3/` |
| XTRA-01 | **Version 4.3** | `fixtures/XTRA01_4_3/` |
| XTRA-02 | **Version 4.3** | `fixtures/XTRA02_4_3/` |

`tests/safe01/phase44-fixture-guard.spec.ts` hard-fails CI at Phase 44 if
`fixtures/SIMPLE_PROJECT_43/` **or** `fixtures/SLIDER_4_3/` is still absent —
so finish this export before the milestone reaches Phase 44. (XTRA-01/XTRA-02
are needed by Phase 44/46 too; export all four in the one session so it is
done.)

## 9. One-session checklist

- [ ] ORCL-01 built non-IK (TransformConstraint, no IK) -> exported **Version 4.3** -> `fixtures/SIMPLE_PROJECT_43/`
- [ ] ORCL-01 same rig -> "Re-export as **Version 4.2**" -> `fixtures/SIMPLE_PROJECT_43/` (distinct filename)
- [ ] SLIDER-01 built to the §3 exact parameters (+ `NOTES.txt` if numbers differ) -> **Version 4.3** -> `fixtures/SLIDER_4_3/`
- [ ] XTRA-01 4.3 transform-constraint multi-map -> **Version 4.3** -> `fixtures/XTRA01_4_3/`
- [ ] XTRA-02 4.3 IK scaleYMode (Uniform + Volume) -> **Version 4.3** -> `fixtures/XTRA02_4_3/`
- [ ] Every export is atlas-source (`.json` + `.atlas` + page PNG); no atlas-less variant
- [ ] Every rig is your own redistributable asset (no licensed/third-party art)
- [ ] Commit the new `fixtures/...` dirs to the repo
