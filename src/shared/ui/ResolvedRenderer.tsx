import React, { useState, useEffect } from "react";
import {
  Group,
  Arc,
  Circle,
  Rect,
  Line,
  RegularPolygon,
  Text,
  Image as KonvaImage,
  Star,
  Shape,
} from "react-konva";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import { useProjectStore } from "../../features/project/projectStore";
import { useToolStore } from "../../features/tools/toolStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { loadFont, drawTextGlyphsToContext } from "../utils/fontManager";
import { getArcTextCharPositions } from "../utils/textGeometry";
import { findRingForNode } from "../utils/geometry";

const RING_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#06b6d4", // Cyan
];

interface MaskedGroupProps {
  maskIds: string[];
  allNodes: ResolvedNode[];
  children: React.ReactNode;
}

function getPolygonVertices(
  sides: number,
  radius: number,
  triangleType?: "equilateral" | "isosceles" | "right"
) {
  const vertices: { x: number; y: number }[] = [];

  if (sides === 3 && triangleType) {
    if (triangleType === "right") {
      const w = radius * 1.5;
      const h = radius * 1.5;
      vertices.push({ x: -w / 3, y: h * (2 / 3) });
      vertices.push({ x: w * (2 / 3), y: h * (2 / 3) });
      vertices.push({ x: -w / 3, y: -h / 3 });
      return vertices;
    } else if (triangleType === "isosceles") {
      const w = radius * 1.2;
      const h = radius * 1.8;
      vertices.push({ x: 0, y: -h / 2 });
      vertices.push({ x: w / 2, y: h / 2 });
      vertices.push({ x: -w / 2, y: h / 2 });
      return vertices;
    }
  }

  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    vertices.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }
  return vertices;
}

function drawPolygonPath(
  ctx: any,
  radius: number,
  sides: number,
  counterClockwise: boolean = false,
  curvature: number = 0,
  triangleType?: "equilateral" | "isosceles" | "right"
) {
  const numSides = Math.max(3, sides);
  const vertices = getPolygonVertices(numSides, radius, triangleType);

  if (curvature === 0) {
    if (!counterClockwise) {
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < numSides; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
    } else {
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = numSides - 1; i >= 1; i--) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
    }
    ctx.closePath();
    return;
  }

  if (!counterClockwise) {
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 0; i < numSides; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % numSides];

      const mx = (v1.x + v2.x) / 2;
      const my = (v1.y + v2.y) / 2;

      const len = Math.hypot(mx, my);
      const nx = len > 0 ? mx / len : 0;
      const ny = len > 0 ? my / len : 0;

      const offsetDist = curvature * (radius * 0.4);
      const cx = mx + nx * offsetDist;
      const cy = my + ny * offsetDist;

      ctx.quadraticCurveTo(cx, cy, v2.x, v2.y);
    }
  } else {
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = numSides; i >= 1; i--) {
      const v1 = vertices[i % numSides];
      const v2 = vertices[i - 1];

      const mx = (v1.x + v2.x) / 2;
      const my = (v1.y + v2.y) / 2;

      const len = Math.hypot(mx, my);
      const nx = len > 0 ? mx / len : 0;
      const ny = len > 0 ? my / len : 0;

      const offsetDist = curvature * (radius * 0.4);
      const cx = mx + nx * offsetDist;
      const cy = my + ny * offsetDist;

      ctx.quadraticCurveTo(cx, cy, v2.x, v2.y);
    }
  }
  ctx.closePath();
}

