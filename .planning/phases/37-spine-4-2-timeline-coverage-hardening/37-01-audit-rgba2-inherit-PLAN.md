---
phase: 37-spine-4-2-timeline-coverage-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md
autonomous: true
requirements: [TIMELINE-01, TIMELINE-02]
requirements_addressed: [TIMELINE-01, TIMELINE-02]

must_haves:
  truths:
    - "Audit doc contains Item 6 (RGBA2Timeline) recording source-cited PASS verdict with Animation.js:951-1030 line citation"
    - "Audit doc contains Item 7 (InheritTimeline) recording the mutation at Animation.js:755 and the readback at Bone.js:144 — TIMELINE-02 conditional-escalation trigger documented as TRIGGERED"
    - "RGBA2Timeline.apply mutates only slot.color / slot.darkColor; no geometry / Bone mutation (per D-01 source-read)"
    - "InheritTimeline.apply mutates Bone.inherit which IS read by Bone.updateWorldTransform via switch(this.inherit) branch at Bone.js:144 (per D-01 source-read)"
    - "D-02: audit-doc trail is preserved — Plan 37-01 still performs the formal source audit and writes findings with explicit line citations to .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md, not from CONTEXT.md discussion notes"
  artifacts:
    - path: ".planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md"
      provides: "Items 6 + 7 appended with source-cited PASS verdicts"
      contains: "### Item 6 — RGBA2Timeline"
  key_links:
    - from: ".planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md (Item 7)"
      to: "node_modules/@esotericsoftware/spine-core/dist/Animation.js:755"
      via: "explicit line citation in verdict bullet"
      pattern: "Animation\\.js:755"
    - from: ".planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md (Item 7)"
      to: "node_modules/@esotericsoftware/spine-core/dist/Bone.js:144"
      via: "readback citation proving bone.inherit is consumed"
      pattern: "Bone\\.js:144"
---

<objective>
Append source-cited PASS findings for RGBA2Timeline (Item 6) and InheritTimeline (Item 7) to the existing Spine 4.2 coverage audit document. Records the formal source-read evidence that:

1. **RGBA2Timeline** writes only to `slot.color` / `slot.darkColor` — no geometry, no Bone mutation, so it is geometry-invariant by construction. (REQ TIMELINE-01)
2. **InheritTimeline** DOES mutate `bone.inherit` at runtime, and that flag IS read by `Bone.updateWorldTransform` — therefore the conditional escalation clause in TIMELINE-02 is TRIGGERED, and the TIMELINE-03 test direction is locked as `peak > baseline` (load-bearing, not precautionary). (REQ TIMELINE-02)

Purpose: Locks the formal audit-trail required by REQ TIMELINE-01/02 before downstream test plans (37-02, 37-03) extend `tests/core/sampler.spec.ts`. CONTEXT.md D-01 pre-resolved the test direction, but the audit doc still needs the source-read findings recorded with line citations per the Items 2/3/4 closure-block precedent.

Output: Two new H3 sections appended to the audit doc body, plus updates to the existing "Items deferred" block and the triage-table rows that reference RGBA2 / InheritTimeline.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-CONTEXT.md
@.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md
@.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md

<interfaces>
<!-- Spine 4.2 source-read targets (read-only; cite line numbers in audit findings). -->
<!-- Executor MUST open each file and confirm the cited lines match the verdicts before writing them. -->

From node_modules/@esotericsoftware/spine-core/dist/Animation.js lines 723-757 (InheritTimeline class):
- Line 755: `bone.inherit = this.frames[Timeline.search(frames, time, 2) + 1];` — the load-bearing mutation
- Class is exported and registered in SkeletonJson.js for the "inherit" timeline-name JSON parse path

From node_modules/@esotericsoftware/spine-core/dist/Animation.js lines 951-1030+ (RGBA2Timeline class):
- Constructor signature: `(frameCount, bezierCount, slotIndex)` at line 953
- apply() writes to `slot.color` (light tint) and `slot.darkColor` (dark tint); no bone.* writes; no geometry writes

