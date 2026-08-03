import type { KonvaEventObject } from "konva/lib/Node";
import type { Project } from "../../shared/types/project";
import type { Command } from "../../shared/types/command";

export interface ToolContext {
  project: Project;
  zoom: number;
  pan: { x: number; y: number };
  stageWidth: number;
  stageHeight: number;
  activeRingId: string | null;
  pointerPos: { x: number; y: number } | null; // in world coordinates
  startPos: { x: number; y: number } | null;   // in world coordinates
  executeCommand: (command: Command) => void;
  updatePreview: (data: Record<string, unknown> | null) => void;
  currentPreviewData: Record<string, unknown> | null;
  isShift: boolean;
  isAlt: boolean;
}

export interface Tool {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  cursor: string;
  category: "selection" | "shapes" | "windows" | "text";
  onActivate?(context: ToolContext): void;
  onDeactivate?(context: ToolContext): void;
  onMouseDown?(e: KonvaEventObject<MouseEvent>, context: ToolContext): void;
  onMouseMove?(e: KonvaEventObject<MouseEvent>, context: ToolContext): void;
  onMouseUp?(e: KonvaEventObject<MouseEvent>, context: ToolContext): void;
  onKeyDown?(e: KeyboardEvent, context: ToolContext): void;
  renderPreview?(context: ToolContext): React.ReactNode;
}
