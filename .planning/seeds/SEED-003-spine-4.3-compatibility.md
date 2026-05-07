---
id: SEED-003
status: planted
planted: 2026-05-06
planted_during: post-v1.2 exploration (after user dropped 4.3-beta exports into the app and they failed to load)
trigger_when: (a) Spine 4.3.0 stable ships AND `@esotericsoftware/spine-core@4.3.x` lands on npm (currently latest = 4.2.114, no 4.3 tag); OR (b) ≥1 customer/user reports a 4.3 export failing to load and we want to ship a clear error message (Option A below) before then
scope: A=Small / B=Medium / C=Large (see options table)
proposed_phase: 29 (if Option A only) — defer to v1.4+ for full port
---

# SEED-003: Spine 4.3 compatibility — constraint section unification breaks 4.2 loader

## The Bug (one-line)

Real Spine 4.3-beta exports throw `Unknown: IK Constraint not found: <name>` or `Unknown: Transform constraint not found: <name>` when loaded, because the 4.3 JSON moved all constraint definitions under a single `root.constraints` array that our pinned `@esotericsoftware/spine-core@4.2.x` doesn't read.

## Reproduction Fixtures (local-only — see `.gitignore`)

- `fixtures/test_4.3/jokerman/JOKERMAN_SPINE.json` — `"spine": "4.3.88-beta"`, fails on `Transform constraint not found: L_HAND_CARDS_CONST` (proprietary, not redistributable; gitignored alongside `fixtures/Jokerman/`)
- `fixtures/test_4.3/girl/TOPSCREEN_ANIMATION_JOKER.json` — `"spine": "4.3.88-beta"`, fails on `IK Constraint not found: L_LEG_1_IK` (proprietary, not redistributable; gitignored alongside `fixtures/Girl/`)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — `"spine": "4.2.43"` baseline that loads fine (in repo)

## Why It Fails — Mechanism (verified)

| Layer | 4.2 JSON shape | 4.3-beta JSON shape |
|---|---|---|
| Constraint *definitions* (skeleton-level) | Four arrays at root: `ik`, `transform`, `path`, `physics` | **Single** `root.constraints` array; each entry has `"type": "ik" \| "transform" \| "path" \| "physics" \| "slider"` |
| Animation timeline references | `animations.*.ik[name]`, `animations.*.transform[name]`, `animations.*.path[name]`, `animations.*.physics[name]` | **Same keys, unchanged** (plus new `animations.*.slider[name]`) |
| Lookup API | `findIkConstraint(name)`, `findTransformConstraint(name)`, etc. | Single `findConstraint(name, IkConstraintData)` against unified `ConstraintData` list |

