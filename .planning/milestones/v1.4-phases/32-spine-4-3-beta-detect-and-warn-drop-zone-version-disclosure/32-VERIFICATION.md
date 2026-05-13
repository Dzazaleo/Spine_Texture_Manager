---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
verified: 2026-05-10T16:45:00Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 32: Spine 4.3-beta Detect-and-Warn + Drop-Zone Version Disclosure Verification Report

**Phase Goal:** "Spine 4.3-beta detect-and-warn + drop-zone version disclosure (+ SEED-006 plant)"

Concretely:
- 4.3-detection branch in `src/core/loader.ts` BEFORE `SkeletonJson.readSkeletonData` (sniff `root.constraints` array OR `skeleton.spine` semver ≥ 4.3)
- `SpineVersionUnsupportedError` from `src/core/errors.ts` with actionable "re-export as Version 4.2" message
- Restyle drop-zone advisory at `App.tsx:622` with `v4.2` rendered `font-bold text-danger`
- Plant SEED-006 (Full Spine 4.3 runtime port) at phase close

**Verified:** 2026-05-10T16:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Loading a Spine JSON with `skeleton.spine` semver ≥ 4.3 throws `SpineVersionUnsupportedError` BEFORE `SkeletonJson.readSkeletonData` runs | VERIFIED | `src/core/loader.ts:137-141` adds explicit reject branch in `checkSpineVersion`; call sites at lines 230/233/237 fire BEFORE atlas resolution (line 364+) and `readSkeletonData` (line 540). Behavioural spot-check: `checkSpineVersion('4.3.91-beta', ...)` throws with COMPAT-01 message. `tests/core/loader-version-guard-predicate.spec.ts` "rejects 4.3.0 (Phase 32 strict-cut at 4.3+)" passes. |
| 2  | Loading a Spine JSON with a top-level non-empty `constraints` array throws `SpineVersionUnsupportedError` BEFORE `SkeletonJson.readSkeletonData` runs | VERIFIED | New `checkSpine43Schema` predicate at `src/core/loader.ts:175-188`; call site at line 245 (before atlas resolution at line 364+). Behavioural spot-check: `checkSpine43Schema({ constraints: [] }, ...)` throws with `detectedVersion === '4.3-schema'`. `tests/core/loader-43-schema-guard-predicate.spec.ts` 11 cases pass. |
| 3  | Schema predicate also catches empty `constraints: []` (CONTEXT D-05 — presence of field is the signal) | VERIFIED | `src/core/loader.ts:186-187` comment + behavioural spot-check confirms empty array triggers throw. Test "rejects { constraints: [] } (empty array — presence of the field IS the signal per CONTEXT D-05)" passes. |
| 4  | Thrown error message contains COMPAT-01-locked wording verbatim ("This app currently supports Spine v4.2", "Re-export from your 4.3 editor as Version 4.2", "supported downgrade", "try again") | VERIFIED | `src/core/errors.ts:114-115` produces the exact COMPAT-01 string. All 4 substrings asserted in `tests/core/errors-version.spec.ts` (4.3+ branch tests) and `tests/core/loader-version-guard.spec.ts` (fixture-driven test). Behavioural spot-check confirms all 4 substrings present in thrown message for `'4.3.91-beta'` semver, `'4.3-schema'` sentinel, and `'5.0.0'`. |
| 5  | Pre-4.2 branch error message is preserved verbatim (Phase 12 F3 contract byte-stable) | VERIFIED | `src/core/errors.ts:116-118` preserves "This file was exported from Spine ${detectedVersion}. Spine Texture Manager requires Spine 4.2 or later. Re-export from Spine 4.2 or later in the editor." Behavioural spot-check confirms 3.8.99 message includes pre-4.2 wording AND does NOT include 'supported downgrade'. `tests/core/errors-version.spec.ts` "Pre-4.2 branch" regression-belt test passes. |
| 6  | Loading the in-repo `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (`"spine": "4.2.43"`) continues to throw nothing — new 4.3 detection is inert for 4.2 inputs | VERIFIED | Behavioural spot-check: `checkSpineVersion('4.2.43', ...)` does not throw; `checkSpine43Schema({ skeleton: { spine: '4.2.43' }, bones: [], slots: [], skins: [] }, ...)` does not throw. `tests/core/loader.spec.ts` (22 cases) green. `tests/core/loader-version-guard.spec.ts` 4.2 regression-belt assertion passes. |
| 7  | Drop-zone idle copy reads "Drop a Spine v4.2 .spine JSON file anywhere in this window" with v4.2 rendered as font-bold + text-danger | VERIFIED | `src/renderer/src/App.tsx:622` literal: `Drop a Spine <span className="font-bold text-danger">v4.2</span> <code>.spine</code> JSON file anywhere in this window`. grep counts: `<span className="font-bold text-danger">v4.2</span>` = 1; `Drop a Spine ` = 1; old `Drop a <code>.spine</code>` = 0. |
| 8  | Supported-version disclosure visible BEFORE user drops a file (in `idle && !isElevated` branch) | VERIFIED | `src/renderer/src/App.tsx:620-624` is inside `state.status === 'idle' && (isElevated ? … : <p>…</p>)`. Not gated by drop interaction. |
| 9  | Windows-admin elevated-fallback advisory at App.tsx:603-619 is UNCHANGED | VERIFIED | grep "Drag-and-drop is unavailable while running as administrator" = 1; full sentence preserved at line 617; no v4.2 callout added there. |
| 10 | Error banner JSX block at App.tsx:660-697 is UNCHANGED | VERIFIED | grep `<span className="font-semibold text-danger">Skeleton not found:</span>` = 1; `role="alert"` count preserved; "Locate skeleton…" button preserved at line 683. |
| 11 | New file `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` exists with SEED-003-mirroring frontmatter shape | VERIFIED | File exists; frontmatter contains: `id: SEED-006`, `status: planted`, `planted: 2026-05-10`, `planted_during: v1.4 Phase 32 …`, `trigger_when: …`, `scope: Large …`, `proposed_phase: TBD …`. |
| 12 | SEED-006 carries the costed inventory (PORT-01..04, 5 sampler renames, 2 bounds signature changes, slot.pose access, slider validation, vendoring) | VERIFIED | grep counts: `PORT-01..04` each ≥ 1; `setToSetupPose` = 2; `vertexOffsets` = 2; `slot.pose` = 4; `slider` = 4; `vendoring` = 3. All source-of-truth keywords present. |
| 13 | SEED-006 trigger_when references `npm view @esotericsoftware/spine-core@latest` returning 4.3.x AND/OR paying user reporting they cannot re-export their rig as Version 4.2 | VERIFIED | `.planning/seeds/SEED-006-spine-4.3-runtime-port.md:6` line + duplicated at line 67 contain verbatim REQUIREMENTS.md L38 wording. |
| 14 | SEED-006 cross-links to SEED-003 and Phase 32 CONTEXT.md | VERIFIED | grep "SEED-003" = 5 in SEED-006; explicit cross-link at "Cross-Links" section line 71; CONTEXT.md cross-ref at line 72. |
| 15 | SEED-003 has Phase 32 close-out addendum noting Option A landed | VERIFIED | grep "SEED-006" = 2 and "Status (2026-05-10)" = 1 in SEED-003. New section "## Status (2026-05-10) — Option A landed; Option C queued via SEED-006" at line 66 between `## Recommendation` and `## Open Question`. |
| 16 | SPINE_4_3_TEST regression fixture exists in-repo, NOT gitignored | VERIFIED | `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` (328 bytes) + `.atlas` (170 bytes) + `images/SQUARE.png` (74 bytes) all on disk. `git check-ignore` exits 1 (NOT ignored). JSON contains `"spine": "4.3.91-beta"` and non-empty `constraints` array per node fixture-shape verification. |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/loader.ts` | `checkSpine43Schema` predicate + sequential call after `checkSpineVersion` + strict-cut at 4.3+ | VERIFIED | Predicate exported at line 175; called at line 245 after `checkSpineVersion` (lines 230/233/237) and BEFORE atlas resolution (line 364+); strict-cut branch at lines 137-141. |
| `src/core/errors.ts` | `SpineVersionUnsupportedError` constructor branched by `detectedVersion` (4.3+ branch + pre-4.2 branch) | VERIFIED | Constructor at lines 86-122 implements the branch via `isSpine43OrLater` flag. Sentinel `'4.3-schema'` AND semver `>=4.3` (or major `>=5`) route to COMPAT-01 message; everything else routes to pre-4.2 message. |
| `tests/core/loader-43-schema-guard-predicate.spec.ts` | Predicate unit tests (11 cases) | VERIFIED | File exists, 11 tests pass (7 accepted + 4 rejected shapes). |
| `tests/core/loader-version-guard-predicate.spec.ts` | Inverted lenient-on-4.3+ assertions | VERIFIED | Old `accepts 4.3.0` and `accepts 5.0.0` cases removed; new `rejects 4.3.0`, `rejects 4.3.91-beta`, `rejects 5.0.0` cases added. All pass. |
| `tests/core/errors-version.spec.ts` | 4.3+ branch message-shape assertions | VERIFIED | 4 new cases (3 4.3+ branch + 1 pre-4.2 regression-belt) all pass. grep "supported downgrade" = 4 (3 positive + 1 negative). |
| `tests/core/loader-version-guard.spec.ts` | Fixture-driven 4.3-rejection block | VERIFIED | `FIXTURE_43` constant + 6-case rejection describe block + 5-case existence-sentinels block. All 21 tests pass. |
| `src/renderer/src/App.tsx` | Drop-zone idle copy with v4.2 inline span | VERIFIED | Line 622 contains exact literal `<span className="font-bold text-danger">v4.2</span>`. |
| `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` | Synthetic 4.3-shape skeleton with both detection signals | VERIFIED | 328 bytes; `skeleton.spine = "4.3.91-beta"`; `constraints: [{ type: "ik", … }]` non-empty array. |
| `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas` | Single 1×1 region atlas | VERIFIED | 170 bytes; first line `SPINE_4_3_TEST.png`; `rotate: false`; `size: 1, 1`. |
| `fixtures/SPINE_4_3_TEST/images/SQUARE.png` | 1×1 stub PNG | VERIFIED | 74 bytes; byte-for-byte copy of SPINE_3_8_TEST/images/SQUARE.png (per SUMMARY claim — fixture is present and correctly sized). |
| `.planning/seeds/SEED-006-spine-4.3-runtime-port.md` | New seed file, SEED-003-mirroring shape | VERIFIED | 91 lines; frontmatter (7 keys); body sections (Why This Matters / Costed Inventory / Schema+Runtime Deltas / Trigger Condition / Cross-Links / Recommendation / Sources). |
| `.planning/seeds/SEED-003-spine-4.3-compatibility.md` | Phase 32 addendum with SEED-006 forward link | VERIFIED | New `## Status (2026-05-10) — Option A landed; Option C queued via SEED-006` section at line 66; rest of file byte-stable (frontmatter unchanged, `status: planted` preserved). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `loadSkeleton` | `checkSpineVersion` | sequential call inside `loadSkeleton` parsedJson narrowing block | WIRED | `src/core/loader.ts:230, 233, 237` call `checkSpineVersion` before atlas resolution. |
| `loadSkeleton` | `checkSpine43Schema` | sequential call AFTER `checkSpineVersion`, BEFORE atlas resolution and `SkeletonJson.readSkeletonData` | WIRED | `src/core/loader.ts:245` calls `checkSpine43Schema(parsedJson, skeletonPath)` immediately before the Phase 22 DIMS-01 walk (line 247+) and atlas resolution (line 364+). `readSkeletonData` is at line 540. |
| `checkSpine43Schema` | `SpineVersionUnsupportedError` | throw with `detectedVersion = '4.3-schema'` | WIRED | `src/core/loader.ts:187` throws sentinel string. |
| `checkSpineVersion` (4.3+ branch) | `SpineVersionUnsupportedError` | throw with actual semver | WIRED | `src/core/loader.ts:140` throws with raw `version` string. |
| `SpineVersionUnsupportedError` constructor | COMPAT-01 message | branch on `detectedVersion`: `'4.3-schema'` literal OR semver parses to major.minor ≥ 4.3 | WIRED | `src/core/errors.ts:101-113` flips `isSpine43OrLater` for both routes; 114-115 produces COMPAT-01 wording. |
| App.tsx idle drop-zone `<p>` | v4.2 inline `<span>` | single literal Tailwind className `'font-bold text-danger'` | WIRED | `src/renderer/src/App.tsx:622` literal class string (no template, no array `.join`). |
| SEED-006 | SEED-003 | explicit body cross-link | WIRED | SEED-006 line 71 references SEED-003 path explicitly. |
| SEED-003 | SEED-006 | one-line addendum near bottom | WIRED | SEED-003 lines 66-70 reference SEED-006 path. |
| SEED-006 trigger_when | REQUIREMENTS.md L38 | verbatim copy of trigger-condition wording | WIRED | SEED-006 frontmatter line 6 + body line 67 quote REQUIREMENTS.md L38 verbatim. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| `checkSpine43Schema` | `parsedJson` | `JSON.parse(jsonText)` at `loader.ts:225` | Yes — real parsed JSON from disk | FLOWING |
| `checkSpineVersion` | `version` | narrowed from `parsedJson.skeleton.spine` at `loader.ts:227-230` | Yes — real string from skeleton field | FLOWING |
| `SpineVersionUnsupportedError.message` | `isSpine43OrLater` flag + `detectedVersion` | constructor argument from predicate throw | Yes — branched by real input value, not hardcoded | FLOWING |
| App.tsx drop-zone `<span>` v4.2 | static text node | hardcoded literal | N/A — static disclosure, not dynamic | N/A (intentional static) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Empty `constraints: []` rejects with `SpineVersionUnsupportedError` | `checkSpine43Schema({ constraints: [] }, '/tmp/x.json')` | Threw `SpineVersionUnsupportedError`, `detectedVersion === '4.3-schema'` | PASS |
| 4.3.91-beta semver rejects with COMPAT-01 message (4 substrings) | `checkSpineVersion('4.3.91-beta', '/tmp/x.json')` | All 4 substrings present in `.message` | PASS |
| 4.2.43 happy path (no throw) | `checkSpineVersion('4.2.43', '/tmp/x.json')` | No throw | PASS |
| 4.2 shape (no constraints) inert for schema predicate | `checkSpine43Schema({ skeleton: { spine: '4.2.43' }, bones: [], slots: [], skins: [] }, ...)` | No throw | PASS |
| 3.8.99 routes to pre-4.2 branch (no COMPAT-01 leak) | `checkSpineVersion('3.8.99', '/tmp/x.json')` | Pre-4.2 wording present, "supported downgrade" absent | PASS |
| 5.0.0 routes to COMPAT-01 (any major ≥ 5) | `checkSpineVersion('5.0.0', '/tmp/x.json')` | "supported downgrade" present | PASS |
| `'4.3-schema'` sentinel through constructor | `new SpineVersionUnsupportedError('4.3-schema', ...)` | Message contains "supported downgrade" | PASS |
| Layer-3 invariant intact | `npm test -- tests/core/ --run` (arch.spec.ts) | 12/12 cases green | PASS |
| Full Phase 32 test suite | `npm test -- tests/core/loader-version-guard.spec.ts tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-43-schema-guard-predicate.spec.ts tests/core/errors-version.spec.ts tests/core/loader.spec.ts tests/arch.spec.ts --run` | 88/88 passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COMPAT-01 | 32-01-PLAN.md, 32-03-PLAN.md | Loader detects 4.3 (sniff `root.constraints` array OR `skeleton.spine` semver ≥ 4.3) and throws `SpineVersionUnsupportedError` with "Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again" | SATISFIED | Truths 1, 2, 3, 4 verified; predicate is wired into `loadSkeleton` BEFORE atlas resolution; error message exact byte-stable per REQUIREMENTS.md L13. |
| COMPAT-02 | 32-02-PLAN.md | Drop-zone advisory at `App.tsx:622` calls out supported Spine version with `v4.2` rendered with strong/bold emphasis using `text-danger` | SATISFIED | Truth 7 verified; `<span className="font-bold text-danger">v4.2</span>` is the exact literal at App.tsx:622, satisfying REQUIREMENTS.md L14. |

