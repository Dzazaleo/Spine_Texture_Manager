---
phase: 40-atlas-repack-output
plan: 08
subsystem: tests
tags: [sha256-baselines, regression-sentinel, cross-loadermode-parity, sharpen-invariant, repack-01, repack-08, repack-09]

# Dependency graph
requires:
  - phase: 40
    plan: 05
    provides: "src/main/repack-worker.ts runRepack(plan, outDir, onProgress, isCancelled, allowOverwrite, sharpenEnabled, atlasOpts, writtenPaths) — atlas-mode sharp orchestration with deterministic packer + atomic .tmp+rename writes"
  - phase: 40
    plan: 06
    provides: "src/main/ipc.ts handleStartExport outputMode='both' branch runs runExport then runRepack with a shared writtenPaths Set — this plan's tests invoke the workers directly with the same shape"
  - phase: 40
    plan: 07
    provides: "OptimizeDialog Output card threads outputMode + atlasOpts through window.api.startExport — UI-side complete; this plan adds the SHA256 sentinel underneath"
provides:
  - "tests/fixtures/repack-baselines.json — SHA256 sidecar (D-06) with 3 loose PNG SHAs + .atlas SHA + page-PNG SHA for SIMPLE_TEST"
  - "tests/fixtures/repack-expected/SIMPLE_TEST.atlas — committed expected .atlas text (developer-facing diff target on REPACK-01 failures)"
  - "tests/main/repack.loose-parity.spec.ts — REPACK-01 strictest-gate: SHA256-asserts every loose PNG + .atlas + page PNG against the committed baseline; UPDATE_FIXTURES=1 writes hashes in-place instead of asserting (D-07: never runs in CI)"
  - "tests/main/repack.parity.spec.ts — REPACK-08 cross-loaderMode SHA256 identity + REPACK-09 sharpen-invariant pack layout (with corroborating pixels-differ assertion)"
  - "scripts/repack-refresh-baselines.mjs — delegates to vitest UPDATE_FIXTURES=1 (same code path as the in-test refresh) + bumps _meta with sharp/maxrects-packer/spine-core versions read from node_modules"
  - "npm run repack:refresh-baselines wired in package.json scripts block"
affects:
  - 40-09
  - 40-verify

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-worker invocation in tests — call runExport + runRepack directly rather than handleStartExport, avoiding vi.mock('electron') entanglement; matches the existing tests/main/repack-worker.spec.ts idiom (Phase 40 Plan 05 + 06 precedent)"
    - "Deterministic outDir basename — test creates `<tmp>/SIMPLE_TEST` so deriveProjectName(outDir) yields stable atlas/page filenames (SIMPLE_TEST.atlas / SIMPLE_TEST.png); without this the random tmp-dir name leaks into SHA256 baselines and prevents round-trip"
    - "Refresh-by-env idiom — process.env.UPDATE_FIXTURES === '1' inside the test branches between assertion and in-place write; the npm script delegates to vitest with the env flag set, so refresh-script + in-test refresh share one code path"
    - "Hybrid baseline storage (D-06) — JSON sidecar with SHA256 digests for every output file + committed .atlas text for text-diffability on failure; page PNG bytes intentionally NOT committed (multi-MB at 4096²)"

key-files:
  created:
    - "tests/fixtures/repack-baselines.json (868 bytes) — populated baseline JSON with _meta + SIMPLE_TEST.{loose,atlas} subtrees"
    - "tests/fixtures/repack-expected/SIMPLE_TEST.atlas (166 bytes) — committed expected atlas text (libgdx format, LF line endings)"
    - "tests/main/repack.loose-parity.spec.ts (10447 bytes, 1 it-test) — REPACK-01 strictest-gate"
    - "tests/main/repack.parity.spec.ts (9470 bytes, 2 it-tests) — REPACK-08 + REPACK-09 gates"
    - "scripts/repack-refresh-baselines.mjs (6486 bytes) — manual refresh script delegating to vitest"
  modified:
    - "package.json — added `repack:refresh-baselines` script entry next to fixture:atlas-source-drift"

