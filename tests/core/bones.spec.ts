/**
 * Phase 3 Plan 01 — Tests for src/core/bones.ts (D-68).
 *
 * Behavior gates:
 *   - F4.3 Bone Path — boneChainPath returns [rootName, ...ancestors, slotName, attachmentName].
 *   - Fixture verifications on SIMPLE_TEST (bone chain topology validated via JSON inspection):
 *       * slot CIRCLE (bone CTRL) + attachment CIRCLE → ['root', 'CTRL', 'CIRCLE', 'CIRCLE']
 *       * slot TRIANGLE (bone CHAIN_8) + attachment TRIANGLE → 11 tokens
 *       * slot SQUARE2 (pre-scaled bone SQUARE2) + attachment SQUARE → ['root', 'SQUARE2', 'SQUARE2', 'SQUARE']
 *   - N2.3 hygiene — the module has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  Physics,
} from '@esotericsoftware/spine-core';
import { loadSkeleton } from '../../src/core/loader.js';
import { boneChainPath } from '../../src/core/bones.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const BONES_SRC = path.resolve('src/core/bones.ts');

function primedSkeleton(): Skeleton {
  const { skeletonData } = loadSkeleton(FIXTURE);
  const skeleton = new Skeleton(skeletonData);
  skeleton.setToSetupPose();
  const state = new AnimationState(new AnimationStateData(skeletonData));
  state.apply(skeleton);
  skeleton.update(0);
  skeleton.updateWorldTransform(Physics.update);
  return skeleton;
}

describe('boneChainPath (F4.3, D-68)', () => {
  it('F4.3: CIRCLE slot (bone CTRL) + attachment CIRCLE → [root, CTRL, CIRCLE, CIRCLE]', () => {
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find((s) => s.data.name === 'CIRCLE');
    expect(slot).toBeDefined();
    expect(boneChainPath(slot!, 'CIRCLE')).toEqual(['root', 'CTRL', 'CIRCLE', 'CIRCLE']);
  });

  it('F4.3: TRIANGLE slot (bone CHAIN_8) + attachment TRIANGLE → 11-token root→CTRL→CHAIN_2..8→TRIANGLE→TRIANGLE', () => {
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find((s) => s.data.name === 'TRIANGLE');
    expect(slot).toBeDefined();
    expect(boneChainPath(slot!, 'TRIANGLE')).toEqual([
      'root', 'CTRL', 'CHAIN_2', 'CHAIN_3', 'CHAIN_4',
      'CHAIN_5', 'CHAIN_6', 'CHAIN_7', 'CHAIN_8',
      'TRIANGLE', 'TRIANGLE',
    ]);
  });

  it('F4.3: SQUARE2 slot (pre-scaled bone SQUARE2) + attachment SQUARE → [root, SQUARE2, SQUARE2, SQUARE]', () => {
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find((s) => s.data.name === 'SQUARE2');
    expect(slot).toBeDefined();
    expect(boneChainPath(slot!, 'SQUARE')).toEqual(['root', 'SQUARE2', 'SQUARE2', 'SQUARE']);
  });

  it('F4.3: result array always ends with slotName + attachmentName (leaf invariant)', () => {
    const skeleton = primedSkeleton();
    for (const slot of skeleton.slots) {
      const result = boneChainPath(slot, 'DUMMY_ATTACHMENT');
      expect(result[result.length - 1]).toBe('DUMMY_ATTACHMENT');
      expect(result[result.length - 2]).toBe(slot.data.name);
      expect(result[0]).toBe('root');
    }
  });
});

describe('bones — module hygiene (N2.3 by construction)', () => {
  it('N2.3: src/core/bones.ts has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports', () => {
    const src = readFileSync(BONES_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
});
