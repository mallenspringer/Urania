import type { Tool } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import {
  findRingForNode,
  findNodeInTree,
  isDescendantOf,
  isPointInsideNode,
  isPointInsideWindow,
  isNodeTouchedByMarquee,
} from "../../shared/utils/geometry";
import { useSelectionStore } from "../selection/selectionStore";

export const selectTool: Tool = {
  id: "select",
  label: "Select",
  icon: "MousePointer",
  cursor: "default",
  category: "selection",

  onMouseDown(e, context) {
    if (e.evt.button === 0) {
      const pointer = context.pointerPos;
      if (pointer) {
        context.updatePreview({
          x1: pointer.x,
          y1: pointer.y,
          x2: pointer.x,
          y2: pointer.y,
          isDragging: true,
        });
      }
    }
  },

  onMouseMove(_e, context) {
    if (context.currentPreviewData && context.currentPreviewData.isDragging) {
      const pointer = context.pointerPos;
      if (pointer) {
        context.updatePreview({
          ...context.currentPreviewData,
          x2: pointer.x,
          y2: pointer.y,
        });
      }
    }
  },

  onMouseUp(_e, context) {
    if (!context.currentPreviewData || !context.currentPreviewData.isDragging) return;
    const { x1, y1, x2, y2 } = context.currentPreviewData;
    context.updatePreview(null); // Clear preview

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    const selectStore = useSelectionStore.getState();

    // 1. Tiny drag: handle click-to-select
    if (dx < 4 && dy < 4) {
      const resolvedNodes = resolveProject(context.project);
      const candidates: any[] = [];
      const wx = x1;
      const wy = y1;

      for (let i = resolvedNodes.length - 1; i >= 0; i--) {
        const node = resolvedNodes[i];
        if (node.visible && isPointInsideNode({ x: wx, y: wy }, node)) {
          const nodeObj = findNodeInTree(context.project.mechanism, node.id);
          const isLocked = nodeObj ? nodeObj.locked : false;
          if (isLocked) continue;

          // Check if masked
          if (node.maskIds && node.maskIds.length > 0) {
            const isRevealed = node.maskIds.every((maskId) => {
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

      if (candidates.length === 0) {
        selectStore.clearSelection();
        return;
      }

      // 4-tier selection priority
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

      let targetNode: any;
      const activeRingId = context.activeRingId;

      if (pri1.length > 0) {
        targetNode = pri1[0];
        if (activeRingId) {
          const activeCandidate = pri1.find((c) => findRingForNode(context.project, c.id) === activeRingId);
          if (activeCandidate) targetNode = activeCandidate;
        }
      } else if (pri2.length > 0) {
        targetNode = pri2[0];
        if (activeRingId) {
          const activeCandidate = pri2.find((c) => findRingForNode(context.project, c.id) === activeRingId);
          if (activeCandidate) targetNode = activeCandidate;
        }
      } else if (pri3.length > 0) {
        targetNode = pri3[0];
        if (activeRingId) {
          const activeCandidate = pri3.find((c) => findRingForNode(context.project, c.id) === activeRingId);
          if (activeCandidate) targetNode = activeCandidate;
        }
      } else {
        targetNode = pri4[0];
        if (activeRingId) {
          const activeCandidate = pri4.find((r) => r.id === activeRingId);
          if (activeCandidate) targetNode = activeCandidate;
        }
      }

      selectStore.selectItem(targetNode.id, targetNode.type, context.isShift);

      const associatedRingId = findRingForNode(context.project, targetNode.id);
      if (associatedRingId) {
        selectStore.setActiveRingId(associatedRingId);
      }
      return;
    }

    // 2. Otherwise: marquee drag selection
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
  },
};
