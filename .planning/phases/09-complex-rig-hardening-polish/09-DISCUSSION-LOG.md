# Phase 9: Complex-rig hardening + polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `09-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 09-complex-rig-hardening-polish
**Areas discussed:** Performance: worker + virtualization
**Areas presented but not selected:** Settings modal; Rig info + Documentation; 08.2 deferred polish triage

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Performance: worker + virtualization | "How we define 'complex rig' (Girl fixture? Synthetic?), measure jank, decide if the sampler worker is built or skipped, and which panel(s) get UI virtualization (GlobalMax 778L, AnimBreakdown 578L collapsible). All bound by N2.2 <10s + 'no dropped frames' exit criteria." | ✓ |
| Settings modal | "Just samplingHz, or grow into a Settings home? Where it lives (File menu / Edit menu / dedicated app menu), validation UX (slider / dropdown 60/120/240 / number input), per-project (.stmproj current) vs per-app vs both." | |
| Rig info + Documentation | "Two info-display surfaces: tooltip showing skeleton.fps (where it attaches, what else it shows, how to label fps as non-authoritative), and the in-app help view (modal vs side panel vs new window vs external browser, content scope, Help-menu wiring)." | |
| 08.2 deferred polish triage | "Which 08.2-deferred items land in Phase 9: OS file association (.stmproj double-click), reopen-last-project on launch, window state persistence, auto-save/crash recovery, native Quit-via-File→Exit on Win/Linux. ROADMAP doesn't name these — you decide what bundles in vs what waits." | |

**User's choice:** Performance: worker + virtualization
**Notes:** Single area selected; the three skipped areas default to Claude's Discretion in CONTEXT.md (planner picks reasonable defaults aligned with prior-phase patterns; 08.2 polish items stay deferred to post-MVP).

---

## Performance: worker + virtualization

### Q1 — Complex-rig baseline

**Question:** What rig defines the 'complex' baseline that N2.2 (<10s, no dropped frames) must pass against?

