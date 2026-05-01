# Phase 20 — Deferred / Out-of-scope Items

Items discovered during execution that are NOT caused by Phase 20 changes
and therefore not fixed by Phase 20 plans. Logged here per executor SCOPE
BOUNDARY rule for future cleanup phases.

## Pre-existing typecheck errors (not introduced by Phase 20-01)

Discovered: 2026-05-01 during Plan 20-01 GREEN phase typecheck.

- `scripts/probe-per-anim.ts(14,31)` — `Property 'values' does not exist on
  type 'SamplerOutput'`. SamplerOutput type drift; script is dev-only and
  not consumed by the app or tests. Predates Phase 20.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx(286,3)` —
  `'onQueryChange' is declared but its value is never read`. Unused prop;
  predates Phase 20.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx(531,3)` —
  `'onQueryChange' is declared but its value is never read`. Unused prop;
  predates Phase 20.

These three errors are present on the pre-Plan-20-01 commit (verified via
`git stash && npm run typecheck`). They are out of scope for Plan 20-01.

## Layer-3 carve-out (intentional, by design)

`tsconfig.web.json` `include` adds `src/core/documentation.ts` and the
`exclude` glob pattern `src/core/!(documentation).ts` is used in place of
the broader `src/core/**`. This is the documented Phase 20 D-01 route
(20-CONTEXT.md line 200, 20-PATTERNS.md line 824) — Documentation types +
runtime helpers live in src/core/documentation.ts and are re-exported
through src/shared/types.ts so the renderer's import-of-types stays legal
without breaching the Layer 3 grep gate (tests/arch.spec.ts:19-34, which
checks `src/renderer/**` — never imports `'../core/'` directly; the
renderer pulls everything through `'../../../shared/types.js'`).
