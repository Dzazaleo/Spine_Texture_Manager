---
phase: 10
plan: 01
subsystem: build-foundation
tags:
  - electron-builder
  - npm-scripts
  - version-bump
  - phase-10
requirements:
  - DIST-07
dependency_graph:
  requires: []
  provides:
    - "package.json#version=1.1.0-rc1 (DIST-07 filename + Info.plist substitution token)"
    - "package.json#scripts: build, build:mac, build:win, build:linux, build:dry (DIST-01/02/03 entry points)"
    - "build/ directory (electron-builder.yml directories.buildResources resolves)"
  affects:
    - "Plan 10-02 (electron-builder.yml shape) — relies on these scripts existing"
    - "Plan 10-03 (smoke test recipes) — invokes npm run build:{platform}"
    - "Phase 11 (CI build pipeline) — workflow runs the same npm scripts"
tech_stack:
  added: []
  patterns:
    - "0-byte .gitkeep sentinel (mirrors scripts/.gitkeep convention exactly)"
    - "Per-platform npm script naming: build:{mac|win|linux} keyed to electron-builder --{platform} flag"
    - "Generic build script picks host-default targets (electron-builder without --mac/--win/--linux)"
key_files:
  created:
    - "build/.gitkeep (0 bytes; sentinel only)"
  modified:
    - "package.json (version + scripts blocks; deps/devDeps/engines bit-identical)"
decisions:
  - "Version string: 1.1.0-rc1 (per RESEARCH.md Open Question #2 recommendation; -rc1 suffix is the explicit signal that this is a release candidate, not a final release per T-10-01 mitigation)"
  - "Generic build script generalized from --mac dmg to no flag — picks host-default targets so a contributor on Windows can run npm run build without forcing macOS"
  - "build:dry preserved verbatim (still --mac dmg --dir) — it's a developer-convenience script, not a release entry point"
  - "build/.gitkeep is 0 bytes (no header/comment) to match scripts/.gitkeep verbatim — verified byte-count diff identical"
metrics:
  duration: "~5 minutes wall time"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 2
  commits: 2
---

# Phase 10 Plan 01: Build Foundation Summary

Bumped `package.json#version` from `0.0.0` to `1.1.0-rc1`, added three per-platform `build:{mac|win|linux}` npm scripts, generalized the legacy `build` script to host-default targets, and created `build/.gitkeep` as a 0-byte sentinel so `electron-builder.yml`'s `directories.buildResources: build` reference resolves.

## What was built

### Task 1 — `package.json` edits (commit `2ec4364`)

Two surgical edits to `package.json`:

1. **`version`:** `0.0.0` → `1.1.0-rc1`
2. **`scripts`:** generalized `build` and inserted three new keys

Final `scripts` block:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "npm run typecheck:node && npm run typecheck:web",
  "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
  "typecheck:web": "tsc --noEmit -p tsconfig.web.json",
  "cli": "tsx scripts/cli.ts",
  "dev": "electron-vite dev",
  "build": "electron-vite build && electron-builder",
  "build:mac": "electron-vite build && electron-builder --mac dmg",
  "build:win": "electron-vite build && electron-builder --win nsis",
  "build:linux": "electron-vite build && electron-builder --linux AppImage",
  "build:dry": "electron-vite build && electron-builder --mac dmg --dir",
  "preview": "electron-vite preview"
}
```

Diff vs. pre-edit:

- `build` was `electron-vite build && electron-builder --mac dmg`; now drops the `--mac dmg` so the generic invocation picks host-default targets.
- `build:mac` (new): inherits the OLD `build` value verbatim — `electron-vite build && electron-builder --mac dmg`.
- `build:win` (new): `electron-vite build && electron-builder --win nsis`.
- `build:linux` (new): `electron-vite build && electron-builder --linux AppImage`.
- `build:dry` preserved bit-for-bit (still `--mac dmg --dir`).

**No-touch zones confirmed bit-identical to pre-edit (captured both pre and post):**

- `dependencies` keys: `["@esotericsoftware/spine-core","@fontsource/jetbrains-mono","@tanstack/react-virtual","maxrects-packer","react","react-dom","sharp"]`
- `devDependencies` keys: `["@electron-toolkit/tsconfig","@tailwindcss/vite","@testing-library/jest-dom","@testing-library/react","@testing-library/user-event","@types/node","@types/react","@types/react-dom","@vitejs/plugin-react","clsx","electron","electron-builder","electron-vite","jsdom","tailwindcss","tsx","typescript","vitest"]`
- `engines`: `{"node":">=18"}`
- `name`, `private`, `type`, `main`, `description` — unchanged.

### Task 2 — `build/.gitkeep` sentinel (commit `6122c61`)

Created `build/` at repo root and placed an empty `.gitkeep` inside it:

```
$ wc -c < build/.gitkeep
0
$ wc -c < scripts/.gitkeep
0
```

Byte-count identical to `scripts/.gitkeep` — analog match. File staged and tracked by git.

**Why:** `electron-builder.yml` line 11 declares `directories.buildResources: build`. The directory must exist on disk so future YAML edits (e.g., `build/icon.icns` for branding, or `build/entitlements.mac.plist` if Phase 11/12 needs hardened-runtime entitlements) don't fail noisily — RESEARCH.md Pitfall 4. One-line insurance, costs nothing.

## Acceptance criteria — all green

### Task 1 (package.json)

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c '"version": "1.1.0-rc1"' package.json` | `1` | `1` |
| `grep -c '"build:mac": "electron-vite build && electron-builder --mac dmg"' package.json` | `1` | `1` |
| `grep -c '"build:win": "electron-vite build && electron-builder --win nsis"' package.json` | `1` | `1` |
| `grep -c '"build:linux": "electron-vite build && electron-builder --linux AppImage"' package.json` | `1` | `1` |
| `grep -c '"build": "electron-vite build && electron-builder"' package.json` | `1` | `1` |
| `grep -c '"build:dry": "electron-vite build && electron-builder --mac dmg --dir"' package.json` | `1` | `1` |
| `grep -c '"version": "0.0.0"' package.json` | `0` | `0` |
| `node -e "...JSON.parse(...).version"` | `1.1.0-rc1` | `1.1.0-rc1` |
| All 10 required script keys present | `OK` | `OK` |
| dependencies/devDependencies/engines bit-identical | identical | identical (verified pre+post) |
| `npm run build:mac` does not error with `Missing script` | confirmed | confirmed (vite started transforming, no npm-level error) |

