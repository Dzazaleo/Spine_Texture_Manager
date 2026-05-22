# Phase 48: Core Scale-Bake Module + Regression Oracle - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Promote the spike `baker.mjs` prototype into a **Layer-3-pure `core/` JSON→JSON bake** that
mirrors spine-core `SkeletonJson.scale` field-for-field across both schemas (4.2 split
`transform/ik/path/physics[]` and 4.3 unified `constraints[]`), finish the finite remaining
constraint-timeline curve channels, and wire the decisive sampling-free oracle
(`parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)`) as a CI test across a real
in-repo fixture matrix. This is the foundation every v1.7 export phase depends on.

**In scope:** the `core/` bake module; the timeline curve channels (IK softness curve, PATH
position/spacing length-mode); the field-identity oracle as a CI test; the in-repo fixture
matrix; Layer-3 arch-spec anchoring.

**Out of scope (later phases — do NOT discuss/build here):** variant export / folders / atlas
writing (Phase 49), `variant_peak = s × master_peak` sizing application (Phase 49), setup-pose
rig-bounds + two-way scale↔dimension UI (Phase 50), batch fan-out (Phase 51). The bake is the
*only* new artifact this phase produces.

</domain>

<decisions>
## Implementation Decisions

### CI Fixture Matrix
- **D-01:** Strategy = **tracked redistributables for breadth + real spike-validated rigs as
  anchors + standalone authored fixtures only for residual gaps.** The roadmap-named candidates
  were re-checked on disk and found un-shippable as written (see context below), so the matrix is
  rebuilt from what can actually run in CI.
- **D-02:** **`fixtures/DEMON/SKINS_SPINE_V02.json` + `.atlas` are committed as a PUBLIC fixture**
  (owner confirmed DEMON is OK to publish) — the real 4.3 stress rig (`spine 4.3.02`;
  constraints `transform + ik + physics + slider`; mesh). Anchors the 4.3 all-constraint-types +
  slider-remap coverage.
- **D-03:** **`fixtures/MON_FILES/EXPORT/TEST_01/4.2/TEST_01.json` + `.atlas` are committed as a
  PUBLIC fixture** (owner confirmed) — the deform-heavy 4.2 anchor (`spine 4.2.43`; `transform×15
  ik×8 path×14 physics×51`; **deform×18**). Single rig that closes deform + PATH + all-four 4.2
  constraint types in one shot. This is the rig that defeats the "DEMON 4.3 has zero deform → false
  confidence" trap the roadmap warns about.
- **D-04:** **Both DEMON and TEST_01 are committed as JSON + `.atlas` ONLY — their PNGs are
  EXCLUDED** (DEMON PNGs = 107 MB, TEST_01 PNGs = 4 MB; JSON+atlas = 1.3 MB + 712 KB). The bake
  and the oracle never read PNG bytes (CLAUDE.md fact #4 — the math phase doesn't decode PNGs;
  atlas metadata suffices). Implementation: add `.gitignore` negation entries that un-ignore the
  specific `.json`/`.atlas` while keeping `*.png` ignored. **MUST verify the committed fixtures are
  actually tracked + reachable on a fresh clone before relying on them** (memory
  `feedback_gitignore_fixtures_check_test_refs` + `feedback_verify_whole_ci_surface_locally` — a
  gitignored regression fixture silently broke CI at v1.3.1).
- **D-05:** Authored standalone synthetic fixtures are produced **only for residual gaps** after
  DEMON + TEST_01 + the tracked redistributables — known candidates: a **4.3 PATH constraint**
  (DEMON has none) and a **PATH position/spacing length-mode TIMELINE** if TEST_01 does not animate
  them. Researcher must confirm coverage before authoring; do not author what an anchor already
  exercises.
