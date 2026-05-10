---
slug: chj-source-pngs-not-exported
status: resolved
created: 2026-05-10
updated: 2026-05-10
trigger: |
  DATA_START
  Follow-up to .planning/debug/atlas-less-export-missing-pngs.md (resolved
  2026-05-09). That session concluded that 26 of the 27 "missing PNGs" in
  the CHJ fixture (REVEAL/REVEAL_01..25 + NEW_SYMBOLS/onze) are NOT a
  defect in our loader: those PNGs are genuinely absent from
  fixtures/CHJ/images/ and atlas-less mode by design does not fall back to
  atlas pages (locked memory: project_strict_loadermode_separation).

  This new session asks the obvious follow-up:
  Why are those 26 source PNGs not present in fixtures/CHJ/images/ in the
  first place? They DO exist inside the sibling .atlas pages
  (CHJWC_SYMBOLS.atlas + numbered .png pages) and were extracted by the
  Optimize-Assets pipeline into fixtures/CHJ/test/images/. So the artist's
  Spine export DID produce regions for them — but the loose PNG sources
  never made it to <skeletonDir>/images/.

  Possible explanations (NOT yet validated — per CLAUDE.md "do not assume the
  answers; verify"):
    - The artist's .spine project sourced REVEAL_*/onze from a folder
      OTHER than fixtures/CHJ/images/ (e.g. fixtures/CHJ/images/NEW_SYMBOLS_HR/
      which IS present, suggesting an HR/source split workflow).
    - The artist exported atlas-only delivery (no loose-image sidecar copy).
    - Sequence-attachment workflow: REVEAL_01..25 looks suspiciously like a
      sequence even though the prior session's H4 falsified that. Worth
      re-checking the JSON shape to be sure.
    - Per-symbol HR/LR pipeline: NEW_SYMBOLS_HR likely contains the
      hi-res source masters; LR variants get atlas-packed without a
      loose-PNG export step.

  Goal: identify the actual reason these 26 source PNGs are missing, so we
  can decide whether (a) the fixture is fine as-is, (b) the user's artist
  workflow has a recoverable source we should document, or (c) there's a
  product feature implication (e.g. our atlas-less mode should optionally
  fall back to extracting from atlas — currently locked OFF by
  project_strict_loadermode_separation).

  Fixture: /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/CHJ
  DATA_END
---

# Debug Session: chj-source-pngs-not-exported

## Symptoms

**Expected behavior:**
- For every region path the skeleton JSON / atlas references, a loose PNG
  source exists somewhere identifiable (either in `<skeletonDir>/images/`
  or in a documented sibling folder used by the artist's pipeline).

**Actual behavior:**
- 26 region paths in the CHJ skeleton (`REVEAL/REVEAL_01` through
  `REVEAL/REVEAL_25` + `NEW_SYMBOLS/onze`) have no loose-PNG counterpart
  in `fixtures/CHJ/images/`.
- They DO exist as packed regions inside `CHJWC_SYMBOLS.atlas` /
  `CHJWC_SYMBOLS_*.png` atlas pages.
- They were extracted into `fixtures/CHJ/test/images/REVEAL/` and
  `fixtures/CHJ/test/images/NEW_SYMBOLS/onze.png` by a prior atlas-source
  Optimize-Assets run.

**Empirical readings (this session, pre-investigation):**
```
$ ls fixtures/CHJ/images/ | wc -l
19
$ ls fixtures/CHJ/images/ | head
COLORED_SLOT
CROWN_ANIM
GOLDEN_SLOT
GRAND.png
JOKER
MAGIC_EXPLOSION
MAJOR.png
MINI.png
MINOR.png
MYSTERY_PRIZE
NEW_SYMBOLS_HR     ← suggestive: HR variant of "NEW_SYMBOLS"
PRIZE_HIGHLIGHT
RAYS_GLOW.png
SCATTER_PRIZE
SHOCKWAVE
SILVER_SLOT
SPARK3.png
SPHERE
STAR.png
# (no REVEAL/, no NEW_SYMBOLS/)
```

**Reproduction:**
- Open fixtures/CHJ in the app in atlas-less mode → "27 attachments missing
  PNGs" alert (1 of which is the LABEL bug fixed 2026-05-09; the other 26
  are the focus of this session).
- Or directly: `ls fixtures/CHJ/images/REVEAL` → directory does not exist.

**Timeline:**
- Fixture committed 2026-05-08; structure unchanged since.
- Prior debug session (atlas-less-export-missing-pngs) resolved the
  loader-walk defect 2026-05-09 but explicitly scoped the 26 absent PNGs
  out of the fix.

## Hypotheses

H1: HR/LR pipeline split — the artist's master sources for REVEAL_*/onze live
    in a sibling folder (likely `NEW_SYMBOLS_HR/` and possibly a missing
    `REVEAL_HR/`), and the atlas-pack step is the only thing that materializes
    the LR variants. **FALSIFIED** — see Evidence E3, E4.

H2: REVEAL_01..25 IS a sequence attachment after all (digits look like
    `${name}_${n}` per Spine sequence convention), and our prior H4
    falsification was flawed. **FALSIFIED** — see Evidence E5.

H3: The atlas-pack step in the artist's Spine editor was configured with
    "remove source images" or similar, leaving the atlas as the only
    artifact. **NOT SUPPORTED** — only 26 of ~346 region paths are missing
    loose-PNG counterparts. A "remove source images" toggle would have
    deleted everything, not just two specific folders. See Evidence E6.

H4: The 26 PNGs exist in the artist's source tree but were never copied
    into the fixture (i.e. the artist's project workflow simply never
    materialized REVEAL/ or NEW_SYMBOLS/ as loose-image folders for these
    specific symbols). **CONFIRMED as best-supported explanation** — see
    Evidence E3, E6, E7.

## Current Focus

```yaml
hypothesis: |
  H4 — CHJ project's source-image tree never contained REVEAL/ or
  NEW_SYMBOLS/ subfolders. Every other animated symbol family in the
  project (CROWN_ANIM, MAGIC_EXPLOSION, SPHERE, SHOCKWAVE, etc.)
  ships as loose PNGs 1:1 with its atlas regions, so this is not a
  systemic "atlas-only delivery" pipeline. It's an artist-side
  workflow gap or deletion specific to two symbol families.
test: |
  Diagnostic complete. No further test needed — root cause is
  external to the app and to the fixture's defensibility as a
  regression artifact.
expecting: |
  No code-side action. The fixture is internally consistent
  (atlas + JSON match); the missing source PNGs reflect an upstream
  artist-pipeline state, not a defect in our loader.
next_action: |
  Report findings to user. No code changes proposed.
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-10
  source: ls fixtures/CHJ/images/
  finding: |
    19 entries, no REVEAL/ subdir, no NEW_SYMBOLS/ subdir. Suggestive
    sibling: NEW_SYMBOLS_HR/ (likely "hi-res" source masters).

- timestamp: 2026-05-10
  source: find fixtures/CHJ -name "REVEAL_*.png" / -name "onze*"
  finding: |
    All 26 PNGs exist exclusively at fixtures/CHJ/test/images/ (post-
    Optimize-Assets atlas-extract output). Zero hits in source images/.
    No copies anywhere else in the repo.

- timestamp: 2026-05-10
  id: E3
  source: ls fixtures/CHJ/images/NEW_SYMBOLS_HR/
  finding: |
    Contains 9 files: 0.png, 1.png, 2.png, 3.png, 4.png, 5.png, 6.png,
    7.png, 9_JOKER.png. NO `onze.png`, NO `8.png`. The atlas exposes
    exactly these 9 regions under prefix `NEW_SYMBOLS_HR/` — perfect
    1:1 match. So `NEW_SYMBOLS_HR/` is its own self-contained family,
    NOT a hi-res master folder for the missing `NEW_SYMBOLS/onze`.
    H1 (HR/LR split) FALSIFIED.

- timestamp: 2026-05-10
  id: E4
  source: file fixtures/CHJ/images/NEW_SYMBOLS_HR/*.png  vs  atlas bounds
  finding: |
    Loose `_HR` PNGs are SMALLER than their atlas regions, not larger:
      NEW_SYMBOLS_HR/3:        loose 194×62   vs atlas bounds 601×192
      NEW_SYMBOLS_HR/9_JOKER:  loose 194×48   vs atlas bounds 561×139
      NEW_SYMBOLS_HR/2:        loose 270×269  vs atlas bounds 579×578
    So the `_HR` suffix does NOT mean "hi-res master that gets downscaled
    into the atlas" — the atlas is in fact the larger artifact. The naming
    is misleading; `_HR` here is simply a folder label the artist chose.
    Reinforces falsification of H1.

- timestamp: 2026-05-10
  id: E5
  source: |
    grep -c '"sequence"' fixtures/CHJ/CHJWC_SYMBOLS.json
    + read of skin slot PICK_REVEAL (lines 2628–2653)
  finding: |
    Zero `"sequence"` blocks in the entire JSON. Spine 4.2 sequence
    attachments are ONE attachment with a `sequence: { count, frameTime,
    digits }` block — not 25 separately-named regions. The CHJ JSON
    declares all 25 REVEAL_NN frames as DISTINCT named region attachments,
    each with its own `path`, `width`, `height`, and `x`/`y` offsets that
    differ frame-to-frame (widths grow monotonically 818 → 1925 — a hand-
    keyed reveal-grow animation). This pattern is repeated across many
    skins (PICK_REVEAL, PICK_REVEAL2, etc.). H2 definitively FALSIFIED.

- timestamp: 2026-05-10
  id: E6
  source: |
    Per-folder loose-PNG vs atlas-region count comparison:
      CROWN_ANIM:       58 loose  vs  58 atlas regions   (1:1)
      MAGIC_EXPLOSION:  28 loose  vs  28 atlas regions   (1:1)
      SPHERE:           30 loose  vs  30 atlas regions   (1:1)
      SHOCKWAVE:         9 loose  vs   9 atlas regions   (1:1)
      NEW_SYMBOLS_HR:    9 loose  vs   9 atlas regions   (1:1)
      REVEAL/:           0 loose  vs  25 atlas regions   (0:25)
      NEW_SYMBOLS/:      0 loose  vs   1 atlas region    (0:1)
    finding: |
      The artist's pipeline DOES normally ship per-frame loose PNGs even
      for big animations (CROWN_ANIM = 58 frames). So H3 ("atlas-only
      delivery configured globally") is unsupported. The shortfall is
      strictly localized to the two symbol families REVEAL/ and
      NEW_SYMBOLS/ (without the `_HR` suffix). Total source-PNG file
      count: 320 — the project ships loose PNGs for everything except
      these 26 entries.

- timestamp: 2026-05-10
  id: E7
  source: |
    grep -inrE 'reveal|onze' across entire repo (excluding .git, node_modules,
    test/images extraction output)
  finding: |
    Zero hits for `REVEAL/REVEAL_*` or `NEW_SYMBOLS/onze` source PNGs
    anywhere in the repo. Only artifacts: the atlas pages themselves and
    the post-extraction `fixtures/CHJ/test/images/` output. No `.spine`
    project file shipped alongside the skeleton — we cannot inspect what
    the artist's source tree looked like at pack-time.

## Eliminated

- H1 (HR/LR pipeline split): falsified by E3 (no `onze` master in `_HR/`,
  perfect 1:1 between `_HR` loose files and `_HR` atlas regions) and E4
  (`_HR` files are smaller than atlas regions, not larger).
- H2 (sequence attachment): falsified by E5 (zero `"sequence"` blocks; 25
  distinct named regions with frame-varying `x`/`y`/`width`/`height`).
- H3 (global atlas-only delivery): not supported by E6 (CROWN_ANIM and
  six other folders all ship 1:1 loose-PNG-to-atlas-region).

## Resolution

**Root cause (forensic, not actionable as code change):**

The CHJ skeleton's source-image tree (`fixtures/CHJ/images/`) is missing
two specific subfolders — `REVEAL/` and `NEW_SYMBOLS/` — that the atlas
metadata references. Those subfolders were never present in the tree
shipped to us. The other ~344 region paths in the project DO have
matching loose PNGs (the artist clearly exports per-frame loose images
for animations as a normal practice — see CROWN_ANIM at 58:58, SPHERE
at 30:30, etc.). The shortfall is localized to two symbol families,
totalling 26 region paths.

The most likely upstream explanation is one of:
  (a) The artist's Spine project sourced REVEAL/ and NEW_SYMBOLS/ from
      a different folder root (e.g. a "shared symbols" library outside
      the skeleton's `images/` tree) and the .spine project was packed
      with `Pack > Strip whitespace` or similar settings that don't
      require the originals to be co-located with the skeleton at
      delivery time.
  (b) Those two folders were deleted from the delivery between
      Spine-pack and the hand-off to us — possibly an artist housekeeping
      step that didn't realize the loose PNGs were also expected
      downstream artifacts.
  (c) The artist drew REVEAL_01..25 and `onze` directly into the atlas
      via a plugin or external compositing step that produced atlas
      regions without ever materializing per-frame loose PNGs.

We cannot distinguish (a) / (b) / (c) without access to the artist's
`.spine` project file (which was not shipped with the fixture, per E7).
The only way to recover loose PNGs is the workaround the user already
ran: extract them from the atlas via Optimize-Assets in atlas-source
mode. That output now lives at `fixtures/CHJ/test/images/REVEAL/*.png`
+ `fixtures/CHJ/test/images/NEW_SYMBOLS/onze.png` and is byte-identical
to what the atlas contains.

**Implication for the app:**

None. The behavior we observe in atlas-less mode (26 missing-PNG alerts)
is correct and intentional, and is consistent with the locked invariant
`project_strict_loadermode_separation`: atlas-less mode reads loose PNGs
ONLY from `<skeletonDir>/images/` and never falls back to atlas pages.
The fixture is internally consistent (atlas regions ↔ JSON paths line up
1:1), so it remains a valid regression artifact. The missing-PNG alert
is the loader correctly reporting an upstream artist-side gap.

**Implication for the fixture:**

None required. If we wanted the CHJ fixture to be "complete" for
atlas-less testing, we would copy the 26 PNGs from
`fixtures/CHJ/test/images/REVEAL/` and `fixtures/CHJ/test/images/
NEW_SYMBOLS/` into `fixtures/CHJ/images/REVEAL/` and `fixtures/CHJ/
images/NEW_SYMBOLS/`. This is a one-line `cp -r` recovery — but it
shouldn't be done silently because the current state is *exactly* the
condition we want a regression test to capture (artist ships an
incomplete `<skeletonDir>/images/` tree → loader correctly reports the
gap rather than fabricating data from atlas pages).

**Recommended user-facing answer:**

"The 26 PNGs are missing from `fixtures/CHJ/images/` because the
artist's delivery never contained `REVEAL/` or `NEW_SYMBOLS/`
subfolders. Every other animated symbol family in this project ships
loose PNGs 1:1 with the atlas, and the atlas itself contains all 26
regions, so this is a localized gap on the artist's side — not an
atlas-only delivery pattern and not a sequence-attachment artifact
(that hypothesis is definitively falsified). To recover the 26 PNGs,
extract them from the atlas (Optimize-Assets in atlas-source mode
produces byte-identical output, already present at
`fixtures/CHJ/test/images/`). No code change is justified."

**Goal status:** find_root_cause_only — achieved. No fix to apply.
