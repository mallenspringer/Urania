import React, { useState, useEffect } from "react";
import {
  Group,
  Ring,
  Arc,
  Circle,
  Rect,
  Line,
  RegularPolygon,
  Text,
  Image as KonvaImage,
} from "react-konva";
import type { ResolvedNode } from "../../features/runtime/mechanismEngine";
import { useProjectStore } from "../../features/project/projectStore";

interface MaskedGroupProps {
  maskIds: string[];
  allNodes: ResolvedNode[];
  children: React.ReactNode;
}

const MaskedGroup: React.FC<MaskedGroupProps> = ({ maskIds, allNodes, children }) => {
  if (maskIds.length === 0) {
    return <>{children}</>;
  }

  const [firstMaskId, ...remainingMaskIds] = maskIds;
  const maskNode = allNodes.find((n) => n.id === firstMaskId);

  if (!maskNode || maskNode.type !== "window") {
    // If mask node is not found or is invalid, skip it
    return (
      <MaskedGroup maskIds={remainingMaskIds} allNodes={allNodes}>
        {children}
      </MaskedGroup>
    );
  }

  const windowTransform = maskNode.worldTransform;
  const shape = maskNode.renderData.shape;

  if (!shape) {
    return (
      <MaskedGroup maskIds={remainingMaskIds} allNodes={allNodes}>
        {children}
      </MaskedGroup>
    );
  }

  const clipFunc = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    // Transform ctx to match window's absolute world position
    ctx.translate(windowTransform.x, windowTransform.y);
    ctx.rotate((windowTransform.rotation * Math.PI) / 180);
    ctx.scale(windowTransform.scaleX, windowTransform.scaleY);

    ctx.beginPath();
    if (shape.type === "circle") {
      ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
    } else if (shape.type === "rectangle") {
      ctx.rect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
    } else if (shape.type === "polygon") {
      const sides = shape.sides || 3;
      const radius = shape.radius || 10;
      ctx.moveTo(radius, 0);
      for (let i = 1; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides;
        ctx.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
      }
      ctx.closePath();
    }
    ctx.restore();
  };

  return (
    <Group clipFunc={clipFunc}>
      <MaskedGroup maskIds={remainingMaskIds} allNodes={allNodes}>
        {children}
      </MaskedGroup>
    </Group>
  );
};

const KonvaImageRenderer: React.FC<{ node: ResolvedNode; assets: any[] }> = ({
  node,
  assets,
}) => {
  const assetId = node.renderData.assetId;
  const asset = assets?.find((a) => a.id === assetId);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (asset?.embeddedData) {
      const img = new window.Image();
      img.src = asset.embeddedData;
      img.onload = () => {
        setImageEl(img);
      };
    } else {
      setImageEl(null);
    }
  }, [asset]);

  if (imageEl) {
    return (
      <KonvaImage
        image={imageEl}
        x={-50}
        y={-50}
        width={100}
        height={100}
      />
    );
  }

  // Placeholder outline when image is not loaded
  return (
    <Group>
      <Rect
        x={-50}
        y={-50}
        width={100}
        height={100}
        stroke="#475569"
        strokeWidth={1}
        dash={[4, 4]}
        fill="rgba(71, 85, 105, 0.1)"
      />
      <Line points={[-50, -50, 50, 50]} stroke="#475569" strokeWidth={1} />
      <Line points={[50, -50, -50, 50]} stroke="#475569" strokeWidth={1} />
    </Group>
  );
};

const ArcTextRenderer: React.FC<{ node: ResolvedNode }> = ({ node }) => {
  const {
    content,
    radius,
    startAngle,
    sweepAngle,
    fontFamily,
    fontSize,
    style,
  } = node.renderData;

  if (!content) return null;

  const chars = content.split("");
  const n = chars.length;

  const actualSweep =
    sweepAngle !== undefined && sweepAngle !== 0
      ? sweepAngle
      : (chars.length * (fontSize * 0.5) / Math.max(1, radius)) * (180 / Math.PI);

  return (
    <Group>
      {chars.map((char, i) => {
        const charAngle =
          n > 1 ? startAngle + i * (actualSweep / (n - 1)) : startAngle;

        const angleRad = (charAngle * Math.PI) / 180;
        const x = radius * Math.cos(angleRad);
        const y = radius * Math.sin(angleRad);

        // Rotation points outward along radius vector
        const rotation = charAngle + 90;

        return (
          <Text
            key={i}
            text={char}
            x={x}
            y={y}
            fontFamily={fontFamily || "Outfit, Inter, sans-serif"}
            fontSize={fontSize || 12}
            fill={style?.fill || "#f1f5f9"}
            align="center"
            offsetX={(fontSize || 12) * 0.3}
            offsetY={(fontSize || 12) * 0.5}
            rotation={rotation}
          />
        );
      })}
    </Group>
  );
};

