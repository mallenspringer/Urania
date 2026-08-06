import type { Tool } from "./toolTypes";
import { resolveProject } from "../runtime/mechanismEngine";
import {
  findRingForNode,
  findNodeInTree,
  findParentNode,
  findParentRing,
  isDescendantOf,
  isPointInsideNode,
  isPointInsideWindow,
  isNodeTouchedByMarquee,
} from "../../shared/utils/geometry";
import { useSelectionStore } from "../selection/selectionStore";
import { useProjectStore } from "../project/projectStore";
import { UpdateNodeCommand, UpdateMultipleNodesCommand } from "../project/commands";
import { Matrix2D } from "../../shared/utils/matrix";
import { calculateSymmetryGroupUpdates } from "../../shared/utils/symmetryHelper";


function findHitTab(pointer: { x: number; y: number }, project: any): string | null {
  const rings = (project.mechanism.children || []).filter((c: any) => c.type === "ring");
  if (rings.length === 0) return null;

  const maxOuterRadius = rings.reduce((max: number, r: any) => Math.max(max, r.outerRadius || 100), 100);

  const r_pointer = Math.hypot(pointer.x, pointer.y);
  let theta_pointer = (Math.atan2(pointer.y, pointer.x) * 180) / Math.PI;
  if (theta_pointer < -180) theta_pointer += 360;
  if (theta_pointer > 180) theta_pointer -= 360;

  for (let idx = 0; idx < rings.length; idx++) {
    const ring = rings[idx];
    const R_track = maxOuterRadius + 90 + idx * 22;
    const ccwRot = 360 - (ring.rotation || 0);
    const tabAngle = -135 + ccwRot / 4.0;

    // Check radial proximity
    if (Math.abs(r_pointer - R_track) <= 12) {
      let diff = theta_pointer - tabAngle;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      if (Math.abs(diff) <= 8) {
        return ring.id;
      }
    }
  }
  return null;
}

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

  const getTopLevelGroup = (mechanism: any, nodeId: string): any | null => {
    let currentId = nodeId;
    let topGroup = null;
    while (true) {
      const parent = findParentNode(mechanism, currentId);
      if (!parent) break;
      if (parent.type === "group") {
        topGroup = parent;
      }
      currentId = parent.id;
    }
    return topGroup;
  };

  const resolvedCandidates: any[] = [];
  const addedIds = new Set<string>();

  for (const c of candidates) {
    const topGroupObj = getTopLevelGroup(context.project.mechanism, c.id);
    const targetNode = topGroupObj ? resolvedNodes.find((n) => n.id === topGroupObj.id) : c;
    if (targetNode && !addedIds.has(targetNode.id)) {
      resolvedCandidates.push(targetNode);
      addedIds.add(targetNode.id);
    }
  }

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

  const pri1 = resolvedCandidates.filter((c) => getSelectionPriority(c.type) === 1);
  const pri2 = resolvedCandidates.filter((c) => getSelectionPriority(c.type) === 2);
  const pri3 = resolvedCandidates.filter((c) => getSelectionPriority(c.type) === 3);
  const pri4 = resolvedCandidates.filter((c) => getSelectionPriority(c.type) === 4);

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

      // Check if clicked an auto-generated grab tab
      const hitTabRingId = findHitTab(pointer, context.project);
      if (hitTabRingId) {
        const targetRing: any = findNodeInTree(context.project.mechanism, hitTabRingId);
        if (targetRing) {
          context.updatePreview({
            isDraggingTab: true,
            targetRingId: hitTabRingId,
            startRingRotation: targetRing.rotation || 0,
            originalNode: JSON.parse(JSON.stringify(targetRing)),
            x1: pointer.x,
            y1: pointer.y,
          });
          selectStore.selectItem(hitTabRingId, "ring", false);
          selectStore.setActiveRingId(hitTabRingId);
          return;
        }
      }

      // A. Check if clicked a resize handle of the active node
      if (activeItem) {
        const activeNode = resolvedNodes.find((n) => n.id === activeItem.id);
        if (activeNode && activeNode.type !== "ring" && activeNode.type !== "sector") {
          const { x, y, rotation, scaleX, scaleY } = activeNode.worldTransform;
          const { x: bx, y: by, width, height } = activeNode.bounds;
          const rotRad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rotRad) * scaleX;
          const sin = Math.sin(rotRad) * scaleY;

          let corners = [];
          if (activeNode.type === "curve" || (activeNode.type === "window" && activeNode.renderData?.shape?.type === "curve")) {
            const targetShape = activeNode.type === "window" ? activeNode.renderData.shape : activeNode.renderData;
            const pts = targetShape?.controlPoints || { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
            corners = [
              { name: "p0", lx: pts.p0.x, ly: pts.p0.y },
              { name: "c1", lx: pts.c1.x, ly: pts.c1.y },
              { name: "c2", lx: pts.c2.x, ly: pts.c2.y },
              { name: "p1", lx: pts.p1.x, ly: pts.p1.y },
            ];
          } else if (activeNode.type === "line" || (activeNode.type === "window" && activeNode.renderData?.shape?.type === "line")) {
            const lineLen = (activeNode.type === "window" ? activeNode.renderData.shape?.length : activeNode.renderData?.length) || 50;
            corners = [
              { name: "left-mid", lx: 0, ly: 0 },
              { name: "right-mid", lx: lineLen, ly: 0 },
            ];
          } else if (activeNode.renderData?.isRadialWarp) {
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

        // If it's a legacy auto-tab or track tab
        if (hit.type === "tab") {
          const nodeObj = findNodeInTree(context.project.mechanism, hit.id) as any;
          const targetRingId = nodeObj.targetRingId || findParentNode(context.project.mechanism, hit.id)?.id;
          const targetRing: any = targetRingId ? findNodeInTree(context.project.mechanism, targetRingId) : null;
          
          context.updatePreview({
            isDraggingTab: true,
            nodeId: hit.id,
            nodeType: "tab",
            targetRingId: targetRingId,
            startRingRotation: targetRing?.rotation || 0,
            originalNode: JSON.parse(JSON.stringify(nodeObj)),
            x1: pointer.x,
            y1: pointer.y,
          });
        } else if (hit.type === "ring" || hit.type === "discTab") {
          // Grabbing either a ring disc or a disc-attached tab allows direct rotation of the ring
          const targetRingId = hit.type === "ring" ? hit.id : findRingForNode(context.project, hit.id);
          const targetRing: any = targetRingId ? findNodeInTree(context.project.mechanism, targetRingId) : null;
          const startPointerAngle = (Math.atan2(pointer.y, pointer.x) * 180) / Math.PI;

          context.updatePreview({
            isDraggingRingDisc: true,
            nodeId: hit.id,
            nodeType: hit.type,
            targetRingId: targetRingId,
            startPointerAngle: startPointerAngle,
            startRingRotation: targetRing?.rotation || 0,
            x1: pointer.x,
            y1: pointer.y,
          });
        } else if (hit.type !== "sector") {
          const nodeObj: any = findNodeInTree(context.project.mechanism, hit.id);
          if (nodeObj) {
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
          }
        } else {
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
    const preview: any = context.currentPreviewData;
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

        // Update project state transiently
        const updatedMechanism = JSON.parse(JSON.stringify(context.project.mechanism));
        const updatedNode = findNodeInTree(updatedMechanism, preview.nodeId);
        if (updatedNode) {
          if (updatedNode.transformMode === "radial") {
            // Radial-mode drag: operate in polar coordinate space to preserve radius and
            // correctly track angular position — prevents rotation-during-drag artifact.
            const origR = Math.hypot(preview.startNodeX, preview.startNodeY);
            const origTheta = Math.atan2(preview.startNodeY, preview.startNodeX);

            const startLocalR = Math.hypot(localClickStart.x, localClickStart.y);
            const startLocalTheta = Math.atan2(localClickStart.y, localClickStart.x);
            const currentLocalR = Math.hypot(localClickCurrent.x, localClickCurrent.y);
            const currentLocalTheta = Math.atan2(localClickCurrent.y, localClickCurrent.x);

            const deltaR = currentLocalR - startLocalR;
            const deltaTheta = currentLocalTheta - startLocalTheta;

            const newR = Math.max(0, origR + deltaR);
            const newTheta = origTheta + deltaTheta;

            updatedNode.transform.x = newR * Math.cos(newTheta);
            updatedNode.transform.y = newR * Math.sin(newTheta);
          } else {
            // Standard Cartesian drag
            const localDeltaX = localClickCurrent.x - localClickStart.x;
            const localDeltaY = localClickCurrent.y - localClickStart.y;
            updatedNode.transform.x = preview.startNodeX + localDeltaX;
            updatedNode.transform.y = preview.startNodeY + localDeltaY;
          }

          if (updatedNode.symmetryGroupId) {
            const updates = calculateSymmetryGroupUpdates(updatedMechanism, updatedNode, {
              transform: { x: updatedNode.transform.x, y: updatedNode.transform.y },
            });
            for (const u of updates) {
              const target = findNodeInTree(updatedMechanism, u.nodeId);
              if (target) {
                Object.assign(target, u.newNode);
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
    } else if (preview.isDraggingTab) {
      const targetRingId = preview.targetRingId;
      if (targetRingId) {
        let currentAngle = Math.atan2(pointer.y, pointer.x) * (180 / Math.PI);
        if (currentAngle < -180) currentAngle += 360;
        if (currentAngle > 180) currentAngle -= 360;

        // Rotate coordinate system by +90 degrees to move boundary discontinuity
        let rotAngle = currentAngle + 90;
        if (rotAngle < -180) rotAngle += 360;
        if (rotAngle > 180) rotAngle -= 360;

        const clampedRot = Math.max(-45, Math.min(45, rotAngle));
        const clampedAngle = clampedRot - 90;

        // CCW rotation: 0 to 360 degrees
        const ccwRotation = (clampedAngle - (-135)) * 4.0;
        
        // CW rotation (stored standard in Urania)
        const cwRotation = 360 - ccwRotation;

        const updatedMechanism = JSON.parse(JSON.stringify(context.project.mechanism));
        const updatedRing: any = findNodeInTree(updatedMechanism, targetRingId);
        if (updatedRing) {
          updatedRing.rotation = cwRotation;
          useProjectStore.getState().setProject({
            ...context.project,
            mechanism: updatedMechanism,
          });
        }
      }
    } else if (preview.isDraggingRingDisc) {
      const targetRingId = preview.targetRingId;
      if (targetRingId) {
        const currentPointerAngle = (Math.atan2(pointer.y, pointer.x) * 180) / Math.PI;
        let deltaAngle = currentPointerAngle - preview.startPointerAngle;
        let newRotation = (preview.startRingRotation + deltaAngle) % 360;
        if (newRotation < 0) newRotation += 360;

        const updatedMechanism = JSON.parse(JSON.stringify(context.project.mechanism));
        const updatedRing: any = findNodeInTree(updatedMechanism, targetRingId);
        if (updatedRing) {
          updatedRing.rotation = Math.round(newRotation * 10) / 10;
          useProjectStore.getState().setProject({
            ...context.project,
            mechanism: updatedMechanism,
          });
        }
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

        // Perform resize based on shape type and transform mode
        const updatedMechanism = JSON.parse(JSON.stringify(context.project.mechanism));
        const updatedNode: any = findNodeInTree(updatedMechanism, preview.nodeId);

        if (updatedNode) {
          const handle = preview.handle;
          const isCorner = ["top-left", "top-right", "bottom-left", "bottom-right"].includes(handle);
          const isSide = ["top-mid", "bottom-mid", "left-mid", "right-mid"].includes(handle);

            if (updatedNode.transformMode === "radial") {
            const rx = updatedNode.transform.x;
            const ry = updatedNode.transform.y;
            const rOrig = Math.sqrt(rx * rx + ry * ry);
            const thetaOrig = Math.atan2(ry, rx);
            const thetaOrigDeg = (thetaOrig * 180 / Math.PI + 360) % 360;

            const rNew = Math.sqrt(localPointer.x * localPointer.x + localPointer.y * localPointer.y);
            const thetaNewDeg = (Math.atan2(localPointer.y, localPointer.x) * 180 / Math.PI + 360) % 360;

            let diff = thetaNewDeg - thetaOrigDeg;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            if (updatedNode.type === "rectangle" || updatedNode.type === "trapezoid") {
              const W_orig = updatedNode.type === "rectangle"
                ? (preview.originalNode.width || 20)
                : (preview.originalNode.baseWidth || 60);
              const H_orig = preview.originalNode.height || 20;

              // Compute raw values
              const rawW = Math.max(2, Math.abs(diff) * 2);
              const hOrig = preview.originalNode.height || 10;

              let rawH = hOrig;
              if (handle === "bottom-left" || handle === "bottom-right" || handle === "bottom-mid") {
                const rInner = rOrig - hOrig / 2;
                rawH = Math.max(5, rNew - rInner);
              } else if (handle === "top-left" || handle === "top-right" || handle === "top-mid") {
                const rOuter = rOrig + hOrig / 2;
                rawH = Math.max(5, rOuter - rNew);
              }

              // Determine scaling factors
              let finalW = rawW;
              let finalH = rawH;

              if (isCorner) {
                // Proportional stretch
                const S_w = rawW / W_orig;
                const S_h = rawH / H_orig;
                const S = (S_w + S_h) / 2; // Average scale factor
                finalW = W_orig * S;
                finalH = H_orig * S;
              } else if (isSide) {
                // 1D stretch
                if (handle === "left-mid" || handle === "right-mid") {
                  finalH = H_orig;
                } else if (handle === "top-mid" || handle === "bottom-mid") {
                  finalW = W_orig;
                }
              }

              // Apply values to node
              if (updatedNode.type === "rectangle") {
                updatedNode.width = finalW;
              } else if (updatedNode.type === "trapezoid") {
                const ratio = (preview.originalNode.topWidth || 40) / (preview.originalNode.baseWidth || 60);
                updatedNode.baseWidth = finalW;
                updatedNode.topWidth = finalW * ratio;
              }
              updatedNode.height = finalH;

              // Adjust position based on locked boundary
              if (handle === "bottom-left" || handle === "bottom-right" || handle === "bottom-mid") {
                const rInner = rOrig - hOrig / 2;
                const newR = rInner + finalH / 2;
                updatedNode.transform.x = newR * Math.cos(thetaOrig);
                updatedNode.transform.y = newR * Math.sin(thetaOrig);
              } else if (handle === "top-left" || handle === "top-right" || handle === "top-mid") {
                const rOuter = rOrig + hOrig / 2;
                const actualInner = Math.max(0, rOuter - finalH);
                const actualH = rOuter - actualInner;
                updatedNode.height = actualH;
                const actualR = actualInner + actualH / 2;
                updatedNode.transform.x = actualR * Math.cos(thetaOrig);
                updatedNode.transform.y = actualR * Math.sin(thetaOrig);
              }
            } else if (["circle", "polygon", "arc", "star", "crescent"].includes(updatedNode.type)) {
              // Radius-based shapes in radial mode:
              // top/bottom handles → move object radially (inward / outward)
              // left/right handles → resize the shape's own radius
              if (handle === "top-mid" || handle === "top-left" || handle === "top-right") {
                // Move inward: new radial position = distance to pointer
                const newR = Math.max(5, rNew);
                updatedNode.transform.x = newR * Math.cos(thetaOrig);
                updatedNode.transform.y = newR * Math.sin(thetaOrig);
              } else if (handle === "bottom-mid" || handle === "bottom-left" || handle === "bottom-right") {
                // Move outward: new radial position = distance to pointer
                const newR = Math.max(5, rNew);
                updatedNode.transform.x = newR * Math.cos(thetaOrig);
                updatedNode.transform.y = newR * Math.sin(thetaOrig);
              } else if (handle === "left-mid" || handle === "right-mid") {
                // Resize the object's own radius
                const objRadius = Math.max(5, Math.hypot(lx, ly));
                if (updatedNode.type === "circle") {
                  updatedNode.radius = objRadius;
                } else if (updatedNode.type === "polygon") {
                  updatedNode.radius = objRadius;
                } else if (updatedNode.type === "arc") {
                  updatedNode.radius = objRadius;
                } else if (updatedNode.type === "star") {
                  const ratio = preview.originalNode.innerRadius / preview.originalNode.outerRadius || 0.4;
                  updatedNode.outerRadius = objRadius;
                  updatedNode.innerRadius = objRadius * ratio;
                } else if (updatedNode.type === "crescent") {
                  updatedNode.radius = objRadius;
                }
              }
            }
          } else {
            // Standard Cartesian resizing
            if (updatedNode.type === "circle") {
              updatedNode.radius = Math.max(5, Math.hypot(lx, ly));
            } else if (
              updatedNode.type === "rectangle" ||
              updatedNode.type === "trapezoid" ||
              updatedNode.type === "image" ||
              updatedNode.type === "svgAsset"
            ) {
              const W_orig = updatedNode.type === "rectangle"
                ? (preview.originalNode.width || 20)
                : (updatedNode.type === "trapezoid"
                  ? (preview.originalNode.baseWidth || 60)
                  : (preview.originalNode.width || 100));
              const H_orig = preview.originalNode.height || (updatedNode.type === "image" || updatedNode.type === "svgAsset" ? 100 : 20);

              const rawW = Math.max(10, Math.abs(lx) * 2);
              const rawH = Math.max(10, Math.abs(ly) * 2);

              let finalW = rawW;
              let finalH = rawH;

              if (isCorner) {
                const S_w = rawW / W_orig;
                const S_h = rawH / H_orig;
                const S = (S_w + S_h) / 2;
                finalW = W_orig * S;
                finalH = H_orig * S;
              } else if (isSide) {
                if (handle === "left-mid" || handle === "right-mid") {
                  finalH = H_orig;
                } else if (handle === "top-mid" || handle === "bottom-mid") {
                  finalW = W_orig;
                }
              }

              if (updatedNode.type === "rectangle") {
                updatedNode.width = finalW;
              } else if (updatedNode.type === "trapezoid") {
                const ratio = (preview.originalNode.topWidth || 40) / (preview.originalNode.baseWidth || 60);
                updatedNode.baseWidth = finalW;
                updatedNode.topWidth = finalW * ratio;
              } else if (updatedNode.type === "image" || updatedNode.type === "svgAsset") {
                updatedNode.width = finalW;
                updatedNode.height = finalH;
              }
              updatedNode.height = finalH;
            } else if (updatedNode.type === "polygon") {
              updatedNode.radius = Math.max(5, Math.hypot(lx, ly));
            } else if (updatedNode.type === "arcText") {
              updatedNode.radius = Math.max(5, Math.hypot(localPointer.x, localPointer.y));
            } else if (updatedNode.type === "text") {
              const len = (updatedNode.content || "").length || 1;
              updatedNode.fontSize = Math.max(6, Math.abs(ly), Math.abs(lx) / (len * 0.6));
            } else if (updatedNode.type === "line") {
              const origLen = preview.originalNode?.length || 50;
              if (handle === "left-mid" || handle === "top-left" || handle === "bottom-left") {
                const origRotRad = (preview.originalNode.transform.rotation * Math.PI) / 180;
                const fixedEndParent = {
                  x: preview.originalNode.transform.x + origLen * Math.cos(origRotRad),
                  y: preview.originalNode.transform.y + origLen * Math.sin(origRotRad),
                };
                const dx = fixedEndParent.x - localPointer.x;
                const dy = fixedEndParent.y - localPointer.y;
                const newLen = Math.max(5, Math.hypot(dx, dy));
                const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);

                updatedNode.transform.x = localPointer.x;
                updatedNode.transform.y = localPointer.y;
                updatedNode.transform.rotation = newAngle;
                updatedNode.length = newLen;
              } else {
                const startX = preview.originalNode.transform.x;
                const startY = preview.originalNode.transform.y;
                const dx = localPointer.x - startX;
                const dy = localPointer.y - startY;
                const newLen = Math.max(5, Math.hypot(dx, dy));
                const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);

                updatedNode.transform.rotation = newAngle;
                updatedNode.length = newLen;
              }
            } else if (updatedNode.type === "curve") {
              const pts = updatedNode.controlPoints ? JSON.parse(JSON.stringify(updatedNode.controlPoints)) : { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
              if (handle === "p0") pts.p0 = { x: Math.round(lx), y: Math.round(ly) };
              else if (handle === "c1") pts.c1 = { x: Math.round(lx), y: Math.round(ly) };
              else if (handle === "c2") pts.c2 = { x: Math.round(lx), y: Math.round(ly) };
              else if (handle === "p1") pts.p1 = { x: Math.round(lx), y: Math.round(ly) };
              updatedNode.controlPoints = pts;
            } else if (updatedNode.type === "arc") {
              updatedNode.radius = Math.max(5, Math.hypot(lx, ly));
            } else if (updatedNode.type === "star") {
              updatedNode.outerRadius = Math.max(5, Math.hypot(lx, ly));
              updatedNode.innerRadius = updatedNode.outerRadius * (preview.originalNode.innerRadius / preview.originalNode.outerRadius || 0.4);
            } else if (updatedNode.type === "crescent") {
              updatedNode.radius = Math.max(5, Math.hypot(lx, ly));
            } else if (updatedNode.type === "window") {
              const shape = updatedNode.shape;
              if (shape) {
                if (shape.type === "circle") {
                  shape.radius = Math.max(5, Math.hypot(lx, ly));
                } else if (shape.type === "rectangle") {
                  const W_orig = preview.originalNode.shape.width || 20;
                  const H_orig = preview.originalNode.shape.height || 20;
                  const rawW = Math.max(10, Math.abs(lx) * 2);
                  const rawH = Math.max(10, Math.abs(ly) * 2);

                  let finalW = rawW;
                  let finalH = rawH;

                  if (isCorner) {
                    const S_w = rawW / W_orig;
                    const S_h = rawH / H_orig;
                    const S = (S_w + S_h) / 2;
                    finalW = W_orig * S;
                    finalH = H_orig * S;
                  } else if (isSide) {
                    if (handle === "left-mid" || handle === "right-mid") {
                      finalH = H_orig;
                    } else if (handle === "top-mid" || handle === "bottom-mid") {
                      finalW = W_orig;
                    }
                  }
                  shape.width = finalW;
                  shape.height = finalH;
                } else if (shape.type === "polygon") {
                  shape.radius = Math.max(5, Math.hypot(lx, ly));
                } else if (shape.type === "star") {
                  shape.outerRadius = Math.max(5, Math.hypot(lx, ly));
                  const ratio = preview.originalNode.shape?.innerRadius / preview.originalNode.shape?.outerRadius || 0.4;
                  shape.innerRadius = shape.outerRadius * ratio;
                } else if (shape.type === "crescent") {
                  shape.radius = Math.max(5, Math.hypot(lx, ly));
                } else if (shape.type === "trapezoid") {
                  const W_orig = preview.originalNode.shape?.baseWidth || 60;
                  const H_orig = preview.originalNode.shape?.height || 50;
                  const rawW = Math.max(10, Math.abs(lx) * 2);
                  const rawH = Math.max(10, Math.abs(ly) * 2);
                  let finalW = rawW;
                  let finalH = rawH;
                  if (isCorner) {
                    const S = (rawW / W_orig + rawH / H_orig) / 2;
                    finalW = W_orig * S;
                    finalH = H_orig * S;
                  }
                  const ratio = (preview.originalNode.shape?.topWidth || 40) / W_orig;
                  shape.baseWidth = finalW;
                  shape.topWidth = finalW * ratio;
                  shape.height = finalH;
                } else if (shape.type === "line") {
                  const origLen = preview.originalNode?.shape?.length || 50;
                  if (handle === "left-mid" || handle === "top-left" || handle === "bottom-left") {
                    const origRotRad = (preview.originalNode.transform.rotation * Math.PI) / 180;
                    const fixedEndParent = {
                      x: preview.originalNode.transform.x + origLen * Math.cos(origRotRad),
                      y: preview.originalNode.transform.y + origLen * Math.sin(origRotRad),
                    };
                    const dx = fixedEndParent.x - localPointer.x;
                    const dy = fixedEndParent.y - localPointer.y;
                    const newLen = Math.max(5, Math.hypot(dx, dy));
                    const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);

                    updatedNode.transform.x = localPointer.x;
                    updatedNode.transform.y = localPointer.y;
                    updatedNode.transform.rotation = newAngle;
                    shape.length = newLen;
                  } else {
                    const startX = preview.originalNode.transform.x;
                    const startY = preview.originalNode.transform.y;
                    const dx = localPointer.x - startX;
                    const dy = localPointer.y - startY;
                    const newLen = Math.max(5, Math.hypot(dx, dy));
                    const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);

                    updatedNode.transform.rotation = newAngle;
                    shape.length = newLen;
                  }
                } else if (shape.type === "curve") {
                  const pts = shape.controlPoints ? JSON.parse(JSON.stringify(shape.controlPoints)) : { p0: { x: 0, y: 0 }, c1: { x: 50, y: -50 }, c2: { x: 100, y: 50 }, p1: { x: 150, y: 0 } };
                  if (handle === "p0") pts.p0 = { x: Math.round(lx), y: Math.round(ly) };
                  else if (handle === "c1") pts.c1 = { x: Math.round(lx), y: Math.round(ly) };
                  else if (handle === "c2") pts.c2 = { x: Math.round(lx), y: Math.round(ly) };
                  else if (handle === "p1") pts.p1 = { x: Math.round(lx), y: Math.round(ly) };
                  shape.controlPoints = pts;
                } else if (shape.type === "arc") {
                  shape.radius = Math.max(5, Math.hypot(lx, ly));
                } else if (shape.type === "text" || shape.type === "sectorLabel") {
                  const len = (shape.content || "").length || 1;
                  shape.fontSize = Math.max(6, Math.abs(ly), Math.abs(lx) / (len * 0.6));
                } else if (shape.type === "arcText") {
                  shape.radius = Math.max(5, Math.hypot(localPointer.x, localPointer.y));
                }
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
    const preview = context.currentPreviewData as any;
    if (!preview) return;

    context.updatePreview(null); // Clear preview

    if (preview.isDragging) {
      // Marquee selection logic
      const { x1, y1, x2, y2 } = preview;
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const selectStore = useSelectionStore.getState();

      if (dx < 4 && dy < 4) {
        if (!context.isShift) {
          selectStore.clearSelection();
        }
        return;
      }

      const resolvedNodes = resolveProject(context.project);
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const maxX = Math.max(x1, x2);
      const maxY = Math.max(y1, y2);

      const activeItem = selectStore.activeItem;
      const activeRing = activeItem ? findParentRing(context.project.mechanism, activeItem.id) : null;

      if (!activeRing) {
        // NO RING IS SELECTED: Drag-select picks the topmost visible ring!
        const rings = context.project.mechanism.children || [];
        const visibleRings = rings.filter((r) => r.visible !== false && !r.locked);

        // Find ring nodes touched by marquee
        const touchedRingNodes = resolvedNodes.filter((node) => {
          if (node.type !== "ring" || !node.visible) return false;
          return isNodeTouchedByMarquee(node, minX, minY, maxX, maxY, resolvedNodes, context.project);
        });

        if (touchedRingNodes.length > 0) {
          const touchedIds = new Set(touchedRingNodes.map((n) => n.id));
          const topRing = [...visibleRings].reverse().find((r) => touchedIds.has(r.id));
          if (topRing) {
            selectStore.selectItem(topRing.id, "ring", context.isShift);
          }
        } else {
          // Fallback: Pick top-most visible ring in project
          if (visibleRings.length > 0) {
            const topmost = visibleRings[visibleRings.length - 1];
            selectStore.setSelection([{ id: topmost.id, type: "ring" }]);
          } else {
            selectStore.clearSelection();
          }
        }
        return;
      }

      // RING IS SELECTED: Marquee selection is ring-level-only!
      const matches: { id: string; type: string }[] = [];
      resolvedNodes.forEach((node) => {
        if (node.visible && isNodeTouchedByMarquee(node, minX, minY, maxX, maxY, resolvedNodes, context.project)) {
          const nodeObj = findNodeInTree(context.project.mechanism, node.id);
          const isLocked = nodeObj ? nodeObj.locked : false;
          if (
            node.type !== "volvelle" &&
            node.type !== "ring" &&
            node.type !== "sector" &&
            !isLocked &&
            isDescendantOf(activeRing, node.id)
          ) {
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
            return (selectedNode && isDescendantOf(selectedNode, f.id)) || (fNode && isDescendantOf(fNode, m.id));
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
      const finalNode: any = findNodeInTree(currentProject.mechanism, preview.nodeId);

      // Rollback to original position transiently so we can execute the command
      const originalMechanism = JSON.parse(JSON.stringify(currentProject.mechanism));
      const originalNodeInTree: any = findNodeInTree(originalMechanism, preview.nodeId);
      if (originalNodeInTree) {
        originalNodeInTree.transform.x = preview.originalNode.transform.x;
        originalNodeInTree.transform.y = preview.originalNode.transform.y;
        useProjectStore.getState().setProject({
          ...currentProject,
          mechanism: originalMechanism,
        });
      }

      if (finalNode && preview.originalNode.symmetryGroupId) {
        const updates = calculateSymmetryGroupUpdates(originalMechanism, preview.originalNode, {
          transform: { x: finalNode.transform.x, y: finalNode.transform.y },
        });
        if (updates.length > 0) {
          context.executeCommand(new UpdateMultipleNodesCommand(updates));
        } else {
          const updatedNode = JSON.parse(JSON.stringify(preview.originalNode));
          updatedNode.transform.x = finalNode.transform.x;
          updatedNode.transform.y = finalNode.transform.y;
          context.executeCommand(new UpdateNodeCommand(preview.nodeId, preview.originalNode, updatedNode));
        }
      } else if (finalNode) {
        const updatedNode = JSON.parse(JSON.stringify(preview.originalNode));
        updatedNode.transform.x = finalNode.transform.x;
        updatedNode.transform.y = finalNode.transform.y;
        context.executeCommand(new UpdateNodeCommand(preview.nodeId, preview.originalNode, updatedNode));
      }
    } else if (preview.isDraggingTab || preview.isDraggingRingDisc) {
      // Finished tab or ring disc direct rotation drag
      const targetRingId = preview.targetRingId;
      if (targetRingId) {
        const currentProject = useProjectStore.getState().project;
        const finalRing: any = findNodeInTree(currentProject.mechanism, targetRingId);

        // Rollback the ring's rotation to start rotation transiently
        const originalMechanism = JSON.parse(JSON.stringify(currentProject.mechanism));
        const originalRingInTree: any = findNodeInTree(originalMechanism, targetRingId);
        if (originalRingInTree) {
          originalRingInTree.rotation = preview.startRingRotation;
          useProjectStore.getState().setProject({
            ...currentProject,
            mechanism: originalMechanism,
          });
        }

        // Prepare snapshots for UpdateNodeCommand if rotation actually changed
        if (finalRing && Math.abs((finalRing.rotation || 0) - preview.startRingRotation) > 0.01) {
          const startRingNode = findNodeInTree(originalMechanism, targetRingId);
          if (startRingNode) {
            const finalRingNode = JSON.parse(JSON.stringify(startRingNode));
            finalRingNode.rotation = finalRing.rotation;

            context.executeCommand(new UpdateNodeCommand(targetRingId, startRingNode, finalRingNode));
          }
        }
      }
    } else if (preview.isResizing) {
      // Finished resizing!
      const currentProject = useProjectStore.getState().project;
      const finalNode: any = findNodeInTree(currentProject.mechanism, preview.nodeId);

      // Rollback
      const originalMechanism = JSON.parse(JSON.stringify(currentProject.mechanism));
      const originalNodeInTree: any = findNodeInTree(originalMechanism, preview.nodeId);
      if (originalNodeInTree) {
        Object.assign(originalNodeInTree, JSON.parse(JSON.stringify(preview.originalNode)));
        useProjectStore.getState().setProject({
          ...currentProject,
          mechanism: originalMechanism,
        });
      }

      if (finalNode && preview.originalNode.symmetryGroupId) {
        const patch = JSON.parse(JSON.stringify(finalNode));
        const updates = calculateSymmetryGroupUpdates(originalMechanism, preview.originalNode, patch);
        if (updates.length > 0) {
          context.executeCommand(new UpdateMultipleNodesCommand(updates));
        } else if (finalNode) {
          context.executeCommand(new UpdateNodeCommand(preview.nodeId, preview.originalNode, finalNode));
        }
      } else if (finalNode) {
        context.executeCommand(new UpdateNodeCommand(preview.nodeId, preview.originalNode, finalNode));
      }
    }
  },
};

