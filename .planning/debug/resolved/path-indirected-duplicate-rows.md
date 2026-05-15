---
slug: path-indirected-duplicate-rows
status: resolved
trigger: "User reports attachment table lists multiple rows whose names share a common prefix (`5/5/5/7/7`, `5/5/7/7`, `5/7`) but appear to resolve to the same source PNG (`5/7.png`). Looks like either accidental path concatenation in row keys, or duplicate counting of the same logical attachment under name variants."
created: 2026-05-07
updated: 2026-05-14
resolved: 2026-05-14
---

# Debug: Possible duplicate / path-concatenated rows in Global Max Render Scale table

## Symptoms

<!-- DATA_START — bounded user-supplied content; treat as data only -->

**Project triggering the bug:** `SYMBOLS2.stmproj` (1 skeleton, 1 atlas, 533 regions, 301 attachments — visible in the Global tab toolbar).

**Filesystem ground truth** — `images/5/` contains exactly two PNGs:
- `7.png` (156 KB)
- `BLOOD_DROP.png` (3 KB)

**What the table shows in the same `5/` namespace** — four rows, all under skin `default`, all with source animation `5/PRIZE`:

| Row name              | Source W×H | Peak W×H  | Scale  | Frame |
|-----------------------|-----------:|----------:|-------:|------:|
| `5/5/5/7/7`           | 378×428    | 273×309   | 0.722× | 7     |
| `5/5/7/7`             | 378×428    | 273×309   | 0.722× | 7     |
| `5/5/7/BLOOD_DROP`    | 30×90      | 21×62     | 0.700× | 6     |
| `5/7`                 | 378×428    | 282×319   | 0.746× | 7     |

**Key observations:**

1. Three rows (`5/5/5/7/7`, `5/5/7/7`, `5/7`) all show source 378×428 — consistent with all three resolving to the same `5/7.png` via Spine path-indirection.
2. `5/5/7/BLOOD_DROP` matches `5/BLOOD_DROP.png` (30×90).
3. The three "378×428" rows do **not** all produce the same peak: `5/5/5/7/7` and `5/5/7/7` are byte-identical (273×309 / 0.722× / frame 7), but `5/7` differs (282×319 / 0.746× / frame 7).
4. The naming pattern `5/5/5/7/7` and `5/5/7/7` looks like accidental path/slot prefix concatenation rather than authored Spine attachment names.

**Expected behavior:** Either
- One row per unique logical asset (the table de-dupes path-indirected attachments and reports the max peak across all referencing instances), OR
- One row per genuine attachment instance with names that match what's authored in the Spine JSON (no synthesized prefixes).

**Actual behavior:** Multiple rows with surprising name patterns that suggest path concatenation, plus two rows with byte-identical peak values that look like duplicate sampling of the same attachment.

**Timeline / suspect commit:** Commit `792af3f` (`fix(analyzer): resolve atlas-region maps via regionName for path-indirected attachments`) is recent and directly touches path-indirection logic. Prime bisect candidate.

**Repro:** Open the SYMBOLS2.stmproj fixture in the dev app and inspect the Global Max Render Scale table for rows under skin `default` whose name starts with `5/`.

<!-- DATA_END -->

## Hypotheses to consider

1. **Analyzer path-key concatenation bug** (post-792af3f). The recent regionName resolution change may have left the row-key generation joining parent paths/slot names with the attachment name, producing `5/5/5/7/7` instead of the authored `5/7`. Look at `src/core/analyzer.ts` for how the table-row key is built (skin name? slot path? attachment name? path field?).

2. **Sampler double-counting via skin manifest pass.** The Pass 1.5 skin-manifest code at `src/core/sampler.ts:188-263` (per memory `project_sampler_visibility_invariant.md`) iterates skin-declared attachments. If it emits a row keyed differently from the slot-iteration pass, the same attachment could land in the table under two keys.

