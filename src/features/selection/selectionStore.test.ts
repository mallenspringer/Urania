import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "./selectionStore";
import { useProjectStore } from "../project/projectStore";
import type { Project, RingNode, SectorNode, TextNode } from "../../shared/types/project";

describe("Selection Store", () => {
  // Setup a mini mock volvelle structure for tree hierarchy tests
  const createMockProject = (): Project => {
    const textNode: TextNode = {
      id: "text-child",
      type: "text",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
      content: "Hello",
      fontFamily: "Arial",
      fontSize: 12,
    };

    const sectorNode: SectorNode = {
      id: "sector-parent",
      type: "sector",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      startAngle: 0,
      endAngle: 90,
      children: [textNode],
    };

    const ringNode: RingNode = {
      id: "ring-root",
      type: "ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 10,
      outerRadius: 50,
      rotation: 0,
      children: [sectorNode],
    };

    return {
      format: "urania",
      version: "1.0.0",
      mechanismType: "volvelle",
      metadata: {
        name: "Test",
        author: "",
        description: "",
        createdAt: "",
        updatedAt: "",
      },
      settings: {
        units: "pixels",
        canvasSize: { width: 100, height: 100 },
      },
      assets: [],
      mechanism: {
        id: "volvelle-root",
        type: "volvelle",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [ringNode],
      },
    };
  };

  beforeEach(() => {
    useProjectStore.getState().setProject(createMockProject());
    useSelectionStore.getState().clearSelection();
  });

  it("should select single items and set activeItem", () => {
    const store = useSelectionStore.getState();

    store.selectItem("ring-root", "ring");
    expect(useSelectionStore.getState().selectedItems).toEqual([
      { id: "ring-root", type: "ring" },
    ]);
    expect(useSelectionStore.getState().activeItem).toEqual({
      id: "ring-root",
      type: "ring",
    });
  });

  it("should handle multi-selection and update activeItem to last selected", () => {
    const store = useSelectionStore.getState();

    // Select first
    store.selectItem("ring-root", "ring", true);
    // Select second (non-overlapping sibling or independent node)
    store.selectItem("independent-node", "shape", true);

    const state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(2);
    expect(state.selectedItems[0].id).toBe("ring-root");
    expect(state.selectedItems[1].id).toBe("independent-node");
    expect(state.activeItem?.id).toBe("independent-node");
  });

  it("should prevent duplicate selection but focus duplicate as active item", () => {
    const store = useSelectionStore.getState();

    store.selectItem("node-1", "shape", true);
    store.selectItem("node-2", "shape", true);
    
    // Select node-1 again
    store.selectItem("node-1", "shape", true);

    const state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(2);
    expect(state.activeItem?.id).toBe("node-1");
  });

  it("should deselect items correctly", () => {
    const store = useSelectionStore.getState();

    store.selectItem("node-1", "shape", true);
    store.selectItem("node-2", "shape", true);

    store.deselectItem("node-1");

    const state = useSelectionStore.getState();
    expect(state.selectedItems).toEqual([{ id: "node-2", type: "shape" }]);
    expect(state.activeItem?.id).toBe("node-2");
  });

  it("should clear all selections", () => {
    const store = useSelectionStore.getState();

    store.selectItem("node-1", "shape", true);
    store.clearSelection();

    const state = useSelectionStore.getState();
    expect(state.selectedItems).toHaveLength(0);
    expect(state.activeItem).toBeNull();
  });

  it("should deselect parent when selecting child", () => {
    const store = useSelectionStore.getState();

    // Select parent ring first
    store.selectItem("ring-root", "ring", true);
    expect(useSelectionStore.getState().selectedItems).toHaveLength(1);

    // Select child text node
    store.selectItem("text-child", "text", true);

    const state = useSelectionStore.getState();
    // Parent should be removed, leaving only the child selected
    expect(state.selectedItems).toEqual([{ id: "text-child", type: "text" }]);
    expect(state.activeItem?.id).toBe("text-child");
  });

  it("should deselect child when selecting parent", () => {
    const store = useSelectionStore.getState();

    // Select child text node first
    store.selectItem("text-child", "text", true);
    expect(useSelectionStore.getState().selectedItems).toHaveLength(1);

    // Select parent sector
    store.selectItem("sector-parent", "sector", true);

    const state = useSelectionStore.getState();
    // Child should be removed, leaving only parent sector selected
    expect(state.selectedItems).toEqual([{ id: "sector-parent", type: "sector" }]);
    expect(state.activeItem?.id).toBe("sector-parent");
  });
});
