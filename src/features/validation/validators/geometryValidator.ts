import type { Project, BaseNode, RingNode } from "../../../shared/types/project";
import type { ValidationIssue, Validator } from "../validationTypes";

function collectRings(node: BaseNode, rings: RingNode[]) {
  if (node.type === "ring") {
    rings.push(node as RingNode);
  }
  if (node.children) {
    for (const child of node.children) {
      collectRings(child, rings);
    }
  }
}

function checkGeometries(node: BaseNode, issues: ValidationIssue[]) {
  if (node.type === "ring") {
    const ring = node as RingNode;
    if (ring.innerRadius < 0) {
      issues.push({
        id: `invalid-inner-radius-${ring.id}`,
        severity: "error",
        code: "INVALID_INNER_RADIUS",
        message: `Ring '${ring.name || ring.id}' has a negative inner radius (${ring.innerRadius}).`,
        entityId: ring.id,
        entityType: "ring",
      });
    }
    if (ring.outerRadius < 0) {
      issues.push({
        id: `invalid-outer-radius-${ring.id}`,
        severity: "error",
        code: "INVALID_OUTER_RADIUS",
        message: `Ring '${ring.name || ring.id}' has a negative outer radius (${ring.outerRadius}).`,
        entityId: ring.id,
        entityType: "ring",
      });
    }
    if (ring.outerRadius <= ring.innerRadius) {
      issues.push({
        id: `invalid-ring-band-${ring.id}`,
        severity: "error",
        code: "INVALID_RING_BAND",
        message: `Ring '${ring.name || ring.id}' has outer radius (${ring.outerRadius}) smaller than or equal to inner radius (${ring.innerRadius}).`,
        entityId: ring.id,
        entityType: "ring",
      });
    }
  } else if (node.type === "circle") {
    const circle = node as any;
    if (circle.radius === undefined || circle.radius <= 0) {
      issues.push({
        id: `invalid-circle-radius-${node.id}`,
        severity: "error",
        code: "INVALID_SHAPE_BOUNDS",
        message: `Circle '${node.name || "Unnamed"}' has an invalid radius (${circle.radius}).`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  } else if (node.type === "rectangle") {
    const rect = node as any;
    if (rect.width === undefined || rect.width <= 0 || rect.height === undefined || rect.height <= 0) {
      issues.push({
        id: `invalid-rect-bounds-${node.id}`,
        severity: "error",
        code: "INVALID_SHAPE_BOUNDS",
        message: `Rectangle '${node.name || "Unnamed"}' has invalid dimensions (${rect.width}x${rect.height}).`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  } else if (node.type === "polygon") {
    const poly = node as any;
    if (poly.radius === undefined || poly.radius <= 0 || poly.sides === undefined || poly.sides < 3) {
      issues.push({
        id: `invalid-poly-bounds-${node.id}`,
        severity: "error",
        code: "INVALID_SHAPE_BOUNDS",
        message: `Polygon '${node.name || "Unnamed"}' has invalid sides (${poly.sides}) or radius (${poly.radius}).`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  } else if (node.type === "line") {
    const line = node as any;
    if (line.length === undefined || line.length <= 0) {
      issues.push({
        id: `invalid-line-length-${node.id}`,
        severity: "error",
        code: "INVALID_SHAPE_BOUNDS",
        message: `Line '${node.name || "Unnamed"}' has invalid length (${line.length}).`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  } else if (node.type === "arcText") {
    const arcText = node as any;
    if (arcText.radius === undefined || arcText.radius <= 0 || arcText.sweepAngle === undefined || arcText.sweepAngle <= 0) {
      issues.push({
        id: `invalid-arctext-bounds-${node.id}`,
        severity: "error",
        code: "INVALID_SHAPE_BOUNDS",
        message: `Arc Text '${node.name || "Unnamed"}' has invalid radius (${arcText.radius}) or sweep angle (${arcText.sweepAngle}).`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  } else if (node.type === "text" || node.type === "sectorLabel") {
    const textNode = node as any;
    if (textNode.fontSize !== undefined && textNode.fontSize <= 0) {
      issues.push({
        id: `invalid-text-size-${node.id}`,
        severity: "error",
        code: "INVALID_SHAPE_BOUNDS",
        message: `Text '${node.name || "Unnamed"}' has invalid font size (${textNode.fontSize}).`,
        entityId: node.id,
        entityType: node.type,
      });
    }
  } else if (node.type === "window") {
    const windowNode = node as any;
    if (windowNode.shape) {
      const shape = windowNode.shape;
      if (shape.type === "circle" && (shape.radius === undefined || shape.radius <= 0)) {
        issues.push({
          id: `invalid-window-shape-${node.id}`,
          severity: "error",
          code: "INVALID_SHAPE_BOUNDS",
          message: `Window '${node.name || "Unnamed"}' has a cutout circle with an invalid radius.`,
          entityId: node.id,
          entityType: node.type,
        });
      } else if (shape.type === "rectangle" && (shape.width === undefined || shape.width <= 0 || shape.height === undefined || shape.height <= 0)) {
        issues.push({
          id: `invalid-window-shape-${node.id}`,
          severity: "error",
          code: "INVALID_SHAPE_BOUNDS",
          message: `Window '${node.name || "Unnamed"}' has a cutout rectangle with an invalid width or height.`,
          entityId: node.id,
          entityType: node.type,
        });
      } else if (shape.type === "polygon" && (shape.radius === undefined || shape.radius <= 0 || shape.sides === undefined || shape.sides < 3)) {
        issues.push({
          id: `invalid-window-shape-${node.id}`,
          severity: "error",
          code: "INVALID_SHAPE_BOUNDS",
          message: `Window '${node.name || "Unnamed"}' has a cutout polygon with invalid sides or radius.`,
          entityId: node.id,
          entityType: node.type,
        });
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      checkGeometries(child, issues);
    }
  }
}

export const geometryValidator: Validator = {
  id: "geometry-validator",
  name: "Geometry Validator",
  validate(project: Project): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const rings: RingNode[] = [];

    collectRings(project.mechanism, rings);
    checkGeometries(project.mechanism, issues);

    // Check concentric ring overlaps
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const ringA = rings[i];
        const ringB = rings[j];
        const maxInner = Math.max(ringA.innerRadius, ringB.innerRadius);
        const minOuter = Math.min(ringA.outerRadius, ringB.outerRadius);
        if (maxInner < minOuter) {
          issues.push({
            id: `ring-overlap-${ringA.id}-${ringB.id}`,
            severity: "warning",
            code: "RING_OVERLAP",
            message: `Ring '${ringA.name || ringA.id}' and Ring '${ringB.name || ringB.id}' have overlapping radial bands.`,
            entityId: ringA.id,
            entityType: "ring",
          });
        }
      }
    }

    return issues;
  },
};
