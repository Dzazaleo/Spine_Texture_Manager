---
status: pending
phase: 47-spine-player-4-3-0-bump-viewer-regression
source: [47-VERIFICATION.md]
started: 2026-05-18
updated: 2026-05-18
approved_by:
approved_at:
---

## Current Test

[all 7 items pending — Task 2 owner `checkpoint:human-action`: run the real
Electron app, execute every item live on the spine-player@4.3.0 player, sign
each off; v1.6 milestone close is HELD per D-01 until every item is signed
`passed`]

## Setup

- **App build:** Run `npm run dev` from the project root. Use the Electron dev
  app, **not** the production installer — the spine-player@4.3.0 bump + the
  AnimationPlayerModal Pose-API migration live in renderer source (Plan 01
  commits `9f967d2`/`6b3c57e`/`e08a2a3`), not in any persisted electron-builder
  artifact.
- **Fixtures (the D-09 FIXED render pair — do NOT substitute):**
  `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (the 4.2 GL-alpha canary — the rig
  Phase 41 G-03 was *reproduced* on; CIRCLE/SQUARE/TRIANGLE region + mesh
  attachments with transparent border pixels) **+**
  `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`spine:"4.3.01"` — the 4.3
  ORCL-01 SIMPLE_TEST-equivalent sibling). The D-05 internal-touchpoint audit
  added **NO** extra rig (no alpha/render risk flagged — confirmed in
  `47-01-SUMMARY.md` Deviations + the RESEARCH D-05 verdict), so the pair is
  exactly these two.
- **Reset between tests:** close the Animation Viewer modal and reload the
  project between each test (do not chain state across tests unless a test
  explicitly says so).

## Tests

### 1. GL straight-alpha re-verify on the 4.3 player (the hard floor — NEVER skip)

setup: `npm run dev`. Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, click
the Animation Viewer toolbar button to open the modal. Then (second leg) reload
and load `fixtures/SIMPLE_PROJECT_43/skeleton2.json`, open the viewer.

expected: Inspect the mesh-attachment edges — the CIRCLE/SQUARE/TRIANGLE
region + mesh attachments whose border pixels are transparent — against the
`#232732` panel-surface background. PASS = those edges anti-alias **cleanly**
into the background with **no opaque-white (or bright) ring/fringe** and **no
dark/double-darkened seam** on the semi-transparent pixels. The render must be
**visually identical to the v1.5.1 (spine-player 4.2.111) render of the same rig
at the same pose/zoom** — no auto-fit / zoom / position drift (D-06 same-framing
parity; framing drift is itself a regression). Then load `skeleton2.json` (the
4.3 leg) and confirm the **same clean-edge result** (this rules out a
4.3-fixture-specific texture/atlas interaction). The Phase 41 G-03 signature to
watch for: transparent-white border pixels `(255,255,255,0)` rendering as opaque
white.

why_human: jsdom has no WebGL — this artifact is *only* observable by
rendering in a real GL context. The straight-alpha mechanism **moved** between
4.2.111 and 4.3.0: spine-webgl's `PolygonBatcher.setBlendMode`'s `pma` argument
was deleted; the straight-vs-PMA decision is now made at texture upload
(`GLTexture` `gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, !pma)`). The
Phase 41 G-03 root-cause note cites the now-**deleted** 4.2.111 code path
("`srcFunc=gl.ONE` Player.js:13167") — do **not** reason from it. **This test is
ALSO the binding empirical acceptance gate for the Plan 01 Wave-1 Rule-3
deviation:** RESEARCH D-05 T7's instruction to keep `premultipliedAlpha: false`
in the `SpinePlayerConfig` literal was source-falsified — that key was
**removed entirely** from spine-player@4.3.0's `SpinePlayerConfig` type, so the
migration (commit `6b3c57e`) dropped it; the straight-alpha behavioral
end-state is **unchanged** but is now produced by the spine-webgl
`AssetManager` hardcoded `pma=false` default rather than by a config knob (see
`47-01-SUMMARY.md` "Deviations from Plan" → Deviation 1). That correctness
argument is a 4-factor analytical claim ("the math says it's fine") across a
major version — exactly the class of claim that must be confirmed by eyes on
the rendered canvas, not assumed. The `sharp`/`libvips` PMA reasoning
(`project_pma_no_op_in_current_stack`) does **not** transfer to this GL path,
and `scripts/pma-probe.mjs` (the sharp/libvips sentinel) does **not** cover it.
**Capture a screenshot of the `SIMPLE_TEST` render and embed/link it in this
test entry** so the observation is durable and re-checkable — the screenshot is
the auditable evidence both for PLAYER-02's GL-alpha criterion and for the
dropped-config-key deviation. If a halo/fringe appears: do NOT self-fix in this
checkpoint — record the artifact + a screenshot, note that the 4.3.0 lever is
`pma` → `UNPACK_PREMULTIPLY_ALPHA_WEBGL` (per RESEARCH "GL Straight-Alpha"),
and report it as a regression (v1.6 close stays held per D-01).

result: [pending]

---

### 2. D-09 render pair — both the 4.2 and the 4.3 fixture render correctly through the 4.3 player (PLAYER-02 SC#1)

setup: `npm run dev`. (Leg A) Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`
(4.2), open the Animation Viewer. (Leg B) Reload, load
`fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3), open the Animation Viewer.

