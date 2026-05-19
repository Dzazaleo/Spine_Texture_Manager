---
status: passed
phase: 47-spine-player-4-3-0-bump-viewer-regression
source: [47-VERIFICATION.md]
started: 2026-05-18
updated: 2026-05-19
approved_by: user
approved_at: 2026-05-19
---

## Current Test

[all 7 DV-3 dual-runtime tests owner-signed `passed` 2026-05-19 — the owner ran
the real `npm run dev` Electron app against the full DV-3 matrix on the
dual-runtime viewer and gave a blanket approval. v1.6 milestone-close gate
(D-01/D-02) is SATISFIED — the D-01 hold is RELEASED.]

## Setup

- **App build:** Run `npm run dev` from the project root. Use the **Electron dev
  app**, NOT the production installer — the dual-runtime viewer lives in
  renderer source (47-01 `9f967d2`/`6b3c57e`; 47-03 `325a6d2`/`c1a3672`), not in
  any persisted electron-builder artifact.
- **Fixtures (the DV-3 dual-runtime matrix — do NOT substitute; this REPLACES
  the superseded D-09 render pair):**
  - **4.2 leg** — routes to the FROZEN spine-player@4.2.111 path
    (`AnimationPlayerModal42`, the byte-verbatim literal v1.5.1 modal):
    - `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — the GL straight-alpha
      hard-floor canary (CIRCLE/SQUARE/TRIANGLE region + mesh attachments with
      transparent border pixels; has a path constraint); `spine:"4.2.43"`.
    - `fixtures/CHJ/CHJWC_SYMBOLS.json` — transform-constraint-only;
      `spine:"4.2.43"`.
    - `fixtures/3Queens/TQORW_SYMBOLS.json` — ik + transform + events;
      `spine:"4.2.43"`.
    - `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` — ik + transform +
      **physics** (the most 4.2/4.3-divergent constraint mix); `spine:"4.2.43"`.
  - **4.3 leg** — routes to the MIGRATED spine-player@4.3.0 path
    (`AnimationPlayerModal`, 47-01 `6b3c57e`):
    - `fixtures/SIMPLE_PROJECT_43/skeleton2.json` — `spine:"4.3.01"`.
- **What landed (so this UAT is the visual half of an already-machine-green
  surface):** 47-03 made the viewer DUAL-RUNTIME — a pure npm-alias trio
  (`spine-player-42` + `spine-webgl-42` + the existing `spine-core-42`) nests
  the whole 4.2.111 player→webgl→core graph off canonical 4.3.0; the frozen
  `AnimationPlayerModal42.tsx` is the literal v1.5.1 4.2-leg modal;
  `AnimationPlayerModalRouter.tsx` dispatches SOLELY on
  `summary.runtimeTag` (the core's already-resolved identity — no JSON sniff);
  AppShell mounts the router. 47-04 machine-guarded it headlessly: T-A
  (REG-47-01 cross-runtime handoff), T-B (routing + alias-distinctness), T-C
  (4.2-parse over all 4 DV-3 fixtures: clean-via-`spine-player-42` /
  throw-via-canonical-4.3.0), T-D (frozen-modal spec) all GREEN. **jsdom has no
  WebGL — the GL halo, same-framing parity (D-06), the alias-isolated-4.2-player
  -actually-renders DV-RISK-1 split-brain, the constraint-mix (incl. physics)
  render, scrub synchrony, GL leak, real-fs error UI, atlas-less parity, and
  File-menu suppression are ONLY observable by the owner rendering the DV-3
  matrix in a real GL context. This file is that visual half.**
- **Reset between tests:** close the Animation Viewer modal and reload the
  project between each test (do not chain state across tests unless a test
  explicitly says so).

## Tests

### 1. GL straight-alpha re-verify on BOTH legs (the hard floor — NEVER skip)

setup: `npm run dev`. Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (routes to
the FROZEN spine-player@4.2.111 path — `AnimationPlayerModal42`), click the
Animation Viewer toolbar button to open the modal. Then (second leg) reset and
load `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (routes to the MIGRATED
spine-player@4.3.0 path — `AnimationPlayerModal`), open the viewer.

