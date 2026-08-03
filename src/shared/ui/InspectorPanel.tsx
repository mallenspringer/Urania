import React, { useState, useEffect, useRef } from "react";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { useViewStore } from "../../features/project/viewStore";
import { findNodeInTree, updateNodeInTree } from "../utils/geometry";
import { getUnitSymbol, formatUnitValue, toPixels, fromPixels, type Unit } from "../utils/unitConversion";
import { UpdateNodeCommand, DeleteMultipleNodesCommand, UpdateMultipleNodesCommand } from "../../features/project/commands";
import { calculateSymmetryGroupUpdates, findSymmetryGroupMembers, computeSymmetryOffsets } from "../utils/symmetryHelper";
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
  Compass,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ChevronDown,
  ChevronRight,
  Square,
  Trash2,
  Bookmark,
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

interface ScrubbableNumberFieldProps {
  id?: string;
  label: string;
  unitSymbol?: string;
  pixelValue: number;
  activeUnit: Unit;
  minPx?: number;
  maxPx?: number;
  onChange: (pixelVal: number) => void;
  onCommit: (pixelVal: number) => void;
  onStartEdit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ScrubbableNumberField({
  id,
  label,
  unitSymbol,
  pixelValue,
  activeUnit,
  minPx = 0,
  maxPx,
  onChange,
  onCommit,
  onStartEdit,
  className,
  style,
}: ScrubbableNumberFieldProps) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const startXRef = useRef(0);
  const startDisplayValRef = useRef(0);
  const currentPixelValRef = useRef(pixelValue);
  currentPixelValRef.current = pixelValue;
  const isDraggingRef = useRef(false);

  const displayVal = formatUnitValue(pixelValue, activeUnit);
  const step = activeUnit === "pixels" ? 1 : activeUnit === "inches" ? 0.01 : 0.1;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    startDisplayValRef.current = displayVal;
    isDraggingRef.current = false;

