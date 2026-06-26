import type {
  Project,
  BaseNode,
  RingNode,
  SectorNode,
  CircleNode,
  RectangleNode,
  LineNode,
  PolygonNode,
  TextNode,
  ArcTextNode,
  SectorLabelNode,
  ImageNode,
  SvgAssetNode,
  WindowNode,
  RadialPatternNode,
  Transform,

} from "../../shared/types/project";
import { Matrix2D } from "../../shared/utils/matrix";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResolvedNode {
  id: string;
  type: string;
  name: string;
  worldTransform: Transform;
  visible: boolean;
  bounds: Bounds;
  maskIds: string[];
  renderData: Record<string, any>;
}

/**
 * Traverses a node to collect all window node IDs.
 */
function collectWindows(node: BaseNode, collected: string[]): void {
  if (node.type === "window") {
    collected.push(node.id);
  }
  if (node.children) {
    for (const child of node.children) {
      collectWindows(child, collected);
    }
  }
  if (node.type === "radialPattern") {
    const pattern = node as RadialPatternNode;
    if (pattern.children) {
      for (const child of pattern.children) {
        collectWindows(child, collected);
      }
    }
  }
}

/**
 * Collects all window node IDs located on a specific ring.
 */
function collectRingWindows(ring: RingNode): string[] {
  const collected: string[] = [];
  if (ring.children) {
    for (const child of ring.children) {
      collectWindows(child, collected);
    }
  }
  return collected;
}

/**
 * Recursively resolves a scene graph node into world coordinates, bounds, patterns, and mask states.
 */
