# Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
**Areas discussed:** Owner fixture-export handoff, SAFE-01 baseline granularity, CI trigger model

Gray areas presented for selection (multiSelect): Owner fixture-export handoff ✓, SAFE-01 baseline granularity ✓, CI trigger model ✓, Phase-42 4.3 CI-slot strategy ✗ (not selected — resolved within the CI trigger discussion, see D-13).

---

## Owner fixture-export handoff

### Handoff timing
| Option | Description | Selected |
|--------|-------------|----------|
| Phase 42 produces it now | Emit committed OWNER-EXPORT-SPEC.md on Phase 42 landing; owner exports in parallel while code phases 42→43 run | ✓ |
| Defer entirely to Phase 44 | No handoff artifact in Phase 42; all fixture coordination inside Phase 44 | |
| Phase 42 spec, defer ask | Phase 42 authors the spec but formal ask raised at Phase 43/44 boundary | |

**User's choice:** Phase 42 produces it now.

### Export batch scope
| Option | Description | Selected |
|--------|-------------|----------|
| All 5 rigs, one batch | ORCL-01 (SIMPLE_TEST 4.3+4.2) + SLIDER-01 + XTRA-01 + XTRA-02, one Spine session | ✓ |
| Critical 2 now, XTRA later | ORCL-01 + SLIDER-01 now; XTRA rigs at Phase 44 boundary | |
| ORCL-01 only now | Just the SIMPLE_TEST 4.3+4.2 cross-runtime pair first | |

**User's choice:** All 5 rigs, one batch.

