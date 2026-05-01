---
phase: 20
slug: documentation-builder-feature
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
updated: 2026-05-01
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test -- tests/core/documentation` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command (each is < 30s).
- **After every plan wave:** Run `npm run test`.
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

Verbatim from each plan's `<verify>` and `<acceptance_criteria>` blocks. Each row is one executable signal that the task landed correctly.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-T1 | 20-01 | 1 | DOC-03, DOC-05 | T-20-01, T-20-04 | Per-field validator rejects malformed Documentation; drift helper preserves descriptions on rebind | unit (vitest) | `npm run test -- tests/core/documentation.spec.ts` | tests/core/documentation.spec.ts (NEW) | ✅ planned |
| 20-01-T2 | 20-01 | 1 | DOC-05 | T-20-03 | Validator pre-massage + materializer back-fill keep Phase 8-era files loadable; round-trip identity | unit (vitest) | `npm run test -- tests/core/project-file.spec.ts tests/core/documentation.spec.ts tests/arch.spec.ts` | tests/core/project-file.spec.ts (EXTEND) | ✅ planned |
| 20-02-T1 | 20-02 | 2 | DOC-01, DOC-03 | T-20-07, T-20-10, T-20-11 | 5-modal ARIA scaffold + Sections pane sub-sections render; Tailwind v4 literal-class discipline | typecheck + arch | `npm run typecheck && npm run test -- tests/arch.spec.ts` | src/renderer/src/modals/DocumentationBuilderDialog.tsx (NEW) | ✅ planned |
| 20-02-T2 | 20-02 | 2 | DOC-01, DOC-03 | T-20-08, T-20-12 | Documentation button enabled + opens modal; drift policy intersects on load | typecheck + full suite | `npm run typecheck && npm run test` | src/renderer/src/components/AppShell.tsx (EXTEND) | ✅ planned |
| 20-03-T1 | 20-03 | 3 | DOC-02 | T-20-13, T-20-16 | RED-first spec scaffold compiles against locked TracksPane contract | typecheck (TDD RED) | `npm run typecheck` | tests/renderer/documentation-builder-dialog.spec.tsx (NEW) | ✅ planned |
| 20-03-T2 | 20-03 | 3 | DOC-02 | T-20-13, T-20-14, T-20-17 | TracksPane DnD honours effectAllowed='copy' + namespaced MIME + defensive name validation; full spec passes | TDD GREEN (vitest jsdom) | `npm run typecheck && npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx` | src/renderer/src/modals/DocumentationBuilderDialog.tsx (EXTEND) | ✅ planned |
| 20-04-T1 | 20-04 | 4 | DOC-04 | T-20-19, T-20-20, T-20-26 | renderDocumentationHtml is pure + self-contained + escapes XSS attempts; deterministic snapshot | unit (vitest) | `npm run test -- tests/main/doc-export.spec.ts` | src/main/doc-export.ts (NEW), tests/main/doc-export.spec.ts (NEW) | ✅ planned |
| 20-04-T2 | 20-04 | 4 | DOC-04, DOC-05 | T-20-21, T-20-22, T-20-25, T-20-27 | IPC channel registered through 3-tier; AppShell threads atlasPreviewState/savingsPctMemo/null lastOutDir; round-trip identity proven | full suite + typecheck | `npm run test && npm run typecheck` | src/main/ipc.ts (EXTEND), src/preload/index.ts (EXTEND), src/shared/types.ts (EXTEND), src/renderer/src/modals/DocumentationBuilderDialog.tsx (EXTEND), src/renderer/src/components/AppShell.tsx (EXTEND), tests/core/documentation-roundtrip.spec.ts (NEW) | ✅ planned |

*Status: ✅ planned · ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** every task in waves 1-4 has an `<automated>` verify command. Wave-end checks (`npm run test`) re-run on every plan boundary; no 3-task gap exists between automated signals.

---

## Wave 0 Requirements

Phase 20 inlines Wave-0 test scaffolding into the same plan that ships the corresponding feature, avoiding a separate Wave-0 pass:

- [x] `tests/core/documentation.spec.ts` — validator coverage + drift helper (lands in Plan 20-01 Task 1)
- [x] `tests/core/project-file.spec.ts` extension — round-trip with `documentation` slot + Phase 8-era forward-compat full-pipeline test (Plan 20-01 Task 2)
- [x] `tests/main/doc-export.spec.ts` — golden-file HTML export + self-containment + XSS escape (Plan 20-04 Task 1)
- [x] `tests/renderer/documentation-builder-dialog.spec.tsx` — modal smoke + tab switching + DnD (Plan 20-03 Task 1, RED-first; satisfied by Plan 20-03 Task 2)
- [x] `tests/core/documentation-roundtrip.spec.ts` — DOC-05 round-trip identity for representative + Phase 8-era shapes (Plan 20-04 Task 2)

Existing vitest infrastructure (`vitest.config.ts`, `tests/arch.spec.ts`) covers config and Layer-3 invariants without modification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop animation from side list onto a track container | DOC-02 | HTML5 native DnD requires a real browser DOM; jsdom does not implement DnD beyond synthetic event dispatch | 1. `npm run dev`, load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. 2. Click Documentation button. 3. Switch to Animation Tracks pane. 4. Click "+ Add Track" to create Track 0. 5. Drag an animation from the side list onto the track container; confirm new entry appears with default mixTime=0.25 + loop=false. |
| HTML export opens correctly in a browser offline | DOC-04 | Browser rendering is the contract | 1. With docs authored, switch to Export pane. 2. Click "Export HTML…". 3. Choose a save location. 4. Open the resulting `.html` file in Safari/Firefox/Chrome with no network. 5. Confirm: hero row + chip strip + optimization config card + general notes card + animation tracks table + control bones + skins + events render with no broken refs (no missing icons, no missing fonts, no `file://` 404s). |
| Cross-platform DnD drag-image consistency | DOC-02 | Electron Chromium quirk on macOS/Windows/Linux | Repeat manual DnD test on each OS the project ships to (per release matrix); confirm drag image renders identically (no missing thumbnail). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (validator stub, round-trip stub, golden-file stub, modal stub, drift helper)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter (Wave 0 inlined into Wave 1+ plans)

**Approval:** ready for executor — every plan task carries an automated verify signal and the per-task verification map mirrors the actual coverage.