function drawAddShapePath(ctx: any, shape: any) {
  if (!shape) return;
  if (shape.type === "circle") {
    const r = shape.radius || 10;
    ctx.moveTo(r, 0);
    ctx.arc(0, 0, r, 0, Math.PI * 2, false);
  } else if (shape.type === "rectangle") {
    const w = (shape.width || 20) / 2;
    const h = (shape.height || 20) / 2;
    ctx.moveTo(-w, -h);
    ctx.rect(-w, -h, shape.width || 20, shape.height || 20);
  } else if (shape.type === "polygon") {
    drawPolygonPath(ctx, shape.radius || 10, shape.sides || 3, false, shape.edgeCurvature || 0, shape.triangleType);
  } else if (shape.type === "star") {
    const numPts = shape.numPoints || 5;
    const innerRad = shape.innerRadius || 15;
    const outerRad = shape.outerRadius || 35;
    const totalPts = numPts * 2;
    ctx.moveTo(outerRad * Math.cos(-Math.PI / 2), outerRad * Math.sin(-Math.PI / 2));
    for (let i = 1; i <= totalPts; i++) {
      const angle = (i * Math.PI) / numPts - Math.PI / 2;
      const r = i % 2 === 0 ? outerRad : innerRad;
      ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
    }
    ctx.closePath();
  } else if (shape.type === "trapezoid") {
    const bw = (shape.baseWidth || 60) / 2;
    const tw = (shape.topWidth || 40) / 2;
    const hh = (shape.height || 50) / 2;
    ctx.moveTo(-bw, hh);
    ctx.lineTo(bw, hh);
    ctx.lineTo(tw, -hh);
    ctx.lineTo(-tw, -hh);
    ctx.closePath();
  } else if (shape.type === "crescent") {
    const r = shape.radius || 30;
    const phaseVal = shape.phase !== undefined ? shape.phase : 0.5;
    ctx.moveTo(0, -r);
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    if (ctx.ellipse) {
      ctx.ellipse(0, 0, Math.abs(r * phaseVal), r, 0, Math.PI / 2, -Math.PI / 2, phaseVal < 0);
    }
    ctx.closePath();
  } else if (shape.type === "text" || shape.type === "sectorLabel") {
    const fs = shape.fontSize || 14;
    const content = shape.content || "Text";
    const drawn = drawTextGlyphsToContext(ctx, content, fs, false);
    if (!drawn) {
      const len = content.length || 4;
      const w = len * fs * 0.6;
      ctx.moveTo(0, -fs);
      ctx.rect(0, -fs, w, fs);
    }
  } else if (shape.type === "arcText") {
    const radius = shape.radius || 100;
    const fontSize = shape.fontSize || 12;
    const startAngle = (shape.startAngle || 0) * (Math.PI / 180);
    const sweepAngle = (shape.sweepAngle || 40) * (Math.PI / 180);
    const innerR = radius - fontSize * 0.8;
    const outerR = radius + fontSize * 0.8;
    ctx.moveTo(outerR * Math.cos(startAngle), outerR * Math.sin(startAngle));
    ctx.arc(0, 0, outerR, startAngle, startAngle + sweepAngle, false);
    ctx.arc(0, 0, innerR, startAngle + sweepAngle, startAngle, true);
    ctx.closePath();
  } else if (shape.type === "line") {
    const len = shape.length || 50;
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
  } else if (shape.type === "curve") {
    const pts = shape.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
    ctx.moveTo(pts.p0.x, pts.p0.y);
    ctx.bezierCurveTo(pts.c1.x, pts.c1.y, pts.c2.x, pts.c2.y, pts.p1.x, pts.p1.y);
  } else if (shape.type === "arc") {
    const r = shape.radius || 50;
    const startAngle = ((shape.startAngle || 0) * Math.PI) / 180;
    const sweepAngle = ((shape.sweepAngle || 90) * Math.PI) / 180;
    const x1 = r * Math.cos(startAngle);
    const y1 = r * Math.sin(startAngle);
    ctx.moveTo(x1, y1);
    ctx.arc(0, 0, r, startAngle, startAngle + sweepAngle, false);
  }
}

function drawSubtractShapePath(ctx: any, shape: any) {
  if (!shape) return;
  if (shape.type === "circle") {
    const r = shape.radius || 10;
    ctx.moveTo(r, 0);
    ctx.arc(0, 0, r, 0, Math.PI * 2, true); // true = counter-clockwise subtraction
  } else if (shape.type === "rectangle") {
    const w = (shape.width || 20) / 2;
    const h = (shape.height || 20) / 2;
    ctx.moveTo(-w, -h);
    ctx.lineTo(-w, h);
    ctx.lineTo(w, h);
    ctx.lineTo(w, -h);
    ctx.closePath();
  } else if (shape.type === "polygon") {
    drawPolygonPath(ctx, shape.radius || 10, shape.sides || 3, true, shape.edgeCurvature || 0, shape.triangleType);
  } else if (shape.type === "star") {
    const numPts = shape.numPoints || 5;
    const innerRad = shape.innerRadius || 15;
    const outerRad = shape.outerRadius || 35;
    const totalPts = numPts * 2;
    ctx.moveTo(outerRad * Math.cos(-Math.PI / 2), outerRad * Math.sin(-Math.PI / 2));
    for (let i = totalPts - 1; i >= 0; i--) {
      const angle = (i * Math.PI) / numPts - Math.PI / 2;
      const r = i % 2 === 0 ? outerRad : innerRad;
      ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
    }
    ctx.closePath();
  } else if (shape.type === "trapezoid") {
    const bw = (shape.baseWidth || 60) / 2;
    const tw = (shape.topWidth || 40) / 2;
    const hh = (shape.height || 50) / 2;
    ctx.moveTo(-bw, hh);
    ctx.lineTo(-tw, -hh);
    ctx.lineTo(tw, -hh);
    ctx.lineTo(bw, hh);
    ctx.closePath();
  } else if (shape.type === "crescent") {
    const r = shape.radius || 30;
    const phaseVal = shape.phase !== undefined ? shape.phase : 0.5;
    ctx.moveTo(0, r);
    ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, true);
    if (ctx.ellipse) {
      ctx.ellipse(0, 0, Math.abs(r * phaseVal), r, 0, -Math.PI / 2, Math.PI / 2, phaseVal >= 0);
    }
    ctx.closePath();
  } else if (shape.type === "text" || shape.type === "sectorLabel") {
    const fs = shape.fontSize || 14;
    const content = shape.content || "Text";
    const drawn = drawTextGlyphsToContext(ctx, content, fs, true);
    if (!drawn) {
      const len = content.length || 4;
      const w = len * fs * 0.6;
      ctx.moveTo(0, -fs);
      ctx.lineTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, -fs);
      ctx.closePath();
    }
  } else if (shape.type === "arcText") {
    const radius = shape.radius || 100;
    const fontSize = shape.fontSize || 12;
    const startAngle = (shape.startAngle || 0) * (Math.PI / 180);
    const sweepAngle = (shape.sweepAngle || 40) * (Math.PI / 180);
    const innerR = radius - fontSize * 0.8;
    const outerR = radius + fontSize * 0.8;
    ctx.moveTo(outerR * Math.cos(startAngle), outerR * Math.sin(startAngle));
    ctx.arc(0, 0, outerR, startAngle, startAngle + sweepAngle, true);
    ctx.arc(0, 0, innerR, startAngle + sweepAngle, startAngle, false);
    ctx.closePath();
  } else if (shape.type === "line") {
    const len = shape.length || 50;
    ctx.moveTo(len, 0);
    ctx.lineTo(0, 0);
  } else if (shape.type === "curve") {
    const pts = shape.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
    ctx.moveTo(pts.p1.x, pts.p1.y);
    ctx.bezierCurveTo(pts.c2.x, pts.c2.y, pts.c1.x, pts.c1.y, pts.p0.x, pts.p0.y);
  } else if (shape.type === "arc") {
    const r = shape.radius || 50;
    const startAngle = ((shape.startAngle || 0) * Math.PI) / 180;
    const sweepAngle = ((shape.sweepAngle || 90) * Math.PI) / 180;
    const x2 = r * Math.cos(startAngle + sweepAngle);
    const y2 = r * Math.sin(startAngle + sweepAngle);
    ctx.moveTo(x2, y2);
    ctx.arc(0, 0, r, startAngle + sweepAngle, startAngle, true);
  }
}

