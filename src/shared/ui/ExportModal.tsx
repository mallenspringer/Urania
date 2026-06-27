import React, { useState, useMemo } from "react";
import { X, FileCode, Printer, Download, Eye } from "lucide-react";
import type { Project } from "../types/project";
import JSZip from "jszip";
import { generateSVG, generateLayerFiles } from "../../features/export/svgExporter";
import { generateInteractiveHTML, generateInteractiveZIP } from "../../features/export/runtimeGenerator";

interface ExportModalProps {
  project: Project;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, onClose }) => {
  const [activeTab, setActiveTab] = useState<"physical" | "interactive">("physical");

  // Physical Export settings
  const [layer, setLayer] = useState<"all" | "artwork" | "cut" | "fold">("all");
  const [separateFiles, setSeparateFiles] = useState(false);
  const [includeReg, setIncludeReg] = useState(true);
  const [includeTicks, setIncludeTicks] = useState(true);
  const [embedAssets, setEmbedAssets] = useState(true);

  // Interactive Export settings
  const [bundleType, setBundleType] = useState<"single" | "zip">("single");
  const [persistenceMode, setPersistenceMode] = useState<"persist-reset" | "always-reset">("persist-reset");
  const [controlStyle, setControlStyle] = useState<"bare" | "with-controls">("with-controls");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Compute live SVG preview for physical configuration
  const previewSvg = useMemo(() => {
    try {
      return generateSVG(project, {
        layer: layer === "all" ? "artwork" : layer, // Preview single layer for clarity if specified, otherwise artwork
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets: true, // always embed in editor preview
      });
    } catch (err) {
      console.error(err);
      return `<svg><text x="20" y="20" fill="red">Error rendering preview</text></svg>`;
    }
  }, [project, layer, includeReg, includeTicks]);

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

  // Triggers download of blob (e.g. for ZIPs)
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
    
    if (separateFiles && layer === "all") {
      const zip = new JSZip();
      const files = generateLayerFiles(project, {
        layer: "all",
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets,
      });

      Object.keys(files).forEach((name) => {
        zip.file(name, files[name]);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${filenameBase}-vectors.zip`);
    } else {
      // Export single SVG file
      const svg = generateSVG(project, {
        layer,
        includeRegistrationMarks: includeReg,
        includeAlignmentTicks: includeTicks,
        embedAssets,
      });
      downloadFile(svg, `${filenameBase}-${layer}.svg`, "image/svg+xml");
    }
  };

  const handleInteractiveExport = async () => {
    const filenameBase = (project.metadata.name || "urania-project").toLowerCase().replace(/\s+/g, "-");

    if (bundleType === "zip") {
      // Download multi-file ZIP bundle
      const zipBlob = await generateInteractiveZIP(project, {
        bundleType: "zip",
        persistenceMode,
        controlStyle,
        theme,
      });
      downloadBlob(zipBlob, `${filenameBase}-web-runtime.zip`);
    } else {
      // Download single standalone HTML file
      const html = generateInteractiveHTML(project, {
        bundleType: "single",
        persistenceMode,
        controlStyle,
        theme,
      });
      downloadFile(html, `${filenameBase}-runtime.html`, "text/html");
    }
  };

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
                    <label>Target Layers</label>
                    <select value={layer} onChange={(e: any) => setLayer(e.target.value)}>
                      <option value="all">All Layers Combined</option>
                      <option value="artwork">Artwork Layer Only</option>
                      <option value="cut">Cut Outlines Only</option>
                      <option value="fold">Fold Score-lines Only</option>
                    </select>
                  </div>

                  {layer === "all" && (
                    <div className="control-group checkbox-row">
                      <input
                        type="checkbox"
                        id="separateFiles"
                        checked={separateFiles}
                        onChange={(e) => setSeparateFiles(e.target.checked)}
                      />
                      <label htmlFor="separateFiles">Package layers into separate files (.zip)</label>
                    </div>
                  )}

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

                  <div className="control-group checkbox-row">
                    <input
                      type="checkbox"
                      id="embedAssets"
                      checked={embedAssets}
                      onChange={(e) => setEmbedAssets(e.target.checked)}
                    />
                    <label htmlFor="embedAssets">Embed images directly as base64 URLs</label>
                  </div>

                  <button className="btn btn-primary export-btn" onClick={handlePhysicalExport}>
                    <Download size={14} />
                    Download Vector Assets
                  </button>
                </div>
              ) : (
                <div className="settings-grid">
                  <div className="control-group">
                    <label>Package Format</label>
                    <select value={bundleType} onChange={(e: any) => setBundleType(e.target.value)}>
                      <option value="single">Standalone Single HTML File</option>
                      <option value="zip">Developer Bundle ZIP (HTML, JS, CSS, JSON)</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>Dial Control Mode</label>
                    <select value={controlStyle} onChange={(e: any) => setControlStyle(e.target.value)}>
                      <option value="with-controls">Side Controls & Rotation Sliders</option>
                      <option value="bare">Bare Volvelle Dial Only</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>State Persistence Mode</label>
                    <select value={persistenceMode} onChange={(e: any) => setPersistenceMode(e.target.value)}>
                      <option value="persist-reset">Persist Drag State + Reset (localStorage)</option>
                      <option value="always-reset">Always Reset on reload</option>
                    </select>
                  </div>

                  <div className="control-group">
                    <label>UI Theme</label>
                    <select value={theme} onChange={(e: any) => setTheme(e.target.value)}>
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
