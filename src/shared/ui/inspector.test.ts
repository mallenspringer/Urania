import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { CreateRingCommand, CreateNodeCommand, UpdateMultipleNodesCommand } from "../../features/project/commands";
import type { RingNode, RectangleNode } from "../types/project";

describe("Inspector Multi-Selection & Project Settings Logic", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
    useSelectionStore.getState().clearSelection();
  });

  it("should support updating common style properties across multiple selected nodes atomically", () => {
    const ring: RingNode = {
      id: "ring-multi-1",
      type: "ring",
      name: "Main Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 10,
      outerRadius: 100,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring));

    const rectA: RectangleNode = {
      id: "rect-a",
      type: "rectangle",
      name: "Rect A",
      visible: true,
      locked: false,
      transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 30,
      height: 20,
      style: { fill: "#ff0000", stroke: "#000000", strokeWidth: 1, opacity: 1 },
      export: { artwork: true, cut: false, fold: false },
    };

    const rectB: RectangleNode = {
      id: "rect-b",
      type: "rectangle",
      name: "Rect B",
      visible: true,
      locked: false,
      transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 25,
      style: { fill: "#00ff00", stroke: "#000000", strokeWidth: 1, opacity: 1 },
      export: { artwork: true, cut: false, fold: false },
    };

    useProjectStore.getState().executeCommand(new CreateNodeCommand("ring-multi-1", rectA));
    useProjectStore.getState().executeCommand(new CreateNodeCommand("ring-multi-1", rectB));

    // Multi-select both rectangles
    useSelectionStore.getState().setSelection([
      { id: "rect-a", type: "rectangle" },
      { id: "rect-b", type: "rectangle" },
    ]);

    expect(useSelectionStore.getState().selectedItems).toHaveLength(2);

    // Apply batch update command for fill color
    const newFill = "#6366f1";
    const updates = [rectA, rectB].map((node) => ({
      nodeId: node.id,
      oldNode: node,
      newNode: {
        ...node,
        style: { ...node.style, fill: newFill },
      },
    }));
    useProjectStore.getState().executeCommand(new UpdateMultipleNodesCommand(updates));

    const updatedRing = (useProjectStore.getState().project.mechanism.children || [])[0];
    const children = updatedRing.children || [];
    expect((children[0] as RectangleNode).style?.fill).toBe("#6366f1");
    expect((children[1] as RectangleNode).style?.fill).toBe("#6366f1");

    // Undo should revert both nodes atomically
    useProjectStore.getState().undo();
    const revertedRing = (useProjectStore.getState().project.mechanism.children || [])[0];
    const revertedChildren = revertedRing.children || [];
    expect((revertedChildren[0] as RectangleNode).style?.fill).toBe("#ff0000");
    expect((revertedChildren[1] as RectangleNode).style?.fill).toBe("#00ff00");
  });
});
