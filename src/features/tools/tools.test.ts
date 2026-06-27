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
    const ring = finalProject.mechanism.children[0];
    expect(ring.children).toHaveLength(1);
    expect(ring.children[0].type).toBe("rectangle");
    expect(ring.children[0].width).toBe(90);
    expect(ring.children[0].height).toBe(90);
  });
});