const MaskedGroup: React.FC<MaskedGroupProps> = ({ maskIds, allNodes, children }) => {
  const project = useProjectStore((state) => state.project);

  if (maskIds.length === 0) {
    return <>{children}</>;
  }

  // Group mask IDs by their parent masking ring ID
  const maskMap = new Map<string, string[]>();
  for (const id of maskIds) {
    const ringId = findRingForNode(project, id);
    if (ringId) {
      if (!maskMap.has(ringId)) maskMap.set(ringId, []);
      maskMap.get(ringId)!.push(id);
    }
  }

  const ringEntries = Array.from(maskMap.entries());
  if (ringEntries.length === 0) {
    return <>{children}</>;
  }

  let content = <>{children}</>;

  for (const [ringId, winIds] of ringEntries) {
    const maskRing = allNodes.find((n) => n.id === ringId);
    if (!maskRing || !maskRing.visible) continue;

    const windowNodes = winIds
      .map((id) => allNodes.find((n) => n.id === id))
      .filter((n): n is ResolvedNode => !!n && n.type === "window" && !!n.renderData.shape);

    if (windowNodes.length === 0) continue;

    const clipFunc = (context: any) => {
      const ctx = context._context || context;
      ctx.save();

      // 1. Draw a very large concentric circle representing the visible universe
      ctx.beginPath();
      ctx.moveTo(10000, 0);
      ctx.arc(0, 0, 10000, 0, Math.PI * 2, false);

      // Rotate context by masking ring's rotation for paper disc boundaries
      const ringRot = maskRing.worldTransform?.rotation ?? maskRing.renderData?.rotation ?? 0;
      const ringRotRad = (ringRot * Math.PI) / 180;

      ctx.save();
      if (ringRotRad !== 0) {
        ctx.rotate(ringRotRad);
      }

      // 2. Draw the masking ring outer boundary counter-clockwise (subtracting it)
      const outerRadius = maskRing.renderData.outerRadius || 100;
      const isPoly = maskRing.renderData.ringShape === "polygon";
      const sides = maskRing.renderData.polygonSides || 6;
      const curvature = maskRing.renderData.edgeCurvature || 0;
      const triType = maskRing.renderData.triangleType;

      if (isPoly) {
        drawPolygonPath(ctx, outerRadius, sides, true, curvature, triType);
      } else {
        ctx.moveTo(outerRadius, 0);
        ctx.arc(0, 0, outerRadius, 0, Math.PI * 2, true);
      }

      // 3. Draw the masking ring inner circle clockwise (adding it back)
      const innerRadius = maskRing.renderData.innerRadius || 0;
      if (innerRadius > 0) {
        ctx.moveTo(innerRadius, 0);
        ctx.arc(0, 0, innerRadius, 0, Math.PI * 2, false);
      }
      ctx.restore();

      // 4. Draw ALL window cutout shapes on this masking ring clockwise (adding them back in parallel)
      for (const winNode of windowNodes) {
        const windowTransform = winNode.worldTransform;
        const shape = winNode.renderData.shape;

        ctx.save();
        ctx.translate(windowTransform.x, windowTransform.y);
        ctx.rotate((windowTransform.rotation * Math.PI) / 180);
        ctx.scale(windowTransform.scaleX, windowTransform.scaleY);

        drawAddShapePath(ctx, shape);
        ctx.restore();
      }

      ctx.restore();
    };

    content = <Group clipFunc={clipFunc}>{content}</Group>;
  }

  return content;
};

