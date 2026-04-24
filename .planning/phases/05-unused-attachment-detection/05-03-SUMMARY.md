---
phase: 05-unused-attachment-detection
plan: 03
subsystem: renderer
tags: [react, tailwind-v4, tsx, ipc-consumer, ui-surface, phase-5]

# Dependency graph
requires:
  - phase: 05-unused-attachment-detection
    plan: 01
    provides: "UnusedAttachment interface + SkeletonSummary.unusedAttachments? (optional) field."
  - phase: 05-unused-attachment-detection
    plan: 02
    provides: "src/core/usage.ts findUnusedAttachments detector + src/main/summary.ts IPC wiring — summary.unusedAttachments is now populated on every skeleton:load."
  - phase: 01-electron-scaffold
    provides: "src/renderer/src/index.css Tailwind v4 @theme inline block + --color-panel token + font-mono stack."
  - phase: 02-global-max-render-source-panel
    provides: "src/renderer/src/panels/GlobalMaxRenderPanel.tsx peak table host with SearchBar query state + filter/sort chain."
provides:
  - "src/renderer/src/index.css --color-danger: #e06b55 warm/terracotta design token (D-104, WCAG AA)."
  - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx conditional <section aria-label='Unused attachments'> above the peak table (F6.2)."
  - "Tailwind v4 auto-emitted text-danger utility (verified in out/renderer/assets/index-*.css)."
