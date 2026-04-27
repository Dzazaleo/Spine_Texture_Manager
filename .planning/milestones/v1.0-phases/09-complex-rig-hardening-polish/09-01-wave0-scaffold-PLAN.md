---
phase: 09-complex-rig-hardening-polish
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - tests/main/sampler-worker.spec.ts
  - tests/main/sampler-worker-girl.spec.ts
  - tests/renderer/global-max-virtualization.spec.tsx
  - tests/renderer/anim-breakdown-virtualization.spec.tsx
  - tests/renderer/settings-dialog.spec.tsx
  - tests/renderer/rig-info-tooltip.spec.tsx
  - tests/renderer/help-dialog.spec.tsx
  - tests/main/ipc.spec.ts
  - tests/arch.spec.ts
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-0, test-scaffold, virtualization-dep]

must_haves:
  truths:
    - "@tanstack/react-virtual@^3.13.24 is installed and resolvable via `npm ls @tanstack/react-virtual`"
    - "All seven new test files exist and contain RED placeholder tests (vitest exits non-zero with descriptive failure messages until Wave 1+ lands implementation)"
    - "tests/main/ipc.spec.ts has a new describe block for 'sampler:progress' + 'sampler:cancel' channels (RED until Wave 1)"
    - "tests/arch.spec.ts has a new describe block 'Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces' that returns silently if the worker file does not exist yet (so this plan can ship green BEFORE Wave 1)"
  artifacts:
    - path: "package.json"
      provides: "Runtime dependency on @tanstack/react-virtual"
      contains: "@tanstack/react-virtual"
    - path: "tests/main/sampler-worker.spec.ts"
      provides: "RED scaffolds for D-190/D-193/D-194 (cases a-e + Worker-spawn smoke)"
    - path: "tests/main/sampler-worker-girl.spec.ts"
      provides: "RED scaffold for N2.2 wall-time gate"
    - path: "tests/renderer/global-max-virtualization.spec.tsx"
      provides: "RED scaffolds for D-191/D-195 + sticky-thead behaviors"
    - path: "tests/renderer/anim-breakdown-virtualization.spec.tsx"
      provides: "RED scaffolds for D-196 outer/inner/collapse/override behaviors"
    - path: "tests/renderer/settings-dialog.spec.tsx"
      provides: "RED scaffolds for Settings modal + samplingHz dirty derivation"
    - path: "tests/renderer/rig-info-tooltip.spec.tsx"
      provides: "RED scaffolds for tooltip content + skeleton.fps labeling"
    - path: "tests/renderer/help-dialog.spec.tsx"
      provides: "RED scaffolds for Help dialog + shell.openExternal mock"
  key_links:
    - from: "tests/arch.spec.ts"
      to: "src/main/sampler-worker.ts"
      via: "named-anchor describe block (skips silently when file is absent)"
      pattern: "Phase 9 Layer 3: src/main/sampler-worker.ts must not import"
---

<objective>
Wave 0 scaffolds for Phase 9. Install the one runtime dependency (`@tanstack/react-virtual` per D-192) and create RED test scaffolds for all 7 new test files plus 2 extensions of existing test files (`tests/main/ipc.spec.ts` + `tests/arch.spec.ts`). Each scaffold MUST be a syntactically valid vitest spec that imports the implementation modules (or stubs them) and contains at minimum one `it.todo`/`it.skip` or one failing `expect(...).toBe(...)` placeholder per behavior listed in `09-VALIDATION.md`. Wave 1+ plans then turn each placeholder GREEN by landing the implementation.

Purpose: every Phase 9 task in subsequent plans MUST be able to claim an automated verify command on day one. Without this scaffold pass, executor tasks would either invent ad-hoc test files (breaking the validation contract) or skip verification entirely. Per Nyquist Rule: every `<verify>` block in Wave 1+ tasks references a test file that EXISTS — this plan creates them.