3. **Legitimate Spine authoring.** The names `5/5/5/7/7` etc. may actually exist verbatim in `SYMBOLS2.json` (Spine attachment names can contain `/`). If so, the rows are correct and the differing peaks across the three "378×428" entries are explained by different bone/slot transforms — but we should still verify this is what the user expects to see.

## Constraints

- **User preference (feedback memory `feedback_narrow_before_fixing.md`):** when multiple theories exist, run a cheap diagnostic to falsify before scoping a fix. Don't go straight to code edits.
- **Strict loaderMode separation** (memory `project_strict_loadermode_separation.md`): atlas-source vs. atlas-less is gated on `load.atlasPath`. Whatever fix we propose must not violate this.
- **Sampler visibility invariant** (memory `project_sampler_visibility_invariant.md`): all skin-declared attachments must be measured. A "fix" that drops attachments to dedupe rows must not regress this.

## Files most likely relevant

- `src/core/analyzer.ts` — region map resolution touched by 792af3f; row-key generation likely lives here
- `src/core/sampler.ts` — peak measurement; Pass 1.5 skin-manifest at lines ~188-263
- `src/ui/` — Global tab table rendering (need to grep for the column headers `Peak W×H` / `Source W×H` to find the component)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — current golden test fixture; may need a path-indirection fixture
- `fixtures/Chicken/` — newly added (untracked); may already be a related repro fixture

## Cheap diagnostic plan (run BEFORE proposing a fix)

1. **Ground-truth the JSON.** Grep the SYMBOLS2.json (under `temp/` or wherever the .stmproj resolves to) for the literal strings `5/5/5/7/7`, `5/5/7/7`, and `5/7`. If they appear verbatim as attachment names → hypothesis 3 (legitimate authoring). If only `5/7` appears → hypotheses 1 or 2.
2. **Inspect the row data structure.** Find where the table rows are built (likely `src/core/analyzer.ts` or a UI selector) and add a one-shot CLI/script log of `(rowKey, attachmentName, slotName, skinName, regionName, pathField)` for any attachment whose path resolves to `5/7`. Identify which field becomes the row's display name and which fields disagree across the three "378×428" rows.
3. **Bisect against 792af3f.** If hypothesis 1 looks live: `git stash` if needed, `git checkout 792af3f^`, re-run the table on the same fixture, compare row count. If pre-792af3f had 1 row for `5/7` and post-792af3f has 3, the commit is the cause.

## Current Focus

```yaml
hypothesis: "Hypothesis 3 (legitimate Spine authoring) confirmed. Names appear verbatim in SYMBOLS.json. Surfacing as a UX/design question rather than a bug."
test: "Grep SYMBOLS.json for the four row names — completed"
expecting: "All four names appear authored — confirmed"
next_action: "User decision recorded → audit the 4 surfaces → recommend dispatch"
reasoning_checkpoint: "audit_complete_phase_plan_recommended"
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-07
  step: "Located SYMBOLS2.stmproj"
  finding: "fixtures/Chicken/SYMBOLS2.stmproj points at skeletonPath: SYMBOLS.json (NOT SYMBOLS2.json). Real fixture is fixtures/Chicken/SYMBOLS.json (369KB, 533 regions per atlas)."

- timestamp: 2026-05-07
  step: "Diagnostic step 1 — grep SYMBOLS.json for suspect row names"
  command: "grep -n on '5/5/5/7/7', '5/5/7/7', '5/7', '5/5/7/BLOOD_DROP'"
  finding: "ALL FOUR names appear verbatim as authored Spine attachment keys."
  details:
    - "Line 1160: '5/5/5/7/7' is the attachment in slot '7' with `path: \"5/7\"` (mesh vertices unique)"
    - "Line 1173: '5/5/7/7' is the attachment in slot '8' with `path: \"5/7\"` (mesh vertices nearly identical to 5/5/5/7/7 but offset by ~3 units)"
    - "Lines 3270, 3283: '5/7' is the attachment in slots 'VOLUME_7' and 'VOLUME_8' with NO `path` field (attachment name doubles as region name)"
    - "Lines 1483, 1496: '5/5/7/BLOOD_DROP' in slots/skins; resolves to atlas region '5/BLOOD_DROP'"
  conclusion: "Hypothesis 1 (analyzer synthesizing names) FALSIFIED. Hypothesis 3 (legitimate authoring) CONFIRMED. The user's Spine project deliberately uses long slash-separated attachment names that LOOK like paths but are authored identifiers."

