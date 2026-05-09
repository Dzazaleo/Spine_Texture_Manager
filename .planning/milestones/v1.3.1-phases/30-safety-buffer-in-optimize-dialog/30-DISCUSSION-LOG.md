# Phase 30: Safety buffer in Optimize dialog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 30-safety-buffer-in-optimize-dialog
**Areas discussed:** Range & step, Cap-bound feedback, Reactivity, UI placement

---

## Range & Step

### Maximum buffer % the input should accept

| Option | Description | Selected |
|--------|-------------|----------|
| 25% | Tight rail. Animators rarely want >10–15% slack; 25% is a generous ceiling that signals "this is safety, not scale up". Anything beyond hits the source-dim cap on most rows anyway. | ✓ |
| 50% | More headroom. Allows users to express "1.5× just in case" even though most rows will clamp at source. Risk: users might confuse buffer with a generic upscaler. | |
| 100% | Maximum permissive. Cap takes care of correctness regardless. But 100% buffer (= 2× effective scale) is almost never useful and reads like a misuse signal. | |
| 10% | Conservative. Matches typical safety margins (Photoshop-style 5–10%). Less risk of misuse but might frustrate users who want a bigger insurance reserve. | |

**User's choice:** 25%
**Notes:** Recommended option accepted as-is.

### Step size for integer-percent input

| Option | Description | Selected |
|--------|-------------|----------|
| 1% | Fine-grained. Matches `<input type="number" step={1}>` default. Animators can dial in exactly 5%, 7%, 12% if they want. | ✓ |
| 5% | Coarser. Fewer keystrokes for typical 5/10/15/20 values. But forces 7% → 5 or 10. | |
| Hybrid (arrows 5%, typing any int) | Step={5} on input element makes arrow keys jump by 5; typing any integer still works. Cleanest of both worlds but slightly nonstandard. | |

**User's choice:** 1%
**Notes:** Recommended option accepted as-is.

### Default value for projects with no `safetyBuffer` field

| Option | Description | Selected |
|--------|-------------|----------|
| 0% | Locked by REQUIREMENTS.md — missing field defaults to 0% for v1.2/v1.3-era backward-compat. Confirming this also applies to brand-new projects. | ✓ |
| 5% (small starter buffer) | Opinionated default reflecting "most users will want some buffer". But means users who don't notice the control silently get scaled-up exports. | |

**User's choice:** 0%
**Notes:** Confirms backward-compat lock from REQUIREMENTS.md applies to new projects too.

### Allow non-integer values?

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly integer | REQUIREMENTS.md says "integer percent input with small step". `<input type="number" step={1}>` blocks decimals at the input layer. Simple validation, simple persisted shape. | ✓ |
| Allow decimals | Tighter precision (0.5% buffer for sub-pixel control on very large rigs). But adds a validation surface and complicates display formatting. | |

**User's choice:** Strictly integer
**Notes:** Recommended option accepted as-is.

---

## Cap-Bound Feedback

### How OptimizeDialog signals buffer-induced source-dim cap

| Option | Description | Selected |
|--------|-------------|----------|
| Silent | Export plan summary already shows the truth (page count, savings %, capped rows roll into passthrough). No extra UI. Matches Phase 22.1 dims-cap behavior — capping is the contract, not an exception. | ✓ |
| Count badge near the buffer input | E.g., "12 / 47 rows clamped at source dims". Makes the cap visible so users understand why savings % isn't growing linearly with buffer. Adds one more reactive computation. | |
| Per-row indicator | Each capped row shows a small icon/tooltip "clamped at source". More precise but visually busy on rigs with hundreds of rows; the plan list isn't currently per-row visible in OptimizeDialog body. | |

**User's choice:** Silent
**Notes:** Recommended option accepted as-is.

### isCapped vs separate bufferCapped flag

| Option | Description | Selected |
|--------|-------------|----------|
| Expand isCapped to mean "either dims-cap OR buffer-cap" | Simpler conceptually — one flag = "this row hit the source-dim ceiling". But changes Phase 22.1's existing isCapped semantics. | |
| Add a separate `bufferCapped` flag | Keeps isCapped's existing meaning. Adds a parallel signal for the new behavior. Lets future UI surface either independently. Slightly more types churn. | ✓ |
| Don't add either — just clamp silently | Math clamps; nothing surfaces. Simplest. If silent UI wins, this matches. | |

**User's choice:** Add a separate `bufferCapped` flag
**Notes:** Preserves Phase 22.1 invariant. Flag exists for future UI surfacing without changing semantics.

### When buffer===0, no-op or always multiply?

| Option | Description | Selected |
|--------|-------------|----------|
| Literal no-op when buffer===0 | `if (buffer === 0) skip`. Guarantees byte-identical behavior to pre-Phase-30 export for projects that don't touch the buffer. No floating-point drift risk on existing golden tests. | ✓ |
| Always multiply (1 + 0/100 = 1.0) | Single code path; cleaner. But introduces a floating-point op in the hot loop and could perturb existing golden tests if any are sensitive to bit-exact equality. | |

**User's choice:** Literal no-op when buffer===0
**Notes:** Defends existing golden-test bit-exactness.

---

## Reactivity

### When does the export plan summary recompute?

