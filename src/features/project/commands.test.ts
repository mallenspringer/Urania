import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "./projectStore";
import {
  CreateRingCommand,
  DeleteRingCommand,
  RotateRingCommand,
  ReorderRingsCommand,
  UpdateNodeCommand,
  GroupNodesCommand,
  UngroupNodesCommand,
  CreateNodeCommand,
  BatchCommand,
} from "./commands";
import type { RingNode } from "../../shared/types/project";
import type { Command } from "../../shared/types/command";

describe("Command and Undo History System", () => {
  beforeEach(() => {
    // Reset the project store before each test run
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
  });

  const createDummyRing = (id: string, name = "Ring"): RingNode => ({
    id,
    type: "ring",
    name,
    visible: true,
    locked: false,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    innerRadius: 10,
    outerRadius: 20,
    rotation: 0,
    children: [],
  });

  describe("CreateRingCommand", () => {
    it("should add a ring on execute and remove it on undo", () => {
      const ring = createDummyRing("ring-1");

      const cmd = new CreateRingCommand(ring);
      useProjectStore.getState().executeCommand(cmd);

      // Verify execution
      let children = useProjectStore.getState().project.mechanism.children || [];
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe("ring-1");

      // Verify undo
      useProjectStore.getState().undo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect(children).toHaveLength(0);

      // Verify redo
      useProjectStore.getState().redo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe("ring-1");
    });
  });

  describe("DeleteRingCommand", () => {
    it("should remove a ring on execute and restore it at its exact index position on undo", () => {
      const ring1 = createDummyRing("ring-1");
      const ring2 = createDummyRing("ring-2");
      const ring3 = createDummyRing("ring-3");

      // Directly seed the project store children (without history entry)
      useProjectStore.getState().setProject({
        ...useProjectStore.getState().project,
        mechanism: {
          ...useProjectStore.getState().project.mechanism,
          children: [ring1, ring2, ring3],
        },
      });

      const cmd = new DeleteRingCommand(ring2);
      useProjectStore.getState().executeCommand(cmd);

      // Verify execution (ring-2 is deleted, ring1 and ring3 remain)
      let children = useProjectStore.getState().project.mechanism.children || [];
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toEqual(["ring-1", "ring-3"]);

      // Verify undo (ring-2 is restored at index 1)
      useProjectStore.getState().undo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect(children).toHaveLength(3);
      expect(children.map((c) => c.id)).toEqual(["ring-1", "ring-2", "ring-3"]);

      // Verify redo
      useProjectStore.getState().redo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toEqual(["ring-1", "ring-3"]);
    });
  });

  describe("RotateRingCommand", () => {
    it("should update ring rotation angle and restore the original on undo", () => {
      const ring = createDummyRing("ring-1");
      ring.rotation = 10;

      useProjectStore.getState().setProject({
        ...useProjectStore.getState().project,
        mechanism: {
          ...useProjectStore.getState().project.mechanism,
          children: [ring],
        },
      });

      const cmd = new RotateRingCommand("ring-1", 10, 45);
      useProjectStore.getState().executeCommand(cmd);

      // Verify execute
      let children = useProjectStore.getState().project.mechanism.children || [];
      expect((children[0] as RingNode).rotation).toBe(45);

      // Verify undo
      useProjectStore.getState().undo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect((children[0] as RingNode).rotation).toBe(10);

      // Verify redo
      useProjectStore.getState().redo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect((children[0] as RingNode).rotation).toBe(45);
    });
  });

  describe("UpdateNodeCommand", () => {
    it("should update properties of a nested node on execute and revert on undo", () => {
      const ring = createDummyRing("ring-1");
      const textNode = {
        id: "text-1",
        type: "text",
        name: "My Text",
        visible: true,
        locked: false,
        transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
        content: "Before",
        style: { fill: "#000" },
        export: { artwork: true, cut: false, fold: false },
      };
      ring.children = [textNode as any];

      useProjectStore.getState().setProject({
        ...useProjectStore.getState().project,
        mechanism: {
          ...useProjectStore.getState().project.mechanism,
          children: [ring],
        },
      });

      const updatedTextNode = {
        ...textNode,
        content: "After",
        transform: { x: 10, y: 15, rotation: 45, scaleX: 1, scaleY: 1 },
      };

      const cmd = new UpdateNodeCommand("text-1", textNode as any, updatedTextNode as any);
      useProjectStore.getState().executeCommand(cmd);

      // Verify execute
      let children = useProjectStore.getState().project.mechanism.children || [];
      let ringChildren = children[0].children || [];
      expect((ringChildren[0] as any).content).toBe("After");
      expect(ringChildren[0].transform.x).toBe(10);
      expect(ringChildren[0].transform.y).toBe(15);
      expect(ringChildren[0].transform.rotation).toBe(45);

      // Verify undo
      useProjectStore.getState().undo();
      children = useProjectStore.getState().project.mechanism.children || [];
      ringChildren = children[0].children || [];
      expect((ringChildren[0] as any).content).toBe("Before");
      expect(ringChildren[0].transform.x).toBe(5);
      expect(ringChildren[0].transform.y).toBe(5);
      expect(ringChildren[0].transform.rotation).toBe(0);

      // Verify redo
      useProjectStore.getState().redo();
      children = useProjectStore.getState().project.mechanism.children || [];
      ringChildren = children[0].children || [];
      expect((ringChildren[0] as any).content).toBe("After");
      expect(ringChildren[0].transform.x).toBe(10);
      expect(ringChildren[0].transform.y).toBe(15);
    });
  });

  describe("History Manager Stacks & Limits", () => {
    it("should push commands to past stack and clear future stack on execute", () => {
      const ring1 = createDummyRing("ring-1");
      const ring2 = createDummyRing("ring-2");

      useProjectStore.getState().executeCommand(new CreateRingCommand(ring1));
      expect(useProjectStore.getState().past).toHaveLength(1);
      expect(useProjectStore.getState().future).toHaveLength(0);

      useProjectStore.getState().undo();
      expect(useProjectStore.getState().past).toHaveLength(0);
      expect(useProjectStore.getState().future).toHaveLength(1);

      // New execute clears the future stack
      useProjectStore.getState().executeCommand(new CreateRingCommand(ring2));
      expect(useProjectStore.getState().past).toHaveLength(1);
      expect(useProjectStore.getState().future).toHaveLength(0);
    });

    it("should limit the past stack size to 100 commands", () => {
      class DummyCommand implements Command {
        execute(): void {}
        undo(): void {}
        getLabel(): string {
          return "Dummy";
        }
      }

      // Execute 105 commands
      for (let i = 0; i < 105; i++) {
        useProjectStore.getState().executeCommand(new DummyCommand());
      }

      // Past stack is capped at 100
      // Past stack is capped at 100
      expect(useProjectStore.getState().past).toHaveLength(100);
    });
  });

  describe("Grouping Commands", () => {
    it("should group elements together, and restore them upon undo", () => {
      const parentRing = createDummyRing("ring-group-test");
      const rectA = {
        id: "rect-a",
        type: "rectangle",
        name: "Rect A",
        visible: true,
        locked: false,
        transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
        width: 20,
        height: 20,
        style: {},
        export: { artwork: true, cut: false, fold: false },
      };
      const rectB = {
        id: "rect-b",
        type: "rectangle",
        name: "Rect B",
        visible: true,
        locked: false,
        transform: { x: 30, y: 30, rotation: 0, scaleX: 1, scaleY: 1 },
        width: 20,
        height: 20,
        style: {},
        export: { artwork: true, cut: false, fold: false },
      };

      parentRing.children = [rectA, rectB];
      useProjectStore.getState().setProject({
        format: "urania",
        version: "1.0.0",
        mechanismType: "volvelle",
        metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
        settings: { units: "pixels", canvasSize: { width: 800, height: 800 } },
        assets: [],
        mechanism: {
          id: "volvelle-root",
          type: "volvelle",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          children: [parentRing],
        },
      });

      const groupNode: any = {
        id: "group-1",
        type: "group",
        name: "Group 1",
        visible: true,
        locked: false,
        transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
        style: {},
        export: { artwork: true, cut: false, fold: false },
        children: [
          { ...rectA, transform: { x: -10, y: -10, rotation: 0, scaleX: 1, scaleY: 1 } },
          { ...rectB, transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } },
        ],
      };

      const groupCmd = new GroupNodesCommand("ring-group-test", ["rect-a", "rect-b"], groupNode);
      useProjectStore.getState().executeCommand(groupCmd);

      let ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(1);
      expect(ringChildren[0].id).toBe("group-1");
      expect(ringChildren[0].children).toHaveLength(2);

      // Undo
      useProjectStore.getState().undo();
      ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(2);
      expect(ringChildren[0].id).toBe("rect-a");
      expect(ringChildren[1].id).toBe("rect-b");

      // Redo
      useProjectStore.getState().redo();
      ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(1);
      expect(ringChildren[0].id).toBe("group-1");
    });

    it("should ungroup elements and restore the group upon undo", () => {
      const rectA = {
        id: "rect-a",
        type: "rectangle",
        name: "Rect A",
        visible: true,
        locked: false,
        transform: { x: -10, y: -10, rotation: 0, scaleX: 1, scaleY: 1 },
        width: 20,
        height: 20,
        style: {},
        export: { artwork: true, cut: false, fold: false },
      };
      const rectB = {
        id: "rect-b",
        type: "rectangle",
        name: "Rect B",
        visible: true,
        locked: false,
        transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
        width: 20,
        height: 20,
        style: {},
        export: { artwork: true, cut: false, fold: false },
      };
      const groupNode: any = {
        id: "group-1",
        type: "group",
        name: "Group 1",
        visible: true,
        locked: false,
        transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
        style: {},
        export: { artwork: true, cut: false, fold: false },
        children: [rectA, rectB],
      };
      const parentRing = createDummyRing("ring-group-test");
      parentRing.children = [groupNode as any];

      useProjectStore.getState().setProject({
        format: "urania",
        version: "1.0.0",
        mechanismType: "volvelle",
        metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
        settings: { units: "pixels", canvasSize: { width: 800, height: 800 } },
        assets: [],
        mechanism: {
          id: "volvelle-root",
          type: "volvelle",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          children: [parentRing],
        },
      });

      const childNodesRestored = [
        { ...rectA, transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } },
        { ...rectB, transform: { x: 30, y: 30, rotation: 0, scaleX: 1, scaleY: 1 } },
      ];

      const ungroupCmd = new UngroupNodesCommand("group-1", "ring-group-test", childNodesRestored);
      useProjectStore.getState().executeCommand(ungroupCmd);

      let ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(2);
      expect(ringChildren[0].id).toBe("rect-a");
      expect(ringChildren[0].transform.x).toBe(10);
      expect(ringChildren[1].id).toBe("rect-b");

      // Undo
      useProjectStore.getState().undo();
      ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(1);
      expect(ringChildren[0].id).toBe("group-1");

      // Redo
      useProjectStore.getState().redo();
      ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(2);
    });
  });

  describe("ReorderRingsCommand", () => {
    it("should reorder rings in the mechanism children list and undo/redo correctly", () => {
      const ringA = createDummyRing("ring-a", "Ring A");
      const ringB = createDummyRing("ring-b", "Ring B");
      const ringC = createDummyRing("ring-c", "Ring C");

      useProjectStore.getState().setProject({
        format: "urania",
        version: "1.0.0",
        mechanismType: "volvelle",
        metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
        settings: { units: "pixels", canvasSize: { width: 800, height: 800 } },
        assets: [],
        mechanism: {
          id: "volvelle-root",
          type: "volvelle",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          children: [ringA, ringB, ringC],
        },
      });

      // Reorder element at index 0 (ringA) to index 2
      const cmd = new ReorderRingsCommand(0, 2);
      useProjectStore.getState().executeCommand(cmd);

      let children = useProjectStore.getState().project.mechanism.children || [];
      expect(children.map((c) => c.id)).toEqual(["ring-b", "ring-c", "ring-a"]);

      // Undo
      useProjectStore.getState().undo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect(children.map((c) => c.id)).toEqual(["ring-a", "ring-b", "ring-c"]);

      // Redo
      useProjectStore.getState().redo();
      children = useProjectStore.getState().project.mechanism.children || [];
      expect(children.map((c) => c.id)).toEqual(["ring-b", "ring-c", "ring-a"]);
    });
  });

  describe("BatchCommand", () => {
    it("should execute multiple sub-commands and undo/redo them in a single step", () => {
      const ring = createDummyRing("ring-1");
      useProjectStore.getState().setProject({
        ...useProjectStore.getState().project,
        mechanism: {
          ...useProjectStore.getState().project.mechanism,
          children: [ring],
        },
      });

      const nodeA = { id: "node-a", type: "rectangle", name: "A", visible: true, locked: false, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, width: 20, height: 20, style: {}, export: { artwork: true, cut: false, fold: false } };
      const nodeB = { id: "node-b", type: "rectangle", name: "B", visible: true, locked: false, transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 }, width: 20, height: 20, style: {}, export: { artwork: true, cut: false, fold: false } };

      const batch = new BatchCommand([
        new CreateNodeCommand("ring-1", nodeA as any),
        new CreateNodeCommand("ring-1", nodeB as any),
      ], "Symmetrical Placement");

      useProjectStore.getState().executeCommand(batch);

      // Past stack should only have 1 command (the batch)
      expect(useProjectStore.getState().past).toHaveLength(1);

      let ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(2);
      expect(ringChildren.map((c) => c.id)).toEqual(["node-a", "node-b"]);

      // A single undo step removes both nodes
      useProjectStore.getState().undo();
      expect(useProjectStore.getState().past).toHaveLength(0);
      expect(useProjectStore.getState().future).toHaveLength(1);

      ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(0);

      // A single redo step restores both nodes
      useProjectStore.getState().redo();
      expect(useProjectStore.getState().past).toHaveLength(1);
      ringChildren = useProjectStore.getState().project.mechanism.children![0].children!;
      expect(ringChildren).toHaveLength(2);
    });
  });
});

