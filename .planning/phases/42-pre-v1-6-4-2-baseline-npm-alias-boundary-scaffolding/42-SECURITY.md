---
phase: 42
slug: pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-16
---

# Phase 42 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 42: pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding (Plans 42-01 through 42-05, incl. gap-closure 42-05). ASVS L1.

---

## Threat Verification Summary

**Threats Closed:** 24/24
**Open (BLOCKER):** 0
**Unregistered Flags:** 0

Pure test/CI/scaffolding phase. Every PLAN's ASVS analysis independently concludes V2/V3/V4/V5/V7 and V6-of-secrets are N/A — no network, auth, session, access-control, secrets, or new user-input parsing introduced. The only genuine surface is **supply-chain / git-history integrity of the SAFE-01 regression invariant** (V6-integrity + V14-configuration), fully mitigated. No threat rated `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| committed git history → CI/regression gate | D-09 ancestry invariant is only as strong as git-history integrity (ordering bypass / silent regen voids SAFE-01) | commit SHAs, pickaxe output |
| npm registry → local node_modules / lockfile | Alias resolves a second tarball; supply-chain surface (frozen + integrity-pinned at COMMIT B `cc5783f`) | dependency tarballs, sha512 integrity |
| 4.2 runtime objects ↔ 4.3 runtime objects | Structurally-similar identically-named classes from two spine-core copies; wrong-runtime object crossing the boundary = silent corruption | branded opaque handles |
| `core/runtime/` ↔ rest of `core/` | Layer-3 purity invariant (CLAUDE.md Fact #5) must hold for the new module | type signatures only |
| CI workflow supply chain | A new GitHub Actions workflow runs with repo credentials; unpinned actions = supply-chain surface | pinned action SHAs |
| release/auto-update path (release.yml) ↔ new ci.yml | Must stay isolated — a `tags:` trigger on ci.yml would entangle auto-update delivery | workflow triggers |
| in-repo 4.3 JSON → 4.3 spine-core SkeletonJson | A second runtime now parses untrusted-shaped JSON (in-repo fixture only in Phase 42) | skeleton JSON |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-42-01 | Tampering | SAFE-01 baseline regenerated silently | mitigate | `safe01-freeze-guard.spec.ts:135-146` greps sibling spec for `UPDATE_FIXTURES\|process.env\|SHOULD_UPDATE`, asserts absent; no `safe01-refresh-*.mjs`; `_meta.generatedCommit` cross-check :119-132 | closed |
| T-42-02 | Tampering | Baseline captured after/with alias | mitigate | `safe01-freeze-guard.spec.ts:110-112` `git merge-base --is-ancestor 1b5327d cc5783f` (non-vacuous); `ci.yml:113-133` mirrors it | closed |
| T-42-03 | Info-disclosure | Proprietary heavy-rig baseline committed | mitigate | `.gitignore:102` deny-by-default + 12-entry allowlist; `git ls-files` shows only 11 redistributable baselines + `_manifest.json` | closed |
| T-42-04 | Info-disclosure | NaN/Inf/-0 → null/0 false-pass | mitigate | `canonical-json.ts:56-61` emits `"NaN"`/`"Infinity"`/`"-Infinity"`/`"-0"` sentinels; 7 self-tests in `canonical-json.spec.ts` | closed |
| T-42-05 | Spoofing | Malformed skeleton version string | accept | Loader dispatch is Phase 44; Phase-42 loader change was a 1-line specifier rename only; strict major.minor parse guard unchanged | closed |
| T-42-06 | Tampering | Dependency-confusion / tampered tarball | mitigate | `package-lock.json` `spine-core-42` sha512 integrity present; `ci.yml:86` `npm ci`; frozen COMMIT B | closed |
| T-42-07 | Tampering | Caret-range breaking drift | mitigate | `package.json`: `4.3.0`, `npm:@esotericsoftware/spine-core@4.2.111`, player `4.2.111` — exact, no `^`/`~` | closed |
| T-42-08 | Tampering | Naive alias direction (split-brain) | mitigate | 4.3.0 canonical / 4.2.111 aliased; spine-player at 4.2.111; locked in frozen `cc5783f` | closed |
| T-42-09 | Tampering | COMMIT B rebased/amended before A | mitigate | `git merge-base --is-ancestor 1b5327d cc5783f` topological primitive (freeze-guard + `ci.yml:128`) | closed |
| T-42-11 | Tampering | Dual type-universe structural corruption | mitigate | `types.ts:14-29` 8 `unique symbol` brands + required `readonly __rt` (no `__rt?:`); 4 consumed `@ts-expect-error` in `handle-brand-negative.ts` | closed |
| T-42-12 | Elevation of Privilege | File imports BOTH specifiers | mitigate | `arch.spec.ts:313-325` RT-03 backstop globs `src/**`; zero offenders (15/15 arch pass) | closed |
| T-42-13 | Tampering | core/runtime imports DOM/Electron/sharp | mitigate | `arch.spec.ts:297-311` RT-04 anchor; grep on `types.ts`/`runtime.ts` = 0 forbidden imports | closed |
| T-42-14 | Tampering | Unused @ts-expect-error false-green | mitigate | Negative fixture under `tsconfig.node.json`; TS reports unused directives as errors; `typecheck:node` exits 0 with all 4 consumed | closed |
| T-42-15 | Tampering | core/ change perturbs SAFE-01 baseline | mitigate | COMMIT C `git show --stat`: no `loader.ts`/`sampler.ts`/`bounds.ts` change; SAFE-01 byte-equal after C | closed |
| T-42-16 | Tampering | Unpinned `uses:` action SHA | mitigate | `ci.yml`: `actions/checkout@34e1148…`, `actions/setup-node@49933ea…` — 40-hex SHA pinned, both jobs | closed |
| T-42-17 | Tampering | Shallow clone breaks ancestry gate | mitigate | `ci.yml:81` + `:143` `fetch-depth: 0` on `test` and `bundle-smoke` jobs | closed |
| T-42-18 | Tamper/EoP | ci.yml triggers on tags (release entangle) | mitigate | `on:` block = push branches `**` + PR→main + workflow_dispatch; NO `tags:`; `release.yml` untouched | closed |
| T-42-19 | Tampering | electron-builder tree-shakes 4.3 runtime | mitigate | `ci.yml:161-229` bundle-smoke asserts both copies survive + runs BUILT `out/main/sampler-worker.cjs` (not src/) on 4.2+4.3 | closed |
| T-42-20 | Spoof/DoS | Malformed 4.3 skeleton JSON | accept | D-13 smoke = in-repo fixture only; loader version-guard unchanged; Phase 44 owns gate flip; bounded | closed |
| T-42-21 | Tampering | Reviewer-bypassable ordering check | mitigate | Machine-checked twice: `safe01-freeze-guard.spec.ts:110-112` (npm test) + `ci.yml:113-133` (`exit 1`) | closed |
| T-42-22 | Tampering | Consumer-repoint silent behavior change | mitigate | Count-free fresh grep returns ZERO bare `@esotericsoftware/spine-core` in src/+tests/ (sanctioned probes aside); SAFE-01 byte-equal re-verified | closed |
| T-42-23 | Tampering | CI typecheck gate hedged | mitigate | `ci.yml:96` bare `npm run typecheck:node` — no modulo/allowlist/known-error/scratch-exclusion; no `typecheck:web` | closed |
| T-42-24 | Tamper/false-defect | typecheck:web leak mishandled | mitigate | CI runs only `typecheck:node`; Phase-47-owned leak documented in 42-02-SUMMARY; no shim; COMMIT C touches no `src/renderer/**` | closed |
| T-42-05-01 | Tampering | SAFE-01 ordering gate forward-fragility | mitigate | `ci.yml:121` `git log --reverse -S 'spine-core-42' … \| head -1` + `:116-117` presence guard; `safe01-freeze-guard.spec.ts:76-85` `--reverse`+`[0]` + `:45-51` presence guard. Baseline-side `--diff-filter=A \| .pop()` asymmetry is intentionally correct (see CR-01 Assessment) | closed |
| T-42-05-02 | Tampering | Runtime-distinctness version source | mitigate | `runtime-distinctness.spec.ts:54-59` reads `.version` from RESOLVED package.json via `createRequire` (not module export); exact pins + `!==` + `Slider/BonePose/Posed/SlotPose` 4.3-only + `Skeleton` non-identity | closed |
| T-42-05-03 | Info-disclosure | (none — test/CI only) | accept | No PII/secrets/auth; test/CI-only over already-installed packages + local git | closed |
| T-42-05-04 | DoS | Added grep + vitest spec | accept | O(1) grep + sub-second spec; negligible CI cost | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-42-01 | T-42-05 | Malformed/hostile skeleton version string — loader dispatch is Phase 44; Phase 42 does not modify `loader.ts` logic; existing strict `major.minor` parse guard is the unchanged boundary | gsd-security-auditor + user (Verify-all) | 2026-05-16 |
| AR-42-02 | T-42-20 | Malformed 4.3 skeleton JSON — D-13 smoke uses in-repo fixture only; existing loader version-guard unchanged; loader dispatch is Phase 44; bounded | gsd-security-auditor + user (Verify-all) | 2026-05-16 |
| AR-42-03 | T-42-05-03 | Information disclosure — no PII/secrets/auth; test/CI-only scope; nothing to disclose | gsd-security-auditor + user (Verify-all) | 2026-05-16 |
| AR-42-04 | T-42-05-04 | DoS via CI gate cost — O(1) grep + sub-second spec; negligible | gsd-security-auditor + user (Verify-all) | 2026-05-16 |

*Accepted risks do not resurface in future audit runs.*

---

## CR-01 Asymmetry Assessment (per audit constraint)

The 42-REVIEW.md advisory flagged that the CR-01 hardening flipped the *alias* pickaxe to explicit-oldest (`--reverse | head -1` / `[0]`) but left the adjacent *baseline* (`_manifest.json` add) operand as `--diff-filter=A | .pop()`/`tail -1`.

**Security assessment: CLOSED — documented-acceptable asymmetry, not a material gap.**

- `--diff-filter=A` produces an ADD-only event log; `.pop()`/`tail -1` on it selects the oldest add — semantically equivalent to `--reverse | head -1` for that operand. Correct as-is.
- CR-01's defect was specific to the `-S` pickaxe (lists add **and** remove events, newest-first) where `tail -1`/`.pop()` would mis-resolve after a future remove-then-re-add. That operand **is** hardened.
- The `_manifest.json` is only ever added once; a re-add is itself a detectable tamper signal via the `_meta.generatedCommit` cross-check (T-42-01). No forward-fragility gap for `baselineCommit`.
- T-42-05-01's mitigation is intact and fully effective. **This is a code-quality / forward-robustness follow-up (and a genuinely stale, self-contradictory comment per WR-02), not a security threat.** Recommended low-priority Phase-44/45 entry-gate cleanup via `/gsd-code-review-fix 42`.

---

## Phase-47-Owned Known Item (not a Phase-42 gap)

`npm run typecheck:web` is RED (~22 errors in `src/renderer/src/modals/AnimationPlayerModal.tsx`) and 11 `tests/renderer/*.spec.tsx` suites fail with `SyntaxError: '@esotericsoftware/spine-core' does not provide an export named 'MixBlend'`, via `node_modules/@esotericsoftware/spine-player/dist/Player.d.ts`'s bare import resolving to 4.3.0 after frozen COMMIT B. This is the KNOWN, EXPECTED, **ROADMAP Phase-47-owned** consequence of the locked 4.3-canonical alias direction (Phase 47 = "spine-player 4.3.0 Bump + Viewer Regression — drop removed MixBlend/MixDirection", sequenced last, independently revertible). Byte-identical at the pre-42-05 base `bc0c6c6`. **NOT a Phase-42 security gap or regression.**

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-16 | 24 | 24 | 0 | gsd-security-auditor (model: sonnet) — State B, user-selected "Verify all" |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-42-01..04)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-16