const WindowOutlineRenderer: React.FC<{ node: ResolvedNode }> = ({ node }) => {
  const shape = node.renderData.shape;
  if (!shape) return null;

  const stroke = "rgba(99, 102, 241, 0.8)";
  const strokeWidth = 1.5;
  const dash = [4, 4];
  const fill = "rgba(99, 102, 241, 0.05)";

  if (shape.type === "circle") {
    return (
      <Circle
        radius={shape.radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "rectangle") {
    return (
      <Rect
        x={-shape.width / 2}
        y={-shape.height / 2}
        width={shape.width}
        height={shape.height}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  } else if (shape.type === "polygon") {
    return (
      <RegularPolygon
        sides={shape.sides || 3}
        radius={shape.radius || 10}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={fill}
      />
    );
  }
  return null;
};

const renderSpecificNode = (node: ResolvedNode, assets: any[]) => {
  const { style, innerRadius, outerRadius, startAngle, endAngle, radius, width, height, length, thickness, sides, content, fontFamily, fontSize } = node.renderData;

  switch (node.type) {
    case "ring":
      return (
        <Ring
          innerRadius={innerRadius || 0}
          outerRadius={outerRadius || 100}
          stroke={style?.stroke || "#475569"}
          strokeWidth={style?.strokeWidth || 1.5}
          fill={style?.fill || "rgba(30, 41, 59, 0.25)"}
        />
      );

    case "sector": {
      const sweepAngle = (endAngle || 0) - (startAngle || 0);
      return (
        <Arc
          innerRadius={innerRadius || 0}
          outerRadius={outerRadius || 100}
          angle={sweepAngle}
          rotation={0}
          fill={style?.fill || "rgba(51, 65, 85, 0.3)"}
          stroke={style?.stroke || "#64748b"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );
    }

    case "circle":
      return (
        <Circle
          radius={radius || 10}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );

    case "rectangle":
      return (
        <Rect
          x={-(width || 0) / 2}
          y={-(height || 0) / 2}
          width={width || 0}
          height={height || 0}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );

    case "line":
      return (
        <Line
          points={[0, 0, length || 0, 0]}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={thickness || style?.strokeWidth || 2}
        />
      );

    case "polygon":
      return (
        <RegularPolygon
          sides={sides || 3}
          radius={radius || 10}
          fill={style?.fill || "rgba(226, 232, 240, 0.15)"}
          stroke={style?.stroke || "#94a3b8"}
          strokeWidth={style?.strokeWidth || 1}
        />
      );

    case "text":
      return (
        <Text
          text={content || ""}
          fontFamily={fontFamily || "Outfit, Inter, sans-serif"}
          fontSize={fontSize || 14}
          fill={style?.fill || "#f1f5f9"}
          x={0}
          y={-(fontSize || 14)}
        />
      );

    case "arcText":
      return <ArcTextRenderer node={node} />;

    case "sectorLabel":
      return (
        <Text
          text={content || ""}
          fontFamily={fontFamily || "Outfit, Inter, sans-serif"}
          fontSize={fontSize || 12}
          fill={style?.fill || "#cbd5e1"}
          align="center"
          x={-50}
          y={-10}
          width={100}
          height={20}
        />
      );

    case "image":
    case "svgAsset":
      return <KonvaImageRenderer node={node} assets={assets} />;

    case "window":
      return <WindowOutlineRenderer node={node} />;

    default:
      return null;
  }
};

interface ResolvedRendererProps {
  nodes: ResolvedNode[];
}

export const ResolvedRenderer: React.FC<ResolvedRendererProps> = ({ nodes }) => {
  const assets = useProjectStore((state) => state.project.assets || []);

  return (
    <Group>
      {/* Central reference indicator */}
      <Group opacity={0.35}>
        <Line points={[-12, 0, 12, 0]} stroke="#cbd5e1" strokeWidth={1} />
        <Line points={[0, -12, 0, 12]} stroke="#cbd5e1" strokeWidth={1} />
        <Circle radius={3} stroke="#cbd5e1" strokeWidth={1} />
      </Group>

      {/* Render each node nested inside its resolved mask list */}
      {nodes.map((node) => (
        <MaskedGroup key={node.id} maskIds={node.maskIds} allNodes={nodes}>
          <Group
            x={node.worldTransform.x}
            y={node.worldTransform.y}
            rotation={node.worldTransform.rotation}
            scaleX={node.worldTransform.scaleX}
            scaleY={node.worldTransform.scaleY}
            visible={node.visible}
          >
            {renderSpecificNode(node, assets)}
          </Group>
        </MaskedGroup>
      ))}
    </Group>
  );
};
