---
phase: 48
slug: core-scale-bake-module-regression-oracle
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-22
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from RESEARCH.md § Validation Architecture (2026-05-22). Exact task IDs in the
> Per-Task Verification Map are bound during planning; the requirement→test mapping is fixed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (project-pinned), `environment: 'node'` (vitest.config.ts:14) |
| **Config file** | `vitest.config.ts` (`setupFiles: ['tests/setup/esm-adapter-resolver.ts']`, `include: ['tests/**/*.spec.ts(x)']`) |
| **Quick run command** | `npx vitest run tests/scale-bake.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds (oracle: parse N matrix fixtures × ≥2 scale factors) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scale-bake.spec.ts` (the oracle)
- **After every plan wave:** Run `npm run test` (full suite — catches `arch.spec.ts` purity + cross-impact)
- **Before `/gsd-verify-work`:** Full suite green on **all 3 OS** in **both** `ci.yml` AND `release.yml` (they diverge — memory `feedback_release_yml_diverges_from_ci_yml`)
- **Max feedback latency:** ~10 seconds (oracle); full suite per existing matrix

---

## Per-Task Verification Map

> Plan-level rows (task IDs bind during planning). `File Exists: ❌ W0` = artifact created in this phase (Wave 0 of the validation sense — does not exist yet).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01-* | 01 | 1 | BAKE-01, BAKE-02, BAKE-04 | — / V5 | `bake(json,s)` returns NEW JSON, source never mutated; degenerate `s` (≤0/NaN/∞) → typed throw (D-09); unknown type discriminator → typed throw (D-10) | oracle (unit) | `npx vitest run tests/scale-bake.spec.ts` | ❌ W0 | ⬜ pending |
| 48-02-* | 02 | 2 | BAKE-03 | — | IK-softness curve `cy` scaled (`mix` unscaled); PATH position/spacing length-mode timeline scaled (percent unscaled); slider remap slope scaled; scaled-default injections (`physics.limit`→5000×s, `referenceScale`→100×s) | oracle | `npx vitest run tests/scale-bake.spec.ts` | ❌ W0 | ⬜ pending |
| 48-03-* | 03 | 3 | BAKE-01, BAKE-02, BAKE-03, BAKE-04 | — | Oracle gates on full fixture matrix (≥1 deform-heavy 4.2 + ≥1 all-types-per-runtime); hard-fails on missing fixture (NO `skipIf`); module green under `arch.spec.ts` Layer-3 purity | oracle + arch grep | `npx vitest run tests/scale-bake.spec.ts tests/arch.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scale-bake.spec.ts` (or chosen name) — the field-identity oracle across the matrix; covers BAKE-01..04 (cycle-safe deep-compare promoted from `baker.mjs:96–121`, `1e-3` rel tolerance, excludes parse-assigned `id`/`hash`/`assetId`)
- [ ] `fixtures/SCALE_BAKE_4_3/` — DEMON `.json`+`.atlas` copied (D-06a copy-to-new-dir; 4.3 all-types + physics.limit present/absent injection)
- [ ] `fixtures/SCALE_BAKE_4_2/` — TEST_01 `.json`+`.atlas` copied (deform-heavy 4.2 all-four-types); + TEST_03 `.json`+`.atlas` if adopting A1 for the 4.2 IK-softness-curve channel
- [ ] `fixtures/SCALE_BAKE_PATH_43/` — authored synthetic 4.3 path-Fixed fixture + minimal `.atlas` (the ONLY genuine residual gap — no real rig uses positionMode/spacingMode fixed or a spacing timeline)
- [ ] (optional) named anchor block in `tests/arch.spec.ts` for `src/core/scale-bake.ts` (the `src/core/**` glob already enforces purity)

*Framework: no install needed — vitest present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fixtures are tracked + reachable on a fresh clone (not just on disk) | BAKE-04 | git tracking is invisible to the in-process oracle; a gitignored fixture passes locally then breaks CI (v1.3.1 landmine) | `git check-ignore <fixture>` prints nothing; `git ls-files --error-unmatch <fixture>` succeeds; `git archive HEAD \| tar -t \| grep SCALE_BAKE` lists it. **Authoritative signal: the watched per-OS `ci.yml` AND `release.yml` runs.** |

*(This row is the only non-automatable check; the standing fixture-existence guard test makes the absence detectable in-process, but tracked-vs-on-disk is git-state, not process-state.)*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (oracle spec + 3 fixture dirs)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < ~10s (oracle)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
