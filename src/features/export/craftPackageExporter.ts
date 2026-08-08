import type { Project } from "../../shared/types/project";
import { generateSVG, generateSheetLayoutSVG, type SVGExportOptions } from "./svgExporter";
import { fromPixels, getUnitSymbol } from "../../shared/utils/unitConversion";
import JSZip from "jszip";

/**
 * Auto-generates a plain-text assembly guide detailing ring stacking order,
 * disc dimensions, hardware fastener specs, and machine color standards.
 */
export function generateAssemblyGuideText(project: Project): string {
  const rings = (project.mechanism.children || []).filter((c: any) => c.type === "ring") as any[];
  const unit = project.settings?.units || "millimeters";
  const unitSymbol = getUnitSymbol(unit);
  const title = project.metadata.name || "Urania Volvelle Mechanism";
  const description = project.metadata.description || "Custom paper-engineered volvelle device.";
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let guide = `====================================================================
URANIA PAPER ENGINEERING & CRAFT ASSEMBLY GUIDE
====================================================================
Project Title: ${title}
Description: ${description}
Generated On: ${dateStr}
Total Discs / Rings: ${rings.length}
Target Unit: ${unit} (${unitSymbol})
====================================================================

1. HARDWARE & MATERIAL SPECIFICATIONS
--------------------------------------------------------------------
- Center Fastener: Standard 1/8 inch (3 mm) Brass Brad, Split Pin, or Eyelet.
- Paper Stock: 80 lb to 110 lb Cardstock (200 - 300 GSM) recommended.
- Brad Hole Diameter: 3.0 mm (0.12 in) — pre-cut in all disc centers.

2. MACHINE COLOR-CODING STANDARDS
--------------------------------------------------------------------
If uploading SVG files to Cricut Design Space, Glowforge, LightBurn, or Silhouette:

- RED (#FF0000): CUT OUTLINES
  * Disc perimeters, window cutouts, and center brad holes.
  * Set machine operation to CUT.

- BLUE (#0000FF): SCORE / FOLD LINES
  * Dashed lines and score tracks for tabs and alignment.
  * Set machine operation to SCORE or PEN.

- BLACK / COLORED FILLS: ARTWORK / PRINT / ENGRAVE
  * Printed illustrations, text labels, and background graphics.
  * Set machine operation to PRINT-THEN-CUT or ENGRAVE.

3. PHYSICAL DISC STACKING ORDER (BOTTOM TO TOP)
--------------------------------------------------------------------
Assemble discs from Disc 01 at the very bottom to Disc ${String(rings.length).padStart(2, "0")} at the top cover:

`;

  rings.forEach((ring, idx) => {
    const discNum = String(idx + 1).padStart(2, "0");
    const isBottom = idx === 0;
    const isTop = idx === rings.length - 1;
    const role = isBottom ? "BOTTOM BASE DISC" : isTop ? "TOP COVER DISC" : "MIDDLE INTERMEDIATE DISC";

    const outerR = fromPixels(ring.outerRadius || 100, unit).toFixed(1);
    const innerR = (ring.innerRadius || 0) > 0 ? fromPixels(ring.innerRadius, unit).toFixed(1) : "Solid Center";
    const outerDiam = (fromPixels(ring.outerRadius || 100, unit) * 2).toFixed(1);

    guide += `Disc ${discNum} [${role}]
  - Name: "${ring.name || `Ring ${idx + 1}`}"
  - File: "rings_individual/disc_${discNum}_${(ring.name || `ring_${idx + 1}`).toLowerCase().replace(/\s+/g, "_")}.svg"
  - Outer Diameter: ${outerDiam} ${unitSymbol} (Radius: ${outerR} ${unitSymbol})
  - Center Region: ${innerR === "Solid Center" ? "Solid disc with 3mm brad hole" : `Hollow inner ring (${innerR} ${unitSymbol} inner radius)`}
  ------------------------------------------------------------------
`;
  });

  guide += `
4. STEP-BY-STEP ASSEMBLY INSTRUCTIONS
--------------------------------------------------------------------
Step 1: Print artwork graphics on cardstock using 'layer_01_artwork_print.svg' or individual disc files.
Step 2: Cut outer perimeters and window openings using your cutting machine or X-Acto knife.
Step 3: Lay Disc 01 (Bottom Base) flat on your workspace facing upward.
Step 4: Stack Disc 02 through Disc ${String(rings.length).padStart(2, "0")} sequentially over Disc 01.
Step 5: Insert the 1/8" (3mm) brass brad through the center hole from top to bottom.
Step 6: Flatten the split pin legs on the back side of Disc 01 to secure the assembly.
Step 7: Test rotation of each disc using side grab tabs or outer disc edges.

====================================================================
Designed and Published with Urania Paper Engineering Platform
====================================================================
`;

  return guide;
}

