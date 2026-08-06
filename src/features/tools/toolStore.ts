import { create } from "zustand";

interface ToolState {
  activeToolId: string;
  creationMode: "solid" | "cutout";
  symmetryCount: number; // 1 to 12 (1 = single instance, 4 = 4x quadrant symmetry, etc.)
  radialWarpEnabled: boolean; // canvas-wide: newly created eligible shapes get transformMode: "radial"
  isToolLocked: boolean;
  previewData: any;
  dragStartPos: { x: number; y: number } | null;
  toolSettings: Record<string, any>;
  editingTextNodeId: string | null;
  croppingImageNodeId: string | null;

  setActiveTool: (toolId: string) => void;
  setCreationMode: (mode: "solid" | "cutout") => void;
  setSymmetryCount: (count: number) => void;
  setRadialWarpEnabled: (enabled: boolean) => void;
  setToolLocked: (locked: boolean) => void;
  setPreviewData: (data: any) => void;
  setDragStartPos: (pos: { x: number; y: number } | null) => void;
  updateToolSetting: (key: string, value: any) => void;
  setEditingTextNodeId: (id: string | null) => void;
  setCroppingImageNodeId: (id: string | null) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeToolId: "select",
  creationMode: "solid",
  symmetryCount: 1,
  radialWarpEnabled: false,
  isToolLocked: false,
  previewData: null,
  dragStartPos: null,
  editingTextNodeId: null,
  croppingImageNodeId: null,
  toolSettings: {
    polygonSides: 5,
    fontSize: 14,
    fontFamily: "Outfit",
  },

  setActiveTool: (toolId) =>
    set({
      activeToolId: toolId,
      previewData: null,
      dragStartPos: null,
    }),
  setCreationMode: (mode) => set({ creationMode: mode }),
  setSymmetryCount: (count) => set({ symmetryCount: Math.max(1, Math.min(360, count)) }),
  setRadialWarpEnabled: (enabled) => set({ radialWarpEnabled: enabled }),
  setToolLocked: (locked) => set({ isToolLocked: locked }),
  setPreviewData: (data) => set({ previewData: data }),
  setDragStartPos: (pos) => set({ dragStartPos: pos }),
  setEditingTextNodeId: (id) => set({ editingTextNodeId: id }),
  setCroppingImageNodeId: (id) => set({ croppingImageNodeId: id }),
  updateToolSetting: (key, value) =>
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        [key]: value,
      },
    })),
}));

interface ClipboardState {
  clipboard: any[] | null;
  pasteCount: number;
  setClipboard: (nodes: any[]) => void;
  incrementPasteCount: () => void;
  resetPasteCount: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  clipboard: null,
  pasteCount: 0,
  setClipboard: (nodes) => set({ clipboard: nodes, pasteCount: 0 }),
  incrementPasteCount: () => set((state) => ({ pasteCount: state.pasteCount + 1 })),
  resetPasteCount: () => set({ pasteCount: 0 }),
}));
