---
phase: 40
slug: atlas-repack-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `40-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.0 (already installed; `package.json`) |
| **Config file** | `vitest.config.ts` (repo root) — `environment: 'node'` |
| **Quick run command** | `npx vitest run tests/core/repack.spec.ts tests/main/repack-worker.spec.ts tests/main/atlas-writer.spec.ts -t "<task-related test name>"` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | <1 s per unit; ~3–5 s per integration touching sharp; ~30 s full suite |

vitest's `environment: 'node'` env runs sharp end-to-end with no mocking. Verified in `tests/main/image-worker.integration.spec.ts:25`.

---

## Sampling Rate

- **After every task commit:** `npx vitest run` scoped to the task's tests (`-t "<name>"`). Sub-second for pure-TS unit tests; ~3–5 s for integration tests that touch sharp.
- **After every plan wave:** `npx vitest run tests/core/ tests/main/repack* tests/main/atlas-writer*` — runs everything Phase-40-touched.
- **Before `/gsd-verify-work`:** `npm run test` (full suite) must be green.
- **Max feedback latency:** ~5 s for per-task; ~30 s for full suite.

---

## Per-Task Verification Map

| REQ-ID    | Behavior                                                                | Test Type   | Automated Command                                                              | File Exists | Status |
|-----------|-------------------------------------------------------------------------|-------------|--------------------------------------------------------------------------------|-------------|--------|
| REPACK-01 | loose-mode SHA256 byte-identical to pre-Phase-40 baseline               | integration | `npx vitest run tests/main/repack.loose-parity.spec.ts`                        | ❌ W0       | ⬜ pending |
| REPACK-01 | `atlas` mode writes ≥1 `.atlas` + ≥1 page PNG                           | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "atlas mode"`              | ❌ W0       | ⬜ pending |
| REPACK-01 | `both` mode produces loose PNGs + `.atlas` + page PNGs in same dir      | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "both mode"`               | ❌ W0       | ⬜ pending |
| REPACK-02 | `core/repack.ts` determinism (same input → same layout)                 | unit        | `npx vitest run tests/core/repack.spec.ts -t "determinism"`                    | ❌ W0       | ⬜ pending |
| REPACK-02 | Output region count equals input region count                           | unit        | `npx vitest run tests/core/repack.spec.ts -t "preserves count"`                | ❌ W0       | ⬜ pending |
| REPACK-02 | Every output region within its page bounds                              | unit        | `npx vitest run tests/core/repack.spec.ts -t "within bounds"`                  | ❌ W0       | ⬜ pending |
| REPACK-02 | `core/repack.ts` has no sharp / fs / electron imports                   | unit (arch) | extend `tests/arch.spec.ts` core-purity grep block                              | ✅ extend   | ⬜ pending |
| REPACK-03 | Sharp-emits-truth: packer receives actual emitted dims                  | unit        | `npx vitest run tests/main/repack-worker.spec.ts -t "emits truth"`             | ❌ W0       | ⬜ pending |
| REPACK-03 | Composite pixel at (x,y) on page matches loose-mode source pixel        | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "pixel preserved"`         | ❌ W0       | ⬜ pending |
| REPACK-04 | Output `.atlas` round-trips through spine-core's `new TextureAtlas(text)` | unit      | `npx vitest run tests/main/atlas-writer.spec.ts -t "round-trip"`               | ❌ W0       | ⬜ pending |
| REPACK-04 | All region names, dims, rotation flags match pack-plan                  | unit        | `npx vitest run tests/main/atlas-writer.spec.ts -t "field parity"`             | ❌ W0       | ⬜ pending |
| REPACK-05 | Page count equals pack-plan page count                                  | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "page count"`              | ❌ W0       | ⬜ pending |
| REPACK-05 | Each page PNG ≤ atlasMaxPageSize on both axes                           | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "page bounds"`             | ❌ W0       | ⬜ pending |
| REPACK-05 | PMA sentinel passes against repack output                               | manual+probe | `node scripts/pma-probe.mjs` (gated to repack output path)                    | ✅ extend   | ⬜ pending |
| REPACK-06 | With `atlasAllowRotation=false`, no `.atlas` entry has `rotate: 90`     | integration | `npx vitest run tests/main/atlas-writer.spec.ts -t "no rotate when off"`       | ❌ W0       | ⬜ pending |
| REPACK-06 | With `atlasAllowRotation=true`, rotated entry round-trips with swapped W/H | unit     | `npx vitest run tests/main/atlas-writer.spec.ts -t "rotated round-trip"`       | ❌ W0       | ⬜ pending |
| REPACK-07 | Pre-Phase-40 `.stmproj` loads with 4 fields back-filled to defaults     | unit        | `npx vitest run tests/core/project-file.spec.ts -t "atlas defaults"`           | ✅ extend   | ⬜ pending |
| REPACK-07 | Post-Phase-40 `.stmproj` with all 4 fields round-trips losslessly       | unit        | `npx vitest run tests/core/project-file.spec.ts -t "atlas round-trip"`         | ✅ extend   | ⬜ pending |
| REPACK-07 | `project_format_version` unchanged before vs after Phase 40             | unit        | `npx vitest run tests/core/project-file.spec.ts -t "version unchanged"`        | ✅ extend   | ⬜ pending |
| REPACK-08 | atlas-source + atlas-less produce SHA256-identical `.atlas` + page PNGs | integration | `npx vitest run tests/main/repack.parity.spec.ts -t "loaderMode parity"`       | ❌ W0       | ⬜ pending |
| REPACK-09 | Varying `safetyBufferPercent` changes `.atlas` dims by expected scale   | unit        | `npx vitest run tests/main/atlas-writer.spec.ts -t "buffer dim scaling"`       | ❌ W0       | ⬜ pending |
| REPACK-09 | Toggling `sharpenOnExport` does NOT alter pack layout (SHA256 same)     | integration | `npx vitest run tests/main/repack.parity.spec.ts -t "sharpen invariant"`       | ❌ W0       | ⬜ pending |
| REPACK-10 | Oversize region aborts with locked error string, no files written       | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "oversize abort"`          | ❌ W0       | ⬜ pending |
| REPACK-10 | Sharp throw on page 2 of 3 leaves NO `.atlas` or page PNG on disk       | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "atomic rollback"`         | ❌ W0       | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The following test files **do not yet exist** and must land before / during the first Phase 40 task that needs them:

