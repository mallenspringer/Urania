// Urania Scene Graph TypeScript Definitions

export interface Transform {
  x: number;
  y: number;
  rotation: number; // in degrees, clockwise positive
  scaleX: number;
  scaleY: number;
}

export interface ProjectMetadata {
  name: string;
  author: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  units: "inches" | "millimeters" | "pixels";
  canvasSize: {
    width: number;
    height: number;
  };
}

export interface Asset {
  id: string;
  type: "image" | "svg";
  mimeType: string;
  embeddedData: string; // base64 encoded or raw text
}

export interface BaseNode {
  id: string;
  type: string;
  name?: string;
  visible: boolean;
  locked: boolean;
  transform: Transform;
  children?: BaseNode[];
}

export interface MechanismNode extends BaseNode {
  type: "volvelle"; // currently only volvelles are supported
}

export interface RingNode extends BaseNode {
  type: "ring";
  innerRadius: number;
  outerRadius: number;
  rotation: number; // active rotation state (degrees, clockwise positive)
  children: Array<SectorNode | ElementNode>;
}

export interface SectorNode extends BaseNode {
  type: "sector";
  startAngle: number; // in degrees (0 to 360)
  endAngle: number; // in degrees (0 to 360)
}

export interface ExportFlags {
  artwork: boolean;
  cut: boolean;
  fold: boolean;
}

export interface ElementNode extends BaseNode {
  style: Record<string, any>;
  export: ExportFlags;
}

// Shape Nodes
export interface CircleNode extends ElementNode {
  type: "circle";
  radius: number;
}

export interface RectangleNode extends ElementNode {
  type: "rectangle";
  width: number;
  height: number;
}

export interface LineNode extends ElementNode {
  type: "line";
  length: number;
  thickness: number;
}

export interface PolygonNode extends ElementNode {
  type: "polygon";
  sides: number;
  radius: number;
  cornerRadius: number;
}

// Text Nodes
export interface TextNode extends ElementNode {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
}

export interface ArcTextNode extends ElementNode {
  type: "arcText";
  content: string;
  radius: number;
  startAngle: number;
  sweepAngle: number;
  fontFamily: string;
  fontSize: number;
}

export interface SectorLabelNode extends ElementNode {
  type: "sectorLabel";
  content: string;
  fontFamily: string;
  fontSize: number;
}

// Asset Placements
export interface ImageNode extends ElementNode {
  type: "image";
  assetId: string;
}

export interface SvgAssetNode extends ElementNode {
  type: "svgAsset";
  assetId: string;
}

// Window Masks
export interface WindowNode extends ElementNode {
  type: "window";
  shape: CircleNode | RectangleNode | PolygonNode; // geometry defining the mask cutout
}

// Procedural Patterns
export interface RadialPatternNode extends ElementNode {
  type: "radialPattern";
  copies: number;
  spacingDegrees: number;
  rotateCopies: boolean;
  children: ElementNode[]; // elements being repeated
}

export interface Project {
  format: "urania";
  version: string; // semver string e.g., "1.0.0"
  mechanismType: "volvelle";
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  assets: Asset[];
  mechanism: MechanismNode;
}
