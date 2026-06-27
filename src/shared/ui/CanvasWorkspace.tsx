import React, { useRef, useState, useEffect, useMemo } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { useViewStore } from "../../features/project/viewStore";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { resolveProject } from "../../features/runtime/mechanismEngine";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import type { Project, RingNode } from "../../shared/types/project";
import { ResolvedRenderer } from "./ResolvedRenderer";
import { Matrix2D } from "../../shared/utils/matrix";
import { SelectionHighlights } from "./SelectionHighlights";

function findRingForNode(project: Project, nodeId: string): string | null {
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

function findNodeInTree(node: any, id: string): any | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, id);
      if (found) return found;
    }
  }
  return null;
}

function isDescendantOf(parentNode: any, childId: string): boolean {
  if (!parentNode.children) return false;
  for (const child of parentNode.children) {
    if (child.id === childId) return true;
    if (isDescendantOf(child, childId)) return true;
  }
  return false;
}

function normalizeAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

function isAngleBetween(target: number, start: number, sweep: number): boolean {
  const normTarget = normalizeAngle(target - start);
  return normTarget <= sweep;
}

function isPointInsideNode(pos: { x: number; y: number }, node: ResolvedNode): boolean {
  const { x, y, rotation, scaleX, scaleY } = node.worldTransform;
  const { x: bx, y: by, width: bw, height: bh } = node.bounds;

  // Build the world transform matrix
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
        // Default bounding box check
        return lp.x >= bx && lp.x <= bx + bw && lp.y >= by && lp.y <= by + bh;
    }
  } catch {
    return false;
  }
}

function isPointInsideWindow(pos: { x: number; y: number }, windowNode: ResolvedNode): boolean {
  return isPointInsideNode(pos, windowNode);
}

function getNodeKeyPoints(node: ResolvedNode): { x: number; y: number }[] {
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
    
    // Sample 9 points: start, middle, and end angles, at inner, middle, and outer radii
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
    
    // Sample 5 points distributed evenly along the text arc sweep path
    const points: { x: number; y: number }[] = [];
    const numPoints = 5;
    for (let i = 0; i < numPoints; i++) {
      const angle = start + (i * sweep) / (numPoints - 1);
      const rad = ((rotation + angle) * Math.PI) / 180;
      points.push({ x: x + radius * Math.cos(rad), y: y + radius * Math.sin(rad) });
    }
    return points;
  }
  // For other shapes, use the center and the world corners of its bounds
  const { x: bx, y: by, width: bw, height: bh } = node.bounds;
  const corners = [
    { lx: 0, ly: 0 }, // center
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

const isNodeTouchedByMarquee = (
  node: ResolvedNode,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  allNodes: ResolvedNode[],
  project: Project
) => {
  // Helper to verify if a point is within the mask constraints of the node,
  // taking into account dial sizes and visibility.
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
      return true; // Exposed because the masking dial does not cover it
    });
  };

  // 1. Check if any key point of the node is inside the marquee box and revealed
  const keyPoints = getNodeKeyPoints(node);
  const anyKeyPointInside = keyPoints.some(
    (kp) => kp.x >= x1 && kp.x <= x2 && kp.y >= y1 && kp.y <= y2 && isPointRevealed(kp)
  );
  if (anyKeyPointInside) return true;

  // 2. Check if any point on the marquee box (corners + center + edge midpoints) is inside the node's shape and revealed
  const marqueePoints = [
    { x: x1, y: y1 }, // top-left
    { x: x2, y: y1 }, // top-right
    { x: x1, y: y2 }, // bottom-left
    { x: x2, y: y2 }, // bottom-right
    { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, // center
    { x: (x1 + x2) / 2, y: y1 }, // top-mid
    { x: (x1 + x2) / 2, y: y2 }, // bottom-mid
    { x: x1, y: (y1 + y2) / 2 }, // left-mid
    { x: x2, y: (y1 + y2) / 2 }, // right-mid
  ];

  const anyMarqueePointInside = marqueePoints.some((mp) =>
    isPointInsideNode(mp, node) && isPointRevealed(mp)
  );
  return anyMarqueePointInside;
};