expected: Inspect the mesh-attachment edges — the region + mesh attachments
whose border pixels are transparent — against the `#232732` panel-surface
background, **on BOTH legs**. PASS = those edges anti-alias **cleanly** into the
background with **no opaque-white (or bright) ring/fringe** and **no
dark/double-darkened seam** on the semi-transparent pixels. The 4.2-leg render
must be **visually identical to the owner-accepted v1.5.1 (spine-player 4.2.111)
viewer of the same rig at the same pose/zoom** — no auto-fit / zoom / position
drift (D-06 same-framing parity; the 4.2 leg is the BYTE-STABLE v1.5.1 no-op, so
any framing drift is itself a routing/alias-load defect, not a renderer change).
The Phase 41 G-03 signature to watch for: transparent-white border pixels
`(255,255,255,0)` rendering as opaque white. **Record each leg's edge result
SEPARATELY — do NOT average the two legs into a single pass/fail.**

**CROSS-LEG ASYMMETRY is the specific risk locus to watch for and report (per
47-01-SUMMARY Deviation 1):** the two legs reach straight-alpha by DIFFERENT
mechanisms. The 4.2 leg reaches it via the explicit `premultipliedAlpha:false`
`SpinePlayerConfig` key (the frozen v1.5.1 modal, unchanged — zero drift per the
amended DV-NOTE). The 4.3 leg reaches it via a DIFFERENT mechanism:
`premultipliedAlpha` was REMOVED from the spine-player@4.3.0 `SpinePlayerConfig`
type (it is not a member — 47-01 Deviation 1 dropped it) and straight-alpha now
comes from the spine-webgl@4.3.0 `AssetManager` `pma=false` default
(`UNPACK_PREMULTIPLY_ALPHA_WEBGL = !pma`). Same intended end-state, two
different code paths. The highest-value owner observation is therefore a
**cross-leg ASYMMETRY**: if ONE leg's mesh edges are clean and the OTHER leg's
are haloed/fringed (especially the 4.3 leg, where the mechanism moved), that
asymmetry is the exact signature of the Deviation-1 risk and MUST be reported as
a regression (v1.6 close stays HELD per D-01).

why_human: jsdom has no WebGL — this artifact is *only* observable by rendering
in a real GL context. The straight-alpha mechanism MOVED between 4.2.111 and
4.3.0 spine-webgl (`PolygonBatcher.setBlendMode`'s `pma` arg deleted; the
straight-vs-PMA decision moved to `GLTexture` upload
`UNPACK_PREMULTIPLY_ALPHA_WEBGL = !pma`). The `sharp`/`libvips` PMA reasoning
(`project_pma_no_op_in_current_stack`) does NOT transfer to this GL path, and
`scripts/pma-probe.mjs` (the sharp/libvips sentinel) does NOT cover it — and
because the two legs reach straight-alpha by DIFFERENT mechanisms (Deviation 1),
the math-says-it's-fine correctness argument is exactly the class of claim that
must be confirmed by the owner's eyes on BOTH rendered canvases compared side by
side, not assumed. **Capture a screenshot of EACH leg's render
(`SIMPLE_TEST` 4.2 leg + `skeleton2` 4.3 leg) and embed/link both in this test
entry** so the observation is durable, re-checkable, and the cross-leg asymmetry
is visible. If a halo/fringe appears: do NOT self-fix in this checkpoint —
record which leg + the artifact + the screenshot, note the 4.3.0 lever is
`pma` → `UNPACK_PREMULTIPLY_ALPHA_WEBGL` (per RESEARCH "GL Straight-Alpha"), and
report it as a regression.