const SelfMaskedGroup: React.FC<{
  node: ResolvedNode;
  allNodes: ResolvedNode[];
  children: React.ReactNode;
}> = ({ node, allNodes, children }) => {
  const project = useProjectStore((state) => state.project);

  if (node.type === "window") {
    return <>{children}</>;
  }

  const nodeRingId = findRingForNode(project, node.id);
  if (!nodeRingId) {
    return <>{children}</>;
  }

  const selfWindows = allNodes.filter(
    (n) => n.type === "window" && findRingForNode(project, n.id) === nodeRingId
  );

  if (selfWindows.length === 0) {
    return <>{children}</>;
  }

  const clipFunc = (context: any) => {
    const ctx = context._context || context;
    ctx.save();

    // 1. Draw a very large concentric circle representing the visible universe (clockwise)
    ctx.beginPath();
    ctx.moveTo(10000, 0);
    ctx.arc(0, 0, 10000, 0, Math.PI * 2, false);

    // 2. Draw each window cutout shape counter-clockwise (subtracting it)
    for (const win of selfWindows) {
      const windowTransform = win.worldTransform;
      const shape = win.renderData.shape;
      if (!shape) continue;

      ctx.save();
      ctx.translate(windowTransform.x, windowTransform.y);
      ctx.rotate((windowTransform.rotation * Math.PI) / 180);
      ctx.scale(windowTransform.scaleX, windowTransform.scaleY);

      drawSubtractShapePath(ctx, shape);
      ctx.restore();
    }

    ctx.restore();
  };

  return <Group clipFunc={clipFunc}>{children}</Group>;
};

const KonvaImageRenderer: React.FC<{ node: ResolvedNode; assets: any[] }> = ({
  node,
  assets,
}) => {
  const assetId = node.renderData.assetId;
  const asset = assets?.find((a) => a.id === assetId);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (asset?.embeddedData) {
      const img = new window.Image();
      img.src = asset.embeddedData;
      img.onload = () => {
        if (img.width > 0 && img.height > 0) {
          setImageEl(img);
        }
      };
      img.onerror = () => {
        setImageEl(null);
      };
    } else {
      setImageEl(null);
    }
  }, [asset]);

  const { width = 100, height = 100 } = node.bounds;
  const crop = node.renderData.crop;

  if (imageEl && imageEl.complete && imageEl.width > 0 && imageEl.height > 0 && width > 0 && height > 0) {
    const konvaImg = (
      <KonvaImage
        image={imageEl}
        crop={crop ? { x: crop.x, y: crop.y, width: crop.width, height: crop.height } : undefined}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
      />
    );

    if (crop?.shape === "circle") {
      const circleR = crop.radius || Math.min(width, height) / 2;
      return (
        <Group clipFunc={(context) => {
          const ctx = context._context || context;
          ctx.beginPath();
          ctx.arc(0, 0, circleR, 0, Math.PI * 2, false);
          ctx.closePath();
        }}>
          {konvaImg}
        </Group>
      );
    }

    if (crop?.shape === "radialTrapezoid") {
      const sweepDeg = crop.sweepAngle || 60;
      const halfSweep = (sweepDeg / 2) * (Math.PI / 180);
      const outerR = crop.outerRadius || Math.max(width, height) / 2;
      const innerR = Math.max(0, crop.innerRadius || 0);

      return (
        <Group clipFunc={(context) => {
          const ctx = context._context || context;
          ctx.beginPath();
          ctx.arc(0, 0, outerR, -halfSweep - Math.PI / 2, halfSweep - Math.PI / 2, false);
          if (innerR > 0) {
            ctx.arc(0, 0, innerR, halfSweep - Math.PI / 2, -halfSweep - Math.PI / 2, true);
          } else {
            ctx.lineTo(0, 0);
          }
          ctx.closePath();
        }}>
          {konvaImg}
        </Group>
      );
    }

    return konvaImg;
  }

  // Placeholder outline when image is not loaded
  return (
    <Group>
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        stroke="#475569"
        strokeWidth={1}
        dash={[4, 4]}
        fill="rgba(71, 85, 105, 0.1)"
      />
      <Line points={[-width / 2, -height / 2, width / 2, height / 2]} stroke="#475569" strokeWidth={1} />
      <Line points={[width / 2, -height / 2, -width / 2, height / 2]} stroke="#475569" strokeWidth={1} />
    </Group>
  );
};const TabRenderer: React.FC<{ node: ResolvedNode }> = ({ node }) => {
  const { radius = 100, tabShape = "rectangular", trackSweep = 360, label = "" } = node.renderData;
  const width = node.bounds?.width || 30;
  const height = node.bounds?.height || 20;
  const style = node.renderData.style || {};

  const fill = style.fill || "#3b82f6";
  const stroke = style.stroke || "#1e3a8a";
  const strokeWidth = style.strokeWidth ?? 1.5;

  let renderShape = null;

  if (tabShape === "semicircular") {
    renderShape = (
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={[0, height / 2, height / 2, 0]}
      />
    );
  } else if (tabShape === "trapezoidal") {
    const pts = [
      -width / 2, -height / 2,
       width / 2, -height / 3,
       width / 2,  height / 3,
      -width / 2,  height / 2
    ];
    renderShape = (
      <Line
        points={pts}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  } else {
    renderShape = (
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={4}
      />
    );
  }

  const textFill = style.stroke || "#1e293b";

  return (
    <Group>
      {/* Visual track line guide if it is constrained to a slot */}
      {trackSweep < 360 && (
        <Arc
          x={-radius}
          y={0}
          innerRadius={radius - 2}
          outerRadius={radius + 2}
          angle={trackSweep}
          rotation={-trackSweep / 2}
          stroke="#475569"
          strokeWidth={1}
          dash={[3, 3]}
          fill="rgba(71, 85, 105, 0.1)"
        />
      )}
      {renderShape}
      {label && (
        <Text
          text={label}
          fontSize={Math.min(10, height - 4)}
          fontFamily="Outfit, Inter, sans-serif"
          fill={textFill}
          align="center"
          verticalAlign="middle"
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
        />
      )}
    </Group>
  );
};

/**
 * Renders a disc-attached tab in its local canvas space.
 * The tab Group is already positioned+rotated to the ring edge by the engine;
 * we only need to draw the tab shape starting at y=0 (ring surface) and
 * protruding to y=+height (radially outward).
 */
const DiscTabRenderer: React.FC<{ node: ResolvedNode }> = ({ node }) => {
  const { width = 30, height = 18, cornerRadius = 4, tabShape = "semicircular", label = "", style = {} } = node.renderData;
  const fill = style.fill || "#6366f1";
  const stroke = style.stroke || "#3730a3";
  const strokeWidth = style.strokeWidth ?? 1.5;
  const hw = width / 2;
  const cr = Math.min(cornerRadius, hw, height / 2);

  return (
    <Group>
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          if (tabShape === "rectangular") {
            ctx.moveTo(-hw, 0);
            ctx.lineTo(-hw, Math.max(0, height - cr));
            ctx.arcTo(-hw, height, -hw + cr, height, cr);
            ctx.lineTo(hw - cr, height);
            ctx.arcTo(hw, height, hw, Math.max(0, height - cr), cr);
            ctx.lineTo(hw, 0);
            ctx.closePath();
          } else if (tabShape === "semicircular") {
            const domeR = Math.min(hw, height);
            const rectH = Math.max(0, height - domeR);
            ctx.moveTo(-hw, 0);
            ctx.lineTo(-hw, rectH);
            ctx.arc(0, rectH, domeR, Math.PI, 0, true);
            ctx.lineTo(hw, 0);
            ctx.closePath();
          } else {
            // trapezoidal — narrower at top
            const topHw = hw * 0.6;
            ctx.moveTo(-hw, 0);
            ctx.lineTo(-topHw, height);
            ctx.lineTo(topHw, height);
            ctx.lineTo(hw, 0);
            ctx.closePath();
          }
          ctx.fillStrokeShape(shape);
        }}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {label && (
        <Text
          text={label}
          x={-hw}
          y={height * 0.25}
          width={width}
          height={height * 0.5}
          fontSize={Math.min(10, height * 0.4)}
          fontFamily="Outfit, sans-serif"
          fill="#ffffff"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      )}
    </Group>
  );
};

