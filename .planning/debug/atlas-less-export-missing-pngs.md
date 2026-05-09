---
slug: atlas-less-export-missing-pngs
status: resolved
created: 2026-05-09
updated: 2026-05-09
trigger: |
  DATA_START
  the app is failing to export some images (screenshot1). Find out why.
  When i switch the source the optimized images folder (atlas-less mode), we can see the images
  not exported (the ones missing in screenshot 2). Also there's the issue of Unused files that,
  in atlas-less mode, are nothing more than the images belonging to a skin, other than default.

  The fixture in question is: /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/CHJ/CHJWC_SYMBOLS.json

  Do not assume the answers. Verify your hypothesis before coming up with a solution.
  DATA_END
---

# Debug Session: atlas-less-export-missing-pngs

## Symptoms

**Expected behavior:**
- In atlas-less mode, the loader should resolve region paths the same way spine-core's `SkeletonJson.readAttachment` does (`att.path ?? att.name ?? entryName`), so a non-default skin's `LABEL: { LABEL: { name: "GRAND" } }` registers region `GRAND` (the actual PNG on disk).
- "Unused files" should only list PNGs not referenced by any skin/attachment in the skeleton.

**Actual behavior:**
- Header reports `316 images | 343 regions` after switching to atlas-less.
- "27 attachments missing PNGs" alert lists `LABEL`, `NEW_SYMBOLS/onze`, `REVEAL/REVEAL_01..25`.
- "4 unused files (95 KB)" lists `GRAND, MAJOR, MINI, MINOR` — confirmed exactly reproducible.

**Reproduction (confirmed via `scripts/debug-atlas-less-missing.mjs`):**
```
$ node scripts/debug-atlas-less-missing.mjs fixtures/CHJ/images
Synthesizer enumerated 343 unique region paths
Present PNGs: 316 | Missing PNGs: 27   ← matches "316 images | 343 regions"
--- MISSING ---
LABEL, NEW_SYMBOLS/onze, REVEAL/REVEAL_01..25  ← exact match with user list

Files on disk: 320
Current orphans: 4
GRAND, MAJOR, MINI, MINOR  ← exact match with "4 unused files"

Corrected orphans (after fix): 0
```

## Hypotheses

H1: Export pipeline iterates only the default skin's attachments. **FALSIFIED** — the synthesizer DOES walk all skins (synthetic-atlas.ts:288: `for (const skin of root.skins ?? []) { ... }`).

H2: "Unused files" detector compares disk filenames against an attachment-name set built from a wrong axis. **CONFIRMED** — see Evidence E2.

H3: 27 missing + ~30-image header delta share a single root cause. **PARTIALLY CONFIRMED** — `LABEL` (1 of the 27) is caused by the same root cause as the 4 orphans. The other 26 missing entries (`REVEAL/*`, `onze`) are unrelated: those PNGs are genuinely absent from `<skeletonDir>/images/` (they exist only in atlas pages); atlas-less mode by design does not fall back to atlas pages.

H4: Sequence-attachment path bug. **FALSIFIED** — these aren't sequence attachments; the REVEAL_* entries are 25 separate region entries on each of 8 slots.

## Current Focus

