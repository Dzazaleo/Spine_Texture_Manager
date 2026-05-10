# Phase 32: Spine 4.3-beta detect-and-warn + drop-zone version disclosure - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Make 4.2-only support honest in the loader and visible in the UI. Two requirements + one close-of-phase deliverable:

1. **COMPAT-01 — Loader-side detect-and-warn (`src/core/loader.ts`).** Add a 4.3-detection branch that runs BEFORE `SkeletonJson.readSkeletonData`. Replaces today's misleading `IK Constraint not found: <name>` (or `Transform constraint not found:`) symptom — surfaced when 4.2's spine-core walks `animations.*.ik[name]` against an empty `IkConstraintData[]` because 4.3 stores constraint definitions under a unified `root.constraints[]`. New error throws `SpineVersionUnsupportedError` with the COMPAT-01-locked message: *"This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again."*

2. **COMPAT-02 — Drop-zone advisory restyle (`src/renderer/src/App.tsx:622`).** Restyle the existing `idle`-state copy so the supported version is called out before users drop a file. The `v4.2` token MUST render as `font-bold text-danger` (uses the project's existing Tailwind v4 token; same color class as the "Skeleton not found:" banner at App.tsx:675 and the MissingAttachmentsPanel `text-danger` headers). Pairs visually with COMPAT-01's error.

3. **SEED-006 plant (close-of-phase deliverable, NOT a REQ).** Write a new `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` carrying the costed inventory from the v1.4 milestone investigation: 5 sampler renames + 2 bounds signature changes + slot.pose access + slider validate + vendoring strategy. Mirrors `SEED-003` shape verbatim.

**In scope:**
- New 4.3-schema predicate added to `src/core/loader.ts` (or its companion file).
- Modification of the existing `checkSpineVersion` predicate at `src/core/loader.ts:119` so >= 4.3 throws (currently lenient — see "Lenient on 4.3+" comment at lines 103-105).
- `SpineVersionUnsupportedError` constructor message change in `src/core/errors.ts:88-92` so the COMPAT-01 message lands when the detected version is `>= 4.3` OR a `4.3-schema` sentinel; the existing pre-4.2 message stays for the < 4.2 branch.
- Drop-zone copy edit at `src/renderer/src/App.tsx:622` with the `v4.2` token rendered as `font-bold text-danger`.
- New committed fixture `fixtures/SPINE_4_3_TEST/` mirroring `fixtures/SPINE_3_8_TEST/` (synthetic minimal JSON + atlas + 1 PNG).
- New predicate unit tests for the 4.3-schema check (mirror `tests/core/loader-version-guard-predicate.spec.ts` pattern).
- Update existing `tests/core/loader-version-guard-predicate.spec.ts` so the "lenient on 4.3+" assertions (lines ~40-50, "accepts 4.3.0" + "accepts 5.0.0") invert to expect-throw.
- Fixture-driven end-to-end test for `loadSkeleton(FIXTURE_43)` rejection (mirror `tests/core/loader-version-guard.spec.ts`).
- New `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` (mirror SEED-003 frontmatter shape).

**Out of scope:**
- IPC envelope changes — `SpineVersionUnsupportedError` is already wired through `src/main/ipc.ts`, `src/main/sampler-worker.ts:156-158`, and `src/main/project-io.ts:458/766/964` (see scout findings).
- Renderer-side error display logic — the existing IPC envelope arm carries the `message` string verbatim; the new COMPAT-01 message will surface through the same path with no renderer change required.
- Vendoring `spine-ts/spine-core` 4.3-beta source (Out-of-Scope per REQUIREMENTS.md L49 — mid-beta schema drift).
- Schema-shim translating 4.3 `root.constraints[]` → 4.2 four-array layout (Out-of-Scope per REQUIREMENTS.md L50; SEED-003 Option B labelled HIGH trap risk).
- `slider` constraint type modeling (Out-of-Scope; deferred to PORT-* requirements via SEED-006).
- Rotated atlas region support — owned by Phase 33 (ATLAS-01..04).
- Any `core/sampler.ts` or `core/bounds.ts` changes — those are PORT-01/PORT-02 deferred-future work seeded by SEED-006.
- Drop-zone shape changes (only copy + `v4.2` token style; the `text-fg-muted font-mono text-sm` parent styling stays unless planner discretion warrants otherwise).
- Help dialog copy at `src/renderer/src/modals/HelpDialog.tsx:158` — separate surface, not in COMPAT-02 scope.

</domain>

<decisions>
## Implementation Decisions

### Detection Signal (D-01, D-02)

- **D-01: OR-of-both detection — `skeleton.spine ≥ 4.3` OR `root.constraints` array present.** Either signal triggers `SpineVersionUnsupportedError`. Defense-in-depth: the `skeleton.spine` field catches honest 4.3 exports (every 4.3 editor build seen so far stamps `4.3.x-beta`); `root.constraints` is the actual breaking schema marker and catches edge cases (malformed/buggy exports where `spine` field is absent or wrong). Matches the "OR" wording in REQUIREMENTS.md L13 verbatim. ~5 LOC overhead.
  - **Why:** SEED-003 documents that 4.3 schema is mid-beta unstable (`uniform: bool` → `scaleY: number` rename at 4.3.73-beta is precedent). Trusting a single signal is brittle against either field drift OR exporter bugs. The cost of OR-of-both is trivial; the cost of a missed detection is the cryptic "IK Constraint not found" the phase exists to eliminate.

- **D-02: Two predicates, called sequentially.** Keep `checkSpineVersion(version: string | null, skeletonPath: string)` as a pure string predicate (testable on raw inputs; preserves the 7 existing unit-test cases at `tests/core/loader-version-guard-predicate.spec.ts`). Add a NEW exported predicate — name TBD by planner (suggested: `checkSpine43Schema(parsedJson: unknown, skeletonPath: string)`) — that walks `parsedJson.constraints` (or `(parsedJson as any).constraints`) and throws `SpineVersionUnsupportedError` with `detectedVersion: '4.3-schema'` (sentinel) when the array exists and is non-empty. Both predicates throw the SAME error class. Called sequentially at the existing version-guard insertion site (`src/core/loader.ts:172-184`):
  1. `checkSpineVersion(skel?.spine ?? null, skeletonPath)` first — semver-based fast path.
  2. `checkSpine43Schema(parsedJson, skeletonPath)` second — schema-based fallback for the < 4.3 / no-spine-field cases that slipped through.
  - **Why:** Each predicate stays narrow + independently unit-testable. The string predicate doesn't grow a second concern (object inspection); the schema predicate doesn't carry semver-parsing dead weight. Mirrors the `tests/core/loader-version-guard-predicate.spec.ts` precedent (predicate isolated from fixture-driven loader tests).

### Error Message (Claude's Discretion — D-03 default)

- **D-03: Branch the `SpineVersionUnsupportedError` constructor message by `detectedVersion`.** Two templates inside the constructor body in `src/core/errors.ts:83-95`:
  - **Pre-4.2 branch** (current behavior, untouched): when `major.minor < 4.2`, message stays as `"This file was exported from Spine ${detectedVersion}. Spine Texture Manager requires Spine 4.2 or later. Re-export from Spine 4.2 or later in the editor."`
  - **4.3+ branch** (new): when `detectedVersion` is the literal `'4.3-schema'` sentinel OR semver parses to `major.minor >= 4.3`, message becomes the COMPAT-01-locked `"This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again."` (verbatim from REQUIREMENTS.md L13).
  - The constructor branches internally via a small helper or inline ternary — caller signature unchanged (`new SpineVersionUnsupportedError(detectedVersion, skeletonPath)`).
  - The class `.name` field stays `'SpineVersionUnsupportedError'` (LOAD-BEARING — IPC envelope routing at `src/main/ipc.ts:126` and KNOWN_KINDS Set match by `err.name`; changing it would break the renderer error surface).
  - **Why:** Single class preserves the IPC envelope arm (`src/main/sampler-worker.ts:156-158`, `src/main/project-io.ts:458/766/964`) — no IPC-side ripple. Two distinct messages serve two distinct audiences (3.x users get re-export-as-4.2-or-later; 4.3 users get re-export-as-4.2-specifically). Avoids a generic message that loses the actionable specificity COMPAT-01 demands.
  - Existing `tests/core/errors-version.spec.ts` will need a new test branch covering the 4.3+ message; the pre-4.2 branch's existing assertions stay green byte-for-byte.

### Drop-Zone Copy (Claude's Discretion — D-04 default)

- **D-04: Minimal in-line insert at `src/renderer/src/App.tsx:622`.** Suggested shape (planner refines exact wording):
  ```tsx
  <p className="text-fg-muted font-mono text-sm">
    Drop a Spine <span className="font-bold text-danger">v4.2</span> <code>.spine</code> JSON file anywhere in this window
  </p>
  ```
  - The `v4.2` token sits between "Spine" and the `<code>` block, rendered as `font-bold text-danger` per COMPAT-02 lock.
  - Smallest diff to existing copy + smallest layout perturbation. No two-line wrapping, no separate banner, no addendum sentence — preserves the `text-fg-muted font-mono text-sm` aesthetic of the idle drop-zone.
  - **Why:** COMPAT-02's acceptance is "calls out the supported Spine version explicitly, with `v4.2` rendered as `font-bold text-danger`." The minimum-change variant satisfies that without inviting copywriting drift.
  - **Symmetric callsite check (sketch):** verify the Windows-admin advisory branch at `src/renderer/src/App.tsx:603-619` does NOT need an analogous v4.2 callout — that branch is the elevated-runtime fallback (DnD blocked); the user is being told to use File → Open and isn't dropping at this moment. Planner may choose to mention the version requirement in the elevated-fallback advisory, but COMPAT-02 only locks the `idle && !isElevated` branch at line 622.
  - **Help dialog copy at `src/renderer/src/modals/HelpDialog.tsx:158`** stays out of scope (different surface; not in COMPAT-02). May be revisited in a follow-up if user feedback surfaces help-dialog confusion.

### Test Strategy (Claude's Discretion — D-05 default)

- **D-05: Both layers — predicate unit tests + fixture-driven end-to-end test.** Mirrors the precedent from Phase 12 (F3 version guard) which split tests across three files: predicate-unit (`loader-version-guard-predicate.spec.ts`), fixture-driven (`loader-version-guard.spec.ts`), and error-class-shape (`errors-version.spec.ts`).
  - **Predicate unit tests for `checkSpine43Schema`** — new file or new `describe` block; covers: rejects `{ constraints: [...] }`, rejects `{ constraints: [{type:'ik', ...}] }` (entry shape from SEED-003 §"4.3-beta JSON shape" table), accepts `{ constraints: [] }` (empty array; technically present but trivially false-positive-able — planner decides whether empty-array passes or rejects), accepts `{}` (no constraints field), accepts pre-parsed objects without a top-level `constraints` field.
  - **Predicate unit test inversions** — flip the existing `loader-version-guard-predicate.spec.ts` `accepts 4.3.0` and `accepts 5.0.0` cases (lines ~40-50) to `rejects 4.3.0 (now strict-cut at 4.3+)` and `rejects 5.0.0 (no Spine 5 yet; reject pending future support phase)`.
  - **Fixture-driven end-to-end test** — new file or new test in existing file. Loads `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` via `loadSkeleton(...)`, asserts `SpineVersionUnsupportedError` is thrown, asserts the error message contains the COMPAT-01 wording.
  - **Error-class-shape test addendum** — `tests/core/errors-version.spec.ts` gets one new assertion: when constructed with a `4.3.x` or `'4.3-schema'` `detectedVersion`, `.message` contains the COMPAT-01 wording.
  - **Why:** Strict-cut at 4.3+ is a contract change — every layer that enforced the old "lenient on 4.3+" behavior needs its assertion flipped, and a new layer (schema predicate + fixture) needs its own assertions. Belt-and-suspenders the regression surface.

### Test Fixture (Claude's Discretion — D-06 default)

- **D-06: Add `fixtures/SPINE_4_3_TEST/` mirroring the `fixtures/SPINE_3_8_TEST/` precedent.** Synthetic minimal contents:
  - `SPINE_4_3_TEST.json` — `skeleton.spine: "4.3.91-beta"`, plus a top-level `constraints: [{ name: "test_ik", type: "ik", ... }]` array (mirrors the 4.3 unified-array shape per SEED-003 §"4.3-beta JSON shape"), plus minimal valid 4.2-shape `bones`/`slots`/`skins` so `JSON.parse` succeeds and the predicate sees both signals.
  - `SPINE_4_3_TEST.atlas` — single 1×1 region, mirrors the 3.8 test atlas shape verbatim (so atlas resolution succeeds in the alternate "version-check-runs-AFTER-atlas-resolution" hypothetical regression scenario).
  - `images/` — single 1×1 stub PNG matching the atlas region.
  - **Why:** A committed fixture is the only way to cover the end-to-end `loadSkeleton(...)` path in CI. The 3.8 precedent shows synthetic-fixture-with-real-atlas-and-PNG is the convention. The user's real-world `fixtures/test_4.3/jokerman` and `fixtures/test_4.3/girl` are gitignored (proprietary; per SEED-003 §"Reproduction Fixtures") and cannot be used in the test suite.
  - **Belt-and-suspenders:** the fixture exercises BOTH detection signals in one file (`spine: "4.3.91-beta"` AND `constraints: [...]`), so the test only needs to assert "rejection happened" — it doesn't need to disambiguate WHICH predicate fired. (The predicate-isolation unit tests cover that.)

### SEED-006 Plant Artifact (Claude's Discretion — D-07 default)

- **D-07: New `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` mirroring `SEED-003-spine-4.3-compatibility.md` shape verbatim.** Frontmatter, section headers, and tone align with SEED-003 for consistency. Content sources:
  - **Costed inventory** — copy PORT-01..04 from `.planning/REQUIREMENTS.md:33-36` verbatim.
  - **Trigger condition** — copy from `.planning/REQUIREMENTS.md:38` verbatim.
  - **Sources** — re-cite the same external links SEED-003 already validated (changelog, 4.3-beta CHANGELOG, raw SkeletonJson.ts diff between 4.2 and 4.3-beta).
  - **Cross-link** — section pointing at SEED-003 (which lays the schema-delta groundwork) and at this phase's CONTEXT.md (which closed Option A). SEED-003 itself gets a one-line addendum noting "Option A landed in v1.4 Phase 32; full port queued via SEED-006."
  - **Frontmatter `proposed_phase`** — leave as `TBD (post-4.3.0-stable npm publish)` since the trigger condition is external.
  - Plant at phase close — last commit in the execute sequence, separate from REQ-implementing commits, with message like `docs(seed): plant SEED-006 — full Spine 4.3 runtime port queued`.
  - **Why:** SEED-001 / SEED-002 already followed this precedent (SEED-001 → Phase 21; SEED-002 → Phase 22). The .planning/seeds/ directory is the canonical home for these "future-work" markers. Mirror-shape avoids paperwork drift.

### Claude's Discretion

- Exact predicate name for the schema check (suggested: `checkSpine43Schema`; planner may pick something more idiomatic against the existing `checkSpineVersion` neighbor).
- Sentinel string for `detectedVersion` when the schema predicate fires without a usable version field. Suggested: `'4.3-schema'`. Planner may choose `'4.3+'` or echo the actual `skeleton.spine` value when present.
- Whether `checkSpine43Schema` rejects empty `constraints: []` arrays. Conservative: empty array still rejects (presence of the field at all is a 4.3-shape signal). Liberal: empty array passes (no actual constraint definitions to misread). Recommendation: REJECT empty arrays — the field's presence is the schema marker.
- Inline `<span>` vs Tailwind utility for the bold-danger token. Suggested: inline `<span>` is the smallest diff and matches the App.tsx:675 "Skeleton not found:" pattern. Planner may extract a tiny shared component if the token recurs.
- Predicate test file split — one new file `tests/core/loader-43-schema-guard-predicate.spec.ts` mirroring the existing predicate-spec naming convention, or extending `loader-version-guard-predicate.spec.ts` with a new `describe` block. Planner discretion; the test count is small either way.
- Whether the elevated-fallback advisory at App.tsx:603-619 also surfaces the v4.2 callout. COMPAT-02 only locks the line-622 branch — adding to line-617 is optional polish.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of Truth (Phase Boundary)
- `.planning/REQUIREMENTS.md` §"Spine 4.3 Compatibility (detect-and-warn)" L11-L14 — COMPAT-01 + COMPAT-02 acceptance text (verbatim message strings locked)
- `.planning/REQUIREMENTS.md` §"Future Requirements" L31-L38 — PORT-01..04 inventory + trigger condition (source of SEED-006 content)
- `.planning/REQUIREMENTS.md` §"Out of Scope" L49-L53 — explicit exclusions (vendoring, schema shim, slider type, rotated atlas-less, loading 4.3 without re-export)
- `.planning/ROADMAP.md` §v1.4 Phase 32 entry L9 — full phase description with REQ mapping
- `.planning/seeds/SEED-003-spine-4.3-compatibility.md` — origin seed; documents the 4.2 vs 4.3 schema delta, reproduction fixtures (gitignored), Option A vs B vs C costing, and external-source verification trail. Phase 32 implements Option A; Option C deferred via SEED-006.

### Implementation Sites
- `src/core/loader.ts:119-134` — existing `checkSpineVersion` predicate (semver-based; currently lenient on 4.3+ — comment at lines 103-105 must be updated)
- `src/core/loader.ts:171-184` — existing version-guard insertion site (after `JSON.parse`, before atlas resolution); the new schema predicate slots in here, sequentially after the version check
- `src/core/errors.ts:83-95` — `SpineVersionUnsupportedError` class; constructor message gets the 4.3+ branch
- `src/renderer/src/App.tsx:622` — drop-zone idle copy; v4.2 callout lands here

### Test Sites (existing precedent — mirror these)
- `tests/core/loader-version-guard-predicate.spec.ts` — predicate-unit pattern; assertions for "accepts 4.3.0" + "accepts 5.0.0" must invert
- `tests/core/loader-version-guard.spec.ts` — fixture-driven end-to-end pattern (mirror with new SPINE_4_3_TEST fixture)
- `tests/core/errors-version.spec.ts` — error-class-shape pattern (add a 4.3+ message assertion)
- `fixtures/SPINE_3_8_TEST/` — fixture shape precedent (synthetic JSON + atlas + 1 PNG); mirror this for SPINE_4_3_TEST

### IPC Envelope (no changes — confirms scope boundary)
- `src/main/ipc.ts:118-126` — `KNOWN_KINDS` Set + envelope routing for `SpineVersionUnsupportedError`
- `src/main/sampler-worker.ts:156-174` — sampler-worker envelope arm for `SpineVersionUnsupportedError`
- `src/main/project-io.ts:454-462, 764-770, 964-968` — three project-io envelope arms (skeleton load + project load + reload paths)
- `src/shared/types.ts:908-909` — `kind: 'SpineVersionUnsupportedError'` envelope type

### Project Conventions
- `CLAUDE.md` §"Source of truth" — points at `~/.claude/plans/i-need-to-create-zesty-eich.md` for full design + REQUIREMENTS.md / ROADMAP.md / STATE.md
- `CLAUDE.md` §"Critical non-obvious facts" #4 — math phase does not decode PNGs (preserved; this phase only adds string-parsing-stage logic, no PNG reads)
- `CLAUDE.md` §"Critical non-obvious facts" #5 — `core/` is pure TS, no DOM (Layer-3 invariant; `src/core/loader.ts` predicate addition stays inside this boundary)
- `.planning/seeds/SEED-001-atlas-less-mode.md` + `SEED-002-dims-badge-override-cap.md` — additional examples of the seed-file format SEED-006 will mirror

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SpineVersionUnsupportedError` (src/core/errors.ts:83-95):** Already defined, already wired through IPC, already covered by tests. Reuse the class verbatim — only the constructor's message-generation branches need extension.
- **`checkSpineVersion` predicate (src/core/loader.ts:119-134):** Pure string predicate, exported, unit-tested. The new schema predicate (D-02) mirrors this shape — same throw semantics, same error class, same skeletonPath plumbing.
- **Pre-parsed-JSON insertion site (src/core/loader.ts:171-184):** The existing version guard already runs on the parsed root object, before atlas resolution and before `SkeletonJson.readSkeletonData`. The new schema predicate slots into the same control-flow band — no new parse needed, no new fs I/O.
- **`fixtures/SPINE_3_8_TEST/` (synthetic minimal fixture):** Direct shape precedent for `fixtures/SPINE_4_3_TEST/`. SPINE_3_8_TEST.json:1-7 already shows the minimal `skeleton: { spine, x, y, width, height }` envelope our 4.3 fixture mirrors.
- **`text-danger` Tailwind token:** Used at `App.tsx:675` ("Skeleton not found:" banner with `font-semibold text-danger`), `MissingAttachmentsPanel.tsx:63/73`, `panels/AnimationBreakdownPanel.tsx:765`. Already proven across panels — the v4.2 callout reuses the same class string.
- **Inline `<span>` color-tokenization pattern:** App.tsx:675 (`<span className="font-semibold text-danger">Skeleton not found:</span>`) is the closest existing analog for the v4.2 token shape.

### Established Patterns
- **F3 version-guard precedent (Phase 12 / Plan 05 / D-21):** This phase is the F3 pattern's natural extension upward. Same predicate-tests-fixture-tests-class-tests three-file split.
- **IPC envelope by `err.name` (src/main/ipc.ts:118-126):** All loader errors route through `KNOWN_KINDS`. `SpineVersionUnsupportedError` is already in the Set — no IPC change. The renderer's projectLoadFailed branch (src/renderer/src/App.tsx:660-705) renders `state.error.message` verbatim, so a new error-message template surfaces with zero renderer changes.
- **`detectedVersion` field as the message-branch discriminator:** The class already carries `detectedVersion` as a typed field (errors.ts:84-86). Branching the constructor message on this field uses an existing data flow rather than introducing a new parameter.
- **Predicate hoisting + JSON.parse single-pass (src/core/loader.ts:171):** The existing pattern hoists `JSON.parse` out of `SkeletonJson.readSkeletonData` so the version guard sees the parsed root without a double-parse penalty. The new schema predicate inherits this pattern for free.
- **Layer-3 invariant (locked by `tests/arch.spec.ts`):** `src/core/*` cannot import DOM, Electron, or `sharp`. The new schema predicate is pure TypeScript object inspection — invariant preserved trivially.

### Integration Points
- **Loader → IPC → Renderer error path:** Already complete. `loadSkeleton` throws → sampler-worker.ts:156-158 OR project-io.ts:458/766/964 envelopes → renderer reads `state.error.message`. New COMPAT-01 message rides this path with no plumbing change.
- **Fixture loading test bed:** `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json` is loaded via `path.resolve('fixtures/SPINE_3_8_TEST/...')` from `tests/core/loader-version-guard.spec.ts:30-31`. The 4.3 fixture path mirrors this resolve pattern.
- **`.planning/seeds/` directory:** `SEED-001` (planted, picked up Phase 21), `SEED-002` (planted, picked up Phase 22), `SEED-003` (planted 2026-05-06, picked up by THIS phase's Option A), `SEED-004` (planted 2026-05-08, picked up by Phase 33), `SEED-005` (planted 2026-05-08, deferred). SEED-006 slots in cleanly as the next entry.

</code_context>

<specifics>
## Specific Ideas

- **COMPAT-01 message string is REQUIREMENTS-locked verbatim:** *"This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again."* — match byte-for-byte in the constructor template.
- **`v4.2` token style is REQUIREMENTS-locked:** `font-bold text-danger`. Combination is novel (existing usages tend to pair `text-danger` with `font-semibold` — see App.tsx:675); intentional emphasis bump per COMPAT-02.
- **Detection MUST run BEFORE `SkeletonJson.readSkeletonData`** — REQUIREMENTS-locked at L13. Existing insertion site (loader.ts:171-184) honors this by construction; new predicate slots into the same band.
- **No IPC envelope changes** — existing infrastructure already routes `SpineVersionUnsupportedError` end-to-end. Confirmed via grep across `src/main/` (sampler-worker.ts, project-io.ts, ipc.ts) + `src/shared/types.ts:908-909`.
- **Reject 5.0+ as a byproduct** — strict-cut at 4.3+ also rejects hypothetical Spine 5.x. Acceptable: there's no Spine 5 yet, and any future major release will need a port too. The "accepts 5.0.0 (lenient on any future major)" predicate-test assertion at `loader-version-guard-predicate.spec.ts:48-50` will invert to `rejects 5.0.0`.

</specifics>

<deferred>
## Deferred Ideas

- **Schema-shim translating 4.3 `root.constraints[]` → 4.2 four-array layout** — Out-of-Scope per REQUIREMENTS.md L50; SEED-003 Option B labelled HIGH trap risk. Re-export-as-4.2 is the supported editor downgrade; shim doesn't model `slider` and is brittle against beta drift.
- **Vendoring `spine-ts/spine-core` 4.3-beta source** — Out-of-Scope per REQUIREMENTS.md L49; mid-beta schema drift makes this premature. SEED-006 carries the cost-inventory for the eventual port once 4.3.0 stable lands on npm.
- **`slider` constraint type modeling** — Out-of-Scope; deferred to PORT-* requirements via SEED-006.
- **Loading 4.3-beta JSONs without re-export** — Deliberate Out-of-Scope (REQUIREMENTS.md L53); re-export-as-Version-4.2 IS the supported workflow this phase routes users to.
- **Help dialog copy update at `src/renderer/src/modals/HelpDialog.tsx:158`** — Different surface ("Drop a .json file (or its parent folder) onto the app window, or…"); not in COMPAT-02 scope. May surface as a follow-up if user feedback indicates help-dialog confusion.
- **Elevated-fallback advisory v4.2 callout (App.tsx:603-619)** — COMPAT-02 only locks the `idle && !isElevated` branch at line 622. Adding a v4.2 mention to the elevated branch (line 615-619) is optional polish; not in REQ acceptance.
- **Renderer "version mismatch" rich UI** — Today's `state.status === 'projectLoadFailed'` renders a generic banner with the error message. A bespoke "Spine 4.3 detected" UI with a deep-link to the Spine editor's "File → Export → Version: 4.2" doc could land in v1.4.x or later; out-of-scope for v1.4 Phase 32.
- **`fixtures/test_4.3/` (the user's real proprietary 4.3 fixtures, gitignored per SEED-003 §"Reproduction Fixtures")** — these test the live Joker/Jokerman pipelines but cannot be committed. Local-host UAT post-Phase-32 ship: drop one of those into the running app, confirm the new error message surfaces with the COMPAT-01 wording. Not a CI-coverable test.
- **Phase-13.1 carry-forwards (Linux UAT, macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle)** — orthogonal; tracked in STATE.md → Deferred Items.

### Reviewed Todos (not folded)

- `2026-04-24-phase-4-code-review-follow-up.md` (WR-03 + 6 info findings) — matched on weak keyword overlap (`phase`, `src`, `panels`, `tsx`, `planning`); Phase 4 follow-up is unrelated to v1.4 Spine 4.3 compat scope. Not folded.
- `2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` (Phase 20 cross-platform DnD UAT) — matched on weak keyword overlap; orthogonal. Not folded.
- `2026-05-08-phase-31-windows-admin-dnd-release-uat.md` (Phase 31 release UAT) — matched on weak keyword overlap; tracked separately under v1.3.1 release-time UAT (STATE.md). Not folded.

</deferred>

---

*Phase: 32 — Spine 4.3-beta detect-and-warn + drop-zone version disclosure*
*Context gathered: 2026-05-10*