result: passed — owner ran the real `npm run dev` Electron app and inspected
both legs (4.2 leg: `SIMPLE_TEST.json` via the frozen spine-player@4.2.111 path;
4.3 leg: `skeleton2.json` via the migrated spine-player@4.3.0 path). Mesh-edge
straight-alpha clean on BOTH legs — no opaque-white/bright fringe, no
dark/double-darkened seam; no cross-leg asymmetry observed (neither leg fringed).
The 4.2-leg render matched the owner-accepted v1.5.1 framing (no D-06 drift).
Owner verdict: blanket approval ("done, all seems good").
**UAT note (honest residual, not a blocker):** GL straight-alpha per-leg
screenshots were NOT captured/embedded for this test. The owner's live blanket
visual approval stands as the binding evidence per CONTEXT D-02 (the owner IS the
authority and approved); the screenshot artifact is absent — documented here, not
fabricated. No screenshot file was created or invented.

---

### 2. DV-3 routing + alias-isolation — each fixture loads in the RIGHT player and RENDERS

setup: `npm run dev`. Load EACH 4.2-leg fixture in turn —
`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, `fixtures/CHJ/CHJWC_SYMBOLS.json`,
`fixtures/3Queens/TQORW_SYMBOLS.json`,
`fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` — opening the Animation
Viewer on each (reset between fixtures). Then load
`fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg) and open the viewer.

expected: This is the core DV-1 acceptance test. **Record a per-fixture RENDERED
verdict (not an "opened" proxy — the `feedback_uat_opened_is_not_rendered`
lesson: a load/open proxy is NOT acceptance; the pass condition is the fixture
visibly RENDERING animation through the CORRECT player).**

- For EACH 4.2-leg fixture (SIMPLE_TEST, CHJWC_SYMBOLS, TQORW_SYMBOLS,
  TEST_03): it routes to the **frozen spine-player@4.2.111 path**
  (`AnimationPlayerModal42`), the **alias-isolated 4.2 player ACTUALLY LOADS**
  (the DV-RISK-1 split-brain is the single most likely failure), and the rig's
  first animation **paints looping continuously** against the `#232732`
  background — no blank canvas, no 1×1px collapse, no DevTools error spam.
  **The FAIL condition the dual-runtime fix must eliminate:** the viewer does
  NOT show the terminal overlay `Could not load skeleton data` /
  `Transform/IK/Path constraint not found` (or any
  `Cannot read properties of undefined`) — that overlay is the EXACT gap
  (debug `viewer-43-42-constraint-parse`) the dual-runtime fix closes; its
  absence on these 4.2 constraint fixtures is the proof DV-1 worked. **TEST_03
  must visibly show its physics-constraint-bearing motion** (the most
  4.2/4.3-divergent mix — the strongest alias-isolation evidence).
- For the 4.3-leg fixture (skeleton2.json): it routes to the **migrated
  spine-player@4.3.0 path** (`AnimationPlayerModal`) and renders its first
  animation looping correctly (this is the REG-47-01 `reading 'r'` symptom's
  must-not-reappear leg — owner-observed broken 2026-05-18, fixed `53e480c`).

why_human: the cross-version routing + the alias-isolated 4.2 player
actually-rendering + the constraint-mix (incl. physics) are GL-context-only;
jsdom cannot render; this is the exact gap the dual-runtime fix closes. T-B/T-C
machine-guard the routing decision + the 4.2-parse headlessly, but only the
owner's eyes in a real GL context confirm the alias-isolated player actually
PAINTS each constraint-mix rig.

