---
status: partial
phase: 41-spine-animation-viewer
source: [41-VERIFICATION.md]
started: 2026-05-15T16:15:08Z
updated: 2026-05-15T16:15:08Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. VIEWER-04 visible character render in a live Electron window
expected: Loading any project and clicking the new Animation Viewer toolbar button opens a modal that paints the skeleton's first animation looping continuously inside a near-fullscreen card. The character appears against the #232732 panel-surface background with no blank canvas, no 1×1px collapse (Pitfall 8), and no DevTools error spam.
result: [pending]

### 2. VIEWER-05 + VIEWER-06 visible animation/skin switch + scrub-pose synchrony
expected: While the viewer is open and looping, changing the Animation dropdown to a different animation makes the character pose update on the next frame; changing the Skin dropdown rebinds attachments with no leftover slot bleed from the previous skin; dragging the scrub bar moves the pose to the corresponding time and pauses playback. Forward AND backward scrub both produce coherent poses (see WR-05 note in 41-REVIEW.md — backward scrub uses negative `animationState.update(delta)` which spine-runtime may glitch on).
result: [pending]

### 3. VIEWER-08 real GL leak verification across 10 open/close cycles
expected: Open the viewer, close it, repeat 10 times. DevTools Performance Monitor → GPU Memory stays flat across the cycle; chrome://memory does not grow unboundedly. Switching to a different project while the viewer is open closes the modal cleanly (no GL warning in DevTools console).
result: [pending]

### 4. VIEWER-09 real-fs malformed/missing asset terminal error UI
expected: Point the viewer at a project with a corrupted .json (truncate a few bytes off the end), or remove a referenced PNG from images/. The viewer renders the verbatim terminal error overlay ("Unable to load the animation viewer" + body + Close button) with controls disabled. Closing the modal works; no DevTools crash.
result: [pending]

### 5. VIEWER-04 atlas-less visual parity with atlas-source
expected: Load a project that uses atlas-less loaderMode (no .atlas file present, only .json + images/ folder). The viewer renders the same character at the same poses as the atlas-source equivalent. No region misalignment, no color/PMA glitch, no missing slot.
result: [pending]

### 6. File menu auto-suppression contract (08.2 D-184) while viewer is open
expected: With the viewer open, the OS-native File menu shows Save / Save As / Reload disabled (greyed out). Cmd-S keyboard accelerator is a no-op while the modal is up. Closing the modal restores the menu items.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
