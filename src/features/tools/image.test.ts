import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { CreateNodeCommand } from "../project/commands";
import type { ImageNode } from "../../shared/types/project";
import { selectTool } from "./selectTool";
import { resolveProject } from "../runtime/mechanismEngine";
import { generateSVG } from "../export/svgExporter";

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

  it("should support non-destructive image cropping and SVG viewBox export parity", () => {
    const assetId = "test-crop-asset";
    const dummyAsset = {
      id: assetId,
      type: "image" as const,
      mimeType: "image/png",
      embeddedData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    };

    const baseProject = createEmptyProject();

    const imageNode: ImageNode = {
      id: "cropped-image-node",
      type: "image",
      name: "Cropped Photo",
      visible: true,
      locked: false,
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      assetId,
      width: 150,
      height: 100,
      crop: { x: 50, y: 50, width: 300, height: 200 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const ringNode = {
      id: "ring-crop-test",
      type: "ring" as const,
      name: "Base Ring",
      visible: true,
      locked: false,
      innerRadius: 0,
      outerRadius: 200,
      rotation: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      children: [imageNode as any],
    };

    baseProject.mechanism.children = [ringNode as any];
    baseProject.assets = [dummyAsset];

    useProjectStore.getState().setProject(baseProject);

    const project = useProjectStore.getState().project;

    // 1. Verify engine resolution forwards crop parameter
    const resolved = resolveProject(project);
    const resolvedImage = resolved.find((n: any) => n.id === "cropped-image-node");
    expect(resolvedImage).toBeDefined();
    expect(resolvedImage.renderData.crop).toEqual({ x: 50, y: 50, width: 300, height: 200 });

    // 2. Verify SVG export renders viewBox crop container
    const svgResult = generateSVG(project, {
      layer: "artwork",
      includeRegistrationMarks: false,
      includeAlignmentTicks: false,
      embedAssets: true,
    });

    expect(svgResult).toContain('viewBox="50 50 300 200"');
    expect(svgResult).toContain('<image href="data:image/png;base64');
  });

  it("should support Circle and Radial Trapezoid crop shapes in SVG export", () => {
    const assetId = "test-crop-shapes-asset";
    const dummyAsset = {
      id: assetId,
      type: "image" as const,
      mimeType: "image/png",
      embeddedData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    };

    const circleCroppedNode: ImageNode = {
      id: "circle-cropped-node",
      type: "image",
      name: "Circle Cropped Photo",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      assetId,
      width: 100,
      height: 100,
      crop: { shape: "circle", x: 0, y: 0, width: 200, height: 200, radius: 45 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const radialCroppedNode: ImageNode = {
      id: "radial-cropped-node",
      type: "image",
      name: "Radial Cropped Photo",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      assetId,
      width: 100,
      height: 100,
      crop: { shape: "radialTrapezoid", x: 0, y: 0, width: 200, height: 200, innerRadius: 20, outerRadius: 80, sweepAngle: 45 },
      style: {},
      export: { artwork: true, cut: false, fold: false },
    };

    const baseProject = createEmptyProject();
    const ringNode = {
      id: "ring-shapes-test",
      type: "ring" as const,
      name: "Base Ring",
      visible: true,
      locked: false,
      innerRadius: 0,
      outerRadius: 200,
      rotation: 0,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      children: [circleCroppedNode as any, radialCroppedNode as any],
    };

    baseProject.mechanism.children = [ringNode as any];
    baseProject.assets = [dummyAsset];

    useProjectStore.getState().setProject(baseProject);
    const project = useProjectStore.getState().project;

    const svgResult = generateSVG(project, {
      layer: "artwork",
      includeRegistrationMarks: false,
      includeAlignmentTicks: false,
      embedAssets: true,
    });

    // Verify SVG contains circle clipPath definition
    expect(svgResult).toContain('<clipPath id="crop-circle-circle-cropped-node"><circle cx="0" cy="0" r="45" /></clipPath>');

    // Verify SVG contains radial trapezoid clipPath definition
    expect(svgResult).toContain('<clipPath id="crop-radial-radial-cropped-node"><path d="M');
  });
});