From node_modules/@esotericsoftware/spine-core/dist/Bone.js:
- Line 144: `switch (this.inherit) {` — readback site that proves bone.inherit affects updateWorldTransform
- Lines 271, 278, 288, 299 — the per-mode branches (Normal / OnlyTranslation / NoRotationOrReflection / NoScale / NoScaleOrReflection)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify Spine 4.2 source-read evidence and append Items 6 + 7 to the audit doc</name>
  <files>.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md</files>
  <read_first>
    - .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md (read in full — confirm current line numbers of Item 4 verdict line, "Items deferred (unchanged)" header, and the triage-table rows for RGBA2 / InheritTimeline; line numbers may have shifted from those cited in PATTERNS.md if any prior edit touched the doc)
    - node_modules/@esotericsoftware/spine-core/dist/Animation.js (read lines 720-760 — confirm InheritTimeline class definition and the `bone.inherit = this.frames[...]` mutation; record the EXACT line number observed)
    - node_modules/@esotericsoftware/spine-core/dist/Animation.js (read lines 945-1035 — confirm RGBA2Timeline class definition, its constructor signature, and its apply() body; verify it writes ONLY to slot.color / slot.darkColor)
    - node_modules/@esotericsoftware/spine-core/dist/Bone.js (read lines 130-310 — confirm the `switch (this.inherit)` site and the per-mode branches; record the EXACT line numbers observed)
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-PATTERNS.md (re-read section 1 "Pattern Assignments → file 1" for the exact template structure and the substitution table for Items 6 / 7)
  </read_first>
  <action>
**Step A — Read and verify the three source files (Animation.js + Bone.js).** Confirm the line citations in PATTERNS.md match what is currently in `node_modules/@esotericsoftware/spine-core@4.2.111`. If a cited line number shifted by ±5 lines, use the actually-observed line number in the verdict citation. If a cited line number is wildly off OR the cited code is missing OR the cited code DOES NOT match the described mutation (e.g. `bone.inherit` write at Animation.js:755 is not present), STOP and report the discrepancy as a planning blocker — do NOT proceed with the doc edit. (Confidence is high this will not happen per CONTEXT.md D-01, but the verification is mandatory before the audit-doc write since the doc cites these lines as evidence.)

**Step B — Append Item 6 (RGBA2Timeline) and Item 7 (InheritTimeline) to the audit doc.** Use the Edit tool to insert the following two H3 sections in `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md`, placed AFTER the `**Verdict:**` line of Item 4 (currently line 192) and BEFORE the `### Items deferred (unchanged)` header (currently line 194). The exact text to insert (substitute the verified line numbers if any drifted in Step A):

