# Phase 45: Dispatcher User-Facing Flip + Copy/Docs Sweep - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Flip the now-working Spine 4.3 path from "rejected — re-export as Version 4.2"
into first-class supported across everything the **user reads**, and finalize
the test-assertion inversion so no test green-asserts the old reject. The 4.3
runtime + cross-runtime equivalence oracle are already proven (Phase 44); the
dispatch behavior itself is **already done** (Phase 44 `resolveRuntimeTag`).
**Phase 45 changes ZERO runtime/loader behavior.** Delivers:

1. **UX-01** — the drop-zone copy + (already-correct) loader error no longer
   instruct "re-export as Version 4.2"; 4.3 is presented as supported.
2. **UX-02** — every stale "Spine v4.2 only" / "re-export as 4.2" surface in
   **renderer + docs** is swept (App.tsx drop-zone, HelpDialog, README; the
   `errors.ts` strings are already correct-by-construction from Phase 44 D-10),
   a new `CHANGELOG.md` announces 4.3, and the full Phase-44-D-11 enumerated
   reject-test set is re-audited to assert routing for 4.3 while explicitly
   preserving the `<4.2` and `≥4.4` typed throws — backed by a permanent
   anti-false-green vitest guard.

**NOT in scope (do not pull in):** any loader/dispatch/runtime behavior change
(Phase 44, complete); the `errors.ts` loader-error string content (already
landed correct-by-construction, Phase 44 D-10 — Phase 45 does not touch it);
SLIDER-02 closed-form / PERF-01 (Phase 46); spine-player bump (Phase 47);
threading `detectedVersion` into the doc-export payload (deferred — feature-
sized, see Deferred).

</domain>

<decisions>
## Implementation Decisions

### Drop-zone copy & styling (UX-01) — `src/renderer/src/App.tsx:676`

The exact current line (the `else` branch, i.e. the NON-admin path; the sibling
admin-DnD-unavailable advisory in the other branch has its own locked UI-SPEC
copy and is **out of scope**):
`Drop a Spine <span className="font-bold text-danger">v4.2</span> <code>.spine</code> JSON file anywhere in this window`

- **D-01:** New copy: **`Drop a Spine v4.2 or v4.3 JSON file anywhere in this
  window`** (ROADMAP example wording — explicit, advertises the new 4.3
  support).
- **D-02:** **Both** version tokens keep the bold-red `text-danger` emphasis —
  render as `Drop a Spine <span className="font-bold text-danger">v4.2</span> or
  <span className="font-bold text-danger">v4.3</span> JSON file anywhere in this
  window`. The `or` and the rest stay in the existing muted style
  (`text-fg-muted font-mono text-sm`). **User explicitly overrode the
  neutral-styling recommendation** — the red on both tokens is the locked
  decision; do NOT relitigate it back to neutral/no-emphasis.
- **D-03:** Correct the adjacent `.spine` inaccuracy on the same line: **drop
  the `<code>.spine</code>` token entirely**. The app loads exported skeleton
  `.json` / `.stmproj`; `.spine` is the editor project file (CLAUDE.md folder
  conventions). Final phrasing carries no `<code>.spine</code>`. This is
  in-scope copy-correctness on the line already being rewritten, NOT a new
  capability.

### Docs version positioning (UX-02)

- **D-04 (affirmative positioning):** Wherever a Spine version appears in
  user-facing copy, state **"Spine 4.2 and 4.3"** explicitly — NOT generic
  "Spine 4.2+". Confirmed affected surfaces (planner enumerates exhaustively
  via the UX-02 grep, do not assume this list is complete):
  `src/renderer/src/modals/HelpDialog.tsx:128`, `README.md:3`, `README.md:15`,
  `README.md:29`.
- **D-05 (exact supported band):** Docs state the band accurately: supported =
  **Spine 4.2 and 4.3**; **`<4.2` and `≥4.4` are hard-rejected with a typed
  error**. Specifically rewrite `README.md:29`
  ("Spine editor 4.2 or later ... 3.x and earlier are hard-rejected...") to
  reflect BOTH the lower (`<4.2`) AND the new upper (`≥4.4`) reject arms
  (Phase 44 D-09). "4.2 or later" is now technically wrong (implies 4.4+ works).