    const handleMouseMove = (me: MouseEvent) => {
      const deltaX = me.clientX - startXRef.current;
      if (Math.abs(deltaX) > 2) {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          setIsScrubbing(true);
          if (onStartEdit) onStartEdit();
        }
        let newDisplayVal = startDisplayValRef.current + deltaX * step;
        let newPx = toPixels(newDisplayVal, activeUnit);

        if (minPx !== undefined) newPx = Math.max(minPx, newPx);
        if (maxPx !== undefined) newPx = Math.min(maxPx, newPx);

        currentPixelValRef.current = newPx;
        onChange(newPx);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (isDraggingRef.current) {
        setIsScrubbing(false);
        onCommit(currentPixelValRef.current);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className={className} style={style}>
      <label
        className={`scrubbable-label ${isScrubbing ? "scrubbing" : ""}`}
        onMouseDown={handleMouseDown}
        title="Click and drag left/right to adjust value"
      >
        {label} {unitSymbol ? `(${unitSymbol})` : ""}
      </label>
      <input
        type="number"
        id={id}
        step={step}
        min={minPx !== undefined ? formatUnitValue(minPx, activeUnit) : undefined}
        value={isNaN(displayVal) ? "" : displayVal}
        onMouseDown={handleMouseDown}
        onFocus={() => {
          if (onStartEdit) onStartEdit();
        }}
        onChange={(e) => {
          if (isDraggingRef.current) return;
          const rawInput = parseFloat(e.target.value);
          if (!isNaN(rawInput)) {
            const px = Math.max(minPx, toPixels(rawInput, activeUnit));
            currentPixelValRef.current = px;
            onChange(px);
          }
        }}
        onBlur={(e) => {
          if (isDraggingRef.current) return;
          const rawInput = parseFloat(e.target.value);
          if (!isNaN(rawInput)) {
            const px = Math.max(minPx, toPixels(rawInput, activeUnit));
            onCommit(px);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

interface ScrubbableRawFieldProps {
  id?: string;
  label: string;
  value: number;
  unitSymbol?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  onCommit: (val: number) => void;
  onStartEdit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ScrubbableRawField({
  id,
  label,
  value,
  unitSymbol,
  step = 1,
  min,
  max,
  onChange,
  onCommit,
  onStartEdit,
  className,
  style,
}: ScrubbableRawFieldProps) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const startXRef = useRef(0);
  const startValRef = useRef(value);
  const currentValRef = useRef(value);
  currentValRef.current = value;
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    startValRef.current = value;
    isDraggingRef.current = false;

    const handleMouseMove = (me: MouseEvent) => {
      const deltaX = me.clientX - startXRef.current;
      if (Math.abs(deltaX) > 2) {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          setIsScrubbing(true);
          if (onStartEdit) onStartEdit();
        }
        let newVal = startValRef.current + deltaX * step;
        if (min !== undefined) newVal = Math.max(min, newVal);
        if (max !== undefined) newVal = Math.min(max, newVal);
        newVal = Number(newVal.toFixed(step < 0.1 ? 2 : 1));

        currentValRef.current = newVal;
        onChange(newVal);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (isDraggingRef.current) {
        setIsScrubbing(false);
        onCommit(currentValRef.current);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className={className} style={style}>
      <label
        className={`scrubbable-label ${isScrubbing ? "scrubbing" : ""}`}
        onMouseDown={handleMouseDown}
        title="Click and drag left/right to adjust value"
      >
        {label} {unitSymbol ? `(${unitSymbol})` : ""}
      </label>
      <input
        type="number"
        id={id}
        step={step}
        min={min}
        max={max}
        value={isNaN(value) ? "" : value}
        onMouseDown={handleMouseDown}
        onFocus={() => {
          if (onStartEdit) onStartEdit();
        }}
        onChange={(e) => {
          if (isDraggingRef.current) return;
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            currentValRef.current = val;
            onChange(val);
          }
        }}
        onBlur={(e) => {
          if (isDraggingRef.current) return;
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            onCommit(val);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}







interface InspectorPanelProps {
  onDeleteRing?: (ring: any) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ onDeleteRing }) => {
  const { project, setProject, executeCommand, updateMetadata, updateSettings } = useProjectStore();
  const { activeItem, selectedItems } = useSelectionStore();
  const isRightSidebarOpen = useViewStore((state) => state.isRightSidebarOpen);

  const activeNode = activeItem ? findNodeInTree(project.mechanism, activeItem.id) : null;
  const activeUnit: Unit = project.settings.units || "pixels";
  const unitSymbol = getUnitSymbol(activeUnit);
  const stepVal = activeUnit === "pixels" ? 1 : activeUnit === "inches" ? 0.01 : 0.1;

  const handleDeleteSelected = () => {
    if (selectedItems.length === 1 && activeNode?.type === "ring" && onDeleteRing) {
      onDeleteRing(activeNode);
      return;
    }
    const ids = selectedItems.map((item) => item.id);
    if (ids.length > 0) {
      executeCommand(new DeleteMultipleNodesCommand(ids));
    }
  };

  const originalNodeRef = useRef<any>(null);
  const [localValState, setLocalValState] = useState<Record<string, any>>({});
  const [isGrabTabExpanded, setIsGrabTabExpanded] = useState(true);
  const [linkSymmetry, setLinkSymmetry] = useState(true);

  // Track local value states for text area/inputs to avoid keyboard lag
  useEffect(() => {
    originalNodeRef.current = null;
    if (activeNode) {
      setLocalValState({
        name: activeNode.name || "",
        content: activeNode.content || "",
        fill: activeNode.style?.fill || "",
        stroke: activeNode.style?.stroke || "",
        windowFill: activeNode.shape?.style?.fill || "",
        windowStroke: activeNode.shape?.style?.stroke || "",
        label: activeNode.label || "",
        tabLabel: activeNode.tabLabel || "",
      });
    }
  }, [activeNode?.id, activeNode?.content, activeNode?.name, activeNode?.style?.fill, activeNode?.style?.stroke, activeNode?.shape?.style?.fill, activeNode?.shape?.style?.stroke, activeNode?.label, activeNode?.tabLabel]);

  if (!activeNode) {
    // Render Project / Mechanism settings when nothing is selected
    return (
      <aside className={`inspector-panel ${isRightSidebarOpen ? "" : "collapsed"}`} id="inspector-project-settings">
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
            Canvas Dimensions ({getUnitSymbol(project.settings.units)})
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Width ({getUnitSymbol(project.settings.units)})</label>
              <input
                type="number"
                id="canvas-width-input"
                min={project.settings.units === "pixels" ? 100 : project.settings.units === "inches" ? 1 : 10}
                step={project.settings.units === "pixels" ? 1 : project.settings.units === "inches" ? 0.01 : 0.1}
                value={Number(project.settings.canvasSize.width.toFixed(project.settings.units === "pixels" ? 1 : project.settings.units === "inches" ? 3 : 2))}
                onChange={(e) =>
                  updateSettings({
                    canvasSize: {
                      ...project.settings.canvasSize,
                      width: Math.max(0.1, parseFloat(e.target.value) || 0),
                    },
                  })
                }
              />
            </div>
            <div>
              <label>Height ({getUnitSymbol(project.settings.units)})</label>
              <input
                type="number"
                id="canvas-height-input"
                min={project.settings.units === "pixels" ? 100 : project.settings.units === "inches" ? 1 : 10}
                step={project.settings.units === "pixels" ? 1 : project.settings.units === "inches" ? 0.01 : 0.1}
                value={Number(project.settings.canvasSize.height.toFixed(project.settings.units === "pixels" ? 1 : project.settings.units === "inches" ? 3 : 2))}
                onChange={(e) =>
                  updateSettings({
                    canvasSize: {
                      ...project.settings.canvasSize,
                      height: Math.max(0.1, parseFloat(e.target.value) || 0),
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
              onChange={(e) => updateSettings({ units: e.target.value as Unit })}
              style={{
                backgroundColor: "#0b0c0f",
                border: "1px solid #232530",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "6px",
                fontSize: "13px",
              }}
            >
              <option value="pixels">Pixels (px)</option>
              <option value="inches">Inches (in)</option>
              <option value="millimeters">Millimeters (mm)</option>
            </select>
          </div>
          <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", cursor: "pointer" }}>
            <input
              type="checkbox"
              id="settings-show-grab-tabs-checkbox"
              checked={project.settings.showGrabTabs !== false}
              onChange={(e) => updateSettings({ showGrabTabs: e.target.checked })}
              style={{ accentColor: "#6366f1", cursor: "pointer" }}
            />
            <span style={{ fontSize: "12px", color: "#cbd5e1" }}>Include Grab Tabs in Export</span>
          </label>
        </div>
      </aside>
    );
  }

  // Transactional Editing functions
  const handleStartEdit = () => {
    originalNodeRef.current = JSON.parse(JSON.stringify(activeNode));
  };

  const handleTransientEdit = (patch: any) => {
    if (!originalNodeRef.current && activeNode) {
      originalNodeRef.current = JSON.parse(JSON.stringify(activeNode));
    }
    const currentMechanism = JSON.parse(JSON.stringify(project.mechanism));
    if (linkSymmetry && activeNode?.symmetryGroupId) {
      const updates = calculateSymmetryGroupUpdates(currentMechanism, activeNode, patch);
      for (const u of updates) {
        updateNodeInTree(currentMechanism, u.nodeId, u.newNode);
      }
      setProject({
        ...project,
        mechanism: currentMechanism,
      });
    } else {
      if (updateNodeInTree(currentMechanism, activeNode.id, patch)) {
        setProject({
          ...project,
          mechanism: currentMechanism,
        });
      }
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
    if (linkSymmetry && origSnapshot.symmetryGroupId) {
      const updates = calculateSymmetryGroupUpdates(rolledBackMechanism, origSnapshot, patch);
      if (updates.length > 0) {
        executeCommand(new UpdateMultipleNodesCommand(updates));
      } else {
        const finalNode = JSON.parse(JSON.stringify(origSnapshot));
        deepMerge(finalNode, patch);
        executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, finalNode));
      }
    } else {
      const finalNode = JSON.parse(JSON.stringify(origSnapshot));
      deepMerge(finalNode, patch);

      if (JSON.stringify(origSnapshot) !== JSON.stringify(finalNode)) {
        executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, finalNode));
      }
    }
    originalNodeRef.current = null;
  };

  const commitImmediateField = (patch: any) => {
    const origSnapshot = JSON.parse(JSON.stringify(activeNode));
    if (linkSymmetry && origSnapshot.symmetryGroupId) {
      const updates = calculateSymmetryGroupUpdates(project.mechanism, origSnapshot, patch);
      if (updates.length > 0) {
        executeCommand(new UpdateMultipleNodesCommand(updates));
        return;
      }
    }
    const updated = JSON.parse(JSON.stringify(origSnapshot));
    deepMerge(updated, patch);
    executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, updated));
  };

  const handleToggleNodeSymmetryLink = () => {
    if (!activeNode?.symmetryGroupId) return;
    const isUnlinked = !!activeNode.symmetryUnlinked;
    const origSnapshot = JSON.parse(JSON.stringify(activeNode));
    const updatedNode = JSON.parse(JSON.stringify(activeNode));

    if (isUnlinked) {
      // Re-linking! Compute position/rotation offsets relative to group
      const offsets = computeSymmetryOffsets(project.mechanism, activeNode);
      updatedNode.symmetryUnlinked = false;
      updatedNode.symmetryOffsets = offsets;
    } else {
      // Decoupling!
      updatedNode.symmetryUnlinked = true;
    }

    executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, updatedNode));
  };

  const handleUnlinkSymmetryGroup = () => {
    if (!activeNode?.symmetryGroupId) return;
    const members = findSymmetryGroupMembers(project.mechanism, activeNode.symmetryGroupId);
    const updates = members.map((m) => {
      const oldNode = JSON.parse(JSON.stringify(m));
      const newNode = JSON.parse(JSON.stringify(m));
      delete newNode.symmetryGroupId;
      delete newNode.symmetryIndex;
      delete newNode.symmetryCount;
      return { nodeId: m.id, oldNode, newNode };
    });
    executeCommand(new UpdateMultipleNodesCommand(updates));
  };

  const handleSelectAllSymmetryCopies = () => {
    if (!activeNode?.symmetryGroupId) return;
    const members = findSymmetryGroupMembers(project.mechanism, activeNode.symmetryGroupId);
    const selection = members.map((m) => ({ id: m.id, type: m.type }));
    useSelectionStore.getState().setSelection(selection);
  };

  const handleToggleObjectFunction = () => {
    if (!activeNode) return;

    if (linkSymmetry && activeNode.symmetryGroupId && !activeNode.symmetryUnlinked) {
      const members = findSymmetryGroupMembers(project.mechanism, activeNode.symmetryGroupId);
      const linkedMembers = members.filter((m) => !m.symmetryUnlinked);

      if (linkedMembers.length > 0) {
        const isConvertingToSolid = activeNode.type === "window";

        const updates = linkedMembers.map((m) => {
          const oldNode = JSON.parse(JSON.stringify(m));

          if (isConvertingToSolid) {
            if (m.type !== "window") {
              return { nodeId: m.id, oldNode, newNode: m };
            }
            // Convert Window Cutout -> Solid Object
            const originalShape = (m as any).shape || {};
            const solidType = (m as any).savedSolidType || originalShape.type || "rectangle";
            const solidStyle = (m as any).savedSolidStyle || originalShape.style || { fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 1.5 };
            
            if (!solidStyle.fill || solidStyle.fill === "transparent") {
              solidStyle.fill = "#cbd5e1";
            }

            const restoredSolidNode: any = {
              ...originalShape,
              id: m.id,
              type: solidType,
              name: m.name ? m.name.replace(/ Cutout$/g, "") : "Solid Object",
              visible: m.visible !== false,
              locked: !!m.locked,
              transform: m.transform,
              style: solidStyle,
              export: { artwork: true, cut: false, fold: false },
              symmetryGroupId: m.symmetryGroupId,
              symmetryIndex: m.symmetryIndex,
              symmetryCount: m.symmetryCount,
              symmetryUnlinked: m.symmetryUnlinked,
              symmetryOffsets: m.symmetryOffsets,
            };
            return { nodeId: m.id, oldNode, newNode: restoredSolidNode };
          } else {
            if (m.type === "window") {
              return { nodeId: m.id, oldNode, newNode: m };
            }
            // Convert Solid Object -> Window Cutout
            const solidType = m.type;
            const solidStyle = (m as any).style ? JSON.parse(JSON.stringify((m as any).style)) : { fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 1.5 };

            const childShape = {
              ...m,
              id: `${m.id}-shape`,
              transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
              style: m.type === "text" || m.type === "arcText" ? { fill: "transparent" } : {},
              export: { artwork: false, cut: true, fold: false },
            };

            const cleanName = m.name ? m.name.replace(/ Cutout$/g, "") : "Window";
            const windowCutoutNode: any = {
              id: m.id,
              type: "window",
              name: `${cleanName} Cutout`,
              visible: m.visible !== false,
              locked: !!m.locked,
              transform: m.transform,
              export: { artwork: false, cut: true, fold: false },
              savedSolidType: solidType,
              savedSolidStyle: solidStyle,
              shape: childShape,
              symmetryGroupId: m.symmetryGroupId,
              symmetryIndex: m.symmetryIndex,
              symmetryCount: m.symmetryCount,
              symmetryUnlinked: m.symmetryUnlinked,
              symmetryOffsets: m.symmetryOffsets,
            };
            return { nodeId: m.id, oldNode, newNode: windowCutoutNode };
          }
        });

        executeCommand(new UpdateMultipleNodesCommand(updates));
        return;
      }
    }

    // Fallback single node conversion
    const origSnapshot = JSON.parse(JSON.stringify(activeNode));
    if (activeNode.type === "window") {
      const originalShape = activeNode.shape || {};
      const solidType = activeNode.savedSolidType || originalShape.type || "rectangle";
      const solidStyle = activeNode.savedSolidStyle || originalShape.style || { fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 1.5 };
      
      if (!solidStyle.fill || solidStyle.fill === "transparent") {
        solidStyle.fill = "#cbd5e1";
      }

      const restoredSolidNode: any = {
        ...originalShape,
        id: activeNode.id,
        type: solidType,
        name: activeNode.name ? activeNode.name.replace(/ Cutout$/g, "") : "Solid Object",
        visible: activeNode.visible !== false,
        locked: !!activeNode.locked,
        transform: activeNode.transform,
        style: solidStyle,
        export: { artwork: true, cut: false, fold: false },
        symmetryGroupId: activeNode.symmetryGroupId,
        symmetryIndex: activeNode.symmetryIndex,
        symmetryCount: activeNode.symmetryCount,
        symmetryUnlinked: activeNode.symmetryUnlinked,
        symmetryOffsets: activeNode.symmetryOffsets,
      };

      executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, restoredSolidNode));
    } else {
      const solidType = activeNode.type;
      const solidStyle = activeNode.style ? JSON.parse(JSON.stringify(activeNode.style)) : { fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 1.5 };

      const childShape = {
        ...activeNode,
        id: `${activeNode.id}-shape`,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        style: activeNode.type === "text" || activeNode.type === "arcText" ? { fill: "transparent" } : {},
        export: { artwork: false, cut: true, fold: false },
      };

      const cleanName = activeNode.name ? activeNode.name.replace(/ Cutout$/g, "") : "Window";
      const windowCutoutNode: any = {
        id: activeNode.id,
        type: "window",
        name: `${cleanName} Cutout`,
        visible: activeNode.visible !== false,
        locked: !!activeNode.locked,
        transform: activeNode.transform,
        export: { artwork: false, cut: true, fold: false },
        savedSolidType: solidType,
        savedSolidStyle: solidStyle,
        shape: childShape,
        symmetryGroupId: activeNode.symmetryGroupId,
        symmetryIndex: activeNode.symmetryIndex,
        symmetryCount: activeNode.symmetryCount,
        symmetryUnlinked: activeNode.symmetryUnlinked,
        symmetryOffsets: activeNode.symmetryOffsets,
      };

      executeCommand(new UpdateNodeCommand(activeNode.id, origSnapshot, windowCutoutNode));
    }
  };

  return (
    <aside className={`inspector-panel ${isRightSidebarOpen ? "" : "collapsed"}`} id="inspector-element-panel">
      {/* Quick Navigation to Project Settings & Deselect */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "rgba(15, 23, 42, 0.5)",
        }}
      >
        <button
          onClick={() => useSelectionStore.getState().clearSelection()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "none",
            border: "none",
            color: "#818cf8",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
          }}
          title="Deselect active selection to view Project & Grid Settings"
        >
          <Sliders size={13} />
          <span>Project Settings</span>
        </button>
        <button
          onClick={() => useSelectionStore.getState().clearSelection()}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
            color: "#94a3b8",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "2px 6px",
          }}
          title="Deselect All Objects (Esc)"
        >
          Deselect All
        </button>
      </div>

