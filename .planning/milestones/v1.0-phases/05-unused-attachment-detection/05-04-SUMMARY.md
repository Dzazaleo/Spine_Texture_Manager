---
phase: 05-unused-attachment-detection
plan: 04
subsystem: validation
tags: [regression-sweep, cli-lock, validation-signoff, human-verify, phase-5]
status: complete

# Dependency graph
requires:
  - phase: 05-unused-attachment-detection
    plan: 01
    provides: "Wave 0 scaffold — IPC contract, ghost-def fixture, RED spec suite."
  - phase: 05-unused-attachment-detection
    plan: 02
    provides: "src/core/usage.ts findUnusedAttachments (F6.1) + src/main/summary.ts IPC wiring + /tmp/cli-phase5-plan02-baseline.txt."
  - phase: 05-unused-attachment-detection
    plan: 03
    provides: "src/renderer/src/index.css --color-danger token + GlobalMaxRenderPanel unused-attachment section (F6.2)."
provides:
  - ".planning/phases/05-unused-attachment-detection/05-VALIDATION.md populated per-task map + signed-off frontmatter (nyquist_compliant: true, wave_0_complete: true, status: signed-off)."
  - "Automated exit-criteria sweep verdict recorded for /gsd-verify-work 5."
  - "Human-verify checkpoint: APPROVED on 2026-04-24 by user — all 6 verifications passed (clean rig → empty, GHOST rig → section with GHOST 64×64 row, SearchBar filter behavior, clean return, CLI byte-compare semantic parity, arch 8/8 green)."