function resolveNode(
  node: BaseNode,
  parentMatrix: Matrix2D,
  parentVisible: boolean,
  currentMaskIds: string[],
  resolved: ResolvedNode[],
  ringContext: { innerRadius: number; outerRadius: number } | null
): void {
  let localMatrix = Matrix2D.identity();

  if (node.transform) {
    localMatrix = localMatrix
      .translate(node.transform.x, node.transform.y)
      .rotate(node.transform.rotation)
      .scale(node.transform.scaleX, node.transform.scaleY);
  }

  // Ring rotation
  if (node.type === "ring") {
    const ring = node as RingNode;
    localMatrix = localMatrix.rotate(ring.rotation);
    ringContext = { innerRadius: ring.innerRadius, outerRadius: ring.outerRadius };
  }

  // Sector start angle rotation
  if (node.type === "sector") {
    const sector = node as SectorNode;
    localMatrix = localMatrix.rotate(sector.startAngle);
  }

  const worldMatrix = parentMatrix.multiply(localMatrix);
  const worldTransform = worldMatrix.decompose();
  const visible = parentVisible && node.visible !== false;

  const renderData: Record<string, any> = {};
  let bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };

  // Copy elements parameters
  if ("style" in node) {
    renderData.style = (node as any).style;
  }
  if ("export" in node) {
    renderData.export = (node as any).export;
  }

  switch (node.type) {
    case "ring": {
      const r = node as RingNode;
      renderData.innerRadius = r.innerRadius;
      renderData.outerRadius = r.outerRadius;
      bounds = {
        x: -r.outerRadius,
        y: -r.outerRadius,
        width: r.outerRadius * 2,
        height: r.outerRadius * 2,
      };
      break;
    }
    case "sector": {
      const s = node as SectorNode;
      renderData.startAngle = s.startAngle;
      renderData.endAngle = s.endAngle;
      if (ringContext) {
        renderData.innerRadius = ringContext.innerRadius;
        renderData.outerRadius = ringContext.outerRadius;
        bounds = {
          x: -ringContext.outerRadius,
          y: -ringContext.outerRadius,
          width: ringContext.outerRadius * 2,
          height: ringContext.outerRadius * 2,
        };
      }
      break;
    }
    case "circle": {
      const c = node as CircleNode;
      renderData.radius = c.radius;
      bounds = { x: -c.radius, y: -c.radius, width: c.radius * 2, height: c.radius * 2 };
      break;
    }
    case "rectangle": {
      const r = node as RectangleNode;
      renderData.width = r.width;
      renderData.height = r.height;
      bounds = { x: -r.width / 2, y: -r.height / 2, width: r.width, height: r.height };
      break;
    }
    case "line": {
      const l = node as LineNode;
      renderData.length = l.length;
      renderData.thickness = l.thickness;
      bounds = { x: 0, y: -l.thickness / 2, width: l.length, height: l.thickness };
      break;
    }
    case "polygon": {
      const p = node as PolygonNode;
      renderData.sides = p.sides;
      renderData.radius = p.radius;
      renderData.cornerRadius = p.cornerRadius;
      bounds = { x: -p.radius, y: -p.radius, width: p.radius * 2, height: p.radius * 2 };
      break;
    }
    case "text": {
      const t = node as TextNode;
      renderData.content = t.content;
      renderData.fontFamily = t.fontFamily;
      renderData.fontSize = t.fontSize;
      const charWidth = t.fontSize * 0.6;
      bounds = {
        x: 0,
        y: -t.fontSize,
        width: t.content.length * charWidth,
        height: t.fontSize,
      };
      break;
    }
    case "arcText": {
      const a = node as ArcTextNode;
      renderData.content = a.content;
      renderData.radius = a.radius;
      renderData.startAngle = a.startAngle;
      renderData.sweepAngle = a.sweepAngle;
      renderData.fontFamily = a.fontFamily;
      renderData.fontSize = a.fontSize;
      bounds = {
        x: -(a.radius + a.fontSize),
        y: -(a.radius + a.fontSize),
        width: (a.radius + a.fontSize) * 2,
        height: (a.radius + a.fontSize) * 2,
      };
      break;
    }
    case "sectorLabel": {
      const sl = node as SectorLabelNode;
      renderData.content = sl.content;
      renderData.fontFamily = sl.fontFamily;
      renderData.fontSize = sl.fontSize;
      bounds = { x: -50, y: -10, width: 100, height: 20 };
      break;
    }
    case "image": {
      const img = node as ImageNode;
      renderData.assetId = img.assetId;
      bounds = { x: -50, y: -50, width: 100, height: 100 };
      break;
    }
    case "svgAsset": {
      const svg = node as SvgAssetNode;
      renderData.assetId = svg.assetId;
      bounds = { x: -50, y: -50, width: 100, height: 100 };
      break;
    }
    case "window": {
      const w = node as WindowNode;
      renderData.shape = w.shape;
      if (w.shape) {
        if (w.shape.type === "circle") {
          const r = w.shape.radius;
          bounds = { x: -r, y: -r, width: r * 2, height: r * 2 };
        } else if (w.shape.type === "rectangle") {
          const r = w.shape;
          bounds = { x: -r.width / 2, y: -r.height / 2, width: r.width, height: r.height };
        } else if (w.shape.type === "polygon") {
          const r = w.shape.radius;
          bounds = { x: -r, y: -r, width: r * 2, height: r * 2 };
        }
      }
      break;
    }
  }

  // Handle RadialPattern expansion
  if (node.type === "radialPattern") {
    const pattern = node as RadialPatternNode;
    const copies = pattern.copies || 1;
    const spacing = pattern.spacingDegrees || 0;
    const rotateCopies = pattern.rotateCopies !== false;

    for (let i = 0; i < copies; i++) {
      let copyMatrix = worldMatrix;

      if (rotateCopies) {
        copyMatrix = copyMatrix.rotate(i * spacing);
      } else {
        const decomp = worldMatrix.decompose();
        const rad = (i * spacing * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = decomp.x * cos - decomp.y * sin;
        const ry = decomp.x * sin + decomp.y * cos;
        copyMatrix = Matrix2D.identity()
          .translate(rx, ry)
          .rotate(decomp.rotation)
          .scale(decomp.scaleX, decomp.scaleY);
      }

      if (pattern.children) {
        for (const child of pattern.children) {
          resolveNode(
            child,
            copyMatrix,
            visible,
            currentMaskIds,
            resolved,
            ringContext
          );
        }
      }
    }
    return;
  }

  resolved.push({
    id: node.id,
    type: node.type,
    name: node.name || `${node.type.toUpperCase()}_${node.id.substring(0, 4)}`,
    worldTransform,
    visible,
    bounds,
    maskIds: [...currentMaskIds],
    renderData,
  });

  // Resolve descendants
  if (node.type === "ring") {
    const ring = node as RingNode;
    if (ring.children) {
      for (const child of ring.children) {
        resolveNode(
          child,
          worldMatrix,
          visible,
          currentMaskIds,
          resolved,
          ringContext
        );
      }
    }
  } else if (node.type === "sector") {
    const sector = node as SectorNode;
    if (sector.children) {
      for (const child of sector.children) {
        resolveNode(
          child,
          worldMatrix,
          visible,
          currentMaskIds,
          resolved,
          ringContext
        );
      }
    }
  } else if (node.children) {
    for (const child of node.children) {
      resolveNode(
        child,
        worldMatrix,
        visible,
        currentMaskIds,
        resolved,
        ringContext
      );
    }
  }
}

/**
 * Resolves the entire Urania Project scene graph to a flat array of world-space ResolvedNode elements.
 */
export function resolveProject(project: Project): ResolvedNode[] {
  const resolved: ResolvedNode[] = [];
  const rings = (project.mechanism.children || []).filter(
    (c) => c.type === "ring"
  ) as RingNode[];

  // Process rings and elements
  for (let i = 0; i < rings.length; i++) {
    // Collect all windows on rings stacked above the current ring (indices > i)
    const maskIds: string[] = [];
    for (let j = i + 1; j < rings.length; j++) {
      maskIds.push(...collectRingWindows(rings[j]));
    }

    resolveNode(
      rings[i],
      Matrix2D.identity(),
      project.mechanism.visible !== false,
      maskIds,
      resolved,
      null
    );
  }

  return resolved;
}