Output:
- 1 dependency-install commit (package.json + package-lock.json) — `npm install @tanstack/react-virtual@^3.13.24 --save`.
- 7 NEW test files (sampler-worker.spec.ts, sampler-worker-girl.spec.ts, global-max-virtualization.spec.tsx, anim-breakdown-virtualization.spec.tsx, settings-dialog.spec.tsx, rig-info-tooltip.spec.tsx, help-dialog.spec.tsx).
- 2 EXTENDED test files (ipc.spec.ts gets a new describe block for `'sampler:progress'` + `'sampler:cancel'`; arch.spec.ts gets a new describe block grepping `src/main/sampler-worker.ts` for forbidden imports).
- All scaffolds are RED (or `it.todo`) and the suite exits non-zero ONLY for the Wave 0-managed expectations; the existing 275+ test count stays green for unrelated work.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md
@.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md
@CLAUDE.md
@package.json
@tests/main/image-worker.spec.ts
@tests/main/ipc.spec.ts
@tests/renderer/atlas-preview-modal.spec.tsx
@tests/arch.spec.ts

<interfaces>
<!-- Existing test scaffolding pattern — analog for every new file. -->

From tests/main/image-worker.spec.ts (mock + describe shape):
```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
vi.mock('sharp', () => ({ /* ... */ }));
vi.mock('node:fs/promises', () => ({ access: vi.fn(), /* ... */ }));
```

