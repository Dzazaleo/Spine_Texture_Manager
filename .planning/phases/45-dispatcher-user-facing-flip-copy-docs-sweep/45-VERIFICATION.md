---
phase: 45-dispatcher-user-facing-flip-copy-docs-sweep
verified: 2026-05-18T14:42:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 45: Dispatcher User-Facing Flip + Copy/Docs Sweep Verification Report

**Phase Goal:** Flip the user-facing "re-export as Version 4.2" reject into first-class 4.3 support — only now that the 4.3 path works and the oracle proves it — and sweep every stale 4.2-only surface so the app's promise matches its capability.
**Verified:** 2026-05-18T14:42:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | SC#1 (UX-01): For a 4.3 file, the drop-zone copy AND the loader error no longer instruct "re-export as Version 4.2"; 4.3 presented as supported | ✓ VERIFIED | App.tsx:676 reads `Drop a Spine <span font-bold text-danger>v4.2</span> or <span font-bold text-danger>v4.3</span> JSON file anywhere in this window` (no `.spine` token, admin advisory at :669-673 byte-untouched). Loader-error portion (Phase-44-owned, correct-by-construction): errors.ts:130-141 `ge44` arm = `"This app supports Spine 4.2 and 4.3. Re-export as Version 4.3 (or 4.2)"`; 4.3.x is UNREACHABLE as a reject (routes); old "re-export as 4.2 (supported downgrade)" string deleted. errors.ts byte-identical to phase base c5235837 (locked correct-by-construction). |
| 2 | SC#2 (UX-02): Every stale "Spine v4.2 only" / "re-export as 4.2" surface swept — App.tsx drop-zone, loader/error strings, Documentation Builder HTML, README/INSTALL/Help — renderer/docs grep clean | ✓ VERIFIED | HelpDialog.tsx:128 `reads Spine 4.2 and 4.3 skeleton JSON`; README:3/15 affirmative band; README:29 D-05 exact reject band (`Spine 4.1 and earlier, and Spine 4.4 and later, are hard-rejected at load time with a typed error`). Exhaustive UX-02 grep `git grep -inE 'spine 4\.2\+|4\.2 or later|spine v?4\.2 only|re-export as (version )?4\.2' -- src/renderer README.md INSTALL.md` returns NOTHING (exit 1). ROADMAP-literal `git grep -inE 'version 4\.2\|re-export'` returns only 2 D-08-LEGIT code-comment hits (AppShell.tsx:1312 / DocumentationBuilderDialog.tsx:40 — TS/workflow re-export prose, not version promises). INSTALL.md carries no Spine-version promise (install-guide only). Documentation Builder HTML (doc-export.ts) confirmed version-agnostic by D-09 grep evidence — only match is line-19 TS re-export comment; renderHero/renderChipStrip carry no version string; byte-untouched. CHANGELOG.md (net-new repo root) has v1.6 entry with verbatim `Spine 4.3 skeleton support (dual-runtime)`. |
| 3 | SC#3 (UX-02): Reject-assertion test files assert routing (dispatch target, not exception) for 4.3 inputs; `<4.2` and `≥4.4` throw-cases explicitly preserved (narrowed, not deleted — no false-green) | ✓ VERIFIED | 10-file D-11 disposition audit in 45-02-SUMMARY.md independently re-verified. User-facing path correctly inverted: `resolveRuntimeTag('4.3.01'/'4.3.0'/'4.3.73-beta', ...).toBe('4.3')` (predicate.spec.ts:145/155/159), `loadSkeleton(FIXTURE_43)` routes via `.not.toThrow()`+`handleRuntime(...).toBe('4.3')`+`.not.toBeInstanceOf(SpineVersionUnsupportedError)` (loader-version-guard.spec.ts:117-166, d13-43-load-smoke.spec.ts:223-258). Preserve-throw intact verbatim: `loadSkeleton(FIXTURE_38)` 3.8.99 `.toThrow(SpineVersionUnsupportedError)` (:60); `resolveRuntimeTag('4.4.0'/'5.0.0'/'4.1.99'/'3.8.99', ...).toThrow` (predicate.spec.ts:163-200). The 4.3-token `checkSpineVersion`/`checkSpine43Schema(...).toThrow` cases are isolated Phase-32 standalone primitives, NOT the user-facing decision path (file headers + loader.ts:121-137 comment confirm `resolveRuntimeTag` is the gate, and it routes 4.3) — correctly classified, not false-greens. D-12 standing guard `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` exists, asserts dispatch-target triplet for all 4 in-repo 4.3 fixtures, passes 4/4 under `npx vitest run`. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/App.tsx` | Drop-zone else-branch: dual font-bold text-danger v4.2/v4.3, no .spine | ✓ VERIFIED | Line 676 exact match; admin advisory (:669-673) + wrapping `<p text-fg-muted font-mono text-sm>` (:675) intact; 1-line diff |
| `src/renderer/src/modals/HelpDialog.tsx` | Section-1 sentence "Spine 4.2 and 4.3" | ✓ VERIFIED | Line 128 `reads Spine 4.2 and 4.3 skeleton JSON`; wrapper classes/structure unchanged |
| `README.md` | Lines 3/15 affirmative; line 29 D-05 reject band | ✓ VERIFIED | :3 + :15 `Spine 4.2 and 4.3`; :29 states both `<4.2` and `≥4.4` hard-rejected with typed error |
| `CHANGELOG.md` | Net-new repo-root, v1.6 + "Spine 4.3 skeleton support (dual-runtime)" | ✓ VERIFIED | 19-line net-new file; `## v1.6` heading; verbatim mandatory phrase line 9-13; GitHub-Releases pointer note |
| `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` | Standing guard, dispatch-target triplet, 4 fixtures, ≥25 lines | ✓ VERIFIED | 52 lines; `handleRuntime(loadSkeleton(fx)...).toBe('4.3')` + `.not.toThrow()` + `.not.toBeInstanceOf(SpineVersionUnsupportedError)`; all 4 CONTEXT-named fixtures; passes 4/4 |
| 45-01-SUMMARY.md / 45-02-SUMMARY.md | D-09 disposition + 10-row D-11 audit table | ✓ VERIFIED | D-09 confirm-and-no-op block with pasted grep evidence (45-01:93-112); 10-row D-11 disposition table with verdict+evidence+edited per file (45-02:64-77) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| App.tsx drop-zone else-branch | user-visible 4.3-supported promise | inline-TSX string | ✓ WIRED | Renders in `state.status === 'idle' && !isElevated` branch (:674-677); user-reachable copy |
| README:29 reject band | errors.ts:130-141 typed-error truth | doc wording mirrors errors.ts band | ✓ WIRED | README:29 (`<4.2` + `≥4.4` hard-rejected) accurately mirrors errors.ts `ge44`/`unsupported` arms; verified consistent |
| d12-standing-guard.spec.ts | loader.loadSkeleton + runtime/types.handleRuntime | gated-loader routing assertion | ✓ WIRED | Imports resolve; `handleRuntime(loadSkeleton(fx).skeletonData as unknown as OpaqueSkeletonData).toBe('4.3')` executes green 4/4 against real on-disk 4.3 fixtures (4.3.01/4.3.02) |
| D-11 audit (45-02-SUMMARY) | 10 Phase-44-D-11 test files | per-file read + grep verdict | ✓ WIRED | All 10 rows present with verdict (ALREADY-CORRECT/PRESERVE-THROW/NO-4.3-ASSERT) + line-range evidence; independently spot-verified files 1,2,3,4,6,10 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| d12 standing guard | `loadSkeleton(fx).skeletonData` → `handleRuntime(...)` | Real on-disk 4.3 fixtures (skeleton2.json 4.3.01, SLIDER-01 4.3.02, XTRA-01 4.3.02, XTRA-02 4.3.01) routed through the real loader | Yes — `handleRuntime` returns `'4.3'` for all 4 (load-bearing dispatch-target proof, not bare no-throw) | ✓ FLOWING |
| App.tsx / README / HelpDialog / CHANGELOG | static copy strings | n/a (static user-facing prose) | n/a — version-promise text, no dynamic data source | ✓ VERIFIED (static) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| D-12 standing guard passes (4.3 fixtures route, never reject) | `npx vitest run tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` | Test Files 1 passed (1), Tests 4 passed (4) | ✓ PASS |
| Phase-45 targeted regression (version-guard/schema/error/dispatch/D-12) | `npx vitest run` 6 targeted specs | Test Files 6 passed (6), Tests 79 passed (79) | ✓ PASS |
| Full suite — no behavioral regression | `npx vitest run` | Tests 1277 passed \| 1 skipped \| 2 todo; 11 test FILES fail at IMPORT (pre-existing MixBlend ESM, Phase-47-owned, identical at base c5235837) — 0 actual test failures | ✓ PASS |
| UX-02 grep gate clean | `git grep -inE 'spine 4\.2\+\|4\.2 or later\|spine v?4\.2 only\|re-export as (version )?4\.2' -- src/renderer README.md INSTALL.md` | empty (exit 1) | ✓ PASS |
| Scope-leak guard (src/core + doc-export byte-frozen) | `git diff c5235837..HEAD -- src/core/ src/main/doc-export.ts` | empty (byte-identical) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-01 | 45-01 | For a 4.3 file, drop-zone copy + loader error no longer say "re-export as Version 4.2"; 4.3 presented as supported | ✓ SATISFIED | App.tsx:676 drop-zone flipped; errors.ts loader strings correct-by-construction (Phase-44 D-10, byte-frozen) — SC#1 verified |
| UX-02 | 45-01, 45-02 | Every stale surface swept (App/loader/doc-export/README/INSTALL/Help) + 6→full-10 reject-assertion test files assert routing while preserving `<4.2`/`≥4.4` throws | ✓ SATISFIED | SC#2 grep clean + all surfaces swept/dispositioned; SC#3 10-file audit + D-12 standing guard verified, preserve-throw intact verbatim |

