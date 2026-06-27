import type { Project, BaseNode, RingNode, WindowNode } from "../../../shared/types/project";
import type { ValidationIssue, Validator } from "../validationTypes";

function getWindowBoundingRadius(shape: any): number {
  if (!shape) return 0;
  if (shape.type === "circle") {
    return shape.radius || 0;
  }
  if (shape.type === "rectangle") {
    const w = shape.width || 0;
    const h = shape.height || 0;
    return Math.hypot(w / 2, h / 2);
  }
  if (shape.type === "polygon") {
    return shape.radius || 0;
  }
  return 0;
}

function checkRingsFabrication(node: BaseNode, issues: ValidationIssue[]) {
  if (node.type === "ring") {
    const ring = node as RingNode;
    const windows: WindowNode[] = [];

    function collectWindowsUnderRing(curr: BaseNode) {
      if (curr.type === "window") {
        windows.push(curr as WindowNode);
      }
      if (curr.children) {
        for (const child of curr.children) {
          if (child.type !== "ring") {
            collectWindowsUnderRing(child);
          }
        }
      }
    }

    collectWindowsUnderRing(ring);

    // 1. Check window-to-boundary bridges
    for (const win of windows) {
      const wx = win.transform.x;
      const wy = win.transform.y;
      const d = Math.hypot(wx, wy);
      const r = getWindowBoundingRadius(win.shape);

      if (ring.innerRadius > 0) {
        const bridgeInner = (d - r) - ring.innerRadius;
        if (bridgeInner < 10) {
          issues.push({
            id: `thin-bridge-inner-${win.id}`,
            severity: "warning",
            code: "FABRICATION_THIN_BRIDGE",
            message: `Window '${win.name || win.id}' is too close to the inner edge of Ring '${ring.name || ring.id}' (bridge: ${Math.round(bridgeInner)}px).`,
            entityId: win.id,
            entityType: "window",
          });
        }
      }

      const bridgeOuter = ring.outerRadius - (d + r);
      if (bridgeOuter < 10) {
        issues.push({
          id: `thin-bridge-outer-${win.id}`,
          severity: "warning",
          code: "FABRICATION_THIN_BRIDGE",
          message: `Window '${win.name || win.id}' is too close to the outer edge of Ring '${ring.name || ring.id}' (bridge: ${Math.round(bridgeOuter)}px).`,
          entityId: win.id,
          entityType: "window",
        });
      }

      // Check small cutout size
      let isSmall = false;
      let shapeDesc = "";
      if (win.shape) {
        const shape = win.shape;
        if (shape.type === "circle" && shape.radius * 2 < 10) {
          isSmall = true;
          shapeDesc = `diameter ${Math.round(shape.radius * 2)}px`;
        } else if (shape.type === "rectangle" && (shape.width < 10 || shape.height < 10)) {
          isSmall = true;
          shapeDesc = `${Math.round(shape.width)}x${Math.round(shape.height)}px`;
        } else if (shape.type === "polygon" && shape.radius * 2 < 10) {
          isSmall = true;
          shapeDesc = `diameter ${Math.round(shape.radius * 2)}px`;
        }
      }
      if (isSmall) {
        issues.push({
          id: `small-cutout-${win.id}`,
          severity: "warning",
          code: "FABRICATION_SMALL_CUTOUT",
          message: `Window '${win.name || win.id}' cutout is extremely small (${shapeDesc}), which may be difficult to cut physically.`,
          entityId: win.id,
          entityType: "window",
        });
      }
    }

    // 2. Check window-to-window bridges
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const winA = windows[i];
        const winB = windows[j];

        const dist = Math.hypot(winA.transform.x - winB.transform.x, winA.transform.y - winB.transform.y);
        const radA = getWindowBoundingRadius(winA.shape);
        const radB = getWindowBoundingRadius(winB.shape);
        const bridge = dist - (radA + radB);

        if (bridge < 10) {
          issues.push({
            id: `thin-bridge-windows-${winA.id}-${winB.id}`,
            severity: "warning",
            code: "FABRICATION_THIN_BRIDGE",
            message: `Window '${winA.name || winA.id}' and Window '${winB.name || winB.id}' are placed too close, creating a thin bridge (${Math.round(bridge)}px) that is fragile for physical cutting.`,
            entityId: winA.id,
            entityType: "window",
          });
        }
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      checkRingsFabrication(child, issues);
    }
  }
}

export const fabricationValidator: Validator = {
  id: "fabrication-validator",
  name: "Fabrication Validator",
  validate(project: Project): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    checkRingsFabrication(project.mechanism, issues);
    return issues;
  },
};
