---
phase: 03-animation-breakdown-panel
verified_at: 2026-04-23T23:25:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
requirements:
  F4.1: passed
  F4.2: passed
  F4.3: passed
  F4.4: passed
re_verification: null
---

# Phase 3: Animation Breakdown Panel — Verification Report

**Phase Goal (from ROADMAP.md line 92-105):** Build the second user-facing panel that breaks down per-animation what attachments each animation touches, their peak render scale, and the Bone Path. Ship collapsible per-animation cards, a "Setup Pose (Default)" top card, per-row Bone Path plus source → scale → peak → frame, and per-row "Override Scale" button (disabled stub in this phase per D-69; wired in Phase 4).

**Verified:** 2026-04-23T23:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | F4.1: Collapsible per-animation cards with unique asset count / "No assets referenced" | VERIFIED | `analyzeBreakdown` emits one card per animation with `uniqueAssetCount` field + empty `rows: []` (analyzer.ts:247-258). Renderer renders header `{name} — {N} unique assets referenced` or `— No assets referenced` with caret toggle (AnimationBreakdownPanel.tsx:278-286). `aria-expanded` + `role="region"` collapsible mechanics (lines 300-301, 310). |
| 2 | F4.2: "Setup Pose (Default)" shown as its own top card | VERIFIED | Setup Pose card is `cards[0]` with `cardId: 'setup-pose'`, `animationName: 'Setup Pose (Default)'`, `isSetupPose: true`, populated from `setupPosePeaks` Pass-1-only map (analyzer.ts:220-233). Initial userExpanded seeded with `new Set(['setup-pose'])` so it's expanded by default (AnimationBreakdownPanel.tsx:150-152). |
| 3 | F4.3: Per-row Bone Path + source → scale → peak → frame | VERIFIED | 7-column table headers `Attachment / Bone Path / Source W×H / Scale / Peak W×H / Frame / Actions` (AnimationBreakdownPanel.tsx:349-386). Bone Path rendered via `truncateMidEllipsis` + `title` tooltip full chain (398-403). Row cells use preformatted `originalSizeLabel` / `scaleLabel` / `peakSizeLabel` / `frameLabel` from analyzer (404-415). `boneChainPath` walks `slot.bone.parent` chain in `src/core/bones.ts:25-38`. |
| 4 | F4.4: Per-row "Override Scale" button (DISABLED stub per D-69 — Phase 4 wires dialog) | VERIFIED | Native `disabled` attribute + `title="Coming in Phase 4"` + `aria-label="Override Scale (disabled until Phase 4)"` + `opacity-50 cursor-not-allowed` (AnimationBreakdownPanel.tsx:421-429). ROADMAP.md:116-123 schedules the actual dialog in Phase 4. Stub is intentional and documented. |