- timestamp: 2026-05-07
  step: "Inspected slot definitions in SYMBOLS.json"
  finding: "Slots authored at lines 461-464: VOLUME_7 + VOLUME_8 bind to bone 'VOLUME'; slots '7' and '8' bind to bone '7_FRONT' (with '8' having blend: additive). Different bones → different world transforms → different peak scales. This explains the user's observation #3 (5/7 row peaks 0.746× while 5/5/5/7/7 + 5/5/7/7 both peak 0.722×)."

- timestamp: 2026-05-07
  step: "Audited row-key generation in src/core/analyzer.ts"
  finding: "Line 187: `winners.set(r.attachmentName, ...)` — dedup is keyed on the authored attachmentName from PeakRecord. No path concatenation anywhere. Three distinct authored names → three distinct rows by current contract."
  finding_2: "Line 220: `lookupKey = p.regionName ?? p.attachmentName` is used to look up source dims / atlas page metadata only — it never feeds the row identity. The dim lookup correctly resolves to the shared `5/7.png` for all three rows (which is why all three show source 378×428)."

- timestamp: 2026-05-07
  step: "Audited PeakRecord construction in src/core/sampler.ts"
  finding: "Lines 247-262, 409-435, etc.: `attachmentName: entry.name` (authored), `regionName: regionName ?? entry.name` (atlas key). Both fields are tracked; analyzer dedup uses attachmentName. Sampler keys records by `${skinName}/${slotName}/${attachmentName}` (sampler.ts:91 docblock) — Pass 1.5 (lines 240-285) writes one record per distinct (skin, slot, attachment) tuple, no double-write under different keys."
  conclusion: "Hypothesis 2 (sampler double-counting via Pass 1.5) FALSIFIED. The two byte-identical rows `5/5/5/7/7` (slot 7) and `5/5/7/7` (slot 8) are TWO DIFFERENT SAMPLER RECORDS that happen to have nearly identical mesh vertices and share bone `7_FRONT`, so they round to the same 0.722× peak after ceil-thousandth. Slot `7` mesh: vertices [-1.24, -107.41, ...]; slot `8` mesh: vertices [-1.19, -110.1, ...] — distinct meshes, near-identical world AABBs."

- timestamp: 2026-05-07
  step: "User design decision recorded"
  decision_verbatim: "Option B + 4-surface invariant. Dedup by source PNG (`regionName`) across the entire app. Contract: \"N unique source PNGs ⇒ N rows everywhere.\" The Global panel, Atlas Preview, Optimize Assets dialog, and the exported folder must all display exactly the same count — one entry per unique image used in the rig. Per-region peak = `max(peak across all attachments resolving to that region)`. Per-attachment-name detail (mesh/weight-map variation) belongs in a drill-down, not as separate top-level rows."

- timestamp: 2026-05-07
  step: "Surface audit (this cycle)"
  finding: "See § Surface Audit below."

- timestamp: 2026-05-07
  step: "User reproduction — override-correctness bug confirmed by direct test"
  finding: "User overrode `5/7` to ~0% (4×4 / 0.011×) in Global panel. Two screenshots prove the override is unreachable through the current contract."
  details:
    - "Screenshot 1 (Global panel post-override): `5/5/5/7/7` and `5/5/7/7` retained their original 273×309 / 0.722× peak — the override on `5/7` did NOT propagate to the other attachments resolving to the same PNG `5/7.png`."
    - "Screenshot 2 (Optimize Assets dialog): the file row `images/5/7.png 378×428 → 273×309 ~1.4x smaller` IGNORED the user's 4×4 override entirely. The export pipeline correctly takes the per-region max across all contributing attachments (memory `project_compute_export_dims_canonical_base.md`) — so the two non-overridden attachments (`5/5/5/7/7`, `5/5/7/7`) won, silently overriding the override."
  conclusion: "This is a CORRECTNESS bug, not just UX noise. The override mechanism is keyed by attachmentName (`AppShell.tsx:544`), but the export pipeline is keyed by region (sourcePath). They never meet. There is no UI affordance today that lets a user actually size a path-indirected source PNG — the override path is dead-ended. This validates Option B + 4-surface invariant strongly: per-region dedup is the only way to make overrides reach the export."