```yaml
hypothesis: |
  Single root cause shared by Bug B in full and Bug A's "LABEL" entry only:
  three skin-attachment walk sites in src/core/ + src/main/ use the resolution
  rule `att.path ?? entryName`, but spine-core's SkeletonJson.js:365,368
  resolves with `att.path ?? att.name ?? entryName`. The middle `att.name`
  step is missed, so non-default-skin region renames (where the JSON sets
  `att.name` but not `att.path`) are mishandled.
test: |
  Compare regions enumerated by the current walk against regions enumerated
  by the corrected walk for the CHJ fixture's GRAND/MEGA/MINI/MINOR skins.
expecting: |
  Current walk registers entry-key "LABEL" (no PNG on disk) and treats
  GRAND/MAJOR/MINI/MINOR.png on disk as orphans. Corrected walk registers
  region "GRAND/MAJOR/MINI/MINOR" (PNGs exist) and produces 0 orphans.
next_action: present root cause + fix proposal to user
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-09
  source: fixtures/CHJ/CHJWC_SYMBOLS.json
  finding: |
    Skeleton has 6 skins: default, GRAND, MEGA, MINI, MINOR, NO_VALUE.
    Non-default skins (GRAND/MEGA/MINI/MINOR) each contain TWO entries with the shape:
      { LABEL: { LABEL: { name: "GRAND" or "MAJOR" or "MINI" or "MINOR", x, y, width, height } } }
    Note `att.path` is undefined; only `att.name` carries the rename.

- timestamp: 2026-05-09
  source: node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:365,368
  finding: |
    Spine 4.2 resolution rule is two-step:
      line 365: name = getValue(map, "name", name);   // override entry-key with map.name if present
      line 368: path = getValue(map, "path", name);   // path defaults to (now-overridden) name
    Net rule: resolvedPath = att.path ?? att.name ?? entryName.

- timestamp: 2026-05-09
  source: src/core/synthetic-atlas.ts:295
  finding: |
    walkSyntheticRegionPaths uses `const lookupPath = att.path ?? entryName;`
    Misses the `att.name` middle step. For the CHJ fixture this means the
    synthesizer registers region "LABEL" (no PNG) instead of "GRAND" (PNG
    exists at fixtures/CHJ/images/GRAND.png).

- timestamp: 2026-05-09
  source: src/core/loader.ts:235
  finding: |
    canonicalDimsByRegion walk uses the same wrong rule:
    `const basePath = att.path ?? entryName;`
    Same defect as synthetic-atlas.ts. Latent — not the direct cause of the
    visible symptoms but should be fixed in the same patch for consistency.

- timestamp: 2026-05-09
  source: src/main/summary.ts:441-463
  finding: |
    The orphan detector's inUseNames builder uses `attachmentName` (the JSON
    entry-key) directly:
      `inUseNames.add(attachmentName);`
    For non-default skin entries this adds "LABEL" instead of the actual
    region path "GRAND" / "MAJOR" / "MINI" / "MINOR". Result: the four
    images on disk are not matched against inUseNames and are flagged as
    orphans (Bug B).
    Default-skin path-prefixed entries (e.g. attachmentName="REVEAL_01",
    path="REVEAL/REVEAL_01") also break here — the disk file is "REVEAL/REVEAL_01"
    but inUseNames carries "REVEAL_01", so they DON'T match. They escape
    being flagged as orphans only because the source images/ folder has
    NO REVEAL/ subdir. If the user copies REVEAL_*.png into images/, those
    files will also be flagged as orphans on the next load.

- timestamp: 2026-05-09
  source: scripts/debug-atlas-less-missing.mjs (this session)
  finding: |
    Corrected walk using `att.path ?? att.name ?? entryName` for inUseNames
    eliminates ALL 4 reported orphans (GRAND/MAJOR/MINI/MINOR) on the CHJ
    fixture's source images/ folder. Verified empirically.

- timestamp: 2026-05-09
  source: fixtures/CHJ/CHJWC_SYMBOLS.atlas + fixtures/CHJ/test/images/
  finding: |
    The 26 OTHER missing entries (REVEAL/REVEAL_01..25 and NEW_SYMBOLS/onze):
    - These attachments have `att.path` set in the default skin, so the synthesizer
      enumerates them correctly.
    - The PNGs do not exist in source `fixtures/CHJ/images/`.
    - The PNGs DO exist in the sibling atlas (CHJWC_SYMBOLS.atlas / .png pages).
    - The PNGs DO exist in the post-Optimize-Assets folder fixtures/CHJ/test/images/
      (Optimize Assets extracted them from atlas pages while running in atlas-source
      mode).
    - This is therefore NOT a bug in the export pipeline. The user's atlas-less
      load against `<skeletonDir>/images/` correctly reports 26 PNGs as missing,
      because atlas-less mode does not fall back to atlas pages by design (locked
      memory: project_strict_loadermode_separation).

## Eliminated

- "Export pipeline drops attachments" — falsified. Optimize Assets in atlas-source
  mode did produce all 26 REVEAL/onze PNGs into test/images/ (extracted from atlas).
- "Sequence path off-by-one" — falsified. The 25 REVEAL entries are individual
  region attachments, not a sequence (`att.sequence` is absent).
- "Default-skin-only enumeration" — falsified. All three walk sites iterate
  every skin in `root.skins`. The bug is in the per-entry resolution rule, not
  in the skin-iteration loop.

## Resolution

```yaml
root_cause: |
  src/core/synthetic-atlas.ts:295, src/core/loader.ts:235, and
  src/main/summary.ts:441-463 each resolve a skin attachment to its region
  identifier using `att.path ?? entryName`, missing spine-core's middle step
  `att.name`. Per SkeletonJson.js:365,368 the canonical rule is
  `att.path ?? att.name ?? entryName`. When a non-default skin renames a
  region via `{ name: "X" }` (no `path` field), the codebase walks register
  the JSON entry-key instead of the actual region path. For the CHJ fixture
  this causes:
    (i) the synthesizer to attempt `images/LABEL.png` (absent) instead of
        `images/GRAND.png` (present) → spurious entry in skippedAttachments;
   (ii) the orphan detector's inUseNames to contain "LABEL" instead of
        "GRAND"/"MAJOR"/"MINI"/"MINOR" → those four PNGs flagged as unused.
  The orphan detector additionally has an independent latent bug: it uses
  the JSON entry-key for path-prefixed default-skin attachments too (e.g.
  inUseNames gets "REVEAL_01" but the on-disk basename is "REVEAL/REVEAL_01"),
  so any user who copies REVEAL_*.png into images/ would see them flagged
  as orphans. The fix for non-default-skin renames AND the latent
  default-skin path-prefix issue is the same: switch to the spine-core
  resolution rule everywhere.

  Bug A's remaining 26 entries (REVEAL/* + onze) are NOT a defect — those
  PNGs are genuinely missing from <skeletonDir>/images/ in the user's
  source folder, and atlas-less mode by design does not fall back to the
  atlas (per locked memory project_strict_loadermode_separation). The user's
  workflow likely involved running Optimize Assets in atlas-source mode
  (which produced fixtures/CHJ/test/images/ with all 26 PNGs via atlas-
  extract) and then expecting the source-toggle to re-load from that new
  folder; the toggle only flips loaderMode, it does not re-point imagesDir.
  This is a separate UX concern, not a defect in the loader.

