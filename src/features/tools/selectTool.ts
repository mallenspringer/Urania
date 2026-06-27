import type { Tool } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import {
  findRingForNode,
  findNodeInTree,
  findParentNode,
  isDescendantOf,
  isPointInsideNode,
  isPointInsideWindow,
  isNodeTouchedByMarquee,
} from "../../shared/utils/geometry";
import { useSelectionStore } from "../selection/selectionStore";
import { useProjectStore } from "../project/projectStore";
import { UpdateNodeCommand } from "../project/commands";
import { Matrix2D } from "../../shared/utils/matrix";

export function findHitNode(
  pointer: { x: number; y: number },
  resolvedNodes: any[],
  context: any
): any | null {
  const wx = pointer.x;
  const wy = pointer.y;
  const candidates: any[] = [];

  for (let i = resolvedNodes.length - 1; i >= 0; i--) {
    const node = resolvedNodes[i];
    if (node.visible && isPointInsideNode({ x: wx, y: wy }, node)) {
      const nodeObj = findNodeInTree(context.project.mechanism, node.id);
      const isLocked = nodeObj ? nodeObj.locked : false;
      if (isLocked) continue;

      // Check if masked
      if (node.maskIds && node.maskIds.length > 0) {
        const isRevealed = node.maskIds.every((maskId: string) => {
          const maskRingId = findRingForNode(context.project, maskId);
          if (maskRingId) {
            const maskRing = resolvedNodes.find((n) => n.id === maskRingId);
            if (maskRing && maskRing.visible && isPointInsideNode({ x: wx, y: wy }, maskRing)) {
              const maskNode = resolvedNodes.find((n) => n.id === maskId);
              if (!maskNode) return true;
              return isPointInsideWindow({ x: wx, y: wy }, maskNode);
            }
          }
          return true;
        });
        if (!isRevealed) continue;
      }

      candidates.push(node);
    }
  }

  if (candidates.length === 0) return null;

  const getSelectionPriority = (type: string): number => {
    switch (type) {
      case "ring":
        return 4;
      case "sector":
        return 3;
      case "window":
        return 2;
      default:
        return 1;
    }
  };

  const pri1 = candidates.filter((c) => getSelectionPriority(c.type) === 1);
  const pri2 = candidates.filter((c) => getSelectionPriority(c.type) === 2);
  const pri3 = candidates.filter((c) => getSelectionPriority(c.type) === 3);
  const pri4 = candidates.filter((c) => getSelectionPriority(c.type) === 4);

  const activeRingId = context.activeRingId;

  if (pri1.length > 0) {
    let target = pri1[0];
    if (activeRingId) {
      const activeCandidate = pri1.find((c) => findRingForNode(context.project, c.id) === activeRingId);
      if (activeCandidate) target = activeCandidate;
    }
    return target;
  } else if (pri2.length > 0) {
    let target = pri2[0];
    if (activeRingId) {
      const activeCandidate = pri2.find((c) => findRingForNode(context.project, c.id) === activeRingId);
      if (activeCandidate) target = activeCandidate;
    }
    return target;
  } else if (pri3.length > 0) {
    let target = pri3[0];
    if (activeRingId) {
      const activeCandidate = pri3.find((c) => findRingForNode(context.project, c.id) === activeRingId);
      if (activeCandidate) target = activeCandidate;
    }
    return target;
  } else {
    let target = pri4[0];
    if (activeRingId) {
      const activeCandidate = pri4.find((r) => r.id === activeRingId);
      if (activeCandidate) target = activeCandidate;
    }
    return target;
  }
}

