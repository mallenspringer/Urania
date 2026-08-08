import { describe, it, expect } from "vitest";
import { createEmptyProject } from "../project/projectStore";
import { generateSVG, generateLayerFiles, generateSheetLayoutSVG } from "./svgExporter";
import { generateInteractiveHTML, generateInteractiveZIP } from "./runtimeGenerator";
import { generateAssemblyGuideText, generateCraftPackageZIP } from "./craftPackageExporter";
import type { Project, RingNode } from "../../shared/types/project";

describe("Export Pipeline", () => {
  const getDummyProject = (): Project => {
    const project = createEmptyProject();
    project.metadata.name = "Test Calendar";
    
    // Add a dummy ring with a child element
    const ringNode: RingNode = {
      id: "ring-export-test",
      type: "ring",
      name: "Dials A",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 80,
      outerRadius: 180,
      rotation: 45,
      children: [
        {
          id: "circle-child",
          type: "circle",
          name: "Dot",
          visible: true,
          locked: false,
          transform: { x: 120, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          style: { fill: "#ffffff", stroke: "#000000", strokeWidth: 2 },
          export: { artwork: true, cut: true, fold: false },
          radius: 12,
        } as any
      ]
    };

    project.mechanism.children = [ringNode];
    return project;
  };

  describe("SVG Exporter", () => {
    it("should generate a valid SVG string containing layer groups", () => {
      const project = getDummyProject();
      const svg = generateSVG(project, {
        layer: "all",
        includeRegistrationMarks: true,
        includeAlignmentTicks: true,
        embedAssets: true,
      });

      expect(svg).toContain("<?xml");
      expect(svg).toContain("<svg");
      expect(svg).toContain('id="layer-artwork"');
      expect(svg).toContain('id="layer-cut"');
      expect(svg).toContain('id="layer-fold"');
      expect(svg).toContain('id="registration-marks"');
      expect(svg).toContain('id="alignment-ticks"');
    });

    it("should generate unrotated coordinates in groups with active rotation transforms", () => {
      const project = getDummyProject();
      const svg = generateSVG(project, {
        layer: "artwork",
        includeRegistrationMarks: false,
        includeAlignmentTicks: false,
        embedAssets: true,
      });

      // The ring group should apply rotation of 45 deg
      expect(svg).toContain('id="ring-group-ring-export-test"');
      expect(svg).toContain('transform="rotate(45)"');
      
      // The child's coordinates should be unrotated in local space (x: 120, y: 0)
      expect(svg).toContain('translate(120, 0)');
    });

    it("should output correct color overrides for cut paths", () => {
      const project = getDummyProject();
      const svg = generateSVG(project, {
        layer: "cut",
        includeRegistrationMarks: false,
        includeAlignmentTicks: false,
        embedAssets: true,
      });

      // Overwritten stroke to pure Red for cutting machines
      expect(svg).toContain('stroke="#FF0000"');
      // Circles are used for outlines in cut layer
      expect(svg).toContain('<circle');
    });

    it("should export separate layer files", () => {
      const project = getDummyProject();
      const files = generateLayerFiles(project, {
        layer: "all",
        includeRegistrationMarks: true,
        includeAlignmentTicks: true,
        embedAssets: true,
      });

      expect(files["artwork.svg"]).toBeDefined();
      expect(files["cut.svg"]).toBeDefined();
      expect(files["fold.svg"]).toBeDefined();
      expect(files["artwork.svg"]).toContain('id="layer-artwork"');
      expect(files["cut.svg"]).toContain('id="layer-cut"');
      expect(files["sheet-layout.svg"]).toBeDefined();
      expect(files["rings/dials-a.svg"]).toBeDefined();
    });

    it("should support exporting a single ring with selectedRingId", () => {
      const project = getDummyProject();
      const svg = generateSVG(project, {
        layer: "all",
        includeRegistrationMarks: true,
        includeAlignmentTicks: false,
        embedAssets: true,
        selectedRingId: "ring-export-test",
      });

      expect(svg).toContain('id="ring-group-ring-export-test"');
    });

    it("should generate unnested multi-ring sheet grid layout", () => {
      const project = getDummyProject();
      const sheetSvg = generateSheetLayoutSVG(project, {
        layer: "all",
        includeRegistrationMarks: true,
        includeAlignmentTicks: false,
        embedAssets: true,
      });

      expect(sheetSvg).toContain('id="sheet-ring-ring-export-test"');
      expect(sheetSvg).toContain('Dials A');
    });

    it("should format physical units and convert text elements when flags enabled", () => {
      const project = getDummyProject();
      project.settings.units = "millimeters";
      // Add text element to ring
      (project.mechanism.children[0] as any).children.push({
        id: "text-child",
        type: "text",
        name: "Label",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        content: "Sample Label",
        fontSize: 16,
        fontFamily: "sans-serif",
        export: { artwork: true, cut: false, fold: false },
      });

      const svg = generateSVG(project, {
        layer: "artwork",
        includeRegistrationMarks: false,
        includeAlignmentTicks: false,
        embedAssets: true,
        physicalUnits: true,
        convertTextToPaths: true,
      });

      expect(svg).toContain('width="3.17mm"');
      expect(svg).toContain('data-converted-to-path="true"');
    });
  });

  describe("Craft Package Exporter", () => {
    it("should auto-generate plain-text assembly guide with stack ordering and hardware specs", () => {
      const project = getDummyProject();
      const guideText = generateAssemblyGuideText(project);

      expect(guideText).toContain("URANIA PAPER ENGINEERING & CRAFT ASSEMBLY GUIDE");
      expect(guideText).toContain("Disc 01 [BOTTOM BASE DISC]");
      expect(guideText).toContain("1/8 inch (3 mm) Brass Brad");
      expect(guideText).toContain("RED (#FF0000): CUT OUTLINES");
      expect(guideText).toContain("BLUE (#0000FF): SCORE / FOLD LINES");
    });

    it("should generate a complete Maker Craft Package ZIP with structured folders", async () => {
      const project = getDummyProject();
      const blob = await generateCraftPackageZIP(project, {
        layer: "all",
        includeRegistrationMarks: true,
        includeAlignmentTicks: true,
        embedAssets: true,
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);

      const JSZip = (await import("jszip")).default;
      const arrayBuffer = await blob.arrayBuffer();
      const loadedZip = await JSZip.loadAsync(arrayBuffer);

      expect(loadedZip.file("00_ASSEMBLY_GUIDE.txt")).not.toBeNull();
      expect(loadedZip.file("00_full_assembly_preview.svg")).not.toBeNull();
      expect(loadedZip.file("00_print_and_cut_sheet_layout.svg")).not.toBeNull();
      expect(loadedZip.file("rings_individual/disc_01_dials_a_combined.svg")).not.toBeNull();
      expect(loadedZip.file("rings_individual/disc_01_dials_a_print_artwork.svg")).not.toBeNull();
      expect(loadedZip.file("rings_individual/disc_01_dials_a_cut_red.svg")).not.toBeNull();
      expect(loadedZip.file("machine_layers/layer_01_artwork_print.svg")).not.toBeNull();
      expect(loadedZip.file("machine_layers/layer_02_cut_outlines_red.svg")).not.toBeNull();
      expect(loadedZip.file("machine_layers/layer_03_score_lines_blue.svg")).not.toBeNull();
      expect(loadedZip.file("machine_layers/layer_04_combined_operations.svg")).not.toBeNull();
    });

    it("should exclude virtual control tabs and auto-grab-tabs from physical SVG exports", () => {
      const project = getDummyProject();
      // Add a virtual tab node
      project.mechanism.children.push({
        id: "vtab-1",
        type: "tab",
        name: "Virtual Tab 1",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: { x: 0, y: 0, width: 30, height: 20 },
        renderData: { tabShape: "semicircular" },
        export: { artwork: true, cut: false, fold: false },
      } as any);

      const svg = generateSVG(project, { layer: "all" });
      expect(svg).not.toContain('id="tab-control-vtab-1"');
      expect(svg).not.toContain('id="auto-grab-tabs"');
    });

    it("should render vector outlines for images based on machineRole", () => {
      const project = getDummyProject();
      project.assets = [
        { id: "img-asset-1", type: "png", name: "Test Image", embeddedData: "data:image/png;base64,123", width: 100, height: 100 },
      ];
      const testRing = project.mechanism.children[0];
      if (!testRing.children) testRing.children = [];

      // Add Image Node with machineRole = "plot"
      testRing.children.push({
        id: "img-plot-node",
        type: "image",
        name: "Plot Image",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: { x: 0, y: 0, width: 80, height: 80 },
        renderData: { assetId: "img-asset-1", width: 80, height: 80 },
        export: { artwork: true, cut: false, fold: false, machineRole: "plot" },
      } as any);

      // Add Image Node with machineRole = "cut"
      testRing.children.push({
        id: "img-cut-node",
        type: "image",
        name: "Cut Image",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        bounds: { x: 0, y: 0, width: 60, height: 60 },
        renderData: { assetId: "img-asset-1", width: 60, height: 60 },
        export: { artwork: false, cut: true, fold: false, machineRole: "cut" },
      } as any);

      const artworkSvg = generateSVG(project, { layer: "artwork" });
      expect(artworkSvg).toContain('<rect x="-40" y="-40" width="80" height="80"');
      expect(artworkSvg).toContain('stroke="#000000"');

      const cutSvg = generateSVG(project, { layer: "cut" });
      expect(cutSvg).toContain('<rect x="-30" y="-30" width="60" height="60"');
      expect(cutSvg).toContain('stroke="#FF0000"');
    });
  });

  describe("Interactive Web Exporter", () => {
    it("should generate a self-contained interactive HTML string", () => {
      const project = getDummyProject();
      const html = generateInteractiveHTML(project, {
        bundleType: "single",
        persistenceMode: "persist-reset",
        controlStyle: "with-controls",
        theme: "dark",
      });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<title>Test Calendar</title>");
      expect(html).toContain('class="volvelle-ring-group"');
      expect(html).toContain("function setRingRotation");
      expect(html).toContain("function getRingRotation");
      expect(html).toContain("localStorage.getItem");
    });

    it("should package modular developer bundle files in a ZIP archive", async () => {
      const project = getDummyProject();
      const blob = await generateInteractiveZIP(project, {
        bundleType: "zip",
        persistenceMode: "always-reset",
        controlStyle: "bare",
        theme: "light",
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);

      // Verify ZIP internal files using JSZip
      const JSZip = (await import("jszip")).default;
      const arrayBuffer = await blob.arrayBuffer();
      const loadedZip = await JSZip.loadAsync(arrayBuffer);

      expect(loadedZip.file("index.html")).not.toBeNull();
      expect(loadedZip.file("styles.css")).not.toBeNull();
      expect(loadedZip.file("runtime.js")).not.toBeNull();
      expect(loadedZip.file("runtime.json")).not.toBeNull();
      expect(loadedZip.file("project.json")).not.toBeNull();
      expect(loadedZip.file("manifest.json")).not.toBeNull();

      const manifestText = await loadedZip.file("manifest.json")?.async("string");
      expect(manifestText).toContain("interactive-web");
    });
  });
});



