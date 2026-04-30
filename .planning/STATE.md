---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: expansion
status: milestone_started
last_updated: "2026-04-30T00:00:00Z"
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-30 — Milestone v1.2 (expansion) started; 8 phases scoped (13.1 + 16 / 17 / 18 + 19 / 20 / 21 / 22).

## Current milestone

v1.2 — expansion. Closes three macOS regressions + one host-blocked carry-forward from v1.1.x; refines the UI based on tester feedback (Phase 19 UI-01..05); adds the Documentation Builder feature (Phase 20 fills the .stmproj v1 reserved `documentation: object` slot from D-148); lands the two long-dormant SEEDs (Phase 21 SEED-001 atlas-less mode → Phase 22 SEED-002 dims-badge override-cap).

Phases (continues numbering from v1.1.2; no `--reset-phase-numbers`):
- **13.1** — Live UAT carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 lifecycle observation; host-availability gated)
- **16** — macOS auto-update → manual-download UX (closes D-15-LIVE-2; promoted from backlog 999.2 on 2026-04-29)
- **17** — Help → Check for Updates not gated on project state (closes D-15-LIVE-3; promoted from backlog 999.3)
- **18** — Cmd+Q + AppleScript quit broken on macOS (promoted from backlog 999.1)
- **19** — UI improvements UI-01..05 (sticky header + cards + modal redesign + quantified callouts + button hierarchy; tester feedback)
- **20** — Documentation Builder feature (.stmproj v1 documentation slot; D-148)
- **21** — SEED-001 atlas-less mode (json + images, no .atlas; PNG header reader + synthetic atlas)
- **22** — SEED-002 dims-badge + override-cap (depends on 21; round-trip safety)

Out of scope for v1.2: Apple Developer ID signing + notarization (declined; manual-download UX is the v1.2 answer); Crash reporting / Sentry (revisit at v1.3); Spine 4.3+ versioned loader; `.skel` binary loader.

REQUIREMENTS.md and ROADMAP.md will be authored next; phase numbering continues; Phase 22 depends on Phase 21.

## Current phase

— (no active phase yet; ready for `/gsd-discuss-phase 13.1` or `/gsd-discuss-phase 16` once roadmap is approved)

## Current plan

—

## Last completed

**Milestone v1.1.2 — Auto-update fixes — SHIPPED 2026-04-29.** Phase 14 closed 5/5 plans (renderer + state machine fixes; UPDFIX-02 / UPDFIX-03 / UPDFIX-04). Phase 15 closed 6/6 plans (build/feed-shape fix + v1.1.2 release + v1.1.3 same-day hotfix; UPDFIX-01 / D-15-LIVE-1 empirically closed via Test 7-Retry PARTIAL-PASS — v1.1.1 → v1.1.3 .zip download succeeded byte-exact 121,848,102 bytes at canonical dotted URL). 520 vitest passing. Three downstream defects (D-15-LIVE-2 ad-hoc code-sig swap; D-15-LIVE-3 menu gating; 999.1 macOS quit) routed to backlog and now promoted to v1.2 phases 16 / 17 / 18 via /gsd-review-backlog (commit cc0bc6a, 2026-04-29).

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, all locked. See PROJECT.md `## Key Decisions (v1.0 outcomes)` and `## Constraints (still valid)` for the full list.)

---

*This file is authored fresh at milestone start. Phase 14 + Phase 15 detailed execution history is preserved in their respective phase directories under `.planning/phases/14-…/` and `.planning/phases/15-…/` (VERIFICATION.md, HUMAN-UAT.md, SUMMARY files). v1.1.2 phases will be archived to `.planning/milestones/v1.1.2-phases/` when /gsd-complete-milestone v1.1.2 is run.*
