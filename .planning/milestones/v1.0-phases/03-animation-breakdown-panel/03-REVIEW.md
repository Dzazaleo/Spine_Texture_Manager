---
status: clean
findings_count: 1
blocking: 0
high: 0
medium: 0
low: 0
nit: 1
reviewed_at: 2026-04-23T23:20:00Z
depth: standard
phase: 03-animation-breakdown-panel
---

# Phase 3 — Code Review

**Status:** clean
**Depth:** standard
**Files reviewed:** 11 source + 5 test

## Summary table

| File | Blocking | High | Medium | Low | Nit |
|---|---:|---:|---:|---:|---:|
| `src/core/sampler.ts` | 0 | 0 | 0 | 0 | 0 |
| `src/core/bones.ts` | 0 | 0 | 0 | 0 | 0 |
| `src/core/analyzer.ts` | 0 | 0 | 0 | 0 | 0 |
| `src/shared/types.ts` | 0 | 0 | 0 | 0 | 0 |
| `src/main/summary.ts` | 0 | 0 | 0 | 0 | 0 |
| `src/main/ipc.ts` | 0 | 0 | 0 | 0 | 0 |
| `src/renderer/src/components/AppShell.tsx` | 0 | 0 | 0 | 0 | 0 |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | 0 | 0 | 0 | 0 | 1 |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 0 | 0 | 0 | 0 | 0 |
| `src/renderer/src/App.tsx` | 0 | 0 | 0 | 0 | 0 |
| `scripts/cli.ts` | 0 | 0 | 0 | 0 | 0 |
| **Total** | **0** | **0** | **0** | **0** | **1** |

## Review-focus invariants — all hold

