import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore, createEmptyProject } from "../project/projectStore";
import { CreateNodeCommand } from "../project/commands";
import { resolveProject } from "../runtime/mechanismEngine";
import { generateSVG } from "../export/svgExporter";
import { fabricationValidator } from "../validation/validators/fabricationValidator";
import { toolRegistry } from "./toolRegistry";
import type { RingNode, DiscTabNode } from "../../shared/types/project";

describe("Disc-Attached Tabs Feature", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(createEmptyProject());
    useProjectStore.getState().clearHistory();
  });

  it("should register discTabTool in toolRegistry", () => {
    const tool = toolRegistry.getTool("create-discTab");
    expect(tool).toBeDefined();
    expect(tool?.label).toBe("Disc Tab");
    expect(tool?.category).toBe("shapes");
  });

  it("should add a DiscTabNode to a ring and resolve its world transform and bounds", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Main Ring",
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

    const discTab: DiscTabNode = {
      id: "tab-1",
      type: "discTab",
      name: "Disc Tab 1",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: { fill: "#6366f1", stroke: "#3730a3", strokeWidth: 1.5 },
      export: { artwork: true, cut: true, fold: false },
      angle: 90,
      edge: "outer",
      width: 30,
      height: 20,
      cornerRadius: 4,
      tabShape: "semicircular",
      label: "PUSH",
    };

    const cmd = new CreateNodeCommand("ring-1", discTab);
    useProjectStore.getState().executeCommand(cmd);

    const project = useProjectStore.getState().project;
    const resRing = project.mechanism.children![0] as RingNode;
    expect(resRing.children.length).toBe(1);
    expect(resRing.children[0].id).toBe("tab-1");

    // Check runtime resolution
    const resolvedNodes = resolveProject(project);
    const resolvedTab = resolvedNodes.find((n) => n.id === "tab-1");
    expect(resolvedTab).toBeDefined();
    expect(resolvedTab?.type).toBe("discTab");
    expect(resolvedTab?.renderData.angle).toBe(90);
    expect(resolvedTab?.renderData.outerRadius).toBe(150);

    // World transform check: at angle=90° (straight down in 2D Y-down cartesian, x ≈ 0, y ≈ 150)
    expect(resolvedTab?.worldTransform.x).toBeCloseTo(0, 1);
    expect(resolvedTab?.worldTransform.y).toBeCloseTo(150, 1);
  });

  it("should generate unified SVG cut path merging the ring outer circle with disc tab bumps", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Main Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 40,
      outerRadius: 100,
      rotation: 0,
      children: [
        {
          id: "tab-1",
          type: "discTab",
          name: "Tab 1",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { fill: "#6366f1", stroke: "#3730a3", strokeWidth: 1.5 },
          export: { artwork: true, cut: true, fold: false },
          angle: 0,
          edge: "outer",
          width: 30,
          height: 15,
          cornerRadius: 4,
          tabShape: "semicircular",
        },
      ],
    };

    const project = {
      format: "urania" as const,
      version: "1.0.0",
      mechanismType: "volvelle" as const,
      metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
      settings: { units: "pixels" as const, canvasSize: { width: 800, height: 800 } },
      assets: [],
      mechanism: {
        id: "volvelle-root",
        type: "volvelle" as const,
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [ring1],
      },
    };

    const cutSvg = generateSVG(project, { layer: "cut", embedAssets: true, includeRegistrationMarks: false, includeAlignmentTicks: false });
    expect(cutSvg).toContain("<path d=");
    // Should include path with tab bump parameters (peak radius 100 + 15 = 115)
    expect(cutSvg).toContain("115.00");
  });

  it("should trigger validation warning when two disc tabs overlap angularly on the same ring", () => {
    const ring1: RingNode = {
      id: "ring-1",
      type: "ring",
      name: "Main Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 40,
      outerRadius: 100,
      rotation: 0,
      children: [
        {
          id: "tab-1",
          type: "discTab",
          name: "Tab 1",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: {},
          export: { artwork: true, cut: true, fold: false },
          angle: 45,
          edge: "outer",
          width: 40,
          height: 15,
          cornerRadius: 4,
          tabShape: "semicircular",
        },
        {
          id: "tab-2",
          type: "discTab",
          name: "Tab 2",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: {},
          export: { artwork: true, cut: true, fold: false },
          angle: 50, // overlaps with tab-1 (span is ~23 degrees each)
          edge: "outer",
          width: 40,
          height: 15,
          cornerRadius: 4,
          tabShape: "semicircular",
        },
      ],
    };

    const project = {
      format: "urania" as const,
      version: "1.0.0",
      mechanismType: "volvelle" as const,
      metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
      settings: { units: "pixels" as const, canvasSize: { width: 800, height: 800 } },
      assets: [],
      mechanism: {
        id: "volvelle-root",
        type: "volvelle" as const,
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [ring1],
      },
    };

    const issues = fabricationValidator.validate(project);
    const overlapIssue = issues.find((i) => i.code === "FABRICATION_DISC_TAB_OVERLAP");
    expect(overlapIssue).toBeDefined();
    expect(overlapIssue?.message).toContain("overlap angularly");
  });

  it("should attach discTab to the flat edge of a polygonal disc shape", () => {
    const polyRing: RingNode = {
      id: "ring-poly",
      type: "ring",
      name: "Hexagon Ring",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 40,
      outerRadius: 100,
      ringShape: "polygon",
      polygonSides: 6,
      rotation: 0,
      children: [
        {
          id: "tab-poly",
          type: "discTab",
          name: "Edge Tab",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: {},
          export: { artwork: true, cut: true, fold: false },
          angle: 0,
          edge: "outer",
          width: 30,
          height: 15,
          cornerRadius: 4,
          tabShape: "semicircular",
        },
      ],
    };

    const project = {
      format: "urania" as const,
      version: "1.0.0",
      mechanismType: "volvelle" as const,
      metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
      settings: { units: "pixels" as const, canvasSize: { width: 800, height: 800 } },
      assets: [],
      mechanism: {
        id: "volvelle-root",
        type: "volvelle" as const,
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [polyRing],
      },
    };

    const resolvedNodes = resolveProject(project);
    const resTab = resolvedNodes.find((n) => n.id === "tab-poly");
    expect(resTab).toBeDefined();
    expect(resTab?.worldTransform.x).toBeCloseTo(86.6, 1);
    expect(resTab?.worldTransform.y).toBeCloseTo(0, 1);
  });

  it("should adjust discTab attachment and normal angle when polygon disc has edgeCurvature (concavity/convexity)", () => {
    const curvedPolyRing: RingNode = {
      id: "ring-curved-poly",
      type: "ring",
      name: "Convex Hexagon",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 40,
      outerRadius: 100,
      ringShape: "polygon",
      polygonSides: 6,
      edgeCurvature: 0.5,
      rotation: 0,
      children: [
        {
          id: "tab-curved",
          type: "discTab",
          name: "Curved Edge Tab",
          visible: true,
          locked: false,
          transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: {},
          export: { artwork: true, cut: true, fold: false },
          angle: 0,
          edge: "outer",
          width: 30,
          height: 15,
          cornerRadius: 4,
          tabShape: "semicircular",
        },
      ],
    };

    const project = {
      format: "urania" as const,
      version: "1.0.0",
      mechanismType: "volvelle" as const,
      metadata: { name: "Test", author: "A", description: "D", createdAt: "", updatedAt: "" },
      settings: { units: "pixels" as const, canvasSize: { width: 800, height: 800 } },
      assets: [],
      mechanism: {
        id: "volvelle-root",
        type: "volvelle" as const,
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        children: [curvedPolyRing],
      },
    };

    const resolvedNodes = resolveProject(project);
    const resTab = resolvedNodes.find((n) => n.id === "tab-curved");
    expect(resTab).toBeDefined();
    expect(resTab?.worldTransform.x).toBeGreaterThan(86.6);
  });
});
