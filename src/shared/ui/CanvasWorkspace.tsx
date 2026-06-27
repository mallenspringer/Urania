import React, { useRef, useState, useEffect, useMemo } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { useViewStore } from "../../features/project/viewStore";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { resolveProject } from "../../features/runtime/mechanismEngine";
import { ResolvedRenderer } from "./ResolvedRenderer";
import { SelectionHighlights } from "./SelectionHighlights";
import { useToolStore } from "../../features/tools/toolStore";
import { toolRegistry } from "../../features/tools/toolRegistry";
import { findHitNode } from "../../features/tools/selectTool";
import { UpdateNodeCommand } from "../../features/project/commands";
import { findNodeInTree } from "../../shared/utils/geometry";
import {
  MousePointer,
  Square,
  Circle as CircleIcon,
  Hexagon,
  Eye,
  Type,
  Heading,
  Compass,
  RotateCw,
  Lock,
  Unlock,
} from "lucide-react";

export const CanvasWorkspace: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [currentPointer, setCurrentPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoverState, setHoverState] = useState<{ handle: string | null; nodeId: string | null; nodeType: string | null } | null>(null);
  const [localTextValue, setLocalTextValue] = useState("");
  const originalTextRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { zoom, pan, setZoom, setPan, resetView } = useViewStore();
  const project = useProjectStore((state) => state.project);
  const { activeRingId } = useSelectionStore();

  const {
    activeToolId,
    setActiveTool,
    isToolLocked,
    setToolLocked,
    previewData,
    setPreviewData,
    dragStartPos,
    setDragStartPos,
  } = useToolStore();

  const activeTool = toolRegistry.getTool(activeToolId);
  const resolvedNodes = useMemo(() => resolveProject(project), [project]);

  const { editingTextNodeId, setEditingTextNodeId } = useToolStore();
  const { setProject, executeCommand } = useProjectStore();

  useEffect(() => {
    if (editingTextNodeId) {
      const node = findNodeInTree(project.mechanism, editingTextNodeId);
      if (node) {
        const val = node.content || "";
        setLocalTextValue(val);
        originalTextRef.current = val;
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
          }
        }, 50);
      }
    } else {
      setLocalTextValue("");
      originalTextRef.current = "";
    }
  }, [editingTextNodeId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalTextValue(val);

    const updatedMechanism = JSON.parse(JSON.stringify(project.mechanism));
    const node = findNodeInTree(updatedMechanism, editingTextNodeId!);
    if (node) {
      node.content = val;
      setProject({
        ...project,
        mechanism: updatedMechanism,
      });
    }
  };

  const commitTextEdit = () => {
    if (!editingTextNodeId) return;

    const finalVal = localTextValue;
    const origVal = originalTextRef.current;

    // Rollback transient change so command can execute cleanly
    const rolledBackMechanism = JSON.parse(JSON.stringify(project.mechanism));
    const node = findNodeInTree(rolledBackMechanism, editingTextNodeId);
    if (node) {
      node.content = origVal;
      setProject({
        ...project,
        mechanism: rolledBackMechanism,
      });
    }

    if (finalVal !== origVal) {
      const originalNode = findNodeInTree(project.mechanism, editingTextNodeId);
      const updatedNode = JSON.parse(JSON.stringify(originalNode));
      updatedNode.content = finalVal;

      executeCommand(new UpdateNodeCommand(editingTextNodeId, originalNode, updatedNode));
    }

    setEditingTextNodeId(null);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitTextEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      const rolledBackMechanism = JSON.parse(JSON.stringify(project.mechanism));
      const node = findNodeInTree(rolledBackMechanism, editingTextNodeId!);
      if (node) {
        node.content = originalTextRef.current;
        setProject({
          ...project,
          mechanism: rolledBackMechanism,
        });
      }
      setEditingTextNodeId(null);
    }
  };

  // Track size of container
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const stageX = dimensions.width / 2 + pan.x;
  const stageY = dimensions.height / 2 + pan.y;

  const createToolContext = (pointer: { x: number; y: number } | null, start: { x: number; y: number } | null, e?: any) => {
    const wx = pointer ? (pointer.x - stageX) / zoom : null;
    const wy = pointer ? (pointer.y - stageY) / zoom : null;

    return {
      project,
      zoom,
      pan,
      stageWidth: dimensions.width,
      stageHeight: dimensions.height,
      activeRingId,
      pointerPos: wx !== null && wy !== null ? { x: wx, y: wy } : null,
      startPos: start,
      executeCommand: useProjectStore.getState().executeCommand,
      updatePreview: setPreviewData,
      currentPreviewData: previewData,
      isShift: e ? e.evt?.shiftKey || e.shiftKey : false,
      isAlt: e ? e.evt?.altKey || e.altKey : false,
    };
  };

  // Keyboard listeners for space bar, Escape, and shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (
          document.activeElement === document.body ||
          document.activeElement?.tagName === "MAIN"
        ) {
          e.preventDefault();
        }
        setIsSpacePressed(true);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (previewData) {
          setPreviewData(null);
          setDragStartPos(null);
        } else if (editingTextNodeId) {
          // Rollback transient changes
          const rolledBackMechanism = JSON.parse(JSON.stringify(project.mechanism));
          const node = findNodeInTree(rolledBackMechanism, editingTextNodeId);
          if (node) {
            node.content = originalTextRef.current;
            setProject({
              ...project,
              mechanism: rolledBackMechanism,
            });
          }
          setEditingTextNodeId(null);
        } else {
          setActiveTool("select");
        }
        return;
      }

      if (e.key === "Enter") {
        const selectStore = useSelectionStore.getState();
        const activeItem = selectStore.activeItem;
        if (activeItem && (activeItem.type === "text" || activeItem.type === "arcText" || activeItem.type === "sectorLabel")) {
          e.preventDefault();
          setEditingTextNodeId(activeItem.id);
          return;
        }
      }

      if (
        document.activeElement === document.body ||
        document.activeElement?.tagName === "MAIN"
      ) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            break;
          case "r":
            setActiveTool("create-rectangle");
            break;
          case "c":
            setActiveTool("create-circle");
            break;
          case "p":
            setActiveTool("create-polygon");
            break;
          case "w":
            setActiveTool("create-window-circle");
            break;
          case "t":
            setActiveTool("create-text");
            break;
          case "a":
            setActiveTool("create-arcText");
            break;
          case "g":
            if (e.shiftKey) {
              setActiveTool("create-guide-circular");
            } else {
              setActiveTool("create-guide-radial");
            }
            break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [previewData, setPreviewData, setDragStartPos, setActiveTool]);

  const handleMouseDown = (e: any) => {
    const isMiddleButton = e.evt.button === 1;
    const isSpaceDrag = e.evt.button === 0 && isSpacePressed;

    if (isMiddleButton || isSpaceDrag) {
      e.evt.preventDefault();
      setIsPanning(true);
      dragStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    if (e.evt.button === 0) {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      if (pointer) {
        const wx = (pointer.x - stageX) / zoom;
        const wy = (pointer.y - stageY) / zoom;
        setDragStartPos({ x: wx, y: wy });

        const context = createToolContext(pointer, { x: wx, y: wy }, e);
        if (activeTool?.onMouseDown) {
          activeTool.onMouseDown(e, context);
        }
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    setCurrentPointer(pointer);

    if (isPanning) {
      e.evt.preventDefault();
      const dx = e.evt.clientX - dragStartRef.current.x;
      const dy = e.evt.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      setPan({ x: pan.x + dx, y: pan.y + dy });
      return;
    }

    // Dynamic hover calculation for Select Tool cursor style
    if (activeToolId === "select" && !isPanning && !isSpacePressed && (!previewData || !previewData.isDragging)) {
      const wx = (pointer.x - stageX) / zoom;
      const wy = (pointer.y - stageY) / zoom;
      
      const selectStore = useSelectionStore.getState();
      const activeItem = selectStore.activeItem;
      let foundHover = null;

      // Check active node handles first
      if (activeItem) {
        const activeNode = resolvedNodes.find((n) => n.id === activeItem.id);
        if (activeNode && activeNode.type !== "ring" && activeNode.type !== "sector") {
          const { x, y, rotation, scaleX, scaleY } = activeNode.worldTransform;
          const { x: bx, y: by, width, height } = activeNode.bounds;
          const rotRad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rotRad) * scaleX;
          const sin = Math.sin(rotRad) * scaleY;

          const corners = [
            { name: "top-left", lx: bx, ly: by },
            { name: "top-right", lx: bx + width, ly: by },
            { name: "bottom-left", lx: bx, ly: by + height },
            { name: "bottom-right", lx: bx + width, ly: by + height },
          ];

          for (const corner of corners) {
            const hwx = x + (corner.lx * cos - corner.ly * sin);
            const hwy = y + (corner.lx * sin + corner.ly * cos);
            const dist = Math.hypot(wx - hwx, wy - hwy);
            if (dist < 8 / zoom) {
              foundHover = { handle: corner.name, nodeId: activeItem.id, nodeType: activeItem.type };
              break;
            }
          }
        }
      }

      if (!foundHover) {
        // Check node body
        const hit = findHitNode({ x: wx, y: wy }, resolvedNodes, createToolContext(pointer, null));
        if (hit && hit.type !== "ring" && hit.type !== "sector") {
          foundHover = { handle: null, nodeId: hit.id, nodeType: hit.type };
        }
      }

      setHoverState(foundHover);
    } else {
      if (hoverState) setHoverState(null);
    }

    const context = createToolContext(pointer, dragStartPos, e);
    if (activeTool?.onMouseMove) {
      activeTool.onMouseMove(e, context);
    }
  };

  const handleMouseUp = (e: any) => {
    setIsPanning(false);
    setHoverState(null);

    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    const currentPos = pointer || currentPointer || { x: stageX, y: stageY };

    const context = createToolContext(currentPos, dragStartPos, e);
    if (activeTool?.onMouseUp) {
      activeTool.onMouseUp(e, context);
    }
    setDragStartPos(null);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = zoom;
    const scaleBy = 1.1;
    const direction = e.evt.deltaY < 0 ? 1 : -1;

    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.05, Math.min(64.0, newScale));

    const mousePointTo = {
      x: (pointer.x - (dimensions.width / 2 + pan.x)) / oldScale,
      y: (pointer.y - (dimensions.height / 2 + pan.y)) / oldScale,
    };

    const newPan = {
      x: pointer.x - mousePointTo.x * newScale - dimensions.width / 2,
      y: pointer.y - mousePointTo.y * newScale - dimensions.height / 2,
    };

    setZoom(newScale);
    setPan(newPan);
  };

  const marqueeRect = useMemo(() => {
    if (activeToolId === "select" && previewData && previewData.isDragging) {
      const { x1, y1, x2, y2 } = previewData;
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      return {
        x: rx,
        y: ry,
        width: Math.max(0.1, Math.abs(x2 - x1)),
        height: Math.max(0.1, Math.abs(y2 - y1)),
      };
    }
    return null;
  }, [activeToolId, previewData]);

  let cursorStyle = activeTool?.cursor || "default";
  if (isPanning) {
    cursorStyle = "grabbing";
  } else if (isSpacePressed) {
    cursorStyle = "grab";
  } else if (activeToolId === "select") {
    if (previewData?.isDragging) {
      cursorStyle = "crosshair";
    } else if (previewData?.isDraggingNode) {
      cursorStyle = "move";
    } else if (previewData?.isResizing) {
      const h = previewData.handle;
      cursorStyle = (h === "top-left" || h === "bottom-right") ? "nwse-resize" : "nesw-resize";
    } else if (hoverState) {
      if (hoverState.handle) {
        const h = hoverState.handle;
        cursorStyle = (h === "top-left" || h === "bottom-right") ? "nwse-resize" : "nesw-resize";
      } else if (hoverState.nodeType === "text" || hoverState.nodeType === "arcText" || hoverState.nodeType === "sectorLabel") {
        cursorStyle = "text";
      } else {
        cursorStyle = "move";
      }
    }
  }

  const toolsList = [
    { id: "select", icon: <MousePointer className="h-5 w-5" />, label: "Select (V)" },
    { id: "create-rectangle", icon: <Square className="h-5 w-5" />, label: "Rectangle (R)" },
    { id: "create-circle", icon: <CircleIcon className="h-5 w-5" />, label: "Circle (C)" },
    { id: "create-polygon", icon: <Hexagon className="h-5 w-5" />, label: "Polygon (P)" },
    { id: "create-window-circle", icon: <Eye className="h-5 w-5" />, label: "Circle Window (W)" },
    { id: "create-text", icon: <Type className="h-5 w-5" />, label: "Text (T)" },
    { id: "create-arcText", icon: <Heading className="h-5 w-5" />, label: "Arc Text (A)" },
    { id: "create-guide-radial", icon: <Compass className="h-5 w-5" />, label: "Radial Guide (G)" },
    { id: "create-guide-circular", icon: <RotateCw className="h-5 w-5" />, label: "Circular Guide (Shift+G)" },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#111216",
        cursor: cursorStyle,
        userSelect: "none",
      }}
    >
      {/* Floating Vertical Toolbox */}
      <div
        style={{
          position: "absolute",
          left: "16px",
          top: "16px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          backgroundColor: "rgba(22, 23, 28, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "8px",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {toolsList.map((t) => {
          const isActive = activeToolId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              title={t.label}
              style={{
                display: "flex",
                width: "40px",
                height: "40px",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                border: "none",
                background: isActive ? "#6366f1" : "transparent",
                color: isActive ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }
              }}
            >
              {t.icon}
            </button>
          );
        })}
        <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <button
          onClick={() => setToolLocked(!isToolLocked)}
          title={isToolLocked ? "Tool Keep-Active: Locked" : "Tool Keep-Active: Unlocked"}
          style={{
            display: "flex",
            width: "40px",
            height: "40px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            border: "none",
            background: isToolLocked ? "rgba(245, 158, 11, 0.15)" : "transparent",
            color: isToolLocked ? "#f59e0b" : "#64748b",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isToolLocked) {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (!isToolLocked) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = isToolLocked ? "#f59e0b" : "#64748b";
            }
          }}
        >
          {isToolLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
        </button>
      </div>

      {/* Zoom / Reset controller UI overlay in bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          zIndex: 10,
          display: "flex",
          gap: "8px",
          backgroundColor: "rgba(22, 23, 28, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          color: "#f1f5f9",
          fontFamily: "Outfit, Inter, sans-serif",
          fontSize: "12px",
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <button
          onClick={() => resetView()}
          style={{
            background: "#6366f1",
            border: "none",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "11px",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
        >
          Reset
        </button>
      </div>

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={stageX}
        y={stageY}
        scaleX={zoom}
        scaleY={zoom}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDblClick={(e) => {
          const stage = e.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (!pointer) return;
          const wx = (pointer.x - stageX) / zoom;
          const wy = (pointer.y - stageY) / zoom;
          const hit = findHitNode({ x: wx, y: wy }, resolvedNodes, createToolContext(pointer, null));
          if (hit && (hit.type === "text" || hit.type === "arcText" || hit.type === "sectorLabel")) {
            setEditingTextNodeId(hit.id);
          }
        }}
      >
        <Layer>
          <ResolvedRenderer nodes={resolvedNodes} />

          {/* Marquee outline Rect element */}
          {marqueeRect && (
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="rgba(99, 102, 241, 0.08)"
              stroke="#818cf8"
              strokeWidth={1}
              dash={[3, 3]}
            />
          )}

          {/* Active Tool Preview Graphic */}
          {activeTool?.renderPreview &&
            activeTool.renderPreview(createToolContext(currentPointer, dragStartPos))}

          {/* Visual selection outline overlays */}
          <SelectionHighlights nodes={resolvedNodes} />
        </Layer>
      </Stage>

      {/* Inline Text Editing Overlay */}
      {editingTextNodeId && (() => {
        const editingNode = resolvedNodes.find((n) => n.id === editingTextNodeId);
        if (!editingNode) return null;

        const { x, y, rotation, scaleX, scaleY } = editingNode.worldTransform;
        const rotRad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rotRad) * scaleX;
        const sin = Math.sin(rotRad) * scaleY;

        let wx = x;
        let wy = y;

        if (editingNode.type === "arcText") {
          const centerAngle = (editingNode.renderData.startAngle || 0) + (editingNode.renderData.sweepAngle || 0) / 2;
          const centerAngleRad = (centerAngle * Math.PI) / 180;
          const radius = editingNode.renderData.radius || 100;
          const lx = radius * Math.cos(centerAngleRad);
          const ly = radius * Math.sin(centerAngleRad);
          wx = x + (lx * cos - ly * sin);
          wy = y + (lx * sin + ly * cos);
        } else {
          const bx = editingNode.bounds.x;
          const by = editingNode.bounds.y;
          wx = x + (bx * cos - by * sin);
          wy = y + (bx * sin + by * cos);
        }

        const screenX = dimensions.width / 2 + pan.x + wx * zoom;
        const screenY = dimensions.height / 2 + pan.y + wy * zoom;

        const fontSize = editingNode.renderData.fontSize || 14;
        const fontFamily = editingNode.renderData.fontFamily || "Outfit, Inter, sans-serif";
        const color = editingNode.renderData.style?.fill || "#cbd5e1";

        const isStandardText = editingNode.type === "text";
        
        const baseStyle: React.CSSProperties = {
          position: "absolute",
          left: `${screenX}px`,
          top: `${screenY}px`,
          fontFamily: fontFamily,
          fontSize: `${fontSize * zoom}px`,
          color: color,
          outline: "none",
          resize: "none",
          margin: 0,
          zIndex: 100,
          lineHeight: 1,
        };

        const standardTextStyle: React.CSSProperties = {
          ...baseStyle,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: 0,
          width: `${Math.max(40, editingNode.bounds.width * zoom + 32)}px`,
          height: `${Math.max(20, fontSize * zoom * 1.3)}px`,
          overflow: "hidden",
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "0 0",
        };

        const overlayStyle: React.CSSProperties = {
          ...baseStyle,
          background: "rgba(22, 23, 28, 0.95)",
          backdropFilter: "blur(4px)",
          border: "1px solid #6366f1",
          borderRadius: "6px",
          padding: "6px 10px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          width: `${Math.max(160, editingNode.bounds.width * zoom + 32)}px`,
          height: `${Math.max(36, fontSize * zoom * 1.5 + 12)}px`,
          transform: "translate(-50%, -50%)",
        };

        const style = isStandardText ? standardTextStyle : overlayStyle;

        return (
          <textarea
            ref={textareaRef}
            value={localTextValue}
            onChange={handleTextChange}
            onKeyDown={handleTextKeyDown}
            onBlur={commitTextEdit}
            style={style}
          />
        );
      })()}
    </div>
  );
};