- **D-06 (CHANGELOG):** **Create a new `CHANGELOG.md` at repo root** with a
  v1.6 entry announcing Spine 4.3 skeleton support (dual-runtime). This is the
  new in-repo release-history surface; future milestones append. There is no
  existing CHANGELOG.md (release notes currently go to GitHub Releases per tag,
  README:5). Format (keep-a-changelog vs project-simple) = planner discretion;
  the entry MUST name **v1.6** + **"Spine 4.3 skeleton support (dual-runtime)"**.
- **D-07 (external surfaces deferred):** GitHub repo description + GitHub
  Releases notes carry the old "Spine v4.2" promise but are **out-of-repo** —
  they cannot be git-swept or test-verified here, and UX-02's clean-grep is
  renderer/docs only. Tracked as a **deferred owner ship-time follow-up**
  (see Deferred). **Not** drafted in-repo (user chose flag-as-deferred over
  draft-in-repo). Phase 45 stays strictly repo-scoped.
- **D-08 (UX-02 grep allowlist — what is stale vs legitimate):** The UX-02 done
  criterion `git grep -i "version 4.2|re-export"` must be clean **in renderer +
  docs only**. These occurrences are LEGITIMATE and must NOT be swept (sweeping
  them is a defect, not progress):
  - `core/` code comments in `errors.ts` / `loader.ts` (explanatory; out of the
    renderer/docs grep scope by design).
  - The `< 4.2` guard, `runtime-42`, fixture/token literals (`skeleton2_42`,
    `4.2-from-4.3.01`), CHANGELOG/release-history entries naming "4.2".
  - The Phase-44-D-10 correct-by-construction `errors.ts` strings
    ("This app supports Spine 4.2 and 4.3", "Re-export as Version 4.3 (or
    4.2)") — these are CORRECT, not stale. Phase 45 does NOT touch `errors.ts`.
  Planner defines the precise allowlist regex; the principle (renderer/docs
  scope, legit-occurrence allowlist) is locked.

### Doc-export HTML disposition (UX-02 surface) — `src/main/doc-export.ts`