expected: Each fixture's skeleton paints its first animation **looping
continuously** in the near-fullscreen card against the `#232732`
panel-surface background — **no blank canvas**, **no 1×1px collapse**
(Pitfall 8), **no DevTools error spam**. Both legs must render correctly through
the single bumped spine-player@4.3.0 player.

why_human: cross-major GL render correctness on the two fixed D-09 fixtures;
jsdom has no WebGL and cannot render either leg.

result: [pending]

---

### 3. VIEWER-05 + VIEWER-06 visible animation/skin switch + scrub-pose synchrony (forward AND backward)

setup: Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, open the Animation
Viewer, let it loop.

expected: While the viewer is open and looping, changing the Animation
dropdown to a different animation makes the character pose update on the next
frame; changing the Skin dropdown rebinds attachments with no leftover slot
bleed from the previous skin; dragging the scrub bar moves the pose to the
corresponding time and pauses playback. Forward AND backward scrub both produce
coherent poses (see WR-05 note in 41-REVIEW.md — backward scrub uses negative
`animationState.update(delta)` which spine-runtime may glitch on).

why_human: Plan 01's T6 touchpoint reworked the scrub from the private
`p.playTime` write-back to a `TrackEntry.trackTime`-driven seek (RESEARCH D-05
T6 / Pitfall 5 / Assumption A1) — behavioral equivalence is *reasoned*, not
machine-tested (jsdom has no GL); **forward + backward scrub-pose synchrony is
the only valid acceptance gate** for that rework.

result: [pending]

---

### 4. VIEWER-08 real GL leak verification across 10 open/close cycles

setup: Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`. Open the Animation
Viewer; watch DevTools → Performance Monitor → GPU Memory.

expected: Open the viewer, close it, repeat 10 times. DevTools Performance
Monitor → GPU Memory stays flat across the cycle; chrome://memory does not grow
unboundedly. Switching to a different project while the viewer is open closes
the modal cleanly (no GL warning in DevTools console).

why_human: GPU memory growth across real open/close cycles is only
observable in a real GL context — jsdom cannot allocate or track GL resources.

result: [pending]

---

### 5. VIEWER-09 real-fs malformed/missing-asset terminal error UI (D-04 must-not-regress)

setup: Take a copy of a project; truncate a few bytes off the end of its
`.json`, OR remove a referenced PNG from its `images/` folder. Point the viewer
at it.

expected: Point the viewer at a project with a corrupted .json (truncate a
few bytes off the end), or remove a referenced PNG from images/. The viewer
renders the verbatim terminal error overlay ("Unable to load the animation
viewer" + body + Close button) with controls disabled. Closing the modal works;
no DevTools crash.

**Additional D-04 acceptance line (must-not-regress):** the content-less /
STOP-state animation path still **degrades gracefully** — the viewer shows the
terminal error overlay / returns cleanly and does **NOT** fatal-crash via
spine-player's native `showError`. The custom resilient `sampleAnimationBounds`
`null`-return (return `null` instead of the fatal `showError` that kills the
whole player) is preserved under the migrated `apply()` (D-04 invariant;
RESEARCH D-04 proved the line-255 apply() migration does not regress it; the
resilient try/catch + null-return guards were kept byte-unchanged in Plan 01,
commit `6b3c57e`).

why_human: real-fs corruption + the resilient-path behavior under the
migrated `apply()` is only verifiable by feeding a real broken project to the
running app — jsdom cannot exercise the on-disk read + GL fallback.

result: [pending]

---

### 6. VIEWER-04 atlas-less visual parity with atlas-source (S12 / Pitfall-4 asset-origin re-confirm)

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
CSP / `app-image://` origin scope (`connect-src 'self' app-image:` +
the main-process ACAO header) — it does **not** broaden it (security guardrail;
RESEARCH Pitfall 4 / T-47-05). If the asset path fails to resolve, that is
reported as a regression — the origin scope is **not** widened to "fix" it.

result: [pending]

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

result: [pending]

---

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

(Task 2 — the owner — runs every item live on the 4.3 player and flips these
counters to `passed: 7 / pending: 0` at sign-off; if any item regresses, that
item's `result:` records the regression and v1.6 close stays held per D-01.)

## Provenance

Tests 3-7 = the 5 carried Phase 41 UATs (`41-HUMAN-UAT.md` tests 2-6) re-run on
the spine-player@4.3.0 player. Tests 1-2 are the Phase 47 additions: the GL
straight-alpha re-verify (Test 1 — which Phase 41 *resolved* as G-03; Phase 47
*re-verifies* it on the new GL path, and it doubles as the empirical acceptance
gate for the Plan 01 Rule-3 `premultipliedAlpha`-key-removal deviation) + the
D-09 4.2/4.3 render-pair (Test 2 — PLAYER-02 SC#1). Per D-08, this file **and**
the in-place flip of `41-HUMAN-UAT.md`'s 5 pending items preserve **both** audit
trails (the original Phase 41 record + the Phase 47 re-run record). Per D-02
this UAT is executed under an explicit in-phase `checkpoint:human-action`
(gate=blocking); per D-01 v1.6 milestone close is HELD until every item here is
signed `passed` (no revert fallback — D-03 proved the bump is mechanically
non-revertible). Per D-07 (`--skip-ui`) this 7-item + GL-alpha owner checkpoint
**is** the visual acceptance contract — there is no UI-SPEC.
