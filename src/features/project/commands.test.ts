import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "./projectStore";
import {
  CreateRingCommand,
  DeleteRingCommand,
  RotateRingCommand,
  UpdateNodeCommand,
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
      expect(useProjectStore.getState().past).toHaveLength(100);
    });
  });
});
