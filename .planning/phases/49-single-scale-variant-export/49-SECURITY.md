# SECURITY.md — Phase 49: Single-Scale Variant Export

**Phase:** 49 — single-scale-variant-export
**ASVS Level:** 1
**Audited:** 2026-05-24
**Auditor:** gsd-security-auditor (claude-sonnet-4-6)
**Plans audited:** 49-01, 49-02, 49-03
**Block threshold:** high

---

## Verdict: SECURED

**Threats Closed:** 6/6
**Open (blockers):** 0
**Unregistered flags:** 0

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-49-DIR | Tampering / Elevation (path traversal) | mitigate (main) / accept (renderer leg) | CLOSED | See detail below |
| T-49-SRC | Tampering (source-byte integrity) | mitigate (main) / accept (renderer) | CLOSED | See detail below |
| T-49-ROLLBACK | DoS / Integrity (orphan artifacts) | mitigate | CLOSED | See detail below |
| T-49-DOS-S | DoS (degenerate scale) | mitigate | CLOSED | See detail below |
| T-49-FAITH | Spoofing (wrong-size package) | mitigate (verification) | CLOSED | See detail below |
| T-49-FIXLEAK | Integrity (CI denylist regression) | accept (no new dir) | CLOSED | See detail below |

---

## Per-Threat Evidence

### T-49-DIR — Path Traversal / Tampering

**Claimed mitigation:** `{NAME}` derived via `basename(summary.skeletonPath)` so `../` cannot survive; reject empty or `:` bearing NAME; writes only under user-chosen `parentDir` via `join(parentDir, ...)`; reuse source-collision guard. Renderer leg: picker-only, accepted.

**Main-side verification — CLOSED:**

- `src/main/variant-export.ts:142` — `const NAME = basename(summary.skeletonPath).replace(/\.json$/i, '');` — `basename` strips all directory components; no `../` can survive.
- `src/main/variant-export.ts:143` — `if (!NAME || NAME.includes(':'))` — empty and colon-bearing names rejected before any I/O.
- `src/main/variant-export.ts:152` — `const outDir = join(parentDir, \`${NAME}@${formatScaleToken(s)}x\`);` — write target is `join(parentDir, ...)` only; no user-controlled directory traversal beyond the basename token.
- `src/main/variant-export.ts:212-229` — source-collision guard reused: `pathResolve(outDir) === pathResolve(sourceImagesDir)` returns `invalid-out-dir` before any write. Guard applies to `plan.rows[0] ?? plan.passthroughCopies[0]` (WR-04 fix covers the passthrough-only case).
- `tests/main/variant-package-layout.spec.ts:67-68` — imports `formatScaleToken` by name; asserts folder token equals `{NAME}@{formatScaleToken(0.5)}x` (V3, clean basenames, no `@` on inner files).

**Renderer-leg accept — CLOSED:** `src/renderer/src/components/AppShell.tsx:858-891` — `onConfirmStartVariant` calls only `pickOutputDir(startPath)` (native OS folder picker) and `setLastOutDir(picked)`. It writes nothing; it contains zero `exportDialogState` / `setExportDialogState` references (verified grep at line 863 — keyed to `variantDialogState` only). The renderer cannot enforce path containment and this is the documented accepted boundary.

---

### T-49-SRC — Source-Byte Integrity

**Claimed mitigation:** `bake()` clones first (source object never mutated); source path is `readFile`'d only, never written; only new write is the baked variant JSON in a NEW subfolder. Renderer performs zero fs writes (accepted).

**Main-side verification — CLOSED:**