const ArcTextRenderer: React.FC<{ node: ResolvedNode }> = ({ node }) => {
  const {
    content,
    radius,
    startAngle,
    fontFamily,
    fontSize,
    kerning,
    style,
  } = node.renderData;

  if (!content) return null;

  const layout = getArcTextCharPositions(
    content,
    radius || 100,
    startAngle || 0,
    fontSize || 12,
    fontFamily || "Outfit, Inter, sans-serif",
    kerning || 0
  );

  return (
    <Group>
      {layout.charPositions.map((cp, i) => (
        <Text
          key={i}
          text={cp.char}
          x={cp.x}
          y={cp.y}
          fontFamily={fontFamily || "Outfit, Inter, sans-serif"}
          fontSize={fontSize || 12}
          fill={style?.fill || "#f1f5f9"}
          fontStyle={node.renderData.fontStyle || "normal"}
          textDecoration={node.renderData.textDecoration || ""}
          align="center"
          offsetX={(fontSize || 12) * 0.3}
          offsetY={(fontSize || 12) * 0.5}
          rotation={cp.rotation}
        />
      ))}
    </Group>
  );
};

const WindowOutlineRenderer: React.FC<{ node: ResolvedNode }> = ({ node }) => {
  const shape = node.renderData.shape;
  if (!shape) return null;

  const stroke = "rgba(99, 102, 241, 0.8)";
  const strokeWidth = 1.5;
  const dash = [4, 4];
  const fill = "rgba(99, 102, 241, 0.05)";

  if (shape.type === "circle") {
    return (
      <Circle
        radius={shape.radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "rectangle") {
    return (
      <Rect
        x={-shape.width / 2}
        y={-shape.height / 2}
        width={shape.width}
        height={shape.height}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "polygon") {
    return (
      <RegularPolygon
        sides={shape.sides || 3}
        radius={shape.radius || 10}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "star") {
    return (
      <Star
        numPoints={shape.numPoints || 5}
        innerRadius={shape.innerRadius || 15}
        outerRadius={shape.outerRadius || 35}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "trapezoid") {
    const bw = (shape.baseWidth || 60) / 2;
    const tw = (shape.topWidth || 40) / 2;
    const hh = (shape.height || 50) / 2;
    const pts = [-bw, hh, bw, hh, tw, -hh, -tw, -hh];
    return (
      <Line
        points={pts}
        closed
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "crescent") {
    const r = shape.radius || 30;
    const ratio = shape.ratio !== undefined ? shape.ratio : 0.4;
    const innerR = r * (1 - ratio);
    const offsetX = r - innerR;
    return (
      <Shape
        sceneFunc={(ctx, konvaShape) => {
          ctx.beginPath();
          ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
          ctx.arc(offsetX, 0, innerR, Math.PI / 2, -Math.PI / 2, true);
          ctx.closePath();
          ctx.fillStrokeShape(konvaShape);
        }}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "line") {
    return (
      <Line
        points={[0, 0, shape.length || 50, 0]}
        stroke={stroke}
        strokeWidth={shape.thickness || 2}
        dash={dash}
      />
    );
  } else if (shape.type === "arcText") {
    const content = shape.content || "Arc Text";
    const radius = shape.radius || 100;
    const startAngle = shape.startAngle || 0;
    const fontFamily = shape.fontFamily || "Outfit, Inter, sans-serif";
    const fontSize = shape.fontSize || 12;
    const kerning = shape.kerning || 0;

    const layout = getArcTextCharPositions(
      content,
      radius,
      startAngle,
      fontSize,
      fontFamily,
      kerning
    );

    return (
      <Group>
        {layout.charPositions.map((cp, i) => (
          <Text
            key={i}
            text={cp.char}
            x={cp.x}
            y={cp.y}
            fontFamily={fontFamily}
            fontSize={fontSize}
            fill="transparent"
            stroke={stroke}
            strokeWidth={strokeWidth}
            dash={dash}
            align="center"
            offsetX={fontSize * 0.3}
            offsetY={fontSize * 0.5}
            rotation={cp.rotation}
          />
        ))}
      </Group>
    );
  } else if (shape.type === "text" || shape.type === "sectorLabel") {
    return (
      <Text
        text={shape.content || "Text"}
        fontSize={shape.fontSize || 14}
        fontFamily={shape.fontFamily || "Outfit, Inter, sans-serif"}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1}
        dash={dash}
        x={0}
        y={-(shape.fontSize || 14)}
      />
    );
  }
  return null;
};

const renderSpecificNode = (node: ResolvedNode, assets: any[]) => {
  const { style, innerRadius, outerRadius, startAngle, endAngle, radius, width, height, length, thickness, sides, content, fontFamily, fontSize } = node.renderData;

  switch (node.type) {
    case "ring": {
      const isPolygon = node.renderData.ringShape === "polygon";
      const polySides = node.renderData.polygonSides || 6;
      const curvature = node.renderData.edgeCurvature || 0;
      const triType = node.renderData.triangleType;

      return (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            if (isPolygon) {
              drawPolygonPath(ctx, outerRadius || 100, polySides, false, curvature, triType);
            } else {
              ctx.arc(0, 0, outerRadius || 100, 0, Math.PI * 2, false);
            }
            if ((innerRadius || 0) > 0) {
              ctx.moveTo(innerRadius, 0);
              ctx.arc(0, 0, innerRadius, 0, Math.PI * 2, true);
            }
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          stroke={style?.stroke || "#475569"}
          strokeWidth={style?.strokeWidth || 1.5}
          fill={style?.fill || "rgba(30, 41, 59, 0.25)"}
        />
      );
    }

    case "sector": {
      const sweepAngle = (endAngle || 0) - (startAngle || 0);
      return (
        <Arc
          innerRadius={innerRadius || 0}
          outerRadius={outerRadius || 100}
          angle={sweepAngle}
          rotation={0}
          fill={style?.fill || "rgba(51, 65, 85, 0.3)"}
          stroke={style?.stroke || "#64748b"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );
    }

    case "circle":
      return (
        <Circle
          radius={radius || 10}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );

    case "rectangle": {
      const isRadial = node.renderData.isRadialWarp;
      if (isRadial) {
        const r = node.renderData.radialRadius || 100;
        const inner = Math.max(0, r - (height || 0) / 2);
        const outer = r + (height || 0) / 2;
        const w = width || 30; // angular sweep (degrees)
        return (
          <Arc
            innerRadius={inner}
            outerRadius={outer}
            angle={w}
            rotation={-w / 2}
            fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
            stroke={style?.stroke || "#94a3b8"}
            strokeWidth={style?.strokeWidth || 1}
          />
        );
      }
      return (
        <Rect
          x={-(width || 0) / 2}
          y={-(height || 0) / 2}
          width={width || 0}
          height={height || 0}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );
    }

    case "trapezoid": {
      const isRadial = node.renderData.isRadialWarp;
      const baseW = node.renderData.baseWidth || 60;
      const topW = node.renderData.topWidth || 40;
      const h = height || 50;
      const fillVal = style?.fill || "rgba(226, 232, 240, 0.15)";
      const strokeVal = style?.stroke || "#94a3b8";
      const strokeW = style?.strokeWidth || 1;

      if (isRadial) {
        const r = node.renderData.radialRadius || 100;
        const outerR = r + h / 2;
        const innerR = Math.max(0, r - h / 2);
        const baseHalfRad = (baseW / 2) * Math.PI / 180;
        const topHalfRad = (topW / 2) * Math.PI / 180;

        return (
          <Shape
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();
              // Concentric outer arc from -baseHalfRad to +baseHalfRad
              ctx.arc(0, 0, outerR, -baseHalfRad, baseHalfRad, false);
              // Line to inner arc end
              const innerEndX = innerR * Math.cos(topHalfRad);
              const innerEndY = innerR * Math.sin(topHalfRad);
              ctx.lineTo(innerEndX, innerEndY);
              // Concentric inner arc from +topHalfRad to -topHalfRad (anticlockwise)
              ctx.arc(0, 0, innerR, topHalfRad, -topHalfRad, true);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            fill={fillVal}
            stroke={strokeVal}
            strokeWidth={strokeW}
          />
        );
      }

      return (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(-topW / 2, -h / 2);
            ctx.lineTo(topW / 2, -h / 2);
            ctx.lineTo(baseW / 2, h / 2);
            ctx.lineTo(-baseW / 2, h / 2);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          fill={fillVal}
          stroke={strokeVal}
          strokeWidth={strokeW}
        />
      );
    }

    case "crescent": {
      const r = radius || 30;
      const phaseVal = node.renderData.phase !== undefined ? node.renderData.phase : 0.5; // -1 to 1
      const fillVal = style?.fill || "rgba(226, 232, 240, 0.15)";
      const strokeVal = style?.stroke || "#94a3b8";
      const strokeW = style?.strokeWidth || 1;

      return (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            // Outer semi-circle (right side)
            ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
            // Inner crescent ellipse (scaled horizontally by phaseVal)
            ctx.ellipse(0, 0, Math.abs(r * phaseVal), r, 0, Math.PI / 2, -Math.PI / 2, phaseVal < 0);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          fill={fillVal}
          stroke={strokeVal}
          strokeWidth={strokeW}
        />
      );
    }

    case "star": {
      const numPts = node.renderData.numPoints || 5;
      const innerRad = node.renderData.innerRadius || 15;
      const outerRad = node.renderData.outerRadius || 35;
      return (
        <Star
          numPoints={numPts}
          innerRadius={innerRad}
          outerRadius={outerRad}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );
    }

    case "line":
      return (
        <Line
          points={[0, 0, length || 0, 0]}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={thickness || style?.strokeWidth || 2}
        />
      );

    case "curve": {
      const pts = node.renderData.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
      const strokeVal = style?.stroke || "#3b82f6";
      const strokeW = thickness || style?.strokeWidth || 2;
      return (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(pts.p0.x, pts.p0.y);
            ctx.bezierCurveTo(pts.c1.x, pts.c1.y, pts.c2.x, pts.c2.y, pts.p1.x, pts.p1.y);
            ctx.fillStrokeShape(shape);
          }}
          stroke={strokeVal}
          strokeWidth={strokeW}
        />
      );
    }

    case "arc": {
      const r = radius || 50;
      const startDeg = node.renderData.startAngle || 0;
      const sweepDeg = node.renderData.sweepAngle || 90;
      const thick = node.renderData.thickness || 0;
      const strokeVal = style?.stroke || "#3b82f6";
      const strokeW = thick || style?.strokeWidth || 2;
      return (
        <Arc
          innerRadius={thick > 0 ? Math.max(1, r - thick / 2) : r}
          outerRadius={thick > 0 ? r + thick / 2 : r}
          angle={sweepDeg}
          rotation={startDeg}
          stroke={strokeVal}
          strokeWidth={thick > 0 ? 0 : strokeW}
          fill={thick > 0 ? (style?.fill || strokeVal) : "transparent"}
        />
      );
    }

    case "polygon": {
      const curvature = node.renderData.edgeCurvature || 0;
      const triType = node.renderData.triangleType;
      if (Math.abs(curvature) > 0.001 || ((sides || 3) === 3 && triType && triType !== "equilateral")) {
        return (
          <Shape
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();
              drawPolygonPath(ctx, radius || 10, sides || 3, false, curvature, triType);
              ctx.fillStrokeShape(shape);
            }}
            fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
            stroke={style?.stroke || "#94a3b8"}
            strokeWidth={style?.strokeWidth || 1}
          />
        );
      }
      return (
        <RegularPolygon
          sides={sides || 3}
          radius={radius || 10}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );
    }

    case "text": {
      const editingTextNodeId = useToolStore.getState().editingTextNodeId;
      const isEditing = editingTextNodeId === node.id;
      return (
        <Text
          text={content || ""}
          fontFamily={fontFamily || "Outfit, Inter, sans-serif"}
          fontSize={fontSize || 14}
          fill={style?.fill || "#f1f5f9"}
          fontStyle={node.renderData.fontStyle || "normal"}
          textDecoration={node.renderData.textDecoration || ""}
          x={0}
          y={-(fontSize || 14)}
          visible={!isEditing}
        />
      );
    }

    case "arcText":
      return <ArcTextRenderer node={node} />;

    case "sectorLabel":
      return (
        <Text
          text={content || ""}
          fontFamily={fontFamily || "Outfit, Inter, sans-serif"}
          fontSize={fontSize || 12}
          fill={style?.fill || "#cbd5e1"}
          fontStyle={node.renderData.fontStyle || "normal"}
          textDecoration={node.renderData.textDecoration || ""}
          align="center"
          x={-50}
          y={-10}
          width={100}
          height={20}
        />
      );

    case "image":
    case "svgAsset":
      return <KonvaImageRenderer node={node} assets={assets} />;

    case "window":
      return <WindowOutlineRenderer node={node} />;

    case "tab":
      return <TabRenderer node={node} />;

    case "discTab":
      return <DiscTabRenderer node={node} />;

    default:
      return null;
  }
};

interface ResolvedRendererProps {
  nodes: ResolvedNode[];
}

export const ResolvedRenderer: React.FC<ResolvedRendererProps> = ({ nodes }) => {
  const assets = useProjectStore((state) => state.project.assets || []);
  const activeItem = useSelectionStore((state) => state.activeItem);
  const [, setFontLoaded] = useState(false);

  useEffect(() => {
    loadFont().then(() => setFontLoaded(true));
  }, []);

  const rings = nodes.filter((n) => n.type === "ring");
  const maxOuterRadius = rings.reduce((max, r) => Math.max(max, (r.renderData as any)?.outerRadius || 100), 100);

  return (
    <Group>
      {/* Central reference indicator */}
      <Group opacity={0.35}>
        <Line points={[-12, 0, 12, 0]} stroke="#cbd5e1" strokeWidth={1} />
        <Line points={[0, -12, 0, 12]} stroke="#cbd5e1" strokeWidth={1} />
        <Circle radius={3} stroke="#cbd5e1" strokeWidth={1} />
      </Group>

      {/* Render each node nested inside its resolved mask list */}
      {nodes.map((node) => (
        <MaskedGroup key={node.id} maskIds={node.maskIds} allNodes={nodes}>
          <SelfMaskedGroup node={node} allNodes={nodes}>
            <Group
              id={node.id}
              x={node.worldTransform.x}
              y={node.worldTransform.y}
              rotation={node.worldTransform.rotation}
              scaleX={node.worldTransform.scaleX}
              scaleY={node.worldTransform.scaleY}
              visible={node.visible}
            >
              {renderSpecificNode(node, assets)}
            </Group>
          </SelfMaskedGroup>
        </MaskedGroup>
      ))}

      {/* Auto-generated concentric Grab Tabs at the top hemispher (always visible in editor) */}
      {rings.map((ring, idx) => {
        const ringColor = RING_COLORS[idx % RING_COLORS.length];
        const R_track = maxOuterRadius + 90 + idx * 22;
        
        // Calculate tab angle from the ring rotation CCW
        const ccwRot = 360 - (ring.renderData.rotation || 0);
        const tabAngle = -135 + ccwRot / 4.0;
        
        const rad = (tabAngle * Math.PI) / 180;
        const tx = R_track * Math.cos(rad);
        const ty = R_track * Math.sin(rad);
        
        const isSelected = activeItem?.id === ring.id;
        
        const tWidth = ring.renderData.tabWidth ?? 30;
        const tHeight = ring.renderData.tabHeight ?? 20;
        const tShape = ring.renderData.tabShape ?? "semicircular";
        const tLabel = ring.renderData.tabLabel || `#${rings.length - idx}`;
        
        return (
          <Group key={`auto-tab-${ring.id}`} name="grab-tab" id={`auto-tab-${ring.id}`}>
            {/* Concentric dashed track slot arc */}
            <Arc
              x={0}
              y={0}
              innerRadius={R_track - 1}
              outerRadius={R_track + 1}
              angle={90}
              rotation={-135}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth={1.5}
              dash={[3, 3]}
            />
            {/* Tab handle shape (capsule rounded outwards) */}
            <Group
              x={tx}
              y={ty}
              rotation={tabAngle}
            >
              {tShape === "trapezoidal" ? (
                <Line
                  points={[-tWidth/2, -tHeight/2,  tWidth/2, -tHeight*0.3,  tWidth/2, tHeight*0.3,  -tWidth/2, tHeight/2]}
                  closed
                  fill={ringColor}
                  stroke={isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.4)"}
                  strokeWidth={isSelected ? 2 : 1}
                  cursor="pointer"
                />
              ) : (
                <Rect
                  x={-tWidth/2}
                  y={-tHeight/2}
                  width={Math.max(1, tWidth)}
                  height={Math.max(1, tHeight)}
                  fill={ringColor}
                  stroke={isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.4)"}
                  strokeWidth={isSelected ? 2 : 1}
                  cornerRadius={tShape === "semicircular" ? [0, tHeight / 2, tHeight / 2, 0] : 0}
                  cursor="pointer"
                />
              )}
              <Text
                text={tLabel}
                fontSize={Math.min(10, tHeight * 0.5)}
                fontFamily="Outfit, sans-serif"
                fontStyle="bold"
                fill="#ffffff"
                align="center"
                verticalAlign="middle"
                x={-tWidth/2}
                y={-tHeight/2}
                width={tWidth}
                height={tHeight}
                cursor="pointer"
              />
            </Group>
          </Group>
        );
      })}
    </Group>
  );
};
