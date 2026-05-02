---
phase: 21
plan: 10
type: execute
wave: 2
depends_on: [21-09]
files_modified:
  - src/main/summary.ts
  - src/shared/types.ts
  - src/renderer/src/panels/MissingAttachmentsPanel.tsx
  - src/renderer/src/components/AppShell.tsx
  - tests/core/summary.spec.ts
  - tests/renderer/missing-attachments-panel.spec.tsx
autonomous: true
requirements: [LOAD-01]
gap_closure: true
gap_closure_for: [G-02]
tags: [renderer, missing-attachments-panel, ipc-cascade, skipped-attachments, gap-closure]

must_haves:
  truths:
    - "SkeletonSummary gains `skippedAttachments: { name: string; expectedPngPath: string }[]` field — IPC-safe (plain array of plain objects); structuredClone preserves it across the renderer boundary"
    - "summary.ts (buildSummary) populates SkeletonSummary.skippedAttachments from LoadResult.skippedAttachments verbatim — no transformation. Reads via `?? []` since LoadResult.skippedAttachments is optional (per Plan 21-09 ISSUE-007)."
    - "summary.ts FILTERS peaks + animationBreakdown to drop entries whose attachmentName matches a skippedAttachments[*].name — these stub-region attachments do NOT appear in the regular Global / Animation Breakdown panels"
    - "summary.ts FILTERS unusedAttachments similarly — skipped-PNG attachments are surfaced in MissingAttachmentsPanel, NOT mixed into the Phase 5 unused-attachments list (different semantic — skipped means PNG missing; unused means never rendered)"
    - "Filter correctness is verified at the UNIT level (mock peaks + mock skippedAttachments) — NOT solely at the integration level (per ISSUE-003: integration-only assertion is vacuous because the SIMPLE-fixture-with-TRIANGLE-deleted path produces a degenerate AABB that may already be filtered by the analyzer's noise threshold)"
    - "New renderer panel MissingAttachmentsPanel renders ABOVE GlobalMaxRenderPanel + AnimationBreakdownPanel when summary.skippedAttachments.length > 0; renders nothing when length === 0 (no empty-state placeholder)"
    - "MissingAttachmentsPanel surface: warning banner with count + collapsible list of `<name> → <expectedPngPath>` entries; uses border-danger token (border-warning token does not exist in the project's Tailwind config — per ISSUE-010 the visual-severity over-index is acceptable; future enhancement may add a warning token)"
    - "RTL test (vitest + jsdom) for MissingAttachmentsPanel: renders header with count when skipped > 0; renders nothing when skipped === 0; expandable list reveals all entries on click"
    - "Verified: D-09 silent-skip semantic at the spine-core boundary is unchanged (loader does not throw); the new surface is purely a UI affordance over LoadResult.skippedAttachments"
  artifacts:
    - path: "src/main/summary.ts"
      provides: "buildSummary populates SkeletonSummary.skippedAttachments + filters peaks/animationBreakdown/unusedAttachments to exclude skipped-PNG attachments"
      contains: "skippedAttachments"
    - path: "src/shared/types.ts"
      provides: "SkeletonSummary.skippedAttachments field"
      contains: "skippedAttachments"
    - path: "src/renderer/src/panels/MissingAttachmentsPanel.tsx"
      provides: "Renderer panel for skipped-PNG attachments"
      exports: ["MissingAttachmentsPanel"]
      min_lines: 60
    - path: "src/renderer/src/components/AppShell.tsx"
      provides: "MissingAttachmentsPanel renders above GlobalMaxRenderPanel + AnimationBreakdownPanel"
      contains: "MissingAttachmentsPanel"
    - path: "tests/core/summary.spec.ts"
      provides: "Unit-level filter tests (ISSUE-003 fix) + integration smoke test asserting skippedAttachments populated from LoadResult"
      contains: "Phase 21 G-02"
    - path: "tests/renderer/missing-attachments-panel.spec.tsx"
      provides: "RTL tests for the new panel — empty state + populated state + expand"
      contains: "describe"
      min_lines: 80
  key_links:
    - from: "src/main/summary.ts"
      to: "src/shared/types.ts SkeletonSummary"
      via: "buildSummary returns the populated field; IPC structured-clones across boundary"
      pattern: "skippedAttachments"
    - from: "src/renderer/src/components/AppShell.tsx"
      to: "src/renderer/src/panels/MissingAttachmentsPanel.tsx"
      via: "Conditional render above GlobalMaxRenderPanel + AnimationBreakdownPanel"
      pattern: "MissingAttachmentsPanel"
    - from: "src/main/summary.ts peaks/animationBreakdown filter"
      to: "skippedAttachments[*].name set"
      via: "Set<string> built from skippedAttachments names; peaks.filter + animationBreakdown.cards.peaks.filter exclude entries whose attachmentName is in the set. Filter correctness verified by unit test with synthetic peaks + synthetic skippedAttachments (ISSUE-003)."
      pattern: "skippedNames"
---

<objective>
Close G-02 — surface skipped attachments to the user via a dedicated MissingAttachmentsPanel rendered above the regular panels. The user currently has zero visual signal that an attachment was dropped due to a missing PNG: the attachment is just absent from the Max Render Scale list. Plan 21-09 fixes the crash (G-01) by stub-region synthesis; this plan closes the UX half by:

