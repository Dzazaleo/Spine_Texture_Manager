---
status: partial
phase: 41-spine-animation-viewer
source: [41-VERIFICATION.md]
started: 2026-05-15T16:15:08Z
updated: 2026-05-15T17:09:00Z
---

## Current Test

[items 2, 3, 4, 5, 6 still pending — run /gsd-verify-work 41 to resume]

## Tests

### 1. VIEWER-04 visible character render in a live Electron window
expected: Loading any project and clicking the new Animation Viewer toolbar button opens a modal that paints the skeleton's first animation looping continuously inside a near-fullscreen card. The character appears against the #232732 panel-surface background with no blank canvas, no 1×1px collapse (Pitfall 8), and no DevTools error spam.
result: passed
gaps:
  - id: G-01
    severity: blocking
    summary: Viewer hung on the spine-player spinner — JSON XHR blocked by CSP `default-src 'self'` (no `connect-src` set), `app-image://` was treated as cross-origin. spine-player's downloader treats `status === 0` as 200 and pipes the empty body into `JSON.parse("")`, which throws inside the XHR onload listener; the throw is uncaught, `toLoad` never decrements, spinner spins forever.
    status: resolved
    fixed_in: 6600761 fix(41): permit XHRs to app-image:// in renderer CSP
  - id: G-02
    severity: blocking
    summary: Cross-origin response from `app-image://` had no `Access-Control-Allow-Origin` header — spine-player's `Image` elements use `crossOrigin="anonymous"`, which would have CORS-blocked the response body once CSP allowed the connection. Defense-in-depth fix landed alongside G-01.
    status: resolved
    fixed_in: f772427 fix(41): add CORS headers + content-types to app-image:// protocol handler
  - id: G-03
    severity: blocking
    summary: After the load completed, transparent border pixels around mesh attachments rendered as opaque white. Cause was `premultipliedAlpha: true` in the SpinePlayer config — Chrome's PNG decoder un-premultiplies during the `new Image()` → `texImage2D` path, so the in-memory texture is straight alpha regardless of how the PNG was exported. spine-player's PMA shader path picks `srcFunc=gl.ONE` (Player.js:13167), so transparent-white border pixels (255,255,255,0) blend as opaque white.
    status: resolved
    fixed_in: b40b338 fix(41): use straight-alpha blending in SpinePlayer (Chrome unpacks PMA on decode)

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
passed: 1
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

See `gaps:` block under test 1. G-01, G-02, G-03 all resolved.