/**
 * Generates a complete Maker Archive ZIP package (.zip) containing:
 * - 00_ASSEMBLY_GUIDE.txt
 * - 00_full_assembly_preview.svg
 * - 00_print_and_cut_sheet_layout.svg
 * - rings_individual/ (disc_01_..., disc_02_...)
 * - machine_layers/ (layer_01_artwork_print, layer_02_cut_outlines_red, etc.)
 */
export async function generateCraftPackageZIP(project: Project, options: SVGExportOptions): Promise<Blob> {
  const zip = new JSZip();

  // 1. 00_ASSEMBLY_GUIDE.txt
  const assemblyGuideText = generateAssemblyGuideText(project);
  zip.file("00_ASSEMBLY_GUIDE.txt", assemblyGuideText);

  // 2. 00_full_assembly_preview.svg
  const fullPreviewSvg = generateSVG(project, {
    ...options,
    layer: "all",
    includeRegistrationMarks: true,
    includeAlignmentTicks: true,
  });
  zip.file("00_full_assembly_preview.svg", fullPreviewSvg);

  // 3. 00_print_and_cut_sheet_layout.svg
  const sheetLayoutSvg = generateSheetLayoutSVG(project, {
    ...options,
    layer: "all",
    includeRegistrationMarks: true,
    includeAlignmentTicks: true,
  });
  zip.file("00_print_and_cut_sheet_layout.svg", sheetLayoutSvg);

  // 4. rings_individual/ (sequenced per-disc operation files)
  const ringsFolder = zip.folder("rings_individual");
  const rings = (project.mechanism.children || []).filter((c: any) => c.type === "ring") as any[];

  rings.forEach((ring, idx) => {
    const discNum = String(idx + 1).padStart(2, "0");
    const safeName = (ring.name || `ring_${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "_");

    // Combined operation file (Artwork + Cut + Registration)
    const combinedSvg = generateSVG(project, {
      ...options,
      layer: "all",
      selectedRingId: ring.id,
      includeRegistrationMarks: true,
      includeAlignmentTicks: false,
    });

    // Print artwork only file
    const printSvg = generateSVG(project, {
      ...options,
      layer: "artwork",
      selectedRingId: ring.id,
      includeRegistrationMarks: false,
      includeAlignmentTicks: false,
    });

    // Red cut outlines only file
    const cutSvg = generateSVG(project, {
      ...options,
      layer: "cut",
      selectedRingId: ring.id,
      includeRegistrationMarks: true,
      includeAlignmentTicks: false,
    });

    if (ringsFolder) {
      ringsFolder.file(`disc_${discNum}_${safeName}_combined.svg`, combinedSvg);
      ringsFolder.file(`disc_${discNum}_${safeName}_print_artwork.svg`, printSvg);
      ringsFolder.file(`disc_${discNum}_${safeName}_cut_red.svg`, cutSvg);
    }
  });

  // 5. machine_layers/ (color-coded vector operation files for unnested sheet layout)
  const machineFolder = zip.folder("machine_layers");
  if (machineFolder) {
    // layer_01_artwork_print.svg
    const artworkSvg = generateSheetLayoutSVG(project, {
      ...options,
      layer: "artwork",
      includeRegistrationMarks: false,
      includeAlignmentTicks: false,
    });
    machineFolder.file("layer_01_artwork_print.svg", artworkSvg);

    // layer_02_cut_outlines_red.svg
    const cutSvg = generateSheetLayoutSVG(project, {
      ...options,
      layer: "cut",
      includeRegistrationMarks: true,
      includeAlignmentTicks: false,
    });
    machineFolder.file("layer_02_cut_outlines_red.svg", cutSvg);

    // layer_03_score_lines_blue.svg
    const scoreSvg = generateSheetLayoutSVG(project, {
      ...options,
      layer: "fold",
      includeRegistrationMarks: false,
      includeAlignmentTicks: false,
    });
    machineFolder.file("layer_03_score_lines_blue.svg", scoreSvg);

    // layer_04_combined_operations.svg
    const combinedSvg = generateSheetLayoutSVG(project, {
      ...options,
      layer: "all",
      includeRegistrationMarks: true,
      includeAlignmentTicks: true,
    });
    machineFolder.file("layer_04_combined_operations.svg", combinedSvg);
  }

  return await zip.generateAsync({ type: "blob" });
}
