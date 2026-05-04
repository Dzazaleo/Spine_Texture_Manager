/**
 * Phase 24 Plan 01 — Tests for src/core/usage.ts (PANEL-01, D-01, D-02, D-05).
 *
 * Replaces the old Phase 5 findUnusedAttachments tests with Phase 24
 * findOrphanedFiles tests. The new function is a pure set-difference with
 * zero fixture dependency — all test cases use inline arrays and Sets.
 *
 * Behavior gates:
 *   - (a) empty imagesFolderFiles → returns []
 *   - (b) all files in imagesFolderFiles are in inUseNames → returns []
 *   - (c) one file not in inUseNames → returns that one filename
 *   - (d) multiple files, mixed in-use and orphaned → returns only orphaned filenames
 *   - (e) inUseNames empty, imagesFolderFiles has items → returns all as orphaned
 *   - Module hygiene (N2.3): src/core/usage.ts has no node:fs / node:path / sharp imports
 *   - D-100 export surface: src/core/usage.ts exports findOrphanedFiles by name
 *   - CLAUDE.md #5 DOM-free: src/core/usage.ts has no document / window / HTMLElement refs
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { findOrphanedFiles } from '../../src/core/usage.js';

const USAGE_SRC = path.resolve('src/core/usage.ts');

describe('findOrphanedFiles — core behavior (PANEL-01, D-01, D-02)', () => {
  it('(a) empty imagesFolderFiles → returns []', () => {
    expect(findOrphanedFiles([], new Set(['CIRCLE', 'SQUARE']))).toEqual([]);
  });

  it('(b) all files in imagesFolderFiles are in inUseNames → returns []', () => {
    expect(findOrphanedFiles(['CIRCLE', 'SQUARE'], new Set(['CIRCLE', 'SQUARE']))).toEqual([]);
  });

  it('(c) one file not in inUseNames → returns it', () => {
    expect(findOrphanedFiles(['CIRCLE', 'GHOST'], new Set(['CIRCLE']))).toEqual(['GHOST']);
  });

  it('(d) multiple files, mixed → returns only orphaned', () => {
    expect(findOrphanedFiles(['A', 'B', 'C'], new Set(['B']))).toEqual(['A', 'C']);
  });

  it('(e) empty inUseNames → all files are orphaned', () => {
    expect(findOrphanedFiles(['X', 'Y'], new Set())).toEqual(['X', 'Y']);
  });
});

describe('usage — module hygiene (N2.3, D-100)', () => {
  it('N2.3: src/core/usage.ts has no node:fs / node:path / node:child_process / node:net / node:http / sharp imports', () => {
    const src = readFileSync(USAGE_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });

  it('D-100: src/core/usage.ts exports findOrphanedFiles by name', () => {
    const src = readFileSync(USAGE_SRC, 'utf8');
    expect(src).toMatch(/export\s+function\s+findOrphanedFiles/);
  });

  it('CLAUDE.md #5: src/core/usage.ts has no DOM references', () => {
    const src = readFileSync(USAGE_SRC, 'utf8');
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
});
