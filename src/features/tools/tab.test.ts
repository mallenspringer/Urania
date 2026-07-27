import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { selectTool } from "./selectTool";
import type { RingNode } from "../../shared/types/project";

describe("Top Hemisphere Auto-Generated Grab Tabs Gearing", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
  });

  it("should coordinate tab angles based on ring rotation value", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Outermost Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 100,
      outerRadius: 200,
      rotation: 0, // rotation is CW
      children: [],
    };

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
        children: [ring1],
      },
    });



    // CCW rotation corresponding to ring.rotation = 0 is 0.
    // tabAngle = -135 + ccwRot / 4.0 = -135
    // Let's verify ring rotation = 180 CW:
    // ccwRot = (360 - 180) % 360 = 180
    // tabAngle = -135 + 180 / 4 = -90 (middle of the upper Hemisphere!)
    
    const calculateTabAngle = (ringRot: number) => {
      const ccw = (360 - ringRot) % 360;
      return -135 + ccw / 4.0;
    };

    expect(calculateTabAngle(0)).toBe(-135);
    expect(calculateTabAngle(180)).toBe(-90);
    expect(calculateTabAngle(90)).toBe(-67.5);
    expect(calculateTabAngle(270)).toBe(-112.5);
  });

  it("should rotate ring counter-clockwise when tab slides clockwise from left to right", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 50,
      outerRadius: 150,
      rotation: 0,
      children: [],
    };

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
        children: [ring1],
      },
    });

    const project = useProjectStore.getState().project;

    // Simulate drag active on the tab of ring-1
    // Leftmost end starts at -135 degrees. If pointer is at -90 degrees (middle):
    const mockPreview = {
      isDraggingTab: true,
      targetRingId: "ring-1",
      startRingRotation: 0,
      originalNode: JSON.parse(JSON.stringify(ring1)),
      x1: -127.28, // cos(-135) * 180
      y1: -127.28, // sin(-135) * 180
    };

    const mockContext = {
      project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      activeRingId: null,
      pointerPos: { x: 0, y: -180 }, // exactly straight up (-90 degrees)
      startPos: { x: -127.28, y: -127.28 },
      executeCommand: () => {},
      updatePreview: () => {},
      currentPreviewData: mockPreview,
      isShift: false,
      isAlt: false,
    };

    selectTool.onMouseMove?.(null as any, mockContext as any);

    // CCW rotation: (-90 - (-135)) * 4.0 = 45 * 4.0 = 180.
    // CW rotation: (360 - 180) % 360 = 180.
    const updatedRing = useProjectStore.getState().project.mechanism.children![0] as RingNode;
    expect(updatedRing.rotation).toBeCloseTo(180, 1);
  });

  it("should stay at the right side of the arc when dragged past the end of the throw on the right side", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 50,
      outerRadius: 150,
      rotation: 0,
      children: [],
    };

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
        children: [ring1],
      },
    });

    const project = useProjectStore.getState().project;

    // Pointer is dragged to the far right, e.g. at 10 degrees (past the -45 degrees right clamp)
    const mockPreview = {
      isDraggingTab: true,
      targetRingId: "ring-1",
      startRingRotation: 0,
      originalNode: JSON.parse(JSON.stringify(ring1)),
      x1: -127.28,
      y1: -127.28,
    };

    const mockContext = {
      project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      activeRingId: null,
      pointerPos: { x: 180, y: 31.7 }, // ~10 degrees (positive, in lower-right hemisphere)
      startPos: { x: -127.28, y: -127.28 },
      executeCommand: () => {},
      updatePreview: () => {},
      currentPreviewData: mockPreview,
      isShift: false,
      isAlt: false,
    };

    selectTool.onMouseMove?.(null as any, mockContext as any);

    // Should clamp to -45 degrees.
    // CCW rotation: (-45 - (-135)) * 4.0 = 90 * 4.0 = 360 = 0.
    // CW rotation: 0.
    const updatedRing = useProjectStore.getState().project.mechanism.children![0] as RingNode;
    expect(updatedRing.rotation).toBeCloseTo(0, 1);
  });
});
