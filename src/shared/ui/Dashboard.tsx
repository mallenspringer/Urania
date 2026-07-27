import React, { useRef, useState } from "react";
import { Play, UploadCloud, HelpCircle, ArrowRight, FileJson, History } from "lucide-react";
import { TEMPLATE_LIBRARY, type Template } from "../../features/templates/templateLibrary";
import { deserializeProject } from "../../shared/utils/serialization";

interface DashboardProps {
  onSelectTemplate: (template: Template) => void;
  onLoadProject: (projectJson: string) => void;
  onResumeAutosave: () => void;
  onResumeActiveProject: () => void;
  hasActiveProject: boolean;
  hasAutosave: boolean;
  autosaveMetadata: { name: string; updatedAt: string } | null;
}

/**
 * A beautiful, specialized SVG preview renderer for template cards.
 */
const TemplatePreviewSVG: React.FC<{ id: string }> = ({ id }) => {
  const center = 60;
  const renderWedges = (count: number, innerRadius: number, outerRadius: number, colors?: string[]) => {
    const wedges = [];
    const angleStep = 360 / count;
    for (let i = 0; i < count; i++) {
      const startAngle = (i * angleStep * Math.PI) / 180;
      const endAngle = ((i + 1) * angleStep * Math.PI) / 180;

      const x1 = center + innerRadius * Math.cos(startAngle);
      const y1 = center + innerRadius * Math.sin(startAngle);
      const x2 = center + outerRadius * Math.cos(startAngle);
      const y2 = center + outerRadius * Math.sin(startAngle);
      const x3 = center + outerRadius * Math.cos(endAngle);
      const y3 = center + outerRadius * Math.sin(endAngle);
      const x4 = center + innerRadius * Math.cos(endAngle);
      const y4 = center + innerRadius * Math.sin(endAngle);

      const d = `
        M ${x1} ${y1}
        L ${x2} ${y2}
        A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3}
        L ${x4} ${y4}
        A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}
        Z
      `;

      wedges.push(
        <path
          key={i}
          d={d}
          fill={colors ? colors[i % colors.length] : "rgba(99, 102, 241, 0.05)"}
          stroke="rgba(99, 102, 241, 0.25)"
          strokeWidth="0.75"
        />
      );
    }
    return wedges;
  };

  switch (id) {
    case "blank-volvelle":
      return (
        <svg width="120" height="120" viewBox="0 0 120 120" className="template-svg-preview">
          <circle cx={center} cy={center} r="45" fill="none" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" />
          <circle cx={center} cy={center} r="25" fill="none" stroke="rgba(99, 102, 241, 0.25)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={center} cy={center} r="3" fill="#6366f1" />
        </svg>
      );

    case "zodiac-wheel":
      return (
        <svg width="120" height="120" viewBox="0 0 120 120" className="template-svg-preview">
          {renderWedges(12, 25, 52)}
          {/* Inner masking dial */}
          <circle cx={center} cy={center} r="42" fill="rgba(18, 19, 26, 0.85)" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="1" />
          {/* Mask window cutout */}
          <circle cx={center + 33} cy={center} r="6" fill="rgba(99, 102, 241, 0.1)" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />
          {/* Arrow pointer */}
          <polygon points={`${center+23},${center-4} ${center+23},${center+4} ${center+29},${center}`} fill="#c084fc" />
          <circle cx={center} cy={center} r="3" fill="#a855f7" />
        </svg>
      );

    case "decoder-wheel":
      return (
        <svg width="120" height="120" viewBox="0 0 120 120" className="template-svg-preview">
          {/* Outer ring */}
          {renderWedges(26, 40, 52)}
          {/* Inner ring */}
          {renderWedges(26, 25, 38)}
          {/* Pin */}
          <circle cx={center} cy={center} r="20" fill="rgba(18, 19, 26, 0.9)" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="1" />
          <circle cx={center} cy={center} r="3" fill="#f43f5e" />
        </svg>
      );

    case "action-spinner": {
      const spinnerColors = [
        "rgba(239, 68, 68, 0.15)",
        "rgba(59, 130, 246, 0.15)",
        "rgba(16, 185, 129, 0.15)",
        "rgba(249, 115, 22, 0.15)",
        "rgba(56, 189, 248, 0.15)",
        "rgba(168, 85, 247, 0.15)",
        "rgba(234, 179, 8, 0.15)",
        "rgba(236, 72, 153, 0.15)",
      ];
      return (
        <svg width="120" height="120" viewBox="0 0 120 120" className="template-svg-preview">
          {renderWedges(8, 18, 52, spinnerColors)}
          {/* Selector shield covers almost all except one window slice */}
          <path
            d={`M ${center} ${center} 
                L ${center + 48 * Math.cos((-22.5 * Math.PI)/180)} ${center + 48 * Math.sin((-22.5 * Math.PI)/180)}
                A 48 48 0 1 1 ${center + 48 * Math.cos((22.5 * Math.PI)/180)} ${center + 48 * Math.sin((22.5 * Math.PI)/180)}
                Z`}
            fill="rgba(18, 19, 26, 0.9)"
            stroke="rgba(245, 158, 11, 0.5)"
            strokeWidth="1"
          />
          {/* window circle cutout */}
          <circle cx={center + 35} cy={center} r="7" fill="rgba(18, 19, 26, 0.1)" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
          {/* Arrow */}
          <polygon points={`${center+20},${center-3} ${center+20},${center+3} ${center+26},${center}`} fill="#f59e0b" />
          <circle cx={center} cy={center} r="3" fill="#f59e0b" />
        </svg>
      );
    }

    default:
      return null;
  }
};

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectTemplate,
  onLoadProject,
  onResumeAutosave,
  onResumeActiveProject,
  hasActiveProject,
  hasAutosave,
  autosaveMetadata,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readAndLoadFile(file);
  };

  const readAndLoadFile = (file: File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Verify format before passing up
        deserializeProject(text);
        onLoadProject(text);
      } catch (err: any) {
        setErrorMsg(`Invalid project file: ${err?.message || "JSON parsing error"}`);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setErrorMsg(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith(".json")) {
        readAndLoadFile(file);
      } else {
        setErrorMsg("Please drop a valid .json Urania project file.");
      }
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="dashboard-container">
      {/* Top Welcome Banner */}
      <div className="dashboard-hero">
        <div className="hero-logo-pulse">U</div>
        <div className="hero-content">
          <h2>Welcome to Urania</h2>
          <p>
            An offline-first, browser-based environment for designing circular paper computers,
            reveal volvelles, and rotational information mechanics.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Side: Project actions and templates */}
        <div className="dashboard-main-flow">
          {/* Quick Resume Options */}
          {(hasActiveProject || hasAutosave) && (
            <div className="resume-section">
              <h3 className="section-title-alt">
                <History size={16} /> Resume Session
              </h3>
              <div className="resume-card-grid">
                {hasActiveProject && (
                  <div className="resume-card active-project-card" onClick={onResumeActiveProject}>
                    <div className="resume-card-header">
                      <span className="badge-active">ACTIVE SESSION</span>
                      <h4>Return to Workspace</h4>
                    </div>
                    <p className="resume-desc">Resume your current edits without resetting the undo history stack.</p>
                    <button className="btn btn-primary btn-sm">
                      <Play size={12} /> Resume Project
                    </button>
                  </div>
                )}

                {hasAutosave && (
                  <div className="resume-card autosave-card" onClick={onResumeAutosave}>
                    <div className="resume-card-header">
                      <span className="badge-autosave">AUTOSAVED WORK</span>
                      <h4>{autosaveMetadata?.name || "Unsaved Project"}</h4>
                    </div>
                    <p className="resume-desc">
                      Saved: <strong>{formatTimestamp(autosaveMetadata?.updatedAt)}</strong>
                    </p>
                    <button className="btn btn-secondary btn-sm">
                      <History size={12} /> Load Autosave
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Template Picker */}
          <div className="template-picker-section">
            <h3 className="section-title-alt">
              <Play size={16} /> Start a New Volvelle
            </h3>
            <div className="template-cards-grid">
              {TEMPLATE_LIBRARY.map((tpl) => (
                <div
                  key={tpl.manifest.id}
                  className="template-card"
                  onClick={() => onSelectTemplate(tpl)}
                >
                  <div className="template-visual-container">
                    <TemplatePreviewSVG id={tpl.manifest.id} />
                  </div>
                  <div className="template-info">
                    <div className="template-title-row">
                      <h4>{tpl.manifest.name}</h4>
                      <span className="template-tag">{tpl.manifest.tags[0]}</span>
                    </div>
                    <p className="template-description">{tpl.manifest.description}</p>
                    <div className="template-meta-row">
                      <span>By {tpl.manifest.author}</span>
                      <span>v{tpl.manifest.version}.0</span>
                    </div>
                  </div>
                  <div className="template-hover-action">
                    <span>Create Project</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: File Upload Dropzone & Instructions Card */}
        <div className="dashboard-sidebar">
          {/* File Upload Dropzone */}
          <div className="sidebar-widget">
            <h3 className="widget-title">
              <UploadCloud size={16} /> Open Existing Project
            </h3>
            <div
              className={`dropzone-box ${isDragOver ? "dragover" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".json"
                onChange={handleFileChange}
              />
              <FileJson className="drop-icon" size={32} />
              <p className="drop-title">Drag & Drop project file here</p>
              <span className="drop-sub">or click to browse (.json)</span>
            </div>
            {errorMsg && <div className="drop-error">{errorMsg}</div>}
          </div>

          {/* Quick Help Guide */}
          <div className="sidebar-widget help-widget">
            <h3 className="widget-title">
              <HelpCircle size={16} /> Quick Start & Controls
            </h3>
            <div className="help-widget-content">
              <div className="help-section-item">
                <h5>Canvas Viewport Navigation</h5>
                <ul>
                  <li><strong>Scroll Wheel</strong>: Logarithmic Zoom</li>
                  <li><strong>Space + Drag</strong>: Pan Workspace</li>
                  <li><strong>Middle-Click + Drag</strong>: Pan Workspace</li>
                </ul>
              </div>

              <div className="help-section-item">
                <h5>Creation & Transforms</h5>
                <ul>
                  <li><strong>V Key</strong>: Switch to Select Tool</li>
                  <li><strong>Double-Click Text</strong>: Edit text contents directly</li>
                  <li><strong>Drag Handles</strong>: Resize or rotate elements</li>
                </ul>
              </div>

              <div className="help-section-item">
                <h5>Circular Mechanics Glossary</h5>
                <ul>
                  <li>
                    <strong>Volvelle</strong>: A historical circular computer composed of rotatable paper dials centered on a pivot pin.
                  </li>
                  <li>
                    <strong>Reveal Window</strong>: A cutout mask on an upper dial that selectively displays indicators or sectors placed on a lower dial.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
