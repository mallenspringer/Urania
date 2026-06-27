import React, { useState, useEffect, useRef } from "react";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { findNodeInTree } from "../utils/geometry";
import { UpdateNodeCommand } from "../../features/project/commands";
import {
  Sliders,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Settings,
  Palette,
  Type,
  Maximize,
  Compass
} from "lucide-react";

// Deep merge helper to apply nested object patches safely
function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

// Tree node update helper
function updateNodeInTree(tree: any, id: string, patch: any): boolean {
  if (tree.id === id) {
    deepMerge(tree, patch);
    return true;
  }
  if (tree.children) {
    for (const child of tree.children) {
      if (updateNodeInTree(child, id, patch)) return true;
    }
  }
  return false;
}

export const InspectorPanel: React.FC = () => {
  const { project, setProject, executeCommand, updateMetadata, updateSettings } = useProjectStore();
  const { activeItem } = useSelectionStore();

  const originalNodeRef = useRef<any>(null);
  const [localValState, setLocalValState] = useState<Record<string, any>>({});

  const activeNode = activeItem ? findNodeInTree(project.mechanism, activeItem.id) : null;

  // Track local value states for text area/inputs to avoid keyboard lag
  useEffect(() => {
    if (activeNode) {
      setLocalValState({
        name: activeNode.name || "",
        content: activeNode.content || "",
        fill: activeNode.style?.fill || "",
        stroke: activeNode.style?.stroke || "",
        windowFill: activeNode.shape?.style?.fill || "",
        windowStroke: activeNode.shape?.style?.stroke || "",
      });
    }
  }, [activeNode?.id, activeNode?.content, activeNode?.name, activeNode?.style?.fill, activeNode?.style?.stroke, activeNode?.shape?.style?.fill, activeNode?.shape?.style?.stroke]);

  if (!activeNode) {
    // Render Project / Mechanism settings when nothing is selected
    return (
      <aside className="inspector-panel" id="inspector-project-settings">
        <div className="sidebar-section">
          <h3 className="section-title">
            <Settings size={14} />
            Project Settings
          </h3>
          <div className="info-card">
            <label>Project Name</label>
            <input
              type="text"
              id="project-name-input"
              value={project.metadata.name || ""}
              onChange={(e) => updateMetadata({ name: e.target.value })}
            />
            <label>Author</label>
            <input
              type="text"
              id="project-author-input"
              value={project.metadata.author || ""}
              onChange={(e) => updateMetadata({ author: e.target.value })}
            />
            <label>Description</label>
            <textarea
              id="project-description-textarea"
              value={project.metadata.description || ""}
              rows={3}
              onChange={(e) => updateMetadata({ description: e.target.value })}
            />
          </div>
        </div>

        <div className="sidebar-section">
          <h3 className="section-title">
            <Maximize size={14} />
            Canvas Dimensions
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Width</label>
              <input
                type="number"
                id="canvas-width-input"
                min="100"
                max="3000"
                value={project.settings.canvasSize.width}
                onChange={(e) =>
                  updateSettings({
                    canvasSize: {
                      ...project.settings.canvasSize,
                      width: Math.max(100, parseInt(e.target.value) || 800),
                    },
                  })
                }
              />
            </div>
            <div>
              <label>Height</label>
              <input
                type="number"
                id="canvas-height-input"
                min="100"
                max="3000"
                value={project.settings.canvasSize.height}
                onChange={(e) =>
                  updateSettings({
                    canvasSize: {
                      ...project.settings.canvasSize,
                      height: Math.max(100, parseInt(e.target.value) || 800),
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Units</label>
            <select
              id="canvas-units-select"
              value={project.settings.units}
              onChange={(e) => updateSettings({ units: e.target.value as any })}
              style={{
                backgroundColor: "#0b0c0f",
                border: "1px solid #232530",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "6px",
                fontSize: "13px",
              }}
            >
              <option value="pixels">Pixels</option>
              <option value="inches">Inches</option>
              <option value="mm">Millimeters</option>
            </select>
          </div>
        </div>
      </aside>
    );
  }

  // Transactional Editing functions
  const handleStartEdit = () => {
    originalNodeRef.current = JSON.parse(JSON.stringify(activeNode));
  };

  const handleTransientEdit = (patch: any) => {
    const currentMechanism = JSON.parse(JSON.stringify(project.mechanism));
    if (updateNodeInTree(currentMechanism, activeNode.id, patch)) {
      setProject({
        ...project,
        mechanism: currentMechanism,
      });
    }
  };

  const handleCommitEdit = (patch: any) => {
    if (!originalNodeRef.current) return;
    
    // 1. Rollback transient state first
    const rolledBackMechanism = JSON.parse(JSON.stringify(project.mechanism));
    const cleanNode = findNodeInTree(rolledBackMechanism, activeNode.id);
    if (cleanNode) {
      Object.assign(cleanNode, JSON.parse(JSON.stringify(originalNodeRef.current)));
      setProject({
        ...project,
        mechanism: rolledBackMechanism,
      });
    }

    // 2. Perform patched command execution
    const origSnapshot = originalNodeRef.current;
    const finalNode = JSON.parse(JSON.stringify(origSnapshot));
    deepMerge(finalNode, patch);

    if (JSON.stringify(origSnapshot) !== JSON.stringify(finalNode)) {
      executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, finalNode));
    }
    originalNodeRef.current = null;
  };

  const commitImmediateField = (patch: any) => {
    const origSnapshot = JSON.parse(JSON.stringify(activeNode));
    const updated = JSON.parse(JSON.stringify(origSnapshot));
    deepMerge(updated, patch);
    executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, updated));
  };

  return (
    <aside className="inspector-panel" id="inspector-element-panel">
      {/* Node Header Info */}
      <div className="sidebar-section">
        <div className="inspector-header">
          <span className="node-type-badge">{activeNode.type}</span>
          <div className="node-visibility-toggle">
            <button
              className={`visibility-btn ${activeNode.visible !== false ? "active" : ""}`}
              onClick={() => commitImmediateField({ visible: activeNode.visible === false })}
              title="Toggle Visibility"
            >
              {activeNode.visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              className={`lock-btn ${activeNode.locked ? "active" : ""}`}
              onClick={() => commitImmediateField({ locked: !activeNode.locked })}
              title="Toggle Lock State"
            >
              {activeNode.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        </div>

        <div className="info-card" style={{ marginTop: "10px" }}>
          <label>Element ID Name</label>
          <input
            type="text"
            id="element-name-input"
            value={localValState.name || ""}
            onFocus={handleStartEdit}
            onChange={(e) => {
              setLocalValState((s) => ({ ...s, name: e.target.value }));
              handleTransientEdit({ name: e.target.value });
            }}
            onBlur={(e) => handleCommitEdit({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>

      {/* Ring-Specific Properties */}
      {activeNode.type === "ring" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Compass size={14} />
            Ring Boundaries
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Inner Rad</label>
              <input
                type="number"
                id="ring-inner-radius"
                min="0"
                max={activeNode.outerRadius - 5}
                value={activeNode.innerRadius || 0}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ innerRadius: Math.max(0, parseInt(e.target.value) || 0) })}
                onBlur={(e) => handleCommitEdit({ innerRadius: Math.max(0, parseInt(e.target.value) || 0) })}
              />
            </div>
            <div>
              <label>Outer Rad</label>
              <input
                type="number"
                id="ring-outer-radius"
                min={activeNode.innerRadius + 5}
                value={activeNode.outerRadius || 100}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ outerRadius: Math.max(0, parseInt(e.target.value) || 0) })}
                onBlur={(e) => handleCommitEdit({ outerRadius: Math.max(0, parseInt(e.target.value) || 0) })}
              />
            </div>
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Rotation angle: {Math.round(activeNode.rotation)}°</label>
            <input
              type="range"
              id="ring-rotation-slider"
              min="0"
              max="360"
              value={activeNode.rotation || 0}
              onMouseDown={handleStartEdit}
              onChange={(e) => handleTransientEdit({ rotation: parseFloat(e.target.value) })}
              onMouseUp={(e) => handleCommitEdit({ rotation: parseFloat((e.target as HTMLInputElement).value) })}
            />
          </div>
        </div>
      )}

      {/* Sector-Specific Properties */}
      {activeNode.type === "sector" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Compass size={14} />
            Sector Span
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Start angle</label>
              <input
                type="number"
                id="sector-start-angle"
                min="0"
                max="360"
                value={activeNode.startAngle || 0}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ startAngle: parseFloat(e.target.value) || 0 })}
                onBlur={(e) => handleCommitEdit({ startAngle: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label>End angle</label>
              <input
                type="number"
                id="sector-end-angle"
                min="0"
                max="360"
                value={activeNode.endAngle || 90}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ endAngle: parseFloat(e.target.value) || 0 })}
                onBlur={(e) => handleCommitEdit({ endAngle: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Child Transform Properties */}
      {activeNode.type !== "ring" && activeNode.type !== "sector" && activeNode.transform && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Transform
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Position X</label>
              <input
                type="number"
                id="transform-x"
                value={Math.round(activeNode.transform.x)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ transform: { x: parseFloat(e.target.value) || 0 } })}
                onBlur={(e) => handleCommitEdit({ transform: { x: parseFloat(e.target.value) || 0 } })}
              />
            </div>
            <div>
              <label>Position Y</label>
              <input
                type="number"
                id="transform-y"
                value={Math.round(activeNode.transform.y)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ transform: { y: parseFloat(e.target.value) || 0 } })}
                onBlur={(e) => handleCommitEdit({ transform: { y: parseFloat(e.target.value) || 0 } })}
              />
            </div>
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Rotation: {Math.round(activeNode.transform.rotation)}°</label>
            <input
              type="range"
              id="transform-rotation-slider"
              min="0"
              max="360"
              value={activeNode.transform.rotation || 0}
              onMouseDown={handleStartEdit}
              onChange={(e) => handleTransientEdit({ transform: { rotation: parseFloat(e.target.value) } })}
              onMouseUp={(e) => handleCommitEdit({ transform: { rotation: parseFloat((e.target as HTMLInputElement).value) } })}
            />
          </div>
          <div className="info-card control-double-row" style={{ marginTop: "10px" }}>
            <div>
              <label>Scale X</label>
              <input
                type="number"
                id="transform-scale-x"
                step="0.1"
                min="0.1"
                max="10"
                value={activeNode.transform.scaleX || 1}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ transform: { scaleX: parseFloat(e.target.value) || 1 } })}
                onBlur={(e) => handleCommitEdit({ transform: { scaleX: parseFloat(e.target.value) || 1 } })}
              />
            </div>
            <div>
              <label>Scale Y</label>
              <input
                type="number"
                id="transform-scale-y"
                step="0.1"
                min="0.1"
                max="10"
                value={activeNode.transform.scaleY || 1}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ transform: { scaleY: parseFloat(e.target.value) || 1 } })}
                onBlur={(e) => handleCommitEdit({ transform: { scaleY: parseFloat(e.target.value) || 1 } })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Circle Shape parameters */}
      {activeNode.type === "circle" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Circle Parameters
          </h3>
          <div className="info-card">
            <label>Radius</label>
            <input
              type="number"
              id="circle-radius"
              min="1"
              value={activeNode.radius || 10}
              onFocus={handleStartEdit}
              onChange={(e) => handleTransientEdit({ radius: Math.max(1, parseInt(e.target.value) || 1) })}
              onBlur={(e) => handleCommitEdit({ radius: Math.max(1, parseInt(e.target.value) || 1) })}
            />
          </div>
        </div>
      )}

      {/* Rectangle Shape parameters */}
      {activeNode.type === "rectangle" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Rect Dimensions
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Width</label>
              <input
                type="number"
                id="rect-width"
                min="1"
                value={activeNode.width || 10}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ width: Math.max(1, parseInt(e.target.value) || 1) })}
                onBlur={(e) => handleCommitEdit({ width: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div>
              <label>Height</label>
              <input
                type="number"
                id="rect-height"
                min="1"
                value={activeNode.height || 10}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ height: Math.max(1, parseInt(e.target.value) || 1) })}
                onBlur={(e) => handleCommitEdit({ height: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Polygon Shape parameters */}
      {activeNode.type === "polygon" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Polygon parameters
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Radius</label>
              <input
                type="number"
                id="polygon-radius"
                min="1"
                value={activeNode.radius || 10}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ radius: Math.max(1, parseInt(e.target.value) || 1) })}
                onBlur={(e) => handleCommitEdit({ radius: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div>
              <label>Sides</label>
              <input
                type="number"
                id="polygon-sides"
                min="3"
                max="20"
                value={activeNode.sides || 5}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ sides: Math.max(3, parseInt(e.target.value) || 3) })}
                onBlur={(e) => handleCommitEdit({ sides: Math.max(3, parseInt(e.target.value) || 3) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Line parameters */}
      {activeNode.type === "line" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Line Dimensions
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Length</label>
              <input
                type="number"
                id="line-length"
                min="1"
                value={activeNode.length || 10}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ length: Math.max(1, parseInt(e.target.value) || 1) })}
                onBlur={(e) => handleCommitEdit({ length: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div>
              <label>Thickness</label>
              <input
                type="number"
                id="line-thickness"
                min="1"
                value={activeNode.thickness || 2}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ thickness: Math.max(1, parseInt(e.target.value) || 1) })}
                onBlur={(e) => handleCommitEdit({ thickness: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Window-Specific Cutout Properties */}
      {activeNode.type === "window" && activeNode.shape && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Window Cutout Shape
          </h3>
          <div className="info-card" style={{ marginBottom: "10px" }}>
            <label>Shape Type</label>
            <select
              id="window-shape-type-select"
              value={activeNode.shape.type}
              onChange={(e) => {
                const newType = e.target.value;
                const newShape: any = { type: newType };
                if (newType === "circle") {
                  newShape.radius = 30;
                } else if (newType === "rectangle") {
                  newShape.width = 60;
                  newShape.height = 40;
                } else if (newType === "polygon") {
                  newShape.radius = 30;
                  newShape.sides = 5;
                }
                commitImmediateField({ shape: newShape });
              }}
              style={{
                backgroundColor: "#0b0c0f",
                border: "1px solid #232530",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "6px",
                fontSize: "13px",
              }}
            >
              <option value="circle">Circle</option>
              <option value="rectangle">Rectangle</option>
              <option value="polygon">Polygon</option>
            </select>
          </div>

          {activeNode.shape.type === "circle" && (
            <div className="info-card">
              <label>Radius</label>
              <input
                type="number"
                id="window-circle-radius"
                min="1"
                value={activeNode.shape.radius || 10}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ shape: { radius: Math.max(1, parseInt(e.target.value) || 1) } })}
                onBlur={(e) => handleCommitEdit({ shape: { radius: Math.max(1, parseInt(e.target.value) || 1) } })}
              />
            </div>
          )}

          {activeNode.shape.type === "rectangle" && (
            <div className="info-card control-double-row">
              <div>
                <label>Width</label>
                <input
                  type="number"
                  id="window-rect-width"
                  min="1"
                  value={activeNode.shape.width || 10}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { width: Math.max(1, parseInt(e.target.value) || 1) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { width: Math.max(1, parseInt(e.target.value) || 1) } })}
                />
              </div>
              <div>
                <label>Height</label>
                <input
                  type="number"
                  id="window-rect-height"
                  min="1"
                  value={activeNode.shape.height || 10}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { height: Math.max(1, parseInt(e.target.value) || 1) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { height: Math.max(1, parseInt(e.target.value) || 1) } })}
                />
              </div>
            </div>
          )}

          {activeNode.shape.type === "polygon" && (
            <div className="info-card control-double-row">
              <div>
                <label>Radius</label>
                <input
                  type="number"
                  id="window-poly-radius"
                  min="1"
                  value={activeNode.shape.radius || 10}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { radius: Math.max(1, parseInt(e.target.value) || 1) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { radius: Math.max(1, parseInt(e.target.value) || 1) } })}
                />
              </div>
              <div>
                <label>Sides</label>
                <input
                  type="number"
                  id="window-poly-sides"
                  min="3"
                  max="20"
                  value={activeNode.shape.sides || 5}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { sides: Math.max(3, parseInt(e.target.value) || 3) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { sides: Math.max(3, parseInt(e.target.value) || 3) } })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Typography settings for text blocks */}
      {(activeNode.type === "text" || activeNode.type === "arcText" || activeNode.type === "sectorLabel") && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Type size={14} />
            Typography
          </h3>
          <div className="info-card" style={{ marginBottom: "10px" }}>
            <label>Text Content</label>
            <textarea
              id="text-content-textarea"
              value={localValState.content || ""}
              rows={2}
              onFocus={handleStartEdit}
              onChange={(e) => {
                setLocalValState((s) => ({ ...s, content: e.target.value }));
                handleTransientEdit({ content: e.target.value });
              }}
              onBlur={(e) => handleCommitEdit({ content: e.target.value })}
            />
          </div>
          <div className="info-card control-double-row">
            <div>
              <label>Font Size</label>
              <input
                type="number"
                id="font-size-input"
                min="6"
                max="120"
                value={activeNode.fontSize || 14}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ fontSize: Math.max(6, parseInt(e.target.value) || 6) })}
                onBlur={(e) => handleCommitEdit({ fontSize: Math.max(6, parseInt(e.target.value) || 6) })}
              />
            </div>
            <div>
              <label>Font Family</label>
              <select
                id="font-family-select"
                value={activeNode.fontFamily || "Outfit"}
                onChange={(e) => commitImmediateField({ fontFamily: e.target.value })}
                style={{
                  backgroundColor: "#0b0c0f",
                  border: "1px solid #232530",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  padding: "6px",
                  fontSize: "12px",
                  width: "100%",
                }}
              >
                <option value="Outfit">Outfit</option>
                <option value="Inter">Inter</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
          </div>

          {/* Curved Arc Text Radius/Angles */}
          {activeNode.type === "arcText" && (
            <>
              <div className="info-card" style={{ marginTop: "10px" }}>
                <label>Radius: {Math.round(activeNode.radius)}</label>
                <input
                  type="range"
                  id="arctext-radius-slider"
                  min="10"
                  max="400"
                  value={activeNode.radius || 100}
                  onMouseDown={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ radius: parseInt(e.target.value) })}
                  onMouseUp={(e) => handleCommitEdit({ radius: parseInt((e.target as HTMLInputElement).value) })}
                />
              </div>
              <div className="info-card control-double-row" style={{ marginTop: "10px" }}>
                <div>
                  <label>Start angle</label>
                  <input
                    type="number"
                    id="arctext-start-angle"
                    value={Math.round(activeNode.startAngle || 0)}
                    onFocus={handleStartEdit}
                    onChange={(e) => handleTransientEdit({ startAngle: parseFloat(e.target.value) || 0 })}
                    onBlur={(e) => handleCommitEdit({ startAngle: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Sweep span</label>
                  <input
                    type="number"
                    id="arctext-sweep-angle"
                    value={Math.round(activeNode.sweepAngle || 0)}
                    onFocus={handleStartEdit}
                    onChange={(e) => handleTransientEdit({ sweepAngle: parseFloat(e.target.value) || 0 })}
                    onBlur={(e) => handleCommitEdit({ sweepAngle: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Vector Color Styling */}
      {activeNode.type !== "window" && (activeNode.style || activeNode.type === "ring" || activeNode.type === "sector") && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Palette size={14} />
            Aesthetic Styles
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Fill Color</label>
              <input
                type="color"
                id="style-fill-color"
                value={localValState.fill || "#000000"}
                onFocus={handleStartEdit}
                onChange={(e) => {
                  setLocalValState((s) => ({ ...s, fill: e.target.value }));
                  handleTransientEdit({ style: { fill: e.target.value } });
                }}
                onBlur={(e) => handleCommitEdit({ style: { fill: e.target.value } })}
              />
            </div>
            <div>
              <label>Stroke Color</label>
              <input
                type="color"
                id="style-stroke-color"
                value={localValState.stroke || "#000000"}
                onFocus={handleStartEdit}
                onChange={(e) => {
                  setLocalValState((s) => ({ ...s, stroke: e.target.value }));
                  handleTransientEdit({ style: { stroke: e.target.value } });
                }}
                onBlur={(e) => handleCommitEdit({ style: { stroke: e.target.value } })}
              />
            </div>
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Stroke Width: {activeNode.style?.strokeWidth || 1}px</label>
            <input
              type="range"
              id="style-stroke-width-slider"
              min="0"
              max="20"
              step="0.5"
              value={activeNode.style?.strokeWidth || 1}
              onMouseDown={handleStartEdit}
              onChange={(e) => handleTransientEdit({ style: { strokeWidth: parseFloat(e.target.value) } })}
              onMouseUp={(e) => handleCommitEdit({ style: { strokeWidth: parseFloat((e.target as HTMLInputElement).value) } })}
            />
          </div>
        </div>
      )}
    </aside>
  );
};