1. **IPC trust boundary (structuredClone):** `BreakdownRow.bonePath: string[]` and `AnimationBreakdown.rows[]` are plain primitives/arrays/objects. No Map or class instances. Runtime `structuredClone` round-trip verified by `tests/core/summary.spec.ts` line 85.
2. **Pure-core invariants (CLAUDE.md #5, N2.3):** `src/core/bones.ts`, `src/core/analyzer.ts`, and `src/core/sampler.ts` contain zero imports from `node:fs`, `node:path`, `sharp`, or DOM globals. Only spine-core types + sibling core modules + shared types.
3. **Locked lifecycle (CLAUDE.md #3):** `sampler.ts:217-222` preserves exact tick order `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)`. `Physics.reset` fires exactly once per (skin, animation) at line 211.
4. **Renderer XSS surface:** `highlightMatch` at `AnimationBreakdownPanel.tsx:123-138` uses React fragments with `<mark>` — no `dangerouslySetInnerHTML`. Bone Path tooltip uses native `title` attribute (safe).
5. **Architectural boundary (Layer 3 core/ ↛ renderer/):** Grep confirms zero renderer imports from `src/core/`. Only `src/shared/types.ts` crosses.
6. **Gap-fix regression (commit `dfbcfa5`):** `analyzeBreakdown` at `analyzer.ts:240-246` groups rows by `rec.animationName` via pre-pass Map, not by key-splitting. Regression test at `tests/core/analyzer.spec.ts:303-345` covers `CHAR/BLINK` and `LOOK/AROUND`.
7. **Performance:** `AnimationBreakdownPanel` uses `useMemo` for `filteredCards`, `originalById`, `effectiveExpanded`. Per-keystroke work is linear O(cards × avg rows), not quadratic.
8. **Ref/state discipline:** `useEffect` timer has `clearTimeout` cleanup in return (line 215). `onFocusConsumed()` called synchronously inside effect body prevents re-mount re-trigger (RESEARCH Pitfall 5 mitigation).
9. **Disabled button semantics:** Override button uses native `disabled` attribute + `title` + `aria-label` — not opacity-only.

## Findings

### IN-01 (nit): Auto-expanded card takes two clicks to collapse during active search

**File:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:173-188`
**Severity:** nit

During an active search, `effectiveExpanded = userExpanded ∪ cardsWithMatches`. If a user tries to collapse a card that is expanded only because it has matches (not in `userExpanded`), `toggleCard` takes the "absent → present" branch and adds it to `userExpanded` — the card visually does not change. A second click removes it from `userExpanded`, but the card stays expanded because it still matches the search.

This matches the design intent ("matched cards that the user collapses during search re-appear expanded until the search clears"), so it's working as specified — but the two-click no-op may surprise users.

**Optional fix:** invert `toggleCard` semantics during active search — when clicked card is in `effectiveExpanded` but not in `userExpanded`, track it in a separate "user-collapsed-during-search" set. Low priority; defer to post-MVP polish.

## Per-file notes

### `src/core/sampler.ts` — clean
- Locked lifecycle preserved (217-222).
- `SamplerOutput` shape returns three maps. `SCALE_DELTA_EPSILON = 1e-6` distinct from `PEAK_EPSILON = 1e-9` (70, 79).
- `AttachmentTimeline` detection uses `instanceof` + `${slotIndex}/${name}` key (194-200). `name !== null` null-guard at 197.
- Pass-1 writes to `setupPosePeaks` gated by non-null (351); Pass-2 passes null, preventing overwrites.
- Determinism anchor: `Physics.reset` once per (skin, animation) before tick loop (211).

### `src/core/bones.ts` — clean
- 39 lines, pure delegation over `slot.bone.parent` chain, reversed for root-first, slot + attachment leaves appended.
- Uses `bone.data.name` (correct BoneData accessor per spine-core 4.2.111).
- Type-only import of `Slot` — zero runtime dependency on spine-core.

### `src/core/analyzer.ts` — clean
- Gap-fix `dfbcfa5` correctly routes rows via `rec.animationName` (242).
- `dedupByAttachmentName` generic over `T extends DisplayRow` — correctly shared between `DisplayRow` (Phase 2) and `BreakdownRow` (Phase 3).
- `toBreakdownRow` defensive fallback `[p.slotName, p.attachmentName]` on missing slot.

### `src/shared/types.ts` — clean
- `BreakdownRow extends DisplayRow` with `bonePath: string[]` + `bonePathLabel: string`. Primitive — structuredClone-safe.
- `AnimationBreakdown` shape: primitives + arrays of primitives. Safe.

### `src/main/summary.ts` — clean
- Materializes `new Skeleton(load.skeletonData)` to source `skeleton.slots` for bone chain traversal (61-67). Necessary and documented — SkeletonData lacks Bone.parent wiring.

### `src/main/ipc.ts` — clean
- Adapted to `SamplerOutput` shape. Input validation preserved (43-52). Typed-error envelope preserved (61-76). Stack-trace suppression (T-01-02-02) maintained.

### `src/renderer/src/components/AppShell.tsx` — clean
- 127 lines, well-structured. `useCallback` with empty deps ensures stable references for child effect dep array.
- WAI-ARIA compliant: `role="tab"`, `role="tablist"`, `aria-selected`.

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — 1 nit (IN-01)
- `highlightMatch` uses React fragments + `<mark>` — XSS-safe.
- `useMemo` for all derived state.
- Timer cleanup in useEffect return.
- Native `disabled` on Override button.
- Synchronous `onFocusConsumed()` inside effect body prevents re-mount leak.

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — clean
- Source Animation chip correctly conditional on `onJumpToAnimation` prop (line 214): `<button>` when present, `<span>` otherwise. Panel remains usable outside the shell.
- `aria-label` on button explains jump destination.

### `src/renderer/src/App.tsx` — clean
- Minimal diff: loaded branch swapped to `<AppShell summary={state.summary} />` (71). Console echo gated on `status === 'loaded'` preserved.

### `scripts/cli.ts` — clean
- Adapts to `SamplerOutput.globalPeaks` (154). Byte-for-byte CLI stdout preserved.

## Status

**clean** — 0 blocking, 0 high, 0 medium, 0 low, 1 nit (optional UX). Phase 3 passes code review. Ready for verify-phase-goal gate.
