/**
 * Phase 12 Plan 04 — F2 regression test (Phase 11 spillover Windows file-picker
 * UX bug at AppShell.tsx pickOutputDir).
 *
 * Locks the fix in place: the `defaultPath` argument passed to
 * `window.api.pickOutputDirectory(...)` must NOT contain the literal
 * `/images-optimized` suffix that made the native Windows folder picker
 * behave as save-as ("create new file 'images-optimized'?" dialog reported
 * in 11-WIN-FINDINGS.md §F2).
 *
 * Test surface is intentionally split:
 *   - Three pure derivation tests mirror AppShell.tsx:441's regex (the helper
 *     is inlined here so the test exercises the SAME shape of computation
 *     the component uses; we don't import from AppShell because the
 *     derivation is not exported and extracting it for testing would be
 *     more invasive than the bug fix itself).
 *   - One source-grep regression test reads AppShell.tsx as a string and
 *     asserts the buggy concatenation pattern is absent — belt-and-braces
 *     defense against a future refactor reintroducing the bug pattern.
 *
 * RED until Task 1 GREEN edits AppShell.tsx to drop the
 * `'/images-optimized'` suffix.
 */
import { describe, test, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Mirrors the regex at src/renderer/src/components/AppShell.tsx:441:
 *   summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.'
 *
 * Strips the trailing path segment (the JSON filename + its leading
 * separator), platform-agnostic across `/` and `\`. Falls back to `'.'`
 * when the result is empty (Phase 6 REVIEW L-01 — filesystem-root edge
 * case).
 */
function deriveSkeletonDir(skeletonPath: string): string {
  return skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
}

describe('F2 regression: AppShell pickOutputDir defaultPath does not glue images-optimized', () => {
  test('POSIX path: defaultPath is parent dir, no images suffix', () => {
    const skeletonDir = deriveSkeletonDir('/Users/leo/project/skel.json');
    expect(skeletonDir).toBe('/Users/leo/project');
    expect(skeletonDir).not.toContain('images');
  });

  test('Windows path: defaultPath is parent dir, no images suffix', () => {
    const skeletonDir = deriveSkeletonDir('C:\\Users\\Tester\\stm\\skel.json');
    expect(skeletonDir).toBe('C:\\Users\\Tester\\stm');
    expect(skeletonDir).not.toContain('images');
  });

  test('Filesystem-root edge case: returns "." fallback', () => {
    const skeletonDir = deriveSkeletonDir('/skel.json');
    expect(skeletonDir).toBe('.');
  });

  test('AppShell.tsx source: pickOutputDir does NOT concat images-optimized', async () => {
    // Source-grep regression test. Locks the buggy pattern out of the
    // codebase so a future refactor cannot quietly reintroduce it.
    const srcPath = resolve(
      __dirname,
      '..',
      '..',
      'src',
      'renderer',
      'src',
      'components',
      'AppShell.tsx',
    );
    const src = await readFile(srcPath, 'utf8');
    // Strip comments before scanning so the post-fix doc comment that
    // describes the old bug doesn't false-trigger the source-grep. We
    // strip BOTH leading-`//` line comments AND `/* … */` block comments
    // (a coarse strip is fine for our literal-string concern; we are
    // not parsing TypeScript).
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc)
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '')) // trailing line comments
      .join('\n');
    // The bug pattern was: skeletonDir + '/images-optimized'
    expect(codeOnly).not.toMatch(/skeletonDir\s*\+\s*['"]\/images-optimized['"]/);
    expect(codeOnly).not.toMatch(/['"]\/images-optimized['"]/);
  });
});
