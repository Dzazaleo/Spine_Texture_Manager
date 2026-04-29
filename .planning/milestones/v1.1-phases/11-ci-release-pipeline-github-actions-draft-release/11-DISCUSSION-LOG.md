# Phase 11: CI release pipeline (GitHub Actions → draft Release) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 11-ci-release-pipeline-github-actions-draft-release
**Areas discussed:** (none — user delegated decisions to Claude after phase analysis)

---

## Discussion mode

After Claude analyzed the phase boundary and presented six gray areas (consolidated to four after the AskUserQuestion option-count guardrail), the user selected **"I'll let you decide, let's go to planning phase"** — declining interactive discussion and delegating all gray-area resolution to Claude's discretion.

All decisions in 11-CONTEXT.md were made by Claude based on:
- Phase 11 success criteria from ROADMAP.md (especially CI-05 all-or-nothing semantics).
- Phase 10 input contract (`10-SMOKE-TEST.md`, `electron-builder.yml`, `package.json#scripts`).
- Phase 10 RESEARCH.md pitfall analysis (sharp host-arch trap, Apple Silicon cross-build fragility, Ubuntu 24.04 libfuse2t64 rename).
- Project-level constraints (no paid certs in v1.1; Linux verified via CI only).
- Standard GitHub Actions patterns for tag-triggered multi-platform builds with atomic release publication.

---

## Gray areas Claude identified (presented but not interactively answered)

### Publish strategy (atomicity)
| Option | Selected |
|--------|----------|
| Each build job uploads directly to draft release as it finishes | |
| Build jobs emit GHA artifacts; final publish job creates draft atomically | ✓ (Claude — D-02) |

**Rationale:** CI-05 requires all-or-nothing publication. Direct-upload risks a partial release if a later job fails. Artifact-upload + final publish job makes atomicity trivially correct.

### Runner OS pinning + dry-run shape
| Decision | Choice |
|----------|--------|
| macOS runner | `macos-14` (arm64; matches DIST-02) (D-06) |
| Windows runner | `windows-2022` (D-06) |
| Linux runner | `ubuntu-22.04` (libfuse2 not yet renamed) (D-06) |
| Test runner | `ubuntu-latest` (no native deps) (D-06) |
| `workflow_dispatch` shape | Same workflow with `if:` guard skipping publish (D-04) |

**Rationale:** Pinning gives reproducibility. Single workflow with conditional publish is simpler than maintaining two files.

### Tag ↔ package.json version
| Option | Selected |
|--------|----------|
| Fail-fast guard step on mismatch | ✓ (Claude — D-08) |
| Auto-bump `package.json` from tag at build time | |
| Trust manual sync convention | |

**Rationale:** Fail-fast prevents broken artifacts from ever being built. Auto-bump desyncs git history from artifact filenames. Phase 10 already established the manual-bump-then-tag discipline.

### Release notes template
| Option | Selected |
|--------|----------|
| Hardcoded template in workflow YAML | |
| `.github/release-template.md` file with `${VERSION}` placeholders | ✓ (Claude — D-11) |
| Parsed `CHANGELOG.md` section | |

**Rationale:** Stable repo file is editable without touching workflow YAML. CHANGELOG.md doesn't exist yet and adding one is scope creep for Phase 11.

---

## Claude's Discretion

User delegated entire phase to Claude's discretion. Five areas explicitly flagged in CONTEXT.md as ongoing discretion (YAML formatting, step ordering, action SHA pinning, composite-action factoring, exact template prose).

## Deferred Ideas

- Source-map upload (Phase 13).
- `latest.yml` auto-update feed (Phase 12).
- Code-signing in CI (out of v1.1).
- Per-platform smoke-launch in CI (manual recipe is the verification surface).
- Universal macOS binary (out of scope).
- `release-drafter` auto-generation from commits.
