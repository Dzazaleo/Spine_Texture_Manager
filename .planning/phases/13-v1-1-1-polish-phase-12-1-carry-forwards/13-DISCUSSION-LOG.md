# Phase 13: v1.1.1 polish — Phase 12.1 carry-forwards — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 13-v1-1-1-polish-phase-12-1-carry-forwards
**Areas discussed:** Polish-scope discipline (phase shape), v1.1.1 release cycle, Stranded rc-tester migration UX, rc-channel naming fold-ins

---

## Initial gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Linux verification path | How to close SC-3 (Linux UPD-* live observation) + the libfuse2 PNG (SC-6 4/4)? Cloud VM vs Docker-only-for-PNG vs physical host vs defer further to v1.2. | ✓ |
| v1.1.1 release cycle structure | Straight to v1.1.1 final, or run a v1.1.1-rc.1 cycle with new dot-prefixed naming to validate the rc-channel fix. | ✓ |
| Stranded rc-tester migration UX | Existing v1.1.0-rc1/2/3 installs can't auto-update to v1.1.1 (the bug we're fixing). Options: no action / out-of-band comms / in-app stuck-rc detector. | ✓ |
| Polish-scope discipline | Strict 4-carry-forward scope, or fold additional 12.1-round papercuts. | ✓ |

**User's choice:** All four selected, with a meta-instruction: "if this is too much to do in one phase, consider dividing this any amount of extra phases you see fit."

**Notes:** Meta-instruction triggered an early phase-shape decision (D-01 split into Phase 13 + Phase 13.1). Linux verification path was deferred to Phase 13.1's own discussion as a result of the split.

---

## Phase shape (meta-question added in response to "consider dividing")

| Option | Description | Selected |
|--------|-------------|----------|
| Split: 13 code/docs + 13.1 live UAT (Recommended) | Phase 13 = 4 code/docs changes + ship v1.1.1. Phase 13.1 = Linux runbook + libfuse2 PNG + macOS/Windows v1.1.0 → v1.1.1 auto-update UAT. Mirrors 12 → 12.1 cadence. | ✓ |
| Single phase 13 covering everything | All 4 carry-forwards + ship + UAT in one phase. Host-blocked on Linux. | |
| Three-way split: 13 code + 13.1 ship-and-mac/win-UAT + 13.2 Linux | Maximum safety; likely overkill. | |
| Strict 4-item scope only, no fold-ins | No CLAUDE.md edit, no workflow guard. | |

**User's choice:** Split: 13 code/docs + 13.1 live UAT
**Notes:** Locks D-01. Linux question moves to Phase 13.1's own discuss.

---

## v1.1.1 release cycle structure

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to v1.1.1 final (Recommended) | Single tag-push, single CI run, single GitHub Release. Skips rc → rc verification of channel-name fix; relies on canonical `v1.1.0 → v1.1.1` final-to-final path (currentChannel=null code path). | ✓ |
| v1.1.1-rc.1 cycle to validate the rc-channel fix end-to-end | rc.1 → rc.2 → final, ~3× CI/UAT effort. Strongest evidence the fix works. | |
| v1.1.1-rc.1 then straight to final (skip rc.2) | One rc to validate cross-channel detection; no same-channel verification. | |

**User's choice:** Straight to v1.1.1 final
**Notes:** Locks D-02. Same-channel rc.1 → rc.2 verification deferred to whatever next prerelease cycle naturally arises (likely v1.2.0-rc.1 if v1.2 chooses an rc cycle).

---

## Stranded rc-tester migration UX

| Option | Description | Selected |
|--------|-------------|----------|
| No in-app action — out-of-band comms only (Recommended) | Discord / email post + release-notes callout; testers eventually click Help → Check for Updates and surface the manual download path. Zero new code. | ✓ |
| In-app stuck-rc detector (one-time notice) | ~30 LoC in `src/main/auto-update.ts`; detects `-rcN` (no dot) installs + cross-checks `/releases/latest` REST endpoint; shows one-time `windows-fallback` UpdateDialog variant. Robust UX, untestable. | |
| No action of any kind | Ship v1.1.1, document in release notes, let testers discover the gap. | |

**User's choice:** No in-app action — out-of-band comms only
**Notes:** Locks D-04. Single-digit tester pool (per PROJECT.md) makes out-of-band comms the lowest-friction path. The in-app detector option was rejected because the bug it mitigates is the same bug that makes the detector itself untestable on stranded installs.

---

## rc-channel naming fold-ins (carry-forward #2 adjuncts)

| Option | Description | Selected |
|--------|-------------|----------|
| Document `rc.N` convention in CLAUDE.md (Recommended) | New "Release tag conventions" section: `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ + one-line rationale + cross-link to root-cause todo. | ✓ |
| release.yml regex guard rejecting non-dot rc tags (Recommended) | Tighten `.github/workflows/release.yml:43-54` to reject `v*.*.*-rcN` patterns at the workflow gate. Structural enforcement. | |
| Skip both fold-ins — strict 4-item scope | Use the convention next time naturally; no docs, no guard. | |

**User's choice:** Document `rc.N` convention in CLAUDE.md (only)
**Notes:** Locks D-05. Workflow-level regex guard deliberately dropped — overkill for a single-developer project; CLAUDE.md docs are sufficient. The convention activates the next time a prerelease tag is pushed.

---

## Final check — write context now or discuss cosmetic-fix verification

| Option | Description | Selected |
|--------|-------------|----------|
| Write CONTEXT.md now (Recommended) | All major decisions captured. Cosmetic Windows fixes are 1-line / 1-block edits; implementation approach unambiguous. | ✓ |
| Add: cosmetic-fix verification approach | Discuss whether to add automated source-grep regression test for `autoHideMenuBar: false` and `app.setAboutPanelOptions(...)` call sites. | |

**User's choice:** Write CONTEXT.md now
**Notes:** Cosmetic-fix verification approach left as Claude's discretion at plan time per D-07 (source-grep test is a judgment call).

---

## Claude's Discretion

- Exact placement of the new CLAUDE.md "Release tag conventions" section.
- Whether to add a single source-grep regression test for the two `src/main/index.ts` edit sites.
- Exact wording of the v1.1.1 release-notes "stranded rc tester" callout.
- Whether the version bump + tag are one task or two within Phase 13's plan.

## Deferred Ideas

- Linux runbook execution → Phase 13.1.
- libfuse2 PNG capture → Phase 13.1.
- macOS / Windows v1.1.0 → v1.1.1 auto-update lifecycle UAT → Phase 13.1.
- Windows windows-fallback variant live observation → Phase 13.1 (or later).
- rc → rc same-channel auto-update verification → naturally arises only if v1.2 chooses an rc cycle.
- Workflow-level regex guard for non-dot rc tags → v1.2 milestone or beyond.
- In-app stuck-rc detector → rejected (untestable).
- TEL-01..07 crash + error reporting → descoped 2026-04-28.