| Option | Description | Selected |
|--------|-------------|----------|
| fixtures/Girl as the gate (Recommended) | Largest in-repo fixture (~930KB JSON, ~5× Jokerman). Already committed, golden-testable, planner can baseline against it deterministically. We can add a second user-supplied rig later as a stretch case. | ✓ |
| User-supplied rig (you'll provide) | ROADMAP literally says 'user-supplied complex rig' — you drop a real production rig into fixtures/ before plan-phase runs. Most realistic; gates on your timeline. | |
| Synthetic super-rig generator | Build a script that procedurally generates an N-attachment / M-animation rig at chosen sizes (e.g., 80 attachments / 16 anims per N2.2 spec). Best for stress-testing edge sizes; more code to write. | |
| Both Girl + a user rig | Use Girl as the always-runnable CI baseline AND require a user-supplied rig to sign off the phase. Two gates. | |

**User's choice:** fixtures/Girl as the gate
**Captured as:** D-189
**Notes:** A user-supplied production rig may be added later as an optional sign-off step before milestone close (see Deferred Ideas). Always-runnable wall-time test gates the phase.

---

### Q2 — Sampler worker decision

**Question:** How do we decide on the sampler worker thread?

| Option | Description | Selected |
|--------|-------------|----------|
| Profile Girl first, decide after (Recommended) | ROADMAP says worker is conditional ('if profiling shows main-thread jank'). Run sampleSkeleton on Girl, measure wall time + main-thread blocks. If <10s and no jank → skip the worker entirely (saves ~200 LOC + IPC layer). If jank → build it. Decision is data-driven. | |
| Build the worker unconditionally | Treat 'no dropped UI frames during sampling' as a guarantee, not a measurement. Always offload sampling to a worker_threads worker. Locks in headroom for the user's own bigger rigs. | ✓ |
| Skip the worker, optimize sampler in-thread | Try to hit <10s by optimizing the sampler hot loop (e.g., reduce allocations, prune dead attachments). Keeps the codebase simpler. Risk: may not achieve 'no dropped frames' on truly large rigs. | |

**User's choice:** Build the worker unconditionally
**Captured as:** D-190
**Notes:** This overrides ROADMAP's "if profiling shows main-thread jank" language. Rationale: user's own production rigs are likely larger than fixtures/Girl; building the worker once now beats a possible follow-up phase later. Also forbidden anyway by D-102 (sampler is byte-frozen) — "optimize in-thread" was not actually viable.

---

### Q3 — Virtualization panel scope

**Question:** Which panel(s) get UI virtualization?

| Option | Description | Selected |
|--------|-------------|----------|
| Both panels, threshold-gated (Recommended) | Virtualize GlobalMaxRenderPanel (778L flat sortable table — classic fit) AND AnimationBreakdownPanel (578L collapsible cards with rows inside). Activate only past N rows (e.g., 100) so SIMPLE_PROJECT stays unchanged. Avoids virtualization overhead on small rigs. | ✓ |
| GlobalMaxRenderPanel only | GlobalMax is the obvious win (flat table, sortable, easy to virtualize). AnimBreakdown's collapsible groups are subtle to virtualize correctly (variable-height items, expand/collapse state). Ship the easy one, defer the harder one if it doesn't actually jank. | |
| Both panels, always virtualized | Always-on virtualization for consistency. Slightly more complexity for small rigs but no branching/threshold logic. | |

**User's choice:** Both panels, threshold-gated
**Captured as:** D-191

---

### Q4 — Virtualization library

**Question:** How do we implement the virtualizer?

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack Virtual (Recommended) | Modern React virtualization library (formerly react-virtual). Headless (renders nothing itself — you keep your existing JSX), tiny, supports variable-height for AnimBreakdown's collapsible cards. Fits the React/Vite stack naturally. ~6KB gzipped. | ✓ |
| react-window | Older, very small library. Simpler API, but variable-height is more awkward (needs VariableSizeList). Less ergonomic for collapsible cards. | |
| Hand-roll | Matches the project's hand-rolled discipline (Phase 2 D-28, Phase 4 D-81, Phase 8 D-156). No new dependency. Risk: virtualization edge cases (sticky headers, scroll restoration on sort, keyboard nav) are notoriously fiddly. | |

**User's choice:** TanStack Virtual
**Captured as:** D-192
**Notes:** Documented exception to hand-rolled discipline; justification logged in CONTEXT specifics.

---

### Q5 — Worker file location + protocol

**Question:** Where does the sampler worker live, and how does it talk to main?

| Option | Description | Selected |
|--------|-------------|----------|
| src/main/sampler-worker.ts + path-based protocol (Recommended) | Worker file lives in src/main/ (mirrors image-worker.ts pattern from Phase 6). Main passes {skeletonPath, atlasRoot, samplingHz}; worker re-loads the JSON inside the worker thread and runs sampleSkeleton. Returns SamplerOutput JSON via postMessage. No SkeletonData serialization across the boundary — sidesteps the Spine class-instance problem. | ✓ |
| src/main/sampler-worker.ts + serialized-data protocol | Main loads + parses the JSON, then transfers SkeletonData (or a serializable snapshot) to the worker. Saves one parse, but Spine's SkeletonData has class instances + circular refs that don't postMessage cleanly — needs custom (de)serialization. | |
| src/core/sampler-worker.ts (pure-core worker) | Lives in core/ for symmetry with sampler.ts. Layer 3 says 'no DOM' — worker_threads is Node-only, so technically allowed. But mixes orchestration with pure math; breaks the established pattern (image-worker is in main/). | |

**User's choice:** src/main/sampler-worker.ts + path-based protocol
**Captured as:** D-193

---

### Q6 — Worker progress + cancellation

**Question:** Worker progress + cancellation surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Progress events + cancellation token (Recommended) | Worker postMessages {type:'progress', percent} every ~100 attachments, and supports a 'cancel' message that aborts mid-sample. Renderer shows a determinate progress bar during sampling and cancels if user opens a different file. Mirrors Phase 6 image-worker's onExportProgress + 'export:cancel' channel. | ✓ |
| Progress only, no cancellation | Simpler: just emit progress, let the sample finish even if the user moved on. Worker results for an abandoned sample are dropped on the renderer side. | |
| Neither (fire-and-forget) | Worker runs to completion, posts one final SamplerOutput. No progress UI, no cancellation. Simplest; user stares at a spinner for up to 10s. | |

**User's choice:** Progress events + cancellation token
**Captured as:** D-194
**Notes:** Cancellation matters because of 08.2's menu Open — Cmd+O can fire mid-sample now and the new sample dispatch must cancel the in-flight one cleanly.

---

### Q7 — Virtualization threshold

**Question:** Threshold N for switching virtualization on?

| Option | Description | Selected |
|--------|-------------|----------|
| N = 100 rows (Recommended) | Above ~100 rows, naive React rendering starts measurably hitching during sort/filter on most hardware. Below that, virtualization adds layout cost (measureElement) and breaks ctrl-F text search. SIMPLE_PROJECT (~3 attachments) and Jokerman stay unvirtualized; Girl crosses the threshold. | ✓ |
| N = 50 rows | More conservative — kicks in earlier. Safer for Win/Linux low-end laptops, but virtualization cost on 50-row tables is non-zero and the perceived smoothness gain is small. | |
| Always on | No threshold — always virtualized. Removes a code branch + test surface; trade is 50ms-ish overhead on tiny rigs. | |

**User's choice:** N = 100 rows
**Captured as:** D-195

---

### Q8 — AnimationBreakdown virtualization shape

**Question:** How do we virtualize AnimationBreakdownPanel's collapsible cards?

| Option | Description | Selected |
|--------|-------------|----------|
| Virtualize per-card row lists, not the card list (Recommended) | Each animation card stays in the regular DOM (probably ~16 cards for a complex rig — cheap). When a card expands, the row list inside it virtualizes if rows > threshold. Keeps card-collapse state and accordion UX simple; only attacks the actual perf hot path (long row lists in expanded cards). | ✓ |
| Virtualize the outer card list too | Both the list of animation cards AND each card's inner rows are virtualized. Handles edge case of 100+ animations. More complex (variable-height outer items — each card's height depends on collapse state). | |
| Skip AnimBreakdown virtualization entirely | Only virtualize GlobalMaxRenderPanel (flat table, easy win). Defer AnimBreakdown to a follow-up if profiling shows it actually janks. Contradicts the 'both panels' decision above — worth flagging if you want to revisit. | |