      {/* Node Header Info */}
      <div className="sidebar-section">
        <div className="inspector-header">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="node-type-badge">{activeNode.type}</span>
            {selectedItems.length > 1 && (
              <span className="multi-select-badge" style={{ fontSize: "10px", color: "#c084fc", backgroundColor: "rgba(192, 132, 252, 0.15)", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>
                {selectedItems.length} Selected
              </span>
            )}
          </div>
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
            <button
              className="delete-node-btn"
              onClick={handleDeleteSelected}
              title={selectedItems.length > 1 ? `Delete ${selectedItems.length} Selected Objects` : "Delete Object"}
            >
              <Trash2 size={14} />
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

        {/* Object Function Indicator & Solid / Cutout Conversion Card */}
        {activeNode.type !== "ring" && activeNode.type !== "sector" && activeNode.type !== "tab" && (
          <div className="info-card" style={{ marginTop: "10px", padding: "10px", backgroundColor: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", fontWeight: "600" }}>
                Object Function
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                {activeNode.transformMode === "radial" && (activeNode.type === "rectangle" || activeNode.type === "trapezoid") && (
                  <span style={{
                    fontSize: "10px",
                    fontWeight: "bold",
                    padding: "2px 7px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(192, 132, 252, 0.15)",
                    color: "#c084fc",
                    border: "1px solid rgba(192, 132, 252, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 20 Q12 2 21 20" />
                      <path d="M6 16 Q12 7 18 16" />
                    </svg>
                    Radial Warp
                  </span>
                )}
                <span style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  backgroundColor: activeNode.type === "window" ? "rgba(99, 102, 241, 0.2)" : "rgba(16, 185, 129, 0.2)",
                  color: activeNode.type === "window" ? "#818cf8" : "#34d399",
                  border: activeNode.type === "window" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
                }}>
                  {activeNode.type === "window" ? `Cutout Window (${activeNode.shape?.type || "Shape"})` : `Solid ${activeNode.type.charAt(0).toUpperCase() + activeNode.type.slice(1)}`}
                </span>
              </div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ width: "100%", justifyContent: "center", gap: "6px" }}
              onClick={handleToggleObjectFunction}
            >
              {activeNode.type === "window" ? <Square size={13} /> : <Eye size={13} />}
              {activeNode.type === "window" ? "Convert to Solid Object" : "Convert to Window Cutout"}
            </button>

            {/* Radial Warp / Cartesian conversion — only for warp-eligible solid shapes */}
            {activeNode.type !== "window" && (activeNode.type === "rectangle" || activeNode.type === "trapezoid") && (
              <button
                className="btn btn-sm btn-secondary"
                style={{ width: "100%", justifyContent: "center", gap: "6px", marginTop: "6px" }}
                onClick={() => commitImmediateField({ transformMode: activeNode.transformMode === "radial" ? "cartesian" : "radial" })}
                title={activeNode.transformMode === "radial"
                  ? "Remove Radial Warp — converts this arc-slice shape back to a flat Cartesian rectangle/trapezoid"
                  : "Apply Radial Warp — deforms this shape into an arc-slice conforming to disc geometry"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M3 20 Q12 2 21 20" />
                  <path d="M6 16 Q12 7 18 16" />
                </svg>
                {activeNode.transformMode === "radial" ? "Remove Radial Warp" : "Apply Radial Warp"}
              </button>
            )}
          </div>
        )}

        {/* Symmetrical Array Grouping Card */}
        {activeNode.symmetryGroupId && (
          <div className="info-card" style={{ marginTop: "10px", padding: "10px", backgroundColor: "rgba(59, 130, 246, 0.08)", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#60a5fa", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px" }}>
                <Compass size={13} /> Symmetrical Array ({activeNode.symmetryCount || 2}x)
              </span>
              <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", margin: 0, color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={linkSymmetry}
                  onChange={(e) => setLinkSymmetry(e.target.checked)}
                />
                Global Link
              </label>
            </div>

            {/* Per-Object Decoupling Control */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", backgroundColor: "rgba(0, 0, 0, 0.25)", padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <span style={{ fontSize: "11px", color: "#e2e8f0" }}>
                This Object {activeNode.symmetryIndex !== undefined ? `(#${activeNode.symmetryIndex + 1})` : ""}:
              </span>
              <button
                className="btn btn-sm"
                onClick={handleToggleNodeSymmetryLink}
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  backgroundColor: activeNode.symmetryUnlinked ? "#334155" : "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {activeNode.symmetryUnlinked ? <Unlock size={12} /> : <Lock size={12} />}
                {activeNode.symmetryUnlinked ? "Independent" : "Group Linked"}
              </button>
            </div>

            {activeNode.symmetryOffsets && (activeNode.symmetryOffsets.radialDistanceOffset || activeNode.symmetryOffsets.angleOffset || activeNode.symmetryOffsets.rotationOffset) ? (
              <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "8px", fontStyle: "italic", paddingLeft: "2px" }}>
                Offsets: {activeNode.symmetryOffsets.radialDistanceOffset ? `${activeNode.symmetryOffsets.radialDistanceOffset > 0 ? "+" : ""}${activeNode.symmetryOffsets.radialDistanceOffset}px radial ` : ""}{activeNode.symmetryOffsets.angleOffset ? `${activeNode.symmetryOffsets.angleOffset > 0 ? "+" : ""}${activeNode.symmetryOffsets.angleOffset}° angle ` : ""}{activeNode.symmetryOffsets.rotationOffset ? `${activeNode.symmetryOffsets.rotationOffset > 0 ? "+" : ""}${activeNode.symmetryOffsets.rotationOffset}° rot` : ""}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleSelectAllSymmetryCopies}
                style={{ flex: 1, justifyContent: "center", fontSize: "11px", padding: "4px 6px" }}
              >
                Select All ({activeNode.symmetryCount || 2})
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleUnlinkSymmetryGroup}
                style={{ flex: 1, justifyContent: "center", fontSize: "11px", padding: "4px 6px", color: "#f87171", borderColor: "rgba(248, 113, 113, 0.4)" }}
              >
                Unlink Array
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ring-Specific Properties */}
      {activeNode.type === "ring" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Compass size={14} />
            Ring Boundaries
          </h3>
          <div className="info-card control-double-row">
            <ScrubbableNumberField
              id="ring-inner-radius"
              label="Inner Rad"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.innerRadius || 0}
              activeUnit={activeUnit}
              minPx={0}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ innerRadius: px })}
              onCommit={(px) => handleCommitEdit({ innerRadius: px })}
            />
            <ScrubbableNumberField
              id="ring-outer-radius"
              label="Outer Rad"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.outerRadius || 100}
              activeUnit={activeUnit}
              minPx={0}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ outerRadius: px })}
              onCommit={(px) => handleCommitEdit({ outerRadius: px })}
            />
          </div>
          <div className="info-card control-double-row" style={{ marginTop: "10px" }}>
            <div>
              <label>Ring Shape</label>
              <select
                value={activeNode.ringShape || "circle"}
                onChange={(e) => {
                  const shapeVal = e.target.value as "circle" | "polygon";
                  const updates: any = { ringShape: shapeVal };
                  if (shapeVal === "polygon" && !activeNode.polygonSides) {
                    updates.polygonSides = 6;
                    updates.radialSlices = 6;
                  }
                  executeCommand(new UpdateNodeCommand(activeNode.id, activeNode, { ...activeNode, ...updates }));
                }}
              >
                <option value="circle">Circle (Round Disc)</option>
                <option value="polygon">Regular Polygon</option>
              </select>
            </div>
            {activeNode.ringShape === "polygon" && (
              <ScrubbableRawField
                label="Polygon Sides"
                value={activeNode.polygonSides || 6}
                min={3}
                max={360}
                onStartEdit={handleStartEdit}
                onChange={(val) => handleTransientEdit({ polygonSides: Math.max(3, Math.min(360, Math.round(val))) })}
                onCommit={(val) => handleCommitEdit({ polygonSides: Math.max(3, Math.min(360, Math.round(val))) })}
              />
            )}
          </div>
          {activeNode.ringShape === "polygon" && (
            <div className="info-card" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ margin: 0 }}>Edge Curvature</label>
                <span style={{ fontSize: "11px", color: (activeNode.edgeCurvature || 0) < 0 ? "#ec4899" : (activeNode.edgeCurvature || 0) > 0 ? "#10b981" : "#94a3b8", fontWeight: 700 }}>
                  {(activeNode.edgeCurvature || 0) === 0 ? "Flat (Straight)" : (activeNode.edgeCurvature || 0) < 0 ? `Concave (${Math.round((activeNode.edgeCurvature || 0) * 100)}%)` : `Convex (+${Math.round((activeNode.edgeCurvature || 0) * 100)}%)`}
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={activeNode.edgeCurvature || 0}
                onMouseDown={handleStartEdit}
                onChange={(e) => handleTransientEdit({ edgeCurvature: parseFloat(e.target.value) })}
                onMouseUp={(e) => handleCommitEdit({ edgeCurvature: parseFloat((e.target as HTMLInputElement).value) })}
              />
            </div>
          )}
          <div className="info-card" style={{ marginTop: "10px" }}>
            <ScrubbableRawField
              label="Radial Slices"
              value={activeNode.radialSlices || (activeNode.ringShape === "polygon" ? activeNode.polygonSides || 6 : 4)}
              min={2}
              max={360}
              onStartEdit={handleStartEdit}
              onChange={(val) => handleTransientEdit({ radialSlices: Math.max(2, Math.min(360, Math.round(val))) })}
              onCommit={(val) => handleCommitEdit({ radialSlices: Math.max(2, Math.min(360, Math.round(val))) })}
            />
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ margin: 0 }}>Rotation Angle</label>
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <input
                  type="number"
                  id="ring-rotation-number-input"
                  step="any"
                  min="0"
                  max="360"
                  style={{
                    width: "65px",
                    padding: "2px 6px",
                    fontSize: "12px",
                    textAlign: "right",
                    backgroundColor: "#0b0c0f",
                    border: "1px solid #232530",
                    borderRadius: "4px",
                    color: "#f8fafc",
                  }}
                  value={localValState.ringRotation !== undefined ? localValState.ringRotation : (activeNode.rotation || 0)}
                  onFocus={handleStartEdit}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val = raw === "" ? 0 : parseFloat(raw);
                    setLocalValState((s) => ({ ...s, ringRotation: raw }));
                    handleTransientEdit({ rotation: isNaN(val) ? 0 : val });
                  }}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setLocalValState((s) => ({ ...s, ringRotation: val }));
                    handleCommitEdit({ rotation: val });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>°</span>
              </div>
            </div>
            <input
              type="range"
              id="ring-rotation-slider"
              min="0"
              max="360"
              step="1"
              value={activeNode.rotation || 0}
              onMouseDown={handleStartEdit}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLocalValState((s) => ({ ...s, ringRotation: val }));
                handleTransientEdit({ rotation: val });
              }}
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
            <ScrubbableNumberField
              id="transform-x"
              label="Position X"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.transform.x || 0}
              activeUnit={activeUnit}
              minPx={-10000}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ transform: { x: px } })}
              onCommit={(px) => handleCommitEdit({ transform: { x: px } })}
            />
            <ScrubbableNumberField
              id="transform-y"
              label="Position Y"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.transform.y || 0}
              activeUnit={activeUnit}
              minPx={-10000}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ transform: { y: px } })}
              onCommit={(px) => handleCommitEdit({ transform: { y: px } })}
            />
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
            <ScrubbableRawField
              id="transform-scale-x"
              label="Scale X"
              value={activeNode.transform.scaleX || 1}
              step={0.1}
              min={0.1}
              max={10}
              onStartEdit={handleStartEdit}
              onChange={(val) => handleTransientEdit({ transform: { scaleX: val } })}
              onCommit={(val) => handleCommitEdit({ transform: { scaleX: val } })}
            />
            <ScrubbableRawField
              id="transform-scale-y"
              label="Scale Y"
              value={activeNode.transform.scaleY || 1}
              step={0.1}
              min={0.1}
              max={10}
              onStartEdit={handleStartEdit}
              onChange={(val) => handleTransientEdit({ transform: { scaleY: val } })}
              onCommit={(val) => handleCommitEdit({ transform: { scaleY: val } })}
            />
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
            <ScrubbableNumberField
              id="circle-radius"
              label="Radius"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.radius || 10}
              activeUnit={activeUnit}
              minPx={0.1}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ radius: px })}
              onCommit={(px) => handleCommitEdit({ radius: px })}
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
            <ScrubbableNumberField
              id="rect-width"
              label="Width"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.width || 10}
              activeUnit={activeUnit}
              minPx={0.1}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ width: px })}
              onCommit={(px) => handleCommitEdit({ width: px })}
            />
            <ScrubbableNumberField
              id="rect-height"
              label="Height"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.height || 10}
              activeUnit={activeUnit}
              minPx={0.1}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ height: px })}
              onCommit={(px) => handleCommitEdit({ height: px })}
            />
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
            <ScrubbableNumberField
              id="polygon-radius"
              label="Radius"
              unitSymbol={unitSymbol}
              pixelValue={activeNode.radius || 10}
              activeUnit={activeUnit}
              minPx={0.1}
              onStartEdit={handleStartEdit}
              onChange={(px) => handleTransientEdit({ radius: px })}
              onCommit={(px) => handleCommitEdit({ radius: px })}
            />
            <ScrubbableRawField
              id="polygon-sides"
              label="Sides"
              value={activeNode.sides || 5}
              min={3}
              max={360}
              onStartEdit={handleStartEdit}
              onChange={(val) => handleTransientEdit({ sides: Math.max(3, Math.round(val)) })}
              onCommit={(val) => handleCommitEdit({ sides: Math.max(3, Math.round(val)) })}
            />
          </div>
          {(activeNode.sides || 5) === 3 && (
            <div className="info-card" style={{ marginTop: "10px" }}>
              <label>Triangle Variant</label>
              <select
                value={activeNode.triangleType || "equilateral"}
                onChange={(e) => commitImmediateField({ triangleType: e.target.value })}
                style={{
                  backgroundColor: "#0b0c0f",
                  border: "1px solid #232530",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  padding: "6px",
                  fontSize: "13px",
                  width: "100%",
                  marginTop: "4px",
                }}
              >
                <option value="equilateral">Equilateral (3 Equal Sides)</option>
                <option value="isosceles">Isosceles (2 Equal Sides)</option>
                <option value="right">Right Triangle (90° Corner)</option>
              </select>
            </div>
          )}
          <div className="info-card" style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ margin: 0 }}>Edge Curvature</label>
              <span style={{ fontSize: "11px", color: (activeNode.edgeCurvature || 0) < 0 ? "#ec4899" : (activeNode.edgeCurvature || 0) > 0 ? "#10b981" : "#94a3b8", fontWeight: 700 }}>
                {(activeNode.edgeCurvature || 0) === 0 ? "Flat (Straight)" : (activeNode.edgeCurvature || 0) < 0 ? `Concave (${Math.round((activeNode.edgeCurvature || 0) * 100)}%)` : `Convex (+${Math.round((activeNode.edgeCurvature || 0) * 100)}%)`}
              </span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={activeNode.edgeCurvature || 0}
              onMouseDown={handleStartEdit}
              onChange={(e) => handleTransientEdit({ edgeCurvature: parseFloat(e.target.value) })}
              onMouseUp={(e) => handleCommitEdit({ edgeCurvature: parseFloat((e.target as HTMLInputElement).value) })}
            />
          </div>
        </div>
      )}

      {/* Trapezoid Shape parameters */}
      {activeNode.type === "trapezoid" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Trapezoid Dimensions
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Base Width ({unitSymbol})</label>
              <input
                type="number"
                id="trapezoid-basewidth"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.baseWidth || 60, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ baseWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ baseWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
            <div>
              <label>Top Width ({unitSymbol})</label>
              <input
                type="number"
                id="trapezoid-topwidth"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.topWidth || 40, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ topWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ topWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Height ({unitSymbol})</label>
            <input
              type="number"
              id="trapezoid-height"
              min="0.1"
              step={stepVal}
              value={formatUnitValue(activeNode.height || 50, activeUnit)}
              onFocus={handleStartEdit}
              onChange={(e) => handleTransientEdit({ height: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              onBlur={(e) => handleCommitEdit({ height: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
            />
          </div>
        </div>
      )}

      {/* Crescent Moon Shape parameters */}
      {activeNode.type === "crescent" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Crescent Parameters
          </h3>
          <div className="info-card">
            <label>Outer Radius ({unitSymbol})</label>
            <input
              type="number"
              id="crescent-radius"
              min="0.1"
              step={stepVal}
              value={formatUnitValue(activeNode.radius || 10, activeUnit)}
              onFocus={handleStartEdit}
              onChange={(e) => handleTransientEdit({ radius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              onBlur={(e) => handleCommitEdit({ radius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
            />
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Phase (-1 to 1): {(activeNode.phase !== undefined ? activeNode.phase : 0.5).toFixed(2)}</label>
            <input
              type="range"
              id="crescent-phase"
              min="-1"
              max="1"
              step="0.05"
              value={activeNode.phase !== undefined ? activeNode.phase : 0.5}
              onMouseDown={handleStartEdit}
              onChange={(e) => handleTransientEdit({ phase: parseFloat(e.target.value) })}
              onMouseUp={(e) => handleCommitEdit({ phase: parseFloat((e.target as HTMLInputElement).value) })}
            />
          </div>
        </div>
      )}

      {/* Star Shape parameters */}
      {activeNode.type === "star" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Star Parameters
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Outer Radius ({unitSymbol})</label>
              <input
                type="number"
                id="star-outer-radius"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.outerRadius || 35, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ outerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ outerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
            <div>
              <label>Inner Radius ({unitSymbol})</label>
              <input
                type="number"
                id="star-inner-radius"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.innerRadius || 15, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ innerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ innerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
          </div>
          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Points Count</label>
            <input
              type="number"
              id="star-points"
              min="3"
              max="30"
              value={activeNode.numPoints || 5}
              onFocus={handleStartEdit}
              onChange={(e) => handleTransientEdit({ numPoints: Math.max(3, parseInt(e.target.value) || 3) })}
              onBlur={(e) => handleCommitEdit({ numPoints: Math.max(3, parseInt(e.target.value) || 3) })}
            />
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
              <label>Length ({unitSymbol})</label>
              <input
                type="number"
                id="line-length"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.length || 10, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ length: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ length: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
            <div>
              <label>Thickness ({unitSymbol})</label>
              <input
                type="number"
                id="line-thickness"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.thickness || 2, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ thickness: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ thickness: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Curve parameters */}
      {(activeNode.type === "curve" || (activeNode.type === "window" && activeNode.shape?.type === "curve")) && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Bézier Curve Parameters
          </h3>
          <div className="info-card" style={{ marginBottom: "8px" }}>
            <label>Curve Presets</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
              <button
                onClick={() => {
                  commitImmediateField(
                    activeNode.type === "window"
                      ? { shape: { ...activeNode.shape, controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 33, y: 0 }, c2: { x: 66, y: 0 }, p1: { x: 100, y: 0 } } } }
                      : { controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 33, y: 0 }, c2: { x: 66, y: 0 }, p1: { x: 100, y: 0 } } }
                  );
                }}
                style={{ background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155", borderRadius: "6px", padding: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                Straight
              </button>
              <button
                onClick={() => {
                  commitImmediateField(
                    activeNode.type === "window"
                      ? { shape: { ...activeNode.shape, controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 25, y: -50 }, c2: { x: 75, y: -50 }, p1: { x: 100, y: 0 } } } }
                      : { controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 25, y: -50 }, c2: { x: 75, y: -50 }, p1: { x: 100, y: 0 } } }
                  );
                }}
                style={{ background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155", borderRadius: "6px", padding: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                Arc (Smooth)
              </button>
              <button
                onClick={() => {
                  commitImmediateField(
                    activeNode.type === "window"
                      ? { shape: { ...activeNode.shape, controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 25, y: -50 }, c2: { x: 75, y: 50 }, p1: { x: 100, y: 0 } } } }
                      : { controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 25, y: -50 }, c2: { x: 75, y: 50 }, p1: { x: 100, y: 0 } } }
                  );
                }}
                style={{ background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155", borderRadius: "6px", padding: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                S-Curve
              </button>
              <button
                onClick={() => {
                  commitImmediateField(
                    activeNode.type === "window"
                      ? { shape: { ...activeNode.shape, controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 30, y: -80 }, c2: { x: 70, y: -80 }, p1: { x: 100, y: 0 } } } }
                      : { controlPoints: { p0: { x: 0, y: 0 }, c1: { x: 30, y: -80 }, c2: { x: 70, y: -80 }, p1: { x: 100, y: 0 } } }
                  );
                }}
                style={{ background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155", borderRadius: "6px", padding: "4px", fontSize: "11px", cursor: "pointer" }}
              >
                Deep Arch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arc parameters */}
      {(activeNode.type === "arc" || (activeNode.type === "window" && activeNode.shape?.type === "arc")) && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Sliders size={14} />
            Circular Arc Dimensions
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Radius</label>
              <input
                type="number"
                min="5"
                value={(activeNode.type === "window" ? activeNode.shape?.radius : activeNode.radius) || 50}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit(activeNode.type === "window" ? { shape: { ...activeNode.shape, radius: Math.max(5, parseInt(e.target.value) || 5) } } : { radius: Math.max(5, parseInt(e.target.value) || 5) })}
                onBlur={(e) => handleCommitEdit(activeNode.type === "window" ? { shape: { ...activeNode.shape, radius: Math.max(5, parseInt(e.target.value) || 5) } } : { radius: Math.max(5, parseInt(e.target.value) || 5) })}
              />
            </div>
            <div>
              <label>Sweep Angle</label>
              <input
                type="number"
                min="1"
                max="360"
                value={(activeNode.type === "window" ? activeNode.shape?.sweepAngle : activeNode.sweepAngle) || 90}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit(activeNode.type === "window" ? { shape: { ...activeNode.shape, sweepAngle: parseInt(e.target.value) || 90 } } : { sweepAngle: parseInt(e.target.value) || 90 })}
                onBlur={(e) => handleCommitEdit(activeNode.type === "window" ? { shape: { ...activeNode.shape, sweepAngle: parseInt(e.target.value) || 90 } } : { sweepAngle: parseInt(e.target.value) || 90 })}
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
                let newShape: any = { type: newType, id: `${activeNode.id}-shape` };
                if (newType === "circle") {
                  newShape.radius = 30;
                } else if (newType === "rectangle") {
                  newShape.width = 60;
                  newShape.height = 40;
                } else if (newType === "polygon") {
                  newShape.radius = 30;
                  newShape.sides = 5;
                } else if (newType === "star") {
                  newShape.outerRadius = 35;
                  newShape.innerRadius = 15;
                  newShape.numPoints = 5;
                } else if (newType === "trapezoid") {
                  newShape.baseWidth = 60;
                  newShape.topWidth = 40;
                  newShape.height = 50;
                } else if (newType === "crescent") {
                  newShape.radius = 30;
                  newShape.ratio = 0.4;
                  newShape.phase = 0.5;
                } else if (newType === "line") {
                  newShape.length = 60;
                  newShape.thickness = 4;
                } else if (newType === "text") {
                  newShape.content = "Cutout";
                  newShape.fontSize = 16;
                  newShape.fontFamily = "Outfit";
                  newShape.style = { fill: "transparent" };
                } else if (newType === "arcText") {
                  newShape.content = "Cutout Arc";
                  newShape.radius = 60;
                  newShape.startAngle = -20;
                  newShape.sweepAngle = 40;
                  newShape.fontSize = 16;
                  newShape.fontFamily = "Outfit";
                  newShape.style = { fill: "transparent" };
                }
                commitImmediateField({ shape: newShape, savedSolidType: newType });
              }}
              style={{
                backgroundColor: "#0b0c0f",
                border: "1px solid #232530",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "6px",
                fontSize: "13px",
                width: "100%",
                marginTop: "4px",
              }}
            >
              <option value="circle">Circle</option>
              <option value="rectangle">Rectangle</option>
              <option value="polygon">Polygon</option>
              <option value="star">Star</option>
              <option value="trapezoid">Trapezoid</option>
              <option value="crescent">Crescent Moon</option>
              <option value="line">Line</option>
              <option value="text">Text Glyph</option>
              <option value="arcText">Arc Text</option>
            </select>
          </div>

          {activeNode.shape.type === "circle" && (
            <div className="info-card">
              <label>Radius ({unitSymbol})</label>
              <input
                type="number"
                id="window-circle-radius"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.shape.radius || 10, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ shape: { radius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                onBlur={(e) => handleCommitEdit({ shape: { radius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
              />
            </div>
          )}

          {activeNode.shape.type === "rectangle" && (
            <div className="info-card control-double-row">
              <div>
                <label>Width ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-rect-width"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.width || 10, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { width: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { width: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                />
              </div>
              <div>
                <label>Height ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-rect-height"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.height || 10, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { height: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { height: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                />
              </div>
            </div>
          )}

          {activeNode.shape.type === "polygon" && (
            <div className="info-card control-double-row">
              <div>
                <label>Radius ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-poly-radius"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.radius || 10, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { radius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { radius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
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

          {activeNode.shape.type === "star" && (
            <div className="info-card control-double-row">
              <div>
                <label>Outer Radius ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-star-outer-radius"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.outerRadius || 35, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { outerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { outerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                />
              </div>
              <div>
                <label>Inner Radius ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-star-inner-radius"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.innerRadius || 15, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { innerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { innerRadius: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                />
              </div>
            </div>
          )}

          {activeNode.shape.type === "trapezoid" && (
            <div className="info-card control-double-row">
              <div>
                <label>Base Width ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-trap-basewidth"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.baseWidth || 60, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { baseWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { baseWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                />
              </div>
              <div>
                <label>Top Width ({unitSymbol})</label>
                <input
                  type="number"
                  id="window-trap-topwidth"
                  min="0.1"
                  step={stepVal}
                  value={formatUnitValue(activeNode.shape.topWidth || 40, activeUnit)}
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ shape: { topWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                  onBlur={(e) => handleCommitEdit({ shape: { topWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) } })}
                />
              </div>
            </div>
          )}

          {(activeNode.shape.type === "text" || activeNode.shape.type === "arcText") && (
            <div className="info-card">
              <label>Text Content</label>
              <input
                type="text"
                id="window-text-content"
                value={activeNode.shape.content || ""}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ shape: { content: e.target.value } })}
                onBlur={(e) => handleCommitEdit({ shape: { content: e.target.value } })}
              />
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
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Cinzel">Cinzel</option>
                <option value="Pacifico">Pacifico</option>
                <option value="Courier Prime">Courier Prime</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
          </div>

          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Formatting</label>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
              <button
                className={`formatting-btn ${activeNode.bold ? "active" : ""}`}
                onClick={() => commitImmediateField({ bold: !activeNode.bold })}
                title="Bold"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  backgroundColor: activeNode.bold ? "#312e81" : "#0b0c0f",
                  border: activeNode.bold ? "1px solid #6366f1" : "1px solid #232530",
                  color: activeNode.bold ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <Bold size={14} />
              </button>
              <button
                className={`formatting-btn ${activeNode.italic ? "active" : ""}`}
                onClick={() => commitImmediateField({ italic: !activeNode.italic })}
                title="Italic"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  backgroundColor: activeNode.italic ? "#312e81" : "#0b0c0f",
                  border: activeNode.italic ? "1px solid #6366f1" : "1px solid #232530",
                  color: activeNode.italic ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <Italic size={14} />
              </button>
              <button
                className={`formatting-btn ${activeNode.underline ? "active" : ""}`}
                onClick={() => commitImmediateField({ underline: !activeNode.underline })}
                title="Underline"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  backgroundColor: activeNode.underline ? "#312e81" : "#0b0c0f",
                  border: activeNode.underline ? "1px solid #6366f1" : "1px solid #232530",
                  color: activeNode.underline ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <Underline size={14} />
              </button>
              <button
                className={`formatting-btn ${activeNode.strikethrough ? "active" : ""}`}
                onClick={() => commitImmediateField({ strikethrough: !activeNode.strikethrough })}
                title="Strikethrough"
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  backgroundColor: activeNode.strikethrough ? "#312e81" : "#0b0c0f",
                  border: activeNode.strikethrough ? "1px solid #6366f1" : "1px solid #232530",
                  color: activeNode.strikethrough ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <Strikethrough size={14} />
              </button>
            </div>
          </div>

          {/* Curved Arc Text Radius/Angles & Kerning */}
          {activeNode.type === "arcText" && (
            <>
              <div className="info-card" style={{ marginTop: "10px" }}>
                <label>Radius ({unitSymbol}): {formatUnitValue(activeNode.radius || 100, activeUnit)}</label>
                <input
                  type="range"
                  id="arctext-radius-slider"
                  min={toPixels(1, activeUnit)}
                  max={toPixels(400, activeUnit)}
                  step={stepVal}
                  value={activeNode.radius || 100}
                  onMouseDown={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ radius: parseFloat(e.target.value) })}
                  onMouseUp={(e) => handleCommitEdit({ radius: parseFloat((e.target as HTMLInputElement).value) })}
                />
              </div>
              <div className="info-card" style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label htmlFor="text-kerning-slider">Kerning ({unitSymbol})</label>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                    {formatUnitValue(activeNode.kerning || 0, activeUnit)}{unitSymbol}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="range"
                    id="text-kerning-slider"
                    min={toPixels(-10, activeUnit)}
                    max={toPixels(50, activeUnit)}
                    step={stepVal}
                    value={activeNode.kerning || 0}
                    onMouseDown={handleStartEdit}
                    onChange={(e) => handleTransientEdit({ kerning: parseFloat(e.target.value) || 0 })}
                    onMouseUp={(e) => handleCommitEdit({ kerning: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    id="text-kerning-input"
                    step={stepVal}
                    value={formatUnitValue(activeNode.kerning || 0, activeUnit)}
                    onFocus={handleStartEdit}
                    onChange={(e) => handleTransientEdit({ kerning: toPixels(parseFloat(e.target.value) || 0, activeUnit) })}
                    onBlur={(e) => handleCommitEdit({ kerning: toPixels(parseFloat(e.target.value) || 0, activeUnit) })}
                    style={{ width: "65px" }}
                  />
                </div>
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

      {/* Disc-Attached Tab Settings */}
      {activeNode.type === "discTab" && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Bookmark size={14} />
            Disc Tab Parameters
          </h3>
          <div className="info-card" style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ margin: 0, fontWeight: 500 }}>Perimeter Position</label>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  type="number"
                  id="disctab-angle"
                  value={Math.round(activeNode.angle || 0)}
                  min="0"
                  max="360"
                  onFocus={handleStartEdit}
                  onChange={(e) => handleTransientEdit({ angle: ((parseFloat(e.target.value) || 0) % 360 + 360) % 360 })}
                  onBlur={(e) => handleCommitEdit({ angle: ((parseFloat(e.target.value) || 0) % 360 + 360) % 360 })}
                  style={{ width: "54px", padding: "2px 6px", fontSize: "12px", textAlign: "right" }}
                />
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>°</span>
              </div>
            </div>
            <input
              type="range"
              id="disctab-angle-slider"
              min="0"
              max="360"
              step="1"
              value={Math.round((activeNode.angle || 0) % 360 + 360) % 360}
              onMouseDown={handleStartEdit}
              onTouchStart={handleStartEdit}
              onChange={(e) => handleTransientEdit({ angle: parseFloat(e.target.value) || 0 })}
              onMouseUp={(e) => handleCommitEdit({ angle: parseFloat((e.target as HTMLInputElement).value) || 0 })}
              onTouchEnd={(e) => handleCommitEdit({ angle: parseFloat((e.target as HTMLInputElement).value) || 0 })}
              style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }}
            />
          </div>

          <div className="info-card" style={{ marginBottom: "10px" }}>
            <label>Tab Shape</label>
            <select
              id="disctab-shape-select"
              value={activeNode.tabShape || "semicircular"}
              onChange={(e) => commitImmediateField({ tabShape: e.target.value })}
              style={{
                backgroundColor: "#0b0c0f",
                border: "1px solid #232530",
                borderRadius: "6px",
                color: "#f8fafc",
                padding: "6px",
                fontSize: "13px",
                width: "100%",
                marginTop: "4px",
              }}
            >
              <option value="rectangular">Rectangular</option>
              <option value="semicircular">Semicircular</option>
              <option value="trapezoidal">Trapezoidal</option>
            </select>
          </div>

          <div className="info-card control-double-row" style={{ marginTop: "10px" }}>
            <div>
              <label>Width ({unitSymbol})</label>
              <input
                type="number"
                id="disctab-width"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.width ?? 30, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ width: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ width: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
            <div>
              <label>Height ({unitSymbol})</label>
              <input
                type="number"
                id="disctab-height"
                min="0.1"
                step={stepVal}
                value={formatUnitValue(activeNode.height ?? 18, activeUnit)}
                onFocus={handleStartEdit}
                onChange={(e) => handleTransientEdit({ height: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                onBlur={(e) => handleCommitEdit({ height: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
              />
            </div>
          </div>

          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Corner Radius (px)</label>
            <input
              type="number"
              id="disctab-corner-radius"
              min="0"
              max="50"
              value={activeNode.cornerRadius ?? 4}
              onFocus={handleStartEdit}
              onChange={(e) => handleTransientEdit({ cornerRadius: Math.max(0, parseInt(e.target.value) || 0) })}
              onBlur={(e) => handleCommitEdit({ cornerRadius: Math.max(0, parseInt(e.target.value) || 0) })}
            />
          </div>

          <div className="info-card" style={{ marginTop: "10px" }}>
            <label>Tab Face Label</label>
            <input
              type="text"
              id="disctab-label-input"
              placeholder="Optional text"
              value={localValState.label ?? activeNode.label ?? ""}
              onFocus={handleStartEdit}
              onChange={(e) => {
                setLocalValState((s) => ({ ...s, label: e.target.value }));
                handleTransientEdit({ label: e.target.value });
              }}
              onBlur={(e) => handleCommitEdit({ label: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Vector Color Styling */}
      {activeNode.type !== "window" && (activeNode.style || activeNode.type === "ring" || activeNode.type === "sector") && (
        <div className="sidebar-section">
          <h3 className="section-title">
            <Palette size={14} />
            {activeNode.type === "ring" ? "Ring Style" : "Aesthetic Styles"}
          </h3>
          <div className="info-card control-double-row">
            <div>
              <label>Fill Color</label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
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
                  style={{ width: "32px", height: "32px", padding: 0, border: "none", borderRadius: "4px", cursor: "pointer", background: "none" }}
                />
                <input
                  type="text"
                  id="style-fill-color-hex"
                  value={localValState.fill || "#000000"}
                  placeholder="#000000"
                  onFocus={handleStartEdit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalValState((s) => ({ ...s, fill: val }));
                    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
                      handleTransientEdit({ style: { fill: val } });
                    }
                  }}
                  onBlur={(e) => {
                    let val = e.target.value.trim();
                    if (val && !val.startsWith("#")) val = `#${val}`;
                    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
                      setLocalValState((s) => ({ ...s, fill: val }));
                      handleCommitEdit({ style: { fill: val } });
                    } else {
                      setLocalValState((s) => ({ ...s, fill: activeNode.style?.fill || "#000000" }));
                    }
                  }}
                  style={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    padding: "4px 6px",
                    backgroundColor: "#0b0c0f",
                    border: "1px solid #232530",
                    borderRadius: "4px",
                    color: "#f8fafc",
                    width: "100%",
                  }}
                />
              </div>
            </div>
            <div>
              <label>Stroke Color</label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
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
                  style={{ width: "32px", height: "32px", padding: 0, border: "none", borderRadius: "4px", cursor: "pointer", background: "none" }}
                />
                <input
                  type="text"
                  id="style-stroke-color-hex"
                  value={localValState.stroke || "#000000"}
                  placeholder="#000000"
                  onFocus={handleStartEdit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalValState((s) => ({ ...s, stroke: val }));
                    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
                      handleTransientEdit({ style: { stroke: val } });
                    }
                  }}
                  onBlur={(e) => {
                    let val = e.target.value.trim();
                    if (val && !val.startsWith("#")) val = `#${val}`;
                    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
                      setLocalValState((s) => ({ ...s, stroke: val }));
                      handleCommitEdit({ style: { stroke: val } });
                    } else {
                      setLocalValState((s) => ({ ...s, stroke: activeNode.style?.stroke || "#000000" }));
                    }
                  }}
                  style={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    padding: "4px 6px",
                    backgroundColor: "#0b0c0f",
                    border: "1px solid #232530",
                    borderRadius: "4px",
                    color: "#f8fafc",
                    width: "100%",
                  }}
                />
              </div>
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

      {/* Grab Tab Style (Collapsible, Ring only, below Ring Style) */}
      {activeNode.type === "ring" && (
        <div className="sidebar-section">
          <h3
            className="section-title"
            style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => setIsGrabTabExpanded(!isGrabTabExpanded)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sliders size={14} />
              Grab Tab Style
            </span>
            {isGrabTabExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </h3>
          
          {isGrabTabExpanded && (
            <>
              <div className="info-card control-double-row" style={{ marginTop: "10px" }}>
                <div>
                  <label>Tab Width ({unitSymbol})</label>
                  <input
                    type="number"
                    id="ring-tab-width"
                    min="0.1"
                    step={stepVal}
                    value={formatUnitValue(activeNode.tabWidth ?? 30, activeUnit)}
                    onFocus={handleStartEdit}
                    onChange={(e) => handleTransientEdit({ tabWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                    onBlur={(e) => handleCommitEdit({ tabWidth: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                  />
                </div>
                <div>
                  <label>Tab Height ({unitSymbol})</label>
                  <input
                    type="number"
                    id="ring-tab-height"
                    min="0.1"
                    step={stepVal}
                    value={formatUnitValue(activeNode.tabHeight ?? 20, activeUnit)}
                    onFocus={handleStartEdit}
                    onChange={(e) => handleTransientEdit({ tabHeight: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                    onBlur={(e) => handleCommitEdit({ tabHeight: Math.max(0.1, toPixels(parseFloat(e.target.value) || 0, activeUnit)) })}
                  />
                </div>
              </div>

              <div className="info-card" style={{ marginTop: "10px" }}>
                <label>Tab Shape Style</label>
                <select
                  id="ring-tab-shape-select"
                  value={activeNode.tabShape || "semicircular"}
                  onChange={(e) => commitImmediateField({ tabShape: e.target.value })}
                  style={{
                    backgroundColor: "#0b0c0f",
                    border: "1px solid #232530",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    padding: "6px",
                    fontSize: "13px",
                    width: "100%",
                    marginTop: "4px",
                  }}
                >
                  <option value="rectangular">Rectangular</option>
                  <option value="semicircular">Semicircular</option>
                  <option value="trapezoidal">Trapezoidal</option>
                </select>
              </div>

              <div className="info-card" style={{ marginTop: "10px" }}>
                <label>Tab Custom Label</label>
                <input
                  type="text"
                  id="ring-tab-label-input"
                  placeholder="Default (#index)"
                  value={localValState.tabLabel ?? activeNode.tabLabel ?? ""}
                  onFocus={handleStartEdit}
                  onChange={(e) => {
                    setLocalValState((s) => ({ ...s, tabLabel: e.target.value }));
                    handleTransientEdit({ tabLabel: e.target.value });
                  }}
                  onBlur={(e) => handleCommitEdit({ tabLabel: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Canvas Grid & Drafting Guides */}
      <div className="sidebar-section">
        <h3 className="section-title">
          <Compass size={14} />
          Canvas Grid & Guides
        </h3>
        <div className="info-card" style={{ marginTop: "8px" }}>
          <label>Grid Layer Position</label>
          <select
            value={useViewStore.getState().gridLayer}
            onChange={(e) => useViewStore.getState().setGridLayer(e.target.value as any)}
            style={{
              backgroundColor: "#0b0c0f",
              border: "1px solid #232530",
              borderRadius: "6px",
              color: "#f8fafc",
              padding: "6px",
              fontSize: "12px",
              width: "100%",
              marginTop: "4px",
            }}
          >
            <option value="off">Off (Disabled)</option>
            <option value="background">Grid BG (Behind Paper Discs)</option>
            <option value="foreground">Grid FG (In Front of Artwork)</option>
          </select>
        </div>

        {useViewStore.getState().gridLayer !== "off" && (
          <>
            <div className="info-card" style={{ marginTop: "8px" }}>
              <label>Grid Alignment Mode</label>
              <select
                value={useViewStore.getState().gridMode}
                onChange={(e) => useViewStore.getState().setGridMode(e.target.value as any)}
                style={{
                  backgroundColor: "#0b0c0f",
                  border: "1px solid #232530",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  padding: "6px",
                  fontSize: "12px",
                  width: "100%",
                  marginTop: "4px",
                }}
              >
                <option value="auto-symmetry">Auto-Symmetry (Active Ring)</option>
                <option value="manual">Manual Slice Count</option>
              </select>
            </div>

            <div className="info-card" style={{ marginTop: "8px" }}>
              <label>Grid Line Color Theme</label>
              <select
                value={useViewStore.getState().gridLineColorMode}
                onChange={(e) => useViewStore.getState().setGridLineColorMode(e.target.value as any)}
                style={{
                  backgroundColor: "#0b0c0f",
                  border: "1px solid #232530",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  padding: "6px",
                  fontSize: "12px",
                  width: "100%",
                  marginTop: "4px",
                }}
              >
                <option value="auto">Auto (Dark in FG, Indigo in BG)</option>
                <option value="dark">Dark Charcoal (#0F172A)</option>
                <option value="light">Crisp Light Slate (#F8FAFC)</option>
                <option value="indigo">Vibrant Indigo (#818CF8)</option>
              </select>
            </div>

            {useViewStore.getState().gridMode === "manual" && (
              <div className="info-card" style={{ marginTop: "8px" }}>
                <label>Manual Slice Count (1 - 360)</label>
                <input
                  type="number"
                  min="1"
                  max="360"
                  value={useViewStore.getState().manualSliceCount}
                  onChange={(e) => useViewStore.getState().setManualSliceCount(parseInt(e.target.value) || 1)}
                />
              </div>
            )}

            <div className="info-card control-double-row" style={{ marginTop: "8px" }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                  <input
                    type="checkbox"
                    checked={useViewStore.getState().showSliceGuides}
                    onChange={() => useViewStore.getState().toggleSliceGuides()}
                  />
                  Radial Slices
                </label>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                  <input
                    type="checkbox"
                    checked={useViewStore.getState().showCircularGuides}
                    onChange={() => useViewStore.getState().toggleCircularGuides()}
                  />
                  Circular Rings
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
