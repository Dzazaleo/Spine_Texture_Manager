# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-26
**Phases:** 12 (0–9 + 08.1 + 08.2 inserted) | **Plans:** 62 | **Tasks:** 118
**Test baseline at close:** 331 passed + 1 skipped + 1 todo
**Timeline:** 2026-04-22 → 2026-04-26 (5 days, 386 commits)

### What Was Built

- **Headless Spine math core** — pure-TS sampler computing peak world-AABB per attachment via spine-core's `computeWorldVertices` after `updateWorldTransform(Physics.update)`. Layer 3 invariant: zero DOM/`fs`/`sharp` imports in `src/core/`.
- **Two analysis panels** — Global Max Render Source (sortable, searchable, selectable) + Animation Breakdown (collapsible per-anim cards). Phase 3 D-72 jump-target system links them.
- **Per-attachment scale overrides** with D-91 source-fraction semantics (100% = source dims, never surpassed). Persisted in `.stmproj`. **LOCKED uniform-only** for export sizing.
- **Image export pipeline** — sharp Lanczos3 at compression level 9, atomic Pattern-B write (`.tmp` + `fs.rename`), cooperative cancel, skip-on-error progress UI.
- **Atlas Preview modal** — `maxrects-packer` projection + canvas drawImage, before/after dims + page efficiency, dblclick-to-jump UX.
- **Crash-safe `.stmproj` save/load** — discriminated-union typed-error envelope (8 kinds), locate-skeleton recovery from drag-drop AND toolbar Open paths, dirty-guard 3-button SaveQuitDialog with three reason discriminators.
- **Complex-rig hardening** — `worker_threads` Worker (greenfield), TanStack Virtual at N≥100, Settings + Help dialogs. **N2.2 wall-time: 606 ms on `fixtures/Girl/` — ~17× under contract.**

### What Worked

- **Phase 0 derisk paid off massively.** Locking the math contract before any UI saved 2–3 days of rework across Phases 1–9. Every UI phase shipped on a stable headless contract.
- **Layer 3 arch.spec invariant** (no `src/core/*` imports of DOM / `fs` / `sharp`) caught violations at CI before review. Held across all 12 phases without a single exception.
- **Wave-0 RED-spec scaffolding pattern** (Phase 8 Plan 01 → reused in 8.1) — type contract + grep-anchored RED specs land first; downstream plans drive each spec to GREEN. Eliminated rework on test contracts.
- **Hand-rolled ARIA modal scaffold** cloned across five dialogs (Override → Optimize → AtlasPreview → SaveQuit → Settings → Help). One pattern, zero modal-library deps, consistent UX.
- **Atomic Pattern-B write idiom** transferred cleanly from Phase 6 (sharp export) into Phase 8 (`.stmproj` save) — load-bearing across two subsystems unchanged.
- **D-102 byte-frozen invariants** (locked-file diffs vs baseline = 0 lines) caught accidental changes to `cli.ts` / `sampler.ts` / `loader.ts` early. CLI byte-for-byte unchanged across all 12 phases.

### What Was Inefficient

- **Phase 7 Atlas Preview required 8-commit gap-fix chain during live UAT.** Electron `net.fetch(file://)` produced `net::ERR_UNEXPECTED` inside `protocol.handle` — needed `fs.readFile + new Response(...)` workaround. The original plan's `pathToFileURL` premise was wrong. **Lesson: prototype Electron protocol-handler I/O before committing to a plan path.**
- **Decimal phase insertions (08.1, 08.2)** were necessary because Phase 8 verification surfaced reachability gaps (VR-01/VR-02/VR-03) AND a Cmd+O accelerator gating bug not caught until 08.1 UAT. **Lesson: human-verify gates produce real findings — budget for 1–2 decimal phases per major phase that introduces new error states.**
- **Phase 4 D-91 semantics rewrite** mid-phase (percent-of-peak → percent-of-source-dims) was caught only at human-verify. **Lesson: lock semantics decisions in CONTEXT before plan freeze; supersede-with-forward-reference is the recovery pattern but expensive.**
- **MILESTONES.md auto-population** dumped raw "One-liner:" stubs from inconsistent SUMMARY.md formatting. Required manual curation. **Lesson: enforce consistent SUMMARY.md frontmatter (`one_liner:`) so milestone close auto-extracts cleanly.**

