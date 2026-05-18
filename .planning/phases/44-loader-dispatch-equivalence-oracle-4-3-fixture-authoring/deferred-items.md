# Phase 44 — Deferred / Out-of-Scope Items

## 44-03 (Plan 03 execution)

### [OUT-OF-SCOPE — Phase-47-owned, pre-existing] electron-vite renderer build abort: spine-player MixBlend

- **Found during:** 44-03 Task 3, Entrypoint 2 (`npx electron-vite build`).
- **Symptom:** `electron-vite build` exits non-zero with
  `"MixBlend" is not exported by ".../@esotericsoftware/spine-core/dist/index.js",
  imported by ".../@esotericsoftware/spine-player/dist/Player.js"` —
  the RENDERER bundle target fails AFTER the main/worker chunks are emitted.
- **Why NOT a Phase-44 regression / NOT auto-fixed:** This is the documented
  spine-player `.d.ts`/runtime 4.3-leak handed to Phase 47 by roadmap design
  (STATE.md Roadmap-Evolution 2026-05-16 Phase-42 Option-1; memory
  `project_renderer_mixblend_preexisting_failure`). It is downstream of the
  `out/main` emit — `out/main/sampler-worker.cjs` + `runtime-42.cjs` +
  `runtime-43.cjs` ARE produced cleanly (verified fresh-mtime, Task 3
  Entrypoint 2 PASS). The existing `tests/main/sampler-worker.spec.ts`
  GAP-43-PROD-SEAM harness already tolerates this exact non-zero exit by
  design. Out of scope for v1.6 core phases; Phase 47 owns the spine-player
  bump + the renderer surface (sequenced last, revertible).
- **Disposition:** No action. Tracked at milestone level (STATE.md / memory).
  Recorded here for the Phase-44 paper trail only.
