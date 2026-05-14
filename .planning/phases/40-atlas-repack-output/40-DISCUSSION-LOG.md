# Phase 40: Atlas Repack Output - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `40-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 40-atlas-repack-output
**Areas discussed:** OptimizeDialog field layout, AtlasPreviewModal integration, main/ worker structure & IPC, Vitest SHA256 fixture strategy

---

## OptimizeDialog field layout

### Radio location

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Output' section above Quality | Bordered card mirroring 'Quality' card pattern; discoverable first; matches visual rhythm | ✓ |
| New 'Output' section below Quality | Same card pattern, placed closer to Export button | |
| Inline radio above Quality, no new card | Flat row with knobs revealed inline; lightest visual weight | |

**User's choice:** New 'Output' section above Quality.
**Notes:** Asked clarifying question "what does loose mean in this context?" — clarified that `loose` = today's per-region PNG pipeline; `atlas` = libgdx `.atlas` + composite pages; `both` = both sets to same directory.

### Atlas knobs visibility when 'loose' selected

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden when loose selected | Knobs only appear when atlas/both is selected; cleanest default state | ✓ |
| Always visible, disabled when loose | Greyed-out using existing `disabled:opacity-50` pattern | |
| Always visible, enabled regardless | Knobs stay editable; values persist but unused in loose mode | |

**User's choice:** Hidden when loose selected.

### atlasMaxPageSize rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Native `<select>` dropdown | 4 options, compact, matches discrete-choice nature | ✓ |
| Segmented radio row | Horizontal pill row; higher discoverability; full row | |
| Number input with validation | Free-text clamped on blur; flexibility at cost of validation surface | |

**User's choice:** Native `<select>` dropdown.

### atlasAllowRotation rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox + inline help text below | Standard checkbox with muted-text caption | |
| Checkbox with hover tooltip | Cleaner default state; tooltip on (?) icon | ✓ |
| Checkbox only, no extra explanation | Bare checkbox; relies on user knowing what rotation means | |

**User's choice:** Checkbox with hover tooltip.

---

## AtlasPreviewModal integration

### Preview behavior when atlas/both selected

| Option | Description | Selected |
|--------|-------------|----------|
| Stays decoupled (current behavior) | Preview shows input atlas geometry only, independent of output mode | ✓ |
| Becomes pre-flight preview of pack-plan output | Renders planned output pack using core/repack.ts | |
| Add mode-aware toggle in the preview | 'View: Input \| Output' toggle in preview | |

**User's choice:** Stays decoupled (current behavior).
**Notes:** Keeps Phase 40 tight. Future phase can wire pack-plan preview if needed.

### Packer-sharing between core/atlas-preview.ts and core/repack.ts

| Option | Description | Selected |
|--------|-------------|----------|
| Stay independent, two callers | Each consumer calls maxrects-packer directly with its own config | |
| Extract a shared packer helper | New core/packer.ts owns the config; both consumers import it | |
| You decide — Claude judgment call | Defer to planner based on duplication signal in REPACK-02 | ✓ |

**User's choice:** You decide — Claude judgment call.
**Notes:** Captured as Claude-discretion item D-02a in CONTEXT.md; planner picks based on actual duplication surface.

---

## main/ worker structure & IPC

### Worker structure

| Option | Description | Selected |
|--------|-------------|----------|
| Extend image-worker.ts with mode branch | Single entry point; file grows to ~1100 lines | |
| Add sibling repack-worker.ts | Two files; cleaner separation; shared resize helper | (Claude pick) |
| Add main/atlas-writer.ts only | Smallest split; composite stays in image-worker; only text writer isolated | |

**User's choice:** "you decide" → Claude proposed **sibling repack-worker.ts + main/atlas-writer.ts** with reasoning (image-worker already 679 lines, atlas mode is fundamentally different stage). User confirmed via follow-up.

### IPC contract

