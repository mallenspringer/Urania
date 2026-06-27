import type { Tool, ToolContext } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import { Matrix2D } from "../../shared/utils/matrix";
import { cartesianToPolar } from "../../shared/utils/math";
import { CreateNodeCommand } from "../project/commands";
import { useToolStore } from "./toolStore";

function generateUniqueId(type: string): string {
  return `${type}-${Math.random().toString(36).substr(2, 9)}`;
}

function getActiveRingNode(context: ToolContext) {
  const resolvedNodes = resolveProject(context.project);
  const ring = resolvedNodes.find((n) => n.id === context.activeRingId && n.type === "ring");
  if (ring) return ring;
  return resolvedNodes.find((n) => n.type === "ring");
}

export const radialGuideTool: Tool = {
  id: "create-guide-radial",
  label: "Radial Guide",
  icon: "Compass",
  cursor: "crosshair",
  category: "guides",

  onMouseDown(e, context) {
    if (e.evt.button === 0) {
      const pointer = context.pointerPos;
      if (!pointer) return;

      const activeRing = getActiveRingNode(context);
      if (!activeRing) return;

      const { x, y, rotation, scaleX, scaleY } = activeRing.worldTransform;
      const m = Matrix2D.identity()
        .translate(x, y)
        .rotate(rotation)
        .scale(scaleX, scaleY);

      try {
        const inv = m.invert();
        const localClick = inv.transformPoint(pointer.x, pointer.y);

        const { theta } = cartesianToPolar(localClick.x, localClick.y, 0, 0);
        const outerRadius = (activeRing.renderData.outerRadius as number) || 220;

        const newRadialGuide = {
          id: generateUniqueId("line"),
          type: "line",
          name: `Radial Guide (${Math.round(theta)}°)`,
          visible: true,
          locked: false,
          transform: {
            x: 0,
            y: 0,
            rotation: theta,
            scaleX: 1,
            scaleY: 1,
          },
          length: outerRadius,
          thickness: 1,
          style: {
            stroke: "#a8a29e",
            strokeWidth: 1,
            dash: [4, 4],
          },
          export: { artwork: false, cut: false, fold: false },
        };

        context.executeCommand(new CreateNodeCommand(activeRing.id, newRadialGuide));

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Ignored
      }
    }
  },
};

export const circularGuideTool: Tool = {
  id: "create-guide-circular",
  label: "Circular Guide",
  icon: "Orbit",
  cursor: "crosshair",
  category: "guides",

  onMouseDown(e, context) {
    if (e.evt.button === 0) {
      const pointer = context.pointerPos;
      if (!pointer) return;

      const activeRing = getActiveRingNode(context);
      if (!activeRing) return;

      const { x, y, rotation, scaleX, scaleY } = activeRing.worldTransform;
      const m = Matrix2D.identity()
        .translate(x, y)
        .rotate(rotation)
        .scale(scaleX, scaleY);

      try {
        const inv = m.invert();
        const localClick = inv.transformPoint(pointer.x, pointer.y);

        const radius = Math.sqrt(localClick.x * localClick.x + localClick.y * localClick.y);

        const newCircularGuide = {
          id: generateUniqueId("circle"),
          type: "circle",
          name: `Circular Guide (R ${Math.round(radius)})`,
          visible: true,
          locked: false,
          transform: {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          radius,
          style: {
            stroke: "#a8a29e",
            strokeWidth: 1,
            dash: [4, 4],
          },
          export: { artwork: false, cut: false, fold: false },
        };

        context.executeCommand(new CreateNodeCommand(activeRing.id, newCircularGuide));

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Ignored
      }
    }
  },
};