key-decisions:
  - "Direct-worker invocation instead of handleStartExport (deviation Rule 3): the plan's <action> body called handleStartExport, but importing src/main/ipc.ts brings in `electron` at module-load time, requiring vi.mock('electron') that conflicts with real-sharp execution. The 'both' branch of handleStartExport is literally `runExport(...); runRepack(...)` with a shared `written` Set, so calling them directly produces byte-identical output. Matches the existing tests/main/repack-worker.spec.ts pattern."
  - "Deterministic outDir basename (deviation Rule 1 bug-fix): the plan's initial action used a random tmp dir name directly, but `deriveProjectName(outDir)` in repack-worker.ts reads `basename(outDir)` and uses it as the atlas + page-PNG filename root. Random tmp names like `stm-loose-parity-aNKQjS` leak into the SHA256 baselines and prevent round-trip. Fixed by using `<tmp>/SIMPLE_TEST` so the filename pins to `SIMPLE_TEST.atlas` / `SIMPLE_TEST.png` on every run. Verified deterministic via 2 consecutive UPDATE_FIXTURES runs producing byte-identical .atlas output."
  - "Refresh script delegates to vitest rather than importing workers directly: avoids both the `npm run build` precondition (workers are TS, only available as JS under out/main/ after a build) AND the risk of script-logic drifting from test assertions. Single code path; same SHA256 outputs."
  - "Test name strings used liberally in describes/comments (`loaderMode parity`, `sharpen invariant`) — grep-friendly for future maintainers but slightly exceeds the plan's `returns 1` count. The string is present where required (`it(...)` test names + describe blocks); the verifier's intent (test names exist) is satisfied."

patterns-established:
  - "SHA256 baseline gate with refresh-by-env: vitest reads process.env.UPDATE_FIXTURES, branches between assert and in-place write; saveBaselines helper writes formatted JSON + LF; npm-script wrapper spawns vitest with the env flag. Reusable for any future byte-parity regression sentinel."
  - "Direct-worker integration tests for sharp pipeline: avoids electron mock entanglement by calling runExport / runRepack with their full positional arg lists (matches src/main/ipc.ts handleStartExport call shape verbatim). Stable per-test outDir naming is required to keep SHA256 baselines deterministic across runs."
  - "Sharpen-invariant assertion pattern: requires forcing effectiveScale < 1.0 in the test plan (sharp-resize.ts L56-62 only sharpens on downscale); without this gate the assertion vacuously passes regardless of sharpen state."

requirements-completed: [REPACK-01, REPACK-08, REPACK-09]

# Metrics
duration: ~20 min
completed: 2026-05-15
---

# Phase 40 Plan 08: SHA256 Baseline Regression Sentinels Summary

**REPACK-01 strictest-gate + REPACK-08 cross-loaderMode parity + REPACK-09 sharpen-invariant pack layout — SHA256 sentinel infrastructure with refresh-by-env workflow that NEVER runs in CI (D-07).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files created:** 5 (1 refresh script + 1 JSON baseline + 1 expected atlas + 2 test specs)
- **Files modified:** 1 (package.json: 1-line script entry)
- **Tests added:** 3 (1 in loose-parity + 2 in parity)
- **Test gate timing:** loose-parity 286ms, parity 418ms

## Baselines Committed

| File | Size | SHA256 |
|------|------|--------|
| tests/fixtures/repack-baselines.json | 868 B | `d47dc38e6ef7fc2b43955d6d5c4c437530bb79f6ca4c15e6b80bec5c8c08f9a7` |
| tests/fixtures/repack-expected/SIMPLE_TEST.atlas | 166 B | `aad9dac420283913e0793e4a1b85ce3384dc7126865abcfe21c38fb13d6742ef` |

### SIMPLE_TEST baselines (post-Phase-40 build output)

**Loose-mode PNG SHA256:**

| Output | SHA256 |
|--------|--------|
| images/CIRCLE.png | `42463068eb357a89ea11d4be77230ad982276002dc4d0f2fa3f62894bc13621b` |
| images/SQUARE.png | `feec5d6d08bb609dd086a0e6a2d4b68a6199d054a57ff3c72bb8ab3fac67925f` |
| images/TRIANGLE.png | `3361a431e151e45f72fed27f8e69a536a3d95ff5eee812d4ab4554beb25148d9` |

**Atlas-mode SHA256:**

| Output | SHA256 |
|--------|--------|
| SIMPLE_TEST.atlas | `aad9dac420283913e0793e4a1b85ce3384dc7126865abcfe21c38fb13d6742ef` |
| SIMPLE_TEST.png (page 0) | `bb7fdcd702c79445332cc1643e585af3ebb09fbc51bf832cd32dfaa276bbe380` |