export const CanvasWorkspace: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Marquee Drag Select States
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMarqueeDragging, setIsMarqueeDragging] = useState(false);
  const wasDraggingRef = useRef(false);

  const { zoom, pan, setZoom, setPan, resetView } = useViewStore();
  const project = useProjectStore((state) => state.project);
  const {
    selectItem,
    clearSelection,
    activeRingId,
    setActiveRingId,
    setSelection,
  } = useSelectionStore();

  const resolvedNodes = useMemo(() => resolveProject(project), [project]);

  // Track size of container
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Track spacebar state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (
          document.activeElement === document.body ||
          document.activeElement?.tagName === "MAIN"
        ) {
          e.preventDefault();
        }
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const stageX = dimensions.width / 2 + pan.x;
  const stageY = dimensions.height / 2 + pan.y;

  // Panning & Marquee mouse events
  const handleMouseDown = (e: any) => {
    const isMiddleButton = e.evt.button === 1;
    const isSpaceDrag = e.evt.button === 0 && isSpacePressed;

    if (isMiddleButton || isSpaceDrag) {
      e.evt.preventDefault();
      setIsPanning(true);
      dragStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    // Left click anywhere starts marquee drag select
    if (e.evt.button === 0) {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const wx = (pointer.x - stageX) / zoom;
      const wy = (pointer.y - stageY) / zoom;

      setIsMarqueeDragging(true);
      setMarqueeStart({ x: wx, y: wy });
      setMarqueeEnd({ x: wx, y: wy });
    }
  };

  const handleMouseMove = (e: any) => {
    if (isPanning) {
      e.evt.preventDefault();
      const dx = e.evt.clientX - dragStartRef.current.x;
      const dy = e.evt.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      setPan({ x: pan.x + dx, y: pan.y + dy });
      return;
    }

    if (isMarqueeDragging && marqueeStart) {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const wx = (pointer.x - stageX) / zoom;
      const wy = (pointer.y - stageY) / zoom;
      setMarqueeEnd({ x: wx, y: wy });
    }
  };

  const handleMouseUp = (e: any) => {
    setIsPanning(false);

    if (isMarqueeDragging && marqueeStart && marqueeEnd) {
      setIsMarqueeDragging(false);

      const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
      const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
      const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
      const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

      const dx = Math.abs(marqueeEnd.x - marqueeStart.x) * zoom;
      const dy = Math.abs(marqueeEnd.y - marqueeStart.y) * zoom;

      // If drag is tiny, let onClick take care of it as standard selection click
      if (dx < 4 && dy < 4) {
        setMarqueeStart(null);
        setMarqueeEnd(null);
        return;
      }

      wasDraggingRef.current = true;

      // Process Marquee Selection
      const isShift = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      const matches: { id: string; type: string }[] = [];

      resolvedNodes.forEach((node) => {
        if (node.visible && isNodeTouchedByMarquee(node, x1, y1, x2, y2, resolvedNodes, project)) {
          const nodeObj = findNodeInTree(project.mechanism, node.id);
          const isLocked = nodeObj ? nodeObj.locked : false;
          if (node.type !== "volvelle" && node.type !== "ring" && node.type !== "sector" && !isLocked) {
            matches.push({ id: node.id, type: node.type });
          }
        }
      });

      if (isShift) {
        matches.forEach((m) => selectItem(m.id, m.type, true));
      } else {
        // Filter parent-child exclusions from marquee match list
        const filtered: { id: string; type: string }[] = [];
        matches.forEach((m) => {
          const selectedNode = findNodeInTree(project.mechanism, m.id);
          const violates = filtered.some((f) => {
            const fNode = findNodeInTree(project.mechanism, f.id);
            return isDescendantOf(selectedNode, f.id) || isDescendantOf(fNode, m.id);
          });
          if (!violates) {
            filtered.push(m);
          }
        });
        setSelection(filtered);
      }

      setMarqueeStart(null);
      setMarqueeEnd(null);
    }
  };

  // Zooming mouse events
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = zoom;
    const scaleBy = 1.1;
    const direction = e.evt.deltaY < 0 ? 1 : -1;

    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.05, Math.min(64.0, newScale));

    const mousePointTo = {
      x: (pointer.x - (dimensions.width / 2 + pan.x)) / oldScale,
      y: (pointer.y - (dimensions.height / 2 + pan.y)) / oldScale,
    };

    const newPan = {
      x: pointer.x - mousePointTo.x * newScale - dimensions.width / 2,
      y: pointer.y - mousePointTo.y * newScale - dimensions.height / 2,
    };

    setZoom(newScale);
    setPan(newPan);
  };

  const handleStageClick = (e: any) => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }

    // If clicked empty canvas background
    if (e.target === e.target.getStage()) {
      clearSelection();
      return;
    }

    // Get stage pointer position to do intersection check
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Convert screen pos to world space coordinates
    const wx = (pos.x - stageX) / zoom;
    const wy = (pos.y - stageY) / zoom;

    const candidates: ResolvedNode[] = [];
    // Traverse from top-most (end of resolvedNodes) to bottom-most (start of resolvedNodes)
    for (let i = resolvedNodes.length - 1; i >= 0; i--) {
      const node = resolvedNodes[i];
      if (node.visible && isPointInsideNode({ x: wx, y: wy }, node)) {
        const nodeObj = findNodeInTree(project.mechanism, node.id);
        const isLocked = nodeObj ? nodeObj.locked : false;
        if (isLocked) continue;

        // Check if node is masked and if the pointer coordinate is inside the reveal mask windows
        if (node.maskIds && node.maskIds.length > 0) {
          const isRevealed = node.maskIds.every((maskId) => {
            const maskRingId = findRingForNode(project, maskId);
            if (maskRingId) {
              const maskRing = resolvedNodes.find((n) => n.id === maskRingId);
              if (maskRing && maskRing.visible && isPointInsideNode({ x: wx, y: wy }, maskRing)) {
                // The masking ring covers this point, so we must check if we are inside the window cutout
                const maskNode = resolvedNodes.find((n) => n.id === maskId);
                if (!maskNode) return true; // Failsafe
                return isPointInsideWindow({ x: wx, y: wy }, maskNode);
              }
            }
            return true; // Exposed because the masking dial does not cover it
          });
          if (!isRevealed) continue; // Obscured by mask, filter out
        }

        candidates.push(node);
      }
    }

    if (candidates.length === 0) {
      clearSelection();
      return;
    }

    // Helper to determine the selection hierarchy priority:
    // Priority 1: Leaf Content Elements (text, arcText, circle, etc.)
    // Priority 2: Window cutouts (transparent areas that let you click through)
    // Priority 3: Sector wedge containers
    // Priority 4: Ring structural bands
    const getSelectionPriority = (type: string): number => {
      switch (type) {
        case "ring":
          return 4;
        case "sector":
          return 3;
        case "window":
          return 2;
        default:
          return 1;
      }
    };

    const pri1 = candidates.filter((c) => getSelectionPriority(c.type) === 1);
    const pri2 = candidates.filter((c) => getSelectionPriority(c.type) === 2);
    const pri3 = candidates.filter((c) => getSelectionPriority(c.type) === 3);
    const pri4 = candidates.filter((c) => getSelectionPriority(c.type) === 4);

    let targetNode: ResolvedNode;

    if (pri1.length > 0) {
      // Prioritize specific leaf content element matches, applying active ring bias within the same tier
      targetNode = pri1[0];
      if (activeRingId) {
        const activeCandidate = pri1.find((c) => {
          const ringId = findRingForNode(project, c.id);
          return ringId === activeRingId;
        });
        if (activeCandidate) {
          targetNode = activeCandidate;
        }
      }
    } else if (pri2.length > 0) {
      // Fallback to window cutouts
      targetNode = pri2[0];
      if (activeRingId) {
        const activeCandidate = pri2.find((c) => {
          const ringId = findRingForNode(project, c.id);
          return ringId === activeRingId;
        });
        if (activeCandidate) {
          targetNode = activeCandidate;
        }
      }
    } else if (pri3.length > 0) {
      // Fallback to sector wedges
      targetNode = pri3[0];
      if (activeRingId) {
        const activeCandidate = pri3.find((c) => {
          const ringId = findRingForNode(project, c.id);
          return ringId === activeRingId;
        });
        if (activeCandidate) {
          targetNode = activeCandidate;
        }
      }
    } else {
      // Fallback to background rings
      targetNode = pri4[0];
      if (activeRingId) {
        const activeCandidate = pri4.find((r) => r.id === activeRingId);
        if (activeCandidate) {
          targetNode = activeCandidate;
        }
      }
    }

    // Perform selectItem in store
    const isShift = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    selectItem(targetNode.id, targetNode.type, isShift);

    // Update active ring focus
    const associatedRingId = findRingForNode(project, targetNode.id);
    if (associatedRingId) {
      setActiveRingId(associatedRingId);
    }
  };

  // Compute local dragging marquee overlay rect bounds
  const marqueeRect = useMemo(() => {
    if (!isMarqueeDragging || !marqueeStart || !marqueeEnd) return null;
    const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
    const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
    const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
    const y2 = Math.max(marqueeStart.y, marqueeEnd.y);
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }, [isMarqueeDragging, marqueeStart, marqueeEnd]);

  let cursorStyle = "default";
  if (isPanning) {
    cursorStyle = "grabbing";
  } else if (isSpacePressed) {
    cursorStyle = "grab";
  } else if (isMarqueeDragging) {
    cursorStyle = "crosshair";
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#111216", // Premium dark slate background
        cursor: cursorStyle,
        userSelect: "none",
      }}
    >
      {/* Zoom / Reset controller UI overlay in bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          zIndex: 10,
          display: "flex",
          gap: "8px",
          backgroundColor: "rgba(22, 23, 28, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          color: "#f1f5f9",
          fontFamily: "Outfit, Inter, sans-serif",
          fontSize: "12px",
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <button
          onClick={() => resetView()}
          style={{
            background: "#6366f1",
            border: "none",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "11px",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
        >
          Reset
        </button>
      </div>

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={stageX}
        y={stageY}
        scaleX={zoom}
        scaleY={zoom}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleStageClick}
      >
        <Layer>
          <ResolvedRenderer nodes={resolvedNodes} />

          {/* Marquee outline Rect element */}
          {marqueeRect && (
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="rgba(99, 102, 241, 0.08)"
              stroke="#818cf8"
              strokeWidth={1}
              dash={[3, 3]}
            />
          )}

          {/* Visual selection outline overlays */}
          <SelectionHighlights nodes={resolvedNodes} />
        </Layer>
      </Stage>
    </div>
  );
};