| Option | Description | Selected |
|--------|-------------|----------|
| On every change | Reactive — summary tiles update on every keystroke / arrow click. buildExportPlan runs in-process on renderer; for typical rigs (≤500 rows) it's <50ms. Goal #1 in ROADMAP literally says "export plan summary tiles update reactively as the buffer changes". | ✓ |
| On commit (blur or Enter) | Cheaper if buildExportPlan turns out heavy. But user has to actively commit — less knob-feel. Could feel laggy and broken. | |
| Debounced (~150ms) | Compromise. Reactive feel without thrashing. Adds a debounce hook + cleanup. Worth doing only if perf measurement shows reactive is too slow. | |

**User's choice:** On every change
**Notes:** Aligns with ROADMAP Success Criterion #1.

### Buffer as parameter or post-process?

| Option | Description | Selected |
|--------|-------------|----------|
| Parameter to buildExportPlan | Cleanest — buffer is part of export plan computation, not a separate stage. Threaded through `BuildExportPlanOptions`. Cap math (sourceRatio comparison) still happens inside the function. | ✓ |
| Post-process the ExportPlan after buildExportPlan | Keeps buildExportPlan signature unchanged. But the cap-binding logic gets duplicated outside the function (you'd have to re-derive sourceRatio per row). Risks drift between the two cap evaluations. | |

**User's choice:** Parameter to buildExportPlan
**Notes:** Single source of truth for "outW ≤ sourceW" stays inside buildExportPlan.

### Move buildExportPlan to a worker?

| Option | Description | Selected |
|--------|-------------|----------|
| No — stay on renderer | buildExportPlan is pure TS, no I/O. Even at 1000 rows it should be a few ms. Only revisit if profiling shows jank during reactivity — not preemptively. | ✓ |
| Yes — move to worker | Defensive against future-large-rig jank. But adds a worker hop + IPC, and Spine projects ≤1000 attachments aren't a real perf risk. Premature optimization. | |

**User's choice:** No — stay on renderer
**Notes:** Premature optimization rejected.

---

## UI Placement

### Where in OptimizeDialog the buffer input sits

| Option | Description | Selected |
|--------|-------------|----------|
| Above the sharpen toggle, in a "Quality" group | Groups the two project-level export-quality knobs together. Visual hierarchy: tiles → quality controls → plan list → actions. Buffer is more "output sizing" so above sharpen reads natural. | ✓ |
| Below the sharpen toggle, no group label | Minimal change to existing sharpen-toggle layout (line 421-434). New control just appears below as a sibling. No "Quality" header to write. | |
| Inline with summary tiles | Compact horizontal strip mixing knobs with summary. Risk: reads as "output" rather than "input control"; mixes display + control concerns. | |
| Top of dialog, before summary tiles | Knob at top reinforces "set this first, then read the result". But pushes headline summary tiles down. Heavier visual weight than the feature warrants. | |

**User's choice:** Above the sharpen toggle, in a "Quality" group
**Notes:** Groups buffer + sharpen as the "output quality" cluster.

### Input label

| Option | Description | Selected |
|--------|-------------|----------|
| `Safety buffer:  [N] %` | Matches REQUIREMENTS.md / ROADMAP.md naming ("safety-buffer percentage control"). Self-explanatory; "safety" carries the "insurance" framing. | ✓ |
| `Buffer:  [N] %` | Shorter. Less explicit about purpose. | |
| `Output buffer:  [N] %` | Emphasizes "output dims", not "safety". Slightly more technical. | |
| `Extra headroom:  [N] %` | Plain-English alternative. Reads non-technical. Drifts from canonical "safety buffer" phrasing in docs. | |

**User's choice:** `Safety buffer:  [N] %`
**Notes:** Aligns with canonical docs phrasing.

### Persisted field name

| Option | Description | Selected |
|--------|-------------|----------|
| `safetyBufferPercent` | Mirrors `sharpenOnExport` style — verbose-but-clear, includes unit (`Percent`). Type: `number` (integer-valued). Backward-compat default 0. | ✓ |
| `safetyBuffer` | Shorter. Type/unit ambiguous — reader might not know if it's 0–25 or 0.0–1.0 fraction. | |
| `exportSafetyBuffer` | Disambiguates from any future non-export buffer. But everything in OptimizeDialog is already export-scoped; the prefix is redundant. | |

**User's choice:** `safetyBufferPercent`
**Notes:** Mirrors `sharpenOnExport` precedent for consistency across additive optional fields.

### Tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — short tooltip | E.g. "Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate." One-time read; clarifies cap behavior so silent-clamp isn't surprising. | ✓ |
| No tooltip | Lean UI; the label + summary tiles tell the story. Capping is silent. | |

**User's choice:** Yes — short tooltip
**Notes:** Compensates for silent cap behavior; one-time read for new users.

---

## Claude's Discretion

- Exact "Quality" group header copy ("Quality" / "Output quality" / no label, just spacing).
- Tooltip wording (per OptimizeDialog Phase 19 quantified-callout style).
- Whether the `BuildExportPlanOptions` field is named identically to the `.stmproj` field (planner picks one consistent name across BuildExportPlanOptions, ExportOptions, IPC payload, .stmproj field).
- Where the validation clamp lives (input `onChange` handler vs setter).
- Test fixture choice for the round-trip golden test (likely `fixtures/SIMPLE_PROJECT/` for unit; `fixtures/Chicken-Min/` for the regression spec).

## Deferred Ideas

- Cap-bound UI signal (count badge / per-row indicator) — `bufferCapped` flag exists for future surfacing.
- Sub-1% precision (decimals).
- Sharpen + buffer presets (Conservative / Standard / Aggressive).
- Per-row buffer overrides.
- Web-Worker offload of buildExportPlan.
- Auto-detect "ideal" buffer per-rig.
