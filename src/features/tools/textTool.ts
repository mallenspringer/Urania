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

export const textTool: Tool = {
  id: "create-text",
  label: "Text",
  icon: "Type",
  cursor: "text",
  category: "text",

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

        const content = window.prompt("Enter text content:", "Label Text");
        if (!content) return;

        const settings = useToolStore.getState().toolSettings;

        const newTextNode = {
          id: generateUniqueId("text"),
          type: "text",
          name: "Text",
          visible: true,
          locked: false,
          transform: {
            x: localClick.x,
            y: localClick.y,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          content,
          fontFamily: settings.fontFamily || "Outfit",
          fontSize: settings.fontSize || 14,
          style: {
            fill: "#1e293b",
          },
          export: { artwork: true, cut: false, fold: false },
        };

        context.executeCommand(new CreateNodeCommand(activeRing.id, newTextNode));

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Ignored
      }
    }
  },
};

export const arcTextTool: Tool = {
  id: "create-arcText",
  label: "Arc Text",
  icon: "Heading",
  cursor: "text",
  category: "text",

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

        const content = window.prompt("Enter arc text content:", "Concentric Text");
        if (!content) return;

        const radius = Math.sqrt(localClick.x * localClick.x + localClick.y * localClick.y);
        const { theta } = cartesianToPolar(localClick.x, localClick.y, 0, 0);

        const sweepAngle = 40;
        const startAngle = theta - sweepAngle / 2;

        const settings = useToolStore.getState().toolSettings;

        const newArcTextNode = {
          id: generateUniqueId("arcText"),
          type: "arcText",
          name: "Arc Text",
          visible: true,
          locked: false,
          transform: {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          content,
          radius,
          startAngle,
          sweepAngle,
          fontFamily: settings.fontFamily || "Outfit",
          fontSize: settings.fontSize || 14,
          style: {
            fill: "#1e293b",
          },
          export: { artwork: true, cut: false, fold: false },
        };

        context.executeCommand(new CreateNodeCommand(activeRing.id, newArcTextNode));

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Ignored
      }
    }
  },
};
