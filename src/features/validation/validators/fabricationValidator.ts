import type { Project, BaseNode, RingNode, WindowNode, DiscTabNode } from "../../../shared/types/project";
import type { ValidationIssue, Validator } from "../validationTypes";

function getWindowBoundingRadius(win: WindowNode): number {
  if (!win.shape) return 0;
  const s = win.shape as Record<string, any>;
  const wx = win.transform.x;
  const wy = win.transform.y;
  const angle = Math.atan2(wy, wx);
  const cosA = Math.abs(Math.cos(angle));
  const sinA = Math.abs(Math.sin(angle));

  if (s.type === "circle") {
    return s.radius || 0;
  }
  if (s.type === "rectangle") {
    const hw = (s.width || 0) / 2;
    const hh = (s.height || 0) / 2;
    return hw * cosA + hh * sinA;
  }
  if (s.type === "trapezoid") {
    const hw = Math.max(s.baseWidth || 0, s.topWidth || 0) / 2;
    const hh = (s.height || 0) / 2;
    return hw * cosA + hh * sinA;
  }
  if (s.type === "polygon" || s.type === "crescent" || s.type === "arcText") {
    return s.radius || 0;
  }
  if (s.type === "star") {
    return s.outerRadius || 0;
  }
  if (s.type === "line") {
    const halfLen = (s.length || 0) / 2;
    return halfLen * cosA;
  }
  if (s.type === "text") {
    return (s.fontSize || 12) / 2;
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

    // Check disc tabs attached to this ring
    const discTabs: DiscTabNode[] = [];
    if (ring.children) {
      for (const child of ring.children) {
        if (child.type === "discTab") {
          discTabs.push(child as DiscTabNode);
        }
      }
    }

    for (const dt of discTabs) {
      if (dt.height < 4) {
        issues.push({
          id: `disc-tab-small-${dt.id}`,
          severity: "warning",
          code: "FABRICATION_DISC_TAB_SMALL",
          message: `Disc tab '${dt.name || dt.id}' height (${dt.height}px) is very small and may be difficult to cut or grip.`,
          entityId: dt.id,
          entityType: "discTab",
        });
      }
    }

    for (let i = 0; i < discTabs.length; i++) {
      for (let j = i + 1; j < discTabs.length; j++) {
        const t1 = discTabs[i];
        const t2 = discTabs[j];
        const halfSpan1 = (Math.asin(Math.min(0.99, (t1.width / 2) / ring.outerRadius)) * 180) / Math.PI;
        const halfSpan2 = (Math.asin(Math.min(0.99, (t2.width / 2) / ring.outerRadius)) * 180) / Math.PI;

        let diff = Math.abs((t1.angle % 360) - (t2.angle % 360));
        if (diff > 180) diff = 360 - diff;

        if (diff < (halfSpan1 + halfSpan2)) {
          issues.push({
            id: `disc-tab-overlap-${t1.id}-${t2.id}`,
            severity: "warning",
            code: "FABRICATION_DISC_TAB_OVERLAP",
            message: `Disc tabs '${t1.name || t1.id}' and '${t2.name || t2.id}' on Ring '${ring.name || ring.id}' overlap angularly.`,
            entityId: t1.id,
            entityType: "discTab",
          });
        }
      }
    }

    // 1. Check window-to-boundary bridges (threshold: 4px)
    for (const win of windows) {
      const wx = win.transform.x;
      const wy = win.transform.y;
      const d = Math.hypot(wx, wy);
      const r = getWindowBoundingRadius(win);

      if (ring.innerRadius > 0) {
        const bridgeInner = (d - r) - ring.innerRadius;
        if (bridgeInner < 4) {
          issues.push({
            id: `thin-bridge-inner-${win.id}`,
            severity: "warning",
            code: "FABRICATION_THIN_BRIDGE",
            message: `Window '${win.name || win.id}' is too close to the inner edge of Ring '${ring.name || ring.id}' (bridge: ${Math.max(0, Math.round(bridgeInner))}px).`,
            entityId: win.id,
            entityType: "window",
          });
        }
      }

      const bridgeOuter = ring.outerRadius - (d + r);
      if (bridgeOuter < 4) {
        issues.push({
          id: `thin-bridge-outer-${win.id}`,
          severity: "warning",
          code: "FABRICATION_THIN_BRIDGE",
          message: `Window '${win.name || win.id}' is too close to the outer edge of Ring '${ring.name || ring.id}' (bridge: ${Math.max(0, Math.round(bridgeOuter))}px).`,
          entityId: win.id,
          entityType: "window",
        });
      }

      // Check small cutout size (threshold: 3px)
      let isSmall = false;
      let shapeDesc = "";
      if (win.shape) {
        const shape = win.shape as any;
        if (shape.type === "circle" && shape.radius * 2 < 3) {
          isSmall = true;
          shapeDesc = `diameter ${(shape.radius * 2).toFixed(1)}px`;
        } else if (shape.type === "rectangle" && (shape.width < 3 || shape.height < 3)) {
          isSmall = true;
          shapeDesc = `${Math.round(shape.width)}x${Math.round(shape.height)}px`;
        } else if (shape.type === "polygon" && shape.radius * 2 < 3) {
          isSmall = true;
          shapeDesc = `diameter ${(shape.radius * 2).toFixed(1)}px`;
        } else if (shape.type === "star" && shape.outerRadius * 2 < 3) {
          isSmall = true;
          shapeDesc = `diameter ${(shape.outerRadius * 2).toFixed(1)}px`;
        } else if (shape.type === "trapezoid" && (shape.baseWidth < 3 || shape.topWidth < 3 || shape.height < 3)) {
          isSmall = true;
          shapeDesc = `${Math.round(shape.baseWidth)}x${Math.round(shape.height)}px`;
        } else if (shape.type === "crescent" && shape.radius * 2 < 3) {
          isSmall = true;
          shapeDesc = `radius ${Math.round(shape.radius)}px`;
        } else if (shape.type === "line" && shape.length < 3) {
          isSmall = true;
          shapeDesc = `length ${Math.round(shape.length)}px`;
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

    // 2. Check window-to-window bridges (threshold: 4px)
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const winA = windows[i];
        const winB = windows[j];

        const dist = Math.hypot(winA.transform.x - winB.transform.x, winA.transform.y - winB.transform.y);
        const radA = getWindowBoundingRadius(winA);
        const radB = getWindowBoundingRadius(winB);
        const bridge = dist - (radA + radB);

        if (bridge < 4) {
          issues.push({
            id: `thin-bridge-windows-${winA.id}-${winB.id}`,
            severity: "warning",
            code: "FABRICATION_THIN_BRIDGE",
            message: `Window '${winA.name || winA.id}' and Window '${winB.name || winB.id}' are placed too close, creating a thin bridge (${Math.max(0, Math.round(bridge))}px) that is fragile for physical cutting.`,
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
