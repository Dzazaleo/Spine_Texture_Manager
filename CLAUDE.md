# Spine Texture Manager — Claude project notes

## What this project is

Desktop app (Electron + TypeScript + React) that reads Spine 4.2+ skeleton JSON and computes the peak world-space render scale for every attachment, across every animation and skin. Used by Spine animators to right-size textures per-asset before export.

## Source of truth

- **Approved plan:** `~/.claude/plans/i-need-to-create-zesty-eich.md` — the full technical design, verified against the 4.2 spine-ts source.
- **Requirements:** `.planning/REQUIREMENTS.md`
- **Roadmap:** `.planning/ROADMAP.md`
- **Current state:** `.planning/STATE.md`

## Critical non-obvious facts (do not relitigate)

1. **Spine animations are stored in seconds, not frames.** The `skeleton.fps` field in the JSON is editor dopesheet metadata only — nonessential, default 30, has zero runtime effect. Any sampling rate is our choice.
2. **`computeWorldVertices` after `updateWorldTransform(Physics.update)` already handles** the bone chain, slot scale, weighted-mesh bone influences, IK, TransformConstraints, PathConstraints, PhysicsConstraints (4.2), and DeformTimelines. We do not reimplement any of this math.
3. **The sampler lifecycle is:** `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)`. Must be called in that order every tick.
4. **The math phase does not decode PNGs.** A stub `TextureLoader` populated from `.atlas` metadata is sufficient. PNGs are only read by `sharp` during "Optimize Assets."
5. **`core/` is pure TypeScript, no DOM.** Headless-testable in Node via vitest. The UI is a consumer.
6. **Default sampler rate: 120 Hz.** Configurable in Settings. Rationale: above typical game render cadence (60 Hz), catches sub-frame peaks on easing curves, still fast.

## Test fixture

`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (+ `.atlas`, `.png`). Contains CIRCLE/SQUARE/TRIANGLE regions, `CHAIN_2..8` bone chain, `SQUARE2` pre-scaled bone, and a `TransformConstraint` on `SQUARE`. Golden tests drive from this.

## Folder conventions (do not misread)

- `fixtures/` — exported Spine JSON + atlas + PNG for tests. In-repo.
- `temp/` — **the user's Spine editor source files (.spine projects).** Not part of the app, not used by tests. **Must be gitignored** when the repo is initialized.

## Commands

- `npm run test` — vitest run
- `npm run test:watch` — vitest watch
- `npm run dev` — Electron dev server (after Phase 1)
- `npm run build` — production build (after Phase 1)
- `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — CLI table dump (Phase 0)

## GSD workflow

This project uses the GSD phase-gated workflow:
- `/gsd-plan-phase N` — produce `.planning/phases/NN/PLAN.md` for phase N.
- `/gsd-execute-phase N` — execute the plan with atomic commits.
- `/gsd-verify-work N` — validate phase against requirements.

Phases execute strictly in order — do not skip ahead.