- **D-06:** Gap-fillers, when needed, are **standalone committed fixtures** (real `.json` + minimal
  `.atlas` under `fixtures/`), NOT synthetic test-time injection — more legible/reviewable and
  reusable by the Phase 49–51 export tests. (Phase 37 RGBA2 / Phase 46 `buildLoadSlider43`
  injection precedent exists but is deliberately NOT the chosen path here.)

### Channel-Proof Depth
- **D-07:** **Fix-and-verify ALL three** finished channels — every one gets an in-repo fixture the
  oracle gates on, no fix-and-trust gaps:
  1. **IK softness-timeline curve** — scale the `cy` control points; leave the paired `mix` channel
     UNSCALED. (Tracked `spineboy_4.3` has 16 IK-softness timeline keys → real coverage exists.)
  2. **PATH position/spacing length-mode timelines** — values + curves scaled in length/proportional
     mode only (percent mode unscaled).
  3. **Slider remap slope** (`scale / propertyScale`, 4.3) — the spike flagged this as never
     exercised by any test rig; DEMON has a slider but the remap-slope path must be confirmed
     actually triggered (author a minimal slider-remap fixture if DEMON's slider doesn't exercise it).
- **D-08:** The oracle (field-identity vs Spine's own `SkeletonJson.scale`) inherently catches both
  over- AND under-scaling, so the "must stay unscaled" negatives (IK `mix` channel, the normalized
  deform curve) are covered by construction — no separate negative assertions required.

### Scale-Range Policy
- **D-09:** `bake(json, s)` is **direction-agnostic** — valid for any finite `s > 0` (the oracle
  already tests odd factors like 0.26 and may test `s > 1`). It rejects ONLY degenerate input
  (`s ≤ 0`, `NaN`, `±Infinity`). The v1.7 "scaled-down" product constraint lives at the export/UI
  edge (phases 49–50), NOT in core. Keeps the module single-responsibility and fully testable, and
  leaves the door open if upscaling is ever wanted.

### Unknown-Construct Handling
- **D-10:** **Assert-known: throw a typed error** when the bake meets an unrecognized type
  discriminator (an `attachment.type` / `constraint.type` / scalable-timeline name not in its rule
  table). Converts "rule table is incomplete" from silent geometry corruption into a loud, testable
  failure — catching gaps even in production rigs the oracle matrix never covers. The oracle proves
  correctness on covered constructs; the guard prevents silent corruption on everything else. Matches
  the project's typed-error culture (e.g. the `≥4.4` typed-reject). NOTE: only the **type
  discriminators** are asserted (the keys that decide *how* to scale) — the bake still freely ignores
  the many non-geometry fields (colors, names, etc.) it legitimately doesn't touch.

### Locked Carry-Forwards (from SEED-010 + spikes 001–003 — do NOT relitigate)
- **L-01:** Variant production = **full `SkeletonJson.scale` similarity bake**, NOT a bone scale
  (root explodes +316..619%; pivot leaves ±20–50% constraint residual). PROVEN field-identical on
  4.2 + 4.3 (spikes 001–003 VALIDATED).
- **L-02:** **Scaled-default injection is required** — absent `physics.limit` → `5000×s`, absent
  `skeleton.referenceScale` → `100×s` (fields read as `getValue(map,f,DEFAULT)*scale` with
  `DEFAULT≠0`). This is the spike's easy-to-miss landmine.
- **L-03:** Physics `x`/`y` are **NOT** length-scaled (only `limit` is). The normalized deform
  curve (0..1 mix) is **NOT** scaled (unlike translate curves).
- **L-04:** Oracle **excludes parse-assigned `id`/`hash`/`assetId`** and reference keys; numeric
  tolerance `~1e-3` relative (float math makes literal "strict equality" in the SC unattainable —
  tolerance is required and is the operative meaning of field-identity).
- **L-05:** `core/` stays **Layer-3 pure** (no DOM/Electron/sharp; green under `tests/arch.spec.ts`).
  The bake is a **pure transform returning NEW JSON — the source JSON is never mutated.** (First
  feature in the app's history to *write* a skeleton JSON; the source is read-only.)
- **L-06:** The bake is **atlas-independent by construction** (a pure JSON-field transform), so
  atlas-less mode is satisfied with no separate code path — the loader's atlas only affects texture
  binding, not the fields the bake touches.
- **L-07:** Deform timelines live at `animations[a].attachments[skin][slot][attachment].deform` on
  **both** runtimes (NOT `anim.deform`) — the spike's `bake.mjs` corrected this; the promoted module
  must use the corrected container key, not `baker.mjs`'s earlier shape if they differ.

### Claude's Discretion
- Module file name / exported function signature (e.g. `core/scale-bake.ts` `bake(json, s)`),
  internal helper structure, the exact typed-error class name/shape, and exactly which scale factors
  the CI oracle iterates (the spike used 0.5 + odd 0.26 — at least one non-round factor is wise).
  The oracle's cycle-safe deep-compare from the spike is the reference implementation to promote.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The de-risking spikes (THIS is the research — use these artifacts, not re-derivation)
- `.planning/spikes/MANIFEST.md` — the field-rule summary + the explicit coverage warnings
  (DEMON-has-no-deform false confidence; physics x/y not scaled; constraint-timeline channels are
  the finite remaining work).
- `.planning/spikes/CONVENTIONS.md` — the reusable oracle pattern, the scaled-default-injection
  rule, the `peakScale` measurement-blind-spot, the SKIP/exclude-id conventions.
- `.planning/spikes/002-json-bake-roundtrip/bake.mjs` — the validated bake **with the corrected
  deform container key** + the cycle-safe oracle harness (lines 96–121). Promote both.
- `.planning/spikes/002-json-bake-roundtrip/baker.mjs` — the exported `bake(json,s)` reused by
  spike 003 (note: its deform walk differs from `bake.mjs`'s corrected form — prefer `bake.mjs`).
- `.planning/spikes/002-json-bake-roundtrip/README.md` — the investigation trail (the `limit`/
  `referenceScale` scaled-default discovery; the deform-container-key + normalized-curve gaps the
  4.2 rigs caught; the Girl IK-softness-timeline-curve gap; the un-exercised slider remap slope).
- `.planning/spikes/001-fieldmap-autoderive/{derive.mjs,README.md}` — how the field-rule table was
  auto-derived from `SkeletonJson.scale`.
- `.planning/spikes/003-end-to-end-fidelity/{fidelity.mjs,README.md}` — world-AABB == s× fidelity
  proof (incl. constraint-driven R_ARM).
- `.planning/seeds/SEED-010-multi-scale-per-resolution-variant-exporter.md` — the lever decision
  (don't scale a bone) + the full diagnosis.

### Authoritative source spec (the bake's ground truth)
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` — 4.3 `* this.scale` reads;
  the authoritative per-field rule (transcribe, do NOT value-diff — value-diffs hide `×1` cases and
  scaled-defaults).
- `node_modules/spine-core-42/dist/SkeletonJson.js` — 4.2 `* this.scale` reads (the alias package).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — BAKE-01..04 (lines 28–31), Traceability rows 70–73.
- `.planning/ROADMAP.md` §"Phase 48" (lines 109–123) — goal, depends-on, the 4 success criteria,
  the 3 TBD plan stubs.

### Existing code the bake/oracle sit beside
- `src/core/loader.ts` — `loadSkeleton(path)` auto-resolves the sibling `.atlas` + picks runtime;
  the oracle test can use it to obtain the atlas for `AtlasAttachmentLoader`.
- `src/core/runtime/runtime.ts` + `src/core/runtime/{runtime-42,runtime-43}.ts` — the SpineRuntime
  facade. The **bake does NOT need it** (pure JSON). The oracle's reference side parses with raw
  `SkeletonJson.scale=s` and may import spine-core directly (tests are allowed to).
- `tests/arch.spec.ts` — the Layer-3 purity gate the new module must stay green under (add the
  bake module to its anchored surface).
- `scripts/register-esm-adapter-resolver.ts` + `tests/setup/esm-adapter-resolver.ts` — the ESM
  resolver seam (relevant only if the oracle test routes through `loadSkeleton`/the facade; vitest
  uses the setupFile, `npm run cli`/tsx uses the register script — verify the oracle's chosen
  entrypoint resolves under vitest, per memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Spike `bake.mjs` (~80 lines):** the validated, deform-corrected transform — promote ~verbatim
  to TypeScript as the `core/` module, adding the D-09 degenerate-`s` guard and the D-10
  assert-known guard.
- **Spike oracle deep-compare (`bake.mjs:96–121`):** cycle-safe `WeakSet` parallel compare with
  the SKIP set + `1e-3` tolerance + `[]`-index path aggregation — promote to the CI oracle test.
- **`loadSkeleton()` (`src/core/loader.ts`):** atlas auto-resolution for the oracle test's
  reference side.
- **Tracked redistributable rigs already in-repo:** `fixtures/spineboy_4.3/spineboy-pro.json`
  (deform + ik-softness-timelines + transform), `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2
  transform+path+physics), `fixtures/SLIDER_4_3/SLIDER-01.json` (slider),
  `fixtures/XTRA01_4_3` (transform) / `fixtures/XTRA02_4_3` (ik).

### Established Patterns
- **Layer-3 purity** (`tests/arch.spec.ts`): held across all prior phases; the bake module must add
  zero DOM/Electron/sharp imports.
- **Typed-error envelope** (`src/core/errors.ts`, discriminated union): the D-10 assert-known guard
  and the D-09 degenerate-`s` guard should follow this established error culture.
- **In-repo fixture convention** (`fixtures/`): tests drive from committed fixtures; gitignored
  fixtures are a known CI-break landmine (memory `feedback_gitignore_fixtures_check_test_refs`).

### Integration Points
- The bake is a **standalone pure module** with no upstream caller this phase (Phase 49 wires it
  into the export pipeline). Its only consumer in Phase 48 is the oracle test.
- The oracle test joins the existing `tests/` vitest matrix and CI surface (must be GREEN on all 3
  OS; remember `release.yml` is a separate gate from `ci.yml`).

</code_context>

<specifics>
## Specific Ideas

- The oracle is **decisive and sampling-free**: equality between `parse(bake(orig,s),1)` and
  `parse(orig, SkeletonJson.scale=s)` means the bake *is* Spine's own scaling expressed on the JSON
  we control. It generates its reference side LIVE (re-parse at `scale=s`) — there are NO
  hand-computed golden values, which is exactly why authored fixtures are low-risk here.
- The fixture matrix the roadmap text named (`DEMON` / `MON_FILES(TEST_01)` / `3Queens` / `Girl`)
  was all gitignored or untracked proprietary data (174M–465M) at discuss time. DEMON + TEST_01 are
  now made public (JSON+atlas only); `3Queens` (57M) and `Girl` (29M) remain private and are NOT
  used — TEST_01 supersedes them as the deform-heavy 4.2 anchor.

</specifics>

<deferred>
## Deferred Ideas

- **Upscaling (`s > 1`) as a user-facing feature** — the bake supports it mathematically (D-09),
  but v1.7 is scaled-down-only; surfacing upscaling would be a future-milestone product decision.
- **Per-attachment override sharing across scales** — already roadmap-deferred to v1.7 Future /
  beyond Phase 49 single-scale; not a Phase 48 concern.
- **`3Queens` / `Girl` proprietary rigs as public fixtures** — not needed once TEST_01 is the 4.2
  anchor; left private. (Revisit only if a future deform/path edge case needs them.)

None — discussion otherwise stayed within phase scope.

</deferred>

---

*Phase: 48-core-scale-bake-module-regression-oracle*
*Context gathered: 2026-05-22*