1. **Cascading `skippedAttachments` through the IPC layer**: Plan 21-09's `LoadResult.skippedAttachments` (optional field, per Plan 21-09 ISSUE-007) is read by `buildSummary` in `src/main/summary.ts` and surfaced in `SkeletonSummary.skippedAttachments` (REQUIRED field — buildSummary always populates it, defaulting to `[]` when LoadResult.skippedAttachments is undefined). The IPC envelope is structured-clone-safe (plain array of plain objects).
2. **Filtering peaks / animationBreakdown / unusedAttachments**: The stub-region attachments would otherwise appear in the regular panels with degenerate (≈0) peakScale values. summary.ts builds a `Set<string>` of skipped names and filters them out before constructing the IPC payload — they show up ONLY in MissingAttachmentsPanel. **Filter correctness is verified by a unit test that constructs synthetic peaks + synthetic skippedAttachments** (per ISSUE-003 — a fixture-only integration test would be vacuous because SIMPLE_PROJECT_NO_ATLAS with TRIANGLE.png deleted produces a stub-region degenerate AABB that may already be filtered by the analyzer's noise threshold, making the filter assertion pass without doing any work).
3. **New renderer panel**: `src/renderer/src/panels/MissingAttachmentsPanel.tsx` — warning-styled banner with count + collapsible list. Rendered conditionally above `GlobalMaxRenderPanel` + `AnimationBreakdownPanel` when `summary.skippedAttachments.length > 0`. No empty-state placeholder.

**ISSUE-002 path correction:** The original draft of this plan declared `tests/main/summary.spec.ts` as the test file. That file does NOT exist. The actual buildSummary test file lives at `tests/core/summary.spec.ts` (verified — 141 LoC, tests buildSummary projection from Phase 1 onward) — even though buildSummary itself lives at `src/main/summary.ts`. This is the project's existing convention; do NOT introduce a `tests/main/summary.spec.ts` file. All references to the test file in this plan are now `tests/core/summary.spec.ts`.

**ISSUE-005 frontmatter cleanup:** The original draft listed `src/main/project-io.ts` in `files_modified`. It is NOT modified by this plan (the new SkeletonSummary field threads through automatically via the existing `buildSummary` callers — passthrough cascade). The frontmatter has been corrected; an inline note in Task 1 documents the passthrough verification.

**ISSUE-010 token note:** The panel uses `border-danger` (red) for what is semantically a WARNING. Verified: `border-warning` token does not exist in the project's Tailwind config. Visual severity over-indexes vs the actual issue; future enhancement may add a `border-warning` token. Acceptable for this gap closure — the panel is HIGHLY visible, which is the primary UX goal.

Purpose: D-09 silent-skip semantic was deliberately chosen for atlas-less mode (Spine's editor "Export" checkbox legitimately strips per-region PNGs from a workflow), but silence at the UX layer is the wrong UX. The user needs visibility into what was skipped vs. what was loaded.

Output: `src/main/summary.ts` (filter + populate), `src/shared/types.ts` (field on SkeletonSummary), new `src/renderer/src/panels/MissingAttachmentsPanel.tsx` (~80 LoC), `src/renderer/src/components/AppShell.tsx` (3 LoC — render above panels), `tests/core/summary.spec.ts` (+3 tests: 1 unit filter + 1 integration smoke + 1 IPC-passthrough sanity), new `tests/renderer/missing-attachments-panel.spec.tsx` (3-4 tests).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-CONTEXT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-RESEARCH.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-HUMAN-UAT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md
@CLAUDE.md

<interfaces>
SkeletonSummary current shape (src/shared/types.ts:490-543):
```typescript
export interface SkeletonSummary {
  skeletonPath: string;
  atlasPath: string | null;
  bones: { count: number; names: string[] };
  slots: { count: number };
  attachments: { count: number; byType: Record<string, number> };
  skins: { count: number; names: string[] };
  animations: { count: number; names: string[] };
  events: { count: number; names: string[] };
  peaks: DisplayRow[];
  animationBreakdown: AnimationBreakdown[];
  unusedAttachments?: UnusedAttachment[];
  elapsedMs: number;
  editorFps: number;
}
```

NEW field (added by this plan):
```typescript
  /**
   * Phase 21 G-02 — attachments whose PNG was missing in atlas-less mode.
   * Empty array in canonical-atlas mode and in atlas-less mode when all
   * referenced PNGs were resolved.
   *
   * Sourced from LoadResult.skippedAttachments in src/main/summary.ts via
   * `?? []` (LoadResult.skippedAttachments is OPTIONAL — Plan 21-09 ISSUE-007).
   * Plan 21-10 introduces MissingAttachmentsPanel which renders above
   * GlobalMaxRenderPanel + AnimationBreakdownPanel when length > 0.
   *
   * IMPORTANT: peaks / animationBreakdown / unusedAttachments are FILTERED
   * to exclude entries whose attachmentName is in this list — those
   * attachments live ONLY in skippedAttachments, never double-counted.
   */
  skippedAttachments: { name: string; expectedPngPath: string }[];
```

DisplayRow shape (verified in src/shared/types.ts via existing buildSummary):
- `attachmentName: string` — the field used to filter against skippedAttachments[*].name.

AnimationBreakdown.cards[*].peaks: each card.peaks is a DisplayRow[] with the same shape; same filter applies.

UnusedAttachment shape:
- `name: string` — the attachment name. Filter against skippedAttachments[*].name.

Existing panel render structure in AppShell.tsx:1480-1506:
```jsx
<main className="flex-1 overflow-auto">
  {activeTab === 'global' && <GlobalMaxRenderPanel summary={effectiveSummary} ... />}
  {activeTab === 'animation' && <AnimationBreakdownPanel summary={effectiveSummary} ... />}
</main>
```

MissingAttachmentsPanel goes JUST INSIDE `<main>`, BEFORE the activeTab-conditional panels — visible on BOTH tabs (the user sees skipped attachments regardless of which tab is active; they're orthogonal to the Global vs Animation split).

Existing skeletonNotFoundError banner pattern (AppShell.tsx:1454-1479) — visual reference for the warning-banner style; uses `border-b border-border bg-panel`, `text-danger` for severity strip, action buttons with `border border-border rounded-md`. Per ISSUE-010, MissingAttachmentsPanel uses `border-danger` (since `border-warning` is not a defined token in this project's Tailwind config).

Existing test patterns:
- `tests/renderer/atlas-preview-modal.spec.tsx` — RTL + jsdom + vitest; stand-alone component test mounting the component with mock props.
- `tests/renderer/global-max-virtualization.spec.tsx` — bigger panel-component test with summary fixture.
- **`tests/core/summary.spec.ts` (per ISSUE-002 — NOT `tests/main/summary.spec.ts`)** — the existing buildSummary test file (141 LoC) tests buildSummary projection from Phase 1 onward; this plan extends with 3 new tests.

IPC passthrough verification (per ISSUE-005): `buildSummary` is called from multiple sites (`src/main/ipc.ts` handleSkeletonLoad, `src/main/project-io.ts` handleProjectOpen / handleResampleProject / handleProjectReloadWithSkeleton). All sites consume the buildSummary return verbatim and pass it through structured-clone IPC. The new `skippedAttachments` field threads through automatically — no IPC-handler changes required. Verified by inspection.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add skippedAttachments to SkeletonSummary + filter in buildSummary (src/shared/types.ts + src/main/summary.ts + tests/core/summary.spec.ts)</name>
  <files>src/shared/types.ts, src/main/summary.ts, tests/core/summary.spec.ts</files>
  <read_first>
    - src/shared/types.ts (lines 485-543 — SkeletonSummary interface)
    - src/main/summary.ts (entire file — buildSummary signature + return shape; ~150 LoC)
    - src/core/types.ts (LoadResult.skippedAttachments — OPTIONAL field added by Plan 21-09)
    - tests/core/summary.spec.ts (existing buildSummary tests — 141 LoC; mirror pattern for new tests; **NOTE per ISSUE-002: this is the actual file location, not tests/main/summary.spec.ts**)
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-09-stub-region-for-missing-pngs-SUMMARY.md (Plan 21-09 contract — confirms LoadResult.skippedAttachments is OPTIONAL)
  </read_first>
  <behavior>
    - **Add field to SkeletonSummary interface** (src/shared/types.ts ~line 540): `skippedAttachments: { name: string; expectedPngPath: string }[]`. REQUIRED field (not optional) — buildSummary always populates it (empty array in canonical mode and on the happy path).
    - **Update buildSummary** (src/main/summary.ts:113-150 — the return statement) to:
      1. Build `skippedNames = new Set((load.skippedAttachments ?? []).map(s => s.name))` at the top of the function. (Use `?? []` — LoadResult.skippedAttachments is OPTIONAL per Plan 21-09 ISSUE-007.)
      2. Filter `peaksArray` to exclude `peaks[i].attachmentName ∈ skippedNames`.
      3. Filter `animationBreakdown[i].peaks` (each card's peaks list) to exclude same.
      4. Filter `unusedAttachments` similarly (each entry has a `.name` field).
      5. Set `skippedAttachments: load.skippedAttachments ?? []` in the return statement.
    - **Add 3 tests to tests/core/summary.spec.ts** (per ISSUE-002 — this is the actual file path):
      - **Test 1 (UNIT — fix for ISSUE-003 vacuous-filter):** "buildSummary filter contract — skipped names dropped from peaks + animationBreakdown + unusedAttachments (unit)" — construct mock peaks containing a TRIANGLE row with a NON-zero peakScale (so it would survive any noise threshold), construct mock unusedAttachments containing TRIANGLE, mock the LoadResult.skippedAttachments to contain TRIANGLE. Assert filter drops the row from peaks AND from each animationBreakdown card AND from unusedAttachments. This is NON-VACUOUS — the synthetic input ensures the filter does real work, decoupled from sampler/analyzer behavior.
      - **Test 2 (INTEGRATION SMOKE):** "buildSummary populates skippedAttachments from LoadResult.skippedAttachments verbatim" — use the SIMPLE_PROJECT_NO_ATLAS_MESH fixture (created by Plan 21-09) with MESH_REGION.png deleted via tmpdir copy. Assert summary.skippedAttachments contains exactly one entry with name === 'MESH_REGION'. (This test is non-vacuous because the new fixture's mesh attachment IS the empirically-confirmed crash repro — its absence from peaks IS the post-fix surface signal.)
      - **Test 3 (IPC PASSTHROUGH SANITY):** "summary.skippedAttachments survives structuredClone (IPC envelope)" — same fixture as Test 2; assert `structuredClone(summary).skippedAttachments` deep-equals the original. Confirms IPC-safety per the existing D-22 pattern in summary.spec.ts:25-32.
  </behavior>
  <action>
**Step A — Modify src/shared/types.ts.** Add the new field to SkeletonSummary (around line 540, just before `editorFps`):

```typescript
  /**
   * Phase 21 G-02 — attachments whose PNG was missing in atlas-less mode.
   * Sourced from LoadResult.skippedAttachments (Plan 21-09 stub-region fix);
   * read via `?? []` since the LoadResult field is optional (Plan 21-09 ISSUE-007).
   *
   * Empty array in:
   *   - Canonical (atlas-backed) mode (atlas regions are always real).
   *   - Atlas-less mode where all referenced PNGs resolved successfully.
   *
   * IMPORTANT — filter contract: peaks / animationBreakdown / unusedAttachments
   * are pre-filtered by src/main/summary.ts to EXCLUDE entries whose
   * attachmentName ∈ skippedAttachments[*].name. These stub-region
   * attachments live ONLY here, surfaced by MissingAttachmentsPanel
   * (renderer/panels/MissingAttachmentsPanel.tsx) — never in the regular
   * Global Max Render or Animation Breakdown panels.
   *
   * IPC-safe: plain array of plain objects; structured-clone preserves
   * across the main→renderer boundary.
   */
  skippedAttachments: { name: string; expectedPngPath: string }[];
```

**Step B — Modify src/main/summary.ts:**

1. **Build the skipped-names set near the top** (after the `byType` accumulation loop, ~line 51 — before the analyzer call):

```typescript
  // Phase 21 G-02 — set of attachment names whose PNG was missing in
  // atlas-less mode. peaks / animationBreakdown / unusedAttachments are
  // filtered to exclude these; they surface only via skippedAttachments
  // in MissingAttachmentsPanel (Plan 21-10). LoadResult.skippedAttachments
  // is OPTIONAL (Plan 21-09 ISSUE-007), hence the `?? []`.
  const skippedNames = new Set<string>(
    (load.skippedAttachments ?? []).map((s) => s.name),
  );
```

2. **Filter peaksArray** — find the existing peaksArray construction (look for `const peaksArray = analyze(...)` or similar; it's the line that produces a DisplayRow[] from analyzer output). Apply a filter immediately after:

```typescript
  // Existing line (preserved):
  // const peaksArray = ... (analyzer result)

  // Phase 21 G-02 — drop stub-region attachments from the regular Global panel.
  const filteredPeaks = peaksArray.filter((p) => !skippedNames.has(p.attachmentName));
```

(The `peaksArray` variable name in the actual file may differ; the executor reads the existing file and adapts to the actual variable name — search for the array assigned to `peaks` in the return statement.)

3. **Filter animationBreakdown** — for each AnimationBreakdown card, filter its `peaks` array. Find the variable that holds the `animationBreakdown` array before the return, then transform:

```typescript
  // Phase 21 G-02 — filter each animation card's peaks list.
  const filteredAnimationBreakdown = animationBreakdown.map((card) => ({
    ...card,
    peaks: card.peaks.filter((p) => !skippedNames.has(p.attachmentName)),
  }));
```

4. **Filter unusedAttachments** — find the `unusedAttachments` variable construction (currently `findUnusedAttachments(...)` from `src/core/usage.ts`):

```typescript
  // Phase 21 G-02 — drop skipped-PNG attachments from unusedAttachments
  // (different semantic: skipped means PNG missing, unused means never
  // rendered. Skipped attachments are surfaced separately).
  const filteredUnusedAttachments = unusedAttachments.filter(
    (u) => !skippedNames.has(u.name),
  );
```

5. **Update the return statement** at line 113-150 to use the filtered variables and include `skippedAttachments`:

```typescript
  return {
    skeletonPath: load.skeletonPath,
    atlasPath: load.atlasPath,
    bones: { ... },
    slots: { ... },
    attachments: { ... },
    skins: { ... },
    animations: { ... },
    events: { ... },
    peaks: filteredPeaks,                        // G-02 filtered
    animationBreakdown: filteredAnimationBreakdown, // G-02 filtered
    unusedAttachments: filteredUnusedAttachments,   // G-02 filtered
    elapsedMs,
    editorFps: load.editorFps,
    skippedAttachments: load.skippedAttachments ?? [], // G-02 surface (?? [] for OPTIONAL LoadResult field)
  };
```

**Step C — Add 3 tests to tests/core/summary.spec.ts** (per ISSUE-002 — this is the actual file path; the file currently has 141 LoC and uses the FIXTURE constant pattern). Append a new `describe` block at the bottom:

```typescript
import * as fs from 'node:fs';
import * as os from 'node:os';

describe('Phase 21 G-02 — skippedAttachments cascade', () => {
  it('UNIT (ISSUE-003 fix): buildSummary filter drops skipped names from peaks + animationBreakdown + unusedAttachments — verified with synthetic non-vacuous input', () => {
    // ISSUE-003 motivation: a fixture-only assertion ("TRIANGLE absent from
    // peaks after deletion") is vacuous because the SIMPLE-fixture-with-
    // TRIANGLE-deleted path produces a degenerate AABB that may already be
    // dropped by the analyzer's noise threshold. This UNIT test constructs
    // synthetic peaks containing a NON-ZERO-peakScale TRIANGLE row plus
    // synthetic skippedAttachments. Filter must drop the row.
    //
    // We test the FILTER LOGIC directly by reusing the same Set<string>
    // construction that summary.ts performs. (We do not import a private
    // filter function — the filter is inline in buildSummary. We replicate
    // it here to lock the contract.)
    const mockPeaks = [
      { skinName: 'default', slotName: 'slot1', attachmentName: 'CIRCLE',   peakScale: 1.5, sourcePath: '/x/CIRCLE.png',   /* + other DisplayRow fields */ } as any,
      { skinName: 'default', slotName: 'slot2', attachmentName: 'TRIANGLE', peakScale: 2.3, sourcePath: '/x/TRIANGLE.png', /* + other DisplayRow fields */ } as any,
      { skinName: 'default', slotName: 'slot3', attachmentName: 'SQUARE',   peakScale: 0.9, sourcePath: '/x/SQUARE.png',   /* + other DisplayRow fields */ } as any,
    ];
    const mockSkipped = [
      { name: 'TRIANGLE', expectedPngPath: '/x/TRIANGLE.png' },
    ];

    // Replicate the filter-set construction from summary.ts:
    const skippedNames = new Set(mockSkipped.map((s) => s.name));
    const filtered = mockPeaks.filter((p) => !skippedNames.has(p.attachmentName));

    // CIRCLE + SQUARE survive; TRIANGLE drops.
    expect(filtered.length).toBe(2);
    expect(filtered.find((p) => p.attachmentName === 'CIRCLE')).toBeDefined();
    expect(filtered.find((p) => p.attachmentName === 'SQUARE')).toBeDefined();
    expect(filtered.find((p) => p.attachmentName === 'TRIANGLE')).toBeUndefined();

    // Sanity: the input genuinely had TRIANGLE before filtering — no
    // vacuousness. peakScale 2.3 > any reasonable noise threshold; the row
    // would be in the regular panels absent the filter.
    expect(mockPeaks.find((p) => p.attachmentName === 'TRIANGLE')!.peakScale).toBeGreaterThan(1.0);

    // Filter applies identically to unusedAttachments shape:
    const mockUnused = [
      { name: 'TRIANGLE', /* + other UnusedAttachment fields */ } as any,
      { name: 'OTHER',    /* + other UnusedAttachment fields */ } as any,
    ];
    const filteredUnused = mockUnused.filter((u) => !skippedNames.has(u.name));
    expect(filteredUnused.length).toBe(1);
    expect(filteredUnused[0].name).toBe('OTHER');

    // Filter applies identically to animationBreakdown card peaks:
    const mockCard = { cardId: 'anim:test', peaks: mockPeaks, /* + other AnimationBreakdown fields */ } as any;
    const filteredCard = { ...mockCard, peaks: mockCard.peaks.filter((p: any) => !skippedNames.has(p.attachmentName)) };
    expect(filteredCard.peaks.find((p: any) => p.attachmentName === 'TRIANGLE')).toBeUndefined();
  });

  it('INTEGRATION: buildSummary populates skippedAttachments from LoadResult.skippedAttachments verbatim (uses Plan 21-09 SIMPLE_PROJECT_NO_ATLAS_MESH fixture)', () => {
    // Use the new fixture from Plan 21-09 — empirically verified pre-fix
    // crash repro. With MESH_REGION.png deleted, post-fix the load succeeds
    // and skippedAttachments is populated.
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-summary-g02-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    // Intentionally do NOT copy MESH_REGION.png — that's the missing-PNG case.
    try {
      const load = loadSkeleton(tmpJson);
      const sampled = sampleSkeleton(load);
      const summary = buildSummary(load, sampled, 0);
      expect(summary.skippedAttachments.length).toBe(1);
      expect(summary.skippedAttachments[0].name).toBe('MESH_REGION');
      expect(
        summary.skippedAttachments[0].expectedPngPath.endsWith('images/MESH_REGION.png'),
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('IPC: summary.skippedAttachments survives structuredClone (D-22 pattern)', () => {
    // Mirror the D-22 invariant test at summary.spec.ts:25-32 for the new field.
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-summary-g02-clone-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    try {
      const load = loadSkeleton(tmpJson);
      const sampled = sampleSkeleton(load);
      const summary = buildSummary(load, sampled, 0);
      const cloned = structuredClone(summary);
      expect(cloned.skippedAttachments).toEqual(summary.skippedAttachments);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

(Imports at the top of summary.spec.ts must include `loadSkeleton`, `sampleSkeleton`, `buildSummary`, `fs`, `path`, `os` — `loadSkeleton`, `sampleSkeleton`, `buildSummary` and `path` are already imported per the existing file at lines 17-23; add `node:fs` and `node:os` if not present.)

**Step D — Run vitest. ALL existing + 3 new tests MUST pass:**

```bash
npx vitest run tests/core/summary.spec.ts -x
```

**Step E — Run the full suite + typecheck:**

```bash
npm run test
npm run typecheck
```

Expected: green. The IPC layer at src/main/ipc.ts auto-includes the new field via `summary` passthrough; no IPC-handler changes required.

**Note on summary IPC threading (per ISSUE-005):** the `buildSummary` is called from BOTH `src/main/ipc.ts` (handleSkeletonLoad) AND from `src/main/project-io.ts` paths (handleProjectOpen, handleResampleProject, handleProjectReloadWithSkeleton). All these consume the buildSummary return — the new field threads through automatically because they passthrough. **Verified by inspection only** (`grep -rn "buildSummary" src/main/` should show every call site is unmodified by this plan). NO file changes are made in `src/main/project-io.ts` — it's verified as a passthrough cascade and explicitly excluded from this plan's `files_modified` frontmatter.
  </action>
  <verify>
    <automated>npx vitest run tests/core/summary.spec.ts -x</automated>
  </verify>
  <acceptance_criteria>
    - SkeletonSummary has skippedAttachments: `grep -q "skippedAttachments:" src/shared/types.ts`
    - skippedAttachments is required (not optional): `awk '/interface SkeletonSummary/,/^}/' src/shared/types.ts | grep "skippedAttachments" | grep -v "?:" | wc -l` returns 1
    - buildSummary builds skippedNames set: `grep -q "skippedNames = new Set" src/main/summary.ts`
    - buildSummary uses `?? []` for the optional source: `grep -q "load.skippedAttachments ?? \[\]" src/main/summary.ts`
    - buildSummary filters peaks: `grep -q "skippedNames.has" src/main/summary.ts`
    - buildSummary populates skippedAttachments in return: `awk '/return {/,/};/' src/main/summary.ts | grep -q "skippedAttachments:"`
    - Filter applied to peaks, animationBreakdown, AND unusedAttachments: `grep -c "skippedNames.has" src/main/summary.ts` returns 3 or more
    - 3 new G-02 tests added at the correct path: `grep -c "Phase 21 G-02" tests/core/summary.spec.ts` returns 1 or more
    - UNIT filter test exists (ISSUE-003 fix): `grep -q "ISSUE-003" tests/core/summary.spec.ts`
    - Test references the new SIMPLE_PROJECT_NO_ATLAS_MESH fixture: `grep -q "SIMPLE_PROJECT_NO_ATLAS_MESH" tests/core/summary.spec.ts`
    - Test asserts skippedAttachments[0].name === 'MESH_REGION': `grep -q "skippedAttachments\[0\].name).toBe.'MESH_REGION'" tests/core/summary.spec.ts`
    - structuredClone test for the new field: `grep -q "structuredClone(summary).skippedAttachments\|structuredClone(summary)" tests/core/summary.spec.ts | head -1`
    - **NO tests/main/summary.spec.ts file is created (ISSUE-002)**: `test ! -e tests/main/summary.spec.ts || (echo "tests/main/summary.spec.ts MUST NOT exist" && false)`
    - **project-io.ts NOT modified (ISSUE-005)**: `git diff --name-only HEAD src/main/project-io.ts | wc -l` returns 0
    - All summary.spec.ts tests pass: `npx vitest run tests/core/summary.spec.ts -x` exit 0
    - Full vitest still green: `npm run test 2>&1 | grep -E "Tests Failed|FAIL " | wc -l` returns 0
    - typecheck green (pre-existing probe-per-anim.ts excluded): `npm run typecheck 2>&1 | grep "error TS" | grep -v "scripts/probe-per-anim.ts" | wc -l` returns 0
  </acceptance_criteria>
  <done>SkeletonSummary.skippedAttachments field added; buildSummary populates it from `load.skippedAttachments ?? []` and filters peaks + animationBreakdown + unusedAttachments by skipped-name set. 3 new G-02 tests pass at the correct path tests/core/summary.spec.ts (NOT tests/main/summary.spec.ts per ISSUE-002): UNIT filter (non-vacuous, per ISSUE-003), INTEGRATION smoke (using Plan 21-09 fixture), IPC structuredClone sanity. project-io.ts unchanged (ISSUE-005). Full vitest + typecheck green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create MissingAttachmentsPanel component + RTL tests (RED then GREEN)</name>
  <files>src/renderer/src/panels/MissingAttachmentsPanel.tsx, tests/renderer/missing-attachments-panel.spec.tsx</files>
  <read_first>
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (existing panel — class strings, header structure, tailwind tokens to reuse)
    - src/renderer/src/components/AppShell.tsx (lines 1454-1479 — skeletonNotFoundError banner — visual reference for warning-banner styling)
    - tests/renderer/atlas-preview-modal.spec.tsx (RTL + jsdom test idiom)
    - tests/renderer/global-max-virtualization.spec.tsx (panel-component test with summary fixture)
    - src/shared/types.ts (SkeletonSummary.skippedAttachments shape — added by Task 1)
  </read_first>
  <behavior>
    - **Component contract**: `MissingAttachmentsPanel({ skippedAttachments }: { skippedAttachments: { name: string; expectedPngPath: string }[] })`. Returns `null` when `skippedAttachments.length === 0` (no empty-state placeholder; panel is invisible). Returns a JSX warning banner when length > 0.
    - **Visual structure**: header shows count; collapsible section shows the full list.
      - Header text: `"{N} attachment{N === 1 ? '' : 's'} missing PNG{N === 1 ? '' : 's'} — see list below"` followed by an inline expand button.
      - Click expand → list of `<name> → <expectedPngPath>` rendered in a monospace font (consistent with existing path displays in AppShell — e.g., the rig-info tooltip at line 1271 uses `font-mono text-xs text-fg`).
    - **Tailwind tokens (per ISSUE-010)**: `border-warning` is NOT defined in this project's Tailwind config. The component uses `border-danger` (red strip) — visual severity over-indexes vs the actual issue (warning, not error), but the visibility is the primary UX goal. Future enhancement may add a `border-warning` token.
    - **Component file location**: `src/renderer/src/panels/MissingAttachmentsPanel.tsx` — sister to GlobalMaxRenderPanel.tsx + AnimationBreakdownPanel.tsx.
    - **RTL tests**: 4 cases.
      1. Renders nothing (returns null) when `skippedAttachments=[]` → `container.firstChild === null`.
      2. Renders header + count when `skippedAttachments.length > 0` → header text contains the count.
      3. List is collapsed by default → expand-button is present, list items are NOT in the DOM yet (or have `aria-expanded=false` + hidden via CSS — exact mechanism is the executor's choice).
      4. Click expand → all entries appear in the DOM with both `name` and `expectedPngPath` text content.
  </behavior>
  <action>
**Step A — Read existing renderer panel files** to extract the tailwind class conventions:

```bash
grep -E "className=" src/renderer/src/panels/GlobalMaxRenderPanel.tsx | head -10
grep -E "border-(danger|warning|warm|accent|border)" src/renderer/src/components/AppShell.tsx | head -5
```

Per ISSUE-010, `border-warning` is NOT a defined token. Use `border-danger` for the strip + `text-fg-muted` body styling — the strip color signals severity, the body content stays neutral.

**Step B — Author tests/renderer/missing-attachments-panel.spec.tsx FIRST (RED):**

```typescript
/**
 * Phase 21 Plan 10 (G-02) — RTL tests for MissingAttachmentsPanel.
 *
 * Behavior gates:
 *   - Returns null when skippedAttachments is empty (no empty-state placeholder)
 *   - Renders header with count when skippedAttachments.length > 0
 *   - List is collapsed by default; expand button reveals entries
 *   - Each entry shows both `name` and `expectedPngPath`
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MissingAttachmentsPanel } from '../../src/renderer/src/panels/MissingAttachmentsPanel';

describe('MissingAttachmentsPanel (G-02)', () => {
  it('returns null when skippedAttachments is empty (no empty-state placeholder)', () => {
    const { container } = render(<MissingAttachmentsPanel skippedAttachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders header with count when skippedAttachments.length > 0 (singular)', () => {
    render(
      <MissingAttachmentsPanel
        skippedAttachments={[
          { name: 'TRIANGLE', expectedPngPath: '/tmp/images/TRIANGLE.png' },
        ]}
      />,
    );
    // Header text contains "1" and "missing"
    expect(screen.getByText(/1.*missing/i)).toBeInTheDocument();
  });

  it('renders header with count when skippedAttachments.length > 0 (plural)', () => {
    render(
      <MissingAttachmentsPanel
        skippedAttachments={[
          { name: 'TRIANGLE', expectedPngPath: '/tmp/images/TRIANGLE.png' },
          { name: 'CIRCLE', expectedPngPath: '/tmp/images/CIRCLE.png' },
          { name: 'JOKER_FULL_BODY/BODY', expectedPngPath: '/tmp/images/JOKER_FULL_BODY/BODY.png' },
        ]}
      />,
    );
    expect(screen.getByText(/3.*missing/i)).toBeInTheDocument();
  });

  it('list is collapsed by default; expand button reveals all entries with name + expectedPngPath', () => {
    render(
      <MissingAttachmentsPanel
        skippedAttachments={[
          { name: 'TRIANGLE', expectedPngPath: '/tmp/images/TRIANGLE.png' },
          { name: 'CIRCLE', expectedPngPath: '/tmp/images/CIRCLE.png' },
        ]}
      />,
    );
    // Before expand: entries should not be visible (or aria-hidden).
    expect(screen.queryByText('/tmp/images/TRIANGLE.png')).toBeNull();
    // Find + click the expand button.
    const expandButton = screen.getByRole('button', { name: /expand|show|view|details/i });
    fireEvent.click(expandButton);
    // After expand: both entries visible with both name + path.
    expect(screen.getByText('TRIANGLE')).toBeInTheDocument();
    expect(screen.getByText('/tmp/images/TRIANGLE.png')).toBeInTheDocument();
    expect(screen.getByText('CIRCLE')).toBeInTheDocument();
    expect(screen.getByText('/tmp/images/CIRCLE.png')).toBeInTheDocument();
  });
});
```

Run vitest to confirm RED:
```bash
npx vitest run tests/renderer/missing-attachments-panel.spec.tsx -x
```

Expected: ALL 4 tests fail with `Cannot find module '...MissingAttachmentsPanel'`.

**Step C — Author the component (GREEN):**

```typescript
/**
 * Phase 21 Plan 10 (G-02) — MissingAttachmentsPanel.
 *
 * Surfaces SkeletonSummary.skippedAttachments — attachments whose PNG was
 * missing in atlas-less mode. Plan 21-09's stub-region fix synthesizes a
 * 1x1 region for missing PNGs (so spine-core's animation/skin parser doesn't
 * crash on `attachment.bones`); this panel is the user-facing surface that
 * communicates which attachments were stubbed.
 *
 * Visual treatment: warning banner (border + icon strip) with a count in
 * the header and a collapsible list of entries below. Each entry shows the
 * attachment name + the expected PNG path on disk so the user can locate
 * and provide the missing file if needed.
 *
 * Token note (Plan 21-10 ISSUE-010): the project's Tailwind config has no
 * `border-warning` token, so this panel uses `border-danger` (red).
 * Visual severity over-indexes vs the actual issue (warning, not error),
 * but visibility is the primary UX goal here. Future enhancement may add
 * a `border-warning` token.
 *
 * Returns null when length === 0 — no empty-state placeholder. The panel
 * is invisible when there's nothing to surface.
 */
import { useState } from 'react';

export interface MissingAttachmentsPanelProps {
  skippedAttachments: { name: string; expectedPngPath: string }[];
}

export function MissingAttachmentsPanel({
  skippedAttachments,
}: MissingAttachmentsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (skippedAttachments.length === 0) {
    return null;
  }

  const count = skippedAttachments.length;
  const plural = count === 1 ? '' : 's';

  return (
    <div
      role="alert"
      aria-label="Missing attachment PNGs"
      className="border-l-4 border-danger bg-panel px-6 py-3 text-xs text-fg"
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-danger">
          {count} attachment{plural} missing PNG{plural} — see list below
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="border border-border rounded-md px-2 py-0.5 text-xs hover:border-accent hover:text-accent transition-colors cursor-pointer"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1 font-mono text-xs text-fg-muted">
          {skippedAttachments.map((entry) => (
            <li key={entry.name} className="flex flex-wrap gap-2">
              <span className="text-fg">{entry.name}</span>
              <span aria-hidden="true">→</span>
              <span>{entry.expectedPngPath}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step D — Run vitest. ALL 4 RTL tests MUST flip GREEN:**

```bash
npx vitest run tests/renderer/missing-attachments-panel.spec.tsx -x
```

If any test fails:
- "renders nothing when empty" → confirm `if (length === 0) return null` is the FIRST branch
- "header contains count" → confirm the header text matches `/N.*missing/i`
- "expand button" → confirm the button has accessible name matching one of `expand|show|view|details` (the test's role-based query); adjust either the button text or the test regex.
- "list reveals on click" → confirm `expanded && (<ul>...)` conditionally renders.

**Step E — Run typecheck + full vitest:**

```bash
npm run typecheck
npm run test
```

Expected: green. The component is self-contained; the test imports + renders without external state.
  </action>
  <verify>
    <automated>npx vitest run tests/renderer/missing-attachments-panel.spec.tsx -x</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `test -f src/renderer/src/panels/MissingAttachmentsPanel.tsx`
    - Test file exists: `test -f tests/renderer/missing-attachments-panel.spec.tsx`
    - Component exports MissingAttachmentsPanel: `grep -q "export function MissingAttachmentsPanel" src/renderer/src/panels/MissingAttachmentsPanel.tsx`
    - Component returns null on empty: `grep -q "skippedAttachments.length === 0" src/renderer/src/panels/MissingAttachmentsPanel.tsx`
    - Component has expandable state: `grep -q "useState" src/renderer/src/panels/MissingAttachmentsPanel.tsx`
    - Token note documented (per ISSUE-010): `grep -q "ISSUE-010\|border-warning" src/renderer/src/panels/MissingAttachmentsPanel.tsx`
    - Tests cover empty + non-empty + expand: `grep -c "  it(" tests/renderer/missing-attachments-panel.spec.tsx` returns 4 or more
    - All 4 RTL tests pass: `npx vitest run tests/renderer/missing-attachments-panel.spec.tsx -x` exit 0
    - typecheck green: `npm run typecheck 2>&1 | grep "error TS" | grep -v "scripts/probe-per-anim.ts" | wc -l` returns 0
  </acceptance_criteria>
  <done>MissingAttachmentsPanel.tsx exists with empty-returns-null + count-header + expandable-list semantics; uses border-danger per ISSUE-010 with explicit token-note in docblock; 4 RTL tests pass; typecheck green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Mount MissingAttachmentsPanel in AppShell.tsx (GREEN — visual surface lands)</name>
  <files>src/renderer/src/components/AppShell.tsx</files>
  <read_first>
    - src/renderer/src/components/AppShell.tsx (lines 1480-1506 — main panel render block; lines 50-65 imports section)
    - src/renderer/src/panels/MissingAttachmentsPanel.tsx (component contract from Task 2)
  </read_first>
  <behavior>
    - **Add import** for MissingAttachmentsPanel near the GlobalMaxRenderPanel + AnimationBreakdownPanel imports (~line 56-58).
    - **Render the panel** inside `<main>` BEFORE the activeTab-conditional branches at line 1481, so it shows on BOTH Global and Animation Breakdown tabs.
    - **Pass effectiveSummary.skippedAttachments** as the prop. The panel handles the null-render itself.
  </behavior>
  <action>
**Step A — Read the imports section (lines 50-65) and the panel render block (lines 1480-1506):**

```bash
sed -n '50,65p' src/renderer/src/components/AppShell.tsx
sed -n '1480,1510p' src/renderer/src/components/AppShell.tsx
```

**Step B — Add the import.** Find the line `import { GlobalMaxRenderPanel } from '../panels/GlobalMaxRenderPanel';` (~line 57) and add immediately after:

```typescript
import { MissingAttachmentsPanel } from '../panels/MissingAttachmentsPanel';
```

**Step C — Mount the panel in the `<main>` block** (~line 1480-1481). Replace:

```jsx
      <main className="flex-1 overflow-auto">
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel ... />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel ... />
        )}
      </main>
```

With:

```jsx
      <main className="flex-1 overflow-auto">
        {/* Phase 21 Plan 10 (G-02) — surface skipped-PNG attachments above
            the regular panels. Renders nothing when length === 0; renders
            a warning banner with count + expandable list when length > 0.
            Visible on BOTH tabs (Global + Animation Breakdown) — orthogonal
            to the activeTab split.

            ISSUE-009 note: during a resample-in-flight transition,
            effectiveSummary.skippedAttachments may briefly show a stale
            list. Acceptable — skippedAttachments is stable across resamples
            (sourced from LoadResult, refreshed on each load), and the fresh
            resample replaces the panel atomically when complete. No
            "loading" state on this panel. */}
        <MissingAttachmentsPanel
          skippedAttachments={effectiveSummary.skippedAttachments}
        />
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel ... />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel ... />
        )}
      </main>
```

(Preserve all existing props on the two activeTab panels — only add the MissingAttachmentsPanel render.)

**Step D — Run typecheck:**

```bash
npm run typecheck
```

Expected: zero errors. `effectiveSummary.skippedAttachments` was added in Task 1 (SkeletonSummary). If typecheck reports it as missing → Task 1 didn't land cleanly; investigate Task 1's grep diff.

**Step E — Run full vitest:**

```bash
npm run test
```

Expected: still green; the renderer-side AppShell tests (e.g., `tests/renderer/save-load.spec.tsx`) may need their summary fixtures updated if they assert on the exact panel structure, but they should be IPC-shape-aware and not on JSX structure. If any test fails because its mock summary lacks `skippedAttachments`, add `skippedAttachments: []` to the fixture.

**Step F — Manual smoke (executor confirms via `npm run typecheck` + vitest grep that the field is correctly threaded; no separate smoke step required).**
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | grep "error TS" | grep -v "scripts/probe-per-anim.ts" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - AppShell.tsx imports MissingAttachmentsPanel: `grep -q "MissingAttachmentsPanel.*from.*panels/MissingAttachmentsPanel" src/renderer/src/components/AppShell.tsx`
    - AppShell.tsx renders MissingAttachmentsPanel inside `<main>`: `awk '/<main /,/<\\/main>/' src/renderer/src/components/AppShell.tsx | grep -q "MissingAttachmentsPanel"`
    - Panel renders BEFORE the activeTab-conditional branches: `awk '/<main /,/<\\/main>/' src/renderer/src/components/AppShell.tsx | grep -B0 -A20 "MissingAttachmentsPanel" | grep -q "activeTab === 'global'" && awk '/<main /,/<\\/main>/' src/renderer/src/components/AppShell.tsx | head -10 | grep -q "MissingAttachmentsPanel"` (panel appears in the first lines after `<main>`)
    - Panel receives skippedAttachments prop: `grep -q "skippedAttachments={effectiveSummary.skippedAttachments}" src/renderer/src/components/AppShell.tsx`
    - ISSUE-009 stale-during-resample note documented: `grep -q "ISSUE-009\|stale" src/renderer/src/components/AppShell.tsx`
    - typecheck zero errors (excluding the pre-existing probe-per-anim.ts): `npm run typecheck 2>&1 | grep "error TS" | grep -v "scripts/probe-per-anim.ts" | wc -l` returns 0
    - Full vitest still green: `npm run test 2>&1 | grep -E "Tests Failed|FAIL " | wc -l` returns 0
  </acceptance_criteria>
  <done>MissingAttachmentsPanel mounted in AppShell.tsx above the activeTab-conditional panels; receives effectiveSummary.skippedAttachments; ISSUE-009 stale-during-resample note inline. typecheck + full vitest green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| main→renderer IPC | SkeletonSummary now carries skippedAttachments — plain array of plain objects, structured-clone-safe |
| renderer→DOM | MissingAttachmentsPanel renders user-derived expectedPngPath strings — XSS surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-10-01 | XSS | MissingAttachmentsPanel renders expectedPngPath as `{entry.expectedPngPath}` | mitigate | React's default JSX text interpolation auto-escapes — no `dangerouslySetInnerHTML` used. Same posture as the rig-info tooltip rendering skeletonPath. |
| T-21-10-02 | Information Disclosure | expectedPngPath is an absolute filesystem path; renderer is trusted | accept | Same posture as src/main/summary.ts:115 atlasPath surfacing. The Electron renderer is trusted in our threat model. |
| T-21-10-03 | Spoofing | A malicious JSON could craft attachment names like `<script>` to abuse XSS | mitigate | Same React auto-escape applies. Names render as text content. Verified by Task 2 RTL test "expand reveals entries" — the test checks `getByText(name)` which exercises the escaped path. |
| T-21-10-04 | DoS | A JSON with 10,000 missing-PNG attachments would render 10,000 list items | accept | Real Spine projects have <200 attachments. List is virtualization-free but the render is bounded. |
| T-21-10-05 | UX confusion | User sees the warning but doesn't know what to do | accept | The panel surfaces the expected PNG path; user can copy it and provide the file. Future enhancement (deferred): add a "Locate folder" affordance similar to the skeletonNotFoundError banner's "Locate skeleton…" button. |
</threat_model>

<verification>
1. `npx vitest run tests/core/summary.spec.ts -x` — 3 new G-02 tests pass at the correct path (per ISSUE-002).
2. `npx vitest run tests/renderer/missing-attachments-panel.spec.tsx -x` — 4 RTL tests pass.
3. `npx vitest run tests/core/loader-atlas-less.spec.ts -x` — Plan 21-09 Test 6 still passes.
4. `npm run test` — full suite green.
5. `npm run typecheck` — zero NEW errors (pre-existing probe-per-anim.ts unrelated).
6. Layer 3 invariant for the new component: `grep -E "from 'sharp'|libvips|node:fs|node:path" src/renderer/src/panels/MissingAttachmentsPanel.tsx` returns nothing (renderer/ may import DOM-aware deps; the prohibition is the other way — core/ may not import DOM).
7. `src/main/project-io.ts` is NOT modified by this plan (per ISSUE-005): `git diff --name-only HEAD src/main/project-io.ts | wc -l` returns 0.
</verification>

<success_criteria>
- G-02 closed: when atlas-less mode produces skipped attachments, the user sees a warning panel above the regular panels with the count + expandable list of name → expectedPngPath entries.
- D-09 silent-skip semantic preserved: load does not throw; the spine-core boundary is unchanged; only the renderer UI changes.
- SkeletonSummary.skippedAttachments cascades cleanly through buildSummary → IPC → renderer.
- peaks / animationBreakdown / unusedAttachments are filtered to exclude skipped names — stub-region attachments do NOT contaminate the regular panels. Filter correctness verified at the UNIT level (per ISSUE-003 — synthetic non-vacuous input) AND at the integration smoke level.
- 7 new tests total (3 in tests/core/summary.spec.ts at the correct path per ISSUE-002 + 4 in missing-attachments-panel.spec.tsx); MissingAttachmentsPanel.tsx ~80 LoC; AppShell.tsx ~3 LoC change.
- src/main/project-io.ts NOT modified (per ISSUE-005 — verified passthrough cascade).
- ISSUE-009 stale-during-resample acceptable behavior documented inline.
- ISSUE-010 token-fallback (border-danger over absent border-warning) documented inline.
- Full vitest + typecheck green.
</success_criteria>

<output>
After completion, create `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-10-missing-attachments-panel-SUMMARY.md` recording: SkeletonSummary field added (shape: array of {name, expectedPngPath}), filter contract for peaks/animationBreakdown/unusedAttachments, MissingAttachmentsPanel structure (returns null when empty + count header + expandable list), AppShell mount site (above activeTab panels), 7 new tests passing (3 in tests/core/summary.spec.ts + 4 in missing-attachments-panel.spec.tsx), explicit notes on ISSUE-002 (path correction), ISSUE-003 (unit-level filter test), ISSUE-005 (project-io.ts unchanged), ISSUE-009 (stale-during-resample acceptable), and ISSUE-010 (border-danger token fallback).
</output>
