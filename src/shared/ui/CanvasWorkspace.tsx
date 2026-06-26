import React, { useRef, useState, useEffect, useMemo } from "react";
import { Stage, Layer } from "react-konva";
import { useViewStore } from "../../features/project/viewStore";
import { useProjectStore } from "../../features/project/projectStore";
import { resolveProject } from "../../features/runtime/mechanismEngine";
import { ResolvedRenderer } from "./ResolvedRenderer";

export const CanvasWorkspace: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const { zoom, pan, setZoom, setPan, resetView } = useViewStore();
  const project = useProjectStore((state) => state.project);

  const resolvedNodes = useMemo(() => resolveProject(project), [project]);

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

  // Track spacebar state
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
  }, []);

  // Panning mouse events
  const handleMouseDown = (e: any) => {
    const isMiddleButton = e.evt.button === 1;
    const isSpaceDrag = e.evt.button === 0 && isSpacePressed;
    if (isMiddleButton || isSpaceDrag) {
      e.evt.preventDefault();
      setIsPanning(true);
      dragStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isPanning) return;
    e.evt.preventDefault();
    const dx = e.evt.clientX - dragStartRef.current.x;
    const dy = e.evt.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
    setPan({ x: pan.x + dx, y: pan.y + dy });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zooming mouse events
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

  const handleStageClick = (e: any) => {
    // If we clicked on the background stage itself
    if (e.target === e.target.getStage()) {
      // Clear selection state (to be integrated in selection store later)
      console.log("Clicked background - clearing selection");
    }
  };

  const stageX = dimensions.width / 2 + pan.x;
  const stageY = dimensions.height / 2 + pan.y;

  const cursorStyle = isPanning ? "grabbing" : isSpacePressed ? "grab" : "default";

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#111216", // Premium very dark slate background
        cursor: cursorStyle,
        userSelect: "none",
      }}
    >
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
        onClick={handleStageClick}
      >
        <Layer>
          <ResolvedRenderer nodes={resolvedNodes} />
        </Layer>
      </Stage>
    </div>
  );
};
