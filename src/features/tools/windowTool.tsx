
import { Rect, Circle, RegularPolygon, Group } from "react-konva";
import type { Tool, ToolContext } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import { Matrix2D } from "../../shared/utils/matrix";
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

export const createWindowTool = (windowShapeType: "circle" | "rectangle" | "polygon"): Tool => {
  return {
    id: `create-window-${windowShapeType}`,
    label: `Window ${windowShapeType.charAt(0).toUpperCase() + windowShapeType.slice(1)}`,
    icon: "Eye",
    cursor: "crosshair",
    category: "windows",

    onMouseDown(e, context) {
      if (e.evt.button === 0) {
        const pointer = context.pointerPos;
        if (pointer) {
          context.updatePreview({
            startX: pointer.x,
            startY: pointer.y,
            currentX: pointer.x,
            currentY: pointer.y,
            isDragging: true,
          });
        }
      }
    },

    onMouseMove(_e, context) {
      if (context.currentPreviewData && context.currentPreviewData.isDragging) {
        const pointer = context.pointerPos;
        if (pointer) {
          context.updatePreview({
            ...context.currentPreviewData,
            currentX: pointer.x,
            currentY: pointer.y,
          });
        }
      }
    },

    onMouseUp(_e, context) {
      if (!context.currentPreviewData || !context.currentPreviewData.isDragging) return;
      const { startX, startY, currentX, currentY } = context.currentPreviewData;
      context.updatePreview(null);

      const activeRing = getActiveRingNode(context);
      if (!activeRing) return;

      const { x, y, rotation, scaleX, scaleY } = activeRing.worldTransform;
      const m = Matrix2D.identity()
        .translate(x, y)
        .rotate(rotation)
        .scale(scaleX, scaleY);

      try {
        const inv = m.invert();
        const localStart = inv.transformPoint(startX, startY);
        const localPointer = inv.transformPoint(currentX, currentY);

        const dx = localPointer.x - localStart.x;
        const dy = localPointer.y - localStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 4) return;

        let childShape: any;
        let localCenterX = localStart.x;
        let localCenterY = localStart.y;

        if (windowShapeType === "circle") {
          childShape = {
            id: generateUniqueId("circle"),
            type: "circle",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            radius: dist,
            style: {},
            export: { artwork: false, cut: true, fold: false },
          };
        } else if (windowShapeType === "rectangle") {
          const localWidth = Math.abs(dx);
          const localHeight = Math.abs(dy);
          localCenterX = (localStart.x + localPointer.x) / 2;
          localCenterY = (localStart.y + localPointer.y) / 2;

          childShape = {
            id: generateUniqueId("rectangle"),
            type: "rectangle",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            width: localWidth,
            height: localHeight,
            style: {},
            export: { artwork: false, cut: true, fold: false },
          };
        } else if (windowShapeType === "polygon") {
          const sides = context.isShift ? 3 : (useToolStore.getState().toolSettings.polygonSides || 5);
          childShape = {
            id: generateUniqueId("polygon"),
            type: "polygon",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            sides,
            radius: dist,
            cornerRadius: 0,
            style: {},
            export: { artwork: false, cut: true, fold: false },
          };
        }

        const newWindowNode = {
          id: generateUniqueId("window"),
          type: "window",
          name: `${windowShapeType.charAt(0).toUpperCase() + windowShapeType.slice(1)} Window`,
          visible: true,
          locked: false,
          transform: {
            x: localCenterX,
            y: localCenterY,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          shape: childShape,
          style: {
            stroke: "#10b981",
            strokeWidth: 2,
            dash: [4, 4],
          },
          export: { artwork: false, cut: true, fold: false },
        };

        context.executeCommand(new CreateNodeCommand(activeRing.id, newWindowNode));

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Singular matrix exception
      }
    },

    renderPreview(context) {
      if (!context.currentPreviewData) return null;
      const { startX, startY, currentX, currentY } = context.currentPreviewData;

      const activeRing = getActiveRingNode(context);
      if (!activeRing) return null;

      const { x, y, rotation, scaleX, scaleY } = activeRing.worldTransform;
      const m = Matrix2D.identity()
        .translate(x, y)
        .rotate(rotation)
        .scale(scaleX, scaleY);

      try {
        const inv = m.invert();
        const localStart = inv.transformPoint(startX, startY);
        const localPointer = inv.transformPoint(currentX, currentY);

        const dx = localPointer.x - localStart.x;
        const dy = localPointer.y - localStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return (
          <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY}>
            {windowShapeType === "rectangle" && (
              <Rect
                x={(localStart.x + localPointer.x) / 2 - Math.abs(dx) / 2}
                y={(localStart.y + localPointer.y) / 2 - Math.abs(dy) / 2}
                width={Math.abs(dx)}
                height={Math.abs(dy)}
                stroke="#10b981"
                strokeWidth={1}
                dash={[4, 4]}
              />
            )}
            {windowShapeType === "circle" && (
              <Circle
                x={localStart.x}
                y={localStart.y}
                radius={dist}
                stroke="#10b981"
                strokeWidth={1}
                dash={[4, 4]}
              />
            )}
            {windowShapeType === "polygon" && (
              <RegularPolygon
                x={localStart.x}
                y={localStart.y}
                sides={context.isShift ? 3 : (useToolStore.getState().toolSettings.polygonSides || 5)}
                radius={dist}
                stroke="#10b981"
                strokeWidth={1}
                dash={[4, 4]}
              />
            )}
          </Group>
        );
      } catch {
        return null;
      }
    },
  };
};

export const windowCircleTool = createWindowTool("circle");
export const windowRectangleTool = createWindowTool("rectangle");
export const windowPolygonTool = createWindowTool("polygon");