```markdown
### Item 6 — RGBA2Timeline geometry-invariance → PASS (geometry-invariant by construction)

- RGBA2Timeline.apply (Animation.js:951-1030) writes only to `slot.color` (light tint) and `slot.darkColor` (dark tint). Constructor signature is `(frameCount, bezierCount, slotIndex)` at Animation.js:953 — the timeline is slot-scoped, not bone-scoped, and the apply body contains no `bone.*` writes and no geometry/vertex writes.
- Cross-check: `slot.darkColor` is consumed only at GPU/render time. The sampler reads `bone.*` for transforms and `attachment.vertices` (via computeWorldVertices) for geometry — neither code path consults slot color. CLAUDE.md fact #4 (math phase does not decode PNGs) reinforces this: the sampler operates on atlas-metadata bounds + bone transforms only.
- Consequence: slot-color timelines cannot affect peak render scale. Sampler output is byte-identical with or without RGBA2Timeline keyframes on any slot. The TIMELINE-04 synthetic-injection test (37-03) asserts this invariance by strict-deep-equal on `summary.globalPeaks` Map between a baseline run and an RGBA2-injected run on the same animation.
- **Verdict:** PASS. RGBA2Timeline is render-scale-irrelevant by construction. If a future product feature surfaces slot tinting in a preview (e.g. Atlas Preview color rendering), that feature would consume `slot.color` / `slot.darkColor` separately — but render-scale calculation remains unaffected. SEED-005 partially closed by this finding (geometry-invariance half); the test in TIMELINE-04 locks the regression contract.

### Item 7 — InheritTimeline detaches bone.inherit at runtime → PASS (lifecycle already covers)

- InheritTimeline.apply (Animation.js:723-757) mutates `bone.inherit` directly at line 755: `bone.inherit = this.frames[Timeline.search(frames, time, 2) + 1];`. The class is registered in SkeletonJson.js for the per-bone `"inherit"` timeline-name JSON parse path (SkeletonJson.js:711-718).
- Readback site: Bone.js:144 — `switch (this.inherit) {` — drives the world-transform branch in `updateLocalToWorld`. Cross-cited at Bone.js:271 / 278 / 288 / 299 for the per-mode branches (Normal / OnlyTranslation / NoRotationOrReflection / NoScale / NoScaleOrReflection). `bone.inherit` IS read by the world-transform computation; therefore InheritTimeline writes DO propagate into the sampled scale.
- The locked sampler lifecycle (CLAUDE.md fact #3: `state.update → state.apply → skeleton.update → updateWorldTransform(Physics.update)`) inherently covers this case: `state.apply(skeleton)` ticks InheritTimeline and mutates `bone.inherit` at step 2; the subsequent `updateWorldTransform(Physics.update)` at step 4 reads the new flag value and computes the appropriate detached-bone scale.
- **TIMELINE-02 conditional escalation clause TRIGGERED.** Per ROADMAP "if InheritTimeline mutates a Bone field that affects updateWorldTransform, the test MUST assert peak > baseline (load-bearing — real-risk gap fix)." The TIMELINE-03 test (37-02) therefore asserts strict `peak(detached) > peak(baseline)` on a rig where a parent bone shrinks and a child bone toggles `Inherit.NoScale` at the shrink-peak frame.
- **Verdict:** PASS. Sampler lifecycle already covers InheritTimeline correctly by construction. The TIMELINE-03 test (37-02) provides a fixture-driven regression lock. No `src/core/` changes required. If the TIMELINE-03 test fails (peak ≤ baseline at the detached frame), that surfaces a real sampler bug — Phase 37 scope expands to include the fix.
```

**Step C — Update the "Items deferred (unchanged)" block.** Use the Edit tool to replace the existing two-line block (currently lines 194-197) so the Item 5 line reflects closure. Current text:

```markdown
### Items deferred (unchanged)

- Item 1 — Rotated atlas regions → SEED-004 (untouched).
- Item 5 — RGBA2 + InheritTimeline → SEED-005 (untouched).
```

Replace with:

```markdown
### Items deferred (unchanged)

- Item 1 — Rotated atlas regions → SEED-004 (untouched).
- Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37 — see items 6 + 7 above).
```

**Step D — Update the two triage-table rows that reference RGBA2 / InheritTimeline.** Use the Edit tool to flip the Status column from `🟡 Deferred → SEED-005` to `✅ Covered (Phase 37)` for both rows.

Current row (around line 105):

```markdown
| RGBA2Timeline (two-color tinting) | 🟡 Deferred → SEED-005 | render-scale-irrelevant |
```

Replace with:

```markdown
| RGBA2Timeline (two-color tinting) | ✅ Covered (Phase 37) | render-scale-irrelevant; Item 6 PASS |
```

Current row (around line 111):

```markdown
| InheritTimeline (4.0+) | 🟡 Deferred → SEED-005 | spine-ts has it; no fixture |
```

Replace with:

```markdown
| InheritTimeline (4.0+) | ✅ Covered (Phase 37) | bone.inherit mutation covered by lifecycle; Item 7 PASS |
```

**Step E — Do NOT update the doc-level frontmatter.** Lines 1-9 (`---` … `status: closed` … `closed_date: 2026-05-08` … `---`) stay exactly as-is per PATTERNS.md section S5 "Audit-doc append-only edit policy." The doc-level audit task remains closed; Phase 37 only appends follow-up findings.

Per CONTEXT.md D-02: the audit-doc trail is preserved (derives from in-execution source-read with explicit line citations, not from CONTEXT discussion notes).
  </action>
  <verify>
    <automated>grep -q '^### Item 6 — RGBA2Timeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md &amp;&amp; grep -q '^### Item 7 — InheritTimeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md &amp;&amp; grep -q 'closed Phase 37' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md &amp;&amp; grep -q '✅ Covered (Phase 37)' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md &amp;&amp; grep -q 'Animation\.js:755' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md &amp;&amp; grep -q 'Bone\.js:144' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md &amp;&amp; [ $(grep -c '^### Item 6 — RGBA2Timeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md) = "1" ] &amp;&amp; [ $(grep -c '^### Item 7 — InheritTimeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md) = "1" ] &amp;&amp; [ $(grep -c '^status: closed$' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md) = "1" ] &amp;&amp; ! grep -q '🟡 Deferred → SEED-005' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '^### Item 6 — RGBA2Timeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0
    - `grep -q '^### Item 7 — InheritTimeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0
    - `grep -c '^### Item 6 — RGBA2Timeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` outputs exactly `1` (no duplicate insertion)
    - `grep -c '^### Item 7 — InheritTimeline' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` outputs exactly `1` (no duplicate insertion)
    - `grep -q 'Animation\.js:755' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (Item 7 cites the InheritTimeline mutation line)
    - `grep -q 'Animation\.js:951-1030' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (Item 6 cites the RGBA2Timeline class)
    - `grep -q 'Bone\.js:144' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (Item 7 cites the readback site)
    - `grep -q 'closed Phase 37' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (Items-deferred block updated for Item 5)
    - `grep -q '✅ Covered (Phase 37)' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (triage-table rows updated)
    - `grep -c '✅ Covered (Phase 37)' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` outputs at least `2` (both RGBA2 and InheritTimeline triage rows flipped)
    - `! grep -q '🟡 Deferred → SEED-005' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (deferred markers both flipped — no orphans)
    - `grep -c '^status: closed$' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` outputs exactly `1` (frontmatter `status: closed` preserved per PATTERNS.md S5)
    - `grep -q '^closed_date: 2026-05-08$' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0 (original closure date preserved in frontmatter)
    - Each Item 6 and Item 7 H3 block has a `**Verdict:**` line: `grep -A20 '^### Item 6' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md | grep -q '\*\*Verdict:\*\*'` exits 0; same for Item 7
    - Item 7 verdict includes the words "TIMELINE-02 conditional escalation clause TRIGGERED": `grep -q 'TIMELINE-02 conditional escalation clause TRIGGERED' .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exits 0
  </acceptance_criteria>
  <done>
Audit doc contains the two new H3 findings (Items 6 + 7) with verbatim Spine 4.2 source-line citations (Animation.js:755 + 951-1030 + Bone.js:144); the Items-deferred block reflects Item 5 closure ("closed Phase 37 — see items 6 + 7 above"); both triage-table rows flipped from yellow `Deferred → SEED-005` to green `Covered (Phase 37)`; doc-level frontmatter (`status: closed` / `closed_date: 2026-05-08`) preserved unchanged. No `src/core/` changes. Item 7 verdict explicitly records that the TIMELINE-02 conditional-escalation clause is TRIGGERED — locking the TIMELINE-03 test direction for downstream Plan 37-02.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No trust boundaries crossed. This plan modifies a planning audit document only — no production code, no user input, no network, no auth, no data plane.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-37-01 | N/A | .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md | accept | No production surface; threats N/A for audit-doc-only changes. Mitigation: code review covers the audit-doc append (line citations verified against actual Spine 4.2 source in Step A of Task 1). |
</threat_model>

<verification>
1. `grep` gates in `<acceptance_criteria>` confirm Items 6 + 7 added exactly once, line citations present, triage-table rows flipped, deferred markers removed, doc-level frontmatter preserved.
2. Visual inspection of the audit doc confirms Items 6 + 7 follow the Items 2/3/4 format precedent (H3 title with `→ <VERDICT>`, bulleted source-cited evidence, single `**Verdict:**` summary line).
3. The Item 7 verdict explicitly states `TIMELINE-02 conditional escalation clause TRIGGERED` — making the TIMELINE-03 test-direction lock auditable from the doc itself, not just from CONTEXT.md.
</verification>

<success_criteria>
- REQ TIMELINE-01 satisfied: `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` Item 6 records the source-cited PASS verdict for RGBA2Timeline geometry-invariance (Animation.js:951-1030 inspection confirms slot.color / slot.darkColor only).
- REQ TIMELINE-02 satisfied: `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` Item 7 records the source-cited PASS verdict for InheritTimeline (Animation.js:755 mutation + Bone.js:144 readback) and explicitly logs the TIMELINE-02 conditional-escalation clause as TRIGGERED.
- No `src/core/` files touched.
- All `grep`-verifiable conditions in `<acceptance_criteria>` pass.
</success_criteria>

<output>
After completion, create `.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-01-SUMMARY.md` per the standard summary template, capturing:
- Items 6 + 7 verbatim H3 headings + verdicts
- The verified line numbers from Animation.js + Bone.js (in case any drifted from PATTERNS.md's cited values)
- Confirmation that TIMELINE-02 conditional escalation is TRIGGERED — locks `peak > baseline` as the TIMELINE-03 assertion direction for Plan 37-02
</output>