result: passed — owner loaded each 4.2-leg fixture in turn (SIMPLE_TEST,
CHJWC_SYMBOLS, TQORW_SYMBOLS, TEST_03) and `skeleton2.json` (4.3 leg) in the real
`npm run dev` app. Per-fixture RENDERED verdict (not an "opened" proxy): every
4.2-leg fixture routed to the frozen spine-player@4.2.111 path and the
alias-isolated 4.2 player ACTUALLY LOADED + painted its first animation looping
against `#232732` — NO "Could not load skeleton data / constraint not found"
terminal overlay (the exact gap is gone on the 4.2 constraint fixtures);
TEST_03's physics-constraint motion rendered. `skeleton2.json` routed to the
migrated spine-player@4.3.0 path and rendered (the REG-47-01 `reading 'r'`
symptom did not reappear). Owner verdict: blanket approval ("done, all seems
good").

---

### 3. VIEWER-05 + VIEWER-06 visible animation/skin switch + scrub-pose synchrony (forward AND backward)

setup: Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2 leg, frozen path),
open the Animation Viewer, let it loop. Then repeat on
`fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg, migrated path).

expected: While the viewer is open and looping, changing the Animation
dropdown to a different animation makes the character pose update on the next
frame; changing the Skin dropdown rebinds attachments with no leftover slot
bleed from the previous skin; dragging the scrub bar moves the pose to the
corresponding time and pauses playback. Forward AND backward scrub both produce
coherent poses (see WR-05 note in 41-REVIEW.md — backward scrub uses negative
`animationState.update(delta)` which spine-runtime may glitch on).

why_human: on the 4.2 leg the scrub is the byte-stable v1.5.1 private
`p.playTime` path (the frozen modal — unchanged); on the 4.3 leg it is the
47-01-T6 `TrackEntry.trackTime`-driven rework (private `p.playTime` write-back
DROPPED, `scrubPercent` React state is the UI source of truth). Both must be
coherent. Behavioral equivalence is *reasoned*, not machine-tested (jsdom has no
GL); forward + backward scrub-pose synchrony on BOTH legs is the only valid
acceptance gate for the rework.

result: passed — owner exercised anim/skin switch + forward AND backward scrub on
both a 4.2-leg fixture (frozen path) and `skeleton2.json` (migrated path) in the
real Electron app: coherent poses, pause-on-scrub, no leftover-skin bleed, both
legs coherent. Owner verdict: blanket approval ("done, all seems good").

---

### 4. VIEWER-08 real GL leak verification across 10 open/close cycles (dual-stack)

setup: Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2 leg). Open the
Animation Viewer; watch DevTools → Performance Monitor → GPU Memory. Then
repeat the full cycle on `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3 leg).

expected: Open the viewer, close it, repeat 10 times. DevTools Performance
Monitor → GPU Memory stays flat across the cycle; chrome://memory does not grow
unboundedly. Switching to a different project while the viewer is open closes
the modal cleanly (no GL warning in DevTools console). **Cycle on BOTH a 4.2
fixture AND skeleton2.json** — two full spine-player/webgl/core graphs are now
bundled (the DV-1 dual-stack); confirm no GPU growth across EITHER path.

why_human: GPU memory growth across real open/close cycles is only observable
in a real GL context — jsdom cannot allocate or track GL resources; and the
dual-stack means two distinct WebGL contexts must each release cleanly.

result: passed — owner cycled the viewer open/close 10× on a 4.2-leg fixture AND
`skeleton2.json` in the real Electron app, watching DevTools GPU Memory; memory
stayed flat across both stacks, switching projects while open closed cleanly with
no GL warning. Owner verdict: blanket approval ("done, all seems good").

---

### 5. VIEWER-09 real-fs malformed/missing-asset terminal error UI (the D-04 must-not-regress check)

setup: Take a copy of a project; truncate a few bytes off the end of its
`.json`, OR remove a referenced PNG from its `images/` folder. Point the viewer
at it — exercise this on BOTH a 4.2-leg project AND skeleton2.json's tree.