### Patterns Established

- **Wave-0 RED-spec scaffolding** — type contract + grep-anchored RED specs land first, downstream plans drive each spec GREEN. (Phase 8 Plan 01 precedent, reused in 8.1.)
- **Discriminated-union typed-error envelope with kind-specific payload arms** — `Extract<Union, { kind: 'X' }>` narrowing exposes payload fields at the call site without per-site casts. (D-158/D-171.)
- **`Exclude<Union['kind'], PayloadArmKind>` at forwarder cast sites** — compile-time guard against accidentally producing the recovery-payload arm without populating its threaded fields. Zero runtime cost. (Phase 8.1 Plan 02.)
- **Pure-TS canonical + byte-identical renderer copy + parity spec** — `src/core/foo.ts` + `src/renderer/src/lib/foo-view.ts` locked by parity describe block. Used for `overrides`, `export`, `atlas-preview`. (Phase 4 D-75 precedent.)
- **NOT_YET_WIRED preload-stub pattern** — when extending the `Api` interface, land typed stubs in preload first to keep typecheck green during multi-plan implementation.
- **Atomic Pattern-B write** (`.tmp` + `fs.rename` in same dir) — crash-safe cross-subsystem.
- **React useRef callback-ref bridge for cross-component coupling** — when a stable callback identity must be passed to a third-party API but the impl depends on child-only state, hold `useRef<Fn|null>(null)` at the parent + stable `useCallback` wrapper that dereferences `.current` + child `useEffect` that registers/unregisters. (Phase 8.1 Plan 05.)
- **React 19 testing pattern** — use `await screen.findByX(...)` (testing-library waitFor) for async-driven DOM, never `await Promise.resolve()` chains. State updates from async handlers flush via macrotasks, not microtasks. (Phase 8.1 Plan 04.)

### Key Lessons

1. **Phase 0 derisk before UI work is non-negotiable for any project with non-trivial math.** The 7-plan headless spike paid back 5×+ over the milestone.
2. **Layer 3 invariants enforced by `tests/arch.spec.ts` (grep-based) catch architectural drift cheaply.** Adding a guard takes 5 minutes; debugging a violation 6 phases later takes hours.
3. **Live UAT signals trump plan optimism.** The Phase 7 8-commit chain and the Phase 4 D-91 rewrite were both caught only at human-verify. Budget for it.
4. **Decimal phase insertions are cheaper than scope creep.** Phases 08.1 + 08.2 closed gaps without polluting Phase 9. The numbering convention worked.
5. **`commit_docs: true` + atomic per-task commits + descriptive messages** make the git log a debugging asset. Rebase-friendly history mattered for Phase 7 gap-fix chain analysis.
6. **Electron protocol handlers + custom schemes need empirical prototyping.** Don't trust documentation alone — `net.fetch(file://)` + `standard: true` + missing-host parsing all surprised us.

### Cost Observations

- Model mix: not tracked formally (estimated ~70% Opus, ~30% Sonnet — Opus for planning + complex execution, Sonnet for routine plan execution and doc writes).
- Sessions: not tracked formally — 5 calendar days, 386 commits.
- Notable: Phase 0 → Phase 9 in 5 days end-to-end. Most expensive phase by token volume was Phase 8 (5 plans, large IPC/schema surface, 270 → 270 test baseline through bulk RED-spec scaffolding). Phase 7 was the most expensive in human-time per LOC due to the live-UAT chain.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | (untracked) | 12 | Initial GSD workflow adoption — Wave-0 RED-spec pattern, decimal-phase insertions, Layer 3 arch invariants. |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 333 (331 pass + 1 skip + 1 todo) | (untracked) | spine-core, sharp, maxrects-packer, @tanstack/react-virtual |

### Top Lessons (Verified Across Milestones)

*(To be populated as v1.1+ ships and confirms or contradicts v1.0 lessons.)*
