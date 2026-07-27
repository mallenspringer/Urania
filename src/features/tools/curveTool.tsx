import { Group, Shape, Arc as KonvaArc } from "react-konva";
import type { Tool, ToolContext } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import { Matrix2D } from "../../shared/utils/matrix";
import { CreateNodeCommand, BatchCommand } from "../project/commands";
import { useToolStore } from "./toolStore";
import { useProjectStore } from "../project/projectStore";

function generateUniqueId(type: string): string {
  return `${type}-${Math.random().toString(36).substr(2, 9)}`;
}

function getActiveRingNode(context: ToolContext) {
  const resolvedNodes = resolveProject(context.project);
  const ring = resolvedNodes.find((n) => n.id === context.activeRingId && n.type === "ring");
  if (ring) return ring;
  return resolvedNodes.find((n) => n.type === "ring");
}

export const curveTool: Tool = {
  id: "create-curve",
  label: "Curve (Bézier)",
  icon: "Spline",
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
    const m = Matrix2D.identity().translate(x, y).rotate(rotation).scale(scaleX, scaleY);

    try {
      const inv = m.invert();
      const localStart = inv.transformPoint(startX, startY);
      const localPointer = inv.transformPoint(currentX, currentY);

      const dx = localPointer.x - localStart.x;
      const dy = localPointer.y - localStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) return;

      const p0 = { x: 0, y: 0 };
      const p1 = { x: dx, y: dy };
      const c1 = { x: dx * 0.25, y: dy * 0.25 - 40 };
      const c2 = { x: dx * 0.75, y: dy * 0.75 + 40 };

      let newNode: any = {
        id: generateUniqueId("curve"),
        type: "curve",
        name: "Curve",
        visible: true,
        locked: false,
        transform: {
          x: localStart.x,
          y: localStart.y,
          rotation: -rotation,
          scaleX: 1,
          scaleY: 1,
        },
        controlPoints: { p0, c1, c2, p1 },
        thickness: 2,
        style: {
          stroke: "#3b82f6",
          strokeWidth: 2,
        },
        export: { artwork: true, cut: false, fold: false },
      };

      if (useToolStore.getState().creationMode === "cutout") {
        const solidType = newNode.type;
        const solidStyle = { stroke: "#3b82f6", strokeWidth: 2, fill: "rgba(59, 130, 246, 0.2)" };
        const childShape = {
          ...newNode,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          export: { artwork: false, cut: true, fold: false },
        };

        newNode = {
          id: generateUniqueId("window"),
          type: "window",
          name: "Curve Cutout",
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
          const angle = (i * step * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rotX = origX * cos - origY * sin;
          const rotY = origX * sin + origY * cos;

          const symNode = JSON.parse(JSON.stringify(newNode));
          symNode.id = generateUniqueId(newNode.type);
          symNode.transform.x = rotX;
          symNode.transform.y = rotY;
          symNode.transform.rotation = origRot + i * step;
          symNode.symmetryGroupId = groupId;
          symNode.symmetryIndex = i;
          symNode.symmetryCount = sym;

          commands.push(new CreateNodeCommand(activeRing.id, symNode));
        }

        useProjectStore.getState().executeCommand(
          new BatchCommand(commands, `Symmetrical Curve Placement (${sym}x)`)
        );
      } else {
        useProjectStore.getState().executeCommand(
          new CreateNodeCommand(activeRing.id, newNode)
        );
      }

      if (!useToolStore.getState().isToolLocked) {
        useToolStore.getState().setActiveTool("select");
      }
    } catch {
      // Ignored
    }
  },

  renderPreview(context) {
    const preview = context.currentPreviewData;
    if (!preview || !preview.isDragging) return null;

    const activeRing = getActiveRingNode(context);
    if (!activeRing) return null;

    const { x, y, rotation, scaleX, scaleY } = activeRing.worldTransform;
    const m = Matrix2D.identity().translate(x, y).rotate(rotation).scale(scaleX, scaleY);

    try {
      const inv = m.invert();
      const localStart = inv.transformPoint(preview.startX, preview.startY);
      const localPointer = inv.transformPoint(preview.currentX, preview.currentY);

      const dx = localPointer.x - localStart.x;
      const dy = localPointer.y - localStart.y;
      const c1 = { x: dx * 0.25, y: dy * 0.25 - 40 };
      const c2 = { x: dx * 0.75, y: dy * 0.75 + 40 };

      const sym = useToolStore.getState().symmetryCount || 1;
      const step = 360 / sym;

      const previews = [];
      for (let i = 0; i < sym; i++) {
        const angleRad = (i * step * Math.PI) / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const rRot = -rotation + i * step;

        const rx = localStart.x * cosA - localStart.y * sinA;
        const ry = localStart.x * sinA + localStart.y * cosA;

        previews.push(
          <Group key={i} x={rx} y={ry} rotation={rRot}>
            <Shape
              sceneFunc={(ctx, shape) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, dx, dy);
                ctx.fillStrokeShape(shape);
              }}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[4, 4]}
            />
          </Group>
        );
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

