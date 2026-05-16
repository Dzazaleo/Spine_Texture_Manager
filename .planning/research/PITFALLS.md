# Pitfalls Research

**Domain:** Dual-runtime Spine 4.2 + 4.3 port of a peak-world-space-render-scale compute system (Electron + TS + React, pure-TS `core/`, `worker_threads` sampler)
**Researched:** 2026-05-16
**Confidence:** HIGH (every API claim verified against the actual `@esotericsoftware/spine-core@4.3.0` and `@esotericsoftware/spine-player@4.3.0` npm tarballs — the exact bytes an alias would install)

## Verification Gate Result (read this first)

`npm view @esotericsoftware/spine-core@latest` → **`4.3.0`** (published; jumps straight from `4.2.116`; **no `4.3.x-beta` npm tags ever existed**). `@esotericsoftware/spine-player@latest` → `4.3.0` (depends on `@esotericsoftware/spine-webgl@4.3.0`). Both installed pins are still `4.2.111`. SEED-006 trigger fired.

**SEED-006's beta-built inventory is materially WRONG against 4.3.0 stable. The single most important finding of this research:**

> Spine 4.3 did **not** apply "5 renames + 2 signature changes." It performed a **Pose-architecture rewrite**. `Bone` and `Slot` no longer carry the world transform or attachment at all — those moved to `BonePose` / `SlotPose`, reached via `bone.appliedPose` / `slot.pose`. SEED-006 framed this as `slot.getAttachment() → slot.pose.attachment` (one line). It is actually **every world-transform and attachment read in `core/bounds.ts` and `core/sampler.ts`** — the exact code that computes the number this product exists to compute.

Verified deltas (4.3.0 stable, from the d.ts shipped on npm):

| SEED-006 beta claim | 4.3.0 stable reality | Status |
|---|---|---|
| `Skeleton.setToSetupPose()` → `setupPose()` | `Skeleton.setupPose()` exists (line 115). Correct. | ✅ survived |
| `Skeleton.setSlotsToSetupPose()` → `setupPoseSlots()` | `Skeleton.setupPoseSlots()` exists (line 119). Correct. | ✅ survived |
| `state.setAnimationWith(i, anim, loop)` → `state.setAnimation(i, anim, loop)` | `AnimationState.setAnimation(trackIndex, animation, loop?)` overload exists (line 98). Correct. | ✅ survived |
| `slot.getAttachment()` → `slot.pose.attachment` | `Slot extends Posed<SlotData, SlotPose>`. **`Slot` has NO `getAttachment()` and NO `color`.** Attachment is `slot.pose.attachment` / `slot.pose.getAttachment()`; tint is `slot.pose.color`. Correct in spirit, but the v1.3 visibility invariant (`project_sampler_visibility_invariant`) reads `slot.color.a` too — **that also moved** and SEED-006 never mentioned it. | ⚠️ incomplete |
| `RegionAttachment.computeWorldVertices(slot, wv, off, stride, vertexOffsets)` (appended last) | `computeWorldVertices(slot, vertexOffsets, worldVertices, offset, stride)` — **`vertexOffsets` is the 2ND positional arg, not appended last.** Beta inventory's arg order is WRONG. | ❌ wrong |
| `VertexAttachment.computeWorldVertices(skeleton, slot, start, count, wv, off, stride)` (skeleton prepended) | `Attachment.computeWorldVertices(skeleton, slot, start, count, worldVertices, offset, stride)` — skeleton prepended. Correct. | ✅ correct |
| IK `uniform: bool` → `scaleY: number` (mid-beta @ 4.3.73) | **Evolved again.** Stable has NO `scaleY` field. It is `IkConstraintData.scaleYMode: ScaleYMode` (enum: `none` / multiply-by-scaleX-factor / divide-by-scaleX-factor). SEED-006's `scaleY: number` is stale. | ❌ wrong |
| `bone.getWorldScaleX()` / `getWorldScaleY()` (used at `bounds.ts:383,396`) — not in SEED-006 at all | **`Bone` has NO `getWorldScaleX/Y`, NO `worldX/Y`, NO `a/b/c/d`.** All on `BonePose` only (lines 63-115). Reached via `bone.appliedPose.getWorldScaleX()`. SEED-006 omitted this entirely — it is the single biggest port surface. | ❌ omitted |
| Pose lifecycle "likely-unchanged shape" | **Three poses now exist per object:** `pose` (unconstrained), `constrainedPose`, `appliedPose` (for rendering, post-constraint). Reading the wrong one silently returns pre-IK/pre-transform-constraint geometry → systematic undersize. | ❌ understated |

**Verdict for roadmapper:** SEED-006's "~2-3 week / 4-task" estimate and PORT-01/02 task shapes are obsolete. The port is an abstraction-layer rewrite of every `Bone`/`Slot` read in `core/`, not a rename sweep. A dedicated **beta-vs-stable re-verification + API-mapping phase must run before any porting phase locks**, and it largely already happened in this document — but the roadmap must still own a phase that *encodes* this mapping into a typed runtime-abstraction interface and a fixture-backed equivalence proof.

---

## Critical Pitfalls

### Pitfall 1: Porting against SEED-006's beta inventory instead of the verified 4.3.0 stable surface

**What goes wrong:**
A plan task says "apply the 5 renames + 2 signature changes from SEED-006." Engineer changes `slot.getAttachment()` → `slot.pose.attachment`, appends `vertexOffsets` to the end of the region call, adds a `scaleY` field handler. Code compiles (structural typing hides some of it), runs, produces numbers. The numbers are wrong: `RegionAttachment.computeWorldVertices` got `vertexOffsets` in the `worldVertices` slot (arg-order swap), `bounds.ts` still calls the now-nonexistent `bone.getWorldScaleX()` (caught by tsc) or — worse — reads `bone.pose` instead of `bone.appliedPose` (compiles, returns pre-constraint geometry), and the IK `scaleYMode` enum is silently ignored.

**Why it happens:**
SEED-006 is a queue-ready scoping doc written in good faith from the 4.3-**beta** tarball. It is now the most authoritative-looking artifact in the repo and the roadmapper will treat it as ground truth. It is stale on 4 of 8 line items (see table above). The `uniform → scaleY` mid-beta churn that SEED-006 itself cites as the cautionary precedent **happened again** between beta and stable (`scaleY` → `scaleYMode` enum).

