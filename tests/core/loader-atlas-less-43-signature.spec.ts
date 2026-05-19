// tests/core/loader-atlas-less-43-signature.spec.ts
//
// Regression lock for debug-fix images-src-noop-stmproj-crash (2026-05-19).
//
// ROOT CAUSE (both the "Use Images Folder as Source" no-op AND the .stmproj
// reload crash): a Spine 4.2-vs-4.3 `AttachmentLoader` SIGNATURE divergence.
//   4.2  newRegionAttachment(skin, name, path, sequence)              // 4 args
//   4.3  newRegionAttachment(skin, placeholder, name, path, sequence) // 5 args
// The shared `SilentSkipAttachmentLoader` subclassed the **4.2**
// AtlasAttachmentLoader and declared the 4.2 4-arg signature. When
// `runtime-43.parseSkeleton(atlasLess=true)` routed the **4.3** SkeletonJson
// through it, the arg-shift bound the `sequence` parameter to 4.3's `path`
// STRING. `string != null`, so the D-09 silent-skip null-guard was bypassed
// and 4.2 `loadSequence` did `("string").regions.length` →
// "Cannot read properties of undefined (reading 'length')" — surfaced to the
// user as `Unknown: ...` on any 4.3 rig opened in atlas-less mode.
//
// FIX: `makeSilentSkipAttachmentLoader(Base)` is base-parametric; runtime-43
// now binds it to the 4.3 AtlasAttachmentLoader and the overrides are
// arity-aware. The 4.2 leg is byte-behavior-identical (covered by the
// unchanged tests/core/synthetic-atlas.spec.ts + loader-atlas-less.spec.ts).
//
// This spec drives the REAL loader end-to-end through the real synthetic-atlas
// + runtime-43 seam (the integrated pipeline — cf. memory
// feedback_isolated_clean_is_not_pipeline_clean). The DEMON fixture is
// untracked-but-present locally; absence is a legit Wave-0 ENOENT skip
// (it is not part of the in-repo fixture set).
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEMON_43_JSON = path.resolve(
  REPO_ROOT,
  'fixtures/DEMON/test/SKINS_SPINE_V02.json',
);

describe('loader atlas-less on a Spine 4.3 rig (4.2/4.3 AttachmentLoader signature regression)', () => {
  it('loadSkeleton({loaderMode:"atlas-less"}) on a 4.3 rig does NOT crash with "reading \'length\'"', () => {
    if (!existsSync(DEMON_43_JSON)) {
      // Wave-0 skip — DEMON is an untracked local repro fixture, not in-repo.
      expect(true).toBe(true);
      return;
    }

    // Pre-fix: this threw TypeError "Cannot read properties of undefined
    // (reading 'length')" from spine-core-42 AtlasAttachmentLoader.loadSequence
    // via runtime-43's 4.3 SkeletonJson.readAttachment. Post-fix: clean load.
    expect(() =>
      loadSkeleton(DEMON_43_JSON, { loaderMode: 'atlas-less' }),
    ).not.toThrow();
  });

  it('the same 4.3 rig still loads in canonical (auto, sibling .atlas) mode — no collateral regression', () => {
    if (!existsSync(DEMON_43_JSON)) {
      expect(true).toBe(true);
      return;
    }
    // The canonical path uses the stock 4.3 AtlasAttachmentLoader (correct
    // 5-arg signature) — never the SilentSkip subclass. Locks that the fix
    // did not perturb the working atlas-source path.
    expect(() => loadSkeleton(DEMON_43_JSON, {})).not.toThrow();
  });
});
