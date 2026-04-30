---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: (in progress)
status: "Roadmap landed; 26/26 v1.2 REQs mapped 1:1 to 8 phases (13.1 + 16 + 17 + 18 + 19 + 20 + 21 + 22)"
last_updated: "2026-04-30T09:00:43.169Z"
last_activity: "2026-04-30 — ROADMAP.md authored against REQUIREMENTS.md (commit f36f265, 25-row Traceability — actual count 26 REQs across 8 phases). Recommended execution order: 16 → 17 → 18 → 19 → 20 → 21 → 22; Phase 13.1 inserted opportunistically when a host becomes available."
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State

## Current Position

Phase: Not started (roadmap landed; awaiting /gsd-discuss-phase or /gsd-plan-phase)
Plan: —
Status: Roadmap landed; 26/26 v1.2 REQs mapped 1:1 to 8 phases (13.1 + 16 + 17 + 18 + 19 + 20 + 21 + 22)
Last activity: 2026-04-30 — ROADMAP.md authored against REQUIREMENTS.md (commit f36f265, 25-row Traceability — actual count 26 REQs across 8 phases). Recommended execution order: 16 → 17 → 18 → 19 → 20 → 21 → 22; Phase 13.1 inserted opportunistically when a host becomes available.

## Last Roadmap Update

2026-04-30 — `.planning/ROADMAP.md` refined to match the v1.2 REQUIREMENTS.md surface authored at commit f36f265. v1.0 / v1.1 / v1.1.1 / v1.1.2 historical sections preserved verbatim (append-only). v1.2 milestone bullet expanded from "Phases 16–18 promoted from backlog" → full 8-phase scope summary. v1.2 section header updated to "Phases 13.1, 16–22 (8 phases; promoted from backlog + tester feedback + dormant seeds 2026-04-30)". Phases 16 / 17 / 18 (already-existing rich Phase Details from /gsd-review-backlog commit cc0bc6a) gained `**Requirements:**` lines + `**Success Criteria**` blocks; existing Background / User decision / Scope / Severity / Cross-references sub-blocks preserved verbatim. Phases 13.1, 19, 20, 21, 22 authored from scratch (Phase 13.1 details lifted from 13-VERIFICATION.md gaps; Phase 19 from tester-feedback REQs; Phase 20 from D-148 + DOC-01..05; Phases 21 + 22 narrative lifted from `.planning/seeds/SEED-001-atlas-less-mode.md` + `.planning/seeds/SEED-002-dims-badge-override-cap.md`). Progress table extended with rows for 13.1, 19, 20, 21, 22 (16/17/18 rows preserved). Deferred section updated to strikethrough the 4 items now promoted (SEED-001, SEED-002, UI improvements, Documentation Builder, Phase 13.1 carry-forwards) + new "Out-of-scope for v1.2 specifically" section listing Apple Developer ID + Sentry as declined for v1.2 with v1.3 revisit posture. Backlog section unchanged (still empty post-/gsd-review-backlog 2026-04-29). Commit hash: [committed in next step].

## Current milestone

v1.2 — expansion. Closes three macOS regressions + one host-blocked carry-forward from v1.1.x; refines the UI based on tester feedback (Phase 19 UI-01..05); adds the Documentation Builder feature (Phase 20 fills the .stmproj v1 reserved `documentation: object` slot from D-148); lands the two long-dormant SEEDs (Phase 21 SEED-001 atlas-less mode → Phase 22 SEED-002 dims-badge override-cap).

Phases (continues numbering from v1.1.2; no `--reset-phase-numbers`):

- **13.1** — Live UAT carry-forwards (Linux runbook + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 lifecycle observation; host-availability gated; UAT-01..03)
- **16** — macOS auto-update → manual-download UX (closes D-15-LIVE-2; promoted from backlog 999.2 on 2026-04-29; UPDFIX-05)
- **17** — Help → Check for Updates not gated on project state (closes D-15-LIVE-3; promoted from backlog 999.3; UPDFIX-06)
- **18** — Cmd+Q + AppleScript quit broken on macOS (promoted from backlog 999.1; QUIT-01, QUIT-02)
- **19** — UI improvements UI-01..05 (sticky header + cards + modal redesign + quantified callouts + button hierarchy; tester feedback)
- **20** — Documentation Builder feature (.stmproj v1 documentation slot; D-148; DOC-01..05)
- **21** — SEED-001 atlas-less mode (json + images, no .atlas; PNG header reader + synthetic atlas; LOAD-01..04)
- **22** — SEED-002 dims-badge + override-cap (depends on 21; round-trip safety; DIMS-01..05)

Recommended execution order: 16 → 17 → 18 → 19 → 20 → 21 → 22, with Phase 13.1 inserted opportunistically when a host becomes available. Final order is the user's call.

Out of scope for v1.2: Apple Developer ID signing + notarization (declined; manual-download UX is the v1.2 answer); Crash reporting / Sentry (revisit at v1.3); Spine 4.3+ versioned loader; `.skel` binary loader.

REQUIREMENTS.md and ROADMAP.md are authored; phase numbering continues; Phase 22 depends on Phase 21.

## Current phase

— (no active phase yet; ready for `/gsd-discuss-phase 16` or `/gsd-plan-phase 16` — recommended first phase per execution order; or `/gsd-discuss-phase 13.1` if a Linux/macOS/Windows host becomes available first)

## Current plan

—

## Last completed

**Milestone v1.1.2 — Auto-update fixes — SHIPPED 2026-04-29.** Phase 14 closed 5/5 plans (renderer + state machine fixes; UPDFIX-02 / UPDFIX-03 / UPDFIX-04). Phase 15 closed 6/6 plans (build/feed-shape fix + v1.1.2 release + v1.1.3 same-day hotfix; UPDFIX-01 / D-15-LIVE-1 empirically closed via Test 7-Retry PARTIAL-PASS — v1.1.1 → v1.1.3 .zip download succeeded byte-exact 121,848,102 bytes at canonical dotted URL). 520 vitest passing. Three downstream defects (D-15-LIVE-2 ad-hoc code-sig swap; D-15-LIVE-3 menu gating; 999.1 macOS quit) routed to backlog and now promoted to v1.2 phases 16 / 17 / 18 via /gsd-review-backlog (commit cc0bc6a, 2026-04-29).

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, all locked. See PROJECT.md `## Key Decisions (v1.0 outcomes)` and `## Constraints (still valid)` for the full list.)

---

*This file is authored fresh at milestone start. Phase 14 + Phase 15 detailed execution history is preserved in their respective phase directories under `.planning/phases/14-…/` and `.planning/phases/15-…/` (VERIFICATION.md, HUMAN-UAT.md, SUMMARY files). v1.1.2 phases will be archived to `.planning/milestones/v1.1.2-phases/` when /gsd-complete-milestone v1.1.2 is run.*
