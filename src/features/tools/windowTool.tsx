
import { Rect, Circle, RegularPolygon, Group } from "react-konva";
import type { Tool, ToolContext } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import { Matrix2D } from "../../shared/utils/matrix";
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
      const { startX, startY, currentX, currentY } = context.currentPreviewData as any;
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
            rotation: -rotation,
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

        const sym = useToolStore.getState().symmetryCount || 1;
        if (sym > 1) {
          const step = 360 / sym;
          const origX = newWindowNode.transform.x;
          const origY = newWindowNode.transform.y;
          const origRot = newWindowNode.transform.rotation;
          const groupId = `symgroup-${Math.random().toString(36).substring(2, 9)}`;

          const commands = [];
          for (let i = 0; i < sym; i++) {
            const angleRad = (i * step * Math.PI) / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);

            const rx = origX * cosA - origY * sinA;
            const ry = origX * sinA + origY * cosA;
            const rRot = origRot + i * step;

            const symNode = JSON.parse(JSON.stringify(newWindowNode));
            symNode.id = generateUniqueId("window");
            if (symNode.shape) {
              symNode.shape.id = generateUniqueId(symNode.shape.type);
            }
            symNode.transform.x = rx;
            symNode.transform.y = ry;
            symNode.transform.rotation = rRot;
            symNode.symmetryGroupId = groupId;
            symNode.symmetryIndex = i;
            symNode.symmetryCount = sym;

            commands.push(new CreateNodeCommand(activeRing.id, symNode));
          }
          context.executeCommand(new BatchCommand(commands, `Symmetrical Window Placement (${sym}x)`));
        } else {
          context.executeCommand(new CreateNodeCommand(activeRing.id, newWindowNode));
        }

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Singular matrix exception
      }
    },

    renderPreview(context) {
      if (!context.currentPreviewData) return null;
      const { startX, startY, currentX, currentY } = context.currentPreviewData as any;

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

        const sym = useToolStore.getState().symmetryCount || 1;
        const step = 360 / sym;

        const baseLocalCenterX = (localStart.x + localPointer.x) / 2;
        const baseLocalCenterY = (localStart.y + localPointer.y) / 2;

        const previews = [];
        for (let i = 0; i < sym; i++) {
          const angleRad = (i * step * Math.PI) / 180;
          const cosA = Math.cos(angleRad);
          const sinA = Math.sin(angleRad);
          const rRot = -rotation + i * step;

          if (windowShapeType === "rectangle") {
            const rx = baseLocalCenterX * cosA - baseLocalCenterY * sinA;
            const ry = baseLocalCenterX * sinA + baseLocalCenterY * cosA;
            previews.push(
              <Group key={i} x={rx} y={ry} rotation={rRot}>
                <Rect
                  x={-Math.abs(dx) / 2}
                  y={-Math.abs(dy) / 2}
                  width={Math.abs(dx)}
                  height={Math.abs(dy)}
                  stroke="#10b981"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              </Group>
            );
          } else if (windowShapeType === "circle") {
            const rx = localStart.x * cosA - localStart.y * sinA;
            const ry = localStart.x * sinA + localStart.y * cosA;
            previews.push(
              <Circle
                key={i}
                x={rx}
                y={ry}
                radius={dist}
                stroke="#10b981"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else if (windowShapeType === "polygon") {
            const rx = localStart.x * cosA - localStart.y * sinA;
            const ry = localStart.x * sinA + localStart.y * cosA;
            previews.push(
              <RegularPolygon
                key={i}
                x={rx}
                y={ry}
                rotation={rRot}
                sides={context.isShift ? 3 : (useToolStore.getState().toolSettings.polygonSides || 5)}
                radius={dist}
                stroke="#10b981"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          }
        }

        return (
          <Group x={x} y={y} rotation={rotation} scaleX={scaleX} scaleY={scaleY}>
            {previews}
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
