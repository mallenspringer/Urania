import { create } from "zustand";

interface ToolState {
  activeToolId: string;
  isToolLocked: boolean;
  previewData: any;
  dragStartPos: { x: number; y: number } | null;
  toolSettings: Record<string, any>;
  editingTextNodeId: string | null;

  setActiveTool: (toolId: string) => void;
  setToolLocked: (locked: boolean) => void;
  setPreviewData: (data: any) => void;
  setDragStartPos: (pos: { x: number; y: number } | null) => void;
  updateToolSetting: (key: string, value: any) => void;
  setEditingTextNodeId: (id: string | null) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeToolId: "select",
  isToolLocked: false,
  previewData: null,
  dragStartPos: null,
  editingTextNodeId: null,
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
  setToolLocked: (locked) => set({ isToolLocked: locked }),
  setPreviewData: (data) => set({ previewData: data }),
  setDragStartPos: (pos) => set({ dragStartPos: pos }),
  setEditingTextNodeId: (id) => set({ editingTextNodeId: id }),
  updateToolSetting: (key, value) =>
    set((state) => ({
      toolSettings: {
        ...state.toolSettings,
        [key]: value,
      },
    })),
}));
