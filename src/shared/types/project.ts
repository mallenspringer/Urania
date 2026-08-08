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
  showGrabTabs?: boolean;
}

export interface Asset {
  id: string;
  type: "image" | "svg";
  mimeType: string;
  embeddedData: string; // base64 encoded or raw text
}

export interface SymmetryOffsets {
  radialDistanceOffset?: number;
  angleOffset?: number;
  rotationOffset?: number;
  widthOffset?: number;
  heightOffset?: number;
  styleOverrides?: Record<string, any>;
}

export interface BaseNode {
  id: string;
  type: string;
  name?: string;
  visible: boolean;
  locked: boolean;
  transform: Transform;
  transformMode?: "cartesian" | "radial";
  edgeCurvature?: number; // -1.0 (concave) to +1.0 (convex), default 0 (flat/straight)
  triangleType?: "equilateral" | "isosceles" | "right";
  symmetryGroupId?: string;
  symmetryIndex?: number;
  symmetryCount?: number;
  symmetryUnlinked?: boolean;
  symmetryOffsets?: SymmetryOffsets;
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
  ringShape?: "circle" | "polygon";
  polygonSides?: number; // 3 to 360
  radialSlices?: number; // 2 to 360
  edgeCurvature?: number; // -1.0 (concave) to +1.0 (convex), default 0
  tabShape?: "rectangular" | "semicircular" | "trapezoidal";
  tabWidth?: number;
  tabHeight?: number;
  tabLabel?: string;
  children: Array<SectorNode | ElementNode | DiscTabNode>;
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
  machineRole?: "print" | "plot" | "cut";
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

export interface TrapezoidNode extends ElementNode {
  type: "trapezoid";
  baseWidth: number;
  topWidth: number;
  height: number;
}

export interface CrescentNode extends ElementNode {
  type: "crescent";
  radius: number;
  ratio: number; // thickness ratio (0.1 to 0.9)
  phase: number;  // -1 to 1
}

export interface Point2D {
  x: number;
  y: number;
}

export interface StarNode extends ElementNode {
  type: "star";
  numPoints: number;
  innerRadius: number;
  outerRadius: number;
}

export interface CurveNode extends ElementNode {
  type: "curve";
  controlPoints: {
    p0: Point2D;
    c1: Point2D;
    c2: Point2D;
    p1: Point2D;
  };
  thickness?: number;
}

export interface ArcNode extends ElementNode {
  type: "arc";
  radius: number;
  startAngle: number;
  sweepAngle: number;
  thickness?: number;
}

// Text Nodes
export interface TextNode extends ElementNode {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  kerning?: number;
}

export interface ArcTextNode extends ElementNode {
  type: "arcText";
  content: string;
  radius: number;
  startAngle: number;
  sweepAngle: number;
  fontFamily: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  kerning?: number;
}

export interface SectorLabelNode extends ElementNode {
  type: "sectorLabel";
  content: string;
  fontFamily: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

// Group Nodes
export interface GroupNode extends ElementNode {
  type: "group";
  children: BaseNode[];
}

export type CropShape = "rectangle" | "circle" | "radialTrapezoid";

export interface ImageCrop {
  shape?: CropShape;     // Default: "rectangle"
  x: number;             // Source crop origin X (pixels)
  y: number;             // Source crop origin Y (pixels)
  width: number;         // Source crop width (pixels)
  height: number;        // Source crop height (pixels)
  radius?: number;       // Circle crop radius (display px)
  innerRadius?: number;  // Radial trapezoid inner arc radius (display px)
  outerRadius?: number;  // Radial trapezoid outer arc radius (display px)
  sweepAngle?: number;   // Radial trapezoid angular sweep (degrees)
}

// Asset Placements
export interface ImageNode extends ElementNode {
  type: "image";
  assetId: string;
  width?: number;
  height?: number;
  crop?: ImageCrop;
}

export interface SvgAssetNode extends ElementNode {
  type: "svgAsset";
  assetId: string;
  width?: number;
  height?: number;
  crop?: ImageCrop;
}

export interface TabNode extends ElementNode {
  type: "tab";
  radius: number;
  angle: number;
  width: number;
  height: number;
  tabShape: "rectangular" | "semicircular" | "trapezoidal";
  targetRingId?: string;
  gearRatio?: number;
  trackSweep?: number;
  label?: string;
}

export interface DiscTabNode extends ElementNode {
  type: "discTab";
  angle: number;          // Polar angle in degrees (CW from 0° / 3 o'clock), in the ring's local frame
  edge: "outer";          // v1.0: outer-edge only; inner-edge is post-MVP
  width: number;          // Arc-chord width at the ring edge (px)
  height: number;         // Radial protrusion depth (px)
  cornerRadius: number;   // Rounding on the tab's free edges
  tabShape: "rectangular" | "semicircular" | "trapezoidal";
  label?: string;         // Optional printed text on the tab face
}

// Window Masks
export interface WindowNode extends ElementNode {
  type: "window";
  shape: ElementNode; // geometry defining the mask cutout (shapes, text, etc.)
  savedSolidStyle?: Record<string, any>;
  savedSolidType?: string;
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
  originTemplateId?: string;
  originTemplateVersion?: number;
}
