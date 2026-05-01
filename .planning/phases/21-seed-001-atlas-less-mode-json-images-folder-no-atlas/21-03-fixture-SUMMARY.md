---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 03
subsystem: testing
tags: [fixture, golden-test-asset, atlas-less, png-header, synthetic-atlas]

# Dependency graph
requires:
  - phase: v1.0 / Phase 0
    provides: fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (CIRCLE/SQUARE/SQUARE2/TRIANGLE skeleton)
  - phase: v1.0 / Phase 6
    provides: fixtures/EXPORT_PROJECT/images/ (per-region CIRCLE.png, SQUARE.png, SQUARE2.png, TRIANGLE.png)
provides:
  - "fixtures/SIMPLE_PROJECT_NO_ATLAS/ — golden fixture for atlas-less load → sample → export round-trip"
  - "Spine 4.2 JSON + per-region images/ folder layout, no .atlas (synthesizer fall-through scenario)"
affects: [21-04, 21-06, 21-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-region PNG basename matches JSON attachment region name (CIRCLE.png ↔ skin attachment 'CIRCLE')"
    - "Byte-identical fixture copy (shasum-locked) — fixture provenance traceable to existing golden fixtures"

key-files:
  created:
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE.png
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png
    - fixtures/SIMPLE_PROJECT_NO_ATLAS/images/TRIANGLE.png
  modified: []

key-decisions:
  - "Fixture composition is COPY-only — no new content authored; preserves test traceability to existing golden fixtures (SIMPLE_PROJECT for JSON, EXPORT_PROJECT for per-region PNGs)"
  - "No .atlas file in fixture root — the absence is the point; exercises Plan 06 synthesizer fall-through"

patterns-established:
  - "Atlas-less fixture layout: <name>/<skeleton>.json + <name>/images/<RegionName>.png (no .atlas sibling)"
  - "Byte-identical fixture provenance via shasum verification in acceptance criteria (T-21-03-01 mitigation)"

requirements-completed: [LOAD-04]

# Metrics
duration: 1min
completed: 2026-05-01
---

# Phase 21 Plan 03: SIMPLE_PROJECT_NO_ATLAS Golden Fixture Summary

**Atlas-less golden fixture (1 JSON + 4 per-region PNGs, no `.atlas`) — byte-identical copy of existing fixtures, locked via shasum, enables synthetic-atlas + loader-atlas-less + round-trip integration tests in Plans 04, 06, 08.**

## Performance

- **Duration:** ~1 min (fixture copy + verification, no implementation)
- **Started:** 2026-05-01T22:51:31Z
- **Completed:** 2026-05-01T22:52:35Z
- **Tasks:** 1 (single fixture-creation task)
- **Files modified:** 5 (all created — 1 JSON + 4 PNGs)

## Accomplishments

- Created `fixtures/SIMPLE_PROJECT_NO_ATLAS/` directory with `SIMPLE_TEST.json` and `images/` subfolder containing the 4 per-region PNGs
- All 5 files are byte-identical copies of existing golden fixtures (shasum-verified)
- No `.atlas` file present — fixture exercises the synthesizer fall-through path that Plans 04/06/08 will test
- Closes Wave-0 fixture dependency, unblocking Plans 04 (synthetic-atlas spec), 06 (loader-atlas-less spec), 08 (round-trip integration test)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fixtures/SIMPLE_PROJECT_NO_ATLAS/ + copy JSON + 4 PNGs** — `a7bf391` (feat)

_(No metadata commit yet — orchestrator owns final commit per parallel-executor protocol.)_

## Files Created/Modified

- `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` (19,200 bytes) — Spine 4.2 skeleton JSON; byte-identical copy of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. References attachments CIRCLE, SQUARE, SQUARE2, TRIANGLE (verified — 17 occurrences of those region names in the file).
- `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png` (2,975 bytes) — per-region PNG, byte-identical copy of `fixtures/EXPORT_PROJECT/images/CIRCLE.png`.
- `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE.png` (5,376 bytes) — per-region PNG, byte-identical copy of `fixtures/EXPORT_PROJECT/images/SQUARE.png`.
- `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png` (637 bytes) — per-region PNG, byte-identical copy of `fixtures/EXPORT_PROJECT/images/SQUARE2.png`.
- `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/TRIANGLE.png` (3,621 bytes) — per-region PNG, byte-identical copy of `fixtures/EXPORT_PROJECT/images/TRIANGLE.png`.

**Total fixture byte size:** 31,809 bytes across 5 files.

## Provenance Hashes (SHA-1)

| File                                                   | SHA-1 hash                                  | Source                                        |
| ------------------------------------------------------ | ------------------------------------------- | --------------------------------------------- |
| `SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json`             | `0b95e17a1527867404a8b442e23389635b3602b3`  | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`    |
| `SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png`            | `33951acf7b35ac0e82cc78a2488a44293483f81d`  | `fixtures/EXPORT_PROJECT/images/CIRCLE.png`   |
| `SIMPLE_PROJECT_NO_ATLAS/images/SQUARE.png`            | `caf292acef1d35c581f591b512716dbb91520927`  | `fixtures/EXPORT_PROJECT/images/SQUARE.png`   |
| `SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png`           | `34b64d1cd8050e6a22234381fdcc5c4b8148dde8`  | `fixtures/EXPORT_PROJECT/images/SQUARE2.png`  |
| `SIMPLE_PROJECT_NO_ATLAS/images/TRIANGLE.png`          | `98ab1a71c84582006b96bf259e2745ca61820b9f`  | `fixtures/EXPORT_PROJECT/images/TRIANGLE.png` |

Each pair matched verbatim — byte-identical-copy contract held end-to-end.

## Region Names Confirmed in JSON

The four expected region names appear in `SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` as both bone names, slot attachment references, and skin attachment keys:

- **CIRCLE** — bone slot + skin attachment + region path (4 occurrences)
- **SQUARE** — bone + slot + skin attachment + region path + bone-list reference (5 occurrences)
- **SQUARE2** — bone + slot + skin attachment key (5 occurrences; second skin uses SQUARE region pattern)
- **TRIANGLE** — slot attachment + skin attachment with `x/y/rotation/width/height` (3 occurrences)

`grep -cE '"(CIRCLE|SQUARE|SQUARE2|TRIANGLE)"'` returns **17** total matches, well above the `≥4` acceptance threshold.

## Decisions Made

None - followed plan as specified. The plan deliberately mandated copy-only composition (no new fixture content) to preserve traceability; this was honored verbatim.

## Deviations from Plan

None - plan executed exactly as written.

All 7 plan steps (verify sources → verify regions → mkdir → copy JSON → copy 4 PNGs → verify no .atlas → shasum verify) ran in order; every acceptance criterion passed on first verification (directory exists, JSON exists, 4 PNGs match expected names, no .atlas file, JSON shasum matches source, CIRCLE shasum matches source, region count ≥4).

## Issues Encountered

None. The worktree base required a one-time reset to `f09c29b…` at startup (per the worktree branch check protocol); after reset, all source fixtures were present and accessible, and the copy-and-verify sequence completed without error or retry.

## Threat Model Compliance

- **T-21-03-01 (Tampering — fixture content drift):** Mitigated. Shasum verification step was executed and locked all 5 files to their respective source hashes; provenance trail recorded above.
- **T-21-03-02 (Information Disclosure — fixture in repo):** Accepted as planned. Source fixtures (`SIMPLE_PROJECT`, `EXPORT_PROJECT`) are already committed; this fixture is a third arrangement of the same content.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file-access patterns, or schema changes. The fixture content is bytes from existing committed fixtures.

## Known Stubs

None — no rendered UI, no hardcoded placeholder data; the deliverable is byte-exact fixture data and a directory layout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 21-04 (synthesize-atlas-from-png-headers spec)** — can resolve `path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json')` and find a valid Spine JSON beside an `images/` folder with 4 per-region PNGs containing real IHDR-readable dimensions.
- **Plan 21-06 (loader-atlas-less spec)** — can drive the `AtlasNotFoundError` → synthetic-atlas fall-through path against this fixture; the absence of a `.atlas` sibling is the trigger.
- **Plan 21-08 (round-trip integration test)** — can run load → sample → export against the fixture end-to-end; per-region PNG dimensions read from real PNG headers will populate the synthetic atlas, the sampler will resolve all 4 region attachments, and the optimize export can write to a tmp folder for comparison.

No blockers. All Wave-0 dependencies for downstream Wave-1+ plans are satisfied.

## Self-Check: PASSED

Verified post-write:

- `[FOUND] fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json`
- `[FOUND] fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png`
- `[FOUND] fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE.png`
- `[FOUND] fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE2.png`
- `[FOUND] fixtures/SIMPLE_PROJECT_NO_ATLAS/images/TRIANGLE.png`
- `[FOUND] commit a7bf391` (feat(21-03): add SIMPLE_PROJECT_NO_ATLAS golden fixture)

All claimed files exist on disk; the task commit is present in `git log`.

---
*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Plan: 03*
*Completed: 2026-05-01*