export const selectTool: Tool = {
  id: "select",
  label: "Select",
  icon: "MousePointer",
  cursor: "default",
  category: "selection",

  onMouseDown(e, context) {
    if (e.evt.button === 0) {
      const pointer = context.pointerPos;
      if (!pointer) return;

      const selectStore = useSelectionStore.getState();
      const activeItem = selectStore.activeItem;
      const resolvedNodes = resolveProject(context.project);

      // A. Check if clicked a resize handle of the active node
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

          let clickedHandle = null;
          for (const corner of corners) {
            const hwx = x + (corner.lx * cos - corner.ly * sin);
            const hwy = y + (corner.lx * sin + corner.ly * cos);
            const dist = Math.hypot(pointer.x - hwx, pointer.y - hwy);
            if (dist < 8 / context.zoom) {
              clickedHandle = corner.name;
              break;
            }
          }

          if (clickedHandle) {
            // Start resizing!
            const nodeObj = findNodeInTree(context.project.mechanism, activeItem.id);
            context.updatePreview({
              isResizing: true,
              nodeId: activeItem.id,
              nodeType: activeItem.type,
              handle: clickedHandle,
              originalNode: JSON.parse(JSON.stringify(nodeObj)),
              x1: pointer.x,
              y1: pointer.y,
            });
            return;
          }
        }
      }

      // B. Click-to-select & Drag-to-move detection
      const hit = findHitNode(pointer, resolvedNodes, context);
      if (hit) {
        // If not already selected, select it
        const isAlreadySelected = selectStore.selectedItems.some((item) => item.id === hit.id);
        if (!isAlreadySelected) {
          selectStore.selectItem(hit.id, hit.type, context.isShift);
          const associatedRingId = findRingForNode(context.project, hit.id);
          if (associatedRingId) {
            selectStore.setActiveRingId(associatedRingId);
          }
        }

        // If it's a ring or sector, we don't drag-to-move its position directly
        if (hit.type !== "ring" && hit.type !== "sector") {
          const nodeObj = findNodeInTree(context.project.mechanism, hit.id);
          context.updatePreview({
            isDraggingNode: true,
            nodeId: hit.id,
            nodeType: hit.type,
            originalNode: JSON.parse(JSON.stringify(nodeObj)),
            x1: pointer.x,
            y1: pointer.y,
            startNodeX: nodeObj.transform.x,
            startNodeY: nodeObj.transform.y,
          });
        } else {
          // If we clicked a ring or sector, just record click start for click selection toggle
          context.updatePreview({
            isClickOnly: true,
            nodeId: hit.id,
            nodeType: hit.type,
            x1: pointer.x,
            y1: pointer.y,
          });
        }
        return;
      }

      // C. Default: Marquee drag selection
      context.updatePreview({
        isDragging: true,
        x1: pointer.x,
        y1: pointer.y,
        x2: pointer.x,
        y2: pointer.y,
      });
    }
  },

  onMouseMove(_e, context) {
    const preview = context.currentPreviewData;
    if (!preview) return;

    const pointer = context.pointerPos;
    if (!pointer) return;

    if (preview.isDragging) {
      // Marquee selection
      context.updatePreview({
        ...preview,
        x2: pointer.x,
        y2: pointer.y,
      });
    } else if (preview.isDraggingNode) {
      // Dragging a node in real-time!
      const resolvedNodes = resolveProject(context.project);
      const nodeObj = findNodeInTree(context.project.mechanism, preview.nodeId);
      if (!nodeObj) return;

      // Calculate parent's world matrix to invert and transform pointer pos
      const parentNode = findParentNode(context.project.mechanism, preview.nodeId);
      let parentMatrix = Matrix2D.identity();
      if (parentNode) {
        const parentResolved = resolvedNodes.find((n) => n.id === parentNode.id);
        if (parentResolved) {
          const { x, y, rotation, scaleX, scaleY } = parentResolved.worldTransform;
          parentMatrix = Matrix2D.identity()
            .translate(x, y)
            .rotate(rotation)
            .scale(scaleX, scaleY);
        }
      }

      try {
        const parentInv = parentMatrix.invert();
        const localClickStart = parentInv.transformPoint(preview.x1, preview.y1);
        const localClickCurrent = parentInv.transformPoint(pointer.x, pointer.y);

        const localDeltaX = localClickCurrent.x - localClickStart.x;
        const localDeltaY = localClickCurrent.y - localClickStart.y;

        // Update project state transiently
        const updatedMechanism = JSON.parse(JSON.stringify(context.project.mechanism));
        const updatedNode = findNodeInTree(updatedMechanism, preview.nodeId);
        if (updatedNode) {
          updatedNode.transform.x = preview.startNodeX + localDeltaX;
          updatedNode.transform.y = preview.startNodeY + localDeltaY;
          
          useProjectStore.getState().setProject({
            ...context.project,
            mechanism: updatedMechanism,
          });
        }
      } catch (err) {
        // Ignored
      }
    } else if (preview.isResizing) {
      // Resizing a node in real-time!
      const resolvedNodes = resolveProject(context.project);
      const nodeObj = findNodeInTree(context.project.mechanism, preview.nodeId);
      if (!nodeObj) return;

      // Calculate the node's own parent world matrix
      const parentNode = findParentNode(context.project.mechanism, preview.nodeId);
      let parentMatrix = Matrix2D.identity();
      if (parentNode) {
        const parentResolved = resolvedNodes.find((n) => n.id === parentNode.id);
        if (parentResolved) {
          const { x, y, rotation, scaleX, scaleY } = parentResolved.worldTransform;
          parentMatrix = Matrix2D.identity()
            .translate(x, y)
            .rotate(rotation)
            .scale(scaleX, scaleY);
        }
      }

      try {
        const parentInv = parentMatrix.invert();
        const localPointer = parentInv.transformPoint(pointer.x, pointer.y);

        // Convert localPointer coordinates to node's local system (without scale)
        const nodeLocalX = localPointer.x - nodeObj.transform.x;
        const nodeLocalY = localPointer.y - nodeObj.transform.y;
        
        // Unrotate by the node's local rotation
        const nodeRotRad = -(nodeObj.transform.rotation * Math.PI) / 180;
        const cos = Math.cos(nodeRotRad);
        const sin = Math.sin(nodeRotRad);
        const lx = nodeLocalX * cos - nodeLocalY * sin;
        const ly = nodeLocalX * sin + nodeLocalY * cos;

        // Perform resize based on shape type
        const updatedMechanism = JSON.parse(JSON.stringify(context.project.mechanism));
        const updatedNode = findNodeInTree(updatedMechanism, preview.nodeId);

        if (updatedNode) {
          if (updatedNode.type === "circle") {
            updatedNode.radius = Math.max(5, Math.hypot(lx, ly));
          } else if (updatedNode.type === "rectangle") {
            updatedNode.width = Math.max(10, Math.abs(lx) * 2);
            updatedNode.height = Math.max(10, Math.abs(ly) * 2);
          } else if (updatedNode.type === "polygon") {
            updatedNode.radius = Math.max(5, Math.hypot(lx, ly));
          } else if (updatedNode.type === "arcText") {
            updatedNode.radius = Math.max(5, Math.hypot(localPointer.x, localPointer.y));
          } else if (updatedNode.type === "text") {
            const len = (updatedNode.content || "").length || 1;
            updatedNode.fontSize = Math.max(6, Math.abs(ly), Math.abs(lx) / (len * 0.6));
          } else if (updatedNode.type === "line") {
            updatedNode.length = Math.max(5, lx);
          } else if (updatedNode.type === "window") {
            const shape = updatedNode.shape;
            if (shape) {
              if (shape.type === "circle") {
                shape.radius = Math.max(5, Math.hypot(lx, ly));
              } else if (shape.type === "rectangle") {
                shape.width = Math.max(10, Math.abs(lx) * 2);
                shape.height = Math.max(10, Math.abs(ly) * 2);
              } else if (shape.type === "polygon") {
                shape.radius = Math.max(5, Math.hypot(lx, ly));
              }
            }
          }

          useProjectStore.getState().setProject({
            ...context.project,
            mechanism: updatedMechanism,
          });
        }
      } catch (err) {
        // Ignored
      }
    }
  },

  onMouseUp(_e, context) {
    const preview = context.currentPreviewData;
    if (!preview) return;

    context.updatePreview(null); // Clear preview

    if (preview.isDragging) {
      // Marquee selection logic
      const { x1, y1, x2, y2 } = preview;
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const selectStore = useSelectionStore.getState();

      if (dx < 4 && dy < 4) {
        return;
      }

      const resolvedNodes = resolveProject(context.project);
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const maxX = Math.max(x1, x2);
      const maxY = Math.max(y1, y2);
      const matches: { id: string; type: string }[] = [];

      resolvedNodes.forEach((node) => {
        if (node.visible && isNodeTouchedByMarquee(node, minX, minY, maxX, maxY, resolvedNodes, context.project)) {
          const nodeObj = findNodeInTree(context.project.mechanism, node.id);
          const isLocked = nodeObj ? nodeObj.locked : false;
          if (node.type !== "volvelle" && node.type !== "ring" && node.type !== "sector" && !isLocked) {
            matches.push({ id: node.id, type: node.type });
          }
        }
      });

      if (context.isShift) {
        matches.forEach((m) => selectStore.selectItem(m.id, m.type, true));
      } else {
        const filtered: { id: string; type: string }[] = [];
        matches.forEach((m) => {
          const selectedNode = findNodeInTree(context.project.mechanism, m.id);
          const violates = filtered.some((f) => {
            const fNode = findNodeInTree(context.project.mechanism, f.id);
            return isDescendantOf(selectedNode, f.id) || isDescendantOf(fNode, m.id);
          });
          if (!violates) {
            filtered.push(m);
          }
        });
        selectStore.setSelection(filtered);
      }
    } else if (preview.isDraggingNode) {
      // Finished dragging the node!
      const currentProject = useProjectStore.getState().project;
      const finalNode = findNodeInTree(currentProject.mechanism, preview.nodeId);

      // Rollback to original position transiently so we can execute the command
      const originalMechanism = JSON.parse(JSON.stringify(currentProject.mechanism));
      const originalNodeInTree = findNodeInTree(originalMechanism, preview.nodeId);
      if (originalNodeInTree) {
        originalNodeInTree.transform.x = preview.originalNode.transform.x;
        originalNodeInTree.transform.y = preview.originalNode.transform.y;
        useProjectStore.getState().setProject({
          ...currentProject,
          mechanism: originalMechanism,
        });
      }

      // Execute command!
      const updatedNode = JSON.parse(JSON.stringify(preview.originalNode));
      updatedNode.transform.x = finalNode.transform.x;
      updatedNode.transform.y = finalNode.transform.y;

      context.executeCommand(new UpdateNodeCommand(preview.nodeId, preview.originalNode, updatedNode));
    } else if (preview.isResizing) {
      // Finished resizing!
      const currentProject = useProjectStore.getState().project;
      const finalNode = findNodeInTree(currentProject.mechanism, preview.nodeId);

      // Rollback
      const originalMechanism = JSON.parse(JSON.stringify(currentProject.mechanism));
      const originalNodeInTree = findNodeInTree(originalMechanism, preview.nodeId);
      if (originalNodeInTree) {
        Object.assign(originalNodeInTree, JSON.parse(JSON.stringify(preview.originalNode)));
        useProjectStore.getState().setProject({
          ...currentProject,
          mechanism: originalMechanism,
        });
      }

      // Execute command!
      context.executeCommand(new UpdateNodeCommand(preview.nodeId, preview.originalNode, finalNode));
    }
  },
};

