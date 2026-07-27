import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { CreateNodeCommand } from "../project/commands";
import type { ImageNode } from "../../shared/types/project";
import { selectTool } from "./selectTool";

describe("Image Node Placement & Asset Embedding", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
  });

  it("should support adding image nodes associated with assets and undo/redo correctly", () => {
    const project = useProjectStore.getState().project;

    // Simulate adding an asset
    const assetId = "test-asset-123";
    const dummyAsset = {
      id: assetId,
      type: "image" as const,
      mimeType: "image/png",
      embeddedData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    };

    useProjectStore.getState().setProject({
      ...project,
      assets: [dummyAsset],
    });

    // Create ImageNode
    const imageNode: ImageNode = {
      id: "test-image-node",
      type: "image",
      name: "My Image",
      visible: true,
      locked: false,
      transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
      assetId: assetId,
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const targetParentId = project.mechanism.id;
    const cmd = new CreateNodeCommand(targetParentId, imageNode);
    useProjectStore.getState().executeCommand(cmd);

    // Verify addition
    let mechanismChildren = useProjectStore.getState().project.mechanism.children || [];
    expect(mechanismChildren).toHaveLength(1);
    expect(mechanismChildren[0].id).toBe("test-image-node");
    expect((mechanismChildren[0] as ImageNode).assetId).toBe(assetId);

    // Verify undo
    useProjectStore.getState().undo();
    mechanismChildren = useProjectStore.getState().project.mechanism.children || [];
    expect(mechanismChildren).toHaveLength(0);

    // Verify redo
    useProjectStore.getState().redo();
    mechanismChildren = useProjectStore.getState().project.mechanism.children || [];
    expect(mechanismChildren).toHaveLength(1);
  });

  it("should resize and stretch image nodes correctly via Cartesian select tool handles", () => {
    const assetId = "test-asset-123";
    const imageNode: ImageNode = {
      id: "test-image-node",
      type: "image",
      name: "My Image",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      assetId: assetId,
      width: 100,
      height: 100,
      style: {},
      export: { artwork: true, cut: false, fold: false },
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
        children: [imageNode],
      },
    });

    const project = useProjectStore.getState().project;

    // Simulate resizing start state in preview data (bottom-right handle drag)
    const mockPreview = {
      isResizing: true,
      nodeId: "test-image-node",
      nodeType: "image",
      handle: "bottom-right",
      originalNode: JSON.parse(JSON.stringify(imageNode)),
      x1: 50,
      y1: 50,
    };

    const mockContext = {
      project,
      zoom: 1,
      pan: { x: 0, y: 0 },
      stageWidth: 800,
      stageHeight: 800,
      activeRingId: null,
      pointerPos: { x: 100, y: 100 },
      startPos: { x: 50, y: 50 },
      executeCommand: () => {},
      updatePreview: () => {},
      currentPreviewData: mockPreview,
      isShift: false,
      isAlt: false,
    };

    selectTool.onMouseMove?.(null as any, mockContext as any);

    // Verify coordinates resized width and height
    const updated = useProjectStore.getState().project.mechanism.children![0] as ImageNode;
    expect(updated.width).toBeGreaterThan(100);
    expect(updated.height).toBeGreaterThan(100);
  });
});
