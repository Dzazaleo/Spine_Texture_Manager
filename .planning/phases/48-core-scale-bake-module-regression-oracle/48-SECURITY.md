---
phase: 48
slug: core-scale-bake-module-regression-oracle
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-24
---

# Phase 48 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Subsystem: a pure in-memory JSON→JSON similarity-bake transform (`src/core/scale-bake.ts`) plus its committed regression-oracle fixtures. **No network, auth, session, or crypto surface.** Only ASVS V5 (Input Validation / correctness / integrity) and incidental IP/repo-hygiene controls apply. All threats LOW severity.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| in-house rig JSON → bake() | The bake reads in-house skeleton JSON (test fixtures + Phase-49 project files). Not network/untrusted input, but a malformed or unknown construct could silently corrupt geometry. | Spine skeleton JSON (geometry only; no PII/secrets) |
| author disk → git committed tree | Fixtures must cross from on-disk to the committed tree; a silent no-op (ignored path) leaves CI without them. | `.json` + `.atlas` text files |
| committed .atlas/.json → public repo | These files become public. Only PNGs carry confidential art (D-04); `.json` (geometry) + `.atlas` (region names/dims/UV rects + page filename, no pixels) are non-sensitive. | `.json` geometry, `.atlas` text — pixel-data-free |
| in-repo fixture JSON → oracle → CI | The oracle reads in-repo fixtures and is the regression gate; a green-washed skip would let geometry corruption ship. | fixture JSON/atlas → live SkeletonJson.scale reference |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-48-01 | Tampering | bake() on malformed scale | mitigate | D-09 guard: `if (!Number.isFinite(s) \|\| s <= 0) throw new ScaleBakeError` — first statement in `bake()` (`src/core/scale-bake.ts:90`), before any mutation. Rejects s≤0/NaN/±Infinity. | closed |
| T-48-02 | Tampering | bake() on unknown construct | mitigate | D-10 assert-known: unrecognized `constraint.type` (`:100`) / `attachment.type` (`:144`) throws `ScaleBakeError` instead of silently mis-scaling. Timeline names intentionally allow-listed (no throw). | closed |
| T-48-03 | Information Disclosure | source JSON mutation | accept (mitigated by design) | L-05: `const j = clone(json)` (`:91`, deep `JSON.parse(JSON.stringify)`) — bake returns NEW JSON, source read-only. Skeleton JSON is geometry only; no PII/secret surface. | closed |
| T-48-04 | Information Disclosure | committing confidential pixel art | mitigate | D-04 PNG-exclusion: only `.json`+`.atlas` copied into the new fixture dirs. `find fixtures/SCALE_BAKE_* -name "*.png"` → empty; `git archive` lists 8 files, zero `.png`. `.atlas` is pixel-data-free text. | closed |
| T-48-05 | Repudiation | fixture silently uncommitted → CI false-green | mitigate | D-06a: all 8 fixtures proven git-tracked (`git ls-files`); the oracle hard-fails (no `skipIf`) if a fixture is absent. Defuses the v1.3.1 silent-no-commit landmine. | closed |
| T-48-06 | Denial of Service | committing 174MB of PNGs (repo bloat) | mitigate | copy-into-new-dir (no PNGs present to stage) instead of `git add fixtures/DEMON/`. Confirmed zero `.png` staged or present in any `SCALE_BAKE_*` dir. | closed |
| T-48-07 | Tampering | mis-scaling a constraint-timeline curve (over/under) | mitigate | Channel-specific IK softness cy at `k.curve[5]`/`k.curve[7]` only (`:193-196`); mix-channel cy (index 1/3) untouched (grep → 0). Two-sided field-identity oracle (8 rigs × 3 scales incl. 0.26 + 2.0) catches both directions by construction. | closed |
| T-48-08 | Tampering | wrong mode-gate scales a percent/proportional channel | mitigate | Source-faithful, case-normalized gates: `pm === 'fixed'` (position) + `sm === 'length' \|\| sm === 'fixed'` (spacing) at `:121-124` (setup) / `:213-214` (timelines). Old paraphrased gates absent (grep → 0). Oracle two-sided equality confirms. | closed |
| T-48-09 | Repudiation | oracle silently skips a missing fixture (false-green) | mitigate | D-06a #3: standing fixture-existence guard (`tests/scale-bake.spec.ts:169-176`) `existsSync`-asserts each `.json`/`.atlas`, hard-fails `fixture not found`; NO `skipIf` (grep → 0). | closed |
| T-48-10 | Information Disclosure | oracle reads PNG bytes | accept (mitigated by design) | D-04: oracle builds atlas from `.atlas` TEXT via single-arg `new S.TextureAtlas(atlasText)` (`tests/scale-bake.spec.ts:113`), never probes a PNG. Math phase reads zero PNG bytes (CLAUDE.md #4). No `.png` exists in fixture dirs. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-48-01 | T-48-03 | Skeleton JSON is geometry-only (no PII, no secrets). Clone-first behavior IS present in code (`scale-bake.ts:91`), so confidentiality risk is eliminated even before considering the absence of a sensitive-data surface. | Leo (owner) | 2026-05-24 |
| AR-48-02 | T-48-10 | The math/oracle phase reads zero pixel bytes by architectural design (CLAUDE.md Fact #4). Atlas-from-text is the standard CI-passing pattern. No PNGs exist in the `SCALE_BAKE_*` dirs, so the PNG-probe path cannot execute. | Leo (owner) | 2026-05-24 |

*Accepted risks do not resurface in future audit runs. Both are "accept (mitigated by design)" — the by-design behavior was verified present in code, not merely assumed.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-24 | 10 | 10 | 0 | gsd-security-auditor (Claude Sonnet 4.6) |

### Auditor verification commands (2026-05-24)

- `grep -n "Number.isFinite(s) || s <= 0" src/core/scale-bake.ts` → line 90 (T-48-01)
- `grep -n "unknown attachment type|unknown constraint type" src/core/scale-bake.ts` → lines 100, 144 (T-48-02)
- `grep -n "const j = clone(json)" src/core/scale-bake.ts` → line 91 (T-48-03)
- `find fixtures/SCALE_BAKE_* -name "*.png"` → empty (T-48-04, T-48-06)
- `git ls-files fixtures/SCALE_BAKE_4_3 fixtures/SCALE_BAKE_4_2 fixtures/SCALE_BAKE_PATH_43` → 8 files (T-48-05)
- `git archive HEAD | tar -t | grep SCALE_BAKE` → 11 entries (3 dirs + 8 files, zero .png) (T-48-05, T-48-06)
- `grep "curve\[5\]|curve\[7\]"` → lines 194-195; `grep "curve\[1\] \*=|curve\[3\] \*="` → empty (T-48-07)
- `grep "pm === 'fixed'|sm === 'length' || sm === 'fixed'"` → lines 123-124, 214 (T-48-08)
- `grep "fixture not found|skipIf" tests/scale-bake.spec.ts` → fixture-not-found present, skipIf zero (T-48-09)
- `grep "new S.TextureAtlas(atlasText)" tests/scale-bake.spec.ts` → line 113 single-arg ctor (T-48-10)

### Note (out of scope, no security surface)

The two worktree-only test failures noted in the SUMMARYs (`sampler-skin-defined-unbound-attachment.spec.ts`, `sampler-worker-girl.spec.ts`) are caused by gitignored local-only fixtures absent from worktree checkouts. Pre-existing, not regressions, no security surface.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-24
