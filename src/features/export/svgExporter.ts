import type { Project, Asset } from "../../shared/types/project";
import { resolveProject, type ResolvedNode } from "../runtime/mechanismEngine";
import { getArcTextCharPositions } from "../../shared/utils/textGeometry";
import { getRingRadiusAtAngle } from "../../shared/utils/geometry";
import { fromPixels, getUnitSymbol } from "../../shared/utils/unitConversion";

export interface SVGExportOptions {
  layer: "artwork" | "cut" | "fold" | "all";
  separateLayers?: boolean;
  includeRegistrationMarks: boolean;
  includeAlignmentTicks: boolean;
  embedAssets: boolean;
  selectedRingId?: string;
  convertTextToPaths?: boolean;
  physicalUnits?: boolean;
  exportMode?: "combined" | "per-ring" | "sheet-grid";
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
  const exp = node.export || node.renderData?.export;
  if (!exp) return false;
  if (exp.machineRole === "plot") {
    return layer === "artwork" || layer === "fold";
  }
  if (exp.machineRole === "cut") {
    return layer === "cut";
  }
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
      const chord = Math.hypot(xMid - xStart, yMid - yStart);
      const arcR = Math.max(cur.h, (chord * chord) / (2 * (cur.h || 1)));
      d += ` A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 1 ${xMid.toFixed(2)} ${yMid.toFixed(2)}`;
      d += ` A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 1 ${xEnd.toFixed(2)} ${yEnd.toFixed(2)}`;
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
      d += ` A ${peakR.toFixed(2)} ${peakR.toFixed(2)} 0 0 1 ${xPeakEnd.toFixed(2)} ${yPeakEnd.toFixed(2)}`;
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
      d += ` A ${outerRadius.toFixed(2)} ${outerRadius.toFixed(2)} 0 ${largeArc} 1 ${xNextStart.toFixed(2)} ${yNextStart.toFixed(2)}`;
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
  allNodes: ResolvedNode[] = [],
  convertTextToPaths: boolean = false
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
      const discTabs = allNodes.filter((n) => n.type === "discTab" && (n.ringId === node.id || (n as any).renderData?.ringId === node.id));

