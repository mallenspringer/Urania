import React, { useRef, useState, useEffect, useMemo } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { useViewStore } from "../../features/project/viewStore";
import { useProjectStore } from "../../features/project/projectStore";
import { useSelectionStore } from "../../features/selection/selectionStore";
import { resolveProject } from "../../features/runtime/mechanismEngine";
import { ResolvedRenderer } from "./ResolvedRenderer";
import { SelectionHighlights } from "./SelectionHighlights";
import { CanvasGridOverlay } from "./CanvasGridOverlay";
import type { BaseNode } from "../../shared/types/project";
import { useToolStore, useClipboardStore } from "../../features/tools/toolStore";
import { toolRegistry } from "../../features/tools/toolRegistry";
import { findHitNode } from "../../features/tools/selectTool";
import { UpdateNodeCommand, GroupNodesCommand, UngroupNodesCommand, CreateNodeCommand, DeleteMultipleNodesCommand } from "../../features/project/commands";
import { findNodeInTree, findParentNode } from "../../shared/utils/geometry";
import { getArcTextCharPositions } from "../../shared/utils/textGeometry";
import {
  MousePointer,
  Square,
  Circle as CircleIcon,
  Hexagon,
  Eye,
  Type,
  Heading,
  Lock,
  Unlock,
  Moon,
  Star,
  Minus,
  Spline,
  Activity,
  Image as ImageIcon,
  Bookmark,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    zoom,
    pan,
    setZoom,
    setPan,
    resetView,
    gridLayer,
    setGridLayer,
    gridMode,
    setGridMode,
    manualSliceCount,
    setManualSliceCount,
    showCircularGuides,
    toggleCircularGuides,
    gridLineColorMode,
    setGridLineColorMode,
  } = useViewStore();
  const project = useProjectStore((state) => state.project);
  const { activeRingId, selectedItems } = useSelectionStore();

  const {
    activeToolId,
    setActiveTool,
    creationMode,
    setCreationMode,
    symmetryCount,
    setSymmetryCount,
    radialWarpEnabled,
    setRadialWarpEnabled,
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

  const handleGroupAction = () => {
    const selection = useSelectionStore.getState();
    const selectedItems = selection.selectedItems;
    if (selectedItems.length <= 1) return;

    // Verify they share the same parent node in the mechanism tree
    const parentIds = selectedItems.map((item) => {
      const parent = findParentNode(project.mechanism, item.id);
      return parent ? parent.id : null;
    });

    const uniqueParents = Array.from(new Set(parentIds));
    if (uniqueParents.length !== 1 || !uniqueParents[0]) {
      return;
    }

    const parentId = uniqueParents[0];
    const selectedNodes = selectedItems
      .map((item) => findNodeInTree(project.mechanism, item.id))
      .filter(Boolean) as BaseNode[];

    const count = selectedNodes.length;
    const sumX = selectedNodes.reduce((sum, n) => sum + n.transform.x, 0);
    const sumY = selectedNodes.reduce((sum, n) => sum + n.transform.y, 0);
    const cx = sumX / count;
    const cy = sumY / count;

    const groupId = `group-${Math.random().toString(36).substring(2, 9)}`;
    const childrenCopy = selectedNodes.map((n) => {
      const child = JSON.parse(JSON.stringify(n));
      child.transform.x -= cx;
      child.transform.y -= cy;
      return child;
    });

    const groupNode: BaseNode = {
      id: groupId,
      type: "group",
      name: `Group_${groupId.substring(6, 10).toUpperCase()}`,
      visible: true,
      locked: false,
      transform: { x: cx, y: cy, rotation: 0, scaleX: 1, scaleY: 1 },
      children: childrenCopy,
    };

    executeCommand(new GroupNodesCommand(parentId, selectedItems.map((item) => item.id), groupNode));
  };

  const handleUngroupAction = () => {
    const selection = useSelectionStore.getState();
    const selectedItems = selection.selectedItems;
    if (selectedItems.length !== 1 || selectedItems[0].type !== "group") return;

    const groupNode = findNodeInTree(project.mechanism, selectedItems[0].id);
    if (!groupNode || groupNode.type !== "group" || !groupNode.children) return;

    const parent = findParentNode(project.mechanism, groupNode.id);
    if (!parent) return;

    const childNodes = groupNode.children.map((child: any) => {
      const childCopy = JSON.parse(JSON.stringify(child));
      const rotRad = (groupNode.transform.rotation * Math.PI) / 180;
      const cos = Math.cos(rotRad) * groupNode.transform.scaleX;
      const sin = Math.sin(rotRad) * groupNode.transform.scaleY;

      const px = child.transform.x * cos - child.transform.y * sin;
      const py = child.transform.x * sin + child.transform.y * cos;

      childCopy.transform.x = groupNode.transform.x + px;
      childCopy.transform.y = groupNode.transform.y + py;
      childCopy.transform.rotation += groupNode.transform.rotation;
      childCopy.transform.scaleX *= groupNode.transform.scaleX;
      childCopy.transform.scaleY *= groupNode.transform.scaleY;
      return childCopy;
    });

    executeCommand(new UngroupNodesCommand(groupNode.id, parent.id, childNodes));
  };

  const handleCopyAction = () => {
    const selection = useSelectionStore.getState();
    const selectedItems = selection.selectedItems;
    if (selectedItems.length === 0) return;

    const selectedNodes = selectedItems
      .map((item) => findNodeInTree(project.mechanism, item.id))
      .filter(Boolean);
    
    useClipboardStore.getState().setClipboard(selectedNodes);
  };

  const handlePasteAction = () => {
    const clipboardStore = useClipboardStore.getState();
    const clipboard = clipboardStore.clipboard;
    if (!clipboard || clipboard.length === 0) return;

    let targetParentId = activeRingId;
    if (!targetParentId) {
      const firstRing = project.mechanism.children?.find((c) => c.type === "ring");
      if (firstRing) {
        targetParentId = firstRing.id;
      } else {
        targetParentId = project.mechanism.id;
      }
    }

    clipboardStore.incrementPasteCount();
    const count = clipboardStore.pasteCount;
    const offset = 15 * count;

    const selection = useSelectionStore.getState();
    selection.clearSelection();

    const cloneNodeStructure = (node: any): any => {
      const freshId = `${node.type}-${Math.random().toString(36).substring(2, 9)}`;
      const nodeCopy = JSON.parse(JSON.stringify(node));
      nodeCopy.id = freshId;
      if (nodeCopy.name) {
        if (!nodeCopy.name.endsWith(" Copy")) {
          nodeCopy.name += " Copy";
        }
      }
      if (nodeCopy.children) {
        nodeCopy.children = nodeCopy.children.map((child: any) => cloneNodeStructure(child));
      }
      return nodeCopy;
    };

    for (const node of clipboard) {
      const nodeCopy = cloneNodeStructure(node);
      nodeCopy.transform.x += offset;
      nodeCopy.transform.y += offset;

      executeCommand(new CreateNodeCommand(targetParentId, nodeCopy));
      selection.selectItem(nodeCopy.id, nodeCopy.type, true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const imageFiles = files.filter(
        (f) => f.type === "image/png" || f.type === "image/jpeg" || f.type === "image/svg+xml"
      );
      if (imageFiles.length > 0) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const clientX = e.clientX;
          const clientY = e.clientY;
          const dropX = (clientX - rect.left - stageX) / zoom;
          const dropY = (clientY - rect.top - stageY) / zoom;
          processImageFiles(imageFiles, { x: dropX, y: dropY });
        } else {
          processImageFiles(imageFiles);
        }
      }
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const processImageFiles = (files: File[], customCoords?: { x: number; y: number }) => {
    let targetParentId = activeRingId;
    if (!targetParentId) {
      const firstRing = project.mechanism.children?.find((c) => c.type === "ring");
      if (firstRing) {
        targetParentId = firstRing.id;
      } else {
        targetParentId = project.mechanism.id;
      }
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const assetId = `asset-${Math.random().toString(36).substring(2, 9)}`;
        
        const newAsset = {
          id: assetId,
          type: file.type === "image/svg+xml" ? ("svg" as const) : ("image" as const),
          mimeType: file.type,
          embeddedData: dataUrl,
        };

        const updatedAssets = [...(project.assets || []), newAsset];
        setProject({
          ...project,
          assets: updatedAssets,
        });

        const px = customCoords ? customCoords.x : 0;
        const py = customCoords ? customCoords.y : 0;

        const nodeType = file.type === "image/svg+xml" ? "svgAsset" : "image";

        const img = new window.Image();
        img.src = dataUrl;
        img.onload = () => {
          const naturalWidth = img.naturalWidth;
          const naturalHeight = img.naturalHeight;
          const maxDim = 150;
          let w = 100;
          let h = 100;
          if (naturalWidth && naturalHeight) {
            if (naturalWidth > naturalHeight) {
              w = maxDim;
              h = (naturalHeight / naturalWidth) * maxDim;
            } else {
              h = maxDim;
              w = (naturalWidth / naturalHeight) * maxDim;
            }
          }

          const newNode: any = {
            id: `${nodeType}-${Math.random().toString(36).substring(2, 9)}`,
            type: nodeType,
            name: file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
            visible: true,
            locked: false,
            transform: { x: px, y: py, rotation: 0, scaleX: 1, scaleY: 1 },
            assetId: assetId,
            width: w,
            height: h,
            style: {},
            export: { artwork: true, cut: false, fold: false },
          };

          executeCommand(new CreateNodeCommand(targetParentId, newNode));
          useSelectionStore.getState().selectItem(newNode.id, newNode.type, false);
        };
      };
    });
  };

  useEffect(() => {
    if (editingTextNodeId) {
      const node = findNodeInTree(project.mechanism, editingTextNodeId);
      if (node) {
        const val = node.type === "window" && node.shape ? (node.shape.content || "") : (node.content || "");
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
      if (node.type === "window" && node.shape) {
        node.shape.content = val;
      } else {
        node.content = val;
      }
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
      if (node.type === "window" && node.shape) {
        node.shape.content = origVal;
      } else {
        node.content = origVal;
      }
      setProject({
        ...project,
        mechanism: rolledBackMechanism,
      });
    }

    if (finalVal !== origVal) {
      const originalNode = findNodeInTree(project.mechanism, editingTextNodeId);
      const updatedNode = JSON.parse(JSON.stringify(originalNode));
      if (updatedNode.type === "window" && updatedNode.shape) {
        updatedNode.shape.content = finalVal;
      } else {
        updatedNode.content = finalVal;
      }

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
      const isEditingInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";

      if (!isEditingInput && (e.key === "Delete" || e.key === "Backspace")) {
        const selected = useSelectionStore.getState().selectedItems;
        if (selected.length > 0) {
          e.preventDefault();
          executeCommand(new DeleteMultipleNodesCommand(selected.map((s: { id: string }) => s.id)));
        }
        return;
      }

      if (!isEditingInput && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            useProjectStore.getState().redo();
          } else {
            useProjectStore.getState().undo();
          }
          return;
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          useProjectStore.getState().redo();
          return;
        }
        if (e.key.toLowerCase() === "c") {
          e.preventDefault();
          handleCopyAction();
          return;
        }
        if (e.key.toLowerCase() === "v") {
          e.preventDefault();
          handlePasteAction();
          return;
        }
        if (e.key.toLowerCase() === "g") {
          e.preventDefault();
          if (e.shiftKey) {
            handleUngroupAction();
          } else {
            handleGroupAction();
          }
          return;
        }
      }

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
          useSelectionStore.getState().clearSelection();
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
          case "l":
            setActiveTool("create-line");
            break;
          case "b":
            setActiveTool("create-curve");
            break;
          case "u":
            setActiveTool("create-arc");
            break;
          case "d":
            setActiveTool("create-discTab");
            break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    const handlePasteEvent = (e: ClipboardEvent) => {
      const isEditingInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (isEditingInput) return;

      const files: File[] = [];

      // 1. Try to read files from clipboard (e.g. copied files)
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const file = e.clipboardData.files[i];
          if (file.type.startsWith("image/") || file.name.endsWith(".svg")) {
            files.push(file);
          }
        }
      }

      // 2. Fallback to reading items (e.g. screenshots)
      if (files.length === 0 && e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.kind === "file" && (item.type.startsWith("image/") || item.type === "image/svg+xml")) {
            const file = item.getAsFile();
            if (file) {
              files.push(file);
            }
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        if (currentPointer) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const dropX = (currentPointer.x - stageX) / zoom;
            const dropY = (currentPointer.y - stageY) / zoom;
            processImageFiles(files, { x: dropX, y: dropY });
            return;
          }
        }
        processImageFiles(files);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("paste", handlePasteEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("paste", handlePasteEvent);
    };
  }, [previewData, setPreviewData, setDragStartPos, setActiveTool, currentPointer, stageX, stageY, zoom]);

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

          let corners = [];
          if (activeNode.renderData?.isRadialWarp) {
            const r = activeNode.renderData.radialRadius || 100;
            const w = activeNode.bounds.width;
            const h = activeNode.bounds.height;
            const innerRadius = Math.max(0, r - h / 2);
            const outerRadius = r + h / 2;
            const wRad = (w / 2) * Math.PI / 180;

            corners = [
              { name: "top-left", lx: innerRadius * Math.cos(-wRad), ly: innerRadius * Math.sin(-wRad) },
              { name: "top-right", lx: innerRadius * Math.cos(wRad), ly: innerRadius * Math.sin(wRad) },
              { name: "bottom-left", lx: outerRadius * Math.cos(-wRad), ly: outerRadius * Math.sin(-wRad) },
              { name: "bottom-right", lx: outerRadius * Math.cos(wRad), ly: outerRadius * Math.sin(wRad) },
              // Side handles
              { name: "top-mid", lx: innerRadius, ly: 0 },
              { name: "bottom-mid", lx: outerRadius, ly: 0 },
              { name: "left-mid", lx: r * Math.cos(-wRad), ly: r * Math.sin(-wRad) },
              { name: "right-mid", lx: r * Math.cos(wRad), ly: r * Math.sin(wRad) },
            ];
          } else {
            corners = [
              { name: "top-left", lx: bx, ly: by },
              { name: "top-right", lx: bx + width, ly: by },
              { name: "bottom-left", lx: bx, ly: by + height },
              { name: "bottom-right", lx: bx + width, ly: by + height },
              // Side handles
              { name: "top-mid", lx: bx + width / 2, ly: by },
              { name: "bottom-mid", lx: bx + width / 2, ly: by + height },
              { name: "left-mid", lx: bx, ly: by + height / 2 },
              { name: "right-mid", lx: bx + width, ly: by + height / 2 },
            ];
          }

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
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      if (w > 1 && h > 1) {
        const rx = Math.min(x1, x2);
        const ry = Math.min(y1, y2);
        return {
          x: rx,
          y: ry,
          width: w,
          height: h,
        };
      }
    }
    return null;
  }, [activeToolId, previewData]);

  const getCursorForHandle = (handle: string): string => {
    if (handle === "top-left" || handle === "bottom-right") return "nwse-resize";
    if (handle === "top-right" || handle === "bottom-left") return "nesw-resize";
    if (handle === "top-mid" || handle === "bottom-mid") return "ns-resize";
    return "ew-resize"; // left-mid or right-mid
  };

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
      cursorStyle = getCursorForHandle(previewData.handle);
    } else if (hoverState) {
      if (hoverState.handle) {
        cursorStyle = getCursorForHandle(hoverState.handle);
      } else if (hoverState.nodeType === "text" || hoverState.nodeType === "arcText" || hoverState.nodeType === "sectorLabel") {
        cursorStyle = "text";
      } else {
        cursorStyle = "move";
      }
    }
  }

  const section1Tools = [
    { id: "select", icon: <MousePointer className="h-5 w-5" />, label: "Select (V)" },
  ];

  // Tools that can visually deform into arc-slice shapes under Radial Warp.
  // When warp is enabled, ineligible tools are dimmed to signal the feature
  // only applies to shapes placed with these tools.
  const WARP_ELIGIBLE_TOOLS = new Set(["create-rectangle", "create-trapezoid"]);

  const section2Tools = [
    { id: "create-line", icon: <Minus className="h-5 w-5" />, label: creationMode === "cutout" ? "Line Cutout (L)" : "Line (L)" },
    { id: "create-curve", icon: <Spline className="h-5 w-5" />, label: creationMode === "cutout" ? "Curve Cutout (B)" : "Bézier Curve (B)" },
    { id: "create-arc", icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M 4 19 A 14 14 0 0 1 19 4" />
        <circle cx="4" cy="19" r="1.5" fill="currentColor" />
        <circle cx="19" cy="4" r="1.5" fill="currentColor" />
      </svg>
    ), label: creationMode === "cutout" ? "Arc Cutout (U)" : "Circular Arc (U)" },
    { id: "create-rectangle", icon: <Square className="h-5 w-5" />, label: creationMode === "cutout" ? "Rectangle Cutout (R)" : "Rectangle (R)" },
    { id: "create-circle", icon: <CircleIcon className="h-5 w-5" />, label: creationMode === "cutout" ? "Circle Cutout (C)" : "Circle (C)" },
    { id: "create-polygon", icon: <Hexagon className="h-5 w-5" />, label: creationMode === "cutout" ? "Polygon Cutout (P)" : "Polygon (P)" },
    { id: "create-trapezoid", icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <polygon points="7 6 17 6 21 18 3 18" />
      </svg>
    ), label: creationMode === "cutout" ? "Trapezoid Cutout" : "Trapezoid" },
    { id: "create-crescent", icon: <Moon className="h-5 w-5" />, label: creationMode === "cutout" ? "Crescent Cutout" : "Crescent Moon" },
    { id: "create-star", icon: <Star className="h-5 w-5" />, label: creationMode === "cutout" ? "Star Cutout" : "Star" },
    { id: "create-text", icon: <Type className="h-5 w-5" />, label: creationMode === "cutout" ? "Text Cutout (T)" : "Text (T)" },
    { id: "create-arcText", icon: <Heading className="h-5 w-5" />, label: creationMode === "cutout" ? "Arc Text Cutout (A)" : "Arc Text (A)" },
    { id: "create-discTab", icon: <Bookmark className="h-5 w-5" />, label: "Disc Tab (D)" },
    { id: "import-image", icon: <ImageIcon className="h-5 w-5" />, label: "Import Image (I)" },
  ];

  const renderToolButton = (t: { id: string; icon: React.ReactNode; label: string }) => {
    const isActive = activeToolId === t.id;
    // When Radial Warp is enabled, only warp-eligible tools are fully lit.
    // Other creation tools are dimmed to signal they won't produce warped shapes.
    const isWarpDimmed = radialWarpEnabled && t.id !== "select" && !WARP_ELIGIBLE_TOOLS.has(t.id);
    return (
      <button
        key={t.id}
        onClick={() => {
          if (t.id === "import-image") {
            fileInputRef.current?.click();
          } else {
            setActiveTool(t.id);
          }
        }}
        title={isWarpDimmed ? `${t.label} — Radial Warp does not apply to this tool` : t.label}
        style={{
          display: "flex",
          width: "40px",
          height: "40px",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          border: "none",
          background: isActive ? "#6366f1" : "transparent",
          color: isActive ? "#ffffff" : isWarpDimmed ? "#3d4257" : "#94a3b8",
          cursor: "pointer",
          transition: "all 0.2s ease",
          opacity: isWarpDimmed ? 0.4 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isActive && !isWarpDimmed) {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "#ffffff";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = isWarpDimmed ? "#3d4257" : "#94a3b8";
          }
        }}
      >
        {t.icon}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
      {/* Floating Selection Action Toolbar */}
      {selectedItems.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            gap: "8px",
            backgroundColor: "rgba(22, 23, 28, 0.85)",
            backdropFilter: "blur(12px)",
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", color: "#94a3b8", marginRight: "8px", fontFamily: "Outfit, sans-serif" }}>
            {selectedItems.length} selected
          </span>
          
          <button
            onClick={handleCopyAction}
            title="Copy (Ctrl+C)"
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "none",
              background: "rgba(255, 255, 255, 0.06)",
              color: "#f1f5f9",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "Outfit, sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
          >
            Copy
          </button>
          
          {selectedItems.length > 1 && (
            <button
              onClick={handleGroupAction}
              title="Group (Ctrl+G)"
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "none",
                background: "#6366f1",
                color: "white",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
            >
              Group
            </button>
          )}

          {selectedItems.length === 1 && selectedItems[0].type === "group" && (
            <button
              onClick={handleUngroupAction}
              title="Ungroup (Ctrl+Shift+G)"
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "none",
                background: "#6366f1",
                color: "white",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "bold",
                fontFamily: "Outfit, sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#6366f1")}
            >
              Ungroup
            </button>
          )}
        </div>
      )}

      {/* Top Center Symmetry Control Bar */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "5px",
          backgroundColor: "rgba(22, 23, 28, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "4px 12px",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>
          Copies:
        </span>
        {[1, 4, 6, 8, 12, 26, 36, 60].map((count) => (
          <button
            key={count}
            onClick={() => setSymmetryCount(count)}
            title={count === 1 ? "1× Single Placement" : `${count}× Copies (${(360 / count).toFixed(2)}° apart)`}
            style={{
              background: symmetryCount === count ? "#6366f1" : "transparent",
              color: symmetryCount === count ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "12px",
              padding: "3px 8px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {count}×
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", marginLeft: "4px", borderLeft: "1px solid rgba(255, 255, 255, 0.1)", paddingLeft: "6px" }}>
          <input
            type="number"
            min="1"
            max="360"
            value={symmetryCount}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              setSymmetryCount(Math.max(1, Math.min(360, val)));
            }}
            title="Custom Symmetry Multiplier (1 - 360)"
            style={{
              width: "42px",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 700,
              padding: "2px 4px",
              textAlign: "center",
              outline: "none",
            }}
          />
          <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }}>×</span>
        </div>

        {/* Canvas-Wide Grid & Guide Control Bar (3-Way Toggle: Off | Grid BG | Grid FG) */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px", borderLeft: "1px solid rgba(255, 255, 255, 0.12)", paddingLeft: "10px" }}>
          <div style={{ display: "flex", backgroundColor: "rgba(0, 0, 0, 0.4)", borderRadius: "14px", padding: "2px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            {(["off", "background", "foreground"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGridLayer(mode)}
                title={
                  mode === "off"
                    ? "Turn Canvas Grid Off"
                    : mode === "background"
                    ? "Grid Background (rendered behind mechanism paper rings)"
                    : "Grid Foreground (rendered in front of artwork)"
                }
                style={{
                  background: gridLayer === mode ? "#6366f1" : "transparent",
                  color: gridLayer === mode ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {mode === "off" ? "Off" : mode === "background" ? "Grid BG" : "Grid FG"}
              </button>
            ))}
          </div>

          {gridLayer !== "off" && (
            <>
              <button
                onClick={() => setGridMode(gridMode === "auto-symmetry" ? "manual" : "auto-symmetry")}
                title={gridMode === "auto-symmetry" ? "Auto-synced to active ring symmetry. Click to switch to Manual." : "Manual slice lines. Click to switch to Auto-Symmetry."}
                style={{
                  background: gridMode === "auto-symmetry" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  color: gridMode === "auto-symmetry" ? "#34d399" : "#fbbf24",
                  border: gridMode === "auto-symmetry" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {gridMode === "auto-symmetry" ? "Auto-Symmetry" : `Manual (${manualSliceCount})`}
              </button>

              {gridMode === "manual" && (
                <input
                  type="number"
                  min="1"
                  max="360"
                  value={manualSliceCount}
                  onChange={(e) => setManualSliceCount(parseInt(e.target.value) || 1)}
                  title="Manual Grid Slice Count (1 - 360)"
                  style={{
                    width: "42px",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 4px",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
              )}

              <button
                onClick={() => toggleCircularGuides()}
                title={showCircularGuides ? "Hide Concentric Circular Guides" : "Show Concentric Circular Guides"}
                style={{
                  background: showCircularGuides ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  color: showCircularGuides ? "#818cf8" : "#64748b",
                  border: "none",
                  borderRadius: "12px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Circles
              </button>

              <button
                onClick={() => {
                  const nextMap: Record<string, any> = { auto: "dark", dark: "light", light: "indigo", indigo: "auto" };
                  setGridLineColorMode(nextMap[gridLineColorMode] || "auto");
                }}
                title={`Grid Line Color Theme: ${gridLineColorMode.toUpperCase()}. Click to cycle (Auto / Dark / Light / Indigo).`}
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "#cbd5e1",
                  border: "none",
                  borderRadius: "12px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Line: {gridLineColorMode.toUpperCase()}
              </button>
            </>
          )}
          {/* Radial Warp Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginLeft: "8px", borderLeft: "1px solid rgba(255, 255, 255, 0.12)", paddingLeft: "10px" }}>
            <button
              onClick={() => setRadialWarpEnabled(!radialWarpEnabled)}
              title={radialWarpEnabled
                ? "Radial Warp: ON — New rectangles and trapezoids will be deformed into arc-slice shapes. Click to disable."
                : "Radial Warp: OFF — Enable to place rectangles and trapezoids as arc-conforming shapes. Only applies to new placements."}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: radialWarpEnabled ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.04)",
                color: radialWarpEnabled ? "#c084fc" : "#64748b",
                border: radialWarpEnabled ? "1px solid rgba(192, 132, 252, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "2px 10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
                letterSpacing: "0.3px",
              }}
              onMouseEnter={(e) => {
                if (!radialWarpEnabled) {
                  e.currentTarget.style.background = "rgba(99, 102, 241, 0.12)";
                  e.currentTarget.style.color = "#a78bfa";
                  e.currentTarget.style.borderColor = "rgba(167, 139, 250, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!radialWarpEnabled) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                  e.currentTarget.style.color = "#64748b";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                }
              }}
            >
              {/* Arc-slice icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 20 Q12 2 21 20" />
                <path d="M6 16 Q12 7 18 16" />
              </svg>
              Radial Warp
            </button>
          </div>
        </div>
      </div>

      {/* Floating Vertical Toolbox */}
      <div
        style={{
          position: "absolute",
          left: "16px",
          top: "86px",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          backgroundColor: "rgba(22, 23, 28, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "6px",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Section 1: Selection & Mode Switch */}
        {section1Tools.map(renderToolButton)}
        <button
          onClick={() => setCreationMode(creationMode === "solid" ? "cutout" : "solid")}
          title={
            creationMode === "cutout"
              ? "Creation Mode: Window Cutouts (Click for Solid Shapes)"
              : "Creation Mode: Solid Shapes (Click for Window Cutouts)"
          }
          style={{
            display: "flex",
            width: "40px",
            height: "40px",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            border: creationMode === "cutout" ? "1px solid rgba(99, 102, 241, 0.4)" : "none",
            background: creationMode === "cutout" ? "rgba(99, 102, 241, 0.25)" : "transparent",
            color: creationMode === "cutout" ? "#a5b4fc" : "#64748b",
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            if (creationMode !== "cutout") {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (creationMode !== "cutout") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#64748b";
            }
          }}
        >
          <Eye className="h-5 w-5" />
          {creationMode === "cutout" && (
            <span
              style={{
                position: "absolute",
                bottom: "3px",
                right: "3px",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#6366f1",
                boxShadow: "0 0 6px #6366f1",
              }}
            />
          )}
        </button>

        {/* Divider 1 */}
        <div style={{ width: "20px", height: "1px", backgroundColor: "rgba(255, 255, 255, 0.12)", margin: "4px auto" }} />

        {/* Section 2: Shape, Text & Image Creation Tools */}
        {section2Tools.map(renderToolButton)}

        {/* Divider 2 */}
        <div style={{ width: "20px", height: "1px", backgroundColor: "rgba(255, 255, 255, 0.12)", margin: "4px auto" }} />

        {/* Section 4: Tool Keep-Active Lock */}
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
          if (hit) {
            if (hit.type === "text" || hit.type === "arcText" || hit.type === "sectorLabel") {
              setEditingTextNodeId(hit.id);
            } else if (hit.type === "window" && (hit.renderData.shape?.type === "text" || hit.renderData.shape?.type === "arcText")) {
              setEditingTextNodeId(hit.id);
            }
          }
        }}
      >
        <Layer>
          {/* Background Grid Overlay (behind mechanism paper rings) */}
          <CanvasGridOverlay targetPosition="background" />

          <ResolvedRenderer nodes={resolvedNodes} />

          {/* Foreground Grid Overlay (in front of mechanism paper rings) */}
          <CanvasGridOverlay targetPosition="foreground" />

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

        const targetShape = editingNode.type === "window" ? editingNode.renderData.shape : editingNode.renderData;
        const targetType = targetShape?.type || editingNode.type;

        const { x, y, rotation, scaleX, scaleY } = editingNode.worldTransform;
        const rotRad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rotRad) * scaleX;
        const sin = Math.sin(rotRad) * scaleY;

        let wx = x;
        let wy = y;

        if (targetType === "arcText") {
          const content = targetShape?.content || localTextValue || "";
          const radius = targetShape?.radius || 100;
          const startAngle = targetShape?.startAngle || 0;
          const fontSize = targetShape?.fontSize || 12;
          const fontFamily = targetShape?.fontFamily || "Outfit, Inter, sans-serif";
          const kerning = targetShape?.kerning || 0;

          const layout = getArcTextCharPositions(content, radius, startAngle, fontSize, fontFamily, kerning);
          const totalSweep = layout.totalSweep > 0 ? layout.totalSweep : (targetShape?.sweepAngle || 30);
          const centerAngle = startAngle + totalSweep / 2;
          const centerAngleRad = (centerAngle * Math.PI) / 180;

          // Position floating popup radially outward so it never obscures the canvas text
          const radialOffset = radius + fontSize * 1.2 + 50 / zoom;
          const lx = radialOffset * Math.cos(centerAngleRad);
          const ly = radialOffset * Math.sin(centerAngleRad);
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

        const fontSize = targetShape?.fontSize || editingNode.renderData.fontSize || 14;
        const fontFamily = targetShape?.fontFamily || editingNode.renderData.fontFamily || "Outfit, Inter, sans-serif";
        const color = editingNode.type === "window" ? "#6366f1" : (editingNode.renderData.style?.fill || "#cbd5e1");

        const isStandardText = targetType === "text";
        
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

        if (isStandardText) {
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

          return (
            <textarea
              ref={textareaRef}
              value={localTextValue}
              onChange={handleTextChange}
              onKeyDown={handleTextKeyDown}
              onBlur={commitTextEdit}
              style={standardTextStyle}
            />
          );
        }

        const topCenterStyle: React.CSSProperties = {
          position: "absolute",
          top: "70px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 150,
          background: "rgba(15, 23, 42, 0.94)",
          backdropFilter: "blur(12px)",
          border: "1px solid #6366f1",
          borderRadius: "10px",
          padding: "8px 14px",
          boxShadow: "0 16px 36px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: "360px",
          maxWidth: "calc(100vw - 320px)",
        };

        return (
          <div style={topCenterStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "90px" }}>
              <Heading className="h-4 w-4 text-indigo-400" />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Arc Text
              </span>
            </div>
            <input
              type="text"
              ref={textareaRef as any}
              value={localTextValue}
              onChange={(e: any) => handleTextChange(e)}
              onKeyDown={(e: any) => handleTextKeyDown(e)}
              onBlur={commitTextEdit}
              style={{
                flex: 1,
                background: "rgba(30, 41, 59, 0.85)",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#f8fafc",
                fontFamily: fontFamily,
                fontSize: "14px",
                padding: "7px 12px",
                outline: "none",
              }}
              placeholder="Type arc text..."
            />
            <button
              onClick={commitTextEdit}
              style={{
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "7px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              Done
            </button>
          </div>
        );
      })()}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/svg+xml"
        multiple
        style={{ display: "none" }}
        onChange={handleImageFileSelect}
      />
    </div>
  );
};
