---
phase: 3
slug: animation-breakdown-panel
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-23
verified: 2026-04-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution of the Animation Breakdown panel.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (pure-TS specs) + electron-vite build + arch.spec grep gates |
| **Config file** | `vitest.config.ts` (root) + `tests/arch.spec.ts` (Layer 3 defense) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run typecheck && npx electron-vite build` |
| **Estimated runtime** | ~15 seconds (quick) / ~45 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite (`npm run test && npm run typecheck && npx electron-vite build`) must be green + Plan 03-03 `checkpoint:human-verify` signed off.
- **Max feedback latency:** 15 seconds on commit; 45 seconds on wave close.

---

## Per-Task Verification Map

*Planner populates Task IDs during plan generation. Template rows seeded from RESEARCH §6 Validation Architecture (correctness → integration → human-verify).*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T2 | 01 | 1 | F4.1–F4.3 | — | Sampler extension emits both `globalPeaks` and `perAnimation` maps; N1.6 determinism holds | unit | `npm run test -- tests/core/sampler.spec.ts` | ✅ W1 (augmented) | ✅ green |
| 03-01-T3 | 01 | 1 | F4.1–F4.3 | — | `analyzeBreakdown(samplerOutput, skeletonData)` produces `AnimationBreakdown[]` with correct dedupe + Setup Pose card | unit | `npm run test -- tests/core/analyzer.spec.ts` | ✅ W1 (augmented) | ✅ green |
| 03-01-T2 | 01 | 1 | F4.3 | — | `boneChainPath(slot, attachmentName)` traverses `Bone.parent` to root correctly on CHAIN_8 + CTRL fixtures | unit | `npm run test -- tests/core/bones.spec.ts` | ✅ W1 (new) | ✅ green |
| 03-01-T4 | 01 | 1 | F4.1–F4.4 | — | IPC payload `SkeletonSummary.animationBreakdown: AnimationBreakdown[]` is structuredClone-safe | unit | `npm run test -- tests/main/summary.spec.ts tests/main/ipc.spec.ts` | ✅ W1 (augmented) | ✅ green |
| 03-01-T4 | 01 | 1 | F4.1–F4.4 | — | `src/core/*` boundary defense covers new files; no DOM/Node I/O imports | integration | `npm run test -- tests/arch.spec.ts` | ✅ W1 (augmented) | ✅ green |
| 03-01-T4 | 01 | 1 | — | — | `scripts/cli.ts` output byte-for-byte identical vs `.cli-golden.txt` | integration | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` + diff | ✅ existing | ✅ green |
| 03-01-T2 | 01 | 1 | N2.1 | — | N2.1 perf gate (<500ms on SIMPLE_TEST) preserved after sampler extension | unit | `npm run test -- tests/core/sampler.spec.ts` (perf assert) | ✅ existing | ✅ green |
| 03-02-T1 | 02 | 2 | F4.1–F4.4 | — | `src/renderer/src/components/AppShell.tsx` owns tab state; filename chip moved from GlobalMaxRenderPanel | typecheck+grep | `npm run typecheck:web && grep FileChip src/renderer/src/components/AppShell.tsx` | ✅ W2 (new) | ✅ green |
| 03-02-T2 | 02 | 2 | F4.1–F4.4 | — | `src/renderer/src/panels/AnimationBreakdownPanel.tsx` renders Setup Pose top card + N animation cards; collapsed by default except Setup Pose | typecheck+grep | `npm run typecheck:web && grep "setup-pose" src/renderer/src/panels/AnimationBreakdownPanel.tsx` | ✅ W2 (new) | ✅ green |
| 03-02-T3 | 02 | 2 | F3.1 (D-72) | — | `GlobalMaxRenderPanel.tsx` Source Animation chip upgraded to `<button>` with `onJumpToAnimation` callback | typecheck+grep | `grep "onJumpToAnimation" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | ✅ existing (touched) | ✅ green |
| 03-03-T1 | 03 | 3 | F4.1–F4.4 | T-03-03-01 | `App.tsx` wraps `status:'loaded'` branch in `<AppShell>`; renderer boots without console errors | build | `npx electron-vite build` | ✅ existing (touched) | ✅ green |
| 03-03-T2 | 03 | 3 | F4.1–F4.4 | T-03-03-02 | SIMPLE_TEST drop → tab switch + Setup Pose + expand/collapse + empty-state + Bone Path + Source Animation jump-target all work | manual | `checkpoint:human-verify` | manual | ✅ green (signed off 2026-04-23 after gap-fix `dfbcfa5` for namespaced animation names) |
| 03-03-T3 | 03 | 3 | — | — | 03-VALIDATION.md frontmatter + STATE.md updates land under post-verify commit | docs | manual grep | ✅ existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Threat Ref column left `—` pending Plan 03 threat-model production (see §`<threat_model>` block per workflow step 5.55). Security-sensitive surfaces in Phase 3 are limited to IPC envelope size growth (animationBreakdown list); no new trust boundaries introduced.*

---

## Wave 0 Requirements

New or augmented test files required before Wave 2/3 plans can verify:

- [ ] `tests/core/sampler.spec.ts` — AUGMENT: per-animation emission + SCALE_DELTA_EPSILON detection + AttachmentTimeline detection + N1.6 determinism on perAnimation map + setup-pose baseline emission.
- [ ] `tests/core/analyzer.spec.ts` — AUGMENT: `analyzeBreakdown()` fold, Setup Pose card construction, per-card dedupe by attachmentName, card ordering (setup-pose first, then skeleton JSON animation order), empty-animation → empty rows[].
- [ ] `tests/core/bones.spec.ts` — NEW: `boneChainPath(slot, attachmentName)` against CIRCLE (CTRL parent, 4 tokens) + TRIANGLE (CHAIN_8, 11 tokens) + SQUARE (SQUARE2 pre-scaled bone) + root edge case.
- [ ] `tests/main/summary.spec.ts` — AUGMENT: `SkeletonSummary.animationBreakdown` field structured-clone-safe (no Maps, no classes).
- [ ] `tests/main/ipc.spec.ts` — AUGMENT: IPC envelope includes `animationBreakdown` field; renderer-shaped payload.
- [ ] `tests/arch.spec.ts` — AUGMENT: Layer 3 grep extended for new files (`AppShell.tsx`, `AnimationBreakdownPanel.tsx`, `bones.ts`); sampler-lifecycle grep extended to cover new per-animation branches.

Framework already installed (Phase 0 Plan 00-01). No new deps.

Wave 0 gaps closed during Wave 1 (tests land same-commit as the core additions per Phase 0/1/2 Rule 2 precedent).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drop SIMPLE_TEST.json → two tabs render; Global is active by default | F4.1 (implicit, AppShell) | Electron window paint + DOM render only visible at runtime | `npm run dev`, drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, confirm `[ Global ] [ Animation Breakdown ]` tab strip visible, Global active |
| Tab switch Animation → Setup Pose card expanded, N animation cards collapsed | F4.1, F4.2 | Interactive state transition | Click `Animation Breakdown` tab; confirm Setup Pose shows 3 rows; animation cards show `▸ {name} — {N} unique assets referenced` |
| Click collapsed animation card header → expands inline with rows | F4.1 | Interactive state transition | Click `▸ SIMPLE_SCALE`; confirm expands to show affected rows in Scale DESC order |
| "No assets referenced" empty-state renders for animations with zero affected attachments | F4.1 | Fixture-dependent runtime verification | If SIMPLE_ROTATION produces empty set (possible per RESEARCH §Pitfall 1), confirm `— No assets referenced` header + muted row on expand |
| Bone Path column renders with `→` separator, mid-ellipsis on overflow, hover tooltip shows full path | F4.3 | Visual + DOM hover | On TRIANGLE row, hover the Bone Path cell; confirm `title={fullPath}` tooltip reveals untruncated chain |
| Override button renders disabled with "Coming in Phase 4" tooltip | F4.4 | Visual verification | Hover any row's Override button; confirm `disabled` attribute + tooltip text |
| Cross-card search filters all cards; auto-expands cards with matches; highlight `<mark>` | D-70, D-71 | Interactive state transition | Type `CIRCLE` in panel search; confirm only cards containing CIRCLE remain; collapsed cards with matches auto-expand; `<mark>` highlight wraps match |
| Source Animation chip in Global panel upgraded to button; clicking jumps to Animation tab + scrolls + flashes target card | D-72 (F3.1), D-52, D-66 | Cross-panel interactive flow | On Global tab, click CIRCLE's Source Animation `PATH` chip; confirm tab switches to Animation Breakdown, PATH card scrolls into view + auto-expands + flashes ring-accent briefly |
| Complex rig human-verify (Jokerman / Girl) exercises AttachmentTimeline detection | D-54 | SIMPLE_TEST has zero AttachmentTimelines; cannot cover timeline-arm detection | Drop `fixtures/Jokerman/jokerman.json`; confirm at least one animation card lists an attachment that would be invisible (e.g. 'blink' swap) under a pure-scale-delta filter |
| Packaged `.dmg` launches + drop flow intact (Phase 1 Plan 01-05 gate preserved) | N4.1, N4.2 | Electron packaged-app behavior differs from dev runtime (historical: sandbox + CJS preload + CJS main) | `npx electron-vite build && npx electron-builder --mac dmg`; open `release/*.dmg`; drag SIMPLE_TEST.json; confirm tabs + Animation Breakdown render identically |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s quick / 45s full
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Human-verify checkpoint scheduled on final plan (Plan 03-03 per RESEARCH §7 wave ordering)

**Approval:** ✅ APPROVED 2026-04-23. Plan 03-01 + Plan 03-02 + Plan 03-03 all GREEN; 88 tests + 6 arch guards + electron-vite build + CLI byte-for-byte diff empty. Plan 03-03 `checkpoint:human-verify` signed off 2026-04-23 after one gap-fix (`dfbcfa5` — analyzer per-animation key routing for namespaced Spine animation names; regression test added covering CHAR/BLINK + LOOK/AROUND). Phase 3 ready for `/gsd-verify-work 3`.
