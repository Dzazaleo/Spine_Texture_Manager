---
phase: 00-core-math-spike
plan: 06
subsystem: core-cli
tags: [typescript, tsx, cli, thin-wrapper, headless, argv-parse, exit-codes]

# Dependency graph
requires:
  - phase: 00-02
    provides: "src/core/loader.ts — loadSkeleton() returns LoadResult; src/core/errors.ts — SpineLoaderError base + subclasses"
  - phase: 00-03
    provides: "(indirect via sampler) src/core/bounds.ts — attachmentWorldAABB + computeScale"
  - phase: 00-04
    provides: "src/core/sampler.ts — sampleSkeleton(load, opts?) + DEFAULT_SAMPLING_HZ + PeakRecord"
provides:
  - "scripts/cli.ts: `npm run cli -- <path/to/skeleton.json> [--hz 120]` — thin wrapper. Parses argv, calls loadSkeleton + sampleSkeleton, renders a plain-text table with 7 columns (Attachment, Skin, Source W×H, Peak W×H, Scale, Source Animation, Frame), prints an elapsed-ms footer, exits 0 on success."
  - "Structured exit codes: 0 success, 1 unexpected, 2 bad args, 3 SpineLoaderError subclass."
  - "Typed-error handling: instanceof check on SpineLoaderError surfaces clean `name: message` to stderr (no stack trace) for the error subclass; unexpected errors fall back to a stack trace."
affects: [00-07]

# Tech tracking
tech-stack:
  added: []  # No new deps — uses tsx (installed in 00-01) + existing spine-core
  patterns:
    - "Thin-wrapper CLI: zero duplicated math, zero bespoke loader/sampler logic. Calls `loadSkeleton` then `sampleSkeleton` and formats the result — nothing else."
    - "Hand-rolled table renderer (no dep): compute column widths from rows, pad with spaces, two-space column separator (no pipes) — keeps output diff-friendly for the smoke checker in plan 07. CONTEXT.md explicit preference."
    - "Structured exit codes beyond success/error: 0/1/2/3 distinguish success/unexpected/bad-argv/SpineLoaderError for CI-friendliness. CONTEXT.md only requires zero/non-zero; the finer granularity is the planner's discretion."
    - "argv parse starts at argv[2]: npm forwards everything after `--` to the script; tsx sets process.argv[2] to the first forwarded arg. Works with the locked invocation `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`."

key-files:
  created:
    - "scripts/cli.ts (150 lines)"
  modified: []
  deleted: []

key-decisions:
  - "Kept exit-code split at 1/2/3 (plus 0) rather than collapsing to 0/1 — CONTEXT.md § CLI Contract only requires zero/non-zero, but finer codes are CI-friendly and cost zero complexity. Unexpected errors (code 1) surface a stack trace to stderr; SpineLoaderError subclasses (code 3) surface only `name: message` (no stack — threat T-00-06-01 mitigation, information disclosure). Bad argv (code 2) surfaces the Error message only."
  - "Two-space column separator (no pipes) — CONTEXT.md's hand-rolled-preferred stance plus plan 07's smoke checker benefits from text that diffs cleanly."
  - "Row sort key is (skinName, slotName, attachmentName) — deterministic, human-readable grouping. Default skin comes first alphabetically for multi-skin rigs; within a skin, slots are grouped; within a slot, attachments are alphabetical."
  - "Table header uses `Source Animation` (two words with a capital A) to match CONTEXT.md's § CLI Contract column spec exactly — the plan's automated grep gate `grep -q \"Source Animation\"` requires the literal two-word form."
  - "Commit scope `(00-06)` per GSD executor protocol rather than plan example's `phase-00` literal — consistent with plans 00-02 / 00-03 / 00-04 / 00-05."

patterns-established:
  - "CLI wrapper template: import loader + sampler + error base class, parseArgs → loadSkeleton → performance.now timing around sampleSkeleton → renderTable → stdout/stderr write → process.exit. All other logic sits in `src/core/`."
  - "Error-to-stderr separation: structured errors (SpineLoaderError subclasses) print `name: message` cleanly; unexpected errors surface a stack. Stdout is reserved for the table + footer only — CLI pipelines like `| grep` or `| diff` see only success output."

requirements-completed: [F2.1, F2.2, F2.5, F2.6]

# Metrics
duration: 2min
completed: 2026-04-22
---

