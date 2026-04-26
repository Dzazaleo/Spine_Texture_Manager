# Phase 7 — Deferred Items

Out-of-scope discoveries logged during plan execution.

## From Plan 07-03

### Pre-existing typecheck error in `scripts/probe-per-anim.ts`

- **File:** `scripts/probe-per-anim.ts` (untracked — only `.gitkeep` and `cli.ts` are committed under `scripts/`).
- **Error:** `scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.`
- **Status:** Pre-existing developer probe file; not part of any phase plan. SamplerOutput shape evolved at some point and the probe drifted.
- **Verification:** Moving the file aside and running `npm run typecheck:node` exits 0 — the error is isolated to this untracked file. The base branch (worktree base `aec30fc`) carries the same untracked file in the working tree.
- **Disposition:** Out of scope per executor SCOPE BOUNDARY (file untracked, unrelated to Phase 7 changes). Surface to user later if `scripts/` cleanup is desired.
