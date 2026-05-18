# Phase 45: Dispatcher User-Facing Flip + Copy/Docs Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 45-dispatcher-user-facing-flip-copy-docs-sweep
**Areas discussed:** Drop-zone copy & styling, Docs version positioning, Doc-export HTML version line, Test-inversion acceptance bar

---

## Drop-zone copy & styling

### Wording

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit v4.2 or v4.3 | 'Drop a Spine v4.2 or v4.3 JSON file...' — ROADMAP example; advertises 4.3; re-churns on future Spine releases | ✓ |
| Version-agnostic | 'Drop a Spine skeleton JSON file...' — future-proof, doesn't advertise 4.3 | |
| Compact v4.2 / v4.3 | 'Drop a Spine JSON file (v4.2 / v4.3)...' — parenthetical, less prominent | |

### Styling (version token currently bold-red `text-danger`)

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral, no emphasis | Whole line muted, nothing to warn about (Claude-recommended) | |
| Bold but neutral color | Emphasis without alarm | |
| Keep red emphasis | Retain bold-red on the version token | ✓ |

### Red scope (clarifier — given two-version wording)

| Option | Description | Selected |
|--------|-------------|----------|
| Both version tokens | `v4.2` and `v4.3` each bold-red, `or`+rest muted | ✓ |
| One red span | Whole `v4.2 or v4.3` phrase as one bold-red span | |
| Red on 'v4.3' only | Only the new version emphasized | |

### Adjacent `.spine` → `.json` fix

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, correct it | Drop the inaccurate `<code>.spine</code>` (app loads `.json`/`.stmproj`) | ✓ |
| Leave as-is | Out of strict UX scope; note as deferred nit | |

**User's choice:** Explicit "v4.2 or v4.3" wording; keep bold-red `text-danger` on **both** version tokens (explicitly overriding the neutral-styling recommendation); correct the adjacent `.spine` inaccuracy.
**Notes:** The red-emphasis override is a deliberate aesthetic decision (D-02) — flagged in CONTEXT as "do not relitigate to neutral".

---

## Docs version positioning

### Positioning stance

| Option | Description | Selected |
|--------|-------------|----------|
| Affirmative + changelog | Explicit "Spine 4.2 and 4.3" everywhere + a release/changelog line announcing 4.3 (Claude-recommended) | ✓ |
| Affirmative only | "Spine 4.2 and 4.3" in README/Help, no changelog entry | |
| Minimal de-restrict | Just remove the 4.2-only framing, keep generic "4.2+" | |

### Band precision (README:29 `<4.2` + new `≥4.4` reject)

| Option | Description | Selected |
|--------|-------------|----------|
| State exact band | Supported = 4.2 and 4.3; `<4.2` and `≥4.4` typed-reject (Claude-recommended) | ✓ |
| Lower-bound only | Keep "4.2 or later", mention only `<4.2` reject (now technically wrong) | |

### External surfaces (GitHub repo description / Releases notes)

| Option | Description | Selected |
|--------|-------------|----------|
| Flag as deferred follow-up | Track as out-of-repo owner ship-time task; phase stays repo-scoped (Claude-recommended) | ✓ |
| Draft the text in-repo | Produce suggested copy as an in-repo artifact for paste at ship time | |
| Out of scope, ignore | Don't track at all | |

### CHANGELOG location (clarifier — no CHANGELOG.md exists; releases go to GitHub)

| Option | Description | Selected |
|--------|-------------|----------|
| New CHANGELOG.md | Create CHANGELOG.md at repo root, v1.6 entry, future milestones append (Claude-recommended) | ✓ |
| README 'What's new' | Short line near README:5; no new file | |
| Fold into external follow-up | No in-repo changelog; reverts the changelog part | |

**User's choice:** Affirmative positioning + create a new `CHANGELOG.md`; state the exact supported band; external surfaces deferred as an owner ship-time follow-up.
**Notes:** "Affirmative + changelog" collided with the no-CHANGELOG.md reality; resolved via the follow-up clarifier → new `CHANGELOG.md` at repo root.

---

## Doc-export HTML version line

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm-and-no-op | Exported HTML is version-agnostic + grep-clean; document the no-op disposition; ROADMAP listed it speculatively (Claude-recommended) | ✓ |
| Static support line | Add a static "Spine 4.2 / 4.3" meta line — pure template edit | |
| Per-skeleton version line | Thread `detectedVersion` through loader→summary→IPC→payload; feature-sized | |

**User's choice:** Confirm-and-no-op.
**Notes:** Grounded by a live grep (doc-export.ts has no version string) + the finding that `detectedVersion` is not threaded into the doc payload (only on the error type), making the per-skeleton line feature-sized. Per-skeleton + static-line ideas recorded as Deferred.

---

## Test-inversion acceptance bar

### Done bar

| Option | Description | Selected |
|--------|-------------|----------|
| Re-audit + standing guard | Per-file re-audit + permanent anti-false-green test (Claude-recommended) | ✓ |
| Re-audit only | Per-file rewrite + checklist, no standing guard | |
| Light verification | Trust Phase 44, run suite + spot-check | |

### Guard form

| Option | Description | Selected |
|--------|-------------|----------|
| Test-suite assertion | vitest test in-suite, runs every CI (Claude-recommended) | ✓ |
| CI grep step | grep-based CI step; pattern-brittle, out-of-band | |
| N/A — chose no guard | (only if no guard chosen) | |

### File scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full D-11 enumerated set | All ~10 D-11 files; reconciles ROADMAP-6 vs D-11; planner dispositions each (Claude-recommended) | ✓ |
| ROADMAP-6 only | Only the 6 pure reject-assertion .spec files | |

**User's choice:** Re-audit + permanent in-vitest standing anti-false-green guard; authoritative scope = the full Phase-44-D-11 enumerated set.
**Notes:** Consistent with the milestone's fail-loud posture (Phase 44 D-08/D-12/D-14) and the re-plan-descope memory.

---

## Claude's Discretion

- `CHANGELOG.md` format/structure (must name v1.6 + "Spine 4.3 dual-runtime support").
- Exact final HelpDialog / README sentence rewrites (within the D-04 affirmative + D-05 exact-band constraints).
- The anti-false-green guard test's exact mechanics/location (D-12 nature locked).
- The UX-02 grep allowlist regex distinguishing stale vs legitimate "4.2"/"re-export" occurrences (D-08 principle locked).

## Deferred Ideas

- External-surface copy sweep (GitHub repo description + GitHub Releases notes) → owner ship-time follow-up (out-of-repo).
- Per-skeleton "Spine v{detected}" provenance line in the Documentation Builder HTML → deferred (feature-sized `detectedVersion` plumbing).
- Static "Spine 4.2 / 4.3" meta line in doc-export HTML → considered and rejected for Phase 45 (recorded so a later phase doesn't re-discover it as a miss).
</content>
