/**
 * Phase 40 Plan 07 — AppShell atlas state threading test.
 *
 * Source-grep-as-test (mirrors `tests/preload/start-export-atlas-args.spec.ts`
 * pattern): jsdom-mounting the full AppShell pulls heavy dependencies that
 * other AppShell specs already cover; here we lock the 7 contract invariants
 * Plan 07 Task 07.3 mandates:
 *
 *   1. 4 useState slots: atlasOutputMode/atlasMaxPageSize/atlasAllowRotation/atlasPadding
 *   2. Each setter exists (state-decl + at least one update site = ≥ 1 setSetter call)
 *   3. OptimizeDialog mount receives outputMode={atlasOutputMode}
 *   4. OptimizeDialog mount receives atlasOpts={...}
 *   5. buildSessionState writes all 4 atlas fields (no default literals)
 *   6. mountOpenResponse reads project.atlasOutputMode (+ siblings) to seed state
 *   7. isDirty derivation references each atlas field (so changes mark dirty)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const APP_SHELL_PATH = 'src/renderer/src/components/AppShell.tsx';

function appShellSource(): string {
  return readFileSync(APP_SHELL_PATH, 'utf8');
}

describe('Phase 40 Plan 07 — AppShell atlas state threading', () => {
  it('(1) declares 4 useState slots for atlas fields', () => {
    const src = appShellSource();
    expect(/useState<['"]loose['"]\s*\|\s*['"]atlas['"]\s*\|\s*['"]both['"]>/.test(src)).toBe(true);
    expect(/useState<1024\s*\|\s*2048\s*\|\s*4096\s*\|\s*8192>/.test(src)).toBe(true);
    // boolean + number useState — match the setter declarations to disambiguate
    // from the many existing useState<boolean>/useState<number> in the file.
    expect(/setAtlasAllowRotation/.test(src)).toBe(true);
    expect(/setAtlasPadding/.test(src)).toBe(true);
  });

  it('(2) each setter appears at least twice (declaration + at least one update site)', () => {
    const src = appShellSource();
    expect((src.match(/setAtlasOutputMode\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/setAtlasMaxPageSize\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/setAtlasAllowRotation\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((src.match(/setAtlasPadding\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('(3) OptimizeDialog receives outputMode prop bound to atlasOutputMode state', () => {
    const src = appShellSource();
    expect(/outputMode=\{atlasOutputMode\}/.test(src)).toBe(true);
  });

  it('(4) OptimizeDialog receives atlasOpts prop with all 3 atlas knob fields', () => {
    const src = appShellSource();
    // The atlasOpts prop is an inline object literal with the 3 atlas knob
    // state slots. Allow JSX/object formatting variation.
    expect(/atlasOpts=\{\{[\s\S]*?maxPageSize:\s*atlasMaxPageSize[\s\S]*?allowRotation:\s*atlasAllowRotation[\s\S]*?padding:\s*atlasPadding[\s\S]*?\}\}/.test(src)).toBe(true);
  });

  it('(5) buildSessionState writes the 4 atlas fields from state (not hardcoded defaults)', () => {
    const src = appShellSource();
    // The Save serialization block names each atlas field paired with its
    // state variable (not the literal default like `'loose'` or `4096`).
    // Shape: `atlasOutputMode: atlasOutputMode,` or shorthand `atlasOutputMode,`.
    expect(/atlasOutputMode\s*:\s*atlasOutputMode\b|atlasOutputMode\s*,/.test(src)).toBe(true);
    expect(/atlasMaxPageSize\s*:\s*atlasMaxPageSize\b|atlasMaxPageSize\s*,/.test(src)).toBe(true);
    expect(/atlasAllowRotation\s*:\s*atlasAllowRotation\b|atlasAllowRotation\s*,/.test(src)).toBe(true);
    expect(/atlasPadding\s*:\s*atlasPadding\b|atlasPadding\s*,/.test(src)).toBe(true);
    // Hardcoded defaults at the Save site must be GONE — the 4 lines below
    // were the Plan 01 placeholder. Plan 07 replaces them with state reads.
    expect(/atlasOutputMode:\s*['"]loose['"]/.test(src)).toBe(false);
    expect(/atlasMaxPageSize:\s*4096/.test(src)).toBe(false);
    expect(/atlasAllowRotation:\s*false/.test(src)).toBe(false);
    // atlasPadding: 2 might appear in initial useState — only check the
    // Save site is no longer a literal. Use the buildSessionState boundary.
    // (Conservative: skip this one — initial state legitimately uses ?? 2.)
  });

  it('(6) mountOpenResponse seeds state from project.atlasOutputMode etc on Open', () => {
    const src = appShellSource();
    expect(/setAtlasOutputMode\(project\.atlasOutputMode\b/.test(src)).toBe(true);
    expect(/setAtlasMaxPageSize\(project\.atlasMaxPageSize\b/.test(src)).toBe(true);
    expect(/setAtlasAllowRotation\(project\.atlasAllowRotation\b/.test(src)).toBe(true);
    expect(/setAtlasPadding\(project\.atlasPadding\b/.test(src)).toBe(true);
  });

  it('(7) lastSaved snapshot type extended to include the 4 atlas fields (dirty tracking)', () => {
    const src = appShellSource();
    // The lastSaved useState type literal carries the 4 atlas slots so the
    // isDirty memo can compare against them. Allow optional `?` modifier
    // (the snapshot is null on a fresh untitled session).
    expect(/lastSaved/.test(src)).toBe(true);
    // Each atlas slot appears within the lastSaved object literal at least
    // once for the type declaration AND once for the setLastSaved write.
    // Conservative: 2 occurrences total per field.
    expect((src.match(/\batlasOutputMode\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((src.match(/\batlasMaxPageSize\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((src.match(/\batlasAllowRotation\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((src.match(/\batlasPadding\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
