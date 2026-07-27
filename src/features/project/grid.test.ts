import { describe, it, expect, beforeEach } from "vitest";
import { useViewStore } from "./viewStore";

describe("Canvas Grid & Guides View Store", () => {
  beforeEach(() => {
    useViewStore.setState({
      showCanvasGrid: true,
      gridLayer: "foreground",
      gridMode: "auto-symmetry",
      manualSliceCount: 12,
      showSliceGuides: true,
      showCircularGuides: true,
      gridOpacity: 0.4,
    });
  });

  it("should support 3-way grid layer modes (off, background, foreground)", () => {
    expect(useViewStore.getState().gridLayer).toBe("foreground");

    useViewStore.getState().setGridLayer("off");
    expect(useViewStore.getState().gridLayer).toBe("off");
    expect(useViewStore.getState().showCanvasGrid).toBe(false);

    useViewStore.getState().setGridLayer("background");
    expect(useViewStore.getState().gridLayer).toBe("background");
    expect(useViewStore.getState().showCanvasGrid).toBe(true);
  });

  it("should cycle cleanly through 3-way grid layer modes", () => {
    useViewStore.getState().setGridLayer("off");
    useViewStore.getState().cycleGridLayer();
    expect(useViewStore.getState().gridLayer).toBe("background");

    useViewStore.getState().cycleGridLayer();
    expect(useViewStore.getState().gridLayer).toBe("foreground");

    useViewStore.getState().cycleGridLayer();
    expect(useViewStore.getState().gridLayer).toBe("off");
  });

  it("should update grid mode and clamp manual slice count between 1 and 360", () => {
    useViewStore.getState().setGridMode("manual");
    expect(useViewStore.getState().gridMode).toBe("manual");

    useViewStore.getState().setManualSliceCount(5);
    expect(useViewStore.getState().manualSliceCount).toBe(5);

    useViewStore.getState().setManualSliceCount(500);
    expect(useViewStore.getState().manualSliceCount).toBe(360);

    useViewStore.getState().setManualSliceCount(0);
    expect(useViewStore.getState().manualSliceCount).toBe(1);
  });
});
