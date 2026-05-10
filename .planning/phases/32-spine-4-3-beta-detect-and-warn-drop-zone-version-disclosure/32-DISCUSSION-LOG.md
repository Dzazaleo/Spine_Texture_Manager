# Phase 32: Spine 4.3-beta detect-and-warn + drop-zone version disclosure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
**Areas discussed:** Detection signal

---

## Gray Areas Presented

| Option | Description | Selected |
|--------|-------------|----------|
| Detection signal | `skeleton.spine ≥ 4.3` only, `root.constraints` only, or BOTH for defense-in-depth | ✓ |
| Error message split | Branch the SpineVersionUnsupportedError constructor message by detectedVersion vs single template | (deferred to Claude's discretion) |
| Drop-zone copy wording | Exact text at App.tsx:622 with REQ-locked v4.2 bold-danger token | (deferred to Claude's discretion) |
| Test fixture + SEED-006 plant | Committed fixture vs inline-synthesize; SEED-006 file location/content depth | (deferred to Claude's discretion) |

**User's choice:** "Detection signal" only — trusting Claude's discretion on the other three.

---

## Detection Signal

### Q1 — Which detection signal(s) should trigger 4.3-beta rejection?

| Option | Description | Selected |
|--------|-------------|----------|
| Both (OR-of-both) — Recommended | Reject when EITHER `skeleton.spine` parses to >= 4.3 OR `root.constraints` array exists. Defense-in-depth. ~5 LOC overhead. Matches REQ "OR" wording verbatim. | ✓ |
| skeleton.spine semver only | Simpler — extend existing `checkSpineVersion` predicate at loader.ts:119 to reject >= 4.3. ~2 LOC. Risk: malformed/buggy 4.3 export with missing spine field still surfaces cryptic IK error. | |
| root.constraints presence only | Detects actual breaking schema marker. More robust against `spine` field drift. Risk: future 4.3 betas could rename/restructure constraints array (4.3.73-beta uniform→scaleY rename is mid-beta drift precedent). | |
| Both AND-required (conservative) | Only reject when BOTH signals fire. Avoids false positives but risks missing malformed exports. Probably too conservative for the UX goal. | |

**User's choice:** Both (OR-of-both)
**Notes:** Lands in CONTEXT.md as **D-01**. Either signal triggers `SpineVersionUnsupportedError`.

### Q2 — Where should the OR-of-both detection logic live in loader.ts?

| Option | Description | Selected |
|--------|-------------|----------|
| Two predicates, called sequentially — Recommended | Keep `checkSpineVersion` as pure string predicate (preserves 7 unit-test cases). Add new `checkSpine43Schema(parsedJson, skeletonPath)`. Both throw same error class. Each independently unit-testable. | ✓ |
| Extend `checkSpineVersion` signature | Add second arg `parsedJson` to existing predicate. Single source of truth but ripples to 7 unit-test call-sites and mixes 2 concerns (string parsing + object inspection) in 1 function. | |
| Inline the schema check at the call site | Smallest diff. Few lines at loader.ts:172-184. No new exported function. Less unit-testable in isolation — only fixture-driven tests can exercise it. | |

**User's choice:** Two predicates, called sequentially
**Notes:** Lands in CONTEXT.md as **D-02**. Suggested name `checkSpine43Schema`; planner picks final naming.

---

## Claude's Discretion

User selected only one of the four presented gray areas; the other three were left to Claude's discretion. Defaults were proposed in CONTEXT.md as D-03 through D-07:

- **D-03 (Error message):** Branch `SpineVersionUnsupportedError` constructor message internally by `detectedVersion`. Pre-4.2 branch keeps existing template; 4.3+ branch (or `'4.3-schema'` sentinel) gets the COMPAT-01-locked message. `.name` field unchanged (LOAD-BEARING for IPC envelope routing).
- **D-04 (Drop-zone copy):** Minimal in-line insert — `Drop a Spine <span className="font-bold text-danger">v4.2</span> <code>.spine</code> JSON file anywhere in this window`. Smallest diff, smallest layout perturbation.
- **D-05 (Test strategy):** Both layers — predicate unit tests (mirror existing precedent) + fixture-driven end-to-end test. Strict-cut at 4.3+ requires inverting two existing assertions in `loader-version-guard-predicate.spec.ts`.
- **D-06 (Test fixture):** Add `fixtures/SPINE_4_3_TEST/` mirroring `fixtures/SPINE_3_8_TEST/` shape. Synthetic minimal JSON with both detection signals (`spine: "4.3.91-beta"` AND `constraints: [...]`).
- **D-07 (SEED-006 plant):** New `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` mirroring SEED-003 frontmatter. Carries PORT-01..04 inventory verbatim from REQUIREMENTS.md L33-L36 + trigger condition from L38. Plant at phase close with separate commit.

Planner has additional discretion noted in CONTEXT.md "Claude's Discretion" subsection (predicate naming, sentinel string, empty-array handling, inline-span vs shared component, test file split).

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:

- Schema-shim translating 4.3 `root.constraints[]` → 4.2 four-array layout (Out-of-Scope per REQ; SEED-003 Option B HIGH trap risk).
- Vendoring `spine-ts/spine-core` 4.3-beta source (Out-of-Scope per REQ; SEED-006 carries cost-inventory for eventual port).
- `slider` constraint type modeling (Out-of-Scope; deferred to PORT-* via SEED-006).
- Loading 4.3-beta JSONs without re-export (deliberate Out-of-Scope; re-export-as-4.2 IS the supported workflow).
- HelpDialog.tsx:158 copy update (different surface; not in COMPAT-02).
- Elevated-fallback advisory v4.2 callout at App.tsx:603-619 (COMPAT-02 only locks line-622 branch).
- Bespoke "Spine 4.3 detected" rich UI with deep-link to editor docs (v1.4.x or later).
- Local-host UAT against `fixtures/test_4.3/` proprietary fixtures (not CI-coverable; gitignored per SEED-003).

### Reviewed Todos (not folded)

- `2026-04-24-phase-4-code-review-follow-up.md` — weak keyword overlap; orthogonal to v1.4 4.3-compat scope.
- `2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — weak keyword overlap; orthogonal.
- `2026-05-08-phase-31-windows-admin-dnd-release-uat.md` — weak keyword overlap; tracked separately under v1.3.1 release-time UAT.

---

*Discussion completed: 2026-05-10*
*See `32-CONTEXT.md` for the canonical decisions and downstream-agent instructions.*