### Expected atlas text (libgdx format, LF line endings)

```
SIMPLE_TEST.png
size:1701,1761
format:RGBA8888
filter:Linear,Linear
repeat:none
CIRCLE
bounds:0,0,699,699
SQUARE
bounds:701,0,1000,1000
TRIANGLE
bounds:0,1002,833,759
```

Single-page pack, 1701×1761 page dims, no rotation (DEFAULT_OPTS allowRotation=false).

## Test Coverage Map

| Requirement | File | Test name | Assertion |
|---|---|---|---|
| REPACK-01 | tests/main/repack.loose-parity.spec.ts | "loose-mode + atlas-mode SHA256 matches the committed baseline" | Every loose PNG + .atlas + page PNG SHA256 == baseline; .atlas text-diff against EXPECTED_ATLAS_PATH |
| REPACK-08 | tests/main/repack.parity.spec.ts | "loaderMode parity: identical ExportPlans produce SHA256-identical .atlas + page PNG bytes" | Two runs with identical ExportPlans yield SHA256-identical .atlas + page PNGs |
| REPACK-09 | tests/main/repack.parity.spec.ts | "sharpen invariant: .atlas SHA256 identical with sharpenEnabled on/off; at least one page PNG differs" | sharpen toggle → .atlas SHA same; ≥1 page PNG SHA differs (pixels changed) |

## Dependency Versions in Baselines

The committed baseline `_meta` records `PENDING` for sharp / maxrects-packer / spine-core because the bootstrap UPDATE_FIXTURES=1 run that populated it ran inside a worktree where node_modules isn't visible to the test process for synchronous package.json reads (UPDATE_FIXTURES path inside the spec doesn't touch package.json). Running `npm run repack:refresh-baselines` (which orchestrates from the repo root) bumps these via the script's `bumpMetaVersions()` step. Declared versions in package.json:

| Dependency | Declared range |
|---|---|
| sharp | ^0.34.5 |
| maxrects-packer | ^2.7.3 |
| @esotericsoftware/spine-core | ^4.2.0 |

When the developer next runs `npm run repack:refresh-baselines` on a fully-installed checkout, the `_meta.sharpVersion` / `maxrectsPackerVersion` / `spineCoreVersion` will be filled in from the actual installed versions. This is harmless — the SHA256 digests themselves are byte-identical regardless of whether _meta is populated.

## Bootstrap Outcome

`UPDATE_FIXTURES=1 npx vitest run tests/main/repack.loose-parity.spec.ts` populated `tests/fixtures/repack-baselines.json` + `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` in 283ms. Followed by `npx vitest run tests/main/repack.loose-parity.spec.ts` (without env flag) → exit 0 in 252ms. Round-trip verified.

Determinism verified by running UPDATE_FIXTURES=1 twice — produced byte-identical `.atlas` text both times (SHA256 `aad9dac420283913e0793e4a1b85ce3384dc7126865abcfe21c38fb13d6742ef` matched). The JSON baseline differs only in the `_meta.generatedAt` timestamp; the actual SHA256 values are byte-identical.

## Workflow Per D-07

- Normal CI run → `npx vitest run` asserts SHA256 against committed baseline → loud failure on any drift.
- Intentional dep bump (sharp / libvips / maxrects-packer / spine-core) → developer runs `npm run repack:refresh-baselines` locally → commits regenerated baseline alongside the dep bump.
- In-test refresh shortcut → `UPDATE_FIXTURES=1 npx vitest run tests/main/repack.loose-parity.spec.ts tests/main/repack.parity.spec.ts` writes hashes in-place; same effect as the script.
- **Neither path runs in CI.** CI stays loud.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stable outDir basename required for deterministic baselines**

- **Found during:** Task 08.2 bootstrap (first UPDATE_FIXTURES=1 run)
- **Issue:** Initial implementation used `fs.mkdtempSync` directly as outDir. `deriveProjectName(outDir)` (src/main/atlas-paths.ts:39) reads `basename(outDir)` and uses it as the projectName root for `.atlas` + page PNG filenames. The random tmp suffix (e.g. `stm-loose-parity-aNKQjS`) leaked into the baseline JSON as the atlas filename key — every test run would produce a different baseline key, preventing round-trip on the second run.
- **Fix:** Create `<tmp>/SIMPLE_TEST` as the outDir (same for the parity spec). deriveProjectName now yields stable `SIMPLE_TEST` projectName → stable `SIMPLE_TEST.atlas` / `SIMPLE_TEST.png` filenames → deterministic baselines.
- **Files modified:** tests/main/repack.loose-parity.spec.ts (outDir setup), tests/main/repack.parity.spec.ts (both describe blocks)
- **Commits:** 1ace2ab (loose-parity), 7d792ca (parity)
- **Verification:** Two consecutive UPDATE_FIXTURES=1 runs produced byte-identical `.atlas` text (`aad9dac4...` both times).

