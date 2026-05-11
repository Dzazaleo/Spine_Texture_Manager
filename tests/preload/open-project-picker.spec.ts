/**
 * Phase 34 Plan 01 Task 2 — Preload bridge contract test for the two-IPC-step
 * File → Open surface (D-06):
 *   1. `openProjectPicker` — no-arg picker; ipcRenderer.invoke('project:open-dialog').
 *   2. `loadSkeletonFromPath` — path-based skeleton load; ipcRenderer.invoke('skeleton:load', absolutePath).
 *
 * The old `openProject` method + `'project:open'` channel reference must be
 * physically deleted from the preload source (not commented out).
 *
 * Source-grep-as-test pattern (mirrors tests/preload/request-pending-update.spec.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PRELOAD_PATH = 'src/preload/index.ts';

function preloadSource(): string {
  return readFileSync(PRELOAD_PATH, 'utf8');
}

describe('Phase 34 D-06 — preload bridge: openProjectPicker + loadSkeletonFromPath', () => {
  it('`openProjectPicker` declared as a method on the api object exactly once', () => {
    const src = preloadSource();
    const matches = src.match(/openProjectPicker\s*:/g) ?? [];
    expect(matches.length, 'openProjectPicker: must appear exactly once').toBe(1);
  });

  it("`openProjectPicker` invokes 'project:open-dialog' with no args", () => {
    const src = preloadSource();
    expect(src).toMatch(
      /openProjectPicker:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*'project:open-dialog'\s*\)/,
    );
  });

  it('`loadSkeletonFromPath` declared as a method on the api object exactly once', () => {
    const src = preloadSource();
    const matches = src.match(/loadSkeletonFromPath\s*:/g) ?? [];
    expect(matches.length, 'loadSkeletonFromPath: must appear exactly once').toBe(1);
  });

  it("`loadSkeletonFromPath` invokes 'skeleton:load' with the absolutePath arg (pass-through)", () => {
    const src = preloadSource();
    expect(src).toMatch(
      /loadSkeletonFromPath:\s*\(absolutePath:\s*string\)\s*=>\s*\n?\s*ipcRenderer\.invoke\(\s*'skeleton:load',\s*absolutePath\s*\)/,
    );
  });

  it("old `openProject` method is physically removed", () => {
    const src = preloadSource();
    // Old line: `openProject: () => ipcRenderer.invoke('project:open'),`
    expect(src).not.toMatch(/openProject\s*:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(\s*'project:open'\s*\)/);
    // No standalone reference to the old channel name anywhere in preload either.
    expect(src).not.toMatch(/'project:open'(?!-)/);
  });

  it('neighboring `openProjectFromPath` method is unchanged (sanity check)', () => {
    const src = preloadSource();
    expect(src).toMatch(
      /openProjectFromPath:\s*\(absolutePath\)\s*=>\s*\n?\s*ipcRenderer\.invoke\(\s*'project:open-from-path',\s*absolutePath\s*\)/,
    );
  });
});
