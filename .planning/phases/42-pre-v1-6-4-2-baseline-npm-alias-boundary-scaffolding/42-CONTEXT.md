# Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 42 de-risks the entire v1.6 dual-runtime milestone. It delivers four things and **no sampler/bounds porting** (that is Phase 43):

1. **SAFE-01** — a committed byte-equal golden snapshot of the full `SamplerOutput` for every successfully-sampling in-repo 4.2 fixture, captured in a commit that **provably predates** the npm-alias commit.
2. **RT-01** — `@esotericsoftware/spine-core@4.3.0` installed as the **canonical** package + `4.2.111` installed side-by-side via a lockfile-committed, exact-pinned npm alias; both resolve identically under `tsc`, Vite (renderer + main), `worker_threads`, and `vitest` from a fresh clone.
3. **RT-03 / RT-04** — the `core/runtime/` opaque-handle boundary scaffolding (branded handle types carrying a required runtime tag; `SpineRuntime` interface signatures only — no impl bodies) with Layer-3 purity (no DOM/Electron/sharp) arch-spec-enforced.
4. **CI-01** — a new per-push/PR CI workflow that runs the dual-runtime gate (4.2 byte-equal regression + alias resolution + a 4.3 load smoke) as code lands across the 6-phase milestone, plus an electron-builder production-bundle smoke at PR-to-main.

**Ordering is the acceptance test.** The SAFE-01 baseline commit MUST be a git ancestor of the RT-01 npm-alias commit. Capturing behavior after the refactor changes it makes the gate worthless (~100× costlier recovery — research Pitfall 5).

This phase also emits an owner-facing `OWNER-EXPORT-SPEC.md` handoff (no code) so the owner-blocked 4.3 fixture exports run in parallel, off the critical path.

</domain>

<decisions>
## Implementation Decisions

### Owner fixture-export handoff

- **D-01 (Handoff timing):** Phase 42 produces a committed `42-OWNER-EXPORT-SPEC.md` (in this phase dir) the moment Phase 42 lands. The owner performs the Spine-editor export **in parallel** while code phases 42→43 proceed. The hard blocker never sits on the critical path. Realizes the research's explicit "schedule at Phase 42/44 start, off the critical path" instruction (SUMMARY.md Gaps + Phase 44 "Owner-blocked" note).
- **D-02 (Export batch scope):** The handoff asks for **all 5 rigs in one Spine session**:
  - `SIMPLE_TEST`-equivalent rig exported as **both** "Version 4.3" **and** "Version 4.2" — the ORCL-01 cross-runtime equivalence oracle.
  - A **minimal slider rig** (SLIDER-01): one slider drives one bone's X over a known time window → analytically-derivable peak.
  - A **4.3 transform-constraint multi-map** rig (XTRA-01): one source property → multiple differently-typed target properties, local↔world with clamp.
  - A **4.3 IK `scaleYMode`** rig (XTRA-02): exercises `Uniform` + `Volume`; default `None` confirmed 4.2-equivalent.
  - (The 4.3+4.2 pair counts as the same rig exported twice → 4 rigs to author, 5 export artifacts.)