**Score:** 4/4 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/sampler.ts` | SamplerOutput with globalPeaks + perAnimation + setupPosePeaks emitted in single lifecycle pass; locked tick order preserved | VERIFIED | SamplerOutput interface (lines 119-123); `sampleSkeleton` returns three-Map shape (135-138); LOCKED TICK ORDER comment-delimited at lines 218-223 with `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)`; `Physics.reset` once per (skin, animation) at line 211 (N1.6 determinism anchor). |
| `src/core/bones.ts` | Pure TS module exporting `boneChainPath(slot, attachmentName): string[]` via `Bone.parent` traversal | VERIFIED | 38 lines, type-only import of `Slot`, walks `slot.bone.parent` up, reverses for root-first, appends slot + attachment leaves (bones.ts:25-38). Uses `bone.data.name` (correct BoneData accessor per spine-core 4.2.111). |
| `src/core/analyzer.ts` | `analyzeBreakdown()` sibling export producing `AnimationBreakdown[]` with Setup Pose card first | VERIFIED | Exported at line 209-261. Setup Pose card pushed first (227-233); per-animation cards iterate `skeletonData.animations` order (247-258); each card's rows deduped via generic `dedupByAttachmentName<BreakdownRow>` and sorted Scale DESC. |
| `src/shared/types.ts` | `BreakdownRow extends DisplayRow` + `AnimationBreakdown` + `SkeletonSummary.animationBreakdown` | VERIFIED | BreakdownRow at lines 69-74 with `bonePath: string[]` + `bonePathLabel: string`. AnimationBreakdown at 87-93 with `cardId / animationName / isSetupPose / uniqueAssetCount / rows`. `SkeletonSummary.animationBreakdown: AnimationBreakdown[]` at line 113. All primitive — structuredClone-safe. |
| `src/main/summary.ts` | Materialize Skeleton for slot wiring; call analyze + analyzeBreakdown; emit animationBreakdown field | VERIFIED | `new Skeleton(load.skeletonData)` at line 61 (documented necessity — SkeletonData lacks Bone.parent wiring); `analyzeBreakdown(sampled.perAnimation, sampled.setupPosePeaks, load.skeletonData, skeleton.slots)` at 62-67; emitted at line 87. |
| `src/main/ipc.ts` | Single-line plumbing to new SamplerOutput shape | VERIFIED | `const sampled = sampleSkeleton(load)` at line 57; `buildSummary(load, sampled, elapsedMs)` at 59. Input validation and typed-error envelope preserved. |
| `src/renderer/src/components/AppShell.tsx` | New top-tab container with filename chip + tab strip + focus-animation state | VERIFIED | 127 lines. Filename chip at 55-57 hoisted per D-49; tab strip at 58-71 with `role="tablist"`; `activeTab` + `focusAnimationName` useState (37, 39); `onJumpToAnimation` + `onFocusConsumed` useCallbacks (41, 46); two-weight contract carried by TabButton (98-127). |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | Collapsible cards + Bone Path + disabled Override + cross-card search + flash | VERIFIED | 437 lines. userExpanded seeded `new Set(['setup-pose'])` (150-152); `filterCardsByAttachmentName` + `effectiveExpanded` union (83-95, 173-179); jump-effect useEffect with scrollIntoView + setUserExpanded add + setIsFlashing + synchronous `onFocusConsumed()` + 900ms timer cleanup (193-216); `ring-2 ring-accent ring-offset-2 ring-offset-surface` flash (294); disabled Override button (421-429). |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Source Animation chip upgraded to jump-target button when `onJumpToAnimation` prop supplied | VERIFIED | Optional prop at 45-55; conditional render `<button>` vs `<span>` fallback at 214-227; `hover:bg-accent/10` + `aria-label` on the button; standalone `<span>` preserved for decoupled usage. |
| `src/renderer/src/App.tsx` | Loaded branch renders `<AppShell summary={state.summary} />` | VERIFIED | Import at line 23 (`import { AppShell } from './components/AppShell';`); render site at line 71 (`{state.status === 'loaded' && <AppShell summary={state.summary} />}`). No lingering `GlobalMaxRenderPanel` reference in App.tsx. |
| `scripts/cli.ts` | Adapts to `SamplerOutput.globalPeaks`; CLI byte-for-byte preserved | VERIFIED | CLI runs and produces 3 dedup'd rows (CIRCLE / SQUARE / TRIANGLE) at 120 Hz — matches Phase 2 golden output shape. `sampled.globalPeaks` referenced at line 154 (per REVIEW). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/renderer/src/App.tsx` loaded branch | `src/renderer/src/components/AppShell.tsx` | `import { AppShell }` + `<AppShell summary=...>` | WIRED | Import and render site verified at App.tsx:23, 71 |
| `AppShell.tsx` | `GlobalMaxRenderPanel` + `AnimationBreakdownPanel` | `activeTab === 'global' | 'animation'` conditional render | WIRED | AppShell.tsx:74-86; exactly one panel mounted at a time |
| `AppShell.tsx.onJumpToAnimation` | `GlobalMaxRenderPanel.onJumpToAnimation` prop | Callback threading | WIRED | AppShell.tsx:77 passes the callback down; GlobalMaxRenderPanel.tsx:214-222 wires the button onClick → `onJumpToAnimation(row.sourceLabel)` |
| `GlobalMaxRenderPanel` Source Animation button | `AppShell.setFocusAnimationName` | onJumpToAnimation -> setActiveTab('animation') + setFocusAnimationName | WIRED | AppShell.tsx:41-44 |
| `AppShell.focusAnimationName` | `AnimationBreakdownPanel` scroll + expand + flash | `focusAnimationName` prop + useEffect | WIRED | AnimationBreakdownPanel.tsx:193-216; synchronous `onFocusConsumed()` at 212 prevents re-mount leak (RESEARCH Pitfall 5) |
| `analyzeBreakdown` perAnimation → cards | per-animation buckets | Pre-grouped Map by `rec.animationName` (gap-fix dfbcfa5) | WIRED | analyzer.ts:240-249 uses `rec.animationName` (not first-slash parsing); routes namespaced names like `CHAR/BLINK` and `LOOK/AROUND` correctly |
| `summary.ts` → `animationBreakdown` field | `SkeletonSummary` IPC payload | `analyzeBreakdown(sampled.perAnimation, sampled.setupPosePeaks, ...)` | WIRED | summary.ts:62-67, 87 |
| `sampleSkeleton` Pass-1 → `setupPosePeaks` | `analyzeBreakdown` Setup Pose card | Separate Map emitted in lifecycle-pass-1 | WIRED | sampler.ts:149, 182; consumed at analyzer.ts:222 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `AppShell.tsx` | `summary` | `App.tsx` passes `state.summary` (from IPC LoadResponse) | Yes — real SkeletonSummary payload from `handleSkeletonLoad` round-tripped through Electron structuredClone | FLOWING |
| `AnimationBreakdownPanel.tsx` | `summary.animationBreakdown` | Populated by `buildSummary` via `analyzeBreakdown(sampled.perAnimation, sampled.setupPosePeaks, skeletonData, skeleton.slots)` | Yes — sampled data from real skeleton via locked tick lifecycle; gap-fix dfbcfa5 ensures namespaced animation names route correctly | FLOWING |
| `GlobalMaxRenderPanel.tsx` | `summary.peaks` + `onJumpToAnimation` | Phase 2 `analyze(sampled.globalPeaks)` + AppShell callback | Yes — Phase 2 peaks unchanged (CLI byte-for-byte preserved); callback wired from AppShell | FLOWING |
| `boneChainPath` output → `bonePath` → render | BreakdownRow.bonePath | `boneChainPath(slot, attachmentName)` walks real `slot.bone.parent` chain on materialized Skeleton | Yes — CLI verified CIRCLE resolves to 4 tokens, TRIANGLE to 11 tokens (per Plan 03-01 SUMMARY; test coverage in `tests/core/bones.spec.ts`) | FLOWING |
| Disabled Override button | N/A (stub) | Hardcoded disabled state per D-69 | Intentional stub — Phase 4 unblocks | STATIC (per phase context) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes (88 + 1 skipped) | `npm run test` | `Test Files 8 passed (8)  Tests 88 passed | 1 skipped (89)` | PASS |
| Arch guards (6/6) green | `npm run test -- tests/arch.spec.ts` | `Test Files 1 passed (1)  Tests 6 passed (6)` | PASS |
| Renderer typecheck clean | `npm run typecheck:web` | Exit 0 (no output) | PASS |
| Production build succeeds + CJS main/preload | `npx electron-vite build` | `out/main/index.cjs 23.96 kB`, `out/preload/index.cjs 0.68 kB`, renderer bundle emitted | PASS |
| CLI runs and emits dedup'd rows | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | 3 dedup'd rows (CIRCLE/SQUARE/TRIANGLE) + footer `Sampled in 22.5 ms at 120 Hz (4 attachments across 1 skins, 4 animations)` | PASS |
| Gap-fix regression test present | `grep -n 'animation names containing "/"' tests/core/analyzer.spec.ts` | Line 303: `D-58: animation names containing "/" (e.g. namespaced "CHAR/BLINK", "LOOK/AROUND") route rows to the correct card` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| F4.1 | 03-01 + 03-02 | Collapsible per-animation cards, each showing unique asset count (or "No assets referenced") | SATISFIED | analyzer.ts:247-258 (cards with `uniqueAssetCount`); AnimationBreakdownPanel.tsx:278-286 (header count + "No assets referenced" branch at 282-284); AnimationCard section with `aria-expanded` + `role="region"` body (289-330); user tested and signed off 2026-04-23 |
| F4.2 | 03-01 + 03-02 | "Setup Pose (Default)" shown as its own top card | SATISFIED | analyzer.ts:227-233 pushes Setup Pose as `cards[0]` with `animationName: 'Setup Pose (Default)'`; AnimationBreakdownPanel.tsx:150-152 seeds userExpanded with `new Set(['setup-pose'])` so it's expanded by default; setupPosePeaks Pass-1-only emission (sampler.ts:149, 182) ensures every textured attachment is covered per D-60; user tested and signed off |
| F4.3 | 03-01 + 03-02 | Per-row Bone Path shown, plus source → scale → peak → frame | SATISFIED | src/core/bones.ts boneChainPath traversal; analyzer.ts:157-188 populates `bonePath` + `bonePathLabel`; AnimationBreakdownPanel.tsx:349-386 renders 7-col table with Attachment / Bone Path / Source W×H / Scale / Peak W×H / Frame / Actions; truncateMidEllipsis + title tooltip full chain (398-403); preformatted labels (originalSizeLabel, scaleLabel, peakSizeLabel, frameLabel) consumed at 404-415; tests/core/analyzer.spec.ts:290-301 asserts bonePath[0]==='root', leaf === attachmentName, label uses ' → ' |
| F4.4 | 03-02 | Per-row "Override Scale" button (DISABLED stub per D-69 — Phase 4 wires dialog) | SATISFIED | AnimationBreakdownPanel.tsx:421-429 `<button disabled title="Coming in Phase 4" aria-label="Override Scale (disabled until Phase 4)">Override Scale</button>` with `opacity-50 cursor-not-allowed`; matches phase-context requirement (Phase 3 stub only). Actual dialog scheduled for Phase 4 per ROADMAP.md:116-123. |

