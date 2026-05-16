# Phase 43: Runtime-Adapter Facade + Verified 4.3 API Mapping - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the two `SpineRuntime` adapter **bodies** behind the Phase-42 interface
scaffold, make the math layer runtime-agnostic, and prove the 4.2 path is
byte-neutral while the 4.3 path samples a real owner rig. Delivers:

1. **RT-02** — `runtime-42.ts` (verbatim relocation of today's `spine-core-42`
   calls — golden-preserving by construction) + `runtime-43.ts` (the new
   Pose-architecture port, written against the *verified research mapping
   tables*, NOT SEED-006). `core/sampler.ts` + `core/bounds.ts` (and
   `core/loader.ts`'s parse seam — see D-02) no longer import any spine-core
   package directly; they call through `load.runtime.*`. New `tests/arch.spec.ts`
   anchor enforces it.
2. **SAFE-02 (HARD PHASE-EXIT GATE)** — every pre-v1.6-baselined in-repo 4.2
   fixture, sampled through the new adapter, is **byte-identical** (strict
   `toEqual` on canonicalized output, not epsilon) to the Phase-42 SAFE-01
   baseline. If it moves, the facade leaks and the port stops.
3. **SAFE-03** — a regression proving each loaded skeleton's attachments resolve
   `instanceof` (Region/Vertex/Mesh) against the same runtime instance that
   loaded it (cross-runtime mis-branching caught, not silent).
4. **PORT-01/02/03** — `runtime-43.ts` samples the real 4.3 owner rig using the
   verified-stable Pose API (`appliedPose`-only world reads, `setupPose*`,
   `setAnimation` overload, `slot.pose.attachment/.color`, `setTrack/getTrack`,
   Region `vertexOffsets` 2nd arg via `getOffsets(slot.pose)`, Vertex `skeleton`
   1st arg, `bone.appliedPose.getWorldScaleX/Y`); the v1.4 Phase-33 rotated-atlas
   offset mechanism re-expressed for 4.3 (no mutable `offset[]`); the 4.2
   rotated-atlas path unchanged + regression-locked.

**NOT in scope (Phase 44/45/46/47 — do not pull in):** loader *version
detection / dispatch*, the `>=4.4` reject arm, `checkSpine43Schema`
rejecter→router repurpose, the 6 reject-assertion test-file inversions, the
cross-runtime **1e-4 equivalence oracle**, the closed-form slider fixture, the
4.3 perf budget, the spine-player bump. Phase 43's loader **hard-picks 4.2**
(D-02).

</domain>

<decisions>
## Implementation Decisions

### 4.3 evidence bar (gray area 1 — premise superseded by a real owner export)

- **D-01:** The owner-blocked 4.3 rig is **already exported and in-repo**:
  `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`"spine": "4.3.01"`, top-level
  `constraints[]` with a `transform` entry, real atlas with `rotate:90`
  regions, committable). Phase 43's 4.3 evidence is therefore **real-rig
  sampled, not smoke-only**: (a) `runtime-43.ts` samples it without throw;
  (b) it exercises every API-mapped surface; (c) it is byte-stable against
  its **own freshly-captured 4.3 baseline** — captured in Phase 43, stored
  **separate** from the SAFE-01 4.2 baseline, **NOT golden-shared** with 4.2
  (ARCHITECTURE §2); (d) its `TransformConstraint` is the `appliedPose`
  correctness canary (Pitfall 2); (e) its `rotate:90` regions exercise the
  PORT-03 4.3 rotated-atlas re-expression. The cross-runtime **1e-4
  equivalence proof stays Phase 44** (it needs the 4.2 sibling). Phase 43's
  **only HARD exit gate remains SAFE-02** (4.2 byte-equal); the 4.3
  own-baseline is a Phase-43 deliverable but a regression sentinel, not the
  phase-stop gate. `fixtures/SPINE_4_3_TEST/` is a 1×1-atlas Phase-32
  parser-reject canary — **NOT** a sampling fixture; do not use it for 4.3
  sampling.

### Loader scope at the 43/44 boundary (gray area 2)

- **D-02:** **Full parse-relocation, hard-pick 4.2.** `loader.ts`'s
  `SkeletonJson` / `TextureAtlas` / `AtlasAttachmentLoader` construction **and**
  the Phase-33 rotated-region patch move into `runtime-42.ts`
  (`parseSkeleton` / `makeAtlas` / `applyRotatedRegionFix`). `loader.ts` drops
  its direct `spine-core-42` import and obtains everything via the runtime.
  The loader **hard-picks `pickRuntime('4.2')` unconditionally** — NO version
  detection this phase (that is Phase 44 DISP-01). Consequence: SAFE-02
  byte-gates the **entire 4.2 path including parse/atlas/rotated-region**
  through the adapter — the largest possible behavior-neutrality surface, by
  design (the point of the gate is to catch silent plumbing drift).

### Wrong-pose-read defense posture (gray area 3 — the existential failure mode)

- **D-03:** **Structural defense-in-depth** (stronger than the research-spec'd
  comment+oracle). `runtime-43.ts` exposes **only `appliedPose`-derived world
  reads** — no raw `bone.pose` / pre-constraint accessor is reachable through
  the adapter surface — plus a dev-mode assertion guarding wrong-pose reads.
  Rationale: reading pre-constraint `pose` compiles fine and silently
  undersizes every constraint-bearing rig with no error (Pitfall 2, "the
  existential failure mode"); D-03 closes it **inside Phase 43**, not after
  Phase 44's oracle exists. This is the single correctness lever the user
  most emphasized.

### Phase-43 exit-gate rigor on heavy/proprietary rigs (gray area 4)

- **D-04:** Phase 43 **cannot CLOSE** until the SAFE-02 byte-equal gate is run
  **locally against the heavy/proprietary rigs** (`fixtures/Girl/`,
  `fixtures/SKINS/`, `fixtures/CHJ/`, `fixtures/3Queens/`, `fixtures/Jokerman/`
  — gitignored, present locally, presence-guarded per Phase-42 D-08-R) **with
  the result documented in verification**. CI-green over the redistributable
  subset is **necessary but NOT sufficient** to close — "subtle drift hides
  exactly there" (Phase-42 D-08) and Phase 43 *is* the behavior-neutrality
  proof.

### ORCL-01 fixture provenance + SAFE-02 set exclusion (consequence of D-01)

- **D-05:** The new `fixtures/SIMPLE_PROJECT_43/` pair — 4.3 `skeleton2.json`
  **+** 4.2 `skeleton2_42.json` (the user-exported same-session sibling: same
  hash `mFDzgNETPHo`, full-precision, `TransformConstraint`-only / non-IK →
  spine-editor#891-immune by design) — is the **Phase-44 ORCL-01 cross-runtime
  oracle pair**. It **postdates the Phase-42 frozen SAFE-01 baseline**, so it
  MUST be **explicitly EXCLUDED** from (i) the SAFE-02 byte-equal regression
  set and (ii) the Phase-42 D-08 auto-discovery/enumeration assertion — it has
  no pre-v1.6 baseline to byte-compare against, so auto-including it would
  *falsely* trip the frozen-set enumeration and/or the gate. Phase 43 touches
  **only the 4.3 file** (runtime-43 sampling + its own 4.3 baseline); the 4.2
  sibling is reserved **untouched** for Phase 44.

### Claude's Discretion

Delegated to research/planning/execution per [[feedback_delegate_implementation_choices]]
(user durably delegates pure-implementation choices):

- SAFE-03 cross-runtime `instanceof` regression mechanics (the *invariant* is
  locked; the test shape is delegated — but see Research Flags: the invariant
  needs an explicit design).
- `runtime-42.ts` verbatim-relocation exact boundary (which calls relocate, the
  `as unknown as Opaque*` boundary-cast shape — quarantined to `brandHandle`/
  `unwrapHandle`).
- `pickRuntime` sync `require()` vs async (ARCHITECTURE §4 recommends a
  conditional sync `require` under the CJS worker bundle so `loadSkeleton`
  stays sync — default lean: sync require).
- electron-vite worker chunk-split so `runtime-42`/`runtime-43` emit as
  separate chunks (only the matched spine-core copy loads per job).
- Fixture internal filenames / any normalization (planner) — directory name
  `fixtures/SIMPLE_PROJECT_43/` is **locked** (Phase-44 CI guard checks it
  char-for-char); internal `skeleton2.*` / `skeleton2_42.*` names are fine.

### Research Flags — gsd-phase-researcher MUST source-confirm before the `runtime-43.ts` body is finalized

- **`RegionAttachment.getOffsets(slot.pose)` exact semantics + the 4.3
  rotated-region re-expression.** Phase-33's mutable `offset[]` patch does not
  exist on stable 4.3 `RegionAttachment`; offsets flow through `Sequence`.
  Confirm the shape against the 4.3.0 tarball before writing the body.
- **The cross-runtime `instanceof` invariant explicit design** (Pitfall 6 —
  "highest correctness risk of the dual-runtime shape"). The interface routes
  attachment-kind via `rt.attachmentKind(a)` (string discriminant); confirm
  `bounds.ts` no longer does `instanceof` at all and SAFE-03 backstops it.
- **The D-03 `appliedPose`-only structural-defense mechanism shape** against
  the actual 4.3.0 `BonePose`/`SlotPose`/`Posed` `.d.ts` surface (what must be
  hidden, where the dev-assertion sits).
- **NEW — atlas-format-is-editor-driven wrinkle:** the 4.3 editor emits the
  **new libgdx atlas format** (`size:W,H` with no `format:`/`repeat:` lines,
  `bounds:x,y,w,h`, `rotate:90`) **even for the "Version 4.2" re-export** —
  both `fixtures/SIMPLE_PROJECT_43/` atlases are new-format. Confirm whether
  `spine-core@4.2.111`'s `TextureAtlas` parser reads the new format (affects
  the **Phase-44 oracle's** 4.2-sibling path through `runtime-42.makeAtlas`)
  and confirm the existing **old-format** 4.2 fixtures (`SIMPLE_TEST.atlas`
  etc.) still parse unchanged through the relocated `runtime-42.makeAtlas`
  (SAFE-02 concern). Not a Phase-43 blocker (the 4.2 sibling is Phase-44), but
  surfaced now so it is not discovered late.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The verified spec (load first — supersedes SEED-006's falsified beta inventory)
- `.planning/research/SUMMARY.md` — the consolidated correction; the Phase-43
  entry; the Phase-43 research flags (`getOffsets` + `instanceof`). **This is
  the spec, not SEED-006.**
- `.planning/research/ARCHITECTURE.md` — §"Beta-vs-Stable Drift"; §2 (4.3 NOT
  golden-shared with 4.2 — own-baseline + cross-runtime sentinel); §4 (worker
  stays runtime-blind, lazy `require`); §5 (loader parse-seam relocation
  shape); the UNIT 2/4/5 decomposition; the facade interface table.
- `.planning/research/STACK.md` — alias mechanics; the load-bearing alias
  *direction* (4.3 canonical / `spine-core-42`=4.2.111); dual-type isolation.
- `.planning/research/PITFALLS.md` — Pitfall 1 (beta drift), **2 (wrong-pose
  undersize — D-03)**, 4 (dual type-universe), **6 (cross-runtime
  `instanceof`)**, 5 (4.2 regression — SAFE-02 order).
- `.planning/research/FEATURES.md` — PORT-01/PORT-02 verified API surface.

### Requirements / roadmap / prior phase
- `.planning/REQUIREMENTS.md` — Phase 43 owns **RT-02, SAFE-02, SAFE-03,
  PORT-01, PORT-02, PORT-03**; the SEED-006-superseded banner.
- `.planning/ROADMAP.md` — Phase 43 entry: 5 success criteria; the 43→44
  dependency (router cannot route to 4.3 until the adapter is byte-neutral on
  4.2).
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-CONTEXT.md`
  — D-06/D-07 (full `SamplerOutput` canonical-JSON baseline), D-08/D-08-R
  (auto-discovery + two-tier heavy-rig coverage — directly governs D-04/D-05),
  D-09 (machine-checked baseline-predates-alias ancestry).
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-OWNER-EXPORT-SPEC.md`
  — the owner-export contract; ORCL-01 (4.3 **done**, 4.2 sibling **done**);
  SLIDER-01/XTRA-01/XTRA-02 still pending owner action (deferred — see below).

### Code anchors (read on the way into planning)
- `src/core/runtime/runtime.ts` — the **locked** `SpineRuntime` interface
  (~40 signatures, inline 4.2/4.3 mapping comments) + `declare function
  pickRuntime`. Phase 43 implements bodies; the interface shape is locked
  (refinement applied: `boneAxisScale(slot)` only, no `OpaqueBone`).
- `src/core/runtime/types.ts` — opaque branded handles +
  `brandHandle`/`unwrapHandle`/`handleRuntime` (bodies present; the single
  sanctioned boundary cast). The two Phase-43 impls construct/unwrap these.
- `src/core/sampler.ts:47-53` — current `from 'spine-core-42'` import block to
  remove; the lifecycle call-sites to route through `rt.*`.
- `src/core/bounds.ts:31-41` — current `from 'spine-core-42'` import (incl.
  the `instanceof` attachment classes) to remove → `rt.attachmentKind`.
- `src/core/loader.ts:40` (`from 'spine-core-42'`) + the parse path
  (`SkeletonJson`/`TextureAtlas`/`AtlasAttachmentLoader`, the Phase-33
  rotated-region patch ~loader.ts:507-608) — relocates into `runtime-42.ts`
  per D-02; `LoadResult.runtime` (`src/core/types.ts:187-190`, optional)
  becomes populated via the hard-coded 4.2 pick.
- `tests/arch.spec.ts:148-164` — Layer-3 invariant + carve-outs; add the
  "sampler/bounds/loader do not import a spine-core package directly" anchor.
- `tests/safe01/phase44-fixture-guard.spec.ts:46` — hard-checks
  `fixtures/SIMPLE_PROJECT_43/` & `fixtures/SLIDER_4_3/` from Phase 44 (the
  reason the directory name is locked).
- Phase-42 SAFE-01 baseline artifacts (the frozen pre-v1.6 4.2 goldens +
  enumeration manifest + the git-ancestry freeze guard) — the SAFE-02
  comparison target; **must not regenerate** (Phase-42 D-09).

### Fixtures
- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (+ `.atlas` + `.png`) — the 4.3
  owner rig Phase 43 samples (D-01).
- `fixtures/SIMPLE_PROJECT_43/skeleton2_42.json` (+ `_42.atlas` + `_42.png`) —
  the same-session 4.2 sibling; **Phase-44 ORCL-01 only**, untouched in Phase
  43 (D-05).
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` etc. — existing old-format 4.2
  fixtures in the SAFE-01 frozen set (the byte-equal regression corpus).

### External
- `https://github.com/EsotericSoftware/spine-editor/issues/891` — the
  4.3→4.2 IK-scramble bug; ORCL-01 is non-IK by design → immune (context for
  why the 4.2 sibling is trustworthy).

### Memory (durable project facts in play)
- [[feedback_delegate_implementation_choices]] — Claude's-Discretion items are
  durably delegated.
- [[feedback_explicit_identity_over_inference]] — runtime tag is a *required*
  handle field; thread, don't infer (governs the adapter boundary).
- [[feedback_npm_alias_port_orphans_bare_consumers]] — alias/consumer topology
  awareness when relocating imports off `spine-core-42`.
- [[project_strict_loadermode_separation]] — atlas-source-only fixtures
  sufficient; math is loaderMode-invariant.
- [[feedback_gitignore_fixtures_check_test_refs]] — the presence-guard /
  two-tier pattern underpinning D-04/D-05.
- [[feedback_replan_can_silently_descope_roadmap_contract]] — Phase 43 has 6
  mapped reqs + 5 SCs; guard against a re-plan silently dropping one.
- [[user_git_experience]] / [[feedback_explain_git]] — narrate the
  fixture-commit + any git steps in plain English.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/core/runtime/runtime.ts` + `types.ts` (Phase-42 scaffold)** — the
  full interface + opaque-handle factory are *already built*; Phase 43 only
  writes the two impl bodies + the `pickRuntime` switch. The interface comments
  already encode the per-method 4.2↔4.3 mapping.
- **Phase-42 SAFE-01 baseline harness** — canonical-JSON serializer +
  auto-discovery + enumeration + git-ancestry freeze guard. SAFE-02 reuses the
  *comparison* path; D-05 requires the auto-discovery/enumeration to **exclude**
  `fixtures/SIMPLE_PROJECT_43/`.
- **`tests/arch.spec.ts` glob import scanner** — extend with the
  no-direct-spine-core-import anchor for sampler/bounds/loader (RT-02).

### Established Patterns
- **`SamplerOutput` = three `Map`s** (`globalPeaks`/`perAnimation`/
  `setupPosePeaks`, `sampler.ts:119-123`) — the exact shape SAFE-02 byte-checks
  (full object, Phase-42 D-06).
- **Layer-3 purity with explicit carve-outs** — `core/runtime/` is pure; only
  `runtime-42.ts`/`runtime-43.ts` legitimately import a spine-core package
  (already a sanctioned core dep; no new carve-out needed per ARCHITECTURE).
- **Opaque handles are threaded, not inferred** — every handle carries a
  required `__rt` tag; a cross-runtime mix is a *compile* error
  ([[feedback_explicit_identity_over_inference]]).
- **Typed-error envelope unchanged** — Phase 43 does not touch loader
  *behavior* (reject/dispatch is Phase 44/45); only the parse *plumbing*
  relocates (D-02).

### Integration Points
- **`loader.ts` parse seam** → `runtime.parseSkeleton`/`makeAtlas`/
  `applyRotatedRegionFix`; `loader.ts` loses its direct spine-core import;
  `LoadResult.runtime` populated via hard-coded `pickRuntime('4.2')` (D-02).
- **`sampler.ts` / `bounds.ts` call-sites** → `load.runtime.*`; `bounds.ts`'s
  `instanceof` chain → `rt.attachmentKind` discriminant.
- **Worker stays runtime-blind** — `loadSkeleton`→`sampleSkeleton` signatures
  unchanged; runtime selected inside `loadSkeleton`; lazy single-copy load.
- **The new `fixtures/SIMPLE_PROJECT_43/` pair** — 4.3 file is Phase-43
  sampled+baselined; 4.2 sibling is Phase-44-reserved (D-05).

</code_context>

<specifics>
## Specific Ideas

- **Structural defense-in-depth (D-03) is the user's most-emphasized
  correctness lever** — `runtime-43.ts` must make a pre-constraint `pose` read
  *unreachable through the adapter surface*, not merely commented against.
- **The 4.3 owner rig is a same-session, same-hash pair** — `skeleton2.json`
  (`spine 4.3.01`) and `skeleton2_42.json` (`spine "4.2-from-4.3.01"`) share
  hash `mFDzgNETPHo` and full-precision geometry; non-IK (TransformConstraint
  only) → spine-editor#891-immune. This makes the Phase-44 oracle genuinely
  sound (far better than the older different-hash `fixtures/SIMPLE_PROJECT/`
  4.2 rig).
- **`"spine": "4.2-from-4.3.01"` is a non-standard version token** — the 4.3
  editor's "Version 4.2" re-export does not stamp a clean `4.2.x`. Harmless
  for Phase 43 (loader hard-picks 4.2), but a **Phase-44 detector concern**
  flagged here so `resolveRuntimeTag` is designed to parse the leading `4.2`.
- **`fixtures/SPINE_4_3_TEST/` is a 1×1-atlas parser-reject canary** (Phase
  32) — confirmed empty/placeholder; never a sampling fixture.
- **D-04 makes a documented local heavy-rig SAFE-02 pass a hard close gate** —
  verification must record it; CI-subset-green alone does not close Phase 43.

</specifics>

<deferred>
## Deferred Ideas

- **Remaining owner exports (user will add when able; off Phase-43 critical
  path):** SLIDER-01 → `fixtures/SLIDER_4_3/` (Phase 46 + Phase-44 CI guard
  hard-check), XTRA-01 → `fixtures/XTRA01_4_3/`, XTRA-02 →
  `fixtures/XTRA02_4_3/` (Phase 44). The user needs to learn the slider /
  multi-map / scaleYMode rig authoring; ORCL-01 (both 4.3 **and** 4.2) is
  **DONE** and is the only owner artifact Phase 43 depends on. Tracked by
  `42-OWNER-EXPORT-SPEC.md` §3–§9 + `tests/safe01/phase44-fixture-guard.spec.ts`.
- **Phase 44/45/46/47 scope explicitly NOT in Phase 43:** loader version
  detection/dispatch + the `>=4.4` arm + `checkSpine43Schema` repurpose
  (Phase 44 DISP); the 6 reject-assertion test-file inversions + copy/docs
  sweep (Phase 45 UX); the cross-runtime **1e-4 equivalence oracle** (Phase 44
  ORCL-02, consumes the `SIMPLE_PROJECT_43` pair); the closed-form slider
  oracle + 4.3 perf budget (Phase 46); the `spine-player` 4.3 bump (Phase 47).
- **Commit of the new `fixtures/SIMPLE_PROJECT_43/` directory** — to be folded
  into Phase 43/44 execution (or committed on request); not part of this
  context commit.

</deferred>

---

*Phase: 43-runtime-adapter-facade-verified-4-3-api-mapping*
*Context gathered: 2026-05-16*
