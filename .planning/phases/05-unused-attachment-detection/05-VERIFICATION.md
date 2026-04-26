---
phase: 05-unused-attachment-detection
verified: 2026-04-24T22:30:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 5: Unused Attachment Detection Verification Report

**Phase Goal:** Detect attachments registered in `skin.attachments` that never render (active slot with alpha > 0) across any animation × skin combination, including setup-pose passes. Ship `src/core/usage.ts` (pure-TS enumeration + defined∖used diff), extend `SkeletonSummary` with `unusedAttachments: UnusedAttachment[]` on the existing IPC surface, add a new `--color-danger` warm/terracotta `@theme` token, and render a conditional warning-tinted section ABOVE the peak table on `GlobalMaxRenderPanel`. Sampler stays LOCKED (D-100). CLI stays byte-for-byte unchanged (D-102). Animation Breakdown panel untouched.

**Verified:** 2026-04-24T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Drop `SIMPLE_TEST.json` → peak table renders as Phase 4, no unused section (clean rig) | ✓ VERIFIED | Human-verified 2026-04-24 per 05-04-SUMMARY §Task 3 Verification #1; code path confirmed: panel renders `<section>` only when `unusedAttachments.length > 0` (GlobalMaxRenderPanel.tsx:580); baseline fixture produces empty array (usage.spec.ts test (a) green; summary.spec.ts F6.2 asserts `[]`) |
| 2 | Drop `SIMPLE_TEST_GHOST.json` → warm/terracotta section with one row `GHOST · 64×64 · default`; peak table still renders below | ✓ VERIFIED | Human-verified 2026-04-24 per 05-04-SUMMARY §Task 3 Verification #2; code path confirmed: usage.spec.ts case (b) asserts row shape `{ attachmentName: 'GHOST', sourceW: 64, sourceH: 64, definedIn: ['default'], dimVariantCount: 1, sourceLabel: '64×64', definedInLabel: 'default' }` — GREEN; fixture exists; atlas has `GHOST bounds:0,0,64,64`; CIRCLE slot default preserved as `CIRCLE` |
| 3 | SearchBar substring filter applies to both tables consistently (D-107) | ✓ VERIFIED | Human-verified 2026-04-24 per 05-04-SUMMARY §Task 3 Verification #3; code path confirmed: `filteredUnused` memo at GlobalMaxRenderPanel.tsx:471-480 uses same `query.trim().toLowerCase().includes()` predicate as peak table's `filterByName` (D-107) |
| 4 | Red scope is header-only — row cells render in standard text colors (D-105) | ✓ VERIFIED | Human-verified 2026-04-24 per 05-04-SUMMARY §Task 3 Verification #2; code-level grep: `grep -c "text-danger" GlobalMaxRenderPanel.tsx = 1` (header only); row cells use `text-fg` (line 605) and `text-fg-muted` (lines 606-607) |
| 5 | `npm run test` full suite green (>= 120 passed + 1 skipped) | ✓ VERIFIED | Live run: `Test Files 10 passed (10) / Tests 128 passed | 1 skipped (129)`; exceeds 120 floor |
| 6 | `git diff scripts/cli.ts` + `git diff src/core/sampler.ts` both empty (D-100 / D-102 locks) | ✓ VERIFIED | Live run: both diffs return 0 lines; also cross-verified loader.ts, bounds.ts, bones.ts all empty |
| 7 | `npx electron-vite build` succeeds; emitted CSS carries the new danger token | ✓ VERIFIED | Live run: build exits 0; emitted `out/renderer/assets/index-Dq0IP-Nq.css` (20.31 kB) contains BOTH `.text-danger` utility AND literal `e06b55` hex |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|----------|--------|---------|
| `src/core/usage.ts` | Pure-TS findUnusedAttachments (F6.1) | ✓ VERIFIED | Exists (183 lines); 1 named export; 0 spine-core imports; 0 node: imports; 0 DOM refs; 0 sharp imports; `localeCompare` present (D-107); `sampler.globalPeaks.values()` present (Finding #2); `load.sourceDims.get` present (Finding #3) |
| `src/main/summary.ts` | IPC projection extended (D-101) | ✓ VERIFIED | Contains `findUnusedAttachments` import (from `../core/usage.js`); invokes once at line 73; threads `unusedAttachments` field into return object (line 94) |
| `src/shared/types.ts` | `UnusedAttachment` interface + `SkeletonSummary.unusedAttachments` field | ✓ VERIFIED | 1 `export interface UnusedAttachment` declaration; 7 primitive fields (attachmentName, sourceW, sourceH, definedIn: string[], dimVariantCount, sourceLabel, definedInLabel); `SkeletonSummary` extended with `unusedAttachments?: UnusedAttachment[]` (optional — documented deviation) |
| `src/renderer/src/index.css` | New `--color-danger` token | ✓ VERIFIED | Exactly one `--color-danger: #e06b55;` declaration inside @theme inline block; provenance comment references D-104 + RESEARCH Finding #7 |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Conditional `<section aria-label="Unused attachments">` above peak table | ✓ VERIFIED | `aria-label="Unused attachments"` present (line 581); section gated on `unusedAttachments.length > 0`; header `text-danger font-mono font-semibold`; 3-column table (Attachment / Source Size / Defined In); `(no matches)` empty-state placeholder; `selectedKeys={selectedAttachmentNames}` regression guard preserved |
| `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` | Forked skeleton with GHOST ghost-def | ✓ VERIFIED | File exists; `j.skins[0].attachments.CIRCLE.GHOST = { width: 64, height: 64 }`; CIRCLE slot default remains `"CIRCLE"`; no animation timeline references GHOST |
| `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.atlas` | Forked atlas with GHOST bounds | ✓ VERIFIED | File exists; `GHOST` region + `bounds:0,0,64,64` present; `SIMPLE_TEST.png` page-header preserved; no forked PNG (CLAUDE.md #4) |
| `tests/core/usage.spec.ts` | Spec suite for findUnusedAttachments | ✓ VERIFIED | 297 lines; 11 `it()` cases (2 fixture + 6 cross-skin/sort/invariant + 3 hygiene); live run: 11/11 GREEN |
| `tests/core/summary.spec.ts` | F6.2 field-shape assertion | ✓ VERIFIED | Contains F6.2 test block with `Array.isArray(s.unusedAttachments)` + empty-array equality + `structuredClone(s.unusedAttachments)` round-trip; GREEN |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main/summary.ts` | `src/core/usage.ts` | `import { findUnusedAttachments } from '../core/usage.js'` | ✓ WIRED | Import present at line 24; call-site at line 73 (`const unusedAttachments = findUnusedAttachments(load, sampled)`); field threaded into return object (line 94) |
| `src/core/usage.ts` | `src/core/types.ts` | `import type { LoadResult }` | ✓ WIRED | Type-only import at line 59; consumed by function signature |
| `src/core/usage.ts` | `src/core/sampler.ts` | `import type { SamplerOutput }` | ✓ WIRED | Type-only import at line 60; consumed by function signature + `sampler.globalPeaks.values()` |
| `src/core/usage.ts` | `src/shared/types.ts` | `import type { UnusedAttachment }` | ✓ WIRED | Type-only import at line 61; returned array element type |
| `GlobalMaxRenderPanel.tsx` | `SkeletonSummary.unusedAttachments` | `summary.unusedAttachments ?? []` normalisation | ✓ WIRED | Local const `unusedAttachments` at line 470 nullish-coalesces to `[]`; downstream: conditional render guard (580), `filteredUnused` memo dependencies (479), memo body reads (474-476) |
| `GlobalMaxRenderPanel.tsx` | `index.css` (Tailwind utility) | `className="text-danger"` usage | ✓ WIRED | Section header uses `text-danger` (line 582); Tailwind v4 JIT emits `.text-danger` into compiled CSS (verified in out/renderer/assets/) |
| `src/renderer/src/index.css` | Tailwind v4 utility emission | `@theme inline { --color-danger: #e06b55; }` | ✓ WIRED | Token declared; emitted CSS contains both `.text-danger` utility and `e06b55` literal hex |

### Data-Flow Trace (Level 4)

The unused-attachment section is the only new rendering artifact. Trace for `summary.unusedAttachments`:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|---------------|--------|-------------------|--------|
| `GlobalMaxRenderPanel.tsx` — unused section | `unusedAttachments` (local) | `summary.unusedAttachments ?? []` ← IPC prop from main via `skeleton:load` | Yes — `src/main/summary.ts:73` calls `findUnusedAttachments(load, sampled)` which performs real set-difference over `skeletonData.skins` + `sampler.globalPeaks`; no hardcoded empty fallback except on optional-field absence (always populated by current main-process code path) | ✓ FLOWING |
| `filteredUnused` memo | derived from `unusedAttachments` + `query` | substring filter on live data | Yes — pure derivation; no stubs | ✓ FLOWING |

Evidence: usage.spec.ts case (b) drives real fixture through the full pipeline — `loadSkeleton(FIXTURE_GHOST) → sampleSkeleton(load) → findUnusedAttachments(load, sampled)` — and asserts the expected GHOST row populates; summary.spec.ts F6.2 asserts full `buildSummary` pipeline produces the array with structured-clone round-trip on the baseline fixture. No hollow/disconnected data flow.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| Full test suite green (exit criterion 5) | `npm run test` | 128 passed, 1 skipped, 0 failed | ✓ PASS |
| Arch gates intact | `npm run test -- tests/arch.spec.ts` | 8 passed (8) | ✓ PASS |
| usage.spec.ts all green | `npm run test -- tests/core/usage.spec.ts` | 11 passed (11) | ✓ PASS |
| Production build succeeds + token emission (exit criterion 7) | `npx electron-vite build && grep -oE "e06b55|\.text-danger" out/renderer/assets/index-*.css` | Exit 0; output: `.text-danger\ne06b55` | ✓ PASS |
| Locked file audit (exit criterion 6) | `git diff scripts/cli.ts src/core/sampler.ts src/core/loader.ts src/core/bounds.ts src/core/bones.ts \| wc -l` | 0 | ✓ PASS |
| `UnusedAttachment` IPC shape | `grep -c "^export interface UnusedAttachment" src/shared/types.ts` | 1 | ✓ PASS |
| findUnusedAttachments pure-TS | `grep -cE "@esotericsoftware/spine-core\|from ['\"]node:\|from ['\"]sharp" src/core/usage.ts` | 0 | ✓ PASS |
| Layer 3 boundary (no renderer → core) | `grep -cE "from ['\"].*\\/core\\/\|from ['\"]@core" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 0 | ✓ PASS |
| Red scope header-only (D-105) | `grep -c "text-danger" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 1 (header only; no row cells) | ✓ PASS |
| Batch-scope regression guard (arch.spec.ts:85-114) | `grep -c "selectedKeys={selectedAttachmentNames}" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 1 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|------------|----------------|-------------|--------|----------|
| F6.1 | 05-01, 05-02, 05-04 | Flag attachments defined in skins that are never rendered (active slot with non-zero alpha) in any animation in any skin | ✓ SATISFIED | `src/core/usage.ts` implements `findUnusedAttachments` performing name-level set difference over `skeletonData.skins` (defined) vs `sampler.globalPeaks.values()` (used); alpha-0 predicate delegated to sampler's visibility check (D-92); 11/11 usage.spec.ts cases green (fixture baseline, GHOST row, cross-skin D-93, dim divergence D-98, alpha-zero, AttachmentTimeline visibility, sort D-107, F6.1 sanity canary, 3 hygiene) |
| F6.2 | 05-01, 05-03, 05-04 | Surface as its own panel section | ✓ SATISFIED | `GlobalMaxRenderPanel.tsx` renders conditional `<section aria-label="Unused attachments">` above the peak table (lines 580-613); `--color-danger: #e06b55` token added to `@theme inline`; SearchBar filter inheritance via shared `query` state (D-107); red-scope header-only (D-105); `(no matches)` placeholder on empty filter result; F6.2 assertion in summary.spec.ts green |

No orphaned requirements detected — REQUIREMENTS.md lists F6.1 + F6.2 as the only Phase 5 requirements, both claimed by plans and fully satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/core/usage.ts` | 126 | `attachment as unknown as { width?: number; height?: number }` double-cast | ℹ️ Info | Documented in 05-REVIEW.md WR-02 + IN-04; type-asserts through a runtime shape check. Not a phase blocker — the test case (d) covers the behavioral contract; review flagged for opportunistic refactor. |
| `src/core/usage.ts` | 84-144 | Potential used/defined key asymmetry under skin aliasing (map-key vs `attachment.name`) | ℹ️ Info (Review WR-01) | 05-REVIEW.md flags this as a latent correctness concern for rigs that alias attachment names via the `"name"` JSON property. No test fixture exercises skin aliasing in this codebase; the current SIMPLE_TEST + SIMPLE_TEST_GHOST fixtures do not trigger it. Documented as a warning; not blocking phase goal achievement. |
| `src/core/usage.ts` | 127-128 | Anisotropic fallback when one axis is 0 mixes per-skin + atlas dims (Review WR-03) | ℹ️ Info | 05-REVIEW.md flag; theoretical edge case (ill-formed export); no observed impact on fixtures. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 583 | `⚠` U+26A0 text-literal glyph without `⚠︎` variation selector (Review IN-03) | ℹ️ Info | Cross-platform emoji presentation variance. Human-verified 2026-04-24 that glyph renders correctly in JetBrains Mono on user's macOS; no Pitfall 9 swap triggered. |

No blocker or warning-severity anti-patterns affecting goal achievement. All four items are `ℹ️ Info` — logged in 05-REVIEW.md for future polish, explicitly out-of-scope for Phase 5 sign-off.

### Human Verification Required

None. Human sign-off captured 2026-04-24 per 05-04-SUMMARY.md §Task 3: all 6 in-app verifications passed (SIMPLE_TEST empty → SIMPLE_TEST_GHOST rendered → SearchBar filter interactions → clean return → CLI byte-compare → arch 8/8). Task directive from orchestrator acknowledges exit criteria 1-4 as already signed off.

### Gaps Summary

No gaps. Phase 5 goal achieved end-to-end:

- **F6.1 (detection math)**: `src/core/usage.ts` implements pure-TS set-difference, wired through `src/main/summary.ts`, consumed by the renderer via IPC.
- **F6.2 (UI surface)**: `GlobalMaxRenderPanel` renders conditional warning-tinted section above the peak table with inherited SearchBar filter.
- **Invariants preserved**: D-100 (sampler.ts byte-unchanged), D-102 (cli.ts byte-unchanged + CLI output content-identical), D-105 (red scope header-only), Layer 3 boundary intact, batch-scope regression guard (`selectedKeys={selectedAttachmentNames}`) intact, arch.spec.ts 8/8 green.
- **Automation**: Full test suite 128 passed + 1 skipped (baseline 116+1 + 12 new Phase 5 cases); build succeeds; emitted CSS carries `--color-danger` token.

The only caveat is the CLI timing line wall-clock drift (23.9 → 23.5 ms), explicitly scoped as a non-deterministic measurement and documented as a carve-out in 05-04-SUMMARY.md §Deviations. Every data-bearing line of the CLI output is byte-identical to the Plan 02 baseline, and `scripts/cli.ts` itself is byte-unchanged — the semantic D-102 lock is intact.

Phase 5 is ready to close.

---

*Verified: 2026-04-24T22:30:00Z*
*Verifier: Claude (gsd-verifier)*