- timestamp: 2026-05-07
  step: "Locked design decisions for phase plan (user-confirmed)"
  decisions:
    - "Milestone bucket: **v1.3.1** (patch release, not a new minor)."
    - "Row label format: `{regionName}.png` with `images/` prefix STRIPPED in Global panel. Optimize dialog keeps the `images/` prefix as today (matches the on-disk relative path). Same identity, surface-appropriate display."
    - "Override semantics flip to **per-region**. Overriding `5/7.png` to 4×4 sizes the *file* — all attachments resolving to that region inherit the override at export time. This is the only way to make overrides actually do what users expect."
    - "Source Animation + Frame columns under per-region dedup: report **the winning attachment's animation/frame** (the contributing attachment whose calculated peak equals the row's displayed peak). Tie-breaks: deterministic on attachmentName lex order."
    - "Regression fixture: **Chicken** (stripped). User confirmed Chicken is the test target. Plan to commit JSON+atlas+a small subset of PNGs (target <1MB) under `fixtures/Chicken-Min/` or similar; full 152MB Chicken stays gitignored."

## Eliminated

- **Hypothesis 1 (analyzer concatenation post-792af3f):** falsified by JSON grep. Names exist verbatim. Commit 792af3f only changed `lookupKey = p.regionName ?? p.attachmentName` for source-dim lookups (analyzer.ts line 220) — it does not touch row identity.
- **Hypothesis 2 (sampler double-counting Pass 1.5):** falsified by sampler key inspection. PeakRecord keys are `${skin}/${slot}/${attachment}`; two records on slots `7` and `8` with attachment names `5/5/5/7/7` and `5/5/7/7` are correct, distinct records. Identical peaks are coincidental (same bone, near-identical meshes, ceil-thousandth rounding).

## User Decision (recorded verbatim)

> Option B + 4-surface invariant. Dedup by source PNG (`regionName`) across the entire app. Contract: "N unique source PNGs ⇒ N rows everywhere." The Global panel, Atlas Preview, Optimize Assets dialog, and the exported folder must all display exactly the same count — one entry per unique image used in the rig. Per-region peak = `max(peak across all attachments resolving to that region)`. Per-attachment-name detail (mesh/weight-map variation) belongs in a drill-down, not as separate top-level rows.

## Surface Audit

Audit performed 2026-05-07 against the four user-named surfaces. "Conforms?" answers the question "does this surface already display N-rows-per-unique-source-PNG under the new contract?" Code loci are absolute file paths with line refs.

