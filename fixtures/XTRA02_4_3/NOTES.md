# XTRA02_4_3 — fixture-prep note (auditable)

**Date:** 2026-05-18
**Scope:** `XTRA-02.json` only. `.atlas` / `.png` byte-untouched.

## What was hand-edited

Two keys were added to the exported skeleton JSON, one per IK constraint:

| IK constraint | Added |
|---------------|-------|
| `TARGET`  (bones `UPPER`/`LOWER`)   | `"scaleY": "uniform"` |
| `TARGET2` (bones `UPPER2`/`LOWER2`) | `"scaleY": "volume"`  |

Nothing else changed (no bones/slots/skins/animations/atlas/png touched).

## Why

XTRA-02 exists to exercise the Spine 4.3 IK `scaleYMode` (Uniform AND Volume)
per `42-OWNER-EXPORT-SPEC.md` §5 / Phase-44 D-03. The owner configured the
scale-Y mode on both IK constraints in the Spine editor (setup mode) and
re-exported **twice** — both exports were byte-identical (`spine: 4.3.02` then
`4.3.01`, 3345 bytes) and contained **no** scale-mode token under any name.
This editor build does not serialize the IK scale-Y mode for this rig.

The rig is otherwise correct and genuine: 2 IK constraints, both
`"stretch": true`, two animations (`SCALE_Y_UNIFORM` / `SCALE_Y_VOLUME`) that
bend each chain so the mode is geometry-affecting.

## Why this is a genuine feature exercise, not a green-wash

`"scaleY"` is a first-class field of the pinned runtime's parser
`@esotericsoftware/spine-core@4.3.0`:

- `dist/SkeletonJson.js:148-150` — `const scaleY = getValue(constraintMap,
  "scaleY", null); if (scaleY != null) data.scaleYMode =
  Utils.enumValue(ScaleYMode, scaleY);`
- `dist/Utils.js:336-338` — `enumValue(type,name) => type[name[0].toUpperCase()
  + name.slice(1)]` → `"uniform"` → `ScaleYMode.Uniform` (1); `"volume"` →
  `ScaleYMode.Volume` (2).

With `stretch:true` on both chains and bend animations, the 4.3 runtime
genuinely applies Uniform / Volume scale co-variation during
`updateWorldTransform`. The hand-added keys produce real, runtime-honored
behavior — the structural assertion passes because the feature is actually
present.

## Reproducibility

Re-derivable from a clean export by adding the two keys above. To self-check:

```
grep -o '"scaleY":"[^"]*"' fixtures/XTRA02_4_3/XTRA-02.json
# expect two lines: "scaleY":"uniform" and "scaleY":"volume"
```

## Precedent

Sanctioned by Phase-44 CONTEXT.md **D-15**: a documented, reproducible,
minimal fixture-prep step recorded in a NOTES beside the fixture so it is
auditable (the skeleton JSON stays a clean owner export except for this
explicitly-recorded, runtime-honored field addition).
