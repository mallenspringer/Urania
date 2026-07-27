import { describe, it, expect } from "vitest";
import { ZODIAC_TEMPLATE, DIAGNOSTIC_3LAYER_TEMPLATE } from "./templateLibrary";
import { cloneProjectWithNewIds } from "./templateManager";

describe("Urania Template System Tests", () => {
  it("should successfully clone a template and assign template origin metadata", () => {
    const original = ZODIAC_TEMPLATE.project;
    const templateId = ZODIAC_TEMPLATE.manifest.id;
    const templateVersion = ZODIAC_TEMPLATE.manifest.version;

    const cloned = cloneProjectWithNewIds(original, templateId, templateVersion);

    expect(cloned.originTemplateId).toBe(templateId);
    expect(cloned.originTemplateVersion).toBe(templateVersion);
    expect(cloned.metadata.createdAt).not.toBe(original.metadata.createdAt);
  });

  it("should regenerate all node IDs recursively so that no cloned IDs equal original IDs", () => {
    const original = ZODIAC_TEMPLATE.project;
    const cloned = cloneProjectWithNewIds(original);

    // Verify root mechanism ID has changed
    expect(cloned.mechanism.id).not.toBe(original.mechanism.id);

    // Collect all IDs from original
    const originalIds: string[] = [];
    const collectIds = (node: any) => {
      if (node.id) originalIds.push(node.id);
      if (node.type === "window" && node.shape?.id) originalIds.push(node.shape.id);
      if (node.children) node.children.forEach(collectIds);
    };
    collectIds(original.mechanism);

    // Verify no IDs in the cloned project match any original IDs
    const verifyNewIds = (node: any) => {
      if (node.id) {
        expect(originalIds).not.toContain(node.id);
      }
      if (node.type === "window" && node.shape?.id) {
        expect(originalIds).not.toContain(node.shape.id);
      }
      if (node.children) {
        node.children.forEach(verifyNewIds);
      }
    };
    verifyNewIds(cloned.mechanism);
  });

  it("should preserve structural geometry (radii, sectors, styles) during cloning", () => {
    const original = ZODIAC_TEMPLATE.project;
    const cloned = cloneProjectWithNewIds(original);

    // Check canvas settings
    expect(cloned.settings.canvasSize.width).toBe(original.settings.canvasSize.width);
    expect(cloned.settings.canvasSize.height).toBe(original.settings.canvasSize.height);

    // Verify ring structures (e.g. number of rings, radii)
    const origRings = (original.mechanism.children || []).filter(c => c.type === "ring");
    const cloneRings = (cloned.mechanism.children || []).filter(c => c.type === "ring");

    expect(cloneRings.length).toBe(origRings.length);
    expect((cloneRings[0] as any).innerRadius).toBe((origRings[0] as any).innerRadius);
    expect((cloneRings[0] as any).outerRadius).toBe((origRings[0] as any).outerRadius);
  });

  it("should successfully clone and resolve the DIAGNOSTIC_3LAYER_TEMPLATE", () => {
    const original = DIAGNOSTIC_3LAYER_TEMPLATE.project;
    const cloned = cloneProjectWithNewIds(original, DIAGNOSTIC_3LAYER_TEMPLATE.manifest.id, 1);

    expect(cloned.originTemplateId).toBe("3-layer-diagnostic-test");
    const rings = (cloned.mechanism.children || []).filter((c) => c.type === "ring");
    expect(rings.length).toBe(3);
    expect((rings[0] as any).outerRadius).toBe(220); // Red base
    expect((rings[1] as any).outerRadius).toBe(210); // Green middle
    expect((rings[2] as any).outerRadius).toBe(200); // Blue top
  });
});
