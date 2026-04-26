# Phase 6: Optimize Assets (image export) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 06-optimize-assets-image-export
**Areas discussed:** Export plan + output semantics, Worker architecture + concurrency, Progress protocol + OptimizeDialog UX
**Areas skipped (Claude's Discretion):** Filesystem safety + sharp packaging

---

## Initial gray-area selection

**Question:** Which areas do you want to discuss for Phase 6: Optimize Assets?

| Option | Description | Selected |
|--------|-------------|----------|
| Export plan + output semantics | src/core/export.ts row shape, unused-attachment handling (Phase 5 D-99 deferred), rounding rule for sourceW × effectiveScale. | ✓ |
| Worker architecture + concurrency | Main process async vs worker_threads; concurrency level; cancellation semantics; per-file error handling. | ✓ |
| Progress protocol + OptimizeDialog UX | Streaming IPC event shape AND dialog surface (entry point, pre-flight, progress visualization, completion). | ✓ |
| Filesystem safety + sharp packaging | Output collision policy, atomic write, default outDir, sharp prebuilds + electron-builder asarUnpack. | ✗ (Claude's Discretion) |

---

## Area 1: Export plan + output semantics

### Q1.1 — Export produces one output PNG per what unit?

| Option | Description | Selected |
|--------|-------------|----------|
| Per atlas region / source PNG file (Recommended) | One ExportRow per unique source image path. Multiple attachments sharing a region → use max(effectiveScale). Matches F8.3 1:1 with filesystem. | ✓ |
| Per attachment name | Keeps Phase 2 D-35 name-level dedup. Works when attachmentName == atlas region path. | |
| Per (skin, slot, attachment) | No dedup; trivially wrong for "one images/ folder" goal. | |

**User's choice:** Per atlas region / source PNG file (Recommended).
**Notes:** Aligns with the F8.3 directory-preservation requirement and gives the "max effective scale wins" semantics needed when multiple attachments share a region.

### Q1.2 — Phase 5 surfaces unused attachments. How should the export plan handle them?

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude by default (Recommended) | Tool's whole point is right-sizing the ship-to-runtime atlas. Unused textures waste bytes. | ✓ |
| Include at 100% source dims | Preserve input parity. Ships dead pixels. | |
| Settings toggle (default = exclude) | Adds checkbox to OptimizeDialog. Defers per-run. | |

**User's choice:** Exclude by default (Recommended).
**Notes:** Surfaces excluded names in `ExportPlan.excludedUnused` so the OptimizeDialog pre-flight can show a muted note. Phase 5's red-header section remains the discoverability surface for unused attachments.

### Q1.3 — `sourceW × effectiveScale` is fractional. Output pixel dimensions round via...

| Option | Description | Selected |
|--------|-------------|----------|
| Math.round (Recommended) | Round-half-away-from-zero (JS default). Minimizes max pixel error. | ✓ |
| Math.ceil | Never under-sizes. Guards against sub-pixel quality loss. | |
| Math.floor | Never exceeds peak. Risks dropping a pixel at peakScale 0.999. | |

**User's choice:** Math.round (Recommended).
**Notes:** Both axes use the SAME effectiveScale per the uniform-only memory lock. Sub-pixel error is invisible in Lanczos3 output.

### Q1.4 — Pre-flight validation of source PNG existence?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-flight, continue on missing, collect as errors (Recommended) | Scan inputs before sharp; missing files become error events; existing files proceed. Partial success. | ✓ |
| Pre-flight, fail the whole export on any missing file | Fast feedback; no partial success. | |
| No pre-flight — let sharp fail per-file | Simplest; less controllable error messages. | |

**User's choice:** Pre-flight, continue on missing, collect as errors (Recommended).
**Notes:** Gives a deterministic error list for missing inputs (typical cause: user moved/renamed PNGs after loading the skeleton).

---

## Area 2: Worker architecture + concurrency

### Q2.1 — Where does sharp (libvips) run during export?

| Option | Description | Selected |
|--------|-------------|----------|
| Main process, async concurrent (Recommended) | sharp on main process via concurrency limiter; libvips releases event loop internally. | ✓ (after follow-up) |
| Node worker_threads pool | Isolation; complexity; bundle sharp into worker. | |
| Electron utility process | Maximum isolation; overkill for image resize. | |

**User's freeform input:** "i plan to introduce a feature where multiple jsons can be loaded and they share the same imahges folder. This might mean 300+ images. Based on this knowlegde, what do you suggest?"

**Claude's recommendation (in plain text, per workflow rules for "Other"-style freeform input):**
- Sharp/libvips already multi-threaded internally per resize.
- Sequential (Q2.2) means no oversubscription regardless of file count.
- 300 files × 100–500ms each = 30s–2.5min, tolerable with streaming progress UI.
- Worker_threads adds complexity without speedup at sequential = 1.
- Migration path preserved: `image-worker.ts` filename is intentional.

**User's confirmation:** "confirmed".
**Final answer:** Main process, async concurrent.

### Q2.2 — How many files can sharp process concurrently?

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential (1 at a time) (Recommended) | Bounded memory; clean per-file events; no main-process congestion. | ✓ |
| Fixed 4 in flight | Modest JS-level parallelism; memory spike risk. | |
| CPU count / 2 | Maximum throughput; UI jank risk. | |
| Configurable (default 1) | Settings UI knob; premature. | |

**User's choice:** Sequential (1 at a time) (Recommended).

### Q2.3 — User clicks Cancel mid-export. What happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Finish in-flight file, stop new ones, keep partial output (Recommended) | Cooperative cancel; libvips uninterruptible mid-op. Partial output stays. | ✓ |
| Finish in-flight file, stop new ones, roll back all output | All-or-nothing semantics; cleanup blast radius. | |
| Abort in-flight file (unlink partial output), stop queued | Hard cancel; unreliable on Windows. | |

**User's choice:** Finish in-flight file, stop new ones, keep partial output (Recommended).

### Q2.4 — A single file fails. What does the export do?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + continue + surface in error list (Recommended) | Partial success; bad file doesn't block 79 others. | ✓ |
| Stop entire export on first error | Fail-fast; conservative. | |
| Retry once, then skip | Transient flakiness handling; complexity. | |

**User's choice:** Skip + continue + surface in error list (Recommended).

---

## Area 3: Progress protocol + OptimizeDialog UX

### Q3.1 — Where does the Optimize Assets entry point live?

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar button in AppShell, next to filename chip (Recommended) | Persistent in top chrome; visible from any tab. | ✓ |
| Header of Global Max Render panel only | Hidden behind a tab. | |
| Electron native menu (File → Export Optimized...) | Less discoverable; new surface. | |

**User's choice:** Toolbar button in AppShell, next to filename chip (Recommended).

### Q3.2 — When the user clicks Optimize, what flow do they see?

| Option | Description | Selected |
|--------|-------------|----------|
| Folder picker first → then dialog with file list preview + Start button (Recommended) | Two-step; user confirms before bytes move. | ✓ |
| Dialog opens first with file list + 'Choose folder...' inside → Start | Single modal owns the full flow. | |
| Folder picker only → export starts immediately | Minimum friction; least confidence-inspiring. | |

**User's choice:** Folder picker first → then dialog with file list preview + Start button (Recommended).

### Q3.3 — How are progress events streamed from main → renderer?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file events: { index, total, path, status, error? } (Recommended) | One event per file; bounded rate; per-file checklist + error surfacing. | ✓ |
| Batched events: { completedSinceLast, totalDone, total } | Throttled ticks; less granular; no per-file checklist. | |
| Single 'all done' event + intermediate percentage ticks | Minimal IPC; loses per-file granularity. | |

**User's choice:** Per-file events: { index, total, path, status, error? } (Recommended).

### Q3.4 — What does the dialog show during + after export?

| Option | Description | Selected |
|--------|-------------|----------|
| Linear progress bar + scrollable per-file list with status icons (Recommended) | Bar + checklist + post-completion summary; errors expandable inline. | ✓ |
| Linear progress bar only — errors collected and shown post-export | Less live visibility. | |
| Per-file checklist only (no global bar) | Awkward for 300+ rigs. | |

**User's choice:** Linear progress bar + scrollable per-file list with status icons (Recommended).

---

## Final check

**Question:** Are there gray areas remaining that need discussion before I write CONTEXT.md?

**User's choice:** I'm ready for context.

---

## Claude's Discretion

The user opted not to discuss "Filesystem safety + sharp packaging" — captured in `06-CONTEXT.md` `<decisions>` under "Claude's Discretion" with defensible defaults:

- **D-121** Atomic write per file via `<outPath>.tmp` + `fs.rename`.
- **D-122** Default outDir suggestion = `<skeleton_dir>/images-optimized/`; reject if outDir is the source `images/` folder (defends F8.4).
- **D-123** Sharp version pin + `electron-builder` `asarUnpack` for native binaries (N4.2).
- File collision policy = overwrite without prompt (F8.4 protects source, not output).
- Path-traversal guard on outPath resolution.

## Deferred Ideas

- Multi-JSON shared-images export (future feature; Phase 6 builds plan from one summary at a time).
- Worker_threads migration (Phase 9 if perf demands; `image-worker.ts` is named for it).
- Configurable sharp concurrency (settings UI; post-Phase 6).
- Resume-from-partial export.
- Atlas re-pack (REQUIREMENTS.md "Out of scope").
- Output format options (always PNG).
- Settings toggle for "Include unused attachments" (plumbing path reserved; UI deferred).
- File-size delta readout in pre-flight (Phase 7 covers).
- Drag-and-drop output folder.
- Save/Load last-used outDir (Phase 8).
- Batch-export from panel selection.
- CLI export command (D-102 lock).