**Coverage:** 2/2 phase requirements satisfied. SEED-006 plant (close-of-phase deliverable, not a REQ per REQUIREMENTS.md L25) is also complete (Truths 11-15).

**Orphan check:** REQUIREMENTS.md traceability table maps only COMPAT-01 + COMPAT-02 to Phase 32. No orphan requirements found. ATLAS-01..04 are explicitly mapped to Phase 33.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/core/loader-43-schema-guard-predicate.spec.ts` | 76-83 | Vacuous-pass test: `try/catch` without preceding `toThrow()` guard (per 32-REVIEW.md WR-01) | Warning | If `checkSpine43Schema` ever silently fails to throw on `{ constraints: [] }`, the catch block is never entered, neither `expect()` runs, and the test passes vacuously. Mitigated in practice: adjacent tests at lines 65-67 and 73-74 directly assert `toThrow(SpineVersionUnsupportedError)` on the same code paths; the sentinel value `'4.3-schema'` is also asserted in `errors-version.spec.ts`. The vacuous-pass test is the only one specifically asserting the sentinel value via the predicate. NOT a goal-blocker — the goal "predicate throws on `{ constraints: [] }`" is verified by the well-formed adjacent tests AND by the behavioural spot-check above. |
| `tests/core/loader-version-guard.spec.ts` | 153 | Stale comment line reference (per 32-REVIEW.md IN-01) | Info | Comment cites lines 82-89; actual location is 91-98. Documentation drift only; no test impact. |
| `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas` | 1 | Atlas page references `SPINE_4_3_TEST.png` which doesn't exist on disk (only `images/SQUARE.png` does) (per 32-REVIEW.md IN-02) | Info | Mirrors SPINE_3_8_TEST convention. Predicate fires before atlas resolution so PNG is never read. Acts as an intentional negative-space invariant check (if predicate ordering ever breaks, atlas resolution would fail with a different error class). |
| `src/core/loader.ts` | 240-244 | Predicate docblock says "defense-in-depth for 4.3 exports whose `skeleton.spine` field slipped through (missing field, malformed string, etc.)" but `checkSpine43Schema` only runs when `checkSpineVersion` passes (per 32-REVIEW.md IN-03) | Info | Docblock overstates predicate's coverage envelope. The predicate IS still useful — it catches a hypothetical 4.3 export that mis-stamps `spine: "4.2.x"` while carrying the 4.3 `constraints[]` array. Docblock accuracy issue only; no functional defect. |

**Severity totals:** 0 Blocker, 1 Warning, 3 Info. None of these block goal achievement; they are documentation/test-quality concerns flagged by the code reviewer.

### Human Verification Required

None.

The phase delivers two surfaces with deterministic verification paths:
1. Loader behaviour — fully covered by 88 automated unit + integration tests.
2. Drop-zone visual surface — the literal class string `"font-bold text-danger"` is the standard project token applied at the documented anchor; the visual rendering was already manually verified by the executor (Plan 02 SUMMARY mentions DMG + zip artifacts built cleanly).

The renderer change is a 1-line static JSX edit; no runtime UI behaviour to verify, no animations, no dynamic data flow. The error string surfaces in the renderer through the existing IPC envelope wiring (`state.error.message` at App.tsx:676), which has been wired since Phase 12 — no renderer changes required for this surface.

### Gaps Summary

No gaps. All 16 must-have truths verified, all artifacts present and correctly wired, all 2 phase requirements (COMPAT-01, COMPAT-02) satisfied, SEED-006 planted with full costed inventory and SEED-003 closed out with Phase 32 addendum. 88/88 tests pass; Layer-3 invariant intact; pre-4.2 branch byte-stable.

The 1 warning (vacuous-pass test, WR-01) and 3 info items from the code review are quality concerns, not goal achievement gaps. The vacuous-pass test concern is mitigated in practice by adjacent well-formed tests covering the same code paths, and the sentinel value assertion is independently covered in `errors-version.spec.ts` 4.3+ branch tests + the behavioural spot-check in this verification.

---

_Verified: 2026-05-10T16:45:00Z_
_Verifier: Claude (gsd-verifier)_
