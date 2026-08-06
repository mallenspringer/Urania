import React, { useState, useEffect, useRef } from "react";
import { Group, Rect, Line, Circle as KonvaCircle, Image as KonvaImage } from "react-konva";
import type { ResolvedNode } from "../runtime/mechanismEngine";
import type { ImageCrop } from "../../shared/types/project";
import { useProjectStore } from "../project/projectStore";
import { UpdateNodeCommand } from "../project/commands";
import { findNodeInTree, updateNodeInTree } from "../../shared/utils/geometry";

interface ImageCropOverlayProps {
  nodeId: string;
  resolvedNodes: ResolvedNode[];
}

export const ImageCropOverlay: React.FC<ImageCropOverlayProps> = ({ nodeId, resolvedNodes }) => {
  const project = useProjectStore((state) => state.project);
  const assets = project.assets || [];
  const setProject = useProjectStore((state) => state.setProject);
  const executeCommand = useProjectStore((state) => state.executeCommand);

  const resolvedNode = resolvedNodes.find((n) => n.id === nodeId);
  const rawNode = findNodeInTree(project.mechanism, nodeId) as any;

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  // Ref to track snapshot at drag start to ensure only ONE undo history event per drag
  const dragStartNodeRef = useRef<any>(null);

  const assetId = resolvedNode?.renderData?.assetId || rawNode?.assetId;
  const asset = assets.find((a) => a.id === assetId);

  useEffect(() => {
    if (asset?.embeddedData) {
      const img = new window.Image();
      img.src = asset.embeddedData;
      img.onload = () => setImageEl(img);
      img.onerror = () => setImageEl(null);
    } else {
      setImageEl(null);
    }
  }, [asset]);

  if (!resolvedNode || !rawNode || !imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) {
    return null;
  }

  const naturalW = imageEl.naturalWidth;
  const naturalH = imageEl.naturalHeight;

  // Node display dimensions
  const displayW = rawNode.width || resolvedNode.bounds.width || 100;
  const displayH = rawNode.height || resolvedNode.bounds.height || 100;

  // Current crop state in natural pixel coordinates
  const currentCrop: ImageCrop = rawNode.crop || {
    x: 0,
    y: 0,
    width: naturalW,
    height: naturalH,
  };

  // Fixed scale factors (display px per natural px)
  const scaleX = displayW / currentCrop.width;
  const scaleY = displayH / currentCrop.height;

  // Full uncropped image size in display space
  const fullDisplayW = naturalW * scaleX;
  const fullDisplayH = naturalH * scaleY;

  // Full uncropped image top-left relative to node center
  const fullDisplayX = -currentCrop.x * scaleX - displayW / 2;
  const fullDisplayY = -currentCrop.y * scaleY - displayH / 2;

  // Active crop box top-left relative to node center
  const cropBoxX = -displayW / 2;
  const cropBoxY = -displayH / 2;

  const { x, y, rotation } = resolvedNode.worldTransform;

  // Handle Drag Start: Capture snapshot for single-command undo
  const handleDragStart = () => {
    dragStartNodeRef.current = JSON.parse(JSON.stringify(rawNode));
  };

  // Compute updated node parameters from handle displacement
  const computeCropUpdate = (handleKey: string, dx: number, dy: number) => {
    let dL = 0;
    let dR = 0;
    let dT = 0;
    let dB = 0;

    // Constrain handle movement within natural image boundaries to prevent stretching
    const minDL = -currentCrop.x * scaleX;
    const maxDR = (naturalW - (currentCrop.x + currentCrop.width)) * scaleX;
    const minDT = -currentCrop.y * scaleY;
    const maxDB = (naturalH - (currentCrop.y + currentCrop.height)) * scaleY;

    if (handleKey.includes("w")) dL = Math.max(minDL, dx);
    if (handleKey.includes("e")) dR = Math.min(maxDR, dx);
    if (handleKey.includes("n")) dT = Math.max(minDT, dy);
    if (handleKey.includes("s")) dB = Math.min(maxDB, dy);

    // Prevent shrinking crop box below 10px display size
    const minDisplaySize = 10;
    let newDisplayW = Math.max(minDisplaySize, displayW - dL + dR);
    let newDisplayH = Math.max(minDisplaySize, displayH - dT + dB);

    // Adjust deltas if min size boundary hit
    if (newDisplayW <= minDisplaySize) {
      if (dL !== 0) dL = displayW + dR - minDisplaySize;
      if (dR !== 0) dR = minDisplaySize - displayW + dL;
      newDisplayW = minDisplaySize;
    }
    if (newDisplayH <= minDisplaySize) {
      if (dT !== 0) dT = displayH + dB - minDisplaySize;
      if (dB !== 0) dB = minDisplaySize - displayH + dT;
      newDisplayH = minDisplaySize;
    }

    // Natural pixel deltas
    const natDL = dL / scaleX;
    const natDR = dR / scaleX;
    const natDT = dT / scaleY;
    const natDB = dB / scaleY;

    // Constrain new crop bounds within image natural boundaries
    const newCropX = Math.max(0, Math.min(naturalW - 10, currentCrop.x + natDL));
    const newCropY = Math.max(0, Math.min(naturalH - 10, currentCrop.y + natDT));
    const newCropW = Math.max(10, Math.min(naturalW - newCropX, currentCrop.width - natDL + natDR));
    const newCropH = Math.max(10, Math.min(naturalH - newCropY, currentCrop.height - natDT + natDB));

    // Shift in local node space to keep un-dragged edges & image content anchored in world space
    const shiftLocalX = (dL + dR) / 2;
    const shiftLocalY = (dT + dB) / 2;

    const rad = (rawNode.transform.rotation * Math.PI) / 180;
    const worldShiftX = shiftLocalX * Math.cos(rad) - shiftLocalY * Math.sin(rad);
    const worldShiftY = shiftLocalX * Math.sin(rad) + shiftLocalY * Math.cos(rad);

    return {
      width: newDisplayW,
      height: newDisplayH,
      transform: {
        ...rawNode.transform,
        x: rawNode.transform.x + worldShiftX,
        y: rawNode.transform.y + worldShiftY,
      },
      crop: {
        x: newCropX,
        y: newCropY,
        width: newCropW,
        height: newCropH,
      },
    };
  };

  // Handle Drag Move: Update canvas transiently (no undo command added)
  const handleDragMove = (handleKey: string, dx: number, dy: number) => {
    const patch = computeCropUpdate(handleKey, dx, dy);
    const currentMechanism = JSON.parse(JSON.stringify(project.mechanism));
    if (updateNodeInTree(currentMechanism, rawNode.id, patch)) {
      setProject({
        ...project,
        mechanism: currentMechanism,
      });
    }
  };

  // Handle Drag End: Commit ONE single undo command for the entire drag action
  const handleDragEnd = (handleKey: string, dx: number, dy: number) => {
    const origSnapshot = dragStartNodeRef.current || JSON.parse(JSON.stringify(rawNode));
    const patch = computeCropUpdate(handleKey, dx, dy);

    // Rollback transient state first to keep command history clean
    const rolledBackMechanism = JSON.parse(JSON.stringify(project.mechanism));
    if (updateNodeInTree(rolledBackMechanism, rawNode.id, origSnapshot)) {
      setProject({ ...project, mechanism: rolledBackMechanism });
    }

    const finalNode = JSON.parse(JSON.stringify(origSnapshot));
    Object.assign(finalNode, patch);

    executeCommand(new UpdateNodeCommand(rawNode.id, origSnapshot, finalNode));
    dragStartNodeRef.current = null;
  };

  const handles = [
    { key: "nw", x: cropBoxX, y: cropBoxY },
    { key: "n", x: cropBoxX + displayW / 2, y: cropBoxY },
    { key: "ne", x: cropBoxX + displayW, y: cropBoxY },
    { key: "e", x: cropBoxX + displayW, y: cropBoxY + displayH / 2 },
    { key: "se", x: cropBoxX + displayW, y: cropBoxY + displayH },
    { key: "s", x: cropBoxX + displayW / 2, y: cropBoxY + displayH },
    { key: "sw", x: cropBoxX, y: cropBoxY + displayH },
    { key: "w", x: cropBoxX, y: cropBoxY + displayH / 2 },
  ];

  return (
    <Group x={x} y={y} rotation={rotation}>
      {/* 1. Full uncropped image as dark ghost background */}
      <KonvaImage
        image={imageEl}
        x={fullDisplayX}
        y={fullDisplayY}
        width={fullDisplayW}
        height={fullDisplayH}
        opacity={0.3}
      />

      {/* Outer boundary box of uncropped full image */}
      <Rect
        x={fullDisplayX}
        y={fullDisplayY}
        width={fullDisplayW}
        height={fullDisplayH}
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth={1}
        dash={[4, 4]}
      />

      {/* 2. Active crop box highlight outline */}
      {(!currentCrop.shape || currentCrop.shape === "rectangle") && (
        <>
          <Rect
            x={cropBoxX}
            y={cropBoxY}
            width={displayW}
            height={displayH}
            stroke="#818cf8"
            strokeWidth={2}
          />
          <Line
            points={[cropBoxX + displayW / 3, cropBoxY, cropBoxX + displayW / 3, cropBoxY + displayH]}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1}
            dash={[2, 2]}
          />
          <Line
            points={[cropBoxX + (displayW * 2) / 3, cropBoxY, cropBoxX + (displayW * 2) / 3, cropBoxY + displayH]}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1}
            dash={[2, 2]}
          />
          <Line
            points={[cropBoxX, cropBoxY + displayH / 3, cropBoxX + displayW, cropBoxY + displayH / 3]}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1}
            dash={[2, 2]}
          />
          <Line
            points={[cropBoxX, cropBoxY + (displayH * 2) / 3, cropBoxX + displayW, cropBoxY + (displayH * 2) / 3]}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1}
            dash={[2, 2]}
          />
        </>
      )}

      {currentCrop.shape === "circle" && (
        <Group>
          <KonvaCircle
            radius={currentCrop.radius || Math.min(displayW, displayH) / 2}
            stroke="#818cf8"
            strokeWidth={2}
            dash={[4, 4]}
          />
          <Line
            points={[- (currentCrop.radius || displayW / 2), 0, (currentCrop.radius || displayW / 2), 0]}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1}
            dash={[2, 2]}
          />
          <Line
            points={[0, - (currentCrop.radius || displayH / 2), 0, (currentCrop.radius || displayH / 2)]}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth={1}
            dash={[2, 2]}
          />
        </Group>
      )}

      {currentCrop.shape === "radialTrapezoid" && (() => {
        const sweepDeg = currentCrop.sweepAngle || 60;
        const halfSweep = (sweepDeg / 2) * (Math.PI / 180);
        const outerR = currentCrop.outerRadius || Math.max(displayW, displayH) / 2;
        const innerR = Math.max(0, currentCrop.innerRadius || 0);

        const x1 = outerR * Math.cos(-halfSweep - Math.PI / 2);
        const y1 = outerR * Math.sin(-halfSweep - Math.PI / 2);
        const x2 = outerR * Math.cos(halfSweep - Math.PI / 2);
        const y2 = outerR * Math.sin(halfSweep - Math.PI / 2);

        const ix1 = innerR * Math.cos(-halfSweep - Math.PI / 2);
        const iy1 = innerR * Math.sin(-halfSweep - Math.PI / 2);
        const ix2 = innerR * Math.cos(halfSweep - Math.PI / 2);
        const iy2 = innerR * Math.sin(halfSweep - Math.PI / 2);

        return (
          <Group>
            <Line
              points={innerR > 0 ? [x1, y1, x2, y2, ix2, iy2, ix1, iy1] : [x1, y1, x2, y2, 0, 0]}
              closed
              stroke="#818cf8"
              strokeWidth={2}
              dash={[4, 4]}
            />
          </Group>
        );
      })()}

      {/* 3. 8 Interactive Crop Handles */}
      {handles.map((h) => (
        <Rect
          key={h.key}
          x={h.x - 5}
          y={h.y - 5}
          width={10}
          height={10}
          fill="#ffffff"
          stroke="#6366f1"
          strokeWidth={2}
          draggable
          onDragStart={handleDragStart}
          onDragMove={(e) => {
            const node = e.target;
            const dx = node.x() + 5 - h.x;
            const dy = node.y() + 5 - h.y;
            node.x(h.x - 5);
            node.y(h.y - 5);
            handleDragMove(h.key, dx, dy);
          }}
          onDragEnd={(e) => {
            const node = e.target;
            const dx = node.x() + 5 - h.x;
            const dy = node.y() + 5 - h.y;
            node.x(h.x - 5);
            node.y(h.y - 5);
            handleDragEnd(h.key, dx, dy);
          }}
        />
      ))}
    </Group>
  );
};
