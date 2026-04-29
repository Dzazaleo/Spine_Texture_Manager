# Deferred items — Phase 15

## Pre-existing typecheck error in untracked debug probe (out-of-scope, logged 2026-04-29 during Plan 15-04 Task 1)

`npm run typecheck` reports one error in `scripts/probe-per-anim.ts:14:31`:

```
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
```

**Why this is out-of-scope for Phase 15:**

- File is **gitignored** (`.gitignore` rule `scripts/probe-*.ts` — "Debug probe scripts — ad-hoc sampler/analyzer investigations, not part of the app")
- File has **never been committed** at any SHA (`git log -- scripts/probe-per-anim.ts` is empty across all branches)
- File **mtime is 2026-04-22**, predating Phase 14's start (2026-04-28) and Phase 15's start (2026-04-29) by over a week — error is pre-existing, not Plan-15-introduced
- Verified: with the throwaway moved aside (`mv scripts/probe-per-anim.ts /tmp/`), `npm run typecheck` exits 0 cleanly across both `tsconfig.node.json` and `tsconfig.web.json`
- The error stems from a `core/sampler.ts` API evolution (`SamplerOutput` shape changed during Phase 0/1 development) — the throwaway probe was a one-off investigation script that was never updated to match the new API

**Recommended disposition:** Either (a) update the throwaway to match the current `SamplerOutput` shape if it's still useful for sampler debugging, or (b) delete it. Either way, NOT a Phase 15 release-engineering concern.

**Why not auto-fixed under Rule 1:** The deviation rules' SCOPE BOUNDARY explicitly excludes "Pre-existing warnings, linting errors, or failures in unrelated files." This file is the textbook case — it's gitignored, untracked, and the error existed for ~7 days before Phase 15 work began.

**Plan 15-04 Task 1 typecheck acceptance:** Met as far as Plan 15's code surface is concerned (all tracked files in `src/`, `tests/`, `scripts/emit-latest-yml.mjs`, `scripts/cli.ts`, etc. typecheck cleanly).

## 2026-04-29 — Plan 15-06 Task 1 Step 7 (typecheck)

**Out-of-scope finding:** Local `npm run typecheck` fails on `scripts/probe-per-anim.ts:14:31`
(`Property 'values' does not exist on type 'SamplerOutput'`).

**Why deferred:**
- File is gitignored (matches `scripts/probe-*.ts`); CI clean-checkout never sees it.
- The `probe-*.ts` files are throwaway developer scripts; not part of release artifacts.
- CI typecheck (release.yml:56) runs against tracked files only → will pass on CI.
- Verified: `git ls-files scripts/` returns only `cli.ts`, `emit-latest-yml.mjs`, `.gitkeep`.

**Resolution candidate:** Add `"exclude": [..., "scripts/probe-*.ts"]` to tsconfig.node.json
in a future cleanup plan; keeps local + CI typecheck behavior consistent.