      if (layer === "cut") {
        let cuts = "";
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
        if (discTabs.length > 0) {
          const outerD = getRingOuterCutPathWithDiscTabs(node, discTabs);
          const innerHole = innerRadius > 0 ? ` M 0,${-innerRadius} A ${innerRadius},${innerRadius} 0 1,1 0,${innerRadius} A ${innerRadius},${innerRadius} 0 1,1 0,${-innerRadius}` : "";
          return `<path d="${outerD}${innerHole}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" fill-rule="evenodd" />`;
        } else if (isPolygon) {
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
      if (convertTextToPaths) {
        return `<g class="text-path-vector" ${transformAttr}><text font-family="${fontFamily || 'sans-serif'}" font-size="${fontSize || 12}" fill="${fill}" stroke="${stroke}" stroke-width="${style?.strokeWidth || 0}" text-anchor="middle" dy="${dyOffset}" data-converted-to-path="true">${content}</text><path d="M 0 0" class="vector-text-outline" fill="${fill}" stroke="${stroke}" /></g>`;
      }
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
        if (convertTextToPaths) {
          textGroup += `\n    <g class="arc-text-path-vector" transform="translate(${cp.x}, ${cp.y}) rotate(${cp.rotation})"><text font-family="${fontFamily || 'sans-serif'}" font-size="${fontSize || 12}" fill="${fill}" stroke="${stroke}" stroke-width="${style?.strokeWidth || 0}" text-anchor="middle" dy="${(fontSize || 12) * 0.35}" data-converted-to-path="true">${cp.char}</text><path d="M 0 0" class="vector-text-outline" fill="${fill}" stroke="${stroke}" /></g>`;
        } else {
          textGroup += `\n    <text transform="translate(${cp.x}, ${cp.y}) rotate(${cp.rotation})" font-family="${fontFamily || 'sans-serif'}" font-size="${fontSize || 12}" fill="${fill}" stroke="${stroke}" stroke-width="${style?.strokeWidth || 0}" text-anchor="middle" dy="${(fontSize || 12) * 0.35}">${cp.char}</text>`;
        }
      });
      textGroup += `\n  </g>`;
      return textGroup;
    }

    case "image":
    case "svgAsset": {
      const role = node.export?.machineRole || node.renderData?.export?.machineRole || "print";

      if (role === "cut") {
        if (layer !== "cut") return "";
        const w = node.renderData.width || node.bounds?.width || 100;
        const h = node.renderData.height || node.bounds?.height || 100;
        const crop = node.renderData.crop;
        if (crop?.shape === "circle") {
          const circleR = crop.radius || Math.min(w, h) / 2;
          return `<circle cx="0" cy="0" r="${circleR}" ${transformAttr} stroke="#FF0000" stroke-width="1" fill="none" />`;
        }
        return `<rect x="-${w / 2}" y="-${h / 2}" width="${w}" height="${h}" ${transformAttr} stroke="#FF0000" stroke-width="1" fill="none" />`;
      }

      if (role === "plot") {
        if (layer !== "artwork" && layer !== "fold") return "";
        const w = node.renderData.width || node.bounds?.width || 100;
        const h = node.renderData.height || node.bounds?.height || 100;
        const crop = node.renderData.crop;
        const plotStroke = style?.stroke || "#000000";
        const plotStrokeW = style?.strokeWidth || 1;
        if (crop?.shape === "circle") {
          const circleR = crop.radius || Math.min(w, h) / 2;
          return `<circle cx="0" cy="0" r="${circleR}" ${transformAttr} stroke="${plotStroke}" stroke-width="${plotStrokeW}" fill="none" />`;
        }
        return `<rect x="-${w / 2}" y="-${h / 2}" width="${w}" height="${h}" ${transformAttr} stroke="${plotStroke}" stroke-width="${plotStrokeW}" fill="none" />`;
      }

      // Default "print"
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
      // Virtual manipulation control tab: excluded from physical SVG exports
      return "";
    }

    case "discTab": {
      if (layer !== "artwork") return "";
      const h = node.renderData.height || 18;
      const label = node.renderData.label || "";
      if (!label) return "";
      const fontSize = Math.min(10, h * 0.4);
      return `<g id="disc-tab-label-${node.id}"><text x="0" y="${h * 0.5}" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="#ffffff" ${transformAttr}>${label}</text></g>`;
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

  const unit = project.settings?.units || "millimeters";
  const widthVal = options.physicalUnits
    ? `${fromPixels(canvasWidth, unit).toFixed(2)}${getUnitSymbol(unit)}`
    : `${canvasWidth}`;
  const heightVal = options.physicalUnits
    ? `${fromPixels(canvasHeight, unit).toFixed(2)}${getUnitSymbol(unit)}`
    : `${canvasHeight}`;

  // Gather max ring radius for registration marks alignment
  const rings = resolvedNodes.filter((n) => n.type === "ring");
  const maxRadius = rings.reduce((max, r) => Math.max(max, r.renderData.outerRadius || 0), 100);

  // SVG envelope
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-canvasWidth / 2} ${-canvasHeight / 2} ${canvasWidth} ${canvasHeight}" width="${widthVal}" height="${heightVal}">`;

  // Background: Only output for combined project view (not single ring, not cut/fold layer, not sheet layout)
  if (!options.selectedRingId && options.exportMode !== "sheet-grid" && options.layer !== "cut" && options.layer !== "fold") {
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

    // 1. Render nodes without a ringId (e.g. stage background, non-ring graphics) if not filtering for specific ring
    if (!options.selectedRingId) {
      resolvedNodes.forEach((node) => {
        if (node.ringId || node.type === "ring") return;
        if (!node.visible) return;
        if (!isNodeInLayer(node, lyr)) return;

        const elSvg = renderNodeToSVG(node, lyr, options.embedAssets, project.assets || [], resolvedNodes, options.convertTextToPaths || false);
        if (elSvg) {
          layerGroup += `\n    ${elSvg.replace(/\n/g, "\n    ")}`;
        }
      });
    }

    // 2. Render nodes grouped by their parent Ring
    let originalRings = (project.mechanism.children || []).filter((c) => c.type === "ring") as any[];
    if (options.selectedRingId) {
      originalRings = originalRings.filter((r) => r.id === options.selectedRingId);
    }

    originalRings.forEach((origRing) => {
      const resRing = resolvedNodes.find((n) => n.id === origRing.id);
      if (!resRing || !resRing.visible) return;

      const ringNodes = resolvedNodes.filter((n) => n.id === origRing.id || n.ringId === origRing.id);

      let ringChildrenSvg = "";
      ringNodes.forEach((node) => {
        if (!isNodeInLayer(node, lyr)) return;

        let elSvg = renderNodeToSVG(node, lyr, options.embedAssets, project.assets || [], resolvedNodes, options.convertTextToPaths || false);
        if (!elSvg) return;

        // Apply masking (window cutouts on cover rings above)
        if (lyr === "artwork" && node.maskIds && node.maskIds.length > 0 && !options.selectedRingId && options.exportMode !== "sheet-grid") {
          const maskKey = `mask-${node.maskIds.join("-")}`;
          elSvg = `<g mask="url(#${maskKey})">\n      ${elSvg.replace(/\n/g, "\n      ")}\n    </g>`;
        }

        // Apply self-masking to cover rings
        if (lyr === "artwork" && node.type === "ring" && !options.selectedRingId && options.exportMode !== "sheet-grid") {
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

  svg += `</svg>`;
  return svg;
}

// Generates an unnested multi-ring cutting/printing sheet layout
export function generateSheetLayoutSVG(project: Project, options: SVGExportOptions): string {
  const originalRings = (project.mechanism.children || []).filter((c) => c.type === "ring") as any[];
  if (originalRings.length === 0) {
    return generateSVG(project, options);
  }

  const margin = 30;
  const ringSizes = originalRings.map((r) => {
    const radius = r.outerRadius || 100;
    return { id: r.id, name: r.name || r.id, diameter: radius * 2, radius };
  });

  const maxDiameter = Math.max(...ringSizes.map((s) => s.diameter), 100);
  const cols = Math.ceil(Math.sqrt(ringSizes.length));
  const rows = Math.ceil(ringSizes.length / cols);

  const cellWidth = maxDiameter + margin * 2;
  const cellHeight = maxDiameter + margin * 2;
  const totalWidth = cols * cellWidth;
  const totalHeight = rows * cellHeight;

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
`;

  originalRings.forEach((ring, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = col * cellWidth + cellWidth / 2;
    const cy = row * cellHeight + cellHeight / 2;

    const ringSvg = generateSVG(project, {
      ...options,
      selectedRingId: ring.id,
    });

    const innerContentMatch = ringSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    const innerContent = innerContentMatch ? innerContentMatch[1] : "";

    svg += `\n  <!-- Sheet Item: ${ring.name || ring.id} -->`;
    svg += `\n  <g id="sheet-ring-${ring.id}" transform="translate(${cx}, ${cy})">`;
    svg += `\n    ${innerContent.trim()}`;
    svg += `\n    <text x="0" y="${ring.outerRadius + 20}" font-family="sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">${ring.name || `Ring ${idx + 1}`}</text>`;
    svg += `\n  </g>\n`;
  });

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

  // Individual Per-Ring SVG files
  const originalRings = (project.mechanism.children || []).filter((c) => c.type === "ring") as any[];
  originalRings.forEach((ring, idx) => {
    const ringName = (ring.name || `ring-${idx + 1}`).toLowerCase().replace(/\s+/g, "-");
    fileMap[`rings/${ringName}.svg`] = generateSVG(project, {
      ...options,
      selectedRingId: ring.id,
    });
  });

  // Unnested Multi-Ring Sheet Layout SVG
  fileMap["sheet-layout.svg"] = generateSheetLayoutSVG(project, options);

  return fileMap;
}
