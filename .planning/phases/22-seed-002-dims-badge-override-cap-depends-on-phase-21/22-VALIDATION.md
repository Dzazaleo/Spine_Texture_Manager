---
phase: 22
slug: seed-002-dims-badge-override-cap-depends-on-phase-21
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `22-RESEARCH.md § Validation Architecture`. Note D-04 was REVISED post-research from strict-ceil-equality to generous passthrough (`isPassthrough = isCapped || peakAlreadyAtOrBelowSource`); test names below still reference "DIMS-04 passthrough" but the assertion shape follows the revised D-04 in `22-CONTEXT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (already installed; configured at `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (existing — no new config needed) |
| **Quick run command** | `npx vitest run tests/core/loader.spec.ts tests/core/export.spec.ts tests/core/loader-dims-mismatch.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5s quick / ~45s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/loader.spec.ts tests/core/export.spec.ts tests/core/loader-dims-mismatch.spec.ts` (~5s)
- **After every plan wave:** Run `npm run test` (~45s)
- **Before `/gsd-verify-work 22`:** Full suite must be green
- **Max feedback latency:** 5 seconds (quick run)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DIMS-01 | Loader populates `canonicalW/H` + `actualSourceW/H` + `dimsMismatch` on `DisplayRow` (canonical-atlas + atlas-less paths) | unit (extension) | `npx vitest run tests/core/loader.spec.ts -t "DIMS-01"` | ✅ extends existing | ⬜ pending |
| DIMS-01 | Atlas-extract path (e.g., Jokerman) leaves `actualSourceW/H` undefined + `dimsMismatch:false` | unit | `npx vitest run tests/core/loader.spec.ts -t "atlas-extract dimsMismatch false"` | ✅ extends existing | ⬜ pending |
| DIMS-02 | Badge renders when `row.dimsMismatch===true`; absent when false — `GlobalMaxRenderPanel` | RTL component | `npx vitest run tests/renderer/global-max-virtualization.spec.tsx -t "dims-badge"` | ✅ extends existing | ⬜ pending |
| DIMS-02 | Badge renders when `row.dimsMismatch===true`; absent when false — `AnimationBreakdownPanel` | RTL component | `npx vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "dims-badge"` | ✅ extends existing | ⬜ pending |
| DIMS-03 | `buildExportPlan` caps `cappedEffScale = min(effScale, sourceLimit)` when `dimsMismatch` (uniform — aspect-ratio invariant) | unit | `npx vitest run tests/core/export.spec.ts -t "DIMS-03 cap"` | ✅ extends existing | ⬜ pending |
| DIMS-03 | core ↔ renderer parity: cap math byte-identical between `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` | parity grep + behavioral | `npx vitest run tests/core/export.spec.ts -t "core ↔ renderer parity"` | ✅ extends existing parity block | ⬜ pending |
| DIMS-04 | `passthroughCopies[]` populated when `isCapped \|\| peakAlreadyAtOrBelowSource` (generous formula); `entries[]` excludes those rows | unit | `npx vitest run tests/core/export.spec.ts -t "DIMS-04 passthrough"` | ✅ extends existing | ⬜ pending |
| DIMS-04 | `OptimizeDialog` renders muted "COPY" indicator for `plan.passthroughCopies` rows (UX parity with `excludedUnused`) | RTL component | `npx vitest run tests/renderer/optimize-dialog-passthrough.spec.tsx` | ❌ Wave 0 NEW | ⬜ pending |
| DIMS-04 | `image-worker` invokes `fs.promises.copyFile` (NOT sharp) for `passthroughCopies` rows; `mkdir` parents created for nested region paths | main-process unit | `npx vitest run tests/main/image-worker.passthrough.spec.ts` | ❌ Wave 0 NEW | ⬜ pending |
| DIMS-05 | Round-trip: load drifted project → `buildExportPlan` → `passthroughCopies.length === fileCount` AND `entries.length === 0` | integration | `npx vitest run tests/core/loader-dims-mismatch.spec.ts -t "DIMS-05"` | ❌ Wave 0 NEW | ⬜ pending |
| DIMS-05 | `runExport` on an all-passthrough plan writes byte-identical output PNGs (no Lanczos, no quality degradation) | main-process integration | `npx vitest run tests/main/image-worker.passthrough.spec.ts -t "byte-identical"` | ❌ Wave 0 NEW | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

These test files do NOT yet exist and must be created in Wave 0 (or as part of the plan that introduces the corresponding production code):

- [ ] `tests/renderer/optimize-dialog-passthrough.spec.tsx` — DIMS-04 OptimizeDialog "COPY" muted-row treatment
- [ ] `tests/main/image-worker.passthrough.spec.ts` — DIMS-04 / DIMS-05 main-process passthrough (covers `fs.promises.copyFile`, parent-dir `mkdir`, byte-identical output, R8 nested-region paths from RESEARCH.md)
- [ ] `tests/core/loader-dims-mismatch.spec.ts` — DIMS-05 round-trip integration spec (programmatic mutation of `fixtures/SIMPLE_PROJECT_NO_ATLAS/` PNGs in `beforeAll` per RESEARCH.md R7; uses `fs.readdirSync(images/)` length to avoid hardcoded counts)

Existing files extended (no Wave 0 install needed): `tests/core/loader.spec.ts`, `tests/core/export.spec.ts`, `tests/renderer/global-max-virtualization.spec.tsx`, `tests/renderer/anim-breakdown-virtualization.spec.tsx`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge icon visual styling (size, color, position) reads as consistent with existing panel iconography | DIMS-02 | RTL test asserts presence + accessible name; visual design judgement needs human eye | Load project with drifted PNGs in dev (`npm run dev`), open Global panel and Animation Breakdown, confirm badge renders cleanly at 100% zoom + dark mode |
| OptimizeDialog "COPY" indicator placement reads as consistent with `excludedUnused` muted styling | DIMS-04 | Visual parity check | Open OptimizeDialog with a drifted project, confirm muted-row treatment matches the Round 1 `excludedUnused` rows positionally and tonally |
| Tooltip wording renders correctly with concrete dim values substituted | DIMS-02 | Layout edge cases (very long region names, large dim numbers wrapping) | Hover over badge, confirm tooltip text "Source PNG (W×H) is smaller than canonical region dims (W×H). Optimize will cap at source size." renders with no clipping or layout break |

---

## Validation Sign-Off

- [ ] All tasks have automated verify command or Wave 0 dependency listed above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces during plan generation)
- [ ] Wave 0 covers all MISSING references (3 new test files listed above)
- [ ] No watch-mode flags in any task command (`vitest run` not `vitest`)
- [ ] Feedback latency < 5s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalizes Wave 0

**Approval:** pending
