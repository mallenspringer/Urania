import { useEffect, useRef, useMemo, useState } from "react";
import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Info,
  Sliders,
  Layers,
  FileCode,
  AlertTriangle,
  XCircle,
  Home,
  ArrowRight,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useProjectStore } from "./features/project/projectStore";
import { useSelectionStore } from "./features/selection/selectionStore";
import { useViewStore } from "./features/project/viewStore";
import { useValidationStore } from "./features/validation/validationStore";
import { findRingForNode } from "./shared/utils/geometry";
import { formatUnitValue, toPixels, getUnitSymbol, type Unit } from "./shared/utils/unitConversion";
import { resolveProject } from "./features/runtime/mechanismEngine";
import type {
  Project,
  RingNode,
} from "./shared/types/project";
import {
  CreateRingCommand,
  DeleteRingCommand,
  RotateRingCommand,
  ReorderRingsCommand,
  UpdateNodeCommand,
} from "./features/project/commands";
import { CanvasWorkspace } from "./shared/ui/CanvasWorkspace";
import { InspectorPanel } from "./shared/ui/InspectorPanel";
import { ExportModal } from "./shared/ui/ExportModal";
import { DeleteLayerModal } from "./shared/ui/DeleteLayerModal";
import { Dashboard } from "./shared/ui/Dashboard";
import { IntroLoader } from "./shared/ui/IntroLoader";
import {
  cloneProjectWithNewIds,
  loadAutosave,
  saveAutosave,
  saveBackup,
} from "./features/templates/templateManager";
import type { Template } from "./features/templates/templateLibrary";
import "./App.css";

export const RING_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#06b6d4", // Cyan
];

