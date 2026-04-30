// @vitest-environment node
/**
 * Phase 16 D-07 — regression gate for the windows-fallback → manual-download rename.
 *
 * Recursively scans src/ for the substring `windows-fallback` (in any quoting,
 * any context — type literal, string literal, comment, JSDoc). Fails the build
 * if any match is found.
 *
 * Why this gate matters:
 *   - Phase 16 mass-renames `'windows-fallback'` → `'manual-download'` across
 *     8+ source files (CONTEXT.md D-05). Future work (e.g. another phase that
 *     touches the auto-update surface) might inadvertently re-introduce the
 *     old literal — either by copy-pasting from .planning/ archived plans
 *     (where the old token is preserved as historical record) or by
 *     resurrecting an old branch.
 *   - The rename is locked in CONTEXT.md as "no transition period". This gate
 *     enforces the "no transition" rule against the entire src/ tree.
 *
 * Scope:
 *   - SCANS: every file under src/ recursively, including .ts / .tsx / .js /
 *     .jsx / .json / .md (we don't expect markdown but include for defense-in-
 *     depth).
 *   - EXCLUDES: dist/, build/, node_modules/, coverage/, .planning/ (the
 *     archived plans intentionally preserve the historical token), tests/
 *     (this gate is about src/, not test fixtures), out/, .vite/.
 *
 * Pattern lineage:
 *   - tests/arch.spec.ts (Layer 3 invariant) — same recursive-readdir +
 *     readFileSync + regex check shape. This file extends the precedent.
 *
 * Phase 16 D-07 — planner discretion: regression-gate test added.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC_ROOT = resolve(REPO_ROOT, 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (st.isFile()) {
      out.push(full);
    }
  }
  return out;
}

describe('Phase 16 D-07 — windows-fallback literal regression gate', () => {
  it('(16-r1) no file under src/ contains the literal token "windows-fallback"', () => {
    const files = walk(SRC_ROOT);
    const offenders: { file: string; lineNumbers: number[] }[] = [];

    for (const f of files) {
      let content: string;
      try {
        content = readFileSync(f, 'utf-8');
      } catch {
        continue; // binary or unreadable — skip
      }
      if (!content.includes('windows-fallback')) continue;
      const lines = content.split('\n');
      const matchedLines: number[] = [];
      lines.forEach((line, i) => {
        if (line.includes('windows-fallback')) {
          matchedLines.push(i + 1);
        }
      });
      offenders.push({
        file: f.replace(REPO_ROOT + '/', ''),
        lineNumbers: matchedLines,
      });
    }

    // Helpful diagnostic on failure: list each offending file + line.
    if (offenders.length > 0) {
      const summary = offenders
        .map((o) => `  ${o.file}: lines ${o.lineNumbers.join(', ')}`)
        .join('\n');
      throw new Error(
        `Phase 16 D-07 regression gate failed: ${offenders.length} file(s) under src/ ` +
          `still contain the literal token "windows-fallback":\n${summary}\n\n` +
          `The Phase 16 rename is "mass rename, no transition period". Replace each ` +
          `occurrence with "manual-download" (or update the gate exclusion list if ` +
          `the literal appears in archival comment context — though this is not ` +
          `expected for src/).`,
      );
    }

    expect(offenders).toEqual([]);
  });

  it('(16-r2) no file under src/ exports a type alias mentioning windows-fallback', () => {
    // Tighter pattern: catches `'windows-fallback'` typed-literal form even
    // when surrounded by other tokens (e.g. `'auto-update' | 'windows-fallback'`).
    // Subset of (16-r1) — the substring scan above already catches this; this
    // spec is the focused, explicit assertion that survives even if (16-r1)
    // is later relaxed for a comment-only carve-out.
    const files = walk(SRC_ROOT);
    for (const f of files) {
      let content: string;
      try {
        content = readFileSync(f, 'utf-8');
      } catch {
        continue;
      }
      expect(
        content,
        `Phase 16 D-07: ${f.replace(REPO_ROOT + '/', '')} contains the typed literal "'windows-fallback'"`,
      ).not.toContain(`'windows-fallback'`);
    }
  });
});
