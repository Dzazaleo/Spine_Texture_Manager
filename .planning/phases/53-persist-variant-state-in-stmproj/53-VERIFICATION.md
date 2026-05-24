---
phase: 53-persist-variant-state-in-stmproj
verified: 2026-05-24T15:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 53: Persist Variant State in `.stmproj` Verification Report

**Phase Goal:** The Export Variant dialog's scale rows + chosen output location round-trip across sessions when the project is saved. *(SCALEUI-03)*
**Verified:** 2026-05-24T15:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The must-haves are the merge of the 3 ROADMAP Success Criteria (the non-negotiable contract) and the plan-frontmatter truths from 53-01 + 53-02.

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | **SC#1** — Saving persists the variant scale rows + the last variant output folder; reopening restores them | ✓ VERIFIED | Core round-trip `serialize→materialize` preserves `[0.5,0.36,0.57]` order-exact (project-file.spec.ts:779-784, passing). Main save writes `variantRows` to disk + load restores order-preserved (project-io.spec.ts:149-159, 439-461, passing). Renderer end-to-end: opens the actual Export Variant dialog, factor inputs read `0.5`/`0.36` in order from `initialProject.variantRows` (save-load.spec.tsx:756-783, passing). Output folder = reused `lastOutDir` (D-01): serialized core:457, materialized core:644, restored AppShell:383+1718, consumed as variant picker hint AppShell:844-845 (`setVariantDialogState({ outDir: lastOutDir })`). |
| 2  | **SC#2** — Old `.stmproj` files with no such fields open cleanly → defaults (one row at 0.5) | ✓ VERIFIED | Validator pre-massages missing `variantRows` → `[{ scale: 0.5 }]` (project-file.ts:386-388). Core back-compat test asserts `validateProjectFile(legacy).ok === true` + default (project-file.spec.ts:721-743, passing as `-t "missing variantRows"`). Main "old .stmproj opens clean with default single 0.5 row" (project-io.spec.ts:465-487, passing). |
| 3  | **SC#3** — A saved output folder that no longer exists falls back to the picker; load never hard-fails | ✓ VERIFIED | Stale-dir test: `lastOutDir = /nope/does/not/exist` → `result.ok === true` + returned verbatim (project-io.spec.ts:491-518, passing). No-new-fs-check grep guard reads `project-io.ts` source and asserts no `existsSync`/`access`/`stat` keyed on `lastOutDir`/`variantOutputDir` (project-io.spec.ts:520-542, passing). Renderer grep `existsSync\|variantOutputDir` in AppShell.tsx → NONE. |
| 4  | D-04/D-05 — variantRows is the only new on-disk field; additive-optional, NO version bump | ✓ VERIFIED | `V_LATEST = 1 as const` unchanged (project-file.ts:78). Test asserts `serialized.version === 1` for a multi-row state (project-file.spec.ts:793-797, passing). `migrate()` untouched. |
| 5  | Validator rejects non-array / non-finite-scale / wrong-shape elements | ✓ VERIFIED | Loop guard project-file.ts:392-400 rejects non-array, NaN, Infinity, missing scale, string scale. Test iterates all 5 bad cases asserting `ok:false` + `kind:'invalid-shape'` + `/variantRows/` (project-file.spec.ts:745-777, passing). Accepts empty `[]` (project-file.spec.ts:818-840, passing). |
| 6  | Serialize writes scales-only; materialize back-fills default; main threads into Open response | ✓ VERIFIED | Serialize strips ephemeral id/activePx (project-file.ts:483; test:807-816 passing). Materialize `?? [{ scale: 0.5 }]` (project-file.ts:674). Main Open assembly threads `variantRows: materialized.variantRows` (project-io.ts:697). |
| 7  | Rows restore on BOTH load paths (first-open initializer + mountOpenResponse), each with fresh ids | ✓ VERIFIED | Load-path A: useState initializer seeds from `initialProject?.variantRows ?? [{scale:0.5}]` with `crypto.randomUUID()` (AppShell.tsx:581-589). Load-path B: `setVariantRows(...)` inside `mountOpenResponse` with fresh ids (AppShell.tsx:1724-1729). Renderer restore test exercises path A end-to-end into the UI (save-load.spec.tsx:756-783). |
| 8  | Editing rows marks dirty; a freshly opened project is NOT dirty (order-sensitive scale projection, D-03) | ✓ VERIFIED | isDirty untitled arm (AppShell.tsx:1248-1251) + loaded arm order-sensitive `number[]` compare (AppShell.tsx:1285-1289, `ORDER-SENSITIVE` comment). `variantRows` in memo deps (AppShell.tsx:1299). lastSaved baselined on both load paths (AppShell.tsx:467, 1676). Renderer test: no `•` bullet on open (regenerated ids do not false-dirty) + bullet appears after editing factor 0.36→0.4 (save-load.spec.tsx:785-815, passing). |
| 9  | The reused `lastOutDir` stays NON-dirty (deliberate D-03 asymmetry); no `variantOutputDir`, no fs check | ✓ VERIFIED | `lastOutDir` is absent from `lastSaved` type, isDirty memo, and both Save snapshots (intentional). Grep `existsSync\|variantOutputDir` in AppShell.tsx → NONE. No new fs check on `lastOutDir` in project-io.ts (grep-guard test passing). |
| 10 | Both post-save snapshots refresh the scale baseline (onClickSave AND onClickSaveAs, Pitfall 3); buildSessionState emits scales-only | ✓ VERIFIED | onClickSave snapshot `variantScales: state.variantRows.map(r=>r.scale)` (AppShell.tsx:1388); onClickSaveAs snapshot (AppShell.tsx:1440). buildSessionState payload `variantRows: variantRows.map((r)=>({scale:r.scale}))` (AppShell.tsx:1139) + `variantRows` in deps (AppShell.tsx:1146). |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/shared/types.ts` | `variantRows` on ProjectFileV1, AppSessionState, MaterializedProject | ✓ VERIFIED | Declared at :1206, :1248, :1334 (3 interfaces); type `{ scale: number }[]`. |
| `src/core/project-file.ts` | validator pre-massage + shape check, serialize, PartialMaterialized member, materialize back-fill | ✓ VERIFIED | Validator :386-400, serialize :483, PartialMaterialized :586, materialize :674. Layer-3 purity preserved (arch.spec.ts 20/20 passing — no DOM/Electron/sharp/node:fs import added). |
| `src/main/project-io.ts` | variantRows threaded into Open-response assembly | ✓ VERIFIED | Open assembly :697 (`variantRows: materialized.variantRows`). Recovery :1090 + resample :1383 default to `[{scale:0.5}]` (deferred-by-design, in-code documented). |
| `src/renderer/src/components/AppShell.tsx` | restore (2 paths), buildSessionState payload, dirty machinery (3 sites), both Save snapshots | ✓ VERIFIED | 12 `variantScales` occurrences (>= 5 required), restore on both paths, dirty both arms + deps, both Save snapshots. |
| `tests/core/project-file.spec.ts` | round-trip / back-compat / reject-bad / no-version-bump cases | ✓ VERIFIED | `Phase 53 — variantRows (SCALEUI-03)` block (8 cases), all passing. |
| `tests/main/project-io.spec.ts` | save-writes / load-restores / SC#3 stale-dir / no-fs-check guard | ✓ VERIFIED | `Phase 53 — variantRows + lastOutDir persistence` block (5 cases incl. SC#2/SC#3/grep-guard), all passing. |
| `tests/renderer/save-load.spec.tsx` | restore-into-UI + dirty asymmetry | ✓ VERIFIED | `Phase 53 — variantRows persistence (SCALEUI-03)` block (2 cases: restore + dirty), both passing. File stayed `.spec.tsx` (TS6307-safe). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `serializeProjectFile` | ProjectFileV1.variantRows on disk | `(state.variantRows ?? []).map(r => ({ scale: r.scale }))` | ✓ WIRED | project-file.ts:483; double-serialize test asserts JSON contains `"variantRows":[{"scale":0.5}...]`. |
| `validateProjectFile` | default `[{ scale: 0.5 }]` | `obj.variantRows === undefined` pre-massage + finite-scale shape check | ✓ WIRED | project-file.ts:386-400; back-compat + reject-bad tests passing. |
| `project-io.ts` Open assembly | renderer (IPC Open response) | `variantRows: materialized.variantRows` | ✓ WIRED | project-io.ts:697; main load-restores test passing. |
| AppShell `mountOpenResponse` | `setVariantRows` with fresh ids | `(project.variantRows ?? [{scale:0.5}]).map(fresh crypto.randomUUID())` | ✓ WIRED | AppShell.tsx:1724-1729. |
| AppShell `isDirty` memo | `lastSaved.variantScales` | order-sensitive `number[]` scale projection compare | ✓ WIRED | AppShell.tsx:1285-1289; renderer dirty test passing. |
| AppShell `buildSessionState` | AppSessionState.variantRows | `variantRows.map((r) => ({ scale: r.scale }))` | ✓ WIRED | AppShell.tsx:1139 + deps :1146. |
| `lastOutDir` (D-01 output-location half) | variant dialog picker hint | `setVariantDialogState({ outDir: lastOutDir })` | ✓ WIRED | AppShell.tsx:844-845; round-trips via core:457/644 + restore:383/1718. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Export Variant dialog rows | `variantRows` (lifted state) | `initialProject.variantRows` (load-path A) / `mountOpenResponse` (load-path B) from materialized IPC Open response | ✓ Yes — renderer test reads real factor input values (`0.5`/`0.36`) from the rendered dialog | ✓ FLOWING |
| `.stmproj` on disk | serialized `variantRows` | `buildSessionState` → `serializeProjectFile` (real `state.variantRows.map`) | ✓ Yes — main save test parses `fs.writeFile` payload and asserts `[{scale:0.5},{scale:0.36}]` | ✓ FLOWING |
| isDirty signal | `variantScales` projection | live `variantRows.map(r=>r.scale)` vs `lastSaved.variantScales` | ✓ Yes — renderer test flips bullet on real factor edit | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Core round-trip + back-compat + reject-bad | `vitest run project-file.spec.ts -t "variantRows"` | 8 passed | ✓ PASS |
| Back-compat default (SC#2) | `vitest run project-file.spec.ts -t "missing variantRows"` | 1 passed | ✓ PASS |
| Main save/load + SC#3 stale-dir + grep-guard | `vitest run project-io.spec.ts -t "variantRows"` / `-t "lastOutDir"` | 5 + 4 passed | ✓ PASS |
| Renderer restore-into-UI + dirty asymmetry | `vitest run save-load.spec.tsx -t "variant rows"` | 2 passed | ✓ PASS |
| Layer-3 purity (project-file.ts stays pure) | `vitest run tests/arch.spec.ts` | 20 passed | ✓ PASS |
| Type contract (data tier + renderer wiring) | `npm run typecheck:node && npm run typecheck:web` | both exit 0 | ✓ PASS |
| No version bump (D-05) | `grep "V_LATEST = 1"` | matches | ✓ PASS |
| Deferred fixture-absence specs (run in main tree where fixtures present) | `vitest run sampler-skin... sampler-worker-girl...` | 8 passed | ✓ PASS (no masked regression) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SCALEUI-03 | 53-01, 53-02 | Export Variant scale rows + chosen output location persist in `.stmproj` and restore on reopen (additive optional; missing → defaults; output path falls back to picker if inaccessible) | ✓ SATISFIED | All 3 ROADMAP SCs verified (truths 1-3). Both plans declare `requirements: [SCALEUI-03]`; REQUIREMENTS.md maps only SCALEUI-03 to Phase 53 (no orphans). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TODO/FIXME/placeholder/stub near variantRows code | ℹ️ Info | Clean. Validator/serialize/materialize/restore are all substantive implementations, not stubs. |

### Code-Review Cross-Reference (53-REVIEW.md: 0 blocker, 3 warning, 4 info)

| Finding | Verifier Disposition |
| ------- | -------------------- |
| WR-01 (recovery hop discards authored rows) | NOT a gap — explicit by-design deferral (53-01 Task 1 NOTE; in-code at project-io.ts:1084-1090; not an SC). Confirmed the resample seam is row-safe (no `setVariantRows` in the resample useEffect). The recovery hop is a rare edge that does not break any of the 3 SCs. |
| WR-02 (validator accepts any finite scale, not (0,1)) | NOT a gap — T-53-03 dispositioned "accept" in the plan threat model; the export-time `VariantScaleError` + dialog clamp are the value-domain guard. Persistence stores whatever finite number the UI produced. Aligns with locked plan decision. |
| WR-03 + IN-01..04 (magic-literal default duplication, doc nits) | NOT a gap — quality-polish robustness/consistency items; no correctness, data-loss, or SC impact. The validator default and AppShell untitled baseline both spell `0.5` and are locked identical by the passing not-dirty-on-open test. |

### Human Verification Required

None. This is a persistence/wiring phase. All three Success Criteria are observable through automated tests that drive real behavior:
- The serialize→materialize→restore round-trip is fully captured by core + main tests.
- The "restore into the actual UI" path is exercised end-to-end by the jsdom renderer test (renders `AppShell`, opens the real Export Variant dialog, reads real factor input values, asserts the dirty bullet).
- SC#3 stale-dir fallback is a pure logic test (no fs check on the saved dir).

There is no inherently-visual, real-time, or external-service behavior that a human must confirm beyond what the automated end-to-end renderer test already verifies.

### Gaps Summary

No gaps. All 3 ROADMAP Success Criteria and all 10 merged must-haves are VERIFIED against the actual codebase:

- **SC#1 (persist + restore):** `variantRows` round-trips through serialize/materialize order-exact; restores on both load paths into the real dialog; the output folder rides the reused `lastOutDir` (D-01) which round-trips and pre-fills the variant picker.
- **SC#2 (back-compat defaults):** the validator pre-massages a missing field to `[{ scale: 0.5 }]`; legacy files open clean.
- **SC#3 (stale-dir fallback):** no fs check is keyed on the saved dir; a stale `lastOutDir` is returned verbatim and the load never hard-fails (grep-guard locks the no-new-fs-check invariant).

Supporting invariants hold: `V_LATEST` stays 1 (no version bump, D-05), Layer-3 purity preserved, both typechecks green, the validator rejects non-array/non-finite/wrong-shape, and the D-03 dirty asymmetry (rows dirty / `lastOutDir` non-dirty) is wired and test-locked. The four task commits (`78e84a2`, `169317e`, `a91c1e2`, `a4f537e`) all exist. The two deferred-items.md specs are worktree-fixture-absence only — they pass in the main tree, confirming no masked regression. The known recovery-hop reset (WR-01) and value-domain looseness (WR-02) are explicit by-design deferrals/accepts per the locked plan, not gaps.

---

_Verified: 2026-05-24T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