| Option | Description | Selected |
|--------|-------------|----------|
| Extend export:start with mode + atlas args | Continues positional-arg precedent; single channel | (Claude pick) |
| Refactor to single options object | Cleaner long-term; minor renderer refactor | |
| New export:start-repack channel | Strongest separation; doubles IPC surface | |

**User's choice:** "you decide" → Claude proposed **extend export:start** with reasoning (continues `allowOverwrite` / `sharpenEnabled` precedent, keeps preload surface stable). User confirmed.

### Progress reporting

| Option | Description | Selected |
|--------|-------------|----------|
| Two-phase progress field | Additive `phase: 'resize' \| 'composite'` field on ExportProgressEvent | (Claude pick) |
| Unified counter (regions + pages) | Single counter conflates work units of different cost | |
| Per-region during resize, single 'compositing…' at end | Smallest IPC change; risks looking like a hang on large atlases | |

**User's choice:** "You decide" → Claude proposed **two-phase progress field** with reasoning (composite is qualitatively different work, conflating counters misleads). User confirmed.

---

## Vitest SHA256 fixture strategy

### Baseline storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSON sidecar with hashes only | Tiny repo footprint; no byte-level diff on failure | |
| Bytes-in-repo (full PNG + .atlas committed) | Heaviest footprint; real failure diagnostics | |
| Hybrid — hashes + .atlas text only | Diff-able .atlas, hash-only PNGs; matches project's text-in-repo pattern | (Claude pick) |

**User's choice:** "you decide" → Claude proposed **hybrid** with reasoning (.atlas is most diagnostic text artifact; page PNGs at 4096² aren't human-diffable). User confirmed.

### Refresh policy

| Option | Description | Selected |
|--------|-------------|----------|
| Manual script only | `npm run repack:refresh-baselines`; loud test diff on every dep bump | |
| Env-flag auto-refresh on test failure | `UPDATE_FIXTURES=1`; matches vitest snapshot muscle memory | |
| Both — manual script + env flag | Script for bulk; flag for ad-hoc; CI stays loud | (Claude pick) |

**User's choice:** Free-text response: *"i leave the rest of the technicall questions to you. Ask me only wht you really need my input."*
**Notes:** Saved as durable feedback memory (`feedback_delegate_implementation_choices.md`). Claude locked **both — manual script + env flag** as the pragmatic pick.

---

## Claude's Discretion

The user delegated mid-discussion. The following decisions were Claude-locked with stated reasoning and confirmed where the user re-engaged:

- **D-01e** — atlasPadding renders as number input clamped 0..16 px following the `safetyBufferPercent` textbox+unit pattern.
- **D-02a** — Packer-sharing between core/atlas-preview.ts and core/repack.ts deferred further to planner based on actual duplication surface during REPACK-02.
- **D-03** — Sibling `repack-worker.ts` over inline branch in `image-worker.ts` (confirmed by user).
- **D-03a** — Shared resize helper extraction location deferred to planner.
- **D-03b** — Separate `main/atlas-writer.ts` for libgdx text serialization.
- **D-04** — Extend `export:start` IPC channel with positional args (confirmed by user).
- **D-04a** — Rollback list as `Set<string>` of written paths with finally-block cleanup.
- **D-05** — Additive `phase: 'resize' | 'composite'` field on `ExportProgressEvent` (confirmed by user).
- **D-06** — Hybrid SHA storage (JSON sidecar + committed .atlas) (confirmed by user).
- **D-07** — Both manual script + `UPDATE_FIXTURES=1` env flag for baseline refresh.

## Deferred Ideas

- **Pack-plan preview in AtlasPreviewModal** — future phase; explicitly deferred per D-02.
- **`ExportOptions` object refactor** — IPC hygiene cleanup; belongs in its own phase, not Phase 40.
- All boundaries from SPEC.md "Out of scope" section remain deferred (no new additions during this discussion).
