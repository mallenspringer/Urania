import type { Project, RingNode, BaseNode } from "../types/project";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import { Matrix2D } from "./matrix";
import { normalizeAngle } from "./math";
import { getArcTextCharPositions } from "./textGeometry";

export function getPolygonPointAndNormalAtAngle(
  ringData: { outerRadius: number; ringShape?: string; polygonSides?: number; edgeCurvature?: number },
  angleDeg: number
): { radius: number; normalAngle: number; px: number; py: number } {
  const outerR = ringData.outerRadius || 100;
  if (ringData.ringShape !== "polygon") {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      radius: outerR,
      normalAngle: angleDeg,
      px: outerR * Math.cos(rad),
      py: outerR * Math.sin(rad),
    };
  }

  const sides = Math.max(3, ringData.polygonSides || 6);
  const curvature = ringData.edgeCurvature || 0;
  const alphaRad = (2 * Math.PI) / sides;
  const alphaDeg = 360 / sides;

  const normDeg = ((angleDeg + 90) % 360 + 360) % 360;
  const sideIndex = Math.floor(normDeg / alphaDeg);

  const a1 = sideIndex * alphaRad - Math.PI / 2;
  const a2 = (sideIndex + 1) * alphaRad - Math.PI / 2;

  const v1 = { x: outerR * Math.cos(a1), y: outerR * Math.sin(a1) };
  const v2 = { x: outerR * Math.cos(a2), y: outerR * Math.sin(a2) };

  // Parameter t in [0, 1] for angleDeg within side span [a1, a2]
  const normRad = (((angleDeg * Math.PI) / 180 + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const startRadOnCircle = sideIndex * alphaRad;
  let t = Math.max(0, Math.min(1, (normRad - startRadOnCircle) / alphaRad));

  if (Math.abs(curvature) < 0.001) {
    const px = (1 - t) * v1.x + t * v2.x;
    const py = (1 - t) * v1.y + t * v2.y;
    const radius = Math.hypot(px, py);
    const sideMidAngleDeg = (sideIndex + 0.5) * alphaDeg - 90;
    return {
      radius,
      normalAngle: sideMidAngleDeg,
      px,
      py,
    };
  }

  // Curved polygon side (Quadratic Bezier curve matching renderer)
  const mx = (v1.x + v2.x) / 2;
  const my = (v1.y + v2.y) / 2;
  const len = Math.hypot(mx, my);
  const nx = len > 0 ? mx / len : 0;
  const ny = len > 0 ? my / len : 0;

  const offsetDist = curvature * (outerR * 0.4);
  const cx = mx + nx * offsetDist;
  const cy = my + ny * offsetDist;

  // Binary search for exact parameter t where ray at angleDeg intersects B(t)
  let tLow = 0;
  let tHigh = 1;
  for (let iter = 0; iter < 6; iter++) {
    const oneMinusT = 1 - t;
    const testPx = oneMinusT * oneMinusT * v1.x + 2 * oneMinusT * t * cx + t * t * v2.x;
    const testPy = oneMinusT * oneMinusT * v1.y + 2 * oneMinusT * t * cy + t * t * v2.y;
    const testAng = (Math.atan2(testPy, testPx) * 180) / Math.PI;
    const diff = ((testAng - angleDeg + 540) % 360) - 180;

    if (Math.abs(diff) < 0.01) break;

    if (diff < 0) {
      tLow = t;
    } else {
      tHigh = t;
    }
    t = (tLow + tHigh) / 2;
  }

  const oneMinusT = 1 - t;
  const px = oneMinusT * oneMinusT * v1.x + 2 * oneMinusT * t * cx + t * t * v2.x;
  const py = oneMinusT * oneMinusT * v1.y + 2 * oneMinusT * t * cy + t * t * v2.y;
  const radius = Math.hypot(px, py);

  // Tangent P'(t) = 2(1-t)(C - v1) + 2t(v2 - C)
  const tx = 2 * oneMinusT * (cx - v1.x) + 2 * t * (v2.x - cx);
  const ty = 2 * oneMinusT * (cy - v1.y) + 2 * t * (v2.y - cy);

  let nxOut = -ty;
  let nyOut = tx;
  if (nxOut * px + nyOut * py < 0) {
    nxOut = ty;
    nyOut = -tx;
  }

  const normalAngle = (Math.atan2(nyOut, nxOut) * 180) / Math.PI;

  return {
    radius,
    normalAngle: ((normalAngle % 360) + 360) % 360,
    px,
    py,
  };
}

export function getRingRadiusAtAngle(
  ringData: { outerRadius: number; ringShape?: string; polygonSides?: number; edgeCurvature?: number },
  angleDeg: number
): number {
  return getPolygonPointAndNormalAtAngle(ringData, angleDeg).radius;
}

export function getRingSurfaceNormalAngle(
  ringData: { outerRadius: number; ringShape?: string; polygonSides?: number; edgeCurvature?: number },
  angleDeg: number
): number {
  return getPolygonPointAndNormalAtAngle(ringData, angleDeg).normalAngle;
}

export function findRingForNode(project: Project, nodeId: string): string | null {
  const rings = (project.mechanism.children || []).filter(
    (c) => c.type === "ring"
  ) as RingNode[];
  for (const ring of rings) {
    if (ring.id === nodeId) return ring.id;

    const hasChild = (node: BaseNode): boolean => {
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

export function findParentNode(tree: BaseNode, childId: string): BaseNode | null {
  if (tree.children) {
    for (const child of tree.children) {
      if (child.id === childId) return tree;
      const found = findParentNode(child, childId);
      if (found) return found;
    }
  }
  return null;
}

export function findNodeInTree(node: BaseNode, id: string): BaseNode | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function updateNodeInTree(tree: BaseNode, id: string, patch: Record<string, any>): boolean {
  const node = findNodeInTree(tree, id) as any;
  if (node) {
    if (patch.transform) {
      node.transform = { ...node.transform, ...patch.transform };
    }
    Object.keys(patch).forEach((key) => {
      if (key !== "transform") {
        if (typeof patch[key] === "object" && patch[key] !== null && !Array.isArray(patch[key])) {
          node[key] = { ...(node[key] || {}), ...patch[key] };
        } else {
          node[key] = patch[key];
        }
      }
    });
    return true;
  }
  return false;
}

export function isDescendantOf(parentNode: BaseNode, childId: string): boolean {
  if (!parentNode.children) return false;
  for (const child of parentNode.children) {
    if (child.id === childId) return true;
    if (isDescendantOf(child, childId)) return true;
  }
  return false;
}

export function findParentRing(mechanism: BaseNode, nodeId: string): BaseNode | null {
  const rings = mechanism.children || [];
  for (const ring of rings) {
    if (ring.id === nodeId || isDescendantOf(ring, nodeId)) {
      return ring;
    }
  }
  return null;
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

    if (node.renderData?.isRadialWarp) {
      const r = Math.sqrt(lp.x * lp.x + lp.y * lp.y);
      const radius = node.renderData.radialRadius || 100;
      const w = node.bounds.width;
      const h = node.bounds.height;
      const inner = radius - h / 2;
      const outer = radius + h / 2;
      if (r < inner || r > outer) return false;

      let angle = Math.atan2(lp.y, lp.x) * (180 / Math.PI);
      let diff = angle;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      return Math.abs(diff) <= w / 2;
    }

    switch (node.type) {
      case "ring": {
        const inner = node.renderData.innerRadius || 0;
        const outer = node.renderData.outerRadius || 100;
        const r = Math.sqrt(lp.x * lp.x + lp.y * lp.y);
        const isPoly = node.renderData.ringShape === "polygon";
        if (isPoly) {
          const sides = Math.max(3, node.renderData.polygonSides || 6);
          let angle = Math.atan2(lp.y, lp.x);
          if (angle < 0) angle += Math.PI * 2;
          const sectorAngle = (2 * Math.PI) / sides;
          const localAngle = (angle % sectorAngle) - sectorAngle / 2;
          const distToEdge = r * Math.cos(localAngle);
          return r >= inner && distToEdge <= outer;
        }
        return r >= inner && r <= outer;
      }
      case "circle": {
        const r = node.renderData.radius || 10;
        return lp.x * lp.x + lp.y * lp.y <= r * r;
      }
      case "discTab": {
        const w = node.renderData.width || 30;
        const h = node.renderData.height || 18;
        return lp.x >= -w / 2 && lp.x <= w / 2 && lp.y >= 0 && lp.y <= h;
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
        const content = node.renderData.content || "";
        const fontFamily = node.renderData.fontFamily || "Outfit, Inter, sans-serif";
        const kerning = node.renderData.kerning || 0;
        const layout = getArcTextCharPositions(content, radius, start, fontSize, fontFamily, kerning);
        const sweep = layout.totalSweep > 0 ? layout.totalSweep : (node.renderData.sweepAngle || 30);
        return isAngleBetween(angle, start, sweep);
      }
      case "window": {
        const shape = node.renderData.shape;
        if (!shape) return false;
        if (shape.type === "circle") {
          const r = shape.radius || 10;
          return lp.x * lp.x + lp.y * lp.y <= r * r;
        }
        if (shape.type === "rectangle") {
          const w = shape.width || 20;
          const h = shape.height || 20;
          return (
            lp.x >= -w / 2 &&
            lp.x <= w / 2 &&
            lp.y >= -h / 2 &&
            lp.y <= h / 2
          );
        }
        if (shape.type === "polygon") {
          const r = shape.radius || 10;
          return lp.x * lp.x + lp.y * lp.y <= r * r;
        }
        if (shape.type === "star") {
          const r = shape.outerRadius || 35;
          return lp.x * lp.x + lp.y * lp.y <= r * r;
        }
        if (shape.type === "crescent") {
          const r = shape.radius || 30;
          return lp.x * lp.x + lp.y * lp.y <= r * r;
        }
        if (shape.type === "trapezoid") {
          const maxW = Math.max(shape.baseWidth || 60, shape.topWidth || 40);
          const h = shape.height || 50;
          return (
            lp.x >= -maxW / 2 &&
            lp.x <= maxW / 2 &&
            lp.y >= -h / 2 &&
            lp.y <= h / 2
          );
        }
        if (shape.type === "line") {
          const len = shape.length || 50;
          const thick = shape.thickness || 2;
          return lp.x >= 0 && lp.x <= len && lp.y >= -thick / 2 && lp.y <= thick / 2;
        }
        if (shape.type === "text" || shape.type === "sectorLabel") {
          const fs = shape.fontSize || 14;
          const len = (shape.content || "").length || 4;
          const w = len * fs * 0.6;
          return lp.x >= 0 && lp.x <= w && lp.y >= -fs && lp.y <= 0;
        }
        if (shape.type === "arcText") {
          const r = Math.sqrt(lp.x * lp.x + lp.y * lp.y);
          const radius = shape.radius || 100;
          const fontSize = shape.fontSize || 12;
          if (r < radius - fontSize * 0.8 || r > radius + fontSize * 0.8) return false;

          let angle = Math.atan2(lp.y, lp.x) * (180 / Math.PI);
          angle = normalizeAngle(angle);
          const start = shape.startAngle || 0;
          const content = shape.content || "";
          const fontFamily = shape.fontFamily || "Outfit, Inter, sans-serif";
          const kerning = shape.kerning || 0;
          const layout = getArcTextCharPositions(content, radius, start, fontSize, fontFamily, kerning);
          const sweep = layout.totalSweep > 0 ? layout.totalSweep : (shape.sweepAngle || 30);
          return isAngleBetween(angle, start, sweep);
        }
        return lp.x >= bx && lp.x <= bx + bw && lp.y >= by && lp.y <= by + bh;
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
    const fontSize = node.renderData.fontSize || 12;
    const content = node.renderData.content || "";
    const fontFamily = node.renderData.fontFamily || "Outfit, Inter, sans-serif";
    const kerning = node.renderData.kerning || 0;
    const layout = getArcTextCharPositions(content, radius, start, fontSize, fontFamily, kerning);
    const sweep = layout.totalSweep > 0 ? layout.totalSweep : (node.renderData.sweepAngle || 30);

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
