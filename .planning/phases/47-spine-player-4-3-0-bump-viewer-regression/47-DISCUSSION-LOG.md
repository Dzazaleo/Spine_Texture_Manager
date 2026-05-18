# Phase 47: spine-player 4.3.0 Bump + Viewer Regression - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 47-spine-player-4-3-0-bump-viewer-regression
**Areas discussed:** Regression fallback trigger, sampleAnimationBounds resilience, Next step (UI-SPEC vs regression)

---

## Regression fallback trigger / milestone-close posture

| Option | Description | Selected |
|--------|-------------|----------|
| Land bump+migration, carry residual visual UATs to v1.7 | Ship v1.6 with PLAYER-01 + GL-alpha hard-gate green; residual visual/host UATs carry to v1.7 as Phase 41 already did | |
| Attempt roadmap revert (spine-player→4.2.111, ship without bump) | Follow PITFALLS/ROADMAP fallback literally; feasibility itself uncertain given frozen-canonical 4.3.0 | |
| Hold v1.6 close until viewer fully green on 4.3 | Block the entire v1.6 milestone (24/26 reqs done) until all 5 UATs + GL-alpha pass live | ✓ |

**User's choice:** Hold v1.6 close until viewer fully green on 4.3.
**Notes:** Strictest bar. Consciously overrides the ROADMAP/research "decoupled + revertible — a player regression must not gate the core port" design intent. Locked as D-01; not to be relitigated.

| Option | Description | Selected |
|--------|-------------|----------|
| In-phase owner live-UAT checkpoint (all 5 + GL-alpha) | Explicit checkpoint:human-action; owner runs the Electron app and signs off all 5 Phase 41 UATs + GL-alpha SIMPLE_TEST live; phase blocks until then (Phase 46-style) | ✓ |
| Owner live for visual ones, automated for the rest | GL-alpha + render + anim/skin/scrub + atlas-less by owner; GL-leak + real-fs error via automated proxies | |
| Owner live session, GL-alpha is the only hard blocker | Owner runs + records, but only GL-alpha is milestone-blocking; other 4 run-and-record | |

**User's choice:** In-phase owner live-UAT checkpoint (all 5 + GL-alpha).
**Notes:** The 4 visual/host-blocked UATs are not jsdom-passable; owner live execution is the only valid evidence. Locked as D-02.

---

## sampleAnimationBounds resilience

| Option | Description | Selected |
|--------|-------------|----------|
| Keep custom resilient path, migrate apply() 1:1 | Preserve sampleAnimationBounds; migrate only line-255 apply() to the 4.3 signature; content-less-STOP graceful degradation must not regress | ✓ |
| Adopt spine-player 4.3 native calculateAnimationViewport | Delete custom path; reintroduces the fatal showError crash on content-less animations (the Phase 41 bug) | |
| You decide | Delegate within the no-regression constraint | |

**User's choice:** Keep custom resilient path, migrate apply() 1:1.
**Notes:** Locked as D-04. The exact 4.3 apply() arg shape is researcher-derived from the 4.3.0 .d.ts.

| Option | Description | Selected |
|--------|-------------|----------|
| Full internal-touchpoint audit vs 4.3 dist/.d.ts | Enumerate every spine-player/spine-webgl internal the modal uses, document stable/changed, before the live UAT | ✓ |
| Migrate the known break only, let live UAT surface the rest | Migrate line 255 only; rely on the owner session to surface internal regressions reactively | |
| You decide | Delegate audit depth | |

**User's choice:** Full internal-touchpoint audit vs 4.3 dist/.d.ts.
**Notes:** Locked as D-05. Surface drift up front, not during the host-blocked session.

| Option | Description | Selected |
|--------|-------------|----------|
| Same-framing parity (rigs fit identically) | Migrated bounds + camera-freeze/Fit must frame rigs as v1.5.1 did; auto-fit/zoom drift is a regression | ✓ |
| Correct render is enough; minor framing drift OK | Slight framing/zoom shift across the major bump is acceptable | |
| You decide | Delegate, default "no visible regression a user would notice" | |

**User's choice:** Same-framing parity (rigs fit identically).
**Notes:** Locked as D-06.

---

## Next step: UI-SPEC vs regression

| Option | Description | Selected |
|--------|-------------|----------|
| Plan as --skip-ui visual-regression phase | /gsd-plan-phase 47 --skip-ui; the 5 UATs + GL-alpha owner checkpoint ARE the visual contract; corrects the speculative memory note | ✓ |
| Run /gsd-ui-phase 47 first (per the memory flag) | Produce a UI-SPEC design contract before planning | |
| You decide | Delegate the routing call | |

**User's choice:** Plan as --skip-ui visual-regression phase.
**Notes:** Locked as D-07. Phase 47 designs zero new UI; corrects the `project_gsd_ui_gate_false_positive_core_phases` memory note (written pre-scout).

| Option | Description | Selected |
|--------|-------------|----------|
| New 47-HUMAN-UAT.md + flip 41-HUMAN-UAT.md in place | New Phase 47 UAT doc (all 6, owner-signed) + flip the 5 pending Phase 41 items with a pointer | ✓ |
| Single 47-HUMAN-UAT.md only | One new doc; leave 41-HUMAN-UAT.md untouched as historical | |
| You decide | Delegate artifact structure | |

**User's choice:** New 47-HUMAN-UAT.md + flip 41-HUMAN-UAT.md in place.
**Notes:** Locked as D-08. Preserves the Phase 41 audit trail + creates the Phase 47 milestone-close record.

| Option | Description | Selected |
|--------|-------------|----------|
| SIMPLE_TEST (4.2) + SIMPLE_PROJECT_43 (4.3) | Established GL-alpha canary + the ORCL-01 SIMPLE_TEST-equivalent 4.3 sibling; minimal, comparable, in-repo | ✓ |
| Broader set (also SLIDER_4_3 / XTRA / spineboy_4.3) | Wider visual coverage, more owner effort | |
| You decide | Delegate fixture selection | |

**User's choice:** SIMPLE_TEST (4.2) + SIMPLE_PROJECT_43 (4.3).
**Notes:** Locked as D-09. The D-05 audit may add one rig only if it flags an alpha/render risk.

---

## Claude's Discretion

Delegated within the locked D-01..D-09 invariants: exact 4.3 `apply()` arg shape (researcher-derived); D-05 audit enumeration/format; how same-framing parity is measured/recorded; `47-HUMAN-UAT.md` layout; the `checkpoint:human-action` task placement/wording; the minimal CSP/CORS posture for the 4.3 player (origin-scoped, no broadening — PITFALLS guardrail).

## Deferred Ideas

- VIEWER-07 split-pane source-vs-exported comparison — v1.7 candidate, not Phase 47.
- External-surface copy sweep (GitHub repo description / Releases notes) — owner ship-time follow-up (Phase 45 D-07 carry).
- Broader 4.3 viewer fixture matrix — scoped down to the SIMPLE_TEST + SIMPLE_PROJECT_43 pair; future-confidence idea, not v1.6.
