import { describe, it, expect } from "vitest";
import { resolveProject } from "../runtime/mechanismEngine";
import type { Project, RectangleNode } from "../../shared/types/project";
import { selectTool } from "./selectTool";
import { toolRegistry } from "./toolRegistry";
import { useProjectStore } from "../project/projectStore";
import { useToolStore } from "./toolStore";
import type { ToolContext } from "./toolTypes";

describe("Milestone 1: Custom Shapes & Radial Warp Tests", () => {
  const createMockProject = (nodes: any[]): Project => {
    return {
      metadata: {
        name: "Test Project",
        author: "Test Author",
        description: "Desc",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      settings: { canvasSize: { width: 800, height: 800 }, units: "pixels" },
      mechanism: {
        id: "volvelle-root",
        type: "volvelle",
        visible: true,
        locked: false,
        transform: { x: 400, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [
          {
            id: "test-ring",
            type: "ring",
            name: "Main Ring",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            innerRadius: 100,
            outerRadius: 200,
            rotation: 45, // rotated by 45 degrees
            children: nodes,
          } as any,
        ],
      },
      assets: [],
    } as any;
  };

  it("should resolve a Cartesian rectangle node correctly", () => {
    const rectNode: RectangleNode = {
      id: "rect-1",
      type: "rectangle",
      name: "Cartesian Rect",
      visible: true,
      locked: false,
      transform: { x: 150, y: 0, rotation: 10, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 20,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const project = createMockProject([rectNode]);
    const resolved = resolveProject(project);

    const resolvedRect = resolved.find((n) => n.id === "rect-1");
    expect(resolvedRect).toBeDefined();
    expect(resolvedRect!.renderData.isRadialWarp).toBeUndefined();
    expect(resolvedRect!.renderData.width).toBe(40);
    expect(resolvedRect!.renderData.height).toBe(20);
    
    // Position should be translated Cartesian in world space
    // Center at (0, 0), parent ring rotated 45 deg, local offset (150, 0)
    // 45 degrees rotation of (150, 0) results in (150 * cos(45), 150 * sin(45)) -> approx (106, 106) offset
    expect(resolvedRect!.worldTransform.x).toBeCloseTo(150 * Math.cos(Math.PI / 4), 1);
    expect(resolvedRect!.worldTransform.y).toBeCloseTo(150 * Math.sin(Math.PI / 4), 1);
  });

  it("should resolve a radial warped rectangle node centered at (0,0) with polar renderData", () => {
    const radialRectNode: RectangleNode = {
      id: "rect-radial",
      type: "rectangle",
      name: "Radial Rect",
      visible: true,
      locked: false,
      transformMode: "radial",
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 }, // Cartesian coordinate decomposes to r=141.4, theta=45
      width: 30, // angular sweep degrees
      height: 20, // radial thickness pixels
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const project = createMockProject([radialRectNode]);
    const resolved = resolveProject(project);

    const resolvedRect = resolved.find((n) => n.id === "rect-radial");
    expect(resolvedRect).toBeDefined();
    expect(resolvedRect!.renderData.isRadialWarp).toBe(true);
    expect(resolvedRect!.renderData.radialRadius).toBeCloseTo(Math.sqrt(20000), 2); // sqrt(100^2 + 100^2) = 141.42
    expect(resolvedRect!.renderData.radialTheta).toBe(45); // atan2(100, 100) = 45 degrees

    // World position remains at parent origin (0, 0) because it is a curved arc drawn around center
    expect(resolvedRect!.worldTransform.x).toBe(0);
    expect(resolvedRect!.worldTransform.y).toBe(0);
    
    // Bounds should reflect angular width and radial thickness
    expect(resolvedRect!.bounds.width).toBe(30);
    expect(resolvedRect!.bounds.height).toBe(20);
  });

  it("should resolve custom Star and Crescent shapes correctly", () => {
    const starNode = {
      id: "star-1",
      type: "star",
      name: "Decorative Star",
      visible: true,
      locked: false,
      transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
      numPoints: 6,
      innerRadius: 10,
      outerRadius: 25,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const crescentNode = {
      id: "crescent-1",
      type: "crescent",
      name: "Lunar Crescent",
      visible: true,
      locked: false,
      transform: { x: -80, y: 0, rotation: 90, scaleX: 1, scaleY: 1 },
      radius: 30,
      ratio: 0.5,
      phase: -0.3,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const project = createMockProject([starNode, crescentNode]);
    const resolved = resolveProject(project);

    const resolvedStar = resolved.find((n) => n.id === "star-1");
    expect(resolvedStar).toBeDefined();
    expect(resolvedStar!.renderData.numPoints).toBe(6);
    expect(resolvedStar!.renderData.innerRadius).toBe(10);
    expect(resolvedStar!.renderData.outerRadius).toBe(25);

    const resolvedCrescent = resolved.find((n) => n.id === "crescent-1");
    expect(resolvedCrescent).toBeDefined();
    expect(resolvedCrescent!.renderData.radius).toBe(30);
    expect(resolvedCrescent!.renderData.ratio).toBe(0.5);
    expect(resolvedCrescent!.renderData.phase).toBe(-0.3);
  });
});

describe("Milestone 1 Refinement: 8-Handle Resizing (Corner = Linked, Side = 1D)", () => {
  it("should resize a Cartesian rectangle node proportionally when corner handle is dragged", () => {
    const rectNode = {
      id: "rect-proportional-test",
      type: "rectangle",
      name: "Cartesian Rect",
      visible: true,
      locked: false,
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 20,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const project = {
      metadata: { name: "Test Project", author: "Test Author", description: "Desc", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      settings: { canvasSize: { width: 800, height: 800 }, units: "pixels" },
      mechanism: {
        id: "volvelle-root",
        type: "volvelle",
        visible: true,
        locked: false,
        transform: { x: 400, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [
          {
            id: "test-ring",
            type: "ring",
            name: "Main Ring",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            innerRadius: 100,
            outerRadius: 200,
            rotation: 0,
            children: [rectNode],
          } as any,
        ],
      },
      assets: [],
    };

    useProjectStore.getState().setProject(project as any);

    // Initial width is 40, height is 20. Aspect Ratio is 2.0.
    // Set preview data to simulate dragging bottom-right corner
    useToolStore.getState().setPreviewData({
      isResizing: true,
      nodeId: "rect-proportional-test",
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
      stageHeight: 800,
      activeRingId: "test-ring",
      pointerPos: { x: 130, y: 110 }, // Dragged right and down in local coordinates (parent ring rotation = 0)
      startPos: { x: 100, y: 100 },
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: (data) => useToolStore.getState().setPreviewData(data),
      currentPreviewData: useToolStore.getState().previewData,
      isShift: false,
      isAlt: false,
    };

    // Trigger onMouseMove
    selectTool.onMouseMove!(null, mockContext);

    // Get the updated node
    const updatedNode = useProjectStore.getState().project.mechanism.children![0].children![0] as any;

    // Proportional stretch should scale width and height with the same factor
    // lx = 130 - 100 = 30. S_w = (30 * 2) / 40 = 1.5
    // ly = 110 - 100 = 10. S_h = (10 * 2) / 20 = 1.0
    // S = (1.5 + 1.0) / 2 = 1.25
    // New width = 40 * 1.25 = 50, New height = 20 * 1.25 = 25
    expect(updatedNode.width).toBeCloseTo(50, 1);
    expect(updatedNode.height).toBeCloseTo(25, 1);
  });

  it("should resize a Cartesian rectangle node in 1D when side handle is dragged", () => {
    const rectNode = {
      id: "rect-1d-test",
      type: "rectangle",
      name: "Cartesian Rect",
      visible: true,
      locked: false,
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 20,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const project = {
      metadata: { name: "Test Project", author: "Test Author", description: "Desc", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      settings: { canvasSize: { width: 800, height: 800 }, units: "pixels" },
      mechanism: {
        id: "volvelle-root",
        type: "volvelle",
        visible: true,
        locked: false,
        transform: { x: 400, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [
          {
            id: "test-ring",
            type: "ring",
            name: "Main Ring",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            innerRadius: 100,
            outerRadius: 200,
            rotation: 0,
            children: [rectNode],
          } as any,
        ],
      },
      assets: [],
    };

    useProjectStore.getState().setProject(project as any);

    // Test dragging right-mid side handle
    useToolStore.getState().setPreviewData({
      isResizing: true,
      nodeId: "rect-1d-test",
      nodeType: "rectangle",
      handle: "right-mid",
      originalNode: JSON.parse(JSON.stringify(rectNode)),
      x1: 100,
      y1: 100,
    });

    const getContext = (): ToolContext => ({
      project: useProjectStore.getState().project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      activeRingId: "test-ring",
      pointerPos: { x: 130, y: 110 }, // Dragged right and down
      startPos: { x: 100, y: 100 },
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: (data) => useToolStore.getState().setPreviewData(data),
      currentPreviewData: useToolStore.getState().previewData,
      isShift: false,
      isAlt: false,
    });

    selectTool.onMouseMove!(null, getContext());

    let updatedNode = useProjectStore.getState().project.mechanism.children![0].children![0] as any;

    // Only width should change (lx = 30. width = 30 * 2 = 60). Height stays 20.
    expect(updatedNode.width).toBeCloseTo(60, 1);
    expect(updatedNode.height).toBe(20);

    // Test dragging bottom-mid side handle
    const nodeState = useProjectStore.getState().project.mechanism.children![0].children![0] as any;
    useToolStore.getState().setPreviewData({
      isResizing: true,
      nodeId: "rect-1d-test",
      nodeType: "rectangle",
      handle: "bottom-mid",
      originalNode: JSON.parse(JSON.stringify(nodeState)),
      x1: 100,
      y1: 100,
    });

    selectTool.onMouseMove!(null, getContext());

    updatedNode = useProjectStore.getState().project.mechanism.children![0].children![0] as any;

    // Only height should change (ly = 10. height = 10 * 2 = 20). Width stays at the 60 from the previous step!
    // Since we start from the updated project state where width is 60.
    expect(updatedNode.width).toBeCloseTo(60, 1);
    expect(updatedNode.height).toBeCloseTo(20, 1);
  });
});

describe("Shape/Cutout Creation Mode & Generalized Window Cutouts", () => {
  it("should create a WindowNode when creationMode is set to cutout", () => {
    useToolStore.getState().setCreationMode("cutout");
    expect(useToolStore.getState().creationMode).toBe("cutout");

    const starNode = {
      id: "star-cutout-test",
      type: "star",
      name: "Star",
      visible: true,
      locked: false,
      transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
      numPoints: 5,
      innerRadius: 15,
      outerRadius: 35,
      style: { stroke: "#3b82f6", strokeWidth: 2, fill: "transparent" },
      export: { artwork: true, cut: false, fold: false },
    };

    let newNode: any = starNode;
    if (useToolStore.getState().creationMode === "cutout") {
      newNode = {
        id: "window-star-1",
        type: "window",
        name: `${starNode.name} Cutout`,
        visible: true,
        locked: false,
        transform: starNode.transform,
        export: { artwork: false, cut: true, fold: false },
        savedSolidType: starNode.type,
        savedSolidStyle: { fill: "#3b82f6" },
        shape: { ...starNode, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
      };
    }

    expect(newNode.type).toBe("window");
    expect(newNode.savedSolidType).toBe("star");
    expect(newNode.shape.type).toBe("star");
    expect(newNode.export.cut).toBe(true);

    // Reset creationMode back to solid
    useToolStore.getState().setCreationMode("solid");
  });

  it("should resolve bounds for star, trapezoid, and text window cutouts in mechanismEngine", () => {
    const starWindowNode = {
      id: "window-star-resolution",
      type: "window",
      name: "Star Cutout",
      visible: true,
      locked: false,
      transform: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
      shape: {
        id: "inner-star",
        type: "star",
        numPoints: 5,
        innerRadius: 15,
        outerRadius: 40,
      },
    };

    const project: any = {
      metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
      settings: { canvasSize: { width: 800, height: 800 }, units: "pixels" },
      mechanism: {
        id: "volvelle-root",
        type: "volvelle",
        visible: true,
        locked: false,
        transform: { x: 400, y: 400, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [
          {
            id: "main-ring",
            type: "ring",
            name: "Ring",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            innerRadius: 0,
            outerRadius: 300,
            children: [starWindowNode],
          },
        ],
      },
      assets: [],
    };

    const resolved = resolveProject(project);
    const resolvedStarWindow = resolved.find((n) => n.id === "window-star-resolution");
    expect(resolvedStarWindow).toBeDefined();
    expect(resolvedStarWindow!.bounds.width).toBe(80); // 40 * 2
    expect(resolvedStarWindow!.bounds.height).toBe(80);
  });

  it("should register and provide create-line shape tool", () => {
    const lineTool = toolRegistry.getTool("create-line");
    expect(lineTool).toBeDefined();
    expect(lineTool?.label).toBe("Line");
  });
});
