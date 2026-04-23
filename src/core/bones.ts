/**
 * Phase 3 Plan 01 — Pure bone-chain path traversal (D-68).
 *
 * Returns the bone chain from the skeleton root down to the attachment leaf:
 *   [rootName, ...ancestorNamesTopDown, slotBoneName, slotName, attachmentName].
 *
 * Pure delegation over spine-core's Bone.parent chain — zero math. Follows
 * CLAUDE.md rule #5 (core/ is pure TS, no DOM). Enforced by the N2.3 hygiene
 * grep in tests/core/bones.spec.ts and by the tests/arch.spec.ts Layer 3
 * defense (which scans the renderer for core imports).
 *
 * IMPORTANT: `bone.data.name` is the correct accessor — BoneData carries the
 * .name, not Bone directly (spine-core 4.2.111 Bone.d.ts lines 40, 44).
 *
 * Fixture examples (SIMPLE_TEST):
 *   - slot CIRCLE (bone CTRL) + attachment CIRCLE:
 *       ['root', 'CTRL', 'CIRCLE', 'CIRCLE']
 *   - slot TRIANGLE (bone CHAIN_8) + attachment TRIANGLE:
 *       ['root', 'CTRL', 'CHAIN_2', ..., 'CHAIN_8', 'TRIANGLE', 'TRIANGLE']
 *   - slot SQUARE2 (pre-scaled bone SQUARE2) + attachment SQUARE:
 *       ['root', 'SQUARE2', 'SQUARE2', 'SQUARE']
 */
import type { Slot } from '@esotericsoftware/spine-core';

export function boneChainPath(slot: Slot, attachmentName: string): string[] {
  // Walk the parent chain from slot.bone up to the root, collecting names.
  // Then reverse to get root-first order, and append slot + attachment leaves.
  const ancestors: string[] = [];
  let current: typeof slot.bone | null = slot.bone;
  while (current !== null) {
    ancestors.push(current.data.name);
    current = current.parent;
  }
  ancestors.reverse();                    // root-first
  ancestors.push(slot.data.name);         // slot name
  ancestors.push(attachmentName);         // attachment leaf
  return ancestors;
}
