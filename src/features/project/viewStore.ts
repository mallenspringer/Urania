import { create } from "zustand";

export type GridLayerMode = "off" | "background" | "foreground";
export type GridLineColorMode = "auto" | "dark" | "light" | "indigo";

interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;

  // Canvas-Wide Grid & Guide System
  showCanvasGrid: boolean;
  gridLayer: GridLayerMode;
  gridMode: "auto-symmetry" | "manual";
  manualSliceCount: number;
  showSliceGuides: boolean;
  showCircularGuides: boolean;
  gridOpacity: number;
  gridLineColorMode: GridLineColorMode;

  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;

  setGridLayer: (layer: GridLayerMode) => void;
  cycleGridLayer: () => void;
  toggleCanvasGrid: () => void;
  setCanvasGridOpen: (open: boolean) => void;
  setGridMode: (mode: "auto-symmetry" | "manual") => void;
  setManualSliceCount: (count: number) => void;
  toggleSliceGuides: () => void;
  toggleCircularGuides: () => void;
  setGridOpacity: (opacity: number) => void;
  setGridLineColorMode: (mode: GridLineColorMode) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  isLeftSidebarOpen: true,
  isRightSidebarOpen: true,

  showCanvasGrid: true,
  gridLayer: "foreground",
  gridMode: "auto-symmetry",
  manualSliceCount: 12,
  showSliceGuides: true,
  showCircularGuides: true,
  gridOpacity: 0.4,
  gridLineColorMode: "auto",

  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(64.0, zoom)) }),
  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
  setLeftSidebarOpen: (open) => set({ isLeftSidebarOpen: open }),
  setRightSidebarOpen: (open) => set({ isRightSidebarOpen: open }),

  setGridLayer: (layer) => set({ gridLayer: layer, showCanvasGrid: layer !== "off" }),
  cycleGridLayer: () =>
    set((state) => {
      const nextMap: Record<GridLayerMode, GridLayerMode> = {
        off: "background",
        background: "foreground",
        foreground: "off",
      };
      const nextLayer = nextMap[state.gridLayer] || "off";
      return { gridLayer: nextLayer, showCanvasGrid: nextLayer !== "off" };
    }),
  toggleCanvasGrid: () =>
    set((state) => {
      const nextLayer = state.gridLayer === "off" ? "foreground" : "off";
      return { gridLayer: nextLayer, showCanvasGrid: nextLayer !== "off" };
    }),
  setCanvasGridOpen: (open) => set({ showCanvasGrid: open, gridLayer: open ? "foreground" : "off" }),
  setGridMode: (mode) => set({ gridMode: mode }),
  setManualSliceCount: (count) => set({ manualSliceCount: Math.max(1, Math.min(360, count)) }),
  toggleSliceGuides: () => set((state) => ({ showSliceGuides: !state.showSliceGuides })),
  toggleCircularGuides: () => set((state) => ({ showCircularGuides: !state.showCircularGuides })),
  setGridOpacity: (opacity) => set({ gridOpacity: Math.max(0.05, Math.min(1.0, opacity)) }),
  setGridLineColorMode: (mode) => set({ gridLineColorMode: mode }),
}));
