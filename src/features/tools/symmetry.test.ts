import { describe, it, expect } from "vitest";
import { useToolStore } from "./toolStore";
import { getPolygonPath } from "../export/svgExporter";
import { isPointInsideNode } from "../../shared/utils/geometry";
import type { ResolvedNode } from "../runtime/mechanismEngine";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { UpdateMultipleNodesCommand, UpdateNodeCommand } from "../project/commands";
import { toolRegistry } from "./toolRegistry";
import type { ToolContext } from "./toolTypes";
import { calculateSymmetryGroupUpdates, computeSymmetryOffsets, findSymmetryGroupMembers } from "../../shared/utils/symmetryHelper";

describe("Polygonal Rings & Radial Symmetry Engine", () => {
  it("should set and constrain symmetryCount between 1 and 360", () => {
    const store = useToolStore.getState();
    store.setSymmetryCount(26);
    expect(useToolStore.getState().symmetryCount).toBe(26);

    store.setSymmetryCount(600);
    expect(useToolStore.getState().symmetryCount).toBe(360);

    store.setSymmetryCount(0);
    expect(useToolStore.getState().symmetryCount).toBe(1);
  });

  it("should generate valid regular polygon SVG paths", () => {
    const hexagonPath = getPolygonPath(6, 100);
    expect(hexagonPath).toContain("M 100,0");
    expect(hexagonPath.split(" L ").length).toBe(6);
  });

  it("should perform hit testing on regular polygon rings", () => {
    const polyRing: ResolvedNode = {
      id: "ring-poly-1",
      type: "ring",
      name: "Hexagon Ring",
      visible: true,
      worldTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bounds: { x: -100, y: -100, width: 200, height: 200 },
      maskIds: [],
      renderData: {
        innerRadius: 20,
        outerRadius: 100,
        ringShape: "polygon",
        polygonSides: 6,
      },
    };

    // Point on polygon disc
    expect(isPointInsideNode({ x: 50, y: 0 }, polyRing)).toBe(true);

    // Point inside inner pinhole
    expect(isPointInsideNode({ x: 5, y: 0 }, polyRing)).toBe(false);

    // Point outside outer polygon boundary
    expect(isPointInsideNode({ x: 150, y: 0 }, polyRing)).toBe(false);
  });

  it("should create 8 symmetrical objects with a single click and undo them in a single step", () => {
    const projectStore = useProjectStore.getState();
    const initialProject = createEmptyProject();
    initialProject.mechanism.children = [
      {
        id: "target-ring",
        type: "ring",
        name: "Ring",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 10,
        outerRadius: 200,
        rotation: 0,
        children: [],
      } as any,
    ];
    projectStore.setProject(initialProject);
    projectStore.clearHistory();

    useToolStore.getState().setSymmetryCount(8);

    const rectTool = toolRegistry.getTool("create-rectangle");
    expect(rectTool).toBeDefined();

    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      activeRingId: "target-ring",
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      pointerPos: null,
      startPos: null,
      currentPreviewData: { startX: 100, startY: 100, currentX: 150, currentY: 150, isDragging: true },
      isShift: false,
      isAlt: false,
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: () => {},
    };

    // Complete drawing gesture
    rectTool?.onMouseUp?.({} as any, mockContext);

    // Verify 8 symmetrical rectangles were placed under target-ring
    const children = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(children).toHaveLength(8);

    // History stack should have only 1 command entry (the BatchCommand)
    expect(useProjectStore.getState().past).toHaveLength(1);
    expect(useProjectStore.getState().past[0].getLabel()).toContain("Symmetrical Rectangle Placement (8x)");

    // Undo should remove all 8 items in a single step
    useProjectStore.getState().undo();
    const childrenAfterUndo = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(childrenAfterUndo).toHaveLength(0);
    expect(useProjectStore.getState().past).toHaveLength(0);

    // Redo should restore all 8 items in a single step
    useProjectStore.getState().redo();
    const childrenAfterRedo = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(childrenAfterRedo).toHaveLength(8);

    // All 8 items should share the same symmetryGroupId
    const groupId = childrenAfterRedo[0].symmetryGroupId;
    expect(groupId).toBeDefined();
    expect(groupId).toMatch(/^symgroup-/);

    childrenAfterRedo.forEach((child, index) => {
      expect(child.symmetryGroupId).toBe(groupId);
      expect(child.symmetryIndex).toBe(index);
      expect(child.symmetryCount).toBe(8);
    });
  });

  it("should propagate transforms radially and update all members of a symmetry group synchronously", () => {
    const projectStore = useProjectStore.getState();
    const initialProject = createEmptyProject();
    initialProject.mechanism.children = [
      {
        id: "target-ring",
        type: "ring",
        name: "Ring",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 10,
        outerRadius: 200,
        rotation: 0,
        children: [],
      } as any,
    ];
    projectStore.setProject(initialProject);
    projectStore.clearHistory();

    useToolStore.getState().setSymmetryCount(4);

    const rectTool = toolRegistry.getTool("create-rectangle");
    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      activeRingId: "target-ring",
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      pointerPos: null,
      startPos: null,
      currentPreviewData: { startX: 50, startY: 0, currentX: 100, currentY: 50, isDragging: true },
      isShift: false,
      isAlt: false,
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: () => {},
    };

    rectTool?.onMouseUp?.({} as any, mockContext);

    const children = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(children).toHaveLength(4);

    const firstChild = children[0];
    expect(firstChild.symmetryGroupId).toBeDefined();

    const updates = calculateSymmetryGroupUpdates(
      useProjectStore.getState().project.mechanism,
      firstChild,
      { style: { fill: "#ff0000" }, transform: { x: 150, y: 0 } }
    );

    expect(updates).toHaveLength(4);

    // Apply updates using UpdateMultipleNodesCommand
    useProjectStore.getState().executeCommand(new UpdateMultipleNodesCommand(updates));

    const updatedChildren = useProjectStore.getState().project.mechanism.children![0].children!;
    
    // Check that all 4 children received fill #ff0000 and radius 150
    updatedChildren.forEach((child: any, idx: number) => {
      expect(child.style?.fill).toBe("#ff0000");
      const radius = Math.hypot(child.transform.x, child.transform.y);
      expect(radius).toBeCloseTo(150, 1);
      const angleDeg = (Math.atan2(child.transform.y, child.transform.x) * 180) / Math.PI;
      const expectedAngle = idx * 90;
      let diff = (angleDeg - expectedAngle) % 360;
      if (diff < 0) diff += 360;
      expect(diff).toBeCloseTo(0, 1);
    });

    // Undo should revert all 4 children to original style and radius in a single step
    useProjectStore.getState().undo();
    const rolledBackChildren = useProjectStore.getState().project.mechanism.children![0].children!;
    rolledBackChildren.forEach((child: any) => {
      expect(child.style?.fill).not.toBe("#ff0000");
    });
  });

  it("should support decoupling a single object and re-linking it while preserving relative custom offsets", () => {
    const projectStore = useProjectStore.getState();
    const initialProject = createEmptyProject();
    initialProject.mechanism.children = [
      {
        id: "target-ring",
        type: "ring",
        name: "Ring",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 10,
        outerRadius: 200,
        rotation: 0,
        children: [],
      } as any,
    ];
    projectStore.setProject(initialProject);
    projectStore.clearHistory();

    useToolStore.getState().setSymmetryCount(4);

    const rectTool = toolRegistry.getTool("create-rectangle");
    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      activeRingId: "target-ring",
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      pointerPos: null,
      startPos: null,
      currentPreviewData: { startX: 50, startY: 0, currentX: 100, currentY: 50, isDragging: true },
      isShift: false,
      isAlt: false,
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: () => {},
    };

    rectTool?.onMouseUp?.({} as any, mockContext);

    let children = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(children).toHaveLength(4);

    // 1. Decouple child #2 (symmetryIndex = 2)
    const child2 = JSON.parse(JSON.stringify(children[2]));
    child2.symmetryUnlinked = true;
    // Perform custom independent move on child #2 (+30px radial distance)
    child2.transform.x = 0;
    child2.transform.y = -130; // standard radius was 100 at angle 180° / -90°

    useProjectStore.getState().executeCommand(new UpdateNodeCommand(child2.id, children[2], child2));

    // 2. Now perform a group transform on child #0 (radius = 150)
    children = useProjectStore.getState().project.mechanism.children![0].children!;
    const updates = calculateSymmetryGroupUpdates(
      useProjectStore.getState().project.mechanism,
      children[0],
      { transform: { x: 150, y: 0 } }
    );

    // updates should contain nodes 0, 1, 3, but NOT node 2 because node 2 is unlinked
    expect(updates.map((u) => u.nodeId)).not.toContain(child2.id);

    useProjectStore.getState().executeCommand(new UpdateMultipleNodesCommand(updates));

    children = useProjectStore.getState().project.mechanism.children![0].children!;
    // Node 2 should still be at its custom position y = -130
    expect(children[2].transform.y).toBe(-130);

    // 3. Re-link node 2 with preserved relative offsets
    const offsets = computeSymmetryOffsets(useProjectStore.getState().project.mechanism, children[2]);
    expect(offsets.radialDistanceOffset).toBeDefined();

    const relinkedChild2 = JSON.parse(JSON.stringify(children[2]));
    relinkedChild2.symmetryUnlinked = false;
    relinkedChild2.symmetryOffsets = offsets;
    useProjectStore.getState().executeCommand(new UpdateNodeCommand(relinkedChild2.id, children[2], relinkedChild2));

    // 4. Transform group via child #0 to radius = 200
    children = useProjectStore.getState().project.mechanism.children![0].children!;
    const groupUpdates = calculateSymmetryGroupUpdates(
      useProjectStore.getState().project.mechanism,
      children[0],
      { transform: { x: 200, y: 0 } }
    );

    expect(groupUpdates.map((u) => u.nodeId)).toContain(child2.id);
    useProjectStore.getState().executeCommand(new UpdateMultipleNodesCommand(groupUpdates));

    children = useProjectStore.getState().project.mechanism.children![0].children!;
    const child2Radius = Math.hypot(children[2].transform.x, children[2].transform.y);
    // Node 2 radius should be group radius (200) + preserved radial offset (-20) = 180
    expect(child2Radius).toBeCloseTo(180, 1);
  });

  it("should convert all linked symmetry members between Solid Object and Window Cutout synchronously", () => {
    const projectStore = useProjectStore.getState();
    const initialProject = createEmptyProject();
    initialProject.mechanism.children = [
      {
        id: "target-ring",
        type: "ring",
        name: "Ring",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 10,
        outerRadius: 200,
        rotation: 0,
        children: [],
      } as any,
    ];
    projectStore.setProject(initialProject);
    projectStore.clearHistory();

    useToolStore.getState().setSymmetryCount(4);

    const rectTool = toolRegistry.getTool("create-rectangle");
    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      activeRingId: "target-ring",
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      pointerPos: null,
      startPos: null,
      currentPreviewData: { startX: 50, startY: 0, currentX: 100, currentY: 50, isDragging: true },
      isShift: false,
      isAlt: false,
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: () => {},
    };

    rectTool?.onMouseUp?.({} as any, mockContext);

    let children = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(children).toHaveLength(4);
    expect(children[0].type).toBe("rectangle");

    // Decouple node #2 so it stays solid when converting group
    children[2].symmetryUnlinked = true;

    // Convert group (via node #0) to Window Cutouts
    const members = findSymmetryGroupMembers(useProjectStore.getState().project.mechanism, children[0].symmetryGroupId!);
    const linkedMembers = members.filter((m) => !m.symmetryUnlinked);

    const updates = linkedMembers.map((m) => {
      const oldNode = JSON.parse(JSON.stringify(m));
      const childShape = {
        ...m,
        id: `${m.id}-shape`,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        export: { artwork: false, cut: true, fold: false },
      };
      const windowCutoutNode: any = {
        id: m.id,
        type: "window",
        name: `${m.name} Cutout`,
        visible: true,
        locked: false,
        transform: m.transform,
        export: { artwork: false, cut: true, fold: false },
        savedSolidType: m.type,
        savedSolidStyle: (m as any).style,
        shape: childShape,
        symmetryGroupId: m.symmetryGroupId,
        symmetryIndex: m.symmetryIndex,
        symmetryCount: m.symmetryCount,
        symmetryUnlinked: m.symmetryUnlinked,
      };
      return { nodeId: m.id, oldNode, newNode: windowCutoutNode };
    });

    useProjectStore.getState().executeCommand(new UpdateMultipleNodesCommand(updates));

    children = useProjectStore.getState().project.mechanism.children![0].children!;
    // Nodes 0, 1, 3 should now be windows
    expect(children[0].type).toBe("window");
    expect(children[1].type).toBe("window");
    expect(children[3].type).toBe("window");
    // Node 2 was unlinked, so it should remain rectangle
    expect(children[2].type).toBe("rectangle");

    // Undo should revert nodes 0, 1, 3 back to rectangle in a single step
    useProjectStore.getState().undo();
    const childrenAfterUndo = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(childrenAfterUndo[0].type).toBe("rectangle");
    expect(childrenAfterUndo[1].type).toBe("rectangle");
    expect(childrenAfterUndo[3].type).toBe("rectangle");
  });

  it("should convert an independent (decoupled) object function without affecting group siblings or stacking names", () => {
    const projectStore = useProjectStore.getState();
    const initialProject = createEmptyProject();
    initialProject.mechanism.children = [
      {
        id: "target-ring",
        type: "ring",
        name: "Ring",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 10,
        outerRadius: 200,
        rotation: 0,
        children: [],
      } as any,
    ];
    projectStore.setProject(initialProject);
    projectStore.clearHistory();

    useToolStore.getState().setSymmetryCount(4);

    const rectTool = toolRegistry.getTool("create-rectangle");
    const mockContext: ToolContext = {
      project: useProjectStore.getState().project,
      activeRingId: "target-ring",
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      pointerPos: null,
      startPos: null,
      currentPreviewData: { startX: 50, startY: 0, currentX: 100, currentY: 50, isDragging: true },
      isShift: false,
      isAlt: false,
      executeCommand: (cmd) => useProjectStore.getState().executeCommand(cmd),
      updatePreview: () => {},
    };

    rectTool?.onMouseUp?.({} as any, mockContext);

    let children = useProjectStore.getState().project.mechanism.children![0].children!;
    
    // Decouple node #2 (symmetryIndex = 2)
    children[2].symmetryUnlinked = true;

    // Simulate handleToggleObjectFunction on decoupled node #2
    const node2 = children[2];
    const isNodeDecoupled = !!node2.symmetryUnlinked;
    expect(isNodeDecoupled).toBe(true);

    // Single-node conversion logic for decoupled node #2
    const childShape = {
      ...node2,
      id: `${node2.id}-shape`,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      export: { artwork: false, cut: true, fold: false },
    };
    const cleanName = node2.name ? node2.name.replace(/ Cutout$/g, "") : "Window";
    const windowCutoutNode: any = {
      id: node2.id,
      type: "window",
      name: `${cleanName} Cutout`,
      visible: true,
      locked: false,
      transform: node2.transform,
      export: { artwork: false, cut: true, fold: false },
      savedSolidType: node2.type,
      savedSolidStyle: (node2 as any).style,
      shape: childShape,
      symmetryGroupId: node2.symmetryGroupId,
      symmetryIndex: node2.symmetryIndex,
      symmetryCount: node2.symmetryCount,
      symmetryUnlinked: true,
    };

    useProjectStore.getState().executeCommand(new UpdateNodeCommand(node2.id, node2, windowCutoutNode));

    children = useProjectStore.getState().project.mechanism.children![0].children!;
    // Node 2 is now a window cutout
    expect(children[2].type).toBe("window");
    expect(children[2].name).toBe("Rectangle Cutout");

    // Nodes 0, 1, 3 remain solid rectangles!
    expect(children[0].type).toBe("rectangle");
    expect(children[1].type).toBe("rectangle");
    expect(children[3].type).toBe("rectangle");

    // Convert node 2 back to solid
    const win2 = children[2];
    const originalShape = (win2 as any).shape || {};
    const solidType = (win2 as any).savedSolidType || originalShape.type || "rectangle";
    const solidStyle = (win2 as any).savedSolidStyle || originalShape.style || { fill: "#3b82f6" };
    const restoredSolidNode: any = {
      ...originalShape,
      id: win2.id,
      type: solidType,
      name: win2.name ? win2.name.replace(/ Cutout$/g, "") : "Solid Object",
      visible: true,
      locked: false,
      transform: win2.transform,
      style: solidStyle,
      export: { artwork: true, cut: false, fold: false },
      symmetryGroupId: win2.symmetryGroupId,
      symmetryIndex: win2.symmetryIndex,
      symmetryCount: win2.symmetryCount,
      symmetryUnlinked: true,
    };

    useProjectStore.getState().executeCommand(new UpdateNodeCommand(win2.id, win2, restoredSolidNode));

    children = useProjectStore.getState().project.mechanism.children![0].children!;
    expect(children[2].type).toBe("rectangle");
    expect(children[2].name).toBe("Rectangle");
  });
});
