---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
plan: 04
subsystem: planning
tags: [planning, seed, spine-4.3, docs, seed-plant]

requires:
  - phase: 32
    provides: SEED-003 schema-delta groundwork; CONTEXT.md Option A close-out
provides:
  - SEED-006 carries the costed inventory for the future full Spine 4.3 runtime port (PORT-01..04 + 5 sampler renames + 2 bounds signature changes + slot.pose access pattern + slider validation strategy + vendoring strategy)
  - SEED-003 has a Phase 32 close-out addendum noting Option A landed and Option C queued via SEED-006
affects: [v1.4-close, future-spine-4.3-port-phase, post-4.3.0-stable-npm-publish]

tech-stack:
  added: []
  patterns:
    - "SEED file convention: frontmatter (id, status, planted, planted_during, trigger_when, scope, proposed_phase) + body (Why This Matters / Costed Inventory / Schema+Runtime Deltas / Trigger Condition / Cross-Links / Recommendation / Sources). SEED-001/002/003/004/005 -> SEED-006 mirror."
    - "Phase-close seed addendum: byte-stable insertion between ## Recommendation and ## Open Question; status: planted preserved (no escalation); cross-link to successor seed."

key-files:
  created:
    - .planning/seeds/SEED-006-spine-4.3-runtime-port.md
  modified:
    - .planning/seeds/SEED-003-spine-4.3-compatibility.md

key-decisions:
  - "SEED-006 frontmatter mirrors SEED-003 verbatim (per CONTEXT D-07): id=SEED-006, status=planted, planted=2026-05-10, scope=Large (full runtime port), proposed_phase=TBD (post-4.3.0-stable npm publish)"
  - "Trigger condition copied verbatim from REQUIREMENTS.md L38: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x OR a paying user reports they cannot re-export their rig as Version 4.2"
  - "PORT-01..04 inventory copied verbatim from REQUIREMENTS.md L33-36"
  - "SEED-003 addendum is a one-section additive insertion; status: planted NOT escalated (SEED-003 stays planted until Option C closes too)"
  - "Sources block in SEED-006 re-cites the same 8 URLs from SEED-003 (single source of truth for 4.2-vs-4.3 schema research)"

patterns-established:
  - "Phase-close seed-plant: when a phase implements an Option from an earlier seed, plant a successor seed for the queued options + update the predecessor seed with a forward-cross-linking addendum."
  - "Byte-stable seed addendum: existing frontmatter, body sections, and source links remain unchanged; new section lands between two existing sections; verifiable via `git diff --stat` showing only insertions."

requirements-completed: []  # this plan is a phase deliverable (seed plant), not a REQ implementation per frontmatter `requirements: []`

duration: ~5min
completed: 2026-05-10
---

# Phase 32 Plan 04: Plant SEED-006 (Full Spine 4.3 runtime port) Summary

**SEED-006 planted with the full v1.4 investigation cost-inventory (5 sampler renames + 2 bounds signature changes + slot.pose access + slider validation + vendoring strategy); SEED-003 closed out with a Phase 32 status addendum cross-linking forward to SEED-006.**

## Performance

- **Duration:** ~5 min (pure planning-doc work; no code, no tests, no runtime artifacts)
- **Tasks:** 2/2 complete
- **Files modified:** 2 (1 created, 1 amended)

## Accomplishments

- **SEED-006 created** at `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` (8847 bytes; 90 inserted lines). Mirrors SEED-003 frontmatter shape (7 keys) and section headers; populated with the costed-inventory (PORT-01..04 verbatim from REQUIREMENTS.md L33-36) + Schema+Runtime Deltas tables (5 sampler renames + 2 bounds signature changes + slot.pose access + slider timeline validation + vendoring strategy) + verbatim trigger condition + 3 cross-links + 4-task implementation recommendation + verbatim 8-source citation block.
- **SEED-003 amended** with a new `## Status (2026-05-10) — Option A landed; Option C queued via SEED-006` section landing between `## Recommendation` and `## Open Question`. Documents Option A close-out (Phase 32 — `SpineVersionUnsupportedError`, drop-zone advisory at `App.tsx:622`, "supported downgrade" wording), Option C queue-via-SEED-006 forward link, Option B still skipped. Frontmatter and rest of body byte-stable (6 insertions, 0 deletions per `git diff --stat`).

## Task Commits

Each task was committed atomically on branch `worktree-agent-a849e718f646912e6`:

1. **Task 1: Create SEED-006** — `e03d60e` (docs)
   - `docs(32-04): plant SEED-006 — full Spine 4.3 runtime port queued`
2. **Task 2: SEED-003 Phase 32 close-out addendum** — `a5bc5ea` (docs)
   - `docs(32-04): SEED-003 addendum noting Option A landed + Option C queued via SEED-006`

The orchestrator will commit `32-04-SUMMARY.md` as the metadata commit after wave merge.

## Files Created/Modified

