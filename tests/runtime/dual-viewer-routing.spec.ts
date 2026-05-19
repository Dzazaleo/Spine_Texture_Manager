// @vitest-environment jsdom
/**
 * Phase 47 Plan 04 — T-B: the dual-runtime viewer ROUTING regression +
 * alias-distinctness standing guard (DV-1a / DV-RISK-1).
 *
 * 47-03 landed the DV-1 npm-alias trio (spine-player-42 / spine-webgl-42 /
 * spine-core-42) nesting the WHOLE 4.2.111 player→webgl→core graph off
 * canonical spine-core@4.3.0, plus `AnimationPlayerModalRouter` which branches
 * SOLELY on the loader-resolved `summary.runtimeTag` (DV-1a explicit-identity —
 * no JSON sniff, no re-detection; locks feedback_explicit_identity_over_inference,
 * same bug-class as REG-47-01's cross-runtime handoff).
 *
 * This spec is the permanent guard on BOTH halves of that contract:
 *
 *   1. Resolution / distinctness arm (real modules, no mock): `spine-player-42`
 *      resolves a spine-core whose `version === '4.2.111'` AND that lacks the
 *      4.3-only `Slider`/`BonePose` exports, while the canonical
 *      `@esotericsoftware/spine-player` resolves spine-core `4.3.0`. The
 *      alias split-brain is REAL and DISTINCT — if a future `npm ci`/hoist
 *      ever collapses it (GA-3), this fails loudly in `npm test` before any
 *      release. Analog: tests/runtime/runtime-distinctness.spec.ts
 *      (createRequire of the resolved package.json — a non-forgeable artifact).
 *
 *   2. Dispatcher-branch arm (vi.mock BOTH modal siblings): rendering
 *      `AnimationPlayerModalRouter` with `summary.runtimeTag:'4.2'` constructs
 *      the `AnimationPlayerModal42` mock (NOT the migrated one); `'4.3'`
 *      constructs the migrated `AnimationPlayerModal` mock — i.e. the branch
 *      is keyed ON THE TAG, never a JSON/`.spine` sniff. Asserts WHICH mock
 *      constructed (CLAUDE.md Fact #5 — never a GL render).
 *
 * Headless: jsdom env (the dispatcher arm needs React/DOM; the resolution arm
 * uses `node:module` `createRequire` which resolves identically under jsdom —
 * empirically confirmed). React is constructed via `React.createElement` (no
 * JSX) so this stays a `.spec.ts` file per the fixed artifact path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { cleanup, render } from '@testing-library/react';
import * as React from 'react';
import type { SkeletonSummary } from '../../src/shared/types';

const require = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher-branch arm setup — vi.mock BOTH modal siblings.
//
// vi.mock resolves the specifier from THIS test file's location to an absolute
// module id; that is the SAME absolute module `AnimationPlayerModalRouter`
// imports via its relative `./AnimationPlayerModal` / `./AnimationPlayerModal42`
// specifiers. Mocking here therefore intercepts the router's own imports.
// Each mock renders a sentinel element + records its construction in a
// globalThis sink (vi.mock factories are hoisted above imports and cannot
// close over module-scope state — the runtime-distinctness/T-D idiom).
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../src/renderer/src/modals/AnimationPlayerModal', () => ({
  AnimationPlayerModal: (props: unknown) => {
    (globalThis as Record<string, unknown>).__routerConstructed =
      ((globalThis as Record<string, unknown>).__routerConstructed as string[] | undefined) ?? [];
    (
      (globalThis as Record<string, unknown>).__routerConstructed as string[]
    ).push('AnimationPlayerModal');
    void props;
    return React.createElement('div', { 'data-testid': 'modal-43' });
  },
}));

vi.mock('../../src/renderer/src/modals/AnimationPlayerModal42', () => ({
  AnimationPlayerModal42: (props: unknown) => {
    (globalThis as Record<string, unknown>).__routerConstructed =
      ((globalThis as Record<string, unknown>).__routerConstructed as string[] | undefined) ?? [];
    (
      (globalThis as Record<string, unknown>).__routerConstructed as string[]
    ).push('AnimationPlayerModal42');
    void props;
    return React.createElement('div', { 'data-testid': 'modal-42' });
  },
}));

// Imported AFTER the vi.mock calls (vitest hoists the mocks above all imports
// regardless, so the router resolves to the mocked siblings).
import { AnimationPlayerModalRouter } from '../../src/renderer/src/modals/AnimationPlayerModalRouter';

function readConstructed(): string[] {
  return ((globalThis as Record<string, unknown>).__routerConstructed as string[] | undefined) ?? [];
}

/** Minimal SkeletonSummary carrier — only `runtimeTag` is load-bearing for the
 *  routing decision; the rest is structurally-valid filler the router never
 *  reads (it MUST NOT inspect anything but `summary.runtimeTag`). */
function makeSummary(runtimeTag: '4.2' | '4.3'): SkeletonSummary {
  return {
    runtimeTag,
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    peaks: [],
    regions: [],
    elapsedMs: 0,
  } as unknown as SkeletonSummary;
}

afterEach(() => {
  cleanup();
  (globalThis as Record<string, unknown>).__routerConstructed = [];
});

