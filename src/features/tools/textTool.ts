import type { Tool, ToolContext } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import { Matrix2D } from "../../shared/utils/matrix";
import { cartesianToPolar } from "../../shared/utils/math";
import { CreateNodeCommand, BatchCommand } from "../project/commands";
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

        const content = "Text";
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
            rotation: -rotation,
            scaleX: 1,
            scaleY: 1,
          },
          content,
          fontFamily: settings.fontFamily || "Outfit",
          fontSize: settings.fontSize || 14,
          style: {
            fill: "#cbd5e1",
          },
          export: { artwork: true, cut: false, fold: false },
        };

        let nodeToCreate: any = newTextNode;
        if (useToolStore.getState().creationMode === "cutout") {
          const solidType = newTextNode.type;
          const solidStyle = { fill: "#cbd5e1" };
          const childShape = {
            ...newTextNode,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            style: { fill: "transparent" },
            export: { artwork: false, cut: true, fold: false },
          };

          nodeToCreate = {
            id: generateUniqueId("window"),
            type: "window",
            name: `${newTextNode.name} Cutout`,
            visible: true,
            locked: false,
            transform: newTextNode.transform,
            export: { artwork: false, cut: true, fold: false },
            savedSolidType: solidType,
            savedSolidStyle: solidStyle,
            shape: childShape,
          };
        }

        const sym = useToolStore.getState().symmetryCount || 1;
        if (sym > 1) {
          const step = 360 / sym;
          const origX = nodeToCreate.transform.x;
          const origY = nodeToCreate.transform.y;
          const origRot = nodeToCreate.transform.rotation;
          const groupId = `symgroup-${Math.random().toString(36).substring(2, 9)}`;

          let firstCreatedId = nodeToCreate.id;
          const commands = [];

          for (let i = 0; i < sym; i++) {
            const angleRad = (i * step * Math.PI) / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);

            const rx = origX * cosA - origY * sinA;
            const ry = origX * sinA + origY * cosA;
            const rRot = origRot + i * step;

            const symNode = JSON.parse(JSON.stringify(nodeToCreate));
            symNode.id = generateUniqueId(nodeToCreate.type);
            if (symNode.type === "window" && symNode.shape) {
              symNode.shape.id = generateUniqueId(symNode.shape.type);
            }
            symNode.transform.x = rx;
            symNode.transform.y = ry;
            symNode.transform.rotation = rRot;
            symNode.symmetryGroupId = groupId;
            symNode.symmetryIndex = i;
            symNode.symmetryCount = sym;

            if (i === 0) firstCreatedId = symNode.id;

            commands.push(new CreateNodeCommand(activeRing.id, symNode));
          }

          context.executeCommand(new BatchCommand(commands, `Symmetrical Text Placement (${sym}x)`));
          useToolStore.getState().setEditingTextNodeId(firstCreatedId);
        } else {
          context.executeCommand(new CreateNodeCommand(activeRing.id, nodeToCreate));
          useToolStore.getState().setEditingTextNodeId(nodeToCreate.id);
        }

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

        const content = "Arc Text";
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
          kerning: 0,
          style: {
            fill: "#cbd5e1",
          },
          export: { artwork: true, cut: false, fold: false },
        };

        let nodeToCreate: any = newArcTextNode;
        if (useToolStore.getState().creationMode === "cutout") {
          const solidType = newArcTextNode.type;
          const solidStyle = { fill: "#cbd5e1" };
          const childShape = {
            ...newArcTextNode,
            style: { fill: "transparent" },
            export: { artwork: false, cut: true, fold: false },
          };

          nodeToCreate = {
            id: generateUniqueId("window"),
            type: "window",
            name: `${newArcTextNode.name} Cutout`,
            visible: true,
            locked: false,
            transform: newArcTextNode.transform,
            export: { artwork: false, cut: true, fold: false },
            savedSolidType: solidType,
            savedSolidStyle: solidStyle,
            shape: childShape,
          };
        }

        context.executeCommand(new CreateNodeCommand(activeRing.id, nodeToCreate));

        useToolStore.getState().setEditingTextNodeId(nodeToCreate.id);

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Ignored
      }
    }
  },
};
