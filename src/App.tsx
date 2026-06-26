import React, { useEffect, useRef } from "react";
import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  RotateCw,
  Info,
  Sliders,
  Layers,
  FileCode,
} from "lucide-react";
import { useProjectStore } from "./features/project/projectStore";
import {
  CreateRingCommand,
  DeleteRingCommand,
  RotateRingCommand,
} from "./features/project/commands";
import { CanvasWorkspace } from "./shared/ui/CanvasWorkspace";
import type {
  Project,
  RingNode,
  SectorNode,
  WindowNode,
  ArcTextNode,
  CircleNode,
} from "./shared/types/project";
import "./App.css";

const DEMO_VOLVELLE: Project = {
  format: "urania",
  version: "1.0.0",
  mechanismType: "volvelle",
  metadata: {
    name: "Urania Lunar & Solar Calendar",
    author: "Antigravity Team",
    description:
      "A dual-ring paper computer demonstrating window reveal masks, polar text alignment, and concentric ring layouts.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  settings: {
    units: "pixels",
    canvasSize: { width: 800, height: 800 },
  },
  assets: [],
  mechanism: {
    id: "volvelle-root",
    type: "volvelle",
    name: "Volvelle Root",
    visible: true,
    locked: false,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    children: [
      // Bottom Layer Ring: Calendar Seasons & Months
      {
        id: "ring-calendar-base",
        type: "ring",
        name: "Base Calendar Ring",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 100,
        outerRadius: 220,
        rotation: 0,
        children: [
          // Spring Sector (0 - 90 deg)
          {
            id: "sector-spring",
            type: "sector",
            name: "Spring",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            startAngle: 0,
            endAngle: 90,
            children: [
              {
                id: "label-spring-arc",
                type: "arcText",
                name: "Spring Arc Text",
                visible: true,
                locked: false,
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                style: { fill: "#10b981" },
                export: { artwork: true, cut: false, fold: false },
                content: "SPRING EQUINOX",
                radius: 170,
                startAngle: 10,
                sweepAngle: 70,
                fontFamily: "Outfit, sans-serif",
                fontSize: 14,
              } as ArcTextNode,
            ],
          } as SectorNode,
          // Summer Sector (90 - 180 deg)
          {
            id: "sector-summer",
            type: "sector",
            name: "Summer",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            startAngle: 90,
            endAngle: 180,
            children: [
              {
                id: "label-summer-arc",
                type: "arcText",
                name: "Summer Arc Text",
                visible: true,
                locked: false,
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                style: { fill: "#eab308" },
                export: { artwork: true, cut: false, fold: false },
                content: "SUMMER SOLSTICE",
                radius: 170,
                startAngle: 10,
                sweepAngle: 70,
                fontFamily: "Outfit, sans-serif",
                fontSize: 14,
              } as ArcTextNode,
            ],
          } as SectorNode,
          // Autumn Sector (180 - 270 deg)
          {
            id: "sector-autumn",
            type: "sector",
            name: "Autumn",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            startAngle: 180,
            endAngle: 270,
            children: [
              {
                id: "label-autumn-arc",
                type: "arcText",
                name: "Autumn Arc Text",
                visible: true,
                locked: false,
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                style: { fill: "#f97316" },
                export: { artwork: true, cut: false, fold: false },
                content: "AUTUMN EQUINOX",
                radius: 170,
                startAngle: 10,
                sweepAngle: 70,
                fontFamily: "Outfit, sans-serif",
                fontSize: 14,
              } as ArcTextNode,
            ],
          } as SectorNode,
          // Winter Sector (270 - 360 deg)
          {
            id: "sector-winter",
            type: "sector",
            name: "Winter",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            startAngle: 270,
            endAngle: 360,
            children: [
              {
                id: "label-winter-arc",
                type: "arcText",
                name: "Winter Arc Text",
                visible: true,
                locked: false,
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                style: { fill: "#3b82f6" },
                export: { artwork: true, cut: false, fold: false },
                content: "WINTER SOLSTICE",
                radius: 170,
                startAngle: 10,
                sweepAngle: 70,
                fontFamily: "Outfit, sans-serif",
                fontSize: 14,
              } as ArcTextNode,
            ],
          } as SectorNode,
        ],
      } as RingNode,

      // Top Layer Ring: Revealing Cover with cutout windows & indicators
      {
        id: "ring-masking-cover",
        type: "ring",
        name: "Top Masking Dial",
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        innerRadius: 0,
        outerRadius: 220,
        rotation: 45, // Init rotated to show alignment
        children: [
          // Reveal Window 1 (circular hole at radius 170, revealing season text)
          {
            id: "window-reveal-circle",
            type: "window",
            name: "Season Window",
            visible: true,
            locked: false,
            transform: { x: 170, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            style: {},
            export: { artwork: false, cut: true, fold: false },
            shape: {
              id: "window-circle-shape",
              type: "circle",
              visible: true,
              locked: false,
              transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
              style: {},
              export: { artwork: false, cut: true, fold: false },
              radius: 40,
            } as CircleNode,
          } as WindowNode,
          // Decorative border ring on the cover
          {
            id: "decorative-inner-circle",
            type: "circle",
            name: "Inner Circle Divider",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            style: { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.05)" },
            export: { artwork: true, cut: false, fold: false },
            radius: 110,
          } as any,
          // Header title text along the inner dial
          {
            id: "label-cover-title",
            type: "arcText",
            name: "Cover Label Arc",
            visible: true,
            locked: false,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            style: { fill: "#d946ef" },
            export: { artwork: true, cut: false, fold: false },
            content: "✦ URANIA VOLVELLE COMPUTER ✦",
            radius: 85,
            startAngle: -150,
            sweepAngle: 300,
            fontFamily: "Outfit, sans-serif",
            fontSize: 11,
          } as ArcTextNode,
        ],
      } as RingNode,
    ],
  },
};

export default function App() {
  const { project, past, future, setProject, executeCommand, undo, redo } =
    useProjectStore();

  const startAnglesRef = useRef<Record<string, number>>({});

  // Seed demo project if workspace is empty
  useEffect(() => {
    const children = project.mechanism.children || [];
    if (children.length === 0) {
      setProject(JSON.parse(JSON.stringify(DEMO_VOLVELLE)));
    }
  }, []);

  const rings = (project.mechanism.children || []).filter(
    (c) => c.type === "ring"
  ) as RingNode[];

  // Undo / Redo controls
  const handleUndo = () => undo();
  const handleRedo = () => redo();

  // Load Demo manual button
  const handleLoadDemo = () => {
    setProject(JSON.parse(JSON.stringify(DEMO_VOLVELLE)));
    useProjectStore.getState().clearHistory();
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

  const handleDeleteRing = (ring: RingNode) => {
    const cmd = new DeleteRingCommand(ring);
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
            <p className="subtitle">Circular Paper Mechanism Modeler</p>
          </div>
        </div>

        <div className="header-actions">
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

          <button onClick={handleLoadDemo} className="btn btn-secondary">
            <RotateCw size={14} />
            Reset Demo
          </button>

          <button onClick={handleAddRing} className="btn btn-primary">
            <Plus size={14} />
            Add Ring
          </button>
        </div>
      </header>

      {/* Main Workspace split */}
      <main className="app-main">
        {/* Left Control Panel */}
        <aside className="sidebar">
          {/* Volvelle Details Card */}
          <div className="sidebar-section">
            <h3 className="section-title">
              <Info size={14} />
              Mechanism Metadata
            </h3>
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

          {/* Active Ring Controller list */}
          <div className="sidebar-section fill-section">
            <h3 className="section-title">
              <Sliders size={14} />
              Concentric Ring Controls
            </h3>
            <div className="rings-list">
              {rings.length === 0 ? (
                <div className="empty-state">
                  <Layers size={24} />
                  <p>No active rings found</p>
                  <button onClick={handleAddRing} className="btn btn-sm btn-primary">
                    Create One
                  </button>
                </div>
              ) : (
                rings.map((ring, idx) => (
                  <div key={ring.id} className="ring-control-card">
                    <div className="card-header">
                      <span className="ring-index">#{rings.length - idx}</span>
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
                      <button
                        onClick={() => handleDeleteRing(ring)}
                        className="delete-btn"
                        title="Delete Ring"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="card-body">
                      {/* Active Rotation Control Slider */}
                      <div className="control-row">
                        <label>
                          Rotation: <span>{Math.round(ring.rotation)}°</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="360"
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
                          <label>Inner Radius</label>
                          <input
                            type="number"
                            min="0"
                            max={ring.outerRadius - 5}
                            value={ring.innerRadius}
                            onChange={(e) =>
                              handleRadiusChange(
                                ring.id,
                                "innerRadius",
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                          />
                        </div>
                        <div>
                          <label>Outer Radius</label>
                          <input
                            type="number"
                            min={ring.innerRadius + 5}
                            max="500"
                            value={ring.outerRadius}
                            onChange={(e) =>
                              handleRadiusChange(
                                ring.id,
                                "outerRadius",
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="sidebar-section footer-info">
            <div className="help-box">
              <h4>
                <FileCode size={13} /> Canvas Interaction
              </h4>
              <ul>
                <li>
                  <strong>Scroll Wheel</strong>: Logarithmic Zoom
                </li>
                <li>
                  <strong>Spacebar + Drag</strong>: Pan Viewport
                </li>
                <li>
                  <strong>Middle Mouse Drag</strong>: Pan Viewport
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Viewport canvas workspace */}
        <section className="viewport-container">
          <CanvasWorkspace />
        </section>
      </main>
    </div>
  );
}