Both PLAN-frontmatter requirement IDs (UX-01, UX-02) cross-referenced against REQUIREMENTS.md:68-69. No orphaned requirements — REQUIREMENTS.md maps exactly UX-01, UX-02 to Phase 45, both claimed by the plans and both satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| README.md | 5 | Stale "Latest release: [v1.3.6]" pointer now adjacent to v1.6 CHANGELOG (45-REVIEW WR-01) | ℹ️ Info | Out of SC#2's narrow grep scope; explicitly deferred per D-07 (external GitHub surfaces are owner ship-time follow-up). NOT a goal gap — the 4.3-support promise is correctly stated everywhere the SCs require. Quality follow-up candidate. |
| tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts | 33-48 | Triple `loadSkeleton(fx)` invocation; first result dead (45-REVIEW WR-02) | ℹ️ Info | Test-efficiency nit; guard still correctly asserts the load-bearing dispatch-target triplet and passes 4/4. Does not weaken the goal. |

No blocker or warning-severity anti-patterns. Both Info items are documented quality observations from 45-REVIEW.md, not Success-Criterion failures.

### Human Verification Required

None. All three Success Criteria are programmatically verifiable and were verified: drop-zone copy is a static string (grep-confirmed), loader error is correct-by-construction Phase-44-owned code (byte-frozen, source-read), the grep gate is deterministic, and the test-routing/standing-guard behaviors were executed (4/4 + 79/79 + 1277 passed). The drop-zone is rendered copy with no dynamic state requiring visual confirmation beyond the verified string content.

