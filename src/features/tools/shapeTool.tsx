
import { Rect, Circle, RegularPolygon, Group, Line as KonvaLine } from "react-konva";
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

export const createShapeTool = (shapeType: "rectangle" | "circle" | "polygon" | "trapezoid" | "crescent" | "star" | "line"): Tool => {
  return {
    id: `create-${shapeType}`,
    label: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
    icon:
      shapeType === "rectangle"
        ? "Square"
        : shapeType === "circle"
        ? "Circle"
        : shapeType === "polygon"
        ? "Hexagon"
        : shapeType === "trapezoid"
        ? "Triangle"
        : shapeType === "crescent"
        ? "Moon"
        : shapeType === "star"
        ? "Star"
        : "Minus",
    cursor: "crosshair",
    category: "shapes",

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

        let newNode: any;

        if (shapeType === "rectangle") {
          const localWidth = Math.abs(dx);
          const localHeight = Math.abs(dy);
          const localCenterX = (localStart.x + localPointer.x) / 2;
          const localCenterY = (localStart.y + localPointer.y) / 2;

          newNode = {
            id: generateUniqueId("rectangle"),
            type: "rectangle",
            name: "Rectangle",
            visible: true,
            locked: false,
            transform: {
              x: localCenterX,
              y: localCenterY,
              rotation: -rotation,
              scaleX: 1,
              scaleY: 1,
            },
            width: localWidth,
            height: localHeight,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "transparent",
            },
            export: { artwork: true, cut: false, fold: false },
          };
        } else if (shapeType === "circle") {
          newNode = {
            id: generateUniqueId("circle"),
            type: "circle",
            name: "Circle",
            visible: true,
            locked: false,
            transform: {
              x: localStart.x,
              y: localStart.y,
              rotation: -rotation,
              scaleX: 1,
              scaleY: 1,
            },
            radius: dist,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "transparent",
            },
            export: { artwork: true, cut: false, fold: false },
          };
        } else if (shapeType === "polygon") {
          const sides = context.isShift ? 3 : (useToolStore.getState().toolSettings.polygonSides || 5);
          newNode = {
            id: generateUniqueId("polygon"),
            type: "polygon",
            name: "Polygon",
            visible: true,
            locked: false,
            transform: {
              x: localStart.x,
              y: localStart.y,
              rotation: -rotation,
              scaleX: 1,
              scaleY: 1,
            },
            sides,
            radius: dist,
            cornerRadius: 0,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "transparent",
            },
            export: { artwork: true, cut: false, fold: false },
          };
        } else if (shapeType === "trapezoid") {
          const localWidth = Math.max(10, Math.abs(dx));
          const localHeight = Math.max(10, Math.abs(dy));
          const localCenterX = (localStart.x + localPointer.x) / 2;
          const localCenterY = (localStart.y + localPointer.y) / 2;

          newNode = {
            id: generateUniqueId("trapezoid"),
            type: "trapezoid",
            name: "Trapezoid",
            visible: true,
            locked: false,
            transform: {
              x: localCenterX,
              y: localCenterY,
              rotation: -rotation,
              scaleX: 1,
              scaleY: 1,
            },
            baseWidth: localWidth,
            topWidth: localWidth * 0.7,
            height: localHeight,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "transparent",
            },
            export: { artwork: true, cut: false, fold: false },
          };
        } else if (shapeType === "crescent") {
          newNode = {
            id: generateUniqueId("crescent"),
            type: "crescent",
            name: "Crescent Moon",
            visible: true,
            locked: false,
            transform: {
              x: localStart.x,
              y: localStart.y,
              rotation: -rotation,
              scaleX: 1,
              scaleY: 1,
            },
            radius: dist,
            ratio: 0.4,
            phase: 0.5,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "transparent",
            },
            export: { artwork: true, cut: false, fold: false },
          };
        } else if (shapeType === "star") {
          newNode = {
            id: generateUniqueId("star"),
            type: "star",
            name: "Star",
            visible: true,
            locked: false,
            transform: {
              x: localStart.x,
              y: localStart.y,
              rotation: -rotation,
              scaleX: 1,
              scaleY: 1,
            },
            numPoints: 5,
            innerRadius: dist * 0.4,
            outerRadius: dist,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "transparent",
            },
            export: { artwork: true, cut: false, fold: false },
          };
        } else if (shapeType === "line") {
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const lineLength = Math.max(10, Math.round(dist));
          newNode = {
            id: generateUniqueId("line"),
            type: "line",
            name: "Line",
            visible: true,
            locked: false,
            transform: {
              x: localStart.x,
              y: localStart.y,
              rotation: angle,
              scaleX: 1,
              scaleY: 1,
            },
            length: lineLength,
            thickness: 2,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 2,
            },
            export: { artwork: true, cut: false, fold: false },
          };
        }

        // Apply Radial Warp mode if canvas-wide toggle is active and shape type supports warping.
        // Only rectangle and trapezoid receive the full arc-deformation rendering.
        // All other types already benefit from polar-coordinate handle logic when transformMode is set,
        // but warp-eligible types are the ones that visually deform — they are the target of this feature.
        const WARP_ELIGIBLE = ["rectangle", "trapezoid"];
        if (useToolStore.getState().radialWarpEnabled && newNode && WARP_ELIGIBLE.includes(newNode.type)) {
          newNode.transformMode = "radial";
        }

        if (useToolStore.getState().creationMode === "cutout") {

          const solidType = newNode.type;
          const solidStyle = { stroke: "#3b82f6", strokeWidth: 2, fill: "rgba(59, 130, 246, 0.2)" };
          const shapeTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
          
          const childShape = {
            ...newNode,
            transform: shapeTransform,
            export: { artwork: false, cut: true, fold: false },
          };

          newNode = {
            id: generateUniqueId("window"),
            type: "window",
            name: `${newNode.name || "Shape"} Cutout`,
            visible: true,
            locked: false,
            transform: newNode.transform,
            export: { artwork: false, cut: true, fold: false },
            savedSolidType: solidType,
            savedSolidStyle: solidStyle,
            shape: childShape,
          };
        }

        const sym = useToolStore.getState().symmetryCount || 1;
        if (sym > 1) {
          const step = 360 / sym;
          const origX = newNode.transform.x;
          const origY = newNode.transform.y;
          const origRot = newNode.transform.rotation;
          const groupId = `symgroup-${Math.random().toString(36).substring(2, 9)}`;

          const commands = [];
          for (let i = 0; i < sym; i++) {
            const angleRad = (i * step * Math.PI) / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);

            const rx = origX * cosA - origY * sinA;
            const ry = origX * sinA + origY * cosA;
            const rRot = origRot + i * step;

            const symNode = JSON.parse(JSON.stringify(newNode));
            symNode.id = generateUniqueId(newNode.type);
            if (symNode.type === "window" && symNode.shape) {
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
          context.executeCommand(new BatchCommand(commands, `Symmetrical ${newNode.name || "Shape"} Placement (${sym}x)`));
        } else {
          context.executeCommand(new CreateNodeCommand(activeRing.id, newNode));
        }

        if (!useToolStore.getState().isToolLocked) {
          useToolStore.getState().setActiveTool("select");
        }
      } catch {
        // Singular matrix or bounds exception
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

          if (shapeType === "rectangle") {
            const rx = baseLocalCenterX * cosA - baseLocalCenterY * sinA;
            const ry = baseLocalCenterX * sinA + baseLocalCenterY * cosA;
            previews.push(
              <Group key={i} x={rx} y={ry} rotation={rRot}>
                <Rect
                  x={-Math.abs(dx) / 2}
                  y={-Math.abs(dy) / 2}
                  width={Math.abs(dx)}
                  height={Math.abs(dy)}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              </Group>
            );
          } else if (shapeType === "circle") {
            const rx = localStart.x * cosA - localStart.y * sinA;
            const ry = localStart.x * sinA + localStart.y * cosA;
            previews.push(
              <Circle
                key={i}
                x={rx}
                y={ry}
                radius={dist}
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else if (shapeType === "polygon") {
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
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else if (shapeType === "trapezoid") {
            const rx = baseLocalCenterX * cosA - baseLocalCenterY * sinA;
            const ry = baseLocalCenterX * sinA + baseLocalCenterY * cosA;
            previews.push(
              <RegularPolygon
                key={i}
                x={rx}
                y={ry}
                rotation={rRot}
                sides={4}
                radius={dist}
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else if (shapeType === "crescent") {
            const rx = localStart.x * cosA - localStart.y * sinA;
            const ry = localStart.x * sinA + localStart.y * cosA;
            previews.push(
              <Circle
                key={i}
                x={rx}
                y={ry}
                radius={dist}
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else if (shapeType === "star") {
            const rx = localStart.x * cosA - localStart.y * sinA;
            const ry = localStart.x * sinA + localStart.y * cosA;
            previews.push(
              <RegularPolygon
                key={i}
                x={rx}
                y={ry}
                rotation={rRot}
                sides={5}
                radius={dist}
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else if (shapeType === "line") {
            const rx = localStart.x * cosA - localStart.y * sinA;
            const ry = localStart.x * sinA + localStart.y * cosA;
            const lineAngle = Math.atan2(dy, dx) * (180 / Math.PI) + i * step;
            previews.push(
              <Group key={i} x={rx} y={ry} rotation={lineAngle}>
                <KonvaLine
                  points={[0, 0, dist, 0]}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dash={[4, 4]}
                />
              </Group>
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

export const rectangleTool = createShapeTool("rectangle");
export const circleTool = createShapeTool("circle");
export const polygonTool = createShapeTool("polygon");
export const trapezoidTool = createShapeTool("trapezoid");
export const crescentTool = createShapeTool("crescent");
export const starTool = createShapeTool("star");
export const lineTool = createShapeTool("line");
