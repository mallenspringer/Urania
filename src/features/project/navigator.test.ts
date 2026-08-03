import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "./projectStore";
import { useSelectionStore } from "../selection/selectionStore";
import {
  CreateRingCommand,
  CreateNodeCommand,
  UpdateNodeCommand,
  ReorderChildNodesCommand,
} from "./commands";
import type { RingNode, SectorNode, RectangleNode } from "../../shared/types/project";

describe("Navigator Tree & Node Lock/Visibility Hierarchy Operations", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
    useSelectionStore.getState().clearSelection();
  });

  it("should support creating nested sector and element children under a ring", () => {
    const ringId = "ring-nav-1";
    const ring: RingNode = {
      id: ringId,
      type: "ring",
      name: "Inner Volvelle Disc",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 50,
      outerRadius: 120,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring));

    const sector: SectorNode = {
      id: "sector-nav-1",
      type: "sector",
      name: "Aries",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      startAngle: 0,
      endAngle: 30,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateNodeCommand(ringId, sector));

    const rect: RectangleNode = {
      id: "rect-nav-1",
      type: "rectangle",
      name: "Zodiac Glyph Box",
      visible: true,
      locked: false,
      transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 20,
      style: { fill: "#6366f1" },
      export: { artwork: true, cut: false, fold: false },
    };
    useProjectStore.getState().executeCommand(new CreateNodeCommand("sector-nav-1", rect));

    const project = useProjectStore.getState().project;
    const rings = project.mechanism.children || [];
    expect(rings).toHaveLength(1);
    expect(rings[0].children).toHaveLength(1);
    expect(rings[0].children[0].id).toBe("sector-nav-1");
    expect((rings[0].children[0] as SectorNode).children).toHaveLength(1);
    expect((rings[0].children[0] as SectorNode).children![0].id).toBe("rect-nav-1");
  });

  it("should toggle node lock and visibility states correctly via commands", () => {
    const ring: RingNode = {
      id: "ring-lock-test",
      type: "ring",
      name: "Lock Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 10,
      outerRadius: 80,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring));

    // Toggle Lock
    const lockedRing = { ...ring, locked: true };
    useProjectStore.getState().executeCommand(new UpdateNodeCommand(ring.id, ring, lockedRing));
    let storeRing = (useProjectStore.getState().project.mechanism.children || [])[0];
    expect(storeRing.locked).toBe(true);

    // Toggle Visibility
    const hiddenRing = { ...lockedRing, visible: false };
    useProjectStore.getState().executeCommand(new UpdateNodeCommand(ring.id, lockedRing, hiddenRing));
    storeRing = (useProjectStore.getState().project.mechanism.children || [])[0];
    expect(storeRing.visible).toBe(false);

    // Undo Visibility
    useProjectStore.getState().undo();
    storeRing = (useProjectStore.getState().project.mechanism.children || [])[0];
    expect(storeRing.visible).toBe(true);
    expect(storeRing.locked).toBe(true);
  });

  it("should support reordering child elements under a sector or ring", () => {
    const ringId = "ring-reorder";
    const ring: RingNode = {
      id: ringId,
      type: "ring",
      name: "Ring Reorder",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 20,
      outerRadius: 100,
      rotation: 0,
      children: [],
    };
    useProjectStore.getState().executeCommand(new CreateRingCommand(ring));

    const elem1: RectangleNode = {
      id: "elem-1",
      type: "rectangle",
      name: "Elem 1",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 10,
      height: 10,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };
    const elem2: RectangleNode = {
      id: "elem-2",
      type: "rectangle",
      name: "Elem 2",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 10,
      height: 10,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };
    useProjectStore.getState().executeCommand(new CreateNodeCommand(ringId, elem1));
    useProjectStore.getState().executeCommand(new CreateNodeCommand(ringId, elem2));

    let children = (useProjectStore.getState().project.mechanism.children || [])[0].children;
    expect(children[0].id).toBe("elem-1");
    expect(children[1].id).toBe("elem-2");

    // Move elem-1 to index 1
    useProjectStore.getState().executeCommand(new ReorderChildNodesCommand(ringId, 0, 1));
    children = (useProjectStore.getState().project.mechanism.children || [])[0].children;
    expect(children[0].id).toBe("elem-2");
    expect(children[1].id).toBe("elem-1");

    // Undo
    useProjectStore.getState().undo();
    children = (useProjectStore.getState().project.mechanism.children || [])[0].children;
    expect(children[0].id).toBe("elem-1");
    expect(children[1].id).toBe("elem-2");
  });
});