Because timeline keys did NOT rename, our 4.2 reader walks `animations.*.ik[name]` happily, but the underlying `IkConstraintData[]` is empty (since `root.ik` doesn't exist in 4.3). It calls `findIkConstraint("L_LEG_1_IK")`, gets `null`, and throws — error surfaces inside the animation reader, not at constraint-load time. That's why the message is misleading: the constraint *does* exist in the file, it just lives in `root.constraints` where 4.2 doesn't look.

## Other 4.3 Schema Deltas (non-exhaustive)

- **New constraint type:** `slider` (with `SliderTimeline`, `SliderMixTimeline`). No 4.2 analog — a shim cannot translate this.
- **IK property rename:** `uniform: bool` → `scaleY` (number). Landed mid-beta at 4.3.73-beta, so the rename itself isn't beta-stable history — beta releases pre-73 use `uniform`.
- **Transform constraints** can now map a single property to multiple properties of different types (local↔world, with clamp).
- **Runtime architecture:** big refactor in `spine-ts` 4.3-beta — new `Pose`/`Posed`/`PosedActive`/`BonePose`/`IkConstraintPose` types. The `updateWorldTransform(Physics.update)` call sites in `core/sampler.ts` will not be a drop-in replacement.

## Compatibility Matrix (2026-05-06)

- ❌ **4.2 runtime + 4.3 JSON** — broken (this seed). No backward shim from Esoteric.
- ⚠️ **4.3 runtime + 4.2 JSON** — Esoteric claims compat, but rearchitecture means our consuming code (`core/sampler.ts`, `core/loader.ts`) needs a port either way.
- ✅ **4.3 editor exporting "Version: 4.2"** — supported downgrade. Earlier 4.3-betas had IK timeline scrambling bugs ([spine-editor#891](https://github.com/EsotericSoftware/spine-editor/issues/891)) — verify against fixture before recommending to users.

## Release Status

- **4.3 is still BETA.** First beta March 2025; latest 4.3.89-beta seen on changelog. **No stable 4.3.0 has shipped.**
- **No npm publication.** `npm view @esotericsoftware/spine-core dist-tags` → `latest: 4.2.114` (published 2026-04-30). No 4.3 tag, no beta tag.
- **Format is not locked.** Mid-beta breaking change (`uniform` → `scaleY`) is evidence — committing engineering effort to a 4.3 schema port today is premature.

## Options (cost-ordered)

| Option | Effort | What it gets | Trap risk |
|---|---|---|---|
| **A. Detect-and-warn** | ~1 day | Sniff `root.constraints` (or `skeleton.spine` ≥ "4.3") at parse time in `core/loader.ts`. Throw `"This file was exported from Spine 4.3-beta. Re-export with Version: 4.2 from the editor."` Replaces cryptic error. No 4.3 support. | Low — pure UX win. |
| **B. Schema shim** | ~3-5 days | Translate 4.3 `root.constraints` → 4.2 four-array layout *before* spine-core parses. Skip/error on `slider`. Skip on `uniform`/`scaleY` rename. | **HIGH** — re-do every beta when schema shifts. Users still can't render `slider` skeletons because we don't model that type. Worst-of-both-worlds. |
| **C. Full 4.3 port** | ~2-3 weeks | Wait for `spine-core@4.3` on npm, port `core/sampler.ts` to new `Pose` API, dual-runtime support if we keep 4.2. | Wait for stable. Doing this now (against beta) wastes the work. |

## Recommendation

1. **Now (Option A):** Add a 4.3-detection branch to `core/loader.ts`. Replace the cryptic `IK Constraint not found` with an actionable "re-export as Version 4.2" message. Cheap, ships immediately, unblocks the user's two failing files (re-export workflow exists in the editor).
2. **When 4.3.0 stable lands AND `@esotericsoftware/spine-core@4.3.x` is on npm (Option C):** plan the port as its own milestone. Verify the runtime API surface against `core/sampler.ts` before scoping. Keep Option A's detector as a fallback message for 4.3-beta files (since beta != stable schema).
3. **Skip Option B** unless a paying user explicitly requests "load 4.3 files now without re-exporting" — the maintenance burden against a moving beta target is a known trap.

## Open Question (parked for next conversation)

Are these 4.3-beta fixtures (Joker, JOKERMAN) from your own asset pipeline, or files customers/users sent? That changes whether "tell the user to re-export as v4.2" is a one-time fix or a lifetime support burden — and whether Option A's UX message needs to address external users specifically.

## Sources (verified during research)

- [Spine Changelog](https://esotericsoftware.com/spine-changelog) — 4.3-beta release timeline and per-build notes
- [Blog: 4.3 beta announcement (April 4, 2025)](https://en.esotericsoftware.com/blog/The-4.3-beta-is-now-available)
- [spine-runtimes 4.3-beta CHANGELOG.md](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3-beta/CHANGELOG.md) — confirms unified `ConstraintData` list, `Slider`/`SliderData`/`SliderTimeline`/`SliderMixTimeline`, IK `scaleY` replaces `uniform`
- [4.3-beta SkeletonJson.ts (raw)](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3-beta/spine-ts/spine-core/src/SkeletonJson.ts) — verified unified `root.constraints` array with `type` discriminator
- [4.2 SkeletonJson.ts (raw)](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-core/src/SkeletonJson.ts) — verified four separate `root.ik`/`root.transform`/`root.path`/`root.physics` arrays
- [Spine-Unity 4.2 → 4.3 Upgrade Guide (forum)](https://esotericsoftware.com/forum/d/29234-spine-unity-42-to-43-upgrade-guide)
- [spine-editor#891 — IK timeline scrambling on 4.3→4.2 downgrade](https://github.com/EsotericSoftware/spine-editor/issues/891)
- [Spine JSON format docs](https://en.esotericsoftware.com/spine-json-format)