fix: |
  Three-site change — replace `att.path ?? entryName` with `att.path ?? att.name ?? entryName`:
    1. src/core/synthetic-atlas.ts:295 (walkSyntheticRegionPaths)
    2. src/core/loader.ts:235 (canonicalDimsByRegion walk)
    3. src/main/summary.ts:441-463 (inUseNames builder; both the
       sequence branch and the non-sequence branch)
  Plus tests:
    - synthetic-atlas: a fixture exercising a skin attachment with `name`
      but no `path` should produce the correctly-named region in atlasText
      and in pngPathsByRegionName/dimsByRegionName.
    - summary.ts orphan detector: same fixture should produce 0 orphans
      when the renamed region's PNG exists on disk.

verification: |
  Applied the three-site fix 2026-05-09. Added 3 regression tests:
    - tests/core/synthetic-atlas.spec.ts — non-default-skin rename via
      `{ name: "X" }` resolves to region "X", not the entry-key.
    - tests/core/summary.spec.ts (2 tests) — orphan-detector treats
      (a) non-default-skin-renamed PNG and (b) default-skin path-prefixed
      PNG as in-use; not flagged orphan.
  Full suite: 972 passed (was 969 pre-fix; +3 new). tsc --noEmit clean.

  End-to-end verification on the CHJ fixture (run via tsx):
    - load.sourceDims.has('GRAND'/'MAJOR'/'MINI'/'MINOR') → all true
    - summary.orphanedFiles.length → 0 (was 4)
    - summary.skippedAttachments.length → 26 (was 27 — `LABEL` dropped out;
      remaining 26 are REVEAL/* + onze, genuinely absent from source images/
      and correctly reported per atlas-less strict-mode-separation invariant)

files_changed:
  - src/core/synthetic-atlas.ts
  - src/core/loader.ts
  - src/main/summary.ts
  - tests/core/synthetic-atlas.spec.ts
  - tests/core/summary.spec.ts
```

## Out-of-scope follow-up

Source-toggle UX gap surfaced during investigation: in atlas-source projects,
toggling source to "optimized images folder" only flips `loaderMode` to
atlas-less; it does not re-point `imagesDir` to the optimize-output folder
(`<projectDir>/test/images/` after Optimize Assets runs). The user therefore
sees missing-PNG alerts in atlas-less mode for any region that lives only in
the atlas pages, even immediately after a successful Optimize Assets run.

This is a separate concern from the resolution-rule defect — the loader is
behaving correctly given its inputs. Captured as a backlog candidate for
v1.4 (`source-toggle re-point imagesDir to optimize-output folder`).
