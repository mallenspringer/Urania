import { describe, it, expect } from "vitest";
import { createEmptyProject } from "../project/projectStore";
import { generateSVG, generateLayerFiles } from "./svgExporter";
import { generateInteractiveHTML, generateInteractiveZIP } from "./runtimeGenerator";
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

    it("should package developer bundle files in a ZIP archive", async () => {
      const project = getDummyProject();
      const blob = await generateInteractiveZIP(project, {
        bundleType: "zip",
        persistenceMode: "always-reset",
        controlStyle: "bare",
        theme: "light",
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe("application/zip");
    });
  });
});
