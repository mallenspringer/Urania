import React, { useMemo } from "react";
import { Group, Line, Circle as KonvaCircle, Text as KonvaText } from "react-konva";
import { useViewStore } from "../../features/project/viewStore";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { useToolStore } from "../../features/tools/toolStore";
import { resolveProject } from "../../features/runtime/mechanismEngine";

interface CanvasGridOverlayProps {
  targetPosition?: "background" | "foreground";
}

export const CanvasGridOverlay: React.FC<CanvasGridOverlayProps> = ({ targetPosition }) => {
  const {
    showCanvasGrid,
    gridLayer,
    gridMode,
    manualSliceCount,
    showSliceGuides,
    showCircularGuides,
    gridOpacity,
    gridLineColorMode,
  } = useViewStore();

  const project = useProjectStore((state) => state.project);
  const activeRingId = useSelectionStore((state) => state.activeRingId);
  const symmetryCount = useToolStore((state) => state.symmetryCount);

  const resolvedNodes = useMemo(() => resolveProject(project), [project]);
  const rings = useMemo(() => resolvedNodes.filter((n) => n.type === "ring"), [resolvedNodes]);

  const activeRing = useMemo(() => {
    return rings.find((r) => r.id === activeRingId) || rings[0];
  }, [rings, activeRingId]);

  const maxOuterRadius = useMemo(() => {
    return rings.reduce((max, r) => Math.max(max, (r.renderData as any)?.outerRadius || 100), 100);
  }, [rings]);

  // Determine effective slice count
  const effectiveSliceCount = useMemo(() => {
    if (gridMode === "manual") {
      return Math.max(1, Math.min(360, manualSliceCount));
    }
    // Auto-symmetry mode: check active ring's radialSlices, polygonSides, or global symmetryCount
    if (activeRing?.renderData) {
      if (activeRing.renderData.ringShape === "polygon" && activeRing.renderData.polygonSides) {
        return activeRing.renderData.polygonSides;
      }
      if (activeRing.renderData.radialSlices) {
        return activeRing.renderData.radialSlices;
      }
    }
    return Math.max(1, symmetryCount || 12);
  }, [gridMode, manualSliceCount, activeRing, symmetryCount]);

  if (!showCanvasGrid || gridLayer === "off") return null;
  if (targetPosition && gridLayer !== targetPosition) return null;

  const R_max = maxOuterRadius + 60;
  const activeRingRotation = activeRing?.worldTransform?.rotation || 0;

  // Compute color theme
  const isForeground = gridLayer === "foreground";
  let strokeColor = "#818cf8";
  let labelColor = "#a5b4fc";
  let circleColor = "#6366f1";

  if (gridLineColorMode === "dark" || (gridLineColorMode === "auto" && isForeground)) {
    // Dark high-contrast charcoal lines for foreground view over paper discs
    strokeColor = "#0f172a";
    labelColor = "#334155";
    circleColor = "#1e293b";
  } else if (gridLineColorMode === "light") {
    // Very light crisp slate-white lines
    strokeColor = "#f8fafc";
    labelColor = "#ffffff";
    circleColor = "#cbd5e1";
  } else if (gridLineColorMode === "indigo") {
    strokeColor = "#818cf8";
    labelColor = "#a5b4fc";
    circleColor = "#6366f1";
  }

  // Generate Radial Slice Lines
  const sliceLines = [];
  const step = 360 / effectiveSliceCount;
  for (let i = 0; i < effectiveSliceCount; i++) {
    const angleDeg = i * step + activeRingRotation;
    const rad = (angleDeg * Math.PI) / 180;
    const x2 = R_max * Math.cos(rad);
    const y2 = R_max * Math.sin(rad);

    const labelR = R_max + 12;
    const lx = labelR * Math.cos(rad);
    const ly = labelR * Math.sin(rad);
    const displayAngle = Math.round((i * step) % 360);

    sliceLines.push(
      <Group key={`slice-guide-${i}`}>
        <Line
          points={[0, 0, x2, y2]}
          stroke={strokeColor}
          strokeWidth={1}
          dash={[4, 4]}
          opacity={isForeground ? 0.9 : 0.8}
        />
        {/* Angle degree label */}
        {effectiveSliceCount <= 36 && (
          <KonvaText
            text={`${displayAngle}°`}
            x={lx - 12}
            y={ly - 6}
            width={24}
            fontSize={9}
            fill={labelColor}
            align="center"
            opacity={0.9}
          />
        )}
      </Group>
    );
  }

  // Generate Concentric Circular Guides
  const circularGuides: React.ReactNode[] = [];
  if (showCircularGuides) {
    const radiiSet = new Set<number>();

    // 1. Include exact inner & outer radii of all mechanism rings
    rings.forEach((r) => {
      const data = r.renderData as any;
      if (data?.outerRadius) radiiSet.add(data.outerRadius);
      if (data?.innerRadius && data.innerRadius > 0) radiiSet.add(data.innerRadius);
    });

    // 2. Include standard drafting step circles (50, 100, 150, 200, 250)
    for (let r = 50; r <= R_max; r += 50) {
      radiiSet.add(r);
    }

    Array.from(radiiSet)
      .sort((a, b) => a - b)
      .forEach((r) => {
        circularGuides.push(
          <KonvaCircle
            key={`circ-guide-${r}`}
            radius={r}
            stroke={circleColor}
            strokeWidth={1}
            dash={[2, 4]}
            opacity={isForeground ? 0.85 : 0.6}
          />
        );
      });
  }

  return (
    <Group opacity={gridOpacity} listening={false}>
      {/* Concentric Circular Guides */}
      {showCircularGuides && circularGuides}

      {/* Radial Slice Lines */}
      {showSliceGuides && sliceLines}

      {/* Center Axis Indicator */}
      <KonvaCircle radius={maxOuterRadius + 60} stroke={strokeColor} strokeWidth={1} dash={[1, 3]} opacity={0.5} />
    </Group>
  );
};
