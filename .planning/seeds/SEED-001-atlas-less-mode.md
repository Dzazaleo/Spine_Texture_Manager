---
id: SEED-001
status: dormant
planted: 2026-04-25
planted_during: Milestone 1 / Phase 6 (optimize-assets-image-export) close-out
trigger_when: user explicitly requests support for json+images-folder projects (no .atlas file) — common real-world Spine workflow where animator keeps pre-pack source PNGs separate from atlas-packed export
scope: Medium
proposed_phase: 6.1
---

# SEED-001: Atlas-less mode (json + images folder, no .atlas)

## Why This Matters

The current loader at `src/core/loader.ts` requires a `.atlas` file beside the
`.json`. This matches Spine's canonical project layout (`.json + .atlas + .png`)
and is correct for projects exported from the Spine editor with packing enabled.

But a real and common workflow exists where the animator keeps:
- The skeleton `.json`
- A folder of per-region source PNGs (pre-pack, one PNG per region)
- NO `.atlas` file (packing happens later in a separate build step, or never)

For these projects, the current loader rejects with `AtlasNotFoundError`. The
user (Phase 6 verifier 2026-04-25) confirmed they want this workflow supported
because:
- It's the natural state of source assets BEFORE the Spine packer runs
- After "Optimize Assets" overwrites the images folder (Phase 6 ConflictDialog
  Overwrite-all path), re-opening the same project should not require the user
  to also keep the atlas around — the source-images folder IS the canonical
  source

The architectural challenge: spine-core needs an atlas to know region UVs +
packed bounds. Without an atlas, region pixel dimensions must come from
somewhere — and the only honest source is the source PNG files themselves.

## When to Surface

**Trigger:** any of:
- User explicitly requests json+images mode
- A user-reported bug where someone tries to load json+images and is confused
  by the AtlasNotFoundError
- A milestone scope that includes "support non-canonical Spine project layouts"
- If `src/core/loader.ts` is being touched for any reason — opportunity to
  consider the alternate-parser path

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches any of:
- "expand input formats", "support non-Spine workflows", "loosen project layout
  requirements", "post-Phase-6 atlas-related improvements"

## Scope Estimate

**Medium** — sized as a phase (Phase 6.1).

Concrete deliverables:
- Pure-JS PNG header reader (~30 lines, no decode — just IHDR chunk extraction
  for width/height) in a new `src/core/png-header.ts` (preserves CLAUDE.md
  rule #4: math layer does not decode PNGs; reading the IHDR chunk is byte
  parsing, not decoding)
- Synthesized `TextureAtlas` builder that creates a fake atlas in memory from
  per-region PNG files (`src/core/synthetic-atlas.ts`). Each region: name = PNG
  basename, dims = PNG header dims, page = the PNG file itself, x/y = 0/0,
  rotated = false
- Loader path that detects "no .atlas file" and routes through the synthesized
  atlas instead of failing
- Tests: round-trip a json+images project (no .atlas) → load → sample → export

Locked invariants still apply:
- Aspect-preservation memory (uniform single-scale, ceil per axis)
- Layer 3 (no PNG decode in core; header reading is structurally distinct)
- Phase 6 export math (ceil + ceil-thousandth)

Independently shippable — no upstream dependency.

## Breadcrumbs

Related code:
- `src/core/loader.ts:175-186` — current sourcePaths construction (assumes
  sibling `images/<regionName>.png`)
- `src/core/errors.ts` — `AtlasNotFoundError` (Phase 6 Round 2 expanded its
  message; would need to be downgraded or made conditional in atlas-less mode)
- `src/core/types.ts` — `DisplayRow` already has `sourceW`/`sourceH` (Phase 6
  Round 1 added `atlasSource` for atlas-extract; atlas-less mode is the
  inverse — atlas synthesized FROM the per-region PNGs)
- `src/main/image-worker.ts:148-162` — atlas-extract fallback (Phase 6 Round 1;
  in atlas-less mode this branch never fires since per-region PNGs always exist)
- `tests/core/loader.spec.ts` — would gain a new fixture exercising the
  atlas-less path

Related decisions:
- CLAUDE.md fact #4: "The math phase does not decode PNGs." — atlas-less mode
  honors this by reading IHDR bytes only, never libvips/sharp decoding
- Phase 6 D-110 + locked memory: aspect-preservation invariant unchanged

Related artifacts:
- `.planning/phases/06-optimize-assets-image-export/06-07-GAP-FIX-SUMMARY.md`
  Round 4 (the discussion that surfaced this requirement — user manually deleted
  source images folder to test the overwrite guard, hit the
  AtlasNotFoundError, sparked the "json+images mode" conversation)

## Notes

User chose "After Phase 6 close-out — keep verifying first" sequencing on
2026-04-25 — this seed should NOT be auto-promoted; wait for an explicit
milestone or user request.

The companion seed SEED-002 (dims-badge with override-math cap) shares the
PNG header reader infrastructure and would be a natural Phase 6.2 follow-up.
Sequenced 6.1 → 6.2.
