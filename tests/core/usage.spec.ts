/**
 * Phase 5 Plan 01 — Tests for src/core/usage.ts (F6.1, D-92, D-93, D-95, D-96, D-98, D-100, D-107).
 *
 * Behavior gates:
 *   - (a) SIMPLE_TEST baseline: findUnusedAttachments returns [] — every
 *     CIRCLE / SQUARE / TRIANGLE renders in at least one animation tick.
 *   - (b) SIMPLE_TEST_GHOST: returns exactly 1 row { attachmentName: 'GHOST',
 *     sourceW: 64, sourceH: 64, definedIn: ['default'], dimVariantCount: 1,
 *     sourceLabel: '64×64', definedInLabel: 'default' } — D-95 ghost-def.
 *   - (c) Cross-skin D-93 (in-memory synthetic): 'HEAD' visible in skin A,
 *     registered-but-not-rendered in skin B → NOT flagged (one skin renders
 *     it, so the name-level set difference drops it from the unused set).
 *   - (d) Dim divergence D-98 (in-memory): 'HEAD' unused in 2 skins at
 *     128×128 and 256×256 → 1 row with max dims, dimVariantCount=2,
 *     sourceLabel '256×256 (2 variants)', definedIn in skin-iteration order.
 *   - (e) Alpha-zero D-92 (in-memory): attachment registered but no sampler
 *     entry for (skin, slot, attachment) → flagged as unused (the sampler's
 *     alpha>0 predicate is the source of truth; absence from globalPeaks is
 *     the canonical representation).
 *   - (f) AttachmentTimeline + alpha > 0 D-92 (in-memory): attachment
 *     switched in by a timeline with alpha > 0 → appears in globalPeaks →
 *     NOT flagged.
 *   - D-107 sort: multiple unused rows are sorted by attachmentName ASC
 *     (localeCompare tiebreak).
 *   - F6.1 sanity canary: every attachmentName in sampler.globalPeaks must
 *     be registered in at least one skin.attachments slotMap (Defined ⊇ Used
 *     invariant per 05-RESEARCH.md §Validation Architecture — sampler bug
 *     canary, not detection logic).
 *   - N2.3 hygiene grep: src/core/usage.ts imports nothing from
 *     node:fs / node:path / node:child_process / node:net / node:http /
 *     sharp.
 *   - D-100 export surface: src/core/usage.ts exports findUnusedAttachments
 *     by name.
 *   - CLAUDE.md #5 DOM-free: src/core/usage.ts has no document / window /
 *     HTMLElement references.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  SkeletonData,
  Skin,
  SlotData,
  BoneData,
  RegionAttachment,
} from '@esotericsoftware/spine-core';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { findUnusedAttachments } from '../../src/core/usage.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const USAGE_SRC = path.resolve('src/core/usage.ts');

describe('findUnusedAttachments — fixture cases (F6.1, D-95)', () => {
  it('(a) SIMPLE_TEST baseline: returns empty — every CIRCLE/SQUARE/TRIANGLE renders', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const rows = findUnusedAttachments(load, sampled);
    expect(rows).toEqual([]);
  });

  it('(b) D-95 ghost-def: SIMPLE_TEST_GHOST returns exactly 1 row { attachmentName: "GHOST", 64×64, definedIn: ["default"] }', () => {
    const load = loadSkeleton(FIXTURE_GHOST);
    const sampled = sampleSkeleton(load);
    const rows = findUnusedAttachments(load, sampled);
    expect(rows.length).toBe(1);
    expect(rows[0].attachmentName).toBe('GHOST');
    expect(rows[0].sourceW).toBe(64);
    expect(rows[0].sourceH).toBe(64);
    expect(rows[0].definedIn).toEqual(['default']);
    expect(rows[0].dimVariantCount).toBe(1);
    expect(rows[0].sourceLabel).toBe('64×64');
    expect(rows[0].definedInLabel).toBe('default');
  });
});

// Minimal synthetic. Builds a SkeletonData with N skins × 1-N slots, assigns
// attachments per-skin as configured, and constructs the sampler output by
// directly populating a PeakRecord-shaped Map entry for every attachment the
// caller declares "used". This bypasses the real sampler entirely — we only
// need the sampler OUTPUT shape (globalPeaks: Map<string, PeakRecord>) since
// findUnusedAttachments is a pure set-difference on sampler.globalPeaks +
// load.skeletonData.skins + load.sourceDims.
interface SyntheticSpec {
  skins: Array<{
    name: string;
    attachments: Array<{ slot: string; name: string; w: number; h: number }>;
  }>;
  // Subset of (skin, slot, attachment) triples where the attachment renders
  // with alpha > 0 — these populate globalPeaks (one entry per triple).
  used: Array<{ skin: string; slot: string; attachment: string }>;
}

function buildSynthetic(spec: SyntheticSpec) {
  const sd = new SkeletonData();
  const root = new BoneData(0, 'root', null);
  sd.bones.push(root);

  // Collect unique slot names in deterministic first-seen order.
  const slotOrder: string[] = [];
  const slotSeen = new Set<string>();
  for (const s of spec.skins) {
    for (const a of s.attachments) {
      if (!slotSeen.has(a.slot)) {
        slotSeen.add(a.slot);
        slotOrder.push(a.slot);
      }
    }
  }
  const slotByName = new Map<string, SlotData>();
  for (let i = 0; i < slotOrder.length; i++) {
    const sl = new SlotData(i, slotOrder[i], root);
    slotByName.set(slotOrder[i], sl);
    sd.slots.push(sl);
  }

  for (const sk of spec.skins) {
    const skin = new Skin(sk.name);
    for (const a of sk.attachments) {
      const att = new RegionAttachment(a.name, a.name);
      att.width = a.w;
      att.height = a.h;
      const slotData = slotByName.get(a.slot)!;
      skin.setAttachment(slotData.index, a.name, att);
    }
    sd.skins.push(skin);
  }

  const sourceDims = new Map<string, { w: number; h: number; source: 'atlas-bounds' }>();
  for (const sk of spec.skins) {
    for (const a of sk.attachments) {
      // Multiple skins may register the same attachment name with different
      // dims — this synthetic stores the last write, but findUnusedAttachments
      // walks skin.attachments directly for per-skin dims, so the map value
      // is unused by the D-98 divergence path.
      sourceDims.set(a.name, { w: a.w, h: a.h, source: 'atlas-bounds' });
    }
  }

  const load = {
    skeletonPath: '/synthetic',
    atlasPath: '/synthetic.atlas',
    skeletonData: sd,
    atlas: { regions: [] } as unknown as import('@esotericsoftware/spine-core').TextureAtlas,
    sourceDims,
    editorFps: 30,
  };

  const globalPeaks = new Map<string, import('../../src/core/sampler.js').PeakRecord>();
  for (const u of spec.used) {
    const key = `${u.skin}/${u.slot}/${u.attachment}`;
    globalPeaks.set(key, {
      attachmentKey: key,
      skinName: u.skin,
      slotName: u.slot,
      attachmentName: u.attachment,
      animationName: 'Setup Pose (Default)',
      time: 0,
      frame: 0,
      peakScaleX: 1,
      peakScaleY: 1,
      peakScale: 1,
      worldW: 0,
      worldH: 0,
      sourceW: 0,
      sourceH: 0,
      isSetupPosePeak: true,
    });
  }

  return {
    load: load as unknown as import('../../src/core/types.js').LoadResult,
    sampled: {
      globalPeaks,
      perAnimation: new Map(),
      setupPosePeaks: new Map(),
    } as unknown as import('../../src/core/sampler.js').SamplerOutput,
  };
}

describe('findUnusedAttachments — cross-skin semantics (D-92, D-93, D-98)', () => {
  it('(c) D-93: "HEAD" visible in skin A, registered-but-not-rendered in skin B → NOT flagged', () => {
    const { load, sampled } = buildSynthetic({
      skins: [
        { name: 'skinA', attachments: [{ slot: 'head', name: 'HEAD', w: 128, h: 128 }] },
        { name: 'skinB', attachments: [{ slot: 'head', name: 'HEAD', w: 128, h: 128 }] },
      ],
      used: [{ skin: 'skinA', slot: 'head', attachment: 'HEAD' }],
    });
    const rows = findUnusedAttachments(load, sampled);
    expect(rows).toEqual([]);
  });

  it('(d) D-98: dim divergence — "HEAD" unused in 2 skins at 128×128 and 256×256 → 1 row with max dims + variants indicator', () => {
    const { load, sampled } = buildSynthetic({
      skins: [
        { name: 'boy',  attachments: [{ slot: 'head', name: 'HEAD', w: 128, h: 128 }] },
        { name: 'girl', attachments: [{ slot: 'head', name: 'HEAD', w: 256, h: 256 }] },
      ],
      used: [],
    });
    const rows = findUnusedAttachments(load, sampled);
    expect(rows.length).toBe(1);
    expect(rows[0].attachmentName).toBe('HEAD');
    expect(rows[0].sourceW).toBe(256);
    expect(rows[0].sourceH).toBe(256);
    expect(rows[0].dimVariantCount).toBe(2);
    expect(rows[0].sourceLabel).toBe('256×256 (2 variants)');
    expect(rows[0].definedIn).toEqual(['boy', 'girl']);
    expect(rows[0].definedInLabel).toBe('boy, girl');
  });

  it('(e) D-92: attachment registered but slot alpha === 0 at every tick → flagged as unused', () => {
    // Modeled by building the synthetic WITHOUT adding the attachment to
    // `used`. Canonical representation: the sampler (src/core/sampler.ts)
    // skips any slot with alpha <= 0 at every sampled tick, so globalPeaks
    // carries no entry for that (skin, slot, attachment). The Phase 5
    // detector flags on absence from globalPeaks — no separate alpha
    // predicate in usage.ts (D-92 is encoded upstream in the sampler).
    const { load, sampled } = buildSynthetic({
      skins: [{ name: 'default', attachments: [{ slot: 'head', name: 'SILENT', w: 64, h: 64 }] }],
      used: [],
    });
    const rows = findUnusedAttachments(load, sampled);
    expect(rows.length).toBe(1);
    expect(rows[0].attachmentName).toBe('SILENT');
  });

  it('(f) D-92: attachment switched in by AttachmentTimeline with alpha > 0 → NOT flagged (represented as present in globalPeaks)', () => {
    const { load, sampled } = buildSynthetic({
      skins: [{ name: 'default', attachments: [{ slot: 'head', name: 'SPOKEN', w: 64, h: 64 }] }],
      used: [{ skin: 'default', slot: 'head', attachment: 'SPOKEN' }],
    });
    const rows = findUnusedAttachments(load, sampled);
    expect(rows).toEqual([]);
  });

  it('D-107: multiple unused rows are sorted by attachmentName ASC (localeCompare)', () => {
    const { load, sampled } = buildSynthetic({
      skins: [
        { name: 'default', attachments: [
          { slot: 'head', name: 'ZEBRA',  w: 16, h: 16 },
          { slot: 'body', name: 'APPLE',  w: 16, h: 16 },
          { slot: 'arm',  name: 'MANGO',  w: 16, h: 16 },
        ]},
      ],
      used: [],
    });
    const rows = findUnusedAttachments(load, sampled);
    expect(rows.map((r) => r.attachmentName)).toEqual(['APPLE', 'MANGO', 'ZEBRA']);
  });

  it('invariant: every globalPeaks attachmentName is registered in at least one skin.attachments (sanity canary)', () => {
    // F6.1 Nyquist matrix invariant: Defined ⊇ Used. If the sampler ever
    // emits a peak for an attachment not registered in ANY skin, the
    // detection algorithm's name-level Set difference would produce false
    // negatives (the phantom would silently appear "used" and mask real
    // unused attachments). This is a sampler-bug canary — cheap sanity
    // that catches upstream drift per 05-RESEARCH.md §Validation
    // Architecture.
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampler = sampleSkeleton(load);
    const definedNames = new Set<string>();
    for (const skin of load.skeletonData.skins) {
      for (const slotMap of skin.attachments) {
        if (!slotMap) continue;
        for (const name of Object.keys(slotMap)) definedNames.add(name);
      }
    }
    for (const p of sampler.globalPeaks.values()) {
      expect(definedNames.has(p.attachmentName)).toBe(true);
    }
  });
});

describe('usage — module hygiene (N2.3, D-100)', () => {
  it('N2.3: src/core/usage.ts has no node:fs / node:path / node:child_process / node:net / node:http / sharp imports', () => {
    const src = readFileSync(USAGE_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });

  it('D-100: src/core/usage.ts exports findUnusedAttachments by name', () => {
    const src = readFileSync(USAGE_SRC, 'utf8');
    expect(src).toMatch(/export\s+function\s+findUnusedAttachments/);
  });

  it('CLAUDE.md #5: src/core/usage.ts has no DOM references', () => {
    const src = readFileSync(USAGE_SRC, 'utf8');
    // Comments in usage.ts describe prose, not DOM APIs — a simple regex
    // suffices.
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
});