# Phase 0 Plan 06: Headless CLI Entrypoint Summary

**Thin `scripts/cli.ts` wrapper — `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` loads the skeleton via `loadSkeleton`, samples via `sampleSkeleton`, renders a 7-column plain-text table (Attachment, Skin, Source W×H, Peak W×H, Scale, Source Animation, Frame) with an elapsed-ms footer — exits 0 on success, 3 on typed loader error, 2 on bad argv.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-22T12:27:52Z
- **Completed:** 2026-04-22T12:29:17Z
- **Tasks:** 2 (1 implement + 1 atomic commit)
- **Files created:** 1 (scripts/cli.ts, 150 lines)
- **Files modified:** 0
- **Files deleted:** 0
- **Tests:** 35 passed + 1 skipped (unchanged from plan 00-05 — the CLI has no separate test suite; its behavior is verified end-to-end via `npm run cli` against the fixture)
- **CLI elapsed on fixture:** 9.3 ms (consistent with plan 00-04's 9.7 ms sampler smoke measurement; 50× under the N2.1 500 ms gate)

## Accomplishments

- `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` exits 0 and prints the full 7-column table with 4 attachment rows (CIRCLE, SQUARE, SQUARE2/SQUARE, TRIANGLE).
- Missing-path invocation (`npm run cli -- /tmp/does-not-exist-stm-xyz.json`) exits 3, prints `SkeletonJsonNotFoundError: Spine skeleton JSON not found or not readable: …` to stderr — typed error surface intact.
- No-argv invocation (`npm run cli`) exits 2 with a usage message.
- `--hz 60` argv override accepted (parseArgs validates via `Number.isFinite(n) && n > 0` — T-00-06-02 mitigation).
- `--help` / `-h` prints usage and exits 0.
- Unknown flags print `Unknown flag: …` to stderr and exit 2.
- `npx tsc --noEmit` exits 0 under strict mode.
- `npm test` still passes 35/35 + 1 skip (CLI adds no tests, breaks no tests).
- Thin-wrapper discipline preserved: `scripts/cli.ts` imports from `src/core/loader.js`, `src/core/sampler.js`, `src/core/errors.js` — zero reimplementation of loader/sampler/error logic.

## Task Commits

1. **Task 1: Implement scripts/cli.ts** — staged into Task 2's commit.
2. **Task 2: Commit CLI** — `8365ce2` (feat(00-06)).

## Files Created/Modified

- `scripts/cli.ts` (NEW, 150 lines) — module body:
  - Shebang `#!/usr/bin/env -S tsx` (informational; script runs via `tsx` through `npm run cli`).
  - `parseArgs(argv)` — accepts `--hz <n>`, `--samplingHz <n>`, `--help | -h`, one positional path. Throws on invalid or missing inputs.
  - `renderTable(peaks)` — hand-rolled string formatter; computes column widths from rows, two-space separator, deterministic sort by (skin, slot, attachment).
  - `main()` — parseArgs → loadSkeleton → performance.now timing around sampleSkeleton → renderTable → footer → process.exit with the structured exit code.
  - Exit codes: 0 success, 1 unexpected, 2 bad argv, 3 SpineLoaderError subclass.

## Full CLI Output (fixture smoke run, first 30 lines)

```
> spine-texture-manager@0.0.0 cli
> tsx scripts/cli.ts fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json

Attachment         Skin     Source W×H  Peak W×H       Scale  Source Animation  Frame
-----------------  -------  ----------  -------------  -----  ----------------  -----
CIRCLE/CIRCLE      default  699×699     1635.9×1669.5  2.388  PATH              0
SQUARE/SQUARE      default  1000×1000   2102.8×2102.8  2.103  PATH              0
SQUARE2/SQUARE     default  1000×1000   607.1×607.1    0.607  PATH              40
TRIANGLE/TRIANGLE  default  833×759     2164.4×2213.4  2.916  PATH              58

Sampled in 9.3 ms at 120 Hz (4 attachments across 1 skins, 4 animations)
```

**Elapsed-ms footer number: 9.3 ms** (reproduced stably at 9–10 ms across multiple runs; identical to plan 00-04's sampler smoke).

## Decisions Made

- **Exit codes split 0/1/2/3 instead of collapsing to 0/non-zero.** CONTEXT.md § CLI Contract only requires "Zero exit code on success, non-zero on loader error"; the finer granularity (1 = unexpected with stack trace, 2 = bad argv, 3 = typed SpineLoaderError with clean message) costs zero complexity and is CI-friendly. Future test harnesses or shell scripts can distinguish "user passed bad path" from "internal bug" without parsing stderr. Documented in the module header.
- **Two-space column separator, no pipes.** CONTEXT.md prefers hand-rolled, and plan 07's smoke checker will likely diff the output — plain-text padded columns diff cleaner than `|`-delimited text.
- **Sort key is (skin, slot, attachment).** Deterministic, human-readable. Groups attachments by skin first (important when multi-skin support lands), then by slot (shared attachment names like SQUARE on SQUARE and SQUARE2 sort separately), then by attachment name.
- **Table header `Source Animation` matches the plan's grep gate.** The plan's automated verification grep is `grep -q "Source Animation" scripts/cli.ts`. Using the literal two-word form (not "SourceAnim", not "Source Anim.") keeps the grep passing.
- **StubTexture / createStubTextureLoader not imported.** The CLI only consumes the loader's output — it never fabricates its own stubs. The CLI is a pure consumer of the core API.
- **Commit scope `(00-06)` per GSD executor protocol.** Plan's Task 2 example used `feat(phase-00): …`; executor protocol specifies `{phase}-{plan}` = `00-06`. Consistent with 00-02 / 00-03 / 00-04 / 00-05. Plan's literal grep `git log --oneline -1 | grep -q "phase-00"` would fail on the GSD scope — documented as a minor scope convention deviation (identical to prior plans).

## Deviations from Plan

### Auto-fixed Issues

**1. [Minor deviation] Commit scope `(00-06)` per GSD executor protocol rather than plan example's `phase-00` literal**

- **Found during:** Task 2 commit.
- **Issue:** Plan's Task 2 action example shows `git commit -m "feat(phase-00): ..."` and its acceptance grep is `git log --oneline -1 | grep -q "phase-00"`. GSD executor protocol specifies scope = `{phase}-{plan}` = `00-06`; plans 00-02 through 00-05 all used the specific form.
- **Fix:** Used `(00-06)` scope on the commit. Plan's intent (verify the commit is for this phase/plan) is satisfied by the more specific tag. The literal `phase-00` grep would fail; the `00-06` grep succeeds.
- **Verification:** `git log --oneline -1 | grep -q "00-06"` exits 0; `git log --oneline -1` shows `8365ce2 feat(00-06): CLI entrypoint prints per-attachment peak table`.

---

**Total deviations:** 1 (minor scope convention — identical pattern to prior plans)
**Impact on plan:** Zero scope creep. Externally observable contract (file location, command invocation, output shape, exit codes, error-to-stderr behavior) matches the plan exactly.

## Auth Gates

None. The CLI is fully headless — no external services, no authentication, no network.

## argv-parsing quirks discovered

- **npm forwards after `--`:** `npm run cli -- fixtures/…/SIMPLE_TEST.json` becomes `tsx scripts/cli.ts fixtures/…/SIMPLE_TEST.json`; `process.argv[2]` is the fixture path. No special handling needed beyond `for i = 2; i < argv.length`.
- **`tsx` does NOT inject a `--` sentinel into argv** — the positional path lands directly at `argv[2]`. If the invocation were changed to `tsx scripts/cli.ts -- foo.json`, argv would be `[node, script, '--', 'foo.json']`; the parseArgs loop's `!a.startsWith('-')` check would push both `--` and `foo.json` into `positional`, then the length-1 check would fail. Current behavior is exactly right for the locked invocation; a future enhancement could explicitly skip `--` if it appears.
- **Number.isFinite vs Number.isNaN:** parseArgs uses `!Number.isFinite(n)` which correctly rejects `NaN`, `Infinity`, and `-Infinity` all in one check. `--hz NaN` throws `Invalid --hz value: NaN`; `--hz -5` throws the same (via the `n <= 0` branch). T-00-06-02 mitigation preserved — no silent acceptance of pathological values.
- **No issue with `--hz` placement:** `--hz 60 fixtures/…/SIMPLE_TEST.json` works identically to `fixtures/…/SIMPLE_TEST.json --hz 60` — parseArgs scans linearly, doesn't care about order.

## Known Stubs

None. The CLI is a complete, real consumer of real loader+sampler output. No placeholders, no TODOs, no mock data.

## Threat Mitigation Audit

| Threat ID | Disposition | Mitigation Applied |
|-----------|-------------|-------------------|
| T-00-06-01 (stderr info disclosure — error stack leak) | mitigate | `instanceof SpineLoaderError` branch prints ONLY `${e.name}: ${e.message}` — no stack trace. Only the last-resort "unexpected error" fallback prints a stack, and that path only fires on genuinely unexpected exceptions (not reachable from loader contract). Verified empirically: `npm run cli -- /nonexistent` stderr has zero stack lines. |
| T-00-06-02 (DoS via huge `--hz`) | mitigate | parseArgs requires `Number.isFinite(n) && n > 0`. `--hz 1e9` would produce dt = 1e-9 and loop effectively forever — but CONTEXT.md explicitly accepts this for a local dev tool. No ceiling added in Phase 0. Acceptance preserves the "planner's discretion" fingerprint in plan's threat register. |
| T-00-06-03 (shebang execution) | accept | Shebang is informational; script runs via `tsx` (npm script), not directly. No +x permissions required or set. |

## Acceptance Criteria Verification

All plan acceptance criteria pass:

- `scripts/cli.ts` exists ✓
- `npx tsc --noEmit` exits 0 ✓
- `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` exits 0 ✓
- Stdout contains `CIRCLE`, `SQUARE`, `TRIANGLE`, `Attachment`, `Source Animation`, `Sampled in` ✓ (grep-verified)
- `npm run cli -- /tmp/does-not-exist-stm-xyz.json` exits 3 (non-zero) AND prints `SkeletonJsonNotFoundError` to stderr ✓
- `grep -q "loadSkeleton" scripts/cli.ts` and `grep -q "sampleSkeleton" scripts/cli.ts` both succeed ✓
- Plan's exhaustive grep chain (`loadSkeleton` + `sampleSkeleton` + `SpineLoaderError` + `Source Animation` + `Source W×H` + `process.exit` + CIRCLE + SQUARE + TRIANGLE + `Sampled in`) all pass ✓

## Next Phase Readiness

- **Plan 00-07 (exit-criteria sweep + human-verify checkpoint)** is unblocked. The CLI is the human-readable verification surface the user will eyeball before advancing Phase 0 to COMPLETE. All 7 phase-0 plans' primary deliverables are now green end-to-end.
- The sampler's end-to-end pipeline (JSON → atlas → skeleton data → per-attachment world AABB → per-(skin, slot, attachment) peak → plain-text table) is proven on the fixture in 9.3 ms wall time.
- **Phase 1 (Electron + React scaffold)** can directly reuse `loadSkeleton` and `sampleSkeleton` from a React hook or main-process handler — the contract is now frozen and the CLI's argv-parse + render logic is a template for the renderer's panel code.
- **No blockers.** All plan acceptance criteria, success criteria, and verification gates pass.

## Self-Check: PASSED

Verified 2026-04-22T12:29:17Z:

- `[ -f scripts/cli.ts ]` ✓ (150 lines)
- `git log --oneline | grep 8365ce2` ✓
- `git log --oneline -1 | grep -q "00-06"` ✓
- `npx tsc --noEmit` exit 0 ✓
- `npm test` 35/35 pass + 1 skipped ✓
- `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` exit 0, stdout contains CIRCLE, SQUARE, TRIANGLE, Attachment, Source Animation, Sampled in ✓
- `npm run cli -- /tmp/does-not-exist-stm-xyz.json` exit 3, stderr contains SkeletonJsonNotFoundError ✓
- `npm run cli` (no args) exit 2, stderr contains Usage ✓
- `grep -q "loadSkeleton" scripts/cli.ts` ✓
- `grep -q "sampleSkeleton" scripts/cli.ts` ✓
- `grep -q "SpineLoaderError" scripts/cli.ts` ✓
- `grep -q "Source Animation" scripts/cli.ts` ✓
- `grep -q "Source W×H" scripts/cli.ts` ✓
- `grep -q "process.exit" scripts/cli.ts` ✓
- `git status --porcelain scripts/cli.ts` empty ✓
- Post-commit deletion check: no unexpected deletions ✓

---
*Phase: 00-core-math-spike*
*Completed: 2026-04-22*