### Gaps Summary

No gaps. All 3 ROADMAP Success Criteria are achieved with codebase evidence:

- **SC#1 (UX-01):** The App.tsx drop-zone copy is flipped to first-class "v4.2 or v4.3" (Phase-45-owned portion), and the loader-error portion is satisfied by Phase-44's correct-by-construction errors.ts strings ("This app supports Spine 4.2 and 4.3"), which Phase 45 correctly leaves byte-frozen per its locked zero-runtime-change contract.
- **SC#2 (UX-02):** Every in-scope stale surface is swept (HelpDialog, README:3/15/29) or correctly dispositioned (doc-export D-09 confirm-and-no-op proven with grep evidence; INSTALL.md has no version promise; the 2 broad-grep `re-export` hits are D-08-LEGIT code comments). The renderer/docs UX-02 grep is empty. CHANGELOG.md is net-new with the mandatory v1.6 phrase.
- **SC#3 (UX-02):** The full 10-file Phase-44-D-11 disposition audit is documented with per-file verdict + line-range evidence and independently re-verified — no surviving 4.3-reject false-green on the user-facing path; all `<4.2`/`≥4.4` typed-throws preserved verbatim (narrowed, not deleted, no silent ROADMAP-SC descope). The D-12 permanent in-suite standing guard exists, asserts the load-bearing dispatch-target triplet for all 4 in-repo 4.3 fixtures, and passes under vitest.

The locked scope contract (ZERO runtime/loader/dispatch/errors behavior change; `src/core/*` + `src/main/doc-export.ts` byte-identical to phase base c5235837) is fully upheld. The 11 failing renderer test FILES are the documented pre-existing Phase-47-owned MixBlend ESM import condition (0 actual test failures; identical at base commit) and are correctly out of Phase-45 scope.

---

_Verified: 2026-05-18T14:42:00Z_
_Verifier: Claude (gsd-verifier)_
