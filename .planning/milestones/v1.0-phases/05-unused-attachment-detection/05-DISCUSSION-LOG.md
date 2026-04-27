# Phase 5: Unused attachment detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 05-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 05-unused-attachment-detection
**Areas discussed:** Used/unused semantics, Reporting granularity, Data pipeline architecture, UI placement & visual treatment

---

## Used/unused semantics (Area 1)

### Q1: Timeline switch-in but alpha=0 always — used or unused?

| Option | Description | Selected |
|--------|-------------|----------|
| Unused (visibility-strict) | Exact F6.1 reading — no alpha>0 tick = unused | |
| Used (intent-based) | AttachmentTimeline key = used regardless of alpha | |
| Used only if timeline ticks with alpha>0 somewhere | Functionally equivalent to visibility-strict | ✓ |

**User's choice:** Used only if timeline ticks with alpha > 0 somewhere.
**Notes:** Effectively the same predicate as "visibility-strict" — sampler at line 290 already enforces this. Produces D-92.

### Q2: Cross-skin — used in skin A, unused in skin B — flag?

| Option | Description | Selected |
|--------|-------------|----------|
| Flag only if unused in ALL skins | Name-level aggregation | ✓ |
| Flag per-skin independently | Finer per-entry granularity | |
| You decide — whichever matches F6.1 literally | Defer to Claude | |

**User's choice:** Flag only if unused in ALL skins.
**Notes:** Matches Phase 2/3/4 dedup. Produces D-93.

### Q3: Setup-pose-only visibility — used?

| Option | Description | Selected |
|--------|-------------|----------|
| Used (roadmap-locked) | Roadmap lock — setup-pose visibility counts | ✓ |
| Unused | Stricter — only animation visibility counts | |

**User's choice:** Used.
**Notes:** Directly from roadmap. Produces D-94.

### Q4: Primary target = ghost-def case?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — exit-criteria ghost-def case | Roadmap exit criterion baseline | ✓ |
| No, different primary target | Alternative failure mode | |

**User's choice:** Yes — exit-criteria case.
**Notes:** Locks the baseline test case. Produces D-95.

---

## Reporting granularity (Area 2)

### Q1: Row granularity in Unused section

| Option | Description | Selected |
|--------|-------------|----------|
| One row per attachment name | Matches dedup pattern | ✓ |
| One row per (skin, slot, attachment) entry | Fine detail, deviates from dedup | |
| Grouped header + sub-rows | Hybrid with disclosure | |

**User's choice:** One row per attachment name.
**Notes:** Consistent with Area 1's name-level aggregation. Produces D-96.

### Q2: Which columns? (user flagged semantic confusion — re-asked after clarification)

**First pass** (rejected as confused — user asked: "if it's unused, how come can it have a skin to display in the row? being present in a skin means that the attachment is actually being used, no?")

Clarification given: `skin.attachments` is a lookup dictionary, not a "what's rendered" list. An attachment can be registered in a skin without being the setup-pose default or being switched in by any AttachmentTimeline. Presence in `skin.attachments` is a prerequisite for being renderable, not evidence of being rendered.

**Second pass (after clarification):**

| Option | Description | Selected |
|--------|-------------|----------|
| Name, Source W×H, "Defined in" (skin list) | Minimum informative + clear label | ✓ |
| Name, Source W×H, "Registered in" (skin list) | Alternative label | |
| Name, Source W×H only | Drop skin column | |
| Name, Source W×H, "Defined in" + Slot(s) | Add slot column | |

**User's choice:** Name, Source W×H, "Defined in" (skin list).
**Notes:** Label "Defined in" chosen deliberately to signal registration-not-rendering. Produces D-97.

---

## Data pipeline architecture (Area 3)

### Q1: Where should the enumeration + diff live?

| Option | Description | Selected |
|--------|-------------|----------|
| New src/core/usage.ts pure module | Single-responsibility new file | ✓ |
| Extend analyzer.ts with analyzeUnused() sibling | Same file as analyze/analyzeBreakdown | |
| Inline in src/main/summary.ts | IPC projection layer | |
| Sampler extension (reopen lock) | Reopen Phase 3 sampler lock | |

**User's choice:** New src/core/usage.ts pure module.
**Notes:** Keeps analyzer focused; keeps sampler LOCKED. Produces D-100.

### Q2: Where does the unused list ship over IPC?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend SkeletonSummary with unusedAttachments[] | Existing IPC payload | ✓ |
| Separate IPC channel | New 'skeleton:unused' channel | |
| Compute renderer-side | Not viable — no skeletonData access | |

**User's choice:** Extend SkeletonSummary.
**Notes:** Matches Phase 3's animationBreakdown[] pattern. Produces D-101.

### Q3: CLI behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-for-byte unchanged | Preserve Phase 2 lock | ✓ |
| Append Unused section at bottom | Breaks golden diff | |
| --unused opt-in flag | Complexity for low value | |

**User's choice:** Byte-for-byte unchanged.
**Notes:** Produces D-102.

### Q4: Multi-skin dim divergence for same name?

