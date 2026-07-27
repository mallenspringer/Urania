import React from "react";
import { Group, Circle, Rect, Arc, Line } from "react-konva";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { getArcTextCharPositions } from "../utils/textGeometry";

interface SelectionOutlineProps {
  node: ResolvedNode;
  isActive: boolean;
}

const SelectionOutline: React.FC<SelectionOutlineProps> = ({ node, isActive }) => {
  const { x, y, rotation, scaleX, scaleY } = node.worldTransform;
  const { x: bx, y: by, width, height } = node.bounds;

  // Purple/Indigo accents for active vs. selected nodes
  const strokeColor = isActive ? "#c084fc" : "#818cf8";
  const strokeWidth = 1.5;
  const dash = [4, 4];

  if (node.type === "ring") {
    const outerRadius = node.renderData.outerRadius || 100;
    const innerRadius = node.renderData.innerRadius || 0;
    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
        {/* Outer boundary dashed circle */}
        <Circle
          radius={outerRadius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
        {/* Inner boundary dashed circle */}
        {innerRadius > 0 && (
          <Circle
            radius={innerRadius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            dash={dash}
            opacity={0.5}
            listening={false}
          />
        )}
      </Group>
    );
  }

  // Draw direct line selection outline & end handles for line elements (solid or cutout)
  const isLineNode = node.type === "line" || (node.type === "window" && node.renderData.shape?.type === "line");
  if (isLineNode) {
    const targetShape = node.type === "window" ? node.renderData.shape : node.renderData;
    const lineLength = targetShape?.length || 50;
    const sx = Math.abs(scaleX) || 1;
    const sy = Math.abs(scaleY) || 1;
    const invStroke = strokeWidth / Math.min(sx, sy);
    const hw = 6 / sx;
    const hh = 6 / sy;

    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
        <Line
          points={[0, 0, lineLength, 0]}
          stroke={strokeColor}
          strokeWidth={invStroke}
          dash={[4 / sx, 4 / sy]}
          listening={false}
        />
        {isActive && (
          <>
            {/* Startpoint handle (left-mid) */}
            <Rect
              x={-hw / 2}
              y={-hh / 2}
              width={hw}
              height={hh}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1 / Math.min(sx, sy)}
              listening={false}
            />
            {/* Endpoint handle (right-mid) */}
            <Rect
              x={lineLength - hw / 2}
              y={-hh / 2}
              width={hw}
              height={hh}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1 / Math.min(sx, sy)}
              listening={false}
            />
          </>
        )}
      </Group>
    );
  }

  // Draw direct Bézier curve selection outline & control handle arms for curve elements (solid or cutout)
  const isCurveNode = node.type === "curve" || (node.type === "window" && node.renderData.shape?.type === "curve");
  if (isCurveNode) {
    const targetShape = node.type === "window" ? node.renderData.shape : node.renderData;
    const pts = targetShape?.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
    const sx = Math.abs(scaleX) || 1;
    const sy = Math.abs(scaleY) || 1;
    const hw = 6 / sx;
    const hh = 6 / sy;

    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
        {isActive && (
          <>
            {/* Control arm lines P0 -> C1 and P1 -> C2 */}
            <Line points={[pts.p0.x, pts.p0.y, pts.c1.x, pts.c1.y]} stroke="#a855f7" strokeWidth={1} dash={[2, 2]} listening={false} />
            <Line points={[pts.p1.x, pts.p1.y, pts.c2.x, pts.c2.y]} stroke="#a855f7" strokeWidth={1} dash={[2, 2]} listening={false} />

            {/* P0 handle (Startpoint) */}
            <Rect x={pts.p0.x - hw / 2} y={pts.p0.y - hh / 2} width={hw} height={hh} fill="#c084fc" stroke="#ffffff" strokeWidth={1} listening={false} />
            {/* C1 handle knob */}
            <Circle x={pts.c1.x} y={pts.c1.y} radius={4 / sx} fill="#ec4899" stroke="#ffffff" strokeWidth={1} listening={false} />
            {/* C2 handle knob */}
            <Circle x={pts.c2.x} y={pts.c2.y} radius={4 / sx} fill="#ec4899" stroke="#ffffff" strokeWidth={1} listening={false} />
            {/* P1 handle (Endpoint) */}
            <Rect x={pts.p1.x - hw / 2} y={pts.p1.y - hh / 2} width={hw} height={hh} fill="#c084fc" stroke="#ffffff" strokeWidth={1} listening={false} />
          </>
        )}
      </Group>
    );
  }

  // Draw a curved arc selection highlight for arc text elements (solid or cutout)
  const isArcTextNode = node.type === "arcText" || (node.type === "window" && node.renderData.shape?.type === "arcText");

  if (isArcTextNode) {
    const targetShape = node.type === "window" ? node.renderData.shape : node.renderData;
    const radius = targetShape?.radius || 100;
    const startAngle = targetShape?.startAngle || 0;
    const fontSize = targetShape?.fontSize || 12;
    const content = targetShape?.content || "";
    const fontFamily = targetShape?.fontFamily || "Outfit, Inter, sans-serif";
    const kerning = targetShape?.kerning || 0;

    const layout = getArcTextCharPositions(content, radius, startAngle, fontSize, fontFamily, kerning);
    const sweepAngle = layout.totalSweep > 0 ? layout.totalSweep : (targetShape?.sweepAngle || 30);

    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
        <Arc
          innerRadius={radius - fontSize * 0.6}
          outerRadius={radius + fontSize * 0.6}
          angle={sweepAngle}
          rotation={startAngle}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
        {isActive && (
          <>
            <Rect
              x={bx - 6}
              y={by - 6}
              width={6}
              height={6}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1}
              listening={false}
            />
            <Rect
              x={bx + width}
              y={by - 6}
              width={6}
              height={6}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1}
              listening={false}
            />
            <Rect
              x={bx - 6}
              y={by + height}
              width={6}
              height={6}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1}
              listening={false}
            />
            <Rect
              x={bx + width}
              y={by + height}
              width={6}
              height={6}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1}
              listening={false}
            />
          </>
        )}
      </Group>
    );
  }

  // Draw a wedge-shaped outline highlight for sectors
  if (node.type === "sector") {
    const innerRadius = node.renderData.innerRadius || 0;
    const outerRadius = node.renderData.outerRadius || 100;
    const startAngle = node.renderData.startAngle || 0;
    const endAngle = node.renderData.endAngle || 0;
    const sweepAngle = endAngle - startAngle;
    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
        <Arc
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          angle={sweepAngle}
          rotation={0}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
      </Group>
    );
  }

  // Draw a curved arc selection outline for radial warped elements
  if (node.renderData?.isRadialWarp) {
    const r = node.renderData.radialRadius || 100;
    // w is the angular span in degrees (stored in bounds.width for warp nodes, mirrors the renderer)
    const w = node.bounds.width;
    const h = node.bounds.height;
    const innerRadius = Math.max(0, r - h / 2);
    const outerRadius = r + h / 2;
    const wRad = (w / 2) * (Math.PI / 180);

    const corners = [
      { name: "top-left",    lx: innerRadius * Math.cos(-wRad), ly: innerRadius * Math.sin(-wRad) },
      { name: "top-right",   lx: innerRadius * Math.cos(wRad),  ly: innerRadius * Math.sin(wRad)  },
      { name: "bottom-left", lx: outerRadius * Math.cos(-wRad), ly: outerRadius * Math.sin(-wRad) },
      { name: "bottom-right",lx: outerRadius * Math.cos(wRad),  ly: outerRadius * Math.sin(wRad)  },
      // Midpoint handles
      { name: "top-mid",    lx: innerRadius, ly: 0 },
      { name: "bottom-mid", lx: outerRadius, ly: 0 },
      { name: "left-mid",   lx: r * Math.cos(-wRad), ly: r * Math.sin(-wRad) },
      { name: "right-mid",  lx: r * Math.cos(wRad),  ly: r * Math.sin(wRad)  },
    ];

    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
        {/* Outer arc */}
        <Arc
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          angle={w}
          rotation={-w / 2}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
        {/* Left radial edge line (inner → outer at -wRad) */}
        <Line
          points={[
            innerRadius * Math.cos(-wRad), innerRadius * Math.sin(-wRad),
            outerRadius * Math.cos(-wRad), outerRadius * Math.sin(-wRad),
          ]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
        {/* Right radial edge line (inner → outer at +wRad) */}
        <Line
          points={[
            innerRadius * Math.cos(wRad), innerRadius * Math.sin(wRad),
            outerRadius * Math.cos(wRad), outerRadius * Math.sin(wRad),
          ]}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          dash={dash}
          listening={false}
        />
        {isActive &&
          corners.map((c, i) => (
            <Rect
              key={i}
              x={c.lx - 3}
              y={c.ly - 3}
              width={6}
              height={6}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1}
              listening={false}
            />
          ))}
      </Group>
    );
  }

  // Bounding box highlight for element shapes
  const sx = Math.abs(scaleX) || 1;
  const sy = Math.abs(scaleY) || 1;
  const invStroke = strokeWidth / Math.min(sx, sy);
  const hw = 6 / sx;
  const hh = 6 / sy;

  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
      <Rect
        x={bx - 3}
        y={by - 3}
        width={width + 6}
        height={height + 6}
        stroke={strokeColor}
        strokeWidth={invStroke}
        dash={[4 / sx, 4 / sy]}
        listening={false}
      />
      {/* Handle grips for active items (4 corners + 4 side mid-points) */}
      {isActive && (
        <>
          {[
            { x: bx - 3, y: by - 3 }, // top-left
            { x: bx + width - 3, y: by - 3 }, // top-right
            { x: bx - 3, y: by + height - 3 }, // bottom-left
            { x: bx + width - 3, y: by + height - 3 }, // bottom-right
            // Side handles
            { x: bx + width / 2 - 3, y: by - 3 }, // top-mid
            { x: bx + width / 2 - 3, y: by + height - 3 }, // bottom-mid
            { x: bx - 3, y: by + height / 2 - 3 }, // left-mid
            { x: bx + width - 3, y: by + height / 2 - 3 }, // right-mid
          ].map((h, i) => (
            <Rect
              key={i}
              x={h.x}
              y={h.y}
              width={hw}
              height={hh}
              fill="#c084fc"
              stroke="#ffffff"
              strokeWidth={1 / Math.min(sx, sy)}
              listening={false}
            />
          ))}
        </>
      )}
    </Group>
  );
};

interface SelectionHighlightsProps {
  nodes: ResolvedNode[];
}

export const SelectionHighlights: React.FC<SelectionHighlightsProps> = ({ nodes }) => {
  const { selectedItems, activeItem } = useSelectionStore();

  return (
    <Group listening={false}>
      {selectedItems.map((item) => {
        const matchingNode = nodes.find((n) => n.id === item.id);
        if (!matchingNode) return null;

        return (
          <SelectionOutline
            key={item.id}
            node={matchingNode}
            isActive={activeItem?.id === item.id}
          />
        );
      })}
    </Group>
  );
};
