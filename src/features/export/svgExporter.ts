import type { Project, Asset } from "../../shared/types/project";
import { resolveProject, type ResolvedNode } from "../runtime/mechanismEngine";
import { getArcTextCharPositions } from "../../shared/utils/textGeometry";
import { getRingRadiusAtAngle } from "../../shared/utils/geometry";

export interface SVGExportOptions {
  layer: "artwork" | "cut" | "fold" | "all";
  separateLayers?: boolean;
  includeRegistrationMarks: boolean;
  includeAlignmentTicks: boolean;
  embedAssets: boolean;
}

// Helper to check if a node belongs to a layer
function isNodeInLayer(node: ResolvedNode, layer: "artwork" | "cut" | "fold"): boolean {
  if (node.type === "ring" || node.type === "sector") {
    // Rings and sectors are structural. They go in cut (for outlines) and artwork (for fills/strokes)
    return layer === "cut" || layer === "artwork";
  }
  if (node.type === "window") {
    // Windows are cut lines physically
    return layer === "cut";
  }
    const exp = node.renderData.export;
  if (!exp) return false;
  return exp[layer] === true;
}

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

// Generates concentric hollow path description
function getConcentricRingPath(innerRadius: number, outerRadius: number): string {
  const d = `M 0,${-outerRadius} A ${outerRadius},${outerRadius} 0 1,0 0,${outerRadius} A ${outerRadius},${outerRadius} 0 1,0 0,${-outerRadius} ` +
            (innerRadius > 0 ? `M 0,${-innerRadius} A ${innerRadius},${innerRadius} 0 1,1 0,${innerRadius} A ${innerRadius},${innerRadius} 0 1,1 0,${-innerRadius}` : '') + ' Z';
  return d;
}

// Generates sector path description
function getSectorPath(innerRadius: number, outerRadius: number, startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  const angleRad = (sweep * Math.PI) / 180;
  const startX = outerRadius;
  const endX = outerRadius * Math.cos(angleRad);
  const endY = outerRadius * Math.sin(angleRad);
  const innerStartX = innerRadius * Math.cos(angleRad);
  const innerStartY = innerRadius * Math.sin(angleRad);
  const innerEndX = innerRadius;
  const largeArcFlag = sweep > 180 ? 1 : 0;

  if (innerRadius > 0) {
    return `M ${startX},0 A ${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${endX},${endY} L ${innerStartX},${innerStartY} A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${innerEndX},0 Z`;
  } else {
    return `M 0,0 L ${startX},0 A ${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${endX},${endY} Z`;
  }
}