### Task 2 (build/.gitkeep)

| Check | Expected | Actual |
|-------|----------|--------|
| `test -d build` | exit 0 | exit 0 |
| `test -f build/.gitkeep` | exit 0 | exit 0 |
| `wc -c < build/.gitkeep` | `0` | `0` |
| `find build -type f -not -name '.gitkeep' \| wc -l` | `0` | `0` |
| `git ls-files build/.gitkeep \| wc -l` | `1` | `1` |
| Byte-count matches scripts/.gitkeep | identical | identical |

### Plan-level verification

| Check | Result |
|-------|--------|
| `node -e "...console.log(...version)"` prints `1.1.0-rc1` | PASS |
| `npm run build:mac` does not error `Missing script` | PASS (vite started, electron-builder reachable) |
| `build/` exists with 0-byte `.gitkeep` | PASS |
| `git diff --stat HEAD~2` shows only `package.json` + `build/.gitkeep` changed | PASS (`5 insertions, 2 deletions` package.json; `0 bytes` build/.gitkeep) |
| `npm run test` exits 0 | PASS — 30 test files, 331 passed, 1 skipped, 1 todo |

## Deviations from Plan

None — plan executed exactly as written. No deviation rules triggered.

## Threat surface scan

Plan declared the following threats; all dispositions held:

- **T-10-01 (Tampering, accept):** `-rc1` suffix is the explicit release-candidate signal. Held — version string is exactly `1.1.0-rc1`, not `1.1.0`.
- **T-10-02 (Information Disclosure, mitigate):** Acceptance criteria forbade touching keys other than `version` and `scripts`; new script values reference only `electron-vite` and `electron-builder` CLIs (no fixture paths, no env-var interpolation). Held — verified by post-edit deps/devDeps/engines diff (bit-identical).
- **T-10-03 (Tampering, accept):** `build/.gitkeep` is 0 bytes (asserted in acceptance criteria, verified). Held.
- **T-10-04 (Spoofing, accept):** No new dependencies added. Held — pre vs. post `dependencies` and `devDependencies` key sets identical.

No new security-relevant surface introduced beyond the threat model already in the plan. No threat flags to add.

## Known stubs

None — this is a configuration plan, no UI/data wiring.

## Commits

| Task | Hash | Type | Subject |
|------|------|------|---------|
| 1 | `2ec4364` | feat | bump version to 1.1.0-rc1 + add per-platform build scripts |
| 2 | `6122c61` | chore | add build/.gitkeep sentinel for electron-builder buildResources |

## Files changed

| File | Status | Lines |
|------|--------|-------|
| `package.json` | modified | +5 / -2 |
| `build/.gitkeep` | created | 0 bytes |

## Self-Check: PASSED

- File `package.json` exists and contains `"version": "1.1.0-rc1"` — FOUND
- File `build/.gitkeep` exists and is 0 bytes — FOUND
- Commit `2ec4364` exists in `git log --oneline` — FOUND
- Commit `6122c61` exists in `git log --oneline` — FOUND
- All 333 vitest tests pass (331 passed + 1 skipped + 1 todo) — verified
