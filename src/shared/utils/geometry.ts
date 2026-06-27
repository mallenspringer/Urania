import type { Project, RingNode } from "../types/project";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import { Matrix2D } from "./matrix";
import { normalizeAngle } from "./math";

export function findRingForNode(project: Project, nodeId: string): string | null {
  const rings = (project.mechanism.children || []).filter(
    (c) => c.type === "ring"
  ) as RingNode[];
  for (const ring of rings) {
    if (ring.id === nodeId) return ring.id;

    const hasChild = (node: any): boolean => {
      if (node.id === nodeId) return true;
      if (node.children) {
        for (const child of node.children) {
          if (hasChild(child)) return true;
        }
      }
      return false;
    };
    if (hasChild(ring)) {
      return ring.id;
    }
  }
  return null;
}

export function findParentNode(tree: any, childId: string): any | null {
  if (tree.children) {
    for (const child of tree.children) {
      if (child.id === childId) return tree;
      const found = findParentNode(child, childId);
      if (found) return found;
    }
  }
  return null;
}


export function findNodeInTree(node: any, id: string): any | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function isDescendantOf(parentNode: any, childId: string): boolean {
  if (!parentNode.children) return false;
  for (const child of parentNode.children) {
    if (child.id === childId) return true;
    if (isDescendantOf(child, childId)) return true;
  }
  return false;
}

export function isAngleBetween(target: number, start: number, sweep: number): boolean {
  const normTarget = normalizeAngle(target - start);
  return normTarget <= sweep;
}

export function isPointInsideNode(pos: { x: number; y: number }, node: ResolvedNode): boolean {
  const { x, y, rotation, scaleX, scaleY } = node.worldTransform;
  const { x: bx, y: by, width: bw, height: bh } = node.bounds;

  const m = Matrix2D.identity()
    .translate(x, y)
    .rotate(rotation)
    .scale(scaleX, scaleY);

  try {
    const inv = m.invert();
    const lp = inv.transformPoint(pos.x, pos.y);

    switch (node.type) {
      case "circle": {
        const r = node.renderData.radius || 10;
        return lp.x * lp.x + lp.y * lp.y <= r * r;
      }
      case "rectangle": {
        const w = node.renderData.width || 0;
        const h = node.renderData.height || 0;
        return lp.x >= -w / 2 && lp.x <= w / 2 && lp.y >= -h / 2 && lp.y <= h / 2;
      }
      case "line": {
        const len = node.renderData.length || 0;
        const thick = node.renderData.thickness || 2;
        return lp.x >= 0 && lp.x <= len && lp.y >= -thick / 2 && lp.y <= thick / 2;
      }
      case "polygon": {
        const r = node.renderData.radius || 10;
        return lp.x * lp.x + lp.y * lp.y <= r * r;
      }
      case "sector": {
        const r = Math.sqrt(lp.x * lp.x + lp.y * lp.y);
        const inner = node.renderData.innerRadius || 0;
        const outer = node.renderData.outerRadius || 100;
        if (r < inner || r > outer) return false;

        let angle = Math.atan2(lp.y, lp.x) * (180 / Math.PI);
        angle = normalizeAngle(angle);
        const sweep = (node.renderData.endAngle || 0) - (node.renderData.startAngle || 0);
        return angle <= sweep;
      }
      case "arcText": {
        const r = Math.sqrt(lp.x * lp.x + lp.y * lp.y);
        const radius = node.renderData.radius || 100;
        const fontSize = node.renderData.fontSize || 12;
        if (r < radius - fontSize * 0.8 || r > radius + fontSize * 0.8) return false;

        let angle = Math.atan2(lp.y, lp.x) * (180 / Math.PI);
        angle = normalizeAngle(angle);
        const start = node.renderData.startAngle || 0;
        const sweep = node.renderData.sweepAngle || 0;
        return isAngleBetween(angle, start, sweep);
      }
      case "window": {
        const shape = node.renderData.shape;
        if (!shape) return false;
        if (shape.type === "circle") {
          return lp.x * lp.x + lp.y * lp.y <= shape.radius * shape.radius;
        }
        if (shape.type === "rectangle") {
          return (
            lp.x >= -shape.width / 2 &&
            lp.x <= shape.width / 2 &&
            lp.y >= -shape.height / 2 &&
            lp.y <= shape.height / 2
          );
        }
        if (shape.type === "polygon") {
          const r = shape.radius || 10;
          return lp.x * lp.x + lp.y * lp.y <= r * r;
        }
        return false;
      }
      default:
        return lp.x >= bx && lp.x <= bx + bw && lp.y >= by && lp.y <= by + bh;
    }
  } catch {
    return false;
  }
}

