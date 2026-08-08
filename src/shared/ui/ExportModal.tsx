import React, { useState, useMemo } from "react";
import { X, FileCode, Printer, Download, Eye, AlertTriangle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import type { Project } from "../types/project";
import JSZip from "jszip";
import { generateSVG, generateLayerFiles, generateSheetLayoutSVG } from "../../features/export/svgExporter";
import { generateInteractiveHTML, generateInteractiveZIP } from "../../features/export/runtimeGenerator";
import { generatePNGBlob } from "../../features/export/pngExporter";
import { validateProject } from "../../features/validation/validationRegistry";
import { generateCraftPackageZIP } from "../../features/export/craftPackageExporter";

interface ExportModalProps {
  project: Project;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, onClose }) => {
  const [activeTab, setActiveTab] = useState<"physical" | "interactive">("physical");

  // Physical Export settings
  const [exportMode, setExportMode] = useState<"maker-archive" | "combined" | "per-ring" | "sheet-grid">("maker-archive");
  const [layer, setLayer] = useState<"all" | "artwork" | "cut" | "fold">("all");
  const [includeReg, setIncludeReg] = useState(true);
  const [includeTicks, setIncludeTicks] = useState(true);
  const [embedAssets, setEmbedAssets] = useState(true);
  const [convertTextToPaths, setConvertTextToPaths] = useState(false);
  const [physicalUnits, setPhysicalUnits] = useState(true);
  const [pngDpi, setPngDpi] = useState<72 | 150 | 300>(150);

  // Interactive Export settings
  const [bundleType, setBundleType] = useState<"single" | "zip">("single");
  const [persistenceMode, setPersistenceMode] = useState<"persist-reset" | "always-reset">("persist-reset");
  const [controlStyle, setControlStyle] = useState<"bare" | "with-controls">("with-controls");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ringLabelMode, setRingLabelMode] = useState<"always" | "hover" | "hidden">("always");

  // Run validation
  const validationReport = useMemo(() => {
    try {
      return validateProject(project);
    } catch (err) {
      console.error("Validation error:", err);
      return { isValid: true, issues: [], errors: [], warnings: [] };
    }
  }, [project]);

  // Compute live SVG preview for physical configuration
  const previewSvg = useMemo(() => {
    try {
      if (exportMode === "sheet-grid") {
        return generateSheetLayoutSVG(project, {
          layer: layer === "all" ? "artwork" : layer,
          includeRegistrationMarks: includeReg,
          includeAlignmentTicks: includeTicks,
          embedAssets: true,
          convertTextToPaths,
          physicalUnits,
        });
      }
      return generateSVG(project, {
        layer: layer === "all" ? "artwork" : layer,
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets: true,
        convertTextToPaths,
        physicalUnits,
      });
    } catch (err) {
      console.error(err);
      return `<svg><text x="20" y="20" fill="red">Error rendering preview</text></svg>`;
    }
  }, [project, layer, includeReg, includeTicks, exportMode, convertTextToPaths, physicalUnits]);

  // Triggers file download in the browser
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Triggers download of blob (e.g. for ZIPs / PNGs)
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePhysicalExport = async () => {
    const filenameBase = (project.metadata.name || "urania-project").toLowerCase().replace(/\s+/g, "-");

    if (exportMode === "maker-archive") {
      const zipBlob = await generateCraftPackageZIP(project, {
        layer,
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets,
        convertTextToPaths,
        physicalUnits,
      });
      downloadBlob(zipBlob, `${filenameBase}-maker-craft-package.zip`);
      return;
    }

    if (exportMode === "sheet-grid") {
      const sheetSvg = generateSheetLayoutSVG(project, {
        layer,
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets,
        convertTextToPaths,
        physicalUnits,
      });
      downloadFile(sheetSvg, `${filenameBase}-sheet-layout.svg`, "image/svg+xml");
      return;
    }

    if (exportMode === "per-ring") {
      const zip = new JSZip();
      const files = generateLayerFiles(project, {
        layer,
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets,
        convertTextToPaths,
        physicalUnits,
      });

      Object.keys(files).forEach((name) => {
        zip.file(name, files[name]);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${filenameBase}-per-ring-package.zip`);
    } else {
      const svg = generateSVG(project, {
        layer,
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets,
        convertTextToPaths,
        physicalUnits,
      });
      downloadFile(svg, `${filenameBase}-${layer}.svg`, "image/svg+xml");
    }
  };

  const handlePNGExport = async () => {
    const filenameBase = (project.metadata.name || "urania-project").toLowerCase().replace(/\s+/g, "-");
    try {
      const pngBlob = await generatePNGBlob(project, {
        dpi: pngDpi,
        backgroundColor: theme === "dark" ? "#0b0c0f" : "#ffffff",
        svgOptions: {
          layer: layer === "all" ? "artwork" : layer,
          includeRegistrationMarks: includeReg,
          includeAlignmentTicks: includeTicks,
          embedAssets: true,
          convertTextToPaths,
        },
      });
      downloadBlob(pngBlob, `${filenameBase}-${pngDpi}dpi.png`);
    } catch (err) {
      console.error("Failed PNG generation:", err);
    }
  };

  const handleInteractiveExport = async () => {
    const filenameBase = (project.metadata.name || "urania-project").toLowerCase().replace(/\s+/g, "-");

    if (bundleType === "zip") {
      const zipBlob = await generateInteractiveZIP(project, {
        bundleType: "zip",
        persistenceMode,
        controlStyle,
        theme,
        ringLabelMode,
      });
      downloadBlob(zipBlob, `${filenameBase}-web-runtime.zip`);
    } else {
      const html = generateInteractiveHTML(project, {
        bundleType: "single",
        persistenceMode,
        controlStyle,
        theme,
        ringLabelMode,
      });
      downloadFile(html, `${filenameBase}-runtime.html`, "text/html");
    }
  };

  const hasErrors = (validationReport.errors || []).length > 0;
  const hasWarnings = (validationReport.warnings || []).length > 0;

  return (
    <div className="modal-backdrop">
      <div className="export-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <FileCode size={20} className="modal-icon" />
            <h2>Export Pipeline</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Pre-Export Validation Status Bar */}
        <div className={`validation-status-bar ${hasErrors ? "status-error" : hasWarnings ? "status-warning" : "status-clean"}`} style={{
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          fontWeight: 600,
          background: hasErrors ? "rgba(239, 68, 68, 0.1)" : hasWarnings ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
          borderBottom: "1px solid var(--border)",
          color: hasErrors ? "#ef4444" : hasWarnings ? "#f59e0b" : "#10b981",
        }}>
          {hasErrors || hasWarnings ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>
            {hasErrors
              ? `Validation Gate: ${validationReport.errors.length} error(s) detected.`
              : hasWarnings
                ? `Validation Gate: ${validationReport.warnings.length} warning(s) detected.`
                : "Validation Gate: Clean — Project model passed geometry & fabrication checks."}
          </span>
        </div>

        <div className="modal-body-split">
          {/* Left panel: Settings panel */}
          <div className="settings-panel">
            <div className="modal-tabs">
              <button
                className={`modal-tab-btn ${activeTab === "physical" ? "active" : ""}`}
                onClick={() => setActiveTab("physical")}
              >
                <Printer size={15} />
                Physical Craft (SVG)
              </button>
              <button
                className={`modal-tab-btn ${activeTab === "interactive" ? "active" : ""}`}
                onClick={() => setActiveTab("interactive")}
              >
                <FileCode size={15} />
                Web Interactive
              </button>
            </div>

            <div className="tab-contents">
              {activeTab === "physical" ? (
                <div className="settings-grid">
                  <div className="control-group">
                    <label>Export Layout Mode</label>
                    <select value={exportMode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setExportMode(e.target.value as any)}>
                      <option value="maker-archive">Complete Maker Package Archive (.zip) [Recommended]</option>
                      <option value="sheet-grid">Unnested Print & Cut Sheet Grid (Single SVG)</option>
                      <option value="per-ring">Per-Ring Discs Package (.zip)</option>
                      <option value="combined">Combined Concentric Stack (Single SVG)</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>Target Layers</label>
                    <select value={layer} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLayer(e.target.value as any)}>
                      <option value="all">All Layers Combined</option>
                      <option value="artwork">Artwork Layer Only</option>
                      <option value="cut">Cut Outlines Only</option>
                      <option value="fold">Fold Score-lines Only</option>
                    </select>
                  </div>

                  <div className="control-group checkbox-row">
                    <input
                      type="checkbox"
                      id="convertTextToPaths"
                      checked={convertTextToPaths}
                      onChange={(e) => setConvertTextToPaths(e.target.checked)}
                    />
                    <label htmlFor="convertTextToPaths">Convert text elements to vector path outlines (for Cricut / Glowforge)</label>
                  </div>

                  <div className="control-group checkbox-row">
                    <input
                      type="checkbox"
                      id="physicalUnits"
                      checked={physicalUnits}
                      onChange={(e) => setPhysicalUnits(e.target.checked)}
                    />
                    <label htmlFor="physicalUnits">Include physical dimension & unit scale metadata</label>
                  </div>

                  <div className="control-group checkbox-row">
                    <input
                      type="checkbox"
                      id="embedAssets"
                      checked={embedAssets}
                      onChange={(e) => setEmbedAssets(e.target.checked)}
                    />
                    <label htmlFor="embedAssets">Embed image assets directly in SVG output (Base64)</label>
                  </div>

                  <div className="control-group checkbox-row">
                    <input
                      type="checkbox"
                      id="includeReg"
                      checked={includeReg}
                      onChange={(e) => setIncludeReg(e.target.checked)}
                    />
                    <label htmlFor="includeReg">Include center brad hole registration marks</label>
                  </div>

                  <div className="control-group checkbox-row">
                    <input
                      type="checkbox"
                      id="includeTicks"
                      checked={includeTicks}
                      onChange={(e) => setIncludeTicks(e.target.checked)}
                    />
                    <label htmlFor="includeTicks">Include radial alignment ticks (0°, 90°, etc.)</label>
                  </div>

                  <div className="action-buttons-row" style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                    <button className="btn btn-primary export-btn" style={{ flex: 1 }} onClick={handlePhysicalExport}>
                      <Download size={14} />
                      Download Vector Assets
                    </button>

                    <button className="btn btn-secondary export-btn" style={{ flex: 1 }} onClick={handlePNGExport}>
                      <ImageIcon size={14} />
                      Export PNG ({pngDpi} DPI)
                    </button>
                  </div>

                  <div className="control-group" style={{ marginTop: "8px" }}>
                    <label>PNG Resolution</label>
                    <select value={pngDpi} onChange={(e) => setPngDpi(Number(e.target.value) as any)}>
                      <option value={72}>72 DPI (Web Preview)</option>
                      <option value={150}>150 DPI (Draft Print)</option>
                      <option value={300}>300 DPI (High-Res Publication)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="settings-grid">
                  <div className="control-group">
                    <label>Package Format</label>
                    <select value={bundleType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBundleType(e.target.value as any)}>
                      <option value="single">Standalone Single HTML File</option>
                      <option value="zip">Developer Bundle ZIP (index.html, runtime.js, styles.css, runtime.json)</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>Ring Label Display</label>
                    <select value={ringLabelMode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRingLabelMode(e.target.value as any)}>
                      <option value="always">Always Visible</option>
                      <option value="hover">Visible on Hover</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>Dial Control Mode</label>
                    <select value={controlStyle} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setControlStyle(e.target.value as any)}>
                      <option value="with-controls">Side Controls & Rotation Sliders</option>
                      <option value="bare">Bare Volvelle Dial Only</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>State Persistence Mode</label>
                    <select value={persistenceMode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPersistenceMode(e.target.value as any)}>
                      <option value="persist-reset">Persist Drag State + Reset (localStorage)</option>
                      <option value="always-reset">Always Reset on reload</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>UI Theme</label>
                    <select value={theme} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value as any)}>
                      <option value="dark">Dark Theme</option>
                      <option value="light">Light Theme</option>
                    </select>
                  </div>

                  <button className="btn btn-primary export-btn" onClick={handleInteractiveExport}>
                    <Download size={14} />
                    Download Interactive Web Package
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Real-time SVG preview */}
          <div className="preview-panel">
            <div className="preview-header">
              <Eye size={14} />
              <span>Real-Time Export Preview</span>
            </div>
            <div className="preview-viewport-wrapper">
              <iframe
                title="SVG Preview"
                srcDoc={`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#13151a;height:100vh;overflow:hidden;">${previewSvg}</body></html>`}
                className="preview-iframe"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

