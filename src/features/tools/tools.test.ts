import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "./toolStore";
import { toolRegistry } from "./toolRegistry";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import type { ToolContext } from "./toolTypes";

describe("Tool System", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
    useToolStore.getState().setActiveTool("select");
    useToolStore.getState().setToolLocked(false);
    useToolStore.getState().setPreviewData(null);
    useToolStore.getState().setDragStartPos(null);
  });

  it("should initialize with select tool active", () => {
    const store = useToolStore.getState();
    expect(store.activeToolId).toBe("select");
    expect(store.isToolLocked).toBe(false);
  });

  it("should lock/unlock tool selections", () => {
    const store = useToolStore.getState();
    store.setToolLocked(true);
    expect(useToolStore.getState().isToolLocked).toBe(true);
  });

  it("should register all standard tools", () => {
    const tools = toolRegistry.getAllTools();
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("select");
    expect(ids).toContain("create-rectangle");
    expect(ids).toContain("create-circle");
    expect(ids).toContain("create-polygon");
    expect(ids).toContain("create-window-circle");
    expect(ids).toContain("create-text");
    expect(ids).toContain("create-arcText");
    expect(ids).toContain("create-guide-radial");
    expect(ids).toContain("create-guide-circular");
  });

  it("should run rectangle shape drawing tool successfully", () => {
    const rectTool = toolRegistry.getTool("create-rectangle");
    expect(rectTool).toBeDefined();

    const activeRing = {
      id: "ring-1",
      type: "ring" as const,
      name: "Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 0,
      outerRadius: 200,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().setProject({
      ...useProjectStore.getState().project,
      mechanism: {
        ...useProjectStore.getState().project.mechanism,
        children: [activeRing],
      },
    });

    const project = useProjectStore.getState().project;

    const mockContext: ToolContext = {
      project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 600,
      activeRingId: "ring-1",
      pointerPos: { x: 10, y: 10 },
      startPos: { x: 10, y: 10 },
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: (data) => useToolStore.getState().setPreviewData(data),
      currentPreviewData: useToolStore.getState().previewData,
      isShift: false,
      isAlt: false,
    };

    rectTool!.onMouseDown!(
      { evt: { button: 0 } } as any,
      mockContext
    );

    let preview = useToolStore.getState().previewData;
    expect(preview).toBeDefined();
    expect(preview!.startX).toBe(10);
    expect(preview!.isDragging).toBe(true);

    mockContext.currentPreviewData = preview;
    mockContext.pointerPos = { x: 100, y: 100 };
    rectTool!.onMouseMove!(
      { evt: { button: 0 } } as any,
      mockContext
    );

    preview = useToolStore.getState().previewData;
    expect(preview!.currentX).toBe(100);

    mockContext.currentPreviewData = preview;
    rectTool!.onMouseUp!(
      { evt: { button: 0 } } as any,
      mockContext
    );

    const finalProject = useProjectStore.getState().project;
    const ring = (finalProject.mechanism.children || [])[0] as any;
    expect(ring.children).toHaveLength(1);
    expect(ring.children[0].type).toBe("rectangle");
    expect(ring.children[0].width).toBe(90);
    expect(ring.children[0].height).toBe(90);
  });

  it("should create text node using text tool and transition to edit mode", () => {
    const textToolInstance = toolRegistry.getTool("create-text");
    expect(textToolInstance).toBeDefined();

    const activeRing = {
      id: "ring-1",
      type: "ring" as const,
      name: "Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 0,
      outerRadius: 200,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().setProject({
      ...useProjectStore.getState().project,
      mechanism: {
        ...useProjectStore.getState().project.mechanism,
        children: [activeRing],
      },
    });

    const project = useProjectStore.getState().project;

    const mockContext: ToolContext = {
      project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 600,
      activeRingId: "ring-1",
      pointerPos: { x: 50, y: 50 },
      startPos: { x: 50, y: 50 },
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: (data) => useToolStore.getState().setPreviewData(data),
      currentPreviewData: useToolStore.getState().previewData,
      isShift: false,
      isAlt: false,
    };

    textToolInstance!.onMouseDown!(
      { evt: { button: 0 } } as any,
      mockContext
    );

    // Verify it created a node and set editingTextNodeId
    const finalProject = useProjectStore.getState().project;
    const ring = (finalProject.mechanism.children || [])[0] as any;
    expect(ring.children).toHaveLength(1);
    expect(ring.children[0].type).toBe("text");
    expect(ring.children[0].content).toBe("Text");

    const editingId = useToolStore.getState().editingTextNodeId;
    expect(editingId).toBe(ring.children[0].id);
  });

  it("should drag a node using the select tool and commit changes on mouse up", () => {
    const selectToolInstance = toolRegistry.getTool("select");
    expect(selectToolInstance).toBeDefined();

    const rectNode = {
      id: "rect-1",
      type: "rectangle" as const,
      name: "Rectangle",
      visible: true,
      locked: false,
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 50,
      height: 50,
      style: { fill: "#cbd5e1" },
      export: { artwork: true, cut: false, fold: false },
    };

    const ring = {
      id: "ring-1",
      type: "ring" as const,
      name: "Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 0,
      outerRadius: 200,
      rotation: 0,
      children: [rectNode],
    };

    useProjectStore.getState().setProject({
      ...useProjectStore.getState().project,
      mechanism: {
        ...useProjectStore.getState().project.mechanism,
        children: [ring],
      },
    });



    // Seed the preview store with the drag state
    useToolStore.getState().setPreviewData({
      isDraggingNode: true,
      nodeId: "rect-1",
      nodeType: "rectangle",
      originalNode: JSON.parse(JSON.stringify(rectNode)),
      x1: 100,
      y1: 100,
      startNodeX: 10,
      startNodeY: 20,
    });

    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 600,
      activeRingId: "ring-1",
      pointerPos: { x: 150, y: 180 }, // delta: x+50, y+80
      startPos: { x: 100, y: 100 },
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: (data) => useToolStore.getState().setPreviewData(data),
      currentPreviewData: useToolStore.getState().previewData,
      isShift: false,
      isAlt: false,
    };

    // Trigger drag move
    selectToolInstance!.onMouseMove!(
      { evt: {} } as any,
      mockContext
    );

    // Verify transient state update
    let currentProject = useProjectStore.getState().project;
    let node = (currentProject.mechanism.children || [])[0].children?.[0] as any;
    expect(node.transform.x).toBe(60); // 10 + 50
    expect(node.transform.y).toBe(100); // 20 + 80

    // Trigger mouse up to finalize
    mockContext.project = currentProject;
    mockContext.currentPreviewData = useToolStore.getState().previewData;
    selectToolInstance!.onMouseUp!(
      { evt: {} } as any,
      mockContext
    );

    // Verify command committed to history stack
    expect(useProjectStore.getState().past).toHaveLength(1);
    expect(useProjectStore.getState().past[0].getLabel()).toContain("Edit rectangle");

    // Verify final state is updated
    const finalProject = useProjectStore.getState().project;
    const finalNode = (finalProject.mechanism.children || [])[0].children?.[0] as any;
    expect(finalNode.transform.x).toBe(60);
    expect(finalNode.transform.y).toBe(100);
  });

  it("should resize a rectangle node symmetrically using the select tool and commit changes on mouse up", () => {
    const selectToolInstance = toolRegistry.getTool("select");
    expect(selectToolInstance).toBeDefined();

    const rectNode = {
      id: "rect-1",
      type: "rectangle" as const,
      name: "Rectangle",
      visible: true,
      locked: false,
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 50,
      height: 50,
      style: { fill: "#cbd5e1" },
      export: { artwork: true, cut: false, fold: false },
    };

    const ring = {
      id: "ring-1",
      type: "ring" as const,
      name: "Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 0,
      outerRadius: 200,
      rotation: 0,
      children: [rectNode],
    };

    useProjectStore.getState().setProject({
      ...useProjectStore.getState().project,
      mechanism: {
        ...useProjectStore.getState().project.mechanism,
        children: [ring],
      },
    });



    // Seed the preview store with the resize state
    useToolStore.getState().setPreviewData({
      isResizing: true,
      nodeId: "rect-1",
      nodeType: "rectangle",
      handle: "bottom-right",
      originalNode: JSON.parse(JSON.stringify(rectNode)),
      x1: 100,
      y1: 100,
    });

    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 600,
      activeRingId: "ring-1",
      pointerPos: { x: 130, y: 140 }, // local pointer relative to rect-1 is (130 - 10, 140 - 20) = (120, 120)
      startPos: { x: 100, y: 100 },
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: (data) => useToolStore.getState().setPreviewData(data),
      currentPreviewData: useToolStore.getState().previewData,
      isShift: false,
      isAlt: false,
    };

    // Trigger resize move
    selectToolInstance!.onMouseMove!(
      { evt: {} } as any,
      mockContext
    );

    // Verify transient state update: width = abs(lx)*2 = 240, height = abs(ly)*2 = 240
    let currentProject = useProjectStore.getState().project;
    let node = (currentProject.mechanism.children || [])[0].children?.[0] as any;
    expect(node.width).toBe(240);
    expect(node.height).toBe(240);

    // Trigger mouse up to finalize
    mockContext.project = currentProject;
    mockContext.currentPreviewData = useToolStore.getState().previewData;
    selectToolInstance!.onMouseUp!(
      { evt: {} } as any,
      mockContext
    );

    // Verify command committed to history stack
    expect(useProjectStore.getState().past).toHaveLength(1);
    expect(useProjectStore.getState().past[0].getLabel()).toContain("Edit rectangle");

    // Verify final state is updated
    const finalProject = useProjectStore.getState().project;
    const finalNode = (finalProject.mechanism.children || [])[0].children?.[0] as any;
    expect(finalNode.width).toBe(240);
    expect(finalNode.height).toBe(240);
  });
});