// Generates polygon path description
export function getPolygonPath(sides: number, radius: number, edgeCurvature: number = 0, triangleType?: string): string {
  const numSides = Math.max(3, sides || 6);
  const vertices: { x: number; y: number }[] = [];

  if (numSides === 3 && triangleType === "right") {
    const k = radius * 0.85;
    vertices.push({ x: -k, y: -k });
    vertices.push({ x: k, y: k });
    vertices.push({ x: -k, y: k });
  } else if (numSides === 3 && triangleType === "isosceles") {
    const h = radius;
    const w = radius * 0.7;
    vertices.push({ x: 0, y: -h });
    vertices.push({ x: w, y: h * 0.8 });
    vertices.push({ x: -w, y: h * 0.8 });
  } else {
    for (let i = 0; i < numSides; i++) {
      const angle = (i * 2 * Math.PI) / numSides - Math.PI / 2;
      vertices.push({
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    }
  }

  if (Math.abs(edgeCurvature) < 0.001) {
    const pts = vertices.map((v) => `${v.x},${v.y}`);
    return `M ${pts.join(' L ')} Z`;
  }

  const sagitta = radius * 0.4 * edgeCurvature;
  let d = `M ${vertices[0].x},${vertices[0].y}`;

  for (let i = 0; i < numSides; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % numSides];
    const mx = (v1.x + v2.x) / 2;
    const my = (v1.y + v2.y) / 2;
    const len = Math.sqrt(mx * mx + my * my) || 1;
    const cx = mx + sagitta * (mx / len);
    const cy = my + sagitta * (my / len);
    d += ` Q ${cx},${cy} ${v2.x},${v2.y}`;
  }
  return `${d} Z`;
}

// Generates star path description
function getStarPath(numPoints: number, innerRadius: number, outerRadius: number): string {
  const pts = [];
  const totalPoints = numPoints * 2;
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    pts.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

// Builds a continuous outer perimeter cut path for a ring with attached disc tabs
function getRingOuterCutPathWithDiscTabs(ringNode: ResolvedNode, tabs: ResolvedNode[]): string {
  const outerRadius = ringNode.renderData.outerRadius || 100;
  if (tabs.length === 0) {
    return `M 0,${-outerRadius} A ${outerRadius},${outerRadius} 0 1,1 0,${outerRadius} A ${outerRadius},${outerRadius} 0 1,1 0,${-outerRadius} Z`;
  }

  const sortedTabs = [...tabs].sort((a, b) => (a.renderData.angle || 0) - (b.renderData.angle || 0));
  const ringData = ringNode.renderData as any;

  const tabSpans = sortedTabs.map((tab) => {
    const angle = (tab.renderData.angle || 0) % 360;
    const w = tab.renderData.width || 30;
    const h = tab.renderData.height || 18;
    const shape = tab.renderData.tabShape || "semicircular";
    const rEdge = getRingRadiusAtAngle(ringData, angle);
    const halfSpan = (Math.asin(Math.min(0.99, (w / 2) / rEdge)) * 180) / Math.PI;
    const startAng = ((angle - halfSpan) % 360 + 360) % 360;
    const endAng = ((angle + halfSpan) % 360 + 360) % 360;
    return { tab, angle, w, h, shape, startAng, endAng, halfSpan, rEdge };
  });

  let d = "";

  for (let i = 0; i < tabSpans.length; i++) {
    const cur = tabSpans[i];
    const next = tabSpans[(i + 1) % tabSpans.length];

    const startRad = (cur.startAng * Math.PI) / 180;
    const endRad = (cur.endAng * Math.PI) / 180;

    const rStart = getRingRadiusAtAngle(ringData, cur.startAng);
    const rEnd = getRingRadiusAtAngle(ringData, cur.endAng);

    const xStart = rStart * Math.cos(startRad);
    const yStart = rStart * Math.sin(startRad);
    const xEnd = rEnd * Math.cos(endRad);
    const yEnd = rEnd * Math.sin(endRad);

    if (i === 0) {
      d += `M ${xStart.toFixed(2)} ${yStart.toFixed(2)}`;
    }

    const peakR = cur.rEdge + cur.h;
    if (cur.shape === "semicircular") {
      const midRad = (cur.angle * Math.PI) / 180;
      const xMid = peakR * Math.cos(midRad);
      const yMid = peakR * Math.sin(midRad);
      d += ` A ${cur.h} ${cur.h} 0 0 1 ${xMid.toFixed(2)} ${yMid.toFixed(2)}`;
      d += ` A ${cur.h} ${cur.h} 0 0 1 ${xEnd.toFixed(2)} ${yEnd.toFixed(2)}`;
    } else if (cur.shape === "trapezoidal") {
      const topHw = cur.w * 0.6;
      const topHalfSpan = (Math.asin(Math.min(0.99, (topHw / 2) / peakR)) * 180) / Math.PI;
      const topStartRad = ((cur.angle - topHalfSpan) * Math.PI) / 180;
      const topEndRad = ((cur.angle + topHalfSpan) * Math.PI) / 180;

      const xTopStart = peakR * Math.cos(topStartRad);
      const yTopStart = peakR * Math.sin(topStartRad);
      const xTopEnd = peakR * Math.cos(topEndRad);
      const yTopEnd = peakR * Math.sin(topEndRad);

      d += ` L ${xTopStart.toFixed(2)} ${yTopStart.toFixed(2)}`;
      d += ` L ${xTopEnd.toFixed(2)} ${yTopEnd.toFixed(2)}`;
      d += ` L ${xEnd.toFixed(2)} ${yEnd.toFixed(2)}`;
    } else {
      const xPeakStart = peakR * Math.cos(startRad);
      const yPeakStart = peakR * Math.sin(startRad);
      const xPeakEnd = peakR * Math.cos(endRad);
      const yPeakEnd = peakR * Math.sin(endRad);

      d += ` L ${xPeakStart.toFixed(2)} ${yPeakStart.toFixed(2)}`;
      d += ` A ${peakR} ${peakR} 0 0 1 ${xPeakEnd.toFixed(2)} ${yPeakEnd.toFixed(2)}`;
      d += ` L ${xEnd.toFixed(2)} ${yEnd.toFixed(2)}`;
    }

    const nextStartRad = (next.startAng * Math.PI) / 180;
    const rNextStart = getRingRadiusAtAngle(ringData, next.startAng);
    const xNextStart = rNextStart * Math.cos(nextStartRad);
    const yNextStart = rNextStart * Math.sin(nextStartRad);

    if (ringData.ringShape === "polygon") {
      d += ` L ${xNextStart.toFixed(2)} ${yNextStart.toFixed(2)}`;
    } else {
      let sweep = next.startAng - cur.endAng;
      if (sweep < 0) sweep += 360;
      const largeArc = sweep > 180 ? 1 : 0;
      d += ` A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${xNextStart.toFixed(2)} ${yNextStart.toFixed(2)}`;
    }
  }

  d += " Z";
  return d;
}

// Converts a node to raw SVG string based on export layer
function renderNodeToSVG(
  node: ResolvedNode,
  layer: "artwork" | "cut" | "fold",
  embedAssets: boolean,
  assets: Asset[],
  allNodes: ResolvedNode[] = []
): string {
  const { style, innerRadius, outerRadius, startAngle, endAngle, radius, width, height, length, thickness, sides, content, fontFamily, fontSize, sweepAngle } = node.renderData;

  // Layer-specific overrides
  let fill = "none";
  let stroke = "none";
  let strokeWidth = 1;
  let strokeDash: string | undefined;

  if (layer === "cut") {
    stroke = "#FF0000"; // Pure Red for cutters
    strokeWidth = 1;
  } else if (layer === "fold") {
    stroke = "#0000FF"; // Pure Blue for score/fold lines
    strokeWidth = 1;
    strokeDash = "3,3";
  } else {
    // Artwork
    fill = style?.fill || "none";
    stroke = style?.stroke || "none";
    strokeWidth = style?.strokeWidth || 1;
  }

  // Transformation matrix/translate
  const { x, y, rotation, scaleX, scaleY } = node.worldTransform;
  const transformAttr = `transform="translate(${x}, ${y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})"`;

  switch (node.type) {
    case "ring": {
      const isPolygon = node.renderData.ringShape === "polygon";
      const polySides = node.renderData.polygonSides || 6;
      const curvature = node.renderData.edgeCurvature || 0;

      if (layer === "cut") {
        let cuts = "";
        const discTabs = allNodes.filter((n) => n.ringId === node.id && n.type === "discTab");
        if (discTabs.length > 0) {
          cuts += `<path d="${getRingOuterCutPathWithDiscTabs(node, discTabs)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (isPolygon) {
          cuts += `<path d="${getPolygonPath(polySides, outerRadius, curvature)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else {
          cuts += `<circle cx="0" cy="0" r="${outerRadius}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        }
        if (innerRadius > 0) {
          cuts += `\n  <circle cx="0" cy="0" r="${innerRadius}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        }
        return cuts;
      } else {
        if (isPolygon) {
          const polyPath = getPolygonPath(polySides, outerRadius, curvature);
          const innerHole = innerRadius > 0 ? ` M 0,${-innerRadius} A ${innerRadius},${innerRadius} 0 1,1 0,${innerRadius} A ${innerRadius},${innerRadius} 0 1,1 0,${-innerRadius}` : "";
          return `<path d="${polyPath}${innerHole}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" fill-rule="evenodd" />`;
        } else {
          const pathD = getConcentricRingPath(innerRadius || 0, outerRadius || 100);
          return `<path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" fill-rule="evenodd" />`;
        }
      }
    }

    case "sector": {
      const pathD = getSectorPath(innerRadius || 0, outerRadius || 100, startAngle || 0, endAngle || 360);
      return `<path d="${pathD}" ${transformAttr} fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }

    case "circle":
      return `<circle cx="0" cy="0" r="${radius}" ${transformAttr} fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} />`;

    case "rectangle":
      return `<rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" ${transformAttr} fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} />`;

    case "line":
      return `<line x1="0" y1="0" x2="${length}" y2="0" ${transformAttr} stroke="${stroke}" stroke-width="${thickness || strokeWidth}" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} />`;

    case "curve": {
      const pts = node.renderData.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
      const pathD = `M ${pts.p0.x} ${pts.p0.y} C ${pts.c1.x} ${pts.c1.y}, ${pts.c2.x} ${pts.c2.y}, ${pts.p1.x} ${pts.p1.y}`;
      return `<path d="${pathD}" ${transformAttr} fill="none" stroke="${stroke}" stroke-width="${thickness || strokeWidth}" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} />`;
    }

    case "arc": {
      const r = radius || 50;
      const startRad = ((startAngle || 0) * Math.PI) / 180;
      const endRad = (((startAngle || 0) + (sweepAngle || 90)) * Math.PI) / 180;
      const x1 = r * Math.cos(startRad);
      const y1 = r * Math.sin(startRad);
      const x2 = r * Math.cos(endRad);
      const y2 = r * Math.sin(endRad);
      const largeArc = (sweepAngle || 90) > 180 ? 1 : 0;
      const pathD = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
      return `<path d="${pathD}" ${transformAttr} fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} />`;
    }

    case "polygon": {
      const curvature = node.renderData.edgeCurvature || 0;
      const triType = node.renderData.triangleType;
      const pathD = getPolygonPath(sides || 3, radius || 10, curvature, triType);
      return `<path d="${pathD}" ${transformAttr} fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} />`;
    }

    case "text":
    case "sectorLabel": {
      if (layer !== "artwork") return ""; // Skip text in cut/fold unless specified, typically cut as artwork
      const dyOffset = (fontSize || 12) * 0.35; // offset vertical centering
      return `<text x="0" y="0" ${transformAttr} font-family="${fontFamily || 'sans-serif'}" font-size="${fontSize || 12}" fill="${fill}" stroke="${stroke}" stroke-width="${style?.strokeWidth || 0}" text-anchor="middle" dy="${dyOffset}">${content}</text>`;
    }

    case "arcText": {
      if (layer !== "artwork") return "";
      const kerning = node.renderData.kerning || 0;
      const layout = getArcTextCharPositions(
        content || "",
        radius || 100,
        startAngle || 0,
        fontSize || 12,
        fontFamily || "sans-serif",
        kerning
      );

      let textGroup = `<g ${transformAttr}>`;
      layout.charPositions.forEach((cp) => {
        textGroup += `\n    <text transform="translate(${cp.x}, ${cp.y}) rotate(${cp.rotation})" font-family="${fontFamily || 'sans-serif'}" font-size="${fontSize || 12}" fill="${fill}" stroke="${stroke}" stroke-width="${style?.strokeWidth || 0}" text-anchor="middle" dy="${(fontSize || 12) * 0.35}">${cp.char}</text>`;
      });
      textGroup += `\n  </g>`;
      return textGroup;
    }

    case "image":
    case "svgAsset": {
      if (layer !== "artwork") return "";
      const assetId = node.renderData.assetId;
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return "";

      const w = node.bounds?.width || 100;
      const h = node.bounds?.height || 100;
      const hrefStr = embedAssets ? asset.embeddedData : `assets/${asset.id}.${asset.type}`;
      const crop = node.renderData.crop;

      const imgTag = (crop && crop.width > 0 && crop.height > 0)
        ? `<svg x="-${w / 2}" y="-${h / 2}" width="${w}" height="${h}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}" preserveAspectRatio="none" ${transformAttr}><image href="${hrefStr}" width="100%" height="100%" /></svg>`
        : `<image href="${hrefStr}" x="-${w / 2}" y="-${h / 2}" width="${w}" height="${h}" ${transformAttr} />`;

      if (crop?.shape === "circle") {
        const circleR = crop.radius || Math.min(w, h) / 2;
        const clipId = `crop-circle-${node.id}`;
        return `<defs><clipPath id="${clipId}"><circle cx="0" cy="0" r="${circleR}" /></clipPath></defs><g clip-path="url(#${clipId})">${imgTag}</g>`;
      }

      if (crop?.shape === "radialTrapezoid") {
        const sweepDeg = crop.sweepAngle || 60;
        const halfSweep = (sweepDeg / 2) * (Math.PI / 180);
        const outerR = crop.outerRadius || Math.max(w, h) / 2;
        const innerR = Math.max(0, crop.innerRadius || 0);

        const startAngleRad = -halfSweep - Math.PI / 2;
        const endAngleRad = halfSweep - Math.PI / 2;

        const x1 = outerR * Math.cos(startAngleRad);
        const y1 = outerR * Math.sin(startAngleRad);
        const x2 = outerR * Math.cos(endAngleRad);
        const y2 = outerR * Math.sin(endAngleRad);

        const largeArc = sweepDeg > 180 ? 1 : 0;
        let pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;

        if (innerR > 0) {
          const ix2 = innerR * Math.cos(endAngleRad);
          const iy2 = innerR * Math.sin(endAngleRad);
          const ix1 = innerR * Math.cos(startAngleRad);
          const iy1 = innerR * Math.sin(startAngleRad);
          pathD += ` L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;
        } else {
          pathD += ` L 0 0 Z`;
        }

        const clipId = `crop-radial-${node.id}`;
        return `<defs><clipPath id="${clipId}"><path d="${pathD}" /></clipPath></defs><g clip-path="url(#${clipId})">${imgTag}</g>`;
      }

      return imgTag;
    }

    case "tab": {
      if (layer !== "artwork") return "";
      const width = node.bounds?.width || 30;
      const height = node.bounds?.height || 20;
      const tabShape = node.renderData.tabShape || "rectangular";
      const targetRingId = node.renderData.targetRingId || "";
      const gearRatio = node.renderData.gearRatio ?? 1.0;
      const trackSweep = node.renderData.trackSweep ?? 360.0;
      const label = node.renderData.label || "";
      const radius = node.renderData.radius || 100;
      const angle = node.renderData.angle || 0;

      const fill = style?.fill || "#3b82f6";
      const stroke = style?.stroke || "#1e3a8a";
      const strokeWidth = style?.strokeWidth ?? 1.5;

      let shapeSvg = "";
      if (tabShape === "semicircular") {
        const r = height / 2;
        shapeSvg = `<path d="M -${width/2},-${height/2} L 0,-${height/2} A ${r},${r} 0 0,1 0,${height/2} L -${width/2},${height/2} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
      } else if (tabShape === "trapezoidal") {
        shapeSvg = `<polygon points="-${width/2},-${height/2} ${width/2},-${height/3} ${width/2},${height/3} -${width/2},${height/2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
      } else {
        shapeSvg = `<rect x="-${width/2}" y="-${height/2}" width="${width}" height="${height}" rx="4" ry="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
      }

      let labelSvg = "";
      if (label) {
        const fontSize = Math.min(10, height - 4);
        labelSvg = `<text x="0" y="0" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="${stroke}">${label}</text>`;
      }

      return `<g id="tab-control-${node.id}" class="tab-control-element" data-target-ring="${targetRingId}" data-gear-ratio="${gearRatio}" data-track-sweep="${trackSweep}" data-initial-angle="${angle}" data-radius="${radius}" ${transformAttr}>${shapeSvg}${labelSvg}</g>`;
    }

    case "discTab": {
      if (layer !== "artwork") return "";
      const w = node.renderData.width || 30;
      const h = node.renderData.height || 18;
      const cornerRadius = node.renderData.cornerRadius || 4;
      const tabShape = node.renderData.tabShape || "semicircular";
      const label = node.renderData.label || "";
      const tabFill = style?.fill || "#6366f1";
      const tabStroke = style?.stroke || "#3730a3";
      const tabStrokeW = style?.strokeWidth ?? 1.5;

      const hw = w / 2;
      const cr = Math.min(cornerRadius, hw, h / 2);

      let shapeSvg = "";
      if (tabShape === "rectangular") {
        shapeSvg = `<path d="M -${hw},0 L -${hw},${h - cr} A ${cr},${cr} 0 0,0 -${hw - cr},${h} L ${hw - cr},${h} A ${cr},${cr} 0 0,0 ${hw},${h - cr} L ${hw},0 Z" fill="${tabFill}" stroke="${tabStroke}" stroke-width="${tabStrokeW}" ${transformAttr} />`;
      } else if (tabShape === "semicircular") {
        const domeR = hw;
        shapeSvg = `<path d="M -${hw},0 L -${hw},${h - domeR} A ${domeR},${domeR} 0 0,1 ${hw},${h - domeR} L ${hw},0 Z" fill="${tabFill}" stroke="${tabStroke}" stroke-width="${tabStrokeW}" ${transformAttr} />`;
      } else {
        const topHw = hw * 0.6;
        shapeSvg = `<polygon points="-${hw},0 -${topHw},${h} ${topHw},${h} ${hw},0" fill="${tabFill}" stroke="${tabStroke}" stroke-width="${tabStrokeW}" ${transformAttr} />`;
      }

      let labelSvg = "";
      if (label) {
        const fontSize = Math.min(10, h * 0.4);
        labelSvg = `<text x="0" y="${h * 0.5}" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="#ffffff" ${transformAttr}>${label}</text>`;
      }

      return `<g id="disc-tab-${node.id}">${shapeSvg}${labelSvg}</g>`;
    }

    case "window": {
      if (layer === "cut" && node.renderData.shape) {
        // Draw window outlines in the cut layer
        const shape = node.renderData.shape;
        const shTransformAttr = `transform="translate(${x}, ${y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})"`;
        if (shape.type === "circle") {
          return `<circle cx="0" cy="0" r="${shape.radius}" ${shTransformAttr} stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (shape.type === "rectangle") {
          return `<rect x="${-shape.width/2}" y="${-shape.height/2}" width="${shape.width}" height="${shape.height}" ${shTransformAttr} stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (shape.type === "polygon") {
          const pathD = getPolygonPath(shape.sides || 3, shape.radius || 10);
          return `<path d="${pathD}" ${shTransformAttr} stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (shape.type === "star") {
          const pathD = getStarPath(shape.numPoints || 5, shape.innerRadius || 15, shape.outerRadius || 35);
          return `<path d="${pathD}" ${shTransformAttr} stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (shape.type === "trapezoid") {
          const bw = (shape.baseWidth || 60) / 2;
          const tw = (shape.topWidth || 40) / 2;
          const hh = (shape.height || 50) / 2;
          return `<polygon points="-${bw},${hh} ${bw},${hh} ${tw},-${hh} -${tw},-${hh}" ${shTransformAttr} stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (shape.type === "crescent") {
          const r = shape.radius || 30;
          const ratio = shape.ratio !== undefined ? shape.ratio : 0.4;
          const innerR = r * (1 - ratio);
          const pathD = `M 0,-${r} A ${r},${r} 0 0,1 0,${r} A ${innerR},${innerR} 0 0,0 0,-${r} Z`;
          return `<path d="${pathD}" ${shTransformAttr} stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        } else if (shape.type === "line") {
          return `<line x1="0" y1="0" x2="${shape.length || 50}" y2="0" ${shTransformAttr} stroke="${stroke}" stroke-width="${shape.thickness || strokeWidth}" fill="none" />`;
        } else if (shape.type === "text" || shape.type === "arcText" || shape.type === "sectorLabel") {
          const content = shape.content || "Text";
          const fontSize = shape.fontSize || 14;
          const fontFamily = shape.fontFamily || "sans-serif";
          return `<text x="0" y="0" ${shTransformAttr} font-family="${fontFamily}" font-size="${fontSize}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" text-anchor="middle" dy="${fontSize * 0.35}">${content}</text>`;
        }
      }
      return "";
    }
  }

  return "";
}

// Generate alignment ticks at the boundaries of the canvas/volvelle
function renderAlignmentTicks(maxRadius: number): string {
  let g = `<g id="alignment-ticks" stroke="#64748b" stroke-width="1">`;
  const angles = [0, 90, 180, 270];
  angles.forEach((angle) => {
    const angleRad = (angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    // Draw tick line crossing the boundary of the mechanism
    const x1 = (maxRadius - 5) * cos;
    const y1 = (maxRadius - 5) * sin;
    const x2 = (maxRadius + 10) * cos;
    const y2 = (maxRadius + 10) * sin;
    g += `\n  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    // Add text label
    const lx = (maxRadius + 22) * cos;
    const ly = (maxRadius + 22) * sin;
    g += `\n  <text x="${lx}" y="${ly}" font-family="monospace" font-size="10" fill="#64748b" text-anchor="middle" dy="3.5">${angle}°</text>`;
  });
  g += `\n</g>`;
  return g;
}



// Generates masks for SVG `<defs>` block
function generateSVGMasks(resolvedNodes: ResolvedNode[]): string {
  // Group resolved nodes by their maskIds
  const maskGroups = new Map<string, string[]>();
  resolvedNodes.forEach((node) => {
    if (node.maskIds && node.maskIds.length > 0) {
      const key = node.maskIds.join(",");
      maskGroups.set(key, node.maskIds);
    }
  });

  let defs = "";

  // 1. Generate normal window masks
  maskGroups.forEach((maskIds, key) => {
    const maskIdAttr = `mask-${key.replace(/,/g, "-")}`;
    defs += `\n  <mask id="${maskIdAttr}">`;
    // Draw huge white circle to keep everything outside the mask rings visible
    defs += `\n    <circle cx="0" cy="0" r="10000" fill="white" />`;

    // Process masks from top to bottom
    maskIds.forEach((wId) => {
      const windowNode = resolvedNodes.find((n) => n.id === wId);
      if (!windowNode || !windowNode.renderData.shape) return;

      // Find the parent ring to subtract its cover region
      // In resolvedNodes, a window's parent ring is the one that contains it.
      // Let's find the ring that has window in its subtree or the closest parent.
      // Wait, we can find a ring node whose outerRadius matches the window context or is nearby.
      // Let's search resolvedNodes for the ring that precedes this window or contains it.
      const rings = resolvedNodes.filter((n) => n.type === "ring");
      // Find ring containing window: the window's maskIds are windows on rings *above* the node.
      // Let's find which ring contains this specific window `wId`.
      // We can check which ring has this window node inside.
      // Since rings are concentric, the window is positioned relative to its parent ring.
      // Let's find the parent ring by searching which ring has outerRadius > window distance and innerRadius < window distance.
      const wx = windowNode.worldTransform.x;
      const wy = windowNode.worldTransform.y;
      const d = Math.hypot(wx, wy);

      const parentRing = rings.find((r) => r.renderData.outerRadius >= d && r.renderData.innerRadius <= d) || rings[rings.length - 1];
      if (!parentRing) return;

      const outer = parentRing.renderData.outerRadius;
      const inner = parentRing.renderData.innerRadius || 0;

      // Draw the black mask representing the cover dial body (hides the elements below)
      defs += `\n    <circle cx="0" cy="0" r="${outer}" fill="black" />`;
      if (inner > 0) {
        defs += `\n    <circle cx="0" cy="0" r="${inner}" fill="white" />`;
      }

      // Add back the window cutout in white (transparent hole in the cover dial)
      const shape = windowNode.renderData.shape;
      const { x, y, rotation, scaleX, scaleY } = windowNode.worldTransform;
      const shapeTransform = `transform="translate(${x}, ${y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})"`;

      if (shape.type === "circle") {
        defs += `\n    <circle cx="0" cy="0" r="${shape.radius}" ${shapeTransform} fill="white" />`;
      } else if (shape.type === "rectangle") {
        defs += `\n    <rect x="${-shape.width/2}" y="${-shape.height/2}" width="${shape.width}" height="${shape.height}" ${shapeTransform} fill="white" />`;
      } else if (shape.type === "polygon") {
        const pathD = getPolygonPath(shape.sides || 3, shape.radius || 10);
        defs += `\n    <path d="${pathD}" ${shapeTransform} fill="white" />`;
      }
    });

    defs += `\n  </mask>`;
  });

  // 2. Generate self-masking definitions for cover rings themselves (hollowing out windows in ring visual fills)
  const rings = resolvedNodes.filter((n) => n.type === "ring");
  rings.forEach((ring) => {
    // Find all window nodes placed on this ring
    // Windows on this ring have world position within the ring outer/inner boundaries
    const ringWindows = resolvedNodes.filter((node) => {
      if (node.type !== "window") return false;
      const wx = node.worldTransform.x;
      const wy = node.worldTransform.y;
      const d = Math.hypot(wx, wy);
      return d <= ring.renderData.outerRadius && d >= (ring.renderData.innerRadius || 0);
    });

    if (ringWindows.length > 0) {
      defs += `\n  <mask id="self-mask-${ring.id}">`;
      defs += `\n    <circle cx="0" cy="0" r="10000" fill="white" />`;

      ringWindows.forEach((win) => {
        const shape = win.renderData.shape;
        if (!shape) return;
        const { x, y, rotation, scaleX, scaleY } = win.worldTransform;
        const shapeTransform = `transform="translate(${x}, ${y}) rotate(${rotation}) scale(${scaleX}, ${scaleY})"`;

        if (shape.type === "circle") {
          defs += `\n    <circle cx="0" cy="0" r="${shape.radius}" ${shapeTransform} fill="black" />`;
        } else if (shape.type === "rectangle") {
          defs += `\n    <rect x="${-shape.width/2}" y="${-shape.height/2}" width="${shape.width}" height="${shape.height}" ${shapeTransform} fill="black" />`;
        } else if (shape.type === "polygon") {
          const pathD = getPolygonPath(shape.sides || 3, shape.radius || 10);
          defs += `\n    <path d="${pathD}" ${shapeTransform} fill="black" />`;
        }
      });

      defs += `\n  </mask>`;
    }
  });

  return defs;
}

// Generate single SVG content string for a given layer
export function generateSVG(project: Project, options: SVGExportOptions): string {
  // Temporarily reset ring rotations to 0 during project resolution to get unrotated coordinates,
  // allowing the SVG grouping elements <g transform="rotate(rotation)"> to apply active rotation dynamically.
  const unrotatedProject = JSON.parse(JSON.stringify(project));
  const projectRings = (unrotatedProject.mechanism.children || []).filter((c: any) => c.type === "ring");
  projectRings.forEach((r: any) => {
    r.rotation = 0;
  });
  const resolvedNodes = resolveProject(unrotatedProject);

  const canvasWidth = project.settings?.canvasSize?.width || 800;
  const canvasHeight = project.settings?.canvasSize?.height || 800;

  // Gather max ring radius for registration marks alignment
  const rings = resolvedNodes.filter((n) => n.type === "ring");
  const maxRadius = rings.reduce((max, r) => Math.max(max, r.renderData.outerRadius || 0), 100);

  // SVG envelope
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-canvasWidth / 2} ${-canvasHeight / 2} ${canvasWidth} ${canvasHeight}" width="${canvasWidth}" height="${canvasHeight}">`;

  // Background for artwork
  if (options.layer === "artwork" || options.layer === "all") {
    svg += `\n  <!-- Canvas Background -->`;
    svg += `\n  <rect x="${-canvasWidth / 2}" y="${-canvasHeight / 2}" width="${canvasWidth}" height="${canvasHeight}" fill="#0b0c0f" />`;
  }

  // Defs section (for masking and patterns)
  const masksContent = generateSVGMasks(resolvedNodes);
  if (masksContent) {
    svg += `\n  <defs>${masksContent}\n  </defs>\n`;
  }

  // Draw layers
  const layersToDraw: Array<"artwork" | "cut" | "fold"> =
    options.layer === "all" ? ["artwork", "cut", "fold"] : [options.layer];

  layersToDraw.forEach((lyr) => {
    let layerGroup = `  <g id="layer-${lyr}"`;
    if (options.layer === "all" && lyr !== "artwork") {
      // In combined file mode, hide cutting lines by default so it looks like artwork but cutters can see them
      layerGroup += ` opacity="0.6"`;
    }
    layerGroup += `>`;

    // 1. Render nodes without a ringId (e.g. stage background, non-ring graphics)
    resolvedNodes.forEach((node) => {
      if (node.ringId) return;
      if (!node.visible) return;
      if (!isNodeInLayer(node, lyr)) return;

      const elSvg = renderNodeToSVG(node, lyr, options.embedAssets, project.assets || [], resolvedNodes);
      if (elSvg) {
        layerGroup += `\n    ${elSvg.replace(/\n/g, "\n    ")}`;
      }
    });

    // 2. Render nodes grouped by their parent Ring
    const originalRings = (project.mechanism.children || []).filter((c) => c.type === "ring") as any[];
    originalRings.forEach((origRing) => {
      const resRing = resolvedNodes.find((n) => n.id === origRing.id);
      if (!resRing || !resRing.visible) return;

      const ringNodes = resolvedNodes.filter((n) => n.ringId === origRing.id);

      let ringChildrenSvg = "";
      ringNodes.forEach((node) => {
        if (!isNodeInLayer(node, lyr)) return;

        let elSvg = renderNodeToSVG(node, lyr, options.embedAssets, project.assets || [], resolvedNodes);
        if (!elSvg) return;

        // Apply masking (window cutouts on cover rings above)
        if (lyr === "artwork" && node.maskIds && node.maskIds.length > 0) {
          const maskKey = `mask-${node.maskIds.join("-")}`;
          elSvg = `<g mask="url(#${maskKey})">\n      ${elSvg.replace(/\n/g, "\n      ")}\n    </g>`;
        }

        // Apply self-masking to cover rings
        if (lyr === "artwork" && node.type === "ring") {
          const selfMaskId = `self-mask-${node.id}`;
          if (masksContent.includes(`id="${selfMaskId}"`)) {
            elSvg = `<g mask="url(#${selfMaskId})">\n      ${elSvg.replace(/\n/g, "\n      ")}\n    </g>`;
          }
        }

        ringChildrenSvg += `\n      ${elSvg.replace(/\n/g, "\n      ")}`;
      });

      if (ringChildrenSvg) {
        layerGroup += `\n    <g id="ring-group-${origRing.id}" data-ring-id="${origRing.id}" class="volvelle-ring-group" transform="rotate(${origRing.rotation})">`;
        layerGroup += ringChildrenSvg;
        layerGroup += `\n    </g>`;
      }
    });

    layerGroup += `\n  </g>\n`;
    svg += `\n${layerGroup}`;
  });

  // Center registration marks (Brad holes & crosshairs)
  if (options.includeRegistrationMarks) {
    svg += `\n  <!-- Registration Marks -->`;
    svg += `\n  <g id="registration-marks" stroke="#64748b" stroke-width="1.5" fill="none">`;
    // Draw brad center circle
    svg += `\n    <circle cx="0" cy="0" r="3" stroke="#FF0000" />`; // Cut brad hole circle
    // Draw crosshair lines
    svg += `\n    <line x1="-15" y1="0" x2="15" y2="0" />`;
    svg += `\n    <line x1="0" y1="-15" x2="0" y2="15" />`;
    svg += `\n  </g>\n`;
  }

  // Alignment ticks (Optional)
  if (options.includeAlignmentTicks) {
    const ticksSvg = renderAlignmentTicks(maxRadius);
    svg += `\n  ${ticksSvg.replace(/\n/g, "\n  ")}\n`;
  }

  // Auto-Generated Grab Tabs for interactive volvelles
  if ((options.layer === "artwork" || options.layer === "all") && project.settings.showGrabTabs !== false) {
    const originalRings = (project.mechanism.children || []).filter((c) => c.type === "ring") as any[];
    if (originalRings.length > 0) {
      const maxOuterRadius = originalRings.reduce((max, r) => Math.max(max, r.outerRadius || 100), 100);
      svg += `\n  <!-- Auto-Generated Concentric Grab Tabs -->`;
      svg += `\n  <g id="auto-grab-tabs">`;
      originalRings.forEach((ring, idx) => {
        const ringColor = RING_COLORS[idx % RING_COLORS.length];
        const R_track = maxOuterRadius + 90 + idx * 22;
        
        const tWidth = ring.tabWidth ?? 30;
        const tHeight = ring.tabHeight ?? 20;
        const tShape = ring.tabShape ?? "semicircular";
        const tLabel = ring.tabLabel || `#${originalRings.length - idx}`;
        
        // Dashed slot track arc path (-135 to -45 degrees)
        const startX = -0.7071 * R_track;
        const startY = -0.7071 * R_track;
        const endX = 0.7071 * R_track;
        const endY = -0.7071 * R_track;
        svg += `\n    <path d="M ${startX} ${startY} A ${R_track} ${R_track} 0 0 1 ${endX} ${endY}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="3,3" />`;

        // Calculate handle position
        const ccwRot = 360 - (ring.rotation || 0);
        const tabAngle = -135 + ccwRot / 4.0;
        const rad = (tabAngle * Math.PI) / 180;
        const hx = R_track * Math.cos(rad);
        const hy = R_track * Math.sin(rad);

        svg += `\n    <g id="tab-handle-${ring.id}" class="tab-control-element" data-target-ring="${ring.id}" data-radius="${R_track}" transform="translate(${hx}, ${hy}) rotate(${tabAngle})">`;
        if (tShape === "trapezoidal") {
          svg += `\n      <path d="M ${-tWidth/2} ${-tHeight/2} L ${tWidth/2} ${-tHeight*0.3} L ${tWidth/2} ${tHeight*0.3} L ${-tWidth/2} ${tHeight/2} Z" fill="${ringColor}" stroke="rgba(0,0,0,0.3)" stroke-width="1" style="cursor: pointer;" />`;
        } else {
          const rx = tShape === "semicircular" ? tHeight / 2 : 0;
          svg += `\n      <rect x="${-tWidth/2}" y="${-tHeight/2}" width="${tWidth}" height="${tHeight}" rx="${rx}" ry="${rx}" fill="${ringColor}" stroke="rgba(0,0,0,0.3)" stroke-width="1" style="cursor: pointer;" />`;
        }
        svg += `\n      <text x="0" y="0" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${Math.min(10, tHeight * 0.5)}" font-weight="bold" fill="#ffffff" style="cursor: pointer;">${tLabel}</text>`;
        svg += `\n    </g>`;
      });
      svg += `\n  </g>\n`;
    }
  }

  svg += `</svg>`;
  return svg;
}

// Generates an object mapping layer file names to their full SVG strings (e.g. for ZIP compilation)
export function generateLayerFiles(project: Project, options: SVGExportOptions): Record<string, string> {
  const fileMap: Record<string, string> = {};

  const layers: Array<"artwork" | "cut" | "fold"> = ["artwork", "cut", "fold"];
  layers.forEach((lyr) => {
    fileMap[`${lyr}.svg`] = generateSVG(project, {
      ...options,
      layer: lyr,
    });
  });

  return fileMap;
}