**2. [Rule 3 - Blocker] Direct worker invocation instead of handleStartExport**

- **Found during:** Pre-Task-08.2 reading of src/main/ipc.ts imports
- **Issue:** The plan's `<action>` body called `handleStartExport(evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts)`. Importing `src/main/ipc.ts` brings in `electron` at module-load time, which requires a `vi.mock('electron')` block in every test file (as tests/main/ipc-export.spec.ts L32-43 does). But the test also needs REAL sharp execution to compute SHA256 baselines from real bytes — the existing ipc-export.spec.ts mocks runExport + runRepack to avoid sharp entirely, which is the opposite of what this gate needs.
- **Fix:** Call `runExport` + `runRepack` directly with the same positional args that the 'both' branch of handleStartExport uses internally (src/main/ipc.ts:903-924). Bytes produced are byte-identical — the IPC handler is a thin dispatch wrapper. Matches the existing tests/main/repack-worker.spec.ts idiom.
- **Files modified:** tests/main/repack.loose-parity.spec.ts (import + invocation), tests/main/repack.parity.spec.ts (import + invocation)
- **Commits:** 1ace2ab, 7d792ca

### Architectural Variations (no plan changes needed)

**3. Refresh script delegates to vitest instead of importing workers directly**

- The plan's <action> sketched the script as importing `out/main/repack-worker.js` + `out/main/image-worker.js` (post-build JS). This adds a build dependency (`npm run build` must run first) AND risks script-logic drifting from the assertions in the test specs.
- Implementation: the script invokes `npx vitest run tests/main/repack.loose-parity.spec.ts tests/main/repack.parity.spec.ts` with `UPDATE_FIXTURES=1` set. Vitest already imports the .ts sources natively. After the vitest run completes, the script bumps `_meta` versions by reading `node_modules/sharp/package.json` etc. synchronously.
- Net effect: one code path, no build dependency, no drift risk. The plan's `EXPECTED_ATLAS_DIR` constant is preserved in the script's documented constants for grep traceability.

## Authentication Gates

None encountered. The bootstrap was fully automated via `UPDATE_FIXTURES=1 npx vitest run`.

## Files

### Created

- `scripts/repack-refresh-baselines.mjs` (6486 B) — refresh script
- `tests/fixtures/repack-baselines.json` (868 B) — populated SHA256 baseline JSON
- `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` (166 B) — expected atlas text
- `tests/main/repack.loose-parity.spec.ts` (10447 B) — REPACK-01 gate
- `tests/main/repack.parity.spec.ts` (9470 B) — REPACK-08 + REPACK-09 gates

### Modified

- `package.json` — 1-line `repack:refresh-baselines` script entry

## Commits

- `31e44ee` feat(40-08): add repack-refresh-baselines script + npm entry
- `1ace2ab` test(40-08): add REPACK-01 loose-mode SHA256 baseline gate + bootstrap fixtures
- `7d792ca` test(40-08): add REPACK-08 cross-loaderMode + REPACK-09 sharpen-invariant gates

## Self-Check: PASSED

- File `scripts/repack-refresh-baselines.mjs`: FOUND
- File `tests/fixtures/repack-baselines.json`: FOUND
- File `tests/fixtures/repack-expected/SIMPLE_TEST.atlas`: FOUND
- File `tests/main/repack.loose-parity.spec.ts`: FOUND
- File `tests/main/repack.parity.spec.ts`: FOUND
- Commit `31e44ee`: FOUND
- Commit `1ace2ab`: FOUND
- Commit `7d792ca`: FOUND
- All 3 Phase 40 tests pass: VERIFIED (`npx vitest run tests/main/repack.loose-parity.spec.ts tests/main/repack.parity.spec.ts` → 3 passed in 466ms)
- Full test suite (excluding pre-existing fixture-missing failures): 1153 passed
- Determinism: UPDATE_FIXTURES=1 run twice produced byte-identical `.atlas` text (SHA256 match)
