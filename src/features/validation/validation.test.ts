import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { useValidationStore, repairDuplicateUUIDs } from "./validationStore";
import { validationRegistry } from "./validationRegistry";
import { UpdateNodeCommand } from "../project/commands";
import type { RingNode } from "../../shared/types/project";

describe("Validation System", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
  });

  it("should initialize registry with default core, geometry, and fabrication validators", () => {
    const validators = validationRegistry.getAllValidators();
    const ids = validators.map((v) => v.id);
    expect(ids).toContain("core-validator");
    expect(ids).toContain("geometry-validator");
    expect(ids).toContain("fabrication-validator");
  });

  it("should validate and identify duplicate UUIDs", () => {
    const project = useProjectStore.getState().project;
    const testNode = {
      id: "duplicate-id-123",
      type: "circle",
      name: "Circle A",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      radius: 50,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const duplicateNode = {
      id: "duplicate-id-123", // same ID
      type: "rectangle",
      name: "Rectangle B",
      visible: true,
      locked: false,
      transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 40,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: [testNode, duplicateNode],
      },
    };

    const issues = useValidationStore.getState().validateProject(updated);
    const duplicates = issues.filter((i) => i.code === "DUPLICATE_UUID");
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].severity).toBe("error");
    expect(duplicates[0].entityId).toBe("duplicate-id-123");
  });

  it("should validate geometric bounds (invalid inner/outer radii)", () => {
    const project = useProjectStore.getState().project;
    const invalidRing: RingNode = {
      id: "ring-invalid",
      type: "ring",
      name: "Invalid Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 150,
      outerRadius: 100, // smaller than inner
      rotation: 0,
      children: [],
    };

    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: [invalidRing],
      },
    };

    const issues = useValidationStore.getState().validateProject(updated);
    const errors = issues.filter((i) => i.code === "INVALID_RING_BAND");
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
  });

  it("should raise a warning for overlapping concentric ring bands", () => {
    const project = useProjectStore.getState().project;
    const ringA: RingNode = {
      id: "ring-a",
      type: "ring",
      name: "Ring A",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 100,
      outerRadius: 200,
      rotation: 0,
      children: [],
    };
    const ringB: RingNode = {
      id: "ring-b",
      type: "ring",
      name: "Ring B",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 150, // overlaps from 150 to 200
      outerRadius: 250,
      rotation: 0,
      children: [],
    };

    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: [ringA, ringB],
      },
    };

    const issues = useValidationStore.getState().validateProject(updated);
    const overlaps = issues.filter((i) => i.code === "RING_OVERLAP");
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].severity).toBe("warning");
  });

  it("should raise warning for fabrication thin bridges and small cutouts", () => {
    const project = useProjectStore.getState().project;
    const ring: RingNode = {
      id: "ring-base",
      type: "ring",
      name: "Cover Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 100,
      outerRadius: 200,
      rotation: 0,
      children: [
        // Window A too close to inner edge (d=112, r=10 -> inner edge=102, innerRadius=100, bridge=2px < 10px)
        {
          id: "win-a",
          type: "window",
          name: "Window A",
          visible: true,
          locked: false,
          transform: { x: 112, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: {},
          export: { artwork: false, cut: true, fold: false },
          shape: {
            id: "win-a-shape",
            type: "circle",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            style: {},
            export: { artwork: false, cut: true, fold: false },
            radius: 10,
          },
        } as any,
        // Window B: extremely small cutout (r=3px -> diameter=6px < 10px)
        {
          id: "win-b",
          type: "window",
          name: "Window B",
          visible: true,
          locked: false,
          transform: { x: 160, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: {},
          export: { artwork: false, cut: true, fold: false },
          shape: {
            id: "win-b-shape",
            type: "circle",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            style: {},
            export: { artwork: false, cut: true, fold: false },
            radius: 3,
          },
        } as any,
      ],
    };

    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: [ring],
      },
    };

    const issues = useValidationStore.getState().validateProject(updated);

    const thinBridges = issues.filter((i) => i.code === "FABRICATION_THIN_BRIDGE");
    expect(thinBridges.length).toBeGreaterThanOrEqual(1);

    const smallCutouts = issues.filter((i) => i.code === "FABRICATION_SMALL_CUTOUT");
    expect(smallCutouts).toHaveLength(1);
    expect(smallCutouts[0].message).toContain("extremely small");
  });

  it("should rollback a command and throw an error if it introduces a validation error", () => {
    // Create a ring with valid bounds
    const ringNode: RingNode = {
      id: "ring-test",
      type: "ring",
      name: "Ring Test",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 50,
      outerRadius: 100,
      rotation: 0,
      children: [],
    };

    useProjectStore.getState().setProject({
      ...createEmptyProject(),
      mechanism: {
        ...createEmptyProject().mechanism,
        children: [ringNode],
      },
    });

    const currentProject = useProjectStore.getState().project;
    const ringInTree = (currentProject.mechanism.children || [])[0] as RingNode;

    // Command to update the outerRadius to be smaller than the innerRadius (which is a validation error)
    const invalidRingNode = {
      ...ringInTree,
      outerRadius: 30, // 30 < 50 (innerRadius) -> INVALID_RING_BAND error
    };

    const command = new UpdateNodeCommand("ring-test", ringInTree, invalidRingNode);

    // Try executing the invalid command, it should fail and throw
    expect(() => useProjectStore.getState().executeCommand(command)).toThrow();

    // Verify it rolled back cleanly to the state before the command execution
    expect(useProjectStore.getState().project.mechanism.children?.[0]).toEqual(ringInTree);
    expect(useProjectStore.getState().past).toHaveLength(0);
  });

  it("should auto-repair duplicate UUIDs cleanly", () => {
    const duplicateId = "duplicate-id-123";
    const testNode = {
      id: duplicateId,
      type: "circle",
      name: "Circle A",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      radius: 50,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const duplicateNode = {
      id: duplicateId, // duplicate
      type: "rectangle",
      name: "Rectangle B",
      visible: true,
      locked: false,
      transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
      width: 40,
      height: 40,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const project = createEmptyProject();
    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: [testNode, duplicateNode],
      },
    };

    const repaired = repairDuplicateUUIDs(updated);

    // Verify duplicate ID is repaired to be unique
    const children = repaired.mechanism.children || [];
    expect(children).toHaveLength(2);
    expect(children[0].id).toBe(duplicateId);
    expect(children[1].id).not.toBe(duplicateId);
    expect(children[1].id).toBeDefined();
  });
});
