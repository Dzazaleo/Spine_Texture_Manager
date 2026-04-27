---
phase: 5
slug: unused-attachment-detection
status: signed-off
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
signed_off: 2026-04-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/core/usage.spec.ts tests/core/summary.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5–8 seconds (quick) / ~15–20 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <touched spec(s)>` — per-task filtered vitest.
- **After every plan wave:** Run `npm run test` — full suite.
- **Before `/gsd-verify-work`:** Full suite must be green + CLI golden diff byte-identical.
- **Max feedback latency:** ≤ 20 seconds (full suite worst case).

---

## Per-Task Verification Map

*Populated by executor at Plan 04 close — each row sources from the originating plan's `<automated>` verify block.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T05-01-01 | 05-01 | 1 | F6.1, F6.2 | T-05-01-01 | structuredClone-safe IPC shape (primitives + arrays only; no Set/Map/class) | typecheck | `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json` | ✅ | ✅ green |
| T05-01-02 | 05-01 | 1 | F6.1 | — | N/A (test fixture) | fixture | `node -e "const j = require('./fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json'); console.log(j.skins[0].attachments.CIRCLE.GHOST.width)"` | ✅ | ✅ green |
| T05-01-03 | 05-01 | 1 | F6.1 | — | N/A (RED spec) | unit (RED in W0) | `npm run test -- tests/core/usage.spec.ts` | ✅ | ✅ green (RED→GREEN Plan 02) |
| T05-01-03b | 05-01 | 1 | F6.1 | — | F6.1 sanity canary: Defined ⊇ Used invariant (sampler-bug canary per 05-RESEARCH.md §Validation Architecture) | unit | `npm run test -- tests/core/usage.spec.ts -t "invariant: every globalPeaks"` | ✅ | ✅ green |
| T05-01-04 | 05-01 | 1 | F6.2 | T-05-01-01 | structuredClone round-trip (IPC shape preserves through Electron serialize/deserialize) | unit (RED in W0) | `npm run test -- tests/core/summary.spec.ts` | ✅ | ✅ green (RED→GREEN Plan 02) |
| T05-02-01 | 05-02 | 2 | F6.1 | T-05-02-01 | pure-TS DOM-free + zero I/O (no spine-core value imports, no fs, no process) | unit | `npm run test -- tests/core/usage.spec.ts` | ✅ | ✅ green |
| T05-02-02 | 05-02 | 2 | F6.1 | T-05-02-01 | projection-only wiring (src/main/summary.ts import + call + return field; no spine-core leak into IPC boundary) | unit | `npm run test -- tests/core/summary.spec.ts` | ✅ | ✅ green |
| T05-02-03 | 05-02 | 2 | F6.1, F6.2 | T-05-02-03, T-05-02-04 | D-100 sampler lock + D-102 CLI lock (scripts/cli.ts + src/core/sampler.ts byte-unchanged) | invariant | `npm run test && test -z "$(git diff scripts/cli.ts)" && test -z "$(git diff src/core/sampler.ts)"` | ✅ | ✅ green |
| T05-03-01 | 05-03 | 3 | F6.2 | — | design-token emission (--color-danger: #e06b55 WCAG AA on --color-panel; Tailwind v4 JIT tree-shakes if unused) | build | `npx electron-vite build && find out/renderer/assets -name 'index-*.css' -exec grep -l "e06b55\|text-danger" {} \;` | ✅ | ✅ green |
| T05-03-02 | 05-03 | 3 | F6.2 | T-05-03-01, T-05-03-02, T-05-03-04 | XSS-safe React text + Layer 3 boundary + batch-scope regression guard (selectedKeys={selectedAttachmentNames} preserved) | integration | `npx tsc --noEmit -p tsconfig.web.json && npx electron-vite build && npm run test -- tests/arch.spec.ts` | ✅ | ✅ green |
| T05-04-01 | 05-04 | 4 | F6.1, F6.2 | T-05-04-01, T-05-04-02 | full suite + locked-file audit + CLI byte-for-byte (content-identical; non-deterministic wall-clock timing delta excluded) | regression | `npm run test && test -z "$(git diff scripts/cli.ts)" && test -z "$(git diff src/core/sampler.ts)"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Task IDs follow the `T05-{plan}-{task}` pattern, mirroring the Phase 4 `T-04-01-01` convention used by the arch.spec.ts regression guard comment. `T05-01-03b` is the F6.1 sanity canary invariant, intentionally scoped to a sub-task since it locks an orthogonal contract (sampler-bug canary at the detector boundary).

---

## Wave 0 Requirements

- [x] `tests/core/usage.spec.ts` — **new** stubs for F6.1 (ghost-def, cross-skin, setup-pose semantics, dim aggregation, non-textured filter)
- [x] `tests/core/summary.spec.ts` — **extend** (`summary.unusedAttachments` field exists + empty array on SIMPLE_TEST.json)
- [x] `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` + `SIMPLE_TEST_GHOST.atlas` — **new** ghost-def fork per RESEARCH.md Finding #4 (12-line JSON diff adding GHOST region to default skin's CIRCLE slot dict; 2-line atlas diff)

*Existing vitest + arch.spec.ts infrastructure carries the rest (Layer 3 boundary checks auto-scan new files).*

*Path correction from plan draft: the summary spec lives at `tests/core/summary.spec.ts` (where Plans 01/02 actually extended it), not `tests/main/summary.spec.ts` as the original VALIDATION scaffold stated. The executor applied the correction per 05-PATTERNS.md §"Path correction".*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unused `<section>` renders above peak table with warm/terracotta header in `text-danger`; row cells in standard `text-fg`/`text-fg-muted` (D-105) | F6.2 | Visual — no DOM assertion can confirm perceived warm/terracotta hue or WCAG-validated contrast on a live render | Drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` → section appears with `⚠ 1 unused attachment`; header red, cells neutral; JetBrains Mono renders U+26A0 cleanly (fall back to inline SVG if garbled per Pitfall 9 of RESEARCH) |
| SearchBar filters BOTH peak table AND unused section consistently by substring match (D-107) | F6.2 | Cross-section UI interaction — integration between SearchBar state + two filter pipelines + consistent visibility toggle | Drop GHOST fixture → type "GHO" → peak table empties, unused row remains; type "CIRC" → peak table shows 1 row, unused section collapses (filtered empty); clear filter → both re-expand |
| Layout shift on dirty rig IS the alarm signal (D-106) — no reserved space on clean rigs, section pushes peak table down when non-empty | F6.2 | Visual — layout reflow is a perceptual UX signal, not a DOM invariant | Drop SIMPLE_TEST.json (clean) → no section, peak table sits flush with SearchBar; drop GHOST fixture → section appears, peak table shifts down; swap back → layout returns |
| CLI byte-for-byte unchanged (D-102) | F6.2 invariant | CLI golden compare — captured in automated test but manual sanity confirms terminal rendering identical | `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → compare byte-for-byte against a reference output captured before Phase 5 changes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills table above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (fixtures + spec stubs)
- [x] No watch-mode flags (vitest `run` mode only, never `watch`)
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed-off 2026-04-24 (automated exit-criteria sweep green; human-verify on SIMPLE_TEST + SIMPLE_TEST_GHOST drops completes the gate — see 05-04-SUMMARY.md for the checkpoint outcome)