export function isPointInsideWindow(pos: { x: number; y: number }, windowNode: ResolvedNode): boolean {
  return isPointInsideNode(pos, windowNode);
}

export function getNodeKeyPoints(node: ResolvedNode): { x: number; y: number }[] {
  const { x, y, rotation } = node.worldTransform;
  if (node.type === "ring") {
    return [{ x, y }];
  }
  if (node.type === "sector") {
    const inner = node.renderData.innerRadius || 0;
    const outer = node.renderData.outerRadius || 100;
    const start = node.renderData.startAngle || 0;
    const end = node.renderData.endAngle || 0;
    const sweep = end - start;

    const angles = [0, sweep / 2, sweep];
    const radii = [inner, (inner + outer) / 2, outer];
    const points: { x: number; y: number }[] = [];

    for (const a of angles) {
      for (const r of radii) {
        const rad = ((rotation + a) * Math.PI) / 180;
        points.push({ x: x + r * Math.cos(rad), y: y + r * Math.sin(rad) });
      }
    }
    return points;
  }
  if (node.type === "arcText") {
    const radius = node.renderData.radius || 100;
    const start = node.renderData.startAngle || 0;
    const sweep = node.renderData.sweepAngle || 0;

    const points: { x: number; y: number }[] = [];
    const numPoints = 5;
    for (let i = 0; i < numPoints; i++) {
      const angle = start + (i * sweep) / (numPoints - 1);
      const rad = ((rotation + angle) * Math.PI) / 180;
      points.push({ x: x + radius * Math.cos(rad), y: y + radius * Math.sin(rad) });
    }
    return points;
  }

  const { x: bx, y: by, width: bw, height: bh } = node.bounds;
  const corners = [
    { lx: 0, ly: 0 },
    { lx: bx, ly: by },
    { lx: bx + bw, ly: by },
    { lx: bx + bw, ly: by + bh },
    { lx: bx, ly: by + bh },
  ];
  const wRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(wRad);
  const sin = Math.sin(wRad);
  return corners.map((c) => ({
    x: x + (c.lx * cos - c.ly * sin),
    y: y + (c.lx * sin + c.ly * cos),
  }));
}

export const isNodeTouchedByMarquee = (
  node: ResolvedNode,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  allNodes: ResolvedNode[],
  project: Project
) => {
  const isPointRevealed = (pt: { x: number; y: number }) => {
    if (!node.maskIds || node.maskIds.length === 0) return true;
    return node.maskIds.every((maskId) => {
      const maskRingId = findRingForNode(project, maskId);
      if (maskRingId) {
        const maskRing = allNodes.find((n) => n.id === maskRingId);
        if (maskRing && maskRing.visible && isPointInsideNode(pt, maskRing)) {
          const maskNode = allNodes.find((n) => n.id === maskId);
          if (!maskNode) return true;
          return isPointInsideWindow(pt, maskNode);
        }
      }
      return true;
    });
  };

  const keyPoints = getNodeKeyPoints(node);
  const anyKeyPointInside = keyPoints.some(
    (kp) => kp.x >= x1 && kp.x <= x2 && kp.y >= y1 && kp.y <= y2 && isPointRevealed(kp)
  );
  if (anyKeyPointInside) return true;

  const marqueePoints = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x1, y: y2 },
    { x: x2, y: y2 },
    { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
    { x: (x1 + x2) / 2, y: y1 },
    { x: (x1 + x2) / 2, y: y2 },
    { x: x1, y: (y1 + y2) / 2 },
    { x: x2, y: (y1 + y2) / 2 },
  ];

  const anyMarqueePointInside = marqueePoints.some((mp) =>
    isPointInsideNode(mp, node) && isPointRevealed(mp)
  );
  return anyMarqueePointInside;
};
