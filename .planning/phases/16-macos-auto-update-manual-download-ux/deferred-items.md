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