- `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` — NEW. Costed-inventory seed for the future full Spine 4.3 runtime port. Frontmatter: `id: SEED-006`, `status: planted`, `planted: 2026-05-10`, `planted_during: v1.4 Phase 32 (Spine 4.3-beta detect-and-warn close-out)`, `trigger_when:` (verbatim REQUIREMENTS.md L38), `scope: Large`, `proposed_phase: TBD (post-4.3.0-stable npm publish)`. Body covers Why This Matters → Costed Inventory (PORT-01..04) → Schema+Runtime Deltas (5 sampler renames + 2 bounds sig changes + slot.pose + slider validate + vendoring) → Trigger Condition → Cross-Links → Recommendation → Sources (8 URLs).
- `.planning/seeds/SEED-003-spine-4.3-compatibility.md` — MODIFIED (additive only). New `## Status (2026-05-10)` section after `## Recommendation`; cross-references SEED-006 + COMPAT-01 wording + COMPAT-02 site at `App.tsx:622`. `status: planted` preserved (SEED-003 stays planted until Option C closes too).

## Decisions Made

- **SEED-006 mirrors SEED-003 shape verbatim** (per CONTEXT D-07). The seed-file convention is well-established — SEED-001 → Phase 21, SEED-002 → Phase 22, SEED-003 → Phase 32 Option A. SEED-006 is the natural successor for Option C.
- **Trigger condition + costed inventory copied verbatim from REQUIREMENTS.md** (L38 trigger; L33-36 PORT-01..04). Single source of truth.
- **Sources re-cited verbatim from SEED-003** — same 8 URLs (Spine Changelog, 4.3-beta announcement blog, 4.3-beta CHANGELOG.md, 4.3-beta SkeletonJson.ts, 4.2 SkeletonJson.ts, Spine-Unity upgrade guide, spine-editor#891, JSON format docs).
- **SEED-003 frontmatter unchanged** — Plan 04 is an addendum, not a status change. SEED-003 stays `status: planted` until Option C ships too. The new Status section is informational, not a status escalation.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed verbatim from the PLAN.md `<action>` blocks.

## Issues Encountered

**Pre-existing test failure (out of scope, not caused by this plan):**

The PLAN.md `<verification>` block called `npm test --run` as a smoke-test for `.planning/`-relative-path tests. The full suite reports `1 failed | 954 passed | 20 skipped | 2 todo` in `tests/main/sampler-worker-girl.spec.ts:38` (`warmup.type` expected "complete", received "error"). The failing test depends on the gitignored proprietary `fixtures/Girl/` rig which is not present in this worktree, so the warmup run cannot read its source files. This is a pre-existing fixture-availability failure unrelated to my docs-only changes (`git diff 6c2fd8e..HEAD --name-only` shows only `.planning/seeds/`).

Per deviation rules SCOPE BOUNDARY: "Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing warnings, linting errors, or failures in unrelated files are out of scope." No fix attempted; logged here for visibility. The 953 unrelated tests pass; the planning-doc diff did NOT break any `.planning/`-scanning test.

## User Setup Required

None — pure planning-doc work; no environment, no external services, no manual configuration.

## Next Phase Readiness

- **Plan 32-04 closes the Phase 32 deliverables**: COMPAT-01 (Plan 01) + COMPAT-02 (Plan 02) + tests/UAT (Plan 03) + SEED-006 plant (this plan).
- **Phase 33** (Rotated atlas region support — ATLAS-01..04) is unblocked.
- **Future post-4.3.0-stable port phase** has a queue-ready scoping document at `.planning/seeds/SEED-006-spine-4.3-runtime-port.md`. Trigger watch: `npm view @esotericsoftware/spine-core@latest` is currently `4.2.114`; flip the moment it returns `4.3.x`, OR earlier if a paying user reports they cannot re-export as Version 4.2.

## Self-Check: PASSED

**Created files exist:**
- FOUND: `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` (8847 bytes)

**Modified files have expected diff:**
- FOUND: `.planning/seeds/SEED-003-spine-4.3-compatibility.md` (6 insertions, 0 deletions; `## Status (2026-05-10)` section landed between `## Recommendation` and `## Open Question`)

**Commits exist:**
- FOUND: `e03d60e` (docs(32-04): plant SEED-006 — full Spine 4.3 runtime port queued)
- FOUND: `a5bc5ea` (docs(32-04): SEED-003 addendum noting Option A landed + Option C queued via SEED-006)

**Acceptance criteria (Task 1):** All 17 grep-based criteria satisfied — id/status/planted/trigger_when/proposed_phase frontmatter present; PORT-01..04 verbatim; 5 sampler renames keyword `setToSetupPose`; 2 bounds keyword `vertexOffsets`; slot.pose access (4 hits); slider (4 hits, ≥2 required); vendoring (3 hits, ≥2 required); SEED-003 cross-links (3 hits, ≥2 required); CHANGELOG.md URL (1); "supported downgrade" wording (1).

**Acceptance criteria (Task 2):** All 9 grep-based criteria satisfied — Status section landed (1); SEED-006 references (2, ≥2 required); existing sections preserved (`## Recommendation`, `## Open Question (parked for next conversation)`, `## Sources (verified during research)` each 1); frontmatter `id: SEED-003` + `status: planted` unchanged (1 each); "supported downgrade" (2); `App.tsx:622` (1); 0 line deletions (purely additive).

---
*Phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure*
*Plan: 04 (SEED-006 plant)*
*Completed: 2026-05-10*
*Suggested metadata commit: `docs(seed): plant SEED-006 — full Spine 4.3 runtime port queued`*
