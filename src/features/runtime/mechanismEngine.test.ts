import { describe, it, expect } from "vitest";
import { Matrix2D } from "../../shared/utils/matrix";
import { resolveProject } from "./mechanismEngine";
import type {
  Project,
  RingNode,
  RectangleNode,
  WindowNode,
  CircleNode,
  RadialPatternNode,
} from "../../shared/types/project";

describe("Matrix2D Utilities", () => {
  it("should compositions translations, rotations, and scales correctly", () => {
    const mat = Matrix2D.identity()
      .translate(100, 50)
      .rotate(90)
      .scale(2, 3);

    // Transform point (10, 0)
    // Local translate (10,0) -> rotate 90 degrees -> scale (2,3)
    // Relative to parent translated at (100, 50)
    const pt = mat.transformPoint(10, 0);
    // (10, 0) scaled by 2 -> (20, 0)
    // Rotated 90 degrees -> (0, 20)
    // Translated by (100, 50) -> (100, 70)
    expect(pt.x).toBeCloseTo(100, 5);
    expect(pt.y).toBeCloseTo(70, 5);
  });

  it("should decompose matrices consistently", () => {
    const origTransform = { x: 50, y: -25, rotation: 45, scaleX: 1.5, scaleY: 0.5 };
    const mat = Matrix2D.identity()
      .translate(origTransform.x, origTransform.y)
      .rotate(origTransform.rotation)
      .scale(origTransform.scaleX, origTransform.scaleY);

    const decomp = mat.decompose();
    expect(decomp.x).toBeCloseTo(origTransform.x, 5);
    expect(decomp.y).toBeCloseTo(origTransform.y, 5);
    expect(decomp.rotation).toBeCloseTo(origTransform.rotation, 5);
    expect(decomp.scaleX).toBeCloseTo(origTransform.scaleX, 5);
    expect(decomp.scaleY).toBeCloseTo(origTransform.scaleY, 5);
  });
});

describe("Mechanism Engine Resolvers", () => {
  const createMockProject = (rings: RingNode[]): Project => ({
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "Mock Project",
      author: "",
      description: "",
      createdAt: "",
      updatedAt: "",
    },
    settings: {
      units: "pixels",
      canvasSize: { width: 500, height: 500 },
    },
    assets: [],
    mechanism: {
      id: "root",
      type: "volvelle",
      name: "Mechanism Root",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      children: rings,
    },
  });

  it("should propagate ring rotation down to absolute child coordinates", () => {
    const rect: RectangleNode = {
      id: "rect-1",
      type: "rectangle",
      name: "Rect 1",
      visible: true,
      locked: false,
      transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
      width: 20,
      height: 10,
    };

    // Ring 1 rotated by 90 degrees clockwise
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Ring 1",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 50,
      outerRadius: 150,
      rotation: 90,
      children: [rect],
    };

    const project = createMockProject([ring1]);
    const resolved = resolveProject(project);

    // Locate the resolved element Rect 1
    const resolvedRect = resolved.find((n) => n.id === "rect-1");
    expect(resolvedRect).toBeDefined();

    // Since the Ring is rotated 90 degrees, the element at (100,0) world coordinates
    // should rotate to (0, 100) (South)
    expect(resolvedRect!.worldTransform.x).toBeCloseTo(0, 5);
    expect(resolvedRect!.worldTransform.y).toBeCloseTo(100, 5);
    expect(resolvedRect!.worldTransform.rotation).toBeCloseTo(90, 5);
  });

  it("should compile window reveals in correct top-to-bottom stack order", () => {
    const rect: RectangleNode = {
      id: "rect-1",
      type: "rectangle",
      visible: true,
      locked: false,
      transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
      width: 20,
      height: 10,
    };

    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      innerRadius: 50,
      outerRadius: 150,
      rotation: 0,
      children: [rect],
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const windowShape: CircleNode = {
      id: "win-shape",
      type: "circle",
      radius: 30,
      style: {},
      export: { artwork: false, cut: true, fold: false },
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const windowNode: WindowNode = {
      id: "win-1",
      type: "window",
      shape: windowShape,
      style: {},
      export: { artwork: false, cut: true, fold: false },
      visible: true,
      locked: false,
      transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const ring2: RingNode = {
      id: "ring-2",
      type: "ring",
      innerRadius: 80,
      outerRadius: 180,
      rotation: 0,
      children: [windowNode],
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    // Project has ring1 (bottom) and ring2 (top)
    const project = createMockProject([ring1, ring2]);
    const resolved = resolveProject(project);

    const resolvedRect = resolved.find((n) => n.id === "rect-1");
    const resolvedWindow = resolved.find((n) => n.id === "win-1");

    expect(resolvedRect).toBeDefined();
    expect(resolvedWindow).toBeDefined();

    // Bottom Ring elements should be masked by Top Ring window masks
    expect(resolvedRect!.maskIds).toContain("win-1");

    // Top Ring elements should NOT be masked by Bottom Ring masks
    expect(resolvedWindow!.maskIds).toHaveLength(0);
  });

  it("should expand RadialPattern definitions into individual temporary instances", () => {
    const circle: CircleNode = {
      id: "child-circle",
      type: "circle",
      radius: 10,
      style: {},
      export: { artwork: true, cut: false, fold: false },
      visible: true,
      locked: false,
      transform: { x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const pattern: RadialPatternNode = {
      id: "pattern-1",
      type: "radialPattern",
      copies: 4,
      spacingDegrees: 90,
      rotateCopies: true,
      children: [circle],
      style: {},
      export: { artwork: true, cut: false, fold: false },
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      innerRadius: 50,
      outerRadius: 150,
      rotation: 0,
      children: [pattern],
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const project = createMockProject([ring1]);
    const resolved = resolveProject(project);

    // Locate resolved items matching the pattern child circle ID
    const circleInstances = resolved.filter((n) => n.id === "child-circle");
    // Should expand to 4 copies
    expect(circleInstances).toHaveLength(4);

    // Verify coordinates rotate by 90 degrees for each copy, sanitizing -0 values
    const coordList = circleInstances.map((c) => {
      const rx = Math.round(c.worldTransform.x);
      const ry = Math.round(c.worldTransform.y);
      return {
        x: rx === 0 ? 0 : rx,
        y: ry === 0 ? 0 : ry,
      };
    });

    expect(coordList).toContainEqual({ x: 100, y: 0 }); // 0 deg
    expect(coordList).toContainEqual({ x: 0, y: 100 }); // 90 deg
    expect(coordList).toContainEqual({ x: -100, y: 0 }); // 180 deg
    expect(coordList).toContainEqual({ x: 0, y: -100 }); // 270 deg
  });

  it("should propagate parent invisible status to children", () => {
    const rect: RectangleNode = {
      id: "rect-1",
      type: "rectangle",
      visible: true,
      locked: false,
      transform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
      width: 10,
      height: 10,
    };

    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      innerRadius: 40,
      outerRadius: 100,
      rotation: 0,
      children: [rect],
      visible: false, // Ring is hidden
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    const project = createMockProject([ring1]);
    const resolved = resolveProject(project);

    const resolvedRect = resolved.find((n) => n.id === "rect-1");
    expect(resolvedRect!.visible).toBe(false);
  });
});