**No orphaned requirements.** All four F4 IDs declared in plan frontmatter (03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md) have corresponding implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | 173-188 | `toggleCard` during active search adds to userExpanded but effectiveExpanded still includes match-auto-expanded cards — two-click no-op observed | Info / Nit | Matches design intent (D-71 auto-expand union); optional UX polish deferred post-MVP. Flagged in 03-REVIEW.md as IN-01 (nit). |

**No blockers, warnings, or other info findings.** The single nit is pre-acknowledged in the Phase 3 code review and represents designed behavior, not a bug.

### Architectural Invariants Verified

| Invariant | Source | Status | Evidence |
|-----------|--------|--------|----------|
| Locked tick lifecycle (CLAUDE.md rule #3) | sampler.ts:218-223 | PRESERVED | `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` byte-identical; `Physics.reset` once per (skin, animation) at line 211 |
| core/ is pure TS, no DOM (CLAUDE.md rule #5) | bones.ts, analyzer.ts, sampler.ts | PRESERVED | Type-only spine-core imports; no `node:*`, no `sharp`, no DOM globals |
| Layer 3 defense (renderer ↛ core) | tests/arch.spec.ts | PRESERVED | 6/6 arch guards green; only mentions of `src/core` in renderer files are in JSDoc comments, no actual imports |
| D-23 portability (no platform branching) | tests/arch.spec.ts | PRESERVED | Auto-scanned; 6/6 guards green |
| Preload CJS lock (Plan 01-05) | tests/arch.spec.ts | PRESERVED | 2 preload-CJS guards green; build emits `out/preload/index.cjs` 0.68 kB |
| Main CJS lock (Plan 02-03) | tests/arch.spec.ts | PRESERVED | 2 main-CJS guards green; build emits `out/main/index.cjs` 23.96 kB |
| structuredClone-safety (D-22) | summary.spec.ts | PRESERVED | `SkeletonSummary.animationBreakdown` primitives-only — `BreakdownRow` fields are strings/numbers/booleans plus `bonePath: string[]`; structured-clone round-trip test exists (REVIEW line 39) |
| Two-weight typography contract | all renderer files | PRESERVED | `grep -rn 'font-medium\|font-weight' AppShell.tsx AnimationBreakdownPanel.tsx GlobalMaxRenderPanel.tsx App.tsx` exits with zero matches |
| N1.6 determinism (Physics.reset anchor) | sampler.ts:211 | PRESERVED | Extended to perAnimation + setupPosePeaks maps per Plan 03-01 summary |
| N2.1 perf gate (<500ms SIMPLE_TEST) | sampler.spec.ts | PRESERVED | CLI reports 22.5 ms — 22× under gate; extension cost trivial |
| CLI byte-for-byte output | scripts/cli.ts | PRESERVED | CLI output matches Phase 2 contract (3 dedup'd rows + fixed-format footer) |

### Gap-Fix Lock-In (commit `dfbcfa5`)

| Item | Status | Evidence |
|------|--------|----------|
| Analyzer groups by `rec.animationName` (not first-slash parsing) | VERIFIED | analyzer.ts:240-249 uses `const rowsByAnim = new Map<string, BreakdownRow[]>()` + `bucket = rowsByAnim.get(rec.animationName)` + `rowsForAnim = rowsByAnim.get(anim.name) ?? []` |
| Regression test covers namespaced animation names | VERIFIED | tests/core/analyzer.spec.ts:303-348 `it('D-58: animation names containing "/" ... route rows to the correct card')` — hand-crafted PeakRecord entries for `CHAR/BLINK`, `LOOK/AROUND`, `JUMP` all route to correct cards with correct rows |
| Test passes | VERIFIED | `npm run test` reports 88 passed + 1 skipped — test count matches expected +1 over Plan 03-02 baseline of 87+1 |
| Fix preserves perf gate | VERIFIED | O(N+M) vs prior O(N×M) — strictly faster |

### Human Verification

Pre-verified by the user on 2026-04-23 per phase_context. All 14 interactive checks signed off on SIMPLE_TEST.json, including:
- Tab strip and filename chip render correctly
- Global tab default-active with 3 dedup'd rows
- Animation Breakdown tab shows Setup Pose card expanded + 4 animation cards collapsed
- Collapsible card expand/collapse mechanics
- 7-column table with Bone Path mid-ellipsis + title tooltip
- Disabled Override button with "Coming in Phase 4" tooltip
- Cross-card search + auto-expand + `<mark>` highlight
- Source Animation chip jump + scroll + 900ms flash
- Re-flash isolation (RESEARCH Pitfall 5 resolved)
- Fresh skeleton drop resets state

Post gap-fix (`dfbcfa5`) re-verification on Girl fixture confirmed all 15 namespaced `CHAR/*` cards populate with real rows; Jokerman's 8 `LOOK/*` cards similarly fixed.

**No outstanding human verification items** — the phase_context explicitly states human-verify signed off.

### Gaps Summary

**None.** All four F4 requirements map to real code with supporting tests. All key links wire from user interaction through data flow to render. No regressions vs Phase 2 (Global panel still works; CLI byte-for-byte preserved; 6/6 arch guards + 88 tests green). Architectural invariants (locked lifecycle, Layer 3, CJS locks, structuredClone safety, two-weight typography) all preserved.

The namespaced-animation-name gap discovered at human-verify is closed by commit `dfbcfa5` with a dedicated regression test at `tests/core/analyzer.spec.ts:303-348`. The Override button is a DISABLED stub per design decision D-69 — this is phase-expected behavior, not a gap; Phase 4 wires the actual dialog per ROADMAP.md:116-123.

One nit (IN-01 from code review) regarding two-click no-op on search-auto-expanded card collapse is documented as designed behavior and deferred to post-MVP polish.

---

_Verified: 2026-04-23T23:25:00Z_
_Verifier: Claude (gsd-verifier, claude-opus-4-7)_