**User's choice:** Virtualize per-card row lists, not the card list
**Captured as:** D-196

---

## Pacing checkpoint

**Question:** More questions about Performance, or move on? (Remaining areas you skipped earlier: Settings modal, Rig info + Documentation, 08.2 deferred polish triage.)

| Option | Description | Selected |
|--------|-------------|----------|
| Move to Settings modal | samplingHz exposure, menu placement, validation UX, persistence model. | |
| Move to Rig info + Documentation | Tooltip surface for skeleton.fps + bone/slot/anim counts, and the in-app help view shape. | |
| Move to 08.2 deferred polish triage | Decide which of OS file association, reopen-last, window state, auto-save, native Quit-on-Win→Linux land in this phase. | |
| I'm ready for context — write CONTEXT.md | Performance is the only area you wanted. Skip the other three; write the context doc and head to plan-phase. The unvisited areas become Claude's Discretion or get answered with reasonable defaults during planning. | ✓ |

**User's choice:** I'm ready for context — write CONTEXT.md
**Notes:** Discussion ends here. Three skipped areas captured as Claude's Discretion in CONTEXT.md with suggested defaults; planner may revisit during plan-phase.

---

## Claude's Discretion

The following areas were presented but not discussed. CONTEXT.md captures suggested defaults under "Claude's Discretion":

- **Settings modal** — minimal samplingHz exposure (dropdown 60/120/240 + custom number input), per-project persistence via the existing `.stmproj` `samplingHz` field (no schema change), Edit→Preferences (macOS) / File→Settings (Win/Linux) menu placement.
- **Rig-info tooltip** — attaches to the toolbar filename chip (Phase 8 D-144 surface); shows skeleton name + bones/slots/attachments/animations/skins counts + `skeleton.fps` clearly labeled "(editor metadata — does not affect sampling)".
- **Documentation surface** — single-page in-app help, modal-style (`HelpDialog.tsx`), static markdown shipped in repo, triggers from Help menu (fills 08.2 D-188 placeholder) and optionally a "?" toolbar button.

## Deferred Ideas

The "08.2 deferred polish triage" area was not selected. Default applied: NONE of the 08.2-routed polish items land in Phase 9. They stay in CONTEXT.md's deferred table for a post-MVP polish phase or installer-hardening phase. Specifically: OS file association, reopen-last-project, window state persistence, auto-save/crash recovery, native Quit-via-File→Exit on Win/Linux. macOS Help-menu search comes free with the documentation deliverable.
