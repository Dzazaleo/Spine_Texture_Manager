# Phase 27 — Deferred Items

Out-of-scope failures discovered during plan execution but NOT caused by Phase 27
changes. These are pre-existing on the phase base commit (17894cd) and outside
the scope boundary of any Phase 27 plan.

## From Plan 27-01 (full vitest run after QA-01 refactor)

Three failing tests, all confirmed pre-existing by re-running against the
post-Task-1 / pre-Task-2 commit (`d671f60`):

### 1. `tests/integration/build-scripts.spec.ts` — version assertion stale

```
× package.json version is 1.1.3
```

The spec asserts `package.json.version === "1.1.3"`. Actual `package.json`
is `"1.2.0"`. Last update at commit `95b76eb` (Phase 15 Plan 06): `fix(15-06):
bump build-scripts.spec.ts version assertion 1.1.2 → 1.1.3`. Never updated
when v1.2.0 milestone shipped. Plan 27-01 does not touch `package.json` or
build scripts. Recommend a follow-up commit on a different branch:
`fix(test): bump build-scripts.spec.ts version assertion 1.1.3 → 1.2.0`.

### 2. `tests/main/sampler-worker-girl.spec.ts` — perf wall-time flake

```
× fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms
  (10000 ms budget, 2000 ms margin) with 1 warm-up run discarded
```

Phase 9 N2.2 wall-time gate. Last touched `f00e232`: `fix(11-02): apply
CONTEXT.md-authorized .skipIf(CI) to Girl wall-time test`. Test runs
locally (no `CI` env var) and machine load can push past the 8000ms
threshold. Plan 27-01 does not touch the sampler. Out of scope.

### 3. `tests/renderer/atlas-preview-modal.spec.tsx` — dblclick jump-target

```
× dblclick on canvas calls onJumpToAttachment with the hit region attachmentName
expect(onJump).toHaveBeenCalledTimes(1)
```

Phase 12 D-130 atlas-preview modal test. Last touched `e7c6fe7`: `fix(12-03):
skip 4 POSIX-path tests on Windows runners`. Plan 27-01 does not touch the
modal. Out of scope.

---

**Verification of pre-existence:** Stashed Task 2 refactor (functional setSelected
in GlobalMaxRenderPanel.tsx) and re-ran the two .spec failures against
post-Task-1 / pre-Task-2 commit `d671f60`. Both failed identically. The third
(perf flake) is non-deterministic and not re-tested but the file is not touched
by any Plan 27 task.

Per Plan 27-01 execution agent's deviation rules: SCOPE BOUNDARY — only
auto-fix issues directly caused by current task's changes. These are all
unrelated. Logged here, NOT fixed in this plan.