- **D-03 (spine-editor#891 mitigation — load-bearing):** The ORCL-01 cross-runtime rig is **non-IK by design** — `TransformConstraint`-only, mirroring today's `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (whose `TransformConstraint`-on-`SQUARE` *is* the `appliedPose` correctness canary). This removes spine-editor#891 (the 4.3→4.2 downgrade IK-scramble, research LOW-confidence / un-verifiable from tarballs) from the critical path **entirely**. Consequence: **ORCL-03's human-verify-#891 gate becomes a no-op for v1.6** — the oracle never depends on a downgraded IK rig. Full 4.3 IK coverage lives in XTRA-02, which is 4.3-only (never downgraded → #891-immune). Planner/roadmapper: re-express ORCL-03 accordingly (the fallback non-IK rig is now the *primary* design, not a contingency).
- **D-04 (Artifact set per rig):** **Atlas-source only** — each rig delivered as `.json` + `.atlas` + page PNG(s). No atlas-less (`images/`-folder) variant required. Justification: sampler math is **loaderMode-invariant by construction** (locked at SEED-007 capture — atlas-less only changes input plumbing via the Phase 21 synthetic-atlas path, never the world math; see [[project_strict_loadermode_separation]]); atlas-less parity is already regression-covered by the existing 4.2 fixtures and the v1.6 4.2 baseline.
- **D-05 (Redistributability):** The exported rigs are the owner's own assets, committed in-repo and redistributable (ORCL-01 requirement). The handoff spec must state this explicitly so the owner does not export a licensed/third-party rig.

### SAFE-01 baseline granularity

- **D-06 (Freeze scope):** Freeze the **full `SamplerOutput`** — all three maps: `globalPeaks` + `perAnimation` + `setupPosePeaks` (see `src/core/sampler.ts:119-123`). Not `globalPeaks` alone. Rationale: it is the same in-memory object (trivial extra cost); the dominant milestone failure mode is *silent* drift with no error; per-animation / setup-pose drift can net out at the global peak yet still be wrong and is user-visible (Animation Breakdown panel).
- **D-07 (On-disk form):** Per-fixture **committed canonical JSON** (Maps → sorted-key plain objects, deterministic float formatting). When the gate trips, `git diff` shows exactly which `${skin}/${slot}/${attachment}` record drifted and by how much — maximally diagnosable for a silent-undersize regression. Larger files for heavy rigs are accepted. *(Planner's discretion: the exact canonicalization scheme / float-determinism strategy — see Claude's Discretion.)*
- **D-08 (Fixture inclusion rule):** Baseline **every in-repo fixture that today produces a successful `SamplerOutput` through the 4.2 runtime** — **auto-discovered**, not a hand-maintained list (a newly added fixture is auto-covered). The discovered set is **enumerated and asserted** so a fixture silently dropping out of the set is itself a test failure. Version-reject fixtures (`SPINE_3_8_TEST`, `SPINE_4_3_TEST`, `test_4.3` — they throw, not sample) are naturally excluded by the "successfully samples" predicate. **Heavy rigs included** (`Girl/` ~606ms, `SKINS/JOKERMAN` 160 regions, `CHJ/`, `3Queens/`, `Jokerman/`) — subtle drift hides exactly there.
- **D-08-R (Heavy-rig coverage resolution — locked 2026-05-16; clarifies D-08's literal "heavy rigs included" wording, does not relitigate the auto-discovery/enumeration design):** Research falsified the assumption that the named heavy rigs are committable — `[VERIFIED: .gitignore + git ls-files this session]` `fixtures/Girl/`, `fixtures/SKINS/`, `fixtures/CHJ/`, `fixtures/3Queens/`, `fixtures/Jokerman/` are gitignored as proprietary/licensed (Jokerman explicitly "kept local only"); they do not exist on a fresh clone, so D-08-literal, CI-01 ("from a fresh clone"), and D-05 (redistributability) cannot all hold as written. **Resolution: Option A — two-tier discovery** (user-confirmed 2026-05-16): (1) Auto-discovery walks `fixtures/**/*.json`; the committed canonical baseline **and** the asserted enumeration manifest cover **only the git-tracked, redistributable subset** — fresh-clone CI is deterministic and green on exactly this set. (2) Heavy/gitignored rigs are still baselined **locally** into the same `baselines/` dir, but those heavy-rig baseline files are **themselves gitignored**, and the gate runs them only when the fixture is present (`it.skipIf` / presence-guarded — the [[feedback_gitignore_fixtures_check_test_refs]] precedent). Net: fresh-clone CI never sees the proprietary rigs (honors CI-01 + D-05); a developer who has them still gets heavy-rig drift coverage locally (honors D-08's *intent* — "subtle drift hides exactly there" — for whoever has the rigs). Committing the proprietary rigs (research Option B) is **rejected** (violates D-05). Hard CI coverage of heavy-rig drift is explicitly **out of Phase 42 scope** (would require redistributable heavy-equivalent fixtures, a future owner action — not gated here).
- **D-09 (Freeze enforcement — "order is the acceptance test"):** **Machine-checked.** The baseline file carries a provenance header (generating commit SHA + ISO timestamp). A test/CI check asserts the baseline-introducing commit is a **git ancestor of** (predates) the npm-alias commit — verified automatically, not by reviewer memory. **No casual `UPDATE_FIXTURES=1` regen path for SAFE-01** (unlike `tests/fixtures/repack-baselines.json`); regenerating during v1.6 requires deliberately removing the freeze guard (loud, reviewable). This is the concrete realization of SAFE-01's load-bearing ordering requirement.

### CI trigger model

- **D-10 (Workflow placement):** A **new `ci.yml`**, separate from `release.yml`. `release.yml` stays **tag-only + `workflow_dispatch`, untouched** — zero interaction with the standing "don't push v1.6 tags / tags trigger auto-update" guard (see [[feedback_dont_push_release_tags]]).
- **D-11 (Trigger events):** `ci.yml` runs on **push to any branch + `pull_request` to `main` + `workflow_dispatch`**. **Never on tags** (release.yml owns those). A **`paths-ignore`** excludes commits that touch only `.planning/**` / `*.md` docs — a commit that also touches code still runs. (Plain-English for the project owner: *CI runs when you change code, stays quiet when you only change planning notes.*)
- **D-12 (Lane split):** Every triggering push runs the **3-OS matrix** (`ubuntu-latest`, `windows-2022`, `macos-14` — mirrors `release.yml`'s existing matrix; Linux retained in CI test even though it is a dropped *release* target per [[project_linux_deferred]]): full vitest suite + the **SAFE-01 byte-equal gate (incl. heavy rigs)** + the alias-resolution / runtime-distinctness test. The **slow electron-builder production-bundle smoke** (runs the *built/packaged* worker — not `src/` — against a 4.2 and a 4.3 fixture; asserts electron-builder packages **both** spine-core copies) runs **only on `pull_request` to `main`**. Best de-risking-per-CI-minute: the regression gate fires on every code change; packaging cost is paid at merge.
- **D-13 (Phase-42 4.3 CI arm — resolves the un-selected 4th gray area):** Phase 42's 4.3 arm asserts **dual-install integrity only**, NOT sampled-value correctness:
  - alias resolves under `npm ci` / `tsc` / Vite (renderer + main) / `worker_threads` / `vitest`;
  - the 4.3 `spine-core` module imports; `Slider` / `BonePose` exist **only** in the 4.3 module (`adapter42.version !== adapter43.version`);
  - an existing in-repo 4.3 JSON (`fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json`, the Phase 32 parser fixture) **loads through the 4.3 runtime without** the v1.4 `SpineVersionUnsupportedError` reject.
  - Sampled-value 4.3 correctness is **explicitly out of Phase 42** — it is gated by the Phase 44 cross-runtime equivalence oracle (within 1e-4).
  - **Add a guard that FAILS CI if the owner oracle/slider fixtures are still absent by Phase 44** — the owner blocker cannot silently slip past its scheduled boundary.

### Claude's Discretion

Delegated to research/planning/execution per [[feedback_delegate_implementation_choices]] (user explicitly chose "I'm ready for context", declining to lock these):

- **npm alias key literal name** — direction is LOCKED (4.3.0 canonical, 4.2.111 aliased — load-bearing, research-verified live); the literal key (`spine-core-42` per STACK.md vs. `@esotericsoftware/spine-core-43` per ARCHITECTURE.md) is a planner/roadmapper choice. Default lean: STACK.md's `spine-core-42` (the verified-correct *direction* uses 4.3 as canonical `@esotericsoftware/spine-core`).
- **Opaque branded-handle mechanics (RT-03)** — `unique symbol` brand shape, the required runtime-tag field name/type, factory/guard ergonomics. Constraint locked: the runtime tag is a **required field on the handle**, identity is *threaded not inferred* (per [[feedback_explicit_identity_over_inference]] — Phase 40 round-2 lesson); a cross-runtime mix is a **compile-time** error, stronger than the arch-spec grep.
- **`SpineRuntime` interface signature surface** — exactly which ~20 method signatures to scaffold in Phase 42 (signatures only; bodies are Phase 43). Derive from the actual `sampler.ts` / `bounds.ts` call sites per ARCHITECTURE.md's facade-interface table.
- **Canonical-JSON serialization / float-determinism** (D-07) — sorted-key ordering, float formatting, NaN/Infinity handling, file layout (one file per fixture vs. one bundle).
- **`paths-ignore` glob set** (D-11) and the git-ancestor assertion mechanism (D-09).
- **Fixture directory naming** for the incoming owner exports — must NOT collide with the existing Phase-32 `fixtures/SPINE_4_3_TEST/` and `fixtures/test_4.3/` parser-reject fixtures. Suggested convention to confirm at plan time: a `SIMPLE_PROJECT_*`-style sibling for the oracle + `fixtures/SLIDER_4_3/` for slider (research's suggested analog).
- **Slider rig exact parameters** (the analytically-known peak math) — specified inside the owner export-spec at authoring time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The verified spec (load first — supersedes SEED-006's falsified beta inventory)
- `.planning/research/SUMMARY.md` — HIGH-confidence consolidated correction; the SEED-006 beta-vs-stable falsification table; the Phase 42–47 shape + ordering rationale; the owner-fixture blocker. **This is the spec, not SEED-006.**
- `.planning/research/STACK.md` — verified-live npm alias mechanics, exact `package.json` target shape, the load-bearing alias *direction* (4.3 canonical), dual-type isolation under `tsc moduleResolution:bundler`.
- `.planning/research/ARCHITECTURE.md` — the `SpineRuntime` facade pattern, interface shape derived from real call sites, opaque-handle design, `core/runtime/` module layout.
- `.planning/research/PITFALLS.md` — the full pitfall set; Pitfall 5 (4.2 regression / baseline-before-alias order), Pitfall 4 (dual type-universe), Pitfall 6 (cross-runtime `instanceof`), Pitfall 8 (npm-alias traps).
- `.planning/research/FEATURES.md` — the must-have runtime-behavior list incl. the dual CI matrix and the 4.2 regression gate.

### Requirements / roadmap / seed
- `.planning/REQUIREMENTS.md` — v1.6 reqs; Phase 42 owns **SAFE-01, RT-01, RT-03, RT-04, CI-01**; locked design facts 1–5; the SEED-006-superseded banner.
- `.planning/ROADMAP.md` — Phase 42 entry: goal, depends-on, 5 success criteria mapping to the 5 reqs; the immovable baseline-before-alias ordering.
- `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` — **historical context only; its costed PORT-01..04 inventory is FALSIFIED.** Read for the trigger/motivation, not the API mapping.
- `.planning/PROJECT.md` `## Current Milestone` — the 5 locked design facts (dual-runtime; 4.2 retained + regression-gated; 4.3 canonical alias direction; `core/` Layer-3; PORT-04 = npm alias) — do not relitigate.

### Code anchors (read on the way into planning)
- `src/core/sampler.ts:119-123` — `SamplerOutput = { globalPeaks, perAnimation, setupPosePeaks }`; the exact shape the SAFE-01 baseline freezes (D-06).
- `src/core/loader.ts:122-187` — `checkSpineVersion` (`<4.2` / `>=4.3` throw) + `checkSpine43Schema` (top-level `constraints` throw). The rejecters Phase 44 repurposes; Phase 42's 4.3 CI arm asserts a 4.3 JSON gets *past* these via the 4.3 runtime (D-13).
- `tests/arch.spec.ts:148-164` — the Layer-3 purity invariant + existing carve-outs (`loader.ts`, `png-header.ts`, `synthetic-atlas.ts`). RT-04 adds a `core/runtime/` arch anchor here.
- `tests/fixtures/repack-baselines.json` + `scripts/repack-refresh-baselines.mjs` — the existing baseline-snapshot precedent (provenance `_meta` header + per-artifact SHA256 + `UPDATE_FIXTURES=1` refresh). SAFE-01 mirrors the *provenance-header* idea but **deliberately rejects** the casual regen escape hatch (D-09).
- `.github/workflows/release.yml` — the only existing workflow: `on: push` (tags `v*`) + `workflow_dispatch`; `test` job matrix `os: [ubuntu-latest, windows-2022, macos-14]`, node 22, `npm ci` + `npm run test`. New `ci.yml` mirrors the matrix; release.yml stays untouched (D-10, D-12).
- `fixtures/` — `SIMPLE_PROJECT/SIMPLE_TEST.json` (the ORCL-01 template — note its `TransformConstraint`-on-`SQUARE` appliedPose canary); `SPINE_4_3_TEST/SPINE_4_3_TEST.json` + `test_4.3/` (Phase-32 4.3 parser-reject fixtures — the D-13 load-smoke uses one; new owner fixtures must not collide with these names).

### External
- `https://github.com/EsotericSoftware/spine-editor/issues/891` — the 4.3→4.2 downgrade IK-scramble bug. D-03 sidesteps it by making ORCL-01 non-IK; reference it in `OWNER-EXPORT-SPEC.md` so the owner understands *why* the oracle rig is constraint-restricted.

### Memory (durable project facts in play)
- [[feedback_dont_push_release_tags]] — D-10/D-11: `ci.yml` must never trigger on tags; release/auto-update path stays isolated.
- [[feedback_explicit_identity_over_inference]] — RT-03: runtime tag is a *required* handle field; thread identity, don't infer.
- [[project_strict_loadermode_separation]] — D-04: math is loaderMode-invariant; atlas-source-only fixtures are sufficient.
- [[feedback_delegate_implementation_choices]] — Claude's Discretion items are durably delegated (user chose "ready for context").
- [[project_linux_deferred]] — D-12: Linux stays in the CI *test* matrix but is not a release target.
- [[user_git_experience]] / [[feedback_explain_git]] — narrate the baseline-before-alias git ordering and the ancestor-check in plain English in plan/execution output.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tests/fixtures/repack-baselines.json` + `scripts/repack-refresh-baselines.mjs`** — proven baseline-snapshot pattern (provenance `_meta` block, deterministic per-artifact digest, consumed by `tests/main/repack.loose-parity.spec.ts`). SAFE-01 reuses the *provenance-header* concept; intentionally diverges on regen policy (D-09: no casual refresh) and on form (D-07: full canonical JSON, not SHA256-only — diagnosability over compactness).
- **`release.yml` `test` job** — existing 3-OS matrix + `npm ci` + `npm run test` skeleton; copy the matrix/runner shape into the new `ci.yml`.
- **`tests/arch.spec.ts` glob-based import scanner** — the established mechanism for Layer-3 enforcement; extend with a `core/runtime/` anchor (RT-04) and a "no file imports both alias specifiers" anchor (RT-03 backstop).
- **`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`** — the ORCL-01 template; its non-IK `TransformConstraint`-on-`SQUARE` design *is* the chosen #891-immune appliedPose canary (D-03).

### Established Patterns
- **`SamplerOutput` is three `Map<string, PeakRecord>`s** — keys are `${skin}/${slot}/${attachment}` (+ `${animation}/...` for `perAnimation`). Canonicalization must produce a deterministic, sorted, float-stable serialization of all three (D-07).
- **Layer-3 purity with explicit carve-outs** — `core/` may not import sharp/node:fs/DOM/Electron except the named load-time carve-outs. `core/runtime/` is NEW and must be pure; only the two adapter impls (Phase 43) import a spine-core package — Phase 42 scaffolds signatures + handles only.
- **Typed-error envelope** — `SpineVersionUnsupportedError` (`src/core/loader.ts`) is the discriminated-union reject pattern; Phase 42 does not change loader behavior (that is Phase 44/45) but the D-13 CI smoke asserts a 4.3 JSON no longer hits this via the 4.3 runtime.

### Integration Points
- **`package.json` + lockfile** — RT-01's exact-pinned dual-install + npm alias; the single highest-blast-radius change (touches every 4.2 user path). Must land in a commit that is a git *descendant* of the SAFE-01 baseline commit (D-09).
- **`core/runtime/` (new dir)** — opaque handle types (`types.ts`) + `SpineRuntime` interface (`runtime.ts`, signatures only) + `LoadResult.runtime` field threading. Sampler/bounds are NOT rewired in Phase 42.
- **`.github/workflows/ci.yml` (new)** — the dual-runtime gate; consumes the SAFE-01 baseline + the alias + the D-13 4.3 load smoke.

</code_context>

<specifics>
## Specific Ideas

- **"Order is the acceptance test"** (D-09) — the user wants the baseline-predates-alias invariant *machine-verified via git ancestry*, not trusted to review. This is the single most emphasized correctness lever in the discussion.
- **Diagnosability over compactness** (D-07) — committed canonical JSON specifically chosen so a tripped gate shows *which attachment* drifted via `git diff`, because the failure mode is silent per-attachment undersize.
- **ORCL-01 non-IK by design** (D-03) — a deliberate fixture-design choice that converts a research LOW-confidence external dependency (spine-editor#891) into a non-issue; downstream agents should treat ORCL-03's #891 human-verify gate as a v1.6 no-op and re-express it.
- **One owner export session, all 5 rigs** (D-02) — minimize the owner's Spine-editor context-switches; the handoff doc must be complete and self-contained enough to export everything in one sitting.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 42 scope. No scope creep surfaced; no pending todos matched Phase 42 (`gsd-sdk query todo.match-phase 42` → 0 matches).

(Cross-milestone items already tracked elsewhere and intentionally NOT in Phase 42: the 8 Phase-40 polish carry-forwards, the 5 Phase-41 viewer HUMAN-UATs, the v1.7 4.2-deprecation decision — see `.planning/REQUIREMENTS.md` Future Requirements / `.planning/STATE.md` Deferred Items.)

</deferred>

---

*Phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding*
*Context gathered: 2026-05-16*
