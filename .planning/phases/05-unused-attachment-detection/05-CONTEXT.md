---
name: Phase 5 — Unused attachment detection Context
description: Locked decisions for Phase 5 — detect attachments registered in skin.attachments that never render (alpha > 0) across any animation × skin combination, and surface them in a dedicated warning-tinted section above the peak table on the Global panel. Ships src/core/usage.ts (pure-TS enumeration + diff), SkeletonSummary extension with unusedAttachments[], new --color-danger @theme token (warm/terracotta red), and a display-only Unused section with SearchBar inheritance.
phase: 5
---

# Phase 5: Unused attachment detection — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 5` interactive session

<domain>
## Phase Boundary

Phase 5 introduces **unused-attachment detection** (F6) — the app flags attachments registered in `skin.attachments` that never render (active slot with alpha > 0) across any animation × skin combination, including setup-pose passes. Ships `src/core/usage.ts` (pure-TS enumeration + defined∖used diff), extends `SkeletonSummary` with `unusedAttachments: UnusedAttachment[]` on the existing IPC surface, introduces a new `--color-danger` warm/terracotta `@theme` token (first palette expansion since Phase 1's D-12/D-14 lock — acknowledged deliberate break), and adds a collapsible warning-tinted section ABOVE the peak table on `GlobalMaxRenderPanel`. The sampler stays LOCKED. CLI stays byte-for-byte unchanged. The Animation Breakdown panel is untouched (unused attachments have no animation to break down).

**In scope:**
- `src/core/usage.ts` — **new pure-TS module**. Exports `findUnusedAttachments(load: LoadResult, sampler: SamplerOutput): UnusedAttachment[]`. Enumerates `load.skeletonData.skins[*].attachments` to build the "defined set" keyed by attachment name (aggregating per-skin dims + skin-origin lists). Derives the "used set" from `sampler.globalPeaks` keys (which already encode alpha > 0 visibility — sampler filters at snapshotFrame: slot.color.a > 0). Returns entries whose attachment name appears in the defined set but NOT in the used set. No React, no DOM. Unit-tested via vitest against SIMPLE_TEST.json plus a purpose-built ghost-def fixture variant.
- `src/shared/types.ts` — **extension target**. Add `UnusedAttachment` interface with: `attachmentName: string`, `sourceW: number`, `sourceH: number` (max across skins), `definedIn: string[]` (skin names where registered), `dimVariantCount: number` (1 when all registrations share dims, ≥2 when dims diverge), `sourceLabel: string` (preformatted — e.g., `"256×256"` or `"256×256 (2 variants)"` per D-98), `definedInLabel: string` (preformatted comma-list). Add `unusedAttachments: UnusedAttachment[]` field to `SkeletonSummary`. Follows Phase 2 D-35 pattern of preformatted labels + raw numbers.
- `src/main/summary.ts` — **touched**. Call `findUnusedAttachments(load, samplerOutput)` after the existing `analyze()` + `analyzeBreakdown()` calls. Pass the result through into the `SkeletonSummary` payload. No business logic inside summary.ts — it remains a projection layer per Phase 2 D-35.
- `src/renderer/src/index.css` (or wherever `@theme inline` lives) — **touched**. Add `--color-danger: <hex>` token matching warm/terracotta palette (planner picks exact hex — see Claude's Discretion). Tailwind v4 `@theme` emits `text-danger` / `bg-danger` / `border-danger` utilities.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — **touched**. Add a new `<section>` rendered ABOVE the existing peak table, conditionally (only when `unusedAttachments.length > 0`). Section has:
  - Collapsible header: warning icon (⚠ glyph or SVG) + count + label (e.g., `"⚠ 3 unused attachments"`) in `text-danger`.
  - Body: compact `<table>` with 3 columns — Attachment, Source Size, Defined In.
  - Row cells render in standard text colors (`text-fg` / `text-fg-muted`) — red scope is header-only per D-105.
  - Inherits the existing Phase 2 SearchBar filter (case-insensitive substring on `attachmentName`). When the filter excludes all unused rows AND the peak table also empties, the existing zero-results message handles the empty state.
  - Default sort: attachmentName ASC (matches Phase 4 D-91's "don't lose the just-edited row" UX principle, applied consistently).
- `src/renderer/src/components/AppShell.tsx` — **read-only for this phase**. AppShell already passes `summary` to panels; no new state, no new callbacks. Phase 4's `overrides` map is orthogonal: unused attachments don't appear in the peak table, so the override dialog never fires for them — but `overrides.has(unusedName)` is allowed (no-op effectively) in case a user somehow reaches the state via selection.
- Tests:
  - `tests/core/usage.spec.ts` — **new**. Cases: (a) SIMPLE_TEST.json has zero unused (baseline); (b) a modified fixture with a synthetic "GHOST" attachment registered in one skin but never rendered returns one unused row; (c) cross-skin — attachment registered in 2 skins, visible in skin A only → NOT flagged; (d) cross-skin dim divergence — attachment unused in 2 skins with different sourceW/sourceH → max-dims selected + `dimVariantCount === 2`; (e) AttachmentTimeline switches in but slot alpha = 0 for full duration → flagged as unused (visibility-strict per D-92); (f) AttachmentTimeline switches in + alpha > 0 for ≥ 1 tick → NOT flagged.
  - `tests/main/summary.spec.ts` — extend: `summary.unusedAttachments` field exists, is array, correct shape on SIMPLE_TEST.json (expected empty array).
  - `tests/arch.spec.ts` — Layer 3 auto-scans new files (`usage.ts`, the new panel section) for `src/core/*` boundary violations. No new arch entries needed; existing grep patterns pick them up.
  - Renderer section test — planner's call; consistent with Phase 3/4's Testing Library vs happy-dom decision.

**Out of scope (deferred to later phases):**
- **Phase 6 export behavior for unused attachments** — Phase 6 decides whether unused attachments are auto-excluded from the export plan. Phase 5 just makes the list available. Default assumption: Phase 6 excludes them (no point shipping textures that never render), but Phase 6 owns that call.
- **Phase 8 persistence of section collapse state** — default render is "expanded when non-empty, hidden when empty" per D-103. Whether the user's manual collapse state persists across sessions is a Phase 8 concern.
- **Auto-cleanup / delete-from-rig action** — Phase 5 is detection-only. Removing attachments from the rig is a Spine-editor operation; we don't modify source `.json`.
- **Batch "mark as intentional" / dismiss** — no user-override of the flag. Unused is computed purely from the sampler output; if the animator intentionally keeps a dead attachment, they dismiss it in their editor, not in this app.
- **Click-through to Spine editor** — no IPC to Spine; users find the attachment by name in their editor manually.
- **Per-(skin, slot) granularity view** — rejected per D-96 (one row per attachment name).
- **Attachment type column (Region/Mesh/etc.)** — rejected per D-97 (minimum informative set).
- **Sort controls on Unused section** — rejected per D-107 (display-only).
- **Checkbox selection on Unused section** — rejected per D-107; no batch action exists for unused rows.
- **CLI output of unused list** — CLI stays byte-for-byte unchanged per D-102.
- **Animation Breakdown unused display** — unused attachments have no animation context; the Animation Breakdown panel stays untouched.
- **Phase 4 override interaction** — unused rows don't appear in the peak table, so the Scale-cell double-click doesn't reach them. Override dialog never fires for unused attachments. No special handling needed.
- **Collapse state when section is non-empty** — default expanded. Manual collapse is allowed but state is session-only (not persisted — Phase 8 concern if ever).

</domain>

<decisions>
## Implementation Decisions

### Used/unused semantics (Area 1)

- **D-92: "Used" = attachment rendered with `slot.color.a > 0` at ≥ 1 sampled tick.** Covers both the global-peaks path (any animation tick where the attachment was visible) and the setup-pose path (setup-pose pass recorded a peak because the slot default had alpha > 0). Equivalent to "attachment name appears as a key component in `sampler.globalPeaks`". The sampler already encodes this predicate at `src/core/sampler.ts:290` ("Canonical visibility: alpha 0 slots are invisible at runtime") — Phase 5 reads the existing output, does not duplicate the predicate. Rejected alternatives: intent-based ("AttachmentTimeline key = used regardless of alpha") — would silently tolerate "animator forgot to bump alpha" bugs that this feature is meant to catch; per-tick check independent of visibility — already what the sampler does.
- **D-93: Cross-skin aggregation = flag only if unused in ALL skins** (name-level aggregation). If attachment "HEAD" is visible in skin A but registered-without-rendering in skin B, it is NOT flagged. Matches the name-level aggregation from Phase 2/3/4 ("one texture = one row"). Matches F6.1's literal reading ("never rendered in any animation in any skin"). Rationale: the texture ships to the atlas if any skin renders it, so "used somewhere" is sufficient. Per-skin granularity rejected — would surface per-skin QA issues that are out of scope for Phase 5's export-right-sizing framing. The `definedIn[]` column still surfaces per-skin registration info so the animator can locate dead entries.
- **D-94: Setup-pose visibility counts as used.** Roadmap locks this explicitly ("Default setup-pose visibility counts as 'used'"). The sampler's setup-pose pass already records peaks for these; they appear in `sampler.globalPeaks` with `isSetupPosePeak: true`. Nothing extra to implement — the D-92 predicate covers it.
- **D-95: Primary target = "ghost-def" case** — attachment registered in `skin.attachments` but never set as the setup-pose default for any slot AND never switched in by any AttachmentTimeline with alpha > 0. Matches roadmap exit criterion: "Add a throwaway attachment to a test skin never referenced by any animation → app flags it." This is the dominant production failure mode and the baseline test case.

### Reporting granularity (Area 2)

- **D-96: Row granularity = one row per unique attachment NAME.** Matches Phase 2/3/4 dedup. Per-(skin, slot, attachment) granularity rejected — would deviate from the project's dedup pattern and introduce UI density issues. If "DEAD_ARM" is registered in 3 skins and unused in all, one row appears with a `definedIn: ["default", "boy", "girl"]` list rendered as a comma-separated cell label.
- **D-97: Columns = Attachment name, Source W×H, "Defined in" (skin list).** Minimum informative set. Label "Defined in" chosen deliberately over "Skin(s)" to make the Spine data model explicit: the attachment is *registered* in the skin's attachment dictionary but never *rendered* in that skin. Rejected additions: Slot column (reintroduces per-entry density), Attachment type (low signal — unused attachments are almost always Region/Mesh).

- **D-98: Multi-skin dim divergence → show max(W) × max(H) + "(N variants)" indicator.** When the same attachment name is registered in 2+ skins with DIFFERENT source dimensions (e.g., "HEAD" 128×128 in "boy", 256×256 in "girl", both unused), the single displayed row shows the larger dims and appends a variant-count indicator when variants > 1. Preformatted `sourceLabel` = `"256×256"` when variantCount === 1, `"256×256 (2 variants)"` when variantCount > 1. Tooltip on the row shows the full per-skin breakdown. Rationale: the max answer to "what would shipping this cost?" is the conservative assumption. Also: rigs rarely have dim-divergent same-named attachments across skins — this is a rare edge case — so the variant indicator surfaces it rather than silently hiding.

- **D-99: Unused and peak table are DISJOINT.** Unused attachments NEVER appear in the peak table (Global panel's main table). Peak table = "things that render"; Unused section = "things that don't". Rendering an unused attachment in the peak table would mean zeroed-or-empty Peak W×H / Scale / Source Animation cells — pure noise. The SearchBar still filters both sections unified per D-107. Double-entry bookkeeping (showing in both with a badge) explicitly rejected.

### Data pipeline architecture (Area 3)

- **D-100: New `src/core/usage.ts` pure-TS module.** Exports `findUnusedAttachments(load: LoadResult, sampler: SamplerOutput): UnusedAttachment[]`. Enumerates `load.skeletonData.skins[*].attachments` using spine-core's iteration helpers (planner: check whether `skin.attachments` is directly iterable via `Object.entries` or requires `Skin#getAttachments()` — spine-core 4.2 API). Builds a `Map<attachmentName, { sourceDims: Set<"${w}x${h}">, definedIn: string[] }>`. Subtracts the name-set derived from `sampler.globalPeaks` keys. Returns remaining entries. No `spine-core` DOM dependency; pure math + object iteration. Layer 3 arch.spec.ts enforces `src/core/*` DOM-free invariant. Alternative approaches rejected: analyzer.ts extension (analyzer.ts would grow to 3 concerns — keep single-responsibility); inline in summary.ts (breaks Phase 2 D-35 projection-only boundary); sampler extension (reopens Phase 3 sampler lock unnecessarily — downstream pure-TS suffices).

- **D-101: IPC shape = extend `SkeletonSummary` with `unusedAttachments: UnusedAttachment[]`.** One IPC payload, one structuredClone, one summary surface. Matches Phase 3's extension pattern (`animationBreakdown[]`). Renderer reads `summary.unusedAttachments` alongside `summary.peaks` and `summary.animationBreakdown`. Rejected alternatives: separate `'skeleton:unused'` IPC channel (adds roundtrip for data already computed in the same sampler run — "sample twice" anti-pattern); renderer-side computation (renderer has no `skeletonData` access).

- **D-102: CLI stays byte-for-byte unchanged.** `scripts/cli.ts` has been byte-for-byte locked since Phase 2 gap-fix. It is the read-only derisk tool, not a QA reporter. Adding an Unused section would break the golden diff and force cascading test updates. Phase 5 is a renderer-only feature per F6.2. Rejected alternatives: append an Unused section at bottom (breaks the lock); `--unused` opt-in flag (complexity for minimal payoff).

- **D-103 [data-UX bridge]: Section lives ABOVE the peak table on the Global panel; hidden entirely when `unusedAttachments.length === 0`; rendered (auto-expanded) when non-zero.** No reserved header on clean rigs. When unused count > 0, the section appears and pushes the peak table down — the layout shift IS the alarm signal. Default expanded; user can manually collapse (session-only state — no Phase 8 persistence). Rejected alternatives: below table (lower visibility for the warning); separate top-level tab (hides the warning behind a click); sidebar (layout disruption); always-render-with-empty-header (wastes viewport on clean rigs).

### UI placement & visual treatment (Area 4)

- **D-104: NEW `--color-danger` `@theme` token, warm/terracotta red.** First palette expansion since Phase 1's D-12/D-14 warm-stone + orange-accent lock. Deliberate break, acknowledged: unused-attachment detection is a QA/warning surface distinct from Phase 4's "user-modified" orange-accent semantics — conflating them would mute both. Token kind: single `--color-danger` hex variable added to the `@theme inline` block in `src/renderer/src/index.css` (or wherever Phase 1 put it). Shade guidance: warm/terracotta (e.g., `#c94a3b` or equivalent) to stay in the warm-stone palette family rather than Tailwind's cool `red-500`. Planner picks exact hex — see Claude's Discretion. Tailwind v4 emits `text-danger` / `bg-danger` / `border-danger` utilities from the `@theme` block.

- **D-105: Red scope = section header + warning icon + count only.** The section header renders `⚠` (or equivalent SVG) + `"N unused attachment(s)"` + optional collapse toggle, all in `text-danger`. Row cells (attachment name, source W×H, defined-in list) render in standard `text-fg` / `text-fg-muted`. Rationale: keep the alarm on the meta-info; rows stay scannable without turning the section into a red wall when the count is large. Rejected alternatives: red per-row name cell (visual noise at high counts); full red treatment (alarm fatigue); two-tier muted-vs-bright red (unnecessary complexity for a section that's usually empty or small).

- **D-106: Layout shift on dirty rigs IS the alarm signal.** When a rig produces unused attachments, the section appears above the peak table and pushes content down. No layout stability concern — skeleton drop always re-measures the viewport anyway. Rejected alternatives: reserve space even when zero (wastes real estate on clean rigs); show a "Clean ✓" chip elsewhere (adds a visual element the rest of the UI doesn't have).

- **D-107: Interaction = display-only list.** No sort controls (default sort `attachmentName ASC`, matches Phase 4 D-91's "stable ordering" principle). No checkboxes. No row hover actions (other than the tooltip from D-98 for multi-skin breakdowns). The section INHERITS the existing Phase 2 SearchBar filter — when user types "HEAD" in the global search, both the peak table AND the unused section filter by name. Rationale: the unused section is a QA notification, not an editable surface. Its only actionable step is "go to your Spine editor and delete this". Full-parity interactivity (sortable columns + selection) rejected — selection without a batch action is pointless and Phase 5 defines no batch action. Search isolation rejected — when an animator searches a name, they expect to see every instance.

### Claude's Discretion (not locked)

- **Exact hex for `--color-danger`.** D-104 constrains it to the warm/terracotta family matching the warm-stone aesthetic. Suggested starting point: `#c94a3b` (warm red) or `#b84a3a` (slightly muted). Planner picks; verify against the live dialog + badge styling from Phase 4 to ensure no visual clash. Must pass WCAG AA contrast on the panel background.
- **Warning icon glyph.** Unicode `⚠` (U+26A0) vs inline SVG. Phase 2/3/4 have used Unicode characters (`×`, `•`, `→`) without importing an icon library per D-28. Suggest Unicode `⚠` for consistency; SVG acceptable if the Unicode renders poorly in the JetBrains Mono font family. No new icon dependency.
- **Section header markup.** Details button / `<summary>`/`<details>` native element / hand-rolled toggle — all acceptable. Follow warm-stone token styling; keep keyboard-operable.
- **Collapse toggle affordance.** If D-103 "user can manually collapse" is implemented, the caret icon placement + ARIA labeling is planner's call. Alternatively, the section could be non-collapsible (always expanded when non-empty) — simpler, drops a stateful bit. Default recommendation: non-collapsible in Phase 5; add collapse in a later polish phase if requested.
- **Inside `findUnusedAttachments`, iteration strategy.** `for (const skin of load.skeletonData.skins)` then walk `skin.attachments` via spine-core's public API. Planner verifies the exact method name on spine-core 4.2's `Skin` class (`getAttachments()` vs direct property access). No duplication of the sampler's skin iteration loop — this is a single pass over `skins[*].attachments`.
- **How `unusedAttachments` is memoized in the renderer.** `useMemo` on `summary.unusedAttachments` (stable reference from IPC, so trivial), or just read directly from props. Planner picks.
- **Exact tooltip format for multi-skin breakdown (D-98).** `"128×128 in boy; 256×256 in girl"` vs `"boy: 128×128\ngirl: 256×256"` (multiline). Planner picks; consistent with Phase 2 D-35 preformatted label philosophy.
- **Empty-state interaction with the SearchBar.** When the search filter excludes all unused rows (but peak table still has matches), the unused section shows zero rows. Should it render "No unused matches" inside the section, or just collapse? Suggest: render empty body text `(no matches)` to confirm the filter is working but keep the section chrome visible. Planner decides.
- **Whether the "Defined in" cell shows full skin list or truncates with tooltip.** For rigs with many skins (5+), the comma-list gets long. Suggest truncate to 3 + "…and 2 more" with tooltip when > 5 skins. Planner picks a threshold.
- **Renderer test approach.** Phase 2/3/4 left this open; Phase 5 inherits the same question. Core `usage.spec.ts` is pure-TS in vitest regardless.
- **Section ordering relative to filename chip + search bar.** AppShell already owns the top chrome (filename chip + tab buttons per Phase 3 D-49/D-50). Unused section is inside GlobalMaxRenderPanel (not AppShell) — above the peak table, below the SearchBar. Planner verifies the exact DOM order.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Phase 6 — Unused attachment detection" (approved-plan numbering = roadmap Phase 5 due to the derisk-phase offset). Canonical narrative for the ghost-def detection case and the visual-warning panel section.

### Project instructions
- `CLAUDE.md` — rule #5 (`core/` pure TS, no DOM) locks `src/core/usage.ts` as DOM-free. Rule #3 (locked tick lifecycle) untouched — Phase 5 introduces no sampler changes. Rule #2 (computeWorldVertices is the authority on visibility) — relevant because "alpha > 0" visibility is already enforced inside the sampler at `snapshotFrame` (src/core/sampler.ts line 290).

### Requirements
- `.planning/REQUIREMENTS.md` §F6 — the two locked requirements:
  - F6.1 "Flag attachments defined in skins that are never rendered (active slot with non-zero alpha) in any animation in any skin." → D-92 (visibility-strict), D-93 (flag only if unused in ALL skins), D-94 (setup-pose counts), D-95 (ghost-def primary target).
  - F6.2 "Surface as its own panel section." → D-103 (section above peak table on Global panel), D-104–D-106 (warning treatment), D-107 (display-only interaction).
- `.planning/ROADMAP.md` §"Phase 5: Unused attachment detection" — deliverables (analyzer flag + dedicated section on Global panel) and exit criteria ("Add a throwaway attachment to a test skin never referenced by any animation → app flags it") → D-95 locks this as the primary target.

### Phase 0/1/2/3/4 artifacts (Phase 5 consumers + extension targets)
- `src/core/sampler.ts` — **LOCKED**. Phase 5 READS `SamplerOutput.globalPeaks` keys to derive the "used set". Visibility predicate at line 290 (`slot.color.a > 0`) is the authority for "rendered" (D-92). No sampler changes.
- `src/core/loader.ts` — Phase 5 reads `LoadResult.skeletonData.skins[*].attachments` to enumerate the "defined set" inside `src/core/usage.ts`. No loader changes.
- `src/core/analyzer.ts` — Reference pattern for pure-TS analyzer modules (named exports, no `spine-core` imports, DOM-free). `src/core/usage.ts` follows the same shape. Analyzer stays focused on rows; usage module owns the unused-detection concern.
- `src/shared/types.ts` — **extension target**. Add `UnusedAttachment` interface + extend `SkeletonSummary` with `unusedAttachments: UnusedAttachment[]`. All fields primitive / structuredClone-safe (Phase 1 D-21 compliance).
- `src/main/summary.ts` — **touched**. Call `findUnusedAttachments(load, samplerOutput)` after `analyze()` + `analyzeBreakdown()`. Summary remains a projection layer (no business logic — Phase 2 D-35).
- `src/main/ipc.ts` — unchanged; same IPC handler, larger payload.
- `src/renderer/src/components/AppShell.tsx` — **read-only for Phase 5**. Already passes `summary` to panels; no new state, no new callbacks.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — **touched**. Add Unused `<section>` rendered conditionally above the peak table. Inherits existing SearchBar filter. Red scope per D-105.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — **unchanged**. Unused attachments have no animation context.
- `src/renderer/src/components/SearchBar.tsx` — **read-only**. Unused section reads the same `searchQuery` state that GlobalMaxRenderPanel already consumes (filter is applied in the panel's render-time filter pipeline, not inside SearchBar).
- `src/renderer/src/index.css` (or the `@theme inline` location from Phase 1 D-12/D-14) — **touched**. Add `--color-danger` warm/terracotta hex per D-104.
- `scripts/cli.ts` — **unchanged**. Byte-for-byte locked per D-102. Unused is a renderer-only surface.
- `tests/arch.spec.ts` — auto-scans new `src/core/usage.ts` + panel section for `src/core` boundary violations. No new arch entries needed.
- `.planning/phases/00-core-math-spike/00-CONTEXT.md` §"CLI Contract (locked)" — D-102 reaffirms. §"Sampler Contract (locked)" — D-100 reaffirms (no sampler reopening).
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md` — D-11..D-27 carry. Especially D-12 / D-14 (warm-stone + orange-accent lock) which Phase 5 DELIBERATELY BREAKS with `--color-danger` per D-104. Acknowledged in the decision text.
- `.planning/phases/02-global-max-render-source-panel/02-CONTEXT.md` — D-28..D-48 carry. Especially:
  - **D-28** (hand-rolled over deps) — unused section hand-rolled; no icon library, no Radix.
  - **D-35** (preformatted labels + raw numbers) — `UnusedAttachment` follows the same pattern (raw `sourceW/H` + preformatted `sourceLabel` + `definedInLabel`).
  - **D-37** (search filter shape) — D-107 inherits the same filter-by-substring-on-name predicate.
  - **D-45 / D-46** (size label format `64×64`) — reused for `sourceLabel` in unused rows. `toFixed(0)` whole-pixel.
  - **D-47** (font-mono everywhere) — unused rows render in font-mono.
- `.planning/phases/03-animation-breakdown-panel/03-CONTEXT.md` — D-49..D-72 carry. Especially:
  - **D-49 / D-50** (AppShell top chrome — filename chip, tab buttons, state pattern) — unchanged. Unused section lives inside GlobalMaxRenderPanel, not AppShell.
  - **D-56** (dedup by attachmentName) — D-96 follows the same aggregation unit.
  - **D-58** (card ordering) — not applicable to unused section (flat list, not cards).
  - Extension pattern: SkeletonSummary extended with `animationBreakdown[]` → D-101 follows the same pattern for `unusedAttachments[]`.
- `.planning/phases/04-scale-overrides/04-CONTEXT.md` — D-73..D-91 carry. Especially:
  - **D-74** (AppShell useState pattern) — Phase 5 adds no new AppShell state; summary flows through props.
  - **D-82..D-84** (orange-accent for "user-modified") — D-104 explicitly distinguishes `--color-danger` from `--color-accent` to avoid semantic conflation.
  - **D-91** (attachmentName not attachmentKey at outbound contracts) — Phase 5 operates entirely on attachmentName per D-96; no attachmentKey plumbing.
  - **Sort-by-name default** — D-107 adopts `attachmentName ASC` for consistency with D-91's Global panel default.

### spine-core API reference (for researcher / planner)
- `@esotericsoftware/spine-core` 4.2.111 — `Skin` class exposes `attachments` (or `getAttachments()` — planner verifies the exact shape in `node_modules/@esotericsoftware/spine-core/dist/Skin.d.ts`). The sampler already iterates `load.skeletonData.skins` at line 164; Phase 5's `usage.ts` uses the same `skeletonData.skins` access pattern but walks the `attachments` per-skin rather than iterating visible slots.
- No `computeWorldVertices` / AABB / transform logic in Phase 5 — pure enumeration + Set arithmetic.

### External
- None. Phase 5 is entirely contained within the project — no new third-party libraries, no new web APIs, no accessibility pattern beyond what Phase 4's dialog already handles.

### Fixtures (Phase 5 drop + verify targets)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — baseline. Expected: zero unused attachments (CIRCLE, SQUARE, SQUARE2, TRIANGLE are all rendered in at least one animation or setup pose). Section does NOT render.
- **New test fixture needed**: a modified SIMPLE_PROJECT variant or an inline vitest-only synthetic skeleton with:
  - A "GHOST" region attachment registered in one skin's attachments map but never set as a slot default AND never referenced by any AttachmentTimeline.
  - Expected behavior: `findUnusedAttachments` returns `[{ attachmentName: 'GHOST', ... }]`.
  - Planner decides whether to fork a new JSON fixture or construct the skeleton in-memory for the spec.
- `fixtures/Jokerman/` + `fixtures/Girl/` — human-verify targets. If either fixture has naturally-unused attachments, they'll surface at drop time. If not, the synthetic GHOST fixture validates the code path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/core/analyzer.ts`** — template for pure-TS modules in `core/`: named exports, JSDoc with D-# citations, no imports from `@esotericsoftware/spine-core` except where needed for the data (Phase 5's `usage.ts` doesn't even need spine-core types — it consumes `LoadResult` + `SamplerOutput` which already flatten the spine-core types into our own shape).
- **`src/core/sampler.ts:164`** — the canonical iteration pattern for `load.skeletonData.skins`. `usage.ts` follows the same `for (const skin of load.skeletonData.skins)` loop but walks `skin.attachments` instead of visible slots.
- **`src/core/sampler.ts:290`** — the visibility predicate (`slot.color.a > 0`) that D-92 inherits. Do NOT duplicate this check — Phase 5 reads the sampler's already-filtered `globalPeaks` keys.
- **`src/shared/types.ts`** — `SkeletonSummary` extension pattern (Phase 3 added `animationBreakdown`; Phase 5 adds `unusedAttachments` in the same style).
- **`src/main/summary.ts`** — extension pattern for plumbing new analyzer outputs through IPC without introducing business logic in the projection layer.
- **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** — host for the new Unused section. Existing structure (filename chip in AppShell, SearchBar top, peak table below) is preserved; unused section inserts between SearchBar and peak table.
- **Tailwind `@theme inline` block** in the Phase 1 CSS — extension point for `--color-danger`. Adds exactly one variable.

### Established Patterns (from Phase 0/1/2/3/4)
- **Hand-rolled over deps** — section is hand-rolled `<section>` + plain `<table>`. No icon library.
- **Preformatted labels + raw numbers** — `UnusedAttachment` has `sourceW` + `sourceH` (raw) and `sourceLabel` + `definedInLabel` (preformatted).
- **Three-layer `core/` ↛ `renderer/` defense** — `src/core/usage.ts` stays DOM-free. Layer 3 arch.spec.ts auto-scans.
- **Grep-literal-in-comments compliance** — `usage.ts` + new section markup must avoid literal tokens that trip arch.spec.ts grep gates. Phase 1/2/3/4 all hit this; Phase 5 planner pre-emptively writes prose over forbidden-literal tokens.
- **Atomic commits per logical unit** — use `feat(05-unused):`, `refactor(05-unused):`, `fix(05-unused):`. Mirror Phase 4's `feat(04-overrides):` style.
- **Extension pattern: `SkeletonSummary`** — Phase 3 proved this out with `animationBreakdown`. Phase 5 follows the same pattern for `unusedAttachments`.
- **Human-verify-is-load-bearing** — Phase 5 ships with a `checkpoint:human-verify` on the final plan. Interactive checks: SIMPLE_TEST.json drops with zero unused (section not rendered); GHOST synthetic fixture renders the section with the correct row; SearchBar filters both sections; red treatment is header-only; no regression in peak table rendering.

### Integration Points
- **`src/main/summary.ts` ↔ `src/core/usage.ts`** — summary calls `findUnusedAttachments(load, samplerOutput)` and inserts result into `SkeletonSummary.unusedAttachments`. Single call site.
- **IPC boundary** — `SkeletonSummary` payload grows by one field. Renderer reads `summary.unusedAttachments` directly off the props chain from `App.tsx` → `AppShell` → `GlobalMaxRenderPanel`.
- **`GlobalMaxRenderPanel` ↔ Unused section** — the panel owns the section as a child component (or inline `<section>`, planner's call). Same `searchQuery` prop flows through; the panel filters both peak table AND unused rows by the same predicate.
- **`index.css` ↔ Tailwind v4** — one `--color-danger` token addition. Tailwind auto-emits `text-danger` / `bg-danger` / `border-danger` utilities. The build pipeline is unchanged.

### Constraints from Phase 0/1/2/3/4
- `core/` stays DOM-free (CLAUDE.md #5). `usage.ts` is pure iteration + Set arithmetic.
- Sampler stays LOCKED (D-100 explicit).
- CLI stays byte-for-byte unchanged (D-102 explicit).
- N2.3 zero filesystem I/O — unaffected; `usage.ts` does no I/O.
- D-23 no `process.platform` branches — unaffected.
- Phase 1/2 Electron runtime caveats preserved: main bundle stays CJS, preload stays CJS. Phase 5 does not touch `electron.vite.config.ts` or `src/main/index.ts`.
- Phase 3's SkeletonSummary extension pattern — D-101 follows.
- Phase 4's sort-by-name default (D-91) — D-107 follows.

</code_context>

<specifics>
## Specific Ideas

### `UnusedAttachment` interface shape (seeded for planner)

```ts
// src/shared/types.ts — additions

/**
 * Phase 5 Plan 01 — A single attachment flagged as unused.
 *
 * An attachment is "unused" if its name appears in at least one
 * skin.attachments map in skeletonData.skins but the sampler's
 * globalPeaks contains no entry with that attachment name — i.e.,
 * it never rendered with slot.color.a > 0 at any sampled tick,
 * in any animation, in any skin, nor as a setup-pose default.
 *
 * Keyed by attachmentName per D-96 (name-level aggregation).
 * sourceW/H are MAX across all skins where the name is registered
 * per D-98. definedIn lists every skin name where the attachment
 * is registered (the skin.attachments map contains it), regardless
 * of whether it was the setup-pose default in that skin.
 *
 * All fields primitive / structuredClone-safe (D-21 compliance).
 * Preformatted labels per D-35.
 */
export interface UnusedAttachment {
  /** Primary identifier — unique across the returned array (D-96). */
  attachmentName: string;
  /** Max source width across all registering skins (D-98). */
  sourceW: number;
  /** Max source height across all registering skins (D-98). */
  sourceH: number;
  /** Names of every skin whose attachments map contains this name. */
  definedIn: string[];
  /** 1 if all registrations share dims, 2+ if any diverge (D-98). */
  dimVariantCount: number;
  /** Preformatted e.g. "256×256" or "256×256 (2 variants)" (D-98 + D-35). */
  sourceLabel: string;
  /** Preformatted comma-list e.g. "default, boy, girl". */
  definedInLabel: string;
}

// Extend existing SkeletonSummary (Phase 3 pattern):
export interface SkeletonSummary {
  // ... existing fields ...
  /** Phase 5: attachments registered in skins but never rendered (D-92 / D-101). */
  unusedAttachments: UnusedAttachment[];
  // ... existing fields ...
}
```

### `src/core/usage.ts` shape (seeded for planner)

```ts
// src/core/usage.ts — pure-TS, DOM-free, no @esotericsoftware/spine-core imports needed
// if LoadResult + SamplerOutput already flatten the spine-core types.

import type { LoadResult } from './types.js';
import type { SamplerOutput } from './sampler.js';
import type { UnusedAttachment } from '../shared/types.js';

/**
 * Phase 5 Plan 01 — Detect attachments registered in skin.attachments but
 * never rendered at any sampled tick with alpha > 0.
 *
 * Algorithm (D-92 / D-93 / D-100):
 *   1. Enumerate every (skinName, slotName, attachmentName) registered in
 *      load.skeletonData.skins[*].attachments, recording per-name:
 *      sourceDims (from attachment), definedIn (skin names).
 *   2. Build a Set<attachmentName> from sampler.globalPeaks keys
 *      (key format is `${skinName}/${slotName}/${attachmentName}`; split
 *      on "/" and take the last segment — or walk the value's
 *      `attachmentName` field, whichever is cleaner).
 *   3. For each defined attachmentName NOT in the used set, aggregate per
 *      D-96 / D-98 into a single UnusedAttachment row.
 *   4. Sort result by attachmentName ASC (D-107 + Phase 4 D-91 parity).
 *
 * Returns empty array when no unused attachments found.
 */
export function findUnusedAttachments(
  load: LoadResult,
  sampler: SamplerOutput,
): UnusedAttachment[] {
  // ... planner implements ...
}
```

### Global panel section markup sketch (seeded for planner)

```tsx
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx (additions)

// Above the existing peak table, below SearchBar:

const filteredUnused = unusedAttachments.filter(
  (u) => searchQuery === '' || u.attachmentName.toLowerCase().includes(searchQuery.toLowerCase()),
);

{filteredUnused.length > 0 && (
  <section className="border-b border-border mb-4">
    <header className="flex items-center gap-2 py-2 text-danger font-mono text-sm">
      <span aria-hidden>⚠</span>
      <span>{filteredUnused.length} unused attachment{filteredUnused.length === 1 ? '' : 's'}</span>
    </header>
    <table className="w-full font-mono text-xs">
      <thead className="text-fg-muted">
        <tr>
          <th className="text-left py-1">Attachment</th>
          <th className="text-left py-1">Source Size</th>
          <th className="text-left py-1">Defined In</th>
        </tr>
      </thead>
      <tbody>
        {filteredUnused.map((u) => (
          <tr key={u.attachmentName} title={/* planner: multi-skin dim tooltip per D-98 */}>
            <td className="py-1 text-fg">{u.attachmentName}</td>
            <td className="py-1 text-fg-muted">{u.sourceLabel}</td>
            <td className="py-1 text-fg-muted">{u.definedInLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}
```

### `@theme inline` token addition (seeded for planner)

```css
/* src/renderer/src/index.css (or the existing Phase 1 @theme block) */

@theme inline {
  /* ... existing warm-stone + orange-accent tokens from D-12/D-14 ... */

  /* Phase 5 D-104 — warn/terracotta for unused attachment warning surface */
  --color-danger: #c94a3b;
}
```

### Expected SIMPLE_TEST.json human-verify flow

1. Drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.
2. On the Global panel: peak table renders 3 rows (CIRCLE, SQUARE, TRIANGLE — SQUARE2 deduped into SQUARE per Phase 2 gap-fix B) as today. Unused section does NOT render (baseline: zero unused).
3. On the Animation Breakdown panel: unchanged from Phase 4.
4. CLI: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → same output as before (byte-for-byte).

### Expected GHOST-fixture human-verify flow

Planner authors a synthetic fixture (e.g., `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json`) or an in-memory test skeleton that registers a `"GHOST"` region attachment in the `default` skin's attachments map without assigning it as a slot default and without any AttachmentTimeline referencing it.

1. Drop the GHOST fixture.
2. Global panel renders the peak table (CIRCLE/SQUARE/TRIANGLE or equivalent) as before.
3. ABOVE the peak table, a warm/terracotta-red header appears: `⚠ 1 unused attachment`.
4. One row renders below the header: `GHOST | 64×64 | default` (or whatever dims + skins are used in the fixture).
5. Row cells render in standard `text-fg` / `text-fg-muted`, NOT red. Only the header is red.
6. Type "GHO" in the SearchBar — both the peak table (empty if no matches) and the unused section (one match) filter consistently.
7. Clear the search — unused section re-renders the single row.
8. Load SIMPLE_TEST.json instead — unused section disappears entirely.

### Reference screenshot
The approved plan's "screenshot 1" (Global Max Render Source panel) shows the base layout. Phase 5 inserts the new `<section>` between the SearchBar and the existing `<table>`, rendered only when non-empty. No approved-plan screenshot for the unused section exists — planner designs the header + compact table within the existing warm-stone aesthetic.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 6 export behavior for unused attachments.** Phase 6 decides whether `src/core/export.ts` excludes unused attachments from the export plan (probable default: exclude — no point shipping textures that never render). Phase 5 surfaces the data; Phase 6 consumes it.
- **Phase 8 persistence of manual section collapse state.** D-103 defaults to expanded when non-empty; if a user manually collapses the section, Phase 8 could preserve that preference across sessions. Not in Phase 5 scope.
- **Phase 7 atlas preview interaction.** If Phase 7's before/after atlas visualization wants to mark unused attachments visually, it reads `summary.unusedAttachments` from the same IPC surface. Not in Phase 5 scope.
- **Auto-cleanup / delete-from-rig action.** Phase 5 is detection-only. The rig's JSON source lives in the user's Spine editor project; we do not modify source files. Cleanup is a user action in Spine.
- **Batch "mark as intentional" / dismissible state.** No user override of the flag. If the animator intentionally keeps a dead attachment, they resolve it in their editor, not in this app.
- **Click-through from unused row to Spine editor.** No IPC to Spine; not feasible.
- **CLI surface of unused list (`--unused` flag or auto-append section).** Rejected per D-102 — CLI stays byte-for-byte unchanged.
- **Per-(skin, slot) granularity table view.** Rejected per D-96.
- **Attachment type column (Region/Mesh/etc.).** Rejected per D-97 — low signal for unused attachments.
- **Sort controls on the Unused section.** Rejected per D-107 — default sort by name ASC is sufficient for a typically-small section.
- **Checkbox selection on Unused section.** Rejected per D-107 — no batch action exists.
- **Full red treatment per row.** Rejected per D-105 — alarm fatigue / visual noise.
- **Animation Breakdown unused display.** Out of scope — unused attachments have no animation context.
- **Phase 4 override interaction on unused rows.** No-op by construction — unused rows don't appear in the peak table, so the Scale-cell override trigger never fires for them.
- **Collapsible section by default.** Planner's call under Claude's Discretion — default recommendation is non-collapsible in Phase 5, add collapse controls as a Phase 9 polish if requested.
- **Auto-expanded-on-drop state preservation.** Section appears auto-expanded every drop — no cross-drop memory. Consistent with Phase 3's collapse-state-resets-on-drop pattern (D-50 / D-64).

### Reviewed Todos (not folded)
- None. No pending todos matched Phase 5 scope.

</deferred>

---

*Phase: 05-unused-attachment-detection*
*Context gathered: 2026-04-24 via `/gsd-discuss-phase 5`*
