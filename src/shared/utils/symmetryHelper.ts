import type { BaseNode, SymmetryOffsets } from "../types/project";

/**
 * Finds all nodes in the mechanism tree that belong to the specified symmetryGroupId.
 */
export function findSymmetryGroupMembers(tree: BaseNode, symmetryGroupId: string): BaseNode[] {
  const members: BaseNode[] = [];
  function traverse(node: BaseNode) {
    if (node.symmetryGroupId === symmetryGroupId) {
      members.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  traverse(tree);
  return members;
}

/**
 * Computes custom position/rotation offset deltas between a target node and the standard
 * group radial position, used when re-linking an independently edited node.
 */
export function computeSymmetryOffsets(
  mechanism: BaseNode,
  targetNode: BaseNode
): SymmetryOffsets {
  if (!targetNode.symmetryGroupId) return {};

  const members = findSymmetryGroupMembers(mechanism, targetNode.symmetryGroupId);
  const refNode = members.find((m) => m.id !== targetNode.id && !m.symmetryUnlinked) || members[0];
  if (!refNode || refNode.id === targetNode.id) return {};

  const count = targetNode.symmetryCount ?? members.length;
  const stepDeg = 360 / count;
  const stepRad = (stepDeg * Math.PI) / 180;

  const refRadius = Math.hypot(refNode.transform.x, refNode.transform.y);
  const refAngleRad = Math.atan2(refNode.transform.y, refNode.transform.x);
  const refBaseAngleRad = refAngleRad - (refNode.symmetryIndex ?? 0) * stepRad;

  const expectedAngleRad = refBaseAngleRad + (targetNode.symmetryIndex ?? 0) * stepRad;
  const refBaseRotationDeg = refNode.transform.rotation - (refNode.symmetryIndex ?? 0) * stepDeg;
  const expectedRotationDeg = refBaseRotationDeg + (targetNode.symmetryIndex ?? 0) * stepDeg;

  const targetRadius = Math.hypot(targetNode.transform.x, targetNode.transform.y);
  const targetAngleRad = Math.atan2(targetNode.transform.y, targetNode.transform.x);

  let angleDiffDeg = ((targetAngleRad - expectedAngleRad) * 180) / Math.PI;
  angleDiffDeg = (angleDiffDeg + 540) % 360 - 180; // Normalize to -180..180

  let rotDiffDeg = (targetNode.transform.rotation - expectedRotationDeg + 540) % 360 - 180;

  const radialDistanceOffset = Math.round((targetRadius - refRadius) * 100) / 100;
  const angleOffset = Math.round(angleDiffDeg * 100) / 100;
  const rotationOffset = Math.round(rotDiffDeg * 100) / 100;

  return {
    radialDistanceOffset: Math.abs(radialDistanceOffset) > 0.1 ? radialDistanceOffset : 0,
    angleOffset: Math.abs(angleOffset) > 0.1 ? angleOffset : 0,
    rotationOffset: Math.abs(rotationOffset) > 0.1 ? rotationOffset : 0,
  };
}

/**
 * Calculates updated node states for all members of a symmetry group
 * maintaining exact relative radial symmetry (plus preserved offsets) for transform updates,
 * and propagating all style/attribute updates.
 */
export function calculateSymmetryGroupUpdates(
  mechanism: BaseNode,
  activeNode: BaseNode,
  patch: any
): { nodeId: string; oldNode: BaseNode; newNode: BaseNode }[] {
  if (!activeNode.symmetryGroupId) {
    return [];
  }

  // If active node is currently unlinked, update ONLY active node
  if (activeNode.symmetryUnlinked) {
    const oldCopy = JSON.parse(JSON.stringify(activeNode));
    const newCopy = JSON.parse(JSON.stringify(activeNode));
    if (patch.transform) {
      newCopy.transform = { ...newCopy.transform, ...patch.transform };
    }
    Object.keys(patch).forEach((key) => {
      if (key !== "transform") {
        if (typeof patch[key] === "object" && patch[key] !== null && !Array.isArray(patch[key])) {
          newCopy[key] = { ...(newCopy[key] || {}), ...patch[key] };
        } else {
          newCopy[key] = patch[key];
        }
      }
    });
    return [{ nodeId: activeNode.id, oldNode: oldCopy, newNode: newCopy }];
  }

  const members = findSymmetryGroupMembers(mechanism, activeNode.symmetryGroupId);
  if (members.length <= 1) {
    return [];
  }

  const primaryIndex = activeNode.symmetryIndex ?? 0;
  const count = activeNode.symmetryCount ?? members.length;
  const stepDeg = 360 / count;
  const stepRad = (stepDeg * Math.PI) / 180;

  // Build updated primary node
  const updatedPrimary = JSON.parse(JSON.stringify(activeNode));
  if (patch.transform) {
    updatedPrimary.transform = { ...updatedPrimary.transform, ...patch.transform };
  }
  Object.keys(patch).forEach((key) => {
    if (key !== "transform") {
      if (typeof patch[key] === "object" && patch[key] !== null && !Array.isArray(patch[key])) {
        updatedPrimary[key] = { ...(updatedPrimary[key] || {}), ...patch[key] };
      } else {
        updatedPrimary[key] = patch[key];
      }
    }
  });

  const updates: { nodeId: string; oldNode: BaseNode; newNode: BaseNode }[] = [];

  // Primary node polar parameters (taking into account primary's symmetryOffsets if any)
  const primaryOffsetRadius = activeNode.symmetryOffsets?.radialDistanceOffset || 0;
  const primaryOffsetAngleRad = ((activeNode.symmetryOffsets?.angleOffset || 0) * Math.PI) / 180;
  const primaryOffsetRot = activeNode.symmetryOffsets?.rotationOffset || 0;

  const px = updatedPrimary.transform.x;
  const py = updatedPrimary.transform.y;
  const baseRadius = Math.hypot(px, py) - primaryOffsetRadius;
  const primaryAngleRad = Math.atan2(py, px) - primaryOffsetAngleRad;

  const baseOffsetAngleRad = primaryAngleRad - primaryIndex * stepRad;
  const baseRotationDeg = (updatedPrimary.transform.rotation - primaryOffsetRot) - primaryIndex * stepDeg;

  for (const member of members) {
    // Skip decoupled members when editing linked group
    if (member.id !== activeNode.id && member.symmetryUnlinked) {
      continue;
    }

    const oldMemberCopy = JSON.parse(JSON.stringify(member));
    const newMemberCopy = JSON.parse(JSON.stringify(member));

    const idx = member.symmetryIndex ?? 0;
    const memberOffsets = member.symmetryOffsets || {};
    const offsetRadius = memberOffsets.radialDistanceOffset || 0;
    const offsetAngleRad = ((memberOffsets.angleOffset || 0) * Math.PI) / 180;
    const offsetRot = memberOffsets.rotationOffset || 0;

    const memberAngleRad = baseOffsetAngleRad + idx * stepRad + offsetAngleRad;
    const memberRotationDeg = baseRotationDeg + idx * stepDeg + offsetRot;
    const memberRadius = Math.max(0, baseRadius + offsetRadius);

    // 1. Transform propagation
    if (patch.transform) {
      newMemberCopy.transform = {
        x: memberRadius * Math.cos(memberAngleRad),
        y: memberRadius * Math.sin(memberAngleRad),
        rotation: memberRotationDeg,
        scaleX: updatedPrimary.transform.scaleX ?? 1,
        scaleY: updatedPrimary.transform.scaleY ?? 1,
      };
    }

    // 2. Property & Style propagation
    Object.keys(patch).forEach((key) => {
      if (key !== "transform") {
        if (typeof patch[key] === "object" && patch[key] !== null && !Array.isArray(patch[key])) {
          newMemberCopy[key] = { ...(newMemberCopy[key] || {}), ...patch[key] };
        } else {
          newMemberCopy[key] = patch[key];
        }
      }
    });

    // 3. Special handling for window cutout shape ID preservation
    if (newMemberCopy.type === "window" && newMemberCopy.shape && oldMemberCopy.shape) {
      newMemberCopy.shape.id = oldMemberCopy.shape.id;
    }
    newMemberCopy.id = oldMemberCopy.id;

    updates.push({
      nodeId: member.id,
      oldNode: oldMemberCopy,
      newNode: newMemberCopy,
    });
  }

  return updates;
}
