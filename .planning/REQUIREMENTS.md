# Requirements — Milestone v1.2 expansion

> Active requirements for the v1.2 milestone. Validated v1.1.2 requirements (UPDFIX-01..04) are archived in [.planning/milestones/v1.1.2-REQUIREMENTS.md](milestones/v1.1.2-REQUIREMENTS.md). Validated v1.1 requirements are archived in [.planning/milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md). Validated v1.0 requirements are archived in [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

## Goal

Close out three macOS regressions + one host-blocked carry-forward from v1.1.x; refine the UI based on tester feedback (Phase 19 UI-01..05); add the Documentation Builder feature (Phase 20 fills the `.stmproj` v1 reserved `documentation: object` slot from D-148); land the two long-dormant SEEDs (Phase 21 SEED-001 atlas-less mode → Phase 22 SEED-002 dims-badge override-cap; depends on shared PNG header reader landed in Phase 21).

## v1.2 Requirements

### UAT — Live UAT carry-forwards (Phase 13.1)

Host-availability gated; pre-existing carry-forwards from v1.1.1 that pre-date v1.1.2.

- [ ] **UAT-01**: Linux AppImage UAT runbook executed end-to-end on Ubuntu 24.04 (or equivalent host); libfuse2 / libfuse2t64 error dialog PNG captured and binary-swapped into `docs/install-images/` for INSTALL.md.
- [ ] **UAT-02**: macOS v1.1.0 → v1.1.1 auto-update lifecycle observed live (rc-channel matching behavior verified or new behavior documented for /gsd-debug follow-up if regression observed).
- [ ] **UAT-03**: Windows v1.1.0 → v1.1.1 auto-update lifecycle observed live; cosmetic v1.1.1 Windows fixes (`autoHideMenuBar: false` + `setAboutPanelOptions` SemVer block) UX-confirmed; windows-fallback variant observed in real release feed.

### UPDFIX — Auto-update follow-on fixes (Phase 16)

Continues numbering from validated UPDFIX-01..04 (closed in v1.1.2).

- [ ] **UPDFIX-05**: On macOS, when an update is available, UpdateDialog opens in `manual-download` variant (not Squirrel.Mac in-process swap); the "Open Release Page" button launches the GitHub Releases page in the system browser via the existing `SHELL_OPEN_EXTERNAL_ALLOWED` allow-list. Variant rename (`windows-fallback` → `manual-download`) propagates consistently to all surface mention sites: `src/main/auto-update.ts`, `src/main/ipc.ts`, `src/renderer/src/modals/UpdateDialog.tsx`, `INSTALL.md`, the in-app Help dialog, and all relevant tests. Closes D-15-LIVE-2 (Squirrel.Mac code-sig swap fail on ad-hoc-signed builds; latent since v1.0.0).
- [x] **UPDFIX-06** *(closed-by-test 2026-04-30; no phase needed)*: `Help → Check for Updates` menu item fires the `update:check` IPC regardless of whether a project (`.json` / `.stmproj`) is currently loaded. **Closed by existing regression test** `tests/renderer/app-update-subscriptions.spec.tsx` test (14-l) "Help → Check for Updates from idle calls window.api.checkForUpdates()" — Phase 14's renderer-lift (commit 802a76e) moved the menu-listener subscription from `AppShell.tsx` to `App.tsx`'s top-level `useEffect`, so it mounts on every AppState branch including idle. D-15-LIVE-3 was observed on the v1.1.1 installed binary (pre-lift); v1.1.3+ already has the fix. Phase 17 skipped (originally promoted from backlog 2026-04-29; verification-only phase deemed redundant given (14-l) coverage).

### QUIT — App quit (Phase 18)

Independent macOS UX defect observed in v1.1.1 packaged build during Phase 15 UAT.

- [ ] **QUIT-01**: Pressing Cmd+Q from anywhere in the app terminates the process cleanly on macOS (currently no-op; only window-close X or Force Quit terminates).
- [ ] **QUIT-02**: AppleScript `osascript -e 'tell application "Spine Texture Manager" to quit'` terminates the process cleanly on macOS (currently no-op).

### UI — UI improvements (Phase 19)

Sourced from tester feedback + visual diff against an unrelated older Spine 3.8 reference app the user built previously (visual reference only — codebase out of scope).

- [ ] **UI-01**: Persistent sticky header — branded title + load-summary card (`N skeletons / N atlases / N regions`) + primary action buttons (Atlas Preview, Documentation, Optimize Assets, Save, Load) + search box stay visible (via `position: sticky`) when the user scrolls Global / Animation Breakdown lists. Closes the regression where scrolling hides the toolbar and forces users back to the top to interact with action buttons.
- [ ] **UI-02**: Card-based section layout with color-coded category icons + semantic state colors (green = under 1.0× scale, yellow = over 1.0×, red = unused / danger) for Global panel, Animation Breakdown panel, and Unused Assets callout. Replaces flat tabular layout.
- [ ] **UI-03**: Modal redesign — summary tiles at top of Optimize Assets + Atlas Preview modals (e.g. `544 Used Files` / `433 to Resize` / `Saving est. 77.7% pixels`); secondary cross-nav button in footer enables jumping between modals without closing (e.g. Atlas Preview button visible inside Optimize Assets modal).
- [ ] **UI-04**: Unused-assets callout quantifies potential savings (`X.XX MB potential savings`) computed from on-disk PNG file sizes, instead of just showing the unused count.
- [ ] **UI-05**: Inline search visible in the persistent header bar; clear primary/secondary button hierarchy in the action area — Optimize Assets elevated as the primary CTA (visually distinct treatment); Atlas Preview / Documentation / Save / Load styled as secondary.

### DOC — Documentation Builder feature (Phase 20)

Fills the `.stmproj` v1 reserved `documentation: object` slot (D-148; reserved during v1.0 Phase 8 `.stmproj` schema lock; untested until v2 ladder lands).

- [x] **DOC-01
**: Per-skeleton Documentation Builder modal accessible from a new top-bar button (placement coordinates with UI-01 sticky header design).
- [ ] **DOC-02**: Animation tracks pane — drag animations from a side list to track containers; configure mix time (seconds, default 0.25s) + loop flag + free-text notes per track entry; multiple tracks supported.
- [x] **DOC-03**: Sections pane — capture events, general notes, control-bone descriptions (with name + description per bone), skin descriptions (with name + description per skin). _(Closed by Plan 20-01: SkeletonSummary.events auto-discovery source ready; Documentation interface includes events/controlBones/skins/generalNotes fields.)_
- [ ] **DOC-04**: HTML export — standalone `.html` file containing all docs (animation tracks, sections, control bones, skins) + optimization config snapshot (safety buffer, space savings %) + atlas page count + image-utilization count. Self-contained, viewable offline.
- [x] **DOC-05**: Persistence in `.stmproj` v1's reserved `documentation: object` slot (D-148); round-trip safe (save → reload → identical content; existing 8-kind discriminated-union typed-error envelope honored for any new error kinds the doc loader introduces). _(Closed by Plan 20-01: round-trip identity proven by tests/core/project-file.spec.ts representative-doc test; validator pre-massage + materializer back-fill keep Phase 8-era empty-slot files loadable; reuses 'invalid-shape' kind — no 9th SerializableError.)_

### LOAD — Atlas-less mode (Phase 21; SEED-001)

Long-dormant seed since v1.0 Phase 6 close-out (planted 2026-04-25). Supports the natural state of source assets BEFORE the Spine packer runs, and the post-Optimize-overwrite state where source PNGs are the canonical source of region dims.

- [ ] **LOAD-01**: Loader detects "no `.atlas` file beside `.json`" and routes through a synthesized atlas instead of failing with `AtlasNotFoundError`. The current `AtlasNotFoundError` message is preserved for actually-missing-atlas cases (e.g. malformed project), but the no-atlas case is no longer an error.
- [ ] **LOAD-02**: New `src/core/png-header.ts` reads width/height from PNG IHDR chunk via byte parsing only — no `sharp` / libvips / pixel decoding. Preserves CLAUDE.md fact #4 ("the math phase does not decode PNGs"); reading IHDR bytes is structurally distinct from decoding.
- [ ] **LOAD-03**: New `src/core/synthetic-atlas.ts` constructs an in-memory `TextureAtlas` from per-region PNG headers when no `.atlas` file is present. Each synthesized region: name = PNG basename, dims = PNG header dims, page = the PNG file itself, x/y = 0/0, rotated = false.
- [ ] **LOAD-04**: Round-trip — load `json + images folder` project (no `.atlas`) → sample (Global + Animation Breakdown panels populate) → export to `images-optimized/` succeeds end-to-end. Golden fixture covers the path.

### DIMS — Dims-badge + override-cap (Phase 22; SEED-002)

Long-dormant seed since v1.0 Phase 6 close-out (planted 2026-04-25). **Depends on Phase 21** — reuses Phase 21's PNG header reader infrastructure. Two scenarios surface canonical-vs-source dimension drift: (A) user pre-reduced source images manually outside the app; (B) user ran Optimize → Overwrite-all → re-loaded the same project (Phase 6 ConflictDialog path).

- [ ] **DIMS-01**: `DisplayRow` (in `src/core/types.ts`) extended with `actualSourceW` / `actualSourceH` / `dimsMismatch: boolean` fields. Loader populates these from per-region PNG header reads (Phase 21's `png-header.ts`); `dimsMismatch` is set when `actualSource` differs from canonical region dims by more than 1px (rounding tolerance).
- [ ] **DIMS-02**: Badge in Global panel + Animation Breakdown panel surfaces dims mismatch on affected rows with tooltip explaining the canonical-vs-source-PNG drift (e.g. "Source PNG (811×962) is smaller than canonical region dims (1628×1908). Optimize will cap at source size.").
- [ ] **DIMS-03**: Export math (`buildExportPlan` in `src/core/export.ts` + byte-identical `src/renderer/src/lib/export-view.ts`) caps `effectiveScale = min(peakScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` so the output is never upscaled beyond the actual source PNG dims. Honors locked memory `project_phase6_default_scaling.md` (uniform single-scale; never extrapolate).
- [ ] **DIMS-04**: Already-optimized rows excluded from export when `actualSource × cappedEffScale` rounds to `actualSource` (zero net change); surfaced in a new `excludedAlreadyOptimized[]` array parallel to Phase 6 D-109 `excludedUnused[]`. Pre-flight OptimizeDialog file list shows muted treatment with an "already-optimized — skipped" indicator (parity with the Round 1 `excludedUnused` muted note UX).
- [ ] **DIMS-05**: Round-trip — re-running Optimize on already-optimized images produces zero exports (no double Lanczos resampling). Vitest covers this against a fixture where source PNGs are smaller than canonical region dims.

## Out of Scope (v1.2)

- **Apple Developer ID code-signing + notarization** ($99/yr enrollment). Declined 2026-04-29 in favor of Phase 16's manual-download UX path. Revisit at v1.3 if user feedback or a separate use case justifies the cost + maintenance overhead.
- **Crash + error reporting (Sentry or equivalent)**. Descoped at v1.1; carried unchanged. Revisit at v1.3 once tester base + crash-trace volume justifies the SaaS dependency + consent UX overhead.
- **Spine 4.3+ versioned loader adapters** (F1.5 from v1.0 deferred list). Carried unchanged.
- **`.skel` binary loader** (v1.0 deferred list). Carried unchanged.
- **Adaptive bisection refinement around candidate peaks** (for pathological easing curves). v1.0 deferred. Carried unchanged.
- **Aspect-ratio anomaly flag** (when `scaleX != scaleY` at peak). v1.0 deferred. Carried unchanged.
- **In-app atlas re-packing** (writing a new `.atlas` file). v1.0 deferred. Carried unchanged.
- **Mac App Store / Microsoft Store / Snap Store / Flatpak distribution; Linux `.deb` / `.rpm`; Windows EV cert.** v1.1 deferred. Carried unchanged.
- **Delta updates / staged rollouts / custom update channels.** v1.1 deferred. Carried unchanged.
- **Combined-skin compositing** (per-individual-skin sampling is the locked v1.0 contract). Carried unchanged.

## Future Requirements (deferred)

- **DIST-future**: Code-signed + notarized macOS distribution (Apple Developer ID).
- **DIST-future**: Code-signed Windows distribution (EV cert).
- **DIST-future**: Linux `.deb` / Flatpak / Snap targets if Linux user base materializes.
- **TEL-future**: Crash + error reporting (Sentry or equivalent). Originally TEL-01..TEL-07; descoped 2026-04-28; declined again for v1.2 2026-04-30. Reconsider at v1.3.
- **TEL-future**: Feature-usage analytics once tester base grows and a privacy posture is settled.
- **F1.5**: Spine 4.3+ versioned loader adapters.
- **F-binary**: `.skel` binary loader support.

## Validated (Locked from Earlier Milestones)

- **v1.1.2 Auto-update fixes** (UPDFIX-01..04) — all closed by Phases 14 + 15 + v1.1.3 hotfix. Full historical record in [.planning/milestones/v1.1.2-REQUIREMENTS.md](milestones/v1.1.2-REQUIREMENTS.md).
- **v1.1 Distribution** (DIST-01..07, CI-01..06, REL-01..04, UPD-01..06) — all closed by Phases 10 / 11 / 12 / 12.1 / 13. Full historical record in [.planning/milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md).
- **v1.0 MVP** (full requirements record) — [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

## Traceability

Roadmap-locked 2026-04-30 (ROADMAP.md authored). Every v1.2 REQ maps to exactly one phase; every phase has at least one REQ. Phase 22 depends on Phase 21 (shared PNG header reader infrastructure). Phase 13.1 is host-availability gated and runs opportunistically — not a strict dependency for any other phase.

| Requirement | Phase | Status  |
|-------------|-------|---------|
| UAT-01      | 13.1  | Pending |
| UAT-02      | 13.1  | Pending |
| UAT-03      | 13.1  | Pending |
| UPDFIX-05   | 16    | Pending |
| UPDFIX-06   | —     | Closed-by-test (regression test 14-l in `tests/renderer/app-update-subscriptions.spec.tsx`; Phase 14 lift commit 802a76e fixes the wiring; Phase 17 skipped 2026-04-30) |
| QUIT-01     | 18    | Pending |
| QUIT-02     | 18    | Pending |
| UI-01       | 19    | Pending |
| UI-02       | 19    | Pending |
| UI-03       | 19    | Pending |
| UI-04       | 19    | Pending |
| UI-05       | 19    | Pending |
| DOC-01      | 20    | Pending |
| DOC-02      | 20    | Pending |
| DOC-03      | 20    | Pending |
| DOC-04      | 20    | Pending |
| DOC-05      | 20    | Pending |
| LOAD-01     | 21    | Pending |
| LOAD-02     | 21    | Pending |
| LOAD-03     | 21    | Pending |
| LOAD-04     | 21    | Pending |
| DIMS-01     | 22    | Pending |
| DIMS-02     | 22    | Pending |
| DIMS-03     | 22    | Pending |
| DIMS-04     | 22    | Pending |
| DIMS-05     | 22    | Pending |

**Coverage:** 26/26 v1.2 REQs mapped — 25 to a phase, 1 (UPDFIX-06) closed-by-test (no phase). 7 active phases own at least one REQ (13.1: 3, 16: 1, 18: 2, 19: 5, 20: 5, 21: 4, 22: 5). Phase 17 skipped 2026-04-30 — UPDFIX-06 already covered by `tests/renderer/app-update-subscriptions.spec.tsx` test (14-l). Phase 22 depends on Phase 21 (shared `src/core/png-header.ts` PNG header reader infrastructure — sequenced 21 → 22 per SEED-001 / SEED-002 author's intent locked 2026-04-25). Phase 13.1 is host-availability gated; no other phase blocks on it.