| Option | Description | Selected |
|--------|-------------|----------|
| max(W) × max(H) + multi-dim indicator | Conservative + surfaces variance | ✓ |
| First-skin dims + variant count | Deterministic but may hide worst case | |
| Split to per-skin rows when dims differ | Selective granularity | |
| You decide | Defer to Claude | |

**User's choice:** max(W) × max(H) + (N variants) indicator + tooltip breakdown.
**Notes:** Produces D-98.

### Q5: Unused + peak table overlap?

| Option | Description | Selected |
|--------|-------------|----------|
| Only Unused section (disjoint) | Clean split | ✓ |
| Both (badged in peak table) | Double-entry | |
| Only Unused + link back | Same as option 1 effectively | |

**User's choice:** Only in Unused section (disjoint).
**Notes:** Peak table = "things that render"; Unused = "things that don't". Produces D-99.

---

## UI placement & visual treatment (Area 4)

### Q1: Location on Global panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible section BELOW peak table | Natural reading order | |
| Collapsible section ABOVE peak table | Higher visibility | ✓ |
| Separate top-level tab | Hides warning behind click | |
| Right-side sidebar | Biggest layout disruption | |

**User's choice:** ABOVE the peak table.
**Notes:** User went against the recommendation (Recommended was "below"). Higher-priority visibility wins. Produces D-103 (with D-106 confirming layout-shift is the alarm).

### Q2: Warning treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| Orange-accent + warning icon | Reuse existing palette | |
| Yellow/amber warning token | New token, warn semantics | |
| Red 'danger' token | New token, alarm semantics | ✓ |
| Muted/de-emphasized gray | Opposite signal | |

**User's choice:** Red 'danger' token.
**Notes:** User went against the recommendation (Recommended was "orange-accent"). Deliberate break from D-12/D-14 palette lock. Produces D-104.

### Q2b: Red shade? (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Warm/terracotta red | Aligns with warm-stone | ✓ |
| Cool bright red (Tailwind red-500/600) | Standard alarm, clashes with palette | |
| Dark burgundy | Muted, formal | |
| You decide | Defer to Claude | |

**User's choice:** Warm/terracotta red.
**Notes:** Matches warm-stone aesthetic. Suggested hex #c94a3b or equivalent; planner picks exact value. Produces D-104.

### Q2c: Red scope? (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Section header + icon + count only | Alarm on meta, rows scannable | ✓ |
| Header + per-row attachment name | More emphasis | |
| Full red treatment | Alarm fatigue risk | |
| Muted red cells + bright red header | Two-tier | |

**User's choice:** Section header only.
**Notes:** Row cells stay standard `text-fg` / `text-fg-muted`. Produces D-105.

### Q3: Display trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Always rendered; collapsed when zero | Stable layout | |
| Hide entirely when zero | Clean viewport on clean rigs | ✓ |
| Always rendered, always expanded | Wastes space on clean rigs | |

**User's choice:** Hide entirely when zero.
**Notes:** User went against recommendation (Recommended was "always rendered, collapsed when zero"). Reinforced by Q3b — the layout shift IS the alarm signal. Produces D-103.

### Q3b: Layout shift concern? (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Shift is the feature | Alarm signal | ✓ |
| Reserve space even when zero | Revisit hide-when-zero | |
| Shift + inline 'Clean' badge when zero | Compromise | |

**User's choice:** Yes, the shift is the feature.
**Notes:** Confirms D-103 / D-106.

### Q4: Interaction level?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: display-only + inherits search | Zero new interaction | ✓ |
| Full parity: sortable + selectable | Same as peak table | |
| Display-only, isolated from search | Breaks search intuition | |

**User's choice:** Minimal: display-only; inherits SearchBar filter.
**Notes:** Default sort name ASC. No selection, no sort controls. Produces D-107.

---

## Claude's Discretion

- Exact hex for `--color-danger` (warm/terracotta range).
- Warning icon choice (⚠ Unicode vs SVG).
- Section header markup (collapsible `<details>` vs hand-rolled toggle vs non-collapsible).
- Iteration strategy inside `findUnusedAttachments` (spine-core API method lookup).
- Renderer memoization approach.
- Multi-skin dim tooltip format (inline vs multiline).
- Empty-state text when SearchBar filter excludes all unused rows.
- Truncation threshold for long `definedInLabel`.
- Renderer test approach (Testing Library vs happy-dom).
- Exact DOM ordering relative to SearchBar.

## Deferred Ideas

- Phase 6 export behavior (auto-exclude unused from export plan).
- Phase 7 atlas preview interaction with unused attachments.
- Phase 8 persistence of manual collapse state.
- Auto-cleanup / delete-from-rig.
- Batch "mark as intentional" / dismissible state.
- Click-through to Spine editor.
- CLI surface (`--unused` flag or auto-append).
- Per-(skin, slot) granularity view.
- Attachment type column.
- Sort controls / checkbox selection on Unused section.
- Full red treatment per row.
- Animation Breakdown unused display.
- Phase 4 override interaction on unused rows.
- Collapsible section controls.