**How to avoid:**
Treat SEED-006's inventory as a hypothesis, not a spec. The verified 4.3.0 mapping table at the top of this document supersedes it. The first porting phase produces a single typed `RuntimeAdapter` interface whose 4.3 implementation is written *against the extracted `*.d.ts` from the pinned `@esotericsoftware/spine-core@4.3.0` tarball*, not against SEED-006 prose. Pin the exact version (`4.3.0`, not `^4.3.0` / not `4.3.x`) so a future patch can't re-introduce drift mid-milestone.

**Warning signs:**
A plan or commit message quotes "PORT-01: 5 renames" verbatim. A diff appends an arg to `computeWorldVertices` instead of inserting `vertexOffsets` second. Any reference to a `scaleY: number` field. `tsc --noEmit` against the 4.3 path passes on the first try without touching `bounds.ts` bone reads (it shouldn't — `getWorldScaleX` is gone from `Bone`).

**Phase to address:**
First v1.6 porting phase (Phase 42 or 43) — the **API-mapping / runtime-adapter-interface phase**. This phase's deliverable is the verified mapping encoded as a typed adapter, with this document's table as its acceptance reference.

---

### Pitfall 2: Reading the unconstrained `pose` instead of `appliedPose` → systematic silent undersize

**What goes wrong:**
4.3 splits every posed object into `pose` (unconstrained — what animations/code set), `constrainedPose`, and `appliedPose` (post-constraint, what rendering uses). `Posed.getPose()` returns the **unconstrained** pose. `bounds.ts` computes peak render scale from `bone.getWorldScaleX/Y()` and `computeWorldVertices`, which in 4.3 must read `bone.appliedPose`. If the port reaches for `bone.pose` (the natural-looking choice; `getPose()` is the public getter) the world transform reflects animation **before IK / TransformConstraint / PathConstraint / PhysicsConstraint / Slider** modify it. Every rig with constraints (the SIMPLE_TEST fixture has a `TransformConstraint` on `SQUARE`; real rigs are constraint-heavy) reports a **smaller** peak than the runtime actually produces. The texture is sized too small. Visible quality loss ships. This is the existential failure mode named in the milestone context.

**Why it happens:**
In 4.2 there was one pose; `bone.a/b/c/d/worldX/worldY` were always post-constraint after `updateWorldTransform`. The 4.3 three-pose model is non-obvious, `getPose()` reads as "the pose," and the bug produces *plausible, slightly-small* numbers, not a crash or an obvious zero. CLAUDE.md fact #2 ("computeWorldVertices after updateWorldTransform already handles the bone chain, IK, constraints") is still true — but only if you read it off `appliedPose`.

**How to avoid:**
The runtime-adapter interface exposes a single `getWorldScaleX(bone)` / `getWorldScaleY(bone)` / `computeRegionWorldVertices(...)` surface. The 4.3 implementation reads `bone.appliedPose` exclusively; this is documented in the adapter with a one-line "WHY appliedPose" comment citing this pitfall. Then prove it empirically (Pitfall 3's golden-rig oracle): the SIMPLE_TEST `TransformConstraint` on `SQUARE` is the canary — if 4.3-via-adapter and 4.2 disagree on `SQUARE`'s peak, the wrong pose is being read.

**Warning signs:**
`.pose.` or `.getPose()` anywhere in the 4.3 `bounds`/`sampler` adapter. A peak that is correct for unconstrained bones but low specifically for constraint-targeted slots. 4.3 peaks uniformly slightly below 4.2 peaks on the same logical rig.

**Phase to address:**
API-mapping phase (interface contract: "world reads = appliedPose"). Verified in the **4.2↔4.3 equivalence phase** (Pitfall 3).

---

### Pitfall 3: No known-good oracle for a silently-wrong 4.3 sample

**What goes wrong:**
A 4.3 rig samples, produces a peak, the app exports a texture. There is no 4.2 equivalent to diff against (4.3-only features: slider, `scaleYMode`, multi-target transform constraints), and the number looks reasonable. It is wrong by 8%. Nobody notices until an animator sees blur in-game and can't reproduce it because the app "worked."

**Why it happens:**
This app's entire value is a number with no natural ground truth — there's no compiler error for "undersized by 8%." 4.2 had years of golden fixtures (SIMPLE_TEST byte-locked). 4.3 has none, and 4.3-only constructs have no 4.2 analog to cross-check.

**How to avoid — layered oracle strategy (concrete, not "test your code"):**

1. **Same-rig cross-runtime equivalence (primary oracle).** Author/export a rig that uses *only* 4.2-compatible constructs (bones, slots, region + mesh attachments, IK, TransformConstraint, PathConstraint, PhysicsConstraint — everything SIMPLE_TEST already has) and export it **twice from the 4.3 editor**: once as "Version: 4.3" and once as "Version: 4.2" (the supported downgrade). Feed the 4.2 export through the 4.2 runtime and the 4.3 export through the 4.3 runtime. **The `globalPeaks` Map must match within a tight float epsilon (e.g. 1e-4 relative).** This is the strongest available oracle: same authored motion, two runtimes, must agree. The `TransformConstraint`-on-`SQUARE` in SIMPLE_TEST makes this also a Pitfall-2 detector.
2. **Editor-bounds cross-check (secondary, for 4.3-only features).** For slider / `scaleYMode` / multi-target transform constraints with no 4.2 analog: in the Spine editor, scrub the animation, read the on-screen bounding box of the target attachment at the visually-largest frame, and assert the app's reported peak world scale × source dims is within tolerance of the editor's bounds. Documented as a HUMAN-UAT step (the viewer makes this self-service — see point 3).
3. **spine-player visual co-render (tertiary, qualitative).** The v1.5.1 viewer renders the *same* skeleton via spine-player. After the spine-player 4.3 bump, the viewer and the sampler share a runtime family. Eyeballing "does the viewer show the attachment at roughly the size the peak claims" is a cheap sanity gate, not a proof.
4. **Hand-authored minimal slider fixture with a closed-form expected peak** (see Pitfall 9). A slider that drives a single bone's X translation from 0→100 over 1s, one square region on that bone: the peak world position is analytically known. Assert the sampled peak equals the closed-form value. This is the only true oracle for slider because no 4.2 analog exists.

**Warning signs:**
A PR adds 4.3 support with only "it runs and the number is plausible" evidence. No same-rig cross-runtime diff test. Slider validated by "the test passes" with no independently-derived expected value.

**Phase to address:**
A dedicated **4.2↔4.3 equivalence + oracle phase**, gating all 4.3-only feature phases. Slider closed-form oracle lands in the slider phase (Pitfall 9).

---

### Pitfall 4: Dual type-universe — a 4.2 `Skeleton` flows into a 4.3 API (or vice-versa), compiles, corrupts at runtime

**What goes wrong:**
Both `@esotericsoftware/spine-core@4.2.111` (aliased) and `@esotericsoftware/spine-core@4.3.0` export classes named `Skeleton`, `Slot`, `Bone`, `SkeletonJson`, `AnimationState`. TypeScript is structurally typed. A 4.2 `Skeleton` (flat `bone.worldX`) is assignable to a parameter typed as 4.3 `Skeleton` (`bone.appliedPose.worldX`) wherever the *used* members overlap — and they overlap enough to pass `tsc` while diverging at runtime. The sampler dispatches a 4.3 JSON to the 4.2 loader (or threads a 4.2-built skeleton into a function holding a 4.3 `AnimationState`), it compiles, and it produces garbage peaks or throws deep in spine-core with a cryptic message (exactly the SEED-003 `IK Constraint not found` class of misleading symptom, reborn).

**Why it happens:**
npm aliasing puts two same-named, same-shaped-enough modules in the graph. Structural typing means the compiler will not stop you mixing them. The instinct is "they're both `Skeleton`, it's fine."

**How to avoid:**
- **Brand the runtime boundary, don't pass raw spine objects across it.** The `RuntimeAdapter` interface owns the spine objects internally; `core/sampler.ts` / `core/bounds.ts` never hold a bare `Skeleton`/`Bone` typed by a specific runtime. They hold an opaque adapter handle (`type SkeletonHandle = { readonly __runtime: '4.2' | '4.3'; readonly skeleton: unknown }` or a branded nominal type) and call adapter methods. The runtime tag is a *required field on the handle* (per `feedback_explicit_identity_over_inference` memory — thread identity explicitly, don't infer it).
- **Two import namespaces, never co-mingled in one module.** `core/runtime/spine42.ts` imports only from the 4.2 alias; `core/runtime/spine43.ts` only from `@esotericsoftware/spine-core` (4.3). No file imports both. An arch-spec test (sibling to `tests/arch.spec.ts`) greps for any file importing both alias specifiers and fails the build.
- **Dispatch decides runtime once, at load, from the detected version**, and stamps the handle. Every downstream consumer reads the stamp, never re-sniffs.

**Warning signs:**
A function signature with a bare `Skeleton` parameter that isn't inside a runtime-specific module. Any module importing both `@esotericsoftware/spine-core` and the 4.2 alias. A `// @ts-expect-error` or `as any` near a spine type at a dispatch boundary. Cross-runtime mixing that "just compiled."

**Phase to address:**
API-mapping / runtime-adapter-interface phase (the branded boundary is the interface's reason to exist). Enforcement test in the same phase.

---

### Pitfall 5: 4.2 regression — the alias/dispatch refactor silently changes the 4.2 code path

**What goes wrong:**
Introducing the npm alias, the dispatcher (repurposing `checkSpine43Schema`), and the adapter indirection touches every entry point the 4.2 path also flows through (`loader.ts:251`, `sampler-worker.ts:61-62`, `core/sampler.ts`, `core/bounds.ts`). A subtle change — alias resolves to a different 4.2 patch, the adapter reorders a call, dispatch mutates parse order — makes existing 4.2 rigs sample *differently than before v1.6*. Every shipped 4.2 user silently gets different (wrong) texture sizes on their next optimize. This is the highest-blast-radius regression in the milestone: it hits the existing, paying, working user base.

**Why it happens:**
"It's just adding a second runtime, the 4.2 path is untouched" — but the 4.2 path is no longer called directly; it's called *through the new abstraction*. Indirection is change. And npm aliasing can quietly re-resolve the 4.2 version if the spec isn't exact-pinned.

**How to avoid — the byte-equal regression gate (named, concrete):**

1. **Before any v1.6 code change**, on the current `main` (still single-runtime 4.2.111), generate and commit a **golden baseline of the full `globalPeaks` Map** (and the full `SamplerOutput` / `buildSummary` output) for every in-repo 4.2 fixture: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, `fixtures/INHERIT_TIMELINE/`, `fixtures/spine_stripWS/`, and any other non-gitignored 4.2 rig. Serialize deterministically (sorted keys, fixed float precision) to a committed JSON snapshot.
2. **Regression gate:** a vitest spec that re-runs the 4.2 path *through the new dispatcher + adapter* and asserts the output is **byte-identical** (deep-equal on the canonicalized snapshot) to the committed pre-v1.6 baseline. This must be **strict byte-equal, not "within epsilon"** — the 4.2 runtime is unchanged spine-core 4.2.111; any drift means the *plumbing* changed behavior and is a bug, not a tolerance.
3. **Exact-pin both specs** in `package.json`: `"@esotericsoftware/spine-core": "4.2.111"` stays exact; the alias is `"spine-core-43": "npm:@esotericsoftware/spine-core@4.3.0"` exact. Commit `package-lock.json`. CI runs `npm ci` (lockfile-frozen), never `npm install`.
4. The 4.2-only `SIMPLE_TEST` byte-stability is a LOCKED milestone decision — this gate is its enforcement mechanism.

**Warning signs:**
The 4.2 baseline snapshot test isn't the *first* artifact created in the milestone. The regression test uses `toBeCloseTo` / epsilon instead of `toEqual` on canonicalized output. `package.json` uses `^` or `~` on either spine-core spec. `package-lock.json` not committed or CI uses `npm install`.

**Phase to address:**
**Phase 42 (the very first v1.6 phase) must land the pre-v1.6 4.2 golden baseline + the byte-equal gate before the alias is added.** Order is load-bearing: you cannot baseline behavior after you've changed it.

---

### Pitfall 6: The stale "re-export as Version 4.2" advisory + `SpineVersionUnsupportedError` reject path — surfaces that must flip, and the ones that get missed

**What goes wrong:**
v1.4 Phase 32 made 4.3 a hard reject with a "re-export as Version 4.2" message. After v1.6, that advice is *wrong* — 4.3 is supported. Flip the obvious surface (the loader throw) and miss the others, and the app now: rejects valid 4.3 files at one untouched gate, OR shows "we only support 4.2" copy in the drop zone while happily loading 4.3, OR a test still asserts the old throw and goes red, OR the Documentation Builder emits "4.2 only" into user-facing HTML.

**Why it happens:**
The reject behavior was deliberately threaded through many layers in Phase 32 (loader, error class, IPC, drop-zone copy, tests) for good UX. Each is a separate flip. Grep misses string-built or comment-adjacent ones.

**Enumerated surfaces (verified by grep — this is the checklist for the roadmapper):**

| Surface | File:line | Required change |
|---|---|---|
| Loader hard-reject on `>= 4.3` | `src/core/loader.ts:120,131,135,140` (`major.minor >= 4.3` throws) | Replace throw with **dispatch to 4.3 runtime** |
| `checkSpine43Schema` rejecter | `src/core/loader.ts:175-187,251` (throws `4.3-schema`) | Repurpose from **rejecter → dispatcher** (the `root.constraints` sniff becomes the routing signal, not the error trigger) |
| Error message text | `src/core/errors.ts:92-120` (`SpineVersionUnsupportedError`, "Re-export from your 4.3 editor as Version 4.2") | The 4.3-schema arm must no longer be reachable for valid 4.3; keep `SpineVersionUnsupportedError` ONLY for genuinely-unsupported versions (pre-4.2, malformed, future > 4.3) |
| Drop-zone copy | `src/renderer/src/App.tsx:676` (`Drop a Spine <b>v4.2</b> JSON`) | Update to "v4.2 or v4.3" (or drop the version qualifier) |
| IPC error mapping | `src/main/sampler-worker.ts:156` (`instanceof SpineVersionUnsupportedError`) | Path still valid for true-unsupported; verify 4.3 no longer hits it |
| Tests asserting reject | `tests/core/loader-version-guard.spec.ts`, `loader-version-guard-predicate.spec.ts`, `loader-43-schema-guard-predicate.spec.ts`, `errors-version.spec.ts`, `loader.spec.ts`, `tests/core/ipc.spec.ts` (6 files reference `SpineVersionUnsupportedError`/`checkSpine43Schema`) | Invert: 4.3 schema → **routes to 4.3 runtime + samples**, not throws. The predicate tests must now assert dispatch target, not exception. **`>4.3` future-version + pre-4.2 + malformed throw-cases must stay green** (don't delete the guard, narrow it). |
| Documentation Builder output | `src/renderer/src/modals/DocumentationBuilderDialog.tsx` + any HTML-export template referencing "Spine 4.2" support | Audit generated HTML for "4.2 only" copy |
| User docs / README / drop-zone tooltip | README, INSTALL, in-app Help/Settings copy | Sweep for "Spine 4.2" / "re-export as 4.2" verbiage |

**Easiest-missed:** the **inverted predicate tests** (a passing test asserting the old reject is a *false green* — it must be flipped to assert dispatch, and the narrowed-guard cases for pre-4.2/future/malformed must be explicitly preserved, not collateral-deleted), the **Documentation Builder HTML template**, and the **drop-zone tooltip/copy** (cosmetic, no test, silently stays wrong).

**Warning signs:**
A 4.3 fixture loads and samples but the drop zone still says "v4.2." Any `loader-version-guard*` test still asserts `toThrow(SpineVersionUnsupportedError)` for a 4.3 input. `git grep -i "version 4.2\|re-export\|v4.2"` returns renderer/docs hits post-port.

**Phase to address:**
The **dispatcher phase** flips loader/errors/IPC + inverts the 6 test files (same commit as behavior change — tests and behavior flip together). A **copy/docs sweep** rides the same or final polish phase with the table above as its checklist.

---

### Pitfall 7: spine-player 4.3.0 bump regresses the just-shipped v1.5.1 viewer (5 open UATs)

**What goes wrong:**
`@esotericsoftware/spine-player` 4.2.111 → 4.3.0 pulls in `@esotericsoftware/spine-webgl@4.3.0` (the Pose-rewrite runtime). The v1.5.1 viewer (`AnimationPlayerModal.tsx`) is freshly shipped with 3 hard-won gap-fixes (CSP `connect-src 'app-image:'`, CORS ACAO on the protocol handler, straight-alpha SpinePlayer config) and 5 still-open HUMAN-UATs. A spine-player API or rendering-default change silently regresses it, and the regression lands inside already-fragile, host-blocked, hard-to-verify visual code.

**Why it happens:**
spine-player 4.3 sits on the same Pose rewrite as spine-core 4.3. Internal asset-resolution, alpha handling, or camera-fit defaults can shift across a major. The viewer depends on non-obvious internals (the modal comment cites "vendored line 5862" parent-dir atlas resolution — internal behavior, not a stable API contract).

**How to avoid:**
- **Verify the `SpinePlayerConfig` surface the viewer actually uses against 4.3.0.** Confirmed present in `@esotericsoftware/spine-player@4.3.0`'s `Player.d.ts`: `rawDataURIs`, `animation`/`animations`, `skin`/`skins`, `alpha`, `backgroundColor`, `success`, `error`, `showControls`, `SpinePlayer.setAnimation/addAnimation/setViewport`. The config surface the viewer relies on **survived to 4.3.0** — the API risk is LOW; the risk is *rendering/asset-resolution behavior*, not signature breakage.
- **Straight-alpha config is the highest risk.** The v1.5.1 fix relied on a specific premultiplied-alpha setting. The PMA memory (`project_pma_no_op_in_current_stack`) is about sharp, not spine-webgl GL — do not assume it transfers. Re-run `scripts/pma-probe.mjs`-style reasoning for the GL path: render SIMPLE_TEST in the 4.3 viewer and visually confirm no dark-fringe / double-multiply halo.
- **The atlas-resolution-by-parent-dir internal** (modal comment, "vendored line 5862") may have moved across the major. Treat the `app-image://` URL feed + `rawDataURIs` path as needing explicit re-verification, not assumed-stable.
- Re-run all 5 open Phase 41 HUMAN-UATs against the 4.3 player as the viewer-regression gate; they are pre-written and now do double duty.

**Warning signs:**
Viewer shows a blank canvas, wrong colors, alpha halos, or mis-scaled skeleton after the bump. spine-player `error` callback fires on a rig that rendered in v1.5.1. The 5 open UATs that were "visual/host-blocked" now also fail functionally.

**Phase to address:**
A **dedicated spine-player 4.3 bump + viewer regression phase**, sequenced *after* the core dual-runtime is green (don't debug two runtime ports at once). Its gate = the 5 carried-forward Phase 41 UATs re-run on 4.3.

---

### Pitfall 8: npm-alias traps — lockfile, electron-builder packaging, Vite dedup, tree-shaking the wrong runtime

**What goes wrong:**
The alias (`"spine-core-43": "npm:@esotericsoftware/spine-core@4.3.0"`) introduces four independent failure modes: (a) non-reproducible installs if lockfile/CI is loose; (b) electron-builder ships only one copy (or bloats with both unpruned); (c) Vite `dedupe` / `optimizeDeps` collapses the two same-named packages into one, so *both* "runtimes" are secretly the same version → 4.2 rigs sampled by 4.3 code or vice-versa with no error; (d) tree-shaking / bundle splitting drops the runtime that isn't statically reachable from the entry, so dynamic-dispatch'd 4.3 is `undefined` at runtime in the packaged app (works in dev, fails in production — the `feedback_platform_divergent_check_stale_build` class of bug).

**Why it happens:**
Two packages with the *same internal package name* (`@esotericsoftware/spine-core`) under different alias keys is exactly the input that confuses dedup/hoisting/bundler-identity heuristics. The sampler runs in a `worker_threads` Worker bundled by electron-vite — a second bundling context with its own resolution.

**How to avoid:**
- Exact-pin both specs; commit `package-lock.json`; CI uses `npm ci` only (shared with Pitfall 5's gate).
- **Disable Vite dedupe for the spine packages** and verify post-build that the two runtimes are *physically distinct modules*: a test that loads both via the dispatcher and asserts `adapter42.version !== adapter43.version` and that a known 4.3-only export (`Slider`, `SliderData`, `Pose`, `Posed`, `BonePose`, `SlotPose` — all confirmed exported from `@esotericsoftware/spine-core@4.3.0` `index.d.ts`) is absent from the 4.2 module and present in the 4.3 module.
- **Production-bundle smoke test in CI:** build the app (`npm run build`), then run the sampler worker against both a 4.2 and a 4.3 fixture *from the built artifacts*, not from `src/`. This catches tree-shaking/packaging drops that dev-mode hides.
- **electron-builder:** explicitly verify both `@esotericsoftware/spine-core` and the alias dir survive `asar`/`files` packaging (`asarUnpack` not needed — pure JS — but the `node_modules` prune must keep both).

**Warning signs:**
`adapter42.version === adapter43.version` in the distinctness test. Dev works, packaged app throws "X is not a constructor" / `Slider is undefined` on a 4.3 rig. `package-lock.json` diff churns on every `npm install`. Bundle analyzer shows one spine-core, not two.

**Phase to address:**
The **alias-bump phase (Phase 42, same as Pitfall 5)** lands the exact-pin + lockfile + the runtime-distinctness test + a production-bundle smoke job in CI.

---

### Pitfall 9: No redistributable in-repo 4.3 + slider fixture (PORT-03 blocker)

**What goes wrong:**
Every existing 4.3 fixture is proprietary and gitignored: `.gitignore` excludes `fixtures/test_4.3/` (the SEED-003 Joker/JOKERMAN 4.3-beta exports), `fixtures/Jokerman/`, `fixtures/Girl/`, `fixtures/SKINS/`. There is **no in-repo 4.3 fixture and no slider fixture at all**. PORT-03 (validate slider timeline propagation) and the Pitfall-3 oracle and the Pitfall-5/CI matrix all *require* a committed, redistributable 4.3 rig. Without it: CI can't test the 4.3 path on fresh clones, slider validation has nothing to run against, and the equivalence oracle has no 4.3 side. This is a hard blocker, not a risk.

**Why it happens:**
SEED-003 explicitly notes the beta fixtures are "proprietary, not redistributable." The convention (`feedback_gitignore_fixtures_check_test_refs`) is that gitignored fixtures get `it.skipIf` guards — but you cannot `skipIf` the entire 4.3 port's test coverage.

**How to avoid — concrete acquisition path (ordered by reliability):**

1. **Author a minimal 4.3 rig in the Spine editor (preferred).** The owner has the Spine editor (used it to export SIMPLE_TEST). Create a deliberately tiny rig — 2-3 bones, 1-2 region attachments, one IK constraint, and **one slider constraint** driving a bone — and export it as "Version: 4.3". Commit JSON + atlas + PNG to `fixtures/SLIDER_4_3/` (mirror the `fixtures/SIMPLE_PROJECT/` + `fixtures/INHERIT_TIMELINE/` in-repo convention). This is the SIMPLE_TEST analog for 4.3 and becomes the CI 4.3 baseline. **Design it so the slider drives one bone's X translation linearly 0→100 over 1s with one square region on that bone → the peak world position is closed-form** (Pitfall 3 oracle #4).
2. **Re-export SIMPLE_TEST from a 4.3 editor as both "Version: 4.3" and "Version: 4.2"** → the same-rig cross-runtime equivalence oracle (Pitfall 3 #1). This is the single highest-value fixture: it's already the golden rig, now in two runtime dialects. (4.3 editor's "open a 4.2 project / re-export" path — verify spine-editor#891 doesn't bite, see Pitfall 10.)
3. **Hand-author a minimal 4.3 JSON** from the [Spine JSON format spec](https://en.esotericsoftware.com/spine-json-format) + the verified `root.constraints[]` shape (confirmed: `SkeletonJson@4.3.0` reads `root.constraints` with `type: "ik"|"transform"|"path"|"physics"|"slider"`, line 129-339). Highest-control, lowest-fidelity (no editor to confirm the math is rig-realistic) — use only as a unit-level slider-parse fixture, not the equivalence oracle.

**Acquisition is owner-blocked, not engineer-blocked** — it needs the Spine editor + a human export. The roadmap must surface this as an **explicit human/owner task in the first 4.3-feature phase, with options 1+2 as the plan and option 3 as the no-editor fallback.**

**Warning signs:**
A 4.3 phase plan assumes a 4.3 fixture exists. CI 4.3 tests are all `it.skipIf`. The slider test has a hardcoded expected value with no derivation comment (means no closed-form oracle — Pitfall 3).

**Phase to address:**
The fixture-authoring is a **prerequisite task in the first 4.3-capability phase** (slider + equivalence phase). It must be called out in the roadmap as owner-action-required, scheduled before the slider/equivalence test phases that consume it. Recommend it ride alongside Phase 42 so it's unblocked early.

---

### Pitfall 10: Spine editor "Version: 4.2" downgrade IK-scrambling bug (spine-editor#891) — does it still bite?

**What goes wrong:**
The new workflow tells some users (and our own fixture-acquisition path #2) to export a 4.3 rig as "Version: 4.2" for the equivalence oracle. spine-editor#891 documented IK-timeline scrambling on the 4.3→4.2 downgrade in *early betas*. If it persists in the 4.3.0 *editor*, the 4.2-dialect equivalence fixture is silently corrupted on IK rigs → the oracle (Pitfall 3 #1) validates against a poisoned reference, and we'd "prove" 4.3 correct against a wrong 4.2 baseline. Separately, post-v1.6 we no longer *need* to tell users to downgrade (4.3 is supported directly) — but the v1.5.1 viewer / older 4.2 users still might.

**Why it happens:**
SEED-003 flagged #891 as "verify against fixture before recommending to users" and it was never re-verified post-stable (the seeds predate 4.3.0). Confidence on its current status is **LOW** — it's a tracked editor issue whose stable-release status this research could not confirm from the runtime tarballs (it's an *editor* bug, not in spine-ts).

**How to avoid:**
- For the equivalence oracle, **prefer same-rig-no-IK or verify IK timelines survive the downgrade** by spot-checking the 4.2-dialect export's IK timeline keys against the 4.3 source before trusting it as a reference. If #891 still bites, build the oracle from a **non-IK** rig (bones + TransformConstraint + region/mesh — still exercises the appliedPose Pitfall-2 canary via TransformConstraint, no IK timeline).
- **De-risk by not depending on the downgrade at all:** the strongest oracle (Pitfall 3 #1) needs the *same authored motion* in two runtime dialects; if the downgrade is unsafe, author the rig *natively in 4.2* (the SIMPLE_TEST way) AND re-create the equivalent natively in 4.3, accepting "logically equivalent, not byte-identical authoring" and a looser (but still tight, ~1e-3) epsilon.
- Post-ship: the "re-export as 4.2" advisory is being *removed* (Pitfall 6) precisely because 4.3 is now first-class — which incidentally retires user exposure to #891 for the 4.3-direct path. Note this as a positive side effect in the milestone copy.

**Warning signs:**
The 4.2-dialect equivalence fixture's IK-driven attachment peaks disagree with the 4.3 export by a large margin while non-IK attachments agree (signature of a scrambled downgrade, not a port bug — don't chase it in `core/`). Any plan that depends on the editor downgrade without a #891 status check.

**Phase to address:**
Resolve during the **fixture-authoring prerequisite task** (Pitfall 9) — verify #891 status against the actual 4.3.0 editor before trusting any downgraded fixture; choose the non-IK oracle rig if unresolved. Re-cite in the **dispatcher/copy-sweep phase** as a positive side effect of removing the downgrade advisory.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip the pre-v1.6 4.2 golden-baseline snapshot ("4.2 path is obviously untouched") | Saves a phase-42 setup task | Existing paying 4.2 users silently get wrong texture sizes; no way to prove regression-free; unrecoverable trust loss | **Never** — this is the milestone's #1 blast-radius risk |
| Pass bare spine `Skeleton`/`Bone` across the runtime boundary instead of a branded handle | Less interface boilerplate | Structural-typing cross-runtime corruption that compiles (Pitfall 4); reborn `IK Constraint not found`-class misleading symptoms | **Never** in dual-runtime |
| Validate slider with a passing test but no independently-derived expected value | Slider phase "closes" faster | The one 4.3-only feature with zero cross-runtime oracle ships unverified; silent undersize on slider rigs | **Never** — closed-form expected value is mandatory (Pitfall 3 #4) |
| Use `^4.3.0` / `4.3.x` instead of exact `4.3.0` | Auto-patch pickup | Mid-milestone API drift (the `uniform`→`scaleY`→`scaleYMode` precedent proves Esoteric changes APIs in patch-shaped releases) | **Never** during the port; revisit pinning policy post-ship |
| Reuse `project_pma_no_op_in_current_stack` reasoning for the spine-webgl 4.3 GL alpha path | Skip a viewer alpha re-verify | That memory is about sharp/libvips, not GL; viewer alpha regression in host-blocked code | **Never** — re-verify GL alpha independently (Pitfall 7) |
| Skip the production-bundle smoke test (dev-mode dual-runtime works) | One less CI job | Tree-shaking/packaging drops the dynamically-dispatched 4.3 runtime; works in dev, `undefined` in the shipped app | **Never** — dev != packaged for dynamic dispatch (Pitfall 8) |
| Hand-author the 4.3 fixture instead of editor-exporting | No owner dependency / no editor needed | Rig isn't motion-realistic; can't serve as the equivalence oracle; only validates the parser, not the math | Only as the **no-editor fallback** (Pitfall 9 option 3), never as the primary oracle |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| npm package alias (two spine-core copies) | `"npm:@esotericsoftware/spine-core@^4.3.0"` + `npm install` in CI | Exact `@4.3.0`, commit lockfile, `npm ci` only, runtime-distinctness test asserting `version` differs + 4.3-only exports (`Slider`/`Pose`/`BonePose`) present only in 4.3 module |
| Vite / electron-vite bundling two same-named packages | Trust default dedupe/optimizeDeps | Explicitly exclude spine packages from dedupe; production-bundle smoke test runs the *built* worker against 4.2 + 4.3 fixtures |
| `worker_threads` sampler loading both runtimes | Eagerly `import` both at worker top → 2× memory always, even for a 4.2-only session | Dispatch decides version from detected `skeleton.spine` *before* loading; lazy/dynamic-import the chosen runtime; the path-based protocol + terminate-cancel (D-190/193/194) must stamp the runtime tag on the job so a terminate-then-respawn can't dispatch a 4.2 job to a worker holding 4.3 state |
| spine-player ↔ spine-webgl 4.3 | Assume `SpinePlayerConfig` is unchanged | Verified config surface (`rawDataURIs`, `alpha`, `backgroundColor`, `success`/`error`, `setAnimation/setViewport`) survived to 4.3.0; risk is GL alpha + internal atlas-parent-dir resolution, not signatures — re-verify rendering, not types |
| Worker-boundary serialization of skeleton data | Try to `postMessage` a spine `Skeleton`/`Bone` (now Pose-graph objects with cycles) | Already correct in this codebase (path-based protocol: worker loads from path, only `SamplerOutput`/peaks cross the boundary). **Preserve this** — do NOT start passing constructed 4.3 Pose objects across `postMessage` (structured-clone will choke on the `pose`/`appliedPose`/parent cycles) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eagerly loading both runtimes into the sampler worker | Worker RSS ~2× baseline even for 4.2-only sessions; slower worker spawn | Version-dispatch before runtime load; lazy-import only the matched runtime | Every session (constant tax), worst on low-RAM machines + complex rigs |
| 4.3 three-pose model = more allocations per bone per tick | Complex 4.3 rig samples slower than the 4.2 N2.2 wall-time contract (606 ms on `fixtures/Girl/`) | Re-run the N2.2 wall-time gate on a 4.3 rig of comparable complexity; budget for 4.3 being intrinsically heavier per tick | Large 4.3 rigs (many bones × 120 Hz × all anims/skins); regression vs the established perf contract |
| Re-sniffing skeleton version on every worker job instead of once at dispatch | Redundant JSON parse/scan per job | Dispatch stamps the runtime tag on the job once; workers never re-detect | High job throughput / many small rigs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Bumping spine-player → 4.3.0 silently widening the viewer's CSP/CORS surface | The v1.5.1 viewer needed bespoke CSP `connect-src 'app-image:'` + CORS ACAO on the protocol handler; a 4.3 player asset-resolution change could require relaxing CSP further | Re-verify the *minimal* CSP/CORS the 4.3 player needs; do not broaden `connect-src`/ACAO beyond what 4.3 actually requires; keep the protocol handler origin-scoped |
| Trusting `skeleton.spine` version string for dispatch without bounding it | A malformed/hostile version string routing to the wrong runtime or neither | Keep the existing `loader.ts` strict version-parse guard; dispatch only on a validated `major.minor`; unknown/future > 4.3 still throws `SpineVersionUnsupportedError` (narrow the guard, don't remove it — Pitfall 6) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Drop-zone still says "Spine v4.2" after 4.3 is supported | User with a 4.3 rig assumes it won't work, re-exports as 4.2 unnecessarily (or doesn't try) | Flip `App.tsx:676` copy to "v4.2 or v4.3" (or drop the qualifier) in the dispatcher phase |
| `SpineVersionUnsupportedError` message still says "re-export as Version 4.2" for a *genuinely* unsupported version (e.g. future 4.4) | Future-version user told to do the wrong thing | Split the message: 4.3 no longer hits this; truly-unsupported (pre-4.2 / >4.3 / malformed) gets a version-accurate message |
| Documentation Builder HTML emits "supports Spine 4.2" into user-shared docs | Animators' shared documentation misstates capability indefinitely | Audit + flip the DocBuilder template/copy in the copy-sweep (Pitfall 6 table) |
| A 4.3 rig that uses an *unsupported-by-us* 4.3 construct fails with a cryptic deep-spine-core error (SEED-003's original symptom class) | Misleading failure, support burden | If any 4.3 construct is out of scope, detect it explicitly at load (mirror the `checkSpine43Schema` predicate pattern) and throw a *specific, actionable* error — never let it reach spine-core's generic throw |

## "Looks Done But Isn't" Checklist

- [ ] **4.3 support:** Often missing the `appliedPose` read — verify the SIMPLE_TEST `TransformConstraint`-on-`SQUARE` peak matches between 4.2 and the 4.3-via-adapter path (Pitfall 2/3)
- [ ] **4.2 regression gate:** Often missing the *pre-v1.6* baseline (captured after the refactor = useless) — verify the golden snapshot commit predates the alias add (Pitfall 5)
- [ ] **Dual type universe:** Often missing the no-co-mingled-imports arch test — verify no file imports both alias specifiers and no bare `Skeleton` crosses the runtime boundary (Pitfall 4)
- [ ] **npm alias:** Often missing the runtime-distinctness assertion — verify `adapter42.version !== adapter43.version` and `Slider`/`BonePose` present only in the 4.3 module, *from the production build* (Pitfall 8)
- [ ] **Reject-message flip:** Often missing the inverted predicate tests + DocBuilder + drop-zone copy — verify `git grep -i "version 4.2\|re-export"` is clean in renderer/docs and the 6 guard-test files assert dispatch not throw, with pre-4.2/future-version throw-cases preserved (Pitfall 6)
- [ ] **Slider:** Often missing the closed-form expected value — verify the slider test asserts an independently-derived peak, not a self-referential "it runs" value (Pitfall 3 #4 / Pitfall 9)
- [ ] **Viewer:** Often missing GL alpha re-verification — verify SIMPLE_TEST renders in the 4.3 player with no alpha halo and the 5 carried Phase 41 UATs re-run green (Pitfall 7)
- [ ] **CI matrix:** Often missing the *fresh-clone* 4.3 path (only works locally with proprietary fixtures) — verify CI runs a committed in-repo 4.3 fixture, not an `it.skipIf` (Pitfall 9)
- [ ] **Worker memory:** Often missing lazy runtime load — verify a 4.2-only session does not load the 4.3 runtime into the worker

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ported against stale SEED-006 (wrong arg order / `scaleY` / `bone.pose`) | MEDIUM | Re-derive from the verified mapping table (top of this doc); the equivalence oracle (Pitfall 3 #1) localizes the wrong reads — fix in the adapter, single layer |
| 4.2 regression shipped (no baseline existed) | HIGH | If no pre-v1.6 baseline was captured, recovery requires reconstructing it from a pre-v1.6 git tag/checkout, re-running the old sampler, and diffing — possible but slow; prevention (capture first) is ~100× cheaper |
| Cross-runtime structural-typing corruption | MEDIUM | Add the branded handle + no-co-mingled-imports arch test retroactively; tsc + the new test surface every existing mix site |
| spine-player 4.3 viewer regression | MEDIUM | Viewer is modal-isolated (`AnimationPlayerModal.tsx`); worst case revert spine-player to 4.2.111 (decoupled from spine-core alias) and ship dual-runtime sampler without the viewer bump — viewer bump is a *separable* phase by design |
| No redistributable 4.3 fixture at slider-phase start | HIGH (blocks the phase) | Owner exports the minimal rig from the Spine editor (Pitfall 9 #1/#2); no engineering workaround — schedule the owner task early so it's off the critical path |
| spine-editor#891 poisoned the equivalence fixture | LOW | Switch the oracle rig to non-IK (TransformConstraint still exercises the appliedPose canary); re-author natively-in-4.2-and-4.3 with a looser epsilon |

## Pitfall-to-Phase Mapping

Recommended phase shape (phases continue from v1.5.1 at **Phase 42**):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 5. 4.2 regression / 8. npm-alias traps | **Phase 42 — Alias + Baseline + Boundary Scaffolding** (lockfile-pinned alias; pre-v1.6 4.2 golden snapshot captured *before* the alias; runtime-distinctness test; production-bundle CI smoke; no-co-mingled-imports arch test) | Byte-equal 4.2 snapshot stays green through every later phase; `adapter42.version !== adapter43.version` from the built artifact |
| 1. Beta-vs-stable drift / 2. wrong-pose undersize / 4. dual type universe | **Phase 43 — Runtime-Adapter Interface + Verified API Mapping** (branded handle; 4.3 impl written against the verified table in this doc; `appliedPose`-only world reads; two-namespace module split) | tsc clean; adapter unit tests; this document's mapping table is the acceptance reference |
| 3. no oracle / 9. fixture blocker / 10. editor#891 | **Phase 44 — 4.2↔4.3 Equivalence Oracle + 4.3 Fixture Authoring** (owner exports SIMPLE_TEST as 4.3 + 4.2 dialects + minimal slider rig; same-rig cross-runtime byte/epsilon diff; #891 status check) | SIMPLE_TEST 4.3-via-adapter `globalPeaks` ≈ 4.2 within 1e-4; committed in-repo 4.3 fixture; CI runs it on fresh clone |
| 6. stale reject-message surfaces | **Phase 45 — Dispatcher Flip + Copy/Docs Sweep** (`checkSpine43Schema` rejecter→dispatcher; invert 6 guard-test files preserving pre-4.2/future throw-cases; drop-zone + errors + DocBuilder copy via the Pitfall-6 table) | 4.3 fixture loads + samples (no throw); `git grep -i "version 4.2\|re-export"` clean in renderer/docs; future-version still throws |
| 3 #4. slider oracle / PORT-03 | **Phase 46 — Slider Constraint Validation** (slider timeline propagation via `updateWorldTransform`; closed-form expected peak from the hand-designed slider rig) | Slider peak == independently-derived analytical value; slider rig samples through the unchanged `Physics.update` path |
| 7. spine-player viewer regression | **Phase 47 — spine-player 4.3 Bump + Viewer Regression** (sequenced last; separable/revertible) | All 5 carried Phase 41 HUMAN-UATs re-run on the 4.3 player; SIMPLE_TEST renders with no alpha halo |

**Phase-ordering rationale:** Phase 42 *must* be first — you cannot baseline 4.2 behavior after the refactor changes it, and the alias/boundary scaffolding gates everything. Phase 43 is the verified-mapping core (this research is its input). Phase 44 builds the oracle before any 4.3-feature phase can be trusted (and unblocks the owner fixture task early). Phase 45 flips the user-facing reject only after the 4.3 path actually works. Phase 46 (slider) needs the Phase-44 fixture + oracle. Phase 47 (viewer) is deliberately last and revertible so a player-bump regression can't block the sampler port from shipping.

## Sources

- `@esotericsoftware/spine-core@4.3.0` npm tarball — `dist/*.d.ts` (the exact type surface an alias installs): `Skeleton.d.ts`, `Slot.d.ts`, `SlotPose.d.ts`, `Bone.d.ts`, `BonePose.d.ts`, `Posed.d.ts`, `PosedActive.d.ts`, `Pose.d.ts`, `AnimationState.d.ts`, `attachments/Attachment.d.ts`, `attachments/RegionAttachment.d.ts`, `Slider.d.ts`, `SliderData.d.ts`, `IkConstraintData.d.ts`, `IkConstraintPose.d.ts`, `Physics.d.ts`, `SkeletonJson.js`, `SkeletonData.d.ts`, `index.d.ts` — verified 2026-05-16 (HIGH)
- `@esotericsoftware/spine-player@4.3.0` npm tarball — `dist/Player.d.ts` `SpinePlayerConfig` surface; `package.json` (`@esotericsoftware/spine-webgl@4.3.0` dep) — verified 2026-05-16 (HIGH)
- `npm view @esotericsoftware/spine-core@latest` / `dist-tags` / `versions` — `4.3.0` latest, no `4.3.x-beta` npm tags, jumps `4.2.116`→`4.3.0` — verified 2026-05-16 (HIGH)
- This project's source — `src/core/loader.ts`, `src/core/errors.ts`, `src/core/sampler.ts`, `src/core/bounds.ts`, `src/main/sampler-worker.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/modals/AnimationPlayerModal.tsx`, `tests/arch.spec.ts`, 6 reject-assertion test files — grep-verified call sites 2026-05-16 (HIGH)
- `.planning/seeds/SEED-006`, `.planning/seeds/SEED-003`, `.planning/PROJECT.md`, `CLAUDE.md`, `.gitignore` — locked decisions + beta-built inventory (the drift this research falsifies) (HIGH for project facts)
- [spine-editor#891 — IK timeline scrambling on 4.3→4.2 downgrade](https://github.com/EsotericSoftware/spine-editor/issues/891) — stable-release status NOT re-verifiable from runtime tarballs (LOW — flagged for explicit check during fixture authoring)

---
*Pitfalls research for: dual-runtime Spine 4.2 + 4.3 peak-render-scale port (v1.6)*
*Researched: 2026-05-16*