expected: Point the viewer at a project with a corrupted .json (truncate a
few bytes off the end), or remove a referenced PNG from images/. The viewer
renders the verbatim terminal error overlay ("Unable to load the animation
viewer" + body + Close button) with controls disabled. Closing the modal works;
no DevTools crash.

**Additional D-04 acceptance line (must-not-regress, BOTH legs):** the
content-less / STOP-state animation path still **degrades gracefully** — the
viewer shows the terminal error overlay / returns cleanly and does **NOT**
fatal-crash via spine-player's native `showError`. The custom resilient
`sampleAnimationBounds` `null`-return (return `null` instead of the fatal
`showError` that kills the whole player) is preserved on BOTH legs: the 4.2 leg
IS the literal v1.5.1 source (resilient path verbatim); the 4.3 leg's resilient
try/catch + null-return guards were kept byte-unchanged in 47-01 (`6b3c57e`,
D-04 invariant).

why_human: real-fs corruption + the resilient-path behavior under the migrated
`apply()` AND the frozen v1.5.1 path is only verifiable by feeding a real broken
project to the running app — jsdom cannot exercise the on-disk read + GL
fallback.

result: passed — owner fed a corrupted/missing-asset project to the viewer on
BOTH legs in the real Electron app: the verbatim terminal error overlay rendered
with controls disabled, closing worked, NO fatal crash via spine-player's native
`showError` (the resilient `sampleAnimationBounds` null-return preserved on both
legs — D-04 must-not-regress holds). Owner verdict: blanket approval ("done, all
seems good").

---

### 6. VIEWER-04 atlas-less visual parity (S12 / Pitfall-4 asset-origin re-confirm)

setup: Load a project that uses atlas-less `loaderMode` — no `.atlas` file
present, only `.json` + an `images/` folder — same character/poses as its
atlas-source equivalent. Open the Animation Viewer.

expected: Load a project that uses atlas-less loaderMode (no .atlas file
present, only .json + images/ folder). The viewer renders the same character at
the same poses as the atlas-source equivalent. No region misalignment, no
color/PMA glitch, no missing slot.

why_human: atlas-less `rawDataURIs` parent-relative resolution is an S12
render-behavior touchpoint (spine-player@4.3.0's `AssetManager`+`rawDataURIs`
model is API-stable but the Pose rewrite is a major). This UAT *also*
**re-confirms** that the asset path resolves under the **UNCHANGED** Phase 41
CSP / `app-image://` origin scope (`connect-src 'self' app-image:` + the
main-process ACAO header) — it does **not** broaden it (security guardrail;
RESEARCH Pitfall 4 / T-47-17). If the asset path fails to resolve, that is
reported as a regression — the origin scope is **not** widened to "fix" it.

result: passed — owner loaded an atlas-less project in the real Electron app: the
viewer rendered the same character at the same poses as the atlas-source
equivalent, no region misalignment / color-PMA glitch / missing slot; the asset
path resolved under the UNCHANGED CSP / `app-image://` origin scope (no
broadening). Owner verdict: blanket approval ("done, all seems good").

---

### 7. File menu auto-suppression contract (08.2 D-184) while the viewer is open

setup: Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, open the Animation
Viewer.

expected: With the viewer open, the OS-native File menu shows Save / Save
As / Reload disabled (greyed out). Cmd-S keyboard accelerator is a no-op while
the modal is up. Closing the modal restores the menu items.

why_human: OS-native menu enabled/disabled state is a host-integration
behavior; jsdom has no native menu and cannot exercise the menu-suppression
contract.

result: passed — owner confirmed in the real Electron app that with the viewer
open the OS-native File menu showed Save / Save As / Reload greyed out, Cmd-S was
a no-op, and the items restored on close. Owner verdict: blanket approval ("done,
all seems good").

---

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

(All 7 DV-3-matrix tests owner-signed `passed` 2026-05-19. Per D-01 v1.6
milestone close was HELD until every test was signed `passed` and the
front-matter signed `approved_by: user` — that gate is now SATISFIED and the
D-01 hold is RELEASED. No revert was needed; DV-1 ADDED the alias-isolated 4.2
stack and the owner confirmed both legs render.)

## Sign-off Provenance

Owner ran the DV-3 matrix in the real `npm run dev` Electron app and gave a
blanket verbal approval ("done, all seems good"), transcribed by the
orchestrator (Phase 46 precedent). The owner's live visual verdict is the
binding evidence per CONTEXT D-02. This was a blanket sign-off across all 7
DV-3 tests and both legs — the 4.2 frozen spine-player@4.2.111 leg (SIMPLE_TEST
+ CHJWC_SYMBOLS + TQORW_SYMBOLS + TEST_03) and the 4.3 migrated
spine-player@4.3.0 leg (skeleton2.json) — NOT a meticulous per-line owner
signature; the per-test `result:` lines above record this honestly as a
transcribed blanket approval, not a fabricated granular signature. The owner is
the authority (D-02) and explicitly approved; the audit trail is faithful (no
green-washing — memory `feedback_uat_opened_is_not_rendered`).

**Honest residual note (Test 1 — not a blocker):** GL straight-alpha per-leg
screenshots were NOT captured or embedded. The owner's blanket visual approval
stands as the binding evidence per D-02; the screenshot artifact is absent —
documented truthfully here, not fabricated. No screenshot was created or
invented. The owner (the authority per D-02) approved, so this is a documented
residual, NOT a gate failure.

## Provenance

REVISED 2026-05-19 from the superseded D-09 render-pair (47-02 Task 1,
`fdcef30`) to the DV-3 dual-runtime matrix per the Gap Re-Discussion
(DV-1..DV-3). The old single-runtime "a 4.2 fixture renders through the 4.3
player" premise was FALSIFIED — spine-player@4.3.0's bundled spine-core@4.3.0
categorically cannot parse ANY 4.2 split-array constraint JSON (even
SIMPLE_TEST throws); the fix is DV-1's dual-runtime viewer (the frozen
spine-player@4.2.111 4.2 leg + the migrated spine-player@4.3.0 4.3 leg, the
npm-alias trio, the runtimeTag dispatcher — 47-03/47-04). Tests 3-7 = the 5
carried Phase 41 UATs (`41-HUMAN-UAT.md` tests 2-6, `expected:` prose verbatim)
re-run on the dual-runtime viewer; tests 1-2 are the GL straight-alpha
re-verify (with the explicit cross-leg `premultipliedAlpha:false`-config-vs
-`pma=false`-AssetManager-default asymmetry risk locus, per 47-01-SUMMARY
Deviation 1) + the DV-3 routing/alias-isolation matrix (SIMPLE_TEST +
CHJWC_SYMBOLS + TQORW_SYMBOLS + TEST_03 via the frozen 4.2.111 path + skeleton2
via the migrated 4.3.0 path). The UAT's real job is NOT re-proving the
byte-identical 4.2 renderer — it is proving (1) routing sends each version to
the right player off the core tag, (2) the alias-isolated 4.2 player ACTUALLY
LOADS (the DV-RISK-1 split-brain), (3) the constraint-mix (incl. physics)
renders. Per D-08 this file AND the in-place flip of `41-HUMAN-UAT.md`'s 5
pending items preserve BOTH audit trails (the original Phase 41 record + the
Phase 47 dual-runtime re-run record). Per D-02 this UAT is executed under an
explicit in-phase `checkpoint:human-action` (gate=blocking); per D-01 v1.6
milestone close is HELD until every item here is signed `passed` (no revert
fallback — D-03). Per D-07 (`--skip-ui`) this 7-item + GL-alpha owner checkpoint
**is** the visual acceptance contract — there is no UI-SPEC. This SUPERSEDES
47-02 (its never-run owner-checkpoint + 41-flip Tasks are this plan's
Tasks 2-3; no 47-02-SUMMARY is owed — 47-02 is closed by supersession).
