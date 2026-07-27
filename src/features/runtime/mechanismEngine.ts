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
  TabNode,
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
  ringId?: string;
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
  ringContext: { id: string; innerRadius: number; outerRadius: number } | null
): void {
  let localMatrix = Matrix2D.identity();
  let radialRadius = 0;
  let radialTheta = 0;
  let isRadialWarpActive = false;

  const isRadial = node.transformMode === "radial" && node.type !== "ring" && node.type !== "sector";

  if (node.type === "tab") {
    const tab = node as TabNode;
    localMatrix = Matrix2D.identity()
      .rotate(tab.angle)
      .translate(tab.radius, 0)
      .rotate(node.transform?.rotation || 0)
      .scale(node.transform?.scaleX || 1, node.transform?.scaleY || 1);
  } else if (node.transform) {
    if (isRadial) {
      const rx = node.transform.x;
      const ry = node.transform.y;
      radialRadius = Math.sqrt(rx * rx + ry * ry);
      const thetaRad = Math.atan2(ry, rx);
      let thetaDeg = (thetaRad * 180) / Math.PI;
      radialTheta = (thetaDeg % 360 + 360) % 360;

      const isWarpedType = node.type === "rectangle" || node.type === "trapezoid";

      if (isWarpedType) {
        localMatrix = localMatrix
          .rotate(radialTheta)
          .scale(node.transform.scaleX, node.transform.scaleY);
        isRadialWarpActive = true;
      } else {
        localMatrix = localMatrix
          .rotate(radialTheta)
          .translate(radialRadius, 0)
          .rotate(node.transform.rotation)
          .scale(node.transform.scaleX, node.transform.scaleY);
      }
    } else {
      localMatrix = localMatrix
        .translate(node.transform.x, node.transform.y)
        .rotate(node.transform.rotation)
        .scale(node.transform.scaleX, node.transform.scaleY);
    }
  }

  // Ring rotation
  if (node.type === "ring") {
    const ring = node as RingNode;
    localMatrix = localMatrix.rotate(ring.rotation);
    ringContext = { id: ring.id, innerRadius: ring.innerRadius, outerRadius: ring.outerRadius };
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
  if (isRadialWarpActive) {
    renderData.radialRadius = radialRadius;
    renderData.radialTheta = radialTheta;
    renderData.isRadialWarp = true;
  }
  let bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };

  // Copy elements parameters
  if ("style" in node) {
    renderData.style = (node as any).style;
  }
  if ("export" in node) {
    renderData.export = (node as any).export;
  }
  if ("edgeCurvature" in node) {
    renderData.edgeCurvature = (node as any).edgeCurvature;
  }
  if ("triangleType" in node) {
    renderData.triangleType = (node as any).triangleType;
  }

  switch (node.type) {
    case "ring": {
      const r = node as RingNode;
      renderData.innerRadius = r.innerRadius;
      renderData.outerRadius = r.outerRadius;
      renderData.rotation = r.rotation;
      renderData.ringShape = r.ringShape;
      renderData.polygonSides = r.polygonSides;
      renderData.radialSlices = r.radialSlices;
      renderData.tabShape = r.tabShape;
      renderData.tabWidth = r.tabWidth;
      renderData.tabHeight = r.tabHeight;
      renderData.tabLabel = r.tabLabel;
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
      if (isRadialWarpActive) {
        bounds = { x: 0, y: 0, width: r.width, height: r.height };
      } else {
        bounds = { x: -r.width / 2, y: -r.height / 2, width: r.width, height: r.height };
      }
      break;
    }
    case "trapezoid": {
      const tr = node as any;
      renderData.baseWidth = tr.baseWidth || 60;
      renderData.topWidth = tr.topWidth || 40;
      renderData.height = tr.height || 50;
      const maxW = Math.max(renderData.baseWidth, renderData.topWidth);
      if (isRadialWarpActive) {
        bounds = { x: 0, y: 0, width: maxW, height: renderData.height };
      } else {
        bounds = { x: -maxW / 2, y: -renderData.height / 2, width: maxW, height: renderData.height };
      }
      break;
    }
    case "crescent": {
      const cr = node as any;
      renderData.radius = cr.radius || 30;
      renderData.ratio = cr.ratio !== undefined ? cr.ratio : 0.4;
      renderData.phase = cr.phase !== undefined ? cr.phase : 0.5;
      bounds = {
        x: -renderData.radius,
        y: -renderData.radius,
        width: renderData.radius * 2,
        height: renderData.radius * 2,
      };
      break;
    }
    case "star": {
      const st = node as any;
      renderData.numPoints = st.numPoints || 5;
      renderData.innerRadius = st.innerRadius || 15;
      renderData.outerRadius = st.outerRadius || 35;
      bounds = {
        x: -renderData.outerRadius,
        y: -renderData.outerRadius,
        width: renderData.outerRadius * 2,
        height: renderData.outerRadius * 2,
      };
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
      const styles = [];
      if (t.bold) styles.push("bold");
      if (t.italic) styles.push("italic");
      renderData.fontStyle = styles.join(" ") || "normal";
      const decs = [];
      if (t.underline) decs.push("underline");
      if (t.strikethrough) decs.push("line-through");
      renderData.textDecoration = decs.join(" ") || "";

      renderData.kerning = t.kerning || 0;
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
      renderData.kerning = a.kerning || 0;
      const styles = [];
      if (a.bold) styles.push("bold");
      if (a.italic) styles.push("italic");
      renderData.fontStyle = styles.join(" ") || "normal";
      const decs = [];
      if (a.underline) decs.push("underline");
      if (a.strikethrough) decs.push("line-through");
      renderData.textDecoration = decs.join(" ") || "";

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
      const styles = [];
      if (sl.bold) styles.push("bold");
      if (sl.italic) styles.push("italic");
      renderData.fontStyle = styles.join(" ") || "normal";
      const decs = [];
      if (sl.underline) decs.push("underline");
      if (sl.strikethrough) decs.push("line-through");
      renderData.textDecoration = decs.join(" ") || "";

      bounds = { x: -50, y: -10, width: 100, height: 20 };
      break;
    }
    case "image": {
      const img = node as ImageNode;
      renderData.assetId = img.assetId;
      const w = img.width || 100;
      const h = img.height || 100;
      bounds = { x: -w / 2, y: -h / 2, width: w, height: h };
      break;
    }
    case "svgAsset": {
      const svg = node as SvgAssetNode;
      renderData.assetId = svg.assetId;
      const w = svg.width || 100;
      const h = svg.height || 100;
      bounds = { x: -w / 2, y: -h / 2, width: w, height: h };
      break;
    }
    case "tab": {
      const tab = node as TabNode;
      renderData.radius = tab.radius;
      renderData.angle = tab.angle;
      renderData.tabShape = tab.tabShape || "rectangular";
      renderData.targetRingId = tab.targetRingId;
      renderData.gearRatio = tab.gearRatio ?? 1;
      renderData.trackSweep = tab.trackSweep ?? 360;
      renderData.label = tab.label || "";
      bounds = { x: -tab.width / 2, y: -tab.height / 2, width: tab.width, height: tab.height };
      break;
    }
    case "curve": {
      const c = node as any;
      const pts = c.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
      renderData.controlPoints = pts;
      const minX = Math.min(pts.p0.x, pts.c1.x, pts.c2.x, pts.p1.x);
      const maxX = Math.max(pts.p0.x, pts.c1.x, pts.c2.x, pts.p1.x);
      const minY = Math.min(pts.p0.y, pts.c1.y, pts.c2.y, pts.p1.y);
      const maxY = Math.max(pts.p0.y, pts.c1.y, pts.c2.y, pts.p1.y);
      bounds = { x: minX, y: minY, width: Math.max(10, maxX - minX), height: Math.max(10, maxY - minY) };
      break;
    }
    case "arc": {
      const a = node as any;
      renderData.radius = a.radius;
      renderData.startAngle = a.startAngle;
      renderData.sweepAngle = a.sweepAngle;
      renderData.thickness = a.thickness || 0;
      const r = a.radius || 50;
      bounds = { x: -r, y: -r, width: r * 2, height: r * 2 };
      break;
    }
    case "window": {
      const w = node as WindowNode;
      renderData.shape = w.shape;
      if (w.shape) {
        bounds = computeLocalBounds(w.shape);
      }
      break;
    }
    case "group": {
      bounds = computeLocalBounds(node);
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
    ringId: ringContext ? ringContext.id : undefined,
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

function computeLocalBounds(node: BaseNode): { x: number; y: number; width: number; height: number } {
  if (node.type === "window" && (node as any).shape) {
    return computeLocalBounds((node as any).shape);
  }
  if (node.type === "rectangle") {
    const w = (node as any).width || 20;
    const h = (node as any).height || 20;
    return { x: -w / 2, y: -h / 2, width: w, height: h };
  }
  if (node.type === "circle") {
    const r = (node as any).radius || 10;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  }
  if (node.type === "star") {
    const r = (node as any).outerRadius || 35;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  }
  if (node.type === "crescent") {
    const r = (node as any).radius || 30;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  }
  if (node.type === "polygon") {
    const r = (node as any).radius || 10;
    return { x: -r, y: -r, width: r * 2, height: r * 2 };
  }
  if (node.type === "trapezoid") {
    const baseW = (node as any).baseWidth || 60;
    const topW = (node as any).topWidth || 40;
    const maxW = Math.max(baseW, topW);
    const h = (node as any).height || 50;
    return { x: -maxW / 2, y: -h / 2, width: maxW, height: h };
  }
  if (node.type === "line") {
    const l = (node as any).length || 20;
    const t = (node as any).thickness || 2;
    return { x: 0, y: -t / 2, width: l, height: t };
  }
  if (node.type === "text" || node.type === "sectorLabel") {
    const fs = (node as any).fontSize || 14;
    const len = ((node as any).content || "").length || 4;
    const w = len * fs * 0.6;
    return { x: 0, y: -fs, width: w, height: fs };
  }
  if (node.type === "arcText") {
    const fs = (node as any).fontSize || 12;
    const r = (node as any).radius || 50;
    const w = (r + fs) * 2;
    return { x: -w / 2, y: -w / 2, width: w, height: w };
  }
  if (node.type === "image" || node.type === "svgAsset") {
    return { x: -50, y: -50, width: 100, height: 100 };
  }
  if (node.type === "group" && node.children) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const child of node.children) {
      const b = computeLocalBounds(child);
      // Transform local child bounds by child's transform
      const left = child.transform.x + b.x;
      const right = child.transform.x + b.x + b.width;
      const top = child.transform.y + b.y;
      const bottom = child.transform.y + b.y + b.height;
      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bottom);
    }
    if (minX !== Infinity) {
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
  return { x: -10, y: -10, width: 20, height: 20 };
}
