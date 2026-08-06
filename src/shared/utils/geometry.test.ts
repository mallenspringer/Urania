import { describe, it, expect } from "vitest";
import { findNodeInTree, findParentNode, isDescendantOf, isPointInsideNode, getNodeKeyPoints } from "./geometry";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";

describe("geometry utilities", () => {
  const sampleProject: any = {
    id: "proj-1",
    schemaVersion: 1,
    name: "Test Project",
    created: "2026-01-01",
    modified: "2026-01-01",
    mechanism: {
      id: "root-1",
      type: "volvelle",
      name: "Root",
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      visible: true,
      locked: false,
      children: [
        {
          id: "ring-1",
          type: "ring",
          name: "Outer Ring",
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          visible: true,
          locked: false,
          outerRadius: 100,
          innerRadius: 50,
          export: { artwork: true, cut: true, fold: false },
          children: [
            {
              id: "rect-1",
              type: "rectangle",
              name: "Rect 1",
              transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
              visible: true,
              locked: false,
              width: 30,
              height: 20,
              export: { artwork: true, cut: false, fold: false },
            },
          ],
        },
      ],
    },
  };

  it("finds a node in the tree by ID", () => {
    const node = findNodeInTree(sampleProject.mechanism, "rect-1");
    expect(node).toBeDefined();
    expect(node?.name).toBe("Rect 1");
  });

  it("returns null if node ID is not found", () => {
    const node = findNodeInTree(sampleProject.mechanism, "non-existent");
    expect(node).toBeNull();
  });

  it("finds parent node of a child in tree", () => {
    const parent = findParentNode(sampleProject.mechanism, "rect-1");
    expect(parent).toBeDefined();
    expect(parent?.id).toBe("ring-1");
  });

  it("checks descendant relationship correctly", () => {
    const ringNode = sampleProject.mechanism.children![0];
    expect(isDescendantOf(ringNode, "rect-1")).toBe(true);
    expect(isDescendantOf(ringNode, "ring-1")).toBe(false);
  });

  it("detects point inside ring node", () => {
    const resolvedRingNode: ResolvedNode = {
      id: "ring-1",
      type: "ring",
      name: "Outer Ring",
      worldTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: { x: -100, y: -100, width: 200, height: 200 },
      renderData: { outerRadius: 100, innerRadius: 50 },
      visible: true,
      maskIds: [],
    };

    // Point at r = 75 is inside (50 < 75 < 100)
    expect(isPointInsideNode({ x: 75, y: 0 }, resolvedRingNode)).toBe(true);
    // Point at r = 20 is inside hole (r < 50)
    expect(isPointInsideNode({ x: 20, y: 0 }, resolvedRingNode)).toBe(false);
    // Point at r = 120 is outside outer radius (r > 100)
    expect(isPointInsideNode({ x: 120, y: 0 }, resolvedRingNode)).toBe(false);
  });

  it("extracts key points for ring and sector nodes", () => {
    const resolvedRingNode: ResolvedNode = {
      id: "ring-1",
      type: "ring",
      name: "Outer Ring",
      worldTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: { x: -100, y: -100, width: 200, height: 200 },
      renderData: { outerRadius: 100, innerRadius: 50 },
      visible: true,
      maskIds: [],
    };

    const keyPoints = getNodeKeyPoints(resolvedRingNode);
    expect(keyPoints.length).toBeGreaterThan(0);
    expect(keyPoints[0]).toEqual({ x: 0, y: 0 });
  });
});