- **D-09 (confirm-and-no-op, explicitly dispositioned):** The Documentation
  Builder exported HTML is **grep-clean** (verified 2026-05-18: no
  "4.2"/"re-export"/version string; `renderHero` is `Spine Documentation /
  {skeletonName}`, version-agnostic by design). The ROADMAP SC#2 "Documentation
  Builder HTML template" surface was listed **speculatively** — it carries no
  stale promise. Phase 45 **explicitly records this no-op disposition with the
  grep evidence in the plan** (mirror the D-12 anti-false-green philosophy — do
  not silently skip the surface; prove it's clean). No version line added; no
  `detectedVersion` threading (deferred — see Deferred).

### Test inversion (UX-02 / ROADMAP SC#3)

- **D-10 (acceptance bar = re-audit + standing guard):** Per-file re-audit:
  every 4.3 input asserts **routing** (dispatch target / no throw); every
  `<4.2` and `≥4.4` input **still explicitly asserts the typed throw**
  (narrowed, not deleted). A passing test still asserting the OLD 4.3-reject is
  a **false-green** and is a **phase-blocking defect**, not a pass.
- **D-11 (authoritative scope = FULL Phase-44-D-11 set):** Planner enumerates
  exhaustively with a per-file disposition table (already-correct from
  Phase 44 / needs-inversion / preserve-throw). The set (reconciles ROADMAP
  SC#3's "6 reject-assertion test files" — the 6 pure `.spec` ones — with
  D-11's broader list; the 6 are a subset, Phase 45 owns ALL):
  `tests/core/loader-43-schema-guard-predicate.spec.ts`,
  `tests/core/loader-version-guard-predicate.spec.ts`,
  `tests/core/loader-version-guard.spec.ts`,
  `tests/core/errors-version.spec.ts`, `tests/core/loader.spec.ts`,
  `tests/runtime/d13-43-load-smoke.spec.ts`, `tests/core/ipc.spec.ts`,
  `tests/main/ipc.spec.ts`, `tests/main/viewer-asset-feed-ipc.spec.ts`,
  `tests/safe01/discover-fixtures.ts`. Planner must verify Phase-44's ACTUAL
  per-file state (Phase 44 D-11 already inverted the behavioral assertions to
  keep CI green) — do not blindly rewrite already-correct files; disposition
  each.
- **D-12 (permanent anti-false-green guard):** Add a **permanent vitest guard
  test** (in-suite, runs every CI — NOT a CI grep step, NOT a one-time
  verification). It asserts each in-repo 4.3 fixture
  (`fixtures/SIMPLE_PROJECT_43/skeleton2.json`, `fixtures/SLIDER_4_3/`,
  `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/`) routes to the 4.3 runtime and
  **never** throws `SpineVersionUnsupportedError` / never matches the old
  4.3-reject envelope. Standing regression sentinel against a future re-plan
  silently re-introducing the reject ([[feedback_replan_can_silently_descope_roadmap_contract]]).
  Exact mechanics + location = planner discretion; the
  **standing-and-in-vitest** nature is LOCKED.

### Claude's Discretion

Delegated per [[feedback_delegate_implementation_choices]]:
- `CHANGELOG.md` format/structure (must include v1.6 + "Spine 4.3 dual-runtime
  support"; D-06).
- Exact final HelpDialog / README sentence rewrites (must satisfy D-04
  affirmative + D-05 exact-band; wording within those constraints is
  discretion).
- The anti-false-green guard test's exact mechanics/location (D-12 nature
  locked; shape delegated).
- The UX-02 grep allowlist regex distinguishing stale vs legit "4.2"/"re-export"
  occurrences (D-08 principle locked).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` — Phase 45 owns **UX-01, UX-02** (lines 68–69);
  Traceability rows 144–145.
- `.planning/ROADMAP.md` — Phase 45 entry (lines 153–161): the 3 success
  criteria; the Phase-44 dependency ("flipping user-facing copy before the 4.3
  path is oracle-verified ships a wrong promise"). **SC#3 says "6
  reject-assertion test files" — D-11 here reconciles that to the full
  Phase-44-D-11 set (the 6 are a subset); do NOT narrow back to 6.**

### Prior-phase contracts (the 44→45 split — load first)
- `.planning/phases/44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring/44-CONTEXT.md`
  — **D-10** (the loader-error wordings already landed correct-by-construction;
  Phase 45 does NOT touch `errors.ts` strings), **D-11** (the explicit 44/45
  test-ownership split + the exhaustive affected-file list this phase's D-11
  inherits; the false-green warning). These are the binding contract for
  Phase 45's scope.
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-CONTEXT.md`
  — D-09 (the `<4.2` + `≥4.4` reject band that D-05's exact-band docs wording
  must match).

### Code anchors (read on the way into planning)
- `src/renderer/src/App.tsx:674–678` — the drop-zone `else` branch (D-01/02/03
  target). NOTE the sibling admin-DnD advisory in the same conditional has its
  own LOCKED UI-SPEC copy — out of scope, do not touch.
- `src/renderer/src/modals/HelpDialog.tsx:128` — "reads Spine 4.2+ skeleton
  JSON" (D-04 target).
- `README.md:3, 5, 15, 29` — "Spine 4.2+" phrasings + line 29's lower-bound-only
  reject framing (D-04/D-05 targets); line 5 is the "Latest release" pointer
  (CHANGELOG context, D-06).
- `src/core/errors.ts:85–141` — the Phase-44-D-10 reworked
  `SpineVersionUnsupportedError` strings. **Already correct — reference only,
  DO NOT modify.** Confirms D-08's "these are not stale".
- `src/main/doc-export.ts:260–285` — `renderHero` / `renderChipStrip`;
  version-agnostic (D-09 grep-clean evidence).
- `tests/core/loader-43-schema-guard-predicate.spec.ts`,
  `tests/core/loader-version-guard-predicate.spec.ts`,
  `tests/core/loader-version-guard.spec.ts`,
  `tests/core/errors-version.spec.ts`, `tests/core/loader.spec.ts`,
  `tests/runtime/d13-43-load-smoke.spec.ts`, `tests/core/ipc.spec.ts`,
  `tests/main/ipc.spec.ts`, `tests/main/viewer-asset-feed-ipc.spec.ts`,
  `tests/safe01/discover-fixtures.ts` — the D-11 re-audit set.

### Fixtures (the D-12 guard's positive cases)
- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg, `spine:"4.3.01"`),
  `fixtures/SLIDER_4_3/`, `fixtures/XTRA01_4_3/`, `fixtures/XTRA02_4_3/` —
  all committed in-repo (Phase 44); each must route, never reject (D-12).

### Memory (durable project facts in play)
- [[feedback_replan_can_silently_descope_roadmap_contract]] — D-11 (don't
  narrow the file set back to "6") + D-12 (standing guard against re-plan
  re-introducing the reject).
- [[project_gsd_ui_gate_false_positive_core_phases]] — Phase 45 is
  renderer-copy + docs + tests, NO new UI components/layout → plan with
  `--skip-ui` (the plan-phase grep false-positives on "interFACE"/"rUntIme").
- [[project_renderer_mixblend_preexisting_failure]] — the ~11 `tests/renderer/*`
  MixBlend IMPORT failures are pre-existing, Phase-47-owned; NOT a Phase-45
  regression — trust targeted gates, not raw suite count.
- [[feedback_delegate_implementation_choices]] — the Claude's-Discretion items.
- [[project_phase43_pickruntime_esm_split]] — context only: dispatch already
  resolves across 3 runtimes (Phase 44); Phase 45 changes no runtime behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase-44 dispatch + the in-repo 4.3 fixtures** — fully built; the D-12
  guard consumes them as positive routing cases. No fixture authoring needed.
- **Phase-44-D-10 `errors.ts` envelope** — already correct-by-construction;
  Phase 45 references it as proof D-08's "legit occurrence" set, does not edit.
- **Existing reject-test suite** — Phase 44 D-11 already inverted the
  behavioral assertions for CI-green; Phase 45 re-audits + hardens, not
  rewrites-from-zero.

### Established Patterns
- **Renderer copy lives inline in TSX** (App.tsx drop-zone, HelpDialog
  sections) — straight string/JSX edits, no i18n layer.
- **`text-danger` / `text-fg-muted` / `font-mono` Tailwind tokens** — D-02
  keeps `font-bold text-danger` on both version spans within the existing
  `text-fg-muted font-mono text-sm` paragraph.
- **vitest in-suite gates run every CI** — D-12's standing guard rides this,
  not a bolt-on CI grep.

### Integration Points
- **App.tsx:676 drop-zone `else` branch** — the single user-visible string flip
  (UX-01); everything behind the loader is already runtime-blind + dispatching.
- **New `CHANGELOG.md` at repo root** — net-new file; README:5 "Latest release"
  pointer is the adjacent context.

</code_context>

<specifics>
## Specific Ideas

- **Phase 45 is a pure user-facing + test-assertion phase — zero runtime/loader
  behavior changes.** The dispatch flip was Phase 44's job and is done. If a
  plan proposes any `loader.ts` / `runtime` / dispatch edit, that is scope
  leakage — reject it.
- **The red stays, on both tokens.** The user deliberately overrode the
  "neutral styling" recommendation for the drop-zone (D-02). This is a
  considered aesthetic choice, not an oversight — do not "fix" it to neutral.
- **`errors.ts` is already right.** The strongest anti-pattern risk this phase
  is a sweep that "cleans" the Phase-44-D-10 correct strings or touches the
  `<4.2` guard. D-08's allowlist exists specifically to prevent that.
- **Explicitly disposition the doc-export no-op** (D-09) — record the grep
  evidence in the plan; a silently-skipped surface reads as an unswept one.
- **Fail-loud through-line continues:** D-10/D-11/D-12 chose the strictest
  option (re-audit + permanent standing guard + full file set) consistent with
  Phase 44's D-08/D-12/D-14 posture.

</specifics>

<deferred>
## Deferred Ideas

- **External-surface copy sweep (GitHub repo description + GitHub Releases
  notes)** → **owner ship-time follow-up**, not a phase. Out-of-repo; cannot be
  git-swept or test-verified; UX-02's clean-grep is renderer/docs only (D-07).
  Owner action when v1.6 ships.
- **Per-skeleton "Spine v{detected}" provenance line in the Documentation
  Builder HTML** → deferred (feature-sized: requires threading `detectedVersion`
  through loader → summary → IPC → `DocExportPayload` → `renderHero`; not a
  copy sweep). Candidate for a future polish/observability phase or v1.7
  backlog. NOT scope creep into Phase 45 (D-09 keeps Phase 45 a true sweep).
- **Static "Spine 4.2 / 4.3" meta line in the doc-export HTML** → considered
  and rejected for Phase 45 (user chose confirm-and-no-op; the HTML is
  version-agnostic by design — adding a static support badge is low-value
  noise). Recorded so a later phase doesn't re-discover it as "missed".

</deferred>

---

*Phase: 45-dispatcher-user-facing-flip-copy-docs-sweep*
*Context gathered: 2026-05-18*
</content>
</invoke>