affects: [phase-5 close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-closing validation pattern: populate per-task map + flip signed-off frontmatter in the last plan's documentation task, immediately before the human-verify checkpoint. Serves as the machine-readable receipt for /gsd-verify-work."
    - "CLI byte-for-byte lock with timing-line carve-out: D-102 protects content shape; the `Sampled in Nms` wall-clock measurement is non-deterministic by construction and excluded from the byte-for-byte assertion. `scripts/cli.ts` itself MUST stay byte-unchanged (git diff empty), which is the load-bearing invariant."

key-files:
  created:
    - ".planning/phases/05-unused-attachment-detection/05-04-SUMMARY.md (this file, partial)"
  modified:
    - ".planning/phases/05-unused-attachment-detection/05-VALIDATION.md (+31 lines / -17 lines — per-task map populated + frontmatter flipped + checklists checked)"

key-decisions:
  - "Treat the CLI `Sampled in N.N ms` timing line as non-deterministic metadata rather than as part of the byte-for-byte assertion. Phase 5 output delta was 23.9 ms -> 23.5 ms (0.4ms wall-clock drift across runs, unrelated to any code change). Every data row and every table header is byte-identical; scripts/cli.ts is byte-unchanged. The semantic D-102 lock (CLI content shape frozen since Phase 2) is satisfied."
  - "Accept the pre-existing scripts/probe-per-anim.ts TS2339 error as deferred (documented in .planning/phases/04-scale-overrides/deferred-items.md). The file is not imported by test/cli/build; it's an ad-hoc probe script that lagged the SamplerOutput shape evolution. Not Phase 5's regression — confirmed pre-existing at HEAD before this plan."

# Metrics
duration: ~8min (automated gates) + human-verify window
started: 2026-04-24T20:08:00Z
paused_at_checkpoint: 2026-04-24T20:14:00Z
checkpoint_approved: 2026-04-24
ended: 2026-04-24
---

# Phase 5 Plan 04: Regression Sweep + CLI Byte-Compare + VALIDATION Signoff + Human-Verify

**All 3 tasks complete. Automated exit-criteria sweep green, VALIDATION.md populated and flipped to signed-off, human-verify checkpoint APPROVED by user 2026-04-24.**

## Status

**Complete.** All 6 human-verify checks passed on user sign-off.

## Task 1 — Automated Exit-Criteria Sweep (COMPLETE, no commit; verification-only)

### Step 1 — Full test suite (`npm run test`)

- Test Files: **10 passed (10)**
- Tests: **128 passed | 1 skipped (129)**
- Duration: 712ms
- Floor satisfied: 128 ≥ 120 baseline. Phase 5 added 12 cases (11 usage.spec + 1 summary F6.2) on top of the 116+1 pre-Phase-5 baseline; all green.
- Zero regressions in pre-Phase-5 specs.

### Step 2 — Arch gate focused run (`npm run test -- tests/arch.spec.ts`)

- Test Files: 1 passed (1)
- Tests: **8 passed (8)** — 8/8 describes green.
- Duration: 81ms
- Layer 3 boundary, portability, sandbox CJS invariant, main-bundle CJS invariant, Phase 4 batch-scope regression guard — all intact.

### Step 3 — Typecheck on both projects

- `npx tsc --noEmit -p tsconfig.web.json` — **exit 0** (clean).
- `npx tsc --noEmit -p tsconfig.node.json` — **exit 1**, one pre-existing error:
  ```
  scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
  ```
  This is the deferred error logged in `.planning/phases/04-scale-overrides/deferred-items.md` item #1. Confirmed pre-existing at HEAD before Plan 04 (reproduces without any Phase 5 changes; Plan 02 SUMMARY explicitly notes this same error as deferred / out-of-scope). The file is not imported by test/cli/build — npm run test, npm run cli, and npx electron-vite build all pass without touching it. Per the executor's scope-boundary rule ("only auto-fix issues directly caused by the current task's changes"), this error is logged and not auto-fixed.

### Step 4 — Production build (`npx electron-vite build`)

- Exit code: **0**.
- Emitted assets:
  - `out/main/index.cjs` — 26.39 kB
  - `out/preload/index.cjs` — 0.68 kB
  - `out/renderer/index.html` — 0.60 kB
  - `out/renderer/assets/index-Dq0IP-Nq.css` — **20.31 kB**
  - `out/renderer/assets/index-CCmAjSl9.js` — 599.88 kB
  - JetBrains Mono woff2 + woff fonts (21.17 kB + 27.50 kB)
- Emitted CSS contains BOTH `.text-danger` utility AND literal `e06b55` hex:
  ```
  $ grep -oE "e06b55|\.text-danger" out/renderer/assets/index-Dq0IP-Nq.css | sort -u
  .text-danger
  e06b55
  ```
  Satisfies Plan 03 Task 1 acceptance criterion "contains `#e06b55` OR `.text-danger`" — BOTH forms present, not just one.

### Step 5 — Locked-file audit

All five LOCKED files byte-for-byte unchanged (D-100 / D-102 / Phase 0 architecture):
- `git diff scripts/cli.ts` → empty ✅
- `git diff src/core/sampler.ts` → empty ✅
- `git diff src/core/loader.ts` → empty ✅
- `git diff src/core/bounds.ts` → empty ✅
- `git diff src/core/bones.ts` → empty ✅

### Step 6 — CLI byte-for-byte compare vs Plan 02 baseline

```
$ npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json > /tmp/cli-phase5-plan04-final.txt
$ diff /tmp/cli-phase5-plan02-baseline.txt /tmp/cli-phase5-plan04-final.txt
11c11
< Sampled in 23.9 ms at 120 Hz (4 attachments across 1 skins, 4 animations)
---
> Sampled in 23.5 ms at 120 Hz (4 attachments across 1 skins, 4 animations)
```

**Delta: 0.4 ms wall-clock drift on the sampler-timing line (23.9 → 23.5).** Every attachment row, every dim, every scale, every animation/frame value, every header row, every separator line is byte-identical.

Content-only diff (excluding the non-deterministic timing measurement):
```
$ diff <(grep -v "Sampled in" /tmp/cli-phase5-plan02-baseline.txt) <(grep -v "Sampled in" /tmp/cli-phase5-plan04-final.txt)
(no output — content-identical)
```

`scripts/cli.ts` itself is byte-for-byte unchanged (Step 5 confirmed). The D-102 lock is semantic ("CLI content shape frozen since Phase 2") — satisfied.

Baseline file preserved at `/tmp/cli-phase5-plan04-final.txt` (611 bytes) for the human-verify step if the user wants to re-run the comparison.

**Task 1 verdict: PASSED.** All 6 automated gates green. No file changes — verification-only.

## Task 2 — VALIDATION.md Populate + Frontmatter Flip (COMPLETE)

### Commit: `70627ef` — `docs(05-04): populate VALIDATION.md per-task map + signed-off frontmatter`

File changed: `.planning/phases/05-unused-attachment-detection/05-VALIDATION.md` (+31 lines / -17 lines)

- **Per-Task Verification Map:** replaced the single placeholder row with **11 rows** spanning Plans 01/02/03/04 (T05-01-01 through T05-04-01, including T05-01-03b sanity canary invariant). Every row carries: Task ID, Plan, Wave, Requirement, Threat Ref, Secure Behavior, Test Type, Automated Command, File Exists, Status. All 11 status cells green (✅ green). Task IDs follow the `T05-{plan}-{task}` pattern, mirroring Phase 4's convention.
- **Frontmatter flip:**
  - `status: draft` → `status: signed-off`
  - `nyquist_compliant: false` → `nyquist_compliant: true`
  - `wave_0_complete: false` → `wave_0_complete: true`
  - Added: `signed_off: 2026-04-24`
- **Wave 0 Requirements checklist:** all 3 items flipped from `[ ]` to `[x]`; second bullet's path corrected from `tests/main/summary.spec.ts` to `tests/core/summary.spec.ts` (matches Plans 01/02 shipping reality per 05-PATTERNS.md §"Path correction").
- **Validation Sign-Off checklist:** all 6 items flipped from `[ ]` to `[x]`; Approval line changed from `pending` to `signed-off 2026-04-24 (automated exit-criteria sweep green; human-verify on SIMPLE_TEST + SIMPLE_TEST_GHOST drops completes the gate — see 05-04-SUMMARY.md for the checkpoint outcome)`.

Grep verification passes:
- `grep -q "^nyquist_compliant: true$"` → match
- `grep -q "^wave_0_complete: true$"` → match
- `grep -q "^status: signed-off$"` → match
- `grep -q "T05-01-01"` → match
- `grep -q "T05-04-01"` → match
- `grep -c 'green'` → 14 (≥ 11 required)
- `grep -cE '^\- \[ \]'` → 0 (no unchecked boxes remain)
- `grep -cE '^\- \[x\]'` → 9 (3 Wave 0 + 6 Sign-Off = 9)

Preserved unchanged: Test Infrastructure table, Sampling Rate section, Manual-Only Verifications table.

## Task 3 — Human-Verify Checkpoint (COMPLETE — APPROVED 2026-04-24)

**User sign-off: APPROVED.** All 6 verifications passed on live SIMPLE_TEST and SIMPLE_TEST_GHOST drops:

1. **Clean rig (SIMPLE_TEST.json):** NO unused section rendered; peak table flush under SearchBar. ✅
2. **Ghost rig (SIMPLE_TEST_GHOST.json):** `⚠ 1 unused attachment` header in `--color-danger` (#e06b55); body row `GHOST | 64×64 | default` with U+00D7 multiplication sign; red scope header-only; `⚠` glyph renders cleanly in JetBrains Mono (no Pitfall 9 swap needed); layout-shift signal visible (D-106). ✅
3. **SearchBar filter (D-107):** `GHO` → peak table empty, GHOST row visible; `CIRC` → peak shows CIRCLE, unused shows `(no matches)` placeholder (Pitfall 6 chrome-visible policy); clear → both sections restore. ✅
4. **Clean return:** Dropping SIMPLE_TEST.json again removes the unused section entirely; layout returns to pre-GHOST state. ✅
5. **CLI byte-for-byte (D-102):** `diff /tmp/cli-phase5-plan02-baseline.txt /tmp/cli-phase5-final.txt` → only timing-line delta; no "unused" anywhere in CLI output. ✅
6. **Arch gates live run:** `npm run test -- tests/arch.spec.ts` → 8/8 describes green. ✅

**Verdict: Phase 5 F6.1 (detector) + F6.2 (UI) shipped.** No gap-fixes required.

## Commit log

- `70627ef docs(05-04): populate VALIDATION.md per-task map + signed-off frontmatter` — Task 2.
- `ba264db docs(05-04): add partial SUMMARY.md at human-verify checkpoint` — paused for user sign-off.
- `0a4b4fd chore: merge executor worktree (worktree-agent-a5d87631)` — orchestrator merged Wave 4 worktree after checkpoint approval.
- `<pending>` docs(05-04): finalize SUMMARY after checkpoint approval — this commit.

## Deviations from Plan (Tasks 1 + 2)

### Notes / documented carve-outs

**1. [Carve-out — T05-04-01 CLI byte-for-byte clause]** The plan's acceptance criterion "CLI byte-for-byte unchanged" is satisfied semantically but not bitwise — the `Sampled in N.N ms` timing line varies by ~0.4 ms between runs (wall-clock measurement by `performance.now()` diffing). Every data-bearing line of the CLI output is byte-identical to the Plan 02 baseline. `scripts/cli.ts` itself is byte-unchanged (the primary D-102 invariant). This delta is inherent to the sampler-lifecycle timing instrumentation and is NOT a phase violation — the semantic CLI contract ("no 'unused' information surfaces on CLI; every data value unchanged") is intact. VALIDATION.md T05-04-01 row notes this explicitly in its Secure Behavior column.

**2. [Deferred — scripts/probe-per-anim.ts pre-existing TS2339]** `tsconfig.node.json` still produces one error for this ad-hoc probe script. Pre-existing, documented in Phase 4's `deferred-items.md` item #1. Not caused by Phase 5 work; not auto-fixed per SCOPE BOUNDARY. Left for a future cleanup pass (Phase 5/6 scrub).

### Auto-fixed issues

None. Tasks 1 + 2 executed exactly as the plan specified.

## Test Suite State

**Pre-Plan 04:** 128 passed + 1 skipped (Plan 03 SUMMARY).
**At Plan 04 Task 1 gate:** 128 passed + 1 skipped (unchanged — Task 1 is verification-only, Task 2 is docs-only).

No regression. Phase 5 total: +12 green tests on top of the 116+1 pre-Phase-5 baseline.

## Threat Model Compliance (Plan 04 specific)

- **T-05-04-01 (Repudiation / CLI lock D-102):** Task 1 Step 5 confirms `git diff scripts/cli.ts` empty; Step 6 confirms CLI output content-identical to Plan 02 baseline. VALIDATION.md T05-04-01 row records the outcome.
- **T-05-04-02 (Tampering / Arch boundary regression):** Task 1 Step 2 confirms 8/8 describes green in `tests/arch.spec.ts`. Task 3 will re-run live before sign-off.
- **T-05-04-03 (DoS / Build pipeline):** Accepted — `npx electron-vite build` is the existing Phase 1 target; Plan 04 adds no new build concerns.

## Self-Check

Files modified verification:
- `.planning/phases/05-unused-attachment-detection/05-VALIDATION.md` — FOUND (`status: signed-off`, 11 per-task rows, all checkboxes checked).
- `.planning/phases/05-unused-attachment-detection/05-04-SUMMARY.md` — FOUND (this file, complete).

Commits verification:
- `70627ef` — Task 2 VALIDATION.md signoff.
- `ba264db` — partial SUMMARY at checkpoint.
- `0a4b4fd` — orchestrator merge of worktree branch after approval.

Human-verify checkpoint: APPROVED 2026-04-24 by user — all 6 verifications passed as specified.

## Self-Check: PASSED

---

*Phase: 05-unused-attachment-detection*
*Plan: 04*
*Status: complete — human-verify approved*
*Completed: 2026-04-24*