### spine-editor#891 mitigation (ORCL-01)
| Option | Description | Selected |
|--------|-------------|----------|
| ORCL-01 non-IK by design | TransformConstraint-only oracle rig (mirrors today's SIMPLE_TEST); removes #891 from critical path; ORCL-03 gate becomes a no-op; IK coverage via XTRA-02 | ✓ |
| Allow IK + spot-check gate | ORCL-01 may include IK; manual IK-timeline diff + Phase 44 #891 human-verify gate | |
| Both: non-IK oracle + IK variant | Non-IK primary + optional IK variant as secondary cross-check | |

**User's choice:** ORCL-01 non-IK by design.
**Notes:** Today's SIMPLE_TEST is already IK-free (TransformConstraint-on-SQUARE is itself the appliedPose canary). XTRA-02 IK rig is 4.3-only / never downgraded → #891-immune. Net: spine-editor#891 fully sidestepped for v1.6; ORCL-03 re-expressed (fallback non-IK rig becomes primary design).

### Artifact set per rig (loaderMode coverage)
| Option | Description | Selected |
|--------|-------------|----------|
| Atlas-source only | .json + .atlas + page PNG(s) per rig | ✓ |
| Both atlas + atlas-less | Also an images/-folder variant per rig | |
| Atlas-source + ORCL-01 both | All atlas-source; ORCL-01 also atlas-less | |

**User's choice:** Atlas-source only.
**Notes:** Sampler math is loaderMode-invariant by construction (SEED-007 lock); atlas-less parity already regression-covered by existing 4.2 fixtures.

---

## SAFE-01 baseline granularity

### Freeze scope
| Option | Description | Selected |
|--------|-------------|----------|
| Full SamplerOutput (all 3 maps) | globalPeaks + perAnimation + setupPosePeaks | ✓ |
| globalPeaks only | Just the texture-sizing number | |
| globalPeaks gated + others advisory | globalPeaks hard gate; others logged non-blocking | |

**User's choice:** Full SamplerOutput (all 3 maps).

### On-disk form
| Option | Description | Selected |
|--------|-------------|----------|
| Committed canonical JSON | Per-fixture sorted-key JSON; git-diffable on trip | ✓ |
| SHA256 sidecar | One digest per fixture (repack-baselines precedent); opaque on trip | |
| Canonical JSON + digest | JSON forensic record + digest gate | |

**User's choice:** Committed canonical JSON.

### Fixture inclusion rule
| Option | Description | Selected |
|--------|-------------|----------|
| Every successfully-sampling 4.2 fixture | Auto-discovered + enumerated/asserted; heavy rigs included | ✓ |
| Curated representative subset | Hand-picked path-coverage set | |
| All-sampling, heavy rigs tiered | All covered, heavy rigs in a separate tier | |

**User's choice:** Every successfully-sampling 4.2 fixture (auto-discovered, enumerated, heavy rigs included).

### Freeze enforcement
| Option | Description | Selected |
|--------|-------------|----------|
| Machine-checked order + frozen | Provenance header + git-ancestor CI assertion; no casual regen | ✓ |
| Provenance header, manual review | Header for audit; ordering by human review | |
| Mirror repack-baselines pattern | Reuse UPDATE_FIXTURES=1 convention | |

**User's choice:** Machine-checked order + frozen.

---

## CI trigger model

### Trigger model
| Option | Description | Selected |
|--------|-------------|----------|
| New per-push/PR workflow | New ci.yml; release.yml stays tag-only & untouched | ✓ |
| Extend release.yml test job | Add steps to release.yml only (fires only at tag-push — never during milestone) | |
| New workflow + dispatch only | New workflow, manual trigger only | |

**User's choice:** New per-push/PR workflow.

### Trigger scope/events
| Option | Description | Selected |
|--------|-------------|----------|
| Any-branch push + PR, skip docs-only | push any branch + PR-to-main + dispatch; never tags; paths-ignore .planning/**/docs | ✓ |
| Milestone branch + PR only | Push to v1.6 branch + PRs only | |
| Every push, no path filter | All pushes incl. docs-only commits | |

**User's choice:** Any-branch push + PR, skip docs-only.

### Lane split (tests vs bundle smoke)
| Option | Description | Selected |
|--------|-------------|----------|
| Full tests every push, bundle smoke on PR | 3-OS full suite + SAFE-01 + alias test every push; electron-builder bundle smoke only PR-to-main | ✓ |
| Everything every push | Full suite + bundle smoke on every push | |
| Fast lane push, full on PR | tsc/lint/unit/light-SAFE-01 (1 OS) on push; full matrix on PR | |

**User's choice:** Full tests every push, bundle smoke on PR.

### Phase-42 4.3 CI arm
| Option | Description | Selected |
|--------|-------------|----------|
| Load/resolution smoke + Phase-44 absence guard | Alias resolves + 4.3 module imports + Slider/BonePose 4.3-only + existing 4.3 JSON loads via 4.3 runtime; NOT sampled-value; guard fails CI if owner fixtures absent by Phase 44 | ✓ |
| Defer entire 4.3 arm to Phase 44 | 4.2 + alias-resolution only until Phase 44 | |
| Hand-authored 4.3 stub for the slot | Throwaway minimal 4.3 JSON for the slot | |

**User's choice:** Load/resolution smoke + Phase-44 absence guard.
**Notes:** This also resolved the un-selected "Phase-42 4.3 CI-slot strategy" gray area (D-13).

---

## Claude's Discretion

Delegated per `feedback_delegate_implementation_choices` (user chose "I'm ready for context"):
- npm alias key literal name (direction LOCKED 4.3-canonical; key name = `spine-core-42` lean)
- Opaque branded-handle mechanics (RT-03; constraint: required runtime-tag field, compile-time cross-runtime error)
- `SpineRuntime` interface signature surface (signatures only in Phase 42)
- Canonical-JSON serialization / float-determinism scheme
- `paths-ignore` glob set + git-ancestor assertion mechanism
- Incoming-fixture directory naming (must not collide with `fixtures/SPINE_4_3_TEST/`, `fixtures/test_4.3/`)
- Slider rig exact analytically-known-peak parameters (specified in the owner export-spec)

## Deferred Ideas

None — discussion stayed within Phase 42 scope. No scope creep; 0 pending todos matched Phase 42.
