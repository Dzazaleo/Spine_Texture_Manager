#!/usr/bin/env node
/**
 * Phase 22.1 G-02 / G-01 D-02 human-verify fixture helper.
 *
 * Usage: `npm run fixture:atlas-source-drift`
 *
 * Copies fixtures/SIMPLE_PROJECT/ to a tmp directory and mutates the SQUARE
 * region's `bounds:` line in SIMPLE_TEST.atlas so the on-disk atlas declares
 * smaller dims than the canonical JSON region. This triggers the dims-mismatch
 * badge in atlas-source mode for human-UAT of the new tooltip primitive.
 *
 * SIMPLE_TEST.atlas format (spine-core 4.2 TextureAtlas, no-pack-section):
 *   SIMPLE_TEST.png
 *   size:1839,1464
 *   filter:Linear,Linear
 *   CIRCLE
 *   bounds:1004,2,699,699
 *   SQUARE
 *   bounds:2,462,1000,1000    ← this line's w,h are the on-disk region dims
 *   TRIANGLE
 *   bounds:1004,703,833,759
 *
 * Mutation: SQUARE bounds w,h → 670,670 (simulates a TexturePacker scale<1
 * export where the atlas is a downscaled copy of the canonical source).
 *
 * REVISION 1 (Warning 4 fix): introduced so the user (git/CLI-beginner per
 * memory `user_git_experience.md`) can run one command instead of manually
 * editing binary bytes. Printed path can be drag-dropped into the dev app.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(REPO_ROOT, 'fixtures/SIMPLE_PROJECT');
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const DEST = path.join(os.tmpdir(), 'spine-tm-fixtures', `atlas-source-drift-${TS}`);

// Region to mutate — SQUARE is ideal (1000×1000 canonical; pre-scaled in
// the rig so the drift is obvious in both panels).
const REGION_TO_MUTATE = 'SQUARE';
// Mutated dims: 670×670 (≈67% of canonical 1000×1000) simulates a
// TexturePacker "Resolution: 0.67×" export.
const MUTATED_W = 670;
const MUTATED_H = 670;

// 1. Copy the entire fixture directory recursively.
fs.mkdirSync(DEST, { recursive: true });
for (const entry of fs.readdirSync(SOURCE)) {
  const src = path.join(SOURCE, entry);
  const dst = path.join(DEST, entry);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, dst);
  }
}

// 2. Mutate SIMPLE_TEST.atlas — find the REGION_TO_MUTATE header line and
//    rewrite the following `bounds:x,y,w,h` line to use the mutated dims.
//    The spine-core 4.2 no-pack-section format uses `bounds:x,y,w,h` where
//    w and h are the on-disk pixel dimensions of the packed region.
const atlasPath = path.join(DEST, 'SIMPLE_TEST.atlas');
const atlasText = fs.readFileSync(atlasPath, 'utf8');
const lines = atlasText.split('\n');
let foundRegion = false;
let mutated = false;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  // Region header: a bare line matching the region name exactly.
  if (trimmed === REGION_TO_MUTATE) {
    foundRegion = true;
    continue;
  }
  // Once we found the region, look for the bounds: line immediately after.
  if (foundRegion && trimmed.startsWith('bounds:')) {
    // Parse existing bounds to preserve x, y coords; replace w, h only.
    // Format: bounds:x,y,w,h  (no spaces in the actual file)
    const rest = trimmed.slice('bounds:'.length);
    const parts = rest.split(',');
    if (parts.length >= 4) {
      const [x, y] = parts;
      lines[i] = `bounds:${x},${y},${MUTATED_W},${MUTATED_H}`;
    } else {
      // Fallback: replace the entire line.
      lines[i] = `bounds:2,462,${MUTATED_W},${MUTATED_H}`;
    }
    mutated = true;
    break;
  }
  // If we hit another region header (non-empty, non-key line) without finding
  // the bounds line, the region was not found in the expected format.
  if (foundRegion && trimmed && !trimmed.includes(':') && trimmed !== REGION_TO_MUTATE) {
    break;
  }
}

if (!mutated) {
  console.error(
    `ERROR: did not find a 'bounds:' line for region '${REGION_TO_MUTATE}' in ${atlasPath}`,
  );
  process.exit(1);
}
fs.writeFileSync(atlasPath, lines.join('\n'), 'utf8');

// 3. Print the absolute path so the user can copy + drag-drop into the dev app.
console.log(DEST);
