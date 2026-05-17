---
phase: 43
slug: runtime-adapter-facade-verified-4-3-api-mapping
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-17
---

# Phase 43 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| adapter facade ↔ math layer | opaque branded handles cross here; a cross-runtime mix must be caught at compile time (unique symbol brand) and runtime (handleRuntime backstop) | OpaqueAttachment / OpaqueSkeleton / OpaqueSlot handles |
| runtime-42 ↔ spine-core-42 | sole sanctioned 4.2 import carve-out; no other core file may import spine-core-42 after Phase 43 (RT-02) | parsed skeleton data, animation state |
| runtime-43 ↔ @esotericsoftware/spine-core (4.3) | sole sanctioned 4.3 import carve-out; no other core file may import the 4.3 package after Phase 43 (RT-02) | parsed skeleton data, animation state, 4.3 Pose model |
| 4.3 three-pose model ↔ world reads | only appliedPose is constraint-correct; pose/constrainedPose are pre-constraint and must never reach world-scale reads | bone world-scale floats crossing into bounds math |
| client JSON → loader | checkSpineVersion / checkSpine43Schema input guards (unchanged this phase) run before any adapter call | untrusted Spine JSON |
| loader/sampler/bounds ↔ runtime adapter | load.runtime is the single seam; no spine-core type names in the three consumers | SpineRuntime interface method calls |
| rewired path ↔ FROZEN SAFE-01 corpus | SAFE-02 re-runs the frozen harness; baselines must not be regenerated (D-09) | canonicalized SamplerOutput byte sequences |
| 4.3 own-baseline ↔ FROZEN SAFE-01 corpus | 4.3 baseline is a SEPARATE store (tests/runtime43/baselines/); never golden-shared with the 4.2 SAFE-01 goldens (D-01) | 4.3 SamplerOutput JSON |
| committed 4.3 triplet ↔ Phase-44-reserved 4.2 sibling | only the 4.3 triplet is committed; the 4.2 sibling stays untracked (D-05/Q2) | fixture files in fixtures/SIMPLE_PROJECT_43/ |
| build pipeline ↔ emitted out/main/* artifacts | electron-vite/rollup decides which modules are emitted as resolvable files; an orphaned artifact is a build-integrity failure | runtime adapter CJS chunks |
| worker-shared chunk ↔ runtime adapter | pickRuntime prod-arm require('../runtime-4x.cjs') literal crosses here; wrong adapter resolves as silent undersize | CJS module resolution at worker startup |
| vitest globalThis resolver ↔ prod ambient require | test-only injected resolver (setupFiles) must not leak into the production worker bundle | ESM adapter resolver binding |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-43-01 | Tampering | Cross-runtime object corruption (4.2 obj into 4.3 API) | mitigate | SAFE-03 asserts handleRuntime(a)==='4.3' on every skin-entry attachment + 4.2-tagged-handle backstop assertion; unique symbol brand makes cross-mix a compile error. EVIDENCE: tests/runtime43/safe03-cross-runtime.spec.ts:3 imports brandHandle/handleRuntime; :6 asserts handleRuntime(a)==='4.3'; :22-31 proves cross-feed is detectable. runtime-43.ts: brandHandle(.,'4.3') on all returns (:90,:108,:233,:240,:246,:253,:351,:366,:393). types.ts:43 brandHandle; :61 handleRuntime. | closed |
| T-43-02 | Information disclosure | Silent undersize from pre-constraint pose read | mitigate | D-03 seam (runtime43-d03.spec.ts) asserts post-constraint SQUARE canary. EVIDENCE: tests/runtime43/runtime43-d03.spec.ts:30 describe 'D-03 structural defense'; :31 it asserts SQUARE peak == 4.2-sibling within 1e-4. 43-VERIFICATION.md SC#4 confirms D-03 PASS. | closed |
| T-43-03 | Tampering | Accidental regeneration/mutation of frozen SAFE-01 baseline | accept | See Accepted Risks Log AR-01. | closed |
| T-43-04 | Tampering | Relocated call silently altering arg list/buffer/order causing 4.2 drift | mitigate | Verbatim-relocation discipline; SAFE-02 strict toEqual byte-gate. EVIDENCE: runtime-42.ts header (:1-22) documents byte-faithful relocation discipline. SAFE-02 32/32 GREEN confirmed in 43-VERIFICATION.md SC#2. RT-02 anchor tests/arch.spec.ts:362 scans sampler.ts/bounds.ts/loader.ts for spine-core imports — EMPTY (verified by grep at audit time). | closed |
| T-43-05 | Tampering | Phase-33 rotated-region offset[] math paraphrased not relocated verbatim | mitigate | SWAP-form offset[0..7] write relocated char-for-char in runtime-42.applyRotatedRegionFix; frozen spine_rotated SAFE-01 baseline byte-gates it. EVIDENCE: runtime-42.ts:19-21 documents SWAP-form verbatim relocation of offset[0..7] from loader.ts:552-613. SAFE-02 32/32 includes the spine_rotated fixture. 43-VERIFICATION.md SC#5 VERIFIED. | closed |
| T-43-06 | Denial of service | Static import of runtime-43 hoisting 4.3 spine-core graph into every 4.2 worker | mitigate | pickRuntime uses lazy require() per RESEARCH Pattern 3; no static import of either runtime-4x file in runtime.ts. EVIDENCE: runtime.ts scanned — zero lines matching `import.*runtime-4[23]` (only comments). Lazy require arm at runtime.ts:204: `tag === '4.2' ? require('../runtime-42.cjs') : require('../runtime-43.cjs')`. tests/arch.spec.ts RT-02 anchor enforces the 3-consumer boundary. | closed |
| T-43-07 | Information disclosure | Reading bone.pose/getPose() instead of bone.appliedPose causing silent pre-IK/pre-TransformConstraint undersize | mitigate | D-03 structural defense: boneAxisScale is the only world-scale read and reaches appliedPose explicitly; no OpaqueBone exposed; dev-mode assertion guards appliedPose usability. EVIDENCE: runtime-43.ts:453-495 boneAxisScale: reads only `s.bone.appliedPose` (:457); dev assertion at :484-490 throws if appliedPose is null/undefined or lacks getWorldScaleX/Y. Zero bare `bone.pose` reads outside comments confirmed by grep at audit time. runtime43-d03.spec.ts SQUARE canary PASS. | closed |
| T-43-08 | Tampering | Direct .region/.uvs access surviving into 4.3 path causing undefined/mesh peak collapse | mitigate | All region/uv access routes through attachmentRegionMeta/attachmentUVs/sequenceRegions via sequence.regions[idx]. EVIDENCE: grep for `.region` member access in runtime-43.ts excluding comments returned zero hits at audit time. runtime-43.ts header (:19-23) documents PORT-02 zero-direct-.region contract. 43-VERIFICATION.md SC#5 VERIFIED. | closed |
| T-43-09 | Tampering | Cross-runtime object corruption (4.2 object reaching 4.3 API) | mitigate | Opaque branded handles (unique symbol brand) + brandHandle(.,'4.3') on every return + handleRuntime backstop; SAFE-03 regression-catches cross-feed. EVIDENCE: same as T-43-01 — types.ts:14-27 unique symbol brands; runtime-43.ts brandHandle(.,'4.3') throughout; safe03-cross-runtime.spec.ts 2/2 PASS confirmed by 43-VERIFICATION.md SC#3. | closed |
| T-43-10 | Tampering | Non-byte-faithful leaf-call substitution drifting 4.2 output | mitigate | SAFE-02 strict toEqual on full canonicalized SamplerOutput across all 3 maps; LOCKED-tick + Pass-1.5 invariants preserved verbatim. EVIDENCE: SAFE-02 32/32 strict toEqual GREEN (43-VERIFICATION.md SC#2). RT-02 arch anchor tests/arch.spec.ts:362 GREEN. 43-03-SUMMARY confirms SAFE-02 was GREEN on first run after rewire — no byte-faithfulness fix needed. | closed |
| T-43-11 | Tampering | Accidental regeneration of frozen SAFE-01 baseline to make SAFE-02 pass | accept | See Accepted Risks Log AR-02. | closed |
| T-43-12 | Tampering | SIMPLE_PROJECT_43 4.2-sibling committed here tripping SAFE-01 enumeration | mitigate | Plan 03 does not git-add fixtures/SIMPLE_PROJECT_43/; enumeration spec is the acceptance gate. EVIDENCE: git ls-files fixtures/SIMPLE_PROJECT_43/ at audit time returns exactly skeleton2.json, skeleton2.atlas, skeleton2.png — no _42 sibling. git status at conversation start shows skeleton2_42.* as untracked (??). safe01-enumeration.spec.ts:25-49 scans git-tracked fixtures and compares to manifest. 43-VERIFICATION.md confirms fixture count correct. | closed |
| T-43-13 | Spoofing | 4.2 JSON silently loaded by 4.3 runtime (zero constraints, no error) | accept | See Accepted Risks Log AR-03. | closed |
| T-43-14 | Information disclosure | A1 rotated-region no-op trusted without empirical proof causing undersized rotate:90 textures | mitigate | Task 1 Step B automated test diffs 4.3 rotated-region world geometry vs same-hash 4.2-sibling within 1e-4; A1 FALSIFIED; Approach B applied and re-validated. EVIDENCE: runtime43-baseline.spec.ts:95 'A1: 4.3 rotated-region world geometry matches the 4.2-sibling known-good (PORT-03 Approach-A empirical proof)'; :43 A1_TOL = 1e-4; :134 aabbClose assertion. 43-VERIFICATION.md SC#5: A1 proof PASS within 1e-4. 43-05-SUMMARY confirms A1 FALSIFIED and Approach B re-validated. | closed |
| T-43-05-15 | Tampering | 4.2 sibling accidentally committed — SAFE-01 enumeration trips or Phase-44 oracle contaminated | mitigate | Git steps name three 4.3 files explicitly (never git add dir); mandatory git ls-files sanity check; safe01-enumeration.spec.ts green gate. EVIDENCE: git ls-files at audit time — exactly 3 files (no _42). safe01-enumeration.spec.ts:25-49 enforces git-tracked manifest equality. skeleton2_42.* confirmed untracked in git status. | closed |
| T-43-05-16 | Information disclosure | Constraint-heavy proprietary-rig plumbing drift undetected because CI only runs redistributable subset | mitigate | D-04 documented local heavy-rig SAFE-02 byte-equal pass is a HARD close gate recorded in 43-VERIFICATION.md; CI-subset-green explicitly insufficient. EVIDENCE: 43-VERIFICATION.md D-04 section: 20/20 heavy/proprietary + 12/12 redistributable = 32/32 byte-equal vs independent frozen c5ef358 reference, 0 drift, 2026-05-17. 43-05-SUMMARY confirms the anti-tautology capture methodology. | closed |
| T-43-05-17 | Tampering | 4.3 own-baseline confused with/written into frozen SAFE-01 store | accept | See Accepted Risks Log AR-04. | closed |
| T-43-06-15 | Tampering | pickRuntime prod arm resolving wrong runtime artifact (cross-runtime mis-resolution) | mitigate | Corrected literal keeps exact `tag === '4.2' ? '../runtime-42.cjs' : '../runtime-43.cjs'` ternary byte-unchanged; SAFE-02 strict byte-equal catches drift (32/32 GREEN); spawn-smoke samples SIMPLE_PROJECT through built worker and asserts complete. EVIDENCE: runtime.ts:204 `tag === '4.2' ? require('../runtime-42.cjs') : require('../runtime-43.cjs')`. SAFE-02 32/32 (43-VERIFICATION.md SC#2). tests/main/sampler-worker.spec.ts 7/7 PASS (43-VERIFICATION.md artifact table). | closed |
| T-43-06-16 | Denial of Service / Integrity | Missing/orphaned worker adapter artifact failing silently (self-eval-blind skip green-washing broken prod path) | mitigate | Hardened spawn-smoke HARD-FAILS (never it.skip) on stale/absent bundle; asserts Cannot find module .*runtime-4 negative; loud-throw arm 3 of pickRuntime byte-preserved; find out -name "*runtime-4*" non-empty acceptance gate. EVIDENCE: tests/main/sampler-worker.spec.ts:138-142 documents hard-fail discipline; :217-225 explicit /Cannot find module .*runtime-4/ negative assertion. runtime.ts:208-213 loud-throw arm 3. out/main/runtime-42.cjs and out/main/runtime-43.cjs present on disk at audit time. | closed |
| T-43-06-17 | Tampering | Build-config change co-bundling both spine-core graphs into worker (defeating lazy single-copy, ARCHITECTURE §4 violation) | accept (bounded exception) | See Accepted Risks Log AR-05 — §4 Bounded-Exception. The substantive §4 intent (runtime-graph single-copy) is verified: out/main/runtime-42.cjs has 0 require("@esotericsoftware/spine-core") literals (confirmed by grep at audit time: count=0). out/main/runtime-43.cjs has 1 require("spine-core-42") (the accepted bounded exception) and 1 require("@esotericsoftware/spine-core") (its primary dep). 4.2 path is strictly single-copy. | closed |
| T-43-06-18 | Tampering | Regenerating frozen SAFE-01 baseline or relaxing SAFE-02 to make it pass | accept | See Accepted Risks Log AR-06. | closed |
| T-43-06-19 | Spoofing | Vitest test-only globalThis resolver leaking into production worker bundle | accept | See Accepted Risks Log AR-07. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-43-03 | Plan 43-01 creates only new test files and one additive interface line. The D-09 freeze guard (safe01-freeze-guard.spec.ts) enforces the invariant via git-ancestor check. No regeneration path is introduced by this plan. The `git status --porcelain tests/safe01/` empty acceptance criterion was verified at every plan closure. | maintainer (Leo) | 2026-05-17 |
| AR-02 | T-43-11 | The D-09 freeze guard (safe01-freeze-guard.spec.ts:37-129) fails loudly if the baseline commit is not a git-ancestor of the alias commit. The only sanctioned fix is correcting the rewire, never the baseline. The 32/32 SAFE-02 byte-equal result was achieved without any baseline regeneration — `git status --porcelain tests/safe01/baselines/` is EMPTY as confirmed across all plan closures. | maintainer (Leo) | 2026-05-17 |
| AR-03 | T-43-13 | N/A this phase — loader hard-picks 4.2 UNCONDITIONALLY (D-02); the existing strict version-parse guard rejects malformed input before any adapter call. Version routing/dispatch is Phase 44 (DISP-01/03). The risk is tracked and deferred to Phase 44 as an explicit design decision, not an oversight. | maintainer (Leo) | 2026-05-17 |
| AR-04 | T-43-05-17 | The 4.3 own-baseline is written to the physically separate tests/runtime43/baselines/ store. It is confirmed absent from tests/safe01/baselines/ (directory listing at audit time shows only Rotated__skeleton2.json and SIMPLE_PROJECT__skeleton2.json). The SAFE-01 manifest is unchanged. `git status --porcelain tests/safe01/` is EMPTY across all plan closures (D-09 satisfied). | maintainer (Leo) | 2026-05-17 |
| AR-05 | T-43-06-17 | ARCHITECTURE §4 BOUNDED-EXCEPTION — Maintainer-adjudicated Option ii (2026-05-17). FINDING: out/main/runtime-43.cjs:8 emits exactly one bare side-effect require("spine-core-42"), arising from the PRE-EXISTING 43-04 edge src/core/runtime/runtime-43.ts:56 → src/core/synthetic-atlas.ts:57-63 (SilentSkipAttachmentLoader extends the 4.2 AtlasAttachmentLoader; committed f2cf770, LOCKED, untouched by 43-06). DISPOSITION: §4 "lazy single-copy" is scoped to the spine-core RUNTIME/ANIMATION graph. That graph IS cleanly split: runtime-42.cjs has 0 require("@esotericsoftware/spine-core") (verified by grep at audit time); runtime-43.cjs externalizes @esotericsoftware/spine-core (its primary dep, 1 require). Sampling a 4.2 skeleton loads ONLY spine-core-42 — the heavy 4.3 graph is never co-resident on the 4.2 path. The single parse-time AtlasAttachmentLoader edge on the 4.3 path is an accepted, documented, bounded pre-existing exception, not a §4 regression. CONSEQUENCE: when sampling a 4.3 skeleton, spine-core-42 is also resident (one direction only; the 4.2 path stays strictly single-copy). FOLLOW-UP: a future phase may decouple SilentSkipAttachmentLoader/synthetic-atlas from spine-core-42 for the 4.3 path. Deferred; NON-BLOCKING. Full adjudication recorded verbatim in 43-06-SUMMARY.md lines 218-239. | maintainer (Leo) | 2026-05-17 |
| AR-06 | T-43-06-18 | The 43-06 fix is build-config + a 2-string source literal edit (runtime.ts:204). It touches no baseline and no tolerance. The D-09 freeze-guard + `git status --porcelain tests/safe01/baselines/` EMPTY acceptance gate fail loudly on any baseline mutation. SAFE-02 runs under vitest (arm 1) and is structurally byte-unaffected — re-asserted GREEN (32/32), not regenerated. | maintainer (Leo) | 2026-05-17 |
| AR-07 | T-43-06-19 | N/A by construction and unchanged by the 43-06 fix: the worker bundle never imports tests/setup/esm-adapter-resolver.ts (it is a setupFiles-only test-infrastructure file, registered only via vitest.config.ts:23). The globalThis slot __GSD_ESM_ADAPTER_RESOLVER__ is therefore undefined in the production worker, so pickRuntime falls to arm (2) — the lazy-require branch — byte-identically to Plan 02. The esm-adapter-resolver.ts file imports only from src/ paths (runtime-42.js, runtime-43.js) and is not reachable from any src/main/ or src/core/ entry point. | maintainer (Leo) | 2026-05-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Threat Flags

The following SUMMARY.md `## Threat Flags` sections were reviewed:

- 43-01-SUMMARY.md: "None. The new files are test helpers reading trusted in-repo fixture files via node:fs. No new network, auth, or IPC surface is introduced."
- 43-02-SUMMARY.md: "None. This plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries."
- 43-03-SUMMARY.md: No explicit Threat Flags section. The addendum documents the vi.resetModules() resolver-robustness gap, which was auto-fixed as a Rule-1 bug (not a new threat surface — it strengthened the existing Option A safety invariant).
- 43-04-SUMMARY.md: "No new threat surface introduced. The opaque-handle boundary and D-03 structural defense address T-43-07 and T-43-08 per the plan's threat register."
- 43-05-SUMMARY.md: No explicit Threat Flags section. The three Rule-1 auto-fixed deviations (A1 falsification/Approach B, sequenceRegions length guard, D-03 dev-assertion rewrite) are implementation corrections, not new attack surface.
- 43-06-SUMMARY.md: The blocking finding (runtime-43.cjs bare require("spine-core-42")) maps to T-43-06-17 and is resolved via the maintainer-adjudicated §4 bounded-exception (AR-05).

**Unregistered flags:** None. All surfaced findings map to existing threat IDs.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-17 | 22 | 22 | 0 | gsd-security-auditor (Claude Sonnet 4.6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (7 entries: AR-01 through AR-07)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-17
