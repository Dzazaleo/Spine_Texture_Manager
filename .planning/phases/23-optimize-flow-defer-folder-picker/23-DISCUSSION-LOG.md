# Phase 23: Optimize flow — defer folder picker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 23-optimize-flow-defer-folder-picker
**Areas discussed:** Pre-flight destination display, Start button behavior, lastOutDir lifecycle

---

## Pre-flight destination display

### Q1: What shows in the pre-flight header when no lastOutDir is saved?

| Option | Description | Selected |
|--------|-------------|----------|
| N images (no path) | Just "Optimize Assets — 12 images". Clean. The destination isn't known yet. | ✓ |
| N images → (pick on Start) | Makes the folder step explicit in the title. | |
| N images → suggested path | Pre-suggest skeletonDir as placeholder. | |

**User's choice:** "N images (no path)"

---

### Q2: When lastOutDir IS saved, does the pre-flight header show that path?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show saved path in title | "N images → /saved/path". User sees destination before clicking Start. | ✓ |
| No — still hide it | Always just "N images", consistent regardless of saved state. | |

**User's choice:** Yes — show saved path in title

---

## Start button behavior

### Q1: When lastOutDir is saved and Start is clicked — does OS picker appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Picker every time (pre-filled) | OS picker opens pre-filled at lastOutDir. Explicit confirmation every time. Matches ROADMAP wording. | ✓ |
| Skip picker, use saved path | Goes straight to conflict probe. "Change folder" link as escape hatch. | |

**User's choice:** Picker every time (pre-filled)

---

### Q2: User clicks Start, picker opens, then Cancel in picker — what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in pre-flight | Dialog stays open. User can review plan and try Start again. | ✓ |
| Close the dialog | Cancelling picker dismisses OptimizeDialog. | |

**User's choice:** Stay in pre-flight

---

## lastOutDir lifecycle

### Q1: When does the picked folder get written to .stmproj?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save lastOutDir after export | Silently write .stmproj on export complete (if file exists). No manual Cmd+S needed. | ✓ |
| Save on explicit Cmd+S only | Consistent with existing save behavior. Lost on close without saving. | |

**User's initial response:** Freeform clarification — the user specified the mental model: "By default, app suggests the folder where the JSON is. After picking a different folder once, that path is remembered for this project. New project → back to JSON location as default." This aligned with auto-save as the right choice.

---

### Q2: Does updating lastOutDir affect the dirty-signal?

| Option | Description | Selected |
|--------|-------------|----------|
| No — don't affect dirty signal | Auto-save is silent metadata. Unsaved-changes indicator unchanged. | ✓ |
| Yes — mark project dirty | Picker result requires explicit Cmd+S to persist. | |

**User's choice:** No — don't affect dirty signal

---

## Claude's Discretion

- **`outDir` prop type change** — `OutDir: string | null` in `OptimizeDialogProps`; null until folder confirmed on Start
- **`onClickOptimize` restructure** — picker call moves from toolbar click into `onConfirmStart`
- **Silent save implementation** — `window.api.saveProject` reused in `onRunEnd`; no new IPC channel
- **`buildSessionState` change** — new `lastOutDir` useState slot replaces the hardcoded `null` at AppShell.tsx:638

## Deferred Ideas

- "Change folder" affordance in pre-flight body — not requested; if it surfaces as UX feedback post-ship, small UI addition
- `lastOutDir` dirty-signal inclusion — deferred with `sortColumn`/`sortDir` until a future phase hoists all three together
- OPT-03 atlas-savings metric — Phase 24 scope