| # | Surface | Current granularity | Code locus | Conforms? | Change needed |
|---|---|---|---|---|---|
| 1 | **Global Max Render panel** | One row per **authored attachmentName** (e.g. 4 rows for `5/7.png`) | `src/core/analyzer.ts:183-190` (`dedupByAttachmentName`) — fold key is `r.attachmentName`. Rendered by `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` consuming `summary.peaks` (DisplayRow[]). | **N** | Re-key the analyzer fold to `regionName` (with `attachmentName` fallback), keep the highest-peak winner as today, AND track `contributingAttachments[]` on the kept row so the drill-down has the full per-attachment list. Many downstream consumers read `summary.peaks.find(p => p.attachmentName === X)` — they break unless we either (a) keep peaks per-attachment and fold in the panel only, or (b) change the data shape and migrate all consumers. Decision is design-level (see Multi-surface impact below). |
| 2 | **Atlas Preview modal** | Mode-dependent. **Original mode**: one entry per `summary.peaks` row (= per attachmentName today). **Optimized mode**: walks `plan.rows` + `plan.passthroughCopies` and **expands each ExportRow back to one preview tile per `attachmentNames[i]`** via `summary.peaks.find(p => p.attachmentName === attachmentName)`. | `src/core/atlas-preview.ts:166-231` (`deriveInputs`); mirrored in `src/renderer/src/lib/atlas-preview-view.ts:184-205`. Modal at `src/renderer/src/modals/AtlasPreviewModal.tsx`. | **N** | The optimized branch's expansion loop (`atlas-preview.ts:191-207`) deliberately re-emits one tile per attachmentName so click hit-tests work on every named attachment — but under the new contract this **DOUBLES** atlas page count for path-indirected projects (3 attachments → 3 tiles for one source PNG → packer treats them as 3 distinct tiles). Must change to one tile per ExportRow + attribute hit-tests via the row's `attachmentNames[]`. Original-mode branch must also re-key from `attachmentName` to `regionName` so the count matches the optimized side. |
| 3 | **Optimize Assets dialog** | One row per **unique sourcePath** (= effectively one per regionName, since loader builds `sourcePath = images/${regionName}.png`). | `src/core/export.ts:163-235` (`bySourcePath` Map) + `src/renderer/src/modals/OptimizeDialog.tsx:539-647` iterates `plan.rows` and `plan.passthroughCopies` directly. | **Y** | None for the count itself. The dialog already shows N=unique-source-PNGs. **Minor copy/UX**: the file-list could surface the `attachmentNames[]` count (e.g. "5/7.png — used by 3 attachments") so the user sees the same dedup-evidence the Global panel will now show. Pure rendering tweak. |
| 4 | **Exported folder** (on-disk PNG count) | One PNG per ExportRow = one per unique sourcePath. | `src/main/image-worker.ts:176, 320` (write loops over `plan.passthroughCopies` then `plan.rows`); `relativeOutPath` at `src/core/export.ts:114-120` derives `images/${regionName}.png`. Memory `project_compute_export_dims_canonical_base.md` confirms outW base is canonicalW per region. | **Y** | None. The pipeline already emits exactly one PNG per unique source, sized off canonicalW. Preserves the locked invariant. |

### Multi-surface impact summary

- **2 of 4 surfaces non-conforming** (Global panel + Atlas Preview).
- The Global-panel change is **NOT a 1-line dedup-key swap**:
  - `summary.peaks` (DisplayRow[]) is consumed by 8+ call sites that key on `attachmentName`:
    - `src/renderer/src/components/AppShell.tsx:512, 1037` — override-dialog peak lookup, effective-summary aggregation.
    - `src/core/atlas-preview.ts:193` + `src/renderer/src/lib/atlas-preview-view.ts:184` — optimized-mode tile expansion.
    - `src/main/project-io.ts:530, 804, 1001` — override save/load presence checks.
    - `src/main/doc-export.ts:274` — "optimized assets" count for the documentation builder.
    - `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — per-card row dedup also runs `dedupByAttachmentName` (`src/core/analyzer.ts:421`).
  - **Override semantics need re-design**: overrides are stored keyed by attachmentName (`AppShell.tsx:544`). Under the new contract a row represents N attachments — does an override apply to the named winner only, or to all `contributingAttachments[]`? The current OverrideDialog code paths assume one row = one attachmentName.
  - **DisplayRow data shape needs `contributingAttachments[]`** (or equivalent) to power the drill-down the user explicitly wants. That's a `src/shared/types.ts` change → propagates through analyzer, summary IPC, project-file persistence, and CLI golden output.
  - **AnimationBreakdownPanel becomes the natural drill-down** per the user's "Per-attachment-name detail belongs in a drill-down" clause — but its current per-attachment dedup needs to either stay (as the drill-down) or be re-thought for consistency. That's a UX call.
- **Atlas Preview** is at minimum a 2-call-site change (core + renderer mirror) and likely changes `AtlasPreviewInput` shape (one input per region with an `attachmentNames[]` for hit-test attribution) — also touches `src/shared/types.ts`.
- **Test fixture for regression**: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` does **not** exercise attachment-level path indirection (its `"path"` references are PathConstraint targets, a different feature). Either extend SIMPLE_TEST.json with a path-indirected attachment (preferred — keeps fixture set small) OR commit a small synthetic fixture. Chicken at 152MB cannot be committed wholesale; the JSON+atlas alone is ~400KB and could be included with a stripped/blank PNG for the regression test (a phase-plan decision).