affects: [05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 @theme inline auto-emission: adding --color-danger token → JIT auto-generates text-danger / bg-danger / border-danger utilities on first consumer usage (no explicit utility declarations needed; unused tokens are tree-shaken)."
    - "Optional IPC field consumption: renderer nullish-coalesces summary.unusedAttachments to [] because Plan 01 chose to keep the field optional for source compatibility (Plan 02 SUMMARY §key-decisions). Three TS2339-adjacent sites converge to one local `unusedAttachments` const."
    - "Chrome-visible-on-filter policy (Pitfall 6): section chrome gated on unusedAttachments.length > 0 (not filteredUnused.length) so the header + count + table chrome stays visible when the search excludes every row; body shows '(no matches)' placeholder."
    - "Red-scope header-only (D-105): terracotta text-danger applied only to <section><header>; <td> cells render text-fg (attachment name) and text-fg-muted (source size, defined-in) — alarm is loud, data is scannable."

key-files:
  created:
    - ".planning/phases/05-unused-attachment-detection/05-03-SUMMARY.md (this file)"
  modified:
    - "src/renderer/src/index.css (+10 lines / -1 line — extended emitted-utilities doc comment + new --color-danger token block)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (+64 lines / -0 lines — filteredUnused memo + unusedAttachments ?? [] local + conditional <section> markup + 3 doc-comment blocks)"

key-decisions:
  - "Nullish-coalesce summary.unusedAttachments ?? [] at ONE site (not 3) — introduced a local `const unusedAttachments = summary.unusedAttachments ?? [];` above the filteredUnused memo. All three downstream reads (memo empty-q branch, memo filter branch, conditional render guard) reference the local, not the raw field. Single-site fallback is cleaner than per-read optional chaining."
  - "Task 1's emitted-CSS grep passed AFTER Task 2 committed: Tailwind v4 JIT tree-shakes unused tokens, so `#e06b55` and `.text-danger` only appear in out/renderer/assets/*.css once GlobalMaxRenderPanel.tsx references text-danger. First-task-only build emitted neither; the plan's OR criterion ('contains #e06b55 OR .text-danger') is satisfied at the plan level after Task 2 (verified explicitly in out/renderer/assets/index-Dq0IP-Nq.css)."

# Metrics
duration: 3min 30s
completed: 2026-04-24
---

# Phase 5 Plan 03: Render Unused-Attachment Section on Global Panel Summary

**F6.2 UI surface — terracotta-header `<section aria-label="Unused attachments">` rendered above the peak table on `GlobalMaxRenderPanel`, backed by a new `--color-danger: #e06b55` WCAG-AA design token. Two files modified, two atomic commits, 128 tests preserved + 0 regressions.**

## Performance

- **Duration:** ~3 min 30s
- **Started:** 2026-04-24T19:01:00Z
- **Completed:** 2026-04-24T19:04:30Z
- **Tasks:** 2
- **Files modified:** 2 (src/renderer/src/index.css, src/renderer/src/panels/GlobalMaxRenderPanel.tsx)
- **Files created:** 0 (pure extension of existing files)

## Accomplishments

- `src/renderer/src/index.css` extended with one new `@theme inline` token block:
  - `--color-danger: #e06b55` — warm terracotta, 5.33:1 contrast on `--color-panel` (WCAG AA normal-text pass per RESEARCH Finding #7), 1.17:1 vs `--color-accent` (distinguishable from Phase 4 orange).
  - Literal hex (not a Tailwind palette var ref) because the pick sits outside the default stone/orange shades.
  - Placed immediately after the accent block and before the Typography comment, matching existing 2-space indent.
  - Emitted-utilities doc comment at the file header extended: `text-danger, bg-danger, border-danger.` added on a new line after `font-sans, font-mono`.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` extended with two surgical additions:
  - **Memo:** `filteredUnused` useMemo inserted between the existing `visibleKeys` memo and the `keyToName` memo. Reuses the panel's `query` state with the same substring-lowercase predicate the peak table uses (D-107 inherited SearchBar filter). Driven by a local `unusedAttachments = summary.unusedAttachments ?? []` that normalises the optional IPC field to a concrete array.
  - **Markup:** Conditional `<section aria-label="Unused attachments">` inserted between the existing `</header>` and the existing `<table>`. Header in `text-danger font-mono text-sm font-semibold` with a U+26A0 `⚠` glyph (aria-hidden) + semantic count text (`1 unused attachment` / `N unused attachments`). 3-column table (Attachment / Source Size / Defined In) with `text-fg` / `text-fg-muted` cells — red scope is header-only per D-105. Empty-state renders `(no matches)` placeholder via `colSpan={3}` when the filter excludes every row (Pitfall 6 chrome-visible policy).
- Tailwind v4 JIT emitted the new `.text-danger` utility and the `#e06b55` hex into `out/renderer/assets/index-Dq0IP-Nq.css` (20.31 kB, up from 20.02 kB in the Plan 02 baseline — small increase consistent with one new utility).
- Full test suite: **128 passed + 1 skipped = 129** (identical to Plan 02 baseline — this plan added no new specs, it's a UI-only change).
- Arch gate: 8/8 describes green — Layer 3 boundary intact (no src/core imports from the panel), portability invariant intact (no `process.platform` / `os.platform` literals), selectedAttachmentNames regression guard intact.
- Typecheck: `npx tsc --noEmit -p tsconfig.web.json` exits 0.

## Task Commits

1. **Task 1: Add --color-danger token to @theme inline block** — `1967d12` (feat)
   - `feat(05-03): add --color-danger theme token`
   - 1 file changed, 10 insertions, 1 deletion
2. **Task 2: Add unused-attachment section to GlobalMaxRenderPanel.tsx** — `1bcf59f` (feat)
   - `feat(05-03): render unused-attachment section on Global panel`
   - 1 file changed, 64 insertions

_Plan metadata commit (this SUMMARY.md) follows._

## Files Created/Modified

- `src/renderer/src/index.css` — 77 lines (was 68). Net +9 lines: 1-line extension to the emitted-utilities doc comment (`text-danger, bg-danger, border-danger.`) + 7-line new token block inside the existing @theme inline (6-line provenance comment + `--color-danger: #e06b55;` declaration) + 1 blank line. The existing neutral tokens, accent tokens, font tokens, @font-face block, and body declaration are byte-for-byte unchanged. Grep invariants verified:
  - `grep -c "^  --color-danger: #e06b55;" = 1` ✓
  - `grep -c "RESEARCH Finding #7\|D-104" = 2` (>= 1 ✓ — actual matches: `Finding #7` in the provenance comment + `D-104` in the provenance comment)
  - `grep -c "^@theme inline" = 1` ✓
  - `grep -c "text-danger" = 1` ✓ (emitted-utilities doc comment)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — net +64 lines. Two additions: the `filteredUnused` memo + local `unusedAttachments` (14 lines including doc comment), and the conditional `<section>` markup block (36 lines including doc comment). Grep invariants verified:
  - `grep -c "filteredUnused" = 5` (>= 4 ✓ — useMemo declaration, header count check, empty-length check, map iteration, plus doc-comment reference)
  - `grep -c 'aria-label="Unused attachments"' = 1` ✓
  - `grep -c "text-danger" = 1` ✓ (section header — NOT >=2; red scope is header-only per D-105)
  - `grep -c "summary.unusedAttachments" = 6` (>= 2 ✓ — the `?? []` normalisation + surrounding doc-comment references; direct reads are via the local `unusedAttachments`)
  - `grep -cE "u\.sourceLabel|u\.definedInLabel|u\.attachmentName" = 5` (>= 3 ✓ — three cell reads + `key={u.attachmentName}` + filter predicate read)
  - `grep -c "⚠" = 1` ✓ (U+26A0 warning glyph once, in the header span)
  - `grep -c 'aria-hidden="true"' = 1` ✓ (new glyph span)
  - `grep -cE "from ['\"].*\/core\/|from ['\"]@core" = 0` ✓ (Layer 3 arch preserved — panel imports only `SkeletonSummary`, `DisplayRow`, `SearchBar`, `applyOverride`, no core module)
  - `grep -cE "process\.platform|os\.platform" = 0` ✓ (portability preserved)
  - `grep -c "selectedKeys={selectedAttachmentNames}" = 1` ✓ (arch.spec.ts:85-114 regression guard)
  - `grep -c "selectedAttachmentNames" = 2` ✓ (named intermediate + use site)

## Test Suite State (full `npm run test`)

**Before Plan 03:**
- Test Files: 10 passed (10)
- Tests: 128 passed | 1 skipped (129)
- All 11 usage.spec.ts cases GREEN; summary.spec.ts F6.2 case GREEN.

**After Plan 03:**
- Test Files: 10 passed (10) — unchanged
- Tests: 128 passed | 1 skipped (129) — unchanged
- No regressions. No new specs added (this plan is UI-only; human-verify the rendered panel in Plan 04 if needed).
- arch.spec.ts 8/8 describes still GREEN.

## Build Output Confirmation

- `npx electron-vite build` exits 0.
- Emitted bundle: `out/renderer/assets/index-Dq0IP-Nq.css` — **20,307 bytes** (20.31 kB).
- Plan 02 baseline bundle size: 20.02 kB → +0.29 kB increase from one new utility + its theme-var variant.
- Bundle contains both the computed utility (`.text-danger`) AND the literal hex (`e06b55`):

```
$ grep -oE "e06b55|\.text-danger" out/renderer/assets/index-Dq0IP-Nq.css | sort -u
.text-danger
e06b55
```

Satisfies plan Task 1 acceptance criterion "contains the string #e06b55 OR the computed utility selector .text-danger" — both forms are present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `summary.unusedAttachments` is typed optional — three read sites needed normalisation**

- **Found during:** Task 2 verification (`npx tsc --noEmit -p tsconfig.web.json`)
- **Issue:** The plan's `<interfaces>` block referenced `summary.unusedAttachments.slice()`, `summary.unusedAttachments.filter(...)`, and `summary.unusedAttachments.length > 0` directly. These fail TypeScript strict-null-check with three TS18048 errors ("'summary.unusedAttachments' is possibly 'undefined'") because `SkeletonSummary.unusedAttachments?: UnusedAttachment[]` is declared optional in `src/shared/types.ts` (Plan 01 defensive choice; Plan 02 SUMMARY §key-decisions explicitly kept it optional for source compatibility with pre-Plan-02 consumers).
- **Fix:** Introduced a single local constant `const unusedAttachments = summary.unusedAttachments ?? [];` directly above the `filteredUnused` memo. All three downstream reads (memo empty-query branch, memo filter branch, conditional render guard) reference the local, not the raw field. This is cleaner than per-read optional chaining and matches the Plan 02 SUMMARY's stated intent (runtime always populates it; optionality is source-compat hedge).
- **Files modified:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (memo body + conditional render guard).
- **Verification:** `npx tsc --noEmit -p tsconfig.web.json` exits 0 (was 3 errors). Full test suite unchanged. All plan acceptance greps still pass (the `summary.unusedAttachments` literal count stays >=2 because the doc comments still reference it; the runtime now reads the normalised local).
- **Committed in:** `1bcf59f` (Task 2 commit, atomically with the section markup)

**2. [Minor acceptance-criterion adjustment] `grep -c "(no matches)"` is 3, not 1**

- **Found during:** Task 2 acceptance-criteria verification.
- **Issue:** Plan Task 2 acceptance criterion says `grep -c "(no matches)" src/renderer/src/panels/GlobalMaxRenderPanel.tsx equals 1 (empty-state placeholder)`. Actual count is 3 — the literal appears once in the JSX (the `<td>` empty-state placeholder) plus twice in documentation comments that the plan itself specified verbatim (the filteredUnused memo's Pitfall-6 doc block and the section's chrome-visible policy doc block). The plan's own `<interfaces>` and `<action>` blocks contain these two comment references, so matching the criterion's literal `equals 1` would require deleting the plan-specified documentation.
- **Fix:** No code change — kept the plan-specified documentation comments. The rendered markup has exactly 1 `(no matches)` placeholder (the semantic intent of the criterion).
- **Files modified:** none.
- **Verification:** `grep -n "no matches" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` shows three locations — lines 463 (filteredUnused memo Pitfall-6 comment, plan-specified), 569 (section comment, plan-specified), and 592 (the rendered `<td>`). Visual / functional semantics match the plan.

---

**Total deviations:** 2 (1 Rule-1 bug in plan-as-written + 1 acceptance-criterion mismatch against the plan's own documentation).
**Impact on plan:** All plan objectives met. F6.2 UI surface delivered with identical markup semantics; the single deviation (optional field normalisation) preserves the plan's architectural intent — the rendered UI is indistinguishable from the plan's spec.

## Issues Encountered

- None.

## Threat Model Compliance

All four threats in the plan's STRIDE register are dispositioned as expected:
- **T-05-03-01 (Injection/XSS):** `{u.attachmentName}` / `{u.sourceLabel}` / `{u.definedInLabel}` all render as React text nodes — no `dangerouslySetInnerHTML`, no HTML parsing. Parity with Phase 2 peak table.
- **T-05-03-02 (Tampering / Layer 3):** No `src/core/*` import added. `grep -cE "from ['\"].*\/core\/|from ['\"]@core" src/renderer/src/panels/GlobalMaxRenderPanel.tsx = 0`.
- **T-05-03-03 (Info Disclosure):** Accepted — user's own rig data, no PII.
- **T-05-03-04 (Repudiation / batch-scope invariant):** `selectedKeys={selectedAttachmentNames}` literal preserved at the Row component call site; the `selectedAttachmentNames` named useMemo is unchanged. arch.spec.ts:85-114 regression guard stays green.

## Next Plan Readiness (05-04 — cleanup + CLI byte-for-byte gate)

Plan 04 can start immediately:
- **UI surface live:** The section renders when a ghost-bearing fixture loads (e.g., `SIMPLE_TEST_GHOST.json` from Plan 01).
- **Design token stable:** `--color-danger` is emitted in both dev and prod builds.
- **No layout shift on clean rigs:** Section is conditional on `unusedAttachments.length > 0` — rigs with zero unused attachments see no reserved space (D-103, D-106).
- **CLI output locked:** Task 2 did not modify `scripts/cli.ts`; Plan 02's captured `/tmp/cli-phase5-plan02-baseline.txt` stays byte-identical to the current CLI output (verified by inspection — no CLI-affecting changes this plan).
- **No blockers.**

## Self-Check

Files modified verification:
- `src/renderer/src/index.css` — FOUND (modified, +9 lines net; `--color-danger: #e06b55` present at expected 2-space indent; emitted-utilities doc comment extended)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — FOUND (modified, +64 lines; `filteredUnused` memo present; `aria-label="Unused attachments"` section present; `text-danger` class reference present; Layer 3 boundary intact)

Commits verification (all present in `git log --oneline`):
- `1967d12 feat(05-03): add --color-danger theme token` — FOUND
- `1bcf59f feat(05-03): render unused-attachment section on Global panel` — FOUND

## Self-Check: PASSED

---
*Phase: 05-unused-attachment-detection*
*Plan: 03*
*Completed: 2026-04-24*
