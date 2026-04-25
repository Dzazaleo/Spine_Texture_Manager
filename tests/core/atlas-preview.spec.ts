/**
 * Phase 7 — specs for the pure-TS atlas-preview projection builder.
 *
 * Cases per .planning/phases/07-atlas-preview-modal/07-CONTEXT.md
 * <decisions> "Tests" lines 46-47:
 *   (a) SIMPLE_TEST Original @ 2048 → all 3 regions fit in 1 page;
 *       pages.length === 1; efficiency in expected range. [D-124, F7.1]
 *   (b) SIMPLE_TEST Optimized @ 2048 → same regions but at outW/H;
 *       efficiency strictly higher than Original. [D-125, F7.1]
 *   (c) Override 50% on TRIANGLE → Optimized projection's TRIANGLE region
 *       has expected packed dims. [D-125 + D-111, F7.1]
 *   (d) Ghost-fixture → GHOST excluded from BOTH modes. [D-109 parity, F7.1]
 *   (e) Atlas-packed fixture → BEFORE uses atlasSource.w/h, not page dims. [D-126]
 *   (f) Multi-page projection at small page cap → pages.length > 1. [D-128]
 *   (g) Math.ceil-thousandth on Optimized dims matches Phase 6 D-110 Round 5. [D-125]
 *   (h) Hygiene grep — no fs/sharp/electron imports in
 *       src/core/atlas-preview.ts. [CLAUDE.md #5, Layer 3]
 *
 * Plus the Layer 3 inline-copy parity describe block (Phase 4 D-75 / Phase 6
 * D-108 precedent) locking src/core/atlas-preview.ts ↔ src/renderer/src/lib/
 * atlas-preview-view.ts byte-identity on representative inputs.
 *
 * Wave 0 status: this file is RED. Plan 02 (Wave 2) implements
 * src/core/atlas-preview.ts + src/renderer/src/lib/atlas-preview-view.ts and
 * fills these `it.todo` slots with real assertions.
 */
import { describe, it } from 'vitest';

describe('buildAtlasPreview — case (a) Original @ 2048 (D-124, F7.1)', () => {
  it.todo('SIMPLE_TEST → 3 regions fit in 1 page; efficiency in expected range');
});

describe('buildAtlasPreview — case (b) Optimized @ 2048 (D-125, F7.1)', () => {
  it.todo('SIMPLE_TEST → same regions at outW/H; efficiency > Original');
});

describe('buildAtlasPreview — case (c) Override 50% on TRIANGLE (D-125 + D-111, F7.1)', () => {
  it.todo('Optimized projection TRIANGLE region packed at half source dims');
});

describe('buildAtlasPreview — case (d) Ghost-fixture excluded from both modes (D-109, F7.1)', () => {
  it.todo('SIMPLE_TEST_GHOST → GHOST attachment absent from Original AND Optimized projections');
});

describe('buildAtlasPreview — case (e) Atlas-packed BEFORE uses atlasSource.w/h (D-126)', () => {
  it.todo('Synthesized atlas-packed fixture: BEFORE input dims = atlasSource.w/h, not page dims');
});

describe('buildAtlasPreview — case (f) Multi-page at small cap (D-128)', () => {
  it.todo('SIMPLE_TEST at maxPageDim=128 → pages.length > 1; deterministic split');
});

describe('buildAtlasPreview — case (g) Optimized dims match Phase 6 D-110 ceil-thousandth (D-125)', () => {
  it.todo('Optimized projection outW/outH equals buildExportPlan Phase 6 ceil-thousandth output');
});

describe('atlas-preview — module hygiene (Layer 3 lock, CLAUDE.md #5)', () => {
  it.todo('no node:fs / node:path / node:child_process / node:net / node:http imports');
  it.todo('no sharp import');
  it.todo('no electron import');
  it.todo('no DOM references (document., window., HTMLElement)');
  it.todo('exports buildAtlasPreview by name');
});

describe('atlas-preview — core ↔ renderer parity (Layer 3 inline-copy invariant, Phase 4 D-75 / Phase 6 D-108)', () => {
  it.todo('renderer view exports buildAtlasPreview by name');
  it.todo('renderer copy has ZERO imports from src/core/* (Layer 3 invariant)');
  it.todo('renderer copy uses sibling export-view.js for buildExportPlan (NOT core/export.js)');
  it.todo('both files share the same MaxRectsPacker construction (D-132 hardcoded params: 2px padding, no rotation, smart, pot:false, square:false)');
  it.todo('renderer view buildAtlasPreview produces IDENTICAL projection to canonical for representative inputs');
});

describe('buildAtlasPreview — case (h) D-127 metrics surface (F7.2)', () => {
  it.todo('projection.totalPages and pages[i].efficiency are populated; no bytes field anywhere on the shape');
});
