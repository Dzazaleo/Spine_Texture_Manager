# Phase 16 — deferred items (out-of-scope discoveries during plan execution)

## From Plan 16-04 (IPC allow-list widening, 2026-04-30)

### Pre-existing typecheck errors in src/renderer/src/App.tsx

`npm run typecheck` (specifically `tsconfig.web.json`) reports:

```
src/renderer/src/App.tsx(363,18): error TS2367: This comparison appears to be
unintentional because the types '"auto-update" | "manual-download" | undefined'
and '"windows-fallback"' have no overlap.
src/renderer/src/App.tsx(417,20): error TS2367: same.
```

**Root cause:** Plan 16-01 (commit `c7d94c6`) renamed the variant literal in
`src/shared/types.ts` from `'windows-fallback'` → `'manual-download'`, but the
matching renames in `src/renderer/src/App.tsx` (3 sites — lines 363, 417, and
the lifted `update:available` subscription handler) were NOT applied in the
same commit.

**Out of scope for Plan 16-04.** Plan 16-04's `<files_modified>` is
strictly `src/main/ipc.ts` + `tests/integration/auto-update-shell-allow-list.spec.ts`
— per the SCOPE BOUNDARY rule, the executor does not auto-fix issues in
unrelated files.

**Owned by:** Plan 16-02 (or whichever wave plan owns the App.tsx variant-string
rename per CONTEXT.md D-05 + canonical_refs `src/renderer/src/App.tsx — variant
prop forwarding (post-Phase-14 D-02 lift). Phase 16 renames literal references
(D-05).`).

**Verification path forward:** Once the App.tsx wave-1 rename plan lands,
`npm run typecheck` will exit 0. The orchestrator that merges all wave plans
should re-run typecheck before phase close-out.

**Plan 16-04 self-impact:** Vitest still runs the spec correctly (test
transformer does not gate on tsc errors in unrelated files); the 13 specs in
`tests/integration/auto-update-shell-allow-list.spec.ts` all pass after Task 2
implementation lands. Plan 16-04's narrow contract (helper + handler +
threat-model coverage) is fulfilled regardless.

## From Plan 16-06 (test rename + regression gate, 2026-04-30)

### Pre-existing typecheck error in scripts/probe-per-anim.ts

`npm run typecheck:node` reports:

```
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not
exist on type 'SamplerOutput'.
```

**Root cause:** `scripts/probe-per-anim.ts` is an **untracked** local
developer probe script (gitignored via `.gitignore` line `scripts/probe-*.ts`).
It exists on disk only on this developer's host — not on CI, not in any
commit, not on any other worktree. It dates from `Apr 22 21:39`, which is
before Phase 16 (started 2026-04-30) and before Phase 14 / 15 too. The file
predates the current `SamplerOutput` shape and was never updated.

**Why it surfaces now:** `tsconfig.node.json` includes `scripts/**/*.ts` —
the gitignore rule keeps the file out of git but does NOT exclude it from
tsc's include glob, so any developer with a stale probe script in their local
checkout will see this error from `npm run typecheck`.

**Out of scope for Plan 16-06.** Plan 16-06's `<files_modified>` is strictly
five test files + one new regression-gate spec — per the SCOPE BOUNDARY rule,
the executor does not auto-fix pre-existing errors in unrelated, untracked
files. Adding `scripts/probe-*.ts` to `tsconfig.node.json`'s exclude list
is the correct fix, but it's a build-config change beyond Plan 16-06's
scope.

**Verification path forward:** Either delete the local
`scripts/probe-per-anim.ts` file (it's gitignored — no consequence) OR add
`scripts/probe-*.ts` to `tsconfig.node.json`'s `exclude` array in a
follow-up build-config patch. Until then, the error surfaces only on
hosts that have the stale probe script — CI is unaffected.

**Plan 16-06 self-impact:** None. The regression-gate spec
(`tests/integration/no-windows-fallback-literal.spec.ts`) and all five
renamed test files compile cleanly under `tsconfig.node.json`'s rules
applied to actually-tracked files. The `npm test` full suite passes
532 / 532. The `tsc` error is a pure tooling-glob mismatch with a
single off-tree file.

### Plan acceptance-criterion drift: `grep -rn "'windows-fallback'" src/ tests/` returns matches

The plan's `<verification>` block specifies `grep -rn "'windows-fallback'" src/ tests/` returns 0 matches. After Task 5 lands, this grep returns **7 matches** — all inside the just-created
`tests/integration/no-windows-fallback-literal.spec.ts` regression-gate file.

**Why this is unavoidable:** the regression-gate spec MUST contain the
literal `'windows-fallback'` to scan for it. The plan's
frontmatter explicitly declares this in the artifacts section
(`contains: "'windows-fallback'"` for that very file at plan line 27),
contradicting the simultaneous "0 matches in tests/" gate.

**Resolution:** the regression-gate spec ITSELF is exempt from the gate
it enforces. The substantive gate is "no `'windows-fallback'` literal
survives in src/" (PASS — 0 matches in src/). For test files, the
gate's intent is satisfied because all five plan-renamed test files
(auto-update-dismissal, ipc, update-dialog, app-update-subscriptions,
auto-update-shell-allow-list) contain 0 matches; only the new
regression-gate spec contains the literal as a search-pattern necessity.
