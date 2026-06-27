import React from "react";
import { Group, Circle, Rect, Arc } from "react-konva";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import { useSelectionStore } from "../../features/selection/selectionStore";

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

  // Draw a curved arc selection highlight for arc text elements
  if (node.type === "arcText") {
    const radius = node.renderData.radius || 100;
    const startAngle = node.renderData.startAngle || 0;
    const sweepAngle = node.renderData.sweepAngle || 0;
    const fontSize = node.renderData.fontSize || 12;
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

  // Bounding box highlight for element shapes
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY} listening={false}>
      <Rect
        x={bx - 3}
        y={by - 3}
        width={width + 6}
        height={height + 6}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        dash={dash}
        listening={false}
      />
      {/* Corner pivot anchor points for active items */}
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
