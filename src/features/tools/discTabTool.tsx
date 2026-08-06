
import { Group, Shape as KonvaShape } from "react-konva";
import type { Tool, ToolContext } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import { CreateNodeCommand, BatchCommand } from "../project/commands";
import { useToolStore } from "./toolStore";
import type { DiscTabNode } from "../../shared/types/project";
import { getRingRadiusAtAngle, getRingSurfaceNormalAngle } from "../../shared/utils/geometry";

// --- Defaults ---
const DEFAULT_WIDTH = 30;
const DEFAULT_HEIGHT = 18;
const DEFAULT_CORNER_RADIUS = 4;
const DEFAULT_TAB_SHAPE: DiscTabNode["tabShape"] = "semicircular";
const SHIFT_SNAP_DEG = 45;

function generateUniqueId(type: string): string {
  return `${type}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Returns the active ring resolved node, or the first ring found. */
function getActiveRingNode(context: ToolContext) {
  const resolvedNodes = resolveProject(context.project);
  const ring = resolvedNodes.find((n) => n.id === context.activeRingId && n.type === "ring");
  if (ring) return ring;
  return resolvedNodes.find((n) => n.type === "ring");
}

/** Snaps angle to nearest multiple of SHIFT_SNAP_DEG. */
function snapAngle(angleDeg: number): number {
  return Math.round(angleDeg / SHIFT_SNAP_DEG) * SHIFT_SNAP_DEG;
}

/**
 * Draws the disc tab shape in Konva canvas local space.
 * Tab origin is at (0,0) at the ring surface, protrudes to y = +height.
 */
function drawDiscTabPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cornerRadius: number,
  tabShape: DiscTabNode["tabShape"]
) {
  const hw = width / 2;
  const cr = Math.min(cornerRadius, hw, height / 2);
  ctx.beginPath();
  if (tabShape === "rectangular") {
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-hw, Math.max(0, height - cr));
    ctx.arcTo(-hw, height, -hw + cr, height, cr);
    ctx.lineTo(hw - cr, height);
    ctx.arcTo(hw, height, hw, Math.max(0, height - cr), cr);
    ctx.lineTo(hw, 0);
    ctx.closePath();
  } else if (tabShape === "semicircular") {
    const domeR = Math.min(hw, height);
    const rectH = Math.max(0, height - domeR);
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-hw, rectH);
    ctx.arc(0, rectH, domeR, Math.PI, 0, true);
    ctx.lineTo(hw, 0);
    ctx.closePath();
  } else {
    // trapezoidal — narrower at top
    const topHw = hw * 0.6;
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-topHw, height);
    ctx.lineTo(topHw, height);
    ctx.lineTo(hw, 0);
    ctx.closePath();
  }
}

// ---------------------------------------------------------------------------

export const discTabTool: Tool = {
  id: "create-discTab",
  label: "Disc Tab",
  icon: "Bookmark",
  cursor: "crosshair",
  category: "shapes",

  onMouseDown(e, context) {
    if (e.evt.button !== 0) return;
    const pointer = context.pointerPos;
    if (!pointer) return;
    const ring = getActiveRingNode(context);
    if (!ring) return;

    let angleDeg = (Math.atan2(pointer.y, pointer.x) * 180) / Math.PI;
    if (context.isShift) angleDeg = snapAngle(angleDeg);

    context.updatePreview({
      isDragging: true,
      angleDeg,
      ringId: ring.id,
      outerRadius: ring.renderData.outerRadius as number,
      innerRadius: ring.renderData.innerRadius as number,
      height: DEFAULT_HEIGHT,
    });
  },

  onMouseMove(_e, context) {
    const preview = context.currentPreviewData;
    if (!preview?.isDragging) return;
    const pointer = context.pointerPos;
    if (!pointer) return;

    const ring = getActiveRingNode(context);
    if (!ring) return;

    let angleDeg = (Math.atan2(pointer.y, pointer.x) * 180) / Math.PI;
    if (context.isShift) angleDeg = snapAngle(angleDeg);

    const r = Math.hypot(pointer.x, pointer.y);
    const outerR = ring.renderData.outerRadius as number;
    const rawHeight = Math.abs(r - outerR);
    const height = Math.max(6, Math.min(rawHeight, outerR * 0.4));

    context.updatePreview({
      ...preview,
      angleDeg,
      ringId: ring.id,
      outerRadius: outerR,
      innerRadius: ring.renderData.innerRadius as number,
      height,
    });
  },

  onMouseUp(_e, context) {
    const preview = context.currentPreviewData;
    if (!preview?.isDragging) return;
    context.updatePreview(null);

    const ring = getActiveRingNode(context);
    if (!ring) return;

    const { angleDeg, height, ringId } = preview as {
      angleDeg: number;
      height: number;
      ringId: string;
    };

    const sym = useToolStore.getState().symmetryCount || 1;
    const step = 360 / sym;

    const makeTab = (angle: number, symIdx: number, groupId?: string): DiscTabNode => ({
      id: generateUniqueId("discTab"),
      type: "discTab",
      name: "Disc Tab",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: { fill: "#6366f1", stroke: "#3730a3", strokeWidth: 1.5 },
      export: { artwork: true, cut: true, fold: false },
      angle: ((angle % 360) + 360) % 360,
      edge: "outer",
      width: DEFAULT_WIDTH,
      height: Math.max(6, Math.round(height)),
      cornerRadius: DEFAULT_CORNER_RADIUS,
      tabShape: DEFAULT_TAB_SHAPE,
      ...(groupId
        ? { symmetryGroupId: groupId, symmetryIndex: symIdx, symmetryCount: sym }
        : {}),
    });

    const groupId = sym > 1 ? `symgroup-${Math.random().toString(36).substring(2, 9)}` : undefined;
    const commands = Array.from({ length: sym }, (_, i) =>
      new CreateNodeCommand(ringId, makeTab(angleDeg + i * step, i, groupId))
    );

    if (commands.length === 1) {
      context.executeCommand(commands[0]);
    } else {
      context.executeCommand(new BatchCommand(commands, `Disc Tab Placement (${sym}x)`));
    }

    if (!useToolStore.getState().isToolLocked) {
      useToolStore.getState().setActiveTool("select");
    }
  },

  renderPreview(context) {
    const preview = context.currentPreviewData;
    if (!preview?.isDragging) return null;

    const { angleDeg, outerRadius, height } = preview as {
      angleDeg: number;
      outerRadius: number;
      height: number;
    };
    if (!outerRadius) return null;

    const ring = getActiveRingNode(context);
    const ringData = (ring ? ring.renderData : { outerRadius }) as any;

    const sym = useToolStore.getState().symmetryCount || 1;
    const step = 360 / sym;
    const w = DEFAULT_WIDTH;
    const h = height || DEFAULT_HEIGHT;

    return (
      <>
        {Array.from({ length: sym }, (_, i) => {
          const ang = angleDeg + i * step;
          const rEdge = getRingRadiusAtAngle(ringData, ang);
          const normAngle = getRingSurfaceNormalAngle(ringData, ang);

          const rad = (ang * Math.PI) / 180;
          const px = rEdge * Math.cos(rad);
          const py = rEdge * Math.sin(rad);
          return (
            <Group key={i} x={px} y={py} rotation={normAngle - 90}>
              <KonvaShape
                sceneFunc={(ctx, shape) => {
                  drawDiscTabPath(ctx as any, w, h, DEFAULT_CORNER_RADIUS, DEFAULT_TAB_SHAPE);
                  (ctx as any).fillStrokeShape(shape);
                }}
                fill="rgba(99, 102, 241, 0.45)"
                stroke="#6366f1"
                strokeWidth={1.5}
                dash={[4, 4]}
                listening={false}
              />
            </Group>
          );
        })}
      </>
    );
  },
};
