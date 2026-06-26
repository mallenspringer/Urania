import { describe, it, expect, beforeEach } from "vitest";
import { useViewStore } from "./viewStore";

describe("Viewport View Store", () => {
  beforeEach(() => {
    useViewStore.getState().resetView();
  });

  it("should initialize with default zoom and pan values", () => {
    const state = useViewStore.getState();
    expect(state.zoom).toBe(1);
    expect(state.pan).toEqual({ x: 0, y: 0 });
  });

  it("should update zoom within the allowed boundaries [0.05, 64.0]", () => {
    const store = useViewStore.getState();

    store.setZoom(2.5);
    expect(useViewStore.getState().zoom).toBe(2.5);

    // Below minimum boundary
    store.setZoom(0.01);
    expect(useViewStore.getState().zoom).toBe(0.05);

    // Above maximum boundary
    store.setZoom(100);
    expect(useViewStore.getState().zoom).toBe(64.0);
  });

  it("should update pan values correctly", () => {
    const store = useViewStore.getState();

    store.setPan({ x: 150, y: -200 });
    expect(useViewStore.getState().pan).toEqual({ x: 150, y: -200 });
  });

  it("should reset zoom and pan back to defaults", () => {
    const store = useViewStore.getState();

    store.setZoom(10.5);
    store.setPan({ x: -45, y: 88 });

    store.resetView();
    expect(useViewStore.getState().zoom).toBe(1);
    expect(useViewStore.getState().pan).toEqual({ x: 0, y: 0 });
  });
});
