# Phase 43: Runtime-Adapter Facade + Verified 4.3 API Mapping - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 43-runtime-adapter-facade-verified-4-3-api-mapping
**Areas discussed:** 4.3 evidence bar, Loader scope, Wrong-pose-read defense posture, Phase-43 exit-gate rigor

---

## 4.3 evidence bar (Phase 43 vs Phase 44)

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke + unit, defer correctness | Structural smoke through `fixtures/SPINE_4_3_TEST` + API-shape units; 1e-4 correctness = Phase 44 | |
| Add a synthetic 4.3 unit fixture | Above + a hand-authored synthetic 4.3 constraint fixture for interim appliedPose units | |
| Pull owner export forward | Block Phase 43 on the owner Spine-editor 4.3 export | |
| **Free-text (premise superseded)** | User had **already exported** the real Simple Project rig as 4.3 | ✓ |

**User's choice:** Free-text — *"spine 4.3 TEST seems to have an empty atlas. I exported Simple Project to 4.3 version to .../fixtures/SIMPLE_PROJECT_TEST_4_3"*
**Notes:** Investigation confirmed `SPINE_4_3_TEST` is a 1×1-atlas Phase-32 parser-reject canary (user correct — unusable for sampling). The new export is a genuine `spine 4.3.01` rig with a `TransformConstraint` (appliedPose canary) and `rotate:90` regions (PORT-03), committable. Resolution (CONTEXT D-01/D-05): folder renamed by user to the Phase-42-locked `fixtures/SIMPLE_PROJECT_43/`; user then also exported the same-session **4.2 sibling** (`skeleton2_42.json`, same hash `mFDzgNETPHo`, non-IK, #891-immune). Phase 43 samples the 4.3 file + captures its **own** 4.3 baseline (NOT golden-shared with 4.2, ARCHITECTURE §2); SAFE-02 (4.2 byte-equal) remains the only HARD exit gate; cross-runtime 1e-4 proof stays Phase 44. The `SIMPLE_PROJECT_43` pair is **excluded** from the SAFE-02 frozen set (it postdates the Phase-42 baseline). User confirmed "yes to (3)".

---

## Loader scope at the 43/44 boundary

| Option | Description | Selected |
|--------|-------------|----------|
| **Full parse-relocation, hard-pick 4.2** | Move loader's SkeletonJson/TextureAtlas/AtlasAttachmentLoader + Phase-33 rotated-region into `runtime-42.ts`; loader hard-picks `pickRuntime('4.2')` (no version detection — Phase 44) | ✓ |
| Minimal: sampler/bounds only | Rewire only sampler.ts + bounds.ts; loader keeps its direct import this phase | |
| Let research/planner decide | Delegate the boundary | |

**User's choice:** Full parse-relocation, hard-pick 4.2
**Notes:** SAFE-02 then byte-gates the entire 4.2 path including parse/atlas/rotated-region through the adapter — the maximal behavior-neutrality surface, which is the point of the gate. (CONTEXT D-02.)

---

## Wrong-pose-read defense posture (the existential failure mode)

| Option | Description | Selected |
|--------|-------------|----------|
| **Structural defense-in-depth** | `runtime-43.ts` exposes only `appliedPose`-derived reads (no raw `pose` path) + dev-mode assertion | ✓ |
| Research-specified minimal | `appliedPose`-only + "WHY appliedPose" comment; rely on Phase-44 oracle canary | |

**User's choice:** Structural defense-in-depth
**Notes:** Closes Pitfall 2 ("the existential failure mode" — pre-constraint read compiles fine, silently undersizes) inside Phase 43 rather than after the Phase-44 oracle exists. The user's most-emphasized correctness lever. (CONTEXT D-03.)

---

## Phase-43 exit-gate rigor on heavy/proprietary rigs

| Option | Description | Selected |
|--------|-------------|----------|
| **Require documented local heavy-rig pass** | Phase 43 cannot close until SAFE-02 is run locally vs the gitignored heavy rigs with a documented result; CI-subset green is necessary but not sufficient | ✓ |
| CI-subset green is sufficient | Close on CI-green over the redistributable subset (Phase-42 D-08-R precedent) | |

**User's choice:** Require documented local heavy-rig pass
**Notes:** "Subtle drift hides exactly there" (Phase-42 D-08); Phase 43 *is* the behavior-neutrality proof. (CONTEXT D-04.)

---

## Claude's Discretion

Delegated per [[feedback_delegate_implementation_choices]]: SAFE-03 test mechanics; `runtime-42.ts` verbatim-relocation boundary + boundary-cast shape; `pickRuntime` sync `require` vs async (lean: sync); electron-vite worker chunk-split; fixture internal filenames (directory name locked). **Research flags** (researcher must source-confirm): `getOffsets(slot.pose)` + 4.3 rotated-region re-expression; the cross-runtime `instanceof` invariant design; the D-03 structural-defense shape vs the 4.3.0 `.d.ts`; the new-format-atlas-even-for-4.2 parser question (Phase-44-relevant).

## Deferred Ideas

- Remaining owner exports (user will add when able; off Phase-43 critical path): SLIDER-01 → `fixtures/SLIDER_4_3/`, XTRA-01 → `fixtures/XTRA01_4_3/`, XTRA-02 → `fixtures/XTRA02_4_3/`. ORCL-01 (4.3 + 4.2) is DONE.
- Phase 44/45/46/47 scope explicitly not pulled into Phase 43 (loader dispatch + `>=4.4` arm + `checkSpine43Schema` repurpose; reject-test inversions + copy sweep; 1e-4 oracle; slider closed-form + perf budget; spine-player bump).
- Commit of the new `fixtures/SIMPLE_PROJECT_43/` directory — folded into Phase 43/44 execution.
