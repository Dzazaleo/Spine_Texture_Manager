// tests/integration/cli-esm-resolver.spec.ts — Phase 43 (43-07) GAP-43-CLI-SEAM
// regression guard.
//
// WHY THIS EXISTS: the Phase 43 `pickRuntime` env-split has THREE runtimes —
// (1) vitest (globalThis resolver via setupFiles), (2) the built electron-vite
// CJS worker (ambient `require('../runtime-4x.cjs')`), and (3) Node-from-source
// via `tsx scripts/cli.ts` (`npm run cli`). 43-05/43-06 verification exercised
// only (1) and (2); runtime (3) fell through to pickRuntime's loud-throw arm so
// EVERY `npm run cli` errored `no ESM adapter resolver is registered and
// ambient require is unavailable` (GAP-43-CLI-SEAM). A unit test that just
// called loadSkeleton would take the vitest arm (1) and NEVER reproduce this —
// so, exactly like the GAP-43-PROD-SEAM spawn-smoke spawns the BUILT worker,
// this guard SPAWNS THE REAL CLI as a child process and asserts the specific
// negative (no resolver loud-throw) + the positive (a real peak table).
//
// RED before 43-07 (CLI child errors with the resolver message), GREEN after
// (`scripts/register-esm-adapter-resolver.ts` binds arm 1 for the CLI runtime).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..');
const FIXTURE = 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json';

describe('CLI runtime — GAP-43-CLI-SEAM resolver falsifier', () => {
  it(
    'npm run cli (tsx ESM-from-source) resolves the adapter and prints a peak table — never the pickRuntime loud-throw',
    () => {
      let stdout = '';
      let threw: Error | null = null;
      try {
        stdout = execFileSync('npx', ['tsx', 'scripts/cli.ts', FIXTURE], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          timeout: 90_000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (e) {
        // execFileSync throws on non-zero exit; capture stdout+stderr so the
        // assertion message is actionable rather than a bare "command failed".
        const err = e as Error & { stdout?: Buffer | string; stderr?: Buffer | string };
        threw = err;
        stdout =
          (err.stdout ? String(err.stdout) : '') +
          (err.stderr ? String(err.stderr) : '');
      }

      // GAP-43-CLI-SEAM-SPECIFIC NEGATIVE FALSIFIER: the orphaned-runtime
      // failure surfaces verbatim as this pickRuntime loud-throw message.
      // Assert it appears NOWHERE in the CLI output. RED pre-43-07.
      expect(
        /no ESM adapter resolver is registered/.test(stdout),
        `GAP-43-CLI-SEAM REGRESSION: \`npm run cli\` hit pickRuntime's ` +
          `loud-throw arm — the CLI/Node (tsx ESM) runtime has no adapter ` +
          `resolver. scripts/cli.ts must side-effect-import ` +
          `scripts/register-esm-adapter-resolver.ts before loadSkeleton.\n` +
          `--- CLI output ---\n${stdout}`,
      ).toBe(false);

      expect(threw, `CLI exited non-zero:\n${stdout}`).toBeNull();

      // Positive: a real peak table (header + the locked column labels + the
      // sampler summary line). Proves the resolver returned the REAL adapter,
      // not a stub.
      expect(stdout).toContain('Attachment');
      expect(stdout).toContain('Peak W×H');
      expect(stdout).toMatch(/Sampled in [\d.]+ ms at \d+ Hz/);
    },
    120_000,
  );
});
