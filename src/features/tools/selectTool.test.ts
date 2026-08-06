import { describe, it, expect, beforeEach } from "vitest";
import { selectTool } from "./selectTool";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { useSelectionStore } from "../selection/selectionStore";
import { CreateRingCommand, CreateNodeCommand } from "../project/commands";
import type { RingNode, RectangleNode } from "../../shared/types/project";
import type { ToolContext } from "./toolTypes";

describe("Select Tool - Ring-Level Marquee Selection", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
    useSelectionStore.getState().clearSelection();
  });

  const createContext = (previewData: any): ToolContext => ({
    project: useProjectStore.getState().project,
    zoom: 1,
    pan: { x: 0, y: 0 },
    stageWidth: 800,
    stageHeight: 600,
    activeRingId: null,
    pointerPos: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },
    isShift: false,
    isAlt: false,
    currentPreviewData: previewData,
    updatePreview: () => {},
    executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
  });

  it("should select topmost ring when no ring is selected and marquee drag occurs", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Ring 1",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 0,
      outerRadius: 100,
      rotation: 0,
      children: [],
    };
    const ring2: RingNode = {
      id: "ring-2",
      type: "ring",
      name: "Ring 2",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 100,
      outerRadius: 200,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring1));
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring2));

    expect(useSelectionStore.getState().activeItem).toBeNull();

    // Perform marquee selection with no active ring
    selectTool.onMouseUp?.({} as any, createContext({ isDragging: true, x1: -50, y1: -50, x2: 50, y2: 50 }));

    // Should select topmost ring ("ring-2")
    const selected = useSelectionStore.getState().selectedItems;
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe("ring-2");
    expect(selected[0].type).toBe("ring");
  });

  it("should only select objects placed on the active ring during marquee drag", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Ring 1",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 0,
      outerRadius: 100,
      rotation: 0,
      children: [],
    };
    const ring2: RingNode = {
      id: "ring-2",
      type: "ring",
      name: "Ring 2",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 100,
      outerRadius: 200,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring1));
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring2));

    const rect1: RectangleNode = {
      id: "rect-on-ring-1",
      type: "rectangle",
      name: "Rect 1",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 50,
      height: 50,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };
    const rect2: RectangleNode = {
      id: "rect-on-ring-2",
      type: "rectangle",
      name: "Rect 2",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 50,
      height: 50,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };
    useProjectStore.getState().executeCommand(new CreateNodeCommand("ring-1", rect1));
    useProjectStore.getState().executeCommand(new CreateNodeCommand("ring-2", rect2));

    // Make Ring 1 the active ring
    useSelectionStore.getState().selectItem("ring-1", "ring", false);
    expect(useSelectionStore.getState().activeItem?.id).toBe("ring-1");

    // Perform marquee selection covering both rects
    selectTool.onMouseUp?.({} as any, createContext({ isDragging: true, x1: -100, y1: -100, x2: 100, y2: 100 }));

    // Should ONLY select rect-on-ring-1, ignoring rect-on-ring-2
    const selected = useSelectionStore.getState().selectedItems;
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe("rect-on-ring-1");
  });
});
