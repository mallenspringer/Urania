import { describe, it, expect, beforeEach } from "vitest";
import { useClipboardStore } from "./toolStore";

describe("Clipboard System Store", () => {
  beforeEach(() => {
    useClipboardStore.getState().setClipboard([]);
  });

  it("should set clipboard content and reset paste count to 0", () => {
    const nodes = [{ id: "node-1", type: "rectangle" }];
    useClipboardStore.getState().setClipboard(nodes);
    
    expect(useClipboardStore.getState().clipboard).toEqual(nodes);
    expect(useClipboardStore.getState().pasteCount).toBe(0);
  });

  it("should increment paste count with each copy/paste session", () => {
    const nodes = [{ id: "node-1", type: "rectangle" }];
    useClipboardStore.getState().setClipboard(nodes);

    useClipboardStore.getState().incrementPasteCount();
    expect(useClipboardStore.getState().pasteCount).toBe(1);

    useClipboardStore.getState().incrementPasteCount();
    expect(useClipboardStore.getState().pasteCount).toBe(2);

    // Reset should clear paste offset stacking
    useClipboardStore.getState().resetPasteCount();
    expect(useClipboardStore.getState().pasteCount).toBe(0);
  });
});