- `src/core/scale-bake.ts:44` — `const clone = (o: SkeletonJsonRaw): SkeletonJsonRaw => JSON.parse(JSON.stringify(o));` — clone-first discipline; `bake()` operates on the clone, never the input.
- `src/main/variant-export.ts:162` — `sourceJson = JSON.parse(await readFile(summary.skeletonPath, 'utf8'));` — source path is `readFile`'d only.
- `src/main/variant-export.ts:176` — `baked = bake(sourceJson, s) as Record<string, unknown>;` — the baked object is the clone; `sourceJson` is never passed to any write call.
- `src/main/skeleton-json-writer.ts:41-46` — only the `finalPath` under `{NAME}@{s}x/` is written; the source path is never an argument.
- `tests/main/variant-source-immutable.spec.ts:54-75` (V2) — sha256 of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` asserted byte-identical before/after a full `handleExportVariant` run.
- `tests/main/variant-source-immutable.spec.ts:77-82` (V2) — `JSON.stringify(srcObj)` asserted unchanged after `bake(srcObj, 0.5)`.

**Renderer-leg accept — CLOSED:** Renderer performs zero fs writes. `onConfirmStartVariant` opens a picker only (confirmed: `AppShell.tsx:858-891`).

---

### T-49-ROLLBACK — Orphan Artifacts

**Claimed mitigation:** Baked JSON registered in the SAME `written` Set as textures, written FIRST inside the shared `try`; any downstream throw triggers `catch` sweep (`fsRm` force) over every entry including the JSON.

**CLOSED:**

- `src/main/skeleton-json-writer.ts:42-43` — `written.add(tmpPath)` and `written.add(finalPath)` both called BEFORE `writeFile(tmpPath, ...)`. Register-before-write discipline ensures rollback set is complete even on a half-landed write.
- `src/main/variant-export.ts:251` — `await writeSkeletonJsonAtomic(join(outDir, \`${NAME}.json\`), baked, written, overwrite)` called FIRST inside the `try` block (line 244 opens the try; line 251 is the first `await` inside it).
- `src/main/variant-export.ts:304-311` — `catch (innerErr)`: `for (const p of written) await fsRm(p, { force: true }).catch(() => {})` — sweeps every entry in the shared set including the JSON `finalPath` and `tmpPath`.
- `tests/main/variant-package-layout.spec.ts:328-380` (V4) — oversize forced via `maxPageSize: 64` (below smallest scaled region); asserts `res.ok === false` and `fs.existsSync(path.join(outDir, 'SIMPLE_TEST.json'))` is `false`; asserts no partial artifacts survive.

---

### T-49-DOS-S — Degenerate Scale

**Claimed mitigation:** D-08 guard rejects NaN / `s <= 0` / `s >= 1` FIRST (before any fs read/write or bake) with a typed `VariantScaleError`. Renderer disables Export as defense-in-depth (not the gate).

**CLOSED:**

- `src/main/variant-export.ts:96-98` — `if (!Number.isFinite(s) || s <= 0 || s >= 1) return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };` — this is step 1 of `exportOneVariant`, before any `readFile`, `bake`, or `mkdir` call.
- `src/core/errors.ts:228-236` — `VariantScaleError` typed error class with `.name = 'VariantScaleError'` and `.message` containing `'Variants are scaled-down only (0 < scale < 1)'`.
- `tests/main/variant-scale-guard.spec.ts:50-73` (V5) — rejects `s` in `[1.0, 2.0, 0, NaN, -0.5]` with the `GUARD_MESSAGE_FRAGMENT` in the error message; asserts `bake(minimal, 1.0)` does not throw (core stays direction-agnostic, D-09 preserved).
- `src/renderer/src/modals/VariantDialog.tsx:219-220` — `const isRowInvalid = (r: VariantRow) => { if (!Number.isFinite(r.scale) || r.scale <= 0 || r.scale >= 1) return true; ...` — renderer pre-check disables Export button (defense-in-depth, not the gate).

---

### T-49-FAITH — Spoofing (Package Loads but Renders Wrong)

**Claimed mitigation:** V6 samples the LOADED variant package and asserts `s×` world-AABB equivalence to the master — catches a package that loads but renders at the wrong size.

**CLOSED:**

- `tests/main/variant-dropin-faithful.spec.ts` — dual-runtime co-import (`@esotericsoftware/spine-core` and `spine-core-42`); imports `loadSkeleton` for cross-resolve assertion.
- Assertion (a): Phase-48 geometry oracle reused — `parse(bake(orig, s), scale=1)` field-identical to `parse(orig, SkeletonJson.scale=s)` via `fieldMismatches` deep-compare.
- Assertion (b): `loadSkeleton({ skeletonPath: ..., atlasPath: ... })` on the written `{NAME}@{s}x/` package — must not throw; confirms atlas cross-resolve.
- Assertion (c): `computeWorldVertices` / `updateWorldTransform` sampler path — per-attachment world-AABB ratios asserted `≈ s×` master via `toBeCloseTo`; corroborated by `load.runtime` adapter aggregate (version-agnostic, sidesteps 4.2/4.3 API divergence). Dual-runtime matrix covers 4.2 (SIMPLE_TEST) and 4.3 (SLIDER-01).
- Per 49-03-SUMMARY: 8 tests green on both runtimes.

---

### T-49-FIXLEAK — CI Denylist Regression

**Claimed mitigation:** Phase 49 commits no new fixture dir (reuses SIMPLE_PROJECT + SLIDER_4_3, both already tracked; SLIDER_4_3 already in `SAFE01_EXCLUDED_PREFIXES`). No `tests/safe01/discover-fixtures.ts` edit needed.

**CLOSED (accepted risk, no new surface):**

- `git diff --name-only 6b08e94..bd2df8a` (the Phase 49 commit range) — zero files under `fixtures/` were added or modified. Confirmed: no new fixture dir committed.
- `tests/safe01/discover-fixtures.ts:119-121` — `SAFE01_EXCLUDED_PREFIXES` includes `'fixtures/SLIDER_4_3/'` (already present before Phase 49). No edit was made to this file by Phase 49.
- The accepted-risk assertion holds: the SAFE-01 frozen-enumeration gate is untouched.

---

## Unregistered Flags

None. All threat flags in the SUMMARY.md `## Threat Flags` sections of the three plans map to the six registered threat IDs above. No new attack surface was detected during implementation that lacks a threat mapping.

---

## Accepted Risks Log

| Risk | Accepted By | Rationale |
|------|-------------|-----------|
| T-49-DIR renderer leg: native OS picker cannot enforce path containment | PLAN (49-02 threat model) | The OS dialog is the containment mechanism at the renderer boundary; the authoritative guard is main-side (basename strip + colon reject + source-collision guard). Defense-in-depth boundary is correctly placed. |
| T-49-SRC renderer leg: renderer performs zero fs writes | PLAN (49-02 threat model) | By construction: `onConfirmStartVariant` opens a picker only, no renderer code path writes any file. |
| T-49-FIXLEAK: no new fixture dir | PLAN (49-03 threat model) | Verified by git diff of the Phase 49 commit range; SLIDER_4_3 pre-exists in the denylist. |