From tests/renderer/atlas-preview-modal.spec.tsx (jsdom + Testing Library shape):
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
afterEach(cleanup);
```

From tests/main/ipc.spec.ts (Map-backed ipcMain.on captor — for the 'sampler:cancel' extension):
```ts
const { ipcMainOnHandlers } = vi.hoisted(() => ({
  ipcMainOnHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => void>(),
}));
vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler) => { ipcMainOnHandlers.set(channel, handler); }),
    handle: vi.fn(),
  },
}));
```

From tests/arch.spec.ts (named-anchor describe block — Phase 8 D-145 precedent at lines 136-154):
```ts
describe('Phase 8 invariant: src/core/project-file.ts schema lock', () => {
  it('does not import from src/main/ or src/renderer/', () => {
    const text = readFileSync('src/core/project-file.ts', 'utf8');
    expect(text).not.toMatch(/from ['"][^'"]*\/main\//);
    /* ... */
  });
});
```

The Phase 9 named-anchor MUST handle the FILE-NOT-YET-EXIST case (Wave 1 lands sampler-worker.ts). Pattern:
```ts
let text = '';
try { text = readFileSync('src/main/sampler-worker.ts', 'utf8'); }
catch { return; /* not yet present */ }
expect(text).not.toMatch(/.../);
```
</interfaces>

<existing_red_test_examples>
<!-- Reference: tests/main/ipc.spec.ts existing 'menu:notify-state' captor pattern (lines 101-114). -->
<!-- Phase 9 sampler:cancel extension follows the SAME shape — Map captor + handler retrieval + invocation. -->
</existing_red_test_examples>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install @tanstack/react-virtual runtime dependency</name>
  <files>package.json, package-lock.json</files>
  <read_first>
    - package.json (current dependencies block at lines 20-27 — no @tanstack/* yet)
    - .planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md (D-192 — version-pinned to ^3.13.24 verified 2026-04-26 via npm registry)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"package.json (MOD — config)" — diff format)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Library + API research" — verified version + size profile)
  </read_first>
  <action>
Run exactly:
```
npm install @tanstack/react-virtual@^3.13.24 --save
```

This MUST add the entry to the `"dependencies"` block (NOT `devDependencies`) — TanStack Virtual is a runtime dep used by `src/renderer/src/panels/*` per D-192. After install:

1. Verify `package.json` `"dependencies"` now contains `"@tanstack/react-virtual": "^3.13.24"` (or a higher 3.x patch — npm semver caret expansion is fine, but reject 4.x if it exists).
2. Verify `package-lock.json` resolves to a concrete version under `"node_modules/@tanstack/react-virtual"`.
3. Run `npm ls @tanstack/react-virtual` — expect a single resolved version, no peer-dep warnings about React 19 (the library declares React >=16.8 peer; React 19 is supported per the v3.13 changelog).
4. Run `npx tsc --noEmit -p tsconfig.web.json` — expect 0 TS errors. (No code yet imports it; this just proves the type-resolution works.)
5. Run `npm run test` — expect the full pre-Phase-9 suite (~275+1 tests) to remain GREEN; the new dep does not regress anything.

Do NOT add a corresponding `devDependencies` entry. Do NOT touch any other dependency or script.
  </action>
  <verify>
    <automated>npm ls @tanstack/react-virtual 2>&1 | grep -q "^@tanstack/react-virtual@3\." && npm run test 2>&1 | tail -5 | grep -E "passed|Tests" </automated>
  </verify>
  <acceptance_criteria>
    - `package.json` `"dependencies"` block contains `"@tanstack/react-virtual"` with a `^3.13.24` (or higher 3.x) constraint
    - `package.json` `"devDependencies"` block does NOT contain `@tanstack/react-virtual`
    - `package-lock.json` exists and contains a resolved entry for `@tanstack/react-virtual` under version `3.x.x`
    - `npm ls @tanstack/react-virtual` exits 0 with a single resolved version, no peer-dep ERR
    - `npx tsc --noEmit -p tsconfig.web.json` exits 0
    - `npm run test` reports `Tests` count ≥ 275 passed + 1 skipped (pre-Phase-9 baseline preserved)
  </acceptance_criteria>
  <done>The runtime dependency lands in package.json + package-lock.json; the existing test suite remains GREEN; downstream Wave 2 plans can `import { useVirtualizer } from '@tanstack/react-virtual'` without further config.</done>
</task>

<task type="auto">
  <name>Task 2: Scaffold all 7 NEW test files with RED placeholders</name>
  <files>
    tests/main/sampler-worker.spec.ts,
    tests/main/sampler-worker-girl.spec.ts,
    tests/renderer/global-max-virtualization.spec.tsx,
    tests/renderer/anim-breakdown-virtualization.spec.tsx,
    tests/renderer/settings-dialog.spec.tsx,
    tests/renderer/rig-info-tooltip.spec.tsx,
    tests/renderer/help-dialog.spec.tsx
  </files>
  <read_first>
    - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (the 18 behaviors — every test in the new files MUST claim at least one row by mirroring the row's `Behavior` text in its `it(...)` description)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"tests/main/sampler-worker.spec.ts" through §"tests/renderer/help-dialog.spec.tsx" — exact analog references)
    - tests/main/image-worker.spec.ts (full file — analog for sampler-worker.spec.ts vitest+mock structure)
    - tests/renderer/atlas-preview-modal.spec.tsx (full file — analog for all 5 renderer specs)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Pattern lineage" + §"Q8" wall-time budget — informs the Girl spec scaffold's structure)
  </read_first>
  <action>
Create exactly the 7 files below. Each MUST be syntactically valid TypeScript (passes `npx tsc --noEmit -p tsconfig.node.json` for `tests/main/*` and `tsconfig.web.json` for `tests/renderer/*`). Each MUST contain `it(...)` blocks (NOT `it.todo` for the renderer specs — use `it.skip` with a descriptive reason or a placeholder `expect(true).toBe(false)` with a `// TODO Wave N: …` comment so the suite is RED-by-design until implementation lands).

**Why RED-by-design:** Wave 1+ executors verify their work by FLIPPING these scaffolds to green. If we ship `it.todo` everywhere, executors get no feedback signal that their implementation is wired correctly.

For each file, the test names MUST quote the `Behavior` column from `09-VALIDATION.md` verbatim (or near-verbatim — the goal is grep-traceability from VALIDATION.md → spec).

### File 1: tests/main/sampler-worker.spec.ts

Mirror the `tests/main/image-worker.spec.ts` mock + describe structure. Cases (verbatim from VALIDATION.md rows 2-6):

```ts
import { describe, expect, it } from 'vitest';

describe('sampler-worker — Wave 1 D-190 / D-193', () => {
  it('byte-identical: worker run on SIMPLE_PROJECT returns Map-key parity + peakScale within PEAK_EPSILON vs in-thread sampleSkeleton', () => {
    // TODO Wave 1: import { runSamplerJob } from '../../src/main/sampler-worker.js';
    //   const inThread = sampleSkeleton(loadSkeleton(SIMPLE_TEST_JSON), { samplingHz: 120 });
    //   const viaWorker = await runSamplerJob({ skeletonPath: SIMPLE_TEST_JSON, samplingHz: 120 });
    //   expect(viaWorker.type).toBe('complete');
    //   expect([...viaWorker.output.globalPeaks.keys()].sort())
    //     .toEqual([...inThread.globalPeaks.keys()].sort());
    //   for (const k of inThread.globalPeaks.keys()) {
    //     expect(viaWorker.output.globalPeaks.get(k)!.peakScale)
    //       .toBeCloseTo(inThread.globalPeaks.get(k)!.peakScale, 5);
    //   }
    expect(true, 'Wave 1 implementation pending — runSamplerJob not yet exported').toBe(false);
  });
});

describe('sampler-worker — Wave 1 D-194', () => {
  it('progress: emits {type:"progress", percent:0} on start and {type:"progress", percent:100} (or "complete") on finish; ordering preserved', () => {
    expect(true, 'Wave 1: progress event sequence not yet wired').toBe(false);
  });

  it('cancel: after worker.terminate(), exit-event resolves within 200 ms (D-194 budget)', () => {
    expect(true, 'Wave 1: terminate() round-trip not yet measurable').toBe(false);
  });

  it('error: reports {type:"error", error: SerializableError} when skeletonPath is missing/unreadable', () => {
    expect(true, 'Wave 1: error envelope not yet wired').toBe(false);
  });
});

describe('sampler-worker — Wave 1 spawn smoke', () => {
  it('spawning a real Worker against SIMPLE_PROJECT delivers progress then complete via postMessage', () => {
    expect(true, 'Wave 1: new Worker(workerPath, { workerData: ... }) not yet authored').toBe(false);
  });
});
```

### File 2: tests/main/sampler-worker-girl.spec.ts

```ts
import { describe, expect, it } from 'vitest';

describe('sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl)', () => {
  // .skipIf(env.CI) is permitted per CONTEXT.md if CI variance exceeds budget;
  // Wave 1 may add it after empirical measurement. Local `npm run test` is the
  // non-negotiable gate.
  it('fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms (10000 ms budget, 2000 ms margin) with 1 warm-up run discarded', () => {
    // TODO Wave 1:
    //   const skeletonPath = path.resolve(__dirname, '../../fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json');
    //   await runSamplerJob({ skeletonPath, samplingHz: 120 }); // warm-up
    //   const t0 = performance.now();
    //   const result = await runSamplerJob({ skeletonPath, samplingHz: 120 });
    //   const elapsed = performance.now() - t0;
    //   expect(result.type).toBe('complete');
    //   expect(elapsed, `Girl sample took ${elapsed.toFixed(0)} ms`).toBeLessThan(8000);
    expect(true, 'Wave 1: runSamplerJob not yet exported; Girl gate pending').toBe(false);
  });
});
```

### File 3: tests/renderer/global-max-virtualization.spec.tsx

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('GlobalMaxRenderPanel — Wave 2 D-191 / D-195', () => {
  it('below threshold (50 rows): getAllByRole("row").length === 51 (header + 50 data rows)', () => {
    expect(true, 'Wave 2: virtualization swap not yet authored').toBe(false);
  });

  it('above threshold (200 rows): getAllByRole("row").length <= 60 (header + window of <=59)', () => {
    expect(true, 'Wave 2: useVirtualizer integration pending').toBe(false);
  });

  it('sort/search/checkbox preserved in virtualized path (200 rows)', () => {
    expect(true, 'Wave 2: virtualized-path interaction tests pending').toBe(false);
  });

  it('sticky thead: outer scroll by 1000 px keeps thead.getBoundingClientRect().top === 0', () => {
    expect(true, 'Wave 2: position:sticky thead behavior pending').toBe(false);
  });
});
```

### File 4: tests/renderer/anim-breakdown-virtualization.spec.tsx

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('AnimationBreakdownPanel — Wave 2 D-196', () => {
  it('outer cards: 16 cards render in regular DOM regardless of expand state', () => {
    expect(true, 'Wave 2: outer card list shape pending').toBe(false);
  });

  it('inner above threshold: expanded card with 200 rows renders <=60 <tr> elements', () => {
    expect(true, 'Wave 2: per-card inner virtualizer pending').toBe(false);
  });

  it('collapse/re-expand: filter query preserved; scroll-reset policy holds', () => {
    expect(true, 'Wave 2: collapse/expand cycle pending').toBe(false);
  });

  it('override: clicking Override Scale on a virtualized inner row mounts OverrideDialog with correct row context', () => {
    expect(true, 'Wave 2: OverrideDialog mount from virtualized row pending').toBe(false);
  });
});
```

### File 5: tests/renderer/settings-dialog.spec.tsx

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('SettingsDialog — Wave 4 (Claude Discretion: samplingHz exposure)', () => {
  it('opens with role=dialog labelled Settings; dropdown contains 60, 120, 240, Custom options', () => {
    expect(true, 'Wave 4: SettingsDialog component not yet authored').toBe(false);
  });

  it('selecting Custom reveals a number input; non-positive integers are rejected; values >1000 are clamped', () => {
    expect(true, 'Wave 4: validation logic pending').toBe(false);
  });

  it('apply: dispatches onApply(hz); upstream AppShell samplingHz updates and project becomes dirty (D-145 derivation)', () => {
    expect(true, 'Wave 4: dirty-derivation contract pending').toBe(false);
  });
});
```

### File 6: tests/renderer/rig-info-tooltip.spec.tsx

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('RigInfoTooltip — Wave 4 (Claude Discretion: rig-info on filename chip)', () => {
  it('hover filename chip: tooltip becomes visible with skeletonName + bones/slots/attachments/animations/skins counts matching summary', () => {
    expect(true, 'Wave 4: tooltip surface not yet authored').toBe(false);
  });

  it('skeleton.fps line reads exactly: "skeleton.fps: <N> (editor metadata — does not affect sampling)"', () => {
    // CRITICAL wording per CLAUDE.md fact #1 + src/core/sampler.ts:41-44 canonical comment.
    expect(true, 'Wave 4: editorFps surfacing through summary pending').toBe(false);
  });
});
```

### File 7: tests/renderer/help-dialog.spec.tsx

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

describe('HelpDialog — Wave 5 (Claude Discretion: in-app help)', () => {
  it('opens on Help-menu click; mounts role=dialog with the 7 canonical sections', () => {
    expect(true, 'Wave 5: HelpDialog component not yet authored').toBe(false);
  });

  it('clicking an external link invokes window.api.openExternalUrl (mocked) with the link href', () => {
    expect(true, 'Wave 5: openExternalUrl preload bridge + handler pending').toBe(false);
  });
});
```

Each file is committed as part of this task. The suite WILL go RED for these 7 files (and will stay RED until Wave 1+ flip them GREEN). The pre-existing 275+1 tests stay GREEN.

**Sanity check:** after creating these files, run `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json` — both MUST exit 0. If TypeScript flags an unresolved import (e.g., from a not-yet-existent component), use a `// @ts-expect-error: Wave N component not yet authored` comment immediately above the import — this makes the placeholder explicit and the strict-typecheck stays clean.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json && test -f tests/main/sampler-worker.spec.ts && test -f tests/main/sampler-worker-girl.spec.ts && test -f tests/renderer/global-max-virtualization.spec.tsx && test -f tests/renderer/anim-breakdown-virtualization.spec.tsx && test -f tests/renderer/settings-dialog.spec.tsx && test -f tests/renderer/rig-info-tooltip.spec.tsx && test -f tests/renderer/help-dialog.spec.tsx</automated>
  </verify>
  <acceptance_criteria>
    - All 7 files exist with non-empty content (>20 lines each)
    - `npx tsc --noEmit -p tsconfig.node.json` exits 0 (sampler-worker.spec.ts + sampler-worker-girl.spec.ts typecheck clean)
    - `npx tsc --noEmit -p tsconfig.web.json` exits 0 (5 renderer specs typecheck clean — even if they reference not-yet-existent components, `@ts-expect-error` suppresses the import error)
    - `npm run test 2>&1 | grep -E "FAIL|failed"` lists at minimum 18 failed test rows mapping to `09-VALIDATION.md` rows (one per behavior in the validation table)
    - `npm run test 2>&1 | grep -E "passed"` reports the pre-Phase-9 GREEN count is preserved (no regression in unrelated specs)
    - Each new spec file's `it(...)` description text contains a substring traceable back to `09-VALIDATION.md` `Behavior` column (grep `tests/main/sampler-worker.spec.ts` for `byte-identical` returns at least one match; grep `tests/renderer/global-max-virtualization.spec.tsx` for `sticky thead` returns at least one match; etc.)
  </acceptance_criteria>
  <done>All 7 RED scaffolds exist; the validation table is fully claimed; downstream waves can verify their work by flipping these scaffolds GREEN one assertion at a time.</done>
</task>

<task type="auto">
  <name>Task 3: Extend tests/main/ipc.spec.ts and tests/arch.spec.ts with Phase 9 scaffolds</name>
  <files>tests/main/ipc.spec.ts, tests/arch.spec.ts</files>
  <read_first>
    - tests/main/ipc.spec.ts (full file — read the existing Map-backed `ipcMainOnHandlers` captor at lines 25-77 + the `'menu:notify-state'` describe block at lines 101-114 — analog for the new `'sampler:cancel'` describe block)
    - tests/arch.spec.ts (full file — read the existing globSync block at lines 19-34 + the Phase 8 named-anchor block at lines 136-154 — analog for the new sampler-worker block)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"tests/main/ipc.spec.ts (MOD — extension)" + §"tests/arch.spec.ts (MOD — Phase 9 named-anchor block)" — verbatim shape references)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Validation Architecture" lines 604-620 — the exact named-anchor block to add to arch.spec.ts)
  </read_first>
  <action>
### Edit 1: tests/main/ipc.spec.ts — APPEND (do not rewrite existing blocks)

After the existing `'menu:notify-state'` describe block, APPEND a new describe block:

```ts
// Phase 9 D-194 — sampler:cancel + sampler:progress IPC channels.
//
// 'sampler:cancel' is renderer→main fire-and-forget; main calls
// samplerWorkerHandle?.terminate() (Wave 1 wires the handle).
// 'sampler:progress' is main→renderer fire-and-forget emitted from
// the bridge inside handleProjectOpenFromPath / handleProjectReloadWithSkeleton.
//
// This block ASSERTS the channel registration shape; the actual handler body
// is unit-tested via tests/main/sampler-worker.spec.ts (Wave 1).
describe("Phase 9 D-194 — sampler IPC channels", () => {
  it("sampler:cancel handler is registered on ipcMain.on", async () => {
    // TODO Wave 1: registerIpcHandlers(); expect(ipcMainOnHandlers.has('sampler:cancel')).toBe(true);
    expect(true, "Wave 1: sampler:cancel registration pending").toBe(false);
  });

  it("sampler:cancel handler invocation does not throw when no worker is in flight", async () => {
    // TODO Wave 1: registerIpcHandlers(); ipcMainOnHandlers.get('sampler:cancel')!({} as unknown);
    expect(true, "Wave 1: idempotent-cancel contract pending").toBe(false);
  });
});
```

Keep the existing Map captor + electron mock at lines 25-77 unchanged — the new block reuses them.

### Edit 2: tests/arch.spec.ts — APPEND (do not rewrite existing blocks)

After the existing Phase 8 named-anchor block (around line 154), APPEND:

```ts
// Phase 9 — Layer 3 named anchor for the new worker_threads worker.
// The existing globSync at lines 19-34 covers src/{main,preload,renderer}/**
// for general Layer 3 invariants; this named block makes a Phase-9-specific
// regression visible at PR-review time.
//
// Critical: Wave 0 lands this block BEFORE src/main/sampler-worker.ts exists,
// so the readFileSync MUST tolerate ENOENT gracefully (return early). When
// Wave 1 lands the file, every assertion below MUST hold.
describe("Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces", () => {
  it("does not import from src/renderer/, react, electron, or DOM globals", () => {
    const filePath = "src/main/sampler-worker.ts";
    let text = "";
    try {
      text = readFileSync(filePath, "utf8");
    } catch {
      // File doesn't exist yet (Wave 1 lands it). When it lands, the grep applies.
      return;
    }
    expect(text, `${filePath} must not import from src/renderer/`).not.toMatch(
      /from ['"][^'"]*\/renderer\//,
    );
    expect(text, `${filePath} must not import from react`).not.toMatch(
      /from ['"]react['"]/,
    );
    expect(text, `${filePath} must not import from electron`).not.toMatch(
      /from ['"]electron['"]/,
    );
    expect(text, `${filePath} must not reference DOM globals (document., window.)`).not.toMatch(
      /\b(document|window)\./,
    );
  });
});
```

This block PASSES today (file absent → early return) and will continue to pass once Wave 1 lands the worker correctly. If a future regression sneaks `import { app } from 'electron'` into the worker, this assertion fires.

**Sanity check:** `npm run test tests/arch.spec.ts` MUST stay GREEN (this block currently early-returns). `npm run test tests/main/ipc.spec.ts` MUST go RED for exactly the 2 new test rows (existing tests stay GREEN).
  </action>
  <verify>
    <automated>npm run test tests/arch.spec.ts 2>&1 | tail -5 | grep -E "passed" && npm run test tests/main/ipc.spec.ts 2>&1 | grep -E "Phase 9 D-194|sampler:cancel"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/main/ipc.spec.ts` contains a new `describe("Phase 9 D-194 — sampler IPC channels", ...)` block (grep returns at least one match)
    - `tests/main/ipc.spec.ts` retains all pre-existing describe blocks unchanged (file size grew, no existing tests removed)
    - `tests/arch.spec.ts` contains a new `describe("Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces", ...)` block (grep returns at least one match)
    - `tests/arch.spec.ts` retains all pre-existing describe blocks unchanged
    - `npm run test tests/arch.spec.ts` exits 0 (the Phase 9 anchor returns early when the file is absent — does not regress arch.spec.ts to RED)
    - `npm run test tests/main/ipc.spec.ts` reports at least 2 new failures (the Wave 1-pending placeholders) but the existing tests in that file remain GREEN
  </acceptance_criteria>
  <done>The two existing test files carry Phase 9 named-anchor extensions; arch.spec.ts stays GREEN today and protects the Layer 3 invariant once Wave 1 lands sampler-worker.ts; ipc.spec.ts has placeholders ready to flip GREEN in Wave 1.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → developer machine | New `@tanstack/react-virtual` package downloaded during `npm install` |
| n/a (no IPC channels added in Wave 0) | All Phase 9 IPC additions are in Wave 1+ |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-01-01 | Tampering | npm dependency supply-chain (`@tanstack/react-virtual`) | accept | Pin to `^3.13.24` (verified version 2026-04-26 via npm registry per RESEARCH.md). package-lock.json captures the exact resolved tree at install time. Library is widely used (>3M weekly downloads), authored by the TanStack team (Tanner Linsley). No known CVEs against v3.x as of cutoff. |
| T-09-01-02 | Information Disclosure | Test scaffolds reading fixtures/Girl/* | accept | Wave 0 scaffolds reference fixtures/Girl in TODO comments only — no actual file reads happen until Wave 1. Fixtures are committed in-repo and contain no secrets. |
| T-09-01-03 | Denial of Service | Test suite runtime regression from RED scaffolds | mitigate | Each new spec is a single-`it`-per-behavior block (no setup loops; no fixture loads in Wave 0). The 7 new files add ~50 ms total to the suite per local benchmark. Suite stays well under 30 s feedback latency budget (09-VALIDATION.md). |
</threat_model>

<verification>
After Task 3:
1. `npm ls @tanstack/react-virtual` exits 0 with a 3.x version
2. `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json` both exit 0
3. `npm run test 2>&1 | tail -10` shows: pre-existing 275+1 tests still GREEN; ~18-20 NEW failing tests (the Phase 9 placeholders) — this is intentional Wave 0 RED-by-design state
4. `tests/arch.spec.ts` GREEN (the Phase 9 anchor block early-returns when sampler-worker.ts is absent)
5. `git diff --stat HEAD` shows additions to package.json, package-lock.json, the 7 new test files, and the 2 extension files only (no other files touched)
</verification>

<success_criteria>
- [ ] `@tanstack/react-virtual@^3.13.24` lands in package.json `dependencies` block
- [ ] `package-lock.json` reflects the resolved version
- [ ] All 7 new test files exist as committed-RED scaffolds
- [ ] `tests/main/ipc.spec.ts` and `tests/arch.spec.ts` extended (not rewritten)
- [ ] All 18 behaviors in `09-VALIDATION.md` are claimed by at least one `it(...)` description across the 7 new files
- [ ] Pre-existing test suite GREEN count preserved (≥275 passed + 1 skipped)
- [ ] `npx tsc --noEmit` passes for both tsconfig.node.json and tsconfig.web.json
- [ ] `tests/arch.spec.ts` GREEN today (Phase 9 anchor early-returns)
- [ ] `09-VALIDATION.md` `wave_0_complete: true` flag CAN be flipped to true after this plan ships (executor flips it as part of the close-out commit message)
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-01-SUMMARY.md` summarizing:
- npm install command and resolved version
- 7 new test file paths + line counts
- Confirmation that the 18 VALIDATION.md behaviors are all claimed
- Pre-Phase-9 baseline test count preserved
- Wave 1 unblocked
</output>