export const arcTool: Tool = {
  id: "create-arc",
  label: "Circular Arc",
  icon: "Arc",
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
    const m = Matrix2D.identity().translate(x, y).rotate(rotation).scale(scaleX, scaleY);

    try {
      const inv = m.invert();
      const localStart = inv.transformPoint(startX, startY);
      const localPointer = inv.transformPoint(currentX, currentY);

      const dx = localPointer.x - localStart.x;
      const dy = localPointer.y - localStart.y;
      const radius = Math.max(10, Math.round(Math.sqrt(dx * dx + dy * dy)));

      let newNode: any = {
        id: generateUniqueId("arc"),
        type: "arc",
        name: "Circular Arc",
        visible: true,
        locked: false,
        transform: {
          x: localStart.x,
          y: localStart.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
        radius,
        startAngle: 0,
        sweepAngle: 90,
        thickness: 0,
        style: {
          stroke: "#3b82f6",
          strokeWidth: 2,
        },
        export: { artwork: true, cut: false, fold: false },
      };

      if (useToolStore.getState().creationMode === "cutout") {
        newNode.thickness = 15;
        const solidType = newNode.type;
        const solidStyle = { stroke: "#3b82f6", strokeWidth: 2, fill: "rgba(59, 130, 246, 0.2)" };
        const childShape = {
          ...newNode,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          export: { artwork: false, cut: true, fold: false },
        };

        newNode = {
          id: generateUniqueId("window"),
          type: "window",
          name: "Arc Cutout",
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
          const angle = (i * step * Math.PI) / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rotX = origX * cos - origY * sin;
          const rotY = origX * sin + origY * cos;

          const symNode = JSON.parse(JSON.stringify(newNode));
          symNode.id = generateUniqueId(newNode.type);
          symNode.transform.x = rotX;
          symNode.transform.y = rotY;
          symNode.transform.rotation = origRot + i * step;
          symNode.symmetryGroupId = groupId;
          symNode.symmetryIndex = i;
          symNode.symmetryCount = sym;

          commands.push(new CreateNodeCommand(activeRing.id, symNode));
        }

        useProjectStore.getState().executeCommand(
          new BatchCommand(commands, `Symmetrical Arc Placement (${sym}x)`)
        );
      } else {
        useProjectStore.getState().executeCommand(
          new CreateNodeCommand(activeRing.id, newNode)
        );
      }

      if (!useToolStore.getState().isToolLocked) {
        useToolStore.getState().setActiveTool("select");
      }
    } catch {
      // Ignored
    }
  },

  renderPreview(context) {
    const preview = context.currentPreviewData;
    if (!preview || !preview.isDragging) return null;

    const activeRing = getActiveRingNode(context);
    if (!activeRing) return null;

    const { x, y, rotation, scaleX, scaleY } = activeRing.worldTransform;
    const m = Matrix2D.identity().translate(x, y).rotate(rotation).scale(scaleX, scaleY);

    try {
      const inv = m.invert();
      const localStart = inv.transformPoint(preview.startX, preview.startY);
      const localPointer = inv.transformPoint(preview.currentX, preview.currentY);

      const dx = localPointer.x - localStart.x;
      const dy = localPointer.y - localStart.y;
      const radius = Math.max(10, Math.round(Math.sqrt(dx * dx + dy * dy)));

      const sym = useToolStore.getState().symmetryCount || 1;
      const step = 360 / sym;

      const previews = [];
      for (let i = 0; i < sym; i++) {
        const angleRad = (i * step * Math.PI) / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const rRot = -rotation + i * step;

        const rx = localStart.x * cosA - localStart.y * sinA;
        const ry = localStart.x * sinA + localStart.y * cosA;

        previews.push(
          <Group key={i} x={rx} y={ry} rotation={rRot}>
            <KonvaArc
              innerRadius={radius}
              outerRadius={radius}
              angle={90}
              rotation={0}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[4, 4]}
            />
          </Group>
        );
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