export default function App() {
  const { project, past, future, setProject, executeCommand, undo, redo } =
    useProjectStore();
  const {
    selectedItems,
    activeItem,
    selectItem,
    activeRingId,
    setActiveRingId,
  } = useSelectionStore();

  const activeUnit: Unit = project.settings.units || "pixels";
  const unitSymbol = getUnitSymbol(activeUnit);
  const stepVal = activeUnit === "pixels" ? 1 : activeUnit === "inches" ? 0.01 : 0.1;

  const resolvedNodes = useMemo(() => resolveProject(project), [project]);

  const {
    zoom,
    setPan,
    isLeftSidebarOpen,
    isRightSidebarOpen,
    toggleLeftSidebar,
    toggleRightSidebar,
  } = useViewStore();
  const { issues, autoRepairDuplicates } = useValidationStore();
  const [activeSidebarTab, setActiveSidebarTab] = useState<"rings" | "validation">("rings");
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCanvasInteractionModal, setShowCanvasInteractionModal] = useState(true);

  // Responsive auto-collapse and auto-restore on window resize
  const prevWidthRef = useRef<number>(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const prevW = prevWidthRef.current;
      prevWidthRef.current = w;

      if (w < 960 && prevW >= 960) {
        useViewStore.getState().setRightSidebarOpen(false);
      }
      if (w < 640 && prevW >= 640) {
        useViewStore.getState().setLeftSidebarOpen(false);
      }

      if (w >= 960 && prevW < 960) {
        useViewStore.getState().setRightSidebarOpen(true);
        useViewStore.getState().setLeftSidebarOpen(true);
      } else if (w >= 640 && prevW < 640) {
        useViewStore.getState().setLeftSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Ring Card Drag & Drop reordering state
  const [draggedCardIdx, setDraggedCardIdx] = useState<number | null>(null);
  const [dragOverCardIdx, setDragOverCardIdx] = useState<number | null>(null);

  // Dashboard routing states
  const [showDashboard, setShowDashboard] = useState(true);
  const [hasActiveProjectEdited, setHasActiveProjectEdited] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);
  const [autosaveMetadata, setAutosaveMetadata] = useState<{ name: string; updatedAt: string } | null>(null);
  const [isAnimatingIntro, setIsAnimatingIntro] = useState(false);

  // Load autosave manifest on mount
  useEffect(() => {
    const saved = loadAutosave();
    if (saved) {
      setHasAutosave(true);
      setAutosaveMetadata({
        name: saved.metadata.name,
        updatedAt: saved.metadata.updatedAt || new Date().toISOString(),
      });
    }
  }, []);

  // Sync to autosave when project changes
  useEffect(() => {
    if (hasActiveProjectEdited) {
      const timer = setTimeout(() => {
        saveAutosave(project);
        setHasAutosave(true);
        setAutosaveMetadata({
          name: project.metadata.name,
          updatedAt: new Date().toISOString(),
        });
      }, 1000); // debounce 1 second to avoid excessive writes
      return () => clearTimeout(timer);
    }
  }, [project, hasActiveProjectEdited]);

  // Sync backup every 5 history stack changes
  const lastBackupCount = useRef(0);
  useEffect(() => {
    if (past.length > 0 && past.length !== lastBackupCount.current) {
      if (past.length % 5 === 0) {
        saveBackup(project);
      }
      lastBackupCount.current = past.length;
    }
  }, [past.length, project]);

  const handleInspectIssue = (entityId?: string, entityType?: string) => {
    if (!entityId) return;

    selectItem(entityId, entityType || "ring", false);
    if (entityType === "ring") {
      setActiveRingId(entityId);
    } else {
      const ringId = findRingForNode(project, entityId);
      if (ringId) {
        setActiveRingId(ringId);
      }
    }

    const resolved = resolvedNodes.find((n) => n.id === entityId);
    if (resolved && resolved.worldTransform) {
      const { x: wx, y: wy } = resolved.worldTransform;
      setPan({ x: -wx * zoom, y: -wy * zoom });
    }
  };

  const startAnglesRef = useRef<Record<string, number>>({});

  const rings = (project.mechanism.children || []).filter(
    (c) => c.type === "ring"
  ) as RingNode[];

  // Reverse list so top-most ring is at index 0 in the UI card stack
  const uiRings = useMemo(() => {
    return [...rings].reverse();
  }, [rings]);

  // Automatically select the top-most ring on canvas load or if activeRingId is null/invalid
  useEffect(() => {
    if (showDashboard) return;
    const topRing = uiRings[0];
    if (!topRing) return;

    const isCurrentRingValid = activeRingId && rings.some((r) => r.id === activeRingId);
    if (!isCurrentRingValid) {
      setActiveRingId(topRing.id);
    }
  }, [showDashboard, uiRings, activeRingId, rings, setActiveRingId]);

  const handleCardDragStart = (e: React.DragEvent, uiIdx: number) => {
    e.dataTransfer.setData("text/plain", uiIdx.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedCardIdx(uiIdx);
  };

  const handleCardDragOver = (e: React.DragEvent, uiIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCardIdx !== uiIdx) {
      setDragOverCardIdx(uiIdx);
    }
  };

  const handleCardDrop = (e: React.DragEvent, targetUiIdx: number) => {
    e.preventDefault();
    setDragOverCardIdx(null);
    const sourceUiIdx =
      draggedCardIdx ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    setDraggedCardIdx(null);

    if (isNaN(sourceUiIdx) || sourceUiIdx === targetUiIdx) return;

    const total = rings.length;
    const fromChildrenIdx = total - 1 - sourceUiIdx;
    const toChildrenIdx = total - 1 - targetUiIdx;

    const cmd = new ReorderRingsCommand(fromChildrenIdx, toChildrenIdx);
    executeCommand(cmd);
  };

  const handleCardDragEnd = () => {
    setDraggedCardIdx(null);
    setDragOverCardIdx(null);
  };

  // Undo / Redo controls
  const handleUndo = () => undo();
  const handleRedo = () => redo();

  // Template picking / loading callbacks
  const handleSelectTemplate = (template: Template) => {
    const fresh = cloneProjectWithNewIds(template.project, template.manifest.id, template.manifest.version);
    setProject(fresh);
    useProjectStore.getState().clearHistory();
    setHasActiveProjectEdited(true);
    setShowDashboard(false);
    setIsAnimatingIntro(true);
  };

  const handleLoadProject = (projectJson: string) => {
    const loaded = JSON.parse(projectJson) as Project;
    setProject(loaded);
    useProjectStore.getState().clearHistory();
    setHasActiveProjectEdited(true);
    setShowDashboard(false);
    setIsAnimatingIntro(true);
  };

  const handleResumeAutosave = () => {
    const saved = loadAutosave();
    if (saved) {
      setProject(saved);
      useProjectStore.getState().clearHistory();
      setHasActiveProjectEdited(true);
      setShowDashboard(false);
      setIsAnimatingIntro(true);
    }
  };

  const handleResumeActiveProject = () => {
    setShowDashboard(false);
    setIsAnimatingIntro(true);
  };

  // Add / Remove Rings
  const handleAddRing = () => {
    const id = crypto.randomUUID();
    const newRing: RingNode = {
      id,
      type: "ring",
      name: `User Ring (${id.substring(0, 4)})`,
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      innerRadius: 40,
      outerRadius: 90,
      rotation: 0,
      children: [],
    };
    const cmd = new CreateRingCommand(newRing);
    executeCommand(cmd);
  };

  const [ringPendingDelete, setRingPendingDelete] = useState<RingNode | null>(null);

  const handleDeleteRing = (ring: RingNode) => {
    const skipWarning = localStorage.getItem("URANIA_SKIP_DELETE_LAYER_CONFIRM") === "true";
    if (skipWarning) {
      executeCommand(new DeleteRingCommand(ring));
    } else {
      setRingPendingDelete(ring);
    }
  };

  const handleConfirmDeleteRing = (dontAskAgain: boolean) => {
    if (!ringPendingDelete) return;
    if (dontAskAgain) {
      localStorage.setItem("URANIA_SKIP_DELETE_LAYER_CONFIRM", "true");
    }
    executeCommand(new DeleteRingCommand(ringPendingDelete));
    setRingPendingDelete(null);
  };

  const handleToggleRingVisibility = (ring: RingNode) => {
    const isCurrentlyHidden = ring.visible === false;
    const updatedRing: RingNode = {
      ...ring,
      visible: isCurrentlyHidden ? true : false,
    };
    const cmd = new UpdateNodeCommand(ring.id, ring, updatedRing);
    executeCommand(cmd);
  };

  // Real-time slider drag updates (no history pollution)
  const handleRotationStart = (ringId: string, currentRot: number) => {
    if (startAnglesRef.current[ringId] === undefined) {
      startAnglesRef.current[ringId] = currentRot;
    }
  };

  const handleRotationChange = (ringId: string, newRot: number) => {
    const children = project.mechanism.children || [];
    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: children.map((c) =>
          c.id === ringId && c.type === "ring" ? { ...c, rotation: newRot } : c
        ),
      },
    };
    setProject(updated);
  };

  const handleRotationEnd = (ringId: string, finalRot: number) => {
    const startRot = startAnglesRef.current[ringId];
    if (startRot !== undefined && startRot !== finalRot) {
      const cmd = new RotateRingCommand(ringId, startRot, finalRot);
      executeCommand(cmd);
    }
    delete startAnglesRef.current[ringId];
  };

  // Ring dimension modifications directly on active state
  const handleRadiusChange = (
    ringId: string,
    field: "innerRadius" | "outerRadius",
    val: number
  ) => {
    const children = project.mechanism.children || [];
    const updated = {
      ...project,
      mechanism: {
        ...project.mechanism,
        children: children.map((c) =>
          c.id === ringId && c.type === "ring" ? { ...c, [field]: val } : c
        ),
      },
    };
    setProject(updated);
  };

  return (
    <div className="app-container">
      {/* Top Header Panel */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo">U</div>
          <div>
            <h1>Urania</h1>
            <p className="subtitle">Vovelle Modeler</p>
          </div>
        </div>

        <div className="header-actions">
          {showDashboard ? (
            hasActiveProjectEdited && (
              <button onClick={() => setShowDashboard(false)} className="btn btn-primary">
                Back to Editor
                <ArrowRight size={14} />
              </button>
            )
          ) : (
            <>
              <button
                onClick={() => setShowDashboard(true)}
                className="home-nav-btn"
                title="Go to Dashboard"
              >
                <Home size={14} />
                <span>Home</span>
              </button>

              {/* History Stack Controls */}
              <div className="history-controls">
                <button
                  onClick={handleUndo}
                  disabled={past.length === 0}
                  title="Undo"
                  className="action-btn"
                >
                  <Undo2 size={16} />
                  <span className="badge">{past.length}</span>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  title="Redo"
                  className="action-btn"
                >
                  <Redo2 size={16} />
                  <span className="badge">{future.length}</span>
                </button>
              </div>

              <button onClick={() => setShowExportModal(true)} className="btn btn-secondary">
                <FileCode size={14} />
                Export Project
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace split / Dashboard */}
      {showDashboard ? (
        <Dashboard
          onSelectTemplate={handleSelectTemplate}
          onLoadProject={handleLoadProject}
          onResumeAutosave={handleResumeAutosave}
          onResumeActiveProject={handleResumeActiveProject}
          hasActiveProject={hasActiveProjectEdited}
          hasAutosave={hasAutosave}
          autosaveMetadata={autosaveMetadata}
        />
      ) : (
        <main className="app-main">
          {/* Left Control Panel */}
          <aside className={`sidebar ${isLeftSidebarOpen ? "" : "collapsed"}`}>
            {/* Volvelle Details Card */}
            <div className="sidebar-section">
              <div className="info-card">
                <label>Project Name</label>
                <input
                  type="text"
                  value={project.metadata.name}
                  onChange={(e) =>
                    setProject({
                      ...project,
                      metadata: { ...project.metadata, name: e.target.value },
                    })
                  }
                />
                <label>Description</label>
                <textarea
                  value={project.metadata.description}
                  rows={2}
                  onChange={(e) =>
                    setProject({
                      ...project,
                      metadata: {
                        ...project.metadata,
                        description: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* Tabbed Concentric Ring Controls & Validation Issues Panel */}
            <div className="sidebar-section fill-section">
              <div className="sidebar-tabs">
                <button
                  className={`tab-btn ${activeSidebarTab === "rings" ? "active" : ""}`}
                  onClick={() => setActiveSidebarTab("rings")}
                >
                  <Sliders size={13} />
                  Rings
                </button>
                <button
                  className={`tab-btn ${activeSidebarTab === "validation" ? "active" : ""}`}
                  onClick={() => setActiveSidebarTab("validation")}
                >
                  <AlertTriangle size={13} />
                  Issues
                  {issues.length > 0 && (
                    <span className={`tab-badge ${issues.some(i => i.severity === "error") ? "has-errors" : "only-warnings"}`}>
                      {issues.length}
                    </span>
                  )}
                </button>
              </div>

              {activeSidebarTab === "rings" ? (
                <div className="tab-panel-content">
                  {/* Relocated Rings Stack Header Bar with Add Ring Button */}
                  <div className="rings-header-bar">
                    <span className="rings-header-title">
                      <Layers size={13} />
                      Rings Stack ({rings.length})
                    </span>
                    <button
                      onClick={handleAddRing}
                      className="btn btn-sm btn-primary"
                      title="Add a new concentric ring layer"
                    >
                      <Plus size={13} />
                      Add Ring
                    </button>
                  </div>

                  {/* Selection Breadcrumb info bar */}
                  {selectedItems.length > 0 && (
                    <div className="selection-info-bar">
                      <span className="info-bar-title">Selected ({selectedItems.length}):</span>
                      <div className="selected-tags">
                        {selectedItems.map((item) => {
                          const name =
                            resolvedNodes.find((n) => n.id === item.id)?.name ||
                            item.id.substring(0, 4);
                          const isActive = activeItem?.id === item.id;
                          return (
                            <span
                              key={item.id}
                              className={`selection-tag ${isActive ? "active-tag" : ""}`}
                              onClick={() => selectItem(item.id, item.type, false)}
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rings-list">
                    {uiRings.length === 0 ? (
                      <div className="empty-state">
                        <Layers size={24} />
                        <p>No active rings found</p>
                        <button onClick={handleAddRing} className="btn btn-sm btn-primary">
                          Create One
                        </button>
                      </div>
                    ) : (
                      uiRings.map((ring, uiIdx) => {
                        const isSelected = selectedItems.some((item) => item.id === ring.id);
                        const isFocused = activeRingId === ring.id;
                        const isDragging = draggedCardIdx === uiIdx;
                        const isDragOver = dragOverCardIdx === uiIdx;
                        const ringColorIdx = rings.length - 1 - uiIdx;

                        return (
                          <div
                            key={ring.id}
                            draggable
                            onDragStart={(e) => handleCardDragStart(e, uiIdx)}
                            onDragOver={(e) => handleCardDragOver(e, uiIdx)}
                            onDrop={(e) => handleCardDrop(e, uiIdx)}
                            onDragEnd={handleCardDragEnd}
                            className={`ring-control-card ${isSelected ? "selected" : ""} ${
                              isFocused ? "focused-ring" : ""
                            } ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""} ${
                              ring.visible === false ? "is-hidden" : ""
                            }`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (
                                target.tagName !== "INPUT" &&
                                target.tagName !== "TEXTAREA" &&
                                target.tagName !== "BUTTON" &&
                                !target.closest("button")
                              ) {
                                selectItem(
                                  ring.id,
                                  "ring",
                                  e.shiftKey || e.ctrlKey || e.metaKey
                                );
                                setActiveRingId(ring.id);
                              }
                            }}
                          >
                            <div className="card-header">
                              <span className="drag-handle" title="Drag to reorder layer stack">
                                <GripVertical size={14} />
                              </span>
                              <span
                                className="ring-index"
                                style={{
                                  backgroundColor: RING_COLORS[ringColorIdx % RING_COLORS.length],
                                  color: "#fff",
                                }}
                                title={uiIdx === 0 ? "Top-most Ring Layer" : uiIdx === uiRings.length - 1 ? "Base Ring Layer" : `Ring Layer #${uiIdx + 1}`}
                              >
                                #{uiIdx + 1}
                              </span>
                              <input
                                type="text"
                                className="ring-name-input"
                                value={ring.name || ""}
                                onChange={(e) => {
                                  const name = e.target.value;
                                  setProject({
                                    ...project,
                                    mechanism: {
                                      ...project.mechanism,
                                      children: (project.mechanism.children || []).map((c) =>
                                        c.id === ring.id ? { ...c, name } : c
                                      ),
                                    },
                                  });
                                }}
                              />
                              <div className="card-header-actions">
                                <button
                                  onClick={() => handleToggleRingVisibility(ring)}
                                  className={`toggle-visible-btn ${ring.visible === false ? "hidden-layer" : ""}`}
                                  title={ring.visible === false ? "Show Ring Layer" : "Hide Ring Layer"}
                                >
                                  {ring.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  onClick={() => handleDeleteRing(ring)}
                                  className="delete-btn"
                                  title="Delete Ring"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="card-body">
                              {/* Active Rotation Control Slider */}
                              <div className="control-row">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
                                  <label style={{ margin: 0 }}>Rotation Angle</label>
                                  <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      max="360"
                                      className="ring-rotation-number-input"
                                      style={{
                                        width: "60px",
                                        padding: "2px 4px",
                                        fontSize: "11px",
                                        textAlign: "right",
                                        backgroundColor: "#0b0c0f",
                                        border: "1px solid #232530",
                                        color: "#f8fafc",
                                        borderRadius: "4px",
                                      }}
                                      value={ring.rotation ?? 0}
                                      onFocus={() => handleRotationStart(ring.id, ring.rotation)}
                                      onChange={(e) => {
                                        const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        if (!isNaN(val)) {
                                          handleRotationChange(ring.id, val);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        handleRotationEnd(ring.id, val);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                    />
                                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>°</span>
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="360"
                                  step="1"
                                  value={ring.rotation}
                                  onMouseDown={() =>
                                    handleRotationStart(ring.id, ring.rotation)
                                  }
                                  onChange={(e) =>
                                    handleRotationChange(ring.id, parseFloat(e.target.value))
                                  }
                                  onMouseUp={(e) =>
                                    handleRotationEnd(
                                      ring.id,
                                      parseFloat((e.target as HTMLInputElement).value)
                                    )
                                  }
                                />
                              </div>

                              {/* Dimensional Boundary Controllers */}
                              <div className="control-double-row">
                                <div>
                                  <label>Inner Rad ({unitSymbol})</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step={stepVal}
                                    value={formatUnitValue(ring.innerRadius || 0, activeUnit)}
                                    onChange={(e) =>
                                      handleRadiusChange(
                                        ring.id,
                                        "innerRadius",
                                        Math.max(0, toPixels(parseFloat(e.target.value) || 0, activeUnit))
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label>Outer Rad ({unitSymbol})</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step={stepVal}
                                    value={formatUnitValue(ring.outerRadius || 100, activeUnit)}
                                    onChange={(e) =>
                                      handleRadiusChange(
                                        ring.id,
                                        "outerRadius",
                                        Math.max(0, toPixels(parseFloat(e.target.value) || 0, activeUnit))
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="tab-panel-content">
                  {issues.length === 0 ? (
                    <div className="validation-empty-state">
                      <div className="success-icon">✓</div>
                      <p>No issues detected!</p>
                      <span className="subtitle">Your circular mechanism structure is completely valid.</span>
                    </div>
                  ) : (
                    <div className="issues-list">
                      {issues.map((issue) => {
                        const isError = issue.severity === "error";
                        const isWarning = issue.severity === "warning";
                        return (
                          <div
                            key={issue.id}
                            className={`issue-card ${issue.severity}`}
                            onClick={() => handleInspectIssue(issue.entityId, issue.entityType)}
                          >
                            <div className="issue-card-header">
                              <span className={`issue-severity-badge ${issue.severity}`}>
                                {isError ? <XCircle size={11} /> : isWarning ? <AlertTriangle size={11} /> : <Info size={11} />}
                                {issue.severity}
                              </span>
                              <span className="issue-code">{issue.code}</span>
                            </div>
                            <p className="issue-message">{issue.message}</p>
                            {issue.code === "DUPLICATE_UUID" && (
                              <button
                                className="btn btn-sm btn-repair"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  autoRepairDuplicates();
                                }}
                              >
                                Auto-Repair Duplicates
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Help Link */}
            <div className="sidebar-section footer-info">
              <button
                className="btn btn-sm btn-secondary"
                style={{ width: "100%", justifyContent: "center", gap: "6px" }}
                onClick={() => setShowCanvasInteractionModal(true)}
              >
                <FileCode size={13} /> Canvas Interaction
              </button>
            </div>
          </aside>

          {/* Viewport canvas workspace */}
          <section className="viewport-container">
            {/* Left Sidebar Toggle Seam Handle */}
            <button
              className="sidebar-toggle-tab left-toggle"
              onClick={toggleLeftSidebar}
              title={isLeftSidebarOpen ? "Collapse Left Sidebar" : "Expand Left Sidebar"}
            >
              {isLeftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            <CanvasWorkspace />

            {/* Right Sidebar Toggle Seam Handle */}
            <button
              className="sidebar-toggle-tab right-toggle"
              onClick={toggleRightSidebar}
              title={isRightSidebarOpen ? "Collapse Inspector Panel" : "Expand Inspector Panel"}
            >
              {isRightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </section>

          {/* Right Properties Inspector Panel */}
          <InspectorPanel onDeleteRing={handleDeleteRing} />
        </main>
      )}

      {showExportModal && (
        <ExportModal
          project={project}
          onClose={() => setShowExportModal(false)}
        />
      )}      {ringPendingDelete && (
        <DeleteLayerModal
          ring={ringPendingDelete}
          onConfirm={handleConfirmDeleteRing}
          onCancel={() => setRingPendingDelete(null)}
        />
      )}

      {showCanvasInteractionModal && !showDashboard && (
        <div className="modal-backdrop" onClick={() => setShowCanvasInteractionModal(false)} style={{ zIndex: 2000 }}>
          <div
            className="export-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "280px", width: "90%", padding: "14px 16px", borderRadius: "10px" }}
          >
            <div className="modal-header" style={{ marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #232530" }}>
              <div className="modal-title-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileCode size={16} className="modal-icon" style={{ color: "#818cf8" }} />
                <h2 style={{ fontSize: "13px", margin: 0, color: "#f8fafc", fontWeight: 700 }}>Canvas Interaction</h2>
              </div>
              <button
                className="btn-icon"
                onClick={() => setShowCanvasInteractionModal(false)}
                title="Close Modal"
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
              >
                <XCircle size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ color: "#cbd5e1", fontSize: "11px" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.04)", padding: "6px 8px", borderRadius: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>Scroll Wheel</span>
                  <span style={{ color: "#818cf8", fontWeight: 700 }}>Zoom</span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.04)", padding: "6px 8px", borderRadius: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>Spacebar + Drag</span>
                  <span style={{ color: "#818cf8", fontWeight: 700 }}>Pan Canvas</span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.04)", padding: "6px 8px", borderRadius: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>Middle Mouse Drag</span>
                  <span style={{ color: "#818cf8", fontWeight: 700 }}>Pan Canvas</span>
                </li>
              </ul>
            </div>
            <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowCanvasInteractionModal(false)}
                style={{ padding: "4px 12px", fontSize: "11px", borderRadius: "5px" }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {isAnimatingIntro && (
        <IntroLoader onComplete={() => setIsAnimatingIntro(false)} />
      )}
    </div>
  );
}
