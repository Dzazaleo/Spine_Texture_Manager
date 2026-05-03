# Milestones

## v1.0 — MVP (Shipped: 2026-04-26)

**Phases completed:** 12 (Phase 0–9, plus 08.1 + 08.2 inserted)
**Plans:** 62
**Tasks:** 118
**Test baseline at close:** 331 passed + 1 skipped + 1 todo (333 total)
**Source LOC:** ~13,336 (TS/TSX) + ~8,432 (tests)
**Timeline:** 2026-04-22 → 2026-04-26 (5 days)
**Git range:** `796480d` → `318cdb8` (386 commits)

**Delivered:** A desktop app (Electron + React + TypeScript) that loads Spine 4.2+ skeleton JSON, computes the peak world-space render scale for every attachment across every animation/skin, and exports a per-attachment-optimized images folder via sharp Lanczos3 — driven by the actual world-space transforms the runtime computes, not guesswork.

**Key accomplishments:**

1. **Headless Spine math core** (Phase 0) — pure-TS sampler computing peak world-AABB per attachment via `computeWorldVertices` after `updateWorldTransform(Physics.update)`. Locked tick lifecycle (`state.update → state.apply → skeleton.update → updateWorldTransform`). Golden-tested against `fixtures/SIMPLE_PROJECT` (CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000). Layer 3 invariant locked: zero DOM/`fs`/`sharp` imports in `src/core/`.
2. **Electron + React UI shell with dual analysis panels** (Phases 1–3) — JSON drop-load → Global Max Render Source table (sortable, searchable, selectable) + Animation Breakdown collapsible per-animation cards. Phase 3 D-72 jump-target system links them.
3. **Per-attachment scale overrides** (Phase 4) — D-91 source-fraction semantics: 100% = source dimensions (the absolute maximum, never surpassed), `<100%` shrinks. Two-button reset (peak / source). Persisted in project file. **LOCKED uniform-only** for Phase 6 export sizing (anisotropic scaling breaks Spine UV sampling).
4. **Unused-attachment detection + image export pipeline** (Phases 5–6) — `core/usage.ts` defined-vs-used diff; sharp Lanczos3 export with atomic Pattern-B write (`.tmp` + `fs.rename`) + cooperative cancel + skip-on-error progress UI. First native binary dependency (sharp) integrated with electron-builder asarUnpack.
5. **Atlas Preview modal** (Phase 7) — `maxrects-packer` projection + canvas drawImage rendering. Before/after dims + page-efficiency, dblclick-to-jump UX (the "20% glow override" workflow), oversize-region warning banner. Required Electron `app-image://` custom protocol + CSP extension. Live UAT signed off after 8-commit gap-fix chain (Electron `net.fetch(file://)` workaround + always-fixed canvas frame).
6. **`.stmproj` v1 save/load with crash-safe round-trip** (Phases 8 / 8.1 / 8.2) — discriminated-union typed-error envelope (8 kinds, including 7-field `SkeletonNotFoundOnLoadError` recovery payload); locate-skeleton recovery reachable from drag-drop AND toolbar Open paths; dirty-guard SaveQuitDialog with three reason discriminators (quit / new-skeleton-drop / new-project-drop) and 3-button Save/Don't Save/Cancel; native File menu + Cmd+O/S accelerator gating during error states.
7. **Complex-rig hardening + polish** (Phase 9) — sampler offloaded to greenfield `worker_threads` Worker (D-190, path-based protocol, terminate-based cancel); TanStack Virtual integration in both panels at threshold N≥100; SettingsDialog under Edit→Preferences (Cmd/Ctrl+,) with `samplingHz` re-sample wiring; HelpDialog with 7-section static React content + allow-listed `shell.openExternal`. **N2.2 wall-time gate: 606 ms on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`** — ~17× under the 10 s contract.

**Known deferred items:** 5 (see STATE.md → Deferred Items). Two seeds (atlas-less mode, dims-badge override-cap) are post-MVP by design; one debug session (phase-0-scale-overshoot) and one Phase 4 code-review todo carry forward as tech debt; one stale Phase 07 UAT flag (signed-off, 0 pending scenarios).

**Archived artifacts:**
- `.planning/milestones/v1.0-ROADMAP.md` (full phase details preserved)
- `.planning/milestones/v1.0-REQUIREMENTS.md` (all v1 requirements with outcomes)

---

## v1.2 — Expansion (Shipped: 2026-05-03)

**Phases completed:** 8 executed (Phase 16, 18, 19, 20, 21, 22, 22.1 complete; Phase 17 skipped UPDFIX-06 closed-by-test; Phase 13.1 deferred host-blocked)
**Plans:** 40 (6 + 2 + 7 + 4 + 12 + 5 + 4)
**Test baseline at close:** ~700+ vitest passing (690 at Phase 22.1 start; +UAT fixes)
**Source LOC:** ~20,174 (TS/TSX) in `src/`
**Timeline:** 2026-04-30 → 2026-05-03 (4 days)
**Git range:** `v1.1.3` tag + 286 commits → `a14bb3e`
**Tag:** `v1.2.0`

**Delivered:** Major expansion shipping macOS UX regressions closed, a full UI redesign, the Documentation Builder feature, and the two long-dormant atlas-less mode + dims-badge seeds — all while preserving the Layer 3 invariant, uniform-only export math, and the `.stmproj` v1 round-trip contract.

**Key accomplishments:**

1. **macOS auto-update → manual-download UX** (Phase 16) — Squirrel.Mac code-signature swap fail on ad-hoc builds fixed by routing macOS through the `manual-download` variant (same path as Windows). `windows-fallback` literal renamed end-to-end; strict `isReleasesUrl()` allow-list helper with 9 threat-model tests. UPDFIX-05 closed.
2. **App quit restored on macOS** (Phase 18) — `onCheckDirtyBeforeQuit` lifted from `AppShell.tsx` to `App.tsx` top-level `useEffect`, mirroring the Phase 14 renderer-lift pattern. Cmd+Q + AppleScript terminate cleanly; dirty-guard preserved. QUIT-01 + QUIT-02 closed.
3. **Complete UI redesign** (Phase 19) — Persistent sticky header (toolbar never scrolls offscreen); card-based panels with color-coded semantic state (green/yellow/red); Optimize + Atlas Preview modals gain summary tiles + cross-nav; unused-assets callout quantifies potential MB savings; Optimize Assets promoted as primary CTA. UI-01..05 closed.
4. **Documentation Builder feature** (Phase 20) — Per-skeleton documentation surface filling the `.stmproj` v1 reserved `documentation: object` slot (D-148, reserved v1.0 Phase 8). Animation tracks pane (DnD from side list, mix time + loop + notes), sections pane (events, general notes, control bones, skins), self-contained HTML export (optimization config snapshot + atlas page count + image utilization). DOC-01..05 closed.
5. **Atlas-less mode** (Phase 21) — Loads `json + images folder` projects without an `.atlas` file. New `src/core/png-header.ts` (IHDR byte parsing, no decode — CLAUDE.md fact #4 preserved) + `src/core/synthetic-atlas.ts`; loader 4-way branch order; 12 plans including 4 gap closures (stub-region, MissingAttachmentsPanel, toolbar layout, toggle-resample precedence). LOAD-01..04 closed.
6. **Dims-badge + override-cap round-trip safety** (Phases 22 + 22.1) — Canonical-vs-source PNG dim drift detected and surfaced as badge UI in both panels; export cap `min(peakScale, sourceW/canonicalW, sourceH/canonicalH)` prevents upscaling beyond actual source dims; generalized passthrough predicate (outW===sourceW AND outH===sourceH, evaluated POST-override); override-aware partition re-routes passthrough rows when override pushes effective scale below source-ratio cap (G-07 BLOCKER fixed). DIMS-01..05 closed.

**Known gaps (deferred at close):**

- UAT-01..03 (Phase 13.1): Linux AppImage runbook + macOS/Windows v1.1.0→v1.1.1 auto-update lifecycle — host-blocked; carry to v1.3.
- Phase 0 scale-overshoot debug session: v1.0-era AABB/rotation tech debt; no regression observed.
- Phase 4 code-review follow-up todo: v1.0-era polish item; tech debt.
- Phase 20 Windows/Linux DnD cross-platform UAT: host-blocked.

**Archived artifacts:**
- `.planning/milestones/v1.2-ROADMAP.md` (full phase details Phases 16–22.1 preserved)
- `.planning/milestones/v1.2-REQUIREMENTS.md` (all v1.2 requirements with final statuses)

---
