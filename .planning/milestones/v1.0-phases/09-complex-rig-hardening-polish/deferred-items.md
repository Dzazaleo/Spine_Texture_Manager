# Phase 9 — Deferred items log

Out-of-scope discoveries surfaced during plan execution. Per executor SCOPE
BOUNDARY rule, these are documented but NOT fixed in their discovering plan.

---

## Discovered during 09-01 (Wave 0 scaffold)

### probe-per-anim.ts TS2339 (pre-existing)

- **File:** `scripts/probe-per-anim.ts:14`
- **Error:** `Property 'values' does not exist on type 'SamplerOutput'.`
- **Discovered:** Wave 0 (09-01) typecheck — `npx tsc --noEmit -p tsconfig.node.json`
- **Pre-existing:** Yes — confirmed via `git stash` test against the post-08.2
  baseline (`6236a2f`); error reproduces without any Phase 9 changes.
- **Why deferred:** Out of Phase 9 scope. `scripts/probe-per-anim.ts` is a
  one-off ad-hoc probe, not part of the Phase 9 surface (worker / virtualization
  / settings / tooltip / help). CLAUDE.md does not list `scripts/probe-*.ts`
  as a maintained artifact.
- **Suggested owner:** A future cleanup phase or a quick-fix commit outside
  Phase 9 (one-line: change `output.values` to whatever the new SamplerOutput
  shape calls for, or delete the script if unused).