describe('Phase 47 T-B (resolution arm): the DV-1 alias split-brain is real and distinct (DV-RISK-1 / GA-3 standing guard)', () => {
  // version is NOT a module export — read it from the RESOLVED package.json of
  // each install (a non-forgeable artifact, robust to a botched lockfile that
  // would silently collapse the alias onto 4.3.0). Same idiom as
  // tests/runtime/runtime-distinctness.spec.ts.
  it("spine-player-42's transitive spine-core resolves to 4.2.111; canonical spine-player resolves spine-core 4.3.0", () => {
    const sp42Entry = require.resolve('spine-player-42');
    const spCanonEntry = require.resolve('@esotericsoftware/spine-player');

    const coreVia42 = (
      createRequire(sp42Entry)('@esotericsoftware/spine-core/package.json') as { version: string }
    ).version;
    const coreViaCanon = (
      createRequire(spCanonEntry)('@esotericsoftware/spine-core/package.json') as { version: string }
    ).version;

    expect(
      coreVia42,
      'spine-player-42 (npm:@esotericsoftware/spine-player@4.2.111) MUST nest ' +
        'spine-core@4.2.111 — a 4.3.0 here means a bad hoist collapsed the ' +
        'alias split-brain (DV-RISK-1 regression — GA-3)',
    ).toBe('4.2.111');
    expect(
      coreViaCanon,
      'canonical @esotericsoftware/spine-player MUST reach spine-core@4.3.0 ' +
        '(the 4.3 leg — 47-01 6b3c57e)',
    ).toBe('4.3.0');
    expect(coreVia42).not.toBe(coreViaCanon);
  });

  it("spine-player-42's bare core lacks the 4.3-only Slider/BonePose exports; canonical's has them", () => {
    const sp42 = require('spine-player-42') as Record<string, unknown>;
    const spCanon = require('@esotericsoftware/spine-player') as Record<string, unknown>;

    // 4.2.111 predates the 4.3 Pose-architecture rewrite — Slider/BonePose
    // are 4.3-only. Their ABSENCE from the aliased surface is the strongest
    // version-distinctness proof (mirrors runtime-distinctness.spec.ts).
    expect(
      sp42.Slider,
      'spine-player-42 reaches 4.2.111 core — `Slider` (4.3-only) must be absent',
    ).toBeUndefined();
    expect(
      sp42.BonePose,
      'spine-player-42 reaches 4.2.111 core — `BonePose` (4.3-only) must be absent',
    ).toBeUndefined();
    expect(
      typeof spCanon.Slider,
      'canonical spine-player reaches 4.3.0 core — `Slider` must be exported',
    ).not.toBe('undefined');
    expect(
      typeof spCanon.BonePose,
      'canonical spine-player reaches 4.3.0 core — `BonePose` must be exported',
    ).not.toBe('undefined');
  });
});

describe('Phase 47 T-B (dispatcher arm): AnimationPlayerModalRouter branches off summary.runtimeTag — never a re-detection', () => {
  it("runtimeTag:'4.2' constructs AnimationPlayerModal42 (the frozen v1.5.1 leg) and NOT the migrated modal", () => {
    render(
      React.createElement(AnimationPlayerModalRouter, {
        open: true,
        summary: makeSummary('4.2'),
        loaderMode: 'auto' as const,
        onClose: vi.fn(),
      }),
    );
    const constructed = readConstructed();
    expect(constructed, "runtimeTag:'4.2' must select the frozen 4.2-leg modal").toContain(
      'AnimationPlayerModal42',
    );
    expect(
      constructed,
      "runtimeTag:'4.2' must NOT construct the migrated 4.3 modal",
    ).not.toContain('AnimationPlayerModal');
  });

  it("runtimeTag:'4.3' constructs the migrated AnimationPlayerModal and NOT the frozen 4.2-leg modal", () => {
    render(
      React.createElement(AnimationPlayerModalRouter, {
        open: true,
        summary: makeSummary('4.3'),
        loaderMode: 'auto' as const,
        onClose: vi.fn(),
      }),
    );
    const constructed = readConstructed();
    expect(constructed, "runtimeTag:'4.3' must select the migrated 4.3 modal").toContain(
      'AnimationPlayerModal',
    );
    expect(
      constructed,
      "runtimeTag:'4.3' must NOT construct the frozen 4.2-leg modal",
    ).not.toContain('AnimationPlayerModal42');
  });

  it('the router source is explicit-identity only — no JSON/.spine/resolveRuntime re-detection token (DV-1a)', async () => {
    // Mirrors the 47-03 acceptance: the routing must consume ONLY the
    // already-resolved core tag — never independently sniff the version.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const routerSrc = readFileSync(
      resolve(__dirname, '..', '..', 'src/renderer/src/modals/AnimationPlayerModalRouter.tsx'),
      'utf8',
    );
    // Strip block + line comments so doc-prose mentioning these tokens (the
    // router's own header explains what it must NOT do) does not false-fail.
    const code = routerSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code, 'router code must not parse JSON').not.toMatch(/JSON\.parse/);
    expect(code, 'router code must not sniff skeleton.spine').not.toMatch(/\.spine\b/);
    expect(code, 'router code must not re-detect via resolveRuntime').not.toMatch(
      /resolveRuntime/,
    );
    // Positive: it DOES branch on the explicit tag.
    expect(code, 'router branches on summary.runtimeTag').toMatch(/runtimeTag/);
  });
});
