# Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding - Research

**Researched:** 2026-05-16
**Domain:** Dual spine-core runtime de-risking — byte-equal 4.2 golden capture, lockfile-pinned npm alias, opaque-handle boundary scaffolding, dual-runtime CI
**Confidence:** HIGH (alias mechanics + git-ancestry + float-determinism reproduced live this session; API surface verified by the 4-researcher synthesis against the published 4.3.0 tarballs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Owner fixture-export handoff (not consumed by Phase 42 code — handoff doc only):**
- **D-01:** Phase 42 produces a committed `42-OWNER-EXPORT-SPEC.md` the moment Phase 42 lands. Owner exports in parallel, off the critical path.
- **D-02:** Handoff asks for all 5 rigs in one Spine session: SIMPLE_TEST-equivalent exported as **both** "Version 4.3" and "Version 4.2" (ORCL-01); a minimal slider rig (SLIDER-01); a 4.3 transform-constraint multi-map rig (XTRA-01); a 4.3 IK `scaleYMode` rig (XTRA-02). 4 rigs to author, 5 export artifacts.
- **D-03:** ORCL-01 cross-runtime rig is **non-IK by design** (TransformConstraint-only, mirroring `SIMPLE_TEST`'s `TransformConstraint`-on-`SQUARE` appliedPose canary) — sidesteps spine-editor#891 entirely. ORCL-03's #891 human-verify gate becomes a **v1.6 no-op**; the non-IK rig is the *primary* design, not a contingency. Full 4.3 IK coverage lives in XTRA-02 (4.3-only, never downgraded → #891-immune).
- **D-04:** Atlas-source only — each rig delivered as `.json` + `.atlas` + page PNG(s). No atlas-less variant (math is loaderMode-invariant by construction).
- **D-05:** Exported rigs are the owner's own redistributable assets, committed in-repo. Handoff spec must state this explicitly.

**SAFE-01 baseline granularity:**
- **D-06:** Freeze the **full `SamplerOutput`** — all three maps (`globalPeaks` + `perAnimation` + `setupPosePeaks`), not `globalPeaks` alone.
- **D-07:** Per-fixture **committed canonical JSON** (Maps → sorted-key plain objects, deterministic float formatting). `git diff` must show exactly which `${skin}/${slot}/${attachment}` record drifted. Larger files for heavy rigs accepted. *(Canonicalization scheme = Claude's Discretion — resolved in §Canonical-JSON Serialization.)*
- **D-08:** Baseline **every in-repo fixture that today produces a successful `SamplerOutput` through the 4.2 runtime** — **auto-discovered**, not a hand-maintained list. The discovered set is enumerated and asserted so a silent dropout is a test failure. Version-reject fixtures naturally excluded. **Heavy rigs included** (`Girl/`, `SKINS/JOKERMAN`, `CHJ/`, `3Queens/`, `Jokerman/`).
- **D-09:** **Machine-checked freeze enforcement.** Baseline file carries a provenance header (generating commit SHA + ISO timestamp). A test/CI check asserts the baseline-introducing commit is a **git ancestor of** the npm-alias commit. **No casual `UPDATE_FIXTURES=1` regen path for SAFE-01** — regenerating during v1.6 requires deliberately removing the freeze guard (loud, reviewable).

**CI trigger model:**
- **D-10:** A **new `ci.yml`**, separate from `release.yml`. `release.yml` stays tag-only + `workflow_dispatch`, **untouched**.
- **D-11:** `ci.yml` runs on **push to any branch + `pull_request` to `main` + `workflow_dispatch`**. **Never on tags.** A **`paths-ignore`** excludes commits touching only `.planning/**` / `*.md`; a commit that also touches code still runs.
- **D-12:** Every triggering push runs the **3-OS matrix** (`ubuntu-latest`, `windows-2022`, `macos-14`): full vitest suite + SAFE-01 byte-equal gate (incl. heavy rigs) + alias-resolution / runtime-distinctness test. The **slow electron-builder production-bundle smoke** runs **only on `pull_request` to `main`**.
- **D-13:** Phase 42's 4.3 arm asserts **dual-install integrity only**, NOT sampled-value correctness: alias resolves under `npm ci`/`tsc`/Vite(renderer+main)/`worker_threads`/`vitest`; the 4.3 module imports and `Slider`/`BonePose` exist **only** in 4.3 (`adapter42.version !== adapter43.version`); an existing in-repo 4.3 JSON loads through the 4.3 runtime without the v1.4 `SpineVersionUnsupportedError` reject. Sampled-value 4.3 correctness is **out of Phase 42** (gated by Phase 44 oracle). **Add a guard that FAILS CI if the owner oracle/slider fixtures are still absent by Phase 44.**

### Claude's Discretion

Delegated to research/planning/execution (durable signal per `feedback_delegate_implementation_choices`):
- **npm alias key literal name** — direction LOCKED (4.3.0 canonical, 4.2.111 aliased); literal key is a planner choice. Default lean: STACK.md's `spine-core-42`. → **Resolved in §Standard Stack.**
- **Opaque branded-handle mechanics (RT-03)** — `unique symbol` brand shape, required runtime-tag field, factory/guard ergonomics. Constraint LOCKED: runtime tag is a **required field on the handle**, identity is *threaded not inferred*; cross-runtime mix is a **compile-time** error. → **Resolved in §RT-03.**
- **`SpineRuntime` interface signature surface** — exactly which method signatures to scaffold in Phase 42 (signatures only; bodies Phase 43). → **Resolved in §SpineRuntime Interface.**
- **Canonical-JSON serialization / float-determinism (D-07)** — sorted-key ordering, float formatting, NaN/Infinity handling, file layout. → **Resolved in §Canonical-JSON Serialization.**
- **`paths-ignore` glob set (D-11) + git-ancestor assertion mechanism (D-09).** → **Resolved in §CI Architecture and §Git-Ancestor Assertion.**
- **Fixture directory naming for incoming owner exports** — must NOT collide with `fixtures/SPINE_4_3_TEST/` or `fixtures/test_4.3/`. → **Resolved in §Fixture Directory Naming.**
- **Slider rig exact parameters** — specified inside the owner export-spec at authoring time (Phase 42 deliverable content, not Phase 42 code).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 42 scope. No scope creep surfaced; `gsd-sdk query todo.match-phase 42` → 0 matches. Cross-milestone items (8 Phase-40 polish carry-forwards, 5 Phase-41 viewer HUMAN-UATs, v1.7 4.2-deprecation) are tracked elsewhere and explicitly NOT in Phase 42.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SAFE-01** | Byte-equal golden snapshot of `globalPeaks`/`SamplerOutput` for every in-repo 4.2 fixture, committed **before** the npm alias (order is load-bearing) | §Canonical-JSON Serialization (deterministic scheme), §Fixture Auto-Discovery (D-08 enumeration + dropout-is-failure), §Git-Ancestor Assertion (D-09 machine-checked ordering), §Runtime State Inventory (the baseline IS the runtime state being frozen) |
| **RT-01** | `@esotericsoftware/spine-core@4.3.0` canonical + `4.2.111` exact-pinned lockfile-committed npm alias; both resolve under tsc/Vite(renderer+main)/worker_threads/vitest from a fresh clone | §Standard Stack (verified-live alias key + exact package.json line + lockfile shape), §Resolution Matrix (5 toolchains), §Common Pitfalls P3/P4 |
| **RT-03** | Runtime objects cross the adapter boundary as opaque branded handles carrying an explicit runtime tag; cross-runtime mix is a **compile-time** error | §RT-03 Opaque Branded Handles (concrete TS: `unique symbol` brand + required `__rt` tag + factory/guard), §Architecture Patterns |
| **RT-04** | `core/runtime/` imports no DOM/Electron/sharp — Layer-3 purity preserved and arch-spec-enforced after scaffolding lands | §RT-04 Layer-3 Enforcement (extends `tests/arch.spec.ts:148-178` glob + new named anchors), §Code Examples |
| **CI-01** | CI matrix runs full suite against both 4.2.x and 4.3.x fixtures from a fresh clone; alias resolves reproducibly under `npm ci`; electron-builder packages both spine-core copies; production-bundle smoke runs the built worker | §CI Architecture (D-10/11/12/13 ci.yml design), §Production-Bundle Smoke, §Validation Architecture |
</phase_requirements>

## Summary

Phase 42 is a **de-risking and infrastructure phase, not a feature build**. It ships four interlocking deliverables plus an owner-handoff document, and its single most-emphasized correctness lever is **temporal ordering enforced by git ancestry**: the SAFE-01 byte-equal 4.2 baseline commit MUST be a git ancestor of the RT-01 npm-alias commit, machine-verified. Capturing 4.2 behavior *after* the alias/scaffolding lands makes the regression gate worthless (~100× costlier recovery — research Pitfall 5). Every design decision in this phase serves the invariant: *prove the existing paying 4.2 user base is byte-for-byte unaffected, and make any future drift impossible to introduce silently.*

All four "verify live" claims this research depended on were reproduced this session: (1) the npm alias `spine-core-42 = npm:@esotericsoftware/spine-core@4.2.111` installs side-by-side with canonical `@esotericsoftware/spine-core@4.3.0`, with a reproducible lockfile entry (`name`/`version`/`resolved`/`integrity` — the `4.2.111` integrity matches the registry, so `npm ci` is deterministic); (2) `git merge-base --is-ancestor` is available and is the correct ancestry primitive; (3) `JSON.stringify` silently corrupts the exact float edge cases the SamplerOutput can produce (`NaN`→`null`, `Infinity`→`null`, `-0`→`0`) — the canonical serializer MUST handle these explicitly or a silent-undersize regression could hide behind a `null`; (4) `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` (a `4.3.91-beta` export with `root.constraints`) currently throws `SpineVersionUnsupportedError` through the gated `loadSkeleton` — the D-13 smoke must drive the **4.3 runtime's `SkeletonJson` directly**, bypassing the still-4.2-only `loader.ts` gate (which Phase 42 does NOT modify).

**Primary recommendation:** Build the phase as a strict 4-stage commit sequence — (1) SAFE-01 baseline + canonical serializer + auto-discovery + enumeration assertion committed FIRST on a fresh branch off `main`; (2) RT-01 alias install + lockfile + resolution tests as a git *descendant*; (3) RT-03/RT-04 `core/runtime/` opaque-handle + `SpineRuntime` signatures + arch anchors; (4) CI-01 `ci.yml` carrying the git-ancestry assertion, the SAFE-01 gate, the runtime-distinctness test, and the PR-only production-bundle smoke. The git-ancestry check is the acceptance test for the whole phase and must itself be a CI assertion, not reviewer memory.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SAFE-01 byte-equal baseline capture | Test harness (vitest, `node` env) consuming `core/` | `core/sampler.ts` + `core/loader.ts` (unchanged) | The baseline is produced by running the *existing unchanged* sampler; the harness only serializes + asserts. No `core/` logic change in Phase 42. |
| Canonical-JSON serializer | Test/script utility (`tests/` or `scripts/`), pure Node | — | Deterministic float formatting is a serialization concern, not sampler math. Lives beside the baseline data, never in `core/`. |
| Fixture auto-discovery + enumeration assertion | Test harness | `node:fs` glob (test-side only — `core/` purity preserved) | Discovery walks `fixtures/` from the test process; `core/` never does fs discovery (Layer-3). |
| RT-01 npm alias | `package.json` + `package-lock.json` (build/dependency tier) | electron-vite externalization (no config change) | Pure dependency-graph change; resolution is delegated to npm/Node/Vite natively. |
| RT-03 opaque handles + `SpineRuntime` interface | `core/runtime/` (Layer-3 pure TS) | `core/types.ts` (`LoadResult.runtime` field) | Types only; the compile-time wall lives in `core/`, signatures only, no spine-core import in Phase 42. |
| RT-04 Layer-3 purity enforcement | `tests/arch.spec.ts` (test tier) | — | The existing glob scanner already covers `src/core/**`; Phase 42 extends it with named anchors. |
| CI-01 dual-runtime gate | `.github/workflows/ci.yml` (CI tier) | electron-builder (packaging verification) | New workflow; `release.yml` untouched. The git-ancestry assertion runs here. |
| Git-ancestor assertion (D-09) | Test (vitest) **and** CI step | `git` CLI (`merge-base --is-ancestor`) | Runs both as a local test and a CI gate so a fresh clone and CI both enforce ordering. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-core` | **4.3.0** (canonical, exact-pinned) | 4.3 skeleton/animation/constraint/physics/slider math; made canonical so `spine-player`/`spine-webgl` bare-resolve it | `[VERIFIED: npm view 2026-05-16]` `latest` = `4.3.0`; jumps `4.2.116`→`4.3.0`; **no beta tags ever on npm**; zero dependencies; `main: dist/index.js`, `types: dist/index.d.ts`, `type: module`, no `exports` map (drop-in barrel import) |
| `spine-core-42` → `npm:@esotericsoftware/spine-core@4.2.111` | 4.2.111 (exact-pinned alias) | The retained, regression-gated 4.2 runtime | `[VERIFIED: live sandbox install this session]` installs side-by-side; ships own `dist/index.d.ts`; `tsc moduleResolution:bundler` treats it as a fully distinct type surface (no `paths` config) |
| `@esotericsoftware/spine-player` | 4.2.111 → **NOT bumped in Phase 42** | Animation Viewer | Bumped to 4.3.0 in **Phase 47** (decoupled, last+revertible). Phase 42 must NOT touch it. |

**The alias key literal — RESOLVED: `spine-core-42`.**

`[VERIFIED: live sandbox install this session]` — the exact, copy-paste-accurate `package.json` `dependencies` shape after Phase 42's RT-01:

```jsonc
{
  "dependencies": {
    "@esotericsoftware/spine-core": "4.3.0",
    "spine-core-42": "npm:@esotericsoftware/spine-core@4.2.111",
    "@esotericsoftware/spine-player": "4.2.111"
    // ...existing deps unchanged...
  }
}
```

`package-lock.json` alias entry npm writes automatically (verified verbatim this session — the `integrity` matches `npm view @esotericsoftware/spine-core@4.2.111 dist.integrity`, confirming `npm ci` reproducibility):

```jsonc
"node_modules/spine-core-42": {
  "name": "@esotericsoftware/spine-core",
  "version": "4.2.111",
  "resolved": "https://registry.npmjs.org/@esotericsoftware/spine-core/-/spine-core-4.2.111.tgz",
  "integrity": "sha512-dh4OOJXjLvgHtwjXDIXr4FMrWo4uvVrSugkuSckeerdxRnZVyBLmvmKDiZ915qVmMiA6IEveVHOFPULzD98K6A==",
  "license": "LicenseRef-LICENSE"
}
```

**Decision rationale (`spine-core-42` over ARCHITECTURE.md's `@esotericsoftware/spine-core-43` illustration):**
- The alias *direction* is the load-bearing decision (4.3 canonical so `spine-player` bare-resolves correctly). Both naming schemes satisfy the direction.
- `spine-core-42` is the **non-scoped** form. The scoped form `@esotericsoftware/spine-core-43` would imply a *different package under the same npm scope*, which is misleading (it is the SAME package, aliased) and is the *naive* direction's naming.
- `spine-core-42` makes the retained-legacy intent self-documenting at every import site: `import { Skeleton } from 'spine-core-42'` reads as "the 4.2 runtime, explicitly."
- STACK.md verified `spine-core-42` live in all 5 toolchains; ARCHITECTURE.md's `@esotericsoftware/spine-core-43` was an illustration in the (rejected) naive direction. **Use `spine-core-42` consistently across package.json, all `core/runtime/` imports, and the no-co-mingled-imports arch test.**

**Installation command (Phase 42 RT-01 step — run from repo root):**
```bash
npm install @esotericsoftware/spine-core@4.3.0 \
            spine-core-42@npm:@esotericsoftware/spine-core@4.2.111
# Do NOT bump spine-player here — that is Phase 47.
# Commit BOTH package.json and package-lock.json in the SAME (post-baseline) commit.
```

**Version verification (performed this session):**
```
npm view @esotericsoftware/spine-core@latest version   → 4.3.0   [VERIFIED 2026-05-16]
npm view @esotericsoftware/spine-player@latest version → 4.3.0   [VERIFIED 2026-05-16]
npm view @esotericsoftware/spine-core versions          → ...4.2.116, 4.3.0  (no beta) [VERIFIED]
npm view @esotericsoftware/spine-core@4.3.0 dependencies → (none) [VERIFIED]
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4 (installed) | Baseline capture harness, canonical-JSON round-trip test, git-ancestor test, runtime-distinctness test, arch anchors | All Phase 42 test seams. No config change needed. |
| `node:crypto` `createHash` | built-in | (Optional) a content digest in the SAFE-01 provenance `_meta` for fast tamper-detection alongside the full canonical JSON | Mirror the `repack-baselines.json` `_meta` precedent. The full canonical JSON is the diagnosable artifact; a digest is a cheap secondary integrity signal. |
| `git` CLI | system | `git merge-base --is-ancestor`, `git log --diff-filter=A --format='%H'`, `git rev-parse` | The D-09 ancestry mechanism. Verified available this session. |
| `node:child_process` `execFileSync` | built-in (test-side only) | Invoke `git` from the ancestry test/CI step | Test/CI tier only — never `core/`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `spine-core-42` alias key | `@esotericsoftware/spine-core-43` (scoped, naive-direction naming) | Rejected — misleading (same package, not a sibling); pairs with the *naive* alias direction STACK.md falsified. Direction is what matters; pick the clearest key. |
| Per-fixture canonical JSON files (D-07) | Single bundled snapshot JSON | D-07 explicitly locks per-fixture files for `git diff` diagnosability on heavy rigs. A bundle would make a 1-attachment drift on `Girl/` a giant diff. Per-fixture is locked. |
| Custom canonical serializer | `JSON.stringify(v, sortedKeyReplacer)` | Insufficient alone — `JSON.stringify` silently maps `NaN`/`Infinity`→`null` and `-0`→`0` (reproduced this session). A silent-undersize bug producing `NaN` would serialize as `null` and the gate could false-pass. Must wrap with explicit non-finite handling. |
| `git merge-base --is-ancestor` | Parsing `git log` / timestamp comparison | Timestamps are not monotonic across machines/rebases; `--is-ancestor` is the exact topological primitive (exit 0 = ancestor, 1 = not). Verified this session. |
| Separate `ci.yml` (D-10) | Extending `release.yml` | Locked — `release.yml` must stay isolated from the "don't push v1.6 tags" guard (`feedback_dont_push_release_tags`). Non-negotiable. |

## Architecture Patterns

### System Architecture Diagram

```
                         Phase 42 commit topology (the acceptance test)
                         ─────────────────────────────────────────────
   main (single-runtime 4.2.111, last v1.5.1 SHA)
     │
     ▼  branch: milestone/v1.6-spine-4.3-dual-runtime  (already on this branch)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ COMMIT A  — SAFE-01 baseline (MUST be ancestor of COMMIT B)            │
  │   • canonical-JSON serializer (test/script util, pure Node)           │
  │   • fixture auto-discovery (walk fixtures/, predicate = "samples OK")  │
  │   • per-fixture *-baseline.json  + enumeration manifest               │
  │   • _meta provenance header: { generatedCommit, generatedAt, ... }    │
  │   • freeze-guard test (NO UPDATE_FIXTURES escape hatch)               │
  │   spine-core STILL 4.2.111 ONLY — alias NOT yet present               │
  └───────────────────────────────┬──────────────────────────────────────┘
                                   │  git ancestry edge (machine-asserted)
                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ COMMIT B  — RT-01 npm alias                                            │
  │   • package.json: spine-core→4.3.0 canonical + spine-core-42 alias    │
  │   • package-lock.json committed (exact integrity)                     │
  │   • resolution tests (tsc / vite renderer / vite main / worker / vitest)│
  │   • runtime-distinctness test (v42 !== v43; Slider/BonePose 4.3-only)  │
  └───────────────────────────────┬──────────────────────────────────────┘
                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ COMMIT C  — RT-03 / RT-04 boundary scaffolding                         │
  │   • core/runtime/types.ts   (opaque branded handles, unique symbol)   │
  │   • core/runtime/runtime.ts (SpineRuntime interface — SIGNATURES ONLY) │
  │   • core/types.ts: LoadResult gains `runtime?: SpineRuntime`           │
  │   • tests/arch.spec.ts: core/runtime/ Layer-3 anchor + no-co-mingled  │
  │   NO impl bodies; sampler/bounds NOT rewired (that is Phase 43)        │
  └───────────────────────────────┬──────────────────────────────────────┘
                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ COMMIT D  — CI-01 + 42-OWNER-EXPORT-SPEC.md                            │
  │   • .github/workflows/ci.yml (push any branch + PR→main + dispatch)   │
  │       3-OS matrix: vitest + SAFE-01 gate + ancestry + distinctness    │
  │       PR→main only: electron-builder production-bundle smoke          │
  │   • git-ancestor assertion (test + CI step)                          │
  │   • D-13 4.3 load-smoke (4.3 SkeletonJson directly, bypassing loader) │
  │   • Phase-44 owner-fixture-absence guard (fails CI if absent by P44)  │
  │   • 42-OWNER-EXPORT-SPEC.md (handoff doc, no code)                    │
  └──────────────────────────────────────────────────────────────────────┘

       Data flow inside the SAFE-01 gate (unchanged sampler — Phase 42 adds NO core logic):
       fixtures/**/*.json ──discover()──> [predicate: loadSkeleton+sampleSkeleton OK?]
            │                                       │
            │ (reject fixtures throw → excluded)    ▼
            └──> for each surviving fixture: sampleSkeleton(loadSkeleton(f))
                          │  SamplerOutput { globalPeaks, perAnimation, setupPosePeaks }
                          ▼
                  canonicalize() ──> sorted-key, finite-checked, fixed-precision JSON
                          ▼
                  COMMIT A: compare vs committed *-baseline.json  (strict toEqual)
                  CI:       enumerate discovered set == committed manifest (dropout = fail)
```

The diagram's load-bearing element is the **ancestry edge between COMMIT A and COMMIT B** — it is the SAFE-01 acceptance test, machine-verified in COMMIT D's CI.

### Recommended Project Structure

```
.github/workflows/
├── release.yml                       # UNTOUCHED (D-10) — tag-only + workflow_dispatch
└── ci.yml                            # NEW (CI-01) — push any branch + PR→main

src/core/
├── types.ts                          # MODIFIED — LoadResult gains `runtime?: SpineRuntime`
│                                      #            (optional in Phase 42; wired Phase 43)
└── runtime/                          # NEW dir (RT-03/RT-04) — Layer-3 pure, signatures only
    ├── types.ts                      # NEW — opaque branded handles (unique symbol + __rt tag)
    └── runtime.ts                    # NEW — SpineRuntime interface (signatures, NO bodies)
                                      #       NO spine-core import in Phase 42

tests/
├── safe01/                           # NEW — SAFE-01 harness (suggested grouping)
│   ├── canonical-json.ts             #   the deterministic serializer (pure Node util)
│   ├── discover-fixtures.ts          #   auto-discovery + "samples OK" predicate
│   ├── safe01-baseline.spec.ts       #   strict toEqual vs committed per-fixture JSON
│   ├── safe01-enumeration.spec.ts    #   D-08: discovered set == committed manifest
│   ├── safe01-freeze-guard.spec.ts   #   D-09: NO UPDATE_FIXTURES path; ancestry assert
│   └── baselines/                    #   COMMITTED per-fixture canonical JSON (D-07)
│       ├── _manifest.json            #   D-08 enumerated fixture set + _meta provenance
│       ├── SIMPLE_PROJECT__SIMPLE_TEST.json
│       ├── INHERIT_TIMELINE__INHERIT_TEST.json
│       ├── Girl__Girl.json           #   heavy rigs INCLUDED (D-08)
│       └── ...one per discovered fixture...
├── runtime/                          # NEW — RT-01 resolution + distinctness
│   ├── alias-resolution.spec.ts      #   both specifiers resolve; distinct versions
│   └── runtime-distinctness.spec.ts  #   v42 !== v43; Slider/BonePose 4.3-only
└── arch.spec.ts                      # MODIFIED — add core/runtime/ Layer-3 anchor
                                      #            + no-co-mingled-alias-imports anchor

.planning/phases/42-.../
└── 42-OWNER-EXPORT-SPEC.md           # NEW (D-01..D-05) — owner handoff, NO code
```

> Note: `tests/safe01/` and `tests/runtime/` groupings are a recommendation; the binding constraint is that the canonical serializer and discovery util are **pure Node test/script utilities, never in `core/`** (preserves RT-04 / CLAUDE.md Fact #5). The committed baselines must NOT be gitignored (they are the regression contract — same principle as `tests/fixtures/repack-baselines.json`, which IS committed).

### Pattern 1: Order-as-Acceptance-Test (the phase's spine)

**What:** The phase is a linear commit DAG where COMMIT A (SAFE-01 baseline) is provably an ancestor of COMMIT B (RT-01 alias). The ordering is not a convention — it is a machine-checked invariant asserted in CI (D-09).

**When to use:** Always for this phase. This is the realization of SAFE-01's "order is the acceptance test."

**Why it matters:** `[CITED: research Pitfall 5]` You cannot baseline behavior after you change it. If the alias lands first, the "baseline" captures already-refactored behavior and the regression gate validates nothing — a silent 8% undersize for the entire paying 4.2 user base, recoverable only at ~100× cost.

**Concrete realization:** See §Git-Ancestor Assertion for the exact `git merge-base --is-ancestor` mechanism.

### Pattern 2: Opaque Branded Handle with Required Runtime Tag (RT-03)

**What:** Boundary types that are nominally distinct (a `unique symbol` brand defeats structural typing) AND carry a **required, non-optional runtime-tag field** so identity is *threaded explicitly, never inferred*. See §RT-03 for concrete TypeScript.

**When to use:** Every type that crosses the `core/runtime/` boundary in `LoadResult`, `sampler.ts`, `bounds.ts` (Phase 43 consumes; Phase 42 only declares).

**Why this exact shape:** `[CITED: feedback_explicit_identity_over_inference — Phase 40 round-2 lesson]` When the bug-root is "consumer infers identity from mode-divergent data," the fix is to add the canonical field as **required** on the data structure so TypeScript converts the contract from runtime to compile-time. The `unique symbol` brand alone makes two handles non-interchangeable; the required `__rt: '4.2' | '4.3'` field makes the runtime identity *legible and threaded* rather than re-sniffed downstream.

### Pattern 3: Provenance Header Without the Regen Escape Hatch (D-09 vs repack precedent)

**What:** SAFE-01 baselines carry a `_meta` provenance block (generating commit SHA + ISO timestamp), mirroring `tests/fixtures/repack-baselines.json`'s `_meta` idea — but **deliberately omit** the `UPDATE_FIXTURES=1` regen path that `repack-refresh-baselines.mjs` provides.

**When to use:** SAFE-01 only. The repack baseline legitimately refreshes on a sharp/libvips bump; the SAFE-01 baseline must NOT casually refresh during v1.6 because the whole point is that 4.2 output never changes.

**Why:** `[CITED: CONTEXT D-09]` Regenerating SAFE-01 during v1.6 must require deliberately removing the freeze guard — a loud, reviewable diff — not setting an env var. The freeze-guard test asserts the baseline matches AND that no `UPDATE_FIXTURES`-style branch exists in the SAFE-01 spec (a meta-test grepping the spec source for the escape-hatch pattern is a cheap, robust enforcement).

### Anti-Patterns to Avoid

- **Capturing the baseline after the alias lands** — defeats SAFE-01 entirely. The ancestry assertion exists precisely to make this impossible to merge.
- **`JSON.stringify` without finite-value handling** — silently maps a buggy `NaN`/`Infinity` to `null` and a `-0` to `0`; a silent-undersize regression producing a non-finite could false-pass the gate. (Reproduced this session.)
- **A hand-maintained fixture list** — D-08 forbids it; a newly added fixture must be auto-covered, and a silently dropped fixture must be a test failure (the enumeration manifest assertion).
- **Importing spine-core in `core/runtime/` in Phase 42** — Phase 42 scaffolds signatures only; the two adapter impls (which import spine-core) are Phase 43. An early spine-core import in `runtime.ts` would also need an arch carve-out it shouldn't have yet.
- **Touching `release.yml` or bumping `spine-player`** — D-10 (release.yml untouched) and Phase 47 (player bump) ownership. Both out of Phase 42 scope.
- **A bundled single-snapshot JSON** — D-07 locks per-fixture files for `git diff` diagnosability on heavy rigs.
- **`ci.yml` triggering on tags** — D-11 forbids it absolutely; `release.yml` owns tags and the auto-update path must stay isolated (`feedback_dont_push_release_tags`).

## RT-03: Opaque Branded Handles (concrete design)

`[VERIFIED: TypeScript semantics; structural-typing defeat is a well-established `unique symbol` brand pattern]`

```typescript
// src/core/runtime/types.ts
// Phase 42 RT-03/RT-04 — opaque boundary handles. Layer-3 pure: NO spine-core
// import, NO DOM/Electron/sharp. Phase 42 declares these; Phase 43's two
// adapter impls construct/unwrap them. Nothing else may.

/** The runtime identity. Threaded explicitly on every handle — never inferred
 *  from object shape (feedback_explicit_identity_over_inference). */
export type RuntimeTag = '4.2' | '4.3';

/** Per-handle-kind unique brand symbols. `declare const ... : unique symbol`
 *  produces a distinct, uninhabitable nominal type that structural typing
 *  cannot satisfy — a plain object, or a handle of a different kind, or a
 *  raw spine-core Skeleton, is NOT assignable. */
declare const SkeletonHandleBrand: unique symbol;
declare const SkeletonDataHandleBrand: unique symbol;
declare const AnimationStateHandleBrand: unique symbol;
declare const SlotHandleBrand: unique symbol;
declare const AttachmentHandleBrand: unique symbol;
declare const SkinHandleBrand: unique symbol;
declare const AnimationHandleBrand: unique symbol;
declare const AtlasHandleBrand: unique symbol;

/** Base shape: the brand makes it nominal; `__rt` makes runtime identity a
 *  REQUIRED, non-optional field (locked constraint — thread, don't infer). */
interface OpaqueHandle<B extends symbol> {
  readonly [k: symbol]: never;        // structural guard scaffold
  readonly __brand: B;                // nominal brand (phantom — never assigned a real value)
  readonly __rt: RuntimeTag;          // REQUIRED runtime tag — the threaded identity
}

export type OpaqueSkeleton        = OpaqueHandle<typeof SkeletonHandleBrand>;
export type OpaqueSkeletonData    = OpaqueHandle<typeof SkeletonDataHandleBrand>;
export type OpaqueAnimationState  = OpaqueHandle<typeof AnimationStateHandleBrand>;
export type OpaqueSlot            = OpaqueHandle<typeof SlotHandleBrand>;
export type OpaqueAttachment      = OpaqueHandle<typeof AttachmentHandleBrand>;
export type OpaqueSkin            = OpaqueHandle<typeof SkinHandleBrand>;
export type OpaqueAnimation       = OpaqueHandle<typeof AnimationHandleBrand>;
export type OpaqueAtlas           = OpaqueHandle<typeof AtlasHandleBrand>;

/** Factory + unwrap helpers, used ONLY inside the two Phase-43 adapter impls.
 *  Generic over brand so each adapter stamps its own __rt. The `unknown` cast
 *  is the single sanctioned boundary cast — quarantined to these two helpers. */
export function brandHandle<H extends OpaqueHandle<symbol>>(
  raw: unknown,
  rt: RuntimeTag,
): H {
  // The raw spine object carries no __brand/__rt at runtime; the brand is a
  // compile-time phantom. We attach __rt non-enumerably so a guard can read it
  // without polluting the spine object's own keys.
  Object.defineProperty(raw as object, '__rt', { value: rt, enumerable: false, configurable: true });
  return raw as H;
}

export function unwrapHandle<T>(h: OpaqueHandle<symbol>): T {
  return h as unknown as T;
}

/** Runtime-tag guard — lets a consumer ASSERT (not infer) the threaded tag.
 *  A cross-runtime mix is already a COMPILE error via the brand; this guard
 *  is the runtime backstop + the readable identity accessor. */
export function handleRuntime(h: OpaqueHandle<symbol>): RuntimeTag {
  return h.__rt;
}
```

**Why this is stronger than the arch-spec grep (the locked constraint):**
- The `unique symbol` `__brand` makes `OpaqueSkeleton` and `OpaqueSlot` *mutually unassignable*, and makes a raw spine-core `Skeleton` (from *either* runtime) unassignable to any `Opaque*` — a `tsc` error, not a runtime surprise. This is the dual-type-universe defense (`[CITED: research Pitfall 4]`).
- `__rt: RuntimeTag` is **required and non-optional** — a handle cannot be constructed without stamping its runtime, and downstream code reads `handleRuntime(h)` rather than re-sniffing `skeleton.spine` (`[CITED: feedback_explicit_identity_over_inference]`).
- The no-co-mingled-imports arch test (RT-03 backstop, §RT-04) is the *second* wall; the brand is the *first* and primary one. Defense in depth, exactly as the locked constraint requires ("stronger than the arch-spec grep").

**Phase 42 scope boundary:** `brandHandle`/`unwrapHandle` are declared in Phase 42 (signatures + bodies are trivial type-casts, no spine-core dependency) so Phase 43's adapters have the factory ready. They contain NO spine-core import — they operate on `unknown`. This keeps `core/runtime/` Layer-3 pure in Phase 42.

## SpineRuntime Interface (signature surface — RESOLVED)

`[CITED: ARCHITECTURE.md facade-interface table, derived from actual sampler.ts/bounds.ts call sites]`

Phase 42 scaffolds the interface **signatures only — no implementation bodies, no `pickRuntime` factory body**. The bodies + the two impls (`runtime-42.ts`, `runtime-43.ts`) are Phase 43 (RT-02). The exact surface to declare in `core/runtime/runtime.ts`:

```typescript
// src/core/runtime/runtime.ts — Phase 42: SIGNATURES ONLY. No bodies, no
// spine-core import. Phase 43 (RT-02) adds runtime-42.ts / runtime-43.ts impls.
import type {
  RuntimeTag, OpaqueSkeleton, OpaqueSkeletonData, OpaqueAnimationState,
  OpaqueSlot, OpaqueAttachment, OpaqueSkin, OpaqueAnimation, OpaqueAtlas,
} from './types.js';

export interface SpineRuntime {
  readonly tag: RuntimeTag;

  // --- loader-side (parse) ---
  makeAtlas(atlasText: string): OpaqueAtlas;
  parseSkeleton(parsedJson: unknown, atlas: OpaqueAtlas, atlasLess: boolean): OpaqueSkeletonData;
  applyRotatedRegionFix(data: OpaqueSkeletonData): void;          // 4.2: Phase-33 offset[] patch; 4.3: getOffsets() equivalent (Phase 43)

  // --- sampler-side (lifecycle) ---
  makeSkeleton(data: OpaqueSkeletonData): OpaqueSkeleton;
  makeAnimationState(data: OpaqueSkeletonData): OpaqueAnimationState;
  skins(data: OpaqueSkeletonData): OpaqueSkin[];
  animations(data: OpaqueSkeletonData): OpaqueAnimation[];
  animationDuration(anim: OpaqueAnimation): number;
  animationName(anim: OpaqueAnimation): string;
  skinName(skin: OpaqueSkin): string;

  setSkin(sk: OpaqueSkeleton, skin: OpaqueSkin): void;
  setupPose(sk: OpaqueSkeleton): void;                            // 4.2 setToSetupPose | 4.3 setupPose
  setupPoseSlots(sk: OpaqueSkeleton): void;                       // 4.2 setSlotsToSetupPose | 4.3 setupPoseSlots
  clearTracks(st: OpaqueAnimationState): void;
  setAnimation(st: OpaqueAnimationState, track: number, anim: OpaqueAnimation, loop: boolean): void;
                                                                  // 4.2 setAnimationWith | 4.3 setAnimation(obj overload)
  stateUpdate(st: OpaqueAnimationState, dt: number): void;
  stateApply(st: OpaqueAnimationState, sk: OpaqueSkeleton): void;
  skeletonUpdate(sk: OpaqueSkeleton, dt: number): void;
  updateWorldTransform(sk: OpaqueSkeleton, mode: 'pose' | 'reset' | 'update'): void;

  // --- visibility / iteration (the project_sampler_visibility_invariant surface) ---
  slots(sk: OpaqueSkeleton): OpaqueSlot[];
  slotName(slot: OpaqueSlot): string;
  slotBone(slot: OpaqueSlot): OpaqueSlot;                         // bone-of-slot accessor for boneAxisScale (see note)
  slotAttachment(slot: OpaqueSlot): OpaqueAttachment | null;      // 4.2 slot.getAttachment() | 4.3 slot.pose.attachment
  slotColorAlpha(slot: OpaqueSlot): number;                       // 4.2 slot.color.a | 4.3 slot.pose.color.a
  skinEntries(skin: OpaqueSkin): { slotIndex: number; name: string; attachment: OpaqueAttachment }[];

  // --- bounds math (the two computeWorldVertices + bone scale + attachment meta) ---
  attachmentKind(a: OpaqueAttachment): 'region' | 'mesh' | 'vertex' | 'skip';
  regionWorldVertices(slot: OpaqueSlot, a: OpaqueAttachment): Float32Array;        // 8 floats
  vertexWorldVertices(sk: OpaqueSkeleton, slot: OpaqueSlot, a: OpaqueAttachment): Float32Array;
  boneAxisScale(slot: OpaqueSlot): { x: number; y: number };      // 4.2 bone.getWorldScaleX/Y | 4.3 bone.appliedPose.getWorldScaleX/Y
  attachmentRegionMeta(a: OpaqueAttachment): {
    name?: string; pageW?: number; pageH?: number;
    originalW?: number; originalH?: number; canonW?: number; canonH?: number;
  } | null;
  attachmentUVs(a: OpaqueAttachment): Float32Array | null;
  sequenceRegions(a: OpaqueAttachment): { name: string }[] | null;
}

/** Phase 42 declares the signature; Phase 43 (RT-02) implements the lazy
 *  require()/import() switch. Body intentionally absent in Phase 42. */
export declare function pickRuntime(tag: RuntimeTag): SpineRuntime;
```

**Notes on the surface (for the planner — these are signature-shape decisions, not new findings):**
- The interface is derived from ARCHITECTURE.md §Pattern 1's table, which was itself derived from the *actual* `sampler.ts` (lifecycle + visibility pass) and `bounds.ts` (`instanceof RegionAttachment/VertexAttachment/MeshAttachment` branching + `bone.getWorldScaleX/Y`) call sites verified this session (`bounds.ts:64-87,153-179,383-397`).
- `slotBone` is added beyond ARCHITECTURE.md's table because `bounds.ts:383-397` reads `bone.getWorldScaleX/Y()` and `slot.bone` — the facade must expose a way to reach the slot's bone for `boneAxisScale`. The planner may fold this into `boneAxisScale(slot)` directly (recommended — it hides the bone entirely); listed separately here only to flag the call site exists. **Recommendation: keep only `boneAxisScale(slot)`; do NOT expose `slotBone` (a bone has no opaque handle type — exposing it would force an `OpaqueBone` the math layer never needs).** This is a refinement of ARCHITECTURE.md's table.
- `pickRuntime` is declared (`export declare function`) so type-checkers see the contract; its body is a Phase-43 deliverable (the lazy `require()` switch). In Phase 42 a `declare` keeps `core/runtime/` free of any spine-core import.
- **Do NOT scaffold method bodies, `runtime-42.ts`, or `runtime-43.ts` in Phase 42.** Their existence is Phase 43 (RT-02). Phase 42's RT-03/RT-04 deliverable is `types.ts` + the `runtime.ts` interface + the `LoadResult.runtime?` field + the arch anchors.

## Canonical-JSON Serialization (D-07 — RESOLVED)

`[VERIFIED: float edge-case behavior reproduced this session: JSON.stringify(NaN)→"null", JSON.stringify(Infinity)→"null", JSON.stringify(-0)→"0", and shallow-only key sort via the Object.keys(v).sort() replacer]`

The `SamplerOutput` is three `Map<string, PeakRecord>` (`sampler.ts:119-123`). `PeakRecord extends SampleRecord` (`types.ts:192-237`) — the numeric fields the gate must freeze byte-exactly are: `time`, `frame`, `peakScaleX`, `peakScaleY`, `peakScale`, `worldW`, `worldH`, `sourceW`, `sourceH` (plus string keys `attachmentKey`, `skinName`, `slotName`, `attachmentName`, `regionName?`, `animationName`, and booleans `isSetupPosePeak`, `isSequenceFrame?`).

**Recommended deterministic scheme:**

1. **Map → sorted-key plain object.** For each of the three maps, sort entries by key (the keys are `${skin}/${slot}/${attachment}` and `${animation}/${skin}/${slot}/${attachment}` — already deterministic strings). Emit as a plain object with keys inserted in sorted order.
2. **Recursive key sort for every nested object.** A custom replacer that sorts keys at *every* depth (the shallow `JSON.stringify(v, Object.keys(v).sort())` form verified this session sorts ONLY top-level keys — insufficient for nested `PeakRecord` objects). Use an explicit recursive canonicalizer that rebuilds objects with sorted keys, then `JSON.stringify(canonical, null, 2)`.
3. **Explicit non-finite + signed-zero handling (the silent-corruption guard).** Before serialization, walk every number:
   - `Number.isNaN(x)` → emit the sentinel string `"NaN"` (NOT `null` — `null` would let a silent-undersize bug producing NaN false-pass the gate).
   - `x === Infinity` → `"Infinity"`; `x === -Infinity` → `"-Infinity"`.
   - `Object.is(x, -0)` → emit `"-0"` (preserves the sign; `JSON.stringify` collapses `-0`→`0`). A peak scale should never be `-0`, but if it ever is, the gate must SEE it, not hide it.
   - Finite numbers: emit via a **fixed-precision formatter** to neutralize platform float-string drift. Recommendation: `Number(x.toPrecision(15))` then JSON-default formatting — 15 significant digits is below IEEE-754 double round-trip ambiguity (17) yet far above the user-facing 1e-3 tolerance and the 1e-9 peak-latch epsilon (`sampler.ts:70`), so it cannot mask a meaningful regression while it does neutralize last-bit noise. *(The 4.2 runtime is unchanged, so in practice the bits will be identical run-to-run on the same Node — the precision clamp is belt-and-suspenders against a Node-minor float-formatting change across the 3-OS matrix.)*
   - Rationale for *string* sentinels over `null`: `git diff` must show a regression. `"peakScale": "NaN"` in a diff is unmissable; `"peakScale": null` reads as "no data" and is exactly the silent failure mode SAFE-01 exists to catch.
4. **File layout (D-07 locked): one file per fixture.** `tests/safe01/baselines/<DIR>__<JSONBASENAME>.json` (e.g. `SIMPLE_PROJECT__SIMPLE_TEST.json`, `Girl__Girl.json`). Path-separator `/` → `__` to keep flat filenames. Each file:
   ```jsonc
   {
     "_meta": {
       "fixture": "fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json",
       "generatedCommit": "<git rev-parse HEAD at capture>",
       "generatedAt": "<ISO 8601>",
       "samplerHz": 120,
       "spineCoreVersion": "4.2.111",
       "schema": "safe01/v1"
     },
     "globalPeaks":   { "<sorted key>": { ...sorted PeakRecord... }, ... },
     "perAnimation":  { ... },
     "setupPosePeaks":{ ... }
   }
   ```
5. **`_manifest.json`** (D-08 enumeration target) — the sorted list of discovered fixtures + a top-level `_meta` provenance block (the single ancestry-checked artifact for the git-ancestor test; see §Git-Ancestor Assertion). Keeping the generating commit in `_manifest._meta` (one place) is cleaner than in every per-fixture file for the ancestry check; per-fixture `_meta.generatedCommit` is still useful for spot-debugging but the manifest is the authority.

**Round-trip self-test (recommended Phase 42 test):** a unit test that canonicalizes a fixture object containing `NaN`, `Infinity`, `-0`, `1e-9`, deeply-nested keys, and asserts the output is byte-stable across two serializations and that the sentinels appear. This is the Nyquist seam that proves the serializer itself is deterministic before it is trusted to gate `core/`.

## Fixture Auto-Discovery (D-08 — RESOLVED)

`[VERIFIED: git ls-files 'fixtures/**/*.json' this session — 13 git-tracked JSON fixtures; gitignored heavy rigs (Girl/, SKINS/, CHJ/, 3Queens/, Jokerman/) are present locally but NOT committed]`

**The D-08 tension to resolve for the planner:** D-08 says "baseline every in-repo fixture that today samples through 4.2, **heavy rigs included** (`Girl/`, `SKINS/JOKERMAN`, `CHJ/`, `3Queens/`, `Jokerman/`)" — but `[VERIFIED: .gitignore]` those exact heavy rigs are **gitignored** (`fixtures/Girl/`, `fixtures/SKINS/`, `fixtures/CHJ/`, `fixtures/3Queens/`, `fixtures/Jokerman/`, `fixtures/SAMPLER_ALPHA_ZERO/`, `fixtures/test_4.3/`, `fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/`, `fixtures/Rotated/`). They sample successfully *locally* but **do not exist on a fresh clone / in CI**.

This is a genuine conflict between D-08 ("heavy rigs included") and CI-01 ("from a fresh clone"). It is an **Open Question for the planner / discuss-phase** (see §Open Questions Q1) — research cannot unilaterally resolve a scope decision. The honest options:

- **Option A (recommended): two-tier discovery.** The auto-discovery walks `fixtures/**/*.json`. For each, it runs the "samples OK" predicate. The committed baseline + the enumeration manifest cover **only the git-tracked subset** (the 13 committed fixtures, minus the 3 version-reject ones → ~the ones that sample). Gitignored heavy rigs are baselined **locally** into the same `baselines/` dir but those baseline files are **also gitignored** (a `.gitignore` entry for `tests/safe01/baselines/<heavy>__*.json`), and the gate runs them only when present (`it`/`describe` guarded by fixture presence, the `feedback_gitignore_fixtures_check_test_refs` precedent — `it.skipIf`). CI's enumeration assertion covers the committed set; a developer with the heavy rigs gets the extra coverage D-08 wants. This satisfies "heavy rigs included" *for the developer who has them* without breaking fresh-clone CI.
- **Option B: commit the heavy rigs.** Directly contradicts the existing `.gitignore` rationale (licensed/proprietary, e.g. Jokerman is explicitly "proprietary, kept local only"; `Girl/`, `SKINS/JOKERMAN` likewise). **Rejected** — D-05 itself establishes the redistributability bar; these rigs fail it.
- **Option C: baseline only the committed set, drop "heavy rigs included" for v1.6.** Simplest, but loses the D-08-stated coverage where "subtle drift hides exactly there."

**Research recommendation: Option A.** It is the only option honoring BOTH D-08 ("heavy rigs included" — for anyone who has them) AND CI-01 ("fresh clone") AND the existing redistributability `.gitignore` policy. Flag for the planner to confirm; if the owner wants hard CI coverage of heavy-rig drift, that requires either redistributable heavy fixtures (owner-action, out of Phase 42 scope) or accepting Option C.

**Discovery predicate (the "successfully samples" test, D-08):**
```
discover():
  for f in glob('fixtures/**/*.json'):
    skip if f matches a known non-skeleton sidecar (e.g. *.stmproj is not *.json; skeleton2.json variants — see note)
    try:
      load = loadSkeleton(f)            // version-reject fixtures throw HERE → naturally excluded
      out  = sampleSkeleton(load)        // must produce a SamplerOutput (not throw)
      include f, record canonical(out)
    catch:
      exclude f   (record reason in a discovery log for human review — NOT silently dropped)
```
- Version-reject fixtures (`SPINE_3_8_TEST`, `SPINE_4_3_TEST`, `test_4.3`) throw `SpineVersionUnsupportedError` at `loadSkeleton` (verified this session) → automatically excluded by the predicate. No hand-list needed.
- **Dropout-is-failure (D-08 core requirement):** the `_manifest.json` commits the *sorted enumerated set* of included fixtures. `safe01-enumeration.spec.ts` re-runs discovery and asserts `discovered === manifest`. If a previously-sampling fixture starts throwing (a silent regression) it drops out of `discovered` → the set diverges → **test fails loudly**. A *new* fixture that samples appears in `discovered` but not `manifest` → test fails until the baseline is regenerated for it (the only sanctioned baseline addition path; pre-existing baselines stay frozen).
- **Sidecar/variant note for the planner:** the 13 tracked JSONs include `SIMPLE_PROJECT/skeleton.json`, `skeleton2.json`, `SIMPLE_TEST_GHOST.json` — confirm at plan time which actually sample (some may be partial/ghost fixtures). The predicate handles this automatically (non-sampling → excluded), but the enumeration manifest should be reviewed once at Phase 42 capture so the committed set is intentional, not accidental.

## Git-Ancestor Assertion (D-09 — RESOLVED)

`[VERIFIED: `git merge-base --is-ancestor` available and is the correct topological primitive; exit 0 = is-ancestor, exit 1 = not, this session]`

**The mechanism — find each commit, assert ancestry:**

```bash
# 1. The SAFE-01 baseline-introducing commit = the commit that ADDED the
#    baseline manifest. --diff-filter=A + --follow-safe, oldest match:
BASELINE_COMMIT=$(git log --diff-filter=A --format='%H' -- tests/safe01/baselines/_manifest.json | tail -1)

# 2. The npm-alias commit = the commit that ADDED the spine-core-42 alias line
#    to package.json. Pin to the alias key literal (robust to later edits):
ALIAS_COMMIT=$(git log -S 'spine-core-42' --format='%H' -- package.json | tail -1)

# 3. The acceptance test: BASELINE must be an ancestor of (predate) ALIAS.
git merge-base --is-ancestor "$BASELINE_COMMIT" "$ALIAS_COMMIT"
# exit 0 → PASS (baseline predates alias). exit 1 → FAIL (ordering violated).
```

**Test-harness form (vitest — runs on fresh clone AND in CI):**
```typescript
// tests/safe01/safe01-freeze-guard.spec.ts (sketch)
import { execFileSync } from 'node:child_process';
const sh = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

it('SAFE-01: the baseline commit is a git ancestor of the npm-alias commit (D-09)', () => {
  const baselineCommit = sh(['log','--diff-filter=A','--format=%H','--','tests/safe01/baselines/_manifest.json'])
    .split('\n').filter(Boolean).pop()!;
  const aliasCommit = sh(['log','-S','spine-core-42','--format=%H','--','package.json'])
    .split('\n').filter(Boolean).pop()!;
  // execFileSync throws on non-zero exit → an ancestry violation throws → test fails.
  expect(() =>
    execFileSync('git', ['merge-base','--is-ancestor', baselineCommit, aliasCommit])
  ).not.toThrow();
});
```

**Robustness notes for the planner:**
- **Until COMMIT B exists** (the alias is added in COMMIT B, AFTER the baseline COMMIT A), `git log -S 'spine-core-42' -- package.json` returns empty. The test must **skip-with-reason** when the alias commit is absent ("alias not yet introduced — ancestry vacuously satisfied; will enforce once RT-01 lands"), NOT fail. This is the Wave-0-lands-before-the-file pattern already used in `arch.spec.ts` (the ENOENT try/catch early-return precedent). Once COMMIT B lands, it asserts hard.
- `-S 'spine-core-42'` (pickaxe) finds the commit that introduced the literal string `spine-core-42` into `package.json` — robust because the alias key is the chosen literal (§Standard Stack) and it appears exactly once. Do NOT match on `package-lock.json` (lockfile churn is noisier).
- The provenance `_meta.generatedCommit` in `_manifest.json` is a **secondary** cross-check: assert it equals (or is an ancestor of) `BASELINE_COMMIT`. If someone regenerated the baseline content without a fresh commit, the recorded SHA and the introducing-commit SHA diverge — a tamper signal.
- **CI also runs this as an explicit step** (not only the vitest test) so the gate is visible in the CI log even if the test suite is later restructured. Belt-and-suspenders per D-09's "machine-checked, not reviewer memory."
- `git log --diff-filter=A ... | tail -1` takes the OLDEST add (defends against a file being deleted+re-added later — the original introduction is what matters for ordering).

**No-regen enforcement (D-09):** `safe01-freeze-guard.spec.ts` additionally greps its sibling `safe01-baseline.spec.ts` source for any `UPDATE_FIXTURES`/`process.env`-gated write branch and asserts it is ABSENT. This makes "regenerating SAFE-01 requires deleting the guard" structurally true — there is no env-var path, unlike `repack.loose-parity.spec.ts:49` (`SHOULD_UPDATE = process.env.UPDATE_FIXTURES === '1'`). Regeneration = a human deliberately editing committed JSON + the guard noticing the introducing-commit/recorded-SHA mismatch.

## CI Architecture (CI-01, D-10/D-11/D-12/D-13 — RESOLVED)

**`paths-ignore` glob set (D-11 — RESOLVED):**
```yaml
on:
  push:
    branches: ['**']            # any branch (D-11)
    paths-ignore:
      - '.planning/**'
      - '**/*.md'
      - 'docs/**'               # (none today, future-proof)
      - 'LICENSE'
      - '.gitignore'            # gitignore-only edits don't affect runtime
  pull_request:
    branches: [main]            # PR→main only (D-11/D-12)
    paths-ignore:
      - '.planning/**'
      - '**/*.md'
      - 'docs/**'
      - 'LICENSE'
  workflow_dispatch:
  # NEVER `tags:` — release.yml owns tags (D-10/D-11)
```
- `**/*.md` excludes `42-OWNER-EXPORT-SPEC.md`, `RESEARCH.md`, `README.md`, etc. — a pure docs commit stays quiet.
- A commit touching `src/**` AND `.planning/**` **still runs** (GitHub `paths-ignore` semantics: a push is skipped only if *every* changed file matches an ignore glob). This is exactly D-11's "a commit that also touches code still runs."
- Plain-English for the owner: *CI runs when you change code; it stays quiet when you only edit planning notes or docs.*

**Lane split (D-12 — RESOLVED):**
```yaml
jobs:
  test:                         # every triggering push, 3-OS matrix
    strategy:
      fail-fast: true
      matrix:
        os: [ubuntu-latest, windows-2022, macos-14]   # mirrors release.yml exactly
    runs-on: ${{ matrix.os }}
    steps:
      - checkout (full history — fetch-depth: 0, REQUIRED for the git-ancestry check)
      - setup-node 22, cache npm
      - npm ci                  # lockfile-frozen (RT-01 reproducibility)
      - npm run typecheck       # tsc dual-type isolation (4.2 + 4.3 distinct)
      - npm run test            # full vitest: SAFE-01 byte-equal gate (heavy rigs
                                #   per Option A — committed set), enumeration,
                                #   git-ancestry assertion, runtime-distinctness,
                                #   arch anchors
      - explicit git-ancestry CI step  # visible-in-log belt-and-suspenders (D-09)

  bundle-smoke:                 # ONLY on pull_request → main (D-12)
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest      # one OS is sufficient for a packaging-integrity smoke
    needs: test
    steps:
      - checkout (fetch-depth: 0)
      - setup-node 22; npm ci
      - npm run build           # electron-vite build + electron-builder (dir is enough)
      - assert BOTH spine-core copies survive packaging
        (node_modules/@esotericsoftware/spine-core@4.3.0 AND
         node_modules/spine-core-42@4.2.111 present in the packed app)
      - run the BUILT worker (out/main/sampler-worker.cjs, NOT src/) against
        a committed 4.2 fixture AND the in-repo 4.3 JSON (D-13 smoke) — proves
        tree-shaking/packaging did not drop the dynamically-dispatched runtime
```

**Critical CI requirement — `fetch-depth: 0`:** `actions/checkout` defaults to a shallow clone (depth 1). `git merge-base --is-ancestor` and `git log --diff-filter=A` need full history. Both jobs that run the ancestry check MUST set `fetch-depth: 0`. `release.yml` does not need this (no ancestry check there) — another reason `ci.yml` is a separate file (D-10).

**D-13 4.3 CI arm (dual-install integrity only — RESOLVED):**
- `[VERIFIED this session]` `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` is a `4.3.91-beta` export with `root.constraints` that **currently throws `SpineVersionUnsupportedError`** through the gated `loadSkeleton` (Phase 42 does NOT modify `loader.ts` — that is Phase 44). Therefore the D-13 smoke must **drive the 4.3 runtime's `SkeletonJson` directly**, bypassing `loader.ts`:
  ```
  import { SkeletonJson, AtlasAttachmentLoader, TextureAtlas } from '@esotericsoftware/spine-core'; // = 4.3.0
  // construct a 4.3 SkeletonJson, readSkeletonData(SPINE_4_3_TEST json)
  // ASSERT: it does NOT throw SpineVersionUnsupportedError (it gets PAST the v1.4 reject
  //         because we never call the gated loader — we call the 4.3 runtime directly)
  // ASSERT: skeletonData parses (constraints array consumed by 4.3 SkeletonJson)
  ```
  **Caveat for the planner:** `SPINE_4_3_TEST.json` is `4.3.91-**beta**`. The stable 4.3.0 `SkeletonJson` *should* read it (the constraints schema stabilized before 4.3.0), but a beta→stable schema drift on this specific fixture is a LOW-confidence risk. D-13 only asserts "loads past the v1.4 reject + parses without throwing" (integrity, not value correctness) so minor beta drift that still parses is acceptable. If the beta JSON fails to parse under stable 4.3.0, the planner's fallback is a tiny hand-authored stable-4.3 JSON (`root.constraints: []` + one bone + one region) as the D-13 smoke input — this is a fixture concern, flagged.
- Runtime-distinctness (D-13): `adapter42.version !== adapter43.version` and `Slider`/`BonePose`/`Pose`/`Posed`/`SlotPose` are exported from `@esotericsoftware/spine-core` (4.3.0) and **absent** from `spine-core-42` (4.2.111). `[VERIFIED this session]` the two specifiers resolve to distinct versions (`4.3.0` vs `4.2.111`).
- **Phase-44 owner-fixture-absence guard (D-13):** a test (or CI step) that, **when the milestone reaches Phase 44**, fails if the owner ORCL-01/SLIDER-01 fixtures are still absent. Concrete realization for Phase 42: a guarded test that checks for the *expected owner-fixture directories* (§Fixture Directory Naming) and is `it.skipIf`'d while still in Phase 42/43 but flips to a hard failure once a Phase-44 marker exists. The simplest robust marker is the existence of any Phase-44 plan/phase artifact, OR — cleaner — a single committed constant the roadmap flips. **Recommendation: a `tests/safe01/phase-gate.ts` exporting `CURRENT_PHASE` (or read from `.planning/STATE.md`'s `Phase: N`); the guard asserts "if CURRENT_PHASE >= 44 then ORCL-01/SLIDER-01 fixture dirs MUST exist."** Flag the exact marker mechanism for the planner — it is a small design choice, not a research unknown.

**Production-bundle smoke (Pitfall 8 defense):** runs the *built* `out/main/sampler-worker.cjs` (not `src/`) so a tree-shaking/packaging drop of the dynamically-dispatched 4.3 runtime — which works in dev but breaks in the packaged app (`feedback_platform_divergent_check_stale_build` class) — is caught at PR-to-main, paying the slow packaging cost only at merge (D-12).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Side-by-side dual spine-core | submodule / fork / Vite plugin / tsconfig `paths` / `npm overrides` | `package.json` npm alias (`npm:` protocol) + committed lockfile | `[CITED: STACK.md, reproduced this session]` npm alias resolves natively in all 5 toolchains with zero config. `overrides` is a verified no-op (spine-player has no direct spine-core dep). Submodule/fork rejected by locked decision (4.3.0 is published). |
| Git ancestry check | timestamp comparison / `git log` date parsing | `git merge-base --is-ancestor A B` | Timestamps aren't monotonic across machines/rebases; `--is-ancestor` is the exact topological primitive (verified). |
| Deterministic JSON | `JSON.stringify(v, Object.keys(v).sort())` alone | recursive sorted-key canonicalizer + explicit non-finite/`-0` handling | `JSON.stringify` silently corrupts `NaN`/`Infinity`→`null`, `-0`→`0`, and sorts only top-level keys (all reproduced this session). A silent-undersize bug producing a non-finite would false-pass the gate. |
| Baseline refresh tooling | a SAFE-01 `UPDATE_FIXTURES=1` script | NO regen path (D-09 locked) | The repack precedent (`repack-refresh-baselines.mjs`) is *correct for repack* (refresh on sharp bump) but *wrong for SAFE-01* (4.2 output must never change). Regen = deliberate guard removal. |
| Cross-runtime type safety | runtime `typeof`/`instanceof` checks at the boundary | `unique symbol` branded opaque handles + required `__rt` tag | `[CITED: Pitfall 4 + feedback_explicit_identity_over_inference]` Structural typing silently accepts the wrong runtime's `Skeleton`; the brand makes it a `tsc` error (compile-time, stronger than any runtime guard). |
| Fixture inclusion list | hand-maintained array of fixture paths | auto-discovery + committed enumeration manifest + dropout-is-failure assertion | D-08 locked. A hand list rots; a silently-dropped fixture (a regression!) must itself fail the suite. |
| Layer-3 enforcement | a new bespoke scanner | extend the existing `tests/arch.spec.ts` glob (`src/core/**`) + named anchors | `arch.spec.ts:148-178` already scans `src/core/**` for fs/sharp; `core/runtime/` falls under it automatically. Add named anchors (the established Phase-9/18/36 pattern) for `core/runtime/` + no-co-mingled-alias-imports. |

**Key insight:** Phase 42 builds *zero* novel infrastructure. Every mechanism it needs has an in-repo precedent (`repack-baselines.json` `_meta` provenance, `arch.spec.ts` glob+named-anchor, `release.yml` 3-OS matrix, `it.skipIf` gitignored-fixture guard) or a verified-native tool (npm alias, `git merge-base --is-ancestor`). The phase's risk is entirely in *ordering and determinism discipline*, not in technical novelty.

## Common Pitfalls

### Pitfall 1: Baseline captured after the alias (the existential one)
**What goes wrong:** RT-01 alias lands before/with SAFE-01; the "baseline" freezes already-refactored behavior; the regression gate validates nothing.
**Why it happens:** Natural instinct to "set up dependencies first." The alias is the highest-blast-radius change and *feels* like step 1.
**How to avoid:** The 4-commit topology (A→B→C→D) with the git-ancestry assertion in CI. COMMIT A has spine-core STILL at 4.2.111 only. The ancestry test FAILS the build if B is not a descendant of A.
**Warning signs:** `package.json` shows the alias in the same commit as (or before) `tests/safe01/baselines/_manifest.json`. The ancestry test skipped "vacuously" *after* the alias already exists.

### Pitfall 2: `JSON.stringify` silent float corruption
**What goes wrong:** A silent-undersize bug produces `NaN`/`Infinity`/`-0` in a `PeakRecord`; `JSON.stringify` maps it to `null`/`0`; the gate compares `null === null` and false-passes; the regression ships.
**Why it happens:** `JSON.stringify(NaN)` is `"null"` by spec — non-obvious, reproduced this session.
**How to avoid:** The §Canonical-JSON scheme's explicit non-finite/`-0` → distinct *string sentinels* (`"NaN"`, `"Infinity"`, `"-0"`) so a regression is unmissable in `git diff`.
**Warning signs:** A baseline JSON contains `"peakScale": null` or `"peakScale": 0` where a real scale is expected.

### Pitfall 3: Naive alias direction corrupts spine-player
**What goes wrong:** Keeping `@esotericsoftware/spine-core` = 4.2.111 + aliasing 4.3 as `spine-core-43`. `spine-player@4.3.0`'s bare `export * from "@esotericsoftware/spine-core"` resolves to the hoisted 4.2.111 → a 4.3 renderer running 4.2 skeleton objects (split-brain).
**Why it happens:** The "obvious" direction is "keep current canonical, add the new one aliased." It is exactly backwards here.
**How to avoid:** `[CITED: STACK.md, reproduced this session]` 4.3.0 canonical, 4.2.111 = `spine-core-42` alias. **Note: Phase 42 does NOT bump spine-player (that is Phase 47) — but RT-01's direction must already be the inverted one so Phase 47 is a clean drop-in.** The runtime-distinctness test guards this.
**Warning signs:** `spine-core-43` appears as the alias key anywhere. `package.json` keeps `@esotericsoftware/spine-core: 4.2.111`.

### Pitfall 4: Dual type-universe structural corruption
**What goes wrong:** A 4.2 `Skeleton` flows into a 4.3-typed parameter; `tsc` passes (structural overlap); runtime garbage.
**Why it happens:** Both packages export identically-named, structurally-similar classes.
**How to avoid:** The RT-03 `unique symbol` brand + required `__rt` tag (compile error) AND the no-co-mingled-alias-imports arch anchor (no file imports both `@esotericsoftware/spine-core` and `spine-core-42`). Phase 42 lays both walls before any Phase-43 impl can leak a raw type.
**Warning signs:** A bare `Skeleton` parameter outside an adapter file; any file importing both alias specifiers; an `as any` near a spine type at a boundary.

### Pitfall 5: Shallow clone breaks the ancestry check in CI
**What goes wrong:** `actions/checkout` default depth-1; `git merge-base --is-ancestor` / `git log --diff-filter=A` see no history → the D-09 gate errors or false-passes.
**Why it happens:** GitHub Actions shallow-clones by default; the local dev box has full history so it works locally and breaks only in CI (a `feedback_platform_divergent` class).
**How to avoid:** `fetch-depth: 0` on every `ci.yml` job that runs the ancestry check. Verified this is the GitHub-documented full-history opt-in.
**Warning signs:** Ancestry test passes locally, errors in CI with "Not a valid commit name" / unexpected skip.

### Pitfall 6: D-08 "heavy rigs included" vs gitignored proprietary rigs
**What goes wrong:** Discovery tries to baseline `Girl/`, `SKINS/JOKERMAN`, etc.; they're gitignored → absent on fresh clone → CI fails OR the baseline can't be committed (proprietary).
**Why it happens:** D-08 names heavy rigs that are exactly the ones `.gitignore` excludes as licensed/proprietary.
**How to avoid:** Option A (§Fixture Auto-Discovery) — committed enumeration covers the git-tracked set; gitignored heavy-rig baselines are themselves gitignored and `it.skipIf`-guarded (present-locally coverage). **Flag for planner confirmation (Open Question Q1).**
**Warning signs:** CI red on a fresh clone with "fixture not found: fixtures/Girl/..."; an attempt to `git add` a proprietary rig.

### Pitfall 7: D-13 smoke calls the gated `loader.ts` (which still rejects 4.3)
**What goes wrong:** The D-13 4.3 load-smoke calls `loadSkeleton(SPINE_4_3_TEST)` expecting it to pass; it throws `SpineVersionUnsupportedError` because Phase 42 does NOT modify `loader.ts` (that is Phase 44).
**Why it happens:** Confusing "the 4.3 runtime can read it" with "our gated loader lets it through." The loader gate flip is Phase 44/45, not Phase 42.
**How to avoid:** D-13 smoke drives the 4.3 `SkeletonJson` **directly** (bypassing `loader.ts`), asserting only dual-install integrity (loads past the v1.4 reject *because we never call the gate*, parses without throwing). Verified this session that `loadSkeleton` still throws on `SPINE_4_3_TEST`.
**Warning signs:** D-13 test calls `loadSkeleton(...)` on a 4.3 fixture; test fails with `SpineVersionUnsupportedError`.

## Code Examples

### Extending `tests/arch.spec.ts` for RT-04 (Layer-3 + no-co-mingled imports)

`[CITED: tests/arch.spec.ts:148-178 — the existing src/core/** fs/sharp scanner; this is the established pattern to extend]`

The existing glob scanner at `arch.spec.ts:148-178` already globs `src/core/**/*.ts` and forbids `sharp`/`node:fs`. `core/runtime/*.ts` falls under it automatically with **no carve-out** (Phase 42 adds no fs/sharp/DOM there — it has no spine-core import either). Add two **named anchors** (the established Phase-9/18/36 named-anchor pattern, with the ENOENT-tolerant try/catch so Wave 0 can land the anchor before the files exist):

```typescript
// tests/arch.spec.ts — append (RT-04 + RT-03 backstop)
describe('Phase 42 RT-04: src/core/runtime/ is Layer-3 pure (no DOM/Electron/sharp/spine-core in Phase 42)', () => {
  it('core/runtime/*.ts import neither sharp/node:fs/electron NOR a spine-core package (signatures only in Phase 42)', () => {
    const files = globSync('src/core/runtime/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // Phase 42: runtime/ is signatures only — NO spine-core import yet
      // (the two adapter impls that import it are Phase 43 / RT-02).
      if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]electron['"]|from ['"]@esotericsoftware\/spine-core['"]|from ['"]spine-core-42['"]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `core/runtime Phase-42 purity violation: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('Phase 42 RT-03 backstop: no source file imports BOTH spine-core alias specifiers', () => {
  it('no src/**/*.ts imports @esotericsoftware/spine-core AND spine-core-42 in the same file', () => {
    const files = globSync('src/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const has43 = /from ['"]@esotericsoftware\/spine-core['"]/.test(text);
      const has42 = /from ['"]spine-core-42['"]/.test(text);
      if (has43 && has42) offenders.push(file);
    }
    expect(offenders, `Files co-mingling both spine-core runtimes: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

### `LoadResult.runtime` field (Phase 42 — optional, declared not wired)

`[CITED: src/core/types.ts:55 LoadResult — add an optional field; sampler/bounds are NOT rewired in Phase 42]`

```typescript
// src/core/types.ts — LoadResult gains an OPTIONAL runtime handle in Phase 42.
// Optional (`?`) because Phase 42 only declares the boundary; loader.ts does
// NOT populate it and sampler.ts/bounds.ts do NOT consume it until Phase 43.
import type { SpineRuntime } from './runtime/runtime.js';

export interface LoadResult {
  // ...all existing fields UNCHANGED...
  /** Phase 42 (RT-03): the runtime adapter that parsed this skeleton.
   *  Declared in Phase 42; populated by loader.ts and consumed by
   *  sampler.ts/bounds.ts in Phase 43 (RT-02). Optional until then. */
  runtime?: SpineRuntime;
}
```

> Making it optional in Phase 42 keeps every existing `core/` consumer compiling unchanged (the field is additive, no existing code reads it). Phase 43 narrows it to required when the facade is wired and the 4.2 goldens are proven byte-green through it.

## Runtime State Inventory

> This phase is infrastructure/de-risking, NOT a rename/refactor. The "runtime state" here is the *4.2 sampler output itself* — the thing SAFE-01 freezes. This inventory documents what state the baseline must capture and what is NOT state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (the frozen artifact) | `SamplerOutput` = 3 `Map<string, PeakRecord>` (`globalPeaks` + `perAnimation` + `setupPosePeaks`, `sampler.ts:119-123`) for every git-tracked in-repo fixture that samples through 4.2.111 (~10 of 13 tracked JSONs; 3 are version-reject and naturally excluded). `PeakRecord` numeric fields to freeze byte-exact: `time, frame, peakScaleX, peakScaleY, peakScale, worldW, worldH, sourceW, sourceH` (`types.ts:192-237`). | Capture as committed per-fixture canonical JSON in COMMIT A (D-06/D-07). |
| Live service config | None — Phase 42 has no external services, no databases, no n8n/Datadog/Tailscale. The sampler is a pure in-process computation. | None — verified by inspection (no network/service code in `core/`). |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2. The only "registration" is CI (`ci.yml`), which is declarative and committed. | None. |
| Secrets/env vars | None new. SAFE-01 deliberately introduces **no** env-var regen path (D-09 — the *absence* of `UPDATE_FIXTURES` is the design). Existing `UPDATE_FIXTURES` (`repack.loose-parity.spec.ts:49`) is unrelated and untouched. | Confirm the SAFE-01 spec has no `process.env` write branch (the freeze-guard meta-test enforces this). |
| Build artifacts | The npm alias adds `node_modules/spine-core-42/` (a second spine-core copy). `package-lock.json` is regenerated (committed in COMMIT B). electron-builder must pack BOTH copies — verified by the PR-only production-bundle smoke (D-12). No stale-artifact migration needed (greenfield alias add). | Commit `package-lock.json` with the alias; bundle-smoke asserts both copies survive packaging. |

**Canonical question — "after this phase, what runtime state has changed?"**: Exactly one thing — `node_modules` now contains two spine-core copies and `package-lock.json` records the alias. The 4.2 sampler *output* is byte-frozen and machine-proven unchanged (that IS the phase). No data migration, no service reconfiguration, no OS state.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SEED-006 "5 renames + 2 sig changes, vendor decision" (beta-built) | 4.3.0 stable is a Pose-architecture rewrite; PORT-04 vendoring collapses to a `package.json` npm alias | 4.3.0 stable published 2026-05-15 | Phase 42's RT-01 is a 2-line `package.json` change, NOT a submodule/fork. SEED-006's PORT-04 inventory is FALSIFIED — use SUMMARY.md/STACK.md. |
| Single canonical `@esotericsoftware/spine-core` | 4.3.0 canonical + 4.2.111 aliased (`spine-core-42`) | This milestone (v1.6) | The alias *direction* is inverted from the obvious one (load-bearing for the Phase-47 spine-player bump). |

**Deprecated/outdated:**
- SEED-006's `PORT-04` 3-option vendoring decision — collapsed to a published-npm alias. Read SEED-006 only for trigger/motivation (CONTEXT canonical_refs).
- The naive alias direction (`@esotericsoftware/spine-core` stays 4.2.111, add `spine-core-43`) — falsified live in STACK.md; produces a spine-player split-brain.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ~10 sampling git-tracked fixtures (13 tracked JSONs minus 3 version-reject) all produce a *stable* `SamplerOutput` run-to-run on the CI Node (the 4.2 runtime is unchanged so this should hold — `sampler.ts` already has an N1.6 determinism test). | Fixture Auto-Discovery | LOW — if a fixture is non-deterministic at 120 Hz, its baseline can't be byte-frozen; the existing N1.6 determinism test (`sampler.spec.ts:240`) is evidence it is deterministic. Mitigation: the canonical-JSON precision clamp + the round-trip self-test surface this at Phase 42 capture, not later. |
| A2 | `SPINE_4_3_TEST.json` (`4.3.91-beta`) parses under the stable 4.3.0 `SkeletonJson` (the constraints schema stabilized before 4.3.0). | CI Architecture / D-13 | LOW — D-13 only asserts "loads past the v1.4 reject + parses without throwing" (integrity, not value). If the beta JSON fails to parse under stable 4.3.0, fallback = a hand-authored minimal stable-4.3 JSON. Flagged for planner. |
| A3 | `git log -S 'spine-core-42' -- package.json` reliably finds exactly the alias-introducing commit (the literal appears once, only in the alias line). | Git-Ancestor Assertion | LOW — the alias key is the chosen unique literal; if a comment/other dep ever contained the string, use `git log --diff-filter=... -G'"spine-core-42":\s*"npm:'` (regex pickaxe on the exact JSON shape) instead. Planner can harden if needed. |
| A4 | The Phase-44 owner-fixture-absence guard can read the current phase from `.planning/STATE.md` (`Phase: N of 47`) or a committed constant. | CI Architecture / D-13 | LOW — small mechanism choice; STATE.md is committed and machine-parseable, but the planner should pick the exact marker (a committed `CURRENT_PHASE` constant is the most robust; STATE.md parsing is brittle to format drift). Flagged. |
| A5 | electron-builder's `node_modules` prune keeps both `@esotericsoftware/spine-core` and `spine-core-42` (pure JS, no native deps, no `asarUnpack` needed). | Production-Bundle Smoke | LOW — STACK.md asserts this; the PR-only bundle-smoke is precisely the verification that turns this assumption into a checked fact at merge. The assumption only affects whether the smoke is *needed* (it is — that's its purpose). |

## Open Questions (RESOLVED)

1. **D-08 "heavy rigs included" vs gitignored proprietary rigs (the one genuine scope tension).**
   - What we know: D-08 names `Girl/`, `SKINS/JOKERMAN`, `CHJ/`, `3Queens/`, `Jokerman/` as must-baseline "subtle drift hides exactly there." `[VERIFIED]` all are gitignored as licensed/proprietary (Jokerman explicitly "proprietary, kept local only"); they do NOT exist on a fresh clone / in CI.
   - What's unclear: whether the owner accepts Option A (committed enumeration covers the git-tracked set; heavy-rig baselines are gitignored + `it.skipIf`-guarded → drift coverage *for whoever has the rigs*, fresh-clone CI green) — OR wants hard CI coverage of heavy-rig drift (which needs redistributable heavy fixtures = owner-action, out of Phase 42 scope) — OR accepts Option C (drop "heavy rigs included" for v1.6).
   - Recommendation: **Option A** (the only one honoring D-08 + CI-01 + the redistributability `.gitignore` policy simultaneously). Surface explicitly to the planner / a discuss-phase touch-up; it is a scope decision research cannot unilaterally make. Does NOT block planning the other 4 deliverables.
   - **RESOLVED: D-08-R Option A two-tier discovery (user-confirmed 2026-05-16); committed manifest covers the git-tracked redistributable subset only, heavy-rig baselines gitignored + it.skipIf-guarded — implemented in 42-01-PLAN.md Task 2**

2. **Phase-44 owner-fixture-absence guard — exact marker mechanism (A4).**
   - What we know: D-13 requires a guard that FAILS CI if ORCL-01/SLIDER-01 fixtures are absent *by Phase 44*. The guard must be Phase-aware.
   - What's unclear: the cleanest Phase marker — a committed `CURRENT_PHASE` constant the roadmapper flips, vs parsing `.planning/STATE.md`, vs the existence of a Phase-44 artifact.
   - Recommendation: a committed `tests/safe01/phase-gate.ts` exporting a `CURRENT_PHASE` integer (robust, explicit, no format-drift risk). Small design choice — flag for the planner to lock; not a research unknown.
   - **RESOLVED: committed tests/safe01/phase-gate.ts CURRENT_PHASE constant (NOT STATE.md parsing) — 42-04-PLAN.md Task 2**

3. **`SPINE_4_3_TEST.json` is beta (`4.3.91-beta`) — stable-4.3.0 parse confidence (A2).**
   - What we know: D-13 uses an in-repo 4.3 JSON for the load-smoke; the only committed one is this beta export.
   - What's unclear: whether stable 4.3.0 `SkeletonJson` parses a `4.3.91-beta` constraints schema cleanly.
   - Recommendation: attempt it; D-13 asserts integrity only (parses without throwing, past the v1.4 reject) so minor drift that still parses is fine. Fallback: a tiny hand-authored stable-4.3 JSON as the smoke input. Flag for the planner; low risk.
   - **RESOLVED: attempt the beta 4.3 parse; guarded fallback to hand-authored fixtures/SPINE_4_3_MIN/ stable-4.3 JSON — 42-04-PLAN.md Task 1**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `npm` (alias `npm:` protocol + `npm ci`) | RT-01 | ✓ | npm bundled w/ Node 24 (CI uses Node 22) | — |
| `@esotericsoftware/spine-core@4.3.0` | RT-01 / D-13 | ✓ (npm registry) | 4.3.0 (`latest`, verified) | — (published; submodule/fork rejected) |
| `@esotericsoftware/spine-core@4.2.111` (alias target) | RT-01 / SAFE-01 | ✓ (already installed; registry) | 4.2.111 (integrity verified) | — |
| `git` (`merge-base --is-ancestor`, `log --diff-filter`) | SAFE-01 / D-09 | ✓ | system git (verified this session) | — (no viable fallback; ancestry IS the acceptance test) |
| `vitest` 4 | all test seams | ✓ | installed | — |
| `node:crypto`, `node:child_process`, `node:fs` (test-side) | serializer / ancestry / discovery | ✓ | Node built-ins | — |
| GitHub Actions runners (`ubuntu-latest`, `windows-2022`, `macos-14`) | CI-01 | ✓ (mirrors release.yml) | per release.yml | — |
| electron-builder | CI-01 bundle-smoke | ✓ (devDependency) | installed | — |

**Missing dependencies with no fallback:** None — every dependency is present or registry-available (all verified this session).
**Missing dependencies with fallback:** None.

## Validation Architecture

> Nyquist validation is ENABLED for this phase. Every observable behavior that proves SAFE-01/RT-01/RT-03/RT-04/CI-01 hold, the sampling granularity, and the test seam.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 4 (installed) — `environment: 'node'`, `include: ['tests/**/*.spec.ts','tests/**/*.spec.tsx']` |
| Config file | `vitest.config.ts` (no change needed) |
| Quick run command | `npx vitest run tests/safe01 tests/runtime tests/arch.spec.ts` |
| Full suite command | `npm run test` (vitest run) — what CI's `test` job runs |
| Typecheck (dual-type isolation) | `npm run typecheck` (`tsc --noEmit` node + web) — proves 4.2/4.3 type universes are distinct |

### Phase Requirements → Test Map

| Req ID | Behavior to prove | Test Type | Automated Command | File Exists? |
|--------|-------------------|-----------|-------------------|--------------|
| SAFE-01 | Every discovered 4.2 fixture's full `SamplerOutput` is byte-identical to the committed canonical baseline (strict `toEqual`, not epsilon) | golden/unit | `npx vitest run tests/safe01/safe01-baseline.spec.ts` | ❌ Wave 0 |
| SAFE-01 | The discovered fixture set equals the committed enumeration manifest (a silent dropout = test failure) | unit | `npx vitest run tests/safe01/safe01-enumeration.spec.ts` | ❌ Wave 0 |
| SAFE-01 | The SAFE-01 baseline commit is a git ancestor of the npm-alias commit (D-09; skip-with-reason until alias exists, hard-assert after) | integration (git) | `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ❌ Wave 0 |
| SAFE-01 | The canonical serializer is deterministic and surfaces (not hides) `NaN`/`Infinity`/`-0` as string sentinels | unit | `npx vitest run tests/safe01/canonical-json.spec.ts` | ❌ Wave 0 |
| SAFE-01 | No `UPDATE_FIXTURES`/`process.env` regen branch exists in the SAFE-01 baseline spec (D-09) | unit (meta) | `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ❌ Wave 0 |
| RT-01 | Both `@esotericsoftware/spine-core` and `spine-core-42` resolve to distinct versions under vitest/Node | unit | `npx vitest run tests/runtime/alias-resolution.spec.ts` | ❌ Wave 0 |
| RT-01 | Dual-type isolation: 4.2 and 4.3 `Skeleton` types are non-overlapping under `tsc moduleResolution:bundler` | typecheck | `npm run typecheck` (passes = isolated) | ✓ (command exists) |
| RT-01 | `npm ci` from the committed lockfile reproduces both copies (no churn) | CI step | `npm ci` in `ci.yml` `test` job | ❌ Wave 0 (ci.yml) |
| RT-01 | Vite renderer + Vite main both build with the alias resolvable | CI step (bundle-smoke) | `npm run build` in `ci.yml` `bundle-smoke` | ❌ Wave 0 (ci.yml) |
| RT-03 | `adapter42.version !== adapter43.version`; `Slider`/`BonePose`/`Pose`/`Posed`/`SlotPose` exist only in the 4.3 module | unit | `npx vitest run tests/runtime/runtime-distinctness.spec.ts` | ❌ Wave 0 |
| RT-03 | A cross-runtime handle mix is a **compile-time** error (brand + required `__rt`) | typecheck (negative) | `npm run typecheck` + a `// @ts-expect-error` fixture asserting the mix fails to compile | ❌ Wave 0 |
| RT-03 | No source file imports BOTH spine-core alias specifiers (backstop) | unit (arch) | `npx vitest run tests/arch.spec.ts` | ✓ (extend existing) |
| RT-04 | `core/runtime/**` imports no DOM/Electron/sharp/node:fs (and no spine-core in Phase 42) | unit (arch) | `npx vitest run tests/arch.spec.ts` | ✓ (extend existing) |
| CI-01 | `ci.yml` triggers on push(any branch)+PR→main+dispatch, NEVER tags; `paths-ignore` skips docs-only | CI (self) | workflow runs on push; manual `paths-ignore` review | ❌ Wave 0 (ci.yml) |
| CI-01 | 3-OS matrix runs full vitest + SAFE-01 gate + ancestry + distinctness on every code push | CI | `ci.yml` `test` job (3-OS) | ❌ Wave 0 (ci.yml) |
| CI-01 / D-13 | The in-repo 4.3 JSON loads through the 4.3 runtime's `SkeletonJson` directly without the v1.4 reject (integrity, not value) | unit/integration | `npx vitest run tests/runtime/d13-43-load-smoke.spec.ts` | ❌ Wave 0 |
| CI-01 | electron-builder packages BOTH spine-core copies; the BUILT worker runs against a 4.2 + the 4.3 fixture | CI (bundle-smoke) | `ci.yml` `bundle-smoke` job (PR→main only) | ❌ Wave 0 (ci.yml) |
| CI-01 / D-13 | CI FAILS if owner ORCL-01/SLIDER-01 fixtures are absent once the milestone reaches Phase 44 | unit (phase-gated) | `npx vitest run tests/safe01/phase44-fixture-guard.spec.ts` (skipIf < P44) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/safe01 tests/runtime tests/arch.spec.ts` (the Phase 42 surface — fast; SAFE-01 baseline excl. gitignored heavy rigs runs in seconds).
- **Per wave merge:** `npm run typecheck && npm run test` (full suite incl. all existing regression tests — proves Phase 42 broke nothing pre-existing).
- **Phase gate:** Full suite green on the 3-OS CI matrix + the git-ancestry CI step green + (at PR→main) the production-bundle smoke green, before `/gsd-verify-work 42`.
- **Observable-behavior granularity rationale:** SAFE-01 is sampled at the *full `SamplerOutput`* granularity (every `${skin}/${slot}/${attachment}` record, all 3 maps — D-06), strict-equality, because the failure mode is *silent per-attachment undersize* — coarser sampling (e.g. `globalPeaks` only, or a digest) would let per-animation/setup-pose drift that nets out at the global peak slip through (the exact D-06 rationale). The Nyquist rate here is "every record, every fixture, every commit" — anything coarser under-samples the failure surface.

### Wave 0 Gaps

- [ ] `tests/safe01/canonical-json.ts` + `canonical-json.spec.ts` — the deterministic serializer + its determinism/sentinel self-test (must exist and be proven before it gates `core/`)
- [ ] `tests/safe01/discover-fixtures.ts` — auto-discovery + "samples OK" predicate (D-08)
- [ ] `tests/safe01/safe01-baseline.spec.ts` — strict `toEqual` vs committed per-fixture JSON (SAFE-01)
- [ ] `tests/safe01/safe01-enumeration.spec.ts` — discovered set == manifest (D-08 dropout-is-failure)
- [ ] `tests/safe01/safe01-freeze-guard.spec.ts` — git-ancestry assertion (D-09) + no-regen meta-test
- [ ] `tests/safe01/baselines/_manifest.json` + per-fixture `*.json` — the COMMITTED frozen baseline (COMMIT A; NOT gitignored)
- [ ] `tests/safe01/phase44-fixture-guard.spec.ts` + `phase-gate.ts` — D-13 Phase-44 owner-fixture-absence guard
- [ ] `tests/runtime/alias-resolution.spec.ts` — both specifiers resolve distinctly (RT-01)
- [ ] `tests/runtime/runtime-distinctness.spec.ts` — v42≠v43; Slider/BonePose 4.3-only (RT-03)
- [ ] `tests/runtime/d13-43-load-smoke.spec.ts` — 4.3 `SkeletonJson` direct load past v1.4 reject (D-13)
- [ ] `src/core/runtime/types.ts` + `runtime.ts` — opaque handles + `SpineRuntime` interface (signatures only; RT-03/RT-04)
- [ ] `tests/arch.spec.ts` — append `core/runtime/` Layer-3 anchor + no-co-mingled-imports anchor (RT-04/RT-03 backstop) — *extends existing file*
- [ ] `.github/workflows/ci.yml` — the dual-runtime gate workflow (CI-01) — *new file; release.yml untouched*
- [ ] A `// @ts-expect-error` compile-negative fixture proving a cross-runtime handle mix fails `tsc` (RT-03)
- [ ] `42-OWNER-EXPORT-SPEC.md` — owner handoff doc (D-01..D-05) — *no code; docs gate*

*Framework install: none — `vitest` 4 is already a devDependency; no new test tooling.*

## Security Domain

> `security_enforcement` not explicitly set in config; treating as enabled. Phase 42 is infrastructure (no auth/session/network/crypto-of-secrets surface), so most ASVS categories are N/A. The relevant surface is **supply-chain integrity** of the new dependency + **input parsing** of skeleton JSON by a second runtime.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — (no auth in this desktop app) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Skeleton JSON is parsed by spine-core's `SkeletonJson` (existing trust boundary, unchanged). The new 4.3 runtime parses the same untrusted-file class; the D-13 smoke exercises it with an in-repo fixture only. The existing `loader.ts` version-guard (`checkSpineVersion`/`checkSpine43Schema`) — UNCHANGED in Phase 42 — remains the strict version-parse boundary. |
| V6 Cryptography | yes (integrity, not secrets) | The committed `package-lock.json` `integrity` (sha512 subresource hash) is the supply-chain control: `npm ci` verifies the `4.2.111`/`4.3.0` tarballs against the locked hash. Exact-pin (`4.3.0`, not `^4.3.0`) prevents a patch-shaped API/security drift (the `uniform→scaleY→scaleYMode` precedent). NO hand-rolled crypto. |
| V14 Configuration | yes | `ci.yml` action SHAs pinned (mirror `release.yml`'s pinned-SHA convention — supply-chain hygiene for the new workflow). `release.yml` untouched (isolation of the tag/auto-update path — `feedback_dont_push_release_tags`). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dependency-confusion / tampered tarball on the new alias | Tampering | Committed lockfile + `npm ci` (integrity-verified, never `npm install` in CI); exact-pin both specs. |
| Patch-shaped breaking/security drift in spine-core | Tampering | Exact pin `4.3.0`/`4.2.111` (no `^`/`~`); the `uniform→scaleY→scaleYMode` churn is the documented precedent. |
| Malformed/hostile skeleton version string routing to the wrong runtime | Spoofing | OUT OF PHASE 42 SCOPE (loader dispatch is Phase 44). Phase 42's `loader.ts` is UNCHANGED — the existing strict `major.minor` parse guard stays the boundary. Noted so the planner does not accidentally widen it here. |
| Unpinned CI action SHA (workflow supply-chain) | Tampering | Pin every `uses:` to a full commit SHA in `ci.yml` (the `release.yml` convention — copy it). |

## Sources

### Primary (HIGH confidence)
- `.planning/research/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md` — the 4-researcher synthesis verified against the published 4.3.0 tarballs (read in full this session)
- `.planning/phases/42-.../42-CONTEXT.md` — the locked decision set D-01..D-13 + Claude's Discretion (read in full)
- `.planning/REQUIREMENTS.md` (Phase 42 owns SAFE-01/RT-01/RT-03/RT-04/CI-01), `.planning/STATE.md` (read in full)
- Live verification this session: `npm view @esotericsoftware/spine-core@latest` → `4.3.0`; `versions` → `...4.2.116, 4.3.0` (no beta); `@4.3.0 dependencies` → none; `@4.2.111 dist.integrity` → `sha512-dh4OOJ...` — 2026-05-16
- Live `npm install @esotericsoftware/spine-core@4.3.0 spine-core-42@npm:@esotericsoftware/spine-core@4.2.111` sandbox — reproduced the side-by-side layout + exact lockfile entry (integrity matches registry → `npm ci` deterministic) — 2026-05-16
- Live `git merge-base --is-ancestor` (exit 0), `git log --diff-filter=A --format='%H'` — ancestry primitive confirmed available — 2026-05-16
- Live `node -e` float-determinism probe: `JSON.stringify(NaN)`→`"null"`, `JSON.stringify(Infinity)`→`"null"`, `JSON.stringify(-0)`→`"0"`, shallow-only key sort via `Object.keys(v).sort()` replacer — 2026-05-16
- Live `tsx` loader probe: `loadSkeleton('fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json')` → throws `SpineVersionUnsupportedError` (D-13 baseline) — 2026-05-16
- Source read this session: `src/core/sampler.ts:1-130` (SamplerOutput shape), `src/core/loader.ts:1-260` (version guards), `src/core/bounds.ts:30-42,64-87,153-179,383-397` (computeWorldVertices + instanceof call sites), `src/core/types.ts:40-237` (LoadResult/SampleRecord), `tests/arch.spec.ts` (full — glob+named-anchor pattern), `scripts/repack-refresh-baselines.mjs` (provenance/_meta precedent), `tests/main/repack.loose-parity.spec.ts` (UPDATE_FIXTURES precedent SAFE-01 rejects), `.github/workflows/release.yml` (3-OS matrix to mirror), `.gitignore` (proprietary heavy-rig exclusions), `package.json` (current deps/scripts), `vitest.config.ts`
- Live `git ls-files 'fixtures/**/*.json'` → 13 tracked JSONs; `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` is `spine: 4.3.91-beta` with `root.constraints` — 2026-05-16

### Secondary (MEDIUM confidence)
- `https://github.com/EsotericSoftware/spine-editor/issues/891` — referenced for the D-03 rationale (the ORCL-01 non-IK design sidesteps it); not load-bearing for any Phase 42 code (the owner-export spec is a Phase 42 doc deliverable, fixture acquisition is Phase 44)

### Tertiary (LOW confidence)
- Stable-4.3.0 parse behavior of the `4.3.91-beta` `SPINE_4_3_TEST.json` (A2 / Q3) — not directly tested this session (would require the alias installed in-repo, which is Phase 42 RT-01 work); D-13 asserts integrity-only so the risk is bounded; fallback documented

## Metadata

**Confidence breakdown:**
- Standard stack (alias key, exact package.json/lockfile shape): **HIGH** — reproduced live this session; integrity hash matches registry
- Git-ancestor mechanism (D-09): **HIGH** — `merge-base --is-ancestor` confirmed available; the skip-until-alias + fetch-depth:0 caveats are the only nuances
- Canonical-JSON determinism (D-07): **HIGH** — the three silent-corruption float cases reproduced live; the scheme explicitly defends each
- RT-03 opaque-handle design: **HIGH** — standard `unique symbol` brand pattern; the required-`__rt` shape directly applies the locked `feedback_explicit_identity_over_inference` constraint
- SpineRuntime signature surface: **MEDIUM-HIGH** — derived from ARCHITECTURE.md's call-site-verified table; one refinement flagged (`boneAxisScale(slot)` only, drop `slotBone`)
- Fixture auto-discovery (D-08): **MEDIUM** — mechanism is HIGH; the heavy-rig-vs-gitignore tension is a genuine scope Open Question (Q1) for the planner, not a research gap
- CI architecture (D-10/11/12/13): **HIGH** — mirrors the proven `release.yml` shape; `fetch-depth:0` and "D-13 bypasses the gated loader" are the load-bearing non-obvious points

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 (30 days — stable; the only volatility is a hypothetical spine-core patch beyond 4.3.0, mitigated by exact-pinning). Re-verify `npm view @esotericsoftware/spine-core@latest` if planning slips past this date.