### Constraint preservation (per orchestrator instructions)

- `project_sampler_visibility_invariant.md` — sampler unchanged. The dedup change happens **strictly downstream** in analyzer + atlas-preview deriveInputs. Pass 1.5 still emits one record per skin-declared attachment.
- `project_strict_loadermode_separation.md` — `regionName` is already populated in both modes by the sampler/loader; no new `load.atlasPath` branches introduced.
- `project_compute_export_dims_canonical_base.md` — export-side untouched. Exported folder already conforms (Surface #4); `outW = ceil(canonicalW × effScale)` invariant preserved.
- `feedback_explain_git.md` — any commit in this work would be narrated step-by-step. (No commit this cycle.)

## Recommendation: STOP — recommend `/gsd-plan-phase`

This change touches **2 of 4 surfaces** plus **data shapes** (`DisplayRow.contributingAttachments[]` likely; `AtlasPreviewInput` shape; possibly override semantics). It is not a 1-line fix. It is a phase-scope effort with:

- Cross-cutting type changes in `src/shared/types.ts` (which crosses the IPC structuredClone boundary; CLI golden output is also tied to DisplayRow's serialized shape).
- A required UX decision: how do overrides bind under region-deduped rows? (single-attachment vs region-wide; currently single-attachment.)
- Test fixture work: extend SIMPLE_TEST.json or add a small synthetic path-indirected fixture, plus regression tests at the analyzer + atlas-preview + export levels.
- Migration of ~8 call sites that currently do `summary.peaks.find(p => p.attachmentName === X)`.

The right next step is `/gsd-plan-phase` to scope this as a milestone v1.3 phase, with explicit decisions on:
1. Data shape — does `summary.peaks` become region-keyed (1 entry per unique sourcePath), or stay attachment-keyed with the dedup happening in panel/preview consumers?
2. Override semantics — stay attachmentName-bound (and the panel's row picks one as canonical) or migrate to region-bound?
3. Drill-down surface — is AnimationBreakdownPanel the drill-down, or does the Global panel need expandable rows?
4. Atlas Preview hit-test — one tile per region with name-list popover, or expand on hover?
5. Test fixture choice — extend SIMPLE_TEST.json (preferred) or add a small `fixtures/PATH_INDIRECT/` synthetic fixture.

## Resolution

- root_cause: "Originally framed as 'not a bug, design question' — REVISED post user test. This is a correctness bug: overrides are stored keyed by `attachmentName` while the export pipeline is keyed by region. Under path-indirection, an override on one attachmentName cannot propagate to siblings resolving to the same source PNG, and the export pipeline's per-region max silently erases the override (because the non-overridden siblings win). User confirmed by direct repro: overriding `5/7` to 4×4 produced an exported `5/7.png` at 273×309 — ignoring the override entirely. The 'four rows for one PNG' display is the symptom; the broken override→export linkage is the underlying defect."
- fix: "Not applied this cycle. Phase scope confirmed via surface audit (2 of 4 surfaces non-conforming) + override-semantics correctness bug. Targets v1.3.1 patch release. Next step: `/gsd-plan-phase`."
- verification: "JSON grep + analyzer/sampler audit confirm names are authored verbatim. Differing peaks (0.722× vs 0.746×) are explained by different bones (7_FRONT vs VOLUME) producing different world transforms. User reproduction confirms override unreachability. Surface audit identifies 8+ call sites in `src/` keyed on `summary.peaks` attachmentName lookup that must migrate."
- files_changed: []
- status: "pending_phase_plan"
- target_milestone: "v1.3.1"
- locked_decisions:
  - "Per-region dedup across all 4 surfaces (Global, Atlas Preview, Optimize, exported folder)."
  - "Row label = `{regionName}.png`; Global strips `images/` prefix, Optimize keeps it."
  - "Override semantics = per-region (overriding the row sizes the file; all contributing attachments inherit at export time)."
  - "Source Animation + Frame attribution = winning attachment (the one whose peak equals the row's displayed peak); tie-break = lex order on attachmentName."
  - "Regression fixture = stripped Chicken subset (<1MB) committed; full 152MB Chicken stays gitignored."

## Design Question (resolved by user — Option B + 4-surface invariant)

The investigation confirms the table is mathematically correct — but the question remains whether the current "one row per authored attachmentName" contract is the right UX when path-indirected attachments share a source PNG. Three options:

**Option A — keep current contract (one row per authored attachment).**
- Pro: matches Spine's authoring model 1:1; users who know their attachment names see them surfaced.
- Pro: differing peaks across slots ARE useful info (the VOLUME slots vs FRONT slots peak differently — that's actionable for the artist).
- Con: when path-indirection is used, the same source PNG appears in multiple rows; the table conflates "logical attachment instances" with "files I will export."
- Con: the export pipeline produces one PNG per region, so N rows for one PNG can mislead the artist into thinking they have N separate exports to size.

**Option B — dedup by regionName (one row per unique source PNG).**  ← **CHOSEN by user with 4-surface invariant extension**
- Pro: matches the export model 1:1 (one row = one output file).
- Pro: kills the user-visible "duplicate"-looking rows.
- Con: hides per-slot peak variation; the artist loses the "VOLUME peaks at 0.746× but FRONT peaks at 0.722×" signal — and the higher peak wins, so an artist might over-size based on a peak that's specific to one slot's bone chain.
- Con: requires Display row to track ALL contributing attachmentNames (for tooltip / breakdown panel) so the user can still drill in.

**Option C — keep current, add a "merge path-indirected rows" toggle in Settings or as a sort/group option.**
- Pro: lets the user choose per-project; their authoring style determines whether the long names are "noise" or "signal."
- Pro: backward-compatible; existing users see no change unless they opt in.
- Con: more UI surface area; another setting to document.

**Option D — keep current contract but surface a "merged regionName" column.**
- Pro: minimal change; the table grows one column showing the canonical region (e.g., `5/7` for all three of `5/5/5/7/7` / `5/5/7/7` / `5/7`).
- Pro: artist can sort/group by region in the UI without us changing dedup semantics.
- Con: table widens; one more column to fit.

Memories that constrain the decision:
- `project_sampler_visibility_invariant.md` — sampler must measure all skin-declared attachments. Any merge happens in the analyzer/UI layer, not by dropping records upstream.
- `project_strict_loadermode_separation.md` — regionName lookup already tolerates atlas-source vs atlas-less symmetry; merging by regionName is safe in both modes.
- `feedback_narrow_before_fixing.md` — diagnostic done; design choice belongs to the user.

---

## Resolved at v1.5 milestone close — 2026-05-14

Closed during `/gsd-complete-milestone v1.5`. The locked decision in this file ("Option B + 4-surface invariant — dedup by source PNG (`regionName`) across the entire app") was implemented by **Phase 29 (v1.3.1)** with `analyzeRegions` + `dedupByRegionName` + REGION-05 lex tiebreak (commit `bc758c6 feat(29-01)`). The `contributingAttachments` dedup follow-up landed in `a5b5ee9 fix(29-06)`. All 4 surfaces (Global panel, Atlas Preview, Optimize Assets, exported folder) now consume region-keyed data — completion of `skins-optimize-undercount` via Phase 35 (v1.4) closed the last non-conforming surface.

Current code: [analyzer.ts:248-350](../../../src/core/analyzer.ts) (`analyzeRegions`); [export.ts:198-201](../../../src/core/export.ts) (`buildExportPlan` iterates `summary.regions`).
