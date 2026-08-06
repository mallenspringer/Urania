import React, { useState } from "react";
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  GripVertical,
  Type,
  Square,
  Circle,
  Scissors,
  Tag,
  Image as ImageIcon,
  Sliders,
  PieChart,
} from "lucide-react";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import {
  DeleteRingCommand,
  DeleteNodeCommand,
  UpdateNodeCommand,
  ReorderRingsCommand,
  ReorderChildNodesCommand,
} from "../../features/project/commands";
import type { RingNode, SectorNode, BaseNode } from "../types/project";
import { RING_COLORS } from "../../App";

interface NavigatorTreeProps {
  onDeleteRingConfirm?: (ring: RingNode) => void;
}

export function NavigatorTree({ onDeleteRingConfirm }: NavigatorTreeProps) {
  const { project, executeCommand } = useProjectStore();
  const {
    selectedItems,
    activeItem,
    selectItem,
    activeRingId,
    setActiveRingId,
  } = useSelectionStore();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  const [draggedNode, setDraggedNode] = useState<{ id: string; parentId: string | null; index: number } | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const rings = ((project.mechanism.children || []).filter(
    (c) => c.type === "ring"
  ) as RingNode[]);

  // UI rings order: top-most ring is at index 0 in the list
  const uiRings = [...rings].reverse();

  const handleStartRename = (node: BaseNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingName(node.name || "");
  };

  const handleSaveRename = (node: BaseNode) => {
    if (editingNodeId === node.id && editingName.trim() !== node.name) {
      const updated = { ...node, name: editingName.trim() || node.name };
      executeCommand(new UpdateNodeCommand(node.id, node, updated));
    }
    setEditingNodeId(null);
  };

  const handleToggleVisibility = (node: BaseNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...node, visible: node.visible === false ? true : false };
    executeCommand(new UpdateNodeCommand(node.id, node, updated));
  };

  const handleToggleLock = (node: BaseNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...node, locked: !node.locked };
    executeCommand(new UpdateNodeCommand(node.id, node, updated));
  };

  const handleDeleteNode = (node: BaseNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === "ring") {
      if (onDeleteRingConfirm) {
        onDeleteRingConfirm(node as RingNode);
      } else {
        executeCommand(new DeleteRingCommand(node as RingNode));
      }
    } else {
      executeCommand(new DeleteNodeCommand(node.id));
    }
  };

  const getNodeIcon = (type: string, shape?: string) => {
    switch (type) {
      case "ring":
        return <Sliders size={13} className="node-icon ring-icon" />;
      case "sector":
        return <PieChart size={13} className="node-icon sector-icon" />;
      case "text":
      case "arcText":
        return <Type size={13} className="node-icon text-icon" />;
      case "window":
        return <Scissors size={13} className="node-icon window-icon" />;
      case "tab":
        return <Tag size={13} className="node-icon tab-icon" />;
      case "image":
        return <ImageIcon size={13} className="node-icon image-icon" />;
      default:
        if (shape === "circle") return <Circle size={13} className="node-icon shape-icon" />;
        return <Square size={13} className="node-icon shape-icon" />;
    }
  };

  // Drag and Drop reordering logic for rings & children
  const handleDragStart = (e: React.DragEvent, id: string, parentId: string | null, index: number) => {
    e.stopPropagation();
    setDraggedNode({ id, parentId, index });
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string, parentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNode && draggedNode.parentId === parentId && draggedNode.id !== id) {
      setDragOverNodeId(id);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string, parentId: string | null, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNodeId(null);

    if (!draggedNode || draggedNode.id === targetId || draggedNode.parentId !== parentId) {
      setDraggedNode(null);
      return;
    }

    if (parentId === null) {
      // Reordering top-level rings
      const total = rings.length;
      const fromChildrenIdx = total - 1 - draggedNode.index;
      const toChildrenIdx = total - 1 - targetIndex;
      executeCommand(new ReorderRingsCommand(fromChildrenIdx, toChildrenIdx));
    } else {
      // Reordering child nodes under a parent node
      executeCommand(new ReorderChildNodesCommand(parentId, draggedNode.index, targetIndex));
    }
    setDraggedNode(null);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
    setDragOverNodeId(null);
  };

  const renderChildNode = (child: BaseNode, parentId: string, index: number, depth: number = 1) => {
    const isSelected = selectedItems.some((item) => item.id === child.id);
    const isFocused = activeItem?.id === child.id;
    const isExpanded = expandedNodes[child.id] ?? true;
    const hasChildren = (child.children || []).length > 0;
    const isDragging = draggedNode?.id === child.id;
    const isDragOver = dragOverNodeId === child.id;

    return (
      <div key={child.id} className="tree-node-wrapper">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, child.id, parentId, index)}
          onDragOver={(e) => handleDragOver(e, child.id, parentId)}
          onDrop={(e) => handleDrop(e, child.id, parentId, index)}
          onDragEnd={handleDragEnd}
          className={`tree-node-row ${isSelected ? "selected" : ""} ${isFocused ? "focused" : ""} ${
            child.visible === false ? "is-hidden" : ""
          } ${child.locked ? "is-locked" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => {
            selectItem(child.id, child.type, e.shiftKey || e.ctrlKey || e.metaKey);
          }}
        >
          <span className="drag-handle" title="Drag to reorder">
            <GripVertical size={12} />
          </span>

          {hasChildren ? (
            <button
              className="expand-btn"
              onClick={(e) => toggleExpand(child.id, e)}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="expand-spacer" />
          )}

          {getNodeIcon(child.type, (child as any).shape?.type)}

          {editingNodeId === child.id ? (
            <input
              type="text"
              className="tree-rename-input"
              value={editingName}
              autoFocus
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleSaveRename(child)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename(child);
                if (e.key === "Escape") setEditingNodeId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="node-label"
              onDoubleClick={(e) => handleStartRename(child, e)}
              title="Double click to rename"
            >
              {child.name || `${child.type.charAt(0).toUpperCase() + child.type.slice(1)}`}
            </span>
          )}

          {child.type === "sector" && (
            <span className="sector-span-badge">
              {(child as SectorNode).startAngle || 0}° – {(child as SectorNode).endAngle || 360}°
            </span>
          )}

          <div className="node-actions">
            <button
              className={`action-icon-btn ${child.visible === false ? "inactive" : ""}`}
              onClick={(e) => handleToggleVisibility(child, e)}
              title={child.visible === false ? "Show element" : "Hide element"}
            >
              {child.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>

            <button
              className={`action-icon-btn ${child.locked ? "active-lock" : ""}`}
              onClick={(e) => handleToggleLock(child, e)}
              title={child.locked ? "Unlock element" : "Lock element"}
            >
              {child.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>

            <button
              className="action-icon-btn delete-btn"
              onClick={(e) => handleDeleteNode(child, e)}
              title="Delete element"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Render child elements if expanded */}
        {hasChildren && isExpanded && (
          <div className="tree-children-container">
            {(child.children || []).map((subChild, subIdx) =>
              renderChildNode(subChild, child.id, subIdx, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="navigator-tree-container">
      {uiRings.length === 0 ? (
        <div className="empty-state">
          <Layers size={24} />
          <p>No active rings found</p>
        </div>
      ) : (
        uiRings.map((ring, uiIdx) => {
          const isSelected = selectedItems.some((item) => item.id === ring.id);
          const isFocused = activeRingId === ring.id;
          const isExpanded = expandedNodes[ring.id] ?? true;
          const isDragging = draggedNode?.id === ring.id;
          const isDragOver = dragOverNodeId === ring.id;
          const ringColorIdx = rings.length - 1 - uiIdx;
          const childNodes = ring.children || [];

          return (
            <div key={ring.id} className="tree-ring-group">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, ring.id, null, uiIdx)}
                onDragOver={(e) => handleDragOver(e, ring.id, null)}
                onDrop={(e) => handleDrop(e, ring.id, null, uiIdx)}
                onDragEnd={handleDragEnd}
                className={`tree-ring-header ${isSelected ? "selected" : ""} ${
                  isFocused ? "focused-ring" : ""
                } ${ring.visible === false ? "is-hidden" : ""} ${ring.locked ? "is-locked" : ""} ${
                  isDragging ? "dragging" : ""
                } ${isDragOver ? "drag-over" : ""}`}
                onClick={(e) => {
                  selectItem(ring.id, "ring", e.shiftKey || e.ctrlKey || e.metaKey);
                  setActiveRingId(ring.id);
                }}
              >
                <span className="drag-handle" title="Drag to reorder ring stack">
                  <GripVertical size={13} />
                </span>

                <button
                  className="expand-btn"
                  onClick={(e) => toggleExpand(ring.id, e)}
                  title={isExpanded ? "Collapse Ring" : "Expand Ring"}
                >
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                <span
                  className="ring-index-badge"
                  style={{
                    backgroundColor: RING_COLORS[ringColorIdx % RING_COLORS.length],
                  }}
                  title={`Ring Layer #${uiIdx + 1}`}
                >
                  #{uiIdx + 1}
                </span>

                {editingNodeId === ring.id ? (
                  <input
                    type="text"
                    className="tree-rename-input"
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleSaveRename(ring)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(ring);
                      if (e.key === "Escape") setEditingNodeId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="ring-title"
                    onDoubleClick={(e) => handleStartRename(ring, e)}
                    title="Double click to rename"
                  >
                    {ring.name || `Ring (${ring.id.substring(0, 4)})`}
                  </span>
                )}

                <div className="node-actions">
                  <button
                    className={`action-icon-btn ${ring.visible === false ? "inactive" : ""}`}
                    onClick={(e) => handleToggleVisibility(ring, e)}
                    title={ring.visible === false ? "Show Ring" : "Hide Ring"}
                  >
                    {ring.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>

                  <button
                    className={`action-icon-btn ${ring.locked ? "active-lock" : ""}`}
                    onClick={(e) => handleToggleLock(ring, e)}
                    title={ring.locked ? "Unlock Ring" : "Lock Ring"}
                  >
                    {ring.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>

                  <button
                    className="action-icon-btn delete-btn"
                    onClick={(e) => handleDeleteNode(ring, e)}
                    title="Delete Ring"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Ring Children Tree */}
              {isExpanded && childNodes.length > 0 && (
                <div className="tree-children-container">
                  {childNodes.map((child, idx) => renderChildNode(child, ring.id, idx, 1))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
