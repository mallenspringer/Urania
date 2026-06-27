import type { Project, Asset } from "../../shared/types/project";
import { resolveProject, type ResolvedNode } from "../runtime/mechanismEngine";

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
function getPolygonPath(sides: number, radius: number): string {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    pts.push(`${radius * Math.cos(angle)},${radius * Math.sin(angle)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

// Converts a node to raw SVG string based on export layer
function renderNodeToSVG(
  node: ResolvedNode,
  layer: "artwork" | "cut" | "fold",
  embedAssets: boolean,
  assets: Asset[]
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
      if (layer === "cut") {
        // Cut outlines of inner & outer circles
        let cuts = `<circle cx="0" cy="0" r="${outerRadius}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        if (innerRadius > 0) {
          cuts += `\n  <circle cx="0" cy="0" r="${innerRadius}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
        }
        return cuts;
      } else {
        // Artwork filled donut
        const pathD = getConcentricRingPath(innerRadius || 0, outerRadius || 100);
        return `<path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" fill-rule="evenodd" />`;
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

    case "polygon": {
      const pathD = getPolygonPath(sides || 3, radius || 10);
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
      const chars = (content || "").split("");
      const n = chars.length;
      const actualSweep = sweepAngle !== undefined && sweepAngle !== 0 ? sweepAngle : (chars.length * (fontSize * 0.5) / Math.max(1, radius)) * (180 / Math.PI);

      let textGroup = `<g ${transformAttr}>`;
      chars.forEach((char: string, i: number) => {
        const charAngle = n > 1 ? startAngle + i * (actualSweep / (n - 1)) : startAngle;
        const angleRad = (charAngle * Math.PI) / 180;
        const cx = radius * Math.cos(angleRad);
        const cy = radius * Math.sin(angleRad);
        const charRotation = charAngle + 90;

        textGroup += `\n    <text transform="translate(${cx}, ${cy}) rotate(${charRotation})" font-family="${fontFamily || 'sans-serif'}" font-size="${fontSize || 12}" fill="${fill}" stroke="${stroke}" stroke-width="${style?.strokeWidth || 0}" text-anchor="middle" dy="${(fontSize || 12) * 0.35}">${char}</text>`;
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

      const hrefStr = embedAssets ? asset.embeddedData : `assets/${asset.id}.${asset.type}`;
      return `<image href="${hrefStr}" x="-50" y="-50" width="100" height="100" ${transformAttr} />`;
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

      const elSvg = renderNodeToSVG(node, lyr, options.embedAssets, project.assets || []);
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

        let elSvg = renderNodeToSVG(node, lyr, options.embedAssets, project.assets || []);
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
