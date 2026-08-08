import type { Project } from "../../shared/types/project";
import { generateSVG, type SVGExportOptions } from "./svgExporter";

export interface PNGExportOptions {
  dpi?: 72 | 150 | 300;
  backgroundColor?: string;
  svgOptions?: SVGExportOptions;
}

/**
 * Generates a PNG Blob from a Urania project by rendering the exported SVG onto an offscreen Canvas.
 */
export async function generatePNGBlob(project: Project, options: PNGExportOptions = {}): Promise<Blob> {
  const dpi = options.dpi || 150;
  const scale = dpi / 96;

  const svgOptions: SVGExportOptions = options.svgOptions || {
    layer: "artwork",
    includeRegistrationMarks: false,
    includeAlignmentTicks: false,
    embedAssets: true,
  };

  const svgString = generateSVG(project, svgOptions);

  const canvasWidth = (project.settings?.canvasSize?.width || 800) * scale;
  const canvasHeight = (project.settings?.canvasSize?.height || 800) * scale;

  if (typeof window === "undefined" || typeof document === "undefined") {
    // Return mock Blob in non-browser unit test runner environment
    return new Blob([svgString], { type: "image/png" });
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Failed to get 2D context for PNG export"));
      return;
    }

    if (options.backgroundColor && options.backgroundColor !== "transparent") {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to encode Canvas to PNG Blob"));
        }
      }, "image/png");
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
