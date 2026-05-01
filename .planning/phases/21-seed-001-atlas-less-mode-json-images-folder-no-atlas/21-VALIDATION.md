---
phase: 21
slug: seed-001-atlas-less-mode-json-images-folder-no-atlas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `21-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 (already installed) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/core/png-header.spec.ts tests/core/synthetic-atlas.spec.ts tests/core/loader-atlas-less.spec.ts -x` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~6 s quick / ~45 s full |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 6 s per task commit

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-W0-01 | Wave 0 | 0 | LOAD-02 | — | N/A | unit | `npx vitest run tests/core/png-header.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-W0-02 | Wave 0 | 0 | LOAD-03 | — | N/A | unit | `npx vitest run tests/core/synthetic-atlas.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-W0-03 | Wave 0 | 0 | LOAD-01, LOAD-04 | — | N/A | integration | `npx vitest run tests/core/loader-atlas-less.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-W0-04 | Wave 0 | 0 | LOAD-01, LOAD-04 | — | golden fixture | data | `test -d fixtures/SIMPLE_PROJECT_NO_ATLAS` | ❌ W0 | ⬜ pending |
| 21-XX-XX | core | 1+ | LOAD-02 | — | byte-only IHDR parser; no sharp import | unit | `npx vitest run tests/core/png-header.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-XX-XX | core | 1+ | LOAD-03 | — | synth atlas accepted by spine-core | unit | `npx vitest run tests/core/synthetic-atlas.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-XX-XX | loader | 1+ | LOAD-01 | — | no-atlas detect → synthesize; AtlasNotFoundError preserved on explicit path | integration | `npx vitest run tests/core/loader-atlas-less.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-XX-XX | export | 1+ | LOAD-04 | — | round-trip atlas-less → exportPlan succeeds | integration | `npx vitest run tests/core/loader-atlas-less.spec.ts -x` | ❌ W0 | ⬜ pending |
| 21-XX-XX | ipc | 1+ | LOAD-01 | — | `MissingImagesDirError` in `KNOWN_KINDS`; routes to renderer with correct `kind` field | unit | `npx vitest run tests/main/ipc.spec.ts -x` | ✅ exists | ⬜ pending |
| 21-XX-XX | summary | 1+ | LOAD-01 | — | `SkeletonSummary.atlasPath: string \| null` propagation | unit | `npx vitest run tests/main/summary.spec.ts -x` | ✅ exists | ⬜ pending |
| 21-XX-XX | regress | 1+ | success-criterion #5 | — | canonical `.atlas` projects unchanged; `AtlasNotFoundError` preserved verbatim | integration | `npx vitest run tests/core/loader.spec.ts -x` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan/Wave columns will be filled in by the planner — task IDs above are placeholders bound to requirement IDs so the planner can map them onto concrete tasks during planning.*

---

## Wave 0 Requirements

- [ ] `tests/core/png-header.spec.ts` — covers LOAD-02 (PNG byte parsing happy path + 4 negative paths: bad signature, truncated IHDR, non-PNG file, oversized dims)
- [ ] `tests/core/synthetic-atlas.spec.ts` — covers LOAD-03 (atlas text generation + spine-core acceptance + silent-skip on missing PNG via `SilentSkipAttachmentLoader`)
- [ ] `tests/core/loader-atlas-less.spec.ts` — covers LOAD-01 + LOAD-04 (loader integration + round-trip load → sample → exportPlan)
- [ ] `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` + `images/CIRCLE.png` + `images/SQUARE.png` + `images/TRIANGLE.png` + `images/SQUARE2.png` — golden fixture (copy SIMPLE_PROJECT JSON beside images-only folder, no `.atlas`)
- [ ] Extension to `tests/core/loader.spec.ts` to cover D-06 (explicit-`atlasPath`-throws-`AtlasNotFoundError` semantics preserved verbatim)
- [ ] Extension to `tests/main/summary.spec.ts` for `atlasPath: string | null` propagation
- [ ] Extension to `tests/main/ipc.spec.ts` for D-10 (`MissingImagesDirError` in `KNOWN_KINDS` and routes through `SerializableError` envelope)

*Vitest is already installed; no `npm install` step needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| User drops atlas-less project onto AppShell — Global Max Render Source + Animation Breakdown panels populate with correct dims | LOAD-01 | Drag-and-drop + renderer rendering; covered by integration tests at the IPC boundary but the visual confirmation is a UAT step | 1. Build app: `npm run build`. 2. Launch dev: `npm run dev`. 3. Drop `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` onto window. 4. Confirm panels populate with rows whose dims match PNG headers (CIRCLE 64×64, SQUARE 64×64, etc). |
| Project Settings toggle — `loaderMode: 'atlas-less'` override (D-08) flips behavior on a project with both `.atlas` and `images/` present | LOAD-01 / D-08 | UI checkbox state + reload | 1. Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (has both atlas + images). 2. Toggle "Use Images Folder as Source". 3. Reload project. 4. Confirm logs show synthesis path was taken. |
| Optimize Assets on atlas-less project exports to `images-optimized/` end-to-end | LOAD-04 | Sharp-Lanczos3 export pipeline + filesystem write + dialog flow | 1. Load atlas-less fixture. 2. File → Optimize Assets. 3. Confirm `images-optimized/` populated, dims match expected scaled values, no `AtlasNotFoundError` surfaces in renderer console. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces during plan generation)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 fixtures + 4 specs + 3 extensions)
- [ ] No watch-mode flags (`-w`, `--watch` are forbidden in commands above)
- [ ] Feedback latency < 6 s per task commit
- [ ] `nyquist_compliant: true` set in frontmatter once planner completes coverage map

**Approval:** pending