- [ ] `tests/core/repack.spec.ts` — pack-math determinism, count preservation, page-bounds, page-spawn (REPACK-02)
- [ ] `tests/main/atlas-writer.spec.ts` — libgdx round-trip, rotation, buffer dim scaling (REPACK-04, REPACK-06, REPACK-09)
- [ ] `tests/main/repack-worker.spec.ts` — sharp-emits-truth, page count/bounds, oversize abort, atomic rollback (REPACK-03, REPACK-05, REPACK-10)
- [ ] `tests/main/repack.loose-parity.spec.ts` — loose-mode SHA256 baseline regression (REPACK-01)
- [ ] `tests/main/repack.parity.spec.ts` — cross-loaderMode parity + sharpen-invariant (REPACK-08, REPACK-09)
- [ ] `tests/fixtures/repack-baselines.json` — SHA256 baselines per D-06
- [ ] `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` — committed expected `.atlas` text per D-06
- [ ] `scripts/repack-refresh-baselines.mjs` — manual baseline refresh script per D-07
- [ ] **Extend** `tests/arch.spec.ts` core-purity grep block to include `core/repack.ts`
- [ ] **Extend** `tests/core/project-file.spec.ts` for the 4 new atlas fields (REPACK-07)

**Framework install:** none required. vitest 4.0.0, sharp 0.34.5, @esotericsoftware/spine-core 4.2.x, maxrects-packer 2.7.3 are all installed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OptimizeDialog "Output" card renders correctly with atlas-knobs revealing on `atlas`/`both` | REPACK-01 (UI surface, D-01) | Pure-JSX/CSS layout; no headless test for visual hierarchy | 1. `npm run dev` 2. Open a project with regions 3. Click "Optimize Selected" 4. Verify Output card appears above Quality card 5. Verify radio defaults to `loose`, atlas knobs hidden 6. Select `atlas` → 3 knobs reveal (`atlasMaxPageSize` dropdown, `atlasAllowRotation` checkbox, `atlasPadding` number) 7. Hover `atlasAllowRotation` → tooltip shows |
| Progress UI renders distinct `resize` + `composite` phases | REPACK-05 (D-05) | Visual smoothness test; not amenable to vitest assertion | 1. `npm run dev` 2. Run atlas export with ≥20 regions to force visible phase transition 3. Verify counter resets between `resize` and `composite` phases (no jump) 4. Verify completion banner shows after final composite |
| User-visible toast on oversize abort matches locked error string verbatim | REPACK-10 | Toast composition spans renderer + IPC error channel | 1. Set `atlasMaxPageSize=1024` 2. Use a region whose post-quality-knob dim exceeds 1024 (apply a large `safetyBufferPercent` to force it) 3. Click Export with `atlas` mode 4. Verify toast text exactly: `"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 s (per-task) / < 30 s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
